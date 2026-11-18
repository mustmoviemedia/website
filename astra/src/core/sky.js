// Procedural sky: day gradient + sun, sunset glow, night gradient (brand #05080F / #13223A),
// Milky Way, stars and moon. Also bakes image-based lighting (PMREM) for day and night.
import * as THREE from 'three';
import { createNoise2D, fbm, rng } from './noise.js';
import { makeCanvas } from './textures.js';

const vert = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize((modelMatrix * vec4(position, 0.0)).xyz);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}`;

const frag = /* glsl */ `
varying vec3 vDir;
uniform vec3 uZenith, uHorizon, uGround, uSunColor, uGlowColor, uNZenith, uNHorizon, uNGround, uCityGlow;
uniform vec3 uSunDir, uMoonDir;
uniform float uNight, uGlow, uHorizonGlow, uMilky, uSunSize, uSunBoost;
uniform sampler2D uMilkyTex;
void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  float hp = max(h, 0.0);
  float sd = dot(d, uSunDir);
  float sdp = max(sd, 0.0);
  vec2 az = normalize(d.xz + 1e-5);
  vec2 saz = normalize(uSunDir.xz + 1e-5);
  float azd = max(dot(az, saz), 0.0);

  vec3 day = mix(uHorizon, uZenith, pow(hp, 0.5));
  day += uGlowColor * uHorizonGlow * (0.35 + 0.65 * pow(azd, 2.5)) * exp(-hp * 7.0);
  day += uGlowColor * uGlow * (pow(sdp, 5.0) * 0.4 + pow(sdp, 48.0) * 0.6);
  float disk = smoothstep(cos(uSunSize), cos(uSunSize * 0.8), sd);
  day += uSunColor * disk * uSunBoost;
  day = mix(day, uGround, smoothstep(0.0, -0.05, h));

  vec3 night = mix(uNHorizon, uNZenith, pow(hp, 0.55));
  night += uCityGlow * exp(-hp * 9.0);
  vec2 uv = vec2(atan(d.z, d.x) / 6.2831853 + 0.5, asin(clamp(d.y, -1.0, 1.0)) / 3.14159265 + 0.5);
  night += texture2D(uMilkyTex, uv).rgb * uMilky * smoothstep(-0.02, 0.3, h);
  float md = max(dot(d, uMoonDir), 0.0);
  night += vec3(0.5, 0.58, 0.72) * (pow(md, 90.0) * 0.12 + pow(md, 10.0) * 0.025);
  night = mix(night, uNGround, smoothstep(0.0, -0.05, h));

  vec3 col = mix(day, night, uNight);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

function milkyWayTexture(seed = 5) {
  const w = 1024, h = 512;
  const c = makeCanvas(w, h), ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  const n = createNoise2D(seed);
  const plane = new THREE.Vector3(0.35, 0.55, 0.76).normalize();
  const along = new THREE.Vector3(0.9, -0.43, 0).normalize();
  const d = new THREE.Vector3();
  for (let y = 0; y < h; y++) {
    const lat = ((y / h) - 0.5) * Math.PI;
    for (let x = 0; x < w; x++) {
      const lon = ((x / w) - 0.5) * Math.PI * 2;
      d.set(Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon));
      const dist = d.dot(plane);
      const a = d.dot(along);
      const band = Math.exp(-(dist * dist) / 0.012);
      const wide = Math.exp(-(dist * dist) / 0.05);
      const f = fbm(n, a * 6 + dist * 3, dist * 9 + a * 2, 5);
      const dust = Math.max(0, fbm(n, a * 14 + 7, dist * 30, 4)) * Math.exp(-(dist * dist) / 0.003);
      const core = 0.6 + 0.4 * Math.max(0, a + 0.3);
      let v = (band * (0.55 + 0.6 * f) + wide * 0.25) * core - dust * 0.9;
      v = Math.max(0, v);
      const i = ((h - 1 - y) * w + x) * 4;
      img.data[i] = Math.min(255, v * 150);
      img.data[i + 1] = Math.min(255, v * 140);
      img.data[i + 2] = Math.min(255, v * 165);
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.generateMipmaps = false;
  t.minFilter = THREE.LinearFilter;
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

function moonTexture() {
  const s = 256;
  const c = makeCanvas(s, s), ctx = c.getContext('2d');
  const r = rng(9);
  const g = ctx.createRadialGradient(s * 0.45, s * 0.42, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, '#F2F4F7'); g.addColorStop(0.85, '#C9CFD8'); g.addColorStop(1, 'rgba(200,205,215,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(s / 2, s / 2, s / 2 - 2, 0, Math.PI * 2); ctx.fill();
  ctx.globalCompositeOperation = 'source-atop';
  for (let i = 0; i < 40; i++) {
    const x = s * (0.15 + r() * 0.7), y = s * (0.15 + r() * 0.7), rr = 3 + r() * (i < 6 ? 34 : 10);
    ctx.fillStyle = `rgba(120,128,140,${0.18 + r() * 0.25})`;
    ctx.beginPath(); ctx.arc(x, y, rr, 0, Math.PI * 2); ctx.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const C = (hex) => new THREE.Color(hex);

export function createSky(preset) {
  const group = new THREE.Group();
  group.name = 'sky';
  group.userData.noExport = true;
  const milky = milkyWayTexture();
  const uniforms = {
    uZenith: { value: C(preset.day.zenith) },
    uHorizon: { value: C(preset.day.horizon) },
    uGround: { value: C(preset.day.ground) },
    uSunColor: { value: C(preset.day.sun) },
    uGlowColor: { value: C(preset.day.glow) },
    uGlow: { value: preset.day.glowStrength },
    uHorizonGlow: { value: preset.day.horizonGlow },
    uSunSize: { value: THREE.MathUtils.degToRad(preset.day.sunSize || 0.9) },
    uSunBoost: { value: preset.day.sunBoost ?? 30 },
    uNZenith: { value: C(preset.night.zenith) },
    uNHorizon: { value: C(preset.night.horizon) },
    uNGround: { value: C(preset.night.ground) },
    uCityGlow: { value: C(preset.night.cityGlow || '#000000') },
    uSunDir: { value: preset.sunDir.clone().normalize() },
    uMoonDir: { value: preset.moonDir.clone().normalize() },
    uNight: { value: 0 },
    uMilky: { value: preset.night.milky },
    uMilkyTex: { value: milky },
  };
  const mat = new THREE.ShaderMaterial({ name: 'sky', vertexShader: vert, fragmentShader: frag, uniforms, side: THREE.BackSide, depthWrite: false, depthTest: true, fog: false });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), mat);
  dome.scale.setScalar(4000);
  dome.frustumCulled = false;
  dome.renderOrder = -10;
  group.add(dome);

  // Stars
  const N = preset.stars ?? 3500;
  const r = rng(77);
  const pos = new Float32Array(N * 3), col = new Float32Array(N * 3), size = new Float32Array(N);
  const v = new THREE.Vector3();
  for (let i = 0; i < N; i++) {
    do { v.set(r() * 2 - 1, r() * 2 - 1, r() * 2 - 1); } while (v.lengthSq() > 1 || v.lengthSq() < 0.01);
    v.normalize();
    if (v.y < -0.05) v.y = -v.y;
    v.multiplyScalar(3500);
    pos.set([v.x, v.y, v.z], i * 3);
    const t = r();
    const c = t < 0.15 ? C('#FFD6A8') : t < 0.35 ? C('#BFD3FF') : C('#FFFFFF');
    const b = Math.pow(r(), 3.5) * 1.6 + 0.25;
    col.set([c.r * b, c.g * b, c.b * b], i * 3);
    size[i] = 1.2 + Math.pow(r(), 6) * 3.2;
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  sg.setAttribute('color', new THREE.BufferAttribute(col, 3));
  sg.setAttribute('size', new THREE.BufferAttribute(size, 1));
  const starMat = new THREE.ShaderMaterial({
    name: 'stars',
    uniforms: { uOpacity: { value: 0 }, uTime: { value: 0 }, uPR: { value: 1 } },
    vertexShader: /* glsl */ `
      attribute float size; attribute vec3 color;
      uniform float uTime, uPR; varying vec3 vC; varying float vTw;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_Position.z = gl_Position.w * 0.9999;
        gl_PointSize = size * uPR;
        vC = color;
        vTw = 0.7 + 0.3 * sin(uTime * (0.7 + size) + position.x * 0.013 + position.z * 0.007);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uOpacity; varying vec3 vC; varying float vTw;
      void main(){
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.05, d);
        gl_FragColor = vec4(vC * vTw * uOpacity * a * 1.6, 1.0);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
  });
  const stars = new THREE.Points(sg, starMat);
  stars.frustumCulled = false;
  stars.renderOrder = -9;
  group.add(stars);

  // Moon
  const moonMat = new THREE.MeshBasicMaterial({ map: moonTexture(), transparent: true, depthWrite: false, fog: false, color: new THREE.Color(1.6, 1.65, 1.75) });
  const moon = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), moonMat);
  moon.scale.setScalar(preset.moonSize || 110);
  moon.renderOrder = -8;
  group.add(moon);

  const sky = {
    group, uniforms, dome, stars, moon,
    envDay: null, envNight: null,
    preset,
    setNight(n) {
      uniforms.uNight.value = n;
      const dayStars = preset.day.stars || 0;
      starMat.uniforms.uOpacity.value = dayStars + (1 - dayStars) * n;
      uniforms.uMilky.value = preset.night.milky * (preset.day.milkyDay || 0) * (1 - n) + preset.night.milky * n;
      moonMat.opacity = Math.max(0, (n - 0.3) / 0.7);
      moon.visible = moonMat.opacity > 0.01;
    },
    update(camera, time, pixelRatio) {
      group.position.copy(camera.position);
      starMat.uniforms.uTime.value = time;
      starMat.uniforms.uPR.value = pixelRatio;
      moon.position.copy(uniforms.uMoonDir.value).multiplyScalar(3600);
      moon.quaternion.copy(camera.quaternion);
    },
    // horizon colour for fog (linear)
    fogColor(n, target = new THREE.Color()) {
      const d = C(preset.fog?.day || preset.day.horizon), nn = C(preset.fog?.night || preset.night.horizon);
      return target.copy(d).lerp(nn, n);
    },
    bakeEnvironment(renderer) {
      const pmrem = new THREE.PMREMGenerator(renderer);
      const envScene = new THREE.Scene();
      const envDome = new THREE.Mesh(dome.geometry, mat);
      envDome.scale.setScalar(50);
      envScene.add(envDome);
      // simple ground bounce disc so reflections are not black underneath
      const prev = uniforms.uNight.value;
      uniforms.uNight.value = 0;
      sky.envDayRT = pmrem.fromScene(envScene, 0.02, 0.1, 200);
      uniforms.uNight.value = 1;
      sky.envNightRT = pmrem.fromScene(envScene, 0.02, 0.1, 200);
      sky.envDay = sky.envDayRT.texture;
      sky.envNight = sky.envNightRT.texture;
      uniforms.uNight.value = prev;
      pmrem.dispose();
    },
    dispose() {
      dome.geometry.dispose(); mat.dispose(); milky.dispose();
      sg.dispose(); starMat.dispose(); moonMat.map.dispose(); moonMat.dispose();
      sky.envDayRT?.dispose(); sky.envNightRT?.dispose();
    },
  };
  return sky;
}
