// =============================================================
//  NATUR – Bäume, Tannen, Büsche, Felsen, Blumen und Gras
//
//  Tricks, damit das realistisch aussieht UND auf dem iPad läuft:
//  1. Baumkronen sind keine Kugeln mehr, sondern viele kleine Flächen
//     ("Karten") mit Fotos von echten Blättern drauf. Das Durchsichtige
//     zwischen den Blättern wird weggeschnitten. So machen das auch
//     große Spiele!
//  2. "InstancedMesh": Ein Baum wird einmal gebaut und ganz oft kopiert.
//  3. "Stücke" (Chunks): Gemalt wird nur, was in der Nähe ist.
// =============================================================
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { EINSTELLUNGEN } from './einstellungen.js';
import { fbm, zufallMitSeed } from './rauschen.js';
import { bodenHoehe, istWald, abstandZumPfad, abstandZumDorf, gitterWerte, DORF } from './gelaende.js';
import { textur } from './texturen.js';

const zufall = zufallMitSeed(42);
const R = EINSTELLUNGEN.inselGroesse;
const STUECK = 80; // Seitenlänge eines Stücks in Metern

// Die Zeit für den Wind (alle Pflanzen wackeln mit derselben Uhr)
export const windZeit = { value: 0 };

// Bringt Pflanzen zum Wackeln: je höher ein Punkt, desto mehr wackelt er
function mitWind(material, staerke, ab = 0, name = '') {
  const vorher = material.onBeforeCompile;
  material.onBeforeCompile = (shader, r) => {
    if (vorher) vorher(shader, r);
    shader.uniforms.uZeit = windZeit;
    shader.vertexShader = 'uniform float uZeit;\n' + shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      vec3 iPos = vec3(instanceMatrix[3]);
      float phase = iPos.x * 0.13 + iPos.z * 0.11;
      float h = max(position.y - ${ab.toFixed(2)}, 0.0);
      float boe = 0.6 + 0.4 * sin(uZeit * 0.5 + iPos.x * 0.02);
      transformed.x += sin(uZeit * 1.7 + phase + position.z * 0.8) * ${staerke.toFixed(3)} * h * boe;
      transformed.z += cos(uZeit * 1.3 + phase * 1.3 + position.x * 0.8) * ${(staerke * 0.6).toFixed(3)} * h * boe;`
    );
  };
  material.customProgramCacheKey = () => `wind-${staerke}-${ab}-${name}`;
  return material;
}

// Blätter und Gras sind dünne Flächen: Beide Seiten sollen gleich hell sein
// (sonst wirkt die Rückseite schwarz)
function beideSeitenHell(material) {
  const vorher = material.onBeforeCompile;
  material.onBeforeCompile = (shader, r) => {
    if (vorher) vorher(shader, r);
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <normal_fragment_begin>',
      THREE.ShaderChunk.normal_fragment_begin.replace('gl_FrontFacing ? 1.0 : - 1.0', '1.0')
    );
  };
  return material;
}

// Eine Kugel, die etwas knubbelig ist (für Felsen)
function knubbelKugel(seed, breite = 10, hoehe = 8, staerke = 0.36) {
  let geo = new THREE.SphereGeometry(1, breite, hoehe);
  geo.deleteAttribute('uv');
  geo.deleteAttribute('normal');
  geo = mergeVertices(geo);
  const p = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = fbm(v.x * 1.8 + seed, v.y * 1.8 + v.z * 1.3, 3, seed);
    v.multiplyScalar(1 - staerke / 2 + n * staerke);
    if (v.y < -0.3) v.y = -0.3 + (v.y + 0.3) * 0.3; // unten abgeflacht – liegt auf dem Boden
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

// Eine Blätter-Karte: ein Rechteck mit Bild. Die Normalen zeigen vom
// Kronen-Mittelpunkt weg, dadurch wird die ganze Krone weich beleuchtet.
function karte(breite, hoehe, mitte, kronenMitte, drehung, anfangLinks = false) {
  const geo = new THREE.PlaneGeometry(breite, hoehe);
  if (anfangLinks) geo.translate(breite / 2, 0, 0);
  geo.applyQuaternion(drehung);
  geo.translate(mitte.x, mitte.y, mitte.z);
  const p = geo.attributes.position, n = geo.attributes.normal;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).sub(kronenMitte).normalize();
    v.y = v.y * 0.6 + 0.4;
    v.normalize();
    n.setXYZ(i, v.x, v.y, v.z);
  }
  return geo;
}

function zweig(von, nach, radius) {
  const richtung = nach.clone().sub(von);
  const geo = new THREE.CylinderGeometry(radius * 0.5, radius, richtung.length(), 5);
  geo.translate(0, richtung.length() / 2, 0);
  geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), richtung.normalize()));
  geo.translate(von.x, von.y, von.z);
  return geo;
}

// ---------- Laubbaum: Stamm mit Ästen + Krone aus Blätter-Karten ----------
function baueLaubbaumForm(z) {
  const holz = [];
  const stamm = new THREE.CylinderGeometry(0.2, 0.36, 3.6, 9, 4);
  // Stamm leicht krumm
  const sp = stamm.attributes.position;
  for (let i = 0; i < sp.count; i++) {
    const y = sp.getY(i) + 1.8;
    sp.setX(i, sp.getX(i) + Math.sin(y * 0.9) * 0.08);
    sp.setY(i, y);
  }
  holz.push(stamm);
  const kronenMitte = new THREE.Vector3(0, 4.6, 0);
  const astEnden = [];
  for (let k = 0; k < 6; k++) {
    const w = (k / 6) * Math.PI * 2 + z() * 0.6;
    const start = new THREE.Vector3(0, 2.6 + z() * 1.0, 0);
    const ende = new THREE.Vector3(Math.cos(w) * (1.4 + z()), start.y + 1.2 + z() * 1.2, Math.sin(w) * (1.4 + z()));
    holz.push(zweig(start, ende, 0.1));
    astEnden.push(ende);
  }
  const blaetter = [];
  const q = new THREE.Quaternion(), e = new THREE.Euler();
  for (let k = 0; k < 46; k++) {
    // Karten sitzen in einer Wolke um die Ast-Enden und den Kronen-Mittelpunkt
    const basis = k < 30 ? astEnden[k % astEnden.length] : kronenMitte;
    const ort = new THREE.Vector3((z() - 0.5) * 2.2, (z() - 0.4) * 1.8, (z() - 0.5) * 2.2).add(basis);
    ort.lerp(kronenMitte, 0.15);
    q.setFromEuler(e.set(z() * Math.PI, z() * Math.PI * 2, z() * Math.PI));
    const g = 1.5 + z() * 1.1;
    blaetter.push(karte(g, g, ort, kronenMitte, q));
  }
  return { holz: rindeWiederholen(mergeGeometries(holz), 3), blaetter: mergeGeometries(blaetter) };
}

// ---------- Tanne: Stamm + Etagen aus Nadelzweig-Karten ----------
function baueTannenForm(z) {
  const stamm = new THREE.CylinderGeometry(0.08, 0.3, 7.5, 8);
  stamm.translate(0, 3.75, 0);
  const zweige = [];
  const kronenMitte = new THREE.Vector3(0, 3.6, 0);
  const q = new THREE.Quaternion(), e = new THREE.Euler();
  const etagen = 14;
  for (let et = 0; et < etagen; et++) {
    const t = et / (etagen - 1);
    const y = 1.3 + t * 5.6;
    const laenge = 2.7 * (1 - t) + 0.5;
    const anzahl = Math.round(8 - t * 3);
    for (let k = 0; k < anzahl; k++) {
      const w = (k / anzahl) * Math.PI * 2 + et * 0.7 + z() * 0.4;
      // Zweig zeigt nach außen und hängt ein bisschen nach unten
      q.setFromEuler(e.set(z() * 0.8 - 0.4 + Math.PI / 2 * (z() < 0.5 ? 1 : 0), -w, -0.25 - z() * 0.2, 'YZX'));
      zweige.push(karte(laenge, laenge * 0.62, new THREE.Vector3(0, y, 0), kronenMitte, q, true));
    }
  }
  // Spitze: zwei gekreuzte Karten nach oben
  for (const w of [0, Math.PI / 2]) {
    q.setFromEuler(e.set(0, w, Math.PI / 2));
    zweige.push(karte(1.4, 0.7, new THREE.Vector3(0, 6.6, 0), kronenMitte, q, true));
  }
  return { holz: rindeWiederholen(stamm, 5), blaetter: mergeGeometries(zweige) };
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

// ---------- Holz: Bäume und Büsche, die man fällen kann ----------
const holzStellen = [];
const holzGitter = new Map();
const nullMatrix = new THREE.Matrix4().makeScale(0, 0, 0);

function holzGitterBauen() {
  holzStellen.forEach((h) => {
    const k = `${Math.floor(h.x / 10)},${Math.floor(h.z / 10)}`;
    if (!holzGitter.has(k)) holzGitter.set(k, []);
    holzGitter.get(k).push(h);
  });
}

// Welcher Baum oder Busch steht ganz nah? (oder null)
export function holzInDerNaehe(x, z) {
  const kx = Math.floor(x / 10), kz = Math.floor(z / 10);
  let beste = null, besterAbstand = Infinity;
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      for (const h of holzGitter.get(`${kx + dx},${kz + dz}`) || []) {
        if (h.weg) continue;
        const d = Math.hypot(h.x - x, h.z - z);
        const reichweite = h.art === 'baum' ? 2.4 : 2.0;
        if (d < reichweite && d < besterAbstand) {
          beste = h;
          besterAbstand = d;
        }
      }
    }
  }
  return beste;
}

// Ein Schlag mit dem Schwert. Gibt zurück, wie viel Holz man bekommt (0 = noch nicht umgefallen)
export function schlagen(h) {
  h.schlaege++;
  const noetig = h.art === 'baum' ? EINSTELLUNGEN.schlaegeProBaum : 1;
  if (h.schlaege < noetig) return 0;
  verschwinden(h);
  return h.art === 'baum' ? EINSTELLUNGEN.holzProBaum : EINSTELLUNGEN.holzProBusch;
}

function verschwinden(h) {
  h.weg = true;
  for (const { mesh, index } of h.ziele) {
    mesh.setMatrixAt(index, nullMatrix);
    mesh.instanceMatrix.needsUpdate = true;
  }
  if (h.hindernis) naturHindernisse.entfernen(h.hindernis);
}

// Für den Spielstand: welche Nummern sind gefällt?
export function gefaellteHolzStellen() {
  return holzStellen.map((h, i) => (h.weg ? i : -1)).filter((i) => i >= 0);
}

export function ladeGefaellte(liste) {
  for (const i of liste || []) if (holzStellen[i] && !holzStellen[i].weg) verschwinden(holzStellen[i]);
}

let naturHindernisse = null;

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
      // Merken, wo dieses Ding gemalt wird (damit man es später fällen kann)
      const besitzer = e.besitzer || e;
      if (besitzer.ziele) besitzer.ziele.push({ mesh, index: i });
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
const hochAchse = v3(0, 1, 0);

function blattMaterial(bild, wind, ab, name) {
  return beideSeitenHell(mitWind(new THREE.MeshStandardMaterial({
    map: textur(bild, { wiederholen: false }),
    alphaTest: 0.45,
    side: THREE.DoubleSide,
    roughness: 0.75,
  }), wind, ab, name));
}

function holzMaterial(bild) {
  return new THREE.MeshStandardMaterial({ map: textur(bild), normalMap: textur('rinde_normal.jpg', { farbe: false }), roughness: 0.95 });
}

// Die Rinde soll sich am Stamm mehrmals wiederholen, statt lang gezogen zu sein
function rindeWiederholen(geo, mal) {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) * mal);
  return geo;
}

function baueBaeume(gruppe, hindernisse) {
  const laub = [], tannen = [];
  for (let versuch = 0; versuch < EINSTELLUNGEN.anzahlBaeume * 12 && laub.length + tannen.length < EINSTELLUNGEN.anzahlBaeume; versuch++) {
    const [x, z] = zufallsPunkt();
    const h = bodenHoehe(x, z);
    if (h < 2 || h > 26 || !istFrei(x, z)) continue;
    if (!istWald(x, z) && zufall() > 0.12) continue; // außerhalb vom Wald nur wenige Bäume
    const s = 0.75 + zufall() * 0.7;
    const baum = {
      x, z, ziele: [], art: 'baum', schlaege: 0, weg: false,
      matrix: m4().compose(
        v3(x, h - 0.15, z),
        new THREE.Quaternion().setFromAxisAngle(hochAchse, zufall() * Math.PI * 2),
        v3(s * (0.9 + zufall() * 0.2), s * (0.85 + zufall() * 0.3), s * (0.9 + zufall() * 0.2))
      ),
    };
    if (h > 11 || zufall() < 0.22) tannen.push(baum);
    else laub.push(baum);
    baum.hindernis = hindernisse.hinzufuegen(x, z, 0.45 * s);
    holzStellen.push(baum);
  }

  // Jeder Baum bekommt eine etwas andere Blattfarbe (Frühling, Sommer, dunkel)
  const laubFarben = laub.map((b) => ({ ...b, besitzer: b, farbe: new THREE.Color().setHSL(0.17 + zufall() * 0.12, 0.35 + zufall() * 0.2, 0.74 + zufall() * 0.2) }));
  const tannenFarben = tannen.map((b) => ({ ...b, besitzer: b, farbe: new THREE.Color().setHSL(0.3 + zufall() * 0.05, 0.25, 0.7 + zufall() * 0.15) }));

  const laubForm = baueLaubbaumForm(zufallMitSeed(5));
  const tannenForm = baueTannenForm(zufallMitSeed(9));
  gruppe.add(inStuecken(laubForm.holz, holzMaterial('rinde.jpg'), laub));
  gruppe.add(inStuecken(laubForm.blaetter, blattMaterial('blaetter.png', 0.035, 2.5, 'laub'), laubFarben));
  gruppe.add(inStuecken(tannenForm.holz, holzMaterial('rinde_tanne.jpg'), tannen));
  gruppe.add(inStuecken(tannenForm.blaetter, blattMaterial('nadeln.png', 0.025, 1.5, 'tanne'), tannenFarben));
}

// Felsen mit Foto-Oberfläche und etwas Moos obendrauf
function felsMaterial() {
  const material = new THREE.MeshStandardMaterial({ roughness: 0.92 });
  const tFels = textur('fels.jpg');
  const tGras = textur('gras.jpg');
  material.onBeforeCompile = (shader) => {
    shader.uniforms.tFels = { value: tFels };
    shader.uniforms.tGras = { value: tGras };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWP;\nvarying vec3 vWN;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vWP = (modelMatrix * instanceMatrix * vec4(position, 1.0)).xyz;
        vWN = normalize(mat3(modelMatrix * instanceMatrix) * normal);`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D tFels, tGras;\nvarying vec3 vWP;\nvarying vec3 vWN;')
      .replace('#include <map_fragment>', `
        vec3 nb = pow(abs(normalize(vWN)), vec3(3.0));
        nb /= (nb.x + nb.y + nb.z);
        vec3 fels = texture2D(tFels, vWP.zy / 3.0).rgb * nb.x + texture2D(tFels, vWP.xz / 3.0).rgb * nb.y + texture2D(tFels, vWP.xy / 3.0).rgb * nb.z;
        float moos = smoothstep(0.55, 0.85, normalize(vWN).y) * 0.8;
        vec3 gruen = texture2D(tGras, vWP.xz / 2.0).rgb * vec3(0.75, 0.85, 0.6);
        diffuseColor.rgb *= mix(fels * 1.15, gruen, moos);`);
  };
  material.customProgramCacheKey = () => 'fels';
  return material;
}

function baueFelsen(gruppe, hindernisse) {
  const material = felsMaterial();
  const formen = [knubbelKugel(11, 14, 10, 0.55), knubbelKugel(23, 14, 10, 0.5)];
  const listen = formen.map(() => []);
  let n = 0;
  for (let versuch = 0; versuch < EINSTELLUNGEN.anzahlFelsen * 20 && n < EINSTELLUNGEN.anzahlFelsen; versuch++) {
    const [x, z] = zufallsPunkt();
    const h = bodenHoehe(x, z);
    if (h < 1 || !istFrei(x, z, 4)) continue;
    const s = 0.5 + zufall() * zufall() * 2.8 + (h > 15 ? 1 : 0);
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(zufall() * 0.4, zufall() * Math.PI * 2, zufall() * 0.4));
    listen[n % formen.length].push({
      x, z,
      matrix: m4().compose(v3(x, h + s * 0.12, z), q, v3(s * 1.3, s * 0.8, s)),
      farbe: new THREE.Color().setScalar(0.85 + zufall() * 0.25),
    });
    hindernisse.hinzufuegen(x, z, s * 1.05);
    n++;
  }
  formen.forEach((geo, i) => gruppe.add(inStuecken(geo, material, listen[i], { sichtweite: 220 })));
}

// Büsche: kleine Blätter-Wolken direkt am Boden
function baueBuesche(gruppe) {
  const z = zufallMitSeed(77);
  const mitte = v3(0, 0.6, 0);
  const karten = [];
  const q = new THREE.Quaternion(), e = new THREE.Euler();
  for (let k = 0; k < 14; k++) {
    const ort = v3((z() - 0.5) * 1.4, 0.3 + z() * 0.7, (z() - 0.5) * 1.4);
    q.setFromEuler(e.set(z() * Math.PI, z() * Math.PI * 2, z() * Math.PI));
    karten.push(karte(1.1, 1.1, ort, mitte, q));
  }
  const form = mergeGeometries(karten);
  const liste = [];
  for (let versuch = 0; versuch < 9000 && liste.length < 900; versuch++) {
    const [x, zz] = zufallsPunkt();
    const h = bodenHoehe(x, zz);
    if (h < 1.8 || h > 18 || !istFrei(x, zz)) continue;
    const s = 0.6 + zufall() * 0.8;
    const busch = {
      x, z: zz, ziele: [], art: 'busch', schlaege: 0, weg: false,
      matrix: m4().compose(v3(x, h - 0.1, zz), new THREE.Quaternion().setFromAxisAngle(hochAchse, zufall() * 6.3), v3(s * 1.2, s, s * 1.2)),
      farbe: new THREE.Color().setHSL(0.2 + zufall() * 0.1, 0.35, 0.62 + zufall() * 0.15),
    };
    liste.push(busch);
    holzStellen.push(busch);
  }
  gruppe.add(inStuecken(form, blattMaterial('blaetter.png', 0.04, 0.2, 'busch'), liste, { sichtweite: 130 }));
}

function baueBlumen(gruppe) {
  const stiel = new THREE.CylinderGeometry(0.012, 0.012, 0.35, 3);
  stiel.translate(0, 0.175, 0);
  stiel.deleteAttribute('uv');
  const bluete = new THREE.SphereGeometry(0.07, 6, 4);
  bluete.scale(1, 0.6, 1);
  bluete.translate(0, 0.37, 0);
  bluete.deleteAttribute('uv');
  const geo = mergeGeometries([stiel, bluete]);
  // Trick: Die Blumenfarbe nur oben an der Blüte benutzen, der Stiel bleibt grün
  const material = mitWind(new THREE.MeshStandardMaterial({ roughness: 0.8 }), 0.25, 0, 'blume');
  const windShader = material.onBeforeCompile;
  material.onBeforeCompile = (shader, r) => {
    windShader(shader, r);
    shader.vertexShader = shader.vertexShader.replace(
      '#include <color_vertex>',
      `#include <color_vertex>
      #ifdef USE_INSTANCING_COLOR
        if (position.y < 0.3) vColor.xyz = vec3(0.12, 0.4, 0.1);
      #endif`
    );
  };

  const farben = ['#ff5c8a', '#ffd23d', '#ffffff', '#a77bff', '#ff8a3d', '#5c9dff'];
  const liste = [];
  for (let versuch = 0; versuch < 4000 && liste.length < 3000; versuch++) {
    // Blumen wachsen in Grüppchen
    const [mx, mz] = zufallsPunkt();
    const farbe = new THREE.Color(farben[Math.floor(zufall() * farben.length)]);
    for (let k = 0; k < 10; k++) {
      const x = mx + (zufall() - 0.5) * 6, z = mz + (zufall() - 0.5) * 6;
      const h = bodenHoehe(x, z);
      if (h < 1.8 || h > 14 || istWald(x, z) || abstandZumPfad(x, z) < 2) continue;
      const s = 0.7 + zufall() * 0.6;
      liste.push({ x, z, matrix: m4().compose(v3(x, h, z), new THREE.Quaternion(), v3(s, s, s)), farbe });
    }
  }
  gruppe.add(inStuecken(geo, material, liste, { sichtweite: 90, schatten: false }));
}

// Gras: Büschel aus zwei gekreuzten Bild-Karten
function baueGras(gruppe) {
  const teile = [];
  for (const w of [0, Math.PI / 2]) {
    const k = new THREE.PlaneGeometry(0.75, 0.45);
    k.translate(0, 0.22, 0);
    k.rotateY(w);
    const n = k.attributes.normal;
    for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0); // wie der Boden beleuchtet
    teile.push(k);
  }
  const geo = mergeGeometries(teile);
  const material = beideSeitenHell(mitWind(new THREE.MeshLambertMaterial({
    map: textur('grasbueschel.png', { wiederholen: false }),
    alphaTest: 0.5,
    side: THREE.DoubleSide,
    color: new THREE.Color(1.45, 1.55, 1.25), // etwas heller, passend zum Boden
  }), 0.22, 0, 'gras'));
  const liste = [];
  for (let k = 0; k < 360000 && liste.length < 130000; k++) {
    const [x, z] = zufallsPunkt();
    const boden = gitterWerte(x, z);
    const h = boden.hoehe;
    if (h < 1.6 || h > 20) continue;
    const dichte = boden.wiese + boden.wald * 0.35;
    if (zufall() > dichte) continue;
    const s = 0.7 + zufall() * 0.7;
    liste.push({
      x, z,
      matrix: m4().compose(v3(x, h - 0.04, z), new THREE.Quaternion().setFromAxisAngle(hochAchse, zufall() * Math.PI), v3(s, s * (0.8 + zufall() * 0.5), s)),
      farbe: new THREE.Color().setHSL(0.18 + zufall() * 0.08, 0.3 + zufall() * 0.2, 0.75 + zufall() * 0.2),
    });
  }
  gruppe.add(inStuecken(geo, material, liste, { sichtweite: 70, schatten: false }));
}

export function baueNatur(szene, hindernisse) {
  naturHindernisse = hindernisse;
  const gruppe = new THREE.Group();
  baueBaeume(gruppe, hindernisse);
  baueFelsen(gruppe, hindernisse);
  baueBuesche(gruppe);
  baueBlumen(gruppe);
  baueGras(gruppe);
  holzGitterBauen();
  szene.add(gruppe);
}

// Wie weit man Pflanzen sieht (1 = normal). Ruckelt das iPad, wird es kleiner.
let detail = 1;
export function wenigerDetails() {
  if (detail <= 0.55) return false;
  detail -= 0.15;
  return true;
}

// Jedes Bild: Wind weiterlaufen lassen, nur nahe Stücke zeigen
export function aktualisiereNatur(dt, spielerPos) {
  windZeit.value += dt;
  for (const s of alleStuecke) {
    s.mesh.visible = Math.hypot(s.mitte.x - spielerPos.x, s.mitte.y - spielerPos.z) < s.sichtweite * detail + STUECK * 0.7;
  }
}
