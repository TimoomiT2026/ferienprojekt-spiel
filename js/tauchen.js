// =============================================================
//  TAUCHEN – mit der Taucherbrille unter Wasser schwimmen
//  und das geheime INSADORIUM finden!
//
//  Das Insadorium (Idee vom Game Designer): ein roter Stein, der so
//  grell leuchtet, dass man fast nicht hineinschauen kann. Er liegt
//  unter Wasser – oben auf der Klippeninsel, im See auf dem Plateau.
//
//  So geht es:
//   1. Taucherbrille von einem Inselbewohner auf der Palmeninsel bekommen (bewohner.js; sie muss nur im Rucksack sein)
//   2. An tiefes Wasser gehen → Knopf „🤿 Tauchen“
//   3. Joystick = schwimmen, Sprungknopf festhalten = nach oben,
//      loslassen = langsam nach unten. Achtung, die Luft reicht nicht lange!
//   4. Nah am roten Leuchten: „💎 Aufheben“ → Ziel erreicht!
//
//  Trick für das iPad: Alles, was man unter Wasser sieht (blaues Wasser,
//  Bläschen), ist ganz billig: eine blaue Kugel um die Kamera, Nebel
//  und ein bisschen HTML mit Bläschen über dem Bild.
// =============================================================
import * as THREE from 'three';
import { EINSTELLUNGEN } from './einstellungen.js';
// "* as" heißt: alles aus gelaende.js. So können wir nachschauen,
// ob es dort eine Funktion schon gibt, ohne dass das Spiel abstürzt.
import * as GELAENDE from './gelaende.js';
import { wellenHoehe } from './wasser.js';

const { bodenHoehe, WASSER_HOEHE } = GELAENDE;
const mische = THREE.MathUtils.lerp;

// ---------- Kleine Zahlen (nur für die Technik) ----------
const STEIN_GROESSE = 0.42; // Radius des Steins (Meter)
const AUFHEB_RADIUS = 2.4; // so nah muss man ran (Meter)
const SUCH_RADIUS = 4.5; // so weit weg darf das tiefe Wasser sein (Meter)
const LICHT_WEITE = 40; // ab hier leuchtet das rote Licht (Meter)
const ZEIG_WEITE = 220; // weiter weg wird der Stein gar nicht gemalt

// ---------- Wie hoch steht das Wasser hier? ----------
// Meistens ist es das Meer (WASSER_HOEHE). Aber oben auf der Klippeninsel
// liegt die Lagune – ihr Wasser steht viel höher!
const LAGUNEN = (GELAENDE.INSELN || []).map((i) => i.lagune).filter(Boolean);
export function wasserHoeheBei(x, z) {
  if (GELAENDE.wasserHoeheBei) return GELAENDE.wasserHoeheBei(x, z); // falls gelaende.js es selbst weiß
  for (const L of LAGUNEN) {
    if (Math.hypot(x - L.x, z - L.z) < L.radius * 1.15) return L.wasserHoehe;
  }
  return WASSER_HOEHE;
}
// Wie tief ist das Wasser hier? (0 = trocken)
function tiefeBei(x, z) {
  return Math.max(0, wasserHoeheBei(x, z) - bodenHoehe(x, z));
}
// Ist hier das Meer (mit Wellen) oder ein See?
function istMeer(x, z) {
  return wasserHoeheBei(x, z) === WASSER_HOEHE;
}

// ---------- Bilder, die wir selbst malen (Leucht-Fleck) ----------
function leuchtBild() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const verlauf = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  verlauf.addColorStop(0, 'rgba(255,255,255,1)');
  verlauf.addColorStop(0.18, 'rgba(255,200,190,0.9)');
  verlauf.addColorStop(0.45, 'rgba(255,60,40,0.35)');
  verlauf.addColorStop(1, 'rgba(255,0,0,0)');
  g.fillStyle = verlauf;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Strahlen wie bei einem Stern – das macht das „Blenden“
function strahlenBild() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.translate(128, 128);
  for (let i = 0; i < 12; i++) {
    g.rotate(Math.PI / 6);
    const lang = i % 2 ? 80 : 125;
    const v = g.createLinearGradient(0, 0, lang, 0);
    v.addColorStop(0, 'rgba(255,220,210,0.9)');
    v.addColorStop(1, 'rgba(255,40,20,0)');
    g.fillStyle = v;
    g.beginPath();
    g.moveTo(0, -5);
    g.lineTo(lang, 0);
    g.lineTo(0, 5);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------- Aussehen der Anzeigen (HTML) ----------
const STIL = `
#tauch-blick { position: absolute; inset: 0; pointer-events: none; opacity: 0; transition: opacity 0.5s;
  background: radial-gradient(ellipse at 50% 35%, rgba(60,170,220,0.18), rgba(5,40,90,0.55) 85%);
  overflow: hidden; }
#tauch-blick.an { opacity: 1; }
#tauch-blick .blase { position: absolute; bottom: -40px; border-radius: 50%;
  border: 2px solid rgba(255,255,255,0.75); background: rgba(255,255,255,0.15);
  box-shadow: inset -3px -3px 0 rgba(255,255,255,0.35);
  animation: blase-hoch linear infinite; }
@keyframes blase-hoch {
  0% { transform: translate(0, 0); opacity: 0; }
  10% { opacity: 1; }
  50% { transform: translate(14px, -55vh); }
  100% { transform: translate(-6px, -115vh); opacity: 0.2; }
}
#luft-anzeige { position: absolute; left: 50%; bottom: max(30px, env(safe-area-inset-bottom)); transform: translateX(-50%);
  display: none; align-items: center; gap: 10px; padding: 8px 16px; border-radius: 22px;
  background: rgba(255,255,255,0.88); box-shadow: 0 5px 0 rgba(0,0,0,0.18);
  font: 800 20px system-ui, sans-serif; color: #1d5d8c; }
#luft-anzeige.an { display: flex; }
#luft-anzeige .balken { width: min(240px, 34vw); height: 18px; border-radius: 9px; background: #d5e6f2; overflow: hidden; }
#luft-anzeige .fuellung { height: 100%; width: 100%; border-radius: 9px; background: linear-gradient(#7fd8ff, #2a9fe0); transition: width 0.2s; }
#luft-anzeige.knapp { animation: luft-blinken 0.6s ease-in-out infinite alternate; color: #c0392b; }
#luft-anzeige.knapp .fuellung { background: linear-gradient(#ff9b8a, #e74c3c); }
@keyframes luft-blinken { from { transform: translateX(-50%) scale(1); } to { transform: translateX(-50%) scale(1.08); } }
.insadorium-bild { display: inline-block; filter: drop-shadow(0 0 4px #ff2a1a) drop-shadow(0 0 10px #ff5a3a) brightness(1.25);
  animation: insadorium-gluehen 1.2s ease-in-out infinite alternate; }
@keyframes insadorium-gluehen { from { filter: drop-shadow(0 0 3px #ff2a1a) drop-shadow(0 0 7px #ff5a3a) brightness(1.1); }
  to { filter: drop-shadow(0 0 7px #ff2a1a) drop-shadow(0 0 16px #ffb0a0) brightness(1.45); } }
`;
if (typeof document !== 'undefined' && !document.getElementById('tauchen-stil')) {
  const s = document.createElement('style');
  s.id = 'tauchen-stil';
  s.textContent = STIL;
  document.head.appendChild(s);
}

export class Tauchen {
  // spiel = { rucksack, meldung, musik, spieler, kamera, elternElement?, darf? }
  //   darf: Funktion – darf man gerade tauchen? (z. B. nicht im Boot oder auf dem Pferd)
  constructor(szene, spiel) {
    this.szene = szene;
    this.spiel = spiel;
    this.taucht = false; // ist man gerade unter Wasser? (auch beim Schwimmen ans Ufer)
    this.phase = null; // 'unten' = taucht, 'zumUfer' = schwimmt nach dem Auftauchen ans Ufer
    this.luft = EINSTELLUNGEN.tauchLuft;
    this.gewarnt = false;
    this.gefunden = false;
    this.beimGefunden = null; // wird aufgerufen, wenn man das Insadorium hat (→ Finale!)
    this.uhr = 0;
    this.pruefUhr = 0;
    this.tauchStelle = null; // wo man gerade abtauchen könnte (oder null)
    this.sicherePosition = new THREE.Vector3(); // wo man abgetaucht ist (zum Speichern)
    this.v = new THREE.Vector2(); // Schwimm-Geschwindigkeit (x, z)
    this.vy = 0;
    this.schwimmPhase = 0;
    this.blubbUhr = 0;
    this.ufer = null;
    this.nebelVorher = null;

    this.baueStein(szene);
    this.baueWasserKuppel(szene);
    this.baueBrille();
    this.baueAnzeigen();

    // Wo liegt das Insadorium? Am liebsten im See oben auf der Klippeninsel.
    const L = LAGUNEN[0];
    if (L) this.setzeInsadorium(L.x, L.z);
    else {
      const ort = this.sucheTestOrt();
      this.setzeInsadorium(ort.x, ort.z);
    }

    // ---------- Für den Aktions-Knopf ----------
    // „Tauchen“ erscheint, wenn man mit Taucherbrille an tiefem Wasser steht
    this.tauchIA = {
      pos: new THREE.Vector3(),
      radius: SUCH_RADIUS + 1.5,
      bild: '🤿',
      text: 'Tauchen',
      aktiv: () => !this.taucht && !!this.tauchStelle,
      ausfuehren: () => this.abtauchen(),
    };
    // „Aufheben“ erscheint unter Wasser direkt beim Insadorium
    this.aufhebIA = {
      pos: this.ort,
      radius: AUFHEB_RADIUS,
      bild: '💎',
      text: 'Aufheben',
      aktiv: () => this.kannAufheben(),
      ausfuehren: () => this.aufheben(),
    };
    this.interaktionen = [this.tauchIA, this.aufhebIA];
  }

  // ---------- Das Insadorium bauen ----------
  baueStein(szene) {
    this.steinGruppe = new THREE.Group();
    const E = EINSTELLUNGEN;
    // Ein runder Edelstein mit vielen kleinen Flächen (rund, aber er funkelt)
    const form = new THREE.IcosahedronGeometry(STEIN_GROESSE, 2);
    // Ein bisschen platt drücken und unregelmäßig machen – wie ein echter Kiesel
    const p = form.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const beule = 1 + 0.07 * Math.sin(x * 9 + z * 4) * Math.cos(y * 7);
      p.setXYZ(i, x * beule * 1.12, y * beule * 0.82, z * beule);
    }
    form.computeVertexNormals();
    this.steinMaterial = new THREE.MeshStandardMaterial({
      color: '#ff2a1a',
      emissive: '#ff1200',
      emissiveIntensity: E.insadoriumLeuchten,
      roughness: 0.25,
      metalness: 0.1,
      flatShading: true, // Facetten wie bei einem geschliffenen Stein
    });
    this.stein = new THREE.Mesh(form, this.steinMaterial);
    this.steinGruppe.add(this.stein);

    // Ein heller Kern innen drin (ganz weiß-rot = am grellsten)
    const kern = new THREE.Mesh(
      new THREE.SphereGeometry(STEIN_GROESSE * 0.55, 16, 12),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(9, 3, 2.2), transparent: true, opacity: 0.85, toneMapped: false, depthWrite: false })
    );
    this.stein.add(kern);

    // Der Lichtschein drumherum (ein „Sprite“ schaut immer zur Kamera)
    this.schein = new THREE.Sprite(new THREE.SpriteMaterial({
      map: leuchtBild(), color: new THREE.Color(5, 0.9, 0.6), transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    }));
    this.schein.scale.setScalar(4);
    this.steinGruppe.add(this.schein);
    // Strahlen, die sich langsam drehen – darum „kann man fast nicht hineinschauen“
    this.strahlen = new THREE.Sprite(new THREE.SpriteMaterial({
      map: strahlenBild(), color: new THREE.Color(3, 0.7, 0.5), transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    }));
    this.strahlen.scale.setScalar(6);
    this.steinGruppe.add(this.strahlen);

    // Ein einziges rotes Licht – es leuchtet nur, wenn man in der Nähe ist
    // (Es ist immer da, aber auf 0 gedreht. Ein- und Ausschalten würde ruckeln.)
    this.licht = new THREE.PointLight('#ff3020', 0, 16, 1.6);
    this.licht.position.y = 0.6;
    this.steinGruppe.add(this.licht);
    szene.add(this.steinGruppe);

    // Der rote Schimmer oben auf dem Wasser – so sieht man von oben, wo er liegt
    this.schimmer = new THREE.Mesh(
      new THREE.CircleGeometry(3.2, 32).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({
        map: leuchtBild(), color: new THREE.Color(1.6, 0.25, 0.15), transparent: true, opacity: 0.6,
        blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
      })
    );
    this.schimmer.renderOrder = 5; // nach dem Wasser malen
    szene.add(this.schimmer);
  }

  // ---------- Das blaue Wasser rundherum (nur beim Tauchen sichtbar) ----------
  // Eine große Kugel um die Kamera, innen bemalt: oben hell (da ist die Sonne),
  // unten dunkelblau. Sie verdeckt den Himmel, damit man sich wirklich unter Wasser fühlt.
  baueWasserKuppel(szene) {
    const form = new THREE.SphereGeometry(EINSTELLUNGEN.tauchSichtweite + 6, 24, 12);
    const p = form.attributes.position;
    const farben = new Float32Array(p.count * 3);
    const oben = new THREE.Color('#5fc3dd'), mitte = new THREE.Color('#1a6f9a'), unten = new THREE.Color('#062a48');
    const c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const h = p.getY(i) / (EINSTELLUNGEN.tauchSichtweite + 6); // −1 … 1
      if (h > 0) c.copy(mitte).lerp(oben, h);
      else c.copy(mitte).lerp(unten, -h);
      c.toArray(farben, i * 3);
    }
    form.setAttribute('color', new THREE.BufferAttribute(farben, 3));
    this.kuppel = new THREE.Mesh(form, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
    this.kuppel.visible = false;
    this.kuppel.frustumCulled = false;
    this.kuppel.renderOrder = -10; // zuerst malen – alles andere liegt davor
    // Die Kuppel klebt an der Kamera (wird direkt vor dem Malen verschoben)
    this.kuppel.onBeforeRender = (renderer, s, kamera) => {
      this.kuppel.matrixWorld.makeTranslation(kamera.position.x, kamera.position.y, kamera.position.z);
    };
    this.kuppel.matrixAutoUpdate = false;
    szene.add(this.kuppel);
    this.nebelFarbe = mitte.clone();
  }

  // ---------- Die Taucherbrille auf dem Kopf der Figur ----------
  baueBrille() {
    const kopf = this.spiel.spieler?.k?.kopf;
    this.brille = new THREE.Group();
    if (!kopf) return;
    const rahmen = new THREE.MeshStandardMaterial({ color: '#1f8fd6', roughness: 0.4 });
    const glas = new THREE.MeshStandardMaterial({ color: '#bfefff', roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.45 });
    // (Maße wie in junge.js: der Kopf-Knochen sitzt 1,13 m hoch, das Gesicht bei 1,2 m)
    for (const s of [-1, 1]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.008, 8, 20), rahmen);
      ring.position.set(s * 0.036, 0.082, 0.1);
      ring.rotation.y = s * 0.35;
      this.brille.add(ring);
      const scheibe = new THREE.Mesh(new THREE.CircleGeometry(0.03, 20), glas);
      scheibe.position.set(s * 0.036, 0.082, 0.102);
      scheibe.rotation.y = s * 0.35;
      this.brille.add(scheibe);
    }
    // Das Gummiband um den Kopf
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.118, 0.008, 6, 28), rahmen);
    band.rotation.x = Math.PI / 2 + 0.08;
    band.position.set(0, 0.085, -0.004);
    this.brille.add(band);
    this.brille.visible = false;
    kopf.add(this.brille);
  }

  // ---------- Luft-Anzeige und blauer Blick (HTML) ----------
  baueAnzeigen() {
    const eltern = this.spiel.elternElement || document.getElementById('spielfeld') || document.body;
    this.blick = document.createElement('div');
    this.blick.id = 'tauch-blick';
    // Bläschen, die nach oben steigen (nur CSS – kostet fast nichts)
    for (let i = 0; i < 14; i++) {
      const b = document.createElement('span');
      b.className = 'blase';
      const g = 8 + Math.round(Math.random() * 18);
      b.style.cssText = `left:${Math.round(Math.random() * 96)}%;width:${g}px;height:${g}px;` +
        `animation-duration:${(3 + Math.random() * 4).toFixed(1)}s;animation-delay:${(-Math.random() * 6).toFixed(1)}s`;
      this.blick.appendChild(b);
    }
    const hud = document.getElementById('hud');
    if (hud && hud.parentElement === eltern) eltern.insertBefore(this.blick, hud);
    else eltern.appendChild(this.blick);

    this.luftAnzeige = document.createElement('div');
    this.luftAnzeige.id = 'luft-anzeige';
    this.luftAnzeige.innerHTML = '<span>🫧 Luft</span><div class="balken"><div class="fuellung"></div></div>';
    (hud || eltern).appendChild(this.luftAnzeige);
    this.luftFuellung = this.luftAnzeige.querySelector('.fuellung');
  }

  // Falls es (noch) keine Lagune gibt: ein tiefes Stück Wasser nahe der Startinsel suchen
  sucheTestOrt() {
    for (let r = 20; r < 300; r += 6) {
      for (let i = 0; i < 24; i++) {
        const w = (i / 24) * Math.PI * 2;
        const x = Math.cos(w) * r, z = Math.sin(w) * r;
        if (tiefeBei(x, z) > 2.5) return { x, z };
      }
    }
    return { x: 0, z: 250 };
  }

  // ---------- Wohin kommt das Insadorium? ----------
  setzeInsadorium(x, z) {
    const y = bodenHoehe(x, z) + STEIN_GROESSE * 0.75; // liegt auf dem Grund
    this.steinGruppe.position.set(x, y, z);
    this.stein.position.set(0, 0, 0);
    this.steinGruppe.updateMatrixWorld(true);
    this.ort = new THREE.Vector3(x, y, z);
    if (this.aufhebIA) this.aufhebIA.pos = this.ort;
    this.wasserOben = wasserHoeheBei(x, z);
    this.schimmer.position.set(x, this.wasserOben + 0.04, z);
    this.zeigeStein();
  }

  zeigeStein() {
    this.steinGruppe.visible = !this.gefunden;
    this.schimmer.visible = !this.gefunden;
    if (this.gefunden) this.licht.intensity = 0;
  }

  // ---------- Kann man hier tauchen? ----------
  // Wir schauen in kleinen Kreisen um die Figur, ob dort tiefes Wasser ist.
  sucheTauchStelle(pos) {
    const min = EINSTELLUNGEN.tauchMinTiefe;
    let beste = null, besteTiefe = 0;
    for (let r = 0; r <= SUCH_RADIUS; r += 1.5) {
      const punkte = r === 0 ? 1 : 10;
      for (let i = 0; i < punkte; i++) {
        const w = (i / punkte) * Math.PI * 2;
        const x = pos.x + Math.cos(w) * r, z = pos.z + Math.sin(w) * r;
        const t = tiefeBei(x, z);
        // tief genug – und man steht nicht hoch oben auf einer Klippe darüber
        if (t >= min && t > besteTiefe && pos.y <= wasserHoeheBei(x, z) + 1.2) {
          beste = new THREE.Vector3(x, wasserHoeheBei(x, z), z);
          besteTiefe = t;
        }
      }
      if (beste) return beste;
    }
    return null;
  }

  darfTauchen() {
    const { rucksack, spieler, darf } = this.spiel;
    if (!rucksack?.hat('taucherbrille')) return false;
    if (spieler?.fliegt) return false;
    if (darf && !darf()) return false;
    return true;
  }

  kannAufheben() {
    if (!this.taucht || this.phase !== 'unten' || this.gefunden) return false;
    const p = this.spiel.spieler.figur.position;
    // Die Figur liegt waagerecht – ihr Bauch ist etwa 1 m über den Füßen
    return Math.hypot(p.x - this.ort.x, p.z - this.ort.z) < AUFHEB_RADIUS && Math.abs(p.y + 0.6 - this.ort.y) < 2.6;
  }

  // ---------- Was zeigt der Aktions-Knopf? ----------
  aktionText(pos) {
    if (this.taucht) {
      if (this.phase !== 'unten') return null;
      if (this.kannAufheben()) return { bild: '💎', text: 'Aufheben' };
      return { bild: '⬆️', text: 'Auftauchen' };
    }
    if (this.tauchStelle && this.darfTauchen()) return { bild: '🤿', text: 'Tauchen' };
    return null;
  }

  // Der Aktions-Knopf wurde gedrückt (gibt true zurück, wenn Tauchen etwas gemacht hat)
  aktion() {
    if (this.taucht) {
      if (this.phase !== 'unten') return true;
      if (this.kannAufheben()) this.aufheben();
      else this.auftauchen();
      return true;
    }
    if (this.tauchStelle && this.darfTauchen()) {
      this.abtauchen();
      return true;
    }
    return false;
  }

  // ---------- Abtauchen! ----------
  abtauchen() {
    if (this.taucht || !this.tauchStelle) return;
    const { spieler, musik, meldung } = this.spiel;
    const p = spieler.figur.position;
    this.sicherePosition.copy(p);
    const stelle = this.tauchStelle;
    const oben = wasserHoeheBei(stelle.x, stelle.z);
    const boden = bodenHoehe(stelle.x, stelle.z);
    p.set(stelle.x, Math.max(boden + 0.3, oben - 1.6), stelle.z);
    spieler.geschwindigkeitY = 0;
    spieler.amBoden = false;
    spieler.grabZeit = 0;
    spieler.schwungZeit = 0;
    this.taucht = true;
    this.phase = 'unten';
    this.luft = EINSTELLUNGEN.tauchLuft;
    this.gewarnt = false;
    this.v.set(0, 0);
    this.vy = -0.8;
    this.tauchStelle = null;
    this.brille.visible = true;
    this.unterWasserAn(true);
    musik?.platsch?.(1);
    meldung?.('🤿 Du tauchst! Sprungknopf festhalten = hoch, loslassen = runter. Pass auf deine Luft auf!', 5);
  }

  // ---------- Auftauchen: nach oben und ans Ufer schwimmen ----------
  auftauchen(keineLuft = false) {
    if (!this.taucht || this.phase !== 'unten') return;
    const { spieler, musik, meldung } = this.spiel;
    const p = spieler.figur.position;
    this.ufer = this.sucheUfer(p) || { x: this.sicherePosition.x, z: this.sicherePosition.z };
    this.phase = 'zumUfer';
    this.zumUferZeit = 0;
    this.start = p.clone();
    const weg = Math.hypot(this.ufer.x - p.x, this.ufer.z - p.z);
    this.zumUferDauer = THREE.MathUtils.clamp(weg / 7, 0.8, 2.5); // höchstens 2,5 Sekunden
    this.unterWasserAn(false);
    musik?.platsch?.(0.8);
    if (keineLuft) meldung?.('😮‍💨 Puh! Die Luft ist alle – du tauchst schnell auf.', 4);
    else if (!this.gefundenGerade) meldung?.('⬆️ Du tauchst auf und schwimmst ans Ufer.', 3);
  }

  // Den nächsten Platz suchen, an dem man wieder stehen kann
  sucheUfer(p) {
    const spieler = this.spiel.spieler;
    const passt = (x, z) => {
      const b = bodenHoehe(x, z);
      if (wasserHoeheBei(x, z) - b > 0.45) return false; // noch zu tief
      if (b > wasserHoeheBei(x, z) + 1.6) return false; // oben auf der Klippe? Nein!
      if (GELAENDE.istKlippenWand && GELAENDE.istKlippenWand(x, z)) return false;
      return spieler.kannStehen ? spieler.kannStehen(x, z) : true;
    };
    for (let r = 1; r <= 90; r += 1.5) {
      const punkte = Math.min(48, Math.ceil((Math.PI * 2 * r) / 2));
      for (let i = 0; i < punkte; i++) {
        const w = (i / punkte) * Math.PI * 2;
        const x = p.x + Math.cos(w) * r, z = p.z + Math.sin(w) * r;
        if (passt(x, z)) return { x, z };
      }
    }
    return null;
  }

  // ---------- Das Insadorium aufheben! ----------
  aufheben() {
    if (!this.kannAufheben()) return;
    const { rucksack, meldung, musik } = this.spiel;
    if (!rucksack.passt('insadorium')) {
      musik?.gehtNicht?.();
      meldung?.('🎒 Dein Rucksack ist voll! Tauch auf, wirf etwas weg und hol dann das Insadorium.', 5);
      return;
    }
    rucksack.hinein('insadorium');
    this.gefunden = true;
    this.gefundenGerade = true;
    this.zeigeStein();
    musik?.pling?.();
    meldung?.('🔴✨ DU HAST DAS INSADORIUM GEFUNDEN!!! ✨🔴', 6);
    // Gleich auftauchen – das Finale feiern wir am Ufer
    this.auftauchen();
  }

  // ---------- Unter-Wasser-Look an oder aus ----------
  unterWasserAn(an) {
    const nebel = this.szene.fog;
    if (an) {
      if (nebel && !this.nebelVorher) this.nebelVorher = { near: nebel.near, far: nebel.far };
    } else if (nebel && this.nebelVorher) {
      nebel.near = this.nebelVorher.near;
      nebel.far = this.nebelVorher.far;
      this.nebelVorher = null;
    }
    this.kuppel.visible = an;
    this.blick.classList.toggle('an', an);
    this.luftAnzeige.classList.toggle('an', an);
    this.luftAnzeige.classList.remove('knapp');
  }

  // ---------- Für die Kamera (main.js) ----------
  // Unter Wasser bleibt die Kamera unter der Wasseroberfläche (sonst sieht man ja nichts)
  get kameraDecke() {
    if (!this.taucht || this.phase !== 'unten') return null;
    const p = this.spiel.spieler.figur.position;
    return wasserHoeheBei(p.x, p.z) - 0.45;
  }
  // … und ist etwas näher dran (das Wasser ist trüb)
  get kameraAbstandFaktor() {
    return this.taucht && this.phase === 'unten' ? 0.6 : 1;
  }

  // ---------- Schwimmen: jedes Bild einmal (statt spieler.aktualisiere) ----------
  steuern(dt, richtung, gehalten, kameraWinkel) {
    const spieler = this.spiel.spieler;
    const pos = spieler.figur.position;
    const E = EINSTELLUNGEN;

    if (this.phase === 'zumUfer') {
      // An der Oberfläche schnell ans Ufer gleiten
      this.zumUferZeit += dt;
      const t = Math.min(1, this.zumUferZeit / this.zumUferDauer);
      const weich = t * t * (3 - 2 * t);
      const zielY = bodenHoehe(this.ufer.x, this.ufer.z);
      pos.x = mische(this.start.x, this.ufer.x, weich);
      pos.z = mische(this.start.z, this.ufer.z, weich);
      const oben = wasserHoeheBei(pos.x, pos.z) - 0.5;
      // erst hoch zur Oberfläche, dann am Ufer auf die Füße
      pos.y = t < 0.3 ? mische(this.start.y, oben, t / 0.3) : mische(oben, zielY, Math.max(0, (t - 0.7) / 0.3));
      const dx = this.ufer.x - this.start.x, dz = this.ufer.z - this.start.z;
      if (Math.hypot(dx, dz) > 0.3) spieler.figur.rotation.y = Math.atan2(dx, dz);
      this.schwimmPhase += dt * 6;
      this.animiereSchwimmen(dt, 0);
      if (t >= 1) this.amUfer();
      return;
    }

    // ---- Waagerecht: Joystick (wie beim Fliegen, nur langsamer) ----
    const laenge = Math.hypot(richtung.x, richtung.y);
    const staerke = Math.min(1, laenge);
    const ziel = new THREE.Vector2();
    if (staerke > 0.05) {
      const sin = Math.sin(kameraWinkel), cos = Math.cos(kameraWinkel);
      const dx = (richtung.x * cos - richtung.y * sin) / Math.max(laenge, 1);
      const dz = (-richtung.x * sin - richtung.y * cos) / Math.max(laenge, 1);
      ziel.set(dx, dz).multiplyScalar(E.tauchTempo * staerke);
    }
    // Im Wasser ist alles weich und träge
    this.v.lerp(ziel, Math.min(1, dt * 2.2));
    const neuX = pos.x + this.v.x * dt, neuZ = pos.z + this.v.y * dt;
    // Nur weiter, wo noch Wasser ist und der Boden nicht im Weg ist
    const frei = (x, z) => tiefeBei(x, z) > 0.5 && bodenHoehe(x, z) < pos.y + 0.6 &&
      (!GELAENDE.imErlaubtenMeer || GELAENDE.imErlaubtenMeer(x, z));
    if (frei(neuX, neuZ)) {
      pos.x = neuX;
      pos.z = neuZ;
    } else if (frei(neuX, pos.z)) {
      pos.x = neuX;
      this.v.y *= 0.5;
    } else if (frei(pos.x, neuZ)) {
      pos.z = neuZ;
      this.v.x *= 0.5;
    } else this.v.multiplyScalar(0.5);

    // In Schwimmrichtung drehen
    const tempo = this.v.length();
    if (tempo > 0.3) {
      let diff = Math.atan2(this.v.x, this.v.y) - spieler.figur.rotation.y;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      spieler.figur.rotation.y += diff * Math.min(1, dt * 4);
    }

    // ---- Senkrecht: festhalten = hoch, loslassen = langsam runter ----
    const zielY = gehalten ? E.tauchSteigTempo : -E.tauchSinkTempo;
    this.vy += (zielY - this.vy) * Math.min(1, dt * 2.5);
    pos.y += this.vy * dt;
    const boden = bodenHoehe(pos.x, pos.z);
    const oben = wasserHoeheBei(pos.x, pos.z) - 1.1; // ganz unter Wasser bleiben
    if (pos.y < boden + 0.15) {
      pos.y = boden + 0.15;
      this.vy = Math.max(0, this.vy);
    }
    if (pos.y > oben) {
      pos.y = Math.max(oben, boden + 0.15);
      this.vy = Math.min(0, this.vy);
    }

    // Schwimm-Bewegung: schneller schwimmen = schnellere Züge
    const f = THREE.MathUtils.clamp(tempo / E.tauchTempo, 0, 1);
    this.schwimmPhase += dt * (2.2 + 3.2 * Math.max(f, gehalten ? 0.5 : 0));
    this.animiereSchwimmen(dt, THREE.MathUtils.clamp(this.vy / E.tauchSteigTempo, -1, 1));
  }

  // Wieder an Land: Füße auf den Boden
  amUfer() {
    const spieler = this.spiel.spieler;
    const pos = spieler.figur.position;
    pos.set(this.ufer.x, bodenHoehe(this.ufer.x, this.ufer.z), this.ufer.z);
    spieler.geschwindigkeitY = 0;
    spieler.amBoden = true;
    spieler.tempoJetzt = 0;
    this.taucht = false;
    this.phase = null;
    this.brille.visible = false;
    this.pruefUhr = 0.5; // erst kurz verschnaufen, dann wieder „Tauchen“ zeigen
    if (this.gefundenGerade) {
      this.gefundenGerade = false;
      this.beimGefunden?.(); // → Finale!
    }
  }

  // ---------- Schwimm-Pose: Brustschwimmen wie ein Frosch ----------
  animiereSchwimmen(dt, steigt) {
    const spieler = this.spiel.spieler;
    const k = spieler.k;
    const p = this.schwimmPhase;
    spieler.uhr += dt;
    spieler.luft = 1;
    spieler.tempoJetzt = 0;
    spieler.laufZeit = 0;
    // Körper liegt fast waagerecht im Wasser (beim Hochschwimmen schräger)
    const neigung = 1.25 - steigt * 0.35 + Math.sin(p) * 0.05;
    k.huefte.rotation.set(neigung, 0, Math.sin(p * 0.5) * 0.04);
    k.huefte.position.y = 0.67 + Math.sin(p) * 0.02;
    k.bauch.rotation.set(-0.08, 0, 0);
    k.brust.rotation.set(-0.1 + Math.sin(p) * 0.04, 0, 0);
    // Kopf hoch, damit er nach vorne schaut
    k.hals.rotation.set(-neigung * 0.5, 0, 0);
    k.kopf.rotation.set(-neigung * 0.3, 0, 0);
    // Arme: nach vorne strecken, weit zur Seite ziehen, zur Brust zurück
    const aus = 0.5 + 0.5 * Math.sin(p);
    const schulterX = mische(-2.95, -1.75, aus);
    const schulterZ = mische(0.12, 1.25, aus);
    const ellbogen = -mische(0.1, 1.1, aus * aus);
    k.schulterL.rotation.set(schulterX, 0, -schulterZ);
    k.schulterR.rotation.set(schulterX, 0, schulterZ);
    k.ellbogenL.rotation.x = ellbogen;
    k.ellbogenR.rotation.x = ellbogen;
    // Beine: Frosch-Beinschlag (kommt etwas nach den Armen)
    const tritt = 0.5 + 0.5 * Math.sin(p + Math.PI * 0.8);
    k.beinL.rotation.set(mische(0.15, -0.8, tritt), 0, mische(-0.06, -0.45, tritt));
    k.beinR.rotation.set(mische(0.15, -0.8, tritt), 0, mische(0.06, 0.45, tritt));
    k.knieL.rotation.x = k.knieR.rotation.x = mische(0.1, 1.5, tritt);
    k.fussL.rotation.x = k.fussR.rotation.x = 0.6;
    // Werkzeug-Schwung abbrechen
    spieler.schwungZeit = 0;
    spieler.grabZeit = 0;
  }

  // ---------- Jedes Bild einmal ----------
  // (nach himmel.aktualisiere aufrufen – sonst überschreibt der Himmel die Nebelfarbe)
  aktualisiere(dt) {
    const { spieler, meldung, musik } = this.spiel;
    const pos = spieler.figur.position;
    const E = EINSTELLUNGEN;
    this.uhr += dt;

    // ---- Das Insadorium leuchtet und pulsiert ----
    if (!this.gefunden) {
      const abstand = pos.distanceTo(this.ort);
      const nah = abstand < ZEIG_WEITE;
      this.steinGruppe.visible = nah;
      this.schimmer.visible = nah && !this.taucht;
      if (nah) {
        const puls = 0.85 + 0.15 * Math.sin(this.uhr * 3.1) + 0.05 * Math.sin(this.uhr * 11.7);
        this.steinMaterial.emissiveIntensity = E.insadoriumLeuchten * puls;
        this.stein.rotation.y += dt * 0.4;
        this.schein.scale.setScalar(4 * puls);
        this.strahlen.material.rotation += dt * 0.25;
        this.strahlen.scale.setScalar(6.5 * (0.9 + 0.12 * Math.sin(this.uhr * 2.3)));
        // Unter Wasser blendet er noch mehr
        this.strahlen.material.opacity = this.taucht ? 1 : 0.55;
        // Das Licht nur in der Nähe
        this.licht.intensity = abstand < LICHT_WEITE ? 30 * puls * (1 - abstand / LICHT_WEITE) : 0;
        // Schimmer oben: auf dem Meer schaukelt er mit den Wellen
        const s = this.schimmer;
        s.position.y = (istMeer(s.position.x, s.position.z) ? WASSER_HOEHE + wellenHoehe(s.position.x, s.position.z) : this.wasserOben) + 0.04;
        s.material.opacity = 0.45 + 0.2 * Math.sin(this.uhr * 2.2);
      } else this.licht.intensity = 0;
    }

    // ---- Kann man hier tauchen? (nur 4 Mal pro Sekunde nachschauen – spart Rechenzeit) ----
    if (!this.taucht) {
      this.pruefUhr -= dt;
      if (this.pruefUhr <= 0) {
        this.pruefUhr = 0.25;
        this.tauchStelle = this.darfTauchen() ? this.sucheTauchStelle(pos) : null;
        if (this.tauchStelle) this.tauchIA.pos.copy(this.tauchStelle);
      }
      return;
    }

    // ---- Unter Wasser ----
    if (this.phase !== 'unten') return;
    // Nebel: blau und dicht
    const nebel = this.szene.fog;
    if (nebel) {
      nebel.color.copy(this.nebelFarbe);
      nebel.near = 1.5;
      nebel.far = E.tauchSichtweite;
    }
    // Die Luft wird weniger
    this.luft -= dt;
    const anteil = Math.max(0, this.luft / E.tauchLuft);
    this.luftFuellung.style.width = `${(anteil * 100).toFixed(1)}%`;
    const knapp = this.luft <= E.tauchLuftWarnung;
    this.luftAnzeige.classList.toggle('knapp', knapp);
    if (knapp && !this.gewarnt) {
      this.gewarnt = true;
      meldung?.(`⚠️ Wenig Luft! Noch ${Math.ceil(this.luft)} Sekunden – tauch bald auf!`, 4);
      musik?.gehtNicht?.();
    }
    if (this.luft <= 0) {
      this.luft = 0;
      this.auftauchen(true);
      return;
    }
    // Ab und zu ein leises „Blubb“
    this.blubbUhr -= dt;
    if (this.blubbUhr <= 0) {
      this.blubbUhr = 1.6 + Math.random() * 2;
      if (musik?.ctx && musik.ton) {
        const t = musik.ctx.currentTime;
        const f = 260 + Math.random() * 200;
        musik.ton(t, f, f * 2.2, 0.09, 0.05);
        musik.ton(t + 0.12, f * 1.3, f * 2.8, 0.07, 0.03);
      }
    }
  }

  // ---------- Speichern ----------
  alsDaten() {
    return { gefunden: this.gefunden };
  }

  ladeDaten(d = {}) {
    this.gefunden = !!d.gefunden;
    this.zeigeStein();
  }
}
