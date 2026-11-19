// Geometry generators and helpers.
// tileSurface: a parametric surface split into tiles; tiles can be solid, empty (door
// openings) or carry a round porthole. Neighbouring tiles share edge vertices, so the
// surface has no cracks, and real holes (not alpha cut-outs) export cleanly to GLB.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

function splitRange(a, b, maxSeg) {
  return Math.max(1, Math.ceil((b - a) / maxSeg - 1e-6));
}

/**
 * @param {object} o
 * @param {number[]} o.sEdges  tile boundaries along s (metres)
 * @param {number[]} o.tEdges  tile boundaries along t (metres)
 * @param {(i:number,j:number)=>('solid'|'empty'|{hole:number, rings?:number})} o.tile
 * @param {(s:number,t:number)=>{p:THREE.Vector3,n:THREE.Vector3}} o.map
 * @param {number} [o.maxSeg] max segment length inside a tile
 * @param {[number,number]} [o.uvScale] metres → uv
 */
export function tileSurface({ sEdges, tEdges, tile, map, maxSeg = 0.25, uvScale = [1, 1], uvOffset = [0, 0] }) {
  const sDiv = [], tDiv = [];
  for (let i = 0; i < sEdges.length - 1; i++) sDiv.push(splitRange(sEdges[i], sEdges[i + 1], maxSeg));
  for (let j = 0; j < tEdges.length - 1; j++) tDiv.push(splitRange(tEdges[j], tEdges[j + 1], maxSeg));
  // hole tiles need at least 4 divisions per side for a round hole
  for (let i = 0; i < sDiv.length; i++) for (let j = 0; j < tDiv.length; j++) {
    const k = tile(i, j);
    if (k && typeof k === 'object') { sDiv[i] = Math.max(sDiv[i], 4); tDiv[j] = Math.max(tDiv[j], 4); }
  }
  const S = [], T = [];
  const sOff = [0], tOff = [0];
  for (let i = 0; i < sDiv.length; i++) {
    for (let k = 0; k < sDiv[i]; k++) S.push(sEdges[i] + ((sEdges[i + 1] - sEdges[i]) * k) / sDiv[i]);
    sOff.push(sOff[i] + sDiv[i]);
  }
  S.push(sEdges[sEdges.length - 1]);
  for (let j = 0; j < tDiv.length; j++) {
    for (let k = 0; k < tDiv[j]; k++) T.push(tEdges[j] + ((tEdges[j + 1] - tEdges[j]) * k) / tDiv[j]);
    tOff.push(tOff[j] + tDiv[j]);
  }
  T.push(tEdges[tEdges.length - 1]);

  const pos = [], nor = [], uv = [], idx = [];
  const cache = new Map();
  const addVertex = (s, t) => {
    const { p, n } = map(s, t);
    pos.push(p.x, p.y, p.z);
    nor.push(n.x, n.y, n.z);
    uv.push(s * uvScale[0] + uvOffset[0], t * uvScale[1] + uvOffset[1]);
    return pos.length / 3 - 1;
  };
  const gv = (gi, gj) => {
    const key = gi * 100003 + gj;
    let v = cache.get(key);
    if (v === undefined) { v = addVertex(S[gi], T[gj]); cache.set(key, v); }
    return v;
  };

  // orientation check: (dP/ds × dP/dt) · n must be > 0
  const s0 = (sEdges[0] + sEdges[1]) / 2, t0 = (tEdges[0] + tEdges[1]) / 2;
  const a = map(s0, t0), b = map(s0 + 0.01, t0), c = map(s0, t0 + 0.01);
  const cr = V().subVectors(b.p, a.p).cross(V().subVectors(c.p, a.p));
  const flip = cr.dot(a.n) < 0;
  const tri = (i0, i1, i2) => (flip ? idx.push(i0, i2, i1) : idx.push(i0, i1, i2));

  for (let i = 0; i < sDiv.length; i++) {
    for (let j = 0; j < tDiv.length; j++) {
      const kind = tile(i, j);
      if (kind === 'empty') continue;
      const gi0 = sOff[i], gi1 = sOff[i + 1], gj0 = tOff[j], gj1 = tOff[j + 1];
      if (kind === 'solid' || !kind) {
        for (let gi = gi0; gi < gi1; gi++) for (let gj = gj0; gj < gj1; gj++) {
          const A = gv(gi, gj), B = gv(gi + 1, gj), C = gv(gi + 1, gj + 1), D = gv(gi, gj + 1);
          tri(A, B, C); tri(A, C, D);
        }
        continue;
      }
      // porthole tile: boundary loop → concentric rings → circle
      const r = kind.hole;
      const cs = (sEdges[i] + sEdges[i + 1]) / 2, ct = (tEdges[j] + tEdges[j + 1]) / 2;
      const loop = [];
      for (let gi = gi0; gi < gi1; gi++) loop.push([gi, gj0]);
      for (let gj = gj0; gj < gj1; gj++) loop.push([gi1, gj]);
      for (let gi = gi1; gi > gi0; gi--) loop.push([gi, gj1]);
      for (let gj = gj1; gj > gj0; gj--) loop.push([gi0, gj]);
      const rings = kind.rings || 2;
      const prev = loop.map(([gi, gj]) => gv(gi, gj));
      const bpts = loop.map(([gi, gj]) => [S[gi], T[gj]]);
      let last = prev;
      for (let k = 1; k <= rings; k++) {
        const f = k / rings;
        const cur = bpts.map(([s, t]) => {
          const ang = Math.atan2(t - ct, s - cs);
          const cx = cs + Math.cos(ang) * r, cy = ct + Math.sin(ang) * r;
          return addVertex(s + (cx - s) * f, t + (cy - t) * f);
        });
        for (let m = 0; m < cur.length; m++) {
          const m2 = (m + 1) % cur.length;
          tri(last[m], last[m2], cur[m2]);
          tri(last[m], cur[m2], cur[m]);
        }
        last = cur;
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

// Horizontal cylinder segment along X: axis at (y=cy, z=cz), angle phi from +Z towards +Y
export function arcMapping(R, cy, cz, phi0) {
  return (s, t) => {
    const phi = phi0 + t / R;
    const n = V(0, Math.sin(phi), Math.cos(phi));
    return { p: V(s, cy + R * n.y, cz + R * n.z), n };
  };
}

// Vertical cylinder wall: s = arc length around (theta from +Z towards +X), t = height
export function drumMapping(R, theta0 = 0, cx = 0, cz = 0, inward = false) {
  return (s, t) => {
    const th = theta0 + s / R;
    const n = V(Math.sin(th), 0, Math.cos(th));
    const p = V(cx + R * n.x, t, cz + R * n.z);
    if (inward) n.negate();
    return { p, n };
  };
}

// Open 2D profile (array of [a,b]) resampled by arc length; returns sampler(t) → {a,b,na,nb}
export function profileSampler(points) {
  const L = [0];
  for (let i = 1; i < points.length; i++) L.push(L[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]));
  const total = L[L.length - 1];
  const sample = (t) => {
    t = Math.min(Math.max(t, 0), total);
    let i = 1;
    while (i < L.length - 1 && L[i] < t) i++;
    const f = (t - L[i - 1]) / (L[i] - L[i - 1] || 1);
    const p0 = points[i - 1], p1 = points[i];
    const a = p0[0] + (p1[0] - p0[0]) * f, b = p0[1] + (p1[1] - p0[1]) * f;
    // smooth normal: average of neighbouring segment normals
    const seg = (k) => {
      const q0 = points[Math.max(0, Math.min(points.length - 2, k))], q1 = points[Math.max(1, Math.min(points.length - 1, k + 1))];
      const dx = q1[0] - q0[0], dy = q1[1] - q0[1], l = Math.hypot(dx, dy) || 1;
      return [dy / l, -dx / l];
    };
    const n0 = seg(i - 1), n1 = f < 0.5 ? seg(i - 2) : seg(i);
    const w = f < 0.5 ? 0.5 - f : f - 0.5;
    let na = n0[0] * (1 - w) + n1[0] * w, nb = n0[1] * (1 - w) + n1[1] * w;
    const nl = Math.hypot(na, nb) || 1;
    return { a, b, na: na / nl, nb: nb / nl };
  };
  return { sample, length: total };
}

// Rounded "hatch" profile, open at the floor: from (-w/2,0) up, over, down to (w/2,0).
// Normals point outward (clockwise traversal in a-b plane with a→x, b→y).
export function hatchProfile(w, h, r, seg = 8) {
  const pts = [[-w / 2, 0], [-w / 2, h - r]];
  for (let k = 1; k <= seg; k++) {
    const a = Math.PI - (k / seg) * (Math.PI / 2);
    pts.push([-w / 2 + r + Math.cos(a) * r, h - r + Math.sin(a) * r]);
  }
  pts.push([w / 2 - r, h]);
  for (let k = 1; k <= seg; k++) {
    const a = Math.PI / 2 - (k / seg) * (Math.PI / 2);
    pts.push([w / 2 - r + Math.cos(a) * r, h - r + Math.sin(a) * r]);
  }
  pts.push([w / 2, 0]);
  return pts;
}

// Corridor along +Z (or along a heading) using a profile sampler. s = along length, t = along profile.
export function corridorMapping(sampler, inward = false) {
  return (s, t) => {
    const q = sampler.sample(t);
    // traversal is clockwise when viewed from +Z → (nb, -na) points outward; we use (-nb?) check below
    const n = V(-q.na, -q.nb, 0);
    if (inward) n.negate();
    return { p: V(q.a, q.b, s), n };
  };
}

// U-shaped hatch frame between an outer and an inner hatchProfile (both open at the floor),
// extruded along +Z by depth (centred on z = 0)
export function uFrame(outerPts, innerPts, depth, bevel = 0.012) {
  const s = new THREE.Shape();
  s.moveTo(outerPts[0][0], outerPts[0][1]);
  for (let i = 1; i < outerPts.length; i++) s.lineTo(outerPts[i][0], outerPts[i][1]);
  for (let i = innerPts.length - 1; i >= 0; i--) s.lineTo(innerPts[i][0], innerPts[i][1]);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel * 0.6, bevelSegments: 1 });
  g.translate(0, 0, -depth / 2);
  return g;
}

// Annular sector (in the z/y plane) extruded along X: a ring frame lying on a horizontal
// cylinder whose axis is at (y = cy, z = cz). Angles as in arcMapping.
export function arcBand(r0, r1, phiA, phiB, width, cy, cz, seg = 48) {
  const s = new THREE.Shape();
  s.absarc(0, 0, r1, phiA, phiB, false);
  s.absarc(0, 0, r0, phiB, phiA, true);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: width, bevelEnabled: false, curveSegments: seg });
  g.translate(0, 0, -width / 2);
  g.rotateY(-Math.PI / 2);
  g.translate(0, cy, cz);
  return g;
}

export function roundedRectShape(w, h, r, cx = 0, cy = 0) {
  const s = new THREE.Shape();
  const x0 = cx - w / 2, y0 = cy - h / 2, x1 = cx + w / 2, y1 = cy + h / 2;
  r = Math.min(r, w / 2, h / 2);
  s.moveTo(x0 + r, y0);
  s.lineTo(x1 - r, y0);
  s.quadraticCurveTo(x1, y0, x1, y0 + r);
  s.lineTo(x1, y1 - r);
  s.quadraticCurveTo(x1, y1, x1 - r, y1);
  s.lineTo(x0 + r, y1);
  s.quadraticCurveTo(x0, y1, x0, y1 - r);
  s.lineTo(x0, y0 + r);
  s.quadraticCurveTo(x0, y0, x0 + r, y0);
  return s;
}

export function roundedRectPath(w, h, r, cx = 0, cy = 0) {
  const p = new THREE.Path();
  const s = roundedRectShape(w, h, r, cx, cy);
  p.curves = s.curves;
  return p;
}

// Ring frame: outer rounded rect minus inner rounded rect, extruded `depth`
export function frameGeometry(ow, oh, or, iw, ih, ir, depth, bevel = 0.01) {
  const shape = roundedRectShape(ow, oh, or);
  shape.holes.push(roundedRectPath(iw, ih, ir));
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, curveSegments: 10 });
  g.translate(0, 0, -depth / 2);
  return g;
}

// Box w×h×d (x,y,z) with rounded corners in XY and a small bevel on the Z faces
export function roundedBox(w, h, d, r = 0.03, bevel = 0.008) {
  const b = Math.min(bevel, d / 4, w / 4, h / 4);
  const shape = roundedRectShape(w - 2 * b, h - 2 * b, Math.max(0.001, r - b));
  const g = new THREE.ExtrudeGeometry(shape, { depth: Math.max(0.001, d - 2 * b), bevelEnabled: b > 0, bevelThickness: b, bevelSize: b, bevelSegments: 1, curveSegments: 4 });
  g.translate(0, 0, -(d - 2 * b) / 2);
  return g;
}

// Cylinder between two points
export function cylinderBetween(a, b, r0, r1 = r0, radial = 8) {
  const dir = V().subVectors(b, a);
  const len = dir.length();
  const g = new THREE.CylinderGeometry(r1, r0, len, radial, 1, false);
  g.translate(0, len / 2, 0);
  const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), dir.normalize());
  g.applyQuaternion(q);
  g.translate(a.x, a.y, a.z);
  return g;
}

export function capsuleBetween(a, b, r, cap = 3, radial = 8) {
  const dir = V().subVectors(b, a);
  const len = dir.length();
  const g = new THREE.CapsuleGeometry(r, Math.max(0.001, len), cap, radial);
  g.translate(0, len / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), dir.normalize()));
  g.translate(a.x, a.y, a.z);
  return g;
}

// Place helper: creates a mesh with transforms and adds to parent
export function place(parent, geometry, material, { p = [0, 0, 0], r = [0, 0, 0], s = null, cast = true, receive = true, name = '' } = {}) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(p[0], p[1], p[2]);
  m.rotation.set(r[0], r[1], r[2]);
  if (s) (typeof s === 'number' ? m.scale.setScalar(s) : m.scale.set(s[0], s[1], s[2]));
  m.castShadow = cast;
  m.receiveShadow = receive;
  if (name) m.name = name;
  parent.add(m);
  return m;
}

export function box(parent, w, h, d, mat, x, y, z, opts = {}) {
  return place(parent, new THREE.BoxGeometry(w, h, d), mat, { p: [x, y, z], ...opts });
}

// ---------- static batching ----------
// Merge all static meshes that share a material (and shadow flags / layer) into one mesh.
function normalizeGeometry(g, keepColor) {
  const out = g.index ? g : g.clone();
  if (!out.index) {
    const n = out.attributes.position.count;
    const arr = n > 65535 ? new Uint32Array(n) : new Uint16Array(n);
    for (let i = 0; i < n; i++) arr[i] = i;
    out.setIndex(new THREE.BufferAttribute(arr, 1));
  }
  for (const k of Object.keys(out.attributes)) {
    if (k === 'position' || k === 'normal' || k === 'uv') continue;
    if (k === 'color' && keepColor) continue;
    out.deleteAttribute(k);
  }
  if (!out.attributes.normal) out.computeVertexNormals();
  if (!out.attributes.uv) out.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(out.attributes.position.count * 2), 2));
  if (keepColor && !out.attributes.color) {
    const c = new Float32Array(out.attributes.position.count * 3).fill(1);
    out.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
  }
  out.morphAttributes = {};
  return out;
}

export function mergeStatic(root) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const groups = new Map();
  const victims = [];
  root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh) return;
    if (o.userData.dynamic || o.userData.noMerge) return;
    let p = o.parent, skip = false;
    while (p && p !== root) { if (p.userData.dynamic || p.userData.noMerge) skip = true; p = p.parent; }
    if (skip) return;
    if (Array.isArray(o.material)) return;
    if (!o.material || !o.material.isMaterial) { console.warn('mergeStatic: mesh without a valid material skipped', o); return; }
    const layer = o.userData.layer || '';
    const key = `${o.material.uuid}|${o.castShadow ? 1 : 0}${o.receiveShadow ? 1 : 0}|${layer}|${o.renderOrder}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(o);
    victims.push(o);
  });
  const m = new THREE.Matrix4();
  let before = 0, after = 0;
  for (const [, list] of groups) {
    before += list.length;
    const mat = list[0].material;
    const keepColor = !!mat.vertexColors;
    const geos = list.map((o) => {
      const g = normalizeGeometry(o.geometry, keepColor).clone();
      m.multiplyMatrices(inv, o.matrixWorld);
      g.applyMatrix4(m);
      if (m.determinant() < 0) {
        const ix = g.index.array;
        for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; }
      }
      return g;
    });
    const merged = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
    geos.forEach((g) => { if (g !== merged) g.dispose(); });
    if (!merged) continue;
    merged.computeBoundingSphere();
    const mesh = new THREE.Mesh(merged, mat);
    mesh.castShadow = list[0].castShadow;
    mesh.receiveShadow = list[0].receiveShadow;
    mesh.renderOrder = list[0].renderOrder;
    mesh.userData.layer = list[0].userData.layer;
    mesh.name = 'merged:' + (mat.name || 'mat');
    root.add(mesh);
    after++;
  }
  for (const o of victims) {
    o.parent.remove(o);
    o.geometry.dispose();
  }
  return { before, after };
}

export { V };
