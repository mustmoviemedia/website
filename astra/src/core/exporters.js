// 4K screenshot and GLB export
import * as THREE from 'three';

function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
}

export async function screenshot4K(engine, name) {
  const { blob, width, height } = await engine.capture(3840, 2160);
  if (!blob) throw new Error('canvas capture failed');
  download(blob, `${name}-${width}x${height}.png`);
  return { width, height, size: blob.size };
}

export async function exportGLB(root, name) {
  const { GLTFExporter } = await import('three/addons/exporters/GLTFExporter.js');
  // shader materials (Earth screens, sky) are not part of glTF: swap to a simple emissive material
  const swapped = [];
  const fallback = new THREE.MeshStandardMaterial({ name: 'earth-screen', color: '#0B2346', emissive: '#1E5AA8', emissiveIntensity: 1 });
  root.traverse((o) => {
    if (o.isMesh && o.material && o.material.isShaderMaterial) { swapped.push([o, o.material]); o.material = fallback; }
  });
  try {
    const exporter = new GLTFExporter();
    const result = await exporter.parseAsync(root, { binary: true, onlyVisible: true, maxTextureSize: 2048 });
    const blob = new Blob([result], { type: 'model/gltf-binary' });
    download(blob, `${name}.glb`);
    return { size: blob.size };
  } finally {
    for (const [o, m] of swapped) o.material = m;
    fallback.dispose();
  }
}
