// =============================================================
//  UI-BILDER 🎨 – selbst gemalte Knöpfe und Anzeigen
//  Jedes Bild ist ein kleines SVG ("Vektor-Bild"): Es besteht aus
//  Formen wie Kreisen und Linien und bleibt darum auf jedem
//  Bildschirm scharf. Alle haben einen dunklen Rand – wie im Comic.
//
//  So benutzt man sie:
//    uiBild('rucksack')            → gibt das SVG als Text zurück
//    <span data-ui-bild="karte">   → wird beim Start automatisch ersetzt
// =============================================================

// Die dunkle Comic-Randfarbe für alle Bilder
const R = '#3b2412';

const BILDER = {
  // Roter Rucksack mit Klappe, Tasche und Trägern
  rucksack: `
    <path d="M22 14 Q22 6 32 6 Q42 6 42 14" fill="none" stroke="${R}" stroke-width="7" stroke-linecap="round"/>
    <path d="M22 14 Q22 6 32 6 Q42 6 42 14" fill="none" stroke="#a8432c" stroke-width="3" stroke-linecap="round"/>
    <rect x="12" y="13" width="40" height="45" rx="13" fill="#e2553b" stroke="${R}" stroke-width="3.5"/>
    <path d="M12 30 Q12 15 32 15 Q52 15 52 30 L52 32 Q32 38 12 32 Z" fill="#c43e29" stroke="${R}" stroke-width="3.5" stroke-linejoin="round"/>
    <rect x="28" y="28" width="8" height="8" rx="2.5" fill="#ffd34d" stroke="${R}" stroke-width="2.5"/>
    <rect x="19" y="41" width="26" height="13" rx="5" fill="#c43e29" stroke="${R}" stroke-width="3"/>
    <ellipse cx="21" cy="21" rx="5" ry="2.5" fill="#fff" opacity="0.45"/>`,

  // Gefaltete Schatzkarte mit Insel, Weg und rotem X
  karte: `
    <path d="M6 14 L22 8 L42 14 L58 8 L58 52 L42 58 L22 52 L6 58 Z" fill="#f4dfa8" stroke="${R}" stroke-width="3.5" stroke-linejoin="round"/>
    <path d="M22 8 L22 52 M42 14 L42 58" stroke="#c9a467" stroke-width="2.5"/>
    <path d="M12 38 Q14 24 26 26 Q34 18 44 26 Q54 30 50 42 Q40 50 28 46 Q14 48 12 38 Z" fill="#7cc957" stroke="#4d8a2e" stroke-width="2.5"/>
    <path d="M18 40 Q26 34 32 38 T44 32" fill="none" stroke="#8a5a2b" stroke-width="2.5" stroke-dasharray="3 3" stroke-linecap="round"/>
    <path d="M41 27 L49 35 M49 27 L41 35" stroke="#d23a2a" stroke-width="4" stroke-linecap="round"/>`,

  // Dickes Aufgabenbuch mit Lesezeichen
  buch: `
    <path d="M10 10 Q10 6 14 6 L52 6 L52 50 L14 50 Q10 50 10 54 Z" fill="#3f8fd6" stroke="${R}" stroke-width="3.5" stroke-linejoin="round"/>
    <path d="M10 54 Q10 58 14 58 L52 58 L52 50 L14 50 Q10 50 10 54 Z" fill="#fff6dc" stroke="${R}" stroke-width="3.5" stroke-linejoin="round"/>
    <path d="M16 54 L48 54" stroke="#d8c18f" stroke-width="2"/>
    <rect x="20" y="14" width="24" height="12" rx="4" fill="#fff6dc" stroke="${R}" stroke-width="2.5"/>
    <path d="M24 20 L40 20" stroke="#a07a40" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M40 50 L40 62 L44 58 L48 62 L48 50" fill="#e2553b" stroke="${R}" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M18 34 L32 34 M18 40 L28 40" stroke="#ffffff" stroke-width="3" stroke-linecap="round" opacity="0.5"/>`,

  // Zwei verbundene Musiknoten
  note: `
    <path d="M24 46 L24 14 L52 8 L52 40" fill="none" stroke="${R}" stroke-width="9" stroke-linejoin="round"/>
    <path d="M24 46 L24 14 L52 8 L52 40" fill="none" stroke="#8b5cf6" stroke-width="4" stroke-linejoin="round"/>
    <path d="M24 16 L52 10 L52 18 L24 24 Z" fill="#8b5cf6" stroke="${R}" stroke-width="3" stroke-linejoin="round"/>
    <ellipse cx="17" cy="47" rx="10" ry="8" fill="#8b5cf6" stroke="${R}" stroke-width="3.5"/>
    <ellipse cx="45" cy="41" rx="10" ry="8" fill="#8b5cf6" stroke="${R}" stroke-width="3.5"/>
    <ellipse cx="14" cy="44" rx="3.5" ry="2" fill="#fff" opacity="0.6"/>
    <ellipse cx="42" cy="38" rx="3.5" ry="2" fill="#fff" opacity="0.6"/>`,

  // Dicker Pfeil nach oben mit "Boing"-Strichen = springen
  sprung: `
    <path d="M32 5 L56 32 L42 32 L42 52 L22 52 L22 32 L8 32 Z" fill="#3ba7ff" stroke="${R}" stroke-width="4" stroke-linejoin="round"/>
    <path d="M32 11 L48 29 L38 29 L38 34" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" opacity="0.55"/>
    <path d="M16 59 L48 59" stroke="${R}" stroke-width="4" stroke-linecap="round"/>
    <path d="M8 46 L13 44 M56 46 L51 44" stroke="${R}" stroke-width="3" stroke-linecap="round"/>`,

  // Goldene Münze mit Stern
  muenze: `
    <circle cx="32" cy="34" r="25" fill="#c98a12" stroke="${R}" stroke-width="3.5"/>
    <circle cx="32" cy="30" r="25" fill="#ffc93a" stroke="${R}" stroke-width="3.5"/>
    <circle cx="32" cy="30" r="17" fill="#ffdb6b" stroke="#d99a16" stroke-width="3"/>
    <path d="M32 19 L35 26.5 L43 27 L37 32 L39 40 L32 35.5 L25 40 L27 32 L21 27 L29 26.5 Z" fill="#f0a91c" stroke="#b97a0c" stroke-width="2" stroke-linejoin="round"/>
    <ellipse cx="22" cy="17" rx="6" ry="3" fill="#fff" opacity="0.6" transform="rotate(-30 22 17)"/>`,

  // Ein knuspriges Brot (für den Satt-Balken)
  brot: `
    <path d="M8 38 Q6 20 32 18 Q58 20 56 38 Q56 50 32 50 Q8 50 8 38 Z" fill="#e3a352" stroke="${R}" stroke-width="3.5"/>
    <path d="M14 34 Q14 26 32 24 Q50 26 50 34" fill="none" stroke="#f5c983" stroke-width="4" stroke-linecap="round"/>
    <path d="M22 28 L19 36 M32 26 L30 35 M42 28 L40 36" stroke="#a8652a" stroke-width="3" stroke-linecap="round"/>`,

  // Hammer für die Werkbank
  hammer: `
    <rect x="28" y="22" width="9" height="38" rx="4" fill="#c98a4d" stroke="${R}" stroke-width="3.5" transform="rotate(-35 32 40)"/>
    <path d="M10 18 L34 6 Q40 4 42 9 L46 18 Q48 22 44 24 L20 36 Q15 38 13 33 Z" fill="#9aa7b4" stroke="${R}" stroke-width="3.5" stroke-linejoin="round"/>
    <path d="M16 22 L36 12" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity="0.6"/>`,

  // Kleines Haus für die Base
  haus: `
    <rect x="13" y="28" width="38" height="28" rx="4" fill="#f3d9a4" stroke="${R}" stroke-width="3.5"/>
    <path d="M6 31 L32 9 L58 31 Q60 34 56 35 L8 35 Q4 34 6 31 Z" fill="#e2553b" stroke="${R}" stroke-width="3.5" stroke-linejoin="round"/>
    <rect x="27" y="39" width="11" height="17" rx="3" fill="#a8652a" stroke="${R}" stroke-width="3"/>
    <rect x="41" y="39" width="7" height="7" rx="2" fill="#8fd3ff" stroke="${R}" stroke-width="2.5"/>
    <path d="M18 27 L32 15" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity="0.5"/>`,

  // Holztruhe mit goldenem Schloss
  truhe: `
    <path d="M8 26 Q8 10 32 10 Q56 10 56 26 L56 30 L8 30 Z" fill="#b8733a" stroke="${R}" stroke-width="3.5" stroke-linejoin="round"/>
    <rect x="8" y="29" width="48" height="26" rx="4" fill="#a8652a" stroke="${R}" stroke-width="3.5"/>
    <path d="M20 11 L20 55 M44 11 L44 55" stroke="#ffc93a" stroke-width="4"/>
    <path d="M20 11 L20 55 M44 11 L44 55" stroke="${R}" stroke-width="1.5" opacity="0.4"/>
    <rect x="27" y="25" width="10" height="12" rx="3" fill="#ffc93a" stroke="${R}" stroke-width="2.5"/>
    <path d="M14 18 Q20 13 28 13" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity="0.4" fill="none"/>`,

  // Heißluftballon
  ballon: `
    <path d="M32 4 Q54 4 54 24 Q54 36 38 46 L26 46 Q10 36 10 24 Q10 4 32 4 Z" fill="#e2553b" stroke="${R}" stroke-width="3.5"/>
    <path d="M32 4 Q22 18 26 46 M32 4 Q42 18 38 46" fill="none" stroke="#ffd34d" stroke-width="5"/>
    <path d="M32 4 Q22 18 26 46 M32 4 Q42 18 38 46" fill="none" stroke="${R}" stroke-width="2" opacity="0.5"/>
    <path d="M27 46 L26 52 M37 46 L38 52" stroke="${R}" stroke-width="2.5"/>
    <rect x="24" y="51" width="16" height="10" rx="3" fill="#a8652a" stroke="${R}" stroke-width="3"/>
    <ellipse cx="20" cy="16" rx="4" ry="6" fill="#fff" opacity="0.45"/>`,

  // Grüner Haken = geschafft
  haken: `
    <circle cx="32" cy="32" r="26" fill="#5cc23a" stroke="${R}" stroke-width="3.5"/>
    <path d="M19 33 L28 42 L46 22" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`,

  // Oranger Pfeil = das machst du gerade
  pfeil: `
    <circle cx="32" cy="32" r="26" fill="#ffb02e" stroke="${R}" stroke-width="3.5"/>
    <path d="M18 32 L44 32 M34 21 L45 32 L34 43" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`,

  // Schloss = kommt später
  schloss: `
    <path d="M21 28 L21 20 Q21 9 32 9 Q43 9 43 20 L43 28" fill="none" stroke="${R}" stroke-width="9"/>
    <path d="M21 28 L21 20 Q21 9 32 9 Q43 9 43 20 L43 28" fill="none" stroke="#b9c3cc" stroke-width="4"/>
    <rect x="13" y="27" width="38" height="29" rx="7" fill="#ffc93a" stroke="${R}" stroke-width="3.5"/>
    <circle cx="32" cy="39" r="4" fill="${R}"/>
    <path d="M32 41 L32 48" stroke="${R}" stroke-width="4" stroke-linecap="round"/>`,
};

// Gibt ein Bild als SVG-Text zurück (zum Einbauen mit innerHTML)
export function uiBild(name, klasse = '') {
  const inhalt = BILDER[name];
  if (!inhalt) return '';
  return `<svg class="ui-bild ${klasse}" viewBox="0 0 64 64" aria-hidden="true">${inhalt}</svg>`;
}

// Alle Platzhalter <span data-ui-bild="..."> im HTML durch Bilder ersetzen
export function uiBilderEinsetzen(wurzel = document) {
  for (const el of wurzel.querySelectorAll('[data-ui-bild]')) {
    el.innerHTML = uiBild(el.dataset.uiBild);
    el.removeAttribute('data-ui-bild');
  }
}

// Gleich beim Laden einmal machen (für die Knöpfe aus index.html)
if (typeof document !== 'undefined') uiBilderEinsetzen();
