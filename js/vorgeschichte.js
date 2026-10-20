// =============================================================
//  DIE VORGESCHICHTE – erfunden vom Game Designer an Tag 2
//  Wird beim allerersten Spielstart als Tagebuch gezeigt.
// =============================================================
import { knopf } from './steuerung.js';

// Den Namen des geheimen Materials erfindet der Game Designer noch!
export const MATERIAL = 'das geheime Material';

const SEITEN = [
  {
    bild: '📔',
    text: `<b>Forscher-Tagebuch, Tag 8</b><br><br>
      Seit einer Woche bin ich jetzt auf dieser Inselgruppe. Ich bin Forscher –
      und ich suche nach etwas ganz Besonderem: <b>${MATERIAL}</b>.`,
  },
  {
    bild: '🕵️',
    text: `Von geheimen, anonymen Quellen habe ich erfahren: Auf <b>einer</b> dieser Inseln
      soll es zu finden sein. Nur auf welcher? Das weiß niemand.`,
  },
  {
    bild: '⛺',
    text: `Ich hatte nur meinen Rucksack und mein Zelt dabei. Inzwischen habe ich mir eine
      <b>Werkbank</b> gebaut, die Leute im <b>Dorf</b> kennengelernt und handle mit dem Händler.
      Ich grabe, angle, esse Brot und schlage mich von Tag zu Tag durch.`,
  },
  {
    bild: '🏝️',
    text: `Aber mein eigentliches Ziel habe ich nicht vergessen. Die anderen Inseln haben
      hohe Klippen. Um hinaufzukommen, brauche ich irgendwann eine <b>Seilkanone</b> …<br><br>
      <i>Iss jeden Tag etwas, schlaf genug – und gib nicht auf!</i>`,
  },
];

export function zeigeVorgeschichte(eltern, fertig) {
  const fenster = document.createElement('div');
  fenster.id = 'vorgeschichte';
  fenster.innerHTML = `<div class="tagebuch"><div class="tb-bild"></div><p class="tb-text"></p>
    <div class="knopf-reihe"><button class="fenster-knopf blau tb-weiter">Weiter ▶</button></div>
    <div class="tb-punkte"></div></div>`;
  eltern.appendChild(fenster);
  fenster.addEventListener('touchstart', (e) => e.stopPropagation());
  let seite = 0;
  const zeigen = () => {
    const s = SEITEN[seite];
    fenster.querySelector('.tb-bild').textContent = s.bild;
    fenster.querySelector('.tb-text').innerHTML = s.text;
    fenster.querySelector('.tb-weiter').textContent = seite === SEITEN.length - 1 ? "Los geht's! 🎒" : 'Weiter ▶';
    fenster.querySelector('.tb-punkte').innerHTML = SEITEN.map((_, i) => `<span class="${i === seite ? 'an' : ''}"></span>`).join('');
  };
  knopf(fenster.querySelector('.tb-weiter'), () => {
    seite++;
    if (seite >= SEITEN.length) {
      fenster.remove();
      fertig();
    } else zeigen();
  });
  zeigen();
}
