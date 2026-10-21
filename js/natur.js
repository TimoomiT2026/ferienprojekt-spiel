// =============================================================
//  NATUR – Bäume, Tannen, Büsche, Farne, Felsen, Blumen und Gras
//
//  Tricks, damit das realistisch aussieht UND auf dem iPad läuft:
//  1. Baumkronen sind keine Kugeln, sondern viele kleine Flächen
//     ("Karten") mit Fotos von echten Blättern drauf. Das Durchsichtige
//     zwischen den Blättern wird weggeschnitten. So machen das auch
//     große Spiele!
//  2. "InstancedMesh": Ein Baum wird einmal gebaut und ganz oft kopiert.
//  3. "Stücke" (Chunks): Gemalt wird nur, was in der Nähe ist.
//  4. "Falsches Umgebungslicht" (Fake-AO): Innen und unten in der Krone
//     ist es dunkler, weil da weniger Himmel hinkommt. Das malen wir
//     einfach als Farbe in die Ecken der Karten – kostet fast nichts.
//  5. Ein Bild mit 4 Laubsorten (ein "Atlas"): Jeder Baum sucht sich
//     selbst eine Sorte aus. So gibt es viele verschiedene Bäume,
//     aber der Computer muss trotzdem nur ein Bild laden.
// =============================================================
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { EINSTELLUNGEN } from './einstellungen.js';
import { fbm, zufallMitSeed } from './rauschen.js';
import { bodenHoehe, istWald, abstandZumPfad, abstandZumDorf, gitterWerte, DORF, WASSER_HOEHE } from './gelaende.js';
import { textur } from './texturen.js';

const zufall = zufallMitSeed(42);
const R = EINSTELLUNGEN.inselGroesse;
const STUECK = 80; // Seitenlänge eines Stücks in Metern

// Die Zeit für den Wind (alle Pflanzen wackeln mit derselben Uhr)
export const windZeit = { value: 0 };
// Wie weit Gras & Co. gemalt werden (wird kleiner, wenn das iPad ruckelt)
const detailWert = { value: 1 };

// Ein fester "Zufall" für einen Ort: gleicher Ort = gleiche Zahl (0 bis 1)
function ortZufall(x, z, seed = 0) {
  const s = Math.sin(x * 12.9898 + z * 78.233 + seed * 37.719) * 43758.5453;
  return s - Math.floor(s);
}

// Bringt Pflanzen zum Wackeln: je höher ein Punkt, desto mehr wackelt er.
// flattern = kleines, schnelles Zittern der Blätter
function mitWind(material, staerke, ab = 0, name = '', flattern = 0) {
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
      transformed.z += cos(uZeit * 1.3 + phase * 1.3 + position.x * 0.8) * ${(staerke * 0.6).toFixed(3)} * h * boe;
      float zittern = sin(uZeit * 6.3 + dot(position, vec3(2.3, 1.9, 2.7)) + phase * 3.0);
      transformed += vec3(0.6, 1.0, 0.5) * zittern * ${flattern.toFixed(3)} * min(h, 1.5) * boe;`
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

// Blätter glänzen kaum. Ohne das hier leuchten die Ränder der Krone
// weißlich, weil schräg getroffene Flächen den Himmel spiegeln.
function wenigGlanz(material) {
  const vorher = material.onBeforeCompile;
  material.onBeforeCompile = (shader, r) => {
    if (vorher) vorher(shader, r);
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <lights_physical_fragment>',
      `#include <lights_physical_fragment>
      material.specularColor *= 0.35;
      material.specularF90 = 0.2;`
    );
  };
  return material;
}

// Jede Kopie sucht sich eins der 4 Bilder im Laub-Atlas aus.
// gewichte = wie oft welches Bild genommen wird (oben links, oben rechts, unten links, unten rechts)
function atlasWahl(material, gewichte) {
  const summe = gewichte.reduce((a, b) => a + b, 0);
  const g1 = gewichte[0] / summe, g2 = g1 + gewichte[1] / summe, g3 = g2 + gewichte[2] / summe;
  const vorher = material.onBeforeCompile;
  material.onBeforeCompile = (shader, r) => {
    if (vorher) vorher(shader, r);
    shader.vertexShader = shader.vertexShader.replace(
      '#include <uv_vertex>',
      `#include <uv_vertex>
      vec3 aPos = vec3(instanceMatrix[3]);
      float los = fract(sin(dot(aPos.xz, vec2(12.9898, 78.233))) * 43758.5453);
      vec2 feld = los < ${g1.toFixed(3)} ? vec2(0.0) : los < ${g2.toFixed(3)} ? vec2(0.5, 0.0) : los < ${g3.toFixed(3)} ? vec2(0.0, -0.5) : vec2(0.5, -0.5);
      vMapUv += feld;`
    );
  };
  return material;
}

// Kleines Zeug (Gras, Farne, Blumen) wird in der Ferne erst weniger und
// verschwindet dann ganz sanft – statt plötzlich aufzuploppen.
// nah = bis hier ist alles da, weit = ab hier ist nichts mehr da
function inDerFerneWeniger(material, nah, weit, rest = 0.35) {
  const vorher = material.onBeforeCompile;
  material.onBeforeCompile = (shader, r) => {
    if (vorher) vorher(shader, r);
    shader.uniforms.uDetail = detailWert;
    // (erst ganz am Ende, nach dem Wind – sonst bleiben dünne Reste übrig)
    shader.vertexShader = 'uniform float uDetail;\n' + shader.vertexShader.replace(
      '#include <project_vertex>',
      `vec3 fPos = (modelMatrix * vec4(vec3(instanceMatrix[3]), 1.0)).xyz;
      float weg = distance(fPos.xz, cameraPosition.xz) / uDetail;
      float fLos = fract(sin(dot(fPos.xz, vec2(41.31, 17.73))) * 9631.17);
      float bleibt = step(fLos, 1.0 - smoothstep(${(nah * 0.35).toFixed(1)}, ${nah.toFixed(1)}, weg) * ${(1 - rest).toFixed(2)});
      transformed *= bleibt * (1.0 - smoothstep(${nah.toFixed(1)}, ${weit.toFixed(1)}, weg));
      #include <project_vertex>`
    );
  };
  return material;
}

// Jedem Punkt eine Helligkeit geben (für das falsche Umgebungslicht)
function mitHelligkeit(geo, rechne) {
  const p = geo.attributes.position;
  const farben = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const a = rechne(p.getX(i), p.getY(i), p.getZ(i), i);
    farben[i * 3] = farben[i * 3 + 1] = farben[i * 3 + 2] = a;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(farben, 3));
  return geo;
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
// radien = wie breit/hoch die Krone ist (damit auch längliche Kronen passen)
function karte(breite, hoehe, mitte, kronenMitte, drehung, anfangLinks = false, radien = null) {
  const geo = new THREE.PlaneGeometry(breite, hoehe);
  if (anfangLinks) geo.translate(breite / 2, 0, 0);
  geo.applyQuaternion(drehung);
  geo.translate(mitte.x, mitte.y, mitte.z);
  const p = geo.attributes.position, n = geo.attributes.normal;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).sub(kronenMitte);
    if (radien) v.divide(radien);
    v.normalize();
    v.y = v.y * 0.6 + 0.4;
    v.normalize();
    n.setXYZ(i, v.x, v.y, v.z);
  }
  return geo;
}

// Bilder-Karten benutzen nur ein Viertel vom Laub-Atlas (oben links)
function atlasViertel(geo) {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.5, 0.5 + uv.getY(i) * 0.5);
  return geo;
}

function zweig(von, nach, radius, seiten = 5) {
  const richtung = nach.clone().sub(von);
  const geo = new THREE.CylinderGeometry(radius * 0.45, radius, richtung.length(), seiten, 1, true);
  geo.translate(0, richtung.length() / 2, 0);
  geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), richtung.normalize()));
  geo.translate(von.x, von.y, von.z);
  return geo;
}

// Stamm mit Wurzelansatz: unten wird er breiter und bekommt "Wurzel-Beulen"
function baueStamm(oben, unten, hoehe, seiten, wurzeln, krumm, z) {
  const stamm = new THREE.CylinderGeometry(oben, unten, hoehe, seiten, 4, true);
  const sp = stamm.attributes.position;
  const dreh = z() * 6.28;
  for (let i = 0; i < sp.count; i++) {
    // Die Ringe liegen unten dichter (da ist der Wurzelansatz)
    const y = Math.pow(Math.max(0, (sp.getY(i) + hoehe / 2) / hoehe), 1.9) * hoehe;
    let x = sp.getX(i), zz = sp.getZ(i);
    const w = Math.atan2(zz, x);
    const fuss = Math.max(0, 1 - y / 1.1);
    const beule = Math.pow(Math.max(0, Math.cos(w * wurzeln + dreh)), 3);
    const f = 1 + fuss * fuss * (0.35 + 1.1 * beule);
    x *= f;
    zz *= f;
    sp.setXYZ(i, x + Math.sin(y * 0.9) * krumm, y < 0.01 ? -0.3 : y, zz + Math.cos(y * 0.7) * krumm * 0.5);
    stamm.attributes.uv.setY(i, y / hoehe); // Rinde nicht verzerren
  }
  stamm.computeVertexNormals();
  return stamm;
}

// Damit alle Holz-Teile zusammenpassen: jede Form bekommt dieselben Zusätze
function holzFertig(teile, rindeMal) {
  const geo = mergeGeometries(teile);
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) * rindeMal);
  // Unten am Boden etwas dunkler (da kommt kaum Licht hin)
  return mitHelligkeit(geo, (x, y) => 0.62 + 0.38 * THREE.MathUtils.smoothstep(y, -0.2, 0.9));
}

// ---------- Laubbaum: Stamm mit Ästen + Krone aus Blätter-Karten ----------
// art = 'breit' (runde, breite Krone) oder 'hoch' (schmale, hohe Krone)
function baueLaubbaumForm(z, art) {
  const hoch = art === 'hoch';
  const stammHoehe = hoch ? 4.4 : 3.3;
  const holz = [baueStamm(hoch ? 0.15 : 0.2, hoch ? 0.3 : 0.38, stammHoehe, 8, hoch ? 4 : 5, 0.08, z)];
  const kronenMitte = new THREE.Vector3(0, hoch ? 6.0 : 4.7, 0);
  const radien = hoch ? new THREE.Vector3(1.9, 2.9, 1.9) : new THREE.Vector3(3.0, 2.2, 3.0);
  // Ein paar dicke Hauptäste, an denen kleinere Äste hängen.
  // An den Enden der Äste sitzen die Blätter-Klumpen.
  const klumpen = [];
  const hauptAeste = hoch ? 5 : 4;
  for (let k = 0; k < hauptAeste; k++) {
    const w = (k / hauptAeste) * Math.PI * 2 + z() * 0.6;
    const start = new THREE.Vector3(0, stammHoehe * (0.7 + z() * 0.25), 0);
    const ende = new THREE.Vector3(
      Math.cos(w) * radien.x * (0.5 + z() * 0.2),
      kronenMitte.y + (z() - 0.35) * radien.y * 0.9,
      Math.sin(w) * radien.z * (0.5 + z() * 0.2)
    );
    holz.push(zweig(start, ende, hoch ? 0.1 : 0.13, 5));
    klumpen.push(ende);
    for (let j = 0; j < 2; j++) {
      const von = start.clone().lerp(ende, 0.45 + j * 0.3);
      const ww = w + (z() - 0.5) * 1.6;
      const ziel = new THREE.Vector3(
        Math.cos(ww) * radien.x * (0.75 + z() * 0.2),
        von.y + (z() - 0.2) * radien.y * 0.7,
        Math.sin(ww) * radien.z * (0.75 + z() * 0.2)
      );
      holz.push(zweig(von, ziel, 0.05, 4));
      klumpen.push(ziel);
    }
  }
  klumpen.push(kronenMitte.clone().add(new THREE.Vector3(0, radien.y * 0.6, 0)));

  const blaetter = [];
  const q = new THREE.Quaternion(), e = new THREE.Euler();
  const d = new THREE.Vector3();
  const anzahl = hoch ? 58 : 66;
  for (let k = 0; k < anzahl; k++) {
    // Karten sitzen in Klumpen um die Ast-Enden – so wird der Rand der Krone unregelmäßig
    const basis = k < anzahl - 10 ? klumpen[k % klumpen.length] : kronenMitte;
    const ort = new THREE.Vector3((z() - 0.5) * 2.0, (z() - 0.45) * 1.6, (z() - 0.5) * 2.0).add(basis);
    // nicht zu weit aus der Krone heraus
    d.copy(ort).sub(kronenMitte).divide(radien);
    const l = d.length();
    if (l > 1.05) ort.copy(kronenMitte).add(d.multiplyScalar(1.05 / l).multiply(radien));
    q.setFromEuler(e.set(z() * Math.PI, z() * Math.PI * 2, z() * Math.PI));
    const g = (hoch ? 1.25 : 1.4) + z() * 0.9;
    blaetter.push(atlasViertel(karte(g, g, ort, kronenMitte, q, false, radien)));
  }
  const krone = mergeGeometries(blaetter);
  // Fake-AO: unten und innen dunkler, oben und außen heller
  mitHelligkeit(krone, (x, y, zz) => {
    d.set(x, y, zz).sub(kronenMitte).divide(radien);
    const oben = THREE.MathUtils.clamp(d.y * 0.5 + 0.5, 0, 1);
    const aussen = THREE.MathUtils.clamp(d.length(), 0, 1);
    return Math.min(1.08, 0.38 + 0.42 * oben + 0.3 * aussen);
  });
  return { holz: holzFertig(holz, 3), blaetter: krone };
}

// ---------- Tanne: Stamm + Etagen aus Nadelzweig-Karten ----------
// art = 'voll' (dichte Fichte) oder 'schlank' (hohe, lockere Tanne)
function baueTannenForm(z, art) {
  const schlank = art === 'schlank';
  const H = schlank ? 9.2 : 7.5;
  const stamm = baueStamm(0.07, schlank ? 0.26 : 0.3, H, 7, 4, 0.02, z);
  const zweige = [];
  const kronenMitte = new THREE.Vector3(0, H * 0.48, 0);
  const q = new THREE.Quaternion(), e = new THREE.Euler();
  const etagen = schlank ? 12 : 15;
  const unten = schlank ? 2.4 : 1.0;
  const breite = schlank ? 1.75 : 2.8;
  for (let et = 0; et < etagen; et++) {
    const t = et / (etagen - 1);
    const y = unten + t * (H - 1.3 - unten) + (z() - 0.5) * 0.2;
    const laenge = breite * Math.pow(1 - t, 0.9) * (0.85 + z() * 0.3) + 0.45;
    const anzahl = Math.round((schlank ? 6 : 8) - t * 3);
    for (let k = 0; k < anzahl; k++) {
      const w = (k / anzahl) * Math.PI * 2 + et * 0.7 + z() * 0.5;
      // Zweig zeigt nach außen und hängt nach unten (unten mehr als oben)
      const haengen = -0.18 - z() * 0.2 - (1 - t) * 0.22 + (schlank ? 0.08 : 0);
      q.setFromEuler(e.set(z() * 0.8 - 0.4 + Math.PI / 2 * (z() < 0.5 ? 1 : 0), -w, haengen, 'YZX'));
      const ast = karte(laenge, laenge * 0.62, new THREE.Vector3(0, y, 0), kronenMitte, q, true);
      // Fake-AO: am Stamm dunkel, an der Zweigspitze hell, unten dunkler als oben
      mitHelligkeit(ast, (x, yy, zz) => {
        const r = Math.min(1, Math.hypot(x, zz) / laenge);
        return Math.min(1.1, (0.35 + 0.7 * r) * (0.78 + 0.3 * t));
      });
      zweige.push(ast);
    }
  }
  // Spitze: zwei gekreuzte Karten nach oben
  for (const w of [0, Math.PI / 2]) {
    q.setFromEuler(e.set(0, w, Math.PI / 2));
    zweige.push(mitHelligkeit(karte(1.4, 0.7, new THREE.Vector3(0, H - 1.0, 0), kronenMitte, q, true), () => 1.05));
  }
  return { holz: holzFertig([stamm], schlank ? 6 : 5), blaetter: mergeGeometries(zweige) };
}

// Darf hier etwas wachsen? (nicht am Zelt, nicht im Dorf, nicht auf dem Pfad)
function istFrei(x, z, abstand = 3) {
  if (Math.hypot(x, z) < 16) return false;
  if (abstandZumDorf(x, z) < DORF.radius + 4) return false;
  if (abstandZumPfad(x, z) < abstand) return false;
  return true;
}

function zufallsPunkt(z = zufall) {
  return [(z() - 0.5) * 2 * R, (z() - 0.5) * 2 * R];
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

// ---------- Für die Geräusche ----------
// Steht man in einem Busch? 0 = nein, 1 = mittendrin (dann raschelt es laut)
export function buschInDerNaehe(x, z) {
  const kx = Math.floor(x / 10), kz = Math.floor(z / 10);
  let staerke = 0;
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      for (const h of holzGitter.get(`${kx + dx},${kz + dz}`) || []) {
        if (h.weg || h.art !== 'busch') continue;
        // Wie breit ist der Busch? (steht in seiner Matrix, einmal ausrechnen reicht)
        if (h.radius === undefined) h.radius = Math.hypot(h.matrix.elements[0], h.matrix.elements[1], h.matrix.elements[2]) + 0.3;
        const d = Math.hypot(h.x - x, h.z - z);
        if (d < h.radius) staerke = Math.max(staerke, 1 - d / h.radius);
      }
    }
  }
  return Math.min(1, staerke * 1.5);
}

// Wie viel Gras und Farn wächst hier? 0 = nichts, 1 = dichte Wiese
export function grasDichte(x, z) {
  const boden = gitterWerte(x, z);
  if (boden.hoehe < 1.6 || boden.hoehe > 20) return 0;
  return Math.min(1, boden.wiese + boden.wald * 0.35) * (1 - boden.pfad);
}

// Wie nah ist Wasser? Wir schauen in 8 Richtungen nach (0 = weit weg, 1 = überall Wasser)
export function wasserInDerNaehe(x, z, weite = 14) {
  let nass = 0;
  for (let k = 0; k < 8; k++) {
    const w = (k / 8) * Math.PI * 2;
    if (bodenHoehe(x + Math.sin(w) * weite, z + Math.cos(w) * weite) < WASSER_HOEHE) nass++;
    if (bodenHoehe(x + Math.sin(w) * weite * 0.4, z + Math.cos(w) * weite * 0.4) < WASSER_HOEHE) nass++;
  }
  return Math.min(1, nass / 6);
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
const alleStuecke = []; // { mesh, mitte, sichtweite, groesse }

// Verteilt viele Kopien (eintraege: { matrix, farbe, x, z }) auf Stücke
function inStuecken(geo, material, eintraege, { sichtweite = 190, schatten = true, stueck = STUECK } = {}) {
  const gruppe = new THREE.Group();
  const sortiert = new Map();
  for (const e of eintraege) {
    const k = `${Math.floor(e.x / stueck)},${Math.floor(e.z / stueck)}`;
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
    alleStuecke.push({ mesh, mitte: new THREE.Vector2((kx + 0.5) * stueck, (kz + 0.5) * stueck), sichtweite, groesse: stueck });
    gruppe.add(mesh);
  }
  return gruppe;
}

const m4 = () => new THREE.Matrix4();
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const hochAchse = v3(0, 1, 0);

function blattMaterial(bild, wind, ab, name, flattern = 0) {
  return wenigGlanz(beideSeitenHell(mitWind(new THREE.MeshStandardMaterial({
    map: textur(bild, { wiederholen: false }),
    alphaTest: 0.45,
    side: THREE.DoubleSide,
    roughness: 0.75,
    vertexColors: true,
  }), wind, ab, name, flattern)));
}

function holzMaterial(bild) {
  return new THREE.MeshStandardMaterial({
    map: textur(bild),
    normalMap: textur('rinde_normal.jpg', { farbe: false }),
    normalScale: new THREE.Vector2(1.4, 1.4),
    roughness: 0.95,
    vertexColors: true,
  });
}

function baueBaeume(gruppe, hindernisse) {
  const laub = [], tannen = [];
  // WICHTIG: Die Reihenfolge der Zufallszahlen hier nicht ändern –
  // sonst stehen die Bäume woanders und alte Spielstände passen nicht mehr.
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
  const laubFarben = laub.map((b) => ({ ...b, besitzer: b, farbe: new THREE.Color().setHSL(0.2 + zufall() * 0.09, 0.3 + zufall() * 0.2, 0.8 + zufall() * 0.16) }));
  const tannenFarben = tannen.map((b) => ({ ...b, besitzer: b, farbe: new THREE.Color().setHSL(0.3 + zufall() * 0.05, 0.25, 0.72 + zufall() * 0.15) }));

  // Zwei Formen pro Baumart. Welche Form ein Baum bekommt, hängt nur von seinem Ort ab.
  const laubFormen = [baueLaubbaumForm(zufallMitSeed(5), 'breit'), baueLaubbaumForm(zufallMitSeed(17), 'hoch')];
  const tannenFormen = [baueTannenForm(zufallMitSeed(9), 'voll'), baueTannenForm(zufallMitSeed(31), 'schlank')];
  const laubHolz = holzMaterial('rinde.jpg');
  const tannenHolz = holzMaterial('rinde_tanne.jpg');
  // Laub-Atlas: Buche, längliche Blätter, Ahorn (etwas herbstlich), dichtes Buschlaub
  const laubBlatt = atlasWahl(blattMaterial('laub.png', 0.03, 2.5, 'laub', 0.025), [45, 34, 13, 8]);
  const nadelBlatt = blattMaterial('nadeln.png', 0.022, 1.5, 'tanne', 0.012);
  const groesser = { stueck: 110 }; // größere Stücke = weniger Malbefehle

  const nachForm = (liste, farben, welche) => [0, 1].map((f) => ({
    holz: liste.filter((b) => welche(b) === f),
    blatt: farben.filter((b) => welche(b) === f),
  }));
  // Laubbäume: meist breit, ab und zu hoch und schmal
  const laubTeile = nachForm(laub, laubFarben, (b) => (ortZufall(b.x, b.z, 1) < 0.62 ? 0 : 1));
  // Tannen: oben am Berg eher schlank
  const tannenTeile = nachForm(tannen, tannenFarben, (b) => (ortZufall(b.x, b.z, 2) < (bodenHoehe(b.x, b.z) > 13 ? 0.35 : 0.6) ? 0 : 1));
  laubTeile.forEach((t, f) => {
    gruppe.add(inStuecken(laubFormen[f].holz, laubHolz, t.holz, groesser));
    gruppe.add(inStuecken(laubFormen[f].blaetter, laubBlatt, t.blatt, groesser));
  });
  tannenTeile.forEach((t, f) => {
    gruppe.add(inStuecken(tannenFormen[f].holz, tannenHolz, t.holz, groesser));
    gruppe.add(inStuecken(tannenFormen[f].blaetter, nadelBlatt, t.blatt, groesser));
  });
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

let felsMat = null;
function baueFelsen(gruppe, hindernisse) {
  const material = (felsMat = felsMaterial());
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

// Büsche: kleine, dichte Blätter-Wolken direkt am Boden
function baueBuesche(gruppe) {
  const z = zufallMitSeed(77);
  const mitte = v3(0, 0.55, 0);
  const radien = v3(1, 0.75, 1);
  const karten = [];
  const q = new THREE.Quaternion(), e = new THREE.Euler();
  for (let k = 0; k < 17; k++) {
    const w = z() * Math.PI * 2, r = Math.sqrt(z()) * 0.75;
    const ort = v3(Math.cos(w) * r, 0.25 + z() * 0.75 * (1 - r * 0.5), Math.sin(w) * r);
    q.setFromEuler(e.set(z() * Math.PI, z() * Math.PI * 2, z() * Math.PI));
    karten.push(atlasViertel(karte(0.95 + z() * 0.3, 0.95 + z() * 0.3, ort, mitte, q, false, radien)));
  }
  const form = mitHelligkeit(mergeGeometries(karten), (x, y) => 0.42 + 0.62 * THREE.MathUtils.smoothstep(y, -0.1, 1.0));
  const liste = [];
  // WICHTIG: Reihenfolge der Zufallszahlen bleibt gleich (Spielstände!)
  for (let versuch = 0; versuch < 9000 && liste.length < 900; versuch++) {
    const [x, zz] = zufallsPunkt();
    const h = bodenHoehe(x, zz);
    if (h < 1.8 || h > 18 || !istFrei(x, zz)) continue;
    const s = 0.6 + zufall() * 0.8;
    const busch = {
      x, z: zz, ziele: [], art: 'busch', schlaege: 0, weg: false,
      matrix: m4().compose(v3(x, h - 0.12, zz), new THREE.Quaternion().setFromAxisAngle(hochAchse, zufall() * 6.3), v3(s * 1.2, s, s * 1.2)),
      farbe: new THREE.Color().setHSL(0.21 + zufall() * 0.08, 0.32, 0.7 + zufall() * 0.15),
    };
    liste.push(busch);
    holzStellen.push(busch);
  }
  // Büsche nehmen meistens das dichte Buschlaub, manchmal Buche oder längliche Blätter
  const material = atlasWahl(blattMaterial('laub.png', 0.04, 0.2, 'busch', 0.02), [20, 20, 0, 60]);
  gruppe.add(inStuecken(form, material, liste, { sichtweite: 130 }));
}

// Farne: ein Kranz aus gebogenen Wedeln, nur im Wald
function baueFarne(gruppe) {
  const z = zufallMitSeed(303);
  const wedel = [];
  const anzahl = 5;
  for (let k = 0; k < anzahl; k++) {
    const w = (k / anzahl) * Math.PI * 2 + z() * 0.5;
    const laenge = 1.0 + z() * 0.35;
    const geo = new THREE.PlaneGeometry(0.46, laenge, 1, 2);
    geo.translate(0, laenge / 2, 0);
    const p = geo.attributes.position;
    const neigung = 0.55 + z() * 0.35; // wie schräg der Wedel startet
    for (let i = 0; i < p.count; i++) {
      const t = p.getY(i) / laenge;
      // Der Wedel wächst schräg nach oben und biegt sich dann nach unten
      const winkel = neigung + t * t * 1.3;
      const s = p.getY(i);
      const vor = Math.sin(winkel) * s * 0.8;
      const hoch = Math.cos(winkel) * s * 0.75 + 0.02;
      p.setXYZ(i, p.getX(i) * (1 - t * 0.2), hoch, vor);
    }
    geo.rotateY(w);
    const n = geo.attributes.normal;
    for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0);
    wedel.push(geo);
  }
  // in der Mitte dunkel, außen hell
  const form = mitHelligkeit(mergeGeometries(wedel), (x, y, zz) => 0.45 + 0.65 * Math.min(1, Math.hypot(x, zz) / 0.9));
  const material = inDerFerneWeniger(beideSeitenHell(mitWind(new THREE.MeshLambertMaterial({
    map: textur('farn.png', { wiederholen: false }),
    alphaTest: 0.5,
    side: THREE.DoubleSide,
    vertexColors: true,
    color: new THREE.Color(1.15, 1.2, 1.0),
  }), 0.06, 0, 'farn', 0.015)), 34, 55, 0.5);
  const liste = [];
  const zz = zufallMitSeed(404);
  for (let versuch = 0; versuch < 30000 && liste.length < 3000; versuch++) {
    const [x, y] = zufallsPunkt(zz);
    const boden = gitterWerte(x, y);
    if (boden.hoehe < 2 || boden.hoehe > 16 || boden.wald < 0.45 || !istFrei(x, y, 2.5)) continue;
    const s = 0.6 + zz() * 0.7;
    liste.push({
      x, z: y,
      matrix: m4().compose(v3(x, boden.hoehe - 0.05, y), new THREE.Quaternion().setFromAxisAngle(hochAchse, zz() * 6.3), v3(s, s * (0.8 + zz() * 0.4), s)),
      farbe: new THREE.Color().setHSL(0.24 + zz() * 0.06, 0.4, 0.7 + zz() * 0.2),
    });
  }
  gruppe.add(inStuecken(form, material, liste, { sichtweite: 30, schatten: false }));
}

// Kleine Steinchen im Gras und am Wegrand
function baueSteinchen(gruppe) {
  let geo = new THREE.IcosahedronGeometry(1, 0);
  geo.deleteAttribute('uv');
  geo.deleteAttribute('normal');
  geo = mergeVertices(geo);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    p.setY(i, y < 0 ? y * 0.3 : y * 0.7);
  }
  geo.computeVertexNormals();
  const z = zufallMitSeed(505);
  const liste = [];
  for (let versuch = 0; versuch < 40000 && liste.length < 2500; versuch++) {
    const [x, y] = zufallsPunkt(z);
    const boden = gitterWerte(x, y);
    if (boden.hoehe < 1.2 || boden.hoehe > 22 || !istFrei(x, y, 0)) continue;
    const amWeg = abstandZumPfad(x, y);
    if (!(amWeg > 1.2 && amWeg < 4) && z() > 0.25) continue; // vor allem am Wegrand
    const s = 0.06 + z() * z() * 0.22;
    liste.push({
      x, z: y,
      matrix: m4().compose(v3(x, boden.hoehe - s * 0.15, y), new THREE.Quaternion().setFromEuler(new THREE.Euler(z(), z() * 6.3, z())), v3(s * (1 + z()), s, s * (1 + z() * 0.6))),
      farbe: new THREE.Color().setScalar(0.75 + z() * 0.35),
    });
  }
  gruppe.add(inStuecken(geo, felsMat, liste, { sichtweite: 25, schatten: false }));
}

// Blumen: Stiel, zwei Blättchen und eine flache Blüte mit Blütenblättern
function baueBlumen(gruppe) {
  const teile = [];
  // teil: 0 = grün, 1 = Blütenblätter (Blumenfarbe), 2 = Blütenmitte (gelb)
  const markiere = (g, teil) => {
    const a = new Float32Array(g.attributes.position.count).fill(teil);
    g.setAttribute('teil', new THREE.BufferAttribute(a, 1));
    return g;
  };
  const stiel = new THREE.CylinderGeometry(0.01, 0.014, 0.36, 3, 1, true);
  stiel.translate(0, 0.18, 0);
  teile.push(markiere(stiel, 0));
  for (const w of [0.4, 3.0]) {
    const blatt = new THREE.PlaneGeometry(0.05, 0.12);
    blatt.translate(0, 0.06, 0);
    blatt.rotateX(-0.9);
    blatt.rotateY(w);
    blatt.translate(0, 0.08 + w * 0.02, 0);
    teile.push(markiere(blatt, 0));
  }
  // Blüte: ein Kreis, dessen Rand zu 5 Blütenblättern geformt wird
  const bluete = new THREE.CircleGeometry(0.1, 20);
  const bp = bluete.attributes.position;
  for (let i = 1; i < bp.count; i++) {
    const w = Math.atan2(bp.getY(i), bp.getX(i));
    const r = 0.1 * (0.45 + 0.55 * Math.pow(Math.abs(Math.cos(w * 2.5)), 0.6));
    bp.setXYZ(i, Math.cos(w) * r, Math.sin(w) * r, 0.015); // Blätter leicht nach oben gewölbt
  }
  bluete.rotateX(-Math.PI / 2 + 0.25);
  bluete.translate(0, 0.37, 0);
  const mitte = new THREE.CircleGeometry(0.028, 6);
  mitte.rotateX(-Math.PI / 2 + 0.25);
  mitte.translate(0, 0.381, 0.002);
  teile.push(markiere(bluete, 1), markiere(mitte, 2));
  teile.forEach((g) => g.deleteAttribute('uv'));
  const geo = mergeGeometries(teile);

  const material = inDerFerneWeniger(mitWind(new THREE.MeshStandardMaterial({ roughness: 0.8, side: THREE.DoubleSide }), 0.25, 0, 'blume'), 40, 70, 0.5);
  const vorher = material.onBeforeCompile;
  material.onBeforeCompile = (shader, r) => {
    vorher(shader, r);
    shader.vertexShader = 'attribute float teil;\n' + shader.vertexShader.replace(
      '#include <color_vertex>',
      `#include <color_vertex>
      #ifdef USE_INSTANCING_COLOR
        if (teil < 0.5) vColor.xyz = vec3(0.14, 0.38, 0.1);
        else if (teil > 1.5) vColor.xyz = vec3(1.0, 0.75, 0.15);
      #endif`
    );
  };
  material.customProgramCacheKey = () => 'blume2';

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
      const q = new THREE.Quaternion().setFromAxisAngle(hochAchse, (x * 7.3 + z * 3.1) % 6.28);
      liste.push({ x, z, matrix: m4().compose(v3(x, h, z), q, v3(s, s, s)), farbe });
    }
  }
  gruppe.add(inStuecken(geo, material, liste, { sichtweite: 90, schatten: false }));
}

// Gras: Büschel aus zwei gekreuzten Bild-Karten mit echten Grashalmen
function baueGras(gruppe) {
  const teile = [];
  for (const w of [0, Math.PI / 2]) {
    const k = new THREE.PlaneGeometry(0.8, 0.42);
    k.translate(0, 0.19, 0); // Fuß steckt ein bisschen im Boden
    k.rotateY(w);
    const n = k.attributes.normal;
    for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0); // wie der Boden beleuchtet
    teile.push(k);
  }
  const geo = mergeGeometries(teile);
  const material = inDerFerneWeniger(beideSeitenHell(mitWind(new THREE.MeshLambertMaterial({
    map: textur('grasbueschel.png', { wiederholen: false }),
    alphaTest: 0.5,
    side: THREE.DoubleSide,
    color: new THREE.Color(1.3, 1.35, 1.1), // etwas heller, passend zum Boden
  }), 0.22, 0, 'gras')), 48, 78, 0.4);
  // Fuß dunkler (Schatten zwischen den Halmen), Spitzen heller
  const vorher = material.onBeforeCompile;
  material.onBeforeCompile = (shader, r) => {
    vorher(shader, r);
    shader.vertexShader = shader.vertexShader.replace(
      '#include <color_vertex>',
      `#include <color_vertex>
      #ifdef USE_INSTANCING_COLOR
        vColor.xyz *= mix(0.62, 1.12, smoothstep(-0.02, 0.38, position.y));
      #endif`
    );
  };
  material.customProgramCacheKey = () => 'gras2';
  const liste = [];
  for (let k = 0; k < 400000 && liste.length < 138000; k++) {
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
      farbe: new THREE.Color().setHSL(0.17 + zufall() * 0.08, 0.3 + zufall() * 0.2, 0.74 + zufall() * 0.2),
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
  // Diese beiden haben ihren eigenen Zufall (stören die anderen nicht)
  baueFarne(gruppe);
  baueSteinchen(gruppe);
  holzGitterBauen();
  szene.add(gruppe);
}

// Wie weit man Pflanzen sieht (1 = normal). Ruckelt das iPad, wird es kleiner.
let detail = 1;
export function wenigerDetails() {
  if (detail <= 0.55) return false;
  detail -= 0.15;
  detailWert.value = detail;
  return true;
}

// Jedes Bild: Wind weiterlaufen lassen, nur nahe Stücke zeigen
export function aktualisiereNatur(dt, spielerPos) {
  windZeit.value += dt;
  for (const s of alleStuecke) {
    s.mesh.visible = Math.hypot(s.mitte.x - spielerPos.x, s.mitte.y - spielerPos.z) < s.sichtweite * detail + s.groesse * 0.7;
  }
}
