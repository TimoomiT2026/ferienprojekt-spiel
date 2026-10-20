// =============================================================
//  DER JUNGE – unsere Spielfigur, ein junger Forscher
//
//  Er ist komplett aus runden Formen gebaut (Kugeln, Röhren, Drehkörper).
//  Damit er sich bewegen kann, hat er ein SKELETT aus "Knochen" (Bones),
//  genau wie in echten Spielen: Hüfte, Bauch, Brust, Hals, Kopf,
//  Schultern, Ellbogen, Hände, Beine, Knie und Füße.
//  Jeder Punkt der Figur weiß, an welchem Knochen er hängt.
//  Dreht sich ein Knochen, dreht sich das Stück Figur mit.
//  Das Ganze ist EIN Modell mit nur 4 Materialien = 4 Draw Calls.
//
//  Alle Maße sind in echten Metern (der Junge ist ca. 1,36 m groß).
//  Im Spiel wird er dann mit GROESSE vergrößert.
// =============================================================
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// So viel größer ist er in der Spielwelt (die Welt ist etwas "comic-groß")
export const GROESSE = 1.7;

// Die Standard-Farben (vom Papa nach Fotos ausgesucht).
// Man kann jede davon ändern: baueJunge({ haare: '#e0b060' })
export const JUNGE_FARBEN = {
  haut: '#f1c9a8',
  haare: '#6b4a2e', // Grundfarbe der Haare
  haarSpitzen: '#a07a52', // hellere Spitzen und Strähnen
  augen: '#5a3b22', // Farbe der Iris
  shirt: '#b3202a', // Pulli: erste Streifen-Farbe
  shirt2: '#1a1f33', // Pulli: zweite Streifen-Farbe (null = ohne Streifen)
  streifen: 15, // wie viele Streifen vom Saum bis zum Kragen
  hose: '#1c1d22',
  hosenStreifen: '#dfe8f2', // Streifen an der Hosen-Seite (null = keine)
  hosenStreifen2: '#8fb3d9',
  schuhe: '#55606e',
  schuhe2: '#252b3a', // Kappe vorne und Ferse
  sohle: '#f08a1c',
  schnuersenkel: '#141414',
  rucksack: '#c0392b',
};

// ---------- kleine Helfer ----------
const V = (x, y, z) => new THREE.Vector3(x, y, z);
function matrix(pos, rot = [0, 0, 0], skala = [1, 1, 1]) {
  return new THREE.Matrix4().compose(
    pos,
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rot[0], rot[1], rot[2])),
    V(skala[0], skala[1], skala[2])
  );
}
const glatt = (a, b, x) => {
  const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
// Zufall, der jedes Mal gleich ist (damit die Haare immer gleich aussehen)
function zufallMitStart(start) {
  let s = start;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

// ---------- Das Skelett ----------
// [Name, Eltern-Knochen, Position in Metern (absolut, im Stehen)]
const KNOCHEN_PLAN = [
  ['huefte', null, [0, 0.7, 0]],
  ['bauch', 'huefte', [0, 0.82, 0]],
  ['brust', 'bauch', [0, 0.96, 0]],
  ['hals', 'brust', [0, 1.06, 0]],
  ['kopf', 'hals', [0, 1.13, 0]],
  ['schulterL', 'brust', [-0.158, 1.025, 0]],
  ['ellbogenL', 'schulterL', [-0.158, 0.805, 0]],
  ['handL', 'ellbogenL', [-0.158, 0.625, 0]],
  ['schulterR', 'brust', [0.158, 1.025, 0]],
  ['ellbogenR', 'schulterR', [0.158, 0.805, 0]],
  ['handR', 'ellbogenR', [0.158, 0.625, 0]],
  ['beinL', 'huefte', [-0.068, 0.655, 0]],
  ['knieL', 'beinL', [-0.068, 0.37, 0]],
  ['fussL', 'knieL', [-0.068, 0.085, 0]],
  ['beinR', 'huefte', [0.068, 0.655, 0]],
  ['knieR', 'beinR', [0.068, 0.37, 0]],
  ['fussR', 'knieR', [0.068, 0.085, 0]],
];
export const BEIN_LAENGE = 0.285; // Oberschenkel = Unterschenkel (Meter)

function baueSkelett() {
  const liste = [];
  const nr = {}; // Name -> Nummer
  const abs = {}; // Name -> Position
  for (const [name, eltern, p] of KNOCHEN_PLAN) {
    const b = new THREE.Bone();
    b.name = name;
    abs[name] = V(...p);
    if (eltern) {
      b.position.copy(abs[name]).sub(abs[eltern]);
      liste[nr[eltern]].add(b);
    } else {
      b.position.copy(abs[name]);
    }
    nr[name] = liste.length;
    liste.push(b);
  }
  return { liste, nr, abs };
}

// Zwischen mehreren Knochen weich überblenden (z. B. Bauch → Brust)
function kette(y, punkte) {
  if (y <= punkte[0][0]) return [[punkte[0][1], 1]];
  for (let i = 0; i < punkte.length - 1; i++) {
    const [y0, b0] = punkte[i], [y1, b1] = punkte[i + 1];
    if (y <= y1) {
      const t = glatt(y0, y1, y);
      return [[b0, 1 - t], [b1, t]];
    }
  }
  return [[punkte[punkte.length - 1][1], 1]];
}

// ---------- Der Bauplan sammelt alle Einzelteile ----------
class Bauplan {
  constructor() {
    this.teile = { haut: [], shirt: [], hose: [], rest: [] };
  }
  // art = welches Material, geo = Form, mtx = wohin damit,
  // knochen = Nummer oder Funktion, farbe = Farbe oder Funktion, uv = Funktion
  add(art, geo, mtx, knochen, farbe = null, uv = null) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    const pos = g.attributes.position;
    const n = pos.count;
    const farben = new Float32Array(n * 3);
    const uvs = new Float32Array(n * 2);
    const si = new Uint16Array(n * 4);
    const sw = new Float32Array(n * 4);
    const lokal = V(0, 0, 0), welt = V(0, 0, 0);
    const weiss = new THREE.Color(1, 1, 1);
    for (let i = 0; i < n; i++) {
      lokal.fromBufferAttribute(pos, i);
      welt.copy(lokal).applyMatrix4(mtx);
      const c = typeof farbe === 'function' ? farbe(lokal, welt) : farbe || weiss;
      farben.set([c.r, c.g, c.b], i * 3);
      const k = typeof knochen === 'function' ? knochen(welt, lokal) : [[knochen, 1]];
      for (let j = 0; j < Math.min(4, k.length); j++) {
        si[i * 4 + j] = k[j][0];
        sw[i * 4 + j] = k[j][1];
      }
      if (uv) uvs.set(uv(lokal, welt), i * 2);
    }
    const neu = new THREE.BufferGeometry();
    neu.setAttribute('position', pos.clone());
    neu.setAttribute('normal', g.attributes.normal.clone());
    neu.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    neu.setAttribute('color', new THREE.BufferAttribute(farben, 3));
    neu.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
    neu.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
    neu.applyMatrix4(mtx);
    this.teile[art].push(neu);
  }
}

// Ein Drehkörper (wie auf der Töpferscheibe): Liste aus [Radius, Höhe]
function dreh(punkte, segmente = 20) {
  return new THREE.LatheGeometry(punkte.map(([r, y]) => new THREE.Vector2(r, y)), segmente);
}
const kugel = (r = 1, w = 16, h = 12) => new THREE.SphereGeometry(r, w, h);

// ---------- Stoff-Bilder (Texturen) selber malen ----------
function streifenTextur(f) {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = f.shirt;
  g.fillRect(0, 0, 64, 32);
  g.fillStyle = f.shirt2 || f.shirt;
  g.fillRect(0, 32, 64, 32);
  // Ein bisschen "Fleece"-Rauschen, damit es nach Stoff aussieht
  const zufall = zufallMitStart(7);
  for (let i = 0; i < 900; i++) {
    g.fillStyle = zufall() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.07)';
    g.fillRect(Math.floor(zufall() * 64), Math.floor(zufall() * 64), 1, 1);
  }
  return fertigeTextur(c);
}

function hosenTextur(f) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 16;
  const g = c.getContext('2d');
  g.fillStyle = f.hose;
  g.fillRect(0, 0, 128, 16);
  // Die zwei Streifen an der Außenseite (in der Mitte des Bildes)
  if (f.hosenStreifen) {
    g.fillStyle = f.hosenStreifen;
    g.fillRect(57, 0, 4, 16);
    g.fillStyle = f.hosenStreifen2 || f.hosenStreifen;
    g.fillRect(64, 0, 4, 16);
  }
  const zufall = zufallMitStart(11);
  for (let i = 0; i < 300; i++) {
    g.fillStyle = zufall() < 0.5 ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.08)';
    g.fillRect(Math.floor(zufall() * 128), Math.floor(zufall() * 16), 1, 1);
  }
  return fertigeTextur(c);
}

function fertigeTextur(canvas) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

// =============================================================
//  baueJunge(farben) – baut den Jungen
//  Rückgabe: figur (Gruppe: Füße am Boden, +z = vorne) und die Knochen
// =============================================================
export function baueJunge(farben = {}) {
  const f = { ...JUNGE_FARBEN, ...farben };
  const C = (hex) => new THREE.Color(hex);
  const { liste: knochen, nr: K, abs } = baueSkelett();
  const plan = new Bauplan();

  const haut = C(f.haut);
  const haare = C(f.haare), spitzen = C(f.haarSpitzen);

  // ---------- Pulli (Streifen laufen waagerecht um den Körper) ----------
  const streifenHoehe = (1.07 - 0.645) / f.streifen; // so hoch ist ein Streifen
  const shirtUV = (l, w) => [Math.atan2(w.x, w.z) / (Math.PI * 2), w.y / (streifenHoehe * 2)];

  // Oberkörper als Drehkörper, vorne/hinten etwas flacher
  const rumpf = dreh([
    [0.112, 0.64], [0.126, 0.646], [0.129, 0.664], [0.123, 0.7], [0.12, 0.76], [0.123, 0.84],
    [0.13, 0.92], [0.13, 0.97], [0.124, 1.008], [0.108, 1.038], [0.08, 1.058], [0.052, 1.068],
  ], 28);
  plan.add('shirt', rumpf, matrix(V(0, 0, 0), [0, 0, 0], [1, 1, 0.74]),
    (w) => kette(w.y, [[0.7, K.huefte], [0.84, K.bauch], [0.97, K.brust]]), null, shirtUV);

  // Stehkragen (Mock-Neck)
  const kragen = dreh([[0.05, 1.04], [0.05, 1.07], [0.047, 1.094], [0.044, 1.1], [0.039, 1.098], [0.037, 1.06]], 20);
  plan.add('shirt', kragen, matrix(V(0, 0, -0.004), [0, 0, 0], [1, 1, 0.9]),
    (w) => kette(w.y, [[1.05, K.brust], [1.09, K.hals]]), null, shirtUV);

  // Arme: Schulterkugel, Ärmel oben, Ellbogenkugel, Ärmel unten mit Bündchen
  for (const seite of ['L', 'R']) {
    const s = seite === 'L' ? -1 : 1;
    const sch = abs['schulter' + seite], ell = abs['ellbogen' + seite], hand = abs['hand' + seite];
    plan.add('shirt', kugel(0.052, 16, 12), matrix(sch), K['schulter' + seite], null, shirtUV);
    const oben = dreh([[0.03, 0.03], [0.046, 0.005], [0.044, -0.06], [0.04, -0.15], [0.037, -0.22]], 16);
    plan.add('shirt', oben, matrix(sch), K['schulter' + seite], null, shirtUV);
    plan.add('shirt', kugel(0.038, 12, 10), matrix(ell), K['ellbogen' + seite], null, shirtUV);
    const unten = dreh([[0.037, 0.0], [0.035, -0.08], [0.032, -0.148], [0.035, -0.152], [0.034, -0.176], [0.024, -0.18], [0.02, -0.17]], 16);
    plan.add('shirt', unten, matrix(ell), K['ellbogen' + seite], null, shirtUV);

    // Hand: Handgelenk, Handfläche, Finger (leicht gekrümmt) und Daumen
    const hk = K['hand' + seite];
    plan.add('haut', new THREE.CylinderGeometry(0.021, 0.022, 0.04, 10), matrix(V(hand.x, hand.y + 0.005, hand.z)), hk, haut);
    plan.add('haut', kugel(1, 12, 10), matrix(V(hand.x, hand.y - 0.042, hand.z + 0.002), [0, 0, 0], [0.019, 0.04, 0.033]), hk, haut);
    plan.add('haut', kugel(1, 12, 10), matrix(V(hand.x - s * 0.002, hand.y - 0.078, hand.z + 0.008), [-0.3, 0, 0], [0.017, 0.034, 0.029]), hk, haut);
    plan.add('haut', new THREE.CapsuleGeometry(0.0095, 0.026, 4, 8), matrix(V(hand.x - s * 0.008, hand.y - 0.038, hand.z + 0.03), [-0.55, 0, s * 0.25]), hk, haut);
  }

  // ---------- Hose (Jogginghose mit Seitenstreifen) ----------
  // Becken
  const becken = dreh([[0.0, 0.585], [0.05, 0.592], [0.095, 0.612], [0.118, 0.645], [0.122, 0.69], [0.118, 0.75], [0.112, 0.78]], 24);
  plan.add('hose', becken, matrix(V(0, 0, 0), [0, 0, 0], [1, 1, 0.78]),
    (w) => kette(w.y, [[0.72, K.huefte], [0.8, K.bauch]]), null, () => [0.02, 0]);

  for (const seite of ['L', 'R']) {
    const s = seite === 'L' ? -1 : 1;
    // u = 0.5 genau an der Außenseite des Beins – da sind die Streifen
    const hosenUV = (l) => [0.5 + Math.atan2(l.z, l.x * s) / (Math.PI * 2), l.y * 4];
    const bein = abs['bein' + seite], knie = abs['knie' + seite], fuss = abs['fuss' + seite];
    const ober = dreh([[0.045, 0.07], [0.06, 0.03], [0.062, -0.03], [0.058, -0.13], [0.052, -0.22], [0.048, -0.285]], 18);
    plan.add('hose', ober, matrix(bein), K['bein' + seite], null, hosenUV);
    plan.add('hose', kugel(0.049, 14, 10), matrix(knie), K['knie' + seite], null, hosenUV);
    const unter = dreh([[0.048, 0.0], [0.047, -0.08], [0.042, -0.17], [0.037, -0.226], [0.039, -0.232], [0.037, -0.268], [0.032, -0.274], [0.02, -0.276]], 18);
    plan.add('hose', unter, matrix(knie), K['knie' + seite], null, hosenUV);

    // ---------- Turnschuh ----------
    const fk = K['fuss' + seite];
    const boden = -fuss.y; // so weit unter dem Knöchel ist der Boden
    // Sohle: ein Fußabdruck, der hochgezogen wird (vorne breiter als hinten)
    const umriss = new THREE.Shape();
    for (let i = 0; i <= 28; i++) {
      const t = (i / 28) * Math.PI * 2;
      const z = 0.04 + Math.cos(t) * 0.1;
      const breite = 0.032 + 0.012 * glatt(-0.06, 0.1, z) - 0.006 * glatt(0.11, 0.14, z);
      const x = Math.sin(t) * breite;
      if (i === 0) umriss.moveTo(x, z);
      else umriss.lineTo(x, z);
    }
    const sohle = new THREE.ExtrudeGeometry(umriss, { depth: 0.016, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.005, bevelSegments: 2, curveSegments: 4 });
    sohle.rotateX(Math.PI / 2);
    plan.add('rest', sohle, matrix(V(fuss.x, fuss.y + boden + 0.022, fuss.z)), fk, C(f.sohle));
    // Obermaterial
    const schuhFarbe = C(f.schuhe), kappe = C(f.schuhe2);
    plan.add('rest', kugel(1, 16, 12), matrix(V(fuss.x, fuss.y + boden + 0.028, fuss.z + 0.035), [0.05, 0, 0], [0.041, 0.056, 0.098]), fk,
      (l) => (l.y < -0.1 ? kappe : schuhFarbe));
    // Kappe vorne und Ferse in Dunkelblau
    plan.add('rest', kugel(1, 14, 10), matrix(V(fuss.x, fuss.y + boden + 0.034, fuss.z + 0.083), [0, 0, 0], [0.04, 0.028, 0.055]), fk, kappe);
    plan.add('rest', kugel(1, 14, 10), matrix(V(fuss.x, fuss.y + boden + 0.045, fuss.z - 0.03), [0, 0, 0], [0.039, 0.042, 0.04]), fk, kappe);
    // Schnürsenkel: drei kleine Querstriche auf dem Spann
    for (let i = 0; i < 3; i++) {
      const z = 0.04 + i * 0.018;
      const y = boden + 0.028 + 0.056 * Math.sqrt(Math.max(0, 1 - ((z - 0.035) / 0.098) ** 2)) - 0.002;
      plan.add('rest', new THREE.CapsuleGeometry(0.0035, 0.03, 2, 6), matrix(V(fuss.x, fuss.y + y, fuss.z + z), [0.5, 0, Math.PI / 2]), fk, C(f.schnuersenkel));
    }
  }

  // ---------- Hals und Kopf ----------
  plan.add('haut', new THREE.CylinderGeometry(0.033, 0.036, 0.12, 14, 1, true), matrix(V(0, 1.105, -0.004)),
    (w) => kette(w.y, [[1.07, K.hals], [1.14, K.kopf]]), haut);

  const kk = K.kopf;
  const kopfMitte = V(0, 1.232, -0.004); // Schädel
  const gesicht = V(0, 1.198, 0.018); // Wangen und Kinn
  const rot = C('#eb9a86');
  // Etwas rosige Wangen: die Hautfarbe wird um zwei Punkte herum rötlicher
  const wangen = [V(-0.058, 1.183, 0.088), V(0.058, 1.183, 0.088)];
  const hautMitWangen = (l, w) => {
    let m = 0;
    for (const p of wangen) m = Math.max(m, 1 - w.distanceTo(p) / 0.032);
    return haut.clone().lerp(rot, Math.max(0, m) * 0.4);
  };
  plan.add('haut', kugel(0.116, 28, 20), matrix(kopfMitte, [0, 0, 0], [0.98, 1, 1]), kk, hautMitWangen);
  plan.add('haut', kugel(0.094, 24, 16), matrix(gesicht, [0, 0, 0], [1.04, 0.94, 0.98]), kk, hautMitWangen);
  // Ohren (fast ganz unter den Haaren versteckt)
  for (const s of [-1, 1]) {
    plan.add('haut', kugel(1, 12, 10), matrix(V(s * 0.111, 1.212, 0.004), [0, s * 0.3, 0], [0.014, 0.032, 0.024]), kk, haut);
  }
  // Nase
  plan.add('haut', kugel(1, 12, 10), matrix(V(0, 1.19, 0.111), [0.2, 0, 0], [0.016, 0.014, 0.014]), kk, haut);

  // Augen: weiß, Iris, Pupille, Glanzpunkt. Sie sitzen auf der Gesichtskugel.
  const weiss = C('#fbfbf8'), iris = C(f.augen), pupille = C('#0d0a08');
  for (const s of [-1, 1]) {
    const gier = s * 0.42, nick = 0.16;
    const richtung = V(Math.sin(gier) * Math.cos(nick), Math.sin(nick), Math.cos(gier) * Math.cos(nick));
    const q = new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), richtung);
    const auf = (abstand) => gesicht.clone().add(richtung.clone().multiplyScalar(abstand));
    const setze = (geo, abstand, skala, farbe, versatz = V(0, 0, 0)) => {
      const m = new THREE.Matrix4().compose(auf(abstand).add(versatz), q, V(...skala));
      plan.add('haut', geo, m, kk, farbe);
    };
    setze(kugel(1, 16, 12), 0.084, [0.023, 0.026, 0.012], weiss);
    setze(kugel(1, 14, 10), 0.0925, [0.0145, 0.016, 0.0045], iris);
    setze(kugel(1, 10, 8), 0.0955, [0.0075, 0.0085, 0.0025], pupille);
    setze(kugel(1, 8, 6), 0.0975, [0.0035, 0.0035, 0.0015], weiss, V(s * 0.004 + 0.004, 0.006, 0));
    // Augenbraue
    const braue = new THREE.CapsuleGeometry(0.004, 0.026, 2, 6);
    const bm = new THREE.Matrix4().compose(auf(0.094).add(V(0, 0.038, 0)), q.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, Math.PI / 2 + s * 0.12))), V(1, 1, 0.6));
    plan.add('haut', braue, bm, kk, haare);
  }
  // Lächelnder Mund: ein Stück von einem Ring
  const mund = new THREE.TorusGeometry(0.019, 0.0035, 6, 16, Math.PI - 1.3);
  plan.add('haut', mund, matrix(V(0, 1.172, 0.104), [-0.25, 0, Math.PI + 0.65]), kk, C('#a8524c'));

  // ---------- Die Haare: ein "Wuschel-Pilzkopf" ----------
  const hm = V(0, 1.236, -0.008); // Mitte der Haare
  // Kappe oben und eine Haube hinten/seitlich (bedeckt Ohren und Nacken)
  plan.add('rest', new THREE.SphereGeometry(0.124, 26, 12, 0, Math.PI * 2, 0, Math.PI * 0.43), matrix(hm, [0, 0, 0], [1.0, 0.99, 1.05]), kk, haare);
  plan.add('rest', new THREE.SphereGeometry(0.127, 24, 14, Math.PI * 0.86, Math.PI * 1.28, 0, Math.PI * 0.72), matrix(V(0, 1.232, -0.012), [0, 0, 0], [1.02, 1.0, 1.06]), kk, haare);

  // Eine Strähne: oben rund, unten spitz, flach wie ein Blatt
  const straehneGeo = dreh(
    Array.from({ length: 9 }, (_, i) => {
      const t = i / 8;
      return [0.5 * Math.pow(1 - t, 0.85) * Math.min(1, 0.4 + t * 3), -t];
    }),
    7
  );
  const zufall = zufallMitStart(42);
  const richtung = (a, e) => V(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e));
  // a = rundherum (0 = vorne), eOben/eUnten = Höhe als Winkel, rO/rU = Abstand zur Mitte
  const straehne = (a, eOben, eUnten, breite, rO, rU, dicke = 0.022) => {
    const wurzel = hm.clone().add(richtung(a, eOben).multiplyScalar(rO));
    const spitze = hm.clone().add(richtung(a, eUnten).multiplyScalar(rU));
    const d = spitze.clone().sub(wurzel);
    const laenge = d.length() * 1.12;
    d.normalize();
    const mitte = wurzel.clone().lerp(spitze, 0.5).sub(hm).normalize();
    const seite = mitte.clone().cross(d).normalize();
    const normal = d.clone().negate().cross(seite).negate().normalize();
    const m = new THREE.Matrix4().makeBasis(seite, d.clone().negate(), normal);
    m.scale(V(breite, laenge, dicke));
    m.setPosition(wurzel);
    const hell = 0.55 + zufall() * 0.45;
    plan.add('rest', straehneGeo, m, kk, (l) => haare.clone().lerp(spitzen, Math.pow(-l.y, 1.6) * hell));
  };
  const zz = () => (zufall() - 0.5);
  // Pony: fällt vorne in die Stirn
  for (let i = 0; i < 9; i++) {
    const a = -0.95 + (i / 8) * 1.9 + zz() * 0.1;
    straehne(a, 1.0 + zz() * 0.1, 0.36 + Math.abs(a) * 0.12 + zz() * 0.06, 0.062, 0.118, 0.137);
  }
  // Seiten: über die Ohren
  for (const s of [-1, 1]) {
    for (let i = 0; i < 5; i++) {
      const a = s * (1.05 + i * 0.22 + zz() * 0.06);
      straehne(a, 0.9 + zz() * 0.1, -0.32 - i * 0.05 + zz() * 0.06, 0.07, 0.122, 0.139);
    }
  }
  // Hinten: bis in den Nacken, schön voll
  for (let i = 0; i < 9; i++) {
    const a = Math.PI - 1.0 + (i / 8) * 2.0 + zz() * 0.06;
    straehne(a, 0.85 + zz() * 0.12, -0.78 + zz() * 0.08, 0.075, 0.125, 0.136, 0.026);
  }
  // Oben: ein paar wuschelige Büschel für Volumen
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + zz() * 0.3;
    straehne(a, 1.45 + zz() * 0.1, 0.62 + zz() * 0.2, 0.075, 0.118, 0.134, 0.03);
  }
  // Wirbel ganz oben
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.3;
    straehne(a, 1.57, 1.05 + zz() * 0.1, 0.06, 0.12, 0.13, 0.03);
  }

  // ---------- Der rote Rucksack (Forscher-Rucksack) ----------
  const rk = K.brust;
  const ruck = C(f.rucksack), ruckDunkel = ruck.clone().multiplyScalar(0.6), schnalle = C('#2a2a2a');
  plan.add('rest', new RoundedBoxGeometry(0.22, 0.27, 0.1, 3, 0.035), matrix(V(0, 0.89, -0.148), [-0.06, 0, 0]), rk, ruck);
  plan.add('rest', new RoundedBoxGeometry(0.16, 0.11, 0.045, 2, 0.018), matrix(V(0, 0.83, -0.203), [-0.06, 0, 0]), rk, ruck.clone().multiplyScalar(0.85));
  plan.add('rest', new RoundedBoxGeometry(0.21, 0.06, 0.11, 2, 0.022), matrix(V(0, 1.0, -0.143), [-0.1, 0, 0]), rk, ruckDunkel);
  plan.add('rest', new RoundedBoxGeometry(0.03, 0.03, 0.012, 1, 0.005), matrix(V(0, 0.965, -0.2), [-0.06, 0, 0]), rk, schnalle);
  // Träger über die Schultern (vorne sieht man sie auf der Brust)
  for (const s of [-1, 1]) {
    const kurve = new THREE.CatmullRomCurve3([
      V(s * 0.07, 0.97, -0.11), V(s * 0.085, 1.045, -0.06), V(s * 0.09, 1.065, 0.0),
      V(s * 0.085, 1.025, 0.075), V(s * 0.08, 0.93, 0.1), V(s * 0.085, 0.84, 0.093),
    ]);
    plan.add('rest', new THREE.TubeGeometry(kurve, 16, 0.01, 6, false), matrix(V(0, 0, 0), [0, 0, 0], [1, 1, 1]), rk, ruckDunkel);
  }

  // ---------- Alles zu EINEM Modell zusammenkleben ----------
  const shirtTex = streifenTextur(f);
  const hosenTex = hosenTextur(f);
  const materialien = {
    haut: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55 }),
    shirt: new THREE.MeshStandardMaterial({ map: shirtTex, roughness: 0.95 }),
    hose: new THREE.MeshStandardMaterial({ map: hosenTex, roughness: 0.8 }),
    rest: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72 }),
  };
  const arten = ['haut', 'shirt', 'hose', 'rest'];
  const geo = mergeGeometries(arten.map((a) => mergeGeometries(plan.teile[a], false)), true);

  const figur = new THREE.Group();
  figur.name = 'Junge';
  const modell = new THREE.Group();
  modell.scale.setScalar(GROESSE);
  figur.add(modell);
  const koerperMesh = new THREE.SkinnedMesh(geo, arten.map((a) => materialien[a]));
  koerperMesh.add(knochen[0]);
  modell.add(koerperMesh);
  figur.updateMatrixWorld(true);
  koerperMesh.bind(new THREE.Skeleton(knochen));
  koerperMesh.castShadow = true;
  koerperMesh.frustumCulled = false;

  // Knochen mit Namen
  const kn = {};
  for (const b of knochen) kn[b.name] = b;

  // Halter für Werkzeuge in den Händen (wieder auf Spielwelt-Größe gebracht)
  const halter = (hand) => {
    const h = new THREE.Group();
    h.position.set(0, -0.06, 0.006);
    h.scale.setScalar(1 / GROESSE);
    hand.add(h);
    return h;
  };

  // "Stellvertreter" für alte Programmteile (z. B. das Boot), die
  // koerper und fussL/fussR verschieben wollen – die stören hier nicht.
  const koerper = new THREE.Object3D();
  koerper.position.y = 1.05;
  const fussL = new THREE.Object3D(), fussR = new THREE.Object3D();
  figur.add(koerper, fussL, fussR);

  return {
    figur,
    modell,
    mesh: koerperMesh,
    knochen: kn,
    armL: kn.schulterL,
    armR: kn.schulterR,
    handL: halter(kn.handL),
    handR: halter(kn.handR),
    koerper,
    fussL,
    fussR,
    materialien,
  };
}
