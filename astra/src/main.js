import '@fontsource/manrope/latin-400.css';
import '@fontsource/manrope/cyrillic-400.css';
import '@fontsource/manrope/latin-600.css';
import '@fontsource/manrope/cyrillic-600.css';
import '@fontsource/manrope/latin-800.css';
import '@fontsource/manrope/cyrillic-800.css';
import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/cyrillic-400.css';
import '@fontsource/ibm-plex-mono/latin-500.css';
import './styles.css';

import * as THREE from 'three';
import { Engine, detectQuality } from './core/engine.js';
import { CameraRig } from './core/controls.js';

const builders = {
  tashkent: () => import('./scenes/tashkent.js').then((m) => m.buildTashkent),
  astrocity: () => import('./scenes/astrocity.js').then((m) => m.buildAstroCity),
  konyukhov: () => import('./scenes/konyukhov.js').then((m) => m.buildKonyukhov),
};

const quality = detectQuality();
const canvas = document.getElementById('scene');
const engine = new Engine(canvas, quality);
const rig = new CameraRig(engine, canvas);

export const app = {
  engine, rig, quality,
  station: null,
  stationId: null,
  night: 0,
  nightTarget: 0,
  cutaway: false,
  listeners: new Set(),
  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); },
  emit(type, data) { for (const f of this.listeners) f(type, data); },

  async load(id, onProgress = () => {}) {
    if (this.loading) return this.loading;
    this.loading = (async () => {
      await document.fonts.ready;
      await Promise.all(['800 64px Manrope', '500 32px "IBM Plex Mono"', '400 32px "IBM Plex Mono"'].map((f) => document.fonts.load(f).catch(() => {})));
      const build = await builders[id]();
      onProgress(0.05);
      await new Promise((r) => setTimeout(r, 30));
      const station = await build({ renderer: engine.renderer, quality, progress: onProgress });
      const old = this.station;
      this.station = station;
      this.stationId = id;
      station.setNight(this.night);
      if (this.cutaway && station.setCutaway) station.setCutaway(true);
      rig.setStation(station);
      engine.setScene(station.scene);
      rig.setMode('orbit', { view: station.orbitView });
      rig.setOrbitView(station.orbitView.pos, station.orbitView.target);
      if (old) old.dispose();
      engine.renderer.compile(station.scene, engine.camera);
      engine.renderer.shadowMap.needsUpdate = true;
      this.emit('station', station);
    })();
    try { await this.loading; } finally { this.loading = null; }
  },

  setNight(on) {
    this.nightTarget = on ? 1 : 0;
    this.emit('night', on);
  },

  setCutaway(on) {
    this.cutaway = on;
    this.station?.setCutaway?.(on);
    this.emit('cutaway', on);
  },
};

engine.onFrame((dt, t) => {
  if (!app.station) return;
  if (app.night !== app.nightTarget) {
    const step = dt / 1.6;
    app.night = app.nightTarget > app.night ? Math.min(app.nightTarget, app.night + step) : Math.max(app.nightTarget, app.night - step);
    app.station.setNight(app.night);
  }
  rig.update(dt);
  app.station.update(dt, t, engine.camera, rig.mode);
  app.station.base.sky.update(engine.camera, t, engine.renderer.getPixelRatio());
  app.emit('frame', { dt, t });
});

window.astra = app;

// UI is attached in ui/ui.js
import('./ui/ui.js').then((m) => m.initUI(app)).catch((e) => {
  console.error(e);
  const params = new URLSearchParams(location.search);
  app.load(params.get('station') || 'tashkent');
});

export { THREE };
