// =============================================================
//  DAS WASSER – echte Wellen, die sich heben und senken,
//  dazu Glitzern, Tiefenfarbe und Schaum am Strand
// =============================================================
import * as THREE from 'three';
import { rauschen } from './rauschen.js';
import { WASSER_HOEHE, bodenHoehe, WELT } from './gelaende.js';

// ---------- Zahlen zum Rumprobieren ----------
// Die großen Wellen. Jede Welle hat:
//   laenge = wie weit es von einem Wellenberg zum nächsten ist (Meter)
//   hoehe  = wie hoch der Berg über dem ruhigen Wasser ist (Meter)
//   richtung = wohin sie läuft (Grad, 0 = nach Osten)
// Zusammen werden sie draußen auf dem Meer ca. 0,5 m hoch.
const WELLEN = [
  { laenge: 34, hoehe: 0.24, richtung: 20 },
  { laenge: 21, hoehe: 0.16, richtung: -30 },
  { laenge: 13, hoehe: 0.1, richtung: 70 },
  { laenge: 8.5, hoehe: 0.055, richtung: 145 },
];
// Wie spitz sind die Wellenberge? (0 = runde Hügel, 1 = ganz spitz)
const WELLEN_SPITZE = 0.55;
// Wie schnell laufen die Wellen? (1 = wie echte Meereswellen)
const WELLEN_TEMPO = 0.75;
// Ab welcher Wassertiefe sind die Wellen ganz groß? (Meter)
// Am Strand werden sie immer flacher, damit sie nicht durch den Sand schneiden.
const VOLLE_WELLEN_TIEFE = 5;
// Abstand der Gitterpunkte im Wellen-Netz (Meter). Kleiner = schöner, aber mehr Arbeit
const GITTER_SCHRITT = 1.25;
// So weit um die Kamera herum gibt es Wellen (Meter). Weiter weg ist eh Nebel.
const WELLEN_WEITE = 155;

// Für die Physik: aus der Wellenlänge die Wellenzahl k und die Geschwindigkeit w
// ausrechnen. (Lange Wellen laufen schneller als kurze, wie in echt!)
const WELLEN_DATEN = WELLEN.map((w) => {
  const k = (Math.PI * 2) / w.laenge;
  const winkel = THREE.MathUtils.degToRad(w.richtung);
  return {
    dx: Math.cos(winkel),
    dz: Math.sin(winkel),
    k,
    a: w.hoehe,
    om: Math.sqrt(9.81 * k) * WELLEN_TEMPO,
    q: WELLEN_SPITZE / (k * w.hoehe * WELLEN.length),
    phase: rauschen(w.laenge, w.richtung, 3) * 6.28,
  };
});

// Gemeinsame Uhr fürs Wasser (Shader und Boote lesen dieselbe Zeit)
const ZEIT = { value: 0 };
export function wasserZeit() {
  return ZEIT.value;
}
// Wo steht die Kamera? (Weit weg werden die Wellen ausgeblendet)
const KAMERA = new THREE.Vector3(0, 0, 0);
let kameraBekannt = false;

// Eine Wellen-Textur aus Rauschen bauen ("Normal Map": sagt dem Licht,
// wie schräg die Oberfläche an jeder Stelle ist) – das sind die kleinen Kräusel
function baueWellenTextur() {
  const n = 128;
  const daten = new Uint8Array(n * n * 4);
  // Viele kleine Wellen übereinander. Ganze Zahlen als Frequenz sorgen
  // dafür, dass die Textur nahtlos aneinanderpasst.
  const wellen = [];
  for (let k = 0; k < 14; k++) {
    const fx = Math.round((rauschen(k, 1, 4) - 0.5) * 16);
    const fy = Math.round((rauschen(k, 2, 4) - 0.5) * 16);
    wellen.push([fx, fy, rauschen(k, 3, 4) * 6.28, 1 / (1 + Math.hypot(fx, fy))]);
  }
  const h = (x, y) => {
    let s = 0;
    for (const [fx, fy, phase, a] of wellen) s += Math.sin(((fx * x + fy * y) / n) * Math.PI * 2 + phase) * a;
    return s;
  };
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const dx = (h(x + 1, y) - h(x - 1, y)) * 3;
      const dy = (h(x, y + 1) - h(x, y - 1)) * 3;
      const v = new THREE.Vector3(-dx, -dy, 1).normalize();
      const i = (y * n + x) * 4;
      daten[i] = (v.x * 0.5 + 0.5) * 255;
      daten[i + 1] = (v.y * 0.5 + 0.5) * 255;
      daten[i + 2] = (v.z * 0.5 + 0.5) * 255;
      daten[i + 3] = 255;
    }
  }
  const textur = new THREE.DataTexture(daten, n, n, THREE.RGBAFormat);
  textur.wrapS = textur.wrapT = THREE.RepeatWrapping;
  textur.repeat.set(220, 220);
  textur.magFilter = THREE.LinearFilter;
  textur.minFilter = THREE.LinearMipmapLinearFilter;
  textur.generateMipmaps = true;
  textur.anisotropy = 4;
  textur.needsUpdate = true;
  return textur;
}

// Wie tief ist das Wasser überall? Das wird einmal als Bild gespeichert,
// damit das Wasser am Strand hell und flach, draußen dunkel und tief aussieht.
// Die Wellen schauen auch hier nach: am Strand werden sie flach.
// Das Bild deckt alle Inseln ab. Ein Bildpunkt = ca. 2,4 m (wie früher bei nur einer Insel).
const KARTEN_GROESSE = WELT.halb * 2;
const KARTEN_MITTE = new THREE.Vector2(WELT.mitteX, WELT.mitteZ);
const KARTEN_PUNKTE = Math.min(1024, Math.ceil(KARTEN_GROESSE / 2.4));
let tiefenDaten = null;
function tiefenDatenHolen() {
  if (tiefenDaten) return tiefenDaten;
  const n = KARTEN_PUNKTE;
  tiefenDaten = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const wx = ((x + 0.5) / n - 0.5) * KARTEN_GROESSE + KARTEN_MITTE.x;
      const wz = ((y + 0.5) / n - 0.5) * KARTEN_GROESSE + KARTEN_MITTE.y;
      const tiefe = THREE.MathUtils.clamp((WASSER_HOEHE - bodenHoehe(wx, wz)) / 6, 0, 1);
      const i = (y * n + x) * 4;
      tiefenDaten[i] = tiefenDaten[i + 1] = tiefenDaten[i + 2] = Math.round(tiefe * 255);
      tiefenDaten[i + 3] = 255;
    }
  }
  return tiefenDaten;
}
function baueTiefenKarte() {
  const textur = new THREE.DataTexture(tiefenDatenHolen(), KARTEN_PUNKTE, KARTEN_PUNKTE, THREE.RGBAFormat);
  textur.magFilter = textur.minFilter = THREE.LinearFilter;
  textur.needsUpdate = true;
  return textur;
}

// Tiefe an (x, z) genau so nachschauen, wie es die Grafikkarte macht
// (zwischen den 4 nächsten Bildpunkten weich mischen)
function tiefeBei(x, z) {
  const d = tiefenDatenHolen();
  const n = KARTEN_PUNKTE;
  const gx = THREE.MathUtils.clamp(((x - KARTEN_MITTE.x) / KARTEN_GROESSE + 0.5) * n - 0.5, 0, n - 1);
  const gz = THREE.MathUtils.clamp(((z - KARTEN_MITTE.y) / KARTEN_GROESSE + 0.5) * n - 0.5, 0, n - 1);
  const ix = Math.min(n - 2, Math.floor(gx)), iz = Math.min(n - 2, Math.floor(gz));
  const fx = gx - ix, fz = gz - iz;
  const w = (a, b) => d[((iz + b) * n + ix + a) * 4] / 255;
  const v = (w(0, 0) * (1 - fx) + w(1, 0) * fx) * (1 - fz) + (w(0, 1) * (1 - fx) + w(1, 1) * fx) * fz;
  return v * 6;
}

const glatt = (a, b, x) => {
  const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// Wie groß dürfen die Wellen hier sein? (0 = gar keine, 1 = volle Höhe)
function wellenStaerke(x, z) {
  const t = THREE.MathUtils.clamp((tiefeBei(x, z) - 0.1) / (VOLLE_WELLEN_TIEFE - 0.1), 0, 1);
  let s = t * (2 - t); // erst schnell größer, dann sanft bis zur vollen Höhe
  if (kameraBekannt) s *= 1 - glatt(WELLEN_WEITE - 45, WELLEN_WEITE - 3, Math.hypot(x - KAMERA.x, z - KAMERA.z));
  return s;
}

// Wie hoch ist das Wasser an der Stelle (x, z) zur Zeit "zeit"?
// (Gleiche Rechnung wie in der Grafikkarte. Ergebnis: Höhe über WASSER_HOEHE)
// Die Wellen schieben das Wasser auch ein bisschen hin und her ("Gerstner-Wellen").
// Darum suchen wir erst, welcher Wasserpunkt gerade bei (x, z) angekommen ist.
export function wellenHoehe(x, z, zeit = ZEIT.value) {
  let px = x, pz = z;
  let staerke = 0;
  for (let schritt = 0; schritt < 4; schritt++) {
    staerke = wellenStaerke(px, pz);
    let sx = 0, sz = 0;
    for (const w of WELLEN_DATEN) {
      const c = Math.cos(w.k * (w.dx * px + w.dz * pz) - w.om * zeit + w.phase);
      sx += w.q * w.a * w.dx * c;
      sz += w.q * w.a * w.dz * c;
    }
    px = x - sx * staerke;
    pz = z - sz * staerke;
  }
  staerke = wellenStaerke(px, pz);
  let h = 0;
  for (const w of WELLEN_DATEN) h += w.a * Math.sin(w.k * (w.dx * px + w.dz * pz) - w.om * zeit + w.phase);
  return h * staerke;
}

// Die Wellen als Shader-Code (für die Grafikkarte). Die Zahlen kommen
// aus der Liste oben, damit JavaScript und Shader genau gleich rechnen.
const f = (v) => v.toFixed(6);
const WELLEN_GLSL = WELLEN_DATEN.map(
  (w) => `welle(p0, vec2(${f(w.dx)}, ${f(w.dz)}), ${f(w.k)}, ${f(w.a)}, ${f(w.om)}, ${f(w.q)}, ${f(w.phase)}, staerke, versatz, nx, nz, ny);`
).join('\n          ');

// Das Wellen-Netz: in der Mitte fein (da sieht man die Wellen),
// außen ganz grob (da ist das Wasser flach und im Nebel)
function baueWellenNetz() {
  const achse = [];
  const aussen = [1000, 700, 500, 350, 260, 200];
  for (const a of aussen) achse.push(-a);
  const innen = 160;
  for (let v = -innen; v <= innen + 0.001; v += GITTER_SCHRITT) achse.push(v);
  for (const a of [...aussen].reverse()) achse.push(a);
  const n = achse.length;
  const pos = new Float32Array(n * n * 3);
  const nor = new Float32Array(n * n * 3);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const k = (j * n + i) * 3;
      pos[k] = achse[i];
      pos[k + 2] = achse[j];
      nor[k + 1] = 1;
    }
  }
  const index = new Uint32Array((n - 1) * (n - 1) * 6);
  let m = 0;
  for (let j = 0; j < n - 1; j++) {
    for (let i = 0; i < n - 1; i++) {
      const a = j * n + i, b = a + 1, c = a + n, d = c + 1;
      index.set([a, c, b, b, c, d], m);
      m += 6;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setIndex(new THREE.BufferAttribute(index, 1));
  return geo;
}

export class Wasser {
  constructor(szene) {
    this.wellen = baueWellenTextur();
    this.zeit = ZEIT;
    this.kamera = { value: KAMERA };
    const tiefenKarte = baueTiefenKarte();
    const material = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      roughness: 0.08,
      metalness: 0.1,
      transparent: true,
      normalMap: this.wellen,
      normalScale: new THREE.Vector2(0.2, 0.2),
    });
    material.onBeforeCompile = (shader) => {
      shader.uniforms.tTiefe = { value: tiefenKarte };
      shader.uniforms.uZeit = this.zeit;
      shader.uniforms.uGroesse = { value: KARTEN_GROESSE };
      shader.uniforms.uMitte = { value: KARTEN_MITTE };
      shader.uniforms.uKamera = this.kamera;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>
        uniform sampler2D tTiefe;
        uniform float uZeit;
        uniform float uGroesse;
        uniform vec2 uMitte;
        uniform vec3 uKamera;
        varying vec3 vWP;
        varying float vWelle;
        // Eine Gerstner-Welle: hebt das Wasser und schiebt es ein bisschen vor und zurück
        void welle(vec2 p, vec2 d, float k, float a, float om, float q, float ph, float s,
                   inout vec3 versatz, inout float nx, inout float nz, inout float ny) {
          float th = k * dot(d, p) - om * uZeit + ph;
          float sn = sin(th), cs = cos(th);
          a *= s;
          versatz += vec3(q * a * d.x * cs, a * sn, q * a * d.y * cs);
          nx -= d.x * k * a * cs;
          nz -= d.y * k * a * cs;
          ny -= q * k * a * sn;
        }`)
        .replace('#include <beginnormal_vertex>', `
          // Wo liegt dieser Punkt in der Welt?
          vec2 p0 = (modelMatrix * vec4(position, 1.0)).xz;
          // Am Strand flache Wellen, draußen große. Weit weg von der Kamera keine.
          float tiefeHier = texture2D(tTiefe, (p0 - uMitte) / uGroesse + 0.5).r * 6.0;
          float tw = clamp((tiefeHier - 0.1) / ${f(VOLLE_WELLEN_TIEFE - 0.1)}, 0.0, 1.0);
          float staerke = tw * (2.0 - tw);
          staerke *= 1.0 - smoothstep(${f(WELLEN_WEITE - 45)}, ${f(WELLEN_WEITE - 3)}, distance(p0, uKamera.xz));
          vec3 versatz = vec3(0.0);
          float nx = 0.0, nz = 0.0, ny = 1.0;
          ${WELLEN_GLSL}
          vec3 objectNormal = normalize(vec3(nx, ny, nz));
          vWelle = versatz.y;
          #ifdef USE_NORMALMAP
            // Die kleinen Glitzer-Kräusel kleben an der Welt, nicht am Netz
            vNormalMapUv = (normalMapTransform * vec3(p0.x / 1800.0 + 0.5, 0.5 - p0.y / 1800.0, 1.0)).xy;
          #endif`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          transformed += versatz;
          vWP = (modelMatrix * vec4(transformed, 1.0)).xyz;`);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform sampler2D tTiefe;\nuniform float uZeit;\nuniform float uGroesse;\nuniform vec2 uMitte;\nvarying vec3 vWP;\nvarying float vWelle;')
        .replace('#include <color_fragment>', `#include <color_fragment>
          float tiefe = texture2D(tTiefe, (vWP.xz - uMitte) / uGroesse + 0.5).r * 6.0;
          // Flaches Wasser türkis, tiefes Wasser dunkelblau
          vec3 flach = vec3(0.16, 0.62, 0.62);
          vec3 tief = vec3(0.01, 0.12, 0.24);
          diffuseColor.rgb = mix(flach, tief, smoothstep(0.0, 4.5, tiefe));
          // Wellenberge sind etwas heller (die Sonne scheint durchs Wasser), Täler dunkler
          float berg = clamp(vWelle / 0.5, -1.0, 1.0);
          diffuseColor.rgb *= 1.0 + 0.3 * berg;
          diffuseColor.rgb += vec3(0.02, 0.09, 0.08) * max(berg, 0.0);
          // Schaum, wo die Wellen auf den Strand laufen
          float welle = 0.3 + 0.18 * sin(uZeit * 1.4 - tiefe * 9.0 + vWP.x * 0.05);
          float schaum = 1.0 - smoothstep(0.0, welle, tiefe);
          float kraeusel = texture2D(normalMap, vWP.xz * 0.08 + uZeit * 0.01).r;
          schaum *= 0.55 + 0.45 * kraeusel;
          // Ein bisschen weiße Gischt oben auf den höchsten Wellenbergen
          schaum = max(schaum, smoothstep(0.4, 0.62, vWelle) * smoothstep(0.55, 0.75, kraeusel) * 0.5);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.92, 0.96, 0.98), schaum * 0.85);
          diffuseColor.a = max(mix(0.45, 0.94, smoothstep(0.0, 3.0, tiefe)), schaum);`);
    };
    material.customProgramCacheKey = () => 'wasser-wellen';

    this.flaeche = new THREE.Mesh(baueWellenNetz(), material);
    this.flaeche.position.y = WASSER_HOEHE;
    this.flaeche.receiveShadow = true;
    // Das Netz wandert mit der Kamera mit. Es rastet aber immer auf ganze
    // Gitter-Schritte ein – so bleiben die Punkte an denselben Stellen der Welt
    // und die Wellen "schwimmen" nicht.
    this.flaeche.frustumCulled = false;
    this.flaeche.onBeforeRender = (renderer, szene, kamera) => {
      if (!kamera.isPerspectiveCamera) return;
      const p = new THREE.Vector3().setFromMatrixPosition(kamera.matrixWorld);
      KAMERA.copy(p);
      kameraBekannt = true;
      const gx = Math.round(p.x / GITTER_SCHRITT) * GITTER_SCHRITT;
      const gz = Math.round(p.z / GITTER_SCHRITT) * GITTER_SCHRITT;
      if (gx !== this.flaeche.position.x || gz !== this.flaeche.position.z) {
        this.flaeche.position.x = gx;
        this.flaeche.position.z = gz;
        this.flaeche.updateMatrixWorld();
      }
    };
    szene.add(this.flaeche);
  }

  aktualisiere(dt) {
    this.zeit.value += dt;
    this.wellen.offset.x += dt * 0.004;
    this.wellen.offset.y += dt * 0.0025;
  }
}
