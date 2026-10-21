// =============================================================
//  DER HEISSLUFTBALLON 🎈
//  Kauft man beim Händler. Dann steht er an der Base, angebunden
//  an einem Pflock, und wippt leicht im Wind.
//
//  Bedienung (am Ballon, Knopf „🎈 Ballon“):
//    • ZWEIMAL schnell tippen → sofort los ins Dorf
//      (im Dorf: zweimal tippen → sofort nach Hause zur Base)
//    • EINMAL tippen → ein kleines Fenster: Wohin fliegen wir?
//
//  Der Flug: einsteigen → der Brenner faucht → hoch in die Luft →
//  hinübergleiten → sanft landen → aussteigen.
//  Solange der Ballon fährt, ist ballon.faehrt = true
//  (dann bewegt main.js die Figur nicht selbst).
// =============================================================
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { EINSTELLUNGEN } from './einstellungen.js';
import { bodenHoehe, abstandZumPfad, istKlippenWand, DORF, WASSER_HOEHE } from './gelaende.js';
import { knopf } from './steuerung.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const glatt = (t) => {
  t = THREE.MathUtils.clamp(t, 0, 1);
  return t * t * t * (t * (t * 6 - 15) + 10); // ganz weich anfahren und bremsen
};
// Die Einstellungen (mit Ersatz-Zahlen, falls etwas fehlt)
const E = () => ({
  steigSekunden: 5,
  sinkSekunden: 4.5,
  flugHoehe: 26,
  tempo: 24,
  minGleitSekunden: 4,
  maxGleitSekunden: 16,
  doppelTippSekunden: 0.6,
  basePlatz: { x: 17, z: -2 },
  brennerLautstaerke: 0.7,
  ...(EINSTELLUNGEN.ballon || {}),
});

// ---------- Hilfe: ein Teil einfärben, verschieben und vorbereiten ----------
function farbig(geo, farbe, matrix) {
  const g = geo;
  for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
  if (matrix) g.applyMatrix4(matrix);
  const c = new THREE.Color(farbe);
  const n = g.attributes.position.count;
  const f = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) f.set([c.r, c.g, c.b], i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(f, 3));
  return g;
}

// Ein Stab (Seil) von Punkt a nach Punkt b
function stab(a, b, dicke, farbe) {
  const r = b.clone().sub(a);
  const geo = new THREE.CylinderGeometry(dicke, dicke, 1, 5);
  const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), r.clone().normalize());
  return farbig(geo, farbe, new THREE.Matrix4().compose(a.clone().lerp(b, 0.5), q, V(1, r.length(), 1)));
}

// ---------- Das Modell: Hülle mit bunten Streifen, runder Korb, Seile ----------
// Alles klebt zu EINEM Modell zusammen → nur ein Draw Call.
export const KORB_HOEHE = 0.95;
function baueBallonGeometrie() {
  const teile = [];
  // Die Form der Hülle von der Seite: unten schmal (Öffnung), oben dick und rund – wie ein Tropfen
  const kontrolle = [
    [0.5, 2.6], [0.8, 3.05], [1.45, 3.8], [2.2, 4.8], [2.75, 5.9], [2.95, 6.9],
    [2.85, 7.8], [2.45, 8.65], [1.7, 9.3], [0.8, 9.65], [0.001, 9.75],
  ];
  const kurve = new THREE.CatmullRomCurve3(kontrolle.map(([r, y]) => V(r, y, 0)));
  const profil = kurve.getPoints(26).map((p) => new THREE.Vector2(Math.max(0.001, p.x), p.y));
  // 12 Streifen, jeder bekommt seine eigene Farbe (scharfe Kanten zwischen den Farben)
  const FARBEN = ['#ff4f5e', '#ffd23f', '#3fa7ff', '#ffffff', '#5ccf6a', '#ff9a3c'];
  const STREIFEN = 12;
  for (let i = 0; i < STREIFEN; i++) {
    const geo = new THREE.LatheGeometry(profil, 3, (i / STREIFEN) * Math.PI * 2, (Math.PI * 2) / STREIFEN);
    teile.push(farbig(geo, FARBEN[i % FARBEN.length]));
  }
  // Ein gelbes Band um den Bauch und ein rotes Käppchen oben
  teile.push(farbig(new THREE.TorusGeometry(2.93, 0.09, 6, 40), '#ffe680', new THREE.Matrix4().compose(V(0, 6.55, 0), new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)), V(1, 1, 1))));
  teile.push(farbig(new THREE.SphereGeometry(0.85, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), '#e8344a', new THREE.Matrix4().compose(V(0, 9.45, 0), new THREE.Quaternion(), V(1, 0.42, 1))));
  // Unten der Kragen an der Öffnung
  teile.push(farbig(new THREE.TorusGeometry(0.52, 0.06, 6, 16), '#7a4a2a', new THREE.Matrix4().compose(V(0, 2.6, 0), new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)), V(1, 1, 1))));

  // Der Korb: rund (nicht eckig!), oben etwas breiter, mit dickem Rand
  const korb = new THREE.CylinderGeometry(0.82, 0.7, KORB_HOEHE, 18, 1, true);
  teile.push(farbig(korb, '#b9803f', new THREE.Matrix4().makeTranslation(0, KORB_HOEHE / 2, 0)));
  teile.push(farbig(new THREE.CircleGeometry(0.7, 18), '#8f5f2c', new THREE.Matrix4().compose(V(0, 0.03, 0), new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)), V(1, 1, 1))));
  const ring = (r, y, dicke, farbe) =>
    teile.push(farbig(new THREE.TorusGeometry(r, dicke, 6, 22), farbe, new THREE.Matrix4().compose(V(0, y, 0), new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)), V(1, 1, 1))));
  ring(0.82, KORB_HOEHE, 0.075, '#7d5128'); // oberer Rand (gepolstert)
  ring(0.71, 0.04, 0.06, '#7d5128'); // unterer Rand
  ring(0.77, 0.5, 0.025, '#9a6630'); // Flechtmuster in der Mitte

  // Sandsäcke außen am Korb
  for (let i = 0; i < 4; i++) {
    const w = (i / 4) * Math.PI * 2 + 0.4;
    teile.push(farbig(new THREE.SphereGeometry(0.17, 8, 6), '#dcc48c', new THREE.Matrix4().compose(V(Math.cos(w) * 0.86, 0.62, Math.sin(w) * 0.86), new THREE.Quaternion(), V(1, 1.25, 1))));
  }

  // Der Brenner zwischen Korb und Hülle
  teile.push(farbig(new THREE.CylinderGeometry(0.2, 0.24, 0.26, 12), '#6f757c', new THREE.Matrix4().makeTranslation(0, 2.05, 0)));
  // Seile vom Korbrand zur Hülle, und Stangen zum Brenner
  for (let i = 0; i < 6; i++) {
    const w = (i / 6) * Math.PI * 2;
    const unten = V(Math.cos(w) * 0.8, KORB_HOEHE, Math.sin(w) * 0.8);
    teile.push(stab(unten, V(Math.cos(w) * 0.52, 2.62, Math.sin(w) * 0.52), 0.022, '#e6d3a6'));
    if (i % 2 === 0) teile.push(stab(unten, V(Math.cos(w) * 0.2, 2.0, Math.sin(w) * 0.2), 0.02, '#8b9097'));
  }
  return mergeGeometries(teile);
}

// Pflock (Holzpfahl) zum Anbinden
function bauePflockGeometrie() {
  return mergeGeometries([
    farbig(new THREE.CylinderGeometry(0.09, 0.06, 0.7, 7), '#7a5232', new THREE.Matrix4().makeTranslation(0, 0.3, 0)),
    farbig(new THREE.SphereGeometry(0.11, 8, 5), '#8f6340', new THREE.Matrix4().makeTranslation(0, 0.65, 0)),
  ]);
}

// =============================================================
export class Ballon {
  constructor(szene, hindernisse, spiel) {
    // spiel = { spieler, meldung, musik, haendler, elternElement, boote?, pferde? }
    this.spiel = spiel;
    this.hindernisse = hindernisse;
    this.gekauft = false;
    this.ort = 'base'; // wo der Ballon gerade steht (id eines Ziels)
    this.letztesDorf = 'dorf'; // dahin geht's beim Doppeltipp an der Base
    this.faehrt = false;
    this.kameraZoom = 0; // 0 = normal, 1 = Kamera ganz weit weg (für main.js)
    this.zeit = 0;
    this.reise = null;
    this.tippZeit = -1; // wann wurde zuletzt getippt? (für den Doppeltipp)
    this.tippTimer = null;
    this.hindernis = null;
    this.beiAnkunft = null; // optional: wird nach dem Landen aufgerufen (ziel)
    this.beiGekauft = null; // optional: wird nach dem Kauf aufgerufen

    // ---------- Die Ziele ----------
    this.ziele = [];
    this.ziel('base', { name: 'Base', bild: '🏠', ...E().basePlatz, genau: true, freigeschaltet: true });
    this.ziel('dorf', { name: 'Dorf', bild: '🏘️', x: DORF.x, z: DORF.z, radius: DORF.radius, freigeschaltet: true });
    // Das Palmendorf kennt man erst, wenn man es entdeckt hat (main.js schaltet es frei)
    const palme = (EINSTELLUNGEN.inseln || []).find((i) => i.dorfPlatz && /palm/i.test(i.name));
    this.ziel('palmendorf', {
      name: 'Palmendorf', bild: '🌴',
      x: palme ? palme.x + palme.dorfPlatz.x : 0, z: palme ? palme.z + palme.dorfPlatz.z : 0,
      radius: palme ? palme.dorfPlatz.radius : 18,
      freigeschaltet: false,
    });

    // ---------- Das Modell ----------
    this.material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, side: THREE.DoubleSide });
    this.gruppe = new THREE.Group();
    this.koerper = new THREE.Mesh(baueBallonGeometrie(), this.material);
    this.koerper.castShadow = true;
    this.gruppe.add(this.koerper);
    // Die Brenner-Flamme (leuchtet nur, wenn der Brenner faucht)
    this.flamme = new THREE.Mesh(
      new THREE.ConeGeometry(0.2, 0.75, 10).translate(0, 0.37, 0),
      new THREE.MeshBasicMaterial({ color: '#ffb22e', transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    this.flamme.position.y = 2.15;
    this.flamme.visible = false;
    this.gruppe.add(this.flamme);
    this.gruppe.visible = false;
    szene.add(this.gruppe);

    // Pflock + Halteseil (bleiben am Boden, wenn der Ballon wippt)
    this.pflock = new THREE.Mesh(bauePflockGeometrie(), this.material);
    this.halteSeil = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1, 5), new THREE.MeshStandardMaterial({ color: '#e0cc9a', roughness: 1 }));
    this.pflock.visible = this.halteSeil.visible = false;
    szene.add(this.pflock, this.halteSeil);
    this.flammeAn = 0;
    this.naechsterFauch = 0;

    // ---------- Die Aktion am Ballon ----------
    this.interaktion = {
      pos: V(0, 0, 0),
      radius: 3.4,
      bild: '🎈',
      text: 'Ballon',
      aktiv: () => this.gekauft && !this.faehrt,
      ausfuehren: () => this.getippt(),
    };
    this.interaktionen = [this.interaktion];

    this.baueFenster();
    this.anmeldenBeimHaendler();
    this.platzieren();
  }

  // ---------- Ziele hinzufügen oder freischalten ----------
  // daten: { name, bild, x, z, radius?, freigeschaltet? }
  //   radius → (x, z) ist die Mitte eines Dorfes, gelandet wird am Rand davon
  //   ohne radius → gelandet wird möglichst genau bei (x, z)
  ziel(id, daten = {}) {
    let z = this.ziele.find((d) => d.id === id);
    if (!z) {
      z = { id, name: id, bild: '📍', x: 0, z: 0, freigeschaltet: false };
      this.ziele.push(z);
    }
    const ortGeaendert = daten.x !== undefined && (daten.x !== z.x || daten.z !== z.z);
    Object.assign(z, daten);
    if (ortGeaendert) z.platz = null; // Landeplatz neu suchen
    if (this.ort === id && this.gekauft && !this.faehrt && ortGeaendert) this.platzieren();
    return z;
  }

  freischalten(id) {
    return this.ziel(id, { freigeschaltet: true });
  }

  // ---------- Landeplatz suchen: fester, flacher Boden, kein Baum, kein Haus ----------
  istFrei(x, z) {
    const h = bodenHoehe(x, z);
    if (h < WASSER_HOEHE + 0.6) return false;
    if (istKlippenWand(x, z)) return false;
    for (const [dx, dz] of [[2.5, 0], [-2.5, 0], [0, 2.5], [0, -2.5]]) {
      const h2 = bodenHoehe(x + dx, z + dz);
      if (Math.abs(h2 - h) > 1 || h2 < WASSER_HOEHE + 0.3) return false;
    }
    if (this.hindernis) this.hindernisse.entfernen(this.hindernis), (this.hindernis = null);
    if (this.hindernisse.trifft(x, z, 2.2)) return false;
    if (Math.hypot(x - DORF.x, z - DORF.z) > DORF.radius + 2 && abstandZumPfad(x, z) < 2.5) return false;
    return true;
  }

  landeplatz(ziel) {
    if (ziel.platz) return ziel.platz;
    let gefunden = null;
    if (ziel.radius && !ziel.genau) {
      // Am Rand vom Dorf, am liebsten auf der Seite, die zur Base zeigt
      const zurBase = Math.atan2(E().basePlatz.z - ziel.z, E().basePlatz.x - ziel.x);
      suche: for (let r = ziel.radius + 4; r <= ziel.radius + 30; r += 2) {
        for (let k = 0; k <= 36; k++) {
          const w = zurBase + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * (Math.PI / 18);
          const x = ziel.x + Math.cos(w) * r, z = ziel.z + Math.sin(w) * r;
          if (this.istFrei(x, z)) { gefunden = { x, z }; break suche; }
        }
      }
    } else {
      // Möglichst genau hier – sonst in immer größeren Kreisen drumherum
      suche: for (let r = 0; r <= 40; r += 1.5) {
        const punkte = r === 0 ? 1 : Math.ceil((Math.PI * 2 * r) / 2);
        for (let i = 0; i < punkte; i++) {
          const w = (i / punkte) * Math.PI * 2;
          const x = ziel.x + Math.cos(w) * r, z = ziel.z + Math.sin(w) * r;
          if (this.istFrei(x, z)) { gefunden = { x, z }; break suche; }
        }
      }
    }
    ziel.platz = gefunden || { x: ziel.x, z: ziel.z };
    return ziel.platz;
  }

  zielVon(id) {
    return this.ziele.find((d) => d.id === id);
  }

  // ---------- Den Ballon an seinen Platz stellen (angebunden) ----------
  platzieren() {
    if (this.hindernis) this.hindernisse.entfernen(this.hindernis), (this.hindernis = null);
    const sichtbar = this.gekauft;
    this.gruppe.visible = this.pflock.visible = this.halteSeil.visible = sichtbar;
    if (!sichtbar) return;
    const ziel = this.zielVon(this.ort) || this.zielVon('base');
    const p = this.landeplatz(ziel);
    this.stand = { x: p.x, z: p.z, y: bodenHoehe(p.x, p.z) };
    this.gruppe.position.set(p.x, this.stand.y, p.z);
    this.gruppe.rotation.set(0, 0.3, 0);
    // Der Pflock steht ein Stück daneben
    const w = 2.3;
    this.pflock.position.set(p.x + Math.cos(w) * 1.9, bodenHoehe(p.x + Math.cos(w) * 1.9, p.z + Math.sin(w) * 1.9) - 0.05, p.z + Math.sin(w) * 1.9);
    this.interaktion.pos.set(p.x, 0, p.z);
    this.hindernis = this.hindernisse.hinzufuegen(p.x, p.z, 1.0);
  }

  // ---------- Beim Händler kaufen ----------
  anmeldenBeimHaendler() {
    const h = this.spiel.haendler;
    if (!h) return;
    h.sonderKauf = h.sonderKauf || {};
    h.sonderKauf.ballon = {
      gekauft: () => this.gekauft, // schon gekauft? → nicht mehr im Angebot
      kaufen: () => {
        this.gekauft = true;
        this.ort = 'base';
        this.platzieren();
        this.spiel.meldung?.('🎈 Dein Heißluftballon wartet an der Base auf dich!', 6);
        this.beiGekauft?.();
        return '„Ein Heißluftballon! Ich lasse ihn zu deiner Base fliegen. Gute Reise!“';
      },
    };
  }

  // ---------- Antippen: einmal = Auswahl, zweimal schnell = sofort los ----------
  getippt() {
    const { boote, pferde, spieler } = this.spiel;
    if (boote?.faehrt || pferde?.reitet || spieler.fliegt) {
      this.spiel.meldung?.('Steig erst ab, dann kannst du in den Ballon!', 4);
      return;
    }
    const jetzt = performance.now() / 1000;
    if (this.tippTimer && jetzt - this.tippZeit < E().doppelTippSekunden) {
      // Doppeltipp!
      clearTimeout(this.tippTimer);
      this.tippTimer = null;
      this.losfliegen(this.schnellZiel());
      return;
    }
    this.tippZeit = jetzt;
    clearTimeout(this.tippTimer);
    // Kurz warten – kommt noch ein zweiter Tipp? Sonst das Fenster öffnen.
    this.tippTimer = setTimeout(() => {
      this.tippTimer = null;
      this.oeffnen();
    }, E().doppelTippSekunden * 1000);
  }

  // Wohin geht es beim Doppeltipp? An der Base: ins Dorf. Sonst: nach Hause.
  schnellZiel() {
    if (this.ort !== 'base') return 'base';
    const d = this.zielVon(this.letztesDorf);
    return d && d.freigeschaltet ? d.id : 'dorf';
  }

  // ---------- Das Ziel-Fenster ----------
  baueFenster() {
    if (!document.querySelector('link[href$="ballon.css"]')) {
      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = new URL('../css/ballon.css', import.meta.url).href;
      document.head.appendChild(css);
    }
    this.fenster = document.createElement('div');
    this.fenster.id = 'ballon-fenster';
    this.fenster.className = 'spiel-fenster';
    this.fenster.innerHTML = `
      <div class="fenster-kopf"><h2>🎈 Wohin fliegen wir?</h2><button class="zu" aria-label="Schließen">✕</button></div>
      <div class="ballon-ziele"></div>
      <p class="ballon-tipp">Tipp: Zweimal schnell auf 🎈 tippen = sofort los!</p>`;
    (this.spiel.elternElement || document.body).appendChild(this.fenster);
    this.fenster.addEventListener('touchstart', (e) => e.stopPropagation());
    knopf(this.fenster.querySelector('.zu'), () => this.schliessen());
  }

  get offen() {
    return this.fenster.classList.contains('offen');
  }

  oeffnen() {
    if (this.faehrt) return;
    const liste = this.fenster.querySelector('.ballon-ziele');
    liste.innerHTML = '';
    for (const z of this.ziele) {
      if (!z.freigeschaltet || z.id === this.ort) continue;
      const k = document.createElement('button');
      k.className = 'ballon-ziel';
      k.innerHTML = `<span class="ballon-ziel-bild">${z.bild}</span><span>${z.name}</span>`;
      knopf(k, () => {
        this.schliessen();
        this.losfliegen(z.id);
      });
      liste.appendChild(k);
    }
    this.fenster.classList.add('offen');
  }

  schliessen() {
    this.fenster.classList.remove('offen');
  }

  // ---------- Der Flug ----------
  losfliegen(zielId) {
    const ziel = this.zielVon(zielId);
    if (!ziel || !ziel.freigeschaltet || zielId === this.ort || this.faehrt) return;
    const { spieler } = this.spiel;
    const e = E();
    const von = { ...this.stand };
    const p = this.landeplatz(ziel);
    const nach = { x: p.x, z: p.z, y: bodenHoehe(p.x, p.z) };
    // Wie hoch müssen wir? Über den höchsten Berg auf dem Weg + Flughöhe
    const weg = Math.hypot(nach.x - von.x, nach.z - von.z);
    let hoechster = Math.max(von.y, nach.y, WASSER_HOEHE);
    for (let i = 0; i <= 40; i++) {
      const t = i / 40;
      hoechster = Math.max(hoechster, bodenHoehe(THREE.MathUtils.lerp(von.x, nach.x, t), THREE.MathUtils.lerp(von.z, nach.z, t)));
    }
    const gleiten = THREE.MathUtils.clamp(weg / e.tempo, e.minGleitSekunden, e.maxGleitSekunden);
    this.reise = {
      ziel, von, nach,
      hoehe: hoechster + e.flugHoehe,
      t: 0,
      einsteigen: 0.8,
      steigen: e.steigSekunden,
      gleiten,
      sinken: e.sinkSekunden,
      aussteigen: 0.8,
      startFigur: spieler.figur.position.clone(),
      richtung: Math.atan2(nach.x - von.x, nach.z - von.z),
    };
    this.faehrt = true;
    this.pflock.visible = this.halteSeil.visible = false; // Leine los!
    if (this.hindernis) this.hindernisse.entfernen(this.hindernis), (this.hindernis = null);
    spieler.geschwindigkeitY = 0;
    this.spiel.meldung?.(`🎈 Los geht's zum ${ziel.name}!`, 4);
    this.fauchen(1.2);
  }

  // Wo ist der Ballon zur Zeit t der Reise? (Korb-Boden)
  reisePunkt(r, t, ziel = V()) {
    const anfang = r.einsteigen;
    const flug = r.steigen + r.gleiten + r.sinken;
    const f = t - anfang; // Sekunden seit dem Abheben
    // Waagerecht: erst ab der Hälfte vom Steigen, bis zur Hälfte vom Sinken
    const wStart = r.steigen * 0.5, wEnde = flug - r.sinken * 0.45;
    const w = glatt((f - wStart) / (wEnde - wStart));
    ziel.x = THREE.MathUtils.lerp(r.von.x, r.nach.x, w);
    ziel.z = THREE.MathUtils.lerp(r.von.z, r.nach.z, w);
    // Senkrecht: hoch – oben bleiben – runter
    if (f < r.steigen) ziel.y = THREE.MathUtils.lerp(r.von.y, r.hoehe, glatt(f / r.steigen));
    else if (f > flug - r.sinken) ziel.y = THREE.MathUtils.lerp(r.hoehe, r.nach.y, glatt((f - (flug - r.sinken)) / r.sinken));
    else ziel.y = r.hoehe;
    if (f <= 0) ziel.y = r.von.y;
    if (f >= flug) ziel.y = r.nach.y;
    return ziel;
  }

  // ---------- Jedes Bild ----------
  aktualisiere(dt) {
    this.zeit += dt;
    const zoomZiel = this.faehrt && this.reise && this.reise.t > this.reise.einsteigen ? 1 : 0;
    this.kameraZoom += (zoomZiel - this.kameraZoom) * Math.min(1, dt * 0.8);

    // Flamme flackert
    this.flammeAn = Math.max(0, this.flammeAn - dt);
    this.flamme.visible = this.flammeAn > 0;
    if (this.flamme.visible) {
      const s = 0.8 + Math.sin(this.zeit * 40) * 0.12 + Math.sin(this.zeit * 23) * 0.1;
      this.flamme.scale.set(1, s * Math.min(1, this.flammeAn * 3), 1);
    }
    if (!this.gekauft) return;

    if (!this.faehrt) {
      // Angebunden: der Korb schwebt knapp über dem Boden und wippt sanft
      const g = this.gruppe;
      g.position.y = this.stand.y + 0.35 + Math.sin(this.zeit * 1.3) * 0.12;
      g.rotation.x = Math.sin(this.zeit * 0.9) * 0.025;
      g.rotation.z = Math.cos(this.zeit * 0.7) * 0.025;
      // Halteseil vom Korbrand zum Pflock
      const a = V(g.position.x + Math.cos(2.3) * 0.75, g.position.y + 0.55, g.position.z + Math.sin(2.3) * 0.75);
      const b = this.pflock.position.clone().add(V(0, 0.6, 0));
      const r = b.clone().sub(a);
      this.halteSeil.position.copy(a).lerp(b, 0.5);
      this.halteSeil.quaternion.setFromUnitVectors(V(0, 1, 0), r.clone().normalize());
      this.halteSeil.scale.set(1, r.length(), 1);
      return;
    }
    this.fahre(dt);
  }

  fahre(dt) {
    const r = this.reise;
    const { spieler } = this.spiel;
    r.t += dt;
    const g = this.gruppe;
    const flug = r.steigen + r.gleiten + r.sinken;
    const f = r.t - r.einsteigen;
    const punkt = this.reisePunkt(r, r.t);
    // Ein bisschen Schaukeln im Wind
    const wind = f > 0 && f < flug ? 1 : 0;
    g.position.set(punkt.x, punkt.y + 0.35 * (1 - wind) + Math.sin(this.zeit * 1.1) * 0.25 * wind, punkt.z);
    g.rotation.x = Math.sin(this.zeit * 0.8) * 0.04 * wind;
    g.rotation.z = Math.cos(this.zeit * 0.6) * 0.04 * wind;
    g.rotation.y += dt * 0.08 * wind; // dreht sich ganz langsam

    // Brenner fauchen: beim Steigen oft, beim Gleiten ab und zu, beim Sinken nicht
    this.naechsterFauch -= dt;
    if (this.naechsterFauch <= 0 && f > 0 && f < r.steigen + r.gleiten) {
      const steigt = f < r.steigen;
      this.fauchen(steigt ? 1.1 : 0.7);
      this.naechsterFauch = steigt ? 1.6 : 3.5;
    }

    // Die Figur
    const korb = V(g.position.x, g.position.y + 0.1, g.position.z);
    const fig = spieler.figur;
    if (r.t < r.einsteigen) {
      // Einsteigen: ein kleiner Hüpfer in den Korb
      const t = r.t / r.einsteigen;
      fig.position.lerpVectors(r.startFigur, korb, glatt(t));
      fig.position.y += Math.sin(t * Math.PI) * 1.2;
      fig.rotation.y = r.richtung;
      spieler.amBoden = false;
    } else if (f < flug) {
      fig.position.copy(korb);
      // Figur schaut in Flugrichtung
      let diff = r.richtung - fig.rotation.y;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      fig.rotation.y += diff * Math.min(1, dt * 3);
      spieler.amBoden = true;
    } else if (f < flug + r.aussteigen) {
      // Aussteigen: Hüpfer aus dem Korb neben den Ballon
      if (!r.raus) r.raus = this.aussteigePlatz(r.nach);
      const t = (f - flug) / r.aussteigen;
      const ziel = V(r.raus.x, bodenHoehe(r.raus.x, r.raus.z), r.raus.z);
      fig.position.lerpVectors(korb, ziel, glatt(t));
      fig.position.y += Math.sin(t * Math.PI) * 1.1;
      fig.rotation.y = Math.atan2(ziel.x - korb.x, ziel.z - korb.z);
      spieler.amBoden = false;
    } else {
      this.angekommen();
      return;
    }
    spieler.geschwindigkeitY = 0;
    spieler.animiere(dt, 0);
  }

  // Neben dem Korb einen freien Platz für die Figur suchen
  aussteigePlatz(p) {
    const s = this.spiel.spieler;
    const zurueck = Math.atan2(this.reise.von.z - p.z, this.reise.von.x - p.x) + Math.PI; // vorwärts weiter
    for (let r = 2.2; r < 8; r += 0.8) {
      for (let k = 0; k < 16; k++) {
        const w = zurueck + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * (Math.PI / 8);
        const x = p.x + Math.cos(w) * r, z = p.z + Math.sin(w) * r;
        if (s.kannStehen(x, z) && bodenHoehe(x, z) > WASSER_HOEHE) return { x, z };
      }
    }
    return { x: p.x + 2.2, z: p.z };
  }

  angekommen() {
    const r = this.reise;
    const { spieler } = this.spiel;
    this.reise = null;
    this.faehrt = false;
    this.ort = r.ziel.id;
    if (r.ziel.id !== 'base') this.letztesDorf = r.ziel.id;
    this.platzieren();
    const raus = r.raus || this.aussteigePlatz(r.nach);
    spieler.figur.position.set(raus.x, bodenHoehe(raus.x, raus.z), raus.z);
    spieler.amBoden = true;
    spieler.geschwindigkeitY = 0;
    this.spiel.meldung?.(`${r.ziel.bild} Gelandet: ${r.ziel.name}!`, 4);
    this.beiAnkunft?.(r.ziel);
  }

  // ---------- Geräusch: der Brenner faucht (gefiltertes Rauschen) ----------
  fauchen(sekunden = 1) {
    this.flammeAn = sekunden;
    const m = this.spiel.musik;
    const ctx = m && m.ctx;
    if (!ctx || !m.rauschen || !m.effekte) return;
    try {
      const jetzt = ctx.currentTime;
      const laut = E().brennerLautstaerke;
      const quelle = ctx.createBufferSource();
      quelle.buffer = m.rauschen;
      quelle.loop = true;
      // Zwei Filter: ein tiefes Brummen und ein helles Zischen
      const tief = ctx.createBiquadFilter();
      tief.type = 'lowpass';
      tief.frequency.value = 380;
      const hell = ctx.createBiquadFilter();
      hell.type = 'bandpass';
      hell.frequency.setValueAtTime(700, jetzt);
      hell.frequency.linearRampToValueAtTime(1300, jetzt + sekunden);
      hell.Q.value = 0.8;
      const lautTief = ctx.createGain();
      const lautHell = ctx.createGain();
      for (const [regler, max] of [[lautTief.gain, laut * 1.3], [lautHell.gain, laut * 0.45]]) {
        regler.setValueAtTime(0.0001, jetzt);
        regler.exponentialRampToValueAtTime(max, jetzt + 0.08); // Fffff …
        regler.setValueAtTime(max, jetzt + sekunden);
        regler.exponentialRampToValueAtTime(0.0001, jetzt + sekunden + 0.35); // … und aus
      }
      quelle.connect(tief).connect(lautTief).connect(m.effekte);
      quelle.connect(hell).connect(lautHell).connect(m.effekte);
      quelle.start(jetzt, Math.random() * 3);
      quelle.stop(jetzt + sekunden + 0.4);
    } catch {}
  }

  // ---------- Speichern ----------
  alsDaten() {
    return {
      gekauft: this.gekauft,
      // Während der Fahrt zählt schon das Ziel
      ort: this.faehrt && this.reise ? this.reise.ziel.id : this.ort,
      letztesDorf: this.letztesDorf,
      frei: this.ziele.filter((z) => z.freigeschaltet).map((z) => z.id),
    };
  }

  ladeDaten(d = {}) {
    this.gekauft = !!d.gekauft;
    this.ort = d.ort || 'base';
    this.letztesDorf = d.letztesDorf || 'dorf';
    for (const id of d.frei || []) this.ziel(id, { freigeschaltet: true });
    if (!this.zielVon(this.ort)) this.ort = 'base';
    this.platzieren();
  }
}
