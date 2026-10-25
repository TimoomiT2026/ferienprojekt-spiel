// =============================================================
//  MUSIK & GERÄUSCHE – komplett vom Computer ausgerechnet!
//  Es gibt keine Musikdatei: Jeder Klavierton wird aus Schwingungen
//  (Sinuswellen) zusammengebaut. Darum ist die Musik garantiert
//  lizenzfrei – sie gehört uns.
//  Tagsüber wechseln sich 3 ruhige Klavierstücke ab (C-Dur, F-Dur, G-Dur).
//  Nachts spielt ein eigenes Stück: weiche Klangflächen und eine Spieluhr.
//  Auch alle Geräusche (Rascheln, Wasser, Münzen …) sind ausgerechnet:
//  aus "Rauschen" (wie ein Radio ohne Sender), Filtern und Tönen.
// =============================================================
import { EINSTELLUNGEN } from './einstellungen.js';

// MIDI-Notennummer → Frequenz in Hertz (69 = Kammerton A = 440 Hz)
const hertz = (note) => 440 * Math.pow(2, (note - 69) / 12);
// Zufallszahl zwischen a und b
const zwischen = (a, b) => a + Math.random() * (b - a);

// So sind die Stücke gebaut:
//  tempo    = Schläge pro Minute
//  schlaege = Schläge pro Takt (4 = normal, 3 = Walzer)
//  akkorde  = welche Töne zusammen klingen (der erste ist der Grundton)
//  muster   = in welcher Reihenfolge die Akkord-Töne gespielt werden
//  melodie  = Töne, aus denen die rechte Hand ihre Melodie sucht
//  dichte   = wie viele Töne gespielt werden (1 = alle, 0 = keine)
const STUECKE = {
  // Das Lieblingsstück des Game Designers – bleibt genau so!
  tag: {
    art: 'klavier',
    tempo: 66,
    schlaege: 4,
    akkorde: [[48, 55, 64, 71], [45, 52, 60, 67], [41, 48, 57, 64], [43, 50, 59, 62]],
    muster: [0, 2, 0, 2, 1, 3, 1, 3],
    melodie: [72, 74, 76, 79, 81, 84],
    dichte: 0.7,
    lautstaerke: 0.16,
  },
  // Stück 2: F-Dur, ein bisschen fließender (Töne rollen rauf und runter)
  wiese: {
    art: 'klavier',
    tempo: 72,
    schlaege: 4,
    akkorde: [[41, 48, 57, 64], [38, 45, 53, 60], [46, 53, 57, 62], [48, 55, 60, 64]],
    muster: [0, 1, 2, 3, 2, 1, 2, 3],
    melodie: [69, 72, 74, 77, 79, 81, 84],
    dichte: 0.6,
    lautstaerke: 0.15,
  },
  // Stück 3: G-Dur, im Dreier-Takt – wie ein langsamer Walzer
  sonne: {
    art: 'klavier',
    tempo: 84,
    schlaege: 3,
    akkorde: [[43, 50, 59, 62], [40, 47, 55, 62], [48, 55, 62, 64], [45, 50, 57, 66]],
    muster: [0, 1, 2, 3, 2, 1],
    melodie: [71, 74, 76, 79, 81, 83, 86],
    dichte: 0.65,
    lautstaerke: 0.15,
  },
  // Nachtstück: ganz anders! Lange, weiche Klangflächen und eine kleine
  // Spieluhr mit Echo. Geheimnisvoll, aber freundlich (D-Dorisch).
  nacht: {
    art: 'nacht',
    tempo: 50,
    schlaege: 4,
    akkorde: [[38, 53, 57, 60, 64], [43, 55, 59, 62, 64], [34, 53, 57, 58, 62], [40, 55, 60, 64, 67]],
    melodie: [74, 77, 79, 81, 84, 86, 89],
    dichte: 0.4,
    lautstaerke: 0.13,
  },
};
// Diese Stücke wechseln sich tagsüber ab
const TAG_STUECKE = ['tag', 'wiese', 'sonne'];

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
    this.naechstes = null; // welches Stück kommt nach dem Überblenden?
    this.tagNummer = 0; // welches der 3 Tagstücke gerade dran ist
    this.nacht = false;
    this.takt = 0;
    this.melodieIndex = 2;
    // Für die Dauer-Geräusche (Meer, Rascheln)
    this.naechsterSchritt = 0;
    this.naechstesUpdate = 0;
    this.meerZiel = -1;
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
    this.baueAlles(new AudioKontext());
    setInterval(() => this.planen(), 120);
  }

  // Baut alle "Kabel" zwischen den Klang-Bausteinen.
  // (Eigene Funktion, damit man sie auch zum Testen ohne Lautsprecher benutzen kann.)
  baueAlles(ctx) {
    this.ctx = ctx;

    // Ganz am Ende: ein "Aufpasser", der zu laute Stellen leiser macht (kein Knacksen)
    this.ausgang = ctx.createDynamicsCompressor();
    this.ausgang.threshold.value = -4;
    this.ausgang.knee.value = 2;
    this.ausgang.ratio.value = 12;
    this.ausgang.attack.value = 0.003;
    this.ausgang.release.value = 0.2;
    // Der Hauptschalter: Ist der Ton aus, ist ALLES still (Musik, Geräusche, Wellen, Gras …)
    this.alles = ctx.createGain();
    this.alles.gain.value = this.an ? 1 : 0;
    this.ausgang.connect(this.alles);
    this.alles.connect(ctx.destination);

    this.musikLaut = ctx.createGain();
    this.musikLaut.gain.value = this.an ? EINSTELLUNGEN.musikLautstaerke : 0;
    this.musikLaut.connect(this.ausgang);

    // Hall: klingt, als würde das Klavier in einem großen Raum stehen
    this.bus = ctx.createGain();
    // Mit diesem Regler blenden wir beim Stückwechsel weich aus und ein
    this.stueckLaut = ctx.createGain();
    this.bus.connect(this.stueckLaut);
    const hall = ctx.createConvolver();
    hall.buffer = this.baueHall(3.5);
    const hallLaut = ctx.createGain();
    hallLaut.gain.value = 0.5;
    const direkt = ctx.createGain();
    direkt.gain.value = 0.7;
    this.stueckLaut.connect(direkt).connect(this.musikLaut);
    this.stueckLaut.connect(hall).connect(hallLaut).connect(this.musikLaut);

    // Echo für die Spieluhr in der Nacht (der Ton kommt leiser zurück)
    this.echo = ctx.createDelay(2);
    this.echo.delayTime.value = (60 / STUECKE.nacht.tempo) * 0.75;
    const echoZurueck = ctx.createGain();
    echoZurueck.gain.value = 0.38;
    const echoFilter = ctx.createBiquadFilter();
    echoFilter.type = 'lowpass';
    echoFilter.frequency.value = 2600;
    this.echo.connect(echoFilter).connect(echoZurueck).connect(this.echo);
    echoFilter.connect(this.bus);

    // Geräusche haben einen eigenen Regler: Sie bleiben an, auch wenn die Musik aus ist
    this.effekte = ctx.createGain();
    this.effekte.gain.value = EINSTELLUNGEN.geraeuscheLautstaerke;
    this.effekte.connect(this.ausgang);

    // Ein Rauschen-Vorrat (4 Sekunden), den ALLE Geräusche wiederverwenden
    const laenge = Math.floor(ctx.sampleRate * 4);
    this.rauschen = ctx.createBuffer(1, laenge, ctx.sampleRate);
    const d = this.rauschen.getChannelData(0);
    for (let i = 0; i < laenge; i++) d[i] = Math.random() * 2 - 1;

    this.baueMeer();

    this.naechsterTakt = ctx.currentTime + 0.3;
    this.stueckSeit = ctx.currentTime;
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
      this.alles.gain.setTargetAtTime(this.an ? 1 : 0, this.ctx.currentTime, 0.05); // alles still – nicht nur die Musik
    }
    return this.an;
  }

  setzeNacht(nacht) {
    if (nacht === this.nacht) return;
    this.nacht = nacht;
    if (nacht) {
      this.wechsleZu('nacht');
    } else {
      // Am Morgen kommt das nächste Tagstück dran
      this.tagNummer = (this.tagNummer + 1) % TAG_STUECKE.length;
      this.wechsleZu(TAG_STUECKE[this.tagNummer]);
    }
  }

  // Weich zu einem anderen Stück überblenden
  wechsleZu(name) {
    if (!this.ctx) {
      // Noch kein Ton an? Dann einfach gleich umstellen.
      this.stueck = name;
      this.naechstes = null;
      return;
    }
    const jetzt = this.ctx.currentTime;
    const regler = this.stueckLaut.gain;
    if (name === this.stueck) {
      // Doch nicht wechseln: wieder lauter machen
      if (this.naechstes) {
        this.naechstes = null;
        regler.cancelScheduledValues(jetzt);
        regler.setTargetAtTime(1, jetzt, 0.8);
      }
      return;
    }
    if (name === this.naechstes) return;
    this.naechstes = name;
    // Musik ist aus? Dann muss man nicht ausblenden.
    this.wechselZeit = jetzt + (this.an ? EINSTELLUNGEN.musikUeberblendSekunden : 0);
    regler.cancelScheduledValues(jetzt);
    regler.setTargetAtTime(0, jetzt, EINSTELLUNGEN.musikUeberblendSekunden / 4);
  }

  // Plant die nächsten Takte voraus (wie ein Dirigent, der vorausschaut)
  planen() {
    if (!this.ctx) return;
    const jetzt = this.ctx.currentTime;

    // Ist das alte Stück leise genug? Dann kommt jetzt das neue.
    if (this.naechstes && jetzt >= this.wechselZeit) {
      this.stueck = this.naechstes;
      this.naechstes = null;
      this.takt = 0;
      this.melodieIndex = 2;
      this.stueckSeit = jetzt;
      this.naechsterTakt = Math.max(this.naechsterTakt, jetzt + 0.15);
      const regler = this.stueckLaut.gain;
      regler.cancelScheduledValues(jetzt);
      regler.setTargetAtTime(1, jetzt, EINSTELLUNGEN.musikUeberblendSekunden / 4);
    }
    // Tagsüber: nach ein paar Minuten kommt das nächste Stück
    if (!this.nacht && !this.naechstes && jetzt - this.stueckSeit > EINSTELLUNGEN.musikStueckMinuten * 60) {
      this.tagNummer = (this.tagNummer + 1) % TAG_STUECKE.length;
      this.wechsleZu(TAG_STUECKE[this.tagNummer]);
    }

    if (!this.an) {
      this.naechsterTakt = Math.max(this.naechsterTakt, jetzt + 0.2);
      return;
    }
    while (this.naechsterTakt < jetzt + 0.6) {
      const s = STUECKE[this.stueck];
      if (s.art === 'nacht') this.spieleNachtTakt(this.naechsterTakt, s);
      else this.spieleTakt(this.naechsterTakt, s);
      this.naechsterTakt += (60 / s.tempo) * s.schlaege;
      this.takt++;
    }
  }

  // ---------- Die Instrumente ----------
  // Ein Klavierton: Grundton + Obertöne, laut anschlagen, langsam verklingen
  klavier(note, zeit, dauer, laut, ziel = this.bus) {
    laut = Math.max(laut, 0.0001); // Lautstärke 0 = aus (exponentielle Rampen vertragen keine 0)
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

  // Klangfläche: ein Ton, der ganz langsam kommt und geht (wie ein weicher Chor)
  flaeche(note, zeit, dauer, laut) {
    const ctx = this.ctx;
    const f = hertz(note);
    const huelle = ctx.createGain();
    huelle.gain.setValueAtTime(0, zeit);
    huelle.gain.linearRampToValueAtTime(laut, zeit + dauer * 0.35);
    huelle.gain.linearRampToValueAtTime(laut * 0.7, zeit + dauer * 0.7);
    huelle.gain.linearRampToValueAtTime(0, zeit + dauer);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    filter.connect(huelle).connect(this.bus);
    for (const [typ, verstimmen] of [['sine', -4], ['triangle', 5]]) {
      const osz = ctx.createOscillator();
      osz.type = typ;
      osz.frequency.value = f;
      osz.detune.value = verstimmen; // zwei leicht verschiedene Töne = schwebt schön
      osz.connect(filter);
      osz.start(zeit);
      osz.stop(zeit + dauer + 0.05);
    }
  }

  // Spieluhr: ein heller, glockiger Ton, der mit Echo verklingt
  spieluhr(note, zeit, laut) {
    laut = Math.max(laut, 0.0001); // Lautstärke 0 = aus (exponentielle Rampen vertragen keine 0)
    const ctx = this.ctx;
    const f = hertz(note);
    const huelle = ctx.createGain();
    huelle.gain.setValueAtTime(0.0001, zeit);
    huelle.gain.exponentialRampToValueAtTime(laut, zeit + 0.006);
    huelle.gain.exponentialRampToValueAtTime(0.0001, zeit + 1.6);
    huelle.connect(this.bus);
    huelle.connect(this.echo);
    for (const [oberton, staerke] of [[1, 1], [3, 0.12], [5.1, 0.04]]) {
      const osz = ctx.createOscillator();
      osz.frequency.value = f * oberton;
      const g = ctx.createGain();
      g.gain.value = staerke;
      osz.connect(g).connect(huelle);
      osz.start(zeit);
      osz.stop(zeit + 1.65);
    }
  }

  // ---------- Ein Takt Klaviermusik (Tagstücke) ----------
  spieleTakt(start, s) {
    const schlag = 60 / s.tempo;
    const akkord = s.akkorde[this.takt % s.akkorde.length];
    const laut = s.lautstaerke;
    // Jeder 8. Takt ist fast leer: Musik braucht auch Pausen
    const pause = this.takt % 8 === 7;

    // Linke Hand: tiefer Grundton
    this.klavier(akkord[0] - 12, start, schlag * (s.schlaege + 0.5), laut * 0.9);
    if (pause) return;

    // Gebrochener Akkord in Achteln
    for (let i = 0; i < s.schlaege * 2; i++) {
      if (Math.random() > s.dichte) continue;
      const note = akkord[s.muster[i % s.muster.length] % akkord.length];
      this.klavier(note, start + i * schlag * 0.5 + Math.random() * 0.02, schlag * 3, laut * 0.55);
    }
    // Rechte Hand: kleine Melodie, Schritt für Schritt
    for (let i = 0; i < s.schlaege; i++) {
      if (Math.random() > s.dichte * 0.45) continue;
      this.melodieIndex = Math.max(0, Math.min(s.melodie.length - 1, this.melodieIndex + Math.floor(Math.random() * 5) - 2));
      this.klavier(s.melodie[this.melodieIndex], start + i * schlag + Math.random() * 0.03, schlag * 2.5, laut * 0.7);
    }
  }

  // ---------- Ein Takt Nachtmusik ----------
  spieleNachtTakt(start, s) {
    const schlag = 60 / s.tempo;
    const taktLaenge = schlag * s.schlaege;
    const laut = s.lautstaerke;
    // Ein Akkord dauert 2 Takte – nachts hat man Zeit
    const akkord = s.akkorde[Math.floor(this.takt / 2) % s.akkorde.length];
    if (this.takt % 2 === 0) {
      // Tiefer, weicher Klavier-Grundton
      this.klavier(akkord[0], start, taktLaenge * 2, laut * 0.6);
      // Die Klangfläche überlappt ein bisschen mit der nächsten
      for (let i = 1; i < akkord.length; i++) this.flaeche(akkord[i], start, taktLaenge * 2 + 1.5, laut * 0.22);
    }
    // Jeder 4. Takt: nur Fläche, keine Spieluhr (Pause zum Lauschen)
    if (this.takt % 4 === 3) return;
    for (let i = 0; i < s.schlaege * 2; i++) {
      // Auf den Schlägen öfter, dazwischen selten
      const chance = i % 2 === 0 ? s.dichte : s.dichte * 0.3;
      if (Math.random() > chance) continue;
      this.melodieIndex = Math.max(0, Math.min(s.melodie.length - 1, this.melodieIndex + Math.floor(Math.random() * 5) - 2));
      this.spieluhr(s.melodie[this.melodieIndex], start + i * schlag * 0.5 + Math.random() * 0.02, laut * 0.5);
    }
  }

  // =============================================================
  //  GERÄUSCHE
  // =============================================================
  // Bausteine, aus denen alle Geräusche gemacht sind:

  // Ein Stück Rauschen durch einen Filter, mit einer Lautstärke-Kurve
  rauschStoss(zeit, dauer, laut, filterTyp, freq, freqEnde = freq, q = 1, angriff = 0.005) {
    laut = Math.max(laut, 0.0001); // Lautstärke 0 = aus (exponentielle Rampen vertragen keine 0)
    const ctx = this.ctx;
    const quelle = ctx.createBufferSource();
    quelle.buffer = this.rauschen;
    const filter = ctx.createBiquadFilter();
    filter.type = filterTyp;
    filter.Q.value = q;
    filter.frequency.setValueAtTime(freq, zeit);
    if (freqEnde !== freq) filter.frequency.exponentialRampToValueAtTime(freqEnde, zeit + dauer);
    const huelle = ctx.createGain();
    huelle.gain.setValueAtTime(0.0001, zeit);
    huelle.gain.exponentialRampToValueAtTime(laut, zeit + angriff);
    huelle.gain.exponentialRampToValueAtTime(0.0001, zeit + dauer);
    quelle.connect(filter).connect(huelle).connect(this.effekte);
    // Jedes Mal an einer anderen Stelle im Rauschen anfangen → klingt nie gleich
    quelle.start(zeit, Math.random() * 3.5, dauer + 0.05);
  }

  // Ein einfacher Ton, der von einer Tonhöhe zur anderen rutschen kann
  ton(zeit, f, fEnde, dauer, laut, typ = 'sine', angriff = 0.005) {
    laut = Math.max(laut, 0.0001); // Lautstärke 0 = aus (exponentielle Rampen vertragen keine 0)
    const ctx = this.ctx;
    const osz = ctx.createOscillator();
    osz.type = typ;
    osz.frequency.setValueAtTime(f, zeit);
    if (fEnde !== f) osz.frequency.exponentialRampToValueAtTime(fEnde, zeit + dauer);
    const huelle = ctx.createGain();
    huelle.gain.setValueAtTime(0.0001, zeit);
    huelle.gain.exponentialRampToValueAtTime(laut, zeit + angriff);
    huelle.gain.exponentialRampToValueAtTime(0.0001, zeit + dauer);
    osz.connect(huelle).connect(this.effekte);
    osz.start(zeit);
    osz.stop(zeit + dauer + 0.05);
  }

  // Metall-Klingeln (Münze, Kasse): ein Ton mit "schiefen" Obertönen
  klingeln(zeit, f, dauer, laut) {
    for (const [oberton, staerke] of [[1, 1], [2.76, 0.5], [5.4, 0.25]]) {
      if (f * oberton > 11000) continue; // zu hoch – das wäre nur ein Pieksen im Ohr
      this.ton(zeit, f * oberton, f * oberton, dauer / oberton ** 0.5, laut * staerke, 'sine', 0.002);
    }
  }

  // ---------- Allgemeine Geräusche ----------
  pling() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.klavier(84, t, 0.6, 0.25, this.effekte);
    this.klavier(91, t + 0.09, 0.8, 0.25, this.effekte);
  }

  graben() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    for (let k = 0; k < 3; k++) this.rauschStoss(t + k * 0.25, 0.18, 0.6, 'lowpass', 700, 700, 0.7, 0.003);
  }

  schlaflied() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [72, 69, 65, 60].forEach((n, i) => this.klavier(n, t + i * 0.5, 2.5, 0.2, this.effekte));
  }

  // Rascheln von Blättern und Gras (staerke 0 bis 1)
  rascheln(staerke = 1) {
    if (!this.ctx || staerke <= 0) return;
    const t = this.ctx.currentTime;
    const laut = EINSTELLUNGEN.raschelnLautstaerke * Math.min(1, staerke);
    // Ein weiches "Wusch": längeres, tiefes Rauschen, das langsam an- und
    // abschwillt. (Kurze, harte Stöße klingen wie Klicken – darum nicht!)
    const f = zwischen(1300, 2200);
    this.rauschStoss(t, zwischen(0.28, 0.4), laut, 'bandpass', f, f * 0.6, 0.5, zwischen(0.07, 0.11));
    // manchmal ein zweites, leiseres Wusch, das sich überlappt
    if (Math.random() < 0.5) {
      const f2 = zwischen(1000, 1800);
      this.rauschStoss(t + zwischen(0.08, 0.15), zwischen(0.25, 0.35), laut * 0.6, 'bandpass', f2, f2 * 0.7, 0.5, 0.09);
    }
  }

  // Platschen ins Wasser (laut 0 bis 1)
  platsch(laut = 1) {
    if (!this.ctx || laut <= 0) return;
    const t = this.ctx.currentTime;
    const l = EINSTELLUNGEN.wasserLautstaerke * Math.min(1, laut);
    // Das "Schwapp": Rauschen, das immer dumpfer wird
    this.rauschStoss(t, 0.45, l * 0.8, 'lowpass', 2400, 260, 0.8, 0.01);
    // Das "Plopp": ein Ton, der schnell nach unten rutscht
    this.ton(t, 520, 140, 0.12, l * 0.5);
    // Ein paar Tröpfchen danach
    for (let k = 0; k < 3; k++) {
      const f = zwischen(900, 1800);
      this.ton(t + zwischen(0.1, 0.35), f, f * 1.6, 0.05, l * 0.15);
    }
  }

  // ---------- Angeln ----------
  // Auswerfen: "Wusch" durch die Luft und die Rolle surrt
  angelAuswerfen() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + 0.25; // passt zum Schwung nach vorne
    const l = Math.max(EINSTELLUNGEN.angelLautstaerke, 0.0001);
    this.rauschStoss(t, 0.4, l * 0.5, 'bandpass', 700, 2600, 1.5, 0.12);
    // Surren: ein Ton, der schnell an- und abschwillt (wie eine Rolle mit Zähnchen)
    const osz = ctx.createOscillator();
    osz.type = 'triangle';
    osz.frequency.setValueAtTime(1100, t);
    osz.frequency.exponentialRampToValueAtTime(600, t + 0.75);
    const zaehne = ctx.createOscillator(); // macht das "Rrrrr"
    zaehne.frequency.setValueAtTime(45, t);
    zaehne.frequency.linearRampToValueAtTime(25, t + 0.75);
    const zaehneTiefe = ctx.createGain();
    zaehneTiefe.gain.value = 0.5;
    const rrr = ctx.createGain();
    rrr.gain.value = 0.5;
    zaehne.connect(zaehneTiefe).connect(rrr.gain);
    const huelle = ctx.createGain();
    huelle.gain.setValueAtTime(0.0001, t);
    huelle.gain.exponentialRampToValueAtTime(l * 0.18, t + 0.05);
    huelle.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 2500;
    osz.connect(rrr).connect(filter).connect(huelle).connect(this.effekte);
    osz.start(t);
    zaehne.start(t);
    osz.stop(t + 0.85);
    zaehne.stop(t + 0.85);
  }

  // Biss: "Blubb blubb" – Luftblasen steigen auf
  angelBiss(staerke = 1) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const l = EINSTELLUNGEN.angelLautstaerke * staerke;
    const blasen = staerke < 0.6 ? 1 : 3;
    for (let k = 0; k < blasen; k++) {
      const f = zwischen(260, 380);
      this.ton(t + k * zwischen(0.08, 0.14), f, f * 2.6, 0.07, l * 0.45);
    }
  }

  // Fang ist draußen: kleiner Jubel bei einem Fisch, "Bäh" bei Müll
  angelFang(istFisch) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const l = EINSTELLUNGEN.angelLautstaerke;
    if (istFisch) {
      // Ta-da! Fröhlich nach oben (C-E-G-C)
      [72, 76, 79, 84].forEach((n, i) => this.klavier(n, t + i * 0.09, i === 3 ? 1.2 : 0.5, 0.22 * l, this.effekte));
      this.klingeln(t + 0.36, 2093, 0.8, 0.06 * l);
    } else {
      // "Bäh-bäääh": zwei weiche Töne rutschen traurig nach unten
      this.ton(t, 330, 300, 0.25, 0.2 * l, 'triangle', 0.03);
      this.ton(t + 0.28, 294, 220, 0.55, 0.2 * l, 'triangle', 0.03);
    }
  }

  // ---------- Händler ----------
  // Münzen klimpern (anzahl = wie viele Münzen man ungefähr hört)
  muenzen(anzahl = 4) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const l = EINSTELLUNGEN.muenzenLautstaerke;
    const n = Math.max(2, Math.min(8, anzahl));
    let zeit = t;
    for (let k = 0; k < n; k++) {
      this.klingeln(zeit, zwischen(2300, 3400), 0.25, l * 0.07);
      zeit += zwischen(0.04, 0.09);
    }
  }

  // Die Kasse: "Ka" (Schublade) – "tsching" (Glöckchen)
  kasse() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const l = EINSTELLUNGEN.muenzenLautstaerke;
    this.rauschStoss(t, 0.06, l * 0.4, 'bandpass', 900, 900, 2, 0.002);
    this.ton(t, 180, 90, 0.08, l * 0.25);
    this.klingeln(t + 0.12, 2637, 0.9, l * 0.12);
    this.klingeln(t + 0.12, 3520, 0.7, l * 0.07);
    this.rauschStoss(t + 0.12, 0.35, l * 0.08, 'highpass', 7000, 7000, 0.7, 0.003);
  }

  // Warnung: Der Tag ist bald um – drei kurze, helle Pieptöne
  warnPiep() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    for (let i = 0; i < 3; i++) this.ton(t + i * 0.22, 1760, 1760, 0.12, 0.18, 'square', 0.004);
  }

  // "Geht nicht" – freundlich, nicht schimpfend: dö-döm (nach unten)
  gehtNicht() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.ton(t, hertz(64), hertz(64), 0.16, 0.2, 'triangle', 0.01);
    this.ton(t + 0.17, hertz(60), hertz(59), 0.32, 0.2, 'triangle', 0.01);
  }

  // =============================================================
  //  UMGEBUNG – Dauer-Geräusche. Einmal pro Bild aufrufen.
  //  wasserNaehe: 0 = kein Wasser, 1 = direkt am Meer
  //  imGebuesch:  steht man in einem Busch? (true/false oder 0 bis 1)
  //  imGras:      wie viel Gras/Farn ist hier? (0 bis 1, raschelt leiser)
  //  watet:       läuft man gerade durchs flache Wasser?
  //  tempo:       wie schnell läuft man (Meter pro Sekunde)
  // =============================================================
  umgebung({ wasserNaehe = 0, imGebuesch = 0, imGras = 0, watet = false, tempo = 0 } = {}) {
    if (!this.ctx) return;
    const jetzt = this.ctx.currentTime;

    // Meeresrauschen: nur ab und zu nachstellen (spart Rechenarbeit)
    if (jetzt >= this.naechstesUpdate) {
      this.naechstesUpdate = jetzt + 0.15;
      const ziel = Math.round(Math.min(1, Math.max(0, wasserNaehe)) * 50) / 50;
      if (ziel !== this.meerZiel) {
        this.meerZiel = ziel;
        this.meerLaut.gain.setTargetAtTime(ziel * ziel * EINSTELLUNGEN.meerLautstaerke, jetzt, 0.6);
      }
    }

    // Schritte: Rascheln im Busch/Gras, Plätschern im Wasser
    if (tempo < 0.8) return;
    if (jetzt < this.naechsterSchritt) return;
    const busch = imGebuesch === true ? 1 : imGebuesch || 0;
    const gras = Math.min(1, imGras) * 0.35;
    const staerke = Math.max(busch, gras);
    // Je schneller man läuft, desto öfter raschelt es
    this.naechsterSchritt = jetzt + Math.max(0.16, 2.2 / (tempo + 1.5)) * zwischen(0.85, 1.15);
    if (watet) this.platsch(0.22 + Math.random() * 0.1);
    else if (staerke > 0.05) this.rascheln(staerke * Math.min(1, tempo / 6));
  }

  // Das Meer: Rauschen (in einer Schleife) durch zwei Filter, das sanft an- und abschwillt
  baueMeer() {
    const ctx = this.ctx;
    const quelle = ctx.createBufferSource();
    quelle.buffer = this.rauschen;
    quelle.loop = true;
    const tief = ctx.createBiquadFilter(); // dumpfes Grollen
    tief.type = 'lowpass';
    tief.frequency.value = 420;
    const hell = ctx.createBiquadFilter(); // das "Schschsch" der Wellen
    hell.type = 'bandpass';
    hell.frequency.value = 1300;
    hell.Q.value = 0.5;
    const hellLaut = ctx.createGain();
    hellLaut.gain.value = 0.35;
    // Wellen: Ein ganz langsamer Ton (eine Welle alle ~8 Sekunden) schiebt die Lautstärke hin und her
    const welle = ctx.createGain();
    welle.gain.value = 0.6;
    const welleTakt = ctx.createOscillator();
    welleTakt.frequency.value = 0.12;
    const welleTiefe = ctx.createGain();
    welleTiefe.gain.value = 0.4;
    welleTakt.connect(welleTiefe).connect(welle.gain);
    this.meerLaut = ctx.createGain();
    this.meerLaut.gain.value = 0;
    quelle.connect(tief).connect(welle);
    quelle.connect(hell).connect(hellLaut).connect(welle);
    welle.connect(this.meerLaut).connect(this.effekte);
    quelle.start();
    welleTakt.start();
  }
}
