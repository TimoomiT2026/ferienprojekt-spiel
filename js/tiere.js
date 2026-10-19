// =============================================================
//  TIERE – Schafe und Hasen auf der Insel
//
//  Trick für das iPad: Alle Schafe teilen sich EINEN Körper, EINEN
//  Kopf und EIN Bein-Modell. Das wird ganz oft kopiert ("InstancedMesh").
//  So malt die Grafikkarte alle 30 Schafe mit nur 3 Pinselstrichen.
//
//  Jedes Tier hat ein "Gehirn" mit einem Zustand, z. B. "stehen",
//  "grasen" oder "laufen". Das nennt man einen Zustands-Automaten.
// =============================================================
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { EINSTELLUNGEN } from './einstellungen.js';
import { fbm, zufallMitSeed } from './rauschen.js';
import { bodenHoehe, istWald, abstandZumDorf, DORF } from './gelaende.js';

// ---------- Zahlen zum Rumprobieren ----------
// Wie viele Schaf-Herden gibt es?
const ANZAHL_HERDEN = 6;
// Wie viele Schafe sind in einer Herde? (kleinste und größte Zahl)
const SCHAFE_PRO_HERDE_MIN = 4;
const SCHAFE_PRO_HERDE_MAX = 6;
// Wie viele Hasen hoppeln auf der Insel herum?
const ANZAHL_HASEN = 16;
// Wie schnell laufen Schafe? (Meter pro Sekunde)
const SCHAF_TEMPO = 0.9;
// Ab welcher Entfernung (Meter) bekommt ein Hase Angst und flüchtet?
const HASE_ANGST_ABSTAND = 8;
// Wie weit weg (Meter) sieht man Tiere noch? Weiter weg = unsichtbar
const SICHTWEITE = 120;

const zufall = zufallMitSeed(2024); // eigener Seed: Tiere stehen immer am gleichen Ort
const R = EINSTELLUNGEN.inselGroesse;
const m4 = () => new THREE.Matrix4();
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------- Formen bauen ----------

// Gibt einer Form eine Farbe, damit man mehrere Teile zusammenkleben kann
// eigen = true: Diese Farbe bleibt immer so (z. B. das weiße Hasen-Schwänzchen),
// egal welche Fellfarbe das Tier hat.
function farbig(geo, farbe, eigen = false) {
  geo = geo.index ? geo : mergeVertices(geo);
  if (geo.attributes.uv) geo.deleteAttribute('uv');
  if (!geo.attributes.normal) geo.computeVertexNormals();
  const c = new THREE.Color(farbe);
  const n = geo.attributes.position.count;
  const farben = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    farben[i * 3] = c.r;
    farben[i * 3 + 1] = c.g;
    farben[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(farben, 3));
  geo.setAttribute('eigen', new THREE.BufferAttribute(new Float32Array(n).fill(eigen ? 1 : 0), 1));
  return geo;
}

// Bringt dem Material bei, "eigene" Farben nicht mit der Fellfarbe zu mischen
function mitEigenfarbe(material, name) {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = 'attribute float eigen;\n' + shader.vertexShader.replace(
      '#include <color_vertex>',
      `#include <color_vertex>
      #ifdef USE_INSTANCING_COLOR
        vColor.xyz = mix(vColor.xyz, color.xyz, eigen);
      #endif`
    );
  };
  material.customProgramCacheKey = () => 'tier-' + name;
  return material;
}

// Eine Kugel, die etwas verbeult ist – wie Wolle
function knubbelKugel(seed, breite, hoehe, staerke, kleine = 2.6) {
  let geo = new THREE.SphereGeometry(1, breite, hoehe);
  geo.deleteAttribute('uv');
  geo.deleteAttribute('normal');
  geo = mergeVertices(geo); // Nahtstellen zusammenkleben, damit es rund aussieht
  const p = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = fbm(v.x * kleine + seed, v.y * kleine + v.z * 1.7, 3, seed);
    v.multiplyScalar(1 - staerke / 2 + n * staerke);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

// Kugel, gestreckt und verschoben (für Köpfe, Ohren, Augen …)
function kugel(r, b, h, sx, sy, sz, x, y, z) {
  const g = new THREE.SphereGeometry(r, b, h);
  g.scale(sx, sy, sz);
  g.translate(x, y, z);
  return g;
}

// Ein Bein: oben ist der Drehpunkt (Hüfte), damit es schwingen kann
function beinForm(dicke, laenge, farbe) {
  const g = new THREE.CylinderGeometry(dicke, dicke * 0.8, laenge, 6, 1);
  g.translate(0, -laenge / 2 + dicke, 0);
  // Ein kleiner runder Huf unten dran
  const huf = new THREE.SphereGeometry(dicke * 0.95, 6, 3);
  huf.translate(0, -laenge + dicke, 0);
  return mergeGeometries([farbig(g, farbe), farbig(huf, farbe)]);
}

// Ein Hasenbein: ein gestrecktes Ei, oben ist der Drehpunkt
function hasenBein() {
  const g = new THREE.SphereGeometry(1, 6, 4);
  g.scale(0.035, 0.08, 0.042);
  g.translate(0, -0.075, 0);
  return farbig(g, '#ffffff');
}

// --- Das Schaf (schaut nach vorne = +z) ---
function schafKoerper() {
  // Ein Schaf ist wie eine kleine Wolke: ein runder Bauch mit vielen Woll-Bällchen drauf
  const bauch = knubbelKugel(7, 8, 6, 0.2, 2.5);
  bauch.scale(0.46, 0.4, 0.64);
  const teile = [farbig(bauch, '#ffffff')]; // die echte Farbe kommt pro Schaf dazu
  const zz = zufallMitSeed(99);
  const baelle = [
    [0, 0.33, 0.22], [0, 0.32, -0.25],
    [0.3, 0.2, 0.3], [-0.3, 0.2, 0.3], [0.33, 0.22, -0.1], [-0.33, 0.22, -0.1],
    [0.28, 0.1, -0.42], [-0.28, 0.1, -0.42], [0.36, -0.02, 0.1], [-0.36, -0.02, 0.1],
    [0, 0.1, -0.6],
  ];
  baelle.forEach(([x, y, z]) => {
    const ball = new THREE.SphereGeometry(1, 7, 4);
    const r = 0.21 + zz() * 0.06;
    ball.scale(r, r * 0.9, r);
    ball.translate(x, y, z);
    teile.push(farbig(ball, '#ffffff'));
  });
  return mergeGeometries(teile);
}

function schafKopf() {
  // Der Drehpunkt ist der Hals: so kann der Kopf zum Grasen nach unten nicken
  const gesicht = '#3b302b';
  const teile = [
    farbig(kugel(0.2, 9, 6, 0.85, 0.9, 1.25, 0, 0, 0.12), gesicht),
    farbig(kugel(0.11, 6, 4, 1.1, 0.8, 0.9, 0, -0.05, 0.33), '#2c2420'), // Schnauze
    farbig(kugel(0.08, 6, 4, 2.0, 0.45, 0.8, 0.2, 0.06, 0.02), gesicht), // Ohr links
    farbig(kugel(0.08, 6, 4, 2.0, 0.45, 0.8, -0.2, 0.06, 0.02), gesicht), // Ohr rechts
    farbig(kugel(0.045, 5, 3, 1, 1, 1, 0.11, 0.07, 0.24), '#f4f0e6'), // Auge links
    farbig(kugel(0.045, 5, 3, 1, 1, 1, -0.11, 0.07, 0.24), '#f4f0e6'), // Auge rechts
    farbig(kugel(0.026, 4, 2, 1, 1, 1, 0.125, 0.075, 0.275), '#111111'), // Pupille
    farbig(kugel(0.026, 4, 2, 1, 1, 1, -0.125, 0.075, 0.275), '#111111'),
  ];
  // Ein Woll-Puschel oben auf dem Kopf
  const puschel = knubbelKugel(19, 7, 4, 0.35, 3);
  puschel.scale(0.15, 0.1, 0.15);
  puschel.translate(0, 0.17, 0.06);
  teile.push(farbig(puschel, '#f3ead8'));
  return mergeGeometries(teile);
}

// --- Der Hase (schaut nach vorne = +z) ---
function haseKoerper() {
  const fell = '#ffffff'; // Fellfarbe kommt pro Hase dazu (braun oder grau)
  const bauch = knubbelKugel(31, 11, 8, 0.12, 2);
  bauch.scale(0.2, 0.2, 0.27);
  bauch.translate(0, 0.21, -0.03);
  // Dicke Hinterbeine (Oberschenkel) seitlich am Po
  const schenkelL = kugel(0.11, 6, 4, 0.7, 1, 1.3, 0.14, 0.15, -0.1);
  const schenkelR = kugel(0.11, 6, 4, 0.7, 1, 1.3, -0.14, 0.15, -0.1);
  // Das weiße Puschelschwänzchen – die Farbe kriegt es extra hell
  const schwanz = knubbelKugel(44, 6, 4, 0.4, 3);
  schwanz.scale(0.075, 0.075, 0.075);
  schwanz.translate(0, 0.27, -0.29);
  return mergeGeometries([farbig(bauch, fell), farbig(schenkelL, fell), farbig(schenkelR, fell), farbig(schwanz, '#fbf8f2', true)]);
}

function haseKopf() {
  const teile = [
    farbig(kugel(0.13, 10, 7, 0.95, 0.9, 1.1, 0, 0, 0.04), '#ffffff'),
    farbig(kugel(0.06, 7, 4, 1.2, 0.8, 1, 0, -0.04, 0.14), '#d9cbb8', true), // helle Schnauze
    farbig(kugel(0.022, 5, 3, 1.2, 1, 1, 0, -0.01, 0.19), '#e88a9a', true), // rosa Nase
    farbig(kugel(0.03, 5, 4, 1, 1, 1, 0.085, 0.035, 0.1), '#141010', true), // Auge links
    farbig(kugel(0.03, 5, 4, 1, 1, 1, -0.085, 0.035, 0.1), '#141010', true), // Auge rechts
  ];
  return mergeGeometries(teile);
}

// Ein langes Ohr. Drehpunkt unten, damit es wackeln kann
function haseOhr() {
  const aussen = farbig(kugel(0.05, 6, 5, 0.9, 3.2, 0.42, 0, 0.15, 0), '#ffffff');
  const innen = farbig(kugel(0.036, 5, 4, 0.9, 3.0, 0.3, 0, 0.15, 0.012), '#e9a9b2', true);
  return mergeGeometries([aussen, innen]);
}

// ---------- Wo darf ein Tier hin? ----------
function darfHin(x, z, hindernisse, radius) {
  if (Math.hypot(x, z) < 14) return false; // rund ums Zelt bleibt frei
  if (Math.hypot(x, z) > R * 1.1) return false;
  const h = bodenHoehe(x, z);
  if (h <= 1.2 || h > 20) return false; // nicht ins Wasser, nicht auf hohe Berge
  if (abstandZumDorf(x, z) <= DORF.radius + 5) return false;
  if (hindernisse.trifft(x, z, radius)) return false;
  return true;
}

// Ist das eine schöne Wiese? (kein Wald, nicht zu hoch, nicht zu steil)
function istWiese(x, z, hindernisse) {
  if (!darfHin(x, z, hindernisse, 2)) return false;
  if (istWald(x, z)) return false;
  const h = bodenHoehe(x, z);
  if (h > 13) return false;
  const steil = Math.abs(bodenHoehe(x + 3, z) - h) + Math.abs(bodenHoehe(x, z + 3) - h);
  return steil < 1.6;
}

// Sucht einen Punkt im Ring zwischen "von" und "bis" Metern um den Start
function suchePunkt(von, bis, pruefen, versuche = 400) {
  for (let i = 0; i < versuche; i++) {
    const w = zufall() * Math.PI * 2;
    const r = von + zufall() * (bis - von);
    const x = Math.cos(w) * r, z = Math.sin(w) * r;
    if (pruefen(x, z)) return [x, z];
  }
  return null;
}

// Dreht einen Winkel weich zu einem Zielwinkel (immer den kurzen Weg)
function dreheZu(winkel, ziel, schritt) {
  let d = ziel - winkel;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  return winkel + THREE.MathUtils.clamp(d, -schritt, schritt);
}

// Am Hang steht ein Tier schräg: vorne höher oder tiefer als hinten
function hangNeigung(x, z, drehung, halbeLaenge) {
  const dx = Math.sin(drehung) * halbeLaenge, dz = Math.cos(drehung) * halbeLaenge;
  const unterschied = bodenHoehe(x + dx, z + dz) - bodenHoehe(x - dx, z - dz);
  return THREE.MathUtils.clamp(-Math.atan2(unterschied, halbeLaenge * 2), -0.4, 0.4);
}

// ---------- Hilfsmittel zum Zusammenbauen der Matrizen ----------
const _tier = m4(), _teil = m4(), _ergebnis = m4();
const _q = new THREE.Quaternion(), _e = new THREE.Euler();
const _pos = v3(0, 0, 0), _gr = v3(1, 1, 1);

// Matrix für ein Körperteil: Tier-Matrix × (Verschiebung, Drehung, Größe)
function teilMatrix(x, y, z, rx, ry, rz, sx = 1, sy = 1, sz = 1) {
  _e.set(rx, ry, rz, 'YXZ');
  _q.setFromEuler(_e);
  _teil.compose(_pos.set(x, y, z), _q, _gr.set(sx, sy, sz));
  return _ergebnis.multiplyMatrices(_tier, _teil);
}

function setzeTier(x, y, z, drehung, neigung = 0, rollen = 0) {
  _e.set(neigung, drehung, rollen, 'YXZ');
  _q.setFromEuler(_e);
  _tier.compose(_pos.set(x, y, z), _q, _gr.set(1, 1, 1));
}

// Ein InstancedMesh, das genug Platz für alle Tiere hat
function vieleKopien(geo, material, anzahl) {
  const mesh = new THREE.InstancedMesh(geo, material, anzahl);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); // ändert sich jedes Bild
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false; // die Tiere sind über die ganze Insel verteilt
  mesh.count = 0;
  return mesh;
}

// =============================================================
export class Tiere {
  constructor(szene, hindernisse) {
    this.hindernisse = hindernisse;
    this.zeit = 0;
    this.schafe = [];
    this.hasen = [];
    this.herden = [];

    this.platziereSchafe();
    this.platziereHasen();

    // Materialien: weich und matt wie Fell
    const fellMaterial = mitEigenfarbe(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }), 'fell');
    const glattMaterial = mitEigenfarbe(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 }), 'glatt');

    const nS = this.schafe.length, nH = this.hasen.length;
    this.teile = {
      schafKoerper: vieleKopien(schafKoerper(), fellMaterial, nS),
      schafKopf: vieleKopien(schafKopf(), glattMaterial, nS),
      schafBeine: vieleKopien(beinForm(0.055, 0.4, '#3b302b'), glattMaterial, nS * 4),
      haseKoerper: vieleKopien(haseKoerper(), fellMaterial, nH),
      haseKopf: vieleKopien(haseKopf(), fellMaterial, nH),
      haseOhren: vieleKopien(haseOhr(), fellMaterial, nH * 2),
      haseBeine: vieleKopien(hasenBein(), fellMaterial, nH * 4),
    };
    // Die kleinen Teile werfen keinen Schatten – spart Arbeit, sieht man eh kaum
    this.teile.schafBeine.castShadow = false;
    this.teile.haseBeine.castShadow = false;
    this.teile.haseOhren.castShadow = false;

    this.gruppe = new THREE.Group();
    this.gruppe.name = 'Tiere';
    for (const mesh of Object.values(this.teile)) this.gruppe.add(mesh);
    szene.add(this.gruppe);

    // Einmal hinstellen, auch bevor sich jemand bewegt hat
    this.aktualisiere(0, v3(0, 0, 0), 1);
  }

  // ---------- Schafe auf Wiesen verteilen ----------
  platziereSchafe() {
    const wiese = (x, z) => istWiese(x, z, this.hindernisse);
    const weitWeg = (x, z) => this.herden.every((h) => Math.hypot(h.heimX - x, h.heimZ - z) > 45);
    const farben = ['#f6f1e4', '#efe6d2', '#fbf8f0', '#e9dfca', '#f3ecdc'];

    for (let i = 0; i < ANZAHL_HERDEN; i++) {
      // Die erste Herde steht nah am Zelt, damit man sie gleich sieht
      let punkt = null;
      if (i === 0) punkt = suchePunkt(24, 40, (x, z) => wiese(x, z));
      else if (i === 1) punkt = suchePunkt(40, 60, (x, z) => wiese(x, z) && weitWeg(x, z));
      if (!punkt) punkt = suchePunkt(50, R * 0.85, (x, z) => wiese(x, z) && weitWeg(x, z), 2000);
      if (!punkt) continue;
      const [hx, hz] = punkt;
      const herde = { heimX: hx, heimZ: hz, x: hx, z: hz, umzugIn: 10 + zufall() * 20 };
      this.herden.push(herde);

      const anzahl = SCHAFE_PRO_HERDE_MIN + Math.floor(zufall() * (SCHAFE_PRO_HERDE_MAX - SCHAFE_PRO_HERDE_MIN + 1));
      for (let k = 0; k < anzahl; k++) {
        let x = hx, z = hz;
        for (let v = 0; v < 30; v++) {
          const tx = hx + (zufall() - 0.5) * 9, tz = hz + (zufall() - 0.5) * 9;
          if (darfHin(tx, tz, this.hindernisse, 0.6) && this.schafe.every((s) => Math.hypot(s.x - tx, s.z - tz) > 1.4)) {
            x = tx; z = tz;
            break;
          }
        }
        const groesse = 0.85 + zufall() * 0.3;
        this.schafe.push({
          herde, x, z, groesse,
          drehung: zufall() * Math.PI * 2,
          farbe: new THREE.Color(farben[Math.floor(zufall() * farben.length)]),
          zustand: 'stehen', timer: zufall() * 4,
          zielX: x, zielZ: z,
          schritt: zufall() * 6, // für das Bein-Schwingen
          kopf: 0, // 0 = Kopf oben, 1 = ganz unten (grasen)
          liegen: 0, // 0 = steht, 1 = liegt
          tempo: 0,
          wackel: zufall() * 10,
        });
      }
    }
  }

  // ---------- Hasen verteilen ----------
  platziereHasen() {
    const ok = (x, z) => darfHin(x, z, this.hindernisse, 1) && bodenHoehe(x, z) < 15;
    const farben = ['#9a7a5c', '#8a6d52', '#a58a70', '#8e8a84', '#7d756d'];
    let i = 0;
    while (this.hasen.length < ANZAHL_HASEN && i < ANZAHL_HASEN * 3) {
      // Die ersten Hasen wohnen nah am Zelt
      const punkt = i < 3 ? suchePunkt(20, 45, ok) : suchePunkt(30, R * 0.9, ok, 1000);
      i++;
      if (!punkt) continue;
      // Manchmal sind es zwei Hasen zusammen
      const zuZweit = zufall() < 0.4 && this.hasen.length < ANZAHL_HASEN - 1;
      for (let k = 0; k < (zuZweit ? 2 : 1); k++) {
        const x = punkt[0] + k * 1.2, z = punkt[1] + k * 0.8;
        if (!ok(x, z)) continue;
        this.hasen.push({
          x, z, y: 0,
          drehung: zufall() * Math.PI * 2,
          groesse: 0.9 + zufall() * 0.25,
          farbe: new THREE.Color(farben[Math.floor(zufall() * farben.length)]),
          zustand: 'sitzen', timer: 1 + zufall() * 4,
          sprung: 0, // 0..1 wie weit der aktuelle Hüpfer ist
          vonX: x, vonZ: z, nachX: x, nachZ: z,
          spruenge: 0, // wie viele Hüpfer noch?
          flucht: false,
          schnuppern: zufall() * 10,
          ohrZucken: 0,
        });
      }
    }
  }

  get positionen() {
    return [
      ...this.schafe.map((s) => ({ x: s.x, z: s.z, art: 'schaf' })),
      ...this.hasen.map((h) => ({ x: h.x, z: h.z, art: 'hase' })),
    ];
  }

  // ---------- Jedes Bild einmal ----------
  aktualisiere(dt, spielerPos, helligkeit = 1) {
    this.zeit += dt;
    const nacht = helligkeit < 0.3;
    const t = this.teile;
    let nS = 0, nH = 0;

    for (const herde of this.herden) this.bewegeHerde(herde, dt);

    // --- Schafe ---
    for (const s of this.schafe) {
      if (Math.hypot(s.x - spielerPos.x, s.z - spielerPos.z) > SICHTWEITE) continue; // zu weit weg
      this.denkeSchaf(s, dt, spielerPos, nacht);
      this.malSchaf(s, nS++);
    }

    // --- Hasen ---
    for (const h of this.hasen) {
      if (Math.hypot(h.x - spielerPos.x, h.z - spielerPos.z) > SICHTWEITE) continue;
      this.denkeHase(h, dt, spielerPos, nacht);
      this.malHase(h, nH++);
    }

    t.schafKoerper.count = t.schafKopf.count = nS;
    t.schafBeine.count = nS * 4;
    t.haseKoerper.count = t.haseKopf.count = nH;
    t.haseOhren.count = nH * 2;
    t.haseBeine.count = nH * 4;
    for (const mesh of Object.values(t)) {
      mesh.visible = mesh.count > 0;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }

  // Die ganze Herde zieht ab und zu ein Stückchen weiter
  bewegeHerde(herde, dt) {
    herde.umzugIn -= dt;
    if (herde.umzugIn > 0) return;
    herde.umzugIn = 40 + zufall() * 40;
    for (let v = 0; v < 10; v++) {
      const x = herde.heimX + (zufall() - 0.5) * 16, z = herde.heimZ + (zufall() - 0.5) * 16;
      if (istWiese(x, z, this.hindernisse) || darfHin(x, z, this.hindernisse, 1.5)) {
        herde.x = x;
        herde.z = z;
        return;
      }
    }
  }

  // ---------- Das Schaf-Gehirn ----------
  denkeSchaf(s, dt, spieler, nacht) {
    s.timer -= dt;
    // Nachts legt sich das Schaf langsam hin und schläft
    s.liegen = THREE.MathUtils.clamp(s.liegen + (nacht ? dt * 0.4 : -dt * 0.6), 0, 1);
    if (nacht) {
      s.tempo = Math.max(0, s.tempo - dt * 2);
      s.kopf += (0.25 - s.kopf) * Math.min(1, dt * 2);
      return;
    }
    if (s.liegen > 0.05) return; // erst mal aufstehen

    // Kommt die Spielfigur ganz nah, geht das Schaf ein paar Schritte zur Seite
    const abstand = Math.hypot(s.x - spieler.x, s.z - spieler.z);
    if (abstand < 2.5 && s.zustand !== 'laufen') {
      const w = Math.atan2(s.z - spieler.z, s.x - spieler.x) + (zufall() - 0.5);
      this.waehleSchafZiel(s, s.x + Math.cos(w) * 4, s.z + Math.sin(w) * 4);
    }

    if (s.zustand === 'laufen') {
      const dx = s.zielX - s.x, dz = s.zielZ - s.z;
      const weg = Math.hypot(dx, dz);
      s.kopf += (0 - s.kopf) * Math.min(1, dt * 4);
      if (weg < 0.6 || s.timer < 0) {
        // Angekommen: meistens wird jetzt gefuttert
        s.zustand = zufall() < 0.75 ? 'grasen' : 'stehen';
        s.timer = s.zustand === 'grasen' ? 6 + zufall() * 10 : 2 + zufall() * 4;
      } else {
        s.drehung = dreheZu(s.drehung, Math.atan2(dx, dz), dt * 2.5);
        s.tempo = Math.min(SCHAF_TEMPO, s.tempo + dt * 1.5);
        // Nur nach vorne laufen, wenn man ungefähr in die richtige Richtung schaut
        const vorne = Math.max(0, Math.cos(Math.atan2(dx, dz) - s.drehung));
        const nx = s.x + Math.sin(s.drehung) * s.tempo * vorne * dt;
        const nz = s.z + Math.cos(s.drehung) * s.tempo * vorne * dt;
        if (darfHin(nx, nz, this.hindernisse, 0.5)) {
          s.x = nx;
          s.z = nz;
          s.schritt += s.tempo * vorne * dt * 5;
        } else {
          s.zustand = 'stehen'; // da geht's nicht weiter
          s.timer = 1;
        }
      }
    } else {
      s.tempo = Math.max(0, s.tempo - dt * 3);
      // Grasen: Kopf runter, ab und zu kurz hoch zum Kauen und Gucken
      const zielKopf = s.zustand === 'grasen' ? (Math.sin(this.zeit * 0.7 + s.wackel) > -0.6 ? 1 : 0.2) : 0;
      s.kopf += (zielKopf - s.kopf) * Math.min(1, dt * 3);
      if (s.timer < 0 && zufall() < 0.45) {
        // Manchmal bleibt das Schaf einfach da und wechselt nur zwischen Futtern und Gucken
        s.zustand = s.zustand === 'grasen' ? 'stehen' : 'grasen';
        s.timer = s.zustand === 'grasen' ? 5 + zufall() * 8 : 2 + zufall() * 3;
      } else if (s.timer < 0) {
        // Neues Ziel in der Nähe der Herde (aber nicht zu weit weg)
        const h = s.herde;
        const w = zufall() * Math.PI * 2, r = 1 + zufall() * 3.5;
        this.waehleSchafZiel(s, h.x + Math.cos(w) * r, h.z + Math.sin(w) * r);
      }
    }

    // Schafe drängeln sich nicht ineinander: sanft auseinanderschieben
    for (const anderes of this.schafe) {
      if (anderes === s || anderes.herde !== s.herde) continue;
      const dx = s.x - anderes.x, dz = s.z - anderes.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.001 && d < 1.2) {
        const px = s.x + (dx / d) * (1.2 - d) * dt * 2, pz = s.z + (dz / d) * (1.2 - d) * dt * 2;
        if (darfHin(px, pz, this.hindernisse, 0.5)) {
          s.x = px;
          s.z = pz;
        }
      }
    }
  }

  waehleSchafZiel(s, x, z) {
    if (!darfHin(x, z, this.hindernisse, 0.6)) {
      s.zustand = 'stehen';
      s.timer = 0.5 + zufall();
      return;
    }
    s.zielX = x;
    s.zielZ = z;
    s.zustand = 'laufen';
    // Wenn es zu lange dauert (z. B. weil ein anderes Schaf im Weg steht), gibt es auf
    s.timer = Math.hypot(x - s.x, z - s.z) / SCHAF_TEMPO + 3;
  }

  malSchaf(s, i) {
    const t = this.teile;
    const g = s.groesse;
    const l = THREE.MathUtils.smoothstep(s.liegen, 0, 1);
    const laufen = Math.min(1, s.tempo / SCHAF_TEMPO);
    // Beim Laufen wippt der Körper ein bisschen, beim Atmen auch
    const wippen = Math.abs(Math.sin(s.schritt)) * 0.04 * laufen + Math.sin(this.zeit * 1.6 + s.wackel) * 0.008;
    const y = bodenHoehe(s.x, s.z);
    const koerperY = 0.72 * g * (1 - l * 0.55) + wippen;
    setzeTier(s.x, y, s.z, s.drehung, hangNeigung(s.x, s.z, s.drehung, 0.6 * g), l * 0.12);

    t.schafKoerper.setMatrixAt(i, teilMatrix(0, koerperY, 0, 0, 0, 0, g, g * (1 - l * 0.08), g));
    t.schafKoerper.setColorAt(i, s.farbe);

    // Kopf: vorne am Körper, nickt zum Grasen nach unten
    const nicken = s.kopf * 1.2 - 0.15;
    const schuetteln = s.zustand === 'grasen' ? Math.sin(this.zeit * 5 + s.wackel) * 0.06 * s.kopf : Math.sin(this.zeit * 0.5 + s.wackel) * 0.25;
    t.schafKopf.setMatrixAt(i, teilMatrix(0, koerperY + 0.12 * g - s.kopf * 0.16 * g, 0.62 * g, nicken, schuetteln * (1 - l), 0, g, g, g));

    // Vier Beine: diagonal gegenüberliegende Beine schwingen zusammen
    const schwung = Math.sin(s.schritt) * 0.55 * laufen;
    const beine = [[0.2, 0.42, 1], [-0.2, 0.42, -1], [0.2, -0.42, -1], [-0.2, -0.42, 1]];
    beine.forEach(([bx, bz, seite], k) => {
      // Im Liegen werden die Beine unter den Bauch geklappt
      const beinY = koerperY - 0.34 * g;
      const klappen = l * 1.4 * (bz > 0 ? -1 : 1);
      t.schafBeine.setMatrixAt(i * 4 + k, teilMatrix(bx * g, beinY, bz * g, schwung * seite + klappen, 0, 0, g, g * (1 - l * 0.5), g));
    });
  }

  // ---------- Das Hasen-Gehirn ----------
  denkeHase(h, dt, spieler, nacht) {
    h.timer -= dt;
    h.schnuppern += dt;
    h.ohrZucken = Math.max(0, h.ohrZucken - dt * 3);
    const abstand = Math.hypot(h.x - spieler.x, h.z - spieler.z);

    // Hilfe, da kommt jemand! Weghoppeln!
    if (abstand < HASE_ANGST_ABSTAND && !h.flucht) {
      const weg = Math.atan2(h.x - spieler.x, h.z - spieler.z);
      h.flucht = true;
      h.ohrZucken = 1;
      if (!this.waehleHasenZiel(h, weg, 8 + zufall() * 4)) h.flucht = false;
      h.zustand = 'hoppeln';
      h.spruenge = Math.max(h.spruenge, 1);
    }

    if (h.zustand === 'hoppeln') {
      // Während eines Hüpfers fliegt der Hase in einem Bogen
      const dauer = h.flucht ? 0.3 : 0.4;
      h.sprung += dt / dauer;
      const p = Math.min(1, h.sprung);
      h.x = THREE.MathUtils.lerp(h.vonX, h.nachX, p);
      h.z = THREE.MathUtils.lerp(h.vonZ, h.nachZ, p);
      h.y = Math.sin(p * Math.PI) * (h.flucht ? 0.42 : 0.25);
      if (h.sprung >= 1) {
        h.sprung = 0;
        h.y = 0;
        h.spruenge--;
        if (h.spruenge > 0 && this.naechsterHuepfer(h)) {
          // weiter geht's
        } else if (h.flucht && Math.hypot(h.x - spieler.x, h.z - spieler.z) < HASE_ANGST_ABSTAND * 1.6) {
          // Immer noch zu nah: nochmal weg!
          const weg = Math.atan2(h.x - spieler.x, h.z - spieler.z);
          if (!this.waehleHasenZiel(h, weg, 8 + zufall() * 4)) this.hinsetzen(h);
        } else {
          this.hinsetzen(h);
        }
      }
    } else {
      // Sitzen und schnuppern. Nachts sitzen Hasen länger still.
      if (h.timer < 0 && !nacht) {
        const w = h.drehung + (zufall() - 0.5) * 2.5;
        if (!this.waehleHasenZiel(h, w, 2 + zufall() * 4)) h.timer = 1;
      } else if (h.timer < 0) {
        h.timer = 4 + zufall() * 6;
      }
      if (zufall() < dt * 0.3) h.ohrZucken = 1;
    }
  }

  hinsetzen(h) {
    h.zustand = 'sitzen';
    h.flucht = false;
    h.spruenge = 0;
    h.timer = 2 + zufall() * 5;
  }

  // Plant ein paar Hüpfer in eine Richtung. Ist da kein Platz, wird gedreht.
  waehleHasenZiel(h, winkel, weite) {
    for (let v = 0; v < 8; v++) {
      const w = winkel + (v % 2 ? 1 : -1) * Math.ceil(v / 2) * 0.5;
      const x = h.x + Math.sin(w) * weite, z = h.z + Math.cos(w) * weite;
      if (darfHin(x, z, this.hindernisse, 0.3)) {
        h.zielWinkel = w;
        h.spruenge = Math.max(1, Math.round(weite / (h.flucht ? 1.5 : 0.8)));
        h.zustand = 'hoppeln';
        h.sprung = 0;
        return this.naechsterHuepfer(h);
      }
    }
    return false;
  }

  naechsterHuepfer(h) {
    const weite = h.flucht ? 1.5 : 0.8;
    const w = h.zielWinkel + (zufall() - 0.5) * 0.4; // nicht ganz gerade, wie echte Hasen
    const x = h.x + Math.sin(w) * weite, z = h.z + Math.cos(w) * weite;
    if (!darfHin(x, z, this.hindernisse, 0.3)) return false;
    h.vonX = h.x; h.vonZ = h.z;
    h.nachX = x; h.nachZ = z;
    h.drehung = w;
    return true;
  }

  malHase(h, i) {
    const t = this.teile;
    const g = h.groesse;
    const springt = h.zustand === 'hoppeln';
    const p = h.sprung;
    // Im Sprung streckt sich der Hase: erst nach oben, dann nach unten geneigt
    const neigung = springt ? Math.sin(p * Math.PI * 2) * -0.35 : -0.08;
    const y = bodenHoehe(h.x, h.z) + h.y;
    setzeTier(h.x, y, h.z, h.drehung, neigung + hangNeigung(h.x, h.z, h.drehung, 0.25));
    const atmen = 1 + Math.sin(this.zeit * 5 + h.schnuppern) * 0.015;

    t.haseKoerper.setMatrixAt(i, teilMatrix(0, 0, 0, 0, 0, 0, g, g * atmen, g * (springt ? 1.12 : 1)));
    t.haseKoerper.setColorAt(i, h.farbe);

    // Kopf: schnuppert (zittert schnell mit der Nase) und schaut sich um
    const schnupper = springt ? 0 : Math.sin(h.schnuppern * 22) * 0.04 * (Math.sin(h.schnuppern * 0.9) > 0 ? 1 : 0);
    const umschauen = springt ? 0 : Math.sin(h.schnuppern * 0.6) * 0.5;
    const kopfY = 0.38 * g, kopfZ = 0.16 * g;
    t.haseKopf.setMatrixAt(i, teilMatrix(0, kopfY, kopfZ, 0.15 + schnupper, umschauen, 0, g, g, g));
    t.haseKopf.setColorAt(i, h.farbe);

    // Ohren: stehen hoch, beim Springen klappen sie nach hinten, ab und zu zucken sie
    const zucken = Math.sin(h.ohrZucken * Math.PI * 4) * 0.25 * h.ohrZucken;
    const nachHinten = springt ? -0.7 : -0.15;
    for (const seite of [1, -1]) {
      const ox = Math.cos(umschauen) * 0.045 * seite * g, oz = -Math.sin(umschauen) * 0.045 * seite * g;
      t.haseOhren.setMatrixAt(i * 2 + (seite > 0 ? 0 : 1), teilMatrix(ox, kopfY + 0.08 * g, kopfZ + oz, nachHinten + zucken * seite, umschauen, -0.2 * seite, g, g, g));
      t.haseOhren.setColorAt(i * 2 + (seite > 0 ? 0 : 1), h.farbe);
    }

    // Beine: Vorderpfoten kurz, Hinterpfoten lang und flach (die großen Hasenfüße)
    const strecken = springt ? Math.sin(p * Math.PI) : 0;
    const vorne = [[0.07, 0.12], [-0.07, 0.12]];
    vorne.forEach(([bx, bz], k) => {
      t.haseBeine.setMatrixAt(i * 4 + k, teilMatrix(bx * g, 0.16 * g, bz * g, -0.15 - strecken * 0.9, 0, 0, g, g, g));
      t.haseBeine.setColorAt(i * 4 + k, h.farbe);
    });
    const hinten = [[0.14, -0.04], [-0.14, -0.04]];
    hinten.forEach(([bx, bz], k) => {
      // Die Hinterpfoten liegen flach auf dem Boden und stoßen beim Springen nach hinten
      t.haseBeine.setMatrixAt(i * 4 + 2 + k, teilMatrix(bx * g, 0.07 * g, bz * g, -1.45 + strecken * 2.6, 0, 0, g * 1.15, g * 1.5, g * 0.9));
      t.haseBeine.setColorAt(i * 4 + 2 + k, h.farbe);
    });
  }
}
