// =============================================================
//  DINGE IN DER WELT, mit denen man etwas machen kann:
//  das Zelt, die Schaufel, die Grabestellen und der Händler.
//  Steht man nah genug davor, erscheint der Aktions-Knopf.
// =============================================================
import * as THREE from 'three';
import { EINSTELLUNGEN } from './einstellungen.js';
import { zufallMitSeed } from './rauschen.js';
import { bodenHoehe, abstandZumDorf, abstandZumPfad, DORF } from './gelaende.js';
import { baueSchaufel } from './figur.js';
import { DINGE, SCHAUFEL_BILD } from './rucksack.js';

const zufall = zufallMitSeed(99);

// Kuppelzelt – rund, nicht eckig!
function baueZelt() {
  const zelt = new THREE.Group();
  const plane = new THREE.Mesh(
    new THREE.SphereGeometry(1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: '#ff8a3d', roughness: 0.75, side: THREE.DoubleSide })
  );
  plane.scale.set(1.8, 1.5, 2.1);
  const eingang = new THREE.Mesh(new THREE.CircleGeometry(0.75, 24, 0, Math.PI), new THREE.MeshStandardMaterial({ color: '#4a2a18' }));
  eingang.position.set(0, 0.02, 2.05);
  eingang.rotation.x = -0.25;
  const stangenMat = new THREE.MeshStandardMaterial({ color: '#2e4b7a', roughness: 0.5 });
  for (const w of [0.7, -0.7]) {
    const stange = new THREE.Mesh(new THREE.TorusGeometry(1, 0.035, 8, 32, Math.PI), stangenMat);
    stange.scale.set(2.05, 1.52, 1);
    stange.rotation.y = w + Math.PI / 2;
    zelt.add(stange);
  }
  zelt.add(plane, eingang);
  zelt.traverse((t) => {
    if (t.isMesh) t.castShadow = t.receiveShadow = true;
  });
  return zelt;
}

export class Objekte {
  constructor(szene, hindernisse, spiel) {
    this.spiel = spiel; // { rucksack, musik, meldung, tageszeit, spieler, dorf, schlafen }
    this.interaktionen = [];
    this.aktuelle = null;
    this.zeit = 0;
    this.beschaeftigt = false;

    // ---------- Das Zelt ----------
    const zx = 5, zz = -2;
    this.zelt = baueZelt();
    this.zelt.position.set(zx, bodenHoehe(zx, zz), zz);
    this.zelt.rotation.y = -0.6;
    szene.add(this.zelt);
    hindernisse.hinzufuegen(zx, zz, 1.9);
    this.interaktionen.push({
      pos: new THREE.Vector3(zx, 0, zz),
      radius: 4,
      bild: '😴',
      text: 'Schlafen',
      ausfuehren: () => this.schlafenVersuchen(),
    });

    // ---------- Die Schaufel liegt neben dem Zelt ----------
    const sx = -3, sz = 8;
    this.bodenSchaufel = new THREE.Group();
    const schaufel = baueSchaufel();
    schaufel.rotation.z = Math.PI / 2;
    schaufel.position.y = 0.3;
    this.glitzerRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.9, 0.05, 8, 32),
      new THREE.MeshStandardMaterial({ color: '#ffe066', emissive: '#ffcc33', emissiveIntensity: 2 })
    );
    this.glitzerRing.rotation.x = Math.PI / 2;
    this.glitzerRing.position.y = 0.05;
    this.bodenSchaufel.add(schaufel, this.glitzerRing);
    this.bodenSchaufel.position.set(sx, bodenHoehe(sx, sz), sz);
    szene.add(this.bodenSchaufel);
    this.schaufelInteraktion = {
      pos: new THREE.Vector3(sx, 0, sz),
      radius: 2.5,
      bild: SCHAUFEL_BILD,
      text: 'Aufheben',
      ausfuehren: () => this.schaufelAufheben(),
    };
    this.interaktionen.push(this.schaufelInteraktion);

    // ---------- Der Händler im Dorf ----------
    this.interaktionen.push({
      pos: spiel.dorf.haendlerWelt,
      radius: 4.5,
      bild: '🧑‍🌾',
      text: 'Handeln',
      ausfuehren: () => spiel.haendlerOeffnen(),
    });

    this.baueGrabestellen(szene, hindernisse);
    this.baueKruemel(szene);
  }

  baueGrabestellen(szene, hindernisse) {
    const anzahl = EINSTELLUNGEN.anzahlGrabestellen;
    const R = EINSTELLUNGEN.inselGroesse;
    this.grabestellen = [];
    // Ein paar liegen nah am Zelt, damit man sie schnell findet
    const nah = [[12, 14], [-14, 10], [16, -12]];
    for (let versuch = 0; versuch < anzahl * 30 && this.grabestellen.length < anzahl; versuch++) {
      let x, z;
      if (this.grabestellen.length < nah.length) [x, z] = nah[this.grabestellen.length];
      else {
        x = (zufall() - 0.5) * 2 * R * 0.9;
        z = (zufall() - 0.5) * 2 * R * 0.9;
      }
      const h = bodenHoehe(x, z);
      if (h < 1.8 || h > 18) continue;
      if (abstandZumDorf(x, z) < DORF.radius + 3 || abstandZumPfad(x, z) < 2.5) continue;
      if (hindernisse.trifft(x, z, 1.5)) continue;
      this.grabestellen.push({ pos: new THREE.Vector3(x, h, z), da: true, leerSeit: 0 });
    }

    const huegelGeo = new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2);
    this.huegel = new THREE.InstancedMesh(huegelGeo, new THREE.MeshStandardMaterial({ color: '#8a5a34', roughness: 1 }), this.grabestellen.length);
    this.huegel.receiveShadow = true;
    this.glitzer = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.07, 8, 6),
      new THREE.MeshStandardMaterial({ color: '#fff7c2', emissive: '#ffd84a', emissiveIntensity: 3 }),
      this.grabestellen.length * 4
    );
    this.zeigeGrabestellen();
    szene.add(this.huegel, this.glitzer);

    this.grabestellen.forEach((stelle) => {
      this.interaktionen.push({
        pos: stelle.pos,
        radius: 2.4,
        bild: SCHAUFEL_BILD,
        text: 'Graben',
        aktiv: () => stelle.da,
        ausfuehren: () => this.graben(stelle),
      });
    });
  }

  zeigeGrabestellen() {
    const m = new THREE.Matrix4();
    this.grabestellen.forEach((s, i) => {
      const g = s.da ? 1 : 0;
      m.compose(s.pos, new THREE.Quaternion(), new THREE.Vector3(1.1 * g, 0.4 * g, 1.1 * g));
      this.huegel.setMatrixAt(i, m);
    });
    this.huegel.instanceMatrix.needsUpdate = true;
  }

  // Kleine Erdkrümel, die beim Graben herumfliegen
  baueKruemel(szene) {
    this.kruemel = new THREE.InstancedMesh(new THREE.SphereGeometry(0.08, 6, 5), new THREE.MeshStandardMaterial({ color: '#6b4630' }), 24);
    this.kruemelDaten = [];
    for (let i = 0; i < 24; i++) this.kruemelDaten.push({ pos: new THREE.Vector3(), v: new THREE.Vector3(), leben: 0 });
    szene.add(this.kruemel);
  }

  kruemelWerfen(ort) {
    for (const k of this.kruemelDaten) {
      k.pos.copy(ort).add(new THREE.Vector3(0, 0.3, 0));
      k.v.set((Math.random() - 0.5) * 4, 3 + Math.random() * 3, (Math.random() - 0.5) * 4);
      k.leben = 0.6 + Math.random() * 0.5;
    }
  }

  // ---------- Was die Aktionen machen ----------
  schaufelAufheben() {
    const { rucksack, meldung, musik } = this.spiel;
    if (!rucksack.hinein('schaufel')) {
      meldung('Dein Rucksack ist voll!');
      return;
    }
    this.bodenSchaufel.visible = false;
    this.interaktionen.splice(this.interaktionen.indexOf(this.schaufelInteraktion), 1);
    musik.pling();
    meldung('✨ Schaufel gefunden! Öffne den Rucksack 🎒 und tippe sie an, dann hast du sie in der Hand.', 7);
  }

  graben(stelle) {
    const { rucksack, meldung, musik, spieler } = this.spiel;
    if (rucksack.inDerHand !== 'schaufel') {
      meldung(rucksack.hat('schaufel')
        ? 'Nimm erst die Schaufel in die Hand: Rucksack 🎒 öffnen und die Schaufel antippen.'
        : 'Zum Graben brauchst du eine Schaufel! Vielleicht liegt eine beim Zelt? ✨', 5);
      return;
    }
    const fund = this.zufallsFund();
    if (!rucksack.passt(fund)) {
      meldung('Dein Rucksack ist voll! 🎒 Wirf etwas weg oder verkauf es im Dorf.', 4);
      return;
    }
    this.beschaeftigt = true;
    spieler.graben();
    musik.graben();
    this.kruemelWerfen(stelle.pos);
    setTimeout(() => {
      rucksack.hinein(fund);
      stelle.da = false;
      stelle.leerSeit = this.spiel.tageszeit.tag;
      this.zeigeGrabestellen();
      this.kruemelWerfen(stelle.pos);
      musik.pling();
      const ding = DINGE[fund];
      meldung(`Gefunden: ${ding.werkzeug ? '' : ding.bild} ${ding.name}!`, 3);
      this.beschaeftigt = false;
    }, 900);
  }

  zufallsFund() {
    const chancen = Object.entries(EINSTELLUNGEN.fundChancen);
    const summe = chancen.reduce((s, [, c]) => s + c, 0);
    let wurf = Math.random() * summe;
    for (const [id, c] of chancen) {
      wurf -= c;
      if (wurf <= 0) return id;
    }
    return chancen[0][0];
  }

  schlafenVersuchen() {
    const { tageszeit, meldung } = this.spiel;
    if (!tageszeit.istNacht()) {
      const rest = Math.ceil(tageszeit.restSekunden());
      meldung(`Du bist noch gar nicht müde. Schlafen geht nur nachts 🌙 (noch ${Math.floor(rest / 60)}:${String(rest % 60).padStart(2, '0')} Minuten)`, 4);
      return;
    }
    this.spiel.schlafen();
  }

  // Für den Spielstand
  alsDaten() {
    // Für jede Grabestelle: -1 = voll, sonst der Tag, an dem sie leer gegraben wurde
    return { grabestellen: this.grabestellen.map((s) => (s.da ? -1 : s.leerSeit)), schaufelGefunden: !this.bodenSchaufel.visible };
  }

  ladeDaten(d) {
    (d.grabestellen || []).forEach((wert, i) => {
      const s = this.grabestellen[i];
      if (!s) return;
      if (typeof wert === 'boolean') s.da = wert; // alter Spielstand
      else {
        s.da = wert < 0;
        s.leerSeit = wert;
      }
    });
    this.zeigeGrabestellen();
    if (d.schaufelGefunden && this.bodenSchaufel.visible) {
      this.bodenSchaufel.visible = false;
      const i = this.interaktionen.indexOf(this.schaufelInteraktion);
      if (i >= 0) this.interaktionen.splice(i, 1);
    }
  }

  // Ein neuer Morgen: Grabestellen, die lange genug leer waren, sind wieder voll
  neuerTag() {
    const heute = this.spiel.tageszeit.tag;
    let geaendert = false;
    for (const s of this.grabestellen) {
      if (!s.da && heute - s.leerSeit >= EINSTELLUNGEN.nachwachsTage) {
        s.da = true;
        geaendert = true;
      }
    }
    if (geaendert) this.zeigeGrabestellen();
  }

  aktion() {
    if (this.aktuelle && !this.beschaeftigt) this.aktuelle.ausfuehren();
  }

  aktualisiere(dt, spielerPos) {
    this.zeit += dt;
    // Neuer Tag (auch ohne Schlafen)? Dann wachsen Grabestellen nach
    if (this.letzterTag !== this.spiel.tageszeit.tag) {
      this.letzterTag = this.spiel.tageszeit.tag;
      this.neuerTag();
    }
    // Schaufel schwebt und glitzert
    if (this.bodenSchaufel.visible) {
      this.bodenSchaufel.rotation.y += dt;
      this.bodenSchaufel.children[0].position.y = 0.35 + Math.sin(this.zeit * 2.5) * 0.12;
      this.glitzerRing.scale.setScalar(1 + Math.sin(this.zeit * 4) * 0.1);
    }

    // Glitzern über den Grabestellen
    const m = new THREE.Matrix4();
    const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
    this.grabestellen.forEach((stelle, i) => {
      for (let k = 0; k < 4; k++) {
        const funkeln = stelle.da ? Math.max(0, Math.sin(this.zeit * 3 + i * 1.7 + k * 2.1)) : 0;
        const w = k * 1.57 + this.zeit * 0.5;
        p.set(stelle.pos.x + Math.cos(w) * 0.6, stelle.pos.y + 0.5 + k * 0.12, stelle.pos.z + Math.sin(w) * 0.6);
        m.compose(p, q, s.setScalar(funkeln));
        this.glitzer.setMatrixAt(i * 4 + k, m);
      }
    });
    this.glitzer.instanceMatrix.needsUpdate = true;

    // Krümel fliegen
    this.kruemelDaten.forEach((k, i) => {
      if (k.leben > 0) {
        k.leben -= dt;
        k.v.y -= 15 * dt;
        k.pos.addScaledVector(k.v, dt);
      }
      m.compose(k.pos, q, s.setScalar(k.leben > 0 ? 1 : 0));
      this.kruemel.setMatrixAt(i, m);
    });
    this.kruemel.instanceMatrix.needsUpdate = true;

    // Was ist in der Nähe? Das Nächste gewinnt.
    let beste = null, besterAbstand = Infinity;
    for (const ia of this.interaktionen) {
      if (ia.aktiv && !ia.aktiv()) continue;
      const d = Math.hypot(ia.pos.x - spielerPos.x, ia.pos.z - spielerPos.z);
      if (d < ia.radius && d < besterAbstand) {
        beste = ia;
        besterAbstand = d;
      }
    }
    this.aktuelle = beste;
    return beste;
  }
}
