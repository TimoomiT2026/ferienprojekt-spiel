// =============================================================
//  PFERDE – Wildpferde auf den großen Wiesen
//
//  So geht's: Wildpferde sind scheu. Wer rennt, verscheucht sie.
//  Wer langsam hingeht, kann sie mit Äpfeln füttern. Nach ein paar
//  Äpfeln vertraut dir das Pferd: Es bekommt Sattel und Zaumzeug,
//  läuft dir hinterher, und du kannst aufsteigen und reiten!
//
//  Trick fürs iPad (wie bei den Schafen): Alle Pferde teilen sich
//  EINEN Körper, EINEN Hals mit Kopf, EINEN Schweif und je EIN
//  Bein-Stück oben und unten. Die Grafikkarte kopiert sie nur
//  ("InstancedMesh"). Sattel und Zaumzeug sind schon eingebaut –
//  sie werden nur beim eigenen Pferd sichtbar gemacht.
// =============================================================
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { EINSTELLUNGEN } from './einstellungen.js';
import { zufallMitSeed } from './rauschen.js';
import { bodenHoehe, istWald, abstandZumDorf, abstandZumPfad, DORF } from './gelaende.js';
import { GROESSE } from './junge.js';

// ---------- Zahlen zum Rumprobieren ----------
// (Die wichtigsten stehen in einstellungen.js unter "Pferde")
const E = EINSTELLUNGEN;
const aepfelZumZaehmen = () => E.aepfelZumZaehmen ?? 3;
const reitTempo = () => E.reitTempo ?? 18;
const scheuAbstand = () => E.scheuAbstand ?? 12;
const scheuTempo = () => E.scheuTempo ?? 4;
const folgeAbstand = () => E.folgeAbstand ?? 4;
const reitLenkung = () => E.reitLenkung ?? 2.4;

// Wie viele Herden, wie viele Pferde pro Herde?
const ANZAHL_HERDEN = 2;
const PFERDE_PRO_HERDE = 2;
// So weit weg vom Zelt wohnen die Wildpferde mindestens (Meter)
const MIN_ABSTAND_START = 90;
// Wie weit weg sieht man Pferde noch? (weiter weg = nicht malen)
const SICHTWEITE = 160;
// So schnell gehen sie gemütlich (Meter pro Sekunde)
const SCHRITT_TEMPO = 1.3;
// Beschleunigen und Bremsen beim Reiten (Meter pro Sekunde, jede Sekunde)
const REIT_BESCHLEUNIGUNG = 7;
const REIT_BREMSE = 9;
// So dick ist ein Pferd für Bäume und Felsen (Meter)
const PFERD_RADIUS = 0.75;

// Eigener Zufall nur für die Pferde: immer dieselben Plätze und Farben
const zufall = zufallMitSeed(4711);
const R = E.inselGroesse;

// Fellfarben: [Name, Fell, Mähne]
const FARBEN = [
  ['braun', '#6e4026', '#22150e'],
  ['fuchs', '#b0602a', '#d49a58'],
  ['schimmel', '#d6d1c7', '#b3ada3'],
  ['rappe', '#2a2523', '#121010'],
];

// ---------- Wo stehen die Teile? (in Metern, Pferd schaut nach +z) ----------
// Der Boden ist bei y = 0. Ein Pferd ist etwa 2,1 m hoch am Rücken.
const VORNE_BEIN = { x: 0.2, y: 1.42, z: 0.78 }; // Schulter
const HINTEN_BEIN = { x: 0.21, y: 1.4, z: -0.8 }; // Hüfte
const OBER_LAENGE = 0.5; // Länge vom oberen Bein-Stück
// Die Beine sind etwas kürzer als beim echten Pferd (sieht knuffiger aus):
// darum sitzt der ganze Körper um so viel tiefer
const TIEFER = 0.2;
const HALS_PUNKT = { y: 1.55, z: 0.78 }; // hier dreht sich der Hals (zum Grasen)
const SCHWEIF_PUNKT = { y: 1.98, z: -1.16 };
const SATTEL = { y: 2.16, z: 0.02 }; // oben auf dem Sattel
// So weit liegt der Fußpunkt der sitzenden Figur unter der Sattel-Oberfläche
// (Hüfte sitzt 0.42 hoch im Modell, mal GROESSE, minus das bisschen Po)
const SITZ_HUEFTE = 0.42;
const SITZ_TIEFE = SITZ_HUEFTE * GROESSE - 0.1;

// ---------- Kleine Helfer ----------
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const glatt = (a, b, x) => {
  const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const mische = THREE.MathUtils.lerp;

function dreheZu(winkel, ziel, schritt) {
  let d = ziel - winkel;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  return winkel + THREE.MathUtils.clamp(d, -schritt, schritt);
}
const winkelDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

// ---------- Formen bauen ----------
// "teil" sagt dem Maler, welche Farbe ein Stück bekommt:
//   0 = Fell (Farbe vom Pferd), 1 = eigene Farbe (Hufe, Augen),
//   2 = Mähne & Schweif (Mähnenfarbe vom Pferd), 3 = Sattel & Zaumzeug (nur beim eigenen Pferd)
const FELL = 0, EIGEN = 1, MAEHNE = 2, AUSRUESTUNG = 3;

// Ein Stück Form: Größe, Drehung, Position – und Farbe
function stueck(geo, teil, farbe, { s = [1, 1, 1], r = [0, 0, 0], p = [0, 0, 0] } = {}) {
  let g = geo.index ? geo : mergeVertices(geo);
  if (g.attributes.uv) g.deleteAttribute('uv');
  if (!g.attributes.normal) g.computeVertexNormals();
  const m = new THREE.Matrix4().compose(
    V(...p),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(r[0], r[1], r[2])),
    V(...s)
  );
  g.applyMatrix4(m);
  const n = g.attributes.position.count;
  const farben = new Float32Array(n * 3);
  const pos = g.attributes.position;
  const c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    if (typeof farbe === 'function') c.copy(farbe(pos.getX(i), pos.getY(i), pos.getZ(i)));
    else c.set(farbe);
    farben.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(farben, 3));
  g.setAttribute('teil', new THREE.BufferAttribute(new Float32Array(n).fill(teil), 1));
  return g;
}
const kugel = (b = 16, h = 12) => new THREE.SphereGeometry(1, b, h);

// Fell ist oben etwas dunkler, am Bauch etwas heller (sieht weicher aus)
const fellVerlauf = (unten, oben, hell = 1.06, dunkel = 0.9) => (x, y) => {
  const t = THREE.MathUtils.clamp((y - unten) / (oben - unten), 0, 1);
  const w = mische(hell, dunkel, t);
  return new THREE.Color(w, w, w);
};

// Eine weiche Röhre entlang einer Kurve, die dicker und dünner werden kann
// (für Hals, Mähne und Schweif). dicke(t) = Radius bei t (0 = Anfang, 1 = Ende)
function roehre(punkte, dicke, laengs = 16, rund = 10, breiteX = 1) {
  const kurve = new THREE.CatmullRomCurve3(punkte);
  const geo = new THREE.TubeGeometry(kurve, laengs, 1, rund, false);
  const pos = geo.attributes.position;
  const mitte = new THREE.Vector3(), v = new THREE.Vector3();
  for (let i = 0; i <= laengs; i++) {
    const t = i / laengs;
    kurve.getPointAt(t, mitte);
    const r = dicke(t);
    for (let j = 0; j <= rund; j++) {
      const k = i * (rund + 1) + j;
      v.fromBufferAttribute(pos, k).sub(mitte).multiplyScalar(r);
      v.x *= breiteX;
      v.add(mitte);
      pos.setXYZ(k, v.x, v.y, v.z);
    }
  }
  geo.computeVertexNormals();
  return geo;
}
const beule = (z, mitte, breite) => Math.exp(-(((z - mitte) / breite) ** 2));

// --- Der Körper (mit Sattel) ---
// Ein einziges, weich verformtes Ei: vorne die Brust, oben der Widerrist,
// hinten die runde Kruppe, unten der Bauch.
function rumpfGeo() {
  const geo = new THREE.SphereGeometry(1, 32, 20);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    // Vorne und hinten etwas stumpfer als eine Kugel
    const Z = Math.sign(z) * Math.pow(Math.abs(z), 0.8) * (z > 0 ? 1.2 : 1.28);
    const oben = 2.03 + 0.08 * beule(Z, 0.62, 0.32) + 0.08 * beule(Z, -0.8, 0.38) - 0.03 * beule(Z, -0.1, 0.4);
    const unten = 1.22 + 0.2 * glatt(0.2, 1.2, Z) + 0.3 * glatt(-0.5, -1.3, Z) - 0.03 * beule(Z, -0.1, 0.5);
    const breit = 0.4 + 0.05 * beule(Z, -0.78, 0.4) - 0.02 * beule(Z, 0.95, 0.3);
    p.setXYZ(i, x * breit, (oben + unten) / 2 + y * (oben - unten) / 2, Z);
  }
  geo.computeVertexNormals();
  return geo;
}

function koerperForm() {
  const verlauf = fellVerlauf(1.2, 2.2);
  const teile = [stueck(rumpfGeo(), FELL, verlauf)];
  // Schultern vorne und kräftige Oberschenkel hinten (da hängen die Beine dran)
  for (const sx of [1, -1]) {
    teile.push(stueck(kugel(12, 8), FELL, verlauf, { s: [0.15, 0.3, 0.22], p: [sx * 0.22, 1.52, 0.8], r: [0.3, 0, 0] }));
    teile.push(stueck(kugel(12, 8), FELL, verlauf, { s: [0.17, 0.36, 0.27], p: [sx * 0.23, 1.56, -0.8], r: [-0.25, 0, 0] }));
  }

  // ---- Sattel & Zaumzeug (nur beim eigenen Pferd sichtbar) ----
  const decke = '#2a5d9e', leder = '#7a4422', lederDunkel = '#4f2a14', metall = '#b8c0c8';
  // Die Satteldecke: ein Band, das sich um den Bauch legt
  const band = (breite, phiVon, phiLaenge, ringe = 6) => {
    const g = new THREE.SphereGeometry(1, 28, ringe, phiVon, phiLaenge, Math.PI / 2 - breite, breite * 2);
    g.rotateX(Math.PI / 2); // Pole zeigen jetzt nach vorne und hinten
    return g;
  };
  teile.push(stueck(band(0.42, Math.PI - 0.55, Math.PI + 1.1), AUSRUESTUNG, decke, { s: [0.425, 0.43, 1.0], p: [0, 1.625, 0.04] }));
  // Der Sattel selbst: Sitz, vorne der Knauf, hinten die Lehne
  teile.push(stueck(kugel(16, 10), AUSRUESTUNG, leder, { s: [0.3, 0.09, 0.42], p: [0, 2.07, 0.04] }));
  teile.push(stueck(kugel(10, 8), AUSRUESTUNG, lederDunkel, { s: [0.13, 0.1, 0.1], p: [0, 2.15, 0.42] }));
  teile.push(stueck(kugel(12, 8), AUSRUESTUNG, lederDunkel, { s: [0.24, 0.11, 0.09], p: [0, 2.15, -0.32] }));
  // Der Bauchgurt
  teile.push(stueck(band(0.05, 0, Math.PI * 2, 1), AUSRUESTUNG, lederDunkel, { s: [0.415, 0.43, 1.0], p: [0, 1.625, 0.3] }));
  // Steigbügel: Riemen und Bügel an beiden Seiten
  for (const sx of [1, -1]) {
    teile.push(stueck(new THREE.CylinderGeometry(0.018, 0.018, 0.62, 4, 1), AUSRUESTUNG, lederDunkel, { p: [sx * 0.43, 1.74, 0.12], r: [0, 0, sx * 0.08] }));
    teile.push(stueck(new THREE.TorusGeometry(0.07, 0.016, 5, 12), AUSRUESTUNG, metall, { p: [sx * 0.455, 1.4, 0.12], r: [0, Math.PI / 2, 0] }));
  }
  return mergeGeometries(teile);
}

// --- Hals und Kopf (Drehpunkt = HALS_PUNKT, damit er zum Grasen nicken kann) ---
function halsKopfForm() {
  const teile = [];
  const verlauf = fellVerlauf(0, 1.4, 1.02, 0.94);
  // Der Hals: eine dicke, leicht gebogene Röhre schräg nach vorne oben
  const halsPunkte = [V(0, -0.1, -0.08), V(0, 0.5, 0.26), V(0, 0.98, 0.58), V(0, 1.27, 0.78)];
  const halsDicke = (t) => mische(0.44, 0.24, Math.pow(t, 0.8));
  teile.push(stueck(roehre(halsPunkte, halsDicke, 14, 14, 0.68), FELL, verlauf));
  teile.push(stueck(kugel(12, 8), FELL, verlauf, { s: [0.17, 0.24, 0.24], p: [0, 1.27, 0.78] }));

  // Der Kopf: lang, schräg nach unten, zur Schnauze hin schmaler
  const kopfNeigung = 0.62;
  const kopf = new THREE.SphereGeometry(1, 20, 14);
  const kp = kopf.attributes.position;
  for (let i = 0; i < kp.count; i++) {
    const t = (kp.getZ(i) + 1) / 2; // 0 = hinten, 1 = Schnauze
    kp.setXYZ(i, kp.getX(i) * mische(1, 0.74, t), kp.getY(i) * mische(1.05, 0.78, t), kp.getZ(i));
  }
  kopf.computeVertexNormals();
  teile.push(stueck(kopf, FELL, verlauf, { s: [0.2, 0.235, 0.45], r: [kopfNeigung, 0, 0], p: [0, 1.07, 1.1] }));
  teile.push(stueck(kugel(12, 10), FELL, verlauf, { s: [0.2, 0.22, 0.22], p: [0, 1.09, 0.9] })); // Backe
  teile.push(stueck(kugel(12, 10), FELL, (x, y) => verlauf(x, y).multiplyScalar(0.8), { s: [0.165, 0.16, 0.18], p: [0, 0.86, 1.4] })); // Schnauze
  // Nüstern
  for (const sx of [1, -1]) {
    teile.push(stueck(kugel(6, 4), EIGEN, '#1c1512', { s: [0.032, 0.04, 0.02], p: [sx * 0.07, 0.87, 1.565] }));
  }
  // Augen (dunkel mit kleinem Glanzpunkt)
  for (const sx of [1, -1]) {
    teile.push(stueck(kugel(8, 6), EIGEN, '#1a1210', { s: [0.05, 0.055, 0.055], p: [sx * 0.17, 1.19, 1.0] }));
    teile.push(stueck(kugel(4, 3), EIGEN, '#ffffff', { s: [0.015, 0.015, 0.015], p: [sx * 0.21, 1.21, 1.03] }));
  }
  // Ohren: spitz und nach vorne gestellt
  for (const sx of [1, -1]) {
    const ohr = new THREE.ConeGeometry(0.065, 0.24, 7);
    ohr.translate(0, 0.12, 0);
    teile.push(stueck(ohr, FELL, verlauf, { s: [1, 1, 0.6], r: [0.2, 0, -sx * 0.22], p: [sx * 0.09, 1.36, 0.8] }));
  }
  // Ein kleiner weißer Stern auf der Stirn
  teile.push(stueck(kugel(8, 6), EIGEN, '#f4efe6', { s: [0.065, 0.075, 0.02], r: [kopfNeigung - 0.95, 0, 0], p: [0, 1.25, 1.075] }));

  // Die Mähne: ein weicher Kamm oben am Hals entlang, mit ein paar Büscheln
  const kurve = new THREE.CatmullRomCurve3(halsPunkte);
  const maehnenPunkte = [];
  const tangente = new THREE.Vector3(), nach = new THREE.Vector3();
  for (let i = 0; i <= 6; i++) {
    const t = 0.12 + (i / 6) * 0.86;
    const p = kurve.getPointAt(t);
    kurve.getTangentAt(t, tangente);
    nach.set(0, tangente.z, -tangente.y); // zeigt vom Hals nach hinten-oben
    maehnenPunkte.push(p.addScaledVector(nach, halsDicke(t) * 0.98 + 0.02));
  }
  teile.push(stueck(roehre(maehnenPunkte, (t) => mische(0.15, 0.09, t) * (0.75 + 0.25 * Math.sin(t * Math.PI)), 16, 8, 0.5), MAEHNE, '#ffffff'));
  // Schopf (die Haare vorne auf der Stirn)
  teile.push(stueck(kugel(7, 5), MAEHNE, '#ffffff', { s: [0.075, 0.13, 0.09], r: [1.0, 0, 0], p: [0, 1.36, 0.93] }));

  // ---- Zaumzeug ----
  const leder = '#4f2a14';
  teile.push(stueck(new THREE.TorusGeometry(1, 0.1, 5, 18), AUSRUESTUNG, leder, { s: [0.19, 0.175, 0.18], r: [kopfNeigung, 0, 0], p: [0, 0.96, 1.28] }));
  const ueberKopf = new THREE.CatmullRomCurve3([
    V(-0.18, 0.98, 1.26), V(-0.2, 1.17, 1.0), V(-0.15, 1.33, 0.8), V(0, 1.4, 0.74),
    V(0.15, 1.33, 0.8), V(0.2, 1.17, 1.0), V(0.18, 0.98, 1.26),
  ]);
  teile.push(stueck(new THREE.TubeGeometry(ueberKopf, 20, 0.02, 4, false), AUSRUESTUNG, leder));
  // Die Zügel: vom Maul am Hals entlang bis zu den Händen
  const zuegel = new THREE.CatmullRomCurve3([
    V(-0.19, 0.9, 1.36), V(-0.29, 0.8, 0.9), V(-0.27, 0.74, 0.35), V(-0.12, 0.8, -0.15), V(0, 0.84, -0.32),
    V(0.12, 0.8, -0.15), V(0.27, 0.74, 0.35), V(0.29, 0.8, 0.9), V(0.19, 0.9, 1.36),
  ]);
  teile.push(stueck(new THREE.TubeGeometry(zuegel, 40, 0.016, 4, false), AUSRUESTUNG, '#3a1f10'));
  return mergeGeometries(teile);
}

// --- Der Schweif (Drehpunkt oben, damit er wedeln kann) ---
function schweifForm() {
  const punkte = [V(0, 0.02, 0.05), V(0, -0.12, -0.2), V(0, -0.48, -0.34), V(0, -0.88, -0.36), V(0, -1.2, -0.28)];
  const dicke = (t) => (t < 0.15 ? mische(0.1, 0.075, t / 0.15) : Math.sin(Math.min(1, (t - 0.1) / 0.92) * Math.PI) * 0.12 + 0.03);
  const teile = [stueck(roehre(punkte, dicke, 18, 10, 0.75), MAEHNE, '#ffffff')];
  // Ein paar lose Haarsträhnen außen dran
  const zz = zufallMitSeed(12);
  for (let i = 0; i < 4; i++) {
    const sx = i % 2 ? 1 : -1;
    teile.push(stueck(kugel(7, 5), MAEHNE, '#ffffff', {
      s: [0.05, 0.3, 0.06],
      r: [0.15 + zz() * 0.1, 0, sx * 0.12],
      p: [sx * 0.05, -0.62 - i * 0.1, -0.36 + zz() * 0.05],
    }));
  }
  return mergeGeometries(teile);
}

// --- Bein oben (Drehpunkt oben an Schulter/Hüfte) ---
function oberBeinForm() {
  const g = new THREE.CylinderGeometry(0.165, 0.095, OBER_LAENGE, 10, 2, true);
  g.translate(0, -OBER_LAENGE / 2, 0);
  return mergeGeometries([
    stueck(g, FELL, '#f2f2f2', { s: [1, 1, 1.3] }),
    stueck(kugel(10, 6), FELL, '#eeeeee', { s: [0.105, 0.11, 0.11], p: [0, -OBER_LAENGE, 0] }), // Knie
  ]);
}

// --- Bein unten mit Huf (Drehpunkt = Knie) ---
function unterBeinForm() {
  const dunkler = (x, y) => {
    const w = mische(0.62, 0.86, THREE.MathUtils.clamp((y + 0.62) / 0.62, 0, 1));
    return new THREE.Color(w, w, w);
  };
  const roehre = new THREE.CylinderGeometry(0.072, 0.068, 0.42, 8, 2, true);
  roehre.translate(0, -0.21, 0);
  const fessel = new THREE.CylinderGeometry(0.065, 0.075, 0.16, 8, 1, true);
  fessel.translate(0, -0.52, 0.015);
  const huf = new THREE.CylinderGeometry(0.09, 0.118, 0.13, 10, 1);
  huf.translate(0, -0.655, 0.03);
  return mergeGeometries([
    stueck(roehre, FELL, dunkler),
    stueck(kugel(8, 6), FELL, dunkler, { s: [0.085, 0.09, 0.1], p: [0, -0.42, 0.005] }), // Fesselgelenk
    stueck(fessel, FELL, dunkler),
    stueck(huf, EIGEN, '#3a2e27'),
  ]);
}

// --- Ein Herz (für den Herzchen-Effekt beim Füttern) ---
function herzForm() {
  const f = new THREE.Shape();
  f.moveTo(0, -0.5);
  f.bezierCurveTo(-0.15, -0.3, -0.55, -0.1, -0.5, 0.2);
  f.bezierCurveTo(-0.45, 0.5, -0.1, 0.5, 0, 0.25);
  f.bezierCurveTo(0.1, 0.5, 0.45, 0.5, 0.5, 0.2);
  f.bezierCurveTo(0.55, -0.1, 0.15, -0.3, 0, -0.5);
  const g = new THREE.ExtrudeGeometry(f, { depth: 0.12, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, bevelSegments: 2, curveSegments: 8 });
  g.translate(0, 0, -0.06);
  return g;
}

// ---------- Das Material: Fell, eigene Farben, Mähne, Ausrüstung ----------
// Der Maler bekommt pro Pferd: Fellfarbe, Mähnenfarbe und ob Sattel & Zaumzeug drauf sind.
function pferdeMaterial() {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78 });
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = 'attribute float teil;\nattribute vec3 maehnenFarbe;\nattribute float ausruestung;\n' + shader.vertexShader
      .replace('#include <color_vertex>', `#include <color_vertex>
        #ifdef USE_INSTANCING_COLOR
          if (teil > 0.5) vColor.xyz = color.xyz;
          if (teil > 1.5 && teil < 2.5) vColor.xyz = color.xyz * maehnenFarbe;
        #endif`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        if (teil > 2.5 && ausruestung < 0.5) transformed = vec3(0.0);`);
  };
  m.customProgramCacheKey = () => 'pferd';
  return m;
}
// Für die Schatten: auch dort den Sattel bei Wildpferden weglassen
function schattenMaterial() {
  const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = 'attribute float teil;\nattribute float ausruestung;\n' + shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
        if (teil > 2.5 && ausruestung < 0.5) transformed = vec3(0.0);`
    );
  };
  m.customProgramCacheKey = () => 'pferd-schatten';
  return m;
}

function vieleKopien(geo, material, anzahl, schatten) {
  geo.setAttribute('maehnenFarbe', new THREE.InstancedBufferAttribute(new Float32Array(anzahl * 3), 3));
  geo.setAttribute('ausruestung', new THREE.InstancedBufferAttribute(new Float32Array(anzahl), 1));
  const mesh = new THREE.InstancedMesh(geo, material, anzahl);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(anzahl * 3).fill(1), 3);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.customDepthMaterial = schatten;
  mesh.frustumCulled = false; // die Pferde sind über die Insel verteilt
  mesh.count = 0;
  return mesh;
}

// ---------- Wo dürfen Pferde hin? ----------
function bodenOk(x, z) {
  return bodenHoehe(x, z) > -0.3 && Math.hypot(x, z) < R + 40;
}

// Ist das eine große, schöne Wiese? (kein Wald, flach, trocken, weit weg vom Dorf)
function istWiesenPunkt(x, z, hindernisse) {
  const h = bodenHoehe(x, z);
  if (h < 1.5 || h > 14) return false;
  if (istWald(x, z)) return false;
  if (abstandZumDorf(x, z) < DORF.radius + 30) return false;
  if (abstandZumPfad(x, z) < 4) return false;
  if (hindernisse.trifft(x, z, 1.2)) return false;
  const steil = Math.abs(bodenHoehe(x + 3, z) - h) + Math.abs(bodenHoehe(x, z + 3) - h);
  return steil < 1.4;
}

// Wie viel von der Umgebung ist Wiese? (0 = nichts, 1 = alles)
function wiesenGroesse(x, z, hindernisse) {
  let gut = 0, alle = 0;
  for (const r of [6, 12, 18]) {
    for (let i = 0; i < 8; i++) {
      const w = (i / 8) * Math.PI * 2 + r;
      alle++;
      if (istWiesenPunkt(x + Math.cos(w) * r, z + Math.sin(w) * r, hindernisse)) gut++;
    }
  }
  return gut / alle;
}

// =============================================================
export class Pferde {
  constructor(szene, hindernisse, spiel) {
    this.spiel = spiel; // { rucksack, meldung, musik, spieler, base }
    this.hindernisse = hindernisse;
    this.zeit = 0;
    this.liste = [];
    this.herden = [];
    this.eigenes = null; // dein Pferd (es gibt nur eins!)
    this.absteigStelle = null;
    this.suchZeit = 0;
    this.spielerTempo = 0; // wie schnell die Figur gerade unterwegs ist
    this.letztePos = null;
    this.beiGezaehmt = null; // optional: wird aufgerufen, wenn ein Pferd zahm wird

    this.platziere();

    // ---------- Die Formen (5 Pinselstriche für alle Pferde) ----------
    const material = pferdeMaterial();
    const schatten = schattenMaterial();
    const n = this.liste.length;
    this.teile = {
      koerper: vieleKopien(koerperForm(), material, n, schatten),
      halsKopf: vieleKopien(halsKopfForm(), material, n, schatten),
      schweif: vieleKopien(schweifForm(), material, n, schatten),
      oberBeine: vieleKopien(oberBeinForm(), material, n * 4, schatten),
      unterBeine: vieleKopien(unterBeinForm(), material, n * 4, schatten),
    };
    this.teile.unterBeine.castShadow = false; // dünn – sieht man im Schatten kaum

    // Herzchen (der 6. Pinselstrich)
    this.herzen = new THREE.InstancedMesh(herzForm(), new THREE.MeshBasicMaterial({ color: '#ff4f7e' }), 24);
    this.herzen.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.herzen.frustumCulled = false;
    this.herzen.count = 0;
    this.herzDaten = [];

    this.gruppe = new THREE.Group();
    this.gruppe.name = 'Pferde';
    for (const mesh of Object.values(this.teile)) this.gruppe.add(mesh);
    this.gruppe.add(this.herzen);
    szene.add(this.gruppe);

    this.baueInteraktionen();
    this.aktualisiere(0, V(0, 0, 0), 1);
  }

  // ---------- Die Herden auf zwei großen Wiesen verteilen ----------
  platziere() {
    const h = this.hindernisse;
    // Viele Stellen ausprobieren und die größten Wiesen nehmen
    const kandidaten = [];
    for (let i = 0; i < 260; i++) {
      const w = zufall() * Math.PI * 2;
      const r = MIN_ABSTAND_START + zufall() * (R * 0.8 - MIN_ABSTAND_START);
      const x = Math.cos(w) * r, z = Math.sin(w) * r;
      if (!istWiesenPunkt(x, z, h)) continue;
      kandidaten.push({ x, z, groesse: wiesenGroesse(x, z, h) + zufall() * 0.05 });
    }
    kandidaten.sort((a, b) => b.groesse - a.groesse);
    for (const k of kandidaten) {
      if (this.herden.length >= ANZAHL_HERDEN) break;
      if (this.herden.some((hd) => Math.hypot(hd.heimX - k.x, hd.heimZ - k.z) < 90)) continue;
      this.herden.push({ heimX: k.x, heimZ: k.z, x: k.x, z: k.z, wiese: k.groesse });
    }

    let farbNr = 0;
    for (const herde of this.herden) {
      for (let k = 0; k < PFERDE_PRO_HERDE; k++) {
        let x = herde.x, z = herde.z;
        for (let v = 0; v < 30; v++) {
          const tx = herde.x + (zufall() - 0.5) * 10, tz = herde.z + (zufall() - 0.5) * 10;
          if (this.wildDarf(tx, tz) && this.liste.every((p) => Math.hypot(p.x - tx, p.z - tz) > 3.5)) {
            x = tx;
            z = tz;
            break;
          }
        }
        const [art, fell, maehne] = FARBEN[farbNr++ % FARBEN.length];
        const p = {
          nr: this.liste.length, art, herde, x, z,
          drehung: zufall() * Math.PI * 2,
          groesse: 0.95 + zufall() * 0.1,
          fell: new THREE.Color(fell), maehne: new THREE.Color(maehne),
          zustand: 'grasen', timer: zufall() * 6,
          zielX: x, zielZ: z, fluchtTempo: 6,
          tempo: 0, phase: zufall() * 6,
          kopf: 0, // 0 = Kopf oben, 1 = ganz unten (grasen)
          kopfSeite: 0, // zur Seite schauen
          wedeln: zufall() * 10,
          vertrauen: 0,
          gezaehmt: false,
          wy: bodenHoehe(x, z), nicken: 0, rollen: 0, hub: 0, gangNicken: 0,
          steckZeit: 0,
          iaPos: V(x, 0, z),
        };
        this.liste.push(p);
      }
    }
  }

  // Darf ein Wildpferd hierhin? (nicht ins Wasser, nicht ins Dorf, nicht zum Zelt)
  wildDarf(x, z) {
    const h = bodenHoehe(x, z);
    if (h < 0.8 || h > 22) return false;
    if (Math.hypot(x, z) < 30) return false;
    if (abstandZumDorf(x, z) < DORF.radius + 8) return false;
    return !this.hindernisse.trifft(x, z, PFERD_RADIUS);
  }

  // Darf das eigene Pferd hierhin? (fast überall, nur nicht ins tiefe Wasser)
  eigenDarf(x, z) {
    return bodenOk(x, z) && !this.hindernisse.trifft(x, z, PFERD_RADIUS);
  }

  // ---------- Aktions-Knopf ----------
  baueInteraktionen() {
    const self = this;
    const N = aepfelZumZaehmen;
    this._interaktionen = [];
    // An jedem Wildpferd: Füttern
    for (const p of this.liste) {
      this._interaktionen.push({
        pos: p.iaPos,
        radius: 3.8,
        bild: '🍎',
        get text() {
          return p.vertrauen > 0 ? `Füttern (${p.vertrauen}/${N()})` : 'Füttern';
        },
        aktiv: () => !self.eigenes && !p.gezaehmt && p.zustand !== 'flucht' && p.sichtbar,
        ausfuehren: () => self.fuettern(p),
      });
    }
    // Am eigenen Pferd (an der Seite): Aufsteigen
    this.eigenPos = V(0, -999, 0);
    this.kopfPos = V(0, -999, 0);
    this.stallPos = V(0, -999, 0);
    this._interaktionen.push({
      pos: this.eigenPos,
      radius: 3.2,
      bild: '🐴',
      text: 'Aufsteigen',
      aktiv: () => !!self.eigenes && !self.reitet && ['folgen', 'warten'].includes(self.eigenes.zustand),
      ausfuehren: () => self.aufsteigen(),
    });
    // Vorne am Kopf: Warte hier / Komm mit / In den Stall
    this._interaktionen.push({
      pos: this.kopfPos,
      radius: 1.8,
      get bild() {
        return self.kopfAktion().bild;
      },
      get text() {
        return self.kopfAktion().text;
      },
      aktiv: () => !!self.eigenes && !self.reitet && ['folgen', 'warten'].includes(self.eigenes.zustand),
      ausfuehren: () => self.kopfAktion().los(),
    });
    // Beim Reiten: Absteigen (nur wenn daneben Platz ist)
    this._interaktionen.push({
      pos: this.eigenPos,
      radius: 6,
      bild: '⬇️',
      text: 'Absteigen',
      aktiv: () => self.reitet && self.absteigStelle !== null,
      ausfuehren: () => self.absteigen(),
    });
    // Am Stall: Pferd holen
    this._interaktionen.push({
      pos: this.stallPos,
      radius: 4,
      bild: '🐴',
      text: 'Pferd holen',
      aktiv: () => !!self.eigenes && self.eigenes.zustand === 'imStall' && !!self.stall,
      ausfuehren: () => self.ausDemStall(),
    });
  }

  get interaktionen() {
    return this._interaktionen;
  }

  get reitet() {
    return !!this.eigenes && this.eigenes.zustand === 'geritten';
  }

  get stall() {
    return this.spiel.base?.stall || null;
  }

  // Für die Karte: wo sind die Pferde?
  get positionen() {
    return this.liste.map((p) => ({ x: p.x, z: p.z, eigenes: p === this.eigenes }));
  }

  // Was macht der Knopf vorne am Kopf?
  kopfAktion() {
    const p = this.eigenes;
    if (p && p.zustand === 'warten') return { bild: '🐴', text: 'Komm mit!', los: () => this.kommMit() };
    if (this.stall) return { bild: '🏠', text: 'In den Stall', los: () => this.inDenStall() };
    return { bild: '✋', text: 'Warte hier', los: () => this.warteHier() };
  }

  kommMit() {
    if (!this.eigenes) return;
    this.eigenes.zustand = 'folgen';
    this.spiel.meldung?.('🐴 Dein Pferd kommt mit dir mit.', 3);
  }

  warteHier() {
    if (!this.eigenes) return;
    this.eigenes.zustand = 'warten';
    this.eigenes.timer = 2;
    this.spiel.meldung?.('✋ Dein Pferd wartet hier auf dich.', 3);
  }

  inDenStall() {
    const p = this.eigenes;
    if (!p || !this.stall) return;
    p.zustand = 'zumStall';
    p.steckZeit = 0;
    p.timer = 30; // spätestens dann ist es da
    this.spiel.meldung?.('🏠 Dein Pferd trabt zum Stall.', 3);
  }

  ausDemStall() {
    const p = this.eigenes;
    if (!p) return;
    p.zustand = 'folgen';
    this.spiel.musik?.pling?.();
    this.spiel.meldung?.('🐴 Dein Pferd kommt aus dem Stall!', 3);
  }

  // ---------- Füttern & Zähmen ----------
  fuettern(p) {
    const { rucksack, meldung, musik } = this.spiel;
    if (this.eigenes || p.gezaehmt) return;
    if (!rucksack.hat('apfel')) {
      meldung?.('🍎 Pferde lieben Äpfel! Kauf welche beim Händler im Dorf.', 4);
      return;
    }
    rucksack.nehmen('apfel', 1);
    p.vertrauen++;
    musik?.pling?.();
    this.herzchen(p, 4);
    const N = aepfelZumZaehmen();
    if (p.vertrauen >= N) {
      this.zaehmen(p);
      return;
    }
    p.zustand = 'fressen';
    p.timer = 2.5;
    const nochWieviele = N - p.vertrauen;
    meldung?.(`🍎 Mampf! Das Pferd mag dich. Noch ${nochWieviele} ${nochWieviele === 1 ? 'Apfel' : 'Äpfel'}!`, 3.5);
  }

  zaehmen(p) {
    p.gezaehmt = true;
    p.zustand = 'folgen';
    p.timer = 2;
    if (p.herde) p.herde = null; // es verlässt seine Herde
    this.eigenes = p;
    this.herzchen(p, 12);
    this.spiel.meldung?.('💖 Das Pferd vertraut dir! Es ist jetzt DEIN Pferd und läuft dir nach. Steig auf! 🐴', 6);
    if (this.beiGezaehmt) this.beiGezaehmt(p);
  }

  herzchen(p, anzahl) {
    const s = Math.sin(p.drehung), c = Math.cos(p.drehung);
    for (let i = 0; i < anzahl; i++) {
      if (this.herzDaten.length >= 24) this.herzDaten.shift();
      this.herzDaten.push({
        pos: V(p.x + s * 1.6 + (zufall() - 0.5) * 0.8, p.wy + 2.4 + zufall() * 0.4, p.z + c * 1.6 + (zufall() - 0.5) * 0.8),
        v: V((zufall() - 0.5) * 0.8, 1.2 + zufall() * 0.8, (zufall() - 0.5) * 0.8),
        leben: 1.4 + zufall() * 0.8,
        verzoegerung: i * 0.08,
        dreh: zufall() * 6,
      });
    }
  }

  // ---------- Aufsteigen ----------
  aufsteigen() {
    const p = this.eigenes;
    if (!p || this.reitet) return;
    p.zustand = 'geritten';
    p.tempo = 0;
    const s = this.spiel.spieler;
    s.geschwindigkeitY = 0;
    s.laufZeit = 0;
    s.figur.rotation.order = 'YXZ';
    this.absteigStelle = null;
    this.suchZeit = 0;
    this.spiel.musik?.pling?.();
    this.setzeFigur();
  }

  // ---------- Absteigen: neben das Pferd ----------
  absteigen() {
    const p = this.eigenes;
    if (!this.reitet) return;
    const stelle = this.absteigStelle || this.sucheAbsteigStelle(p);
    if (!stelle) return;
    p.zustand = 'warten';
    p.timer = 3;
    p.tempo = 0;
    this.absteigStelle = null;
    const s = this.spiel.spieler;
    s.figur.rotation.order = 'XYZ';
    s.figur.rotation.set(0, p.drehung, 0);
    s.figur.position.set(stelle.x, bodenHoehe(stelle.x, stelle.z), stelle.z);
    s.geschwindigkeitY = 0;
    s.amBoden = true;
    // Arme und Beine wieder normal (den Rest macht die Lauf-Animation)
    s.armL.rotation.set(0, 0, 0);
    s.armR.rotation.set(0, 0, 0);
    const k = s.k;
    if (k) {
      k.beinL.rotation.set(0, 0, 0);
      k.beinR.rotation.set(0, 0, 0);
      k.knieL.rotation.x = k.knieR.rotation.x = 0;
      k.huefte.position.y = 0.7;
    }
  }

  // Wo ist neben dem Pferd Platz zum Absteigen? (links, rechts, hinten, vorne)
  sucheAbsteigStelle(p) {
    const s = Math.sin(p.drehung), c = Math.cos(p.drehung);
    const spieler = this.spiel.spieler;
    const richtungen = [[c, -s], [-c, s], [-s * 1.3, -c * 1.3], [s * 1.3, c * 1.3]]; // links, rechts, hinten, vorne
    for (const weite of [1.8, 2.4, 3.2]) {
      for (const [dx, dz] of richtungen) {
        const x = p.x + dx * weite, z = p.z + dz * weite;
        if (spieler.kannStehen(x, z) && bodenHoehe(x, z) > -0.3) return { x, z };
      }
    }
    return null;
  }

  // ---------- Reiten (statt Laufen, solange man im Sattel sitzt) ----------
  steuern(dt, richtung, kameraWinkel) {
    const p = this.eigenes;
    if (!this.reitet) return;
    const laenge = Math.hypot(richtung.x, richtung.y);
    const staerke = Math.min(1, laenge);
    let zielTempo = 0;
    if (staerke > 0.05) {
      // "vor" = weg von der Kamera (genau wie beim Laufen)
      const sin = Math.sin(kameraWinkel), cos = Math.cos(kameraWinkel);
      const dx = (richtung.x * cos - richtung.y * sin) / laenge;
      const dz = (-richtung.x * sin - richtung.y * cos) / laenge;
      const diff = winkelDiff(Math.atan2(dx, dz), p.drehung);
      // Weich lenken: schnell gelenkt wird nur, wenn man langsam ist
      const lenk = reitLenkung() * mische(1.3, 0.65, Math.min(1, p.tempo / reitTempo()));
      p.drehung += THREE.MathUtils.clamp(diff * Math.min(1, dt * 5), -lenk * dt, lenk * dt);
      // In engen Kurven langsamer; ganz zurück = erst wenden
      zielTempo = reitTempo() * staerke * staerke * Math.max(0.2, Math.cos(diff));
    }
    // Bergauf wird es langsamer
    const vx = Math.sin(p.drehung), vz = Math.cos(p.drehung);
    const steigung = bodenHoehe(p.x + vx * 1.5, p.z + vz * 1.5) - bodenHoehe(p.x, p.z);
    zielTempo *= THREE.MathUtils.clamp(1 - Math.max(0, steigung / 1.5 - 0.25) * 1.2, 0.3, 1);
    p.tempo += THREE.MathUtils.clamp(zielTempo - p.tempo, -REIT_BREMSE * dt, REIT_BESCHLEUNIGUNG * dt);

    this.schiebe(p, dt, (x, z) => this.eigenDarf(x, z) && this.eigenDarf(x + vx * 1.2, z + vz * 1.2));

    // Ab und zu schauen, ob man absteigen kann
    this.suchZeit -= dt;
    if (this.suchZeit <= 0) {
      this.suchZeit = 0.2;
      this.absteigStelle = this.sucheAbsteigStelle(p);
    }
    this.lage(p, dt);
    this.eigenPos.set(p.x, 0, p.z);
    this.setzeFigur();
  }

  // Bewegt ein Pferd in seine Blickrichtung. Steht etwas im Weg,
  // rutscht es daran entlang (wie die Figur an Bäumen).
  schiebe(p, dt, darf) {
    const weg = p.tempo * dt;
    if (weg < 0.0001) return true;
    const dx = Math.sin(p.drehung) * weg, dz = Math.cos(p.drehung) * weg;
    if (darf(p.x + dx, p.z + dz)) {
      p.x += dx;
      p.z += dz;
      return true;
    }
    if (Math.abs(dx) > 0.002 && darf(p.x + dx, p.z)) {
      p.x += dx * 0.85;
      p.tempo *= 1 - Math.min(1, dt * 2);
      return true;
    }
    if (Math.abs(dz) > 0.002 && darf(p.x, p.z + dz)) {
      p.z += dz * 0.85;
      p.tempo *= 1 - Math.min(1, dt * 2);
      return true;
    }
    p.tempo *= 0.4; // angestoßen
    return false;
  }

  // Läuft zu einem Ziel: dreht sich hin, wird schneller oder langsamer.
  // Steht ein Baum im Weg, sucht es sich einen Umweg (erst links oder rechts probieren).
  laufeZu(p, zx, zz, tempoMax, dt, darf) {
    const dx = zx - p.x, dz = zz - p.z;
    const weit = Math.hypot(dx, dz);
    let zielWinkel = Math.atan2(dx, dz);
    const frei = (w) => darf(p.x + Math.sin(w) * 1.6, p.z + Math.cos(w) * 1.6);
    if (weit > 1.6 && !frei(zielWinkel)) {
      p.umwegZeit = (p.umwegZeit || 0) - dt;
      if (!p.umweg || p.umwegZeit <= 0) p.umweg = zufall() < 0.5 ? 1 : -1;
      for (const schritt of [0.5, 1, 1.5, 2.1, 2.7]) {
        if (frei(zielWinkel + p.umweg * schritt)) {
          zielWinkel += p.umweg * schritt;
          p.umwegZeit = 1.2;
          break;
        }
        if (frei(zielWinkel - p.umweg * schritt)) {
          p.umweg = -p.umweg;
          zielWinkel += p.umweg * schritt;
          p.umwegZeit = 1.2;
          break;
        }
      }
    }
    p.drehung = dreheZu(p.drehung, zielWinkel, dt * mische(2.6, 1.4, Math.min(1, p.tempo / 10)));
    const vorne = Math.max(0, Math.cos(winkelDiff(zielWinkel, p.drehung)));
    const ziel = tempoMax * (0.25 + 0.75 * vorne);
    p.tempo += THREE.MathUtils.clamp(ziel - p.tempo, -9 * dt, 4 * dt);
    const ok = this.schiebe(p, dt, darf);
    if (!ok || p.tempo < 0.3) p.steckZeit += dt;
    else p.steckZeit = Math.max(0, p.steckZeit - dt);
    return weit;
  }

  bremse(p, dt, staerke = 3) {
    p.tempo = Math.max(0, p.tempo - staerke * dt);
    if (p.tempo > 0) this.schiebe(p, dt, p.gezaehmt ? (x, z) => this.eigenDarf(x, z) : (x, z) => this.wildDarf(x, z));
  }

  // ---------- Wildpferde erschrecken: die ganze Herde rennt weg ----------
  erschrecke(herde, spieler) {
    const pferde = this.liste.filter((p) => p.herde === herde && !p.gezaehmt);
    if (pferde.length === 0) return;
    const mx = pferde.reduce((s, p) => s + p.x, 0) / pferde.length;
    const mz = pferde.reduce((s, p) => s + p.z, 0) / pferde.length;
    let weg = Math.atan2(mx - spieler.x, mz - spieler.z);
    // Zu weit von zu Hause weg? Dann lieber etwas Richtung Heimat flüchten
    const heimWeit = Math.hypot(herde.heimX - mx, herde.heimZ - mz);
    if (heimWeit > 50) {
      const heim = Math.atan2(herde.heimX - mx, herde.heimZ - mz);
      weg += winkelDiff(heim, weg) * 0.6;
    }
    const nah = Math.hypot(mx - spieler.x, mz - spieler.z) < 7;
    let ziel = null;
    for (let v = 0; v < 12 && !ziel; v++) {
      const w = weg + (v % 2 ? 1 : -1) * Math.ceil(v / 2) * 0.35;
      const tx = mx + Math.sin(w) * 30, tz = mz + Math.cos(w) * 30;
      if (this.wildDarf(tx, tz)) ziel = [tx, tz];
    }
    if (!ziel) ziel = [herde.heimX, herde.heimZ];
    herde.x = ziel[0];
    herde.z = ziel[1];
    pferde.forEach((p, i) => {
      p.zustand = 'flucht';
      p.zielX = ziel[0] + (i - 0.5) * 3;
      p.zielZ = ziel[1] + (i % 2 ? 1.5 : -1.5);
      p.fluchtTempo = nah ? 9 : 6; // ganz nah = Galopp, sonst Trab
      p.timer = 12;
      p.steckZeit = 0;
    });
  }

  // ---------- Das Gehirn der Wildpferde ----------
  denkeWild(p, dt, spieler, abstand, nacht) {
    p.timer -= dt;
    const darf = (x, z) => this.wildDarf(x, z);
    const schnell = this.spielerTempo > scheuTempo();

    // Hilfe! Da kommt jemand angerannt!
    if (p.zustand !== 'flucht' && abstand < scheuAbstand() && schnell && p.herde) {
      this.erschrecke(p.herde, spieler);
    }

    if (p.zustand === 'flucht') {
      p.kopf += (-0.1 - p.kopf) * Math.min(1, dt * 4);
      const rest = this.laufeZu(p, p.zielX, p.zielZ, p.fluchtTempo, dt, darf);
      if (rest < 2.5 || p.timer < 0 || p.steckZeit > 2) {
        p.zustand = 'stehen';
        p.timer = 3 + zufall() * 3;
      }
      return;
    }
    if (p.zustand === 'fressen') {
      // Mampf, mampf: zum Spieler drehen und kauen
      this.bremse(p, dt, 6);
      p.drehung = dreheZu(p.drehung, Math.atan2(spieler.x - p.x, spieler.z - p.z), dt * 2);
      p.kopf += (0.25 + Math.sin(this.zeit * 9) * 0.06 - p.kopf) * Math.min(1, dt * 5);
      if (p.timer < 0) {
        p.zustand = 'stehen';
        p.timer = 2;
      }
      return;
    }
    if (nacht) {
      // Nachts dösen Pferde im Stehen
      this.bremse(p, dt);
      p.kopf += (0.35 - p.kopf) * Math.min(1, dt);
      return;
    }
    if (p.zustand === 'gehen') {
      p.kopf += (0.05 - p.kopf) * Math.min(1, dt * 3);
      const rest = this.laufeZu(p, p.zielX, p.zielZ, SCHRITT_TEMPO, dt, darf);
      if (rest < 0.8 || p.timer < 0 || p.steckZeit > 1.5) {
        p.zustand = zufall() < 0.75 ? 'grasen' : 'stehen';
        p.timer = p.zustand === 'grasen' ? 6 + zufall() * 10 : 2 + zufall() * 4;
      }
    } else {
      this.bremse(p, dt);
      // Neugierig: kommt jemand langsam näher, hebt das Pferd den Kopf und schaut
      const neugierig = abstand < 9;
      let zielKopf = p.zustand === 'grasen' ? (Math.sin(this.zeit * 0.5 + p.wedeln) > -0.5 ? 1 : 0.3) : 0;
      if (neugierig) zielKopf = 0.05;
      p.kopf += (zielKopf - p.kopf) * Math.min(1, dt * 2.5);
      const seite = neugierig ? winkelDiff(Math.atan2(spieler.x - p.x, spieler.z - p.z), p.drehung) : 0;
      p.kopfSeite += (THREE.MathUtils.clamp(seite, -0.6, 0.6) - p.kopfSeite) * Math.min(1, dt * 3);
      if (p.timer < 0 && !neugierig) {
        if (zufall() < 0.5) {
          p.zustand = p.zustand === 'grasen' ? 'stehen' : 'grasen';
          p.timer = p.zustand === 'grasen' ? 6 + zufall() * 8 : 2 + zufall() * 3;
        } else {
          // Ein paar Schritte weiter, aber in der Nähe der Herde bleiben
          const h = p.herde;
          const w = zufall() * Math.PI * 2, r = 2 + zufall() * 6;
          const tx = (h ? h.x : p.x) + Math.cos(w) * r, tz = (h ? h.z : p.z) + Math.sin(w) * r;
          if (this.wildDarf(tx, tz)) {
            p.zielX = tx;
            p.zielZ = tz;
            p.zustand = 'gehen';
            p.timer = Math.hypot(tx - p.x, tz - p.z) / SCHRITT_TEMPO + 4;
          } else p.timer = 1;
        }
      }
    }

    // Nicht ineinander laufen: sanft auseinanderschieben
    for (const anderes of this.liste) {
      if (anderes === p) continue;
      const dx = p.x - anderes.x, dz = p.z - anderes.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.001 && d < 3) {
        const px = p.x + (dx / d) * (3 - d) * dt, pz = p.z + (dz / d) * (3 - d) * dt;
        if (this.wildDarf(px, pz)) {
          p.x = px;
          p.z = pz;
        }
      }
    }
  }

  // ---------- Das Gehirn von deinem Pferd ----------
  denkeEigenes(p, dt, spieler, abstand) {
    p.timer -= dt;
    const darf = (x, z) => this.eigenDarf(x, z);
    const stall = this.stall;
    if (p.zustand === 'geritten') return; // das macht steuern()

    if (p.zustand === 'folgen') {
      const folge = folgeAbstand();
      if (abstand > folge + 1) {
        // Hinterher! Je weiter weg, desto schneller (bis zum Galopp)
        const r = Math.atan2(p.x - spieler.x, p.z - spieler.z);
        const zx = spieler.x + Math.sin(r) * folge, zz = spieler.z + Math.cos(r) * folge;
        const tempo = THREE.MathUtils.clamp((abstand - folge) * 2, 1.2, 14);
        this.laufeZu(p, zx, zz, tempo, dt, darf);
        // Ganz festgesteckt und weit weg? Dann findet es den Weg schon (es taucht hinter dir auf)
        if (p.steckZeit > 4 && abstand > 25 && darf(zx, zz)) {
          p.x = zx;
          p.z = zz;
          p.steckZeit = 0;
        }
        p.kopf += (0 - p.kopf) * Math.min(1, dt * 3);
        p.kopfSeite *= 1 - Math.min(1, dt * 3);
        return;
      }
      // Nah genug: stehen bleiben und zu dir schauen
      this.bremse(p, dt, 9);
      const zuDir = Math.atan2(spieler.x - p.x, spieler.z - p.z);
      if (p.tempo < 0.5 && Math.abs(winkelDiff(zuDir, p.drehung)) > 0.6) p.drehung = dreheZu(p.drehung, zuDir, dt * 1.2);
      const zielKopf = Math.sin(this.zeit * 0.4 + p.wedeln) > 0.3 ? 0.9 : 0;
      p.kopf += (zielKopf - p.kopf) * Math.min(1, dt * 2);
      p.kopfSeite += (THREE.MathUtils.clamp(winkelDiff(zuDir, p.drehung), -0.6, 0.6) - p.kopfSeite) * Math.min(1, dt * 3);
      return;
    }

    if (p.zustand === 'zumStall') {
      if (!stall) {
        p.zustand = 'warten';
        return;
      }
      const rest = this.laufeZu(p, stall.x, stall.z, 6, dt, (x, z) => darf(x, z) || Math.hypot(x - stall.x, z - stall.z) < 4);
      // Angekommen – oder steckt fest / ist weit weg von dir? Dann ist es einfach schon da.
      if (rest < 1 || p.timer < 0 || p.steckZeit > 4 || abstand > 70) p.zustand = 'imStall';
      return;
    }

    if (p.zustand === 'imStall' && stall) {
      // Im Stall steht das Pferd in der Mitte und schaut nach vorne
      p.x += (stall.x - p.x) * Math.min(1, dt * 3);
      p.z += (stall.z - p.z) * Math.min(1, dt * 3);
      p.drehung = dreheZu(p.drehung, stall.winkel || 0, dt * 2);
      p.tempo = 0;
    } else this.bremse(p, dt);

    // Warten (oder im Stall): grasen und sich umschauen
    const zielKopf = Math.sin(this.zeit * 0.35 + p.wedeln) > -0.3 ? 1 : 0.1;
    p.kopf += (zielKopf - p.kopf) * Math.min(1, dt * 2);
    p.kopfSeite *= 1 - Math.min(1, dt);
  }

  // ---------- Höhe und Neigung am Hang ----------
  lage(p, dt) {
    const s = Math.sin(p.drehung), c = Math.cos(p.drehung);
    const L = 0.95 * p.groesse;
    const vorne = Math.max(bodenHoehe(p.x + s * L, p.z + c * L), -0.6);
    const hinten = Math.max(bodenHoehe(p.x - s * L, p.z - c * L), -0.6);
    const links = bodenHoehe(p.x + c * 0.4, p.z - s * 0.4), rechts = bodenHoehe(p.x - c * 0.4, p.z + s * 0.4);
    const y = (vorne + hinten) / 2;
    const nicken = THREE.MathUtils.clamp(-Math.atan2(vorne - hinten, L * 2), -0.45, 0.45);
    const rollen = THREE.MathUtils.clamp(Math.atan2(links - rechts, 0.8) * 0.4, -0.12, 0.12);
    const f = dt > 0 ? Math.min(1, dt * 10) : 1;
    p.wy += (y - p.wy) * f;
    if (Math.abs(y - p.wy) > 2) p.wy = y; // nach einem Sprung (z. B. Laden) sofort richtig
    p.nicken += (nicken - p.nicken) * f;
    p.rollen += (rollen - p.rollen) * f;
  }

  // ---------- Jedes Bild einmal ----------
  aktualisiere(dt, spielerPos, helligkeit = 1) {
    this.zeit += dt;
    const nacht = helligkeit < 0.3;

    // Wie schnell ist die Figur unterwegs? (gemessen, nicht geraten)
    if (!this.letztePos) this.letztePos = spielerPos.clone();
    const weg = Math.hypot(spielerPos.x - this.letztePos.x, spielerPos.z - this.letztePos.z);
    if (dt > 0) {
      const v = weg > 6 ? 0 : weg / dt; // Riesensprung = Teleport, kein Rennen
      this.spielerTempo += (v - this.spielerTempo) * Math.min(1, dt * 6);
    }
    this.letztePos.copy(spielerPos);

    const t = this.teile;
    let n = 0;
    for (const p of this.liste) {
      const abstand = Math.hypot(p.x - spielerPos.x, p.z - spielerPos.z);
      const eigenes = p === this.eigenes;
      p.sichtbar = eigenes || abstand < SICHTWEITE;
      if (!p.sichtbar) continue;
      if (dt > 0) {
        if (eigenes) this.denkeEigenes(p, dt, spielerPos, abstand);
        else this.denkeWild(p, dt, spielerPos, abstand, nacht);
      }
      if (p.zustand !== 'geritten') this.lage(p, dt);
      this.animiere(p, dt);
      this.male(p, n++);
      p.iaPos.set(p.x, 0, p.z);
    }

    // Wo sind die Knöpfe vom eigenen Pferd?
    const e = this.eigenes;
    if (e) {
      this.eigenPos.set(e.x, 0, e.z);
      this.kopfPos.set(e.x + Math.sin(e.drehung) * 1.9 * e.groesse, 0, e.z + Math.cos(e.drehung) * 1.9 * e.groesse);
    }
    const st = this.stall;
    if (st) this.stallPos.set(st.x, 0, st.z);
    else this.stallPos.set(0, -999, 0);

    t.koerper.count = t.halsKopf.count = t.schweif.count = n;
    t.oberBeine.count = t.unterBeine.count = n * 4;
    for (const mesh of Object.values(t)) {
      mesh.visible = mesh.count > 0;
      mesh.instanceMatrix.needsUpdate = true;
      mesh.instanceColor.needsUpdate = true;
      mesh.geometry.attributes.maehnenFarbe.needsUpdate = true;
      mesh.geometry.attributes.ausruestung.needsUpdate = true;
    }

    this.maleHerzen(dt);
    if (this.reitet) this.setzeFigur();
  }

  // ---------- Gangarten: Schritt, Trab, Galopp ----------
  // Welches Bein ist wann dran? [vorne links, vorne rechts, hinten links, hinten rechts]
  // Schritt: eins nach dem anderen. Trab: über Kreuz zusammen. Galopp: hinten, dann vorne.
  animiere(p, dt) {
    const v = p.tempo;
    const trab = glatt(1.7, 3.2, v);
    const galopp = glatt(6.5, 9, v);
    const schrittLaenge = mische(mische(1.7, 2.6, trab), 5.2, galopp);
    p.phase += (dt * Math.PI * 2 * v) / schrittLaenge;
    p.wedeln += dt;
    const bewegt = glatt(0.05, 0.6, v);
    p.bewegt = bewegt;
    p.trab = trab * (1 - galopp);
    p.galopp = galopp;
    // Hüpfen: beim Trab zweimal pro Schritt, beim Galopp einmal (wie ein Schaukelpferd!)
    const trabHub = Math.abs(Math.cos(p.phase)) * 0.07 * p.trab;
    const galoppHub = (Math.sin(p.phase - 0.6) * 0.5 + 0.5) * 0.14 * galopp;
    const schrittHub = Math.abs(Math.sin(p.phase * 2)) * 0.015 * bewegt * (1 - trab);
    p.hub = trabHub + galoppHub + schrittHub - 0.02 * bewegt;
    p.gangNicken = Math.sin(p.phase + 0.9) * 0.07 * galopp;
  }

  // ---------- Matrizen bauen und malen ----------
  male(p, i) {
    const t = this.teile;
    const g = p.groesse;
    // Das ganze Pferd: Ort, Drehung, Neigung am Hang
    _e.set(p.nicken, p.drehung, p.rollen, 'YXZ');
    _tier.compose(_p.set(p.x, p.wy, p.z), _q.setFromEuler(_e), _s.set(g, g, g));
    // Der Körper hüpft und schaukelt beim Laufen
    _koerper.multiplyMatrices(_tier, teil(0, p.hub - TIEFER, 0, p.gangNicken, 0, 0));
    setze(t.koerper, i, _koerper, p);

    // Hals & Kopf: nickt zum Grasen (Kopf runter) und schaut zur Seite
    const kauen = p.kopf > 0.7 ? Math.sin(this.zeit * 6 + p.nr) * 0.03 : 0;
    const galoppNick = -Math.sin(p.phase + 0.3) * 0.12 * p.galopp - Math.cos(p.phase * 2) * 0.03 * p.trab;
    const nick = -0.08 + p.kopf * 1.68 + kauen + galoppNick - 0.12 * p.galopp;
    _a.multiplyMatrices(_koerper, teil(0, HALS_PUNKT.y, HALS_PUNKT.z, nick, p.kopfSeite * 0.8, 0));
    setze(t.halsKopf, i, _a, p);

    // Schweif: hängt, wedelt gegen Fliegen, fliegt beim Galopp nach hinten
    const wedel = Math.sin(p.wedeln * 2.2 + p.nr) * Math.max(0, Math.sin(p.wedeln * 0.37 + p.nr * 2)) * 0.35;
    const heben = 0.12 + 0.35 * p.trab + 0.75 * p.galopp + Math.sin(p.phase * 2) * 0.08 * p.bewegt;
    _a.multiplyMatrices(_koerper, teil(0, SCHWEIF_PUNKT.y, SCHWEIF_PUNKT.z, heben, wedel * 0.6, wedel * (1 - p.galopp)));
    setze(t.schweif, i, _a, p);

    // Die vier Beine
    const v = p.tempo;
    const trab = glatt(1.7, 3.2, v), galopp = p.galopp;
    const schwung = mische(mische(0.3, 0.45, trab), 0.72, galopp) * p.bewegt;
    const knieVorne = mische(mische(0.6, 1.15, trab), 1.35, galopp) * p.bewegt;
    const knieHinten = mische(mische(0.45, 0.75, trab), 0.9, galopp) * p.bewegt;
    for (let b = 0; b < 4; b++) {
      const vorne = b < 2;
      const sx = b % 2 === 0 ? -1 : 1; // links = -x
      const versatz = mische(mische(SCHRITT_VERSATZ[b], TRAB_VERSATZ[b], trab), GALOPP_VERSATZ[b], galopp);
      const ph = p.phase + versatz;
      const sw = -Math.sin(ph) * schwung; // negativ = nach vorne
      const heben = Math.pow(Math.max(0, Math.cos(ph)), 1.5); // Bein schwingt vor = Huf hoch
      const pkt = vorne ? VORNE_BEIN : HINTEN_BEIN;
      let ober, unter;
      if (vorne) {
        ober = -0.04 + sw - heben * 0.15 * p.bewegt;
        unter = 0.04 + heben * knieVorne;
      } else {
        ober = 0.28 + sw * 0.9;
        unter = -0.3 - heben * knieHinten;
      }
      _a.multiplyMatrices(_koerper, teil(sx * pkt.x, pkt.y, pkt.z, ober, 0, 0));
      _b.multiplyMatrices(_a, teil(0, -OBER_LAENGE, 0, unter, 0, 0));
      if (!vorne) _a.multiply(_dickHinten);
      setze(t.oberBeine, i * 4 + b, _a, p);
      setze(t.unterBeine, i * 4 + b, _b, p);
    }
  }

  maleHerzen(dt) {
    let n = 0;
    for (const h of this.herzDaten) {
      if (h.verzoegerung > 0) {
        h.verzoegerung -= dt;
        continue;
      }
      h.leben -= dt;
      if (h.leben <= 0) continue;
      h.pos.addScaledVector(h.v, dt);
      h.v.multiplyScalar(1 - Math.min(1, dt * 0.8));
      h.dreh += dt * 3;
      const gr = 0.42 * Math.min(1, h.leben * 2) * (1 + Math.sin(h.leben * 12) * 0.08);
      _e.set(0, h.dreh, Math.sin(h.dreh) * 0.2, 'YXZ');
      _a.compose(h.pos, _q.setFromEuler(_e), _s.set(gr, gr, gr));
      this.herzen.setMatrixAt(n++, _a);
    }
    this.herzDaten = this.herzDaten.filter((h) => h.leben > 0);
    this.herzen.count = n;
    this.herzen.visible = n > 0;
    this.herzen.instanceMatrix.needsUpdate = true;
  }

  // ---------- Die Figur sitzt im Sattel ----------
  // Wie bei den Booten: figur.position ist der Fußpunkt der Figur.
  // Wir rechnen ihn so aus, dass der Po genau auf dem Sattel sitzt.
  setzeFigur() {
    const p = this.eigenes;
    if (!this.reitet) return;
    const s = this.spiel.spieler;
    const g = p.groesse;
    _e.set(p.nicken, p.drehung, p.rollen, 'YXZ');
    _tier.compose(_p.set(p.x, p.wy, p.z), _q.setFromEuler(_e), _s.set(g, g, g));
    _koerper.multiplyMatrices(_tier, teil(0, p.hub - TIEFER, 0, p.gangNicken, 0, 0));
    const sitz = _p.set(0, SATTEL.y - SITZ_TIEFE / g, SATTEL.z).applyMatrix4(_koerper);
    s.figur.position.copy(sitz);
    s.figur.rotation.set(p.nicken + p.gangNicken, p.drehung, p.rollen);

    // Die Sitz-Pose: Beine gespreizt um den Pferdebauch, Knie gebeugt
    const schnell = Math.min(1, p.tempo / reitTempo());
    const wipp = p.hub * 2.5; // der Reiter federt mit
    const k = s.k;
    if (k) {
      k.huefte.position.y = SITZ_HUEFTE;
      k.huefte.rotation.set(0, 0, 0);
      k.beinL.rotation.set(-0.85, 0.15, -0.72);
      k.beinR.rotation.set(-0.85, -0.15, 0.72);
      k.knieL.rotation.x = k.knieR.rotation.x = 1.15;
      k.fussL.rotation.x = k.fussR.rotation.x = -0.35;
      // Oberkörper: beim Galopp nach vorne lehnen
      k.bauch.rotation.set(0.06 + schnell * 0.28 - wipp * 0.15, 0, 0);
      k.brust.rotation.set(0.04 + schnell * 0.12, 0, 0);
      k.hals.rotation.set(-schnell * 0.3, 0, 0);
      k.kopf.rotation.set(-schnell * 0.12, 0, 0);
      // Die Hände halten die Zügel vor dem Bauch
      k.schulterL.rotation.set(-0.55 - schnell * 0.25, 0, 0.12);
      k.schulterR.rotation.set(-0.55 - schnell * 0.25, 0, -0.12);
      k.ellbogenL.rotation.x = k.ellbogenR.rotation.x = -1.0 + wipp * 0.2;
    }
    s.fussL.position.z = s.fussR.position.z = 0.3;
  }

  // ---------- Speichern & Laden ----------
  alsDaten() {
    const e = this.eigenes;
    let zustand = e ? e.zustand : null;
    if (zustand === 'geritten') zustand = 'warten';
    if (zustand === 'zumStall') zustand = 'imStall';
    return {
      eigenes: e ? e.nr : -1,
      zustand,
      pferde: this.liste.map((p) => ({ x: Math.round(p.x * 10) / 10, z: Math.round(p.z * 10) / 10, w: Math.round(p.drehung * 100) / 100, v: p.vertrauen })),
    };
  }

  ladeDaten(d) {
    if (!d) return;
    (d.pferde || []).forEach((g, i) => {
      const p = this.liste[i];
      if (!p || typeof g.x !== 'number') return;
      if (bodenOk(g.x, g.z)) {
        p.x = g.x;
        p.z = g.z;
        p.wy = bodenHoehe(g.x, g.z);
      }
      p.drehung = g.w || 0;
      p.vertrauen = g.v || 0;
    });
    const e = this.liste[d.eigenes];
    if (e) {
      e.gezaehmt = true;
      e.herde = null;
      e.zustand = ['folgen', 'warten', 'imStall'].includes(d.zustand) ? d.zustand : 'warten';
      this.eigenes = e;
    }
  }
}

// ---------- Rechen-Helfer für die Matrizen ----------
const _tier = new THREE.Matrix4(), _koerper = new THREE.Matrix4(), _teil = new THREE.Matrix4();
const _a = new THREE.Matrix4(), _b = new THREE.Matrix4();
const _q = new THREE.Quaternion(), _e = new THREE.Euler();
const _p = new THREE.Vector3(), _s = new THREE.Vector3();
const _eins = new THREE.Vector3(1, 1, 1);
const _dickHinten = new THREE.Matrix4().makeScale(1.12, 1, 1.15); // Hinterbeine sind kräftiger

// Verschieben + drehen (Reihenfolge: erst zur Seite schauen, dann nicken)
function teil(x, y, z, rx, ry, rz) {
  _e.set(rx, ry, rz, 'YXZ');
  return _teil.compose(_p.set(x, y, z), _q.setFromEuler(_e), _eins);
}

function setze(mesh, i, matrix, p) {
  mesh.setMatrixAt(i, matrix);
  mesh.setColorAt(i, p.fell);
  const m = mesh.geometry.attributes.maehnenFarbe;
  m.setXYZ(i, p.maehne.r, p.maehne.g, p.maehne.b);
  mesh.geometry.attributes.ausruestung.setX(i, p.gezaehmt ? 1 : 0);
}

// Wann ist welches Bein dran? (Winkel im Schritt-Takt) [VL, VR, HL, HR]
const SCHRITT_VERSATZ = [Math.PI * 0.5, Math.PI * 1.5, 0, Math.PI];
const TRAB_VERSATZ = [0, Math.PI, Math.PI, 0];
const GALOPP_VERSATZ = [1.9, 1.35, 0.55, 0];
