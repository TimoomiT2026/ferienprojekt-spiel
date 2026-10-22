// =============================================================
//  DIE BASE – dein Zuhause auf der Insel
//  Am Anfang ist es nur ein kleines Zelt. Mit Holz, Steinen und
//  Münzen baust du es Stufe für Stufe aus:
//    1 Zelt → 2 großes Zelt → 3 Holzhütte (mit Truhe)
//    → 4 Hütte mit Garten → 5 Haus mit Fischteich
//  Was jede Stufe kostet, steht in einstellungen.js unter "Base".
//
//  Trick fürs iPad (wie im Dorf): Alle Teile mit demselben Material
//  kleben wir zu EINEM Modell zusammen → nur ca. 12 Malbefehle.
// =============================================================
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { EINSTELLUNGEN } from './einstellungen.js';
import { bodenHoehe, abstandZumDorf, DORF, WASSER_HOEHE } from './gelaende.js';
import { DINGE } from './rucksack.js';
import { BILDER, muenzeKlein } from './bilder.js';
import { knopf } from './steuerung.js';
import { textur } from './texturen.js';
import { zufallMitSeed } from './rauschen.js';

// ---------- Wo steht alles? ----------
const ORT = { x: 7, z: -5.5 }; // Mitte vom Zelt / Haus
const DREHUNG = -0.6; // die Tür zeigt zum Startplatz
const TEICH = { x: 3.05, z: -11.2, r: 2.2 }; // Fischteich (ab Stufe 5)
const STEG_RICHTUNG = new THREE.Vector2(-0.29, 0.96).normalize(); // der Steg zeigt zum Lagerfeuer
const STALL = { x: 9, z: 6, winkel: Math.PI }; // Pferdestall auf der anderen Seite vom Weg

// Die 5 Stufen: Name, Bild, was kann man da?
// radius = wie dick das Haus für die Figur ist, tuer = wie weit die Tür von der Mitte weg ist
const STUFEN = [
  null,
  { name: 'Zelt', bild: BILDER.zelt, text: 'Ein kleines Zelt. Hier kannst du nachts schlafen.', radius: 1.9, tuer: 2.2 },
  { name: 'Großes Zelt', bild: BILDER.zeltGross, text: 'Viel Platz und ein Vordach gegen Regen.', radius: 2.5, tuer: 3.4 },
  { name: 'Holzhütte', bild: BILDER.huette, text: 'Eine echte Hütte! Mit Truhe 📦 für deine Schätze.', radius: 2.7, tuer: 2.6 },
  { name: 'Hütte mit Garten', bild: BILDER.huetteGarten, text: 'Mit Kamin – und im Garten wachsen Karotten 🥕.', radius: 2.8, tuer: 2.7 },
  { name: 'Haus mit Fischteich', bild: BILDER.haus, text: 'Ein richtiges Haus! Am Teich kannst du angeln 🎣.', radius: 3.2, tuer: 3.25 },
];

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const Q = (x = 0, y = 0, z = 0) => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z));
const M = (pos, rot = Q(), skala = V(1, 1, 1)) => new THREE.Matrix4().compose(pos, rot, skala);
const kiste = (b, h, t) => new THREE.BoxGeometry(b, h, t);
const rolle = (r, h, seiten = 10) => new THREE.CylinderGeometry(r, r, h, seiten);
const klemme = THREE.MathUtils.clamp;

// Ein Stab von Punkt a nach Punkt b (für Seile, Stangen, Pfosten)
function stabMatrix(a, b) {
  const richtung = b.clone().sub(a);
  const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), richtung.clone().normalize());
  return M(a.clone().lerp(b, 0.5), q, V(1, richtung.length(), 1));
}

// ---------- Der Bausatz sammelt alle Teile, sortiert nach Material ----------
// (Dieselbe Idee wie im Dorf: am Ende wird pro Material EIN Modell daraus.)
class Bausatz {
  constructor() {
    this.teile = new Map();
  }
  // farbe = Tönung, uv = wie oft das Bild wiederholt wird, verlauf = [unten, oben] Helligkeit
  add(material, geo, matrix, { farbe = '#ffffff', uv = [1, 1], verlauf = null } = {}) {
    const g = geo.clone();
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    const t = g.attributes.uv;
    for (let i = 0; i < t.count; i++) t.setXY(i, t.getX(i) * uv[0], t.getY(i) * uv[1]);
    const c = new THREE.Color(farbe);
    const p = g.attributes.position;
    const f = new Float32Array(p.count * 3);
    if (!g.boundingBox) g.computeBoundingBox();
    const { min, max } = g.boundingBox;
    for (let i = 0; i < p.count; i++) {
      const h = verlauf ? THREE.MathUtils.lerp(verlauf[0], verlauf[1], Math.sqrt((p.getY(i) - min.y) / (max.y - min.y || 1))) : 1;
      f.set([c.r * h, c.g * h, c.b * h], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(f, 3));
    if (!g.index) g.setIndex([...Array(g.attributes.position.count).keys()]);
    g.applyMatrix4(matrix);
    if (!this.teile.has(material)) this.teile.set(material, []);
    this.teile.get(material).push(g);
  }
  // Alles zusammenkleben: ein Modell pro Material
  fertig(gruppe) {
    for (const [material, liste] of this.teile) {
      const mesh = new THREE.Mesh(mergeGeometries(liste), material);
      liste.forEach((g) => g.dispose());
      mesh.castShadow = !material.userData.keinSchatten;
      mesh.receiveShadow = true;
      gruppe.add(mesh);
    }
  }
}

// ---------- Bilder, die wir selbst malen ----------
// Zeltstoff: hell (wird eingefärbt), mit Nähten
function stoffBild() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#f4f0e8';
  g.fillRect(0, 0, 256, 128);
  const z = zufallMitSeed(7);
  for (let i = 0; i < 900; i++) {
    g.fillStyle = `rgba(0,0,0,${z() * 0.05})`;
    g.fillRect(z() * 256, z() * 128, 2, 2);
  }
  g.strokeStyle = 'rgba(80,60,40,0.35)';
  g.lineWidth = 2;
  for (let x = 0; x <= 256; x += 64) {
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x, 128);
    g.stroke();
    g.setLineDash([3, 4]); // Stich-Linie neben der Naht
    g.beginPath();
    g.moveTo(x + 5, 0);
    g.lineTo(x + 5, 128);
    g.stroke();
    g.setLineDash([]);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// Ein weicher, runder Fleck für Rauch und Staub
function wolkenBild() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const verlauf = g.createRadialGradient(32, 32, 2, 32, 32, 31);
  verlauf.addColorStop(0, 'rgba(255,255,255,0.9)');
  verlauf.addColorStop(0.5, 'rgba(255,255,255,0.4)');
  verlauf.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = verlauf;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Das Holzschild "BASE" mit Sternen für die Stufe
function maleSchild(leinwand, stufe) {
  const g = leinwand.getContext('2d');
  g.fillStyle = '#9a6a3c';
  g.fillRect(0, 0, 256, 128);
  g.strokeStyle = 'rgba(60,35,15,0.3)';
  for (let i = 0; i < 12; i++) {
    g.beginPath();
    g.moveTo(0, 6 + i * 10);
    g.bezierCurveTo(80, 2 + i * 10, 170, 12 + i * 10, 256, 6 + i * 10);
    g.stroke();
  }
  g.strokeStyle = '#5a3a20';
  g.lineWidth = 8;
  g.strokeRect(4, 4, 248, 120);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = '#fff6e0';
  g.font = 'bold 50px Trebuchet MS, sans-serif';
  g.fillText('BASE', 128, 48);
  g.font = 'bold 30px sans-serif';
  for (let i = 0; i < 5; i++) {
    g.fillStyle = i < stufe ? '#ffd23d' : 'rgba(255,255,255,0.3)';
    g.fillText('★', 68 + i * 30, 96);
  }
}

// ---------- Die Materialien (einmal gebaut, für alle Stufen) ----------
function materialien() {
  const bild = (n) => ({ map: textur(n) });
  const normal = (n, s = 1) => ({ normalMap: textur(n, { farbe: false }), normalScale: new THREE.Vector2(s, s) });
  const schildLeinwand = document.createElement('canvas');
  schildLeinwand.width = 256;
  schildLeinwand.height = 128;
  const schildBild = new THREE.CanvasTexture(schildLeinwand);
  schildBild.colorSpace = THREE.SRGBColorSpace;
  const m = {
    stoff: new THREE.MeshStandardMaterial({ map: stoffBild(), vertexColors: true, roughness: 0.9, side: THREE.DoubleSide }),
    putz: new THREE.MeshStandardMaterial({ ...bild('putz.jpg'), ...normal('putz_normal.jpg', 0.8), vertexColors: true, roughness: 0.95 }),
    balken: new THREE.MeshStandardMaterial({ ...bild('bretter.jpg'), ...normal('bretter_normal.jpg'), vertexColors: true, roughness: 0.9 }),
    planken: new THREE.MeshStandardMaterial({ ...bild('planken.jpg'), ...normal('bretter_normal.jpg', 0.7), vertexColors: true, roughness: 0.85 }),
    reet: new THREE.MeshStandardMaterial({ ...bild('reet.jpg'), ...normal('reet_normal.jpg', 1.3), vertexColors: true, roughness: 1, side: THREE.DoubleSide }),
    ziegel: new THREE.MeshStandardMaterial({ ...bild('ziegel.jpg'), ...normal('ziegel_normal.jpg', 1.4), vertexColors: true, roughness: 0.8, side: THREE.DoubleSide }),
    stein: new THREE.MeshStandardMaterial({ ...bild('fels.jpg'), ...normal('fels_normal.jpg'), vertexColors: true, roughness: 0.95 }),
    bunt: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 }),
    metall: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.7 }),
    // Fenster und Laternen leuchten nachts (siehe aktualisiere)
    fenster: new THREE.MeshStandardMaterial({ color: '#7a6a4a', emissive: '#ffb347', emissiveIntensity: 0, roughness: 0.2, metalness: 0.1 }),
    wasser: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.06, metalness: 0.25 }),
    schild: new THREE.MeshStandardMaterial({ map: schildBild, roughness: 0.9 }),
  };
  m.schildLeinwand = schildLeinwand;
  m.fenster.userData.keinSchatten = true;
  m.wasser.userData.keinSchatten = true;
  m.schild.userData.keinSchatten = true;
  return m;
}

// =============================================================
//  DIE BAUTEILE
//  Jede Funktion bekommt den Bausatz (bs), die Materialien (m)
//  und eine "platz"-Matrix: wo das Teil stehen soll.
// =============================================================

// ---------- Kuppelzelt (rund, nicht eckig!) – Tür zeigt nach +z ----------
function kuppelZelt(bs, m, platz, o) {
  const add = (mat, geo, lokal, extra) => bs.add(mat, geo, platz.clone().multiply(lokal), extra);
  const [sx, sy, sz] = o.skala;
  const stangenMat = o.stangenMat || m.metall;
  add(m.stoff, new THREE.SphereGeometry(1, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), M(V(0, 0, 0), Q(), V(sx, sy, sz)), { farbe: o.farbe, uv: [6, 1], verlauf: [0.72, 1.05] });
  // Dunkler Eingang, der genau auf der Zeltwand liegt
  add(m.bunt, new THREE.SphereGeometry(1, 10, 6, Math.PI / 2 - 0.36, 0.72, Math.PI / 2 - 0.8, 0.8), M(V(0, 0, 0), Q(), V(sx * 1.012, sy * 1.012, sz * 1.012)), { farbe: '#3a2416' });
  // Die hochgerollte Tür-Plane
  const dy = Math.cos(Math.PI / 2 - 0.8), dz = Math.sin(Math.PI / 2 - 0.8);
  add(m.stoff, rolle(0.1, sx * 0.62, 10), M(V(0, sy * dy + 0.07, sz * dz + 0.06), Q(0, 0, Math.PI / 2)), { farbe: o.farbe2 || o.farbe, uv: [1, 0.5] });
  // Zwei Stangen über Kreuz, genau auf der Kuppel
  for (const w of [0.7, -0.7, ...(o.dreiStangen ? [Math.PI / 2] : [])]) {
    const r = 1 / Math.hypot(Math.cos(w) / sx, Math.sin(w) / sz);
    add(stangenMat, new THREE.TorusGeometry(1, 0.035, 6, 28, Math.PI), M(V(0, 0, 0), Q(0, w, 0), V(r * 1.01, sy * 1.015, 1)), { farbe: o.stangen || '#2e4b7a' });
  }
  // Spannseile mit Heringen
  for (const w of [0.8, 2.35, -0.8, -2.35]) {
    const oben = V(Math.sin(w) * sx * 0.82, sy * 0.55, Math.cos(w) * sz * 0.82);
    const unten = V(Math.sin(w) * sx * 1.45, 0.05, Math.cos(w) * sz * 1.45);
    add(m.bunt, rolle(0.012, 1, 4), stabMatrix(oben, unten), { farbe: '#efe6cf' });
    add(stangenMat, new THREE.ConeGeometry(0.04, 0.22, 5).rotateX(Math.PI), M(unten.clone().setY(0.06)), { farbe: '#9aa2a8' });
  }
  // Fußmatte vor der Tür
  add(m.bunt, new THREE.CircleGeometry(0.55, 20).rotateX(-Math.PI / 2), M(V(0, 0.025, sz + 0.55), Q(), V(1.2, 1, 0.7)), { farbe: o.matte || '#6a8a3a' });
}

// Eine kleine Laterne auf einem Pfosten
function laternenPfosten(bs, m, matrix, hoehe = 1.3) {
  const add = (mat, geo, lokal, extra) => bs.add(mat, geo, matrix.clone().multiply(lokal), extra);
  add(m.balken, rolle(0.05, hoehe, 6), M(V(0, hoehe / 2, 0)), { farbe: '#8a6a50', uv: [0.2, 1] });
  add(m.balken, kiste(0.35, 0.06, 0.06), M(V(0.15, hoehe - 0.05, 0)), { farbe: '#8a6a50', uv: [0.2, 0.1] });
  add(m.fenster, rolle(0.08, 0.2, 8), M(V(0.28, hoehe - 0.22, 0)));
  add(m.metall, new THREE.ConeGeometry(0.12, 0.12, 8), M(V(0.28, hoehe - 0.06, 0)), { farbe: '#2e2e2e' });
}

// Ein bauchiges Fass
function fass(bs, m, matrix) {
  const profil = [];
  for (let i = 0; i <= 8; i++) profil.push(new THREE.Vector2(0.3 + Math.sin((i / 8) * Math.PI) * 0.07, (i / 8) * 0.85));
  bs.add(m.planken, new THREE.LatheGeometry(profil, 12), matrix, { farbe: '#c9a27a', uv: [2, 1] });
  bs.add(m.planken, new THREE.CircleGeometry(0.31, 12).rotateX(-Math.PI / 2).translate(0, 0.85, 0), matrix, { farbe: '#a07a52' });
  for (const y of [0.15, 0.7]) bs.add(m.metall, new THREE.TorusGeometry(0.36, 0.018, 4, 16).rotateX(Math.PI / 2).translate(0, y, 0), matrix, { farbe: '#4a4a4a' });
}

// Ein Baumstamm zum Draufsitzen
function sitzStamm(bs, m, matrix) {
  bs.add(m.balken, rolle(0.22, 1.1, 10), matrix.clone().multiply(M(V(0, 0.22, 0), Q(0, 0, Math.PI / 2))), { farbe: '#7a5a40', uv: [1, 1] });
  for (const s of [-1, 1]) bs.add(m.bunt, new THREE.CircleGeometry(0.2, 10), matrix.clone().multiply(M(V(s * 0.555, 0.22, 0), Q(0, s * Math.PI / 2, 0))), { farbe: '#d9b98c' });
}

// ---------- Die Truhe: Kasten, runder Deckel, Eisenbänder, goldenes Schloss ----------
function truheModell(bs, m, matrix) {
  const add = (mat, geo, lokal, extra) => bs.add(mat, geo, matrix.clone().multiply(lokal), extra);
  add(m.planken, kiste(1.0, 0.5, 0.6), M(V(0, 0.27, 0)), { farbe: '#b07a42', uv: [1, 0.5] });
  const deckel = new THREE.CylinderGeometry(0.3, 0.3, 1.0, 14, 1, false, 0, Math.PI).rotateZ(Math.PI / 2);
  add(m.planken, deckel, M(V(0, 0.52, 0)), { farbe: '#9a6a38', uv: [1, 0.6] });
  for (const x of [-0.36, 0.36]) {
    add(m.metall, kiste(0.07, 0.5, 0.62), M(V(x, 0.27, 0)), { farbe: '#4a4a4a' });
    add(m.metall, new THREE.TorusGeometry(0.31, 0.025, 4, 14, Math.PI).rotateY(Math.PI / 2), M(V(x, 0.52, 0)), { farbe: '#4a4a4a' });
  }
  add(m.metall, kiste(0.14, 0.16, 0.05), M(V(0, 0.48, 0.31)), { farbe: '#e0b040' });
  add(m.stein, new THREE.CylinderGeometry(0.75, 0.8, 0.06, 12), M(V(0, 0.02, 0), Q(), V(1, 1, 0.65)), { farbe: '#a8a29a', uv: [1, 0.2] });
}

// ---------- Eine runde Hütte / ein rundes Haus – Tür zeigt nach +z ----------
// o = { r, wandH, wand: 'holz'|'putz', dach: 'reet'|'ziegel', dachFarbe, fenster: [Winkel], schornstein, blumen, fachwerk, vordach }
function rundHaus(bs, m, platz, o) {
  const add = (mat, geo, lokal, extra) => bs.add(mat, geo, platz.clone().multiply(lokal), extra);
  const { r, wandH } = o;
  const balkenFarbe = '#7a5a40';
  // Steinsockel
  add(m.stein, new THREE.CylinderGeometry(r + 0.12, r + 0.24, o.sockel, 28, 1, true), M(V(0, o.sockel / 2 - 0.05, 0)), { farbe: '#b8b0a4', uv: [6, 0.35], verlauf: [0.6, 1] });
  add(m.stein, new THREE.TorusGeometry(r + 0.12, 0.06, 4, 28).rotateX(Math.PI / 2), M(V(0, o.sockel - 0.05, 0)), { farbe: '#c8c0b4', uv: [8, 0.2] });
  // Die Wand
  if (o.wand === 'holz') {
    add(m.balken, new THREE.CylinderGeometry(r - 0.03, r, wandH, 28, 2, true), M(V(0, wandH / 2, 0)), { farbe: '#d8b48a', uv: [5, 1.2], verlauf: [0.7, 1] });
    // dicke, runde Eckpfosten (Baumstämme)
    for (let i = 0; i < 8; i++) {
      const w = (i / 8) * Math.PI * 2 + Math.PI / 8;
      add(m.balken, rolle(0.13, wandH + 0.1, 8), M(V(Math.sin(w) * (r + 0.04), (wandH + 0.1) / 2, Math.cos(w) * (r + 0.04))), { farbe: balkenFarbe, uv: [0.3, 1] });
    }
  } else {
    add(m.putz, new THREE.CylinderGeometry(r - 0.05, r, wandH, 28, 3, true), M(V(0, wandH / 2, 0)), { farbe: '#f2dcb4', uv: [5, 1.4], verlauf: [0.62, 1] });
    if (o.fachwerk) {
      const luecken = [0, ...o.fenster];
      for (let i = 0; i < 16; i++) {
        const w = (i / 16) * Math.PI * 2 + 0.2;
        if (luecken.some((l) => Math.abs(Math.atan2(Math.sin(w - l), Math.cos(w - l))) < 0.28)) continue;
        add(m.balken, kiste(0.16, wandH, 0.1), M(V(Math.sin(w) * (r + 0.01), wandH / 2, Math.cos(w) * (r + 0.01)), Q(0, w, 0)), { farbe: balkenFarbe, uv: [0.15, 1] });
      }
    }
  }
  for (const y of [o.sockel + 0.02, wandH + 0.02]) {
    add(m.balken, new THREE.TorusGeometry(r + 0.03, 0.09, 4, 28).rotateX(Math.PI / 2), M(V(0, y, 0)), { farbe: balkenFarbe, uv: [8, 0.2] });
  }
  // Tür mit Rahmen, Griff und Trittstein
  add(m.planken, kiste(0.95, 1.85, 0.08), M(V(0, 1.0 + o.sockel * 0.3, r + 0.02)), { farbe: o.tuerFarbe || '#8a5a34', uv: [0.6, 1] });
  for (const s of [-1, 1]) add(m.balken, kiste(0.14, 2.1, 0.18), M(V(s * 0.56, 1.05, r)), { farbe: balkenFarbe, uv: [0.15, 1] });
  add(m.balken, kiste(1.3, 0.18, 0.2), M(V(0, 2.12, r + 0.01)), { farbe: balkenFarbe, uv: [0.6, 0.15] });
  add(m.metall, new THREE.SphereGeometry(0.05, 8, 6), M(V(0.3, 1.05, r + 0.09)), { farbe: '#3a3a3a' });
  add(m.stein, new THREE.CylinderGeometry(0.6, 0.65, 0.16, 10), M(V(0, 0.05, r + 0.55)), { farbe: '#a8a29a', uv: [1, 0.2] });
  // Fenster: Glas, Rahmen, Sprossenkreuz, Fensterläden, Blumenkasten
  for (const w of o.fenster) {
    const dreh = Q(0, w, 0);
    const lokal = (x, y, zz) => M(V(Math.sin(w) * r, 0, Math.cos(w) * r).add(V(x, y, zz).applyQuaternion(dreh)), dreh);
    const fy = 1.55;
    add(m.fenster, new THREE.PlaneGeometry(0.66, 0.62), lokal(0, fy, 0.03));
    for (const [x, y, b, h] of [[0, fy + 0.34, 0.86, 0.08], [0, fy - 0.34, 0.9, 0.1], [-0.37, fy, 0.08, 0.72], [0.37, fy, 0.08, 0.72], [0, fy, 0.66, 0.04], [0, fy, 0.04, 0.62]]) {
      add(m.balken, kiste(b, h, 0.08), lokal(x, y, 0.06), { farbe: '#f2ead8', uv: [0.2, 0.2] });
    }
    for (const s of [-1, 1]) add(m.planken, kiste(0.36, 0.72, 0.05), lokal(s * 0.6, fy, 0.07), { farbe: o.laden || '#4f7f5a', uv: [0.3, 0.6] });
    if (o.blumen) {
      add(m.planken, kiste(0.8, 0.2, 0.22), lokal(0, fy - 0.48, 0.16), { farbe: '#9a6a44', uv: [1, 0.3] });
      const farben = ['#ff5c8a', '#ffd23d', '#ffffff', '#ff8a3d', '#c04dff'];
      for (let i = 0; i < 6; i++) {
        const gruen = i % 2 === 0;
        add(m.bunt, new THREE.IcosahedronGeometry(gruen ? 0.08 : 0.065, 0), lokal(-0.3 + i * 0.12, fy - 0.34, 0.16), { farbe: gruen ? '#3f7a2a' : farben[(i * 3 + Math.round(w * 10)) % farben.length] });
      }
    }
  }
  // Dach: Reet (dick und weich) oder Ziegel – beide leicht bauchig
  const dachR = r + 1.05, dachH = o.dachH;
  const dach = new THREE.ConeGeometry(dachR, dachH, 32, 4, true);
  const dp = dach.attributes.position;
  for (let i = 0; i < dp.count; i++) {
    const t = (dp.getY(i) + dachH / 2) / dachH;
    const bauch = 1 + Math.sin(t * Math.PI) * (o.dach === 'reet' ? 0.1 : 0.05);
    dp.setXYZ(i, dp.getX(i) * bauch, dp.getY(i), dp.getZ(i) * bauch);
  }
  dach.computeVertexNormals();
  if (o.dach === 'reet') {
    add(m.reet, dach, M(V(0, wandH + dachH / 2, 0)), { farbe: '#d8c8a8', uv: [7, 2] });
    add(m.reet, new THREE.TorusGeometry(dachR - 0.07, 0.2, 6, 32).rotateX(Math.PI / 2), M(V(0, wandH + 0.02, 0), Q(), V(1, 1, 0.8)), { farbe: '#bfae8c', uv: [10, 0.5] });
    add(m.reet, new THREE.SphereGeometry(0.32, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), M(V(0, wandH + dachH - 0.12, 0)), { farbe: '#a8987a' });
  } else {
    add(m.ziegel, dach, M(V(0, wandH + dachH / 2, 0)), { farbe: o.dachFarbe || '#c0644a', uv: [12, 3] });
    add(m.ziegel, new THREE.TorusGeometry(dachR - 0.05, 0.08, 4, 32).rotateX(Math.PI / 2), M(V(0, wandH + 0.02, 0)), { farbe: o.dachFarbe || '#c0644a', uv: [10, 0.2] });
    add(m.metall, new THREE.ConeGeometry(0.22, 0.5, 8), M(V(0, wandH + dachH - 0.05, 0)), { farbe: '#5a4a3a' });
    add(m.metall, new THREE.SphereGeometry(0.09, 8, 6), M(V(0, wandH + dachH + 0.25, 0)), { farbe: '#e0b040' });
  }
  // Vordach über der Tür (nur beim großen Haus)
  if (o.vordach) {
    for (const s of [-1, 1]) add(m.balken, rolle(0.08, 2.3, 8), M(V(s * 0.95, 1.15, r + 1.05)), { farbe: balkenFarbe, uv: [0.3, 1] });
    add(m.balken, kiste(2.2, 0.14, 0.14), M(V(0, 2.3, r + 1.05)), { farbe: balkenFarbe, uv: [1, 0.1] });
    const vd = new THREE.CylinderGeometry(1, 1, 2.4, 14, 1, true, 0, Math.PI).rotateZ(Math.PI / 2);
    add(m.ziegel, vd, M(V(0, 2.35, r + 0.55), Q(-0.1, 0, 0), V(1, 0.32, 0.72)), { farbe: o.dachFarbe || '#c0644a', uv: [4, 1] });
    // Bank unter dem Vordach
    add(m.planken, kiste(1.4, 0.08, 0.38), M(V(-1.55, 0.48, r + 0.55), Q(0, 0.35, 0)), { farbe: '#b48a60', uv: [0.8, 0.3] });
    for (const s of [-1, 1]) add(m.balken, kiste(0.1, 0.45, 0.32), M(V(-1.55 + s * 0.55 * Math.cos(0.35), 0.22, r + 0.55 - s * 0.55 * Math.sin(0.35)), Q(0, 0.35, 0)), { farbe: balkenFarbe, uv: [0.1, 0.3] });
  }
  // Schornstein aus Stein – muss durchs Dach gucken
  let rauchPunkt = null;
  if (o.schornstein) {
    const sx = -1.25, sz = -0.95, d = Math.hypot(sx, sz);
    const dachHier = wandH + dachH * (1 - d / dachR);
    const oben = dachHier + 1.1;
    add(m.stein, kiste(0.6, oben - wandH, 0.6), M(V(sx, (oben + wandH) / 2, sz)), { farbe: '#c0b4a6', uv: [0.5, 1.6] });
    add(m.stein, kiste(0.76, 0.16, 0.76), M(V(sx, oben, sz)), { farbe: '#9a9086', uv: [0.5, 0.1] });
    rauchPunkt = V(sx, oben + 0.15, sz).applyMatrix4(platz);
  }
  return rauchPunkt;
}

// ---------- Ein Zaun von a nach b (Pfosten + zwei Latten) ----------
function zaun(bs, m, a, b) {
  const laenge = a.distanceTo(b);
  const felder = Math.max(1, Math.round(laenge / 1.2));
  const w = Math.atan2(b.x - a.x, b.z - a.z);
  for (let i = 0; i <= felder; i++) {
    const p = a.clone().lerp(b, i / felder);
    bs.add(m.balken, rolle(0.06, 0.95, 6), M(V(p.x, a.y + 0.47, p.z)), { farbe: '#b89a7a', uv: [0.2, 1] });
    bs.add(m.balken, new THREE.SphereGeometry(0.065, 6, 4), M(V(p.x, a.y + 0.95, p.z)), { farbe: '#b89a7a' });
  }
  const mitte = a.clone().lerp(b, 0.5);
  for (const y of [0.38, 0.75]) {
    bs.add(m.balken, kiste(0.05, 0.09, laenge), M(V(mitte.x, a.y + y, mitte.z), Q(0, w, 0)), { farbe: '#c4a888', uv: [1, laenge / 2] });
  }
}

// ---------- Der Garten: Hochbeet mit Erde, Salat, Zaun und Vogelscheuche ----------
function garten(bs, m, platz) {
  const add = (mat, geo, lokal, extra) => bs.add(mat, geo, platz.clone().multiply(lokal), extra);
  const B = 3.4, T = 2.2;
  for (const s of [-1, 1]) {
    add(m.planken, kiste(B + 0.16, 0.32, 0.08), M(V(0, 0.16, s * (T / 2 + 0.04))), { farbe: '#9a6a44', uv: [2, 0.3] });
    add(m.planken, kiste(0.08, 0.32, T), M(V(s * (B / 2 + 0.04), 0.16, 0)), { farbe: '#9a6a44', uv: [1.2, 0.3] });
  }
  add(m.bunt, kiste(B, 0.26, T), M(V(0, 0.13, 0)), { farbe: '#5b3a24' });
  // Erd-Reihen (kleine Hügelchen)
  for (const zz of [-0.55, 0.05, 0.65]) add(m.bunt, rolle(0.12, B - 0.2, 8), M(V(0, 0.27, zz), Q(0, 0, Math.PI / 2), V(1, 1, 0.6)), { farbe: '#6b4630' });
  // Salatköpfe in der hinteren Reihe
  for (let i = 0; i < 5; i++) {
    add(m.bunt, new THREE.IcosahedronGeometry(0.17, 1), M(V(-1.3 + i * 0.65, 0.38, 0.65), Q(0, i, 0), V(1, 0.75, 1)), { farbe: i % 2 ? '#7fc04a' : '#5fa83a' });
  }
  // Zaun drumherum, vorne (zum Haus) eine Lücke als Eingang
  const e = [V(-2.3, 0, -1.7), V(-2.3, 0, 1.7), V(-0.7, 0, 1.7), V(0.7, 0, 1.7), V(2.3, 0, 1.7), V(2.3, 0, -1.7)].map((p) => p.applyMatrix4(platz));
  zaun(bs, m, e[0], e[5]);
  zaun(bs, m, e[0], e[1]);
  zaun(bs, m, e[1], e[2]);
  zaun(bs, m, e[3], e[4]);
  zaun(bs, m, e[4], e[5]);
  // Vogelscheuche – die passt auf die Karotten auf!
  const vs = (x, y, zz) => M(V(-1.9 + x, y, -1.25 + zz));
  add(m.balken, rolle(0.05, 1.9, 6), vs(0, 0.95, 0), { farbe: '#8a6a50', uv: [0.2, 1] });
  add(m.balken, rolle(0.04, 1.1, 6), vs(0, 1.45, 0).multiply(M(V(0, 0, 0), Q(0, 0, Math.PI / 2))), { farbe: '#8a6a50', uv: [0.2, 1] });
  add(m.bunt, new THREE.CapsuleGeometry(0.2, 0.35, 4, 10), vs(0, 1.3, 0), { farbe: '#c0392b' });
  add(m.bunt, new THREE.SphereGeometry(0.17, 12, 10), vs(0, 1.85, 0), { farbe: '#e8d6a0' });
  add(m.bunt, new THREE.ConeGeometry(0.28, 0.32, 12), vs(0, 2.1, 0), { farbe: '#c9a040' });
  add(m.bunt, new THREE.CylinderGeometry(0.4, 0.4, 0.03, 14), vs(0, 1.96, 0), { farbe: '#c9a040' });
  // Gießkanne
  add(m.metall, rolle(0.13, 0.25, 10), M(V(2.0, 0.13, 2.1)), { farbe: '#3f8f5a' });
  add(m.metall, rolle(0.025, 0.35, 6), M(V(2.2, 0.22, 2.1), Q(0, 0, -0.9)), { farbe: '#3f8f5a' });
}

// Eine Karotte zum Ernten: orange Spitze schaut aus der Erde, oben grünes Kraut
function karottenGeo() {
  const teile = [];
  const faerben = (g, farbe) => {
    const c = new THREE.Color(farbe);
    const f = new Float32Array(g.attributes.position.count * 3);
    for (let i = 0; i < g.attributes.position.count; i++) f.set([c.r, c.g, c.b], i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(f, 3));
    for (const n of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(n)) g.deleteAttribute(n);
    return g.index ? g.toNonIndexed() : g;
  };
  teile.push(faerben(new THREE.CylinderGeometry(0.1, 0.06, 0.16, 10).translate(0, 0.03, 0), '#f07a1a'));
  teile.push(faerben(new THREE.SphereGeometry(0.1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.5, 1).translate(0, 0.11, 0), '#f08a2a'));
  for (let i = 0; i < 4; i++) {
    const blatt = new THREE.ConeGeometry(0.05, 0.38, 5);
    blatt.translate(0, 0.19, 0);
    blatt.rotateZ(0.35);
    blatt.rotateY((i / 4) * Math.PI * 2);
    blatt.translate(0, 0.12, 0);
    teile.push(faerben(blatt, i % 2 ? '#3f9a2a' : '#5bb83a'));
  }
  return mergeGeometries(teile);
}

// ---------- Der Fischteich mit Steinrand, Seerosen, Schilf und Steg ----------
// (Das Gelände bleibt, wie es ist – der Teich liegt einfach obendrauf.)
function teich(bs, m, platz, wasserY, z) {
  const add = (mat, geo, lokal, extra) => bs.add(mat, geo, platz.clone().multiply(lokal), extra);
  const r = TEICH.r;
  // Feuchter Erd-Ring
  add(m.bunt, new THREE.RingGeometry(r - 0.1, r + 0.55, 36).rotateX(-Math.PI / 2), M(V(0, 0.04, 0)), { farbe: '#6a5236' });
  // Wasser: in der Mitte tief und dunkel, am Rand hell
  const wasser = new THREE.CircleGeometry(r + 0.05, 40, 0, Math.PI * 2).rotateX(-Math.PI / 2);
  bs.add(m.wasser, wasser, platz.clone().multiply(M(V(0, wasserY, 0))));
  const liste = bs.teile.get(m.wasser);
  const wg = liste[liste.length - 1];
  const wp = wg.attributes.position, wc = wg.attributes.color;
  const tief = new THREE.Color('#164f6e'), flach = new THREE.Color('#4aa6b8'), c = new THREE.Color();
  const mitte = V(0, 0, 0).applyMatrix4(platz);
  for (let i = 0; i < wp.count; i++) {
    const d = Math.hypot(wp.getX(i) - mitte.x, wp.getZ(i) - mitte.z) / r;
    c.copy(tief).lerp(flach, Math.pow(Math.min(1, d), 2.5));
    wc.setXYZ(i, c.r, c.g, c.b);
  }
  // Runde Steine am Rand
  for (let i = 0; i < 20; i++) {
    const w = (i / 20) * Math.PI * 2 + z() * 0.15;
    const g = 0.26 + z() * 0.14;
    add(m.stein, new THREE.IcosahedronGeometry(1, 1), M(V(Math.sin(w) * (r + 0.12), wasserY - 0.02, Math.cos(w) * (r + 0.12)), Q(z(), z() * 3, z()), V(g * 1.3, g * 0.7, g)), { farbe: z() > 0.5 ? '#b8b0a4' : '#9a948a' });
  }
  // Seerosen-Blätter (mit Kerbe) und zwei Blüten
  for (const [x, zz, gr, bluete] of [[-0.9, 0.5, 0.3, true], [0.6, -0.9, 0.26, false], [-0.3, -1.2, 0.22, false], [0.95, 0.35, 0.24, true]]) {
    add(m.bunt, new THREE.CircleGeometry(gr, 14, 0.4, Math.PI * 2 - 0.8).rotateX(-Math.PI / 2), M(V(x, wasserY + 0.015, zz), Q(0, x * 3, 0)), { farbe: '#4f9a3a' });
    if (bluete) {
      add(m.bunt, new THREE.IcosahedronGeometry(0.1, 0), M(V(x, wasserY + 0.08, zz), Q(), V(1, 0.6, 1)), { farbe: '#ff9ac0' });
      add(m.bunt, new THREE.SphereGeometry(0.04, 6, 4), M(V(x, wasserY + 0.13, zz)), { farbe: '#ffd23d' });
    }
  }
  // Schilf gegenüber vom Steg
  for (let i = 0; i < 9; i++) {
    const w = Math.PI * 1.25 + (i - 4) * 0.12;
    const d = r - 0.15 + (i % 3) * 0.12;
    const h = 0.8 + z() * 0.5;
    const x = Math.sin(w) * d, zz = Math.cos(w) * d;
    add(m.bunt, rolle(0.02, h, 4), M(V(x, wasserY + h / 2, zz), Q(z() * 0.2 - 0.1, 0, z() * 0.2 - 0.1)), { farbe: '#6a8a3a' });
    if (i % 2 === 0) add(m.bunt, new THREE.CapsuleGeometry(0.04, 0.16, 3, 6), M(V(x, wasserY + h + 0.05, zz)), { farbe: '#7a4a2a' });
  }
  // Der Holzsteg: ragt vom Ufer übers Wasser
  const w = Math.atan2(STEG_RICHTUNG.x, STEG_RICHTUNG.y);
  const steg = (x, y, zz) => M(V(Math.sin(w) * zz + Math.cos(w) * x, y, Math.cos(w) * zz - Math.sin(w) * x), Q(0, w, 0));
  const stegY = wasserY + 0.22;
  for (let i = 0; i < 9; i++) {
    const d = 0.9 + i * 0.25;
    add(m.planken, kiste(1.15, 0.06, 0.22), steg((i % 2) * 0.03, stegY, d), { farbe: i % 3 ? '#c49a6c' : '#b48a5c', uv: [0.8, 0.2] });
  }
  for (const s of [-1, 1]) {
    add(m.balken, kiste(0.1, 0.12, 2.3), steg(s * 0.45, stegY - 0.09, 1.9), { farbe: '#8a6a50', uv: [0.2, 1] });
    for (const d of [1.0, 2.8]) add(m.balken, rolle(0.07, 0.75, 8), steg(s * 0.5, stegY - 0.3, d), { farbe: '#7a5a40', uv: [0.2, 0.5] });
  }
  laternenPfosten(bs, m, platz.clone().multiply(steg(0.62, 0, 2.75)), 1.35);
  // Ein Angel-Eimer auf dem Steg
  add(m.metall, new THREE.CylinderGeometry(0.15, 0.12, 0.25, 10), steg(-0.3, stegY + 0.15, 2.6), { farbe: '#8a9aa8' });
}

// ---------- Der Pferdestall: Holzhütte mit rundem Dach, Heuraufe und Koppel ----------
// Offene Seite zeigt nach +z (zur Koppel)
function stall(bs, m, platz) {
  const add = (mat, geo, lokal, extra) => bs.add(mat, geo, platz.clone().multiply(lokal), extra);
  const B = 4.4, T = 3.0, H = 2.3;
  const holz = '#b08a64';
  add(m.balken, kiste(B, H, 0.14), M(V(0, H / 2, -T / 2)), { farbe: holz, uv: [2.4, 1.2], verlauf: [0.7, 1] });
  for (const s of [-1, 1]) {
    add(m.balken, kiste(0.14, H, T), M(V(s * B / 2, H / 2, 0)), { farbe: holz, uv: [1.6, 1.2], verlauf: [0.7, 1] });
    add(m.balken, rolle(0.12, H + 0.1, 8), M(V(s * B / 2, (H + 0.1) / 2, T / 2)), { farbe: '#7a5a40', uv: [0.3, 1] });
    add(m.balken, rolle(0.12, H + 0.1, 8), M(V(s * B / 2, (H + 0.1) / 2, -T / 2)), { farbe: '#7a5a40', uv: [0.3, 1] });
  }
  add(m.balken, kiste(B + 0.2, 0.18, 0.18), M(V(0, H, T / 2)), { farbe: '#7a5a40', uv: [2, 0.1] });
  // Rundes Reetdach wie ein halbes Fass
  const dach = new THREE.CylinderGeometry(1, 1, B + 0.9, 18, 1, true, 0, Math.PI).rotateZ(Math.PI / 2);
  add(m.reet, dach, M(V(0, H - 0.05, 0), Q(), V(1, 1.1, (T + 1.1) / 2)), { farbe: '#d8c8a8', uv: [5, 2] });
  for (const s of [-1, 1]) {
    add(m.balken, new THREE.CircleGeometry(1, 18, 0, Math.PI).rotateY(Math.PI / 2), M(V(s * B / 2, H - 0.05, 0), Q(0, s > 0 ? 0 : Math.PI, 0), V(1, 1.05, (T + 0.2) / 2)), { farbe: holz, uv: [1, 0.5] });
  }
  // Heuraufe an der Rückwand: Holzgitter mit Heu
  add(m.balken, kiste(1.8, 0.1, 0.1), M(V(0, 1.75, -T / 2 + 0.45)), { farbe: '#8a6a50', uv: [1, 0.1] });
  add(m.balken, kiste(1.8, 0.1, 0.1), M(V(0, 0.95, -T / 2 + 0.15)), { farbe: '#8a6a50', uv: [1, 0.1] });
  for (let i = 0; i < 8; i++) {
    const x = -0.8 + (i / 7) * 1.6;
    add(m.balken, rolle(0.025, 0.9, 5), stabMatrix(V(x, 0.95, -T / 2 + 0.15), V(x, 1.75, -T / 2 + 0.45)), { farbe: '#a07a52' });
  }
  add(m.reet, new THREE.SphereGeometry(0.5, 12, 8), M(V(0, 1.45, -T / 2 + 0.25), Q(), V(1.6, 0.6, 0.45)), { farbe: '#f0d878' });
  // Wassertrog und Heuballen
  const trog = new THREE.CylinderGeometry(0.3, 0.3, 1.3, 12, 1, true, Math.PI, Math.PI).rotateZ(Math.PI / 2);
  add(m.planken, trog, M(V(1.4, 0.38, -0.6)), { farbe: '#9a6a44', uv: [1, 0.5] });
  bs.add(m.wasser, new THREE.PlaneGeometry(1.25, 0.5).rotateX(-Math.PI / 2), platz.clone().multiply(M(V(1.4, 0.3, -0.6))), { farbe: '#3a8aa8' });
  add(m.reet, rolle(0.45, 0.8, 14), M(V(-1.55, 0.45, 0.4), Q(Math.PI / 2, 0, 0)), { farbe: '#e8c868', uv: [2, 1] });
  add(m.reet, rolle(0.45, 0.8, 14), M(V(-2.9, 0.45, 2.2), Q(0, 0, Math.PI / 2)), { farbe: '#e8c868', uv: [2, 1] });
  // Boden mit Stroh
  add(m.bunt, new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2), M(V(0, 0.03, 0), Q(), V(B / 2 - 0.1, 1, T / 2 - 0.1)), { farbe: '#d8bf70' });
  // Koppel-Zaun vorne, mit Tor-Lücke in der Mitte
  const e = [V(-B / 2, 0, T / 2), V(-B / 2 - 0.6, 0, T / 2 + 3.1), V(-1.1, 0, T / 2 + 3.1), V(1.1, 0, T / 2 + 3.1), V(B / 2 + 0.6, 0, T / 2 + 3.1), V(B / 2, 0, T / 2)].map((p) => p.applyMatrix4(platz));
  zaun(bs, m, e[0], e[1]);
  zaun(bs, m, e[1], e[2]);
  zaun(bs, m, e[3], e[4]);
  zaun(bs, m, e[4], e[5]);
  // Hufeisen über dem Eingang (bringt Glück!)
  add(m.metall, new THREE.TorusGeometry(0.16, 0.03, 6, 14, Math.PI * 1.4), M(V(0, H - 0.25, T / 2 + 0.1), Q(0, 0, -Math.PI * 0.2)), { farbe: '#c0c4c8' });
}

// ---------- Das Schild "BASE" ----------
function schild(bs, m, platz) {
  const add = (mat, geo, lokal, extra) => bs.add(mat, geo, platz.clone().multiply(lokal), extra);
  for (const s of [-1, 1]) add(m.balken, rolle(0.06, 1.7, 6), M(V(s * 0.62, 0.85, 0)), { farbe: '#7a5a40', uv: [0.2, 1] });
  add(m.planken, kiste(1.45, 0.78, 0.08), M(V(0, 1.25, 0)), { farbe: '#8a5a34', uv: [1, 0.5] });
  add(m.schild, new THREE.PlaneGeometry(1.36, 0.7), M(V(0, 1.25, 0.045)));
}

// =============================================================
export class Base {
  constructor(szene, hindernisse, spiel) {
    this.spiel = spiel; // { rucksack, meldung, musik, tageszeit, spieler, angeln, schlafen, elternElement }
    this.szene = szene;
    this.hindernisse = hindernisse;
    this.m = materialien();
    this._stufe = 1;
    this.truhe = new Array(EINSTELLUNGEN.truhePlaetze).fill(null); // { id, anzahl, rest }
    this.karotten = 0; // so viele sind gerade reif
    this.gartenTag = spiel.tageszeit.tag; // an diesem Tag haben wir zuletzt nachgeschaut
    this.stallGebaut = false;
    this.reisezelt = null; // steht es irgendwo? { x, z, w }
    this.teichStelle = null;
    this.zeit = 0;
    this.huepfen = 1; // 0 → 1: kleine Hüpf-Animation nach dem Ausbauen
    this.beiNeuerInteraktion = null; // setzt main.js
    this.beiStallGebaut = null; // setzt main.js (Pferde)
    this.ort = { x: ORT.x, z: ORT.z };
    this.hA = bodenHoehe(ORT.x, ORT.z);

    // Das Modell der Base (wird bei jedem Ausbau neu zusammengeklebt)
    this.gruppe = new THREE.Group();
    this.gruppe.position.set(ORT.x, this.hA, ORT.z);
    szene.add(this.gruppe);
    this.modell = null;
    this.hausHindernisse = [];

    // Licht über der Tür – leuchtet nachts
    this.licht = new THREE.PointLight('#ffbe6a', 0, 11, 1.6);
    this.gruppe.add(this.licht);

    this.baueKarotten();
    this.baueRauch();
    this.baueReisezelt();

    // ---------- Die Aktionen an der Base ----------
    const base = this;
    this.schlafenIA = { pos: V(0, 0, 0), radius: 2.2, bild: '😴', text: 'Schlafen', ausfuehren: () => this.schlafenVersuchen() };
    this.baseIA = { pos: V(0, 0, 0), radius: 2.2, bild: '🏠', text: 'Base', ausfuehren: () => this.oeffnen() };
    this.truheIA = { pos: V(0, 0, 0), radius: 1.9, bild: '📦', text: 'Truhe', aktiv: () => this._stufe >= 3, ausfuehren: () => this.truheOeffnen() };
    this.erntenIA = {
      pos: V(0, 0, 0),
      radius: 2.8,
      bild: '🥕',
      get text() {
        return base.karotten > 0 ? `Ernten (${base.karotten})` : 'Garten';
      },
      aktiv: () => this._stufe >= 4,
      ausfuehren: () => this.ernten(),
    };
    this.reiseSchlafenIA = { pos: V(0, 0, 0), radius: 2.0, bild: '😴', text: 'Schlafen', aktiv: () => !!this.reisezelt, ausfuehren: () => this.schlafenVersuchen() };
    this.reiseEinpackenIA = { pos: V(0, 0, 0), radius: 2.0, bild: '🎒', text: 'Einpacken', aktiv: () => !!this.reisezelt, ausfuehren: () => this.reisezeltEinpacken() };
    this._interaktionen = [this.schlafenIA, this.baseIA, this.truheIA, this.erntenIA, this.reiseSchlafenIA, this.reiseEinpackenIA];

    // Feste Orte: Schild, Truhe, Garten
    this.setzeLokal(this.baseIA.pos, -2.8, 3.9);
    this.setzeLokal(this.truheIA.pos, 4.15, -0.6);
    this.setzeLokal(this.erntenIA.pos, 0, -4.2);
    const schildPos = this.setzeLokal(V(), -2.8, 3.2);
    hindernisse.hinzufuegen(schildPos.x, schildPos.z, 0.25);

    // ---------- Reisezelt-Knopf im Rucksack (alte Knöpfe bleiben!) ----------
    const alteKnoepfe = spiel.rucksack.extraKnoepfe;
    spiel.rucksack.extraKnoepfe = (id) => [
      ...((alteKnoepfe && alteKnoepfe(id)) || []),
      ...(id === 'reisezelt' ? [['⛺ Aufstellen', () => this.reisezeltAufstellen()]] : []),
    ];

    this.baueFenster();
    this.baueModell(false);
  }

  // Ort neben dem Haus: x = nach rechts, z = nach vorne (zur Tür)
  setzeLokal(ziel, x, z) {
    const c = Math.cos(DREHUNG), s = Math.sin(DREHUNG);
    return ziel.set(ORT.x + x * c + z * s, 0, ORT.z - x * s + z * c);
  }

  // ---------- Für main.js ----------
  get interaktionen() {
    return this._interaktionen;
  }

  get offen() {
    return this.menue.classList.contains('offen') || this.truheFenster.classList.contains('offen');
  }

  get stufe() {
    return this._stufe;
  }

  get stall() {
    if (!this.stallGebaut) return null;
    // Platz im Stall, vorne unter dem Dach – das Pferd schaut zur Koppel
    return { x: STALL.x + Math.sin(STALL.winkel) * 0.4, z: STALL.z + Math.cos(STALL.winkel) * 0.4, winkel: STALL.winkel };
  }

  schliessen() {
    this.menue.classList.remove('offen');
    this.truheFenster.classList.remove('offen');
  }

  // =============================================================
  //  DAS 3D-MODELL
  // =============================================================
  baueModell(huepfen) {
    const m = this.m;
    if (this.modell) {
      this.gruppe.remove(this.modell);
      this.modell.traverse((t) => t.isMesh && t.geometry.dispose());
    }
    this.modell = new THREE.Group();
    const bs = new Bausatz();
    const z = zufallMitSeed(77);
    const hA = this.hA;
    // Matrix für einen Ort in der Welt (x, z) – innerhalb der Gruppe
    const welt = (x, zz, drehung = 0) => M(V(x - ORT.x, bodenHoehe(x, zz) - hA, zz - ORT.z), Q(0, drehung, 0));
    const haus = M(V(0, 0, 0), Q(0, DREHUNG, 0));
    const lokal = (x, zz, drehung = 0) => haus.clone().multiply(M(V(x, 0, zz), Q(0, drehung, 0)));
    const st = this._stufe;
    let rauch = null;

    if (st === 1) {
      kuppelZelt(bs, m, haus, { skala: [1.8, 1.5, 2.1], farbe: '#ff8a3d', farbe2: '#e8722a' });
      laternenPfosten(bs, m, lokal(1.25, 2.1, -0.4));
      sitzStamm(bs, m, lokal(-1.6, 2.6, 0.5));
    } else if (st === 2) {
      kuppelZelt(bs, m, haus, { skala: [2.4, 2.1, 2.5], farbe: '#5f9a5a', farbe2: '#4f8a4a', dreiStangen: true, stangen: '#c9a040', matte: '#b5523b' });
      this.vordach(bs, m, haus);
      fass(bs, m, lokal(2.1, 1.6));
      bs.add(m.planken, kiste(0.6, 0.55, 0.6), lokal(-2.0, 2.0, 0.3).multiply(M(V(0, 0.28, 0))), { farbe: '#c49a6c', uv: [0.6, 0.6] });
      sitzStamm(bs, m, lokal(-1.0, 4.4, 0.2));
    } else if (st === 3) {
      rundHaus(bs, m, haus, { r: 2.5, wandH: 2.4, sockel: 0.35, wand: 'holz', dach: 'reet', dachH: 2.7, fenster: [-1.1, 1.1], laden: '#8a4a3a', tuerFarbe: '#7a4a2a' });
      laternenPfosten(bs, m, lokal(1.2, 3.1, -0.3));
    } else if (st === 4) {
      rauch = rundHaus(bs, m, haus, { r: 2.6, wandH: 2.5, sockel: 0.5, wand: 'holz', dach: 'reet', dachH: 2.9, fenster: [-1.1, 1.1, Math.PI], laden: '#4f7f5a', tuerFarbe: '#7a4a2a', blumen: true, schornstein: true });
      laternenPfosten(bs, m, lokal(1.2, 3.2, -0.3));
    } else {
      rauch = rundHaus(bs, m, haus, { r: 3.0, wandH: 3.0, sockel: 0.65, wand: 'putz', fachwerk: true, dach: 'ziegel', dachFarbe: '#c0644a', dachH: 3.0, fenster: [-1.0, 1.0, 2.2, -2.2], laden: '#3f6f8a', tuerFarbe: '#9a6a44', blumen: true, schornstein: true, vordach: true });
      laternenPfosten(bs, m, lokal(1.45, 4.3, -0.3), 1.6);
    }
    // Truhe ab Stufe 3 (rechts neben dem Haus), Holzstapel daneben
    if (st >= 3) {
      truheModell(bs, m, lokal(3.35, -0.6, Math.PI / 2));
      for (let i = 0; i < 3; i++) bs.add(m.balken, rolle(0.15, 1.2, 8), lokal(2.9 - i * 0.05, -2.0 - i * 0.02, 0.4).multiply(M(V(0, 0.15 + (i === 2 ? 0.26 : 0), i === 2 ? 0 : (i - 0.5) * 0.31), Q(Math.PI / 2, 0, 0))), { farbe: '#7a5a40' });
    }
    if (st >= 4) garten(bs, m, lokal(0, -5.4, 0));
    if (st >= 5) {
      const tp = welt(TEICH.x, TEICH.z);
      teich(bs, m, tp, this.teichWasserY() - bodenHoehe(TEICH.x, TEICH.z), z);
    }
    if (this.stallGebaut) stall(bs, m, welt(STALL.x, STALL.z, STALL.winkel));
    schild(bs, m, lokal(-2.8, 3.2, -0.45));
    maleSchild(m.schildLeinwand, st);
    m.schild.map.needsUpdate = true;

    bs.fertig(this.modell);
    this.gruppe.add(this.modell);

    // Licht und Rauch an die richtige Stelle
    const tuer = STUFEN[st].tuer;
    this.licht.position.copy(V(0, 2.3, tuer + 0.6).applyMatrix4(haus));
    this.rauchQuelle = rauch;
    this.rauch.visible = !!rauch;

    // Wo ist die Tür? Dort kann man schlafen
    this.setzeLokal(this.schlafenIA.pos, 0, tuer + 0.7);

    // Hindernisse: Haus (+ Truhe, Teich, Stall)
    for (const h of this.hausHindernisse) this.hindernisse.entfernen(h);
    this.hausHindernisse = [this.hindernisse.hinzufuegen(ORT.x, ORT.z, STUFEN[st].radius)];
    const neu = (x, zz, r) => this.hausHindernisse.push(this.hindernisse.hinzufuegen(x, zz, r));
    if (st >= 3) {
      const t = this.setzeLokal(V(), 3.35, -0.6);
      neu(t.x, t.z, 0.55);
    }
    if (st >= 5) {
      neu(TEICH.x, TEICH.z, TEICH.r + 0.05);
      this.teichAngelstelle();
    }
    if (this.stallGebaut) this.stallHindernisse(neu);

    this.karottenBeet = st >= 4;
    this.zeigeKarotten();
    if (huepfen) this.staubWolke();
    this.huepfen = huepfen ? 0 : 1;
  }

  // Vordach vor dem großen Zelt: gewölbte Plane auf zwei Stangen, mit Wimpeln
  vordach(bs, m, haus) {
    const add = (mat, geo, lokal, extra) => bs.add(mat, geo, haus.clone().multiply(lokal), extra);
    const plane = new THREE.PlaneGeometry(3.0, 2.1, 10, 6).rotateX(-Math.PI / 2);
    const p = plane.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), zz = p.getZ(i); // zz: -1.05 (hinten) … +1.05 (vorne)
      const t = (zz + 1.05) / 2.1;
      p.setY(i, THREE.MathUtils.lerp(1.95, 1.7, t) + 0.22 * (1 - (x / 1.5) ** 2) - 0.12 * Math.sin(t * Math.PI));
    }
    plane.computeVertexNormals();
    add(m.stoff, plane, M(V(0, 0, 2.15 + 1.05)), { farbe: '#efd9a8', uv: [3, 1] });
    for (const s of [-1, 1]) add(m.balken, rolle(0.05, 1.72, 6), M(V(s * 1.42, 0.86, 4.2)), { farbe: '#c9a040', uv: [0.2, 1] });
    // Bunte Wimpel an der Vorderkante
    const farben = ['#d94a3a', '#ffd23d', '#3d7bff', '#4caf50'];
    for (let i = 0; i < 9; i++) {
      const x = -1.35 + i * 0.34;
      const y = 1.7 + 0.22 * (1 - (x / 1.5) ** 2) - 0.03;
      add(m.bunt, new THREE.ConeGeometry(0.1, 0.24, 3).rotateX(Math.PI), M(V(x, y - 0.12, 4.25), Q(), V(1, 1, 0.25)), { farbe: farben[i % 4] });
    }
    // Teppich unter dem Vordach
    add(m.bunt, new THREE.CircleGeometry(1, 24).rotateX(-Math.PI / 2), M(V(0, 0.03, 3.3), Q(), V(1.25, 1, 0.8)), { farbe: '#b5523b' });
    add(m.bunt, new THREE.RingGeometry(0.62, 0.72, 24).rotateX(-Math.PI / 2), M(V(0, 0.035, 3.3), Q(), V(1.25, 1, 0.8)), { farbe: '#e8c070' });
    // Laterne hängt vorne am Vordach
    add(m.fenster, new THREE.SphereGeometry(0.11, 10, 8), M(V(0.9, 1.55, 4.1)));
    add(m.metall, new THREE.ConeGeometry(0.12, 0.1, 8), M(V(0.9, 1.69, 4.1)), { farbe: '#2e2e2e' });
  }

  stallHindernisse(neu) {
    // Rück- und Seitenwände, dazu die Zaunpfosten (das Tor bleibt frei)
    const lok = (x, zz) => V(STALL.x + Math.sin(STALL.winkel) * zz + Math.cos(STALL.winkel) * x, 0, STALL.z + Math.cos(STALL.winkel) * zz - Math.sin(STALL.winkel) * x);
    const linie = (a, b, schritt = 0.7) => {
      const n = Math.max(1, Math.round(a.distanceTo(b) / schritt));
      for (let i = 0; i <= n; i++) {
        const p = a.clone().lerp(b, i / n);
        neu(p.x, p.z, 0.3);
      }
    };
    linie(lok(-2.2, -1.5), lok(2.2, -1.5));
    linie(lok(-2.2, -1.5), lok(-2.2, 1.5));
    linie(lok(2.2, -1.5), lok(2.2, 1.5));
    linie(lok(-2.2, 1.5), lok(-2.8, 4.6), 0.9);
    linie(lok(-2.8, 4.6), lok(-1.1, 4.6), 0.9);
    linie(lok(1.1, 4.6), lok(2.8, 4.6), 0.9);
    linie(lok(2.8, 4.6), lok(2.2, 1.5), 0.9);
  }

  teichWasserY() {
    return bodenHoehe(TEICH.x, TEICH.z) + 0.16;
  }

  // Am Teich entsteht eine neue Angelstelle (nur einmal)
  teichAngelstelle() {
    if (this.teichStelle || !this.spiel.angeln || !this.spiel.angeln.stelleHinzufuegen) return;
    const sx = STEG_RICHTUNG.x, sz = STEG_RICHTUNG.y;
    const standX = TEICH.x + sx * 2.85, standZ = TEICH.z + sz * 2.85;
    const stand = V(standX, bodenHoehe(standX, standZ), standZ);
    const ziel = V(TEICH.x - sx * 0.25, this.teichWasserY(), TEICH.z - sz * 0.25);
    const ia = this.spiel.angeln.stelleHinzufuegen(stand, ziel);
    this.teichStelle = ia;
    this._interaktionen.push(ia);
    if (this.beiNeuerInteraktion) this.beiNeuerInteraktion(ia);
  }

  // ---------- Karotten im Beet (EIN Modell für alle) ----------
  baueKarotten() {
    const n = EINSTELLUNGEN.karottenMax;
    this.karottenMesh = new THREE.InstancedMesh(karottenGeo(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }), n);
    this.karottenMesh.castShadow = true;
    this.karottenMesh.visible = false;
    this.karottenOrte = [];
    const reihen = 2, proReihe = Math.ceil(n / reihen);
    for (let i = 0; i < n; i++) {
      const reihe = i % reihen, platz = Math.floor(i / reihen);
      const x = proReihe > 1 ? -1.2 + (platz / (proReihe - 1)) * 2.4 : 0;
      const p = this.setzeLokal(V(), x, -5.4 + (reihe === 0 ? -0.55 : 0.05));
      p.y = bodenHoehe(p.x, p.z) + 0.3;
      this.karottenOrte.push(p);
    }
    this.szene.add(this.karottenMesh);
  }

  zeigeKarotten() {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    this.karottenMesh.visible = !!this.karottenBeet;
    this.karottenOrte.forEach((ort, i) => {
      const reif = i < this.karotten;
      // Reife Karotten sind groß, die anderen sind nur kleines Kraut (die Rübe steckt noch in der Erde)
      const wackeln = Math.sin(this.zeit * 1.7 + i * 2) * 0.06;
      q.setFromEuler(new THREE.Euler(wackeln, i * 1.3, wackeln * 0.7));
      p.copy(ort);
      if (!reif) p.y -= 0.1;
      m.compose(p, q, s.setScalar(reif ? 1.15 : 0.5));
      this.karottenMesh.setMatrixAt(i, m);
    });
    this.karottenMesh.instanceMatrix.needsUpdate = true;
  }

  // ---------- Rauch aus dem Schornstein & Staubwolke beim Bauen ----------
  baueRauch() {
    const bild = wolkenBild();
    const n = 10;
    this.rauchPos = new Float32Array(n * 3);
    this.rauchFarbe = new Float32Array(n * 4);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.rauchPos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.rauchFarbe, 4));
    this.rauchMat = new THREE.PointsMaterial({ map: bild, size: 1.5, transparent: true, depthWrite: false, vertexColors: true, color: '#d8d4cc' });
    this.rauch = new THREE.Points(geo, this.rauchMat);
    this.rauch.frustumCulled = false;
    this.rauch.visible = false;
    this.szene.add(this.rauch);

    const s = 40;
    this.staub = { pos: new Float32Array(s * 3), farbe: new Float32Array(s * 4), teile: [], zeit: -1 };
    for (let i = 0; i < s; i++) this.staub.teile.push({ w: (i / s) * Math.PI * 2, v: 2 + Math.random() * 2.5, h: Math.random() * 1.5 });
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(this.staub.pos, 3));
    sg.setAttribute('color', new THREE.BufferAttribute(this.staub.farbe, 4));
    this.staubPunkte = new THREE.Points(sg, new THREE.PointsMaterial({ map: bild, size: 1.8, transparent: true, depthWrite: false, vertexColors: true, color: '#d8c0a0' }));
    this.staubPunkte.frustumCulled = false;
    this.staubPunkte.visible = false;
    this.szene.add(this.staubPunkte);
  }

  staubWolke() {
    this.staub.zeit = 0;
    this.staubPunkte.visible = true;
  }

  // ---------- Das Reisezelt (ein kleines Extra-Modell) ----------
  baueReisezelt() {
    const bs = new Bausatz();
    kuppelZelt(bs, this.m, M(V(0, 0, 0)), { skala: [1.45, 1.25, 1.7], farbe: '#ff8a3d', farbe2: '#e8722a', stangenMat: this.m.bunt });
    this.zeltModell = new THREE.Group();
    bs.fertig(this.zeltModell);
    this.zeltModell.visible = false;
    this.szene.add(this.zeltModell);
    this.zeltHindernis = null;
  }

  // =============================================================
  //  DIE AKTIONEN
  // =============================================================
  schlafenVersuchen() {
    const { tageszeit, meldung } = this.spiel;
    if (!tageszeit.istNacht()) {
      const rest = Math.ceil(tageszeit.restSekunden());
      meldung(`Du bist noch gar nicht müde. Schlafen geht nur nachts 🌙 (noch ${Math.floor(rest / 60)}:${String(rest % 60).padStart(2, '0')} Minuten)`, 4);
      return;
    }
    this.spiel.schlafen();
  }

  // Kosten prüfen: Was fehlt noch? → Liste von [id, wie viele fehlen]
  fehlt(kosten) {
    const { rucksack } = this.spiel;
    const liste = [];
    for (const [id, n] of Object.entries(kosten)) {
      const hat = id === 'muenzen' ? rucksack.muenzen : rucksack.anzahl(id);
      if (hat < n) liste.push([id, n - hat]);
    }
    return liste;
  }

  bezahlen(kosten) {
    const { rucksack } = this.spiel;
    for (const [id, n] of Object.entries(kosten)) {
      if (id === 'muenzen') rucksack.aendereMuenzen(-n);
      else rucksack.nehmen(id, n);
    }
  }

  ausbauen() {
    const { rucksack, meldung, musik, tageszeit } = this.spiel;
    if (this._stufe >= 5) return;
    const kosten = EINSTELLUNGEN.baseStufen[this._stufe + 1];
    const fehlt = this.fehlt(kosten);
    if (fehlt.length) {
      this.zeigeInfo(`Dir fehlen noch: ${fehlt.map(([id, n]) => `${n} ${zutatName(id)}`).join(', ')}`);
      return;
    }
    this.bezahlen(kosten);
    this._stufe++;
    let extra = '';
    if (this._stufe === 2) {
      // Das alte Zelt wird zum Reisezelt
      if (rucksack.passt('reisezelt')) {
        rucksack.hinein('reisezelt');
        extra = ' Dein altes Zelt ist jetzt ein Reisezelt ⛺ im Rucksack!';
      } else {
        extra = ' Dein altes Zelt kannst du hier später als Reisezelt ⛺ abholen (3 freie Plätze).';
      }
    }
    if (this._stufe === 4) {
      this.karotten = EINSTELLUNGEN.karottenStart;
      this.gartenTag = tageszeit.tag;
    }
    this.baueModell(true);
    musik.pling();
    const s = STUFEN[this._stufe];
    meldung(`${s.bild} Ausgebaut! Deine Base ist jetzt: ${s.name}.${extra}`, 6);
    this.zeichneMenue();
    this.zeigeInfo(`🎉 ${s.text}${extra}`);
  }

  stallBauen() {
    const { meldung, musik } = this.spiel;
    if (this.stallGebaut || !this.stallFrei()) return;
    const fehlt = this.fehlt(EINSTELLUNGEN.stallKosten);
    if (fehlt.length) {
      this.zeigeInfo(`Dir fehlen noch: ${fehlt.map(([id, n]) => `${n} ${zutatName(id)}`).join(', ')}`);
      return;
    }
    this.bezahlen(EINSTELLUNGEN.stallKosten);
    this.stallGebaut = true;
    this.baueModell(true);
    musik.pling();
    meldung('🐴 Der Pferdestall steht! Hier kann ein gezähmtes Pferd wohnen.', 6);
    this.zeichneMenue();
    this.zeigeInfo('🐴 Der Stall steht gegenüber am Weg. Jetzt fehlt nur noch ein Pferd!');
    if (this.beiStallGebaut) this.beiStallGebaut({ geladen: false });
  }

  stallFrei() {
    return this._stufe >= EINSTELLUNGEN.stallAbStufe && this.spiel.tageszeit.tag >= EINSTELLUNGEN.stallAbTag;
  }

  ernten() {
    const { rucksack, meldung, musik } = this.spiel;
    if (this.karotten <= 0) {
      meldung('🌱 Die Karotten wachsen noch. Morgen sind neue reif!', 4);
      return;
    }
    let n = this.karotten;
    while (n > 0 && !rucksack.passt('karotte', n)) n--;
    if (n === 0) {
      meldung('Dein Rucksack ist voll! 🎒 Da passt keine Karotte mehr rein.', 4);
      return;
    }
    rucksack.hinein('karotte', n);
    this.karotten -= n;
    this.zeigeKarotten();
    musik.pling();
    meldung(`🥕 +${n} Karotte${n > 1 ? 'n' : ''}! Lecker – im Rucksack antippen und essen.`, 4);
  }

  // ---------- Reisezelt ----------
  reisezeltAufstellen() {
    const { rucksack, spieler, meldung } = this.spiel;
    if (this.reisezelt) {
      meldung('⛺ Dein Reisezelt steht schon woanders. Pack es erst dort ein!', 4);
      return;
    }
    const f = spieler.figur;
    const w = f.rotation.y;
    const x = f.position.x + Math.sin(w) * 2.8, z = f.position.z + Math.cos(w) * 2.8;
    const geht = this.platzFuerZelt(x, z);
    if (geht !== true) {
      meldung(geht, 4);
      return;
    }
    rucksack.nehmen('reisezelt', 1);
    rucksack.schliessen();
    this.zeltAufstellenBei(x, z, w + Math.PI); // Eingang schaut zur Figur
    this.spiel.musik.pling();
    meldung('⛺ Dein Zelt steht! Nachts kannst du hier schlafen. Hinter dem Zelt kannst du es wieder einpacken 🎒.', 6);
  }

  // Ist hier Platz für das Zelt? true – oder ein Satz, warum nicht
  platzFuerZelt(x, z) {
    const h = bodenHoehe(x, z);
    if (h < WASSER_HOEHE + 0.5) return '🌊 Im Wasser kann man kein Zelt aufstellen!';
    if (abstandZumDorf(x, z) < DORF.radius + 4) return '🏘️ Im Dorf ist kein Platz für dein Zelt. Geh ein Stück raus!';
    for (let i = 0; i < 6; i++) {
      const w = (i / 6) * Math.PI * 2;
      const hh = bodenHoehe(x + Math.sin(w) * 1.7, z + Math.cos(w) * 1.7);
      if (hh < WASSER_HOEHE + 0.3) return '🌊 Zu nah am Wasser! Geh ein Stück weiter aufs Land.';
      if (Math.abs(hh - h) > 0.9) return '⛰️ Hier ist es zu steil für ein Zelt.';
    }
    if (this.hindernisse.trifft(x, z, 1.5)) return '🌳 Da ist etwas im Weg. Such dir einen freien Platz!';
    return true;
  }

  zeltAufstellenBei(x, z, w) {
    this.reisezelt = { x, z, w };
    this.zeltModell.position.set(x, bodenHoehe(x, z), z);
    this.zeltModell.rotation.y = w;
    this.zeltModell.visible = true;
    if (this.zeltHindernis) this.hindernisse.entfernen(this.zeltHindernis);
    this.zeltHindernis = this.hindernisse.hinzufuegen(x, z, 1.5);
    this.reiseSchlafenIA.pos.set(x + Math.sin(w) * 2.4, 0, z + Math.cos(w) * 2.4);
    this.reiseEinpackenIA.pos.set(x - Math.sin(w) * 2.4, 0, z - Math.cos(w) * 2.4);
  }

  reisezeltEinpacken() {
    const { rucksack, meldung, musik } = this.spiel;
    if (!this.reisezelt) return;
    if (!rucksack.passt('reisezelt')) {
      meldung('🎒 Für das Zelt brauchst du 3 freie Plätze im Rucksack!', 4);
      return;
    }
    rucksack.hinein('reisezelt');
    this.reisezelt = null;
    this.zeltModell.visible = false;
    if (this.zeltHindernis) this.hindernisse.entfernen(this.zeltHindernis);
    this.zeltHindernis = null;
    musik.pling();
    meldung('🎒 Zelt eingepackt! Im Rucksack: antippen → ⛺ Aufstellen.', 4);
  }

  // Hat man das Reisezelt verloren (weggeworfen / kein Platz gehabt)? Dann liegt es in der Base.
  reisezeltAbholbar() {
    return this._stufe >= 2 && !this.reisezelt && !this.spiel.rucksack.hat('reisezelt');
  }

  reisezeltAbholen() {
    const { rucksack, musik } = this.spiel;
    if (!this.reisezeltAbholbar()) return;
    if (!rucksack.passt('reisezelt')) {
      this.zeigeInfo('🎒 Für das Reisezelt brauchst du 3 freie Plätze im Rucksack!');
      return;
    }
    rucksack.hinein('reisezelt');
    musik.pling();
    this.zeichneMenue();
    this.zeigeInfo('⛺ Reisezelt eingepackt! Im Rucksack antippen → Aufstellen.');
  }

  // =============================================================
  //  DIE FENSTER: Base-Menü und Truhe
  // =============================================================
  baueFenster() {
    const eltern = this.spiel.elternElement;
    this.menue = document.createElement('div');
    this.menue.id = 'base-fenster';
    this.menue.className = 'spiel-fenster';
    this.menue.innerHTML = `
      <div class="fenster-kopf"><h2>🏠 Deine Base</h2><button class="zu" aria-label="Schließen">✕</button></div>
      <div class="base-leiste"></div>
      <p class="base-jetzt"></p>
      <h3 class="base-ueberschrift">🔨 Nächster Ausbau</h3>
      <div class="base-naechste"></div>
      <h3 class="base-ueberschrift">✨ Erweiterungen</h3>
      <div class="base-erweiterungen"></div>
      <p class="werkbank-info base-info"></p>`;
    eltern.appendChild(this.menue);
    this.menue.addEventListener('touchstart', (e) => e.stopPropagation());
    knopf(this.menue.querySelector('.zu'), () => this.schliessen());

    this.truheFenster = document.createElement('div');
    this.truheFenster.id = 'truhe-fenster';
    this.truheFenster.className = 'spiel-fenster';
    this.truheFenster.innerHTML = `
      <div class="fenster-kopf"><h2>📦 Truhe</h2><button class="zu" aria-label="Schließen">✕</button></div>
      <h3 class="base-ueberschrift truhe-titel"></h3>
      <div class="truhe-raster truhe-inhalt"></div>
      <h3 class="base-ueberschrift">🎒 Dein Rucksack</h3>
      <div class="truhe-raster truhe-rucksack"></div>
      <p class="werkbank-info truhe-info">Tippe etwas an: Es wandert in die Truhe – oder wieder heraus.</p>`;
    eltern.appendChild(this.truheFenster);
    this.truheFenster.addEventListener('touchstart', (e) => e.stopPropagation());
    knopf(this.truheFenster.querySelector('.zu'), () => this.schliessen());
  }

  oeffnen() {
    this.schliessen();
    this.zeichneMenue();
    this.zeigeInfo(this.reisezeltAbholbar() ? '⛺ Dein Reisezelt liegt hier und wartet auf dich!' : 'Was willst du bauen?');
    this.menue.classList.add('offen');
  }

  zeigeInfo(text) {
    this.menue.querySelector('.base-info').innerHTML = text;
  }

  zeichneMenue() {
    const { rucksack, tageszeit } = this.spiel;
    const st = this._stufe;
    // Die Leiste mit allen 5 Stufen
    this.menue.querySelector('.base-leiste').innerHTML = STUFEN.slice(1)
      .map((s, i) => `<div class="base-schritt ${i + 1 < st ? 'fertig' : i + 1 === st ? 'jetzt' : ''}"><span class="gross">${s.bild}</span>${i + 1}. ${s.name}</div>`)
      .join('');
    const jetzt = STUFEN[st];
    this.menue.querySelector('.base-jetzt').innerHTML = `Stufe <b>${st} von 5</b>: ${jetzt.bild} <b>${jetzt.name}</b> – ${jetzt.text}`;

    // Nächster Ausbau
    const naechste = this.menue.querySelector('.base-naechste');
    if (st >= 5) {
      naechste.innerHTML = '<div class="base-fertig">🏆 Deine Base ist fertig ausgebaut. Super gemacht!</div>';
    } else {
      const s = STUFEN[st + 1];
      naechste.innerHTML = '';
      naechste.appendChild(this.bauZeile(s.bild, `${st + 1}. ${s.name}`, s.text, EINSTELLUNGEN.baseStufen[st + 1], 'Ausbauen', () => this.ausbauen()));
    }

    // Erweiterungen: der Pferdestall (und ein liegengebliebenes Reisezelt)
    const erw = this.menue.querySelector('.base-erweiterungen');
    erw.innerHTML = '';
    if (this.stallGebaut) {
      erw.insertAdjacentHTML('beforeend', `<div class="rezept"><div class="rezept-bild">${BILDER.pferd}</div><div class="rezept-mitte"><b>Pferdestall</b><div class="base-klein">✅ Steht schon! Hier kann ein gezähmtes Pferd wohnen.</div></div></div>`);
    } else if (!this.stallFrei()) {
      const gruende = [];
      if (st < EINSTELLUNGEN.stallAbStufe) gruende.push(`ab Base-Stufe ${EINSTELLUNGEN.stallAbStufe} (du hast ${st})`);
      if (tageszeit.tag < EINSTELLUNGEN.stallAbTag) gruende.push(`ab Tag ${EINSTELLUNGEN.stallAbTag} (heute ist Tag ${tageszeit.tag})`);
      erw.insertAdjacentHTML('beforeend', `<div class="rezept gesperrt"><div class="rezept-bild">${BILDER.pferd}</div><div class="rezept-mitte"><b>Pferdestall</b><div class="base-klein">🔒 Gibt es erst ${gruende.join(' und ')}.</div></div></div>`);
    } else {
      erw.appendChild(this.bauZeile(BILDER.pferd, 'Pferdestall', 'Ein Zuhause für ein gezähmtes Pferd.', EINSTELLUNGEN.stallKosten, 'Bauen', () => this.stallBauen()));
    }
    if (this.reisezeltAbholbar()) {
      const zeile = document.createElement('div');
      zeile.className = 'rezept';
      const passt = rucksack.passt('reisezelt');
      zeile.innerHTML = `<div class="rezept-bild">${BILDER.reisezelt}</div><div class="rezept-mitte"><b>Reisezelt</b><div class="base-klein">Dein altes Zelt zum Mitnehmen. Braucht 3 Plätze im Rucksack.</div></div><button class="bauen" ${passt ? '' : 'disabled'}>Abholen</button>`;
      knopf(zeile.querySelector('.bauen'), () => this.reisezeltAbholen());
      erw.appendChild(zeile);
    }
  }

  // Eine Zeile mit Bild, Name, Zutaten und Knopf – wie an der Werkbank
  bauZeile(bild, name, text, kosten, knopfText, wasPassiert) {
    const { rucksack } = this.spiel;
    const zeile = document.createElement('div');
    zeile.className = 'rezept';
    const fehlt = this.fehlt(kosten);
    const kann = fehlt.length === 0;
    const zutaten = Object.entries(kosten)
      .map(([id, n]) => {
        const hat = id === 'muenzen' ? rucksack.muenzen : rucksack.anzahl(id);
        return `<span class="zutat ${hat >= n ? 'ok' : 'fehlt'}">${zutatBild(id)} ${Math.min(hat, n)}/${n} ${zutatName(id)}</span>`;
      })
      .join('');
    zeile.innerHTML = `
      <div class="rezept-bild">${bild}</div>
      <div class="rezept-mitte"><b>${name}</b><div class="base-klein">${text}</div><div class="zutaten">${zutaten}</div>${kann ? '' : `<div class="base-fehlt">Es fehlen noch: ${fehlt.map(([id, n]) => `${n} ${zutatName(id)}`).join(', ')}</div>`}</div>
      <button class="bauen" ${kann ? '' : 'disabled'}>${knopfText}</button>`;
    knopf(zeile.querySelector('.bauen'), wasPassiert);
    return zeile;
  }

  // ---------- Die Truhe ----------
  truheOeffnen() {
    this.schliessen();
    this.zeichneTruhe();
    this.truheFenster.querySelector('.truhe-info').textContent = 'Tippe etwas an: Es wandert in die Truhe – oder wieder heraus.';
    this.truheFenster.classList.add('offen');
  }

  zeichneTruhe() {
    const { rucksack } = this.spiel;
    const belegt = this.truhe.filter(Boolean).length;
    this.truheFenster.querySelector('.truhe-titel').innerHTML = `${BILDER.truhe} In der Truhe (${belegt} von ${this.truhe.length} Plätzen belegt)`;
    const feld = (platz, beiTippen) => {
      const k = document.createElement('button');
      k.className = 'platz';
      if (platz && platz.block) {
        k.innerHTML = `<span class="bild blass">${DINGE[platz.block].bild}</span>`;
        k.classList.add('mitbelegt');
      } else if (platz) {
        const h = (EINSTELLUNGEN.haltbarkeit || {})[platz.id];
        k.innerHTML = `<span class="bild">${DINGE[platz.id].bild}</span>` +
          (platz.anzahl > 1 ? `<span class="anzahl">${platz.anzahl}</span>` : '') +
          (h ? `<span class="haltbar"><span style="width:${(platz.rest / h) * 100}%"></span></span>` : '');
        if (DINGE[platz.id].plaetze > 1) k.classList.add('zu-gross');
      }
      knopf(k, beiTippen);
      return k;
    };
    const oben = this.truheFenster.querySelector('.truhe-inhalt');
    oben.innerHTML = '';
    this.truhe.forEach((p, i) => oben.appendChild(feld(p, () => this.ausTruhe(i))));
    const unten = this.truheFenster.querySelector('.truhe-rucksack');
    unten.innerHTML = '';
    rucksack.plaetze.forEach((p, i) => unten.appendChild(feld(p, () => this.inTruhe(i))));
  }

  truheInfo(text) {
    this.truheFenster.querySelector('.truhe-info').innerHTML = text;
  }

  // Wie viele von diesem Ding passen noch in die Truhe?
  truhePlatzFuer(id) {
    let frei = 0;
    for (const p of this.truhe) {
      if (!p) frei += EINSTELLUNGEN.stapelGroesse;
      else if (p.id === id && !hatHaltbarkeit(id)) frei += EINSTELLUNGEN.stapelGroesse - p.anzahl;
    }
    return frei;
  }

  // Rucksack-Platz i → Truhe (der ganze Stapel, so viel wie passt)
  inTruhe(i) {
    const { rucksack } = this.spiel;
    let platz = rucksack.plaetze[i];
    if (platz && platz.block) {
      i = rucksack.plaetze.findIndex((p) => p && p.id === platz.block);
      platz = rucksack.plaetze[i];
    }
    if (!platz) return;
    const ding = DINGE[platz.id];
    if ((ding.plaetze || 1) > 1) {
      this.truheInfo(`${ding.bild} ${ding.name} ist zu groß für die Truhe!`);
      return;
    }
    if (hatHaltbarkeit(platz.id)) {
      // Werkzeuge, die sich abnutzen, wandern als Ganzes (damit sie nicht wie neu werden)
      const frei = this.truhe.indexOf(null);
      if (frei < 0) return this.truheInfo('📦 Die Truhe ist voll!');
      this.truhe[frei] = { ...platz };
      rucksack.plaetze[i] = null;
      this.truheInfo(`${ding.bild} ${ding.name} liegt jetzt in der Truhe.`);
    } else {
      const n = Math.min(platz.anzahl, this.truhePlatzFuer(platz.id));
      if (n <= 0) return this.truheInfo('📦 Die Truhe ist voll!');
      this.truheLegen(platz.id, n);
      platz.anzahl -= n;
      if (platz.anzahl <= 0) rucksack.plaetze[i] = null;
      this.truheInfo(`${ding.bild} ${n}× ${ding.name} in die Truhe gelegt.`);
    }
    rucksack.nehmen(platz.id, 0); // schaut nach, ob man es noch in der Hand halten kann, und malt neu
    this.spiel.musik.pling();
    this.zeichneTruhe();
  }

  truheLegen(id, n) {
    for (const p of this.truhe) {
      if (n <= 0) break;
      if (p && p.id === id && p.anzahl < EINSTELLUNGEN.stapelGroesse) {
        const dazu = Math.min(n, EINSTELLUNGEN.stapelGroesse - p.anzahl);
        p.anzahl += dazu;
        n -= dazu;
      }
    }
    while (n > 0) {
      const frei = this.truhe.indexOf(null);
      if (frei < 0) break;
      const dazu = Math.min(n, EINSTELLUNGEN.stapelGroesse);
      this.truhe[frei] = { id, anzahl: dazu, rest: 0 };
      n -= dazu;
    }
  }

  // Truhe-Platz i → Rucksack
  ausTruhe(i) {
    const { rucksack } = this.spiel;
    const platz = this.truhe[i];
    if (!platz) return;
    const ding = DINGE[platz.id];
    if (hatHaltbarkeit(platz.id)) {
      const frei = rucksack.plaetze.indexOf(null);
      if (frei < 0) return this.truheInfo('🎒 Dein Rucksack ist voll!');
      rucksack.plaetze[frei] = { ...platz };
      this.truhe[i] = null;
      rucksack.zeichnen();
      this.truheInfo(`${ding.bild} ${ding.name} ist wieder im Rucksack.`);
    } else {
      let n = platz.anzahl;
      while (n > 0 && !rucksack.passt(platz.id, n)) n--;
      if (n <= 0) return this.truheInfo('🎒 Dein Rucksack ist voll!');
      rucksack.hinein(platz.id, n);
      platz.anzahl -= n;
      if (platz.anzahl <= 0) this.truhe[i] = null;
      this.truheInfo(`${ding.bild} ${n}× ${ding.name} in den Rucksack gepackt.`);
    }
    this.spiel.musik.pling();
    this.zeichneTruhe();
  }

  // =============================================================
  //  JEDES BILD
  // =============================================================
  // helligkeit (0 = Nacht, 1 = Tag) darf main.js mitgeben – sonst rechnen wir sie selbst aus
  aktualisiere(dt, helligkeit) {
    this.zeit += dt;
    const { tageszeit } = this.spiel;
    const nacht = helligkeit === undefined ? nachtAnteil(tageszeit) : 1 - helligkeit;
    this.m.fenster.emissiveIntensity = 0.05 + nacht * 2.2;
    this.licht.intensity = nacht * 14;

    // Ein neuer Tag? Dann wachsen Karotten nach
    if (this._stufe >= 4) {
      const heute = tageszeit.tag;
      if (heute > this.gartenTag) {
        this.karotten = Math.min(EINSTELLUNGEN.karottenMax, this.karotten + EINSTELLUNGEN.karottenProTag * (heute - this.gartenTag));
        this.gartenTag = heute;
      } else if (heute < this.gartenTag) this.gartenTag = heute;
      this.zeigeKarotten(); // auch für das Wackeln im Wind
    }

    // Kleine Hüpf-Animation nach dem Ausbauen (wie Wackelpudding)
    if (this.huepfen < 1) {
      this.huepfen = Math.min(1, this.huepfen + dt / 0.7);
      const t = this.huepfen;
      const welle = Math.sin(t * Math.PI * 3) * (1 - t) * 0.12;
      this.gruppe.scale.set(1 - welle * 0.5, 1 + welle, 1 - welle * 0.5);
    } else this.gruppe.scale.set(1, 1, 1);

    // Rauch aus dem Schornstein
    if (this.rauch.visible && this.rauchQuelle) {
      const q = V(0, 0, 0).copy(this.rauchQuelle).add(this.gruppe.position);
      const n = this.rauchPos.length / 3;
      const hell = 0.35 + (1 - nacht) * 0.65;
      this.rauchMat.color.setRGB(0.85 * hell, 0.83 * hell, 0.8 * hell);
      for (let i = 0; i < n; i++) {
        const t = (this.zeit * 0.18 + i / n) % 1;
        const wind = t * t * 2;
        this.rauchPos[i * 3] = q.x + wind + Math.sin(this.zeit * 0.9 + i * 1.7) * 0.25 * t;
        this.rauchPos[i * 3 + 1] = q.y + t * 4.2;
        this.rauchPos[i * 3 + 2] = q.z + wind * 0.5 + Math.cos(this.zeit * 0.7 + i) * 0.25 * t;
        this.rauchFarbe.set([1, 1, 1, Math.min(1, t * 6) * (1 - t) * 0.55], i * 4);
      }
      this.rauch.geometry.attributes.position.needsUpdate = true;
      this.rauch.geometry.attributes.color.needsUpdate = true;
    }

    // Staubwolke beim Bauen: fliegt nach außen und wird durchsichtig
    if (this.staub.zeit >= 0) {
      this.staub.zeit += dt;
      const t = this.staub.zeit / 1.4;
      if (t >= 1) {
        this.staub.zeit = -1;
        this.staubPunkte.visible = false;
      } else {
        const g = this.gruppe.position;
        this.staub.teile.forEach((s, i) => {
          const d = 1.5 + s.v * (1 - (1 - t) * (1 - t));
          this.staub.pos.set([g.x + Math.sin(s.w) * d, g.y + 0.3 + s.h * t, g.z + Math.cos(s.w) * d], i * 3);
          this.staub.farbe.set([1, 1, 1, (1 - t) * 0.7], i * 4);
        });
        this.staubPunkte.geometry.attributes.position.needsUpdate = true;
        this.staubPunkte.geometry.attributes.color.needsUpdate = true;
      }
    }
  }

  // =============================================================
  //  SPEICHERN & LADEN
  // =============================================================
  alsDaten() {
    return {
      stufe: this._stufe,
      truhe: this.truhe.map((p) => (p ? { ...p } : null)),
      karotten: this.karotten,
      gartenTag: this.gartenTag,
      stall: this.stallGebaut,
      reisezelt: this.reisezelt ? { ...this.reisezelt } : null,
    };
  }

  ladeDaten(d = {}) {
    this._stufe = klemme(Math.round(d.stufe || 1), 1, 5);
    this.truhe = new Array(Math.max(EINSTELLUNGEN.truhePlaetze, (d.truhe || []).length)).fill(null);
    (d.truhe || []).forEach((p, i) => {
      if (p && DINGE[p.id] && p.anzahl > 0) this.truhe[i] = { id: p.id, anzahl: p.anzahl, rest: p.rest || 0 };
    });
    this.karotten = klemme(d.karotten || 0, 0, EINSTELLUNGEN.karottenMax);
    this.gartenTag = d.gartenTag ?? this.spiel.tageszeit.tag;
    this.stallGebaut = !!d.stall;
    if (d.reisezelt) this.zeltAufstellenBei(d.reisezelt.x, d.reisezelt.z, d.reisezelt.w || 0);
    else if (this.reisezelt) {
      this.reisezelt = null;
      this.zeltModell.visible = false;
      if (this.zeltHindernis) this.hindernisse.entfernen(this.zeltHindernis);
      this.zeltHindernis = null;
    }
    this.baueModell(false);
    if (this.stallGebaut && this.beiStallGebaut) this.beiStallGebaut({ geladen: true });
  }
}

// ---------- Kleine Helfer ----------
function hatHaltbarkeit(id) {
  return !!(EINSTELLUNGEN.haltbarkeit || {})[id];
}

function zutatBild(id) {
  return id === 'muenzen' ? muenzeKlein() : DINGE[id].bild;
}

function zutatName(id) {
  return id === 'muenzen' ? 'Münzen' : DINGE[id].name;
}

// Wie dunkel ist es gerade? 0 = Tag, 1 = Nacht (mit Dämmerung)
function nachtAnteil(tageszeit) {
  const tag = tageszeit.tagSekunden, ganz = tag + tageszeit.nachtSekunden, z = tageszeit.zeit;
  if (z < tag) return klemme((z - (tag - 30)) / 30, 0, 1); // Abend: langsam dunkel
  return klemme((ganz - z) / 20, 0, 1); // Morgen: langsam hell
}
