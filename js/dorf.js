// =============================================================
//  DAS DORF – runde Hütten, ein Brunnen, Laternen und der Händler
//  "Die Dörfer muss man finden" (Game Designer, Tag 1)
//
//  Trick für das iPad: Das Dorf besteht aus Hunderten Einzelteilen
//  (Balken, Fensterrahmen, Fässer, Zaunlatten …). Würde der Computer
//  jedes Teil einzeln malen, wäre das viel zu langsam. Darum kleben
//  wir alle Teile mit demselben Material zu EINEM großen Modell
//  zusammen ("zusammenfügen" / merge). Dann sind es nur ca. 12
//  Malbefehle für das ganze Dorf.
// =============================================================
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { DORF } from './gelaende.js';
import { baueFigur } from './figur.js';
import { textur } from './texturen.js';
import { zufallMitSeed } from './rauschen.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const Q = (x = 0, y = 0, z = 0) => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z));
const M = (pos, rot = Q(), skala = V(1, 1, 1)) => new THREE.Matrix4().compose(pos, rot, skala);

function mat(farbe, extra = {}) {
  return new THREE.MeshStandardMaterial({ color: farbe, roughness: 0.85, ...extra });
}

// ---------- Der Bausatz sammelt alle Teile, sortiert nach Material ----------
export class Bausatz {
  constructor() {
    this.teile = new Map();
  }
  // geo = Form, matrix = wohin, farbe = Tönung, uv = wie oft das Bild wiederholt wird
  // verlauf = [unten, oben]: unten dunkler, z. B. Schmutz und Schatten an der Hauswand
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
      mesh.castShadow = !material.userData.keinSchatten;
      mesh.receiveShadow = true;
      gruppe.add(mesh);
    }
  }
}

// ---------- Die Materialien ----------
function materialien() {
  const bild = (n, extra = {}) => ({ map: textur(n), ...extra });
  const normal = (n, s = 1) => ({ normalMap: textur(n, { farbe: false }), normalScale: new THREE.Vector2(s, s) });
  const m = {
    putz: new THREE.MeshStandardMaterial({ ...bild('putz.jpg'), ...normal('putz_normal.jpg', 0.8), vertexColors: true, roughness: 0.95 }),
    balken: new THREE.MeshStandardMaterial({ ...bild('bretter.jpg'), ...normal('bretter_normal.jpg'), vertexColors: true, roughness: 0.9 }),
    planken: new THREE.MeshStandardMaterial({ ...bild('planken.jpg'), ...normal('bretter_normal.jpg', 0.7), vertexColors: true, roughness: 0.85 }),
    reet: new THREE.MeshStandardMaterial({ ...bild('reet.jpg'), ...normal('reet_normal.jpg', 1.3), vertexColors: true, roughness: 1, side: THREE.DoubleSide }),
    ziegel: new THREE.MeshStandardMaterial({ ...bild('ziegel.jpg'), ...normal('ziegel_normal.jpg', 1.4), vertexColors: true, roughness: 0.8, side: THREE.DoubleSide }),
    stein: new THREE.MeshStandardMaterial({ ...bild('fels.jpg'), ...normal('fels_normal.jpg'), vertexColors: true, roughness: 0.95 }),
    rinde: new THREE.MeshStandardMaterial({ ...bild('rinde.jpg'), ...normal('rinde_normal.jpg'), vertexColors: true, roughness: 0.95 }),
    bunt: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }),
    metall: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.7 }),
    // Fenster und Laternen leuchten nachts (siehe aktualisiere)
    fenster: new THREE.MeshStandardMaterial({ color: '#7a6a4a', emissive: '#ffb347', emissiveIntensity: 0, roughness: 0.2, metalness: 0.1 }),
    laterne: mat('#fff1c2', { emissive: '#ffbe55', emissiveIntensity: 0 }),
    wasser: new THREE.MeshStandardMaterial({ color: '#2a6a8f', roughness: 0.08, metalness: 0.3 }),
  };
  m.fenster.userData.keinSchatten = true;
  m.laterne.userData.keinSchatten = true;
  return m;
}

// Holzkreis (z. B. Ringbalken) und andere kleine Formen
const kiste = (b, h, t) => new THREE.BoxGeometry(b, h, t);
const rolle = (r, h, seiten = 10) => new THREE.CylinderGeometry(r, r, h, seiten);

// Ein Fass: bauchig, mit zwei Eisenringen
function fass(bs, m, matrix) {
  const profil = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    profil.push(new THREE.Vector2(0.36 + Math.sin(t * Math.PI) * 0.08, t * 1.0));
  }
  bs.add(m.planken, new THREE.LatheGeometry(profil, 12), matrix, { farbe: '#c9a27a', uv: [2, 1] });
  bs.add(m.planken, new THREE.CircleGeometry(0.37, 12).rotateX(-Math.PI / 2).translate(0, 1.0, 0), matrix, { farbe: '#a07a52' });
  for (const y of [0.18, 0.82]) {
    bs.add(m.metall, new THREE.TorusGeometry(0.43, 0.02, 4, 16).rotateX(Math.PI / 2).translate(0, y, 0), matrix, { farbe: '#4a4a4a' });
  }
}

// Ein Holzstapel: Baumstämme liegen übereinander
function holzStapel(bs, m, matrix, z) {
  for (let reihe = 0; reihe < 3; reihe++) {
    const n = 4 - reihe;
    for (let i = 0; i < n; i++) {
      const x = (i - (n - 1) / 2) * 0.3;
      const r = 0.13 + z() * 0.03;
      const lage = M(V(x, 0.14 + reihe * 0.25, (z() - 0.5) * 0.1), Q(Math.PI / 2, 0, 0));
      bs.add(m.rinde, rolle(r, 1.4 + z() * 0.2, 8), matrix.clone().multiply(lage), { farbe: '#d8c8b8', uv: [1, 1] });
      // helle Schnittfläche an beiden Enden
      for (const s of [-1, 1]) {
        const ende = M(V(x, 0.14 + reihe * 0.25, s * 0.72), Q(s > 0 ? 0 : Math.PI, 0, 0));
        bs.add(m.bunt, new THREE.CircleGeometry(r * 0.95, 8), matrix.clone().multiply(ende), { farbe: '#d9b98c' });
      }
    }
  }
}

// Ein Zaun von a nach b (Pfosten + zwei Latten)
function zaun(bs, m, a, b, z) {
  const laenge = a.distanceTo(b);
  const felder = Math.max(1, Math.round(laenge / 1.6));
  const w = Math.atan2(b.x - a.x, b.z - a.z);
  for (let i = 0; i <= felder; i++) {
    const p = a.clone().lerp(b, i / felder);
    bs.add(m.balken, kiste(0.12, 1.05, 0.12), M(V(p.x, 0.5, p.z), Q(0, w + (z() - 0.5) * 0.1, (z() - 0.5) * 0.06)), { farbe: '#b89a7a', uv: [0.2, 1] });
  }
  for (const y of [0.4, 0.8]) {
    const mitte = a.clone().lerp(b, 0.5);
    bs.add(m.balken, kiste(0.06, 0.1, laenge), M(V(mitte.x, y, mitte.z), Q(0, w, 0)), { farbe: '#c4a888', uv: [1, laenge / 2] });
  }
}

// Ein Blumenkasten mit ein paar bunten Blüten
function blumenKasten(bs, m, matrix, z) {
  bs.add(m.planken, kiste(0.8, 0.2, 0.22), matrix, { farbe: '#9a6a44', uv: [1, 0.3] });
  const farben = ['#ff5c8a', '#ffd23d', '#ffffff', '#ff8a3d', '#c04dff'];
  for (let i = 0; i < 6; i++) {
    const p = M(V(-0.3 + i * 0.12, 0.14 + z() * 0.04, (z() - 0.5) * 0.08));
    const gruen = i % 2 === 0;
    bs.add(m.bunt, new THREE.IcosahedronGeometry(gruen ? 0.08 : 0.06, 0), matrix.clone().multiply(p), { farbe: gruen ? '#3f7a2a' : farben[Math.floor(z() * farben.length)] });
  }
}

// ---------- Eine Hütte ----------
// Die Tür zeigt in Richtung +z (die Hütte wird später gedreht)
function huette(bs, m, platz, art, z) {
  const add = (material, geo, lokal, extra) => bs.add(material, geo, platz.clone().multiply(lokal), extra);
  const r = 2.65;
  // Steinsockel
  add(m.stein, new THREE.CylinderGeometry(r + 0.12, r + 0.22, 0.45, 28, 1, true), M(V(0, 0.12, 0)), { farbe: '#b8b0a4', uv: [6, 0.3], verlauf: [0.6, 1] });
  // Wand aus hellem Putz (jede Hütte etwas anders getönt)
  add(m.putz, new THREE.CylinderGeometry(r - 0.05, r, 2.7, 28, 3, true), M(V(0, 1.65, 0)), { farbe: art.wand, uv: [5, 1.4], verlauf: [0.62, 1] });
  // Fachwerk: senkrechte Balken, Ringbalken oben und in der Mitte
  const balkenFarbe = '#8a6a50';
  const luecken = [0, 0.9, -0.9, Math.PI]; // da sind Tür und Fenster
  for (let i = 0; i < 14; i++) {
    const w = (i / 14) * Math.PI * 2 + 0.22;
    if (luecken.some((l) => Math.abs(Math.atan2(Math.sin(w - l), Math.cos(w - l))) < 0.3)) continue;
    add(m.balken, kiste(0.16, 2.7, 0.1), M(V(Math.sin(w) * (r + 0.01), 1.65, Math.cos(w) * (r + 0.01)), Q(0, w, 0)), { farbe: balkenFarbe, uv: [0.15, 1] });
  }
  for (const y of [0.42, 2.95]) {
    add(m.balken, new THREE.TorusGeometry(r + 0.02, 0.09, 4, 28).rotateX(Math.PI / 2), M(V(0, y, 0)), { farbe: balkenFarbe, uv: [8, 0.2] });
  }
  // Tür mit Rahmen, Griff und Trittstein
  add(m.planken, kiste(0.95, 1.85, 0.08), M(V(0, 1.3, r + 0.02)), { farbe: art.tuer, uv: [0.6, 1] });
  add(m.balken, kiste(0.14, 2.05, 0.18), M(V(-0.55, 1.4, r)), { farbe: balkenFarbe, uv: [0.15, 1] });
  add(m.balken, kiste(0.14, 2.05, 0.18), M(V(0.55, 1.4, r)), { farbe: balkenFarbe, uv: [0.15, 1] });
  add(m.balken, kiste(1.3, 0.18, 0.2), M(V(0, 2.35, r + 0.01)), { farbe: balkenFarbe, uv: [0.6, 0.15] });
  add(m.metall, new THREE.SphereGeometry(0.05, 8, 6), M(V(0.3, 1.25, r + 0.09)), { farbe: '#3a3a3a' });
  add(m.stein, new THREE.CylinderGeometry(0.6, 0.65, 0.16, 10), M(V(0, 0.05, r + 0.55)), { farbe: '#a8a29a', uv: [1, 0.2] });
  // Fenster: Glas, Rahmen, Sprossenkreuz, Fensterläden, Blumenkasten
  for (const w of [-0.9, 0.9, Math.PI]) {
    const fpos = (rr, y) => V(Math.sin(w) * rr, y, Math.cos(w) * rr);
    const dreh = Q(0, w, 0);
    const lokal = (x, y, zz) => M(fpos(r, 0).add(V(x, y, zz).applyQuaternion(dreh)), dreh);
    add(m.fenster, new THREE.PlaneGeometry(0.66, 0.62), lokal(0, 1.85, 0.03));
    for (const [x, y, b, h] of [[0, 2.19, 0.86, 0.08], [0, 1.51, 0.9, 0.1], [-0.37, 1.85, 0.08, 0.72], [0.37, 1.85, 0.08, 0.72], [0, 1.85, 0.66, 0.04], [0, 1.85, 0.04, 0.62]]) {
      add(m.balken, kiste(b, h, 0.08), lokal(x, y, 0.06), { farbe: '#f2ead8', uv: [0.2, 0.2] });
    }
    for (const s of [-1, 1]) {
      add(m.planken, kiste(0.36, 0.72, 0.05), lokal(s * 0.6, 1.85, 0.07), { farbe: art.laden, uv: [0.3, 0.6] });
    }
    blumenKasten(bs, m, platz.clone().multiply(lokal(0, 1.38, 0.16)), z);
  }
  // Dach: Reet (dick und weich) oder Ziegel (mit Firstkappe)
  const dachH = art.reet ? 3.0 : 2.7;
  const dach = new THREE.ConeGeometry(3.75, dachH, 32, 4, true);
  const dp = dach.attributes.position;
  for (let i = 0; i < dp.count; i++) {
    const t = (dp.getY(i) + dachH / 2) / dachH; // 0 unten, 1 oben
    const bauch = 1 + Math.sin(t * Math.PI) * (art.reet ? 0.1 : 0.04);
    dp.setXYZ(i, dp.getX(i) * bauch, dp.getY(i), dp.getZ(i) * bauch);
  }
  dach.computeVertexNormals();
  if (art.reet) {
    add(m.reet, dach, M(V(0, 3.0 + dachH / 2, 0)), { farbe: '#d8c8a8', uv: [7, 2] });
    // dicke Reetkante unten
    add(m.reet, new THREE.TorusGeometry(3.68, 0.2, 6, 32).rotateX(Math.PI / 2), M(V(0, 3.02, 0), Q(), V(1, 1, 0.8)), { farbe: '#bfae8c', uv: [10, 0.5] });
    add(m.reet, new THREE.SphereGeometry(0.32, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), M(V(0, 3.0 + dachH - 0.12, 0)), { farbe: '#a8987a' });
  } else {
    add(m.ziegel, dach, M(V(0, 3.0 + dachH / 2, 0)), { farbe: art.dach, uv: [12, 3] });
    add(m.ziegel, new THREE.TorusGeometry(3.7, 0.07, 4, 32).rotateX(Math.PI / 2), M(V(0, 3.02, 0)), { farbe: art.dach, uv: [10, 0.2] });
    add(m.metall, new THREE.ConeGeometry(0.22, 0.5, 8), M(V(0, 3.0 + dachH - 0.05, 0)), { farbe: '#5a4a3a' });
  }
  // Schornstein aus Stein (nur manche Hütten)
  let rauchPunkt = null;
  if (art.schornstein) {
    add(m.stein, kiste(0.55, 2.1, 0.55), M(V(-1.25, 4.6, -0.9)), { farbe: '#c0b4a6', uv: [0.5, 1.6] });
    add(m.stein, kiste(0.7, 0.14, 0.7), M(V(-1.25, 5.7, -0.9)), { farbe: '#9a9086', uv: [0.5, 0.1] });
    rauchPunkt = V(-1.25, 5.85, -0.9).applyMatrix4(platz);
  }
  return rauchPunkt;
}

// ---------- Der Marktstand ----------
function marktstand(bs, m, platz, z, stoffMat) {
  const add = (material, geo, lokal, extra) => bs.add(material, geo, platz.clone().multiply(lokal), extra);
  // Theke: Platte + Vorderwand aus Brettern
  add(m.planken, kiste(3.1, 0.12, 1.3), M(V(0, 1.0, 0)), { farbe: '#c49a6c', uv: [1.5, 0.6] });
  add(m.balken, kiste(3.0, 0.92, 0.08), M(V(0, 0.5, -0.6)), { farbe: '#b08a64', uv: [1.5, 0.5] });
  for (const [x, zz] of [[-1.45, -0.6], [1.45, -0.6], [-1.45, 0.6], [1.45, 0.6]]) {
    add(m.balken, kiste(0.12, 2.7, 0.12), M(V(x, 1.35, zz)), { farbe: '#8a6a50', uv: [0.15, 1] });
  }
  // Querbalken oben
  add(m.balken, kiste(3.1, 0.1, 0.1), M(V(0, 2.62, -0.6)), { farbe: '#8a6a50', uv: [1, 0.1] });
  add(m.balken, kiste(3.1, 0.1, 0.1), M(V(0, 2.62, 0.6)), { farbe: '#8a6a50', uv: [1, 0.1] });
  // Waren: Kisten mit Äpfeln, ein Fass, Holzscheite
  for (const [x, farbe] of [[-1.0, '#d93a2b'], [-0.35, '#7bbf3a'], [0.3, '#f2b02e']]) {
    add(m.planken, kiste(0.55, 0.18, 0.45), M(V(x, 1.15, 0.1)), { farbe: '#d0aa80', uv: [0.4, 0.15] });
    for (let i = 0; i < 6; i++) {
      add(m.bunt, new THREE.SphereGeometry(0.075, 8, 6), M(V(x - 0.17 + (i % 3) * 0.17, 1.29 + z() * 0.03, -0.0 + Math.floor(i / 3) * 0.17)), { farbe });
    }
  }
  add(m.rinde, rolle(0.1, 0.8, 8), M(V(1.0, 1.17, 0.15), Q(0, 0.2, Math.PI / 2)), { farbe: '#d8c8b8' });
  add(m.rinde, rolle(0.1, 0.8, 8), M(V(1.0, 1.17, -0.08), Q(0, -0.1, Math.PI / 2)), { farbe: '#d8c8b8' });
  add(m.rinde, rolle(0.1, 0.8, 8), M(V(1.0, 1.35, 0.03), Q(0, 0.05, Math.PI / 2)), { farbe: '#d8c8b8' });
  fass(bs, m, platz.clone().multiply(M(V(-1.9, 0, 0.4))));
  fass(bs, m, platz.clone().multiply(M(V(-2.1, 0, -0.5), Q(), V(0.85, 0.85, 0.85))));
  // Gestreiftes Sonnendach (Stoff) – eigenes Material mit Streifen-Bild
  const dach = new THREE.CylinderGeometry(1, 1, 3.5, 20, 1, true, -Math.PI / 2, Math.PI);
  dach.rotateZ(Math.PI / 2);
  dach.scale(1, 0.45, 0.78);
  const stoff = new THREE.Mesh(dach, stoffMat);
  stoff.applyMatrix4(platz.clone().multiply(M(V(0, 2.62, 0))));
  stoff.castShadow = true;
  return stoff;
}

// ---------- Der Brunnen ----------
function brunnen(bs, m) {
  bs.add(m.stein, new THREE.CylinderGeometry(1.25, 1.35, 0.85, 20, 1, true), M(V(0, 0.42, 0)), { farbe: '#c8c0b4', uv: [4, 0.6] });
  bs.add(m.stein, new THREE.CylinderGeometry(0.95, 0.95, 0.85, 20, 1, true), M(V(0, 0.42, 0)), { farbe: '#8a847a', uv: [3, 0.6] });
  bs.add(m.stein, new THREE.RingGeometry(0.95, 1.32, 20, 1).rotateX(-Math.PI / 2), M(V(0, 0.86, 0)), { farbe: '#d0c8bc', uv: [1, 1] });
  bs.add(m.wasser, new THREE.CircleGeometry(0.95, 20).rotateX(-Math.PI / 2), M(V(0, 0.62, 0)));
  // Holzgestell mit Dach und Kurbel
  for (const x of [-1.1, 1.1]) bs.add(m.balken, kiste(0.14, 2.6, 0.14), M(V(x, 1.5, 0)), { farbe: '#8a6a50', uv: [0.15, 1] });
  bs.add(m.balken, rolle(0.06, 2.3, 8), M(V(0, 2.1, 0), Q(0, 0, Math.PI / 2)), { farbe: '#a08060' });
  bs.add(m.metall, kiste(0.04, 0.3, 0.04), M(V(1.25, 2.0, 0)), { farbe: '#3a3a3a' });
  bs.add(m.metall, new THREE.CylinderGeometry(0.015, 0.015, 1.1, 4), M(V(0, 1.5, 0)), { farbe: '#6a5a4a' });
  bs.add(m.planken, new THREE.CylinderGeometry(0.15, 0.12, 0.25, 10), M(V(0, 0.95, 0)), { farbe: '#a07a52', uv: [1, 0.3] });
  for (const s of [-1, 1]) {
    bs.add(m.ziegel, kiste(2.8, 0.06, 1.0), M(V(0, 2.98, s * 0.38), Q(s * 0.6, 0, 0)), { farbe: '#b5523b', uv: [3, 1] });
  }
  bs.add(m.balken, kiste(2.9, 0.12, 0.12), M(V(0, 3.18, 0)), { farbe: '#8a6a50', uv: [1, 0.1] });
}

// ---------- Eine Laterne ----------
function laterne(bs, m, x, zz) {
  bs.add(m.metall, new THREE.CylinderGeometry(0.05, 0.08, 2.6, 8), M(V(x, 1.3, zz)), { farbe: '#2e2e2e' });
  bs.add(m.metall, new THREE.CylinderGeometry(0.16, 0.16, 0.06, 8), M(V(x, 2.6, zz)), { farbe: '#2e2e2e' });
  bs.add(m.laterne, new THREE.CylinderGeometry(0.15, 0.12, 0.34, 8), M(V(x, 2.8, zz)));
  bs.add(m.metall, new THREE.ConeGeometry(0.22, 0.2, 8), M(V(x, 3.06, zz)), { farbe: '#2e2e2e' });
  for (let i = 0; i < 4; i++) {
    const w = (i / 4) * Math.PI * 2 + 0.4;
    bs.add(m.metall, kiste(0.025, 0.34, 0.025), M(V(x + Math.cos(w) * 0.15, 2.8, zz + Math.sin(w) * 0.15)), { farbe: '#2e2e2e' });
  }
}

function schild(text) {
  const leinwand = document.createElement('canvas');
  leinwand.width = 256;
  leinwand.height = 96;
  const g = leinwand.getContext('2d');
  g.fillStyle = '#8a5a34';
  g.fillRect(0, 0, 256, 96);
  // ein paar Holz-Maserungs-Striche
  g.strokeStyle = 'rgba(60,35,15,0.35)';
  for (let i = 0; i < 9; i++) {
    g.beginPath();
    g.moveTo(0, 8 + i * 10);
    g.bezierCurveTo(80, 4 + i * 10, 170, 14 + i * 10, 256, 8 + i * 10);
    g.stroke();
  }
  g.strokeStyle = '#5a3a20';
  g.lineWidth = 6;
  g.strokeRect(3, 3, 250, 90);
  g.fillStyle = '#fff6e0';
  g.font = 'bold 54px Trebuchet MS, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 128, 50);
  const t = new THREE.CanvasTexture(leinwand);
  t.colorSpace = THREE.SRGBColorSpace;
  const tafel = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.9, 0.08), [
    mat('#6b4630'), mat('#6b4630'), mat('#6b4630'), mat('#6b4630'),
    new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 }), mat('#6b4630'),
  ]);
  const pfosten = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2, 8), mat('#6b4630'));
  pfosten.position.y = -0.9;
  const gruppe = new THREE.Group();
  tafel.position.y = 0.4;
  tafel.castShadow = pfosten.castShadow = true;
  gruppe.add(tafel, pfosten);
  return gruppe;
}

// Ein weicher, runder Fleck als Bild für den Rauch
function rauchBild() {
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

const RAUCH_PRO_SCHORNSTEIN = 9;

export class Dorf {
  constructor(szene, hindernisse) {
    this.gruppe = new THREE.Group();
    this.gruppe.position.set(DORF.x, DORF.hoehe, DORF.z);
    const z = zufallMitSeed(2024);
    const m = materialien();
    const bs = new Bausatz();

    // Sechs Hütten im Kreis, die Türen zeigen zur Dorfmitte
    const arten = [
      { wand: '#f2dcb4', dach: '#c0644a', reet: false, tuer: '#9a6a44', laden: '#4f7f5a', schornstein: true },
      { wand: '#ecd2a8', reet: true, tuer: '#7a5236', laden: '#8a4a3a', schornstein: false },
      { wand: '#f4d6aa', dach: '#d07a4a', reet: false, tuer: '#a07048', laden: '#3f6f8a', schornstein: true },
      { wand: '#ead8bc', reet: true, tuer: '#6b4a30', laden: '#6a4a8a', schornstein: true },
      { wand: '#f0cfa0', dach: '#8a5a4a', reet: false, tuer: '#8a5a34', laden: '#a8743a', schornstein: false },
      { wand: '#eed8b6', reet: true, tuer: '#9a6a44', laden: '#4f7f5a', schornstein: true },
    ];
    this.rauchQuellen = [];
    const hutPlatz = [];
    for (let i = 0; i < 6; i++) {
      const w = (i / 6) * Math.PI * 2 + 0.3;
      const pos = V(Math.cos(w) * 15, 0, Math.sin(w) * 15);
      const dreh = Math.atan2(-Math.cos(w), -Math.sin(w)); // Tür zeigt zur Dorfmitte
      const platz = M(pos, Q(0, dreh, 0));
      hutPlatz.push({ pos, dreh, platz });
      const rauch = huette(bs, m, platz, arten[i], z);
      if (rauch) this.rauchQuellen.push(rauch);
      hindernisse.hinzufuegen(DORF.x + pos.x, DORF.z + pos.z, 2.9);
    }

    // Neben den Hütten: Holzstapel, Fässer, Zäune und Bänke
    hutPlatz.forEach(({ platz }, i) => {
      const neben = (x, zz, w = 0) => platz.clone().multiply(M(V(x, 0, zz), Q(0, w, 0)));
      if (i % 2 === 0) holzStapel(bs, m, neben(3.3, 0.6, 0.1), z);
      else fass(bs, m, neben(-3.1, 1.2));
      if (i === 1 || i === 4) {
        // kleiner Garten mit Zaun hinter der Hütte
        const ecken = [V(-2.5, 0, -3.3), V(-2.5, 0, -6.5), V(2.5, 0, -6.5), V(2.5, 0, -3.3)].map((p) => p.applyMatrix4(platz));
        for (let k = 0; k < 3; k++) zaun(bs, m, ecken[k], ecken[k + 1], z);
      }
      if (i === 2 || i === 5) {
        // Bank neben der Tür
        bs.add(m.planken, kiste(1.5, 0.08, 0.4), neben(-1.75, 2.6, 0.5).multiply(M(V(0, 0.48, 0))), { farbe: '#b48a60', uv: [0.8, 0.3] });
        for (const s of [-1, 1]) bs.add(m.balken, kiste(0.1, 0.45, 0.35), neben(-1.75, 2.6, 0.5).multiply(M(V(s * 0.6, 0.22, 0))), { farbe: '#8a6a50', uv: [0.1, 0.3] });
      }
    });
    hindernisse.hinzufuegen(DORF.x + hutPlatz[1].pos.x * 1.32, DORF.z + hutPlatz[1].pos.z * 1.32, 2.6);
    hindernisse.hinzufuegen(DORF.x + hutPlatz[4].pos.x * 1.32, DORF.z + hutPlatz[4].pos.z * 1.32, 2.6);

    brunnen(bs, m);
    hindernisse.hinzufuegen(DORF.x, DORF.z, 1.5);

    // Marktstand mit gestreiftem Stoffdach
    const leinwand = document.createElement('canvas');
    leinwand.width = 128;
    leinwand.height = 8;
    const g = leinwand.getContext('2d');
    for (let i = 0; i < 8; i++) {
      g.fillStyle = i % 2 ? '#f4efe2' : '#c8423a';
      g.fillRect(i * 16, 0, 16, 8);
    }
    const streifen = new THREE.CanvasTexture(leinwand);
    streifen.colorSpace = THREE.SRGBColorSpace;
    const stoffMat = new THREE.MeshStandardMaterial({ map: streifen, side: THREE.DoubleSide, roughness: 0.95 });
    const standPlatz = M(V(5, 0, 3), Q(0, -0.9, 0));
    this.gruppe.add(marktstand(bs, m, standPlatz, z, stoffMat));
    hindernisse.hinzufuegen(DORF.x + 5, DORF.z + 3, 1.7);

    // Laternen rund um den Platz – leuchten nachts
    this.laternenMat = m.laterne;
    for (let i = 0; i < 5; i++) {
      const w = (i / 5) * Math.PI * 2;
      laterne(bs, m, Math.cos(w) * 9, Math.sin(w) * 9);
    }
    this.fensterMaterialien = [m.fenster];

    bs.fertig(this.gruppe);

    // Der Händler steht hinter seinem Stand
    const haendler = baueFigur({ shirt: '#3c8d4a', hose: '#5a4632', haare: '#4a3424', haut: '#d9a77c', hut: '#7a5236' });
    this.haendler = haendler.figur;
    this.haendler.position.set(6.1, 0, 3.8);
    this.gruppe.add(this.haendler);
    this.haendlerWelt = new THREE.Vector3(DORF.x + 5, DORF.hoehe, DORF.z + 3);

    this.dorfLicht = new THREE.PointLight('#ffbe6a', 0, 40, 1.5);
    this.dorfLicht.position.set(0, 5, 0);
    this.gruppe.add(this.dorfLicht);

    const tafel = schild('DORF');
    tafel.position.set(-22, 1.8, 18);
    tafel.lookAt(new THREE.Vector3(0, DORF.hoehe + 1.8, 0)); // schaut Richtung Zelt
    this.gruppe.add(tafel);

    // Rauch aus den Schornsteinen: alle Wölkchen zusammen sind EIN Punkte-Modell
    const n = this.rauchQuellen.length * RAUCH_PRO_SCHORNSTEIN;
    this.rauchPos = new Float32Array(n * 3);
    this.rauchFarbe = new Float32Array(n * 4);
    const rauchGeo = new THREE.BufferGeometry();
    rauchGeo.setAttribute('position', new THREE.BufferAttribute(this.rauchPos, 3));
    rauchGeo.setAttribute('color', new THREE.BufferAttribute(this.rauchFarbe, 4));
    this.rauchMat = new THREE.PointsMaterial({ map: rauchBild(), size: 1.6, transparent: true, depthWrite: false, vertexColors: true, color: '#d8d4cc' });
    this.rauch = new THREE.Points(rauchGeo, this.rauchMat);
    this.rauch.frustumCulled = false;
    this.gruppe.add(this.rauch);

    szene.add(this.gruppe);
    this.zeit = 0;
  }

  aktualisiere(dt, helligkeit, spielerPos) {
    this.zeit += dt;
    const nacht = 1 - helligkeit;
    this.laternenMat.emissiveIntensity = nacht * 3;
    for (const f of this.fensterMaterialien) f.emissiveIntensity = 0.05 + nacht * 2;
    this.dorfLicht.intensity = nacht * 60;
    // Der Händler wippt ein bisschen und schaut zur Figur, wenn sie nah ist
    this.haendler.position.y = Math.abs(Math.sin(this.zeit * 2)) * 0.04;
    if (spielerPos.distanceTo(this.haendlerWelt) < 15) {
      const ziel = spielerPos.clone().sub(this.gruppe.position);
      this.haendler.rotation.y = Math.atan2(ziel.x - this.haendler.position.x, ziel.z - this.haendler.position.z);
    }
    // Rauch: jedes Wölkchen steigt auf, wird größer/blasser und fängt dann von vorn an
    const nah = spielerPos.distanceTo(this.gruppe.position) < 160;
    this.rauch.visible = nah;
    if (!nah) return;
    let k = 0;
    const hell = 0.35 + helligkeit * 0.65;
    this.rauchMat.color.setRGB(0.85 * hell, 0.83 * hell, 0.8 * hell);
    for (const q of this.rauchQuellen) {
      for (let i = 0; i < RAUCH_PRO_SCHORNSTEIN; i++, k++) {
        const t = (this.zeit * 0.18 + i / RAUCH_PRO_SCHORNSTEIN + q.x * 0.01) % 1;
        const wind = t * t * 2.2;
        this.rauchPos[k * 3] = q.x + wind + Math.sin(this.zeit * 0.9 + i * 1.7) * 0.25 * t;
        this.rauchPos[k * 3 + 1] = q.y + t * 4.5;
        this.rauchPos[k * 3 + 2] = q.z + wind * 0.5 + Math.cos(this.zeit * 0.7 + i) * 0.25 * t;
        const a = Math.min(1, t * 6) * (1 - t) * 0.55;
        this.rauchFarbe.set([1, 1, 1, a], k * 4);
      }
    }
    this.rauch.geometry.attributes.position.needsUpdate = true;
    this.rauch.geometry.attributes.color.needsUpdate = true;
  }
}
