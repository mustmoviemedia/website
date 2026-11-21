// People for scale (1 unit = 1 m): jointed figures with clothing, shoes and hair in a muted
// palette. Colours are vertex colours, so every figure in a scene merges into one draw call.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rng } from './noise.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);

const PALETTE = {
  skin: ['#E7C2A4', '#D3A27F', '#B07D5B', '#8A5E42', '#F0D2BC'],
  top: ['#DDE3EA', '#13223A', '#B4482A', '#8A97A8', '#2B3440', '#ECE6DA', '#5B6B82', '#C9A43A', '#3E5E8C', '#6E7F6A', '#F4F4F2'],
  bottom: ['#2B3440', '#1B2230', '#4A5260', '#8C7F6B', '#3A4048', '#C9CFD6', '#253049'],
  shoes: ['#1A1E24', '#EDEDED', '#4A3A2E', '#2B3440'],
  hair: ['#17120E', '#3A2A1E', '#6B4A30', '#B89A72', '#2A2A2A'],
};

function colored(g, hex) {
  const n = g; // keep the index: far fewer vertices than a non-indexed copy
  for (const k of Object.keys(n.attributes)) if (!['position', 'normal'].includes(k)) n.deleteAttribute(k);
  const c = new THREE.Color(hex);
  const count = n.attributes.position.count;
  const col = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  n.setAttribute('color', new THREE.BufferAttribute(col, 3));
  n.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
  return n;
}

// tapered limb between two points
function limb(a, b, r0, r1, seg = 10) {
  const d = V().subVectors(b, a);
  const len = d.length();
  const g = new THREE.CylinderGeometry(r1, r0, len, seg, 1, true);
  g.translate(0, len / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, d.normalize()));
  g.translate(a.x, a.y, a.z);
  return g;
}
function ball(p, r, sx = 1, sy = 1, sz = 1, seg = 12) {
  const g = new THREE.SphereGeometry(r, seg, Math.max(6, seg - 4));
  g.scale(sx, sy, sz);
  g.translate(p.x, p.y, p.z);
  return g;
}
function lathe(points, y, sz = 0.62, seg = 16) {
  const g = new THREE.LatheGeometry(points.map(([r, h]) => new THREE.Vector2(r, h)), seg);
  g.scale(1, 1, sz);
  g.translate(0, y, 0);
  return g;
}

/**
 * pose: 'stand' | 'walk' | 'sit' | 'barsit' | 'lean'
 * seed: picks clothing, skin, hair and build
 */
export function personGeometry(pose = 'stand', height = 1.75, seed = 1, palette = null, suit = false) {
  const r = rng(Math.floor(seed * 9973) + 17);
  const pick = (a) => a[Math.floor(r() * a.length)];
  const SUIT = { skin: ['#F2F3F2'], top: ['#ECEEEF'], bottom: ['#E4E7E9'], shoes: ['#9AA1A8'], hair: ['#ECEEEF'] };
  const P = suit ? SUIT : { ...PALETTE, ...(palette || {}) };
  const skin = pick(P.skin), top = pick(P.top), bottom = pick(P.bottom);
  const shoes = pick(P.shoes), hair = pick(P.hair);
  const longHair = !suit && r() < 0.4, shortSleeve = !suit && r() < 0.35, dress = longHair && r() < 0.3;
  const build = suit ? 1.18 : 0.92 + r() * 0.16; // shoulder width factor
  const parts = [];
  const add = (g, c) => parts.push(colored(g, c));

  const seat = pose === 'sit' ? 0.46 : pose === 'barsit' ? 0.76 : 0;
  const hip = seat ? seat + 0.09 : 0.94;
  const sh = hip + 0.49; // shoulder height
  const lean = pose === 'lean' ? 0.04 : 0;

  // pelvis + chest
  add(lathe([[0, 0], [0.135, 0.01], [0.15, 0.08], [0.145, 0.15], [0.0, 0.16]], hip - 0.06, 0.66), dress ? top : bottom);
  add(lathe([[0, 0], [0.14, 0.0], [0.135, 0.1], [0.15 * build, 0.24], [0.18 * build, 0.36], [0.175 * build, 0.42], [0.12, 0.47], [0.05, 0.5], [0, 0.505]], hip + 0.06, 0.6), top);
  if (dress) add(lathe([[0.15, 0], [0.2, -0.28], [0.21, -0.42], [0, -0.42]], hip + 0.06, 0.72), top);
  // neck + head + hair
  add(limb(V(0, sh + 0.02, lean), V(0, sh + 0.12, lean), 0.05, 0.045, 10), skin);
  const hc = V(0, sh + 0.215, lean + 0.01);
  if (suit) {
    // EVA suit: helmet with gold visor, life-support backpack, orange mission band
    add(ball(V(hc.x, hc.y - 0.01, hc.z), 0.165, 1, 1, 1, 18), '#F4F5F5');
    const visor = new THREE.SphereGeometry(0.168, 18, 10, Math.PI * 0.18, Math.PI * 0.64, Math.PI * 0.3, Math.PI * 0.36); // faces +Z
    visor.translate(hc.x, hc.y - 0.01, hc.z);
    add(visor, '#B8862E');
    add(new THREE.BoxGeometry(0.42, 0.56, 0.2).translate(0, sh - 0.2, lean - 0.2), '#E6E8EA');
    add(new THREE.BoxGeometry(0.3, 0.12, 0.05).translate(0, sh - 0.04, lean - 0.31), '#FF6A1A');
    add(new THREE.CylinderGeometry(0.2, 0.2, 0.06, 18).translate(0, sh + 0.03, lean), '#C9CED6');
  }
  if (!suit) add(ball(hc, 0.1, 0.86, 1.08, 0.98, 16), skin);
  if (!suit) add(ball(V(0, hc.y - 0.06, hc.z + 0.03), 0.06, 1.05, 0.8, 1.0, 10), skin); // jaw
  const capG = new THREE.SphereGeometry(0.106, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.52);
  capG.scale(0.9, 1.08, 1.02); capG.rotateX(-0.25); capG.translate(hc.x, hc.y + 0.008, hc.z - 0.008);
  if (!suit && r() < 0.9) add(capG, hair); else capG.dispose();
  if (longHair) add(ball(V(0, hc.y - 0.07, hc.z - 0.06), 0.085, 1.15, 1.5, 0.7, 12), hair);

  // legs
  for (const side of [-1, 1]) {
    const hx = side * 0.085;
    const hipJ = V(hx, hip, 0);
    let knee, ankle, toeDir;
    if (seat) {
      knee = V(hx * 1.12, hip + 0.01, 0.44);
      ankle = pose === 'barsit' ? V(hx * 1.12, hip - 0.4, 0.5) : V(hx * 1.12, 0.09, 0.5);
      toeDir = V(0, -0.15, 1);
    } else {
      const swing = pose === 'walk' ? side * 0.3 : pose === 'lean' && side > 0 ? 0.14 : 0;
      knee = V(hx, 0.5, Math.sin(swing) * 0.42 + (pose === 'walk' && side < 0 ? 0.04 : 0));
      ankle = V(hx * 1.04, 0.09, Math.sin(swing) * 0.82);
      toeDir = V(0, 0, 1);
    }
    add(ball(hipJ, 0.078, 1, 1, 1, 10), dress ? skin : bottom);
    add(limb(hipJ, knee, 0.078, 0.058), dress ? skin : bottom);
    add(ball(knee, 0.058, 1, 1, 1, 10), dress ? skin : bottom);
    add(limb(knee, ankle, 0.056, 0.042), dress ? skin : bottom);
    // shoe: flattened capsule from heel to toe
    const shoe = new THREE.CapsuleGeometry(0.045, 0.15, 3, 10);
    shoe.rotateX(Math.PI / 2); shoe.scale(1, 0.75, 1);
    const q = new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), toeDir.normalize());
    shoe.applyQuaternion(q);
    shoe.translate(ankle.x, ankle.y - 0.045, ankle.z + 0.07);
    add(shoe, shoes);
  }
  // arms
  for (const side of [-1, 1]) {
    const s0 = V(side * 0.19 * build, sh - 0.05, lean * 0.5);
    let elbow, wrist;
    if (seat) { elbow = V(side * 0.23 * build, sh - 0.3, 0.1); wrist = V(side * 0.15, sh - 0.4, 0.36); }
    else if (pose === 'walk') { const sw = -side * 0.35; elbow = V(side * 0.22 * build, sh - 0.3, Math.sin(sw) * 0.28); wrist = V(side * 0.23, sh - 0.56, Math.sin(sw) * 0.52); }
    else if (pose === 'lean' && side > 0) { elbow = V(0.25, sh - 0.27, 0.16); wrist = V(0.12, sh - 0.1, 0.3); }
    else { elbow = V(side * 0.235 * build, sh - 0.3, 0.02); wrist = V(side * 0.245, sh - 0.57, 0.06); }
    add(ball(s0, 0.058, 1, 1, 1, 10), top);
    add(limb(s0, elbow, 0.052, 0.044), top);
    add(ball(elbow, 0.044, 1, 1, 1, 8), shortSleeve ? skin : top);
    add(limb(elbow, wrist, 0.042, 0.033), shortSleeve ? skin : top);
    const hd = V().subVectors(wrist, elbow).normalize();
    const hand = new THREE.SphereGeometry(0.042, 10, 8);
    hand.scale(0.62, 1.25, 0.42);
    hand.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, hd.clone().negate()));
    hand.translate(wrist.x + hd.x * 0.045, wrist.y + hd.y * 0.045, wrist.z + hd.z * 0.045);
    add(hand, skin);
  }
  const g = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  const k = height / 1.75;
  g.scale(k, k, k);
  g.computeBoundingSphere();
  return g;
}

let counter = 0;
export function addPerson(parent, material, { x = 0, z = 0, y = 0, rot = 0, pose = 'stand', h = 1.75, seed, palette = null, suit = false } = {}) {
  const m = new THREE.Mesh(personGeometry(pose, h, seed ?? (x * 13.1 + z * 7.7 + ++counter * 0.618), palette, suit), material);
  m.position.set(x, y, z);
  m.rotation.y = rot;
  m.castShadow = true;
  m.receiveShadow = true;
  m.userData.person = true;
  parent.add(m);
  return m;
}

export function clearPeopleCache() { counter = 0; }
