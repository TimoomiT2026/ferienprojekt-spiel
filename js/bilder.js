// =============================================================
//  UNSERE EIGENEN SPIEL-BILDER (Icons)
//  Jedes Ding im Spiel bekommt ein selbst gemaltes Bild statt eines Emojis.
//  Gemalt wird mit SVG: Das sind "Mal-Befehle" (Kreis hier, Linie da),
//  die der Browser in jeder Größe scharf zeichnet.
//  Alle Bilder sind 64 × 64 groß und im gleichen Stil:
//    runde Formen · dunkler weicher Rand · Farbverlauf · Glanzpunkt · Schatten unten
// =============================================================

// Die Rand-Farbe (fast schwarzes Braun) – gleich für alle Bilder
const RAND = '#3b2416';

// ---------- Farbverläufe ----------
// Ein Verlauf geht von oben (hell) nach unten (dunkel). Jeder hat einen
// eindeutigen Namen (spb-…), damit sich nichts gegenseitig überschreibt.
const VERLAEUFE = {
  gold: ['#fff3a6', '#ffcb2e', '#e08a00'],
  metall: ['#ffffff', '#cdd6df', '#8794a3'],
  eisen: ['#a9b3bf', '#6c7682', '#4a525d'],
  holz: ['#f0bf86', '#c98a50', '#9c5f2e'],
  rinde: ['#b47a46', '#87512a', '#5f3519'],
  schnitt: ['#fff0c6', '#f1c57e', '#d99a4e'],
  stein: ['#e6e9ec', '#a9b0b8', '#757d87'],
  kohle: ['#737985', '#33373e', '#16181c'],
  erz: ['#d7a184', '#a8624a', '#723c2c'],
  rot: ['#ff9a80', '#ec4630', '#b3221a'],
  gruen: ['#c8f57a', '#6cc944', '#2f8a2e'],
  gruenDunkel: ['#8fdb5a', '#3f9f3a', '#1f6a2a'],
  blau: ['#b5ecff', '#4cb1f0', '#2068c2'],
  orange: ['#ffdd8a', '#ffa030', '#e0640e'],
  brot: ['#ffe2a6', '#eca752', '#b8691f'],
  pink: ['#ffd2dc', '#ff8fae', '#e05d86'],
  beige: ['#fff0c8', '#e6c283', '#b98f4d'],
  leder: ['#d99a62', '#a3612f', '#6e3f1b'],
  pilz: ['#ff9fc8', '#e2408f', '#8a2a9a'],
  creme: ['#ffffff', '#f6eedc', '#dccba6'],
  edel: ['#e0fdff', '#68dcf5', '#2a8de0', '#3a4fc9'],
  fisch: ['#b4f6ff', '#4cc6ea', '#2a7fc6'],
  grill: ['#ffd38a', '#d9843a', '#8f4a1a'],
  muschel: ['#fff4ea', '#ffc6ad', '#ef8a74'],
  dunkel: ['#7a4524', '#4a2612'],
  dach: ['#ff9d7a', '#e04a32', '#a92a1e'],
  stroh: ['#fff0a0', '#f2c24a', '#c98a22'],
  glas: ['#effcff', '#9fe2ff', '#3fa0e6'],
  erde: ['#9a6a3e', '#6a4222'],
  pferd: ['#e6ad78', '#bf7a42', '#8a4f24'],
  wandWeiss: ['#ffffff', '#f3e8d2', '#ddc79e'],
  // Wochenmarkt: Kaffee, Limo und der Nachthimmel auf dem Limo-Etikett
  kaffee: ['#b07a4e', '#6b3d1f', '#3e2210'],
  limo: ['#fffbc0', '#ffe347', '#f2b400'],
  nacht: ['#8a9cff', '#4148c0', '#22246e'],
};

// Runde Verläufe (Licht kommt von links oben)
const RUNDE_VERLAEUFE = {
  kokos: ['#b8804c', '#7a4a24', '#4a2a12'],
  apfel: ['#ff9f88', '#e8352a', '#a51c18'],
  insa: ['#fff4ee', '#ff5a48', '#d10f0a', '#7a050a'],
};

function verlaufsDefs() {
  let s = '';
  for (const [name, farben] of Object.entries(VERLAEUFE)) {
    const stops = farben.map((f, i) => `<stop offset="${i / (farben.length - 1)}" stop-color="${f}"/>`).join('');
    s += `<linearGradient id="spb-${name}" x1="0" y1="0" x2="0" y2="1">${stops}</linearGradient>`;
  }
  for (const [name, farben] of Object.entries(RUNDE_VERLAEUFE)) {
    const stops = farben.map((f, i) => `<stop offset="${i / (farben.length - 1)}" stop-color="${f}"/>`).join('');
    s += `<radialGradient id="spb-${name}" cx=".35" cy=".3" r=".8">${stops}</radialGradient>`;
  }
  // Das rote Leuchten ums Insadorium (wird nach außen durchsichtig)
  s += '<radialGradient id="spb-glut"><stop offset="0" stop-color="#ff4a30" stop-opacity=".75"/><stop offset=".55" stop-color="#ff3020" stop-opacity=".3"/><stop offset="1" stop-color="#ff3020" stop-opacity="0"/></radialGradient>';
  return s;
}

// Die Verläufe kommen EINMAL unsichtbar in die Seite. Alle Bilder benutzen sie.
// (So stehen die Verläufe nicht hundertmal in der Seite und
//  verschwinden nicht, wenn ein Fenster gerade zu ist.)
function verlaeufeEinbauen() {
  if (typeof document === 'undefined' || document.getElementById('spiel-bilder-verlaeufe')) return;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.id = 'spiel-bilder-verlaeufe';
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('width', '0');
  svg.setAttribute('height', '0');
  svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none';
  svg.innerHTML = `<defs>${verlaufsDefs()}</defs>`;
  (document.body || document.documentElement).prepend(svg);
}

// Meldungen oben im Bild zeigen nur Text. Steht trotzdem ein Bild darin
// (z. B. „Gefunden: [Stein] Stein!“), machen wir daraus ein echtes Bild.
function meldungenMitBildern() {
  const feld = typeof document !== 'undefined' && document.getElementById('meldung');
  if (!feld) return;
  new MutationObserver(() => {
    const t = feld.textContent;
    if (t.includes('<svg') || t.includes('<span class="insadorium')) feld.innerHTML = t;
  }).observe(feld, { childList: true, characterData: true, subtree: true });
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { verlaeufeEinbauen(); meldungenMitBildern(); });
  } else {
    verlaeufeEinbauen();
    meldungenMitBildern();
  }
}

// ---------- Kleine Mal-Helfer ----------
// Farbe aus einem Verlauf holen
const F = (name) => `url(#spb-${name})`;
// Glanzpunkt (weißer, halb durchsichtiger Fleck)
const glanz = (x, y, rx, ry, w = -30, o = 0.7) =>
  `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" transform="rotate(${w} ${x} ${y})" fill="#fff" opacity="${o}" stroke="none"/>`;
// Funkeln (kleiner Stern mit 4 Zacken)
const funkeln = (x, y, r, farbe = '#fff') =>
  `<path d="M${x} ${y - r}Q${x} ${y} ${x + r} ${y}Q${x} ${y} ${x} ${y + r}Q${x} ${y} ${x - r} ${y}Q${x} ${y} ${x} ${y - r}Z" fill="${farbe}" stroke="${RAND}" stroke-width="1"/>`;
// Dicke Linie mit dunklem Rand (Angelrute, Seil, Wurm …)
const strich = (d, farbe, breite) =>
  `<path d="${d}" fill="none" stroke="${RAND}" stroke-width="${breite + 5}"/><path d="${d}" fill="none" stroke="${farbe}" stroke-width="${breite}"/>`;
// Dünne Linie ohne Rand (Muster, Ritzen, Rillen)
const linie = (d, farbe, breite = 2, o = 1) =>
  `<path d="${d}" fill="none" stroke="${farbe}" stroke-width="${breite}" opacity="${o}"/>`;

// Baut aus dem Inhalt ein fertiges Bild: Schatten unten + Rand für alle Formen
function bild(inhalt, { schatten = true, klasse = '' } = {}) {
  return `<svg class="spiel-bild${klasse ? ' ' + klasse : ''}" viewBox="0 0 64 64" aria-hidden="true">` +
    (schatten ? '<ellipse cx="32" cy="57.5" rx="20" ry="4.5" fill="#000" opacity=".2"/>' : '') +
    `<g stroke="${RAND}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round">${inhalt}</g></svg>`;
}

// ---------- Teile, die mehrmals vorkommen ----------
// Ein Fisch (für den rohen und den gegrillten Tofu-Fisch)
const fisch = (farbe, kiemen) =>
  `<path d="M45 32l13-11c3 7 3 15 0 22z" fill="${F(farbe)}"/>` +
  `<path d="M21 21c4-6 13-8 19-4l-3 6z" fill="${F(farbe)}"/>` +
  `<path d="M5 33c4-10 16-16 28-15 10 1 16 7 18 14-2 7-8 13-18 14-12 1-24-5-28-13z" fill="${F(farbe)}"/>` +
  linie('M10 37c8 6 22 8 34 2', '#fff', 2.5, 0.55) +
  linie('M20 25c3 4 3 10 0 15', kiemen, 2.2) +
  `<path d="M26 36c5 0 8 3 8 8-5 0-8-3-8-8z" fill="${F(farbe)}"/>` +
  '<circle cx="13" cy="30" r="3.6" fill="#fff" stroke-width="1.5"/><circle cx="12.4" cy="30.2" r="1.7" fill="#2a1a10" stroke="none"/>' +
  glanz(31, 23, 7, 2, -8, 0.65);

// Zelt (für Zelt und Reisezelt)
const zelt = (farbe, fahne) =>
  (fahne ? strich('M32 12V4', '#8a5a34', 2) + `<path d="M33 4l9 3-9 3z" fill="${F('rot')}" stroke-width="1.8"/>` : '') +
  `<path d="M5 52C13 40 22 25 32 11c10 14 19 29 27 41z" fill="${F(farbe)}"/>` +
  '<path d="M32 11c4 14 6 28 6 41h21C51 40 42 25 32 11z" fill="#000" opacity=".13" stroke="none"/>' +
  `<path d="M32 25c-3 9-6 18-8 27h16c-2-9-5-18-8-27z" fill="${F('dunkel')}"/>` +
  `<path d="M32 25c2 10 5 19 11 27h-5c-3-9-5-18-6-27z" fill="${F(farbe)}" stroke-width="1.8"/>` +
  linie('M14 46l-4 6M50 46l4 6', RAND, 1.5) +
  glanz(22, 34, 2, 8, 30, 0.45);

// Holzhütte (für Hütte und Hütte mit Garten)
const huette =
  `<path d="M13 33L32 17l19 16z" fill="${F('rinde')}"/>` +
  `<rect x="10" y="31" width="44" height="23" rx="3" fill="${F('rinde')}"/>` +
  linie('M11 37h42M11 43h42M11 49h42', '#4e2b13', 1.8) +
  `<path d="M27 54V43c0-3 2-5 5-5s5 2 5 5v11z" fill="${F('dunkel')}"/>` +
  `<path d="M4 35L32 10l28 25c-1 3-4 4-7 2L32 18 11 37c-3 2-6 1-7-2z" fill="${F('stroh')}"/>` +
  linie('M16 30l4-4M24 23l4-3M40 20l4 3M48 26l4 4', '#c98a22', 1.8) +
  '<circle cx="35" cy="47" r="1.2" fill="#f2c24a" stroke="none"/>' +
  glanz(20, 25, 1.6, 5, 48, 0.55);

// Münze (die normale, mit einem Schlitz-Muster wie in alten Spielen)
const muenzeInhalt =
  '<circle cx="32" cy="34.5" r="23" fill="#c27400"/>' +
  `<circle cx="32" cy="31" r="23" fill="${F('gold')}"/>` +
  '<circle cx="32" cy="31" r="16.5" fill="none" stroke="#e0950a" stroke-width="2.5"/>' +
  '<rect x="28" y="19.5" width="8" height="23" rx="4" fill="#ffe57a" stroke="#d58a00" stroke-width="2.2"/>' +
  glanz(20, 20, 6, 3, -40, 0.8);

// ---------- ALLE BILDER ----------
export const BILDER = {
  // --- Werkzeuge ---
  schaufel: bild(
    '<g transform="rotate(38 32 32)">' +
      `<rect x="29" y="9" width="6" height="29" rx="3" fill="${F('holz')}"/>` +
      `<rect x="23" y="3" width="18" height="8" rx="4" fill="${F('rinde')}"/>` +
      `<path d="M20.5 38h23v8c0 8-5.5 13-11.5 15-6-2-11.5-7-11.5-15z" fill="${F('metall')}"/>` +
      `<rect x="27" y="34" width="10" height="7" rx="2.5" fill="${F('eisen')}"/>` +
      glanz(26.5, 48, 2, 5.5, 0, 0.85) +
    '</g>'
  ),
  schwert: bild(
    '<g transform="rotate(45 32 32)">' +
      `<path d="M27.5 40V14L32 4.5l4.5 9.5v26z" fill="${F('metall')}"/>` +
      linie('M32 11v27', '#8794a3', 1.6) +
      `<rect x="18.5" y="38" width="27" height="6.5" rx="3.2" fill="${F('gold')}"/>` +
      `<rect x="28.8" y="44" width="6.4" height="11" rx="2" fill="${F('leder')}"/>` +
      `<circle cx="32" cy="57" r="4.2" fill="${F('gold')}"/>` +
      glanz(30, 23, 1, 7, 0, 0.9) +
    '</g>'
  ),
  angel: bild(
    strich('M10 56Q26 24 54 8', '#d0955a', 3.5) +
    strich('M10 56l5-9', '#7a3f1e', 5) +
    linie('M54 8Q57 24 50 35', '#45505c', 1.3) +
    `<circle cx="20" cy="43" r="5" fill="${F('eisen')}"/><circle cx="20" cy="43" r="1.6" fill="#fff" stroke="none"/>` +
    '<circle cx="50" cy="42" r="7" fill="#fff"/>' +
    `<path d="M43 42a7 7 0 0 1 14 0z" fill="${F('rot')}"/>` +
    glanz(47, 39, 2.2, 1.2, -30, 0.85)
  ),
  feuerzeug: bild(
    `<path d="M28 3c7 6 10 10 7 15-2 3-9 3-11 0-3-5 1-9 4-15z" fill="${F('orange')}"/>` +
    '<path d="M29 10c3 3 4 5 3 7-1 1.5-4 1.5-5 0-1-2 0-4 2-7z" fill="#fff4a8" stroke="none"/>' +
    `<circle cx="43" cy="22" r="5" fill="${F('eisen')}"/>` +
    `<rect x="17" y="18" width="21" height="10" rx="2.5" fill="${F('metall')}"/>` +
    '<circle cx="22" cy="23" r="1.2" fill="#8794a3" stroke="none"/><circle cx="27" cy="23" r="1.2" fill="#8794a3" stroke="none"/><circle cx="32" cy="23" r="1.2" fill="#8794a3" stroke="none"/>' +
    `<rect x="15" y="27" width="32" height="28" rx="8" fill="${F('rot')}"/>` +
    linie('M21 35v12', '#fff', 3, 0.55) +
    funkeln(52, 10, 4, '#fff4a8')
  ),
  fernrohr: bild(
    '<g transform="rotate(-28 32 32)">' +
      `<rect x="5" y="28" width="16" height="9" rx="3" fill="${F('gold')}"/>` +
      `<rect x="19" y="25.5" width="16" height="14" rx="3.5" fill="${F('gold')}"/>` +
      `<rect x="33" y="21" width="24" height="23" rx="5" fill="${F('gold')}"/>` +
      `<rect x="31" y="20" width="6" height="25" rx="2.5" fill="${F('leder')}"/>` +
      `<rect x="17" y="24.5" width="5" height="16" rx="2" fill="${F('leder')}"/>` +
      `<ellipse cx="57" cy="32.5" rx="3.5" ry="10" fill="${F('glas')}"/>` +
      glanz(47, 26, 7, 1.6, 0, 0.8) +
    '</g>'
  ),
  seilkanone: bild(
    '<g transform="rotate(-28 30 34)">' +
      strich('M52 33h7', '#aeb9c5', 3) +
      strich('M59 33c0-5 3-7 5-7M59 33c0 5 3 7 5 7', '#aeb9c5', 2.5) +
      `<rect x="9" y="24" width="41" height="18" rx="9" fill="${F('rot')}"/>` +
      `<rect x="44" y="21.5" width="9" height="23" rx="4" fill="${F('gold')}"/>` +
      `<rect x="17" y="23" width="5" height="20" rx="2.5" fill="${F('gold')}"/>` +
      glanz(32, 28, 8, 1.8, 0, 0.75) +
    '</g>' +
    `<circle cx="24" cy="46" r="10" fill="${F('holz')}"/>` +
    linie('M24 37v18M15 46h18M18 40l12 12M30 40L18 52', '#7a4a24', 2) +
    `<circle cx="24" cy="46" r="3.2" fill="${F('eisen')}"/>`
  ),
  // --- Fundstücke aus der Erde ---
  stein: bild(
    `<path d="M9 46C7 34 15 22 28 20c8-2 14 0 20 5 6 5 9 12 7 20-1 6-8 9-23 9-14 0-21-3-23-8z" fill="${F('stein')}"/>` +
    linie('M30 22c-2 6 0 10 6 12M36 34c4 1 8 0 11 3M20 39c3 2 4 6 3 9', '#7a828c', 2) +
    glanz(21, 30, 6, 3, -35, 0.8)
  ),
  kohle: bild(
    `<path d="M11 44c-2-9 4-17 12-20 6-3 13-2 18 2 5 4 7 10 5 16-2 6-9 10-18 10-9 0-15-3-17-8z" fill="${F('kohle')}"/>` +
    `<path d="M40 49c0-6 5-10 10-9s7 6 5 10-15 5-15-1z" fill="${F('kohle')}"/>` +
    linie('M23 25l5 11 12-6M28 36l-6 14', '#8c95a6', 1.6, 0.8) +
    glanz(19, 32, 4, 2, -40, 0.45) + glanz(46, 44, 2.5, 1.3, -30, 0.45) +
    funkeln(34, 19, 3)
  ),
  eisenerz: bild(
    `<path d="M9 46C7 34 15 22 28 20c8-2 14 0 20 5 6 5 9 12 7 20-1 6-8 9-23 9-14 0-21-3-23-8z" fill="${F('erz')}"/>` +
    `<path d="M16 37l4-7 7 2-1 7-7 2z" fill="${F('metall')}"/>` +
    `<path d="M35 32l7-3 5 5-3 7-7-1z" fill="${F('metall')}"/>` +
    `<path d="M26 47l3-4 5 2-1 5-5 1z" fill="${F('metall')}"/>` +
    `<path d="M44 44l3-2 3 3-2 3z" fill="${F('metall')}" stroke-width="1.8"/>` +
    glanz(20, 33, 2, 1, -30, 0.9) + glanz(39, 32, 2.2, 1.1, -30, 0.9)
  ),
  gold: bild(
    `<path d="M9 45c-1-8 5-14 11-15 2-7 10-11 17-8 6 2 9 7 8 12 6 2 9 7 7 12-2 6-9 8-22 8-13 0-20-3-21-9z" fill="${F('gold')}"/>` +
    linie('M20 31c2 3 5 4 8 4M37 34c-1 4 1 7 6 8', '#c98200', 2) +
    glanz(25, 25, 5, 2.4, -30, 0.85) + glanz(42, 42, 3, 1.5, -30, 0.7) +
    funkeln(52, 14, 6, '#fff6b0') + funkeln(12, 22, 3.5, '#fff6b0')
  ),
  edelstein: bild(
    `<path d="M11 26l11-13h20l11 13-21 29z" fill="${F('edel')}"/>` +
    '<path d="M22 13l4 13h12l4-13z" fill="#fff" opacity=".4" stroke="none"/>' +
    linie('M11 26h42M26 26l6 29 6-29M22 13l4 13M42 13l-4 13', '#1d5fae', 1.6, 0.6) +
    glanz(19, 21, 3, 1.5, -50, 0.9) +
    funkeln(52, 10, 6) + funkeln(10, 44, 4)
  ),
  muschel: bild(
    `<path d="M23 45h18l5 8H18z" fill="${F('muschel')}"/>` +
    `<path d="M32 50L11 30c-4-7 0-17 8-19 3-4 9-5 13-3 4-2 10-1 13 3 8 2 12 12 8 19z" fill="${F('muschel')}"/>` +
    linie('M32 48L17 15M32 48L25 10M32 48V10M32 48l7-38M32 48l15-33M32 48L12 26M32 48l20-22', '#e07e68', 1.8) +
    glanz(22, 20, 4, 2, -40, 0.85)
  ),
  kokosnuss: bild(
    `<circle cx="27" cy="33" r="19" fill="${F('kokos')}"/>` +
    linie('M13 28c4-2 6 0 9-2M17 44c3 1 6-1 9 1M33 46c3-1 5 1 8-1M35 21c3 1 5-1 8 1', '#3e2410', 1.6) +
    '<circle cx="23" cy="21" r="2.2" fill="#2a160a" stroke="none"/><circle cx="30" cy="19.5" r="2.2" fill="#2a160a" stroke="none"/><circle cx="27" cy="26" r="2.2" fill="#2a160a" stroke="none"/>' +
    `<path d="M34 42h24a12 12 0 0 1-24 0z" fill="${F('kokos')}"/>` +
    '<path d="M37.5 42h17a8.5 8.5 0 0 1-17 0z" fill="#fffaf0" stroke-width="1.8"/>' +
    glanz(18, 25, 4, 2, -40, 0.45)
  ),
  // --- Holz, Schnur, Seil ---
  holz: bild(
    `<rect x="11" y="17" width="38" height="17" rx="8.5" fill="${F('rinde')}"/>` +
    linie('M17 23h14M21 28h18', '#4e2b13', 1.8) +
    `<ellipse cx="49" cy="25.5" rx="6.5" ry="8.5" fill="${F('schnitt')}"/>` +
    '<ellipse cx="49" cy="25.5" rx="3.2" ry="4.3" fill="none" stroke="#c98a45" stroke-width="1.5"/>' +
    `<rect x="6" y="34" width="40" height="18" rx="9" fill="${F('rinde')}"/>` +
    linie('M12 40h16M18 46h18', '#4e2b13', 1.8) +
    `<ellipse cx="46" cy="43" rx="7" ry="9" fill="${F('schnitt')}"/>` +
    '<ellipse cx="46" cy="43" rx="3.5" ry="4.6" fill="none" stroke="#c98a45" stroke-width="1.5"/>' +
    `<path d="M21 17c-2-6 2-10 8-10-1 6-4 9-8 10z" fill="${F('gruen')}"/>` +
    glanz(44, 38, 1.5, 3, 0, 0.7)
  ),
  schnur: bild(
    strich('M44 44c6 4 10 8 8 13', '#e6c283', 2.5) +
    `<circle cx="30" cy="35" r="18" fill="${F('beige')}"/>` +
    linie('M14 30c8 4 24 4 32-6M13 38c10 6 26 6 34-4M18 47c8 2 20 0 28-10M24 18c-4 8-4 22 2 34M36 17c4 10 4 22-2 35', '#b98f4d', 2) +
    glanz(23, 26, 5, 2.5, -35, 0.8)
  ),
  seil: bild(
    '<ellipse cx="30" cy="36" rx="21" ry="15" fill="none" stroke-width="11"/>' +
    '<ellipse cx="30" cy="36" rx="21" ry="15" fill="none" stroke="#e6c283" stroke-width="6"/>' +
    '<ellipse cx="30" cy="36" rx="21" ry="15" fill="none" stroke="#b98f4d" stroke-width="6" stroke-dasharray="2 4" stroke-linecap="butt"/>' +
    '<ellipse cx="30" cy="36" rx="11" ry="7.5" fill="none" stroke-width="11"/>' +
    '<ellipse cx="30" cy="36" rx="11" ry="7.5" fill="none" stroke="#f2d39a" stroke-width="6"/>' +
    '<ellipse cx="30" cy="36" rx="11" ry="7.5" fill="none" stroke="#b98f4d" stroke-width="6" stroke-dasharray="2 4" stroke-linecap="butt"/>' +
    strich('M50 40c6 3 8 9 5 15', '#e6c283', 6) +
    glanz(18, 27, 4, 1.6, -25, 0.8)
  ),
  leine: bild(
    strich('M22 12c-11 1-14 14-6 19 6 4 13-1 11-8M26 23c8 6 13 13 16 22', '#b06a36', 5) +
    linie('M26 23c8 6 13 13 16 22', '#f6d6a8', 1.2, 0.9) +
    '<circle cx="43" cy="47" r="5" fill="none" stroke-width="7"/>' +
    '<circle cx="43" cy="47" r="5" fill="none" stroke="#d6dee6" stroke-width="3"/>' +
    `<rect x="39" y="50" width="8" height="10" rx="3.5" fill="${F('metall')}"/>`
  ),
  widerhaken: bild(
    strich('M28 7c-6-4-13 0-17 5', '#e6c283', 3) +
    '<circle cx="32" cy="10" r="5" fill="none" stroke-width="7"/>' +
    '<circle cx="32" cy="10" r="5" fill="none" stroke="#d6dee6" stroke-width="3"/>' +
    strich('M32 15v29', '#b9c4cf', 5) +
    strich('M32 44c-12 0-18-6-18-14M32 44c12 0 18-6 18-14', '#b9c4cf', 5) +
    `<path d="M14 29l-3.5 5.5 7-1.5zM50 29l3.5 5.5-7-1.5z" fill="${F('metall')}"/>` +
    strich('M32 44v9', '#9aa6b2', 5) +
    `<path d="M28.5 51l3.5 7 3.5-7z" fill="${F('metall')}"/>` +
    linie('M30.5 18v20', '#fff', 1.6, 0.8)
  ),
  koeder: bild(
    `<path d="M6 55c2-8 12-12 26-12s24 4 26 12z" fill="${F('erde')}"/>` +
    '<g stroke="none" fill="#4a2a12"><circle cx="18" cy="51" r="1.3"/><circle cx="44" cy="50" r="1.3"/><circle cx="34" cy="53" r="1"/></g>' +
    strich('M14 49c0-10 8-14 14-10s4 12 12 10 8-12 8-22', '#ff8fae', 7) +
    linie('M24 38l2 3M33 45l2-3M44 34l3 1', '#e05d86', 1.4) +
    linie('M15 46c0-7 6-11 11-9', '#ffd2dc', 1.8, 0.9) +
    '<circle cx="46.3" cy="25" r="1.9" fill="#fff" stroke-width="1"/><circle cx="50.3" cy="25" r="1.9" fill="#fff" stroke-width="1"/>' +
    '<circle cx="46.6" cy="25.3" r=".9" fill="#2a1a10" stroke="none"/><circle cx="50.6" cy="25.3" r=".9" fill="#2a1a10" stroke="none"/>' +
    strich('M50 53c0-5 2-8 6-8', '#ff8fae', 5)
  ),
  // --- Essen ---
  brot: bild(
    `<path d="M7 44C7 28 19 18 32 18s25 10 25 26c0 5-3 8-8 8H15c-5 0-8-3-8-8z" fill="${F('brot')}"/>` +
    linie('M19 30l6 8M30 26l6 9M41 28l5 8', '#ffefc4', 3.5) +
    linie('M10 47c8 3 36 3 44 0', '#a85e1c', 2) +
    glanz(17, 31, 5, 2.4, -45, 0.75)
  ),
  tofufisch: bild(`<g transform="translate(0 3)">${fisch('fisch', '#2a6aa8')}</g>`),
  gegrillterFisch: bild(
    `<g transform="translate(0 6)">${fisch('grill', '#6a3410')}` +
      linie('M26 22l-5 17M35 21l-5 21M43 24l-4 15', '#5e2a0c', 3, 0.85) +
    '</g>' +
    linie('M24 14c-3-3 3-5 0-9M33 15c-3-3 3-5 0-9M42 16c-3-3 3-5 0-9', '#a9a39a', 2, 0.9)
  ),
  apfel: bild(
    strich('M32 21c0-5 1-9 4-13', '#8a5a34', 3) +
    `<path d="M32 21c-6-6-23-5-23 13 0 12 9 23 18 21 2 0 3-1 5-1s3 1 5 1c9 2 18-9 18-21 0-18-17-19-23-13z" fill="${F('apfel')}"/>` +
    `<path d="M35 14c4-6 12-7 17-4-3 6-11 8-17 4z" fill="${F('gruen')}"/>` +
    linie('M37 13c4-1 8-2 12-2', '#2f8a2e', 1.4) +
    glanz(19, 31, 3.5, 6.5, 20, 0.75)
  ),
  karotte: bild(
    `<path d="M43 20c-2-8 0-14 4-16 1 6 0 11-4 16zM43 20c4-6 10-8 16-6-3 5-9 7-16 6zM43 20c-6-3-8-9-6-14 5 2 7 8 6 14z" fill="${F('gruen')}"/>` +
    `<path d="M37 17c6-3 13 3 10 10L18 56c-4 3-8 0-6-4z" fill="${F('orange')}"/>` +
    linie('M30 28l5 4M24 38l5 3M19 46l4 3', '#c95a10', 2) +
    glanz(33, 24, 1.5, 6, 42, 0.6)
  ),
  zauberpilz: bild(
    `<path d="M24 37c0 8-2 14-3 17 4 3 18 3 22 0-1-3-3-9-3-17z" fill="${F('creme')}"/>` +
    `<path d="M7 36C7 20 18 8 32 8s25 12 25 28c0 4-6 5-25 5S7 40 7 36z" fill="${F('pilz')}"/>` +
    '<g stroke="none" fill="#fff" opacity=".95"><circle cx="21" cy="22" r="4.2"/><circle cx="37" cy="16" r="3.4"/><circle cx="46" cy="28" r="3.4"/><circle cx="30" cy="31" r="2.8"/><circle cx="14" cy="33" r="2.2"/></g>' +
    glanz(18, 16, 5, 2, -35, 0.6) +
    funkeln(55, 9, 5, '#fff4a8') + funkeln(7, 15, 3.5, '#fff4a8') + funkeln(53, 47, 3.5, '#ffd6ff')
  ),
  // --- Müll aus dem Meer ---
  schuh: bild(
    `<path d="M10 49V17c0-3 2-5 5-5h15c3 0 5 2 5 5v15c11 1 21 5 21 14v3z" fill="${F('leder')}"/>` +
    `<rect x="7" y="47" width="51" height="8" rx="4" fill="${F('dunkel')}"/>` +
    linie('M10 19h25', '#6e3f1b', 2) +
    linie('M28 22l8 0M28 27l8 0M28 32l9 1', '#f6eedc', 2.2) +
    `<rect x="14" y="30" width="8" height="7" rx="1.5" fill="${F('beige')}" stroke-width="1.6" transform="rotate(-8 18 33)"/>` +
    `<path d="M55 8c3 4 4 6 4 8a4 4 0 0 1-8 0c0-2 1-4 4-8z" fill="${F('blau')}" stroke-width="1.8"/>` +
    glanz(46, 40, 4, 1.6, -15, 0.6)
  ),
  dose: bild(
    '<g transform="rotate(-12 32 34)">' +
      `<rect x="17" y="14" width="30" height="40" rx="5" fill="${F('metall')}"/>` +
      `<rect x="17" y="24" width="30" height="20" fill="${F('rot')}"/>` +
      linie('M18.5 34h27', '#ffd54a', 3) +
      '<ellipse cx="32" cy="14" rx="15" ry="4.5" fill="#e6ebf0"/>' +
      linie('M24 14a8 2.5 0 0 0 16 0', '#8794a3', 1.5) +
      linie('M40 46c-3 1-4 4-3 7', '#8794a3', 1.5) +
      glanz(22, 39, 1.5, 8, 0, 0.55) +
    '</g>'
  ),
  alge: bild(
    `<path d="M18 56c-4-6-10-10-10-18 0-4 2-6 4-8 1 6 2 9 6 13 4 4 4 9 4 13z" fill="${F('gruen')}"/>` +
    `<path d="M32 56c2-10 10-14 8-26-1-6 4-12 10-12-2 8-4 12-3 18 1 10-7 14-7 20z" fill="${F('gruenDunkel')}"/>` +
    `<path d="M25 56c-6-10 2-18-2-28-2-6 2-12 6-14 0 8-2 12 0 18 3 9-2 16 0 24z" fill="${F('gruen')}"/>` +
    linie('M26 52c-3-8 1-16-1-24M38 50c2-8 7-12 7-22', '#2f7a2a', 1.4, 0.7) +
    '<circle cx="50" cy="38" r="3" fill="#e4f8ff" stroke="#3fa0e6" stroke-width="1.5"/><circle cx="54" cy="30" r="2" fill="#e4f8ff" stroke="#3fa0e6" stroke-width="1.3"/><circle cx="12" cy="20" r="2.2" fill="#e4f8ff" stroke="#3fa0e6" stroke-width="1.3"/>'
  ),
  // --- Abenteuer ---
  taucherbrille: bild(
    strich('M57 46V12c0-4 5-4 5 0', '#ff9a2a', 4) +
    `<path d="M5 28c0-8 6-12 14-12h20c8 0 14 4 14 12v6c0 7-5 11-12 11-6 0-7-5-12-5s-6 5-12 5c-7 0-12-4-12-11z" fill="${F('orange')}"/>` +
    `<path d="M10 29c0-5 4-8 9-8h8v16c-3 0-4 3-8 3-5 0-9-3-9-8z" fill="${F('glas')}"/>` +
    `<path d="M48 29c0-5-4-8-9-8h-8v16c3 0 4 3 8 3 5 0 9-3 9-8z" fill="${F('glas')}"/>` +
    glanz(16, 26, 3.5, 1.8, -30, 0.95) + glanz(37, 26, 3.5, 1.8, -30, 0.95)
  ),
  insadorium:
    '<span class="insadorium-bild">' +
    bild(
      '<circle cx="32" cy="32" r="31" fill="url(#spb-glut)" stroke="none"/>' +
      `<path d="M32 8c8 6 16 14 18 24-2 10-10 18-18 24-8-6-16-14-18-24 2-10 10-18 18-24z" fill="${F('insa')}"/>` +
      linie('M32 8l-8 24 8 24 8-24zM14 32h36', '#ffc0b0', 1.5, 0.75) +
      '<ellipse cx="28" cy="25" rx="4.5" ry="7" fill="#fff" opacity=".6" stroke="none"/>' +
      funkeln(51, 11, 6) + funkeln(12, 49, 4, '#ffd0c0'),
      { schatten: false }
    ) +
    '</span>',
  reisezelt: bild(zelt('orange', true)),
  ballon: bild(
    linie('M14 31l12 19M50 31L38 50M32 46v4', '#6d3f1d', 1.6) +
    `<rect x="25" y="49" width="14" height="9" rx="2.5" fill="${F('holz')}"/>` +
    linie('M25 53.5h14', '#7a4a24', 1.4) +
    `<path d="M32 4C45 4 54 13 54 25c0 10-9 17-16 21H26c-7-4-16-11-16-21C10 13 19 4 32 4z" fill="${F('rot')}"/>` +
    `<path d="M32 4c-7 6-9 30-6 42h12c3-12 1-36-6-42z" fill="${F('gold')}" stroke-width="2"/>` +
    `<rect x="24.5" y="43" width="15" height="4.5" rx="2.2" fill="${F('gold')}"/>` +
    glanz(19, 17, 3.5, 8, 25, 0.6)
  ),
  // --- Rucksäcke ---
  rucksackGross: bild(
    strich('M26 15c0-6 12-6 12 0', '#6e3f1b', 3) +
    `<rect x="13" y="14" width="38" height="42" rx="12" fill="${F('leder')}"/>` +
    `<path d="M13 27c0-8 5-12 12-12h14c7 0 12 4 12 12v3c-8 4-30 4-38 0z" fill="${F('rinde')}"/>` +
    `<rect x="20" y="37" width="24" height="14" rx="5" fill="${F('leder')}"/>` +
    linie('M22 43h20', '#6e3f1b', 1.5, 0.7) +
    `<rect x="29" y="28" width="6" height="7" rx="1.5" fill="${F('gold')}" stroke-width="1.8"/>` +
    glanz(19, 24, 1.8, 4, 0, 0.55)
  ),
  rucksackRiesig: bild(
    strich('M26 13c0-6 12-6 12 0', '#1f4f8a', 3) +
    `<rect x="9" y="12" width="46" height="45" rx="13" fill="${F('blau')}"/>` +
    `<path d="M9 26c0-9 6-13 13-13h20c7 0 13 4 13 13v3c-9 5-37 5-46 0z" fill="#2a74c8"/>` +
    `<rect x="17" y="36" width="30" height="16" rx="6" fill="${F('blau')}"/>` +
    `<rect x="6" y="4" width="52" height="10" rx="5" fill="${F('gruen')}"/>` +
    linie('M14 6v6M50 6v6', '#2f6a2a', 1.6) +
    `<rect x="29" y="27" width="6" height="7" rx="1.5" fill="${F('gold')}" stroke-width="1.8"/>` +
    funkeln(52, 40, 5, '#fff4a8') +
    glanz(15, 24, 1.8, 4, 0, 0.6)
  ),
  // --- Münzen ---
  muenze: bild(muenzeInhalt),
  wertvolleMuenze: bild(
    '<circle cx="32" cy="34.5" r="25" fill="#b56a00"/>' +
    `<circle cx="32" cy="31" r="25" fill="${F('gold')}"/>` +
    '<circle cx="32" cy="31" r="18.5" fill="#ffd84a" stroke="#d98a00" stroke-width="2.2"/>' +
    '<path d="M32 17l4.2 8.6 9.5 1.4-6.9 6.6 1.7 9.4L32 38.5 23.5 43l1.7-9.4-6.9-6.6 9.5-1.4z" fill="#fff3b0" stroke="#d98a00" stroke-width="2"/>' +
    glanz(19, 19, 7, 3, -40, 0.85) +
    funkeln(54, 10, 6) + funkeln(9, 48, 4),
    { klasse: 'muenze-bild' }
  ),

  // ---------- Base-Menü (Ausbau-Stufen) ----------
  zelt: bild(zelt('gruen', false)),
  zeltGross: bild(
    strich('M32 13V4', '#8a5a34', 2) + `<path d="M33 4l9 3-9 3z" fill="${F('gold')}" stroke-width="1.8"/>` +
    `<path d="M3 52c4-12 10-24 18-33h22c8 9 14 21 18 33z" fill="${F('blau')}"/>` +
    linie('M21 19c-4 10-8 22-9 33M43 19c4 10 8 22 9 33', '#fff', 3, 0.45) +
    `<path d="M32 25c-4 8-6 18-7 27h14c-1-9-3-19-7-27z" fill="${F('dunkel')}"/>` +
    linie('M2 52l-1 4M62 52l1 4', RAND, 1.5) +
    glanz(16, 34, 1.8, 7, 25, 0.5)
  ),
  huette: bild(huette),
  huetteGarten: bild(
    `<g transform="translate(-2 4) scale(.8)">${huette}</g>` +
    `<path d="M36 56c0-6 6-9 13-9s13 3 13 9z" fill="${F('erde')}"/>` +
    `<path d="M42 49c-2-4-2-8 0-10 2 2 2 6 0 10zM49 48c-2-5-1-9 1-11 2 3 1 7-1 11zM56 49c-2-4-1-8 1-10 2 2 1 6-1 10z" fill="${F('gruen')}" stroke-width="1.6"/>` +
    `<path d="M40 50h4l-2 4zM47 49h4l-2 4zM54 50h4l-2 4z" fill="${F('orange')}" stroke-width="1.4"/>`
  ),
  haus: bild(
    `<rect x="39" y="9" width="7" height="15" rx="1.5" fill="${F('erz')}"/>` +
    '<g stroke="none" fill="#e8e4dc" opacity=".9"><circle cx="44" cy="5" r="2.6"/><circle cx="49" cy="3" r="1.8"/></g>' +
    `<path d="M12 32L29 17l17 15z" fill="${F('wandWeiss')}"/>` +
    `<rect x="9" y="29" width="40" height="25" rx="3" fill="${F('wandWeiss')}"/>` +
    `<rect x="14" y="35" width="10" height="9" rx="2" fill="${F('glas')}"/>` +
    linie('M19 35v9M14 39.5h10', RAND, 1.5) +
    `<path d="M30 54V42c0-3 2-5 5-5s5 2 5 5v12z" fill="${F('holz')}"/>` +
    `<path d="M3 32L29 9l26 23c-1 3-4 4-7 2L29 17 10 34c-3 2-6 1-7-2z" fill="${F('dach')}"/>` +
    `<ellipse cx="51" cy="53" rx="11" ry="5" fill="${F('glas')}"/>` +
    '<path d="M48 53c1-1.5 3-1.5 4 0-1 1.5-3 1.5-4 0z" fill="#ff8a3a" stroke="none"/>' +
    glanz(20, 25, 1.4, 5, 48, 0.55)
  ),
  pferd: bild(
    `<path d="M33 13c0-5 2-9 4-10 2 3 2 8 0 11z" fill="${F('pferd')}"/>` +
    `<path d="M37 7c3 3 5 6 5 9 6 6 10 20 10 41H30c0-7 0-13-2-17-3 2-7 4-12 4-4 0-7-3-6-7 2-9 8-17 14-23 3-4 8-7 13-7z" fill="${F('pferd')}"/>` +
    `<path d="M39 8c7 4 13 14 15 26 2 10 2 17 2 23h-5c0-14-3-30-12-41z" fill="${F('dunkel')}"/>` +
    '<path d="M27 15c-4 5-9 12-12 19 2 0 4-1 5-2 3-6 6-11 8-17z" fill="#fff" opacity=".85" stroke="none"/>' +
    `<circle cx="30" cy="21" r="2.6" fill="${RAND}" stroke="none"/><circle cx="29.2" cy="20.2" r=".9" fill="#fff" stroke="none"/>` +
    `<ellipse cx="14" cy="38" rx="1.6" ry="1.1" fill="${RAND}" stroke="none"/>` +
    glanz(38, 30, 2, 6, 15, 0.45)
  ),
  // --- Wochenmarkt (Etappe 4) ---
  // Kaffee: dampfende Tasse auf einer Untertasse
  kaffee: bild(
    `<ellipse cx="31" cy="50" rx="23" ry="5.5" fill="${F('creme')}"/>` +
    strich('M44 30c8-2 11 3 9 7s-5 6-10 5', '#f6eedc', 4) +
    `<path d="M13 27c0 14 5 23 17 23s17-9 17-23z" fill="${F('creme')}"/>` +
    `<path d="M14.5 35c1 3 31 3 31 0l-.7 4c-1 3-29 3-29.6 0z" fill="${F('rot')}" stroke-width="1.6"/>` +
    `<ellipse cx="30" cy="27" rx="17" ry="4.8" fill="${F('creme')}"/>` +
    `<ellipse cx="30" cy="27.5" rx="13.5" ry="3.2" fill="${F('kaffee')}" stroke-width="1.6"/>` +
    linie('M22 20c-3-3 3-5 0-9M30 19c-3-3 3-5 0-9M38 20c-3-3 3-5 0-9', '#a9a39a', 2.2, 0.9) +
    glanz(19, 37, 1.6, 6, 10, 0.7)
  ),
  // Nacht-Limo: gelbe Limo in der Flasche, auf dem Etikett ein Mond
  nachtLimo: bild(
    `<path d="M27 10h10v3c0 3 2 5 4 7 3 4 4 7 4 12v18c0 4-3 6-6 6H25c-3 0-6-2-6-6V32c0-5 1-8 4-12 2-2 4-4 4-7z" fill="${F('glas')}"/>` +
    `<path d="M20.5 31h23v19c0 3-2 4.5-4.5 4.5h-14c-2.5 0-4.5-1.5-4.5-4.5z" fill="${F('limo')}" stroke-width="1.6"/>` +
    `<rect x="25.5" y="5" width="13" height="7" rx="2.5" fill="${F('rot')}"/>` +
    `<circle cx="32" cy="41" r="8.5" fill="${F('nacht')}" stroke-width="1.8"/>` +
    '<path d="M34.5 35.5a6 6 0 1 0 2.5 10 4.8 4.8 0 1 1-2.5-10z" fill="#fff3a6" stroke-width="1"/>' +
    glanz(23.5, 27, 1.4, 5.5, 8, 0.75) +
    `<circle cx="51" cy="47" r="8" fill="${F('limo')}"/>` +
    '<circle cx="51" cy="47" r="5.3" fill="#fffbd6" stroke-width="1.4"/>' +
    linie('M51 42v10M46 47h10M47.5 43.5l7 7M54.5 43.5l-7 7', '#f2c400', 1.3) +
    funkeln(50, 14, 4.5, '#fff4a8') + funkeln(12, 22, 3.5, '#fff4a8')
  ),
  // ---------- Sonstiges (Fenster-Titel) ----------
  truhe: bild(
    `<path d="M8 33v-7c0-8 6-14 14-14h20c8 0 14 6 14 14v7z" fill="${F('holz')}"/>` +
    `<rect x="8" y="31" width="48" height="24" rx="5" fill="${F('holz')}"/>` +
    `<rect x="14" y="12" width="6" height="43" rx="2" fill="${F('eisen')}"/>` +
    `<rect x="44" y="12" width="6" height="43" rx="2" fill="${F('eisen')}"/>` +
    linie('M9 33h46', RAND, 2) +
    `<rect x="27" y="27" width="10" height="12" rx="3" fill="${F('gold')}"/>` +
    `<circle cx="32" cy="32" r="1.6" fill="${RAND}" stroke="none"/>` +
    glanz(26, 18, 6, 1.8, -8, 0.6)
  ),
  hammer: bild(
    '<g transform="rotate(35 32 32)">' +
      `<rect x="28.5" y="21" width="7" height="37" rx="3.5" fill="${F('holz')}"/>` +
      `<path d="M15 10h28c4 0 7 3 7 7s-3 7-7 7H15c-4 0-6-3-6-7s2-7 6-7z" fill="${F('eisen')}"/>` +
      `<rect x="26" y="9" width="12" height="16" rx="3" fill="${F('metall')}"/>` +
      glanz(18, 13.5, 4, 1.4, 0, 0.75) +
    '</g>'
  ),
};

// Eine kleine Münze für Preise im Text, z. B. „25 [Münze]“
const MUENZE_KLEIN = `<span class="muenze-klein">${bild(muenzeInhalt, { schatten: false })}</span>`;
export function muenzeKlein() {
  return MUENZE_KLEIN;
}
