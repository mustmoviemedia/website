// Renderer + post-processing (bloom, tone mapping, vignette, AA) + adaptive resolution.
import * as THREE from 'three';
import {
  EffectComposer, RenderPass, EffectPass, BloomEffect, ToneMappingEffect, ToneMappingMode,
  VignetteEffect, SMAAEffect, SMAAPreset, BrightnessContrastEffect,
} from 'postprocessing';
import { N8AOPostPass } from 'n8ao';
import { setMaxAnisotropy } from './textures.js';

export function detectQuality() {
  const ua = navigator.userAgent || '';
  const touch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
  const small = Math.min(screen.width, screen.height) < 820;
  // iPadOS Safari reports itself as "Macintosh": detect it by multi-touch support
  const iPadOS = /Macintosh/.test(ua) && (navigator.maxTouchPoints || 0) > 1;
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || iPadOS || (touch && small);
  const cores = navigator.hardwareConcurrency || 4;
  const params = new URLSearchParams(location.search);
  const forced = params.get('q');
  let tier = mobile ? (iPadOS || /iPad/.test(ua) || cores >= 6 ? 'mid' : 'low') : 'high';
  if (forced === 'low' || forced === 'mid' || forced === 'high') tier = forced;
  const dpr = window.devicePixelRatio || 1;
  const Q = {
    high: { maxDpr: Math.min(dpr, 2), minDpr: 0.85, shadow: 2048, msaa: 4, smaa: false, bloomScale: 0.5, foliage: 1, ao: 'Medium' },
    mid: { maxDpr: Math.min(dpr, 1.6), minDpr: 0.8, shadow: 1024, msaa: 0, smaa: true, bloomScale: 0.4, foliage: 0.7, ao: 'Performance' },
    low: { maxDpr: Math.min(dpr, 1.25), minDpr: 0.65, shadow: 1024, msaa: 0, smaa: false, bloomScale: 0.35, foliage: 0.5, ao: null },
  }[tier];
  return { tier, mobile, touch, ...Q };
}

export class Engine {
  constructor(canvas, quality) {
    this.quality = quality;
    this.canvas = canvas;
    const renderer = new THREE.WebGLRenderer({
      canvas, antialias: false, alpha: false, stencil: false, depth: true,
      powerPreference: 'high-performance', preserveDrawingBuffer: false,
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.shadowMap.autoUpdate = false; // static scene: shadows re-rendered only when light changes
    this.renderer = renderer;
    setMaxAnisotropy(renderer.capabilities.getMaxAnisotropy());

    this.camera = new THREE.PerspectiveCamera(55, 1, 0.08, 6000);
    this.scene = null;
    this.dpr = quality.maxDpr;

    const composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType, multisampling: Math.min(quality.msaa, renderer.capabilities.maxSamples || 0) });
    this.composer = composer;
    this.renderPass = new RenderPass(new THREE.Scene(), this.camera);
    composer.addPass(this.renderPass);
    this.bloom = new BloomEffect({ mipmapBlur: true, luminanceThreshold: 1.0, luminanceSmoothing: 0.35, intensity: 0.85, radius: 0.72, levels: quality.tier === 'low' ? 5 : 7, resolutionScale: quality.bloomScale });
    this.tone = new ToneMappingEffect({ mode: ToneMappingMode.AGX });
    this.vignette = new VignetteEffect({ darkness: 0.42, offset: 0.32 });
    this.grade = new BrightnessContrastEffect({ brightness: 0.0, contrast: 0.06 });
    // ambient occlusion (soft contact shading in corners and under furniture), half resolution
    if (quality.ao && new URLSearchParams(location.search).get('ao') !== '0') {
      this.ao = new N8AOPostPass(new THREE.Scene(), this.camera, 512, 512);
      this.ao.configuration.transparencyAware = false;
      this.ao.configuration.gammaCorrection = false;
      this.ao.configuration.halfRes = true;
      this.ao.configuration.aoRadius = 0.85;
      this.ao.configuration.distanceFalloff = 1.0;
      this.ao.configuration.intensity = 2.4;
      this.ao.setQualityMode(quality.ao);
      // n8ao 2.0.1 overrides RenderTarget.texture with the textures array, which three r187 no
      // longer accepts (crash in setupRenderTarget). Restore the base getter — the same change
      // n8ao made upstream in 2.1.0.
      const mrt = this.ao.depthDownsampleTarget;
      if (mrt) { const proto = Object.getPrototypeOf(mrt); const d = Object.getOwnPropertyDescriptor(proto, 'texture'); if (d && d.get) delete proto.texture; }
      composer.addPass(this.ao);
    }
    const effects = [this.bloom, this.tone, this.grade, this.vignette];
    composer.addPass(new EffectPass(this.camera, ...effects));
    if (quality.smaa) composer.addPass(new EffectPass(this.camera, new SMAAEffect({ preset: SMAAPreset.MEDIUM })));

    this.listeners = new Set();
    this.fps = 60;
    this._frames = 0;
    this._acc = 0;
    this._slow = 0;
    this._fast = 0;
    this.adaptive = true;
    this.paused = false;
    this.time = 0;
    this.stats = { calls: 0, triangles: 0 };
    this.resize = this.resize.bind(this);
    window.addEventListener('resize', this.resize);
    this.resize();
    this._last = performance.now();
    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
  }

  setScene(scene) {
    this.scene = scene;
    this.renderPass.mainScene = scene;
    this.renderPass.scene = scene;
    if (this.ao) this.ao.scene = scene;
    this.composer.passes.forEach((p) => { if (p.mainScene !== undefined) p.mainScene = scene; });
    this.renderer.shadowMap.needsUpdate = true;
  }

  onFrame(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setPixelRatio(this.dpr);
    this.composer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // portrait phones: widen the vertical field of view so the station still fits
    this.camera.fov = this.camera.aspect < 1 ? Math.min(72, 55 + (1 - this.camera.aspect) * 34) : 55;
    this.camera.updateProjectionMatrix();
  }

  setDpr(v) {
    v = Math.max(this.quality.minDpr, Math.min(this.quality.maxDpr, v));
    if (Math.abs(v - this.dpr) < 0.01) return;
    this.dpr = v;
    this.resize();
  }

  _adapt(dt) {
    this._frames++;
    this._acc += dt;
    if (this._acc < 1) return;
    this.fps = this._frames / this._acc;
    this._frames = 0;
    this._acc = 0;
    if (!this.adaptive || document.hidden) return;
    if (this.fps < 50) { this._slow++; this._fast = 0; } else if (this.fps > 58) { this._fast++; this._slow = 0; } else { this._slow = this._fast = 0; }
    if (this._slow >= 2) { this.setDpr(this.dpr - 0.15); this._slow = 0; }
    if (this._fast >= 5 && this.dpr < this.quality.maxDpr) { this.setDpr(this.dpr + 0.1); this._fast = 0; }
  }

  _loop(now) {
    requestAnimationFrame(this._loop);
    const dt = Math.min(0.1, (now - this._last) / 1000);
    this._last = now;
    if (this.paused || !this.scene) return;
    this.time += dt;
    for (const fn of this.listeners) fn(dt, this.time);
    this.renderer.info.reset();
    this.renderer.info.autoReset = false;
    // static shadows: when an update is requested, refresh for two frames in a row
    const sm = this.renderer.shadowMap;
    if (sm.needsUpdate && !this._shadowFrames) this._shadowFrames = 2;
    this.composer.render(dt);
    if (this._shadowFrames > 0) { this._shadowFrames--; sm.needsUpdate = this._shadowFrames > 0; }
    this.stats.calls = this.renderer.info.render.calls;
    this.stats.triangles = this.renderer.info.render.triangles;
    this._adapt(dt);
  }

  // Render one frame at an arbitrary size (for 4K screenshots) and return a PNG blob
  async capture(width, height) {
    const r = this.renderer;
    const maxSize = Math.min(r.capabilities.maxTextureSize, r.capabilities.maxRenderbufferSize || 16384);
    const k = Math.min(1, maxSize / Math.max(width, height));
    width = Math.floor(width * k); height = Math.floor(height * k);
    const prevDpr = this.dpr;
    const prevAspect = this.camera.aspect;
    this.paused = true;
    r.setPixelRatio(1);
    this.composer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    for (const fn of this.listeners) fn(0, this.time);
    this.composer.render(0);
    const blob = await new Promise((res) => this.canvas.toBlob(res, 'image/png'));
    this.dpr = prevDpr;
    this.camera.aspect = prevAspect;
    this.resize();
    this.paused = false;
    return { blob, width, height };
  }
}
