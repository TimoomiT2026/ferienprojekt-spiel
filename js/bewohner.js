// =============================================================
//  DIE INSELBEWOHNER auf der Palmeninsel 🌴 und die wertvollen Münzen 🏅
//
//  Idee vom Game Designer:
//  - Auf der Palmeninsel leben 13 Menschen, weit verstreut.
//  - Man spricht sie an. Nur EINER hat die Taucherbrille 🤿.
//    Die anderen sagen: „Ich habe sie nicht. Versuch es bei einem anderen Inselbewohner!“
//  - Der Richtige leiht sie dir – aber nur für 3 wertvolle Münzen,
//    eine von jeder Insel. Erst AB DIESEM SATZ gibt es die 3 goldenen
//    Grabehügel mit den Münzen (vorher wäre eine Münze ja ohne Sinn).
//  - Mit 3 Münzen bekommt man die Taucherbrille → ab ins Insadorium!
//
//  Zahlen zum Rumprobieren: einstellungen.js → "bewohner" und "schatzHuegel"
// =============================================================
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { EINSTELLUNGEN } from './einstellungen.js';
import { INSELN, bodenHoehe, wasserHoeheBei, istKlippenWand } from './gelaende.js';
import { baueFigur } from './figur.js';
import { SCHAUFEL_BILD } from './rucksack.js';
import { knopf } from './steuerung.js';
import { zufallMitSeed } from './rauschen.js';
import { grabeHuegelTeile, huegelLage } from './grabehuegel.js';

const GRAD = Math.PI / 180;
const MUENZE = 'wertvolleMuenze';

// Das sagen ALLE, die die Taucherbrille nicht haben (Wunsch vom Game Designer)
const ABSAGE = 'Ich habe die Taucherbrille nicht. Versuch es bei einem anderen Inselbewohner!';

// ---------- Die 13 Bewohner (Namen vom Game Designer) ----------
// farben: wie beim Händler (shirt, hose, haare, haut, hut, bart)
// extra:  was sie noch auf dem Kopf haben (Zöpfe, Dutt, Blumen …)
// kind:   ein Kind ist kleiner
// hallo:  wie sie dich begrüßen (ihre Eigenheit)
// nochmal: was sie sagen, wenn du sie zum zweiten Mal ansprichst
const MENSCHEN = [
  {
    id: 'ferdinand', name: 'Ferdinand', gesicht: '🧒', kind: true,
    farben: { shirt: '#ff8a65', hose: '#4f6fcf', haare: '#3b2416', haut: '#c98b62', bart: false }, extra: 'muetze', extraFarbe: '#2e86de',
    hallo: 'Hallo! Ich bin Ferdinand und sammle die schönsten Muscheln der ganzen Insel. 🐚',
    nochmal: 'Schau mal, eine neue Muschel! Die Taucherbrille hab ich aber immer noch nicht.',
  },
  {
    id: 'anton', name: 'Anton', gesicht: '🧒', kind: true,
    farben: { shirt: '#ffd23f', hose: '#2e8b57', haare: '#c8742c', haut: '#f1c7a3', bart: false }, extra: 'muetze', extraFarbe: '#e0412f',
    hallo: 'Hi! Ich bin Anton. Ich kann schon 100 Mal hintereinander hüpfen! Hüpf, hüpf!',
    nochmal: 'Hüpf, hüpf! Hast du sie schon gefunden?',
  },
  {
    id: 'elea', name: 'Elea', gesicht: '🧒', kind: true,
    farben: { shirt: '#c77dff', hose: '#5a3f8c', haare: '#e3b04b', haut: '#f3cfb3', bart: false }, extra: 'blumen',
    hallo: 'Oh, hallo! Ich bin Elea. Riechst du die Blumen? Den Kranz hab ich selbst geflochten. 🌺',
    nochmal: 'Hallo nochmal! Möchtest du auch einen Blumenkranz?',
  },
  {
    id: 'joshi', name: 'Joshi', gesicht: '🧒', kind: true,
    farben: { shirt: '#e76f51', hose: '#3d405b', haare: '#2a1a10', haut: '#8d5a3b', hut: '#8a6a3a', bart: false },
    hallo: 'Hey! Ich bin Joshi. Ich mache die besten Kokos-Pfannkuchen der Welt! 🥞',
    nochmal: 'Die Pfannkuchen sind gleich fertig! Aber eine Taucherbrille hab ich nicht.',
  },
  {
    id: 'max', name: 'Max', gesicht: '🧒', kind: true,
    farben: { shirt: '#90be6d', hose: '#6b4f2c', haare: '#4a2c17', haut: '#b97a52', bart: false }, extra: 'stirnband', extraFarbe: '#ff3d6e',
    hallo: 'Hallo! Ich bin Max. Ich klettere auf JEDE Palme – sogar auf die ganz krummen! 🌴',
    nochmal: 'Ich war gerade wieder ganz oben! Von da sieht man die Klippeninsel.',
  },
  {
    id: 'mina', name: 'Mina', gesicht: '🧒', kind: true,
    farben: { shirt: '#2a9d8f', hose: '#264653', haare: '#1d120c', haut: '#6b4429', bart: false }, extra: 'dutt',
    hallo: 'Psst, ich bin Mina. Nachts zähle ich die Sterne. Gestern waren es 4.217! ⭐',
    nochmal: '4.218 … 4.219 … oh, hallo! Wo war ich stehengeblieben?',
  },
  {
    id: 'vincent', name: 'Vincent', gesicht: '🧒', kind: true,
    farben: { shirt: '#6fb7d9', hose: '#e8dcc0', haare: '#e3c77a', haut: '#e8b894', hut: '#e6c66a', bart: false },
    hallo: 'Moin! Ich bin Vincent. Ich baue die höchsten Sandburgen der Insel. 🏰',
    nochmal: 'Meine Sandburg hat jetzt schon drei Türme!',
  },
  {
    id: 'johann', name: 'Johann', gesicht: '🧒', kind: true,
    farben: { shirt: '#ff70a6', hose: '#70d6ff', haare: '#f5d76e', haut: '#f6d2b8', bart: false }, extra: 'muetze', extraFarbe: '#ffd23f',
    hallo: 'Hallo! Ich bin Johann. Hast du schon die bunten Fische im Meer gesehen? Die sind sooo schön! 🐠',
    nochmal: 'Ich hab gerade einen lila Fisch gesehen!',
  },
  {
    id: 'etienne', name: 'Etienne', gesicht: '🧒', kind: true,
    farben: { shirt: '#f4a261', hose: '#5c677d', haare: '#5a3a22', haut: '#eec3a3', bart: false }, extra: 'muetze', extraFarbe: '#3a86ff',
    hallo: 'Salut! Ich bin Etienne. Ich lasse jeden Tag meinen Drachen steigen. 🪁',
    nochmal: 'Heute ist richtig guter Drachen-Wind!',
  },
  {
    id: 'emil', name: 'Emil', gesicht: '🧒', kind: true,
    farben: { shirt: '#00b4d8', hose: '#023e8a', haare: '#2b1a12', haut: '#a8704a', bart: false }, extra: 'lang',
    hallo: 'Hallo! Ich bin Emil. Ich kenne jeden Krebs am Strand mit Namen! 🦀',
    nochmal: 'Das da ist Kalle, der Krebs. Sag hallo!',
  },
  {
    id: 'finn', name: 'Finn', gesicht: '🧒', kind: true,
    farben: { shirt: '#ffbe0b', hose: '#3a5a40', haare: '#8b5a2b', haut: '#d9a77c', bart: false }, extra: 'stirnband', extraFarbe: '#00b4d8',
    hallo: 'Yo! Ich bin Finn. Ich bin der schnellste Surfer der ganzen Inselgruppe! 🏄',
    nochmal: 'Die Wellen sind heute super! Aber eine Taucherbrille hab ich nicht.',
  },
  {
    id: 'mucko', name: 'Mucko', gesicht: '🧒', kind: true,
    farben: { shirt: '#8338ec', hose: '#2b2d42', haare: '#1d120c', haut: '#c98b62', hut: '#e63946', bart: false },
    hallo: 'Hey, ich bin Mucko! Ich kann mit drei Kokosnüssen jonglieren. Guck mal! 🥥🥥🥥',
    nochmal: 'Ups, eine ist runtergefallen! Nochmal von vorn …',
  },
  {
    id: 'sichel', name: 'Sichel', gesicht: '🧒', kind: true,
    farben: { shirt: '#06d6a0', hose: '#7b2cbf', haare: '#d4a373', haut: '#f3cfb3', bart: false }, extra: 'zoepfe',
    hallo: 'Hallo, ich bin Sichel! Ich male Bilder von allen Tieren der Insel. 🎨',
    nochmal: 'Gerade male ich eine Möwe. Die hält aber nie still!',
  },
];

// Kleiner Helfer (wie in figur.js): eine Form einfärben und an ihren Platz schieben
function teil(geo, farbe, pos = [0, 0, 0], skala = [1, 1, 1], dreh = [0, 0, 0]) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  g.deleteAttribute('uv');
  g.applyMatrix4(new THREE.Matrix4().compose(
    new THREE.Vector3(...pos),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...dreh)),
    new THREE.Vector3(...skala)
  ));
  const c = new THREE.Color(farbe);
  const f = new Float32Array(g.attributes.position.count * 3);
  for (let i = 0; i < f.length; i += 3) f.set([c.r, c.g, c.b], i);
  g.setAttribute('color', new THREE.BufferAttribute(f, 3));
  return g;
}

// Was die Bewohner zusätzlich auf dem Kopf haben – alles rund!
function baueExtra(m) {
  const h = m.farben.haare;
  const teile = [];
  const kugel = new THREE.SphereGeometry(1, 14, 10);
  if (m.extra === 'zoepfe') {
    for (const s of [-1, 1]) {
      teile.push(teil(kugel, h, [s * 0.36, 1.92, -0.08], [0.13, 0.13, 0.13]));
      teile.push(teil(new THREE.CapsuleGeometry(0.08, 0.22, 4, 8), h, [s * 0.4, 1.72, -0.08]));
      teile.push(teil(kugel, '#ff4f8b', [s * 0.38, 1.86, -0.08], [0.06, 0.06, 0.06])); // Haargummi
    }
  } else if (m.extra === 'dutt') {
    teile.push(teil(kugel, h, [0, 2.32, -0.12], [0.19, 0.17, 0.19]));
  } else if (m.extra === 'lang') {
    teile.push(teil(new THREE.CapsuleGeometry(0.26, 0.42, 6, 12), h, [0, 1.75, -0.18], [1.15, 1, 0.55]));
  } else if (m.extra === 'blumen') {
    teile.push(teil(new THREE.CapsuleGeometry(0.24, 0.3, 6, 12), h, [0, 1.8, -0.18], [1.1, 1, 0.5]));
    const farben = ['#ff5d8f', '#ffd166', '#ffffff', '#ff8fab', '#ffbe0b'];
    for (let k = 0; k < 9; k++) {
      const w = (k / 9) * Math.PI * 2;
      teile.push(teil(kugel, farben[k % farben.length], [Math.sin(w) * 0.31, 2.2, Math.cos(w) * 0.29], [0.075, 0.06, 0.075]));
    }
  } else if (m.extra === 'muetze') {
    const f = m.extraFarbe || '#e0412f';
    teile.push(teil(new THREE.SphereGeometry(0.37, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), f, [0, 2.06, -0.02], [1, 0.95, 1]));
    teile.push(teil(new THREE.TorusGeometry(0.35, 0.05, 8, 20), '#ffffff', [0, 2.07, -0.02], [1, 1, 1], [Math.PI / 2, 0, 0]));
    teile.push(teil(kugel, '#ffffff', [0, 2.43, -0.02], [0.09, 0.09, 0.09])); // Bommel
  } else if (m.extra === 'stirnband') {
    teile.push(teil(new THREE.TorusGeometry(0.34, 0.045, 8, 22), m.extraFarbe || '#ff3d6e', [0, 2.12, 0], [1, 1, 1], [Math.PI / 2 - 0.15, 0, 0]));
  }
  if (!teile.length) return null;
  const mesh = new THREE.Mesh(mergeGeometries(teile), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }));
  mesh.castShadow = true;
  return mesh;
}

// Kürzester Winkel-Abstand (−π … +π)
const winkelAbstand = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

// Sucht neben (x0, z0) einen Platz, an dem passt(x, z) stimmt – immer gleich (reproduzierbar)
function sucheFreienPlatz(x0, z0, passt, maxR = 18) {
  if (passt(x0, z0)) return [x0, z0];
  for (let r = 1.5; r <= maxR; r += 1.5) {
    for (let k = 0; k < 12; k++) {
      const w = (k / 12) * Math.PI * 2 + r;
      const x = x0 + Math.cos(w) * r, z = z0 + Math.sin(w) * r;
      if (passt(x, z)) return [x, z];
    }
  }
  return [x0, z0]; // nichts gefunden – dann eben genau hier
}

// Ist es hier flach genug? (nicht am Hang, nicht an der Klippe)
function flachGenug(x, z, wieFlach = 0.8) {
  const h = bodenHoehe(x, z);
  return Math.abs(bodenHoehe(x + 1, z) - h) < wieFlach && Math.abs(bodenHoehe(x - 1, z) - h) < wieFlach &&
    Math.abs(bodenHoehe(x, z + 1) - h) < wieFlach && Math.abs(bodenHoehe(x, z - 1) - h) < wieFlach;
}

export class Bewohner {
  // spiel = { rucksack, meldung, musik, spieler, hindernisse, elternElement, karte? }
  constructor(szene, spiel) {
    this.spiel = spiel;
    this.E = EINSTELLUNGEN.bewohner || {};
    this.interaktionen = [];
    this.leute = [];
    this.getroffen = new Set(); // ids der Bewohner, die man schon angesprochen hat
    this.trigger = false; // hat der Taucherbrillen-Mensch von den Münzen erzählt?
    this.abgegeben = false; // hat man die 3 Münzen schon abgegeben?
    this.offen = false; // ist gerade eine Sprechblase offen? (dann pausiert das Spiel)
    this.beschaeftigt = false; // gräbt man gerade?
    this.zeit = 0;
    this.sperreBis = 0;
    // Hooks für das Aufgabenbuch / Tutorial (main.js kann sie setzen)
    this.beimTrigger = () => {};
    this.beiMuenze = () => {};
    this.beiBrille = () => {};

    this.baueLeute(szene);
    this.baueHuegel(szene);
    this.baueBlase(spiel.elternElement || document.body);
    this.zeigeHuegel();
  }

  // ---------- Die 13 Menschen auf die Palmeninsel stellen ----------
  baueLeute(szene) {
    const P = INSELN.find((I) => I.name === 'Palmeninsel');
    if (!P) return; // keine Palmeninsel? Dann keine Bewohner
    const { hindernisse } = this.spiel;
    const zufall = zufallMitSeed(2024);
    const plaetze = this.E.plaetze || [];
    const schonDa = [];
    const passt = (x, z) => {
      const h = bodenHoehe(x, z);
      if (h < wasserHoeheBei(x, z) + 1.4) return false; // nicht im Wasser
      if (hindernisse && hindernisse.trifft(x, z, 1.8)) return false; // nicht in Palmen, Bäumen, Felsen, Häusern
      if (!flachGenug(x, z)) return false;
      if (P.dorfPlatz && Math.hypot(x - P.dorfPlatz.x, z - P.dorfPlatz.z) < P.dorfPlatz.radius + 3) return false; // nicht mitten im Dorf
      if ((P.anlegestellen || []).some((a) => Math.hypot(x - a.strandX, z - a.strandZ) < 8)) return false; // nicht da, wo die Boote anlegen
      return !schonDa.some(([sx, sz]) => Math.hypot(x - sx, z - sz) < 15);
    };

    MENSCHEN.forEach((m, i) => {
      const [richtung, abstand] = plaetze[i] || [i * 36, 50];
      const [x, z] = sucheFreienPlatz(P.x + Math.cos(richtung * GRAD) * abstand, P.z + Math.sin(richtung * GRAD) * abstand, passt);
      schonDa.push([x, z]);
      const y = bodenHoehe(x, z);

      const teile = baueFigur(m.farben);
      const extra = baueExtra(m);
      if (extra) teile.figur.add(extra);
      if (m.kind) teile.figur.scale.setScalar(0.72);
      // Schaut ungefähr zur Inselmitte (aufs Meer schauen ist auch schön – ein bisschen Zufall)
      const grundWinkel = Math.atan2(P.x - x, P.z - z) + (zufall() - 0.5) * 2;
      teile.figur.position.set(x, y, z);
      teile.figur.rotation.y = grundWinkel;
      teile.figur.visible = false;
      szene.add(teile.figur);
      if (hindernisse) hindernisse.hinzufuegen(x, z, 0.45); // durch Menschen läuft man nicht durch

      const mensch = {
        ...m, nummer: i,
        figur: teile.figur, armL: teile.armL, armR: teile.armR,
        pos: new THREE.Vector3(x, y, z), boden: y,
        grundWinkel, winkel: grundWinkel, phase: zufall() * 10,
        winkt: 0, // 0 … 1: wie weit der Arm zum Winken oben ist
      };
      this.leute.push(mensch);
      this.interaktionen.push({
        pos: mensch.pos,
        radius: this.E.ansprechRadius ?? 3.2,
        bild: '💬',
        text: 'Ansprechen',
        aktiv: () => !this.offen,
        ausfuehren: () => this.ansprechen(mensch),
      });
    });
    // Wer die Taucherbrille hat, entscheidet der Zufall – erst beim Ansprechen (siehe ansprechen)
    this.brilleId = null;
    this.brilleAb = this.wuerfleBrilleAb();
  }

  // ---------- Die 3 goldenen Grabehügel ----------
  baueHuegel(szene) {
    const { hindernisse } = this.spiel;
    const zufall = zufallMitSeed(777);
    this.huegel = [];
    const goldMat = new THREE.MeshStandardMaterial({ color: '#ffcc33', emissive: '#ffae00', emissiveIntensity: 0.9, metalness: 0.7, roughness: 0.3 });
    const glitzerMat = new THREE.MeshStandardMaterial({ color: '#fff7c2', emissive: '#ffd84a', emissiveIntensity: 4 });
    // Ein goldener Schimmer, der nach oben leuchtet – damit man den Hügel von weitem sieht
    const strahlMat = new THREE.MeshBasicMaterial({
      color: '#ffd24a', vertexColors: true, transparent: true, opacity: 0.3, depthWrite: false,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    const strahlGeo = new THREE.CylinderGeometry(0.6, 1.3, 15, 20, 1, true); // so hoch, dass er über die Bäume schaut
    strahlGeo.translate(0, 7.5, 0);
    // Unten hell, nach oben immer schwächer (schwarz = unsichtbar beim Leuchten)
    const sp = strahlGeo.attributes.position, sf = new Float32Array(sp.count * 3);
    for (let k = 0; k < sp.count; k++) sf.fill(Math.pow(1 - sp.getY(k) / 15, 1.5), k * 3, k * 3 + 3);
    strahlGeo.setAttribute('color', new THREE.BufferAttribute(sf, 3));
    const muenzGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.07, 28);
    muenzGeo.rotateX(Math.PI / 2);
    const glitzerGeo = new THREE.SphereGeometry(0.08, 8, 6);

    (EINSTELLUNGEN.schatzHuegel || []).forEach((e, i) => {
      const I = INSELN.find((ins) => ins.name === e.insel);
      if (!I) return;
      let x0 = e.x, z0 = e.z;
      if (x0 === undefined) {
        x0 = I.x + Math.cos((e.richtung || 0) * GRAD) * (e.abstand || 0);
        z0 = I.z + Math.sin((e.richtung || 0) * GRAD) * (e.abstand || 0);
      }
      const passt = (x, z) => {
        const h = bodenHoehe(x, z);
        if (h < wasserHoeheBei(x, z) + 0.8 || istKlippenWand(x, z)) return false;
        if (I.klippen && h < (I.plateauHoehe ?? 21) - 3) return false; // oben auf dem Plateau bleiben!
        if (hindernisse && hindernisse.trifft(x, z, 1.6)) return false;
        return flachGenug(x, z, 1.2);
      };
      const [x, z] = sucheFreienPlatz(x0, z0, passt);
      const y = bodenHoehe(x, z);

      const gruppe = new THREE.Group();
      // Der Erdhaufen sieht aus wie die anderen Grabehügel auf der Insel (grabehuegel.js)
      const form = grabeHuegelTeile(e.insel).huegel;
      const erde = new THREE.Mesh(form.geometrie, form.material);
      erde.scale.set(1.15, 1.0, 1.15);
      const lage = huegelLage(x, z, i * 2.3); // so schräg wie der Boden
      erde.quaternion.copy(lage.drehung);
      erde.position.y = lage.ort.y - y;
      erde.receiveShadow = true;
      const muenze = new THREE.Mesh(muenzGeo, goldMat); // guckt ein bisschen aus der Erde raus
      muenze.position.set(0.15, 0.55, 0);
      const strahl = new THREE.Mesh(strahlGeo, strahlMat);
      const glitzer = new THREE.InstancedMesh(glitzerGeo, glitzerMat, 8);
      glitzer.frustumCulled = false;
      gruppe.add(erde, muenze, strahl, glitzer);
      gruppe.position.set(x, y, z);
      gruppe.visible = false;
      szene.add(gruppe);

      const h = {
        nummer: i, insel: e.insel, pos: new THREE.Vector3(x, y, z), gefunden: false,
        gruppe, muenze, strahl, glitzer,
        // Fürs "❓" auf der Karte: absichtlich nicht ganz genau
        karteX: x + (zufall() - 0.5) * 2 * (EINSTELLUNGEN.schatzKarteUngenau ?? 18),
        karteZ: z + (zufall() - 0.5) * 2 * (EINSTELLUNGEN.schatzKarteUngenau ?? 18),
      };
      this.huegel.push(h);
      this.interaktionen.push({
        pos: h.pos,
        radius: 2.6,
        bild: SCHAUFEL_BILD,
        text: 'Graben',
        // Nur nach dem Satz vom Taucherbrillen-Menschen – und nur, wenn man auf gleicher Höhe ist
        // (unten am Fuß der Klippe soll der Knopf nicht kommen)
        aktiv: () => this.trigger && !h.gefunden && !this.beschaeftigt &&
          Math.abs(this.spiel.spieler.figur.position.y - h.pos.y) < 4,
        ausfuehren: () => this.graben(h),
      });
    });
  }

  // Hügel zeigen oder verstecken (und das "❓" auf der Karte)
  zeigeHuegel() {
    for (const h of this.huegel) {
      const da = this.trigger && !h.gefunden;
      if (!da) h.gruppe.visible = false;
      if (this.spiel.karte && EINSTELLUNGEN.schatzAufKarte !== false) {
        this.spiel.karte.punkt(`schatz${h.nummer}`, { name: 'Münze irgendwo hier?', bild: '❓', x: h.karteX, z: h.karteZ, sichtbar: da });
      }
    }
  }

  // ---------- Die Sprechblase ----------
  baueBlase(eltern) {
    this.blase = document.createElement('div');
    this.blase.id = 'bewohner-blase';
    this.blase.setAttribute('role', 'dialog');
    this.blase.innerHTML = `
      <div class="bw-kopf"><span class="bw-gesicht"></span><span class="bw-name"></span></div>
      <p class="bw-text"></p>
      <div class="bw-fuss"><span class="bw-zaehler"></span><button class="bw-ok">OK 👍</button></div>`;
    eltern.appendChild(this.blase);
    this.gesichtFeld = this.blase.querySelector('.bw-gesicht');
    this.nameFeld = this.blase.querySelector('.bw-name');
    this.textFeld = this.blase.querySelector('.bw-text');
    this.zaehlerFeld = this.blase.querySelector('.bw-zaehler');
    // Antippen (irgendwo auf der Blase) = schließen. knopf() stoppt das Weiterreichen an den Joystick.
    knopf(this.blase, () => this.schliessen());
    this.blase.addEventListener('touchmove', (e) => e.stopPropagation());
    this.blase.addEventListener('touchend', (e) => e.stopPropagation());
    // Am Mac: Enter, Leertaste, E oder Esc schließt die Blase
    window.addEventListener('keydown', (e) => {
      if (this.offen && ['Enter', 'Escape', ' ', 'e', 'E'].includes(e.key)) this.schliessen();
    });
  }

  zeigeBlase(mensch, text, danach = null) {
    this.offen = true;
    this.redner = mensch;
    this.danach = danach;
    this.gesichtFeld.textContent = mensch.gesicht;
    this.nameFeld.textContent = mensch.name;
    this.textFeld.innerHTML = text;
    const n = this.getroffen.size, alle = this.leute.length;
    this.zaehlerFeld.textContent = n >= alle ? `Alle ${alle} Bewohner getroffen! 🎉` : `Bewohner getroffen: ${n} / ${alle}`;
    this.blase.classList.remove('sichtbar');
    void this.blase.offsetWidth; // Trick: Animation neu starten
    this.blase.classList.add('sichtbar');
  }

  schliessen() {
    if (!this.offen) return;
    this.offen = false;
    this.sperreBis = performance.now() + 400; // nicht sofort wieder aufgehen
    this.blase.classList.remove('sichtbar');
    const danach = this.danach;
    this.danach = null;
    if (danach) danach();
  }

  // ---------- Ansprechen ----------
  // Der wievielte NEUE Bewohner hat die Taucherbrille? (Zufall, z. B. der 6. bis 13.)
  // Die ersten 5 haben sie nie – Entscheidung des Game Designers.
  wuerfleBrilleAb() {
    const frueh = this.E.brilleFruehestens ?? 6;
    const spaet = Math.min(this.E.brilleSpaetestens ?? 13, this.leute.length || 13);
    return frueh + Math.floor(Math.random() * (spaet - frueh + 1));
  }

  // Die Person mit der Taucherbrille (oder null, solange es noch niemand ist)
  get brilleMensch() {
    return this.leute.find((l) => l.id === this.brilleId) || null;
  }

  ansprechen(mensch) {
    if (this.offen || performance.now() < this.sperreBis) return;
    const ersterBesuch = !this.getroffen.has(mensch.id);
    this.getroffen.add(mensch.id);
    // Ist das der x-te neue Bewohner? Dann hat GENAU DIESER die Taucherbrille.
    if (!this.brilleId && ersterBesuch && this.getroffen.size >= this.brilleAb) this.brilleId = mensch.id;
    mensch.hatBrille = mensch.id === this.brilleId;
    // Die Person dreht sich gleich zu dir
    const p = this.spiel.spieler.figur.position;
    mensch.winkel = Math.atan2(p.x - mensch.pos.x, p.z - mensch.pos.z);
    this.spiel.musik?.pling?.();
    if (mensch.hatBrille) this.sprichMitBrillenMensch(mensch, ersterBesuch);
    else this.zeigeBlase(mensch, ersterBesuch ? `${mensch.hallo} ${ABSAGE}` : `${mensch.nochmal} ${ABSAGE}`);
  }

  // Wie viele Münzen hat man dabei / schon gefunden?
  muenzenDabei() {
    return this.spiel.rucksack.anzahl(MUENZE);
  }

  muenzenGefunden() {
    return this.huegel.filter((h) => h.gefunden).length;
  }

  // Welche Inseln fehlen noch? (für den Tipp)
  fehlendeInseln() {
    return this.huegel.filter((h) => !h.gefunden).map((h) => (h.insel === 'Klippeninsel' ? 'Klippeninsel (ganz oben!)' : h.insel));
  }

  sprichMitBrillenMensch(mensch, ersterBesuch) {
    const { rucksack, meldung } = this.spiel;
    const noetig = this.E.muenzenNoetig ?? 3;
    const glitzern = 'Die Hügel glitzern golden ✨ – und du brauchst eine Schaufel.';

    // 1) Das erste Mal: DER Satz – ab jetzt gibt es die Münz-Hügel!
    if (!this.trigger) {
      this.trigger = true;
      this.zeigeHuegel();
      this.beimTrigger();
      const text = (ersterBesuch ? `${mensch.hallo} ` : '') +
        `<b>Ja, ich habe eine Taucherbrille! 🤿</b> Ich leihe sie dir – aber nur, wenn du mir ${noetig} wertvolle Münzen bringst. ` +
        `Eine von jeder Insel! Sie sind in Grabehügeln versteckt. ${glitzern}`;
      this.zeigeBlase(mensch, text, () => meldung(`🏅 Neue Aufgabe: Finde ${noetig} wertvolle Münzen – eine auf jeder Insel!`, 6));
      return;
    }

    // 2) Schon abgegeben: Brille noch da? Sonst gibt es eine neue (damit man nie festhängt)
    if (this.abgegeben) {
      if (!rucksack.hat('taucherbrille')) {
        if (!rucksack.hinein('taucherbrille')) {
          this.zeigeBlase(mensch, 'Hast du meine Taucherbrille verloren? Ich hab noch eine – aber dein Rucksack ist voll! 🎒 Mach Platz und komm wieder.');
          return;
        }
        this.zeigeBlase(mensch, 'Hast du meine Taucherbrille verloren? Macht nichts, ich hab noch eine. Hier! 🤿');
        return;
      }
      this.zeigeBlase(mensch, 'Viel Spaß beim Tauchen! 🤿 Denk an den geheimnisvollen See oben auf der Klippeninsel …');
      return;
    }

    const dabei = this.muenzenDabei();
    // 3) Genug Münzen: abgeben und die Taucherbrille bekommen
    if (dabei >= noetig) {
      rucksack.nehmen(MUENZE, noetig);
      if (!rucksack.hinein('taucherbrille')) {
        rucksack.hinein(MUENZE, noetig); // passt nicht – Münzen zurück
        this.zeigeBlase(mensch, `Wow, du hast alle ${noetig} Münzen! Aber dein Rucksack ist voll! 🎒 Mach Platz und komm dann wieder.`);
        return;
      }
      this.abgegeben = true;
      this.spiel.musik?.pling?.();
      this.zeigeBlase(mensch,
        `<b>Super! Hier ist meine Taucherbrille! 🤿</b> Oben auf der Klippeninsel gibt es einen geheimnisvollen See … ` +
        'Ich glaube, ganz unten auf dem Grund leuchtet etwas Rotes. Viel Glück!',
        () => meldung('🤿 Du hast die Taucherbrille! Geh an tiefes Wasser und tauche.', 6));
      this.beiBrille();
      return;
    }

    // 4) Noch nicht genug: Fortschritt zeigen
    const gefunden = this.muenzenGefunden();
    let text = `Du hast schon ${dabei} von ${noetig} Münzen.`;
    if (gefunden > dabei) text += ` Du hast ${gefunden} gefunden – hol die anderen aus deiner Truhe!`;
    const fehlt = this.fehlendeInseln();
    if (fehlt.length) text += ` Es fehlt noch: ${fehlt.join(', ')}. ${glitzern}`;
    this.zeigeBlase(mensch, text);
  }

  // ---------- Graben am goldenen Hügel ----------
  graben(h) {
    const { rucksack, meldung, musik, spieler } = this.spiel;
    if (rucksack.inDerHand !== 'schaufel') {
      meldung(rucksack.hat('schaufel')
        ? 'Nimm erst die Schaufel in die Hand: Rucksack 🎒 öffnen und die Schaufel antippen.'
        : 'Zum Graben brauchst du eine Schaufel! ✨', 5);
      return;
    }
    if (!rucksack.passt(MUENZE)) {
      meldung('Dein Rucksack ist voll! 🎒 Mach erst Platz für die wertvolle Münze.', 4);
      return;
    }
    this.beschaeftigt = true;
    const p = spieler.figur.position;
    spieler.figur.rotation.y = Math.atan2(h.pos.x - p.x, h.pos.z - p.z); // zum Hügel drehen
    spieler.graben();
    musik?.graben?.();
    setTimeout(() => {
      rucksack.hinein(MUENZE);
      h.gefunden = true;
      this.zeigeHuegel();
      musik?.pling?.();
      const n = this.muenzenGefunden();
      const noetig = this.E.muenzenNoetig ?? 3;
      meldung(n >= noetig
        ? `🏅 Eine wertvolle Münze! (${n} / ${noetig}) Bring sie zu ${this.brilleMensch?.name || 'dem Bewohner'} auf der Palmeninsel!`
        : `🏅 Eine wertvolle Münze! (${n} / ${noetig})`, 5);
      this.beschaeftigt = false;
      this.beiMuenze(n);
    }, 900);
  }

  // ---------- Jedes Bild ----------
  aktualisiere(dt, spielerPos) {
    this.zeit += dt;
    const t = this.zeit;
    const E = this.E;
    const sicht = E.sichtWeite ?? 130, animier = E.animierWeite ?? 50, schau = E.anschauWeite ?? 10;

    for (const m of this.leute) {
      const d = Math.hypot(m.pos.x - spielerPos.x, m.pos.z - spielerPos.z);
      m.figur.visible = d < sicht; // weit weg: gar nicht malen
      if (d > animier) continue; // nicht in der Nähe: nicht bewegen (spart Rechnen)
      const redet = this.offen && this.redner === m;
      // Zum Spieler schauen, wenn er nah ist – sonst gemütlich herumschauen
      let ziel = m.grundWinkel + Math.sin(t * 0.25 + m.phase) * 0.7;
      if (d < schau || redet) ziel = Math.atan2(spielerPos.x - m.pos.x, spielerPos.z - m.pos.z);
      m.winkel += winkelAbstand(ziel, m.winkel) * Math.min(1, dt * 4);
      m.figur.rotation.y = m.winkel;
      // Leichtes Wippen (beim Reden etwas mehr)
      m.figur.position.y = m.boden + Math.abs(Math.sin(t * (redet ? 6 : 1.6) + m.phase)) * (redet ? 0.06 : 0.03);
      // Wer dich noch nicht kennt, winkt dir zu, wenn du in der Nähe bist 👋
      const sollWinken = !this.getroffen.has(m.id) && d < 22 && d > 2.5 ? 1 : 0;
      m.winkt += (sollWinken - m.winkt) * Math.min(1, dt * 3);
      m.armR.rotation.z = 0.08 + m.winkt * (2.5 + Math.sin(t * 9 + m.phase) * 0.35);
      m.armR.rotation.x = Math.sin(t * 1.3 + m.phase) * 0.08 * (1 - m.winkt);
      m.armL.rotation.x = Math.sin(t * 1.3 + m.phase + 1.5) * 0.08;
    }

    // Goldene Hügel: von weitem den Schimmer sehen, nah glitzern
    const mat = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    for (const h of this.huegel) {
      const da = this.trigger && !h.gefunden;
      const d = Math.hypot(h.pos.x - spielerPos.x, h.pos.z - spielerPos.z);
      h.gruppe.visible = da && d < 400;
      if (!h.gruppe.visible || d > 150) continue;
      h.muenze.rotation.y = t * 1.5;
      h.muenze.position.y = 0.55 + Math.sin(t * 2.5) * 0.06;
      h.strahl.material.opacity = 0.26 + Math.sin(t * 2) * 0.08;
      for (let k = 0; k < 8; k++) {
        const funkeln = Math.max(0, Math.sin(t * 3.2 + k * 1.9));
        const w = k * 0.785 + t * 0.6;
        const r = 0.7 + (k % 3) * 0.25;
        p.set(Math.cos(w) * r, 0.45 + ((k * 0.37 + t * 0.4) % 1.6), Math.sin(w) * r);
        mat.compose(p, q, s.setScalar(funkeln * (k % 2 ? 1 : 1.5)));
        h.glitzer.setMatrixAt(k, mat);
      }
      h.glitzer.instanceMatrix.needsUpdate = true;
    }
  }

  // ---------- Speichern & Laden ----------
  alsDaten() {
    return {
      getroffen: [...this.getroffen],
      brilleId: this.brilleId,
      brilleAb: this.brilleAb,
      trigger: this.trigger,
      gefunden: this.huegel.map((h) => h.gefunden),
      abgegeben: this.abgegeben,
    };
  }

  // Alte Spielstände haben das alles noch nicht – dann bleibt alles wie am Anfang
  ladeDaten(d) {
    d = d || {};
    this.getroffen = new Set((d.getroffen || []).filter((id) => this.leute.some((l) => l.id === id)));
    this.trigger = !!d.trigger;
    this.abgegeben = !!d.abgegeben;
    this.brilleAb = d.brilleAb || this.wuerfleBrilleAb();
    this.brilleId = this.leute.some((l) => l.id === d.brilleId) ? d.brilleId : null;
    // Alte Spielstände: Dort hatte immer Emil die Brille
    if (!this.brilleId && (this.trigger || this.abgegeben)) this.brilleId = 'emil';
    this.leute.forEach((l) => (l.hatBrille = l.id === this.brilleId));
    (d.gefunden || []).forEach((g, i) => {
      if (this.huegel[i]) this.huegel[i].gefunden = !!g;
    });
    this.zeigeHuegel();
  }
}
