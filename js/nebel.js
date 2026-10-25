// =============================================================
//  NEBEL 🌫️ – Die anderen Inseln liegen im dichten Nebel
//  Am Anfang kann man nur auf der Startinsel spielen. Um jede
//  andere Insel liegt eine Nebelbank. Mit Boot oder Zauberpilz
//  kommt man nicht hinein – man dreht lieber um.
//  Erst wer die Insel mit dem FERNROHR 🔭 entdeckt, findet den
//  Weg durch den Nebel. Dann verschwindet er.
//  Die Zahlen stehen in einstellungen.js unter "nebel".
// =============================================================
import * as THREE from 'three';
import { EINSTELLUNGEN } from './einstellungen.js';
import { INSELN } from './gelaende.js';

const N = () => EINSTELLUNGEN.nebel || {};

// Ein weicher Verlauf: unten dicht, oben durchsichtig
function nebelBild() {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 128;
  const g = c.getContext('2d');
  const v = g.createLinearGradient(0, 0, 0, 128);
  v.addColorStop(0, 'rgba(255,255,255,0)');
  v.addColorStop(0.45, 'rgba(240,244,248,0.75)');
  v.addColorStop(1, 'rgba(235,240,245,1)');
  g.fillStyle = v;
  g.fillRect(0, 0, 4, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Nebel {
  constructor(szene, karte) {
    this.karte = karte; // die Karte weiß, welche Inseln schon entdeckt sind
    this.waende = new Map(); // Inselname -> Nebelwand
    this.gemeldet = 0;
    if (!N().an) return;
    const material = new THREE.MeshBasicMaterial({
      map: nebelBild(), transparent: true, opacity: N().deckkraft ?? 0.6,
      side: THREE.DoubleSide, depthWrite: false, fog: false,
    });
    for (const I of INSELN.slice(1)) {
      const r = I.radius + (N().abstand ?? 60);
      const hoehe = N().hoehe ?? 45;
      // Zwei Ringe ineinander – so sieht der Nebel dicker aus
      const gruppe = new THREE.Group();
      for (const [faktor, h] of [[1, hoehe], [0.85, hoehe * 0.8]]) {
        const wand = new THREE.Mesh(new THREE.CylinderGeometry(r * faktor, r * faktor, h, 64, 1, true), material);
        wand.position.y = h / 2 - 2;
        wand.renderOrder = 2;
        gruppe.add(wand);
      }
      gruppe.position.set(I.x, 0, I.z);
      szene.add(gruppe);
      this.waende.set(I.name, gruppe);
    }
    this.aktualisiere();
  }

  // Liegt diese Insel noch im Nebel?
  imNebel(name) {
    return !!N().an && !this.karte.entdeckteInseln.includes(name);
  }

  // Ist (x, z) mitten in einer Nebelbank? Dann darf man da nicht hin.
  // Mit (vonX, vonZ) = wo man gerade ist: Nur der Weg IN den Nebel ist gesperrt,
  // herausfahren oder herausfliegen geht immer (sonst könnte man festsitzen).
  sperrt(x, z, vonX, vonZ) {
    if (!N().an) return false;
    for (const I of INSELN.slice(1)) {
      if (!this.imNebel(I.name)) continue;
      const d = Math.hypot(x - I.x, z - I.z);
      if (d >= I.radius + (N().abstand ?? 60)) continue;
      if (vonX !== undefined && d >= Math.hypot(vonX - I.x, vonZ - I.z)) continue; // es geht nach draußen
      return true;
    }
    return false;
  }

  // Einmal melden, wenn man gegen den Nebel fährt oder fliegt (nicht dauernd)
  meldeSperre(meldung, hatFernrohr = false) {
    const jetzt = performance.now();
    if (jetzt - this.gemeldet < 8000) return;
    this.gemeldet = jetzt;
    meldung(hatFernrohr
      ? '🌫️ Dichter Nebel! So findest du den Weg: Geh zurück an die Küste, nimm dein Fernrohr 🔭 in die Hand, drück „Durchschauen“, dreh die Nebelbank in die Mitte und tipp auf „Insel entdecken!“.'
      : '🌫️ Dichter Nebel! Du siehst nichts mehr und drehst lieber um. Mit einem Fernrohr 🔭 könntest du durch den Dunst schauen …', 9);
  }

  // Nebel über entdeckten Inseln verschwinden lassen
  aktualisiere() {
    for (const [name, wand] of this.waende) wand.visible = this.imNebel(name);
  }
}
