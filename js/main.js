// =============================================================
//  HAUPTPROGRAMM – startet das Spiel und läuft jedes Bild einmal durch
//  Das nennt man die "Spielschleife": Eingabe lesen → Welt bewegen →
//  Bild malen → wieder von vorn. 60 Mal pro Sekunde!
// =============================================================
import * as THREE from 'three';
import { EINSTELLUNGEN } from './einstellungen.js';
import { baueGelaende, bodenHoehe } from './gelaende.js';
import { baueNatur, aktualisiereNatur } from './natur.js';
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
rucksack.beiAenderung = () => (spieler.schaufel.visible = rucksack.inDerHand === 'schaufel');
rucksack.zeichnen();
knopf(document.getElementById('rucksack-zu'), () => rucksack.schliessen());
// Tippen im Rucksack-Fenster soll nicht den Joystick starten
document.getElementById('rucksack-fenster').addEventListener('touchstart', (e) => e.stopPropagation());

// ---------- Schlafen ----------
const schlafBild = document.getElementById('schlafen');
let schlaeft = false;
function schlafen() {
  schlaeft = true;
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

const objekte = new Objekte(szene, hindernisse, { rucksack, musik, meldung, tageszeit, spieler, dorf, schlafen });

// ---------- Anzeigen ----------
document.getElementById('muenzen').textContent = EINSTELLUNGEN.startGeld;
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
    if (eingabe.rucksack) rucksack.offen ? rucksack.schliessen() : rucksack.oeffnen();
    const pausiert = rucksack.offen || schlaeft;
    if (!pausiert) {
      tageszeit.aktualisiere(dt);
      if (eingabe.aktion) objekte.aktion();
      spieler.aktualisiere(dt, eingabe.richtung, eingabe.springen, kameraWinkel);
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
  aktualisiereNatur(dt, pos);
  dorf.aktualisiere(dt, himmel.helligkeit, pos);
  spieler.laterne.intensity = (1 - himmel.helligkeit) * 14;

  const naechste = objekte.aktualisiere(dt, pos);
  const zeigen = laeuft && naechste && !rucksack.offen;
  aktionsKnopf.classList.toggle('sichtbar', !!zeigen);
  if (zeigen) {
    aktionsBild.innerHTML = naechste.bild;
    aktionsText.textContent = naechste.text;
  }
  zeigeUhr();
  renderer.render(szene, kamera);
}

// ---------- Startbildschirm ----------
const startBildschirm = document.getElementById('start');
function starte() {
  if (laeuft) return;
  laeuft = true;
  musik.start();
  startBildschirm.classList.add('weg');
  document.getElementById('hud').classList.add('sichtbar');
  meldung('Finde die glitzernde Schaufel beim Zelt! ✨', 6);
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
  spieler, rucksack, tageszeit, objekte, renderer, starte,
  get kameraWinkel() { return kameraWinkel; },
  teleport(x, z, winkel = kameraWinkel) {
    spieler.figur.position.set(x, bodenHoehe(x, z), z);
    kameraWinkel = winkel;
    kameraPos.set(x + Math.sin(winkel) * 9, bodenHoehe(x, z) + 5, z + Math.cos(winkel) * 9);
  },
};
