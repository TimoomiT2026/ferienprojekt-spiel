// =============================================================
//  TEXTUREN – echte Fotos von Gras, Fels, Rinde und Blättern
//  Eine Textur ist ein Bild, das wie eine Tapete auf eine 3D-Form
//  geklebt wird. Die Fotos sind frei (CC0), siehe assets/texturen/QUELLEN.md
// =============================================================
import * as THREE from 'three';

const lader = new THREE.TextureLoader();
const cache = new Map();
let anisotropie = 4;

export function setzeAnisotropie(wert) {
  anisotropie = wert;
}

// farbe = true für Farbfotos (sRGB), false für "Normal Maps" (Beulen-Bilder)
export function textur(name, { farbe = true, wiederholen = true } = {}) {
  if (cache.has(name)) return cache.get(name);
  const t = lader.load(`assets/texturen/${name}`);
  if (farbe) t.colorSpace = THREE.SRGBColorSpace;
  if (wiederholen) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = anisotropie;
  cache.set(name, t);
  return t;
}
