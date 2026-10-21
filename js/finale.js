// =============================================================
//  DAS GROSSE FINALE – vom Game Designer erfunden!
//  Wer das Insadorium findet, hat das Ziel erreicht:
//  Konfetti über den ganzen Bildschirm, ein Jubel-Klang
//  und ein Dankeschön fürs Spielen. Danach geht's frei weiter.
// =============================================================
import { knopf } from './steuerung.js';
import { MATERIAL } from './vorgeschichte.js';

// Diese Zeile steht unten im Dankeschön-Fenster (keine echten Namen!)
export const DANKE_TEXT = 'Danke fürs Spielen! Ein Ferienprojekt von Vater & Sohn 💛';

// Zahlen fürs Konfetti – hier darf man drehen
const KONFETTI = {
  maxTeilchen: 300, // mehr wird auf dem iPad zu langsam
  dauer: 7, // so viele Sekunden regnet es Konfetti
  fensterNach: 1.5, // nach so vielen Sekunden kommt das Dankeschön-Fenster
  kanonenZeiten: [0, 1.2, 2.6], // wann die Konfetti-Kanonen schießen (Sekunden)
  proKanone: 45, // so viele Teilchen pro Kanonen-Schuss (je Seite)
  regenProSekunde: 30, // so viele Teilchen fallen von oben pro Sekunde
  schwerkraft: 520, // wie schnell es nach unten zieht
  farben: ['#ff4d6d', '#ffb02e', '#ffe14d', '#4caf50', '#3d9bff', '#a066ff', '#ff7ac8', '#2ee6c8'],
};

// Ein Zufallswert zwischen a und b
const zufall = (a, b) => a + Math.random() * (b - a);

export class Finale {
  constructor({ elternElement, musik = null, beimSchliessen = null } = {}) {
    this.eltern = elternElement || document.body;
    this.musik = musik;
    this.beimSchliessen = beimSchliessen; // wird gerufen, wenn man "Weiterspielen" tippt
    this.gezeigt = false; // kam das Finale schon einmal? (dann nie wieder)
    this.offen = false; // ist das Dankeschön-Fenster gerade offen? (Spiel macht Pause)
    this.leinwand = null;
    this.fenster = null;
    this.teilchen = [];
    this.wenigerBewegung = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  }

  // Für den Spielstand: merken, dass das Finale schon war
  alsDaten() {
    return { gezeigt: this.gezeigt };
  }

  ladeDaten(daten) {
    this.gezeigt = !!daten?.gezeigt;
  }

  // Los geht's! (wenn wiederGezeigt = true, kommt es auch ein zweites Mal – z. B. zum Testen)
  starten(wiederGezeigt = false) {
    if (this.gezeigt && !wiederGezeigt) return false;
    if (this.offen) return false;
    this.gezeigt = true;
    this.offen = true;
    this.jubelKlang();
    this.konfettiStarten();
    this.fensterZeit = setTimeout(() => this.zeigeFenster(), KONFETTI.fensterNach * 1000);
    return true;
  }

  // =============================================================
  //  KONFETTI (auf einer durchsichtigen Malfläche über allem)
  // =============================================================
  konfettiStarten() {
    this.konfettiStoppen();
    const leinwand = document.createElement('canvas');
    leinwand.id = 'finale-konfetti';
    this.eltern.appendChild(leinwand);
    this.leinwand = leinwand;
    this.pinsel = leinwand.getContext('2d');
    this.groesseAnpassen = () => {
      // Höchstens doppelt so scharf – sonst muss das iPad zu viel malen
      const schaerfe = Math.min(window.devicePixelRatio || 1, 2);
      this.breite = window.innerWidth;
      this.hoehe = window.innerHeight;
      leinwand.width = Math.round(this.breite * schaerfe);
      leinwand.height = Math.round(this.hoehe * schaerfe);
      this.pinsel.setTransform(schaerfe, 0, 0, schaerfe, 0, 0);
    };
    this.groesseAnpassen();
    window.addEventListener('resize', this.groesseAnpassen);

    // Wer wenig Bewegung mag, bekommt weniger Konfetti und nur eine Kanone
    this.teil = this.wenigerBewegung ? 0.3 : 1;
    this.kanonen = this.wenigerBewegung ? [0] : [...KONFETTI.kanonenZeiten];
    this.teilchen = [];
    this.regenRest = 0;
    this.startZeit = performance.now();
    this.letzteZeit = this.startZeit;
    const bild = (jetzt) => {
      if (!this.leinwand) return;
      const dt = Math.min((jetzt - this.letzteZeit) / 1000, 0.05);
      this.letzteZeit = jetzt;
      const sekunden = (jetzt - this.startZeit) / 1000;
      this.konfettiSchritt(sekunden, dt);
      // Fertig, wenn die Zeit um ist und alles heruntergefallen ist
      // (Spätestens 2 Sekunden danach wird sanft ausgeblendet)
      if (sekunden > KONFETTI.dauer) leinwand.style.opacity = Math.max(0, 1 - (sekunden - KONFETTI.dauer) / 2);
      if ((sekunden > KONFETTI.dauer && this.teilchen.length === 0) || sekunden > KONFETTI.dauer + 2) this.konfettiStoppen();
      else this.bildNummer = requestAnimationFrame(bild);
    };
    this.bildNummer = requestAnimationFrame(bild);
  }

  konfettiStoppen() {
    if (this.bildNummer) cancelAnimationFrame(this.bildNummer);
    this.bildNummer = 0;
    if (this.groesseAnpassen) window.removeEventListener('resize', this.groesseAnpassen);
    if (this.leinwand) this.leinwand.remove();
    this.leinwand = null;
    this.teilchen = [];
  }

  // Ein neues Konfetti-Teilchen
  neuesTeilchen(x, y, vx, vy) {
    if (this.teilchen.length >= KONFETTI.maxTeilchen * this.teil) return;
    const formen = ['kreis', 'kreis', 'streifen', 'streifen', 'stern'];
    this.teilchen.push({
      x, y, vx, vy,
      form: formen[Math.floor(Math.random() * formen.length)],
      farbe: KONFETTI.farben[Math.floor(Math.random() * KONFETTI.farben.length)],
      groesse: zufall(7, 13),
      drehung: zufall(0, Math.PI * 2),
      drehTempo: zufall(-6, 6),
      flattern: zufall(0, Math.PI * 2), // wo es gerade beim Hin-und-her-Wackeln ist
      flatterTempo: zufall(3, 7),
    });
  }

  // Eine Konfetti-Kanone schießt von unten links UND unten rechts schräg nach oben
  kanoneSchiessen() {
    const anzahl = Math.round(KONFETTI.proKanone * this.teil);
    const kraft = Math.max(this.hoehe, 500) * 1.35;
    for (let i = 0; i < anzahl; i++) {
      for (const seite of [-1, 1]) {
        const winkel = zufall(55, 80) * (Math.PI / 180); // steil nach oben, leicht zur Mitte
        const tempo = kraft * zufall(0.65, 1.05);
        const x = seite < 0 ? zufall(-10, 30) : this.breite - zufall(-10, 30);
        this.neuesTeilchen(x, this.hoehe + 10, -seite * Math.cos(winkel) * tempo, -Math.sin(winkel) * tempo);
      }
    }
  }

  konfettiSchritt(sekunden, dt) {
    // Kanonen-Schüsse, wenn ihre Zeit gekommen ist
    while (this.kanonen.length && sekunden >= this.kanonen[0]) {
      this.kanonen.shift();
      this.kanoneSchiessen();
    }
    // Konfetti-Regen von oben (nur solange die Zeit läuft)
    if (sekunden < KONFETTI.dauer - 3) {
      this.regenRest += KONFETTI.regenProSekunde * this.teil * dt;
      while (this.regenRest >= 1) {
        this.regenRest--;
        this.neuesTeilchen(zufall(0, this.breite), zufall(-40, -10), zufall(-30, 30), zufall(40, 120));
      }
    }

    const p = this.pinsel;
    p.clearRect(0, 0, this.breite, this.hoehe);
    const uebrig = [];
    for (const t of this.teilchen) {
      // Luft bremst – darum flattert Konfetti langsam herunter
      const bremse = Math.pow(0.35, dt);
      t.vx *= bremse;
      t.vy = t.vy * bremse + KONFETTI.schwerkraft * dt;
      if (t.vy > 190) t.vy = 190; // schneller fällt Papier nicht
      t.flattern += t.flatterTempo * dt;
      t.x += (t.vx + Math.sin(t.flattern) * 40) * dt;
      t.y += t.vy * dt;
      t.drehung += t.drehTempo * dt;
      if (t.y > this.hoehe + 30 && t.vy > 0) continue; // unten raus → weg damit
      uebrig.push(t);
      this.maleTeilchen(p, t);
    }
    this.teilchen = uebrig;
  }

  maleTeilchen(p, t) {
    p.save();
    p.translate(t.x, t.y);
    p.rotate(t.drehung);
    // Beim Flattern dreht sich das Papier – dann sieht es mal schmal, mal breit aus
    p.scale(1, 0.35 + 0.65 * Math.abs(Math.cos(t.flattern)));
    p.fillStyle = t.farbe;
    p.strokeStyle = t.farbe;
    const g = t.groesse;
    if (t.form === 'kreis') {
      p.beginPath();
      p.arc(0, 0, g * 0.5, 0, Math.PI * 2);
      p.fill();
    } else if (t.form === 'streifen') {
      // Ein runder Streifen: dicke Linie mit runden Enden
      p.lineWidth = g * 0.45;
      p.lineCap = 'round';
      p.beginPath();
      p.moveTo(-g * 0.6, 0);
      p.lineTo(g * 0.6, 0);
      p.stroke();
    } else {
      // Ein Stern mit runden Ecken
      p.lineWidth = g * 0.25;
      p.lineJoin = 'round';
      p.beginPath();
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? g * 0.6 : g * 0.28;
        const w = (i / 10) * Math.PI * 2 - Math.PI / 2;
        p.lineTo(Math.cos(w) * r, Math.sin(w) * r);
      }
      p.closePath();
      p.fill();
      p.stroke();
    }
    p.restore();
  }

  // =============================================================
  //  JUBEL-KLANG: eine kleine Fanfare "Ta-ta-ta-taaa!"
  // =============================================================
  jubelKlang() {
    const m = this.musik;
    const ctx = m?.ctx;
    if (!ctx) return; // kein Ton an → dann eben still
    try {
      ctx.resume?.()?.catch?.(() => {});
      // Durch den "Aufpasser" der Musik schicken (macht zu Lautes leiser), sonst direkt
      const ziel = m.effekte || ctx.destination;
      const gesamt = ctx.createGain();
      gesamt.gain.value = 0.8; // nicht zu laut!
      gesamt.connect(ziel);
      const t = ctx.currentTime + 0.05;
      const note = (n) => 440 * Math.pow(2, (n - 69) / 12); // Notennummer → Tonhöhe

      // Ein Trompeten-ähnlicher Ton: zwei leicht verstimmte Sägezähne durch einen weichen Filter
      const blasen = (n, start, dauer, laut) => {
        const huelle = ctx.createGain();
        huelle.gain.setValueAtTime(0.0001, start);
        huelle.gain.exponentialRampToValueAtTime(laut, start + 0.03);
        huelle.gain.setValueAtTime(laut, start + dauer * 0.7);
        huelle.gain.exponentialRampToValueAtTime(0.0001, start + dauer);
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(900, start);
        filter.frequency.exponentialRampToValueAtTime(2600, start + 0.08);
        filter.frequency.exponentialRampToValueAtTime(1400, start + dauer);
        filter.connect(huelle).connect(gesamt);
        for (const verstimmt of [-6, 6]) {
          const osz = ctx.createOscillator();
          osz.type = 'sawtooth';
          osz.frequency.value = note(n);
          osz.detune.value = verstimmt;
          osz.connect(filter);
          osz.start(start);
          osz.stop(start + dauer + 0.05);
        }
      };
      // Glöckchen obendrauf: heller Sinus-Ton, der langsam ausklingt
      const glocke = (n, start, laut) => {
        const osz = ctx.createOscillator();
        osz.type = 'sine';
        osz.frequency.value = note(n);
        const huelle = ctx.createGain();
        huelle.gain.setValueAtTime(0.0001, start);
        huelle.gain.exponentialRampToValueAtTime(laut, start + 0.005);
        huelle.gain.exponentialRampToValueAtTime(0.0001, start + 1.2);
        osz.connect(huelle).connect(gesamt);
        osz.start(start);
        osz.stop(start + 1.3);
      };

      // Fanfare: G – G – G – C (lang)  …  E – G – C (Akkord, ganz lang)
      const s = 0.13;
      blasen(67, t, 0.12, 0.08);
      blasen(67, t + s, 0.12, 0.08);
      blasen(67, t + 2 * s, 0.12, 0.08);
      blasen(72, t + 3 * s, 0.5, 0.1);
      const akkord = t + 3 * s + 0.55;
      for (const n of [72, 76, 79]) blasen(n, akkord, 1.4, 0.06);
      // Glitzer-Glöckchen nach oben
      [84, 88, 91, 96].forEach((n, i) => glocke(n, akkord + i * 0.08, 0.05));
      // Zum Schluss noch ein freundliches "Pling" aus der Musik, wenn es das gibt
      if (typeof m.pling === 'function') setTimeout(() => m.pling(), 2200);
    } catch {
      // Wenn der Ton nicht klappt, ist das nicht schlimm – Konfetti gibt's trotzdem
    }
  }

  // =============================================================
  //  DAS DANKESCHÖN-FENSTER (im Stil vom Forscher-Tagebuch)
  // =============================================================
  zeigeFenster() {
    if (this.fenster) return;
    const fenster = document.createElement('div');
    fenster.id = 'finale-fenster';
    fenster.innerHTML = `<div class="tagebuch finale-buch">
      <div class="insadorium-stein" aria-hidden="true"><span></span></div>
      <h2 class="finale-titel">🎉 Du hast das ${MATERIAL} gefunden!</h2>
      <p class="tb-text">
        <b>Forscher-Tagebuch, letzte Seite</b><br>
        Ich kann es kaum glauben: Tief unter Wasser leuchtet es rot –
        das <b>${MATERIAL}</b>! 🔮 Nach so vielen Tagen auf den Inseln habe ich es
        endlich geschafft. Mein großes Ziel ist erreicht!
      </p>
      <p class="finale-danke"></p>
      <p class="finale-hinweis">Du kannst jetzt frei weiter auf den Inseln spielen.</p>
      <div class="knopf-reihe"><button class="fenster-knopf gruen finale-weiter">Weiterspielen 🏝️</button></div>
    </div>`;
    fenster.querySelector('.finale-danke').textContent = DANKE_TEXT;
    // Fingertipps im Fenster sollen nicht im Spiel landen
    fenster.addEventListener('touchstart', (e) => e.stopPropagation());
    this.eltern.appendChild(fenster);
    this.fenster = fenster;
    // Einen Moment warten, damit das sanfte Einblenden klappt
    requestAnimationFrame(() => requestAnimationFrame(() => fenster.classList.add('sichtbar')));
    knopf(fenster.querySelector('.finale-weiter'), () => this.schliessen());
  }

  // Fenster zu → weiterspielen!
  schliessen() {
    clearTimeout(this.fensterZeit);
    if (this.fenster) this.fenster.remove();
    this.fenster = null;
    this.offen = false;
    if (this.beimSchliessen) this.beimSchliessen();
  }
}
