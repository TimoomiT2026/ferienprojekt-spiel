// =============================================================
//  DAS GEHEIME LABOR 🔬 – oben in der Kugel des Rheinturms
//  Ein runder Raum, 174 Meter über dem Rhein: in der Mitte der Aufzug,
//  ringsum schräge Fenster mit Blick über Düsseldorf.
//  Drinnen: Computer, Labortisch mit Kolben, Bücherregal, Fernrohr,
//  Tafel und Weltkarte. Außerdem der gläserne Aufzug außen am Turm.
//  Alle Maße: Meter ab dem Rheinturm (x = Osten, z = Süden).
// =============================================================
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { textur } from './texturen.js';
import { BODEN } from './stadtbau.js';

export const LABOR_Y = BODEN + 174.6; // so hoch liegt der Fußboden im Labor
export const LABOR_HOCH = 4.7; // vom Boden bis zur Decke
export const KERN = 4.4; // der runde Aufzugs-Schacht in der Mitte
export const AUSSEN = 18.3; // bis hier geht der Fußboden (dann kommen die Fenster)
export const AUFZUG_OBEN = BODEN + 150; // so hoch fährt der Glas-Aufzug außen am Turm

// Wie dick ist der Turm-Schaft auf dieser Höhe? (für den Aufzug außen dran)
const SCHAFT = [[0, 11.6], [4, 10.8], [10, 10.6], [30, 10.2], [80, 9.6], [110, 8.9], [140, 8.5], [155, 8.4]];
export function schaftRadius(y) {
  const h = y - BODEN;
  for (let i = 1; i < SCHAFT.length; i++) {
    const [h0, r0] = SCHAFT[i - 1], [h1, r1] = SCHAFT[i];
    if (h <= h1) return r0 + (r1 - r0) * Math.max(0, (h - h0) / (h1 - h0));
  }
  return 8.4;
}

// Ein Punkt im Kreis um den Turm: Abstand r, Richtung w
export const polar = (r, w) => ({ x: Math.sin(w) * r, z: Math.cos(w) * r });

// Ein kleines Bild malen (für Tafel, Karte, Bildschirm)
function bild(breite, hoehe, malen) {
  const c = document.createElement('canvas');
  c.width = breite;
  c.height = hoehe;
  malen(c.getContext('2d'), breite, hoehe);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function mat(farbe, mehr = {}) {
  return new THREE.MeshStandardMaterial({ color: farbe, roughness: 0.6, ...mehr });
}

// Ein Möbelstück an seinen Platz stellen: Abstand r, Richtung w, Vorderseite zeigt zur Mitte (innen) oder nach außen
function stelle(ding, r, w, zurMitte = true) {
  const p = polar(r, w);
  ding.position.set(p.x, LABOR_Y, p.z);
  ding.rotation.y = zurMitte ? w + Math.PI : w;
  return ding;
}

function kiste(b, h, t, material, x = 0, y = 0, z = 0, rund = 0.04) {
  const m = new THREE.Mesh(new RoundedBoxGeometry(b, h, t, 2, Math.min(rund, b / 2.1, h / 2.1, t / 2.1)), material);
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  return m;
}

// ---------- Die Möbel ----------
function baueComputerTisch() {
  const g = new THREE.Group();
  const holz = mat('#c9a77c', { map: textur('bretter.jpg') });
  const metall = mat('#3a3f45', { metalness: 0.6, roughness: 0.4 });
  g.add(kiste(2.6, 0.08, 1.1, holz, 0, 0.95, 0));
  for (const x of [-1.2, 1.2]) g.add(kiste(0.08, 0.95, 1.0, metall, x, 0.47, 0));
  // Bildschirm (zeigt zur Mitte) – erst dunkel, dann geht er an
  g.add(kiste(1.5, 0.95, 0.08, metall, 0, 1.75, -0.35));
  g.add(kiste(0.12, 0.35, 0.12, metall, 0, 1.15, -0.38));
  const aus = bild(256, 160, (c, b, h) => { c.fillStyle = '#10161d'; c.fillRect(0, 0, b, h); c.fillStyle = '#2a3542'; c.font = 'bold 26px sans-serif'; c.textAlign = 'center'; c.fillText('⏻', b / 2, h / 2 + 9); });
  const an = bild(256, 160, (c, b, h) => {
    c.fillStyle = '#3fae3a'; c.fillRect(0, 0, b, h);
    for (let i = 0; i < 40; i++) { c.fillStyle = ['#4fc44a', '#2f8e2b', '#7a5a3a', '#9a7448'][i % 4]; c.fillRect((i * 37) % b, 80 + (i % 5) * 16, 30, 16); }
    c.fillStyle = '#fff'; c.font = 'bold 30px sans-serif'; c.textAlign = 'center'; c.fillText('MINI BLOCKS', b / 2, 50);
  });
  const schirm = new THREE.Mesh(new THREE.PlaneGeometry(1.36, 0.82), new THREE.MeshStandardMaterial({ map: aus, emissive: '#ffffff', emissiveMap: aus, emissiveIntensity: 0.6, roughness: 0.3 }));
  schirm.position.set(0, 1.75, -0.305);
  g.add(schirm);
  g.userData.anschalten = () => {
    schirm.material.map = schirm.material.emissiveMap = an;
    schirm.material.emissiveIntensity = 1;
    schirm.material.needsUpdate = true;
  };
  // Tastatur, Maus und ein kleiner Globus
  g.add(kiste(0.9, 0.04, 0.3, mat('#2b2f34'), 0, 1.01, 0.15));
  g.add(kiste(0.1, 0.04, 0.16, mat('#2b2f34'), 0.65, 1.01, 0.18));
  const globus = new THREE.Mesh(new THREE.SphereGeometry(0.2, 20, 14), mat('#3f84c9', { roughness: 0.4 }));
  globus.position.set(-0.95, 1.33, -0.1);
  g.add(globus, kiste(0.06, 0.18, 0.06, metall, -0.95, 1.07, -0.1));
  // Stuhl
  const stuhl = new THREE.Group();
  stuhl.add(kiste(0.6, 0.1, 0.6, mat('#d2452f'), 0, 0.55, 0, 0.05), kiste(0.6, 0.65, 0.1, mat('#d2452f'), 0, 0.95, 0.28, 0.05), kiste(0.08, 0.5, 0.08, metall, 0, 0.27, 0));
  stuhl.position.z = 0.95;
  g.add(stuhl);
  return g;
}

function baueLaborTisch() {
  const g = new THREE.Group();
  g.add(kiste(3.6, 0.1, 1.0, mat('#e9edf0', { roughness: 0.3 }), 0, 0.95, 0));
  g.add(kiste(3.4, 0.85, 0.9, mat('#8aa3b5'), 0, 0.45, 0));
  // Glaskolben mit leuchtenden Flüssigkeiten
  const glas = new THREE.MeshStandardMaterial({ color: '#dff3ff', roughness: 0.05, transparent: true, opacity: 0.35 });
  const farben = ['#3ad17a', '#ff6bb5', '#5ab8ff', '#ffd23f', '#a46bff'];
  farben.forEach((f, i) => {
    const x = -1.4 + i * 0.7;
    const kolben = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [0.18, 0.02], [0.2, 0.15], [0.07, 0.38], [0.06, 0.55], [0.07, 0.56]].map(([r, y]) => new THREE.Vector2(r, y)), 18), glas);
    kolben.position.set(x, 1.0, 0.05 * (i % 2));
    const saft = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 10, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.55), new THREE.MeshStandardMaterial({ color: f, emissive: f, emissiveIntensity: 0.7 }));
    saft.position.set(x, 1.17, 0.05 * (i % 2));
    g.add(kolben, saft);
  });
  // Ein Mikroskop
  const metall = mat('#5d6670', { metalness: 0.7, roughness: 0.3 });
  g.add(kiste(0.35, 0.06, 0.35, metall, 1.55, 1.03, 0), kiste(0.08, 0.5, 0.08, metall, 1.55, 1.3, -0.1), kiste(0.1, 0.35, 0.1, mat('#e9edf0'), 1.55, 1.45, 0.02));
  return g;
}

function baueRegal() {
  const g = new THREE.Group();
  const holz = mat('#a8794c', { map: textur('bretter.jpg') });
  g.add(kiste(2.4, 2.4, 0.1, holz, 0, 1.2, -0.25));
  for (const x of [-1.15, 1.15]) g.add(kiste(0.1, 2.4, 0.55, holz, x, 1.2, 0));
  const farben = ['#c0392b', '#2e86c1', '#27ae60', '#f39c12', '#8e44ad', '#16a085', '#d35400', '#34495e'];
  const buecher = [];
  for (const y of [0.1, 0.85, 1.6]) {
    g.add(kiste(2.25, 0.06, 0.5, holz, 0, y, 0));
    let x = -1.05;
    while (x < 1.0) {
      const b = 0.07 + Math.random() * 0.06, h = 0.42 + Math.random() * 0.2;
      buecher.push({ x: x + b / 2, y: y + 0.03 + h / 2, b, h, f: farben[buecher.length % farben.length] });
      x += b + 0.01;
    }
  }
  const buch = new THREE.InstancedMesh(new RoundedBoxGeometry(1, 1, 0.38, 1, 0.01), mat('#ffffff'), buecher.length);
  const m = new THREE.Matrix4();
  buecher.forEach((b, i) => {
    buch.setMatrixAt(i, m.compose(new THREE.Vector3(b.x, b.y, 0), new THREE.Quaternion(), new THREE.Vector3(b.b, b.h, 1)));
    buch.setColorAt(i, new THREE.Color(b.f));
  });
  g.add(buch);
  return g;
}

function baueFernrohr() {
  const g = new THREE.Group();
  const messing = mat('#c9a24a', { metalness: 0.8, roughness: 0.3 });
  for (let i = 0; i < 3; i++) {
    const bein = kiste(0.05, 1.3, 0.05, mat('#3a3f45'), Math.sin(i * 2.1) * 0.3, 0.62, Math.cos(i * 2.1) * 0.3);
    bein.rotation.set(Math.cos(i * 2.1) * 0.25, 0, -Math.sin(i * 2.1) * 0.25);
    g.add(bein);
  }
  const rohr = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.14, 1.5, 16), messing);
  rohr.rotation.x = Math.PI / 2 - 0.35; // schaut schräg nach draußen
  rohr.position.set(0, 1.45, -0.2);
  g.add(rohr);
  return g;
}

function baueTafel() {
  return bild(512, 320, (c, b, h) => {
    c.fillStyle = '#f7f7f2'; c.fillRect(0, 0, b, h);
    c.strokeStyle = '#9aa1a8'; c.lineWidth = 10; c.strokeRect(5, 5, b - 10, h - 10);
    c.fillStyle = '#c0392b'; c.font = 'bold 44px sans-serif'; c.fillText('INSADORIUM ?', 30, 70);
    // Ein roter Kristall (gemalt – niemand hat ihn je gesehen)
    c.fillStyle = 'rgba(220,40,40,0.85)';
    c.beginPath(); c.moveTo(390, 110); c.lineTo(440, 170); c.lineTo(410, 260); c.lineTo(360, 260); c.lineTo(340, 170); c.closePath(); c.fill();
    c.strokeStyle = '#7a1010'; c.lineWidth = 4; c.stroke();
    c.fillStyle = '#2c3e50'; c.font = 'bold 30px sans-serif';
    c.fillText('MINI BLOCKS = Sucht 🚫', 30, 140);
    c.fillText('Heilmittel?  →', 30, 195);
    c.fillStyle = '#2e86c1'; c.fillText('Heute: Tipp im Chat!', 30, 265);
  });
}

function baueWeltkarte() {
  return bild(512, 300, (c, b, h) => {
    c.fillStyle = '#5b9bd5'; c.fillRect(0, 0, b, h);
    c.fillStyle = '#c9b77c';
    for (const [x, y, rx, ry] of [[110, 90, 70, 45], [150, 200, 40, 70], [270, 80, 60, 40], [300, 190, 45, 65], [420, 100, 70, 50], [440, 230, 35, 25]]) {
      c.beginPath(); c.ellipse(x, y, rx, ry, 0.3, 0, Math.PI * 2); c.fill();
    }
    c.strokeStyle = '#b22'; c.lineWidth = 5; c.setLineDash([10, 8]);
    c.beginPath(); c.moveTo(270, 70); c.quadraticCurveTo(220, 200, 205, 268); c.stroke();
    c.setLineDash([]);
    c.fillStyle = '#b22'; c.font = 'bold 54px sans-serif'; c.fillText('?', 190, 290);
    c.strokeStyle = '#3d2b1f'; c.lineWidth = 12; c.strokeRect(0, 0, b, h);
  });
}

function baumImTopf() {
  const g = new THREE.Group();
  g.add(kiste(0.6, 0.55, 0.6, mat('#b5653b'), 0, 0.28, 0, 0.12));
  const blatt = mat('#3f8f3a', { roughness: 0.8 });
  for (let i = 0; i < 6; i++) {
    const k = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 9), blatt);
    k.position.set(Math.sin(i) * 0.25, 1.0 + (i % 3) * 0.3, Math.cos(i) * 0.25);
    g.add(k);
  }
  g.add(kiste(0.07, 0.8, 0.07, mat('#6e4a2c'), 0, 0.8, 0));
  return g;
}

// =============================================================
//  DAS LABOR BAUEN
//  w = Richtung der Aufzugstür (zeigt zum Eingang unten am Turm)
// =============================================================
export function baueLabor(eltern, w) {
  const labor = new THREE.Group();
  eltern.add(labor);
  // Fußboden und Decke (Ringe um den Aufzug herum)
  const ring = (y, oben, material) => {
    const geo = new THREE.RingGeometry(KERN - 0.1, AUSSEN + 1.1, 64, 1);
    geo.rotateX(oben ? -Math.PI / 2 : Math.PI / 2);
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 9, uv.getY(i) * 9);
    const m = new THREE.Mesh(geo, material);
    m.position.y = y;
    m.receiveShadow = true;
    labor.add(m);
  };
  ring(LABOR_Y, true, mat('#d9c7a8', { map: textur('planken.jpg'), roughness: 0.7 }));
  ring(LABOR_Y + LABOR_HOCH, false, mat('#f4f1ea', { emissive: '#fff4dd', emissiveIntensity: 0.35 }));
  // Der Aufzugs-Kern in der Mitte, mit Tür und Knopf
  const kern = new THREE.Mesh(new THREE.CylinderGeometry(KERN, KERN, LABOR_HOCH, 40, 1), mat('#eceae4', { emissive: '#ffffff', emissiveIntensity: 0.08 }));
  kern.position.y = LABOR_Y + LABOR_HOCH / 2;
  labor.add(kern);
  const tuer = kiste(1.7, 2.5, 0.2, mat('#aeb6bd', { metalness: 0.8, roughness: 0.25 }), 0, 1.25, 0);
  const knopf = kiste(0.18, 0.3, 0.06, mat('#ffd23f', { emissive: '#ffb300', emissiveIntensity: 0.8 }), 1.15, 1.2, 0.08);
  const tuerGruppe = new THREE.Group();
  tuerGruppe.add(tuer, knopf);
  labor.add(stelle(tuerGruppe, KERN + 0.05, w, false));
  // Fensterpfosten (die Fenster selbst sind die Glasscheiben vom Turm – von innen sieht man hindurch)
  const pfosten = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.07, 0.07, 1, 6), mat('#4b5258', { metalness: 0.6 }), 40);
  const m = new THREE.Matrix4(), hoch = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2;
    const unten = new THREE.Vector3(Math.sin(a) * 18.35, LABOR_Y - 0.1, Math.cos(a) * 18.35);
    const oben = new THREE.Vector3(Math.sin(a) * 19.25, LABOR_Y + LABOR_HOCH + 0.1, Math.cos(a) * 19.25);
    const r = oben.clone().sub(unten);
    pfosten.setMatrixAt(i, m.compose(unten.clone().add(oben).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(hoch, r.clone().normalize()), new THREE.Vector3(1, r.length(), 1)));
  }
  labor.add(pfosten);
  // Ein leicht bläulicher Schimmer auf den Scheiben (nur von innen sichtbar)
  const scheibe = new THREE.Mesh(
    new THREE.LatheGeometry([new THREE.Vector2(18.33, LABOR_Y - 0.1), new THREE.Vector2(19.23, LABOR_Y + LABOR_HOCH + 0.1)], 48),
    new THREE.MeshBasicMaterial({ color: '#bfe3ff', transparent: true, opacity: 0.08, side: THREE.BackSide, depthWrite: false })
  );
  labor.add(scheibe);

  // Die Möbel – rund um den Aufzug verteilt
  const hindernisse = []; // { x, z, r } – da kann man nicht durchlaufen
  const plaziere = (ding, r, a, zurMitte, kreise) => {
    labor.add(stelle(ding, r, w + a, zurMitte));
    for (const [rr, da, gross] of kreise) {
      const p = polar(rr, w + a + da);
      hindernisse.push({ x: p.x, z: p.z, r: gross });
    }
  };
  const computer = baueComputerTisch();
  plaziere(computer, 15.6, 2.1, true, [[15.6, 0.05, 1.1], [15.6, -0.05, 1.1]]);
  plaziere(baueLaborTisch(), 16.0, 0.95, true, [[16.0, 0.08, 1.0], [16.0, -0.08, 1.0], [16.0, 0, 1.0]]);
  plaziere(baueRegal(), 16.6, -1.0, true, [[16.6, 0.05, 0.9], [16.6, -0.05, 0.9]]);
  plaziere(baueFernrohr(), 16.4, -2.3, true, [[16.4, 0, 0.6]]);
  plaziere(baumImTopf(), 16.6, 3.0, true, [[16.6, 0, 0.5]]);
  plaziere(baumImTopf(), 16.6, -0.35, true, [[16.6, 0, 0.5]]);
  // Tafel und Weltkarte hängen außen am Aufzugs-Kern
  const wandBild = (textur, b, h, a) => {
    const t = new THREE.Mesh(new THREE.PlaneGeometry(b, h), mat('#ffffff', { map: textur, roughness: 0.5 }));
    t.position.y = 1.9;
    const g = new THREE.Group();
    g.add(t);
    labor.add(stelle(g, KERN + 0.06, w + a, false));
  };
  wandBild(baueTafel(), 2.6, 1.6, 2.1 + Math.PI * 0.08);
  wandBild(baueWeltkarte(), 2.6, 1.5, -1.0);
  // Licht im Labor (die Turmkugel wirft sonst Schatten auf alles)
  const licht = new THREE.PointLight('#fff2dc', 60, 40, 1.2);
  licht.position.y = LABOR_Y + 3.8;
  labor.add(licht);
  labor.visible = false; // erst zeigen, wenn man oben ist

  // ---------- Der gläserne Aufzug außen am Turm ----------
  const kabine = new THREE.Group();
  const rahmen = mat('#d9dde1', { metalness: 0.7, roughness: 0.3 });
  kabine.add(kiste(2.6, 0.2, 2.6, rahmen, 0, -0.1, 0), kiste(2.6, 0.2, 2.6, rahmen, 0, 3.0, 0));
  for (const [x, z] of [[-1.25, -1.25], [1.25, -1.25], [-1.25, 1.25], [1.25, 1.25]]) kabine.add(kiste(0.12, 3.0, 0.12, rahmen, x, 1.45, z));
  const glas = new THREE.Mesh(new RoundedBoxGeometry(2.5, 2.9, 2.5, 2, 0.1), new THREE.MeshStandardMaterial({ color: '#cfe9ff', transparent: true, opacity: 0.18, roughness: 0.05, metalness: 0.3, depthWrite: false }));
  glas.position.y = 1.45;
  kabine.add(glas);
  // Die Schiene, an der der Aufzug hochfährt
  const schiene = new THREE.Mesh(
    new THREE.LatheGeometry(SCHAFT.map(([h, r]) => new THREE.Vector2(r + 0.15, h + BODEN)), 3, w - 0.06, 0.12),
    mat('#9aa3ab', { metalness: 0.6, side: THREE.DoubleSide })
  );
  eltern.add(schiene, kabine);

  const auf = polar(KERN + 1.8, w);
  const amTisch = polar(13.4, w + 2.1);
  return {
    labor,
    kabine,
    hindernisse,
    computer,
    ankunft: auf, // hier steht man, wenn man oben aus dem Aufzug kommt
    aufzugTuer: auf,
    computerPlatz: amTisch,
  };
}

// Bodenhöhe im Labor: auf dem Ring kann man laufen – Aufzug und Fenster sind Wände
export function laborHoehe(lx, lz) {
  const r = Math.hypot(lx, lz);
  return r > KERN + 0.7 && r < AUSSEN - 0.7 ? LABOR_Y : LABOR_Y + 60;
}

// Die Kamera muss im Labor drinnen bleiben (nicht durch Wand oder Decke)
export function kameraImLabor(v, mitte) {
  const lx = v.x - mitte.x, lz = v.z - mitte.z;
  const r = Math.hypot(lx, lz) || 1;
  const neu = Math.min(AUSSEN - 1.2, Math.max(KERN + 1.2, r));
  v.x = mitte.x + (lx / r) * neu;
  v.z = mitte.z + (lz / r) * neu;
  v.y = Math.min(LABOR_Y + LABOR_HOCH - 0.4, Math.max(LABOR_Y + 1.2, v.y));
}

