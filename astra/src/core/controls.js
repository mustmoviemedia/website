// Camera rig: orbit (outside), first-person walk (WASD + mouse, touch joystick), tour mode.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const EYE = 1.65;
const RADIUS = 0.28;

// 2D collision world in XZ: boxes {x0,x1,z0,z1}, circles {x,z,r}, segments {ax,az,bx,bz}
export class Colliders {
  constructor() { this.boxes = []; this.circles = []; this.segments = []; this.rings = []; }
  box(x0, x1, z0, z1) { this.boxes.push({ x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1) }); return this; }
  boxC(cx, cz, w, d) { return this.box(cx - w / 2, cx + w / 2, cz - d / 2, cz + d / 2); }
  circle(x, z, r) { this.circles.push({ x, z, r }); return this; }
  seg(ax, az, bx, bz) { this.segments.push({ ax, az, bx, bz }); return this; }
  polyline(pts, closed = false) {
    for (let i = 0; i < pts.length - 1; i++) this.seg(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
    if (closed) this.seg(pts[pts.length - 1][0], pts[pts.length - 1][1], pts[0][0], pts[0][1]);
    return this;
  }
  // circular wall with gaps: gaps = [[angleCenter, halfWidthAngle]] (angle from +Z towards +X)
  arcWall(cx, cz, R, gaps = [], steps = 64) {
    const inGap = (a) => gaps.some(([c, hw]) => Math.abs(Math.atan2(Math.sin(a - c), Math.cos(a - c))) < hw);
    for (let i = 0; i < steps; i++) {
      const a0 = (i / steps) * Math.PI * 2, a1 = ((i + 1) / steps) * Math.PI * 2;
      if (inGap((a0 + a1) / 2)) continue;
      this.seg(cx + Math.sin(a0) * R, cz + Math.cos(a0) * R, cx + Math.sin(a1) * R, cz + Math.cos(a1) * R);
    }
    return this;
  }

  resolve(p, r = RADIUS) {
    for (let iter = 0; iter < 3; iter++) {
      for (const b of this.boxes) {
        const qx = Math.max(b.x0, Math.min(p.x, b.x1));
        const qz = Math.max(b.z0, Math.min(p.z, b.z1));
        let dx = p.x - qx, dz = p.z - qz;
        const d2 = dx * dx + dz * dz;
        if (d2 < r * r) {
          if (d2 > 1e-8) { const d = Math.sqrt(d2); p.x = qx + (dx / d) * r; p.z = qz + (dz / d) * r; }
          else {
            // inside the box: push out along the shortest axis
            const opts = [[p.x - b.x0, -1, 0], [b.x1 - p.x, 1, 0], [p.z - b.z0, 0, -1], [b.z1 - p.z, 0, 1]].sort((a, c) => a[0] - c[0]);
            const [, sx, sz] = opts[0];
            if (sx) p.x = sx < 0 ? b.x0 - r : b.x1 + r; else p.z = sz < 0 ? b.z0 - r : b.z1 + r;
          }
        }
      }
      for (const c of this.circles) {
        const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz), m = c.r + r;
        if (d < m && d > 1e-6) { p.x = c.x + (dx / d) * m; p.z = c.z + (dz / d) * m; }
      }
      for (const s of this.segments) {
        const vx = s.bx - s.ax, vz = s.bz - s.az;
        const l2 = vx * vx + vz * vz || 1;
        let t = ((p.x - s.ax) * vx + (p.z - s.az) * vz) / l2;
        t = Math.max(0, Math.min(1, t));
        const qx = s.ax + vx * t, qz = s.az + vz * t;
        const dx = p.x - qx, dz = p.z - qz, d = Math.hypot(dx, dz);
        if (d < r && d > 1e-6) { p.x = qx + (dx / d) * r; p.z = qz + (dz / d) * r; }
      }
    }
    return p;
  }
}

class Joystick {
  constructor(el) {
    this.el = el;
    this.knob = el.querySelector('.joy-knob');
    this.v = { x: 0, y: 0 };
    this.id = null;
    const R = 46;
    const start = (e) => {
      const t = e.changedTouches ? e.changedTouches[0] : e;
      this.id = t.identifier ?? 'm';
      const rect = el.getBoundingClientRect();
      this.cx = rect.left + rect.width / 2; this.cy = rect.top + rect.height / 2;
      move(e);
      e.preventDefault();
    };
    const move = (e) => {
      if (this.id === null) return;
      const list = e.changedTouches ? [...e.changedTouches] : [e];
      const t = list.find((q) => (q.identifier ?? 'm') === this.id);
      if (!t) return;
      let dx = t.clientX - this.cx, dy = t.clientY - this.cy;
      const d = Math.hypot(dx, dy);
      if (d > R) { dx = (dx / d) * R; dy = (dy / d) * R; }
      this.v.x = dx / R; this.v.y = dy / R;
      this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
      e.preventDefault();
    };
    const end = (e) => {
      const list = e.changedTouches ? [...e.changedTouches] : [e];
      if (!list.some((q) => (q.identifier ?? 'm') === this.id)) return;
      this.id = null; this.v.x = this.v.y = 0;
      this.knob.style.transform = '';
    };
    el.addEventListener('touchstart', start, { passive: false });
    el.addEventListener('touchmove', move, { passive: false });
    el.addEventListener('touchend', end);
    el.addEventListener('touchcancel', end);
    el.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse') { start(e); const up = (ev) => { end(ev); removeEventListener('pointermove', move); removeEventListener('pointerup', up); }; addEventListener('pointermove', move); addEventListener('pointerup', up); } });
  }
}

export class CameraRig {
  constructor(engine, dom) {
    this.engine = engine;
    this.camera = engine.camera;
    this.dom = dom;
    this.mode = 'orbit';
    this.station = null;
    this.orbit = new OrbitControls(this.camera, dom);
    this.orbit.enableDamping = true;
    this.orbit.dampingFactor = 0.08;
    this.orbit.rotateSpeed = 0.55;
    this.orbit.zoomSpeed = 0.8;
    this.orbit.panSpeed = 0.6;
    this.orbit.screenSpacePanning = false;
    this.orbit.maxPolarAngle = Math.PI * 0.495;
    this.orbit.minDistance = 3;
    this.orbit.maxDistance = 140;
    this.orbit.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
    this.walk = { pos: new THREE.Vector3(), yaw: 0, pitch: 0, vel: new THREE.Vector3(), y: EYE, bob: 0 };
    this.keys = new Set();
    this.look = { active: false, id: null, x: 0, y: 0 };
    this.pointerLocked = false;
    this.listeners = new Set();
    this.joystick = null;
    const joyEl = document.getElementById('joystick');
    if (joyEl) this.joystick = new Joystick(joyEl);
    this._bind();
  }

  on(fn) { this.listeners.add(fn); }
  emit(type, data) { for (const f of this.listeners) f(type, data); }

  setStation(station) {
    this.station = station;
    const o = station.orbit;
    this.orbit.minDistance = o.minDistance ?? 3;
    this.orbit.maxDistance = o.maxDistance ?? 140;
    this.orbit.maxPolarAngle = o.maxPolar ?? Math.PI * 0.495;
  }

  setOrbitView(pos, target, instant = true) {
    if (instant) {
      this.camera.position.set(...pos);
      this.orbit.target.set(...target);
      this.orbit.update();
    }
  }

  setMode(mode, opts = {}) {
    const prev = this.mode;
    this.mode = mode;
    this.orbit.enabled = mode === 'orbit';
    document.body.dataset.mode = mode;
    if (mode === 'walk') {
      const sp = opts.spawn || this.station.walkSpawn;
      if (opts.fromCamera) {
        this.walk.pos.set(this.camera.position.x, 0, this.camera.position.z);
        const e = new THREE.Euler().setFromQuaternion(this.camera.quaternion, 'YXZ');
        this.walk.yaw = e.y; this.walk.pitch = THREE.MathUtils.clamp(e.x, -1.2, 1.2);
      } else {
        this.walk.pos.set(sp.pos[0], 0, sp.pos[2]);
        this.walk.yaw = sp.yaw; this.walk.pitch = sp.pitch || 0;
      }
      this.station.colliders.resolve(this.walk.pos);
      this.walk.y = this.groundAt(this.walk.pos.x, this.walk.pos.z) + EYE;
      this.walk.vel.set(0, 0, 0);
      this.camera.position.set(this.walk.pos.x, this.walk.y, this.walk.pos.z);
      this._applyLook();
    }
    if (mode === 'orbit' && prev !== 'orbit' && !opts.keepCamera) {
      const v = opts.view || this.station.orbitView;
      this.setOrbitView(v.pos, v.target);
    }
    if (mode === 'orbit' && opts.keepCamera) {
      // keep where the camera is, aim at the station
      const t = new THREE.Vector3(...this.station.orbitView.target);
      this.orbit.target.copy(t);
      if (this.camera.position.distanceTo(t) < this.orbit.minDistance) this.setOrbitView(this.station.orbitView.pos, this.station.orbitView.target);
      this.orbit.update();
    }
    if (mode !== 'walk' && document.pointerLockElement) document.exitPointerLock();
    this.emit('mode', mode);
  }

  groundAt(x, z) { return this.station?.groundAt ? this.station.groundAt(x, z) : 0; }

  _applyLook() {
    this.camera.rotation.set(this.walk.pitch, this.walk.yaw, 0, 'YXZ');
  }

  _bind() {
    const isUI = (e) => e.target !== this.dom;
    addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT') return;
      this.keys.add(e.code);
      if (this.mode === 'walk' && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === this.dom;
      this.emit('pointerlock', this.pointerLocked);
    });
    this.dom.addEventListener('click', () => {
      if (this.mode === 'walk' && !this.engine.quality.touch && !this.pointerLocked && this.dom.requestPointerLock) {
        try { const r = this.dom.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch { /* not allowed */ }
      }
    });
    addEventListener('mousemove', (e) => {
      if (this.mode !== 'walk') return;
      if (this.pointerLocked) { this._rotate(e.movementX, e.movementY, 0.0022); }
    });
    // drag-to-look (mouse without pointer lock, and touch on the right side)
    this.dom.addEventListener('pointerdown', (e) => {
      if (this.mode !== 'walk' || isUI(e)) return;
      if (e.pointerType === 'mouse' && this.pointerLocked) return;
      this.look = { active: true, id: e.pointerId, x: e.clientX, y: e.clientY };
    });
    addEventListener('pointermove', (e) => {
      if (!this.look.active || e.pointerId !== this.look.id) return;
      const dx = e.clientX - this.look.x, dy = e.clientY - this.look.y;
      this.look.x = e.clientX; this.look.y = e.clientY;
      this._rotate(dx, dy, e.pointerType === 'touch' ? 0.0055 : 0.0035);
    });
    const endLook = (e) => { if (e.pointerId === this.look.id) this.look.active = false; };
    addEventListener('pointerup', endLook);
    addEventListener('pointercancel', endLook);
    // any manual interaction during a tour stops it
    this.dom.addEventListener('pointerdown', () => { if (this.mode === 'tour') this.emit('interrupt'); });
    this.dom.addEventListener('wheel', () => { if (this.mode === 'tour') this.emit('interrupt'); }, { passive: true });
  }

  _rotate(dx, dy, k) {
    this.walk.yaw -= dx * k;
    this.walk.pitch = THREE.MathUtils.clamp(this.walk.pitch - dy * k, -1.25, 1.25);
    this._applyLook();
  }

  update(dt) {
    if (this.mode === 'orbit') {
      this.orbit.update();
      // keep the orbit camera above ground and inside bounds
      const g = this.groundAt(this.camera.position.x, this.camera.position.z) + 0.6;
      if (this.camera.position.y < g) this.camera.position.y = g;
      return;
    }
    if (this.mode !== 'walk') return;
    const k = this.keys;
    let f = 0, s = 0;
    if (k.has('KeyW') || k.has('ArrowUp')) f += 1;
    if (k.has('KeyS') || k.has('ArrowDown')) f -= 1;
    if (k.has('KeyA')) s -= 1;
    if (k.has('KeyD')) s += 1;
    if (k.has('ArrowLeft')) { this.walk.yaw += 1.8 * dt; this._applyLook(); }
    if (k.has('ArrowRight')) { this.walk.yaw -= 1.8 * dt; this._applyLook(); }
    if (this.joystick) { f -= this.joystick.v.y; s += this.joystick.v.x; }
    const len = Math.hypot(f, s);
    if (len > 1) { f /= len; s /= len; }
    const run = k.has('ShiftLeft') || k.has('ShiftRight');
    const speed = (run ? 3.6 : 1.9);
    const sin = Math.sin(this.walk.yaw), cos = Math.cos(this.walk.yaw);
    const tx = (-sin * f + cos * s) * speed, tz = (-cos * f - sin * s) * speed;
    const a = 1 - Math.exp(-dt * 10);
    this.walk.vel.x += (tx - this.walk.vel.x) * a;
    this.walk.vel.z += (tz - this.walk.vel.z) * a;
    const p = this.walk.pos;
    p.x += this.walk.vel.x * dt;
    p.z += this.walk.vel.z * dt;
    this.station.colliders.resolve(p);
    if (this.station.clampWalk) this.station.clampWalk(p);
    const moving = Math.hypot(this.walk.vel.x, this.walk.vel.z);
    this.walk.bob += moving * dt * 3.2;
    const gy = this.groundAt(p.x, p.z) + EYE + Math.sin(this.walk.bob * 2) * 0.018 * Math.min(1, moving);
    this.walk.y += (gy - this.walk.y) * (1 - Math.exp(-dt * 12));
    this.camera.position.set(p.x, this.walk.y, p.z);
  }
}
