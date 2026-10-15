import * as THREE from 'three';
import {
  std, basic, additive, mesh, box, glowSprite, beam, particles, makeArc,
} from './stageScenery';
import type { Ctx, SceneryConfig } from './stageScenery';

/**
 * MAP 9 STORM ARRAY — thunderheads, cloud seas and observation arrays (SEC-57 .. SEC-63).
 * Everything is visual set dressing outside the arena walls (|x|,|z| > 41) or overhead.
 */

type StormId = 'stormfront' | 'cloudsea' | 'thunderhead' | 'rodfield' | 'eyewall' | 'arraydeck' | 'stormcore';

export const STORM_CONFIG: Record<StormId, SceneryConfig> = {
  stormfront: {
    sky: {
      top: 0x0a1020, horizon: 0x4a5a7a, bottom: 0x0a0e18, exponent: 0.5, stars: 0.0,
      clouds: { color: 0x3a4660, coverage: 0.85, speed: 0.02, opacity: 0.95 }, horizonGlow: { color: 0x7a9ad0, strength: 0.4 },
    },
    fogColor: 0x232c40, fogDensity: 0.0118,
    ambient: [0xb8c8e8, 0.55], hemi: [0x9ab4e0, 0x10141f, 0.8],
    sun: { color: 0xb8d0ff, intensity: 0.7, pos: [-40, 40, -40] },
    wallHeight: 3, gridOpacity: 0.2, cornerLight: [0x60a5fa, 2.0],
    floorTint: 0xb8c4d8, env: 'sky', envIntensity: 0.8,
  },
  cloudsea: {
    sky: {
      top: 0x16294e, horizon: 0xa8c0e8, bottom: 0x2a3a60, exponent: 0.55, stars: 0.01,
      cloudSea: { color: 0xc8d4ec, shadow: 0x4a5a80 }, horizonGlow: { color: 0xc8e0ff, strength: 0.5 },
    },
    fogColor: 0x6a7a9c, fogDensity: 0.0085,
    ambient: [0xdce8ff, 0.78], hemi: [0xc8dcff, 0x2a3a60, 0.95],
    sun: { color: 0xf0f6ff, intensity: 1.25, pos: [20, 60, -30] },
    wallHeight: 1.8, gridOpacity: 0.22, cornerLight: [0x93c5fd, 2.0],
    floorTint: 0xd8e0f0, env: 'sky', envIntensity: 1.0,
  },
  thunderhead: {
    sky: { top: 0x04060e, horizon: 0x1c2640, bottom: 0x03050a },
    fogColor: 0x141c30, fogDensity: 0.0135,
    ambient: [0x8aa4d8, 0.5], hemi: [0x7a98d0, 0x06080f, 0.78],
    sun: { color: 0x9ab8ff, intensity: 0.55, pos: [0, 40, 0] },
    wallHeight: 14, gridOpacity: 0.26, cornerLight: [0x3b82f6, 2.6],
    floorTint: 0xa8b4cc, env: 'hemi', envIntensity: 0.85,
  },
  rodfield: {
    sky: {
      top: 0x080c1c, horizon: 0x3a4a72, bottom: 0x060810, exponent: 0.55, stars: 0.008,
      clouds: { color: 0x2c3850, coverage: 0.8, speed: 0.016, opacity: 0.92 }, horizonGlow: { color: 0x6a8ad0, strength: 0.45 },
    },
    fogColor: 0x1c2438, fogDensity: 0.0122,
    ambient: [0xa8bce0, 0.52], hemi: [0x88a4d8, 0x0c101c, 0.78],
    sun: { color: 0xa8c4ff, intensity: 0.65, pos: [30, 36, 40] },
    wallHeight: 2.8, gridOpacity: 0.22, cornerLight: [0x60a5fa, 2.2],
    floorTint: 0xb0bcd2, env: 'sky', envIntensity: 0.8,
  },
  eyewall: {
    sky: {
      top: 0x0c1a3c, horizon: 0x9ab8e8, bottom: 0x101a30, exponent: 0.6, stars: 0.02,
      clouds: { color: 0x6a7aa0, coverage: 0.55, speed: 0.03, opacity: 0.85 }, horizonGlow: { color: 0xc0d8ff, strength: 0.55 },
    },
    fogColor: 0x3a4868, fogDensity: 0.0105,
    ambient: [0xd0e0ff, 0.66], hemi: [0xb0ccff, 0x1a2440, 0.88],
    sun: { color: 0xe8f2ff, intensity: 1.0, pos: [0, 60, -20] },
    wallHeight: 3, gridOpacity: 0.24, cornerLight: [0x93c5fd, 2.2],
    floorTint: 0xc8d4ea, env: 'sky', envIntensity: 0.95,
  },
  arraydeck: {
    sky: {
      top: 0x050a1c, horizon: 0x2a4a8a, bottom: 0x040812, exponent: 0.55, stars: 0.03,
      nebula: { a: 0x3b82f6, b: 0x818cf8, strength: 0.3 }, aurora: { color: 0x7dd3fc, strength: 0.4 }, horizonGlow: { color: 0x7aa8ff, strength: 0.45 },
    },
    fogColor: 0x131c38, fogDensity: 0.0105,
    ambient: [0xb8ccff, 0.6], hemi: [0x98b8ff, 0x0a1022, 0.86],
    sun: { color: 0xc0d8ff, intensity: 0.9, pos: [-20, 50, -50] },
    wallHeight: 2.4, gridOpacity: 0.26, cornerLight: [0x38bdf8, 2.4],
    floorTint: 0xb8c8e4, env: 'sky', envIntensity: 0.9,
  },
  stormcore: {
    sky: {
      top: 0x03040c, horizon: 0x23386e, bottom: 0x030510, exponent: 0.5, stars: 0.02,
      nebula: { a: 0x2563eb, b: 0x7c3aed, strength: 0.4 }, horizonGlow: { color: 0x5a8aff, strength: 0.55 },
      clouds: { color: 0x1c2640, coverage: 0.7, speed: 0.03, opacity: 0.8 },
    },
    fogColor: 0x0e1630, fogDensity: 0.0098,
    ambient: [0xb0c4ff, 0.58], hemi: [0x88a8ff, 0x080c1c, 0.86],
    sun: { color: 0xb8d0ff, intensity: 0.95, pos: [0, 40, -60] },
    wallHeight: 2.4, gridOpacity: 0.28, cornerLight: [0x3b82f6, 2.6],
    floorTint: 0xb4c4e0, env: 'sky', envIntensity: 0.95,
  },
};

const TAU = Math.PI * 2;
const BLUE = 0x38bdf8;

// ───────────────────────────── shared helpers ─────────────────────────────

const steelMat = (color = 0x4a5670) => std(color, 0.7, 0.4, { emissive: 0x0a1020, emissiveIntensity: 0.4 });
const glowMat = (color = BLUE, opacity = 1) => basic(color, { toneMapped: false, fog: false, transparent: opacity < 1, opacity });
const cloudMat = (color = 0x56607c, emissive = 0x1a2240) => std(color, 0, 1, { flatShading: true, emissive, emissiveIntensity: 0.55 });

/** Ground / cloud floor under the arena. */
const ground = (ctx: Ctx, color = 0x1a2234, emissive = 0x0a1228) =>
  mesh(ctx.root, new THREE.PlaneGeometry(600, 600), std(color, 0, 0.95, { emissive, emissiveIntensity: 0.4 }), 0, -0.3, 0, -Math.PI / 2);

/** A lumpy cloud bank built from overlapping icosahedra. */
function cloudBank(parent: THREE.Object3D, rnd: () => number, x: number, y: number, z: number, r: number, mats: THREE.Material[], lumps = 9) {
  const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g);
  for (let i = 0; i < lumps; i++) {
    const a = rnd() * TAU, d = rnd() * r * 1.4, rr = r * (0.5 + rnd() * 0.7);
    const b = mesh(g, new THREE.IcosahedronGeometry(rr, 1), mats[i % mats.length], Math.cos(a) * d, (rnd() - 0.4) * r * 0.5, Math.sin(a) * d);
    b.scale.y = 0.62 + rnd() * 0.2;
    b.rotation.set(rnd(), rnd(), rnd());
  }
  return g;
}

/**
 * Lightning director: a pool of arcs that flash between sky and ground at random, with a bright sky flash and
 * a light pulse. Strikes land outside the arena (|x|,|z| in [mid-spread]) so they never confuse the real hazards.
 */
function lightning(ctx: Ctx, opts: { count?: number; gap?: [number, number]; top?: number; ringR?: [number, number]; color?: number; flash?: number; groundY?: number } = {}) {
  const { root, rnd } = ctx;
  const count = opts.count ?? 3;
  const color = opts.color ?? 0xbfe4ff;
  const top = opts.top ?? 90;
  const [r0, r1] = opts.ringR ?? [50, 120];
  const gy = opts.groundY ?? 0;
  const arcs = Array.from({ length: count }, () => ({ arc: makeArc(root, color, 0.28), life: 0, a: new THREE.Vector3(), b: new THREE.Vector3(), light: glowSprite(root, color, 40, 0, 0, 0, 0), next: rnd() * 3 }));
  let flash = 0;
  ctx.on((dt, t) => {
    arcs.forEach((s) => {
      s.next -= dt;
      if (s.next <= 0) {
        const ang = rnd() * TAU, r = r0 + rnd() * (r1 - r0);
        s.b.set(Math.cos(ang) * r, gy, Math.sin(ang) * r);
        s.a.set(s.b.x + (rnd() - 0.5) * 30, top, s.b.z + (rnd() - 0.5) * 30);
        s.life = 0.22 + rnd() * 0.18;
        s.next = (opts.gap?.[0] ?? 1.5) + rnd() * ((opts.gap?.[1] ?? 5) - (opts.gap?.[0] ?? 1.5));
        s.light.position.set(s.b.x, 4, s.b.z);
        flash = Math.max(flash, 1);
      }
      if (s.life > 0) {
        s.life -= dt;
        s.arc.visible(true);
        s.arc.set(s.a, s.b, 8 + rnd() * 6);
        (s.light.material as THREE.SpriteMaterial).opacity = Math.max(0, s.life * 3.2) * (0.6 + 0.4 * Math.sin(t * 80));
      } else {
        s.arc.visible(false);
        (s.light.material as THREE.SpriteMaterial).opacity = 0;
      }
    });
    flash = Math.max(0, flash - dt * 3.2);
    const f = flash * (0.6 + 0.4 * Math.sin(t * 70)) * (opts.flash ?? 1);
    ctx.sky.uniforms.uFlash.value = f;
  });
}

/** Rain streaks / wind-blown drizzle. */
const rain = (ctx: Ctx, count = 300, half = 64, top = 40, color = 0x9ab8e8) =>
  particles(ctx, { count, size: 0.16, color, opacity: 0.55, half: [half, half], y: [0.5, top], mode: 'fall', speed: 14, sway: 0.6 });
const sparks = (ctx: Ctx, count = 120, half = 60, top = 40) =>
  particles(ctx, { count, size: 0.3, color: 0x9bd8ff, opacity: 0.75, half: [half, half], y: [0.5, top], mode: 'drift', speed: 1.2, sway: 1.4 });

/** Lightning-rod mast: pole, crossbars and a glowing tip. */
function rodMast(parent: THREE.Object3D, x: number, z: number, h: number) {
  const g = new THREE.Group(); g.position.set(x, 0, z); parent.add(g);
  mesh(g, new THREE.CylinderGeometry(0.35, 0.8, h, 6), steelMat(0x56627c), 0, h / 2, 0);
  for (let k = 1; k <= 3; k++) mesh(g, new THREE.TorusGeometry(1.2 - k * 0.2, 0.16, 6, 14), steelMat(0x7a88a4), 0, h * (0.55 + k * 0.13), 0, Math.PI / 2);
  mesh(g, new THREE.ConeGeometry(0.4, 5, 6), steelMat(0x9aa8c4), 0, h + 2.5, 0);
  const tip = glowSprite(g, 0x7dd3fc, 8, 0.7, 0, h + 5.2, 0);
  mesh(g, new THREE.SphereGeometry(0.5, 10, 8), glowMat(0xbfe4ff), 0, h + 5.2, 0);
  return { g, tip };
}

/** Floating rock island with a glowing underside. */
function island(parent: THREE.Object3D, rnd: () => number, x: number, y: number, z: number, r: number) {
  const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g);
  const top = mesh(g, new THREE.CylinderGeometry(r, r * 0.9, r * 0.25, 10), std(0x3a4660, 0.1, 0.9, { flatShading: true, emissive: 0x0c1428, emissiveIntensity: 0.4 }), 0, 0, 0);
  top.rotation.y = rnd() * TAU;
  mesh(g, new THREE.ConeGeometry(r * 0.9, r * 1.4, 7), std(0x2a3248, 0.1, 0.95, { flatShading: true, emissive: 0x0a1020, emissiveIntensity: 0.4 }), 0, -r * 0.8, 0, Math.PI);
  mesh(g, new THREE.CircleGeometry(r * 0.7, 20), additive(0x38bdf8, 0.35, { side: THREE.DoubleSide, fog: false }), 0, -r * 0.14, 0, Math.PI / 2);
  return g;
}

// ───────────────────────────── stages ─────────────────────────────

function buildStormFront(ctx: Ctx) {
  const { root, rnd } = ctx;
  ground(ctx, 0x1a2030);
  const mats = [cloudMat(0x3e4860), cloudMat(0x56607c), cloudMat(0x2c3448)];
  for (let i = 0; i < 22; i++) { // towering dark cloud walls on all sides
    const a = (i / 22) * TAU + rnd() * 0.2, r = 100 + rnd() * 40;
    cloudBank(root, rnd, Math.cos(a) * r, 30 + rnd() * 40, Math.sin(a) * r, 22 + rnd() * 16, mats, 10);
  }
  for (let i = 0; i < 16; i++) { // wind-bent pylons and wrecked antennae
    const a = rnd() * TAU, r = 56 + rnd() * 50, h = 10 + rnd() * 20;
    const m = mesh(root, new THREE.CylinderGeometry(0.4, 1.0, h, 6), steelMat(0x3a4258), Math.cos(a) * r, h / 2 - 0.3, Math.sin(a) * r);
    m.rotation.set((rnd() - 0.5) * 0.2, 0, (rnd() - 0.5) * 0.2);
  }
  for (let i = 0; i < 20; i++) { // rocky outcrops
    const a = rnd() * TAU, r = 60 + rnd() * 60, h = 6 + rnd() * 16;
    mesh(root, new THREE.ConeGeometry(3 + rnd() * 5, h, 6), std(0x2a3042, 0.1, 0.95, { flatShading: true }), Math.cos(a) * r, h / 2 - 0.3, Math.sin(a) * r);
  }
  lightning(ctx, { count: 3, gap: [1.2, 4], ringR: [70, 140] });
  rain(ctx, 380, 66, 42); sparks(ctx, 50, 60, 24);
  beam(root, new THREE.Vector3(0, 110, -120), new THREE.Vector3(0, 0, -70), 4, 26, 0x9ab8ff, 0.05);
  ctx.on((_dt, t) => { ctx.hemi.intensity = 0.8 + Math.sin(t * 0.5) * 0.04; });
}

function buildCloudSea(ctx: Ctx) {
  const { root, rnd } = ctx;
  mesh(root, new THREE.PlaneGeometry(600, 600), std(0xdce6f8, 0, 1, { emissive: 0x6a7ca0, emissiveIntensity: 0.6 }), 0, -1.2, 0, -Math.PI / 2);
  const mats = [cloudMat(0xc8d2ea, 0x6a7ca0), cloudMat(0xe4ecfa, 0x7a8cb0), cloudMat(0xa8b6d4, 0x56688c)];
  for (let i = 0; i < 34; i++) { // billowing cloud tops all around
    const a = rnd() * TAU, r = 60 + rnd() * 80;
    cloudBank(root, rnd, Math.cos(a) * r, -2 + rnd() * 4, Math.sin(a) * r, 12 + rnd() * 14, mats, 8);
  }
  const isles: THREE.Group[] = [];
  for (let i = 0; i < 9; i++) { // floating rock islands with rods
    const a = (i / 9) * TAU + 0.3, r = 62 + (i % 3) * 18;
    const g = island(root, rnd, Math.cos(a) * r, 2 + (i % 4) * 2, Math.sin(a) * r, 8 + (i % 3) * 4);
    rodMast(g, 0, 0, 8 + (i % 3) * 4);
    isles.push(g);
  }
  for (let i = 0; i < 4; i++) cloudBank(root, rnd, (i - 1.5) * 50, 60 + i * 6, -120, 24, [cloudMat(0x7a88aa, 0x2a3860), cloudMat(0x9aa8c8, 0x3a4a78)], 9); // storm anvil on the horizon
  lightning(ctx, { count: 2, gap: [3, 8], ringR: [100, 160], top: 80, groundY: -2, flash: 0.6 });
  particles(ctx, { count: 160, size: 0.4, color: 0xffffff, opacity: 0.6, half: [70, 70], y: [-1, 20], mode: 'drift', speed: 1.4, sway: 2 });
  ctx.on((_dt, t) => {
    isles.forEach((g, i) => { g.position.y += Math.sin(t * 0.6 + i) * 0.004; });
    ctx.hemi.intensity = 0.95 + Math.sin(t * 0.4) * 0.04;
  });
}

function buildThunderhead(ctx: Ctx) {
  const { root, rnd } = ctx;
  ground(ctx, 0x0e1424, 0x060a18);
  const mats = [cloudMat(0x3a4460, 0x141c3c), cloudMat(0x252e48, 0x0c1230), cloudMat(0x56648a, 0x1c2a54)];
  for (let i = 0; i < 30; i++) { // churning cloud walls surrounding and overhead
    const a = rnd() * TAU, r = 56 + rnd() * 70;
    cloudBank(root, rnd, Math.cos(a) * r, 10 + rnd() * 60, Math.sin(a) * r, 16 + rnd() * 18, mats, 10);
  }
  for (let i = 0; i < 16; i++) cloudBank(root, rnd, (rnd() - 0.5) * 120, 58 + rnd() * 22, (rnd() - 0.5) * 120, 20 + rnd() * 14, mats, 9); // ceiling
  // glowing lightning veins inside the cloud walls
  const veins: ReturnType<typeof makeArc>[] = [];
  for (let i = 0; i < 6; i++) veins.push(makeArc(root, i % 2 ? 0x7dd3fc : 0xc4b5fd, 0.22));
  const glows: THREE.Sprite[] = [];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU, r = 66 + rnd() * 20;
    glows.push(glowSprite(root, i % 2 ? 0x3b82f6 : 0x818cf8, 60, 0.18, Math.cos(a) * r, 16 + rnd() * 30, Math.sin(a) * r));
  }
  lightning(ctx, { count: 4, gap: [0.6, 2.6], ringR: [58, 96], top: 62, color: 0xc4d8ff, flash: 1.2 });
  particles(ctx, { count: 260, size: 0.5, color: 0x6a86c8, opacity: 0.35, half: [64, 64], y: [0.5, 50], mode: 'drift', speed: 1.8, sway: 2.2 });
  rain(ctx, 220, 62, 50, 0x8aa8d8);
  let nextArc = 0;
  ctx.on((dt, t) => {
    nextArc -= dt;
    if (nextArc <= 0) {
      nextArc = 0.08 + rnd() * 0.25;
      const v = veins[Math.floor(rnd() * veins.length)];
      const a = rnd() * TAU, r = 60 + rnd() * 22;
      const p = new THREE.Vector3(Math.cos(a) * r, 8 + rnd() * 40, Math.sin(a) * r);
      v.visible(true);
      v.set(p, p.clone().add(new THREE.Vector3((rnd() - 0.5) * 36, (rnd() - 0.5) * 24, (rnd() - 0.5) * 36)), 5);
    }
    glows.forEach((g, i) => { (g.material as THREE.SpriteMaterial).opacity = 0.14 + 0.14 * Math.max(0, Math.sin(t * 1.4 + i * 1.9)); });
    ctx.hemi.intensity = 0.78 + Math.sin(t * 0.8) * 0.05;
  });
}

function buildRodField(ctx: Ctx) {
  const { root, rnd } = ctx;
  ground(ctx, 0x161c2c);
  const tips: THREE.Sprite[] = [];
  const arcs: { arc: ReturnType<typeof makeArc>; a: THREE.Vector3; b: THREE.Vector3 }[] = [];
  const masts: THREE.Vector3[] = [];
  for (let i = 0; i < 30; i++) { // a forest of lightning rods
    const a = rnd() * TAU, r = 52 + rnd() * 70, h = 16 + rnd() * 26;
    const m = rodMast(root, Math.cos(a) * r, Math.sin(a) * r, h);
    tips.push(m.tip);
    masts.push(new THREE.Vector3(Math.cos(a) * r, h + 5, Math.sin(a) * r));
  }
  for (let i = 0; i < 4; i++) arcs.push({ arc: makeArc(root, 0xbfe4ff, 0.22), a: new THREE.Vector3(), b: new THREE.Vector3() });
  const cmats = [cloudMat(0x2c3650, 0x10183a), cloudMat(0x444f6e, 0x182250)];
  for (let i = 0; i < 18; i++) {
    const a = rnd() * TAU, r = 90 + rnd() * 50;
    cloudBank(root, rnd, Math.cos(a) * r, 36 + rnd() * 30, Math.sin(a) * r, 22 + rnd() * 12, cmats, 9);
  }
  lightning(ctx, { count: 3, gap: [1.5, 5], ringR: [56, 120], top: 80, flash: 0.9 });
  rain(ctx, 340, 66, 42); sparks(ctx, 90, 62, 30);
  let nextA = 0;
  ctx.on((dt, t) => {
    nextA -= dt;
    arcs.forEach((s) => s.arc.visible(false));
    if (nextA <= 0) nextA = 0.2 + rnd() * 1.2;
    if (nextA < 0.14) { // static arcs hop between neighbouring rods
      arcs.forEach((s) => {
        const i = Math.floor(rnd() * masts.length), j = (i + 1 + Math.floor(rnd() * 3)) % masts.length;
        s.a.copy(masts[i]); s.b.copy(masts[j]);
        s.arc.visible(true); s.arc.set(s.a, s.b, 3);
      });
    }
    tips.forEach((tp, i) => { (tp.material as THREE.SpriteMaterial).opacity = 0.45 + 0.35 * Math.sin(t * 3 + i * 1.7); });
    ctx.hemi.intensity = 0.78 + Math.sin(t * 0.6) * 0.04;
  });
}

function buildEyewall(ctx: Ctx) {
  const { root, rnd } = ctx;
  ground(ctx, 0x1a2438, 0x0c1630);
  // a vast cylindrical cloud wall circling the arena, slowly rotating; open sky above (the eye)
  const wall = new THREE.Group(); root.add(wall);
  const mats = [cloudMat(0x56648a, 0x1c2a54), cloudMat(0x7a88aa, 0x2a3a6a), cloudMat(0x3a4666, 0x141e44)];
  for (let ring = 0; ring < 5; ring++) {
    const n = 16 + ring * 2, y = 6 + ring * 22;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + ring * 0.4, r = 80 - ring * 3 + rnd() * 8;
      cloudBank(wall, rnd, Math.cos(a) * r, y + rnd() * 10, Math.sin(a) * r, 14 + rnd() * 12, mats, 8);
    }
  }
  // spiral rain bands hugging the wall
  const bands: THREE.Mesh[] = [];
  for (let i = 0; i < 6; i++) bands.push(mesh(root, new THREE.CylinderGeometry(70 - i * 2, 74 - i * 2, 60, 40, 1, true), additive(0x9ab8ff, 0.05, { side: THREE.DoubleSide, fog: false }), 0, 30, 0));
  // sunlit shaft from the clear eye
  beam(root, new THREE.Vector3(0, 130, 0), new THREE.Vector3(0, 0, 0), 12, 52, 0xe8f2ff, 0.07);
  beam(root, new THREE.Vector3(-20, 120, -10), new THREE.Vector3(-14, 0, -6), 5, 26, 0xc8dcff, 0.05);
  for (let i = 0; i < 14; i++) { // wind-flung debris
    const a = rnd() * TAU, r = 56 + rnd() * 14;
    mesh(root, new THREE.BoxGeometry(2 + rnd() * 3, 0.4, 1.5 + rnd() * 2), steelMat(0x4a566e), Math.cos(a) * r, 6 + rnd() * 40, Math.sin(a) * r, rnd(), rnd(), rnd());
  }
  lightning(ctx, { count: 3, gap: [2, 6], ringR: [66, 100], top: 120, flash: 0.8 });
  particles(ctx, { count: 280, size: 0.34, color: 0xdce8ff, opacity: 0.55, half: [64, 64], y: [0.5, 60], mode: 'drift', speed: 2.2, sway: 3 });
  rain(ctx, 200, 64, 50, 0xb8cef0);
  ctx.on((_dt, t) => {
    wall.rotation.y = t * 0.02;
    bands.forEach((b, i) => { b.rotation.y = -t * (0.05 + i * 0.02); });
    ctx.hemi.intensity = 0.88 + Math.sin(t * 0.5) * 0.04;
  });
}

function buildArrayDeck(ctx: Ctx) {
  const { root, rnd } = ctx;
  ground(ctx, 0x121a2e, 0x081028);
  // concentric rotating array rings behind and above the arena
  const rings: THREE.Mesh[] = [];
  for (let k = 0; k < 4; k++) {
    const r = mesh(root, new THREE.TorusGeometry(70 + k * 16, 2.2 + k * 0.4, 8, 90), k % 2 ? steelMat(0x56627c) : glowMat(0x38bdf8, 0.9), 0, 40 + k * 3, -60, Math.PI / 2.4);
    rings.push(r);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      box(r, 5, 2.6, 5, steelMat(0x7a88a4), Math.cos(a) * (70 + k * 16), Math.sin(a) * (70 + k * 16), 0, 0, 0, a);
    }
  }
  // radar dishes and rod pylons around the deck
  const dishes: THREE.Group[] = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + 0.2, r = 66 + (i % 2) * 10;
    const g = new THREE.Group(); g.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); root.add(g);
    mesh(g, new THREE.CylinderGeometry(1.2, 2.2, 16, 8), steelMat(0x4a566e), 0, 8, 0);
    const dish = new THREE.Group(); dish.position.y = 17; g.add(dish);
    mesh(dish, new THREE.SphereGeometry(7, 20, 8, 0, TAU, 0, Math.PI / 2.6), steelMat(0x8a98b4), 0, 0, 0, Math.PI * 0.7, 0, 0);
    mesh(dish, new THREE.CylinderGeometry(0.2, 0.2, 7, 6), steelMat(0x9aa8c4), 0, 3.5, -4, 0.5, 0, 0);
    glowSprite(dish, 0x38bdf8, 8, 0.6, 0, 6.8, -6.5);
    dishes.push(dish);
  }
  for (let i = 0; i < 10; i++) { const a = rnd() * TAU, r = 90 + rnd() * 40; rodMast(root, Math.cos(a) * r, Math.sin(a) * r, 22 + rnd() * 18); }
  const cmats = [cloudMat(0x2a3454, 0x101a40), cloudMat(0x44507a, 0x1a2858)];
  for (let i = 0; i < 18; i++) { const a = rnd() * TAU, r = 100 + rnd() * 50; cloudBank(root, rnd, Math.cos(a) * r, rnd() * 20 - 4, Math.sin(a) * r, 20 + rnd() * 12, cmats, 8); }
  beam(root, new THREE.Vector3(0, 110, -60), new THREE.Vector3(0, 0, -20), 4, 30, 0x7dd3fc, 0.06);
  lightning(ctx, { count: 3, gap: [1.5, 5], ringR: [66, 130], top: 100, flash: 0.9 });
  sparks(ctx, 150, 64, 44); rain(ctx, 160, 62, 40);
  ctx.on((_dt, t) => {
    rings.forEach((r, i) => { r.rotation.z = t * (0.05 + i * 0.02) * (i % 2 ? -1 : 1); });
    dishes.forEach((d, i) => { d.rotation.y = t * 0.3 + i; });
    ctx.hemi.intensity = 0.86 + Math.sin(t * 0.7) * 0.05;
  });
}

function buildStormCore(ctx: Ctx) {
  const { root, rnd } = ctx;
  ground(ctx, 0x0e1428, 0x060c20);
  // a colossal cyclone behind the north wall: funnel clouds spiralling up into a rotating storm roof
  const cyclone = new THREE.Group(); cyclone.position.set(0, 0, -140); root.add(cyclone);
  const mats = [cloudMat(0x3a4666, 0x141e44), cloudMat(0x56648a, 0x1c2a54), cloudMat(0x2a3454, 0x0e1638)];
  for (let i = 0; i < 70; i++) {
    const y = (i / 70) * 140, a = i * 0.9, r = 12 + (y / 140) * 55 + rnd() * 8;
    cloudBank(cyclone, rnd, Math.cos(a) * r, y, Math.sin(a) * r, 10 + (y / 140) * 14 + rnd() * 6, mats, 6);
  }
  const ringsA: THREE.Mesh[] = [];
  for (let i = 0; i < 7; i++) {
    const rr = 14 + i * 11, ring = mesh(cyclone, new THREE.TorusGeometry(rr, 0.7, 6, 70), glowMat(i % 2 ? 0x7dd3fc : 0x38bdf8, 0.7), 0, 8 + i * 18, 0, Math.PI / 2);
    ringsA.push(ring);
  }
  glowSprite(cyclone, 0x3b82f6, 150, 0.35, 0, 20, 30);
  glowSprite(cyclone, 0x7dd3fc, 90, 0.25, 0, 10, 20);
  // storm fleet: ring-decks drifting in the clouds around the arena
  const fleet: { g: THREE.Group; r: number; y: number; a0: number; sp: number }[] = [];
  for (let i = 0; i < 6; i++) {
    const g = new THREE.Group(); root.add(g);
    mesh(g, new THREE.TorusGeometry(9, 0.8, 8, 36), steelMat(0x56627c), 0, 0, 0, Math.PI / 2);
    mesh(g, new THREE.TorusGeometry(8.2, 0.2, 6, 36), glowMat(0x38bdf8), 0, 0.5, 0, Math.PI / 2);
    mesh(g, new THREE.ConeGeometry(0.8, 8, 5), steelMat(0x8a98b4), 0, 4, 0);
    glowSprite(g, 0x38bdf8, 22, 0.35, 0, 0, 0);
    fleet.push({ g, r: 74 + (i % 3) * 10, y: 24 + (i % 4) * 9, a0: (i / 6) * TAU, sp: 0.02 + (i % 3) * 0.006 });
  }
  for (let i = 0; i < 16; i++) { const a = rnd() * TAU, r = 100 + rnd() * 40; cloudBank(root, rnd, Math.cos(a) * r, rnd() * 50, Math.sin(a) * r, 18 + rnd() * 14, mats, 8); }
  for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU, r = 58; rodMast(root, Math.cos(a) * r, Math.sin(a) * r, 30 + (i % 3) * 8); }
  beam(root, new THREE.Vector3(0, 100, -100), new THREE.Vector3(0, 0, -30), 5, 36, 0x7dd3fc, 0.07);
  beam(root, new THREE.Vector3(-40, 90, -90), new THREE.Vector3(-26, 0, -18), 3, 20, 0x60a5fa, 0.05);
  beam(root, new THREE.Vector3(40, 90, -90), new THREE.Vector3(26, 0, -18), 3, 20, 0x60a5fa, 0.05);
  lightning(ctx, { count: 5, gap: [0.5, 2.2], ringR: [56, 130], top: 110, color: 0xcfe6ff, flash: 1.3 });
  rain(ctx, 380, 68, 50); sparks(ctx, 180, 66, 50);
  ctx.on((_dt, t) => {
    cyclone.rotation.y = t * 0.06;
    ringsA.forEach((r, i) => { r.rotation.z = t * (0.1 + i * 0.03) * (i % 2 ? -1 : 1); });
    fleet.forEach((f) => {
      const a = f.a0 + t * f.sp;
      f.g.position.set(Math.cos(a) * f.r, f.y + Math.sin(t * 0.5 + f.a0) * 1.5, Math.sin(a) * f.r);
      f.g.rotation.y = -a; f.g.rotation.z = Math.sin(t * 0.4 + f.a0) * 0.08;
    });
    ctx.hemi.intensity = 0.86 + Math.sin(t * 0.9) * 0.05;
  });
}

export const STORM_BUILDERS: Record<StormId, (ctx: Ctx) => void> = {
  stormfront: buildStormFront, cloudsea: buildCloudSea, thunderhead: buildThunderhead, rodfield: buildRodField,
  eyewall: buildEyewall, arraydeck: buildArrayDeck, stormcore: buildStormCore,
};
