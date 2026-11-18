// Neutral scale figures (architectural-model style) for a sense of size. 1 unit = 1 m.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { capsuleBetween } from './geometry.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const cache = new Map();

function torso() {
  const pts = [[0, 0.0], [0.14, 0.02], [0.155, 0.12], [0.145, 0.24], [0.185, 0.42], [0.195, 0.48], [0.13, 0.54], [0.05, 0.57], [0, 0.575]]
    .map(([r, y]) => new THREE.Vector2(r, y));
  const g = new THREE.LatheGeometry(pts, 12);
  g.scale(1, 1, 0.62);
  return g;
}

function clean(g) {
  const n = g.index ? g.toNonIndexed() : g;
  for (const k of Object.keys(n.attributes)) if (!['position', 'normal', 'uv'].includes(k)) n.deleteAttribute(k);
  return n;
}

// pose: 'stand' | 'walk' | 'sit' | 'barsit' | 'lean'
export function personGeometry(pose = 'stand', height = 1.75) {
  const key = pose + height.toFixed(2);
  if (cache.has(key)) return cache.get(key);
  const k = height / 1.75;
  const parts = [];
  let hip = 0.95, sh = 1.43, lean = 0;
  const seat = pose === 'sit' ? 0.46 : pose === 'barsit' ? 0.76 : 0;
  if (seat) hip = seat + 0.08;
  if (seat) sh = hip + 0.48;
  // torso
  const t = torso();
  t.translate(0, hip - 0.02, 0);
  if (pose === 'lean') { t.rotateX(0.05); lean = 0.03; }
  parts.push(t);
  // head + neck
  const head = new THREE.SphereGeometry(0.105, 12, 10);
  head.scale(0.92, 1.08, 1);
  head.translate(0, sh + 0.2, lean);
  parts.push(head);
  parts.push(capsuleBetween(V(0, sh + 0.05, 0), V(0, sh + 0.12, lean), 0.045, 2, 6));
  // legs
  for (const side of [-1, 1]) {
    const hx = side * 0.09;
    if (seat) {
      const knee = V(hx * 1.1, hip, 0.44);
      const foot = pose === 'barsit' ? V(hx * 1.1, hip - 0.42, 0.52) : V(hx * 1.1, 0.06, 0.5);
      parts.push(capsuleBetween(V(hx, hip, 0.02), knee, 0.075, 2, 8));
      parts.push(capsuleBetween(knee, foot, 0.06, 2, 8));
      parts.push(capsuleBetween(foot, V(foot.x, foot.y - 0.02, foot.z + 0.13), 0.045, 2, 6));
    } else {
      const swing = pose === 'walk' ? side * 0.32 : pose === 'lean' && side > 0 ? 0.12 : 0;
      const foot = V(hx * 1.05, 0.06, Math.sin(swing) * 0.85);
      const knee = V(hx, 0.5, Math.sin(swing) * 0.42 + (pose === 'walk' && side < 0 ? 0.04 : 0));
      parts.push(capsuleBetween(V(hx, hip, 0), knee, 0.075, 2, 8));
      parts.push(capsuleBetween(knee, foot, 0.06, 2, 8));
      parts.push(capsuleBetween(foot, V(foot.x, 0.05, foot.z + 0.14), 0.045, 2, 6));
    }
  }
  // arms
  for (const side of [-1, 1]) {
    const s0 = V(side * 0.2, sh - 0.04, 0);
    let elbow, hand;
    if (seat) {
      elbow = V(side * 0.24, sh - 0.3, 0.12);
      hand = V(side * 0.16, sh - 0.42, 0.38);
    } else if (pose === 'walk') {
      const sw = -side * 0.35;
      elbow = V(side * 0.23, sh - 0.3, Math.sin(sw) * 0.3);
      hand = V(side * 0.24, sh - 0.58, Math.sin(sw) * 0.55);
    } else if (pose === 'lean' && side > 0) {
      elbow = V(0.26, sh - 0.25, 0.18);
      hand = V(0.12, sh - 0.12, 0.32);
    } else {
      elbow = V(side * 0.24, sh - 0.3, 0.02);
      hand = V(side * 0.25, sh - 0.6, 0.05);
    }
    parts.push(capsuleBetween(s0, elbow, 0.05, 2, 6));
    parts.push(capsuleBetween(elbow, hand, 0.042, 2, 6));
  }
  const g = mergeGeometries(parts.map(clean), false);
  parts.forEach((p) => p.dispose());
  g.scale(k, k, k);
  g.computeBoundingSphere();
  cache.set(key, g);
  return g;
}

export function addPerson(parent, material, { x = 0, z = 0, y = 0, rot = 0, pose = 'stand', h = 1.75 } = {}) {
  const m = new THREE.Mesh(personGeometry(pose, h), material);
  m.position.set(x, y, z);
  m.rotation.y = rot;
  m.castShadow = true;
  m.receiveShadow = true;
  m.userData.person = true;
  parent.add(m);
  return m;
}

export function clearPeopleCache() { cache.forEach((g) => g.dispose()); cache.clear(); }
