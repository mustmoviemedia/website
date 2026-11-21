// STATION 03 · N.KONYUKHOV — premium mobile coffee shop at the Solnechnaya Dolina ski resort.
// Two 4 × 2.4 m trailers coupled nose to nose: BAR (coffee around the world) + KITCHEN.
// Deck with gear benches, ski & board rack, barrel tables, heaters and festoon lights;
// snowy slope with runs, conifer forest, a chairlift and night-ski floodlights.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createStationBase, disposeTree } from './common.js';
import { createMaterials, screenMaterial, lightPoolMaterial, contactShadowMaterial, boxUV } from '../core/materials.js';
import * as T from '../core/textures.js';
import { tileSurface, profileSampler, corridorMapping, place, roundedBox, cylinderBetween, mergeStatic, V } from '../core/geometry.js';
import { Colliders } from '../core/controls.js';
import { addPerson, clearPeopleCache } from '../core/people.js';
import { createNoise2D, fbm, rng, smoothstep, clamp } from '../core/noise.js';
import * as P from './props.js';
import * as X from './fixtures.js';
import * as CITY from './city.js';
import { ZONES } from '../config.js';

const FLOOR = 0.72, TL = 4.0, TW = 2.4, TH = 2.3, GAP = 0.3;
const AX = -(TL / 2 + GAP / 2), BX = TL / 2 + GAP / 2; // trailer centres: bar, kitchen
const DECK = { x0: -5.6, x1: 5.6, z0: 1.35, z1: 7.4, h: 0.18 };
const C = { teal: '#14607C', tealDeep: '#0E4A61', cream: '#F7E3A3', gold: '#E9C46A', ice: '#B3DDF2' };

const SKY = {
  sunDir: new THREE.Vector3(0.42, 0.36, 0.83),
  moonDir: new THREE.Vector3(-0.35, 0.62, 0.7),
  day: { zenith: '#2F6DB8', horizon: '#D6E6F4', ground: '#C9D3DC', sun: '#FFF1D8', glow: '#FFE4BC', glowStrength: 0.5, horizonGlow: 0.22, sunSize: 0.85, sunBoost: 24 },
  night: { zenith: '#05080F', horizon: '#13223A', ground: '#0A0F18', cityGlow: '#18202E', milky: 0.35 },
  fog: { day: '#D9E6F2', night: '#0F1828' },
  stars: 2600,
  moonSize: 100,
};

const SKI_PALETTE = {
  top: ['#E8552E', '#F2C230', '#2F78C4', '#147A8E', '#EDEDED', '#1F2A38', '#9C2F55', '#3E8E5A', '#FF6A1A'],
  bottom: ['#1B2230', '#2B3440', '#3A4048', '#14607C', '#5B6B82', '#1F2A38'],
  hair: ['#E8552E', '#F2C230', '#EDEDED', '#1F2A38', '#147A8E', '#B4482A', '#2F78C4'],
  shoes: ['#1A1E24', '#3A4048', '#EDEDED'],
};

// ---------------- terrain ----------------
function makeTerrainFn() {
  const n = createNoise2D(808), n2 = createNoise2D(909);
  const runs = [
    (z) => -72 + 26 * Math.sin(z * 0.004 + 0.5),
    (z) => 38 + 30 * Math.sin(z * 0.0032 + 1.7),
    (z) => 150 + 22 * Math.sin(z * 0.005 + 2.3),
  ];
  const LIFT = { a: V(-22, 0, -36), b: V(-150, 0, -980) };
  const runDist = (x, z) => Math.min(Math.abs(x - runs[0](z)), Math.abs(x - runs[1](z)), Math.abs(x - runs[2](z)));
  const liftDist = (x, z) => {
    const ax = LIFT.a.x, az = LIFT.a.z, bx = LIFT.b.x - ax, bz = LIFT.b.z - az;
    let t = ((x - ax) * bx + (z - az) * bz) / (bx * bx + bz * bz);
    t = clamp(t, 0, 1);
    return Math.hypot(x - (ax + bx * t), z - (az + bz * t));
  };
  const H = (x, z) => {
    const flat = smoothstep(28, 70, Math.hypot(x, z - 6));
    const up = Math.max(0, -z - 22);
    let h = 300 * (1 - Math.exp(-up / 650));
    const onRun = z < -20 ? 1 - smoothstep(16, 32, runDist(x, z)) : 0;
    h += (26 * fbm(n, x * 0.0035, z * 0.0035, 4) + 4 * fbm(n2, x * 0.02, z * 0.02, 3)) * smoothstep(-20, -140, z) * (1 - 0.75 * onRun);
    h += 150 * smoothstep(280, 950, Math.abs(x)) * (0.6 + 0.4 * fbm(n2, x * 0.002, z * 0.002, 3));
    h += 2.5 * fbm(n2, x * 0.01, z * 0.01, 3) * smoothstep(40, 90, z);
    h += 70 * smoothstep(380, 1500, z) * (0.5 + 0.5 * fbm(n, x * 0.002, z * 0.002, 3));
    return h * flat;
  };
  return { H, runs, runDist, liftDist, LIFT };
}

function geometric(a, b, count) {
  const out = [];
  for (let i = 1; i <= count; i++) { const f = i / count; out.push(a + (b - a) * ((Math.pow(28, f) - 1) / 27)); }
  return out;
}

function buildTerrain(tf, quality) {
  const { H, runDist } = tf;
  const step = quality.tier === 'low' ? 6 : 4;
  const xs = []; for (let x = -260; x <= 260 + 1e-6; x += step) xs.push(x);
  const X = [...geometric(-260, -3200, 22).reverse(), ...xs, ...geometric(260, 3200, 22)];
  const zs = [];
  for (let z = -1000; z < -420; z += 10) zs.push(z);
  for (let z = -420; z <= 140 + 1e-6; z += step) zs.push(z);
  const Z = [...geometric(-1000, -3600, 18).reverse(), ...zs, ...geometric(140, 3200, 22)];
  const nx = X.length, nz = Z.length;
  const pos = new Float32Array(nx * nz * 3), uv = new Float32Array(nx * nz * 2), col = new Float32Array(nx * nz * 3);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i;
    pos.set([X[i], H(X[i], Z[j]), Z[j]], k * 3);
    uv.set([X[i] / 4, -Z[j] / 4], k * 2);
  }
  const idx = new Uint32Array((nx - 1) * (nz - 1) * 6);
  let o = 0;
  for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
    idx[o++] = a; idx[o++] = c; idx[o++] = b; idx[o++] = b; idx[o++] = c; idx[o++] = d;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeVertexNormals();
  const n3 = createNoise2D(31);
  const snow = new THREE.Color('#F1F5F9'), packed = new THREE.Color('#DCE3EA'), run = new THREE.Color('#F7FAFD'), forest = new THREE.Color('#3E5148'), rock = new THREE.Color('#8C949C');
  const c = new THREE.Color();
  const nrm = g.attributes.normal;
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i, x = X[i], z = Z[j];
    c.copy(snow);
    const r = Math.hypot(x, z - 6);
    if (r < 26) c.lerp(packed, 0.6 * (1 - smoothstep(12, 26, r)));
    if (z > 13 && z < 30 && Math.abs(x) < 22) c.lerp(packed, 0.75); // parking
    const onRun = z < -18 ? 1 - smoothstep(14, 24, runDist(x, z)) : 0;
    c.lerp(run, onRun * 0.8);
    // distant forest beyond the instanced trees
    const far = smoothstep(330, 460, Math.hypot(x, z * 0.8));
    const dens = smoothstep(-0.15, 0.35, fbm(n3, x * 0.006, z * 0.006, 4)) * (1 - onRun);
    if (far > 0) c.lerp(forest, far * dens * 0.75);
    const steep = smoothstep(0.35, 0.6, 1 - nrm.getY(k));
    c.lerp(rock, steep * 0.6);
    col.set([c.r, c.g, c.b], k * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeBoundingSphere();
  return g;
}

// ---------------- conifers (vertex coloured, instanced) ----------------
function coniferGeometry() {
  const parts = [];
  const paint = (geo, fn) => {
    const p = geo.attributes.position, cl = new Float32Array(p.count * 3), tmp = new THREE.Color();
    for (let i = 0; i < p.count; i++) { fn(p.getY(i), tmp); cl.set([tmp.r, tmp.g, tmp.b], i * 3); }
    geo.setAttribute('color', new THREE.BufferAttribute(cl, 3));
    geo.deleteAttribute('uv');
    return geo;
  };
  const trunk = new THREE.CylinderGeometry(0.11, 0.18, 2.0, 6); trunk.translate(0, 1.0, 0);
  parts.push(paint(trunk, (y, t) => t.set('#4A3A2C')));
  const green = new THREE.Color('#2C4536'), snow = new THREE.Color('#EEF3F7');
  for (const [r, h, y] of [[1.9, 3.0, 1.3], [1.5, 2.7, 3.2], [1.05, 2.3, 4.9], [0.6, 1.8, 6.4]]) {
    const cone = new THREE.ConeGeometry(r, h, 7, 2);
    cone.translate(0, y + h / 2, 0);
    parts.push(paint(cone, (yy, t) => { const f = (yy - y) / h; t.copy(green).lerp(snow, smoothstep(0.42, 0.75, f) * 0.85); }));
  }
  const g = mergeGeometries(parts.map((p) => p.index ? p : p));
  parts.forEach((p) => p.dispose());
  return g;
}

// ---------------- brand graphics ----------------
function drawEagle(ctx, cx, cy, s, color) {
  ctx.save();
  ctx.translate(cx, cy); ctx.scale(s / 100, s / 100); ctx.translate(-50, -50);
  ctx.fillStyle = color;
  const poly = (pts) => { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)) ctx.lineTo(p[0], p[1]); ctx.closePath(); ctx.fill(); };
  // wings raised, feathered tips
  poly([[47, 52], [30, 40], [14, 18], [24, 22], [16, 6], [30, 16], [30, 2], [40, 16], [44, 6], [50, 26], [56, 40]]);
  poly([[56, 46], [66, 30], [72, 10], [76, 22], [86, 6], [86, 20], [96, 12], [90, 30], [80, 40], [66, 50]]);
  // body
  ctx.beginPath(); ctx.ellipse(56, 60, 10, 19, -0.55, 0, Math.PI * 2); ctx.fill();
  // head + beak
  ctx.beginPath(); ctx.arc(70, 42, 6.5, 0, Math.PI * 2); ctx.fill();
  poly([[74, 39], [82, 43], [74, 46]]);
  // tail
  poly([[46, 72], [34, 90], [46, 86], [50, 94], [56, 78]]);
  // talons
  ctx.lineWidth = 3; ctx.strokeStyle = color; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(60, 74); ctx.lineTo(64, 84); ctx.moveTo(64, 72); ctx.lineTo(70, 80); ctx.stroke();
  ctx.restore();
}

function emblemCanvas(size = 512, { ring = 'TAKE A GASTRONOMIC JOURNEY', color = C.cream, bg = null } = {}) {
  const c = T.makeCanvas(size, size), ctx = c.getContext('2d');
  if (bg) { ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2); ctx.fill(); }
  const cx = size / 2, cy = size / 2, R = size * 0.36;
  ctx.strokeStyle = color; ctx.lineWidth = size * 0.014;
  ctx.beginPath(); ctx.arc(cx, cy, R, Math.PI * 0.62, Math.PI * 1.08); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, R, Math.PI * 1.92, Math.PI * 2.38); ctx.stroke();
  drawEagle(ctx, cx, cy + size * 0.01, size * 0.5, color);
  // ring text on the upper arc
  ctx.fillStyle = color; ctx.font = `700 ${Math.round(size * 0.052)}px ${T.FONT_SANS}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const chars = [...ring], span = Math.PI * 0.9, a0 = -Math.PI / 2 - span / 2;
  chars.forEach((ch, i) => {
    const a = a0 + (span * (i + 0.5)) / chars.length;
    ctx.save(); ctx.translate(cx + Math.cos(a) * R * 1.2, cy + Math.sin(a) * R * 1.2); ctx.rotate(a + Math.PI / 2); ctx.fillText(ch, 0, 0); ctx.restore();
  });
  return c;
}

function brandSignTexture() {
  const c = T.makeCanvas(2048, 384), ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 384); g.addColorStop(0, '#176C8A'); g.addColorStop(1, C.tealDeep);
  ctx.fillStyle = g; ctx.fillRect(0, 0, 2048, 384);
  ctx.drawImage(emblemCanvas(360), 40, 12);
  ctx.fillStyle = C.cream; ctx.textBaseline = 'middle';
  ctx.font = `800 150px ${T.FONT_SANS}`; ctx.fillText('N.KONYUKHOV', 440, 165);
  ctx.font = `600 64px ${T.FONT_SANS}`; ctx.fillStyle = C.gold; ctx.fillText('Around the world', 448, 290);
  ctx.font = `500 44px ${T.FONT_MONO}`; ctx.fillStyle = C.ice; ctx.textAlign = 'right'; ctx.fillText('COFFEE · FOOD · SKI', 1990, 290);
  return T.toTexture(c, { wrap: false });
}

function menuBoardTexture() {
  const c = T.makeCanvas(1024, 1536), ctx = c.getContext('2d');
  ctx.fillStyle = C.tealDeep; ctx.fillRect(0, 0, 1024, 1536);
  ctx.drawImage(emblemCanvas(300), 362, 30);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = C.cream; ctx.font = `800 76px ${T.FONT_SANS}`; ctx.fillText('COFFEE AROUND', 512, 400); ctx.fillText('THE WORLD', 512, 480);
  const items = [['ETHIOPIA', 'filter · jasmine · bergamot'], ['TURKEY', 'thick coffee · cardamom'], ['VIETNAM', 'egg cream cappuccino'], ['ITALY', 'ristretto · desserts'], ['AUSTRALIA', 'Melbourne flat white'], ['COLOMBIA', 'highland fruity filter'], ['ARGENTINA', 'mate']];
  items.forEach(([a, b], i) => {
    const y = 600 + i * 118;
    ctx.textAlign = 'left'; ctx.fillStyle = C.gold; ctx.font = `800 54px ${T.FONT_SANS}`; ctx.fillText(a, 90, y);
    ctx.fillStyle = '#DDE8EE'; ctx.font = `400 34px ${T.FONT_MONO}`; ctx.fillText(b, 90, y + 46);
  });
  ctx.textAlign = 'center'; ctx.fillStyle = C.ice; ctx.font = `500 38px ${T.FONT_MONO}`; ctx.fillText('+ PIZZA · PANINI · WAFFLES', 512, 1470);
  return T.toTexture(c, { wrap: false });
}

function stripTexture(text, sub = '') {
  return T.labelTexture({ w: 1024, h: 128, bg: C.tealDeep, lines: [{ text, size: 56, weight: 800, spacing: 0.16, y: sub ? 0.38 : 0.5, color: C.cream }].concat(sub ? [{ text: sub, font: T.FONT_MONO, size: 28, weight: 500, spacing: 0.1, y: 0.8, color: C.gold }] : []) });
}

function storyTexture() {
  const c = T.makeCanvas(1024, 1280), ctx = c.getContext('2d');
  ctx.fillStyle = C.teal; ctx.fillRect(0, 0, 1024, 1280);
  ctx.drawImage(emblemCanvas(420), 302, 40);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = C.cream; ctx.font = `800 84px ${T.FONT_SANS}`; ctx.fillText('N.KONYUKHOV', 512, 540);
  ctx.fillStyle = C.gold; ctx.font = `600 44px ${T.FONT_SANS}`; ctx.fillText('Around the world', 512, 610);
  ctx.fillStyle = '#EAF2F6'; ctx.font = `500 46px ${T.FONT_SANS}`;
  ['“I drank coffee under snowy peaks,', 'in the jungle and on the ocean shore.', 'Every cup is a story.', 'I gathered the most honest flavours', 'to share them with you.”'].forEach((l, i) => ctx.fillText(l, 512, 760 + i * 72));
  ctx.fillStyle = C.ice; ctx.font = `500 34px ${T.FONT_MONO}`; ctx.fillText('OPEN DAILY 9:00 – 18:00', 512, 1180);
  return T.toTexture(c, { wrap: false });
}

// ---------------- props ----------------
function barrelTable(M, K) {
  const g = new THREE.Group();
  const prof = [[0, 0], [0.29, 0], [0.33, 0.22], [0.35, 0.47], [0.33, 0.72], [0.29, 0.95], [0, 0.95]].map(([r, y]) => new THREE.Vector2(r, y));
  place(g, new THREE.LatheGeometry(prof, 24), K.woodPlain, {});
  for (const [y, r] of [[0.12, 0.315], [0.47, 0.352], [0.82, 0.315]]) place(g, new THREE.TorusGeometry(r, 0.012, 6, 32).rotateX(Math.PI / 2), M.graphite, { p: [0, y, 0], cast: false });
  const top = new THREE.CylinderGeometry(0.46, 0.46, 0.05, 32); boxUV(top);
  place(g, top, K.wood, { p: [0, 0.975, 0] });
  place(g, new THREE.CylinderGeometry(0.04, 0.034, 0.09, 14), M.white, { p: [0.12, 1.045, 0.08], cast: false });
  return g;
}

function bench(M, K, L = 1.8) {
  const g = new THREE.Group();
  for (const x of [-L / 2 + 0.15, L / 2 - 0.15]) {
    place(g, new THREE.BoxGeometry(0.08, 0.44, 0.48), M.aluDark, { p: [x, 0.22, 0] });
    place(g, new THREE.BoxGeometry(0.06, 0.5, 0.06), M.aluDark, { p: [x, 0.68, -0.24], r: [-0.12, 0, 0] });
  }
  for (let i = 0; i < 4; i++) { const s = new THREE.BoxGeometry(L, 0.04, 0.11); boxUV(s); place(g, s, K.wood, { p: [0, 0.46, -0.18 + i * 0.12] }); }
  for (let i = 0; i < 2; i++) { const s = new THREE.BoxGeometry(L, 0.11, 0.035); boxUV(s); place(g, s, K.wood, { p: [0, 0.65 + i * 0.15, -0.27], r: [-0.12, 0, 0] }); }
  return g;
}

function skiRack(M, n = 6) {
  const g = new THREE.Group();
  const len = 3.6;
  for (const x of [-len / 2, len / 2]) place(g, new THREE.BoxGeometry(0.07, 1.2, 0.07), M.aluDark, { p: [x, 0.6, 0] });
  place(g, new THREE.CylinderGeometry(0.03, 0.03, len, 10), M.alu, { p: [0, 1.15, 0], r: [0, 0, Math.PI / 2] });
  place(g, new THREE.BoxGeometry(len, 0.05, 0.3), M.aluDark, { p: [0, 0.06, 0.25] });
  for (let k = 0; k < 14; k++) place(g, new THREE.BoxGeometry(0.02, 0.1, 0.24), M.aluDark, { p: [-len / 2 + 0.2 + k * 0.25, 0.12, 0.25], cast: false });
  const colors = [M.orange, M.gold, M.deep, M.lunar, M.mars, M.white, M.orange, M.deep];
  const r = rng(5);
  for (let i = 0; i < n; i++) {
    const x = -len / 2 + 0.3 + i * ((len - 0.8) / n);
    const mat = colors[i % colors.length];
    for (const dx of [-0.05, 0.05]) {
      const ski = new THREE.Mesh(new THREE.BoxGeometry(0.085, 1.7, 0.018), mat);
      ski.position.set(x + dx, 0.88, 0.16); ski.rotation.set(-0.16, 0, (r() - 0.5) * 0.06); ski.castShadow = true; g.add(ski);
    }
  }
  for (let i = 0; i < 3; i++) {
    const b = new THREE.Mesh(roundedBox(0.28, 1.52, 0.02, 0.12), colors[(i + 3) % colors.length]);
    b.position.set(len / 2 - 0.4 - i * 0.36, 0.82, 0.2); b.rotation.set(-0.18, 0, 0); b.castShadow = true; g.add(b);
  }
  return g;
}

function patioHeater(M, K) {
  const g = new THREE.Group();
  place(g, new THREE.CylinderGeometry(0.28, 0.32, 0.12, 20), M.aluDark, { p: [0, 0.06, 0] });
  place(g, new THREE.CylinderGeometry(0.05, 0.05, 1.5, 10), M.steel, { p: [0, 0.85, 0] });
  place(g, new THREE.CylinderGeometry(0.09, 0.09, 0.7, 14, 1, true), M.glass, { p: [0, 1.95, 0], cast: false, receive: false });
  place(g, new THREE.CylinderGeometry(0.035, 0.035, 0.66, 10), K.flame, { p: [0, 1.95, 0], cast: false });
  place(g, new THREE.ConeGeometry(0.42, 0.22, 24, 1, true), M.steel, { p: [0, 2.42, 0], r: [Math.PI, 0, 0] });
  return g;
}

function aBoard(M, tex) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 });
  for (const s of [-1, 1]) {
    const p = new THREE.Group(); p.rotation.x = s * 0.2; p.position.set(0, 0, 0); g.add(p);
    place(p, new THREE.BoxGeometry(0.7, 1.05, 0.025), M.graphite, { p: [0, 0.52, s * 0.02] });
    place(p, new THREE.PlaneGeometry(0.62, 0.93), mat, { p: [0, 0.54, s * 0.034], r: [0, s > 0 ? 0 : Math.PI, 0], cast: false });
  }
  return g;
}

function coffeeKitchenProps(M, K) {
  return {
    kettle() {
      const g = new THREE.Group();
      place(g, new THREE.CylinderGeometry(0.075, 0.09, 0.18, 18), M.steel, { p: [0, 0.09, 0] });
      g.add(new THREE.Mesh(cylinderBetween(V(0.06, 0.1, 0), V(0.17, 0.2, 0), 0.009), M.steel));
      place(g, new THREE.TorusGeometry(0.05, 0.008, 6, 14, Math.PI), M.graphite, { p: [-0.09, 0.13, 0], r: [0, 0, Math.PI / 2] });
      return g;
    },
    dripper() {
      const g = new THREE.Group();
      place(g, new THREE.CylinderGeometry(0.06, 0.06, 0.12, 16), K.glassCarafe, { p: [0, 0.06, 0], cast: false });
      place(g, new THREE.ConeGeometry(0.065, 0.08, 16, 1, true), M.white, { p: [0, 0.16, 0], r: [Math.PI, 0, 0] });
      return g;
    },
    oven() {
      const g = new THREE.Group();
      place(g, roundedBox(0.75, 0.62, 0.68, 0.03), M.steel, { p: [0, 0.31, 0] });
      place(g, new THREE.BoxGeometry(0.5, 0.36, 0.01), M.screenOff, { p: [-0.06, 0.32, 0.345] });
      place(g, new THREE.BoxGeometry(0.46, 0.3, 0.005), K.ovenGlow, { p: [-0.06, 0.32, 0.338], cast: false });
      place(g, new THREE.BoxGeometry(0.12, 0.26, 0.012), M.graphite, { p: [0.28, 0.4, 0.345], cast: false });
      return g;
    },
    press(color = M.graphite) {
      const g = new THREE.Group();
      place(g, roundedBox(0.36, 0.08, 0.32, 0.02), color, { p: [0, 0.04, 0] });
      place(g, roundedBox(0.36, 0.06, 0.32, 0.02), M.steel, { p: [0, 0.12, -0.02], r: [-0.15, 0, 0] });
      place(g, new THREE.BoxGeometry(0.3, 0.02, 0.02), M.graphite, { p: [0, 0.16, 0.16] });
      return g;
    },
    griddle() {
      const g = new THREE.Group();
      place(g, new THREE.BoxGeometry(0.5, 0.12, 0.4), M.steel, { p: [0, 0.06, 0] });
      place(g, new THREE.BoxGeometry(0.46, 0.008, 0.36), M.graphite, { p: [0, 0.124, 0], cast: false });
      for (let i = 0; i < 3; i++) place(g, new THREE.CylinderGeometry(0.055, 0.055, 0.01, 16), K.pancake, { p: [-0.14 + i * 0.14, 0.13, 0], cast: false });
      return g;
    },
    microwave() {
      const g = new THREE.Group();
      place(g, roundedBox(0.48, 0.3, 0.38, 0.02), M.steel, { p: [0, 0.15, 0] });
      place(g, new THREE.BoxGeometry(0.32, 0.2, 0.01), M.screenOff, { p: [-0.05, 0.15, 0.19] });
      return g;
    },
  };
}

// catenary through a and b with sag, as points
function catenary(a, b, sag, n = 24) {
  const pts = [];
  for (let i = 0; i <= n; i++) { const t = i / n; pts.push(a.clone().lerp(b, t).add(V(0, -sag * 4 * t * (1 - t), 0))); }
  return pts;
}

// ---------------- the trailer ----------------
function trailer(M, K, dn, { woodSide, win, door, label, emblem, interior }) {
  const g = new THREE.Group();
  const rW = 0.75, rN = 0.14;
  const rL = woodSide < 0 ? rW : rN, rR = woodSide < 0 ? rN : rW;
  const x0 = -TL / 2, x1 = TL / 2;
  const arc = (cx, cy, r, a0, a1, n = 10) => Array.from({ length: n + 1 }, (_, i) => { const a = a0 + ((a1 - a0) * i) / n; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; });
  const profile = (inset = 0) => {
    const xa = x0 + inset, xb = x1 - inset, top = TH - inset, bot = inset;
    const ra = Math.max(0.02, rL - inset), rb = Math.max(0.02, rR - inset);
    const roof = [...arc(xa + ra, top - ra, ra, Math.PI, Math.PI / 2), ...arc(xb - rb, top - rb, rb, Math.PI / 2, 0)];
    const lower = [[xb, top - rb], [xb, bot], [xa, bot], [xa, top - ra]];
    return { roof, lower, outline: [...roof, [xb, bot], [xa, bot]] };
  };
  const cum = (pts) => { const L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); return L; };
  const sweep = (pts, mat, { inward = false, z0 = -TW / 2, z1 = TW / 2, layer = '', cast = true } = {}) => {
    const smp = profileSampler(pts);
    const tEdges = [...new Set(cum(pts).map((v) => Math.round(v * 1e4) / 1e4))];
    const geo = tileSurface({ sEdges: [z0, z1], tEdges, maxSeg: 0.3, map: corridorMapping(smp, inward), tile: () => 'solid' });
    const m = place(g, geo, mat, { cast });
    if (layer) m.userData.layer = layer;
    return m;
  };
  const shapeOf = (outline, holes = []) => {
    const s = new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x, y)));
    for (const [a, b, c2, d] of holes) { const h = new THREE.Path(); h.moveTo(a, c2); h.lineTo(b, c2); h.lineTo(b, d); h.lineTo(a, d); h.closePath(); s.holes.push(h); }
    return s;
  };
  const outer = profile(0), inner = profile(0.05);
  const winHole = [win[0], win[1], 0.95, 2.0];
  const doorHole = [door[0], door[1], 0.08, 1.95];
  // shell: roof (cutaway layer) + ends/floor, side walls with openings
  sweep(outer.roof, K.paint, { layer: 'roof' });
  sweep(outer.lower, K.paint);
  sweep(inner.roof, M.whiteIn, { inward: true, layer: 'roof', z0: -TW / 2 + 0.05, z1: TW / 2 - 0.05, cast: false });
  sweep(inner.lower, M.whiteIn, { inward: true, z0: -TW / 2 + 0.05, z1: TW / 2 - 0.05, cast: false });
  place(g, new THREE.ShapeGeometry(shapeOf(outer.outline, [winHole])), K.paint, { p: [0, 0, TW / 2] });
  place(g, new THREE.ShapeGeometry(shapeOf(outer.outline, [doorHole])), K.paint, { p: [0, 0, -TW / 2] });
  place(g, new THREE.ShapeGeometry(shapeOf(inner.outline, [winHole])), K.liner, { p: [0, 0, TW / 2 - 0.05], cast: false });
  place(g, new THREE.ShapeGeometry(shapeOf(inner.outline, [doorHole])), K.liner, { p: [0, 0, -TW / 2 + 0.05], cast: false });
  // wood-clad rounded end
  const o = 0.022, xe = woodSide < 0 ? x0 : x1, re = rW;
  const woodPts = woodSide < 0
    ? [[x0 - o, 0], [x0 - o, TH - re], ...arc(x0 + re, TH - re, re + o, Math.PI, Math.PI / 2), [x0 + re + 0.45, TH + o]]
    : [[x1 - re - 0.45, TH + o], ...arc(x1 - re, TH - re, re + o, Math.PI / 2, 0), [x1 + o, TH - re], [x1 + o, 0]];
  sweep(woodPts, K.wood, { z0: -TW / 2 - o, z1: TW / 2 + o });
  const wx = woodSide < 0 ? [x0, x0 + 0.8] : [x1 - 0.8, x1];
  const woodSide2D = woodSide < 0
    ? [[x0, 0], [x0, TH - re], ...arc(x0 + re, TH - re, re, Math.PI, Math.PI / 2), [wx[1], TH], [wx[1], 0]]
    : [[wx[0], 0], [wx[0], TH], ...arc(x1 - re, TH - re, re, Math.PI / 2, 0), [x1, 0]];
  for (const z of [TW / 2 + 0.012, -TW / 2 - 0.012]) place(g, new THREE.ShapeGeometry(shapeOf(woodSide2D)), K.woodDS, { p: [0, 0, z] });
  // aluminium trim along the silhouette
  for (const z of [TW / 2 + 0.016, -TW / 2 - 0.016]) {
    const curve = new THREE.CatmullRomCurve3(outer.outline.map(([x, y]) => V(x, y, z)), true, 'centripetal', 0.2);
    place(g, new THREE.TubeGeometry(curve, 120, 0.016, 5, true), M.alu, { cast: false });
  }
  // serving window: frame, half-open glass, outside ledge, awning with LED and gas struts
  const wcx = (win[0] + win[1]) / 2, ww = win[1] - win[0];
  for (const [w, h, x, y] of [[ww + 0.1, 0.05, wcx, 2.0 + 0.025], [ww + 0.1, 0.05, wcx, 0.95 - 0.025], [0.05, 1.05, win[0] - 0.025, 1.475], [0.05, 1.05, win[1] + 0.025, 1.475]]) place(g, new THREE.BoxGeometry(w, h, 0.12), M.alu, { p: [x, y, TW / 2 - 0.03] });
  place(g, new THREE.BoxGeometry(ww / 2, 1.0, 0.012), M.glass, { p: [win[0] + ww / 4, 1.475, TW / 2 - 0.06], cast: false, receive: false }).renderOrder = 1;
  place(g, new THREE.BoxGeometry(ww + 0.12, 0.04, 0.34), M.steel, { p: [wcx, 0.93, TW / 2 + 0.17] });
  for (const x of [win[0] + 0.1, win[1] - 0.1]) place(g, new THREE.BoxGeometry(0.03, 0.2, 0.25), M.steel, { p: [x, 0.83, TW / 2 + 0.13], r: [0.5, 0, 0], cast: false });
  const awn = new THREE.Group(); awn.position.set(wcx, 2.05, TW / 2 + 0.03); awn.rotation.x = -1.2; g.add(awn);
  place(awn, new THREE.BoxGeometry(ww + 0.25, 1.15, 0.035), K.paint, { p: [0, -0.575, 0.02] });
  place(awn, new THREE.BoxGeometry(ww + 0.27, 0.04, 0.05), M.alu, { p: [0, -1.15, 0.02] });
  place(awn, new THREE.BoxGeometry(ww, 0.02, 0.012), K.festoon, { p: [0, -1.05, -0.01], cast: false });
  awn.updateMatrix();
  for (const sx of [-1, 1]) {
    const tip = V(sx * (ww / 2 - 0.05), -0.62, 0.02).applyMatrix4(awn.matrix);
    g.add(new THREE.Mesh(cylinderBetween(V(wcx + sx * (ww / 2 - 0.05), 1.55, TW / 2 + 0.03), tip, 0.014), M.steel));
  }
  // signage: strip above the window, emblem under it
  place(g, new THREE.PlaneGeometry(Math.min(ww, 2.3), 0.22), screenMaterial(dn, stripTexture(label[0], label[1]), { day: 0.75, night: 1.5 }), { p: [wcx, 2.17, TW / 2 + 0.004], cast: false });
  if (emblem) place(g, new THREE.PlaneGeometry(0.78, 0.78), K.emblemMat, { p: [wcx, 0.47, TW / 2 + 0.004], cast: false });
  // back door: frame, open leaf, steps with handrail
  const dcx = (door[0] + door[1]) / 2, dw = door[1] - door[0];
  for (const [w, h, x, y] of [[dw + 0.1, 0.05, dcx, 1.975], [0.05, 1.9, door[0] - 0.025, 1.0], [0.05, 1.9, door[1] + 0.025, 1.0]]) place(g, new THREE.BoxGeometry(w, h, 0.12), M.alu, { p: [x, y, -TW / 2 + 0.03] });
  const leaf = X.doorLeaf(M, dw - 0.02, 1.88, K.paint);
  const hinge = woodSide < 0 ? door[1] : door[0];
  leaf.position.set(hinge, 0.06, -TW / 2 - 0.03); leaf.rotation.y = woodSide < 0 ? 1.9 : 1.25; g.add(leaf); // opens outwards
  for (const [y, z] of [[0, -TW / 2 - 0.18], [-0.24, -TW / 2 - 0.46], [-0.48, -TW / 2 - 0.74]]) place(g, new THREE.BoxGeometry(dw + 0.1, 0.04, 0.3), M.aluSatin, { p: [dcx, y - 0.02, z] });
  for (const x of [door[0] - 0.06, door[1] + 0.06]) place(g, new THREE.BoxGeometry(0.04, FLOOR, 0.9), M.aluDark, { p: [x, -FLOOR / 2, -TW / 2 - 0.47] });
  g.add(new THREE.Mesh(cylinderBetween(V(door[1] + 0.06, 0.95, -TW / 2 - 0.05), V(door[1] + 0.06, 0.2, -TW / 2 - 0.85), 0.018), M.alu));
  // chassis: rails, two axles, wheels, stabilisers, drawbar
  for (const z of [-0.75, 0.75]) place(g, new THREE.BoxGeometry(TL - 0.3, 0.12, 0.1), M.graphite, { p: [0, -0.07, z] });
  const axC = woodSide * 0.25;
  for (const ax of [axC - 0.42, axC + 0.42]) {
    place(g, new THREE.CylinderGeometry(0.035, 0.035, 2.05, 8), M.graphite, { p: [ax, 0.33 - FLOOR, 0], r: [Math.PI / 2, 0, 0], cast: false });
    for (const z of [-0.98, 0.98]) {
      place(g, new THREE.CylinderGeometry(0.33, 0.33, 0.2, 22), M.rubber, { p: [ax, 0.33 - FLOOR, z], r: [Math.PI / 2, 0, 0] });
      place(g, new THREE.CylinderGeometry(0.19, 0.19, 0.21, 16), M.aluSatin, { p: [ax, 0.33 - FLOOR, z], r: [Math.PI / 2, 0, 0], cast: false });
    }
  }
  for (const sx of [-1, 1]) for (const z of [-1.0, 1.0]) {
    place(g, new THREE.BoxGeometry(0.07, FLOOR, 0.07), M.aluDark, { p: [sx * 1.72, -FLOOR / 2, z] });
    place(g, new THREE.BoxGeometry(0.26, 0.02, 0.26), M.aluDark, { p: [sx * 1.72, -FLOOR + 0.01, z], cast: false });
  }
  const xin = woodSide < 0 ? x1 : x0, dirIn = woodSide < 0 ? 1 : -1;
  for (const z of [-0.6, 0.6]) g.add(new THREE.Mesh(cylinderBetween(V(xin - dirIn * 0.3, -0.1, z), V(xin + dirIn * 0.16, -0.25, 0), 0.035), M.graphite));
  place(g, new THREE.CylinderGeometry(0.03, 0.03, 0.5, 8), M.alu, { p: [xin + dirIn * 0.1, -0.5, 0.08], cast: false });
  // interior: vinyl floor, counters, LED ceiling strip
  const fl = new THREE.BoxGeometry(TL - 0.12, 0.03, TW - 0.12); boxUV(fl);
  place(g, fl, K.vinyl, { p: [0, 0.015, 0], cast: false });
  place(g, new THREE.BoxGeometry(TL - 1.2, 0.012, 0.1), M.ledWhite, { p: [0, TH - 0.07, 0], cast: false }).userData.layer = 'roof';
  interior(g);
  g.userData.walls = { x0, x1, door };
  return g;
}

export async function buildKonyukhov({ renderer, quality, progress = () => {} }) {
  const base = createStationBase(renderer, quality, {
    sky: SKY,
    fog: { day: 0.0016, night: 0.0022, dayColor: SKY.fog.day },
    sun: { day: 2.7, night: 0.38, dayColor: '#FFF0D8', nightColor: '#A9BCE6', dist: 70, shadowSize: 24, center: [0, 0, 2.5] },
    hemi: { day: 0.62, night: 0.2, daySky: '#CFE3F7', dayGround: '#EEF2F6', nightSky: '#1B2A44', nightGround: '#141A24' },
    env: { day: 0.75, night: 0.4 },
  });
  const { scene, dn } = base;
  const M = createMaterials(dn, { interiorEnv: 0.45 });
  const world = new THREE.Group(); world.name = 'STATION_03_N_KONYUKHOV'; scene.add(world);
  const fx = new THREE.Group(); fx.userData.noExport = true; scene.add(fx);
  const col = new Colliders();
  const tf = makeTerrainFn();
  const { H } = tf;
  progress(0.1);

  // ---------- station materials ----------
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const wood = T.woodTextures({ base: '#9A6A42' });
  const rep = (t, m) => { const c = t.clone(); c.repeat.set(1 / m, 1 / m); c.needsUpdate = true; return c; };
  const K = {
    paint: std({ name: 'truck-teal', color: C.teal, roughness: 0.42, metalness: 0.15, side: THREE.DoubleSide }),
    liner: std({ name: 'truck-liner', color: '#E4E8EB', roughness: 0.45, side: THREE.DoubleSide, envMapIntensity: 0.3 }),
    wood: std({ name: 'thermowood', map: rep(wood.map, wood.meters), normalMap: rep(wood.normalMap, wood.meters), roughness: 0.78 }),
    woodPlain: std({ name: 'barrel-wood', color: '#8A5A36', roughness: 0.75 }),
    vinyl: std({ name: 'truck-vinyl', color: '#9AA1A8', roughness: 0.55, envMapIntensity: 0.4 }),
    glassCarafe: std({ name: 'carafe', color: '#B9C9D6', roughness: 0.05, transparent: true, opacity: 0.45 }),
    pancake: std({ name: 'pancake', color: '#C98C4B', roughness: 0.8 }),
    ovenGlow: std({ name: 'oven-glow', color: '#1a0a00', emissive: '#FF8A3A', emissiveIntensity: 1.4 }),
    flame: std({ name: 'heater-flame', color: '#2a0a00', emissive: '#FF6A1A', emissiveIntensity: 2.5 }),
    festoon: std({ name: 'festoon', color: '#2a1a0a', emissive: '#FFC57A', emissiveIntensity: 0.6 }),
    snow: null,
  };
  K.woodDS = K.wood.clone(); K.woodDS.side = THREE.DoubleSide; K.woodDS.name = 'thermowood-ds';
  dn.prop(K.flame, 'emissiveIntensity', 2.2, 5.5);
  dn.prop(K.festoon, 'emissiveIntensity', 0.5, 6.5);
  K.emblemMat = std({ name: 'emblem', map: T.toTexture(emblemCanvas(512), { wrap: false }), transparent: true, alphaTest: 0.3, roughness: 0.5, emissive: '#F7E3A3', emissiveMap: null });
  dn.prop(K.emblemMat, 'emissiveIntensity', 0.0, 0.25);
  const snowTex = T.snowTextures();
  K.snow = std({ name: 'snow', color: '#FFFFFF', map: rep(snowTex.map, snowTex.meters), normalMap: rep(snowTex.normalMap, snowTex.meters), normalScale: new THREE.Vector2(0.5, 0.5), roughness: 0.82 });
  const kp = coffeeKitchenProps(M, K);

  // ---------- terrain ----------
  const terrainMat = std({ name: 'snow-terrain', vertexColors: true, map: snowTex.map, normalMap: snowTex.normalMap, normalScale: new THREE.Vector2(0.45, 0.45), roughness: 0.84 });
  const terrain = new THREE.Mesh(buildTerrain(tf, quality), terrainMat);
  terrain.name = 'terrain_solnechnaya_dolina';
  terrain.receiveShadow = true;
  terrain.userData.noMerge = true;
  world.add(terrain);
  progress(0.3);

  // ================= FOOD TRUCKS =================
  const trucks = new THREE.Group(); trucks.name = 'food_trucks'; world.add(trucks);
  const bar = trailer(M, K, dn, {
    woodSide: -1, win: [-1.1, 1.3], door: [1.0, 1.75], label: ['COFFEE AROUND THE WORLD', 'ETHIOPIA · TURKEY · VIETNAM · ITALY · AUSTRALIA'], emblem: true,
    interior(g) {
      // front counter (window side) with the filter station; back counter with espresso, grinders, sink, milk fridge
      const fc = new THREE.BoxGeometry(2.35, 0.9, 0.58); boxUV(fc);
      place(g, fc, M.steel, { p: [0.05, 0.45, 0.85] });
      place(g, new THREE.BoxGeometry(2.4, 0.03, 0.62), M.stoneTop, { p: [0.05, 0.915, 0.85] });
      const bc = new THREE.BoxGeometry(2.6, 0.9, 0.58); boxUV(bc);
      place(g, bc, M.steel, { p: [-0.55, 0.45, -0.86] });
      place(g, new THREE.BoxGeometry(2.65, 0.03, 0.62), M.stoneTop, { p: [-0.55, 0.915, -0.86] });
      const cm = P.coffeeMachine(M); cm.position.set(-0.3, 0.93, -0.88); g.add(cm);
      const g1 = P.grinder(M); g1.position.set(0.35, 0.93, -0.9); g.add(g1);
      const g2 = P.grinder(M); g2.position.set(-1.0, 0.93, -0.9); g.add(g2);
      const sk = X.counterSink(M, 0.36, 0.3); sk.position.set(-1.5, 0.93, -0.82); g.add(sk);
      for (const x of [-0.6, -0.2]) { const k = kp.kettle(); k.position.set(x, 0.93, 0.85); g.add(k); }
      for (const x of [0.25, 0.55, 0.85]) { const d = kp.dripper(); d.position.set(x, 0.93, 0.85); g.add(d); }
      const mf = X.fridgeTall(M, { w: 0.6, h: 0.82, d: 0.04, doors: 1 }); mf.position.set(-0.6, 0.02, -0.55); g.add(mf);
      const bf = X.glassFridge(M, { w: 0.6, h: 1.9, d: 0.56, shelves: 4, label: true }); bf.position.set(1.62, 0.02, 0.86); bf.rotation.y = Math.PI; g.add(bf);
      const hw = X.exhaustValve(M, 0.09); hw.position.set(-0.8, TH - 0.06, 0); g.add(hw);
    },
  });
  bar.position.set(AX, FLOOR, 0); trucks.add(bar);
  const kitchen = trailer(M, K, dn, {
    woodSide: 1, win: [-1.3, 1.1], door: [-1.75, -1.0], label: ['KITCHEN', 'PIZZA · PANINI · HOT DOGS · WAFFLES · PANCAKES'], emblem: false,
    interior(g) {
      const fc = new THREE.BoxGeometry(2.6, 0.9, 0.58); boxUV(fc);
      place(g, fc, M.steel, { p: [-0.25, 0.45, 0.85] });
      place(g, new THREE.BoxGeometry(2.65, 0.03, 0.62), M.stoneTop, { p: [-0.25, 0.915, 0.85] });
      const bc = new THREE.BoxGeometry(2.75, 0.9, 0.58); boxUV(bc);
      place(g, bc, M.steel, { p: [0.47, 0.45, -0.86] });
      place(g, new THREE.BoxGeometry(2.8, 0.03, 0.62), M.stoneTop, { p: [0.47, 0.915, -0.86] });
      const ov = kp.oven(); ov.position.set(1.25, 0.93, -0.84); g.add(ov);
      const pp = kp.press(); pp.position.set(0.5, 0.93, -0.88); g.add(pp);
      const wf = kp.press(M.orange); wf.position.set(0.05, 0.93, -0.88); g.add(wf);
      const gr = kp.griddle(); gr.position.set(-0.45, 0.93, -0.86); g.add(gr);
      const mw = kp.microwave(); mw.position.set(0.75, 0.93, 0.88); mw.rotation.y = Math.PI; g.add(mw);
      const sk = X.counterSink(M, 0.36, 0.3); sk.position.set(-0.75, 0.93, 0.82); sk.rotation.y = Math.PI; g.add(sk);
      place(g, roundedBox(1.9, 0.32, 0.55, 0.04), M.steel, { p: [0.45, TH - 0.36, -0.88] }); // hood
      place(g, new THREE.BoxGeometry(0.28, 0.25, 0.28), M.steel, { p: [0.45, TH - 0.08, -0.88] }).userData.layer = 'roof';
      for (let i = 0; i < 3; i++) place(g, new THREE.CylinderGeometry(0.16, 0.16, 0.012, 24), K.pancake, { p: [-1.2 + i * 0.36, 0.935, 0.85], cast: false });
      const fz = X.fridgeTall(M, { w: 0.62, h: 0.82, d: 0.04, doors: 2 }); fz.position.set(-0.2, 0.02, 0.55); fz.rotation.y = Math.PI; g.add(fz);
      const ext = X.extinguisher(M); ext.position.set(1.85, -0.3, 0.2); ext.rotation.y = -Math.PI / 2; ext.scale.setScalar(0.9); g.add(ext);
    },
  });
  kitchen.position.set(BX, FLOOR, 0); trucks.add(kitchen);
  // coupling: bellows + roof flashing, brand lightbox on posts, AC unit and roof vent
  for (let i = 0; i < 6; i++) place(trucks, new THREE.BoxGeometry(GAP + 0.02, 2.0, 0.05), M.graphite, { p: [0, FLOOR + 1.1, -0.95 + i * 0.38] });
  place(trucks, new THREE.BoxGeometry(GAP + 0.04, 2.02, 2.1), M.rubber, { p: [0, FLOOR + 1.1, 0] });
  place(trucks, new THREE.BoxGeometry(0.7, 0.05, TW + 0.08), M.aluDark, { p: [0, FLOOR + TH + 0.02, 0] }).userData.layer = 'roof';
  const signMat = screenMaterial(dn, brandSignTexture(), { day: 0.9, night: 1.6 });
  const sign = new THREE.Group(); sign.position.set(0, FLOOR + TH + 0.62, 0.35); trucks.add(sign);
  place(sign, roundedBox(4.5, 0.86, 0.26, 0.06), M.graphite, {});
  place(sign, new THREE.PlaneGeometry(4.36, 0.78), signMat, { p: [0, 0, 0.132], cast: false });
  place(sign, new THREE.PlaneGeometry(4.36, 0.78), signMat, { p: [0, 0, -0.132], r: [0, Math.PI, 0], cast: false });
  for (const x of [-1.6, 1.6]) place(trucks, new THREE.BoxGeometry(0.06, 0.4, 0.06), M.aluDark, { p: [x, FLOOR + TH + 0.12, 0.35] });
  sign.traverse((o) => { o.userData.layer = 'roof'; });
  const ac = X.hvacUnit(M, { w: 0.9, h: 0.32, d: 0.7, fans: 1, label: 'AC' }); ac.position.set(AX + 0.6, FLOOR + TH, -0.4); ac.traverse((o) => { o.userData.layer = 'roof'; }); trucks.add(ac);
  const rv = X.roofVent(M, 0.16); rv.position.set(BX + 0.45, FLOOR + TH, -0.88); rv.traverse((o) => { o.userData.layer = 'roof'; }); trucks.add(rv);
  // snow drifts around the wheels
  for (const [x, z, sx, sz] of [[AX + 0.3, 1.25, 1.4, 0.5], [BX - 0.2, 1.25, 1.6, 0.5], [AX - 1.6, -1.3, 1.2, 0.6], [BX + 1.4, -1.3, 1.3, 0.6], [-4.4, 0.5, 0.5, 1.0], [4.4, -0.4, 0.5, 1.1]]) {
    place(world, new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), K.snow, { p: [x, -0.02, z], s: [sx, 0.22, sz] });
  }
  // interior lights
  const lA = new THREE.PointLight('#FFE6C8', 3.5, 5, 2); lA.position.set(AX, FLOOR + 2.0, 0);
  const lB = new THREE.PointLight('#FFE6C8', 3.5, 5, 2); lB.position.set(BX, FLOOR + 2.0, 0);
  scene.add(lA, lB);
  dn.prop(lA, 'intensity', 1.8, 3.2); dn.prop(lB, 'intensity', 1.8, 3.2);
  progress(0.5);

  // ================= DECK & AMENITIES =================
  const am = new THREE.Group(); am.name = 'deck_amenities'; world.add(am);
  const deckG = new THREE.BoxGeometry(DECK.x1 - DECK.x0, DECK.h, DECK.z1 - DECK.z0); boxUV(deckG);
  place(am, deckG, K.wood, { p: [(DECK.x0 + DECK.x1) / 2, DECK.h / 2, (DECK.z0 + DECK.z1) / 2] });
  const tables = [[-2.8, 3.6], [0, 4.4], [2.8, 3.6], [-1.4, 6.1], [1.6, 6.2]];
  for (const [x, z] of tables) { const t = barrelTable(M, K); t.position.set(x, DECK.h, z); am.add(t); col.circle(x, z, 0.5); }
  for (const [x, z, ry] of [[-5.0, 4.4, Math.PI / 2], [5.0, 4.4, -Math.PI / 2]]) { const b = bench(M, K, 1.9); b.position.set(x, DECK.h, z); b.rotation.y = ry; am.add(b); col.box(x - 0.3, x + 0.3, z - 0.95, z + 0.95); }
  for (const [x, z] of [[-4.6, 6.8], [4.6, 6.8]]) { const h = patioHeater(M, K); h.position.set(x, DECK.h, z); am.add(h); col.circle(x, z, 0.32); }
  const rack = skiRack(M, 6); rack.position.set(7.6, 0, 4.4); rack.rotation.y = -Math.PI / 2; am.add(rack);
  col.box(7.3, 8.0, 2.5, 6.3);
  const ab = aBoard(M, menuBoardTexture()); ab.position.set(-2.2, DECK.h, 7.0); ab.rotation.y = 0.25; am.add(ab);
  col.circle(-2.2, 7.0, 0.4);
  // story board with the founder's words
  const sb = new THREE.Group(); sb.position.set(-7.7, 0, 3.6); sb.rotation.y = Math.PI / 2 - 0.35; am.add(sb);
  for (const x of [-0.7, 0.7]) place(sb, new THREE.BoxGeometry(0.07, 2.4, 0.07), M.aluDark, { p: [x, 1.2, 0] });
  place(sb, roundedBox(1.5, 1.9, 0.06, 0.03), M.graphite, { p: [0, 1.45, 0] });
  place(sb, new THREE.PlaneGeometry(1.42, 1.78), screenMaterial(dn, storyTexture(), { day: 0.7, night: 1.2 }), { p: [0, 1.45, 0.032], cast: false });
  col.circle(-7.7, 3.6, 0.85);
  // festoon lights: wooden poles + catenary wires + bulbs (instanced)
  const poles = [[-5.4, 7.3], [5.4, 7.3], [-5.4, 1.5], [5.4, 1.5]];
  for (const [x, z] of poles) { place(am, new THREE.CylinderGeometry(0.06, 0.08, 3.3, 10), K.woodPlain, { p: [x, DECK.h + 1.65, z] }); col.circle(x, z, 0.12); }
  const top = (x, z) => V(x, DECK.h + 3.2, z);
  const roofEdge = (x) => V(x, FLOOR + TH + 0.05, TW / 2 + 0.05);
  const wires = [
    catenary(top(-5.4, 7.3), top(5.4, 7.3), 0.45),
    catenary(roofEdge(-3.6), top(-5.4, 7.3), 0.4),
    catenary(roofEdge(3.6), top(5.4, 7.3), 0.4),
    catenary(roofEdge(-1.2), top(0.2, 7.3).add(V(0, -0.45, 0)), 0.35),
    catenary(roofEdge(1.2), top(0.2, 7.3).add(V(0, -0.45, 0)), 0.35),
    catenary(top(-5.4, 1.5), top(-5.4, 7.3), 0.3),
    catenary(top(5.4, 1.5), top(5.4, 7.3), 0.3),
  ];
  const bulbPos = [];
  for (const w of wires) {
    place(am, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(w), 40, 0.006, 4), M.graphite, { cast: false });
    const curve = new THREE.CatmullRomCurve3(w);
    const len = curve.getLength(), nB = Math.floor(len / 0.55);
    for (let i = 1; i < nB; i++) bulbPos.push(curve.getPointAt(i / nB).add(V(0, -0.06, 0)));
  }
  const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.045, 10, 8), K.festoon, bulbPos.length);
  bulbPos.forEach((p, i) => bulbs.setMatrixAt(i, new THREE.Matrix4().makeTranslation(p.x, p.y, p.z)));
  bulbs.name = 'festoon_bulbs';
  am.add(bulbs);
  const deckLight = new THREE.PointLight('#FFC88E', 0, 13, 2); deckLight.position.set(0, 3.1, 4.6);
  scene.add(deckLight); dn.prop(deckLight, 'intensity', 0, 7);
  const poolDeck = lightPoolMaterial(dn, '#FFB46B', 0, 0.3);
  place(fx, new THREE.PlaneGeometry(12, 7), poolDeck, { p: [0, DECK.h + 0.02, 4.4], r: [-Math.PI / 2, 0, 0], cast: false, receive: false });
  const csm = contactShadowMaterial(0.35);
  for (const [x, z] of tables) place(fx, new THREE.PlaneGeometry(1.4, 1.4), csm, { p: [x, DECK.h + 0.004, z], r: [-Math.PI / 2, 0, 0], cast: false, receive: false });
  place(fx, new THREE.PlaneGeometry(9.2, 3.6), csm, { p: [0, 0.01, 0], r: [-Math.PI / 2, 0, 0], cast: false, receive: false });
  progress(0.6);

  // ================= SLOPE: forest, runs, chairlift, floodlights =================
  const env = new THREE.Group(); env.name = 'ski_resort'; world.add(env);
  // conifers
  const cg = coniferGeometry();
  const coniferMat = std({ name: 'conifer', vertexColors: true, roughness: 0.9 });
  const nTrees = Math.round(1400 * (quality.tier === 'high' ? 1 : quality.tier === 'mid' ? 0.65 : 0.4));
  const trees = new THREE.InstancedMesh(cg, coniferMat, nTrees);
  const rT = rng(44), nF = createNoise2D(31);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = V();
  let ti = 0;
  for (let tries = 0; tries < nTrees * 8 && ti < nTrees; tries++) {
    const x = (rT() - 0.5) * 760, z = -440 + rT() * 560;
    const r = Math.hypot(x, z - 6);
    if (r < 34 || (z > 10 && z < 34 && Math.abs(x) < 26)) continue;
    if (z < -14 && tf.runDist(x, z) < 22) continue;
    if (tf.liftDist(x, z) < 10) continue;
    if (fbm(nF, x * 0.006, z * 0.006, 4) < -0.12 && r > 60) continue;
    const s = 0.75 + rT() * 0.9;
    q.setFromAxisAngle(V(0, 1, 0), rT() * 6.28);
    sc.set(s, s * (0.9 + rT() * 0.3), s);
    m4.compose(V(x, H(x, z) - 0.2, z), q, sc);
    trees.setMatrixAt(ti++, m4);
    if (r < 80) col.circle(x, z, 0.45 * s);
  }
  trees.count = ti;
  trees.castShadow = true; trees.receiveShadow = true; trees.name = 'conifers';
  trees.computeBoundingSphere();
  env.add(trees);
  // chairlift: towers, cables, chairs, stations
  const L = tf.LIFT;
  const dir = V().subVectors(L.b, L.a).setY(0).normalize();
  const perp = V(dir.z, 0, -dir.x);
  const rotY = Math.atan2(dir.x, dir.z);
  const towerParts = [new THREE.CylinderGeometry(0.22, 0.32, 11, 10).translate(0, 5.5, 0), new THREE.BoxGeometry(6, 0.35, 0.35).translate(0, 11, 0)];
  for (const sx of [-2.6, 2.6]) towerParts.push(new THREE.BoxGeometry(0.5, 0.4, 1.4).translate(sx, 10.7, 0));
  const towerGeo = mergeGeometries(towerParts);
  const liftMat = std({ name: 'lift-steel', color: '#5B6B82', metalness: 0.6, roughness: 0.45 });
  const nTow = 16;
  const towers = new THREE.InstancedMesh(towerGeo, liftMat, nTow);
  const towerTops = [];
  for (let i = 0; i < nTow; i++) {
    const t = 0.05 + (i / (nTow - 1)) * 0.9;
    const p = V().lerpVectors(L.a, L.b, t); p.y = H(p.x, p.z);
    m4.compose(p, new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), rotY), V(1, 1, 1));
    towers.setMatrixAt(i, m4);
    towerTops.push(p.clone().add(V(0, 10.75, 0)));
  }
  towers.castShadow = true; towers.name = 'chairlift_towers'; towers.computeBoundingSphere();
  env.add(towers);
  const stA = L.a.clone(); stA.y = H(stA.x, stA.z); const stB = L.b.clone(); stB.y = H(stB.x, stB.z);
  const ends = [stA.clone().add(V(0, 10.75, 0)), ...towerTops, stB.clone().add(V(0, 10.75, 0))];
  const cables = [];
  for (const sx of [-2.6, 2.6]) for (let i = 0; i < ends.length - 1; i++) {
    const a = ends[i].clone().addScaledVector(perp, sx), b = ends[i + 1].clone().addScaledVector(perp, sx);
    cables.push(cylinderBetween(a, b, 0.04, 0.04, 5));
  }
  place(env, mergeGeometries(cables), M.aluDark, { cast: false });
  cables.forEach((c2) => c2.dispose());
  const chairParts = [new THREE.CylinderGeometry(0.03, 0.03, 1.9, 6).translate(0, -0.95, 0), new THREE.BoxGeometry(1.7, 0.08, 0.5).translate(0, -1.95, 0.05), new THREE.BoxGeometry(1.7, 0.5, 0.06).translate(0, -1.7, -0.2), new THREE.BoxGeometry(1.75, 0.04, 0.04).translate(0, -1.55, 0.35), new THREE.BoxGeometry(0.04, 0.4, 0.04).translate(-0.85, -1.75, 0.25), new THREE.BoxGeometry(0.04, 0.4, 0.04).translate(0.85, -1.75, 0.25)];
  const chairGeo = mergeGeometries(chairParts.map((p) => { p.deleteAttribute('uv'); return p; }));
  const chairSpots = [];
  for (const sx of [-2.6, 2.6]) for (let i = 0; i < ends.length - 1; i++) {
    const a = ends[i].clone().addScaledVector(perp, sx), b = ends[i + 1].clone().addScaledVector(perp, sx);
    const steps = Math.max(1, Math.floor(a.distanceTo(b) / 22));
    for (let k = 0; k < steps; k++) chairSpots.push([V().lerpVectors(a, b, (k + 0.5) / steps), sx]);
  }
  const chairs = new THREE.InstancedMesh(chairGeo, M.graphite, chairSpots.length);
  chairSpots.forEach(([p, sx], i) => { m4.compose(p, new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), rotY + (sx > 0 ? Math.PI : 0)), V(1, 1, 1)); chairs.setMatrixAt(i, m4); });
  chairs.castShadow = true; chairs.name = 'chairlift_chairs'; chairs.computeBoundingSphere();
  env.add(chairs);
  for (const [p, s] of [[stA, 1], [stB, 0.8]]) {
    const st = new THREE.Group(); st.position.copy(p); st.rotation.y = rotY; env.add(st);
    place(st, new THREE.BoxGeometry(9 * s, 4, 7 * s), M.lunar, { p: [0, 2, s === 1 ? -4.5 : 4.5] });
    place(st, new THREE.BoxGeometry(9.6 * s, 0.35, 7.6 * s), K.paint, { p: [0, 4.2, s === 1 ? -4.5 : 4.5] });
    place(st, new THREE.CylinderGeometry(0.5, 0.7, 10.5, 12), liftMat, { p: [0, 5.25, 0] });
    place(st, new THREE.TorusGeometry(2.6, 0.12, 8, 40).rotateX(Math.PI / 2), M.aluDark, { p: [0, 10.75, 0] });
    place(st, new THREE.BoxGeometry(6.2, 0.6, 1.2), liftMat, { p: [0, 10.4, 0] });
  }
  col.box(stA.x - 6, stA.x + 6, stA.z - 2, stA.z + 9);
  const liftSign = T.labelTexture({ w: 1024, h: 192, bg: C.tealDeep, lines: [{ text: 'CHAIRLIFT 1', size: 84, weight: 800, spacing: 0.18, y: 0.42, color: C.cream }, { text: 'RUNS · BLUE · RED · BLACK', font: T.FONT_MONO, size: 34, weight: 500, y: 0.8, color: C.gold }] });
  const lsg = new THREE.Group(); lsg.position.copy(stA).add(V(4.5, 0, 9)); lsg.rotation.y = 0.4; env.add(lsg);
  for (const x of [-1.2, 1.2]) place(lsg, new THREE.BoxGeometry(0.08, 2.6, 0.08), M.aluDark, { p: [x, 1.3, 0] });
  place(lsg, new THREE.PlaneGeometry(2.8, 0.52), screenMaterial(dn, liftSign, { day: 0.8, night: 1.4 }), { p: [0, 2.3, 0.05], cast: false });
  // night-ski floodlights along two runs (+ light pools that lie on the slope)
  const poolSlope = lightPoolMaterial(dn, '#FFE2B0', 0, 0.42);
  const zUp = V(0, 0, 1);
  for (const fr of [tf.runs[0], tf.runs[1]]) for (let z = -50; z > -560; z -= 46) for (const side of [-1, 1]) {
    const x = fr(z) + side * 19, y = H(x, z);
    place(env, new THREE.CylinderGeometry(0.08, 0.12, 9, 8), M.aluDark, { p: [x, y + 4.5, z], cast: false });
    place(env, roundedBox(0.7, 0.2, 0.4, 0.05), M.aluDark, { p: [x - side * 0.3, y + 9.05, z], cast: false });
    place(env, new THREE.BoxGeometry(0.6, 0.02, 0.34), M.lampHead, { p: [x - side * 0.3, y + 8.94, z], cast: false });
    const px = fr(z) + side * 9, py = H(px, z);
    const nrm = V(H(px - 1, z) - H(px + 1, z), 2, H(px, z - 1) - H(px, z + 1)).normalize();
    const pg = new THREE.PlaneGeometry(20, 20); pg.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(zUp, nrm)); pg.translate(px, py + 0.15, z);
    place(fx, pg, poolSlope, { cast: false, receive: false });
  }
  // parking with snow-capped cars, snow banks
  const paints = [M.white, M.graphite, M.deep, M.mars, M.lunar];
  [[-10, 21, 0], [-4.2, 21.5, 1], [2.2, 21, 2], [8.4, 21.4, 3], [-7, 27.5, 4], [5, 27.8, 0]].forEach(([x, z, k], i) => {
    const car = CITY.makeCar(M, paints[k]); car.position.set(x, 0, z); car.rotation.y = Math.PI / 2 + (i % 2 ? 0.05 : -0.04); env.add(car);
    place(env, roundedBox(1.25, 0.08, 1.35, 0.05), K.snow, { p: [x, 1.5, z - 0.2] });
    col.box(x - 1.0, x + 1.0, z - 2.4, z + 2.4);
  });
  for (const [x, z, sx, sy, sz] of [[-18, 16, 4, 1.1, 1.6], [16, 15, 5, 1.3, 1.8], [-24, 4, 2, 0.9, 5], [22, 2, 2.2, 1, 4.5], [0, 33, 9, 1.2, 1.6]]) place(env, new THREE.SphereGeometry(1, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), K.snow, { p: [x, -0.05, z], s: [sx, sy, sz] });
  progress(0.75);

  // ================= PEOPLE =================
  const ppl = new THREE.Group(); ppl.name = 'scale_figures'; world.add(ppl);
  const people = [
    { x: AX - 0.2, y: FLOOR, z: 0.25, rot: 0, pose: 'stand', h: 1.72, palette: { top: ['#F2F2EE'], bottom: ['#1F2A38'] } },
    { x: BX + 0.2, y: FLOOR, z: -0.25, rot: Math.PI, pose: 'stand', h: 1.78, palette: { top: ['#1F2A38'], bottom: ['#1F2A38'] } },
    { x: AX + 0.6, y: DECK.h, z: 2.15, rot: Math.PI, pose: 'stand', h: 1.74, palette: SKI_PALETTE },
    { x: AX - 0.4, y: DECK.h, z: 2.35, rot: Math.PI - 0.2, pose: 'lean', h: 1.66, palette: SKI_PALETTE },
    { x: BX - 0.3, y: DECK.h, z: 2.2, rot: Math.PI, pose: 'stand', h: 1.82, palette: SKI_PALETTE },
    { x: -2.8, y: DECK.h, z: 3.05, rot: 0, pose: 'stand', h: 1.7, palette: SKI_PALETTE },
    { x: -2.25, y: DECK.h, z: 3.95, rot: -2.2, pose: 'stand', h: 1.78, palette: SKI_PALETTE },
    { x: 2.8, y: DECK.h, z: 4.15, rot: Math.PI, pose: 'lean', h: 1.64, palette: SKI_PALETTE },
    { x: 0.45, y: DECK.h, z: 4.9, rot: -2.4, pose: 'stand', h: 1.76, palette: SKI_PALETTE },
    { x: -4.95, y: DECK.h, z: 4.0, rot: Math.PI / 2, pose: 'sit', h: 1.7, palette: SKI_PALETTE },
    { x: 4.95, y: DECK.h, z: 4.8, rot: -Math.PI / 2, pose: 'sit', h: 1.75, palette: SKI_PALETTE },
    { x: 6.8, y: 0, z: 3.4, rot: Math.PI / 2, pose: 'stand', h: 1.8, palette: SKI_PALETTE },
    { x: 6.9, y: 0, z: 5.6, rot: 2.0, pose: 'walk', h: 1.68, palette: SKI_PALETTE },
    { x: -9, y: 0, z: 10, rot: 2.5, pose: 'walk', h: 1.76, palette: SKI_PALETTE },
    { x: 11, y: 0, z: 9, rot: -2.2, pose: 'walk', h: 1.7, palette: SKI_PALETTE },
    { x: -16, y: 0, z: -24, rot: -2.6, pose: 'walk', h: 1.78, palette: SKI_PALETTE },
    { x: -14.5, y: 0, z: -25.5, rot: -2.4, pose: 'stand', h: 1.6, palette: SKI_PALETTE },
  ];
  for (const p of people) addPerson(ppl, M.person, p);

  // ================= collisions for the trucks =================
  for (const [cx, tr] of [[AX, bar], [BX, kitchen]]) {
    const x0 = cx - TL / 2, x1 = cx + TL / 2, d = tr.userData.walls.door;
    col.seg(x0, TW / 2, x1, TW / 2).seg(x0, -TW / 2, x0, TW / 2).seg(x1, -TW / 2, x1, TW / 2);
    col.seg(x0, -TW / 2, cx + d[0], -TW / 2).seg(cx + d[1], -TW / 2, x1, -TW / 2);
  }
  col.box(AX - 1.15, AX + 1.2, 0.56, 1.15).box(AX - 1.85, AX + 0.75, -1.15, -0.56).box(AX + 1.3, AX + 1.95, 0.5, 1.15);
  col.box(BX - 1.55, BX + 1.05, 0.56, 1.15).box(BX - 0.9, BX + 1.85, -1.15, -0.56);
  col.box(-GAP / 2 - 0.01, GAP / 2 + 0.01, -TW / 2, TW / 2);

  // ================= merge =================
  const stats = mergeStatic(world);
  const fxStats = mergeStatic(fx);
  progress(0.92);
  const roofLayer = [];
  world.traverse((o) => { if (o.userData.layer === 'roof') roofLayer.push(o); });

  const Z = ZONES.konyukhov;
  const hotspots = [
    { id: 'truck', pos: [0, FLOOR + TH + 1.35, 0.4], zone: 'out', ...Z.truck },
    { id: 'coffee', pos: [AX + 0.1, FLOOR + 1.55, TW / 2 + 0.5], zone: 'out', ...Z.coffee },
    { id: 'kitchen', pos: [BX - 0.1, FLOOR + 1.55, TW / 2 + 0.5], zone: 'out', ...Z.kitchen },
    { id: 'tables', pos: [0, 1.6, 4.4], zone: 'out', ...Z.tables },
    { id: 'benches', pos: [-5.0, 1.3, 4.4], zone: 'out', ...Z.benches },
    { id: 'skirack', pos: [7.6, 1.7, 4.4], zone: 'out', ...Z.skirack },
    { id: 'heaters', pos: [4.6, 2.8, 6.8], zone: 'out', ...Z.heaters },
    { id: 'story', pos: [-7.7, 2.7, 3.6], zone: 'out', ...Z.story },
    { id: 'lift', pos: [stA.x, stA.y + 12.5, stA.z], zone: 'out', ...Z.lift },
    { id: 'slope', pos: [tf.runs[1](-120), H(tf.runs[1](-120), -120) + 6, -120], zone: 'out', ...Z.slope },
    { id: 'bar', pos: [AX - 0.3, FLOOR + 1.45, -0.6], zone: 'in', ...Z.bar },
    { id: 'galley', pos: [BX + 0.5, FLOOR + 1.45, -0.6], zone: 'in', ...Z.galley },
  ];
  const tour = [
    { pos: [17, 9, 30], look: [0, 2, 0], hold: 1.6, move: 3.0, title: 'STATION 03 · N.KONYUKHOV', text: 'Мобильная кофейня премиум-класса на ГК «Солнечная долина».' },
    { pos: [6.5, 2.6, 11], look: [0, 2.0, 0.8], hold: 2.6, move: 4.0, hotspot: 'truck' },
    { pos: [AX + 0.1, 1.9, 4.6], look: [AX + 0.1, 1.7, 0.8], hold: 2.6, move: 3.0, hotspot: 'coffee' },
    { pos: [BX - 0.1, 1.9, 4.6], look: [BX - 0.1, 1.7, 0.8], hold: 2.6, move: 2.6, hotspot: 'kitchen' },
    { pos: [5.2, 1.8, 7.2], look: [7.8, 0.9, 4.4], hold: 2.4, move: 2.6, hotspot: 'skirack' },
    { pos: [-1.2, 2.5, 9.0], look: [0, 0.9, 4.4], hold: 2.6, move: 2.8, hotspot: 'tables' },
    { pos: [-7.2, 2.4, -0.8], look: [AX + 1.4, 1.4, -2.2], hold: 0.1, move: 3.4 },
    { pos: [AX + 1.4, 1.95, -3.3], look: [AX + 1.4, 1.75, -1.0], hold: 0.2, move: 2.8 },
    { pos: [AX + 0.6, FLOOR + 1.62, -0.15], look: [AX - 0.8, FLOOR + 1.1, -0.9], hold: 2.8, move: 2.4, hotspot: 'bar' },
    { pos: [-4.5, 3.2, 12], look: [-40, 40, -260], hold: 3.2, move: 4.2, hotspot: 'slope' },
  ];
  const plan = {
    bounds: [-9.5, 9.5, -3.5, 9.8],
    draw(ctx, S) {
      const rect = (x0, z0, x1, z1, fill, stroke) => { const a = S(x0, z0), b = S(x1, z1); const x = Math.min(a[0], b[0]), y = Math.min(a[1], b[1]), w = Math.abs(b[0] - a[0]), h = Math.abs(b[1] - a[1]); if (fill) { ctx.fillStyle = fill; ctx.fillRect(x, y, w, h); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h); } };
      rect(DECK.x0, DECK.z0, DECK.x1, DECK.z1, 'rgba(154,106,66,0.35)', 'rgba(154,106,66,0.8)');
      rect(AX - TL / 2, -TW / 2, AX + TL / 2, TW / 2, 'rgba(20,96,124,0.65)', 'rgba(221,227,234,0.9)');
      rect(BX - TL / 2, -TW / 2, BX + TL / 2, TW / 2, 'rgba(20,96,124,0.65)', 'rgba(221,227,234,0.9)');
      ctx.fillStyle = 'rgba(242,194,48,0.85)';
      for (const [x, z] of tables) { const p = S(x, z); ctx.beginPath(); ctx.arc(p[0], p[1], 4, 0, Math.PI * 2); ctx.fill(); }
      rect(-5.3, 3.45, -4.7, 5.35, 'rgba(221,227,234,0.55)', null);
      rect(4.7, 3.45, 5.3, 5.35, 'rgba(221,227,234,0.55)', null);
      rect(7.3, 2.5, 8.0, 6.3, 'rgba(255,106,26,0.6)', null);
    },
    labels: [['BAR', AX, 0], ['KITCHEN', BX, 0], ['DECK', 0, 5.4], ['SKI', 7.65, 1.8], ['STORY', -7.7, 5.0]],
  };

  const station = {
    id: 'konyukhov',
    scene, world, base, dn, M,
    exportRoot: world,
    orbitView: { pos: [8.6, 3.4, 11.8], target: [-0.4, 1.7, 1.6] },
    orbit: { minDistance: 2.5, maxDistance: 240, maxPolar: Math.PI * 0.49 },
    walkSpawn: { pos: [1.2, 0, 13], yaw: 0, pitch: 0.02 },
    doorPath: [
      { pos: [-7.2, 2.4, -0.8], look: [AX + 1.4, 1.4, -2.2], move: 2.6, hold: 0 },
      { pos: [AX + 1.4, 1.95, -3.4], look: [AX + 1.4, 1.75, -1.0], move: 2.4, hold: 0 },
      { pos: [AX + 1.1, FLOOR + 1.62, -0.6], look: [AX - 0.5, FLOOR + 1.2, 0.2], move: 1.8, hold: 0 },
    ],
    // views for zones that are not on the tour (with their own path through the kitchen door)
    zoneViews: {
      galley: {
        pos: [BX - 0.9, FLOOR + 1.62, 0.2], look: [BX + 0.9, FLOOR + 1.2, -0.9],
        path: [
          { pos: [7.2, 2.4, -0.8], look: [BX - 1.4, 1.4, -2.2], move: 2.6, hold: 0 },
          { pos: [BX - 1.4, 1.95, -3.4], look: [BX - 1.4, 1.75, -1.0], move: 2.4, hold: 0 },
        ],
      },
    },
    colliders: col,
    groundAt(x, z) {
      for (const [cx, tr] of [[AX, bar], [BX, kitchen]]) {
        const lx = x - cx, d = tr.userData.walls.door;
        if (Math.abs(lx) < TL / 2 - 0.05 && Math.abs(z) < TW / 2 - 0.02) return FLOOR;
        if (lx > d[0] - 0.1 && lx < d[1] + 0.1 && z < -TW / 2 + 0.05 && z > -TW / 2 - 0.95) return FLOOR * clamp(1 - (-TW / 2 - z) / 0.9, 0, 1);
      }
      if (x > DECK.x0 && x < DECK.x1 && z > DECK.z0 && z < DECK.z1) return DECK.h;
      return H(x, z);
    },
    clampWalk(p) { const r = Math.hypot(p.x, p.z); if (r > 220) { p.x *= 220 / r; p.z *= 220 / r; } if (p.z < -280) p.z = -280; },
    isInside(p) { return Math.abs(p.z) < TW / 2 && ((p.x > AX - TL / 2 && p.x < AX + TL / 2) || (p.x > BX - TL / 2 && p.x < BX + TL / 2)) && p.y < FLOOR + TH + 0.2 && p.y > FLOOR; },
    hotspots, tour, plan,
    occluders: [{ box: new THREE.Box3(new THREE.Vector3(-TL - GAP / 2 + 0.1, FLOOR, -TW / 2 + 0.1), new THREE.Vector3(TL + GAP / 2 - 0.1, FLOOR + TH - 0.1, TW / 2 - 0.1)) }],
    stats: { merged: stats, fx: fxStats },
    setNight: (n) => base.setNight(n),
    setCutaway(on) { roofLayer.forEach((o) => { o.visible = !on; }); renderer.shadowMap.needsUpdate = true; },
    update(dt, t) {
      // heater flames flicker around the day/night level
      K.flame.emissiveIntensity = (2.2 + 3.3 * dn.value) * (1 + 0.06 * Math.sin(t * 11) + 0.04 * Math.sin(t * 23.7));
    },
    dispose() { disposeTree(scene); base.sky.dispose(); clearPeopleCache(); },
  };
  base.setNight(0);
  progress(1);
  return station;
}
