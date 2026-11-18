// Mini floor plan in the corner: zones, furniture, camera position and view direction.
import * as THREE from 'three';

const e = new THREE.Euler();

export class Minimap {
  constructor(canvas, { onPick = () => {} } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.station = null;
    this.onPick = onPick;
    this.frame = 0;
    this.S = (x, z) => [this.ox + x * this.k, this.oz + z * this.k];
    canvas.addEventListener('click', (ev) => {
      if (!this.station) return;
      const r = canvas.getBoundingClientRect();
      const p = this.toWorld(ev.clientX - r.left, ev.clientY - r.top);
      this.onPick(p);
    });
  }

  setStation(st) { this.station = st; this.layout(); }

  layout() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = this.canvas.clientWidth || 170, h = this.canvas.clientHeight || 170;
    this.canvas.width = Math.round(w * dpr); this.canvas.height = Math.round(h * dpr);
    this.dpr = dpr; this.w = w; this.h = h;
    if (!this.station) return;
    const [x0, x1, z0, z1] = this.station.plan.bounds;
    const pad = 14;
    this.k = Math.min((w - pad * 2) / (x1 - x0), (h - pad * 2) / (z1 - z0));
    this.ox = w / 2 - ((x0 + x1) / 2) * this.k;
    this.oz = h / 2 - ((z0 + z1) / 2) * this.k;
  }

  toWorld(px, py) { return { x: (px - this.ox) / this.k, z: (py - this.oz) / this.k }; }

  draw(camera, mode) {
    if (!this.station || (this.frame++ % 2)) return;
    const { ctx, dpr } = this;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);
    // grid
    ctx.strokeStyle = 'rgba(221,227,234,0.06)'; ctx.lineWidth = 1;
    for (let gx = Math.ceil(this.toWorld(0, 0).x); gx < this.toWorld(this.w, 0).x; gx++) { const [x] = this.S(gx, 0); ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, this.h); ctx.stroke(); }
    for (let gz = Math.ceil(this.toWorld(0, 0).z); gz < this.toWorld(0, this.h).z; gz++) { const [, y] = this.S(0, gz); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(this.w, y); ctx.stroke(); }
    this.station.plan.draw(ctx, this.S);
    ctx.font = '500 8.5px "IBM Plex Mono", monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const [t, x, z] of this.station.plan.labels) {
      const [px, py] = this.S(x, z);
      ctx.fillStyle = 'rgba(5,8,15,0.75)';
      const w = ctx.measureText(t).width + 6;
      ctx.fillRect(px - w / 2, py - 6, w, 12);
      ctx.fillStyle = '#DDE3EA';
      ctx.fillText(t, px, py + 0.5);
    }
    // camera marker (clamped to the frame when outside the plan)
    let [px, py] = this.S(camera.position.x, camera.position.z);
    const out = px < 8 || py < 8 || px > this.w - 8 || py > this.h - 8;
    px = Math.max(8, Math.min(this.w - 8, px)); py = Math.max(8, Math.min(this.h - 8, py));
    e.setFromQuaternion(camera.quaternion, 'YXZ');
    const yaw = e.y;
    const dx = -Math.sin(yaw), dz = -Math.cos(yaw);
    const ang = Math.atan2(dz, dx);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(ang);
    const grd = ctx.createRadialGradient(0, 0, 0, 0, 0, 30);
    grd.addColorStop(0, 'rgba(255,106,26,0.55)'); grd.addColorStop(1, 'rgba(255,106,26,0)');
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 30, -0.55, 0.55); ctx.closePath(); ctx.fill();
    ctx.fillStyle = out ? '#F2C230' : '#FF6A1A';
    ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-5, 4.5); ctx.lineTo(-3, 0); ctx.lineTo(-5, -4.5); ctx.closePath(); ctx.fill();
    ctx.restore();
    if (mode === 'orbit' && out) {
      ctx.fillStyle = 'rgba(242,194,48,0.9)';
      ctx.font = '500 8px "IBM Plex Mono", monospace';
      ctx.fillText('CAM', px, py + (py > this.h / 2 ? -11 : 11));
    }
  }
}
