// =============================================================
//  DINGE IN DER WELT, mit denen man etwas machen kann:
//  die Schaufel, die Grabestellen und der Händler.
//  (Das Zelt und das Schlafen wohnen jetzt in base.js)
//  Steht man nah genug davor, erscheint der Aktions-Knopf.
// =============================================================
import * as THREE from 'three';
import { EINSTELLUNGEN } from './einstellungen.js';
import { zufallMitSeed } from './rauschen.js';
import { bodenHoehe, abstandZumDorf, abstandZumPfad, DORF, INSELN, aufWelcherInsel, wasserHoeheBei, istKlippenWand } from './gelaende.js';
import { baueSchaufel } from './figur.js';
import { DINGE, SCHAUFEL_BILD } from './rucksack.js';

const zufall = zufallMitSeed(99);

export class Objekte {
  constructor(szene, hindernisse, spiel) {
    this.spiel = spiel; // { rucksack, musik, meldung, tageszeit, spieler, dorf, schlafen }
    this.interaktionen = [];
    this.aktuelle = null;
    this.zeit = 0;
    this.beschaeftigt = false;

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
    // Nachts schläft der Händler in seiner Hütte – dann kann man nicht handeln
    this.interaktionen.push({
      pos: spiel.dorf.haendlerWelt,
      radius: 4.5,
      get bild() { return spiel.tageszeit.istNacht() ? '💤' : '🧑‍🌾'; },
      get text() { return spiel.tageszeit.istNacht() ? 'Schläft' : 'Handeln'; },
      ausfuehren: () => {
        if (spiel.tageszeit.istNacht()) spiel.meldung('💤 Pssst! Der Händler schläft. Komm morgen früh wieder.', 4);
        else spiel.haendlerOeffnen();
      },
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
    // Die neuen Inseln bekommen auch Grabehügel. WICHTIG: Die kommen HINTEN dran und
    // haben ihren eigenen Zufall – so bleiben die alten Stellen genau gleich
    // und alte Spielstände passen noch.
    this.baueInselGrabestellen(hindernisse);

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

  // ---------- Grabehügel auf der Palmeninsel und oben auf dem Klippen-Plateau ----------
  baueInselGrabestellen(hindernisse) {
    const E = EINSTELLUNGEN;
    const GRAD = Math.PI / 180;
    // Hier soll kein Hügel liegen: bei den Inselbewohnern und den Schatz-Hügeln
    const besetzt = (I) => {
      const liste = [];
      if (I.name === 'Palmeninsel') {
        for (const [richtung, abstand] of (E.bewohner?.plaetze || [])) {
          liste.push({ x: I.x + Math.cos(richtung * GRAD) * abstand, z: I.z + Math.sin(richtung * GRAD) * abstand });
        }
      }
      for (const s of E.schatzHuegel || []) {
        if (s.insel !== I.name) continue;
        if (s.richtung !== undefined) liste.push({ x: I.x + Math.cos(s.richtung * GRAD) * s.abstand, z: I.z + Math.sin(s.richtung * GRAD) * s.abstand });
        else liste.push({ x: s.x, z: s.z });
      }
      return liste;
    };

    INSELN.slice(1).forEach((I, nr) => {
      const info = (E.inselFunde || {})[I.name];
      if (!info) return;
      const z = zufallMitSeed(4711 + nr * 13); // eigener Zufall für jede Insel
      const frei = besetzt(I);
      const neue = [];
      for (let versuch = 0; versuch < 3000 && neue.length < info.anzahl; versuch++) {
        const w = z() * Math.PI * 2;
        const r = Math.sqrt(z()) * I.radius * 0.9;
        const x = I.x + Math.cos(w) * r, zz = I.z + Math.sin(w) * r;
        const h = bodenHoehe(x, zz);
        if (aufWelcherInsel(x, zz) !== I.name) continue;
        if (h < wasserHoeheBei(x, zz) + 1.2) continue; // nicht im Wasser / nicht in der Lagune
        if (I.klippen) {
          // Nur oben auf dem Plateau – da kommt man nur mit der Seilkanone hin!
          if (h < I.plateauHoehe - 3 || istKlippenWand(x, zz)) continue;
          if (I.lagune && Math.hypot(x - I.lagune.x, zz - I.lagune.z) < I.lagune.radius * 1.4) continue;
        }
        if (I.dorfPlatz && Math.hypot(x - I.dorfPlatz.x, zz - I.dorfPlatz.z) < I.dorfPlatz.radius + 12) continue; // nicht ins Dorf
        if ((I.anlegestellen || []).some((a) => Math.hypot(x - a.x, zz - a.z) < 10)) continue; // nicht da, wo die Boote anlegen
        if (frei.some((p) => Math.hypot(x - p.x, zz - p.z) < 8)) continue;
        if (neue.some((s) => Math.hypot(x - s.pos.x, zz - s.pos.z) < 14)) continue; // schön verteilt
        if (hindernisse.trifft(x, zz, 1.5)) continue;
        neue.push({ pos: new THREE.Vector3(x, h, zz), da: true, leerSeit: 0, insel: I.name });
      }
      this.grabestellen.push(...neue);
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
    const fund = this.zufallsFund(stelle.insel);
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

  // insel = auf welcher Insel gegraben wird (die neuen Inseln haben eigene Funde)
  zufallsFund(insel) {
    const eigene = insel && (EINSTELLUNGEN.inselFunde || {})[insel];
    const chancen = Object.entries(eigene ? eigene.funde : EINSTELLUNGEN.fundChancen);
    const summe = chancen.reduce((s, [, c]) => s + c, 0);
    let wurf = Math.random() * summe;
    for (const [id, c] of chancen) {
      wurf -= c;
      if (wurf <= 0) return id;
    }
    return chancen[0][0];
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
