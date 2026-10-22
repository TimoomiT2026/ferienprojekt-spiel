// =============================================================
//  DIE INSELZEITUNG 📬 – "Der Inselbote"
//  Idee vom Game Designer: An der Base steht ein Briefkasten.
//  Am Morgen von jedem Markttag (alle 3 Spieltage) liegt die Zeitung drin.
//  Darin stehen:
//    · lustige "Fotos" von Dingen, die im Spiel WIRKLICH passiert sind
//      (die Bilder denkt sich das Spiel aus – siehe zeitung-artikel.js)
//    · die Angebote vom Wochenmarkt
//    · Ergebnis und Sieger der letzten Zauberpilz-Rallye
//    · Wetter und ein Witz
//  Alte Zeitungen kann man weiter lesen ("◀ vorige Ausgabe").
//  Zahlen zum Rumprobieren: einstellungen.js → "zeitung"
// =============================================================
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { EINSTELLUNGEN } from './einstellungen.js';
import { bodenHoehe } from './gelaende.js';
import { knopf } from './steuerung.js';
import { zufallMitSeed } from './rauschen.js';
import { istMarkttag, naechsterMarkttag } from './markttag.js';
import { DINGE } from './rucksack.js';
import { MENSCHEN } from './bewohner.js';
import { muenzeKlein } from './bilder.js';
import { VORLAGEN, FUELLER, WITZE, WETTER } from './zeitung-artikel.js';
import { foto, hintergrund, B, pokal, boot, pilz, fahne } from './zeitung-bilder.js';

const E = () => EINSTELLUNGEN.zeitung || {};

// Wie spannend ist ein Ereignis? (höher = kommt eher in die Zeitung)
const WICHTIG = {
  insadorium: 100, 'pferd-gezaehmt': 60, 'insel-entdeckt': 55, 'muenze-gefunden': 50, 'base-ausbau': 42, 'ballon-flug': 40,
  zauberpilz: 38, 'pferd-ausgerissen': 36, limo: 34, kaffee: 33, fisch: 30, muell: 28, 'nicht-geschlafen': 26, 'markt-kauf': 25,
  hunger: 22, baum: 20, grabung: 15,
};
// Für "Die Insel in Zahlen"
// [typ, Bild, Text bei 1, Text bei mehr]
const ZAHLEN = [
  ['fisch', '🐟', 'Fisch geangelt', 'Fische geangelt'], ['muell', '👞', 'Mal Müll geangelt', 'Mal Müll geangelt'],
  ['baum', '🌳', 'Baum gefällt', 'Bäume gefällt'], ['grabung', '⛏️', 'Mal gegraben', 'Mal gegraben'],
  ['zauberpilz', '🍄', 'Zauberpilz-Flug', 'Zauberpilz-Flüge'], ['ballon-flug', '🎈', 'Ballonfahrt', 'Ballonfahrten'],
  ['markt-kauf', '🛒', 'Markt-Einkauf', 'Markt-Einkäufe'], ['nicht-geschlafen', '🥱', 'Nacht wach', 'Nächte wach'], ['hunger', '😫', 'Mal Hunger', 'Mal Hunger'],
];
// Namen der Marktstände (die Preise kommen aus einstellungen.js → markt)
const STAENDE = {
  obstPreise: '🍎 Obst & Gemüse', kaffeePreise: '☕ Kaffee', limoPreise: '🍋 Limonade', steinPreise: '💎 Steine & Edelsteine',
};
const EXTRA_NAMEN = { kaffee: 'Kaffee', nachtLimo: 'Nacht-Limo', limo: 'Nacht-Limo' };
const EXTRA_BILDER = { kaffee: '☕', nachtLimo: '🍋', limo: '🍋' };

const dingName = (id) => DINGE[id]?.name || EXTRA_NAMEN[id] || id;
const dingBild = (id) => DINGE[id]?.bild || EXTRA_BILDER[id] || '🛍️';

// =============================================================
//  Der Briefkasten (3D) – rund, auf einem Holzpfosten, mit Fähnchen
//  Nur 3 Malbefehle: Kasten+Pfosten, Fähnchen, Zeitung
// =============================================================
function eingefaerbt(geo, farbe, matrix) {
  const g = geo;
  const c = new THREE.Color(farbe);
  const n = g.attributes.position.count;
  const f = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) f.set([c.r, c.g, c.b], i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(f, 3));
  for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(name)) g.deleteAttribute(name);
  if (matrix) g.applyMatrix4(matrix);
  return g;
}
const M = (x, y, z, rx = 0, ry = 0, rz = 0, s = 1) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(s, s, s));

function baueBriefkasten() {
  const gruppe = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.05 });
  const H = 1.0; // so hoch ist der Pfosten
  const teile = [
    // Holzpfosten mit Fuß
    eingefaerbt(new THREE.CylinderGeometry(0.07, 0.09, H, 8), '#8a5a34', M(0, H / 2, 0)),
    eingefaerbt(new THREE.CylinderGeometry(0.16, 0.2, 0.08, 10), '#6e4426', M(0, 0.04, 0)),
    // Halter unter dem Kasten
    eingefaerbt(new THREE.BoxGeometry(0.26, 0.05, 0.5), '#6e4426', M(0, H + 0.02, 0)),
    // Der Kasten: unten eckig, oben rund (wie ein Brot) – knallrot
    eingefaerbt(new THREE.BoxGeometry(0.42, 0.2, 0.6), '#e2402a', M(0, H + 0.15, 0)),
    eingefaerbt(new THREE.CylinderGeometry(0.21, 0.21, 0.6, 16, 1, false, -Math.PI / 2, Math.PI), '#e2402a', M(0, H + 0.25, 0, -Math.PI / 2, 0, 0)),
    // Klappe vorne (etwas heller) + Griff
    eingefaerbt(new THREE.CylinderGeometry(0.2, 0.2, 0.03, 16, 1, false, -Math.PI / 2, Math.PI), '#ff7a5a', M(0, H + 0.25, 0.305, -Math.PI / 2, 0, 0)),
    eingefaerbt(new THREE.BoxGeometry(0.4, 0.2, 0.03), '#ff7a5a', M(0, H + 0.15, 0.305)),
    eingefaerbt(new THREE.SphereGeometry(0.04, 8, 6), '#ffd23f', M(0, H + 0.34, 0.33)),
    // Goldener Streifen
    eingefaerbt(new THREE.CylinderGeometry(0.215, 0.215, 0.05, 16, 1, false, -Math.PI / 2, Math.PI), '#ffcb2e', M(0, H + 0.25, -0.12, -Math.PI / 2, 0, 0)),
    eingefaerbt(new THREE.BoxGeometry(0.43, 0.2, 0.05), '#ffcb2e', M(0, H + 0.15, -0.12)),
  ];
  const kasten = new THREE.Mesh(mergeGeometries(teile.map((g) => (g.index ? g.toNonIndexed() : g))), mat);
  kasten.castShadow = true;
  gruppe.add(kasten);

  // Das Fähnchen an der Seite: dreht sich hoch (= Post ist da!) oder runter
  const faehnchen = new THREE.Group();
  faehnchen.position.set(0.23, H + 0.2, -0.1);
  const stange = eingefaerbt(new THREE.BoxGeometry(0.03, 0.42, 0.03), '#ffcb2e', M(0, 0.18, 0));
  const fahne = eingefaerbt(new THREE.BoxGeometry(0.025, 0.14, 0.18), '#2f8fe0', M(0, 0.32, 0.08));
  const flaggeMesh = new THREE.Mesh(mergeGeometries([stange.toNonIndexed(), fahne.toNonIndexed()]), mat);
  flaggeMesh.castShadow = true;
  faehnchen.add(flaggeMesh);
  gruppe.add(faehnchen);

  // Die Zeitung, die vorne aus der Klappe guckt (nur wenn eine drin ist)
  const zeitung = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.06, 0.3, 10).rotateZ(Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: '#f6f0e0', roughness: 0.9 })
  );
  zeitung.position.set(0, H + 0.2, 0.36);
  zeitung.rotation.y = 0.25;
  zeitung.castShadow = true;
  gruppe.add(zeitung);
  return { gruppe, faehnchen, zeitung };
}

// =============================================================
export class Zeitung {
  constructor(szene, hindernisse, spiel) {
    this.spiel = spiel; // { base, tageszeit, meldung, musik, elternElement, ereignisse }
    this.ausgaben = []; // alle gespeicherten Ausgaben (die neueste hinten)
    this.ungelesen = false; // liegt eine neue Zeitung im Briefkasten?
    this.gepruefterTag = spiel.tageszeit?.tag ?? 1;
    this.zeigeNr = 0; // welche Ausgabe ist gerade im Fenster offen?
    this.zeit = 0;
    this.meldungIn = -1; // Sekunden bis zur Meldung "Die Inselzeitung ist da!"

    // ---------- Briefkasten an die Base stellen ----------
    const e = E();
    const { base } = spiel;
    const p = base?.setzeLokal ? base.setzeLokal(new THREE.Vector3(), e.briefkastenX ?? 3.6, e.briefkastenZ ?? 2.4) : new THREE.Vector3(8.6, 0, -1.5);
    // Der Briefkasten schaut in dieselbe Richtung wie die Tür der Base
    let blick = -0.6;
    if (base?.setzeLokal) {
      const a = base.setzeLokal(new THREE.Vector3(), 0, 0), b = base.setzeLokal(new THREE.Vector3(), 0, 1);
      blick = Math.atan2(b.x - a.x, b.z - a.z);
    }
    this.ort = { x: p.x, z: p.z };
    const modell = baueBriefkasten();
    this.modell = modell;
    modell.gruppe.position.set(p.x, bodenHoehe(p.x, p.z), p.z);
    modell.gruppe.rotation.y = blick;
    szene.add(modell.gruppe);
    hindernisse?.hinzufuegen(p.x, p.z, 0.3);

    // ---------- Die Aktion "📬 Briefkasten" ----------
    const zeitung = this;
    // Etwas VOR den Briefkasten (dort steht man beim Lesen)
    const vorne = new THREE.Vector3(p.x + Math.sin(blick) * 0.9, 0, p.z + Math.cos(blick) * 0.9);
    this.briefkastenIA = {
      pos: vorne,
      radius: e.radius ?? 2.0,
      bild: '📬',
      get text() {
        return zeitung.ungelesen ? 'Zeitung!' : 'Briefkasten';
      },
      ausfuehren: () => this.oeffnen(),
    };
    this.interaktionen = [this.briefkastenIA];

    this.baueFenster();
    this.zeigeBriefkasten();
  }

  // =============================================================
  //  JEDES BILD: neuer Tag? Fähnchen wackeln lassen
  // =============================================================
  aktualisiere(dt) {
    this.zeit += dt;
    const tag = this.spiel.tageszeit?.tag ?? 1;
    if (tag !== this.gepruefterTag) {
      this.gepruefterTag = tag;
      if (this.pruefeNeueAusgabe()) this.meldungIn = E().meldungNachSekunden ?? 7;
    }
    if (this.meldungIn >= 0) {
      this.meldungIn -= dt;
      if (this.meldungIn < 0) {
        this.spiel.meldung?.('📬 Die Inselzeitung ist da! Schau in den Briefkasten an der Base.', 6);
        this.spiel.musik?.pling?.();
      }
    }
    // Neue Zeitung: Fähnchen steht hoch, und der Briefkasten wackelt ein bisschen
    const { gruppe, faehnchen } = this.modell;
    const ziel = this.ungelesen ? 0 : -Math.PI / 2;
    faehnchen.rotation.z += (ziel - faehnchen.rotation.z) * Math.min(1, dt * 5);
    if (this.ungelesen) {
      const w = E().wackeln ?? 0.08;
      const puls = Math.max(0, Math.sin(this.zeit * 2.2)); // wackeln – Pause – wackeln
      gruppe.rotation.z = Math.sin(this.zeit * 14) * w * puls * puls;
      faehnchen.rotation.x = Math.sin(this.zeit * 9) * 0.25 * puls;
    } else {
      gruppe.rotation.z *= 0.9;
      faehnchen.rotation.x *= 0.9;
    }
  }

  // Ist heute Markttag und noch keine Zeitung da? Dann drucken wir eine!
  pruefeNeueAusgabe() {
    const tag = this.spiel.tageszeit?.tag ?? 1;
    if (!istMarkttag(tag) || this.ausgaben.some((a) => a.tag === tag)) return false;
    this.ausgaben.push(this.erzeuge(tag));
    const max = E().maxAusgaben ?? 30;
    if (this.ausgaben.length > max) this.ausgaben.splice(0, this.ausgaben.length - max);
    this.ungelesen = true;
    this.zeigeBriefkasten();
    return true;
  }

  zeigeBriefkasten() {
    this.modell.zeitung.visible = this.ungelesen;
  }

  // =============================================================
  //  EINE AUSGABE DRUCKEN
  //  Alles, was drin steht, wird gespeichert (Nummer, Artikel, Zufallszahl)
  //  → die Zeitung sieht beim nächsten Lesen genau gleich aus.
  // =============================================================
  erzeuge(tag) {
    const letzte = this.ausgaben[this.ausgaben.length - 1];
    const nr = (letzte?.nr ?? 0) + 1;
    const seed = ((nr * 7919 + tag * 104729) % 2147483646) + 1;
    const zufall = zufallMitSeed(seed);
    const ereignisse = this.spiel.ereignisse;
    const neue = ereignisse ? ereignisse.nachNummer(letzte?.bisNr ?? 0) : [];
    const bisNr = ereignisse ? ereignisse.zaehler : 0;

    // Ereignisse nach Typ zählen
    const gruppen = new Map();
    for (const e of neue) {
      if (!gruppen.has(e.typ)) gruppen.set(e.typ, { typ: e.typ, n: 0, letztes: e });
      const g = gruppen.get(e.typ);
      g.n++;
      g.letztes = e;
    }
    // Die spannendsten Ereignisse kommen aufs Foto
    const kandidaten = [...gruppen.values()]
      .filter((g) => VORLAGEN[g.typ])
      .map((g) => ({ ...g, punkte: (WICHTIG[g.typ] ?? 10) + Math.min(g.n, 5) * 2 + zufall() * 12 }))
      .sort((a, b) => b.punkte - a.punkte);
    const anzahl = E().fotos ?? 3;
    // Inselbewohner gemischt – jeder kommt nur einmal pro Ausgabe vor
    const leute = MENSCHEN.map((m) => m.id).sort(() => zufall() - 0.5);
    const artikel = kandidaten.slice(0, anzahl).map((g) => ({
      typ: g.typ,
      variante: Math.floor(zufall() * VORLAGEN[g.typ].length),
      mensch: leute.pop(),
      n: g.n,
      daten: { ...g.letztes.daten },
    }));
    // Zu wenig passiert? Dann erzählen die Inselbewohner
    while (artikel.length < anzahl && leute.length) {
      const id = leute.pop();
      if (FUELLER[id]) artikel.push({ typ: 'fueller', mensch: id, variante: 0, n: 0, daten: {} });
    }

    // Die Insel in Zahlen (alles seit der letzten Zeitung)
    const zahlen = ZAHLEN.filter(([typ]) => gruppen.has(typ)).map(([typ]) => [typ, gruppen.get(typ).n]);

    // Rallye: das letzte Ergebnis (egal wann)
    const r = ereignisse?.letztes('rallye');
    const rallye = r ? { ...r.daten, tag: r.tag, neu: !letzte || r.nr > (letzte.bisNr ?? 0) } : null;

    return {
      nr, tag, seed, bisNr, artikel, zahlen, rallye,
      markt: this.marktAngebote(),
      witz: Math.floor(zufall() * WITZE.length),
      wetter: Math.floor(zufall() * WETTER.length),
    };
  }

  // Die Preise vom Wochenmarkt aus einstellungen.js (robust, falls etwas fehlt)
  marktAngebote() {
    const m = EINSTELLUNGEN.markt || {};
    const normal = EINSTELLUNGEN.kaufPreise || {};
    const staende = [];
    for (const [schluessel, wert] of Object.entries(m)) {
      if (!wert || typeof wert !== 'object' || Array.isArray(wert) || !/Preise$/.test(schluessel)) continue;
      const waren = Object.entries(wert)
        .filter(([, preis]) => typeof preis === 'number')
        .map(([id, preis]) => ({ id, preis, statt: typeof normal[id] === 'number' && normal[id] > preis ? normal[id] : null }));
      if (waren.length) staende.push({ name: STAENDE[schluessel] || schluessel.replace(/Preise$/, ''), waren });
    }
    if (!staende.length) {
      // Noch keine Preise eingestellt? Dann das, was der Game Designer gesagt hat.
      staende.push({ name: '☕ Kaffee', waren: [{ id: 'kaffee', preis: 35 }] }, { name: '🍋 Limonade', waren: [{ id: 'nachtLimo', preis: 40 }] });
    }
    return staende;
  }

  // =============================================================
  //  DAS ZEITUNGS-FENSTER
  // =============================================================
  baueFenster() {
    if (!document.querySelector('link[href$="zeitung.css"]')) {
      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = new URL('../css/zeitung.css', import.meta.url).href;
      document.head.appendChild(css);
    }
    this.fenster = document.createElement('div');
    this.fenster.id = 'zeitung-fenster';
    this.fenster.className = 'spiel-fenster';
    this.fenster.innerHTML = `
      <div class="fenster-kopf"><h2>📬 Briefkasten</h2><button class="zu" aria-label="Schließen">✕</button></div>
      <div class="zeitung-inhalt"></div>
      <div class="knopf-reihe zeitung-blaettern">
        <button class="fenster-knopf gelb zeitung-vorige">◀ vorige Ausgabe</button>
        <button class="fenster-knopf gelb zeitung-naechste">nächste Ausgabe ▶</button>
      </div>`;
    (this.spiel.elternElement || document.body).appendChild(this.fenster);
    this.fenster.addEventListener('touchstart', (e) => e.stopPropagation());
    knopf(this.fenster.querySelector('.zu'), () => this.schliessen());
    knopf(this.fenster.querySelector('.zeitung-vorige'), () => this.blaettern(-1));
    knopf(this.fenster.querySelector('.zeitung-naechste'), () => this.blaettern(1));
  }

  get offen() {
    return this.fenster.classList.contains('offen');
  }

  oeffnen() {
    if (!this.ausgaben.length) {
      // Noch keine Zeitung: wann kommt die erste?
      const tag = this.spiel.tageszeit?.tag ?? 1;
      const wann = naechsterMarkttag(tag + (istMarkttag(tag) ? 1 : 0));
      this.zeigeLeer(wann);
    } else {
      this.zeigeNr = this.ausgaben[this.ausgaben.length - 1].nr;
      this.zeige();
    }
    this.fenster.classList.add('offen');
    this.fenster.scrollTop = 0;
    if (this.ungelesen) {
      this.ungelesen = false;
      this.zeigeBriefkasten();
      this.spiel.musik?.rascheln?.(0.6);
    }
  }

  schliessen() {
    this.fenster.classList.remove('offen');
  }

  blaettern(richtung) {
    const i = this.ausgaben.findIndex((a) => a.nr === this.zeigeNr);
    const neu = this.ausgaben[i + richtung];
    if (!neu) return;
    this.zeigeNr = neu.nr;
    this.zeige();
    this.fenster.scrollTop = 0;
    this.spiel.musik?.rascheln?.(0.5);
  }

  zeigeLeer(wann) {
    this.fenster.querySelector('h2').textContent = '📬 Briefkasten';
    this.fenster.querySelector('.zeitung-inhalt').innerHTML = `
      <div class="zeitung-leer">
        <div class="zeitung-leer-bild">📭</div>
        <p>Der Briefkasten ist noch leer.</p>
        <p>Die Inselzeitung <b>„Der Inselbote“</b> kommt am Morgen vom Markttag – das nächste Mal an <b>Tag ${wann}</b>.</p>
      </div>`;
    this.fenster.querySelector('.zeitung-blaettern').style.display = 'none';
  }

  // Eine Ausgabe ins Fenster malen (die SVG-Bilder entstehen erst jetzt)
  zeige() {
    const a = this.ausgaben.find((x) => x.nr === this.zeigeNr);
    if (!a) return;
    const i = this.ausgaben.indexOf(a);
    this.fenster.querySelector('h2').textContent = '🏝️ Inselbote';
    const blaettern = this.fenster.querySelector('.zeitung-blaettern');
    blaettern.style.display = this.ausgaben.length > 1 ? '' : 'none';
    this.fenster.querySelector('.zeitung-vorige').classList.toggle('gesperrt', i <= 0);
    this.fenster.querySelector('.zeitung-naechste').classList.toggle('gesperrt', i >= this.ausgaben.length - 1);
    this.fenster.querySelector('.zeitung-inhalt').innerHTML = this.alsHtml(a);
  }

  alsHtml(a) {
    const zufall = zufallMitSeed(a.seed);
    const artikel = a.artikel.map((art, i) => {
      const m = MENSCHEN.find((x) => x.id === art.mensch) || MENSCHEN[0];
      const d = { m, name: m.name, n: art.n || 1, daten: art.daten || {}, z: zufall, dingName: art.daten?.ding ? dingName(art.daten.ding) : '' };
      const vorlage = art.typ === 'fueller' ? FUELLER[art.mensch] : (VORLAGEN[art.typ] || [])[art.variante] || (VORLAGEN[art.typ] || [])[0];
      if (!vorlage) return '';
      let inhalt;
      try { inhalt = vorlage(d); } catch (f) { console.warn('Zeitungsartikel', art, f); return ''; }
      const dreh = ((i % 2 ? 1 : -1) * (0.6 + zufall() * 1.2)).toFixed(1);
      return `<article class="zeitung-artikel${i === 0 ? ' gross' : ''}">
        <h3>${inhalt.titel}</h3>
        <figure class="zeitung-foto" style="--dreh:${dreh}deg">${inhalt.bild}</figure>
        <p>${inhalt.text}</p>
      </article>`;
    }).join('');

    const zahlen = (a.zahlen || []).map(([typ, n]) => {
      const z = ZAHLEN.find((x) => x[0] === typ);
      return z ? `<li><span class="zahl-bild">${z[1]}</span><b>${n}</b> ${n === 1 ? z[2] : z[3]}</li>` : '';
    }).join('');

    const [wetterBild, wetterText] = WETTER[a.wetter] || WETTER[0];
    const [witzFrage, witzAntwort] = WITZE[a.witz] || WITZE[0];

    return `
      <div class="zeitung-blatt">
        <header class="zeitung-kopf">
          <div class="zeitung-name">Der Inselbote</div>
          <div class="zeitung-zeile"><span>Ausgabe Nr. ${a.nr}</span><span>🏝️ Die Zeitung der Inselgruppe</span><span>Tag ${a.tag}</span></div>
        </header>
        <div class="zeitung-spalten">
          ${artikel}
          ${this.marktHtml(a)}
          ${this.rallyeHtml(a)}
          ${zahlen ? `<section class="zeitung-kasten zahlen"><h4>📊 Die Insel in Zahlen</h4><ul>${zahlen}</ul><p class="klein">(seit der letzten Zeitung)</p></section>` : ''}
          <section class="zeitung-kasten wetter"><h4>Wetter</h4><p><span class="wetter-bild">${wetterBild}</span> ${wetterText}</p></section>
          <section class="zeitung-kasten witz"><h4>😂 Witz-Ecke</h4><p><b>${witzFrage}</b></p><p class="antwort">${witzAntwort}</p></section>
        </div>
      </div>`;
  }

  marktHtml(a) {
    const staende = (a.markt || []).map((s) => `
      <li class="z-stand"><div class="z-stand-name">${s.name}</div>
        ${s.waren.map((w) => `<div class="z-ware"><span class="z-ware-bild">${dingBild(w.id)}</span><span class="z-ware-name">${dingName(w.id)}</span>
          <span class="z-preis">${w.statt ? `<s>${w.statt}</s> ` : ''}<b>${w.preis}</b> ${muenzeKlein()}</span></div>`).join('')}
      </li>`).join('');
    return `<section class="zeitung-kasten markt">
      <h4>🛒 Angebote auf dem Wochenmarkt</h4>
      <p class="klein">Heute im <b>Palmendorf</b>! Nur am Markttag.</p>
      <ul class="z-staende">${staende}</ul>
    </section>`;
  }

  rallyeHtml(a) {
    const R = EINSTELLUNGEN.rallye || {};
    const gewinn = R.gewinn ?? R.preisgeld ?? 50, teilnahme = R.teilnahme ?? R.startgeld ?? 10;
    const r = a.rallye;
    const bild = foto(hintergrund('meer') +
      B.setze(84, 132, 0.8, boot()) + B.setze(84, 128, 0.7, pilz()) + B.setze(196, 140, 0.8, boot()) + B.setze(196, 136, 0.7, pilz()) + B.tempo(150, 126, 26) + B.tempo(260, 136, 26) +
      B.setze(282, 136, 1.2, fahne('#ffd23f')) + B.setze(160, 82, 1.3, pokal()) + B.wellen(150), 'Boote mit Pilzen fahren um die Wette');
    let text;
    if (!r) {
      text = `<p class="schlagzeile">Heute Rallye im Palmendorf!</p><p>Wer gewinnt die ${gewinn} Münzen? Mitmachen kostet ${teilnahme} Münzen. Pilze auf der Strecke = Turbo! 🍄</p>`;
    } else {
      const du = r.platz === 1 || /^(du|spieler|ich)$/i.test(String(r.sieger || ''));
      const sieger = du ? 'DU' : (r.sieger || 'ein Inselbewohner');
      const zeit = typeof r.zeit === 'number' ? ` in ${Math.floor(r.zeit / 60) ? `${Math.floor(r.zeit / 60)} min ` : ''}${Math.round(r.zeit % 60)} s` : '';
      const leute = Array.isArray(r.teilnehmer) ? r.teilnehmer.length : r.teilnehmer;
      text = `<p class="schlagzeile">${du ? '🏆 DU hast gewonnen!' : `🏆 Sieger: ${sieger}`}</p>
        <p>Bei der Rallye an Tag ${r.tag} ${leute ? `(${leute} Boote)` : ''} kam ${du ? 'der Forscher' : sieger} als Erstes ins Ziel${zeit}.
        ${r.platz && !du ? ` Unser Forscher wurde <b>${r.platz}.</b> – nicht schlecht!` : ''}</p>
        <p class="klein">Heute gibt es die nächste Rallye! Gewinn: ${gewinn} Münzen.</p>`;
    }
    return `<section class="zeitung-kasten rallye"><h4>🍄 Zauberpilz-Rallye</h4><figure class="zeitung-foto klein-foto">${bild}</figure>${text}</section>`;
  }

  // =============================================================
  //  SPEICHERN & LADEN (alte Spielstände ohne Zeitung gehen auch)
  // =============================================================
  alsDaten() {
    return { ausgaben: this.ausgaben, ungelesen: this.ungelesen, gepruefterTag: this.gepruefterTag };
  }

  ladeDaten(d = {}) {
    this.ausgaben = Array.isArray(d?.ausgaben) ? d.ausgaben.filter((a) => a && a.nr && Array.isArray(a.artikel)) : [];
    this.ungelesen = !!d?.ungelesen && this.ausgaben.length > 0;
    // Den heutigen Tag gleich prüfen: Ist heute Markttag und noch keine Zeitung da?
    this.gepruefterTag = this.spiel.tageszeit?.tag ?? 1;
    if (this.pruefeNeueAusgabe()) this.meldungIn = E().meldungNachSekunden ?? 7;
    this.zeigeBriefkasten();
  }
}
