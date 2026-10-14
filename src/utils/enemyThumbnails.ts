import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { buildEnemyModel } from '../components/BattleScene3D';

/**
 * Small still images of each enemy archetype (same model as in battle) for the
 * mission briefing's HOSTILE UNITS list. One shared offscreen renderer, cached per type.
 */

const SIZE = 160;

let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene | null = null;
let camera: THREE.PerspectiveCamera | null = null;
const cache = new Map<string, string>();

function resetRenderer() {
  try {
    renderer?.dispose();
  } catch {
    /* ignore */
  }
  renderer = null;
  scene = null;
  camera = null;
}

function ensureRenderer(): boolean {
  if (renderer && scene && camera && !renderer.getContext().isContextLost()) return true;
  resetRenderer();
  try {
    const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    r.setSize(SIZE, SIZE, false);
    r.setPixelRatio(1);
    r.setClearColor(0x000000, 0);
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.domElement.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      if (renderer === r) resetRenderer();
    });
    const s = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(r);
    s.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    s.add(new THREE.HemisphereLight(0xffffff, 0x8fb4d6, 2.0));
    const key = new THREE.DirectionalLight(0xffffff, 2.6);
    key.position.set(3, 4, 5);
    s.add(key);
    const rim = new THREE.DirectionalLight(0x7dd3fc, 1.6);
    rim.position.set(-4, 2, -3);
    s.add(rim);
    renderer = r;
    scene = s;
    camera = new THREE.PerspectiveCamera(28, 1, 0.1, 200);
    return true;
  } catch {
    resetRenderer();
    return false;
  }
}

function renderOnce(type: string): string | null {
  if (!ensureRenderer() || !renderer || !scene || !camera) return null;
  const group = new THREE.Group();
  try {
    buildEnemyModel(type, group);
  } catch {
    return null;
  }
  // Models face -Z; turn them toward the camera at a 3/4 angle
  group.rotation.y = Math.PI + 0.6;
  scene.add(group);
  try {
    group.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(group);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const radius = Math.max(size.x, size.y, size.z) * 0.62;
    const dist = radius / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    camera.position.set(center.x, center.y + radius * 0.25, center.z + dist);
    camera.lookAt(center);
    camera.near = dist * 0.05;
    camera.far = dist * 4;
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
    if (renderer.getContext().isContextLost()) return null;
    return renderer.domElement.toDataURL('image/png');
  } catch {
    return null;
  } finally {
    scene.remove(group);
    group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
    });
  }
}

/** PNG data URL of the enemy archetype, or null (caller shows an icon fallback). */
export function getEnemyThumbnail(type: string): string | null {
  const hit = cache.get(type);
  if (hit) return hit;
  let url = renderOnce(type);
  if (!url) {
    resetRenderer();
    url = renderOnce(type);
  }
  if (url) cache.set(type, url);
  return url;
}
