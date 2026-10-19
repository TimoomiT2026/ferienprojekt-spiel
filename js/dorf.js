// =============================================================
//  DAS DORF – runde Hütten, ein Brunnen, Laternen und der Händler
//  "Die Dörfer muss man finden" (Game Designer, Tag 1)
// =============================================================
import * as THREE from 'three';
import { DORF } from './gelaende.js';
import { baueFigur } from './figur.js';

function mat(farbe, extra = {}) {
  return new THREE.MeshStandardMaterial({ color: farbe, roughness: 0.85, ...extra });
}

function schild(text) {
  const leinwand = document.createElement('canvas');
  leinwand.width = 256;
  leinwand.height = 96;
  const g = leinwand.getContext('2d');
  g.fillStyle = '#8a5a34';
  g.fillRect(0, 0, 256, 96);
  g.fillStyle = '#fff6e0';
  g.font = 'bold 54px Trebuchet MS, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 128, 50);
  const textur = new THREE.CanvasTexture(leinwand);
  textur.colorSpace = THREE.SRGBColorSpace;
  const tafel = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.9), new THREE.MeshStandardMaterial({ map: textur, roughness: 0.9 }));
  const pfosten = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2, 8), mat('#6b4630'));
  pfosten.position.y = -0.9;
  const gruppe = new THREE.Group();
  tafel.position.y = 0.4;
  gruppe.add(tafel, pfosten);
  return gruppe;
}

function huette(dachFarbe) {
  const h = new THREE.Group();
  const wand = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.8, 2.8, 28), mat('#efe2c4'));
  wand.position.y = 1.4;
  const dach = new THREE.Mesh(new THREE.ConeGeometry(3.6, 2.6, 28), mat(dachFarbe));
  dach.position.y = 4.0;
  const tuer = new THREE.Mesh(new THREE.CapsuleGeometry(0.55, 0.7, 4, 12), mat('#6b4630'));
  tuer.scale.z = 0.3;
  tuer.position.set(0, 1.0, 2.62);
  const fensterMat = mat('#ffd98a', { emissive: '#ffb347', emissiveIntensity: 0 });
  for (const w of [-1, 1]) {
    const fenster = new THREE.Mesh(new THREE.CircleGeometry(0.35, 20), fensterMat);
    fenster.position.set(Math.sin(w * 0.9) * 2.72, 1.8, Math.cos(w * 0.9) * 2.72);
    fenster.lookAt(fenster.position.clone().multiplyScalar(2).setY(1.8));
    h.add(fenster);
  }
  h.add(wand, dach, tuer);
  h.traverse((t) => {
    if (t.isMesh) t.castShadow = t.receiveShadow = true;
  });
  h.userData.fensterMat = fensterMat;
  return h;
}

function marktstand() {
  const stand = new THREE.Group();
  const tisch = new THREE.Mesh(new THREE.BoxGeometry(3, 0.15, 1.3), mat('#9a6a3e'));
  tisch.position.y = 1;
  stand.add(tisch);
  for (const [x, z] of [[-1.4, -0.6], [1.4, -0.6], [-1.4, 0.6], [1.4, 0.6]]) {
    const pfosten = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.6, 8), mat('#7a5236'));
    pfosten.position.set(x, 1.3, z);
    stand.add(pfosten);
  }
  // Gestreiftes Sonnendach
  const leinwand = document.createElement('canvas');
  leinwand.width = 128;
  leinwand.height = 8;
  const g = leinwand.getContext('2d');
  for (let i = 0; i < 8; i++) {
    g.fillStyle = i % 2 ? '#ffffff' : '#e8473f';
    g.fillRect(i * 16, 0, 16, 8);
  }
  const textur = new THREE.CanvasTexture(leinwand);
  textur.colorSpace = THREE.SRGBColorSpace;
  const dach = new THREE.Mesh(
    new THREE.CylinderGeometry(1, 1, 3.4, 24, 1, true, -Math.PI / 2, Math.PI),
    new THREE.MeshStandardMaterial({ map: textur, side: THREE.DoubleSide, roughness: 0.9 })
  );
  dach.rotation.z = Math.PI / 2;
  dach.scale.set(1, 1, 0.5);
  dach.position.y = 2.6;
  stand.add(dach);
  // Waren auf dem Tisch: Äpfel und Kisten
  const apfel = new THREE.SphereGeometry(0.12, 12, 10);
  for (let i = 0; i < 9; i++) {
    const a = new THREE.Mesh(apfel, mat(i % 3 ? '#d93a2b' : '#7bbf3a', { roughness: 0.5 }));
    a.position.set(-1.1 + (i % 3) * 0.22, 1.18, -0.2 + Math.floor(i / 3) * 0.22);
    stand.add(a);
  }
  const holz = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.9, 10), mat('#8a5a34'));
  holz.rotation.z = Math.PI / 2;
  holz.position.set(0.8, 1.2, 0);
  stand.add(holz);
  stand.traverse((t) => {
    if (t.isMesh) t.castShadow = true;
  });
  return stand;
}

function brunnen() {
  const b = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.35, 12, 28), mat('#9a958d'));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.6;
  const rand = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.2, 0.6, 28), mat('#8f8a82'));
  rand.position.y = 0.3;
  const wasser = new THREE.Mesh(new THREE.CircleGeometry(0.9, 24), mat('#2a7fb8', { roughness: 0.1 }));
  wasser.rotation.x = -Math.PI / 2;
  wasser.position.y = 0.55;
  const dach = new THREE.Mesh(new THREE.ConeGeometry(1.6, 1, 24), mat('#8a3b2b'));
  dach.position.y = 2.8;
  b.add(ring, rand, wasser, dach);
  for (const x of [-1.05, 1.05]) {
    const pfosten = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.4, 8), mat('#7a5236'));
    pfosten.position.set(x, 1.5, 0);
    b.add(pfosten);
  }
  b.traverse((t) => {
    if (t.isMesh) t.castShadow = true;
  });
  return b;
}

export class Dorf {
  constructor(szene, hindernisse) {
    this.gruppe = new THREE.Group();
    this.gruppe.position.set(DORF.x, DORF.hoehe, DORF.z);
    this.fensterMaterialien = [];

    const dachFarben = ['#b5523b', '#8a5a34', '#c96f3b', '#7a4b8a', '#3b6f8a', '#b5523b'];
    for (let i = 0; i < 6; i++) {
      const w = (i / 6) * Math.PI * 2 + 0.3;
      const h = huette(dachFarben[i]);
      h.position.set(Math.cos(w) * 15, 0, Math.sin(w) * 15);
      h.rotation.y = Math.atan2(-Math.cos(w), -Math.sin(w)); // Tür zeigt zur Dorfmitte
      this.gruppe.add(h);
      this.fensterMaterialien.push(h.userData.fensterMat);
      hindernisse.hinzufuegen(DORF.x + h.position.x, DORF.z + h.position.z, 2.9);
    }

    const b = brunnen();
    this.gruppe.add(b);
    hindernisse.hinzufuegen(DORF.x, DORF.z, 1.5);

    const stand = marktstand();
    stand.position.set(5, 0, 3);
    stand.rotation.y = -0.9;
    this.gruppe.add(stand);
    hindernisse.hinzufuegen(DORF.x + 5, DORF.z + 3, 1.7);

    // Der Händler steht hinter seinem Stand
    const haendler = baueFigur({ shirt: '#3c8d4a', hose: '#5a4632', haare: '#2b2b2b', haut: '#d9a77c', hut: '#7a5236' });
    this.haendler = haendler.figur;
    this.haendler.position.set(6.1, 0, 3.8);
    this.gruppe.add(this.haendler);
    this.haendlerWelt = new THREE.Vector3(DORF.x + 5, DORF.hoehe, DORF.z + 3);

    // Laternen rund um den Platz – leuchten nachts
    this.laternenMat = mat('#fff1c2', { emissive: '#ffbe55', emissiveIntensity: 0 });
    for (let i = 0; i < 5; i++) {
      const w = (i / 5) * Math.PI * 2;
      const pfahl = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 2.6, 8), mat('#3a3a3a'));
      pfahl.position.set(Math.cos(w) * 9, 1.3, Math.sin(w) * 9);
      const licht = new THREE.Mesh(new THREE.SphereGeometry(0.25, 14, 10), this.laternenMat);
      licht.position.set(Math.cos(w) * 9, 2.75, Math.sin(w) * 9);
      this.gruppe.add(pfahl, licht);
    }
    this.dorfLicht = new THREE.PointLight('#ffbe6a', 0, 40, 1.5);
    this.dorfLicht.position.set(0, 5, 0);
    this.gruppe.add(this.dorfLicht);

    const tafel = schild('DORF');
    tafel.position.set(-22, 1.8, 18);
    tafel.lookAt(new THREE.Vector3(0, DORF.hoehe + 1.8, 0)); // schaut Richtung Zelt
    this.gruppe.add(tafel);

    szene.add(this.gruppe);
    this.zeit = 0;
  }

  aktualisiere(dt, helligkeit, spielerPos) {
    this.zeit += dt;
    const nacht = 1 - helligkeit;
    this.laternenMat.emissiveIntensity = nacht * 3;
    for (const f of this.fensterMaterialien) f.emissiveIntensity = nacht * 2;
    this.dorfLicht.intensity = nacht * 60;
    // Der Händler wippt ein bisschen und schaut zur Figur, wenn sie nah ist
    this.haendler.position.y = Math.abs(Math.sin(this.zeit * 2)) * 0.04;
    if (spielerPos.distanceTo(this.haendlerWelt) < 15) {
      const ziel = spielerPos.clone().sub(this.gruppe.position);
      this.haendler.rotation.y = Math.atan2(ziel.x - this.haendler.position.x, ziel.z - this.haendler.position.z);
    }
  }
}
