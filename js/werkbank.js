// =============================================================
//  DIE WERKBANK (Crafting Table aus der Mindmap!)
//  Hier baut man aus Fundstücken neue Dinge, zum Beispiel ein Schwert.
//  Was man dafür braucht, steht in einstellungen.js unter "rezepte".
// =============================================================
import * as THREE from 'three';
import { EINSTELLUNGEN } from './einstellungen.js';
import { bodenHoehe } from './gelaende.js';
import { DINGE } from './rucksack.js';
import { BILDER } from './bilder.js';
import { knopf } from './steuerung.js';
import { textur } from './texturen.js';

function baueTisch() {
  const tisch = new THREE.Group();
  const holz = new THREE.MeshStandardMaterial({ map: textur('rinde.jpg'), color: '#c9a27a', roughness: 0.9 });
  const platte = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.18, 28), holz);
  platte.scale.z = 0.6;
  platte.position.y = 0.95;
  tisch.add(platte);
  for (const [x, z] of [[-0.75, -0.35], [0.75, -0.35], [-0.75, 0.35], [0.75, 0.35]]) {
    const bein = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.9, 10), holz);
    bein.position.set(x, 0.45, z);
    tisch.add(bein);
  }
  // Ein kleiner Amboss und ein Hammer auf dem Tisch
  const eisen = new THREE.MeshStandardMaterial({ color: '#4a4f57', metalness: 0.8, roughness: 0.35 });
  const amboss = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.35, 6, 12), eisen);
  amboss.rotation.z = Math.PI / 2;
  amboss.position.set(-0.3, 1.18, 0);
  const stiel = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 8), new THREE.MeshStandardMaterial({ color: '#8a5a34' }));
  stiel.rotation.z = Math.PI / 2;
  stiel.position.set(0.45, 1.1, 0.15);
  const kopf = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.12, 4, 8), eisen);
  kopf.position.set(0.68, 1.1, 0.15);
  tisch.add(amboss, stiel, kopf);
  tisch.traverse((t) => {
    if (t.isMesh) t.castShadow = t.receiveShadow = true;
  });
  return tisch;
}

export class Werkbank {
  constructor(szene, hindernisse, spiel) {
    this.spiel = spiel; // { rucksack, meldung, musik }
    const x = -6, z = -3;
    this.tisch = baueTisch();
    this.tisch.position.set(x, bodenHoehe(x, z), z);
    this.tisch.rotation.y = 0.6;
    szene.add(this.tisch);
    hindernisse.hinzufuegen(x, z, 1.1);
    this.ort = { x, z };

    this.interaktion = {
      pos: new THREE.Vector3(x, 0, z),
      radius: 3.2,
      bild: '🔨',
      text: 'Werkbank',
      ausfuehren: () => this.oeffnen(),
    };

    // Das Fenster
    this.fenster = document.createElement('div');
    this.fenster.id = 'werkbank-fenster';
    this.fenster.className = 'spiel-fenster';
    this.fenster.innerHTML = `
      <div class="fenster-kopf"><h2>${BILDER.hammer} Werkbank</h2><button class="zu" aria-label="Schließen">✕</button></div>
      <div class="rezepte"></div>
      <p class="werkbank-info">Was willst du bauen?</p>`;
    spiel.elternElement.appendChild(this.fenster);
    this.fenster.addEventListener('touchstart', (e) => e.stopPropagation());
    knopf(this.fenster.querySelector('.zu'), () => this.schliessen());
    this.offen = false;
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

  zeichnen() {
    const { rucksack } = this.spiel;
    const liste = this.fenster.querySelector('.rezepte');
    liste.innerHTML = '';
    for (const [id, zutaten] of Object.entries(EINSTELLUNGEN.rezepte)) {
      const ding = DINGE[id];
      // Manches darf man erst später bauen (z. B. das Fernrohr) – dann steht da, warum
      const sperre = this.spiel.sperre?.(id);
      const kannBauen = !sperre && Object.entries(zutaten).every(([z, n]) => rucksack.anzahl(z) >= n);
      const zeile = document.createElement('div');
      zeile.className = 'rezept';
      const zutatenHtml = Object.entries(zutaten)
        .map(([z, n]) => {
          const hat = rucksack.anzahl(z);
          const preis = z === 'widerhaken' && hat < n ? ' <b>🏁 nur als Rallye-Preis!</b>' : ''; // den kann man nicht bauen
          return `<span class="zutat ${hat >= n ? 'ok' : 'fehlt'}">${DINGE[z].bild} ${Math.min(hat, n)}/${n} ${DINGE[z].name}${preis}</span>`;
        })
        .join('');
      zeile.innerHTML = `
        <div class="rezept-bild">${ding.bild}</div>
        <div class="rezept-mitte"><b>${ding.name}</b><div class="zutaten">${zutatenHtml}</div>${sperre ? `<div class="rezept-sperre">🔒 ${sperre}</div>` : ''}</div>
        <button class="bauen" ${kannBauen ? '' : 'disabled'}>${sperre ? '🔒' : 'Bauen'}</button>`;
      knopf(zeile.querySelector('.bauen'), () => this.bauen(id));
      liste.appendChild(zeile);
    }
  }

  bauen(id) {
    const { rucksack, meldung, musik } = this.spiel;
    const zutaten = EINSTELLUNGEN.rezepte[id];
    const info = this.fenster.querySelector('.werkbank-info');
    const sperre = this.spiel.sperre?.(id);
    if (sperre) {
      info.textContent = `🔒 ${sperre}`;
      return;
    }
    if (!Object.entries(zutaten).every(([z, n]) => rucksack.anzahl(z) >= n)) {
      info.textContent = 'Dir fehlen noch Sachen. Grab weiter! ⛏️';
      return;
    }
    for (const [z, n] of Object.entries(zutaten)) rucksack.nehmen(z, n);
    if (!rucksack.hinein(id)) {
      // Kein Platz: Zutaten zurückgeben
      for (const [z, n] of Object.entries(zutaten)) rucksack.hinein(z, n);
      info.textContent = 'Dein Rucksack ist voll!';
      return;
    }
    musik.pling();
    info.innerHTML = `${DINGE[id].bild} ${DINGE[id].name} gebaut! Nimm es im Rucksack in die Hand.`;
    meldung(`🔨 Du hast ${DINGE[id].artikel || 'ein'} ${DINGE[id].name} gebaut!`, 4);
    this.zeichnen();
  }
}
