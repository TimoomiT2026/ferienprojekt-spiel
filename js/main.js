// =============================================================
//  HAUPTPROGRAMM – startet das Spiel und läuft jedes Bild einmal durch
//  Das nennt man die "Spielschleife" (Game Loop): Eingabe lesen →
//  Welt bewegen → Bild malen → wieder von vorn. 60 Mal pro Sekunde!
// =============================================================
import * as THREE from 'three';
import { EINSTELLUNGEN } from './einstellungen.js';
import { baueWelt, bodenHoehe } from './welt.js';
import { Spieler } from './spieler.js';
import { Steuerung } from './steuerung.js';

const spielfeld = document.getElementById('spielfeld');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // iPad nicht überfordern
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
spielfeld.prepend(renderer.domElement);

const szene = new THREE.Scene();
const kamera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 400);

const { sonne, hindernisse } = baueWelt(szene);
const spieler = new Spieler(szene, hindernisse);
const steuerung = new Steuerung(spielfeld);

// Anzeige oben links: Münzen (Startgeld aus der Mindmap)
let muenzen = EINSTELLUNGEN.startGeld;
document.getElementById('muenzen').textContent = muenzen;

// Kamera schwebt hinter der Figur
let kameraWinkel = 0; // Drehung um die Figur herum
let kameraNeigung = 0.35; // wie weit von oben
const kameraPos = new THREE.Vector3();
const blickZiel = new THREE.Vector3();

function bewegeKamera(dt, eingabe) {
  kameraWinkel += eingabe.kameraDrehung;
  kameraNeigung = THREE.MathUtils.clamp(kameraNeigung + eingabe.kameraNeigung, 0.1, 1.2);
  const p = spieler.figur.position;
  const abstand = EINSTELLUNGEN.kameraAbstand;
  const ziel = new THREE.Vector3(
    p.x + Math.sin(kameraWinkel) * Math.cos(kameraNeigung) * abstand,
    p.y + 1.5 + Math.sin(kameraNeigung) * abstand,
    p.z + Math.cos(kameraWinkel) * Math.cos(kameraNeigung) * abstand
  );
  // Kamera nicht unter den Boden tauchen lassen
  ziel.y = Math.max(ziel.y, bodenHoehe(ziel.x, ziel.z) + 1);
  kameraPos.lerp(ziel, Math.min(1, dt * 8));
  kamera.position.copy(kameraPos);
  blickZiel.set(p.x, p.y + 1.6, p.z);
  kamera.lookAt(blickZiel);

  // Die Sonne folgt der Figur, damit Schatten überall funktionieren
  sonne.position.set(p.x + 40, p.y + 60, p.z + 25);
  sonne.target.position.copy(p);
}

const uhr = new THREE.Clock();
let laeuft = false;

function spielSchleife() {
  requestAnimationFrame(spielSchleife);
  const dt = Math.min(uhr.getDelta(), 0.05);
  if (laeuft) {
    const eingabe = steuerung.lies();
    spieler.aktualisiere(dt, eingabe.richtung, eingabe.springen, kameraWinkel);
    bewegeKamera(dt, eingabe);
  } else {
    // Auf dem Startbildschirm dreht sich die Kamera langsam um die Insel
    kameraWinkel += dt * 0.15;
    bewegeKamera(dt, { kameraDrehung: 0, kameraNeigung: 0 });
  }
  renderer.render(szene, kamera);
}

// Startbildschirm: einmal tippen und los geht's
const startBildschirm = document.getElementById('start');
function starte() {
  laeuft = true;
  startBildschirm.classList.add('weg');
  document.getElementById('hud').classList.add('sichtbar');
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

kameraPos.set(0, 20, 20);
spielSchleife();

// Für automatische Tests: Spielzustand von außen ablesbar machen
window.__spiel = { spieler, starte, get kameraWinkel() { return kameraWinkel; } };
