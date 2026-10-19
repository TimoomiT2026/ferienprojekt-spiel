// =============================================================
//  DAS GELÄNDE – Berge, Täler, Strand, Seen und der Trampelpfad
// =============================================================
import * as THREE from 'three';
import { EINSTELLUNGEN } from './einstellungen.js';
import { fbm } from './rauschen.js';

export const WASSER_HOEHE = 0;
const R = EINSTELLUNGEN.inselGroesse;

// Wo liegt das Dorf? (irgendwo im Nordosten der Insel)
export const DORF = { x: R * 0.55, z: -R * 0.42, radius: 24, hoehe: 4 };

// Der Trampelpfad vom Zelt zum Dorf – leicht geschlängelt
const PFAD = [];
for (let i = 0; i <= 16; i++) {
  const t = i / 16;
  const x = DORF.x * t + Math.sin(t * Math.PI * 3) * 12;
  const z = DORF.z * t + Math.sin(t * Math.PI * 2) * 15;
  PFAD.push([x, z]);
}

// Wie weit ist (x, z) vom Trampelpfad entfernt?
export function abstandZumPfad(x, z) {
  let min = Infinity;
  for (let i = 0; i < PFAD.length - 1; i++) {
    const [ax, az] = PFAD[i], [bx, bz] = PFAD[i + 1];
    const dx = bx - ax, dz = bz - az;
    const t = THREE.MathUtils.clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz), 0, 1);
    min = Math.min(min, Math.hypot(x - (ax + dx * t), z - (az + dz * t)));
  }
  return min;
}

export function abstandZumDorf(x, z) {
  return Math.hypot(x - DORF.x, z - DORF.z);
}

// Ist hier Wald? (Wald wächst in großen Flecken)
export function istWald(x, z) {
  return fbm(x * 0.008 + 50, z * 0.008 + 50, 3, 9) > 0.56;
}

// Wie hoch ist der Boden an der Stelle (x, z)?
export function bodenHoehe(x, z) {
  const r = Math.hypot(x, z);
  const w = Math.atan2(z, x);
  // Küste: nicht kreisrund, sondern mit Buchten und Landzungen
  const kueste = R + (fbm(Math.cos(w) * 1.6 + 10, Math.sin(w) * 1.6 + 10, 3, 7) - 0.5) * R * 0.45;
  const insel = 1 - THREE.MathUtils.smoothstep(r, kueste - 45, kueste + 8);

  // Sanfte Hügel überall
  const huegel = (fbm(x * 0.012, z * 0.012, 4, 1) - 0.5) * 14;
  // Ein paar richtige Berge
  const bergMaske = THREE.MathUtils.smoothstep(fbm(x * 0.005 + 3, z * 0.005 + 3, 3, 2), 0.55, 0.72);
  const berg = bergMaske * (18 + 22 * fbm(x * 0.025, z * 0.025, 4, 4));

  // Rund ums Zelt bleibt es flach, damit man gut starten kann
  const startFlach = THREE.MathUtils.smoothstep(r, 15, 50);
  let h = insel * (2.6 + (huegel + berg) * startFlach) - (1 - insel) * 7;

  // Das Dorf steht auf einer flachen Wiese
  const dorfFlach = THREE.MathUtils.smoothstep(abstandZumDorf(x, z), DORF.radius, DORF.radius + 25);
  h = THREE.MathUtils.lerp(DORF.hoehe, h, dorfFlach);

  // Der Pfad ist immer begehbar (auch als Damm durch einen See)
  const pfad = 1 - THREE.MathUtils.smoothstep(abstandZumPfad(x, z), 2, 6);
  if (h < 2.2) h = THREE.MathUtils.lerp(h, 2.2, pfad);
  return h;
}

export function baueGelaende() {
  const groesse = (R + 90) * 2;
  const unterteilung = 256;
  const geo = new THREE.PlaneGeometry(groesse, groesse, unterteilung, unterteilung);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, bodenHoehe(pos.getX(i), pos.getZ(i)));
  geo.computeVertexNormals();

  // Farben: je nach Höhe, Steilheit, Wald und Pfad
  const farben = new Float32Array(pos.count * 3);
  const normalen = geo.attributes.normal;
  const sand = new THREE.Color('#e8d29a');
  const nasserSand = new THREE.Color('#c9b07a');
  const wiese = new THREE.Color('#6fbf4a');
  const wiese2 = new THREE.Color('#9acd52');
  const waldboden = new THREE.Color('#4f8f3a');
  const fels = new THREE.Color('#8f8a82');
  const schnee = new THREE.Color('#f4f6f8');
  const erde = new THREE.Color('#b08a5a');
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const steil = 1 - normalen.getY(i);
    const fleck = fbm(x * 0.05, z * 0.05, 2, 5);
    if (y < 0.4) c.copy(nasserSand);
    else if (y < 1.6) c.copy(sand);
    else {
      c.copy(wiese).lerp(wiese2, fleck * 0.8);
      if (istWald(x, z)) c.lerp(waldboden, 0.7);
      // Felsen: nicht einfarbig, sondern mit hellen und dunklen Flecken
      const felsFarbe = fels.clone().multiplyScalar(0.75 + fbm(x * 0.15, z * 0.15, 3, 6) * 0.5);
      c.lerp(felsFarbe, THREE.MathUtils.smoothstep(steil, 0.18, 0.35));
      c.lerp(felsFarbe, THREE.MathUtils.smoothstep(y, 16, 22));
      c.lerp(schnee, THREE.MathUtils.smoothstep(y, 30, 36));
    }
    const pfad = 1 - THREE.MathUtils.smoothstep(abstandZumPfad(x, z), 1.2, 2.6);
    if (y > 0.4) c.lerp(erde, pfad * 0.85);
    const dorf = 1 - THREE.MathUtils.smoothstep(abstandZumDorf(x, z), 6, 9);
    c.lerp(erde, dorf * 0.6);
    farben[i * 3] = c.r;
    farben[i * 3 + 1] = c.g;
    farben[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(farben, 3));

  const boden = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
  boden.receiveShadow = true;
  return boden;
}
