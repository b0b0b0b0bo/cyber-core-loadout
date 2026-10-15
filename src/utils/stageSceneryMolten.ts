import * as THREE from 'three';
import {
  std, basic, additive, mesh, box, glowSprite, beam, particles, softDot,
} from './stageScenery';
import type { Ctx, SceneryConfig } from './stageScenery';

/**
 * MAP 8 MOLTEN FOUNDRY — a volcanic city of smelters, lava rivers and blast furnaces (SEC-50 .. SEC-56).
 * Everything is visual set dressing outside the arena walls (|x|,|z| > 41) or overhead.
 */

type MoltenId = 'ashfall' | 'smeltery' | 'lavafalls' | 'slagyard' | 'furnace' | 'forgehall' | 'magmacore';

export const MOLTEN_CONFIG: Record<MoltenId, SceneryConfig> = {
  ashfall: {
    sky: {
      top: 0x1a0d0a, horizon: 0xc2532a, bottom: 0x120806, exponent: 0.55, stars: 0.004,
      clouds: { color: 0x4a3028, coverage: 0.7, speed: 0.01, opacity: 0.85 }, horizonGlow: { color: 0xff7a2a, strength: 0.55 },
    },
    fogColor: 0x3a1c14, fogDensity: 0.0125,
    ambient: [0xffc8a0, 0.5], hemi: [0xff9a60, 0x1a0c08, 0.78],
    sun: { color: 0xff9a50, intensity: 0.9, pos: [-40, 30, -50] },
    wallHeight: 3, gridOpacity: 0.2, cornerLight: [0xf97316, 2.0],
    floorTint: 0xd0b8a8, env: 'sky', envIntensity: 0.8,
  },
  smeltery: {
    sky: { top: 0x0e0806, horizon: 0x4a2412, bottom: 0x0a0604 },
    fogColor: 0x2a140c, fogDensity: 0.0118,
    ambient: [0xffc890, 0.54], hemi: [0xffa860, 0x1a0e08, 0.8],
    sun: { color: 0xffb070, intensity: 0.8, pos: [10, 40, 5] },
    wallHeight: 10, gridOpacity: 0.22, cornerLight: [0xfb923c, 2.5],
    floorTint: 0xc8b0a0, env: 'hemi', envIntensity: 0.85,
  },
  lavafalls: {
    sky: {
      top: 0x1c0c0c, horizon: 0xe0662a, bottom: 0x150806, exponent: 0.5, stars: 0.006,
      horizonGlow: { color: 0xffa050, strength: 0.6 }, clouds: { color: 0x5a3228, coverage: 0.45, speed: 0.008, opacity: 0.6 },
    },
    fogColor: 0x4a2418, fogDensity: 0.0108,
    ambient: [0xffd0a8, 0.56], hemi: [0xffa070, 0x1c0e08, 0.82],
    sun: { color: 0xffa860, intensity: 1.0, pos: [30, 36, -60] },
    wallHeight: 2.4, gridOpacity: 0.24, cornerLight: [0xf97316, 2.2],
    floorTint: 0xd4b8a4, env: 'sky', envIntensity: 0.85,
  },
  slagyard: {
    sky: {
      top: 0x120a0c, horizon: 0x9a3a22, bottom: 0x0c0606, exponent: 0.55, stars: 0.01,
      clouds: { color: 0x3a2622, coverage: 0.55, speed: 0.012, opacity: 0.75 }, horizonGlow: { color: 0xff6a30, strength: 0.5 },
    },
    fogColor: 0x321a14, fogDensity: 0.0125,
    ambient: [0xffc8a8, 0.5], hemi: [0xff9a68, 0x180c0a, 0.78],
    sun: { color: 0xff9060, intensity: 0.85, pos: [-30, 28, 40] },
    wallHeight: 3, gridOpacity: 0.22, cornerLight: [0xfb923c, 2.2],
    floorTint: 0xc4b0a4, env: 'sky', envIntensity: 0.8,
  },
  furnace: {
    sky: { top: 0x0a0504, horizon: 0x3c1a0c, bottom: 0x080403 },
    fogColor: 0x2c1408, fogDensity: 0.0128,
    ambient: [0xffc080, 0.56], hemi: [0xff9850, 0x1c0e06, 0.84],
    sun: { color: 0xffa860, intensity: 0.9, pos: [0, 40, 0] },
    wallHeight: 14, gridOpacity: 0.24, cornerLight: [0xf97316, 2.8],
    floorTint: 0xc8aa94, env: 'hemi', envIntensity: 0.9,
  },
  forgehall: {
    sky: { top: 0x0c0706, horizon: 0x40200e, bottom: 0x090504 },
    fogColor: 0x2a160c, fogDensity: 0.0115,
    ambient: [0xffd2a0, 0.58], hemi: [0xffb070, 0x1a0e08, 0.84],
    sun: { color: 0xffb878, intensity: 0.85, pos: [-10, 40, 10] },
    wallHeight: 12, gridOpacity: 0.24, cornerLight: [0xfbbf24, 2.6],
    floorTint: 0xccb4a0, env: 'hemi', envIntensity: 0.88,
  },
  magmacore: {
    sky: {
      top: 0x080306, horizon: 0x7a2412, bottom: 0x060203, exponent: 0.5, stars: 0.02,
      nebula: { a: 0xea580c, b: 0xdc2626, strength: 0.35 }, horizonGlow: { color: 0xff6a20, strength: 0.65 },
    },
    fogColor: 0x2a0e08, fogDensity: 0.0098,
    ambient: [0xffc8a0, 0.58], hemi: [0xff9060, 0x160a06, 0.86],
    sun: { color: 0xffa070, intensity: 1.0, pos: [0, 40, -60] },
    wallHeight: 2.4, gridOpacity: 0.28, cornerLight: [0xf97316, 2.6],
    floorTint: 0xc8b0a0, env: 'sky', envIntensity: 0.9,
  },
};

const TAU = Math.PI * 2;
const ORANGE = 0xf97316;

// ───────────────────────────── shared helpers ─────────────────────────────

const rockMat = (color = 0x2a2220) => std(color, 0.2, 0.92, { flatShading: true, emissive: 0x1a0804, emissiveIntensity: 0.4 });
const steelMat = (color = 0x4a423e) => std(color, 0.7, 0.45, { emissive: 0x1a0c06, emissiveIntensity: 0.3 });
const lavaMat = (color = 0xff6a1a) => basic(color, { toneMapped: false, fog: false });

/** Dark ash plain under the arena. */
const ground = (ctx: Ctx, color = 0x1c1412, emissive = 0x240c04) =>
  mesh(ctx.root, new THREE.PlaneGeometry(600, 600), std(color, 0, 0.95, { emissive, emissiveIntensity: 0.4 }), 0, -0.3, 0, -Math.PI / 2);

/** Glowing lava pools (flat discs) that breathe; returns them for the caller's animation. */
function lavaPools(ctx: Ctx, count: number, rMin: number, rMax: number, sizeMin: number, sizeMax: number) {
  const { root, rnd } = ctx;
  const pools: THREE.Mesh[] = [];
  for (let i = 0; i < count; i++) {
    const a = rnd() * TAU, r = rMin + rnd() * (rMax - rMin), s = sizeMin + rnd() * (sizeMax - sizeMin);
    const p = mesh(root, new THREE.CircleGeometry(s, 24), lavaMat(i % 3 ? 0xff5a14 : 0xff7a22), Math.cos(a) * r, -0.12, Math.sin(a) * r, -Math.PI / 2);
    p.scale.y = 0.6 + rnd() * 0.7;
    glowSprite(root, 0xff7a22, s * 3.4, 0.3, p.position.x, 1.0, p.position.z);
    pools.push(p);
  }
  return pools;
}

/** Lava river: a chain of glowing slabs following the given points. */
function lavaRiver(parent: THREE.Object3D, pts: [number, number][], width: number, y = -0.1) {
  const mats: THREE.MeshBasicMaterial[] = [];
  for (let i = 1; i < pts.length; i++) {
    const [x0, z0] = pts[i - 1], [x1, z1] = pts[i];
    const len = Math.hypot(x1 - x0, z1 - z0) + width * 0.4;
    const mat = lavaMat(i % 2 ? 0xff5a14 : 0xff7a22) as THREE.MeshBasicMaterial;
    mats.push(mat);
    mesh(parent, new THREE.BoxGeometry(width, 0.3, len), mat, (x0 + x1) / 2, y, (z0 + z1) / 2, 0, Math.atan2(x1 - x0, z1 - z0), 0);
  }
  return mats;
}

/** Volcano silhouette with a glowing crater and lava streaks down its flanks. */
function volcano(parent: THREE.Object3D, rnd: () => number, x: number, z: number, h: number, r: number) {
  const g = new THREE.Group(); g.position.set(x, 0, z); parent.add(g);
  mesh(g, new THREE.ConeGeometry(r, h, 10, 1, true), rockMat(0x241a18), 0, h / 2, 0);
  mesh(g, new THREE.CylinderGeometry(r * 0.2, r * 0.26, h * 0.08, 10), lavaMat(0xff6a1a), 0, h * 0.96, 0);
  for (let i = 0; i < 5; i++) {
    const a = rnd() * TAU, len = h * (0.35 + rnd() * 0.4);
    const streak = mesh(g, new THREE.BoxGeometry(r * 0.05, len, r * 0.03), lavaMat(0xff7a22),
      Math.cos(a) * r * 0.16, h * 0.94 - len * 0.45, Math.sin(a) * r * 0.16);
    streak.rotation.set(Math.sin(a) * 0.55, 0, -Math.cos(a) * 0.55);
  }
  const halo = glowSprite(g, 0xff6a1a, r * 1.6, 0.4, 0, h * 1.02, 0);
  return { g, halo };
}

/** Tapered smokestack with glowing bands and a hot top ring. */
function smokestack(parent: THREE.Object3D, x: number, z: number, h: number, r: number) {
  const g = new THREE.Group(); g.position.set(x, 0, z); parent.add(g);
  mesh(g, new THREE.CylinderGeometry(r * 0.7, r, h, 12), steelMat(0x3a3430), 0, h / 2, 0);
  for (let k = 1; k <= 3; k++) mesh(g, new THREE.TorusGeometry(r * (1 - 0.1 * k * (h > 30 ? 0.7 : 1)), 0.25, 6, 20), steelMat(0x5a4e46), 0, h * (k / 4), 0, Math.PI / 2);
  mesh(g, new THREE.TorusGeometry(r * 0.72, 0.35, 8, 24), lavaMat(0xff7a22), 0, h, 0, Math.PI / 2);
  mesh(g, new THREE.CircleGeometry(r * 0.66, 20), lavaMat(0xff5a14), 0, h - 0.1, 0, -Math.PI / 2);
  glowSprite(g, 0xff7a22, r * 6, 0.3, 0, h + 1, 0);
  return g;
}

/** Cylindrical blast furnace: banded drum, glowing slit windows, side pipes. */
function blastFurnace(parent: THREE.Object3D, x: number, z: number, s: number, ry: number) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; parent.add(g);
  mesh(g, new THREE.CylinderGeometry(s * 0.9, s * 1.05, s * 3.2, 14), steelMat(0x403632), 0, s * 1.6, 0);
  mesh(g, new THREE.CylinderGeometry(s * 0.5, s * 0.9, s * 0.9, 14), steelMat(0x4e423c), 0, s * 3.65, 0);
  for (let k = 0; k < 4; k++) mesh(g, new THREE.TorusGeometry(s * (1.0 - k * 0.01), s * 0.07, 6, 24), steelMat(0x6a5a50), 0, s * (0.6 + k * 0.75), 0, Math.PI / 2);
  for (let k = 0; k < 3; k++) box(g, s * 0.9, s * 0.09, s * 0.08, lavaMat(0xff8a2a), 0, s * (1.0 + k * 0.7), -s * 0.98);
  glowSprite(g, 0xff7a22, s * 4.5, 0.26, 0, s * 1.8, -s * 1.1);
  for (const sx of [-1, 1]) mesh(g, new THREE.CylinderGeometry(s * 0.12, s * 0.12, s * 3.4, 8), steelMat(0x5a4e46), sx * s * 1.2, s * 1.7, 0.3 * s);
  return g;
}

/** Gantry crane frame (two legs, a beam and a trolley with a hanging hook). */
function gantry(parent: THREE.Object3D, x: number, z: number, w: number, h: number, ry: number) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; parent.add(g);
  const m = steelMat(0x4a3e36);
  for (const sx of [-1, 1]) box(g, 1.6, h, 1.6, m, sx * w / 2, h / 2, 0);
  box(g, w + 3, 2.0, 2.4, m, 0, h, 0);
  const trolley = new THREE.Group(); trolley.position.set(0, h - 1.6, 0); g.add(trolley);
  box(trolley, 3, 1.4, 2.6, steelMat(0x5a4a40), 0, 0, 0);
  const cable = mesh(trolley, new THREE.CylinderGeometry(0.1, 0.1, h * 0.45, 6), steelMat(0x2a2420), 0, -h * 0.225, 0);
  const hook = mesh(trolley, new THREE.TorusGeometry(0.9, 0.24, 8, 14, Math.PI * 1.4), steelMat(0x6a5a50), 0, -h * 0.45 - 0.8, 0);
  mesh(trolley, new THREE.SphereGeometry(0.6, 10, 8), lavaMat(0xff7a22), 0, -h * 0.45 - 2.2, 0);
  return { g, trolley, cable, hook };
}

/** Soft dark smoke puffs rising from a point, recycled in place. */
function smokePlume(ctx: Ctx, x: number, y: number, z: number, scale: number, count = 6) {
  const sprites: THREE.Sprite[] = [];
  for (let i = 0; i < count; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot(), color: 0x2a1c18, transparent: true, opacity: 0.5, depthWrite: false, fog: true }));
    ctx.root.add(s);
    sprites.push(s);
  }
  ctx.on((_dt, t) => {
    sprites.forEach((s, i) => {
      const k = ((t * 0.07 + i / count) % 1);
      s.position.set(x + Math.sin(k * 5 + i) * scale * 0.6 * k, y + k * scale * 5, z + Math.cos(k * 4 + i) * scale * 0.5 * k);
      const sz = scale * (1.2 + k * 3.2);
      s.scale.set(sz, sz, 1);
      (s.material as THREE.SpriteMaterial).opacity = 0.5 * Math.sin(Math.min(1, k * 1.15) * Math.PI) * (1 - k * 0.3);
    });
  });
}

const emberRise = (ctx: Ctx, count = 220, half = 64, top = 60) => {
  particles(ctx, { count, size: 0.34, color: 0xff7a22, opacity: 0.85, half: [half, half], y: [0.5, top], mode: 'rise', speed: 1.8, sway: 0.7 });
  particles(ctx, { count: Math.round(count * 0.45), size: 0.26, color: 0xffd27a, opacity: 0.8, half: [half, half], y: [0.5, top], mode: 'rise', speed: 2.6, sway: 0.5 });
};
const ashFall = (ctx: Ctx, count = 260, half = 64, top = 55) =>
  particles(ctx, { count, size: 0.3, color: 0x8a7a72, opacity: 0.5, half: [half, half], y: [0.5, top], mode: 'fall', speed: 0.9, sway: 1.0 });

const pulseMats = (ctx: Ctx, mats: THREE.MeshBasicMaterial[], base = 0xff5a14, hot = 0xffa04a, speed = 1.4) => {
  const a = new THREE.Color(base), b = new THREE.Color(hot);
  ctx.on((_dt, t) => mats.forEach((m, i) => m.color.copy(a).lerp(b, 0.5 + 0.5 * Math.sin(t * speed + i * 1.3))));
};

// ───────────────────────────── stages ─────────────────────────────

function buildAshfall(ctx: Ctx) {
  const { root, rnd } = ctx;
  ground(ctx, 0x1a1311);
  const halos: THREE.Sprite[] = [];
  // a ring of volcanoes on the horizon, one erupting beyond the north wall
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * TAU + 0.3, r = 120 + (i % 3) * 18;
    const v = volcano(root, rnd, Math.cos(a) * r, Math.sin(a) * r, 46 + rnd() * 40, 34 + rnd() * 22);
    halos.push(v.halo);
  }
  for (let i = 0; i < 26; i++) { // black basalt spires
    const a = rnd() * TAU, r = 58 + rnd() * 50, h = 8 + rnd() * 22;
    const sp = mesh(root, new THREE.ConeGeometry(2 + rnd() * 3, h, 5), rockMat(), Math.cos(a) * r, h / 2 - 0.3, Math.sin(a) * r);
    sp.rotation.set((rnd() - 0.5) * 0.25, rnd() * TAU, (rnd() - 0.5) * 0.25);
  }
  const pools = lavaPools(ctx, 14, 52, 100, 4, 11);
  const rivers = [
    ...lavaRiver(root, [[-100, -50], [-70, -58], [-52, -80], [-30, -120]], 5),
    ...lavaRiver(root, [[96, 20], [74, 38], [60, 70], [70, 110]], 4.5),
  ];
  pulseMats(ctx, rivers);
  for (let i = 0; i < 3; i++) smokePlume(ctx, Math.cos(i * 2.1) * 130, 38, Math.sin(i * 2.1) * 130, 10);
  beam(root, new THREE.Vector3(0, 120, -140), new THREE.Vector3(0, 0, -90), 6, 30, 0xff7a30, 0.06);
  ashFall(ctx); emberRise(ctx, 160);
  ctx.on((_dt, t) => {
    halos.forEach((h, i) => { (h.material as THREE.SpriteMaterial).opacity = 0.34 + 0.14 * Math.sin(t * 0.9 + i * 1.7); });
    pools.forEach((p, i) => { (p.material as THREE.MeshBasicMaterial).color.setHex(0xff5a14).lerp(new THREE.Color(0xffa04a), 0.5 + 0.5 * Math.sin(t * 1.1 + i)); });
    ctx.hemi.intensity = 0.78 + Math.sin(t * 0.6) * 0.05;
  });
}

function buildSmeltery(ctx: Ctx) {
  const { root, rnd } = ctx;
  ground(ctx, 0x1e1512);
  for (let i = 0; i < 10; i++) { // smokestacks around the compound
    const a = (i / 10) * TAU + 0.15, r = 62 + (i % 2) * 14;
    smokestack(root, Math.cos(a) * r, Math.sin(a) * r, 34 + (i % 4) * 8, 3.2 + (i % 3) * 0.6);
    if (i % 2 === 0) smokePlume(ctx, Math.cos(a) * r, 36 + (i % 4) * 8, Math.sin(a) * r, 6);
  }
  const hooks: { trolley: THREE.Group; ph: number }[] = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + 0.7;
    const gt = gantry(root, Math.cos(a) * 54, Math.sin(a) * 54, 24, 22, -a + Math.PI / 2);
    hooks.push({ trolley: gt.trolley, ph: i * 1.7 });
  }
  for (let i = 0; i < 6; i++) blastFurnace(root, Math.cos(i * 1.05 + 0.4) * 78, Math.sin(i * 1.05 + 0.4) * 78, 5 + (i % 2) * 2, i);
  // conveyor of glowing ingots on an elevated belt
  box(root, 120, 1.0, 3, steelMat(0x3e3430), 0, 10, -58);
  const ingots: THREE.Mesh[] = [];
  for (let i = 0; i < 14; i++) ingots.push(mesh(root, new THREE.BoxGeometry(2.4, 1, 1.6), lavaMat(0xff7a22), 0, 10.9, -58));
  const rivers = lavaRiver(root, [[-90, 52], [-50, 60], [0, 66], [50, 60], [90, 52]], 5);
  pulseMats(ctx, rivers);
  emberRise(ctx, 200, 70, 50);
  ctx.on((_dt, t) => {
    hooks.forEach((h) => { h.trolley.position.x = Math.sin(t * 0.25 + h.ph) * 8; });
    ingots.forEach((m, i) => { m.position.x = (((t * 4 + i * 8.6) % 120) + 120) % 120 - 60; });
    ctx.hemi.intensity = 0.8 + Math.sin(t * 0.7) * 0.05;
  });
  void rnd;
}

function buildLavaFalls(ctx: Ctx) {
  const { root, rnd } = ctx;
  ground(ctx, 0x1c1411);
  // sheer cliffs on both sides with lava waterfalls pouring into a glowing sea
  const fallMats: THREE.MeshBasicMaterial[] = [];
  for (const sx of [-1, 1]) {
    box(root, 30, 90, 200, rockMat(0x261c1a), sx * 92, 45, 0);
    for (let i = 0; i < 4; i++) {
      const z = -66 + i * 44, w = 8 + (i % 2) * 5;
      const mat = lavaMat(0xff6a1a) as THREE.MeshBasicMaterial;
      fallMats.push(mat);
      mesh(root, new THREE.PlaneGeometry(w, 78), mat, sx * 76.6, 40, z, 0, -sx * Math.PI / 2, 0);
      glowSprite(root, 0xff7a22, w * 3, 0.32, sx * 74, 4, z);
      mesh(root, new THREE.CircleGeometry(w * 1.1, 18), lavaMat(0xffb04a), sx * 73, 0.05, z, -Math.PI / 2);
    }
  }
  // distant mesas
  for (let i = 0; i < 12; i++) {
    const a = rnd() * TAU, r = 118 + rnd() * 30, h = 20 + rnd() * 30;
    box(root, 14 + rnd() * 20, h, 14 + rnd() * 20, rockMat(0x2a201e), Math.cos(a) * r, h / 2 - 0.3, Math.sin(a) * r, 0, rnd() * TAU, 0);
  }
  const rivers = lavaRiver(root, [[-60, 90], [-30, 70], [0, 62], [30, 72], [60, 92]], 8);
  pulseMats(ctx, rivers);
  const pools = lavaPools(ctx, 10, 54, 90, 4, 9);
  smokePlume(ctx, 0, 6, -100, 12, 8);
  beam(root, new THREE.Vector3(-30, 110, -90), new THREE.Vector3(-20, 0, -40), 4, 22, 0xffa050, 0.05);
  beam(root, new THREE.Vector3(34, 110, -90), new THREE.Vector3(22, 0, -40), 4, 22, 0xffa050, 0.05);
  emberRise(ctx, 240, 64, 70);
  ctx.on((_dt, t) => {
    const a = new THREE.Color(0xff5a14), b = new THREE.Color(0xffa04a);
    fallMats.forEach((m, i) => m.color.copy(a).lerp(b, 0.5 + 0.5 * Math.sin(t * 2.2 + i * 1.3)));
    pools.forEach((p, i) => (p.material as THREE.MeshBasicMaterial).color.copy(a).lerp(b, 0.5 + 0.5 * Math.sin(t * 1.2 + i)));
    ctx.hemi.intensity = 0.82 + Math.sin(t * 0.5) * 0.05;
  });
}

function buildSlagYard(ctx: Ctx) {
  const { root, rnd } = ctx;
  ground(ctx, 0x1a1210);
  const heaps: THREE.Sprite[] = [];
  for (let i = 0; i < 16; i++) { // slag heaps with glowing fissures
    const a = rnd() * TAU, r = 56 + rnd() * 52, h = 8 + rnd() * 20, rr = 8 + rnd() * 12;
    const hx = Math.cos(a) * r, hz = Math.sin(a) * r;
    mesh(root, new THREE.ConeGeometry(rr, h, 7), rockMat(0x2c2220), hx, h / 2 - 0.3, hz, 0, rnd() * TAU, 0);
    for (let k = 0; k < 3; k++) {
      const b = rnd() * TAU;
      box(root, 0.5, h * 0.6, 0.3, lavaMat(0xff6a1a), hx + Math.cos(b) * rr * 0.35, h * 0.42, hz + Math.sin(b) * rr * 0.35, Math.sin(b) * 0.6, 0, -Math.cos(b) * 0.6);
    }
    if (i % 3 === 0) heaps.push(glowSprite(root, 0xff6a1a, rr * 2.4, 0.26, hx, h * 0.4, hz));
  }
  const rails: THREE.Mesh[] = [];
  const ladle = new THREE.Group(); ladle.position.set(0, 0, -64); root.add(ladle); // slag ladle car on rails
  box(root, 140, 0.4, 0.5, steelMat(0x2a2420), 0, 0.2, -61);
  box(root, 140, 0.4, 0.5, steelMat(0x2a2420), 0, 0.2, -67);
  box(ladle, 9, 1.4, 8, steelMat(0x3a322e), 0, 1.4, 0);
  mesh(ladle, new THREE.CylinderGeometry(5, 3.6, 6, 14), steelMat(0x4a403a), 0, 5, 0);
  mesh(ladle, new THREE.CircleGeometry(4.7, 18), lavaMat(0xff7a22), 0, 8.02, 0, -Math.PI / 2);
  glowSprite(ladle, 0xff7a22, 16, 0.4, 0, 8.6, 0);
  rails.push(ladle as unknown as THREE.Mesh);
  for (let i = 0; i < 3; i++) gantry(root, -50 + i * 50, 74, 22, 20 + (i % 2) * 6, 0);
  for (let i = 0; i < 6; i++) smokestack(root, Math.cos(i * 1.05) * 110, Math.sin(i * 1.05) * 110, 40, 3.4);
  const rivers = lavaRiver(root, [[-100, 20], [-72, 30], [-60, 50], [-66, 90]], 4);
  pulseMats(ctx, rivers);
  const spot = (x: number, z: number) => beam(root, new THREE.Vector3(x, 60, z - 30), new THREE.Vector3(x * 0.5, 0, z * 0.5), 1.5, 14, 0xffd9a0, 0.05);
  spot(-70, 62); spot(70, 62); spot(0, -80);
  ashFall(ctx, 200); emberRise(ctx, 170);
  ctx.on((_dt, t) => {
    ladle.position.x = Math.sin(t * 0.08) * 56;
    heaps.forEach((h, i) => { (h.material as THREE.SpriteMaterial).opacity = 0.22 + 0.1 * Math.sin(t * 1.1 + i * 2); });
    ctx.hemi.intensity = 0.78 + Math.sin(t * 0.6) * 0.05;
  });
  void rails;
}

function buildFurnace(ctx: Ctx) {
  const { root, rnd } = ctx;
  ground(ctx, 0x1a1210, 0x2a0c04);
  // enclosing furnace wall: ring of tall glowing windows and vertical pipes
  const wins: THREE.MeshBasicMaterial[] = [];
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * TAU, r = 66;
    const g = new THREE.Group(); g.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); g.rotation.y = -a + Math.PI / 2; root.add(g);
    box(g, 12, 44, 6, steelMat(0x362e2a), 0, 22, 0);
    const wm = lavaMat(0xff6a1a) as THREE.MeshBasicMaterial; wins.push(wm);
    box(g, 6, 20, 0.5, wm, 0, 20, -3.2);
    for (let k = 0; k < 5; k++) box(g, 6.4, 0.5, 0.7, steelMat(0x1c1614), 0, 12 + k * 4, -3.3);
    glowSprite(g, 0xff7a22, 24, 0.3, 0, 20, -5);
    if (i % 2) mesh(g, new THREE.CylinderGeometry(0.9, 0.9, 52, 8), steelMat(0x5a4e46), 5.2, 26, -2.4);
  }
  // overhead: great ring and a descending shaft of furnace light
  const rings: THREE.Mesh[] = [];
  for (let k = 0; k < 3; k++) rings.push(mesh(root, new THREE.TorusGeometry(40 + k * 12, 1.2, 8, 72), lavaMat(k % 2 ? 0xffa04a : 0xff6a1a), 0, 56 + k * 5, 0, Math.PI / 2));
  beam(root, new THREE.Vector3(0, 70, 0), new THREE.Vector3(0, 0, 0), 4, 34, 0xffa860, 0.07);
  beam(root, new THREE.Vector3(-30, 66, -20), new THREE.Vector3(-20, 0, -10), 2, 16, 0xff9050, 0.05);
  beam(root, new THREE.Vector3(30, 66, -20), new THREE.Vector3(20, 0, -10), 2, 16, 0xff9050, 0.05);
  const arcs: THREE.Mesh[] = [];
  for (let i = 0; i < 8; i++) { // glowing pipe loops crossing the ceiling
    const a = rnd() * TAU;
    arcs.push(mesh(root, new THREE.TorusGeometry(18 + rnd() * 10, 0.6, 6, 36, Math.PI), steelMat(0x5a4e46), Math.cos(a) * 40, 38, Math.sin(a) * 40, 0, a, 0));
  }
  emberRise(ctx, 260, 60, 50);
  particles(ctx, { count: 120, size: 0.4, color: 0xffd27a, opacity: 0.8, half: [60, 60], y: [0.5, 40], mode: 'drift', speed: 1.0, sway: 1.2 });
  ctx.on((_dt, t) => {
    const a = new THREE.Color(0xff5a14), b = new THREE.Color(0xffb04a);
    wins.forEach((m, i) => m.color.copy(a).lerp(b, 0.5 + 0.5 * Math.sin(t * 1.6 + i * 0.8)));
    rings.forEach((r, i) => { r.rotation.z = t * (0.04 + i * 0.015) * (i % 2 ? -1 : 1); });
    ctx.hemi.intensity = 0.84 + Math.sin(t * 0.9) * 0.06;
  });
  void arcs;
}

function buildForgeHall(ctx: Ctx) {
  const { root, rnd } = ctx;
  ground(ctx, 0x1c1311);
  // colossal drop-hammers on both sides, pounding in turn
  const hammers: { head: THREE.Group; ph: number }[] = [];
  for (let i = 0; i < 6; i++) {
    const sx = i % 2 ? 1 : -1, z = -52 + Math.floor(i / 2) * 48;
    const g = new THREE.Group(); g.position.set(sx * 66, 0, z); root.add(g);
    box(g, 12, 3, 12, steelMat(0x3a322e), 0, 1.5, 0);                  // anvil block
    mesh(g, new THREE.CylinderGeometry(3.2, 4.4, 5, 10), steelMat(0x4a403a), 0, 5.5, 0);
    box(g, 4, 1.2, 10, lavaMat(0xff7a22), 0, 8.2, 0);                  // glowing billet
    for (const px of [-1, 1]) box(g, 2, 46, 2, steelMat(0x4a3e36), px * 6, 23, -6);
    box(g, 16, 3, 3, steelMat(0x4a3e36), 0, 46, -6);
    const head = new THREE.Group(); head.position.set(0, 24, 0); g.add(head);
    box(head, 6, 5, 6, steelMat(0x5a4c44), 0, 0, 0);
    mesh(head, new THREE.CylinderGeometry(0.7, 0.7, 20, 8), steelMat(0x6a5a50), 0, 12.5, 0);
    glowSprite(g, 0xff7a22, 16, 0.3, 0, 9, 0);
    hammers.push({ head, ph: i * 1.3 });
  }
  // casting moulds and molten channels
  for (let i = 0; i < 8; i++) {
    const a = rnd() * TAU, r = 60 + rnd() * 40;
    box(root, 8 + rnd() * 6, 4, 8 + rnd() * 6, rockMat(0x2c2422), Math.cos(a) * r, 2, Math.sin(a) * r, 0, rnd() * TAU, 0);
  }
  const rivers = [...lavaRiver(root, [[-100, 70], [-50, 76], [0, 80], [50, 76], [100, 70]], 4), ...lavaRiver(root, [[-100, -84], [0, -90], [100, -84]], 4)];
  pulseMats(ctx, rivers);
  // hall roof trusses
  for (let i = 0; i < 7; i++) box(root, 150, 2, 2, steelMat(0x3a322e), 0, 52, -60 + i * 20);
  beam(root, new THREE.Vector3(0, 74, -30), new THREE.Vector3(0, 0, -10), 3, 28, 0xffb878, 0.06);
  const sparks = particles(ctx, { count: 160, size: 0.3, color: 0xffd27a, opacity: 0.9, half: [50, 50], y: [0.5, 24], mode: 'rise', speed: 5.0, sway: 0.4 });
  emberRise(ctx, 160, 60, 45);
  ctx.on((_dt, t) => {
    hammers.forEach((h) => {
      const k = Math.max(0, Math.sin(t * 1.1 + h.ph));
      h.head.position.y = 6.5 + (1 - Math.pow(k, 0.5)) * 17;
    });
    ctx.hemi.intensity = 0.84 + Math.sin(t * 0.8) * 0.05;
  });
  void sparks;
}

function buildMagmaCore(ctx: Ctx) {
  const { root, rnd } = ctx;
  ground(ctx, 0x180f0d, 0x2c0c04);
  // the great core: a colossal molten sphere in rotating rings behind the north wall
  const core = new THREE.Group(); core.position.set(0, 70, -140); root.add(core);
  const orb = mesh(core, new THREE.SphereGeometry(30, 32, 24), lavaMat(0xff6a1a));
  mesh(core, new THREE.SphereGeometry(20, 28, 20), lavaMat(0xffb04a));
  mesh(core, new THREE.SphereGeometry(10, 20, 16), lavaMat(0xfff1c2));
  glowSprite(core, 0xff7a22, 170, 0.5, 0, 0, 0);
  glowSprite(core, 0xffa04a, 260, 0.2, 0, 0, 0);
  const rings: THREE.Mesh[] = [];
  for (let k = 0; k < 4; k++) {
    const ring = mesh(core, new THREE.TorusGeometry(40 + k * 10, 1.5 + k * 0.3, 10, 80), k % 2 ? steelMat(0x5a4c44) : lavaMat(0xff7a22));
    ring.rotation.set(Math.PI / 2 + k * 0.5, k * 0.7, 0);
    rings.push(ring);
  }
  // lava lake all round the arena with rock pillars and basalt islands
  const pools = lavaPools(ctx, 22, 50, 110, 5, 16);
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * TAU, r = 60 + (i % 3) * 14, h = 14 + rnd() * 26;
    const pil = mesh(root, new THREE.CylinderGeometry(3 + rnd() * 3, 5 + rnd() * 3, h, 6), rockMat(0x2a201e), Math.cos(a) * r, h / 2 - 0.3, Math.sin(a) * r);
    pil.rotation.y = rnd() * TAU;
    box(root, 0.6, h * 0.8, 0.4, lavaMat(0xff6a1a), Math.cos(a) * r + 2.2, h * 0.5, Math.sin(a) * r);
  }
  const rivers = [
    ...lavaRiver(root, [[-110, 30], [-80, 40], [-62, 64], [-70, 110]], 6),
    ...lavaRiver(root, [[110, 30], [80, 44], [64, 70], [76, 110]], 6),
    ...lavaRiver(root, [[-40, -112], [-20, -80], [20, -80], [40, -112]], 5),
  ];
  pulseMats(ctx, rivers);
  const columns: { m: THREE.Mesh; r: number; a0: number; sp: number }[] = [];
  for (let i = 0; i < 14; i++) { // floating molten debris orbiting the arena
    const m = mesh(root, new THREE.DodecahedronGeometry(1.2 + (i % 3) * 0.6, 0), i % 2 ? rockMat(0x3a2c28) : lavaMat(0xff7a22));
    columns.push({ m, r: 50 + (i % 4) * 8, a0: (i / 14) * TAU, sp: 0.04 + (i % 3) * 0.015 });
  }
  beam(root, new THREE.Vector3(0, 90, -120), new THREE.Vector3(0, 0, -30), 5, 38, 0xff8a40, 0.07);
  beam(root, new THREE.Vector3(-46, 80, -100), new THREE.Vector3(-30, 0, -20), 3, 20, 0xff7a30, 0.05);
  beam(root, new THREE.Vector3(46, 80, -100), new THREE.Vector3(30, 0, -20), 3, 20, 0xff7a30, 0.05);
  emberRise(ctx, 340, 70, 70); ashFall(ctx, 140, 70, 60);
  ctx.on((_dt, t) => {
    rings.forEach((r, i) => { r.rotation.z = t * (0.08 + i * 0.03) * (i % 2 ? -1 : 1); });
    (orb.material as THREE.MeshBasicMaterial).color.setHex(0xff5a14).lerp(new THREE.Color(0xff9a3a), 0.5 + 0.5 * Math.sin(t * 1.3));
    pools.forEach((p, i) => (p.material as THREE.MeshBasicMaterial).color.setHex(0xff5a14).lerp(new THREE.Color(0xffa04a), 0.5 + 0.5 * Math.sin(t * 1.1 + i)));
    columns.forEach((c, i) => {
      const a = c.a0 + t * c.sp;
      c.m.position.set(Math.cos(a) * c.r, 10 + (i % 5) * 6 + Math.sin(t * 0.9 + i) * 1.6, Math.sin(a) * c.r);
      c.m.rotation.x += 0.004; c.m.rotation.y += 0.006;
    });
    ctx.hemi.intensity = 0.86 + Math.sin(t * 0.7) * 0.06;
  });
  void ORANGE; void additive;
}

export const MOLTEN_BUILDERS: Record<MoltenId, (ctx: Ctx) => void> = {
  ashfall: buildAshfall, smeltery: buildSmeltery, lavafalls: buildLavaFalls, slagyard: buildSlagYard,
  furnace: buildFurnace, forgehall: buildForgeHall, magmacore: buildMagmaCore,
};
