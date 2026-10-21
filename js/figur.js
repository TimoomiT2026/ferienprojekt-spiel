// =============================================================
//  FIGUREN – unsere Spielfigur und die Dorfbewohner
//  Alles aus runden Formen: Kapseln und Kugeln
// =============================================================
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

function mat(farbe, rau = 0.8) {
  return new THREE.MeshStandardMaterial({ color: farbe, roughness: rau });
}

export function baueSchaufel() {
  const schaufel = new THREE.Group();
  const stiel = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.1, 8), mat('#a0703c'));
  stiel.position.y = 0.55;
  const griff = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.025, 8, 16), mat('#333333'));
  griff.position.y = 1.12;
  const blatt = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 12), new THREE.MeshStandardMaterial({ color: '#b9c2cc', metalness: 0.7, roughness: 0.3 }));
  blatt.scale.set(1, 1.35, 0.3);
  blatt.position.y = -0.05;
  schaufel.add(stiel, griff, blatt);
  schaufel.traverse((t) => (t.castShadow = true));
  return schaufel;
}

export function baueSchwert() {
  const schwert = new THREE.Group();
  const metall = new THREE.MeshStandardMaterial({ color: '#d5dbe2', metalness: 0.85, roughness: 0.25 });
  const klinge = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.95, 16), metall);
  klinge.scale.z = 0.22;
  klinge.position.y = 0.67;
  const spitze = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.18, 16), metall);
  spitze.scale.z = 0.22;
  spitze.position.y = 1.23;
  const parier = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.32, 4, 10), new THREE.MeshStandardMaterial({ color: '#8a6a2a', metalness: 0.6, roughness: 0.4 }));
  parier.rotation.z = Math.PI / 2;
  parier.position.y = 0.18;
  const griff = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.28, 10), new THREE.MeshStandardMaterial({ color: '#5a3a22', roughness: 0.9 }));
  const knauf = new THREE.Mesh(new THREE.SphereGeometry(0.065, 12, 10), parier.material);
  knauf.position.y = -0.16;
  schwert.add(klinge, spitze, parier, griff, knauf);
  schwert.traverse((t) => (t.castShadow = true));
  return schwert;
}

// Kleiner Helfer: eine Form einfärben und an ihren Platz schieben.
// Viele eingefärbte Formen werden danach zu EINEM Modell zusammengeklebt
// (dann muss der Computer nur einmal malen statt zwanzigmal).
function teil(geo, farbe, pos = [0, 0, 0], skala = [1, 1, 1], dreh = [0, 0, 0]) {
  const g = geo.clone();
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  g.applyMatrix4(new THREE.Matrix4().compose(
    new THREE.Vector3(...pos),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...dreh)),
    new THREE.Vector3(...skala)
  ));
  const c = new THREE.Color(farbe);
  const f = new Float32Array(g.attributes.position.count * 3);
  for (let i = 0; i < f.length; i += 3) f.set([c.r, c.g, c.b], i);
  g.setAttribute('color', new THREE.BufferAttribute(f, 3));
  return g;
}

// Ein runder Drehkörper aus einem Umriss: [[Radius, Höhe], ...]
function dreh(umriss, seiten = 18, start = 0, laenge = Math.PI * 2) {
  return new THREE.LatheGeometry(umriss.map(([r, y]) => new THREE.Vector2(r, y)), seiten, start, laenge);
}

// farben = { shirt, hose, haare, haut, hut, bart }  (bart: false = ohne Bart)
// Ein Erwachsener (der Händler): mit Bart, Schürze, Gürtel und Hut.
export function baueFigur(farben) {
  const figur = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 });
  const dunkler = (f, wie = 0.7) => new THREE.Color(f).multiplyScalar(wie);
  const schuerze = '#e9dfc8';
  const teile = [];

  // Beine (Hose) und Bauch / Oberkörper (Hemd) als runde Drehkörper
  for (const x of [-0.17, 0.17]) {
    teile.push(teil(dreh([[0, 0.14], [0.14, 0.16], [0.15, 0.4], [0.17, 0.62], [0.2, 0.75], [0, 0.78]], 12), farben.hose, [x, 0, 0]));
  }
  teile.push(teil(dreh([[0, 0.66], [0.37, 0.7], [0.45, 0.9], [0.47, 1.1], [0.44, 1.32], [0.38, 1.48], [0.2, 1.6], [0, 1.62]], 20), farben.shirt));
  // Schürze vorne (ein Stück Drehkörper, etwas größer als der Bauch)
  teile.push(teil(dreh([[0.39, 0.42], [0.47, 0.72], [0.485, 0.9], [0.49, 1.1], [0.46, 1.3]], 12, -0.95, 1.9), schuerze, [0, 0, 0], [1, 1, 1], [0, 0, 0]));
  // Gürtel mit Schnalle
  teile.push(teil(new THREE.TorusGeometry(0.455, 0.045, 6, 22), '#4a3020', [0, 0.95, 0], [1, 1, 1], [Math.PI / 2, 0, 0]));
  teile.push(teil(new THREE.BoxGeometry(0.12, 0.09, 0.04), '#c9a043', [0, 0.95, 0.49]));
  // Kragen
  teile.push(teil(new THREE.TorusGeometry(0.17, 0.05, 6, 16), dunkler(farben.shirt, 0.8), [0, 1.6, 0], [1, 1, 1], [Math.PI / 2, 0, 0]));

  // Kopf
  teile.push(teil(new THREE.CylinderGeometry(0.11, 0.13, 0.16, 10), farben.haut, [0, 1.66, 0]));
  teile.push(teil(new THREE.SphereGeometry(0.34, 22, 16), farben.haut, [0, 1.98, 0], [0.95, 1.05, 0.95]));
  for (const s of [-1, 1]) {
    teile.push(teil(new THREE.SphereGeometry(0.07, 10, 8), farben.haut, [s * 0.32, 1.98, -0.02], [0.5, 1, 0.8])); // Ohren
    // Augen: weiß mit dunkler Pupille und Glanzpunkt
    teile.push(teil(new THREE.SphereGeometry(0.055, 12, 10), '#ffffff', [s * 0.12, 2.03, 0.285], [1, 1, 0.6]));
    teile.push(teil(new THREE.SphereGeometry(0.032, 10, 8), '#2a1d14', [s * 0.12, 2.03, 0.318], [1, 1, 0.5]));
    teile.push(teil(new THREE.SphereGeometry(0.01, 6, 4), '#ffffff', [s * 0.12 + 0.012, 2.045, 0.334]));
    // Augenbrauen
    teile.push(teil(new THREE.CapsuleGeometry(0.018, 0.08, 3, 6), farben.haare, [s * 0.12, 2.11, 0.29], [1, 1, 1], [0, 0, Math.PI / 2 + s * 0.15]));
    // rote Bäckchen
    teile.push(teil(new THREE.SphereGeometry(0.05, 8, 6), '#e08a78', [s * 0.2, 1.93, 0.25], [1, 0.7, 0.4]));
  }
  teile.push(teil(new THREE.SphereGeometry(0.065, 12, 10), dunkler(farben.haut, 0.93), [0, 1.95, 0.33], [0.9, 1, 1.1])); // Nase
  // Bart: um Kinn und Wangen, dazu ein Schnurrbart (bart: false = ohne Bart)
  if (farben.bart !== false) teile.push(teil(new THREE.SphereGeometry(0.33, 18, 10, Math.PI * 0.08, Math.PI * 0.84, Math.PI * 0.55, Math.PI * 0.4), farben.haare, [0, 1.99, 0.02], [1, 1.1, 1.05]));
  for (const s of farben.bart !== false ? [-1, 1] : []) {
    teile.push(teil(new THREE.CapsuleGeometry(0.035, 0.1, 4, 8), farben.haare, [s * 0.065, 1.875, 0.31], [1, 1, 1], [0, 0, Math.PI / 2 - s * 0.35]));
  }
  // Haare hinten und an den Seiten (unter dem Hut)
  teile.push(teil(new THREE.SphereGeometry(0.355, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), farben.haare, [0, 2.0, -0.02], [1, 1.02, 1], [-0.35, 0, 0]));

  // Hut mit breiter Krempe und Hutband
  if (farben.hut) {
    teile.push(teil(new THREE.CylinderGeometry(0.6, 0.62, 0.04, 26), farben.hut, [0, 2.22, 0]));
    teile.push(teil(dreh([[0.32, 0], [0.33, 0.18], [0.29, 0.3], [0.15, 0.34], [0, 0.33]], 22), farben.hut, [0, 2.23, 0]));
    teile.push(teil(new THREE.CylinderGeometry(0.335, 0.335, 0.07, 22, 1, true), '#3a2a1e', [0, 2.28, 0]));
  }
  const koerper = new THREE.Mesh(mergeGeometries(teile), material);
  figur.add(koerper);

  // Arme hängen an der Schulter, damit sie beim Laufen schwingen können
  const baueArm = (s) => {
    const arm = new THREE.Group();
    const aermel = mergeGeometries([
      teil(new THREE.SphereGeometry(0.15, 12, 10), farben.shirt, [0, 0, 0]),
      teil(new THREE.CapsuleGeometry(0.115, 0.4, 6, 10), farben.shirt, [0, -0.26, 0]),
      teil(new THREE.TorusGeometry(0.1, 0.03, 6, 12), schuerze, [0, -0.5, 0], [1, 1, 1], [Math.PI / 2, 0, 0]), // hochgekrempelt
    ]);
    arm.add(new THREE.Mesh(aermel, material));
    const hand = new THREE.Mesh(teil(new THREE.SphereGeometry(0.105, 12, 10), farben.haut, [0, 0, 0], [0.9, 1.1, 0.8]), material);
    hand.position.y = -0.62;
    arm.add(hand);
    arm.position.set(s * 0.5, 1.45, 0);
    arm.rotation.z = s * 0.08;
    return { arm, hand };
  };
  const links = baueArm(-1), rechts = baueArm(1);
  const armL = links.arm, armR = rechts.arm, handR = rechts.hand;
  figur.add(armL, armR);

  // Stiefel
  const fussGeo = teil(new THREE.SphereGeometry(0.17, 12, 10), '#3a2b22', [0, 0, 0], [1, 0.75, 1.45]);
  const fussL = new THREE.Mesh(fussGeo, material);
  const fussR = new THREE.Mesh(fussGeo, material);
  fussL.position.set(-0.18, 0.12, 0.06);
  fussR.position.set(0.18, 0.12, 0.06);
  figur.add(fussL, fussR);

  figur.traverse((t) => {
    if (t.isMesh) t.castShadow = true;
  });
  return { figur, koerper, armL, armR, handR, fussL, fussR };
}
