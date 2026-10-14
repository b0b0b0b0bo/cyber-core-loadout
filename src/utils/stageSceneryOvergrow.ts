import * as THREE from 'three';
import {
  std, basic, additive, mesh, box, glowSprite, beam, particles, makeArc, buildMech, catenary,
} from './stageScenery';
import type { Ctx, SceneryConfig } from './stageScenery';

/**
 * MAP 7 OVERGROWN SECTOR — machines swallowed by forest and fungus (SEC-43 .. SEC-49).
 * Everything is visual set dressing outside the arena walls (|x|,|z| > 41) or overhead.
 */

type OvergrowId = 'canopy' | 'greenhouse' | 'mycelium' | 'swamp' | 'rootworks' | 'bloomhill' | 'mycothrone';

export const OVERGROW_CONFIG: Record<OvergrowId, SceneryConfig> = {
  canopy: {
    sky: {
      top: 0x0a3a46, horizon: 0xd2f5a4, bottom: 0x10261c, exponent: 0.5, stars: 0.006,
      clouds: { color: 0xeaffd2, coverage: 0.35, speed: 0.01, opacity: 0.5 }, horizonGlow: { color: 0xfef08a, strength: 0.35 },
      sun: { dir: [-0.4, 0.55, -0.72], color: 0xfff4c0, size: 0.004, glow: 0.9 },
    },
    fogColor: 0x5f9a52, fogDensity: 0.0105,
    ambient: [0xe8ffd0, 0.66], hemi: [0xc8f5a0, 0x1f3a1a, 0.88],
    sun: { color: 0xfff4c0, intensity: 1.35, pos: [-30, 50, -40] },
    wallHeight: 3, gridOpacity: 0.2, cornerLight: [0xa3e635, 1.8],
    floorTint: 0xd0e0b8, env: 'sky', envIntensity: 1.0,
  },
  greenhouse: {
    sky: { top: 0x7ac8b8, horizon: 0xeaffd8, bottom: 0x2a4a2a, exponent: 0.6, clouds: { color: 0xf4ffe8, coverage: 0.3, speed: 0.008, opacity: 0.4 } },
    fogColor: 0x86bb78, fogDensity: 0.0098,
    ambient: [0xf2ffe4, 0.82], hemi: [0xd8ffc0, 0x294a28, 0.92],
    sun: { color: 0xfff8d0, intensity: 1.25, pos: [0, 60, 10] },
    wallHeight: 4, gridOpacity: 0.24, cornerLight: [0x4ade80, 2.0],
    floorTint: 0xd4e4c0, env: 'sky', envIntensity: 0.95,
  },
  mycelium: {
    sky: { top: 0x020d10, horizon: 0x0a2e2c, bottom: 0x030a0a },
    fogColor: 0x06201f, fogDensity: 0.0125,
    ambient: [0x7ff0d0, 0.52], hemi: [0x5adcc0, 0x04100e, 0.82],
    sun: { color: 0x9ffff0, intensity: 0.7, pos: [0, 40, 0] },
    wallHeight: 12, gridOpacity: 0.28, cornerLight: [0x2dd4bf, 2.5],
    floorTint: 0xa8c8c0, env: 'hemi', envIntensity: 0.85,
  },
  swamp: {
    sky: {
      top: 0x0e2a22, horizon: 0xa6d482, bottom: 0x0a1a14, exponent: 0.5, stars: 0.01,
      horizonGlow: { color: 0xd9f99d, strength: 0.45 }, clouds: { color: 0xbfe0a0, coverage: 0.5, speed: 0.006, opacity: 0.5 },
    },
    fogColor: 0x3c5f3a, fogDensity: 0.0142,
    ambient: [0xcfe8b0, 0.58], hemi: [0xa6d68a, 0x0d1d12, 0.82],
    sun: { color: 0xe8f5b0, intensity: 0.9, pos: [40, 24, -60] },
    wallHeight: 2.2, gridOpacity: 0.26, cornerLight: [0xa3e635, 2.1],
    floorTint: 0xb4c8a0, env: 'sky', envIntensity: 0.9,
  },
  rootworks: {
    sky: { top: 0x0a0804, horizon: 0x2c1e0e, bottom: 0x0a0804 },
    fogColor: 0x2a1e10, fogDensity: 0.0125,
    ambient: [0xffd9a0, 0.52], hemi: [0xf0b060, 0x20160a, 0.82],
    sun: { color: 0xffd090, intensity: 0.8, pos: [10, 40, 5] },
    wallHeight: 14, gridOpacity: 0.22, cornerLight: [0xfbbf24, 2.5],
    floorTint: 0xc8b090, env: 'hemi', envIntensity: 0.85,
  },
  bloomhill: {
    sky: {
      top: 0x0a0a2e, horizon: 0x8a4aa8, bottom: 0x120a24, exponent: 0.5, stars: 0.035,
      aurora: { color: 0xf9a8d4, strength: 0.55 }, nebula: { a: 0xec4899, b: 0x84cc16, strength: 0.3 }, horizonGlow: { color: 0xf0abfc, strength: 0.4 },
    },
    fogColor: 0x2a1a3e, fogDensity: 0.0092,
    ambient: [0xe8d0ff, 0.62], hemi: [0xe0b0ff, 0x1a2a14, 0.84],
    sun: { color: 0xffe0f0, intensity: 1.0, pos: [-30, 50, -60] },
    wallHeight: 2, gridOpacity: 0.26, cornerLight: [0xf472b6, 2.1],
    floorTint: 0xc8c0d8, env: 'sky', envIntensity: 0.95,
  },
  mycothrone: {
    sky: {
      top: 0x050a14, horizon: 0x1c4c3a, bottom: 0x050a0a, exponent: 0.5, stars: 0.02,
      aurora: { color: 0xa3e635, strength: 0.6 }, nebula: { a: 0x84cc16, b: 0xa855f7, strength: 0.35 },
    },
    fogColor: 0x0e2a22, fogDensity: 0.0092,
    ambient: [0xd8ffc0, 0.64], hemi: [0xb0f0a0, 0x0c1c14, 0.86],
    sun: { color: 0xe8ffd0, intensity: 1.1, pos: [0, 40, -60] },
    wallHeight: 2.4, gridOpacity: 0.28, cornerLight: [0xa3e635, 2.4],
    floorTint: 0xc0d4b8, env: 'sky', envIntensity: 1.0,
  },
};

const TAU = Math.PI * 2;
const LIME = 0xa3e635;

// ───────────────────────────── shared helpers ─────────────────────────────

const barkMat = () => std(0x5a4128, 0.05, 0.95, { emissive: 0x1a1008, emissiveIntensity: 0.3 });
const leafMats = () => [
  std(0x3f7a1c, 0, 0.8, { flatShading: true, emissive: 0x0e2a08, emissiveIntensity: 0.35 }),
  std(0x5c9a24, 0, 0.8, { flatShading: true, emissive: 0x12300a, emissiveIntensity: 0.35 }),
  std(0x2f6420, 0, 0.8, { flatShading: true, emissive: 0x0a2008, emissiveIntensity: 0.35 }),
];

const ground = (ctx: Ctx, color: number, emissive = 0x0c200a) =>
  mesh(ctx.root, new THREE.PlaneGeometry(600, 600), std(color, 0, 0.95, { emissive, emissiveIntensity: 0.3 }), 0, -0.3, 0, -Math.PI / 2);

/** Giant tree: tapering trunk, root flares, foliage clumps. */
function bigTree(parent: THREE.Object3D, rnd: () => number, x: number, z: number, h: number, r: number, bark: THREE.Material, leaves: THREE.Material[]) {
  const g = new THREE.Group(); g.position.set(x, 0, z); parent.add(g);
  mesh(g, new THREE.CylinderGeometry(r * 0.55, r, h, 9), bark, 0, h / 2, 0);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU + rnd();
    const t = 0.55;
    const fl = mesh(g, new THREE.ConeGeometry(r * 0.5, h * 0.24, 5), bark, Math.cos(a) * r * 0.85, h * 0.1, Math.sin(a) * r * 0.85);
    fl.rotation.set(Math.sin(a) * t, 0, -Math.cos(a) * t);
  }
  const n = 5 + Math.floor(rnd() * 3);
  for (let i = 0; i < n; i++) {
    const a = rnd() * TAU, d = rnd() * r * 3;
    const c = mesh(g, new THREE.IcosahedronGeometry(r * (2.2 + rnd() * 1.6), 1), leaves[i % leaves.length], Math.cos(a) * d, h * (0.82 + rnd() * 0.22), Math.sin(a) * d);
    c.scale.y = 0.72;
    c.rotation.set(rnd(), rnd(), rnd());
  }
  return g;
}

/** Glowing giant mushroom (stem, domed cap, glowing gills and spots). */
function giantShroom(parent: THREE.Object3D, rnd: () => number, x: number, z: number, s: number, capColor: number, glowColor: number, stemColor = 0xe8dfc4) {
  const g = new THREE.Group(); g.position.set(x, 0, z); parent.add(g);
  mesh(g, new THREE.CylinderGeometry(s * 0.5, s * 0.85, s * 6, 10), std(stemColor, 0, 0.8, { emissive: glowColor, emissiveIntensity: 0.12 }), 0, s * 3, 0);
  const capMat = std(capColor, 0, 0.55, { emissive: capColor, emissiveIntensity: 0.28, side: THREE.DoubleSide });
  const cap = mesh(g, new THREE.SphereGeometry(s * 3, 22, 10, 0, TAU, 0, Math.PI / 2), capMat, 0, s * 5.5, 0);
  cap.scale.y = 0.6;
  mesh(g, new THREE.CircleGeometry(s * 3, 26), additive(glowColor, 0.4, { side: THREE.DoubleSide }), 0, s * 5.48, 0, Math.PI / 2);
  for (let i = 0; i < 8; i++) {
    const th = rnd() * TAU, ph = 0.2 + rnd() * 0.85;
    const sp = mesh(g, new THREE.SphereGeometry(s * (0.2 + rnd() * 0.2), 8, 6), basic(0xfff8e0, { toneMapped: false }),
      Math.sin(ph) * Math.cos(th) * s * 3, s * 5.5 + Math.cos(ph) * s * 1.8, Math.sin(ph) * Math.sin(th) * s * 3);
    sp.scale.y = 0.45;
  }
  glowSprite(g, glowColor, s * 10, 0.32, 0, s * 5.0, 0);
  return g;
}

/** Hanging vine with leaves. */
function vine(parent: THREE.Object3D, rnd: () => number, x: number, y: number, z: number, len: number, mat: THREE.Material, leaf: THREE.Material) {
  const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g);
  mesh(g, new THREE.CylinderGeometry(0.1, 0.18, len, 5), mat, 0, -len / 2, 0);
  for (let k = 1; k < len / 2.4; k++) {
    const l = mesh(g, new THREE.ConeGeometry(0.7 + rnd() * 0.5, 1.8, 4), leaf, (k % 2 ? 0.7 : -0.7), -k * 2.4, 0);
    l.rotation.z = (k % 2 ? -1 : 1) * 1.1;
  }
  return g;
}

const fireflies = (ctx: Ctx, color = 0xe9ff7a, count = 180, y: [number, number] = [0.5, 22]) =>
  particles(ctx, { count, size: 0.34, color, opacity: 0.85, half: [70, 70], y, mode: 'drift', speed: 1.2, sway: 0.9 });
const pollen = (ctx: Ctx, color = 0xfff08a, count = 220) =>
  particles(ctx, { count, size: 0.2, color, opacity: 0.6, half: [70, 70], y: [0.3, 40], mode: 'rise', speed: 0.7, sway: 0.7 });
const greenMist = (ctx: Ctx, color = 0xb8e8a0, opacity = 0.07) =>
  particles(ctx, { count: 150, size: 12, color, opacity, half: [70, 70], y: [0.2, 7], mode: 'drift', speed: 0.3, sway: 0.7 });

// ───────────────────────────── SEC-43 樹冠回廊 ─────────────────────────────
// Ruined elevated highway swallowed by giant trees, god rays through the leaves, drifting leaves and fireflies.
function buildCanopy(ctx: Ctx) {
  const { root, rnd } = ctx;
  const bark = barkMat(), leaves = leafMats();
  const concrete = std(0x6f7a6a, 0.1, 0.9, { emissive: 0x10200c, emissiveIntensity: 0.25 });
  ground(ctx, 0x2d4a1f);
  // Ring of colossal trees.
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * TAU + rnd() * 0.2, r = 58 + rnd() * 50;
    bigTree(root, rnd, Math.cos(a) * r, Math.sin(a) * r, 50 + rnd() * 50, 3 + rnd() * 3.5, bark, leaves);
  }
  // Collapsed elevated highway cutting across the far side, wrapped in vines.
  const hw = new THREE.Group(); hw.position.set(0, 0, -78); root.add(hw);
  for (let i = -4; i <= 4; i++) {
    box(hw, 3.2, 20, 3.2, concrete, i * 18, 10, 0);
    box(hw, 16, 1.8, 10, concrete, i * 18 + 9, 20, 0, 0, 0, i % 3 === 0 ? 0.12 : 0);
    box(hw, 16, 0.5, 0.5, basic(0xf59e0b, { toneMapped: false }), i * 18 + 9, 21.2, 4.4);
    for (let k = 0; k < 2; k++) vine(hw, rnd, i * 18 + rnd() * 14, 19, (rnd() - 0.5) * 8, 6 + rnd() * 12, leaves[2], leaves[1]);
  }
  // Rusted wreck being eaten by roots on the left.
  const wreck = buildMech(std(0x5a6a58, 0.7, 0.6), std(0x4a5a46, 0.6, 0.6), std(0x1c2a1c, 0.6, 0.6), basic(0xa3e635, { toneMapped: false }));
  wreck.scale.setScalar(1.3); wreck.position.set(-88, -4, 38); wreck.rotation.set(-0.35, 1.2, 0.4);
  root.add(wreck);
  // God rays.
  for (const [x, z] of [[-30, -60], [20, -70], [50, -30], [-60, 10], [0, 70]] as const) {
    beam(root, new THREE.Vector3(x + 14, 90, z - 12), new THREE.Vector3(x, 0, z), 1.5, 9 + rnd() * 5, 0xfff2b0, 0.07);
  }
  // Falling leaves, fireflies and pollen.
  particles(ctx, { count: 160, size: 0.42, color: 0xc2e07a, opacity: 0.8, half: [60, 60], y: [0.5, 45], mode: 'fall', speed: 1.2, sway: 1.6 });
  fireflies(ctx);
  pollen(ctx, 0xfff08a, 120);
  greenMist(ctx);
  ctx.on((_dt, t) => { ctx.hemi.intensity = 0.88 + Math.sin(t * 0.6) * 0.04; });
}

// ───────────────────────────── SEC-44 温室ドーム ─────────────────────────────
// Cracked glass dome whose planters have run wild: huge flowers, grow lights, hanging pots, pollen haze.
function buildGreenhouse(ctx: Ctx) {
  const { root, rnd } = ctx;
  const leaves = leafMats();
  const frame = std(0xcfd8cc, 0.7, 0.4, { emissive: 0x14301a, emissiveIntensity: 0.25 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0xcfffe6, transparent: true, opacity: 0.16, roughness: 0.05, metalness: 0.0, side: THREE.DoubleSide, depthWrite: false });
  ground(ctx, 0x3a5a2a);
  // Dome shell with ribs and a few broken panes (missing arcs).
  const dome = new THREE.Group(); root.add(dome);
  mesh(dome, new THREE.SphereGeometry(96, 40, 20, 0, TAU, 0, Math.PI / 2.1), glass);
  for (let i = 0; i < 16; i++) mesh(dome, new THREE.TorusGeometry(96, 0.55, 6, 48, Math.PI * 0.48), frame, 0, 0, 0, 0, (i / 16) * TAU, 0).rotation.z = Math.PI / 2;
  for (const y of [28, 52, 72]) mesh(dome, new THREE.TorusGeometry(Math.sqrt(96 * 96 - y * y), 0.5, 6, 64), frame, 0, y, 0, Math.PI / 2);
  // Planter beds with out-of-control giant flowers.
  const petals = [0xf472b6, 0xfde047, 0xfb7185, 0xc084fc];
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * TAU, r = 56 + (i % 3) * 9;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    box(root, 14, 2, 6, frame, x, 1, z, 0, -a + Math.PI / 2);
    const h = 14 + rnd() * 16;
    mesh(root, new THREE.CylinderGeometry(0.5, 0.8, h, 6), leaves[2], x, h / 2 + 2, z);
    const head = new THREE.Group(); head.position.set(x, h + 2, z); root.add(head);
    const pc = petals[i % petals.length];
    for (let k = 0; k < 8; k++) {
      const b = (k / 8) * TAU;
      const pt = mesh(head, new THREE.ConeGeometry(2.1, 7, 5), std(pc, 0, 0.5, { emissive: pc, emissiveIntensity: 0.25 }), Math.cos(b) * 3.4, 1, Math.sin(b) * 3.4);
      pt.rotation.set(Math.sin(b) * 1.1, 0, -Math.cos(b) * 1.1);
    }
    mesh(head, new THREE.SphereGeometry(1.8, 10, 8), basic(0xfde047, { toneMapped: false }), 0, 0.7, 0);
    glowSprite(head, pc, 16, 0.22, 0, 1, 0);
  }
  // Grow-light gantry with magenta tubes.
  const lights: THREE.Mesh[] = [];
  for (let i = -2; i <= 2; i++) {
    box(root, 150, 0.8, 1, frame, 0, 56, i * 22);
    lights.push(box(root, 120, 0.5, 2.4, basic(0xf0abfc, { toneMapped: false }), 0, 55.4, i * 22));
    beam(root, new THREE.Vector3(0, 55, i * 22), new THREE.Vector3(0, 0, i * 22), 2, 14, 0xf5d0fe, 0.035);
  }
  // Hanging pots with trailing vines.
  for (let i = 0; i < 14; i++) {
    const a = rnd() * TAU, r = 46 + rnd() * 40, y = 34 + rnd() * 16;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    mesh(root, new THREE.CylinderGeometry(0.05, 0.05, 60 - y, 4), frame, x, y + (60 - y) / 2, z);
    mesh(root, new THREE.CylinderGeometry(2, 1.2, 2.2, 8), std(0xb45309, 0, 0.8), x, y, z);
    vine(root, rnd, x, y, z, 8 + rnd() * 12, leaves[0], leaves[1]);
  }
  beam(root, new THREE.Vector3(10, 100, 0), new THREE.Vector3(0, 0, 0), 4, 28, 0xfff8d0, 0.07);
  pollen(ctx, 0xfff08a, 260);
  fireflies(ctx, 0xf9a8d4, 100);
  greenMist(ctx, 0xdaf5c8, 0.06);
  ctx.on((_dt, t) => { lights.forEach((l, i) => { (l.material as THREE.MeshBasicMaterial).color.setScalar(0.88 + 0.12 * Math.sin(t * 3 + i)); }); });
}

// ───────────────────────────── SEC-45 菌糸洞 ─────────────────────────────
// Bioluminescent cave: giant glowing mushrooms, dripping glow-stalactites, pulsing mycelium threads.
function buildMycelium(ctx: Ctx) {
  const { root, rnd } = ctx;
  const R = 74;
  mesh(root, new THREE.CylinderGeometry(R, R, 76, 40, 1, true), std(0x0b1c1b, 0.1, 0.95, { side: THREE.BackSide, emissive: 0x04201c, emissiveIntensity: 0.4 }), 0, 36, 0);
  mesh(root, new THREE.PlaneGeometry(260, 260), std(0x06100f, 0.1, 0.9), 0, 74, 0, Math.PI / 2);
  mesh(root, new THREE.PlaneGeometry(260, 260), std(0x0c1c18, 0.1, 0.9, { emissive: 0x06201c, emissiveIntensity: 0.4 }), 0, -0.3, 0, -Math.PI / 2);
  // Giant mushrooms ringing the cave.
  const caps = [[0x0d9488, 0x2dd4bf], [0x7c3aed, 0xc084fc], [0x0891b2, 0x67e8f9], [0x4d7c0f, 0xbef264]];
  const shrooms: THREE.Sprite[] = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU + rnd() * 0.2, r = 50 + rnd() * 20, s = 2.2 + rnd() * 2.6;
    const [c, gcol] = caps[i % caps.length];
    const g = giantShroom(root, rnd, Math.cos(a) * r, Math.sin(a) * r, s, c, gcol);
    shrooms.push(g.children[g.children.length - 1] as THREE.Sprite);
  }
  // Glow-tip stalactites.
  for (let i = 0; i < 40; i++) {
    const a = rnd() * TAU, r = 10 + rnd() * 60, h = 4 + rnd() * 12;
    mesh(root, new THREE.ConeGeometry(0.8 + rnd() * 1.4, h, 6), std(0x1c3a36, 0.1, 0.8), Math.cos(a) * r, 73 - h / 2, Math.sin(a) * r, Math.PI);
    mesh(root, new THREE.SphereGeometry(0.35, 6, 6), basic(0x7fffe0, { toneMapped: false }), Math.cos(a) * r, 73 - h, Math.sin(a) * r);
  }
  // Mycelium threads strung from the ceiling to the walls.
  const threads: THREE.Mesh[] = [];
  for (let i = 0; i < 26; i++) {
    const a = rnd() * TAU, b = a + (rnd() - 0.5) * 1.4;
    const p0 = new THREE.Vector3(Math.cos(a) * 62, 20 + rnd() * 40, Math.sin(a) * 62);
    const p1 = new THREE.Vector3(Math.cos(b) * 62, 20 + rnd() * 40, Math.sin(b) * 62);
    const tube = new THREE.Mesh(new THREE.TubeGeometry(catenary(p0, p1, 3 + rnd() * 6), 16, 0.12, 4), additive(i % 2 ? 0x5eead4 : 0xa5f3fc, 0.55, { fog: false }));
    root.add(tube); threads.push(tube);
  }
  // Light shafts from fissures overhead.
  for (const [x, z] of [[-20, -30], [26, 12], [-10, 34]] as const) beam(root, new THREE.Vector3(x + 6, 76, z), new THREE.Vector3(x, 0, z), 1.5, 8, 0x7fffe0, 0.06);
  particles(ctx, { count: 280, size: 0.3, color: 0x7fffe0, opacity: 0.8, half: [64, 64], y: [0.5, 60], mode: 'rise', speed: 0.9, sway: 0.5 });
  fireflies(ctx, 0xc084fc, 90, [1, 30]);
  greenMist(ctx, 0x7fe8d0, 0.07);
  ctx.on((_dt, t) => {
    shrooms.forEach((s, i) => { (s.material as THREE.SpriteMaterial).opacity = 0.28 + 0.12 * Math.sin(t * 1.3 + i * 1.7); });
    threads.forEach((m, i) => { (m.material as THREE.MeshBasicMaterial).opacity = 0.35 + 0.25 * Math.sin(t * 2 + i); });
    ctx.hemi.intensity = 0.82 + Math.sin(t * 0.8) * 0.05;
  });
}

// ───────────────────────────── SEC-46 胞子沼地 ─────────────────────────────
// Misty swamp: black water, drooping cypress trees, half-sunk wrecks, giant rotting blooms and glowing spore pods.
function buildSwamp(ctx: Ctx) {
  const { root, rnd } = ctx;
  const bark = barkMat();
  const moss = std(0x4d7c0f, 0, 0.9, { flatShading: true, emissive: 0x12300a, emissiveIntensity: 0.3 });
  const water = new THREE.MeshPhysicalMaterial({ color: 0x1b3a2a, roughness: 0.08, metalness: 0.5, clearcoat: 1, emissive: 0x0a2418, emissiveIntensity: 0.4 });
  mesh(root, new THREE.PlaneGeometry(600, 600), water, 0, -0.35, 0, -Math.PI / 2);
  // Cypress trees with curtains of moss.
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * TAU + rnd() * 0.25, r = 56 + rnd() * 60, h = 30 + rnd() * 34, rad = 1.8 + rnd() * 1.8;
    const g = new THREE.Group(); g.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); root.add(g);
    mesh(g, new THREE.CylinderGeometry(rad * 0.5, rad * 1.2, h, 8), bark, 0, h / 2, 0);
    for (let k = 0; k < 4; k++) {
      const arm = mesh(g, new THREE.CylinderGeometry(0.3, 0.6, 12, 5), bark, 0, h * (0.7 + k * 0.07), 0);
      arm.rotation.set(Math.sin(k * 1.6) * 0.9, 0, Math.cos(k * 1.6) * 0.9);
      arm.position.x += Math.cos(k * 1.6) * 3; arm.position.z += Math.sin(k * 1.6) * 3;
    }
    for (let k = 0; k < 9; k++) {
      const m = mesh(g, new THREE.ConeGeometry(0.9, 9 + rnd() * 9, 4), moss, (rnd() - 0.5) * 12, h * 0.86 - 4, (rnd() - 0.5) * 12, Math.PI);
      m.scale.x = 0.6;
    }
  }
  // Half-sunk wrecks.
  for (const [x, z, ry] of [[-92, -30, 0.7], [84, 52, -1.9]] as const) {
    const w = buildMech(std(0x4a5e48, 0.6, 0.7), std(0x3a4e38, 0.6, 0.7), std(0x1a281a, 0.6, 0.7), basic(0xa3e635, { toneMapped: false }));
    w.scale.setScalar(1.2); w.position.set(x, -10, z); w.rotation.set(0.25, ry, -0.3); root.add(w);
  }
  // Giant blooms with glowing spore pods floating above them.
  const pods: THREE.Sprite[] = [];
  for (let i = 0; i < 7; i++) {
    const a = rnd() * TAU, r = 60 + rnd() * 40;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    for (let k = 0; k < 6; k++) {
      const b = (k / 6) * TAU;
      const pt = mesh(root, new THREE.ConeGeometry(3.4, 12, 5), std(0x9d1c2a, 0, 0.6, { emissive: 0x5a0f18, emissiveIntensity: 0.5 }), x + Math.cos(b) * 5, 5, z + Math.sin(b) * 5);
      pt.rotation.set(Math.sin(b) * 1.0, 0, -Math.cos(b) * 1.0);
    }
    mesh(root, new THREE.SphereGeometry(2.4, 10, 8), basic(0xfde047, { toneMapped: false }), x, 3.2, z);
    pods.push(glowSprite(root, 0xfde047, 26, 0.3, x, 5, z));
  }
  // Lily pads and reeds near the arena edge.
  for (let i = 0; i < 70; i++) {
    const a = rnd() * TAU, r = 44 + rnd() * 40;
    mesh(root, new THREE.CircleGeometry(1.4 + rnd() * 1.4, 10), std(0x3f7a1c, 0, 0.7, { side: THREE.DoubleSide }), Math.cos(a) * r, -0.25, Math.sin(a) * r, -Math.PI / 2);
    if (i % 3 === 0) mesh(root, new THREE.CylinderGeometry(0.08, 0.1, 5 + rnd() * 5, 4), moss, Math.cos(a) * r + 1, 3, Math.sin(a) * r);
  }
  // Fog sheets.
  for (let i = 0; i < 6; i++) mesh(root, new THREE.PlaneGeometry(240, 14), additive(0x9fd08a, 0.05, { side: THREE.DoubleSide, fog: false }), (rnd() - 0.5) * 80, 4 + i * 1.4, (rnd() - 0.5) * 80, 0, rnd() * Math.PI, 0);
  particles(ctx, { count: 260, size: 0.38, color: 0xd9f99d, opacity: 0.8, half: [70, 70], y: [0.5, 14], mode: 'drift', speed: 1.4, sway: 1.2 });
  particles(ctx, { count: 120, size: 0.26, color: 0xfde047, opacity: 0.7, half: [60, 60], y: [0.5, 40], mode: 'rise', speed: 1.0, sway: 0.6 });
  greenMist(ctx, 0xa8d890, 0.09);
  ctx.on((_dt, t) => { pods.forEach((p, i) => { (p.material as THREE.SpriteMaterial).opacity = 0.2 + 0.14 * Math.sin(t * 1.2 + i * 2); }); });
}

// ───────────────────────────── SEC-47 根の機関区 ─────────────────────────────
// Old power hall pierced by colossal roots: rusted pipes, amber lamps, gears, sparking transformers.
function buildRootworks(ctx: Ctx) {
  const { root, rnd } = ctx;
  const R = 70;
  const rust = std(0x4a3828, 0.7, 0.7, { emissive: 0x1a0c04, emissiveIntensity: 0.3 });
  const steel = std(0x5a5448, 0.85, 0.5);
  const rootMat = std(0x5a3b1e, 0.05, 0.9, { emissive: 0x2a1604, emissiveIntensity: 0.4 });
  const amber = basic(0xfbbf24, { toneMapped: false });
  mesh(root, new THREE.CylinderGeometry(R, R, 80, 40, 1, true), std(0x1c1610, 0.5, 0.8, { side: THREE.BackSide }), 0, 38, 0);
  mesh(root, new THREE.PlaneGeometry(260, 260), std(0x120e0a, 0.3, 0.9), 0, 76, 0, Math.PI / 2);
  mesh(root, new THREE.PlaneGeometry(260, 260), std(0x1a140e, 0.4, 0.8), 0, -0.3, 0, -Math.PI / 2);
  // Colossal roots hanging from the ceiling and diving into the floor.
  for (let i = 0; i < 22; i++) {
    const a = rnd() * TAU, r = 48 + rnd() * 20;
    const pts: THREE.Vector3[] = [];
    const top = rnd() > 0.5;
    for (let k = 0; k <= 6; k++) {
      const f = k / 6;
      pts.push(new THREE.Vector3(Math.cos(a) * r + Math.sin(f * 5 + i) * 5, top ? 76 - f * 76 : f * 76, Math.sin(a) * r + Math.cos(f * 4 + i) * 5));
    }
    const rad = 1.4 + rnd() * 2.2;
    mesh(root, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 28, rad, 7), rootMat);
  }
  // Pipe rings and catwalk.
  for (let i = 0; i < 3; i++) mesh(root, new THREE.TorusGeometry(R - 5 - i * 3, 1.1, 8, 64), i % 2 ? rust : steel, 0, 58 + i * 5, 0, Math.PI / 2);
  const walk = new THREE.Group(); walk.position.set(0, 30, 0); root.add(walk);
  mesh(walk, new THREE.TorusGeometry(R - 6, 0.5, 6, 64), steel, 0, 0, 0, Math.PI / 2);
  for (let i = 0; i < 28; i++) { const a = (i / 28) * TAU; box(walk, 0.4, 1.4, 0.4, steel, Math.cos(a) * (R - 6), 0.7, Math.sin(a) * (R - 6)); }
  // Gears turning on the walls.
  const gears: THREE.Mesh[] = [];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU + 0.5;
    const gr = new THREE.Group(); gr.position.set(Math.cos(a) * (R - 3), 24 + (i % 2) * 14, Math.sin(a) * (R - 3)); gr.rotation.y = -a + Math.PI / 2; root.add(gr);
    const ring = mesh(gr, new THREE.TorusGeometry(8 + (i % 3) * 2, 1.6, 6, 14), steel);
    for (let k = 0; k < 10; k++) { const b = (k / 10) * TAU; box(ring, 1.4, 3, 1.6, steel, Math.cos(b) * (8 + (i % 3) * 2), Math.sin(b) * (8 + (i % 3) * 2), 0, 0, 0, b); }
    gears.push(ring);
  }
  // Amber lamps and sparking transformers.
  const lamps: THREE.Sprite[] = [];
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * TAU, r = R - 4;
    box(root, 1.2, 1.2, 1.2, amber, Math.cos(a) * r, 18 + (i % 3) * 8, Math.sin(a) * r);
    lamps.push(glowSprite(root, 0xfbbf24, 16, 0.4, Math.cos(a) * r, 18 + (i % 3) * 8, Math.sin(a) * r));
  }
  const arcs = [makeArc(root, 0xfde68a, 0.1), makeArc(root, 0xfbbf24, 0.1)];
  const ends: [THREE.Vector3, THREE.Vector3][] = [
    [new THREE.Vector3(-56, 22, -20), new THREE.Vector3(-56, 8, -8)],
    [new THREE.Vector3(52, 24, 30), new THREE.Vector3(52, 6, 20)],
  ];
  for (const [p] of ends) box(root, 5, 14, 5, steel, p.x, 7, p.z - 3);
  beam(root, new THREE.Vector3(0, 76, 0), new THREE.Vector3(0, 0, 0), 5, 24, 0xfde68a, 0.045);
  particles(ctx, { count: 200, size: 0.22, color: 0xfde68a, opacity: 0.7, half: [60, 60], y: [0.5, 50], mode: 'rise', speed: 1.4, sway: 0.5 });
  greenMist(ctx, 0xd8c8a0, 0.06);
  let arcT = 0;
  ctx.on((dt, t) => {
    gears.forEach((g, i) => { g.rotation.z += dt * 0.25 * (i % 2 ? 1 : -1); });
    lamps.forEach((l, i) => { (l.material as THREE.SpriteMaterial).opacity = 0.3 + 0.15 * Math.sin(t * 2.4 + i * 1.3) + (Math.sin(t * 17 + i * 5) > 0.97 ? -0.25 : 0); });
    arcT -= dt;
    if (arcT < 0) {
      arcT = 0.1 + Math.random() * 0.4;
      arcs.forEach((a, i) => { const on = Math.random() > 0.45; a.visible(on); if (on) a.set(ends[i][0], ends[i][1], 3); });
    }
  });
}

// ───────────────────────────── SEC-48 開花の丘 ─────────────────────────────
// Night flower meadow: instanced blossoms, aurora, drifting pollen and a colossal mushroom umbrella on the horizon.
function buildBloomHill(ctx: Ctx) {
  const { root, rnd } = ctx;
  const leaves = leafMats();
  ground(ctx, 0x264a2a, 0x0a2a10);
  // Rolling hills.
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * TAU + rnd() * 0.2, r = 90 + rnd() * 80, w = 30 + rnd() * 40;
    const h = mesh(root, new THREE.SphereGeometry(1, 16, 10), std(0x2f5a30, 0, 0.95, { emissive: 0x0c2a12, emissiveIntensity: 0.3 }), Math.cos(a) * r, -2, Math.sin(a) * r);
    h.scale.set(w, 6 + rnd() * 14, w * 0.8);
  }
  // A few thousand blossoms as instanced meshes (stems + heads).
  const N = 420;
  const stemGeo = new THREE.CylinderGeometry(0.07, 0.1, 1, 5).translate(0, 0.5, 0);
  const headGeo = new THREE.SphereGeometry(0.5, 8, 6);
  const stems = new THREE.InstancedMesh(stemGeo, leaves[2], N);
  const heads = new THREE.InstancedMesh(headGeo, basic(0xffffff, { toneMapped: false }), N);
  const dummy = new THREE.Object3D();
  const cols = [0xf472b6, 0xfde047, 0xc084fc, 0xfb7185, 0xf9a8d4, 0x7dd3fc].map((c) => new THREE.Color(c));
  for (let i = 0; i < N; i++) {
    const a = rnd() * TAU, r = 43 + Math.sqrt(rnd()) * 100;
    const x = Math.cos(a) * r, z = Math.sin(a) * r, h = 1.4 + rnd() * 3.6, s = 0.9 + rnd() * 1.4;
    dummy.position.set(x, 0, z); dummy.rotation.set(0, 0, 0); dummy.scale.set(s, h, s); dummy.updateMatrix();
    stems.setMatrixAt(i, dummy.matrix);
    dummy.position.set(x, h, z); dummy.scale.set(s * 1.4, s * 0.9, s * 1.4); dummy.updateMatrix();
    heads.setMatrixAt(i, dummy.matrix);
    heads.setColorAt(i, cols[i % cols.length]);
  }
  stems.instanceMatrix.needsUpdate = true; heads.instanceMatrix.needsUpdate = true;
  if (heads.instanceColor) heads.instanceColor.needsUpdate = true;
  root.add(stems, heads);
  // Tall giants: big trees + glowing mushrooms scattered on the hills.
  const bark = barkMat();
  for (let i = 0; i < 8; i++) { const a = rnd() * TAU, r = 80 + rnd() * 50; bigTree(root, rnd, Math.cos(a) * r, Math.sin(a) * r, 40 + rnd() * 25, 3 + rnd() * 2, bark, leaves); }
  const capCols = [[0xc2410c, 0xfb923c], [0xbe185d, 0xf472b6], [0x6d28d9, 0xc084fc]];
  for (let i = 0; i < 9; i++) { const a = rnd() * TAU, r = 55 + rnd() * 60; const [c, g] = capCols[i % capCols.length]; giantShroom(root, rnd, Math.cos(a) * r, Math.sin(a) * r, 2.5 + rnd() * 2.5, c, g); }
  // The colossal umbrella far to the north: a hint of what waits beyond.
  const far = new THREE.Group(); far.position.set(0, 0, -170); root.add(far);
  mesh(far, new THREE.CylinderGeometry(14, 24, 120, 14), std(0xe8dfc4, 0, 0.8, { emissive: 0xa3e635, emissiveIntensity: 0.14 }), 0, 60, 0);
  const fcap = mesh(far, new THREE.SphereGeometry(80, 28, 12, 0, TAU, 0, Math.PI / 2), std(0xb45309, 0, 0.55, { emissive: 0xea580c, emissiveIntensity: 0.3, side: THREE.DoubleSide }), 0, 118, 0);
  fcap.scale.y = 0.5;
  mesh(far, new THREE.CircleGeometry(80, 32), additive(0xa3e635, 0.3, { side: THREE.DoubleSide, fog: false }), 0, 117, 0, Math.PI / 2);
  glowSprite(far, 0xbef264, 220, 0.25, 0, 100, 0);
  // Aurora curtains.
  const curtains: THREE.Mesh[] = [];
  for (let i = 0; i < 4; i++) curtains.push(mesh(root, new THREE.PlaneGeometry(260, 70), additive(i % 2 ? 0xa3e635 : 0xf9a8d4, 0.06, { side: THREE.DoubleSide, fog: false }), -60 + i * 40, 125, -70 + i * 15, 0, 0.3 * (i - 1.5)));
  pollen(ctx, 0xf9a8d4, 260);
  pollen(ctx, 0xfff08a, 160);
  fireflies(ctx, 0xe9ff7a, 160, [0.5, 14]);
  greenMist(ctx, 0xe0c8f0, 0.06);
  ctx.on((_dt, t) => { curtains.forEach((c, i) => { c.position.x += Math.sin(t * 0.3 + i) * 0.02; (c.material as THREE.MeshBasicMaterial).opacity = 0.05 + 0.03 * Math.sin(t * 0.5 + i); }); });
}

// ───────────────────────────── SEC-49 菌糸の聖域 ─────────────────────────────
// Boss throne: a colossal mushroom canopy overhead, a world-tree stem behind the north wall, glowing mycelium floor rings.
function buildMycoThrone(ctx: Ctx) {
  const { root, rnd } = ctx;
  const leaves = leafMats();
  const stemMat = std(0xe8dfc4, 0, 0.8, { emissive: 0xa3e635, emissiveIntensity: 0.12 });
  ground(ctx, 0x1f3a22, 0x0a2a10);
  // The great stem behind the north wall, rising into an overhead cap.
  const stem = new THREE.Group(); stem.position.set(0, 0, -104); root.add(stem);
  mesh(stem, new THREE.CylinderGeometry(20, 32, 150, 20), stemMat, 0, 75, 0);
  for (let k = 0; k < 7; k++) mesh(stem, new THREE.TorusGeometry(24 + k * 0.4, 1.6, 8, 40), std(0xcbbf9a, 0, 0.8), 0, 24 + k * 18, 0, Math.PI / 2);
  for (let i = 0; i < 6; i++) { // buttress roots
    const a = (i / 6) * TAU;
    const rt = mesh(stem, new THREE.ConeGeometry(8, 36, 6), stemMat, Math.cos(a) * 28, 14, Math.sin(a) * 28);
    rt.rotation.set(Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6);
  }
  const capGroup = new THREE.Group(); capGroup.position.set(0, 150, -40); root.add(capGroup);
  const cap = mesh(capGroup, new THREE.SphereGeometry(150, 40, 16, 0, TAU, 0, Math.PI / 2), std(0xb45309, 0, 0.55, { emissive: 0xea580c, emissiveIntensity: 0.32, side: THREE.DoubleSide }), 0, 0, 0);
  cap.scale.y = 0.42;
  const gillMat = additive(0xbef264, 0.22, { side: THREE.DoubleSide, fog: false });
  mesh(capGroup, new THREE.CircleGeometry(150, 48), additive(0xa3e635, 0.18, { side: THREE.DoubleSide, fog: false }), 0, -0.5, 0, Math.PI / 2);
  for (let i = 0; i < 36; i++) { // glowing gill ribs under the cap
    const rib = mesh(capGroup, new THREE.PlaneGeometry(150, 6), gillMat, 0, -4, 0, Math.PI / 2, (i / 36) * Math.PI, 0);
    rib.position.y = -2.5;
  }
  for (let i = 0; i < 30; i++) { // luminous spots on the cap
    const th = rnd() * TAU, ph = 0.25 + rnd() * 1.1;
    const sp = mesh(capGroup, new THREE.SphereGeometry(4 + rnd() * 6, 10, 8), basic(0xfff3c4, { toneMapped: false, fog: false }), Math.sin(ph) * Math.cos(th) * 150, Math.cos(ph) * 150 * 0.42, Math.sin(ph) * Math.sin(th) * 150);
    sp.scale.y = 0.4;
  }
  // Ring of mid-size glowing mushrooms around the arena.
  const caps = [[0xc2410c, 0xfb923c], [0x0d9488, 0x2dd4bf], [0x7c3aed, 0xc084fc], [0x4d7c0f, 0xbef264]];
  const halos: THREE.Sprite[] = [];
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * TAU + 0.2, r = 58 + (i % 2) * 14;
    const [c, g] = caps[i % caps.length];
    const sh = giantShroom(root, rnd, Math.cos(a) * r, Math.sin(a) * r, 3 + (i % 3), c, g);
    halos.push(sh.children[sh.children.length - 1] as THREE.Sprite);
  }
  for (let i = 0; i < 10; i++) { const a = rnd() * TAU, r = 70 + rnd() * 50; bigTree(root, rnd, Math.cos(a) * r, Math.sin(a) * r, 40 + rnd() * 30, 3 + rnd() * 2, barkMat(), leaves); }
  // Mycelium rings pulsing on the ground and orbiting spore orbs.
  const rings: THREE.Mesh[] = [];
  for (let i = 0; i < 3; i++) rings.push(mesh(root, new THREE.TorusGeometry(46 + i * 14, 0.4, 6, 80), additive(i % 2 ? 0xd9f99d : LIME, 0.5, { fog: false }), 0, 0.12, 0, Math.PI / 2));
  const orbs: { m: THREE.Mesh; r: number; y: number; a0: number; sp: number }[] = [];
  for (let i = 0; i < 22; i++) {
    const m = mesh(root, new THREE.SphereGeometry(0.7 + (i % 3) * 0.3, 8, 8), basic(i % 2 ? 0xfde047 : 0xbef264, { toneMapped: false }));
    orbs.push({ m, r: 52 + (i % 4) * 7, y: 6 + (i % 6) * 5, a0: (i / 22) * TAU, sp: 0.05 + (i % 3) * 0.015 });
  }
  beam(root, new THREE.Vector3(0, 140, -60), new THREE.Vector3(0, 0, -20), 3, 26, 0xd9f99d, 0.07);
  beam(root, new THREE.Vector3(-40, 130, -50), new THREE.Vector3(-26, 0, -14), 2, 14, 0xbef264, 0.05);
  beam(root, new THREE.Vector3(44, 130, -50), new THREE.Vector3(30, 0, -14), 2, 14, 0xbef264, 0.05);
  particles(ctx, { count: 320, size: 0.3, color: 0xe9ff7a, opacity: 0.75, half: [64, 64], y: [0.5, 70], mode: 'rise', speed: 0.9, sway: 0.6 });
  particles(ctx, { count: 160, size: 0.34, color: 0xfde047, opacity: 0.7, half: [64, 64], y: [0.5, 70], mode: 'fall', speed: 0.7, sway: 0.8 });
  fireflies(ctx, 0xc084fc, 90, [1, 30]);
  greenMist(ctx, 0xb8f0a0, 0.07);
  ctx.on((_dt, t) => {
    halos.forEach((h, i) => { (h.material as THREE.SpriteMaterial).opacity = 0.26 + 0.12 * Math.sin(t * 1.2 + i * 1.4); });
    rings.forEach((r, i) => { (r.material as THREE.MeshBasicMaterial).opacity = 0.3 + 0.25 * Math.sin(t * 1.6 - i * 1.1); });
    orbs.forEach((o, i) => {
      const a = o.a0 + t * o.sp;
      o.m.position.set(Math.cos(a) * o.r, o.y + Math.sin(t * 0.9 + i) * 1.4, Math.sin(a) * o.r);
    });
    capGroup.rotation.y = Math.sin(t * 0.03) * 0.02;
    ctx.hemi.intensity = 0.86 + Math.sin(t * 0.5) * 0.05;
  });
}

export const OVERGROW_BUILDERS: Record<OvergrowId, (ctx: Ctx) => void> = {
  canopy: buildCanopy, greenhouse: buildGreenhouse, mycelium: buildMycelium, swamp: buildSwamp,
  rootworks: buildRootworks, bloomhill: buildBloomHill, mycothrone: buildMycoThrone,
};
