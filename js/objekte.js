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
import { grabeHuegelTeile, sorteVon, huegelLage, kruemelForm, funkelMaterial } from './grabehuegel.js';

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

    // Wie die Hügel aussehen, steht in grabehuegel.js. Jede Insel hat ihre eigene Erde,
    // darum gibt es pro Insel einen "Stapel" (InstancedMesh) Hügel und einen Stapel Mulden.
    this.huegelSorten = [];
    const nachInsel = new Map();
    this.grabestellen.forEach((s, i) => {
      const insel = s.insel || 'Startinsel';
      if (!nachInsel.has(insel)) {
        const teile = grabeHuegelTeile(insel);
        const sorte = { insel, nummern: [], teile };
        nachInsel.set(insel, sorte);
        this.huegelSorten.push(sorte);
      }
      nachInsel.get(insel).nummern.push(i);
    });
    for (const sorte of this.huegelSorten) {
      const n = sorte.nummern.length;
      sorte.huegel = new THREE.InstancedMesh(sorte.teile.huegel.geometrie, sorte.teile.huegel.material, n);
      sorte.mulde = new THREE.InstancedMesh(sorte.teile.mulde.geometrie, sorte.teile.mulde.material, n);
      sorte.huegel.receiveShadow = sorte.mulde.receiveShadow = true;
      szene.add(sorte.huegel, sorte.mulde);
    }
    // Jeder Hügel liegt so schräg wie der Boden und ist ein bisschen anders gedreht und groß
    this.huegelLagen = this.grabestellen.map((s, i) => {
      const z = zufallMitSeed(1000 + i * 7);
      return { ...huegelLage(s.pos.x, s.pos.z, z() * Math.PI * 2), groesse: 0.92 + z() * 0.22, breit: 0.9 + z() * 0.2 };
    });
    // Funkeln: kleine Sterne über vollen Hügeln, damit man sie findet
    this.glitzer = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), funkelMaterial(), this.grabestellen.length * 4);
    this.glitzer.frustumCulled = false;
    this.zeigeGrabestellen();
    szene.add(this.glitzer);

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
    const m = new THREE.Matrix4(), gr = new THREE.Vector3();
    const heute = this.spiel.tageszeit?.tag ?? 0;
    const tage = Math.max(1, EINSTELLUNGEN.nachwachsTage);
    for (const sorte of this.huegelSorten) {
      let leere = 0;
      sorte.nummern.forEach((i, j) => {
        const s = this.grabestellen[i], L = this.huegelLagen[i];
        // Nachwachsen (nur fürs Aussehen): 0 = gerade ausgegraben, fast 1 = bald wieder voll
        const wachsen = s.da ? 1 : Math.min(0.95, Math.max(0, (heute - s.leerSeit) / tage));
        const h = s.da ? 1 : wachsen > 0 ? 0.35 + 0.4 * wachsen : 0;
        m.compose(L.ort, L.drehung, gr.set(L.groesse * L.breit * h, L.groesse * h * (s.da ? 1 : 0.7), (L.groesse / L.breit) * h));
        sorte.huegel.setMatrixAt(j, m);
        // Die Mulde (nur wenn leer gegraben)
        const mg = s.da ? 0 : L.groesse * (1 - 0.2 * wachsen);
        if (!s.da) leere++;
        m.compose(L.ort, L.drehung, gr.set(mg, mg, mg));
        sorte.mulde.setMatrixAt(j, m);
      });
      sorte.huegel.instanceMatrix.needsUpdate = sorte.mulde.instanceMatrix.needsUpdate = true;
      sorte.huegel.computeBoundingSphere();
      sorte.mulde.computeBoundingSphere();
      sorte.mulde.visible = leere > 0; // keine Mulde da? Dann gar nicht malen
    }
  }

  // Erdbrocken, die beim Graben herumfliegen, kullern und liegen bleiben
  baueKruemel(szene) {
    const form = kruemelForm();
    this.kruemel = new THREE.InstancedMesh(form.geometrie, form.material, 24);
    this.kruemel.frustumCulled = false;
    // Am Anfang sichtbar (aber winzig klein), damit das Grafik-Programm gleich vorbereitet wird.
    // Danach wird es nur gemalt, solange Brocken fliegen.
    const winzig = new THREE.Matrix4().makeScale(0, 0, 0);
    this.kruemelDaten = [];
    for (let i = 0; i < 24; i++) {
      this.kruemelDaten.push({
        pos: new THREE.Vector3(), v: new THREE.Vector3(), leben: 0, liegt: false,
        achse: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(),
        dreh: 0, groesse: 1,
      });
      this.kruemel.setColorAt(i, new THREE.Color('#6b4527'));
      this.kruemel.setMatrixAt(i, winzig);
    }
    szene.add(this.kruemel);
  }

  // stelle = welche Grabestelle (für die Farbe der Erde auf der Insel)
  kruemelWerfen(ort, stelle) {
    const farben = sorteVon(stelle?.insel).kruemel;
    const c = new THREE.Color();
    this.kruemelDaten.forEach((k, i) => {
      const w = Math.random() * Math.PI * 2, r = Math.random() * 0.4;
      k.pos.set(ort.x + Math.cos(w) * r, ort.y + 0.35, ort.z + Math.sin(w) * r);
      k.v.set((Math.random() - 0.5) * 4, 2.5 + Math.random() * 3, (Math.random() - 0.5) * 4);
      k.leben = 1.0 + Math.random() * 0.6;
      k.liegt = false;
      k.groesse = 0.5 + Math.random() * 1.1;
      this.kruemel.setColorAt(i, c.set(farben[Math.floor(Math.random() * farben.length)]));
    });
    this.kruemel.instanceColor.needsUpdate = true;
    this.kruemel.visible = true;
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
    // Bei der allerersten Grabe-Aufgabe findet man genau das, was noch fehlt (bis zu 2 Sachen pro Hügel)
    const anfaenger = this.anfaengerFunde(stelle);
    if (anfaenger) return this.ausgraben(stelle, anfaenger);
    if (!rucksack.passt(fund)) {
      meldung('Dein Rucksack ist voll! 🎒 Wirf etwas weg oder verkauf es im Dorf.', 4);
      return;
    }
    this.beschaeftigt = true;
    spieler.graben();
    musik.graben();
    this.kruemelWerfen(stelle.pos, stelle);
    setTimeout(() => {
      rucksack.hinein(fund);
      stelle.da = false;
      stelle.leerSeit = this.spiel.tageszeit.tag;
      this.zeigeGrabestellen();
      this.kruemelWerfen(stelle.pos, stelle);
      musik.pling();
      const ding = DINGE[fund];
      meldung(`Gefunden: ${ding.werkzeug ? '' : ding.bild} ${ding.name}!`, 3);
      this.beschaeftigt = false;
    }, 900);
  }

  // Was fehlt noch für „Grab 3 Steine und 2 Eisenerz“? (Nur auf der Startinsel, nur bei dieser Aufgabe)
  anfaengerFunde(stelle) {
    const { rucksack, aufgaben } = this.spiel;
    if (!aufgaben || aufgaben.nummer !== 2 || stelle.insel) return null;
    const funde = [];
    if (rucksack.anzahl('eisenerz') < 2) funde.push('eisenerz');
    if (rucksack.anzahl('stein') < 3) funde.push('stein');
    return funde.length ? funde : null; // höchstens 2: ein Eisenerz und ein Stein
  }

  // Mehrere Funde auf einmal ausgraben
  ausgraben(stelle, funde) {
    const { rucksack, meldung, musik, spieler } = this.spiel;
    if (!funde.every((f) => rucksack.passt(f))) {
      meldung('Dein Rucksack ist voll! 🎒 Wirf etwas weg oder verkauf es im Dorf.', 4);
      return;
    }
    this.beschaeftigt = true;
    spieler.graben();
    musik.graben();
    this.kruemelWerfen(stelle.pos, stelle);
    setTimeout(() => {
      funde.forEach((f) => rucksack.hinein(f));
      stelle.da = false;
      stelle.leerSeit = this.spiel.tageszeit.tag;
      this.zeigeGrabestellen();
      this.kruemelWerfen(stelle.pos, stelle);
      musik.pling();
      meldung(`Gefunden: ${funde.map((f) => `${DINGE[f].bild} ${DINGE[f].name}`).join(' und ')}!`, 3);
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
    for (const s of this.grabestellen) {
      if (!s.da && heute - s.leerSeit >= EINSTELLUNGEN.nachwachsTage) s.da = true;
    }
    this.zeigeGrabestellen(); // auch halb nachgewachsene Hügel wachsen ein Stück
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

    // Funkeln über den Grabestellen: Sterne blitzen kurz auf und steigen langsam hoch
    const m = new THREE.Matrix4();
    const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
    this.grabestellen.forEach((stelle, i) => {
      for (let k = 0; k < 4; k++) {
        const welle = Math.sin(this.zeit * 2.4 + i * 1.7 + k * 2.1);
        const funkeln = stelle.da ? Math.pow(Math.max(0, welle), 3) : 0;
        const w = k * 1.57 + i + this.zeit * 0.4;
        const r = 0.3 + ((k * 0.37 + i * 0.11) % 1) * 0.5;
        const steigen = (this.zeit * 0.25 + k * 0.25 + i * 0.13) % 1;
        p.set(stelle.pos.x + Math.cos(w) * r, stelle.pos.y + 0.45 + steigen * 0.6 + (k % 2) * 0.15, stelle.pos.z + Math.sin(w) * r);
        m.compose(p, q, s.setScalar(funkeln * (k % 2 ? 0.45 : 0.6)));
        this.glitzer.setMatrixAt(i * 4 + k, m);
      }
    });
    this.glitzer.instanceMatrix.needsUpdate = true;

    // Erdbrocken fliegen, fallen auf den Boden, kullern kurz und verschwinden
    if (this.kruemel.visible) {
      let fliegen = false;
      this.kruemelDaten.forEach((k, i) => {
        if (k.leben > 0) {
          fliegen = true;
          k.leben -= dt;
          if (!k.liegt) {
            k.v.y -= 15 * dt;
            k.pos.addScaledVector(k.v, dt);
            k.dreh += dt * 9;
            const boden = bodenHoehe(k.pos.x, k.pos.z) + 0.05 * k.groesse;
            if (k.pos.y < boden) {
              k.pos.y = boden;
              if (k.v.y < -2) { // hüpft noch einmal ein bisschen
                k.v.set(k.v.x * 0.4, -k.v.y * 0.25, k.v.z * 0.4);
              } else k.liegt = true;
            }
          }
        }
        q.setFromAxisAngle(k.achse, k.dreh);
        // am Ende schrumpfen sie weg (sie "versickern" im Boden)
        m.compose(k.pos, q, s.setScalar(k.leben > 0 ? k.groesse * Math.min(1, k.leben / 0.3) : 0));
        this.kruemel.setMatrixAt(i, m);
      });
      this.kruemel.instanceMatrix.needsUpdate = true;
      this.kruemel.visible = fliegen;
      q.identity();
    }

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
