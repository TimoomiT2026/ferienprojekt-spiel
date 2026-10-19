// =============================================================
//  DIE SPIELFIGUR – wie sie sich bewegt
// =============================================================
import * as THREE from 'three';
import { EINSTELLUNGEN } from './einstellungen.js';
import { bodenHoehe, WASSER_HOEHE } from './gelaende.js';
import { baueFigur, baueSchaufel } from './figur.js';

export class Spieler {
  constructor(szene, hindernisse) {
    const teile = baueFigur({ shirt: '#3d7bff', hose: '#2b3a55', haare: '#6b3e1f', haut: '#f2c6a0' });
    Object.assign(this, teile);
    // Der Rucksack aus der Mindmap
    const rucksack = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.3, 0.32, 6, 12),
      new THREE.MeshStandardMaterial({ color: '#c0392b', roughness: 0.9 })
    );
    rucksack.position.set(0, 1.1, -0.42);
    rucksack.castShadow = true;
    this.figur.add(rucksack);

    // Die Schaufel in der rechten Hand (nur sichtbar, wenn man sie hält)
    this.schaufel = baueSchaufel();
    this.schaufel.position.set(0, -0.62, 0.05);
    this.schaufel.rotation.x = 1.3;
    this.schaufel.visible = false;
    this.armR.add(this.schaufel);

    // Nachts hat die Figur eine kleine Laterne dabei
    this.laterne = new THREE.PointLight('#ffcf8a', 0, 18, 1.4);
    this.laterne.position.set(0, 3.4, 1.4);
    this.figur.add(this.laterne);

    this.hindernisse = hindernisse;
    this.geschwindigkeitY = 0;
    this.amBoden = true;
    this.laufZeit = 0;
    this.grabZeit = 0;
    this.figur.position.set(0, bodenHoehe(0, 4), 4);
    szene.add(this.figur);
  }

  kannStehen(x, z) {
    return bodenHoehe(x, z) > WASSER_HOEHE - 0.5 && !this.hindernisse.trifft(x, z, 0.4);
  }

  // Graben-Animation starten
  graben() {
    this.grabZeit = 0.9;
  }

  // Wird jedes Bild aufgerufen (ca. 60 Mal pro Sekunde!)
  aktualisiere(dt, richtung, springen, kameraWinkel) {
    const pos = this.figur.position;
    const laenge = Math.hypot(richtung.x, richtung.y);
    let staerke = Math.min(1, laenge);
    if (this.grabZeit > 0) staerke = 0; // beim Graben bleibt man stehen

    if (staerke > 0.05) {
      // Joystick-Richtung so drehen, dass "nach vorne" = "weg von der Kamera" ist
      const sin = Math.sin(kameraWinkel), cos = Math.cos(kameraWinkel);
      const dx = (richtung.x * cos - richtung.y * sin) / Math.max(laenge, 1);
      const dz = (-richtung.x * sin - richtung.y * cos) / Math.max(laenge, 1);
      const schritt = EINSTELLUNGEN.laufTempo * staerke * dt;
      const neuX = pos.x + dx * schritt;
      const neuZ = pos.z + dz * schritt;

      // Nicht ins tiefe Wasser und nicht durch Bäume/Felsen – sonst entlangrutschen
      if (this.kannStehen(neuX, neuZ)) {
        pos.x = neuX;
        pos.z = neuZ;
      } else if (this.kannStehen(neuX, pos.z)) {
        pos.x = neuX;
      } else if (this.kannStehen(pos.x, neuZ)) {
        pos.z = neuZ;
      }

      // Figur weich in Laufrichtung drehen
      let diff = Math.atan2(dx, dz) - this.figur.rotation.y;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      this.figur.rotation.y += diff * Math.min(1, dt * 12);
      this.laufZeit += dt * 10 * staerke;
    } else {
      this.laufZeit *= 0.85;
    }

    // Lauf-Animation: Füße und Arme schwingen
    const w = Math.sin(this.laufZeit);
    this.fussL.position.z = 0.05 + w * 0.25;
    this.fussR.position.z = 0.05 - w * 0.25;
    this.armL.rotation.x = -w * 0.6;
    this.armR.rotation.x = this.schaufel.visible ? -0.5 + w * 0.2 : w * 0.6;
    this.koerper.position.y = 1.05 + Math.abs(w) * 0.04;

    // Graben-Animation: Schaufel hoch und runter
    if (this.grabZeit > 0) {
      this.grabZeit -= dt;
      this.armR.rotation.x = -1.2 + Math.sin(this.grabZeit * 14) * 0.9;
      this.armL.rotation.x = -0.8 + Math.sin(this.grabZeit * 14) * 0.5;
    }

    // Springen und Schwerkraft
    if (springen && this.amBoden) {
      this.geschwindigkeitY = EINSTELLUNGEN.sprungKraft;
      this.amBoden = false;
    }
    this.geschwindigkeitY -= EINSTELLUNGEN.schwerkraft * dt;
    pos.y += this.geschwindigkeitY * dt;
    const boden = Math.max(bodenHoehe(pos.x, pos.z), WASSER_HOEHE - 0.5);
    if (pos.y <= boden) {
      pos.y = boden;
      this.geschwindigkeitY = 0;
      this.amBoden = true;
    }
  }
}
