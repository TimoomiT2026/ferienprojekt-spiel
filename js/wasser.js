// =============================================================
//  DAS WASSER – glitzert, weil sich kleine Wellen bewegen
// =============================================================
import * as THREE from 'three';
import { rauschen } from './rauschen.js';
import { WASSER_HOEHE, bodenHoehe } from './gelaende.js';
import { EINSTELLUNGEN } from './einstellungen.js';

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

// Wie tief ist das Wasser überall? Das wird einmal als Bild gespeichert,
// damit das Wasser am Strand hell und flach, draußen dunkel und tief aussieht.
const KARTEN_GROESSE = (EINSTELLUNGEN.inselGroesse + 90) * 2;
function baueTiefenKarte() {
  const n = 256;
  const daten = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const wx = ((x + 0.5) / n - 0.5) * KARTEN_GROESSE;
      const wz = ((y + 0.5) / n - 0.5) * KARTEN_GROESSE;
      const tiefe = THREE.MathUtils.clamp((WASSER_HOEHE - bodenHoehe(wx, wz)) / 6, 0, 1);
      const i = (y * n + x) * 4;
      daten[i] = daten[i + 1] = daten[i + 2] = tiefe * 255;
      daten[i + 3] = 255;
    }
  }
  const textur = new THREE.DataTexture(daten, n, n, THREE.RGBAFormat);
  textur.magFilter = textur.minFilter = THREE.LinearFilter;
  textur.needsUpdate = true;
  return textur;
}

export class Wasser {
  constructor(szene) {
    this.wellen = baueWellenTextur();
    this.zeit = { value: 0 };
    const tiefenKarte = baueTiefenKarte();
    const material = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      roughness: 0.08,
      metalness: 0.1,
      transparent: true,
      normalMap: this.wellen,
      normalScale: new THREE.Vector2(0.35, 0.35),
    });
    material.onBeforeCompile = (shader) => {
      shader.uniforms.tTiefe = { value: tiefenKarte };
      shader.uniforms.uZeit = this.zeit;
      shader.uniforms.uGroesse = { value: KARTEN_GROESSE };
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWP;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP = (modelMatrix * vec4(position, 1.0)).xyz;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform sampler2D tTiefe;\nuniform float uZeit;\nuniform float uGroesse;\nvarying vec3 vWP;')
        .replace('#include <color_fragment>', `#include <color_fragment>
          float tiefe = texture2D(tTiefe, vWP.xz / uGroesse + 0.5).r * 6.0;
          // Flaches Wasser türkis, tiefes Wasser dunkelblau
          vec3 flach = vec3(0.16, 0.62, 0.62);
          vec3 tief = vec3(0.01, 0.12, 0.24);
          diffuseColor.rgb = mix(flach, tief, smoothstep(0.0, 4.5, tiefe));
          // Schaum, wo die Wellen auf den Strand laufen
          float welle = 0.3 + 0.18 * sin(uZeit * 1.4 - tiefe * 9.0 + vWP.x * 0.05);
          float schaum = 1.0 - smoothstep(0.0, welle, tiefe);
          schaum *= 0.55 + 0.45 * texture2D(normalMap, vWP.xz * 0.08 + uZeit * 0.01).r;
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.92, 0.96, 0.98), schaum * 0.85);
          diffuseColor.a = max(mix(0.45, 0.94, smoothstep(0.0, 3.0, tiefe)), schaum);`);
    };
    material.customProgramCacheKey = () => 'wasser';
    const geo = new THREE.PlaneGeometry(1800, 1800);
    geo.rotateX(-Math.PI / 2);
    this.flaeche = new THREE.Mesh(geo, material);
    this.flaeche.position.y = WASSER_HOEHE;
    this.flaeche.receiveShadow = true;
    szene.add(this.flaeche);
  }

  aktualisiere(dt) {
    this.zeit.value += dt;
    this.wellen.offset.x += dt * 0.004;
    this.wellen.offset.y += dt * 0.0025;
  }
}
