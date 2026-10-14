import * as THREE from 'three';
import { ABYSS_CONFIG, ABYSS_BUILDERS } from './stageSceneryAbyss';
import { RELIC_CONFIG, RELIC_BUILDERS } from './stageSceneryRelic';
import { CRYO_CONFIG, CRYO_BUILDERS } from './stageSceneryCryo';
import { OVERGROW_CONFIG, OVERGROW_BUILDERS } from './stageSceneryOvergrow';

/**
 * Stage scenery: per-mission sky, atmosphere, lighting and set dressing.
 * Everything here is purely visual — set pieces sit outside the walls (|x|,|z| > 39)
 * or overhead, so the collision layout defined in BattleScene3D is untouched.
 */

export type SceneryId =
  | 'apartments' | 'sanctuary' | 'foundry' | 'cathedral'
  | 'spire' | 'mechdock' | 'monolith' | 'fusion'
  | 'corridor' | 'observatory' | 'powerroom' | 'hangar'
  | 'market' | 'aqueduct' | 'belfry' | 'skybridge' | 'relay' | 'arsenal'
  | 'biolab' | 'archive' | 'reactor'
  | 'harbor' | 'reef' | 'whalefall' | 'vents' | 'aquarium' | 'trench' | 'sanctum'
  | 'dunes' | 'graveyard' | 'clockwork' | 'crater' | 'chapel' | 'gate' | 'citadel'
  | 'outskirts' | 'cryobay' | 'stacks' | 'servers' | 'echohall' | 'conduit' | 'frostvault'
  | 'canopy' | 'greenhouse' | 'mycelium' | 'swamp' | 'rootworks' | 'bloomhill' | 'mycothrone';

interface SkyOptions {
  top: number; horizon: number; bottom: number;
  exponent?: number;
  stars?: number;
  sun?: { dir: [number, number, number]; color: number; size: number; glow: number };
  nebula?: { a: number; b: number; strength: number };
  clouds?: { color: number; coverage: number; speed: number; opacity: number };
  cloudSea?: { color: number; shadow: number };
  aurora?: { color: number; strength: number };
  horizonGlow?: { color: number; strength: number };
}

export interface SceneryConfig {
  sky: SkyOptions;
  fogColor: number;
  fogDensity: number;
  ambient: [number, number];
  hemi: [number, number, number];
  sun: { color: number; intensity: number; pos: [number, number, number] };
  wallHeight: number;
  gridOpacity: number;
  cornerLight: [number, number];
  /** Multiplies the floor texture so it sits in the stage's light mood. */
  floorTint: number;
  /** Texture tiling for the perimeter walls (defaults to 8 x height-proportional). */
  wallRepeat?: [number, number];
  /** Reflection environment: the real sky for open-air stages, a hemisphere light box indoors. */
  env: 'sky' | 'hemi';
  envIntensity: number;
}

export const SCENERY_CONFIG: Record<SceneryId, SceneryConfig> = {
  ...ABYSS_CONFIG,
  ...RELIC_CONFIG,
  ...CRYO_CONFIG,
  ...OVERGROW_CONFIG,
  apartments: {
    sky: { top: 0x04070f, horizon: 0x26364c, bottom: 0x0a0f18, exponent: 0.55, clouds: { color: 0x2a3446, coverage: 0.62, speed: 0.012, opacity: 0.9 }, horizonGlow: { color: 0xf59e0b, strength: 0.22 } },
    fogColor: 0x182231, fogDensity: 0.0125,
    ambient: [0x8aa0c0, 0.55], hemi: [0x6a8bbd, 0x1a1f28, 0.65],
    sun: { color: 0xa5c8ff, intensity: 0.95, pos: [-20, 30, -10] },
    wallHeight: 5, gridOpacity: 0.28, cornerLight: [0x38bdf8, 1.8],
    floorTint: 0x7d8aa0, env: 'sky', envIntensity: 0.9,
  },
  sanctuary: {
    sky: { top: 0x07020f, horizon: 0x3d0f52, bottom: 0x0d0614, exponent: 0.5, stars: 0.018, nebula: { a: 0x7c3aed, b: 0x0891b2, strength: 0.28 }, horizonGlow: { color: 0xd946ef, strength: 0.4 } },
    fogColor: 0x1d0b2a, fogDensity: 0.011,
    ambient: [0xc4b5fd, 0.55], hemi: [0xa78bfa, 0x150a22, 0.65],
    sun: { color: 0xe9d5ff, intensity: 0.9, pos: [15, 30, -25] },
    wallHeight: 3.2, gridOpacity: 0.35, cornerLight: [0xd946ef, 2.0],
    floorTint: 0x9d8fb8, env: 'sky', envIntensity: 0.9,
  },
  foundry: {
    sky: { top: 0x0a0503, horizon: 0x1a0a04, bottom: 0x0a0503 },
    fogColor: 0x221006, fogDensity: 0.016,
    ambient: [0xff9a5c, 0.45], hemi: [0x4a2a18, 0xff6a1a, 0.95],
    sun: { color: 0xffb070, intensity: 0.75, pos: [10, 30, 5] },
    wallHeight: 22, gridOpacity: 0.18, cornerLight: [0xf97316, 2.6],
    floorTint: 0xc8a890, env: 'hemi', envIntensity: 0.7,
  },
  cathedral: {
    sky: { top: 0x0a0806, horizon: 0x1a140a, bottom: 0x0a0806 },
    fogColor: 0x231a0e, fogDensity: 0.009,
    ambient: [0xffe2b0, 0.42], hemi: [0xffd99a, 0x3a2a18, 0.6],
    sun: { color: 0xffe0a8, intensity: 1.05, pos: [-30, 40, 10] },
    wallHeight: 36, gridOpacity: 0.12, cornerLight: [0xfacc15, 2.2],
    floorTint: 0xe8dcc4, wallRepeat: [4, 2], env: 'hemi', envIntensity: 0.6,
  },
  spire: {
    sky: {
      top: 0x081a45, horizon: 0xffb27a, bottom: 0x6a7fae, exponent: 0.42, stars: 0.012,
      sun: { dir: [0.55, 0.06, -0.83], color: 0xffd6a0, size: 0.0016, glow: 0.85 },
      cloudSea: { color: 0xfff1e6, shadow: 0x56689a },
    },
    fogColor: 0xc9b9c8, fogDensity: 0.0065,
    ambient: [0xc7d2fe, 0.7], hemi: [0x9ec5ff, 0xffc89a, 0.65],
    sun: { color: 0xffd2a0, intensity: 1.5, pos: [55, 6, -83] },
    wallHeight: 1.1, gridOpacity: 0.3, cornerLight: [0x8b5cf6, 1.6],
    floorTint: 0xd8deef, env: 'sky', envIntensity: 1.0,
  },
  mechdock: {
    sky: { top: 0x0a0d12, horizon: 0x141a22, bottom: 0x0a0d12 },
    fogColor: 0x121820, fogDensity: 0.011,
    ambient: [0xb0c4de, 0.75], hemi: [0xffd7a0, 0x2a2f38, 0.9],
    sun: { color: 0xffe2b8, intensity: 1.1, pos: [10, 40, 25] },
    wallHeight: 7, gridOpacity: 0.22, cornerLight: [0xf59e0b, 2.2],
    floorTint: 0xb8bcc4, env: 'hemi', envIntensity: 0.9,
  },
  monolith: {
    sky: { top: 0x020008, horizon: 0x2a0a3a, bottom: 0x12081c, exponent: 0.6, stars: 0.03, nebula: { a: 0xa21caf, b: 0x4c1d95, strength: 0.6 }, aurora: { color: 0xe879f9, strength: 0.55 }, horizonGlow: { color: 0x9333ea, strength: 0.25 } },
    fogColor: 0x12081c, fogDensity: 0.012,
    ambient: [0x9b7ab8, 0.55], hemi: [0x8b5cf6, 0x1a0b24, 0.65],
    sun: { color: 0xd8b4fe, intensity: 0.85, pos: [-15, 30, -30] },
    wallHeight: 2.2, gridOpacity: 0.3, cornerLight: [0xd946ef, 2.0],
    floorTint: 0x9a86b0, env: 'sky', envIntensity: 0.9,
  },
  fusion: {
    sky: { top: 0x000005, horizon: 0x0b1630, bottom: 0x02040a, exponent: 0.5, stars: 0.04, nebula: { a: 0x1e3a8a, b: 0x9a3412, strength: 0.25 } },
    fogColor: 0x140a04, fogDensity: 0.007,
    ambient: [0xffd8a8, 0.5], hemi: [0xffb347, 0x1a1208, 0.8],
    sun: { color: 0xffcf80, intensity: 1.0, pos: [0, 40, 0] },
    wallHeight: 14, gridOpacity: 0.22, cornerLight: [0xf59e0b, 2.4],
    floorTint: 0xc8bcb0, env: 'hemi', envIntensity: 0.85,
  },
  corridor: {
    sky: { top: 0x070b0d, horizon: 0x0c1418, bottom: 0x070b0d },
    fogColor: 0x0c1519, fogDensity: 0.014,
    ambient: [0xbfe9ff, 0.6], hemi: [0xd0f0ff, 0x1b2228, 0.6],
    sun: { color: 0xe0f2fe, intensity: 0.65, pos: [0, 40, 5] },
    wallHeight: 12, gridOpacity: 0.22, cornerLight: [0x22d3ee, 2.0],
    floorTint: 0xa8bcc4, env: 'hemi', envIntensity: 0.8,
  },
  observatory: {
    sky: { top: 0x01030a, horizon: 0x0a1430, bottom: 0x05091a, exponent: 0.6, stars: 0.05, nebula: { a: 0x1d4ed8, b: 0x7c3aed, strength: 0.6 }, horizonGlow: { color: 0x38bdf8, strength: 0.15 } },
    fogColor: 0x05091a, fogDensity: 0.006,
    ambient: [0x9fb8ff, 0.6], hemi: [0x6c8fd8, 0x0a0f1e, 0.6],
    sun: { color: 0xffe6c4, intensity: 1.0, pos: [-45, 55, -95] },
    wallHeight: 2.6, gridOpacity: 0.3, cornerLight: [0x06b6d4, 1.8],
    floorTint: 0xb0bcd8, env: 'sky', envIntensity: 1.0,
  },
  powerroom: {
    sky: { top: 0x0a040d, horizon: 0x14061a, bottom: 0x0a040d },
    fogColor: 0x14061a, fogDensity: 0.013,
    ambient: [0xf0b8ff, 0.5], hemi: [0xd946ef, 0x12081a, 0.6],
    sun: { color: 0xffd6f5, intensity: 0.8, pos: [0, 40, 10] },
    wallHeight: 20, gridOpacity: 0.22, cornerLight: [0xec4899, 2.4],
    floorTint: 0xb8a8c8, env: 'hemi', envIntensity: 0.8,
  },
  hangar: {
    sky: { top: 0x0a0306, horizon: 0x16060a, bottom: 0x0a0306 },
    fogColor: 0x17060a, fogDensity: 0.012,
    ambient: [0xffb0b8, 0.45], hemi: [0xff4060, 0x0a0406, 0.6],
    sun: { color: 0xffd0d0, intensity: 0.75, pos: [0, 40, 10] },
    wallHeight: 30, gridOpacity: 0.2, cornerLight: [0xff0044, 2.4],
    floorTint: 0xa89898, wallRepeat: [8, 4], env: 'hemi', envIntensity: 0.8,
  },
  market: {
    sky: { top: 0x07030c, horizon: 0x3a1035, bottom: 0x0c0610, exponent: 0.55, clouds: { color: 0x3a1c3a, coverage: 0.55, speed: 0.01, opacity: 0.85 }, horizonGlow: { color: 0xec4899, strength: 0.35 } },
    fogColor: 0x1e0e22, fogDensity: 0.012,
    ambient: [0xf0b8e0, 0.55], hemi: [0xd27ad0, 0x1a0e1e, 0.65],
    sun: { color: 0xffb8f0, intensity: 0.85, pos: [20, 30, -10] },
    wallHeight: 4, gridOpacity: 0.28, cornerLight: [0xec4899, 2.0],
    floorTint: 0x9a8ca8, env: 'sky', envIntensity: 0.9,
  },
  aqueduct: {
    sky: { top: 0x040a0a, horizon: 0x0a1414, bottom: 0x040a0a },
    fogColor: 0x0b1816, fogDensity: 0.014,
    ambient: [0x9ff5e4, 0.5], hemi: [0x5eead4, 0x0a1210, 0.6],
    sun: { color: 0xcffaf0, intensity: 0.6, pos: [0, 40, 5] },
    wallHeight: 14, gridOpacity: 0.18, cornerLight: [0x14b8a6, 2.2],
    floorTint: 0x8ea8a4, env: 'hemi', envIntensity: 0.75,
  },
  belfry: {
    sky: {
      top: 0x0f0a2e, horizon: 0xd9773a, bottom: 0x2a1a30, exponent: 0.5, stars: 0.01,
      sun: { dir: [-0.6, 0.04, -0.8], color: 0xffb366, size: 0.003, glow: 0.9 },
      clouds: { color: 0x5b3a6b, coverage: 0.5, speed: 0.008, opacity: 0.8 }, horizonGlow: { color: 0xf59e0b, strength: 0.3 },
    },
    fogColor: 0x2a1a30, fogDensity: 0.008,
    ambient: [0xe9d5ff, 0.55], hemi: [0xc4b5fd, 0x3a2418, 0.7],
    sun: { color: 0xffc68a, intensity: 1.3, pos: [-50, 8, -70] },
    wallHeight: 3, gridOpacity: 0.26, cornerLight: [0xa855f7, 1.8],
    floorTint: 0xc8b8a8, env: 'sky', envIntensity: 1.0,
  },
  skybridge: {
    sky: {
      top: 0x0b3d91, horizon: 0xbfe3ff, bottom: 0x8fb6e0, exponent: 0.45,
      sun: { dir: [0.3, 0.5, -0.8], color: 0xffffff, size: 0.0012, glow: 0.6 },
      cloudSea: { color: 0xffffff, shadow: 0x7d93b8 }, clouds: { color: 0xffffff, coverage: 0.35, speed: 0.02, opacity: 0.6 },
    },
    fogColor: 0xc4dcf0, fogDensity: 0.0038,
    ambient: [0xdbeafe, 0.8], hemi: [0xbfdbfe, 0xe0e7ff, 0.7],
    sun: { color: 0xffffff, intensity: 1.6, pos: [30, 50, -80] },
    wallHeight: 1.1, gridOpacity: 0.3, cornerLight: [0x38bdf8, 1.4],
    floorTint: 0xdfe6f0, env: 'sky', envIntensity: 1.0,
  },
  relay: {
    sky: {
      top: 0x000004, horizon: 0x0a1a3a, bottom: 0x1e4f8f, exponent: 0.5, stars: 0.04,
      sun: { dir: [-0.5, 0.3, -0.8], color: 0xfff7e0, size: 0.0006, glow: 0.5 },
      nebula: { a: 0x166534, b: 0x1e3a8a, strength: 0.2 }, horizonGlow: { color: 0x38bdf8, strength: 0.6 },
    },
    fogColor: 0x050a14, fogDensity: 0.005,
    ambient: [0xd9f99d, 0.5], hemi: [0xbef264, 0x0a1428, 0.6],
    sun: { color: 0xffffff, intensity: 1.3, pos: [-50, 30, -80] },
    wallHeight: 2, gridOpacity: 0.3, cornerLight: [0x84cc16, 1.8],
    floorTint: 0xb8c4b0, env: 'sky', envIntensity: 0.9,
  },
  arsenal: {
    sky: { top: 0x0d0a08, horizon: 0x16100a, bottom: 0x0d0a08 },
    fogColor: 0x16110c, fogDensity: 0.011,
    ambient: [0xffd2a0, 0.65], hemi: [0xffc080, 0x2a221a, 0.85],
    sun: { color: 0xffe0b8, intensity: 1.0, pos: [10, 40, 20] },
    wallHeight: 10, gridOpacity: 0.22, cornerLight: [0xf97316, 2.2],
    floorTint: 0xb8b0a4, env: 'hemi', envIntensity: 0.85,
  },
  biolab: {
    sky: { top: 0x030a06, horizon: 0x07140c, bottom: 0x030a06 },
    fogColor: 0x08160d, fogDensity: 0.012,
    ambient: [0xbbf7d0, 0.55], hemi: [0x86efac, 0x0a140c, 0.6],
    sun: { color: 0xdcfce7, intensity: 0.7, pos: [0, 40, 5] },
    wallHeight: 3, gridOpacity: 0.24, cornerLight: [0x22c55e, 2.0],
    floorTint: 0xa8bcb0, env: 'hemi', envIntensity: 0.8,
  },
  archive: {
    sky: { top: 0x02010a, horizon: 0x0c0a24, bottom: 0x02010a, exponent: 0.6, stars: 0.012, nebula: { a: 0x4338ca, b: 0x7e22ce, strength: 0.3 } },
    fogColor: 0x0a0820, fogDensity: 0.011,
    ambient: [0xc7d2fe, 0.5], hemi: [0x818cf8, 0x0a0a1a, 0.6],
    sun: { color: 0xe0e7ff, intensity: 0.8, pos: [-20, 40, -20] },
    wallHeight: 3, gridOpacity: 0.3, cornerLight: [0x818cf8, 2.0],
    floorTint: 0x9ea0c0, env: 'sky', envIntensity: 0.8,
  },
  reactor: {
    sky: { top: 0x0a0408, horizon: 0x14080e, bottom: 0x0a0408 },
    fogColor: 0x120a10, fogDensity: 0.009,
    ambient: [0xffc0d0, 0.5], hemi: [0xf43f5e, 0x0a1420, 0.65],
    sun: { color: 0xffe4ec, intensity: 0.9, pos: [0, 40, 0] },
    wallHeight: 16, gridOpacity: 0.22, cornerLight: [0xf43f5e, 2.4],
    floorTint: 0xb0b8c4, env: 'hemi', envIntensity: 0.85,
  },
};

// ───────────────────────────── shared helpers ─────────────────────────────

export type Updater = (dt: number, t: number, cam: THREE.Camera) => void;

export interface Ctx {
  root: THREE.Group;
  accent: number;
  hemi: THREE.HemisphereLight;
  sky: THREE.ShaderMaterial;
  rnd: () => number;
  on: (fn: Updater) => void;
}

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const std = (color: number, metalness = 0.5, roughness = 0.6, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, metalness, roughness, ...extra });
export const basic = (color: number, extra: THREE.MeshBasicMaterialParameters = {}) => new THREE.MeshBasicMaterial({ color, ...extra });
export const additive = (color: number, opacity: number, extra: THREE.MeshBasicMaterialParameters = {}) =>
  new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, ...extra });

export function mesh(parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  parent.add(m);
  return m;
}

export function box(parent: THREE.Object3D, w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  return mesh(parent, new THREE.BoxGeometry(w, h, d), mat, x, y, z, rx, ry, rz);
}

export function canvasTex(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void, srgb = true) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  draw(cv.getContext('2d')!);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 4;
  return t;
}

let softDotTex: THREE.Texture | null = null;
export function softDot() {
  if (!softDotTex) {
    softDotTex = canvasTex(64, 64, (c) => {
      const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.25, 'rgba(255,255,255,0.65)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g; c.fillRect(0, 0, 64, 64);
    });
  }
  return softDotTex;
}

export function glowSprite(parent: THREE.Object3D, color: number, size: number, opacity: number, x = 0, y = 0, z = 0) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot(), color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  s.scale.set(size, size, 1);
  s.position.set(x, y, z);
  parent.add(s);
  return s;
}

/** Remap a ShapeGeometry's planar UVs into 0..1. */
export function normalizeUV(geo: THREE.BufferGeometry) {
  geo.computeBoundingBox();
  const bb = geo.boundingBox!;
  const pos = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, (pos.getX(i) - bb.min.x) / (bb.max.x - bb.min.x), (pos.getY(i) - bb.min.y) / (bb.max.y - bb.min.y));
  }
  uv.needsUpdate = true;
  return geo;
}

export function lancetShape(w: number, h: number) {
  const s = new THREE.Shape();
  const spring = h - w * 0.95;
  s.moveTo(-w / 2, 0);
  s.lineTo(-w / 2, spring);
  s.quadraticCurveTo(-w / 2, spring + w * 0.7, 0, h);
  s.quadraticCurveTo(w / 2, spring + w * 0.7, w / 2, spring);
  s.lineTo(w / 2, 0);
  s.closePath();
  return s;
}

// ── Volumetric light shaft (fresnel-faded open cone, brightest at its source end). ──
export function beamMaterial(color: number, opacity: number) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uOpacity: { value: opacity } },
    vertexShader: `
      varying float vH; varying float vEdge;
      void main() {
        vH = uv.y;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vec3 n = normalize(normalMatrix * normal);
        vEdge = abs(dot(n, normalize(-mv.xyz)));
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 uColor; uniform float uOpacity;
      varying float vH; varying float vEdge;
      void main() {
        float a = uOpacity * pow(vEdge, 1.4) * smoothstep(0.0, 1.0, vH) * smoothstep(1.0, 0.94, vH);
        gl_FragColor = vec4(uColor, a);
        #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
}

export const _up = new THREE.Vector3(0, 1, 0);
export function beam(parent: THREE.Object3D, from: THREE.Vector3, to: THREE.Vector3, rFrom: number, rTo: number, color: number, opacity: number) {
  const dir = from.clone().sub(to);
  const len = dir.length();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rFrom, rTo, len, 24, 1, true), beamMaterial(color, opacity));
  m.position.copy(from).add(to).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(_up, dir.normalize());
  m.renderOrder = 5;
  parent.add(m);
  return m;
}

/** A beam whose source sits at the pivot (group origin) and points along local -Y. */
export function pivotBeam(parent: THREE.Object3D, len: number, rFrom: number, rTo: number, color: number, opacity: number) {
  const pivot = new THREE.Group();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rFrom, rTo, len, 24, 1, true), beamMaterial(color, opacity));
  m.position.y = -len / 2;
  m.renderOrder = 5;
  pivot.add(m);
  parent.add(pivot);
  return pivot;
}

// ── Electric arc: jagged tube regenerated a few times per second. ──
export function makeArc(parent: THREE.Object3D, color: number, radius = 0.08) {
  const core = basic(0xffffff, { transparent: true, opacity: 0.95, toneMapped: false });
  core.color.set(color).lerp(new THREE.Color(0xffffff), 0.65);
  const halo = additive(color, 0.4, { fog: false });
  const coreMesh = new THREE.Mesh(new THREE.BufferGeometry(), core);
  const haloMesh = new THREE.Mesh(new THREE.BufferGeometry(), halo);
  parent.add(coreMesh, haloMesh);
  const rnd = Math.random;
  return {
    set(a: THREE.Vector3, b: THREE.Vector3, jag: number) {
      const n = 18;
      const d = b.clone().sub(a);
      const side = new THREE.Vector3(1, 0, 0).cross(d).normalize();
      if (side.lengthSq() < 0.01) side.set(0, 0, 1);
      const side2 = d.clone().cross(side).normalize();
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= n; i++) {
        const f = i / n;
        const env = Math.sin(Math.PI * f) * jag;
        pts.push(a.clone().addScaledVector(d, f).addScaledVector(side, (rnd() - 0.5) * env).addScaledVector(side2, (rnd() - 0.5) * env));
      }
      const curve = new THREE.CatmullRomCurve3(pts);
      coreMesh.geometry.dispose(); haloMesh.geometry.dispose();
      coreMesh.geometry = new THREE.TubeGeometry(curve, n * 2, radius, 4);
      haloMesh.geometry = new THREE.TubeGeometry(curve, n * 2, radius * 4, 5);
    },
    visible(v: boolean) { coreMesh.visible = v; haloMesh.visible = v; },
  };
}

// ── Particle fields ──
export type ParticleMode = 'rise' | 'fall' | 'drift' | 'orbit';
export function particles(ctx: Ctx, o: { count: number; size: number; color: number; opacity: number; half: [number, number]; y: [number, number]; mode: ParticleMode; speed: number; sway?: number; follow?: boolean }) {
  const { count } = o;
  const pos = new Float32Array(count * 3);
  const seed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (ctx.rnd() * 2 - 1) * o.half[0];
    pos[i * 3 + 1] = o.y[0] + ctx.rnd() * (o.y[1] - o.y[0]);
    pos[i * 3 + 2] = (ctx.rnd() * 2 - 1) * o.half[1];
    seed[i] = ctx.rnd();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ size: o.size, map: softDot(), color: o.color, transparent: true, opacity: o.opacity, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  ctx.root.add(pts);
  const sway = o.sway ?? 0.4;
  const yr = o.y[1] - o.y[0];
  ctx.on((dt, t, cam) => {
    if (o.follow) pts.position.set(cam.position.x, 0, cam.position.z);
    for (let i = 0; i < count; i++) {
      const k = i * 3, s = seed[i];
      const sp = o.speed * (0.5 + s);
      if (o.mode === 'rise') pos[k + 1] += sp * dt;
      else if (o.mode === 'fall') pos[k + 1] -= sp * dt;
      else pos[k + 1] += Math.sin(t * 0.6 + s * 40) * sp * 0.3 * dt;
      pos[k] += Math.sin(t * (0.4 + s) + s * 17) * sway * dt;
      pos[k + 2] += Math.cos(t * (0.3 + s) + s * 23) * sway * dt;
      if (pos[k + 1] > o.y[1]) pos[k + 1] -= yr;
      else if (pos[k + 1] < o.y[0]) pos[k + 1] += yr;
    }
    geo.attributes.position.needsUpdate = true;
  });
  return pts;
}

// ───────────────────────────── sky dome ─────────────────────────────

function makeSky(o: SkyOptions, radius = 150) {
  const c = (n: number) => new THREE.Color(n);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTop: { value: c(o.top) }, uHorizon: { value: c(o.horizon) }, uBottom: { value: c(o.bottom) }, uExp: { value: o.exponent ?? 0.5 },
      uStars: { value: o.stars ?? 0 }, uTime: { value: 0 }, uFlash: { value: 0 },
      uSunDir: { value: new THREE.Vector3(...(o.sun?.dir ?? [0, 1, 0])).normalize() }, uSunColor: { value: c(o.sun?.color ?? 0) }, uSunSize: { value: o.sun?.size ?? 0.001 }, uSunGlow: { value: o.sun?.glow ?? 0 },
      uNebA: { value: c(o.nebula?.a ?? 0) }, uNebB: { value: c(o.nebula?.b ?? 0) }, uNeb: { value: o.nebula?.strength ?? 0 },
      uCloudColor: { value: c(o.clouds?.color ?? 0) }, uCloudCov: { value: o.clouds?.coverage ?? 0 }, uCloudSpeed: { value: o.clouds?.speed ?? 0 }, uCloudOpacity: { value: o.clouds?.opacity ?? 0 },
      uSeaColor: { value: c(o.cloudSea?.color ?? 0) }, uSeaShadow: { value: c(o.cloudSea?.shadow ?? 0) }, uSea: { value: o.cloudSea ? 1 : 0 },
      uAurora: { value: c(o.aurora?.color ?? 0) }, uAuroraStr: { value: o.aurora?.strength ?? 0 },
      uGlowColor: { value: c(o.horizonGlow?.color ?? 0) }, uGlow: { value: o.horizonGlow?.strength ?? 0 },
    },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 uTop, uHorizon, uBottom; uniform float uExp;
      uniform float uStars, uTime, uFlash;
      uniform vec3 uSunDir, uSunColor; uniform float uSunSize, uSunGlow;
      uniform vec3 uNebA, uNebB; uniform float uNeb;
      uniform vec3 uCloudColor; uniform float uCloudCov, uCloudSpeed, uCloudOpacity;
      uniform vec3 uSeaColor, uSeaShadow; uniform float uSea;
      uniform vec3 uAurora; uniform float uAuroraStr;
      uniform vec3 uGlowColor; uniform float uGlow;
      varying vec3 vDir;

      float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
      float noise(vec3 x) {
        vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
                   mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
      }
      float fbm(vec3 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }

      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 col = h >= 0.0 ? mix(uHorizon, uTop, pow(clamp(h, 0.0, 1.0), uExp))
                            : mix(uHorizon, uBottom, pow(clamp(-h * 2.5, 0.0, 1.0), 0.6));
        col += uGlowColor * uGlow * exp(-abs(h) * 12.0);

        if (uNeb > 0.0) {
          float n = fbm(d * 2.4 + vec3(0.0, uTime * 0.004, 0.0));
          float m = fbm(d * 6.0 + 7.0);
          col += mix(uNebA, uNebB, m) * smoothstep(0.42, 0.9, n) * uNeb * smoothstep(-0.05, 0.25, h);
        }
        if (uAuroraStr > 0.0) {
          float band = sin(d.x * 4.0 + d.z * 2.0 + fbm(d * 3.0 + uTime * 0.05) * 6.0 + uTime * 0.15);
          float a = smoothstep(0.55, 1.0, band) * smoothstep(0.05, 0.35, h) * smoothstep(0.9, 0.4, h);
          col += uAurora * a * uAuroraStr * (0.5 + 0.6 * fbm(vec3(d.x * 18.0, h * 3.0, uTime * 0.2)));
        }
        if (uStars > 0.0) {
          vec3 p = d * 140.0;
          float r = hash(floor(p));
          if (r > 1.0 - uStars) {
            vec3 f = fract(p) - 0.5;
            float tw = 0.6 + 0.4 * sin(uTime * (1.5 + r * 3.0) + r * 60.0);
            float bright = 0.6 + (r - (1.0 - uStars)) / uStars * 1.6;
            col += vec3(0.82 + 0.18 * r, 0.9, 1.0) * smoothstep(0.34, 0.0, length(f)) * tw * bright * smoothstep(-0.02, 0.2, h);
          }
        }
        float sd = max(dot(d, uSunDir), 0.0);
        col += uSunColor * (smoothstep(1.0 - uSunSize, 1.0 - uSunSize * 0.5, sd) * 2.5 + pow(sd, 14.0) * uSunGlow + pow(sd, 3.0) * uSunGlow * 0.22);

        if (uCloudOpacity > 0.0 && h > 0.0) {
          vec2 uv = d.xz / (h + 0.08) * 1.6 + vec2(uTime * uCloudSpeed, 0.0);
          float c = fbm(vec3(uv, 1.3));
          c = smoothstep(1.0 - uCloudCov, 1.0 - uCloudCov + 0.35, c);
          vec3 cc = uCloudColor * (0.6 + 0.6 * fbm(vec3(uv * 2.0, 4.0))) + uGlowColor * uGlow * 0.35;
          col = mix(col, cc + uFlash * 0.6, c * uCloudOpacity * smoothstep(0.0, 0.15, h));
        }
        if (uSea > 0.0 && h < 0.0) {
          vec2 uv = d.xz / (-h + 0.02) * 0.9 + vec2(uTime * 0.01, 0.0);
          float c = fbm(vec3(uv, 2.0));
          float c2 = fbm(vec3(uv * 3.0 + 5.0, 1.0));
          vec3 sea = mix(uSeaShadow, uSeaColor, smoothstep(0.3, 0.8, c * 0.7 + c2 * 0.4));
          sea += uSunColor * pow(sd, 6.0) * 0.5;
          col = mix(sea, uHorizon, exp(h * 7.0) * 0.85);
        }
        col += vec3(0.55, 0.65, 0.85) * uFlash * 0.25;
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
    side: THREE.BackSide, depthWrite: false, fog: false,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 24), mat);
  m.renderOrder = -1000;
  m.frustumCulled = false;
  return m;
}

// ───────────────────────────── canvas textures ─────────────────────────────

function windowsTexture(rnd: () => number, facade: string, lit: [string, number][], cols = 8, rows = 16) {
  return canvasTex(cols * 16, rows * 16, (c) => {
    c.fillStyle = facade; c.fillRect(0, 0, cols * 16, rows * 16);
    for (let y = 0; y < rows; y++) {
      c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(0, y * 16 + 14, cols * 16, 2);
      for (let x = 0; x < cols; x++) {
        let col = '#0b1220';
        const r = rnd();
        let acc = 0;
        for (const [lc, p] of lit) { acc += p; if (r < acc) { col = lc; break; } }
        c.fillStyle = col; c.fillRect(x * 16 + 4, y * 16 + 3, 8, 10);
        if (col !== '#0b1220') { c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(x * 16 + 4, y * 16 + 3 + rnd() * 6, 8, 2); }
      }
    }
  });
}

function stainedGlassTexture(rnd: () => number, palette: string[], rose = false) {
  const W = rose ? 512 : 256, H = 512;
  return canvasTex(W, H, (c) => {
    c.fillStyle = '#0a0806'; c.fillRect(0, 0, W, H);
    if (rose) {
      const cx = W / 2, cy = H / 2;
      for (let ring = 0; ring < 6; ring++) {
        const r0 = ring * 42, r1 = r0 + 42, seg = 6 + ring * 4;
        for (let s = 0; s < seg; s++) {
          const a0 = (s / seg) * Math.PI * 2, a1 = ((s + 1) / seg) * Math.PI * 2;
          c.beginPath(); c.arc(cx, cy, r1, a0, a1); c.arc(cx, cy, r0, a1, a0, true); c.closePath();
          c.fillStyle = palette[Math.floor(rnd() * palette.length)]; c.fill();
          c.strokeStyle = '#0a0806'; c.lineWidth = 5; c.stroke();
        }
      }
      c.beginPath(); c.arc(cx, cy, 30, 0, Math.PI * 2); c.fillStyle = '#fde68a'; c.fill();
    } else {
      for (let y = 0; y < H; y += 32) for (let x = 0; x < W; x += 32) {
        const jx = (rnd() - 0.5) * 10, jy = (rnd() - 0.5) * 10;
        c.fillStyle = palette[Math.floor(rnd() * palette.length)];
        c.beginPath(); c.moveTo(x + jx, y); c.lineTo(x + 32, y + jy); c.lineTo(x + 32 - jx, y + 32); c.lineTo(x, y + 32 - jy); c.closePath(); c.fill();
      }
      c.fillStyle = 'rgba(253,230,138,0.9)'; c.beginPath(); c.arc(W / 2, 150, 46, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#7f1d1d'; c.fillRect(W / 2 - 34, 210, 68, 190);
      c.strokeStyle = '#0a0806'; c.lineWidth = 4;
      for (let y = 0; y < H; y += 32) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y + (rnd() - 0.5) * 8); c.stroke(); }
      for (let x = 0; x < W; x += 32) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x + (rnd() - 0.5) * 8, H); c.stroke(); }
      c.lineWidth = 10; c.strokeRect(0, 0, W, H);
      c.beginPath(); c.moveTo(W / 2, 0); c.lineTo(W / 2, H); c.moveTo(0, 270); c.lineTo(W, 270); c.stroke();
    }
    const g = c.createRadialGradient(W / 2, H * 0.4, 0, W / 2, H * 0.4, H * 0.7);
    g.addColorStop(0, 'rgba(255,240,200,0.25)'); g.addColorStop(1, 'rgba(0,0,0,0.25)');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
  });
}

function neonSignTexture(text: string, color: string, vertical: boolean, font = 'bold 96px "Noto Sans JP", sans-serif') {
  const chars = [...text];
  const W = vertical ? 160 : 140 + chars.length * 82, H = vertical ? 60 + chars.length * 110 : 180;
  return canvasTex(W, H, (c) => {
    c.fillStyle = 'rgba(5,3,10,0.92)'; c.fillRect(0, 0, W, H);
    c.strokeStyle = color; c.lineWidth = 6; c.shadowColor = color; c.shadowBlur = 24;
    c.strokeRect(12, 12, W - 24, H - 24);
    c.font = font; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = '#ffffff';
    const draw = () => {
      if (vertical) chars.forEach((ch, i) => c.fillText(ch, W / 2, 80 + i * 110));
      else c.fillText(text, W / 2, H / 2 + 4);
    };
    c.shadowBlur = 30; draw();
    c.fillStyle = color; c.globalAlpha = 0.55; draw(); c.globalAlpha = 1;
  });
}

function lavaTexture(rnd: () => number) {
  const t = canvasTex(128, 512, (c) => {
    const g = c.createLinearGradient(0, 0, 128, 0);
    g.addColorStop(0, '#7c1d06'); g.addColorStop(0.5, '#f97316'); g.addColorStop(1, '#7c1d06');
    c.fillStyle = g; c.fillRect(0, 0, 128, 512);
    for (let i = 0; i < 90; i++) {
      const x = rnd() * 128, y = rnd() * 512, l = 30 + rnd() * 90;
      c.strokeStyle = rnd() > 0.5 ? 'rgba(254,240,138,0.85)' : 'rgba(69,10,10,0.6)';
      c.lineWidth = 2 + rnd() * 6;
      for (const oy of [-512, 0, 512]) { c.beginPath(); c.moveTo(x, y + oy); c.lineTo(x + (rnd() - 0.5) * 12, y + l + oy); c.stroke(); }
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function runeTexture(rnd: () => number, color: string) {
  return canvasTex(128, 512, (c) => {
    c.fillStyle = '#000'; c.fillRect(0, 0, 128, 512);
    c.strokeStyle = color; c.shadowColor = color; c.shadowBlur = 12; c.lineWidth = 4; c.lineCap = 'round';
    for (let y = 40; y < 480; y += 46) {
      const x = 64;
      c.beginPath();
      const n = 2 + Math.floor(rnd() * 3);
      for (let k = 0; k < n; k++) {
        const ax = x + (rnd() - 0.5) * 50, ay = y + (rnd() - 0.5) * 30;
        const bx = x + (rnd() - 0.5) * 50, by = y + (rnd() - 0.5) * 30;
        c.moveTo(ax, ay); c.lineTo(bx, by);
      }
      if (rnd() > 0.5) c.arc(x, y, 10 + rnd() * 8, 0, Math.PI * 2);
      c.stroke();
    }
    c.lineWidth = 2; c.strokeRect(14, 14, 100, 484);
  });
}

function screenTexture(rnd: () => number, color: string) {
  const t = canvasTex(512, 256, (c) => {
    c.fillStyle = '#05010a'; c.fillRect(0, 0, 512, 256);
    c.strokeStyle = 'rgba(255,255,255,0.08)'; c.lineWidth = 1;
    for (let x = 0; x < 512; x += 32) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, 256); c.stroke(); }
    for (let y = 0; y < 256; y += 32) { c.beginPath(); c.moveTo(0, y); c.lineTo(512, y); c.stroke(); }
    c.strokeStyle = color; c.lineWidth = 3; c.shadowColor = color; c.shadowBlur = 8;
    c.beginPath();
    for (let x = 0; x <= 512; x += 4) { const y = 80 + Math.sin(x * 0.05) * 30 + Math.sin(x * 0.17) * 10; x ? c.lineTo(x, y) : c.moveTo(x, y); }
    c.stroke();
    c.beginPath();
    for (let x = 0; x <= 512; x += 8) { const y = 190 - rnd() * 50; x ? c.lineTo(x, y) : c.moveTo(x, y); }
    c.stroke();
    c.fillStyle = color;
    for (let i = 0; i < 12; i++) c.fillRect(20 + i * 40, 240 - rnd() * 30, 24, 4);
  });
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

// ───────────────────────────── recurring set pieces ─────────────────────────────

export function gothicTower(parent: THREE.Object3D, mat: THREE.Material, w: number, h: number, spire: number, x: number, z: number, trim?: THREE.Material) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  box(g, w, h, w, mat, 0, h / 2, 0);
  box(g, w * 1.1, 1.2, w * 1.1, mat, 0, h, 0);
  mesh(g, new THREE.ConeGeometry(w * 0.62, spire, 4), mat, 0, h + spire / 2, 0, 0, Math.PI / 4, 0);
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => mesh(g, new THREE.ConeGeometry(w * 0.12, spire * 0.28, 4), mat, sx * w * 0.5, h + spire * 0.14, sz * w * 0.5, 0, Math.PI / 4, 0));
  if (trim) box(g, 0.25, spire * 0.6, 0.25, trim, 0, h + spire * 0.35, w * 0.32);
  parent.add(g);
  return g;
}

export function buildMech(armor: THREE.Material, trim: THREE.Material, dark: THREE.Material, eye: THREE.Material) {
  const g = new THREE.Group();
  for (const s of [-1, 1]) {
    box(g, 3.2, 1.3, 5.2, dark, s * 2.7, 0.65, -0.4);
    box(g, 2.3, 6.2, 2.5, armor, s * 2.7, 4.4, 0);
    box(g, 2.8, 2.2, 1.3, trim, s * 2.7, 7.4, -1.3);
    box(g, 2.5, 5.6, 2.9, armor, s * 2.7, 10.2, 0.2);
    box(g, 4.4, 3.6, 5.2, trim, s * 6.8, 20.8, 0, 0, 0, s * -0.12);
    box(g, 2.1, 6.2, 2.3, armor, s * 7.0, 16.0, 0);
    box(g, 2.7, 5.6, 2.9, armor, s * 7.1, 10.8, -0.5);
    box(g, 2.0, 2.0, 2.0, dark, s * 7.1, 7.3, -0.5);
    box(g, 0.5, 3, 0.5, dark, s * 1.8, 23.8, 2.2);
  }
  box(g, 7.6, 2.5, 4.2, dark, 0, 13.6, 0);
  box(g, 9.2, 6.6, 5.6, armor, 0, 18.2, 0);
  box(g, 6.2, 4, 1.1, trim, 0, 18.8, -3.0);
  box(g, 6.2, 6.2, 3.2, dark, 0, 18.4, 3.2);
  box(g, 3.1, 2.7, 3.3, armor, 0, 22.8, -0.3);
  box(g, 2.5, 0.45, 0.2, eye, 0, 23.0, -2.0);
  return g;
}

export function catenary(a: THREE.Vector3, b: THREE.Vector3, sag: number) {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 16; i++) {
    const f = i / 16;
    pts.push(a.clone().lerp(b, f).add(new THREE.Vector3(0, -Math.sin(Math.PI * f) * sag, 0)));
  }
  return new THREE.CatmullRomCurve3(pts);
}

// Positions along the four inner wall faces.
export const WALL = 39.35;

// ───────────────────────────── stage builders ─────────────────────────────

function buildApartments(ctx: Ctx) {
  const { root, rnd } = ctx;
  // Ruined gothic apartment blocks ringing the arena, mostly dark with a few lit windows.
  const roof = std(0x0d121b, 0.4, 0.8);
  const blinkers: THREE.Sprite[] = [];
  for (let i = 0; i < 34; i++) {
    const a = (i / 34) * Math.PI * 2 + rnd() * 0.12;
    const r = 56 + rnd() * 50;
    const w = 10 + rnd() * 12, d = 10 + rnd() * 10, h = 22 + rnd() * 48;
    const tex = windowsTexture(rnd, rnd() > 0.5 ? '#1a222e' : '#222a36', [['#ffcf8a', 0.06], ['#67e8f9', 0.025], ['#f472b6', 0.01]]);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(Math.max(1, Math.round(w / 2.2)) / 8, Math.max(1, Math.round(h / 3)) / 16);
    const mat = std(0x9aa3b0, 0.2, 0.85, { map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 1.1 });
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const b = box(root, w, h, d, mat, x, h / 2, z, 0, -a + Math.PI / 2, 0);
    if (rnd() > 0.45) {
      mesh(root, new THREE.ConeGeometry(Math.min(w, d) * 0.7, 6 + rnd() * 10, 4), roof, x, h + 4, z, 0, -a + Math.PI / 4, 0);
    } else {
      // broken top: jagged slabs
      for (let k = 0; k < 3; k++) box(root, w * (0.3 + rnd() * 0.3), 2 + rnd() * 4, d * 0.5, roof, x + (rnd() - 0.5) * w * 0.5, h + 1, z + (rnd() - 0.5) * d * 0.4, rnd() * 0.3, b.rotation.y, rnd() * 0.3);
    }
    if (rnd() > 0.7) {
      box(root, 0.3, 10, 0.3, roof, x, h + 5, z);
      blinkers.push(glowSprite(root, 0xff2a2a, 3, 0.9, x, h + 10.2, z));
    }
  }
  // Neon signage hung on facades facing the arena.
  const signs: THREE.MeshBasicMaterial[] = [];
  const addSign = (text: string, col: string, vertical: boolean, x: number, y: number, z: number, ry: number, scale: number) => {
    const tex = neonSignTexture(text, col, vertical);
    const img = tex.image as HTMLCanvasElement;
    const m = basic(0xffffff, { map: tex, transparent: true, toneMapped: false, side: THREE.DoubleSide });
    signs.push(m);
    mesh(root, new THREE.PlaneGeometry(img.width / 100 * scale, img.height / 100 * scale), m, x, y, z, 0, ry, 0);
    glowSprite(root, new THREE.Color(col).getHex(), img.height / 100 * scale * 1.4, 0.25, x, y, z + (ry === 0 ? 0.5 : 0));
  };
  addSign('廃棄区画', '#f472b6', true, -16, 20, -52, 0, 2.6);
  addSign('HOTEL', '#22d3ee', false, 22, 26, -58, 0, 2.6);
  addSign('立入禁止', '#fbbf24', false, -52, 14, 6, Math.PI / 2, 2.2);
  addSign('NEO-KOWLOON', '#a78bfa', false, 54, 22, -10, -Math.PI / 2, 2.0);

  // Broken parapet rubble along the wall tops.
  const rubble = std(0x3b4350, 0.1, 0.95);
  for (let i = 0; i < 46; i++) {
    const side = i % 4, f = (rnd() * 2 - 1) * 38;
    const s = 0.8 + rnd() * 2.2;
    const x = side === 0 ? f : side === 1 ? f : side === 2 ? 40 : -40;
    const z = side === 0 ? -40 : side === 1 ? 40 : f;
    box(root, s * 1.4, s, s, rubble, x, 5 + s * 0.35, z, rnd(), rnd() * 3, rnd());
  }
  // Street lamps inside the wall line with downward light cones.
  const lampMat = std(0x1f2937, 0.7, 0.4);
  const lamps: THREE.Object3D[] = [];
  [[-38.4, -20], [-38.4, 20], [38.4, -20], [38.4, 20], [-20, -38.4], [20, -38.4], [-20, 38.4], [20, 38.4]].forEach(([x, z], i) => {
    const toC = Math.atan2(-x, -z);
    box(root, 0.22, 7, 0.22, lampMat, x, 3.5, z);
    const arm = new THREE.Group(); arm.position.set(x, 7, z); arm.rotation.y = toC; root.add(arm);
    box(arm, 0.16, 0.16, 1.8, lampMat, 0, 0, -0.9);
    box(arm, 0.8, 0.25, 0.5, basic(0xe0f7ff, { toneMapped: false }), 0, -0.12, -1.8);
    const b = pivotBeam(arm, 7, 0.35, 2.6, 0xa5e4ff, 0.14); b.position.set(0, -0.2, -1.8);
    lamps[i] = b;
  });
  // Rain streaks following the camera.
  const N = 1400, pos = new Float32Array(N * 6);
  const reset = (i: number, y?: number) => {
    const x = (rnd() * 2 - 1) * 35, z = (rnd() * 2 - 1) * 35, yy = y ?? rnd() * 30;
    pos.set([x, yy, z, x + 0.05, yy + 0.9, z], i * 6);
  };
  for (let i = 0; i < N; i++) reset(i);
  const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const rain = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: 0x9fb7d0, transparent: true, opacity: 0.38, depthWrite: false }));
  rain.frustumCulled = false;
  root.add(rain);
  let flash = 0, nextFlash = 6;
  ctx.on((dt, t, cam) => {
    rain.position.set(cam.position.x, 0, cam.position.z);
    for (let i = 0; i < N; i++) {
      const k = i * 6;
      pos[k + 1] -= 34 * dt; pos[k + 4] -= 34 * dt; pos[k] -= 2 * dt; pos[k + 3] -= 2 * dt;
      if (pos[k + 1] < 0) reset(i, 28 + rnd() * 4);
    }
    rg.attributes.position.needsUpdate = true;
    // distant lightning
    nextFlash -= dt;
    if (nextFlash < 0) { flash = 1; nextFlash = 7 + rnd() * 10; }
    flash = Math.max(0, flash - dt * 2.8);
    const f = flash * (0.6 + 0.4 * Math.sin(t * 60));
    ctx.sky.uniforms.uFlash.value = f;
    ctx.hemi.intensity = 0.65 + f * 1.3;
    blinkers.forEach((b, i) => { (b.material as THREE.SpriteMaterial).opacity = Math.sin(t * 2 + i) > 0.6 ? 0.95 : 0.1; });
    signs.forEach((m, i) => { m.opacity = (Math.sin(t * 13 + i * 7) > -0.92 || i % 2) ? 1 : 0.25; });
    lamps[3].visible = Math.sin(t * 17) + Math.sin(t * 5.3) > -0.6;
  });
}

function buildSanctuary(ctx: Ctx) {
  const { root, rnd } = ctx;
  const stone = std(0x221a30, 0.25, 0.8);
  const cyan = basic(0x22d3ee, { toneMapped: false });
  const pink = basic(0xf0abfc, { toneMapped: false });
  // Balustrade posts along the low wall.
  const postGeo = new THREE.CylinderGeometry(0.16, 0.22, 1.2, 8);
  const posts = new THREE.InstancedMesh(postGeo, stone, 4 * 40);
  const m4 = new THREE.Matrix4();
  let n = 0;
  for (let i = 0; i < 40; i++) {
    const f = -39 + i * 2;
    [[f, -40], [f, 40], [-40, f], [40, f]].forEach(([x, z]) => posts.setMatrixAt(n++, m4.makeTranslation(x, 3.8, z)));
  }
  root.add(posts);
  for (const [w, d, x, z] of [[80, 1.4, 0, -40], [80, 1.4, 0, 40], [1.4, 80, -40, 0], [1.4, 80, 40, 0]] as const) box(root, w, 0.3, d, stone, x, 4.5, z);

  // Grand neon cathedral facade to the north.
  const F = new THREE.Group(); F.position.set(0, 0, -86); root.add(F);
  box(F, 52, 40, 12, stone, 0, 20, 0);
  const gable = new THREE.Shape(); gable.moveTo(-26, 0); gable.lineTo(0, 16); gable.lineTo(26, 0); gable.closePath();
  mesh(F, new THREE.ExtrudeGeometry(gable, { depth: 12, bevelEnabled: false }), stone, 0, 40, -6);
  const gableEdge = [new THREE.Vector3(-26, 40, 6.1), new THREE.Vector3(0, 56, 6.1), new THREE.Vector3(26, 40, 6.1)];
  mesh(F, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(gableEdge, false, 'chordal', 0), 40, 0.2, 6), pink);
  for (const ex of [-26, 26]) box(F, 0.35, 40, 0.35, cyan, ex, 20, 6.1);
  box(F, 52, 0.35, 0.35, cyan, 0, 40, 6.1);
  gothicTower(F, stone, 13, 62, 34, -26, 2, pink);
  gothicTower(F, stone, 13, 62, 34, 26, 2, pink);
  for (let i = -2; i <= 2; i++) gothicTower(F, stone, 2.4, 42, 8, i * 9, -5.5);
  // rose window
  const rose = basic(0xffffff, { map: stainedGlassTexture(rnd, ['#6d28d9', '#0891b2', '#db2777', '#1d4ed8', '#a21caf'], true), toneMapped: false });
  mesh(F, new THREE.CircleGeometry(9, 48), rose, 0, 27, 6.05);
  mesh(F, new THREE.TorusGeometry(9.3, 0.35, 8, 64), cyan, 0, 27, 6.1);
  glowSprite(F, 0xd946ef, 34, 0.35, 0, 27, 7);
  // portal + tower lancets outlined in neon
  const arch = (w: number, h: number, x: number, y: number, mat: THREE.Material, z = 6.1) => {
    const pts = lancetShape(w, h).getPoints(24).map((p) => new THREE.Vector3(p.x + x, p.y + y, z));
    mesh(F, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 80, 0.22, 6, true), mat);
  };
  arch(12, 16, 0, 0, cyan); arch(9, 13, 0, 0, pink);
  const doorGlow = basic(0x3b0764); mesh(F, new THREE.ShapeGeometry(lancetShape(8.6, 12.6)), doorGlow, 0, 0, 6.02);
  for (const tx of [-26, 26]) for (const ty of [12, 30, 46]) {
    arch(3.4, 9, tx, ty, ty === 30 ? pink : cyan, 8.6);
    mesh(F, new THREE.ShapeGeometry(lancetShape(3, 8.6)), additive(0x7c3aed, 0.55, { fog: false }), tx, ty, 8.55);
  }
  // Side chapels with vertical neon kanji.
  const signMats: THREE.MeshBasicMaterial[] = [];
  [[-72, -30, '聖域', '#22d3ee'], [72, -30, '祈祷所', '#f0abfc'], [-70, 25, '贖罪', '#c084fc'], [70, 25, '天啓', '#22d3ee']].forEach(([x, z, text, col]) => {
    const xx = x as number, zz = z as number;
    gothicTower(root, stone, 16, 28 + rnd() * 18, 16, xx, zz);
    const tex = neonSignTexture(text as string, col as string, true);
    const img = tex.image as HTMLCanvasElement;
    const sm = basic(0xffffff, { map: tex, transparent: true, toneMapped: false });
    signMats.push(sm);
    mesh(root, new THREE.PlaneGeometry(img.width / 40, img.height / 40), sm, xx - Math.sign(xx) * 8.1, 16, zz, 0, -Math.sign(xx) * Math.PI / 2, 0);
  });
  // Sweeping searchlights behind the facade.
  const lights = [-34, 0, 34].map((x, i) => {
    const p = pivotBeam(root, 110, 0.8, 7, i === 1 ? 0xe9d5ff : 0x67e8f9, 0.3);
    p.position.set(x, 44, -94);
    return p;
  });
  // Floating holo halos.
  const halos = [0, 1, 2].map((i) => {
    const h = mesh(root, new THREE.TorusGeometry(10 + i * 4, 0.12, 6, 96), additive(i === 1 ? 0xf0abfc : 0x22d3ee, 0.55, { fog: false }), 0, 24 + i * 3, -10);
    return h;
  });
  particles(ctx, { count: 260, size: 0.35, color: 0x67e8f9, opacity: 0.8, half: [38, 38], y: [0.5, 18], mode: 'drift', speed: 0.6, sway: 0.5 });
  particles(ctx, { count: 200, size: 0.3, color: 0xf0abfc, opacity: 0.8, half: [38, 38], y: [0.5, 18], mode: 'rise', speed: 0.4, sway: 0.4 });
  ctx.on((_dt, t) => {
    lights.forEach((l, i) => { l.rotation.set(Math.PI + 0.1 + Math.sin(t * 0.3 + i * 2) * 0.15, 0, Math.sin(t * 0.4 + i * 1.7) * 0.5); });
    halos.forEach((h, i) => { h.rotation.x = Math.PI / 2 + Math.sin(t * 0.3 + i) * 0.25; h.rotation.y = t * (0.15 + i * 0.05); });
    signMats.forEach((m, i) => { m.opacity = Math.sin(t * 11 + i * 5) > -0.95 ? 1 : 0.3; });
  });
}

function buildFoundry(ctx: Ctx) {
  const { root, rnd } = ctx;
  // Rock ceiling with stalactites.
  const rock = std(0x2a1a12, 0.05, 0.95, { flatShading: true });
  const cg = new THREE.PlaneGeometry(84, 84, 28, 28);
  const p = cg.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, (rnd() - 0.5) * 3 + Math.sin(p.getX(i) * 0.15) * Math.cos(p.getY(i) * 0.12) * 2.5);
  cg.computeVertexNormals();
  mesh(root, cg, rock, 0, 22, 0, Math.PI / 2, 0, 0);
  for (let i = 0; i < 46; i++) {
    const h = 2 + rnd() * 6;
    mesh(root, new THREE.ConeGeometry(0.5 + rnd() * 1.2, h, 6), rock, (rnd() * 2 - 1) * 38, 22 - h / 2, (rnd() * 2 - 1) * 38, Math.PI);
  }
  // Lava falls down the walls feeding a molten trench along the base.
  const lt = lavaTexture(rnd);
  const lavaMat = basic(0xffffff, { map: lt, toneMapped: false, fog: false });
  const lavaFalls: [number, number, number][] = [[-22, -1, 0], [18, -1, 0], [-15, 1, Math.PI], [24, 1, Math.PI]];
  lavaFalls.forEach(([x, s, ry]) => {
    const z = s * WALL;
    mesh(root, new THREE.PlaneGeometry(4, 22), lavaMat, x, 11, z - s * 0.05, 0, ry, 0);
    glowSprite(root, 0xf97316, 16, 0.5, x, 6, z - s * 1.5);
  });
  [[-1, 0], [1, Math.PI]].forEach(([s, ry]) => {
    const x = s * WALL;
    mesh(root, new THREE.PlaneGeometry(4, 22), lavaMat, x - s * 0.05, 11, s * 10, 0, ry + Math.PI / 2 * -s, 0);
  });
  const trenchTex = lt.clone(); trenchTex.repeat.set(1, 6);
  const trench = basic(0xffffff, { map: trenchTex, toneMapped: false, fog: false });
  for (const [w, d, x, z] of [[78, 1.1, 0, -38.8], [78, 1.1, 0, 38.8], [1.1, 78, -38.8, 0], [1.1, 78, 38.8, 0]] as const) {
    const m = mesh(root, new THREE.PlaneGeometry(w, d), trench, x, 0.04, z, -Math.PI / 2);
    void m;
  }
  // Giant gear on the north and south walls.
  const iron = std(0x2b2420, 0.85, 0.45);
  const gears = [[-1, 8, 13], [1, -10, 12]].map(([s, x, y]) => {
    const g = new THREE.Group(); g.position.set(x, y, s * 38.6); root.add(g);
    mesh(g, new THREE.TorusGeometry(6, 0.9, 8, 32), iron);
    mesh(g, new THREE.CylinderGeometry(1.4, 1.4, 1.2, 16), iron, 0, 0, 0, Math.PI / 2);
    for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2; box(g, 1.6, 1.4, 1, iron, Math.cos(a) * 7.1, Math.sin(a) * 7.1, 0, 0, 0, a); }
    for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; box(g, 0.6, 5, 0.6, iron, Math.cos(a) * 3, Math.sin(a) * 3, 0, 0, 0, a + Math.PI / 2); }
    return g;
  });
  // Hanging crucibles of molten metal.
  const chain = std(0x1c1917, 0.8, 0.5);
  const molten = basic(0xfbbf24, { toneMapped: false });
  const crucibles = [[0, -14], [-22, 12], [22, 4]].map(([x, z]) => {
    const pivot = new THREE.Group(); pivot.position.set(x, 21.5, z); root.add(pivot);
    box(pivot, 0.25, 6, 0.25, chain, 0, -3, 0);
    mesh(pivot, new THREE.CylinderGeometry(2.2, 1.5, 2.8, 16, 1, true), iron, 0, -7.4, 0).material = std(0x2b2420, 0.85, 0.45, { side: THREE.DoubleSide });
    mesh(pivot, new THREE.CircleGeometry(2.1, 24), molten, 0, -6.2, 0, -Math.PI / 2);
    glowSprite(pivot, 0xf97316, 9, 0.55, 0, -5.8, 0);
    return pivot;
  });
  // Catacomb niches with candle glow on the side walls.
  const niche = basic(0x050302);
  for (const s of [-1, 1]) for (let i = 0; i < 7; i++) for (let j = 0; j < 2; j++) {
    const z = -30 + i * 10, y = 5 + j * 4.5;
    box(root, 0.3, 2.6, 2.2, niche, s * 39.25, y, z);
    if (rnd() > 0.4) glowSprite(root, 0xffa94d, 1.4, 0.8, s * 39.0, y - 0.9, z);
  }
  particles(ctx, { count: 650, size: 0.22, color: 0xff8a3d, opacity: 0.95, half: [39, 39], y: [0, 20], mode: 'rise', speed: 1.6, sway: 0.8 });
  particles(ctx, { count: 120, size: 0.5, color: 0xffd27a, opacity: 0.6, half: [39, 39], y: [0, 6], mode: 'rise', speed: 0.6, sway: 0.3 });
  ctx.on((dt, t) => {
    lt.offset.y -= dt * 0.35;
    trenchTex.offset.y -= dt * 0.08;
    gears[0].rotation.z += dt * 0.12; gears[1].rotation.z -= dt * 0.16;
    crucibles.forEach((c, i) => { c.rotation.z = Math.sin(t * 0.5 + i * 2) * 0.05; c.rotation.x = Math.cos(t * 0.4 + i) * 0.04; });
    ctx.hemi.intensity = 0.95 + Math.sin(t * 2.3) * 0.06 + Math.sin(t * 7.1) * 0.04;
  });
}

function buildCathedral(ctx: Ctx) {
  const { root, rnd } = ctx;
  const stoneLight = std(0xb4a689, 0.05, 0.75);
  const stone = std(0x8a7d64, 0.05, 0.8);
  const gold = std(0xd4a017, 0.9, 0.3, { emissive: 0x4a3200, emissiveIntensity: 0.4 });
  // Vaulted ceiling.
  mesh(root, new THREE.PlaneGeometry(82, 82), std(0x5a4c38, 0, 0.9), 0, 36, 0, Math.PI / 2);
  const zs = [-30, -15, 0, 15, 30];
  // Clustered gothic piers.
  for (const s of [-1, 1]) for (const z of zs) {
    const g = new THREE.Group(); g.position.set(s * 37.6, 0, z); root.add(g);
    mesh(g, new THREE.CylinderGeometry(1.4, 1.4, 30, 12), stoneLight, 0, 15, 0);
    for (let k = 0; k < 4; k++) { const a = (k / 4) * Math.PI * 2 + Math.PI / 4; mesh(g, new THREE.CylinderGeometry(0.45, 0.45, 30, 8), stone, Math.cos(a) * 1.4, 15, Math.sin(a) * 1.4); }
    box(g, 4, 1.4, 4, stone, 0, 0.7, 0);
    box(g, 3.8, 1, 3.8, stone, 0, 30.4, 0);
    box(g, 4.6, 0.5, 4.6, gold, 0, 29.6, 0);
    // banner
    const ban = basic(0xffffff, { map: canvasTex(128, 384, (c) => {
      c.fillStyle = '#6b0f1a'; c.fillRect(0, 0, 128, 384);
      c.fillStyle = '#d4a017'; c.fillRect(0, 0, 128, 14); c.fillRect(8, 0, 6, 384); c.fillRect(114, 0, 6, 384);
      c.beginPath(); c.moveTo(0, 384); c.lineTo(64, 330); c.lineTo(128, 384); c.fillStyle = '#000'; c.fill();
      c.strokeStyle = '#facc15'; c.lineWidth = 8; c.beginPath(); c.arc(64, 130, 34, 0, Math.PI * 2); c.moveTo(64, 70); c.lineTo(64, 260); c.moveTo(24, 150); c.lineTo(104, 150); c.stroke();
    }), side: THREE.DoubleSide, transparent: true, alphaTest: 0.5 });
    mesh(g, new THREE.PlaneGeometry(3, 9), ban, -s * 1.95, 19, 0, 0, -s * Math.PI / 2, 0);
  }
  // Pointed transverse ribs, diagonal ribs and a ridge rib.
  const ribMat = stoneLight;
  const rib = (pts: THREE.Vector3[], r = 0.45) => mesh(root, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, r, 6), ribMat);
  const archPts = (a: THREE.Vector3, b: THREE.Vector3, rise: number) => {
    const out: THREE.Vector3[] = [];
    for (let i = 0; i <= 20; i++) { const f = i / 20; const y = Math.pow(Math.sin(Math.PI * f), 0.7) * rise; out.push(a.clone().lerp(b, f).setY(a.y + y)); }
    return out;
  };
  zs.forEach((z) => rib(archPts(new THREE.Vector3(-37.6, 30, z), new THREE.Vector3(37.6, 30, z), 5.6)));
  for (let i = 0; i < zs.length - 1; i++) {
    rib(archPts(new THREE.Vector3(-37.6, 30, zs[i]), new THREE.Vector3(37.6, 30, zs[i + 1]), 5.6), 0.3);
    rib(archPts(new THREE.Vector3(37.6, 30, zs[i]), new THREE.Vector3(-37.6, 30, zs[i + 1]), 5.6), 0.3);
  }
  rib([new THREE.Vector3(0, 35.6, -40), new THREE.Vector3(0, 35.6, 40)], 0.4);
  // Stained glass lancets with god rays.
  const palettes = [['#1e3a8a', '#b91c1c', '#ca8a04', '#1d4ed8', '#7f1d1d'], ['#1e40af', '#047857', '#ca8a04', '#7c3aed', '#b91c1c']];
  const rayColors = [0xffd59a, 0xc9d7ff, 0xffb3a0];
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) {
    const z = -22.5 + i * 15;
    const mat = basic(0xffffff, { map: stainedGlassTexture(rnd, palettes[(i + (s > 0 ? 1 : 0)) % 2]), toneMapped: false });
    mesh(root, normalizeUV(new THREE.ShapeGeometry(lancetShape(6, 17))), mat, s * WALL, 8, z, 0, -s * Math.PI / 2, 0);
    const frame = lancetShape(6.6, 17.6).getPoints(24).map((p) => new THREE.Vector3(p.x, p.y, 0));
    const fm = mesh(root, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(frame, true), 64, 0.25, 5, true), gold, s * (WALL - 0.05), 7.7, z, 0, -s * Math.PI / 2, 0);
    void fm;
    glowSprite(root, 0xffd59a, 14, 0.18, s * 38.5, 17, z);
    const from = new THREE.Vector3(s * 38.8, 17, z);
    const to = new THREE.Vector3(s * 12, 0, z + 6);
    beam(root, from, to, 2.6, 5.5, rayColors[(i + (s > 0 ? 0 : 1)) % 3], 0.16);
  }
  // Rose windows at both ends.
  for (const s of [-1, 1]) {
    const rose = basic(0xffffff, { map: stainedGlassTexture(rnd, ['#1e3a8a', '#b91c1c', '#ca8a04', '#1d4ed8', '#047857', '#7c3aed'], true), toneMapped: false });
    mesh(root, new THREE.CircleGeometry(s < 0 ? 11 : 7, 48), rose, 0, 24, s * WALL, 0, s < 0 ? 0 : Math.PI, 0);
    mesh(root, new THREE.TorusGeometry(s < 0 ? 11.4 : 7.3, 0.5, 8, 64), gold, 0, 24, s * (WALL - 0.1), 0, 0, 0);
    if (s < 0) beam(root, new THREE.Vector3(0, 24, -38.5), new THREE.Vector3(0, 0, -8), 7, 10, 0xe2c7ff, 0.14);
  }
  // Chandeliers.
  const chandeliers = [-20, 0, 20].map((z) => {
    const g = new THREE.Group(); g.position.set(0, 36, z); root.add(g);
    box(g, 0.12, 10, 0.12, std(0x1c1917, 0.8, 0.5), 0, -5, 0);
    mesh(g, new THREE.TorusGeometry(3, 0.18, 8, 40), gold, 0, -10, 0, Math.PI / 2);
    mesh(g, new THREE.TorusGeometry(1.8, 0.14, 8, 32), gold, 0, -11.2, 0, Math.PI / 2);
    for (let k = 0; k < 14; k++) {
      const a = (k / 14) * Math.PI * 2;
      glowSprite(g, 0xffc46b, 1.1, 0.95, Math.cos(a) * 3, -9.6, Math.sin(a) * 3);
    }
    glowSprite(g, 0xffb347, 12, 0.3, 0, -10, 0);
    return g;
  });
  // Red processional carpet.
  const carpet = canvasTex(64, 512, (c) => {
    c.fillStyle = '#5c0a14'; c.fillRect(0, 0, 64, 512);
    c.fillStyle = '#c99a1b'; c.fillRect(0, 0, 5, 512); c.fillRect(59, 0, 5, 512);
    c.strokeStyle = 'rgba(201,154,27,0.5)'; c.lineWidth = 2;
    for (let y = 0; y < 512; y += 32) { c.beginPath(); c.moveTo(32, y); c.lineTo(48, y + 16); c.lineTo(32, y + 32); c.lineTo(16, y + 16); c.closePath(); c.stroke(); }
  });
  carpet.wrapT = THREE.RepeatWrapping; carpet.repeat.set(1, 6);
  mesh(root, new THREE.PlaneGeometry(5, 66), std(0xffffff, 0, 0.95, { map: carpet }), 0, 0.03, 6, -Math.PI / 2);
  particles(ctx, { count: 500, size: 0.16, color: 0xffe2a8, opacity: 0.75, half: [36, 36], y: [0.5, 26], mode: 'drift', speed: 0.3, sway: 0.25 });
  ctx.on((_dt, t) => { chandeliers.forEach((c, i) => { c.rotation.y = t * 0.05 + i; }); });
}

function buildSpire(ctx: Ctx) {
  const { root, rnd } = ctx;
  const metal = std(0x3b4258, 0.85, 0.35);
  const dark = std(0x161a26, 0.8, 0.4);
  const violet = basic(0xa78bfa, { toneMapped: false });
  // Energy barrier above the railing.
  const hexTex = canvasTex(128, 128, (c) => {
    c.fillStyle = '#000'; c.fillRect(0, 0, 128, 128);
    c.strokeStyle = '#ffffff'; c.lineWidth = 2;
    const hx = (cx: number, cy: number) => { c.beginPath(); for (let k = 0; k <= 6; k++) { const a = k * Math.PI / 3; c.lineTo(cx + Math.cos(a) * 20, cy + Math.sin(a) * 20); } c.stroke(); };
    for (const [x, y] of [[0, 0], [64, 0], [128, 0], [32, 34.6], [96, 34.6], [0, 69.3], [64, 69.3], [128, 69.3], [32, 103.9], [96, 103.9], [0, 138.6], [64, 138.6], [128, 138.6]]) hx(x, y);
  });
  hexTex.wrapS = hexTex.wrapT = THREE.RepeatWrapping; hexTex.repeat.set(20, 2);
  const barrier = new THREE.MeshBasicMaterial({ color: 0x8b5cf6, map: hexTex, transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
  for (const [x, z, ry] of [[0, -39.4, 0], [0, 39.4, 0], [-39.4, 0, Math.PI / 2], [39.4, 0, Math.PI / 2]] as const) mesh(root, new THREE.PlaneGeometry(80, 7), barrier, x, 4.6, z, 0, ry, 0);
  // Platform rim and the inverted pyramid substructure seen over the railing.
  box(root, 86, 2.2, 86, dark, 0, -1.16, 0);
  for (const [w, d, x, z] of [[86, 0.3, 0, -43], [86, 0.3, 0, 43], [0.3, 86, -43, 0], [0.3, 86, 43, 0]] as const) box(root, w, 0.25, d, violet, x, -0.4, z);
  mesh(root, new THREE.ConeGeometry(60, 70, 4, 1, true), dark, 0, -37, 0, Math.PI, Math.PI / 4, 0);
  for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + Math.PI / 4; glowSprite(root, 0xff3355, 4, 0.9, Math.cos(a) * 60, -2.5, Math.sin(a) * 60); }
  // Distant transmission spires rising from the cloud sea.
  const blink: THREE.Sprite[] = [];
  for (let i = 0; i < 9; i++) {
    const a = -Math.PI / 2 + (i - 4) * 0.42 + (rnd() - 0.5) * 0.15 + (i % 2 ? Math.PI : 0) * 0.0;
    const r = 105 + rnd() * 30;
    const x = Math.cos(a + (i > 5 ? Math.PI : 0)) * r, z = Math.sin(a + (i > 5 ? Math.PI : 0)) * r;
    const h = 60 + rnd() * 60;
    mesh(root, new THREE.CylinderGeometry(1.6, 4, h + 60, 8), metal, x, h / 2 - 30, z);
    for (let k = 0; k < 4; k++) mesh(root, new THREE.TorusGeometry(4.5 - k * 0.5, 0.3, 6, 24), violet, x, h - 40 + k * 10, z, Math.PI / 2);
    blink.push(glowSprite(root, 0xff2a2a, 5, 0.9, x, h + 1, z));
  }
  // The mega-spire to the north with rotating coil rings.
  const mega = new THREE.Group(); mega.position.set(0, 0, -96); root.add(mega);
  mesh(mega, new THREE.CylinderGeometry(5, 11, 230, 12), metal, 0, 50, 0);
  const coils: THREE.Mesh[] = [];
  for (let k = 0; k < 9; k++) {
    const y = 4 + k * 15;
    coils.push(mesh(mega, new THREE.TorusGeometry(13 - k * 0.6, 0.7, 8, 48), violet, 0, y, 0, Math.PI / 2 + 0.05));
    box(mega, 26 - k, 0.6, 1.2, metal, 0, y, 0);
  }
  glowSprite(mega, 0x8b5cf6, 80, 0.35, 0, 60, 6);
  // Arc emitters at the north corners linking to the mega-spire.
  const emitters = [-1, 1].map((s) => {
    const g = new THREE.Group(); g.position.set(s * 36.5, 0, -36.5); root.add(g);
    mesh(g, new THREE.CylinderGeometry(0.5, 1.2, 12, 8), metal, 0, 6, 0);
    for (let k = 0; k < 3; k++) mesh(g, new THREE.TorusGeometry(1.4 - k * 0.25, 0.18, 6, 20), violet, 0, 8 + k * 1.3, 0, Math.PI / 2);
    mesh(g, new THREE.SphereGeometry(1.1, 16, 12), basic(0xe9d5ff, { toneMapped: false }), 0, 12.6, 0);
    glowSprite(g, 0xa78bfa, 8, 0.6, 0, 12.6, 0);
    return new THREE.Vector3(s * 36.5, 12.6, -36.5);
  });
  const arcs = emitters.map(() => makeArc(root, 0xc4b5fd, 0.09));
  // Wind streaks.
  const W = 160, wp = new Float32Array(W * 6);
  const wReset = (i: number) => { const x = -80 + rnd() * 20, y = -10 + rnd() * 40, z = (rnd() * 2 - 1) * 70, l = 4 + rnd() * 8; wp.set([x, y, z, x + l, y, z], i * 6); };
  for (let i = 0; i < W; i++) { wReset(i); const o = rnd() * 160; wp[i * 6] += o; wp[i * 6 + 3] += o; }
  const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.BufferAttribute(wp, 3));
  const wind = new THREE.LineSegments(wg, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.22, depthWrite: false }));
  wind.frustumCulled = false; root.add(wind);
  let arcTimer = 0;
  ctx.on((dt, t) => {
    coils.forEach((c, i) => { c.rotation.z = t * (0.3 + i * 0.05) * (i % 2 ? 1 : -1); });
    blink.forEach((b, i) => { (b.material as THREE.SpriteMaterial).opacity = Math.sin(t * 2.5 + i * 1.3) > 0.5 ? 0.95 : 0.08; });
    for (let i = 0; i < W; i++) { const k = i * 6; wp[k] += 38 * dt; wp[k + 3] += 38 * dt; if (wp[k] > 85) wReset(i); }
    wg.attributes.position.needsUpdate = true;
    arcTimer -= dt;
    if (arcTimer < 0) {
      arcTimer = 0.07 + rnd() * 0.08;
      arcs.forEach((a, i) => {
        const on = rnd() > 0.25;
        a.visible(on);
        if (on) a.set(emitters[i], new THREE.Vector3((rnd() - 0.5) * 6, 25 + rnd() * 30, -88), 7);
      });
    }
  });
}

function buildMechDock(ctx: Ctx) {
  const { root, rnd } = ctx;
  const shellTex = canvasTex(256, 256, (c) => {
    c.fillStyle = '#2b323c'; c.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y += 64) for (let x = 0; x < 256; x += 128) {
      c.fillStyle = `rgba(255,255,255,${0.02 + rnd() * 0.05})`; c.fillRect(x + 3, y + 3, 122, 58);
      c.strokeStyle = 'rgba(0,0,0,0.6)'; c.lineWidth = 3; c.strokeRect(x + 1.5, y + 1.5, 125, 61);
      c.fillStyle = 'rgba(0,0,0,0.5)'; for (const [rx, ry] of [[8, 8], [118, 8], [8, 54], [118, 54]]) { c.beginPath(); c.arc(x + rx, y + ry, 2.5, 0, Math.PI * 2); c.fill(); }
    }
    c.fillStyle = 'rgba(0,0,0,0.25)'; for (let i = 0; i < 30; i++) c.fillRect(rnd() * 256, rnd() * 256, 2 + rnd() * 4, 20 + rnd() * 60);
  });
  shellTex.wrapS = shellTex.wrapT = THREE.RepeatWrapping; shellTex.repeat.set(10, 3);
  const shell = std(0xffffff, 0.55, 0.6, { map: shellTex });
  const steel = std(0x3a414b, 0.8, 0.4);
  const yellow = std(0xd99a1e, 0.5, 0.45);
  const lamp = basic(0xffd18a, { toneMapped: false });
  // Outer hangar shell beyond the bulkheads.
  for (const [w, d, x, z] of [[132, 2, 0, -66], [132, 2, 0, 66], [2, 132, -66, 0], [2, 132, 66, 0]] as const) box(root, w, 38, d, shell, x, 19, z);
  mesh(root, new THREE.PlaneGeometry(134, 134), std(0x14181e, 0.5, 0.7), 0, 38, 0, Math.PI / 2);
  mesh(root, new THREE.PlaneGeometry(134, 134), std(0x1c2027, 0.6, 0.6), 0, -0.2, 0, -Math.PI / 2);
  for (const s of [-1, 1]) for (let k = 0; k < 4; k++) box(root, 0.3, 0.6, 128, basic(0xf59e0b, { toneMapped: false }), s * 64.8, 8 + k * 7, 0);
  const bayNo = canvasTex(512, 256, (c) => { c.fillStyle = 'rgba(245,158,11,0.85)'; c.font = 'bold 200px monospace'; c.textAlign = 'center'; c.fillText('06', 256, 200); });
  mesh(root, new THREE.PlaneGeometry(36, 18), std(0xffffff, 0.3, 0.7, { map: bayNo, transparent: true }), -34, 24, -64.9);
  // Roof trusses and lamp rows with light cones.
  for (let i = -5; i <= 5; i++) {
    box(root, 130, 1.4, 1.2, steel, 0, 35.5, i * 12);
    box(root, 1.2, 1.4, 130, steel, i * 12, 34.2, 0);
  }
  for (const x of [-24, 0, 24]) for (const z of [-24, 0, 24]) {
    box(root, 3.2, 0.4, 1.2, lamp, x, 33.2, z);
    beam(root, new THREE.Vector3(x, 33, z), new THREE.Vector3(x, 0, z), 1.2, 7, 0xffd18a, 0.1);
    glowSprite(root, 0xffd18a, 6, 0.6, x, 32.9, z);
  }
  // Mechs standing in maintenance bays, with yellow gantries.
  const armor = std(0x5b6573, 0.75, 0.42);
  const trim = std(0xc2410c, 0.55, 0.5);
  const dark = std(0x1b1f26, 0.8, 0.4);
  const eyeA = basic(0x67e8f9, { toneMapped: false });
  const eyeR = basic(0xff3355, { toneMapped: false });
  const weld: THREE.Vector3[] = [];
  const bays: [number, number, number, number][] = [[52, -24, -Math.PI / 2, 1], [52, 6, -Math.PI / 2, 0.92], [52, 30, -Math.PI / 2, 1], [-52, -24, Math.PI / 2, 1], [-52, 6, Math.PI / 2, 1], [-52, 30, Math.PI / 2, 0.9]];
  bays.forEach(([x, z, ry, sc]) => {
    const m = buildMech(armor, trim, dark, eyeA);
    m.position.set(x, 0, z); m.rotation.y = ry; m.scale.setScalar(sc); root.add(m);
    const s = Math.sign(x);
    // gantry
    for (const dz of [-7, 7]) for (const dx of [-6, 6]) box(root, 0.5, 26, 0.5, yellow, x + dx, 13, z + dz);
    for (const y of [9, 17]) { box(root, 13, 0.4, 1.8, yellow, x, y, z - 7); box(root, 13, 0.4, 1.8, yellow, x, y, z + 7); box(root, 1.8, 0.4, 14, yellow, x - s * 6, y, z); }
    weld.push(new THREE.Vector3(x - s * 3.5, 9 + rnd() * 10, z + (rnd() - 0.5) * 6));
  });
  // Massive titan under refit to the north.
  const titan = buildMech(std(0x2b3038, 0.8, 0.4), std(0x7f1d1d, 0.6, 0.5), dark, eyeR);
  titan.position.set(0, 0, -56); titan.scale.setScalar(1.45); root.add(titan);
  glowSprite(root, 0xff3355, 10, 0.5, 0, 33.4, -59);
  // Overhead gantry crane.
  const crane = new THREE.Group(); root.add(crane);
  box(crane, 130, 2.2, 2.6, yellow, 0, 31, 0);
  const trolley = new THREE.Group(); crane.add(trolley);
  box(trolley, 4, 2, 4, dark, 0, 29.4, 0);
  box(trolley, 0.2, 9, 0.2, dark, 0, 24, 0);
  mesh(trolley, new THREE.TorusGeometry(0.9, 0.25, 6, 16, Math.PI * 1.4), steel, 0, 19.2, 0);
  const warn = glowSprite(trolley, 0xf59e0b, 3, 0.9, 0, 28.2, 0);
  // Rotating amber beacons on the bulkheads.
  const beacons = [[-39.6, -20], [39.6, -20], [-39.6, 20], [39.6, 20]].map(([x, z]) => {
    mesh(root, new THREE.SphereGeometry(0.45, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), additive(0xf59e0b, 0.9), x, 7, z);
    const p = pivotBeam(root, 14, 0.3, 3.5, 0xf59e0b, 0.16); p.position.set(x, 7.3, z);
    return p;
  });
  // Welding sparks.
  const sparkMat = new THREE.PointsMaterial({ size: 0.25, map: softDot(), color: 0xbfe9ff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const SP = 60;
  const sparkSets = weld.map((w) => {
    const pos = new Float32Array(SP * 3), vel = new Float32Array(SP * 3), life = new Float32Array(SP);
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(geo, sparkMat); pts.frustumCulled = false; root.add(pts);
    const flare = glowSprite(root, 0xbfe9ff, 3, 0.9, w.x, w.y, w.z);
    return { w, pos, vel, life, geo, flare, active: rnd() * 3 };
  });
  ctx.on((dt, t) => {
    crane.position.z = Math.sin(t * 0.08) * 40;
    trolley.position.x = Math.sin(t * 0.13) * 30;
    (warn.material as THREE.SpriteMaterial).opacity = Math.sin(t * 6) > 0 ? 0.95 : 0.15;
    beacons.forEach((b, i) => { b.rotation.set(Math.PI / 2, t * 3 + i, 0, 'YXZ'); });
    sparkSets.forEach((s) => {
      s.active -= dt;
      const on = s.active > 0;
      if (s.active < -2.5) s.active = 0.8 + rnd() * 2.2;
      (s.flare.material as THREE.SpriteMaterial).opacity = on ? 0.5 + rnd() * 0.5 : 0;
      for (let i = 0; i < SP; i++) {
        const k = i * 3;
        s.life[i] -= dt;
        if (s.life[i] <= 0 && on) {
          s.life[i] = 0.4 + rnd() * 0.6;
          s.pos[k] = s.w.x; s.pos[k + 1] = s.w.y; s.pos[k + 2] = s.w.z;
          s.vel[k] = (rnd() - 0.5) * 6; s.vel[k + 1] = rnd() * 4; s.vel[k + 2] = (rnd() - 0.5) * 6;
        }
        if (s.life[i] > 0) {
          s.vel[k + 1] -= 18 * dt;
          s.pos[k] += s.vel[k] * dt; s.pos[k + 1] += s.vel[k + 1] * dt; s.pos[k + 2] += s.vel[k + 2] * dt;
        } else s.pos[k + 1] = -50;
      }
      s.geo.attributes.position.needsUpdate = true;
    });
  });
}

function buildMonolith(ctx: Ctx) {
  const { root, rnd } = ctx;
  const ground = std(0x150c1e, 0.3, 0.8);
  mesh(root, new THREE.CircleGeometry(175, 48), ground, 0, -0.2, 0, -Math.PI / 2);
  const obsidian = std(0x07050c, 0.9, 0.18);
  const runeTex = runeTexture(rnd, '#f0abfc');
  const runeMat = std(0x07050c, 0.9, 0.18, { emissive: 0xffffff, emissiveMap: runeTex, emissiveIntensity: 1.4 });
  // Rune stones capping the low wall.
  for (let i = 0; i < 32; i++) {
    const side = i % 4, f = -35 + Math.floor(i / 4) * 10;
    const x = side < 2 ? f : side === 2 ? 40 : -40, z = side === 0 ? -40 : side === 1 ? 40 : f;
    box(root, 1.6, 1.8 + rnd() * 1.4, 1.6, runeMat, x, 2.6, z, 0, rnd(), 0);
  }
  // Floating monolith ring.
  const floaters: { m: THREE.Mesh; y: number; s: number }[] = [];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + rnd() * 0.3;
    const r = 58 + rnd() * 40;
    const h = 22 + rnd() * 26;
    const m = box(root, 5 + rnd() * 4, h, 2.6, i % 2 ? runeMat : obsidian, Math.cos(a) * r, 0, Math.sin(a) * r, (rnd() - 0.5) * 0.25, -a + Math.PI / 2, (rnd() - 0.5) * 0.25);
    const y = h / 2 + 4 + rnd() * 14;
    floaters.push({ m, y, s: rnd() * 10 });
  }
  // The sealed hero monolith with its halo.
  const hero = new THREE.Group(); hero.position.set(0, 0, -80); root.add(hero);
  box(hero, 16, 74, 5, runeMat, 0, 37, 0);
  box(hero, 22, 3, 9, obsidian, 0, 1.5, 0);
  const sigil = canvasTex(256, 256, (c) => {
    c.strokeStyle = '#f0abfc'; c.shadowColor = '#e879f9'; c.shadowBlur = 14; c.lineWidth = 5;
    c.beginPath(); c.arc(128, 128, 110, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.arc(128, 128, 70, 0, Math.PI * 2); c.stroke();
    c.beginPath(); for (let k = 0; k <= 5; k++) { const a = -Math.PI / 2 + k * Math.PI * 4 / 5; c.lineTo(128 + Math.cos(a) * 110, 128 + Math.sin(a) * 110); } c.stroke();
  });
  mesh(hero, new THREE.PlaneGeometry(14, 14), additive(0xffffff, 0.95, { map: sigil, fog: false }), 0, 42, 2.6);
  const halo = mesh(hero, new THREE.TorusGeometry(20, 0.35, 8, 96), additive(0xe879f9, 0.7, { fog: false }), 0, 42, 0);
  const halo2 = mesh(hero, new THREE.TorusGeometry(24, 0.18, 8, 96), additive(0x8b5cf6, 0.6, { fog: false }), 0, 42, 0);
  beam(root, new THREE.Vector3(0, 150, -80), new THREE.Vector3(0, 70, -80), 3, 3, 0xe879f9, 0.25);
  // Floating debris.
  const rockGeo = new THREE.DodecahedronGeometry(1, 0);
  const rocks = new THREE.InstancedMesh(rockGeo, obsidian, 80);
  const rockData = Array.from({ length: 80 }, () => {
    const a = rnd() * Math.PI * 2, r = 44 + rnd() * 30;
    return { x: Math.cos(a) * r, z: Math.sin(a) * r, y: 2 + rnd() * 18, s: 0.4 + rnd() * 1.6, p: rnd() * 10 };
  });
  root.add(rocks);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  particles(ctx, { count: 450, size: 0.3, color: 0xe879f9, opacity: 0.85, half: [40, 40], y: [0, 26], mode: 'rise', speed: 0.7, sway: 0.4 });
  ctx.on((_dt, t) => {
    floaters.forEach((f) => { f.m.position.y = f.y + Math.sin(t * 0.4 + f.s) * 1.6; f.m.rotation.y += 0.0008; });
    halo.rotation.x = Math.sin(t * 0.3) * 0.4; halo.rotation.y = t * 0.2;
    halo2.rotation.x = Math.PI / 2 + Math.cos(t * 0.25) * 0.4; halo2.rotation.z = -t * 0.15;
    rockData.forEach((r, i) => {
      e.set(t * 0.2 + r.p, t * 0.15 + r.p, 0); q.setFromEuler(e);
      m4.compose(v.set(r.x, r.y + Math.sin(t * 0.6 + r.p) * 0.8, r.z), q, sc.setScalar(r.s));
      rocks.setMatrixAt(i, m4);
    });
    rocks.instanceMatrix.needsUpdate = true;
  });
}

function buildFusion(ctx: Ctx) {
  const { root, rnd } = ctx;
  const steel = std(0x30343c, 0.85, 0.4);
  const dark = std(0x16181d, 0.8, 0.45);
  const amber = basic(0xffb347, { toneMapped: false });
  // Plasma torus overhead.
  const plasmaTex = canvasTex(512, 64, (c) => {
    const g = c.createLinearGradient(0, 0, 0, 64);
    g.addColorStop(0, '#7c2d12'); g.addColorStop(0.5, '#fff7d6'); g.addColorStop(1, '#7c2d12');
    c.fillStyle = g; c.fillRect(0, 0, 512, 64);
    for (let i = 0; i < 70; i++) { c.fillStyle = `rgba(255,${150 + rnd() * 100},40,${0.3 + rnd() * 0.4})`; c.fillRect(rnd() * 512, rnd() * 64, 20 + rnd() * 80, 2 + rnd() * 5); }
  });
  plasmaTex.wrapS = plasmaTex.wrapT = THREE.RepeatWrapping; plasmaTex.repeat.set(6, 1);
  const ringY = 31;
  mesh(root, new THREE.TorusGeometry(27, 1.8, 16, 128), basic(0xffffff, { map: plasmaTex, toneMapped: false }), 0, ringY, 0, Math.PI / 2);
  mesh(root, new THREE.TorusGeometry(27, 3.4, 12, 96), additive(0xff9a3d, 0.28, { fog: false }), 0, ringY, 0, Math.PI / 2);
  // Magnetic containment coils around the torus.
  for (let k = 0; k < 18; k++) {
    const a = (k / 18) * Math.PI * 2;
    const coil = mesh(root, new THREE.TorusGeometry(3.3, 0.7, 8, 20), steel, Math.cos(a) * 27, ringY, Math.sin(a) * 27);
    coil.rotation.y = -a;
    box(root, 0.5, 0.5, 2.6, amber, Math.cos(a) * 27, ringY + 3.8, Math.sin(a) * 27, 0, -a, 0);
    if (k % 3 === 0) {
      const outer = new THREE.Vector3(Math.cos(a) * 46, 14, Math.sin(a) * 46);
      const inner = new THREE.Vector3(Math.cos(a) * 29.5, ringY, Math.sin(a) * 29.5);
      const strut = mesh(root, new THREE.CylinderGeometry(0.55, 0.8, outer.distanceTo(inner), 8), dark);
      strut.position.copy(outer).add(inner).multiplyScalar(0.5);
      strut.quaternion.setFromUnitVectors(_up, inner.clone().sub(outer).normalize());
    }
  }
  // Reactor core and plasma column.
  const core = mesh(root, new THREE.SphereGeometry(3.6, 32, 24), basic(0xfff1c2, { toneMapped: false }), 0, ringY, 0);
  const coreGlow = glowSprite(root, 0xffa040, 26, 0.65, 0, ringY, 0);
  beam(root, new THREE.Vector3(0, 140, 0), new THREE.Vector3(0, ringY + 2, 0), 3, 2, 0xffc46b, 0.4);
  const arcs = [0, 1, 2, 3].map(() => makeArc(root, 0xffc46b, 0.1));
  // Corner capacitor pylons and wall coolant pipes.
  for (const [x, z] of [[-46, -46], [46, -46], [-46, 46], [46, 46]]) {
    mesh(root, new THREE.CylinderGeometry(3, 3.6, 40, 16), steel, x, 20, z);
    for (let k = 0; k < 6; k++) mesh(root, new THREE.TorusGeometry(3.4, 0.25, 6, 32), amber, x, 8 + k * 5.5, z, Math.PI / 2);
    glowSprite(root, 0xffb347, 10, 0.4, x, 41, z);
  }
  const pipeMat = std(0x4a505a, 0.85, 0.35);
  for (const s of [-1, 1]) for (let i = 0; i < 6; i++) {
    const f = -30 + i * 12;
    mesh(root, new THREE.CylinderGeometry(0.45, 0.45, 14, 10), pipeMat, f, 7, s * 39.1);
    mesh(root, new THREE.CylinderGeometry(0.45, 0.45, 14, 10), pipeMat, s * 39.1, 7, f);
    for (const y of [4, 10]) {
      mesh(root, new THREE.CylinderGeometry(0.55, 0.55, 0.5, 10), amber, f, y, s * 39.1);
      mesh(root, new THREE.CylinderGeometry(0.55, 0.55, 0.5, 10), amber, s * 39.1, y, f);
    }
  }
  // Orbiting plasma motes riding the torus.
  const N = 500, pos = new Float32Array(N * 3), seed = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { seed[i * 3] = rnd() * Math.PI * 2; seed[i * 3 + 1] = rnd() * Math.PI * 2; seed[i * 3 + 2] = 0.3 + rnd(); }
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const motes = new THREE.Points(pg, new THREE.PointsMaterial({ size: 0.45, map: softDot(), color: 0xffc46b, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  motes.frustumCulled = false; root.add(motes);
  particles(ctx, { count: 220, size: 0.25, color: 0xffa040, opacity: 0.8, half: [38, 38], y: [0, 28], mode: 'rise', speed: 1.2, sway: 0.6 });
  let arcT = 0;
  ctx.on((dt, t) => {
    plasmaTex.offset.x -= dt * 0.6;
    const pulse = 1 + Math.sin(t * 3.2) * 0.08;
    core.scale.setScalar(pulse);
    coreGlow.scale.setScalar(26 * pulse);
    for (let i = 0; i < N; i++) {
      const a = seed[i * 3] + t * 0.5 * seed[i * 3 + 2], b = seed[i * 3 + 1] + t * 3 * seed[i * 3 + 2];
      const rr = 27 + Math.cos(b) * 3.2;
      pos[i * 3] = Math.cos(a) * rr; pos[i * 3 + 1] = ringY + Math.sin(b) * 3.2; pos[i * 3 + 2] = Math.sin(a) * rr;
    }
    pg.attributes.position.needsUpdate = true;
    arcT -= dt;
    if (arcT < 0) {
      arcT = 0.06 + rnd() * 0.08;
      arcs.forEach((a) => {
        const on = rnd() > 0.35; a.visible(on);
        if (on) { const ang = rnd() * Math.PI * 2; a.set(new THREE.Vector3(0, ringY, 0), new THREE.Vector3(Math.cos(ang) * 25.5, ringY + (rnd() - 0.5) * 2, Math.sin(ang) * 25.5), 4); }
      });
    }
    ctx.hemi.intensity = 0.8 + Math.sin(t * 3.2) * 0.08;
  });
}

function buildCorridor(ctx: Ctx) {
  const { root, rnd } = ctx;
  const panel = std(0x1a2228, 0.7, 0.5);
  const pipe = std(0x4b5560, 0.85, 0.35);
  const teal = basic(0x5eead4, { toneMapped: false });
  mesh(root, new THREE.PlaneGeometry(82, 82), panel, 0, 12, 0, Math.PI / 2);
  // Segmented ceiling light strips with occasional flicker.
  const stripMat = basic(0xdff6ff, { toneMapped: false });
  const flickerMat = basic(0xdff6ff, { toneMapped: false });
  const geo = new THREE.BoxGeometry(0.7, 0.18, 3.2);
  for (const x of [-26, -13, 0, 13, 26]) {
    for (let z = -36; z <= 36; z += 4.5) {
      mesh(root, geo, rnd() > 0.93 ? flickerMat : stripMat, x, 11.45, z);
    }
    box(root, 1.6, 0.5, 80, panel, x, 11.8, 0);
  }
  for (let z = -36; z <= 36; z += 12) box(root, 80, 0.8, 1.2, panel, 0, 11.6, z + 2.25);
  // Pipe bundles with clamps on all four walls.
  for (const s of [-1, 1]) {
    [[7.2, 0.6, pipe], [8.6, 0.42, pipe], [9.7, 0.3, teal]].forEach(([y, r, m]) => {
      mesh(root, new THREE.CylinderGeometry(r as number, r as number, 80, 12), m as THREE.Material, s * 38.6, y as number, 0, Math.PI / 2);
      mesh(root, new THREE.CylinderGeometry(r as number, r as number, 80, 12), m as THREE.Material, 0, y as number, s * 38.6, 0, 0, Math.PI / 2);
    });
    for (let f = -36; f <= 36; f += 8) {
      box(root, 1.2, 3.6, 0.5, panel, s * 38.9, 8.4, f);
      box(root, 0.5, 3.6, 1.2, panel, f, 8.4, s * 38.9);
    }
  }
  // Circular blast doors at both ends.
  const steelD = std(0x3b4450, 0.85, 0.35);
  const hazard = canvasTex(512, 64, (c) => { c.fillStyle = '#111'; c.fillRect(0, 0, 512, 64); c.fillStyle = '#f59e0b'; for (let x = -64; x < 512; x += 48) { c.beginPath(); c.moveTo(x, 64); c.lineTo(x + 24, 64); c.lineTo(x + 88, 0); c.lineTo(x + 64, 0); c.fill(); } });
  hazard.wrapS = THREE.RepeatWrapping; hazard.repeat.set(4, 1);
  const beacons: THREE.Object3D[] = [];
  for (const s of [-1, 1]) {
    const d = new THREE.Group(); d.position.set(0, 5.8, s * WALL); d.rotation.y = s < 0 ? 0 : Math.PI; root.add(d);
    mesh(d, new THREE.RingGeometry(5.6, 7, 64), std(0xffffff, 0.4, 0.6, { map: hazard }), 0, 0, 0.05);
    mesh(d, new THREE.CircleGeometry(5.6, 64), steelD, 0, 0, 0.03);
    for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; box(d, 0.18, 5.4, 0.25, std(0x0b0f14, 0.6, 0.5), Math.cos(a) * 2.7, Math.sin(a) * 2.7, 0.15, 0, 0, a + Math.PI / 2); }
    mesh(d, new THREE.CircleGeometry(1.3, 32), teal, 0, 0, 0.2);
    mesh(d, new THREE.TorusGeometry(7.1, 0.25, 8, 64), basic(0xf59e0b, { toneMapped: false }), 0, 0, 0.1);
    mesh(d, new THREE.SphereGeometry(0.5, 12, 8), additive(0xf59e0b, 0.95), 0, 5.6 + 2.2, 0.4);
    const b = pivotBeam(d, 10, 0.3, 3, 0xf59e0b, 0.16); b.position.set(0, 7.8, 0.4); beacons.push(b);
  }
  // Steam vents along the wall bases.
  const steamMat = new THREE.PointsMaterial({ size: 2.6, map: softDot(), color: 0xa9c3cf, transparent: true, opacity: 0.12, depthWrite: false });
  const vents = [[-38.5, -20], [-38.5, 14], [38.5, -6], [38.5, 26], [-12, -38.5], [18, 38.5]];
  const VN = 30;
  const steam = vents.map(([x, z]) => {
    box(root, 1.6, 0.4, 1.6, pipe, x, 0.2, z);
    const pos = new Float32Array(VN * 3), age = new Float32Array(VN);
    for (let i = 0; i < VN; i++) age[i] = rnd() * 3;
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const p = new THREE.Points(g, steamMat); p.frustumCulled = false; root.add(p);
    return { x, z, pos, age, g };
  });
  ctx.on((dt, t) => {
    flickerMat.color.setScalar(Math.sin(t * 23) + Math.sin(t * 7.7) > 0.4 ? 1 : 0.15);
    beacons.forEach((b, i) => { b.rotation.set(Math.PI / 2, t * 2.6 + i * Math.PI, 0, 'YXZ'); });
    steam.forEach((s) => {
      for (let i = 0; i < VN; i++) {
        s.age[i] += dt;
        if (s.age[i] > 3) s.age[i] -= 3;
        const a = s.age[i];
        s.pos[i * 3] = s.x + Math.sin(i * 3.1) * a * 0.6;
        s.pos[i * 3 + 1] = 0.4 + a * 2.4;
        s.pos[i * 3 + 2] = s.z + Math.cos(i * 2.3) * a * 0.6;
      }
      s.g.attributes.position.needsUpdate = true;
    });
  });
}

function buildObservatory(ctx: Ctx) {
  const { root, rnd } = ctx;
  const deck = std(0x1a2236, 0.7, 0.45);
  const metal = std(0x8b95a8, 0.85, 0.3);
  const cyan = basic(0x67e8f9, { toneMapped: false });
  // Glass balustrade.
  const glass = new THREE.MeshBasicMaterial({ color: 0x67e8f9, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  for (const [x, z, ry] of [[0, -39.4, 0], [0, 39.4, 0], [-39.4, 0, Math.PI / 2], [39.4, 0, Math.PI / 2]] as const) {
    mesh(root, new THREE.PlaneGeometry(80, 1.6), glass, x, 3.4, z, 0, ry, 0);
    box(root, ry ? 0.2 : 80, 0.12, ry ? 80 : 0.2, cyan, x, 4.2, z);
  }
  // Observation deck ring outside the arena.
  const ring = new THREE.RingGeometry(41, 70, 64, 1);
  mesh(root, ring, deck, 0, -0.05, 0, -Math.PI / 2);
  for (const r of [48, 58]) mesh(root, new THREE.RingGeometry(r, r + 0.3, 96), cyan, 0, 0.0, 0, -Math.PI / 2);
  // Geodesic dome frame (upper hemisphere edges only).
  const ico = new THREE.IcosahedronGeometry(70, 3);
  const edges = new THREE.EdgesGeometry(ico, 1);
  const ep = edges.attributes.position;
  const keep: number[] = [];
  for (let i = 0; i < ep.count; i += 2) if (ep.getY(i) > -2 && ep.getY(i + 1) > -2) keep.push(ep.getX(i), ep.getY(i), ep.getZ(i), ep.getX(i + 1), ep.getY(i + 1), ep.getZ(i + 1));
  const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.Float32BufferAttribute(keep, 3));
  const dome = new THREE.LineSegments(dg, new THREE.LineBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.35, fog: false }));
  dome.position.y = -2; root.add(dome);
  mesh(root, new THREE.TorusGeometry(70, 0.8, 8, 128), metal, 0, -1.5, 0, Math.PI / 2);
  // Ringed gas giant and a moon.
  const bands = canvasTex(512, 256, (c) => {
    const cols = ['#e7c08a', '#c98a52', '#f3dfbd', '#a7653a', '#e9cfa0', '#b97845', '#f6e6c8', '#8f5530'];
    let y = 0;
    while (y < 256) { const h = 6 + rnd() * 22; c.fillStyle = cols[Math.floor(rnd() * cols.length)]; c.fillRect(0, y, 512, h); y += h; }
    for (let i = 0; i < 300; i++) { c.fillStyle = `rgba(${rnd() > 0.5 ? '255,240,220' : '90,50,30'},0.12)`; c.fillRect(rnd() * 512, rnd() * 256, 30 + rnd() * 120, 2 + rnd() * 3); }
    c.fillStyle = 'rgba(160,60,40,0.8)'; c.beginPath(); c.ellipse(320, 160, 30, 14, 0, 0, Math.PI * 2); c.fill();
  });
  const planetMat = new THREE.ShaderMaterial({
    uniforms: { uMap: { value: bands }, uLight: { value: new THREE.Vector3(1, 0.4, 0.6).normalize() } },
    vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){ vUv = uv; vN = normalize(mat3(modelMatrix) * normal); vec4 wp = modelMatrix * vec4(position,1.); vV = normalize(cameraPosition - wp.xyz); gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: `uniform sampler2D uMap; uniform vec3 uLight; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){ vec3 base = texture2D(uMap, vUv).rgb; float l = smoothstep(-0.15, 0.6, dot(vN, uLight)); float rim = pow(1. - max(dot(vN, vV), 0.), 3.);
        vec3 col = base * (0.04 + l * 1.05) + vec3(1.0, 0.75, 0.5) * rim * l * 0.6; gl_FragColor = vec4(col, 1.);
        #include <colorspace_fragment>
      }`,
  });
  const planet = new THREE.Group(); planet.position.set(-48, 58, -98); planet.rotation.set(0.35, 0, 0.3); root.add(planet);
  mesh(planet, new THREE.SphereGeometry(28, 48, 32), planetMat);
  const ringTex = canvasTex(256, 8, (c) => { for (let x = 0; x < 256; x++) { const a = (0.3 + 0.7 * Math.abs(Math.sin(x * 0.11) * Math.cos(x * 0.037))) * (x > 20 && x < 245 ? 1 : 0); c.fillStyle = `rgba(230,205,170,${a})`; c.fillRect(x, 0, 1, 8); } });
  const rg = new THREE.RingGeometry(36, 58, 128, 1);
  const rp = rg.attributes.position, ruv = rg.attributes.uv;
  for (let i = 0; i < rp.count; i++) { const r = Math.hypot(rp.getX(i), rp.getY(i)); ruv.setXY(i, (r - 36) / 22, 0.5); }
  mesh(planet, rg, new THREE.MeshBasicMaterial({ map: ringTex, transparent: true, side: THREE.DoubleSide, depthWrite: false, fog: false, opacity: 0.85 }), 0, 0, 0, -Math.PI / 2 + 0.1);
  mesh(root, new THREE.SphereGeometry(5, 32, 24), std(0x9ca3af, 0, 0.95, { fog: false }), 52, 64, -80);
  // Great telescope to the north.
  const scope = new THREE.Group(); scope.position.set(0, 0, -56); root.add(scope);
  mesh(scope, new THREE.CylinderGeometry(9, 10, 6, 32), deck, 0, 3, 0);
  const yoke = new THREE.Group(); yoke.position.y = 6; scope.add(yoke);
  for (const s of [-1, 1]) box(yoke, 1.6, 14, 4, metal, s * 6, 7, 0);
  const tube = new THREE.Group(); tube.position.y = 12; tube.rotation.x = -0.8; yoke.add(tube);
  mesh(tube, new THREE.CylinderGeometry(4.2, 4.6, 36, 32, 1, true), std(0xd7dde8, 0.6, 0.35, { side: THREE.DoubleSide }), 0, 8, 0);
  for (const y of [-9, 0, 10, 24]) mesh(tube, new THREE.TorusGeometry(4.7, 0.35, 8, 40), metal, 0, y, 0, Math.PI / 2);
  mesh(tube, new THREE.CircleGeometry(4.1, 32), additive(0x93c5fd, 0.7), 0, 25.9, 0, -Math.PI / 2);
  glowSprite(tube, 0x93c5fd, 12, 0.35, 0, 26.5, 0);
  // Holographic orrery above the arena.
  const orrery = new THREE.Group(); orrery.position.set(0, 20, -6); root.add(orrery);
  glowSprite(orrery, 0xfde68a, 5, 0.9);
  const orbits = [5, 8.5, 12, 16].map((r, i) => {
    const pivot = new THREE.Group(); pivot.rotation.x = 0.2 * i - 0.2; orrery.add(pivot);
    mesh(pivot, new THREE.TorusGeometry(r, 0.06, 6, 96), additive(0x67e8f9, 0.6, { fog: false }), 0, 0, 0, Math.PI / 2);
    const body = new THREE.Group(); pivot.add(body);
    glowSprite(body, i % 2 ? 0xa78bfa : 0x67e8f9, 1.6, 0.95, r, 0, 0);
    return body;
  });
  ctx.on((_dt, t) => {
    planet.rotation.y = t * 0.01;
    yoke.rotation.y = 0.65 + Math.sin(t * 0.05) * 0.25;
    orbits.forEach((o, i) => { o.rotation.y = t * (0.5 / (i + 1)); });
    orrery.rotation.y = t * 0.03;
  });
}

function buildPowerRoom(ctx: Ctx) {
  const { root, rnd } = ctx;
  const dark = std(0x1a1520, 0.75, 0.45);
  const ceramic = std(0xd8d0e0, 0.1, 0.35);
  const pink = basic(0xf472b6, { toneMapped: false });
  mesh(root, new THREE.PlaneGeometry(82, 82), std(0x0f0b14, 0.6, 0.6), 0, 22, 0, Math.PI / 2);
  // Tesla capacitor towers embedded in the side walls.
  const tops: THREE.Vector3[] = [];
  for (const s of [-1, 1]) for (const z of [-26, -6, 14, 32]) {
    const x = s * 41.2;
    mesh(root, new THREE.CylinderGeometry(2.6, 3, 4, 16), dark, x, 2, z);
    mesh(root, new THREE.CylinderGeometry(1.1, 1.1, 12, 12), dark, x, 10, z);
    for (let k = 0; k < 9; k++) mesh(root, new THREE.CylinderGeometry(2.3, 2.3, 0.35, 20), ceramic, x, 5 + k * 1.25, z);
    mesh(root, new THREE.TorusGeometry(2.6, 0.7, 12, 32), dark, x, 16.6, z, Math.PI / 2);
    mesh(root, new THREE.TorusGeometry(2.6, 0.18, 8, 32), pink, x - s * 0.1, 17.4, z, Math.PI / 2);
    mesh(root, new THREE.SphereGeometry(1.2, 16, 12), basic(0xfbcfe8, { toneMapped: false }), x, 17.6, z);
    glowSprite(root, 0xec4899, 7, 0.55, x - s * 1.5, 17.6, z);
    tops.push(new THREE.Vector3(x - s * 1.4, 17.6, z));
  }
  // Sagging cable bundles across the ceiling.
  const cable = std(0x0b0a0d, 0.3, 0.7);
  for (let i = 0; i < 9; i++) {
    const z = -34 + i * 8.5 + (rnd() - 0.5) * 2;
    const c = catenary(new THREE.Vector3(-40, 21.5, z), new THREE.Vector3(40, 21.5, z + (rnd() - 0.5) * 6), 2.5 + rnd() * 3);
    mesh(root, new THREE.TubeGeometry(c, 40, 0.28 + rnd() * 0.2, 6), i % 3 === 0 ? std(0x0b0a0d, 0.3, 0.7, { emissive: 0xec4899, emissiveIntensity: 0.35 }) : cable);
  }
  // Control wall: animated monitors on the north wall.
  const screens: THREE.Texture[] = [];
  for (let i = 0; i < 5; i++) {
    const tex = screenTexture(rnd, i % 2 ? '#f472b6' : '#22d3ee');
    screens.push(tex);
    const x = -28 + i * 14;
    box(root, 12, 7.6, 0.4, dark, x, 9, -39.2);
    mesh(root, new THREE.PlaneGeometry(11.2, 6.8), basic(0xffffff, { map: tex, toneMapped: false }), x, 9, -38.95);
    box(root, 12, 1.2, 2.4, dark, x, 0.6 + 2.6, -38.6);
  }
  // Breaker panel lights on the south wall.
  const L = 140;
  const lights = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.3, 0.12), basic(0xffffff, { toneMapped: false }), L);
  const m4 = new THREE.Matrix4();
  const lightCol = new THREE.Color();
  for (let i = 0; i < L; i++) {
    lights.setMatrixAt(i, m4.makeTranslation(-34 + (i % 35) * 2, 4 + Math.floor(i / 35) * 2.2, 39.25));
    lights.setColorAt(i, lightCol.set(rnd() > 0.5 ? 0xf472b6 : 0x22c55e));
  }
  root.add(lights);
  for (let k = 0; k < 4; k++) box(root, 72, 1.8, 0.25, dark, 0, 4 + k * 2.2, 39.5);
  const arcs = tops.map(() => makeArc(root, 0xf9a8d4, 0.08));
  const pairs: [number, number][] = [[0, 1], [1, 2], [2, 3], [4, 5], [5, 6], [6, 7]];
  particles(ctx, { count: 260, size: 0.22, color: 0xf9a8d4, opacity: 0.9, half: [39, 39], y: [0, 20], mode: 'fall', speed: 1.5, sway: 0.2 });
  let arcT = 0, flash = 0, blinkT = 0;
  ctx.on((dt, t) => {
    screens.forEach((s, i) => { s.offset.x += dt * (0.05 + i * 0.02); });
    arcT -= dt;
    if (arcT < 0) {
      arcT = 0.05 + rnd() * 0.07;
      arcs.forEach((a, i) => {
        const p = pairs[i];
        const on = !!p && rnd() > 0.4;
        a.visible(on);
        if (on) {
          if (rnd() > 0.85) { a.set(tops[p[0]], tops[p[0]].clone().setY(21.8).add(new THREE.Vector3(0, 0, (rnd() - 0.5) * 8)), 2.5); }
          else a.set(tops[p[0]], tops[p[1]], 5);
          if (rnd() > 0.9) flash = 1;
        }
      });
    }
    flash = Math.max(0, flash - dt * 6);
    ctx.hemi.intensity = 0.6 + flash * 0.9;
    blinkT -= dt;
    if (blinkT < 0) {
      blinkT = 0.15;
      for (let k = 0; k < 10; k++) { const i = Math.floor(rnd() * L); lights.setColorAt(i, lightCol.set(rnd() > 0.7 ? 0x111111 : rnd() > 0.5 ? 0xf472b6 : 0x22c55e)); }
      lights.instanceColor!.needsUpdate = true;
    }
    void t;
  });
}

function buildHangar(ctx: Ctx) {
  const { root, rnd } = ctx;
  const steel = std(0x2a2d33, 0.85, 0.4);
  const dark = std(0x121317, 0.8, 0.45);
  const red = basic(0xff2a4a, { toneMapped: false });
  mesh(root, new THREE.PlaneGeometry(82, 82), std(0x0c0d10, 0.6, 0.7), 0, 40, 0, Math.PI / 2);
  // Heavy roof trusses.
  for (let z = -36; z <= 36; z += 9) {
    box(root, 80, 2.2, 1.6, steel, 0, 38.4, z);
    for (let x = -36; x <= 36; x += 6) box(root, 0.4, 3.4, 0.4, steel, x, 36.4, z, 0, 0, (x / 6) % 2 ? 0.6 : -0.6);
    box(root, 80, 0.8, 1, steel, 0, 34.8, z);
  }
  for (const x of [-30, -10, 10, 30]) box(root, 1.4, 1.6, 80, steel, x, 39.2, 0);
  // Giant blast door on the north wall, cracked open with red light leaking.
  const chev = canvasTex(256, 512, (c) => {
    c.fillStyle = '#26282e'; c.fillRect(0, 0, 256, 512);
    c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = 4;
    for (let y = 0; y < 512; y += 64) { c.beginPath(); c.moveTo(0, y); c.lineTo(256, y); c.stroke(); }
    c.fillStyle = '#eab308';
    for (let y = 380; y < 512; y += 44) { c.beginPath(); c.moveTo(0, y); c.lineTo(128, y + 28); c.lineTo(256, y); c.lineTo(256, y + 18); c.lineTo(128, y + 46); c.lineTo(0, y + 18); c.fill(); }
    c.fillStyle = 'rgba(255,255,255,0.75)'; c.textAlign = 'center'; c.font = 'bold 44px monospace'; c.fillText('ARCHON', 128, 120); c.font = 'bold 22px monospace'; c.fillText('BAY-12 // SEALED', 128, 162);
  });
  const doorMat = std(0xffffff, 0.7, 0.45, { map: chev });
  for (const s of [-1, 1]) {
    box(root, 36, 26, 1.6, doorMat, s * 18.9, 13, -38.6);
    for (let k = 0; k < 3; k++) mesh(root, new THREE.CylinderGeometry(0.7, 0.7, 10, 12), steel, s * 34, 6 + k * 7, -37.6, 0, 0, Math.PI / 2);
  }
  box(root, 1.2, 26, 0.4, additive(0xff2a4a, 0.9), 0, 13, -39.1);
  beam(root, new THREE.Vector3(0, 13, -39), new THREE.Vector3(0, 0, -14), 2, 6, 0xff2a4a, 0.12);
  glowSprite(root, 0xff2a4a, 18, 0.45, 0, 13, -38.4);
  box(root, 80, 4, 2.4, dark, 0, 28, -38.6);
  // Catwalk ledges with railings along the side walls.
  for (const s of [-1, 1]) {
    box(root, 3, 0.4, 80, steel, s * 38.4, 14, 0);
    box(root, 0.12, 0.12, 80, red, s * 36.9, 15.2, 0);
    for (let z = -38; z <= 38; z += 4) box(root, 0.12, 1.2, 0.12, steel, s * 36.9, 14.6, z);
  }
  // Docking clamp arms reaching over the arena edges.
  for (const s of [-1, 1]) for (const z of [-20, 8, 30]) {
    const g = new THREE.Group(); g.position.set(s * 39, 26, z); g.rotation.y = s > 0 ? Math.PI : 0; root.add(g);
    box(g, 3, 5, 5, dark, 0, 0, 0);
    box(g, 9, 1.8, 2.4, steel, 5, -1.2, 0, 0, 0, -0.25);
    box(g, 6, 1.4, 2, steel, 10.5, -3.6, 0, 0, 0, -0.6);
    box(g, 1.2, 3, 3.4, std(0x7f1d1d, 0.6, 0.5), 13, -5.6, 0);
    mesh(g, new THREE.SphereGeometry(0.3, 8, 6), red, 1.6, 1.5, 2.6);
  }
  // Rotating alarm beacons.
  const beacons = [[-WALL, -28], [-WALL, 0], [-WALL, 28], [WALL, -28], [WALL, 0], [WALL, 28]].map(([x, z]) => {
    mesh(root, new THREE.SphereGeometry(0.7, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), additive(0xff2a4a, 0.95), x, 22, z, 0, 0, x < 0 ? -Math.PI / 2 : Math.PI / 2);
    const p = pivotBeam(root, 26, 0.4, 5, 0xff2a4a, 0.14); p.position.set(x, 22, z);
    return { p, side: Math.sign(x) };
  });
  // Hanging chains.
  const chain = std(0x1c1c20, 0.85, 0.5);
  for (let i = 0; i < 10; i++) {
    const l = 6 + rnd() * 14;
    box(root, 0.18, l, 0.18, chain, (rnd() * 2 - 1) * 30, 38 - l / 2, (rnd() * 2 - 1) * 30);
  }
  particles(ctx, { count: 380, size: 0.2, color: 0xff6a6a, opacity: 0.8, half: [39, 39], y: [0, 34], mode: 'fall', speed: 1.1, sway: 0.5 });
  ctx.on((_dt, t) => {
    beacons.forEach(({ p, side }, i) => { p.rotation.set(0, 0, 0); p.rotateZ(-side * Math.PI / 2); p.rotateX(t * 2.4 + i); });
    const strobe = Math.max(0, Math.sin(t * 2.4)) ** 4;
    ctx.hemi.intensity = 0.5 + strobe * 0.35;
  });
}

// ───────────────────────────── added stages (SEC-02/04/06/09/11/13/16/18/20) ─────────────────────────────

/** Y rotation that turns a plane's front (+Z) toward the arena centre. */
const faceCenter = (x: number, z: number) => Math.atan2(-x, -z);

/** Pointed-arch outline (no base line) as a tube-ready point list in the local XY plane. */
function lancetArchPoints(w: number, h: number) {
  const spring = h - w * 0.95;
  const pts: THREE.Vector3[] = [new THREE.Vector3(-w / 2, 0, 0)];
  const half = (sx: number) => {
    const p0 = new THREE.Vector2(sx * w / 2, spring), p1 = new THREE.Vector2(sx * w / 2, spring + w * 0.7), p2 = new THREE.Vector2(0, h);
    const out: THREE.Vector3[] = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10, u = 1 - t;
      out.push(new THREE.Vector3(u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x, u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y, 0));
    }
    return out;
  };
  pts.push(...half(-1), ...half(1).reverse().slice(1), new THREE.Vector3(w / 2, 0, 0));
  return pts;
}

function bellGeometry(r: number) {
  const prof: [number, number][] = [[0, 1.0], [0.38, 0.98], [0.52, 0.86], [0.56, 0.62], [0.62, 0.36], [0.8, 0.12], [1.0, 0], [0.94, -0.04]];
  return new THREE.LatheGeometry(prof.map(([x, y]) => new THREE.Vector2(x * r, y * r * 1.25)), 28);
}

function stripedTexture(a: string, b: string, stripes = 6) {
  return canvasTex(128, 64, (c) => {
    for (let i = 0; i < stripes; i++) { c.fillStyle = i % 2 ? b : a; c.fillRect((i * 128) / stripes, 0, 128 / stripes + 1, 64); }
    c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(0, 52, 128, 12);
  });
}

function hazardTexture() {
  const t = canvasTex(512, 64, (c) => {
    c.fillStyle = '#111'; c.fillRect(0, 0, 512, 64); c.fillStyle = '#f59e0b';
    for (let x = -64; x < 512; x += 48) { c.beginPath(); c.moveTo(x, 64); c.lineTo(x + 24, 64); c.lineTo(x + 88, 0); c.lineTo(x + 64, 0); c.fill(); }
  });
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

export function waterTexture(rnd: () => number, deep: string, light: string) {
  const t = canvasTex(128, 512, (c) => {
    c.fillStyle = deep; c.fillRect(0, 0, 128, 512);
    for (let i = 0; i < 120; i++) {
      const x = rnd() * 128, y = rnd() * 512, l = 20 + rnd() * 80;
      c.strokeStyle = light; c.globalAlpha = 0.2 + rnd() * 0.6; c.lineWidth = 1 + rnd() * 3;
      for (const oy of [-512, 0, 512]) { c.beginPath(); c.moveTo(x, y + oy); c.lineTo(x + (rnd() - 0.5) * 6, y + l + oy); c.stroke(); }
    }
    c.globalAlpha = 1;
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function glyphTexture(rnd: () => number, color: string) {
  const t = canvasTex(128, 1024, (c) => {
    c.fillStyle = '#000'; c.fillRect(0, 0, 128, 1024);
    const chars = 'アイウエオカキクケコサシスセソタチツテトナニヌネノ0123456789ABCDEF<>/#';
    c.font = 'bold 22px monospace'; c.textAlign = 'center'; c.shadowColor = color; c.shadowBlur = 8;
    for (let col = 0; col < 4; col++) for (let y = 0; y < 1024; y += 26) {
      if (rnd() < 0.3) continue;
      c.fillStyle = rnd() > 0.9 ? '#ffffff' : color;
      c.globalAlpha = 0.35 + rnd() * 0.65;
      c.fillText(chars[Math.floor(rnd() * chars.length)], 16 + col * 32, y);
    }
    c.globalAlpha = 1;
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// SEC-02 ネオン闇市街: crammed tenements, neon kanji, lantern strings across the sky, stall awnings.
function buildMarket(ctx: Ctx) {
  const { root, rnd } = ctx;
  const dark = std(0x141019, 0.4, 0.8);
  const words = ['闇市', '電脳部品', '義体修理', '両替', '拉麺', '薬', '酒場', '質屋', '電脳', '修理', '屋台'];
  const cols = ['#f472b6', '#22d3ee', '#facc15', '#a78bfa', '#4ade80', '#fb7185'];
  const signs: THREE.MeshBasicMaterial[] = [];
  const blinkers: THREE.Sprite[] = [];
  for (let i = 0; i < 44; i++) {
    const a = (i / 44) * Math.PI * 2 + rnd() * 0.08;
    const r = 50 + rnd() * 26;
    const w = 7 + rnd() * 9, d = 8 + rnd() * 8, h = 18 + rnd() * 40;
    const tex = windowsTexture(rnd, ['#1c1626', '#221a2c', '#181c28'][i % 3], [['#ff9ad5', 0.07], ['#67e8f9', 0.05], ['#ffcf8a', 0.06]]);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(Math.max(1, Math.round(w / 2.2)) / 8, Math.max(1, Math.round(h / 3)) / 16);
    const mat = std(0x9a90a8, 0.2, 0.85, { map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 1.2 });
    const cx = Math.cos(a), cz = Math.sin(a);
    box(root, w, h, d, mat, cx * r, h / 2, cz * r, 0, -a + Math.PI / 2, 0);
    const ry = faceCenter(cx, cz);
    const fr = r - d / 2 - 0.45;
    // AC units clinging to the facade
    for (let k = 0; k < 4; k++) {
      const off = (rnd() - 0.5) * w * 0.8, y = 4 + rnd() * (h - 6);
      box(root, 1.4, 1, 0.9, dark, cx * fr - cz * off, y, cz * fr + cx * off, 0, ry, 0);
    }
    if (i % 2 === 0) {
      const col = cols[Math.floor(rnd() * cols.length)];
      const tex2 = neonSignTexture(words[Math.floor(rnd() * words.length)], col, rnd() > 0.35);
      const img = tex2.image as HTMLCanvasElement;
      const sm = basic(0xffffff, { map: tex2, transparent: true, toneMapped: false, side: THREE.DoubleSide });
      signs.push(sm);
      const sc = 2.2 + rnd() * 0.8;
      const sy = 8 + rnd() * Math.max(2, h - 20);
      const sr = fr - 0.6;
      mesh(root, new THREE.PlaneGeometry((img.width / 100) * sc, (img.height / 100) * sc), sm, cx * sr, sy, cz * sr, 0, ry, 0);
      glowSprite(root, new THREE.Color(col).getHex(), (img.height / 100) * sc * 1.3, 0.22, cx * (sr - 1.2), sy, cz * (sr - 1.2));
    }
    if (rnd() > 0.72) {
      box(root, 0.25, 8, 0.25, dark, cx * r, h + 4, cz * r);
      blinkers.push(glowSprite(root, 0xff2a6a, 3, 0.9, cx * r, h + 8.2, cz * r));
    }
  }
  // Striped stall awnings sloping away over the wall tops, with bare bulbs along the edge.
  const tarps = [stripedTexture('#be185d', '#1f2937'), stripedTexture('#0e7490', '#e5e7eb'), stripedTexture('#a16207', '#1f2937')].map((t) => std(0xffffff, 0, 0.9, { map: t, side: THREE.DoubleSide }));
  const bulbs: THREE.Sprite[] = [];
  for (let k = 0; k < 4; k++) {
    const g = new THREE.Group(); g.rotation.y = (k * Math.PI) / 2; root.add(g);
    for (let f = -36; f <= 36; f += 8) {
      box(g, 7.4, 0.08, 3.4, tarps[Math.floor(rnd() * tarps.length)], f, 4.9, -41.6, -0.3);
      box(g, 0.12, 5, 0.12, dark, f - 3.5, 2.5, -43.1);
      box(g, 0.12, 5, 0.12, dark, f + 3.5, 2.5, -43.1);
      for (const bx of [-2.4, 0, 2.4]) bulbs.push(glowSprite(g, 0xffd08a, 1.1, 0.9, f + bx, 4.5, -40.4));
    }
  }
  // Paper lantern strings criss-crossing overhead.
  const cord = std(0x111111, 0.2, 0.9);
  const lanternGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.72, 10);
  const lanternCols = [0xff3b3b, 0xff8a3d, 0xff4fa3];
  const lanternMats = lanternCols.map((c) => basic(c, { toneMapped: false }));
  const strings: THREE.Group[] = [];
  for (let i = 0; i < 6; i++) {
    const g = new THREE.Group(); root.add(g); strings.push(g);
    const f = -30 + i * 12;
    const along = i % 2 === 0;
    const a = along ? new THREE.Vector3(f, 11, -40) : new THREE.Vector3(-40, 10.5, f);
    const b = along ? new THREE.Vector3(f + (rnd() - 0.5) * 12, 11, 40) : new THREE.Vector3(40, 10.5, f + (rnd() - 0.5) * 12);
    const curve = catenary(a, b, 3);
    mesh(g, new THREE.TubeGeometry(curve, 40, 0.035, 4), cord);
    for (let k = 1; k < 12; k++) {
      const p = curve.getPoint(k / 12);
      mesh(g, lanternGeo, lanternMats[k % 3], p.x, p.y - 0.5, p.z);
      glowSprite(g, lanternCols[k % 3], 2.4, 0.45, p.x, p.y - 0.5, p.z);
    }
  }
  // Giant hologram advert floating above the north rooftops.
  const holoTex = canvasTex(512, 256, (c) => {
    const g = c.createLinearGradient(0, 0, 512, 256); g.addColorStop(0, '#ec4899'); g.addColorStop(1, '#22d3ee');
    c.fillStyle = 'rgba(0,0,0,0)'; c.fillRect(0, 0, 512, 256);
    c.strokeStyle = g; c.lineWidth = 6; c.strokeRect(10, 10, 492, 236);
    c.fillStyle = g; c.font = 'bold 110px "Noto Sans JP", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.shadowColor = '#f472b6'; c.shadowBlur = 24; c.fillText('合成麺', 256, 110);
    c.font = 'bold 34px monospace'; c.fillText('SYNTH-RAMEN 24H', 256, 200);
    c.fillStyle = 'rgba(0,0,0,0.35)'; for (let y = 0; y < 256; y += 4) c.fillRect(0, y, 512, 1);
  });
  const holoMat = additive(0xffffff, 0.75, { map: holoTex, side: THREE.DoubleSide, fog: false });
  const holo = mesh(root, new THREE.PlaneGeometry(30, 15), holoMat, 0, 34, -62);
  const holoRing = mesh(root, new THREE.TorusGeometry(12, 0.15, 6, 64), additive(0x22d3ee, 0.6, { fog: false }), 0, 25, -62, Math.PI / 2);
  particles(ctx, { count: 160, size: 1.8, color: 0xe2d6f0, opacity: 0.07, half: [44, 44], y: [3, 16], mode: 'rise', speed: 1.0, sway: 0.6 });
  particles(ctx, { count: 220, size: 0.22, color: 0xf9a8d4, opacity: 0.8, half: [38, 38], y: [0.5, 14], mode: 'drift', speed: 0.5, sway: 0.4 });
  ctx.on((_dt, t) => {
    signs.forEach((m, i) => { m.opacity = Math.sin(t * 9 + i * 7) > -0.93 || i % 3 ? 1 : 0.2; });
    blinkers.forEach((b, i) => { (b.material as THREE.SpriteMaterial).opacity = Math.sin(t * 2.2 + i) > 0.5 ? 0.95 : 0.1; });
    bulbs.forEach((b, i) => { if (i % 11 === 0) (b.material as THREE.SpriteMaterial).opacity = Math.sin(t * 19 + i) > -0.7 ? 0.9 : 0.15; });
    strings.forEach((g, i) => { g.rotation.z = Math.sin(t * 0.8 + i) * 0.004; g.position.y = Math.sin(t * 1.1 + i * 2) * 0.12; });
    holoMat.opacity = 0.62 + Math.sin(t * 3) * 0.08 + (Math.sin(t * 31) > 0.96 ? -0.4 : 0);
    holo.position.y = 34 + Math.sin(t * 0.6) * 0.6;
    holoRing.rotation.z = t * 0.4;
  });
}

// SEC-04 旧帝都アクアダクト: flattened stone vault, ribbed arches, culverts pouring into channels.
function buildAqueduct(ctx: Ctx) {
  const { root, rnd } = ctx;
  const H = 14, R = 40, SQ = 0.4;
  const stone = std(0x3a4a48, 0.05, 0.9);
  const vaultMat = std(0x26332f, 0.05, 0.95, { side: THREE.DoubleSide });
  const iron = std(0x1f2a2a, 0.8, 0.5);
  const vault = mesh(root, new THREE.CylinderGeometry(R, R, 82, 40, 1, true, Math.PI / 2, Math.PI), vaultMat, 0, H, 0, Math.PI / 2);
  vault.scale.set(1, 1, SQ);
  for (let z = -36; z <= 36; z += 9) {
    const rib = mesh(root, new THREE.TorusGeometry(R - 0.4, 0.7, 6, 40, Math.PI), stone, 0, H, z);
    rib.scale.set(1, SQ, 1);
    for (const s of [-1, 1]) box(root, 0.6, H, 1.8, stone, s * 39.1, H / 2, z);
  }
  // Water channels along the east and west walls.
  const wt = waterTexture(rnd, '#0b3a3a', '#99f6e4');
  const chanTex = wt.clone(); chanTex.repeat.set(1, 8);
  const chanMat = basic(0xffffff, { map: chanTex, toneMapped: false, transparent: true, opacity: 0.85 });
  for (const s of [-1, 1]) {
    mesh(root, new THREE.PlaneGeometry(1.6, 78), chanMat, s * 38.4, 0.04, 0, -Math.PI / 2);
    box(root, 0.3, 0.35, 78, stone, s * 37.45, 0.17, 0);
  }
  // Culverts on the north and south walls pouring water into the channels.
  const fallMat = additive(0xffffff, 0.75, { map: wt, side: THREE.DoubleSide });
  const splashes: THREE.Sprite[] = [];
  for (const s of [-1, 1]) for (const x of [-24, 0, 24]) {
    const z = s * (WALL - 0.05), ry = s < 0 ? 0 : Math.PI;
    mesh(root, new THREE.CircleGeometry(2.1, 32), basic(0x020606), x, 7, z, 0, ry, 0);
    mesh(root, new THREE.TorusGeometry(2.3, 0.4, 8, 32), stone, x, 7, z, 0, ry, 0);
    for (let k = -2; k <= 2; k++) box(root, 0.14, 4, 0.14, iron, x + k * 0.8, 7, z - s * 0.1);
    mesh(root, new THREE.PlaneGeometry(2.6, 6), fallMat, x, 3.6, z - s * 0.6, -s * 0.12, ry, 0);
    splashes.push(glowSprite(root, 0x5eead4, 6, 0.3, x, 0.6, z - s * 1.2));
    mesh(root, new THREE.PlaneGeometry(3.2, 1.6), chanMat, x, 0.04, z - s * 1.1, -Math.PI / 2);
  }
  // Oil lamps hanging from the vault.
  const lamps: THREE.Group[] = [];
  for (const x of [-22, 0, 22]) for (const z of [-27, 0, 27]) {
    const top = H + SQ * Math.sqrt(R * R - x * x) - 0.5;
    const g = new THREE.Group(); g.position.set(x, top, z); root.add(g); lamps.push(g);
    const len = top - 17;
    box(g, 0.08, len, 0.08, iron, 0, -len / 2, 0);
    mesh(g, new THREE.CylinderGeometry(0.5, 0.35, 0.9, 6, 1, true), std(0x5a4520, 0.8, 0.4, { side: THREE.DoubleSide }), 0, -len - 0.45, 0);
    glowSprite(g, 0xffb35c, 3.2, 0.85, 0, -len - 0.5, 0);
    glowSprite(g, 0xff9a3c, 12, 0.18, 0, -len - 0.5, 0);
  }
  // Moss glow patches on the wall tops.
  for (let i = 0; i < 30; i++) {
    const side = i % 4, f = (rnd() * 2 - 1) * 36;
    const x = side < 2 ? f : side === 2 ? 39.2 : -39.2, z = side === 0 ? -39.2 : side === 1 ? 39.2 : f;
    glowSprite(root, 0x2dd4bf, 2 + rnd() * 3, 0.2, x, 9 + rnd() * 5, z);
  }
  particles(ctx, { count: 400, size: 0.1, color: 0x99f6e4, opacity: 0.8, half: [38, 38], y: [0.2, 26], mode: 'fall', speed: 6, sway: 0.05 });
  particles(ctx, { count: 140, size: 3, color: 0x5eead4, opacity: 0.05, half: [38, 38], y: [0, 3], mode: 'drift', speed: 0.3, sway: 0.5 });
  ctx.on((dt, t) => {
    wt.offset.y += dt * 1.4;
    chanTex.offset.y += dt * 0.5;
    lamps.forEach((g, i) => { g.rotation.z = Math.sin(t * 0.7 + i) * 0.03; g.rotation.x = Math.cos(t * 0.5 + i * 2) * 0.03; });
    splashes.forEach((s, i) => { (s.material as THREE.SpriteMaterial).opacity = 0.25 + Math.sin(t * 9 + i * 3) * 0.08; });
    ctx.hemi.intensity = 0.6 + Math.sin(t * 1.3) * 0.05;
  });
}

// SEC-06 鐘楼回廊: gothic arcade on the wall tops, bell towers with swinging bells, dusk sky and crows.
function buildBelfry(ctx: Ctx) {
  const { root, rnd } = ctx;
  const stone = std(0x6b5f74, 0.05, 0.85);
  const stoneDark = std(0x3c3442, 0.05, 0.9);
  const roof = std(0x2a2433, 0.3, 0.7);
  const gold = std(0xd4a017, 0.9, 0.3, { emissive: 0x4a3200, emissiveIntensity: 0.4 });
  const bronze = std(0xa87132, 0.9, 0.35, { side: THREE.DoubleSide });
  // Arcade of pointed arches standing on all four wall tops.
  const colGeo = new THREE.CylinderGeometry(0.35, 0.4, 7, 8);
  const archGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(lancetArchPoints(5, 7)), 40, 0.22, 6);
  for (let k = 0; k < 4; k++) {
    const g = new THREE.Group(); g.rotation.y = (k * Math.PI) / 2; root.add(g);
    for (let f = -40; f <= 40; f += 5) {
      mesh(g, colGeo, stone, f, 6.5, -40.2);
      box(g, 0.9, 0.5, 0.9, stoneDark, f, 10.1, -40.2);
      if (f < 40) mesh(g, archGeo, stone, f + 2.5, 3, -40.2);
    }
    box(g, 82, 0.9, 1.4, stoneDark, 0, 10.8, -40.4);
    box(g, 84, 0.35, 7, roof, 0, 11.6, -43.6, -0.22);
  }
  // Corner bell towers with open bell chambers.
  const swing: { pivot: THREE.Group; speed: number; amp: number; phase: number }[] = [];
  const bellTower = (x: number, z: number, w: number, base: number, ch: number, bellR: number, spire: number) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); root.add(g);
    box(g, w, base, w, stone, 0, base / 2, 0);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(g, w * 0.16, ch, w * 0.16, stone, sx * w * 0.42, base + ch / 2, sz * w * 0.42);
    box(g, w * 1.08, 1, w * 1.08, stoneDark, 0, base + ch + 0.5, 0);
    box(g, w * 1.08, 0.6, w * 1.08, stoneDark, 0, base + 0.3, 0);
    mesh(g, new THREE.ConeGeometry(w * 0.68, spire, 4), roof, 0, base + ch + 1 + spire / 2, 0, 0, Math.PI / 4, 0);
    box(g, 0.25, spire * 0.25, 0.25, gold, 0, base + ch + 1 + spire + spire * 0.12, 0);
    box(g, spire * 0.12, 0.25, 0.25, gold, 0, base + ch + 1 + spire + spire * 0.16, 0);
    const pivot = new THREE.Group(); pivot.position.set(0, base + ch - 0.6, 0); g.add(pivot);
    box(pivot, 0.4, 0.8, 0.4, std(0x1c1917, 0.8, 0.5), 0, -0.4, 0);
    mesh(pivot, bellGeometry(bellR), bronze, 0, -0.8 - bellR * 1.25, 0);
    mesh(pivot, new THREE.SphereGeometry(bellR * 0.18, 10, 8), bronze, 0, -0.8 - bellR * 1.2, 0);
    glowSprite(g, 0xffc46b, w * 1.6, 0.18, 0, base + ch * 0.4, 0);
    swing.push({ pivot, speed: 0.9 + rnd() * 0.8, amp: 0.25 + rnd() * 0.2, phase: rnd() * 6 });
  };
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) bellTower(sx * 50, sz * 50, 8, 22, 8, 1.6, 12);
  bellTower(0, -82, 18, 46, 18, 5, 34);
  bellTower(-58, -96, 9, 30, 9, 2, 14);
  bellTower(60, -92, 9, 34, 9, 2, 16);
  // Rooftops of the monastery town below.
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2 + rnd() * 0.2, r = 70 + rnd() * 40;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (z < -70 && Math.abs(x) < 70) continue;
    gothicTower(root, stoneDark, 6 + rnd() * 6, 10 + rnd() * 20, 8 + rnd() * 10, x, z);
  }
  // Pale moon opposite the setting sun.
  glowSprite(root, 0xf5f3ff, 10, 0.95, 70, 75, 95);
  glowSprite(root, 0xc4b5fd, 46, 0.18, 70, 75, 95);
  // Crows circling the great belfry.
  const crowTex = canvasTex(64, 32, (c) => {
    c.strokeStyle = '#fff'; c.lineWidth = 5; c.lineCap = 'round';
    c.beginPath(); c.moveTo(4, 8); c.quadraticCurveTo(18, 6, 32, 20); c.quadraticCurveTo(46, 6, 60, 8); c.stroke();
  });
  const crowMat = new THREE.SpriteMaterial({ map: crowTex, color: 0x0b0910, transparent: true, depthWrite: false });
  const crows = Array.from({ length: 16 }, (_, i) => {
    const s = new THREE.Sprite(crowMat); s.scale.set(1.6, 0.8, 1); root.add(s);
    return { s, r: 16 + rnd() * 22, y: 44 + rnd() * 24, sp: (0.18 + rnd() * 0.2) * (i % 3 === 0 ? -1 : 1), ph: rnd() * 6.28 };
  });
  particles(ctx, { count: 260, size: 0.2, color: 0xfbbf24, opacity: 0.7, half: [40, 40], y: [0.5, 20], mode: 'drift', speed: 0.4, sway: 0.5 });
  particles(ctx, { count: 120, size: 0.3, color: 0xd8b4fe, opacity: 0.6, half: [40, 40], y: [0.5, 20], mode: 'fall', speed: 0.5, sway: 0.8 });
  ctx.on((_dt, t) => {
    swing.forEach((b) => { b.pivot.rotation.z = Math.sin(t * b.speed + b.phase) * b.amp; });
    crows.forEach((c) => {
      const a = c.ph + t * c.sp;
      c.s.position.set(Math.cos(a) * c.r, c.y + Math.sin(t * 0.5 + c.ph) * 2, -82 + Math.sin(a) * c.r);
      c.s.scale.y = 0.8 * (0.55 + 0.45 * Math.abs(Math.sin(t * 7 + c.ph)));
    });
  });
}

// SEC-09 成層圏スカイブリッジ: suspension bridge deck, giant pylons and cables, far bridges and an airship.
function buildSkybridge(ctx: Ctx) {
  const { root, rnd } = ctx;
  const deck = std(0x5a6478, 0.6, 0.5);
  const steel = std(0xdde3ec, 0.8, 0.3);
  const steelDark = std(0x5b6474, 0.8, 0.4);
  const cyan = basic(0x38bdf8, { toneMapped: false });
  const white = basic(0xf8fafc, { toneMapped: false });
  // Deck running far beyond the arena in both directions, with under-deck trusses.
  box(root, 96, 2.4, 330, deck, 0, -1.25, 0);
  for (const s of [-1, 1]) box(root, 0.35, 0.25, 330, cyan, s * 48, -0.08, 0);
  for (let z = -160; z <= 160; z += 8) {
    if (Math.abs(z) < 44) continue;
    for (const x of [-14, 14]) box(root, 0.4, 0.06, 4, white, x, 0.02, z);
  }
  for (let z = -156; z <= 156; z += 12) {
    box(root, 96, 0.8, 0.8, steelDark, 0, -4.2, z);
    for (const s of [-1, 1]) box(root, 0.6, 8.5, 0.6, steelDark, s * 30, -5.5, z + 6, s * 0.9);
  }
  box(root, 2, 2, 330, steelDark, -30, -8, 0); box(root, 2, 2, 330, steelDark, 30, -8, 0);
  // Pylons and suspension cables (outside the walls at x = ±48).
  const blink: THREE.Sprite[] = [];
  const PX = 48, PY = 96, PZ = 74, SAG = 84;
  for (const s of [-1, 1]) {
    const z = s * PZ;
    for (const x of [-PX, PX]) {
      box(root, 4.5, 190, 4.5, steel, x, 0, z);
      blink.push(glowSprite(root, 0xff2a2a, 5, 0.9, x, PY + 2, z));
    }
    for (const y of [PY - 2, 62, -10]) box(root, 2 * PX + 4, 3.2, 3.2, steel, 0, y, z);
  }
  const suspenderGeo = new THREE.BoxGeometry(0.16, 1, 0.16);
  for (const x of [-PX, PX]) {
    const main = catenary(new THREE.Vector3(x, PY, -PZ), new THREE.Vector3(x, PY, PZ), SAG);
    mesh(root, new THREE.TubeGeometry(main, 80, 0.55, 8), steel);
    for (const s of [-1, 1]) mesh(root, new THREE.TubeGeometry(catenary(new THREE.Vector3(x, PY, s * PZ), new THREE.Vector3(x, 1, s * 170), 8), 30, 0.5, 8), steel);
    for (let z = -PZ + 6; z <= PZ - 6; z += 6) {
      const f = (z + PZ) / (2 * PZ);
      const y = PY - Math.sin(Math.PI * f) * SAG;
      const m = mesh(root, suspenderGeo, steel, x, y / 2, z);
      m.scale.y = y;
    }
  }
  // Distant bridges and towers piercing the cloud sea.
  for (let i = 0; i < 4; i++) {
    const a = rnd() * Math.PI * 2;
    const g = new THREE.Group(); g.position.set(Math.cos(a) * 125, -12 - rnd() * 20, Math.sin(a) * 125); g.rotation.y = rnd() * Math.PI; root.add(g);
    box(g, 14, 2, 260, steelDark, 0, 0, 0);
    for (const z of [-60, 60]) for (const x of [-9, 9]) box(g, 2.5, 120, 2.5, steel, x, 30, z);
  }
  for (let i = 0; i < 6; i++) {
    const a = rnd() * Math.PI * 2, r = 110 + rnd() * 25;
    const h = 50 + rnd() * 70;
    mesh(root, new THREE.CylinderGeometry(2, 5, h + 60, 8), steel, Math.cos(a) * r, h / 2 - 30, Math.sin(a) * r);
    mesh(root, new THREE.TorusGeometry(6, 0.4, 6, 24), cyan, Math.cos(a) * r, h - 10, Math.sin(a) * r, Math.PI / 2);
    blink.push(glowSprite(root, 0xff2a2a, 4, 0.9, Math.cos(a) * r, h + 1, Math.sin(a) * r));
  }
  // Airship drifting across the northern sky.
  const ship = new THREE.Group(); root.add(ship);
  const hull = mesh(ship, new THREE.SphereGeometry(1, 24, 16), std(0xcbd5e1, 0.4, 0.5), 0, 0, 0);
  hull.scale.set(26, 6.5, 6.5);
  box(ship, 9, 2.2, 3, steelDark, 0, -7, 0);
  box(ship, 9.2, 0.4, 3.2, cyan, 0, -6.2, 0);
  for (const s of [-1, 1]) box(ship, 6, 0.4, 5, std(0x94a3b8, 0.4, 0.5), -23, 0, s * 4.5);
  box(ship, 6, 9, 0.4, std(0x94a3b8, 0.4, 0.5), -23, 0, 0);
  const shipLights = [glowSprite(ship, 0xff2a2a, 3, 0.9, 26, 0, 0), glowSprite(ship, 0x22ff88, 3, 0.9, -26, 2, 0)];
  // Wind streaks.
  const W = 180, wp = new Float32Array(W * 6);
  const wReset = (i: number) => { const x = -80 + rnd() * 20, y = -10 + rnd() * 40, z = (rnd() * 2 - 1) * 70, l = 4 + rnd() * 8; wp.set([x, y, z, x + l, y, z], i * 6); };
  for (let i = 0; i < W; i++) { wReset(i); const o = rnd() * 160; wp[i * 6] += o; wp[i * 6 + 3] += o; }
  const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.BufferAttribute(wp, 3));
  const wind = new THREE.LineSegments(wg, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25, depthWrite: false }));
  wind.frustumCulled = false; root.add(wind);
  ctx.on((dt, t) => {
    for (let i = 0; i < W; i++) {
      const k = i * 6, sp = 40 + (i % 7) * 6;
      wp[k] += sp * dt; wp[k + 3] += sp * dt;
      if (wp[k] > 90) wReset(i);
    }
    wg.attributes.position.needsUpdate = true;
    const sx = ((t * 2.5) % 260) - 130;
    ship.position.set(sx, 42 + Math.sin(t * 0.3) * 1.5, -105);
    shipLights.forEach((l, i) => { (l.material as THREE.SpriteMaterial).opacity = Math.sin(t * 3 + i * 1.5) > 0.3 ? 0.95 : 0.15; });
    blink.forEach((b, i) => { (b.material as THREE.SpriteMaterial).opacity = Math.sin(t * 2 + i * 0.7) > 0.4 ? 0.95 : 0.1; });
  });
}

// SEC-11 軌道送電リレー基地: orbital platform over the planet, solar wings, relay mast beaming into space.
function buildRelay(ctx: Ctx) {
  const { root, rnd } = ctx;
  const metal = std(0x9aa4b4, 0.85, 0.3);
  const dark = std(0x1a2030, 0.8, 0.4);
  const lime = basic(0xa3e635, { toneMapped: false });
  // Station hull beneath the deck.
  box(root, 88, 3, 88, dark, 0, -1.55, 0);
  mesh(root, new THREE.CylinderGeometry(34, 12, 44, 8), dark, 0, -25, 0);
  for (const [w, d, x, z] of [[88, 0.3, 0, -44], [88, 0.3, 0, 44], [0.3, 88, -44, 0], [0.3, 88, 44, 0]] as const) box(root, w, 0.25, d, lime, x, -0.3, z);
  // Solar wings to the east and west.
  const cellTex = canvasTex(256, 256, (c) => {
    c.fillStyle = '#0b1a3a'; c.fillRect(0, 0, 256, 256);
    c.strokeStyle = '#3b82f6'; c.lineWidth = 2;
    for (let i = 0; i <= 256; i += 32) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i, 256); c.moveTo(0, i); c.lineTo(256, i); c.stroke(); }
    const g = c.createLinearGradient(0, 0, 256, 256); g.addColorStop(0, 'rgba(255,255,255,0.25)'); g.addColorStop(0.5, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,0.1)');
    c.fillStyle = g; c.fillRect(0, 0, 256, 256);
  });
  cellTex.wrapS = cellTex.wrapT = THREE.RepeatWrapping; cellTex.repeat.set(3, 5);
  const cellMat = std(0xffffff, 0.6, 0.25, { map: cellTex, emissive: 0x0b2a6a, emissiveIntensity: 0.35 });
  for (const s of [-1, 1]) {
    box(root, 96, 1.2, 1.2, metal, s * 92, -2, 0);
    for (let k = 0; k < 5; k++) for (const z of [-17, 17]) box(root, 17, 0.3, 30, cellMat, s * (54 + k * 19), -2, z, 0, 0, s * 0.05);
  }
  // Dish antennas on masts.
  const dishGeo = new THREE.SphereGeometry(7, 28, 10, 0, Math.PI * 2, 0, 0.85);
  const dishMat = std(0xe2e8f0, 0.7, 0.35, { side: THREE.DoubleSide });
  const dishes = [[-62, -48], [62, -48], [-60, 52], [64, 56]].map(([x, z], i) => {
    mesh(root, new THREE.CylinderGeometry(0.8, 1.4, 16, 8), metal, x, 8 - 2, z);
    const yaw = new THREE.Group(); yaw.position.set(x, 15, z); root.add(yaw);
    const pitch = new THREE.Group(); pitch.rotation.x = -0.9; yaw.add(pitch);
    mesh(pitch, dishGeo, dishMat, 0, -6, 0);
    mesh(pitch, new THREE.CylinderGeometry(0.12, 0.12, 6, 6), metal, 0, -1.5, 0);
    glowSprite(pitch, 0xa3e635, 2.5, 0.9, 0, 1.4, 0);
    yaw.rotation.y = i * 1.4;
    return yaw;
  });
  // Relay mast to the north with a beam reaching into orbit.
  const mast = new THREE.Group(); mast.position.set(0, 0, -92); root.add(mast);
  const MH = 120;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const a = new THREE.Vector3(sx * 9, -20, sz * 9), b = new THREE.Vector3(sx * 2, MH, sz * 2);
    const dir = b.clone().sub(a);
    const leg = mesh(mast, new THREE.CylinderGeometry(0.6, 0.9, dir.length(), 6), metal);
    leg.position.copy(a).addScaledVector(dir, 0.5);
    leg.quaternion.setFromUnitVectors(_up, dir.normalize());
  }
  for (let y = 0; y < MH; y += 12) {
    const w = 9 - (y / MH) * 7;
    mesh(mast, new THREE.TorusGeometry(w * 1.25, 0.25, 6, 4), metal, 0, y, 0, Math.PI / 2, 0, Math.PI / 4);
  }
  mesh(mast, new THREE.SphereGeometry(3, 20, 14), basic(0xecfccb, { toneMapped: false }), 0, MH + 2, 0);
  glowSprite(mast, 0xa3e635, 30, 0.55, 0, MH + 2, 0);
  beam(root, new THREE.Vector3(0, MH + 2, -92), new THREE.Vector3(0, MH + 80, -92), 1.5, 5, 0xbef264, 0.45);
  const pulses = [0, 1, 2, 3].map(() => mesh(mast, new THREE.TorusGeometry(6, 0.3, 6, 32), additive(0xbef264, 0.8, { fog: false }), 0, 0, 0, Math.PI / 2));
  // Power conduits on the deck just outside the walls, with energy flowing through them.
  const flowTex = canvasTex(256, 32, (c) => {
    c.fillStyle = '#0a1405'; c.fillRect(0, 0, 256, 32);
    for (let x = 0; x < 256; x += 64) { const g = c.createLinearGradient(x, 0, x + 64, 0); g.addColorStop(0, 'rgba(163,230,53,0)'); g.addColorStop(0.8, 'rgba(217,249,157,1)'); g.addColorStop(1, 'rgba(163,230,53,0)'); c.fillStyle = g; c.fillRect(x, 6, 64, 20); }
  });
  flowTex.wrapS = THREE.RepeatWrapping; flowTex.repeat.set(12, 1);
  const flowMat = basic(0xffffff, { map: flowTex, toneMapped: false });
  for (const s of [-1, 1]) {
    mesh(root, new THREE.CylinderGeometry(0.7, 0.7, 86, 12), flowMat, s * 42.5, 1.2, 0, Math.PI / 2);
    mesh(root, new THREE.CylinderGeometry(0.7, 0.7, 86, 12), flowMat, 0, 1.2, s * 42.5, 0, 0, Math.PI / 2);
  }
  // Coil emitters at the south corners arcing to each other.
  const ends = [-1, 1].map((s) => {
    const g = new THREE.Group(); g.position.set(s * 46, 0, 46); root.add(g);
    mesh(g, new THREE.CylinderGeometry(0.6, 1.4, 14, 8), metal, 0, 7, 0);
    for (let k = 0; k < 3; k++) mesh(g, new THREE.TorusGeometry(1.6 - k * 0.3, 0.2, 6, 20), lime, 0, 9.5 + k * 1.4, 0, Math.PI / 2);
    glowSprite(g, 0xa3e635, 8, 0.6, 0, 14.5, 0);
    return new THREE.Vector3(s * 46, 14.5, 46);
  });
  const arc = makeArc(root, 0xbef264, 0.1);
  particles(ctx, { count: 240, size: 0.3, color: 0xd9f99d, opacity: 0.7, half: [40, 40], y: [0.5, 20], mode: 'drift', speed: 0.4, sway: 0.3 });
  let arcTimer = 0;
  ctx.on((dt, t) => {
    flowTex.offset.x -= dt * 0.8;
    dishes.forEach((d, i) => { d.rotation.y += dt * (0.05 + i * 0.02) * (i % 2 ? 1 : -1); });
    pulses.forEach((p, i) => {
      const f = ((t * 0.18 + i / pulses.length) % 1);
      p.position.y = f * MH;
      p.scale.setScalar(1.4 - f);
      (p.material as THREE.MeshBasicMaterial).opacity = 0.8 * (1 - f);
    });
    arcTimer -= dt;
    if (arcTimer < 0) { arcTimer = 0.08; const on = Math.sin(t * 1.7) > -0.2; arc.visible(on); if (on) arc.set(ends[0], ends[1], 9); }
  });
}

// SEC-13 天空重砲兵器廠: armoury hall, shell racks, a colossal cannon over the arena, conveyor and crane.
function buildArsenal(ctx: Ctx) {
  const { root, rnd } = ctx;
  const C = 24, R = 58;
  const steel = std(0x3a3d44, 0.85, 0.4);
  const dark = std(0x16181c, 0.7, 0.6);
  const brass = std(0xc8902a, 0.95, 0.28);
  const olive = std(0x4d5a32, 0.6, 0.5);
  const warm = basic(0xffe6c2, { toneMapped: false });
  // Outer hall: ceiling, walls and roof trusses with light strips.
  mesh(root, new THREE.PlaneGeometry(2 * R, 2 * R), dark, 0, C, 0, Math.PI / 2);
  for (const s of [-1, 1]) { box(root, 2 * R, C, 1, steel, 0, C / 2, s * R); box(root, 1, C, 2 * R, steel, s * R, C / 2, 0); }
  for (let x = -50; x <= 50; x += 10) { box(root, 0.8, 1.6, 2 * R - 2, steel, x, C - 0.8, 0); box(root, 0.5, 0.15, 2 * R - 4, warm, x, C - 1.7, 0); }
  // Shell racks beyond the east, west and south walls.
  const shelfYs = [2, 6.5, 11, 15.5, 20];
  const perShelf = 46;
  const n = 3 * 2 * shelfYs.length * perShelf;
  const bodies = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.55, 0.55, 3, 12), brass, n);
  const noses = new THREE.InstancedMesh(new THREE.ConeGeometry(0.55, 1.4, 12), olive, n);
  const m4 = new THREE.Matrix4();
  const hidden = new THREE.Matrix4().makeTranslation(0, -500, 0);
  let idx = 0;
  for (let k = 0; k < 3; k++) {
    const g = new THREE.Group(); g.rotation.y = [Math.PI / 2, -Math.PI / 2, Math.PI][k]; g.updateMatrix(); root.add(g);
    for (const z of [-45, -50]) for (const y of shelfYs) {
      box(g, 92, 0.3, 2.2, steel, 0, y, z);
      for (let i = 0; i < perShelf; i++) {
        const x = -45 + i * 2;
        if (rnd() < 0.12) { bodies.setMatrixAt(idx, hidden); noses.setMatrixAt(idx, hidden); idx++; continue; }
        m4.makeTranslation(x, y + 1.65, z).premultiply(g.matrix); bodies.setMatrixAt(idx, m4);
        m4.makeTranslation(x, y + 3.85, z).premultiply(g.matrix); noses.setMatrixAt(idx, m4);
        idx++;
      }
    }
    for (let x = -44; x <= 44; x += 11) box(g, 0.4, C - 2, 7, steel, x, (C - 2) / 2, -47.5);
  }
  root.add(bodies, noses);
  // Colossal cannon whose barrel reaches out over the arena from the north.
  const cannon = new THREE.Group(); cannon.position.set(0, 0, -50); root.add(cannon);
  box(cannon, 20, 16, 14, steel, 0, 8, -2);
  box(cannon, 22, 2, 16, std(0xf59e0b, 0.5, 0.5, { map: hazardTexture() }), 0, 16.5, -2);
  const barrel = new THREE.Group(); barrel.position.set(0, 16.5, 4); barrel.rotation.x = 1.47; cannon.add(barrel);
  mesh(barrel, new THREE.CylinderGeometry(2.4, 3.2, 44, 24), steel, 0, 22, 0);
  for (let k = 0; k < 5; k++) mesh(barrel, new THREE.TorusGeometry(2.7 + k * 0.08, 0.35, 8, 24), dark, 0, 6 + k * 8, 0, Math.PI / 2);
  box(barrel, 6, 3.4, 6, dark, 0, 44, 0);
  mesh(barrel, new THREE.CircleGeometry(1.6, 24), basic(0xff7a1a, { toneMapped: false }), 0, 45.75, 0, -Math.PI / 2);
  const muzzleGlow = glowSprite(barrel, 0xf97316, 10, 0.4, 0, 46, 0);
  // Overhead conveyor carrying shells across the hall.
  const hooks: THREE.Group[] = [];
  for (const z of [-22, 22]) {
    box(root, 2 * R, 0.6, 0.6, steel, 0, 21, z);
    for (let i = 0; i < 9; i++) {
      const h = new THREE.Group(); h.position.set(-R + i * 13, 21, z); root.add(h); hooks.push(h);
      box(h, 0.12, 2.2, 0.12, dark, 0, -1.1, 0);
      mesh(h, new THREE.CylinderGeometry(0.55, 0.55, 3, 12), brass, 0, -3.7, 0);
      mesh(h, new THREE.ConeGeometry(0.55, 1.4, 12), olive, 0, -5.9, 0, Math.PI);
    }
  }
  // Gantry crane travelling north–south.
  const crane = new THREE.Group(); root.add(crane);
  box(crane, 2 * R - 2, 1.6, 2.2, std(0xf59e0b, 0.6, 0.45), 0, 18, 0);
  box(crane, 3, 1.6, 3, dark, 8, 16.6, 0);
  box(crane, 0.1, 4, 0.1, dark, 8, 13.8, 0);
  // Rotating warning beacons on the wall tops.
  const beacons: THREE.Object3D[] = [];
  for (const [x, z] of [[-39, -39], [39, -39], [-39, 39], [39, 39], [0, 39], [-39, 0], [39, 0]]) {
    mesh(root, new THREE.SphereGeometry(0.45, 12, 8), additive(0xf97316, 0.95), x, 10.5, z);
    const b = pivotBeam(root, 9, 0.25, 2.6, 0xf97316, 0.18); b.position.set(x, 10.5, z); beacons.push(b);
  }
  // Hazard band along the inner wall tops.
  const hz = hazardTexture(); hz.repeat.set(10, 1);
  const hzMat = std(0xffffff, 0.3, 0.6, { map: hz });
  for (const [x, z, ry] of [[0, -39.3, 0], [0, 39.3, Math.PI], [-39.3, 0, Math.PI / 2], [39.3, 0, -Math.PI / 2]] as const) mesh(root, new THREE.PlaneGeometry(80, 0.6), hzMat, x, 9.6, z, 0, ry, 0);
  particles(ctx, { count: 300, size: 0.14, color: 0xffcf8a, opacity: 0.6, half: [40, 40], y: [0.5, 22], mode: 'drift', speed: 0.3, sway: 0.3 });
  ctx.on((dt, t) => {
    hooks.forEach((h) => { h.position.x += dt * 3; if (h.position.x > R) h.position.x -= 2 * R + 1; });
    crane.position.z = Math.sin(t * 0.12) * 30;
    beacons.forEach((b, i) => { b.rotation.set(Math.PI / 2, t * 2.4 + i, 0, 'YXZ'); });
    (muzzleGlow.material as THREE.SpriteMaterial).opacity = 0.3 + Math.sin(t * 1.5) * 0.12;
  });
}

// SEC-16 生体工学ラボ: clinical hall beyond low partitions, culture tanks with specimens and bubbles.
function buildBiolab(ctx: Ctx) {
  const { root, rnd } = ctx;
  const C = 14, R = 58;
  const panelTex = canvasTex(256, 256, (c) => {
    c.fillStyle = '#c9d6ce'; c.fillRect(0, 0, 256, 256);
    c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 3; c.strokeRect(2, 2, 252, 252);
    c.fillStyle = '#16a34a'; c.fillRect(0, 200, 256, 10);
    c.strokeStyle = '#facc15'; c.fillStyle = '#facc15'; c.lineWidth = 8;
    c.beginPath(); c.arc(128, 100, 22, 0, Math.PI * 2); c.stroke();
    for (let k = 0; k < 3; k++) { const a = -Math.PI / 2 + k * (Math.PI * 2 / 3); c.beginPath(); c.arc(128 + Math.cos(a) * 34, 100 + Math.sin(a) * 34, 26, 0, Math.PI * 2); c.stroke(); }
    c.font = 'bold 22px monospace'; c.textAlign = 'center'; c.fillText('BIOHAZARD', 128, 180);
  });
  panelTex.wrapS = THREE.RepeatWrapping; panelTex.repeat.set(12, 1);
  const wallMat = std(0xffffff, 0.2, 0.6, { map: panelTex });
  const dark = std(0x1a2420, 0.6, 0.5);
  const metal = std(0x9aa8a2, 0.85, 0.3);
  const green = basic(0x4ade80, { toneMapped: false });
  mesh(root, new THREE.PlaneGeometry(2 * R, 2 * R), dark, 0, C, 0, Math.PI / 2);
  for (const s of [-1, 1]) {
    mesh(root, new THREE.PlaneGeometry(2 * R, C), wallMat, 0, C / 2, s * R, 0, s < 0 ? 0 : Math.PI, 0);
    mesh(root, new THREE.PlaneGeometry(2 * R, C), wallMat, s * R, C / 2, 0, 0, -s * Math.PI / 2, 0);
  }
  mesh(root, new THREE.PlaneGeometry(2 * R, 2 * R), std(0x2a3530, 0.5, 0.5), 0, -0.05, 0, -Math.PI / 2);
  // Hexagonal ceiling lights.
  const hexGeo = new THREE.CircleGeometry(1.5, 6);
  const hexMat = basic(0xe8fff0, { toneMapped: false });
  for (let x = -48; x <= 48; x += 12) for (let z = -48; z <= 48; z += 12) mesh(root, hexGeo, hexMat, x + ((z / 12) % 2 ? 6 : 0), C - 0.05, z, Math.PI / 2);
  // Culture tanks along all four sides.
  const glassGeo = new THREE.CylinderGeometry(1.8, 1.8, 7.4, 20, 1, true);
  const glassMat = additive(0x86efac, 0.16, { side: THREE.DoubleSide });
  const liquidMat = new THREE.MeshBasicMaterial({ color: 0x166534, transparent: true, opacity: 0.45, depthWrite: false });
  const liquidGeo = new THREE.CylinderGeometry(1.7, 1.7, 7.2, 20);
  const capGeo = new THREE.CylinderGeometry(2.1, 2.1, 0.8, 20);
  const ringGeo = new THREE.TorusGeometry(2.0, 0.08, 6, 32);
  const flesh = std(0x0b1a10, 0.2, 0.8);
  const tanks: THREE.Vector3[] = [];
  const specimens: THREE.Group[] = [];
  for (let k = 0; k < 4; k++) {
    const g = new THREE.Group(); g.rotation.y = (k * Math.PI) / 2; root.add(g);
    for (let f = -40; f <= 40; f += 8) {
      const z = -47;
      mesh(g, capGeo, metal, f, 0.4, z);
      mesh(g, capGeo, metal, f, 8.4, z);
      mesh(g, ringGeo, green, f, 0.95, z, Math.PI / 2);
      mesh(g, ringGeo, green, f, 7.85, z, Math.PI / 2);
      mesh(g, liquidGeo, liquidMat, f, 4.4, z);
      mesh(g, glassGeo, glassMat, f, 4.4, z);
      mesh(g, new THREE.CylinderGeometry(0.22, 0.22, C - 8.8, 6), dark, f + 0.8, (C + 8.8) / 2, z);
      mesh(g, new THREE.CylinderGeometry(0.16, 0.16, C - 8.8, 6), green, f - 0.8, (C + 8.8) / 2, z);
      const sp = new THREE.Group(); sp.position.set(f, 0, z); g.add(sp); specimens.push(sp);
      mesh(sp, new THREE.SphereGeometry(0.5, 12, 10), flesh, 0, 5.8, 0);
      mesh(sp, new THREE.CylinderGeometry(0.55, 0.32, 2.4, 10), flesh, 0, 4.3, 0);
      for (const s of [-1, 1]) {
        box(sp, 0.22, 1.9, 0.22, flesh, s * 0.75, 4.3, 0, 0, 0, s * 0.3);
        box(sp, 0.26, 2.0, 0.26, flesh, s * 0.25, 2.2, 0, 0, 0, s * 0.08);
      }
      glowSprite(g, 0x4ade80, 5, 0.2, f, 4.4, z + 2);
      const wp = new THREE.Vector3(f, 0, z).applyAxisAngle(_up, g.rotation.y);
      tanks.push(wp);
    }
  }
  // Bubbles rising inside every tank.
  const BN = tanks.length * 8;
  const bPos = new Float32Array(BN * 3), bSeed = new Float32Array(BN);
  for (let i = 0; i < BN; i++) bSeed[i] = rnd();
  const bGeo = new THREE.BufferGeometry(); bGeo.setAttribute('position', new THREE.BufferAttribute(bPos, 3));
  const bubbles = new THREE.Points(bGeo, new THREE.PointsMaterial({ size: 0.25, map: softDot(), color: 0xd9f99d, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
  bubbles.frustumCulled = false; root.add(bubbles);
  // Surgical gantry overhead with lamps.
  const gantry = new THREE.Group(); gantry.position.set(0, 12.5, 0); root.add(gantry);
  mesh(gantry, new THREE.TorusGeometry(7, 0.3, 8, 48), metal, 0, 0, 0, Math.PI / 2);
  box(gantry, 0.3, 1.5, 0.3, metal, 0, 0.75, 0);
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    mesh(gantry, new THREE.CylinderGeometry(0.4, 0.8, 0.6, 12), metal, Math.cos(a) * 7, -0.4, Math.sin(a) * 7);
    mesh(gantry, new THREE.CircleGeometry(0.7, 16), hexMat, Math.cos(a) * 7, -0.71, Math.sin(a) * 7, Math.PI / 2);
    const b = pivotBeam(gantry, 12, 0.6, 2.4, 0xd1fae5, 0.07); b.position.set(Math.cos(a) * 7, -0.7, Math.sin(a) * 7);
  }
  // Alarm strobes on the outer walls.
  const alarms = [[-R + 0.5, 10, -20], [R - 0.5, 10, 20], [20, 10, -R + 0.5], [-20, 10, R - 0.5]].map(([x, y, z]) => glowSprite(root, 0xff2a2a, 5, 0, x, y, z));
  particles(ctx, { count: 160, size: 3, color: 0x4ade80, opacity: 0.05, half: [40, 40], y: [0, 2.5], mode: 'drift', speed: 0.3, sway: 0.5 });
  particles(ctx, { count: 160, size: 0.18, color: 0xbbf7d0, opacity: 0.7, half: [40, 40], y: [0.5, 13], mode: 'drift', speed: 0.3, sway: 0.3 });
  ctx.on((dt, t) => {
    for (let i = 0; i < BN; i++) {
      const tk = tanks[i % tanks.length], s = bSeed[i];
      const f = (t * (0.18 + s * 0.2) + s) % 1;
      bPos[i * 3] = tk.x + Math.sin(s * 40 + t * 2) * 1.1;
      bPos[i * 3 + 1] = 1 + f * 7;
      bPos[i * 3 + 2] = tk.z + Math.cos(s * 31 + t * 2) * 1.1;
    }
    bGeo.attributes.position.needsUpdate = true;
    specimens.forEach((s, i) => { s.position.y = Math.sin(t * 0.6 + i * 1.3) * 0.25; s.rotation.y = Math.sin(t * 0.2 + i) * 0.5; });
    gantry.rotation.y = t * 0.08;
    const alarmOn = (t % 9) < 2.4 && Math.sin(t * 12) > 0;
    alarms.forEach((a) => { (a.material as THREE.SpriteMaterial).opacity = alarmOn ? 0.9 : 0; });
    ctx.hemi.intensity = 0.6 + (alarmOn ? 0.15 : 0);
  });
}

// SEC-18 禁断データアーカイブ: endless aisles of data stacks, falling glyph streams, floating data cubes.
function buildArchive(ctx: Ctx) {
  const { root, rnd } = ctx;
  mesh(root, new THREE.PlaneGeometry(300, 300), std(0x0a0a18, 0.7, 0.35), 0, -0.1, 0, -Math.PI / 2);
  const stackMats = [0, 1, 2].map(() => {
    const tex = windowsTexture(rnd, '#0d0d1f', [['#818cf8', 0.14], ['#c4b5fd', 0.05], ['#22d3ee', 0.03]], 6, 32);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(3, 2);
    return std(0x8a8ab0, 0.5, 0.5, { map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 1.1 });
  });
  const capMat = std(0x1e1b4b, 0.8, 0.4);
  for (let gx = -125; gx <= 125; gx += 11) for (let gz = -120; gz <= 120; gz += 30) {
    if (Math.abs(gx) < 50 && Math.abs(gz) < 50) continue;
    if (Math.hypot(gx, gz) > 138) continue;
    const h = 24 + rnd() * 50;
    box(root, 3, h, 24, stackMats[Math.floor(rnd() * 3)], gx, h / 2, gz);
    box(root, 3.4, 0.6, 24.4, capMat, gx, h + 0.3, gz);
  }
  // Falling glyph streams in the aisles.
  const glyph = glyphTexture(rnd, '#a5b4fc');
  const glyphMats: THREE.MeshBasicMaterial[] = [];
  for (let i = 0; i < 18; i++) {
    const a = rnd() * Math.PI * 2, r = 55 + rnd() * 60;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const t = glyph.clone(); t.offset.y = rnd();
    const m = additive(0xffffff, 0.75, { map: t, side: THREE.DoubleSide, fog: false });
    glyphMats.push(m);
    mesh(root, new THREE.PlaneGeometry(3.2, 70), m, x, 35, z, 0, faceCenter(x, z), 0);
  }
  // Floating data cubes.
  const cubeGeo = new THREE.BoxGeometry(1, 1, 1);
  const edgeGeo = new THREE.EdgesGeometry(cubeGeo);
  const edgeMat = new THREE.LineBasicMaterial({ color: 0xa5b4fc, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
  const coreMat = basic(0x6366f1, { toneMapped: false, transparent: true, opacity: 0.5 });
  const cubes = Array.from({ length: 46 }, () => {
    const g = new THREE.Group();
    const inside = rnd() < 0.4;
    const r = inside ? rnd() * 30 : 45 + rnd() * 60, a = rnd() * Math.PI * 2;
    g.position.set(Math.cos(a) * r, inside ? 10 + rnd() * 16 : 6 + rnd() * 40, Math.sin(a) * r);
    const s = 0.8 + rnd() * 2.2; g.scale.setScalar(s);
    g.add(new THREE.LineSegments(edgeGeo, edgeMat));
    const core = new THREE.Mesh(cubeGeo, coreMat); core.scale.setScalar(0.45); g.add(core);
    root.add(g);
    return { g, y: g.position.y, ph: rnd() * 6.28, sp: 0.2 + rnd() * 0.5 };
  });
  // Central index lattice overhead.
  const index = new THREE.Group(); index.position.set(0, 30, 0); root.add(index);
  index.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(8, 1)), new THREE.LineBasicMaterial({ color: 0xc7d2fe, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false })));
  glowSprite(index, 0x818cf8, 22, 0.5, 0, 0, 0);
  const rings = [11, 13.5].map((r, i) => mesh(index, new THREE.TorusGeometry(r, 0.12, 6, 96), additive(i ? 0xd946ef : 0x818cf8, 0.7, { fog: false })));
  // Light shafts falling into the aisles.
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3, r = 70 + rnd() * 30;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    beam(root, new THREE.Vector3(x, 90, z), new THREE.Vector3(x, 0, z), 2, 6, 0x818cf8, 0.12);
  }
  particles(ctx, { count: 300, size: 0.2, color: 0xa5b4fc, opacity: 0.7, half: [40, 40], y: [0.5, 24], mode: 'rise', speed: 0.5, sway: 0.2 });
  ctx.on((dt, t) => {
    glyphMats.forEach((m, i) => { m.map!.offset.y += dt * (0.08 + (i % 4) * 0.03); });
    cubes.forEach((c) => { c.g.rotation.x += dt * c.sp; c.g.rotation.y += dt * c.sp * 0.7; c.g.position.y = c.y + Math.sin(t * 0.5 + c.ph) * 0.8; });
    index.rotation.y = t * 0.12; index.rotation.x = Math.sin(t * 0.2) * 0.2;
    rings[0].rotation.x = t * 0.3; rings[1].rotation.y = t * 0.25;
  });
}

// SEC-20 反物質炉心冷却区画: tall reactor shaft, frosted coolant pipes, antimatter core in gimbal rings.
function buildReactor(ctx: Ctx) {
  const { root, rnd } = ctx;
  const H = 16, R = 62;
  const steel = std(0x4a5260, 0.85, 0.35);
  const dark = std(0x161a22, 0.7, 0.5);
  const frost = std(0xdbeafe, 0.3, 0.35, { emissive: 0x2563eb, emissiveIntensity: 0.45 });
  const rose = basic(0xfb7185, { toneMapped: false });
  const ice = basic(0x7dd3fc, { toneMapped: false });
  mesh(root, new THREE.CylinderGeometry(R, R, 130, 48, 1, true), std(0x1a1e26, 0.7, 0.5, { side: THREE.BackSide }), 0, 65, 0);
  mesh(root, new THREE.RingGeometry(40, R, 48), dark, 0, H, 0, -Math.PI / 2);
  [H + 2, 36, 56, 76, 96, 116].forEach((y, i) => {
    mesh(root, new THREE.TorusGeometry(R - 0.6, 0.7, 6, 64), steel, 0, y, 0, Math.PI / 2);
    mesh(root, new THREE.TorusGeometry(R - 1.2, 0.15, 4, 64), i % 2 ? ice : rose, 0, y - 1, 0, Math.PI / 2);
  });
  // Frosted coolant pipes rising up the shaft, tied together by ring headers.
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2 + 0.2;
    const x = Math.cos(a) * 52, z = Math.sin(a) * 52;
    mesh(root, new THREE.CylinderGeometry(2.2, 2.2, 110, 14), frost, x, 55, z);
    for (let y = 20; y < 110; y += 18) mesh(root, new THREE.TorusGeometry(2.5, 0.35, 6, 18), steel, x, y, z, Math.PI / 2);
    glowSprite(root, 0x7dd3fc, 7, 0.18, x * 0.94, 24, z * 0.94);
  }
  for (const y of [26, 64]) mesh(root, new THREE.TorusGeometry(52, 1.4, 8, 64), frost, 0, y, 0, Math.PI / 2);
  // Antimatter containment core held in gimbal rings.
  const CY = 64;
  const coreGroup = new THREE.Group(); coreGroup.position.set(0, CY, 0); root.add(coreGroup);
  const core = mesh(coreGroup, new THREE.SphereGeometry(6, 32, 24), rose);
  mesh(coreGroup, new THREE.SphereGeometry(8.5, 32, 24), additive(0xfda4af, 0.15, { fog: false }));
  const coreGlow = glowSprite(coreGroup, 0xf43f5e, 60, 0.55, 0, 0, 0);
  const gimbals = [12, 15, 18].map((r) => {
    const g = new THREE.Group(); coreGroup.add(g);
    mesh(g, new THREE.TorusGeometry(r, 0.7, 10, 72), steel);
    mesh(g, new THREE.TorusGeometry(r, 0.25, 6, 72), additive(0xfb7185, 0.8, { fog: false }), 0, 0, 0.75);
    return g;
  });
  // Magnetic struts from the shaft wall to the core.
  const strutEnds: THREE.Vector3[] = [];
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    const from = new THREE.Vector3(Math.cos(a) * (R - 1), CY - 14, Math.sin(a) * (R - 1));
    const to = new THREE.Vector3(Math.cos(a) * 22, CY - 2, Math.sin(a) * 22);
    const dir = to.clone().sub(from);
    const m = mesh(root, new THREE.CylinderGeometry(0.9, 1.4, dir.length(), 8), steel);
    m.position.copy(from).addScaledVector(dir, 0.5);
    m.quaternion.setFromUnitVectors(_up, dir.clone().normalize());
    mesh(root, new THREE.SphereGeometry(1.4, 12, 8), ice, to.x, to.y, to.z);
    strutEnds.push(to);
  }
  const arcs = [0, 1].map(() => makeArc(root, 0xfda4af, 0.12));
  beam(root, new THREE.Vector3(0, CY - 6, 0), new THREE.Vector3(0, 0, 0), 3, 7, 0xfb7185, 0.1);
  particles(ctx, { count: 500, size: 0.16, color: 0xe0f2fe, opacity: 0.85, half: [40, 40], y: [0, 30], mode: 'fall', speed: 1.2, sway: 0.4 });
  particles(ctx, { count: 160, size: 3.2, color: 0xbae6fd, opacity: 0.05, half: [40, 40], y: [0, 3], mode: 'drift', speed: 0.3, sway: 0.6 });
  let arcTimer = 0;
  ctx.on((dt, t) => {
    gimbals[0].rotation.x = t * 0.5; gimbals[1].rotation.y = t * 0.4; gimbals[1].rotation.x = Math.PI / 2;
    gimbals[2].rotation.z = t * 0.3; gimbals[2].rotation.x = Math.PI / 3;
    const pulse = 0.5 + 0.5 * Math.sin(t * 2.2);
    core.scale.setScalar(0.94 + pulse * 0.08);
    coreGlow.scale.setScalar(52 + pulse * 16);
    ctx.hemi.intensity = 0.6 + pulse * 0.12;
    arcTimer -= dt;
    if (arcTimer < 0) {
      arcTimer = 0.09;
      arcs.forEach((a, i) => {
        const on = Math.sin(t * (1.3 + i) + i * 2) > 0.1;
        a.visible(on);
        if (on) a.set(new THREE.Vector3(0, CY, 0), strutEnds[(Math.floor(t * 0.7) + i * 3) % strutEnds.length], 5);
      });
    }
  });
}

const BUILDERS: Record<SceneryId, (ctx: Ctx) => void> = {
  apartments: buildApartments, sanctuary: buildSanctuary, foundry: buildFoundry, cathedral: buildCathedral,
  spire: buildSpire, mechdock: buildMechDock, monolith: buildMonolith, fusion: buildFusion,
  corridor: buildCorridor, observatory: buildObservatory, powerroom: buildPowerRoom, hangar: buildHangar,
  market: buildMarket, aqueduct: buildAqueduct, belfry: buildBelfry, skybridge: buildSkybridge, relay: buildRelay,
  arsenal: buildArsenal, biolab: buildBiolab, archive: buildArchive, reactor: buildReactor,
  ...ABYSS_BUILDERS,
  ...RELIC_BUILDERS,
  ...CRYO_BUILDERS,
  ...OVERGROW_BUILDERS,
};

export interface StageScenery {
  update: (dt: number, cam: THREE.Camera) => void;
  /** Pre-filter a reflection environment so metal surfaces pick up the stage's colours. */
  bakeEnvironment: (renderer: THREE.WebGLRenderer) => void;
}

/** Build sky, hemisphere light and set dressing for a stage. Call `update` every frame. */
export function buildScenery(id: SceneryId, scene: THREE.Scene, accent: number): StageScenery {
  const cfg = SCENERY_CONFIG[id];
  const root = new THREE.Group();
  root.name = 'stage-scenery';
  scene.add(root);
  const sky = makeSky(cfg.sky);
  scene.add(sky);
  const hemi = new THREE.HemisphereLight(cfg.hemi[0], cfg.hemi[1], cfg.hemi[2]);
  scene.add(hemi);
  const updaters: Updater[] = [];
  const ctx: Ctx = {
    root, accent, hemi, sky: sky.material as THREE.ShaderMaterial,
    rnd: mulberry32(id.split('').reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261)),
    on: (fn) => updaters.push(fn),
  };
  BUILDERS[id](ctx);
  let t = 0;
  return {
    update(dt, cam) {
      t += dt;
      sky.position.copy(cam.position);
      ctx.sky.uniforms.uTime.value = t;
      for (const fn of updaters) fn(dt, t, cam);
    },
    bakeEnvironment(renderer) {
      const envScene = new THREE.Scene();
      const lift = (n: number, f: number) => new THREE.Color(n).lerp(new THREE.Color(0xffffff), f).getHex();
      const envSky = makeSky(cfg.env === 'sky' ? { ...cfg.sky, stars: 0 } : {
        top: lift(cfg.hemi[0], 0.15), horizon: new THREE.Color(cfg.hemi[0]).lerp(new THREE.Color(cfg.hemi[1]), 0.5).getHex(), bottom: cfg.hemi[1], exponent: 0.8,
      }, 50);
      envScene.add(envSky);
      // Bright light cards give metal some crisp highlights.
      const card = new THREE.MeshBasicMaterial({ color: new THREE.Color(cfg.sun.color).multiplyScalar(2.2), side: THREE.DoubleSide });
      const sunDir = new THREE.Vector3(...cfg.sun.pos).normalize();
      for (let k = 0; k < 4; k++) {
        const c = new THREE.Mesh(new THREE.PlaneGeometry(14, 4), card);
        const a = (k / 4) * Math.PI * 2;
        c.position.set(Math.cos(a) * 30, 22, Math.sin(a) * 30);
        if (k === 0) c.position.copy(sunDir).multiplyScalar(36);
        c.lookAt(0, 0, 0);
        envScene.add(c);
      }
      const pmrem = new THREE.PMREMGenerator(renderer);
      const rt = pmrem.fromScene(envScene, 0.04, 0.1, 100);
      scene.environment = rt.texture;
      scene.environmentIntensity = cfg.envIntensity;
      pmrem.dispose();
      envScene.traverse((o) => { if (o instanceof THREE.Mesh) o.geometry.dispose(); });
    },
  };
}
