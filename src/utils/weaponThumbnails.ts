import * as THREE from 'three';
import { Weapon } from '../types';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createDisplayWeapon } from './weaponModel';

/**
 * Renders small still images of each weapon using the same battle model as the
 * big 3D viewer. A single offscreen WebGL renderer is shared and results are
 * cached, so the list / slot strip can show many thumbnails cheaply.
 *
 * Robustness notes:
 *  - If the shared WebGL context is lost (browsers cap the number of live contexts,
 *    and the 3D viewer creates its own), the renderer is rebuilt on the next request.
 *  - A render that comes out fully transparent is never cached and is retried later.
 */

const SIZE = 192; // rendered at 192px, displayed small (crisp on HiDPI)

let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene | null = null;
let camera: THREE.PerspectiveCamera | null = null;
let probe: CanvasRenderingContext2D | null = null;
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
    // Image-based lighting so metal surfaces read correctly (same as the 3D viewer)
    const pmrem = new THREE.PMREMGenerator(r);
    s.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    const c = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    c.position.set(0, 0, 5.2);
    c.lookAt(0, 0, 0);

    s.add(new THREE.HemisphereLight(0xffffff, 0x8fb4d6, 2.2));
    const key = new THREE.DirectionalLight(0xffffff, 2.4);
    key.position.set(2.5, 3, 4);
    s.add(key);
    const rim = new THREE.DirectionalLight(0x9fd4ff, 1.4);
    rim.position.set(-3, -1, -2);
    s.add(rim);

    renderer = r;
    scene = s;
    camera = c;
    return true;
  } catch {
    resetRenderer();
    return false;
  }
}

/** True if the rendered canvas contains at least some visible pixels. */
function hasVisiblePixels(source: HTMLCanvasElement): boolean {
  try {
    if (!probe) {
      const c = document.createElement('canvas');
      c.width = SIZE;
      c.height = SIZE;
      probe = c.getContext('2d', { willReadFrequently: true });
    }
    if (!probe) return true;
    probe.clearRect(0, 0, SIZE, SIZE);
    probe.drawImage(source, 0, 0, SIZE, SIZE);
    const data = probe.getImageData(0, 0, SIZE, SIZE).data;
    for (let i = 3; i < data.length; i += 16) {
      if (data[i] > 8) return true;
    }
    return false;
  } catch {
    return true;
  }
}

function renderOnce(weapon: Weapon): string | null {
  if (!ensureRenderer() || !renderer || !scene || !camera) return null;

  // Same model as in battle, posed for display
  const wrapper = createDisplayWeapon(weapon, 2.3);
  scene.add(wrapper);
  try {
    renderer.render(scene, camera);
    if (renderer.getContext().isContextLost()) return null;
    if (!hasVisiblePixels(renderer.domElement)) return null;
    return renderer.domElement.toDataURL('image/png');
  } catch {
    return null;
  } finally {
    scene.remove(wrapper);
    wrapper.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
    });
  }
}

/** Returns a PNG data URL for the weapon, or null if it could not be rendered (caller shows a fallback). */
export function getWeaponThumbnail(weapon: Weapon): string | null {
  const key = `${weapon.id}|${weapon.color}`;
  const hit = cache.get(key);
  if (hit) return hit;

  // One retry with a fresh renderer if the first attempt failed (e.g. lost context)
  let url = renderOnce(weapon);
  if (!url) {
    resetRenderer();
    url = renderOnce(weapon);
  }
  if (url) cache.set(key, url);
  return url;
}
