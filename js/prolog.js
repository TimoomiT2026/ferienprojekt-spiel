// =============================================================
//  DER PROLOG 🏙️ – Düsseldorf am Rheinturm (nur für ganz neue Spieler!)
//  Bevor es auf die Insel geht, beginnt alles in Düsseldorf:
//   1. Du läufst am Rhein entlang zum Rheinturm.
//   2. Ganz oben in der Turmkugel ist dein geheimes Forschungslabor.
//      Am Computer kommt eine geheime Chat-Nachricht …
//   3. Du läufst zum Ruderboot im Yachthafen und legst ab.
//   4. Film: „2 Wochen später“ – ein Sturm auf dem Ozean (sturmfilm.js),
//      dann „8 Wochen später“ – und das Spiel beginnt auf der Insel.
//  Die Stadt wird nur gebaut, solange der Prolog läuft.
//  Kartendaten: © OpenStreetMap-Mitwirkende (siehe daten/duesseldorf.js)
// =============================================================
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { DUESSELDORF } from './daten/duesseldorf.js';
import { setzeStadt } from './gelaende.js';
import { baueBoot, baueHolzTextur } from './boote.js';
import { knopf } from './steuerung.js';
import { EINSTELLUNGEN } from './einstellungen.js';
import { Sturmfilm } from './sturmfilm.js';

const E = () => EINSTELLUNGEN.prolog;
// Die Stadt liegt weit weg von den Inseln (dort fährt man nie mit dem Boot hin)
export const STADT = { x: 0, z: 6000 };
const HALB = 700; // die Stadt ist 1,4 km groß
const PIXEL = 2; // 1 Pixel im Stadtplan = 2 Meter
const N = (HALB * 2) / PIXEL;
const BODEN = 1.6; // so hoch liegen Straßen und Plätze
const RHEIN = -6; // so tief ist der Rhein

// ---------- Hat dieser Spieler den Prolog schon gesehen? ----------
const GESEHEN = 'inselspiel-prolog-gesehen';
const DIREKT = 'inselspiel-direktstart';
export function prologGesehen() {
  try { return localStorage.getItem(GESEHEN) === '1'; } catch { return true; }
}
export function prologVergessen() {
  try { localStorage.removeItem(GESEHEN); } catch {}
}
// Nach dem Film lädt das Spiel neu und soll gleich ohne Startbildschirm weitergehen
export function direktStart() {
  try {
    const ja = sessionStorage.getItem(DIREKT) === '1';
    sessionStorage.removeItem(DIREKT);
    return ja;
  } catch { return false; }
}
function aufZurInsel() {
  try {
    localStorage.setItem(GESEHEN, '1');
    sessionStorage.setItem(DIREKT, '1');
  } catch {}
  location.reload(); // frisch auf der Insel anfangen – wie bisher, mit dem Tagebuch
}

// ---------- Der Stadtplan als Bild: Rot = Wasser, Grün = Haushöhe, Blau = Straße ----------
function maleStadtplan() {
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d');
  g.fillStyle = 'rgb(0,0,0)';
  g.fillRect(0, 0, N, N);
  const P = ([x, z]) => [(x + HALB) / PIXEL, (z + HALB) / PIXEL];
  const linie = (pts) => { g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(...P(p)) : g.moveTo(...P(p)))); };
  g.strokeStyle = 'rgb(0,0,255)';
  g.lineCap = g.lineJoin = 'round';
  for (const w of DUESSELDORF.wege) {
    g.lineWidth = w.b / PIXEL;
    linie(w.p);
    g.stroke();
  }
  g.fillStyle = 'rgb(255,0,0)';
  for (const w of DUESSELDORF.wasser) { linie(w); g.closePath(); g.fill(); }
  for (const h of DUESSELDORF.haeuser) {
    if (h.m > 2) continue; // schwebende Teile (z. B. Vordächer) – darunter kann man laufen
    g.fillStyle = `rgb(0,${Math.min(250, Math.round(h.h))},0)`;
    linie(h.p); g.closePath(); g.fill();
  }
  g.fillStyle = 'rgb(0,250,0)';
  linie(DUESSELDORF.turm); g.closePath(); g.fill();
  return g.getImageData(0, 0, N, N).data;
}

export class Prolog {
  constructor(szene, spiel) {
    this.szene = szene;
    this.spiel = spiel; // { spieler, meldung, musik, objekte, elternElement, teleport }
    this.aktiv = false;
    this.film = null;
    this.schritt = '';
  }

  // ---------- Was ist an dieser Stelle? ----------
  feld(x, z) {
    const i = Math.floor((x - STADT.x + HALB) / PIXEL), j = Math.floor((z - STADT.z + HALB) / PIXEL);
    if (i < 0 || j < 0 || i >= N || j >= N) return { wasser: true, haus: 0, weg: false };
    const k = (j * N + i) * 4, d = this.plan;
    return { wasser: d[k] > 127, haus: d[k] > 127 ? 0 : d[k + 1] > 20 ? d[k + 1] : 0, weg: d[k + 2] > 100 };
  }
  hoehe(x, z) {
    const f = this.feld(x, z);
    return f.wasser ? RHEIN : BODEN + f.haus;
  }
  frei(x, z) {
    const f = this.feld(x, z);
    return !f.wasser && !f.haus;
  }
  // Der nächste freie Platz (kein Wasser, kein Haus) bei (x, z) – lokal in Metern ab dem Rheinturm
  naechsterFreierPlatz(x, z) {
    for (let r = 0; r < 120; r += 2) {
      for (let a = 0; a < 16; a++) {
        const px = x + Math.cos(a / 16 * Math.PI * 2) * r, pz = z + Math.sin(a / 16 * Math.PI * 2) * r;
        if (this.frei(STADT.x + px, STADT.z + pz) && this.frei(STADT.x + px + 2, STADT.z + pz) && this.frei(STADT.x + px - 2, STADT.z + pz) &&
          this.frei(STADT.x + px, STADT.z + pz + 2) && this.frei(STADT.x + px, STADT.z + pz - 2)) return { x: px, z: pz };
      }
    }
    return { x, z };
  }

  // ---------- Los geht's! ----------
  starten() {
    this.aktiv = true;
    this.plan = maleStadtplan();
    setzeStadt({ ...STADT, halb: HALB, hoehe: (x, z) => this.hoehe(x, z) });
    this.baueStadt();
    this.baueZiele();
    this.baueHud();
    document.body.classList.add('prolog');
    if (this.szene.fog) this.szene.fog.far = 900; // in der Stadt sieht man weiter
    const s = this.start;
    this.spiel.teleport(STADT.x + s.x, STADT.z + s.z, Math.atan2(s.x, s.z));
    this.zeigeKarte(`<h2>Düsseldorf, am Rhein</h2>
      <p>Hier arbeitest du als <b>Forscher</b>! 🔬</p>
      <p>Ganz oben im <b>Rheinturm</b> 🗼 hast du ein <b>geheimes Labor</b>. Niemand weiß davon.</p>
      <p class="prolog-quelle">Stadtplan: © OpenStreetMap-Mitwirkende</p>`, 'Los! 👟', () => this.setzeSchritt('turm'));
  }

  setzeSchritt(s) {
    this.schritt = s;
    const ziele = { turm: '🗼 Geh zum Rheinturm', boot: '🚣 Lauf zum Ruderboot im Yachthafen' };
    this.zielAnzeige.innerHTML = `<span>${ziele[s] || ''}</span>`;
    this.zielAnzeige.style.display = ziele[s] ? '' : 'none';
    this.markerTurm.visible = s === 'turm';
    this.markerBoot.visible = s === 'boot';
  }

  // ---------- Die Stadt bauen ----------
  baueStadt() {
    const gruppe = new THREE.Group();
    gruppe.position.set(STADT.x, 0, STADT.z);
    this.gruppe = gruppe;

    // Der Boden: Plätze, Straßen, Rheinwiesen – und das Flussbett
    const seg = HALB * 2 / 4;
    const boden = new THREE.PlaneGeometry(HALB * 2, HALB * 2, seg, seg);
    boden.rotateX(-Math.PI / 2);
    const pos = boden.attributes.position, farben = new Float32Array(pos.count * 3);
    const pflaster = new THREE.Color('#a8998a'), strasse = new THREE.Color('#77736f'), wiese = new THREE.Color('#5f9e3e'), grund = new THREE.Color('#4a5848');
    for (let i = 0; i < pos.count; i++) {
      const x = STADT.x + pos.getX(i), z = STADT.z + pos.getZ(i);
      const f = this.feld(x, z);
      pos.setY(i, f.wasser ? RHEIN : BODEN - 0.02);
      // Nah am Rhein ist Wiese (die Rheinwiesen), sonst Pflaster
      let nahAmWasser = false;
      if (!f.wasser) for (const [dx, dz] of [[30, 0], [-30, 0], [0, 30], [0, -30], [20, 20], [-20, -20], [20, -20], [-20, 20]]) if (this.feld(x + dx, z + dz).wasser) nahAmWasser = true;
      const c = f.wasser ? grund : f.weg ? strasse : nahAmWasser ? wiese : pflaster;
      const fleck = 0.92 + 0.08 * Math.sin(x * 0.7) * Math.cos(z * 0.9); // ein bisschen fleckig, wie echter Boden
      farben.set([c.r * fleck, c.g * fleck, c.b * fleck], i * 3);
    }
    boden.setAttribute('color', new THREE.BufferAttribute(farben, 3));
    boden.computeVertexNormals();
    const bodenMesh = new THREE.Mesh(boden, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
    bodenMesh.receiveShadow = true;
    gruppe.add(bodenMesh);

    // Die Häuser: echte Umrisse, aber mit weichen, runden Kanten (nicht eckig!)
    const farbenListe = E().hausFarben.map((f) => new THREE.Color(f));
    const waende = [], daecher = [];
    DUESSELDORF.haeuser.forEach((h, n) => {
      const form = new THREE.Shape(h.p.map(([x, z]) => new THREE.Vector2(x, -z)));
      let geo;
      try {
        geo = new THREE.ExtrudeGeometry(form, { depth: Math.max(2, h.h - h.m - 0.8), bevelEnabled: true, bevelThickness: 0.8, bevelSize: 0.8, bevelSegments: 2, curveSegments: 1 });
      } catch { return; }
      geo.rotateX(-Math.PI / 2);
      geo.translate(0, BODEN + h.m, 0);
      const farbe = farbenListe[n % farbenListe.length];
      const dach = farbe.clone().lerp(new THREE.Color('#ffffff'), 0.35);
      teileInWaendeUndDaecher(geo, farbe, dach, waende, daecher);
    });
    const fenster = baueFensterTextur();
    fenster.repeat.set(1 / 4, 1 / 3.4); // alle 4 Meter ein Fenster, alle 3,4 Meter ein Stockwerk
    if (waende.length) gruppe.add(schatten(new THREE.Mesh(mergeGeometries(waende), new THREE.MeshStandardMaterial({ map: fenster, vertexColors: true, roughness: 0.85 }))));
    if (daecher.length) gruppe.add(schatten(new THREE.Mesh(mergeGeometries(daecher), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }))));

    // Bäume auf den Rheinwiesen: runde Kronen
    const plaetze = [];
    for (let x = -HALB + 20; x < HALB - 20; x += 22) {
      for (let z = -HALB + 20; z < HALB - 20; z += 22) {
        const wx = STADT.x + x + Math.sin(z) * 6, wz = STADT.z + z + Math.cos(x) * 6;
        const f = this.feld(wx, wz);
        if (f.wasser || f.haus || f.weg) continue;
        let nah = false;
        for (const [dx, dz] of [[26, 0], [-26, 0], [0, 26], [0, -26]]) if (this.feld(wx + dx, wz + dz).wasser) nah = true;
        if (nah && Math.hypot(x, z) > 30) plaetze.push([wx - STADT.x, wz - STADT.z]);
      }
    }
    const krone = new THREE.InstancedMesh(new THREE.SphereGeometry(3.2, 12, 9), new THREE.MeshStandardMaterial({ color: '#4f8f3c', roughness: 0.9 }), plaetze.length);
    const stamm = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.35, 0.5, 4, 8), new THREE.MeshStandardMaterial({ color: '#6e4a2c' }), plaetze.length);
    const m = new THREE.Matrix4();
    plaetze.forEach(([x, z], i) => {
      m.makeTranslation(x, BODEN + 2, z); stamm.setMatrixAt(i, m);
      m.makeTranslation(x, BODEN + 6, z); krone.setMatrixAt(i, m);
    });
    gruppe.add(schatten(krone), stamm);

    // Der Rheinturm 🗼 (gedrechselt – also schön rund)
    gruppe.add(baueRheinturm());
    this.szene.add(gruppe);

    // Wo fängt man an, wo ist die Tür, wo liegt das Boot?
    const [sx, sz] = E().start;
    this.start = this.naechsterFreierPlatz(sx, sz);
    // Die Tür: auf der Seite des Turms, die zum Startplatz zeigt
    const w = Math.atan2(this.start.x, this.start.z);
    this.tuer = this.naechsterFreierPlatz(Math.sin(w) * 17, Math.cos(w) * 17);
    this.boot = this.sucheBootsplatz(...E().boot);
    const { boot } = baueBoot(baueHolzTextur());
    boot.position.set(this.boot.wasser.x, 0, this.boot.wasser.z);
    boot.rotation.y = Math.atan2(this.boot.land.x - this.boot.wasser.x, this.boot.land.z - this.boot.wasser.z) + Math.PI / 2;
    gruppe.add(boot);
    this.bootModell = boot;
  }

  // Ein Platz im Wasser, direkt neben einem Steg/Ufer, an dem man stehen kann
  sucheBootsplatz(zx, zz) {
    let bestes = null, besterAbstand = Infinity;
    for (let x = zx - 80; x <= zx + 80; x += 2) {
      for (let z = zz - 80; z <= zz + 80; z += 2) {
        if (!this.feld(STADT.x + x, STADT.z + z).wasser) continue;
        for (const [dx, dz] of [[4, 0], [-4, 0], [0, 4], [0, -4]]) {
          const lx = x + dx, lz = z + dz;
          if (!this.frei(STADT.x + lx, STADT.z + lz) || !this.frei(STADT.x + lx + dx / 2, STADT.z + lz + dz / 2)) continue;
          const d = Math.hypot(x - zx, z - zz);
          if (d < besterAbstand) { besterAbstand = d; bestes = { wasser: { x: x - dx * 0.2, z: z - dz * 0.2 }, land: { x: lx + dx / 2, z: lz + dz / 2 } }; }
        }
      }
    }
    return bestes || { wasser: { x: zx, z: zz }, land: this.naechsterFreierPlatz(zx, zz) };
  }

  // ---------- Ziele: leuchtende Ringe und Knöpfe für den Aktions-Knopf ----------
  baueZiele() {
    const ring = () => {
      const g = new THREE.Group();
      const r = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.18, 10, 40), new THREE.MeshBasicMaterial({ color: '#ffd84a' }));
      r.rotation.x = Math.PI / 2;
      const pfeil = new THREE.Mesh(new THREE.ConeGeometry(0.8, 1.6, 16), new THREE.MeshBasicMaterial({ color: '#ffd84a' }));
      pfeil.rotation.x = Math.PI;
      pfeil.position.y = 4;
      g.add(r, pfeil);
      g.userData.pfeil = pfeil;
      return g;
    };
    this.markerTurm = ring();
    this.markerTurm.position.set(this.tuer.x, BODEN + 0.1, this.tuer.z);
    this.markerBoot = ring();
    this.markerBoot.position.set(this.boot.land.x, BODEN + 0.1, this.boot.land.z);
    this.gruppe.add(this.markerTurm, this.markerBoot);
    const welt = (p) => new THREE.Vector3(STADT.x + p.x, BODEN, STADT.z + p.z);
    this.interaktionen = [
      { pos: welt(this.tuer), radius: 5, bild: '🛗', text: 'Hochfahren', aktiv: () => this.aktiv && this.schritt === 'turm', ausfuehren: () => this.labor() },
      { pos: welt(this.boot.land), radius: 5, bild: '🚣', text: 'Losrudern', aktiv: () => this.aktiv && this.schritt === 'boot', ausfuehren: () => this.ablegen() },
    ];
    this.spiel.objekte.interaktionen.push(...this.interaktionen);
  }

  baueHud() {
    const e = this.spiel.elternElement;
    this.zielAnzeige = document.createElement('div');
    this.zielAnzeige.id = 'prolog-ziel';
    this.zielAnzeige.style.display = 'none'; // erst wenn es ein Ziel gibt
    e.appendChild(this.zielAnzeige);
    const weiter = document.createElement('button');
    weiter.id = 'prolog-ueberspringen';
    weiter.textContent = 'Überspringen ⏭';
    e.appendChild(weiter);
    knopf(weiter, () => {
      if (confirm('Den Anfang in Düsseldorf überspringen und gleich auf die Insel?')) aufZurInsel();
    });
    this.karte = document.createElement('div');
    this.karte.id = 'prolog-karte';
    e.appendChild(this.karte);
  }

  // Ein großes Erzähl-Fenster mit einem Knopf
  zeigeKarte(html, knopfText, weiter, extraKlasse = '') {
    this.karte.className = 'offen ' + extraKlasse;
    this.karte.innerHTML = `<div class="prolog-inhalt">${html}</div><div class="knopf-reihe"><button class="fenster-knopf gruen">${knopfText}</button></div>`;
    knopf(this.karte.querySelector('button'), () => {
      this.karte.className = '';
      weiter?.();
    });
  }
  get offen() {
    return this.karte?.classList.contains('offen');
  }

  // ---------- Das Labor oben in der Turmkugel ----------
  labor() {
    this.setzeSchritt('');
    this.spiel.musik?.pling?.();
    const raum = laborBild();
    this.zeigeKarte(`${raum}<h2>Dein geheimes Labor</h2>
      <p>Ganz oben in der Kugel des Rheinturms, 170 Meter über dem Rhein. 🔬</p>
      <p>Du erforschst ein großes Rätsel: Vor langer Zeit gab es ein Computerspiel namens <b>„Mini Blocks“</b>. Alle Menschen wurden süchtig danach – deshalb wurde es <b>für immer verbannt</b>.</p>
      <p>Aber die Kinder wollen es immer noch spielen. Es gibt nur ein Material, das die Sucht für immer beenden kann: das <b>Insadorium</b> 🔴. Doch <b>niemand</b> hat es je gesehen …</p>`,
      '💻 An den Computer', () => this.chat(), 'labor');
  }

  chat() {
    const nachrichten = E().chat;
    this.zeigeKarte(`<div class="computer"><div class="mini-blocks">${'<i></i>'.repeat(48)}<b>MINI BLOCKS</b></div><div class="chat"><div class="chat-kopf">💬 Geheimer Chat</div><div class="chat-liste"></div></div></div>`,
      '🧭 Reise planen', () => this.reiseplan(), 'labor');
    const liste = this.karte.querySelector('.chat-liste');
    const knopfEl = this.karte.querySelector('button');
    knopfEl.disabled = true;
    nachrichten.forEach((text, i) => setTimeout(() => {
      if (!this.karte.classList.contains('offen')) return;
      const zeile = document.createElement('div');
      zeile.className = i === nachrichten.length - 1 ? 'chat-ende' : 'chat-nachricht';
      zeile.innerHTML = text;
      liste.appendChild(zeile);
      liste.scrollTop = liste.scrollHeight;
      this.spiel.musik?.pling?.();
      if (i === nachrichten.length - 1) knopfEl.disabled = false;
    }, 900 + i * E().chatTempo));
  }

  reiseplan() {
    const punkte = E().reiseplan;
    this.zeigeKarte(`<h2>🧭 Die Reise planen</h2><ul class="reiseplan">${punkte.map((p) => `<li>${p}</li>`).join('')}</ul>`,
      'Los geht\'s! ⬇️', () => {
        this.setzeSchritt('boot');
        this.spiel.meldung('🚣 Schnell zum Ruderboot im Yachthafen – folge dem gelben Pfeil!', 6);
      }, 'labor');
    const knopfEl = this.karte.querySelector('button');
    knopfEl.disabled = true;
    this.karte.querySelectorAll('.reiseplan li').forEach((li, i) => setTimeout(() => {
      li.classList.add('erledigt');
      this.spiel.musik?.pling?.();
      if (i === punkte.length - 1) knopfEl.disabled = false;
    }, 600 + i * 650));
  }

  // ---------- Ablegen – und der Film beginnt ----------
  ablegen() {
    this.setzeSchritt('');
    this.film = new Sturmfilm(this.spiel.elternElement, this.spiel.musik, () => aufZurInsel());
    document.body.classList.add('prolog-film');
  }

  aktualisiere(dt) {
    if (!this.aktiv) return;
    const t = performance.now() / 1000;
    for (const m of [this.markerTurm, this.markerBoot]) {
      if (!m.visible) continue;
      m.userData.pfeil.position.y = 4 + Math.sin(t * 3) * 0.5;
      m.rotation.y += dt;
    }
  }
}

// ---------- Kleine Helfer ----------
function schatten(mesh) {
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}

// Häuser in Wände (mit Fenstern) und Dächer (ohne) teilen – das sind dann nur 2 Bauteile für die ganze Stadt
function teileInWaendeUndDaecher(geo, wandFarbe, dachFarbe, waende, daecher) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv;
  const teile = { wand: { p: [], n: [], u: [], c: [] }, dach: { p: [], n: [], u: [], c: [] } };
  for (let t = 0; t < pos.count; t += 3) {
    const oben = (nor.getY(t) + nor.getY(t + 1) + nor.getY(t + 2)) / 3 > 0.6;
    const ziel = teile[oben ? 'dach' : 'wand'], c = oben ? dachFarbe : wandFarbe;
    for (let k = t; k < t + 3; k++) {
      ziel.p.push(pos.getX(k), pos.getY(k), pos.getZ(k));
      ziel.n.push(nor.getX(k), nor.getY(k), nor.getZ(k));
      ziel.u.push(uv.getX(k), uv.getY(k));
      ziel.c.push(c.r, c.g, c.b);
    }
  }
  for (const [name, liste] of [['wand', waende], ['dach', daecher]]) {
    const t = teile[name];
    if (!t.p.length) continue;
    const b = new THREE.BufferGeometry();
    b.setAttribute('position', new THREE.Float32BufferAttribute(t.p, 3));
    b.setAttribute('normal', new THREE.Float32BufferAttribute(t.n, 3));
    b.setAttribute('uv', new THREE.Float32BufferAttribute(t.u, 2));
    b.setAttribute('color', new THREE.Float32BufferAttribute(t.c, 3));
    liste.push(b);
  }
}

// Ein Stück Hauswand mit einem Fenster (wird über die Wände gekachelt)
function baueFensterTextur() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#7f98b5';
  g.beginPath();
  g.roundRect(18, 16, 28, 30, 6);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.45)';
  g.fillRect(22, 20, 8, 10);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// Der Rheinturm: Schaft, Kugel (die Kanzel mit den schrägen Fenstern), Antenne – und die Lichtzeituhr
function baueRheinturm() {
  const turm = new THREE.Group();
  const V2 = (r, y) => new THREE.Vector2(r, y + BODEN);
  const beton = new THREE.MeshStandardMaterial({ color: '#e6e3dc', roughness: 0.8 });
  const glas = new THREE.MeshStandardMaterial({ color: '#2d4a66', roughness: 0.25, metalness: 0.4 });
  const schaft = new THREE.LatheGeometry([V2(0, 0), V2(13.5, 0), V2(12, 4), V2(9.2, 20), V2(7.8, 60), V2(6.8, 120), V2(6, 163), V2(0, 163)], 40);
  const kugelUnten = new THREE.LatheGeometry([V2(5.9, 163), V2(13, 167), V2(16.5, 171), V2(0, 171)], 40);
  const fenster = new THREE.LatheGeometry([V2(16.5, 171), V2(17, 174), V2(15, 178.5), V2(0, 178.5)], 40);
  const kugelOben = new THREE.LatheGeometry([V2(15, 178.5), V2(11, 181.5), V2(7, 184), V2(3, 185), V2(0, 185)], 40);
  const antenne = new THREE.LatheGeometry([V2(2.4, 185), V2(1.7, 200), V2(1.1, 225), V2(0.5, 236), V2(0, 240.5)], 16);
  for (const [geo, mat] of [[schaft, beton], [kugelUnten, beton], [fenster, glas], [kugelOben, beton], [antenne, beton]]) turm.add(schatten(new THREE.Mesh(geo, mat)));
  const spitze = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.75, 6, 12), new THREE.MeshStandardMaterial({ color: '#d23a2c' }));
  spitze.position.y = BODEN + 230;
  turm.add(spitze);
  // Die Lichtzeituhr: viele runde Lichter am Schaft (die echte zeigt die Uhrzeit!)
  const n = 39;
  const lichter = new THREE.InstancedMesh(new THREE.SphereGeometry(0.55, 10, 8), new THREE.MeshStandardMaterial({ color: '#ffe9a8', emissive: '#ffcc55', emissiveIntensity: 1.4 }), n);
  const m = new THREE.Matrix4();
  for (let i = 0; i < n; i++) {
    const y = 40 + i * 3.1;
    const r = THREE.MathUtils.lerp(7.8, 6.1, (y - 60) / 103) + 0.1;
    m.makeTranslation(Math.sin(0.6) * r, BODEN + y, Math.cos(0.6) * r);
    lichter.setMatrixAt(i, m);
  }
  turm.add(lichter);
  return turm;
}

// Das Labor als Bild: runder Raum, schräge Fenster, draußen der Rhein
function laborBild() {
  return `<svg class="labor-bild" viewBox="0 0 400 150" aria-hidden="true">
    <defs><linearGradient id="himmelL" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fc9f0"/><stop offset="1" stop-color="#d9efff"/></linearGradient></defs>
    <rect width="400" height="150" rx="16" fill="#3a4656"/>
    ${[20, 110, 200, 290].map((x) => `<path d="M${x} 18 L${x + 90} 18 L${x + 80} 92 L${x + 10} 92 Z" fill="url(#himmelL)" stroke="#2a3340" stroke-width="5"/>
      <path d="M${x + 10} 80 Q${x + 45} 70 ${x + 80} 82 L${x + 80} 92 L${x + 10} 92 Z" fill="#4f86b8"/>
      <rect x="${x + 25}" y="66" width="8" height="14" fill="#c9bfae"/><rect x="${x + 55}" y="60" width="10" height="20" fill="#b7aa96"/>`).join('')}
    <rect x="0" y="100" width="400" height="50" fill="#56483a"/>
    <rect x="130" y="104" width="140" height="10" rx="4" fill="#8a6a46"/>
    <rect x="170" y="64" width="60" height="40" rx="5" fill="#1d2430" stroke="#9aa6b5" stroke-width="3"/>
    <rect x="176" y="70" width="48" height="28" rx="2" fill="#3fae3a"/>
    <rect x="196" y="104" width="8" height="6" fill="#9aa6b5"/>
    <circle cx="300" cy="96" r="9" fill="#ff5a3a" opacity="0.9"/><rect x="292" y="104" width="16" height="10" rx="3" fill="#cfd6df"/>
    <rect x="90" y="86" width="22" height="18" rx="4" fill="#e9e2d0"/><circle cx="101" cy="83" r="6" fill="#7fd2ff" opacity="0.85"/>
  </svg>`;
}
