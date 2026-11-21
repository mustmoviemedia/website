// STATION 02 · ASTRO CITY — Ustyurt plateau (Karakalpakstan). Geodesic dome Ø 11.3 m on a drum,
// long airlock corridor, terrace over the chink cliff, solar field, antenna, rover, gate signs.
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { createStationBase, disposeTree } from './common.js';
import { createMaterials, signMaterial, screenMaterial, lightPoolMaterial, contactShadowMaterial, boxUV, BRAND } from '../core/materials.js';
import * as T from '../core/textures.js';
import {
  tileSurface, drumMapping, hatchProfile, profileSampler, corridorMapping, uFrame,
  place, box, roundedBox, cylinderBetween, mergeStatic, V,
} from '../core/geometry.js';
import { Colliders } from '../core/controls.js';
import { addPerson, clearPeopleCache } from '../core/people.js';
import { createNoise2D, fbm, ridged, rng, smoothstep, clamp } from '../core/noise.js';
import * as P from './props.js';
import * as X from './fixtures.js';
import { ZONES } from '../config.js';

const DR = 5.65; // dome radius (Ø 11.3 m)
const DRUM_H = 2.6;
const CORR_W = 2.2, CORR_H = 2.5, CORR_Z0 = 5.3, CORR_Z1 = 17.5;
const TER = { x0: -6.6, x1: 6.6, z0: -12.6, z1: -4.2 };
const CIRC = Math.PI * 2 * DR;
const SM_Z = 12.0; // service module (restrooms) axis
// pilot station for analog missions: two modules Ø3.4 × 10 m (from the ASTRAHUB roadmap)
const HAB = { x: -24, R: 1.7, AY: 2.15, FL: 0.95, A: [-7, 3], NODE: [3, 4.2], B: [4.2, 14.2] };

const SKY = {
  sunDir: new THREE.Vector3(0.34, 0.12, -0.93),
  moonDir: new THREE.Vector3(-0.42, 0.6, 0.68),
  day: { zenith: '#18244A', horizon: '#B0705F', ground: '#4A2A22', sun: '#FFD7A8', glow: '#FF6F2A', glowStrength: 0.75, horizonGlow: 0.95, sunSize: 1.05, sunBoost: 24, stars: 0.16, milkyDay: 0.1 },
  night: { zenith: '#03050B', horizon: '#111D33', ground: '#05060A', cityGlow: '#000000', milky: 0.8 },
  fog: { day: '#A9705F', night: '#0D1626' },
  stars: 4500,
  moonSize: 120,
};

// ---------------- terrain ----------------
function makeTerrainFn() {
  const n = createNoise2D(1337), n2 = createNoise2D(4242), n3 = createNoise2D(99);
  const edgeZ = (x) => {
    const away = smoothstep(6, 45, Math.abs(x));
    return -19.5 - 0.0024 * x * x - away * (7 * n(x * 0.011, 3.1) + 3.2 * n(x * 0.047, 7.7)) - 1.1 * n(x * 0.16, 1.3) * smoothstep(3, 20, Math.abs(x));
  };
  const mesas = [[-70, -175, 26], [95, -240, 38], [-160, -320, 44], [30, -430, 60], [210, -380, 34], [-280, -230, 30]];
  const roadX = (z) => 5 * Math.sin(z * 0.012) * smoothstep(30, 140, z);
  const H = (x, z) => {
    const r = Math.hypot(x, z - 2);
    const flat = Math.min(smoothstep(19, 46, r), smoothstep(15, 32, Math.hypot(x - HAB.x, z - 4)));
    // plateau
    let h = (1.6 * fbm(n, x * 0.012, z * 0.012, 4) + 0.35 * fbm(n2, x * 0.06, z * 0.06, 3)) * flat;
    h += Math.max(0, z - 60) * 0.012 * flat;
    // road: graded track
    const rd = Math.abs(x - roadX(z));
    if (z > 16) h *= 0.35 + 0.65 * smoothstep(2.5, 7, rd);
    h -= 0.08 * (1 - flat);
    // escarpment (chink)
    const gully = 7 * ridged(n3, x * 0.05, 0.3, 3) * smoothstep(4, 30, Math.abs(x));
    const d = edgeZ(x) - z - gully * 0.6;
    if (d > -2) {
      const s1 = Math.pow(smoothstep(0, 9, d), 0.85);
      const k = smoothstep(5, 120, d) * 7;
      const terr = (Math.floor(k) + smoothstep(0.3, 0.75, k - Math.floor(k))) / 7;
      const rim = 0.22 * Math.exp(-((d + 0.5) ** 2) / 2);
      h = h + rim - 46 * s1 - 44 * terr - 4 * fbm(n2, x * 0.03, z * 0.03, 3) * smoothstep(10, 60, d);
    }
    // buttes in the depression
    for (const [mx, mz, mr] of mesas) {
      const dd = Math.hypot(x - mx, z - mz);
      if (dd < mr + 14) {
        const top = -18 + 6 * n(mx, mz);
        const e = smoothstep(mr + 12, mr, dd + 4 * n2(x * 0.08, z * 0.08));
        h = Math.max(h, h + (top - h) * e);
      }
    }
    return h;
  };
  return { H, edgeZ, roadX };
}

function geometric(a, b, n) {
  // from a (near) to b (far): spacing grows outward
  const out = [];
  for (let i = 1; i <= n; i++) { const f = i / n; out.push(a + (b - a) * ((Math.pow(28, f) - 1) / 27)); }
  return out;
}

function buildTerrain(terrainFn, quality) {
  const { H, edgeZ, roadX } = terrainFn;
  const dense = quality.tier === 'low' ? 1.5 : 1;
  const xs = [];
  for (let x = -150; x <= 150 + 1e-6; x += 2 * dense) xs.push(x);
  const X = [...geometric(-150, -3200, 22).reverse(), ...xs, ...geometric(150, 3200, 22)];
  const zs = [];
  for (let z = -150; z < -64; z += 2.5 * dense) zs.push(z);
  for (let z = -64; z < -8; z += 1.0 * dense) zs.push(z);
  for (let z = -8; z <= 130; z += 2.5 * dense) zs.push(z);
  const Z = [...geometric(-150, -3200, 22).reverse(), ...zs, ...geometric(130, 3200, 22)];
  const nx = X.length, nz = Z.length;
  const pos = new Float32Array(nx * nz * 3), uv = new Float32Array(nx * nz * 2), col = new Float32Array(nx * nz * 3);
  const hgt = new Float32Array(nx * nz);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i, h = H(X[i], Z[j]);
    hgt[k] = h;
    pos.set([X[i], h, Z[j]], k * 3);
    uv.set([X[i] / 3, -Z[j] / 3], k * 2);
  }
  const idx = new Uint32Array((nx - 1) * (nz - 1) * 6);
  let o = 0;
  for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
    idx[o++] = a; idx[o++] = c; idx[o++] = b;
    idx[o++] = b; idx[o++] = c; idx[o++] = d;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeVertexNormals();
  // vertex colours: rust plateau, chalk strata on the cliff, salt flats below
  const nrm = g.attributes.normal;
  const n = createNoise2D(7), n2 = createNoise2D(8);
  const C = (h) => new THREE.Color(h);
  const rust = C('#A4553A'), ochre = C('#B98A62'), dust = C('#C79A76'), chalk = C('#E4D6C2'), pink = C('#D3AE97'), band = C('#B98468'), salt = C('#D9D1C4'), dark = C('#6E3A2A');
  const c = new THREE.Color(), t = new THREE.Color();
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i, x = X[i], z = Z[j], h = hgt[k];
    const slope = 1 - nrm.getY(k);
    const f = fbm(n, x * 0.02, z * 0.02, 4);
    c.copy(rust).lerp(ochre, clamp(0.5 + f * 0.9, 0, 1));
    c.lerp(dark, clamp(n2(x * 0.09, z * 0.09) * 0.4 - 0.1, 0, 0.35));
    // road dust
    if (z > 16) c.lerp(dust, 0.75 * (1 - smoothstep(2.0, 4.5, Math.abs(x - roadX(z)))));
    // cliff strata
    const cliff = smoothstep(0.18, 0.5, slope);
    if (cliff > 0) {
      const s = 0.5 + 0.5 * Math.sin(h * 1.25 + n2(x * 0.03, h * 0.1) * 2.5);
      t.copy(chalk).lerp(s > 0.65 ? band : pink, s > 0.65 ? (s - 0.65) * 2.2 : (1 - s) * 0.35);
      c.lerp(t, cliff);
    }
    // depression floor: salt flats mixed with rust
    const low = smoothstep(-55, -80, h);
    if (low > 0) { t.copy(salt).lerp(rust, clamp(0.45 + fbm(n2, x * 0.01, z * 0.01, 3), 0, 1)); c.lerp(t, low * (1 - cliff)); }
    col.set([c.r, c.g, c.b], k * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeBoundingSphere();
  return g;
}

// geodesic hemisphere: frequency-4 icosahedron with a vertex at the zenith
function geodesic(R, y0) {
  // rotate so that the vertex (0, 1, φ) points to the zenith
  const g0 = new THREE.IcosahedronGeometry(1, 3);
  g0.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 1.6180339).normalize(), V(0, 1, 0)));
  const p = g0.attributes.position;
  const tris = [];
  for (let i = 0; i < p.count; i += 3) {
    const a = V().fromBufferAttribute(p, i), b = V().fromBufferAttribute(p, i + 1), c = V().fromBufferAttribute(p, i + 2);
    if ((a.y + b.y + c.y) / 3 < 0.02) continue;
    for (const v of [a, b, c]) {
      if (v.y < 0.0) { v.y = 0; v.normalize(); }
      if (v.y < 0.06) { const l = Math.hypot(v.x, v.z); v.y = 0; v.x /= l; v.z /= l; }
    }
    tris.push([a, b, c]);
  }
  g0.dispose();
  return tris.map((t) => t.map((v) => V(v.x * R, v.y * R + y0, v.z * R)));
}

export async function buildAstroCity({ renderer, quality, progress = () => {} }) {
  const base = createStationBase(renderer, quality, {
    sky: SKY,
    fog: { day: 0.0011, night: 0.0013, dayColor: SKY.fog.day },
    sun: { day: 3.0, night: 0.42, dayColor: '#FFB27A', nightColor: '#AFC3EE', dist: 90, shadowSize: 46, center: [2, 0, 0], normalBias: 0.09 },
    hemi: { day: 0.5, night: 0.2, daySky: '#8C7DA6', dayGround: '#7A4630', nightSky: '#1A2850', nightGround: '#0A0806' },
    env: { day: 0.75, night: 0.45 },
  });
  const { scene, dn } = base;
  const M = createMaterials(dn, { interiorEnv: 0.45 });
  const world = new THREE.Group(); world.name = 'STATION_02_ASTRO_CITY'; scene.add(world);
  const fx = new THREE.Group(); fx.userData.noExport = true; scene.add(fx);
  const col = new Colliders();
  const dynamic = { doors: [], beacons: [] };
  const terrainFn = makeTerrainFn();
  const { H, edgeZ } = terrainFn;
  progress(0.1);

  const compDS = M.composite.clone(); compDS.side = THREE.DoubleSide; compDS.name = 'composite-ds';
  compDS.emissive = new THREE.Color('#FFD2A0'); compDS.emissiveMap = compDS.map;
  dn.prop(compDS, 'emissiveIntensity', 0, 0.05);

  // ================= TERRAIN =================
  const det = T.desertDetailTextures();
  const terrainMat = new THREE.MeshStandardMaterial({ name: 'ustyurt-ground', vertexColors: true, map: det.map, normalMap: det.normalMap, normalScale: new THREE.Vector2(0.9, 0.9), roughness: 0.96 });
  const terrain = new THREE.Mesh(buildTerrain(terrainFn, quality), terrainMat);
  terrain.name = 'terrain_ustyurt';
  terrain.receiveShadow = true;
  terrain.castShadow = true;
  terrain.userData.noMerge = true;
  world.add(terrain);
  progress(0.3);

  // station pad
  const padMat = new THREE.MeshStandardMaterial({ name: 'pad-concrete', color: '#9C8E80', roughness: 0.9 });
  const pad = new THREE.CylinderGeometry(7.4, 7.6, 0.2, 64); boxUV(pad);
  place(world, pad, padMat, { p: [0, -0.1, 0] });
  const walkway = new THREE.BoxGeometry(3.4, 0.2, CORR_Z1 - CORR_Z0 + 3); boxUV(walkway);
  place(world, walkway, padMat, { p: [0, -0.106, (CORR_Z0 + CORR_Z1) / 2 + 1.5] });

  // ================= DOME =================
  const dome = new THREE.Group(); dome.name = 'dome'; world.add(dome);
  // drum wall with portholes, terrace glazing and corridor opening
  const glazeHalf = 4.0, sT = CIRC / 2;
  const ports = [2.725, 9.025, 12.175, 23.325, 26.475, 32.775];
  const sE = new Set([0, 1.15, sT - glazeHalf, sT + glazeHalf, CIRC - 1.15, CIRC]);
  for (const c of ports) { sE.add(c - 0.5); sE.add(c + 0.5); }
  const sEdges = [...sE].sort((a, b) => a - b);
  const tEdges = [0, 0.95, 1.95, 2.35, 2.5, DRUM_H];
  const colType = (i) => {
    const c = (sEdges[i] + sEdges[i + 1]) / 2;
    if (c < 1.15 || c > CIRC - 1.15) return 'corr';
    if (Math.abs(c - sT) < glazeHalf) return 'glaze';
    if (ports.some((p) => Math.abs(p - c) < 0.01)) return 'port';
    return 'solid';
  };
  const drum = tileSurface({
    sEdges, tEdges, maxSeg: 0.35, map: drumMapping(DR, 0),
    tile: (i, j) => {
      const k = colType(i);
      if (k === 'corr' && j <= 3) return 'empty';
      if (k === 'glaze' && j <= 2) return 'empty';
      if (k === 'port' && j === 1) return { hole: 0.34 };
      return 'solid';
    },
  });
  place(dome, drum, compDS, { name: 'dome_drum' });
  const thetaOf = (s) => s / DR;
  const onDrum = (s, y, r = DR) => { const th = thetaOf(s); return [Math.sin(th) * r, y, Math.cos(th) * r]; };
  for (const s of ports) {
    const th = thetaOf(s);
    const f = P.portholeFrame(M, 0.34, { flange: 0.12, depth: 0.09 });
    f.position.set(...onDrum(s, 1.45)); f.rotation.y = th; dome.add(f);
    const fi = P.portholeFrame(M, 0.34, { flange: 0.09, depth: 0.09 });
    fi.position.set(...onDrum(s, 1.45)); fi.rotation.y = th + Math.PI; dome.add(fi);
    place(dome, new THREE.CircleGeometry(0.35, 32), M.glass, { p: onDrum(s, 1.45), r: [0, th, 0], cast: false, receive: false });
  }
  // panoramic glass curtain (with door gap) + mullions
  const gl = tileSurface({
    sEdges: [sT - glazeHalf, sT - 0.8, sT + 0.8, sT + glazeHalf], tEdges: [0, 2.25, 2.35], maxSeg: 0.5, map: drumMapping(DR - 0.02, 0),
    tile: (i, j) => (i === 1 && j === 0 ? 'empty' : 'solid'),
  });
  place(dome, gl, M.glass, { cast: false, receive: false, name: 'panoramic_glazing' });
  for (let s = sT - glazeHalf; s <= sT + glazeHalf + 1e-6; s += 0.8) {
    if (Math.abs(s - sT) < 0.75) continue;
    place(dome, new THREE.BoxGeometry(0.06, 2.35, 0.1), M.alu, { p: onDrum(s, 1.175), r: [0, thetaOf(s), 0] });
  }
  for (const y of [0.04, 2.33]) dome.add(ringArc(M.alu, DR, thetaOf(sT - glazeHalf), thetaOf(sT + glazeHalf), 0.045, y));
  // sliding terrace doors
  for (const sx of [-1, 1]) {
    const d = new THREE.Group(); d.userData.dynamic = true;
    place(d, new THREE.BoxGeometry(0.8, 2.22, 0.02), M.glass, { cast: false, receive: false });
    place(d, new THREE.BoxGeometry(0.04, 2.22, 0.05), M.alu, { p: [sx * 0.38, 0, 0] });
    place(d, new THREE.BoxGeometry(0.8, 0.05, 0.05), M.alu, { p: [0, 1.09, 0] });
    place(d, new THREE.BoxGeometry(0.03, 0.5, 0.05), M.orange, { p: [-sx * 0.33, 0, 0.03] });
    d.position.set(sx * 0.4, 1.12, -DR - 0.06);
    d.userData.closedX = sx * 0.4; d.userData.openX = sx * 1.15;
    dome.add(d); dynamic.doors.push({ g: d, at: [0, -DR] });
  }
  // ring beam at the top of the drum + LEDs
  dome.add(ringArc(M.alu, DR + 0.04, 0, Math.PI * 2, 0.09, DRUM_H, 96));
  dome.add(ringArc(M.ledWarm, DR + 0.13, 0, Math.PI * 2, 0.018, DRUM_H - 0.08, 128, false));
  dome.add(ringArc(M.ledWarm, DR - 0.14, 0, Math.PI * 2, 0.02, DRUM_H - 0.12, 128, false));
  dome.add(ringArc(M.aluDark, DR + 0.05, 0, Math.PI * 2, 0.1, 0.12, 96));
  // geodesic shell
  const tris = geodesic(DR, DRUM_H);
  const glassP = [], panelP = [], glassUV = [], panelUV = [];
  const struts = new Map(), hubs = new Map();
  const key = (v) => `${v.x.toFixed(2)},${v.y.toFixed(2)},${v.z.toFixed(2)}`;
  for (const [a, b, c] of tris) {
    const cen = V().add(a).add(b).add(c).multiplyScalar(1 / 3);
    const az = Math.atan2(cen.x, cen.z);
    const hn = (cen.y - DRUM_H) / DR;
    const toTer = Math.abs(Math.atan2(Math.sin(az - Math.PI), Math.cos(az - Math.PI)));
    const isGlass = (toTer < 0.74 && hn < 0.78) || hn > 0.93;
    const shrink = 0.03;
    const pts = [a, b, c].map((v) => v.clone().lerp(cen, shrink / v.distanceTo(cen)));
    (isGlass ? glassP : panelP).push(...pts.flatMap((v) => [v.x, v.y, v.z]));
    (isGlass ? glassUV : panelUV).push(0, 0, 1, 0, 0.5, 1);
    for (const [p, q] of [[a, b], [b, c], [c, a]]) {
      const k = [key(p), key(q)].sort().join('|');
      if (!struts.has(k)) struts.set(k, [p, q]);
    }
    for (const v of [a, b, c]) hubs.set(key(v), v);
  }
  const triTex = T.triPanelTextures(256);
  const domePanelMat = new THREE.MeshStandardMaterial({ name: 'dome-panels', color: '#F2F3F4', map: triTex.map, normalMap: triTex.normalMap, roughness: 0.6, side: THREE.DoubleSide, emissive: '#FFD9AE', emissiveMap: triTex.map });
  dn.prop(domePanelMat, 'emissiveIntensity', 0, 0.06);
  const mk = (arr, uvs) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.computeVertexNormals();
    return g;
  };
  place(dome, mk(panelP, panelUV), domePanelMat, { name: 'dome_panels' });
  const domeGlass = M.glass.clone(); domeGlass.opacity = 0.14; domeGlass.name = 'dome-glass';
  place(dome, mk(glassP, glassUV), domeGlass, { name: 'dome_glazing', cast: false, receive: false });
  // struts + hubs (instanced)
  const strutGeo = new THREE.BoxGeometry(0.075, 0.09, 1);
  const strutMesh = new THREE.InstancedMesh(strutGeo, M.alu, struts.size);
  const m4 = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), up = V(), dirv = V(), side = V(), mid = V();
  let si = 0;
  const basis = new THREE.Matrix4();
  for (const [p, q] of struts.values()) {
    mid.copy(p).add(q).multiplyScalar(0.5);
    dirv.subVectors(q, p);
    const len = dirv.length(); dirv.normalize();
    up.set(mid.x, mid.y - DRUM_H, mid.z).normalize();
    side.crossVectors(up, dirv).normalize();
    up.crossVectors(dirv, side).normalize();
    basis.makeBasis(side, up, dirv);
    tmpQ.setFromRotationMatrix(basis);
    m4.compose(mid, tmpQ, V(1, 1, len));
    strutMesh.setMatrixAt(si++, m4);
  }
  strutMesh.castShadow = true; strutMesh.receiveShadow = true; strutMesh.name = 'dome_struts';
  dome.add(strutMesh);
  const hubGeo = new THREE.CylinderGeometry(0.075, 0.075, 0.12, 10);
  const hubMesh = new THREE.InstancedMesh(hubGeo, M.aluSatin, hubs.size);
  let hi = 0;
  for (const v of hubs.values()) {
    up.set(v.x, v.y - DRUM_H, v.z).normalize();
    tmpQ.setFromUnitVectors(V(0, 1, 0), up);
    m4.compose(v, tmpQ, V(1, 1, 1));
    hubMesh.setMatrixAt(hi++, m4);
  }
  hubMesh.name = 'dome_hubs';
  dome.add(hubMesh);
  // beacon on top
  place(dome, new THREE.SphereGeometry(0.09, 12, 8), M.ledRed, { p: [0, DRUM_H + DR + 0.12, 0], cast: false }).userData.layer = 'dome';
  progress(0.45);

  // ================= INTERIOR =================
  const inn = new THREE.Group(); inn.name = 'interior'; world.add(inn);
  const floorG = new THREE.CircleGeometry(DR - 0.02, 72); floorG.rotateX(-Math.PI / 2); boxUV(floorG);
  place(inn, floorG, M.floor, { p: [0, 0.012, 0], name: 'floor' });
  // orange inlay ring + guide line from the corridor
  place(inn, new THREE.RingGeometry(2.55, 2.6, 96).rotateX(-Math.PI / 2), M.ledOrange, { p: [0, 0.016, 0], cast: false });
  place(inn, new THREE.BoxGeometry(0.05, 0.006, CORR_Z1 - 2.6 + 0.2), M.ledOrange, { p: [0, 0.016, (CORR_Z1 + 2.6) / 2], cast: false });

  // ---- Island Bar ----
  const bar = new THREE.Group(); bar.name = 'zone_island_bar'; inn.add(bar);
  const gapA = Math.PI / 2 - 0.3, gapB = Math.PI / 2 + 0.3;
  const ringShape = (r0, r1, a0, a1) => {
    const s = new THREE.Shape();
    s.absarc(0, 0, r1, a0, a1, false);
    s.absarc(0, 0, r0, a1, a0, true);
    return s;
  };
  // counter: angles in shape space (x, -z) → we rotate the extrude so shape lies in XZ
  const counter = new THREE.ExtrudeGeometry(ringShape(1.15, 1.75, -gapA + Math.PI / 2 + 0.0, 2 * Math.PI - gapB + Math.PI / 2 + 0.0 + 0), { depth: 1.04, bevelEnabled: false, curveSegments: 64 });
  counter.rotateX(-Math.PI / 2);
  place(bar, counter, M.whiteIn, { name: 'island_bar_counter' });
  const top = new THREE.ExtrudeGeometry(ringShape(1.1, 1.85, -gapA + Math.PI / 2, 2 * Math.PI - gapB + Math.PI / 2), { depth: 0.05, bevelEnabled: false, curveSegments: 64 });
  top.rotateX(-Math.PI / 2);
  place(bar, top, M.stoneTop, { p: [0, 1.04, 0] });
  const ledR = new THREE.ExtrudeGeometry(ringShape(1.755, 1.765, -gapA + Math.PI / 2 + 0.03, 2 * Math.PI - gapB + Math.PI / 2 - 0.03), { depth: 0.02, bevelEnabled: false, curveSegments: 64 });
  ledR.rotateX(-Math.PI / 2);
  place(bar, ledR, M.ledOrange, { p: [0, 0.9, 0], cast: false });
  place(bar, ledR.clone(), M.ledWarm, { p: [0, 0.04, 0], cast: false });
  // central back bar + column
  place(bar, new THREE.CylinderGeometry(0.7, 0.72, 0.92, 48), M.graphiteIn, { p: [0, 0.46, 0] });
  place(bar, new THREE.CylinderGeometry(0.74, 0.74, 0.04, 48), M.steel, { p: [0, 0.94, 0] });
  const isink = X.counterSink(M, 0.34, 0.28); isink.position.set(Math.sin(3.15) * 0.46, 0.96, Math.cos(3.15) * 0.46); isink.rotation.y = 3.15; bar.add(isink);
  for (const deg of [150, 210]) {
    const a = (deg * Math.PI) / 180;
    const fd = X.fridgeTall(M, { w: 0.6, h: 0.86, d: 0.04, doors: 1 }); fd.position.set(Math.sin(a) * 1.13, 0, Math.cos(a) * 1.13); fd.rotation.y = a + Math.PI; bar.add(fd);
  }
  for (const a of [0.0, 2.1, 4.2]) {
    const cm = P.coffeeMachine(M);
    cm.scale.setScalar(0.85);
    cm.position.set(Math.sin(a) * 0.38, 0.96, Math.cos(a) * 0.38);
    cm.rotation.y = a;
    bar.add(cm);
  }
  place(bar, new THREE.CylinderGeometry(0.12, 0.12, 2.6, 16), M.whiteIn, { p: [0, 1.4 + 1.3, 0] });
  const topH = DRUM_H + DR - 0.2 - 4.0;
  place(bar, new THREE.CylinderGeometry(0.12, 0.12, topH, 16), M.whiteIn, { p: [0, 4.0 + topH / 2, 0] }).userData.layer = 'dome';
  const halo = new THREE.TorusGeometry(1.5, 0.035, 8, 96); halo.rotateX(Math.PI / 2);
  place(bar, halo, M.ledWarm, { p: [0, 3.35, 0], cast: false });
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + 0.4;
    place(bar, cylinderBetween(V(0, 3.9, 0), V(Math.sin(a) * 1.5, 3.36, Math.cos(a) * 1.5), 0.008), M.aluDark, { cast: false });
  }
  // menu ring above the back bar
  const menuTex = P.menuTexture();
  menuTex.repeat.set(3, 1);
  const menuCyl = new THREE.CylinderGeometry(0.6, 0.6, 0.55, 48, 1, true);
  place(bar, menuCyl, screenMaterial(dn, menuTex, { day: 1, night: 1.3 }), { p: [0, 2.15, 0], cast: false });
  // stools
  const stoolAngles = [];
  for (let k = 0; k < 8; k++) stoolAngles.push(((120 + k * 34.3) * Math.PI) / 180);
  for (const a of stoolAngles) {
    const s = P.barStool(M); s.position.set(Math.sin(a) * 2.1, 0, Math.cos(a) * 2.1); inn.add(s);
  }
  col.circle(0, 0, 2.3);

  // ---- window counters along the panoramic glazing ----
  for (const [a0, a1] of [[0.92, 1.36], [1.78, 2.22]]) {
    const g = new THREE.ExtrudeGeometry(ringShape(4.85, 5.2, a0, a1), { depth: 0.04, bevelEnabled: false, curveSegments: 24 });
    g.rotateX(-Math.PI / 2);
    place(inn, g, M.stoneTop, { p: [0, 1.04, 0] });
    for (let k = 0; k < 5; k++) {
      const a = a0 + ((k + 0.5) / 5) * (a1 - a0);
      // shape angle a (x = cos a, -z = sin a) → world (cos a, -sin a)
      const s = P.barStool(M); s.position.set(Math.cos(a) * 4.62, 0, -Math.sin(a) * 4.62); inn.add(s);
      col.circle(Math.cos(a) * 4.62, -Math.sin(a) * 4.62, 0.22);
    }
  }

  // ---- tables ----
  const tableAt = [];
  for (const deg of [72, 118, 242, 288]) {
    const a = (deg * Math.PI) / 180;
    const tx = Math.sin(a) * 3.65, tz = Math.cos(a) * 3.65;
    tableAt.push([tx, tz]);
    const t = P.roundTable(M, 0.36, 0.74); t.position.set(tx, 0, tz); inn.add(t);
    for (const [dx, dz, ry] of [[0, 0.56, Math.PI], [0, -0.56, 0], [0.56, 0, -Math.PI / 2], [-0.56, 0, Math.PI / 2]]) {
      const c = P.chair(M); c.position.set(tx + dx, 0, tz + dz); c.rotation.y = ry; inn.add(c);
    }
    col.circle(tx, tz, 0.78);
  }

  // ---- Tour Desk (right of the entry) ----
  const tdA = (43 * Math.PI) / 180;
  const td = new THREE.Group(); td.name = 'zone_tourdesk'; inn.add(td);
  td.position.set(Math.sin(tdA) * 4.55, 0, Math.cos(tdA) * 4.55);
  td.rotation.y = tdA + Math.PI;
  place(td, roundedBox(1.7, 1.04, 0.6, 0.08), M.whiteIn, { p: [0, 0.52, 0] });
  place(td, roundedBox(1.8, 0.04, 0.7, 0.06), M.stoneTop, { p: [0, 1.06, 0.02] });
  place(td, new THREE.BoxGeometry(1.6, 0.05, 0.012), M.orange, { p: [0, 0.82, 0.305] });
  const tdTex = T.labelTexture({ w: 512, h: 64, lines: [{ text: 'TOUR DESK', font: T.FONT_MONO, size: 36, weight: 500, spacing: 0.35, color: '#13223A' }] });
  place(td, new THREE.PlaneGeometry(0.95, 0.12), new THREE.MeshStandardMaterial({ map: tdTex, transparent: true, roughness: 0.6 }), { p: [0, 0.62, 0.303], cast: false });
  const tourTex = T.labelTexture({
    w: 1024, h: 576, bg: '#06090F',
    lines: [
      { text: 'MISSION 001', size: 72, weight: 800, spacing: 0.16, y: 0.14, color: '#F4F6F8' },
      { text: 'PILOT STATION · 2 MODULES Ø3.4 × 10 M', font: T.FONT_MONO, size: 32, weight: 500, y: 0.36, color: '#FF6A1A' },
      { text: '7–10 DAYS · EVA · CREW TRAINING', font: T.FONT_MONO, size: 32, weight: 500, y: 0.52, color: '#F2C230' },
      { text: 'GOAL · IAC 2028 · SAMARKAND', font: T.FONT_MONO, size: 32, weight: 500, y: 0.68, color: '#DDE3EA' },
      { text: 'PLANNED · USTYURT PLATEAU', font: T.FONT_MONO, size: 24, weight: 400, y: 0.86, color: '#7D8A9C' },
    ],
  });
  const tdScreen = P.display(M, 1.4, 0.79, screenMaterial(dn, tourTex));
  tdScreen.position.set(0, 1.85, -0.85); tdScreen.rotation.x = -0.05; td.add(tdScreen);
  place(td, new THREE.BoxGeometry(0.06, 1.45, 0.06), M.alu, { p: [0, 0.725, -0.85] });
  col.circle(td.position.x, td.position.z, 0.85);

  // ---- Space & Merch (left of the entry, curved vitrine) ----
  const mA = -(56 * Math.PI) / 180;
  const mg = new THREE.Group(); mg.name = 'zone_merch'; inn.add(mg);
  const vt = P.vitrine(M, 1.7, 0.5);
  vt.position.set(Math.sin(mA) * 5.12, 0, Math.cos(mA) * 5.12); vt.rotation.y = mA + Math.PI; mg.add(vt);
  const merchTex = T.labelTexture({ w: 1024, h: 160, bg: '#06090F', lines: [{ text: 'SPACE & MERCH', size: 72, weight: 800, spacing: 0.18, color: '#F2C230' }] });
  const ml = P.display(M, 1.5, 0.234, screenMaterial(dn, merchTex, { day: 1, night: 1.4 }));
  ml.position.set(Math.sin(mA) * 5.5, 2.15, Math.cos(mA) * 5.5); ml.rotation.y = mA + Math.PI; mg.add(ml);
  col.circle(Math.sin(mA) * 5.12, Math.cos(mA) * 5.12, 0.85);

  // ---- tall glass beverage fridge by the wall ----
  const bfA = -(40 * Math.PI) / 180;
  const bf = X.glassFridge(M, { w: 0.72, h: 1.95, d: 0.62, shelves: 4, label: true });
  bf.position.set(Math.sin(bfA) * (DR - 0.36), 0, Math.cos(bfA) * (DR - 0.36)); bf.rotation.y = bfA + Math.PI; inn.add(bf);
  col.circle(bf.position.x, bf.position.z, 0.5);
  // ---- ventilation: long-throw jet nozzles under the ring beam, exit sign at the terrace door ----
  for (const deg of [30, 70, 110, 250, 290, 330]) {
    const a = (deg * Math.PI) / 180;
    const nz = X.jetNozzle(M); nz.position.set(Math.sin(a) * (DR - 0.22), DRUM_H - 0.22, Math.cos(a) * (DR - 0.22)); nz.rotation.set(0.28, a + Math.PI, 0, 'YXZ'); inn.add(nz);
  }
  const ex2 = X.exitSign(M, dn); ex2.position.set(0, DRUM_H - 0.12, -DR + 0.16); inn.add(ex2);
  const clock = X.missionClock(M, dn, { w: 0.9, h: 0.225, place: 'USTYURT' }); clock.position.set(0, 2.5, -0.85); td.add(clock);
  const ahu = X.hvacUnit(M, { w: 2.2, h: 1.25, d: 1.2, fans: 2, label: 'AHU · DOME' });
  ahu.position.set(-7.9, 0, 1.5); ahu.rotation.y = -Math.PI / 2; world.add(ahu);
  world.add(X.duct(M, V(-7.3, 0.8, 1.5), V(-5.35, 0.8, 1.5), 0.42));
  world.add(X.duct(M, V(-7.3, 0.8, 0.6), V(-5.55, 0.8, 0.6), 0.3));
  col.box(-8.6, -7.2, 0.3, 2.7);

  // interior lights
  const lc = new THREE.PointLight('#FFC690', 16, 14, 2); lc.position.set(0, 4.4, 0);
  const le = new THREE.PointLight('#FFE0BC', 7, 9, 2); le.position.set(0, 2.9, 3.4);
  scene.add(lc, le);
  dn.prop(lc, 'intensity', 14, 18);
  dn.prop(le, 'intensity', 6, 8);
  col.arcWall(0, 0, DR, [[0, 0.21], [Math.PI, 0.14]]);
  progress(0.55);

  // ================= CORRIDOR =================
  const cor = new THREE.Group(); cor.name = 'airlock_corridor'; world.add(cor);
  const prof = hatchProfile(CORR_W, CORR_H, 0.62, 8);
  const smp = profileSampler(prof);
  const L = smp.length;
  const cports = [7.2, 9.6, 12.0, 14.4];
  const cs = new Set([CORR_Z0, CORR_Z1]);
  for (const c of cports) { cs.add(c - 0.45); cs.add(c + 0.45); }
  const csE = [...cs].sort((a, b) => a - b);
  const ctE = [0, 1.05, 1.95, L - 1.95, L - 1.05, L];
  const corGeo = tileSurface({
    sEdges: csE, tEdges: ctE, maxSeg: 0.3, map: corridorMapping(smp),
    tile: (i, j) => {
      const c = (csE[i] + csE[i + 1]) / 2;
      const isP = cports.some((p) => Math.abs(p - c) < 0.01);
      if (isP && Math.abs(c - SM_Z) < 0.01 && (j === 3 || j === 4)) return 'empty'; // door to the service module
      return isP && (j === 1 || j === 3) ? { hole: 0.3 } : 'solid';
    },
  });
  place(cor, corGeo, compDS, { name: 'corridor_tube' });
  const cfloor = new THREE.BoxGeometry(CORR_W, 0.1, CORR_Z1 - CORR_Z0 + 0.6); boxUV(cfloor);
  place(cor, cfloor, M.floor, { p: [0, -0.04, (CORR_Z0 + CORR_Z1) / 2 + 0.2] });
  for (const sx of [-1, 1]) {
    place(cor, new THREE.BoxGeometry(0.16, 0.16, CORR_Z1 - CORR_Z0), M.aluDark, { p: [sx * (CORR_W / 2 + 0.06), 0.08, (CORR_Z0 + CORR_Z1) / 2] });
    for (const z of cports) {
      if (sx > 0 && Math.abs(z - SM_Z) < 0.01) continue;
      const a = profileAt(smp, sx < 0 ? 1.5 : L - 1.5);
      const fr = P.portholeFrame(M, 0.3, { flange: 0.1, depth: 0.08 });
      fr.position.set(a.a, a.b, z); fr.rotation.y = sx * Math.PI / 2; cor.add(fr);
      const fi = P.portholeFrame(M, 0.3, { flange: 0.07, depth: 0.08 });
      fi.position.set(a.a, a.b, z); fi.rotation.y = -sx * Math.PI / 2; cor.add(fi);
      place(cor, new THREE.CircleGeometry(0.31, 28), M.glass, { p: [a.a, a.b, z], r: [0, sx * Math.PI / 2, 0], cast: false, receive: false });
    }
  }
  for (const z of [6.0, 8.4, 10.8, 13.2, 15.6]) place(cor, uFrame(hatchProfile(2.42, 2.64, 0.7, 10), prof, 0.16), M.alu, { p: [0, 0, z] });
  // collar where the tube meets the drum
  place(cor, uFrame(hatchProfile(2.9, 2.95, 0.35, 8), prof, 0.3), compDS, { p: [0, 0, DR + 0.12] });
  // entry hatch frame + LED + doors
  place(cor, uFrame(hatchProfile(2.6, 2.85, 0.75, 10), hatchProfile(1.5, 2.2, 0.42, 10), 0.16), compDS, { p: [0, 0, CORR_Z1 + 0.08] });
  const ledCurve = new THREE.CatmullRomCurve3(hatchProfile(1.58, 2.26, 0.45, 12).map(([a, b]) => V(a, b, CORR_Z1 + 0.175)));
  place(cor, new THREE.TubeGeometry(ledCurve, 80, 0.012, 6, false), M.ledOrange, { cast: false });
  place(cor, new THREE.BoxGeometry(0.4, 0.012, CORR_Z1 - CORR_Z0 - 0.4), M.ledWhite, { p: [0, CORR_H - 0.012, (CORR_Z0 + CORR_Z1) / 2], cast: false });
  // spine light on top (outside)
  place(cor, new THREE.BoxGeometry(0.06, 0.02, CORR_Z1 - CORR_Z0 - 0.6), M.ledOrange, { p: [0, CORR_H + 0.005, (CORR_Z0 + CORR_Z1) / 2], cast: false });
  const plTex = T.labelTexture({ w: 1024, h: 128, lines: [{ text: 'STATION 02 · ASTRO CITY', font: T.FONT_MONO, size: 56, weight: 500, spacing: 0.06, color: '#13223A' }] });
  place(cor, new THREE.PlaneGeometry(1.3, 0.16), new THREE.MeshStandardMaterial({ map: plTex, transparent: true, roughness: 0.6 }), { p: [0, 2.48, CORR_Z1 + 0.17], cast: false });
  for (const sx of [-1, 1]) {
    const d = new THREE.Group(); d.userData.dynamic = true;
    place(d, new THREE.BoxGeometry(0.78, 2.2, 0.018), M.glass, { cast: false, receive: false });
    place(d, new THREE.BoxGeometry(0.78, 0.05, 0.04), M.alu, { p: [0, 1.09, 0] });
    place(d, new THREE.BoxGeometry(0.04, 2.2, 0.04), M.alu, { p: [sx * 0.37, 0, 0] });
    place(d, new THREE.BoxGeometry(0.03, 0.5, 0.05), M.orange, { p: [-sx * 0.32, 0.05, 0.03] });
    d.position.set(sx * 0.39, 1.11, CORR_Z1 + 0.2);
    d.userData.closedX = sx * 0.39; d.userData.openX = sx * 1.08;
    cor.add(d); dynamic.doors.push({ g: d, at: [0, CORR_Z1] });
  }
  const entryLight = new THREE.PointLight('#FFC58A', 0, 10, 2); entryLight.position.set(0, 2.6, CORR_Z1 + 1.2);
  scene.add(entryLight); dn.prop(entryLight, 'intensity', 0, 6);
  col.seg(-CORR_W / 2 + 0.05, DR - 0.6, -CORR_W / 2 + 0.05, CORR_Z1 + 0.25);
  col.seg(CORR_W / 2 - 0.05, DR - 0.6, CORR_W / 2 - 0.05, SM_Z - 0.45).seg(CORR_W / 2 - 0.05, SM_Z + 0.45, CORR_W / 2 - 0.05, CORR_Z1 + 0.25);
  col.seg(-CORR_W / 2 - 0.2, DR, -CORR_W / 2 - 0.2, CORR_Z1 + 0.25);
  col.seg(CORR_W / 2 + 0.2, DR, CORR_W / 2 + 0.2, SM_Z - 1.1).seg(CORR_W / 2 + 0.2, SM_Z + 1.1, CORR_W / 2 + 0.2, CORR_Z1 + 0.25);

  // ================= SERVICE MODULE: restrooms (side node off the corridor) =================
  const sm = new THREE.Group(); sm.name = 'service_module_restrooms'; world.add(sm);
  const SM_W = 2.1, SM_H = 2.35, SX0 = 0.85, SX1 = 5.35, SP = 2.45;
  const sProf = hatchProfile(SM_W, SM_H, 0.55, 8);
  const sSmp = profileSampler(sProf);
  const toX = (g) => { g.rotateY(Math.PI / 2); g.translate(0, 0, SM_Z); return g; };
  place(sm, toX(tileSurface({ sEdges: [SX0, SX1], tEdges: [0, sSmp.length], maxSeg: 0.3, map: corridorMapping(sSmp), tile: () => 'solid' })), compDS, { name: 'service_module_tube' });
  const capS = new THREE.Shape(sProf.map(([a, b]) => new THREE.Vector2(a, b)));
  place(sm, toX(new THREE.ShapeGeometry(capS, 8)), compDS, { p: [SX1, 0, 0] });
  place(sm, toX(uFrame(hatchProfile(2.5, 2.62, 0.6, 10), sProf, 0.22)), compDS, { p: [1.32, 0, 0] });
  place(sm, toX(uFrame(hatchProfile(2.28, 2.5, 0.62, 10), sProf, 0.14)), M.alu, { p: [3.4, 0, 0] });
  place(sm, toX(uFrame(hatchProfile(2.28, 2.5, 0.62, 10), sProf, 0.14)), M.alu, { p: [SX1 - 0.07, 0, 0] });
  const smFloor = new THREE.BoxGeometry(SX1 - 1.0, 0.1, SM_W); boxUV(smFloor);
  place(sm, smFloor, M.floor, { p: [(1.0 + SX1) / 2, -0.04, SM_Z] });
  for (const sz of [-1, 1]) place(sm, new THREE.BoxGeometry(SX1 - 1.3, 0.16, 0.16), M.aluDark, { p: [(1.3 + SX1) / 2, 0.08, SM_Z + sz * (SM_W / 2 + 0.06)] });
  place(sm, new THREE.BoxGeometry(SX1 - 1.5, 0.02, 0.06), M.ledOrange, { p: [(1.5 + SX1) / 2, SM_H + 0.005, SM_Z], cast: false });
  const smv = X.roofVent(M, 0.2); smv.position.set(4.3, SM_H - 0.05, SM_Z); sm.add(smv);
  // door trim in the corridor wall
  for (const z of [SM_Z - 0.45, SM_Z + 0.45]) place(sm, new THREE.BoxGeometry(0.12, 1.95, 0.05), M.alu, { p: [CORR_W / 2, 0.975, z] });
  place(sm, new THREE.BoxGeometry(0.12, 0.05, 0.95), M.alu, { p: [CORR_W / 2 - 0.02, 1.95, SM_Z] });
  // vestibule: two washbasins with porthole mirrors
  const v1 = X.washbasin(M, { w: 0.58, d: 0.44 }); v1.position.set(1.85, 0, SM_Z - SM_W / 2); sm.add(v1);
  const v2 = X.washbasin(M, { w: 0.58, d: 0.44 }); v2.position.set(1.85, 0, SM_Z + SM_W / 2); v2.rotation.y = Math.PI; sm.add(v2);
  // partition with two WC doors
  const pS = new THREE.Shape();
  sProf.forEach(([a, b], i) => (i ? pS.lineTo(a, b) : pS.moveTo(a, b)));
  for (const [a, b] of [[0.9, 0], [0.9, 1.95], [0.15, 1.95], [0.15, 0], [-0.15, 0], [-0.15, 1.95], [-0.9, 1.95], [-0.9, 0]]) pS.lineTo(a, b);
  pS.closePath();
  const part = new THREE.ExtrudeGeometry(pS, { depth: 0.08, bevelEnabled: false });
  part.translate(0, 0, -0.04);
  place(sm, toX(part), M.whiteIn, { p: [SP, 0, 0] });
  place(sm, new THREE.BoxGeometry(SX1 - SP - 0.05, SM_H - 0.04, 0.08), M.whiteIn, { p: [(SP + SX1) / 2, (SM_H - 0.04) / 2, SM_Z] });
  const da = X.doorLeaf(M, 0.72, 1.92); da.position.set(SP + 0.02, 0, SM_Z - 0.9); da.rotation.y = -Math.PI / 2 + 1.25; sm.add(da);
  const db = X.doorLeaf(M, 0.72, 1.92); db.position.set(SP + 0.02, 0, SM_Z + 0.9); db.rotation.y = Math.PI / 2 - 1.25; sm.add(db);
  const sa = X.wcSign(M, dn, { title: 'WC A', icons: ['m', 'f', 'w'] }, 0.6); sa.position.set(SP - 0.05, 2.1, SM_Z - 0.52); sa.rotation.y = -Math.PI / 2; sm.add(sa);
  const sb = X.wcSign(M, dn, { title: 'WC B', icons: ['m', 'f'] }, 0.6); sb.position.set(SP - 0.05, 2.1, SM_Z + 0.52); sb.rotation.y = -Math.PI / 2; sm.add(sb);
  // WC cubicles: toilets on the end cap, paper holders, exhaust valves, lights
  for (const sz of [-1, 1]) {
    const z = SM_Z + sz * 0.53;
    const tl = X.toilet(M); tl.position.set(SX1 - 0.02, 0, z); tl.rotation.y = -Math.PI / 2; sm.add(tl);
    const ph = X.paperHolder(M); ph.position.set(4.55, 0, SM_Z + sz * 0.04); ph.rotation.y = sz > 0 ? 0 : Math.PI; sm.add(ph);
    const ev = X.exhaustValve(M, 0.08); ev.position.set(3.9, SM_H, z); sm.add(ev);
    place(sm, new THREE.BoxGeometry(0.9, 0.012, 0.3), M.ledWhite, { p: [3.4, SM_H - 0.006, z], cast: false });
  }
  place(sm, new THREE.BoxGeometry(1.0, 0.012, 0.4), M.ledWhite, { p: [1.8, SM_H - 0.006, SM_Z], cast: false });
  const ev0 = X.exhaustValve(M, 0.1); ev0.position.set(2.15, SM_H, SM_Z); sm.add(ev0);
  // wayfinding + safety in the corridor
  const wf = X.wcSign(M, dn, { title: 'RESTROOMS', icons: ['m', 'f', 'w'], both: true }, 0.8); wf.position.set(0.25, 2.14, SM_Z - 1.0); sm.add(wf);
  place(sm, new THREE.BoxGeometry(0.01, 0.25, 0.01), M.alu, { p: [0.25, 2.37, SM_Z - 1.0], cast: false });
  const ex1 = X.exitSign(M, dn); ex1.position.set(0, 2.2, 6.4); sm.add(ex1);
  const ext = X.extinguisher(M); ext.position.set(-CORR_W / 2, 0, 6.7); ext.rotation.y = Math.PI / 2; sm.add(ext);
  // HVAC unit for the module + duct into the end cap
  const hu = X.hvacUnit(M, { w: 1.6, h: 1.05, d: 0.95, fans: 2, label: 'HVAC · WC' }); hu.position.set(6.45, 0, SM_Z); hu.rotation.y = Math.PI / 2; sm.add(hu);
  sm.add(X.duct(M, V(5.97, 0.85, SM_Z), V(SX1, 0.85, SM_Z), 0.32));
  // collisions
  col.seg(1.1, SM_Z - SM_W / 2 + 0.03, SX1, SM_Z - SM_W / 2 + 0.03).seg(1.1, SM_Z + SM_W / 2 - 0.03, SX1, SM_Z + SM_W / 2 - 0.03).seg(SX1 - 0.02, SM_Z - 1.05, SX1 - 0.02, SM_Z + 1.05);
  col.seg(SP, SM_Z - 1.05, SP, SM_Z - 0.9).seg(SP, SM_Z - 0.15, SP, SM_Z + 0.15).seg(SP, SM_Z + 0.9, SP, SM_Z + 1.05).seg(SP, SM_Z, SX1, SM_Z);
  col.box(4.65, SX1, SM_Z - 0.85, SM_Z - 0.2).box(4.65, SX1, SM_Z + 0.2, SM_Z + 0.85);
  col.box(1.55, 2.15, SM_Z - 1.05, SM_Z - 0.6).box(1.55, 2.15, SM_Z + 0.6, SM_Z + 1.05);
  col.box(5.95, 6.95, SM_Z - 0.85, SM_Z + 0.85);
  progress(0.62);

  // ================= TERRACE =================
  const ter = new THREE.Group(); ter.name = 'terrace'; world.add(ter);
  const deckMat = new THREE.MeshStandardMaterial({ name: 'deck', color: '#3A3F47', roughness: 0.7, metalness: 0.1 });
  const deck = new THREE.BoxGeometry(TER.x1 - TER.x0, 0.32, TER.z1 - TER.z0); boxUV(deck);
  place(ter, deck, deckMat, { p: [(TER.x0 + TER.x1) / 2, -0.12, (TER.z0 + TER.z1) / 2] });
  const deckLines = [];
  for (let z = TER.z0 + 0.15; z < TER.z1; z += 0.3) deckLines.push(new THREE.BoxGeometry(TER.x1 - TER.x0 - 0.1, 0.004, 0.012).translate(0, 0.041, z));
  // railing: glass + rail + LED
  const railLen = [[TER.x0, TER.z0, TER.x1, TER.z0], [TER.x0, TER.z0, TER.x0, TER.z1], [TER.x1, TER.z0, TER.x1, TER.z1]];
  for (const [ax, az, bx, bz] of railLen) {
    const len = Math.hypot(bx - ax, bz - az), cx = (ax + bx) / 2, cz = (az + bz) / 2, ry = Math.atan2(bx - ax, bz - az) + Math.PI / 2;
    place(ter, new THREE.BoxGeometry(len, 1.0, 0.02), M.glass, { p: [cx, 0.56, cz], r: [0, ry, 0], cast: false, receive: false });
    place(ter, roundedBox(len, 0.05, 0.08, 0.02), M.alu, { p: [cx, 1.08, cz], r: [0, ry, 0] });
    place(ter, new THREE.BoxGeometry(len, 0.06, 0.06), M.aluDark, { p: [cx, 0.06, cz], r: [0, ry, 0] });
    place(ter, new THREE.BoxGeometry(len, 0.015, 0.02), M.ledWarm, { p: [cx, 0.1, cz], r: [0, ry, 0], cast: false });
    for (let f = 0; f <= len + 0.01; f += 1.5) {
      const x = ax + ((bx - ax) * f) / len, z = az + ((bz - az) * f) / len;
      place(ter, new THREE.BoxGeometry(0.05, 1.08, 0.05), M.alu, { p: [x, 0.56, z] });
    }
    col.seg(ax, az, bx, bz);
  }
  place(ter, mergeList(deckLines), M.graphite, { cast: false });
  // terrace seating: three lounge tables
  for (const [x, z] of [[-4.3, -8.0], [-3.2, -11.0], [0.4, -11.2]]) {
    const t = P.roundTable(M, 0.4, 0.74, M.lunar); t.position.set(x, 0.04, z); ter.add(t);
    for (const [dx, dz, ry] of [[0, 0.58, Math.PI], [0, -0.58, 0], [0.58, 0, -Math.PI / 2], [-0.58, 0, Math.PI / 2]]) {
      const c = P.chair(M); c.position.set(x + dx, 0.04, z + dz); c.rotation.y = ry; ter.add(c);
    }
    col.circle(x, z, 0.8);
  }
  // telescope
  const tel = telescope(M); tel.position.set(4.3, 0.04, -10.7); tel.rotation.y = 0.5; ter.add(tel);
  col.circle(4.3, -10.7, 0.6);
  const tPool = lightPoolMaterial(dn, '#FFB46B', 0, 0.2);
  place(fx, new THREE.PlaneGeometry(TER.x1 - TER.x0, TER.z1 - TER.z0), tPool, { p: [0, 0.05, (TER.z0 + TER.z1) / 2], r: [-Math.PI / 2, 0, 0], cast: false, receive: false });
  progress(0.7);

  // ================= SURROUNDINGS =================
  const env = new THREE.Group(); env.name = 'surroundings'; world.add(env);
  const gy = (x, z) => H(x, z);
  // solar field (instanced)
  const solar = solarField(M, gy);
  env.add(solar.group);
  col.box(14.5, 33.5, -9, 15);
  // antenna mast + dish
  const mast = antennaMast(M, 16);
  mast.position.set(-15, gy(-15, 9), 9); env.add(mast);
  dynamic.beacons.push(mast.userData.beacon);
  col.circle(-15, 9, 1.2);
  const dish = dishAntenna(M);
  dish.position.set(-11.5, gy(-11.5, -2), -2); dish.rotation.y = 2.4; env.add(dish);
  col.circle(-11.5, -2, 1.6);
  // rover
  const rover = makeRover(M, dn);
  rover.position.set(-4.6, gy(-4.6, 20.2), 20.2); rover.rotation.y = 0.55; env.add(rover);
  col.circle(-4.6, 20.2, 1.8);
  // signposts towards the gate
  const sign1 = signpost(M, dn, [
    { text: 'ASTRO CITY GATE  2.4 KM', dir: 1, color: '#FF6A1A' },
    { text: 'SUNSET TERRACE', dir: -1, color: '#13223A' },
    { text: 'ROVER PARK', dir: -1, color: '#13223A' },
  ]);
  sign1.position.set(3.4, gy(3.4, 23), 23); sign1.rotation.y = -Math.PI / 2 + 0.55; env.add(sign1);
  col.circle(3.4, 23, 0.25);
  const sign2 = signpost(M, dn, [{ text: 'ASTRO CITY GATE  2.2 KM', dir: 1, color: '#FF6A1A' }, { text: 'STATION 02', dir: -1, color: '#13223A' }]);
  const s2z = 58, s2x = terrainFn.roadX(s2z) + 4;
  sign2.position.set(s2x, gy(s2x, s2z), s2z); sign2.rotation.y = -Math.PI / 2; env.add(sign2);
  // the gate far down the road
  const gz = 230, gx = terrainFn.roadX(gz);
  const gate = gateArch(M, dn);
  gate.position.set(gx, gy(gx, gz) - 0.2, gz); env.add(gate);
  // rocks
  env.add(rocks(M, gy, edgeZ, quality));
  // tyre tracks along the graded road (decal ribbon following the terrain)
  fx.add(tyreTracks(terrainFn, gy));
  // LED bollards along the approach + light pools
  const bollardPool = lightPoolMaterial(dn, '#FFB46B', 0, 0.45);
  for (const z of [19.0, 21.6, 24.2, 26.8]) for (const sx of [-1, 1]) {
    const x = terrainFn.roadX(z) + sx * 2.3, y = gy(x, z);
    place(env, new THREE.CylinderGeometry(0.075, 0.09, 0.72, 14), M.aluDark, { p: [x, y + 0.36, z] });
    place(env, new THREE.CylinderGeometry(0.078, 0.078, 0.08, 14), M.ledWarm, { p: [x, y + 0.66, z], cast: false });
    place(env, new THREE.CylinderGeometry(0.09, 0.09, 0.02, 14), M.aluDark, { p: [x, y + 0.72, z] });
    place(fx, new THREE.PlaneGeometry(2.4, 2.4), bollardPool, { p: [x, y + 0.03, z], r: [-Math.PI / 2, 0, 0], cast: false, receive: false });
    col.circle(x, z, 0.12);
  }
  progress(0.8);

  // ================= PILOT STATION: HAB + LAB modules (Ø3.4 × 10 m) =================
  const hab = new THREE.Group(); hab.name = 'pilot_station_HAB_LAB'; hab.position.x = HAB.x; world.add(hab);
  const { R: HR, AY, FL } = HAB;
  const circle = (r, cy, n = 48) => Array.from({ length: n + 1 }, (_, k) => { const a = -Math.PI / 2 - (k / n) * Math.PI * 2; return [Math.cos(a) * r, cy + Math.sin(a) * r]; });
  const hSmp = profileSampler(circle(HR, AY, 64));
  const per = hSmp.length;
  const tOf = (deg) => { let a = (-90 - deg) % 360; if (a < 0) a += 360; return (a / 360) * per; };
  const yWin = FL + 1.45, angW = (Math.asin((yWin - AY) / HR) * 180) / Math.PI;
  const tL = tOf(180 - angW), tR = tOf(angW);
  const modTube = (z0, z1, wins) => {
    const sE = new Set([z0, z1]);
    for (const w of wins) { sE.add(w - 0.45); sE.add(w + 0.45); }
    const sEdges = [...sE].sort((a, b) => a - b);
    const tEdges = [0, tL - 0.45, tL + 0.45, tR - 0.45, tR + 0.45, per];
    return tileSurface({
      sEdges, tEdges, maxSeg: 0.35, map: corridorMapping(hSmp),
      tile: (i, j) => { const c = (sEdges[i] + sEdges[i + 1]) / 2; return wins.some((w) => Math.abs(w - c) < 0.01) && (j === 1 || j === 3) ? { hole: 0.26 } : 'solid'; },
    });
  };
  const winsA = [-5.4, -1.8, 1.6], winsB = [6.2, 9.0];
  place(hab, modTube(HAB.A[0], HAB.A[1], winsA), compDS, { name: 'HAB_module' });
  place(hab, modTube(HAB.B[0], HAB.B[1], winsB), compDS, { name: 'LAB_module' });
  for (const [ws, sides] of [[winsA, [-1, 1]], [winsB, [-1, 1]]]) for (const z of ws) for (const sx of sides) {
    const a = (sx < 0 ? 180 - angW : angW) * Math.PI / 180;
    const px = Math.cos(a) * HR, py = AY + Math.sin(a) * HR;
    const f = P.portholeFrame(M, 0.26, { flange: 0.09, depth: 0.08 }); f.position.set(px, py, z); f.rotation.set(0, sx * Math.PI / 2, 0); f.rotateX(-sx * 0); hab.add(f);
    const fi = P.portholeFrame(M, 0.26, { flange: 0.06, depth: 0.08 }); fi.position.set(px, py, z); fi.rotation.y = -sx * Math.PI / 2; hab.add(fi);
    place(hab, new THREE.CircleGeometry(0.27, 24), M.glass, { p: [px, py, z], r: [0, sx * Math.PI / 2, 0], cast: false, receive: false });
  }
  // node between the modules
  const nSmp = profileSampler(circle(0.93, FL + 0.92, 32));
  place(hab, tileSurface({ sEdges: [HAB.NODE[0] - 0.05, HAB.NODE[1] + 0.05], tEdges: [0, nSmp.length], maxSeg: 0.3, map: corridorMapping(nSmp), tile: () => 'solid' }), compDS, {});
  place(hab, new THREE.TorusGeometry(0.97, 0.05, 6, 32), M.ledOrange, { p: [0, FL + 0.92, (HAB.NODE[0] + HAB.NODE[1]) / 2], cast: false });
  // end caps with hatches
  const hatchPath = () => { const p2 = new THREE.Path(); const w = 0.45, y0 = FL + 0.04, y1 = FL + 1.78, r = 0.3; p2.moveTo(-w, y0); p2.lineTo(w, y0); p2.lineTo(w, y1 - r); p2.quadraticCurveTo(w, y1, w - r, y1); p2.lineTo(-w + r, y1); p2.quadraticCurveTo(-w, y1, -w, y1 - r); p2.closePath(); return p2; };
  const cap = (hatch) => { const sh = new THREE.Shape(); sh.absarc(0, AY, HR, 0, Math.PI * 2, false); if (hatch) sh.holes.push(hatchPath()); return new THREE.ShapeGeometry(sh, 32); };
  for (const [z, h] of [[HAB.A[0], false], [HAB.A[1], true], [HAB.B[0], true], [HAB.B[1], true]]) place(hab, cap(h), compDS, { p: [0, 0, z] });
  for (const z of [HAB.A[1], HAB.B[0], HAB.B[1]]) {
    const fr = new THREE.Shape(); fr.moveTo(-0.6, FL); fr.lineTo(0.6, FL); fr.lineTo(0.6, FL + 1.95); fr.lineTo(-0.6, FL + 1.95); fr.closePath(); fr.holes.push(hatchPath());
    const fg = new THREE.ExtrudeGeometry(fr, { depth: 0.12, bevelEnabled: false }); fg.translate(0, 0, -0.06);
    place(hab, fg, M.alu, { p: [0, 0, z] });
  }
  // EVA hatch leaf (open, outward) + LED ring
  const hl = X.doorLeaf(M, 0.86, 1.72, M.aluSatin); hl.position.set(0.45, FL + 0.04, HAB.B[1] + 0.08); hl.rotation.y = -1.9; hab.add(hl);
  // ring frames, saddles, handrails, labels
  for (const z of [HAB.A[0] + 0.12, -2.0, HAB.A[1] - 0.12, HAB.B[0] + 0.12, 9.2, HAB.B[1] - 0.12]) place(hab, new THREE.TorusGeometry(HR + 0.025, 0.055, 6, 56), M.alu, { p: [0, AY, z] });
  for (const z of [-5.8, -0.5, 1.9, 5.4, 9.6, 13.0]) {
    place(hab, new THREE.BoxGeometry(2.4, 0.5, 0.35), M.aluDark, { p: [0, 0.25, z] });
    for (const sx of [-1, 1]) place(hab, new THREE.BoxGeometry(0.2, 0.6, 0.3), M.aluDark, { p: [sx * 1.15, 0.62, z], r: [0, 0, sx * 0.6] });
  }
  for (const [z0, z1] of [HAB.A, HAB.B]) for (const sx of [-1, 1]) {
    const a = (sx < 0 ? 145 : 35) * Math.PI / 180;
    const hr = P.handrail(M, (z1 - z0) - 1.0); hr.rotation.set(0, sx < 0 ? -Math.PI / 2 : Math.PI / 2, 0);
    hr.position.set(Math.cos(a) * HR, AY + Math.sin(a) * HR, (z0 + z1) / 2); hab.add(hr);
  }
  for (const [txt, z0, z1] of [['ASTRA HAB-1', HAB.A[0], HAB.A[1]], ['ASTRA LAB-1', HAB.B[0], HAB.B[1]]]) {
    const tex = T.labelTexture({ w: 1024, h: 160, lines: [{ text: txt, size: 92, weight: 800, spacing: 0.22, color: '#13223A' }] });
    const mat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.5 });
    for (const sx of [-1, 1]) {
      const a = (sx < 0 ? 150 : 30) * Math.PI / 180;
      const lbl = place(hab, new THREE.PlaneGeometry(2.4, 0.38), mat, { p: [Math.cos(a) * (HR + 0.012), AY + Math.sin(a) * (HR + 0.012), (z0 + z1) / 2], cast: false });
      lbl.rotation.set(0, sx * Math.PI / 2, sx * (Math.PI / 6), 'ZYX'); // face outwards, tilted with the hull
    }
  }
  // floors + LED strips
  for (const [z0, z1] of [HAB.A, HAB.B, HAB.NODE]) {
    const fg = new THREE.BoxGeometry(2.4, 0.06, z1 - z0); boxUV(fg);
    place(hab, fg, M.floor, { p: [0, FL - 0.03, (z0 + z1) / 2] });
    if (z1 - z0 > 2) place(hab, new THREE.BoxGeometry(0.3, 0.012, z1 - z0 - 1.2), M.ledWhite, { p: [0, AY + HR - 0.12, (z0 + z1) / 2], cast: false });
  }
  // --- HAB interior: bunks, galley, hygiene, lockers ---
  const mattress = new THREE.MeshStandardMaterial({ name: 'bunk', color: '#2B3E5C', roughness: 0.85 });
  for (const sx of [-1, 1]) for (const yy of [0.38, 1.22]) {
    place(hab, new THREE.BoxGeometry(0.78, 0.06, 2.0), M.aluDark, { p: [sx * 0.8, FL + yy, -5.8] });
    place(hab, roundedBox(0.72, 0.12, 1.92, 0.04), mattress, { p: [sx * 0.8, FL + yy + 0.09, -5.8] });
    place(hab, new THREE.BoxGeometry(0.74, 0.02, 0.6), M.whiteIn, { p: [sx * 0.8, FL + yy + 0.16, -6.45], cast: false });
  }
  for (const sx of [-1, 1]) place(hab, new THREE.BoxGeometry(0.04, 1.5, 2.0), M.aluDark, { p: [sx * 0.39, FL + 0.75, -5.8] });
  const tbl = new THREE.Group(); tbl.position.set(0, FL, -1.8); hab.add(tbl);
  place(tbl, roundedBox(0.8, 0.04, 1.4, 0.06), M.whiteIn, { p: [0, 0.74, 0] });
  place(tbl, new THREE.CylinderGeometry(0.05, 0.06, 0.72, 10), M.alu, { p: [0, 0.36, 0] });
  for (const [x, z] of [[-0.55, -0.4], [-0.55, 0.4], [0.55, -0.4], [0.55, 0.4]]) { const st = P.barStool(M); st.scale.setScalar(0.62); st.position.set(x, 0, z); tbl.add(st); }
  const gk = new THREE.BoxGeometry(0.45, 0.9, 1.6); boxUV(gk);
  place(hab, gk, M.steel, { p: [0.96, FL + 0.45, 0.9] });
  const gsk = X.counterSink(M, 0.3, 0.26); gsk.position.set(0.95, FL + 0.9, 0.5); gsk.rotation.y = -Math.PI / 2; hab.add(gsk);
  const gfr = X.fridgeTall(M, { w: 0.5, h: 0.82, d: 0.04, doors: 1 }); gfr.position.set(0.72, FL + 0.02, 1.2); gfr.rotation.y = -Math.PI / 2; hab.add(gfr);
  const hyg = new THREE.BoxGeometry(0.9, 2.0, 1.4); boxUV(hyg);
  place(hab, hyg, M.whiteIn, { p: [-0.75, FL + 1.0, 1.4] });
  const hdoor = X.wcSign(M, dn, { title: 'HYGIENE', icons: ['m', 'f'] }, 0.5); hdoor.position.set(-0.29, FL + 1.75, 1.4); hdoor.rotation.y = Math.PI / 2; hab.add(hdoor);
  const hclock = X.missionClock(M, dn, { w: 0.8, h: 0.2, place: 'USTYURT' }); hclock.position.set(0, FL + 1.55, HAB.A[0] + 0.06); hab.add(hclock);
  // --- LAB interior: benches, life-support panel, EVA suit rack ---
  for (const sx of [-1, 1]) {
    const bench = new THREE.BoxGeometry(0.55, 0.9, 3.6); boxUV(bench);
    place(hab, bench, M.steel, { p: [sx * 0.9, FL + 0.45, 6.9] });
    place(hab, new THREE.BoxGeometry(0.6, 0.03, 3.7), M.stoneTop, { p: [sx * 0.9, FL + 0.915, 6.9] });
    for (const z of [5.6, 7.0, 8.3]) place(hab, roundedBox(0.04, 0.32, 0.5, 0.02), M.screenOff, { p: [sx * 1.12, FL + 1.25, z], r: [0, 0, sx * 0.25], cast: false });
  }
  const labTex = T.labelTexture({ w: 1024, h: 512, bg: '#06090F', lines: [
    { text: 'LIFE SUPPORT', size: 70, weight: 800, spacing: 0.14, y: 0.18, color: '#F4F6F8' },
    { text: 'O₂  ·  CO₂  ·  H₂O  ·  POWER', font: T.FONT_MONO, size: 44, weight: 500, y: 0.42, color: '#6FA8FF' },
    { text: 'AIRTIGHTNESS & AIR TESTS', font: T.FONT_MONO, size: 34, weight: 500, y: 0.62, color: '#F2C230' },
    { text: 'TEST MODE · PLANNED', font: T.FONT_MONO, size: 34, weight: 500, y: 0.82, color: '#FF6A1A' }] });
  const eclss = P.display(M, 1.1, 0.55, screenMaterial(dn, labTex, { day: 1, night: 1.3 }));
  eclss.position.set(-1.1, FL + 1.35, 10.6); eclss.rotation.y = Math.PI / 2; eclss.rotation.z = -0.2; hab.add(eclss);
  for (const [z] of [[5.8], [7.6]]) { place(hab, new THREE.CylinderGeometry(0.04, 0.06, 0.32, 12), M.graphite, { p: [-0.85, FL + 1.09, z] }); place(hab, new THREE.BoxGeometry(0.22, 0.12, 0.3), M.lunar, { p: [0.85, FL + 0.99, z] }); }
  place(hab, new THREE.BoxGeometry(0.06, 2.0, 2.2), M.aluDark, { p: [1.15, FL + 1.0, 12.4] });
  // lights for both modules
  const habLight = new THREE.PointLight('#FFE6CC', 4, 15, 2); habLight.position.set(HAB.x, FL + 1.9, 3.6);
  scene.add(habLight); dn.prop(habLight, 'intensity', 3.5, 5);
  // outside: EVA platform with steps, sign
  place(hab, new THREE.BoxGeometry(2.2, 0.08, 1.4), M.aluSatin, { p: [0, FL - 0.04, HAB.B[1] + 0.7] });
  for (let k = 1; k <= 3; k++) place(hab, new THREE.BoxGeometry(1.4, 0.04, 0.32), M.aluSatin, { p: [0, FL - k * (FL / 4) - 0.02, HAB.B[1] + 1.4 + k * 0.3] });
  for (const sx of [-1, 1]) { place(hab, new THREE.BoxGeometry(0.05, FL, 1.4), M.aluDark, { p: [sx * 0.72, FL / 2, HAB.B[1] + 2.0] }); place(hab, cylinderBetween(V(sx * 0.72, FL + 0.95, HAB.B[1] + 1.2), V(sx * 0.72, 0.95, HAB.B[1] + 2.6), 0.018), M.alu, {}); }
  const psTex = T.labelTexture({ w: 1024, h: 256, bg: '#13223A', lines: [{ text: 'PILOT STATION', size: 84, weight: 800, spacing: 0.16, y: 0.38, color: '#F4F6F8' }, { text: 'MISSION 001 · PLANNED', font: T.FONT_MONO, size: 40, weight: 500, spacing: 0.1, y: 0.76, color: '#F2C230' }] });
  const ps = new THREE.Group(); ps.position.set(2.4, 0, HAB.B[1] + 2.6); ps.rotation.y = -0.4; hab.add(ps);
  for (const x of [-0.8, 0.8]) place(ps, new THREE.BoxGeometry(0.06, 2.0, 0.06), M.aluDark, { p: [x, 1.0, 0] });
  place(ps, new THREE.PlaneGeometry(1.9, 0.48), screenMaterial(dn, psTex, { day: 0.8, night: 1.3 }), { p: [0, 1.75, 0.04], cast: false });
  // water tanks + power container with cable tray
  const tankMat = new THREE.MeshStandardMaterial({ name: 'water-tank', color: '#E9EDF0', roughness: 0.4, metalness: 0.2 });
  for (const z of [-1.2, 1.4]) {
    place(hab, new THREE.CylinderGeometry(0.9, 0.9, 3.2, 28), tankMat, { p: [-6.5, 1.25, z], r: [0, 0, Math.PI / 2] });
    place(hab, new THREE.CylinderGeometry(0.915, 0.915, 0.25, 28), M.deep, { p: [-6.5, 1.25, z], r: [0, 0, Math.PI / 2] });
    for (const x of [-7.6, -5.4]) place(hab, new THREE.BoxGeometry(0.3, 0.5, 1.6), M.aluDark, { p: [x, 0.25, z] });
  }
  const h2o = T.labelTexture({ w: 256, h: 128, lines: [{ text: 'H₂O', size: 80, weight: 800, color: '#DDE3EA' }] });
  place(hab, new THREE.PlaneGeometry(0.5, 0.25), new THREE.MeshStandardMaterial({ map: h2o, transparent: true }), { p: [-6.5, 1.25, 2.34], cast: false });
  const pc = new THREE.Group(); pc.position.set(-7.0, 0, 8.5); hab.add(pc);
  place(pc, new THREE.BoxGeometry(2.4, 2.6, 6.0), M.graphite, { p: [0, 1.3, 0] });
  place(pc, new THREE.BoxGeometry(2.42, 0.18, 6.02), M.orange, { p: [0, 2.2, 0], cast: false });
  for (let k = 0; k < 9; k++) place(pc, new THREE.BoxGeometry(2.44, 2.2, 0.03), M.aluDark, { p: [0, 1.15, -2.8 + k * 0.7], cast: false });
  const pwTex = T.labelTexture({ w: 1024, h: 192, bg: '#181E27', lines: [{ text: 'POWER · BATTERY', size: 76, weight: 800, spacing: 0.14, y: 0.42, color: '#F2C230' }, { text: 'SOLAR · INVERTER · STORAGE', font: T.FONT_MONO, size: 34, weight: 500, y: 0.8, color: '#DDE3EA' }] });
  place(pc, new THREE.PlaneGeometry(3.4, 0.64), screenMaterial(dn, pwTex, { day: 0.7, night: 1.2 }), { p: [1.215, 1.5, 0], r: [0, Math.PI / 2, 0], cast: false });
  place(hab, new THREE.BoxGeometry(4.0, 0.12, 0.3), M.aluDark, { p: [-3.6, 0.06, 8.5] });
  // collisions: hull (inside and outside), interior furniture, tanks, container
  const hx = HAB.x;
  for (const [z0, z1] of [HAB.A, HAB.B]) for (const sx of [-1, 1]) { col.seg(hx + sx * 1.15, z0, hx + sx * 1.15, z1); col.seg(hx + sx * 1.75, z0, hx + sx * 1.75, z1); }
  col.seg(hx - 1.75, HAB.A[0], hx + 1.75, HAB.A[0]);
  for (const z of [HAB.A[1], HAB.B[0], HAB.B[1]]) col.seg(hx - 1.75, z, hx - 0.45, z).seg(hx + 0.45, z, hx + 1.75, z);
  col.seg(hx - 0.85, HAB.NODE[0], hx - 0.85, HAB.NODE[1]).seg(hx + 0.85, HAB.NODE[0], hx + 0.85, HAB.NODE[1]);
  col.box(hx - 1.2, hx - 0.38, -6.8, -4.8).box(hx + 0.38, hx + 1.2, -6.8, -4.8).box(hx - 0.5, hx + 0.5, -2.5, -1.1);
  col.box(hx + 0.72, hx + 1.2, 0.1, 1.7).box(hx - 1.2, hx - 0.3, 0.7, 2.1);
  col.box(hx - 1.2, hx - 0.6, 5.1, 8.7).box(hx + 0.6, hx + 1.2, 5.1, 8.7).box(hx + 1.0, hx + 1.2, 11.3, 13.5);
  col.box(hx - 8.2, hx - 4.8, -2.2, 2.4).box(hx - 8.3, hx - 5.7, 5.4, 11.6);

  // ================= DUST STORM (mission scenario) =================
  const storm = { target: 0, v: 0 };
  const dustColor = new THREE.Color();
  const dustDome = new THREE.Mesh(new THREE.SphereGeometry(70, 32, 16), new THREE.MeshBasicMaterial({ name: 'dust-dome', color: '#B9784E', transparent: true, opacity: 0, side: THREE.BackSide, depthWrite: false, fog: false }));
  dustDome.renderOrder = 5; dustDome.frustumCulled = false; dustDome.visible = false; dustDome.userData.noExport = true;
  scene.add(dustDome);
  const nDust = quality.tier === 'low' ? 900 : 2200, rD = rng(9);
  const dPos = new Float32Array(nDust * 3), dSize = new Float32Array(nDust);
  for (let i = 0; i < nDust; i++) { dPos.set([(rD() - 0.5) * 80, rD() * 16, (rD() - 0.5) * 80], i * 3); dSize[i] = 1.5 + rD() * 4; }
  const dGeo = new THREE.BufferGeometry();
  dGeo.setAttribute('position', new THREE.BufferAttribute(dPos, 3)); dGeo.setAttribute('size', new THREE.BufferAttribute(dSize, 1));
  const dMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uStorm: { value: 0 }, uCam: { value: new THREE.Vector3() }, uColor: { value: new THREE.Color('#D49A6A') }, uPR: { value: 1 } },
    vertexShader: `attribute float size; uniform float uTime, uPR; uniform vec3 uCam; varying float vA;
      void main(){ vec3 p = position; p.x = mod(p.x + uTime * 9.0 - uCam.x + 40.0, 80.0) - 40.0 + uCam.x; p.z = mod(p.z + uTime * 2.5 - uCam.z + 40.0, 80.0) - 40.0 + uCam.z; p.y += sin(uTime * 1.3 + position.x) * 0.6;
        vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = size * uPR * (18.0 / max(1.0, -mv.z)); vA = clamp(1.0 - (-mv.z) / 45.0, 0.0, 1.0); }`,
    fragmentShader: `uniform float uStorm; uniform vec3 uColor; varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; gl_FragColor = vec4(uColor, (0.5 - d) * 1.4 * uStorm * vA); }`,
    transparent: true, depthWrite: false, fog: false,
  });
  const dust = new THREE.Points(dGeo, dMat); dust.frustumCulled = false; dust.visible = false; dust.renderOrder = 6; dust.userData.noExport = true;
  scene.add(dust);
  let lastNight = 0;
  const baseRef = { sun: 0, hemi: 0, fogD: 0, fogC: new THREE.Color() };
  const captureBase = () => { baseRef.sun = base.sun.intensity; baseRef.hemi = base.hemi.intensity; baseRef.fogD = base.fog.density; baseRef.fogC.copy(base.fog.color); };

  // ================= PEOPLE =================
  const ppl = new THREE.Group(); ppl.name = 'scale_figures'; world.add(ppl);
  const people = [
    { x: 0.95, z: 0, rot: Math.PI / 2, pose: 'stand', h: 1.74 },
    { x: Math.sin(stoolAngles[1]) * 2.1, z: Math.cos(stoolAngles[1]) * 2.1, pose: 'barsit', h: 1.7 },
    { x: Math.sin(stoolAngles[3]) * 2.1, z: Math.cos(stoolAngles[3]) * 2.1, pose: 'barsit', h: 1.8 },
    { x: Math.sin(stoolAngles[6]) * 2.1, z: Math.cos(stoolAngles[6]) * 2.1, pose: 'barsit', h: 1.66 },
    { x: tableAt[0][0], z: tableAt[0][1] + 0.55, rot: Math.PI, pose: 'sit', h: 1.72 },
    { x: tableAt[0][0] + 0.55, z: tableAt[0][1], rot: -Math.PI / 2, pose: 'sit', h: 1.78 },
    { x: tableAt[2][0], z: tableAt[2][1] - 0.55, rot: 0, pose: 'sit', h: 1.68 },
    { x: tableAt[3][0] - 0.55, z: tableAt[3][1], rot: Math.PI / 2, pose: 'sit', h: 1.75 },
    { x: Math.cos(1.0) * 4.62, z: -Math.sin(1.0) * 4.62, rot: Math.atan2(Math.cos(1.0), -Math.sin(1.0)), pose: 'barsit', h: 1.7 },
    { x: Math.cos(2.13) * 4.62, z: -Math.sin(2.13) * 4.62, rot: Math.atan2(Math.cos(2.13), -Math.sin(2.13)), pose: 'barsit', h: 1.76 },
    { x: Math.sin(tdA) * 5.0, z: Math.cos(tdA) * 5.0, rot: tdA + Math.PI, pose: 'stand', h: 1.7 },
    { x: Math.sin(tdA) * 3.75, z: Math.cos(tdA) * 3.75, rot: tdA, pose: 'stand', h: 1.8 },
    { x: Math.sin(mA) * 4.35, z: Math.cos(mA) * 4.35, rot: mA, pose: 'lean', h: 1.66 },
    // terrace
    { x: 3.7, y: 0.04, z: -10.2, rot: 2.6, pose: 'stand', h: 1.78 },
    { x: -1.6, y: 0.04, z: -12.0, rot: Math.PI, pose: 'lean', h: 1.68 },
    { x: -0.8, y: 0.04, z: -12.0, rot: Math.PI + 0.2, pose: 'stand', h: 1.82 },
    { x: -4.3, y: 0.04, z: -7.42, rot: Math.PI, pose: 'sit', h: 1.7 },
    // outside
    { x: -2.6, z: 21.6, rot: -2.4, pose: 'stand', h: 1.75 },
    { x: -3.2, z: 22.4, rot: -2.0, pose: 'lean', h: 1.64 },
    { x: 1.0, z: 26, rot: Math.PI, pose: 'walk', h: 1.78 },
    // EVA crew from the pilot station heading to the rover, suits on the rack in the LAB
    { x: -15.6, z: 17.6, rot: 1.25, pose: 'walk', h: 1.8, suit: true },
    { x: -14.2, z: 18.9, rot: 1.1, pose: 'walk', h: 1.74, suit: true },
    { x: HAB.x - 0.3, z: HAB.B[1] + 3.6, rot: 0.3, pose: 'stand', h: 1.78, suit: true },
    { x: HAB.x + 0.8, y: HAB.FL, z: 11.8, rot: -Math.PI / 2, pose: 'stand', h: 1.78, suit: true },
    { x: HAB.x + 0.8, y: HAB.FL, z: 13.0, rot: -Math.PI / 2, pose: 'stand', h: 1.72, suit: true },
    { x: HAB.x - 0.2, y: HAB.FL, z: -1.25, rot: Math.PI, pose: 'sit', h: 1.74 },
    { x: HAB.x - 0.4, y: HAB.FL, z: 7.4, rot: -Math.PI / 2, pose: 'stand', h: 1.7 },
  ];
  for (const p of people) {
    if (p.rot === undefined) p.rot = Math.atan2(-p.x, -p.z);
    if (p.y === undefined) p.y = Math.hypot(p.x, p.z) < DR + 2 ? 0 : Math.max(-0.08, H(p.x, p.z));
    addPerson(ppl, M.person, p);
  }

  // contact shadows inside
  const csm = contactShadowMaterial(0.45);
  for (const [x, z] of tableAt) place(fx, new THREE.PlaneGeometry(1.9, 1.9), csm, { p: [x, 0.02, z], r: [-Math.PI / 2, 0, 0], cast: false, receive: false });
  place(fx, new THREE.PlaneGeometry(5.2, 5.2), csm, { p: [0, 0.02, 0], r: [-Math.PI / 2, 0, 0], cast: false, receive: false });

  // ================= merge =================
  const stats = mergeStatic(world);
  const fxStats = mergeStatic(fx);
  progress(0.92);

  const domeLayer = [];
  world.traverse((o) => { if (o.userData.layer === 'dome' || o.name === 'merged:dome-panels' || o.name === 'merged:dome-glass' || o.name === 'dome_struts' || o.name === 'dome_hubs') domeLayer.push(o); });

  const Z = ZONES.astrocity;
  const hotspots = [
    { id: 'dome', pos: [0, DRUM_H + DR + 0.8, 0], zone: 'out', ...Z.dome },
    { id: 'corridor', pos: [1.8, 2.6, 12.5], zone: 'out', ...Z.corridor },
    { id: 'rover', pos: [-4.6, 2.6, 20.2], zone: 'out', ...Z.rover },
    { id: 'gate', pos: [3.4, 3.4, 23], zone: 'out', ...Z.gate },
    { id: 'solar', pos: [24, 3.2, 3], zone: 'out', ...Z.solar },
    { id: 'antenna', pos: [-15, gy(-15, 9) + 9, 9], zone: 'out', ...Z.antenna },
    { id: 'terrace', pos: [-1.5, 1.7, -9.5], zone: 'out', ...Z.terrace },
    { id: 'telescope', pos: [4.3, 2.0, -10.7], zone: 'out', ...Z.telescope },
    { id: 'bar', pos: [0, 1.65, 1.3], zone: 'in', ...Z.bar },
    { id: 'merch', pos: [Math.sin(mA) * 4.9, 2.0, Math.cos(mA) * 4.9], zone: 'in', ...Z.merch },
    { id: 'tourdesk', pos: [td.position.x, 1.55, td.position.z], zone: 'in', ...Z.tourdesk },
    { id: 'hall', pos: [-3.0, 1.5, -1.6], zone: 'in', ...Z.hall },
    { id: 'restrooms', pos: [1.0, 2.2, SM_Z], zone: 'in', ...Z.restrooms },
    { id: 'habitat', pos: [HAB.x, HAB.AY + 2.4, 3.6], zone: 'out', ...Z.habitat },
    { id: 'eva', pos: [-14.9, 2.5, 18.2], zone: 'out', ...Z.eva },
    { id: 'power', pos: [HAB.x - 7.0, 3.3, 8.5], zone: 'out', ...Z.power },
    { id: 'hab', pos: [HAB.x, HAB.FL + 1.5, -3.2], zone: 'in', ...Z.hab },
    { id: 'lab', pos: [HAB.x, HAB.FL + 1.5, 8.0], zone: 'in', ...Z.lab },
    { id: 'hvac', pos: [-7.9, 2.3, 1.5], zone: 'out', ...Z.hvac },
  ];
  const tour = [
    { pos: [30, 15, 44], look: [0, 3, 0], hold: 1.6, move: 3.0, title: 'STATION 02 · ASTRO CITY', text: 'Плато Устюрт, Каракалпакстан: купол у обрыва чинка.' },
    { pos: [15, 6.5, 19], look: [0, 4.2, 0], hold: 2.6, move: 4.5, hotspot: 'dome' },
    { pos: [3.0, 1.8, 25.5], look: [-0.5, 1.6, 17], hold: 2.4, move: 3.6, hotspot: 'corridor' },
    { pos: [0, 1.65, 16.4], look: [0, 1.6, 8], hold: 0.2, move: 3.0 },
    { pos: [0, 1.65, 7.4], look: [0, 1.5, 0], hold: 0.2, move: 3.4 },
    { pos: [0.5, 1.65, 3.6], look: [0, 1.25, 0], hold: 2.6, move: 2.4, hotspot: 'bar' },
    { pos: [-1.9, 1.62, 2.3], look: [-4.1, 1.3, 3.1], hold: 2.6, move: 2.4, hotspot: 'merch' },
    { pos: [1.3, 1.65, 1.9], look: [3.1, 1.3, 3.4], hold: 2.6, move: 2.4, hotspot: 'tourdesk' },
    { pos: [2.9, 2.6, 2.4], look: [-1.5, 1.4, -4.2], hold: 3.0, move: 2.8, hotspot: 'hall' },
    { pos: [0, 1.7, -7.6], look: [0.4, 1.2, -22], hold: 3.2, move: 4.2, hotspot: 'terrace' },
    { pos: [-16, 5, -9], look: [-24, 2.2, 3], hold: 0.1, move: 3.6 },
    { pos: [-10.5, 3.6, 21.5], look: [-22, 2.0, 7], hold: 3.4, move: 4.0, hotspot: 'habitat' },
  ];
  const plan = {
    bounds: [-28, 9, -13.5, 19],
    draw(ctx, S) {
      ctx.strokeStyle = 'rgba(221,227,234,0.85)'; ctx.lineWidth = 2;
      const c = S(0, 0), e = S(DR, 0);
      const pr = Math.abs(e[0] - c[0]);
      ctx.beginPath(); ctx.arc(c[0], c[1], pr, 0, Math.PI * 2); ctx.stroke();
      const r = (x0, z0, x1, z1, fill, stroke) => { const a = S(x0, z0), b = S(x1, z1); const x = Math.min(a[0], b[0]), y = Math.min(a[1], b[1]), w = Math.abs(b[0] - a[0]), h = Math.abs(b[1] - a[1]); if (fill) { ctx.fillStyle = fill; ctx.fillRect(x, y, w, h); } if (stroke) { ctx.strokeStyle = stroke; ctx.strokeRect(x, y, w, h); } };
      r(-CORR_W / 2, DR - 0.3, CORR_W / 2, CORR_Z1, null, 'rgba(221,227,234,0.85)');
      r(TER.x0, TER.z0, TER.x1, -DR + 0.3, 'rgba(242,194,48,0.12)', 'rgba(242,194,48,0.6)');
      r(1.1, SM_Z - 1.05, 5.35, SM_Z + 1.05, 'rgba(111,168,255,0.16)', 'rgba(221,227,234,0.85)');
      ctx.beginPath(); ctx.moveTo(...S(2.45, SM_Z - 1.05)); ctx.lineTo(...S(2.45, SM_Z + 1.05)); ctx.moveTo(...S(2.45, SM_Z)); ctx.lineTo(...S(5.35, SM_Z)); ctx.stroke();
      r(-8.5, 0.9, -7.3, 2.1, 'rgba(221,227,234,0.3)', null);
      r(HAB.x - 1.7, HAB.A[0], HAB.x + 1.7, HAB.A[1], 'rgba(255,106,26,0.18)', 'rgba(221,227,234,0.85)');
      r(HAB.x - 1.7, HAB.B[0], HAB.x + 1.7, HAB.B[1], 'rgba(111,168,255,0.18)', 'rgba(221,227,234,0.85)');
      r(HAB.x - 0.8, HAB.NODE[0], HAB.x + 0.8, HAB.NODE[1], null, 'rgba(221,227,234,0.85)');
      r(HAB.x - 8.2, -2.1, HAB.x - 4.8, 2.3, 'rgba(221,227,234,0.25)', null);
      r(HAB.x - 8.2, 5.5, HAB.x - 5.8, 11.5, 'rgba(242,194,48,0.4)', null);
      ctx.fillStyle = 'rgba(255,106,26,0.8)';
      const b = S(1.75, 0); ctx.beginPath(); ctx.arc(c[0], c[1], Math.abs(b[0] - c[0]), 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(5,8,15,1)'; const b2 = S(1.15, 0); ctx.beginPath(); ctx.arc(c[0], c[1], Math.abs(b2[0] - c[0]), 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(221,227,234,0.55)';
      for (const [tx, tz] of tableAt) { const p = S(tx, tz); ctx.beginPath(); ctx.arc(p[0], p[1], 3.5, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = 'rgba(242,194,48,0.85)';
      for (const [x, z] of [[td.position.x, td.position.z], [Math.sin(mA) * 5.1, Math.cos(mA) * 5.1]]) { const p = S(x, z); ctx.fillRect(p[0] - 4, p[1] - 4, 8, 8); }
    },
    labels: [['BAR', 0, 0], ['TOUR', 3.1, 3.3], ['MERCH', -4.1, 3.0], ['TERRACE', 0, -9.6], ['AIRLOCK', 0, 8.6], ['WC', 3.9, SM_Z], ['AHU', -7.9, -0.6], ['HAB', HAB.x, -2], ['LAB', HAB.x, 9.2], ['PWR', HAB.x - 7, 8.5]],
  };

  const station = {
    id: 'astrocity',
    scene, world, base, dn, M,
    exportRoot: world,
    orbitView: { pos: [17.5, 7.5, 21.5], target: [0, 3.2, 1.5] },
    orbit: { minDistance: 3, maxDistance: 160, maxPolar: Math.PI * 0.49 },
    walkSpawn: { pos: [0.4, 0, 24.5], yaw: 0, pitch: 0.02 },
    doorPath: [
      { pos: [0, 1.7, 20.5], look: [0, 1.6, 16], move: 2.4, hold: 0 },
      { pos: [0, 1.65, 16.2], look: [0, 1.6, 8], move: 1.6, hold: 0 },
      { pos: [0, 1.65, 6.6], look: [0, 1.5, 0], move: 2.6, hold: 0 },
    ],
    colliders: col,
    groundAt(x, z) {
      if (Math.hypot(x, z) < DR + 1.5 || (Math.abs(x) < 1.8 && z > 0 && z < CORR_Z1 + 2.5)) return 0;
      if (x > 0.9 && x < 5.4 && Math.abs(z - SM_Z) < 1.1) return 0;
      if (Math.abs(x - HAB.x) < 1.2 && z > HAB.A[0] && z < HAB.B[1] + 1.45) return HAB.FL;
      if (Math.abs(x - HAB.x) < 0.75 && z >= HAB.B[1] + 1.45 && z < HAB.B[1] + 2.6) return HAB.FL * clamp(1 - (z - HAB.B[1] - 1.45) / 1.15, 0, 1);
      if (x > TER.x0 - 0.2 && x < TER.x1 + 0.2 && z > TER.z0 - 0.2 && z < TER.z1) return 0.04;
      return Math.max(H(x, z), -2);
    },
    clampWalk(p) {
      const r = Math.hypot(p.x, p.z);
      if (r > 95) { p.x *= 95 / r; p.z *= 95 / r; }
      const ez = edgeZ(p.x) + 3.5;
      if (p.z < ez && !(p.x > TER.x0 && p.x < TER.x1 && p.z > TER.z0)) p.z = ez;
    },
    isInside(p) { return (Math.hypot(p.x, p.z) < DR - 0.1 && p.y < DRUM_H + DR) || (Math.abs(p.x) < CORR_W / 2 && p.z > DR - 0.3 && p.z < CORR_Z1 + 0.1 && p.y < CORR_H) || (p.x > 1.0 && p.x < 5.35 && Math.abs(p.z - SM_Z) < 1.05 && p.y < 2.35) || (Math.abs(p.x - HAB.x) < 1.25 && p.z > HAB.A[0] && p.z < HAB.B[1] && p.y < HAB.AY + 1.5); },
    hotspots, tour, plan,
    occluders: [
      { sphere: new THREE.Sphere(new THREE.Vector3(0, DRUM_H - 0.3, 0), DR - 0.15) },
      { box: new THREE.Box3(new THREE.Vector3(-DR + 0.2, 0, -DR + 0.2), new THREE.Vector3(DR - 0.2, DRUM_H, DR - 0.2)) },
      { box: new THREE.Box3(new THREE.Vector3(-1.1, 0, DR), new THREE.Vector3(1.1, CORR_H, CORR_Z1)) },
      { box: new THREE.Box3(new THREE.Vector3(1.1, 0, SM_Z - 1.0), new THREE.Vector3(5.3, 2.3, SM_Z + 1.0)) },
      { box: new THREE.Box3(new THREE.Vector3(HAB.x - 1.6, 0.5, HAB.A[0]), new THREE.Vector3(HAB.x + 1.6, HAB.AY + 1.6, HAB.B[1])) },
    ],
    stats: { merged: stats, fx: fxStats },
    setNight: (n) => { base.setNight(n); lastNight = n; captureBase(); },
    setStorm(on) { storm.target = on ? 1 : 0; },
    get storm() { return storm.target > 0.5; },
    zoneViews: {
      hab: { pos: [HAB.x, HAB.FL + 1.62, 1.6], look: [HAB.x, HAB.FL + 1.0, -5.5], path: [
        { pos: [HAB.x + 3.2, 2.0, HAB.B[1] + 6], look: [HAB.x, 1.9, HAB.B[1]], move: 2.6, hold: 0 },
        { pos: [HAB.x, HAB.FL + 1.62, HAB.B[1] + 1.0], look: [HAB.x, HAB.FL + 1.5, 9], move: 2.0, hold: 0 },
        { pos: [HAB.x, HAB.FL + 1.62, 8.5], look: [HAB.x, HAB.FL + 1.5, 2], move: 2.2, hold: 0 }] },
      lab: { pos: [HAB.x, HAB.FL + 1.62, 12.6], look: [HAB.x - 0.5, HAB.FL + 1.1, 6.5], path: [
        { pos: [HAB.x + 3.2, 2.0, HAB.B[1] + 6], look: [HAB.x, 1.9, HAB.B[1]], move: 2.6, hold: 0 },
        { pos: [HAB.x, HAB.FL + 1.62, HAB.B[1] + 1.0], look: [HAB.x, HAB.FL + 1.5, 9], move: 2.0, hold: 0 }] },
    },
    setCutaway(on) { domeLayer.forEach((o) => { o.visible = !on; }); renderer.shadowMap.needsUpdate = true; },
    update(dt, t, camera, mode) {
      clock.userData.update();
      hclock.userData.update();
      // dust storm blend
      const prev = storm.v;
      storm.v += (storm.target - storm.v) * (1 - Math.exp(-dt * 0.9));
      if (Math.abs(storm.v - storm.target) < 0.002) storm.v = storm.target;
      const sv = storm.v;
      if (sv > 0 || prev > 0) {
        dustColor.set('#B9784E').lerp(new THREE.Color('#2A1A12'), lastNight);
        base.fog.density = baseRef.fogD + sv * 0.028;
        base.fog.color.copy(baseRef.fogC).lerp(dustColor, sv);
        base.sun.intensity = baseRef.sun * (1 - 0.7 * sv);
        base.hemi.intensity = baseRef.hemi * (1 + 0.25 * sv);
        dustDome.visible = sv > 0.01; dust.visible = sv > 0.01;
        dustDome.material.color.copy(dustColor); dustDome.material.opacity = 0.9 * sv;
        dustDome.position.copy(camera.position);
        dMat.uniforms.uStorm.value = sv; dMat.uniforms.uTime.value = t; dMat.uniforms.uCam.value.copy(camera.position);
        dMat.uniforms.uColor.value.set('#D49A6A').lerp(new THREE.Color('#5A3A28'), lastNight);
        dMat.uniforms.uPR.value = renderer.getPixelRatio();
      }
      for (const d of dynamic.doors) {
        const near = Math.hypot(camera.position.x - d.at[0], camera.position.z - d.at[1]) < 3.6 || mode === 'tour';
        const target = near ? d.g.userData.openX : d.g.userData.closedX;
        d.g.position.x += (target - d.g.position.x) * (1 - Math.exp(-dt * 5));
      }
      const blink = (Math.sin(t * 3.2) > 0.6 ? 1 : 0.15);
      for (const b of dynamic.beacons) b.scale.setScalar(blink);
    },
    dispose() { disposeTree(scene); base.sky.dispose(); clearPeopleCache(); },
  };
  base.setNight(0);
  progress(1);
  return station;
}

// ---------------- helpers ----------------
function tyreTracks(terrainFn, gy) {
  const c = T.makeCanvas(128, 512), ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 128, 512);
  for (const cx of [26, 102]) {
    const g = ctx.createLinearGradient(cx - 14, 0, cx + 14, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.3, 'rgba(255,255,255,0.75)'); g.addColorStop(0.7, 'rgba(255,255,255,0.75)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(cx - 14, 0, 28, 512);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    for (let y = 0; y < 512; y += 12) ctx.fillRect(cx - 10, y, 20, 4); // tread
  }
  const tex = T.toTexture(c, { srgb: false });
  const mat = new THREE.MeshStandardMaterial({ name: 'tyre-tracks', color: '#5A3324', alphaMap: tex, transparent: true, opacity: 0.55, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const pos = [], uv = [], idx = [];
  const W = 1.1;
  let n = 0;
  for (let z = 17.2; z <= 170; z += 1.5) {
    const x = terrainFn.roadX(z);
    const dx = (terrainFn.roadX(z + 0.5) - terrainFn.roadX(z - 0.5));
    const nx = 1 / Math.hypot(1, dx), nz = -dx * nx;
    for (const sd of [-1, 1]) {
      const px = x + sd * W * nx, pz = z + sd * W * nz;
      pos.push(px, gy(px, pz) + 0.02, pz);
      uv.push(sd < 0 ? 0 : 1, (z - 17.2) / 6);
    }
    if (n > 0) { const b = n * 2; idx.push(b - 2, b, b - 1, b - 1, b, b + 1); }
    n++;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat);
  m.name = 'tyre_tracks';
  m.receiveShadow = true;
  return m;
}

function mergeList(list) {
  const pos = [], nor = [], uv = [], idx = [];
  let off = 0;
  for (const g of list) {
    const p = g.attributes.position, n = g.attributes.normal, u = g.attributes.uv;
    for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i)); uv.push(u.getX(i), u.getY(i)); }
    const ix = g.index.array;
    for (let i = 0; i < ix.length; i++) idx.push(ix[i] + off);
    off += p.count;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

function profileAt(smp, t) { return smp.sample(t); }

// ring (torus arc) around the Y axis at height y, from theta a to b (theta from +Z towards +X)
function ringArc(mat, R, a, b, tube, y, seg = 48, cast = true) {
  const g = new THREE.TorusGeometry(R, tube, 6, seg, b - a);
  g.rotateZ(Math.PI / 2 - b);
  g.rotateX(Math.PI / 2);
  const m = new THREE.Mesh(g, mat);
  m.position.y = y;
  m.castShadow = cast; m.receiveShadow = true;
  return m;
}

function telescope(M) {
  const g = new THREE.Group();
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2;
    g.add(new THREE.Mesh(cylinderBetween(V(Math.sin(a) * 0.45, 0, Math.cos(a) * 0.45), V(0, 1.15, 0), 0.02, 0.016, 6), M.aluDark));
  }
  place(g, new THREE.CylinderGeometry(0.08, 0.1, 0.22, 12), M.graphite, { p: [0, 1.22, 0] });
  const tube = new THREE.Group(); tube.position.set(0, 1.36, 0); tube.rotation.x = -0.75; g.add(tube);
  place(tube, new THREE.CylinderGeometry(0.11, 0.11, 1.15, 24), M.white, { p: [0, 0.2, 0] });
  place(tube, new THREE.CylinderGeometry(0.125, 0.125, 0.12, 24), M.orange, { p: [0, 0.74, 0] });
  place(tube, new THREE.CylinderGeometry(0.03, 0.03, 0.14, 10), M.graphite, { p: [0, -0.42, 0.05], r: [0.6, 0, 0] });
  place(tube, new THREE.CylinderGeometry(0.035, 0.035, 0.3, 10), M.alu, { p: [0.14, 0.4, 0] });
  place(g, new THREE.CylinderGeometry(0.06, 0.06, 0.18, 12), M.aluDark, { p: [-0.08, 1.2, 0.15], r: [Math.PI / 2, 0, 0] });
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

function solarField(M, gy) {
  const group = new THREE.Group(); group.name = 'solar_field';
  const panelGeo = new THREE.BoxGeometry(1.9, 0.05, 3.3);
  const tex = T.solarCellTexture();
  const pvMat = new THREE.MeshStandardMaterial({ name: 'pv', map: tex, roughness: 0.22, metalness: 0.4 });
  const legGeo = new THREE.CylinderGeometry(0.04, 0.04, 1, 6); legGeo.translate(0, 0.5, 0);
  const rows = [16, 19.5, 23, 26.5, 30], perRow = 7;
  const n = rows.length * perRow;
  const pm = new THREE.InstancedMesh(panelGeo, pvMat, n);
  const lm = new THREE.InstancedMesh(legGeo, M.aluDark, n * 2);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = V(1, 1, 1);
  let i = 0, j = 0;
  for (const x of rows) for (let k = 0; k < perRow; k++) {
    const z = -7 + k * 3.4;
    const h = gy(x, z);
    q.setFromEuler(new THREE.Euler(0, 0, 0.52));
    m.compose(V(x, h + 1.25, z), q, s);
    pm.setMatrixAt(i++, m);
    for (const dx of [-0.6, 0.6]) {
      const hh = 1.25 + dx * 0.55;
      m.compose(V(x + dx, h - 0.1, z), new THREE.Quaternion(), V(1, hh + 0.1, 1));
      lm.setMatrixAt(j++, m);
    }
  }
  pm.castShadow = lm.castShadow = true; pm.receiveShadow = lm.receiveShadow = true;
  pm.name = 'solar_panels'; lm.name = 'solar_legs';
  pm.computeBoundingSphere(); lm.computeBoundingSphere();
  group.add(pm, lm);
  return { group };
}

function antennaMast(M, h) {
  const g = new THREE.Group(); g.name = 'antenna_mast';
  const w0 = 0.9, w1 = 0.25;
  const leg = (sx, sz) => g.add(new THREE.Mesh(cylinderBetween(V(sx * w0, 0, sz * w0), V(sx * w1, h, sz * w1), 0.045, 0.03, 6), M.lunar));
  leg(-1, -1); leg(1, -1); leg(1, 1); leg(-1, 1);
  const steps = 8;
  for (let k = 0; k < steps; k++) {
    const y0 = (k / steps) * h, y1 = ((k + 1) / steps) * h;
    const w = (y) => w0 + (w1 - w0) * (y / h);
    const corners = (y) => [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => V(a * w(y), y, b * w(y)));
    const c0 = corners(y0), c1 = corners(y1);
    for (let e = 0; e < 4; e++) {
      g.add(new THREE.Mesh(cylinderBetween(c0[e], c1[(e + 1) % 4], 0.014, 0.014, 4), M.lunar));
      g.add(new THREE.Mesh(cylinderBetween(c1[e], c1[(e + 1) % 4], 0.014, 0.014, 4), M.lunar));
    }
  }
  place(g, new THREE.CylinderGeometry(0.03, 0.03, 2.2, 6), M.alu, { p: [0, h + 1.1, 0] });
  for (const [y, ry] of [[h - 1.5, 0], [h - 3, 1.6]]) place(g, new THREE.BoxGeometry(0.5, 0.9, 0.12), M.white, { p: [0.4, y, 0], r: [0, ry, 0] });
  const beacon = place(g, new THREE.SphereGeometry(0.11, 12, 8), M.ledRed, { p: [0, h + 2.25, 0], cast: false });
  beacon.userData.dynamic = true;
  g.userData.beacon = beacon;
  place(g, new THREE.BoxGeometry(2.2, 0.3, 2.2), M.aluDark, { p: [0, 0.1, 0] });
  g.traverse((o) => { if (o.isMesh && o !== beacon) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

function dishAntenna(M) {
  const g = new THREE.Group(); g.name = 'dish_antenna';
  place(g, new THREE.CylinderGeometry(0.35, 0.5, 1.6, 16), M.lunar, { p: [0, 0.8, 0] });
  place(g, new THREE.BoxGeometry(0.7, 0.5, 0.6), M.white, { p: [0, 1.75, 0] });
  const pts = [];
  for (let i = 0; i <= 16; i++) { const r = (i / 16) * 1.4; pts.push(new THREE.Vector2(r, (r * r) / 3.2)); }
  const dishG = new THREE.LatheGeometry(pts, 40);
  const head = new THREE.Group(); head.position.set(0, 2.05, 0); head.rotation.x = -0.9; g.add(head);
  const dm = M.white.clone(); dm.side = THREE.DoubleSide;
  place(head, dishG, dm, { p: [0, 0.15, 0] });
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2;
    head.add(new THREE.Mesh(cylinderBetween(V(Math.sin(a) * 1.25, 0.15 + 0.49, Math.cos(a) * 1.25), V(0, 1.15, 0), 0.015), M.alu));
  }
  place(head, new THREE.CylinderGeometry(0.08, 0.05, 0.25, 10), M.orange, { p: [0, 1.2, 0] });
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

function makeRover(M, dn) {
  const g = new THREE.Group(); g.name = 'ASTRA_Rover';
  const body = new THREE.Group(); body.position.y = 0.95; g.add(body);
  place(body, roundedBox(2.7, 0.62, 1.6, 0.14), M.white, {});
  place(body, roundedBox(2.72, 0.1, 1.62, 0.12), M.orange, { p: [0, -0.22, 0] });
  place(body, roundedBox(2.4, 0.06, 1.75, 0.04), M.deep, { p: [0, 0.36, 0] });
  // solar deck
  const pv = new THREE.MeshStandardMaterial({ name: 'rover-pv', map: T.solarCellTexture(), roughness: 0.25, metalness: 0.4 });
  place(body, new THREE.BoxGeometry(2.2, 0.02, 1.5), pv, { p: [0, 0.4, 0] });
  // mast + camera head
  place(body, new THREE.CylinderGeometry(0.05, 0.05, 1.0, 10), M.alu, { p: [0.95, 0.85, 0.45] });
  place(body, roundedBox(0.42, 0.22, 0.24, 0.05), M.white, { p: [0.95, 1.42, 0.45] });
  for (const dz of [-0.08, 0.08]) place(body, new THREE.CylinderGeometry(0.045, 0.045, 0.05, 14), M.graphite, { p: [1.17, 1.42, 0.45 + dz], r: [0, 0, Math.PI / 2] });
  place(body, cylinderBetween(V(-1.0, 0.4, -0.5), V(-1.1, 1.5, -0.55), 0.012), M.alu, {});
  place(body, new THREE.SphereGeometry(0.04, 8, 6), M.ledOrange, { p: [-1.1, 1.52, -0.55], cast: false });
  // headlights
  for (const dz of [-0.5, 0.5]) place(body, new THREE.BoxGeometry(0.03, 0.08, 0.25), M.ledWhite, { p: [1.36, 0.05, dz], cast: false });
  // name plates
  const nameTex = T.labelTexture({ w: 1024, h: 160, lines: [{ text: 'ASTRA ROVER', size: 96, weight: 800, spacing: 0.2, color: '#13223A' }] });
  const nm = new THREE.MeshStandardMaterial({ map: nameTex, transparent: true, roughness: 0.5 });
  place(body, new THREE.PlaneGeometry(1.6, 0.25), nm, { p: [0, 0.06, 0.805], cast: false });
  place(body, new THREE.PlaneGeometry(1.6, 0.25), nm, { p: [0, 0.06, -0.805], r: [0, Math.PI, 0], cast: false });
  // rocker-bogie + wheels
  for (const sz of [-1, 1]) {
    const z = sz * 1.0;
    place(g, new THREE.BoxGeometry(2.4, 0.09, 0.09), M.aluDark, { p: [0, 0.62, z * 0.95], r: [0, 0, 0.05] });
    for (const x of [-1.15, 0, 1.15]) {
      place(g, cylinderBetween(V(x * 0.85, 0.62, z * 0.95), V(x, 0.36, z), 0.035), M.aluDark, {});
      place(g, new THREE.CylinderGeometry(0.36, 0.36, 0.3, 24), M.rubber, { p: [x, 0.36, z], r: [Math.PI / 2, 0, 0] });
      place(g, new THREE.CylinderGeometry(0.22, 0.22, 0.31, 16), M.alu, { p: [x, 0.36, z], r: [Math.PI / 2, 0, 0], cast: false });
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * Math.PI * 2;
        place(g, new THREE.BoxGeometry(0.05, 0.03, 0.3), M.rubber, { p: [x + Math.cos(a) * 0.36, 0.36 + Math.sin(a) * 0.36, z], r: [0, 0, a], cast: false });
      }
    }
  }
  return g;
}

function signpost(M, dn, plates) {
  const g = new THREE.Group(); g.name = 'signpost';
  place(g, new THREE.CylinderGeometry(0.06, 0.07, 3.4, 10), M.alu, { p: [0, 1.7, 0] });
  plates.forEach((p, i) => {
    const tex = T.labelTexture({ w: 1024, h: 160, bg: p.color, lines: [{ text: p.text + (p.dir > 0 ? '  →' : ''), size: 62, weight: 800, spacing: 0.06, color: p.color === '#13223A' ? '#DDE3EA' : '#FFFFFF', x: p.dir > 0 ? 0.47 : 0.53 }].concat(p.dir < 0 ? [{ text: '←', size: 62, weight: 800, x: 0.06, align: 'left', color: '#F2C230' }] : []) });
    const mat = screenMaterial(dn, tex, { day: 0.65, night: 1.2 });
    const plate = new THREE.Group();
    plate.position.set(p.dir * 0.75, 3.0 - i * 0.42, 0);
    place(plate, new THREE.BoxGeometry(1.5, 0.34, 0.04), M.aluDark, {});
    place(plate, new THREE.PlaneGeometry(1.46, 0.3), mat, { p: [0, 0, 0.022], cast: false });
    place(plate, new THREE.PlaneGeometry(1.46, 0.3), mat, { p: [0, 0, -0.022], r: [0, Math.PI, 0], cast: false });
    g.add(plate);
  });
  return g;
}

function gateArch(M, dn) {
  const g = new THREE.Group(); g.name = 'ASTRO_CITY_gate';
  for (const sx of [-1, 1]) {
    place(g, roundedBox(1.4, 11, 1.4, 0.2), M.white, { p: [sx * 8, 5.5, 0] });
    place(g, new THREE.BoxGeometry(0.06, 10, 0.06), M.ledOrange, { p: [sx * 8 - sx * 0.71, 5.5, 0.71], cast: false });
    place(g, new THREE.SphereGeometry(0.2, 12, 8), M.ledRed, { p: [sx * 8, 11.2, 0], cast: false });
  }
  place(g, roundedBox(17.4, 1.6, 0.9, 0.2), M.deep, { p: [0, 9.6, 0] });
  const tex = T.labelTexture({ w: 2048, h: 192, lines: [{ text: 'ASTRO CITY', size: 150, weight: 800, spacing: 0.35, color: '#F4F6F8' }] });
  const sm = signMaterial(dn, tex, { day: 0.8, night: 4 });
  place(g, new THREE.PlaneGeometry(14, 1.3), sm, { p: [0, 9.6, 0.46], cast: false });
  place(g, new THREE.PlaneGeometry(14, 1.3), sm, { p: [0, 9.6, -0.46], r: [0, Math.PI, 0], cast: false });
  return g;
}

function rocks(M, gy, edgeZ, quality) {
  const base = new THREE.IcosahedronGeometry(1, 1);
  base.deleteAttribute('normal'); base.deleteAttribute('uv');
  const g = mergeVertices(base);
  const r = rng(77);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const k = 0.75 + r() * 0.5;
    p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.7, p.getZ(i) * k);
  }
  g.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ name: 'rock', color: '#8A4E36', roughness: 0.92, flatShading: true });
  const n = Math.round(220 * (quality.tier === 'low' ? 0.5 : 1));
  const im = new THREE.InstancedMesh(g, mat, n);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  let c = 0;
  for (let i = 0; i < n * 3 && c < n; i++) {
    const a = r() * Math.PI * 2, d = 9 + Math.pow(r(), 0.7) * 80;
    const x = Math.sin(a) * d, z = Math.cos(a) * d;
    if (z < edgeZ(x) + 1 || (Math.abs(x) < 9 && z > -14 && z < 26) || (x > 13 && x < 35 && z > -10 && z < 16) || (x > -36 && x < -11 && z > -12 && z < 24)) continue;
    const s = 0.15 + Math.pow(r(), 3) * 1.4;
    e.set(r() * 3, r() * 3, r() * 3);
    q.setFromEuler(e);
    m.compose(V(x, gy(x, z) + s * 0.25, z), q, V(s * (0.8 + r() * 0.6), s, s * (0.8 + r() * 0.6)));
    im.setMatrixAt(c++, m);
  }
  im.count = c;
  im.castShadow = true; im.receiveShadow = true;
  im.name = 'rocks';
  im.computeBoundingSphere();
  return im;
}
