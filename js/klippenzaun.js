// =============================================================
//  DER KLIPPENZAUN 🪵 – oben rund um die Klippeninsel
//  Damit niemand aus Versehen von der Klippe ins tiefe Meer fällt.
//  Runter kommt man nur am Seil („Runterklettern“).
//  Für jede Richtung (360 Stück) merken wir uns, wie weit es
//  von der Inselmitte bis zum Zaun ist.
// =============================================================
import * as THREE from 'three';
import { bodenHoehe, INSELN } from './gelaende.js';
import { textur } from './texturen.js';

const KLIPPE = INSELN.find((I) => I.klippen);
const RICHTUNGEN = 360;
const PFOSTEN_ABSTAND = 3; // Meter zwischen zwei Pfosten
const ZAUN_HOEHE = 1.1;
let zaunRadius = null; // Richtung → Abstand Mitte bis Zaun

// Wo fällt das Plateau steil ab? Von innen nach außen gehen, bis es tief runtergeht.
function berechneZaun() {
  zaunRadius = new Float32Array(RICHTUNGEN);
  const plateau = KLIPPE.plateauHoehe ?? 21;
  for (let i = 0; i < RICHTUNGEN; i++) {
    const w = (i / RICHTUNGEN) * Math.PI * 2;
    const c = Math.cos(w), s = Math.sin(w);
    let kante = KLIPPE.radius;
    for (let r = (KLIPPE.laguneRadius ?? 16) + 8; r < KLIPPE.radius + 20; r += 0.25) {
      if (bodenHoehe(KLIPPE.x + c * r, KLIPPE.z + s * r) < plateau - 4) { kante = r; break; }
    }
    zaunRadius[i] = kante - 1.5; // der Zaun steht ein Stück vor der Kante
  }
}

function radiusBei(x, z) {
  if (!zaunRadius) berechneZaun();
  let w = Math.atan2(z - KLIPPE.z, x - KLIPPE.x);
  if (w < 0) w += Math.PI * 2;
  return zaunRadius[Math.round((w / (Math.PI * 2)) * RICHTUNGEN) % RICHTUNGEN];
}

// Liegt (x, z) außerhalb vom Zaun? (Dann darf man von oben nicht dahin.)
export function hinterDemZaun(x, z) {
  if (!KLIPPE) return false;
  return Math.hypot(x - KLIPPE.x, z - KLIPPE.z) > radiusBei(x, z);
}

// Ein Punkt innen am Zaun, ganz in der Nähe von (x, z) – für die Rettung nach oben
export function platzInnenAmZaun(x, z) {
  if (!KLIPPE) return null;
  const w = Math.atan2(z - KLIPPE.z, x - KLIPPE.x);
  const r = radiusBei(x, z) - 2;
  return { x: KLIPPE.x + Math.cos(w) * r, z: KLIPPE.z + Math.sin(w) * r };
}

// Ist (x, z) nah an der Klippeninsel (z. B. unten am Fuß der Wand)?
export function nahAnDerKlippe(x, z) {
  return !!KLIPPE && Math.hypot(x - KLIPPE.x, z - KLIPPE.z) < KLIPPE.radius + 15;
}

// Den Zaun bauen: runde Holzpfosten und zwei Latten dazwischen.
// Alles mit InstancedMesh – nur 2 Draw-Calls für den ganzen Zaun.
export function baueKlippenZaun(szene) {
  if (!KLIPPE) return;
  if (!zaunRadius) berechneZaun();
  const punkte = [];
  let umfang = 0;
  for (let i = 0; i < RICHTUNGEN; i++) umfang += (zaunRadius[i] * Math.PI * 2) / RICHTUNGEN;
  const anzahl = Math.round(umfang / PFOSTEN_ABSTAND);
  for (let i = 0; i < anzahl; i++) {
    const w = (i / anzahl) * Math.PI * 2;
    const r = zaunRadius[Math.round((i / anzahl) * RICHTUNGEN) % RICHTUNGEN];
    const x = KLIPPE.x + Math.cos(w) * r, z = KLIPPE.z + Math.sin(w) * r;
    punkte.push(new THREE.Vector3(x, bodenHoehe(x, z), z));
  }
  const holz = new THREE.MeshStandardMaterial({ map: textur('rinde.jpg'), color: '#b08a62', roughness: 0.9 });
  const pfosten = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.11, ZAUN_HOEHE, 4, 8), holz, anzahl);
  const latten = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.06, 1, 3, 6), holz, anzahl * 2);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), hoch = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < anzahl; i++) {
    const a = punkte[i], b = punkte[(i + 1) % anzahl];
    m.makeTranslation(a.x, a.y + ZAUN_HOEHE / 2, a.z);
    pfosten.setMatrixAt(i, m);
    // Zwei Latten von diesem Pfosten zum nächsten (eine oben, eine in der Mitte)
    const richtung = new THREE.Vector3().subVectors(b, a);
    const laenge = richtung.length();
    q.setFromUnitVectors(hoch, richtung.normalize());
    for (const [j, h] of [[0, ZAUN_HOEHE * 0.95], [1, ZAUN_HOEHE * 0.5]]) {
      const mitte = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
      mitte.y += h;
      m.compose(mitte, q, new THREE.Vector3(1, laenge, 1));
      latten.setMatrixAt(i * 2 + j, m);
    }
  }
  pfosten.castShadow = latten.castShadow = true;
  szene.add(pfosten, latten);
}
