// =============================================================
//  DAS AUFGABENBUCH 📋 (eine "Quest-Kette")
//  Zeigt immer den nächsten Schritt. Jeder Schritt baut auf dem
//  vorigen auf – so lernt man, wie alles im Spiel zusammenhängt.
//  Für jede geschaffte Aufgabe gibt es Münzen als Belohnung.
// =============================================================
import { knopf } from './steuerung.js';
import { uiBild } from './ui-bilder.js';
import { muenzeKlein } from './bilder.js';
import { EINSTELLUNGEN } from './einstellungen.js';

// tipp = was man tun muss, geschafft = wann es erledigt ist
const AUFGABEN = [
  { titel: 'Finde die Schaufel', start: 'aufgabenbuch', tipp: 'Sie liegt glitzernd neben dem Zelt.', geschafft: (s) => s.rucksack.hat('schaufel'), belohnung: 2 },
  { titel: 'Nimm die Schaufel in die Hand', start: 'schaufel', tipp: 'Rucksack 🎒 öffnen und die Schaufel antippen.', geschafft: (s) => s.rucksack.inDerHand === 'schaufel', belohnung: 0 },
  { titel: 'Grab 3 Steine und 2 Eisenerz', start: 'huegel', tipp: 'An den glitzernden Erdhügeln graben. Nach 2 Tagen sind sie wieder voll.', geschafft: (s) => s.rucksack.anzahl('stein') >= 3 && s.rucksack.anzahl('eisenerz') >= 2, belohnung: 3 },
  { titel: 'Kauf dir ein Brot beim Händler', start: 'dorf', tipp: 'Das Dorf 🏘️ ist auf der Karte 🗺️. Beim Händler „Handeln“ drücken, dann bei Brot „Kaufen“. (Nachts schläft er!)', geschafft: (s) => !!s.haendler?.gekauftJemals || s.rucksack.hat('brot') || s.aufgaben.brotGegessen, belohnung: 2 },
  { titel: 'Iss ein Brot', start: 'brotEssen', tipp: 'Rucksack 🎒 öffnen, Brot antippen, „Essen“ drücken.', geschafft: (s) => s.aufgaben.brotGegessen, belohnung: 3, danach: 'essen' },
  { titel: 'Verkauf etwas beim Händler', start: 'verkaufen', tipp: 'Grab erst noch einen Hügel aus ⛏️ – und verkauf, was du findest: beim Händler „Handeln“, dann „💰 Verkaufen“. Deine 3 Steine und 2 Eisenerz behältst du fürs Schwert! (Nachts schläft er!)', geschafft: (s) => s.aufgaben.gehandelt || Object.keys(s.haendler?.verkauftHeute || {}).length > 0, belohnung: 5, danach: 'werkbank' },
  { titel: 'Bau ein Schwert', tipp: 'An der Werkbank 🔨 neben dem Zelt: 2 Eisenerz + 3 Steine.', geschafft: (s) => s.rucksack.hat('schwert'), belohnung: 5 },
  { titel: 'Hack 4 Holz', start: 'holzHacken', tipp: 'Schwert in die Hand, vor einen Baum stellen und „Fällen“ drücken.', geschafft: (s) => s.rucksack.anzahl('holz') >= 4, belohnung: 3 },
  { titel: 'Bau eine Schnur', start: 'angelBauen', tipp: 'An der Werkbank: 2 Holz werden zu einer dünnen Schnur.', geschafft: (s) => s.rucksack.hat('schnur') || s.rucksack.hat('angel'), belohnung: 2 },
  { titel: 'Bau eine Angel', tipp: 'An der Werkbank: 2 Holz + 1 Schnur.', geschafft: (s) => s.rucksack.hat('angel'), belohnung: 5 },
  { titel: 'Besorg Würmer', start: 'wuermer', tipp: 'Würmer findet man manchmal beim Graben – oder man kauft sie im Dorf.', geschafft: (s) => s.rucksack.hat('koeder'), belohnung: 2 },
  { titel: 'Angle einen Tofu-Fisch', start: 'angeln', tipp: 'Angel in die Hand und an eine Angelstelle 🎣 (auf der Karte 🗺️).', geschafft: (s) => s.rucksack.hat('tofufisch') || s.rucksack.hat('gegrillterFisch'), belohnung: 5, danach: 'fisch' },
  { titel: 'Kauf Holz beim Händler', tipp: 'Fürs Lagerfeuer brauchst du Holz. Beim Händler im Dorf „Kaufen“ drücken – beim ersten Mal gibt es 3 für 1!', geschafft: (s) => !!s.haendler?.holzGeschenkt || s.aufgaben.holzGekauft, belohnung: 2, danach: 'holz' },
  { titel: 'Bau ein Feuerzeug', start: 'feuerzeug', tipp: 'An der Werkbank: 2 Steine + 1 Eisenerz + 1 Kohle.', geschafft: (s) => s.rucksack.hat('feuerzeug') || s.lagerfeuer.brennt > 0, belohnung: 5 },
  { titel: 'Zünde das Lagerfeuer an', start: 'lagerfeuer', tipp: 'Am Lagerfeuer neben dem Zelt: 1 Holz + Feuerzeug.', geschafft: (s) => s.lagerfeuer.brennt > 0, belohnung: 3 },
  { titel: 'Grill den Tofu-Fisch', start: 'grillen', tipp: 'Wenn das Feuer brennt: „Fisch grillen“ drücken.', geschafft: (s) => s.rucksack.hat('gegrillterFisch') || s.aufgaben.fischGegessen, belohnung: 3 },
  { titel: 'Iss deinen selbst gefangenen Fisch', tipp: 'Rucksack öffnen, Fisch antippen, „Essen“. Jetzt versorgst du dich selbst! 🎉', geschafft: (s) => s.aufgaben.fischGegessen, belohnung: 10, danach: 'selbstversorger' },
  { titel: 'Bau das große Zelt', tipp: 'Am Schild „BASE“ neben dem Zelt das Base-Menü öffnen und ausbauen.', geschafft: (s) => (s.base?.stufe || 1) >= 2, belohnung: 10 },
  { titel: 'Bau eine Holzhütte', tipp: 'Wieder im Base-Menü. In der Hütte steht eine Truhe 📦 – dort kannst du Sachen aufbewahren, wenn dein Rucksack voll ist!', geschafft: (s) => (s.base?.stufe || 1) >= 3, belohnung: 15 },
  { titel: 'Zähme ein Wildpferd', tipp: 'Kauf einen 3er-Pack Äpfel im Dorf, nimm einen in die Hand 🍎 und geh langsam zu einem Wildpferd und füttere es 3 Mal. Dann gehört es dir!', geschafft: (s) => !!s.pferde?.eigenes, belohnung: 15 },
  // ---------- Etappe 3: Das große Abenteuer ----------
  { titel: 'Bau ein Fernrohr', start: 'fernrohrBauen', tipp: 'An der Werkbank 🔨: 2 Eisenerz + 1 Gold + 1 Holz. Das geht ab Tag 3 – wenn du dich selbst versorgst und eine Holzhütte hast.', geschafft: (s) => s.rucksack.hat('fernrohr') || (s.karte?.entdeckteInseln || []).length > 0, belohnung: 5 },
  { titel: 'Entdecke eine neue Insel', start: 'nebel', tipp: 'Fernrohr in die Hand, an die Küste gehen (am besten auf einen Hügel) und „Durchschauen“. Dreh das Bild, bis eine Nebelbank in der Mitte ist – dann den grünen Knopf „Insel entdecken!“ antippen.', geschafft: (s) => (s.karte?.entdeckteInseln || []).length > 0, belohnung: 5, danach: 'inselEntdeckt' },
  { titel: 'Frag die Bewohner nach dem Insadorium', tipp: 'Fahr mit dem Boot 🚣 auf die Palmeninsel 🌴 und sprich einen der Menschen dort an. Vielleicht weiß jemand etwas über das Insadorium!', geschafft: (s) => !!s.bewohner?.tippBekommen || !!s.bewohner?.trigger, belohnung: 5, danach: 'unterWasser' },
  { titel: 'Finde die Person mit der Taucherbrille', tipp: 'Auf der Palmeninsel 🌴 leben 13 Menschen. Einer von ihnen hat eine Taucherbrille 🤿!', geschafft: (s) => !!s.bewohner?.trigger, belohnung: 5 },
  { titel: 'Finde die Münzen auf der Palmeninsel und deiner Heimatinsel', start: 'muenzenSuche', tipp: 'Such die golden glitzernden Hügel ✨ – einer liegt auf der Palmeninsel, einer auf deiner Heimatinsel. Auf der Karte 🗺️ sind sie mit ❓ markiert. Schaufel nicht vergessen!', geschafft: (s) => zweiMuenzen(s) || genugMuenzen(s), belohnung: 5 },
  { titel: 'Fahr zur Klippeninsel', tipp: 'Die dritte Münze liegt auf der Klippeninsel im Osten. Fahr mit dem Boot 🚣 hin! (Liegt sie noch im Nebel? Dann erst mit dem Fernrohr 🔭 entdecken.)', geschafft: (s) => !!s.aufgaben.klippeBesucht || s.rucksack.hat('seilkanone') || s.rucksack.hat('widerhaken') || genugMuenzen(s), belohnung: 5 },
  { titel: 'Bau eine Seilkanone an der Werkbank', tipp: 'Geh zu deiner Werkbank 🔨 und schau dir die Seilkanone an: Sie braucht ein Seil (aus 3 Schnüren), 4 Holz und 3 Eisenerz – und noch ein besonderes Teil …', geschafft: (s) => genugMuenzen(s) || s.aufgaben.erklaert.includes('widerhakenFehlt') || s.rucksack.hat('widerhaken') || s.rucksack.hat('seilkanone') || !!s.tauchen?.gefunden, belohnung: 5 },
  { titel: 'Gewinne die Zauberpilz-Rallye', start: 'widerhakenFehlt', tipp: 'Die Rallye startet am Strand vor dem Palmendorf 🌴 – jeden Tag für 50 Münzen, am Markttag (jeden 3. Tag) für nur 10. Der erste Sieg bringt dir den Widerhaken für die Seilkanone! 🏁', geschafft: (s) => genugMuenzen(s) || s.rucksack.hat('widerhaken') || s.rucksack.hat('seilkanone') || !!s.rallye?.widerhakenGewonnen || !!s.tauchen?.gefunden, belohnung: 10 },
  { titel: 'Bau die Seilkanone fertig', tipp: 'Jetzt hast du den Widerhaken! An der Werkbank: 4 Holz + 3 Eisenerz + Seil + Widerhaken.', geschafft: (s) => genugMuenzen(s) || s.rucksack.hat('seilkanone') || !!s.tauchen?.gefunden, belohnung: 10, danach: 'klippeBereit' },
  { titel: 'Hol die dritte Münze oben auf der Klippe', tipp: 'Schieß mit der Seilkanone 🪝 ein Seil an die Felswand der Klippeninsel und kletter hoch. Oben glitzert der goldene Hügel ✨ (Karte ❓).', geschafft: (s) => !!s.bewohner?.abgegeben || s.rucksack.anzahl('wertvolleMuenze') >= 3, belohnung: 10 },
  { titel: 'Hol dir die Taucherbrille', tipp: 'Bring die 3 Münzen zurück zur Person mit der Taucherbrille.', geschafft: (s) => !!s.bewohner?.abgegeben || s.rucksack.hat('taucherbrille'), belohnung: 5 },
  { titel: 'Finde das Insadorium', tipp: 'Kletter auf die Klippeninsel und tauch in den geheimnisvollen See. Es leuchtet rot! 🔴', geschafft: (s) => !!s.tauchen?.gefunden || s.rucksack.hat('insadorium'), belohnung: 0 },
];

// Hat man die 3 wertvollen Münzen schon (oder schon abgegeben)? Dann ist man an der Klippe vorbei
function genugMuenzen(s) {
  return !!s.bewohner?.abgegeben || s.rucksack.anzahl('wertvolleMuenze') >= 3;
}

// Hat man die Münzen der Palmeninsel und der Heimatinsel schon ausgegraben?
function zweiMuenzen(s) {
  const h = s.bewohner?.huegel || [];
  return h.length > 0 && h.filter((x) => x.insel !== 'Klippeninsel').every((x) => x.gefunden);
}

// Hat man alles für die Seilkanone – außer dem Widerhaken?
function alleTeileAusserHaken(s) {
  const r = EINSTELLUNGEN.rezepte.seilkanone;
  return Object.entries(r).every(([id, n]) => id === 'widerhaken' || s.rucksack.anzahl(id) >= n);
}

// ---------- Die großen Erklärungen (kommen einmal, nach bestimmten Aufgaben) ----------
// „start“ bei einer Aufgabe = diese Erklärung kommt, wenn die Aufgabe dran ist
// „danach“ bei einer Aufgabe = diese Erklärung kommt, wenn sie geschafft ist
const ERKLAERUNG = {
  aufgabenbuch: {
    bild: '📋',
    titel: 'Dein Aufgabenbuch',
    text: `<p>Oben links steht immer <b>deine nächste Aufgabe</b>. Tipp darauf, dann siehst du die ganze Liste mit Tipps.</p>
      <p>Für jede geschaffte Aufgabe bekommst du <b>Münzen</b> 🪙 – und lernst Schritt für Schritt, wie du auf der Insel überlebst. Und am Ende führen dich die Aufgaben zu deinem <b>großen Ziel</b>: dem <b>Insadorium</b> 🔴!</p>
      <p class="erklaer-aufgabe">Deine erste Aufgabe: <b>Finde die Schaufel!</b> Sie liegt glitzernd ✨ neben deinem Zelt.</p>`,
  },
  schaufel: {
    bild: '🪏',
    titel: 'Deine Schaufel!',
    text: `<p>Mit der Schaufel <b>gräbst du in den Erdhügeln</b> auf der Insel. Darin findest du Steine, Erze und mehr.</p>
      <p>Aber zuerst musst du sie <b>in die Hand nehmen</b>.</p>
      <p class="erklaer-aufgabe">So geht's: Unten den <b>Rucksack 🎒</b> öffnen und die <b>Schaufel antippen</b>.</p>`,
  },
  huegel: {
    bild: '⛰️',
    titel: 'Such den nächsten Hügel!',
    text: `<p>Überall auf der Insel gibt es <b>braune Erdhügel</b>, die ein bisschen glitzern.</p>
      <p>Lauf zu einem hin. Wenn du davor stehst, erscheint der Knopf <b>„Graben“</b> – drück ihn!</p>
      <p class="erklaer-aufgabe">Deine Aufgabe: <b>Grab das erste Mal!</b> Auf der Karte 🗺️ siehst du, wo die Hügel sind.</p>`,
  },
  dorf: {
    bild: '🏘️',
    titel: 'Ab ins Dorf!',
    text: `<p>Super gegraben! Jetzt brauchst du etwas zu <b>essen</b> – sonst bekommst du Hunger.</p>
      <p>Öffne die <b>Karte 🗺️</b> und tipp auf das <b>Dorf</b>. Ein Pfeil zeigt dir den Weg.</p>
      <p class="erklaer-aufgabe">Deine Aufgabe: Kauf dir beim <b>Händler</b> ein <b>Brot</b>. Beim ersten Mal gibt es ein Geschenk! 🎁</p>`,
  },
  brotEssen: {
    bild: '🍞',
    titel: 'Jetzt essen!',
    text: `<p>Du hast Brot im Rucksack. Iss gleich eins, dann bist du satt.</p>
      <p class="erklaer-aufgabe">So geht's: <b>Rucksack 🎒</b> öffnen, <b>Brot antippen</b>, <b>„Essen“</b> drücken.</p>`,
  },
  holzHacken: {
    bild: '🗡️',
    titel: 'Dein Schwert!',
    text: `<p>Mit dem Schwert fällst du <b>Bäume</b>. Das gibt <b>Holz</b> – gratis!</p>
      <p class="erklaer-aufgabe">So geht's: Schwert in die Hand nehmen (Rucksack 🎒), <b>vor einen Baum</b> stellen und <b>„Fällen“</b> drücken. Hol dir <b>4 Holz</b>.</p>`,
  },
  angelBauen: {
    bild: '🎣',
    titel: 'Bau dir eine Angel!',
    text: `<p>Mit einer Angel fängst du Fische – dein eigenes Essen, ganz ohne Münzen.</p>
      <p class="erklaer-aufgabe">Geh zur <b>Werkbank 🔨</b> neben dem Zelt. Bau zuerst eine <b>Schnur</b> (2 Holz) und dann die <b>Angel</b> (2 Holz + Schnur).</p>`,
  },
  wuermer: {
    bild: '🪱',
    titel: 'Fische mögen Würmer',
    text: `<p>Ohne Würmer beißt kein Fisch an.</p>
      <p class="erklaer-aufgabe">Würmer findest du manchmal beim <b>Graben</b> – oder du kaufst beim <b>Händler</b> eine <b>10er-Schachtel</b> für 10 Münzen.</p>`,
  },
  angeln: {
    bild: '🐟',
    titel: 'Ab zum Angeln!',
    text: `<p>Auf der Karte 🗺️ siehst du die <b>Angelstellen 🎣</b>. Dort kräuselt sich das Wasser.</p>
      <p class="erklaer-aufgabe">Angel in die Hand, an die Angelstelle stellen und <b>„Angeln“</b> drücken. Wenn es zieht: schnell <b>tippen</b>!</p>`,
  },
  feuerzeug: {
    bild: '🔥',
    titel: 'Bau ein Feuerzeug',
    text: `<p>Rohen Fisch kann man nicht essen – du musst ihn <b>grillen</b>. Dafür brauchst du Feuer.</p>
      <p class="erklaer-aufgabe">An der <b>Werkbank 🔨</b>: 2 Steine + 1 Eisenerz + 1 <b>Kohle</b>. Kohle findest du beim Graben.</p>`,
  },
  lagerfeuer: {
    bild: '🪵',
    titel: 'Mach ein Feuer!',
    text: `<p class="erklaer-aufgabe">Geh zum <b>Lagerfeuer</b> neben deinem Zelt. Mit <b>1 Holz</b> und dem <b>Feuerzeug</b> zündest du es an.</p>
      <p>Nachts macht es auch schön hell. 🌙</p>`,
  },
  grillen: {
    bild: '🍢',
    titel: 'Fisch grillen',
    text: `<p class="erklaer-aufgabe">Das Feuer brennt! Stell dich davor und drück <b>„Fisch grillen“</b>. Danach im Rucksack <b>essen</b>.</p>
      <p>Ein gegrillter Fisch macht dich so satt wie ein Brot – und kostet nichts!</p>`,
  },
  nacht: {
    bild: '🌙',
    titel: 'Bald wird es Nacht!',
    text: `<p>Oben in der Mitte siehst du, wie lange der Tag noch geht. Ist die Zeit fast um, wird sie <b>rot</b> und es piept.</p>
      <p>Nachts gehst du in dein <b>Zelt</b> und <b>schläfst</b>. Dann ist die Nacht ganz schnell vorbei und du bist sicher. 😴</p>
      <p>Schläfst du <b>zwei Nächte hintereinander nicht</b>, bist du so müde, dass du <b>50 Münzen verlierst</b>!</p>
      <p>Und vergiss das <b>Essen</b> nicht: Wer einen ganzen Tag lang Hunger hat, wird <b>ohnmächtig</b> 😵 – dann verlierst du <b>20 Münzen</b> und <b>alle Steine, Erze, Gold und Edelsteine</b>!</p>
      <p class="erklaer-aufgabe">Achte immer auf die Uhr und geh rechtzeitig <b>zurück zu deinem Zelt</b>. Die Karte 🗺️ zeigt dir den Weg.</p>`,
  },
  zauberpilz: {
    bild: '🍄',
    titel: 'Ein Zauberpilz!',
    text: `<p>Iss ihn im <b>Rucksack 🎒</b>, dann kannst du <b>eine Minute lang fliegen</b>! Sprungknopf festhalten = höher, „🛬 Landen“ = wieder runter.</p>
      <p>Von oben siehst du die ganze Insel – und kommst schnell über Berge und Seen.</p>
      <p>Oder du <b>verkaufst</b> ihn teuer beim Händler. 💰</p>
      <p>Über den <b>anderen Inseln</b> weht ein starker Wind – dort kannst du nicht landen. Hin kommst du mit dem Boot 🚣.</p>`,
  },
  selbstversorger: {
    bild: '🏅',
    titel: 'Du versorgst dich selbst!',
    text: `<p>Graben, handeln, bauen, angeln, Feuer machen, grillen, schlafen – du kannst jetzt auf der Insel <b>überleben</b>. Super! 🎉</p>
      <p>Aber vergiss dein <b>großes Ziel</b> nicht: Du bist Forscher und suchst das <b>Insadorium</b> 🔴. Es liegt auf einer der <b>anderen Inseln</b> – hinter dem Nebel.</p>
      <p class="erklaer-aufgabe">Bau als Nächstes deine <b>Base</b> aus: erst das <b>große Zelt</b>, dann die <b>Holzhütte</b>. Danach (ab <b>Tag 3</b>) kannst du ein <b>Fernrohr</b> 🔭 bauen. Damit schaust du durch den Nebel!</p>`,
  },
  fernrohrBauen: {
    bild: '🔭',
    titel: 'Zeit für ein Fernrohr!',
    text: `<p>Die anderen Inseln liegen im <b>dichten Nebel</b> 🌫️. Mit dem Boot oder dem Zauberpilz kommst du nicht hindurch.</p>
      <p>Nur mit einem <b>Fernrohr</b> kannst du durch den Dunst schauen und eine Insel entdecken – dann findest du den Weg.</p>
      <p class="erklaer-aufgabe">Bau an der <b>Werkbank</b> ein Fernrohr: 2 Eisenerz + 1 Gold + 1 Holz. Gold findest du beim Graben (selten!).</p>`,
  },
  nebel: {
    bild: '🌫️',
    titel: 'Schau durch den Nebel!',
    text: `<p>Das Fernrohr allein reicht nicht – du musst damit die Insel <b>finden</b>! Erst dann verschwindet der Nebel und du kommst mit dem Boot hin.</p>
      <p>Nimm das <b>Fernrohr</b> in die Hand und geh an die <b>Küste</b> – am besten auf einen Hügel. Drück <b>„Durchschauen“</b>.</p>
      <p class="erklaer-aufgabe">Wisch übers Bild, bis eine <b>Nebelbank</b> über dem Meer genau in der <b>Mitte</b> ist. Dann erscheint unten ein grüner Knopf <b>„🔭 Insel entdecken!“</b> – antippen, fertig!</p>
      <p>Auf der Karte 🗺️ sind die Inseln mit <b>❓</b> markiert. Eine liegt im <b>Westen</b>, eine im <b>Osten</b>.</p>`,
  },
  inselEntdeckt: {
    bild: '🏝️',
    titel: 'Eine neue Insel!',
    text: `<p>Der Nebel ist weg – jetzt kannst du mit dem <b>Boot</b> 🚣 hinüberfahren.</p>
      <p>Denk dran: Nimm genug <b>Essen</b> mit und schau, wo du <b>schlafen</b> kannst. Mit dem großen Zelt hast du ein <b>Reisezelt</b> ⛺ für unterwegs!</p>
      <p class="erklaer-aufgabe">Dein großes Ziel bleibt: das <b>Insadorium</b> 🔴 finden. Vielleicht wissen die Menschen auf den anderen Inseln mehr …</p>`,
  },
  baseStufe2: {
    bild: '⛺',
    titel: 'Großes Zelt – und ein Reisezelt!',
    text: `<p>Dein <b>altes Zelt</b> ist jetzt ein <b>Reisezelt</b> und liegt in deinem <b>Rucksack</b> 🎒 (es braucht 3 Plätze).</p>
      <p class="erklaer-aufgabe">So geht's: Rucksack öffnen, Reisezelt antippen, <b>„⛺ Aufstellen“</b>. Dann kannst du dort <b>schlafen</b> – auch auf anderen Inseln! Hinter dem Zelt packst du es wieder <b>ein</b>.</p>
      <p>Und im großen Zelt schläfst du so gut, dass du nachts nur <b>halb so schnell hungrig</b> wirst. 😴</p>`,
  },
  baseStufe4: {
    bild: '🎈',
    titel: 'Hütte mit Garten – und ein Heißluftballon!',
    text: `<p>Im <b>Garten</b> wachsen jetzt jeden Tag <b>Karotten</b> 🥕 – für dich und für Pferde.</p>
      <p class="erklaer-aufgabe">Und neben deiner Hütte steht jetzt dein eigener <b>Heißluftballon</b> 🎈! Damit fliegst du ganz einfach von Ort zu Ort – zum Dorf, nach Hause und über die Inseln, die du schon kennst.</p>
      <p>Geh zum Ballon und tipp auf „🎈 Ballon“: Dann kannst du aussuchen, wohin es geht.</p>`,
  },
  ballonTipp: {
    bild: '🎈',
    titel: 'Immer so weit laufen?',
    text: `<p>Du läufst ganz schön oft hin und her! Kennst du schon den <b>Heißluftballon</b> 🎈? Mit dem fliegst du ganz einfach von Ort zu Ort – zum Dorf, nach Hause und über die Inseln.</p>
      <p class="erklaer-aufgabe">Bau deine Base auf <b>Stufe 4</b> aus (<b>Hütte mit Garten</b>) – dann bekommst du den Ballon dazu!</p>`,
  },
  baseStufe3: {
    bild: '🛖',
    titel: 'Deine Holzhütte!',
    text: `<p>Neben der Hütte steht eine <b>Truhe</b> 📦 mit 20 Plätzen. Dort bewahrst du Sachen auf, wenn der Rucksack voll ist.</p>
      <p>Deine <b>Vorratskammer</b>: Jeden 2. Morgen liegt ein <b>Brot</b> 🍞 in der Truhe.</p>
      <p class="erklaer-aufgabe">Jetzt kannst du (ab Tag 3) auch ein <b>Fernrohr</b> 🔭 an der Werkbank bauen – damit findest du die Inseln hinter dem Nebel! Ab Tag 3 gibt es auch einen <b>Pferdestall</b> 🐴.</p>`,
  },
  rucksackVoll: {
    bild: '🎒',
    titel: 'Dein Rucksack ist voll!',
    text: `<p>Es passt nichts mehr hinein. Du kannst etwas <b>verkaufen</b>, etwas <b>wegwerfen</b> – oder ab der Holzhütte in deine <b>Truhe</b> 📦 legen.</p>
      <p class="erklaer-aufgabe">Beim <b>Händler</b> im Dorf gibt es größere Rucksäcke: den <b>Großen Rucksack</b> (18 Plätze) für ${EINSTELLUNGEN.kaufPreise.rucksackGross} Münzen und den <b>Riesen-Rucksack</b> (24 Plätze) für ${EINSTELLUNGEN.kaufPreise.rucksackRiesig} Münzen.</p>
      <p>Alles, was drin ist, bleibt beim Wechseln im Rucksack!</p>`,
  },
  pferd: {
    bild: '🐴',
    titel: 'Ein Wildpferd!',
    text: `<p>Auf der Insel leben <b>Wildpferde</b>. Wenn du eins zähmst, kannst du darauf <b>reiten</b> – viel schneller als laufen!</p>
      <p class="erklaer-aufgabe">So geht's: Kauf beim Händler einen <b>3er-Pack Äpfel</b> 🍎, nimm einen <b>in die Hand</b> und geh langsam zum Pferd. Füttere es <b>3 Mal</b> – dann gehört es dir!</p>
      <p>Mit einer <b>Leine</b> (alter Schuh + Schnur) bindest du es am <b>Pferdestall</b> an deiner Base an. Füttere es alle 2 Tage, sonst läuft es weg.</p>`,
  },
  palmeninsel: {
    bild: '🌴',
    titel: 'Herzlich willkommen auf der Palmeninsel!',
    text: `<p>Hier leben <b>13 Menschen</b>. Im <b>Palmendorf</b> gibt es einen zweiten <b>Händler</b> – jeden 3. Tag ist <b>Markttag</b> mit Wochenmarkt – und am Strand gibt es die <b>Zauberpilz-Rallye</b> 🏁.</p>
      <p>Beim Graben findest du hier <b>Muscheln</b> 🐚 und <b>Kokosnüsse</b> 🥥 zum Verkaufen.</p>
      <p class="erklaer-aufgabe">Und denk an dein großes Ziel: Du suchst immer noch das <b>Insadorium</b> 🔴! <b>Sprich die Menschen hier an</b> – vielleicht weiß jemand etwas darüber.</p>`,
  },
  klippeninsel: {
    bild: '🪨',
    titel: 'Die Klippeninsel',
    text: `<p>Riesige <b>Felswände</b>! Die dritte wertvolle Münze liegt ganz <b>oben auf der Klippe</b> – und dort oben soll auch ein geheimnisvoller <b>See</b> sein …</p>
      <p>Hochklettern geht nicht, und über der Klippe weht ein starker <b>Wind</b> – fliegen geht auch nicht. Hinauf kommst du nur mit einer <b>Seilkanone</b> 🪝: Sie schießt ein Seil mit Haken nach oben, und du kletterst daran hoch.</p>
      <p class="erklaer-aufgabe">Fahr zurück zu deiner <b>Werkbank</b> 🔨 und bau eine Seilkanone: Seil (aus 3 Schnüren), 4 Holz und 3 Eisenerz – und ein besonderes Teil …</p>
      <p>Tipp: Oben auf der Klippe findest du beim Graben viel <b>Eisenerz und Gold</b>!</p>`,
  },
  unterWasser: {
    bild: '🌊',
    titel: 'Das Insadorium liegt unter Wasser!',
    text: `<p>Jetzt weißt du es: Das <b>Insadorium</b> 🔴 liegt irgendwo <b>unter Wasser</b>!</p>
      <p>Dafür brauchst du eine <b>Taucherbrille</b> 🤿. Du hast keine – aber <b>einer der Menschen</b> auf der Palmeninsel hat eine.</p>
      <p class="erklaer-aufgabe">Sprich mit <b>allen Bewohnern</b> der Palmeninsel, bis du die Person mit der Taucherbrille gefunden hast. Sie wohnen verstreut über die ganze Insel.</p>`,
  },
  klippeBereit: {
    bild: '🎉',
    titel: 'Super, du hast alles!',
    text: `<p>Du hast jetzt alles, um auf die <b>Klippeninsel</b> zu kommen: die <b>Seilkanone</b> 🪝. Ihr Seil geht nie leer!</p>
      <p class="erklaer-aufgabe">So geht's: Fahr zur Klippeninsel, nimm die Seilkanone in die Hand, stell dich vor die <b>Felswand</b> und drück <b>„Hochschießen“</b>. Dann kletterst du am Seil hoch!</p>
      <p>Oben wartet die dritte Münze ✨.</p>
      <p><b>Viel Spaß beim Entdecken!</b></p>`,
  },
  muenzenSuche: {
    bild: '🏅',
    titel: 'Die 3 wertvollen Münzen',
    text: `<p>Für die <b>Taucherbrille</b> 🤿 willst du <b>3 wertvolle Münzen</b> – eine von jeder Insel. Sie liegen in <b>golden glitzernden Grabehügeln</b> ✨.</p>
      <p class="erklaer-aufgabe">Such zuerst die Münzen auf der <b>Palmeninsel</b> 🌴 und auf deiner <b>Heimatinsel</b> 🏠. Auf der Karte 🗺️ sind sie mit <b>❓</b> markiert. Nimm die Schaufel mit!</p>
      <p>Die dritte Münze liegt auf der <b>Klippeninsel</b> – um die kümmerst du dich danach.</p>`,
  },
  seilkanone: {
    bild: '🪝',
    titel: 'Die Seilkanone',
    text: `<p>Für die <b>Taucherbrille</b> brauchst du <b>3 wertvolle Münzen</b> – eine auf jeder Insel. Die Münze der <b>Klippeninsel</b> liegt aber ganz <b>oben auf der Klippe</b>!</p>
      <p>Hinauf kommst du nur mit einer <b>Seilkanone</b>: Sie schießt ein Seil mit Haken nach oben, und du kletterst daran hoch.</p>
      <p class="erklaer-aufgabe">Sammle die Teile: Bau an der <b>Werkbank</b> ein <b>Seil</b> (aus 3 Schnüren). Dazu brauchst du <b>4 Holz</b> und <b>3 Eisenerz</b>.</p>
      <p>Ein Teil fehlt dann noch – aber das erfährst du, wenn du alles andere hast … 😉</p>`,
  },
  widerhakenFehlt: {
    bild: '⚠️',
    titel: 'Achtung: Dir fehlt das wichtigste Teil!',
    text: `<p>Für die Seilkanone brauchst du ein Seil, 4 Holz und 3 Eisenerz – und einen <b>Widerhaken</b> 🪝. Der krallt sich oben an der Klippe fest.</p>
      <p>Einen Widerhaken kann man <b>nicht bauen</b> und <b>nicht kaufen</b>. Es gibt ihn nur als <b>Siegerpreis</b> bei der <b>Zauberpilz-Rallye</b> 🏁!</p>
      <p class="erklaer-aufgabe">Die Rallye startet am Strand vor dem <b>Palmendorf</b> 🌴 – <b>jeden Tag</b> für 50 Münzen, am <b>Markttag</b> (jeden 3. Tag) für nur 10. Gewinne sie – und der Widerhaken gehört dir!</p>
      <p>Tipp: Fahr durch die <b>Zauberpilze</b> 🍄 – die geben dir einen Turbo. Und vor engen Kurven bremsen!</p>`,
  },
  rallye: {
    bild: '🏁',
    titel: 'Die Zauberpilz-Rallye',
    text: `<p>Für die Seilkanone brauchst du einen <b>Widerhaken</b>. Den kann man nicht bauen – den gibt es nur als <b>Siegerpreis</b> bei der Rallye!</p>
      <p class="erklaer-aufgabe">Die Rallye gibt es jeden Tag (50 Münzen), am <b>Markttag</b> ist sie billiger (10 Münzen). Gewinne einmal – und der Widerhaken gehört dir!</p>
      <p>Tipp: Fahr durch die <b>Zauberpilze</b> 🍄 – die geben dir einen Turbo!</p>`,
  },
  verkaufen: {
    bild: '💰',
    titel: 'Verkauf deine Funde!',
    text: `<p>Mit Münzen kaufst du dir Brot, Würmer und vieles mehr. Münzen bekommst du, wenn du <b>verkaufst</b>.</p>
      <p>Deine <b>3 Steine und 2 Eisenerz</b> behältst du – die brauchst du gleich für dein <b>Schwert</b>!</p>
      <p class="erklaer-aufgabe">Deine Aufgabe: Grab noch einen <b>Hügel</b> aus ⛏️. Was du dort findest, bringst du zum <b>Händler</b>: <b>„Handeln“</b> und dann <b>„💰 Verkaufen“</b>.</p>`,
  },
  graben: {
    bild: '⛏️',
    titel: 'Dein erster Fund!',
    text: `<p>In den <b>Grabehügeln</b> findest du <b>Steine, Kohle, Eisenerz</b> – manchmal sogar <b>Gold</b> oder einen <b>Edelstein</b>. Und manchmal Würmer! 🪱</p>
      <p>Ein leerer Hügel <b>wächst in 2 Tagen nach</b>. Es gibt viele davon auf der Insel – schau auf die Karte 🗺️.</p>
      <p>Deine Funde kannst du beim <b>Händler verkaufen</b> (dann hast du Münzen) oder an der <b>Werkbank verbauen</b>.</p>`,
  },
  haendler: {
    bild: '🧑‍🌾',
    titel: 'Der Händler',
    text: `<p><b>🛒 Kaufen:</b> Hier gibt es Brot, Holz, Würmer, Äpfel und größere Rucksäcke.</p>
      <p><b>💰 Verkaufen:</b> Alles, was du ausgräbst oder angelst, kauft er dir ab. So kommst du an <b>Münzen</b>!</p>
      <p>Aber Achtung: Je öfter du <b>dasselbe</b> verkaufst, desto weniger zahlt er. Und pro Tag kauft er höchstens 10 Sachen.</p>
      <p>Nachts schläft er 💤 – dann musst du bis morgen warten.</p>`,
  },
  werkbank: {
    bild: '🔨',
    titel: 'Selbst bauen an der Werkbank',
    text: `<p>Neben deinem Zelt steht die <b>Werkbank</b>. Dort baust du aus deinen Funden eigene Werkzeuge.</p>
      <p>Zuerst ein <b>Schwert</b> (2 Eisenerz + 3 Steine). Damit fällst du Bäume und bekommst <b>Holz</b> – gratis!</p>
      <p>Aus Holz baust du eine <b>Schnur</b> und eine <b>Angel</b>. Grün markiert = du hast genug dafür.</p>`,
  },
  base: {
    bild: '🏠',
    titel: 'Deine Base',
    text: `<p>Hier ist dein Zuhause. Nachts schläfst du hier – dann bist du sicher und verlierst keine Münzen. 😴</p>
      <p>Du kannst deine Base <b>in 5 Stufen ausbauen</b>: Zelt → großes Zelt → Hütte mit <b>Truhe</b> 📦 → Garten mit <b>Karotten</b> 🥕 → Haus mit <b>Fischteich</b> 🎣. Ab der Hütte gibt es auch einen <b>Pferdestall</b>.</p>
      <p><b>Ab Stufe 2</b> wird dein altes Zelt zum <b>Reisezelt</b> ⛺. Das packst du in den Rucksack und stellst es <b>überall</b> auf – auch auf anderen Inseln! Und im großen Zelt schläfst du so gut, dass du nachts <b>nur halb so schnell hungrig</b> wirst.</p>
      <p><b>Ab Stufe 3</b> (Holzhütte) hast du eine <b>Vorratskammer</b>: Jeden 2. Morgen liegt ein <b>Brot</b> 🍞 in deiner Truhe. Und erst mit der Hütte kannst du ein <b>Fernrohr</b> bauen!</p>`,
  },
  holz: {
    bild: '🪵',
    titel: 'Holz kaufen – oder selbst fällen?',
    text: `<p>Beim Händler kostet Holz <b>12 Münzen</b>. Diesmal hat er dir 2 geschenkt!</p>
      <p>Mit deinem <b>eigenen Schwert</b> bekommst du Holz <b>gratis</b>: vor einen Baum stellen, „Fällen“ drücken. Ein Baum gibt 3 Holz.</p>
      <p>Aber Achtung: Das Schwert nutzt sich ab. Ein neues baust du an der Werkbank.</p>`,
  },
  essen: {
    bild: '🍞',
    titel: 'So funktioniert Essen',
    text: `<p>Oben links siehst du deinen <b>Satt-Balken</b>. Er wird in einem ganzen Tag leer – <b>auch wenn du schläfst</b>.</p>
      <p>Ist er leer, hast du <b>Hunger</b> und läufst nur noch <b>halb so schnell</b>. 😫</p>
      <p>Ein <b>Brot</b> oder ein <b>gegrillter Fisch</b> macht dich wieder ganz satt. Eine Karotte ein bisschen.</p>
      <p>Hast du einen <b>ganzen Tag</b> lang Hunger, wirst du <b>ohnmächtig</b> 😵 und verlierst Münzen und deine Funde!</p>
      <p>Du hast noch 2 Brote – die reichen für 2 Tage. Bis dahin lernst du, dich <b>selbst</b> zu versorgen!</p>`,
  },
  fisch: {
    bild: '🐟',
    titel: 'Selbst versorgen spart Geld!',
    text: `<p>Ein Brot kostet beim Händler <b>25 Münzen</b> – und du brauchst jeden Tag eins.</p>
      <p>Einen Fisch fängst du <b>gratis</b>! Grill ihn am <b>Lagerfeuer</b>, dann macht er dich genauso satt wie ein Brot.</p>
      <p>Wer selbst angelt, spart seine Münzen für die Base und das große Abenteuer. 🎉</p>
      <p><b>Als Nächstes:</b> Fürs Lagerfeuer brauchst du Holz und ein Feuerzeug. Dann grillst du deinen Fisch.</p>`,
  },
};

export class Aufgaben {
  constructor(spiel) {
    this.spiel = spiel; // { rucksack, lagerfeuer, meldung, musik, elternElement }
    this.spiel.aufgaben = this;
    this.nummer = 0;
    this.fischGegessen = false;
    this.gehandelt = false; // schon einmal beim Händler verkauft?
    this.pruefZeit = 0;

    // Die kleine Anzeige oben links
    this.anzeige = document.createElement('button');
    this.anzeige.id = 'aufgabe-anzeige';
    document.getElementById('oben-links').appendChild(this.anzeige);
    knopf(this.anzeige, () => (this.offen ? this.schliessen() : this.oeffnen()));

    // Das Fenster mit allen Aufgaben
    this.fenster = document.createElement('div');
    this.fenster.id = 'aufgaben-fenster';
    this.fenster.className = 'spiel-fenster';
    this.fenster.innerHTML = `<div class="fenster-kopf"><h2>📋 Aufgabenbuch</h2><button class="zu" aria-label="Schließen">✕</button></div><div class="grosses-ziel">🔴 <b>Dein großes Ziel:</b> Finde das <b>Insadorium</b>! Es liegt auf einer der Inseln hinter dem Nebel.</div><ol class="aufgaben-liste"></ol><h3 class="hilfe-titel">❓ Hilfe – alle Erklärungen noch mal lesen</h3><div class="hilfe-liste"></div>`;
    spiel.elternElement.appendChild(this.fenster);
    this.fenster.addEventListener('touchstart', (e) => e.stopPropagation());
    knopf(this.fenster.querySelector('.zu'), () => this.schliessen());
    this.offen = false;
    this.brotGegessen = false;
    this.erklaert = []; // welche großen Erklärungen schon kamen

    // Das große Erklär-Fenster
    this.erklaerFenster = document.createElement('div');
    this.erklaerFenster.id = 'erklaer-fenster';
    this.erklaerFenster.className = 'spiel-fenster';
    this.erklaerFenster.innerHTML = `<div class="erklaer-bild"></div><h2></h2><div class="erklaer-text"></div>
      <div class="knopf-reihe"><button class="fenster-knopf gruen erklaer-ok">Alles klar! 👍</button></div>`;
    spiel.elternElement.appendChild(this.erklaerFenster);
    this.erklaerFenster.addEventListener('touchstart', (e) => e.stopPropagation());
    this.erklaerOffen = false;
    this.erklaerWarte = [];
    this.nachGespraech = []; // Erklärungen, die warten, bis die Sprechblase eines Bewohners zu ist
    knopf(this.erklaerFenster.querySelector('.erklaer-ok'), () => {
      this.erklaerOffen = false;
      this.erklaerFenster.classList.remove('offen');
      // Nach der Aufgabenbuch-Erklärung blinkt die Anzeige oben links, damit man sie findet
      if (this.erklaerJetzt === 'aufgabenbuch') {
        this.anzeige.classList.add('leuchtet');
        setTimeout(() => this.anzeige.classList.remove('leuchtet'), 6000);
      }
      const naechste = this.erklaerWarte.shift();
      if (naechste) setTimeout(() => this.zeigeErklaerung(naechste), 400);
    });
    this.zeichnen();
  }

  // Für Ereignisse, die man nicht im Rucksack sieht
  gegessen(id) {
    if (id === 'gegrillterFisch') this.fischGegessen = true;
    if (id === 'brot') this.brotGegessen = true;
  }

  // Ist die Aufgabe mit diesem Titel schon geschafft?
  // Ist diese Aufgabe schon dran (oder schon geschafft)? Vorher bleibt das, was dazu gehört, gesperrt.
  istDran(titel) {
    const i = AUFGABEN.findIndex((a) => a.titel === titel);
    return i < 0 || i <= this.nummer;
  }

  // Der Titel der Aufgabe, die gerade dran ist
  aktuellerTitel() {
    return AUFGABEN[this.nummer]?.titel || '';
  }

  istGeschafft(titel) {
    const i = AUFGABEN.findIndex((a) => a.titel === titel);
    return i >= 0 && i < this.nummer;
  }

  oeffnen() {
    this.offen = true;
    this.zeichnen();
    this.fenster.classList.add('offen');
  }

  schliessen() {
    this.offen = false;
    this.fenster.classList.remove('offen');
  }

  aktualisiere(dt) {
    // Sprechblase zu? Dann kommen die Erklärungen, die so lange gewartet haben
    if (this.nachGespraech.length && !this.spiel.bewohner?.offen) {
      for (const w of this.nachGespraech.splice(0)) {
        if (this.erklaerOffen) this.erklaerWarte.push(w);
        else this.zeigeErklaerung(w);
      }
    }
    this.pruefZeit -= dt;
    if (this.pruefZeit > 0 || this.nummer >= AUFGABEN.length) return;
    this.pruefZeit = 0.5;
    // Reparatur für Spielstände, die die Rallye-Aufgabe übersprungen haben
    if (this.rallyePruefen) {
      this.rallyePruefen = false;
      const rallye = AUFGABEN.findIndex((x) => x.titel === 'Gewinne die Zauberpilz-Rallye');
      if (this.nummer === rallye + 1 && !AUFGABEN[rallye].geschafft(this.spiel)) { this.nummer = rallye; this.zeichnen(); }
    }
    const a = AUFGABEN[this.nummer];
    if (Object.keys(this.spiel.haendler?.verkauftHeute || {}).length > 0) this.gehandelt = true;
    if (this.spiel.haendler?.holzGeschenkt) this.holzGekauft = true;
    // Erklärungen beim ersten Mal: erster Fund beim Graben, erster Besuch beim Händler
    if (!this.erklaert.includes('graben') && this.nummer <= 2 && ['stein', 'kohle', 'eisenerz', 'gold', 'edelstein'].some((id) => this.spiel.rucksack.hat(id))) this.erklaere('graben');
    // Bei der ersten Grabe-Aufgabe: nach jedem Fund zeigen, was noch fehlt
    if (this.nummer === 2) this.grabeFortschritt();
    // Fernrohr zum ersten Mal im Rucksack (und noch eine Insel im Nebel): erklären, wie man entdeckt
    if (!this.erklaert.includes('nebel') && this.spiel.rucksack.hat('fernrohr') && (this.spiel.karte?.entdeckteInseln || []).length < 2) this.erklaere('nebel');
    // An der Werkbank (nach dem Besuch auf der Klippeninsel): Der Widerhaken fehlt noch? Dann groß warnen
    if (!this.erklaert.includes('widerhakenFehlt') && this.spiel.bewohner?.trigger && this.spiel.werkbank?.offen && (this.klippeBesucht || alleTeileAusserHaken(this.spiel)) && !this.spiel.rucksack.hat('widerhaken') && !this.spiel.rucksack.hat('seilkanone')) this.erklaere('widerhakenFehlt');
    // Zauberpilz zum ersten Mal im Rucksack
    if (!this.erklaert.includes('zauberpilz') && this.spiel.rucksack.hat('zauberpilz')) this.erklaere('zauberpilz');
    // Am ersten Tag kurz vor der Nacht: erklären, wie Schlafen geht
    const zeit = this.spiel.tageszeit;
    if (zeit && zeit.tag === 1 && !zeit.istNacht() && zeit.restSekunden() <= EINSTELLUNGEN.nachtErklaerungSekunden) this.erklaere('nacht');
    // Wer zu lange nichts für die Aufgabe tut, wird erinnert
    this.erinnere(0.5); // (diese Prüfung läuft alle halbe Sekunde)
    if (!this.erklaert.includes('haendler') && this.spiel.haendler?.offen) this.erklaere('haendler');
    if (!this.erklaert.includes('base') && this.spiel.base?.offen) this.erklaere('base');
    // Die Aufgabe, die jetzt dran ist, wird einmal groß erklärt (aber erst nach einer „danach“-Erklärung)
    if (a.start && !this.erklaert.includes(a.start) && !this.wartetDanach && !this.spiel.haendler?.offen && !a.geschafft(this.spiel)) this.erklaere(a.start);
    if (!a.geschafft(this.spiel)) return;
    this.nummer++;
    this.ohneFortschritt = 0;
    this.erinnert = 0;
    if (a.belohnung) this.spiel.rucksack.aendereMuenzen(a.belohnung);
    this.spiel.musik.pling();
    const naechste = AUFGABEN[this.nummer];
    this.spiel.meldung(
      `✅ Geschafft: ${a.titel}!${a.belohnung ? ` +${a.belohnung} 🪙` : ''}` +
        (naechste ? `  Nächste Aufgabe: ${naechste.titel}` : '  🏆 Alle Aufgaben geschafft!'),
      6
    );
    this.zeichnen();
    // Manche Aufgaben haben danach eine große Erklärung über den ganzen Bildschirm
    if (a.danach && ERKLAERUNG[a.danach]) {
      this.wartetDanach = true;
      setTimeout(() => { this.erklaere(a.danach); this.wartetDanach = false; }, 1200);
    }
  }

  // ---------- Leitplanken ----------
  // Erste Grabe-Aufgabe: nach jedem neuen Stein oder Eisenerz ein Fenster mit dem Fortschritt
  grabeFortschritt() {
    const r = this.spiel.rucksack;
    const steine = Math.min(3, r.anzahl('stein')), erz = Math.min(2, r.anzahl('eisenerz'));
    const vorher = this.grabeStand;
    this.grabeStand = { steine, erz };
    if (!vorher) return; // beim ersten Mal nur merken, was man schon hat
    if (steine + erz <= vorher.steine + vorher.erz) return;
    const fehlt = [];
    if (steine < 3) fehlt.push(`<b>${3 - steine} ${3 - steine === 1 ? 'Stein' : 'Steine'}</b>`);
    if (erz < 2) fehlt.push(`<b>${2 - erz} Eisenerz</b>`);
    const fertig = fehlt.length === 0;
    this.zeigeFrei({
      bild: fertig ? '🎉' : '🪨',
      titel: fertig ? 'Geschafft – alles ausgegraben!' : 'Gefunden!',
      text: `<p>Du hast jetzt <b>${steine} von 3 Steinen</b> und <b>${erz} von 2 Eisenerz</b>.</p>` +
        (fertig
          ? `<p>Daraus baust du später dein erstes <b>Schwert</b>. 🗡️</p>`
          : `<p class="erklaer-aufgabe">Noch ${fehlt.join(' und ')}! Such den <b>nächsten glitzernden Hügel</b> und grab weiter.</p>`),
    });
  }

  // Zu lange nichts für die Aufgabe getan? Dann einmal groß daran erinnern
  erinnere(dt) {
    if (this.nummer > EINSTELLUNGEN.erinnerungBisAufgabe || this.erklaerOffen || this.offen || this.spiel.haendler?.offen) return;
    this.ohneFortschritt = (this.ohneFortschritt || 0) + dt;
    if (this.ohneFortschritt < EINSTELLUNGEN.erinnerungNachSekunden) return;
    this.ohneFortschritt = 0;
    if ((this.erinnert || 0) >= EINSTELLUNGEN.erinnerungenProAufgabe) return;
    const zeit = this.spiel.tageszeit;
    if (zeit?.istNacht()) return; // nachts soll man schlafen, nicht Aufgaben machen
    this.erinnert = (this.erinnert || 0) + 1;
    const a = AUFGABEN[this.nummer];
    this.zeigeFrei({
      bild: '📋',
      titel: 'Denk an deine Aufgabe!',
      text: `<p class="erklaer-aufgabe"><b>${a.titel}</b></p><p>${a.tipp}</p><p>Oben links im <b>Aufgabenbuch</b> steht immer, was als Nächstes dran ist.</p>`,
    });
  }

  // Ein Fenster, das nicht fest ausgedacht ist (z. B. mit Zahlen drin)
  zeigeFrei(inhalt) {
    if (this.spiel.bewohner?.offen) { this.nachGespraech.push(inhalt); return; }
    if (this.erklaerOffen) { this.erklaerWarte.push(inhalt); return; }
    this.zeigeErklaerung(inhalt);
  }

  // ---------- Große Erklärung (über den ganzen Bildschirm) ----------
  erklaere(welche) {
    const e = ERKLAERUNG[welche];
    if (!e || this.erklaert.includes(welche)) return;
    this.erklaert.push(welche);
    // Spricht gerade ein Bewohner mit dir? Dann erst nach seinem „OK“ zeigen
    if (this.spiel.bewohner?.offen) { this.nachGespraech.push(welche); return; }
    // Ist gerade schon eine Erklärung offen? Dann kommt diese danach dran
    if (this.erklaerOffen) { this.erklaerWarte.push(welche); return; }
    this.zeigeErklaerung(welche);
  }

  zeigeErklaerung(welche) {
    const e = typeof welche === 'string' ? ERKLAERUNG[welche] : welche;
    this.erklaerFenster.querySelector('.erklaer-bild').innerHTML = e.bild;
    this.erklaerFenster.querySelector('h2').textContent = e.titel;
    this.erklaerFenster.querySelector('.erklaer-text').innerHTML = e.text;
    this.erklaerJetzt = welche;
    this.erklaerOffen = true;
    this.erklaerFenster.classList.add('offen');
  }

  zeichnen() {
    const jetzt = AUFGABEN[this.nummer];
    // Das Buch-Bild kommt aus ui-bilder.js, der Text steht daneben
    this.anzeige.innerHTML = `${uiBild('buch')}<span>${jetzt ? jetzt.titel : '🏆 Alle Aufgaben geschafft!'}</span>`;
    const liste = this.fenster.querySelector('.aufgaben-liste');
    liste.innerHTML = AUFGABEN.map((a, i) => {
      const zustand = i < this.nummer ? 'fertig' : i === this.nummer ? 'jetzt' : 'spaeter';
      const zeichen = uiBild(zustand === 'fertig' ? 'haken' : zustand === 'jetzt' ? 'pfeil' : 'schloss');
      const tipp = zustand === 'jetzt' ? `<div class="aufgabe-tipp">${a.tipp}</div>` : '';
      const belohnung = a.belohnung ? `<span class="aufgabe-lohn">+${a.belohnung} ${muenzeKlein()}</span>` : '';
      const titel = zustand === 'spaeter' ? '???' : a.titel;
      return `<li class="aufgabe ${zustand}"><span class="aufgabe-zeichen">${zeichen}</span><div><b>${titel}</b>${tipp}</div>${belohnung}</li>`;
    }).join('');
    // Hilfe: Alle großen Erklärungen, die man schon gesehen hat, kann man hier noch mal öffnen
    const hilfe = this.fenster.querySelector('.hilfe-liste');
    hilfe.innerHTML = '';
    const gesehen = ['aufgabenbuch', ...this.erklaert].filter((id, i, alle) => ERKLAERUNG[id] && alle.indexOf(id) === i);
    for (const id of gesehen) {
      const k = document.createElement('button');
      k.className = 'hilfe-knopf';
      k.innerHTML = `<span>${ERKLAERUNG[id].bild}</span> ${ERKLAERUNG[id].titel}`;
      knopf(k, () => this.zeigeErklaerung(id));
      hilfe.appendChild(k);
    }
  }

  alsDaten() {
    return { nummer: this.nummer, fischGegessen: this.fischGegessen, brotGegessen: this.brotGegessen, gehandelt: this.gehandelt, holzGekauft: this.holzGekauft, erklaert: this.erklaert, version: 12, klippeBesucht: !!this.klippeBesucht };
  }

  ladeDaten(d) {
    let nummer = d.nummer || 0;
    // Alte Spielstände kannten die Händler-Aufgabe (Nummer 4) noch nicht
    if (!d.version && nummer >= 3) nummer++;
    // Version 2 kannte die zwei Brot-Aufgaben (Nummer 4 und 5) noch nicht – wer weiter war, hat sie übersprungen
    if ((d.version || 1) < 3 && nummer >= 3) nummer += 2;
    // Version 3 kannte „Kauf Holz beim Händler“ (Nummer 12) noch nicht
    if ((d.version || 1) < 4 && nummer >= 12) nummer += 1;
    // Version 4 kannte „Bau ein Fernrohr“ (jetzt Nummer 21) und „Gewinne die Rallye“ (jetzt Nummer 26) noch nicht
    // (Wer bei „Bau eine Seilkanone“ war, landet bei der Rallye – hat er den Widerhaken schon, geht es von selbst weiter)
    if ((d.version || 1) < 5 && nummer >= 21) nummer += nummer >= 26 ? 2 : 1;
    // Version 5 kannte „Sammle alles für die Seilkanone“ (jetzt Nummer 26) noch nicht
    if ((d.version || 1) < 6 && nummer >= 26) nummer += 1;
    // Version 6: Münzen + Brille kamen VOR der Seilkanone – jetzt erst Seilkanone, dann Münzen
    // (wer schon weiter war, rutscht über die geschafft-Prüfungen von selbst wieder nach vorn)
    if ((d.version || 1) < 7) nummer = { 24: 24, 25: 24, 26: 24, 27: 25, 28: 26 }[nummer] ?? nummer;
    // Version 7: „Frag nach dem Insadorium“ kam neu vor „Finde die Person mit der Taucherbrille“ (jetzt 24)
    if ((d.version || 1) < 8 && nummer >= 24) nummer += 1;
    // Version 8: Erst Münzen auf Palmen- und Heimatinsel, dann zur Klippe, dann Seilkanone (geschafft-Prüfungen schieben weiter)
    if ((d.version || 1) < 9) nummer = { 25: 25, 26: 28, 27: 29, 28: 25, 29: 31, 30: 32 }[nummer] ?? nummer;
    // Version 9 kannte „Bau ein Seil zum Hochschießen“ (jetzt 30) noch nicht
    if ((d.version || 1) < 10 && nummer >= 30) nummer += 1;
    // Version 10 hatte noch „Spar 150 Münzen und kauf den Ballon“ (Nummer 20) – die ist raus, der Ballon kommt mit Base-Stufe 4
    if ((d.version || 1) < 11 && nummer > 20) nummer -= 1;
    // Version 11 hatte noch „Bau ein Seil zum Hochschießen“ (Nummer 29) – das Seil geht jetzt nie leer
    if ((d.version || 1) < 12 && nummer > 29) nummer -= 1;
    this.klippeBesucht = !!d.klippeBesucht;
    this.rallyePruefen = true; // einmal nachschauen, ob die Rallye übersprungen wurde (siehe aktualisiere)
    this.holzGekauft = !!d.holzGekauft || nummer > 12;
    this.brotGegessen = !!d.brotGegessen || nummer > 4;
    this.erklaert = Array.isArray(d.erklaert) ? d.erklaert : nummer > 4 ? ['essen'] : [];
    if (nummer > 11 && !this.erklaert.includes('fisch')) this.erklaert.push('fisch');
    // Wer schon weiter ist, braucht die Anfangs-Erklärungen nicht mehr
    for (const [id, ab] of [['graben', 2], ['haendler', 3], ['werkbank', 5], ['holz', 12]]) if (nummer > ab && !this.erklaert.includes(id)) this.erklaert.push(id);
    // Start-Erklärungen der Aufgaben, die man schon hinter sich hat
    AUFGABEN.forEach((a, i) => { if (a.start && nummer > i && !this.erklaert.includes(a.start)) this.erklaert.push(a.start); });
    this.nummer = Math.min(nummer, AUFGABEN.length);
    this.fischGegessen = !!d.fischGegessen;
    this.gehandelt = !!d.gehandelt || (!d.version && nummer > 3);
    this.zeichnen();
  }
}
