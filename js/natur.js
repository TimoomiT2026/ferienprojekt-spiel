// =============================================================
//  NATUR – Bäume, Tannen, Büsche, Felsen, Blumen und Gras
//
//  Zwei Tricks, damit das auch auf dem iPad flüssig läuft:
//  1. "InstancedMesh": Ein Baum wird einmal gebaut und ganz oft kopiert.
//  2. "Stücke" (Chunks): Die Insel ist in Quadrate aufgeteilt. Gemalt
//     werden nur die Quadrate, die nah genug und im Blickfeld sind.
//     So machen das auch große Spiele wie Minecraft oder Fortnite.
// =============================================================
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { EINSTELLUNGEN } from './einstellungen.js';
import { fbm, zufallMitSeed } from './rauschen.js';
import { bodenHoehe, istWald, abstandZumPfad, abstandZumDorf, DORF } from './gelaende.js';

const zufall = zufallMitSeed(42);
const R = EINSTELLUNGEN.inselGroesse;
const STUECK = 60; // Seitenlänge eines Stücks in Metern

// Die Zeit für den Wind (alle Pflanzen wackeln mit derselben Uhr)
export const windZeit = { value: 0 };

// Bringt Pflanzen zum Wackeln: oben stärker als unten
function mitWind(material, staerke, nachHoehe) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uZeit = windZeit;
    shader.vertexShader = 'uniform float uZeit;\n' + shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      vec3 iPos = vec3(instanceMatrix[3]);
      float phase = iPos.x * 0.13 + iPos.z * 0.11;
      float h = ${nachHoehe ? 'max(position.y, 0.0)' : '1.0'};
      transformed.x += sin(uZeit * 1.7 + phase) * ${staerke.toFixed(3)} * h;
      transformed.z += cos(uZeit * 1.3 + phase * 1.3) * ${(staerke * 0.6).toFixed(3)} * h;`
    );
  };
  // Jede Wind-Stärke braucht ihr eigenes Shader-Programm
  material.customProgramCacheKey = () => `wind-${staerke}-${nachHoehe}`;
  return material;
}

// Macht eine Kugel etwas knubbelig, damit sie wie Blätter oder Stein aussieht
function knubbelKugel(seed, breite = 10, hoehe = 8, staerke = 0.36) {
  let geo = new THREE.SphereGeometry(1, breite, hoehe);
  geo.deleteAttribute('uv');
  geo.deleteAttribute('normal');
  geo = mergeVertices(geo); // Nahtstellen zusammenkleben, damit es rund aussieht
  const p = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = fbm(v.x * 1.8 + seed, v.y * 1.8 + v.z * 1.3, 3, seed);
    v.multiplyScalar(1 - staerke / 2 + n * staerke);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

// Darf hier etwas wachsen? (nicht am Zelt, nicht im Dorf, nicht auf dem Pfad)
function istFrei(x, z, abstand = 3) {
  if (Math.hypot(x, z) < 16) return false;
  if (abstandZumDorf(x, z) < DORF.radius + 4) return false;
  if (abstandZumPfad(x, z) < abstand) return false;
  return true;
}

function zufallsPunkt() {
  return [(zufall() - 0.5) * 2 * R, (zufall() - 0.5) * 2 * R];
}

// ---------- Stücke ----------
const alleStuecke = []; // { mesh, mitte, sichtweite }

// Verteilt viele Kopien (eintraege: { matrix, farbe, x, z }) auf Stücke
function inStuecken(geo, material, eintraege, { sichtweite = 190, schatten = true } = {}) {
  const gruppe = new THREE.Group();
  const sortiert = new Map();
  for (const e of eintraege) {
    const k = `${Math.floor(e.x / STUECK)},${Math.floor(e.z / STUECK)}`;
    if (!sortiert.has(k)) sortiert.set(k, []);
    sortiert.get(k).push(e);
  }
  for (const [k, liste] of sortiert) {
    const mesh = new THREE.InstancedMesh(geo, material, liste.length);
    liste.forEach((e, i) => {
      mesh.setMatrixAt(i, e.matrix);
      if (e.farbe) mesh.setColorAt(i, e.farbe);
    });
    mesh.computeBoundingSphere();
    mesh.castShadow = schatten;
    mesh.receiveShadow = true;
    const [kx, kz] = k.split(',').map(Number);
    alleStuecke.push({ mesh, mitte: new THREE.Vector2((kx + 0.5) * STUECK, (kz + 0.5) * STUECK), sichtweite });
    gruppe.add(mesh);
  }
  return gruppe;
}

const m4 = () => new THREE.Matrix4();
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);

function baueBaeume(gruppe, hindernisse) {
  const laub = [], tannen = [];
  for (let versuch = 0; versuch < EINSTELLUNGEN.anzahlBaeume * 12 && laub.length + tannen.length < EINSTELLUNGEN.anzahlBaeume; versuch++) {
    const [x, z] = zufallsPunkt();
    const h = bodenHoehe(x, z);
    if (h < 2 || h > 26 || !istFrei(x, z)) continue;
    if (!istWald(x, z) && zufall() > 0.12) continue; // außerhalb vom Wald nur wenige Bäume
    const s = 0.8 + zufall() * 0.8;
    const baum = { x, y: h, z, s, q: new THREE.Quaternion().setFromAxisAngle(v3(0, 1, 0), zufall() * Math.PI * 2) };
    (h > 11 || zufall() < 0.2 ? tannen : laub).push(baum);
    hindernisse.hinzufuegen(x, z, 0.45 * s);
  }

  // Laubbäume: Stamm + 3 knubbelige Kronen
  const gruen = ['#4f9e3a', '#5fae42', '#3d8a35', '#73b744', '#62a33c'];
  const staemme = [], kronen = [];
  for (const b of laub) {
    staemme.push({ x: b.x, z: b.z, matrix: m4().compose(v3(b.x, b.y - 0.1, b.z), b.q, v3(b.s, b.s, b.s)) });
    const grundFarbe = gruen[Math.floor(zufall() * gruen.length)];
    for (const [dx, dy, dz, r] of [[0, 3.1, 0, 1.45], [0.75, 2.5, 0.35, 1.0], [-0.65, 2.65, -0.45, 1.05]]) {
      const v = v3(dx, dy, dz).applyQuaternion(b.q).multiplyScalar(b.s);
      kronen.push({
        x: b.x, z: b.z,
        matrix: m4().compose(v3(b.x + v.x, b.y + v.y, b.z + v.z), b.q, v3(r * b.s, r * b.s, r * b.s)),
        farbe: new THREE.Color(grundFarbe).offsetHSL(0, 0, (zufall() - 0.5) * 0.08),
      });
    }
  }
  const stammGeo = new THREE.CylinderGeometry(0.22, 0.38, 2.4, 7);
  stammGeo.translate(0, 1.2, 0);
  gruppe.add(inStuecken(stammGeo, new THREE.MeshStandardMaterial({ color: '#7a5236', roughness: 1 }), staemme));
  gruppe.add(inStuecken(knubbelKugel(3), mitWind(new THREE.MeshStandardMaterial({ roughness: 0.85 }), 0.06, false), kronen));

  // Tannen: Stamm + 3 runde Kegel übereinander
  const tStaemme = [], tKronen = [];
  for (const b of tannen) {
    tStaemme.push({ x: b.x, z: b.z, matrix: m4().compose(v3(b.x, b.y - 0.1, b.z), b.q, v3(b.s, b.s, b.s)) });
    const grundFarbe = zufall() < 0.5 ? '#2f6b3a' : '#3b7a40';
    for (const [dy, r] of [[1.9, 1.6], [2.9, 1.25], [3.8, 0.85]]) {
      tKronen.push({
        x: b.x, z: b.z,
        matrix: m4().compose(v3(b.x, b.y + dy * b.s, b.z), b.q, v3(r * b.s, b.s, r * b.s)),
        farbe: new THREE.Color(grundFarbe).offsetHSL(0, 0, (zufall() - 0.5) * 0.06),
      });
    }
  }
  const tStammGeo = new THREE.CylinderGeometry(0.18, 0.3, 1.6, 6);
  tStammGeo.translate(0, 0.8, 0);
  gruppe.add(inStuecken(tStammGeo, new THREE.MeshStandardMaterial({ color: '#6b4630', roughness: 1 }), tStaemme));
  gruppe.add(inStuecken(new THREE.ConeGeometry(1, 1.6, 14), mitWind(new THREE.MeshStandardMaterial({ roughness: 0.85 }), 0.05, false), tKronen));
}

function baueFelsen(gruppe, hindernisse) {
  const material = new THREE.MeshStandardMaterial({ roughness: 0.9 });
  const formen = [knubbelKugel(11, 9, 7, 0.5), knubbelKugel(23, 9, 7, 0.5), knubbelKugel(37, 9, 7, 0.5)];
  const listen = formen.map(() => []);
  let n = 0;
  for (let versuch = 0; versuch < EINSTELLUNGEN.anzahlFelsen * 20 && n < EINSTELLUNGEN.anzahlFelsen; versuch++) {
    const [x, z] = zufallsPunkt();
    const h = bodenHoehe(x, z);
    if (h < 1 || !istFrei(x, z, 4)) continue;
    const s = 0.5 + zufall() * zufall() * 2.8 + (h > 15 ? 1 : 0);
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(zufall() * 0.5, zufall() * Math.PI * 2, zufall() * 0.5));
    listen[n % 3].push({
      x, z,
      matrix: m4().compose(v3(x, h + s * 0.15, z), q, v3(s * 1.3, s * 0.75, s)),
      farbe: new THREE.Color('#9a958d').offsetHSL(0, 0, (zufall() - 0.5) * 0.15),
    });
    hindernisse.hinzufuegen(x, z, s * 1.05);
    n++;
  }
  formen.forEach((geo, i) => gruppe.add(inStuecken(geo, material, listen[i], { sichtweite: 220 })));
}

function baueBuesche(gruppe) {
  const liste = [];
  for (let versuch = 0; versuch < 7000 && liste.length < 700; versuch++) {
    const [x, z] = zufallsPunkt();
    const h = bodenHoehe(x, z);
    if (h < 1.8 || h > 18 || !istFrei(x, z)) continue;
    const s = 0.4 + zufall() * 0.6;
    liste.push({
      x, z,
      matrix: m4().compose(v3(x, h + s * 0.35, z), new THREE.Quaternion(), v3(s * 1.2, s * 0.8, s * 1.2)),
      farbe: new THREE.Color(zufall() < 0.15 ? '#7aa83a' : '#4c9a3c').offsetHSL(0, 0, (zufall() - 0.5) * 0.1),
    });
  }
  gruppe.add(inStuecken(knubbelKugel(5, 8, 6), mitWind(new THREE.MeshStandardMaterial({ roughness: 0.9 }), 0.03, false), liste, { sichtweite: 120 }));
}

function baueBlumen(gruppe) {
  const stiel = new THREE.CylinderGeometry(0.015, 0.015, 0.35, 3);
  stiel.translate(0, 0.175, 0);
  stiel.deleteAttribute('uv');
  const bluete = new THREE.SphereGeometry(0.09, 6, 4);
  bluete.translate(0, 0.37, 0);
  bluete.deleteAttribute('uv');
  const geo = mergeGeometries([stiel, bluete]);
  // Trick: Die Blumenfarbe nur oben an der Blüte benutzen, der Stiel bleibt grün
  const material = mitWind(new THREE.MeshStandardMaterial({ roughness: 0.8 }), 0.08, true);
  const windShader = material.onBeforeCompile;
  material.onBeforeCompile = (shader) => {
    windShader(shader);
    shader.vertexShader = shader.vertexShader.replace(
      '#include <color_vertex>',
      `#include <color_vertex>
      #ifdef USE_INSTANCING_COLOR
        if (position.y < 0.3) vColor.xyz = vec3(0.12, 0.4, 0.1);
      #endif`
    );
  };
  material.customProgramCacheKey = () => 'blume';

  const farben = ['#ff5c8a', '#ffd23d', '#ffffff', '#a77bff', '#ff8a3d'];
  const liste = [];
  for (let versuch = 0; versuch < 3000 && liste.length < 2200; versuch++) {
    // Blumen wachsen in Grüppchen
    const [mx, mz] = zufallsPunkt();
    const farbe = new THREE.Color(farben[Math.floor(zufall() * farben.length)]);
    for (let k = 0; k < 8; k++) {
      const x = mx + (zufall() - 0.5) * 6, z = mz + (zufall() - 0.5) * 6;
      const h = bodenHoehe(x, z);
      if (h < 1.8 || h > 14 || istWald(x, z) || abstandZumPfad(x, z) < 2) continue;
      liste.push({ x, z, matrix: m4().makeTranslation(x, h, z), farbe });
    }
  }
  gruppe.add(inStuecken(geo, material, liste, { sichtweite: 90, schatten: false }));
}

function baueGras(gruppe) {
  // Ein Grasbüschel = 3 schmale Halme
  const halme = [];
  for (let k = 0; k < 3; k++) {
    const halm = new THREE.BufferGeometry();
    const w = 0.06;
    halm.setAttribute('position', new THREE.Float32BufferAttribute([-w, 0, 0, w, 0, 0, 0, 1, 0], 3));
    halm.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
    halm.setAttribute('color', new THREE.Float32BufferAttribute([0.35, 0.6, 0.2, 0.35, 0.6, 0.2, 0.75, 0.95, 0.4], 3));
    halm.rotateZ((k - 1) * 0.3);
    halm.rotateY(k * 2.1);
    halm.translate((k - 1) * 0.08, 0, (k % 2) * 0.06);
    halme.push(halm);
  }
  const geo = mergeGeometries(halme);
  const material = mitWind(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }), 0.12, true);
  // Halme sollen von beiden Seiten gleich hell sein (sonst wirkt die Rückseite schwarz)
  const windShader = material.onBeforeCompile;
  material.onBeforeCompile = (shader) => {
    windShader(shader);
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <normal_fragment_begin>',
      THREE.ShaderChunk.normal_fragment_begin.replace('gl_FrontFacing ? 1.0 : - 1.0', '1.0')
    );
  };
  material.customProgramCacheKey = () => 'gras';
  const liste = [];
  const achse = v3(0, 1, 0);
  for (let k = 0; k < 120000 && liste.length < 50000; k++) {
    const [x, z] = zufallsPunkt();
    const h = bodenHoehe(x, z);
    if (h < 1.7 || h > 17 || abstandZumPfad(x, z) < 1.6) continue;
    liste.push({
      x, z,
      matrix: m4().compose(v3(x, h - 0.05, z), new THREE.Quaternion().setFromAxisAngle(achse, zufall() * Math.PI * 2), v3(1, 0.25 + zufall() * 0.3, 1)),
      farbe: new THREE.Color().setHSL(0.25 + zufall() * 0.05, 0.6, 0.45 + zufall() * 0.15),
    });
  }
  gruppe.add(inStuecken(geo, material, liste, { sichtweite: 75, schatten: false }));
}

export function baueNatur(szene, hindernisse) {
  const gruppe = new THREE.Group();
  baueBaeume(gruppe, hindernisse);
  baueFelsen(gruppe, hindernisse);
  baueBuesche(gruppe);
  baueBlumen(gruppe);
  baueGras(gruppe);
  szene.add(gruppe);
}

// Jedes Bild: Wind weiterlaufen lassen, nur nahe Stücke zeigen
export function aktualisiereNatur(dt, spielerPos) {
  windZeit.value += dt;
  for (const s of alleStuecke) {
    s.mesh.visible = Math.hypot(s.mitte.x - spielerPos.x, s.mitte.y - spielerPos.z) < s.sichtweite + STUECK * 0.7;
  }
}
