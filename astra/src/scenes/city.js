// City details for STATION 01: facades with real window openings, ground-floor shopfronts
// with lit interiors and signage, and passenger cars with proper bodies.
import * as THREE from 'three';
import { tileSurface, place, roundedBox, V } from '../core/geometry.js';
import { screenMaterial } from '../core/materials.js';
import { makeCanvas, toTexture, labelCanvas, FONT_SANS } from '../core/textures.js';
import { createNoise2D, rng } from '../core/noise.js';

// ---------- materials shared by all facades of a scene ----------
export function cityMaterials(M, dn) {
  if (M._city) return M._city;
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const glassBase = { color: '#1E2A38', metalness: 0.55, roughness: 0.1, envMapIntensity: 1.3 };
  const C = {
    winDark: std({ name: 'window-glass', ...glassBase }),
    winWarm: std({ name: 'window-lit-warm', ...glassBase, emissive: '#FFB873' }),
    winCool: std({ name: 'window-lit-cool', ...glassBase, emissive: '#CFE0FF' }),
    winCurtain: std({ name: 'window-curtain', color: '#CDBFA8', roughness: 0.85, emissive: '#FFC98E' }),
    frame: std({ name: 'window-frame', color: '#2E3238', metalness: 0.6, roughness: 0.4 }),
    sill: std({ name: 'window-sill', color: '#E4DED2', roughness: 0.6 }),
    reveal: std({ name: 'window-reveal', color: '#D9D2C4', roughness: 0.85 }),
  };
  dn.prop(C.winWarm, 'emissiveIntensity', 0.0, 1.15);
  dn.prop(C.winCool, 'emissiveIntensity', 0.0, 0.9);
  dn.prop(C.winCurtain, 'emissiveIntensity', 0.0, 0.55);
  M._city = C;
  return C;
}

// Stone cladding: 1.2 × 0.6 m slabs, faint joints, per-slab tone
export function stoneTexture(tint = '#D3CABA', seed = 3) {
  const w = 512, ppm = w / 2.4;
  const c = makeCanvas(w, w), ctx = c.getContext('2d');
  const base = new THREE.Color(tint);
  const img = ctx.createImageData(w, w);
  const n = createNoise2D(seed), r = rng(seed);
  const tones = Array.from({ length: 16 }, () => 0.94 + r() * 0.08);
  for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) {
    const mx = x / ppm, my = y / ppm;
    const row = Math.floor(my / 0.6);
    const sx = mx + (row % 2) * 0.6;
    const col = Math.floor(sx / 1.2);
    const ex = Math.min(sx % 1.2, 1.2 - (sx % 1.2)) * ppm, ey = Math.min(my % 0.6, 0.6 - (my % 0.6)) * ppm;
    let k = tones[(col * 3 + row * 5) & 15] + n(x * 0.03, y * 0.03) * 0.03 + (r() - 0.5) * 0.03;
    if (Math.min(ex, ey) < 1.2) k *= 0.82;
    const i = (y * w + x) * 4;
    img.data[i] = Math.min(255, base.r * 255 * k * 1.0);
    img.data[i + 1] = Math.min(255, base.g * 255 * k);
    img.data[i + 2] = Math.min(255, base.b * 255 * k);
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const t = toTexture(c);
  t.colorSpace = THREE.LinearSRGBColorSpace;
  t.repeat.set(1 / 2.4, 1 / 2.4);
  return t;
}

/**
 * Facade with real window openings (recessed glass, reveals, frames, sills).
 * Wall plane at z, x0..x1, floors from y0; windows centred in bays of bayW.
 */
export function windowFacade(M, dn, { x0, x1, y0, rows, floorH = 3.2, bayW = 2.2, z = 0, wallMat, seed = 1, litRatio = 0.35, winW = 1.3, winH = 1.85, sillH = 0.75, depth = 0.24, layer = '' }) {
  const C = cityMaterials(M, dn);
  const r = rng(seed);
  const g = new THREE.Group();
  const cols = Math.round((x1 - x0) / bayW);
  const bw = (x1 - x0) / cols;
  const sEdges = [x0];
  for (let c = 0; c < cols; c++) { const cx = x0 + (c + 0.5) * bw; sEdges.push(cx - winW / 2, cx + winW / 2, x0 + (c + 1) * bw); }
  const tEdges = [y0];
  for (let f = 0; f < rows; f++) { const b = y0 + f * floorH; tEdges.push(b + sillH, b + sillH + winH, b + floorH); }
  const wall = tileSurface({
    sEdges, tEdges, maxSeg: 6,
    map: (s, t) => ({ p: V(s, t, z), n: V(0, 0, 1) }),
    tile: (i, j) => (i % 3 === 1 && j % 3 === 1 ? 'empty' : 'solid'),
  });
  place(g, wall, wallMat, { name: 'facade_wall' });
  const geo = {
    revealV: new THREE.BoxGeometry(0.04, winH, depth),
    revealH: new THREE.BoxGeometry(winW + 0.08, 0.04, depth),
    glass: new THREE.PlaneGeometry(winW, winH),
    frameV: new THREE.BoxGeometry(0.05, winH, 0.05),
    frameH: new THREE.BoxGeometry(winW, 0.05, 0.05),
    sill: new THREE.BoxGeometry(winW + 0.16, 0.05, 0.12),
  };
  for (let f = 0; f < rows; f++) for (let c = 0; c < cols; c++) {
    const cx = x0 + (c + 0.5) * bw, cy = y0 + f * floorH + sillH + winH / 2;
    const zi = z - depth;
    for (const sx of [-1, 1]) place(g, geo.revealV, C.reveal, { p: [cx + sx * (winW / 2 + 0.02), cy, z - depth / 2], cast: false });
    for (const sy of [-1, 1]) place(g, geo.revealH, C.reveal, { p: [cx, cy + sy * (winH / 2 + 0.02), z - depth / 2], cast: sy > 0 });
    const roll = r();
    const mat = roll < litRatio * 0.75 ? C.winWarm : roll < litRatio ? C.winCool : roll < litRatio + 0.12 ? C.winCurtain : C.winDark;
    place(g, geo.glass, mat, { p: [cx, cy, zi + 0.02], cast: false });
    for (const sx of [-1, 1]) place(g, geo.frameV, C.frame, { p: [cx + sx * (winW / 2 - 0.025), cy, zi + 0.04], cast: false });
    for (const sy of [-1, 1]) place(g, geo.frameH, C.frame, { p: [cx, cy + sy * (winH / 2 - 0.025), zi + 0.04], cast: false });
    place(g, geo.frameV, C.frame, { p: [cx, cy, zi + 0.04], cast: false });
    place(g, geo.frameH, C.frame, { p: [cx, cy + winH * 0.22, zi + 0.04], cast: false });
    place(g, geo.sill, C.sill, { p: [cx, cy - winH / 2 - 0.025, z + 0.04] });
  }
  if (layer) g.traverse((o) => { o.userData.layer = layer; });
  return g;
}

// ---------- shopfronts ----------
const SHOPS = ['BAKERY', 'PHARMACY', 'BOOKS', 'OPTICS', 'FLOWERS', 'GALLERY', 'TAILOR', 'STUDIO', 'MARKET', 'ELECTRONICS', 'SPORT', 'BANK'];

// One texture atlas per scene for all shop interiors and one for all shop signs:
// every shopfront shares the same two materials (keeps draw calls low on phones).
function shopAtlas(M, dn) {
  if (M._shops) return M._shops;
  const mk = (cw, ch, cols, rows) => {
    const canvas = makeCanvas(cw * cols, ch * rows);
    return { canvas, ctx: canvas.getContext('2d'), cw, ch, cols, rows, next: 0, tex: toTexture(canvas, { wrap: false }) };
  };
  const A = { interior: mk(512, 256, 4, 8), sign: mk(1024, 128, 2, 16) };
  A.interiorMat = screenMaterial(dn, A.interior.tex, { day: 0.32, night: 1.0 });
  A.interiorMat.name = 'shop-interiors';
  A.signMat = screenMaterial(dn, A.sign.tex, { day: 0.55, night: 1.25 });
  A.signMat.name = 'shop-signs';
  const std = (o) => new THREE.MeshStandardMaterial(o);
  A.fascia = std({ name: 'shop-fascia', color: '#2A2E34', roughness: 0.5, metalness: 0.3 });
  A.floor = std({ name: 'shop-floor', color: '#5A5650', roughness: 0.6 });
  A.ceil = std({ name: 'shop-ceiling', color: '#E8E4DC', roughness: 0.8, emissive: '#FFE8C8' });
  dn.prop(A.ceil, 'emissiveIntensity', 0.15, 0.6);
  M._shops = A;
  return A;
}
// allocate a cell, return a function that remaps a plane's uv into it
function cell(at, draw) {
  const i = at.next++ % (at.cols * at.rows);
  const col = i % at.cols, row = Math.floor(i / at.cols);
  at.ctx.save();
  at.ctx.translate(col * at.cw, row * at.ch);
  at.ctx.beginPath(); at.ctx.rect(0, 0, at.cw, at.ch); at.ctx.clip();
  draw(at.ctx, at.cw, at.ch);
  at.ctx.restore();
  at.tex.needsUpdate = true;
  const pad = 0.004;
  return (geo) => {
    const uv = geo.attributes.uv;
    for (let k = 0; k < uv.count; k++) {
      const u = pad + uv.getX(k) * (1 - 2 * pad), v = pad + uv.getY(k) * (1 - 2 * pad);
      uv.setXY(k, (col + u) / at.cols, 1 - (row + 1 - v) / at.rows);
    }
    return geo;
  };
}

function drawShopInterior(ctx, w, h, seed, warm) {
  const r = rng(seed);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, warm ? '#FFE7C6' : '#E6F0FF'); g.addColorStop(1, warm ? '#B88A5E' : '#7F95B5');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  // shelves with goods
  for (let s = 0; s < 3; s++) {
    const y = 70 + s * 60;
    ctx.fillStyle = 'rgba(40,30,25,0.55)'; ctx.fillRect(20, y, w - 40, 6);
    for (let x = 26; x < w - 30; x += 10 + r() * 14) {
      const hh = 14 + r() * 34;
      ctx.fillStyle = `hsla(${(r() * 360) | 0}, ${30 + r() * 40}%, ${35 + r() * 35}%, 0.9)`;
      ctx.fillRect(x, y - hh, 6 + r() * 8, hh);
    }
  }
  // counter + people silhouettes
  ctx.fillStyle = 'rgba(30,24,20,0.7)'; ctx.fillRect(w * 0.55, h - 70, w * 0.35, 70);
  for (let k = 0; k < 2; k++) {
    const x = 80 + r() * (w - 160);
    ctx.fillStyle = 'rgba(20,16,14,0.65)';
    ctx.beginPath(); ctx.arc(x, h - 120, 14, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(x - 16, h - 104, 32, 104);
  }
}

/** Row of shopfronts along X at z (facade plane), from x0 to x1, height 4.3 m */
export function shopfronts(M, dn, { x0, x1, z = 0, seed = 1, n = null, depth = 2.2 }) {
  const g = new THREE.Group();
  const r = rng(seed);
  const count = n || Math.max(1, Math.round(Math.abs(x1 - x0) / 4.8));
  const W = (x1 - x0) / count;
  const A = shopAtlas(M, dn);
  const fasciaMat = A.fascia, floorMat = A.floor, ceilMat = A.ceil;
  for (let i = 0; i < count; i++) {
    const a = x0 + i * W, b = a + W, cx = (a + b) / 2, ww = Math.abs(W) - 0.5;
    const warm = r() < 0.7;
    const toCell = cell(A.interior, (ctx, w, h) => drawShopInterior(ctx, w, h, seed * 31 + i, warm));
    // interior box
    place(g, toCell(new THREE.PlaneGeometry(ww, 3.1)), A.interiorMat, { p: [cx, 1.55, z - depth], cast: false });
    place(g, new THREE.PlaneGeometry(ww, depth).rotateX(-Math.PI / 2), floorMat, { p: [cx, 0.005, z - depth / 2], cast: false });
    place(g, new THREE.PlaneGeometry(ww, depth).rotateX(Math.PI / 2), ceilMat, { p: [cx, 3.1, z - depth / 2], cast: false });
    for (const sx of [-1, 1]) place(g, new THREE.PlaneGeometry(depth, 3.1).rotateY(-sx * Math.PI / 2), fasciaMat, { p: [cx + sx * ww / 2, 1.55, z - depth / 2], cast: false });
    // glazing: frame, mullions, door
    place(g, new THREE.BoxGeometry(ww, 3.1, 0.02), M.glass, { p: [cx, 1.55, z - 0.06], cast: false, receive: false }).renderOrder = 1;
    for (const fx of [-ww / 2, -ww / 6, ww / 6, ww / 2]) place(g, new THREE.BoxGeometry(0.06, 3.1, 0.1), M.aluDark, { p: [cx + fx, 1.55, z - 0.05] });
    place(g, new THREE.BoxGeometry(ww, 0.08, 0.12), M.aluDark, { p: [cx, 0.04, z - 0.05] });
    place(g, new THREE.BoxGeometry(ww, 0.06, 0.1), M.aluDark, { p: [cx, 2.35, z - 0.05] });
    place(g, new THREE.BoxGeometry(0.03, 0.5, 0.06), M.alu, { p: [cx + 0.15, 1.1, z - 0.01] });
    // signage fascia
    const name = SHOPS[(seed * 7 + i * 5) % SHOPS.length];
    const signCanvas = labelCanvas({ w: 1024, h: 128, bg: '#1C2026', lines: [{ text: name, font: FONT_SANS, size: 72, weight: 800, spacing: 0.22, color: warm ? '#F3E6CF' : '#DDE8F6' }] });
    const toSign = cell(A.sign, (ctx) => ctx.drawImage(signCanvas, 0, 0));
    place(g, new THREE.BoxGeometry(ww + 0.3, 0.9, 0.18), fasciaMat, { p: [cx, 3.62, z + 0.02] });
    place(g, toSign(new THREE.PlaneGeometry(Math.min(ww, 3.2), 0.4)), A.signMat, { p: [cx, 3.62, z + 0.115], cast: false });
    // pilasters
    place(g, new THREE.BoxGeometry(0.25, 4.3, 0.3), M.white, { p: [a + Math.sign(W) * 0.12, 2.15, z - 0.02] });
  }
  return g;
}

// ---------- cars ----------
function carBodyShape() {
  const s = new THREE.Shape();
  const wheelR = 0.39, wx = [-1.38, 1.4];
  s.moveTo(-2.28, 0.3);
  s.lineTo(-2.33, 0.62);
  s.quadraticCurveTo(-2.32, 0.92, -2.1, 0.96);
  s.lineTo(1.0, 0.98);
  s.quadraticCurveTo(2.0, 0.95, 2.28, 0.82);
  s.quadraticCurveTo(2.36, 0.62, 2.3, 0.32);
  // front arch
  s.lineTo(wx[1] + wheelR + 0.05, 0.3);
  s.absarc(wx[1], 0.34, wheelR + 0.05, 0, Math.PI, false);
  s.lineTo(wx[0] + wheelR + 0.05, 0.3);
  s.absarc(wx[0], 0.34, wheelR + 0.05, 0, Math.PI, false);
  s.lineTo(-2.28, 0.3);
  return s;
}
function cabinShape() {
  const s = new THREE.Shape();
  s.moveTo(-1.85, 0.96);
  s.quadraticCurveTo(-1.35, 1.36, -0.85, 1.4);
  s.lineTo(0.35, 1.42);
  s.quadraticCurveTo(0.7, 1.4, 1.15, 0.97);
  s.closePath();
  return s;
}

export function makeCar(M, paint) {
  const g = new THREE.Group();
  const glass = M._carGlass || (M._carGlass = new THREE.MeshStandardMaterial({ name: 'car-glass', color: '#0D131B', metalness: 0.6, roughness: 0.06, envMapIntensity: 1.4 }));
  const body = new THREE.ExtrudeGeometry(carBodyShape(), { depth: 1.66, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.07, bevelSegments: 4, curveSegments: 16 });
  body.translate(0, 0, -0.83);
  place(g, body, paint, { name: 'car_body' });
  const cab = new THREE.ExtrudeGeometry(cabinShape(), { depth: 1.42, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: 3, curveSegments: 12 });
  cab.translate(0, 0, -0.71);
  place(g, cab, glass, {});
  // roof panel + pillars in paint
  const roof = new THREE.ExtrudeGeometry((() => { const s = new THREE.Shape(); s.moveTo(-0.9, 1.395); s.lineTo(0.38, 1.415); s.lineTo(0.36, 1.47); s.lineTo(-0.88, 1.45); s.closePath(); return s; })(), { depth: 1.36, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.03, bevelSegments: 2 });
  roof.translate(0, 0, -0.68);
  place(g, roof, paint, {});
  for (const sz of [-1, 1]) place(g, new THREE.BoxGeometry(0.1, 0.42, 0.02), paint, { p: [-0.25, 1.18, sz * 0.765], r: [sz * 0.12, 0, 0], cast: false });
  // wheels
  for (const x of [-1.38, 1.4]) for (const sz of [-1, 1]) {
    const w = new THREE.Group(); w.position.set(x, 0.34, sz * 0.8); w.rotation.x = Math.PI / 2; g.add(w);
    place(w, new THREE.CylinderGeometry(0.34, 0.34, 0.24, 24), M.rubber, {});
    place(w, new THREE.CylinderGeometry(0.22, 0.22, 0.245, 20), M.aluSatin, { cast: false });
    for (let k = 0; k < 5; k++) place(w, new THREE.BoxGeometry(0.05, 0.25, 0.36), M.aluDark, { p: [0, 0, 0], r: [0, (k / 5) * Math.PI, 0], cast: false });
    place(w, new THREE.CylinderGeometry(0.05, 0.05, 0.25, 10), M.alu, { cast: false });
  }
  // lights, mirrors, handles, underbody
  for (const sz of [-1, 1]) {
    place(g, roundedBox(0.06, 0.08, 0.42, 0.02), M.ledWhite, { p: [2.31, 0.74, sz * 0.58], cast: false });
    place(g, roundedBox(0.06, 0.07, 0.5, 0.02), M.ledRed, { p: [-2.33, 0.78, sz * 0.52], cast: false });
    place(g, roundedBox(0.16, 0.08, 0.1, 0.02), paint, { p: [1.0, 1.03, sz * 0.92] });
    for (const x of [-0.6, 0.45]) place(g, new THREE.BoxGeometry(0.16, 0.025, 0.02), M.aluDark, { p: [x, 0.86, sz * 0.915], cast: false });
  }
  place(g, new THREE.BoxGeometry(4.2, 0.12, 1.6), M.graphite, { p: [0, 0.3, 0], cast: false });
  place(g, roundedBox(0.04, 0.12, 0.7, 0.02), M.graphite, { p: [2.34, 0.5, 0], cast: false });
  return g;
}
