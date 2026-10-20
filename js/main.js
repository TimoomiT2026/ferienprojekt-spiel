// =============================================================
//  HAUPTPROGRAMM – startet das Spiel und läuft jedes Bild einmal durch
//  Das nennt man die "Spielschleife": Eingabe lesen → Welt bewegen →
//  Bild malen → wieder von vorn. 60 Mal pro Sekunde!
// =============================================================
import * as THREE from 'three';
import { EINSTELLUNGEN } from './einstellungen.js';
import { baueGelaende, bodenHoehe, DORF } from './gelaende.js';
import { baueNatur, aktualisiereNatur, wenigerDetails } from './natur.js';
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
import { Angeln, baueAngel } from './angeln.js';
import { Lagerfeuer } from './feuer.js';
import { Ueberleben } from './ueberleben.js';
import { ladeSpielstand, speichereSpielstand, loescheSpielstand } from './speicher.js';
import { zeigeVorgeschichte } from './vorgeschichte.js';
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

// ---------- Die Welt bauen ----------
const hindernisse = new Hindernisse();
szene.add(baueGelaende());
baueNatur(szene, hindernisse);
const wasser = new Wasser(szene);
const himmel = new Himmel(szene, renderer);
const dorf = new Dorf(szene, hindernisse);
const tageszeit = new Tageszeit();
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
const haendler = new Haendler({ rucksack, meldung, musik, elternElement: spielfeld });
const lagerfeuer = new Lagerfeuer(szene, hindernisse, { rucksack, meldung, musik });
objekte.interaktionen.push(lagerfeuer.interaktion);
const ueberleben = new Ueberleben({ rucksack, spieler, meldung, tageszeit });
rucksack.beimEssen = () => ueberleben.gegessen();

// ---------- Angeln ----------
spieler.angel.add(baueAngel());
const angeln = new Angeln(szene, { rucksack, meldung, musik, spieler });
objekte.interaktionen.push(...angeln.interaktionen);

// Fenster, die das Spiel anhalten
const fensterOffen = () => rucksack.offen || karte.offen || werkbank.offen || haendler.offen;

// ---------- Boote & Tiere ----------
const boote = new Boote(szene, spieler);
objekte.interaktionen.push(...boote.interaktionen);
const tiere = new Tiere(szene, hindernisse);

// ---------- Karte & Navigation ----------
const karte = new Karte(spielfeld);
karte.punkt('zelt', { name: 'Zelt', bild: '⛺', x: 5, z: -2 });
karte.punkt('werkbank', { name: 'Werkbank', bild: '🔨', x: werkbank.ort.x, z: werkbank.ort.z });
karte.punkt('dorf', { name: 'Dorf', bild: '🏘️', x: DORF.x, z: DORF.z });
karte.beiZielErreicht = (ziel) => meldung(`${ziel.bild} Du bist da: ${ziel.name}!`, 4);
angeln.positionen.forEach((p, i) => karte.punkt(`angel${i}`, { name: 'Angelstelle', bild: '🎣', x: p.x, z: p.z }));
// Boote erscheinen erst auf der Karte, wenn man sie entdeckt hat
boote.positionen.forEach((b, i) => karte.punkt(`boot${i}`, { name: 'Boot', bild: '🚣', x: b.x, z: b.z, sichtbar: false }));
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
let kameraNeigung = 0.35;
const kameraPos = new THREE.Vector3(0, 30, 40);
const blickZiel = new THREE.Vector3();

function bewegeKamera(dt, drehung, neigung) {
  kameraWinkel += drehung;
  kameraNeigung = THREE.MathUtils.clamp(kameraNeigung + neigung, 0.08, 1.2);
  const p = spieler.figur.position;
  const abstand = EINSTELLUNGEN.kameraAbstand;
  const ziel = new THREE.Vector3(
    p.x + Math.sin(kameraWinkel) * Math.cos(kameraNeigung) * abstand,
    p.y + 1.5 + Math.sin(kameraNeigung) * abstand,
    p.z + Math.cos(kameraWinkel) * Math.cos(kameraNeigung) * abstand
  );
  ziel.y = Math.max(ziel.y, bodenHoehe(ziel.x, ziel.z) + 1, 0.8);
  kameraPos.lerp(ziel, Math.min(1, dt * 8));
  kameraPos.y = Math.max(kameraPos.y, bodenHoehe(kameraPos.x, kameraPos.z) + 0.8); // nie im Hügel stecken
  kamera.position.copy(kameraPos);
  blickZiel.set(p.x, p.y + 1.6, p.z);
  kamera.lookAt(blickZiel);
}

// ---------- Die Spielschleife ----------
const uhr = new THREE.Clock();
let laeuft = false;
let warNacht = false;

// Automatische Qualität: Ruckelt es, rechnen wir mit etwas weniger Pixeln
let bilderGezaehlt = 0, messZeit = 0;
function passeQualitaetAn(echteZeit) {
  bilderGezaehlt++;
  messZeit += echteZeit;
  if (messZeit < 3) return;
  const fps = bilderGezaehlt / messZeit;
  const pr = renderer.getPixelRatio();
  if (fps < 40 && pr > 1) renderer.setPixelRatio(Math.max(1, pr - 0.25));
  else if (fps < 35) wenigerDetails(); // reicht das nicht: Pflanzen nicht so weit zeigen
  bilderGezaehlt = 0;
  messZeit = 0;
}

function spielSchleife() {
  requestAnimationFrame(spielSchleife);
  const echteZeit = uhr.getDelta();
  const dt = Math.min(echteZeit, 0.05);
  if (laeuft) passeQualitaetAn(echteZeit);

  if (laeuft) {
    const eingabe = steuerung.lies();
    if (eingabe.rucksack && !karte.offen) {
      if (werkbank.offen) werkbank.schliessen();
      else if (haendler.offen) haendler.schliessen();
      else rucksack.offen ? rucksack.schliessen() : rucksack.oeffnen();
    }
    if (karte.offen && rucksack.offen) rucksack.schliessen();
    const pausiert = fensterOffen() || schlaeft;
    if (!pausiert) {
      tageszeit.aktualisiere(dt);
      if (eingabe.aktion) {
        if (objekte.aktuelle) objekte.aktion();
        else if (rucksack.inDerHand === 'schwert') schwertSchlag();
      }
      if (boote.faehrt) boote.steuern(dt, eingabe.richtung, kameraWinkel);
      else if (angeln.beschaeftigt) spieler.aktualisiere(dt, { x: 0, y: 0 }, false, kameraWinkel);
      else spieler.aktualisiere(dt, eingabe.richtung, eingabe.springen, kameraWinkel);
      angeln.aktualisiere(dt); // nach dem Spieler, damit die Arm-Haltung stimmt
    }
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
    if (laeuft) meldung(nacht ? '🌙 Es wird Nacht! Geh zu deinem Zelt und schlaf.' : '☀️ Die Sonne geht auf!', 5);
  }

  const pos = spieler.figur.position;
  himmel.aktualisiere(dt, tageszeit, kamera, pos);
  wasser.aktualisiere(dt);
  boote.aktualisiere(dt);
  lagerfeuer.aktualisiere(dt);
  if (laeuft) ueberleben.aktualisiere();
  tiere.aktualisiere(dt, pos, himmel.helligkeit);
  aktualisiereNatur(dt, pos);
  dorf.aktualisiere(dt, himmel.helligkeit, pos);
  spieler.laterne.intensity = (1 - himmel.helligkeit) * 14;

  karte.aktualisiere(dt, pos, kameraWinkel, spieler.figur.rotation.y);
  let naechste = objekte.aktualisiere(dt, pos);
  if (!naechste && rucksack.inDerHand === 'schwert') {
    const holz = holzInDerNaehe(pos.x, pos.z);
    naechste = holz ? { bild: '🪓', text: holz.art === 'baum' ? 'Fällen' : 'Zerschlagen' } : { bild: '⚔️', text: 'Schwingen' };
  }
  const zeigen = laeuft && naechste && !fensterOffen();
  aktionsKnopf.classList.toggle('sichtbar', !!zeigen);
  if (zeigen) {
    aktionsBild.innerHTML = naechste.bild;
    aktionsText.textContent = naechste.text;
  }
  zeigeUhr();
  renderer.render(szene, kamera);
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
      const passt = rucksack.hinein('holz', bekommen);
      meldung(passt ? `🪵 +${bekommen} Holz!` : 'Der Rucksack ist voll – das Holz bleibt liegen.', 3);
    }
    if (rucksack.verbrauche('schwert')) meldung('💥 Dein Schwert ist kaputt! Bau dir an der Werkbank ein neues.', 5);
  }, 220);
}

// ---------- Speichern & Laden ----------
function sammleSpielstand() {
  const p = spieler.figur.position;
  return {
    version: 1,
    rucksack: rucksack.alsDaten(),
    tageszeit: { zeit: tageszeit.zeit, tag: tageszeit.tag },
    spieler: { x: p.x, z: p.z, winkel: spieler.figur.rotation.y },
    ueberleben: ueberleben.alsDaten(),
    objekte: objekte.alsDaten(),
    gefaellt: gefaellteHolzStellen(),
    feuer: lagerfeuer.brennt,
    boote: boote.liste.map((b) => ({ x: b.gruppe.position.x, z: b.gruppe.position.z, w: b.gruppe.rotation.y, entdeckt: b.entdeckt })),
    vorgeschichteGesehen: true,
  };
}

function wendeSpielstandAn(s) {
  try {
    rucksack.ladeDaten(s.rucksack || {});
    tageszeit.zeit = s.tageszeit?.zeit ?? 0;
    tageszeit.tag = s.tageszeit?.tag ?? 1;
    ueberleben.ladeDaten(s.ueberleben || {});
    objekte.ladeDaten(s.objekte || {});
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

function speichern() {
  if (laeuft && !boote.faehrt) speichereSpielstand(sammleSpielstand());
}
setInterval(speichern, 10000);
window.addEventListener('pagehide', speichern);
document.addEventListener('visibilitychange', () => document.hidden && speichern());

const gespeichert = ladeSpielstand();

// ---------- Startbildschirm ----------
const startBildschirm = document.getElementById('start');
if (gespeichert) {
  startBildschirm.querySelector('.tippen').textContent = `Weiterspielen · Tag ${gespeichert.tageszeit?.tag ?? 1}`;
  const neu = document.createElement('button');
  neu.className = 'neues-spiel';
  neu.textContent = '🔄 Neues Spiel anfangen';
  startBildschirm.appendChild(neu);
  knopf(neu, () => {
    if (confirm('Wirklich ganz von vorn anfangen? Dein Spielstand wird gelöscht.')) {
      loescheSpielstand();
      location.reload();
    }
  });
}

function starte() {
  if (laeuft) return;
  musik.start();
  startBildschirm.classList.add('weg');
  const los = () => {
    laeuft = true;
    document.getElementById('hud').classList.add('sichtbar');
    if (gespeichert) meldung(`👋 Willkommen zurück, Forscher! Tag ${tageszeit.tag}.`, 4);
    else meldung('Finde die glitzernde Schaufel beim Zelt! ✨', 6);
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
});

// Auf dem iPad das Heranzoomen mit zwei Fingern verhindern
document.addEventListener('gesturestart', (e) => e.preventDefault());

spielSchleife();

// Für automatische Tests: Spielzustand von außen ablesbar machen
window.__spiel = {
  spieler, rucksack, tageszeit, objekte, renderer, starte, karte, werkbank, szene, kamera, boote, tiere,
  haendler, lagerfeuer, ueberleben, speichern, sammleSpielstand,
  get kameraWinkel() { return kameraWinkel; },
  teleport(x, z, winkel = kameraWinkel) {
    spieler.figur.position.set(x, bodenHoehe(x, z), z);
    kameraWinkel = winkel;
    kameraPos.set(x + Math.sin(winkel) * 9, bodenHoehe(x, z) + 5, z + Math.cos(winkel) * 9);
  },
};
