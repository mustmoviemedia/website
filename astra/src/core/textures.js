// Procedural textures drawn on canvas: panels, floors, asphalt, facades, labels.
// Everything is generated at runtime — no downloaded assets.
import * as THREE from 'three';
import { createNoise2D, fbm, rng } from './noise.js';

export const FONT_SANS = 'Manrope, "Segoe UI", system-ui, sans-serif';
export const FONT_MONO = '"IBM Plex Mono", ui-monospace, monospace';

let maxAniso = 4;
export function setMaxAnisotropy(v) { maxAniso = Math.min(8, v || 4); }

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export function toTexture(canvas, { repeat = null, srgb = true, wrap = true, flipY = true } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = maxAniso;
  t.flipY = flipY;
  if (wrap) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (repeat) t.repeat.set(repeat[0], repeat[1]);
  t.needsUpdate = true;
  return t;
}

// Height field (Float32Array, 0..1) → tangent-space normal map canvas
export function normalCanvasFromHeight(hf, w, h, strength = 2) {
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  const d = img.data;
  for (let y = 0; y < h; y++) {
    const ym = ((y - 1 + h) % h) * w, yp = ((y + 1) % h) * w, y0 = y * w;
    for (let x = 0; x < w; x++) {
      const xm = (x - 1 + w) % w, xp = (x + 1) % w;
      const dx = (hf[y0 + xp] - hf[y0 + xm]) * strength;
      const dy = (hf[yp + x] - hf[ym + x]) * strength;
      let nx = -dx, ny = dy, nz = 1;
      const l = Math.hypot(nx, ny, nz);
      nx /= l; ny /= l; nz /= l;
      const i = (y0 + x) * 4;
      d[i] = (nx * 0.5 + 0.5) * 255;
      d[i + 1] = (ny * 0.5 + 0.5) * 255;
      d[i + 2] = (nz * 0.5 + 0.5) * 255;
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function hexToRgb(hex) {
  const c = new THREE.Color(hex);
  return [c.r * 255, c.g * 255, c.b * 255];
}

// Generic: per-pixel color from function, plus height for normal map
function pixelTexture(w, h, fn) {
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  const hf = new Float32Array(w * h);
  const out = [0, 0, 0, 0];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      out[3] = 0.5;
      fn(x, y, out);
      const i = (y * w + x) * 4;
      img.data[i] = out[0];
      img.data[i + 1] = out[1];
      img.data[i + 2] = out[2];
      img.data[i + 3] = 255;
      hf[y * w + x] = out[3];
    }
  }
  ctx.putImageData(img, 0, 0);
  return { canvas: c, hf };
}

// ---------- composite panels (white ISS-like skin) ----------
// Texture covers 2.4 × 1.2 m: two panels 1.2 × 1.2, each split into 0.6 bands, rivets on seams.
export function panelTextures({ size = 512, seed = 3 } = {}) {
  const w = size, h = size / 2;
  const n = createNoise2D(seed);
  const r = rng(seed);
  const tints = Array.from({ length: 8 }, () => 0.94 + r() * 0.06);
  const ppm = w / 2.4;
  const seamW = Math.max(1.5, ppm * 0.012);
  const { canvas, hf } = pixelTexture(w, h, (x, y, o) => {
    const mx = x / ppm, my = y / ppm;
    const px = Math.floor(mx / 0.6), py = Math.floor(my / 0.6);
    const tint = tints[(px * 3 + py * 5) & 7];
    const fx = mx % 0.6, fy = my % 0.6;
    const ex = Math.min(fx, 0.6 - fx) * ppm, ey = Math.min(fy, 0.6 - fy) * ppm;
    const big = Math.min((mx % 1.2), 1.2 - (mx % 1.2)) * ppm;
    let hgt = 0.6;
    let shade = 1;
    const seam = Math.min(ex, ey);
    const majorSeam = Math.min(big, ey);
    const sw = majorSeam < seamW * 1.3 ? seamW * 1.3 : seamW;
    if (seam < sw) { hgt = 0.15 + 0.45 * (seam / sw); shade = 0.72 + 0.28 * (seam / sw); }
    // rivets along seams every 10 cm
    const rx = (mx % 0.1) * ppm - 0.05 * ppm, ry = (my % 0.1) * ppm - 0.05 * ppm;
    const nearV = ex < ppm * 0.03 && ex > seamW, nearH = ey < ppm * 0.03 && ey > seamW;
    if ((nearV && Math.abs(ry) < ppm * 0.006 + 1) || (nearH && Math.abs(rx) < ppm * 0.006 + 1)) {
      const dd = nearV ? Math.abs(ex - ppm * 0.02) : Math.abs(ey - ppm * 0.02);
      if (dd < ppm * 0.007 + 0.6) { hgt = 0.75; shade *= 0.93; }
    }
    const grain = n(x * 0.05, y * 0.05) * 0.015 + n(x * 0.4, y * 0.4) * 0.01;
    const v = (232 * tint + grain * 255) * shade;
    o[0] = v; o[1] = v + 2; o[2] = v + 4;
    o[3] = hgt + grain;
  });
  const normal = normalCanvasFromHeight(hf, w, h, 3.2);
  // roughness: slight variation (G channel)
  const rc = makeCanvas(w, h);
  const rctx = rc.getContext('2d');
  const rimg = rctx.createImageData(w, h);
  for (let i = 0; i < w * h; i++) {
    const v = 120 + (hf[i] - 0.6) * 160 + n((i % w) * 0.02, Math.floor(i / w) * 0.02) * 20;
    rimg.data[i * 4] = rimg.data[i * 4 + 1] = rimg.data[i * 4 + 2] = v;
    rimg.data[i * 4 + 3] = 255;
  }
  rctx.putImageData(rimg, 0, 0);
  return {
    map: toTexture(canvas),
    normalMap: toTexture(normal, { srgb: false }),
    roughnessMap: toTexture(rc, { srgb: false }),
    metersU: 2.4,
    metersV: 1.2,
  };
}

// Interior wall panels (ISS rack look): large 1.2 × 0.8 m panels with soft recessed seams,
// corner fasteners and a faint satin variation. Texture covers 2.4 × 2.4 m.
export function interiorPanelTextures({ size = 1024, seed = 13 } = {}) {
  const w = size, h = size;
  const n = createNoise2D(seed);
  const r = rng(seed);
  const ppm = w / 2.4;
  const tints = Array.from({ length: 12 }, () => 0.965 + r() * 0.035);
  const PW = 1.2, PH = 0.8;
  const { canvas, hf } = pixelTexture(w, h, (x, y, o) => {
    const mx = x / ppm, my = y / ppm;
    const ix = Math.floor(mx / PW), iy = Math.floor(my / PH);
    const fx = mx - ix * PW, fy = my - iy * PH;
    const ex = Math.min(fx, PW - fx) * ppm, ey = Math.min(fy, PH - fy) * ppm;
    const e = Math.min(ex, ey);
    let hgt = 0.62, shade = tints[(ix * 5 + iy * 7) % 12];
    const sw = ppm * 0.012;
    if (e < sw) { const f = e / sw; hgt = 0.2 + 0.42 * f * f; shade *= 0.8 + 0.2 * f; }
    else if (e < sw * 2.2) { hgt = 0.62 + 0.05 * (1 - (e - sw) / (sw * 1.2)); }
    // fasteners near panel corners
    const cx = Math.min(fx, PW - fx), cy = Math.min(fy, PH - fy);
    const dd = Math.hypot(cx - 0.05, cy - 0.05) * ppm;
    if (dd < ppm * 0.009) { hgt = 0.7; shade *= 0.9; }
    const g = n(x * 0.006, y * 0.006) * 0.012 + n(x * 0.2, y * 0.2) * 0.004;
    const v = 238 * (shade + g);
    o[0] = v; o[1] = v + 1; o[2] = v + 3;
    o[3] = hgt + g * 2;
  });
  return { map: toTexture(canvas), normalMap: toTexture(normalCanvasFromHeight(hf, w, h, 2.4), { srgb: false }), meters: 2.4 };
}

// Triangular panel texture for the geodesic dome: seams at triangle edges (uv: (0,0),(1,0),(0.5,1))
export function triPanelTextures(size = 256) {
  const w = size, h = size;
  const n = createNoise2D(11);
  const edge = (x, y) => {
    const u = x / w, v = 1 - y / h;
    // distances to the three edges, scaled so the equilateral panel reads evenly
    const e1 = v * 0.866;
    const e2 = (u * 2 - v) * 0.433;
    const e3 = ((1 - u) * 2 - v) * 0.433;
    return Math.min(e1, e2, e3);
  };
  const { canvas, hf } = pixelTexture(w, h, (x, y, o) => {
    const e = edge(x, y) * w;
    let hgt = 0.7, shade = 1;
    if (e < 5) { hgt = 0.2 + 0.5 * Math.max(0, e) / 5; shade = 0.8 + 0.2 * Math.max(0, e) / 5; }
    if (e > 9 && e < 11) { hgt = 0.62; }
    const g = n(x * 0.04, y * 0.04) * 4;
    const v = (234 + g) * shade;
    o[0] = v; o[1] = v + 1; o[2] = v + 3; o[3] = hgt;
  });
  return { map: toTexture(canvas, { wrap: false }), normalMap: toTexture(normalCanvasFromHeight(hf, w, h, 2.5), { srgb: false, wrap: false }) };
}

// ---------- floors ----------
// Dark composite floor: 0.6 m tiles; texture covers 1.2 m
export function floorTextures({ base = '#1C232D', seed = 5 } = {}) {
  const w = 512, h = 512;
  const n = createNoise2D(seed);
  const [br, bg, bb] = hexToRgb(base);
  const r = rng(seed);
  const t = Array.from({ length: 4 }, () => 0.92 + r() * 0.12);
  const { canvas, hf } = pixelTexture(w, h, (x, y, o) => {
    const fx = x % 256, fy = y % 256;
    const e = Math.min(fx, 256 - fx, fy, 256 - fy);
    const k = t[(x >> 8) + 2 * (y >> 8)];
    let hgt = 0.6, s = k;
    if (e < 2.5) { hgt = 0.2; s *= 0.55; }
    const g = n(x * 0.03, y * 0.03) * 0.06 + n(x * 0.5, y * 0.5) * 0.04;
    o[0] = br * (s + g); o[1] = bg * (s + g); o[2] = bb * (s + g); o[3] = hgt + g * 0.3;
  });
  return { map: toTexture(canvas), normalMap: toTexture(normalCanvasFromHeight(hf, w, h, 2.2), { srgb: false }), meters: 1.2 };
}

export function asphaltTextures() {
  const w = 512;
  const n = createNoise2D(21);
  const r = rng(22);
  const { canvas, hf } = pixelTexture(w, w, (x, y, o) => {
    const a = fbm(n, x * 0.02, y * 0.02, 3) * 0.08;
    const speck = r() < 0.08 ? (r() - 0.4) * 0.25 : 0;
    const v = 52 + (a + speck) * 255 * 0.5;
    o[0] = v; o[1] = v + 1; o[2] = v + 3;
    o[3] = 0.5 + speck + a;
  });
  return { map: toTexture(canvas), normalMap: toTexture(normalCanvasFromHeight(hf, w, w, 1.5), { srgb: false }), meters: 4 };
}

// Concrete pavers, running bond 0.4 × 0.2 m; texture covers 1.6 m
export function paverTextures() {
  const w = 512;
  const n = createNoise2D(31);
  const r = rng(32);
  const ppm = w / 1.6;
  const tints = Array.from({ length: 64 }, () => 0.88 + r() * 0.14);
  const { canvas, hf } = pixelTexture(w, w, (x, y, o) => {
    const my = y / ppm, row = Math.floor(my / 0.2);
    const mx = x / ppm + (row % 2) * 0.2;
    const col = Math.floor(mx / 0.4);
    const fx = (mx % 0.4) * ppm, fy = (my % 0.2) * ppm;
    const e = Math.min(fx, 0.4 * ppm - fx, fy, 0.2 * ppm - fy);
    const k = tints[(col * 7 + row * 13) & 63];
    let s = k, hgt = 0.6;
    if (e < 2) { s *= 0.55; hgt = 0.15; } else if (e < 4) { hgt = 0.5; }
    const g = n(x * 0.08, y * 0.08) * 0.05 + (r() - 0.5) * 0.05;
    o[0] = (178 * (s + g)); o[1] = (172 * (s + g)); o[2] = (162 * (s + g)); o[3] = hgt + g;
  });
  return { map: toTexture(canvas), normalMap: toTexture(normalCanvasFromHeight(hf, w, w, 2), { srgb: false }), meters: 1.6 };
}

export function grassTextures() {
  const w = 512;
  const n = createNoise2D(41);
  const r = rng(42);
  const { canvas, hf } = pixelTexture(w, w, (x, y, o) => {
    const a = fbm(n, x * 0.012, y * 0.012, 4);
    const b = r();
    const g = 0.75 + a * 0.35 + (b - 0.5) * 0.35;
    o[0] = 62 * g; o[1] = 98 * g; o[2] = 44 * g; o[3] = b;
  });
  return { map: toTexture(canvas), normalMap: toTexture(normalCanvasFromHeight(hf, w, w, 0.8), { srgb: false }), meters: 3 };
}

// Ground detail for desert: tiling normal + albedo modulation (grey, multiplied with vertex colors)
export function desertDetailTextures() {
  const w = 512;
  const n = createNoise2D(51);
  const r = rng(52);
  const { canvas, hf } = pixelTexture(w, w, (x, y, o) => {
    const a = fbm(n, x * 0.02, y * 0.02, 4);
    const pebble = n(x * 0.18, y * 0.18);
    const p = pebble > 0.55 ? (pebble - 0.55) * 2 : 0;
    const g = 0.86 + a * 0.18 + (r() - 0.5) * 0.12 - p * 0.25;
    const v = 255 * Math.min(1, g);
    o[0] = v; o[1] = v * 0.98; o[2] = v * 0.96;
    o[3] = 0.5 + a * 0.4 + p * 0.6 + (r() - 0.5) * 0.1;
  });
  return { map: toTexture(canvas), normalMap: toTexture(normalCanvasFromHeight(hf, w, w, 2.2), { srgb: false }), meters: 3 };
}

// ---------- building facades ----------
// Upper floors: stone + dark windows; lit windows on emissive map. Tile = cols × rows windows.
export function facadeTextures({ cols = 10, rows = 5, bayW = 2.2, floorH = 3.3, stone = '#CFC6B6', seed = 61, litRatio = 0.35 } = {}) {
  const ppm = 48;
  const w = THREE.MathUtils.ceilPowerOfTwo(Math.round(cols * bayW * ppm));
  const h = THREE.MathUtils.ceilPowerOfTwo(Math.round(rows * floorH * ppm));
  const sx = w / (cols * bayW), sy = h / (rows * floorH);
  const c = makeCanvas(w, h), ctx = c.getContext('2d');
  const e = makeCanvas(w, h), ectx = e.getContext('2d');
  const r = rng(seed);
  ctx.fillStyle = stone;
  ctx.fillRect(0, 0, w, h);
  // stone grain
  const n = createNoise2D(seed);
  const img = ctx.getImageData(0, 0, w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    const g = n(x * 0.02, y * 0.02) * 10 + (r() - 0.5) * 8;
    img.data[i] += g; img.data[i + 1] += g; img.data[i + 2] += g;
  }
  ctx.putImageData(img, 0, 0);
  ectx.fillStyle = '#000';
  ectx.fillRect(0, 0, w, h);
  for (let fy = 0; fy < rows; fy++) {
    // slab line
    ctx.fillStyle = 'rgba(0,0,0,0.10)';
    ctx.fillRect(0, (fy * floorH) * sy, w, 0.12 * sy);
    for (let fx = 0; fx < cols; fx++) {
      const x0 = (fx * bayW + 0.45) * sx, y0 = (fy * floorH + 0.75) * sy;
      const ww = (bayW - 0.9) * sx, hh = 1.85 * sy;
      ctx.fillStyle = '#9D958A';
      ctx.fillRect(x0 - 0.08 * sx, y0 - 0.08 * sy, ww + 0.16 * sx, hh + 0.2 * sy);
      const grd = ctx.createLinearGradient(0, y0, 0, y0 + hh);
      grd.addColorStop(0, '#2A3442'); grd.addColorStop(1, '#151B24');
      ctx.fillStyle = grd;
      ctx.fillRect(x0, y0, ww, hh);
      ctx.fillStyle = '#6B655D';
      ctx.fillRect(x0 + ww / 2 - 0.03 * sx, y0, 0.06 * sx, hh);
      // sill
      ctx.fillStyle = '#E2DACB';
      ctx.fillRect(x0 - 0.12 * sx, y0 + hh, ww + 0.24 * sx, 0.07 * sy);
      if (r() < litRatio) {
        const warm = r() < 0.75;
        const k = 0.5 + r() * 0.5;
        const col = warm ? `rgba(255,${170 + 40 * k | 0},${90 + 50 * k | 0},1)` : `rgba(190,215,255,1)`;
        const g2 = ectx.createLinearGradient(0, y0, 0, y0 + hh);
        g2.addColorStop(0, col); g2.addColorStop(1, warm ? 'rgba(160,90,40,1)' : 'rgba(90,110,150,1)');
        ectx.globalAlpha = 0.45 + 0.55 * k;
        ectx.fillStyle = g2;
        ectx.fillRect(x0, y0, ww, hh);
        // curtains
        if (r() < 0.5) { ectx.fillStyle = 'rgba(0,0,0,0.55)'; ectx.fillRect(x0, y0, ww * (0.2 + r() * 0.3), hh); }
        ectx.globalAlpha = 1;
      }
    }
  }
  return { map: toTexture(c), emissiveMap: toTexture(e), metersU: cols * bayW, metersV: rows * floorH };
}

// Glass tower facade (Tashkent City skyline)
export function towerTextures({ seed = 71, tint = '#21344D' } = {}) {
  const w = 256, h = 512;
  const c = makeCanvas(w, h), ctx = c.getContext('2d');
  const e = makeCanvas(w, h), ectx = e.getContext('2d');
  const r = rng(seed);
  const grd = ctx.createLinearGradient(0, 0, w, h);
  grd.addColorStop(0, tint); grd.addColorStop(1, '#0E1724');
  ctx.fillStyle = grd; ctx.fillRect(0, 0, w, h);
  ectx.fillStyle = '#000'; ectx.fillRect(0, 0, w, h);
  const cols = 8, rows = 16;
  for (let y = 0; y < rows; y++) {
    ctx.fillStyle = 'rgba(180,200,220,0.35)';
    ctx.fillRect(0, (y * h) / rows, w, 2);
    for (let x = 0; x < cols; x++) {
      ctx.fillStyle = 'rgba(160,190,220,0.25)';
      ctx.fillRect((x * w) / cols, 0, 1.5, h);
      if (r() < 0.45) {
        ectx.fillStyle = r() < 0.6 ? `rgba(255,${190 + (r() * 40) | 0},130,${0.4 + r() * 0.6})` : `rgba(200,225,255,${0.3 + r() * 0.5})`;
        ectx.fillRect((x * w) / cols + 2, (y * h) / rows + 3, w / cols - 4, h / rows - 5);
      }
    }
  }
  return { map: toTexture(c), emissiveMap: toTexture(e) };
}

// Ground-floor shopfronts (neighbours)
export function shopfrontTexture(seed = 81) {
  const w = 1024, h = 256;
  const c = makeCanvas(w, h), ctx = c.getContext('2d');
  const e = makeCanvas(w, h), ectx = e.getContext('2d');
  const r = rng(seed);
  ctx.fillStyle = '#7E776D'; ctx.fillRect(0, 0, w, h);
  ectx.fillStyle = '#000'; ectx.fillRect(0, 0, w, h);
  const bays = 6;
  for (let i = 0; i < bays; i++) {
    const x0 = (i * w) / bays + 10, ww = w / bays - 20;
    const g = ctx.createLinearGradient(0, 30, 0, h);
    g.addColorStop(0, '#26303C'); g.addColorStop(1, '#10151C');
    ctx.fillStyle = g; ctx.fillRect(x0, 40, ww, h - 40);
    ctx.fillStyle = '#5B5650'; ctx.fillRect(x0 + ww / 2 - 2, 40, 4, h - 40);
    ctx.fillStyle = '#2E2B28'; ctx.fillRect(x0, 8, ww, 26);
    const lit = r() < 0.7;
    if (lit) {
      const gg = ectx.createLinearGradient(0, 40, 0, h);
      gg.addColorStop(0, 'rgba(255,214,160,0.9)'); gg.addColorStop(1, 'rgba(150,100,60,0.5)');
      ectx.fillStyle = gg; ectx.fillRect(x0, 40, ww, h - 40);
      ectx.fillStyle = 'rgba(0,0,0,0.6)';
      for (let k = 0; k < 3; k++) ectx.fillRect(x0 + r() * ww * 0.8, 120 + r() * 60, 18 + r() * 30, 80);
      ectx.fillStyle = 'rgba(255,240,220,0.9)';
      ectx.fillRect(x0 + 20, 14, ww - 40, 14);
    }
  }
  return { map: toTexture(c, { wrap: true }), emissiveMap: toTexture(e, { wrap: true }) };
}

// Leaf clusters for alpha-tested foliage cards
export function leafTexture(seed = 91, hue = 'plane') {
  const w = 256;
  const c = makeCanvas(w, w), ctx = c.getContext('2d');
  const r = rng(seed);
  ctx.clearRect(0, 0, w, w);
  const palette = hue === 'plane'
    ? ['#3E6B2A', '#4C7A31', '#5D8A3A', '#355F25', '#6E9944', '#2C4F1F']
    : ['#5E7F3A', '#6D8E44', '#4F6E2F'];
  for (let i = 0; i < 240; i++) {
    const a = r() * Math.PI * 2;
    const d = Math.sqrt(r()) * w * 0.44;
    const x = w / 2 + Math.cos(a) * d, y = w / 2 + Math.sin(a) * d;
    const s = 6 + r() * 10;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(r() * Math.PI * 2);
    ctx.fillStyle = palette[(r() * palette.length) | 0];
    ctx.beginPath();
    // lobed leaf
    ctx.moveTo(0, -s);
    ctx.quadraticCurveTo(s * 0.9, -s * 0.4, s * 0.55, s * 0.2);
    ctx.quadraticCurveTo(0, s * 0.9, -s * 0.55, s * 0.2);
    ctx.quadraticCurveTo(-s * 0.9, -s * 0.4, 0, -s);
    ctx.fill();
    ctx.restore();
  }
  return toTexture(c, { wrap: false });
}

// Radial gradients for fake light pools and contact shadows
export function radialTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)', size = 128, falloff = 0.5) {
  const c = makeCanvas(size, size), ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, inner);
  g.addColorStop(falloff, inner.replace(/[\d.]+\)$/, '0.35)'));
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return toTexture(c, { wrap: false, srgb: false });
}

export function solarCellTexture() {
  const w = 256, h = 512;
  const c = makeCanvas(w, h), ctx = c.getContext('2d');
  ctx.fillStyle = '#C9CED6'; ctx.fillRect(0, 0, w, h);
  const cols = 6, rows = 12, m = 6;
  const cw = (w - m * 2) / cols, ch = (h - m * 2) / rows;
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const g = ctx.createLinearGradient(0, m + y * ch, 0, m + (y + 1) * ch);
    g.addColorStop(0, '#1B2E5C'); g.addColorStop(1, '#122046');
    ctx.fillStyle = g;
    ctx.fillRect(m + x * cw + 1, m + y * ch + 1, cw - 2, ch - 2);
    ctx.fillStyle = 'rgba(200,210,230,0.35)';
    for (let k = 1; k < 4; k++) ctx.fillRect(m + x * cw + (k * cw) / 4, m + y * ch + 1, 1, ch - 2);
  }
  return toTexture(c, { wrap: false });
}

// ---------- text & signage ----------
// lines: [{ text, font, color, size (px), y (0..1), x? (0..1), align?, spacing? (em) }]
export function labelCanvas({ w = 1024, h = 256, bg = null, lines = [], border = null, pad = 0 }) {
  const c = makeCanvas(w, h), ctx = c.getContext('2d');
  if (bg) { ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h); }
  if (border) { ctx.strokeStyle = border.color; ctx.lineWidth = border.width; ctx.strokeRect(border.width / 2 + pad, border.width / 2 + pad, w - border.width - pad * 2, h - border.width - pad * 2); }
  for (const l of lines) {
    ctx.save();
    const size = l.size || 64;
    ctx.font = `${l.weight || 700} ${size}px ${l.font || FONT_SANS}`;
    ctx.fillStyle = l.color || '#fff';
    ctx.textBaseline = 'middle';
    const align = l.align || 'center';
    ctx.textAlign = 'left';
    const spacing = (l.spacing || 0) * size;
    const chars = [...l.text];
    const widths = chars.map((ch) => ctx.measureText(ch).width);
    const total = widths.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1);
    let x = (l.x ?? 0.5) * w;
    if (align === 'center') x -= total / 2;
    else if (align === 'right') x -= total;
    const y = (l.y ?? 0.5) * h;
    if (l.glow) { ctx.shadowColor = l.glow; ctx.shadowBlur = size * 0.35; }
    chars.forEach((ch, i) => { ctx.fillText(ch, x, y); x += widths[i] + spacing; });
    ctx.restore();
  }
  return c;
}

export function labelTexture(opts) {
  return toTexture(labelCanvas(opts), { wrap: false });
}
