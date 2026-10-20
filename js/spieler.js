// =============================================================
//  DIE SPIELFIGUR – wie sie sich bewegt
//  Die Figur selbst (der Junge mit Skelett) kommt aus junge.js.
//  Hier steht, wie er läuft, rennt, springt, gräbt und das Schwert schwingt.
// =============================================================
import * as THREE from 'three';
import { EINSTELLUNGEN } from './einstellungen.js';
import { bodenHoehe, WASSER_HOEHE } from './gelaende.js';
import { baueSchaufel, baueSchwert } from './figur.js';
import { baueJunge, BEIN_LAENGE } from './junge.js';

// ---------- Zahlen für die Animation (zum Rumprobieren) ----------
// Wie weit kommt er mit einem Doppelschritt (links + rechts)? In Spiel-Metern.
const SCHRITT_GEHEN = 2.0;
const SCHRITT_RENNEN = 3.7;
// Wie weit schwingen die Beine und Arme?
const BEIN_SCHWUNG = 0.75;
const ARM_SCHWUNG = 0.85;

const glatt = (a, b, x) => {
  const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const mische = THREE.MathUtils.lerp;

export class Spieler {
  constructor(szene, hindernisse) {
    // Der Junge (Farben siehe JUNGE_FARBEN in junge.js – der Rucksack ist schon dran)
    const teile = baueJunge();
    Object.assign(this, teile);
    this.k = teile.knochen;

    // Die Schaufel in der rechten Hand (nur sichtbar, wenn man sie hält)
    // Die Hand hält den Stiel oben am Griff – das Schaufelblatt zeigt nach unten
    this.schaufel = new THREE.Group();
    const schaufelModell = baueSchaufel();
    schaufelModell.position.y = -0.95;
    this.schaufel.add(schaufelModell);
    // (die Hand ist etwas nach vorne geknickt, darum hier zurückdrehen)
    this.schaufel.rotation.x = 0.95;
    this.schaufel.visible = false;
    this.handR.add(this.schaufel);

    // Das Schwert (wird an der Werkbank gebaut)
    this.schwert = baueSchwert();
    this.schwert.rotation.x = 2.17;
    this.schwert.visible = false;
    this.handR.add(this.schwert);
    this.schwungZeit = 0;

    // Halter für die Angel (die Angel selbst kommt aus angeln.js)
    this.angel = new THREE.Group();
    this.angel.rotation.x = 1.75;
    this.angel.visible = false;
    this.handR.add(this.angel);

    // 1 = normal. Mit Hunger läuft man langsamer (0.5)
    this.tempoFaktor = 1;

    // Nachts hat die Figur eine kleine Laterne dabei
    this.laterne = new THREE.PointLight('#ffcf8a', 0, 18, 1.4);
    this.laterne.position.set(0, 3.4, 1.4);
    this.figur.add(this.laterne);

    this.hindernisse = hindernisse;
    this.geschwindigkeitY = 0;
    this.amBoden = true;
    this.laufZeit = 0; // wo im Schritt-Takt sind wir gerade?
    this.grabZeit = 0;
    this.tempoJetzt = 0; // wie schnell er gerade wirklich läuft (geglättet)
    this.uhr = 0; // für Atmen und Umschauen
    this.luft = 0; // 0 = am Boden, 1 = in der Luft (geglättet)
    this.figur.position.set(0, bodenHoehe(0, 4), 4);
    szene.add(this.figur);
  }

  kannStehen(x, z) {
    return bodenHoehe(x, z) > WASSER_HOEHE - 0.5 && !this.hindernisse.trifft(x, z, 0.4);
  }

  schwingen() {
    if (this.schwungZeit <= 0) this.schwungZeit = 0.45;
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
    let tempoZiel = 0;

    if (staerke > 0.05) {
      // Joystick-Richtung so drehen, dass "nach vorne" = "weg von der Kamera" ist
      const sin = Math.sin(kameraWinkel), cos = Math.cos(kameraWinkel);
      const dx = (richtung.x * cos - richtung.y * sin) / Math.max(laenge, 1);
      const dz = (-richtung.x * sin - richtung.y * cos) / Math.max(laenge, 1);
      const schritt = EINSTELLUNGEN.laufTempo * this.tempoFaktor * staerke * dt;
      const neuX = pos.x + dx * schritt;
      const neuZ = pos.z + dz * schritt;
      const altX = pos.x, altZ = pos.z;

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
      // So schnell sind wir wirklich gekommen (an einem Baum: fast gar nicht)
      if (dt > 0) tempoZiel = Math.hypot(pos.x - altX, pos.z - altZ) / dt;
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

    this.animiere(dt, tempoZiel);
  }

  // ---------- Die Animation: Knochen drehen ----------
  animiere(dt, tempoZiel) {
    const k = this.k;
    this.uhr += dt;
    // Tempo weich angleichen, damit die Beine nicht ruckeln
    this.tempoJetzt += (tempoZiel - this.tempoJetzt) * Math.min(1, dt * 10);
    const tempo = this.tempoJetzt;
    const bewegt = glatt(0.15, 1.5, tempo); // 0 = steht, 1 = bewegt sich
    const renn = glatt(2.5, 6, tempo); // 0 = gehen, 1 = rennen
    this.luft += ((this.amBoden ? 0 : 1) - this.luft) * Math.min(1, dt * 12);

    // Takt: je schneller, desto schneller die Schritte
    const schritt = mische(SCHRITT_GEHEN, SCHRITT_RENNEN, renn);
    this.laufZeit += (dt * Math.PI * 2 * tempo) / schritt;
    if (bewegt < 0.01) this.laufZeit *= 0.9; // stehen: Beine laufen langsam aus
    const p = this.laufZeit;

    // ---- Beine ----
    // Oberschenkel nach vorne = negativer Winkel, Knie beugen = positiver Winkel
    const beinPose = (phase) => {
      const s = Math.sin(phase), c = Math.cos(phase);
      const schwung = BEIN_SCHWUNG * mische(0.6, 1, renn) * bewegt;
      let ober = -s * schwung - 0.12 * renn * bewegt;
      // Das Knie beugt sich, wenn das Bein nach vorne schwingt
      const vorschwung = Math.max(0, Math.cos(phase + 0.35 * renn));
      let knie = (mische(0.12, 0.22, renn) + vorschwung * mische(0.75, 1.3, renn)) * bewegt;
      knie += Math.max(0, -s) * 0.15 * bewegt; // hinten etwas einknicken
      // In der Luft: Beine anziehen
      ober = mische(ober, -0.75 + s * 0.25, this.luft);
      knie = mische(knie, 1.15 - s * 0.3, this.luft);
      // Der Fuß bleibt ungefähr waagerecht, hinten drückt er sich ab
      let fuss = -(ober + knie) * 0.75 + Math.max(0, -s) * 0.45 * bewegt * (1 - this.luft);
      if (bewegt < 0.01 && this.luft < 0.01) fuss = -(ober + knie);
      return { ober, knie, fuss };
    };
    const links = beinPose(p), rechts = beinPose(p + Math.PI);
    k.beinL.rotation.set(links.ober, 0, -0.02);
    k.knieL.rotation.x = links.knie;
    k.fussL.rotation.x = links.fuss;
    k.beinR.rotation.set(rechts.ober, 0, 0.02);
    k.knieR.rotation.x = rechts.knie;
    k.fussR.rotation.x = rechts.fuss;

    // Die Hüfte so hoch, dass das Standbein genau den Boden berührt
    const reichweite = (b) => BEIN_LAENGE * (Math.cos(b.ober) + Math.cos(b.ober + b.knie));
    let hoehe = Math.max(reichweite(links), reichweite(rechts));
    hoehe = mische(hoehe, BEIN_LAENGE * 2 - 0.02, this.luft);
    const flug = Math.max(0, Math.sin(p * 2)) * 0.028 * renn * bewegt; // beim Rennen kurz fliegen
    const atem = Math.sin(this.uhr * 2.3);
    k.huefte.position.y = 0.085 + 0.045 + hoehe + flug;
    k.huefte.rotation.set(0, Math.sin(p) * 0.18 * bewegt, Math.cos(p) * 0.045 * bewegt * (1 - renn * 0.5));

    // ---- Oberkörper ----
    const vorlage = mische(0.04, 0.2, renn) * bewegt; // beim Rennen nach vorne lehnen
    k.bauch.rotation.set(vorlage * 0.5 - atem * 0.012 * (1 - bewegt), 0, 0);
    k.brust.rotation.set(vorlage * 0.5 + atem * 0.02 * (1 - bewegt), -Math.sin(p) * 0.28 * bewegt, -k.huefte.rotation.z * 0.8);
    // Der Kopf schaut geradeaus (gleicht das Vorlehnen aus) und schaut sich im Stehen um
    const umschauen = Math.sin(this.uhr * 0.45) * Math.sin(this.uhr * 0.17 + 1);
    k.hals.rotation.set(-vorlage * 0.6, Math.sin(p) * 0.08 * bewegt, 0);
    k.kopf.rotation.set(-vorlage * 0.3 + Math.sin(p * 2) * 0.03 * bewegt, umschauen * 0.35 * (1 - bewegt), 0);

    // ---- Arme (gegengleich zu den Beinen) ----
    const armSchwung = ARM_SCHWUNG * mische(0.55, 1, renn) * bewegt;
    const armLuft = this.luft;
    const ellbogenBasis = mische(0.18, 1.25, renn) * bewegt + 0.12;
    const hatWerkzeug = this.schaufel.visible || this.schwert.visible || this.angel.visible;
    // linker Arm
    k.schulterL.rotation.set(
      mische(Math.sin(p) * armSchwung - 0.1 * renn * bewegt, -0.9, armLuft),
      0,
      mische(-0.1 - atem * 0.015 * (1 - bewegt), -0.55, armLuft)
    );
    k.ellbogenL.rotation.x = -(ellbogenBasis + Math.max(0, -Math.sin(p)) * 0.35 * bewegt) * (1 - armLuft) - 0.6 * armLuft;
    // rechter Arm
    if (hatWerkzeug) {
      k.schulterR.rotation.set(-0.35 - Math.sin(p) * armSchwung * 0.3, 0, 0.1);
      k.ellbogenR.rotation.x = -0.75 - 0.2 * renn * bewegt;
    } else {
      k.schulterR.rotation.set(
        mische(-Math.sin(p) * armSchwung - 0.1 * renn * bewegt, -0.9, armLuft),
        0,
        mische(0.1 + atem * 0.015 * (1 - bewegt), 0.55, armLuft)
      );
      k.ellbogenR.rotation.x = -(ellbogenBasis + Math.max(0, Math.sin(p)) * 0.35 * bewegt) * (1 - armLuft) - 0.6 * armLuft;
    }

    // ---- Schwert-Schwung: Arm schnell von oben nach vorne ----
    if (this.schwungZeit > 0) {
      this.schwungZeit -= dt;
      const t = 1 - this.schwungZeit / 0.45;
      this.armR.rotation.x = -2.8 + t * 2.6;
      this.armR.rotation.z = Math.sin(t * Math.PI) * 0.4;
      k.ellbogenR.rotation.x = -0.25;
      k.brust.rotation.y += -0.35 + t * 0.6; // mit dem ganzen Körper ausholen
    }

    // ---- Graben: Schaufel hoch und runter, Körper beugt sich mit ----
    if (this.grabZeit > 0) {
      this.grabZeit -= dt;
      const w = Math.sin(this.grabZeit * 14);
      this.armR.rotation.set(-1.0 + w * 0.6, 0, 0.15);
      this.armL.rotation.set(-0.9 + w * 0.4, 0, -0.15);
      k.ellbogenR.rotation.x = -0.25;
      k.ellbogenL.rotation.x = -0.6;
      k.bauch.rotation.x = 0.25 - w * 0.12;
      k.brust.rotation.x = 0.15;
      k.hals.rotation.x = -0.15;
      k.knieL.rotation.x = k.knieR.rotation.x = 0.35;
      k.beinL.rotation.x = k.beinR.rotation.x = -0.25;
      k.fussL.rotation.x = k.fussR.rotation.x = -0.1;
      k.huefte.position.y = 0.13 + BEIN_LAENGE * (Math.cos(-0.25) + Math.cos(0.1));
    }
  }
}
