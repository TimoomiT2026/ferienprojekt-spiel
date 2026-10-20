// =============================================================
//  NACHBEARBEITUNG – das fertige Bild wird noch "veredelt"
//  Wie beim Foto-Filter auf dem Handy: Erst malt der Computer die
//  Welt in ein unsichtbares Bild. Dann kommen Effekte darüber:
//   • Leuchten ("Bloom"): Sonne, Laternen und Feuer strahlen weich
//   • Farb-Filter: ein bisschen warm, wie ein Kinofilm
//   • Vignette: die Ecken werden leicht dunkler – das lenkt den Blick
//   • Film-Körnchen: winzig, damit der Himmel keine Streifen hat
//
//  stufe = 2: alles an
//  stufe = 1: nur der günstige Farb-Filter (ohne Leuchten)
//  stufe = 0: aus – die Welt wird direkt gemalt (am schnellsten)
// =============================================================
import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

// ---------- Zahlen zum Drehen ----------
const LEUCHT_SCHWELLE = 2.0;    // ab welcher Helligkeit etwas leuchtet
const LEUCHT_STAERKE = 0.16;    // wie stark das Leuchten ist
const WAERME = [1.025, 1.0, 0.97];  // Rot etwas mehr, Blau etwas weniger
const SAETTIGUNG = 1.04;        // Farben etwas kräftiger (1 = normal)
const KONTRAST = 1.07;          // 1 = normal
const VIGNETTE = 0.28;          // 0 = keine dunklen Ecken
const KOERNCHEN = 1.6 / 255;    // Film-Körnchen (ganz fein!)
const LEUCHT_STUFEN = 4;        // wie viele immer kleinere Bilder fürs Leuchten

// Ein ganz einfaches Programm für den Bildschirm-Streifen
const VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }`;

// 1) Nur die hellen Stellen herausfiltern und dabei verkleinern.
//    13 Proben (wie in großen Spielen), damit einzelne Glitzer-Pixel
//    nicht flackern. Jede Gruppe wird nach Helligkeit gewichtet ("Karis").
const HELL_FILTER = /* glsl */ `
  uniform sampler2D tBild;
  uniform vec2 texel;      // Größe eines Pixels im großen Bild
  uniform float schwelle;
  varying vec2 vUv;
  float hell(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
  vec3 probe(vec2 o) { return min(texture2D(tBild, vUv + o * texel).rgb, vec3(10.0)); }
  vec3 gruppe(vec3 a, vec3 b, vec3 c, vec3 d) {
    vec3 m = (a + b + c + d) * 0.25;
    return m / (1.0 + hell(m));
  }
  void main() {
    vec3 a = probe(vec2(-4.0, -4.0)), b = probe(vec2(0.0, -4.0)), c = probe(vec2(4.0, -4.0));
    vec3 d = probe(vec2(-2.0, -2.0)), e = probe(vec2(2.0, -2.0));
    vec3 f = probe(vec2(-4.0, 0.0)), g = probe(vec2(0.0, 0.0)), h = probe(vec2(4.0, 0.0));
    vec3 i = probe(vec2(-2.0, 2.0)), j = probe(vec2(2.0, 2.0));
    vec3 k = probe(vec2(-4.0, 4.0)), l = probe(vec2(0.0, 4.0)), m = probe(vec2(4.0, 4.0));
    vec3 s = gruppe(d, e, i, j) * 0.5
           + (gruppe(a, b, f, g) + gruppe(b, c, g, h) + gruppe(f, g, k, l) + gruppe(g, h, l, m)) * 0.125;
    s /= max(1.0 - hell(s), 0.05); // Gewichtung wieder rückgängig
    // Weiche Schwelle: was knapp darüber ist, leuchtet nur ein bisschen
    float l0 = hell(s);
    float knie = schwelle * 0.5;
    float weich = clamp(l0 - schwelle + knie, 0.0, 2.0 * knie);
    weich = weich * weich / (4.0 * knie + 1e-4);
    float anteil = max(weich, l0 - schwelle) / max(l0, 1e-4);
    gl_FragColor = vec4(s * anteil, 1.0);
  }`;

// 2) Verkleinern: aus 5 Proben einen Mittelwert machen (macht es weich)
const RUNTER = /* glsl */ `
  uniform sampler2D tBild;
  uniform vec2 texel;
  varying vec2 vUv;
  void main() {
    vec3 s = texture2D(tBild, vUv).rgb * 4.0;
    s += texture2D(tBild, vUv + vec2(-1.0, -1.0) * texel).rgb;
    s += texture2D(tBild, vUv + vec2( 1.0, -1.0) * texel).rgb;
    s += texture2D(tBild, vUv + vec2(-1.0,  1.0) * texel).rgb;
    s += texture2D(tBild, vUv + vec2( 1.0,  1.0) * texel).rgb;
    gl_FragColor = vec4(s / 8.0, 1.0);
  }`;

// 3) Wieder vergrößern und auf die nächstgrößere Stufe legen
const HOCH = /* glsl */ `
  uniform sampler2D tBild;   // kleines Bild
  uniform sampler2D tDrunter; // die Stufe, auf die es gelegt wird
  uniform vec2 texel;
  varying vec2 vUv;
  void main() {
    vec3 s = texture2D(tBild, vUv + vec2(-1.0, 0.0) * texel).rgb * 2.0;
    s += texture2D(tBild, vUv + vec2(1.0, 0.0) * texel).rgb * 2.0;
    s += texture2D(tBild, vUv + vec2(0.0, -1.0) * texel).rgb * 2.0;
    s += texture2D(tBild, vUv + vec2(0.0, 1.0) * texel).rgb * 2.0;
    s += texture2D(tBild, vUv + vec2(-1.0, -1.0) * texel).rgb;
    s += texture2D(tBild, vUv + vec2(1.0, -1.0) * texel).rgb;
    s += texture2D(tBild, vUv + vec2(-1.0, 1.0) * texel).rgb;
    s += texture2D(tBild, vUv + vec2(1.0, 1.0) * texel).rgb;
    gl_FragColor = vec4(s / 12.0 + texture2D(tDrunter, vUv).rgb, 1.0);
  }`;

// 4) Alles zusammen: Welt + Leuchten → Kino-Farben → Filter → Bildschirm
const ZUSAMMEN = /* glsl */ `
  uniform sampler2D tSzene;
  uniform sampler2D tLeuchten;
  uniform vec2 leuchtTexel;
  uniform float leuchtStaerke;
  uniform vec3 waerme;
  uniform float saettigung, kontrast, vignette, koernchen, zeit, seitenVerhaeltnis;
  varying vec2 vUv;
  void main() {
    vec3 farbe = texture2D(tSzene, vUv).rgb;
    #ifdef MIT_LEUCHTEN
      vec3 l = texture2D(tLeuchten, vUv + vec2(-0.5, -0.5) * leuchtTexel).rgb;
      l += texture2D(tLeuchten, vUv + vec2(0.5, -0.5) * leuchtTexel).rgb;
      l += texture2D(tLeuchten, vUv + vec2(-0.5, 0.5) * leuchtTexel).rgb;
      l += texture2D(tLeuchten, vUv + vec2(0.5, 0.5) * leuchtTexel).rgb;
      farbe += l * (0.25 * leuchtStaerke);
    #endif
    // Kino-Farben (ACES) und Bildschirm-Farbraum macht three.js für uns
    gl_FragColor = vec4(farbe, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    vec3 c = gl_FragColor.rgb;
    // Warmer Film-Look: dunkle und mittlere Töne etwas wärmer,
    // helle (z. B. der Himmel) bleiben frisch blau
    float grau = dot(c, vec3(0.2126, 0.7152, 0.0722));
    c *= mix(waerme, vec3(1.0), smoothstep(0.45, 0.9, grau));
    // "Vibrance": blasse Farben bekommen mehr Kraft als schon kräftige
    float bunt = max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b));
    c = mix(vec3(grau), c, saettigung + 0.25 * (1.0 - bunt));
    c = (c - 0.5) * kontrast + 0.5;
    // Vignette: zur Ecke hin sanft dunkler (rund, nicht oval)
    vec2 m = (vUv - 0.5) * vec2(seitenVerhaeltnis, 1.0);
    c *= 1.0 - vignette * smoothstep(0.35, 1.05, length(m));
    // Film-Körnchen gegen Farbstreifen im Himmel
    float zufall = fract(sin(dot(gl_FragCoord.xy + zeit * 61.0, vec2(12.9898, 78.233))) * 43758.5453);
    c += (zufall - 0.5) * koernchen;
    gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
  }`;

function bildSpeicher(typ, samples = 0) {
  const rt = new THREE.WebGLRenderTarget(1, 1, {
    type: typ,
    samples,
    depthBuffer: samples > 0,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    generateMipmaps: false,
  });
  rt.texture.name = 'Nachbearbeitung';
  return rt;
}

function streifen(fragment, uniforms, defines = {}) {
  const material = new THREE.ShaderMaterial({
    vertexShader: VERTEX, fragmentShader: fragment, uniforms, defines,
    depthTest: false, depthWrite: false,
  });
  return new FullScreenQuad(material);
}

export class Nachbearbeitung {
  constructor(renderer, szene, kamera) {
    this.renderer = renderer;
    this.szene = szene;
    this.kamera = kamera;
    this.zeit = 0;
    this._stufe = 2;
    this._groesse = new THREE.Vector2();
    this._breite = 0;
    this._hoehe = 0;

    // Kann das Gerät "Kommazahl-Bilder" (mehr Helligkeit als Weiß)? Sonst bleibt alles aus.
    const ext = renderer.extensions;
    this.moeglich = renderer.capabilities.isWebGL2 && (ext.has('EXT_color_buffer_half_float') || ext.has('EXT_color_buffer_float'));
    const typ = THREE.HalfFloatType;

    // Hier hinein wird die Welt gemalt (4-fach geglättete Kanten = "MSAA")
    this.szenenBild = bildSpeicher(typ, Math.min(4, renderer.capabilities.maxSamples || 4));
    // Immer kleinere Bilder fürs Leuchten: runter[0] = 1/4, runter[1] = 1/8 ...
    this.runter = [];
    this.hoch = [];
    for (let i = 0; i < LEUCHT_STUFEN; i++) this.runter.push(bildSpeicher(typ));
    for (let i = 0; i < LEUCHT_STUFEN - 1; i++) this.hoch.push(bildSpeicher(typ));

    this.hellFilter = streifen(HELL_FILTER, {
      tBild: { value: null }, texel: { value: new THREE.Vector2() }, schwelle: { value: LEUCHT_SCHWELLE },
    });
    this.runterFilter = streifen(RUNTER, { tBild: { value: null }, texel: { value: new THREE.Vector2() } });
    this.hochFilter = streifen(HOCH, { tBild: { value: null }, tDrunter: { value: null }, texel: { value: new THREE.Vector2() } });
    const u = {
      tSzene: { value: this.szenenBild.texture },
      tLeuchten: { value: null },
      leuchtTexel: { value: new THREE.Vector2() },
      leuchtStaerke: { value: LEUCHT_STAERKE },
      waerme: { value: new THREE.Vector3(...WAERME) },
      saettigung: { value: SAETTIGUNG },
      kontrast: { value: KONTRAST },
      vignette: { value: VIGNETTE },
      koernchen: { value: KOERNCHEN },
      zeit: { value: 0 },
      seitenVerhaeltnis: { value: 1 },
    };
    this.mitLeuchten = streifen(ZUSAMMEN, u, { MIT_LEUCHTEN: '' });
    this.ohneLeuchten = streifen(ZUSAMMEN, u);
    this.uniforms = u;
  }

  get stufe() {
    return this.moeglich ? this._stufe : 0;
  }

  set stufe(n) {
    this._stufe = THREE.MathUtils.clamp(Math.round(n), 0, 2);
  }

  // Wie stark leuchtet es? (zum Ausprobieren, z. B. nachts mehr)
  set leuchtStaerke(wert) {
    this.uniforms.leuchtStaerke.value = wert;
  }

  setSize(/* breite, hoehe */) {
    // Die echte Pixelzahl kommt vom Renderer (die Qualitätsautomatik
    // ändert die Pixel-Dichte manchmal) – darum schauen wir in render() nach.
    this._breite = 0;
  }

  _passeGroesseAn() {
    const g = this.renderer.getDrawingBufferSize(this._groesse);
    const b = Math.max(1, g.x), h = Math.max(1, g.y);
    if (b === this._breite && h === this._hoehe) return;
    this._breite = b;
    this._hoehe = h;
    this.szenenBild.setSize(b, h);
    let sb = b, sh = h;
    for (let i = 0; i < LEUCHT_STUFEN; i++) {
      sb = Math.max(1, Math.round(sb / (i === 0 ? 4 : 2)));
      sh = Math.max(1, Math.round(sh / (i === 0 ? 4 : 2)));
      this.runter[i].setSize(sb, sh);
      if (i < LEUCHT_STUFEN - 1) this.hoch[i].setSize(sb, sh);
    }
    this.uniforms.seitenVerhaeltnis.value = b / h;
  }

  render(dt = 1 / 60) {
    const renderer = this.renderer;
    if (this.stufe === 0) {
      renderer.render(this.szene, this.kamera);
      return;
    }
    this._passeGroesseAn();
    this.zeit = (this.zeit + dt) % 100;
    this.uniforms.zeit.value = this.zeit;
    const vorher = renderer.getRenderTarget();

    // 1) Welt ins unsichtbare Bild malen
    renderer.setRenderTarget(this.szenenBild);
    renderer.render(this.szene, this.kamera);

    let ende = this.ohneLeuchten;
    if (this.stufe >= 2) {
      // 2) Helle Stellen heraussuchen und verkleinern
      this.hellFilter.material.uniforms.tBild.value = this.szenenBild.texture;
      this.hellFilter.material.uniforms.texel.value.set(1 / this._breite, 1 / this._hoehe);
      renderer.setRenderTarget(this.runter[0]);
      this.hellFilter.render(renderer);
      // 3) Immer kleiner und weicher
      const ru = this.runterFilter.material.uniforms;
      for (let i = 1; i < LEUCHT_STUFEN; i++) {
        const quelle = this.runter[i - 1];
        ru.tBild.value = quelle.texture;
        ru.texel.value.set(1 / quelle.width, 1 / quelle.height);
        renderer.setRenderTarget(this.runter[i]);
        this.runterFilter.render(renderer);
      }
      // 4) Wieder hoch und aufeinanderlegen → großer, weicher Schein
      const hu = this.hochFilter.material.uniforms;
      let klein = this.runter[LEUCHT_STUFEN - 1];
      for (let i = LEUCHT_STUFEN - 2; i >= 0; i--) {
        hu.tBild.value = klein.texture;
        hu.tDrunter.value = this.runter[i].texture;
        hu.texel.value.set(1 / klein.width, 1 / klein.height);
        renderer.setRenderTarget(this.hoch[i]);
        this.hochFilter.render(renderer);
        klein = this.hoch[i];
      }
      this.uniforms.tLeuchten.value = klein.texture;
      this.uniforms.leuchtTexel.value.set(1 / klein.width, 1 / klein.height);
      ende = this.mitLeuchten;
    }

    // 5) Alles zusammen auf den Bildschirm
    renderer.setRenderTarget(vorher);
    ende.render(renderer);
  }

  dispose() {
    this.szenenBild.dispose();
    for (const rt of [...this.runter, ...this.hoch]) rt.dispose();
    for (const q of [this.hellFilter, this.runterFilter, this.hochFilter, this.mitLeuchten, this.ohneLeuchten]) {
      q.material.dispose();
      q.dispose();
    }
  }
}
