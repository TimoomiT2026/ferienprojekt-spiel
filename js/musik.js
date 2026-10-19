// =============================================================
//  MUSIK & GERÄUSCHE – komplett vom Computer ausgerechnet!
//  Es gibt keine Musikdatei: Jeder Klavierton wird aus Schwingungen
//  (Sinuswellen) zusammengebaut. Darum ist die Musik garantiert
//  lizenzfrei – sie gehört uns.
//  Tagsüber: fröhlich in C-Dur. Nachts: ruhig und geheimnisvoll in a-Moll.
// =============================================================
import { EINSTELLUNGEN } from './einstellungen.js';

// MIDI-Notennummer → Frequenz in Hertz (69 = Kammerton A = 440 Hz)
const hertz = (note) => 440 * Math.pow(2, (note - 69) / 12);

const STUECKE = {
  tag: {
    tempo: 66,
    akkorde: [[48, 55, 64, 71], [45, 52, 60, 67], [41, 48, 57, 64], [43, 50, 59, 62]],
    melodie: [72, 74, 76, 79, 81, 84],
    dichte: 0.7,
    lautstaerke: 0.16,
  },
  nacht: {
    tempo: 52,
    akkorde: [[45, 52, 59, 60], [41, 48, 57, 64], [48, 55, 64, 71], [40, 47, 55, 62]],
    melodie: [69, 72, 74, 76, 79],
    dichte: 0.45,
    lautstaerke: 0.12,
  },
};

function lade(name, standard) {
  try {
    const wert = localStorage.getItem(name);
    return wert === null ? standard : wert === '1';
  } catch {
    return standard;
  }
}

function speichere(name, wert) {
  try {
    localStorage.setItem(name, wert ? '1' : '0');
  } catch {}
}

export class Musik {
  constructor() {
    this.ctx = null;
    this.an = lade('musikAn', true);
    this.stueck = 'tag';
    this.takt = 0;
    this.melodieIndex = 2;
  }

  // Muss nach einem Tippen starten (Regel von Safari: kein Ton ohne Tippen)
  start() {
    if (this.ctx) {
      this.ctx.resume();
      return;
    }
    try {
      if (navigator.audioSession) navigator.audioSession.type = 'playback';
    } catch {}
    const AudioKontext = window.AudioContext || window.webkitAudioContext;
    if (!AudioKontext) return;
    const ctx = (this.ctx = new AudioKontext());

    this.musikLaut = ctx.createGain();
    this.musikLaut.gain.value = this.an ? EINSTELLUNGEN.musikLautstaerke : 0;
    this.musikLaut.connect(ctx.destination);

    // Hall: klingt, als würde das Klavier in einem großen Raum stehen
    this.bus = ctx.createGain();
    const hall = ctx.createConvolver();
    hall.buffer = this.baueHall(3.5);
    const hallLaut = ctx.createGain();
    hallLaut.gain.value = 0.5;
    const direkt = ctx.createGain();
    direkt.gain.value = 0.7;
    this.bus.connect(direkt).connect(this.musikLaut);
    this.bus.connect(hall).connect(hallLaut).connect(this.musikLaut);

    this.effekte = ctx.createGain();
    this.effekte.gain.value = 0.5;
    this.effekte.connect(ctx.destination);

    this.naechsterTakt = ctx.currentTime + 0.3;
    setInterval(() => this.planen(), 120);
  }

  baueHall(sekunden) {
    const rate = this.ctx.sampleRate;
    const laenge = Math.floor(rate * sekunden);
    const puffer = this.ctx.createBuffer(2, laenge, rate);
    for (let kanal = 0; kanal < 2; kanal++) {
      const daten = puffer.getChannelData(kanal);
      for (let i = 0; i < laenge; i++) daten[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / laenge, 2.8);
    }
    return puffer;
  }

  umschalten() {
    this.an = !this.an;
    speichere('musikAn', this.an);
    if (this.ctx) {
      this.musikLaut.gain.setTargetAtTime(this.an ? EINSTELLUNGEN.musikLautstaerke : 0, this.ctx.currentTime, 0.3);
    }
    return this.an;
  }

  setzeNacht(nacht) {
    this.stueck = nacht ? 'nacht' : 'tag';
  }

  // Ein Klavierton: Grundton + Obertöne, laut anschlagen, langsam verklingen
  klavier(note, zeit, dauer, laut, ziel = this.bus) {
    const ctx = this.ctx;
    const f = hertz(note);
    const huelle = ctx.createGain();
    huelle.gain.setValueAtTime(0.0001, zeit);
    huelle.gain.exponentialRampToValueAtTime(laut, zeit + 0.01);
    huelle.gain.exponentialRampToValueAtTime(laut * 0.35, zeit + 0.5);
    huelle.gain.exponentialRampToValueAtTime(0.0001, zeit + dauer);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(Math.min(f * 7, 7000), zeit);
    filter.frequency.exponentialRampToValueAtTime(Math.max(f * 1.6, 250), zeit + dauer);
    filter.connect(huelle).connect(ziel);
    for (const [oberton, staerke] of [[1, 1], [2, 0.4], [3, 0.15], [4, 0.08]]) {
      const osz = ctx.createOscillator();
      osz.frequency.value = f * oberton;
      osz.detune.value = (Math.random() - 0.5) * 5;
      const g = ctx.createGain();
      g.gain.value = staerke;
      osz.connect(g).connect(filter);
      osz.start(zeit);
      osz.stop(zeit + dauer + 0.05);
    }
  }

  // Plant die nächsten Takte voraus (wie ein Dirigent, der vorausschaut)
  planen() {
    if (!this.ctx || !this.an) {
      if (this.ctx) this.naechsterTakt = Math.max(this.naechsterTakt, this.ctx.currentTime + 0.2);
      return;
    }
    while (this.naechsterTakt < this.ctx.currentTime + 0.6) {
      this.spieleTakt(this.naechsterTakt);
      this.naechsterTakt += (60 / STUECKE[this.stueck].tempo) * 4;
      this.takt++;
    }
  }

  spieleTakt(start) {
    const s = STUECKE[this.stueck];
    const schlag = 60 / s.tempo;
    const akkord = s.akkorde[this.takt % s.akkorde.length];
    const laut = s.lautstaerke;
    // Jeder 8. Takt ist fast leer: Musik braucht auch Pausen
    const pause = this.takt % 8 === 7;

    // Linke Hand: tiefer Grundton
    this.klavier(akkord[0] - 12, start, schlag * 4.5, laut * 0.9);
    if (pause) return;

    // Gebrochener Akkord in Achteln
    for (let i = 0; i < 8; i++) {
      if (Math.random() > s.dichte) continue;
      const note = akkord[(i * 2 + (i > 3 ? 1 : 0)) % akkord.length];
      this.klavier(note, start + i * schlag * 0.5 + Math.random() * 0.02, schlag * 3, laut * 0.55);
    }
    // Rechte Hand: kleine Melodie, Schritt für Schritt
    for (let i = 0; i < 4; i++) {
      if (Math.random() > s.dichte * 0.45) continue;
      this.melodieIndex = Math.max(0, Math.min(s.melodie.length - 1, this.melodieIndex + Math.floor(Math.random() * 5) - 2));
      this.klavier(s.melodie[this.melodieIndex], start + i * schlag + Math.random() * 0.03, schlag * 2.5, laut * 0.7);
    }
  }

  // ---------- Geräusche ----------
  pling() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.klavier(84, t, 0.6, 0.25, this.effekte);
    this.klavier(91, t + 0.09, 0.8, 0.25, this.effekte);
  }

  graben() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    for (let k = 0; k < 3; k++) {
      const laenge = Math.floor(ctx.sampleRate * 0.18);
      const puffer = ctx.createBuffer(1, laenge, ctx.sampleRate);
      const d = puffer.getChannelData(0);
      for (let i = 0; i < laenge; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / laenge);
      const quelle = ctx.createBufferSource();
      quelle.buffer = puffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 700;
      const g = ctx.createGain();
      g.gain.value = 0.6;
      quelle.connect(filter).connect(g).connect(this.effekte);
      quelle.start(t + k * 0.25);
    }
  }

  schlaflied() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [72, 69, 65, 60].forEach((n, i) => this.klavier(n, t + i * 0.5, 2.5, 0.2, this.effekte));
  }
}
