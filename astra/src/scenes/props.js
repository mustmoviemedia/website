// Shared furniture and fittings for both stations. Every prop is built at the origin,
// standing on y = 0 and facing +Z; scenes place and rotate them.
import * as THREE from 'three';
import { place, roundedBox, cylinderBetween, V } from '../core/geometry.js';
import { boxUV } from '../core/materials.js';
import { labelTexture, FONT_MONO, FONT_SANS } from '../core/textures.js';

const G = {
  cyl: (rt, rb, h, seg = 20) => new THREE.CylinderGeometry(rt, rb, h, seg),
};

export function barStool(M) {
  const g = new THREE.Group();
  place(g, G.cyl(0.19, 0.18, 0.05, 24), M.white, { p: [0, 0.765, 0] });
  place(g, G.cyl(0.165, 0.165, 0.012, 24), M.orange, { p: [0, 0.795, 0], cast: false });
  place(g, G.cyl(0.026, 0.026, 0.72, 10), M.alu, { p: [0, 0.38, 0] });
  place(g, G.cyl(0.21, 0.23, 0.02, 24), M.aluDark, { p: [0, 0.01, 0] });
  place(g, new THREE.TorusGeometry(0.16, 0.012, 6, 24), M.alu, { p: [0, 0.3, 0], r: [Math.PI / 2, 0, 0] });
  return g;
}

export function chair(M) {
  const g = new THREE.Group();
  place(g, roundedBox(0.46, 0.045, 0.44, 0.08), M.white, { p: [0, 0.455, 0] });
  place(g, roundedBox(0.44, 0.34, 0.035, 0.1), M.white, { p: [0, 0.69, -0.21], r: [-0.14, 0, 0] });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    g.add(new THREE.Mesh(cylinderBetween(V(sx * 0.19, 0, sz * 0.18), V(sx * 0.17, 0.44, sz * 0.16), 0.012, 0.012, 6), M.alu));
  }
  g.children.forEach((c) => { c.castShadow = true; c.receiveShadow = true; });
  return g;
}

export function roundTable(M, r = 0.36, h = 0.74, top = M.white) {
  const g = new THREE.Group();
  place(g, G.cyl(r, r, 0.03, 32), top, { p: [0, h - 0.015, 0] });
  place(g, G.cyl(r - 0.01, r - 0.04, 0.02, 32), M.aluSatin, { p: [0, h - 0.04, 0] });
  place(g, G.cyl(0.03, 0.035, h - 0.05, 10), M.alu, { p: [0, (h - 0.05) / 2, 0] });
  place(g, G.cyl(0.22, 0.25, 0.025, 28), M.aluDark, { p: [0, 0.0125, 0] });
  // cup + saucer
  place(g, G.cyl(0.04, 0.033, 0.08, 14), M.white, { p: [0.09, h + 0.04, 0.05], cast: false });
  place(g, G.cyl(0.07, 0.07, 0.008, 18), M.white, { p: [0.09, h + 0.004, 0.05], cast: false });
  return g;
}

export function coffeeMachine(M) {
  const g = new THREE.Group();
  place(g, roundedBox(0.78, 0.42, 0.5, 0.05), M.steel, { p: [0, 0.27, 0] });
  place(g, roundedBox(0.8, 0.05, 0.52, 0.04), M.white, { p: [0, 0.505, 0] });
  place(g, new THREE.BoxGeometry(0.7, 0.02, 0.01), M.ledOrange, { p: [0, 0.44, 0.255], cast: false });
  for (const x of [-0.2, 0.2]) {
    place(g, G.cyl(0.05, 0.05, 0.06, 16), M.alu, { p: [x, 0.33, 0.27] });
    place(g, cylinderBetween(V(x, 0.3, 0.27), V(x, 0.3, 0.42), 0.012), M.graphite, {});
  }
  place(g, roundedBox(0.7, 0.02, 0.2, 0.02), M.graphite, { p: [0, 0.07, 0.2] });
  place(g, G.cyl(0.045, 0.035, 0.08, 14), M.white, { p: [-0.2, 0.12, 0.28], cast: false });
  return g;
}

export function grinder(M) {
  const g = new THREE.Group();
  place(g, roundedBox(0.2, 0.36, 0.28, 0.04), M.graphite, { p: [0, 0.18, 0] });
  place(g, G.cyl(0.09, 0.05, 0.22, 16), M.glassVitrine, { p: [0, 0.47, -0.02], cast: false });
  place(g, G.cyl(0.08, 0.05, 0.12, 16), M.mars, { p: [0, 0.43, -0.02], cast: false });
  return g;
}

// Round porthole screen with animated Earth view
const earthFrag = /* glsl */ `
varying vec2 vUv;
uniform float uTime, uSeed, uBright, uCity;
// sin-free hash: stable on mobile GPUs (sin() of large values breaks into streaks there)
float hash(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1,0)), u.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), u.x), u.y); }
float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ s += a*noise(p); p = p*2.03 + 7.1; a *= 0.5; } return s; }
void main(){
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  vec2 c = vec2(0.35 * sin(uSeed * 3.0), -2.25 - 0.25 * fract(uSeed * 7.0));
  float R = 2.55;
  float d = length(p - c);
  vec3 col = vec3(0.002, 0.004, 0.012);
  float st = step(0.9965, hash(floor(vUv * 220.0) + uSeed));
  col += st * 0.8;
  if (d < R) {
    float z = sqrt(max(R*R - d*d, 0.0)) / R;
    vec2 sp = (p - c) / R;
    vec2 suv = sp / (z + 0.3) * 1.6;
    suv.x += mod(uTime * 0.012, 64.0) + uSeed * 13.0;
    float lf = fbm(suv * 1.7 + uSeed);
    float land = smoothstep(0.5, 0.56, lf);
    vec3 ocean = mix(vec3(0.01, 0.05, 0.16), vec3(0.02, 0.12, 0.3), fbm(suv * 4.0));
    vec3 landc = mix(vec3(0.16, 0.2, 0.08), vec3(0.5, 0.37, 0.22), fbm(suv * 5.0 + 3.0));
    vec3 surf = mix(ocean, landc, land);
    float cl = smoothstep(0.48, 0.82, fbm(suv * 2.6 + vec2(mod(uTime * 0.008, 64.0), 1.3)));
    surf = mix(surf, vec3(0.92, 0.95, 1.0), cl * 0.9);
    float term = smoothstep(-0.15, 0.25, sp.x * 0.8 + 0.25 - uCity);
    vec3 night = vec3(1.0, 0.6, 0.25) * step(0.82, noise(suv * 40.0)) * land * 0.6 * (1.0 - cl);
    surf = mix(night, surf, term);
    surf *= 0.3 + 0.7 * z;
    col = surf;
  }
  float atm = exp(-abs(d - R) * 30.0) + exp(-max(d - R, 0.0) * 9.0) * 0.25 * step(R, d);
  col += vec3(0.22, 0.5, 1.0) * atm * 0.85;
  col *= mix(0.25, 1.0, smoothstep(1.0, 0.78, r));
  gl_FragColor = vec4(col * uBright, 1.0);
}`;

export function earthMaterial(seed = 0, city = 0) {
  return new THREE.ShaderMaterial({
    name: 'earth-screen',
    uniforms: { uTime: { value: 0 }, uSeed: { value: seed }, uBright: { value: 1.7 }, uCity: { value: city } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: earthFrag,
  });
}

// Porthole frame (used for real windows and Earth screens). Faces +Z.
export function portholeFrame(M, r = 0.45, { flange = 0.16, depth = 0.08 } = {}) {
  const g = new THREE.Group();
  place(g, new THREE.TorusGeometry(r + 0.02, 0.035, 10, 48), M.alu, { p: [0, 0, depth * 0.5] });
  place(g, new THREE.RingGeometry(r + 0.02, r + flange, 48), M.aluDark, { p: [0, 0, depth * 0.3] });
  place(g, new THREE.CylinderGeometry(r + 0.01, r + 0.01, depth, 40, 1, true), M.aluDark, { p: [0, 0, 0], r: [Math.PI / 2, 0, 0] });
  // bolts
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    place(g, new THREE.CylinderGeometry(0.012, 0.012, 0.015, 6), M.alu, { p: [Math.cos(a) * (r + flange * 0.62), Math.sin(a) * (r + flange * 0.62), depth * 0.36], r: [Math.PI / 2, 0, 0], cast: false });
  }
  return g;
}

export function earthScreen(M, r, seed, list) {
  const g = portholeFrame(M, r, { flange: 0.14, depth: 0.1 });
  const mat = earthMaterial(seed, (seed * 0.37) % 0.5);
  list.push(mat);
  const screen = place(g, new THREE.CircleGeometry(r + 0.012, 48), mat, { p: [0, 0, -0.02], cast: false });
  screen.userData.noMerge = true;
  place(g, new THREE.CircleGeometry(r + 0.012, 48), M.glass, { p: [0, 0, 0.0], cast: false, receive: false });
  return g;
}

// Gold EVA-style handrail along +X, length L, standoffs into -Z
export function handrail(M, L = 0.8) {
  const g = new THREE.Group();
  place(g, roundedBox(L, 0.03, 0.022, 0.01), M.gold, { p: [0, 0, 0.07] });
  for (const x of [-L / 2 + 0.05, L / 2 - 0.05]) place(g, new THREE.BoxGeometry(0.026, 0.026, 0.07), M.gold, { p: [x, 0, 0.035] });
  return g;
}

// Flat display with a frame. material: screenMaterial(...). Faces +Z.
export function display(M, w, h, material, { frame = 0.03, depth = 0.04 } = {}) {
  const g = new THREE.Group();
  place(g, roundedBox(w + frame * 2, h + frame * 2, depth, 0.02), M.graphite, { p: [0, 0, 0] });
  place(g, new THREE.PlaneGeometry(w, h), material, { p: [0, 0, depth / 2 + 0.002], cast: false });
  return g;
}

// Glass display case on a plinth with merch items. Faces +Z.
export function vitrine(M, w = 1.6, d = 0.5, { plinth = 0.9, case_ = 0.75 } = {}) {
  const g = new THREE.Group();
  const pl = new THREE.BoxGeometry(w, plinth, d);
  boxUV(pl);
  place(g, pl, M.whiteIn, { p: [0, plinth / 2, 0] });
  place(g, new THREE.BoxGeometry(w + 0.01, 0.025, d + 0.01), M.aluSatin, { p: [0, plinth + 0.012, 0] });
  place(g, new THREE.BoxGeometry(w - 0.06, 0.012, 0.012), M.ledWarm, { p: [0, plinth + 0.03, d / 2 - 0.03], cast: false });
  // glass case
  const gl = place(g, new THREE.BoxGeometry(w, case_, d), M.glassVitrine, { p: [0, plinth + case_ / 2 + 0.025, 0], cast: false, receive: false });
  gl.renderOrder = 2;
  place(g, new THREE.BoxGeometry(w + 0.02, 0.03, d + 0.02), M.aluSatin, { p: [0, plinth + case_ + 0.04, 0] });
  place(g, new THREE.BoxGeometry(w - 0.1, 0.015, 0.02), M.ledWhite, { p: [0, plinth + case_ + 0.015, 0], cast: false });
  place(g, new THREE.BoxGeometry(w - 0.04, 0.012, d - 0.06), M.glassVitrine, { p: [0, plinth + case_ * 0.5, 0], cast: false, receive: false });
  // items: mugs, a rocket model, patches, a mini rover, a capsule
  const y0 = plinth + 0.025, y1 = plinth + case_ * 0.5 + 0.006;
  const step = (w - 0.3) / 3;
  for (let i = 0; i < 4; i++) {
    const x = -w / 2 + 0.15 + i * step;
    place(g, G.cyl(0.045, 0.045, 0.1, 18), i % 2 ? M.orange : M.white, { p: [x, y0 + 0.05, 0.02] });
    place(g, new THREE.TorusGeometry(0.03, 0.008, 6, 12, Math.PI), i % 2 ? M.orange : M.white, { p: [x + 0.05, y0 + 0.05, 0.02], r: [0, 0, -Math.PI / 2] });
  }
  // rocket
  const rx = w / 2 - 0.2;
  place(g, G.cyl(0.035, 0.035, 0.24, 16), M.lunar, { p: [rx, y1 + 0.12, 0] });
  place(g, new THREE.ConeGeometry(0.035, 0.09, 16), M.orange, { p: [rx, y1 + 0.285, 0] });
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2;
    place(g, new THREE.BoxGeometry(0.004, 0.06, 0.04), M.orange, { p: [rx + Math.cos(a) * 0.04, y1 + 0.03, Math.sin(a) * 0.04], r: [0, -a, 0] });
  }
  // patches
  for (let i = 0; i < 3; i++) {
    place(g, G.cyl(0.05, 0.05, 0.01, 20), [M.deep, M.orange, M.gold][i], { p: [-w / 2 + 0.2 + i * 0.16, y1 + 0.006, 0.05] });
  }
  // capsule model
  place(g, new THREE.ConeGeometry(0.07, 0.1, 18), M.lunar, { p: [0.05, y1 + 0.05, -0.05] });
  place(g, new THREE.SphereGeometry(0.07, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), M.mars, { p: [0.05, y1 + 0.0, -0.05], r: [Math.PI, 0, 0] });
  return g;
}

// Small scale model of the Astro City dome (for the Tour Desk)
export function domeModel(M, R = 0.22) {
  const g = new THREE.Group();
  place(g, G.cyl(R * 1.6, R * 1.7, 0.03, 32), M.mars, { p: [0, 0.015, 0] });
  place(g, G.cyl(R, R, R * 0.25, 24), M.white, { p: [0, 0.03 + R * 0.125, 0] });
  const dome = new THREE.SphereGeometry(R, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  place(g, dome, M.white, { p: [0, 0.03 + R * 0.25, 0] });
  place(g, G.cyl(R * 0.2, R * 0.2, R * 1.4, 12), M.white, { p: [0, 0.03 + R * 0.2, R * 1.4], r: [Math.PI / 2, 0, 0] });
  return g;
}

// Text panel (labels/plaques). Faces +Z.
export function plaque(M, w, h, tex, mat) {
  const g = new THREE.Group();
  place(g, new THREE.PlaneGeometry(w, h), mat || new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5, transparent: true }), { p: [0, 0, 0.002], cast: false });
  return g;
}

export function menuTexture() {
  return labelTexture({
    w: 1024, h: 512, bg: '#06090F',
    lines: [
      { text: 'MENU', font: FONT_MONO, size: 34, y: 0.11, color: '#FF6A1A', weight: 500, spacing: 0.4 },
      { text: 'MARS', font: FONT_SANS, size: 92, y: 0.32, x: 0.08, align: 'left', color: '#FF6A1A', weight: 800, spacing: 0.08 },
      { text: 'LUNA', font: FONT_SANS, size: 92, y: 0.55, x: 0.08, align: 'left', color: '#DDE3EA', weight: 800, spacing: 0.08 },
      { text: 'EARTH', font: FONT_SANS, size: 92, y: 0.78, x: 0.08, align: 'left', color: '#6FA8FF', weight: 800, spacing: 0.08 },
      { text: 'RED ESPRESSO · CINNAMON', font: FONT_MONO, size: 26, y: 0.32, x: 0.92, align: 'right', color: '#9AA6B6', weight: 400 },
      { text: 'WHITE FLAT · OAT · VANILLA', font: FONT_MONO, size: 26, y: 0.55, x: 0.92, align: 'right', color: '#9AA6B6', weight: 400 },
      { text: 'BLUE COLD BREW · CITRUS', font: FONT_MONO, size: 26, y: 0.78, x: 0.92, align: 'right', color: '#9AA6B6', weight: 400 },
    ],
  });
}
