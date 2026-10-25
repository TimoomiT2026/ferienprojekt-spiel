// =============================================================
//  DIE SPIELFIGUR – wie sie sich bewegt
//  Die Figur selbst (der Junge mit Skelett) kommt aus junge.js.
//  Hier steht, wie er läuft, rennt, springt, gräbt und das Schwert schwingt.
//  Und: Nach einem Zauberpilz kann er eine Minute lang FLIEGEN!
// =============================================================
import * as THREE from 'three';
import { EINSTELLUNGEN } from './einstellungen.js';
import { bodenHoehe, WASSER_HOEHE, zuSteilBergauf, istKlippenWand, wasserHoeheBei, INSELN } from './gelaende.js';
import { hinterDemZaun, platzInnenAmZaun, nahAnDerKlippe } from './klippenzaun.js';
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

// ---------- Bewegungen aus Schlüssel-Posen ----------
// Wie beim Daumenkino: Zu bestimmten Zeiten (t in Sekunden) steht fest,
// wie die Knochen gedreht sind. Dazwischen blendet der Computer weich über.
// [x, y, z] = Drehung eines Knochens. "werkzeug" = Drehung im Handgelenk.
// weich: 'rein' = wird schneller (Schwung!), 'raus' = bremst ab, sonst beides.
const GLIEDER = ['huefte', 'bauch', 'brust', 'hals', 'kopf', 'schulterL', 'ellbogenL', 'schulterR', 'ellbogenR', 'beinL', 'knieL', 'beinR', 'knieR'];
function weicheKurve(x, art) {
  if (art === 'rein') return x * x * x;
  if (art === 'raus') return 1 - (1 - x) ** 3;
  return x * x * (3 - 2 * x);
}
function poseZurZeit(schluessel, t) {
  let i = 0;
  while (i < schluessel.length - 2 && t > schluessel[i + 1].t) i++;
  const a = schluessel[i], b = schluessel[i + 1];
  const x = weicheKurve(THREE.MathUtils.clamp((t - a.t) / (b.t - a.t), 0, 1), b.weich);
  const pose = {};
  for (const name in b) {
    if (name === 't' || name === 'weich') continue;
    const va = a[name] ?? b[name], vb = b[name];
    pose[name] = Array.isArray(vb) ? vb.map((w, n) => mische(va[n] ?? 0, w, x)) : mische(va, vb, x);
  }
  return pose;
}

// GRABEN mit dem Spaten (Zeiten für 1,4 Sekunden – wird auf grabDauer umgerechnet)
const GRAB_POSEN = [
  // 0: Spaten in der Hand, gleich geht es los
  { t: 0, huefte: [0, 0, 0], bauch: [0.05, 0, 0], brust: [0.05, 0, 0], hals: [0, 0, 0], kopf: [0.1, 0, 0], schulterR: [-0.35, 0, 0.1], ellbogenR: [-0.75, 0, 0], schulterL: [-0.2, 0, -0.1], ellbogenL: [-0.4, 0, 0], beinL: [0, 0, -0.03], knieL: 0.05, beinR: [0, 0, 0.03], knieR: 0.05, werkzeug: [0.9, 0, 0] },
  // 1: ANSETZEN – Spaten vor dem Fuß auf den Boden stellen, linke Hand an den Stiel
  { t: 0.22, huefte: [0, 0, 0], bauch: [0.18, 0, 0], brust: [0.12, -0.15, 0], hals: [0, 0, 0], kopf: [0.25, 0, 0], schulterR: [-0.18, -0.17, 0.06], ellbogenR: [-1.36, 0, 0], schulterL: [-0.69, 0, 0.6], ellbogenL: [-0.36, 0, 0], beinL: [0.05, 0, -0.05], knieL: 0.1, beinR: [0, 0, 0.05], knieR: 0.1, werkzeug: [1.4, -1.15, 0.17] },
  // 2: FUSS HOCH auf die Tritt-Kante
  { t: 0.42, huefte: [0, 0, 0], bauch: [0.12, 0, 0], brust: [0.08, -0.15, 0], hals: [0, 0, 0], kopf: [0.3, 0, 0], schulterR: [-0.03, 0.04, 0], ellbogenR: [-1.43, 0, 0], schulterL: [-0.74, 0, 0.71], ellbogenL: [-0.07, 0, 0], beinL: [0.05, 0, -0.05], knieL: 0.15, beinR: [-1.12, 0, 0.15], knieR: 1.35, werkzeug: [1.37, -1.26, 0.14] },
  // 3: REINTRETEN – Gewicht drauf, der Körper geht runter, der Spaten rutscht in die Erde
  { t: 0.58, weich: 'rein', huefte: [0, 0, 0], bauch: [0.25, 0, 0], brust: [0.12, -0.12, 0], hals: [0, 0, 0], kopf: [0.3, 0, 0], schulterR: [-0.07, -0.05, 0.01], ellbogenR: [-1.33, 0, 0], schulterL: [-0.75, 0, 0.61], ellbogenL: [0.03, 0, 0], beinL: [-0.3, 0, -0.05], knieL: 0.75, beinR: [-0.8, 0, 0.11], knieR: 0.82, werkzeug: [1.1, -0.98, 0.17] },
  // 4: HEBELN – Fuß runter, Stiel zu sich ziehen, Körper lehnt sich zurück
  { t: 0.74, huefte: [0, 0, 0], bauch: [-0.05, 0, 0], brust: [-0.08, -0.05, 0], hals: [0, 0, 0], kopf: [0.2, 0, 0], schulterR: [0.62, -0.07, -0.02], ellbogenR: [-1.16, 0, 0], schulterL: [0, 0, 0.58], ellbogenL: [-0.07, 0, 0], beinL: [-0.2, 0, -0.05], knieL: 0.45, beinR: [-0.05, 0, 0.05], knieR: 0.35, werkzeug: [0.52, -1.24, 0.23] },
  // 5: HOCHHEBEN – in die Knie, Spaten mit der Erde waagerecht hoch
  { t: 0.86, huefte: [0, 0, 0], bauch: [0.3, 0.15, 0], brust: [0.1, 0.2, 0], hals: [0, 0, 0], kopf: [0.15, -0.1, 0], schulterR: [-0.17, -0.16, -0.19], ellbogenR: [-0.8, 0, 0], schulterL: [-0.59, -0.06, 0.39], ellbogenL: [0.01, 0, 0], beinL: [-0.45, 0, -0.05], knieL: 0.85, beinR: [-0.4, 0, 0.05], knieR: 0.8, werkzeug: [-0.4, -1.51, 0.43] },
  // 6: AUSWERFEN – schnell zur Seite drehen und das Blatt kippen: die Erde fliegt!
  { t: 0.98, weich: 'rein', huefte: [0, 0.2, 0], bauch: [0.1, 0.3, 0], brust: [0.05, 0.4, -0.08], hals: [0, 0, 0], kopf: [0.1, -0.2, 0], schulterR: [0.18, -0.38, 0.17], ellbogenR: [-1.2, 0, 0], schulterL: [-0.64, 0.22, 0.59], ellbogenL: [-0.05, 0, 0], beinL: [-0.1, 0, -0.05], knieL: 0.25, beinR: [0, 0, 0.08], knieR: 0.1, werkzeug: [-0.28, -0.49, 0.25] },
  // 7: NACHSCHWINGEN
  { t: 1.1, weich: 'raus', huefte: [0, 0.25, 0], bauch: [0.1, 0.35, 0], brust: [0.05, 0.5, -0.08], hals: [0, 0, 0], kopf: [0.1, -0.25, 0], schulterR: [0.18, -0.38, 0.17], ellbogenR: [-1.2, 0, 0], schulterL: [-0.64, 0.22, 0.59], ellbogenL: [-0.05, 0, 0], beinL: [-0.1, 0, -0.05], knieL: 0.25, beinR: [0, 0, 0.08], knieR: 0.1, werkzeug: [-0.28, -0.49, 0.25] },
  // 8: ZURÜCK in die normale Haltung
  { t: 1.4, huefte: [0, 0, 0], bauch: [0.05, 0, 0], brust: [0.05, 0, 0], hals: [0, 0, 0], kopf: [0.1, 0, 0], schulterR: [-0.35, 0, 0.1], ellbogenR: [-0.75, 0, 0], schulterL: [-0.2, 0, -0.1], ellbogenL: [-0.4, 0, 0], beinL: [0, 0, -0.03], knieL: 0.05, beinR: [0, 0, 0.03], knieR: 0.05, werkzeug: [0.9, 0, 0] },
];

// SCHWERT-SCHLAG (t von 0 bis 1 = ganze Schwungdauer; der Treffer kommt bei ca. 0,5)
const SCHWUNG_POSEN = [
  // 0: Schwert normal in der Hand
  { t: 0, huefte: [0, 0, 0], bauch: [0, 0, 0], brust: [0, 0, 0], hals: [0, 0, 0], kopf: [0, 0, 0], schulterR: [-0.35, 0, 0.1], ellbogenR: [-0.75, 0, 0], schulterL: [-0.1, 0, -0.1], ellbogenL: [-0.3, 0, 0], werkzeug: [2.17, 0, 0] },
  // 1: AUSHOLEN – Schwert hoch hinter die Schulter, Oberkörper dreht sich weg
  { t: 0.3, weich: 'raus', huefte: [0, 0.15, 0], bauch: [-0.05, 0.25, 0], brust: [-0.08, 0.35, 0.05], hals: [0, -0.2, 0], kopf: [0, -0.2, 0], schulterR: [-0.81, 0.68, 0.07], ellbogenR: [-1.84, 0, 0], schulterL: [-0.7, 0, -0.5], ellbogenL: [-0.6, 0, 0], werkzeug: [2.28, -0.15, -0.33] },
  // 2: TREFFER – schnell waagerecht nach vorne (hier trifft es den Baum)
  { t: 0.5, weich: 'rein', huefte: [0, -0.1, 0], bauch: [0.1, -0.2, 0], brust: [0.08, -0.3, -0.05], hals: [0, 0.15, 0], kopf: [0.1, 0.15, 0], schulterR: [-0.87, 0.4, 0.2], ellbogenR: [-0.02, 0, 0], schulterL: [-0.2, 0, -0.6], ellbogenL: [-0.5, 0, 0], werkzeug: [2.19, 0.37, 0.37] },
  // 3: DURCHZIEHEN – weiter zur anderen Seite, der ganze Körper dreht mit
  { t: 0.62, weich: 'raus', huefte: [0, -0.2, 0], bauch: [0.12, -0.3, 0], brust: [0.12, -0.45, -0.05], hals: [0, 0.25, 0], kopf: [0.1, 0.2, 0], schulterR: [-0.73, -0.2, -0.08], ellbogenR: [0.05, 0, 0], schulterL: [0.3, 0, -0.4], ellbogenL: [-0.5, 0, 0], werkzeug: [2.5, 0.15, 0.5] },
  // 4: ZURÜCK
  { t: 1, huefte: [0, 0, 0], bauch: [0, 0, 0], brust: [0, 0, 0], hals: [0, 0, 0], kopf: [0, 0, 0], schulterR: [-0.35, 0, 0.1], ellbogenR: [-0.75, 0, 0], schulterL: [-0.1, 0, -0.1], ellbogenL: [-0.3, 0, 0], werkzeug: [2.17, 0, 0] },
];

// ---------- Klippen-Wind 🌬️ ----------
// Über der Klippeninsel weht ein starker Wind: Mit dem Zauberpilz kommt man
// nicht aufs Plateau (nur mit der Seilkanone). Die Zahlen stehen in einstellungen.js.
const KLIPPE = INSELN.find((I) => I.klippen);
const WIND = () => EINSTELLUNGEN.klippenWind || {};
// Ist (x, z) oben auf dem Klippen-Plateau? (auch in der Lagune oben)
function aufKlippenPlateau(x, z) {
  if (!KLIPPE) return false;
  if (Math.hypot(x - KLIPPE.x, z - KLIPPE.z) > KLIPPE.radius + 5) return false;
  return bodenHoehe(x, z) > KLIPPE.plateauHoehe - 6;
}

export class Spieler {
  constructor(szene, hindernisse) {
    // Der Junge (Farben siehe JUNGE_FARBEN in junge.js – der Rucksack ist schon dran)
    const teile = baueJunge();
    Object.assign(this, teile);
    this.k = teile.knochen;

    // Die Schaufel in der rechten Hand (nur sichtbar, wenn man sie hält)
    // Die Hand hält den Stiel oben am Griff – das Schaufelblatt zeigt nach unten
    this.schaufel = new THREE.Group();
    const schaufelModell = baueSchaufel(true);
    schaufelModell.position.y = -0.93;
    this.schaufel.add(schaufelModell);
    // (die Hand ist etwas nach vorne geknickt, darum hier zurückdrehen)
    this.schaufel.rotation.x = 0.9;
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
    this.plattformen = []; // Stege usw., auf denen man oben stehen kann
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
    this.beiWind = null; // der Klippen-Wind bläst (einmal pro Flug)
    this.windJetzt = 0; // wie stark der Wind gerade an uns zieht (0 bis 1)
    this.startAufPlateau = false; // ist man OBEN auf der Klippe losgeflogen? Dann bläst er nicht.
    this.baueGlitzerSpur(szene);
    this.baueWindStreifen(szene);
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
      if (!this.flugModus) {
        this.flugV.set(0, 0);
        this.windGemeldet = false;
        // Wer mit der Seilkanone schon oben ist, darf da oben auch fliegen
        this.startAufPlateau = aufKlippenPlateau(this.figur.position.x, this.figur.position.z);
      }
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
    return bodenHoehe(x, z) > wasserHoeheBei(x, z) + 0.3 && this.kannStehen(x, z) && !istKlippenWand(x, z) &&
      !(this.windSperrt() && aufKlippenPlateau(x, z)) && // aufs Plateau nur mit der Seilkanone!
      (!this.fliegt || !this.landenVerboten?.(x, z)); // fremde Inseln: zu viel Wind zum Landen
  }

  // Bläst der Klippen-Wind bei diesem Flug? (nicht, wenn man oben losgeflogen ist)
  windSperrt() {
    return !!KLIPPE && !this.startAufPlateau;
  }

  // Wie stark packt uns der Wind gerade? 0 = gar nicht, 1 = voll.
  // Dazu die Richtung nach außen (weg von der Inselmitte).
  klippenWind(pos) {
    if (!KLIPPE) return 0;
    const W = WIND();
    const dx = pos.x - KLIPPE.x, dz = pos.z - KLIPPE.z;
    const d = Math.hypot(dx, dz);
    // Oben losgeflogen und dann weit weg? Ab jetzt bläst der Wind wieder.
    if (this.startAufPlateau && d > KLIPPE.radius + (W.rand ?? 10) + 5) this.startAufPlateau = false;
    if (!this.windSperrt()) return 0;
    if (d > KLIPPE.radius + (W.rand ?? 10)) return 0;
    this.windAussen = this.windAussen || new THREE.Vector2();
    if (d > 0.01) this.windAussen.set(dx / d, dz / d);
    else this.windAussen.set(1, 0);
    const grenze = KLIPPE.plateauHoehe - (W.unterPlateau ?? 4);
    if (aufKlippenPlateau(pos.x, pos.z)) return 1; // über dem Plateau immer volle Kraft
    return glatt(grenze - 0.5, grenze + 1.5, pos.y);
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
    // Der Klippen-Wind drückt sanft nach außen – stärker, als man fliegen kann
    const wind = this.klippenWind(pos);
    this.windJetzt = wind;
    if (wind > 0) {
      const W = WIND();
      const a = this.windAussen;
      const nachAussen = this.flugV.x * a.x + this.flugV.y * a.y;
      const soll = (W.tempo ?? 16) * wind;
      if (nachAussen < soll) {
        const plus = (soll - nachAussen) * Math.min(1, dt * 6);
        this.flugV.x += a.x * plus;
        this.flugV.y += a.y * plus;
      }
      if (!this.windGemeldet && wind > 0.3) {
        this.windGemeldet = true;
        this.beiWind?.();
      }
    }
    let neuX = pos.x + this.flugV.x * dt, neuZ = pos.z + this.flugV.y * dt;
    // Im Nebel und über fremden Inseln (starker Wind) kann man nicht hinfliegen: sanft zurückschubsen
    const sperre = this.flugSperre?.(pos.x, pos.z, neuX, neuZ);
    if (sperre) {
      this.flugV.multiplyScalar(-0.6);
      neuX = pos.x;
      neuZ = pos.z;
      this.beiFlugSperre?.(sperre);
    }
    const ueberBoden = pos.y - Math.max(bodenHoehe(pos.x, pos.z), WASSER_HOEHE);
    if (ueberBoden > 1.2 || this.landeZiel || wind > 0 || !this.hindernisse.trifft(neuX, neuZ, 0.4, true)) {
      // in der Luft gibt es keine Hindernisse
      pos.x = neuX;
      pos.z = neuZ;
    } else if (!this.hindernisse.trifft(neuX, pos.z, 0.4, true)) {
      pos.x = neuX;
    } else if (!this.hindernisse.trifft(pos.x, neuZ, 0.4, true)) {
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
    // Der Wind drückt auch nach unten
    if (wind > 0) {
      const runter = -(WIND().runter ?? 5) * wind;
      if (this.geschwindigkeitY > runter) this.geschwindigkeitY += (runter - this.geschwindigkeitY) * Math.min(1, dt * 4);
    }
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

  // ---------- Windstreifen über der Klippe (1 Draw Call) ----------
  // Dünne, helle Striche, die nach außen sausen – so sieht man den Wind.
  baueWindStreifen(szene) {
    const n = KLIPPE ? (WIND().streifen ?? 24) : 0;
    this.windStreifen = [];
    if (!n) return;
    // Zwei gekreuzte, lange schmale Flächen – dann sieht man sie von jeder Seite
    const a = new THREE.PlaneGeometry(5, 0.07);
    const b = new THREE.PlaneGeometry(5, 0.07).rotateX(Math.PI / 2);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([...a.attributes.position.array, ...b.attributes.position.array], 3));
    geo.setIndex([...a.index.array, ...b.index.array.map((i) => i + a.attributes.position.count)]);
    const material = new THREE.MeshBasicMaterial({
      color: '#ffffff', transparent: true, blending: THREE.AdditiveBlending,
      depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
    });
    this.wind = new THREE.InstancedMesh(geo, material, n);
    this.wind.frustumCulled = false;
    this.wind.visible = false;
    const schwarz = new THREE.Color(0, 0, 0);
    for (let i = 0; i < n; i++) {
      this.windStreifen.push({ pos: new THREE.Vector3(), leben: 0, dauer: 1 });
      this.wind.setColorAt(i, schwarz);
    }
    szene.add(this.wind);
  }

  aktualisiereWind(dt) {
    if (!this.wind) return;
    const pos = this.figur.position;
    const dx = pos.x - KLIPPE.x, dz = pos.z - KLIPPE.z;
    const d = Math.hypot(dx, dz);
    // Nur zeigen, wenn man fliegend in der Nähe der Klippe ist
    const zeigen = this.flugModus && this.windSperrt() && d < KLIPPE.radius + 45 && pos.y > KLIPPE.plateauHoehe - 12;
    if (!zeigen && !this.wind.visible) return;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1);
    const farbe = new THREE.Color();
    const hoch = new THREE.Vector3(0, 1, 0);
    const tempo = (WIND().tempo ?? 16) * 1.6;
    let irgendwas = false;
    this.windStreifen.forEach((st, i) => {
      if (st.leben <= 0 && zeigen) {
        // Neuer Streifen irgendwo um die Figur herum, über der Klippe
        const w = Math.random() * Math.PI * 2, r = 4 + Math.random() * 26;
        st.pos.set(pos.x + Math.cos(w) * r, 0, pos.z + Math.sin(w) * r);
        const boden = Math.max(bodenHoehe(st.pos.x, st.pos.z), WASSER_HOEHE);
        st.pos.y = Math.max(boden + 1, pos.y + (Math.random() - 0.4) * 10);
        st.dauer = st.leben = 0.6 + Math.random() * 0.7;
        st.drin = Math.hypot(st.pos.x - KLIPPE.x, st.pos.z - KLIPPE.z) < KLIPPE.radius + 20;
      }
      let hell = 0;
      if (st.leben > 0) {
        st.leben -= dt;
        // Nach außen sausen (weg von der Inselmitte), ein bisschen nach unten
        const ax = st.pos.x - KLIPPE.x, az = st.pos.z - KLIPPE.z;
        const al = Math.hypot(ax, az) || 1;
        st.pos.x += (ax / al) * tempo * dt;
        st.pos.z += (az / al) * tempo * dt;
        st.pos.y -= 2 * dt;
        q.setFromAxisAngle(hoch, -Math.atan2(az, ax));
        const t = 1 - st.leben / st.dauer;
        hell = st.drin ? Math.sin(t * Math.PI) * 0.45 : 0;
        if (hell > 0) irgendwas = true;
      }
      m.compose(st.pos, q, s.setScalar(hell > 0 ? 1 : 0));
      this.wind.setMatrixAt(i, m);
      this.wind.setColorAt(i, farbe.setScalar(Math.max(0, hell)));
    });
    this.wind.instanceMatrix.needsUpdate = true;
    this.wind.instanceColor.needsUpdate = true;
    this.wind.visible = zeigen || irgendwas;
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

  // Stege und ähnliche Bretter, auf denen man stehen kann: { x, z, r, oben }
  plattformBei(x, z) {
    for (const p of this.plattformen) {
      if ((x - p.x) ** 2 + (z - p.z) ** 2 < p.r * p.r) return p;
    }
    return null;
  }

  // ---------- Rettung: im tiefen Wasser festgesteckt? ----------
  // Wer z. B. von der Klippe ins tiefe Meer fällt, kann keinen Schritt mehr machen
  // (jeder Schritt wäre „ins tiefe Wasser“). Dann schwimmt die Figur zum nächsten Strand.
  pruefeFestgesteckt(dt) {
    if (!this.amBoden) return;
    const pos = this.figur.position;
    const imTiefenWasser = !this.plattformBei(pos.x, pos.z) && bodenHoehe(pos.x, pos.z) <= wasserHoeheBei(pos.x, pos.z) - 0.5;
    // Unten an der Klippe auf einem winzigen Fleck (z. B. einem Steg) – ringsum tiefes Wasser, kein Boot da?
    this.eingesperrtUhr = (this.eingesperrtUhr || 0) - dt;
    if (!imTiefenWasser && this.eingesperrtUhr <= 0) {
      this.eingesperrtUhr = 1; // nur einmal pro Sekunde nachschauen
      // Oder: oben in der Felswand hinter dem Zaun (auf einem Absatz)? Das ist auch gefährlich.
      const hinterZaunOben = aufKlippenPlateau(pos.x, pos.z) && hinterDemZaun(pos.x, pos.z);
      this.eingesperrt = hinterZaunOben || (nahAnDerKlippe(pos.x, pos.z) && !aufKlippenPlateau(pos.x, pos.z) &&
        !this.bootInDerNaehe?.(pos.x, pos.z) && this.kleinerFleck(pos.x, pos.z));
    }
    if (!imTiefenWasser && !this.eingesperrt) {
      this.festZeit = 0;
      return;
    }
    this.festZeit = (this.festZeit || 0) + dt;
    if (this.festZeit < (EINSTELLUNGEN.rettungNachSekunden ?? 2)) return;
    this.festZeit = 0;
    this.eingesperrt = false;
    // Unten an der Klippeninsel? Dann wieder nach oben aufs Plateau (innen am Zaun) – sonst zum nächsten Strand
    const ort = (nahAnDerKlippe(pos.x, pos.z) && platzInnenAmZaun(pos.x, pos.z)) || this.suchLandOrt(pos.x, pos.z);
    if (!ort) return;
    pos.set(ort.x, bodenHoehe(ort.x, ort.z), ort.z);
    this.geschwindigkeitY = 0;
    this.beiRettung?.();
  }

  // Wie groß ist der Fleck, auf dem man steht? Wir gehen in 1-m-Schritten überall hin,
  // wo man hinlaufen dürfte. Weniger als 60 Plätze = eingesperrt (ein richtiger Strand ist viel größer).
  kleinerFleck(x, z) {
    const gesehen = new Set([`0,0`]);
    const offen = [[0, 0]];
    while (offen.length) {
      const [i, j] = offen.pop();
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ni = i + di, nj = j + dj, schluessel = `${ni},${nj}`;
        if (gesehen.has(schluessel)) continue;
        const ax = x + i, az = z + j, bx = x + ni, bz = z + nj;
        if (!this.kannStehen(bx, bz) || zuSteilBergauf(ax, az, bx, bz)) continue;
        gesehen.add(schluessel);
        if (gesehen.size >= 60) return false;
        offen.push([ni, nj]);
      }
    }
    return true;
  }

  // Der nächste Ort an Land – am liebsten ein flacher Strand (nicht oben auf der Klippe)
  suchLandOrt(x, z) {
    let notfalls = null;
    for (let r = 2; r <= 300; r += 3) {
      const schritte = Math.max(16, Math.round(r * 0.8));
      for (let i = 0; i < schritte; i++) {
        const w = (i / schritte) * Math.PI * 2;
        const px = x + Math.cos(w) * r, pz = z + Math.sin(w) * r;
        if (!this.kannStehen(px, pz) || istKlippenWand(px, pz)) continue;
        if (bodenHoehe(px, pz) > wasserHoeheBei(px, pz) + 0.2 && bodenHoehe(px, pz) < WASSER_HOEHE + 6) return { x: px, z: pz };
        if (!notfalls) notfalls = { x: px, z: pz };
      }
    }
    return notfalls;
  }

  kannStehen(x, z) {
    if (this.plattformBei(x, z)) return !this.hindernisse.trifft(x, z, 0.4, true); // auf dem Steg darf man immer stehen
    // Nicht ins tiefe Wasser (Meer oder Lagune) – am flachen Rand darf man waten
    return bodenHoehe(x, z) > wasserHoeheBei(x, z) - 0.5 && !this.hindernisse.trifft(x, z, 0.4, true); // über Felsen klettert man
  }

  schwingen() {
    if (this.schwungZeit <= 0) this.schwungZeit = EINSTELLUNGEN.schwungDauer ?? 0.45;
  }

  // Graben-Animation starten (Spaten ansetzen, reintreten, hebeln, auswerfen)
  graben() {
    this.grabZeit = EINSTELLUNGEN.grabDauer ?? 1.4;
  }

  // Eine Pose auf die Knochen legen. staerke 0 = gar nicht, 1 = ganz.
  // nurOben = die Beine laufen normal weiter (z. B. Schwert-Schlag im Laufen)
  legePose(pose, staerke, werkzeug, nurOben = false) {
    const k = this.k;
    for (const name of GLIEDER) {
      const w = pose[name];
      if (w === undefined) continue;
      if (nurOben && (name.startsWith('bein') || name.startsWith('knie'))) continue;
      const r = k[name].rotation;
      if (Array.isArray(w)) r.set(mische(r.x, w[0], staerke), mische(r.y, w[1], staerke), mische(r.z, w[2], staerke));
      else r.x = mische(r.x, w, staerke);
    }
    if (werkzeug && pose.werkzeug) {
      const r = werkzeug.rotation, w = pose.werkzeug;
      r.set(mische(r.x, w[0], staerke), mische(r.y, w[1], staerke), mische(r.z, w[2], staerke));
    }
    if (nurOben) return;
    // Füße bleiben flach auf dem Boden, die Hüfte so hoch, dass das Standbein den Boden berührt
    for (const s of ['L', 'R']) k['fuss' + s].rotation.x = mische(k['fuss' + s].rotation.x, -(k['bein' + s].rotation.x + k['knie' + s].rotation.x), staerke);
    const reichweite = (s) => BEIN_LAENGE * (Math.cos(k['bein' + s].rotation.x) + Math.cos(k['bein' + s].rotation.x + k['knie' + s].rotation.x));
    k.huefte.position.y = mische(k.huefte.position.y, 0.13 + Math.max(reichweite('L'), reichweite('R')), staerke);
  }

  // Wird jedes Bild aufgerufen (ca. 60 Mal pro Sekunde!)
  // springenGehalten = wird der Sprungknopf gerade festgehalten? (nur fürs Fliegen wichtig)
  aktualisiere(dt, richtung, springen, kameraWinkel, springenGehalten = false) {
    this.aktualisiereWind(dt);
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
      // Oben auf der Klippe steht ein Zaun: von dort nicht über die Kante hinaus
      // (Wer schon hinter dem Zaun steht, wird nicht festgehalten – den holt die Rettung rein)
      const amZaun = (x, z) => aufKlippenPlateau(pos.x, pos.z) && !hinterDemZaun(pos.x, pos.z) && hinterDemZaun(x, z);
      const geht = (x, z) => this.kannStehen(x, z) && !zuSteilBergauf(pos.x, pos.z, x, z) && !amZaun(x, z);
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
    let boden = Math.max(bodenHoehe(pos.x, pos.z), WASSER_HOEHE - 0.5, this.hindernisse.felsHoehe(pos.x, pos.z)); // oben auf Felsen
    // Auf einem Steg steht man OBEN auf den Brettern (nicht drin)
    const brett = this.plattformBei(pos.x, pos.z);
    if (brett && pos.y > brett.oben - 0.6) boden = Math.max(boden, brett.oben);
    if (pos.y <= boden) {
      pos.y = boden;
      this.geschwindigkeitY = 0;
      this.amBoden = true;
    }
    this.pruefeFestgesteckt(dt);

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

    // Werkzeug-Haltung im Handgelenk (normal)
    this.schaufel.rotation.set(0.9, 0, 0);
    this.schwert.rotation.set(2.17, 0, 0);

    // ---- Schwert-Schlag: ausholen → durchziehen mit Körperdrehung → zurück ----
    if (this.schwungZeit > 0) {
      const dauer = EINSTELLUNGEN.schwungDauer ?? 0.45;
      this.schwungZeit -= dt;
      const t = THREE.MathUtils.clamp(1 - this.schwungZeit / dauer, 0, 1);
      const staerke = glatt(0, 0.06, t) * (1 - glatt(0.8, 1, t));
      this.legePose(poseZurZeit(SCHWUNG_POSEN, t), staerke, this.schwert, true);
    }

    // ---- Graben: eine echte Spaten-Bewegung in mehreren Schritten ----
    if (this.grabZeit > 0) {
      const dauer = EINSTELLUNGEN.grabDauer ?? 1.4;
      this.grabZeit -= dt;
      const t = THREE.MathUtils.clamp(1 - this.grabZeit / dauer, 0, 1) * 1.4; // auf die 1,4 s der Posen umrechnen
      const staerke = glatt(0, 0.1, t) * (1 - glatt(1.25, 1.4, t));
      this.legePose(poseZurZeit(GRAB_POSEN, t), staerke, this.schaufel);
    }
  }
}
