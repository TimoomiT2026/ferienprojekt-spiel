// =============================================================
//  DIE STADT BAUEN 🏙️ – Düsseldorf am Rheinturm (für den Prolog)
//  Hier entsteht alles, was man in Düsseldorf sieht:
//   · der Boden: Rasen, Pflaster, Asphalt und Steine am Rheinufer
//   · die Häuser mit Fenstern, der Landtag (ganz rund!) und der Rheinturm
//   · die Rheinkniebrücke mit Autos, Laternen und Bänke an der Promenade
//   · der Yachthafen mit Booten – und große Schiffe, die auf dem Rhein fahren
//  Die Bäume und das Gras sind dieselben wie auf der Insel (natur.js).
//  Kartendaten: © OpenStreetMap-Mitwirkende (siehe daten/duesseldorf.js)
// =============================================================
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { DUESSELDORF } from './daten/duesseldorf.js';
import { textur } from './texturen.js';
import { zufallMitSeed } from './rauschen.js';
import { baueStadtNatur } from './natur.js';
import { EINSTELLUNGEN } from './einstellungen.js';

const E = () => EINSTELLUNGEN.prolog;
// Die Stadt liegt weit weg von den Inseln (dort fährt man nie mit dem Boot hin)
export const STADT = { x: 0, z: 6000 };
export const HALB = 700; // die Stadt ist 1,4 km groß
export const BODEN = 1.6; // so hoch liegen Straßen, Plätze und Wiesen
export const RHEIN = -6; // so tief ist der Rhein
const PIXEL = 2; // 1 Pixel im Stadtplan = 2 Meter
const N = (HALB * 2) / PIXEL;
const UFER_BREITE = 9; // so breit ist die schräge Steinkante am Rhein (Meter)
const UFER_UNTEN = 0.3; // die unterste Steinreihe (das Wasser ist bei 0)

// ---------- Die Rheinkniebrücke (Richtung und Lage aus den Kartendaten) ----------
const BRUECKE = {
  anfang: new THREE.Vector2(343.6, -74.8), // hier fängt sie an Land an (am Rheinknie)
  richtung: new THREE.Vector2(-0.605, -0.796).normalize(), // so geht sie über den Rhein
  laenge: 780,
  breite: 28,
  pylon: 690, // hier stehen die zwei großen Pfeiler (Meter ab dem Anfang)
};
// Wie hoch ist die Fahrbahn? Sie steigt vom Ufer sanft an.
const brueckenHoehe = (t) => BODEN + Math.min(1, Math.max(0, t) / 90) * 17;
const brueckePunkt = (t, quer = 0) => new THREE.Vector2(
  BRUECKE.anfang.x + BRUECKE.richtung.x * t - BRUECKE.richtung.y * quer,
  BRUECKE.anfang.y + BRUECKE.richtung.y * t + BRUECKE.richtung.x * quer
);

// =============================================================
//  DER STADTPLAN – was ist wo? (Wasser, Haus, Straße)
//  Ein Bild, bei dem 1 Pixel = 2 Meter ist. Rot = Wasser, Grün = Haushöhe, Blau = Straße.
//  Alle Koordinaten hier sind "lokal": Meter ab dem Rheinturm (x = Osten, z = Süden).
// =============================================================
export class Stadtplan {
  constructor() {
    this.daten = maleStadtplan();
    this.berechneUferAbstand();
    this.maske = maleBodenMaske();
    this.maskeDaten = this.maske.getContext('2d').getImageData(0, 0, HALB * 2, HALB * 2).data;
  }

  index(lx, lz, klemmen) {
    let i = Math.floor((lx + HALB) / PIXEL), j = Math.floor((lz + HALB) / PIXEL);
    if (klemmen) {
      i = Math.min(N - 1, Math.max(0, i));
      j = Math.min(N - 1, Math.max(0, j));
    } else if (i < 0 || j < 0 || i >= N || j >= N) return -1;
    return j * N + i;
  }
  // Was ist an dieser Stelle? (Außerhalb der Stadt ist überall Wasser – da kann man nicht hin.)
  feld(lx, lz, klemmen = false) {
    const k = this.index(lx, lz, klemmen);
    if (k < 0) return { wasser: true, haus: 0, weg: false };
    const d = this.daten;
    const wasser = d[k * 4] > 127;
    return { wasser, haus: wasser ? 0 : d[k * 4 + 1] > 20 ? d[k * 4 + 1] : 0, weg: d[k * 4 + 2] > 100 };
  }
  frei(lx, lz) {
    const f = this.feld(lx, lz);
    return !f.wasser && !f.haus;
  }

  // Für jedes Pixel: Wie weit ist es bis zum Wasser? (und im Wasser: bis zum Land?)
  berechneUferAbstand() {
    const GROSS = 1e6;
    this.zumWasserFeld = new Float32Array(N * N);
    this.zumLandFeld = new Float32Array(N * N);
    for (let k = 0; k < N * N; k++) {
      const w = this.daten[k * 4] > 127;
      this.zumWasserFeld[k] = w ? 0 : GROSS;
      this.zumLandFeld[k] = w ? GROSS : 0;
    }
    abstandRechnen(this.zumWasserFeld);
    abstandRechnen(this.zumLandFeld);
  }
  // Weich zwischen den Pixeln mischen, damit das Ufer nicht treppig wird
  abstand(feld, lx, lz) {
    const fx = Math.min(N - 1.001, Math.max(0, (lx + HALB) / PIXEL - 0.5));
    const fz = Math.min(N - 1.001, Math.max(0, (lz + HALB) / PIXEL - 0.5));
    const i = Math.floor(fx), j = Math.floor(fz), a = fx - i, b = fz - j, k = j * N + i;
    return (feld[k] * (1 - a) + feld[k + 1] * a) * (1 - b) + (feld[k + N] * (1 - a) + feld[k + N + 1] * a) * b;
  }
  zumWasser(lx, lz) {
    return this.abstand(this.zumWasserFeld, lx, lz);
  }
  zumLand(lx, lz) {
    return this.abstand(this.zumLandFeld, lx, lz);
  }

  // Wie hoch ist der Boden (ohne Häuser)? Am Rhein geht es schräg runter bis ans Wasser.
  boden(lx, lz, klemmen = false) {
    if (this.feld(lx, lz, klemmen).wasser) return RHEIN;
    const d = this.zumWasser(lx, lz);
    if (d >= UFER_BREITE) return BODEN;
    const s = Math.max(0, d - 1) / (UFER_BREITE - 1);
    return UFER_UNTEN + (BODEN - UFER_UNTEN) * s * s * (3 - 2 * s);
  }
  // Wie hoch steht man hier? (Häuser sind hohe Klötze – da kommt man nicht drauf)
  hoehe(lx, lz) {
    const f = this.feld(lx, lz);
    if (f.wasser) return RHEIN;
    if (f.haus) return BODEN + f.haus;
    return this.boden(lx, lz);
  }
  // Ist hier Rasen? (kein Weg, kein Platz, keine Straße, kein Wasser, kein Haus)
  rasen(lx, lz) {
    const i = Math.floor(lx + HALB), j = Math.floor(lz + HALB);
    if (i < 0 || j < 0 || i >= HALB * 2 || j >= HALB * 2) return false;
    const k = (j * HALB * 2 + i) * 4, m = this.maskeDaten;
    return m[k] < 90 && m[k + 1] < 90 && m[k + 2] < 90 && this.frei(lx, lz);
  }
}

// Abstände ausrechnen: zweimal übers Bild laufen (vorwärts und rückwärts)
function abstandRechnen(a) {
  const s = PIXEL, d = PIXEL * Math.SQRT2;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const k = j * N + i;
    let v = a[k];
    if (i > 0) v = Math.min(v, a[k - 1] + s);
    if (j > 0) {
      v = Math.min(v, a[k - N] + s);
      if (i > 0) v = Math.min(v, a[k - N - 1] + d);
      if (i < N - 1) v = Math.min(v, a[k - N + 1] + d);
    }
    a[k] = v;
  }
  for (let j = N - 1; j >= 0; j--) for (let i = N - 1; i >= 0; i--) {
    const k = j * N + i;
    let v = a[k];
    if (i < N - 1) v = Math.min(v, a[k + 1] + s);
    if (j < N - 1) {
      v = Math.min(v, a[k + N] + s);
      if (i < N - 1) v = Math.min(v, a[k + N + 1] + d);
      if (i > 0) v = Math.min(v, a[k + N - 1] + d);
    }
    a[k] = v;
  }
}

function zeichnePfad(g, punkte, P) {
  g.beginPath();
  punkte.forEach((p, i) => (i ? g.lineTo(...P(p)) : g.moveTo(...P(p))));
}

// Der Stadtplan zum Laufen (2 Meter pro Pixel)
function maleStadtplan() {
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d');
  g.fillStyle = 'rgb(0,0,0)';
  g.fillRect(0, 0, N, N);
  const P = ([x, z]) => [(x + HALB) / PIXEL, (z + HALB) / PIXEL];
  g.strokeStyle = 'rgb(0,0,255)';
  g.lineCap = g.lineJoin = 'round';
  for (const w of DUESSELDORF.wege) {
    g.lineWidth = w.b / PIXEL;
    zeichnePfad(g, w.p, P);
    g.stroke();
  }
  g.fillStyle = 'rgb(255,0,0)';
  for (const w of DUESSELDORF.wasser) { zeichnePfad(g, w, P); g.closePath(); g.fill(); }
  for (const h of [...DUESSELDORF.haeuser, ...DUESSELDORF.landtag]) {
    if (h.m > 2) continue; // schwebende Teile (z. B. Vordächer) – darunter kann man laufen
    g.fillStyle = `rgb(0,${Math.min(250, Math.max(21, Math.round(h.h)))},0)`;
    zeichnePfad(g, h.p, P); g.closePath(); g.fill();
  }
  // Der Fuß vom Rheinturm (die Daten zeigen die breite Kugel oben – unten ist der Schaft schmaler)
  g.fillStyle = 'rgb(0,250,0)';
  g.beginPath(); g.arc(HALB / PIXEL, HALB / PIXEL, 11.8 / PIXEL, 0, Math.PI * 2); g.fill();
  // Wo die Brücke noch ganz flach ist, kann man nicht drunter durch
  g.fillStyle = 'rgb(0,30,0)';
  zeichnePfad(g, [brueckePunkt(0, -BRUECKE.breite / 2), brueckePunkt(26, -BRUECKE.breite / 2), brueckePunkt(26, BRUECKE.breite / 2), brueckePunkt(0, BRUECKE.breite / 2)].map((v) => [v.x, v.y]), P);
  g.closePath(); g.fill();
  return g.getImageData(0, 0, N, N).data;
}

// Die Boden-Maske zum Malen (1 Meter pro Pixel – schärfer als der Stadtplan):
// Rot = Wasser, Grün = Asphalt (Straße), Blau = Pflaster (Gehweg, Platz). Schwarz = Rasen.
function maleBodenMaske() {
  const M = HALB * 2;
  const c = document.createElement('canvas');
  c.width = c.height = M;
  const g = c.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, M, M);
  const P = ([x, z]) => [x + HALB, z + HALB];
  g.lineCap = g.lineJoin = 'round';
  const BLAU = 'rgb(0,0,255)', GRUEN = 'rgb(0,255,0)';
  // Rund um jedes Haus ein Gehweg
  g.strokeStyle = g.fillStyle = BLAU;
  for (const h of DUESSELDORF.haeuser) {
    g.lineWidth = 9;
    zeichnePfad(g, h.p, P); g.closePath(); g.stroke(); g.fill();
  }
  // Der Platz am Landtag ist größer
  for (const h of DUESSELDORF.landtag) {
    g.lineWidth = 16;
    zeichnePfad(g, h.p, P); g.closePath(); g.stroke(); g.fill();
  }
  // Der runde Platz um den Rheinturm
  g.beginPath(); g.arc(HALB, HALB, 34, 0, Math.PI * 2); g.fill();
  // Straßen: erst der breite Gehweg, dann der Asphalt
  for (const w of DUESSELDORF.wege) {
    if (w.b < 6) continue;
    g.lineWidth = w.b + 6;
    zeichnePfad(g, w.p, P); g.stroke();
  }
  g.strokeStyle = GRUEN;
  for (const w of DUESSELDORF.wege) {
    if (w.b < 6) continue;
    g.lineWidth = w.b;
    zeichnePfad(g, w.p, P); g.stroke();
  }
  // Fußwege (die Rheinpromenade!) sind gepflastert
  g.strokeStyle = BLAU;
  for (const w of DUESSELDORF.wege) {
    if (w.b >= 6) continue;
    g.lineWidth = 4;
    zeichnePfad(g, w.p, P); g.stroke();
  }
  g.fillStyle = 'rgb(255,0,0)';
  for (const w of DUESSELDORF.wasser) { zeichnePfad(g, w, P); g.closePath(); g.fill(); }
  return c;
}

// =============================================================
//  BILDER, die das Programm selbst malt (Pflaster, Asphalt, Fenster, Beton)
// =============================================================
function leinwand(n, m = n) {
  const c = document.createElement('canvas');
  c.width = n;
  c.height = m;
  return c;
}

// Aus einem Höhen-Bild ein Beulen-Bild (Normal Map) machen: wo es bergab geht, zeigt das Licht dahin
function beulenAusHoehe(h, n, staerke) {
  const c = leinwand(n), g = c.getContext('2d'), bild = g.createImageData(n, n), d = bild.data;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const l = h[y * n + ((x + n - 1) % n)], r = h[y * n + ((x + 1) % n)];
    const o = h[((y + n - 1) % n) * n + x], u = h[((y + 1) % n) * n + x];
    const nx = (l - r) * staerke, ny = (o - u) * staerke, laenge = Math.hypot(nx, ny, 1);
    const k = (y * n + x) * 4;
    d[k] = (nx / laenge * 0.5 + 0.5) * 255;
    d[k + 1] = (ny / laenge * 0.5 + 0.5) * 255;
    d[k + 2] = (1 / laenge * 0.5 + 0.5) * 255;
    d[k + 3] = 255;
  }
  g.putImageData(bild, 0, 0);
  return c;
}

function alsBild(farbe, n) {
  const c = leinwand(n), g = c.getContext('2d'), bild = g.createImageData(n, n);
  bild.data.set(farbe);
  g.putImageData(bild, 0, 0);
  return c;
}

function kachel(canvas, istFarbe) {
  const t = new THREE.CanvasTexture(canvas);
  if (istFarbe) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.flipY = false; // Bildzeile 0 = Norden – so passt es zur Welt
  t.anisotropy = 8;
  return t;
}

// Pflastersteine wie an der Rheinpromenade: Reihen aus blaugrauen und hellen Steinen (512 Pixel = 2 Meter)
function baueSteinPflaster() {
  const n = 512, z = zufallMitSeed(11), REIHE = 32;
  const hoehe = new Float32Array(n * n), farbe = new Uint8ClampedArray(n * n * 4);
  for (let k = 0; k < n * n; k++) {
    const f = 66 + z() * 16;
    farbe.set([f, f * 0.96, f * 0.88, 255], k * 4); // die Fugen: dunkler Sand
  }
  for (let r = 0; r < n / REIHE; r++) {
    const anfang = Math.floor(z() * 40);
    let x = anfang;
    while (x < anfang + n - 12) {
      const w = Math.min(26 + Math.floor(z() * 26), anfang + n - x);
      const ton = 0.82 + z() * 0.32;
      const basis = z() < 0.55 ? [116, 121, 130] : [140, 134, 124];
      for (let yy = 2; yy < REIHE - 2; yy++) for (let xx = 2; xx < w - 2; xx++) {
        const px = (x + xx) % n, k = (r * REIHE + yy) * n + px;
        const rand = Math.min(xx - 2, w - 3 - xx, yy - 2, REIHE - 3 - yy);
        const h = Math.min(1, rand / 5);
        hoehe[k] = Math.sqrt(h) + (z() - 0.5) * 0.1;
        const f = ton * (0.86 + 0.14 * h) * (0.93 + z() * 0.14);
        farbe.set([basis[0] * f, basis[1] * f, basis[2] * f, 255], k * 4);
      }
      x += w;
    }
  }
  return { farbe: alsBild(farbe, n), beulen: beulenAusHoehe(hoehe, n, 2.2) };
}

// Asphalt: dunkelgrau mit kleinen hellen und dunklen Steinchen (512 Pixel = 4 Meter)
function baueAsphalt() {
  const n = 512, z = zufallMitSeed(23);
  const hoehe = new Float32Array(n * n), farbe = new Uint8ClampedArray(n * n * 4);
  for (let k = 0; k < n * n; k++) {
    let f = 70 + z() * 14, h = z() * 0.25;
    const s = z();
    if (s < 0.025) { f = 120 + z() * 40; h = 0.8; } else if (s < 0.05) { f = 42; h = 0.1; }
    farbe.set([f, f * 1.01, f * 1.04, 255], k * 4);
    hoehe[k] = h;
  }
  return { farbe: alsBild(farbe, n), beulen: beulenAusHoehe(hoehe, n, 1.2) };
}

// Beton für den Rheinturm: hell mit feinen senkrechten Schalungs-Streifen
function baueBeton() {
  const n = 256, c = leinwand(n), g = c.getContext('2d'), z = zufallMitSeed(5);
  g.fillStyle = '#d9d5cc';
  g.fillRect(0, 0, n, n);
  for (let i = 0; i < 2500; i++) {
    const f = 190 + z() * 50;
    g.fillStyle = `rgba(${f},${f - 3},${f - 9},0.35)`;
    g.fillRect(z() * n, z() * n, 2 + z() * 5, 2 + z() * 5);
  }
  g.fillStyle = 'rgba(80,75,68,0.18)';
  for (let x = 0; x < n; x += 32) g.fillRect(x, 0, 2, n);
  g.fillStyle = 'rgba(80,75,68,0.12)';
  g.fillRect(0, 0, n, 2);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

// Eine Hausfassade: ein Stück Wand mit einem Fenster. Wird über alle Wände gekachelt.
// Zweites Bild "rau": grün = wie rau (Wand rau, Glas glatt), blau = wie metallisch (Glas spiegelt).
const FASSADEN = {
  altbau: { breit: 4, hoch: 3.4 },
  buero: { breit: 3, hoch: 3.6 },
  landtag: { breit: 2.2, hoch: 3.6 },
};
function baueFassade(art) {
  const n = 256, bild = leinwand(n), rau = leinwand(n);
  const g = bild.getContext('2d'), q = rau.getContext('2d'), z = zufallMitSeed(art.length * 13);
  g.fillStyle = art === 'landtag' ? '#f4f3ef' : '#ece8e0';
  g.fillRect(0, 0, n, n);
  for (let i = 0; i < 1600; i++) { // feiner Putz
    const f = 215 + z() * 40;
    g.fillStyle = `rgba(${f},${f},${f - 6},0.3)`;
    g.fillRect(z() * n, z() * n, 2, 2);
  }
  q.fillStyle = 'rgb(0,235,0)';
  q.fillRect(0, 0, n, n);
  const glas = (x, y, w, h) => {
    const v = g.createLinearGradient(0, y, 0, y + h);
    v.addColorStop(0, '#a7bccd'); // oben spiegelt sich der Himmel
    v.addColorStop(0.5, '#4f667b');
    v.addColorStop(1, '#2a3846');
    g.fillStyle = v;
    g.fillRect(x, y, w, h);
    q.fillStyle = 'rgb(0,26,120)';
    q.fillRect(x, y, w, h);
  };
  const leiste = (x, y, w, h, farbe) => {
    g.fillStyle = farbe;
    g.fillRect(x, y, w, h);
    q.fillStyle = 'rgb(0,150,0)';
    q.fillRect(x, y, w, h);
  };
  if (art === 'altbau') {
    g.fillStyle = 'rgba(0,0,0,0.07)'; // Schatten über dem Fenster
    g.fillRect(64, 36, 128, 10);
    glas(72, 46, 112, 148);
    leiste(72, 46, 112, 7, '#ffffff'); leiste(72, 187, 112, 7, '#ffffff');
    leiste(72, 46, 7, 148, '#ffffff'); leiste(177, 46, 7, 148, '#ffffff');
    leiste(125, 46, 6, 148, '#ffffff'); leiste(72, 96, 112, 6, '#ffffff');
    leiste(62, 194, 132, 9, '#d8d2c6'); // die Fensterbank
  } else if (art === 'buero') {
    glas(4, 4, 248, 176);
    leiste(0, 180, 256, 76, '#7d858e'); // Brüstung zwischen den Stockwerken
    leiste(0, 0, 256, 5, '#5f666e'); leiste(0, 0, 5, 256, '#5f666e'); leiste(251, 0, 5, 256, '#5f666e');
    leiste(126, 4, 4, 176, '#5f666e');
  } else {
    // Landtag: weiße Bänder und breite Glasstreifen dazwischen
    glas(0, 120, 256, 136);
    leiste(0, 120, 256, 5, '#c9ccd0');
    leiste(0, 120, 5, 136, '#9aa1a8'); leiste(128, 120, 4, 136, '#9aa1a8');
  }
  const t = new THREE.CanvasTexture(bild), r = new THREE.CanvasTexture(rau);
  t.colorSpace = THREE.SRGBColorSpace;
  for (const x of [t, r]) { x.wrapS = x.wrapT = THREE.RepeatWrapping; x.anisotropy = 8; }
  return { bild: t, rau: r };
}

// Das Material für Wände: Nur die Wand bekommt die Hausfarbe, Glas bleibt Glas (und spiegelt)
function fassadenMaterial(art) {
  const { bild, rau } = baueFassade(art);
  const m = new THREE.MeshStandardMaterial({ map: bild, roughnessMap: rau, metalnessMap: rau, roughness: 1, metalness: 0.75, vertexColors: true });
  m.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `
      #if defined( USE_COLOR ) && defined( USE_ROUGHNESSMAP )
        float wand = smoothstep(0.3, 0.8, texture2D(roughnessMap, vRoughnessMapUv).g);
        diffuseColor.rgb *= mix(vec3(1.0), vColor, wand);
      #endif`);
  };
  m.customProgramCacheKey = () => 'fassade';
  return m;
}

// =============================================================
//  DER BODEN – mit echten Fotos wie auf der Insel
// =============================================================
function bodenMaterial(maske) {
  const pflaster = baueSteinPflaster(), asphalt = baueAsphalt();
  const T = {
    tMaske: new THREE.CanvasTexture(maske),
    tGras: textur('gras.jpg'), tGrasN: textur('gras_normal.jpg', { farbe: false }),
    tFels: textur('fels.jpg'), tFelsN: textur('fels_normal.jpg', { farbe: false }),
    tPfl: kachel(pflaster.farbe, true), tPflN: kachel(pflaster.beulen, false),
    tAsph: kachel(asphalt.farbe, true), tAsphN: kachel(asphalt.beulen, false),
  };
  T.tMaske.flipY = false;
  const material = new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0 });
  material.onBeforeCompile = (shader) => {
    for (const [k, v] of Object.entries(T)) shader.uniforms[k] = { value: v };
    shader.uniforms.uEcke = { value: new THREE.Vector2(STADT.x - HALB, STADT.z - HALB) };
    shader.uniforms.uGroesse = { value: HALB * 2 };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        attribute float ufer;
        varying float vUfer;
        varying vec3 vWeltPos;
        varying vec3 vWeltNormale;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vUfer = ufer;
        vWeltPos = (modelMatrix * vec4(position, 1.0)).xyz;
        vWeltNormale = normalize(mat3(modelMatrix) * normal);`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform sampler2D tMaske, tGras, tGrasN, tFels, tFelsN, tPfl, tPflN, tAsph, tAsphN;
        uniform vec2 uEcke;
        uniform float uGroesse;
        varying float vUfer;
        varying vec3 vWeltPos;
        varying vec3 vWeltNormale;
        vec2 beule(sampler2D t, vec2 uv) { return texture2D(t, uv).xy * 2.0 - 1.0; }`)
      .replace('#include <map_fragment>', `
        vec3 nGeo = normalize(vWeltNormale);
        float fern = smoothstep(20.0, 120.0, distance(vWeltPos, cameraPosition));
        float nah = 1.0 - fern;
        // Große, weiche Flecken – damit nichts wie Tapete aussieht
        float makro = texture2D(tFels, vWeltPos.xz / 210.0 + 0.3).g;
        // Die Ränder ein bisschen wackelig machen (echte Wege sind nicht schnurgerade)
        vec2 wackel = (texture2D(tFels, vWeltPos.xz / 9.0).rg - 0.5) * 1.1;
        vec4 m = texture2D(tMaske, (vWeltPos.xz + wackel - uEcke) / uGroesse);
        float wAsph = smoothstep(0.3, 0.7, m.g);
        float wPfl = smoothstep(0.3, 0.7, m.b) * (1.0 - wAsph);
        float wStein = max(vUfer, smoothstep(0.3, 0.7, m.r));
        float wGras = max(1.0 - wAsph - wPfl, 0.0);
        wAsph *= 1.0 - wStein; wPfl *= 1.0 - wStein; wGras *= 1.0 - wStein;

        vec2 uv = vWeltPos.xz;
        vec3 farbe = vec3(0.0);
        vec2 beulen = vec2(0.0);
        float rauheit = 0.0;
        if (wGras > 0.002) {
          vec2 u = uv / 4.0;
          vec3 c = mix(texture2D(tGras, u).rgb, texture2D(tGras, u * 0.21 + 0.37).rgb, 0.3 + 0.45 * fern);
          farbe += c * (0.88 + 0.3 * makro) * 1.08 * wGras;
          beulen += beule(tGrasN, u) * nah * 1.1 * wGras;
          rauheit += 0.93 * wGras;
        }
        if (wPfl > 0.002) {
          vec2 u = uv / 2.0;
          farbe += texture2D(tPfl, u).rgb * (0.86 + 0.28 * makro) * wPfl;
          beulen += beule(tPflN, u) * nah * wPfl;
          rauheit += 0.82 * wPfl;
        }
        if (wAsph > 0.002) {
          vec2 u = uv / 4.0;
          farbe += texture2D(tAsph, u).rgb * (0.9 + 0.2 * makro) * wAsph;
          beulen += beule(tAsphN, u) * nah * 0.5 * wAsph;
          rauheit += 0.9 * wAsph;
        }
        if (wStein > 0.002) {
          // Dicke Steine am Rheinufer – unten nass und dunkel
          vec2 u = uv / 5.0 + vec2(vWeltPos.y * 0.13);
          float nass = 1.0 - smoothstep(-0.4, 0.9, vWeltPos.y + (makro - 0.5) * 0.5);
          farbe += texture2D(tFels, u).rgb * 0.9 * mix(1.0, 0.5, nass) * wStein;
          beulen += beule(tFelsN, u) * nah * 1.4 * wStein;
          rauheit += mix(0.9, 0.35, nass) * wStein;
        }
        vec3 bodenNormale = normalize(nGeo + vec3(beulen.x, 0.0, beulen.y) * 0.9);
        float bodenRauheit = rauheit;
        diffuseColor.rgb *= farbe;`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = bodenRauheit;`)
      .replace('#include <normal_fragment_maps>', `
        normal = normalize((viewMatrix * vec4(bodenNormale, 0.0)).xyz);`);
  };
  material.customProgramCacheKey = () => 'stadtboden';
  return material;
}

function baueBoden(plan, gruppe) {
  const material = bodenMaterial(plan.maske);
  // Die Stadt selbst: alle 4 Meter ein Punkt
  const schritt = 4, n = (HALB * 2) / schritt;
  const geo = new THREE.PlaneGeometry(HALB * 2, HALB * 2, n, n);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position, ufer = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const y = plan.boden(x, z, true);
    pos.setY(i, y);
    ufer[i] = y < 0 ? 1 : 1 - smoothstep(3.5, 7.5, plan.zumWasser(x, z));
  }
  geo.setAttribute('ufer', new THREE.BufferAttribute(ufer, 1));
  geo.computeVertexNormals();
  const boden = new THREE.Mesh(geo, material);
  boden.receiveShadow = true;
  gruppe.add(boden);

  // Das Umland drumherum (damit die Welt nicht an der Stadtgrenze aufhört)
  const S = 28, weite = S * 90; // die Ränder der Stadt liegen genau auf Gitterlinien
  const um = new THREE.PlaneGeometry(weite * 2, weite * 2, 180, 180);
  um.rotateX(-Math.PI / 2);
  const p2 = um.attributes.position, u2 = new Float32Array(p2.count);
  for (let i = 0; i < p2.count; i++) {
    const x = p2.getX(i), z = p2.getZ(i);
    if (Math.abs(x) < HALB - 0.5 && Math.abs(z) < HALB - 0.5) { p2.setY(i, -12); continue; } // unter der Stadt versteckt
    const w = plan.feld(Math.max(-HALB + 1, Math.min(HALB - 1, x)), Math.max(-HALB + 1, Math.min(HALB - 1, z)), true).wasser;
    p2.setY(i, w ? RHEIN : BODEN);
    u2[i] = w ? 1 : 0;
  }
  um.setAttribute('ufer', new THREE.BufferAttribute(u2, 1));
  um.computeVertexNormals();
  const umland = new THREE.Mesh(um, material);
  umland.receiveShadow = true;
  gruppe.add(umland);
}

function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

// =============================================================
//  HÄUSER – echte Umrisse, weiche Kanten, Fenster und Flachdächer
// =============================================================
// Ein Haus in Wände (mit Fenstern) und Dach teilen. Die Fenster sitzen genau auf den Stockwerken.
function teileInWaendeUndDaecher(geo, wandFarbe, dachFarbe, fassade, waende, daecher, unten) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const pos = g.attributes.position, nor = g.attributes.normal;
  const teile = { wand: { p: [], n: [], u: [], c: [] }, dach: { p: [], n: [], u: [], c: [] } };
  for (let t = 0; t < pos.count; t += 3) {
    const ny = (nor.getY(t) + nor.getY(t + 1) + nor.getY(t + 2)) / 3;
    if (ny < -0.6) continue; // der Boden vom Haus – den sieht niemand
    const oben = ny > 0.6;
    const ziel = teile[oben ? 'dach' : 'wand'], c = oben ? dachFarbe : wandFarbe;
    // Richtung der Wand (waagerecht), damit die Fenster an der Wand entlanglaufen
    let nx = nor.getX(t) + nor.getX(t + 1) + nor.getX(t + 2), nz = nor.getZ(t) + nor.getZ(t + 1) + nor.getZ(t + 2);
    const l = Math.hypot(nx, nz) || 1;
    nx /= l; nz /= l;
    for (let k = t; k < t + 3; k++) {
      const x = pos.getX(k), y = pos.getY(k), z = pos.getZ(k);
      ziel.p.push(x, y, z);
      ziel.n.push(nor.getX(k), nor.getY(k), nor.getZ(k));
      if (oben) ziel.u.push(x / 6, z / 6);
      else ziel.u.push((x * -nz + z * nx) / fassade.breit, (y - unten) / fassade.hoch);
      ziel.c.push(c.r, c.g, c.b);
    }
  }
  for (const [name, liste] of [['wand', waende], ['dach', daecher]]) {
    const t = teile[name];
    if (!t.p.length) continue;
    const b = new THREE.BufferGeometry();
    b.setAttribute('position', new THREE.Float32BufferAttribute(t.p, 3));
    b.setAttribute('normal', new THREE.Float32BufferAttribute(t.n, 3));
    b.setAttribute('uv', new THREE.Float32BufferAttribute(t.u, 2));
    b.setAttribute('color', new THREE.Float32BufferAttribute(t.c, 3));
    liste.push(b);
  }
}

function schatten(mesh) {
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}

function baueHaeuser(gruppe) {
  const z = zufallMitSeed(3);
  const alt = E().hausFarben.map((f) => new THREE.Color(f));
  const modern = ['#c9d2da', '#d7d9d6', '#b8c4cf', '#e2e0da'].map((f) => new THREE.Color(f));
  const teile = { altbau: [], buero: [], landtag: [], daecher: [] };
  const extrudiere = (p, tief, rund) => {
    const form = new THREE.Shape(p.map(([x, zz]) => new THREE.Vector2(x, -zz)));
    const geo = new THREE.ExtrudeGeometry(form, { depth: tief, bevelEnabled: true, bevelThickness: rund, bevelSize: rund, bevelSegments: 2, curveSegments: 1 });
    geo.rotateX(-Math.PI / 2);
    return geo;
  };
  DUESSELDORF.haeuser.forEach((h, n) => {
    const art = h.h > 30 ? 'buero' : 'altbau';
    let geo;
    try { geo = extrudiere(h.p, Math.max(2, h.h - h.m - 0.8), 0.8); } catch { return; }
    geo.translate(0, BODEN + h.m, 0);
    const farbe = (art === 'buero' ? modern[n % modern.length] : alt[n % alt.length]).clone().multiplyScalar(0.94 + z() * 0.1);
    const dach = new THREE.Color('#8f8c86').lerp(farbe, 0.25);
    teileInWaendeUndDaecher(geo, farbe, dach, FASSADEN[art], teile[art], teile.daecher, BODEN + h.m - 0.4);
  });
  // Der Landtag: viele runde Teile, weiß, mit Glasbändern
  const weiss = new THREE.Color('#ffffff');
  for (const h of DUESSELDORF.landtag) {
    let geo;
    try { geo = extrudiere(h.p, Math.max(1, h.h - h.m - 0.5), 0.35); } catch { continue; }
    geo.translate(0, BODEN + h.m, 0);
    teileInWaendeUndDaecher(geo, weiss, new THREE.Color('#b9bab6'), FASSADEN.landtag, teile.landtag, teile.daecher, BODEN + h.m - 0.2);
  }
  for (const art of ['altbau', 'buero', 'landtag']) {
    if (teile[art].length) gruppe.add(schatten(new THREE.Mesh(mergeGeometries(teile[art]), fassadenMaterial(art))));
  }
  if (teile.daecher.length) {
    const dach = new THREE.MeshStandardMaterial({ map: textur('sand.jpg'), vertexColors: true, roughness: 0.95 });
    gruppe.add(schatten(new THREE.Mesh(mergeGeometries(teile.daecher), dach)));
  }
}

// =============================================================
//  DER RHEINTURM 🗼 – 240 Meter hoch, mit Kanzel, Antenne und Lichtzeituhr
//  (Maße aus den OpenStreetMap-Daten)
// =============================================================
function drechseln(punkte, segmente, kacheln, hoeheProKachel) {
  const geo = new THREE.LatheGeometry(punkte.map(([r, y]) => new THREE.Vector2(r, y + BODEN)), segmente);
  const uv = geo.attributes.uv, pos = geo.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * kacheln, pos.getY(i) / hoeheProKachel);
  return geo;
}

function baueRheinturm(tuerWinkel) {
  const turm = new THREE.Group();
  const beton = new THREE.MeshStandardMaterial({ map: baueBeton(), color: '#f1eee8', roughness: 0.85 });
  const glas = new THREE.MeshStandardMaterial({ color: '#2b4157', roughness: 0.12, metalness: 0.7 });
  const dunkel = new THREE.MeshStandardMaterial({ color: '#5b5f63', roughness: 0.6, metalness: 0.3 });
  // Der Schaft: unten breit, oben schmal
  const schaft = drechseln([[0, 0], [11.6, 0], [11.2, 1.2], [10.8, 4], [10.6, 10], [10.2, 30], [9.6, 80], [8.9, 110], [8.5, 140], [8.4, 155]], 48, 40, 5);
  // Die Kanzel: wird nach oben immer breiter wie ein Kelch
  const kelch = drechseln([[8.4, 154], [12.9, 155], [14.9, 160.5], [16.8, 166.25], [17.6, 170], [18.2, 172.5], [18.4, 174.5]], 48, 40, 4);
  // Die schrägen Fenster vom Restaurant (oben weiter draußen)
  const fenster = drechseln([[18.4, 174.5], [19.3, 179.4]], 48, 1, 1);
  const deckel = drechseln([[19.3, 179.4], [19.1, 180.2], [15, 181.6], [7.9, 183]], 48, 40, 4);
  const oben = drechseln([[7.9, 183], [7.9, 186.4], [18.4, 186.6], [18.4, 187.2], [5.5, 187.4], [5.5, 193.9], [16.8, 194.1], [16.8, 194.7], [2.4, 194.9], [2.4, 218], [1.3, 218.5], [1.3, 240.5], [0, 240.5]], 32, 16, 4);
  turm.add(schatten(new THREE.Mesh(schaft, beton)), schatten(new THREE.Mesh(kelch, beton)), schatten(new THREE.Mesh(deckel, beton)), schatten(new THREE.Mesh(oben, beton)));
  turm.add(new THREE.Mesh(fenster, glas));
  // Unter den Fenstern ein dunkles Band (die Aussichts-Plattform)
  const band = new THREE.Mesh(drechseln([[17.7, 170.2], [18.0, 172.3]], 48, 1, 1), dunkel);
  turm.add(band);
  // Rote Spitze und rote Warnlichter
  const rot = new THREE.MeshStandardMaterial({ color: '#d23a2c', emissive: '#ff2a1a', emissiveIntensity: 0.6 });
  const spitze = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.35, 8, 16), rot);
  spitze.position.y = BODEN + 236;
  turm.add(spitze);
  // Die Lichtzeituhr: Lichter am Schaft (die echte zeigt die Uhrzeit!)
  // Stunden, Minuten, Sekunden – getrennt durch rote Lichter
  const gruppen = [[2, 9], [1], [5, 9], [1], [5, 9]];
  const lichter = [];
  let y = 40;
  for (const g of gruppen) {
    for (const anzahl of g) {
      for (let i = 0; i < anzahl; i++) { lichter.push({ y, rot: g.length === 1 }); y += 2.1; }
      y += 2.5;
    }
  }
  const licht = new THREE.InstancedMesh(new THREE.SphereGeometry(0.45, 10, 8), new THREE.MeshStandardMaterial({ color: '#fff3c4', emissive: '#ffd36a', emissiveIntensity: 1.2 }), lichter.length);
  const m = new THREE.Matrix4();
  lichter.forEach((l, i) => {
    const r = THREE.MathUtils.lerp(10.2, 8.5, (l.y - 30) / 125) + 0.15;
    m.makeTranslation(Math.sin(0.55) * r, BODEN + l.y, Math.cos(0.55) * r);
    licht.setMatrixAt(i, m);
    licht.setColorAt(i, new THREE.Color(l.rot ? '#ff4030' : '#ffffff'));
  });
  turm.add(licht);
  // Der flache Eingang unten am Fuß
  const eingang = new THREE.Mesh(new RoundedBoxGeometry(14, 5, 9, 3, 1.2), new THREE.MeshStandardMaterial({ map: fassadenMaterial('buero').map, color: '#d7dde2', roughness: 0.4, metalness: 0.3 }));
  eingang.position.set(Math.sin(tuerWinkel) * 13.5, BODEN + 2.5, Math.cos(tuerWinkel) * 13.5);
  eingang.rotation.y = tuerWinkel;
  turm.add(schatten(eingang));
  return turm;
}

// =============================================================
//  DIE RHEINKNIEBRÜCKE – mit hohen Pfeilern, Seilen und fahrenden Autos
// =============================================================
function baueBruecke(gruppe, plan) {
  const beton = new THREE.MeshStandardMaterial({ color: '#c9c6bf', roughness: 0.8 });
  const weiss = new THREE.MeshStandardMaterial({ color: '#eef0ee', roughness: 0.5 });
  const B = BRUECKE, d = B.richtung;
  const dreh = -Math.atan2(d.y, d.x); // so zeigt die lange Seite einer Kiste in Brücken-Richtung
  const STUECK = 20;
  const stuecke = Math.ceil(B.laenge / STUECK);
  const fahrbahn = new THREE.InstancedMesh(new RoundedBoxGeometry(STUECK + 0.4, 2.2, B.breite, 2, 0.6), beton, stuecke);
  const gelaender = new THREE.InstancedMesh(new RoundedBoxGeometry(STUECK, 1.1, 0.25, 1, 0.1), weiss, stuecke * 2);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  for (let i = 0; i < stuecke; i++) {
    const t0 = i * STUECK, t1 = t0 + STUECK;
    const h0 = brueckenHoehe(t0), h1 = brueckenHoehe(t1), mitte = brueckePunkt((t0 + t1) / 2);
    e.set(0, dreh, Math.atan2(h1 - h0, STUECK), 'YXZ');
    q.setFromEuler(e);
    m.compose(new THREE.Vector3(mitte.x, (h0 + h1) / 2 - 1.1, mitte.y), q, new THREE.Vector3(1, 1, 1));
    fahrbahn.setMatrixAt(i, m);
    for (const [j, s] of [[0, -1], [1, 1]]) {
      const p = brueckePunkt((t0 + t1) / 2, s * (B.breite / 2 - 0.3));
      m.compose(new THREE.Vector3(p.x, (h0 + h1) / 2 + 0.55, p.y), q, new THREE.Vector3(1, 1, 1));
      gelaender.setMatrixAt(i * 2 + j, m);
    }
  }
  gruppe.add(schatten(fahrbahn), gelaender);
  // Stützen unter der Rampe an Land
  const stuetzen = [];
  for (let t = 40; t < B.laenge; t += 40) {
    const p = brueckePunkt(t);
    if (plan.feld(p.x, p.y).wasser || t > B.pylon - 20) continue;
    stuetzen.push({ p, h: brueckenHoehe(t) - 2.2 - BODEN });
  }
  const stuetze = new THREE.InstancedMesh(new THREE.CylinderGeometry(1.6, 1.9, 1, 16), beton, stuetzen.length * 2);
  stuetzen.forEach((s, i) => {
    for (const [j, quer] of [[0, -7], [1, 7]]) {
      m.compose(new THREE.Vector3(s.p.x - d.y * quer, BODEN + s.h / 2, s.p.y + d.x * quer), new THREE.Quaternion(), new THREE.Vector3(1, s.h, 1));
      stuetze.setMatrixAt(i * 2 + j, m);
    }
  });
  gruppe.add(schatten(stuetze));
  // Zwei hohe Pfeiler (Pylone) und die Schrägseile
  const PYLON_HOEHE = 114;
  const pylonGeo = new THREE.CylinderGeometry(1.3, 2.6, PYLON_HOEHE + 6, 12);
  const seile = [];
  for (const s of [-1, 1]) {
    const p = brueckePunkt(B.pylon, s * (B.breite / 2 + 2));
    const pylon = new THREE.Mesh(pylonGeo, weiss);
    pylon.position.set(p.x, (PYLON_HOEHE - 6) / 2, p.y);
    gruppe.add(schatten(pylon));
    const oben = (k) => new THREE.Vector3(p.x, PYLON_HOEHE - 6 - k * 4.2, p.y);
    for (let k = 1; k <= 9; k++) {
      const a = brueckePunkt(B.pylon - k * 36, s * (B.breite / 2 - 1));
      seile.push([oben(k), new THREE.Vector3(a.x, brueckenHoehe(B.pylon - k * 36), a.y)]);
    }
    for (let k = 1; k <= 4; k++) {
      const a = brueckePunkt(B.pylon + k * 22, s * (B.breite / 2 - 1));
      seile.push([oben(k), new THREE.Vector3(a.x, brueckenHoehe(B.pylon + k * 22), a.y)]);
    }
  }
  const seil = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.22, 0.22, 1, 6), weiss, seile.length);
  const hoch = new THREE.Vector3(0, 1, 0);
  seile.forEach(([a, b], i) => {
    const r = new THREE.Vector3().subVectors(b, a);
    m.compose(new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(hoch, r.clone().normalize()), new THREE.Vector3(1, r.length(), 1));
    seil.setMatrixAt(i, m);
  });
  gruppe.add(seil);

  // Autos, die über die Brücke fahren
  const z = zufallMitSeed(41);
  const autos = [];
  const farben = ['#d23a2c', '#f2f2f0', '#2b2f36', '#3a6fb5', '#9aa3ab', '#e8c547', '#4f8a5b'];
  for (let i = 0; i < 14; i++) autos.push({ t: z() * B.laenge, spur: i % 2 ? 1 : -1, tempo: 11 + z() * 5, farbe: farben[i % farben.length] });
  const autoGeo = mergeGeometries([new RoundedBoxGeometry(4.3, 1.0, 1.85, 2, 0.35).translate(0, 0.75, 0), new RoundedBoxGeometry(2.4, 0.8, 1.6, 2, 0.35).translate(-0.3, 1.5, 0)]);
  const autoMesh = new THREE.InstancedMesh(autoGeo, new THREE.MeshStandardMaterial({ roughness: 0.3, metalness: 0.5 }), autos.length);
  autos.forEach((a, i) => autoMesh.setColorAt(i, new THREE.Color(a.farbe)));
  autoMesh.castShadow = true;
  gruppe.add(autoMesh);
  const autoDreh = [new THREE.Quaternion(), new THREE.Quaternion()];
  return (dt) => {
    autos.forEach((a, i) => {
      a.t += a.spur * a.tempo * dt;
      if (a.t > B.laenge) a.t = 30;
      if (a.t < 30) a.t = B.laenge;
      const p = brueckePunkt(a.t, a.spur * 4.5);
      autoDreh[0].setFromEuler(e.set(0, dreh + (a.spur > 0 ? 0 : Math.PI), 0));
      m.compose(new THREE.Vector3(p.x, brueckenHoehe(a.t), p.y), autoDreh[0], new THREE.Vector3(1, 1, 1));
      autoMesh.setMatrixAt(i, m);
    });
    autoMesh.instanceMatrix.needsUpdate = true;
  };
}

// =============================================================
//  LATERNEN UND BÄNKE an der Promenade
// =============================================================
function laufeEntlang(wege, abstand, tue) {
  for (const w of wege) {
    for (let i = 0; i < w.p.length - 1; i++) {
      const [ax, az] = w.p[i], [bx, bz] = w.p[i + 1];
      const l = Math.hypot(bx - ax, bz - az);
      if (l < 1) continue;
      const dx = (bx - ax) / l, dz = (bz - az) / l;
      for (let s = abstand / 2; s < l; s += abstand) tue(ax + dx * s, az + dz * s, dx, dz, w);
    }
  }
}

function baueLaternenUndBaenke(gruppe, plan) {
  const laternen = [], baenke = [];
  const zuNah = (liste, x, z, r) => liste.some((p) => Math.hypot(p.x - x, p.z - z) < r);
  const fusswege = DUESSELDORF.wege.filter((w) => w.b < 6), strassen = DUESSELDORF.wege.filter((w) => w.b >= 6);
  laufeEntlang(fusswege, 24, (x, z, dx, dz) => {
    if (plan.zumWasser(x, z) > 160) return;
    // Auf der Seite weg vom Wasser die Laterne, zum Wasser hin die Bank
    const links = plan.zumWasser(x - dz * 3, z + dx * 3) < plan.zumWasser(x + dz * 3, z - dx * 3) ? 1 : -1;
    const lx = x + dz * 2.3 * links, lz = z - dx * 2.3 * links;
    if (plan.frei(lx, lz) && plan.zumWasser(lx, lz) > 5 && !zuNah(laternen, lx, lz, 18)) laternen.push({ x: lx, z: lz });
    const bx = x - dz * 2.4 * links, bz = z + dx * 2.4 * links;
    if (plan.zumWasser(x, z) < 60 && plan.frei(bx, bz) && plan.zumWasser(bx, bz) > 4 && !zuNah(baenke, bx, bz, 34)) baenke.push({ x: bx, z: bz, w: Math.atan2(-dz * links, dx * links) });
  });
  laufeEntlang(strassen, 30, (x, z, dx, dz, w) => {
    const s = laternen.length % 2 ? 1 : -1;
    const lx = x + dz * (w.b / 2 + 1.4) * s, lz = z - dx * (w.b / 2 + 1.4) * s;
    if (Math.hypot(lx, lz) < 480 && plan.frei(lx, lz) && !zuNah(laternen, lx, lz, 16)) laternen.push({ x: lx, z: lz });
  });
  // Die Laterne: dunkelgrüner Mast und eine Leuchte obendrauf
  const mast = drechseln([[0.2, 0], [0.16, 0.3], [0.09, 0.5], [0.07, 4.1], [0.24, 4.25], [0.3, 4.75], [0.2, 4.95], [0.34, 5.0], [0.06, 5.25], [0, 5.3]], 10, 1, 5);
  mast.translate(0, -BODEN, 0);
  const leuchte = new THREE.SphereGeometry(0.24, 12, 8).scale(1, 1.2, 1).translate(0, 4.55, 0);
  const mastMesh = new THREE.InstancedMesh(mast, new THREE.MeshStandardMaterial({ color: '#2d3b34', roughness: 0.45, metalness: 0.6 }), laternen.length);
  const leuchtMesh = new THREE.InstancedMesh(leuchte, new THREE.MeshStandardMaterial({ color: '#fff7e0', emissive: '#ffe2a0', emissiveIntensity: 0.35, roughness: 0.2 }), laternen.length);
  const m = new THREE.Matrix4();
  laternen.forEach((l, i) => {
    m.makeTranslation(l.x, plan.hoehe(l.x, l.z), l.z);
    mastMesh.setMatrixAt(i, m);
    leuchtMesh.setMatrixAt(i, m);
  });
  mastMesh.castShadow = true;
  gruppe.add(mastMesh, leuchtMesh);
  // Die Bank: Holz-Latten auf dunklen Füßen
  const holz = mergeGeometries([
    new RoundedBoxGeometry(1.9, 0.08, 0.5, 2, 0.03).translate(0, 0.46, 0),
    new RoundedBoxGeometry(1.9, 0.38, 0.07, 2, 0.03).translate(0, 0.78, -0.25),
  ]);
  const fuesse = mergeGeometries([-0.75, 0.75].map((x) => new RoundedBoxGeometry(0.08, 0.46, 0.5, 1, 0.03).translate(x, 0.23, 0)));
  const holzMesh = new THREE.InstancedMesh(holz, new THREE.MeshStandardMaterial({ color: '#a8754a', roughness: 0.7 }), baenke.length);
  const fussMesh = new THREE.InstancedMesh(fuesse, new THREE.MeshStandardMaterial({ color: '#33373a', roughness: 0.5, metalness: 0.6 }), baenke.length);
  const q = new THREE.Quaternion(), hoch = new THREE.Vector3(0, 1, 0);
  baenke.forEach((b, i) => {
    m.compose(new THREE.Vector3(b.x, plan.hoehe(b.x, b.z), b.z), q.setFromAxisAngle(hoch, b.w), new THREE.Vector3(1, 1, 1));
    holzMesh.setMatrixAt(i, m);
    fussMesh.setMatrixAt(i, m);
  });
  holzMesh.castShadow = true;
  gruppe.add(holzMesh, fussMesh);
  return laternen;
}

// =============================================================
//  BÄUME UND GRAS – Platanen an der Promenade, Alleen und Wiesen
// =============================================================
function sammleBaeume(plan, laternen) {
  const z = zufallMitSeed(19);
  const baeume = [], gitter = new Map();
  const nimm = (x, zz, groesse, form = z() < 0.7 ? 0 : 1) => {
    if (baeume.length >= E().baeume) return;
    if (Math.hypot(x, zz) < 34 || !plan.frei(x, zz) || plan.feld(x, zz).weg || plan.zumWasser(x, zz) < 7) return;
    for (const [dx, dz] of [[4, 0], [-4, 0], [0, 4], [0, -4]]) if (!plan.frei(x + dx, zz + dz)) return; // nicht an der Hauswand
    const k = `${Math.floor(x / 7)},${Math.floor(zz / 7)}`;
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      for (const b of gitter.get(`${Math.floor(x / 7) + i},${Math.floor(zz / 7) + j}`) || []) if (Math.hypot(b.x - x, b.z - zz) < 7) return;
    }
    if (laternen.some((l) => Math.hypot(l.x - x, l.z - zz) < 3)) return;
    const b = { x, z: zz, groesse, form };
    baeume.push(b);
    if (!gitter.has(k)) gitter.set(k, []);
    gitter.get(k).push(b);
  };
  // 1. Platanen an der Promenade (auf der Landseite der Wege am Rhein)
  laufeEntlang(DUESSELDORF.wege.filter((w) => w.b < 6), 12, (x, zz, dx, dz) => {
    if (plan.zumWasser(x, zz) > 130) return;
    const s = plan.zumWasser(x - dz * 3, zz + dx * 3) < plan.zumWasser(x + dz * 3, zz - dx * 3) ? -1 : 1;
    nimm(x - dz * 5 * s, zz + dx * 5 * s, 1.25 + z() * 0.35, 0);
  });
  // 2. Alleen an den Straßen
  laufeEntlang(DUESSELDORF.wege.filter((w) => w.b >= 6), 16, (x, zz, dx, dz, w) => {
    if (Math.hypot(x, zz) > 520) return;
    for (const s of [-1, 1]) nimm(x + dz * (w.b / 2 + 3.5) * s, zz - dx * (w.b / 2 + 3.5) * s, 1.0 + z() * 0.3, 1);
  });
  // 3. Bäume auf den Wiesen
  for (let i = 0; i < 9000 && baeume.length < E().baeume; i++) {
    const x = (z() - 0.5) * 1100, zz = (z() - 0.5) * 1100;
    if (!plan.rasen(x, zz) || z() > 0.35) continue;
    nimm(x, zz, 1.1 + z() * 0.5);
  }
  // Gras-Büschel auf den Wiesen (nur in der Nähe – weit weg sieht man sie eh nicht)
  const gras = [];
  for (let i = 0; i < E().gras * 6 && gras.length < E().gras; i++) {
    const x = (z() - 0.5) * 900, zz = (z() - 0.5) * 900;
    if (plan.rasen(x, zz) && plan.zumWasser(x, zz) > 9) gras.push({ x, z: zz });
  }
  return { baeume, gras };
}

// =============================================================
//  DER YACHTHAFEN – Stege und kleine Boote
// =============================================================
function baueYachthafen(gruppe, plan, frei) {
  const holz = new THREE.MeshStandardMaterial({ map: textur('planken.jpg'), color: '#b49a7a', roughness: 0.85 });
  const stege = [];
  for (const w of DUESSELDORF.wege) {
    for (let i = 0; i < w.p.length - 1; i++) {
      const [ax, az] = w.p[i], [bx, bz] = w.p[i + 1];
      const l = Math.hypot(bx - ax, bz - az);
      if (l < 3 || l > 60 || !plan.feld((ax + bx) / 2, (az + bz) / 2).wasser) continue;
      if (!frei(ax, az) || !frei(bx, bz) || !frei((ax + bx) / 2, (az + bz) / 2)) continue; // nicht über dem Ruderboot
      stege.push({ ax, az, bx, bz, l });
    }
  }
  const steg = new THREE.InstancedMesh(new RoundedBoxGeometry(1, 0.5, 1, 2, 0.12), holz, stege.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), hoch = new THREE.Vector3(0, 1, 0);
  const z = zufallMitSeed(31);
  const yachten = [];
  stege.forEach((s, i) => {
    const w = -Math.atan2(s.bz - s.az, s.bx - s.ax);
    m.compose(new THREE.Vector3((s.ax + s.bx) / 2, 0.35, (s.az + s.bz) / 2), q.setFromAxisAngle(hoch, w), new THREE.Vector3(s.l, 1, 2));
    steg.setMatrixAt(i, m);
    // Boote links und rechts vom Steg
    const dx = (s.bx - s.ax) / s.l, dz = (s.bz - s.az) / s.l;
    for (let t = 5; t < s.l - 3; t += 6) for (const seite of [-1, 1]) {
      if (z() < 0.3) continue;
      const x = s.ax + dx * t - dz * 4.2 * seite, zz = s.az + dz * t + dx * 4.2 * seite;
      if (!plan.feld(x, zz).wasser || plan.zumLand(x, zz) < 3 || !frei(x, zz)) continue;
      yachten.push({ x, z: zz, w, segel: z() < 0.45, groesse: 0.8 + z() * 0.4 });
    }
  });
  steg.receiveShadow = true;
  gruppe.add(steg);
  // Ein Boot = weißer Rumpf, kleine Kabine mit Fenstern, bei Segelbooten ein Mast
  const rumpfGeo = rumpf(9, 3, 1.2, -0.4, 4, 0.35);
  const kabineGeo = new RoundedBoxGeometry(3.6, 1.1, 2.2, 2, 0.35).translate(-0.8, 1.35, 0);
  const fensterGeo = new RoundedBoxGeometry(3.7, 0.4, 2.3, 2, 0.15).translate(-0.8, 1.45, 0);
  const mastGeo = new THREE.CylinderGeometry(0.06, 0.08, 11, 6).translate(0.6, 6.3, 0);
  const teile = [
    [rumpfGeo, new THREE.MeshStandardMaterial({ color: '#f6f7f5', roughness: 0.35 }), () => true],
    [kabineGeo, new THREE.MeshStandardMaterial({ color: '#eceee9', roughness: 0.4 }), () => true],
    [fensterGeo, new THREE.MeshStandardMaterial({ color: '#1e2a36', roughness: 0.1, metalness: 0.6 }), () => true],
    [mastGeo, new THREE.MeshStandardMaterial({ color: '#c8ccd0', roughness: 0.3, metalness: 0.7 }), (y) => y.segel],
  ];
  for (const [geo, mat, nimm] of teile) {
    const liste = yachten.filter(nimm);
    const mesh = new THREE.InstancedMesh(geo, mat, liste.length);
    liste.forEach((y, i) => {
      m.compose(new THREE.Vector3(y.x, 0.05, y.z), q.setFromAxisAngle(hoch, y.w), new THREE.Vector3(y.groesse, y.groesse, y.groesse));
      mesh.setMatrixAt(i, m);
    });
    mesh.castShadow = true;
    gruppe.add(mesh);
  }
}

// =============================================================
//  SCHIFFE AUF DEM RHEIN 🚢 – lange Frachtschiffe und ein Ausflugsschiff
// =============================================================
// Der Umriss eines Schiffs von oben: hinten rund, vorne spitz zulaufend
function rumpfForm(L, B, bug) {
  const s = new THREE.Shape(), h = L / 2, b = B / 2, r = Math.min(2, b * 0.6);
  s.moveTo(-h + r, -b);
  s.lineTo(h - bug, -b);
  s.bezierCurveTo(h - bug * 0.3, -b, h, -b * 0.45, h, 0);
  s.bezierCurveTo(h, b * 0.45, h - bug * 0.3, b, h - bug, b);
  s.lineTo(-h + r, b);
  s.quadraticCurveTo(-h, b, -h, b - r);
  s.lineTo(-h, -b + r);
  s.quadraticCurveTo(-h, -b, -h + r, -b);
  return s;
}
function rumpf(L, B, H, unten, bug = 10, rund = 0.35) {
  const geo = new THREE.ExtrudeGeometry(rumpfForm(L, B, bug), { depth: H, bevelEnabled: true, bevelThickness: rund, bevelSize: rund, bevelSegments: 2, curveSegments: 10 });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, unten, 0);
  return geo;
}

// Eine Wellblech-Textur für Container (Streifen)
function baueWellblech() {
  const c = leinwand(64), g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 64, 64);
  for (let x = 0; x < 64; x += 8) { g.fillStyle = 'rgba(0,0,0,0.16)'; g.fillRect(x, 0, 3, 64); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(6, 1);
  return t;
}

// Das Kielwasser: ein weißer, schäumender Streifen hinter dem Schiff
function baueKielwasser() {
  const c = leinwand(64, 256), g = c.getContext('2d'), z = zufallMitSeed(8);
  const bild = g.createImageData(64, 256), d = bild.data;
  for (let y = 0; y < 256; y++) for (let x = 0; x < 64; x++) {
    const v = y / 255, u = Math.abs(x / 63 - 0.5) * 2;
    const rand = Math.exp(-Math.pow((u - 0.85 + v * 0.1) * 6, 2)); // zwei helle Linien außen
    const mitte = Math.exp(-u * u * 6) * 0.7; // Schaum in der Mitte
    const a = Math.pow(1 - v, 1.6) * Math.min(1, rand + mitte) * (0.55 + z() * 0.45);
    const k = (y * 64 + x) * 4;
    d[k] = d[k + 1] = d[k + 2] = 255;
    d[k + 3] = a * 255;
  }
  g.putImageData(bild, 0, 0);
  return new THREE.CanvasTexture(c);
}

function baueFlagge() {
  const c = leinwand(48, 32), g = c.getContext('2d');
  [['#000000', 0], ['#dd0000', 11], ['#ffce00', 22]].forEach(([f, y]) => { g.fillStyle = f; g.fillRect(0, y, 48, 11); });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function baueSchiff(art, M) {
  const schiff = new THREE.Group();
  const add = (geo, mat, x = 0, y = 0, z = 0) => {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    schiff.add(mesh);
    return mesh;
  };
  const z = zufallMitSeed(art.length * 7 + 3);
  let L, B;
  if (art === 'ausflug') {
    // Das Ausflugsschiff: weiß, zwei Decks mit langen Fensterreihen
    L = 64; B = 11;
    add(rumpf(L, B, 2.8, -1.6, 14), M.weiss);
    add(rumpf(L - 0.2, B - 0.1, 0.5, 0.4, 14, 0.45), M.blau);
    add(new RoundedBoxGeometry(48, 2.7, 9.6, 3, 0.8), M.weiss, -3, 2.9, 0);
    add(new RoundedBoxGeometry(48.3, 1.15, 9.9, 3, 0.5), M.glas, -3, 3.05, 0);
    add(new RoundedBoxGeometry(36, 2.4, 9, 3, 0.8), M.weiss, -7, 5.4, 0);
    add(new RoundedBoxGeometry(36.3, 1.05, 9.3, 3, 0.45), M.glas, -7, 5.55, 0);
    add(new RoundedBoxGeometry(5, 2, 7, 3, 0.7), M.weiss, 9, 7.6, 0);
    add(new RoundedBoxGeometry(5.2, 0.9, 7.2, 3, 0.4), M.glas, 9, 7.8, 0);
    add(new THREE.CylinderGeometry(0.9, 1.1, 3, 16), M.blau, -20, 7.9, 0);
    for (const s of [-1, 1]) add(new RoundedBoxGeometry(34, 0.9, 0.12, 1, 0.05), M.weiss, -8, 7.1, s * 4.4);
  } else {
    // Ein Frachtschiff: 85 Meter lang! Dunkler Rumpf, hinten das Steuerhaus
    L = 86; B = 9.6;
    const rumpfMat = art === 'container' ? M.rumpfBlau : M.rumpfRot;
    add(rumpf(L, B, 4, -2.6, 9), rumpfMat);
    add(rumpf(L - 0.1, B - 0.05, 0.55, 0.85, 9, 0.42), M.weiss);
    const h = L / 2;
    // Das Steuerhaus mit Fensterband, und oben drauf die Brücke
    add(new RoundedBoxGeometry(8, 2.8, 8.8, 3, 0.7), M.weiss, -h + 7, 3.1, 0);
    add(new RoundedBoxGeometry(8.2, 0.8, 9.0, 3, 0.35), M.glas, -h + 7, 3.4, 0);
    add(new RoundedBoxGeometry(4.6, 2.3, 7, 3, 0.7), M.weiss, -h + 7.5, 5.6, 0);
    add(new RoundedBoxGeometry(4.8, 1.0, 7.2, 3, 0.4), M.glas, -h + 7.5, 5.9, 0);
    // Das Auto vom Kapitän steht hinten an Deck 🚗
    add(mergeGeometries([new RoundedBoxGeometry(4.2, 1.0, 1.8, 2, 0.35).translate(0, 0.5, 0), new RoundedBoxGeometry(2.3, 0.8, 1.6, 2, 0.35).translate(-0.3, 1.3, 0)]), M.autoRot, -h + 14.5, 1.75, 2.4);
    // Flagge am Heck
    add(new THREE.CylinderGeometry(0.06, 0.06, 4, 6), M.grau, -h + 0.8, 3.7, 0);
    const flagge = add(new THREE.PlaneGeometry(1.4, 0.95), M.flagge, -h + 0.1, 5.1, 0);
    flagge.rotation.y = Math.PI / 2;
    flagge.castShadow = false;
    if (art === 'container') {
      // Bunte Container, zwei oder drei Stockwerke hoch
      const liste = [];
      for (let i = 0; i < 5; i++) for (let j = -1; j <= 1; j++) for (let k = 0; k < 3; k++) {
        if (k === 2 && z() < 0.6) continue;
        liste.push([-h + 22 + i * 12.6, 1.75 + 1.3 + k * 2.6, j * 2.5]);
      }
      const box = new THREE.InstancedMesh(new RoundedBoxGeometry(12.2, 2.55, 2.42, 2, 0.12), M.container, liste.length);
      const farben = ['#c23b2e', '#2c5f9e', '#e07b2a', '#3f7d4a', '#8a8f96', '#e9e6df', '#7a2f5c', '#d9b13b'];
      const m = new THREE.Matrix4();
      liste.forEach((p, i) => {
        box.setMatrixAt(i, m.makeTranslation(...p));
        box.setColorAt(i, new THREE.Color(farben[Math.floor(z() * farben.length)]));
      });
      box.castShadow = true;
      schiff.add(box);
    } else {
      // Ladeluken (darunter ist Sand oder Kohle)
      for (let i = 0; i < 9; i++) add(new RoundedBoxGeometry(6.9, 1.1, 8.4, 2, 0.45), M.luke, -h + 17.5 + i * 7.1, 2.25, 0);
    }
  }
  // Kielwasser hinter dem Schiff
  const kiel = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).rotateY(-Math.PI / 2), M.kiel);
  kiel.scale.set(70, 1, B * 1.6);
  kiel.position.set(-L / 2 - 35, 0.18, 0);
  kiel.renderOrder = 2;
  schiff.add(kiel);
  schiff.userData.laenge = L;
  return schiff;
}

// Die Fahrspur eines Schiffs: immer im gleichen Abstand zum Ufer
function berechneSpur(plan, abstand) {
  const d = new THREE.Vector2(0.928, -0.372).normalize(); // so fließt der Rhein hier (nach Nordosten)
  const n = new THREE.Vector2(-d.y, d.x).multiplyScalar(-1); // vom Ufer weg in den Fluss (Nordwesten)
  const punkte = [];
  for (let s = -680; s <= 680; s += 20) {
    for (let t = -320; t < 700; t += 3) {
      const x = d.x * s + n.x * t, z = d.y * s + n.y * t;
      if (Math.abs(x) > HALB - 2 || Math.abs(z) > HALB - 2) continue;
      if (plan.feld(x, z).wasser && plan.zumLand(x, z) >= abstand) { punkte.push(new THREE.Vector2(x, z)); break; }
    }
  }
  if (punkte.length < 4) return null;
  // Glätten, damit das Schiff nicht wackelt
  for (let runde = 0; runde < 3; runde++) {
    for (let i = 1; i < punkte.length - 1; i++) punkte[i] = punkte[i - 1].clone().add(punkte[i + 1]).multiplyScalar(0.25).addScaledVector(punkte[i], 0.5);
  }
  // An beiden Enden weiterfahren – weit in den Dunst hinein
  const vorne = punkte[punkte.length - 1].clone().sub(punkte[punkte.length - 3]).normalize();
  const hinten = punkte[0].clone().sub(punkte[2]).normalize();
  punkte.push(punkte[punkte.length - 1].clone().addScaledVector(vorne, 450));
  punkte.unshift(punkte[0].clone().addScaledVector(hinten, 450));
  const laengen = [0];
  for (let i = 1; i < punkte.length; i++) laengen.push(laengen[i - 1] + punkte[i].distanceTo(punkte[i - 1]));
  return { punkte, laengen, gesamt: laengen[laengen.length - 1] };
}

function aufDerSpur(spur, s) {
  const { punkte, laengen } = spur;
  let i = 1;
  while (i < laengen.length - 1 && laengen[i] < s) i++;
  const a = punkte[i - 1], b = punkte[i], f = (s - laengen[i - 1]) / Math.max(laengen[i] - laengen[i - 1], 1e-3);
  return { x: a.x + (b.x - a.x) * f, z: a.y + (b.y - a.y) * f, w: Math.atan2(b.y - a.y, b.x - a.x) };
}

function baueSchiffe(gruppe, plan) {
  const M = {
    weiss: new THREE.MeshStandardMaterial({ color: '#f3f4f1', roughness: 0.45 }),
    blau: new THREE.MeshStandardMaterial({ color: '#2a5ea8', roughness: 0.45 }),
    glas: new THREE.MeshStandardMaterial({ color: '#1c2833', roughness: 0.1, metalness: 0.7 }),
    rumpfBlau: new THREE.MeshStandardMaterial({ color: '#23324a', roughness: 0.6 }),
    rumpfRot: new THREE.MeshStandardMaterial({ color: '#7d2a24', roughness: 0.6 }),
    luke: new THREE.MeshStandardMaterial({ color: '#8c9a8c', roughness: 0.6 }),
    grau: new THREE.MeshStandardMaterial({ color: '#9aa0a6' }),
    autoRot: new THREE.MeshStandardMaterial({ color: '#c0392b', roughness: 0.3, metalness: 0.5 }),
    container: new THREE.MeshStandardMaterial({ map: baueWellblech(), roughness: 0.6 }),
    flagge: new THREE.MeshStandardMaterial({ map: baueFlagge(), side: THREE.DoubleSide }),
    kiel: new THREE.MeshBasicMaterial({ map: baueKielwasser(), transparent: true, depthWrite: false, opacity: 0.75, polygonOffset: true, polygonOffsetFactor: -2 }),
  };
  const spuren = new Map();
  const schiffe = [];
  for (const s of E().schiffe) {
    if (!spuren.has(s.spur)) spuren.set(s.spur, berechneSpur(plan, s.spur));
    const spur = spuren.get(s.spur);
    if (!spur) continue;
    const modell = baueSchiff(s.art, M);
    gruppe.add(modell);
    schiffe.push({ ...s, modell, spur, weg: s.start * spur.gesamt, zeit: Math.random() * 10 });
  }
  return (dt) => {
    for (const s of schiffe) {
      s.zeit += dt;
      s.weg += s.tempo * s.richtung * dt;
      if (s.weg > s.spur.gesamt) s.weg = 0;
      if (s.weg < 0) s.weg = s.spur.gesamt;
      const p = aufDerSpur(s.spur, s.weg);
      s.modell.position.set(p.x, Math.sin(s.zeit * 0.7) * 0.08, p.z);
      s.modell.rotation.set(Math.sin(s.zeit * 0.5) * 0.008, -(p.w + (s.richtung < 0 ? Math.PI : 0)), 0, 'YXZ');
    }
  };
}

// =============================================================
//  ALLES ZUSAMMEN
// =============================================================
// frei(x, z) = darf hier etwas hin? (lokal, z. B. nicht da, wo das Ruderboot liegt)
export function baueDuesseldorf(szene, plan, { hindernisse, frei = () => true, tuerWinkel = 0 } = {}) {
  const gruppe = new THREE.Group();
  gruppe.position.set(STADT.x, 0, STADT.z);
  szene.add(gruppe);
  baueBoden(plan, gruppe);
  baueHaeuser(gruppe);
  gruppe.add(baueRheinturm(tuerWinkel));
  // Durch den Glas-Eingang am Turm kann man nicht durchlaufen
  if (hindernisse) for (const r of [11, 15]) hindernisse.hinzufuegen(STADT.x + Math.sin(tuerWinkel) * r, STADT.z + Math.cos(tuerWinkel) * r, 4.6);
  const autosFahren = baueBruecke(gruppe, plan);
  const laternen = baueLaternenUndBaenke(gruppe, plan);
  baueYachthafen(gruppe, plan, frei);
  const schiffeFahren = baueSchiffe(gruppe, plan);
  // Bäume und Gras (Weltkoordinaten, weil natur.js sie wie auf der Insel verwaltet)
  const { baeume, gras } = sammleBaeume(plan, laternen);
  const welt = (p) => ({ ...p, x: STADT.x + p.x, z: STADT.z + p.z, y: plan.hoehe(p.x, p.z) });
  baueStadtNatur(szene, baeume.map(welt), gras.map(welt));
  if (hindernisse) for (const b of baeume) hindernisse.hinzufuegen(STADT.x + b.x, STADT.z + b.z, 0.5 * b.groesse);
  return {
    gruppe,
    aktualisiere(dt) {
      schiffeFahren(dt);
      autosFahren(dt);
    },
  };
}
