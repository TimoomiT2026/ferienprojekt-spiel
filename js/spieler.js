// =============================================================
//  DIE SPIELFIGUR – wie sie sich bewegt
//  Die Figur selbst (der Junge mit Skelett) kommt aus junge.js.
//  Hier steht, wie er läuft, rennt, springt, gräbt und das Schwert schwingt.
//  Und: Nach einem Zauberpilz kann er eine Minute lang FLIEGEN!
// =============================================================
import * as THREE from 'three';
import { EINSTELLUNGEN } from './einstellungen.js';
import { bodenHoehe, WASSER_HOEHE, zuSteilBergauf, istKlippenWand, wasserHoeheBei } from './gelaende.js';
import { baueSchaufel, baueSchwert } from './figur.js';
import { baueJunge, BEIN_LAENGE } from './junge.js';

// ---------- Zahlen für die Animation (zum Rumprobieren) ----------
// Wie weit kommt er mit einem Doppelschritt (links + rechts)? In Spiel-Metern.
const SCHRITT_GEHEN = 2.0;
const SCHRITT_RENNEN = 3.7;
// Wie weit schwingen die Beine und Arme?
const BEIN_SCHWUNG = 0.75;
const ARM_SCHWUNG = 0.85;
// Glitzerspur beim Fliegen: wie viele Funken gibt es höchstens, wie viele pro Sekunde?
const SPUR_FUNKEN = 70;
const FUNKEN_PRO_SEKUNDE = 45;
// So viele Sekunden vor Flug-Ende kommt die Warnung
const WARN_SEKUNDEN = 5;

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

    // ---------- Fliegen (nach einem Zauberpilz) ----------
    this.flugModus = false; // true vom Abheben bis zur Landung
    this.flugZeit = 0; // so viele Sekunden darf man noch fliegen
    this.flugV = new THREE.Vector2(); // Flug-Geschwindigkeit (x, z)
    this.flugUhr = 0;
    this.gewarnt = false;
    this.landeZiel = null; // wohin wir beim Landen gleiten (wenn unter uns Wasser ist)
    this.drehTempo = 0; // wie schnell wir uns gerade drehen (für die Kurvenlage)
    // Wer Bescheid wissen will, setzt diese Funktionen (z. B. main.js für Meldungen):
    this.beiFlugWarnung = null; // noch 5 Sekunden!
    this.beiFlugEnde = null; // Zauber vorbei – jetzt wird gelandet
    this.beiGelandet = null; // wieder sicher auf dem Boden
    this.baueGlitzerSpur(szene);
  }

  // ---------- Glitzerspur: viele kleine Funken, aber nur 1 Draw Call ----------
  baueGlitzerSpur(szene) {
    const material = new THREE.MeshBasicMaterial({
      color: '#ffffff',
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending, // Funken leuchten, wenn sie sich überlappen
      depthWrite: false,
      toneMapped: false, // extra hell, damit sie richtig strahlen
    });
    this.spur = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.09, 0), material, SPUR_FUNKEN);
    this.spur.frustumCulled = false;
    this.spur.visible = false;
    const farben = ['#ffe27a', '#ff9ad5', '#b58cff', '#8fe9ff', '#ffffff'].map((f) => new THREE.Color(f));
    this.funken = [];
    const leer = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < SPUR_FUNKEN; i++) {
      this.funken.push({ pos: new THREE.Vector3(), v: new THREE.Vector3(), leben: 0, dauer: 1, groesse: 1 });
      this.spur.setMatrixAt(i, leer);
      this.spur.setColorAt(i, farben[i % farben.length]);
    }
    this.naechsterFunke = 0;
    this.funkenGuthaben = 0;
    szene.add(this.spur);
  }

  // ---------- Fliegen ----------
  // Startet den Flug. Isst man noch einen Pilz, gibt es extra Zeit dazu.
  fliegen(sekunden = EINSTELLUNGEN.flugSekunden) {
    if (this.flugModus && this.flugZeit > 0) {
      this.flugZeit += sekunden;
    } else {
      this.flugZeit = sekunden;
      this.abhebZeit = this.flugModus ? 0 : 0.9; // am Anfang hebt er von selbst ein Stück ab
      if (!this.flugModus) this.flugV.set(0, 0);
    }
    this.flugModus = true;
    this.gewarnt = this.flugZeit <= WARN_SEKUNDEN;
    this.landeZiel = null;
    this.amBoden = false;
    this.grabZeit = 0;
    return true;
  }

  // Vorzeitig landen (z. B. um zu graben oder zu handeln).
  // Der restliche Zauber ist dann aufgebraucht.
  landen() {
    if (!this.flugModus || this.flugZeit <= 0) return;
    this.flugZeit = 0;
    this.abhebZeit = 0;
    this.beiFlugEnde?.(true);
  }

  // Fliegt er gerade? (auch noch während der Landung)
  get fliegt() {
    return this.flugModus;
  }

  // Wie viele Sekunden Flug sind noch übrig?
  get flugRest() {
    return Math.max(0, this.flugZeit);
  }

  // Darf man hier landen? (fester Boden, kein Baum, kein Wasser)
  kannLanden(x, z) {
    return bodenHoehe(x, z) > wasserHoeheBei(x, z) + 0.3 && this.kannStehen(x, z) && !istKlippenWand(x, z);
  }

  // Sucht in immer größeren Kreisen den nächsten Platz zum Landen
  sucheLandeplatz(x, z) {
    for (let r = 2; r <= 600; r += 3) {
      const punkte = Math.min(96, Math.ceil((Math.PI * 2 * r) / 3));
      for (let i = 0; i < punkte; i++) {
        const w = (i / punkte) * Math.PI * 2;
        const px = x + Math.cos(w) * r, pz = z + Math.sin(w) * r;
        if (this.kannLanden(px, pz)) return { x: px, z: pz };
      }
    }
    return { x: 0, z: 4 }; // ganz weit draußen? Dann zurück zum Zelt
  }

  // Ein Bild lang fliegen
  fliegeSchritt(dt, richtung, gehalten, kameraWinkel) {
    const pos = this.figur.position;
    const E = EINSTELLUNGEN;
    this.flugUhr += dt;

    // Zauber-Uhr läuft ab
    const vorher = this.flugZeit;
    if (this.flugZeit > 0) this.flugZeit -= dt;
    if (!this.gewarnt && this.flugZeit <= WARN_SEKUNDEN && this.flugZeit > 0) {
      this.gewarnt = true;
      this.beiFlugWarnung?.(Math.ceil(this.flugZeit));
    }
    if (vorher > 0 && this.flugZeit <= 0) {
      this.flugZeit = 0;
      this.beiFlugEnde?.();
    }
    const landet = this.flugZeit <= 0;

    // ---- Waagerecht: Joystick (oder beim Landen ans Ufer gleiten) ----
    const laenge = Math.hypot(richtung.x, richtung.y);
    const staerke = Math.min(1, laenge);
    const ziel = new THREE.Vector2();
    if (landet && !this.landeZiel && pos.y - Math.max(bodenHoehe(pos.x, pos.z), WASSER_HOEHE) < 3 && !this.kannLanden(pos.x, pos.z)) {
      // Kurz vor dem Boden, aber hier ist Wasser oder ein Baum: Landeplatz suchen
      this.landeZiel = this.sucheLandeplatz(pos.x, pos.z);
    }
    if (this.landeZiel) {
      const dx = this.landeZiel.x - pos.x, dz = this.landeZiel.z - pos.z;
      const weg = Math.hypot(dx, dz);
      if (weg < 0.4) this.landeZiel = null;
      else ziel.set(dx / weg, dz / weg).multiplyScalar(Math.min(E.flugTempo * 0.6, weg * 2));
    } else if (staerke > 0.05) {
      const sin = Math.sin(kameraWinkel), cos = Math.cos(kameraWinkel);
      const dx = (richtung.x * cos - richtung.y * sin) / Math.max(laenge, 1);
      const dz = (-richtung.x * sin - richtung.y * cos) / Math.max(laenge, 1);
      ziel.set(dx, dz).multiplyScalar(E.flugTempo * staerke * (landet ? 0.6 : 1));
    }
    // weich beschleunigen und bremsen – wie ein Vogel, nicht wie ein Auto
    this.flugV.lerp(ziel, Math.min(1, dt * (this.landeZiel ? 5 : 3)));
    const neuX = pos.x + this.flugV.x * dt, neuZ = pos.z + this.flugV.y * dt;
    const ueberBoden = pos.y - Math.max(bodenHoehe(pos.x, pos.z), WASSER_HOEHE);
    if (ueberBoden > 1.2 || this.landeZiel || !this.hindernisse.trifft(neuX, neuZ, 0.4)) {
      // in der Luft gibt es keine Hindernisse
      pos.x = neuX;
      pos.z = neuZ;
    } else if (!this.hindernisse.trifft(neuX, pos.z, 0.4)) {
      pos.x = neuX;
    } else if (!this.hindernisse.trifft(pos.x, neuZ, 0.4)) {
      pos.z = neuZ;
    }

    // In Flugrichtung drehen (und merken, wie schnell wir drehen – für die Kurvenlage)
    const tempo = this.flugV.length();
    let drehung = 0;
    if (tempo > 0.5) {
      let diff = Math.atan2(this.flugV.x, this.flugV.y) - this.figur.rotation.y;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      drehung = diff * Math.min(1, dt * 6);
      this.figur.rotation.y += drehung;
    }
    this.drehTempo += ((dt > 0 ? drehung / dt : 0) - this.drehTempo) * Math.min(1, dt * 5);

    // ---- Senkrecht: festhalten = steigen, loslassen = langsam sinken ----
    const boden = bodenHoehe(pos.x, pos.z);
    const unten = Math.max(boden, WASSER_HOEHE); // Wasser zählt beim Fliegen wie Boden
    let zielY;
    if (landet) {
      // sanft landen: hoch oben schneller, kurz vor dem Boden ganz langsam
      const hoehe = pos.y - unten;
      zielY = -THREE.MathUtils.clamp(hoehe * 0.3, E.sinkTempo * 0.8, E.sinkTempo * 4);
    } else if (this.abhebZeit > 0) {
      this.abhebZeit -= dt;
      zielY = E.steigTempo * 0.7;
    } else {
      zielY = gehalten ? E.steigTempo : -E.sinkTempo;
    }
    this.geschwindigkeitY += (zielY - this.geschwindigkeitY) * Math.min(1, dt * 3);
    pos.y += this.geschwindigkeitY * dt;

    // nicht höher als erlaubt
    const decke = unten + E.maxFlugHoehe;
    if (pos.y > decke) {
      pos.y = decke;
      this.geschwindigkeitY = Math.min(0, this.geschwindigkeitY);
    }
    // nicht durch den Boden oder ins Wasser (über Wasser gleitet er knapp darüber)
    const minY = this.landeZiel && !this.kannLanden(pos.x, pos.z) ? unten + 0.8 : boden < WASSER_HOEHE ? WASSER_HOEHE + 0.3 : boden;
    if (pos.y < minY) {
      pos.y = minY;
      this.geschwindigkeitY = Math.max(0, this.geschwindigkeitY);
    }

    // ---- Gelandet? ----
    if (landet && !this.landeZiel && pos.y <= boden + 0.05 && this.kannLanden(pos.x, pos.z)) {
      pos.y = boden;
      this.flugModus = false;
      this.flugV.set(0, 0);
      this.geschwindigkeitY = 0;
      this.amBoden = true;
      this.beiGelandet?.();
    }
  }

  // Funken an den Füßen erzeugen und bewegen
  aktualisiereSpur(dt) {
    const k = this.k;
    if (this.flugModus) {
      // In den letzten Sekunden blinkt die Spur (Warnung: gleich ist der Zauber vorbei!)
      const blinkt = this.flugZeit > 0 && this.flugZeit <= WARN_SEKUNDEN && Math.sin(this.flugUhr * 18) < 0;
      const proSekunde = this.flugZeit > 0 ? FUNKEN_PRO_SEKUNDE : FUNKEN_PRO_SEKUNDE * 0.4;
      this.funkenGuthaben += blinkt ? 0 : dt * proSekunde;
      const fuss = new THREE.Vector3();
      while (this.funkenGuthaben >= 1) {
        this.funkenGuthaben -= 1;
        const f = this.funken[this.naechsterFunke];
        this.naechsterFunke = (this.naechsterFunke + 1) % SPUR_FUNKEN;
        (this.naechsterFunke % 2 ? k.fussL : k.fussR).getWorldPosition(fuss);
        f.pos.copy(fuss).add(new THREE.Vector3((Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3));
        f.v.set((Math.random() - 0.5) * 0.8, -0.3 - Math.random() * 0.6, (Math.random() - 0.5) * 0.8);
        f.dauer = f.leben = 0.7 + Math.random() * 0.7;
        f.groesse = 0.6 + Math.random() * 0.8;
      }
    }
    let lebendig = false;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3();
    this.funken.forEach((f, i) => {
      if (f.leben > 0) {
        f.leben -= dt;
        f.pos.addScaledVector(f.v, dt);
        lebendig = true;
      }
      const alter = Math.max(0, f.leben) / f.dauer; // 1 = neu, 0 = verglüht
      const funkeln = 0.7 + 0.3 * Math.sin(f.leben * 25 + i);
      q.setFromAxisAngle(s.set(0, 1, 0), f.leben * 6 + i);
      m.compose(f.pos, q, s.setScalar(f.groesse * alter * funkeln));
      this.spur.setMatrixAt(i, m);
    });
    this.spur.visible = lebendig;
    if (lebendig) this.spur.instanceMatrix.needsUpdate = true;
  }

  kannStehen(x, z) {
    // Nicht ins tiefe Wasser (Meer oder Lagune) – am flachen Rand darf man waten
    return bodenHoehe(x, z) > wasserHoeheBei(x, z) - 0.5 && !this.hindernisse.trifft(x, z, 0.4);
  }

  schwingen() {
    if (this.schwungZeit <= 0) this.schwungZeit = 0.45;
  }

  // Graben-Animation starten
  graben() {
    this.grabZeit = 0.9;
  }

  // Wird jedes Bild aufgerufen (ca. 60 Mal pro Sekunde!)
  // springenGehalten = wird der Sprungknopf gerade festgehalten? (nur fürs Fliegen wichtig)
  aktualisiere(dt, richtung, springen, kameraWinkel, springenGehalten = false) {
    if (this.flugModus) {
      this.fliegeSchritt(dt, richtung, springenGehalten, kameraWinkel);
      if (this.flugModus) this.animiereFlug(dt);
      else this.animiere(dt, 0);
      this.aktualisiereSpur(dt);
      return;
    }
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

      // Nicht ins tiefe Wasser, nicht durch Bäume/Felsen und keine Klippe hoch – sonst entlangrutschen
      const geht = (x, z) => this.kannStehen(x, z) && !zuSteilBergauf(pos.x, pos.z, x, z, pos.y);
      if (geht(neuX, neuZ)) {
        pos.x = neuX;
        pos.z = neuZ;
      } else if (geht(neuX, pos.z)) {
        pos.x = neuX;
      } else if (geht(pos.x, neuZ)) {
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
    this.aktualisiereSpur(dt); // Funken nach der Landung noch verglühen lassen
  }

  // ---------- Flug-Pose: wie ein Superheld ----------
  animiereFlug(dt) {
    const k = this.k;
    this.uhr += dt;
    this.luft = 1;
    this.tempoJetzt = 0;
    this.laufZeit = 0;
    const u = this.uhr;
    // f: 0 = schwebt auf der Stelle, 1 = fliegt mit vollem Tempo
    const f = glatt(0.5, EINSTELLUNGEN.flugTempo * 0.85, this.flugV.length());
    const steigt = THREE.MathUtils.clamp(this.geschwindigkeitY / EINSTELLUNGEN.steigTempo, -1, 1);
    // Kurvenlage: in die Kurve legen wie ein Flugzeug
    const kurve = THREE.MathUtils.clamp(this.drehTempo * 0.18, -0.45, 0.45) * f;

    // Ganzer Körper kippt nach vorne (beim Steigen etwas aufrechter)
    const neigung = mische(0.12, 1.2, f) - steigt * 0.18 + Math.sin(u * 1.7) * 0.04;
    k.huefte.rotation.set(neigung, Math.sin(u * 0.9) * 0.05, -kurve + Math.sin(u * 1.3) * 0.05);
    k.huefte.position.y = 0.085 + 0.045 + BEIN_LAENGE * 2 - 0.03 + Math.sin(u * 2.2) * 0.015;

    // Rücken leicht durchgedrückt, Kopf schaut nach vorne
    k.bauch.rotation.set(-0.06 * f, 0, kurve * 0.2);
    k.brust.rotation.set(-0.08 * f + Math.sin(u * 2.2 + 1) * 0.02, 0, kurve * 0.2);
    k.hals.rotation.set(-neigung * 0.45, 0, 0);
    k.kopf.rotation.set(-neigung * 0.35, Math.sin(u * 0.5) * 0.15 * (1 - f), 0);

    // Arme: beim Schweben seitlich ausgebreitet, beim schnellen Fliegen nach vorne gestreckt
    const welle = Math.sin(u * 2.4) * 0.12 * (1 - f);
    k.schulterL.rotation.set(mische(-0.25, -2.75, f) + welle, 0, mische(-1.25, -0.3, f) - welle);
    k.ellbogenL.rotation.x = mische(-0.4, -0.12, f);
    const hatWerkzeug = this.schaufel.visible || this.schwert.visible || this.angel.visible;
    k.schulterR.rotation.set(mische(-0.25, -2.95, f) + welle, 0, mische(1.25, 0.12, f) + welle);
    k.ellbogenR.rotation.x = hatWerkzeug ? mische(-0.6, -0.15, f) : mische(-0.4, -0.05, f);

    // Beine: leicht angewinkelt, ein Bein mehr als das andere, Fußspitzen gestreckt
    const zappeln = Math.sin(u * 3.1) * 0.06;
    k.beinL.rotation.set(mische(-0.35, 0.1, f) + zappeln, 0, -0.06);
    k.knieL.rotation.x = mische(0.65, 0.5, f) + zappeln;
    k.fussL.rotation.x = mische(0.3, 0.6, f);
    k.beinR.rotation.set(mische(-0.12, 0.0, f) - zappeln, 0, 0.06);
    k.knieR.rotation.x = mische(0.3, 0.15, f) - zappeln * 0.5;
    k.fussR.rotation.x = mische(0.25, 0.55, f);

    // Arme an armL/armR (das sind die Schulterknochen) – Schwung-Animation abbrechen
    this.schwungZeit = 0;
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
