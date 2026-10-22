// =============================================================
//  HAUPTPROGRAMM – startet das Spiel und läuft jedes Bild einmal durch
//  Das nennt man die "Spielschleife": Eingabe lesen → Welt bewegen →
//  Bild malen → wieder von vorn. 60 Mal pro Sekunde!
// =============================================================
import * as THREE from 'three';
import { EINSTELLUNGEN } from './einstellungen.js';
import { baueGelaende, bodenHoehe, DORF, WASSER_HOEHE, aufWelcherInsel, INSELN } from './gelaende.js';
import { baueNatur, aktualisiereNatur, wenigerDetails, buschInDerNaehe, grasDichte, wasserInDerNaehe } from './natur.js';
import { Hindernisse } from './hindernisse.js';
import { Himmel } from './himmel.js';
import { Wasser } from './wasser.js';
import { Dorf } from './dorf.js';
import { Tageszeit } from './tageszeit.js';
import { Spieler } from './spieler.js';
import { Steuerung, knopf } from './steuerung.js';
import { Rucksack } from './rucksack.js';
import { Objekte } from './objekte.js';
import { Musik } from './musik.js';
import { Karte } from './karte.js';
import { Werkbank } from './werkbank.js';
import { Boote } from './boote.js';
import { Tiere } from './tiere.js';
import { setzeAnisotropie } from './texturen.js';
import { Haendler } from './haendler.js';
import { Aufgaben } from './aufgaben.js';
import { Nachbearbeitung } from './nachbearbeitung.js';
import { Fernrohr } from './fernrohr.js';
import { Pferde } from './pferde.js';
import { Pilze } from './pilze.js';
import { Base } from './base.js';
import { Angeln, baueAngel } from './angeln.js';
import { Lagerfeuer } from './feuer.js';
import { Ueberleben } from './ueberleben.js';
import { ladeSpielstand, speichereSpielstand, loescheSpielstand } from './speicher.js';
import { zeigeVorgeschichte } from './vorgeschichte.js';
import { Tutorial } from './tutorial.js';
import { Seilkanone } from './seilkanone.js';
import { Tauchen } from './tauchen.js';
import { Finale } from './finale.js';
import { Ballon } from './ballon.js';
import { Bewohner } from './bewohner.js';
import { Palmendorf } from './palmendorf.js';
import { Markt } from './markt.js';
import { Rallye } from './rallye.js';
import { Ereignisse, verbindeEreignisse } from './ereignisse.js';
import { Zeitung } from './zeitung.js';
import { holzInDerNaehe, schlagen, gefaellteHolzStellen, ladeGefaellte } from './natur.js';

const spielfeld = document.getElementById('spielfeld');

// ---------- Der Maler (Renderer) ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // iPad nicht überfordern
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; // Farben wie im Kino
renderer.toneMappingExposure = 1.05;
spielfeld.prepend(renderer.domElement);
// Texturen auch schräg von der Seite scharf halten
setzeAnisotropie(Math.min(8, renderer.capabilities.getMaxAnisotropy()));

const szene = new THREE.Scene();
const kamera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1200);
// Nachbearbeitung: Leuchten, Farben wie im Film, Vignette
const nach = new Nachbearbeitung(renderer, szene, kamera);

// ---------- Die Welt bauen ----------
const hindernisse = new Hindernisse();
szene.add(baueGelaende());
baueNatur(szene, hindernisse);
const wasser = new Wasser(szene);
const himmel = new Himmel(szene, renderer);
const dorf = new Dorf(szene, hindernisse);
const tageszeit = new Tageszeit();
const ereignisse = new Ereignisse(tageszeit); // merkt sich, was passiert – für die Inselzeitung
const spieler = new Spieler(szene, hindernisse);
const steuerung = new Steuerung(spielfeld);
const musik = new Musik();

// ---------- Meldungen oben in der Mitte ----------
const meldungsFeld = document.getElementById('meldung');
let meldungsTimer = null;
function meldung(text, sekunden = 3.5) {
  meldungsFeld.textContent = text;
  meldungsFeld.classList.add('sichtbar');
  clearTimeout(meldungsTimer);
  meldungsTimer = setTimeout(() => meldungsFeld.classList.remove('sichtbar'), sekunden * 1000);
}

const rucksack = new Rucksack(meldung);
rucksack.beiAenderung = () => {
  spieler.schaufel.visible = rucksack.inDerHand === 'schaufel';
  spieler.schwert.visible = rucksack.inDerHand === 'schwert';
  spieler.angel.visible = rucksack.inDerHand === 'angel';
};
rucksack.zeichnen();
knopf(document.getElementById('rucksack-zu'), () => rucksack.schliessen());
// Tippen im Rucksack-Fenster soll nicht den Joystick starten
document.getElementById('rucksack-fenster').addEventListener('touchstart', (e) => e.stopPropagation());

// ---------- Schlafen ----------
const schlafBild = document.getElementById('schlafen');
let schlaeft = false;
function schlafen() {
  schlaeft = true;
  ueberleben.schlaeftJetzt();
  schlafBild.classList.add('sichtbar');
  musik.schlaflied();
  setTimeout(() => {
    tageszeit.schlafen();
    objekte.neuerTag();
  }, 1800);
  setTimeout(() => {
    schlafBild.classList.remove('sichtbar');
    schlaeft = false;
    meldung(`☀️ Guten Morgen! Tag ${tageszeit.tag} beginnt.`, 4);
    tutorial.neu('schlafen');
  }, 3600);
}

const objekte = new Objekte(szene, hindernisse, {
  rucksack, musik, meldung, tageszeit, spieler, dorf, schlafen,
  haendlerOeffnen: () => haendler.oeffnen(),
});

// ---------- Werkbank ----------
const werkbank = new Werkbank(szene, hindernisse, { rucksack, meldung, musik, elternElement: spielfeld });
objekte.interaktionen.push(werkbank.interaktion);

// ---------- Händler, Lagerfeuer, Essen & Schlafen ----------
const haendler = new Haendler({ rucksack, meldung, musik, tageszeit, elternElement: spielfeld });
// Das Palmendorf auf der Palmeninsel mit dem zweiten Händler 🌴
const palmendorf = new Palmendorf(szene, hindernisse, { rucksack, meldung, musik, tageszeit, elternElement: spielfeld });
objekte.interaktionen.push(...palmendorf.interaktionen);
const lagerfeuer = new Lagerfeuer(szene, hindernisse, { rucksack, meldung, musik });
objekte.interaktionen.push(lagerfeuer.interaktion);
const ueberleben = new Ueberleben({ rucksack, spieler, meldung, tageszeit });
rucksack.beimEssen = (id) => {
  ueberleben.gegessen(id);
  tutorial.neu('essen');
  aufgaben.gegessen(id);
};

// ---------- Angeln ----------
spieler.angel.add(baueAngel());
const angeln = new Angeln(szene, { rucksack, meldung, musik, spieler });
objekte.interaktionen.push(...angeln.interaktionen);

// ---------- Die Base (Zelt → Hütte → Haus) ----------
const base = new Base(szene, hindernisse, { rucksack, meldung, musik, tageszeit, spieler, angeln, schlafen, elternElement: spielfeld });
base.beiNeuerInteraktion = (ia) => objekte.interaktionen.push(ia);
objekte.interaktionen.push(...base.interaktionen);

// ---------- Briefkasten & Inselzeitung 📬 (am Morgen jedes Markttags) ----------
const zeitung = new Zeitung(szene, hindernisse, { base, tageszeit, meldung, musik, elternElement: spielfeld, ereignisse });
objekte.interaktionen.push(...zeitung.interaktionen);

// ---------- Heißluftballon 🎈 ----------
const ballon = new Ballon(szene, hindernisse, { spieler, meldung, musik, haendler, elternElement: spielfeld });
objekte.interaktionen.push(...ballon.interaktionen);

const aufgaben = new Aufgaben({ rucksack, lagerfeuer, meldung, musik, elternElement: spielfeld, base: null, pferde: null });

// Fenster, die das Spiel anhalten
const fensterOffen = () => rucksack.offen || karte.offen || werkbank.offen || haendler.offen || palmendorf.haendler.offen || aufgaben.offen || base.offen || finale.offen || ballon.offen || bewohner.offen || markt.offen || zeitung.offen;

// ---------- Boote & Tiere ----------
const boote = new Boote(szene, spieler);
objekte.interaktionen.push(...boote.interaktionen);
const tiere = new Tiere(szene, hindernisse);

// ---------- Karte & Navigation ----------
const karte = new Karte(spielfeld);
karte.beiInselEntdeckt = (name) => {
  meldung(`🏝️ Neue Insel entdeckt: ${name}!`, 4);
  tutorial.neu('insel');
  if (name === 'Palmeninsel') zeigePalmendorf();
  zeigeAngelstellen();
};
// Das Palmendorf erscheint auf der Karte, sobald man die Palmeninsel entdeckt hat
function zeigePalmendorf() {
  karte.punkt('palmendorf', { name: 'Palmendorf', bild: '🌴', x: palmendorf.mitte.x, z: palmendorf.mitte.z, sichtbar: true });
  karte.punkt('rallye', { name: 'Rallye', bild: '🍄', x: rallye.standPos.x, z: rallye.standPos.z, sichtbar: true });
}

// ---------- Wochenmarkt im Palmendorf 🛒 (alle 3 Spieltage) ----------
const markt = new Markt(szene, hindernisse, { rucksack, meldung, musik, tageszeit, elternElement: spielfeld, karte, ueberleben, ereignisse });
objekte.interaktionen.push(...markt.interaktionen);

// ---------- Die 10 Inselbewohner auf der Palmeninsel (einer hat die Taucherbrille) ----------
// (erst NACH dem Palmendorf bauen, damit niemand in einer Hütte steht)
const bewohner = new Bewohner(szene, { rucksack, meldung, musik, spieler, hindernisse, elternElement: spielfeld, karte });
objekte.interaktionen.push(...bewohner.interaktionen);
karte.punkt('zelt', { name: 'Base', bild: '🏠', x: base.ort.x, z: base.ort.z });
karte.punkt('werkbank', { name: 'Werkbank', bild: '🔨', x: werkbank.ort.x, z: werkbank.ort.z });
karte.punkt('dorf', { name: 'Dorf', bild: '🏘️', x: DORF.x, z: DORF.z });
karte.beiZielErreicht = (ziel) => meldung(`${ziel.bild} Du bist da: ${ziel.name}!`, 4);
// Angelstellen auf der Karte – auf neuen Inseln erst, wenn man die Insel entdeckt hat
const zeigeAngelstellen = () => angeln.positionen.forEach((p, i) => karte.punkt(`angel${i}`, {
  name: 'Angelstelle', bild: '🎣', x: p.x, z: p.z,
  sichtbar: !p.insel || p.insel === 'Startinsel' || karte.entdeckteInseln.includes(p.insel),
}));
zeigeAngelstellen();
// Boote erscheinen erst auf der Karte, wenn man sie entdeckt hat
boote.positionen.forEach((b, i) => karte.punkt(`boot${i}`, { name: 'Boot', bild: '🚣', x: b.x, z: b.z, sichtbar: false }));
// ---------- Pferde ----------
// Die Base (mit dem Pferdestall) kommt später dazu – bis dahin gibt es keinen Stall
const baseHalter = { base, get stall() { return this.base?.stall ?? null; } };
const pferde = new Pferde(szene, hindernisse, { rucksack, meldung, musik, spieler, base: baseHalter, tageszeit, boote });
ballon.spiel.boote = boote; // damit beim Rudern/Reiten "Steig erst ab" kommt
ballon.spiel.pferde = pferde;

// ---------- Zauberpilz-Rallye 🍄🚣 (am Markttag im Palmendorf) ----------
const rallye = new Rallye(szene, hindernisse, { rucksack, meldung, musik, spieler, kamera, tageszeit, elternElement: spielfeld, boote, pferde, ereignisse });
objekte.interaktionen.push(...rallye.interaktionen);
objekte.interaktionen.push(...pferde.interaktionen);

// ---------- Seilkanone (Klippen hochklettern) ----------
const seilkanone = new Seilkanone(szene, { rucksack, meldung, musik, spieler, hindernisse, handFrei: () => !boote.faehrt && !pferde.reitet });
objekte.interaktionen.push(...seilkanone.interaktionen);
aufgaben.spiel.base = base;
aufgaben.spiel.haendler = haendler;
aufgaben.spiel.karte = karte;
aufgaben.spiel.bewohner = bewohner;
aufgaben.spiel.pferde = pferde;

// ---------- Zauberpilze & Fliegen ----------
const pilze = new Pilze(szene, { rucksack, meldung, musik, tageszeit, hindernisse });
objekte.interaktionen.push(...pilze.interaktionen);

// ---------- Tauchen & das Insadorium ----------
const tauchen = new Tauchen(szene, { rucksack, meldung, musik, spieler, kamera, elternElement: spielfeld, darf: () => !boote.faehrt && !pferde.reitet });
objekte.interaktionen.push(...tauchen.interaktionen);
const finale = new Finale({ elternElement: spielfeld, musik });
tauchen.beimGefunden = () => finale.starten(); // 🎉 Ziel erreicht!
aufgaben.spiel.tauchen = tauchen;
rucksack.beimBenutzen = (id) => {
  if (id !== 'zauberpilz') return;
  if (boote.faehrt || pferde.reitet || seilkanone.beschaeftigt) {
    rucksack.hinein('zauberpilz'); // geht gerade nicht – zurück in den Rucksack
    meldung('Steig erst aus, dann kannst du fliegen!', 4);
    return;
  }
  spieler.fliegen();
  tutorial.neu('fliegen');
  meldung('✨ Du kannst fliegen! Sprungknopf festhalten = höher, 🛬 = landen.', 5);
};
spieler.beiFlugWarnung = (s) => meldung(`⏳ Noch ${s} Sekunden, dann landest du!`, 4);
spieler.beiWind = () => meldung('🌬️ Puh, über der Klippe weht ein starker Wind! Da kommst du nur mit der Seilkanone hoch.', 5);
spieler.beiFlugEnde = (selbst) => meldung(selbst ? '🛬 Du landest.' : '🍄 Der Zauber ist vorbei – du schwebst runter.', 4);

// ---------- Tutorial: Erklär-Blasen beim ersten Mal ----------
const tutorial = new Tutorial({ elternElement: spielfeld, tageszeit });
let warBeimHaendler = false;
// Wenn man etwas zum ersten Mal im Rucksack hat → Erklärung
const NEUE_DINGE = [['schaufel', 'schaufel'], ['angel', 'angel'], ['tofufisch', 'fisch'], ['schuh', 'muell'], ['dose', 'muell'],
  ['leine', 'leine'], ['fernrohr', 'fernrohr'], ['schwert', 'schwert'],
  ['wertvolleMuenze', 'wertvolleMuenze'], ['taucherbrille', 'taucherbrille'], ['seilkanone', 'seilkanone']];
function tutorialPruefen(dt, naechste, pos) {
  // Was ist gerade in der Nähe?
  if (naechste && !spieler.fliegt && !tauchen.taucht && !ballon.faehrt) {
    if (naechste === werkbank.interaktion) tutorial.neu('werkbank');
    else if (naechste === lagerfeuer.interaktion) tutorial.neu('lagerfeuer');
    else if (naechste === base.baseIA) tutorial.neu('base');
    else if (naechste === base.truheIA) tutorial.neu('truhe');
    else if (naechste.text === 'Graben') tutorial.neu('grabestelle');
    else if (naechste.text === 'Handeln') tutorial.neu('haendler');
    else if (naechste.text === 'Schläft') tutorial.neu('haendlerSchlaeft');
    else if (angeln.interaktionen.includes(naechste)) tutorial.neu('angelstelle');
    else if (boote.interaktionen.includes(naechste)) tutorial.neu('boot');
    else if (pferde.interaktionen.includes(naechste)) tutorial.neu('pferd');
    else if (pilze.interaktionen.includes(naechste)) tutorial.neu('zauberpilz');
    else if (ballon.interaktionen.includes(naechste)) tutorial.neu('ballon');
    else if (naechste.text === 'Ansprechen') tutorial.neu('bewohner');
  }
  for (const [ding, id] of NEUE_DINGE) if (rucksack.hat(ding)) tutorial.neu(id);
  if (rucksack.inDerHand === 'schwert' && holzInDerNaehe(pos.x, pos.z)) tutorial.neu('baum');
  if (rucksack.offen) tutorial.neu('rucksack');
  if (karte.offen) tutorial.neu('karte');
  if (aufgaben.offen) tutorial.neu('aufgabenbuch');
  if (haendler.offen || palmendorf.haendler.offen) warBeimHaendler = true;
  if (ueberleben.hungrig) tutorial.neu('hunger');
  tutorial.aktualisiere(dt, {
    hatSchaufel: rucksack.hat('schaufel'),
    rucksackVoll: rucksack.istVoll(),
    muenzen: rucksack.muenzen,
    fensterOffen: fensterOffen() || schlaeft || fernrohr.aktiv,
    warBeimHaendler,
  });
}

// ---------- Fernrohr ----------
const fernrohr = new Fernrohr(kamera, spielfeld);
fernrohr.meldung = meldung;
// Boote kann man auch durchs Fernrohr entdecken
boote.liste.forEach((b, i) => fernrohr.ziel('boot' + i, {
  name: 'Boot', bild: '🚣', pos: b.gruppe.position, hoehe: 3,
  beiEntdeckt: () => {
    if (!b.entdeckt) {
      b.entdeckt = true;
      boote.beiEntdeckt?.(b);
    }
  },
}));

// Die neuen Inseln kann man auch durchs Fernrohr entdecken
INSELN.slice(1).forEach((I) => fernrohr.ziel('insel-' + I.name, {
  name: I.name, bild: '🏝️', pos: new THREE.Vector3(I.x, 0, I.z), hoehe: I.plateauHoehe ?? 8,
  beiEntdeckt: () => karte.entdeckeInsel(I.name),
}));

boote.beiEntdeckt = (boot) => {
  const i = boote.liste.indexOf(boot);
  const b = boote.positionen[i];
  karte.punkt(`boot${i}`, { name: 'Boot', bild: '🚣', x: b.x, z: b.z, sichtbar: true });
  meldung('🚣 Du hast ein Boot entdeckt! Es ist jetzt auf deiner Karte.', 5);
};

// ---------- Anzeigen ----------
rucksack.aendereMuenzen(0);
const uhrFeld = document.getElementById('uhr');
const aktionsKnopf = document.getElementById('aktion-knopf');
const aktionsBild = document.getElementById('aktion-bild');
const aktionsText = document.getElementById('aktion-text');
const musikKnopf = document.getElementById('musik-knopf');
musikKnopf.classList.toggle('aus', !musik.an);
knopf(musikKnopf, () => {
  musikKnopf.classList.toggle('aus', !musik.umschalten());
});

function zeigeUhr() {
  const rest = Math.ceil(tageszeit.restSekunden());
  const zeit = `${Math.floor(rest / 60)}:${String(rest % 60).padStart(2, '0')}`;
  uhrFeld.textContent = tageszeit.istNacht()
    ? `🌙 Nacht ${tageszeit.tag} · noch ${zeit}`
    : `☀️ Tag ${tageszeit.tag} · noch ${zeit}`;
}

// ---------- Die Kamera schwebt hinter der Figur ----------
let kameraWinkel = 0;
let flugZoom = 0;
let kameraNeigung = 0.35;
const kameraPos = new THREE.Vector3(0, 30, 40);
const blickZiel = new THREE.Vector3();

function bewegeKamera(dt, drehung, neigung) {
  kameraWinkel += drehung;
  kameraNeigung = THREE.MathUtils.clamp(kameraNeigung + neigung, 0.08, 1.2);
  const p = spieler.figur.position;
  // Beim Fliegen geht die Kamera weich etwas weiter weg
  flugZoom += ((spieler.fliegt ? 1 : 0) - flugZoom) * Math.min(1, dt * 2);
  const abstand = EINSTELLUNGEN.kameraAbstand * (1 + 0.45 * flugZoom + 1.8 * ballon.kameraZoom) * tauchen.kameraAbstandFaktor * rallye.kameraAbstandFaktor;
  const ziel = new THREE.Vector3(
    p.x + Math.sin(kameraWinkel) * Math.cos(kameraNeigung) * abstand,
    p.y + 1.5 + Math.sin(kameraNeigung) * abstand,
    p.z + Math.cos(kameraWinkel) * Math.cos(kameraNeigung) * abstand
  );
  ziel.y = Math.max(ziel.y, bodenHoehe(ziel.x, ziel.z) + 1, 0.8);
  kameraPos.lerp(ziel, Math.min(1, dt * 8));
  kameraPos.y = Math.max(kameraPos.y, bodenHoehe(kameraPos.x, kameraPos.z) + 0.8); // nie im Hügel stecken
  const decke = tauchen.kameraDecke; // unter Wasser bleibt die Kamera auch unter Wasser
  if (decke !== null) { ziel.y = Math.min(ziel.y, decke); kameraPos.y = Math.min(kameraPos.y, decke); }
  kamera.position.copy(kameraPos);
  blickZiel.set(p.x, p.y + 1.6, p.z);
  kamera.lookAt(blickZiel);
}

// ---------- Die Spielschleife ----------
const uhr = new THREE.Clock();
let laeuft = false;
let warNacht = false;
let umgebungsUhr = 0, wasserNah = 0;
let inselUhr = 0; // prüft 1× pro Sekunde, auf welcher Insel man ist
let ballonTag = 1; // an welchem Tag haben wir zuletzt nach dem Ballon geschaut? // für Meeresrauschen & Rascheln

// Automatische Qualität: Ruckelt es, rechnen wir mit etwas weniger Pixeln
let bilderGezaehlt = 0, messZeit = 0;
let automatik = true; // für Tests abschaltbar
function passeQualitaetAn(echteZeit) {
  if (!automatik) return;
  bilderGezaehlt++;
  messZeit += echteZeit;
  if (messZeit < 3) return;
  const fps = bilderGezaehlt / messZeit;
  const pr = renderer.getPixelRatio();
  // Ruckelt es? Schritt für Schritt sparen: erst das Leuchten, dann Pixel, dann Filter, dann Pflanzen
  if (fps < 40 && nach.stufe === 2) nach.stufe = 1;
  else if (fps < 40 && pr > 1) renderer.setPixelRatio(Math.max(1, pr - 0.25));
  else if (fps < 35 && nach.stufe === 1) nach.stufe = 0;
  else if (fps < 35) wenigerDetails();
  bilderGezaehlt = 0;
  messZeit = 0;
}

function spielSchleife() {
  requestAnimationFrame(spielSchleife);
  const echteZeit = uhr.getDelta();
  const dt = Math.min(echteZeit, 0.05);
  if (laeuft) passeQualitaetAn(echteZeit);

  if (laeuft && fernrohr.aktiv) {
    // Durchs Fernrohr schauen: Die Figur steht still, die Zeit läuft weiter
    const eingabe = steuerung.lies();
    fernrohr.aktualisiere(dt, eingabe);
    if (!fernrohr.aktiv) kameraWinkel = fernrohr.blickWinkel; // danach in dieselbe Richtung weiterschauen
    tageszeit.aktualisiere(dt);
    spieler.figur.visible = !fernrohr.aktiv;
  } else if (laeuft) {
    spieler.figur.visible = true;
    const eingabe = steuerung.lies();
    if (eingabe.rucksack && !karte.offen) {
      if (werkbank.offen) werkbank.schliessen();
      else if (haendler.offen) haendler.schliessen();
      else if (palmendorf.haendler.offen) palmendorf.haendler.schliessen();
      else if (aufgaben.offen) aufgaben.schliessen();
      else if (base.offen) base.schliessen();
      else if (ballon.offen) ballon.schliessen();
      else if (bewohner.offen) bewohner.schliessen();
      else if (markt.offen) markt.schliessen();
      else if (zeitung.offen) zeitung.schliessen();
      else rucksack.offen ? rucksack.schliessen() : rucksack.oeffnen();
    }
    if (karte.offen && rucksack.offen) rucksack.schliessen();
    const pausiert = fensterOffen() || schlaeft;
    if (!pausiert) {
      tageszeit.aktualisiere(dt);
      if (eingabe.aktion && !seilkanone.beschaeftigt && !ballon.faehrt && !rallye.laeuft) {
        if (tauchen.taucht) tauchen.aktion();
        else if (spieler.fliegt) spieler.landen(); // in der Luft: Aktion = landen
        else if (objekte.aktuelle) objekte.aktion();
        else if (rucksack.inDerHand === 'schwert') schwertSchlag();
        else if (rucksack.inDerHand === 'fernrohr' && !boote.faehrt && !pferde.reitet) fernrohr.starten(spieler.figur.position, kameraWinkel);
        else if (rucksack.inDerHand === 'seilkanone' && !boote.faehrt && !pferde.reitet) seilkanone.schiessen(spieler.figur.position, spieler.figur.rotation.y);
      }
      if (ballon.faehrt) { /* der Ballon bewegt die Figur selbst */ }
      else if (rallye.laeuft) rallye.steuern(dt, eingabe.richtung, kameraWinkel);
      else if (tauchen.taucht) tauchen.steuern(dt, eingabe.richtung, eingabe.springenGehalten, kameraWinkel);
      else if (boote.faehrt) boote.steuern(dt, eingabe.richtung, kameraWinkel);
      else if (pferde.reitet) pferde.steuern(dt, eingabe.richtung, kameraWinkel);
      else if (seilkanone.beschaeftigt) { /* die Seilkanone bewegt die Figur selbst */ }
      else if (angeln.beschaeftigt) spieler.aktualisiere(dt, { x: 0, y: 0 }, false, kameraWinkel);
      else spieler.aktualisiere(dt, eingabe.richtung, eingabe.springen, kameraWinkel, eingabe.springenGehalten);
      angeln.aktualisiere(dt); // nach dem Spieler, damit die Arm-Haltung stimmt
      seilkanone.aktualisiere(dt);
      ballon.aktualisiere(dt);
    }
    if (rallye.laeuft && !pausiert) kameraWinkel = rallye.kameraFolgen(dt, kameraWinkel);
    bewegeKamera(dt, eingabe.kameraDrehung, eingabe.kameraNeigung);
  } else {
    // Startbildschirm: Die Kamera dreht sich langsam um die Figur
    kameraWinkel += dt * 0.12;
    bewegeKamera(dt, 0, 0);
  }

  const nacht = tageszeit.istNacht();
  if (nacht !== warNacht) {
    warNacht = nacht;
    musik.setzeNacht(nacht);
    dorf.haendler.visible = !nacht; // nachts geht der Händler schlafen
    palmendorf.setzeNacht(nacht);
    markt.setzeNacht(nacht);
    if (nacht && haendler.offen) haendler.schliessen();
    if (laeuft) meldung(nacht ? '🌙 Es wird Nacht! Geh zu deinem Zelt und schlaf.' : '☀️ Die Sonne geht auf!', 5);
    if (laeuft && nacht) tutorial.neu('nacht');
  }

  const pos = spieler.figur.position;
  himmel.aktualisiere(dt, tageszeit, kamera, pos);
  tauchen.aktualisiere(dt); // nach dem Himmel (Unterwasser-Nebel)
  wasser.aktualisiere(dt);
  boote.aktualisiere(dt);
  rallye.aktualisiere(dt);
  // Beim Rudern hat man beide Hände an den Rudern – Werkzeuge weg
  const hand = boote.faehrt || rallye.laeuft || pferde.reitet || tauchen.taucht || ballon.faehrt ? null : rucksack.inDerHand;
  spieler.schaufel.visible = hand === 'schaufel';
  spieler.schwert.visible = hand === 'schwert';
  // (Das Fernrohr hält man nicht sichtbar in der Hand – man schaut nur hindurch)
  spieler.angel.visible = hand === 'angel';
  lagerfeuer.aktualisiere(dt);
  if (laeuft) {
    ueberleben.aktualisiere();
    zeitung.aktualisiere(dt);
    aufgaben.aktualisiere(dt);
  }
  tiere.aktualisiere(dt, pos, himmel.helligkeit);
  pferde.aktualisiere(dt, pos, himmel.helligkeit);
  pilze.aktualisiere(dt, pos);
  bewohner.aktualisiere(dt, pos);
  aktualisiereNatur(dt, pos);
  // Geräusche der Umgebung: Meer, Rascheln im Busch, Platschen im Wasser
  umgebungsUhr -= dt;
  if (umgebungsUhr <= 0) { umgebungsUhr = 0.25; wasserNah = wasserInDerNaehe(pos.x, pos.z); } // nur 4× pro Sekunde
  const zuFuss = laeuft && !tauchen.taucht && !spieler.fliegt && !boote.faehrt && !rallye.laeuft && !pferde.reitet && !angeln.beschaeftigt;
  musik.umgebung({
    wasserNaehe: wasserNah,
    imGebuesch: zuFuss ? buschInDerNaehe(pos.x, pos.z) : 0,
    imGras: zuFuss ? grasDichte(pos.x, pos.z) : 0,
    watet: zuFuss && bodenHoehe(pos.x, pos.z) < WASSER_HOEHE,
    tempo: zuFuss ? spieler.tempoJetzt : 0,
  });
  dorf.aktualisiere(dt, himmel.helligkeit, pos);
  palmendorf.aktualisiere(dt, himmel.helligkeit, pos);
  markt.aktualisiere(dt, himmel.helligkeit, pos);
  base.aktualisiere(dt, himmel.helligkeit);
  spieler.laterne.intensity = (1 - himmel.helligkeit) * 14;

  karte.aktualisiere(dt, pos, kameraWinkel, spieler.figur.rotation.y);
  // Aus der Luft kann man nichts anfassen
  let naechste = objekte.aktualisiere(dt, pos);
  if (ballon.faehrt || rallye.laeuft) naechste = null;
  if (tageszeit.tag !== ballonTag) {
    ballonTag = tageszeit.tag;
    if (laeuft && ballon.morgensHeim()) setTimeout(() => meldung('🎈 Dein Ballon ist über Nacht heim zur Base geflogen.', 5), 6000);
  }
  // Wer auf der Palmeninsel war, kann mit dem Ballon ins Palmendorf fliegen
  inselUhr -= dt;
  if (laeuft && inselUhr <= 0) {
    inselUhr = 1;
    const palmendorf = ballon.ziele.find((z) => z.id === 'palmendorf');
    if (palmendorf && !palmendorf.freigeschaltet && aufWelcherInsel(pos.x, pos.z) === 'Palmeninsel') ballon.freischalten('palmendorf');
  }
  if (laeuft) tutorialPruefen(dt, naechste, pos);
  if (tauchen.taucht) naechste = tauchen.aktionText(pos);
  else if (spieler.fliegt) naechste = spieler.flugRest > 0 ? { bild: '🛬', text: 'Landen' } : null;
  else if (!naechste && rucksack.inDerHand === 'schwert') {
    const holz = holzInDerNaehe(pos.x, pos.z);
    naechste = holz ? { bild: '🪓', text: holz.art === 'baum' ? 'Fällen' : 'Zerschlagen' } : { bild: '⚔️', text: 'Schwingen' };
  }
  if (!naechste && !spieler.fliegt && rucksack.inDerHand === 'fernrohr' && !boote.faehrt && !pferde.reitet) naechste = { bild: '🔭', text: 'Durchschauen' };
  if (!naechste && !spieler.fliegt && rucksack.inDerHand === 'seilkanone' && !boote.faehrt && !pferde.reitet) naechste = seilkanone.aktionText(pos, spieler.figur.rotation.y);
  if (seilkanone.beschaeftigt) naechste = null;
  const zeigen = laeuft && naechste && !fensterOffen() && !fernrohr.aktiv;
  aktionsKnopf.classList.toggle('sichtbar', !!zeigen);
  if (zeigen) {
    aktionsBild.innerHTML = naechste.bild;
    aktionsText.textContent = naechste.text;
  }
  zeigeUhr();
  nach.render(dt);
}

// ---------- Mit dem Schwert Bäume fällen ----------
let schlagSperre = 0;
function schwertSchlag() {
  const jetzt = performance.now();
  if (jetzt < schlagSperre) return;
  schlagSperre = jetzt + 450;
  const pos = spieler.figur.position;
  const holz = holzInDerNaehe(pos.x, pos.z);
  if (holz) spieler.figur.rotation.y = Math.atan2(holz.x - pos.x, holz.z - pos.z); // zum Baum drehen
  spieler.schwingen();
  if (!holz) return;
  setTimeout(() => {
    const bekommen = schlagen(holz);
    musik.graben();
    if (bekommen > 0) {
      ereignisse.melde('baum', { art: holz.art });
      const passt = rucksack.hinein('holz', bekommen);
      meldung(passt ? `🪵 +${bekommen} Holz!` : 'Der Rucksack ist voll – das Holz bleibt liegen.', 3);
    }
    if (rucksack.verbrauche('schwert')) meldung('💥 Dein Schwert ist kaputt! Bau dir an der Werkbank ein neues.', 5);
  }, 220);
}

// ---------- Speichern & Laden ----------
function sammleSpielstand() {
  const p = tauchen.taucht ? tauchen.sicherePosition : spieler.figur.position;
  return {
    version: 1,
    rucksack: rucksack.alsDaten(),
    tageszeit: tageszeit.alsDaten(),
    spieler: { x: p.x, z: p.z, winkel: spieler.figur.rotation.y },
    ueberleben: ueberleben.alsDaten(),
    haendler: haendler.alsDaten(),
    pferde: pferde.alsDaten(),
    pilze: pilze.alsDaten(),
    aufgaben: aufgaben.alsDaten(),
    objekte: objekte.alsDaten(),
    base: base.alsDaten(),
    seilkanone: seilkanone.alsDaten(),
    tauchen: tauchen.alsDaten(),
    ballon: ballon.alsDaten(),
    inseln: karte.entdeckteInseln,
    bewohner: bewohner.alsDaten(),
    palmendorf: palmendorf.alsDaten(),
    markt: markt.alsDaten(),
    rallye: rallye.alsDaten(),
    ereignisse: ereignisse.alsDaten(),
    zeitung: zeitung.alsDaten(),
    finale: finale.alsDaten(),
    gefaellt: gefaellteHolzStellen(),
    feuer: lagerfeuer.brennt,
    boote: boote.liste.map((b) => ({ x: b.gruppe.position.x, z: b.gruppe.position.z, w: b.gruppe.rotation.y, entdeckt: b.entdeckt })),
    vorgeschichteGesehen: true,
  };
}

function wendeSpielstandAn(s) {
  try {
    rucksack.ladeDaten(s.rucksack || {});
    tageszeit.ladeDaten(s.tageszeit || {});
    ereignisse.ladeDaten(s.ereignisse || {});
    zeitung.ladeDaten(s.zeitung || {});
    ueberleben.ladeDaten(s.ueberleben || {});
    haendler.ladeDaten(s.haendler || {});
    if (s.pferde) pferde.ladeDaten(s.pferde);
    pilze.ladeDaten(s.pilze || {});
    aufgaben.ladeDaten(s.aufgaben || {});
    objekte.ladeDaten(s.objekte || {});
    base.ladeDaten(s.base || {});
    seilkanone.ladeDaten(s.seilkanone || {});
    tauchen.ladeDaten(s.tauchen || {});
    ballon.ladeDaten(s.ballon || {});
    karte.ladeEntdeckteInseln(s.inseln);
    bewohner.ladeDaten(s.bewohner);
    palmendorf.ladeDaten(s.palmendorf || {});
    markt.ladeDaten(s.markt || {});
    rallye.ladeDaten(s.rallye || {});
    if (karte.entdeckteInseln.includes('Palmeninsel')) zeigePalmendorf();
    zeigeAngelstellen();
    ballonTag = tageszeit.tag;
    finale.ladeDaten(s.finale || {});
    ladeGefaellte(s.gefaellt);
    lagerfeuer.brennt = s.feuer || 0;
    (s.boote || []).forEach((d, i) => {
      const b = boote.liste[i];
      if (!b) return;
      b.gruppe.position.x = d.x;
      b.gruppe.position.z = d.z;
      b.gruppe.rotation.y = d.w;
      if (d.entdeckt && !b.entdeckt) boote.beiEntdeckt?.(b), (b.entdeckt = true);
    });
    if (s.spieler && spieler.kannStehen(s.spieler.x, s.spieler.z)) {
      window.__spiel.teleport(s.spieler.x, s.spieler.z, kameraWinkel);
      spieler.figur.rotation.y = s.spieler.winkel || 0;
    }
  } catch (fehler) {
    console.warn('Spielstand konnte nicht geladen werden', fehler);
  }
}

let neuAnfangen = false; // wurde "Neues Spiel" gedrückt?
function speichern() {
  if (neuAnfangen) return; // gerade wird alles gelöscht – nicht wieder speichern!
  if (laeuft && !boote.faehrt && !pferde.reitet && !seilkanone.beschaeftigt && !ballon.faehrt && !tauchen.taucht && !rallye.laeuft) speichereSpielstand(sammleSpielstand());
}
setInterval(speichern, 10000);
// Entdeckte Boote auf der Karte dort zeigen, wo sie gerade liegen
setInterval(() => {
  boote.positionen.forEach((b, i) => b.entdeckt && karte.punkt(`boot${i}`, { name: 'Boot', bild: '🚣', x: b.x, z: b.z, sichtbar: true }));
}, 2000);
window.addEventListener('pagehide', speichern);
document.addEventListener('visibilitychange', () => document.hidden && speichern());

const gespeichert = ladeSpielstand();
if (!gespeichert) tutorial.zuruecksetzen(); // neues Spiel = alle Erklärungen wieder von vorn

// ---------- Startbildschirm ----------
const startBildschirm = document.getElementById('start');
if (gespeichert) {
  startBildschirm.querySelector('.tippen').textContent = `Weiterspielen · Tag ${gespeichert.tageszeit?.tag ?? 1}`;
  const neu = document.createElement('button');
  neu.className = 'neues-spiel';
  neu.textContent = '🔄 Neues Spiel anfangen';
  startBildschirm.appendChild(neu);
  // Der Finger-Tipp auf diesen Knopf darf NICHT auch noch "Weiterspielen" auslösen
  neu.addEventListener('touchend', (e) => e.stopPropagation());
  knopf(neu, () => {
    neuAnfangen = true; // ab jetzt: nichts mehr speichern, nichts starten
    if (confirm('Wirklich ganz von vorn anfangen? Dein Spielstand wird gelöscht.')) {
      loescheSpielstand();
      location.reload();
    } else neuAnfangen = false;
  });
}

function starte() {
  if (laeuft || neuAnfangen) return;
  musik.start();
  startBildschirm.classList.add('weg');
  const los = () => {
    laeuft = true;
    document.getElementById('hud').classList.add('sichtbar');
    if (gespeichert) meldung(`👋 Willkommen zurück, Forscher! Tag ${tageszeit.tag}.`, 4);
    else {
      meldung('Finde die glitzernde Schaufel beim Zelt! ✨', 6);
      tutorial.neu('start');
    }
  };
  if (gespeichert) {
    wendeSpielstandAn(gespeichert);
    los();
  } else zeigeVorgeschichte(spielfeld, los);
}
startBildschirm.addEventListener('click', starte);
startBildschirm.addEventListener('touchend', (e) => {
  e.preventDefault();
  starte();
});

window.addEventListener('resize', () => {
  kamera.aspect = window.innerWidth / window.innerHeight;
  kamera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  nach.setSize(window.innerWidth, window.innerHeight);
});

// Auf dem iPad das Heranzoomen mit zwei Fingern verhindern
document.addEventListener('gesturestart', (e) => e.preventDefault());

// Gegen Ruckeln am Anfang: Alle Grafik-Programme ("Shader") schon vorbereiten,
// während der Startbildschirm zu sehen ist – nicht erst beim ersten Umschauen.
try {
  if (renderer.compileAsync) renderer.compileAsync(szene, kamera).catch(() => {});
  else renderer.compile(szene, kamera);
} catch {}

spielSchleife();

// Für automatische Tests: Spielzustand von außen ablesbar machen
// Alle Ereignisse für die Zeitung automatisch mitschreiben (erst hier, wenn alle "bei…"-Funktionen gesetzt sind)
verbindeEreignisse(ereignisse, { rucksack, angeln, objekte, base, pferde, karte, tauchen, ballon, bewohner, ueberleben, spieler });

window.__spiel = {
  spieler, rucksack, tageszeit, objekte, renderer, starte, karte, werkbank, szene, kamera, boote, tiere, pferde, fernrohr, base, pilze,
  haendler, lagerfeuer, ueberleben, aufgaben, speichern, sammleSpielstand, nach, musik, tutorial, seilkanone, tauchen, finale, ballon, bewohner, palmendorf, angeln, markt, rallye, ereignisse, zeitung,
  set qualitaetsAutomatik(an) { automatik = an; },
  get kameraWinkel() { return kameraWinkel; },
  teleport(x, z, winkel = kameraWinkel) {
    spieler.figur.position.set(x, bodenHoehe(x, z), z);
    kameraWinkel = winkel;
    kameraPos.set(x + Math.sin(winkel) * 9, bodenHoehe(x, z) + 5, z + Math.cos(winkel) * 9);
  },
};
