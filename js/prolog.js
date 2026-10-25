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
import { baueLabor, laborHoehe, kameraImLabor, schaftRadius, polar, LABOR_Y, AUFZUG_OBEN } from './labor.js';

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
    if (this.imLabor) return laborHoehe(x - STADT.x, z - STADT.z); // oben im Turm
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
    const ziele = { turm: '🗼 Geh zum Rheinturm', computer: '💻 Geh zum Computer', runter: '🛗 Fahr mit dem Aufzug wieder runter', boot: '🚣 Lauf zum Ruderboot im Yachthafen' };
    this.zielAnzeige.innerHTML = `<span>${ziele[s] || ''}</span>`;
    this.zielAnzeige.style.display = ziele[s] ? '' : 'none';
    this.markerTurm.visible = s === 'turm';
    this.markerBoot.visible = s === 'boot';
    this.markerComputer.visible = s === 'computer';
    this.markerAufzug.visible = s === 'runter';
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
    this.tuerWinkel = w;
    this.lab = baueLabor(this.gruppe, w); // das Labor oben in der Kugel + der Glas-Aufzug
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
    this.markerComputer = ring();
    this.markerComputer.position.set(this.lab.computerPlatz.x, LABOR_Y + 0.05, this.lab.computerPlatz.z);
    this.markerComputer.scale.setScalar(0.6);
    this.markerAufzug = ring();
    this.markerAufzug.position.set(this.lab.aufzugTuer.x, LABOR_Y + 0.05, this.lab.aufzugTuer.z);
    this.markerAufzug.scale.setScalar(0.6);
    this.gruppe.add(this.markerTurm, this.markerBoot, this.markerComputer, this.markerAufzug);
    const welt = (p) => new THREE.Vector3(STADT.x + p.x, BODEN, STADT.z + p.z);
    this.interaktionen = [
      { pos: welt(this.tuer), radius: 5, bild: '🛗', text: 'Hochfahren', aktiv: () => this.aktiv && this.schritt === 'turm', ausfuehren: () => this.hochfahren() },
      { pos: welt(this.lab.computerPlatz), radius: 3, bild: '💻', text: 'Forschen', aktiv: () => this.imLabor && this.schritt === 'computer', ausfuehren: () => this.forschen() },
      { pos: welt(this.lab.aufzugTuer), radius: 3, bild: '🛗', text: 'Runterfahren', aktiv: () => this.imLabor && this.schritt === 'runter', ausfuehren: () => this.runterfahren() },
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
    // Weiß aufblenden, wenn der Aufzug oben ankommt
    this.blende = document.createElement('div');
    this.blende.id = 'prolog-blende';
    e.appendChild(this.blende);
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
    return this.karte?.classList.contains('offen') || !!this.ablauf; // im Aufzug kann man nicht laufen
  }
  // Im Labor ist es eng: die Kamera kommt näher
  get kameraAbstandFaktor() {
    return this.imLabor ? 0.55 : 1;
  }
  kameraKlemmen(v) {
    if (this.imLabor) return kameraImLabor(v, STADT);
    if (!this.aktiv) return;
    // Nie in den Turm-Schaft hinein (z. B. wenn der Aufzug außen hochfährt)
    const lx = v.x - STADT.x, lz = v.z - STADT.z, r = Math.hypot(lx, lz);
    if (r < 14 && r > 0.01 && v.y < BODEN + 156) {
      v.x = STADT.x + (lx / r) * 14;
      v.z = STADT.z + (lz / r) * 14;
    }
  }

  // ---------- Kleine Abläufe (Aufzug fahren, Blenden) – Schritt für Schritt ----------
  spiele(schritte) {
    this.ablauf = { schritte, i: 0, zeit: 0 };
  }
  weiterSpielen(dt) {
    const a = this.ablauf;
    const s = a.schritte[a.i];
    a.zeit += dt;
    const f = Math.min(1, a.zeit / s.dauer);
    s.tue?.(f);
    if (f >= 1) {
      a.i++;
      a.zeit = 0;
      if (a.i >= a.schritte.length) this.ablauf = null;
    }
  }
  setzeBlende(staerke) {
    this.blende.style.opacity = String(staerke);
  }
  // Den Glas-Aufzug (und dich darin) auf Höhe y stellen – außen am Turm entlang
  aufzugBei(y) {
    const p = polar(schaftRadius(y) + 1.45, this.tuerWinkel);
    this.lab.kabine.position.set(p.x, y, p.z);
    this.spiel.spieler.figur.position.set(STADT.x + p.x, y, STADT.z + p.z);
  }

  // ---------- Mit dem Aufzug hoch ins Labor ----------
  hochfahren() {
    this.setzeSchritt('');
    const w = this.tuerWinkel, weich = (f) => f * f * (3 - 2 * f);
    this.spiel.musik?.pling?.();
    this.spiele([
      { dauer: 0.01, tue: () => {
        const p = polar(schaftRadius(BODEN) + 1.45, w);
        this.spiel.teleport(STADT.x + p.x, STADT.z + p.z, w + 0.5, 0.35); // Kamera außen, Blick auf dich und den Turm
        this.spiel.spieler.figur.rotation.y = w;
      } },
      { dauer: E().aufzugSekunden, tue: (f) => this.aufzugBei(BODEN + (AUFZUG_OBEN - BODEN) * weich(f)) },
      { dauer: 0.5, tue: (f) => this.setzeBlende(f) },
      { dauer: 0.01, tue: () => this.betreteLabor() },
      { dauer: 0.7, tue: (f) => this.setzeBlende(1 - f) },
      { dauer: 0.01, tue: () => {
        this.setzeSchritt('computer');
        this.spiel.musik?.pling?.();
        this.spiel.meldung('🔬 Dein geheimes Labor – 174 Meter über dem Rhein! Geh zum Computer.', 6);
      } },
    ]);
  }
  betreteLabor() {
    this.imLabor = true;
    this.lab.labor.visible = true;
    this.laborHindernisse = this.lab.hindernisse.map((h) => this.spiel.hindernisse?.hinzufuegen(STADT.x + h.x, STADT.z + h.z, h.r));
    const a = this.lab.ankunft;
    this.spiel.teleport(STADT.x + a.x, STADT.z + a.z, this.tuerWinkel + 1.2, 0.3);
  }
  verlasseLabor() {
    this.imLabor = false;
    this.lab.labor.visible = false;
    for (const h of this.laborHindernisse || []) if (h) this.spiel.hindernisse.entfernen(h);
    this.laborHindernisse = null;
  }

  // ---------- Mit dem Aufzug wieder runter ----------
  runterfahren() {
    this.setzeSchritt('');
    const w = this.tuerWinkel, weich = (f) => f * f * (3 - 2 * f);
    this.spiele([
      { dauer: 0.5, tue: (f) => this.setzeBlende(f) },
      { dauer: 0.01, tue: () => {
        this.verlasseLabor();
        const p = polar(schaftRadius(AUFZUG_OBEN) + 1.45, w);
        this.spiel.teleport(STADT.x + p.x, STADT.z + p.z, w + 0.5, 0.6);
        this.aufzugBei(AUFZUG_OBEN);
      } },
      { dauer: E().aufzugSekunden * 0.8, tue: (f) => {
        this.aufzugBei(AUFZUG_OBEN - (AUFZUG_OBEN - BODEN) * weich(f));
        this.setzeBlende(Math.max(0, 1 - f * 6));
      } },
      { dauer: 0.01, tue: () => {
        this.spiel.teleport(STADT.x + this.tuer.x, STADT.z + this.tuer.z, this.tuerWinkel, 0.3);
        this.setzeSchritt('boot');
        this.spiel.meldung('🚣 Schnell zum Ruderboot im Yachthafen – folge dem gelben Pfeil!', 6);
      } },
    ]);
  }

  // ---------- Oben im Labor: am Computer forschen ----------
  forschen() {
    this.setzeSchritt('');
    this.spiel.musik?.pling?.();
    this.zeigeKarte(`<h2>Deine Forschung 🔬</h2>
      <p>Vor langer Zeit gab es ein Computerspiel namens <b>„Mini Blocks“</b>. Alle Menschen wurden süchtig danach – deshalb wurde es <b>für immer verbannt</b>.</p>
      <p>Aber die Kinder wollen es immer noch spielen. Es gibt nur ein Material, das die Sucht für immer beenden kann: das <b>Insadorium</b> 🔴. Doch <b>niemand</b> hat es je gesehen …</p>
      <p>🔥 Du verfolgst gerade eine <b>heiße Spur</b>: Heute soll im Chat von Mini Blocks ein <b>anonymer Tipp</b> eingehen – <b>wo man das Insadorium finden kann!</b></p>
      <p>Mach den Computer an und logg dich als Forscher bei Mini Blocks ein. 🕵️</p>`,
      '💻 Computer anmachen', () => this.computerAn(), 'labor');
  }

  computerAn() {
    this.lab.computer.userData.anschalten?.();
    this.spiel.musik?.pling?.();
    this.zeigeKarte(`<div class="computer"><div class="mini-blocks">${'<i></i>'.repeat(48)}<b>MINI BLOCKS</b></div>
      <div class="login">
        <div class="login-feld"><span>👤 Name</span><b class="login-name"></b></div>
        <div class="login-feld"><span>🔑 Passwort</span><b class="login-pw"></b></div>
        <p class="login-hinweis">🕵️ Forscher-Zugang: nur mitlesen – nicht spielen!</p>
      </div></div>`,
      '🔑 Einloggen', () => this.chat(), 'labor');
    // Name und Passwort tippen sich selbst ein
    const knopfEl = this.karte.querySelector('button');
    knopfEl.disabled = true;
    const tippe = (el, text, start) => [...text].forEach((z, i) => setTimeout(() => { if (el.isConnected) el.textContent += z; }, start + i * 110));
    const name = 'Forscher_007';
    tippe(this.karte.querySelector('.login-name'), name, 500);
    tippe(this.karte.querySelector('.login-pw'), '••••••••', 700 + name.length * 110);
    setTimeout(() => { knopfEl.disabled = false; }, 1100 + (name.length + 8) * 110);
  }

  chat() {
    const nachrichten = E().chat;
    this.zeigeKarte(`<div class="computer"><div class="mini-blocks">${'<i></i>'.repeat(48)}<b>MINI BLOCKS</b></div><div class="chat"><div class="chat-kopf">💬 Mini Blocks Chat · ✅ eingeloggt als Forscher_007</div><div class="chat-liste"></div></div></div>`,
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
        this.setzeSchritt('runter');
        this.spiel.meldung('🛗 Fahr mit dem Aufzug runter – und dann schnell zum Ruderboot!', 6);
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
    if (this.ablauf) this.weiterSpielen(dt);
    const t = performance.now() / 1000;
    for (const m of [this.markerTurm, this.markerBoot, this.markerComputer, this.markerAufzug]) {
      if (!m.visible) continue;
      m.userData.pfeil.position.y = 4 + Math.sin(t * 3) * 0.5;
      m.rotation.y += dt;
    }
  }
}
