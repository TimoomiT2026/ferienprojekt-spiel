// =============================================================
//  DIE SPIELFIGUR – wie sie aussieht und wie sie sich bewegt
// =============================================================
import * as THREE from 'three';
import { EINSTELLUNGEN } from './einstellungen.js';
import { bodenHoehe, WASSER_HOEHE } from './welt.js';

function toon(farbe) {
  return new THREE.MeshToonMaterial({ color: farbe });
}

// Die Figur ist aus runden Formen gebaut: Kapsel-Körper, Kugel-Kopf
function baueFigur() {
  const figur = new THREE.Group();
  const koerper = new THREE.Mesh(new THREE.CapsuleGeometry(0.45, 0.7, 6, 14), toon('#3d7bff'));
  koerper.position.y = 0.95;
  const kopf = new THREE.Mesh(new THREE.SphereGeometry(0.42, 20, 16), toon('#ffd2a6'));
  kopf.position.y = 1.95;
  const haare = new THREE.Mesh(
    new THREE.SphereGeometry(0.44, 20, 16, 0, Math.PI * 2, 0, Math.PI / 2.2),
    toon('#6b3e1f')
  );
  haare.position.y = 2.0;
  const augeGeo = new THREE.SphereGeometry(0.06, 10, 8);
  const augeMat = toon('#222222');
  const augeL = new THREE.Mesh(augeGeo, augeMat);
  const augeR = new THREE.Mesh(augeGeo, augeMat);
  augeL.position.set(-0.15, 2.0, 0.38);
  augeR.position.set(0.15, 2.0, 0.38);
  // Der Rucksack aus der Mindmap (später: Inventar!)
  const rucksack = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.35, 4, 10), toon('#c0392b'));
  rucksack.position.set(0, 1.05, -0.45);
  const fussGeo = new THREE.SphereGeometry(0.2, 12, 10);
  const fussL = new THREE.Mesh(fussGeo, toon('#333333'));
  const fussR = new THREE.Mesh(fussGeo, toon('#333333'));
  fussL.position.set(-0.2, 0.15, 0);
  fussR.position.set(0.2, 0.15, 0);
  figur.add(koerper, kopf, haare, augeL, augeR, rucksack, fussL, fussR);
  figur.traverse((teil) => (teil.castShadow = true));
  return { figur, fussL, fussR, koerper };
}

export class Spieler {
  constructor(szene, hindernisse) {
    const { figur, fussL, fussR, koerper } = baueFigur();
    this.figur = figur;
    this.fuesse = [fussL, fussR];
    this.koerper = koerper;
    this.hindernisse = hindernisse;
    this.geschwindigkeitY = 0;
    this.amBoden = true;
    this.laufZeit = 0;
    figur.position.set(0, bodenHoehe(0, 0), 2);
    szene.add(figur);
  }

  // Wird jedes Bild aufgerufen (ca. 60 Mal pro Sekunde!)
  // richtung = wohin der Joystick zeigt, kameraWinkel = wohin die Kamera schaut
  aktualisiere(dt, richtung, springen, kameraWinkel) {
    const pos = this.figur.position;
    const staerke = Math.min(1, Math.hypot(richtung.x, richtung.y));

    if (staerke > 0.05) {
      // Joystick-Richtung so drehen, dass "nach vorne" = "weg von der Kamera" ist
      const sin = Math.sin(kameraWinkel), cos = Math.cos(kameraWinkel);
      const dx = richtung.x * cos - richtung.y * sin;
      const dz = -richtung.x * sin - richtung.y * cos;
      const schritt = EINSTELLUNGEN.laufTempo * staerke * dt;
      const neuX = pos.x + dx * schritt;
      const neuZ = pos.z + dz * schritt;

      // Nicht ins tiefe Wasser laufen und nicht durch Bäume/Felsen
      if (bodenHoehe(neuX, neuZ) > WASSER_HOEHE - 0.4 && !this.stoesstAn(neuX, neuZ)) {
        pos.x = neuX;
        pos.z = neuZ;
      } else if (bodenHoehe(neuX, pos.z) > WASSER_HOEHE - 0.4 && !this.stoesstAn(neuX, pos.z)) {
        pos.x = neuX; // an Hindernissen entlangrutschen
      } else if (bodenHoehe(pos.x, neuZ) > WASSER_HOEHE - 0.4 && !this.stoesstAn(pos.x, neuZ)) {
        pos.z = neuZ;
      }

      // Figur in Laufrichtung drehen (weich, nicht ruckartig)
      const zielWinkel = Math.atan2(dx, dz);
      let diff = zielWinkel - this.figur.rotation.y;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      this.figur.rotation.y += diff * Math.min(1, dt * 12);

      // Lauf-Animation: Füße wippen
      this.laufZeit += dt * 10 * staerke;
    } else {
      this.laufZeit *= 0.9;
    }
    const wippen = Math.sin(this.laufZeit);
    this.fuesse[0].position.z = wippen * 0.25;
    this.fuesse[1].position.z = -wippen * 0.25;
    this.koerper.position.y = 0.95 + Math.abs(wippen) * 0.05;

    // Springen und Schwerkraft
    if (springen && this.amBoden) {
      this.geschwindigkeitY = EINSTELLUNGEN.sprungKraft;
      this.amBoden = false;
    }
    this.geschwindigkeitY -= EINSTELLUNGEN.schwerkraft * dt;
    pos.y += this.geschwindigkeitY * dt;
    const boden = Math.max(bodenHoehe(pos.x, pos.z), WASSER_HOEHE - 0.4);
    if (pos.y <= boden) {
      pos.y = boden;
      this.geschwindigkeitY = 0;
      this.amBoden = true;
    }
  }

  stoesstAn(x, z) {
    for (const h of this.hindernisse) {
      if (Math.hypot(x - h.x, z - h.z) < h.radius + 0.4) return true;
    }
    return false;
  }
}
