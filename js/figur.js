// =============================================================
//  FIGUREN – unsere Spielfigur und die Dorfbewohner
//  Alles aus runden Formen: Kapseln und Kugeln
// =============================================================
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// ---------- Werkzeuge: Spaten und Schwert ----------
// Beide sind aus wenigen Teilen gebaut, die zu 2 Modellen zusammengeklebt werden
// (Holz/Leder und Metall) – so muss das iPad nur 2× malen.

const weich = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// Eine gebogene Fläche aus einem Gitter (wie ein Netz aus Punkten).
// punkt(u, v) gibt [x, y, z, Farbe] zurück. u geht von -1 bis 1, v von 0 bis 1.
// umdrehen = die Rückseite (damit man sie von hinten sieht)
function gitterFlaeche(nu, nv, punkt, umdrehen = false) {
  const pos = [], farben = [], uv = [], index = [];
  const c = new THREE.Color();
  for (let j = 0; j <= nv; j++) {
    for (let i = 0; i <= nu; i++) {
      const u = (i / nu) * 2 - 1, v = j / nv;
      const [x, y, z, farbe] = punkt(u, v);
      pos.push(x, y, z);
      c.set(farbe);
      farben.push(c.r, c.g, c.b);
      uv.push(i / nu, v);
    }
  }
  for (let j = 0; j < nv; j++) {
    for (let i = 0; i < nu; i++) {
      const a = j * (nu + 1) + i, b = a + 1, d = a + nu + 1, e = d + 1;
      if (umdrehen) index.push(a, d, b, b, d, e);
      else index.push(a, b, d, b, e, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(farben, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

// Holz-Maserung: ein kleines Bild mit feinen Streifen (wird nur einmal gemalt)
let maserung = null;
function holzMaserung() {
  if (maserung) return maserung;
  const leinwand = document.createElement('canvas');
  leinwand.width = 64;
  leinwand.height = 256;
  const ctx = leinwand.getContext('2d');
  const bild = ctx.createImageData(64, 256);
  for (let y = 0; y < 256; y++) {
    for (let x = 0; x < 64; x++) {
      // Wellige Linien entlang des Stiels – wie Jahresringe im Holz
      const welle = x + Math.sin(y * 0.05 + x * 0.2) * 3 + Math.sin(y * 0.013) * 6;
      const streifen = 0.5 + 0.5 * Math.sin(welle * 0.9) * Math.sin(welle * 0.31 + 1.7);
      const hell = 0.66 + 0.34 * (1 - streifen * streifen);
      const k = (y * 64 + x) * 4;
      bild.data[k] = 255 * hell;
      bild.data[k + 1] = 250 * hell;
      bild.data[k + 2] = 240 * hell;
      bild.data[k + 3] = 255;
    }
  }
  ctx.putImageData(bild, 0, 0);
  maserung = new THREE.CanvasTexture(leinwand);
  maserung.colorSpace = THREE.SRGBColorSpace;
  maserung.wrapS = maserung.wrapT = THREE.RepeatWrapping;
  return maserung;
}

// Färbt jeden Punkt einer Form nach einer Regel: farbe(x, y, z) → Farbe
function faerben(geo, farbe) {
  const p = geo.attributes.position, c = new THREE.Color();
  const f = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    c.set(farbe(p.getX(i), p.getY(i), p.getZ(i)));
    f.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(f, 3));
  return geo;
}

// ---------- Der Spaten ----------
// Er steht senkrecht: unten das Metallblatt (Spitze bei y = -0,30),
// oben der Holzstiel mit dem D-Griff (bis y ≈ 1,18).
// inDerHand = true: für die Hand der Figur. Sonst liegt er flach auf dem Boden
// (objekte.js dreht ihn dafür um 90° und hebt ihn 0,3 m an).
export function baueSchaufel(inDerHand = false) {
  const holz = [], metall = [];
  const stahl = new THREE.Color('#7d8a98'), schneide = new THREE.Color('#f2f6fa'), dreck = new THREE.Color('#6e5a44');

  // --- Das Blatt: ein leicht gewölbtes Blech mit runder Spitze ---
  const breite = (v) => 0.118 * (0.93 + 0.07 * v) * (v < 0.38 ? Math.sqrt(1 - (1 - v / 0.38) ** 2) : 1);
  const woelbung = (u, v) => 0.03 * u * u + 0.014 * (1 - v) * (1 - v); // Mulde + Spitze leicht nach vorne
  const blattPunkt = (seite) => (u, v) => {
    const w = breite(v);
    const dicke = 0.007 * Math.sqrt(Math.max(0, 1 - u * u)) * Math.sqrt(w / 0.118) + 0.0004;
    // Am Rand und an der Spitze glänzt die geschliffene Schneide hell, unten klebt etwas Erde
    const rand = Math.max(weich(0.8, 1, Math.abs(u)), weich(0.22, 0.04, v));
    const farbe = stahl.clone().lerp(schneide, rand * 0.85).lerp(dreck, weich(0.3, 0.0, v) * 0.25 * (1 - rand));
    return [woelbung(u, v) + seite * dicke, -0.3 + v * 0.3, u * w, farbe];
  };
  metall.push(gitterFlaeche(12, 10, blattPunkt(1)));
  metall.push(gitterFlaeche(12, 10, blattPunkt(-1), true));

  // --- Tritt-Kante oben am Blatt (da drückt man mit dem Fuß drauf) ---
  const tritt = [];
  for (let i = 0; i <= 10; i++) {
    const u = (i / 10) * 2 - 1;
    tritt.push(new THREE.Vector3(woelbung(u, 1) - 0.01, 0.004 - Math.abs(u) * 0.006, u * breite(1)));
  }
  metall.push(faerben(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(tritt), 12, 0.012, 6), () => '#b4bec9'));
  for (const s of [-1, 1]) metall.push(teil(new THREE.SphereGeometry(0.012, 6, 4), '#b4bec9', [woelbung(s, 1) - 0.01, -0.002, s * breite(1)]));

  // --- Die Tülle: das runde Metallrohr, in dem der Stiel steckt ---
  const tuelle = dreh([[0.004, -0.14], [0.02, -0.08], [0.03, -0.015], [0.028, 0.13], [0.034, 0.142], [0.034, 0.162], [0.027, 0.17]], 12);
  metall.push(teil(tuelle, '#8d99a6', [-0.004, 0, 0], [0.75, 1, 1]));
  // Nieten (kleine runde Knöpfe) vorne und hinten
  for (const y of [0.035, 0.1]) {
    for (const s of [-1, 1]) metall.push(teil(new THREE.SphereGeometry(0.008, 6, 4), '#5d6670', [-0.004 + s * 0.022, y, 0]));
  }
  // Metallring oben am Stiel (unter dem Griff)
  metall.push(teil(new THREE.CylinderGeometry(0.03, 0.03, 0.045, 12), '#8d99a6', [0, 1.0, 0]));
  for (const s of [-1, 1]) metall.push(teil(new THREE.SphereGeometry(0.007, 6, 4), '#5d6670', [s * 0.029, 1.0, 0]));

  // --- Der Holzstiel: unten etwas dunkler, oben vom Anfassen glatt und heller ---
  const stiel = new THREE.CylinderGeometry(0.025, 0.028, 0.84, 10, 8);
  stiel.translate(0, 0.585, 0);
  holz.push(faerben(stiel, (x, y) => new THREE.Color('#8a5a30').lerp(new THREE.Color('#c48d55'), weich(0.2, 0.95, y))));

  // --- Der D-Griff: ein runder Bügel mit dickem Querholz oben ---
  const buegel = new THREE.TorusGeometry(0.06, 0.013, 6, 18);
  buegel.rotateY(Math.PI / 2); // Bügel steht quer, wie das Blatt
  holz.push(teil(buegel, '#b98450', [0, 1.085, 0], [1, 1.2, 1]));
  const quer = new THREE.CapsuleGeometry(0.02, 0.1, 4, 10);
  quer.rotateX(Math.PI / 2);
  holz.push(teil(quer, '#a87444', [0, 1.157, 0]));

  const mHolz = new THREE.Mesh(mergeGeometries(holz), new THREE.MeshStandardMaterial({
    map: holzMaserung(), vertexColors: true, roughness: 0.55, metalness: 0,
  }));
  const mMetall = new THREE.Mesh(mergeGeometries(metall), new THREE.MeshStandardMaterial({
    vertexColors: true, metalness: 0.75, roughness: 0.3, side: THREE.FrontSide,
  }));
  const modell = new THREE.Group();
  modell.add(mHolz, mMetall);
  if (!inDerHand) {
    // Am Boden: so verschieben, dass er nach dem Umkippen flach im Gras liegt
    // und mitten im Glitzer-Ring
    modell.position.set(-0.3 + 0.034, -0.43, 0);
  }
  const schaufel = new THREE.Group();
  schaufel.add(modell);
  schaufel.traverse((t) => (t.castShadow = true));
  return schaufel;
}

// ---------- Das Schwert ----------
// Griff bei y = 0 (da hält die Hand), Klinge nach oben bis y ≈ 1,3.
export function baueSchwert() {
  const metall = [], leder = [];
  const hell = new THREE.Color('#f6f9fc'), stahl = new THREE.Color('#c2cbd5'), kehle = new THREE.Color('#8794a2');

  // --- Die Klinge: mit Hohlkehle (Rinne in der Mitte), Mittelgrat vorne und heller Schneide ---
  const unten = 0.2, laenge = 1.1;
  const halbBreite = (v) => 0.062 * (1 - 0.15 * v) * (v > 0.78 ? Math.sqrt(Math.max(0, 1 - ((v - 0.78) / 0.22) ** 2)) : 1);
  const klingenPunkt = (seite) => (u, v) => {
    const a = Math.abs(u);
    const schraege = a > 0.62 ? (1 - a) / 0.38 : 1; // zur Schneide hin dünn
    const rinne = (1 - weich(0.1, 0.26, a)) * (1 - weich(0.6, 0.74, v)) * weich(0.0, 0.06, v);
    const grat = Math.max(0, 1 - a / 0.62) * weich(0.62, 0.8, v) * 0.35;
    const dicke = 0.016 * (1 - 0.35 * v) * (schraege * (1 - 0.5 * rinne) + grat) + 0.0004;
    let farbe = stahl.clone().lerp(hell, weich(0.6, 0.72, a)).lerp(kehle, rinne * 0.9);
    return [u * halbBreite(v), unten + v * laenge, seite * dicke, farbe];
  };
  metall.push(gitterFlaeche(12, 18, klingenPunkt(1)));
  metall.push(gitterFlaeche(12, 18, klingenPunkt(-1), true));

  // --- Parierstange: mit dicken, runden Kugel-Enden ---
  const gold = '#d6aa45', goldDunkel = '#a97e2c';
  metall.push(teil(new THREE.CapsuleGeometry(0.024, 0.3, 4, 10), gold, [0, 0.175, 0], [1, 1, 0.85], [0, 0, Math.PI / 2]));
  for (const s of [-1, 1]) metall.push(teil(new THREE.SphereGeometry(0.04, 12, 8), gold, [s * 0.19, 0.185, 0]));
  metall.push(teil(new THREE.SphereGeometry(0.05, 12, 8), goldDunkel, [0, 0.18, 0], [1.1, 0.75, 0.7]));

  // --- Griff: mit Leder umwickelt (die Wülste gehen schräg rundherum) ---
  const griff = new THREE.CylinderGeometry(0.03, 0.033, 0.27, 12, 16, true);
  const p = griff.attributes.position;
  const wickel = [];
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const w = Math.atan2(z, x);
    const band = Math.pow(0.5 + 0.5 * Math.sin((y / 0.036) * Math.PI * 2 + w), 2);
    const r = 1 + 0.12 * band;
    p.setXYZ(i, x * r, y, z * r);
    wickel.push(band);
  }
  griff.computeVertexNormals();
  griff.translate(0, 0.02, 0);
  let n = 0;
  leder.push(faerben(griff, () => new THREE.Color('#3e2414').lerp(new THREE.Color('#7a4a28'), wickel[n++])));
  // Goldringe an beiden Enden des Griffs
  for (const y of [-0.115, 0.152]) metall.push(teil(new THREE.TorusGeometry(0.034, 0.009, 6, 14), gold, [0, y, 0], [1, 1, 1], [Math.PI / 2, 0, 0]));

  // --- Knauf: eine runde Kugel mit rotem Edelstein auf beiden Seiten ---
  metall.push(teil(new THREE.SphereGeometry(0.052, 14, 10), gold, [0, -0.16, 0], [1, 1, 0.85]));
  for (const s of [-1, 1]) {
    metall.push(teil(new THREE.SphereGeometry(0.024, 10, 8), '#e8243e', [0, -0.16, s * 0.04], [1, 1, 0.55]));
    metall.push(teil(new THREE.SphereGeometry(0.006, 6, 4), '#ffffff', [0.008, -0.152, s * 0.053])); // Glanzpunkt
  }

  const schwert = new THREE.Group();
  schwert.add(
    new THREE.Mesh(mergeGeometries(metall), new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.8, roughness: 0.25 })),
    new THREE.Mesh(mergeGeometries(leder), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }))
  );
  schwert.traverse((t) => (t.castShadow = true));
  return schwert;
}

// Kleiner Helfer: eine Form einfärben und an ihren Platz schieben.
// Viele eingefärbte Formen werden danach zu EINEM Modell zusammengeklebt
// (dann muss der Computer nur einmal malen statt zwanzigmal).
function teil(geo, farbe, pos = [0, 0, 0], skala = [1, 1, 1], dreh = [0, 0, 0]) {
  const g = geo.clone();
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  g.applyMatrix4(new THREE.Matrix4().compose(
    new THREE.Vector3(...pos),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...dreh)),
    new THREE.Vector3(...skala)
  ));
  const c = new THREE.Color(farbe);
  const f = new Float32Array(g.attributes.position.count * 3);
  for (let i = 0; i < f.length; i += 3) f.set([c.r, c.g, c.b], i);
  g.setAttribute('color', new THREE.BufferAttribute(f, 3));
  return g;
}

// Ein runder Drehkörper aus einem Umriss: [[Radius, Höhe], ...]
function dreh(umriss, seiten = 18, start = 0, laenge = Math.PI * 2) {
  return new THREE.LatheGeometry(umriss.map(([r, y]) => new THREE.Vector2(r, y)), seiten, start, laenge);
}

// farben = { shirt, hose, haare, haut, hut, bart }  (bart: false = ohne Bart)
// Ein Erwachsener (der Händler): mit Bart, Schürze, Gürtel und Hut.
export function baueFigur(farben) {
  const figur = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 });
  const dunkler = (f, wie = 0.7) => new THREE.Color(f).multiplyScalar(wie);
  const schuerze = '#e9dfc8';
  const teile = [];

  // Beine (Hose) und Bauch / Oberkörper (Hemd) als runde Drehkörper
  for (const x of [-0.17, 0.17]) {
    teile.push(teil(dreh([[0, 0.14], [0.14, 0.16], [0.15, 0.4], [0.17, 0.62], [0.2, 0.75], [0, 0.78]], 12), farben.hose, [x, 0, 0]));
  }
  teile.push(teil(dreh([[0, 0.66], [0.37, 0.7], [0.45, 0.9], [0.47, 1.1], [0.44, 1.32], [0.38, 1.48], [0.2, 1.6], [0, 1.62]], 20), farben.shirt));
  // Schürze vorne (ein Stück Drehkörper, etwas größer als der Bauch)
  teile.push(teil(dreh([[0.39, 0.42], [0.47, 0.72], [0.485, 0.9], [0.49, 1.1], [0.46, 1.3]], 12, -0.95, 1.9), schuerze, [0, 0, 0], [1, 1, 1], [0, 0, 0]));
  // Gürtel mit Schnalle
  teile.push(teil(new THREE.TorusGeometry(0.455, 0.045, 6, 22), '#4a3020', [0, 0.95, 0], [1, 1, 1], [Math.PI / 2, 0, 0]));
  teile.push(teil(new THREE.BoxGeometry(0.12, 0.09, 0.04), '#c9a043', [0, 0.95, 0.49]));
  // Kragen
  teile.push(teil(new THREE.TorusGeometry(0.17, 0.05, 6, 16), dunkler(farben.shirt, 0.8), [0, 1.6, 0], [1, 1, 1], [Math.PI / 2, 0, 0]));

  // Kopf
  teile.push(teil(new THREE.CylinderGeometry(0.11, 0.13, 0.16, 10), farben.haut, [0, 1.66, 0]));
  teile.push(teil(new THREE.SphereGeometry(0.34, 22, 16), farben.haut, [0, 1.98, 0], [0.95, 1.05, 0.95]));
  for (const s of [-1, 1]) {
    teile.push(teil(new THREE.SphereGeometry(0.07, 10, 8), farben.haut, [s * 0.32, 1.98, -0.02], [0.5, 1, 0.8])); // Ohren
    // Augen: weiß mit dunkler Pupille und Glanzpunkt
    teile.push(teil(new THREE.SphereGeometry(0.055, 12, 10), '#ffffff', [s * 0.12, 2.03, 0.285], [1, 1, 0.6]));
    teile.push(teil(new THREE.SphereGeometry(0.032, 10, 8), '#2a1d14', [s * 0.12, 2.03, 0.318], [1, 1, 0.5]));
    teile.push(teil(new THREE.SphereGeometry(0.01, 6, 4), '#ffffff', [s * 0.12 + 0.012, 2.045, 0.334]));
    // Augenbrauen
    teile.push(teil(new THREE.CapsuleGeometry(0.018, 0.08, 3, 6), farben.haare, [s * 0.12, 2.11, 0.29], [1, 1, 1], [0, 0, Math.PI / 2 + s * 0.15]));
    // rote Bäckchen
    teile.push(teil(new THREE.SphereGeometry(0.05, 8, 6), '#e08a78', [s * 0.2, 1.93, 0.25], [1, 0.7, 0.4]));
  }
  teile.push(teil(new THREE.SphereGeometry(0.065, 12, 10), dunkler(farben.haut, 0.93), [0, 1.95, 0.33], [0.9, 1, 1.1])); // Nase
  // Bart: um Kinn und Wangen, dazu ein Schnurrbart (bart: false = ohne Bart)
  if (farben.bart !== false) teile.push(teil(new THREE.SphereGeometry(0.33, 18, 10, Math.PI * 0.08, Math.PI * 0.84, Math.PI * 0.55, Math.PI * 0.4), farben.haare, [0, 1.99, 0.02], [1, 1.1, 1.05]));
  for (const s of farben.bart !== false ? [-1, 1] : []) {
    teile.push(teil(new THREE.CapsuleGeometry(0.035, 0.1, 4, 8), farben.haare, [s * 0.065, 1.875, 0.31], [1, 1, 1], [0, 0, Math.PI / 2 - s * 0.35]));
  }
  // Haare hinten und an den Seiten (unter dem Hut)
  teile.push(teil(new THREE.SphereGeometry(0.355, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), farben.haare, [0, 2.0, -0.02], [1, 1.02, 1], [-0.35, 0, 0]));

  // Hut mit breiter Krempe und Hutband
  if (farben.hut) {
    teile.push(teil(new THREE.CylinderGeometry(0.6, 0.62, 0.04, 26), farben.hut, [0, 2.22, 0]));
    teile.push(teil(dreh([[0.32, 0], [0.33, 0.18], [0.29, 0.3], [0.15, 0.34], [0, 0.33]], 22), farben.hut, [0, 2.23, 0]));
    teile.push(teil(new THREE.CylinderGeometry(0.335, 0.335, 0.07, 22, 1, true), '#3a2a1e', [0, 2.28, 0]));
  }
  const koerper = new THREE.Mesh(mergeGeometries(teile), material);
  figur.add(koerper);

  // Arme hängen an der Schulter, damit sie beim Laufen schwingen können
  const baueArm = (s) => {
    const arm = new THREE.Group();
    const aermel = mergeGeometries([
      teil(new THREE.SphereGeometry(0.15, 12, 10), farben.shirt, [0, 0, 0]),
      teil(new THREE.CapsuleGeometry(0.115, 0.4, 6, 10), farben.shirt, [0, -0.26, 0]),
      teil(new THREE.TorusGeometry(0.1, 0.03, 6, 12), schuerze, [0, -0.5, 0], [1, 1, 1], [Math.PI / 2, 0, 0]), // hochgekrempelt
    ]);
    arm.add(new THREE.Mesh(aermel, material));
    const hand = new THREE.Mesh(teil(new THREE.SphereGeometry(0.105, 12, 10), farben.haut, [0, 0, 0], [0.9, 1.1, 0.8]), material);
    hand.position.y = -0.62;
    arm.add(hand);
    arm.position.set(s * 0.5, 1.45, 0);
    arm.rotation.z = s * 0.08;
    return { arm, hand };
  };
  const links = baueArm(-1), rechts = baueArm(1);
  const armL = links.arm, armR = rechts.arm, handR = rechts.hand;
  figur.add(armL, armR);

  // Stiefel
  const fussGeo = teil(new THREE.SphereGeometry(0.17, 12, 10), '#3a2b22', [0, 0, 0], [1, 0.75, 1.45]);
  const fussL = new THREE.Mesh(fussGeo, material);
  const fussR = new THREE.Mesh(fussGeo, material);
  fussL.position.set(-0.18, 0.12, 0.06);
  fussR.position.set(0.18, 0.12, 0.06);
  figur.add(fussL, fussR);

  figur.traverse((t) => {
    if (t.isMesh) t.castShadow = true;
  });
  return { figur, koerper, armL, armR, handR, fussL, fussR };
}
