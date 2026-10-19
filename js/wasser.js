// =============================================================
//  DAS WASSER – glitzert, weil sich kleine Wellen bewegen
// =============================================================
import * as THREE from 'three';
import { rauschen } from './rauschen.js';
import { WASSER_HOEHE } from './gelaende.js';

// Eine Wellen-Textur aus Rauschen bauen ("Normal Map": sagt dem Licht,
// wie schräg die Oberfläche an jeder Stelle ist)
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

export class Wasser {
  constructor(szene) {
    this.wellen = baueWellenTextur();
    const material = new THREE.MeshStandardMaterial({
      color: '#1f7fb8',
      roughness: 0.12,
      metalness: 0.15,
      transparent: true,
      opacity: 0.86,
      normalMap: this.wellen,
      normalScale: new THREE.Vector2(0.3, 0.3),
    });
    const geo = new THREE.PlaneGeometry(1800, 1800);
    geo.rotateX(-Math.PI / 2);
    this.flaeche = new THREE.Mesh(geo, material);
    this.flaeche.position.y = WASSER_HOEHE;
    this.flaeche.receiveShadow = true;
    szene.add(this.flaeche);
  }

  aktualisiere(dt) {
    this.wellen.offset.x += dt * 0.004;
    this.wellen.offset.y += dt * 0.0025;
  }
}
