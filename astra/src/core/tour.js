// Camera flights: the guided tour and "go to zone" moves share one keyframe player.
// Keyframe: { pos:[x,y,z], look:[x,y,z], move: seconds to reach it, hold: seconds to stay, hotspot?, title?, text? }
import * as THREE from 'three';

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const tmpM = new THREE.Matrix4();

function lookQuat(pos, look) {
  tmpM.lookAt(pos, look, new THREE.Vector3(0, 1, 0));
  return new THREE.Quaternion().setFromRotationMatrix(tmpM);
}

export class Flight {
  constructor(camera, keys, { onStop = () => {}, onKey = () => {}, onEnd = () => {} } = {}) {
    this.camera = camera;
    this.keys = keys.map((k) => ({ ...k, p: new THREE.Vector3(...k.pos), q: lookQuat(new THREE.Vector3(...k.pos), new THREE.Vector3(...k.look)) }));
    // first key = current camera pose
    this.keys.unshift({ p: camera.position.clone(), q: camera.quaternion.clone(), move: 0, hold: 0 });
    this.curve = new THREE.CatmullRomCurve3(this.keys.map((k) => k.p), false, 'centripetal', 0.5);
    this.seg = 0; // moving from keys[seg] to keys[seg + 1]
    this.t = 0;
    this.phase = 'move';
    this.done = false;
    this.onStop = onStop; this.onKey = onKey; this.onEnd = onEnd;
    this.n = this.keys.length;
  }

  update(dt) {
    if (this.done) return;
    const a = this.keys[this.seg], b = this.keys[this.seg + 1];
    if (!b) { this.finish(); return; }
    this.t += dt;
    if (this.phase === 'move') {
      const dur = Math.max(0.001, b.move ?? 2.5);
      const f = Math.min(1, this.t / dur);
      const e = ease(f);
      this.curve.getPoint((this.seg + e) / (this.n - 1), this.camera.position);
      this.camera.quaternion.slerpQuaternions(a.q, b.q, e);
      if (f >= 1) { this.phase = 'hold'; this.t = 0; this.onKey(b, this.seg + 1); }
    } else {
      const hold = b.hold ?? 0;
      if (this.t >= hold) {
        this.seg++; this.t = 0; this.phase = 'move';
        if (this.seg >= this.n - 1) this.finish();
      }
    }
  }

  finish() { if (this.done) return; this.done = true; this.onEnd(); }
  stop() { if (this.done) return; this.done = true; this.onStop(); }
}
