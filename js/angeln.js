// =============================================================
//  ANGELN – an kleinen runden Holzstegen am Wasser
//  Mit Angel in der Hand und einem Köder wirft man den Schwimmer
//  ins Wasser. Mit Glück beißt ein Tofu-Fisch an – mit Pech
//  zieht man Müll heraus, zum Beispiel einen alten Schuh.
// =============================================================
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { zufallMitSeed } from './rauschen.js';
import { bodenHoehe, abstandZumDorf, abstandZumPfad, DORF, WASSER_HOEHE } from './gelaende.js';

// ---------- Zahlen zum Rumprobieren ----------
// Was zieht man aus dem Wasser, und wie oft?
// Je größer die Zahl, desto häufiger. 45 von 100 Würfen = Tofu-Fisch (Glück!),
// der Rest ist Müll (Pech!).
const FANG_CHANCEN = {
  tofufisch: 45,
  schuh: 20,
  dose: 20,
  alge: 15,
};
// Wie viele Angelstellen gibt es auf der Insel?
const ANZAHL_ANGELSTELLEN = 10;
// Wie weit müssen zwei Angelstellen mindestens auseinander sein? (Meter)
const MIN_ABSTAND = 40;
// Wie viele Stellen sollen möglichst nah am Start liegen – und wie nah?
const NAH_ANZAHL = 2;
const NAH_RADIUS = 60;
// Wie lange wippt der Schwimmer, bevor etwas anbeißt? (Sekunden, von – bis)
const WARTEN_MIN = 2;
const WARTEN_MAX = 5;
// Wie nah muss man an der Angelstelle stehen? (Meter)
const ANGEL_RADIUS = 3.5;
// Eigener Zufall nur für die Angelstellen: immer dieselben Plätze
const zufall = zufallMitSeed(3141);

// Was steht in der Meldung, wenn man etwas gefangen hat?
const FANG_TEXTE = {
  tofufisch: '🐟 Ein Tofu-Fisch! Grill ihn am Lagerfeuer.',
  schuh: '👞 Mist, ein alter Schuh!',
  dose: '🥫 Mist, eine rostige Dose!',
  alge: '🌿 Bäh, nur glitschige Algen!',
};

// ---------- Kleine Helfer ----------
// Gibt einer Form überall dieselbe Farbe (für "vertexColors")
function faerben(geo, farbe) {
  const c = new THREE.Color(farbe);
  const n = geo.attributes.position.count;
  const farben = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) farben.set([c.r, c.g, c.b], i * 3);
  geo.setAttribute('color', new THREE.BufferAttribute(farben, 3));
  return geo;
}

// Würfeln mit Chancen: { a: 45, b: 20 } → 'a' oder 'b'
function wuerfeln(chancen) {
  const liste = Object.entries(chancen);
  const summe = liste.reduce((s, [, c]) => s + c, 0);
  let wurf = Math.random() * summe;
  for (const [id, c] of liste) {
    wurf -= c;
    if (wurf <= 0) return id;
  }
  return liste[0][0];
}

// Holz-Bild für den Steg malen (statt einer Bilddatei)
function baueStegTextur() {
  const leinwand = document.createElement('canvas');
  leinwand.width = leinwand.height = 128;
  const g = leinwand.getContext('2d');
  const z = zufallMitSeed(55);
  const planken = 6;
  const breite = 128 / planken;
  for (let i = 0; i < planken; i++) {
    const hell = 0.85 + z() * 0.3;
    g.fillStyle = `rgb(${190 * hell}, ${135 * hell}, ${82 * hell})`;
    g.fillRect(i * breite, 0, breite, 128);
    // Maserung
    g.strokeStyle = 'rgba(90, 50, 20, 0.25)';
    for (let k = 0; k < 3; k++) {
      const x0 = i * breite + 3 + z() * (breite - 6);
      g.beginPath();
      for (let y = 0; y <= 128; y += 8) {
        const x = x0 + Math.sin(y * 0.06 + k) * 1.5;
        y === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
      }
      g.stroke();
    }
    // Fuge zwischen den Planken
    g.fillStyle = 'rgba(60, 32, 14, 0.85)';
    g.fillRect(i * breite, 0, 2, 128);
  }
  const textur = new THREE.CanvasTexture(leinwand);
  textur.colorSpace = THREE.SRGBColorSpace;
  return textur;
}

// Eine Fisch-Form: runder Körper + flache Schwanzflosse (Kopf zeigt nach +z)
function baueFischGeo() {
  const koerper = new THREE.SphereGeometry(1, 16, 10);
  koerper.scale(0.13, 0.17, 0.36);
  const flosse = new THREE.ConeGeometry(0.17, 0.24, 12);
  flosse.rotateX(Math.PI / 2);
  flosse.scale(0.25, 1, 1);
  flosse.translate(0, 0, -0.42);
  const geo = mergeGeometries([koerper, flosse]);
  koerper.dispose();
  flosse.dispose();
  return geo;
}

// ---------- Die Angelrute (für die Hand der Figur) ----------
// Griff unten am Ursprung, die Rute zeigt nach oben (+y), ca. 1,8 m lang.
// Ganz oben sitzt ein unsichtbarer Punkt "angelSpitze" – dort hängt die Schnur.
export function baueAngel() {
  const angel = new THREE.Group();
  const kork = new THREE.MeshStandardMaterial({ color: '#c89a5c', roughness: 0.95 });
  const rute = new THREE.MeshStandardMaterial({ color: '#3a6fd8', roughness: 0.4 });
  const metall = new THREE.MeshStandardMaterial({ color: '#c9d0d8', metalness: 0.7, roughness: 0.35 });

  // Weicher Korkgriff
  const griff = new THREE.Mesh(new THREE.CapsuleGeometry(0.04, 0.3, 4, 10), kork);
  griff.position.y = 0.12;
  // Die Rute wird nach oben immer dünner
  const stab = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.024, 1.55, 8), rute);
  stab.position.y = 0.28 + 1.55 / 2;
  // Die Rolle, auf der die Schnur aufgewickelt ist
  const rolle = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 16), metall);
  rolle.rotation.z = Math.PI / 2;
  rolle.position.set(0.07, 0.3, 0.04);
  angel.add(griff, stab, rolle);

  const spitze = new THREE.Object3D();
  spitze.name = 'angelSpitze';
  spitze.position.y = 1.83;
  angel.add(spitze);
  angel.traverse((t) => {
    if (t.isMesh) t.castShadow = true;
  });
  return angel;
}

// ---------- Angelstellen suchen ----------
// Gute Stelle = trockenes Ufer, und gleich daneben ist tiefes Wasser.
// Am liebsten höchstens 3 m weit (steiles Ufer). An flachen Stränden und Seen
// erlauben wir bis 5 m – sonst gäbe es dort gar keine Angelstellen.
const TIEF_NAH = 3;
const TIEF_WEIT = 5;
function sucheKandidaten() {
  const R = 265; // etwas größer als die Insel, damit auch die Küste dabei ist
  const SCHRITT = 3.5; // wir prüfen ein Gitter, ein bisschen verwackelt
  const kandidaten = [];
  for (let gx = -R; gx <= R; gx += SCHRITT) {
    for (let gz = -R; gz <= R; gz += SCHRITT) {
      const x = gx + (zufall() - 0.5) * SCHRITT;
      const z = gz + (zufall() - 0.5) * SCHRITT;
      const h = bodenHoehe(x, z);
      if (h < 0.5 || h > 2.2) continue; // nicht im Wasser, nicht hoch oben auf einer Klippe
      if (abstandZumDorf(x, z) < DORF.radius + 5) continue; // nicht im Dorf
      if (abstandZumPfad(x, z) < 4) continue; // nicht mitten auf dem Trampelpfad

      // Schneller Vorab-Blick: Geht es in der Nähe überhaupt bergab ins Wasser?
      let tiefster = Infinity;
      for (let k = 0; k < 8; k++) {
        const w = (k / 8) * Math.PI * 2;
        tiefster = Math.min(tiefster, bodenHoehe(x + Math.sin(w) * TIEF_WEIT, z + Math.cos(w) * TIEF_WEIT));
      }
      if (tiefster > 0.2) continue;

      // In 16 Richtungen schauen: Wo ist das tiefe Wasser am nächsten?
      let beste = null;
      for (let d = 1; d <= TIEF_WEIT && !beste; d += 0.5) {
        for (let k = 0; k < 16; k++) {
          const w = (k / 16) * Math.PI * 2;
          const wh = bodenHoehe(x + Math.sin(w) * d, z + Math.cos(w) * d);
          if (wh < -0.6 && (!beste || wh < beste.h)) beste = { w, h: wh, d };
        }
      }
      if (!beste) continue;

      // Dort hin fliegt der Schwimmer: ein paar Meter hinter dem tiefen Wasser
      const sx = Math.sin(beste.w), sz = Math.cos(beste.w);
      let ziel = null;
      for (const weite of [beste.d + 3.5, beste.d + 2.5, beste.d + 1.5, beste.d + 0.5]) {
        let allesWasser = true;
        for (let s = beste.d; s <= weite; s += 1) if (bodenHoehe(x + sx * s, z + sz * s) > -0.3) allesWasser = false;
        if (allesWasser && bodenHoehe(x + sx * weite, z + sz * weite) < -0.4) {
          ziel = new THREE.Vector3(x + sx * weite, WASSER_HOEHE, z + sz * weite);
          break;
        }
      }
      if (!ziel) continue;
      kandidaten.push({ x, z, h, richtung: beste.w, ziel, tiefAbstand: beste.d, steil: beste.d <= TIEF_NAH, imSee: Math.hypot(ziel.x, ziel.z) < 140 });
    }
  }
  return kandidaten;
}

function waehleStellen(kandidaten) {
  const gewaehlt = [];
  const abstand = (k) => Math.min(Infinity, ...gewaehlt.map((g) => Math.hypot(g.x - k.x, g.z - k.z)));
  // 1) Ein paar Stellen nah am Start (am liebsten näher als NAH_RADIUS – sonst die nächsten)
  const nachStart = [...kandidaten].sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z));
  for (const k of nachStart) {
    if (gewaehlt.length >= NAH_ANZAHL) break;
    if (abstand(k) >= MIN_ABSTAND) gewaehlt.push(k);
  }
  // 2) An jedem Inland-See eine Stelle (Seen liegen mitten auf der Insel)
  for (const k of nachStart) {
    if (gewaehlt.length >= ANZAHL_ANGELSTELLEN) break;
    if (k.imSee && abstand(k) > 70) gewaehlt.push(k);
  }
  // 3) Der Rest: immer die Stelle, die am weitesten von allen anderen weg ist → gut verteilt.
  //    Stellen mit steilem Ufer bekommen einen kleinen Vorteil.
  while (gewaehlt.length < ANZAHL_ANGELSTELLEN) {
    let beste = null, besterWert = 0;
    for (const k of kandidaten) {
      const d = abstand(k);
      if (d < MIN_ABSTAND) continue;
      const wert = d * (k.steil ? 1 : 0.8);
      if (wert > besterWert) {
        beste = k;
        besterWert = wert;
      }
    }
    if (!beste) break;
    gewaehlt.push(beste);
  }
  return gewaehlt;
}

// =============================================================
export class Angeln {
  constructor(szene, spiel) {
    this.spiel = spiel; // { rucksack, meldung, musik, spieler }
    this.zeit = 0;
    this.wurf = null; // läuft gerade ein Wurf? Dann steht hier alles darüber

    // ---------- Die Stellen ----------
    this.stellen = waehleStellen(sucheKandidaten()).map((k, i) => {
      const sx = Math.sin(k.richtung), sz = Math.cos(k.richtung);
      // Der runde Steg ragt ein Stück übers Wasser (am flachen Ufer etwas weiter)
      const raus = 0.9 + Math.max(0, k.tiefAbstand - TIEF_NAH) * 0.5;
      const stegX = k.x + sx * raus, stegZ = k.z + sz * raus;
      const stegY = Math.max(bodenHoehe(stegX, stegZ), WASSER_HOEHE + 0.2) + 0.1;
      return {
        stand: new THREE.Vector3(k.x, k.h, k.z),
        ziel: k.ziel,
        richtung: k.richtung,
        imSee: k.imSee,
        steil: k.steil,
        steg: new THREE.Vector3(stegX, stegY, stegZ),
        sprungIn: 2 + i * 1.3, // wann springt hier der nächste Fisch?
        sprung: -1, // läuft gerade ein Sprung? (0 bis 1)
        spritzer: -1, // Spritz-Ring nach dem Sprung (0 bis 1)
      };
    });

    this.baueStege(szene);
    this.baueWellen(szene);
    this.baueSchwimmer(szene);
    this.baueFang(szene);

    this._interaktionen = this.stellen.map((stelle) => ({
      pos: stelle.stand,
      radius: ANGEL_RADIUS,
      bild: '🎣',
      text: 'Angeln',
      aktiv: () => !this.wurf,
      ausfuehren: () => this.angeln(stelle),
    }));
  }

  // ---------- Steg, Pfähle und Pfahl-Kappen ----------
  baueStege(szene) {
    const n = this.stellen.length;
    const holz = new THREE.MeshStandardMaterial({ map: baueStegTextur(), roughness: 0.9 });
    // Runde Holzplattform
    this.stege = new THREE.InstancedMesh(new THREE.CylinderGeometry(1.35, 1.35, 0.16, 28), holz, n);
    // Pfähle: 3 kurze unter dem Steg + 1 hoher am Wasser (den sieht man von weitem)
    const pfahlGeo = new THREE.CylinderGeometry(0.09, 0.11, 1, 10);
    pfahlGeo.translate(0, 0.5, 0); // unten = Ursprung
    this.pfaehle = new THREE.InstancedMesh(pfahlGeo, new THREE.MeshStandardMaterial({ color: '#7a5130', roughness: 0.95 }), n * 4);
    // Rot-weiße runde Kappe oben auf dem hohen Pfahl
    const kappeGeo = new THREE.SphereGeometry(0.16, 14, 10);
    this.kappen = new THREE.InstancedMesh(kappeGeo, new THREE.MeshStandardMaterial({ color: '#e8453c', roughness: 0.6 }), n);

    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    this.stellen.forEach((st, i) => {
      const sx = Math.sin(st.richtung), sz = Math.cos(st.richtung);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), st.richtung);
      this.stege.setMatrixAt(i, m.compose(st.steg, q, s.set(1, 1, 1)));
      // Kurze Pfähle stecken unter dem Steg im Boden
      for (let k = 0; k < 3; k++) {
        const w = st.richtung + (k - 1) * 1.6;
        const px = st.steg.x + Math.sin(w) * 1.05, pz = st.steg.z + Math.cos(w) * 1.05;
        const unten = Math.min(bodenHoehe(px, pz), WASSER_HOEHE) - 0.4;
        p.set(px, unten, pz);
        this.pfaehle.setMatrixAt(i * 4 + k, m.compose(p, new THREE.Quaternion(), s.set(1, st.steg.y - unten, 1)));
      }
      // Der hohe Pfahl am Rand zum Wasser
      const px = st.steg.x + sx * 1.25 + sz * 0.7, pz = st.steg.z + sz * 1.25 - sx * 0.7;
      const unten = Math.min(bodenHoehe(px, pz), WASSER_HOEHE) - 0.4;
      const oben = st.steg.y + 1.3;
      p.set(px, unten, pz);
      this.pfaehle.setMatrixAt(i * 4 + 3, m.compose(p, new THREE.Quaternion(), s.set(1.3, oben - unten, 1.3)));
      p.set(px, oben, pz);
      this.kappen.setMatrixAt(i, m.compose(p, new THREE.Quaternion(), s.set(1, 1, 1)));
    });
    for (const teil of [this.stege, this.pfaehle, this.kappen]) {
      teil.castShadow = teil.receiveShadow = true;
      teil.instanceMatrix.needsUpdate = true;
      szene.add(teil);
    }
  }

  // ---------- Wellenringe und springende Fische ----------
  baueWellen(szene) {
    const n = this.stellen.length;
    // Ringe leuchten "dazu" (additiv): Schwarz = unsichtbar, Weiß = hell.
    // So können wir jeden Ring einzeln ausblenden, ohne viele Materialien.
    const ringGeo = new THREE.RingGeometry(0.88, 1, 40);
    ringGeo.rotateX(-Math.PI / 2);
    this.ringe = new THREE.InstancedMesh(
      ringGeo,
      new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
      n * 4 + 2 // pro Stelle 3 Wellenringe + 1 Spritz-Ring, dazu 2 für den Schwimmer
    );
    this.ringe.frustumCulled = false;
    this.ringe.renderOrder = 2;
    for (let i = 0; i < this.ringe.count; i++) this.ringe.setColorAt(i, new THREE.Color(0, 0, 0));
    szene.add(this.ringe);

    // Kleine Tofu-Fische, die ab und zu aus dem Wasser hüpfen
    this.springer = new THREE.InstancedMesh(
      baueFischGeo(),
      new THREE.MeshStandardMaterial({ color: '#f1e7cf', roughness: 0.7 }),
      n
    );
    this.springer.frustumCulled = false;
    this.springer.castShadow = true;
    szene.add(this.springer);
    this.schwimmerRinge = [-1, -1]; // Alter der 2 Schwimmer-Ringe (−1 = aus)
  }

  // ---------- Schwimmer und Schnur ----------
  baueSchwimmer(szene) {
    const kugel = new THREE.SphereGeometry(0.1, 16, 12);
    // Oben rot, unten weiß – wie ein echter Schwimmer
    const farben = [];
    const pos = kugel.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const c = new THREE.Color(pos.getY(i) > 0.005 ? '#e8392f' : '#ffffff');
      farben.push(c.r, c.g, c.b);
    }
    kugel.setAttribute('color', new THREE.Float32BufferAttribute(farben, 3));
    const stab = faerben(new THREE.CylinderGeometry(0.012, 0.012, 0.18, 6), '#e8392f');
    stab.translate(0, 0.17, 0);
    this.schwimmer = new THREE.Mesh(mergeGeometries([kugel, stab]), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5 }));
    this.schwimmer.visible = false;
    szene.add(this.schwimmer);

    this.schnurPunkte = 20;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.schnurPunkte * 3), 3));
    this.schnur = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: '#f4f4f4', transparent: true, opacity: 0.85 }));
    this.schnur.frustumCulled = false;
    this.schnur.visible = false;
    szene.add(this.schnur);
  }

  // ---------- Was man herauszieht (nur eins ist sichtbar) ----------
  baueFang(szene) {
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 });
    this.fang = new THREE.Group();
    this.fangModelle = {};

    const fisch = faerben(baueFischGeo(), '#f6eed8');
    fisch.scale(1.4, 1.4, 1.4);
    this.fangModelle.tofufisch = new THREE.Mesh(fisch, mat);

    // Alter Schuh: runde Spitze, Ferse und eine dunkle Sohle
    const schuh = faerben(new THREE.CapsuleGeometry(0.1, 0.22, 4, 12), '#7b4a2a');
    schuh.rotateX(Math.PI / 2);
    schuh.scale(1, 0.8, 1);
    const schaft = faerben(new THREE.CapsuleGeometry(0.085, 0.1, 4, 12), '#6a3e22');
    schaft.translate(0, 0.12, -0.12);
    const sohle = faerben(new THREE.CapsuleGeometry(0.1, 0.24, 4, 12), '#2d211b');
    sohle.rotateX(Math.PI / 2);
    sohle.scale(1.05, 0.35, 1.05);
    sohle.translate(0, -0.07, 0);
    this.fangModelle.schuh = new THREE.Mesh(mergeGeometries([schuh, schaft, sohle]), mat);

    // Rostige Dose mit rotem Etikett in der Mitte
    const dose = new THREE.CylinderGeometry(0.09, 0.09, 0.24, 18, 3);
    const dp = dose.attributes.position;
    const doseFarben = [];
    for (let i = 0; i < dp.count; i++) {
      const c = new THREE.Color(Math.abs(dp.getY(i)) < 0.05 ? '#c4392f' : '#9aa2a8');
      doseFarben.push(c.r, c.g, c.b);
    }
    dose.setAttribute('color', new THREE.Float32BufferAttribute(doseFarben, 3));
    this.fangModelle.dose = new THREE.Mesh(dose, mat);

    // Glitschige Algen: ein paar grüne, schräge Streifen
    const algen = [];
    for (let k = 0; k < 4; k++) {
      const a = faerben(new THREE.CapsuleGeometry(0.03, 0.4, 3, 8), k % 2 ? '#2f7d3a' : '#4fa04a');
      a.translate(0, -0.2, 0);
      a.rotateZ((k - 1.5) * 0.35);
      a.rotateY(k * 0.8);
      algen.push(a);
    }
    this.fangModelle.alge = new THREE.Mesh(mergeGeometries(algen), mat);

    for (const modell of Object.values(this.fangModelle)) {
      modell.castShadow = true;
      modell.visible = false;
      this.fang.add(modell);
    }
    this.fang.visible = false;
    szene.add(this.fang);
  }

  // ---------- Für main.js ----------
  get interaktionen() {
    return this._interaktionen;
  }

  get beschaeftigt() {
    return this.wurf !== null;
  }

  get positionen() {
    return this.stellen.map((s) => ({ x: s.stand.x, z: s.stand.z }));
  }

  // ---------- Der Aktions-Knopf "Angeln" ----------
  angeln(stelle) {
    const { rucksack, meldung } = this.spiel;
    if (this.wurf) return;
    if (rucksack.inDerHand !== 'angel') {
      meldung(rucksack.hat('angel')
        ? 'Nimm erst die Angel in die Hand: Rucksack 🎒 öffnen und die Angel antippen.'
        : 'Zum Angeln brauchst du eine Angel 🎣. Die kauft man beim Händler – oder du baust sie an der Werkbank aus Holz.', 5);
      return;
    }
    if (!rucksack.hat('koeder')) {
      meldung('Du brauchst Köder vom Händler 🪱', 4);
      return;
    }
    if (rucksack.istVoll()) {
      meldung('Dein Rucksack ist voll! 🎒 Da passt kein Fang mehr rein.');
      return;
    }
    rucksack.nehmen('koeder', 1);
    this.wurf = {
      stelle,
      phase: 'werfen',
      zeit: 0,
      warten: WARTEN_MIN + Math.random() * (WARTEN_MAX - WARTEN_MIN),
      zuckenBei: 0.3 + Math.random() * 0.4, // kurzes Zucken vorher – Spannung!
      fund: wuerfeln(FANG_CHANCEN),
      start: new THREE.Vector3(),
      arm: -0.9,
    };
    this.spitzePosition(this.wurf.start);
    this.schwimmer.visible = true;
    this.schnur.visible = true;
  }

  // Wo ist die Spitze der Angel gerade? (Dort hängt die Schnur)
  spitzePosition(ziel) {
    const figur = this.spiel.spieler.figur;
    const spitze = figur.getObjectByName('angelSpitze');
    if (spitze) {
      figur.updateMatrixWorld(true);
      return spitze.getWorldPosition(ziel);
    }
    // Keine Angel gefunden? Dann ungefähr vor dem Kopf
    const w = figur.rotation.y;
    return ziel.set(figur.position.x + Math.sin(w) * 1.2, figur.position.y + 2.6, figur.position.z + Math.cos(w) * 1.2);
  }

  // Die Schnur von der Spitze zum Ende malen (durchhängen = wie weit sie nach unten hängt)
  maleSchnur(von, bis, durchhaengen) {
    const p = this.schnur.geometry.attributes.position;
    for (let i = 0; i < this.schnurPunkte; i++) {
      const t = i / (this.schnurPunkte - 1);
      const y = THREE.MathUtils.lerp(von.y, bis.y, t) - durchhaengen * 4 * t * (1 - t);
      p.setXYZ(i, THREE.MathUtils.lerp(von.x, bis.x, t), Math.max(y, Math.min(bis.y, WASSER_HOEHE + 0.01)), THREE.MathUtils.lerp(von.z, bis.z, t));
    }
    p.needsUpdate = true;
  }

  schwimmerRing(nr, ort) {
    this.schwimmerRinge[nr] = 0;
    this.schwimmerRingOrt = this.schwimmerRingOrt || [new THREE.Vector3(), new THREE.Vector3()];
    this.schwimmerRingOrt[nr].copy(ort);
  }

  // Der Wurf, Schritt für Schritt
  aktualisiereWurf(dt) {
    const w = this.wurf;
    const { spieler, rucksack, meldung, musik } = this.spiel;
    const figur = spieler.figur;
    const ziel = w.stelle.ziel;
    w.zeit += dt;

    // Figur dreht sich zum Wasser
    let diff = Math.atan2(ziel.x - figur.position.x, ziel.z - figur.position.z) - figur.rotation.y;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    figur.rotation.y += diff * Math.min(1, dt * 8);

    // Erst den Arm hinstellen (wie im letzten Bild), dann die Angelspitze suchen
    if (spieler.armR && w.arm !== undefined) {
      spieler.armR.rotation.x = w.arm;
      spieler.armR.rotation.z = 0;
    }
    const spitze = this.spitzePosition(new THREE.Vector3());
    let arm = -0.9; // Arm nach vorne gestreckt
    const sp = this.schwimmer.position;

    if (w.phase === 'werfen') {
      // Ausholen (Arm nach hinten), dann schwungvoll nach vorne
      if (w.zeit < 0.3) {
        arm = THREE.MathUtils.lerp(-0.9, -2.7, w.zeit / 0.3);
        sp.copy(spitze).y -= 0.25;
        w.start.copy(sp); // von hier fliegt der Schwimmer gleich los
        this.maleSchnur(spitze, sp, 0);
      } else {
        const t = Math.min(1, (w.zeit - 0.3) / 0.7);
        arm = THREE.MathUtils.lerp(-2.7, -0.9, Math.min(1, t * 3));
        // Der Schwimmer fliegt in einem Bogen ins Wasser
        sp.lerpVectors(w.start, ziel, t);
        sp.y += Math.sin(t * Math.PI) * 2.5;
        this.maleSchnur(spitze, sp, 0);
        if (t >= 1) {
          w.phase = 'warten';
          w.zeit = 0;
          this.schwimmerRing(0, ziel); // Platsch!
        }
      }
    } else if (w.phase === 'warten') {
      // Der Schwimmer wippt sanft auf den Wellen
      sp.copy(ziel);
      sp.y = WASSER_HOEHE - 0.03 + Math.sin(w.zeit * 4) * 0.025;
      // Einmal kurz zucken – beißt da was? Noch nicht!
      const zucken = w.zeit / w.warten - w.zuckenBei;
      if (zucken > 0 && zucken < 0.06) sp.y -= 0.08;
      arm += Math.sin(w.zeit * 1.5) * 0.05;
      this.maleSchnur(spitze, sp, 0.5);
      if (w.zeit >= w.warten) {
        w.phase = 'biss';
        w.zeit = 0;
        this.schwimmerRing(1, ziel);
        meldung('❗ Biss!', 1.2);
      }
    } else if (w.phase === 'biss') {
      // Der Schwimmer wird unter Wasser gezogen
      sp.copy(ziel);
      sp.y = WASSER_HOEHE - Math.min(1, w.zeit / 0.15) * 0.35 + Math.sin(w.zeit * 40) * 0.03;
      sp.x += Math.sin(w.zeit * 23) * 0.05;
      arm = -0.9 - Math.min(1, w.zeit / 0.5) * 0.3;
      this.maleSchnur(spitze, sp, 0);
      if (w.zeit >= 0.7) {
        w.phase = 'einholen';
        w.zeit = 0;
        this.schwimmer.visible = false;
        this.schwimmerRing(0, ziel);
        this.fang.visible = true;
        for (const [id, modell] of Object.entries(this.fangModelle)) modell.visible = id === w.fund;
      }
    } else if (w.phase === 'einholen') {
      // Ruck nach oben – und der Fang fliegt aus dem Wasser zur Figur
      const t = Math.min(1, w.zeit / 0.9);
      arm = THREE.MathUtils.lerp(-1.2, -2.3, Math.min(1, t * 4));
      const fp = this.fang.position;
      const haengen = spitze.clone();
      haengen.y -= 0.6;
      fp.lerpVectors(ziel, haengen, THREE.MathUtils.smoothstep(t, 0, 1));
      fp.y += Math.sin(t * Math.PI) * 1.5;
      this.fang.rotation.set(Math.sin(w.zeit * 9) * 0.5, w.zeit * 4, Math.sin(w.zeit * 7) * 0.4);
      this.maleSchnur(spitze, fp, 0);
      if (w.zeit >= 1.3) this.wurfFertig(rucksack, meldung, musik);
    }

    if (this.wurf) this.wurf.arm = arm;
    if (spieler.armR) spieler.armR.rotation.x = arm;
  }

  wurfFertig(rucksack, meldung, musik) {
    const fund = this.wurf.fund;
    this.fang.visible = false;
    this.schnur.visible = false;
    this.schwimmer.visible = false;
    this.wurf = null;
    if (!rucksack.hinein(fund)) {
      meldung('Dein Rucksack ist voll! 🎒 Der Fang ist zurück ins Wasser geplumpst.', 4);
      return;
    }
    musik.pling();
    const rest = rucksack.anzahl('koeder');
    const koederText = rest > 0 ? ` (noch ${rest} Köder 🪱)` : ' Das war dein letzter Köder 🪱.';
    meldung(FANG_TEXTE[fund] + koederText, 4);
  }

  // ---------- Jedes Bild ----------
  aktualisiere(dt) {
    this.zeit += dt;
    if (this.wurf) this.aktualisiereWurf(dt);

    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    const farbe = new THREE.Color();
    const leer = new THREE.Vector3(0, 0, 0);
    const ring = (i, ort, radius, hell) => {
      m.compose(p.set(ort.x, WASSER_HOEHE + 0.03, ort.z), q.identity(), hell > 0.003 ? s.set(radius, 1, radius) : leer);
      this.ringe.setMatrixAt(i, m);
      this.ringe.setColorAt(i, farbe.setScalar(hell));
    };

    this.stellen.forEach((st, i) => {
      // 3 Wellenringe breiten sich langsam aus und werden blasser
      for (let k = 0; k < 3; k++) {
        const t = (this.zeit / 3.2 + k / 3 + i * 0.137) % 1;
        ring(i * 4 + k, st.ziel, 0.3 + t * 2.2, Math.sin(t * Math.PI) * 0.35 * (1 - t));
      }

      // Ab und zu springt ein Tofu-Fisch aus dem Wasser
      st.sprungIn -= dt;
      if (st.sprungIn <= 0 && st.sprung < 0) {
        st.sprung = 0;
        st.sprungIn = 5 + Math.random() * 6;
        st.sprungRichtung = Math.random() * Math.PI * 2;
        st.sprungOrt = st.sprungOrt || new THREE.Vector3();
        st.sprungOrt.set(st.ziel.x + (Math.random() - 0.5) * 2, 0, st.ziel.z + (Math.random() - 0.5) * 2);
      }
      if (st.sprung >= 0) {
        st.sprung += dt / 0.8;
        const t = st.sprung;
        const weg = (t - 0.5) * 1.4; // springt ein Stück nach vorne
        p.set(st.sprungOrt.x + Math.sin(st.sprungRichtung) * weg, WASSER_HOEHE - 0.2 + Math.sin(t * Math.PI) * 0.9, st.sprungOrt.z + Math.cos(st.sprungRichtung) * weg);
        // Erst Nase nach oben, dann Nase nach unten – wie ein Delfin
        q.setFromEuler(new THREE.Euler(-Math.cos(t * Math.PI) * 1.1, st.sprungRichtung, 0, 'YXZ'));
        this.springer.setMatrixAt(i, m.compose(p, q, s.setScalar(1)));
        if (t >= 1) {
          st.sprung = -1;
          st.spritzer = 0;
          st.spritzOrt = p.clone();
        }
      } else {
        this.springer.setMatrixAt(i, m.compose(p.set(0, -50, 0), q.identity(), leer));
      }
      // Spritz-Ring, wo der Fisch wieder eintaucht
      if (st.spritzer >= 0) {
        st.spritzer += dt / 1.2;
        ring(i * 4 + 3, st.spritzOrt, 0.2 + st.spritzer * 1.6, (1 - st.spritzer) * 0.6);
        if (st.spritzer >= 1) st.spritzer = -1;
      } else {
        ring(i * 4 + 3, st.ziel, 0, 0);
      }
    });

    // Ringe beim Schwimmer (Platsch beim Landen und beim Biss)
    const basis = this.stellen.length * 4;
    for (let k = 0; k < 2; k++) {
      if (this.schwimmerRinge[k] >= 0) {
        this.schwimmerRinge[k] += dt / 1.0;
        const t = this.schwimmerRinge[k];
        ring(basis + k, this.schwimmerRingOrt[k], 0.15 + t * 1.3, (1 - t) * 0.7);
        if (t >= 1) this.schwimmerRinge[k] = -1;
      } else {
        ring(basis + k, leer, 0, 0);
      }
    }

    this.ringe.instanceMatrix.needsUpdate = true;
    this.ringe.instanceColor.needsUpdate = true;
    this.springer.instanceMatrix.needsUpdate = true;
  }
}
