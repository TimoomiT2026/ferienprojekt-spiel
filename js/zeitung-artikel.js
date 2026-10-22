// =============================================================
//  ZEITUNGS-ARTIKEL 📰 – Bild-Vorlagen + lustige Texte
//  Für jedes Ereignis (Fisch gefangen, Pferd gezähmt …) gibt es
//  1–3 Varianten. Jede Variante macht aus den Daten:
//    titel (Schlagzeile) · text (Artikel) · bild (das "Foto")
//  d = { m: Inselbewohner, name: sein Vorname, n: wie oft, daten, z: Zufall }
//  Die Tiere bekommen Spitznamen, damit man sie wiedererkennt:
//    Schaf Wolke · Hase Hoppel · Möwe Gisela · Eule Udo · Krebs Kalle
// =============================================================
import {
  B, hintergrund, foto, kind, haendler, schaf, hase, pferd, moewe, eule, krebs, fisch, sonnenbrille, boot, palme, baum, stumpf, holzstamm,
  pilz, muenze, kokosnuss, schuh, dose, brot, tasse, limo, herz, ballon, koffer, helmHammer, fernrohr, fahne, drachen, sandburg,
  pfannkuchen, surfbrett, muschel, staffelei, noten, stand, inselchen, haeuschen, zzz, ausruf, insadorium, erdloch,
} from './zeitung-bilder.js';

const { setze, linie, schrift, tempo, kreis, pfad, ell, mond, sonne, wellen, OHNE } = B;
const FISCH_FARBEN = [['#4cc6ea', '#ffd23f'], ['#ff8a3d', '#fff'], ['#c77dff', '#ffd23f'], ['#4cb83a', '#ff5fa2'], ['#ff5fa2', '#fff']];
const BASE_NAMEN = ['', 'Zelt', 'großes Zelt', 'Holzhütte', 'Hütte mit Garten', 'Haus mit Fischteich'];
const mal = (n, eins, viele) => (n === 1 ? eins : `${n} ${viele}`);
const fischFarbe = (d) => FISCH_FARBEN[Math.floor(d.z() * FISCH_FARBEN.length)];
const foto2 = (art, d, inhalt, text) => foto(hintergrund(art, d.z) + inhalt, text);

// ---------- Vorlagen pro Ereignis-Typ ----------
export const VORLAGEN = {
  fisch: [
    (d) => {
      const [f, s] = fischFarbe(d);
      return {
        titel: 'RIESEN-FANG!',
        text: `Unser Inselforscher hat ${mal(d.n, 'einen Tofu-Fisch', 'Tofu-Fische')} geangelt! Der größte war so schwer, dass ${d.name} beim Hochheben ganz rot im Gesicht wurde. Schaf Wolke staunt.`,
        bild: foto2('strand', d,
          setze(255, 178, 1.15, schaf({ augen: 'gross', mund: 'o' }), true) +
          setze(140, 186, 1.12, kind(d.m, { haende: [[-30, -100], [30, -100]], mund: 'grinsen' })) +
          setze(140, 66, 2.6, fisch(f, { streifen: s })) + schrift(232, 60, 'WOW!', 26, '#ffd23f', 8) +
          kreis(98, 92, 3, '#bfe9ff') + kreis(184, 96, 3, '#bfe9ff'), `${d.name} hält einen riesigen Fisch hoch`),
      };
    },
    (d) => {
      const [f, s] = fischFarbe(d);
      return {
        titel: 'Möwe klaut Fisch!',
        text: `Kaum war der Tofu-Fisch an Land, kam Möwe Gisela angesaust – und schwupp, weg war er! ${d.name} hat alles gesehen. Zum Glück hat der Forscher diese Woche ${mal(d.n, 'noch einen', 'Fische')} gefangen.`,
        bild: foto2('strand', d,
          setze(95, 186, 1.12, kind(d.m, { haende: [[-24, -40], [30, -96]], mund: 'o', augen: 'gross' })) +
          setze(208, 70, 1.7, moewe({ fliegt: true })) + setze(262, 82, 0.75, fisch(f, { streifen: s }), false, 40) +
          tempo(170, 62, 26) + schrift(70, 60, 'HEY!', 26, '#ffd23f', -8), 'Eine Möwe fliegt mit einem Fisch davon'),
      };
    },
    (d) => {
      const [f, s] = fischFarbe(d);
      return {
        titel: 'Fisch mit Sonnenbrille gesichtet!',
        text: `Beim Angeln ist ein ganz besonders cooler Fisch aus dem Wasser gesprungen. Er trug eine Sonnenbrille! Wo er die her hat? Keine Ahnung. Insgesamt wurden ${mal(d.n, 'ein Tofu-Fisch', 'Tofu-Fische')} gefangen.`,
        bild: foto2('meer', d,
          setze(175, 92, 2.4, fisch(f, { streifen: s, brille: true }), false, -22) +
          linie('M110 150q30 -60 60 -40M240 150q-20 -50 -40 -30', '#fff', 3, 0.8) +
          kreis(120, 120, 5, '#fff', OHNE) + kreis(240, 118, 4, '#fff', OHNE) + kreis(132, 104, 3, '#fff', OHNE) +
          setze(60, 132, 0.8, boot()) + setze(60, 132, 0.6, kind(d.m, { haende: [[-22, -60], [24, -70]], mund: 'o', augen: 'gross' })) +
          wellen(150), 'Ein Fisch mit Sonnenbrille springt aus dem Wasser'),
      };
    },
  ],

  muell: [
    (d) => {
      if (d.daten.ding === 'dose') {
        return {
          titel: 'Krebs zieht in Dose ein',
          text: `Beim Angeln hing eine rostige Dose am Haken. Jetzt hat sie einen neuen Besitzer: Krebs Kalle wohnt darin! ${d.name} hat ihm schon ein Namensschild gemalt.`,
          bild: foto2('strand', d,
            setze(170, 178, 2.6, dose()) + setze(170, 118, 1.5, krebs()) +
            `<rect x="198" y="140" width="52" height="20" rx="4" fill="#fffaf0"/>` + schrift(224, 156, 'KALLE', 14, '#e0553a') +
            setze(70, 186, 1.05, kind(d.m, { haende: [[-22, -30], [26, -50]], mund: 'grinsen' })), 'Ein Krebs wohnt in einer Dose'),
        };
      }
      if (d.daten.ding === 'alge') {
        return {
          titel: 'Neue Frisur: Algen-Look!',
          text: `Statt eines Fisches hing nur eine glitschige Alge an der Angel. Schaf Wolke fand sie toll und trägt sie jetzt als Frisur. ${d.name} sagt: „Sehr schick!“`,
          bild: foto2('strand', d,
            setze(170, 182, 2.1, schaf({ brille: true }) + linie('M22 -36q-6 10 -2 22M27 -38q2 12 -1 22M32 -37q6 8 4 20', '#3f9f3a', 3.5)) +
            setze(60, 186, 1.0, kind(d.m, { haende: [[-24, -60], [26, -60]], mund: 'grinsen' })) + schrift(272, 70, 'SCHICK!', 20, '#7be36a', 10), 'Ein Schaf mit Algen-Frisur'),
        };
      }
      return {
        titel: 'Neue Mode: Der Schuh-Hut!',
        text: `Beim Angeln hing ein alter Schuh am Haken. Möwe Gisela findet ihn super – als Hut! Seitdem wollen alle Möwen der Insel auch einen. ${d.name} lacht sich kaputt.`,
        bild: foto2('strand', d,
          setze(170, 150, 2.4, moewe() + setze(14, -16, 0.6, schuh(), false, -10)) +
          setze(62, 186, 1.0, kind(d.m, { haende: [[-24, -56], [26, -56]], mund: 'grinsen' })) + schrift(262, 62, 'CHIC!', 22, '#ffd23f', 10), 'Eine Möwe trägt einen alten Schuh als Hut'),
      };
    },
  ],

  baum: [
    (d) => ({
      titel: 'Wo ist mein Baum?',
      text: `Diese Woche ${d.n === 1 ? 'ist ein Baum' : `sind ${d.n} Bäume und Büsche`} umgefallen – jedes Mal mit einem lauten KRACH! Eule Udo sucht jetzt einen neuen Schlafplatz. Tipp vom Inselboten: Da hinten stehen noch ganz viele!`,
      bild: foto2('wiese', d,
        setze(268, 148, 0.9, baum()) + setze(300, 156, 0.7, baum()) + setze(80, 170, 1.4, stumpf()) + setze(200, 172, 1.0, stumpf()) +
        setze(80, 145, 1.3, eule()) + schrift(118, 72, '?', 36, '#ffd23f', 10) + schrift(136, 92, '?', 24, '#ffd23f', -10) +
        setze(178, 180, 1.0, holzstamm(-8)), 'Eine Eule sitzt verwirrt auf einem Baumstumpf'),
    }),
    (d) => ({
      titel: 'Holz-Rekord auf der Insel!',
      text: `${mal(d.n, 'Ein Baum ist', 'Bäume und Büsche sind')} gefällt worden. Das Holz liegt jetzt überall herum – und Schaf Wolke hat den Holzstapel sofort zu seinem Lieblingssessel erklärt. ${d.name} hilft beim Stapeln.`,
      bild: foto2('wiese', d,
        setze(180, 176, 1.3, holzstamm() + setze(0, -14, 1, holzstamm()) + setze(-20, -28, 1, holzstamm()) + setze(20, -28, 1, holzstamm())) +
        setze(176, 136, 1.15, schaf({ augen: 'zu' })) + setze(70, 186, 1.05, kind(d.m, { haende: [[-20, -46], [24, -46]] }) + setze(2, -46, 1, holzstamm(5))) +
        setze(288, 150, 0.8, baum()), 'Ein Schaf sitzt auf einem Holzstapel'),
    }),
  ],

  grabung: [
    (d) => ({
      titel: 'Hase Hoppel hilft beim Graben',
      text: `${d.n} Mal wurde diese Woche gebuddelt! Hase Hoppel macht jetzt mit – mit Helm, damit nichts passiert. Zuletzt gefunden: ${d.dingName}. Hoppel hat bisher nur eine Karotte gefunden.`,
      bild: foto2('wiese', d,
        setze(150, 170, 1.2, erdloch()) + setze(205, 170, 1.7, hase({ helm: true })) +
        setze(118, 130, 1, kreis(0, 0, 5, '#8a5a30') + kreis(-14, 10, 4, '#8a5a30') + kreis(10, -16, 3.5, '#8a5a30')) +
        setze(70, 120, 1, pfad('M0 0L-8 -28Q0 -34 8 -28Z', '#ff8a2a') + linie('M-2 -30l-4 -10M2 -30l2 -10M0 -30v-12', '#4cb83a', 3), false, -30) +
        schrift(260, 70, 'BUDDEL!', 20, '#ffd23f', 8), 'Ein Hase mit Helm gräbt ein Loch'),
    }),
    (d) => ({
      titel: 'Schatzsucher unterwegs!',
      text: `Auf der Insel wurde ${d.n} Mal gegraben. Zuletzt kam ${d.dingName} aus der Erde. ${d.name} ist sich sicher: Irgendwo liegt noch ein riesiger Schatz!`,
      bild: foto2('wiese', d,
        setze(160, 172, 1.3, erdloch()) + setze(160, 150, 1.5, muenze(12)) + B.funkeln(130, 120, 7) + B.funkeln(196, 112, 6) +
        setze(70, 186, 1.05, kind(d.m, { haende: [[-24, -94], [24, -94]], mund: 'grinsen', augen: 'gross' })) +
        setze(255, 172, 1.4, hase(), true), 'Jemand findet etwas Glänzendes in der Erde'),
    }),
  ],

  'pferd-gezaehmt': [
    () => ({
      titel: 'Hase reitet Pferd!',
      text: 'Der Forscher hat ein Wildpferd gezähmt – mit Äpfeln und viel Geduld. Hase Hoppel hat es gleich ausprobiert und ist eine Runde geritten. Hü-hott!',
      bild: foto(hintergrund('wiese') + setze(160, 180, 1.35, pferd()) + setze(150, 125, 1.05, hase()) + tempo(70, 120, 26) + schrift(260, 52, 'HÜ-HOTT!', 22, '#ffd23f', 8), 'Ein Hase reitet auf einem Pferd'),
    }),
    (d) => ({
      titel: 'Beste Freunde!',
      text: `Ein Wildpferd vertraut jetzt dem Forscher! ${d.name} hat zur Feier einen Apfel mitgebracht. Das Pferd hat sich sehr gefreut.`,
      bild: foto2('wiese', d,
        setze(190, 182, 1.25, pferd(), true) + setze(84, 186, 1.05, kind(d.m, { haende: [[-20, -40], [30, -66]], mund: 'grinsen' })) +
        setze(116, 116, 1, kreis(0, 0, 7, '#e8352a') + linie('M0 -7v-4', '#6b3a1a', 2)) +
        setze(150, 54, 1.4, herz()) + setze(176, 36, 0.9, herz()), 'Ein Kind gibt einem Pferd einen Apfel'),
    }),
  ],

  'pferd-ausgerissen': [
    () => ({
      titel: 'Pferd macht Urlaub!',
      text: 'Ein Pferd hatte Hunger und ist ausgerissen. Zuletzt wurde es mit einem Koffer am Strand gesehen. Tipp vom Inselboten: Mit Äpfeln kommt es bestimmt zurück!',
      bild: foto(hintergrund('strand') + setze(150, 182, 1.3, pferd() + setze(58, -54, 0.9, koffer())) + sonne(282, 38, 16, true) + schrift(70, 68, 'TSCHÜSS!', 20, '#ffd23f', -8), 'Ein Pferd mit Koffer geht in den Urlaub'),
    }),
    () => ({
      titel: 'Ausreißer am Strand',
      text: 'Ein Pferd ist weggelaufen und liegt jetzt mit Sonnenbrille am Strand. Es sagt: „Füttern vergessen? Dann mach ich eben Ferien!“ Ein Apfel hilft.',
      bild: foto(hintergrund('strand') + setze(160, 180, 1.3, pferd() + sonnenbrille(47, -76, 0.45)) + setze(250, 182, 1.4, palme(4)) + sonne(46, 40, 16), 'Ein Pferd mit Sonnenbrille am Strand'),
    }),
  ],

  'insel-entdeckt': [
    (d) => ({
      titel: 'Neue Insel entdeckt!',
      text: `Der Forscher hat die ${d.daten.name || 'neue Insel'} entdeckt! Schaf Wolke wollte unbedingt mit und hat sich dafür ein eigenes Fernrohr gebastelt.`,
      bild: foto2('meer', d,
        setze(245, 120, 1.1, inselchen() + setze(30, -18, 0.9, fahne('#ffd23f'))) + schrift(270, 68, 'NEU!', 22, '#ff5f5f', 8) +
        setze(100, 132, 1.1, schaf() + setze(30, -26, 0.6, fernrohr())) + setze(100, 136, 1, boot()) + wellen(146), 'Ein Schaf im Boot schaut durchs Fernrohr auf eine Insel'),
    }),
    (d) => ({
      titel: 'Land in Sicht!',
      text: `Möwe Gisela hat sie zuerst gesehen: die ${d.daten.name || 'neue Insel'}! Der Forscher war aber als Erster da. ${d.name} hat zur Feier eine Fahne genäht.`,
      bild: foto2('meer', d,
        setze(170, 122, 1.6, inselchen()) + setze(200, 98, 1.1, fahne('#ec4630')) + setze(84, 56, 1.4, moewe({ fliegt: true })) + tempo(52, 48, 22) + wellen(140), 'Eine Möwe fliegt über eine neue Insel'),
    }),
  ],

  'muenze-gefunden': [
    (d) => ({
      titel: 'Ist die echt?',
      text: `Eine uralte, wertvolle Münze ist aufgetaucht${d.daten.anzahl ? ` – schon ${d.daten.anzahl} von 3` : ''}! Hase Hoppel hat sofort reingebissen, um zu prüfen, ob sie echt ist. Sie ist echt. Und sehr hart. Aua!`,
      bild: foto2('wiese', d,
        setze(150, 176, 1.9, hase()) + setze(196, 112, 2.2, muenze(12)) + B.funkeln(230, 80, 7) + B.funkeln(240, 130, 5) + schrift(84, 80, 'AUA!', 24, '#ffd23f', -8), 'Ein Hase beißt in eine goldene Münze'),
    }),
    (d) => ({
      titel: 'Gold glänzt so hell!',
      text: `Wieder eine wertvolle Münze gefunden${d.daten.anzahl ? ` (${d.daten.anzahl} von 3)` : ''}! Sie glänzt so stark, dass ${d.name} eine Sonnenbrille aufsetzen musste.`,
      bild: foto2('strand', d,
        setze(150, 188, 1.15, kind(d.m, { haende: [[-24, -96], [24, -96]], mund: 'grinsen' }) + sonnenbrille(0, -63, 0.85)) +
        setze(150, 58, 1.8, muenze(12)) + B.funkeln(110, 40, 7) + B.funkeln(196, 46, 8) + B.funkeln(190, 86, 5), 'Ein Kind mit Sonnenbrille hält eine Münze hoch'),
    }),
  ],

  insadorium: [
    (d) => ({
      titel: 'SENSATION: Das Insadorium ist gefunden!',
      text: `Es ist wahr! Der Forscher hat das geheimnisvolle Insadorium aus dem See auf der Klippe geholt. Es leuchtet so grell, dass alle Schafe jetzt Sonnenbrillen tragen. ${d.name} jubelt!`,
      bild: foto2('wiese', d,
        setze(165, 160, 1.6, insadorium()) + setze(62, 176, 1.1, schaf({ brille: true })) + setze(270, 178, 1.0, schaf({ brille: true }), true) +
        schrift(160, 44, 'WOW!', 30, '#ffd23f'), 'Ein rot leuchtender Stein, daneben Schafe mit Sonnenbrillen'),
    }),
  ],

  zauberpilz: [
    () => ({
      titel: 'Fliegendes Schaf gesichtet?!',
      text: 'Jemand hat einen Zauberpilz gegessen und ist über die Insel geflogen! Schaf Wolke hat nur kurz am Pilz geschnuppert – und schwebt seitdem auch ein kleines bisschen.',
      bild: foto(hintergrund('wiese') + setze(190, 104, 1.4, schaf({ augen: 'gross', mund: 'o' }), false, -8) + tempo(130, 90, 30) +
        setze(76, 178, 1.6, pilz()) + B.funkeln(100, 120, 6) + B.funkeln(230, 52, 5) + B.funkeln(250, 120, 4) + schrift(270, 168, 'HUI!', 22, '#ffd23f', 8), 'Ein Schaf fliegt durch die Luft'),
    }),
    (d) => ({
      titel: 'Da oben fliegt doch wer!',
      text: `${d.name} hat es genau gesehen: Nach einem Zauberpilz ist der Forscher über die Insel geflogen! Möwe Gisela war so überrascht, dass sie fast vom Himmel gefallen wäre.`,
      bild: foto2('wiese', d,
        setze(80, 188, 1.0, kind(d.m, { haende: [[-22, -40], [26, -96]], mund: 'o', augen: 'gross' })) + setze(180, 80, 1.3, moewe({ fliegt: true }), true, 20) +
        schrift(220, 56, '?!', 28, '#ffd23f') + setze(258, 172, 1.3, pilz()) + B.funkeln(150, 40, 6) + B.funkeln(280, 100, 5), 'Eine Möwe schaut überrascht'),
    }),
  ],

  'ballon-flug': [
    (d) => ({
      titel: 'Wettflug: Möwe gegen Ballon',
      text: `Der Forscher ist mit dem Heißluftballon ${d.daten.ziel ? `zum Ziel „${d.daten.ziel}“ ` : ''}geflogen. Möwe Gisela wollte unbedingt ein Wettrennen – und hat knapp gewonnen. Sagt sie.`,
      bild: foto(hintergrund('meer') + setze(130, 118, 1.25, ballon()) + setze(250, 64, 1.3, moewe({ fliegt: true })) + tempo(214, 58, 28) + tempo(90, 70, 20) + schrift(266, 110, 'ERSTE!', 18, '#ffd23f', 8), 'Ein Ballon und eine Möwe fliegen um die Wette'),
    }),
    () => ({
      titel: 'Schaf an Bord!',
      text: 'Beim letzten Ballonflug hat sich ein blinder Passagier in den Korb geschmuggelt: Schaf Wolke! Es sagt, die Aussicht ist „mäh-gnifique“.',
      bild: foto(hintergrund('meer') + setze(160, 100, 1.5, ballon('#4cb83a', '#fffaf0')) + setze(156, 126, 0.55, schaf({ augen: 'gross' })) + B.funkeln(230, 50, 6) + B.funkeln(90, 40, 5), 'Ein Schaf schaut aus einem Heißluftballon'),
    }),
  ],

  'nicht-geschlafen': [
    (d) => ({
      titel: 'Wer war die ganze Nacht wach?',
      text: `Eule Udo hat Besuch bekommen: Jemand war die ganze Nacht wach! Udo sagt: „Nachts wach sein ist MEIN Job. Geht schlafen!“${d.daten.strafe ? ` Die Müdigkeit hat ${d.daten.strafe} Münzen gekostet.` : ''}`,
      bild: foto2('nacht', d, mond(64, 50, 22) + setze(200, 168, 1.8, eule({ muede: true })) + schrift(266, 80, 'GÄHN!', 22, '#fff7c8', 8), 'Eine müde Eule mit Augenringen'),
    }),
  ],

  hunger: [
    (d) => ({
      titel: 'Bauch-Knurren weckt Schafe',
      text: `Ein Bauch hat so laut geknurrt, dass alle Schafe vor Schreck hochgehüpft sind! Tipp vom Inselboten: Brot oder gegrillter Fisch hilft. ${d.name} hat auch schon Hunger bekommen.`,
      bild: foto2('wiese', d,
        setze(90, 150, 1.2, schaf({ augen: 'gross', mund: 'o' })) + setze(210, 132, 1.1, schaf({ augen: 'gross', mund: 'o' }), true) +
        linie('M80 170q-6 4 0 8M100 172q6 4 0 8M200 156q-6 4 0 8M220 158q6 4 0 8', '#fff', 2.5) +
        schrift(160, 64, 'GRRRRR!', 34, '#ff8a3d', -4), 'Schafe springen vor Schreck in die Luft'),
    }),
  ],

  'base-ausbau': [
    (d) => {
      const name = d.daten.stall ? 'Pferdestall' : BASE_NAMEN[d.daten.stufe] || 'neue Base';
      return {
        titel: d.daten.stall ? 'Neuer Pferdestall!' : 'Bau-Hase im Einsatz',
        text: d.daten.stall
          ? 'An der Base steht jetzt ein Pferdestall. Hase Hoppel hat mit Helm und Hammer geholfen – meint er. Die Pferde freuen sich!'
          : `Die Base ist jetzt ein${['Zelt', 'großes Zelt', 'Haus mit Fischteich'].includes(name) ? '' : 'e'} ${name}! Hase Hoppel hat mit Helm und Hammer geholfen. Na ja, er hat zugeschaut. ${d.name} kommt bald zu Besuch.`,
        bild: foto2('wiese', d,
          setze(200, 166, 1.4, haeuschen()) + setze(90, 172, 1.7, hase({ helm: true }) + setze(18, -14, 1, helmHammer())) +
          schrift(276, 64, 'TOCK!', 20, '#ffd23f', 10) + B.funkeln(250, 100, 6), 'Ein Hase mit Bauhelm vor einem Haus'),
      };
    },
  ],

  'markt-kauf': [
    (d) => ({
      titel: 'Händler macht Mittagsschlaf',
      text: `Auf dem Wochenmarkt war viel los: ${mal(d.n, 'ein Einkauf', 'Einkäufe')}${d.dingName ? `, zuletzt ${d.dingName}` : ''}! Danach war ein Händler so müde, dass er im Stehen eingeschlafen ist.`,
      bild: foto2('markt', d,
        setze(160, 150, 1.0, haendler({ augen: 'zu', haende: [[-24, -30], [24, -30]] })) + setze(160, 186, 1.2, stand()) +
        setze(126, 146, 1, brot()) + setze(196, 146, 1, kreis(0, 0, 6, '#e8352a') + kreis(12, 2, 6, '#e8352a')) + zzz(196, 66), 'Ein Händler schläft hinter seinem Stand'),
    }),
    () => ({
      titel: 'Möwe klaut Brot!',
      text: 'Großer Andrang am Marktstand! Nur Möwe Gisela wollte nicht bezahlen und ist mit einem Brot davongeflogen. Der Händler ruft: „Halt, das kostet was!“',
      bild: foto(hintergrund('markt') + setze(110, 150, 1.0, haendler({ haende: [[-22, -40], [26, -92]], mund: 'o', augen: 'gross' })) + setze(110, 186, 1.2, stand('#2f8fe0')) +
        setze(236, 66, 1.5, moewe({ fliegt: true })) + setze(278, 78, 0.9, brot(), false, 20) + tempo(200, 58, 26) + schrift(60, 52, 'HALT!', 22, '#ffd23f', -8), 'Eine Möwe fliegt mit einem Brot davon'),
    }),
  ],

  kaffee: [
    (d) => ({
      titel: 'Schaf trinkt Kaffee',
      text: `Ein Kaffee vom Markt, und man muss eine Nacht nicht schlafen! Schaf Wolke hat heimlich einen Schluck genommen und ist seitdem HELLWACH. ${d.name} hat es beim Schäfchenzählen erwischt.`,
      bild: foto2('wiese', d,
        setze(150, 172, 1.7, schaf({ augen: 'gross' })) + setze(222, 150, 1.4, tasse()) +
        linie('M84 120l-6 4 6 4-6 4M84 150l-6 4 6 4-6 4M214 96l6 4-6 4 6 4', '#fff', 3) + schrift(150, 54, 'HELLWACH!', 26, '#ffd23f', -4), 'Ein Schaf mit riesigen Augen neben einer Kaffeetasse'),
    }),
  ],

  limo: [
    () => ({
      titel: 'Mond braucht Sonnenbrille!',
      text: 'Die Nacht-Limo vom Markt macht die Nacht taghell! Der Mond war so geblendet, dass er sich eine Sonnenbrille besorgen musste. Eule Udo findet das gar nicht lustig.',
      bild: foto(`<rect width="320" height="200" fill="#9fdcff"/>` + kreis(160, 100, 140, 'url(#zb-schein)', OHNE) + mond(90, 56, 26, true) +
        setze(220, 176, 2.0, limo()) + pfad('M0 160Q100 146 200 158T320 152V200H0Z', '#78cc48', OHNE) + setze(290, 186, 1.0, eule({ muede: true })), 'Der Mond mit Sonnenbrille und eine leuchtende Limo'),
    }),
  ],
};

// ---------- Füller: wenn wenig passiert ist, erzählen die Inselbewohner ----------
export const FUELLER = {
  mucko: (d) => ({
    titel: 'Neuer Rekord: 4 Kokosnüsse!',
    text: 'Mucko jongliert jetzt mit VIER Kokosnüssen gleichzeitig! Gestern waren es noch drei. Wir sind gespannt, wie viele es nächste Woche sind.',
    bild: foto2('strand', d, setze(160, 188, 1.12, kind(d.m, { haende: [[-26, -90], [26, -90]], mund: 'grinsen' })) +
      setze(110, 76, 1, kokosnuss()) + setze(140, 42, 1, kokosnuss()) + setze(180, 42, 1, kokosnuss()) + setze(210, 76, 1, kokosnuss()) +
      linie('M112 64Q160 0 208 64', '#fff', 2.5, 0.7), 'Mucko jongliert mit vier Kokosnüssen'),
  }),
  mina: (d) => ({
    titel: 'Mina zählt 5.000 Sterne',
    text: 'Mina hat heute Nacht 5.000 Sterne gezählt! Dann ist sie eingeschlafen. Morgen will sie weiterzählen – ab 5.001.',
    bild: foto2('nacht', d, mond(270, 44, 20) + setze(130, 186, 1.12, kind(d.m, { haende: [[-22, -34], [24, -100]], mund: 'o' })) + schrift(220, 120, '5.000!', 28, '#fff7c8', 6), 'Mina zählt die Sterne'),
  }),
  vincent: (d) => ({
    titel: 'Sandburg so hoch wie eine Palme!',
    text: 'Vincent hat die höchste Sandburg aller Zeiten gebaut. Sie ist fast so hoch wie eine Palme! Krebs Kalle wohnt jetzt im obersten Turm.',
    bild: foto2('strand', d, setze(280, 186, 1.25, palme(6)) + setze(180, 184, 1.35, sandburg(1.25)) + setze(84, 188, 1.05, kind(d.m, { haende: [[-24, -94], [26, -94]], mund: 'grinsen' })) + setze(180, 50, 0.5, krebs()), 'Vincent neben einer riesigen Sandburg'),
  }),
  emil: (d) => ({
    titel: 'Krebs Kalle hat Geburtstag!',
    text: 'Emil hat für Krebs Kalle eine Party gemacht. Es gab Algen-Kuchen. Kalle hat sich so gefreut, dass er seitwärts getanzt hat.',
    bild: foto2('strand', d, setze(100, 188, 1.1, kind(d.m, { haende: [[-24, -94], [26, -94]], mund: 'grinsen' })) + setze(210, 168, 1.8, krebs({ partyhut: true })) + schrift(220, 64, 'Alles Gute!', 22, '#ff8fae', 6), 'Emil feiert mit einem Krebs'),
  }),
  etienne: (d) => ({
    titel: 'Drachen hebt Schaf hoch!',
    text: 'Bei Etiennes Drachen war der Wind so stark, dass Schaf Wolke kurz mitgeflogen ist. Es fand das super und will morgen wieder.',
    bild: foto2('wiese', d, setze(80, 188, 1.05, kind(d.m, { haende: [[-20, -40], [26, -90]], mund: 'grinsen' })) + linie('M106 96Q170 70 228 50', '#fff', 2) +
      setze(236, 44, 1.1, drachen()) + setze(236, 142, 0.85, schaf({ augen: 'gross', mund: 'o' })) + linie('M236 110v-20', RAND_LINIE, 2), 'Ein Drachen zieht ein Schaf in die Luft'),
  }),
  joshi: (d) => ({
    titel: 'Pfannkuchen-Turm mit 12 Stück!',
    text: 'Joshi hat 12 Kokos-Pfannkuchen übereinander gestapelt. Der Turm hat nur 3 Sekunden gehalten – dann haben ihn alle zusammen aufgegessen.',
    bild: foto2('strand', d, setze(150, 188, 1.1, kind(d.m, { haende: [[-24, -40], [24, -40]], mund: 'grinsen' })) + setze(150, 142, 1, pfannkuchen(12)) + schrift(240, 70, 'LECKER!', 22, '#ffd23f', 8), 'Joshi trägt einen hohen Pfannkuchen-Turm'),
  }),
  max: (d) => ({
    titel: 'Max auf der krummsten Palme',
    text: 'Max ist auf die krummste Palme der Insel geklettert. Von oben winkt er allen zu und ruft: „Ich kann die Klippeninsel sehen!“',
    bild: foto2('strand', d, setze(120, 188, 1.5, palme(34)) + setze(176, 76, 0.75, kind(d.m, { haende: [[-20, -40], [26, -96]], mund: 'grinsen' })) + schrift(256, 52, 'HALLO!', 22, '#ffd23f', 8), 'Max winkt von einer krummen Palme'),
  }),
  elea: (d) => ({
    titel: 'Blumenkranz für ein Pferd',
    text: 'Elea hat einen Blumenkranz geflochten – diesmal für ein Wildpferd! Das Pferd hat stillgehalten und sieht jetzt wunderschön aus.',
    bild: foto2('wiese', d, setze(80, 188, 1.05, kind(d.m, { haende: [[-24, -40], [26, -60]], mund: 'grinsen' })) + setze(200, 182, 1.25, pferd({ kranz: true })) + setze(240, 58, 1.1, herz(8, '#ff8fae')), 'Ein Pferd mit Blumenkranz'),
  }),
  finn: (d) => ({
    titel: 'Finn surft die Riesenwelle',
    text: 'Finn ist auf der höchsten Welle der Woche gesurft. Möwe Gisela ist mitgeflogen und hat Noten verteilt: 10 von 10!',
    bild: foto2('meer', d, pfad('M40 160Q120 40 240 120Q200 110 180 150Z', '#5fd0f5') + setze(160, 128, 1, surfbrett(), false, -12) +
      setze(158, 124, 0.9, kind(d.m, { haende: [[-30, -60], [30, -66]], mund: 'grinsen' })) + setze(262, 52, 1.1, moewe({ fliegt: true }), true) + schrift(272, 96, '10!', 20, '#ffd23f') + wellen(158), 'Finn surft auf einer großen Welle'),
  }),
  sichel: (d) => ({
    titel: 'Die Möwe hält still!',
    text: 'Sichel malt ein Bild von Möwe Gisela. Und das Wunder ist passiert: Die Möwe hat zum ersten Mal stillgehalten! Fast 5 Sekunden lang.',
    bild: foto2('wiese', d, setze(80, 188, 1.05, kind(d.m, { haende: [[-20, -40], [28, -58]], mund: 'grinsen' })) +
      setze(160, 180, 1.4, staffelei(setze(0, -40, 0.4, moewe()))) + setze(250, 160, 1.4, moewe()) + schrift(250, 106, '!', 24, '#ffd23f'), 'Sichel malt eine Möwe'),
  }),
  ferdinand: (d) => ({
    titel: 'Die Muschel, die singt',
    text: 'Ferdinand hat eine Muschel gefunden, in der man das Meer rauschen hört. Er sagt, manchmal summt sie sogar ein Lied.',
    bild: foto2('strand', d, setze(150, 188, 1.12, kind(d.m, { haende: [[-24, -32], [20, -66]], mund: 'o', augen: 'gross' })) + setze(170, 116, 1, muschel(), false, -60) + noten(206, 92), 'Ferdinand hält eine Muschel ans Ohr'),
  }),
  anton: (d) => ({
    titel: 'Anton hüpft 1.000 Mal!',
    text: 'Anton ist 1.000 Mal hintereinander gehüpft! Schaf Wolke hat mitgezählt und ist dabei eingeschlafen. Hüpf, hüpf!',
    bild: foto2('wiese', d, setze(130, 150, 1.05, kind(d.m, { haende: [[-28, -88], [28, -88]], mund: 'grinsen' })) + linie('M104 168q26 10 52 0', '#fff', 3, 0.8) +
      setze(240, 176, 1.1, schaf({ augen: 'zu' })) + zzz(262, 120) + schrift(130, 40, '1.000!', 26, '#ffd23f'), 'Anton hüpft ganz hoch'),
  }),
  johann: (d) => ({
    titel: 'Lila Fisch gesichtet!',
    text: 'Johann hat beim Schnorcheln einen lila Fisch gesehen. Er war so schön, dass Johann ihm sofort einen Namen gegeben hat: Lila-Lisa.',
    bild: foto2('meer', d, setze(110, 188, 1.12, kind(d.m, { haende: [[-24, -40], [30, -66]], mund: 'o', augen: 'gross' })) + wellen(138) +
      setze(220, 120, 1.6, fisch('#c77dff', { streifen: '#ffd23f' }), true) + B.funkeln(250, 86, 6), 'Johann sieht einen lila Fisch'),
  }),
};
const RAND_LINIE = '#3b2416';

// ---------- Witze & Rätsel ----------
export const WITZE = [
  ['Was macht ein Schaf am Strand?', 'Es lässt sich die Wolle trocknen!'],
  ['Welcher Fisch ist der schlauste?', 'Der Tofu-Fisch – der denkt immer an Tofu.'],
  ['Warum gehen Möwen nie ins Kino?', 'Weil sie lieber Brot-Filme klauen!'],
  ['Wie nennt man einen Hasen mit Helm?', 'Einen Bau-Hasen!'],
  ['Was ist gelb und kann nicht schwimmen?', 'Ein Bagger – zum Glück gibt es auf der Insel Boote!'],
  ['Was sagt die Kokosnuss zur Palme?', '„Ich häng nur so rum.“'],
  ['Rätsel: Je mehr man wegnimmt, desto größer wird es. Was ist das?', 'Ein Loch! (Frag mal beim Graben.)'],
  ['Rätsel: Es hat Zähne, aber beißt nicht. Was ist das?', 'Ein Kamm – oder eine Säge.'],
  ['Warum ist das Pferd so gut im Rechnen?', 'Weil es immer mit den Hufen zählt!'],
  ['Was macht eine Eule am Tag?', 'Nacht-Pause!'],
];
export const WETTER = [
  ['☀️', 'Sonnig mit kleinen Kokosnuss-Schauern'],
  ['⛅', 'Wolkig. Die Wolken sehen aus wie Schafe – oder umgekehrt'],
  ['🌬️', 'Windig auf der Klippe – Drachen-Wetter!'],
  ['🌈', 'Nach dem Regen: Regenbogen über dem Palmendorf'],
  ['☀️', 'Heiß! Möwen tragen heute Sonnenhut'],
  ['🌤️', 'Freundlich – ideal zum Angeln'],
];
