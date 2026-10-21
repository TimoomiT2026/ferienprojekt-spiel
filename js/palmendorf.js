// =============================================================
//  DAS PALMENDORF – das zweite Dorf auf der Palmeninsel
//  "Palmeninsel mit zweitem Dorf und neuem Händler" (Game Designer, Tag 3)
//
//  Hier stehen runde Strandhütten auf Stelzen (Pfählen), damit bei
//  Flut kein Wasser hineinläuft. Dazu ein Marktstand mit Sonnensegel,
//  Fackeln, die nachts brennen, und ein eigener Händler.
//
//  Wie im ersten Dorf kleben wir alle Teile mit demselben Material zu
//  EINEM Modell zusammen (Bausatz aus dorf.js). So braucht das ganze
//  Dorf nur wenige Malbefehle – gut für das iPad.
// =============================================================
import * as THREE from 'three';
import { EINSTELLUNGEN } from './einstellungen.js';
import { INSELN, bodenHoehe } from './gelaende.js';
import { Bausatz } from './dorf.js';
import { baueFigur } from './figur.js';
import { textur } from './texturen.js';
import { zufallMitSeed } from './rauschen.js';
import { Haendler } from './haendler.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const Q = (x = 0, y = 0, z = 0) => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z));
const M = (pos, rot = Q(), skala = V(1, 1, 1)) => new THREE.Matrix4().compose(pos, rot, skala);
const E = () => EINSTELLUNGEN.palmendorf || {};

// ---------- Die Materialien (jedes Material = ein Malbefehl) ----------
function materialien() {
  const bild = (n) => ({ map: textur(n) });
  const normal = (n, s = 1) => ({ normalMap: textur(n, { farbe: false }), normalScale: new THREE.Vector2(s, s) });
  const m = {
    stroh: new THREE.MeshStandardMaterial({ ...bild('reet.jpg'), ...normal('reet_normal.jpg', 1.3), vertexColors: true, roughness: 1, side: THREE.DoubleSide }),
    planken: new THREE.MeshStandardMaterial({ ...bild('planken.jpg'), ...normal('bretter_normal.jpg', 0.7), vertexColors: true, roughness: 0.85 }),
    stamm: new THREE.MeshStandardMaterial({ ...bild('rinde.jpg'), ...normal('rinde_normal.jpg'), vertexColors: true, roughness: 0.95 }),
    bunt: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }),
    // Runde Fenster leuchten nachts warm (wie im ersten Dorf)
    fenster: new THREE.MeshStandardMaterial({ color: '#7a6a4a', emissive: '#ffb347', emissiveIntensity: 0, roughness: 0.2, metalness: 0.1 }),
    // Die Flammen der Fackeln: leuchten so hell, dass das "Bloom" sie strahlen lässt
    flamme: new THREE.MeshStandardMaterial({ color: '#ffd27a', emissive: '#ff8a2a', emissiveIntensity: 0, roughness: 1 }),
  };
  m.fenster.userData.keinSchatten = true;
  m.flamme.userData.keinSchatten = true;
  return m;
}

// Ein Bambusrohr: grün-gelb mit dunklen Ringen (die "Knoten")
function bambus(bs, m, unten, oben, r = 0.08, farbe = '#d8c27a') {
  const laenge = unten.distanceTo(oben);
  const mitte = unten.clone().lerp(oben, 0.5);
  const dreh = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), oben.clone().sub(unten).normalize());
  bs.add(m.bunt, new THREE.CylinderGeometry(r, r * 1.1, laenge, 8), M(mitte, dreh), { farbe, verlauf: [0.8, 1] });
  const knoten = Math.max(1, Math.floor(laenge / 0.6));
  for (let i = 1; i <= knoten; i++) {
    const p = unten.clone().lerp(oben, i / (knoten + 1));
    bs.add(m.bunt, new THREE.TorusGeometry(r * 1.05, r * 0.25, 4, 10).rotateX(Math.PI / 2), M(p, dreh), { farbe: '#9a8040' });
  }
}

// ---------- Eine Strandhütte auf Stelzen ----------
// Die Tür (und die Treppe) zeigt in Richtung +z (die Hütte wird später gedreht)
function strandHuette(bs, m, platz, art, z) {
  const add = (material, geo, lokal, extra) => bs.add(material, geo, platz.clone().multiply(lokal), extra);
  const boden = 1.35; // so hoch steht der Holzboden über dem Sand
  const r = 2.0; // Radius der Wand
  // Stelzen: dicke Holzpfähle im Kreis + einer in der Mitte
  for (let i = 0; i < 7; i++) {
    const w = (i / 7) * Math.PI * 2 + 0.3;
    add(m.stamm, new THREE.CylinderGeometry(0.13, 0.16, boden + 0.1, 8), M(V(Math.sin(w) * 2.25, boden / 2, Math.cos(w) * 2.25), Q(0, w, (z() - 0.5) * 0.06)), { farbe: '#c8b8a4', uv: [0.5, 0.6] });
  }
  add(m.stamm, new THREE.CylinderGeometry(0.16, 0.2, boden, 8), M(V(0, boden / 2, 0)), { farbe: '#b8a894', uv: [0.5, 0.6] });
  // Runder Holzboden mit dickem Rand
  add(m.planken, new THREE.CylinderGeometry(2.7, 2.7, 0.18, 28), M(V(0, boden, 0)), { farbe: '#c9a478', uv: [3, 3] });
  add(m.planken, new THREE.TorusGeometry(2.7, 0.1, 6, 28).rotateX(Math.PI / 2), M(V(0, boden + 0.02, 0)), { farbe: '#9a7650', uv: [8, 0.2] });
  // Geländer aus Seil: Pfosten am Rand und ein dickes Seil dazwischen
  for (let i = 0; i < 10; i++) {
    const w = (i / 10) * Math.PI * 2 + Math.PI / 10;
    if (Math.abs(Math.atan2(Math.sin(w), Math.cos(w))) < 0.45) continue; // vorne ist die Treppe
    const p = (y) => V(Math.sin(w) * 2.55, y, Math.cos(w) * 2.55).applyMatrix4(platz);
    bambus(bs, m, p(boden), p(boden + 0.85), 0.05, '#cdb26a');
  }
  add(m.bunt, new THREE.TorusGeometry(2.55, 0.035, 5, 32, Math.PI * 2 - 0.9).rotateX(Math.PI / 2).rotateY(-(Math.PI / 2 + 0.45)), M(V(0, boden + 0.75, 0)), { farbe: '#d9c49a' });
  // Wand: ein runder Korb aus Bambusrohren, dahinter eine helle Matte
  add(m.stroh, new THREE.CylinderGeometry(r - 0.05, r, 2.0, 24, 2, true), M(V(0, boden + 1.05, 0)), { farbe: art.matte, uv: [6, 1.2], verlauf: [0.7, 1] });
  const luecken = [0, Math.PI / 2, -Math.PI / 2]; // Tür vorne, Fenster links und rechts
  for (let i = 0; i < 26; i++) {
    const w = (i / 26) * Math.PI * 2;
    if (luecken.some((l) => Math.abs(Math.atan2(Math.sin(w - l), Math.cos(w - l))) < 0.28)) continue;
    const p = (y) => V(Math.sin(w) * (r + 0.04), y, Math.cos(w) * (r + 0.04)).applyMatrix4(platz);
    bambus(bs, m, p(boden + 0.05), p(boden + 2.08), 0.065, i % 3 ? art.bambus : '#c8b060');
  }
  // Tür: ein bunter Vorhang (oben rund, nicht eckig)
  const vorhang = new THREE.CircleGeometry(0.5, 16, 0, Math.PI);
  add(m.bunt, new THREE.PlaneGeometry(1.0, 1.2), M(V(0, boden + 0.62, r + 0.03)), { farbe: art.vorhang });
  add(m.bunt, vorhang, M(V(0, boden + 1.22, r + 0.03)), { farbe: art.vorhang });
  add(m.bunt, new THREE.PlaneGeometry(1.0, 0.12), M(V(0, boden + 0.4, r + 0.04)), { farbe: '#fff3d6' }); // Streifen
  // Runde Fenster (Bullaugen) mit dickem Rahmen
  for (const w of [Math.PI / 2, -Math.PI / 2]) {
    const dreh = Q(0, w, 0);
    const p = V(Math.sin(w) * (r + 0.05), boden + 1.25, Math.cos(w) * (r + 0.05));
    add(m.fenster, new THREE.CircleGeometry(0.36, 16), M(p, dreh));
    add(m.planken, new THREE.TorusGeometry(0.4, 0.07, 6, 18), M(p, dreh), { farbe: '#9a7650', uv: [2, 0.2] });
  }
  // Treppe vorne: drei Stufen und zwei Holme
  for (let i = 0; i < 3; i++) {
    const t = (i + 1) / 4;
    add(m.planken, new THREE.BoxGeometry(1.1, 0.08, 0.36), M(V(0, boden * t, 2.7 + (1 - t) * 1.5)), { farbe: '#c49a6c', uv: [0.8, 0.3] });
  }
  for (const s of [-1, 1]) {
    const unten = V(s * 0.6, 0, 4.3).applyMatrix4(platz), oben = V(s * 0.6, boden + 0.7, 2.6).applyMatrix4(platz);
    bambus(bs, m, unten, oben, 0.06, '#c8b060');
  }
  // Strohdach: spitz, bauchig und mit Fransen unten
  const dachH = 2.9;
  const dach = new THREE.ConeGeometry(3.25, dachH, 28, 5, true);
  const dp = dach.attributes.position;
  for (let i = 0; i < dp.count; i++) {
    const t = (dp.getY(i) + dachH / 2) / dachH; // 0 unten, 1 oben
    const bauch = 1 + Math.sin(t * Math.PI) * 0.12;
    dp.setXYZ(i, dp.getX(i) * bauch, dp.getY(i), dp.getZ(i) * bauch);
  }
  dach.computeVertexNormals();
  const dachY = boden + 2.05;
  add(m.stroh, dach, M(V(0, dachY + dachH / 2, 0), Q(0, art.dreh, 0)), { farbe: art.dach, uv: [6, 2] });
  // Fransen: ein Ring, dessen untere Kante zickzackt (wie ausgefranstes Stroh)
  const fransen = new THREE.CylinderGeometry(3.25, 3.4, 0.55, 56, 1, true);
  const fp = fransen.attributes.position;
  for (let i = 0; i < fp.count; i++) {
    if (fp.getY(i) < 0) fp.setY(i, fp.getY(i) - (i % 2) * 0.25 - z() * 0.12);
  }
  fransen.computeVertexNormals();
  add(m.stroh, fransen, M(V(0, dachY - 0.05, 0)), { farbe: art.dach, uv: [10, 0.4], verlauf: [0.8, 1] });
  // Spitze: ein Knubbel und ein Stäbchen mit kleiner Muschel-Kugel
  add(m.stroh, new THREE.SphereGeometry(0.28, 10, 6), M(V(0, dachY + dachH - 0.1, 0)), { farbe: '#a8987a' });
  add(m.bunt, new THREE.CylinderGeometry(0.03, 0.03, 0.7, 5), M(V(0, dachY + dachH + 0.3, 0)), { farbe: '#8a6a50' });
  add(m.bunt, new THREE.SphereGeometry(0.11, 10, 8), M(V(0, dachY + dachH + 0.7, 0)), { farbe: art.vorhang });
}

// Ein Surfbrett, angelehnt (rund wie eine plattgedrückte Kapsel)
function surfbrett(bs, m, matrix, farbe) {
  bs.add(m.bunt, new THREE.CapsuleGeometry(0.28, 1.6, 6, 14), matrix.clone().multiply(M(V(0, 1.1, 0), Q(-0.25, 0, 0), V(1, 1, 0.18))), { farbe });
  bs.add(m.bunt, new THREE.BoxGeometry(0.05, 1.9, 0.07), matrix.clone().multiply(M(V(0, 1.1, 0.03), Q(-0.25, 0, 0))), { farbe: '#ffffff' });
}

// Ein Haufen Kokosnüsse
function kokosHaufen(bs, m, matrix, z) {
  for (let i = 0; i < 6; i++) {
    const lage = i < 4 ? V((i % 2 - 0.5) * 0.36, 0.16, (Math.floor(i / 2) - 0.5) * 0.36) : V((i - 4.5) * 0.3, 0.42, 0);
    bs.add(m.bunt, new THREE.SphereGeometry(0.18, 10, 8), matrix.clone().multiply(M(lage, Q(z(), z(), 0), V(1, 0.92, 1))), { farbe: '#6b4a2e' });
  }
}

// ---------- Der Marktstand mit Sonnensegel ----------
function marktstand(bs, m, platz, z, segelMat) {
  const add = (material, geo, lokal, extra) => bs.add(material, geo, platz.clone().multiply(lokal), extra);
  // Theke: eine runde Holzplatte auf zwei Fässern aus Bambus
  add(m.planken, new THREE.CapsuleGeometry(0.6, 2.2, 4, 12).rotateZ(Math.PI / 2), M(V(0, 1.0, 0), Q(), V(1, 0.12, 1)), { farbe: '#c49a6c', uv: [1.5, 0.6] });
  for (const x of [-1.1, 1.1]) {
    add(m.planken, new THREE.CylinderGeometry(0.42, 0.42, 0.92, 14), M(V(x, 0.46, 0)), { farbe: '#b08a64', uv: [1.5, 0.6] });
    add(m.bunt, new THREE.TorusGeometry(0.43, 0.03, 4, 16).rotateX(Math.PI / 2), M(V(x, 0.7, 0)), { farbe: '#8a6a40' });
    add(m.bunt, new THREE.TorusGeometry(0.43, 0.03, 4, 16).rotateX(Math.PI / 2), M(V(x, 0.2, 0)), { farbe: '#8a6a40' });
  }
  // Waren auf der Theke: Brote, Äpfel, ein Eimer Würmer und Holz
  for (let i = 0; i < 3; i++) {
    add(m.bunt, new THREE.CapsuleGeometry(0.11, 0.22, 4, 10).rotateZ(Math.PI / 2), M(V(-1.15 + i * 0.28, 1.16, 0.05 + (i % 2) * 0.12), Q(0, 0.3 * i, 0)), { farbe: '#c98a3e' });
  }
  for (let i = 0; i < 7; i++) {
    add(m.bunt, new THREE.SphereGeometry(0.075, 8, 6), M(V(-0.3 + (i % 4) * 0.15, 1.15 + Math.floor(i / 4) * 0.1, -0.05 + Math.floor(i / 4) * 0.05)), { farbe: i % 3 ? '#d93a2b' : '#e8b030' });
  }
  add(m.bunt, new THREE.CylinderGeometry(0.17, 0.14, 0.26, 12, 1, true), M(V(0.45, 1.2, 0.05)), { farbe: '#7a8a96' });
  add(m.bunt, new THREE.CircleGeometry(0.16, 12).rotateX(-Math.PI / 2), M(V(0.45, 1.28, 0.05)), { farbe: '#5a3a22' });
  for (let i = 0; i < 4; i++) {
    const w = i * 1.6;
    add(m.bunt, new THREE.CapsuleGeometry(0.02, 0.12, 3, 6), M(V(0.45 + Math.cos(w) * 0.07, 1.31, 0.05 + Math.sin(w) * 0.07), Q(0.9, w, 0)), { farbe: '#e88a9a' });
  }
  for (let i = 0; i < 3; i++) {
    add(m.stamm, new THREE.CylinderGeometry(0.09, 0.09, 0.7, 8), M(V(1.1, 1.15 + (i === 2 ? 0.15 : 0), (i - 1) * 0.16 * (i === 2 ? 0 : 1)), Q(0, 0, Math.PI / 2)), { farbe: '#d8c8b8' });
  }
  // Kokosnüsse vor dem Stand (nur zum Anschauen)
  kokosHaufen(bs, m, platz.clone().multiply(M(V(-1.9, 0, 0.9))), z);
  // Sonnensegel: drei schiefe Bambusstangen und ein dreieckiges, durchhängendes Tuch
  const ecken = [V(-2.2, 3.4, -1.1), V(2.3, 3.0, -1.2), V(0.2, 2.5, 2.2)];
  for (const e of ecken) {
    bambus(bs, m, V(e.x * 1.08, 0, e.z * 1.08).applyMatrix4(platz), e.clone().applyMatrix4(platz), 0.08);
  }
  const n = 10, pos = [], uv = [], index = [];
  const nummer = (i, j) => (i * (2 * n + 3 - i)) / 2 + j; // Punkte im Dreieck durchzählen
  for (let i = 0; i <= n; i++) {
    for (let j = 0; j <= n - i; j++) {
      const a = i / n, b = j / n, c = 1 - a - b;
      const p = ecken[0].clone().multiplyScalar(c).addScaledVector(ecken[1], a).addScaledVector(ecken[2], b);
      p.y -= a * b * c * 27 * 0.35; // in der Mitte hängt das Tuch etwas durch
      pos.push(p.x, p.y, p.z);
      uv.push(a * 4, b);
      if (i < n && j < n - i) {
        index.push(nummer(i, j), nummer(i + 1, j), nummer(i, j + 1));
        if (j < n - i - 1) index.push(nummer(i + 1, j), nummer(i + 1, j + 1), nummer(i, j + 1));
      }
    }
  }
  const tuch = new THREE.BufferGeometry();
  tuch.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  tuch.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  tuch.setIndex(index);
  tuch.computeVertexNormals();
  tuch.applyMatrix4(platz);
  const segel = new THREE.Mesh(tuch, segelMat);
  segel.castShadow = true;
  return segel;
}

// ---------- Eine Fackel (wie eine Tiki-Fackel am Strand) ----------
function fackel(bs, m, x, zz) {
  bambus(bs, m, V(x, 0, zz), V(x, 2.0, zz), 0.07);
  // Schale aus Kokosnuss für das Feuer
  bs.add(m.bunt, new THREE.SphereGeometry(0.2, 10, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), M(V(x, 2.18, zz)), { farbe: '#6b4a2e' });
  bs.add(m.bunt, new THREE.TorusGeometry(0.19, 0.035, 5, 12).rotateX(Math.PI / 2), M(V(x, 2.18, zz)), { farbe: '#4a3020' });
  // Die Flamme: rund unten, spitz oben (wie ein Tropfen)
  bs.add(m.flamme, new THREE.SphereGeometry(0.15, 10, 8), M(V(x, 2.3, zz), Q(), V(1, 1.1, 1)));
  bs.add(m.flamme, new THREE.ConeGeometry(0.13, 0.42, 10), M(V(x, 2.55, zz)));
}

// ---------- Die Feuerstelle in der Mitte (Steine + zwei Baumstamm-Bänke) ----------
function feuerStelle(bs, m, z) {
  for (let i = 0; i < 9; i++) {
    const w = (i / 9) * Math.PI * 2;
    bs.add(m.bunt, new THREE.IcosahedronGeometry(0.28, 1), M(V(Math.cos(w) * 0.85, 0.1, Math.sin(w) * 0.85), Q(z(), z(), z()), V(1, 0.6, 1)), { farbe: i % 2 ? '#a8a29a' : '#bcb4a8' });
  }
  for (const w of [0.4, 0.4 + Math.PI]) {
    bs.add(m.stamm, new THREE.CylinderGeometry(0.28, 0.3, 2.2, 10), M(V(Math.cos(w) * 2.4, 0.25, Math.sin(w) * 2.4), Q(Math.PI / 2, 0, 0).premultiply(Q(0, -w, 0))), { farbe: '#c8b8a4', uv: [1, 1] });
  }
  // ein paar verkohlte Holzscheite (das Feuer ist aus – anzünden geht nur am eigenen Lagerfeuer)
  for (let i = 0; i < 3; i++) {
    bs.add(m.bunt, new THREE.CylinderGeometry(0.08, 0.08, 0.8, 6), M(V(0, 0.12, 0), Q(Math.PI / 2, 0, 0).premultiply(Q(0, i * 1.05, 0))), { farbe: '#3a2a22' });
  }
}

// ---------- Ortsschild ----------
function schild(text) {
  const leinwand = document.createElement('canvas');
  leinwand.width = 384;
  leinwand.height = 96;
  const g = leinwand.getContext('2d');
  g.fillStyle = '#9a6a3a';
  g.fillRect(0, 0, 384, 96);
  g.strokeStyle = 'rgba(60,35,15,0.35)';
  for (let i = 0; i < 9; i++) {
    g.beginPath();
    g.moveTo(0, 8 + i * 10);
    g.bezierCurveTo(120, 4 + i * 10, 260, 14 + i * 10, 384, 8 + i * 10);
    g.stroke();
  }
  g.strokeStyle = '#5a3a20';
  g.lineWidth = 6;
  g.strokeRect(3, 3, 378, 90);
  g.fillStyle = '#fff6e0';
  g.font = 'bold 50px Trebuchet MS, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 192, 50);
  const t = new THREE.CanvasTexture(leinwand);
  t.colorSpace = THREE.SRGBColorSpace;
  // Vorder- und Rückseite in einem Modell (Rückseite: nur Holz)
  const tafel = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.8), new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 }));
  tafel.position.set(0, 0.4, 0.05);
  tafel.castShadow = true;
  return tafel;
}

export class Palmendorf {
  constructor(szene, hindernisse, spiel) {
    this.spiel = spiel; // { rucksack, meldung, musik, tageszeit, elternElement }
    this.interaktionen = [];
    this.zeit = 0;
    // Wo ist der Dorfplatz? (steht in einstellungen.js bei der Palmeninsel)
    const insel = INSELN.find((I) => I.name === 'Palmeninsel' && I.dorfPlatz) || INSELN.slice(1).find((I) => I.dorfPlatz);
    const platz = insel.dorfPlatz;
    this.mitte = V(platz.x, platz.hoehe, platz.z);

    this.gruppe = new THREE.Group();
    this.gruppe.position.copy(this.mitte);
    this.gruppe.visible = false; // erst sichtbar, wenn man nah genug ist
    const z = zufallMitSeed(1717);
    const m = materialien();
    const bs = new Bausatz();

    // Die Strandhütten im Halbkreis. Nach Osten (zur Startinsel, +x) bleibt
    // der Eingang frei – von da kommen Boot und Ballon.
    const arten = [
      { matte: '#e8d6aa', bambus: '#d8c27a', dach: '#d8c090', vorhang: '#2bb3b0', dreh: 0.2 },
      { matte: '#ead8b0', bambus: '#d2bc72', dach: '#cdb284', vorhang: '#ff7a4a', dreh: 1.1 },
      { matte: '#e2cfa0', bambus: '#dcc884', dach: '#d4b98a', vorhang: '#ffcf3d', dreh: 2.3 },
      { matte: '#ecdcb6', bambus: '#d6c07c', dach: '#c8ae80', vorhang: '#e8508a', dreh: 0.7 },
      { matte: '#e6d4a8', bambus: '#d8c27a', dach: '#d0b688', vorhang: '#6a8af0', dreh: 1.7 },
    ];
    const anzahl = Math.max(1, Math.min(arten.length, E().huetten ?? 4));
    this.huettenPlaetze = [];
    for (let i = 0; i < anzahl; i++) {
      // Winkel von 60° bis 300° (0° = Osten), gleichmäßig verteilt
      const grad = anzahl === 1 ? 180 : 60 + (i / (anzahl - 1)) * 240;
      const w = THREE.MathUtils.degToRad(grad);
      const abstand = 12 + (i % 2) * 1.5;
      const pos = V(Math.cos(w) * abstand, 0, Math.sin(w) * abstand);
      const dreh = Math.atan2(-pos.x, -pos.z); // Treppe zeigt zur Dorfmitte
      const hp = M(pos, Q(0, dreh, 0));
      strandHuette(bs, m, hp, arten[i], z);
      hindernisse.hinzufuegen(this.mitte.x + pos.x, this.mitte.z + pos.z, 2.9);
      this.huettenPlaetze.push(pos);
      // Neben jeder zweiten Hütte: ein Surfbrett oder ein Kokos-Haufen
      const neben = hp.clone().multiply(M(V(3.1, 0, 0.8), Q(0, -0.6, 0)));
      if (i % 2 === 0) surfbrett(bs, m, neben, arten[i].vorhang);
      else kokosHaufen(bs, m, neben, z);
    }

    // Feuerstelle in der Mitte
    feuerStelle(bs, m, z);
    hindernisse.hinzufuegen(this.mitte.x, this.mitte.z, 1.2);

    // Marktstand an der Ostseite: der Händler schaut zu den Leuten, die vom Strand kommen
    const leinwand = document.createElement('canvas');
    leinwand.width = 128;
    leinwand.height = 8;
    const g = leinwand.getContext('2d');
    for (let i = 0; i < 8; i++) {
      g.fillStyle = i % 2 ? '#fdf6e4' : '#21a5a8';
      g.fillRect(i * 16, 0, 16, 8);
    }
    const streifen = new THREE.CanvasTexture(leinwand);
    streifen.colorSpace = THREE.SRGBColorSpace;
    streifen.wrapS = THREE.RepeatWrapping;
    const segelMat = new THREE.MeshStandardMaterial({ map: streifen, side: THREE.DoubleSide, roughness: 0.95 });
    const standPos = V(8.5, 0, 0);
    const standDreh = Math.PI / 2; // die Theke zeigt nach Osten (+x)
    const standPlatz = M(standPos, Q(0, standDreh, 0));
    this.gruppe.add(marktstand(bs, m, standPlatz, z, segelMat));
    hindernisse.hinzufuegen(this.mitte.x + standPos.x, this.mitte.z + standPos.z, 1.6);

    // Fackeln rund um den Platz – brennen nur nachts
    const fackeln = E().fackeln ?? 6;
    for (let i = 0; i < fackeln; i++) {
      const w = ((i + 0.5) / fackeln) * Math.PI * 2; // keine Fackel genau vor dem Marktstand
      fackel(bs, m, Math.cos(w) * 8.5, Math.sin(w) * 8.5);
    }
    this.flammenMat = m.flamme;
    this.fensterMat = m.fenster;

    bs.fertig(this.gruppe);
    // Das Flammen-Modell finden: tagsüber ist es unsichtbar (Fackeln aus)
    this.flammen = this.gruppe.children.find((k) => k.material === m.flamme);

    // Der Palmen-Händler: Hawaii-Hemd, kurze helle Hose, Strohhut, kein Bart
    const figur = baueFigur({ shirt: '#ff7a3d', hose: '#efe2c0', haare: '#2a1d14', haut: '#b97a4e', hut: '#e8cf8a', bart: false });
    this.figur = figur.figur;
    // Blumenkette um den Hals (bunte Kügelchen, zusammengeklebt)
    const kette = new Bausatz();
    for (let i = 0; i < 14; i++) {
      const w = (i / 14) * Math.PI * 2;
      kette.add(m.bunt, new THREE.SphereGeometry(0.06, 8, 6), M(V(Math.sin(w) * 0.3, 1.56 - Math.max(0, Math.cos(w)) * 0.08, Math.cos(w) * 0.27)), { farbe: ['#ff5c8a', '#ffd23d', '#ffffff'][i % 3] });
    }
    kette.fertig(this.figur);
    // Er steht hinter der Theke (die Theke zeigt nach Osten, also steht er westlich davon)
    const hinter = V(0, 0, -0.95).applyAxisAngle(V(0, 1, 0), standDreh);
    this.figur.position.copy(standPos).add(hinter);
    this.figur.rotation.y = standDreh;
    this.gruppe.add(this.figur);
    // Hier muss man stehen zum Handeln (vor der Theke)
    const vorne = V(0, 0, 1.2).applyAxisAngle(V(0, 1, 0), standDreh);
    this.haendlerWelt = this.mitte.clone().add(standPos).add(vorne);

    // Ortsschild am Eingang (Osten), schaut zum Strand
    const tafel = schild('PALMENDORF');
    const sx = this.mitte.x + 21, sz = this.mitte.z + 3;
    const pfosten = new THREE.Group();
    pfosten.position.set(sx - this.mitte.x, bodenHoehe(sx, sz) - this.mitte.y + 1.6, sz - this.mitte.z);
    pfosten.rotation.y = Math.PI / 2; // Vorderseite zeigt nach +x (Osten)
    pfosten.add(tafel);
    this.gruppe.add(pfosten);
    const sb = new Bausatz();
    for (const s of [-1, 1]) bambus(sb, m, V(0, -1.7, s * 1.35).add(pfosten.position), V(0, 0.9, s * 1.35).add(pfosten.position), 0.07);
    sb.fertig(this.gruppe);
    hindernisse.hinzufuegen(sx, sz, 0.6);

    szene.add(this.gruppe);

    // ---------- Der zweite Händler hat sein EIGENES Angebot ----------
    this.haendler = new Haendler(spiel, {
      name: 'Palmen-Händler',
      bild: '🌴',
      fensterId: 'palmendorf-fenster',
      kaufPreise: E().kaufPreise || { brot: 25, apfel: 4, koeder: 3, holz: 12 },
      kauftProTag: E().kauftProTag ?? 10,
      gruss: '„Hallo, Forscher! Willkommen im Palmendorf. Was brauchst du?“',
    });

    // Handeln (nachts schläft er – wie der Händler im ersten Dorf)
    const tageszeit = spiel.tageszeit;
    this.interaktionen.push({
      pos: this.haendlerWelt,
      radius: 4.5,
      get bild() { return tageszeit.istNacht() ? '💤' : '🧑‍🌾'; },
      get text() { return tageszeit.istNacht() ? 'Schläft' : 'Handeln'; },
      ausfuehren: () => {
        if (tageszeit.istNacht()) spiel.meldung('💤 Pssst! Der Palmen-Händler schläft. Komm morgen früh wieder.', 4);
        else this.haendler.oeffnen();
      },
    });
  }

  // Nachts geht der Händler schlafen (main.js ruft das beim Wechsel Tag/Nacht auf)
  setzeNacht(nacht) {
    this.figur.visible = !nacht;
    if (nacht && this.haendler.offen) this.haendler.schliessen();
  }

  aktualisiere(dt, helligkeit, spielerPos) {
    this.zeit += dt;
    // Weit weg? Dann gar nicht malen und nichts rechnen
    const abstand = Math.hypot(spielerPos.x - this.mitte.x, spielerPos.z - this.mitte.z);
    this.gruppe.visible = abstand < (E().sichtweite ?? 320);
    if (!this.gruppe.visible) return;
    const nacht = 1 - helligkeit;
    // Fackeln: nachts an, mit leichtem Flackern
    const flackern = 0.85 + Math.sin(this.zeit * 11) * 0.08 + Math.sin(this.zeit * 17.3) * 0.07;
    this.flammenMat.emissiveIntensity = nacht * (E().fackelLeuchten ?? 3.5) * flackern;
    if (this.flammen) this.flammen.visible = nacht > 0.15;
    this.fensterMat.emissiveIntensity = 0.05 + nacht * 2;
    // Der Händler wippt ein bisschen und schaut zur Figur, wenn sie nah ist
    this.figur.position.y = Math.abs(Math.sin(this.zeit * 2)) * 0.04;
    if (this.figur.visible && abstand < 25) {
      const ziel = spielerPos.clone().sub(this.gruppe.position);
      this.figur.rotation.y = Math.atan2(ziel.x - this.figur.position.x, ziel.z - this.figur.position.z);
    }
  }

  // Für den Spielstand (nur der Palmen-Händler – das Dorf selbst ändert sich nicht)
  alsDaten() {
    return { haendler: this.haendler.alsDaten() };
  }

  ladeDaten(d = {}) {
    if (d.haendler) this.haendler.ladeDaten(d.haendler);
  }
}
