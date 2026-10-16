import * as THREE from 'three';
import { std, basic, mesh, glowSprite, beam, particles } from './stageScenery';
import type { Ctx, SceneryConfig } from './stageScenery';

/**
 * PROJECT EDEN — ten floors of a white, gold-trimmed heavenly complex (EDEN-01 .. EDEN-10).
 * Everything is visual set dressing outside the arena walls (|x|,|z| > 41) or overhead:
 * pearl colonnades, cloud banks, great wheels of eyes (Ezekiel), trumpets, a sea of glass, the throne road
 * and the garden around the Tree of Life. Each floor mixes a few shared pieces with its own centrepiece.
 */

type EdenId =
  | 'edengate' | 'cloudstair' | 'lampstands' | 'wheelgarden' | 'trumpethall'
  | 'sealvault' | 'glasssea' | 'choirdome' | 'throneroad' | 'edencore';

const sky = (top: number, horizon: number, bottom: number, glow: number, extra: Partial<SceneryConfig['sky']> = {}): SceneryConfig['sky'] => ({
  top, horizon, bottom, exponent: 0.6,
  clouds: { color: 0xffffff, coverage: 0.5, speed: 0.008, opacity: 0.85 },
  horizonGlow: { color: glow, strength: 0.55 },
  ...extra,
});

const eden = (s: SceneryConfig['sky'], fog: number, fogD: number, wall: number, corner: number, sunPos: [number, number, number], env: 'sky' | 'hemi' = 'sky'): SceneryConfig => ({
  sky: s,
  fogColor: fog, fogDensity: fogD,
  ambient: [0xfff8e8, 0.6], hemi: [0xfffbf0, 0xc8d4ee, 0.85],
  sun: { color: 0xfff1c8, intensity: 0.95, pos: sunPos },
  wallHeight: wall, gridOpacity: 0.2, cornerLight: [corner, 2.2],
  floorTint: 0xe2dccd, env, envIntensity: 0.8,
});

export const EDEN_CONFIG: Record<EdenId, SceneryConfig> = {
  edengate: eden(sky(0x8fb6ee, 0xfff0cf, 0xdfe8f8, 0xffe3a0, { sun: { dir: [0.2, 0.4, -0.9], color: 0xfff4d0, size: 0.012, glow: 1.0 } }), 0xf2ead8, 0.0075, 2.8, 0xfbbf24, [10, 50, -60]),
  cloudstair: eden(sky(0x7aa6e8, 0xeaf1ff, 0xd6e2f8, 0xffffff, { cloudSea: { color: 0xffffff, shadow: 0xb8c8e8 } }), 0xe4ecfa, 0.0085, 1.6, 0xbae6fd, [-20, 55, -50]),
  lampstands: eden(sky(0x1e2a5a, 0xf2c878, 0x3a3060, 0xffc864, { stars: 0.02 }), 0x6a5a58, 0.0105, 9, 0xfbbf24, [0, 40, -40], 'hemi'),
  wheelgarden: eden(sky(0x6a8fd8, 0xdff0ff, 0xc8dcf4, 0xfff3c0), 0xe0ecf8, 0.009, 2.2, 0xfde68a, [30, 50, -40]),
  trumpethall: eden(sky(0x2a3a70, 0xf7dca0, 0x3e3868, 0xffd98a), 0x8a7868, 0.0098, 12, 0xfcd34d, [0, 45, 0], 'hemi'),
  sealvault: eden(sky(0x1a1c3c, 0xb8a0d8, 0x24203e, 0xe9d5ff, { stars: 0.03 }), 0x4a4064, 0.0112, 10, 0xe9d5ff, [0, 40, 0], 'hemi'),
  glasssea: eden(sky(0x5c90e0, 0xd8f0ff, 0xbcd8f4, 0xbaf0ff, { sun: { dir: [-0.3, 0.3, -0.9], color: 0xfffbe0, size: 0.014, glow: 1.0 } }), 0xdcecfa, 0.0082, 1.4, 0x7dd3fc, [-30, 50, -50]),
  choirdome: eden(sky(0x30386c, 0xffe9bc, 0x4a4478, 0xfff0c8), 0x9a8c7c, 0.0092, 14, 0xfde68a, [0, 50, 0], 'hemi'),
  throneroad: eden(sky(0x4878c8, 0xfff4d8, 0xc0d0f0, 0xffe9a8, { sun: { dir: [0, 0.32, -1], color: 0xfffae0, size: 0.02, glow: 1.0 } }), 0xf4ecd6, 0.0078, 2.0, 0xfbbf24, [0, 45, -70]),
  edencore: eden(sky(0x5a86d8, 0xfffbea, 0xd8e4f8, 0xfff6c8, { aurora: { color: 0xfde68a, strength: 0.35 }, sun: { dir: [0, 0.5, -0.85], color: 0xffffff, size: 0.024, glow: 1.2 } }), 0xf6f0de, 0.0072, 2.4, 0xffe9a0, [0, 60, -60]),
};

const TAU = Math.PI * 2;
const GOLD = 0xfbbf24;
const PEARL = 0xf4efe4;
const glowMat = (color: number, opacity = 1) => basic(color, { toneMapped: false, fog: false, transparent: opacity < 1, opacity });
const marble = (c = PEARL) => std(c, 0.15, 0.35, { emissive: 0xfff4d8, emissiveIntensity: 0.18 });
const goldMat = () => std(0xe8b83c, 0.7, 0.25, { emissive: 0xb8860b, emissiveIntensity: 0.3 });

const ground = (ctx: Ctx, color = 0xe8e4da) =>
  mesh(ctx.root, new THREE.PlaneGeometry(700, 700), std(color, 0.1, 0.5, { emissive: 0xffffff, emissiveIntensity: 0.25 }), 0, -0.3, 0, -Math.PI / 2);

/** A bank of soft cloud puffs (flat-shaded white spheres) at a given height. */
function cloudBank(ctx: Ctx, y: number, rMin: number, rMax: number, count: number, size = 1, tint = 0xffffff) {
  const { root, rnd } = ctx;
  const mat = basic(tint, { transparent: true, opacity: 0.88, fog: true });
  for (let i = 0; i < count; i++) {
    const a = rnd() * TAU, r = rMin + rnd() * (rMax - rMin);
    const g = new THREE.Group();
    g.position.set(Math.cos(a) * r, y + (rnd() - 0.5) * 6, Math.sin(a) * r);
    for (let k = 0; k < 4; k++) mesh(g, new THREE.SphereGeometry((7 + rnd() * 8) * size, 10, 8), mat, (k - 1.5) * 8 * size, rnd() * 3, (rnd() - 0.5) * 8);
    g.scale.y = 0.55;
    root.add(g);
  }
}

/** Fluted marble column with a gold base ring and capital. */
function column(parent: THREE.Object3D, x: number, z: number, h: number, r = 1.2) {
  const g = new THREE.Group(); g.position.set(x, 0, z); parent.add(g);
  mesh(g, new THREE.CylinderGeometry(r, r * 1.08, h, 14), marble(), 0, h / 2, 0);
  mesh(g, new THREE.CylinderGeometry(r * 1.5, r * 1.6, 0.8, 14), marble(), 0, 0.4, 0);
  mesh(g, new THREE.CylinderGeometry(r * 1.55, r * 1.2, 1.0, 14), goldMat(), 0, h + 0.5, 0);
  mesh(g, new THREE.BoxGeometry(r * 3.4, 0.7, r * 3.4), marble(), 0, h + 1.35, 0);
  mesh(g, new THREE.TorusGeometry(r * 1.15, 0.12, 6, 20), goldMat(), 0, h * 0.18, 0, Math.PI / 2);
  return g;
}

/** Ring of columns around the arena. */
function colonnade(ctx: Ctx, count: number, radius: number, h: number, r = 1.2) {
  for (let i = 0; i < count; i++) {
    const a = (i / count) * TAU;
    column(ctx.root, Math.cos(a) * radius, Math.sin(a) * radius, h + (i % 2) * 2, r);
  }
}

/** Great tilted gold ring (halo / armillary). */
function haloRing(parent: THREE.Object3D, R: number, tube: number, color: number, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) {
  return mesh(parent, new THREE.TorusGeometry(R, tube, 10, 96), glowMat(color, 0.95), x, y, z, rx, ry, rz);
}

/** A great wheel within a wheel studded with eyes (Ezekiel's ophanim). Returns the spinning group. */
function eyeWheel(parent: THREE.Object3D, R: number, x: number, y: number, z: number, speed: number, ctx: Ctx) {
  const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g);
  const a = new THREE.Group(); const b = new THREE.Group();
  g.add(a); g.add(b); b.rotation.x = Math.PI / 2;
  for (const w of [a, b]) {
    mesh(w, new THREE.TorusGeometry(R, R * 0.07, 10, 80), goldMat());
    mesh(w, new THREE.TorusGeometry(R * 0.82, R * 0.03, 8, 64), glowMat(0xfff3c0, 0.85));
    for (let i = 0; i < 16; i++) {
      const ang = (i / 16) * TAU;
      const eye = mesh(w, new THREE.SphereGeometry(R * 0.055, 8, 6), glowMat(i % 2 ? 0xffffff : 0xfde68a), Math.cos(ang) * R, Math.sin(ang) * R, 0);
      eye.scale.z = 0.6;
      mesh(w, new THREE.SphereGeometry(R * 0.022, 6, 5), basic(0x3a2a10), Math.cos(ang) * R, Math.sin(ang) * R, R * 0.025);
    }
    for (let i = 0; i < 4; i++) mesh(w, new THREE.BoxGeometry(R * 1.64, R * 0.02, R * 0.02), glowMat(0xfff3c0, 0.6), 0, 0, 0, 0, 0, (i / 4) * Math.PI);
  }
  glowSprite(g, 0xfff3c0, R * 1.6, 0.45);
  ctx.on((dt) => { a.rotation.z += dt * speed; b.rotation.y -= dt * speed * 0.8; });
  return g;
}

/** Six-winged silhouette far in the distance: a glowing core and wing blades. */
function seraphSilhouette(parent: THREE.Object3D, s: number, x: number, y: number, z: number, ry = 0) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; g.scale.setScalar(s); parent.add(g);
  mesh(g, new THREE.CylinderGeometry(1.2, 2.0, 12, 10), glowMat(0xfffaf0, 0.9), 0, 0, 0);
  glowSprite(g, 0xfff0b8, 28, 0.6);
  for (const side of [-1, 1]) for (let k = 0; k < 3; k++) {
    const wing = mesh(g, new THREE.PlaneGeometry(26 - k * 4, 6 - k), glowMat(k === 1 ? 0xfde68a : 0xffffff, 0.75), side * (13 - k * 2), 3 - k * 4, 0);
    wing.rotation.z = side * (0.5 - k * 0.45);
    wing.material.side = THREE.DoubleSide;
  }
  return g;
}

/** Slanted god-rays from the sky. */
function godRays(ctx: Ctx, n: number, color = 0xfff1c0, opacity = 0.07, spread = 90) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + ctx.rnd();
    const r = spread * (0.5 + ctx.rnd() * 0.7);
    beam(ctx.root, new THREE.Vector3(Math.cos(a) * r * 0.5, 130, Math.sin(a) * r * 0.5 - 40), new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r), 3, 14 + ctx.rnd() * 10, color, opacity);
  }
}

const feathers = (ctx: Ctx, count = 140, half = 64, top = 36) =>
  particles(ctx, { count, size: 0.42, color: 0xffffff, opacity: 0.85, half: [half, half], y: [0.5, top], mode: 'fall', speed: 1.3, sway: 1.6 });
const sparks = (ctx: Ctx, color = 0xfde68a, count = 120, half = 62, top = 34) =>
  particles(ctx, { count, size: 0.3, color, opacity: 0.75, half: [half, half], y: [0.5, top], mode: 'rise', speed: 1.0, sway: 1.0 });

// ───────────────────────────── floors ─────────────────────────────

function buildEdenGate(ctx: Ctx) {
  const { root } = ctx;
  ground(ctx);
  // a monumental gate: two pylons and a gold lintel with a halo behind the north wall
  for (const s of [-1, 1]) {
    mesh(root, new THREE.BoxGeometry(14, 80, 14), marble(), s * 34, 40, -120);
    mesh(root, new THREE.BoxGeometry(15, 3, 15), goldMat(), s * 34, 81, -120);
    mesh(root, new THREE.BoxGeometry(1.2, 74, 15.2), glowMat(GOLD, 0.9), s * 34 + s * 7.2, 40, -120);
  }
  mesh(root, new THREE.BoxGeometry(82, 8, 12), marble(), 0, 84, -120);
  mesh(root, new THREE.BoxGeometry(84, 1.4, 12.6), goldMat(), 0, 88.6, -120);
  haloRing(root, 22, 1.0, 0xfff3c0, 0, 104, -118);
  haloRing(root, 30, 0.5, GOLD, 0, 104, -118);
  glowSprite(root, 0xfff3c0, 120, 0.35, 0, 104, -118);
  beam(root, new THREE.Vector3(0, 200, -130), new THREE.Vector3(0, 0, -60), 5, 36, 0xfff4cc, 0.1);
  colonnade(ctx, 14, 74, 22);
  cloudBank(ctx, -4, 90, 190, 26);
  godRays(ctx, 8);
  feathers(ctx, 150); sparks(ctx, GOLD, 80);
}

function buildCloudStair(ctx: Ctx) {
  const { root } = ctx;
  ground(ctx, 0xf4f8ff);
  // a vast stair of floating marble slabs climbing into the sky
  for (let i = 0; i < 16; i++) {
    const w = 46 - i * 1.6;
    mesh(root, new THREE.BoxGeometry(w, 1.6, 12), marble(0xf8f4ea), -4 + Math.sin(i * 0.5) * 6, 4 + i * 5, -90 - i * 9);
    mesh(root, new THREE.BoxGeometry(w + 0.6, 0.35, 12.6), goldMat(), -4 + Math.sin(i * 0.5) * 6, 5 + i * 5, -90 - i * 9);
  }
  cloudBank(ctx, -6, 60, 150, 34, 1.25);
  cloudBank(ctx, 30, 100, 200, 16, 1.5, 0xf2f6ff);
  for (let i = 0; i < 6; i++) seraphSilhouette(root, 0.9 + (i % 3) * 0.3, -150 + i * 60, 50 + (i % 3) * 25, -200, 0);
  haloRing(root, 60, 0.9, 0xffffff, 0, 90, -240);
  godRays(ctx, 10, 0xffffff, 0.07);
  feathers(ctx, 180, 66, 40);
}

function buildLampstands(ctx: Ctx) {
  const { root, rnd } = ctx;
  ground(ctx, 0xd8cfb8);
  // seven colossal lampstands (Revelation 1) ringed around the arena, each with seven flames
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU + 0.2, r = 70;
    const g = new THREE.Group(); g.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); root.add(g);
    mesh(g, new THREE.CylinderGeometry(1.1, 2.6, 36, 10), goldMat(), 0, 18, 0);
    mesh(g, new THREE.CylinderGeometry(4, 1.2, 4, 12), goldMat(), 0, 38, 0);
    for (let k = -3; k <= 3; k++) {
      mesh(g, new THREE.TorusGeometry(Math.abs(k) * 2 + 0.01, 0.2, 6, 14, Math.PI), goldMat(), 0, 38, 0, 0, Math.PI / 2, 0);
      mesh(g, new THREE.CylinderGeometry(0.5, 0.35, 1.4, 8), goldMat(), k * 2.2, 40.4, 0);
      glowSprite(g, 0xffd27a, 4.6, 0.95, k * 2.2, 43, 0);
      glowSprite(g, 0xffffff, 1.6, 1, k * 2.2, 42.6, 0);
    }
    glowSprite(g, 0xffc864, 36, 0.3, 0, 41, 0);
  }
  // wall-hung banners of light
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    mesh(root, new THREE.PlaneGeometry(10, 44), glowMat(i % 2 ? 0xfff3c0 : 0xffffff, 0.5), Math.cos(a) * 52, 26, Math.sin(a) * 52, 0, -a + Math.PI / 2, 0).material.side = THREE.DoubleSide;
  }
  colonnade(ctx, 16, 56, 26, 1.5);
  mesh(root, new THREE.CylinderGeometry(150, 150, 0.5, 48), std(0x2a2038, 0.3, 0.6), 0, 60, 0).rotation.x = 0;
  for (let i = 0; i < 40; i++) glowSprite(root, 0xfde68a, 2 + rnd() * 2, 0.9, (rnd() - 0.5) * 140, 50 + rnd() * 8, (rnd() - 0.5) * 140);
  sparks(ctx, 0xffd27a, 140, 64, 40);
  feathers(ctx, 60, 60, 36);
}

function buildWheelGarden(ctx: Ctx) {
  const { root } = ctx;
  ground(ctx, 0xeef4e6);
  // a garden of hovering eye-wheels
  const wheels: THREE.Group[] = [];
  const spots: [number, number, number, number][] = [[-70, 48, -100, 22], [70, 52, -100, 24], [0, 80, -150, 40], [-120, 34, -30, 16], [120, 36, -30, 18], [-60, 26, 70, 12], [60, 28, 70, 12]];
  spots.forEach(([x, y, z, R], i) => wheels.push(eyeWheel(root, R, x, y, z, 0.22 + (i % 3) * 0.07, ctx)));
  // trimmed hedges of pale leaves and fountains of light
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * TAU, r = 66 + (i % 3) * 5;
    const g = new THREE.Group(); g.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); root.add(g);
    mesh(g, new THREE.SphereGeometry(5, 10, 8), std(0xd8ecc8, 0.0, 0.8, { emissive: 0xcfe8b8, emissiveIntensity: 0.25 }), 0, 4, 0).scale.set(1, 1.3, 1);
    mesh(g, new THREE.CylinderGeometry(0.4, 0.5, 3, 6), marble(), 0, 1.5, 0);
    glowSprite(g, 0xffffff, 3, 0.8, 0, 8.5, 0);
  }
  colonnade(ctx, 10, 90, 18);
  cloudBank(ctx, -3, 100, 190, 20);
  godRays(ctx, 6, 0xfff7d8, 0.06);
  feathers(ctx, 120); sparks(ctx, 0xfff7d8, 90);
  ctx.on((_dt, t) => { wheels.forEach((w, i) => { w.position.y += Math.sin(t * 0.6 + i) * 0.01; }); });
}

function buildTrumpetHall(ctx: Ctx) {
  const { root } = ctx;
  ground(ctx, 0xe4dcc8);
  // a vaulted hall: giant trumpets (gold horns) in the walls pointing at the arena
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU + 0.15, r = 62;
    const g = new THREE.Group(); g.position.set(Math.cos(a) * r, 18 + (i % 3) * 5, Math.sin(a) * r); g.rotation.y = -a - Math.PI / 2; root.add(g);
    const horn = mesh(g, new THREE.CylinderGeometry(6, 0.8, 34, 14, 1, true), goldMat(), 0, 0, 0, 0, 0, Math.PI / 2);
    (horn.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
    mesh(g, new THREE.TorusGeometry(6, 0.5, 8, 24), goldMat(), -17, 0, 0, 0, Math.PI / 2, 0);
    glowSprite(g, 0xfff3c0, 16, 0.55, -18, 0, 0);
  }
  colonnade(ctx, 20, 78, 34, 1.7);
  // arched ribs overhead
  for (let i = 0; i < 6; i++) mesh(root, new THREE.TorusGeometry(70, 1.0, 8, 60, Math.PI), marble(), 0, 0, 0, 0, (i / 6) * Math.PI, 0);
  haloRing(root, 40, 0.8, GOLD, 0, 70, 0, Math.PI / 2);
  godRays(ctx, 7, 0xfff1c0, 0.08);
  ctx.on((_dt, t) => { ctx.hemi.intensity = 0.85 + Math.sin(t * 2.2) * 0.04; });
  sparks(ctx, 0xfde68a, 130, 60, 36); feathers(ctx, 70, 60, 34);
}

function buildSealVault(ctx: Ctx) {
  const { root } = ctx;
  ground(ctx, 0xd8d2e4);
  // a circular vault with seven glowing seals orbiting a closed scroll
  const seals: THREE.Mesh[] = [];
  const cols = [0xff6b6b, 0xfbbf24, 0xffffff, 0x60a5fa, 0xa78bfa, 0x4ade80, 0xf472b6];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU;
    const s = mesh(root, new THREE.CylinderGeometry(7, 7, 1.2, 28), glowMat(cols[i], 0.85), Math.cos(a) * 90, 30 + (i % 2) * 8, Math.sin(a) * 90, Math.PI / 2, 0, 0);
    s.lookAt(0, 30, 0); s.rotateX(Math.PI / 2);
    glowSprite(root, cols[i], 26, 0.4, Math.cos(a) * 90, 30 + (i % 2) * 8, Math.sin(a) * 90);
    seals.push(s);
  }
  const scroll = new THREE.Group(); scroll.position.set(0, 58, -60); root.add(scroll);
  mesh(scroll, new THREE.CylinderGeometry(3, 3, 26, 14), std(0xf2e6c4, 0.0, 0.7, { emissive: 0xfff0c0, emissiveIntensity: 0.4 }), 0, 0, 0, 0, 0, Math.PI / 2);
  mesh(scroll, new THREE.CylinderGeometry(3.4, 3.4, 1.6, 14), goldMat(), -13, 0, 0, 0, 0, Math.PI / 2);
  mesh(scroll, new THREE.CylinderGeometry(3.4, 3.4, 1.6, 14), goldMat(), 13, 0, 0, 0, 0, Math.PI / 2);
  glowSprite(scroll, 0xfff3c0, 60, 0.5);
  // shelves of tablets along the wall
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU;
    mesh(root, new THREE.BoxGeometry(14, 40, 4), marble(0xe8e2f2), Math.cos(a) * 60, 20, Math.sin(a) * 60, 0, -a + Math.PI / 2, 0);
    mesh(root, new THREE.BoxGeometry(10, 0.5, 4.4), glowMat(GOLD, 0.8), Math.cos(a) * 60, 27, Math.sin(a) * 60, 0, -a + Math.PI / 2, 0);
    mesh(root, new THREE.BoxGeometry(10, 0.5, 4.4), glowMat(0xe9d5ff, 0.8), Math.cos(a) * 60, 12, Math.sin(a) * 60, 0, -a + Math.PI / 2, 0);
  }
  haloRing(root, 50, 0.7, 0xe9d5ff, 0, 64, 0, Math.PI / 2);
  ctx.on((_dt, t) => { seals.forEach((s, i) => { s.position.y = 30 + (i % 2) * 8 + Math.sin(t * 0.7 + i) * 2.2; }); scroll.rotation.y = t * 0.1; });
  sparks(ctx, 0xe9d5ff, 150, 62, 40); feathers(ctx, 50, 60, 30);
}

function buildGlassSea(ctx: Ctx) {
  const { root } = ctx;
  // a sea of glass mingled with fire (Revelation 15:2): a shiny glass plane with drifting fire-lit ripples
  mesh(root, new THREE.PlaneGeometry(900, 900), std(0xc8e8f8, 0.9, 0.05, { emissive: 0x7dd3fc, emissiveIntensity: 0.3 }), 0, -0.4, 0, -Math.PI / 2);
  const ripples: THREE.Mesh[] = [];
  for (let i = 0; i < 10; i++) {
    const r = mesh(root, new THREE.RingGeometry(10 + i * 14, 11 + i * 14, 64), glowMat(i % 3 === 0 ? 0xffd27a : 0xffffff, 0.35), 0, -0.2, 0, -Math.PI / 2);
    ripples.push(r);
  }
  // crystal spires and standing multitudes of light
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * TAU, r = 80 + (i % 4) * 22;
    const h = 20 + (i % 5) * 9;
    mesh(root, new THREE.OctahedronGeometry(5, 0), std(0xdff4ff, 0.1, 0.05, { emissive: 0xaee4ff, emissiveIntensity: 0.55, transparent: true, opacity: 0.8 }), Math.cos(a) * r, h * 0.5, Math.sin(a) * r).scale.set(1, h / 5, 1);
    glowSprite(root, 0xdff4ff, 14, 0.6, Math.cos(a) * r, h + 3, Math.sin(a) * r);
  }
  for (let i = 0; i < 5; i++) seraphSilhouette(root, 1.4, -120 + i * 60, 60 + (i % 2) * 14, -230, 0);
  haloRing(root, 100, 1.4, 0xffffff, 0, 120, -250);
  cloudBank(ctx, 24, 120, 220, 16, 1.6);
  godRays(ctx, 9, 0xe6f7ff, 0.08);
  ctx.on((_dt, t) => { ripples.forEach((r, i) => { const s = 1 + ((t * 0.08 + i * 0.1) % 1) * 0.12; r.scale.setScalar(s); }); });
  feathers(ctx, 110); sparks(ctx, 0xbaf0ff, 90);
}

function buildChoirDome(ctx: Ctx) {
  const { root } = ctx;
  ground(ctx, 0xf0e8d4);
  // a tiered dome of singing figures: concentric galleries of columns and a ring of lit statues
  for (let tier = 0; tier < 4; tier++) {
    const R = 72 - tier * 4, y = tier * 14;
    colonnade(ctx, 18 - tier * 2, R, 12);
    mesh(root, new THREE.TorusGeometry(R, 0.9, 8, 70), goldMat(), 0, y + 14, 0, Math.PI / 2);
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * TAU + tier * 0.17;
      glowSprite(root, tier % 2 ? 0xfff3c0 : 0xffffff, 5, 0.9, Math.cos(a) * (R + 3), y + 8, Math.sin(a) * (R + 3));
      mesh(root, new THREE.CapsuleGeometry(1.1, 3.2, 4, 8), glowMat(0xfffaf0, 0.8), Math.cos(a) * (R + 3), y + 5, Math.sin(a) * (R + 3));
    }
  }
  const dome = mesh(root, new THREE.SphereGeometry(100, 40, 20, 0, TAU, 0, Math.PI / 2), std(0xfff6dc, 0.1, 0.4, { emissive: 0xffe9b0, emissiveIntensity: 0.35, side: THREE.BackSide }), 0, 56, 0);
  void dome;
  for (let i = 0; i < 12; i++) { const rib = mesh(root, new THREE.TorusGeometry(100, 0.8, 6, 50, Math.PI / 2), goldMat(), 0, 56, 0); rib.rotation.order = 'YXZ'; rib.rotation.set(0, (i / 12) * TAU, 0); }
  haloRing(root, 18, 0.8, 0xfff3c0, 0, 150, 0, Math.PI / 2);
  glowSprite(root, 0xfff3c0, 100, 0.4, 0, 150, 0);
  beam(root, new THREE.Vector3(0, 156, 0), new THREE.Vector3(0, 0, 0), 4, 40, 0xfff6d0, 0.1);
  sparks(ctx, 0xfff3c0, 150, 64, 44); feathers(ctx, 90, 62, 40);
}

function buildThroneRoad(ctx: Ctx) {
  const { root } = ctx;
  ground(ctx);
  // a straight processional road of white slabs lined with statues and gold braziers, leading to a distant throne
  for (let i = 0; i < 14; i++) {
    const z = -50 - i * 14;
    mesh(root, new THREE.BoxGeometry(40, 0.8, 11), marble(), 0, -0.2, z);
    mesh(root, new THREE.BoxGeometry(40.6, 0.2, 0.5), glowMat(GOLD, 0.9), 0, 0.3, z + 5.5);
    for (const s of [-1, 1]) {
      column(root, s * 24, z, 18 + (i % 2) * 2, 1.1);
      glowSprite(root, 0xffd27a, 5, 0.9, s * 24, 24, z);
    }
  }
  const throne = new THREE.Group(); throne.position.set(0, 0, -270); root.add(throne);
  mesh(throne, new THREE.BoxGeometry(70, 6, 50), marble(), 0, 3, 0);
  for (let i = 0; i < 7; i++) mesh(throne, new THREE.BoxGeometry(60 - i * 6, 2, 40 - i * 4), i % 2 ? goldMat() : marble(), 0, 6 + i * 2.2, 0);
  mesh(throne, new THREE.BoxGeometry(22, 60, 8), std(0xfff6dc, 0.3, 0.25, { emissive: 0xffe9a8, emissiveIntensity: 0.6 }), 0, 50, -12);
  haloRing(throne, 34, 1.4, 0xfff3c0, 0, 66, -8);
  haloRing(throne, 46, 0.7, GOLD, 0, 66, -8);
  glowSprite(throne, 0xffffff, 190, 0.6, 0, 66, -6);
  // the rainbow around the throne
  const rb = [0xff7b7b, 0xffc46b, 0xfff07a, 0x8be08b, 0x7ac6ff, 0xa88bff];
  rb.forEach((c, i) => mesh(throne, new THREE.TorusGeometry(58 + i * 2.4, 0.9, 6, 70, Math.PI), glowMat(c, 0.55), 0, 6, -8));
  beam(root, new THREE.Vector3(0, 240, -280), new THREE.Vector3(0, 0, -90), 10, 40, 0xfff6d0, 0.1);
  cloudBank(ctx, -4, 110, 220, 24);
  godRays(ctx, 6);
  feathers(ctx, 150); sparks(ctx, GOLD, 90);
}

function buildEdenCore(ctx: Ctx) {
  const { root, rnd } = ctx;
  ground(ctx, 0xf4f0e4);
  // the garden around the Tree of Life: a colossal luminous tree behind the north wall, a river of light
  const tree = new THREE.Group(); tree.position.set(0, 0, -150); root.add(tree);
  mesh(tree, new THREE.CylinderGeometry(7, 14, 80, 14), std(0xf3ead2, 0.1, 0.6, { emissive: 0xffe9a8, emissiveIntensity: 0.45 }), 0, 40, 0);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    const br = mesh(tree, new THREE.CylinderGeometry(1.2, 3, 70, 8), std(0xf3ead2, 0.1, 0.6, { emissive: 0xffe9a8, emissiveIntensity: 0.4 }), Math.cos(a) * 18, 100, Math.sin(a) * 18);
    br.rotation.set(Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9);
  }
  const fruit: THREE.Sprite[] = [];
  for (let i = 0; i < 90; i++) {
    const a = rnd() * TAU, r = 10 + rnd() * 60, y = 90 + rnd() * 80;
    fruit.push(glowSprite(tree, i % 3 ? 0xfff3c0 : 0xffffff, 3 + rnd() * 4, 0.95, Math.cos(a) * r, y, Math.sin(a) * r * 0.8));
  }
  glowSprite(tree, 0xfff3c0, 280, 0.35, 0, 130, 0);
  haloRing(tree, 80, 1.6, 0xffffff, 0, 130, 0, Math.PI / 2);
  haloRing(tree, 100, 0.8, GOLD, 0, 130, 0, Math.PI / 2.4);
  // river of light running toward the viewer
  const river = mesh(root, new THREE.PlaneGeometry(26, 240), glowMat(0xdff4ff, 0.7), 0, 0.05, -110, -Math.PI / 2);
  void river;
  for (let i = 0; i < 16; i++) mesh(root, new THREE.PlaneGeometry(2, 14), glowMat(0xffffff, 0.8), (i % 2 ? 1 : -1) * 4, 0.1, -20 - i * 14, -Math.PI / 2);
  colonnade(ctx, 20, 76, 24, 1.4);
  for (let i = 0; i < 8; i++) seraphSilhouette(root, 1.0 + (i % 3) * 0.2, Math.cos((i / 8) * TAU) * 190, 60 + (i % 3) * 20, Math.sin((i / 8) * TAU) * 190, -(i / 8) * TAU + Math.PI / 2);
  eyeWheel(root, 30, -110, 70, -90, 0.25, ctx);
  eyeWheel(root, 30, 110, 70, -90, -0.25, ctx);
  beam(root, new THREE.Vector3(0, 220, -150), new THREE.Vector3(0, 0, -40), 8, 46, 0xfff6d0, 0.11);
  cloudBank(ctx, -4, 120, 230, 24);
  godRays(ctx, 10, 0xfff6d0, 0.08);
  ctx.on((_dt, t) => {
    fruit.forEach((f, i) => { f.material.opacity = 0.65 + Math.sin(t * 1.4 + i) * 0.3; });
    ctx.hemi.intensity = 0.88 + Math.sin(t * 0.8) * 0.05;
  });
  feathers(ctx, 220, 66, 44); sparks(ctx, 0xfff3c0, 140);
}

export const EDEN_BUILDERS: Record<EdenId, (ctx: Ctx) => void> = {
  edengate: buildEdenGate, cloudstair: buildCloudStair, lampstands: buildLampstands, wheelgarden: buildWheelGarden,
  trumpethall: buildTrumpetHall, sealvault: buildSealVault, glasssea: buildGlassSea, choirdome: buildChoirDome,
  throneroad: buildThroneRoad, edencore: buildEdenCore,
};
