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
    const flat = smoothstep(19, 46, r);
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
      { text: 'ASTRO CITY', size: 72, weight: 800, spacing: 0.16, y: 0.14, color: '#F4F6F8' },
      { text: 'SUNSET WALK · 19:10', font: T.FONT_MONO, size: 36, weight: 500, y: 0.36, color: '#FF6A1A' },
      { text: 'CHINK CLIFFS · ROVER RIDE', font: T.FONT_MONO, size: 32, weight: 500, y: 0.52, color: '#F2C230' },
      { text: 'NIGHT SKY · TELESCOPE · 22:00', font: T.FONT_MONO, size: 32, weight: 500, y: 0.68, color: '#DDE3EA' },
      { text: 'USTYURT PLATEAU · KARAKALPAKSTAN', font: T.FONT_MONO, size: 24, weight: 400, y: 0.86, color: '#7D8A9C' },
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
  progress(0.8);

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
  ];
  for (const p of people) {
    if (p.rot === undefined) p.rot = Math.atan2(-p.x, -p.z);
    if (p.y === undefined) p.y = Math.hypot(p.x, p.z) < DR + 2 ? 0 : Math.max(0, H(p.x, p.z));
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
  ];
  const plan = {
    bounds: [-9, 9, -13.5, 19],
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
      ctx.fillStyle = 'rgba(255,106,26,0.8)';
      const b = S(1.75, 0); ctx.beginPath(); ctx.arc(c[0], c[1], Math.abs(b[0] - c[0]), 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(5,8,15,1)'; const b2 = S(1.15, 0); ctx.beginPath(); ctx.arc(c[0], c[1], Math.abs(b2[0] - c[0]), 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(221,227,234,0.55)';
      for (const [tx, tz] of tableAt) { const p = S(tx, tz); ctx.beginPath(); ctx.arc(p[0], p[1], 3.5, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = 'rgba(242,194,48,0.85)';
      for (const [x, z] of [[td.position.x, td.position.z], [Math.sin(mA) * 5.1, Math.cos(mA) * 5.1]]) { const p = S(x, z); ctx.fillRect(p[0] - 4, p[1] - 4, 8, 8); }
    },
    labels: [['BAR', 0, 0], ['TOUR', 3.1, 3.3], ['MERCH', -4.1, 3.0], ['TERRACE', 0, -9.6], ['AIRLOCK', 0, 8.6], ['WC', 3.9, SM_Z], ['AHU', -7.9, -0.6]],
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
      if (x > TER.x0 - 0.2 && x < TER.x1 + 0.2 && z > TER.z0 - 0.2 && z < TER.z1) return 0.04;
      return Math.max(H(x, z), -2);
    },
    clampWalk(p) {
      const r = Math.hypot(p.x, p.z);
      if (r > 95) { p.x *= 95 / r; p.z *= 95 / r; }
      const ez = edgeZ(p.x) + 3.5;
      if (p.z < ez && !(p.x > TER.x0 && p.x < TER.x1 && p.z > TER.z0)) p.z = ez;
    },
    isInside(p) { return (Math.hypot(p.x, p.z) < DR - 0.1 && p.y < DRUM_H + DR) || (Math.abs(p.x) < CORR_W / 2 && p.z > DR - 0.3 && p.z < CORR_Z1 + 0.1 && p.y < CORR_H) || (p.x > 1.0 && p.x < 5.35 && Math.abs(p.z - SM_Z) < 1.05 && p.y < 2.35); },
    hotspots, tour, plan,
    occluders: [
      { sphere: new THREE.Sphere(new THREE.Vector3(0, DRUM_H - 0.3, 0), DR - 0.15) },
      { box: new THREE.Box3(new THREE.Vector3(-DR + 0.2, 0, -DR + 0.2), new THREE.Vector3(DR - 0.2, DRUM_H, DR - 0.2)) },
      { box: new THREE.Box3(new THREE.Vector3(-1.1, 0, DR), new THREE.Vector3(1.1, CORR_H, CORR_Z1)) },
      { box: new THREE.Box3(new THREE.Vector3(1.1, 0, SM_Z - 1.0), new THREE.Vector3(5.3, 2.3, SM_Z + 1.0)) },
    ],
    stats: { merged: stats, fx: fxStats },
    setNight: (n) => base.setNight(n),
    setCutaway(on) { domeLayer.forEach((o) => { o.visible = !on; }); renderer.shadowMap.needsUpdate = true; },
    update(dt, t, camera, mode) {
      clock.userData.update();
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
    if (z < edgeZ(x) + 1 || (Math.abs(x) < 9 && z > -14 && z < 26) || (x > 13 && x < 35 && z > -10 && z < 16)) continue;
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
