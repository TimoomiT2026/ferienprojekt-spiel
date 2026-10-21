// =============================================================
//  BOOTE – kleine Ruderboote, versteckt am Ufer
//  Wer eins findet, kann einsteigen, aufs Meer rausfahren
//  oder die ganze Insel umrunden.
// =============================================================
import * as THREE from 'three';
import { EINSTELLUNGEN } from './einstellungen.js';
import { zufallMitSeed } from './rauschen.js';
import { bodenHoehe, WASSER_HOEHE, imErlaubtenMeer, istKlippenWand } from './gelaende.js';
import { wellenHoehe, wasserZeit } from './wasser.js';

// ---------- Zahlen zum Rumprobieren ----------
// Wie viele Boote liegen am Ufer?
const ANZAHL_BOOTE = 7;
// Wie schnell fährt ein Boot? (Meter pro Sekunde – die Figur läuft 7)
const BOOT_TEMPO = 9;
// Wie schnell dreht sich das Boot? (größer = wendiger)
const DREH_TEMPO = 2.2;
// Wie schnell kommt das Boot in Fahrt?
const BESCHLEUNIGUNG = 4;
// Wie schnell bremst das Boot, wenn man loslässt? (Wasser bremst sanft)
const BREMSEN = 3;
// Wie stark rutscht das Boot in Kurven seitlich weg? (kleiner = mehr Driften)
const DRIFT_BREMSE = 1.6;
// Wie weit darf man aufs Meer raus? Bis 160 m vor jede Insel (steht in gelaende.js: imErlaubtenMeer)
// Wie viel Wasser braucht das Boot unter dem Bug mindestens? (Meter)
// Klein = man kann bis ganz nah an den Strand fahren.
const BUG_MIN_TIEFE = 0.05;
// Wie stark schaukelt das Boot mit den Wellen? (1 = genau wie die Wellen)
const SCHAUKELN = 1;
// Ab wie viel Metern Nähe gilt ein Boot als "entdeckt"? (für die Karte)
const ENTDECKT_ABSTAND = 30;
// Eigener Zufall nur für die Boote: immer dieselben Plätze
const zufall = zufallMitSeed(2024);

// Ist hier genug Wasser für ein Boot? (tiefe = wie tief es mindestens sein muss)
function istWasser(x, z, tiefe = 0.35) {
  return bodenHoehe(x, z) < WASSER_HOEHE - tiefe && imErlaubtenMeer(x, z);
}

// ---------- Holz-Bild malen (statt einer Bilddatei) ----------
function baueHolzTextur() {
  const leinwand = document.createElement('canvas');
  leinwand.width = 256;
  leinwand.height = 256;
  const g = leinwand.getContext('2d');
  const z = zufallMitSeed(77);
  const planken = 8;
  const hoehe = 256 / planken;
  for (let i = 0; i < planken; i++) {
    // Jede Planke ist ein bisschen heller oder dunkler
    const hell = 0.85 + z() * 0.3;
    g.fillStyle = `rgb(${200 * hell}, ${140 * hell}, ${85 * hell})`;
    g.fillRect(0, i * hoehe, 256, hoehe);
    // Maserung: feine, wellige Linien
    g.strokeStyle = 'rgba(90, 50, 20, 0.25)';
    g.lineWidth = 1;
    for (let k = 0; k < 5; k++) {
      const y0 = i * hoehe + 3 + z() * (hoehe - 6);
      const welle = 1 + z() * 2;
      g.beginPath();
      for (let x = 0; x <= 256; x += 8) {
        const y = y0 + Math.sin(x * 0.05 + k) * welle;
        x === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
      }
      g.stroke();
    }
    // Dunkle Fuge zwischen zwei Planken
    g.fillStyle = 'rgba(60, 32, 14, 0.8)';
    g.fillRect(0, i * hoehe, 256, 2);
  }
  const textur = new THREE.CanvasTexture(leinwand);
  textur.colorSpace = THREE.SRGBColorSpace;
  textur.wrapS = textur.wrapT = THREE.RepeatWrapping;
  textur.repeat.set(1, 2);
  return textur;
}

// ---------- Die Form des Bootes ----------
// Halb so breit wie lang, vorne etwas spitzer und höher.
const BREITE = 0.95; // halbe Breite in Metern
const LAENGE = 2.1; // halbe Länge in Metern
const TIEFE = 0.7; // so tief ist der Rumpf
const BORD = 0.45; // so hoch schaut der Rand aus dem Wasser

// Wie breit ist das Boot an der Stelle z (von -1 hinten bis +1 vorne)?
function breiteBei(zn) {
  const vorn = Math.max(0, zn);
  return Math.sqrt(Math.max(0, 1 - zn * zn)) * (1 - 0.35 * vorn * vorn);
}
// Vorne ist der Rand ein bisschen hochgezogen
function randHub(zn) {
  const vorn = Math.max(0, zn);
  return 0.3 * vorn ** 4;
}

function baueRumpfGeo() {
  // Untere Hälfte einer Kugel – das wird der runde Rumpf
  const geo = new THREE.SphereGeometry(1, 40, 14, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const vorn = Math.max(0, z);
    x *= 1 - 0.35 * vorn * vorn; // vorne schmaler
    y += randHub(z); // vorne höher
    p.setXYZ(i, x * BREITE, y * TIEFE, z * LAENGE);
  }
  geo.computeVertexNormals();
  return geo;
}

// Ein Ruder: Stange + flaches, rundes Ruderblatt. seite = +1 rechts, -1 links
function baueRuder(seite, holz) {
  const ruder = new THREE.Group();
  const stange = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.7, 8), holz);
  stange.rotation.z = Math.PI / 2;
  stange.position.x = seite * 0.7;
  const blatt = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), holz);
  blatt.scale.set(0.45, 0.17, 0.035);
  blatt.position.x = seite * 2.0;
  const griff = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), holz);
  griff.position.x = seite * -0.63;
  ruder.add(stange, blatt, griff);
  return ruder;
}

function baueBoot(holzTextur) {
  const boot = new THREE.Group();
  boot.rotation.order = 'YXZ'; // erst drehen, dann schaukeln
  const planken = new THREE.MeshStandardMaterial({ color: '#c98a52', map: holzTextur, roughness: 0.8, side: THREE.DoubleSide });
  const dunkel = new THREE.MeshStandardMaterial({ color: '#7a4a26', roughness: 0.75 });
  const hell = new THREE.MeshStandardMaterial({ color: '#d9a066', roughness: 0.8 });

  // Der Rumpf
  const rumpf = new THREE.Mesh(baueRumpfGeo(), planken);
  rumpf.position.y = BORD;
  boot.add(rumpf);

  // Der Rand oben herum: ein runder Holzwulst
  const randPunkte = [];
  for (let i = 0; i < 48; i++) {
    const w = (i / 48) * Math.PI * 2;
    const zn = Math.sin(w);
    const vorn = Math.max(0, zn);
    randPunkte.push(new THREE.Vector3(Math.cos(w) * BREITE * (1 - 0.35 * vorn * vorn), BORD + randHub(zn) * TIEFE, zn * LAENGE));
  }
  const rand = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(randPunkte, true), 96, 0.07, 8, true),
    dunkel
  );
  boot.add(rand);

  // Ein Holzboden innen, damit man das Wasser nicht im Boot sieht
  const bodenY = 0.2;
  const rund = Math.sqrt(1 - ((bodenY - BORD) / TIEFE) ** 2) * 0.97; // so breit ist der Rumpf in dieser Höhe
  const umriss = new THREE.Shape();
  for (let i = 0; i <= 40; i++) {
    const w = (i / 40) * Math.PI * 2;
    const vorn = Math.max(0, Math.sin(w));
    const x = Math.cos(w) * BREITE * rund * (1 - 0.35 * vorn * vorn);
    const z = Math.sin(w) * LAENGE * rund;
    i === 0 ? umriss.moveTo(x, -z) : umriss.lineTo(x, -z);
  }
  const bodenGeo = new THREE.ShapeGeometry(umriss);
  bodenGeo.rotateX(-Math.PI / 2); // flach hinlegen
  const bodenBrett = new THREE.Mesh(bodenGeo, planken);
  bodenBrett.position.y = bodenY;
  boot.add(bodenBrett);

  // Spanten: gebogene Rippen innen im Boot
  for (const zn of [-0.5, 0, 0.5]) {
    const b = breiteBei(zn) * BREITE * 0.96;
    const t = Math.sqrt(1 - zn * zn) * TIEFE * 0.96;
    const spant = new THREE.Mesh(new THREE.TorusGeometry(1, 0.035, 6, 20, Math.PI), dunkel);
    spant.rotation.z = Math.PI; // Bogen nach unten
    spant.scale.set(b, t, 1);
    spant.position.set(0, BORD + randHub(zn) * TIEFE, zn * LAENGE);
    boot.add(spant);
  }

  // Sitzbänke: flach gedrückte Kapseln (rund statt eckig!)
  const baenke = [[-0.2, 0.32], [-1.35, 0.36], [1.25, 0.38]];
  for (const [z, y] of baenke) {
    const zn = z / LAENGE;
    const lang = breiteBei(zn) * BREITE * 2 - 0.25;
    const geo = new THREE.CapsuleGeometry(0.1, Math.max(0.1, lang - 0.2), 4, 10);
    geo.rotateZ(Math.PI / 2);
    const bank = new THREE.Mesh(geo, hell);
    bank.scale.set(1, 0.45, 1.7);
    bank.position.set(0, y, z);
    boot.add(bank);
  }

  // Die zwei Ruder hängen an Drehpunkten am Rand
  const ruder = [];
  for (const seite of [1, -1]) {
    const halter = new THREE.Group();
    halter.rotation.order = 'YXZ';
    halter.position.set(seite * BREITE * 0.98, BORD + 0.06, 0.15);
    halter.add(baueRuder(seite, hell));
    boot.add(halter);
    ruder.push({ halter, seite });
  }

  // Ein kleiner Ring vorne, da hängt das Seil dran
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.025, 6, 12), dunkel);
  ring.position.set(0, BORD + randHub(1) * TIEFE + 0.02, LAENGE * 0.97);
  boot.add(ring);

  boot.traverse((t) => {
    if (t.isMesh) t.castShadow = t.receiveShadow = true;
  });
  return { boot, ruder };
}

// Holzpfosten am Ufer (mit runder Kappe)
function bauePfosten(holz) {
  const pfosten = new THREE.Group();
  const stamm = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 1.5, 12), holz);
  stamm.position.y = 0.45;
  const kappe = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 8), holz);
  kappe.position.y = 1.2;
  pfosten.add(stamm, kappe);
  pfosten.traverse((t) => {
    if (t.isMesh) t.castShadow = true;
  });
  return pfosten;
}

// ---------- Gute Bootsplätze suchen ----------
// Wir laufen von weit draußen auf dem Meer in Richtung Insel,
// bis das Wasser flach wird. Dort ist das Ufer.
function sucheUferstelle(winkel) {
  const R = EINSTELLUNGEN.inselGroesse;
  const cx = Math.cos(winkel), cz = Math.sin(winkel);
  let r = R + 120;
  while (r > 20 && bodenHoehe(cx * r, cz * r) < -1.5) r -= 0.5;
  // Weiter Richtung Land, bis Land kommt
  const kandidaten = [];
  let land = null;
  for (let s = r; s > r - 40; s -= 0.2) {
    const h = bodenHoehe(cx * s, cz * s);
    if (h > 0.5) {
      land = s;
      break;
    }
    if (h >= -1.5 && h <= -0.4) kandidaten.push(s);
  }
  if (land === null) return null;
  // Am liebsten 2–3 m vom Land entfernt (das Boot ist knapp 1 m breit)
  const gut = kandidaten.filter((s) => s - land >= 1.9 && s - land <= 2.9);
  if (gut.length === 0) return null;
  const s = gut[Math.floor(gut.length / 2)];
  return { x: cx * s, z: cz * s, landR: land, winkel };
}

// Wo ist das nächste Land? (sucht in Ringen um den Punkt herum)
function naechstesLand(x, z, maxAbstand, darfStehen = () => true, mindestHoehe = 0.5) {
  for (let r = 0.3; r <= maxAbstand + 0.001; r += 0.3) {
    let beste = null, besteH = -Infinity;
    for (let i = 0; i < 20; i++) {
      const w = (i / 20) * Math.PI * 2;
      const lx = x + Math.cos(w) * r, lz = z + Math.sin(w) * r;
      const h = bodenHoehe(lx, lz);
      if (h > mindestHoehe && h > besteH && darfStehen(lx, lz)) {
        beste = { x: lx, z: lz, h, abstand: r };
        besteH = h;
      }
    }
    if (beste) return beste;
  }
  return null;
}

function waehleBootsplaetze() {
  // Viele mögliche Stellen rund um die Insel
  const stellen = [];
  const anzahl = 140;
  for (let i = 0; i < anzahl; i++) {
    const w = ((i + zufall() * 0.8) / anzahl) * Math.PI * 2;
    const s = sucheUferstelle(w);
    if (!s) continue;
    // Prüfen: Land wirklich in ≤ 3 m, aber nicht zu nah (sonst steckt das Boot im Sand)
    const land = naechstesLand(s.x, s.z, 3);
    if (!land || land.abstand < 1.5) continue;
    s.land = land;
    stellen.push(s);
  }

  const gewaehlt = [];
  const passt = (s) =>
    Math.hypot(s.x, s.z) > 60 && gewaehlt.every((g) => Math.hypot(g.x - s.x, g.z - s.z) > 80);

  // Erst ein paar Boote in Buchten verstecken (da, wo die Küste weit innen liegt)
  const nachBucht = [...stellen].sort((a, b) => a.landR - b.landR);
  for (const s of nachBucht) {
    if (gewaehlt.length >= 3) break;
    if (passt(s)) gewaehlt.push(s);
  }
  // Der Rest irgendwo am Ufer
  const gemischt = [...stellen];
  for (let i = gemischt.length - 1; i > 0; i--) {
    const j = Math.floor(zufall() * (i + 1));
    [gemischt[i], gemischt[j]] = [gemischt[j], gemischt[i]];
  }
  for (const s of gemischt) {
    if (gewaehlt.length >= ANZAHL_BOOTE) break;
    if (passt(s)) gewaehlt.push(s);
  }
  return gewaehlt;
}


export class Boote {
  constructor(szene, spieler) {
    this.spieler = spieler;
    this.zeit = 0;
    this.aktuelles = null; // in diesem Boot sitzt die Figur gerade
    this.landStelle = null; // hier könnte man aussteigen
    this.landSuchZeit = 0;
    this.beiEntdeckt = null; // optional: wird aufgerufen, wenn man ein Boot zum ersten Mal sieht
    this.liste = [];

    const holzTextur = baueHolzTextur();
    const pfostenHolz = new THREE.MeshStandardMaterial({ color: '#6e4526', roughness: 0.9 });
    const seilMat = new THREE.MeshStandardMaterial({ color: '#d8c08a', roughness: 1 });

    for (const platz of waehleBootsplaetze()) {
      const { boot: gruppe, ruder } = baueBoot(holzTextur);
      // Das Boot liegt längs zum Ufer (die Seite zeigt zum Land)
      const zumLand = Math.atan2(platz.land.x - platz.x, platz.land.z - platz.z);
      const winkel = zumLand + (zufall() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
      gruppe.position.set(platz.x, WASSER_HOEHE, platz.z);
      gruppe.rotation.y = winkel;
      szene.add(gruppe);

      // Pfosten am Ufer und ein Seil zum Boot
      const pfosten = bauePfosten(pfostenHolz);
      pfosten.position.set(platz.land.x, platz.land.h - 0.3, platz.land.z);
      szene.add(pfosten);
      gruppe.updateMatrixWorld();
      const vorne = gruppe.localToWorld(new THREE.Vector3(0, BORD + 0.3 * TIEFE, LAENGE * 0.97));
      const oben = new THREE.Vector3(platz.land.x, platz.land.h + 0.75, platz.land.z);
      const mitte = vorne.clone().lerp(oben, 0.5);
      mitte.y = Math.min(vorne.y, oben.y) - 0.35; // das Seil hängt etwas durch
      const seil = new THREE.Mesh(
        new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(vorne, mitte, oben), 16, 0.03, 6, false),
        seilMat
      );
      seil.castShadow = true;
      szene.add(seil);

      const boot = {
        gruppe,
        ruder,
        seil,
        heimat: new THREE.Vector3(platz.x, 0, platz.z),
        winkel,
        tempo: new THREE.Vector2(0, 0), // x und z
        ruderPhase: 0,
        ruderEinsatz: 0, // 0 = Ruder eingezogen, 1 = rudern
        entdeckt: false,
        wackelVersatz: zufall() * 10,
        boden: { x: Infinity, z: Infinity, h: 0 }, // gemerkte Bodenhöhe unter dem Boot
      };
      this.liste.push(boot);
    }

    // ---------- Die Aktionen für den Aktions-Knopf ----------
    this._interaktionen = this.liste.map((boot) => ({
      pos: boot.gruppe.position, // wandert mit, wenn das Boot woanders liegt
      radius: 4.2, // etwas mehr als die 4 m beim Aussteigen – so kommt man immer wieder rein
      bild: '🚣',
      text: 'Einsteigen',
      aktiv: () => !this.faehrt,
      ausfuehren: () => this.einsteigen(boot),
    }));
    this.aussteigePos = new THREE.Vector3();
    this._interaktionen.push({
      pos: this.aussteigePos,
      radius: 1.5,
      bild: '🏝️',
      text: 'Aussteigen',
      aktiv: () => this.faehrt && this.landStelle !== null,
      ausfuehren: () => this.aussteigen(),
    });
  }

  get interaktionen() {
    return this._interaktionen;
  }

  get faehrt() {
    return this.aktuelles !== null;
  }

  get positionen() {
    return this.liste.map((b) => ({ x: b.gruppe.position.x, z: b.gruppe.position.z, entdeckt: b.entdeckt }));
  }

  // ---------- Einsteigen ----------
  einsteigen(boot) {
    if (this.faehrt) return;
    this.aktuelles = boot;
    boot.tempo.set(0, 0);
    boot.seil.visible = false; // Leinen los!
    const s = this.spieler;
    s.geschwindigkeitY = 0;
    s.laufZeit = 0;
    s.figur.rotation.order = 'YXZ';
    this.landStelle = null;
    this.landSuchZeit = 0;
    this.setzeFigur();
  }

  // ---------- Aussteigen ----------
  aussteigen() {
    const boot = this.aktuelles;
    if (!boot) return;
    const p = boot.gruppe.position;
    const land = this.landStelle || this.sucheLandstelle(p.x, p.z);
    if (!land) return;
    boot.tempo.set(0, 0);
    this.aktuelles = null;
    this.landStelle = null;
    const s = this.spieler;
    s.figur.rotation.order = 'XYZ';
    s.figur.rotation.set(0, Math.atan2(land.x - p.x, land.z - p.z), 0);
    s.figur.position.set(land.x, land.h, land.z);
    s.geschwindigkeitY = 0;
    s.amBoden = true;
    // Arme wieder normal hängen lassen
    s.armL.rotation.set(0, 0, 0);
    s.armR.rotation.set(0, 0, 0);
  }

  // Wo kann man aussteigen? Am liebsten auf richtiges Land (höher als 0.5 m),
  // sonst auf trockenen Strand (knapp über dem Wasser).
  sucheLandstelle(x, z) {
    // An einer Felswand kann man nicht aussteigen – nur am Strand
    const darf = (lx, lz) => this.spieler.kannStehen(lx, lz) && !istKlippenWand(lx, lz);
    return naechstesLand(x, z, 4, darf, 0.5) || naechstesLand(x, z, 4, darf, 0.05);
  }

  // ---------- Fahren (statt Laufen, solange man im Boot sitzt) ----------
  steuern(dt, richtung, kameraWinkel) {
    const boot = this.aktuelles;
    if (!boot) return;
    const pos = boot.gruppe.position;
    const laenge = Math.hypot(richtung.x, richtung.y);
    const staerke = Math.min(1, laenge);

    // Wohin will der Joystick? (gleich wie beim Laufen: "vor" = weg von der Kamera)
    let zielTempo = 0;
    if (staerke > 0.05) {
      const sin = Math.sin(kameraWinkel), cos = Math.cos(kameraWinkel);
      const dx = (richtung.x * cos - richtung.y * sin) / laenge;
      const dz = (-richtung.x * sin - richtung.y * cos) / laenge;
      let diff = Math.atan2(dx, dz) - boot.winkel;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      // Das Boot dreht sich langsam in die neue Richtung
      const dreh = THREE.MathUtils.clamp(diff * Math.min(1, dt * 4), -DREH_TEMPO * dt, DREH_TEMPO * dt);
      boot.winkel += dreh;
      // In engen Kurven fährt es langsamer
      zielTempo = BOOT_TEMPO * staerke * Math.max(0.3, Math.cos(diff));
    }

    // Tempo zerlegen: nach vorne und zur Seite (die Seite = Driften)
    const vx = Math.sin(boot.winkel), vz = Math.cos(boot.winkel);
    let vor = boot.tempo.x * vx + boot.tempo.y * vz;
    let seit = boot.tempo.x * vz - boot.tempo.y * vx;
    vor += THREE.MathUtils.clamp(zielTempo - vor, -BREMSEN * dt, BESCHLEUNIGUNG * dt);
    seit *= Math.exp(-DRIFT_BREMSE * dt);
    boot.tempo.set(vx * vor + vz * seit, vz * vor - vx * seit);

    // Bewegen – aber nur, wo Wasser ist. Sonst am Ufer entlanggleiten.
    const tx = boot.tempo.x * dt, tz = boot.tempo.y * dt;
    const schnell = boot.tempo.length();
    if (schnell > 0.01) {
      const ok = (x, z) => {
        // Unter der Mitte und vorne am Bug muss noch ein kleines bisschen Wasser sein.
        // So kann man bis ganz an den Strand fahren – auch durch flaches Wasser.
        const bx = x + (boot.tempo.x / schnell) * LAENGE * 0.9, bz = z + (boot.tempo.y / schnell) * LAENGE * 0.9;
        return istWasser(x, z, BUG_MIN_TIEFE) && istWasser(bx, bz, BUG_MIN_TIEFE);
      };
      if (ok(pos.x + tx, pos.z + tz)) {
        pos.x += tx;
        pos.z += tz;
      } else if (ok(pos.x + tx, pos.z)) {
        pos.x += tx;
        boot.tempo.y *= 0.5;
      } else if (ok(pos.x, pos.z + tz)) {
        pos.z += tz;
        boot.tempo.x *= 0.5;
      } else {
        boot.tempo.set(0, 0); // am Ufer angestoßen: stehen bleiben
      }
    }

    // Rudern: je schneller, desto schneller die Ruder
    if (staerke > 0.05 || Math.abs(vor) > 0.5) boot.ruderPhase += dt * (3 + 4 * Math.min(1, Math.abs(vor) / BOOT_TEMPO));

    // Ab und zu nachschauen, ob Land zum Aussteigen nah ist
    this.landSuchZeit -= dt;
    if (this.landSuchZeit <= 0) {
      this.landSuchZeit = 0.2;
      this.landStelle = this.sucheLandstelle(pos.x, pos.z);
    }
    this.aussteigePos.set(pos.x, 0, pos.z);
    this.setzeFigur();
  }

  // Die Figur sitzt auf der mittleren Bank und rudert
  setzeFigur() {
    const boot = this.aktuelles;
    if (!boot) return;
    const s = this.spieler;
    const g = boot.gruppe;
    g.updateMatrixWorld();
    s.figur.position.copy(g.localToWorld(new THREE.Vector3(0, -0.22, -0.25)));
    s.figur.rotation.set(g.rotation.x, g.rotation.y, g.rotation.z);
    // Arme greifen die Ruder und bewegen sich vor und zurück
    const w = Math.sin(boot.ruderPhase);
    s.armL.rotation.set(-1.15 - w * 0.35 * boot.ruderEinsatz, 0, -0.35);
    s.armR.rotation.set(-1.15 - w * 0.35 * boot.ruderEinsatz, 0, 0.35);
    s.fussL.position.z = s.fussR.position.z = 0.3;
    s.koerper.position.y = 1.05;
    // Der Junge sitzt auf der Bank: Oberschenkel nach vorn, Knie gebeugt
    const k = s.k;
    if (k) {
      k.beinL.rotation.set(-1.45, 0, -0.08);
      k.beinR.rotation.set(-1.45, 0, 0.08);
      k.knieL.rotation.x = k.knieR.rotation.x = 1.5;
      k.huefte.position.y = 0.42;
      k.huefte.rotation.set(0, 0, 0);
      if (k.ellbogenL) k.ellbogenL.rotation.x = k.ellbogenR.rotation.x = -0.6 + w * 0.3 * boot.ruderEinsatz;
    }
  }

  // ---------- Jedes Bild: Boote schaukeln auf den Wellen ----------
  // Wie liegt das Boot gerade auf den Wellen? Wir messen die Wasserhöhe
  // vorne, hinten, links, rechts und in der Mitte.
  schaukeln(boot, zeit) {
    const g = boot.gruppe;
    const x = g.position.x, z = g.position.z;
    const vx = Math.sin(boot.winkel), vz = Math.cos(boot.winkel); // nach vorne
    const lang = LAENGE * 0.8;
    const vorne = wellenHoehe(x + vx * lang, z + vz * lang, zeit);
    const hinten = wellenHoehe(x - vx * lang, z - vz * lang, zeit);
    const rechts = wellenHoehe(x + vz * BREITE, z - vx * BREITE, zeit);
    const links = wellenHoehe(x - vz * BREITE, z + vx * BREITE, zeit);
    const mitte = wellenHoehe(x, z, zeit);
    return {
      hoehe: ((vorne + hinten + rechts + links) / 4 + mitte) / 2 * SCHAUKELN,
      nicken: -Math.atan((vorne - hinten) / (2 * lang)) * SCHAUKELN, // Spitze hoch oder runter
      rollen: Math.atan((rechts - links) / (2 * BREITE)) * SCHAUKELN, // zur Seite kippen
    };
  }

  aktualisiere(dt) {
    this.zeit += dt;
    const zeit = wasserZeit();
    const spielerPos = this.spieler.figur.position;
    for (const boot of this.liste) {
      const g = boot.gruppe;
      const t = this.zeit + boot.wackelVersatz;
      const imBoot = boot === this.aktuelles;
      const tempo = imBoot ? boot.tempo.length() : 0;

      // Auf und ab mit den Wellen, dazu passend kippen (+ ein ganz kleines Wackeln)
      const lage = this.schaukeln(boot, zeit);
      let y = WASSER_HOEHE + lage.hoehe - (imBoot ? 0.06 : 0);
      // Im ganz flachen Wasser sitzt das Boot auf dem Sand auf (statt darin zu versinken)
      const b = boot.boden;
      if (Math.abs(b.x - g.position.x) + Math.abs(b.z - g.position.z) > 0.05) {
        b.x = g.position.x;
        b.z = g.position.z;
        b.h = bodenHoehe(b.x, b.z);
      }
      y = Math.max(y, b.h + 0.2);
      g.position.y = y;
      g.rotation.y = boot.winkel;
      g.rotation.x = lage.nicken + Math.sin(t * 1.1) * 0.012 - tempo * 0.006; // beim Fahren hebt sich die Spitze
      g.rotation.z = lage.rollen + Math.sin(t * 0.8 + 1) * 0.015;

      // Ruder: beim Fahren rudern, sonst eingezogen am Boot
      const ziel = imBoot ? 1 : 0;
      boot.ruderEinsatz += (ziel - boot.ruderEinsatz) * Math.min(1, dt * 3);
      const e = boot.ruderEinsatz;
      const w = Math.sin(boot.ruderPhase), c = Math.cos(boot.ruderPhase);
      for (const { halter, seite } of boot.ruder) {
        // eingezogen: Ruder liegt längs am Boot; rudern: schwingt vor und zurück
        const schwung = THREE.MathUtils.lerp(1.5, w * 0.5, e);
        const kipp = THREE.MathUtils.lerp(0.05, -0.32 - c * 0.12, e);
        halter.rotation.set(0, seite * schwung, seite * kipp);
      }

      // Das Seil gibt es nur, solange das Boot noch zu Hause liegt
      boot.seil.visible = !imBoot && Math.hypot(g.position.x - boot.heimat.x, g.position.z - boot.heimat.z) < 0.6;

      // Entdeckt? (für eine Karte)
      if (!boot.entdeckt && Math.hypot(g.position.x - spielerPos.x, g.position.z - spielerPos.z) < ENTDECKT_ABSTAND) {
        boot.entdeckt = true;
        if (this.beiEntdeckt) this.beiEntdeckt(boot);
      }
    }
    this.setzeFigur();
  }
}
