// =============================================================
//  GRABEHÜGEL – so sieht ein Erdhaufen aus, in dem etwas vergraben ist
//  Ein echter Haufen ist nie ganz rund: Er hat Beulen, dunkle
//  Erdbrocken, Steinchen, Wurzeln und eine Schaufelspur.
//  Jede Insel hat ihre eigene Sorte Erde:
//   • Startinsel:   braune Walderde mit Grasbüscheln und Wurzeln
//   • Palmeninsel:  sandiger Hügel mit Muschel-Splittern
//   • Klippeninsel: steiniger Hügel mit Moos
//  Benutzt von objekte.js (Grabestellen) und bewohner.js (Münz-Hügel).
// =============================================================
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rauschen, fbm, zufallMitSeed } from './rauschen.js';
import { textur } from './texturen.js';
import { gitterWerte } from './gelaende.js';

// ---------- Die Erd-Sorten (Farben und wie viel Kram drauf liegt) ----------
const SORTEN = {
  Startinsel: {
    seed: 11,
    erdeDunkel: '#3a2314', erde: '#6b4527', erdeHell: '#9a6b3e',
    rand: '#6f7d36', // der Rand geht ins Gras über
    nass: '#22150c', // frisch gegrabene, feuchte Erde
    hoehe: 0.5,
    steine: 4, steinGroesse: 0.075, steinFarben: ['#8d877d', '#6e675e', '#a39a8a'],
    wurzeln: 2, gras: 7, grasFarben: ['#3f6a1f', '#8fbf45'],
    muscheln: 0, moos: 0,
    kruemel: ['#4a2e1b', '#6b4527', '#5a3a22', '#7d7468'],
  },
  Palmeninsel: {
    seed: 23,
    erdeDunkel: '#664828', erde: '#8f6b3e', erdeHell: '#ae8d5c',
    rand: '#9c9663',
    nass: '#5e4628',
    hoehe: 0.46,
    steine: 2, steinGroesse: 0.06, steinFarben: ['#b0a898', '#8f877a'],
    wurzeln: 0, gras: 3, grasFarben: ['#7c7a32', '#c9c06a'], // trockenes Strandgras
    muscheln: 11, moos: 0,
    kruemel: ['#a8865a', '#c7a774', '#8a6a43', '#f2e6d8'],
  },
  Klippeninsel: {
    seed: 37,
    erdeDunkel: '#33261c', erde: '#5c493a', erdeHell: '#7e6c5b',
    rand: '#8a8672',
    nass: '#1f1812',
    hoehe: 0.45,
    steine: 10, steinGroesse: 0.13, steinFarben: ['#8a877f', '#6b6964', '#9c968b', '#5b5955'],
    wurzeln: 1, gras: 2, grasFarben: ['#3b5420', '#6f8a36'],
    muscheln: 0, moos: 4,
    kruemel: ['#3e2f23', '#5c493a', '#77746c', '#8a877f'],
  },
};
export function sorteVon(insel) {
  return SORTEN[insel] || SORTEN.Startinsel;
}

const farbe = (hex) => new THREE.Color(hex); // rechnet automatisch in "lineare" Farben um
const zwischen = (a, b, t) => a.clone().lerp(b, Math.min(1, Math.max(0, t)));
function winkelAbstand(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// ---------- Wie hoch ist der Erdhaufen an der Stelle (x, z)? ----------
// q = wie weit vom Rand (0 = Mitte, 1 = Fuß des Haufens)
function erdhaufen(S, x, z) {
  const r = Math.hypot(x, z), a = Math.atan2(z, x);
  // Der Umriss ist nicht rund, sondern ein bisschen "kartoffelig"
  const umriss = 1 + 0.12 * Math.sin(2 * a + S.p1) + 0.07 * Math.sin(3 * a + S.p2) + 0.04 * Math.sin(5 * a + S.p3);
  const q = r / umriss;
  let h;
  // runde Kuppe oben, weicher Fuß unten (wie ein echter Haufen)
  if (q < 1) h = S.hoehe * (0.55 * (Math.cos(q * Math.PI) + 1) / 2 + 0.45 * Math.pow(1 - q * q, 0.85)) + 0.03;
  else if (q < 1.25) h = 0.03 - 0.03 * ((q - 1) / 0.25); // lose Erde rund um den Haufen
  else h = -0.3 * Math.min(1, (q - 1.25) / 0.2); // ganz außen verschwindet der Rand im Boden
  // Beulen und Klumpen
  h += (fbm(x * 2.3 + S.seed, z * 2.3, 3, S.seed) - 0.5) * 0.18 * Math.max(0, 1 - q * 0.75);
  // Schaufelspur: eine Delle an der Seite …
  const dw = winkelAbstand(a, S.spurWinkel);
  const spur = Math.exp(-((q - 0.5) ** 2) / 0.03) * Math.exp(-(dw * dw) / 0.1);
  h -= 0.14 * spur;
  // … und daneben die herausgeworfene Erde
  const dw2 = winkelAbstand(a, S.spurWinkel + 0.5);
  const auswurf = Math.exp(-((q - 1.02) ** 2) / 0.02) * Math.exp(-(dw2 * dw2) / 0.2);
  h += 0.1 * auswurf;
  return { h, q, spur, auswurf };
}

// ---------- Die Mulde, wenn alles ausgegraben ist ----------
function mulde(S, x, z) {
  const r = Math.hypot(x, z), a = Math.atan2(z, x);
  const umriss = 1 + 0.08 * Math.sin(2 * a + S.p1) + 0.05 * Math.sin(3 * a + S.p2);
  const q = r / umriss;
  // Der Rand ist nicht überall gleich hoch: auf einer Seite liegt mehr Erde
  const wand = 1 + 0.55 * Math.sin(a + S.p2) + 0.2 * Math.sin(3 * a + S.p1);
  let h;
  if (q < 0.45) h = 0.08 + 0.03 * (q / 0.45); // Boden der Grube (in der Mitte am tiefsten)
  else if (q < 1.05) h = 0.11 + 0.15 * wand * Math.pow(Math.sin(Math.PI * (q - 0.45) / 0.6), 1.3); // der aufgeworfene Rand
  else if (q < 1.25) h = 0.11 - 0.09 * ((q - 1.05) / 0.2); // lose Erde
  else h = 0.02 - 0.32 * Math.min(1, (q - 1.25) / 0.2);
  // Der Erdhaufen, den man beim Graben auf eine Seite geworfen hat
  const dw = winkelAbstand(a, S.spurWinkel);
  h += 0.16 * Math.exp(-((q - 1.0) ** 2) / 0.035) * Math.exp(-(dw * dw) / 0.3);
  h += (fbm(x * 3 + S.seed, z * 3, 3, S.seed + 4) - 0.5) * 0.08 * Math.min(1, q * 1.5);
  return { h, q };
}

// ---------- Ein rundes Gitter (wie eine Spinnennetz-Scheibe) ----------
// hoeheFn(x, z) → { h, q }, farbFn(x, z, info) → Farbe
function scheibe(ringe, ecken, radius, hoeheFn, farbFn) {
  const pos = [], farben = [], index = [];
  const dazu = (x, z) => {
    const info = hoeheFn(x, z);
    pos.push(x, info.h, z);
    const c = farbFn(x, z, info);
    farben.push(c.r, c.g, c.b);
  };
  dazu(0, 0);
  for (let i = 1; i <= ringe; i++) {
    const r = radius * Math.pow(i / ringe, 0.9);
    for (let j = 0; j < ecken; j++) {
      const a = (j / ecken) * Math.PI * 2;
      dazu(Math.cos(a) * r, Math.sin(a) * r);
    }
  }
  for (let j = 0; j < ecken; j++) index.push(0, 1 + ((j + 1) % ecken), 1 + j);
  for (let i = 1; i < ringe; i++) {
    const a0 = 1 + (i - 1) * ecken, a1 = 1 + i * ecken;
    for (let j = 0; j < ecken; j++) {
      const j2 = (j + 1) % ecken;
      index.push(a0 + j, a0 + j2, a1 + j, a0 + j2, a1 + j2, a1 + j);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(farben, 3));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

// ---------- Kleine Teile ----------
// Ein weicher, beuliger Klumpen (Erdbrocken, Stein, Moos)
function klumpen(zufall, groesse, flach, beulen, farbFn) {
  const g = new THREE.SphereGeometry(1, 7, 5);
  const p = g.attributes.position, s = zufall() * 50;
  const farben = [];
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const f = 1 + (rauschen(x * 1.6 + s, y * 1.6 + z * 1.3 + s, 5) - 0.5) * 2 * beulen;
    p.setXYZ(i, x * f * groesse, y * f * groesse * flach, z * f * groesse);
    const c = farbFn(x, y, z);
    farben.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(farben, 3));
  g.computeVertexNormals();
  return g;
}

// Etwas auf die Oberfläche legen (ein bisschen eingesunken, schräg)
function hinlegen(g, x, y, z, zufall, kipp = 0.4) {
  g.rotateX((zufall() - 0.5) * kipp);
  g.rotateZ((zufall() - 0.5) * kipp);
  g.rotateY(zufall() * Math.PI * 2);
  g.translate(x, y, z);
  return g;
}

// Alle Teile brauchen die gleichen "Zettel" (Attribute), damit man sie zusammenkleben kann.
// erdig = 1: bekommt das Erd-Foto als Muster, erdig = 0: nur die eigene Farbe
function fertig(g, erdig) {
  const n = g.attributes.position.count;
  if (!g.attributes.color) g.setAttribute('color', new THREE.Float32BufferAttribute(new Array(n * 3).fill(1), 3));
  g.setAttribute('erdig', new THREE.Float32BufferAttribute(new Array(n).fill(erdig), 1));
  const p = g.attributes.position, uv = [];
  for (let i = 0; i < n; i++) uv.push(p.getX(i) * 0.55, p.getZ(i) * 0.55); // Foto von oben draufgelegt
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return g;
}

// ---------- Das Beiwerk: Steinchen, Wurzeln, Gras, Muscheln, Moos ----------
// stelleFn(q) → [x, y, z] auf der Oberfläche bei Abstand q
function beiwerk(S, zufall, teile, hoeheFn, { mitWurzeln = true, randStart = 1.0 } = {}) {
  const ort = (qMin, qMax) => {
    const a = zufall() * Math.PI * 2, q = qMin + zufall() * (qMax - qMin);
    const x = Math.cos(a) * q, z = Math.sin(a) * q;
    return [x, hoeheFn(x, z).h, z, a];
  };
  // Erdbrocken (dunkler als der Haufen)
  const dunkel = farbe(S.erdeDunkel), erde = farbe(S.erde);
  for (let i = 0; i < 9; i++) {
    const [x, y, z] = ort(0.15, 1.15);
    const gr = 0.06 + zufall() * 0.08;
    const mix = zufall() * 0.6;
    const g = klumpen(zufall, gr, 0.55, 0.35, (vx, vy) => zwischen(dunkel, erde, mix + vy * 0.25));
    teile.push(fertig(hinlegen(g, x, y, z, zufall), 1));
  }
  // Steinchen
  for (let i = 0; i < S.steine; i++) {
    const [x, y, z] = ort(0.25, 1.2);
    const gr = S.steinGroesse * (0.6 + zufall() * 0.8);
    const grund = farbe(S.steinFarben[i % S.steinFarben.length]);
    const s = zufall() * 20;
    const g = klumpen(zufall, gr, 0.6, 0.22, (vx, vy, vz) =>
      grund.clone().multiplyScalar(0.8 + rauschen(vx * 3 + s, vz * 3 + vy * 2, 9) * 0.4 + vy * 0.12));
    g.scale(1, 1, 0.75 + zufall() * 0.4);
    teile.push(fertig(hinlegen(g, x, y + gr * 0.15, z, zufall, 0.6), 0));
    // Auf der Klippeninsel wächst Moos auf manchen Steinen
    if (i < S.moos) {
      const m = klumpen(zufall, gr * 0.6, 0.4, 0.4, () => zwischen(farbe(S.grasFarben[0]), farbe(S.grasFarben[1]), zufall() * 0.35));
      teile.push(fertig(hinlegen(m, x + gr * 0.15, y + gr * 0.32, z, zufall, 0.2), 0));
    }
  }
  // Wurzeln: kommen aus dem Haufen und tauchen wieder in den Boden
  if (mitWurzeln) {
    for (let i = 0; i < S.wurzeln; i++) {
      const a = S.spurWinkel + 2 + i * 2.2 + zufall() * 0.5;
      const pkt = [0.5, 0.72, 0.92, 1.12].map((q, k) => {
        const aa = a + (k - 1.5) * 0.12 * (zufall() + 0.3);
        const x = Math.cos(aa) * q, z = Math.sin(aa) * q;
        const h = hoeheFn(x, z).h;
        return new THREE.Vector3(x, h + [-0.04, 0.05, 0.03, -0.05][k], z);
      });
      const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pkt), 10, 0.018 + zufall() * 0.012, 5, false);
      const hell = farbe('#7d5636'), dunkelW = farbe('#4d3220');
      const p = g.attributes.position, f = [];
      for (let k = 0; k < p.count; k++) { const c = zwischen(dunkelW, hell, 0.3 + p.getY(k) * 2); f.push(c.r, c.g, c.b); }
      g.setAttribute('color', new THREE.Float32BufferAttribute(f, 3));
      teile.push(fertig(g, 0.35));
    }
  }
  // Grasbüschel am Rand
  const unten = farbe(S.grasFarben[0]), oben = farbe(S.grasFarben[1]);
  for (let i = 0; i < S.gras; i++) {
    const a0 = zufall() * Math.PI * 2, q0 = randStart + zufall() * 0.2;
    const bx = Math.cos(a0) * q0, bz = Math.sin(a0) * q0;
    const halme = 5 + Math.floor(zufall() * 4);
    for (let k = 0; k < halme; k++) {
      const hoch = 0.16 + zufall() * 0.18;
      const g = new THREE.ConeGeometry(0.022, hoch, 4, 2, true);
      g.translate(0, hoch / 2, 0);
      g.scale(1, 1, 0.35); // flach wie ein Grashalm
      // Halm biegt sich ein bisschen nach außen
      const p = g.attributes.position, f = [];
      for (let v = 0; v < p.count; v++) {
        const t = p.getY(v) / hoch;
        p.setX(v, p.getX(v) + t * t * 0.06);
        const c = zwischen(unten, oben, t * 0.9 + zufall() * 0.1);
        f.push(c.r, c.g, c.b);
      }
      g.setAttribute('color', new THREE.Float32BufferAttribute(f, 3));
      g.computeVertexNormals();
      g.rotateZ((zufall() - 0.5) * 0.5);
      g.rotateY(a0 + (zufall() - 0.5) * 1.8);
      g.translate(bx + (zufall() - 0.5) * 0.12, -0.04, bz + (zufall() - 0.5) * 0.12);
      teile.push(fertig(g, 0));
    }
  }
  // Muschel-Splitter (Palmeninsel)
  const weiss = farbe('#f4ebe0'), rosa = farbe('#efb9a4'), creme = farbe('#e8d2b0');
  for (let i = 0; i < S.muscheln; i++) {
    const [x, y, z] = ort(0.2, 1.25);
    const ganz = zufall() < 0.4;
    const gr = 0.05 + zufall() * 0.045;
    const g = new THREE.SphereGeometry(gr, 12, 3, 0, ganz ? Math.PI * 2 : Math.PI * (0.8 + zufall() * 0.5), 0, 1.0);
    g.scale(1, 0.45, 1.15);
    const zweite = zufall() < 0.5 ? rosa : creme;
    const p = g.attributes.position, f = [];
    for (let v = 0; v < p.count; v++) {
      const rille = 0.5 + 0.5 * Math.sin(Math.atan2(p.getZ(v), p.getX(v)) * 9); // die Rillen der Muschel
      const c = zwischen(weiss, zweite, rille * 0.7);
      f.push(c.r, c.g, c.b);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(f, 3));
    teile.push(fertig(hinlegen(g, x, y - 0.005, z, zufall, 0.7), 0));
  }
}

// ---------- Erd-Material: Erd-Foto als feines Muster, die Farbe kommt von den Punkten ----------
let erdMaterialCache = null, nassMaterialCache = null;
function erdMaterial(rauheit) {
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    map: textur('pfad.jpg'),
    normalMap: textur('pfad_normal.jpg', { farbe: false }),
    normalScale: new THREE.Vector2(1.1, 1.1),
    roughness: rauheit,
  });
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float erdig;\nvarying float vErdig;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvErdig = erdig;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vErdig;')
      // Vom Foto nehmen wir vor allem hell/dunkel (Körnchen, Steinchen) – die Farbe macht der Hügel selbst
      .replace('#include <map_fragment>', /* glsl */ `
        vec4 erdBild = texture2D( map, vMapUv );
        float erdHell = dot( erdBild.rgb, vec3( 0.3, 0.59, 0.11 ) ) / 0.203;
        vec3 erdMuster = mix( vec3( erdHell ), erdBild.rgb / vec3( 0.314, 0.172, 0.065 ), 0.2 );
        diffuseColor.rgb *= mix( vec3( 1.0 ), clamp( erdMuster, 0.3, 1.9 ), vErdig );`)
      .replace('#include <normal_fragment_maps>',
        THREE.ShaderChunk.normal_fragment_maps.replace('mapN.xy *= normalScale;', 'mapN.xy *= normalScale * vErdig;'));
  };
  mat.customProgramCacheKey = () => 'grabehuegel-erde';
  return mat;
}

// ---------- Fertige Teile für eine Insel (werden nur einmal gebaut) ----------
const cache = new Map();
export function grabeHuegelTeile(insel) {
  const name = SORTEN[insel] ? insel : 'Startinsel';
  if (cache.has(name)) return cache.get(name);
  const S = { ...SORTEN[name] };
  const zufall = zufallMitSeed(S.seed * 101);
  S.p1 = zufall() * 6.3; S.p2 = zufall() * 6.3; S.p3 = zufall() * 6.3;
  S.spurWinkel = zufall() * 6.3;
  erdMaterialCache ??= erdMaterial(0.95);
  nassMaterialCache ??= erdMaterial(0.72); // feuchte Erde glänzt ein bisschen

  // --- Der volle Hügel ---
  const dunkel = farbe(S.erdeDunkel), mittel = farbe(S.erde), hell = farbe(S.erdeHell), rand = farbe(S.rand);
  const hoeheH = (x, z) => erdhaufen(S, x, z);
  const haufen = scheibe(13, 40, 1.42, hoeheH, (x, z, { q, spur, auswurf }) => {
    const flecken = fbm(x * 3.1 + 7, z * 3.1, 3, S.seed + 1);
    // oben trockener und heller, unten dunkler
    let c = zwischen(mittel, hell, (flecken - 0.38) * 2.2 * (1 - 0.6 * q));
    if (rauschen(x * 7 + 3, z * 7, S.seed + 2) > 0.64) c = zwischen(c, dunkel, 0.55); // dunkle Brocken
    c = zwischen(c, dunkel, spur * 0.8 + auswurf * 0.3); // frische Schaufelspur ist dunkel und feucht
    if (q > 0.78 && q < 1.05) c.multiplyScalar(1 - 0.25 * Math.sin(Math.PI * (q - 0.78) / 0.27)); // Schatten am Fuß
    // Am Rand geht die Erde fleckig in den Boden der Insel über
    return zwischen(c, rand, (q - 0.97) / 0.28 + (flecken - 0.5) * 0.9);
  });
  const teileH = [fertig(haufen, 1)];
  beiwerk(S, zufall, teileH, hoeheH);
  const huegel = mergeGeometries(teileH);

  // --- Die leere Mulde ---
  const nass = farbe(S.nass);
  const hoeheM = (x, z) => mulde(S, x, z);
  const loch = scheibe(11, 36, 1.45, hoeheM, (x, z, { q }) => {
    const flecken = fbm(x * 4 + 3, z * 4, 2, S.seed + 6);
    let c;
    if (q < 0.45) c = zwischen(nass, dunkel, flecken * 0.6); // feuchter Boden der Grube
    else if (q < 0.75) c = zwischen(nass, mittel, (q - 0.45) / 0.3); // Innenwand
    else c = zwischen(mittel, hell, (flecken - 0.4) * 2);
    return zwischen(c, rand, (q - 1.02) / 0.25 + (flecken - 0.5) * 0.9);
  });
  const teileM = [fertig(loch, 1)];
  // ein paar Brocken auf dem Rand
  for (let i = 0; i < 6; i++) {
    const a = zufall() * Math.PI * 2, q = 0.75 + zufall() * 0.45;
    const x = Math.cos(a) * q, z = Math.sin(a) * q, gr = 0.05 + zufall() * 0.07;
    const g = klumpen(zufall, gr, 0.7, 0.3, () => zwischen(dunkel, mittel, zufall() * 0.7));
    teileM.push(fertig(hinlegen(g, x, hoeheM(x, z).h + gr * 0.2, z, zufall), 1));
  }
  const muldeGeo = mergeGeometries(teileM);

  const teile = {
    sorte: S,
    huegel: { geometrie: huegel, material: erdMaterialCache },
    mulde: { geometrie: muldeGeo, material: nassMaterialCache },
  };
  cache.set(name, teile);
  return teile;
}

// ---------- Hügel so hinlegen, wie der Boden schräg ist ----------
// Wir fragen das echte Boden-Netz an vielen Punkten rund um die Stelle, legen eine
// schräge "Platte" hindurch und heben den Hügel so weit an, dass der Boden nicht
// durch die Mulde guckt. (Erst aufrufen, wenn das Gelände gebaut ist.)
const OBEN = new THREE.Vector3(0, 1, 0);
export function huegelLage(x, z, drehung) {
  const punkte = [];
  for (const r of [0, 0.35, 0.7, 1.05, 1.4]) {
    const ecken = r === 0 ? 1 : 10;
    for (let k = 0; k < ecken; k++) {
      const a = (k / ecken) * Math.PI * 2;
      const dx = Math.cos(a) * r, dz = Math.sin(a) * r;
      punkte.push({ dx, dz, r, h: gitterWerte(x + dx, z + dz).hoehe });
    }
  }
  // Platte: h = mitte + steigungX * dx + steigungZ * dz
  let summe = 0, sx = 0, sxx = 0, sz = 0, szz = 0;
  for (const p of punkte) {
    summe += p.h;
    sx += p.h * p.dx; sxx += p.dx * p.dx;
    sz += p.h * p.dz; szz += p.dz * p.dz;
  }
  const mitte = summe / punkte.length, steigungX = sx / sxx, steigungZ = sz / szz;
  // Wo ragt der Boden in der Mitte über die Platte?
  let anheben = 0;
  for (const p of punkte) {
    if (p.r > 0.75) continue;
    anheben = Math.max(anheben, p.h - (mitte + steigungX * p.dx + steigungZ * p.dz));
  }
  const n = new THREE.Vector3(-steigungX, 1, -steigungZ).normalize();
  const lage = new THREE.Quaternion().setFromUnitVectors(OBEN, n);
  lage.multiply(new THREE.Quaternion().setFromAxisAngle(OBEN, drehung));
  return { ort: new THREE.Vector3(x, mitte + Math.min(anheben, 0.35), z), drehung: lage };
}

// ---------- Erdbrocken, die beim Graben fliegen ----------
export function kruemelForm() {
  const zufall = zufallMitSeed(5);
  const geo = klumpen(zufall, 0.085, 0.75, 0.35, (x, y) => new THREE.Color(1, 1, 1).multiplyScalar(0.8 + y * 0.2));
  return { geometrie: geo, material: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }) };
}

// ---------- Funkeln: kleine leuchtende Sterne, die immer zur Kamera schauen ----------
export function funkelMaterial(farbeHex = '#ffd54a') {
  return new THREE.ShaderMaterial({
    uniforms: { farbe: { value: new THREE.Color(farbeHex) } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        // Mitte des Sterns – dann flach zur Kamera aufklappen ("Sprite")
        vec4 mitte = modelViewMatrix * instanceMatrix * vec4( 0.0, 0.0, 0.0, 1.0 );
        float groesse = length( instanceMatrix[0].xyz );
        mitte.xy += position.xy * groesse;
        gl_Position = projectionMatrix * mitte;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 farbe;
      varying vec2 vUv;
      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float r = length( p );
        float kern = exp( -r * r * 30.0 );
        float schein = exp( -r * r * 6.0 ) * 0.35;
        // 4 Strahlen wie ein Stern
        float strahlen = max( 0.0, 1.0 - abs( p.y ) * 16.0 ) * max( 0.0, 1.0 - abs( p.x ) )
                       + max( 0.0, 1.0 - abs( p.x ) * 16.0 ) * max( 0.0, 1.0 - abs( p.y ) );
        float a = clamp( kern + schein + strahlen * 0.85, 0.0, 1.0 );
        vec3 c = mix( farbe, vec3( 1.0 ), kern ) * ( 1.0 + kern * 2.5 );
        gl_FragColor = vec4( c, a );
      }`,
  });
}
