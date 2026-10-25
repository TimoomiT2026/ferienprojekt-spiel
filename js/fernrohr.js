// =============================================================
//  FERNROHR – damit schaust du ganz weit!
//  Man guckt aus Kopfhöhe durch ein rundes Rohr. Mit ➕ und ➖
//  (oder zwei Fingern) zoomt man heran. Hält man etwas Besonderes
//  (ein Boot, später andere Inseln) eine Sekunde lang genau in die
//  Mitte, dann hat man es ENTDECKT.
//
//  Wie geht Zoomen? Die Kamera hat ein "Sichtfeld" (fov) in Grad.
//  Normal sind es 60°. Machen wir es kleiner, sieht man nur noch
//  ein kleines Stück – aber das ganz groß. 60° : 5° = 12-fach!
// =============================================================
import * as THREE from 'three';
import { knopf } from './steuerung.js';
import { bodenHoehe, setzeSichtweite } from './gelaende.js';
import { FERNSICHT } from './himmel.js';
import { setzeFernblick } from './natur.js';
import { EINSTELLUNGEN } from './einstellungen.js';

// ---------- Zahlen zum Rumprobieren ----------
const NORMALES_SICHTFELD = 60; // so viel Grad sieht man ohne Fernrohr
const ZOOM_MIN = 2; // 2-fach  → Sichtfeld 30°
const ZOOM_MAX = 12; // 12-fach → Sichtfeld 5°
const ZOOM_START = 4; // so weit ist es am Anfang herangezoomt
const ZOOM_STUFEN = [2, 3, 4, 6, 8, 12]; // hier springen ➕ und ➖ hin
const KOPF_HOEHE = 2.1; // so hoch über den Füßen sind die Augen
const NEIGUNG_UNTEN = -35; // so weit kann man nach unten gucken (Grad)
const NEIGUNG_OBEN = 25; // so weit nach oben (Grad)
const ZIEL_WINKEL = 3; // so nah (Grad) muss ein Ziel an der Mitte sein
const ZIEL_WEITE = 600; // weiter weg (Meter) sieht man nichts mehr genau
const ANVISIER_ZEIT = 0.4; // so kurz muss man draufhalten, dann kommt der Knopf „entdecken“
const WISCH_TEMPO = 0.003; // wie stark Wischen dreht (bei 1-fach Zoom)
const JOYSTICK_TEMPO = 1.4; // wie schnell der Joystick / die Pfeiltasten drehen

const GRAD = Math.PI / 180;

export class Fernrohr {
  constructor(kamera, elternElement) {
    this.kamera = kamera;
    this._aktiv = false;
    this.ziele = new Map(); // id → { name, bild, pos, beiEntdeckt, entdeckt }
    this._meldung = null;

    this.drehung = 0; // wohin wir gucken (links/rechts), wie kameraWinkel
    this.neigung = 0; // hoch/runter, in Bogenmaß (+ = nach oben)
    this.zoom = ZOOM_START; // so stark ist es gerade herangezoomt
    this.zoomZiel = ZOOM_START; // da will der Zoom hin (er gleitet weich)
    this.wisch = { x: 0, y: 0 }; // wie weit seit dem letzten Bild gewischt wurde
    this.anvisiert = null; // dieses Ziel ist gerade in der Mitte
    this.anvisierZeit = 0; // so lange schon

    this.baueOverlay(elternElement);
    this.verbindeGesten();
  }

  get aktiv() { return this._aktiv; }
  // Wohin man zuletzt geguckt hat – main.js kann danach die normale Kamera so drehen
  get blickWinkel() { return this.drehung; }
  set meldung(fn) { this._meldung = fn; }

  // ---------- Das Bild über dem Spiel bauen ----------
  baueOverlay(eltern) {
    const o = document.createElement('div');
    o.id = 'fernrohr';
    o.innerHTML = `
      <div class="fr-linse">
        <div class="fr-glanz"></div>
        <svg class="fr-kreuz" viewBox="-100 -100 200 200" aria-hidden="true">
          <line x1="-100" y1="0" x2="-14" y2="0" />
          <line x1="14" y1="0" x2="100" y2="0" />
          <line x1="0" y1="-100" x2="0" y2="-14" />
          <line x1="0" y1="14" x2="0" y2="100" />
          <line class="strich" x1="-40" y1="-3" x2="-40" y2="3" />
          <line class="strich" x1="40" y1="-3" x2="40" y2="3" />
          <line class="strich" x1="-3" y1="40" x2="3" y2="40" />
          <line class="strich" x1="-3" y1="-40" x2="3" y2="-40" />
          <circle class="punkt" r="1.2" />
          <circle class="ring-hinten" r="10" />
          <circle class="ring" r="10" pathLength="100" />
        </svg>
        <div class="fr-fund"></div>
      </div>
      <button class="fr-entdecken">🔭 Insel entdecken!</button>
      <div class="fr-zoom-anzeige">4×</div>
      <div class="fr-hinweis">☝️ Wischen = umschauen · Insel in die Mitte → Knopf „entdecken“</div>
      <button class="fr-zu" aria-label="Fernrohr weglegen">✕</button>
      <div class="fr-zoom-knoepfe">
        <button class="fr-mehr" aria-label="Näher heran">➕</button>
        <button class="fr-weniger" aria-label="Weiter weg">➖</button>
      </div>`;
    eltern.appendChild(o);
    this.overlay = o;
    this.ring = o.querySelector('.ring');
    this.zoomAnzeige = o.querySelector('.fr-zoom-anzeige');
    this.fundFeld = o.querySelector('.fr-fund');
    this.hinweis = o.querySelector('.fr-hinweis');

    // Ist eine Insel in der Mitte? Dann erscheint dieser Knopf – antippen = entdeckt!
    this.entdeckKnopf = o.querySelector('.fr-entdecken');
    knopf(this.entdeckKnopf, () => { if (this.anvisiert) this.entdecke(this.anvisiert); });
    knopf(o.querySelector('.fr-zu'), () => this.beenden());
    knopf(o.querySelector('.fr-mehr'), () => this.zoomStufe(+1));
    knopf(o.querySelector('.fr-weniger'), () => this.zoomStufe(-1));
  }

  // ---------- Finger, Maus und Tasten ----------
  verbindeGesten() {
    const o = this.overlay;
    this.finger = new Map(); // Finger-Nummer → {x, y}
    this.pinchAbstand = 0;

    const fingerAbstand = () => {
      const [a, b] = [...this.finger.values()];
      return Math.hypot(a.x - b.x, a.y - b.y);
    };

    o.addEventListener('touchstart', (e) => {
      e.preventDefault();
      e.stopPropagation(); // sonst startet unten der Spiel-Joystick!
      for (const t of e.changedTouches) this.finger.set(t.identifier, { x: t.clientX, y: t.clientY });
      if (this.finger.size === 2) this.pinchAbstand = fingerAbstand();
    }, { passive: false });

    o.addEventListener('touchmove', (e) => {
      e.preventDefault();
      e.stopPropagation();
      for (const t of e.changedTouches) {
        const alt = this.finger.get(t.identifier);
        if (!alt) continue;
        // Nur EIN Finger auf dem Glas? Dann schauen wir uns um.
        if (this.finger.size === 1) {
          this.wisch.x += t.clientX - alt.x;
          this.wisch.y += t.clientY - alt.y;
        }
        alt.x = t.clientX;
        alt.y = t.clientY;
      }
      // ZWEI Finger: auseinander = näher heran, zusammen = weiter weg
      if (this.finger.size === 2) {
        const abstand = fingerAbstand();
        if (this.pinchAbstand > 0) this.setzeZoom(this.zoomZiel * (abstand / this.pinchAbstand));
        this.pinchAbstand = abstand;
      }
    }, { passive: false });

    const fingerWeg = (e) => {
      e.stopPropagation();
      for (const t of e.changedTouches) this.finger.delete(t.identifier);
      this.pinchAbstand = this.finger.size === 2 ? fingerAbstand() : 0;
    };
    o.addEventListener('touchend', fingerWeg);
    o.addEventListener('touchcancel', fingerWeg);

    // Maus: ziehen = umschauen, Rad = zoomen (für den Mac)
    let mausDruck = false;
    o.addEventListener('mousedown', (e) => { e.stopPropagation(); mausDruck = true; });
    window.addEventListener('mouseup', () => (mausDruck = false));
    window.addEventListener('mousemove', (e) => {
      if (!mausDruck || !this._aktiv) return;
      this.wisch.x += e.movementX;
      this.wisch.y += e.movementY;
    });
    o.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.setzeZoom(this.zoomZiel * Math.exp(-e.deltaY * 0.002));
    }, { passive: false });

    window.addEventListener('keydown', (e) => {
      if (!this._aktiv) return;
      if (e.key === '+' || e.code === 'NumpadAdd') this.zoomStufe(+1);
      if (e.key === '-' || e.code === 'NumpadSubtract') this.zoomStufe(-1);
    });
  }

  // ---------- Zoom ----------
  setzeZoom(wert) {
    this.zoomZiel = THREE.MathUtils.clamp(wert, ZOOM_MIN, ZOOM_MAX);
  }

  // Zur nächsten Stufe springen (+1 = näher, -1 = weiter weg)
  zoomStufe(richtung) {
    const jetzt = this.zoomZiel;
    const stufe = richtung > 0
      ? ZOOM_STUFEN.find((s) => s > jetzt + 0.01) ?? ZOOM_MAX
      : [...ZOOM_STUFEN].reverse().find((s) => s < jetzt - 0.01) ?? ZOOM_MIN;
    this.setzeZoom(stufe);
  }

  // ---------- Fernrohr ans Auge / wieder weg ----------
  starten(spielerPos, blickWinkel) {
    if (this._aktiv) return;
    this._aktiv = true;
    document.body.classList.add('fernrohr-aktiv'); // Uhr & Co. ausblenden (siehe style.css)
    this.kamera.position.set(spielerPos.x, spielerPos.y + KOPF_HOEHE, spielerPos.z);
    this.drehung = blickWinkel;
    this.neigung = 0; // erst mal geradeaus zum Horizont
    this.zoom = this.zoomZiel = ZOOM_START;
    this.wisch.x = this.wisch.y = 0;
    this.finger.clear();
    this.anvisiert = null;
    this.anvisierZeit = 0;
    this.alteReihenfolge = this.kamera.rotation.order;
    this.kamera.rotation.order = 'YXZ'; // erst drehen, dann neigen – wie ein Kopf
    this.fundFeld.classList.remove('sichtbar');
    this.hinweis.classList.add('sichtbar');
    clearTimeout(this.hinweisTimer);
    this.hinweisTimer = setTimeout(() => this.hinweis.classList.remove('sichtbar'), 4000);
    this.overlay.classList.add('offen');
    this.fernsichtAn();
    this.stelleKamera();
  }

  // ---------- Durchs Fernrohr verschwindet der Dunst ----------
  // Der Nebel wird weiter weggeschoben, damit man die anderen Inseln sieht.
  // Beim Weglegen kommt alles GENAU so zurück, wie es vorher war.
  fernsichtAn() {
    const E = EINSTELLUNGEN.fernrohr || {};
    const nebel = FERNSICHT.nebel;
    if (nebel && !this.nebelVorher) this.nebelVorher = { near: nebel.near, far: nebel.far };
    FERNSICHT.dunst = E.dunstRest ?? 0.15;
    setzeSichtweite(E.inselSichtweite ?? 900);
    setzeFernblick(E.inselSichtweite ?? 900);
    this.stelleNebel();
  }

  // Je stärker der Zoom, desto weiter sieht man
  stelleNebel() {
    const nebel = FERNSICHT.nebel, vorher = this.nebelVorher;
    if (!nebel || !vorher) return;
    const E = EINSTELLUNGEN.fernrohr || {};
    const t = THREE.MathUtils.clamp((this.zoom - ZOOM_MIN) / (6 - ZOOM_MIN), 0, 1); // ab 6× volle Weite
    const faktor = THREE.MathUtils.lerp(E.nebelWeitMin ?? 2.5, E.nebelWeitMax ?? 4, t);
    nebel.near = vorher.near * faktor;
    nebel.far = vorher.far * faktor;
  }

  fernsichtAus() {
    const nebel = FERNSICHT.nebel;
    if (nebel && this.nebelVorher) {
      nebel.near = this.nebelVorher.near;
      nebel.far = this.nebelVorher.far;
    }
    this.nebelVorher = null;
    FERNSICHT.dunst = 1;
    setzeSichtweite();
    setzeFernblick(0);
  }

  beenden() {
    if (!this._aktiv) return;
    this._aktiv = false;
    document.body.classList.remove('fernrohr-aktiv');
    this.overlay.classList.remove('offen');
    this.finger.clear();
    this.fernsichtAus();
    // Alles wieder normal: 60° Sichtfeld
    this.kamera.fov = NORMALES_SICHTFELD;
    this.kamera.rotation.order = this.alteReihenfolge || 'XYZ';
    this.kamera.updateProjectionMatrix();
  }

  // Ein Ding, das man durchs Fernrohr entdecken kann.
  // hoehe = wie hoch es aus dem Boden/Wasser ragt (eine Insel ist hoch, ein Boot nicht)
  // Gleiche id nochmal? Dann wird es nur neu eingestellt (bleibt entdeckt).
  ziel(id, { name, bild, pos, beiEntdeckt, hoehe = 1 }) {
    const alt = this.ziele.get(id);
    this.ziele.set(id, { name, bild, pos, beiEntdeckt, hoehe, entdeckt: alt?.entdeckt ?? false });
  }

  // Ziel wieder wegnehmen (z. B. wenn es nicht mehr da ist)
  entferneZiel(id) { this.ziele.delete(id); }

  // ---------- Jedes Bild einmal ----------
  aktualisiere(dt, eingabe = {}) {
    if (!this._aktiv) return;
    // Rucksack-Taste (I / Esc) legt das Fernrohr weg
    if (eingabe.rucksack) { this.beenden(); return; }

    // Je stärker der Zoom, desto feiner dreht man – sonst wackelt alles
    const fein = 1 / this.zoom;
    const r = eingabe.richtung || { x: 0, y: 0 };
    this.drehung -= this.wisch.x * WISCH_TEMPO * fein;
    this.neigung -= this.wisch.y * WISCH_TEMPO * fein;
    this.wisch.x = this.wisch.y = 0;
    // Joystick / Pfeiltasten drehen auch
    this.drehung -= r.x * JOYSTICK_TEMPO * fein * dt;
    this.neigung += r.y * JOYSTICK_TEMPO * fein * dt;
    // Falls die normale Spiel-Steuerung doch etwas schickt (z. B. Maus)
    this.drehung += (eingabe.kameraDrehung || 0) * fein * 2;
    this.neigung -= (eingabe.kameraNeigung || 0) * fein * 2;
    this.neigung = THREE.MathUtils.clamp(this.neigung, NEIGUNG_UNTEN * GRAD, NEIGUNG_OBEN * GRAD);

    // Zoom gleitet weich zum Ziel (in "Mal"-Schritten, damit es gleichmäßig wirkt)
    const weich = Math.min(1, dt * 8);
    this.zoom = Math.exp(THREE.MathUtils.lerp(Math.log(this.zoom), Math.log(this.zoomZiel), weich));
    if (Math.abs(this.zoom - this.zoomZiel) < 0.002) this.zoom = this.zoomZiel;
    this.zoomAnzeige.textContent = `${Math.round(this.zoom)}×`;

    this.stelleNebel();
    this.stelleKamera();
    this.pruefeZiele(dt);
  }

  stelleKamera() {
    const k = this.kamera;
    k.fov = NORMALES_SICHTFELD / this.zoom;
    k.updateProjectionMatrix();
    k.rotation.set(this.neigung, this.drehung, 0);
    k.updateMatrixWorld();
  }

  // ---------- Ist ein Ziel in der Mitte? ----------
  pruefeZiele(dt) {
    const auge = this.kamera.position;
    const blick = new THREE.Vector3();
    this.kamera.getWorldDirection(blick);
    const richtung = new THREE.Vector3();

    let bestes = null;
    // Bei starkem Zoom muss man genauer zielen (sonst wäre "Mitte" fast das ganze Bild)
    let besterWinkel = Math.min(ZIEL_WINKEL, this.kamera.fov * 0.2) * GRAD;
    for (const ziel of this.ziele.values()) {
      if (ziel.entdeckt) continue;
      richtung.subVectors(ziel.pos, auge);
      richtung.y += ziel.hoehe / 2; // auf die Mitte des Ziels gucken
      const weite = richtung.length();
      if (weite > ZIEL_WEITE || weite < 0.5) continue;
      const winkel = blick.angleTo(richtung);
      if (winkel < besterWinkel && this.freieSicht(auge, ziel.pos, ziel.hoehe)) {
        bestes = ziel;
        besterWinkel = winkel;
      }
    }

    // Ein anderes Ziel? Dann fängt das Zählen von vorne an
    if (bestes !== this.anvisiert) {
      this.anvisiert = bestes;
      this.anvisierZeit = 0;
    }
    if (bestes) this.anvisierZeit += dt;
    this.zeigeRing();
  }

  // Steht ein Hügel im Weg? Wir prüfen ein paar Punkte auf der Linie
  // vom Auge bis zur Spitze des Ziels. (Tipp: auf einen Berg steigen!)
  freieSicht(von, nach, hoehe = 1) {
    const schritte = 40;
    for (let i = 1; i < schritte; i++) {
      const t = i / schritte;
      const x = von.x + (nach.x - von.x) * t;
      const z = von.z + (nach.z - von.z) * t;
      const y = von.y + (nach.y + hoehe - von.y) * t;
      if (bodenHoehe(x, z) > y) return false;
    }
    return true;
  }

  zeigeRing() {
    // Der Ring füllt sich kurz – dann ist das Ziel „eingefangen“ und der Knopf erscheint
    const anteil = this.anvisiert ? Math.min(1, this.anvisierZeit / ANVISIER_ZEIT) : 0;
    this.ring.style.strokeDashoffset = String(100 - anteil * 100);
    this.overlay.classList.toggle('zielt', !!this.anvisiert);
    const bereit = !!this.anvisiert && anteil >= 1;
    if (bereit) this.entdeckKnopf.textContent = `🔭 ${this.anvisiert.name} entdecken!`;
    this.entdeckKnopf.classList.toggle('sichtbar', bereit);
  }

  entdecke(ziel) {
    ziel.entdeckt = true;
    this.anvisiert = null;
    this.anvisierZeit = 0;
    if (ziel.beiEntdeckt) ziel.beiEntdeckt();
    const text = `🔭 Entdeckt: ${ziel.bild} ${ziel.name}!`;
    if (this._meldung) this._meldung(text, 4);
    // Auch im Fernrohr selbst zeigen – die normale Meldung liegt ja dahinter
    this.fundFeld.textContent = text;
    this.fundFeld.classList.remove('sichtbar');
    void this.fundFeld.offsetWidth; // Trick: Animation neu starten
    this.fundFeld.classList.add('sichtbar');
    clearTimeout(this.fundTimer);
    this.fundTimer = setTimeout(() => this.fundFeld.classList.remove('sichtbar'), 3000);
  }
}
