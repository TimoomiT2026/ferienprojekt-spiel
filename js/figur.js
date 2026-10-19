// =============================================================
//  FIGUREN – unsere Spielfigur und die Dorfbewohner
//  Alles aus runden Formen: Kapseln und Kugeln
// =============================================================
import * as THREE from 'three';

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

// farben = { shirt, hose, haare, haut, hut }
export function baueFigur(farben) {
  const figur = new THREE.Group();
  const koerper = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.55, 8, 16), mat(farben.shirt));
  koerper.position.y = 1.05;
  const hose = new THREE.Mesh(new THREE.CapsuleGeometry(0.4, 0.15, 8, 16), mat(farben.hose));
  hose.position.y = 0.62;
  const kopf = new THREE.Mesh(new THREE.SphereGeometry(0.4, 24, 18), mat(farben.haut, 0.6));
  kopf.position.y = 1.95;
  const haare = new THREE.Mesh(new THREE.SphereGeometry(0.42, 24, 18, 0, Math.PI * 2, 0, Math.PI / 2.1), mat(farben.haare, 0.9));
  haare.position.y = 2.0;
  haare.rotation.x = -0.15;
  const augeGeo = new THREE.SphereGeometry(0.055, 12, 10);
  const augeMat = mat('#1d1d1d', 0.3);
  const augeL = new THREE.Mesh(augeGeo, augeMat);
  const augeR = new THREE.Mesh(augeGeo, augeMat);
  augeL.position.set(-0.14, 1.98, 0.36);
  augeR.position.set(0.14, 1.98, 0.36);
  const nase = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), mat(farben.haut, 0.6));
  nase.position.set(0, 1.9, 0.4);
  figur.add(koerper, hose, kopf, haare, augeL, augeR, nase);

  if (farben.hut) {
    const krempe = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.05, 24), mat(farben.hut));
    krempe.position.y = 2.22;
    const oben = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.38, 0.32, 24), mat(farben.hut));
    oben.position.y = 2.38;
    figur.add(krempe, oben);
  }

  // Arme hängen an der Schulter, damit sie beim Laufen schwingen können
  const armGeo = new THREE.CapsuleGeometry(0.12, 0.45, 6, 10);
  armGeo.translate(0, -0.3, 0);
  const armL = new THREE.Group(), armR = new THREE.Group();
  armL.add(new THREE.Mesh(armGeo, mat(farben.shirt)));
  armR.add(new THREE.Mesh(armGeo, mat(farben.shirt)));
  const handGeo = new THREE.SphereGeometry(0.11, 12, 10);
  const handL = new THREE.Mesh(handGeo, mat(farben.haut, 0.6));
  const handR = new THREE.Mesh(handGeo, mat(farben.haut, 0.6));
  handL.position.y = handR.position.y = -0.62;
  armL.add(handL);
  armR.add(handR);
  armL.position.set(-0.52, 1.45, 0);
  armR.position.set(0.52, 1.45, 0);
  figur.add(armL, armR);

  const fussGeo = new THREE.SphereGeometry(0.17, 12, 10);
  fussGeo.scale(1, 0.7, 1.4);
  const fussL = new THREE.Mesh(fussGeo, mat('#3a2b22'));
  const fussR = new THREE.Mesh(fussGeo, mat('#3a2b22'));
  fussL.position.set(-0.2, 0.12, 0.05);
  fussR.position.set(0.2, 0.12, 0.05);
  figur.add(fussL, fussR);

  figur.traverse((t) => {
    if (t.isMesh) t.castShadow = true;
  });
  return { figur, koerper, armL, armR, handR, fussL, fussR };
}
