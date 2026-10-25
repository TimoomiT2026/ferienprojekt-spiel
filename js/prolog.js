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
import { setzeStadt } from './gelaende.js';
import { baueBoot, baueHolzTextur } from './boote.js';
import { knopf } from './steuerung.js';
import { EINSTELLUNGEN } from './einstellungen.js';
import { Sturmfilm } from './sturmfilm.js';
import { STADT, HALB, BODEN, Stadtplan, baueDuesseldorf } from './stadtbau.js';

export { STADT };
const E = () => EINSTELLUNGEN.prolog;

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

export class Prolog {
  constructor(szene, spiel) {
    this.szene = szene;
    this.spiel = spiel; // { spieler, meldung, musik, objekte, elternElement, teleport }
    this.aktiv = false;
    this.film = null;
    this.schritt = '';
  }

  // ---------- Was ist an dieser Stelle? (x, z = echte Weltkoordinaten) ----------
  feld(x, z) {
    return this.plan.feld(x - STADT.x, z - STADT.z);
  }
  hoehe(x, z) {
    return this.plan.hoehe(x - STADT.x, z - STADT.z);
  }
  frei(x, z) {
    return this.plan.frei(x - STADT.x, z - STADT.z);
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
    this.plan = new Stadtplan();
    setzeStadt({ ...STADT, halb: HALB, hoehe: (x, z) => this.hoehe(x, z) });
    this.baueStadt();
    this.baueZiele();
    this.baueHud();
    document.body.classList.add('prolog');
    if (this.szene.fog) { this.szene.fog.near = 150; this.szene.fog.far = E().sichtweite; } // in der Stadt sieht man weiter
    this.spiel.wasser?.setzeFluss(true); // das Wasser ist hier der Rhein, kein Meer
    const s = this.start;
    this.spiel.teleport(STADT.x + s.x, STADT.z + s.z, Math.atan2(s.x, s.z), 0.12); // Blick hoch zum Rheinturm
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

  // ---------- Die Stadt bauen (das meiste macht stadtbau.js) ----------
  baueStadt() {
    // Wo fängt man an, wo ist die Tür, wo liegt das Boot?
    const [sx, sz] = E().start;
    this.start = this.naechsterFreierPlatz(sx, sz);
    // Die Tür: auf der Seite des Turms, die zum Startplatz zeigt
    const w = Math.atan2(this.start.x, this.start.z);
    this.tuer = this.naechsterFreierPlatz(Math.sin(w) * 21, Math.cos(w) * 21);
    this.boot = this.sucheBootsplatz(...E().boot);
    const weitWegVomBoot = (x, z) => Math.hypot(x - this.boot.wasser.x, z - this.boot.wasser.z) > 9;
    this.stadt = baueDuesseldorf(this.szene, this.plan, { hindernisse: this.spiel.hindernisse, frei: weitWegVomBoot, tuerWinkel: w });
    this.gruppe = this.stadt.gruppe;
    const { boot } = baueBoot(baueHolzTextur());
    boot.position.set(this.boot.wasser.x, 0, this.boot.wasser.z);
    boot.rotation.y = Math.atan2(this.boot.land.x - this.boot.wasser.x, this.boot.land.z - this.boot.wasser.z) + Math.PI / 2;
    this.gruppe.add(boot);
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
    // Wischen im Fenster = scrollen (nicht die Spielsteuerung) – wie bei allen anderen Fenstern
    this.karte.addEventListener('touchstart', (ev) => ev.stopPropagation());
    this.karte.addEventListener('touchmove', (ev) => ev.stopPropagation());
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
    this.stadt?.aktualisiere(dt); // Schiffe und Autos fahren
    const t = performance.now() / 1000;
    for (const m of [this.markerTurm, this.markerBoot]) {
      if (!m.visible) continue;
      m.userData.pfeil.position.y = 4 + Math.sin(t * 3) * 0.5;
      m.rotation.y += dt;
    }
  }
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
