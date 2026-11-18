// STATION 01 · TASHKENT — ground floor of a city building next to Tashkent City Park.
// Facade: a horizontal ISS-style module half-embedded into the building. Interior: 7 × 10 m hall.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createStationBase, disposeTree } from './common.js';
import { createMaterials, signMaterial, screenMaterial, lightPoolMaterial, contactShadowMaterial, boxUV } from '../core/materials.js';
import * as T from '../core/textures.js';
import {
  tileSurface, arcMapping, hatchProfile, profileSampler, corridorMapping, uFrame, arcBand,
  place, box, roundedBox, cylinderBetween, mergeStatic, V,
} from '../core/geometry.js';
import { Colliders } from '../core/controls.js';
import { addPerson, clearPeopleCache } from '../core/people.js';
import { rng } from '../core/noise.js';
import * as P from './props.js';
import { ZONES, FOUNDING_CREW } from '../config.js';

// ---- module geometry (metres) ----
const R = 3.0, CY = 2.1, CZ = -2.0;
const PHI0 = Math.asin((0.3 - CY) / R); // shell starts on the plinth, y = 0.3
const PHI1 = Math.acos(-CZ / R); // meets the building wall, z = 0
const ARC = R * (PHI1 - PHI0);
const phiOfY = (y) => Math.asin((y - CY) / R);
const tOfY = (y) => R * (phiOfY(y) - PHI0);
const zOfY = (y) => CZ + R * Math.cos(phiOfY(y));
const HX = 5.0; // hall half-width (10 m)
const BACK = -6.2; // back wall
const CEIL = 3.6;
const DOOR_W = 2.0, DOOR_H = 2.75, TUN_END = 1.78;
const ROAD = [6.55, 21.45];

const SKY = {
  sunDir: new THREE.Vector3(-0.42, 0.62, 0.66),
  moonDir: new THREE.Vector3(0.5, 0.5, 0.7),
  day: { zenith: '#2E6BBE', horizon: '#C3D9EC', ground: '#8C949A', sun: '#FFF3DD', glow: '#FFE7C4', glowStrength: 0.55, horizonGlow: 0.18, sunSize: 0.8, sunBoost: 26 },
  night: { zenith: '#05080F', horizon: '#13223A', ground: '#06080C', cityGlow: '#2B2420', milky: 0.18 },
  stars: 1800,
  moonSize: 95,
};

export async function buildTashkent({ renderer, quality, progress = () => {} }) {
  const base = createStationBase(renderer, quality, {
    sky: SKY,
    fog: { day: 0.0042, night: 0.0065, dayColor: '#C3D9EC' },
    sun: { day: 3.6, night: 0.35, dayColor: '#FFF0DA', nightColor: '#A9BCE6', dist: 60, shadowSize: 34, center: [0, 0, 4] },
    hemi: { day: 0.38, night: 0.16, daySky: '#CFE2F5', dayGround: '#8A8172', nightSky: '#1B2A44', nightGround: '#0B0D11' },
    env: { day: 0.65, night: 0.35 },
  });
  const { scene, dn } = base;
  const M = createMaterials(dn, { interiorEnv: 0.35 });
  const world = new THREE.Group();
  world.name = 'STATION_01_TASHKENT';
  scene.add(world);
  const fx = new THREE.Group(); // decals/light pools: not exported
  fx.userData.noExport = true;
  scene.add(fx);
  const earthMats = [];
  const col = new Colliders();
  const dynamic = { doors: [] };
  progress(0.15);

  // -------- materials specific to this street --------
  const shellMat = M.composite.clone();
  shellMat.name = 'module-skin';
  shellMat.side = THREE.DoubleSide;
  shellMat.emissive = new THREE.Color('#FFD2A0');
  shellMat.emissiveMap = shellMat.map;
  dn.prop(shellMat, 'emissiveIntensity', 0, 0.16); // backlit composite skin at night
  const pav = T.paverTextures(), asp = T.asphaltTextures(), grs = T.grassTextures();
  const repT = (t, m) => { const c = t.clone(); c.repeat.set(1 / m, 1 / m); c.needsUpdate = true; return c; };
  const paverMat = new THREE.MeshStandardMaterial({ name: 'pavers', map: repT(pav.map, pav.meters), normalMap: repT(pav.normalMap, pav.meters), roughness: 0.85 });
  const asphaltMat = new THREE.MeshStandardMaterial({ name: 'asphalt', map: repT(asp.map, asp.meters), normalMap: repT(asp.normalMap, asp.meters), roughness: 0.92 });
  const grassMat = new THREE.MeshStandardMaterial({ name: 'lawn', map: repT(grs.map, grs.meters), normalMap: repT(grs.normalMap, grs.meters), roughness: 0.95 });
  const curbMat = new THREE.MeshStandardMaterial({ name: 'curb', color: '#B9B3A8', roughness: 0.8 });
  const stoneMat = new THREE.MeshStandardMaterial({ name: 'stone', color: '#D3CABA', roughness: 0.75 });
  const paintMat = new THREE.MeshStandardMaterial({ name: 'road-paint', color: '#E9E6DE', roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -1 });
  const facade = T.facadeTextures({ cols: 9, rows: 5, bayW: 2.2, floorH: 3.2 });
  const facadeMat = new THREE.MeshStandardMaterial({ name: 'facade', map: facade.map, emissiveMap: facade.emissiveMap, emissive: '#FFFFFF', roughness: 0.8 });
  dn.prop(facadeMat, 'emissiveIntensity', 0, 1.25);
  const shop = T.shopfrontTexture();
  const shopMat = new THREE.MeshStandardMaterial({ name: 'shopfront', map: shop.map, emissiveMap: shop.emissiveMap, emissive: '#FFFFFF', roughness: 0.35, metalness: 0.2 });
  dn.prop(shopMat, 'emissiveIntensity', 0.08, 0.55);
  const groundMat = new THREE.MeshStandardMaterial({ name: 'ground', color: '#5E625F', roughness: 0.95 });

  // ================= MODULE FACADE =================
  const facadeG = new THREE.Group();
  facadeG.name = 'module_facade';
  world.add(facadeG);
  const tc = tOfY(1.6);
  const tDoor = tOfY(DOOR_H);
  const sEdges = [-HX, -4.6, -3.6, -2.55, -1.55, -1.0, 1.0, 1.55, 2.55, 3.6, 4.6, HX];
  const tEdges = [0, tc - 0.5, tc + 0.5, tDoor, ARC];
  const portCols = new Set([1, 3, 7, 9]);
  const shellGeo = tileSurface({
    sEdges, tEdges, maxSeg: 0.22, map: arcMapping(R, CY, CZ, PHI0),
    tile: (i, j) => (i === 5 && j <= 2 ? 'empty' : portCols.has(i) && j === 1 ? { hole: 0.42 } : 'solid'),
  });
  place(facadeG, shellGeo, shellMat, { name: 'module_shell' });

  // end caps
  const capShape = new THREE.Shape();
  capShape.moveTo(R * Math.cos(PHI0), R * Math.sin(PHI0));
  capShape.absarc(0, 0, R, PHI0, PHI1, false);
  capShape.lineTo(-CZ, R * Math.sin(PHI0));
  capShape.closePath();
  const capGeo = new THREE.ShapeGeometry(capShape, 40);
  capGeo.rotateY(-Math.PI / 2);
  capGeo.translate(0, CY, CZ);
  for (const sx of [-1, 1]) place(facadeG, capGeo.clone(), shellMat, { p: [sx * HX, 0, 0] });

  // ring frames + LED
  const frames = [[-HX, 0.2, M.composite, M.ledWarm], [HX, 0.2, M.composite, M.ledWarm], [-3.075, 0.14, M.alu, null], [3.075, 0.14, M.alu, null], [-1.15, 0.14, M.composite, M.ledOrange], [1.15, 0.14, M.composite, M.ledOrange]];
  const signLo = phiOfY(2.98), signHi = phiOfY(3.9);
  for (const [x, w, mat, led] of frames) {
    // frames that cross the sign band are split around it
    const spans = Math.abs(x) < 2.8 ? [[PHI0, signLo], [signHi, PHI1]] : [[PHI0, PHI1]];
    for (const [a, b] of spans) {
      place(facadeG, arcBand(R - 0.03, R + 0.075, a, b, w, CY, CZ), mat, { p: [x, 0, 0] });
      if (led) place(facadeG, arcBand(R + 0.07, R + 0.088, a + 0.02, b - 0.01, 0.035, CY, CZ), led, { p: [x, 0, 0], cast: false });
    }
  }
  // portholes (real windows) with frames inside and out
  for (const x of [-4.1, -2.05, 2.05, 4.1]) {
    const phi = phiOfY(1.6);
    const p = [x, CY + R * Math.sin(phi), CZ + R * Math.cos(phi)];
    const outer = P.portholeFrame(M, 0.42, { flange: 0.17, depth: 0.09 });
    outer.position.set(...p); outer.rotation.set(-phi, 0, 0);
    facadeG.add(outer);
    const inner = P.portholeFrame(M, 0.42, { flange: 0.12, depth: 0.09 });
    inner.position.set(...p); inner.rotation.set(-phi, Math.PI, 0);
    facadeG.add(inner);
    place(facadeG, new THREE.CircleGeometry(0.43, 40), M.glass, { p, r: [-phi, 0, 0], cast: false, receive: false });
    // gold EVA handrails beside the window
    const hr = P.handrail(M, 0.7);
    const ph = phiOfY(2.35);
    hr.position.set(x, CY + (R + 0.0) * Math.sin(ph), CZ + R * Math.cos(ph));
    hr.rotation.set(-ph, 0, 0);
    facadeG.add(hr);
  }
  // sign band (deep blue) + letters
  const sb0 = tOfY(3.02), sb1 = tOfY(3.86);
  const bandGeo = tileSurface({ sEdges: [-2.75, 2.75], tEdges: [sb0, sb1], maxSeg: 0.2, map: arcMapping(R + 0.01, CY, CZ, PHI0), tile: () => 'solid' });
  place(facadeG, bandGeo, M.deep, { name: 'sign_band' });
  const signTex = T.labelTexture({
    w: 2048, h: 320,
    lines: [
      { text: 'ASTRA STATION', size: 196, weight: 800, spacing: 0.22, y: 0.52, color: '#F4F6F8' },
    ],
  });
  const lettersGeo = tileSurface({
    sEdges: [-2.55, 2.55], tEdges: [sb0 + 0.07, sb1 - 0.05], maxSeg: 0.2, map: arcMapping(R + 0.02, CY, CZ, PHI0), tile: () => 'solid',
    uvScale: [1 / 5.1, 1 / (sb1 - sb0 - 0.12)], uvOffset: [0.5, -(sb0 + 0.07) / (sb1 - sb0 - 0.12)],
  });
  place(facadeG, lettersGeo, signMaterial(dn, signTex, { day: 0.55, night: 3.2 }), { name: 'sign_ASTRA_STATION', cast: false });
  // orange accent bar under the letters
  const accentGeo = tileSurface({ sEdges: [-0.35, 0.35], tEdges: [sb0 + 0.02, sb0 + 0.055], maxSeg: 0.2, map: arcMapping(R + 0.02, CY, CZ, PHI0), tile: () => 'solid' });
  place(facadeG, accentGeo, M.ledOrange, { cast: false });

  // plinth with underglow
  for (const [a, b] of [[-HX - 0.08, -1.0], [1.0, HX + 0.08]]) {
    box(facadeG, b - a, 0.3, 0.48, M.aluDark, (a + b) / 2, 0.15, 0.24);
    place(facadeG, new THREE.BoxGeometry(b - a - 0.1, 0.015, 0.02), M.ledWarm, { p: [(a + b) / 2, 0.035, 0.485], cast: false });
  }
  const pool = lightPoolMaterial(dn, '#FFB46B', 0, 0.42);
  place(fx, new THREE.PlaneGeometry(10.4, 1.6), pool, { p: [0, 0.012, 1.15], r: [-Math.PI / 2, 0, 0], cast: false, receive: false });

  // ================= AIRLOCK TUNNEL =================
  const tunnel = new THREE.Group();
  tunnel.name = 'airlock';
  facadeG.add(tunnel);
  const prof = hatchProfile(DOOR_W, DOOR_H, 0.55, 8);
  const sampler = profileSampler(prof);
  const tunGeo = tileSurface({ sEdges: [-0.1, TUN_END], tEdges: [0, sampler.length], maxSeg: 0.25, map: corridorMapping(sampler), tile: () => 'solid' });
  place(tunnel, tunGeo, shellMat, { name: 'airlock_tube' });
  const outerProf = hatchProfile(2.36, 3.0, 0.7, 10);
  const innerProf = hatchProfile(1.52, 2.32, 0.42, 10);
  place(tunnel, uFrame(outerProf, innerProf, 0.14), M.composite, { p: [0, 0, TUN_END + 0.07], name: 'hatch_frame' });
  place(tunnel, uFrame(hatchProfile(2.16, 2.86, 0.62, 10), prof, 0.12), M.alu, { p: [0, 0, 1.05] });
  // orange LED following the hatch opening
  const ledCurve = new THREE.CatmullRomCurve3(hatchProfile(1.6, 2.38, 0.46, 12).map(([a, b]) => V(a, b, TUN_END + 0.155)));
  place(tunnel, new THREE.TubeGeometry(ledCurve, 80, 0.012, 6, false), M.ledOrange, { cast: false });
  // plaque "STATION 01"
  const plTex = T.labelTexture({ w: 1024, h: 128, lines: [{ text: 'STATION 01 · TASHKENT', font: T.FONT_MONO, size: 58, weight: 500, spacing: 0.06, color: '#13223A' }] });
  place(tunnel, new THREE.PlaneGeometry(1.24, 0.155), new THREE.MeshStandardMaterial({ map: plTex, transparent: true, roughness: 0.6 }), { p: [0, 2.6, TUN_END + 0.16], cast: false });
  // tunnel ceiling light + floor
  place(tunnel, new THREE.BoxGeometry(0.5, 0.012, 1.4), M.ledWhite, { p: [0, DOOR_H - 0.01, 0.85], cast: false });
  // sliding glass doors (dynamic)
  for (const sx of [-1, 1]) {
    const d = new THREE.Group();
    d.userData.dynamic = true;
    place(d, new THREE.BoxGeometry(0.78, 2.3, 0.018), M.glass, { cast: false, receive: false });
    place(d, new THREE.BoxGeometry(0.78, 0.05, 0.04), M.alu, { p: [0, 1.14, 0] });
    place(d, new THREE.BoxGeometry(0.78, 0.05, 0.04), M.alu, { p: [0, -1.14, 0] });
    place(d, new THREE.BoxGeometry(0.04, 2.3, 0.04), M.alu, { p: [sx * 0.37, 0, 0] });
    place(d, new THREE.BoxGeometry(0.03, 0.5, 0.05), M.orange, { p: [-sx * 0.32, 0.05, 0.03] });
    d.position.set(sx * 0.39, 1.16, TUN_END + 0.18);
    d.userData.closedX = sx * 0.39;
    d.userData.openX = sx * 1.08;
    tunnel.add(d);
    dynamic.doors.push(d);
  }
  const entryLight = new THREE.PointLight('#FFC58A', 0, 9, 2);
  entryLight.position.set(0, 2.5, 2.4);
  scene.add(entryLight);
  dn.prop(entryLight, 'intensity', 0, 7);
  progress(0.3);

  // ================= BUILDING =================
  const bld = new THREE.Group();
  bld.name = 'building';
  world.add(bld);
  const BW = 19.8;
  // fascia band above the module
  box(bld, BW * 2, 0.62, 0.38, stoneMat, 0, 4.6, -0.14).userData.layer = 'roof';
  // upper floors facade
  const facadeMap = facade.map.clone(); facadeMap.repeat.set(2, 1); facadeMap.needsUpdate = true;
  const facadeEm = facade.emissiveMap.clone(); facadeEm.repeat.set(2, 1); facadeEm.needsUpdate = true;
  facadeMat.map = facadeMap; facadeMat.emissiveMap = facadeEm;
  place(bld, new THREE.PlaneGeometry(BW * 2, 16), facadeMat, { p: [0, 4.9 + 8, 0.0], name: 'facade_upper' }).userData.layer = 'roof';
  const body = box(bld, BW * 2, 16.6, 16, stoneMat, 0, 4.9 + 8.3, -8.02);
  body.userData.layer = 'roof';
  box(bld, BW * 2 + 0.4, 0.7, 0.5, stoneMat, 0, 21.25, -0.1).userData.layer = 'roof';
  // vertical fins every two bays
  for (let i = -9; i <= 9; i += 2) box(bld, 0.22, 16, 0.32, stoneMat, i * 2.2, 12.9, 0.12).userData.layer = 'roof';
  // ground floor neighbours (shopfronts)
  const shopMap = shop.map.clone(); shopMap.repeat.set(1, 1);
  for (const sx of [-1, 1]) {
    const x0 = sx * HX, x1 = sx * BW;
    const w = Math.abs(x1 - x0);
    const g = new THREE.PlaneGeometry(w, 4.3);
    if (sx < 0) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * 0.98); }
    place(bld, g, shopMat, { p: [(x0 + x1) / 2, 2.15, -0.02] });
    box(bld, 0.5, 4.3, 0.4, stoneMat, sx * (HX + 0.3), 2.15, -0.1);
    box(bld, 0.6, 4.3, 0.45, stoneMat, sx * (BW - 0.2), 2.15, -0.1);
    // ground-floor body behind the shops
    box(bld, w, 4.3, 15.8, stoneMat, (x0 + x1) / 2, 2.15, -8.2);
  }
  // hall shell inside the building (walls/ceiling)
  progress(0.4);

  // ================= INTERIOR =================
  const inn = new THREE.Group();
  inn.name = 'interior';
  world.add(inn);
  const floorGeo = new THREE.BoxGeometry(2 * HX, 0.1, -BACK + 0.45); boxUV(floorGeo);
  place(inn, floorGeo, M.floor, { p: [0, -0.05, (BACK + 0.45) / 2], name: 'floor' });
  const tf = new THREE.BoxGeometry(DOOR_W, 0.1, TUN_END + 0.3); boxUV(tf);
  place(inn, tf, M.floor, { p: [0, -0.049, (TUN_END + 0.3) / 2] });
  // orange guide line from airlock to bar
  place(inn, new THREE.BoxGeometry(0.05, 0.006, TUN_END + 4.25), M.ledOrange, { p: [0, 0.003, (TUN_END - 4.3) / 2 + 0.05], cast: false });
  // walls
  const wallBox = (w, h, d, x, y, z) => { const g = new THREE.BoxGeometry(w, h, d); boxUV(g); return place(inn, g, M.compositeIn, { p: [x, y, z] }); };
  wallBox(2 * HX + 0.3, CEIL, 0.15, 0, CEIL / 2, BACK - 0.075);
  wallBox(0.15, CEIL, -BACK + 0.15, -HX - 0.075, CEIL / 2, BACK / 2);
  wallBox(0.15, CEIL, -BACK + 0.15, HX + 0.075, CEIL / 2, BACK / 2);
  const ceil = wallBox(2 * HX, 0.1, -BACK + 0.6, 0, CEIL + 0.05, (BACK + 0.6) / 2);
  ceil.userData.layer = 'roof';
  // chamfers + LED lines (ISS rack look)
  const ch = 0.45;
  const chL = Math.SQRT2 * ch;
  const chamf = (len, x, z, ry) => {
    const g = new THREE.PlaneGeometry(len, chL); boxUV(g);
    const m = place(inn, g, M.compositeIn, { p: [x, CEIL - ch / 2, z], r: [0, ry, 0] });
    m.rotateX(Math.PI / 4);
    m.userData.layer = 'roof';
    return m;
  };
  chamf(2 * HX, 0, BACK + ch / 2, 0);
  chamf(-BACK, -HX + ch / 2, BACK / 2, Math.PI / 2);
  chamf(-BACK, HX - ch / 2, BACK / 2, -Math.PI / 2);
  const ledLine = (w, d, x, z, mat = M.ledWhite) => { const m = place(inn, new THREE.BoxGeometry(w, 0.012, d), mat, { p: [x, CEIL - 0.006, z], cast: false }); m.userData.layer = 'roof'; return m; };
  ledLine(2 * HX - 2 * ch, 0.05, 0, BACK + ch);
  ledLine(0.05, -BACK - ch, -HX + ch, BACK / 2 + ch / 2);
  ledLine(0.05, -BACK - ch, HX - ch, BACK / 2 + ch / 2);
  for (const z of [-4.3, -2.6, -0.9]) ledLine(2 * HX - 2 * ch - 0.6, 0.06, 0, z, M.ledWarm);
  // gold handrails on side walls (ISS motif)
  for (const [x, z, ry] of [[-HX, -0.6, Math.PI / 2], [HX, -3.95, -Math.PI / 2], [-HX, -4.0, Math.PI / 2]]) {
    const h = P.handrail(M, 0.9); h.position.set(x, 2.95, z); h.rotation.y = ry; inn.add(h);
  }

  // ---- Bar ----
  const bar = new THREE.Group(); bar.name = 'zone_bar'; inn.add(bar);
  const BX0 = -2.9, BX1 = 1.3, BZ = -4.65;
  const counterGeo = roundedBox(BX1 - BX0, 1.04, 0.6, 0.06); boxUV(counterGeo);
  place(bar, counterGeo, M.whiteIn, { p: [(BX0 + BX1) / 2, 0.52, BZ] });
  place(bar, roundedBox(BX1 - BX0 + 0.1, 0.05, 0.72, 0.04), M.stoneTop, { p: [(BX0 + BX1) / 2, 1.065, BZ + 0.04] });
  place(bar, new THREE.BoxGeometry(BX1 - BX0 - 0.1, 0.02, 0.012), M.ledOrange, { p: [(BX0 + BX1) / 2, 0.92, BZ + 0.306], cast: false });
  place(bar, new THREE.BoxGeometry(BX1 - BX0 - 0.1, 0.012, 0.02), M.ledWarm, { p: [(BX0 + BX1) / 2, 0.05, BZ + 0.33], cast: false });
  place(bar, new THREE.BoxGeometry(BX1 - BX0 - 0.2, 0.03, 0.03), M.alu, { p: [(BX0 + BX1) / 2, 0.24, BZ + 0.42] }); // foot rail
  // back bar
  const bbGeo = new THREE.BoxGeometry(BX1 - BX0, 0.9, 0.6); boxUV(bbGeo);
  place(bar, bbGeo, M.graphiteIn, { p: [(BX0 + BX1) / 2, 0.45, BACK + 0.3] });
  place(bar, new THREE.BoxGeometry(BX1 - BX0 + 0.04, 0.04, 0.64), M.steel, { p: [(BX0 + BX1) / 2, 0.92, BACK + 0.32] });
  const cm1 = P.coffeeMachine(M); cm1.position.set(-1.9, 0.94, BACK + 0.34); bar.add(cm1);
  const cm2 = P.coffeeMachine(M); cm2.position.set(-0.85, 0.94, BACK + 0.34); bar.add(cm2);
  const gr = P.grinder(M); gr.position.set(0.05, 0.94, BACK + 0.3); bar.add(gr);
  const gr2 = P.grinder(M); gr2.position.set(0.4, 0.94, BACK + 0.3); bar.add(gr2);
  const menu = P.display(M, 2.6, 1.3, screenMaterial(dn, P.menuTexture(), { day: 1.0, night: 1.3 }));
  menu.position.set(-0.8, 2.25, BACK + 0.03); bar.add(menu);
  for (let i = 0; i < 5; i++) {
    const s = P.barStool(M); s.position.set(-2.4 + i * 0.8, 0, -3.95); bar.add(s);
    col.circle(-2.4 + i * 0.8, -3.95, 0.2);
  }
  col.box(BX0, BX1, BZ - 0.3, BZ + 0.36);
  col.box(BX0, BX1, BACK, BACK + 0.62);
  // pendant lights over the bar
  for (let i = 0; i < 3; i++) {
    const x = -2.1 + i * 1.3;
    place(bar, cylinderBetween(V(x, 3.6, BZ), V(x, 2.55, BZ), 0.004), M.graphite, { cast: false });
    place(bar, new THREE.CylinderGeometry(0.11, 0.11, 0.06, 24), M.aluDark, { p: [x, 2.52, BZ] });
    place(bar, new THREE.CylinderGeometry(0.095, 0.095, 0.01, 24), M.ledWarm, { p: [x, 2.488, BZ], cast: false });
  }

  // ---- Mini Kitchen (back-left, glazed) ----
  const kit = new THREE.Group(); kit.name = 'zone_kitchen'; inn.add(kit);
  const KX = -3.05, KZ = -4.2;
  // side partition: solid from back wall to door, door gap, then to front corner
  const sideA = new THREE.BoxGeometry(0.1, CEIL, 0.55); boxUV(sideA);
  place(kit, sideA, M.compositeIn, { p: [KX, CEIL / 2, BACK + 0.275] });
  const sideB = new THREE.BoxGeometry(0.1, CEIL, 0.75); boxUV(sideB);
  place(kit, sideB, M.compositeIn, { p: [KX, CEIL / 2, KZ - 0.375 + 0.05] });
  const lintel = new THREE.BoxGeometry(0.1, CEIL - 2.2, 0.75); boxUV(lintel);
  place(kit, lintel, M.compositeIn, { p: [KX, 2.2 + (CEIL - 2.2) / 2, BACK + 0.55 + 0.375] });
  // front partition: base + glass + header
  const fw = KX - -HX;
  const fbase = new THREE.BoxGeometry(fw, 1.0, 0.1); boxUV(fbase);
  place(kit, fbase, M.compositeIn, { p: [(-HX + KX) / 2, 0.5, KZ] });
  const fhead = new THREE.BoxGeometry(fw, CEIL - 2.4, 0.1); boxUV(fhead);
  place(kit, fhead, M.compositeIn, { p: [(-HX + KX) / 2, 2.4 + (CEIL - 2.4) / 2, KZ] });
  place(kit, new THREE.BoxGeometry(fw, 1.4, 0.012), M.glass, { p: [(-HX + KX) / 2, 1.7, KZ], cast: false, receive: false });
  place(kit, new THREE.BoxGeometry(fw, 0.03, 0.12), M.alu, { p: [(-HX + KX) / 2, 1.0, KZ] });
  place(kit, new THREE.BoxGeometry(fw, 0.03, 0.12), M.alu, { p: [(-HX + KX) / 2, 2.4, KZ] });
  place(kit, new THREE.BoxGeometry(fw - 0.1, 0.02, 0.01), M.ledOrange, { p: [(-HX + KX) / 2, 0.98, KZ + 0.06], cast: false });
  const kitLabel = T.labelTexture({ w: 512, h: 64, lines: [{ text: 'MINI KITCHEN', font: T.FONT_MONO, size: 34, weight: 500, spacing: 0.3, color: '#13223A' }] });
  place(kit, new THREE.PlaneGeometry(1.4, 0.175), new THREE.MeshStandardMaterial({ map: kitLabel, transparent: true, roughness: 0.6 }), { p: [(-HX + KX) / 2, 2.62, KZ + 0.056], cast: false });
  // kitchen fit-out: steel counters, induction, oven column, fridge, hood
  const kc = new THREE.BoxGeometry(1.85, 0.9, 0.62); boxUV(kc);
  place(kit, kc, M.steel, { p: [-4.05, 0.45, BACK + 0.31] });
  place(kit, new THREE.BoxGeometry(1.85, 0.03, 0.64), M.stoneTop, { p: [-4.05, 0.915, BACK + 0.32] });
  place(kit, new THREE.BoxGeometry(0.55, 0.008, 0.45), M.graphite, { p: [-4.45, 0.934, BACK + 0.33] });
  place(kit, roundedBox(0.7, 0.4, 0.5, 0.03), M.steel, { p: [-4.4, 2.15, BACK + 0.27] });
  place(kit, new THREE.BoxGeometry(0.62, 2.1, 0.62), M.steel, { p: [-4.65, 1.05, -4.85] });
  place(kit, new THREE.BoxGeometry(0.02, 0.9, 0.02), M.alu, { p: [-4.32, 1.2, -4.53] });
  place(kit, new THREE.BoxGeometry(1.2, 0.04, 0.35), M.whiteIn, { p: [-3.95, 1.7, BACK + 0.18] });
  for (let i = 0; i < 4; i++) place(kit, new THREE.CylinderGeometry(0.06, 0.05, 0.08, 14), M.white, { p: [-4.35 + i * 0.25, 1.76, BACK + 0.18], cast: false });
  col.box(-HX, KX + 0.05, BACK, KZ + 0.05);
  col.box(KX - 0.05, KX + 0.05, BACK, BACK + 0.55);

  // ---- Tour Desk (back-right) ----
  const td = new THREE.Group(); td.name = 'zone_tourdesk'; inn.add(td);
  const tdGeo = roundedBox(1.9, 1.04, 0.62, 0.08); boxUV(tdGeo);
  place(td, tdGeo, M.whiteIn, { p: [3.75, 0.52, -4.95] });
  place(td, roundedBox(2.0, 0.04, 0.72, 0.06), M.stoneTop, { p: [3.75, 1.06, -4.92] });
  place(td, new THREE.BoxGeometry(1.8, 0.05, 0.012), M.orange, { p: [3.75, 0.82, -4.635] });
  const tourTex = T.labelTexture({
    w: 1024, h: 576, bg: '#06090F',
    lines: [
      { text: 'ASTRO CITY TOURS', size: 64, weight: 800, spacing: 0.12, y: 0.13, color: '#F4F6F8' },
      { text: 'TASHKENT  ───────────  USTYURT PLATEAU', font: T.FONT_MONO, size: 30, weight: 500, y: 0.3, color: '#F2C230' },
      { text: 'STATION 01  →  STATION 02', font: T.FONT_MONO, size: 34, weight: 500, y: 0.44, color: '#FF6A1A' },
      { text: 'SUNSET · STARGAZING · CHINK CLIFFS', font: T.FONT_MONO, size: 28, weight: 400, y: 0.62, color: '#9AA6B6' },
      { text: 'NEXT LAUNCH  FRI 18:00', font: T.FONT_MONO, size: 32, weight: 500, y: 0.82, color: '#DDE3EA' },
    ],
  });
  // route line on the screen
  const tourScr = P.display(M, 2.0, 1.125, screenMaterial(dn, tourTex, { day: 1.0, night: 1.3 }));
  tourScr.position.set(3.75, 2.15, BACK + 0.03); td.add(tourScr);
  const dm = P.domeModel(M, 0.16); dm.position.set(3.25, 1.08, -4.95); td.add(dm);
  place(td, roundedBox(0.26, 0.012, 0.18, 0.02), M.graphite, { p: [4.15, 1.087, -4.9], r: [0, -0.3, 0] });
  const tdLabel = T.labelTexture({ w: 512, h: 64, lines: [{ text: 'TOUR DESK', font: T.FONT_MONO, size: 36, weight: 500, spacing: 0.35, color: '#13223A' }] });
  place(td, new THREE.PlaneGeometry(1.0, 0.125), new THREE.MeshStandardMaterial({ map: tdLabel, transparent: true, roughness: 0.6 }), { p: [3.75, 0.62, -4.633], cast: false });
  col.box(2.8, 4.7, -5.3, -4.62);

  // ---- Space & Merch (right wall vitrine) ----
  const mg = new THREE.Group(); mg.name = 'zone_merch'; inn.add(mg);
  const vt = P.vitrine(M, 1.6, 0.5); vt.position.set(HX - 0.27, 0, -3.1); vt.rotation.y = -Math.PI / 2; mg.add(vt);
  const merchTex = T.labelTexture({ w: 1024, h: 160, bg: '#06090F', lines: [{ text: 'SPACE & MERCH', size: 72, weight: 800, spacing: 0.18, color: '#F2C230' }] });
  const ml = P.display(M, 1.5, 0.234, screenMaterial(dn, merchTex, { day: 1, night: 1.4 }));
  ml.position.set(HX - 0.03, 2.25, -3.1); ml.rotation.y = -Math.PI / 2; mg.add(ml);
  col.box(HX - 0.55, HX, -3.95, -2.25);

  // ---- Crew Wall (left wall) ----
  const cw = new THREE.Group(); cw.name = 'zone_crew_wall'; inn.add(cw);
  const crewLines = [
    { text: 'FOUNDING CREW', size: 60, weight: 800, spacing: 0.3, y: 0.1, color: '#F2C230' },
    { text: 'ASTRA STATION · MISSION 001', font: T.FONT_MONO, size: 24, weight: 500, spacing: 0.2, y: 0.19, color: '#FF6A1A' },
  ];
  FOUNDING_CREW.forEach((n, i) => {
    const colI = i % 4, row = Math.floor(i / 4);
    crewLines.push({ text: n, font: T.FONT_MONO, size: 30, weight: 500, x: 0.14 + colI * 0.24, y: 0.32 + row * 0.13, align: 'center', color: '#DDE3EA' });
  });
  const crewTex = T.labelTexture({ w: 1600, h: 1000, bg: '#0A1220', lines: crewLines, border: { color: '#1E3354', width: 6 }, pad: 18 });
  const crewMat = screenMaterial(dn, crewTex, { day: 0.7, night: 0.9 });
  const cwp = place(cw, roundedBox(3.3, 2.1, 0.06, 0.04), M.graphiteIn, { p: [-HX + 0.03, 1.95, -2.05], r: [0, Math.PI / 2, 0] });
  cwp.name = 'crew_wall_panel';
  place(cw, new THREE.PlaneGeometry(3.2, 2.0), crewMat, { p: [-HX + 0.065, 1.95, -2.05], r: [0, Math.PI / 2, 0], cast: false });
  place(cw, new THREE.BoxGeometry(0.012, 0.02, 3.3), M.ledGold, { p: [-HX + 0.07, 0.88, -2.05], cast: false });

  // ---- Earth screens (porthole displays) ----
  for (const [z, y, seed] of [[-0.75, 1.7, 0.21], [-1.95, 1.7, 0.63], [-5.45, 2.05, 0.37]]) {
    const es = P.earthScreen(M, 0.36, seed, earthMats);
    es.position.set(HX - 0.02, y, z); es.rotation.y = -Math.PI / 2; inn.add(es);
  }
  const es2 = P.earthScreen(M, 0.36, 0.85, earthMats);
  es2.position.set(-HX + 0.02, 2.0, -5.35); es2.rotation.y = Math.PI / 2; inn.add(es2);

  // ---- Main hall seating: window counter + 4 tables ----
  for (const sx of [-1, 1]) {
    const a = sx * 1.3, b = sx * 4.85;
    const g = roundedBox(Math.abs(b - a), 0.04, 0.36, 0.02);
    place(inn, g, M.stoneTop, { p: [(a + b) / 2, 1.05, 0.62] });
    for (const x of [sx * 2.05, sx * 4.1]) {
      const st = P.barStool(M); st.position.set(x, 0, 0.08); inn.add(st);
    }
  }
  col.box(-HX, -1.0, -0.1, 1.0);
  col.box(1.0, HX, -0.1, 1.0);
  const tables = [[-3.6, -1.6], [-1.9, -1.6], [1.9, -1.6], [3.6, -1.6]];
  const csm = contactShadowMaterial(0.45);
  for (const [tx, tz] of tables) {
    const t = P.roundTable(M, 0.36, 0.74); t.position.set(tx, 0, tz); inn.add(t);
    for (const [dx, dz, ry] of [[0, 0.56, Math.PI], [0, -0.56, 0], [0.56, 0, -Math.PI / 2], [-0.56, 0, Math.PI / 2]]) {
      const c = P.chair(M); c.position.set(tx + dx, 0, tz + dz); c.rotation.y = ry; inn.add(c);
    }
    place(fx, new THREE.PlaneGeometry(1.9, 1.9), csm, { p: [tx, 0.003, tz], r: [-Math.PI / 2, 0, 0], cast: false, receive: false });
    col.circle(tx, tz, 0.78);
  }
  place(fx, new THREE.PlaneGeometry(4.8, 1.4), csm, { p: [(BX0 + BX1) / 2, 0.003, BZ + 0.1], r: [-Math.PI / 2, 0, 0], cast: false, receive: false });
  place(fx, new THREE.PlaneGeometry(2.4, 1.3), csm, { p: [3.75, 0.003, -4.95], r: [-Math.PI / 2, 0, 0], cast: false, receive: false });

  // interior lights (always on; a bit warmer at night)
  const lightBar = new THREE.PointLight('#FFC690', 9, 9, 2);
  lightBar.position.set(-0.8, 3.1, -4.4);
  const lightHall = new THREE.PointLight('#FFE0BC', 11, 11, 2);
  lightHall.position.set(0.2, 3.25, -1.5);
  if (quality.pointShadows) {
    lightHall.castShadow = true;
    lightHall.shadow.mapSize.set(512, 512);
    lightHall.shadow.bias = -0.002;
    lightHall.shadow.radius = 4;
    lightHall.shadow.camera.near = 0.2;
  }
  scene.add(lightBar, lightHall);
  dn.prop(lightBar, 'intensity', 8, 10);
  dn.prop(lightHall, 'intensity', 10, 13);
  // interior walls collisions
  col.seg(-HX, BACK, -HX, 0.2).seg(HX, BACK, HX, 0.2).seg(-HX, BACK, HX, BACK);
  col.seg(-DOOR_W / 2 + 0.02, 0, -DOOR_W / 2 + 0.02, TUN_END + 0.2).seg(DOOR_W / 2 - 0.02, 0, DOOR_W / 2 - 0.02, TUN_END + 0.2);
  progress(0.55);

  // ================= STREET =================
  const st = new THREE.Group(); st.name = 'street'; world.add(st);
  const sw = new THREE.BoxGeometry(124, 0.3, ROAD[0] - 0.2); boxUV(sw);
  place(st, sw, paverMat, { p: [0, -0.15, (ROAD[0] - 0.2) / 2 + 0.0] });
  const swFar = new THREE.BoxGeometry(124, 0.3, 3.6); boxUV(swFar);
  place(st, swFar, paverMat, { p: [0, -0.15, ROAD[1] + 0.2 + 1.8] });
  for (const z of [ROAD[0] - 0.1, ROAD[1] + 0.1]) {
    const cg = new THREE.BoxGeometry(124, 0.32, 0.2); boxUV(cg);
    place(st, cg, curbMat, { p: [0, -0.15, z] });
  }
  const rd = new THREE.BoxGeometry(124, 0.2, ROAD[1] - ROAD[0]); boxUV(rd);
  place(st, rd, asphaltMat, { p: [0, -0.25, (ROAD[0] + ROAD[1]) / 2] });
  // road markings
  const mid = (ROAD[0] + ROAD[1]) / 2;
  const marks = [];
  for (const dz of [-0.12, 0.12]) marks.push(new THREE.BoxGeometry(124, 0.01, 0.1).translate(0, -0.145, mid + dz));
  for (const lz of [mid - 3.6, mid + 3.6]) for (let x = -60; x < 60; x += 9) marks.push(new THREE.BoxGeometry(3, 0.01, 0.12).translate(x + 1.5, -0.145, lz));
  for (let k = 0; k < 7; k++) marks.push(new THREE.BoxGeometry(4, 0.01, 0.5).translate(15, -0.145, ROAD[0] + 1 + k * 2.0));
  place(st, mergeGeometries(marks), paintMat, { cast: false });
  // big ground to the horizon
  place(st, new THREE.PlaneGeometry(1600, 1600), groundMat, { p: [0, -0.32, 0], r: [-Math.PI / 2, 0, 0], cast: false });
  // park lawn
  const lawn = new THREE.BoxGeometry(140, 0.2, 70); boxUV(lawn);
  place(st, lawn, grassMat, { p: [0, -0.1, ROAD[1] + 3.8 + 35] });
  for (const [x, z, w, d] of [[15, 45, 3.2, 40], [0, 32, 90, 2.4], [-24, 50, 2.6, 36]]) {
    const pg = new THREE.BoxGeometry(w, 0.22, d); boxUV(pg);
    place(st, pg, paverMat, { p: [x, -0.1, z] });
  }
  // park sign
  const parkTex = T.labelTexture({ w: 1024, h: 256, bg: '#13223A', lines: [{ text: 'TASHKENT CITY PARK', size: 84, weight: 800, spacing: 0.12, y: 0.42, color: '#F4F6F8' }, { text: 'ENTRANCE', font: T.FONT_MONO, size: 30, weight: 500, spacing: 0.4, y: 0.76, color: '#F2C230' }] });
  box(st, 3.4, 1.1, 0.35, stoneMat, 19.5, 0.55, ROAD[1] + 2.2);
  place(st, new THREE.PlaneGeometry(3.2, 0.8), screenMaterial(dn, parkTex, { day: 0.6, night: 1.4 }), { p: [19.5, 0.58, ROAD[1] + 2.38], cast: false });
  col.box(17.8, 21.2, ROAD[1] + 2.0, ROAD[1] + 2.4);

  // trees (instanced, alpha-tested leaf cards)
  const trees = makeTrees(M, quality);
  const streetTrees = [];
  for (const x of [-37, -27.5, -17, -8.6, 8.6, 17, 27.5, 37]) streetTrees.push([x, 4.9]);
  const r = rng(12);
  const parkTrees = [];
  for (let i = 0; i < 46; i++) {
    const x = -66 + r() * 132, z = ROAD[1] + 7 + r() * 58;
    if (Math.abs(x - 15) < 3 || Math.abs(z - 32) < 2.5 || (Math.abs(x + 24) < 2.5 && z > 32)) continue;
    parkTrees.push([x, z]);
  }
  const allTrees = streetTrees.concat(parkTrees);
  trees.place(world, allTrees, r);
  for (const [x, z] of streetTrees) {
    place(st, new THREE.BoxGeometry(1.3, 0.02, 1.3), M.aluDark, { p: [x, 0.005, z], cast: false });
    col.circle(x, z, 0.3);
  }
  for (const [x, z] of parkTrees) col.circle(x, z, 0.3);

  // street lamps
  const lampPool = lightPoolMaterial(dn, '#FFD9A8', 0, 0.5);
  for (const x of [-32, -22, -12.8, 12.8, 22, 32]) {
    addStreetLamp(st, fx, M, lampPool, x, 5.9, 1);
    col.circle(x, 5.9, 0.15);
  }
  for (const x of [-30, -10, 10, 30]) {
    addStreetLamp(st, fx, M, lampPool, x, ROAD[1] + 1.2, -1);
    col.circle(x, ROAD[1] + 1.2, 0.15);
  }
  // benches
  for (const x of [-11, 11]) {
    const b = bench(M); b.position.set(x, 0, 3.2); st.add(b);
    col.box(x - 0.9, x + 0.9, 2.95, 3.5);
  }
  // cars
  const carColors = [M.white, M.graphite, M.lunar, M.deep];
  for (const [x, z, ry, c] of [[-14, ROAD[0] + 1.6, 0, 0], [24, ROAD[0] + 1.6, 0, 1], [-30, ROAD[1] - 1.8, Math.PI, 2], [6, ROAD[1] - 5.2, Math.PI, 3]]) {
    const car = makeCar(M, carColors[c]); car.position.set(x, -0.15, z); car.rotation.y = ry; st.add(car);
    col.box(x - 2.3, x + 2.3, z - 1.0, z + 1.0);
  }
  // neighbour buildings + Tashkent City skyline
  neighbours(st, M, stoneMat, dn);
  skyline(st, dn);
  progress(0.75);

  // ================= PEOPLE =================
  const ppl = new THREE.Group(); ppl.name = 'scale_figures'; world.add(ppl);
  const pm = M.person;
  [
    { x: 2.6, z: 3.6, rot: Math.PI / 2, pose: 'walk', h: 1.78 },
    { x: -2.9, z: 4.3, rot: Math.PI, pose: 'stand', h: 1.68 },
    { x: -2.3, z: 4.0, rot: 2.6, pose: 'lean', h: 1.82 },
    { x: 1.7, z: 2.7, rot: -2.5, pose: 'stand', h: 1.64 },
    { x: -9.5, z: 2.0, rot: -Math.PI / 2, pose: 'walk', h: 1.75 },
    { x: 11.3, z: 3.25, rot: 0, pose: 'sit', h: 1.72 },
    { x: 14, z: ROAD[1] + 2.0, rot: Math.PI / 2, pose: 'walk', h: 1.7 },
    { x: 18, z: 31.5, rot: 0.4, pose: 'stand', h: 1.8 },
    { x: 8, z: 36, rot: -1.2, pose: 'walk', h: 1.66 },
    // inside
    { x: -1.0, z: -5.25, rot: 0, pose: 'stand', h: 1.74 },
    { x: -1.6, z: -3.92, rot: Math.PI, pose: 'barsit', h: 1.76 },
    { x: 0.0, z: -3.92, rot: Math.PI, pose: 'barsit', h: 1.66 },
    { x: -3.6, z: -1.04, rot: Math.PI, pose: 'sit', h: 1.7 },
    { x: -3.6, z: -2.16, rot: 0, pose: 'sit', h: 1.78 },
    { x: 2.46, z: -1.6, rot: -Math.PI / 2, pose: 'sit', h: 1.72 },
    { x: 4.1, z: 0.1, rot: 0, pose: 'barsit', h: 1.7 },
    { x: 3.75, z: -5.55, rot: 0, pose: 'stand', h: 1.7 },
    { x: 3.6, z: -4.2, rot: Math.PI, pose: 'stand', h: 1.8 },
    { x: 4.0, z: -2.9, rot: Math.PI / 2, pose: 'stand', h: 1.65 },
  ].forEach((o) => addPerson(ppl, pm, o));

  // facade outer collisions
  col.seg(-HX - 0.1, 0.55, -DOOR_W / 2 - 0.15, 0.55).seg(DOOR_W / 2 + 0.15, 0.55, HX + 0.1, 0.55);
  col.seg(-DOOR_W / 2 - 0.15, 0.55, -DOOR_W / 2 - 0.15, TUN_END + 0.2).seg(DOOR_W / 2 + 0.15, 0.55, DOOR_W / 2 + 0.15, TUN_END + 0.2);
  col.seg(-60, 0.1, -HX - 0.1, 0.1).seg(HX + 0.1, 0.1, 60, 0.1);

  // ================= merge static geometry =================
  const stats = mergeStatic(world);
  const fxStats = mergeStatic(fx);
  progress(0.9);

  // cut-away layer (roof/upper floors) for the dollhouse view
  const roofLayer = [];
  world.traverse((o) => { if (o.userData.layer === 'roof') roofLayer.push(o); });

  // ================= hotspots / tour / plan =================
  const Z = ZONES.tashkent;
  const hotspots = [
    { id: 'facade', pos: [3.2, 3.7, 1.0], zone: 'out', ...Z.facade },
    { id: 'entrance', pos: [0, 2.2, 2.1], zone: 'out', ...Z.entrance },
    { id: 'park', pos: [19.5, 2.4, ROAD[1] + 2.2], zone: 'out', ...Z.park },
    { id: 'bar', pos: [-0.8, 1.55, -4.6], zone: 'in', ...Z.bar },
    { id: 'kitchen', pos: [-4.0, 1.9, -5.0], zone: 'in', ...Z.kitchen },
    { id: 'merch', pos: [HX - 0.3, 1.95, -3.1], zone: 'in', ...Z.merch },
    { id: 'tourdesk', pos: [3.75, 1.45, -4.95], zone: 'in', ...Z.tourdesk },
    { id: 'crew', pos: [-HX + 0.2, 2.25, -2.05], zone: 'in', ...Z.crew },
    { id: 'hall', pos: [0, 1.5, -1.6], zone: 'in', ...Z.hall },
    { id: 'earth', pos: [HX - 0.15, 1.7, -1.35], zone: 'in', ...Z.earth },
  ];
  const tour = [
    { pos: [-17, 7.5, 22], look: [0, 2.4, 0], hold: 1.6, move: 3.0, title: 'STATION 01 · TASHKENT', text: 'Первый этаж в центре Ташкента, напротив Tashkent City Park.' },
    { pos: [7.5, 3.0, 9.5], look: [0, 2.6, 0.4], hold: 2.6, move: 4.5, hotspot: 'facade' },
    { pos: [0, 1.7, 5.4], look: [0, 1.6, 1.0], hold: 2.4, move: 3.5, hotspot: 'entrance' },
    { pos: [0, 1.65, 0.4], look: [0, 1.5, -3.5], hold: 0.3, move: 3.2 },
    { pos: [-0.3, 1.62, -2.7], look: [-0.9, 1.35, -5.3], hold: 2.8, move: 2.8, hotspot: 'bar' },
    { pos: [2.6, 1.62, -2.3], look: [4.75, 1.3, -3.1], hold: 2.6, move: 2.6, hotspot: 'merch' },
    { pos: [2.3, 1.66, -3.3], look: [3.8, 1.5, -5.7], hold: 2.6, move: 2.2, hotspot: 'tourdesk' },
    { pos: [-2.9, 2.25, -3.45], look: [0.6, 1.05, 0.4], hold: 3.2, move: 3.2, hotspot: 'hall' },
  ];
  const plan = {
    bounds: [-6.2, 6.2, -7, 2.6],
    draw(ctx, S) {
      ctx.strokeStyle = 'rgba(221,227,234,0.85)'; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(...S(-HX, 0)); ctx.lineTo(...S(-HX, BACK)); ctx.lineTo(...S(HX, BACK)); ctx.lineTo(...S(HX, 0));
      ctx.stroke();
      // front shell bulge
      ctx.beginPath();
      ctx.moveTo(...S(-HX, 0)); ctx.lineTo(...S(-HX, 0.95)); ctx.lineTo(...S(-1, 0.95)); ctx.lineTo(...S(-1, TUN_END + 0.1));
      ctx.moveTo(...S(1, TUN_END + 0.1)); ctx.lineTo(...S(1, 0.95)); ctx.lineTo(...S(HX, 0.95)); ctx.lineTo(...S(HX, 0));
      ctx.stroke();
      const zone = (x0, z0, x1, z1, c) => { ctx.fillStyle = c; const a = S(x0, z0), b = S(x1, z1); ctx.fillRect(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])); };
      zone(BX0, BZ - 0.3, BX1, BZ + 0.3, 'rgba(255,106,26,0.75)');
      zone(BX0, BACK, BX1, BACK + 0.6, 'rgba(255,106,26,0.35)');
      zone(-HX, BACK, KX, KZ, 'rgba(221,227,234,0.18)');
      zone(2.8, -5.3, 4.7, -4.62, 'rgba(242,194,48,0.7)');
      zone(HX - 0.55, -3.9, HX, -2.3, 'rgba(242,194,48,0.45)');
      zone(-HX, -3.7, -HX + 0.12, -0.4, 'rgba(111,168,255,0.7)');
      ctx.fillStyle = 'rgba(221,227,234,0.55)';
      for (const [tx, tz] of tables) { const p = S(tx, tz); ctx.beginPath(); ctx.arc(p[0], p[1], 4, 0, Math.PI * 2); ctx.fill(); }
    },
    labels: [['BAR', -0.8, -4.65], ['KITCHEN', -4.05, -5.3], ['TOUR', 3.75, -5.75], ['MERCH', 4.1, -3.1], ['CREW', -4.4, -2.05], ['HALL', 0, -1.6], ['ENTRY', 0, 1.2]],
  };

  const bounds = { x0: -60, x1: 60, z0: BACK + 0.3, z1: 64 };
  const station = {
    id: 'tashkent',
    scene, world, base, dn, M,
    exportRoot: world,
    orbitView: { pos: [7.5, 3.6, 15.5], target: [-0.6, 2.1, 0] },
    orbit: { minDistance: 2.5, maxDistance: 85, maxPolar: Math.PI * 0.49 },
    walkSpawn: { pos: [0, 0, 6.0], yaw: 0, pitch: 0.02 },
    doorPath: [
      { pos: [0, 1.7, 5.0], look: [0, 1.6, 0.5], move: 2.2, hold: 0 },
      { pos: [0, 1.65, 0.2], look: [0, 1.5, -3.5], move: 2.0, hold: 0 },
    ],
    colliders: col,
    groundAt(x, z) { return z > ROAD[0] && z < ROAD[1] ? -0.15 : 0; },
    clampWalk(p) { p.x = Math.max(bounds.x0, Math.min(bounds.x1, p.x)); p.z = Math.max(bounds.z0, Math.min(bounds.z1, p.z)); if (Math.abs(p.x) > HX && p.z < 0.3) p.z = 0.3; },
    isInside(p) { return p.x > -HX && p.x < HX && p.z > BACK && p.z < TUN_END + 0.1 && p.y < CEIL + 0.3; },
    hotspots, tour, plan,
    occluders: [{ box: new THREE.Box3(new THREE.Vector3(-62, 0, -16.5), new THREE.Vector3(62, 30, -0.3)) }],
    stats: { merged: stats, fx: fxStats },
    setNight: (n) => base.setNight(n),
    setCutaway(on) { roofLayer.forEach((o) => { o.visible = !on; }); renderer.shadowMap.needsUpdate = true; },
    update(dt, t, camera, mode) {
      for (const m of earthMats) m.uniforms.uTime.value = t;
      // automatic doors
      const near = Math.hypot(camera.position.x, camera.position.z - TUN_END) < 3.6 || mode === 'tour';
      for (const d of dynamic.doors) {
        const target = near ? d.userData.openX : d.userData.closedX;
        d.position.x += (target - d.position.x) * (1 - Math.exp(-dt * 5));
      }
    },
    dispose() {
      disposeTree(scene);
      base.sky.dispose();
      clearPeopleCache();
    },
  };
  base.setNight(0);
  progress(1);
  return station;
}

// ---------------- helpers ----------------
function addStreetLamp(parent, fx, M, poolMat, x, z, dir) {
  const H = 6.6;
  place(parent, new THREE.CylinderGeometry(0.06, 0.09, H, 10), M.aluDark, { p: [x, H / 2, z] });
  place(parent, new THREE.CylinderGeometry(0.16, 0.2, 0.3, 12), M.aluDark, { p: [x, 0.15, z] });
  place(parent, new THREE.BoxGeometry(0.08, 0.08, 1.4), M.aluDark, { p: [x, H - 0.05, z + dir * 0.7] });
  place(parent, roundedBox(0.3, 0.09, 0.7, 0.04), M.aluDark, { p: [x, H - 0.08, z + dir * 1.35] });
  place(parent, new THREE.BoxGeometry(0.22, 0.012, 0.6), M.lampHead, { p: [x, H - 0.13, z + dir * 1.35], cast: false });
  lightPools(fx, poolMat, x, z + dir * 1.5, 3.8);
}

// Additive light pool split across sidewalk / road levels so it always lies on a surface
function lightPools(fx, mat, cx, cz, r) {
  const bands = [[-1e3, ROAD[0] - 0.2, 0.015], [ROAD[0], ROAD[1], -0.135], [ROAD[1] + 0.2, 1e3, 0.015]];
  for (const [a, b, y] of bands) {
    const z0 = Math.max(a, cz - r), z1 = Math.min(b, cz + r);
    if (z1 - z0 < 0.05) continue;
    const g = new THREE.PlaneGeometry(2 * r, z1 - z0);
    g.rotateX(-Math.PI / 2);
    g.translate(cx, y, (z0 + z1) / 2);
    const p = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) - cx) / (2 * r) + 0.5, 0.5 - (p.getZ(i) - cz) / (2 * r));
    place(fx, g, mat, { cast: false, receive: false });
  }
}

function bench(M) {
  const g = new THREE.Group();
  for (const x of [-0.75, 0.75]) place(g, new THREE.BoxGeometry(0.06, 0.42, 0.5), M.aluDark, { p: [x, 0.21, 0] });
  for (let i = 0; i < 4; i++) place(g, roundedBox(1.8, 0.035, 0.1, 0.015), M.lunar, { p: [0, 0.44, -0.18 + i * 0.12] });
  for (let i = 0; i < 2; i++) place(g, roundedBox(1.8, 0.1, 0.035, 0.015), M.lunar, { p: [0, 0.62 + i * 0.13, -0.27], r: [-0.15, 0, 0] });
  for (const x of [-0.75, 0.75]) place(g, new THREE.BoxGeometry(0.05, 0.4, 0.05), M.aluDark, { p: [x, 0.62, -0.28] });
  return g;
}

function makeCar(M, paint) {
  const g = new THREE.Group();
  const glass = M.screenOff;
  place(g, roundedBox(4.4, 0.62, 1.78, 0.22), paint, { p: [0, 0.58, 0] });
  place(g, roundedBox(2.4, 0.5, 1.56, 0.25), glass, { p: [-0.2, 1.1, 0] });
  place(g, roundedBox(2.2, 0.06, 1.5, 0.2), paint, { p: [-0.2, 1.36, 0] });
  for (const x of [-1.35, 1.35]) for (const zz of [-0.78, 0.78]) {
    place(g, new THREE.CylinderGeometry(0.34, 0.34, 0.24, 18), M.rubber, { p: [x, 0.34, zz], r: [Math.PI / 2, 0, 0] });
    place(g, new THREE.CylinderGeometry(0.2, 0.2, 0.25, 12), M.alu, { p: [x, 0.34, zz], r: [Math.PI / 2, 0, 0], cast: false });
  }
  for (const zz of [-0.6, 0.6]) {
    place(g, new THREE.BoxGeometry(0.04, 0.08, 0.32), M.ledWhite, { p: [2.2, 0.72, zz], cast: false });
    place(g, new THREE.BoxGeometry(0.04, 0.07, 0.36), M.ledRed, { p: [-2.2, 0.75, zz], cast: false });
  }
  return g;
}

function neighbours(parent, M, stoneMat, dn) {
  const defs = [
    { x0: -62, x1: -40.5, h: 18, tint: '#B8B2A6' },
    { x0: -40, x1: -20.3, h: 24, tint: '#C9BFAF' },
    { x0: 20.3, x1: 41, h: 30, tint: '#AEB4BA' },
    { x0: 41.5, x1: 62, h: 15, tint: '#CDC4B4' },
  ];
  for (const [i, d] of defs.entries()) {
    const w = d.x1 - d.x0;
    const ft = T.facadeTextures({ cols: 9, rows: 5, bayW: 2.2, floorH: 3.2, stone: d.tint, seed: 100 + i * 7, litRatio: 0.3 });
    ft.map.repeat.set(w / 19.8, (d.h - 4.4) / 16);
    ft.emissiveMap.repeat.set(w / 19.8, (d.h - 4.4) / 16);
    const fm = new THREE.MeshStandardMaterial({ name: 'facade-' + i, map: ft.map, emissiveMap: ft.emissiveMap, emissive: '#fff', roughness: 0.8 });
    dn.prop(fm, 'emissiveIntensity', 0, 1.2);
    place(parent, new THREE.PlaneGeometry(w, d.h - 4.4), fm, { p: [(d.x0 + d.x1) / 2, 4.4 + (d.h - 4.4) / 2, -0.4] });
    box(parent, w, d.h, 16, stoneMat, (d.x0 + d.x1) / 2, d.h / 2, -8.45);
    const sm = new THREE.MeshStandardMaterial({ name: 'shops-' + i, color: '#1D232B', roughness: 0.3, metalness: 0.3 });
    place(parent, new THREE.PlaneGeometry(w - 1, 3.6), sm, { p: [(d.x0 + d.x1) / 2, 1.9, -0.39] });
  }
}

function skyline(parent, dn) {
  const r = rng(404);
  const tex = T.towerTextures({ seed: 71 });
  const defs = [
    [-120, 190, 30, 30, 120], [-70, 160, 26, 26, 96], [-25, 210, 34, 34, 150], [25, 175, 28, 28, 110],
    [70, 200, 30, 30, 132], [115, 165, 24, 24, 80], [-160, 230, 30, 30, 70], [160, 240, 30, 30, 88], [0, 260, 40, 40, 62],
  ];
  for (const [x, z, w, d, h] of defs) {
    const m = new THREE.MeshStandardMaterial({ name: 'tower', map: tex.map.clone(), emissiveMap: tex.emissiveMap.clone(), emissive: '#fff', roughness: 0.25, metalness: 0.6 });
    m.map.repeat.set(w / 24, h / 48); m.emissiveMap.repeat.set(w / 24, h / 48);
    m.map.needsUpdate = m.emissiveMap.needsUpdate = true;
    dn.prop(m, 'emissiveIntensity', 0, 1.4);
    const round = r() < 0.25;
    const geo = round ? new THREE.CylinderGeometry(w / 2, w / 2, h, 24) : new THREE.BoxGeometry(w, h, d);
    place(parent, geo, m, { p: [x, h / 2, z], r: [0, r() * 0.6, 0], cast: false, receive: false });
  }
}

// ---- trees: instanced trunks + alpha-tested leaf cards ----
function makeTrees(M, quality) {
  const leafTex = T.leafTexture(91);
  const leafMat = new THREE.MeshStandardMaterial({ name: 'foliage', map: leafTex, alphaTest: 0.5, side: THREE.DoubleSide, vertexColors: true, roughness: 0.82 });
  const barkMat = new THREE.MeshStandardMaterial({ name: 'bark', color: '#8D8573', roughness: 0.95 });
  const variants = [0, 1].map((k) => treeGeometry(31 + k * 17, quality.foliage, k));
  return {
    place(parent, list, r) {
      const groups = [[], []];
      list.forEach((p, i) => groups[i % 2].push(p));
      groups.forEach((pts, k) => {
        if (!pts.length) return;
        const { trunk, leaves } = variants[k];
        const tm = new THREE.InstancedMesh(trunk, barkMat, pts.length);
        const lm = new THREE.InstancedMesh(leaves, leafMat, pts.length);
        const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3();
        pts.forEach(([x, z], i) => {
          q.setFromAxisAngle(V(0, 1, 0), r() * Math.PI * 2);
          const sc = 0.85 + r() * 0.35;
          s.set(sc, sc * (0.9 + r() * 0.2), sc);
          m.compose(V(x, 0, z), q, s);
          tm.setMatrixAt(i, m);
          lm.setMatrixAt(i, m);
        });
        tm.castShadow = lm.castShadow = true;
        tm.receiveShadow = lm.receiveShadow = true;
        tm.name = 'trees_trunks'; lm.name = 'trees_foliage';
        tm.computeBoundingSphere(); lm.computeBoundingSphere();
        parent.add(tm, lm);
      });
    },
  };
}

function treeGeometry(seed, foliage = 1, variant = 0) {
  const r = rng(seed);
  const parts = [];
  const H = 2.9 + variant * 0.4;
  parts.push(cylinderBetween(V(0, 0, 0), V(0.06, H, 0.03), 0.2, 0.15, 10));
  const ends = [];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + r() * 0.6;
    const start = V(0.06, H - 0.5 + r() * 0.5, 0.03);
    const len = 1.5 + r() * 0.8;
    const end = V(Math.cos(a) * len, H + 2.0 + r() * 1.4, Math.sin(a) * len);
    parts.push(cylinderBetween(start, end, 0.12, 0.06, 7));
    const mid = start.clone().lerp(end, 0.6);
    const e2 = mid.clone().add(V(Math.cos(a + 1) * 1.0, 1.1 + r() * 0.5, Math.sin(a + 1) * 1.0));
    parts.push(cylinderBetween(mid, e2, 0.06, 0.03, 6));
    ends.push(end, e2);
  }
  const trunk = mergeGeometries(parts.map((g) => { const n = g.toNonIndexed(); n.deleteAttribute('uv'); return n; }));
  parts.forEach((g) => g.dispose());
  // leaf cards
  const N = Math.round(190 * foliage);
  const center = V(0, H + 2.6, 0);
  const rad = V(3.1 - variant * 0.3, 2.4 + variant * 0.3, 3.1 - variant * 0.3);
  const pos = [], nor = [], uv = [], colr = [], idx = [];
  const tmp = V(), ax = V(), ay = V(), nrm = V();
  for (let i = 0; i < N; i++) {
    do { tmp.set(r() * 2 - 1, r() * 2 - 1, r() * 2 - 1); } while (tmp.lengthSq() > 1 || tmp.lengthSq() < 0.01);
    const dirn = tmp.clone().normalize();
    const k = 0.45 + 0.55 * Math.cbrt(r());
    const c = V(center.x + dirn.x * rad.x * k, center.y + dirn.y * rad.y * k, center.z + dirn.z * rad.z * k);
    const size = 1.05 + r() * 0.85;
    // random card orientation
    nrm.set(r() * 2 - 1, r() * 2 - 1, r() * 2 - 1).multiplyScalar(0.75).add(dirn).normalize();
    ax.set(0, 1, 0).cross(nrm); if (ax.lengthSq() < 0.01) ax.set(1, 0, 0); ax.normalize();
    ay.copy(nrm).cross(ax).normalize();
    const shade = (0.55 + 0.45 * k) * (0.8 + 0.2 * (dirn.y * 0.5 + 0.5));
    const outN = dirn.clone().multiplyScalar(0.8).add(V(0, 0.35, 0)).normalize();
    const base = pos.length / 3;
    for (const [sx, sy, u, v] of [[-1, -1, 0, 0], [1, -1, 1, 0], [1, 1, 1, 1], [-1, 1, 0, 1]]) {
      pos.push(c.x + (ax.x * sx + ay.x * sy) * size / 2, c.y + (ax.y * sx + ay.y * sy) * size / 2, c.z + (ax.z * sx + ay.z * sy) * size / 2);
      nor.push(outN.x, outN.y, outN.z);
      uv.push(u, v);
      colr.push(shade, shade * (0.98 + r() * 0.04), shade * 0.95);
    }
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  const leaves = new THREE.BufferGeometry();
  leaves.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  leaves.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  leaves.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  leaves.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3));
  leaves.setIndex(idx);
  return { trunk, leaves };
}
