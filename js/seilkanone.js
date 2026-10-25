// =============================================================
//  DIE SEILKANONE – damit kommst du auf hohe Klippen!
//  Kanone in die Hand nehmen, vor eine hohe Wand stellen, "Hochschießen".
//  Der Haken fliegt hoch und hakt sich oben an der Kante ein.
//  Dann klettert die Figur am Seil hoch. Das Seil bleibt hängen –
//  so kannst du später wieder runter- und hochklettern.
//  Das Seil geht nie leer: Die Kanone hat ihr eigenes Seil (man baut es einmal mit ein).
// =============================================================
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { EINSTELLUNGEN } from './einstellungen.js';
import { bodenHoehe, WASSER_HOEHE } from './gelaende.js';
import { BEIN_LAENGE } from './junge.js';

// Aus so vielen kleinen Stücken besteht jedes Seil (mehr = runder, aber langsamer)
const SEIL_STUECKE = 40;
// Wie dick ist das Seil? (Meter)
const SEIL_DICKE = 0.035;
// So weit hängt die Figur beim Klettern vor der Wand (Meter)
const WAND_ABSTAND = 0.45;

const E = () => EINSTELLUNGEN.seilkanone;
const glatt = (t) => t * t * (3 - 2 * t);

// ---------- Der Widerhaken: 3 runde Haken-Bögen und ein Stiel ----------
// Alles wird zu EINEM Modell zusammengeklebt (spart Draw Calls).
// Der Stiel zeigt nach +y, die Haken-Spitzen biegen sich nach unten.
function baueHakenGeometrie() {
  const teile = [];
  const stiel = new THREE.CylinderGeometry(0.05, 0.05, 0.5, 8);
  stiel.translate(0, 0.25, 0);
  teile.push(stiel);
  teile.push(new THREE.SphereGeometry(0.08, 10, 8)); // runde Kugel unten, da hängt das Seil
  for (let i = 0; i < 3; i++) {
    const drehung = new THREE.Matrix4().makeRotationY((i / 3) * Math.PI * 2);
    // Ein halber Ring = ein runder Haken (nicht eckig!), geht oben vom Stiel nach außen
    const bogen = new THREE.TorusGeometry(0.16, 0.035, 6, 12, Math.PI);
    bogen.translate(0.16, 0.5, 0);
    bogen.applyMatrix4(drehung);
    // Die Spitze am Ende zeigt nach unten – damit krallt er sich fest
    const spitze = new THREE.ConeGeometry(0.05, 0.12, 8);
    spitze.rotateX(Math.PI);
    spitze.translate(0.32, 0.46, 0);
    spitze.applyMatrix4(drehung);
    teile.push(bogen, spitze);
  }
  const geo = mergeGeometries(teile, false);
  teile.forEach((g) => g.dispose());
  return geo;
}

// ---------- Die Kanone in der Hand: rund und comicartig ----------
// Das Rohr zeigt nach +z (nach vorne), vorne steckt der Haken drin.
function baueKanone(hakenGeo, hakenMaterial) {
  const kanone = new THREE.Group();
  const rot = new THREE.MeshStandardMaterial({ color: '#d94a3a', roughness: 0.45, metalness: 0.15 });
  const gold = new THREE.MeshStandardMaterial({ color: '#f2b53a', roughness: 0.35, metalness: 0.5 });
  const holz = new THREE.MeshStandardMaterial({ color: '#9a6a3c', roughness: 0.85 });
  // Dickes, rundes Rohr
  const rohr = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.34, 6, 14), rot);
  rohr.rotation.x = Math.PI / 2;
  rohr.position.z = 0.12;
  // Goldener Ring vorne an der Mündung und einer in der Mitte
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.035, 8, 18), gold);
  ring.position.z = 0.36;
  const ring2 = ring.clone();
  ring2.position.z = 0.08;
  ring2.scale.setScalar(1.08);
  // Runder Griff unten (den hält die Hand)
  const griff = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.12, 4, 10), holz);
  griff.position.set(0, -0.12, 0.02);
  griff.rotation.x = -0.35;
  // Seil-Rolle an der Seite
  const rolle = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.03, 8, 16), new THREE.MeshStandardMaterial({ color: '#e8d6a8', roughness: 0.95 }));
  rolle.rotation.y = Math.PI / 2;
  rolle.position.set(0.12, 0.02, 0.0);
  // Der Haken steckt vorne im Rohr (fliegt beim Schießen weg)
  const haken = new THREE.Mesh(hakenGeo, hakenMaterial);
  haken.rotation.x = Math.PI / 2; // Stiel zeigt nach vorne
  haken.position.z = 0.34;
  haken.scale.setScalar(0.55);
  // Von hier fliegt der Haken los
  const muendung = new THREE.Object3D();
  muendung.position.z = 0.42;
  kanone.add(rohr, ring, ring2, griff, rolle, haken, muendung);
  kanone.traverse((t) => {
    if (t.isMesh) t.castShadow = true;
  });
  return { kanone, haken, muendung };
}

export class Seilkanone {
  constructor(szene, spiel) {
    // spiel = { rucksack, meldung, musik, spieler, hindernisse }
    // optional: handFrei = () => true/false (z. B. nicht beim Rudern oder Reiten)
    this.spiel = spiel;
    this.spieler = spiel.spieler;
    this.handFrei = spiel.handFrei || (() => true);
    const max = E().maxSeile;

    // ---------- Seile: viele kleine Stücke, aber nur 1 Draw Call ----------
    // Platz 0 … max-1 = hängende Seile, Platz max = das fliegende Seil beim Schuss
    const seilGeo = new THREE.CylinderGeometry(SEIL_DICKE, SEIL_DICKE, 1, 6, 1, true);
    seilGeo.translate(0, 0.5, 0); // fängt unten an, hört oben auf
    const seilMaterial = new THREE.MeshStandardMaterial({ color: '#d9b97a', roughness: 0.95 });
    this.seilMesh = new THREE.InstancedMesh(seilGeo, seilMaterial, (max + 1) * SEIL_STUECKE);
    this.seilMesh.frustumCulled = false;
    this.seilMesh.castShadow = true;
    const leer = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < this.seilMesh.count; i++) this.seilMesh.setMatrixAt(i, leer);
    szene.add(this.seilMesh);

    // ---------- Haken: auch alle zusammen 1 Draw Call ----------
    this.hakenGeo = baueHakenGeometrie();
    this.hakenMaterial = new THREE.MeshStandardMaterial({ color: '#9aa4ae', metalness: 0.75, roughness: 0.3 });
    this.hakenMesh = new THREE.InstancedMesh(this.hakenGeo, this.hakenMaterial, max + 1);
    this.hakenMesh.frustumCulled = false;
    this.hakenMesh.castShadow = true;
    for (let i = 0; i <= max; i++) this.hakenMesh.setMatrixAt(i, leer);
    szene.add(this.hakenMesh);

    // ---------- Die Kanone in der rechten Hand ----------
    const { kanone, haken, muendung } = baueKanone(this.hakenGeo, this.hakenMaterial);
    this.handModell = new THREE.Group();
    this.handModell.add(kanone);
    // Die Hand zeigt beim Halten nach vorne – das Rohr soll auch nach vorne zeigen
    kanone.rotation.x = Math.PI / 2;
    kanone.position.y = -0.05;
    kanone.scale.setScalar(0.8);
    this.handHaken = haken;
    this.muendung = muendung;
    this.handModell.visible = false;
    this.spieler.handR.add(this.handModell);

    // ---------- Die hängenden Seile ----------
    this.seile = []; // { fuss, kante, oben, unten, richtung, punkte, laengen, platz }
    this.plaetzeFrei = Array.from({ length: max }, (_, i) => i);

    // Für jeden Seil-Platz zwei Knöpfe: unten "Hochklettern", oben "Runterklettern"
    this.interaktionen = [];
    this.platzInfo = [];
    for (let i = 0; i < max; i++) {
      const unten = {
        pos: new THREE.Vector3(),
        radius: 2.4,
        bild: '🪢',
        text: 'Hochklettern',
        aktiv: () => {
          const s = this.seilAufPlatz(i);
          return !!s && !this.beschaeftigt && this.spieler.figur.position.y < s.kante.y - 3;
        },
        ausfuehren: () => this.klettern(this.seilAufPlatz(i), 'hoch'),
      };
      const oben = {
        pos: new THREE.Vector3(),
        radius: 2.6,
        bild: '🪢',
        text: 'Runterklettern',
        aktiv: () => {
          const s = this.seilAufPlatz(i);
          return !!s && !this.beschaeftigt && this.spieler.figur.position.y > s.kante.y - 2.5;
        },
        ausfuehren: () => this.klettern(this.seilAufPlatz(i), 'runter'),
      };
      this.platzInfo.push({ unten, oben });
      this.interaktionen.push(unten, oben);
    }

    // Was gerade passiert: null, 'flug', 'einhaken', 'hinlaufen', 'klettern', 'hochziehen'
    this.zustand = null;
    this.zeit = 0;
    this.wandMerker = { x: Infinity, z: Infinity, w: 0, uhr: 0, wand: null };
    this.hilf = { a: new THREE.Vector3(), b: new THREE.Vector3(), m: new THREE.Matrix4(), q: new THREE.Quaternion(), s: new THREE.Vector3(), hoch: new THREE.Vector3(0, 1, 0) };
  }

  // Während Flug und Klettern steuert die Seilkanone die Figur (Joystick aus)
  get beschaeftigt() {
    return this.zustand !== null;
  }

  seilAufPlatz(i) {
    return this.seile.find((s) => s.platz === i) || null;
  }

  // ---------- Gibt es vor mir eine hohe Wand? ----------
  // Wir gehen in Blickrichtung Schritt für Schritt und schauen, wie hoch der Boden ist.
  findeWand(x, z, winkel) {
    const e = E();
    const rx = Math.sin(winkel), rz = Math.cos(winkel);
    const SCHRITT = 0.5;
    const h = (d) => bodenHoehe(x + rx * d, z + rz * d);
    const steigung = (d) => (h(d + 1) - h(d)) / 1; // wie viel geht es auf 1 m hoch?
    // 1) Wo fängt es an, steil zu werden? (der Fuß der Wand)
    let fussD = null;
    for (let d = 0; d <= e.suchWeite; d += SCHRITT) {
      if (steigung(d) > e.wandSteil) {
        fussD = d;
        break;
      }
    }
    if (fussD === null) return null;
    // 2) Wo wird es oben wieder flach? (die Kante)
    let kanteD = null;
    for (let d = fussD; d <= fussD + e.wandMaxBreite; d += SCHRITT * 0.5) {
      if (steigung(d) < e.kanteFlach) {
        kanteD = d;
        break;
      }
    }
    if (kanteD === null) return null;
    const hFuss = h(fussD), hKante = h(kanteD);
    if (hKante - hFuss < e.wandMinHoehe) return null; // zu niedrig – da kann man hochlaufen
    if (hFuss < WASSER_HOEHE - 0.5) return null; // der Fuß ist im tiefen Wasser
    // 3) Wo kann man oben sicher stehen? (ein Stück hinter der Kante)
    let obenD = null;
    for (let d = kanteD + 1.2; d <= kanteD + 6; d += SCHRITT) {
      const px = x + rx * d, pz = z + rz * d;
      if (this.spieler.kannStehen(px, pz) && h(d) > WASSER_HOEHE + 0.3 && Math.abs(steigung(d - 0.5)) < 0.6) {
        obenD = d;
        break;
      }
    }
    if (obenD === null) return null;
    // 4) Wo steht man unten? (kurz vor der Wand, aber nicht hinter sich selbst)
    const untenD = Math.max(0, fussD - 0.6);
    const punkt = (d) => ({ x: x + rx * d, z: z + rz * d, y: h(d) });
    return {
      richtung: { x: rx, z: rz },
      fuss: punkt(fussD),
      kante: punkt(kanteD),
      oben: punkt(obenD),
      unten: punkt(untenD),
      hoehe: hKante - hFuss,
    };
  }

  // findeWand kostet etwas Rechenzeit – darum nur neu suchen, wenn man sich bewegt hat
  wandVorMir(pos, winkel) {
    const w = this.wandMerker;
    const jetzt = performance.now();
    const gedreht = Math.abs(Math.atan2(Math.sin(winkel - w.w), Math.cos(winkel - w.w)));
    if (Math.hypot(pos.x - w.x, pos.z - w.z) > 0.3 || gedreht > 0.06 || jetzt - w.uhr > 500) {
      w.x = pos.x;
      w.z = pos.z;
      w.w = winkel;
      w.uhr = jetzt;
      w.wand = this.findeWand(pos.x, pos.z, winkel);
    }
    return w.wand;
  }

  // ---------- Text für den Aktions-Knopf (wenn die Kanone in der Hand ist) ----------
  aktionText(pos, blickWinkel) {
    if (this.beschaeftigt) return null;
    return this.wandVorMir(pos, blickWinkel) ? { bild: '🪝', text: 'Hochschießen' } : { bild: '🪝', text: 'Schießen' };
  }

  // ---------- Schießen! ----------
  schiessen(pos = this.spieler.figur.position, blickWinkel = this.spieler.figur.rotation.y) {
    const { rucksack, meldung, musik } = this.spiel;
    if (this.beschaeftigt) return false;
    const wand = this.findeWand(pos.x, pos.z, blickWinkel);
    if (!wand) {
      meldung('Hier ist keine hohe Wand.', 3);
      musik.gehtNicht?.();
      return false;
    }
    // Das Seil geht nie leer – die Kanone hat ihr eigenes Seil (Entscheidung Game Designer).
    // Schon zu viele Seile an den Wänden? Dann holen wir das älteste ein.
    if (this.seile.length >= E().maxSeile) {
      this.entferneSeil(this.seile[0]);
      meldung(`Mehr als ${E().maxSeile} Seile gehen nicht – dein ältestes Seil hast du wieder eingeholt.`, 5);
    }

    const seil = this.baueSeil(wand);
    this.spieler.figur.rotation.y = Math.atan2(wand.richtung.x, wand.richtung.z); // zur Wand drehen
    // Der Haken fliegt los: von der Kanone bis zur Kante
    this.spieler.figur.updateMatrixWorld(true);
    const start = this.muendung.getWorldPosition(new THREE.Vector3());
    const ziel = seil.punkte[seil.punkte.length - 1].clone();
    this.schuss = { seil, start, ziel, dauer: Math.max(0.45, start.distanceTo(ziel) / E().hakenTempo) };
    this.handHaken.visible = false;
    this.zustand = 'flug';
    this.zeit = 0;
    this.klangSchuss();
    return true;
  }

  // ---------- Ein Seil an die Wand hängen ----------
  // Das Seil liegt an der Wand an: Es geht vom Fuß bis zur Kante und ein Stück drüber.
  baueSeil(wand, platz = this.plaetzeFrei.shift()) {
    const { fuss, kante, oben, unten, richtung } = wand;
    const roh = [];
    const N = 70;
    const nx = -richtung.x * 0.22, nz = -richtung.z * 0.22; // ein bisschen vor der Wand
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const x = THREE.MathUtils.lerp(fuss.x, kante.x, t), z = THREE.MathUtils.lerp(fuss.z, kante.z, t);
      const gerade = THREE.MathUtils.lerp(fuss.y, kante.y, t);
      // Das Seil hängt gerade runter, aber nie IN der Wand
      const y = Math.max(gerade, bodenHoehe(x + nx, z + nz) + 0.12, bodenHoehe(x, z) + 0.05);
      roh.push(new THREE.Vector3(x + nx * (1 - t), y + (i === 0 ? 0.05 : 0), z + nz * (1 - t)));
    }
    // Oben über die Kante bis zum Haken
    const hx = kante.x + richtung.x * 0.9, hz = kante.z + richtung.z * 0.9;
    roh.push(new THREE.Vector3(hx, bodenHoehe(hx, hz) + 0.12, hz));
    const punkte = gleichmaessig(roh, SEIL_STUECKE + 1);
    const laengen = [0];
    for (let i = 1; i < punkte.length; i++) laengen.push(laengen[i - 1] + punkte[i].distanceTo(punkte[i - 1]));
    // Bis zu welcher Länge ist man an der Kante? (danach zieht man sich hoch)
    let kanteLaenge = laengen[laengen.length - 1];
    for (let i = 0; i < punkte.length; i++) {
      if (punkte[i].y >= kante.y - 0.05) {
        kanteLaenge = laengen[i];
        break;
      }
    }
    const seil = { fuss, kante, oben, unten, richtung, punkte, laengen, kanteLaenge, platz, sichtbar: 0 };
    this.seile.push(seil);
    const ia = this.platzInfo[platz];
    ia.unten.pos.set(unten.x, unten.y, unten.z);
    ia.oben.pos.set(oben.x, oben.y, oben.z);
    return seil;
  }

  entferneSeil(seil) {
    const i = this.seile.indexOf(seil);
    if (i < 0) return;
    this.seile.splice(i, 1);
    this.plaetzeFrei.push(seil.platz);
    this.zeigeSeil(seil.platz, null);
    this.zeigeHaken(seil.platz, null);
  }

  // Ein Seil (Liste von Punkten) als viele kleine Röhren zeigen
  zeigeSeil(platz, punkte, bis = Infinity) {
    const { a, m, q, s, hoch } = this.hilf;
    for (let i = 0; i < SEIL_STUECKE; i++) {
      const nr = platz * SEIL_STUECKE + i;
      if (!punkte || i + 1 >= punkte.length || i >= bis) {
        m.makeScale(0, 0, 0);
      } else {
        a.subVectors(punkte[i + 1], punkte[i]);
        const laenge = a.length();
        q.setFromUnitVectors(hoch, a.normalize());
        m.compose(punkte[i], q, s.set(1, laenge, 1));
      }
      this.seilMesh.setMatrixAt(nr, m);
    }
    this.seilMesh.instanceMatrix.needsUpdate = true;
  }

  // Den Haken zeigen: an der Stelle "pos", der Stiel zeigt in Richtung "richtung"
  zeigeHaken(platz, pos, richtung) {
    const { m, q, s, hoch, a } = this.hilf;
    if (!pos) m.makeScale(0, 0, 0);
    else {
      q.setFromUnitVectors(hoch, a.copy(richtung).normalize());
      m.compose(pos, q, s.setScalar(0.9));
    }
    this.hakenMesh.setMatrixAt(platz, m);
    this.hakenMesh.instanceMatrix.needsUpdate = true;
  }

  // Ein hängendes Seil fertig zeigen (mit dem Haken oben, der in den Boden greift)
  zeigeFertigesSeil(seil) {
    this.zeigeSeil(seil.platz, seil.punkte);
    const p = seil.punkte;
    const ende = p[p.length - 1];
    // Haken liegt oben auf dem Boden, Stiel zeigt vom Seil weg
    const r = new THREE.Vector3(seil.richtung.x, -0.25, seil.richtung.z);
    this.zeigeHaken(seil.platz, ende, r);
  }

  // ---------- Klettern: hoch (von unten) oder runter (von oben) ----------
  klettern(seil, richtung) {
    if (!seil || this.beschaeftigt) return;
    const pos = this.spieler.figur.position;
    this.kletter = { seil, richtung, s: richtung === 'hoch' ? 0 : seil.kanteLaenge, takt: 0 };
    // Erst zum Startpunkt laufen (unten am Fuß oder oben an die Kante)
    const ziel = richtung === 'hoch' ? seil.unten : this.kletterPunkt(seil, seil.kanteLaenge, new THREE.Vector3());
    this.lauf = { von: pos.clone(), nach: new THREE.Vector3(ziel.x, ziel.y, ziel.z) };
    this.lauf.dauer = Math.max(0.15, this.lauf.von.distanceTo(this.lauf.nach) / (EINSTELLUNGEN.laufTempo * 0.8));
    this.zustand = 'hinlaufen';
    this.zeit = 0;
  }

  // Wo sind die Füße, wenn man bei Seil-Länge "s" ist? (etwas vor der Wand)
  kletterPunkt(seil, s, ziel) {
    const { punkte, laengen } = seil;
    let i = 1;
    while (i < laengen.length - 1 && laengen[i] < s) i++;
    const t = THREE.MathUtils.clamp((s - laengen[i - 1]) / Math.max(1e-4, laengen[i] - laengen[i - 1]), 0, 1);
    ziel.lerpVectors(punkte[i - 1], punkte[i], t);
    // Die Hände greifen das Seil – die Füße sind etwas tiefer
    ziel.x -= seil.richtung.x * WAND_ABSTAND;
    ziel.z -= seil.richtung.z * WAND_ABSTAND;
    ziel.y -= 1.45;
    ziel.y = Math.max(ziel.y, bodenHoehe(ziel.x, ziel.z));
    return ziel;
  }

  // ---------- Jedes Bild ----------
  // Bitte NACH spieler.aktualisiere aufrufen (damit die Arm-Haltung stimmt)
  aktualisiere(dt) {
    const sp = this.spieler;
    const inDerHand = this.spiel.rucksack.inDerHand === 'seilkanone' && this.handFrei();
    this.handModell.visible = inDerHand || this.zustand === 'flug' || this.zustand === 'einhaken';
    if (this.zustand) this.zeit += dt;

    // Neue Seile blenden beim Einhaken von oben nach unten ein
    for (const seil of this.seile) {
      if (seil.sichtbar < 1 && seil !== this.schuss?.seil) {
        seil.sichtbar = Math.min(1, seil.sichtbar + dt * 3);
        this.zeigeFertigesSeil(seil);
      }
    }

    if (this.zustand === 'flug') this.fliegeHaken();
    else if (this.zustand === 'einhaken') {
      // Kurz am Seil ziehen: hält es? Ja!
      this.zielPose(dt, Math.sin(this.zeit * 20) * 0.08);
      if (this.zeit > 0.45) {
        const s = this.schuss.seil;
        this.schuss = null;
        this.handHaken.visible = true;
        this.zeigeSeil(E().maxSeile, null);
        this.zeigeHaken(E().maxSeile, null);
        this.zeigeFertigesSeil(s);
        s.sichtbar = 1;
        this.zustand = null;
        this.klettern(s, 'hoch');
      }
    } else if (this.zustand === 'hinlaufen') {
      const l = this.lauf;
      const t = Math.min(1, this.zeit / l.dauer);
      sp.figur.position.lerpVectors(l.von, l.nach, t);
      const bodenY = bodenHoehe(sp.figur.position.x, sp.figur.position.z);
      sp.figur.position.y = this.kletter.richtung === 'hoch' ? Math.max(bodenY, THREE.MathUtils.lerp(l.von.y, l.nach.y, t)) : THREE.MathUtils.lerp(l.von.y, l.nach.y, t);
      const dx = l.nach.x - l.von.x, dz = l.nach.z - l.von.z;
      if (Math.hypot(dx, dz) > 0.3 && t < 1) sp.figur.rotation.y = this.drehZu(sp.figur.rotation.y, Math.atan2(dx, dz), dt);
      sp.animiere(dt, t < 1 && l.dauer > 0.2 ? EINSTELLUNGEN.laufTempo * 0.8 : 0);
      if (t >= 1) {
        this.zustand = 'klettern';
        this.zeit = 0;
        if (this.kletter.richtung === 'runter') this.spiel.meldung('🪢 Vorsichtig runterklettern …', 2.5);
      }
    } else if (this.zustand === 'klettern') {
      this.klettereSchritt(dt);
    } else if (this.zustand === 'hochziehen') {
      this.zieheHoch(dt);
    } else if (inDerHand) {
      // Kanone halten: Arm nach vorne, Ellbogen leicht gebeugt
      sp.k.schulterR.rotation.set(-1.15 + Math.sin(sp.uhr * 2.3) * 0.02, 0, 0.12);
      sp.k.ellbogenR.rotation.x = -0.45;
    }
  }

  drehZu(von, nach, dt) {
    const diff = Math.atan2(Math.sin(nach - von), Math.cos(nach - von));
    return von + diff * Math.min(1, dt * 10);
  }

  // Arm hoch, die Kanone zielt nach oben
  zielPose(dt, ruck = 0) {
    const sp = this.spieler;
    sp.animiere(dt, 0);
    sp.k.schulterR.rotation.set(-2.2 + ruck, 0, 0.15);
    sp.k.ellbogenR.rotation.x = -0.2;
    sp.k.kopf.rotation.x = -0.35;
    sp.k.schulterL.rotation.set(-0.5 + ruck, 0, -0.25);
  }

  // Der Haken fliegt in einem Bogen hoch, das Seil hinterher
  fliegeHaken() {
    const sch = this.schuss;
    const t = Math.min(1, this.zeit / sch.dauer);
    this.zielPose(1 / 60);
    const start = this.muendung.getWorldPosition(this.hilf.b);
    const kopf = new THREE.Vector3().lerpVectors(sch.start, sch.ziel, t);
    kopf.y += Math.sin(t * Math.PI) * 2.5; // ein kleiner Bogen
    // Das Seil hinterher: von der Kanone bis zum Haken, etwas durchhängend
    const punkte = [];
    for (let i = 0; i <= SEIL_STUECKE; i++) {
      const u = i / SEIL_STUECKE;
      const p = new THREE.Vector3().lerpVectors(start, kopf, u);
      p.y -= Math.sin(u * Math.PI) * 1.2 * t;
      punkte.push(p);
    }
    const platz = E().maxSeile;
    this.zeigeSeil(platz, punkte);
    const flugRichtung = new THREE.Vector3().subVectors(kopf, punkte[SEIL_STUECKE - 2]);
    this.zeigeHaken(platz, kopf, flugRichtung);
    if (t >= 1) {
      // Klonk! Eingehakt.
      this.zustand = 'einhaken';
      this.zeit = 0;
      this.klangEinhaken();
      this.spiel.meldung('🪝 Eingehakt! Jetzt klettern …', 2.5);
      // Das Seil liegt jetzt an der Wand
      this.zeigeSeil(platz, null);
      this.zeigeHaken(platz, null);
      sch.seil.sichtbar = 0;
    }
  }

  // ---------- Am Seil klettern: Arme greifen abwechselnd ----------
  klettereSchritt(dt) {
    const sp = this.spieler, kl = this.kletter, seil = kl.seil;
    const hoch = kl.richtung === 'hoch';
    const tempo = E().kletterTempo * (hoch ? 1 : 1.4); // runter geht's schneller
    kl.s += (hoch ? 1 : -1) * tempo * dt;
    const vorherTakt = Math.floor(kl.takt / Math.PI);
    kl.takt += tempo * dt * 3.2;
    if (Math.floor(kl.takt / Math.PI) !== vorherTakt) this.klangGriff();
    const fertig = hoch ? kl.s >= seil.kanteLaenge : kl.s <= 0;
    kl.s = THREE.MathUtils.clamp(kl.s, 0, seil.kanteLaenge);
    this.kletterPunkt(seil, kl.s, sp.figur.position);
    sp.figur.rotation.y = this.drehZu(sp.figur.rotation.y, Math.atan2(seil.richtung.x, seil.richtung.z), dt);
    this.kletterPose(kl.takt);
    if (fertig) {
      this.zustand = 'hochziehen';
      this.zeit = 0;
      this.zug = { von: sp.figur.position.clone(), nach: hoch ? new THREE.Vector3(seil.oben.x, seil.oben.y, seil.oben.z) : new THREE.Vector3(seil.unten.x, seil.unten.y, seil.unten.z) };
    }
  }

  // Die Kletter-Haltung mit den Knochen der Figur
  kletterPose(p) {
    const k = this.spieler.k;
    const s = Math.sin(p);
    // Arme hoch zum Seil – abwechselnd greifen
    k.schulterL.rotation.set(-2.75 + s * 0.35, 0, -0.18);
    k.ellbogenL.rotation.x = -0.25 - Math.max(0, -s) * 0.7;
    k.schulterR.rotation.set(-2.75 - s * 0.35, 0, 0.18);
    k.ellbogenR.rotation.x = -0.25 - Math.max(0, s) * 0.7;
    // Beine stemmen sich gegen die Wand – auch abwechselnd
    k.beinL.rotation.set(-0.75 + s * 0.35, 0, -0.08);
    k.knieL.rotation.x = 1.0 - s * 0.35;
    k.fussL.rotation.x = -0.25;
    k.beinR.rotation.set(-0.75 - s * 0.35, 0, 0.08);
    k.knieR.rotation.x = 1.0 + s * 0.35;
    k.fussR.rotation.x = -0.25;
    // Körper lehnt sich ein bisschen zurück, Kopf schaut nach oben
    k.huefte.position.y = 0.13 + BEIN_LAENGE * 2 - 0.02;
    k.huefte.rotation.set(-0.12, s * 0.05, 0);
    k.bauch.rotation.set(0.05, 0, 0);
    k.brust.rotation.set(0.05, -s * 0.08, 0);
    k.hals.rotation.set(-0.1, 0, 0);
    k.kopf.rotation.set(-0.3, 0, 0);
    // Die Hände brauchen wir zum Klettern – Kanone, Schaufel & Co. sind kurz im Rucksack
    this.handModell.visible = false;
  }

  // Oben über die Kante ziehen (oder unten absteigen)
  zieheHoch(dt) {
    const sp = this.spieler, z = this.zug;
    const t = Math.min(1, this.zeit / 0.6);
    const g = glatt(t);
    sp.figur.position.lerpVectors(z.von, z.nach, g);
    sp.figur.position.y = THREE.MathUtils.lerp(z.von.y, z.nach.y, Math.min(1, g * 1.4)) + Math.sin(t * Math.PI) * 0.25;
    if (t < 1) this.kletterPose(this.kletter.takt + t * 3);
    else {
      sp.figur.position.copy(z.nach);
      sp.figur.position.y = bodenHoehe(z.nach.x, z.nach.z);
      sp.geschwindigkeitY = 0;
      sp.amBoden = true;
      sp.luft = 0;
      sp.animiere(dt, 0);
      const hoch = this.kletter.richtung === 'hoch';
      this.zustand = null;
      this.kletter = null;
      this.spiel.meldung(hoch ? '🎉 Geschafft! Du bist oben. Das Seil bleibt hängen.' : '👣 Unten angekommen!', 4);
      if (hoch) this.spiel.musik.pling?.();
    }
  }

  // ---------- Geräusche (selbst gebaut mit Web Audio) ----------
  // Ein kleiner Ton: Frequenz f → fEnde, so lang, so laut
  klang(f, fEnde, dauer, laut, typ = 'sine', verzoegerung = 0) {
    const musik = this.spiel.musik;
    const ctx = musik?.ctx;
    if (!ctx) return;
    const t = ctx.currentTime + verzoegerung;
    const osz = ctx.createOscillator();
    osz.type = typ;
    osz.frequency.setValueAtTime(f, t);
    osz.frequency.exponentialRampToValueAtTime(fEnde, t + dauer);
    const huelle = ctx.createGain();
    huelle.gain.setValueAtTime(0.0001, t);
    huelle.gain.exponentialRampToValueAtTime(laut, t + 0.006);
    huelle.gain.exponentialRampToValueAtTime(0.0001, t + dauer);
    osz.connect(huelle).connect(musik.effekte || ctx.destination);
    osz.start(t);
    osz.stop(t + dauer + 0.05);
  }

  // Zischen (Rauschen durch einen Filter)
  zischen(dauer, laut, von, bis, verzoegerung = 0) {
    const musik = this.spiel.musik;
    const ctx = musik?.ctx;
    if (!ctx) return;
    if (!this.rauschPuffer) {
      this.rauschPuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = this.rauschPuffer.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const t = ctx.currentTime + verzoegerung;
    const quelle = ctx.createBufferSource();
    quelle.buffer = this.rauschPuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 1.2;
    filter.frequency.setValueAtTime(von, t);
    filter.frequency.exponentialRampToValueAtTime(bis, t + dauer);
    const huelle = ctx.createGain();
    huelle.gain.setValueAtTime(0.0001, t);
    huelle.gain.exponentialRampToValueAtTime(laut, t + 0.02);
    huelle.gain.exponentialRampToValueAtTime(0.0001, t + dauer);
    quelle.connect(filter).connect(huelle).connect(musik.effekte || ctx.destination);
    quelle.start(t);
    quelle.stop(t + dauer + 0.05);
  }

  // PLOPP! und das Seil zischt hinterher
  klangSchuss() {
    const L = E().lautstaerke;
    this.klang(220, 55, 0.22, 0.6 * L);
    this.klang(900, 300, 0.06, 0.15 * L, 'triangle');
    this.zischen(0.55, 0.25 * L, 2500, 700, 0.03);
  }

  // KLONK – Metall an Stein
  klangEinhaken() {
    const L = E().lautstaerke;
    this.klang(1250, 1180, 0.35, 0.18 * L);
    this.klang(3100, 2950, 0.2, 0.08 * L);
    this.klang(160, 90, 0.12, 0.35 * L, 'triangle');
  }

  // Leises Knarzen beim Greifen
  klangGriff() {
    const L = E().lautstaerke;
    this.klang(340 + Math.random() * 60, 260, 0.07, 0.06 * L, 'triangle');
  }

  // ---------- Speichern & Laden ----------
  alsDaten() {
    const r2 = (v) => Math.round(v * 100) / 100;
    const xz = (p) => [r2(p.x), r2(p.z)];
    return {
      seile: this.seile.filter((s) => s !== this.schuss?.seil).map((s) => ({
        fuss: xz(s.fuss), kante: xz(s.kante), oben: xz(s.oben), unten: xz(s.unten), r: [r2(s.richtung.x), r2(s.richtung.z)],
      })),
    };
  }

  ladeDaten(d) {
    for (const s of [...this.seile]) this.entferneSeil(s);
    const punkt = ([x, z]) => ({ x, z, y: bodenHoehe(x, z) });
    for (const s of (d && d.seile) || []) {
      if (!this.plaetzeFrei.length) break;
      const l = Math.hypot(s.r[0], s.r[1]) || 1;
      const seil = this.baueSeil({
        fuss: punkt(s.fuss), kante: punkt(s.kante), oben: punkt(s.oben), unten: punkt(s.unten), richtung: { x: s.r[0] / l, z: s.r[1] / l },
      });
      seil.sichtbar = 1;
      this.zeigeFertigesSeil(seil);
    }
  }
}

// Punkte auf einer Linie so verteilen, dass alle Stücke gleich lang sind
function gleichmaessig(roh, anzahl) {
  const laengen = [0];
  for (let i = 1; i < roh.length; i++) laengen.push(laengen[i - 1] + roh[i].distanceTo(roh[i - 1]));
  const gesamt = laengen[laengen.length - 1];
  const neu = [];
  let k = 1;
  for (let i = 0; i < anzahl; i++) {
    const s = (i / (anzahl - 1)) * gesamt;
    while (k < roh.length - 1 && laengen[k] < s) k++;
    const t = THREE.MathUtils.clamp((s - laengen[k - 1]) / Math.max(1e-6, laengen[k] - laengen[k - 1]), 0, 1);
    neu.push(new THREE.Vector3().lerpVectors(roh[k - 1], roh[k], t));
  }
  return neu;
}
