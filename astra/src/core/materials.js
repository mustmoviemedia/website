// PBR material library + day/night mixer.
import * as THREE from 'three';
import * as T from './textures.js';

export const BRAND = {
  void: '#05080F',
  deep: '#13223A',
  orange: '#FF6A1A',
  gold: '#F2C230',
  lunar: '#DDE3EA',
  mars: '#B4482A',
};

// Collects functions f(n) where n: 0 = day, 1 = night
export class DayNight {
  constructor() { this.items = []; this.value = 0; }
  add(fn) { this.items.push(fn); fn(this.value); return fn; }
  prop(obj, key, day, night) { return this.add((n) => { obj[key] = day + (night - day) * n; }); }
  color(color, day, night) {
    const a = new THREE.Color(day), b = new THREE.Color(night);
    return this.add((n) => color.copy(a).lerp(b, n));
  }
  set(n) { this.value = n; for (const f of this.items) f(n); }
}

function rep(tex, meters) {
  if (!tex) return tex;
  const t = tex.clone();
  t.repeat.set(1 / (meters[0] ?? meters), 1 / (meters[1] ?? meters));
  t.needsUpdate = true;
  return t;
}

// Box-projected metric UVs (1 uv = 1 m) — keeps tiling textures at real scale
export function boxUV(g, scale = 1) {
  const p = g.attributes.position, n = g.attributes.normal;
  if (!n) g.computeVertexNormals();
  const nn = g.attributes.normal;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(nn.getX(i)), ay = Math.abs(nn.getY(i)), az = Math.abs(nn.getZ(i));
    let u, v;
    if (ax >= ay && ax >= az) { u = p.getZ(i); v = p.getY(i); }
    else if (ay >= az) { u = p.getX(i); v = p.getZ(i); }
    else { u = p.getX(i); v = p.getY(i); }
    uv[i * 2] = u * scale; uv[i * 2 + 1] = v * scale;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

export function createMaterials(dn, { interiorEnv = 0.4 } = {}) {
  const panel = T.panelTextures({ size: 1024 });
  const floor = T.floorTextures({});
  const std = (o) => new THREE.MeshStandardMaterial(o);

  const M = {};
  M.composite = std({
    name: 'composite-white', color: '#F1F2F2', roughness: 0.62, metalness: 0,
    map: rep(panel.map, [panel.metersU, panel.metersV]),
    normalMap: rep(panel.normalMap, [panel.metersU, panel.metersV]),
    normalScale: new THREE.Vector2(0.8, 0.8),
    roughnessMap: rep(panel.roughnessMap, [panel.metersU, panel.metersV]),
  });
  M.compositeIn = M.composite.clone();
  M.compositeIn.name = 'composite-interior';
  M.compositeIn.envMapIntensity = interiorEnv;
  M.compositeIn.normalScale = new THREE.Vector2(0.45, 0.45);
  M.compositeIn.color = new THREE.Color('#F4F5F5');
  M.white = std({ name: 'white-smooth', color: '#EEF1F4', roughness: 0.42 });
  M.whiteIn = std({ name: 'white-interior', color: '#EEF1F4', roughness: 0.42, envMapIntensity: interiorEnv });
  M.alu = std({ name: 'aluminium', color: '#C9CED6', metalness: 1, roughness: 0.3 });
  M.aluSatin = std({ name: 'aluminium-satin', color: '#B9C0C9', metalness: 1, roughness: 0.45 });
  M.aluDark = std({ name: 'aluminium-dark', color: '#4D5561', metalness: 0.85, roughness: 0.42 });
  M.graphite = std({ name: 'graphite', color: '#181E27', metalness: 0.15, roughness: 0.5 });
  M.graphiteIn = std({ name: 'graphite-interior', color: '#181E27', metalness: 0.15, roughness: 0.42, envMapIntensity: interiorEnv });
  M.stoneTop = std({ name: 'stone-top', color: '#22262C', roughness: 0.28, metalness: 0.05, envMapIntensity: interiorEnv * 1.4 });
  M.floor = std({
    name: 'floor', color: '#FFFFFF', roughness: 0.55, metalness: 0.05, envMapIntensity: interiorEnv,
    map: rep(floor.map, floor.meters), normalMap: rep(floor.normalMap, floor.meters),
  });
  M.glass = new THREE.MeshPhysicalMaterial({
    name: 'glass', color: '#A9C2D9', metalness: 0, roughness: 0.04, transparent: true, opacity: 0.18,
    envMapIntensity: 1.6, depthWrite: false, side: THREE.DoubleSide, specularIntensity: 1, ior: 1.5,
  });
  M.glassVitrine = M.glass.clone();
  M.glassVitrine.name = 'glass-vitrine';
  M.glassVitrine.opacity = 0.1;
  M.orange = std({ name: 'orange', color: BRAND.orange, roughness: 0.45 });
  M.gold = std({ name: 'gold', color: BRAND.gold, metalness: 0.9, roughness: 0.28 });
  M.lunar = std({ name: 'lunar', color: BRAND.lunar, roughness: 0.5 });
  M.mars = std({ name: 'mars', color: BRAND.mars, roughness: 0.75 });
  M.deep = std({ name: 'deep-blue', color: BRAND.deep, roughness: 0.4, metalness: 0.2 });
  M.rubber = std({ name: 'rubber', color: '#2A2F36', roughness: 0.92 });
  M.person = std({ name: 'scale-figure', color: '#B7BFC9', roughness: 0.85 });
  M.screenOff = std({ name: 'screen-glass', color: '#06090F', roughness: 0.12, metalness: 0.3 });
  M.steel = std({ name: 'steel', color: '#A7ADB4', metalness: 1, roughness: 0.22, envMapIntensity: interiorEnv * 2 });

  // Emissive (LED). Intensities > 1 feed the bloom.
  const led = (name, color, day, night) => {
    const m = std({ name, color: '#111', emissive: color, emissiveIntensity: day, roughness: 0.4 });
    dn.prop(m, 'emissiveIntensity', day, night);
    return m;
  };
  M.ledWarm = led('led-warm', '#FFB872', 2.2, 5.5);
  M.ledWhite = led('led-white', '#FFE7CC', 2.0, 4.5);
  M.ledOrange = led('led-orange', BRAND.orange, 2.0, 6.0);
  M.ledGold = led('led-gold', BRAND.gold, 1.6, 4.0);
  M.ledCool = led('led-cool', '#CFE2FF', 1.4, 3.5);
  M.ledRed = led('led-red', '#FF2A1A', 1.5, 7.0);
  M.lampHead = led('lamp-head', '#FFE2B8', 0.0, 8.0);

  return M;
}

// Emissive sign material from a canvas texture (alpha via map, glows at night)
export function signMaterial(dn, tex, { day = 0.9, night = 5, color = '#ffffff', alphaTest = 0.35 } = {}) {
  const m = new THREE.MeshStandardMaterial({
    name: 'sign', color, map: tex, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: day,
    transparent: false, alphaTest, roughness: 0.4, side: THREE.DoubleSide,
  });
  dn.prop(m, 'emissiveIntensity', day, night);
  return m;
}

// Screen / display: unlit-ish image with emissive
export function screenMaterial(dn, tex, { day = 1.1, night = 1.6 } = {}) {
  const m = new THREE.MeshStandardMaterial({ name: 'screen', color: '#000', emissive: '#fff', emissiveMap: tex, emissiveIntensity: day, roughness: 0.15, metalness: 0.1 });
  dn.prop(m, 'emissiveIntensity', day, night);
  return m;
}

// Fake light pool on the ground (additive), visible at night
export function lightPoolMaterial(dn, color = '#FFB46B', day = 0, night = 0.55) {
  const tex = T.radialTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)', 128, 0.35);
  const m = new THREE.MeshBasicMaterial({ name: 'light-pool', color, map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: day, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, toneMapped: false });
  dn.prop(m, 'opacity', day, night);
  return m;
}

// Soft contact shadow blob
export function contactShadowMaterial(opacity = 0.5) {
  const tex = T.radialTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)', 64, 0.25);
  return new THREE.MeshBasicMaterial({ name: 'contact-shadow', color: '#000', alphaMap: tex, transparent: true, opacity, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
}
