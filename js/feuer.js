// =============================================================
//  DAS LAGERFEUER an der Base
//  Anzünden: 1 Holz + Feuerzeug. Dann kann man Tofu-Fische grillen.
//  Das Feuer brennt ein paar Minuten (einstellungen.js: feuerMinuten).
// =============================================================
import * as THREE from 'three';
import { EINSTELLUNGEN } from './einstellungen.js';
import { bodenHoehe } from './gelaende.js';
import { textur } from './texturen.js';

// Ein weicher, heller Punkt für Flammen und Funken
function flammenBild() {
  const n = 64;
  const leinwand = document.createElement('canvas');
  leinwand.width = leinwand.height = n;
  const g = leinwand.getContext('2d');
  const verlauf = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
  verlauf.addColorStop(0, 'rgba(255,255,220,1)');
  verlauf.addColorStop(0.3, 'rgba(255,190,80,0.9)');
  verlauf.addColorStop(1, 'rgba(255,80,0,0)');
  g.fillStyle = verlauf;
  g.fillRect(0, 0, n, n);
  const t = new THREE.CanvasTexture(leinwand);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Lagerfeuer {
  constructor(szene, hindernisse, spiel) {
    this.spiel = spiel; // { rucksack, meldung, musik }
    const x = 0, z = -6;
    this.ort = { x, z };
    this.gruppe = new THREE.Group();
    this.gruppe.position.set(x, bodenHoehe(x, z), z);

    // Steinkreis
    const steinMat = new THREE.MeshStandardMaterial({ map: textur('fels.jpg'), roughness: 0.9 });
    const steinGeo = new THREE.SphereGeometry(0.22, 10, 8);
    for (let i = 0; i < 10; i++) {
      const w = (i / 10) * Math.PI * 2;
      const stein = new THREE.Mesh(steinGeo, steinMat);
      stein.position.set(Math.cos(w) * 0.75, 0.08, Math.sin(w) * 0.75);
      stein.scale.set(1 + (i % 3) * 0.15, 0.7, 1);
      stein.castShadow = stein.receiveShadow = true;
      this.gruppe.add(stein);
    }
    // Holzscheite (sieht man nur, wenn Holz drin ist)
    const holzMat = new THREE.MeshStandardMaterial({ map: textur('rinde.jpg'), roughness: 0.95 });
    this.scheite = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const scheit = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.8, 8), holzMat);
      scheit.rotation.z = 1.1;
      scheit.rotation.y = (i / 4) * Math.PI * 2;
      scheit.position.y = 0.18;
      this.scheite.add(scheit);
    }
    this.gruppe.add(this.scheite);
    // Kleiner Grill-Spieß über dem Feuer
    const spiess = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.8, 6), new THREE.MeshStandardMaterial({ color: '#6b4630' }));
    spiess.rotation.z = Math.PI / 2;
    spiess.position.y = 0.75;
    for (const sx of [-0.8, 0.8]) {
      const stuetze = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.85, 6), spiess.material);
      stuetze.position.set(sx, 0.4, 0);
      this.gruppe.add(stuetze);
    }
    this.gruppe.add(spiess);

    // Flammen: viele kleine leuchtende Punkte, die nach oben fliegen
    this.anzahlFunken = 60;
    const pos = new Float32Array(this.anzahlFunken * 3);
    this.funken = [];
    for (let i = 0; i < this.anzahlFunken; i++) this.funken.push({ leben: Math.random(), x: 0, y: 0, z: 0, vx: 0, vz: 0 });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.flammen = new THREE.Points(geo, new THREE.PointsMaterial({
      map: flammenBild(), size: 0.7, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: '#ffb35c',
    }));
    this.flammen.frustumCulled = false;
    this.gruppe.add(this.flammen);

    this.licht = new THREE.PointLight('#ff9a3c', 0, 18, 1.5);
    this.licht.position.y = 1;
    this.gruppe.add(this.licht);

    szene.add(this.gruppe);
    hindernisse.hinzufuegen(x, z, 0.9);

    this.brennt = 0; // Sekunden, wie lange es noch brennt
    this.grillt = 0;
    this.zeit = 0;
    this.scheite.visible = false;
    this.flammen.visible = false;

    const feuer = this;
    this.interaktion = {
      pos: new THREE.Vector3(x, 0, z),
      radius: 3,
      get bild() {
        if (!feuer.brennt) return '🔥';
        return feuer.spiel.rucksack.hat('tofufisch') ? '🍳' : '🪵';
      },
      get text() {
        if (!feuer.brennt) return 'Anzünden';
        return feuer.spiel.rucksack.hat('tofufisch') ? 'Fisch grillen' : 'Holz nachlegen';
      },
      ausfuehren: () => this.aktion(),
    };
  }

  aktion() {
    const { rucksack, meldung, musik } = this.spiel;
    if (this.grillt > 0) return;
    if (!this.brennt) {
      if (!rucksack.hat('holz')) {
        meldung('Du brauchst Holz 🪵. Fäll einen Baum mit dem Schwert oder kauf Holz im Dorf.', 5);
        return;
      }
      if (!rucksack.hat('feuerzeug')) {
        meldung('Du brauchst ein Feuerzeug 🔥. Bau es an der Werkbank (2 Steine, 1 Eisenerz, 1 Kohle).', 5);
        return;
      }
      rucksack.nehmen('holz', 1);
      const leer = rucksack.verbrauche('feuerzeug');
      this.brennt = EINSTELLUNGEN.feuerMinuten * 60;
      musik.pling();
      meldung(leer ? '🔥 Das Feuer brennt! Dein Feuerzeug ist jetzt leer.' : '🔥 Das Feuer brennt!', 4);
      return;
    }
    if (rucksack.hat('tofufisch')) {
      if (!rucksack.passt('gegrillterFisch')) {
        meldung('Kein Platz im Rucksack für den gegrillten Fisch!');
        return;
      }
      this.grillt = 2.5;
      meldung('🍳 Brutzel, brutzel …', 2.5);
      return;
    }
    if (rucksack.hat('holz')) {
      rucksack.nehmen('holz', 1);
      this.brennt += EINSTELLUNGEN.feuerMinuten * 60;
      meldung('🪵 Holz nachgelegt. Das Feuer brennt länger.', 3);
    } else {
      meldung('Schön warm hier! 🔥 Hast du einen Tofu-Fisch zum Grillen?', 3);
    }
  }

  aktualisiere(dt) {
    this.zeit += dt;
    if (this.grillt > 0) {
      this.grillt -= dt;
      if (this.grillt <= 0) {
        const { rucksack, meldung, musik } = this.spiel;
        rucksack.nehmen('tofufisch', 1);
        rucksack.hinein('gegrillterFisch');
        musik.pling();
        meldung('😋 Gegrillter Tofu-Fisch! Im Rucksack antippen und essen.', 4);
      }
    }
    if (this.brennt > 0) this.brennt = Math.max(0, this.brennt - dt);
    const an = this.brennt > 0;
    this.scheite.visible = an || this.flammen.visible;
    this.flammen.visible = an;
    this.licht.intensity = an ? 25 + Math.sin(this.zeit * 13) * 4 + Math.sin(this.zeit * 7.3) * 3 : 0;
    if (!an) return;
    // Funken fliegen hoch und werden kleiner
    const p = this.flammen.geometry.attributes.position;
    this.funken.forEach((f, i) => {
      f.leben -= dt * 1.4;
      if (f.leben <= 0) {
        f.leben = 1;
        f.x = (Math.random() - 0.5) * 0.4;
        f.z = (Math.random() - 0.5) * 0.4;
        f.y = 0.15;
        f.vx = (Math.random() - 0.5) * 0.3;
        f.vz = (Math.random() - 0.5) * 0.3;
      }
      f.y += dt * (0.8 + (1 - f.leben) * 0.6);
      f.x += f.vx * dt;
      f.z += f.vz * dt;
      p.setXYZ(i, f.x * f.leben, f.y, f.z * f.leben);
    });
    p.needsUpdate = true;
  }
}
