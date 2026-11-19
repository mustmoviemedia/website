// Fixtures and building services (MEP): toilets, washbasins, faucets, fridges, ventilation,
// exit signs, extinguishers, wayfinding and the live mission clock.
// Same convention as props.js: built at the origin, facing +Z, the wall (if any) at z = 0.
import * as THREE from 'three';
import { place, roundedBox, cylinderBetween, V } from '../core/geometry.js';
import { screenMaterial } from '../core/materials.js';
import { makeCanvas, toTexture, labelTexture, FONT_MONO, FONT_SANS } from '../core/textures.js';

const cyl = (rt, rb, h, seg = 20, open = false) => new THREE.CylinderGeometry(rt, rb, h, seg, 1, open);

// extra materials shared per scene (cached on the scene's material library)
export function fxMaterials(M) {
  if (M._fx) return M._fx;
  const std = (o) => new THREE.MeshStandardMaterial(o);
  M._fx = {
    ceramic: std({ name: 'ceramic', color: '#F7F8F8', roughness: 0.14, metalness: 0, envMapIntensity: 0.6 }),
    ceramicDS: std({ name: 'ceramic-ds', color: '#F7F8F8', roughness: 0.14, side: THREE.DoubleSide, envMapIntensity: 0.6 }),
    mirror: std({ name: 'mirror', color: '#E4EAF0', metalness: 1, roughness: 0.03, envMapIntensity: 1.2 }),
    red: std({ name: 'safety-red', color: '#C8261C', roughness: 0.35 }),
    chrome: std({ name: 'chrome', color: '#E8ECF0', metalness: 1, roughness: 0.12 }),
    grille: std({ name: 'grille', color: '#2B323C', roughness: 0.6, metalness: 0.4 }),
    bottle: [
      std({ name: 'bottle-mars', color: '#FF6A1A', roughness: 0.25 }),
      std({ name: 'bottle-luna', color: '#DDE3EA', roughness: 0.2 }),
      std({ name: 'bottle-earth', color: '#2F6FC0', roughness: 0.2 }),
      std({ name: 'bottle-glass', color: '#5E8C6A', roughness: 0.1, metalness: 0.1 }),
    ],
    cake: [
      std({ name: 'cake-mars', color: '#B4482A', roughness: 0.7 }),
      std({ name: 'cake-luna', color: '#EDE6DA', roughness: 0.75 }),
      std({ name: 'cake-earth', color: '#3E5E8C', roughness: 0.6 }),
      std({ name: 'cake-gold', color: '#E7B53A', roughness: 0.6 }),
    ],
  };
  return M._fx;
}

// ---------- plumbing ----------
export function faucet(M, h = 0.24) {
  const F = fxMaterials(M);
  const g = new THREE.Group();
  const R = 0.075;
  place(g, cyl(0.026, 0.03, 0.02, 16), F.chrome, { p: [0, 0.01, 0] });
  place(g, cyl(0.016, 0.018, h, 14), F.chrome, { p: [0, h / 2, 0] });
  const arc = new THREE.TorusGeometry(R, 0.011, 8, 18, Math.PI);
  arc.rotateY(-Math.PI / 2);
  place(g, arc, F.chrome, { p: [0, h, R] });
  place(g, cyl(0.01, 0.012, 0.035, 10), F.chrome, { p: [0.03, h * 0.78, 0], r: [0, 0, Math.PI / 2] });
  return g;
}

// Wall-hung washbasin with porthole mirror. Wall at z = 0.
export function washbasin(M, { w = 0.6, d = 0.46, mirror = true, top = null } = {}) {
  const F = fxMaterials(M);
  const g = new THREE.Group();
  place(g, roundedBox(w, 0.06, d, 0.03), top || M.stoneTop, { p: [0, 0.83, d / 2] });
  // vessel basin
  const bowl = cyl(0.2, 0.14, 0.13, 32, true);
  bowl.scale(1, 1, 0.82);
  place(g, bowl, F.ceramicDS, { p: [0, 0.925, d / 2 + 0.02] });
  const bottom = new THREE.CircleGeometry(0.14, 24); bottom.rotateX(-Math.PI / 2); bottom.scale(1, 1, 0.82);
  place(g, bottom, F.ceramic, { p: [0, 0.862, d / 2 + 0.02], cast: false });
  place(g, cyl(0.016, 0.016, 0.006, 12), F.chrome, { p: [0, 0.866, d / 2 + 0.02], cast: false });
  const fc = faucet(M, 0.2); fc.position.set(0, 0.86, 0.07); g.add(fc);
  place(g, cyl(0.03, 0.03, 0.12, 14), M.white, { p: [w / 2 - 0.08, 0.92, 0.1] });
  place(g, cyl(0.008, 0.008, 0.03, 8), F.chrome, { p: [w / 2 - 0.08, 0.995, 0.1] });
  if (mirror) {
    place(g, new THREE.CircleGeometry(0.29, 48), F.mirror, { p: [0, 1.52, 0.012], cast: false });
    place(g, new THREE.TorusGeometry(0.3, 0.018, 8, 48), M.alu, { p: [0, 1.52, 0.02] });
    place(g, new THREE.TorusGeometry(0.33, 0.008, 6, 48), M.ledWhite, { p: [0, 1.52, 0.006], cast: false });
  }
  // trap
  place(g, cyl(0.022, 0.022, 0.3, 10), F.chrome, { p: [0, 0.65, 0.12] });
  return g;
}

// Wall-hung WC with concealed cistern. Wall at z = 0.
export function toilet(M) {
  const F = fxMaterials(M);
  const g = new THREE.Group();
  place(g, roundedBox(0.56, 1.12, 0.14, 0.03), M.whiteIn, { p: [0, 0.56, 0.07] });
  place(g, roundedBox(0.22, 0.15, 0.014, 0.02), F.chrome, { p: [0, 1.0, 0.145] });
  place(g, new THREE.BoxGeometry(0.004, 0.11, 0.004), M.graphite, { p: [0, 1.0, 0.153], cast: false });
  const prof = [[0, 0], [0.11, 0], [0.16, 0.06], [0.185, 0.16], [0.19, 0.24], [0.17, 0.25], [0.15, 0.2], [0.0, 0.17]].map(([x, y]) => new THREE.Vector2(x, y));
  const bowl = new THREE.LatheGeometry(prof, 32);
  bowl.scale(1, 1, 1.42);
  place(g, bowl, F.ceramic, { p: [0, 0.2, 0.42] });
  place(g, roundedBox(0.2, 0.22, 0.2, 0.06), F.ceramic, { p: [0, 0.3, 0.2] });
  const seat = new THREE.TorusGeometry(0.155, 0.022, 8, 32); seat.rotateX(Math.PI / 2); seat.scale(1, 1, 1.4);
  place(g, seat, M.white, { p: [0, 0.455, 0.42] });
  place(g, roundedBox(0.36, 0.46, 0.025, 0.12), M.white, { p: [0, 0.69, 0.18], r: [-0.12, 0, 0] });
  return g;
}

// Stainless grab bar (fold-down style), wall at z = 0
export function grabBar(M, L = 0.7) {
  const F = fxMaterials(M);
  const g = new THREE.Group();
  place(g, roundedBox(0.08, 0.16, 0.05, 0.02), F.chrome, { p: [0, 0.78, 0.025] });
  g.add(new THREE.Mesh(cylinderBetween(V(0, 0.84, 0.05), V(0, 0.84, L), 0.016), F.chrome));
  g.add(new THREE.Mesh(cylinderBetween(V(0, 0.7, 0.05), V(0, 0.7, L), 0.016), F.chrome));
  g.add(new THREE.Mesh(cylinderBetween(V(0, 0.7, L), V(0, 0.84, L), 0.016), F.chrome));
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

export function handDryer(M) {
  const g = new THREE.Group();
  place(g, roundedBox(0.28, 0.34, 0.15, 0.05), M.white, { p: [0, 1.22, 0.075] });
  place(g, new THREE.BoxGeometry(0.2, 0.012, 0.03), M.graphite, { p: [0, 1.05, 0.12], cast: false });
  place(g, new THREE.BoxGeometry(0.16, 0.008, 0.004), M.ledCool, { p: [0, 1.33, 0.152], cast: false });
  return g;
}

export function paperHolder(M) {
  const F = fxMaterials(M);
  const g = new THREE.Group();
  place(g, roundedBox(0.16, 0.05, 0.03, 0.01), F.chrome, { p: [0, 0.7, 0.015] });
  place(g, cyl(0.055, 0.055, 0.11, 18), M.white, { p: [0, 0.64, 0.07], r: [0, 0, Math.PI / 2] });
  return g;
}

// Kitchen / bar sink inset into a counter: basin + faucet. Placed with y = counter top.
export function counterSink(M, w = 0.5, d = 0.4) {
  const F = fxMaterials(M);
  const g = new THREE.Group();
  place(g, new THREE.BoxGeometry(w, 0.006, d), M.graphite, { p: [0, 0.002, 0], cast: false });
  place(g, new THREE.BoxGeometry(w - 0.04, 0.004, d - 0.04), F.chrome, { p: [0, 0.004, 0], cast: false });
  place(g, cyl(0.022, 0.022, 0.004, 12), M.graphite, { p: [0, 0.007, 0], cast: false });
  const fc = faucet(M, 0.3); fc.position.set(0, 0, -d / 2 - 0.04); g.add(fc);
  return g;
}

// ---------- refrigeration ----------
export function fridgeTall(M, { w = 0.7, h = 2.0, d = 0.66, doors = 2 } = {}) {
  const F = fxMaterials(M);
  const g = new THREE.Group();
  place(g, roundedBox(w, h - 0.05, d, 0.03), M.steel, { p: [0, 0.05 + (h - 0.05) / 2, 0] });
  for (const x of [-w / 2 + 0.06, w / 2 - 0.06]) place(g, cyl(0.02, 0.02, 0.05, 8), M.graphite, { p: [x, 0.025, d / 2 - 0.06] });
  if (doors === 2) place(g, new THREE.BoxGeometry(0.008, h - 0.12, 0.01), M.graphite, { p: [0, 0.05 + (h - 0.05) / 2, d / 2 + 0.002], cast: false });
  const hx = doors === 2 ? [-0.06, 0.06] : [w / 2 - 0.08];
  for (const x of hx) {
    place(g, roundedBox(0.03, 0.8, 0.03, 0.012), F.chrome, { p: [x, 1.15, d / 2 + 0.04] });
    for (const y of [0.77, 1.53]) place(g, new THREE.BoxGeometry(0.02, 0.02, 0.04), F.chrome, { p: [x, y, d / 2 + 0.02] });
  }
  place(g, roundedBox(0.16, 0.06, 0.01, 0.01), M.graphite, { p: [-w / 4, 1.72, d / 2 + 0.005], cast: false });
  place(g, new THREE.BoxGeometry(0.1, 0.02, 0.004), M.ledCool, { p: [-w / 4, 1.72, d / 2 + 0.011], cast: false });
  return g;
}

// Glass-door beverage cooler (under-counter or tall) with lit interior and brand bottles
export function glassFridge(M, { w = 0.6, h = 0.86, d = 0.56, shelves = 2, label = false } = {}) {
  const F = fxMaterials(M);
  const g = new THREE.Group();
  const t = 0.04;
  place(g, new THREE.BoxGeometry(w, t, d), M.graphite, { p: [0, t / 2 + 0.06, 0] });
  place(g, new THREE.BoxGeometry(w, t, d), M.graphite, { p: [0, h - t / 2, 0] });
  for (const sx of [-1, 1]) place(g, new THREE.BoxGeometry(t, h - 0.06, d), M.graphite, { p: [sx * (w / 2 - t / 2), 0.06 + (h - 0.06) / 2, 0] });
  place(g, new THREE.BoxGeometry(w, 0.06, d - 0.04), M.graphite, { p: [0, 0.03, -0.02] });
  place(g, new THREE.BoxGeometry(w - 2 * t, h - 0.1 - t, 0.01), M.ledCool, { p: [0, 0.06 + t + (h - 0.1 - t) / 2, -d / 2 + 0.01], cast: false });
  const inner = h - 0.1 - 2 * t;
  const cols = Math.max(3, Math.floor((w - 0.1) / 0.075));
  for (let k = 0; k < shelves; k++) {
    const y = 0.06 + t + (k * inner) / shelves;
    place(g, new THREE.BoxGeometry(w - 2 * t - 0.01, 0.012, d - 0.1), M.alu, { p: [0, y + 0.006, 0], cast: false });
    for (let c = 0; c < cols; c++) {
      const x = -w / 2 + t + 0.04 + (c * (w - 2 * t - 0.08)) / (cols - 1);
      const bh = Math.min(0.24, inner / shelves - 0.05);
      const mat = F.bottle[(c + k) % F.bottle.length];
      place(g, cyl(0.028, 0.03, bh * 0.75, 12), mat, { p: [x, y + 0.012 + bh * 0.375, 0.02], cast: false });
      place(g, cyl(0.011, 0.024, bh * 0.25, 10), mat, { p: [x, y + 0.012 + bh * 0.875, 0.02], cast: false });
    }
  }
  const glass = place(g, new THREE.BoxGeometry(w - 0.02, h - 0.08, 0.012), M.glassVitrine, { p: [0, 0.06 + (h - 0.06) / 2, d / 2 + 0.006], cast: false, receive: false });
  glass.renderOrder = 2;
  place(g, roundedBox(0.025, Math.min(0.6, h * 0.6), 0.03, 0.01), M.alu, { p: [w / 2 - 0.06, 0.06 + h * 0.5, d / 2 + 0.03] });
  if (label) place(g, new THREE.BoxGeometry(w - 0.06, 0.02, 0.012), M.ledOrange, { p: [0, h - 0.03, d / 2 + 0.008], cast: false });
  return g;
}

// Countertop dessert display (refrigerated)
export function dessertCase(M, w = 0.72) {
  const F = fxMaterials(M);
  const g = new THREE.Group();
  place(g, roundedBox(w, 0.1, 0.42, 0.02), M.graphite, { p: [0, 0.05, 0] });
  const gl = place(g, new THREE.BoxGeometry(w - 0.02, 0.32, 0.4), M.glassVitrine, { p: [0, 0.26, 0], cast: false, receive: false });
  gl.renderOrder = 2;
  place(g, new THREE.BoxGeometry(w, 0.02, 0.42), M.aluSatin, { p: [0, 0.43, 0] });
  place(g, new THREE.BoxGeometry(w - 0.08, 0.008, 0.02), M.ledWhite, { p: [0, 0.415, 0.12], cast: false });
  place(g, new THREE.BoxGeometry(w - 0.04, 0.008, 0.36), M.alu, { p: [0, 0.25, 0], cast: false });
  for (let i = 0; i < 3; i++) {
    const x = -w / 2 + 0.14 + i * ((w - 0.28) / 2);
    place(g, cyl(0.07, 0.07, 0.07, 24), F.cake[i], { p: [x, 0.135, 0.02] });
    place(g, cyl(0.072, 0.072, 0.012, 24), F.cake[(i + 1) % 4], { p: [x, 0.176, 0.02], cast: false });
    for (let k = 0; k < 3; k++) place(g, new THREE.SphereGeometry(0.028, 12, 8), F.cake[(i + k + 2) % 4], { p: [x - 0.06 + k * 0.06, 0.28, 0.02], s: [1, 0.6, 1], cast: false });
  }
  return g;
}

// ---------- ventilation ----------
// Square 4-way ceiling diffuser, hanging from y = 0 (faces down)
export function ceilingDiffuser(M, s = 0.6) {
  const F = fxMaterials(M);
  const g = new THREE.Group();
  place(g, new THREE.BoxGeometry(s, 0.012, s), M.aluSatin, { p: [0, -0.006, 0], cast: false });
  for (const k of [0.36, 0.22]) {
    const a = s * k, w = 0.026;
    for (const [x, z, sx, sz] of [[0, a, 2 * a, w], [0, -a, 2 * a, w], [a, 0, w, 2 * a], [-a, 0, w, 2 * a]]) {
      place(g, new THREE.BoxGeometry(sx, 0.004, sz), F.grille, { p: [x, -0.0135, z], cast: false });
    }
  }
  place(g, new THREE.BoxGeometry(s * 0.2, 0.02, s * 0.2), M.aluSatin, { p: [0, -0.02, 0], cast: false });
  return g;
}

// Round exhaust valve (WC / kitchen), faces down
export function exhaustValve(M, r = 0.1) {
  const F = fxMaterials(M);
  const g = new THREE.Group();
  const ring = new THREE.RingGeometry(r * 0.72, r, 32); ring.rotateX(Math.PI / 2);
  place(g, ring, M.aluSatin, { p: [0, -0.004, 0], cast: false });
  const hole = new THREE.CircleGeometry(r * 0.72, 32); hole.rotateX(Math.PI / 2);
  place(g, hole, F.grille, { p: [0, -0.002, 0], cast: false });
  place(g, cyl(r * 0.45, r * 0.45, 0.02, 24), M.aluSatin, { p: [0, -0.02, 0], cast: false });
  return g;
}

// Linear slot diffuser along X, faces down
export function slotDiffuser(M, L = 1.6) {
  const F = fxMaterials(M);
  const g = new THREE.Group();
  place(g, new THREE.BoxGeometry(L, 0.01, 0.12), M.aluSatin, { p: [0, -0.005, 0], cast: false });
  for (const z of [-0.025, 0.025]) place(g, new THREE.BoxGeometry(L - 0.04, 0.004, 0.018), F.grille, { p: [0, -0.011, z], cast: false });
  return g;
}

// Long-throw jet nozzle (dome ventilation), aims along +Z
export function jetNozzle(M) {
  const g = new THREE.Group();
  place(g, new THREE.SphereGeometry(0.085, 16, 10), M.aluSatin, {});
  place(g, cyl(0.06, 0.07, 0.16, 18), M.alu, { p: [0, 0, 0.1], r: [Math.PI / 2, 0, 0] });
  place(g, new THREE.CircleGeometry(0.05, 18), fxMaterials(M).grille, { p: [0, 0, 0.181], cast: false });
  return g;
}

// Outdoor condensing / air-handling unit with top fans and side louvres
export function hvacUnit(M, { w = 1.8, h = 1.1, d = 1.0, fans = 2, label = 'HVAC' } = {}) {
  const F = fxMaterials(M);
  const g = new THREE.Group();
  place(g, roundedBox(w, h, d, 0.04), M.lunar, { p: [0, h / 2 + 0.08, 0] });
  for (const sx of [-1, 1]) place(g, new THREE.BoxGeometry(0.08, 0.08, d - 0.1), M.aluDark, { p: [sx * (w / 2 - 0.15), 0.04, 0] });
  // louvres on the front
  const n = Math.floor((h - 0.25) / 0.055);
  for (let i = 0; i < n; i++) place(g, new THREE.BoxGeometry(w - 0.3, 0.02, 0.03), F.grille, { p: [0, 0.22 + i * 0.055, d / 2 + 0.01], r: [0.5, 0, 0], cast: false });
  // fans on top
  for (let k = 0; k < fans; k++) {
    const x = -w / 2 + (w / fans) * (k + 0.5);
    const r = Math.min(w / fans, d) * 0.38;
    const disc = new THREE.CircleGeometry(r, 32); disc.rotateX(-Math.PI / 2);
    place(g, disc, F.grille, { p: [x, h + 0.081, 0], cast: false });
    place(g, new THREE.TorusGeometry(r, 0.012, 6, 32).rotateX(Math.PI / 2), M.alu, { p: [x, h + 0.09, 0], cast: false });
    for (let s = 0; s < 4; s++) place(g, new THREE.BoxGeometry(r * 2, 0.008, 0.012), M.alu, { p: [x, h + 0.092, 0], r: [0, (s * Math.PI) / 4, 0], cast: false });
    place(g, cyl(r * 0.18, r * 0.18, 0.02, 14), M.aluDark, { p: [x, h + 0.095, 0], cast: false });
  }
  const tex = labelTexture({ w: 256, h: 64, bg: '#13223A', lines: [{ text: label, font: FONT_MONO, size: 30, weight: 500, spacing: 0.2, color: '#F2C230' }] });
  place(g, new THREE.PlaneGeometry(0.34, 0.085), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5 }), { p: [w / 2 - 0.3, h - 0.05, d / 2 + 0.002], cast: false });
  return g;
}

// Rectangular duct between two points (y-up), section s
export function duct(M, a, b, s = 0.32) {
  const dir = V().subVectors(b, a);
  const len = dir.length();
  const g = new THREE.BoxGeometry(s, s, len);
  const m = new THREE.Mesh(g, M.aluSatin);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.lookAt(b);
  m.castShadow = m.receiveShadow = true;
  return m;
}

// Mushroom roof vent
export function roofVent(M, r = 0.18) {
  const g = new THREE.Group();
  place(g, cyl(r * 0.6, r * 0.6, 0.35, 16), M.aluSatin, { p: [0, 0.175, 0] });
  place(g, cyl(r * 0.3, r * 1.2, 0.12, 20), M.aluSatin, { p: [0, 0.42, 0] });
  place(g, cyl(r * 0.62, r * 0.62, 0.06, 16), fxMaterials(M).grille, { p: [0, 0.33, 0], cast: false });
  return g;
}

// ---------- safety & wayfinding ----------
export function exitSign(M, dn) {
  const tex = labelTexture({ w: 512, h: 192, bg: '#0E8F4C', lines: [{ text: 'EXIT', size: 104, weight: 800, spacing: 0.18, color: '#FFFFFF', x: 0.56 }, { text: '←', size: 110, weight: 800, x: 0.16, color: '#FFFFFF' }] });
  const mat = screenMaterial(dn, tex, { day: 0.9, night: 1.6 });
  const g = new THREE.Group();
  place(g, roundedBox(0.4, 0.16, 0.05, 0.015), M.white, {});
  place(g, new THREE.PlaneGeometry(0.37, 0.135), mat, { p: [0, 0, 0.026], cast: false });
  place(g, new THREE.PlaneGeometry(0.37, 0.135), mat, { p: [0, 0, -0.026], r: [0, Math.PI, 0], cast: false });
  return g;
}

export function extinguisher(M) {
  const F = fxMaterials(M);
  const g = new THREE.Group();
  place(g, new THREE.BoxGeometry(0.12, 0.05, 0.03), M.aluDark, { p: [0, 1.0, 0.015] });
  place(g, cyl(0.075, 0.075, 0.42, 20), F.red, { p: [0, 0.82, 0.1] });
  place(g, new THREE.SphereGeometry(0.075, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2), F.red, { p: [0, 1.03, 0.1] });
  place(g, cyl(0.025, 0.025, 0.06, 10), M.graphite, { p: [0, 1.12, 0.1] });
  place(g, new THREE.BoxGeometry(0.1, 0.015, 0.03), M.graphite, { p: [0.03, 1.155, 0.1], r: [0, 0, -0.3] });
  g.add(new THREE.Mesh(cylinderBetween(V(0.02, 1.12, 0.13), V(0.08, 0.7, 0.17), 0.009), M.graphite));
  const lab = labelTexture({ w: 128, h: 128, bg: '#FFFFFF', lines: [{ text: 'CO₂', font: FONT_MONO, size: 40, weight: 500, color: '#C8261C' }] });
  place(g, new THREE.PlaneGeometry(0.09, 0.09), new THREE.MeshStandardMaterial({ map: lab, roughness: 0.6 }), { p: [0, 0.8, 0.176], cast: false });
  return g;
}

// Restroom pictograms (person / person / wheelchair) drawn on canvas
function drawPerson(ctx, x, y, s, female) {
  ctx.beginPath(); ctx.arc(x, y - s * 0.62, s * 0.13, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath();
  if (female) { ctx.moveTo(x - s * 0.08, y - s * 0.44); ctx.lineTo(x + s * 0.08, y - s * 0.44); ctx.lineTo(x + s * 0.24, y + s * 0.12); ctx.lineTo(x - s * 0.24, y + s * 0.12); }
  else { ctx.roundRect ? ctx.roundRect(x - s * 0.17, y - s * 0.44, s * 0.34, s * 0.5, s * 0.06) : ctx.rect(x - s * 0.17, y - s * 0.44, s * 0.34, s * 0.5); }
  ctx.fill();
  ctx.fillRect(x - s * 0.12, y + s * 0.06, s * 0.09, s * 0.42);
  ctx.fillRect(x + s * 0.03, y + s * 0.06, s * 0.09, s * 0.42);
}
function drawWheelchair(ctx, x, y, s) {
  ctx.beginPath(); ctx.arc(x - s * 0.05, y - s * 0.62, s * 0.12, 0, Math.PI * 2); ctx.fill();
  ctx.lineWidth = s * 0.1; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x - s * 0.08, y - s * 0.42); ctx.lineTo(x - s * 0.08, y - s * 0.05); ctx.lineTo(x + s * 0.22, y - s * 0.05); ctx.lineTo(x + s * 0.32, y + s * 0.3); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - s * 0.08, y - s * 0.3); ctx.lineTo(x + s * 0.15, y - s * 0.3); ctx.stroke();
  ctx.lineWidth = s * 0.07;
  ctx.beginPath(); ctx.arc(x - s * 0.05, y + s * 0.18, s * 0.26, -Math.PI * 0.35, Math.PI * 1.25); ctx.stroke();
}

export function wcSignTexture({ title = 'RESTROOM', sub = '', icons = ['m', 'f'], arrow = '' } = {}) {
  const c = makeCanvas(1024, 256), ctx = c.getContext('2d');
  ctx.fillStyle = '#13223A'; ctx.fillRect(0, 0, 1024, 256);
  ctx.fillStyle = '#FF6A1A'; ctx.fillRect(0, 236, 1024, 20);
  ctx.fillStyle = '#F4F6F8';
  icons.forEach((k, i) => {
    const x = 90 + i * 120, y = 140, s = 150;
    if (k === 'w') drawWheelchair(ctx, x, y, s); else drawPerson(ctx, x, y, s, k === 'f');
  });
  const tx = 90 + icons.length * 120;
  ctx.font = `800 84px ${FONT_SANS}`; ctx.textBaseline = 'middle';
  ctx.fillText(title, tx, sub ? 100 : 128);
  if (sub) { ctx.font = `500 40px ${FONT_MONO}`; ctx.fillStyle = '#F2C230'; ctx.fillText(sub, tx + 4, 178); }
  if (arrow) { ctx.font = `800 110px ${FONT_SANS}`; ctx.fillStyle = '#FF6A1A'; ctx.textAlign = 'right'; ctx.fillText(arrow, 1000, 128); }
  return toTexture(c, { wrap: false });
}

export function wcSign(M, dn, opts, w = 0.9) {
  const g = new THREE.Group();
  const mat = screenMaterial(dn, wcSignTexture(opts), { day: 0.9, night: 1.3 });
  place(g, roundedBox(w + 0.03, w / 4 + 0.03, 0.03, 0.015), M.graphite, {});
  place(g, new THREE.PlaneGeometry(w, w / 4), mat, { p: [0, 0, 0.016], cast: false });
  if (opts.both) place(g, new THREE.PlaneGeometry(w, w / 4), mat, { p: [0, 0, -0.016], r: [0, Math.PI, 0], cast: false });
  return g;
}

// Door leaf, hinge on local x = 0, leaf extends to +x
export function doorLeaf(M, w = 0.85, h = 2.1, mat = null) {
  const F = fxMaterials(M);
  const g = new THREE.Group();
  place(g, new THREE.BoxGeometry(w, h, 0.045), mat || M.whiteIn, { p: [w / 2, h / 2, 0] });
  for (const z of [-0.045, 0.045]) {
    place(g, new THREE.BoxGeometry(0.14, 0.022, 0.022), F.chrome, { p: [w - 0.13, 1.0, z] });
    place(g, cyl(0.025, 0.025, 0.01, 14), F.chrome, { p: [w - 0.07, 1.0, z * 0.6], r: [Math.PI / 2, 0, 0], cast: false });
  }
  place(g, new THREE.BoxGeometry(0.03, 0.03, 0.05), M.graphite, { p: [w - 0.07, 1.12, 0], cast: false });
  return g;
}

// Live mission clock: LOCAL (UTC+5, Tashkent / Nukus) and UTC
export function missionClock(M, dn, { w = 1.2, h = 0.3, place: where = 'TASHKENT' } = {}) {
  const c = makeCanvas(1024, 256), ctx = c.getContext('2d');
  const tex = toTexture(c, { wrap: false });
  const mat = screenMaterial(dn, tex, { day: 1.0, night: 1.4 });
  let last = '';
  const draw = (now = new Date()) => {
    const pad = (n) => String(n).padStart(2, '0');
    const utc = `${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}`;
    const loc = `${pad((now.getUTCHours() + 5) % 24)}:${pad(now.getUTCMinutes())}`;
    const key = utc + where;
    if (key === last) return false;
    last = key;
    ctx.fillStyle = '#05080F'; ctx.fillRect(0, 0, 1024, 256);
    ctx.textBaseline = 'middle';
    ctx.font = `500 30px ${FONT_MONO}`; ctx.fillStyle = '#FF6A1A'; ctx.fillText(`${where} · UTC+5`, 40, 52);
    ctx.fillStyle = '#7D8A9C'; ctx.fillText('UTC', 640, 52);
    ctx.font = `500 132px ${FONT_MONO}`; ctx.fillStyle = '#DDE3EA'; ctx.fillText(loc, 36, 158);
    ctx.font = `500 96px ${FONT_MONO}`; ctx.fillStyle = '#F2C230'; ctx.fillText(utc, 636, 162);
    ctx.fillStyle = 'rgba(221,227,234,0.18)'; ctx.fillRect(600, 30, 3, 196);
    tex.needsUpdate = true;
    return true;
  };
  draw();
  const g = new THREE.Group();
  place(g, roundedBox(w + 0.04, h + 0.04, 0.04, 0.02), M.graphite, {});
  const screen = place(g, new THREE.PlaneGeometry(w, h), mat, { p: [0, 0, 0.021], cast: false });
  screen.userData.noMerge = true;
  g.userData.update = () => draw();
  return g;
}
