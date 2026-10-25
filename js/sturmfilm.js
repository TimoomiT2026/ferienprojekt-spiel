// =============================================================
//  DER STURM-FILM 🌊⛈️ – „2 Wochen später …“
//  Ein kleiner Film im Prolog: Du sitzt in einem winzigen Ruderboot
//  mitten auf dem Ozean. Es stürmt, regnet und blitzt.
//  Der Film hat seine eigene kleine Welt (Szene) und eigene Kamera.
//  Die Zahlen (Dauer, Wellen, Regen) stehen in einstellungen.js unter "sturmfilm".
// =============================================================
import * as THREE from 'three';
import { baueBoot, baueHolzTextur } from './boote.js';
import { baueJunge } from './junge.js';
import { EINSTELLUNGEN } from './einstellungen.js';

const F = () => EINSTELLUNGEN.sturmfilm;

// Die Wellen: drei Sinus-Wellen übereinander (dieselbe Formel im Bild und für das Boot)
function welle(x, z, t) {
  const w = F().wellen;
  return w * (1.4 * Math.sin(0.12 * x + 1.1 * t) + 1.0 * Math.sin(0.17 * z - 0.9 * t + 1) + 0.5 * Math.sin(0.31 * (x + z) + 1.7 * t));
}

export class Sturmfilm {
  constructor(eltern, musik, fertig) {
    this.musik = musik;
    this.fertig = fertig;
    this.zeit = 0;
    this.naechsterBlitz = 2.5;
    this.blitz = 0;

    // ---------- Die kleine Film-Welt ----------
    const szene = new THREE.Scene();
    szene.background = new THREE.Color('#1c2530');
    szene.fog = new THREE.Fog('#1c2530', 25, 140);
    this.szene = szene;
    this.kamera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 400);

    this.himmelLicht = new THREE.HemisphereLight('#7d8fa3', '#0d1520', 1.1);
    this.blitzLicht = new THREE.DirectionalLight('#dfe8ff', 0);
    this.blitzLicht.position.set(-30, 60, -20);
    szene.add(this.himmelLicht, this.blitzLicht);

    // Das Meer: ein großes Netz, das sich im Grafik-Programm (Shader) bewegt
    const geo = new THREE.PlaneGeometry(320, 320, 160, 160);
    geo.rotateX(-Math.PI / 2);
    this.meer = new THREE.Mesh(geo, new THREE.ShaderMaterial({
      uniforms: { t: { value: 0 }, w: { value: F().wellen }, blitz: { value: 0 }, nebelFarbe: { value: new THREE.Color('#1c2530') } },
      vertexShader: `
        uniform float t, w; varying float vH; varying vec3 vNormal; varying float vWeit; varying vec2 vOrt;
        float h(vec2 p) { return w * (1.4 * sin(0.12 * p.x + 1.1 * t) + 1.0 * sin(0.17 * p.y - 0.9 * t + 1.0) + 0.5 * sin(0.31 * (p.x + p.y) + 1.7 * t)); }
        void main() {
          vec3 p = position;
          p.y = h(p.xz);
          float e = 0.6;
          vNormal = normalize(vec3(h(p.xz - vec2(e, 0.0)) - h(p.xz + vec2(e, 0.0)), 2.0 * e, h(p.xz - vec2(0.0, e)) - h(p.xz + vec2(0.0, e))));
          vH = p.y / max(w, 0.01);
          vOrt = p.xz;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          vWeit = -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform float blitz; uniform vec3 nebelFarbe; varying float vH; varying vec3 vNormal; varying float vWeit; varying vec2 vOrt;
        void main() {
          float licht = 0.35 + 0.65 * max(dot(vNormal, normalize(vec3(-0.4, 1.0, -0.3))), 0.0);
          vec3 farbe = mix(vec3(0.03, 0.09, 0.12), vec3(0.12, 0.25, 0.28), licht);
          // Schaum nur auf den allerhöchsten Spitzen – und gesprenkelt statt als weiße Fläche
          float sprenkel = 0.5 + 0.5 * sin(vOrt.x * 1.7 + vOrt.y * 0.6) * sin(vOrt.y * 2.1 - vOrt.x * 0.4);
          float schaum = smoothstep(2.3, 2.9, vH) * sprenkel;
          farbe = mix(farbe, vec3(0.8, 0.86, 0.9), schaum * 0.55);
          farbe += blitz * vec3(0.5, 0.55, 0.65) * licht;
          float nebel = smoothstep(25.0, 140.0, vWeit);
          gl_FragColor = vec4(mix(farbe, nebelFarbe, nebel), 1.0);
        }`,
    }));
    szene.add(this.meer);

    // Das Ruderboot – und du sitzt drin
    this.boot = new THREE.Group();
    const { boot } = baueBoot(baueHolzTextur());
    this.boot.add(boot);
    const junge = baueJunge();
    junge.figur.scale.setScalar(0.9);
    junge.figur.position.set(0, -0.15, 0);
    this.boot.add(junge.figur);
    szene.add(this.boot);

    // Der Regen: viele kurze, schräge Striche
    const n = F().regenTropfen;
    this.regenPos = new Float32Array(n * 6);
    for (let i = 0; i < n; i++) this.neuerTropfen(i, true);
    const regenGeo = new THREE.BufferGeometry();
    regenGeo.setAttribute('position', new THREE.BufferAttribute(this.regenPos, 3));
    this.regen = new THREE.LineSegments(regenGeo, new THREE.LineBasicMaterial({ color: '#9fb4c8', transparent: true, opacity: 0.55 }));
    this.regen.frustumCulled = false;
    szene.add(this.regen);

    // Schrift und Blitz-Licht über dem Bild (HTML)
    this.overlay = document.createElement('div');
    this.overlay.id = 'sturmfilm';
    this.overlay.innerHTML = `<div class="film-blitz"></div><div class="film-schwarz"><div class="film-titel"></div></div><div class="film-untertitel"></div>`;
    eltern.appendChild(this.overlay);
    this.titel = this.overlay.querySelector('.film-titel');
    this.schwarz = this.overlay.querySelector('.film-schwarz');
    this.untertitel = this.overlay.querySelector('.film-untertitel');
    this.blitzFeld = this.overlay.querySelector('.film-blitz');
    this.titel.textContent = '2 Wochen später …';
  }

  // Ein Regentropfen irgendwo rund um die Kamera
  neuerTropfen(i, ueberall = false) {
    const k = this.kamera?.position || { x: 0, y: 6, z: 14 };
    const x = k.x + (Math.random() - 0.5) * 40, z = k.z + (Math.random() - 0.5) * 40;
    const y = k.y + (ueberall ? (Math.random() - 0.5) * 30 : 15 + Math.random() * 5);
    const p = this.regenPos;
    p.set([x, y, z, x + 0.25, y - 0.9, z + 0.1], i * 6);
  }

  aktualisiere(dt) {
    this.zeit += dt;
    const t = this.zeit;
    const dauer = F().dauer;

    // Das Boot schaukelt mit den Wellen
    const x = 0, z = 0, e = 1.2;
    const h = welle(x, z, t);
    this.boot.position.set(x, h + 0.15, z);
    this.boot.rotation.x = Math.atan2(welle(x, z - e, t) - welle(x, z + e, t), 2 * e) * 0.9;
    this.boot.rotation.z = Math.atan2(welle(x + e, z, t) - welle(x - e, z, t), 2 * e) * 0.9;
    this.boot.rotation.y = 0.4 + Math.sin(t * 0.3) * 0.3;

    // Die Kamera kreist langsam ums Boot und schwankt mit
    const w = 0.6 + t * 0.12;
    this.kamera.position.set(Math.sin(w) * 13, 4.5 + h * 0.5 + Math.sin(t * 1.3) * 0.4, Math.cos(w) * 13);
    this.kamera.lookAt(this.boot.position.x, this.boot.position.y + 0.8, this.boot.position.z);
    this.kamera.aspect = window.innerWidth / window.innerHeight;
    this.kamera.updateProjectionMatrix();

    this.meer.material.uniforms.t.value = t;

    // Regen fällt schräg im Wind
    const p = this.regenPos, n = p.length / 6;
    for (let i = 0; i < n; i++) {
      const o = i * 6;
      p[o + 1] -= 22 * dt; p[o + 4] -= 22 * dt;
      p[o] += 4 * dt; p[o + 3] += 4 * dt;
      if (p[o + 1] < welle(p[o], p[o + 2], t) - 1) this.neuerTropfen(i);
    }
    this.regen.geometry.attributes.position.needsUpdate = true;

    // Blitz und Donner
    this.naechsterBlitz -= dt;
    if (this.naechsterBlitz <= 0 && t > 3 && t < dauer - 3) {
      this.naechsterBlitz = 2.5 + Math.random() * 2.5;
      this.blitz = 1;
      this.donner();
    }
    this.blitz = Math.max(0, this.blitz - dt * 4);
    const flacker = this.blitz > 0 ? this.blitz * (0.6 + 0.4 * Math.sin(t * 90)) : 0;
    this.blitzLicht.intensity = flacker * 5;
    this.meer.material.uniforms.blitz.value = flacker;
    this.blitzFeld.style.opacity = String(flacker * 0.55);

    // Schrift: „2 Wochen später“ → Untertitel → schwarz → „8 Wochen später“
    const schwarz = t < 2.2 ? 1 : t < 3.2 ? 1 - (t - 2.2) : t > dauer - 1.2 ? Math.min(1, (t - (dauer - 1.2)) / 1) : 0;
    this.schwarz.style.opacity = String(schwarz);
    if (t > dauer - 0.3) this.titel.textContent = '8 Wochen später …';
    const sag = (von, bis, text) => (t >= von && t < bis ? text : null);
    const text = sag(3.5, 8.5, 'Mitten auf dem Ozean. Der Sturm will einfach nicht aufhören …') ||
      sag(9, dauer - 1.5, 'Halt durch! Irgendwo da draußen liegt die Inselgruppe mit dem Insadorium …') || '';
    if (this.untertitel.textContent !== text) this.untertitel.textContent = text;
    if (t > dauer + 2.2 && !this.vorbei) {
      this.vorbei = true;
      this.fertig?.();
    }
  }

  // Donner: ein tiefes Rauschen, das ein bisschen nach dem Blitz kommt
  donner() {
    const m = this.musik;
    if (!m?.ctx) return;
    const z = m.ctx.currentTime + 0.25 + Math.random() * 0.5;
    m.rauschStoss(z, 2.2, 0.5, 'lowpass', 220, 60, 0.7, 0.05);
    m.rauschStoss(z + 0.1, 1.2, 0.25, 'lowpass', 600, 120, 0.7, 0.02);
  }

  entfernen() {
    this.overlay.remove();
  }
}
