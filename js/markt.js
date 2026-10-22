// =============================================================
//  DER WOCHENMARKT 🛒 im Palmendorf (Etappe 4)
//  Entscheidungen des Game Designers:
//    • alle 3 Spieltage (siehe markttag.js), im Palmendorf
//    • 🍎 Obst & Gemüse (günstiger als beim Händler)
//    • ☕ Kaffee: trinken = eine Nacht ohne Schlaf zählt nicht
//    • 🍋 Nacht-Limo: trinken = die Nacht wird taghell
//    • 💎 Steine, Metall & Edelsteine
//  Die Stände gibt es nur am Markttag. Nachts sind sie zu (die
//  Verkäufer schlafen – wie die Händler).
//
//  Wie im Palmendorf kleben wir alle Teile mit demselben Material
//  zu EINEM Modell zusammen (Bausatz aus dorf.js) → wenige Malbefehle.
// =============================================================
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { EINSTELLUNGEN } from './einstellungen.js';
import { INSELN, bodenHoehe } from './gelaende.js';
import { Bausatz } from './dorf.js';
import { baueFigur } from './figur.js';
import { textur } from './texturen.js';
import { zufallMitSeed } from './rauschen.js';
import { Haendler } from './haendler.js';
import { BILDER } from './bilder.js';
import { istMarkttag } from './markttag.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const Q = (x = 0, y = 0, z = 0) => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z));
const M = (pos, rot = Q(), skala = V(1, 1, 1)) => new THREE.Matrix4().compose(pos, rot, skala);
const E = () => EINSTELLUNGEN.markt || {};

// ---------- Die vier Stände ----------
//   winkel  = wo am Dorfplatz (Grad: 0 = Osten, 90 = Süden, 180 = Westen, 270 = Norden)
//   abstand = wie weit von der Dorfmitte (Meter)
// Im Osten ist der Eingang (Boot und Ballon kommen von dort) – da bleibt alles frei.
const STAENDE = [
  {
    id: 'obst', name: 'Obst & Gemüse', bild: BILDER.apfel, schild: 'OBST & GEMÜSE',
    preise: () => E().obstPreise || { brot: 18, apfel: 2, karotte: 4 },
    winkel: 100, abstand: 13, farbe: '#56b947', farbe2: '#ffd23d',
    figur: { shirt: '#5cbf4a', hose: '#6b4a2e', haare: '#8a5a2a', haut: '#f0c8a0', hut: '#e8cf8a', bart: false },
    gruss: '„Frisches Obst und Gemüse! Heute alles billiger als im Laden!“',
  },
  {
    id: 'kaffee', name: 'Kaffeestand', bild: BILDER.kaffee, schild: 'KAFFEE',
    preise: () => E().kaffeePreise || { kaffee: 35 },
    winkel: 165, abstand: 15.5, farbe: '#e8473a', farbe2: '#fff6e4',
    figur: { shirt: '#8a5a3c', hose: '#3a3a4a', haare: '#2a1d14', haut: '#c99a72', hut: null, bart: true },
    gruss: '„Ein Kaffee gefällig? Dann musst du eine Nacht nicht schlafen!“',
  },
  {
    id: 'limo', name: 'Limonadenstand', bild: BILDER.nachtLimo, schild: 'NACHT-LIMO',
    preise: () => E().limoPreise || { nachtLimo: 40 },
    winkel: 195, abstand: 15.5, farbe: '#ffc928', farbe2: '#4a5ad8',
    figur: { shirt: '#ffd23d', hose: '#2bb3b0', haare: '#d86a2a', haut: '#f5d0b0', hut: '#ff7a9a', bart: false },
    gruss: '„Meine Nacht-Limo macht die Nacht taghell! Pssst – Geheimrezept.“',
  },
  {
    id: 'steine', name: 'Steine & Erze', bild: BILDER.edelstein, schild: 'STEINE & ERZE',
    preise: () => E().steinPreise || { kohle: 6, eisenerz: 12, gold: 30, edelstein: 75 },
    winkel: 260, abstand: 13, farbe: '#5a6ae8', farbe2: '#fff6e4',
    figur: { shirt: '#6a7a8a', hose: '#4a3a2a', haare: '#6a6a6a', haut: '#d8a880', hut: '#5a4030', bart: true },
    gruss: '„Edelsteine, Gold, Eisenerz und Kohle – frisch aus der Mine!“',
  },
];

// ---------- Die Materialien (jedes Material = ein Malbefehl) ----------
function materialien() {
  const m = {
    holz: new THREE.MeshStandardMaterial({
      map: textur('planken.jpg'), normalMap: textur('bretter_normal.jpg', { farbe: false }), normalScale: new THREE.Vector2(0.7, 0.7),
      vertexColors: true, roughness: 0.85,
    }),
    // Stoff, Fähnchen und alles Bunte (beide Seiten sichtbar, weil Stoff dünn ist)
    bunt: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, side: THREE.DoubleSide }),
    // Was glänzt: Gold, Edelsteine, die Kaffeekanne
    glanz: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.25, metalness: 0.55 }),
    // Die Nacht-Limo leuchtet ein bisschen (nachts mehr)
    limo: new THREE.MeshStandardMaterial({ color: '#ffe347', emissive: '#ffc020', emissiveIntensity: 0.2, roughness: 0.15 }),
  };
  m.limo.userData.keinSchatten = true;
  return m;
}

// Ein Drehkörper (wie eine Vase auf der Töpferscheibe): umriss = [[radius, höhe], …]
const dreh = (umriss, seiten = 16) => new THREE.LatheGeometry(umriss.map(([r, y]) => new THREE.Vector2(r, y)), seiten);

// ---------- Ein Korb (unten schmaler, mit dickem Rand) ----------
function korb(add, m, x, y, z, r = 0.3, h = 0.2) {
  add(m.holz, new THREE.CylinderGeometry(r, r * 0.78, h, 16), M(V(x, y + h / 2, z)), { farbe: '#c89a5a', uv: [2, 0.4] });
  add(m.holz, new THREE.TorusGeometry(r, 0.04, 6, 18).rotateX(Math.PI / 2), M(V(x, y + h, z)), { farbe: '#9a6a3a', uv: [3, 0.2] });
}

// Ein Häufchen Kugeln (Äpfel, Zitronen, Kohl …) als kleiner Berg
function haufen(add, m, material, x, y, z, { anzahl = 9, r = 0.08, breit = 0.22, farben, skala = V(1, 1, 1), zufall }) {
  for (let i = 0; i < anzahl; i++) {
    const w = i * 2.4, a = Math.sqrt(i / anzahl) * breit;
    const hoch = (1 - a / (breit + 0.001)) * r * 1.4;
    add(material, new THREE.SphereGeometry(r, 10, 8), M(V(x + Math.cos(w) * a, y + r * 0.8 + hoch, z + Math.sin(w) * a), Q(zufall(), zufall(), 0), skala), { farbe: farben[i % farben.length] });
  }
}

// ---------- Die Waren auf jedem Stand ----------
// (y = 1.02 ist die Oberkante der Theke, +z = vorne zum Dorfplatz)
const OBEN = 1.02;
const WAREN = {
  obst(add, m, z) {
    // Drei Körbe: Äpfel, Karotten, Brote
    korb(add, m, -1.05, OBEN, 0.05);
    haufen(add, m, m.bunt, -1.05, OBEN + 0.1, 0.05, { anzahl: 10, r: 0.085, farben: ['#e8352a', '#d92a20', '#f0b030'], zufall: z });
    korb(add, m, 0, OBEN, 0.05);
    for (let i = 0; i < 7; i++) {
      const w = (i / 7) * Math.PI * 2;
      const p = V(Math.cos(w) * 0.1, OBEN + 0.24, 0.05 + Math.sin(w) * 0.1);
      const kippen = Q(Math.sin(w) * 1.2, 0, -Math.cos(w) * 1.2);
      add(m.bunt, new THREE.ConeGeometry(0.045, 0.32, 8).rotateX(Math.PI), M(p, kippen), { farbe: '#ff8a1e' });
      add(m.bunt, new THREE.SphereGeometry(0.05, 6, 4), M(p.clone().add(V(Math.cos(w) * -0.12, 0.12, Math.sin(w) * -0.12)), Q(), V(1, 1.6, 1)), { farbe: '#4caf3a' });
    }
    korb(add, m, 1.05, OBEN, 0.05);
    for (let i = 0; i < 4; i++) {
      add(m.bunt, new THREE.CapsuleGeometry(0.1, 0.22, 4, 10).rotateZ(Math.PI / 2), M(V(1.05 + (i % 2 - 0.5) * 0.24, OBEN + 0.3 + Math.floor(i / 2) * 0.12, 0.05 + (i - 1.5) * 0.08), Q(0, i * 0.5, 0)), { farbe: '#c98a3e' });
    }
    // Vor dem Stand: eine Kiste mit Kohlköpfen und zwei Kürbisse
    add(m.holz, new RoundedBoxGeometry(0.8, 0.42, 0.55, 2, 0.06), M(V(-1.9, 0.21, 0.9), Q(0, 0.3, 0)), { farbe: '#b08a64', uv: [1, 0.4] });
    haufen(add, m, m.bunt, -1.9, 0.36, 0.9, { anzahl: 5, r: 0.14, breit: 0.2, farben: ['#8fd45a', '#6cbf44'], zufall: z });
    for (const [x, zz, r] of [[1.95, 0.9, 0.26], [2.3, 0.55, 0.2]]) {
      add(m.bunt, new THREE.SphereGeometry(r, 14, 10), M(V(x, r * 0.75, zz), Q(), V(1, 0.75, 1)), { farbe: '#ff8a1e', verlauf: [0.8, 1] });
      add(m.bunt, new THREE.CylinderGeometry(0.025, 0.035, 0.12, 6), M(V(x, r * 1.5 + 0.04, zz), Q(0.2, 0, 0.2)), { farbe: '#4a7a2a' });
    }
  },

  kaffee(add, m) {
    // Die große Kaffeekanne aus Kupfer
    const kx = -0.95;
    add(m.glanz, dreh([[0, 0], [0.18, 0], [0.21, 0.1], [0.2, 0.26], [0.13, 0.38], [0.09, 0.42], [0.11, 0.45], [0, 0.47]], 18), M(V(kx, OBEN, 0)), { farbe: '#d98a4a' });
    add(m.glanz, new THREE.CylinderGeometry(0.025, 0.04, 0.3, 8), M(V(kx + 0.25, OBEN + 0.28, 0), Q(0, 0, -0.8)), { farbe: '#d98a4a' });
    add(m.glanz, new THREE.TorusGeometry(0.12, 0.025, 6, 14, Math.PI * 1.2), M(V(kx - 0.2, OBEN + 0.22, 0), Q(0, 0, Math.PI * 0.45)), { farbe: '#8a5a2a' });
    add(m.glanz, new THREE.SphereGeometry(0.04, 8, 6), M(V(kx, OBEN + 0.5, 0)), { farbe: '#8a5a2a' });
    // Tassen auf Untertassen, mit Kaffee drin
    for (let i = 0; i < 4; i++) {
      const x = -0.3 + i * 0.36, zz = (i % 2) * 0.14;
      add(m.bunt, new THREE.CylinderGeometry(0.13, 0.11, 0.025, 14), M(V(x, OBEN + 0.012, zz)), { farbe: '#fff6e4' });
      add(m.bunt, dreh([[0, 0], [0.06, 0], [0.085, 0.04], [0.09, 0.13], [0, 0.13]], 14), M(V(x, OBEN + 0.025, zz)), { farbe: i % 2 ? '#fff6e4' : '#e8473a' });
      add(m.bunt, new THREE.CircleGeometry(0.08, 12).rotateX(-Math.PI / 2), M(V(x, OBEN + 0.15, zz)), { farbe: '#5a3218' });
      add(m.bunt, new THREE.TorusGeometry(0.035, 0.012, 5, 10), M(V(x + 0.1, OBEN + 0.09, zz)), { farbe: '#fff6e4' });
    }
    // Ein Glas mit Kaffeebohnen
    add(m.glanz, dreh([[0, 0], [0.11, 0], [0.12, 0.05], [0.12, 0.24], [0.09, 0.27], [0, 0.27]], 14), M(V(1.15, OBEN, 0.05)), { farbe: '#cfe8ff' });
    add(m.bunt, new THREE.CylinderGeometry(0.1, 0.1, 0.05, 14), M(V(1.15, OBEN + 0.29, 0.05)), { farbe: '#e8473a' });
    // Vor dem Stand: zwei dicke Kaffeesäcke
    for (const [x, zz, w] of [[-2.0, 0.8, 0.3], [2.05, 0.75, -0.4]]) {
      add(m.bunt, new THREE.SphereGeometry(0.34, 14, 10), M(V(x, 0.36, zz), Q(0, w, 0), V(1, 1.15, 0.85)), { farbe: '#c9a978', verlauf: [0.75, 1] });
      add(m.bunt, new THREE.TorusGeometry(0.1, 0.035, 5, 10).rotateX(Math.PI / 2), M(V(x, 0.74, zz)), { farbe: '#8a6a40' });
      add(m.bunt, new THREE.ConeGeometry(0.12, 0.16, 8), M(V(x, 0.84, zz)), { farbe: '#c9a978' });
    }
  },

  limo(add, m, z) {
    // Zwei große Glaskrüge voll leuchtender Nacht-Limo
    for (const x of [-1.05, -0.45]) {
      add(m.limo, dreh([[0, 0], [0.15, 0], [0.19, 0.12], [0.19, 0.36], [0.12, 0.46], [0.11, 0.52], [0, 0.52]], 16), M(V(x, OBEN, 0)));
      add(m.bunt, new THREE.TorusGeometry(0.1, 0.03, 5, 12, Math.PI * 1.1), M(V(x + 0.2, OBEN + 0.28, 0), Q(0, 0, -Math.PI * 0.55)), { farbe: '#cfe8ff' });
      add(m.bunt, new THREE.CylinderGeometry(0.12, 0.12, 0.04, 14), M(V(x, OBEN + 0.54, 0)), { farbe: '#e8473a' });
    }
    // Eine Reihe Flaschen mit Mond-Etikett
    for (let i = 0; i < 4; i++) {
      const x = 0.15 + i * 0.22;
      add(m.limo, dreh([[0, 0], [0.06, 0], [0.065, 0.16], [0.03, 0.24], [0.025, 0.3], [0, 0.3]], 12), M(V(x, OBEN, 0.15)));
      add(m.bunt, new THREE.CylinderGeometry(0.03, 0.03, 0.04, 8), M(V(x, OBEN + 0.31, 0.15)), { farbe: '#e8473a' });
      add(m.bunt, new THREE.CircleGeometry(0.04, 10), M(V(x, OBEN + 0.09, 0.216)), { farbe: '#4148c0' });
      add(m.bunt, new THREE.CircleGeometry(0.022, 10, -0.6, Math.PI * 1.2), M(V(x + 0.005, OBEN + 0.095, 0.218)), { farbe: '#fff3a6' });
    }
    // Ein Korb Zitronen
    korb(add, m, 1.15, OBEN, -0.05, 0.26, 0.18);
    haufen(add, m, m.bunt, 1.15, OBEN + 0.08, -0.05, { anzahl: 8, r: 0.075, breit: 0.18, farben: ['#ffe347', '#ffd21a'], skala: V(1.25, 1, 1), zufall: z });
    // Vor dem Stand: ein Fass und eine halbe Zitrone als Sitzhocker (zum Lachen)
    add(m.holz, dreh([[0, 0], [0.3, 0], [0.36, 0.35], [0.3, 0.7], [0, 0.7]], 16), M(V(-2.0, 0, 0.8)), { farbe: '#b08a64', uv: [3, 1] });
    for (const y of [0.12, 0.58]) add(m.glanz, new THREE.TorusGeometry(0.33, 0.025, 5, 18).rotateX(Math.PI / 2), M(V(-2.0, y, 0.8)), { farbe: '#7a7f88' });
    add(m.bunt, new THREE.SphereGeometry(0.32, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), M(V(2.05, 0, 0.75)), { farbe: '#ffd21a' });
    add(m.bunt, new THREE.CircleGeometry(0.3, 16).rotateX(-Math.PI / 2), M(V(2.05, 0.01, 0.75)), { farbe: '#fff6c0' });
  },

  steine(add, m, z) {
    // Kristalle: sechseckige Säulen mit Spitze, in Grüppchen (Edelsteine)
    const kristall = (x, zz, farbe) => {
      for (let i = 0; i < 4; i++) {
        const h = 0.16 + z() * 0.14, r = 0.04 + z() * 0.02;
        const kipp = Q((z() - 0.5) * 0.9, z() * 3, (z() - 0.5) * 0.9);
        const fuss = V(x + (z() - 0.5) * 0.14, OBEN, zz + (z() - 0.5) * 0.14);
        const oben = V(0, h, 0).applyQuaternion(kipp).add(fuss);
        add(m.glanz, new THREE.CylinderGeometry(r, r, h, 6), M(fuss.clone().lerp(oben, 0.5), kipp), { farbe });
        add(m.glanz, new THREE.ConeGeometry(r, r * 2, 6), M(oben.clone().add(V(0, r, 0).applyQuaternion(kipp)), kipp), { farbe });
      }
    };
    kristall(-1.1, 0.05, '#5fd8f5');
    kristall(-0.7, -0.1, '#b070f0');
    // Eine Schale mit Goldnuggets
    add(m.holz, new THREE.SphereGeometry(0.24, 14, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), M(V(-0.05, OBEN + 0.2, 0.05)), { farbe: '#9a6a3a', uv: [2, 0.5] });
    haufen(add, m, m.glanz, -0.05, OBEN + 0.06, 0.05, { anzahl: 8, r: 0.065, breit: 0.15, farben: ['#ffcb2e', '#f0b020'], skala: V(1.2, 0.8, 1), zufall: z });
    // Eisenerz (rostig) und Kohle (schwarz) in Körben
    korb(add, m, 0.6, OBEN, 0.05, 0.25, 0.16);
    haufen(add, m, m.bunt, 0.6, OBEN + 0.06, 0.05, { anzahl: 7, r: 0.08, breit: 0.16, farben: ['#a8624a', '#8a5a4a', '#7a6a62'], skala: V(1.2, 0.8, 1), zufall: z });
    korb(add, m, 1.15, OBEN, -0.05, 0.25, 0.16);
    haufen(add, m, m.bunt, 1.15, OBEN + 0.06, -0.05, { anzahl: 7, r: 0.08, breit: 0.16, farben: ['#2a2c30', '#3a3d44'], skala: V(1.2, 0.8, 1), zufall: z });
    // Vor dem Stand: eine Kiste voller Steine und eine Spitzhacke, die an der Theke lehnt
    add(m.holz, new RoundedBoxGeometry(0.8, 0.42, 0.55, 2, 0.06), M(V(-1.95, 0.21, 0.85), Q(0, -0.25, 0)), { farbe: '#b08a64', uv: [1, 0.4] });
    haufen(add, m, m.bunt, -1.95, 0.36, 0.85, { anzahl: 6, r: 0.12, breit: 0.2, farben: ['#bcb4a8', '#a8a29a'], skala: V(1.2, 0.8, 1), zufall: z });
    const hacke = M(V(1.75, 0, 0.62), Q(0, 0, 0.28));
    add(m.holz, new THREE.CylinderGeometry(0.035, 0.04, 1.1, 8), hacke.clone().multiply(M(V(0, 0.55, 0))), { farbe: '#c49a6c', uv: [0.3, 1] });
    add(m.glanz, new THREE.TorusGeometry(0.32, 0.04, 6, 14, Math.PI * 0.75), hacke.clone().multiply(M(V(0, 0.82, 0), Q(0, 0, Math.PI * 0.125))), { farbe: '#8794a3' });
  },
};

// ---------- Ein Marktstand ----------
// platz = wo der Stand steht; die Theke zeigt nach +z (zum Dorfplatz)
function marktstand(bs, m, platz, art, z) {
  const add = (material, geo, lokal, extra) => bs.add(material, geo, platz.clone().multiply(lokal), extra);
  // Theke: weiche, runde Kanten
  add(m.holz, new RoundedBoxGeometry(3.2, 0.9, 1.0, 3, 0.14), M(V(0, 0.45, 0)), { farbe: '#c49a6c', uv: [1.5, 0.5], verlauf: [0.75, 1] });
  add(m.holz, new RoundedBoxGeometry(3.45, 0.12, 1.2, 2, 0.05), M(V(0, 0.96, 0.02)), { farbe: '#d8b48a', uv: [1.6, 0.6] });
  // Vorne hängen Stoffbögen in den Standfarben
  for (let i = 0; i < 4; i++) {
    add(m.bunt, new THREE.CircleGeometry(0.4, 14, Math.PI, Math.PI), M(V(-1.2 + i * 0.8, 0.88, 0.515)), { farbe: i % 2 ? art.farbe2 : art.farbe });
  }
  // Vier Pfosten
  for (const x of [-1.55, 1.55]) {
    for (const zz of [-0.62, 0.62]) {
      add(m.holz, new THREE.CylinderGeometry(0.07, 0.09, 2.7, 8), M(V(x, 1.35, zz)), { farbe: '#b08a64', uv: [0.3, 1] });
    }
  }
  // Die Markise: ein runder, gestreifter Bogen (Streifen von vorne nach hinten)
  const R = 0.95, laenge = 3.7, streifen = 9, flach = V(1, 0.6, 1);
  for (let i = 0; i < streifen; i++) {
    const x = -laenge / 2 + (i + 0.5) * (laenge / streifen);
    const geo = new THREE.CylinderGeometry(R, R, laenge / streifen, 16, 1, true, 0, Math.PI).rotateZ(Math.PI / 2);
    add(m.bunt, geo, M(V(x, 2.7, 0), Q(), flach), { farbe: i % 2 ? '#fff6e4' : art.farbe });
  }
  for (const s of [-1, 1]) {
    add(m.bunt, new THREE.CircleGeometry(R, 16, 0, Math.PI).rotateY(Math.PI / 2), M(V(s * laenge / 2, 2.7, 0), Q(), flach), { farbe: art.farbe });
  }
  // Wellen-Kante vorne und hinten (kleine Halbkreise)
  for (const seite of [1, -1]) {
    for (let i = 0; i < 9; i++) {
      add(m.bunt, new THREE.CircleGeometry(0.205, 10, Math.PI, Math.PI), M(V(-laenge / 2 + (i + 0.5) * (laenge / 9), 2.7, seite * (R + 0.005)), Q(0, seite > 0 ? 0 : Math.PI, 0)), { farbe: i % 2 ? art.farbe : art.farbe2 });
    }
  }
  // Ein Knubbel oben drauf
  add(m.bunt, new THREE.SphereGeometry(0.1, 10, 8), M(V(-laenge / 2, 2.7 + R * 0.6, 0)), { farbe: art.farbe2 });
  add(m.bunt, new THREE.SphereGeometry(0.1, 10, 8), M(V(laenge / 2, 2.7 + R * 0.6, 0)), { farbe: art.farbe2 });
  WAREN[art.id](add, m, z);
}

// ---------- Die Schilder: alle vier auf EINEM Bild (spart Malbefehle) ----------
function schilderMaterial(texte) {
  const leinwand = document.createElement('canvas');
  leinwand.width = 1024;
  leinwand.height = 256;
  const g = leinwand.getContext('2d');
  texte.forEach((text, i) => {
    const x = (i % 2) * 512, y = Math.floor(i / 2) * 128;
    // ein Holzbrett mit runden Ecken
    g.beginPath();
    g.roundRect(x + 6, y + 6, 500, 116, 50);
    g.fillStyle = '#9a6a3a';
    g.fill();
    g.lineWidth = 8;
    g.strokeStyle = '#5a3a20';
    g.stroke();
    g.fillStyle = '#fff6e0';
    g.font = `bold ${text.length > 10 ? 50 : 62}px Trebuchet MS, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, x + 256, y + 66);
  });
  const t = new THREE.CanvasTexture(leinwand);
  t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({ map: t, roughness: 0.9, alphaTest: 0.5 });
}

// Ein Schild-Brett, das nur sein Stück vom großen Schilder-Bild zeigt
function schildGeo(nummer, matrix) {
  const geo = new THREE.PlaneGeometry(1.9, 0.48);
  const uv = geo.attributes.uv;
  const spalte = nummer % 2, reihe = Math.floor(nummer / 2);
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, (spalte + uv.getX(i)) / 2, 1 - (reihe + 1 - uv.getY(i)) / 2);
  }
  return geo.applyMatrix4(matrix);
}

// ---------- Wimpelketten zwischen den Ständen ----------
function wimpelKette(bs, m, von, bis, durchhang, z) {
  const punkte = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    const p = von.clone().lerp(bis, t);
    p.y -= Math.sin(t * Math.PI) * durchhang; // in der Mitte hängt das Seil durch
    punkte.push(p);
  }
  const kurve = new THREE.CatmullRomCurve3(punkte);
  bs.add(m.bunt, new THREE.TubeGeometry(kurve, 24, 0.022, 4), new THREE.Matrix4(), { farbe: '#f6eedc' });
  // Die Fähnchen: unten rund statt spitz (Game Designer: nicht eckig!)
  const form = new THREE.Shape();
  form.moveTo(-0.17, 0);
  form.lineTo(0.17, 0);
  form.quadraticCurveTo(0.13, -0.24, 0, -0.36);
  form.quadraticCurveTo(-0.13, -0.24, -0.17, 0);
  const fahne = new THREE.ShapeGeometry(form, 6);
  const farben = ['#e8473a', '#ffc928', '#56b947', '#2bb3b0', '#5a6ae8', '#ff7a9a'];
  const weg = von.distanceTo(bis);
  const anzahl = Math.floor(weg / 0.75);
  const richtung = bis.clone().sub(von);
  const drehY = -Math.atan2(richtung.z, richtung.x);
  for (let i = 1; i < anzahl; i++) {
    const p = kurve.getPoint(i / anzahl);
    bs.add(m.bunt, fahne, M(p, Q(0, drehY, 0).multiply(Q((z() - 0.5) * 0.3, 0, 0))), { farbe: farben[i % farben.length] });
  }
}

// Eine Verkäufer-Figur als EIN Modell (ein Malbefehl statt sieben)
function verkaeufer(farben) {
  const { figur } = baueFigur(farben);
  figur.updateMatrixWorld(true);
  const teile = [];
  let material = null;
  figur.traverse((t) => {
    if (!t.isMesh) return;
    teile.push(t.geometry.clone().applyMatrix4(t.matrixWorld));
    material = t.material;
  });
  const mesh = new THREE.Mesh(mergeGeometries(teile), material);
  mesh.castShadow = true;
  return mesh;
}

export class Markt {
  constructor(szene, hindernisse, spiel) {
    // spiel = { rucksack, meldung, musik, tageszeit, elternElement, karte, ueberleben, ereignisse }
    this.spiel = spiel;
    this.hindernisse = hindernisse;
    this.interaktionen = [];
    this.haendlerListe = [];
    this.zeit = 0;
    this.aufgebaut = false;
    this.gemeldetTag = null;
    this.kartenStand = '';

    // Der Dorfplatz des Palmendorfs (wie in palmendorf.js)
    const insel = INSELN.find((I) => I.name === 'Palmeninsel' && I.dorfPlatz) || INSELN.slice(1).find((I) => I.dorfPlatz);
    const platz = insel.dorfPlatz;
    this.mitte = V(platz.x, platz.hoehe, platz.z);

    this.gruppe = new THREE.Group();
    this.gruppe.position.copy(this.mitte);
    this.gruppe.visible = false;
    const z = zufallMitSeed(3333);
    const m = materialien();
    this.limoMat = m.limo;
    const bs = new Bausatz();
    const schilder = [];
    this.figuren = [];
    this.stellen = []; // wo die Hindernisse hinkommen (erst am Markttag)
    const tageszeit = spiel.tageszeit;
    const oben = []; // Seil-Punkte für die Wimpelketten

    STAENDE.forEach((art, nummer) => {
      const w = THREE.MathUtils.degToRad(art.winkel);
      const pos = V(Math.cos(w) * art.abstand, 0, Math.sin(w) * art.abstand);
      pos.y = bodenHoehe(this.mitte.x + pos.x, this.mitte.z + pos.z) - this.mitte.y;
      const drehung = Math.atan2(-pos.x, -pos.z); // die Theke zeigt zur Dorfmitte
      const sp = M(pos, Q(0, drehung, 0));
      marktstand(bs, m, sp, art, z);
      schilder.push(schildGeo(nummer, sp.clone().multiply(M(V(0, 3.18, 0.98), Q(-0.12, 0, 0)))));
      oben.push(V(0, 3.0, 0.2).applyMatrix4(sp));

      // Hindernis: die Theke (kommt erst am Markttag dazu)
      const mitteStand = V(0, 0, -0.15).applyMatrix4(sp);
      this.stellen.push([this.mitte.x + mitteStand.x, this.mitte.z + mitteStand.z, 1.9]);

      // Der Verkäufer steht hinter der Theke
      const figur = verkaeufer(art.figur);
      figur.position.copy(V(0, 0, -0.85).applyMatrix4(sp));
      figur.rotation.y = drehung;
      figur.userData.grundY = figur.position.y;
      this.gruppe.add(figur);
      this.figuren.push(figur);

      // Der Händler dazu (verkauft NUR – ankaufen tut der normale Händler)
      const haendler = new Haendler(spiel, {
        name: art.name,
        bild: art.bild,
        fensterId: `markt-${art.id}-fenster`,
        kaufPreise: art.preise(),
        kauftProTag: 0,
        gruss: art.gruss,
      });
      const reiter = haendler.fenster.querySelector('.reiter');
      if (reiter) reiter.style.display = 'none';
      this.beiKaufMelden(haendler, art);
      this.haendlerListe.push(haendler);

      // Hier steht man zum Einkaufen (vor der Theke)
      const vorne = V(0, 0, 1.7).applyMatrix4(sp).add(this.mitte);
      this.interaktionen.push({
        pos: vorne,
        radius: E().handelRadius ?? 3.5,
        aktiv: () => this.aufgebaut,
        get bild() { return tageszeit.istNacht() ? '💤' : art.bild; },
        get text() { return tageszeit.istNacht() ? 'Geschlossen' : 'Einkaufen'; },
        ausfuehren: () => {
          if (tageszeit.istNacht()) spiel.meldung('💤 Der Stand ist zu. Die Verkäuferin und der Verkäufer schlafen schon!', 4);
          else haendler.oeffnen();
        },
      });
    });

    // Wimpelketten von Stand zu Stand
    for (let i = 0; i < oben.length - 1; i++) {
      wimpelKette(bs, m, oben[i], oben[i + 1], oben[i].distanceTo(oben[i + 1]) * 0.07, z);
    }
    bs.fertig(this.gruppe);
    const schildMesh = new THREE.Mesh(mergeGeometries(schilder), schilderMaterial(STAENDE.map((s) => s.schild)));
    schildMesh.castShadow = true;
    this.gruppe.add(schildMesh);
    szene.add(this.gruppe);

    // Wo steht der Markt auf der Karte? (Mitte der Stände)
    this.kartenPos = this.stellen.reduce((s, [x, zz]) => s.add(V(x, 0, zz)), V(0, 0, 0)).multiplyScalar(1 / this.stellen.length);

    // Kaffee und Nacht-Limo trinken (Knopf "Trinken" im Rucksack)
    if (spiel.rucksack) spiel.rucksack.beimTrinken = (id) => this.trinken(id);
  }

  // Ist gerade Markt (Markttag UND Tag)?
  get istOffen() {
    return istMarkttag(this.spiel.tageszeit.tag) && !this.spiel.tageszeit.istNacht();
  }

  // Ist irgendein Markt-Fenster offen? (für main.js: fensterOffen)
  get offen() {
    return this.haendlerListe.some((h) => h.offen);
  }

  schliessen() {
    for (const h of this.haendlerListe) if (h.offen) h.schliessen();
  }

  // Für die Inselzeitung: Was gibt es auf dem Markt?
  angebote() {
    return STAENDE.flatMap((art) => Object.entries(art.preise()).map(([ding, preis]) => ({ stand: art.name, ding, preis })));
  }

  // Jeder Kauf kommt ins Ereignis-Protokoll (für die Zeitung)
  beiKaufMelden(haendler, art) {
    const kaufen = haendler.kaufen.bind(haendler);
    haendler.kaufen = (id, preis) => {
      const vorher = this.spiel.rucksack.muenzen;
      kaufen(id, preis);
      const bezahlt = vorher - this.spiel.rucksack.muenzen;
      if (bezahlt > 0) this.spiel.ereignisse?.melde('markt-kauf', { ding: id, preis: bezahlt, stand: art.id });
    };
  }

  // Aufbauen oder abbauen (Hindernisse dazu / weg)
  aufbauen(an) {
    this.aufgebaut = an;
    if (an) this.hindernisListe = this.stellen.map(([x, zz, r]) => this.hindernisse.hinzufuegen(x, zz, r));
    else {
      for (const h of this.hindernisListe || []) this.hindernisse.entfernen(h);
      this.hindernisListe = [];
      this.schliessen();
    }
  }

  // ---------- Trinken (rucksack.beimTrinken) ----------
  // Rückgabe false = geht gerade nicht, das Getränk bleibt im Rucksack
  trinken(id) {
    const { meldung, tageszeit, ueberleben, musik, rucksack } = this.spiel;
    if (id === 'kaffee') {
      if (ueberleben && !ueberleben.kaffeeGetrunken()) {
        meldung('☕ Du bist noch hellwach vom letzten Kaffee! Heb ihn dir für später auf.', 4);
        return false;
      }
      musik?.pling?.();
      meldung('☕ Schlürf … Du bist hellwach! Die nächste Nacht ohne Schlaf zählt nicht.', 5);
      this.spiel.ereignisse?.melde('kaffee', { tag: tageszeit.tag });
      return true;
    }
    if (id === 'nachtLimo') {
      if (tageszeit.helleNacht) {
        meldung('🍋 Diese Nacht wird doch schon hell! Heb dir die Limo auf.', 4);
        return false;
      }
      tageszeit.starteHelleNacht();
      ueberleben?.limoGetrunken();
      musik?.pling?.();
      if (tageszeit.istNacht()) {
        meldung('🍋 Blubb, blubb … Schau mal: Die Nacht wird taghell!', 5);
        rucksack?.schliessen(); // damit man sieht, wie es hell wird
      } else {
        meldung('🍋 Blubb, blubb … Heute Nacht wird es taghell!', 5);
      }
      this.spiel.ereignisse?.melde('limo', { tag: tageszeit.tag });
      return true;
    }
    return true;
  }

  // Nachts schlafen die Verkäufer (main.js ruft das beim Wechsel Tag/Nacht auf)
  setzeNacht(nacht) {
    for (const f of this.figuren) f.visible = !nacht;
    if (nacht) this.schliessen();
  }

  aktualisiere(dt, helligkeit, spielerPos) {
    const { tageszeit, karte, meldung } = this.spiel;
    this.zeit += dt;
    const tag = tageszeit.tag;
    const markttag = istMarkttag(tag);
    if (markttag !== this.aufgebaut) this.aufbauen(markttag);

    // Morgens am Markttag: Meldung (nur einmal pro Markttag)
    if (markttag && !tageszeit.istNacht() && this.gemeldetTag !== tag) {
      this.gemeldetTag = tag;
      const entdeckt = karte?.entdeckteInseln?.includes('Palmeninsel');
      setTimeout(() => meldung(entdeckt
        ? '🛒 Heute ist Wochenmarkt im Palmendorf!'
        : '🛒 Heute ist Wochenmarkt – irgendwo auf einer anderen Insel …', 6), (E().meldungNachSekunden ?? 7) * 1000);
    }

    // Karte: Markt-Punkt nur am Markttag (und erst, wenn man die Palmeninsel kennt)
    if (karte) {
      const sichtbar = markttag && !!karte.entdeckteInseln?.includes('Palmeninsel');
      const stand = String(sichtbar);
      if (stand !== this.kartenStand) {
        this.kartenStand = stand;
        karte.punkt('markt', { name: 'Markt', bild: '🛒', x: this.kartenPos.x, z: this.kartenPos.z, sichtbar });
      }
    }

    // Weit weg oder kein Markttag? Dann gar nicht malen
    const abstand = Math.hypot(spielerPos.x - this.mitte.x, spielerPos.z - this.mitte.z);
    this.gruppe.visible = markttag && abstand < (E().sichtweite ?? 320);
    if (!this.gruppe.visible) return;

    // Die Nacht-Limo leuchtet nachts stärker
    this.limoMat.emissiveIntensity = 0.2 + (1 - helligkeit) * 1.4;
    // Die Verkäufer wippen und schauen zur Figur, wenn sie nah ist
    this.figuren.forEach((f, i) => {
      f.position.y = f.userData.grundY + Math.abs(Math.sin(this.zeit * 2 + i)) * 0.04;
      if (f.visible && abstand < 30) {
        const ziel = spielerPos.clone().sub(this.gruppe.position);
        f.rotation.y = Math.atan2(ziel.x - f.position.x, ziel.z - f.position.z);
      }
    });
  }

  // Für den Spielstand (die Wirkung von Kaffee & Limo speichern ueberleben.js und tageszeit.js)
  alsDaten() {
    return { gemeldetTag: this.gemeldetTag };
  }

  ladeDaten(d = {}) {
    this.gemeldetTag = d.gemeldetTag ?? null;
  }
}
