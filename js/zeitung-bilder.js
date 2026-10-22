// =============================================================
//  ZEITUNGS-BILDER 📸 – die lustigen "Fotos" im Inselboten
//  Jedes Foto ist ein selbst gemaltes SVG-Bild (320 × 200).
//  Es wird aus BAUSTEINEN zusammengesetzt, wie mit Lego:
//    Hintergrund (Strand, Wiese, Nacht …) + Figuren (Kinder, Schafe,
//    Hasen, Pferde, Möwen …) + Sachen (Fisch, Boot, Pilz, Münze …)
//  Jeder Baustein ist eine kleine Funktion: baustein(x, y, größe, …)
//  Alle haben den gleichen Comic-Stil wie die Spiel-Bilder:
//    runde Formen · dunkler Rand · kräftige Farben · Glanzpunkte
// =============================================================

const RAND = '#3b2416';
export const BREITE = 320, HOEHE = 200;

// ---------- Farbverläufe (einmal unsichtbar in die Seite) ----------
const VERLAEUFE = {
  himmel: ['#7fd0ff', '#bfe9ff', '#fff6dc'],
  abend: ['#ff9a6b', '#ffc98a', '#fff0c2'],
  nacht: ['#0f1d4a', '#233a7a', '#3c4f9a'],
  meer: ['#4cc3ea', '#2a8fd0', '#1f6ab0'],
  sand: ['#fff1c4', '#f6d88d', '#e8bd63'],
  wiese: ['#b9ef7a', '#78cc48', '#4a9e32'],
  wolle: ['#ffffff', '#fbf3e2', '#e9dcc0'],
  fell: ['#f5d9b8', '#d9ae80', '#b98455'],
  pferd: ['#e6ad78', '#bf7a42', '#8a4f24'],
  holz: ['#f0bf86', '#c98a50', '#9c5f2e'],
  rinde: ['#b47a46', '#87512a', '#5f3519'],
  blatt: ['#a8ec6a', '#5fbf3c', '#2f8a2e'],
  gold: ['#fff3a6', '#ffcb2e', '#e08a00'],
  pilz: ['#ff9fc8', '#e2408f', '#8a2a9a'],
  rot: ['#ff9a80', '#ec4630', '#b3221a'],
  metall: ['#ffffff', '#cdd6df', '#8794a3'],
  limo: ['#fffbb0', '#ffe14a', '#f2a91c'],
};

function verlaeufeEinbauen() {
  if (typeof document === 'undefined' || document.getElementById('zeitung-verlaeufe')) return;
  let s = '';
  for (const [name, farben] of Object.entries(VERLAEUFE)) {
    const stops = farben.map((f, i) => `<stop offset="${i / (farben.length - 1)}" stop-color="${f}"/>`).join('');
    s += `<linearGradient id="zb-${name}" x1="0" y1="0" x2="0" y2="1">${stops}</linearGradient>`;
  }
  s += '<radialGradient id="zb-glut"><stop offset="0" stop-color="#ff4a30" stop-opacity=".8"/><stop offset=".5" stop-color="#ff3020" stop-opacity=".35"/><stop offset="1" stop-color="#ff3020" stop-opacity="0"/></radialGradient>';
  s += '<radialGradient id="zb-schein"><stop offset="0" stop-color="#fff7b0" stop-opacity=".9"/><stop offset="1" stop-color="#fff7b0" stop-opacity="0"/></radialGradient>';
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.id = 'zeitung-verlaeufe';
  svg.setAttribute('aria-hidden', 'true');
  svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none';
  svg.innerHTML = `<defs>${s}</defs>`;
  (document.body || document.documentElement).prepend(svg);
}

// ---------- Kleine Mal-Helfer ----------
const V = (name) => `url(#zb-${name})`;
// Etwas verschieben, drehen, vergrößern (spiegeln = nach links schauen)
const setze = (x, y, s, inhalt, spiegeln = false, dreh = 0) =>
  `<g transform="translate(${x} ${y}) rotate(${dreh}) scale(${spiegeln ? -s : s} ${s})">${inhalt}</g>`;
const kreis = (x, y, r, f, extra = '') => `<circle cx="${x}" cy="${y}" r="${r}" fill="${f}" ${extra}/>`;
const ell = (x, y, rx, ry, f, extra = '') => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${f}" ${extra}/>`;
const pfad = (d, f, extra = '') => `<path d="${d}" fill="${f}" ${extra}/>`;
const OHNE = 'stroke="none"';
const glanz = (x, y, rx, ry, w = -30, o = 0.6) =>
  `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" transform="rotate(${w} ${x} ${y})" fill="#fff" opacity="${o}" stroke="none"/>`;
// Dicke Linie mit dunklem Rand (Arme, Seile, Stiele)
const strich = (d, farbe, breite) =>
  `<path d="${d}" fill="none" stroke="${RAND}" stroke-width="${breite + 5}"/><path d="${d}" fill="none" stroke="${farbe}" stroke-width="${breite}"/>`;
const linie = (d, farbe = RAND, breite = 2.5, o = 1) => `<path d="${d}" fill="none" stroke="${farbe}" stroke-width="${breite}" opacity="${o}"/>`;
const schatten = (x, y, rx, ry = rx * 0.22) => ell(x, y, rx, ry, '#000', 'opacity=".18" stroke="none"');
// Viele Kreise zu EINER Wolke: erst alle mit Rand, dann alle ohne Rand drüber
const wolkig = (kreise, f) => kreise.map(([x, y, r]) => kreis(x, y, r, f)).join('') + kreise.map(([x, y, r]) => kreis(x, y, r, f, OHNE)).join('');
// Augen mit Glanzpunkt
const auge = (x, y, r = 2.8) => kreis(x, y, r, RAND, OHNE) + kreis(x - r * 0.35, y - r * 0.4, r * 0.38, '#fff', OHNE);
const backe = (x, y) => ell(x, y, 3.6, 2.2, '#ff7d8f', 'opacity=".45" stroke="none"');
// Funkeln (Stern mit 4 Zacken)
const funkeln = (x, y, r, f = '#fff7b0') =>
  `<path d="M${x} ${y - r}Q${x} ${y} ${x + r} ${y}Q${x} ${y} ${x} ${y + r}Q${x} ${y} ${x - r} ${y}Q${x} ${y} ${x} ${y - r}Z" fill="${f}" stroke="${RAND}" stroke-width="1.5"/>`;
// Comic-Schrift im Bild (z. B. "Zzz", "GRRR!")
const schrift = (x, y, text, groesse = 18, f = '#fff', dreh = 0) =>
  `<text x="${x}" y="${y}" transform="rotate(${dreh} ${x} ${y})" font-family="'Baloo 2', 'Arial Rounded MT Bold', sans-serif" font-weight="800" font-size="${groesse}" text-anchor="middle" fill="${f}" stroke="${RAND}" stroke-width="4" paint-order="stroke" stroke-linejoin="round">${text}</text>`;
// Bewegungs-Striche (zeigen: das bewegt sich schnell!)
const tempo = (x, y, laenge = 22, n = 3, abstand = 8) =>
  Array.from({ length: n }, (_, i) => linie(`M${x} ${y + i * abstand}h${-laenge + i * 4}`, '#fff', 3.5, 0.9)).join('');

// =============================================================
//  HINTERGRÜNDE
// =============================================================
const wolke = (x, y, s = 1) => setze(x, y, s, wolkig([[-14, 2, 10], [0, -4, 13], [14, 2, 10], [4, 5, 9]], '#fff'));
const sonne = (x, y, r = 18, brille = false) => {
  let strahlen = '';
  for (let i = 0; i < 10; i++) {
    const w = (i / 10) * Math.PI * 2;
    strahlen += linie(`M${x + Math.cos(w) * (r + 5)} ${y + Math.sin(w) * (r + 5)}L${x + Math.cos(w) * (r + 12)} ${y + Math.sin(w) * (r + 12)}`, '#ffb81c', 4);
  }
  return strahlen + kreis(x, y, r, V('gold')) + glanz(x - r * 0.35, y - r * 0.4, r * 0.3, r * 0.18) + (brille ? sonnenbrille(x, y - 2, r / 14) : '');
};
const mond = (x, y, r = 20, brille = false) =>
  `<path d="M${x} ${y - r}A${r} ${r} 0 0 0 ${x} ${y + r}A${r * 1.25} ${r * 1.25} 0 0 1 ${x} ${y - r}Z" fill="#fff4b8"/>` +
  (brille ? sonnenbrille(x - r * 0.5, y - 3, r / 26) : auge(x - r * 0.62, y - 4, 2.2)) + linie(`M${x - r * 0.85} ${y + 6}q4 3 7 0`, RAND, 2);
const sterne = (zufall, n = 12) => {
  let s = '';
  for (let i = 0; i < n; i++) s += funkeln(10 + zufall() * 300, 8 + zufall() * 80, 2 + zufall() * 3.5, '#fff7c8');
  return s;
};
const wellen = (y, f = V('meer')) =>
  pfad(`M0 ${y}q20 -8 40 0t40 0t40 0t40 0t40 0t40 0t40 0t40 0V200H0Z`, f, OHNE) +
  linie(`M10 ${y + 14}q10 -5 20 0M90 ${y + 22}q10 -5 20 0M190 ${y + 12}q10 -5 20 0M260 ${y + 26}q10 -5 20 0`, '#fff', 2.5, 0.7);

export function hintergrund(art, zufall = Math.random) {
  if (art === 'nacht') {
    return `<rect width="320" height="200" fill="${V('nacht')}"/>` + sterne(zufall, 16) +
      pfad('M0 150Q80 128 160 144T320 140V200H0Z', '#2c5a3a', OHNE) + pfad('M0 165Q100 150 200 162T320 158V200H0Z', '#24482f', OHNE);
  }
  if (art === 'meer') {
    return `<rect width="320" height="200" fill="${V('himmel')}"/>` + wolke(60, 34, 0.9) + wolke(250, 26, 0.7) + wellen(110);
  }
  if (art === 'wiese') {
    return `<rect width="320" height="200" fill="${V('himmel')}"/>` + wolke(250, 32) + wolke(70, 22, 0.7) +
      pfad('M0 128Q70 98 150 118T320 108V200H0Z', '#8fd85a', OHNE) + pfad('M0 150Q90 132 180 146T320 140V200H0Z', V('wiese'), OHNE) +
      linie('M30 172l3-8 3 8M120 182l3-8 3 8M240 176l3-8 3 8M290 188l3-8 3 8', '#3f8a2a', 2);
  }
  if (art === 'markt') {
    return `<rect width="320" height="200" fill="${V('himmel')}"/>` + wolke(270, 28, 0.8) +
      pfad('M0 150H320V200H0Z', V('sand'), OHNE) + linie('M0 150H320', '#d9a94e', 2);
  }
  // Strand (Standard)
  return `<rect width="320" height="200" fill="${V('himmel')}"/>` + wolke(70, 30) + wolke(240, 22, 0.75) +
    pfad('M0 112H320V150H0Z', V('meer'), OHNE) + linie('M30 122q10-5 20 0M150 130q10-5 20 0M250 120q10-5 20 0', '#fff', 2.5, 0.7) +
    pfad('M0 142Q80 132 160 140T320 136V200H0Z', V('sand'), OHNE);
}

// =============================================================
//  FIGUREN
// =============================================================
// Ein Inselbewohner (Kind). Füße bei (0,0), etwa 86 hoch.
// m = { farben: { shirt, hose, haare, haut, hut }, extra, extraFarbe }
// o.haende = [[lx, ly], [rx, ry]] – wo die Hände sind (zum Halten von Sachen)
// o.mund = 'lachen' | 'o' | 'grinsen',  o.augen = 'offen' | 'zu' | 'gross'
export function kind(m, o = {}) {
  const f = m.farben || {};
  const haut = f.haut || '#f1c7a3', haare = f.haare || '#4a2c17';
  const [hl, hr] = o.haende || [[-22, -30], [22, -30]];
  let s = schatten(0, 0, 20);
  // lange Haare liegen HINTER dem Kopf
  if (m.extra === 'lang') s += pfad('M-17 -66Q-21 -40 -13 -42H13Q21 -40 17 -66Z', haare);
  if (m.extra === 'zoepfe') s += kreis(-19, -58, 6.5, haare) + kreis(19, -58, 6.5, haare) + kreis(-17, -64, 2.5, '#ff5fa2', OHNE) + kreis(17, -64, 2.5, '#ff5fa2', OHNE);
  // Beine + Schuhe
  s += `<rect x="-11" y="-27" width="9" height="25" rx="4" fill="${f.hose || '#4f6fcf'}"/><rect x="2" y="-27" width="9" height="25" rx="4" fill="${f.hose || '#4f6fcf'}"/>`;
  s += ell(-8, -2, 7.5, 4, '#5a3220') + ell(8, -2, 7.5, 4, '#5a3220');
  // Arme (hinter dem Bauch, die Hände kommen nach vorn)
  s += strich(`M-11 -44Q${(hl[0] - 11) / 2 - 6} ${(hl[1] - 44) / 2 + 2} ${hl[0]} ${hl[1]}`, f.shirt || '#ff8a65', 6);
  s += strich(`M11 -44Q${(hr[0] + 11) / 2 + 6} ${(hr[1] - 44) / 2 + 2} ${hr[0]} ${hr[1]}`, f.shirt || '#ff8a65', 6);
  // Bauch / T-Shirt
  s += pfad('M-14 -24Q-17 -47 0 -50Q17 -47 14 -24Q0 -20 -14 -24Z', f.shirt || '#ff8a65') + glanz(-7, -42, 3, 5, 10, 0.35);
  // Hände
  s += kreis(hl[0], hl[1], 4.5, haut) + kreis(hr[0], hr[1], 4.5, haut);
  // Kopf
  s += kreis(0, -64, 16, haut);
  // Haare oben
  s += pfad('M-16.5 -63Q-18 -83 0 -83Q18 -83 16.5 -63Q12 -73 1 -72Q-9 -76 -16.5 -63Z', haare);
  if (m.extra === 'dutt') s += kreis(0, -85, 7, haare);
  // Gesicht
  if (o.augen === 'zu') s += linie('M-9 -63q3 2 6 0M3 -63q3 2 6 0', RAND, 2.2);
  else if (o.augen === 'gross') s += kreis(-6, -64, 4.6, '#fff') + kreis(6, -64, 4.6, '#fff') + auge(-6, -63.5, 2.2) + auge(6, -63.5, 2.2);
  else s += auge(-6, -63) + auge(6, -63);
  s += backe(-10, -57) + backe(10, -57);
  if (o.mund === 'o') s += ell(0, -54, 3.2, 3.8, '#8a2a1a', 'stroke-width="2"');
  else if (o.mund === 'grinsen') s += pfad('M-6 -57Q0 -49 6 -57Z', '#8a2a1a', 'stroke-width="2"');
  else s += linie('M-5 -56Q0 -51 5 -56', RAND, 2.2);
  // Was sie auf dem Kopf haben
  const ef = m.extraFarbe || '#e0412f';
  if (m.extra === 'muetze') s += pfad('M-16.5 -69Q-16 -88 0 -88Q16 -88 16.5 -69Z', ef) + ell(12, -69, 12, 3.5, ef) + glanz(-6, -82, 4, 2, -20, 0.45);
  if (m.extra === 'stirnband') s += `<rect x="-16.5" y="-75" width="33" height="6" rx="3" fill="${ef}"/>`;
  if (m.extra === 'blumen') s += [-13, -6, 1, 8, 14].map((x, i) => kreis(x, -79 + Math.abs(x) * 0.18, 3.6, ['#ff5fa2', '#ffd23f', '#ff8a3d', '#c77dff', '#ff5fa2'][i]) + kreis(x, -79 + Math.abs(x) * 0.18, 1.2, '#fff6a0', OHNE)).join('');
  if (f.hut) s += ell(0, -76, 23, 5, f.hut) + pfad('M-12 -76Q-12 -92 0 -92Q12 -92 12 -76Z', f.hut) + linie('M-12 -79H12', '#a8402a', 3);
  return s;
}

// Der Händler: ein Erwachsener mit Schnurrbart und Schürze
export function haendler(o = {}) {
  const m = { farben: { shirt: '#3f8fd6', hose: '#5a4a3a', haare: '#6b4426', haut: '#e8b894', hut: '#e6c66a' } };
  let s = kind(m, { haende: o.haende, augen: o.augen, mund: o.mund });
  s += pfad('M-11 -46H11L13 -24H-13Z', '#fffaf0', 'stroke-width="2.5"'); // Schürze
  s += pfad('M-9 -55Q-4 -60 0 -56Q4 -60 9 -55Q4 -52 0 -54Q-4 -52 -9 -55Z', '#6b4426', 'stroke-width="2"'); // Schnurrbart
  return s;
}

// Ein Schaf (schaut nach rechts). Füße bei (0,0).
export function schaf(o = {}) {
  let s = schatten(0, 0, 26);
  for (const x of [-15, -6, 6, 15]) s += `<rect x="${x - 3}" y="-14" width="6" height="14" rx="3" fill="#4a3a35"/>`;
  s += wolkig([[-16, -24, 11], [-5, -31, 12], [8, -30, 12], [17, -23, 10], [0, -18, 13], [-12, -14, 9], [12, -15, 9]], V('wolle'));
  s += ell(-16, -20, 4, 3, '#fff', 'opacity=".6" stroke="none"');
  // Kopf
  s += ell(24, -27, 7, 3.5, '#4a3a35', 'transform="rotate(-25 24 -27)"'); // Ohr
  s += ell(30, -24, 9, 11, '#4a3a35');
  s += wolkig([[26, -34, 5], [32, -35, 4.5]], '#fff');
  if (o.brille) s += sonnenbrille(31, -25, 0.62);
  else if (o.augen === 'gross') s += kreis(27, -25, 4, '#fff') + kreis(34, -25, 4, '#fff') + auge(28, -25, 1.8) + auge(35, -25, 1.8);
  else if (o.augen === 'zu') s += linie('M25 -25q2 1.5 4 0M31 -25q2 1.5 4 0', '#fff', 1.8);
  else s += kreis(27, -25, 3, '#fff', OHNE) + kreis(34, -25, 3, '#fff', OHNE) + auge(27.6, -25, 1.6) + auge(34.6, -25, 1.6);
  s += o.mund === 'o' ? ell(31, -17, 2, 2.5, '#2a1a10', OHNE) : linie('M28 -18q3 2 6 0', '#fff', 1.6);
  return s;
}

// Ein Hase (schaut nach rechts). Füße bei (0,0).
export function hase(o = {}) {
  const fell = o.farbe || V('fell');
  let s = schatten(0, 0, 18);
  s += kreis(-15, -14, 5.5, '#fff');
  s += ell(0, -14, 15, 12.5, fell);
  s += ell(6, -2, 7, 3.5, fell) + ell(-6, -2, 6, 3, fell);
  s += ell(9, -48, 4.5, 13, fell, 'transform="rotate(-8 9 -48)"') + ell(9, -48, 2, 9, '#ffb3c6', 'stroke="none" transform="rotate(-8 9 -48)"');
  s += ell(17, -47, 4.5, 13, fell, 'transform="rotate(14 17 -47)"') + ell(17, -47, 2, 9, '#ffb3c6', 'stroke="none" transform="rotate(14 17 -47)"');
  s += kreis(13, -29, 10, fell);
  s += auge(17, -31, 2.2) + kreis(22.5, -27, 2, '#ff7d9a', OHNE) + linie('M19 -23q2 2 4 0', RAND, 1.6);
  s += backe(16, -24);
  if (o.helm) s += pfad('M3 -36Q3 -48 13 -48Q23 -48 23 -36Z', '#ffd23f') + `<rect x="0" y="-38" width="26" height="4" rx="2" fill="#ffd23f"/>`;
  return s;
}

// Ein Pferd (schaut nach rechts). Hufe bei (0,0). Etwa 95 breit.
export function pferd(o = {}) {
  const f = o.farbe || V('pferd'), mahne = o.mahne || '#4a2a14';
  let s = schatten(0, 0, 40, 6);
  s += pfad('M-30 -44Q-46 -40 -44 -16Q-38 -28 -34 -38Z', mahne); // Schweif
  for (const x of [-24, -14, 14, 24]) s += `<rect x="${x - 4}" y="-34" width="8" height="32" rx="3.5" fill="${f}"/>` + `<rect x="${x - 4.5}" y="-6" width="9" height="6" rx="2" fill="#3a2414"/>`;
  s += ell(0, -42, 34, 17, f) + glanz(-12, -50, 10, 3, -5, 0.35);
  s += pfad('M18 -50Q24 -72 34 -80L46 -70Q36 -60 32 -40Z', f); // Hals
  s += ell(46, -74, 9, 15, f, 'transform="rotate(60 46 -74)"'); // Kopf
  s += pfad('M22 -56Q24 -80 36 -86Q32 -76 30 -60Z', mahne); // Mähne
  s += pfad('M37 -84l-2 -9 7 6z', f); // Ohr
  s += auge(44, -79, 2.4) + kreis(56, -68, 1.5, RAND, OHNE);
  if (o.kranz) s += [-6, 0, 6, 12].map((x, i) => kreis(38 + x * 0.6, -88 + x * 0.5, 3.2, ['#ff5fa2', '#ffd23f', '#c77dff', '#ff8a3d'][i])).join('');
  return s;
}

// Eine Möwe. fliegt = Flügel hoch. Mitte bei (0,0), schaut nach rechts.
export function moewe(o = {}) {
  let s = '';
  if (!o.fliegt) s += linie('M-3 8v8M4 8v8', '#ff9a2a', 3) + schatten(0, 17, 12);
  if (o.fliegt) s += pfad('M-2 -3Q-12 -30 -30 -26Q-16 -14 -6 2Z', '#dfe6ee');
  s += ell(0, 0, 16, 9.5, '#fff') + pfad('M-14 -2L-26 -6L-22 4Z', '#cfd8e2');
  if (!o.fliegt) s += ell(-3, -1, 9, 5, '#cfd8e2', 'transform="rotate(-10 -3 -1)"');
  else s += pfad('M2 -3Q4 -26 22 -30Q16 -14 8 2Z', '#eef3f8');
  s += kreis(14, -7, 7.5, '#fff') + pfad('M20 -8L32 -5L20 -3Z', '#ffc533') + auge(16, -9, 1.8);
  return s;
}

// Eine Eule (für die Nacht). Füße bei (0,0).
export function eule(o = {}) {
  let s = ell(0, -24, 17, 22, '#a0703f') + ell(0, -18, 10, 13, '#e8cfa3', OHNE);
  s += pfad('M-14 -40L-12 -52L-5 -43Z', '#a0703f') + pfad('M14 -40L12 -52L5 -43Z', '#a0703f');
  s += kreis(-7, -34, 7.5, '#fff') + kreis(7, -34, 7.5, '#fff');
  if (o.muede) s += pfad('M-14 -35H0V-41H-14Z', '#a0703f', OHNE) + pfad('M0 -35H14V-41H0Z', '#a0703f', OHNE) + linie('M-14 -35H0M0 -35H14', RAND, 2) + ell(-7, -26, 5, 1.6, '#7a5ab0', 'opacity=".55" stroke="none"') + ell(7, -26, 5, 1.6, '#7a5ab0', 'opacity=".55" stroke="none"');
  s += auge(-6, -33, 2.8) + auge(6, -33, 2.8) + pfad('M-3 -28L0 -22L3 -28Z', '#ffb02e');
  s += linie('M-5 0v-3M5 0v-3', '#ffb02e', 3);
  return s;
}

// Ein Krebs. Mitte bei (0,0).
export function krebs(o = {}) {
  let s = linie('M-12 4l-8 8M-6 6l-4 9M6 6l4 9M12 4l8 8', '#d93a2a', 3.5);
  s += strich('M-12 -2Q-22 -8 -24 -18', '#ec4630', 4) + strich('M12 -2Q22 -8 24 -18', '#ec4630', 4);
  s += pfad('M-30 -18Q-30 -28 -22 -26L-24 -20L-18 -22Q-20 -14 -30 -18Z', '#ec4630') + pfad('M30 -18Q30 -28 22 -26L24 -20L18 -22Q20 -14 30 -18Z', '#ec4630');
  s += ell(0, 0, 15, 10, V('rot')) + glanz(-5, -4, 4, 2, -10, 0.5);
  s += linie('M-5 -8v-8M5 -8v-8', RAND, 2) + kreis(-5, -17, 3.5, '#fff') + kreis(5, -17, 3.5, '#fff') + auge(-5, -17, 1.6) + auge(5, -17, 1.6);
  s += linie('M-4 3q4 3 8 0', RAND, 1.8);
  if (o.partyhut) s += pfad('M-7 -21L0 -40L7 -21Z', '#c77dff') + kreis(0, -41, 3, '#ffd23f') + linie('M-4 -28h8', '#ffd23f', 2);
  return s;
}

// Ein Fisch. Mitte bei (0,0), schaut nach rechts.
export function fisch(farbe = '#4cc6ea', o = {}) {
  const streifen = o.streifen || '#ffd23f';
  let s = pfad('M-18 0L-34 -13Q-30 0 -34 13Z', farbe);
  s += pfad('M-6 -10Q0 -20 10 -12Z', farbe);
  s += ell(0, 0, 22, 13, farbe) + linie('M-6 -11Q-2 0 -6 11', streifen, 3.5) + linie('M4 -12Q8 0 4 12', streifen, 3) + glanz(-2, -6, 8, 2.5, -8, 0.5);
  if (o.brille) s += sonnenbrille(12, -3, 0.5);
  else s += kreis(13, -3, 4, '#fff') + auge(14, -3, 2);
  s += linie('M18 5q2 1.5 3 0', RAND, 1.8);
  return s;
}

// =============================================================
//  SACHEN
// =============================================================
export function sonnenbrille(x, y, s = 1) {
  return setze(x, y, s, pfad('M-14 -4H-2Q-1 6 -8 7Q-15 6 -14 -4ZM2 -4H14Q15 6 8 7Q1 6 2 -4Z', '#1b1b2a', 'stroke-width="2"') +
    linie('M-2 -2h4', '#1b1b2a', 2.5) + glanz(-10, -1, 2.5, 1.4, -20, 0.7) + glanz(6, -1, 2.5, 1.4, -20, 0.7));
}
export const boot = () =>
  pfad('M-46 -8H46Q40 12 0 12Q-40 12 -46 -8Z', V('holz')) + linie('M-42 -3H42', '#8a5a34', 2.5) + glanz(-20, 2, 12, 2, 0, 0.35);
export const palme = (krumm = 0) =>
  strich(`M0 0Q${-6 + krumm} -40 ${8 + krumm * 2} -82`, '#9c6a3a', 10) + linie(`M-2 -16h8M-1 -36h8M${2 + krumm} -56h8`, '#6e4a26', 2) +
  setze(8 + krumm * 2, -82, 1, [-160, -110, -60, -20, 30, 80].map((w) => `<path d="M0 0Q14 -14 34 -6Q18 -4 0 0Z" fill="${V('blatt')}" transform="rotate(${w})"/>`).join('') +
    kreis(-4, 4, 5, '#7a4a24') + kreis(4, 5, 5, '#7a4a24'));
export const baum = () =>
  `<rect x="-6" y="-38" width="12" height="38" rx="4" fill="${V('rinde')}"/>` + wolkig([[-18, -50, 15], [0, -64, 18], [18, -50, 15], [0, -44, 15]], V('blatt')) + glanz(-8, -66, 7, 4, -20, 0.35);
export const stumpf = () =>
  pfad('M-15 0V-18H15V0Z', V('rinde')) + ell(0, -18, 15, 5.5, '#f1c57e') + ell(0, -18, 8, 3, 'none', 'stroke="#c98a50" stroke-width="1.6"') + ell(0, -18, 3, 1.2, '#c98a50', OHNE);
export const holzstamm = (dreh = 0) =>
  setze(0, 0, 1, `<rect x="-22" y="-7" width="44" height="14" rx="7" fill="${V('rinde')}"/>` + ell(22, 0, 5, 7, '#f1c57e'), false, dreh);
export const pilz = () =>
  pfad('M-6 0Q-7 -12 -5 -16H5Q7 -12 6 0Z', '#fff6e8') + pfad('M-17 -14Q-17 -32 0 -32Q17 -32 17 -14Z', V('pilz')) +
  kreis(-8, -22, 2.6, '#fff', OHNE) + kreis(3, -27, 2.2, '#fff', OHNE) + kreis(9, -19, 2.4, '#fff', OHNE) + glanz(-6, -27, 3.5, 2, -25, 0.5);
export const muenze = (r = 12) =>
  kreis(0, 2, r, '#c27400') + kreis(0, 0, r, V('gold')) + kreis(0, 0, r * 0.68, 'none', 'stroke="#e0950a" stroke-width="2.5"') + glanz(-r * 0.4, -r * 0.4, r * 0.25, r * 0.14, -40, 0.85);
export const kokosnuss = (r = 9) => kreis(0, 0, r, '#7a4a24') + kreis(-2, -3, 1.4, '#3a2010', OHNE) + kreis(2, -3, 1.4, '#3a2010', OHNE) + kreis(0, 1, 1.4, '#3a2010', OHNE) + glanz(-4, -4, 2.5, 1.5, -30, 0.4);
export const schuh = () => pfad('M-16 -2V-18H-4Q-2 -8 6 -8Q16 -8 18 -2Q18 2 14 2H-14Q-16 2 -16 -2Z', '#7a4a24') + linie('M-6 -14h6M-5 -10h7', '#e8d2a0', 2) + pfad('M-16 2H18', 'none') + linie('M-15 0H17', '#3a2010', 3);
export const dose = () => `<rect x="-10" y="-26" width="20" height="26" rx="3" fill="${V('metall')}"/>` + `<rect x="-10" y="-19" width="20" height="11" fill="#e0553a"/>` + ell(0, -26, 10, 3, '#d8dee6') + ell(-3, -14, 2, 4, '#c27a3a', 'opacity=".6" stroke="none"');
export const brot = () => pfad('M-16 0Q-18 -14 0 -15Q18 -14 16 0Z', '#eca752') + linie('M-8 -8l3 -4M0 -9l3 -4M8 -8l3 -4', '#fff0c8', 2) + glanz(-6, -11, 4, 1.5, -10, 0.5);
export const tasse = (dampf = true) =>
  (dampf ? linie('M-4 -30q-4 -6 0 -12t0 -12M5 -30q-4 -6 0 -12', '#fff', 3, 0.85) : '') +
  pfad('M-12 -24H12V-6Q12 0 6 0H-6Q-12 0 -12 -6Z', '#fffaf0') + `<path d="M12 -19Q21 -19 20 -12Q19 -6 12 -8" fill="none" stroke="${RAND}" stroke-width="7"/><path d="M12 -19Q21 -19 20 -12Q19 -6 12 -8" fill="none" stroke="#fffaf0" stroke-width="3"/>` +
  ell(0, -23, 11, 2.5, '#6b3a1a') + linie('M-6 -14h12', '#e0553a', 3);
export const limo = () =>
  kreis(0, -18, 24, 'url(#zb-schein)', OHNE) + pfad('M-4 -38H4V-32Q11 -28 11 -18V-2Q11 2 7 2H-7Q-11 2 -11 -2V-18Q-11 -28 -4 -32Z', V('limo')) +
  `<rect x="-5" y="-42" width="10" height="5" rx="2" fill="#e0553a"/>` + kreis(0, -14, 5, '#fff7d0', 'stroke-width="1.5"') + linie('M0 -19v10M-5 -14h10', '#ffcf2e', 1.5) + glanz(-6, -22, 2, 6, 0, 0.6);
export const pokal = () =>
  pfad('M-14 -40H14Q14 -20 0 -16Q-14 -20 -14 -40Z', V('gold')) + linie('M-14 -36Q-24 -36 -20 -26Q-17 -22 -11 -22M14 -36Q24 -36 20 -26Q17 -22 11 -22', '#e09a00', 3.5) +
  `<rect x="-3" y="-17" width="6" height="9" fill="${V('gold')}"/>` + `<rect x="-11" y="-8" width="22" height="8" rx="2" fill="#9c5f2e"/>` + glanz(-7, -34, 2.5, 5, 0, 0.7) + funkeln(16, -44, 5);
export const herz = (r = 8, f = '#ff4f7b') =>
  pfad(`M0 ${r * 0.9}C${-r * 1.6} ${-r * 0.2} ${-r * 0.8} ${-r * 1.4} 0 ${-r * 0.5}C${r * 0.8} ${-r * 1.4} ${r * 1.6} ${-r * 0.2} 0 ${r * 0.9}Z`, f, 'stroke-width="2"') + glanz(-r * 0.5, -r * 0.5, r * 0.2, r * 0.12, -30, 0.7);
export const ballon = (farbe1 = '#ec4630', farbe2 = '#ffd23f') =>
  linie('M-12 -6L-8 14M12 -6L8 14', '#7a5a40', 2) +
  pfad('M0 -70C-30 -70 -34 -36 -12 -8H12C34 -36 30 -70 0 -70Z', farbe1) + pfad('M0 -70C-12 -70 -14 -36 -5 -8H5C14 -36 12 -70 0 -70Z', farbe2) +
  glanz(-14, -52, 4, 9, 15, 0.45) + `<rect x="-10" y="14" width="20" height="14" rx="3" fill="${V('holz')}"/>` + linie('M-10 19h20', '#8a5a34', 2);
export const koffer = () => `<rect x="-14" y="-20" width="28" height="20" rx="4" fill="#d9573a"/>` + linie('M-5 -20v-5h10v5', RAND, 3) + linie('M-14 -11h28', '#ffd23f', 3) + funkeln(8, -14, 0.1);
export const helmHammer = () => strich('M0 0L16 -16', '#c98a50', 4) + `<rect x="10" y="-26" width="16" height="9" rx="3" fill="${V('metall')}" transform="rotate(45 18 -21)"/>`;
export const fernrohr = () => `<rect x="-4" y="-4" width="30" height="9" rx="3" fill="${V('gold')}" transform="rotate(-20)"/>` + `<rect x="18" y="-14" width="14" height="12" rx="3" fill="#8a5a34" transform="rotate(-20 25 -8)"/>`;
export const fahne = (f = '#ec4630') => linie('M0 0V-40', '#7a5a40', 3) + pfad('M0 -40L22 -33L0 -26Z', f);
export const drachen = () =>
  pfad('M0 -26L16 0L0 26L-16 0Z', '#ff5fa2') + pfad('M0 -26L16 0H-16Z', '#ffd23f') + linie('M0 -26V26M-16 0H16', RAND, 1.5) +
  linie('M0 26q-8 10 0 18t0 18', RAND, 1.8) + pfad('M-5 38l5 3 5-3-5-3z', '#2e86de', 'stroke-width="1.5"') + pfad('M-5 52l5 3 5-3-5-3z', '#4cb83a', 'stroke-width="1.5"');
export const sandburg = (hoch = 1) =>
  `<rect x="-30" y="-24" width="60" height="24" rx="2" fill="${V('sand')}"/>` +
  `<rect x="-26" y="${-44 * hoch}" width="16" height="${44 * hoch - 24}" fill="${V('sand')}"/>` + `<rect x="10" y="${-44 * hoch}" width="16" height="${44 * hoch - 24}" fill="${V('sand')}"/>` +
  `<rect x="-8" y="${-80 * hoch}" width="16" height="${80 * hoch - 24}" fill="${V('sand')}"/>` +
  pfad(`M-8 ${-80 * hoch}V${-86 * hoch}H-3V${-80 * hoch}H3V${-86 * hoch}H8V${-80 * hoch}Z`, V('sand')) +
  linie(`M0 ${-80 * hoch - 6}V${-80 * hoch - 26}`, '#7a5a40', 2) + pfad(`M0 ${-80 * hoch - 26}L14 ${-80 * hoch - 21}L0 ${-80 * hoch - 16}Z`, '#ec4630', 'stroke-width="2"') +
  pfad('M-6 0V-10Q0 -16 6 -10V0Z', '#c98a50');
export const pfannkuchen = (n = 8) => {
  let s = ell(0, 0, 24, 5, '#fffaf0');
  for (let i = 0; i < n; i++) s += ell(0, -5 - i * 6, 20, 5, i % 2 ? '#f1b45a' : '#e8a040');
  s += pfad(`M-6 ${-8 - n * 6}Q0 ${-14 - n * 6} 6 ${-8 - n * 6}L4 ${-2 - n * 6}Q0 ${4 - n * 6} -4 ${-2 - n * 6}Z`, '#a85a1a', 'stroke-width="1.5"');
  return s;
};
export const surfbrett = () => ell(0, 0, 40, 7, '#ff8a3d') + linie('M-34 0H34', '#fff', 3);
export const muschel = () => pfad('M-12 0Q-14 -16 0 -18Q14 -16 12 0Z', '#ffc6ad') + linie('M0 -17V-1M-6 -15L-4 -1M6 -15L4 -1', '#ef8a74', 1.8);
export const staffelei = (bildInhalt = '') => linie('M-16 0L-4 -60M16 0L4 -60M0 -60V0', '#9c6a3a', 3.5) + `<rect x="-20" y="-56" width="40" height="32" rx="2" fill="#fffaf0"/>` + bildInhalt;
export const noten = (x, y) => schrift(x, y, '♪', 22, '#ffd23f', -10) + schrift(x + 16, y - 12, '♫', 20, '#ff8fae', 10);
export const stand = (markise1 = '#ec4630', markise2 = '#fffaf0') => {
  let s = linie('M-50 0V-74M50 0V-74', '#7a5a40', 5);
  s += `<rect x="-56" y="-34" width="112" height="34" rx="4" fill="${V('holz')}"/>` + linie('M-56 -24H56', '#8a5a34', 2);
  let streifen = '';
  for (let i = 0; i < 7; i++) streifen += pfad(`M${-56 + i * 16} -90H${-40 + i * 16}V-74Q${-48 + i * 16} -64 ${-56 + i * 16} -74Z`, i % 2 ? markise2 : markise1);
  return s + streifen;
};
export const inselchen = () =>
  pfad('M-60 0Q-40 -30 0 -32Q40 -30 60 0Z', V('sand')) + setze(-10, -24, 0.55, palme(4)) + pfad('M-34 -12Q-20 -40 4 -26Q18 -44 36 -14Z', '#5fbf3c');
export const haeuschen = () =>
  `<rect x="-34" y="-44" width="68" height="44" rx="4" fill="${V('holz')}"/>` + pfad('M-44 -40L0 -78L44 -40Z', '#e0553a') +
  pfad('M-9 0V-24Q0 -32 9 -24V0Z', '#7a4524') + `<rect x="14" y="-32" width="14" height="12" rx="2" fill="#bfe9ff"/>` + glanz(-30, -60, 6, 2, -40, 0.4);
export const zzz = (x, y) => schrift(x, y, 'Z', 16, '#fff', -10) + schrift(x + 12, y - 12, 'z', 20, '#fff', -5) + schrift(x + 26, y - 26, 'Z', 26, '#fff', 0);
export const ausruf = (x, y, text = '!', g = 26, f = '#ffd23f') => schrift(x, y, text, g, f, -6);
// Ein Stein, der grell rot leuchtet: das Insadorium
export const insadorium = () =>
  kreis(0, -14, 46, 'url(#zb-glut)', OHNE) + pfad('M-16 0L-20 -16L-8 -30L10 -28L20 -12L14 0Z', '#e3201a') + pfad('M-8 -30L10 -28L4 -16L-12 -18Z', '#ff7a6a', 'stroke-width="2"') +
  glanz(-6, -22, 4, 2, -20, 0.8) + funkeln(-24, -36, 6) + funkeln(26, -30, 5) + funkeln(18, -48, 4);
// Ein Loch im Boden mit Erd-Krümeln
export const erdloch = () => ell(0, 0, 26, 7, '#5a3a1a') + kreis(-34, -10, 3, '#8a5a30') + kreis(30, -16, 3.5, '#8a5a30') + kreis(-24, -22, 2.5, '#8a5a30') + kreis(20, -28, 2.5, '#8a5a30');

// =============================================================
//  FERTIGES FOTO: Hintergrund + Teile → ein <svg>
// =============================================================
export function foto(inhalt, beschreibung = '') {
  verlaeufeEinbauen();
  return `<svg class="zeitung-foto-svg" viewBox="0 0 ${BREITE} ${HOEHE}" role="img" aria-label="${beschreibung.replace(/"/g, '')}">` +
    `<g stroke="${RAND}" stroke-width="2.8" stroke-linejoin="round" stroke-linecap="round">${inhalt}</g></svg>`;
}

export const B = {
  setze, kreis, ell, pfad, linie, strich, glanz, funkeln, schrift, tempo, schatten, wolke, sonne, mond, wellen, sterne, OHNE, V,
};

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', verlaeufeEinbauen);
  else verlaeufeEinbauen();
}
