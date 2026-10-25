// =============================================================
//  ZAUBERPILZ-RALLYE 🍄🚣 – das Bootsrennen am Markttag
//  Erfunden vom Game Designer:
//  „Die Teilnahme kostet 10 Münzen. Zu gewinnen gibt es 50 Münzen.
//   Alle sind in einem Boot auf dem Wasser. Eine feste Strecke ist
//   abgesteckt. Wer zu schnell in eine Kurve rast, schwimmt aus der
//   Bahn und wird langsamer. Nur in der Strecke hat man volles Tempo.
//   Die anderen sind KI-gesteuert – nicht schlecht, aber auch nicht
//   unrealistisch gut.“  Und: Zauberpilze auf der Strecke = Turbo!
//
//  So funktioniert es:
//  - Am Strand vor dem Palmendorf steht der Rallye-Stand mit Steg.
//  - Am Markttag (tagsüber) kann man dort mitmachen.
//  - Die Strecke ist eine "Mittellinie" (eine weiche Kurve durch
//    feste Punkte) und eine Breite. Links und rechts schwimmen Bojen.
//  - Jedes Boot hat nur so viel "Griff" im Wasser. Wer zu schnell
//    lenkt, rutscht nach außen – genau wie ein Auto auf Eis.
//  - Die Gewinn-Regel (vom Programmier-Team ausgedacht): Mitmachen
//    kann man so oft man will (jedes Mal 10 Münzen). Die 50 Münzen
//    gibt es aber nur EINMAL pro Markttag – sonst könnte man ja
//    unendlich Geld verdienen.
// =============================================================
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { EINSTELLUNGEN } from './einstellungen.js';
import { bodenHoehe, imErlaubtenMeer, WASSER_HOEHE } from './gelaende.js';
import { wellenHoehe, wasserZeit } from './wasser.js';
import { baueFigur } from './figur.js';
import { Bausatz } from './dorf.js';
import { textur } from './texturen.js';
import { istMarkttag, naechsterMarkttag } from './markttag.js';
import { BILDER } from './bilder.js';
import { knopf } from './steuerung.js';

// Alle Zahlen zum Drehen stehen in einstellungen.js im Block "rallye"
const E = () => EINSTELLUNGEN.rallye;

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const Q = (x = 0, y = 0, z = 0) => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z));
const M = (pos, rot = Q(), skala = V(1, 1, 1)) => new THREE.Matrix4().compose(pos, rot, skala);
// Einen Winkel auf -PI … +PI bringen (damit "ein bisschen links" nicht "fast ganz rum" ist)
const winkelRund = (w) => Math.atan2(Math.sin(w), Math.cos(w));
const klemme = THREE.MathUtils.clamp;

// =============================================================
//  DIE STRECKE: eine Mittellinie mit einem Punkt pro Meter
// =============================================================
class Strecke {
  constructor(punkte) {
    // Catmull-Rom: eine weiche Kurve, die genau durch alle Punkte geht
    const kurve = new THREE.CatmullRomCurve3(punkte.map(([x, z]) => V(x, 0, z)), true, 'centripetal');
    this.laenge = kurve.getLength();
    const n = Math.round(this.laenge); // ungefähr 1 Punkt pro Meter
    this.n = n;
    this.schritt = this.laenge / n;
    this.x = new Float32Array(n);
    this.z = new Float32Array(n);
    this.tx = new Float32Array(n); // Richtung der Strecke (nach vorne)
    this.tz = new Float32Array(n);
    this.k = new Float32Array(n); // Krümmung: wie stark biegt die Strecke hier ab? (+ = links)
    this.kurve = new Int16Array(n).fill(-1); // Nummer der Kurve, in der dieser Punkt liegt (-1 = gerade)
    const p = V(), t = V();
    for (let i = 0; i < n; i++) {
      kurve.getPointAt(i / n, p);
      kurve.getTangentAt(i / n, t);
      const l = Math.hypot(t.x, t.z) || 1;
      this.x[i] = p.x;
      this.z[i] = p.z;
      this.tx[i] = t.x / l;
      this.tz[i] = t.z / l;
    }
    // Krümmung = wie schnell sich die Richtung pro Meter dreht
    const roh = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      roh[i] = winkelRund(Math.atan2(this.tx[j], this.tz[j]) - Math.atan2(this.tx[i], this.tz[i])) / this.schritt;
    }
    // etwas glätten (über 9 Meter), sonst zappelt sie
    this.kMax = new Float32Array(n); // die stärkste Krümmung in der Nähe (damit plant die KI ihr Tempo)
    for (let i = 0; i < n; i++) {
      let summe = 0, gross = 0;
      for (let d = -4; d <= 4; d++) {
        summe += roh[this.idx(i + d)];
        gross = Math.max(gross, Math.abs(roh[this.idx(i + d)]));
      }
      this.k[i] = summe / 9;
      this.kMax[i] = gross;
    }
    // Kurven finden: Stücke, in denen die Strecke stärker biegt (für die Fehler der KI)
    const grenze = 1 / (E().kurveAbRadius ?? 45);
    let nr = -1, inKurve = false;
    for (let i = 0; i < n; i++) {
      const jetzt = Math.abs(this.k[i]) > grenze;
      if (jetzt && !inKurve) nr++;
      inKurve = jetzt;
      if (jetzt) this.kurve[i] = nr;
    }
    this.anzahlKurven = nr + 1;
    // Mitte der Strecke (zum Ausblenden, wenn man weit weg ist)
    let mx = 0, mz = 0;
    for (let i = 0; i < n; i++) { mx += this.x[i]; mz += this.z[i]; }
    this.mitte = V(mx / n, 0, mz / n);
    let r = 0;
    for (let i = 0; i < n; i++) r = Math.max(r, Math.hypot(this.x[i] - this.mitte.x, this.z[i] - this.mitte.z));
    this.radius = r;
  }

  // Nummer im Kreis halten (nach dem letzten Punkt kommt wieder der erste)
  idx(i) {
    const n = this.n;
    return ((Math.round(i) % n) + n) % n;
  }

  // Welcher Streckenpunkt ist am nächsten? Wir suchen nur in der Nähe vom alten Punkt,
  // sonst springt man in der Haarnadel auf die andere Seite.
  naechster(x, z, start, fenster = 12) {
    let beste = start, bd = Infinity;
    for (let d = -fenster; d <= fenster; d++) {
      const i = this.idx(start + d);
      const a = (x - this.x[i]) ** 2 + (z - this.z[i]) ** 2;
      if (a < bd) { bd = a; beste = i; }
    }
    return beste;
  }

  // Wie weit liegt (x, z) rechts (+) oder links (−) von der Mittellinie?
  seite(i, x, z) {
    return (x - this.x[i]) * -this.tz[i] + (z - this.z[i]) * this.tx[i];
  }

  // Ein Punkt auf der Strecke: Nummer i, so weit rechts (+) / links (−)
  punkt(i, seite, ziel) {
    const k = this.idx(i);
    ziel.x = this.x[k] - this.tz[k] * seite;
    ziel.z = this.z[k] + this.tx[k] * seite;
    return ziel;
  }

  // Wie viele Meter liegt Punkt b vor Punkt a? (negativ = dahinter)
  vorne(a, b) {
    let d = b - a;
    if (d > this.n / 2) d -= this.n;
    if (d < -this.n / 2) d += this.n;
    return d * this.schritt;
  }
}

// =============================================================
//  DAS RENNBOOT – ein buntes Ruderboot mit Fahne
//  (fast wie die Boote am Ufer, aber angemalt und zu EINEM Modell
//   zusammengeklebt, damit es nur wenige Malbefehle braucht)
// =============================================================
const BREITE = 0.95, LAENGE = 2.1, TIEFE = 0.7, BORD = 0.45; // wie bei den Ruderbooten

// Ein Teil einfärben und an seinen Platz schieben
function teil(geo, farbe, matrix = new THREE.Matrix4()) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
  const c = new THREE.Color(farbe);
  const f = new Float32Array(g.attributes.position.count * 3);
  for (let i = 0; i < f.length; i += 3) c.toArray(f, i);
  g.setAttribute('color', new THREE.BufferAttribute(f, 3));
  g.applyMatrix4(matrix);
  return g;
}

function baueRumpf(farbe) {
  // Untere Hälfte einer Kugel – vorne schmaler und höher (wie bei boote.js)
  const geo = new THREE.SphereGeometry(1, 32, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2).toNonIndexed();
  const p = geo.attributes.position;
  const f = new Float32Array(p.count * 3);
  const bunt = new THREE.Color(farbe), weiss = new THREE.Color('#fff6e6');
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const vorn = Math.max(0, z);
    // Oben ein weißer Streifen, darunter die Bootsfarbe
    (y > -0.22 ? weiss : bunt).toArray(f, i * 3);
    x *= 1 - 0.35 * vorn * vorn;
    y += 0.3 * vorn ** 4;
    p.setXYZ(i, x * BREITE, y * TIEFE + BORD, z * LAENGE);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(f, 3));
  geo.deleteAttribute('uv');
  geo.computeVertexNormals();
  return geo;
}

function baueRennboot(farbe, fahnenFarbe, material) {
  const gruppe = new THREE.Group();
  gruppe.rotation.order = 'YXZ';
  const holz = '#d9a066', dunkel = '#7a4a26';
  const teile = [baueRumpf(farbe)];
  // Der Rand oben herum (ein runder Wulst)
  const rand = new THREE.TorusGeometry(1, 0.075, 6, 40).rotateX(Math.PI / 2);
  teile.push(teil(rand, dunkel, M(V(0, BORD, 0), Q(), V(BREITE * 0.97, 1, LAENGE * 0.93))));
  // Holzboden innen und eine runde Sitzbank
  teile.push(teil(new THREE.CircleGeometry(1, 24).rotateX(-Math.PI / 2), holz, M(V(0, 0.2, -0.1), Q(), V(BREITE * 0.8, 1, LAENGE * 0.78))));
  teile.push(teil(new THREE.CapsuleGeometry(0.1, 1.3, 4, 10).rotateZ(Math.PI / 2), holz, M(V(0, 0.32, -0.2), Q(), V(1, 0.45, 1.7))));
  // Fahnenmast hinten mit runder Kugel oben
  teile.push(teil(new THREE.CylinderGeometry(0.035, 0.045, 1.9, 8), dunkel, M(V(0, 1.15, -1.55))));
  teile.push(teil(new THREE.SphereGeometry(0.08, 10, 8), '#ffd23a', M(V(0, 2.12, -1.55))));
  const boot = new THREE.Mesh(mergeGeometries(teile), material);
  boot.castShadow = true;
  gruppe.add(boot);

  // Die Fahne: ein Dreieck, das im Wind flattert
  const form = new THREE.Shape();
  form.moveTo(0, 0);
  form.quadraticCurveTo(0.45, 0.12, 0.9, -0.22);
  form.quadraticCurveTo(0.45, -0.38, 0, -0.55);
  form.lineTo(0, 0);
  const fahne = new THREE.Mesh(teil(new THREE.ShapeGeometry(form, 6), fahnenFarbe), material);
  fahne.material = material.userData.doppelt;
  fahne.position.set(0, 2.0, -1.55);
  fahne.rotation.y = Math.PI / 2; // zeigt nach hinten
  gruppe.add(fahne);

  // Zwei Ruder an Drehpunkten (wie bei boote.js)
  const ruderGeo = (s) => mergeGeometries([
    teil(new THREE.CylinderGeometry(0.04, 0.04, 2.7, 8).rotateZ(Math.PI / 2), holz, M(V(s * 0.7, 0, 0))),
    teil(new THREE.SphereGeometry(1, 14, 8), holz, M(V(s * 2.0, 0, 0), Q(), V(0.45, 0.17, 0.035))),
    teil(new THREE.SphereGeometry(0.07, 8, 6), holz, M(V(s * -0.63, 0, 0))),
  ]);
  const ruder = [];
  for (const s of [1, -1]) {
    const halter = new THREE.Group();
    halter.rotation.order = 'YXZ';
    halter.position.set(s * BREITE * 0.98, BORD + 0.06, 0.15);
    halter.add(new THREE.Mesh(ruderGeo(s), material));
    gruppe.add(halter);
    ruder.push({ halter, seite: s });
  }
  return { gruppe, ruder, fahne };
}

// =============================================================
//  ZAUBERPILZ-FORM (groß, leuchtend, schwebt über dem Wasser)
// =============================================================
function pilzHutBild() {
  // Ein kleines Bild für den Hut: weiße Punkte auf Weiß-Rosa (die Farbe kommt von der Kopie)
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 128, 64);
  g.fillStyle = '#fff6d0';
  for (const [x, y, r] of [[10, 14, 6], [42, 22, 7], [76, 12, 5], [104, 26, 7], [26, 40, 5], [60, 44, 6], [92, 46, 5], [120, 8, 4]]) {
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

// =============================================================
//  DIE RALLYE
// =============================================================
export class Rallye {
  // spiel = { rucksack, meldung, musik, spieler, kamera, tageszeit, elternElement, boote, ereignisse, pferde }
  constructor(szene, hindernisse, spiel) {
    this.spiel = spiel;
    this.szene = szene;
    this.phase = 'aus'; // 'aus' | 'countdown' | 'rennen' | 'ziel'
    this.zeit = 0; // für Animationen
    this.rennZeit = 0; // Stoppuhr des Rennens
    this.countdown = 0;
    this.gewinnTag = 0; // an diesem Tag gab es zuletzt die 50 Münzen
    this.bestzeit = null; // schnellste eigene Zeit (Sekunden)
    this.siege = 0;
    this.teilnahmen = 0;
    this.letztesErgebnis = null; // für die Inselzeitung
    this.interaktionen = [];
    this.schildTag = -1;
    this.tmp = V();

    const e = E();
    this.strecke = new Strecke(e.punkte);
    this.gruppe = new THREE.Group(); // alles, was immer da ist (Bojen, Tor, Stand)
    szene.add(this.gruppe);

    this.baueBojen();
    this.baueTor();
    this.baueStand(hindernisse);
    this.bauePilze();
    this.baueBoote();
    this.baueAnzeigen();

    // ---------- Der Knopf am Stand ----------
    const self = this;
    this.interaktionen.push({
      pos: this.standPos,
      radius: e.standRadius ?? 4,
      get bild() { return BILDER.zauberpilz || '🍄'; },
      get text() { return self.darfHeute() ? `Mitmachen (${self.preis()})` : 'Rallye'; },
      aktiv: () => this.phase === 'aus' && !spiel.boote?.faehrt && !spiel.pferde?.reitet && !spiel.spieler?.fliegt,
      ausfuehren: () => this.mitmachen(),
    });
  }

  get laeuft() {
    return this.phase !== 'aus';
  }

  // Kann man jetzt fahren? Jeden Tag – nur nicht nachts
  darfHeute() {
    return !this.spiel.tageszeit.istNacht();
  }

  // Was kostet das Mitmachen heute? Am Markttag billig, sonst teurer
  preis() {
    const e = E();
    return istMarkttag(this.spiel.tageszeit.tag) ? e.teilnahme : (e.teilnahmeSonst ?? e.teilnahme);
  }

  // Beim Rennen ist die Kamera etwas weiter weg (man sieht die Kurve besser)
  get kameraAbstandFaktor() {
    return this.laeuft ? E().kameraFaktor ?? 1.3 : 1;
  }

  // =============================================================
  //  BAUEN
  // =============================================================
  baueBojen() {
    const e = E(), S = this.strecke;
    const abstand = e.bojenAbstand ?? 9;
    const anzahl = Math.floor(S.laenge / abstand);
    this.bojen = [];
    for (let k = 0; k < anzahl; k++) {
      const i = (k * S.n) / anzahl;
      for (const s of [-1, 1]) {
        const p = S.punkt(i, s * (e.breite / 2 + 0.6), V());
        this.bojen.push({ x: p.x, z: p.z, s, k });
      }
    }
    // Eine runde Boje mit Ring (aus zwei Formen zusammengeklebt)
    const geo = mergeGeometries([
      teil(new THREE.SphereGeometry(0.55, 14, 10), '#ffffff', M(V(0, 0.15, 0), Q(), V(1, 0.85, 1))),
      teil(new THREE.TorusGeometry(0.5, 0.09, 6, 16).rotateX(Math.PI / 2), '#ffffff', M(V(0, 0.12, 0))),
      teil(new THREE.SphereGeometry(0.14, 8, 6), '#ffffff', M(V(0, 0.68, 0))),
    ]);
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45 });
    this.bojenMesh = new THREE.InstancedMesh(geo, mat, this.bojen.length);
    const links = (e.bojenFarben?.links) || ['#ff4d4d', '#ffffff'];
    const rechts = (e.bojenFarben?.rechts) || ['#ffd23a', '#2f8fe0'];
    this.bojen.forEach((b, i) => {
      const farben = b.s < 0 ? links : rechts;
      this.bojenMesh.setColorAt(i, new THREE.Color(farben[b.k % farben.length]));
    });
    this.bojenMesh.frustumCulled = false;
    this.bojenMesh.castShadow = false;
    this.gruppe.add(this.bojenMesh);
    this.setzeBojen(0);
  }

  setzeBojen(zeit) {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = V(1, 1, 1), p = V();
    const e = new THREE.Euler();
    this.bojen.forEach((b, i) => {
      p.set(b.x, WASSER_HOEHE + wellenHoehe(b.x, b.z, zeit) - 0.1, b.z);
      e.set(Math.sin(zeit * 1.3 + i) * 0.12, 0, Math.cos(zeit * 1.1 + i * 0.7) * 0.12);
      m.compose(p, q.setFromEuler(e), s);
      this.bojenMesh.setMatrixAt(i, m);
    });
    this.bojenMesh.instanceMatrix.needsUpdate = true;
  }

  // Start- und Ziel-Tor: zwei bunte Pfosten, ein Band mit Karos und Fahnen obendrauf
  baueTor() {
    const e = E(), S = this.strecke;
    const halb = e.breite / 2 + 1.4;
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, side: THREE.DoubleSide });
    const bs = new Bausatz();
    const richtung = Math.atan2(S.tx[0], S.tz[0]);
    const hoehe = 5.2;
    const fahnen = ['#ff4d6d', '#ffb02e', '#4caf50', '#3d9bff'];
    const ecken = [];
    for (const s of [-1, 1]) {
      const p = S.punkt(0, s * halb, V());
      ecken.push(p);
      // Pfosten mit rot-weißen Ringen
      for (let k = 0; k < 6; k++) {
        bs.add(mat, new THREE.CylinderGeometry(0.22, 0.24, (hoehe + 2) / 6, 10), M(V(p.x, -2 + (k + 0.5) * ((hoehe + 2) / 6), p.z)), { farbe: k % 2 ? '#ffffff' : '#e5243b' });
      }
      bs.add(mat, new THREE.SphereGeometry(0.32, 12, 8), M(V(p.x, hoehe + 0.1, p.z)), { farbe: '#ffd23a' });
      // Schwimmring unten am Pfosten
      bs.add(mat, new THREE.TorusGeometry(0.7, 0.22, 8, 18).rotateX(Math.PI / 2), M(V(p.x, 0.05, p.z)), { farbe: '#ff8a2a' });
      // Fähnchen oben
      const f = new THREE.Shape();
      f.moveTo(0, 0); f.quadraticCurveTo(0.7, 0.15, 1.3, -0.3); f.quadraticCurveTo(0.7, -0.5, 0, -0.8); f.lineTo(0, 0);
      bs.add(mat, new THREE.ShapeGeometry(f, 5), M(V(p.x, hoehe + 1.3, p.z), Q(0, richtung + Math.PI / 2, 0)), { farbe: fahnen[s < 0 ? 0 : 3] });
      bs.add(mat, new THREE.CylinderGeometry(0.04, 0.04, 1.2, 6), M(V(p.x, hoehe + 0.8, p.z)), { farbe: '#5e3415' });
    }
    // Kleine Wimpel-Kette zwischen den Pfosten
    const a = ecken[0], b = ecken[1];
    for (let k = 1; k < 12; k++) {
      const t = k / 12;
      const p = a.clone().lerp(b, t);
      p.y = hoehe - 1.15 - Math.sin(t * Math.PI) * 0.5;
      bs.add(mat, new THREE.ConeGeometry(0.28, 0.55, 3).rotateX(Math.PI), M(p, Q(0, richtung, 0)), { farbe: fahnen[k % 4] });
    }
    bs.fertig(this.gruppe);

    // Das Band "START · ZIEL" mit Karos
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 64;
    const g = c.getContext('2d');
    for (let x = 0; x < 32; x++) for (let y = 0; y < 4; y++) {
      g.fillStyle = (x + y) % 2 ? '#222' : '#fff';
      g.fillRect(x * 16, y * 16, 16, 16);
    }
    g.fillStyle = '#ffd23a';
    g.fillRect(150, 6, 212, 52);
    g.strokeStyle = '#3b2412';
    g.lineWidth = 4;
    g.strokeRect(150, 6, 212, 52);
    g.fillStyle = '#3b2412';
    g.font = 'bold 36px "Arial Rounded MT Bold", Arial, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('START · ZIEL', 256, 34);
    const bandTex = new THREE.CanvasTexture(c);
    bandTex.colorSpace = THREE.SRGBColorSpace;
    const laenge = a.distanceTo(b);
    // Vorne und hinten je ein Band, damit die Schrift von beiden Seiten richtig herum ist
    const bandGeo = mergeGeometries([new THREE.PlaneGeometry(laenge, laenge / 8), new THREE.PlaneGeometry(laenge, laenge / 8).rotateY(Math.PI)]);
    const band = new THREE.Mesh(bandGeo, new THREE.MeshStandardMaterial({ map: bandTex, roughness: 0.8 }));
    band.position.set((a.x + b.x) / 2, hoehe - 0.3, (a.z + b.z) / 2);
    band.rotation.y = richtung + Math.PI / 2;
    this.gruppe.add(band);
  }

  // Der Rallye-Stand am Strand mit Steg ins Wasser und Schild
  baueStand(hindernisse) {
    const e = E();
    const st = e.stand;
    const boden = bodenHoehe(st.x, st.z);
    this.standPos = V(st.x, boden, st.z);
    const holzMat = new THREE.MeshStandardMaterial({ map: textur('planken.jpg'), vertexColors: true, roughness: 0.85 });
    const bunt = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, side: THREE.DoubleSide });
    const bs = new Bausatz();

    // Steg: vom Strand bis fast an die Startlinie
    const [ax, az] = e.steg.von, [bx, bz] = e.steg.bis;
    const lang = Math.hypot(bx - ax, bz - az);
    const dreh = Math.atan2(bx - ax, bz - az);
    const stegHoehe = WASSER_HOEHE + 0.75;
    const bretter = Math.floor(lang / 0.55);
    for (let k = 0; k < bretter; k++) {
      const t = (k + 0.5) / bretter;
      const x = ax + (bx - ax) * t, z = az + (bz - az) * t;
      const y = Math.max(stegHoehe, bodenHoehe(x, z) + 0.15);
      bs.add(holzMat, new THREE.BoxGeometry(2.2, 0.1, 0.48), M(V(x, y, z), Q(0, dreh, 0)), { farbe: k % 3 ? '#d9b080' : '#c79c6c', uv: [1, 0.3] });
    }
    // Pfähle im Wasser (rund!)
    for (let k = 0; k <= Math.floor(lang / 3); k++) {
      const t = k / Math.floor(lang / 3);
      for (const s of [-1, 1]) {
        const x = ax + (bx - ax) * t + Math.cos(dreh) * s * 1.1, z = az + (bz - az) * t - Math.sin(dreh) * s * 1.1;
        const unten = Math.min(bodenHoehe(x, z), -0.5);
        const h = stegHoehe + 0.5 - unten;
        bs.add(holzMat, new THREE.CylinderGeometry(0.14, 0.16, h, 8), M(V(x, unten + h / 2, z)), { farbe: '#a07850', uv: [0.5, 1] });
        bs.add(holzMat, new THREE.SphereGeometry(0.15, 8, 6), M(V(x, stegHoehe + 0.5, z)), { farbe: '#a07850' });
      }
    }
    // Am Ende vom Steg: zwei runde Bojen-Laternen
    const ende = V(bx, stegHoehe, bz);
    bs.add(bunt, new THREE.SphereGeometry(0.5, 12, 8), M(ende.clone().add(V(Math.cos(dreh) * 1.4, 0.1, -Math.sin(dreh) * 1.4))), { farbe: '#ff4d4d' });
    bs.add(bunt, new THREE.SphereGeometry(0.5, 12, 8), M(ende.clone().add(V(-Math.cos(dreh) * 1.4, 0.1, Math.sin(dreh) * 1.4))), { farbe: '#ffd23a' });

    // Der Stand: runde Theke, vier Pfosten und ein gestreiftes Sonnendach
    const sx = st.x, sz = st.z;
    bs.add(holzMat, new THREE.CylinderGeometry(1.5, 1.6, 1.1, 20, 1, false, -Math.PI * 0.8, Math.PI * 1.6), M(V(sx, boden + 0.55, sz), Q(0, dreh + Math.PI, 0)), { farbe: '#d9b080', uv: [3, 1] });
    bs.add(bunt, new THREE.TorusGeometry(1.55, 0.09, 6, 24, Math.PI * 1.6).rotateX(Math.PI / 2), M(V(sx, boden + 1.12, sz), Q(0, dreh + Math.PI / 2 + Math.PI * 0.2, 0)), { farbe: '#7a4a26' });
    for (let k = 0; k < 4; k++) {
      const w = (k / 4) * Math.PI * 2 + Math.PI / 4;
      bs.add(holzMat, new THREE.CylinderGeometry(0.08, 0.1, 3, 8), M(V(sx + Math.sin(w) * 1.7, boden + 1.5, sz + Math.cos(w) * 1.7)), { farbe: '#a07850' });
    }
    // Sonnendach: ein Kegel in Streifen (rot / weiß / lila)
    const streifen = ['#e5243b', '#fff3d6', '#9b3dff', '#fff3d6'];
    for (let k = 0; k < 12; k++) {
      const geo = new THREE.ConeGeometry(2.6, 1.3, 3, 1, true, (k / 12) * Math.PI * 2, Math.PI * 2 / 12 + 0.01);
      bs.add(bunt, geo, M(V(sx, boden + 3.55, sz)), { farbe: streifen[k % 4] });
    }
    bs.add(bunt, new THREE.SphereGeometry(0.2, 10, 8), M(V(sx, boden + 4.25, sz)), { farbe: '#ffd23a' });
    // Ein großer Deko-Zauberpilz neben dem Stand
    const px = sx - Math.sin(dreh) * 2.6 + Math.cos(dreh) * 1.5, pz = sz - Math.cos(dreh) * 2.6 - Math.sin(dreh) * 1.5;
    const pb = bodenHoehe(px, pz);
    bs.add(bunt, new THREE.CylinderGeometry(0.28, 0.4, 1.4, 12), M(V(px, pb + 0.7, pz)), { farbe: '#f4ead3' });
    bs.add(bunt, new THREE.SphereGeometry(1.1, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), M(V(px, pb + 1.3, pz), Q(), V(1, 0.75, 1)), { farbe: '#e5243b' });
    bs.fertig(this.gruppe);
    hindernisse.hinzufuegen(sx, sz, 1.7);
    hindernisse.hinzufuegen(px, pz, 0.6);

    // Das Schild (ein Bild, das wir selbst malen – wird jeden Tag neu beschriftet)
    this.schildLeinwand = document.createElement('canvas');
    this.schildLeinwand.width = 512;
    this.schildLeinwand.height = 256;
    this.schildTex = new THREE.CanvasTexture(this.schildLeinwand);
    this.schildTex.colorSpace = THREE.SRGBColorSpace;
    const tafel = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 1.8), new THREE.MeshStandardMaterial({ map: this.schildTex, roughness: 0.8, side: THREE.DoubleSide }));
    // Das Schild steht vorne an der Theke und schaut zum Wasser (zum Steg)
    tafel.position.set(sx + Math.sin(dreh) * 1.95, boden + 1.5, sz + Math.cos(dreh) * 1.95);
    tafel.rotation.y = dreh;
    this.gruppe.add(tafel);
    this.schildMalen(1);
    // Hier landet man nach dem Rennen wieder (auf dem Strand vor dem Steg)
    this.zurueckPos = V(ax - Math.sin(dreh) * 1.5, 0, az - Math.cos(dreh) * 1.5);
    this.zurueckWinkel = dreh;
  }

  // Das Schild beschriften: "Heute Rallye!" oder "Nächste Rallye: Tag X"
  schildMalen(tag) {
    const g = this.schildLeinwand.getContext('2d');
    const heute = istMarkttag(tag);
    g.clearRect(0, 0, 512, 256);
    // Holzbrett mit runden Ecken
    g.fillStyle = '#3b2412';
    g.beginPath(); g.roundRect(0, 0, 512, 256, 40); g.fill();
    g.fillStyle = '#c98a52';
    g.beginPath(); g.roundRect(10, 10, 492, 236, 32); g.fill();
    g.fillStyle = '#fbf0d4';
    g.beginPath(); g.roundRect(26, 26, 460, 204, 24); g.fill();
    // Ein gemalter Zauberpilz
    g.fillStyle = '#f4ead3';
    g.fillRect(70, 110, 26, 50);
    g.fillStyle = '#e5243b';
    g.beginPath(); g.ellipse(83, 112, 46, 34, 0, Math.PI, 0); g.fill();
    g.fillStyle = '#fff';
    for (const [x, y, r] of [[66, 96, 7], [92, 88, 6], [104, 104, 5], [78, 106, 4]]) { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
    g.fillStyle = '#4a2e14';
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.font = 'bold 58px "Baloo 2", "Arial Rounded MT Bold", Arial, sans-serif';
    g.fillText('Zauberpilz-', 145, 78);
    g.fillText('Rallye', 145, 134);
    g.font = 'bold 36px "Baloo 2", "Arial Rounded MT Bold", Arial, sans-serif';
    g.fillStyle = heute ? '#2c7a14' : '#8a3a12';
    g.textAlign = 'center';
    g.fillText(heute ? `Markttag! Mitmachen: ${E().teilnahme} Münzen` : `Mitmachen: ${E().teilnahmeSonst ?? E().teilnahme} Münzen`, 256, 196);
    this.schildTex.needsUpdate = true;
  }

  // Die Turbo-Zauberpilze: schweben über dem Wasser und leuchten
  bauePilze() {
    const e = E(), S = this.strecke;
    this.pilze = (e.pilze || []).map(([anteil, seite], nr) => {
      const i = S.idx(anteil * S.n);
      const p = S.punkt(i, seite, V());
      return { nr, i, seite, x: p.x, z: p.z };
    });
    const stiel = new THREE.LatheGeometry([[0, 0.0], [0.3, 0.02], [0.27, 0.5], [0.22, 1.0], [0.2, 1.25], [0, 1.25]].map(([r, y]) => new THREE.Vector2(r, y)), 14);
    const hut = new THREE.LatheGeometry([[0, 2.0], [0.4, 1.95], [0.8, 1.75], [1.05, 1.45], [1.1, 1.2], [0.9, 1.12], [0, 1.15]].map(([r, y]) => new THREE.Vector2(r, y)), 20);
    const stielMat = new THREE.MeshStandardMaterial({ color: '#fff4dc', emissive: '#ffe9b0', emissiveIntensity: 0.4, roughness: 0.6, side: THREE.DoubleSide });
    const hutMat = new THREE.MeshStandardMaterial({ map: pilzHutBild(), color: '#ffffff', emissive: '#ff4fd8', emissiveIntensity: 0.9, roughness: 0.5, side: THREE.DoubleSide });
    // Ein leuchtender Ring auf dem Wasser zeigt: hier durchfahren!
    const ring = new THREE.TorusGeometry(1.7, 0.12, 6, 28).rotateX(Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({ color: '#ffe066', transparent: true, opacity: 0.75, toneMapped: false });
    const n = this.pilze.length;
    this.pilzStiele = new THREE.InstancedMesh(stiel, stielMat, n);
    this.pilzHuete = new THREE.InstancedMesh(hut, hutMat, n);
    this.pilzRinge = new THREE.InstancedMesh(ring, ringMat, n);
    const farben = e.pilzFarben || ['#e5243b', '#9b3dff'];
    this.pilze.forEach((p, k) => this.pilzHuete.setColorAt(k, new THREE.Color(farben[k % farben.length])));
    for (const m of [this.pilzStiele, this.pilzHuete, this.pilzRinge]) {
      m.frustumCulled = false;
      this.szene.add(m);
    }
    this.setzePilze(0);
  }

  setzePilze(zeit) {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = V(), s = V();
    const gr = E().pilzGroesse ?? 1;
    this.pilze.forEach((pilz, k) => {
      const huepf = Math.sin(zeit * 2.2 + k * 1.3) * 0.25;
      p.set(pilz.x, WASSER_HOEHE + 0.9 + huepf, pilz.z);
      q.setFromAxisAngle(V(0, 1, 0), zeit * 1.5 + k);
      // Gerade eingesammelt? Dann kurz kleiner ("blopp") und wieder groß
      const klein = 1 - 0.6 * Math.max(0, (pilz.blopp ?? 0));
      m.compose(p, q, s.setScalar(gr * klein));
      this.pilzStiele.setMatrixAt(k, m);
      this.pilzHuete.setMatrixAt(k, m);
      p.y = WASSER_HOEHE + 0.05;
      m.compose(p, q.identity(), s.setScalar(1 + Math.sin(zeit * 4 + k) * 0.1));
      this.pilzRinge.setMatrixAt(k, m);
    });
    for (const mm of [this.pilzStiele, this.pilzHuete, this.pilzRinge]) mm.instanceMatrix.needsUpdate = true;
  }

  // Fünf Boote: eins für dich, vier für die KI-Gegner
  baueBoote() {
    const e = E();
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 });
    mat.userData.doppelt = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide });
    this.boote = [];
    const spielerFarbe = e.spielerBoot || { farbe: '#2f8fe0', fahne: '#ffd23a' };
    const liste = [{ name: 'Du', farbe: spielerFarbe.farbe, fahne: spielerFarbe.fahne, ki: null }, ...e.gegner.map((g) => ({ ...g, ki: g }))];
    for (const d of liste) {
      const { gruppe, ruder, fahne } = baueRennboot(d.farbe, d.fahne, mat);
      gruppe.visible = false;
      this.szene.add(gruppe);
      let figur = null;
      if (d.ki) {
        // Der KI-Fahrer: eine runde Figur, die auf der Bank sitzt
        figur = baueFigur(d.figur || { shirt: d.farbe, hose: '#efe2c0', haare: '#3a2a1e', haut: '#d9a77c', bart: false });
        figur.fussL.visible = figur.fussR.visible = false; // die Füße sind im Boot versteckt
        figur.figur.scale.setScalar(0.85);
        figur.figur.position.set(0, -0.16, -0.25);
        gruppe.add(figur.figur);
      }
      this.boote.push({
        name: d.name, farbe: d.farbe, ki: d.ki, gruppe, ruder, fahne, figur,
        tempoFaktor: d.ki ? d.ki.tempo ?? 1 : 1,
        x: 0, z: 0, h: 0, vx: 0, vz: 0, i: 0, seite: 0, fortschritt: 0,
        turbo: 0, aus: false, rutscht: 0, fertig: null, ruderPhase: Math.random() * 6,
        kiSpur: 0, uebermut: 1, letzteKurve: -1, pilzWahl: {}, pilzSperre: {}, weitWeg: 0,
      });
    }
    this.spielerBoot = this.boote[0];
  }

  // =============================================================
  //  MITMACHEN
  // =============================================================
  mitmachen() {
    const { tageszeit, rucksack, meldung, musik } = this.spiel;
    const e = E();
    if (tageszeit.istNacht()) {
      meldung('🌙 Im Dunkeln fährt niemand Rennen. Komm morgen wieder!', 5);
      return;
    }
    const preis = this.preis();
    if (rucksack.muenzen < preis) {
      musik?.gehtNicht?.();
      meldung(`Du brauchst ${preis} Münzen, um mitzumachen.${istMarkttag(tageszeit.tag) ? '' : ` Am Markttag (Tag ${naechsterMarkttag(tageszeit.tag)}) kostet es nur ${e.teilnahme}!`}`, 6);
      return;
    }
    rucksack.aendereMuenzen(-preis);
    musik?.kasse?.();
    this.teilnahmen++;
    this.starteRennen();
    const schonGewonnen = this.gewinnTag === tageszeit.tag;
    meldung(schonGewonnen
      ? '🍄 Los geht\'s! (Die Münzen gibt es nur einmal am Tag – heute fährst du um die Ehre!)'
      : `🍄 Willkommen bei der Rallye! Wer zuerst im Ziel ist, gewinnt ${e.gewinn} Münzen.`, 5);
  }

  // Alle Boote an den Start: nebeneinander, kurz vor der Linie
  starteRennen() {
    const e = E(), S = this.strecke;
    const anzahl = this.boote.length;
    const abstand = Math.min(3.4, (e.breite - 2) / (anzahl - 1));
    const startI = S.idx(-(e.startAbstand ?? 8) / S.schritt);
    // Wer steht wo? Du stehst in der Mitte, die KI verteilt sich zufällig
    const plaetze = [...Array(anzahl).keys()].map((k) => (k - (anzahl - 1) / 2) * abstand);
    const mitte = plaetze.splice(Math.floor(anzahl / 2), 1)[0];
    plaetze.sort(() => Math.random() - 0.5);
    // Nach mehreren Niederlagen hintereinander fahren die Gegner etwas langsamer (Hilfe vom Game Designer)
    const hilfe = (this.niederlagen || 0) >= (e.hilfeNachNiederlagen ?? 3);
    this.boote.forEach((b) => { if (b.ki) b.tempoFaktor = (b.ki.tempo ?? 1) * (hilfe ? e.hilfeTempo ?? 0.9 : 1); });
    if (hilfe) this.spiel.meldung?.('🍀 Die anderen Boote sind heute etwas müde – deine Chance!', 5);
    this.boote.forEach((b, k) => {
      const seite = k === 0 ? mitte : plaetze.pop();
      const p = S.punkt(startI, seite, V());
      b.x = p.x;
      b.z = p.z;
      b.h = Math.atan2(S.tx[startI], S.tz[startI]);
      b.vx = b.vz = 0;
      b.i = startI;
      b.seite = seite;
      b.kiSpur = seite;
      b.fortschritt = S.vorne(0, startI);
      b.turbo = 0;
      b.aus = false;
      b.rutscht = 0;
      b.fertig = null;
      b.uebermut = 1;
      b.letzteKurve = -1;
      b.pilzWahl = {};
      b.pilzSperre = {};
      b.weitWeg = 0;
      b.gruppe.visible = true;
    });
    this.phase = 'countdown';
    this.countdown = e.countdown ?? 3;
    this.letzteZahl = 0;
    this.rennZeit = 0;
    this.zielZeit = 0;
    this.reihenfolge = [];
    this.spielerPlatz = 0;
    this.ergebnisGezeigt = false;
    this.ausMeldung = 0;
    this.nachLetzterKI = 0;
    // Die Figur setzt sich ins Boot
    const s = this.spiel.spieler;
    s.geschwindigkeitY = 0;
    s.laufZeit = 0;
    s.figur.rotation.order = 'YXZ';
    this.aktualisiereBootLage(0);
    this.setzeFigur();
    this.zeigeHud(true);
  }

  // =============================================================
  //  JEDES BILD WÄHREND DES RENNENS (statt Laufen)
  //  richtung = Joystick, kameraWinkel = wie bei den Ruderbooten
  // =============================================================
  steuern(dt, richtung = { x: 0, y: 0 }, kameraWinkel = 0) {
    if (!this.laeuft) return;
    const e = E();
    if (this.phase === 'countdown') {
      this.countdown -= dt;
      const zahl = Math.ceil(this.countdown);
      if (zahl !== this.letzteZahl && zahl > 0) {
        this.letzteZahl = zahl;
        this.zeigeCountdown(String(zahl));
        this.piep(false);
      }
      if (this.countdown <= 0) {
        this.phase = 'rennen';
        this.zeigeCountdown('LOS!', true);
        this.piep(true);
      }
      this.countdownBewegen(dt);
      this.aktualisiereBootLage(dt);
      this.setzeFigur();
      return;
    }
    this.rennZeit += dt;
    this.countdownBewegen(dt);

    // ---------- Du ----------
    const du = this.spielerBoot;
    if (du.fertig === null) {
      const laenge = Math.hypot(richtung.x, richtung.y);
      const staerke = Math.min(1, laenge);
      let zielH = null, gas = 0;
      if (staerke > 0.05) {
        // Wohin zeigt der Joystick? (gleich wie bei den Ruderbooten: "vor" = weg von der Kamera)
        const sin = Math.sin(kameraWinkel), cos = Math.cos(kameraWinkel);
        const dx = (richtung.x * cos - richtung.y * sin) / laenge;
        const dz = (-richtung.x * sin - richtung.y * cos) / laenge;
        zielH = Math.atan2(dx, dz);
        const diff = winkelRund(zielH - du.h);
        // Wer ganz quer lenkt, rudert ein kleines bisschen langsamer
        // (aber nur wenig – bremsen muss man selbst: Joystick weniger weit drücken!)
        gas = staerke * Math.max(0.7, 0.85 + 0.15 * Math.cos(diff));
      }
      this.bewege(du, dt, zielH, gas);
    } else {
      // Im Ziel: das Boot gleitet gemütlich weiter
      const z = this.kiZiel(du, { koennen: 0.8, spur: 0, pilzChance: 0 }, dt);
      this.bewege(du, dt, z.zielH, Math.min(z.gas, 0.45));
    }

    // ---------- Die KI-Gegner ----------
    for (const b of this.boote) {
      if (!b.ki) continue;
      const z = this.kiZiel(b, b.ki, dt);
      this.bewege(b, dt, z.zielH, b.fertig === null ? z.gas : Math.min(z.gas, 0.5));
    }

    this.anstossen();
    this.pilzeEinsammeln();

    // ---------- Wer ist im Ziel? ----------
    const ziel = this.strecke.laenge * (e.runden ?? 1);
    for (const b of this.boote) {
      if (b.fertig === null && b.fortschritt >= ziel) {
        b.fertig = this.rennZeit;
        this.reihenfolge.push(b);
        if (b === du) this.spielerImZiel();
      }
    }
    // Hinweise für dich: aus der Bahn? Falsche Richtung?
    this.hinweise(dt);

    // Das Rennen endet: alle im Ziel, oder du schon lange im Ziel, oder du fährst gar nicht mehr mit
    if (this.phase === 'ziel') {
      this.zielZeit += dt;
      if (this.zielZeit > (e.zielWarten ?? 12)) this.beenden();
    } else {
      const kiFertig = this.boote.every((b) => !b.ki || b.fertig !== null);
      if (kiFertig) {
        this.nachLetzterKI = (this.nachLetzterKI ?? 0) + dt;
        if (this.nachLetzterKI > (e.wartenNachKI ?? 45)) this.aufgeben();
      } else this.nachLetzterKI = 0;
    }
    this.aktualisiereBootLage(dt);
    this.setzeFigur();
  }

  // ---------- Die Rennphysik (für alle Boote gleich!) ----------
  bewege(b, dt, zielH, gas) {
    const e = E(), S = this.strecke;
    if (zielH !== null) {
      // Das Boot dreht sich langsam in die neue Richtung
      const diff = winkelRund(zielH - b.h);
      b.h += klemme(diff * Math.min(1, dt * 4), -e.drehTempo * dt, e.drehTempo * dt);
    }
    let maxV = e.maxTempo * b.tempoFaktor;
    if (b.turbo > 0) maxV *= e.turboTempo;
    if (b.aus) maxV *= e.ausserhalbTempo; // außerhalb der Bahn: viel langsamer
    const zielV = maxV * klemme(gas, 0, 1);
    b.turbo = Math.max(0, b.turbo - dt);

    // Tempo zerlegen: nach vorne und zur Seite
    const fx = Math.sin(b.h), fz = Math.cos(b.h);
    const rx = -fz, rz = fx;
    let vor = b.vx * fx + b.vz * fz;
    let seit = b.vx * rx + b.vz * rz;
    if (vor < zielV) vor = Math.min(zielV, vor + (b.turbo > 0 ? e.turboSchub : e.beschleunigung) * dt);
    else vor = Math.max(zielV, vor - e.bremsen * dt);
    // GRIFF: Das Wasser hält das Boot nur ein bisschen in der Spur.
    // Wer zu schnell lenkt, rutscht seitlich weg – nach außen aus der Kurve!
    // Wer schon rutscht, hat weniger Griff (wie beim Schlittern auf Eis)
    b.rutscht = Math.abs(seit);
    // Im Turbo hält das Wasser besser – sonst fliegt man beim Zauberpilz sofort aus der Kurve
    const griff = b.turbo > 0
      ? e.griff * (e.turboGriff ?? 1) * dt
      : e.griff * (b.rutscht > (e.rutschAb ?? 1.5) ? e.rutschGriff ?? 1 : 1) * dt;
    seit = Math.abs(seit) <= griff ? 0 : seit - Math.sign(seit) * griff;
    vor = Math.max(0, vor - b.rutscht * e.rutschBremse * dt); // Rutschen kostet Tempo
    b.vx = fx * vor + rx * seit;
    b.vz = fz * vor + rz * seit;

    // Bewegen – aber nur, wo genug Wasser ist
    const nx = b.x + b.vx * dt, nz = b.z + b.vz * dt;
    const frei = (x, z) => bodenHoehe(x, z) < -0.5 && imErlaubtenMeer(x, z);
    if (frei(nx, nz)) { b.x = nx; b.z = nz; }
    else if (frei(nx, b.z)) { b.x = nx; b.vz *= 0.3; }
    else if (frei(b.x, nz)) { b.z = nz; b.vx *= 0.3; }
    else { b.vx *= 0.2; b.vz *= 0.2; }

    // Wo auf der Strecke ist das Boot? (Fortschritt = wie weit gefahren)
    const neu = S.naechster(b.x, b.z, b.i, 12);
    b.fortschritt += S.vorne(b.i, neu);
    b.i = neu;
    b.seite = S.seite(neu, b.x, b.z);
    b.aus = Math.abs(b.seite) > e.breite / 2;

    // Ganz weit weg von der Strecke? Dann bringt dich die Rettungs-Möwe zurück 🛟
    if (Math.abs(b.seite) > (e.zurueckAbstand ?? 30)) b.weitWeg += dt;
    else b.weitWeg = 0;
    if (b.weitWeg > 1.5) {
      const p = S.punkt(b.i, 0, V());
      b.x = p.x;
      b.z = p.z;
      b.h = Math.atan2(S.tx[b.i], S.tz[b.i]);
      b.vx = b.vz = 0;
      b.weitWeg = 0;
      b.seite = 0;
      b.aus = false;
      if (b === this.spielerBoot) this.spiel.meldung('🛟 Hoppla! Zurück auf die Strecke.', 3);
    }
    // Ruder schneller, wenn das Boot schnell ist
    b.ruderPhase += dt * (3 + 5 * Math.min(1.5, Math.hypot(b.vx, b.vz) / e.maxTempo));
  }

  // ---------- Die KI: wohin lenken, wie viel Gas? ----------
  // ki = { koennen, spur, pilzChance, fehler } (siehe einstellungen.js)
  kiZiel(b, ki, dt = 1 / 30) {
    const e = E(), S = this.strecke;
    const halb = e.breite / 2;
    const v = Math.hypot(b.vx, b.vz);

    // 1) Auf welcher Spur will ich fahren?
    let spur = ki.spur ?? 0;
    // Ein Zauberpilz kommt? Vielleicht hole ich ihn mir (nicht jeder erwischt jeden)
    for (const p of this.pilze) {
      const vor = S.vorne(b.i, p.i);
      if (vor > 0 && vor < 45) {
        if (b.pilzWahl[p.nr] === undefined) b.pilzWahl[p.nr] = Math.random() < (ki.pilzChance ?? 0);
        if (b.pilzWahl[p.nr]) spur = p.seite;
        break;
      }
    }
    // Ein Boot direkt vor mir? Dann ein bisschen zur Seite (überholen!)
    for (const o of this.boote) {
      if (o === b) continue;
      const vor = S.vorne(b.i, o.i);
      if (vor > 0 && vor < 10 && Math.abs(o.seite - b.kiSpur) < 2.6) {
        spur = o.seite + (o.seite > 0 ? -3.4 : 3.4);
        break;
      }
    }
    spur = klemme(spur, -(halb - 1.6), halb - 1.6);
    b.kiSpur += (spur - b.kiSpur) * Math.min(1, dt * 1.5);

    // 2) Lenken: auf einen Punkt ein Stück vor mir zielen
    const voraus = 5 + v * 0.5;
    const ziel = S.punkt(b.i + voraus / S.schritt, b.kiSpur, this.tmp);
    const zielH = Math.atan2(ziel.x - b.x, ziel.z - b.z);

    // 3) Kleine Fehler: vor manchen Kurven ist die KI übermütig (zu schnell!)
    const kurve = S.kurve[S.idx(b.i + 30 / S.schritt)];
    if (kurve >= 0 && kurve !== b.letzteKurve) {
      b.letzteKurve = kurve;
      b.uebermut = Math.random() < (ki.fehler ?? 0) ? 1 + (e.fehlerStaerke ?? 0.5) : 1;
    }
    if (S.kurve[b.i] < 0 && S.kurve[S.idx(b.i + 30 / S.schritt)] < 0) b.uebermut = 1;

    // 4) Tempo planen: Wie schnell darf ich in die nächsten Kurven? (rechtzeitig bremsen)
    const grenze = e.griff * (ki.koennen ?? 0.9) * b.uebermut;
    let plan = Infinity;
    for (let d = 0; d <= 70; d += 2) {
      const k = S.kMax[S.idx(b.i + d / S.schritt)];
      if (k < 1e-4) continue;
      const sicher = Math.sqrt(grenze / k);
      plan = Math.min(plan, Math.sqrt(sicher * sicher + 2 * e.bremsen * 0.8 * d));
    }
    let maxV = e.maxTempo * b.tempoFaktor;
    if (b.turbo > 0) maxV *= e.turboTempo;
    if (b.aus) maxV *= e.ausserhalbTempo;
    return { zielH, gas: Math.min(1, plan / maxV), plan };
  }

  // Boote stoßen sich sanft voneinander ab (keine harten Unfälle)
  anstossen() {
    const r = E().bootAbstand ?? 2.6;
    for (let a = 0; a < this.boote.length; a++) {
      for (let c = a + 1; c < this.boote.length; c++) {
        const A = this.boote[a], B = this.boote[c];
        const dx = B.x - A.x, dz = B.z - A.z;
        const d = Math.hypot(dx, dz);
        if (d >= r || d < 0.001) continue;
        const nx = dx / d, nz = dz / d;
        const schub = (r - d) / 2;
        A.x -= nx * schub; A.z -= nz * schub;
        B.x += nx * schub; B.z += nz * schub;
        // Ein bisschen Tempo in Stoß-Richtung wird ausgeglichen
        const rel = (B.vx - A.vx) * nx + (B.vz - A.vz) * nz;
        if (rel < 0) {
          const j = rel * 0.4;
          A.vx += nx * j; A.vz += nz * j;
          B.vx -= nx * j; B.vz -= nz * j;
        }
      }
    }
  }

  // Durch einen Zauberpilz fahren = Turbo! (der Pilz bleibt da – für alle)
  pilzeEinsammeln() {
    const e = E();
    const r2 = (e.pilzRadius ?? 2.6) ** 2;
    for (const b of this.boote) {
      for (const p of this.pilze) {
        if ((b.x - p.x) ** 2 + (b.z - p.z) ** 2 > r2) continue;
        if ((b.pilzSperre[p.nr] ?? -1) > this.rennZeit) continue;
        b.pilzSperre[p.nr] = this.rennZeit + 3;
        b.turbo = e.turboDauer;
        p.blopp = 1;
        if (b === this.spielerBoot) {
          this.turboKlang();
          this.zeigeHinweis('🍄 TURBO!', 'turbo', 1.5);
        }
      }
    }
  }

  spielerImZiel() {
    const e = E(), du = this.spielerBoot;
    const { tageszeit, rucksack, musik, meldung } = this.spiel;
    this.phase = 'ziel';
    this.zielZeit = 0;
    this.spielerPlatz = this.reihenfolge.indexOf(du) + 1;
    const zeit = du.fertig;
    const neueBestzeit = this.bestzeit === null || zeit < this.bestzeit;
    if (neueBestzeit) this.bestzeit = zeit;
    let gewinn = 0;
    let widerhaken = false;
    // Niederlagen hintereinander zählen (für die Hilfe in starteRennen) – ein Sieg setzt sie zurück
    this.niederlagen = this.spielerPlatz === 1 ? 0 : (this.niederlagen || 0) + 1;
    if (this.spielerPlatz === 1) {
      this.siege++;
      if (this.gewinnTag !== tageszeit.tag) {
        gewinn = e.gewinn;
        this.gewinnTag = tageszeit.tag;
        rucksack.aendereMuenzen(gewinn);
        musik?.muenzen?.(8);
      }
      // Der allererste Sieg bringt den Widerhaken für die Seilkanone 🪝
      // (Ist er verloren gegangen – kein Widerhaken und keine Seilkanone mehr da? Dann gibt's einen neuen.)
      if (!this.widerhakenGewonnen || (!this.widerhakenWartet && this.widerhakenFehlt?.())) {
        this.widerhakenGewonnen = true;
        widerhaken = true;
        // Rucksack voll? Dann in die Truhe an der Base – und ist die auch voll, wartet der Preis (siehe widerhakenNachliefern)
        if (rucksack.hinein('widerhaken')) this.widerhakenWo = 'rucksack';
        else if (this.inDieTruhe?.('widerhaken')) this.widerhakenWo = 'truhe';
        else { this.widerhakenWo = 'wartet'; this.widerhakenWartet = true; }
      }
      this.jubel();
    } else this.trostKlang();
    this.meldeErgebnis(zeit);
    this.zeigeErgebnis({ gewinn, neueBestzeit, widerhaken });
    if (widerhaken && this.widerhakenWo === 'wartet') meldung('🏆 Gewonnen! Dein Preis ist der WIDERHAKEN 🪝 – aber dein Rucksack UND deine Truhe sind voll! Mach irgendwo einen Platz frei, dann kommt er von selbst.', 10);
    else if (widerhaken && this.widerhakenWo === 'truhe') meldung('🏆 Gewonnen! Dein Rucksack ist voll – darum liegt dein Preis, der WIDERHAKEN 🪝, in deiner Truhe 📦 an der Base!', 10);
    else if (widerhaken) meldung('🏆 Gewonnen! Dein Preis: der WIDERHAKEN für die Seilkanone! 🪝', 7);
    else if (this.spielerPlatz === 1) {
      meldung(gewinn ? `🏆 Du hast die Zauberpilz-Rallye gewonnen! +${gewinn} Münzen!` : '🏆 Wieder Erster! (Den Gewinn gab es heute schon.)', 5);
    } else meldung(`🏁 Platz ${this.spielerPlatz}! Nächstes Mal schaffst du es!`, 5);
  }

  // Für die Inselzeitung aufschreiben
  meldeErgebnis(zeit) {
    const sieger = this.reihenfolge[0];
    this.letztesErgebnis = {
      tag: this.spiel.tageszeit.tag,
      platz: this.spielerPlatz,
      sieger: sieger === this.spielerBoot ? 'Du' : sieger.name,
      zeit: zeit === null ? null : Math.round(zeit * 10) / 10,
      teilnehmer: this.boote.length,
      gewonnen: this.spielerPlatz === 1,
      gegner: this.boote.filter((b) => b.ki).map((b) => b.name),
    };
    this.spiel.ereignisse?.melde('rallye', this.letztesErgebnis);
  }

  // Aufgeben (Knopf) – oder wenn man ewig nicht ins Ziel kommt
  aufgeben() {
    if (this.phase !== 'rennen' && this.phase !== 'countdown') return this.beenden();
    this.spielerPlatz = this.boote.length;
    // Wer noch nicht im Ziel ist, kommt der Reihe nach "ins Ziel" (nach Fortschritt)
    const rest = this.boote.filter((b) => b.ki && b.fertig === null).sort((a, b) => b.fortschritt - a.fortschritt);
    for (const b of rest) this.reihenfolge.push(b);
    this.reihenfolge.push(this.spielerBoot);
    this.meldeErgebnis(null);
    this.spiel.meldung('🏳️ Schade! Nächstes Mal klappt es bestimmt.', 4);
    this.beenden();
  }

  // Rennen vorbei: zurück an den Steg, die Rennboote verschwinden
  beenden() {
    this.phase = 'aus';
    for (const b of this.boote) b.gruppe.visible = false;
    this.zeigeHud(false);
    const s = this.spiel.spieler;
    const p = this.zurueckPos;
    s.figur.rotation.order = 'XYZ';
    s.figur.rotation.set(0, this.zurueckWinkel + Math.PI, 0);
    s.figur.position.set(p.x, bodenHoehe(p.x, p.z), p.z);
    s.geschwindigkeitY = 0;
    s.amBoden = true;
    s.armL.rotation.set(0, 0, 0);
    s.armR.rotation.set(0, 0, 0);
    if (s.fussL) s.fussL.position.z = s.fussR.position.z = 0;
  }

  // =============================================================
  //  BILDER: Boote schaukeln, Figur sitzt im Boot
  // =============================================================
  aktualisiereBootLage(dt) {
    const zeit = wasserZeit();
    for (const b of this.boote) {
      if (!b.gruppe.visible) continue;
      const g = b.gruppe;
      const fx = Math.sin(b.h), fz = Math.cos(b.h);
      const vorne = wellenHoehe(b.x + fx * 1.6, b.z + fz * 1.6, zeit);
      const hinten = wellenHoehe(b.x - fx * 1.6, b.z - fz * 1.6, zeit);
      const tempo = Math.hypot(b.vx, b.vz);
      g.position.set(b.x, WASSER_HOEHE + (vorne + hinten) / 2 - 0.06, b.z);
      g.rotation.y = b.h;
      g.rotation.x = -Math.atan((vorne - hinten) / 3.2) - tempo * 0.008 - (b.turbo > 0 ? 0.05 : 0);
      // Beim Rutschen kippt das Boot ein bisschen zur Seite
      const seit = b.vx * -fz + b.vz * fx;
      g.rotation.z = klemme(seit * 0.04, -0.2, 0.2) + Math.sin(this.zeit * 0.9 + b.ruderPhase * 0.1) * 0.015;
      // Ruder schwingen, Fahne flattert
      const w = Math.sin(b.ruderPhase), c = Math.cos(b.ruderPhase);
      for (const { halter, seite } of b.ruder) halter.rotation.set(0, seite * w * 0.5, seite * (-0.32 - c * 0.12));
      b.fahne.rotation.y = Math.PI / 2 + Math.sin(this.zeit * 9 + b.ruderPhase) * 0.25;
      b.fahne.scale.x = 1 + Math.min(0.4, tempo * 0.02);
      if (b.figur) {
        b.figur.armL.rotation.set(-1.15 - w * 0.35, 0, -0.35);
        b.figur.armR.rotation.set(-1.15 - w * 0.35, 0, 0.35);
      }
    }
  }

  // Deine Figur sitzt auf der Bank und rudert (wie in boote.js)
  setzeFigur() {
    if (!this.laeuft) return;
    const b = this.spielerBoot, s = this.spiel.spieler, g = b.gruppe;
    g.updateMatrixWorld();
    s.figur.position.copy(g.localToWorld(V(0, -0.22, -0.25)));
    s.figur.rotation.set(g.rotation.x, g.rotation.y, g.rotation.z);
    const w = Math.sin(b.ruderPhase);
    s.armL.rotation.set(-1.15 - w * 0.35, 0, -0.35);
    s.armR.rotation.set(-1.15 - w * 0.35, 0, 0.35);
    if (s.fussL) s.fussL.position.z = s.fussR.position.z = 0.3;
    if (s.koerper) s.koerper.position.y = 1.05;
    const k = s.k;
    if (k) {
      k.beinL.rotation.set(-1.45, 0, -0.08);
      k.beinR.rotation.set(-1.45, 0, 0.08);
      k.knieL.rotation.x = k.knieR.rotation.x = 1.5;
      k.huefte.position.y = 0.42;
      k.huefte.rotation.set(0, 0, 0);
      if (k.ellbogenL) k.ellbogenL.rotation.x = k.ellbogenR.rotation.x = -0.6 + w * 0.3;
    }
  }

  // Die Kamera schaut beim Rennen von hinten aufs Boot (main.js fragt das jedes Bild)
  kameraFolgen(dt, kameraWinkel) {
    if (!this.laeuft) return kameraWinkel;
    const ziel = this.spielerBoot.h + Math.PI;
    return kameraWinkel + winkelRund(ziel - kameraWinkel) * Math.min(1, dt * (E().kameraFolgen ?? 2.5));
  }

  // =============================================================
  //  JEDES BILD (auch wenn kein Rennen ist)
  // =============================================================
  aktualisiere(dt) {
    this.zeit += dt;
    const e = E(), S = this.strecke;
    const pos = this.spiel.spieler.figur.position;
    const tag = this.spiel.tageszeit.tag;
    // Neuer Tag? Dann das Schild neu beschriften
    if (tag !== this.schildTag) {
      this.schildTag = tag;
      this.schildMalen(tag);
    }
    // Weit weg? Dann gar nicht malen
    const weit = Math.hypot(pos.x - S.mitte.x, pos.z - S.mitte.z) - S.radius;
    const sichtbar = weit < (e.sichtweite ?? 350) || this.laeuft;
    this.gruppe.visible = sichtbar;
    // Die Turbo-Pilze gibt es nur am Markttag (und natürlich im Rennen)
    const pilzeDa = sichtbar; // die Rallye gibt es jetzt jeden Tag
    this.pilzStiele.visible = this.pilzHuete.visible = this.pilzRinge.visible = pilzeDa;
    if (!sichtbar) return;
    const wz = wasserZeit();
    // Bojen nur bewegen, wenn man nah genug ist, um es zu sehen
    if (weit < 180 || this.laeuft) this.setzeBojen(wz);
    if (pilzeDa) {
      for (const p of this.pilze) if (p.blopp) p.blopp = Math.max(0, p.blopp - dt * 2);
      this.setzePilze(this.zeit);
    }
    if (this.laeuft) {
      this.aktualisiereBootLage(0);
      this.setzeFigur();
      this.zeigeHudWerte(dt);
    }
  }

  // =============================================================
  //  ANZEIGEN (HUD, Countdown, Ergebnis)
  // =============================================================
  baueAnzeigen() {
    // Eigene Stil-Datei laden (falls index.html sie noch nicht hat)
    if (!document.querySelector('link[href$="css/rallye.css"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'css/rallye.css';
      document.head.appendChild(link);
    }
    const eltern = this.spiel.elternElement || document.body;
    const hud = document.getElementById('hud') || eltern;
    this.hud = document.createElement('div');
    this.hud.id = 'rallye-hud';
    this.hud.innerHTML = `
      <div class="rallye-schild rallye-platz">🏁 <b>1.</b> / 5</div>
      <div class="rallye-schild rallye-zeit">⏱️ 0:00.0</div>
      <div class="rallye-balken"><span></span></div>
      <button class="rallye-aufgeben">🏳️ Aufgeben</button>`;
    hud.appendChild(this.hud);
    this.hudPlatz = this.hud.querySelector('.rallye-platz');
    this.hudZeit = this.hud.querySelector('.rallye-zeit');
    this.hudBalken = this.hud.querySelector('.rallye-balken span');
    knopf(this.hud.querySelector('.rallye-aufgeben'), () => this.aufgeben());

    this.countdownFeld = document.createElement('div');
    this.countdownFeld.id = 'rallye-countdown';
    hud.appendChild(this.countdownFeld);
    this.hinweisFeld = document.createElement('div');
    this.hinweisFeld.id = 'rallye-hinweis';
    hud.appendChild(this.hinweisFeld);
    this.hinweisZeit = 0;

    this.fenster = document.createElement('div');
    this.fenster.id = 'rallye-fenster';
    this.fenster.className = 'spiel-fenster';
    this.fenster.innerHTML = `
      <div class="fenster-kopf"><h2>${BILDER.zauberpilz || '🍄'} Zauberpilz-Rallye</h2></div>
      <div class="rallye-gross"></div>
      <ol class="rallye-liste"></ol>
      <div class="knopf-reihe"><button class="fenster-knopf gruen rallye-weiter">Zurück zum Steg</button></div>`;
    eltern.appendChild(this.fenster);
    this.fenster.addEventListener('touchstart', (ev) => ev.stopPropagation());
    knopf(this.fenster.querySelector('.rallye-weiter'), () => this.beenden());
  }

  zeigeHud(an) {
    this.hud.classList.toggle('sichtbar', an);
    if (!an) {
      this.fenster.classList.remove('offen');
      this.countdownWeg();
      this.hinweisFeld.classList.remove('sichtbar');
    }
  }

  zeigeCountdown(text, los = false) {
    const f = this.countdownFeld;
    f.textContent = text;
    f.classList.toggle('los', los);
    f.classList.add('sichtbar');
    this.zahlZeit = 0; // seit wann ist die Zahl zu sehen? (für das "Aufploppen")
  }

  // Die Zahl ploppt groß auf und wird dann ruhig (bei LOS! verschwindet sie danach)
  countdownBewegen(dt) {
    const f = this.countdownFeld;
    if (!f.classList.contains('sichtbar')) return;
    this.zahlZeit += dt;
    const t = this.zahlZeit;
    const gross = t < 0.25 ? 1.8 - (t / 0.25) * 0.8 : 1 - Math.min(0.1, (t - 0.25) * 0.15);
    let sicht = Math.min(1, t / 0.2);
    if (f.classList.contains('los')) sicht *= 1 - klemme((t - 0.7) / 0.3, 0, 1);
    f.style.opacity = sicht.toFixed(2);
    f.style.transform = `translate(-50%, -50%) scale(${gross.toFixed(3)})`;
    if (f.classList.contains('los') && t > 1) this.countdownWeg();
  }

  countdownWeg() {
    this.countdownFeld.classList.remove('sichtbar');
    this.countdownFeld.style.opacity = '';
    this.countdownFeld.style.transform = '';
  }

  zeigeHinweis(text, art = '', sekunden = 1.2) {
    this.hinweisFeld.textContent = text;
    this.hinweisFeld.className = 'sichtbar ' + art;
    this.hinweisZeit = sekunden;
  }

  // Wie stehst du gerade? (Platz 1 = am weitesten gefahren)
  platzVon(boot) {
    const fertige = this.reihenfolge.indexOf(boot);
    if (fertige >= 0) return fertige + 1;
    const vorDir = this.boote.filter((b) => b !== boot && (b.fertig !== null || b.fortschritt > boot.fortschritt)).length;
    return vorDir + 1;
  }

  hinweise(dt) {
    const du = this.spielerBoot;
    if (du.fertig !== null) return;
    const S = this.strecke;
    const tempo = Math.hypot(du.vx, du.vz);
    // Fährst du falsch herum?
    const vorwaerts = du.vx * S.tx[du.i] + du.vz * S.tz[du.i];
    if (vorwaerts < -1.5) this.zeigeHinweis('↩️ Falsche Richtung!', 'warnung', 0.5);
    else if (du.aus && tempo > 1) {
      this.zeigeHinweis('🌊 Aus der Bahn – langsamer!', 'warnung', 0.5);
      if (this.ausMeldung <= 0) { this.spiel.musik?.platsch?.(0.5); this.ausMeldung = 3; }
    }
    this.ausMeldung -= dt;
  }

  zeigeHudWerte(dt) {
    const S = this.strecke, du = this.spielerBoot;
    const platz = this.platzVon(du);
    this.hudPlatz.innerHTML = `🏁 <b>${platz}.</b> / ${this.boote.length}`;
    this.hudZeit.textContent = `⏱️ ${zeitText(du.fertig ?? this.rennZeit)}`;
    const anteil = klemme(du.fortschritt / (S.laenge * (E().runden ?? 1)), 0, 1);
    this.hudBalken.style.width = `${(anteil * 100).toFixed(1)}%`;
    // Ergebnis-Fenster offen? Wer neu ins Ziel kommt, erscheint in der Liste
    if (this.fenster.classList.contains('offen') && this.listeLaenge !== this.reihenfolge.length) this.zeigeListe();
    if (this.hinweisZeit > 0) {
      this.hinweisZeit -= dt;
      if (this.hinweisZeit <= 0) this.hinweisFeld.classList.remove('sichtbar');
    }
  }

  zeigeErgebnis({ gewinn, neueBestzeit, widerhaken = false }) {
    const du = this.spielerBoot;
    const gross = this.fenster.querySelector('.rallye-gross');
    const muenze = BILDER.muenze || '🪙';
    if (this.spielerPlatz === 1) {
      gross.innerHTML = `<div class="rallye-pokal">🏆</div><b>Du hast gewonnen!</b><br>` +
        (gewinn ? `<span class="rallye-gewinn">+${gewinn} ${muenze}</span>` : '<span class="rallye-klein">Die Münzen gibt es nur einmal am Tag – aber du warst wieder der Schnellste!</span>') +
        (widerhaken ? `<br><span class="rallye-gewinn">+ ${BILDER.widerhaken || '🪝'} Widerhaken!</span><br><span class="rallye-klein">Den brauchst du für die Seilkanone.</span>` : '');
    } else {
      const platz = this.spielerPlatz || this.boote.length; // noch nicht im Ziel? Dann letzter Platz
      gross.innerHTML = `<div class="rallye-pokal">${platz === 2 ? '🥈' : platz === 3 ? '🥉' : '🚣'}</div><b>Platz ${platz}!</b><br><span class="rallye-klein">Nächstes Mal! Tipp: Vor engen Kurven bremsen und die Zauberpilze mitnehmen.</span>`;
    }
    gross.innerHTML += `<div class="rallye-klein">Deine Zeit: <b>${zeitText(du.fertig)}</b>${neueBestzeit ? ' · ⭐ Neue Bestzeit!' : ` · Bestzeit: ${zeitText(this.bestzeit)}`}</div>`;
    this.zeigeListe();
    this.fenster.classList.add('offen');
  }

  // Die Liste: wer ist schon im Ziel, mit welcher Zeit?
  zeigeListe() {
    const du = this.spielerBoot;
    this.listeLaenge = this.reihenfolge.length;
    this.fenster.querySelector('.rallye-liste').innerHTML = this.reihenfolge.map((b) =>
      `<li class="${b === du ? 'du' : ''}"><i style="background:${b.farbe}"></i>${b === du ? 'Du' : b.name}<span>${zeitText(b.fertig)}</span></li>`).join('');
  }

  // =============================================================
  //  KLÄNGE (benutzen die Bausteine aus musik.js)
  // =============================================================
  piep(los) {
    const m = this.spiel.musik;
    if (!m?.ctx) return;
    const t = m.ctx.currentTime;
    if (los) {
      m.ton(t, 880, 880, 0.5, 0.22, 'triangle');
      m.klingeln?.(t, 1760, 0.6, 0.05);
    } else m.ton(t, 523, 523, 0.18, 0.2, 'triangle');
  }

  turboKlang() {
    const m = this.spiel.musik;
    if (!m?.ctx) return;
    const t = m.ctx.currentTime;
    m.ton(t, 300, 1100, 0.45, 0.15, 'triangle', 0.02);
    m.rauschStoss?.(t, 0.6, 0.25, 'bandpass', 500, 2600, 1.2, 0.05);
  }

  jubel() {
    const m = this.spiel.musik;
    this.konfetti();
    if (!m?.ctx) return;
    const t = m.ctx.currentTime;
    [72, 76, 79, 84, 79, 84].forEach((n, i) => m.klavier(n, t + i * 0.12, i >= 4 ? 1.2 : 0.4, 0.25, m.effekte));
  }

  trostKlang() {
    const m = this.spiel.musik;
    if (!m?.ctx) return;
    const t = m.ctx.currentTime;
    [67, 64, 67].forEach((n, i) => m.klavier(n, t + i * 0.18, 0.6, 0.18, m.effekte));
  }

  // Ein kleiner Konfetti-Regen (nur ein paar Sekunden)
  konfetti() {
    const eltern = this.spiel.elternElement || document.body;
    const leinwand = document.createElement('canvas');
    leinwand.className = 'rallye-konfetti';
    eltern.appendChild(leinwand);
    const schaerfe = Math.min(window.devicePixelRatio || 1, 2);
    const B = window.innerWidth, H = window.innerHeight;
    leinwand.width = B * schaerfe;
    leinwand.height = H * schaerfe;
    const g = leinwand.getContext('2d');
    g.setTransform(schaerfe, 0, 0, schaerfe, 0, 0);
    const farben = ['#ff4d6d', '#ffb02e', '#ffe14d', '#4caf50', '#3d9bff', '#a066ff'];
    const teile = Array.from({ length: E().konfetti ?? 90 }, () => ({
      x: B / 2 + (Math.random() - 0.5) * 120, y: H * 0.45,
      vx: (Math.random() - 0.5) * 700, vy: -300 - Math.random() * 500,
      w: Math.random() * 6, f: farben[Math.floor(Math.random() * farben.length)],
    }));
    let alt = performance.now(), start = alt;
    const bild = (jetzt) => {
      const dt = Math.min(0.05, (jetzt - alt) / 1000);
      alt = jetzt;
      g.clearRect(0, 0, B, H);
      for (const t of teile) {
        t.vy += 600 * dt;
        t.vx *= 0.99;
        t.x += t.vx * dt;
        t.y += t.vy * dt;
        t.w += dt * 8;
        g.fillStyle = t.f;
        g.save();
        g.translate(t.x, t.y);
        g.rotate(t.w);
        g.fillRect(-5, -3, 10, 6);
        g.restore();
      }
      if (jetzt - start < 3200) requestAnimationFrame(bild);
      else leinwand.remove();
    };
    requestAnimationFrame(bild);
  }

  // =============================================================
  //  SPEICHERN & LADEN
  // =============================================================
  // Wartet der Widerhaken noch (Rucksack war voll)? Dann kommt er, sobald Platz ist
  widerhakenNachliefern() {
    const { rucksack, meldung } = this.spiel;
    if (!this.widerhakenWartet) return;
    if (rucksack.hat('widerhaken') || rucksack.hat('seilkanone')) { this.widerhakenWartet = false; return; }
    if (this.inDieTruhe?.('widerhaken', true)) { this.widerhakenWartet = false; return; } // liegt schon in der Truhe?
    if (rucksack.passt('widerhaken') && rucksack.hinein('widerhaken')) {
      this.widerhakenWartet = false;
      meldung('🪝 Da ist er: Dein Rallye-Preis, der WIDERHAKEN, ist jetzt in deinem Rucksack!', 7);
    } else if (this.inDieTruhe?.('widerhaken')) {
      this.widerhakenWartet = false;
      meldung('🪝 Dein Rallye-Preis, der WIDERHAKEN, liegt jetzt in deiner Truhe 📦 an der Base!', 7);
    }
  }

  alsDaten() {
    return {
      gewinnTag: this.gewinnTag,
      bestzeit: this.bestzeit,
      siege: this.siege,
      teilnahmen: this.teilnahmen,
      letztesErgebnis: this.letztesErgebnis,
      widerhakenGewonnen: !!this.widerhakenGewonnen,
      widerhakenWartet: !!this.widerhakenWartet,
      niederlagen: this.niederlagen || 0,
    };
  }

  ladeDaten(d = {}) {
    this.gewinnTag = d.gewinnTag ?? 0;
    this.bestzeit = d.bestzeit ?? null;
    this.siege = d.siege ?? 0;
    this.teilnahmen = d.teilnahmen ?? 0;
    this.letztesErgebnis = d.letztesErgebnis ?? null;
    this.widerhakenGewonnen = !!d.widerhakenGewonnen;
    this.widerhakenWartet = !!d.widerhakenWartet;
    this.niederlagen = d.niederlagen ?? 0;
    // Früher ging der Preis bei vollem Rucksack verloren: Wer schon gewonnen hat, bekommt ihn nachgeliefert
    if (!this.widerhakenGewonnen && this.siege > 0) {
      this.widerhakenGewonnen = true;
      this.widerhakenWartet = true;
    }
    this.schildTag = -1;
  }
}

// 63.4 Sekunden → "1:03.4"
function zeitText(s) {
  if (s === null || s === undefined) return '–';
  const min = Math.floor(s / 60);
  const sek = s - min * 60;
  return `${min}:${sek.toFixed(1).padStart(4, '0')}`;
}
