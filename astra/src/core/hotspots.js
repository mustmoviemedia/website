// Zone hotspots: HTML markers projected from 3D. Title in English, explanation in Russian.
import * as THREE from 'three';

const v = new THREE.Vector3();
const ray = new THREE.Ray();
const hit = new THREE.Vector3();

// coarse occluders (spheres / boxes) declared by each station: labels behind them are hidden
function occluded(cam, target, dist, occ) {
  if (!occ) return false;
  ray.origin.copy(cam);
  ray.direction.copy(target).sub(cam).normalize();
  for (const o of occ) {
    const r = o.sphere ? ray.intersectSphere(o.sphere, hit) : ray.intersectBox(o.box, hit);
    if (r && cam.distanceTo(hit) < dist - 0.6) return true;
  }
  return false;
}

export class Hotspots {
  constructor(layer, { onSelect = () => {} } = {}) {
    this.layer = layer;
    this.items = [];
    this.onSelect = onSelect;
    this.active = null;
    this.highlightId = null;
    this.cutaway = false;
  }

  setStation(station) {
    this.layer.innerHTML = '';
    this.items = station.hotspots.map((h) => {
      const el = document.createElement('button');
      el.className = 'hs';
      el.type = 'button';
      el.dataset.zone = h.zone;
      el.setAttribute('aria-label', `${h.title}: ${h.text}`);
      el.innerHTML = `<span class="hs-dot"></span><span class="hs-label">${h.title}</span>`;
      el.addEventListener('click', (e) => { e.stopPropagation(); this.onSelect(h); });
      this.layer.appendChild(el);
      return { h, el, pos: new THREE.Vector3(...h.pos), shown: false };
    });
  }

  highlight(id) {
    this.highlightId = id;
    for (const it of this.items) it.el.classList.toggle('is-hot', it.h.id === id);
  }

  update(camera, station, mode, width, height) {
    if (!station) return;
    const inside = station.isInside(camera.position);
    for (const it of this.items) {
      const d = camera.position.distanceTo(it.pos);
      let visible;
      if (it.h.zone === 'in') visible = inside ? d < 16 : (this.cutaway && d < 70);
      else visible = !inside && d < 140;
      if (mode === 'tour' && it.h.id !== this.highlightId) visible = false;
      if (visible && it.h.zone === 'out' && occluded(camera.position, it.pos, d, station.occluders)) visible = false;
      if (visible) {
        v.copy(it.pos).project(camera);
        if (v.z > 1 || v.z < -1 || Math.abs(v.x) > 1.15 || Math.abs(v.y) > 1.15) visible = false;
      }
      if (visible !== it.shown) { it.el.classList.toggle('is-on', visible); it.shown = visible; }
      if (!visible) continue;
      const x = (v.x * 0.5 + 0.5) * width, y = (-v.y * 0.5 + 0.5) * height;
      const s = THREE.MathUtils.clamp(1.25 - d / 60, 0.7, 1.1);
      it.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) scale(${s.toFixed(2)})`;
      it.el.style.zIndex = String(1000 - Math.round(d));
    }
  }
}
