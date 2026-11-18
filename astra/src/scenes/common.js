// Shared station scaffolding: scene, sky, sun/moon light, hemisphere, fog, day/night blend.
import * as THREE from 'three';
import { createSky } from '../core/sky.js';
import { DayNight } from '../core/materials.js';

export function createStationBase(renderer, quality, cfg) {
  const scene = new THREE.Scene();
  const dn = new DayNight();
  const sky = createSky(cfg.sky);
  scene.add(sky.group);
  sky.bakeEnvironment(renderer);
  scene.environment = sky.envDay;

  const fog = new THREE.FogExp2(new THREE.Color(cfg.fog.dayColor), cfg.fog.day);
  scene.fog = fog;

  const sun = new THREE.DirectionalLight(cfg.sun.dayColor, cfg.sun.day);
  sun.castShadow = true;
  const s = cfg.sun.shadowSize || 30;
  sun.shadow.camera.left = -s; sun.shadow.camera.right = s;
  sun.shadow.camera.top = s; sun.shadow.camera.bottom = -s;
  sun.shadow.camera.near = 1; sun.shadow.camera.far = cfg.sun.dist * 2 + 60;
  sun.shadow.mapSize.set(quality.shadow, quality.shadow);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = cfg.sun.normalBias ?? 0.035;
  sun.shadow.radius = quality.tier === 'high' ? 3 : 2;
  const center = new THREE.Vector3(...(cfg.sun.center || [0, 0, 0]));
  sun.target.position.copy(center);
  scene.add(sun, sun.target);

  const hemi = new THREE.HemisphereLight(cfg.hemi.daySky, cfg.hemi.dayGround, cfg.hemi.day);
  scene.add(hemi);

  const sunDir = cfg.sky.sunDir.clone().normalize();
  const moonDir = cfg.sky.moonDir.clone().normalize();
  let side = -1;
  const colDay = new THREE.Color(cfg.sun.dayColor), colNight = new THREE.Color(cfg.sun.nightColor);
  const hs = [new THREE.Color(cfg.hemi.daySky), new THREE.Color(cfg.hemi.nightSky)];
  const hg = [new THREE.Color(cfg.hemi.dayGround), new THREE.Color(cfg.hemi.nightGround)];

  function setNight(n) {
    dn.set(n);
    sky.setNight(n);
    // sun fades out, then moon fades in from its own direction (one shadow re-render at the switch)
    const isNight = n > 0.5;
    const k = isNight ? (n - 0.5) * 2 : 1 - n * 2;
    const e = k * k * (3 - 2 * k);
    const newSide = isNight ? 1 : 0;
    if (newSide !== side) {
      side = newSide;
      sun.position.copy(center).addScaledVector(isNight ? moonDir : sunDir, cfg.sun.dist);
      sun.color.copy(isNight ? colNight : colDay);
      scene.environment = isNight ? sky.envNight : sky.envDay;
      renderer.shadowMap.needsUpdate = true;
    }
    sun.intensity = (isNight ? cfg.sun.night : cfg.sun.day) * e;
    scene.environmentIntensity = THREE.MathUtils.lerp(cfg.env.day, cfg.env.night, n);
    hemi.color.copy(hs[0]).lerp(hs[1], n);
    hemi.groundColor.copy(hg[0]).lerp(hg[1], n);
    hemi.intensity = THREE.MathUtils.lerp(cfg.hemi.day, cfg.hemi.night, n);
    sky.fogColor(n, fog.color);
    fog.density = THREE.MathUtils.lerp(cfg.fog.day, cfg.fog.night, n);
  }

  return { scene, sky, dn, sun, hemi, fog, setNight };
}

// Dispose every GPU resource below an object (geometries, materials, textures, shadow maps)
export function disposeTree(root) {
  const mats = new Set(), texs = new Set();
  root.traverse((o) => {
    if (o.isLight && o.shadow && o.shadow.map) o.shadow.dispose();
    if (o.geometry) o.geometry.dispose();
    const m = o.material;
    if (m) (Array.isArray(m) ? m : [m]).forEach((x) => mats.add(x));
  });
  mats.forEach((m) => {
    for (const k of Object.keys(m)) { const v = m[k]; if (v && v.isTexture) texs.add(v); }
    if (m.uniforms) for (const u of Object.values(m.uniforms)) if (u.value && u.value.isTexture) texs.add(u.value);
    m.dispose();
  });
  texs.forEach((t) => t.dispose());
}
