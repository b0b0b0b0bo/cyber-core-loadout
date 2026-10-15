import * as THREE from 'three';
import {
  std, basic, additive, mesh, box, glowSprite, beam, particles, canvasTex,
} from './stageScenery';
import type { Ctx, SceneryConfig } from './stageScenery';
import { digitTexture, digitMaterial } from './neonFx';

/**
 * MAP 10 NEON DISTRICT — a rain-soaked cyber city of neon towers, holo-billboards and falling green code
 * (SEC-64 .. SEC-70). Everything is visual set dressing outside the arena walls (|x|,|z| > 41) or overhead.
 */

type NeonId = 'neonavenue' | 'neonarcade' | 'datastream' | 'billboardspire' | 'serverblock' | 'skyway' | 'neoncore';

export const NEON_CONFIG: Record<NeonId, SceneryConfig> = {
  neonavenue: {
    sky: {
      top: 0x080620, horizon: 0x5a2a8a, bottom: 0x06041a, exponent: 0.55, stars: 0.012,
      clouds: { color: 0x3a2060, coverage: 0.55, speed: 0.01, opacity: 0.7 }, horizonGlow: { color: 0xe879f9, strength: 0.5 },
    },
    fogColor: 0x1c1038, fogDensity: 0.0125,
    ambient: [0xc8b0ff, 0.56], hemi: [0xa890ff, 0x0c0820, 0.82],
    sun: { color: 0xd0b8ff, intensity: 0.7, pos: [-30, 40, -50] },
    wallHeight: 3, gridOpacity: 0.22, cornerLight: [0xe879f9, 2.2],
    floorTint: 0xc0b8e0, env: 'sky', envIntensity: 0.9,
  },
  neonarcade: {
    sky: { top: 0x06041a, horizon: 0x2a1450, bottom: 0x040210 },
    fogColor: 0x180c34, fogDensity: 0.0125,
    ambient: [0xd0b8ff, 0.58], hemi: [0xb098ff, 0x0a0620, 0.84],
    sun: { color: 0xe0c8ff, intensity: 0.7, pos: [0, 40, 0] },
    wallHeight: 12, gridOpacity: 0.26, cornerLight: [0x67e8f9, 2.6],
    floorTint: 0xb8b0dc, env: 'hemi', envIntensity: 0.9,
  },
  datastream: {
    sky: {
      top: 0x021208, horizon: 0x0a4a30, bottom: 0x020a06, exponent: 0.5, stars: 0.02,
      nebula: { a: 0x10b981, b: 0x6366f1, strength: 0.35 }, horizonGlow: { color: 0x4ade80, strength: 0.5 },
    },
    fogColor: 0x06241a, fogDensity: 0.0115,
    ambient: [0xc0ffd8, 0.56], hemi: [0x90f0b8, 0x041208, 0.82],
    sun: { color: 0xc0ffe0, intensity: 0.7, pos: [0, 40, -40] },
    wallHeight: 2.4, gridOpacity: 0.3, cornerLight: [0x4ade80, 2.4],
    floorTint: 0xb0d0c0, env: 'sky', envIntensity: 0.85,
  },
  billboardspire: {
    sky: {
      top: 0x0a0630, horizon: 0x7a2a9a, bottom: 0x080420, exponent: 0.55, stars: 0.02,
      aurora: { color: 0xe879f9, strength: 0.4 }, horizonGlow: { color: 0xf0abfc, strength: 0.5 },
    },
    fogColor: 0x20103c, fogDensity: 0.0108,
    ambient: [0xdcc0ff, 0.6], hemi: [0xc0a0ff, 0x100828, 0.86],
    sun: { color: 0xe8d0ff, intensity: 0.85, pos: [20, 50, -50] },
    wallHeight: 2.6, gridOpacity: 0.24, cornerLight: [0xf472b6, 2.4],
    floorTint: 0xc4b8e4, env: 'sky', envIntensity: 0.95,
  },
  serverblock: {
    sky: { top: 0x040616, horizon: 0x16204a, bottom: 0x03040e },
    fogColor: 0x0c1230, fogDensity: 0.0132,
    ambient: [0xb0c8ff, 0.54], hemi: [0x88a8ff, 0x060a1c, 0.8],
    sun: { color: 0xb8d0ff, intensity: 0.65, pos: [0, 40, 0] },
    wallHeight: 14, gridOpacity: 0.26, cornerLight: [0x38bdf8, 2.6],
    floorTint: 0xaab4d8, env: 'hemi', envIntensity: 0.88,
  },
  skyway: {
    sky: {
      top: 0x0a0838, horizon: 0xc04ac0, bottom: 0x0a0624, exponent: 0.6, stars: 0.03,
      sun: { dir: [0.5, 0.35, -0.8], color: 0xf5d0ff, size: 0.006, glow: 1.0 }, horizonGlow: { color: 0xff7ad0, strength: 0.6 },
    },
    fogColor: 0x2a1448, fogDensity: 0.0092,
    ambient: [0xe0c8ff, 0.66], hemi: [0xc8a8ff, 0x180c34, 0.9],
    sun: { color: 0xffd8ff, intensity: 1.0, pos: [30, 36, -60] },
    wallHeight: 1.8, gridOpacity: 0.26, cornerLight: [0xe879f9, 2.4],
    floorTint: 0xc8bce8, env: 'sky', envIntensity: 1.0,
  },
  neoncore: {
    sky: {
      top: 0x050420, horizon: 0x40208a, bottom: 0x040216, exponent: 0.5, stars: 0.03,
      nebula: { a: 0xc026d3, b: 0x06b6d4, strength: 0.42 }, horizonGlow: { color: 0xc084fc, strength: 0.6 },
      sun: { dir: [-0.35, 0.5, -0.8], color: 0xe0f2fe, size: 0.008, glow: 1.0 },
    },
    fogColor: 0x160a34, fogDensity: 0.0098,
    ambient: [0xd0b8ff, 0.62], hemi: [0xb898ff, 0x0c0624, 0.88],
    sun: { color: 0xd8c8ff, intensity: 0.95, pos: [-20, 50, -60] },
    wallHeight: 2.4, gridOpacity: 0.3, cornerLight: [0xe879f9, 2.8],
    floorTint: 0xc0b4e8, env: 'sky', envIntensity: 1.0,
  },
};

const TAU = Math.PI * 2;
const PALETTE = [0xe879f9, 0x67e8f9, 0xa78bfa, 0xf472b6, 0x4ade80, 0xfbbf24];

// ───────────────────────────── shared helpers ─────────────────────────────

const glowMat = (color: number, opacity = 1) => basic(color, { toneMapped: false, fog: false, transparent: opacity < 1, opacity });

const ground = (ctx: Ctx, color = 0x0e0a22, emissive = 0x120a30) =>
  mesh(ctx.root, new THREE.PlaneGeometry(600, 600), std(color, 0.5, 0.35, { emissive, emissiveIntensity: 0.4 }), 0, -0.3, 0, -Math.PI / 2);

const winTex = new Map<number, THREE.Texture>();
/** Lit-window facade texture (emissive): dark glass with random cyan / magenta / warm windows. */
function windowTexture(seed: number): THREE.Texture {
  const hit = winTex.get(seed);
  if (hit) return hit;
  const cols = 8, rows = 16, cw = 16, ch = 20;
  let s = seed * 7919 + 13;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const t = canvasTex(cols * cw, rows * ch, (g) => {
    g.fillStyle = '#05040f';
    g.fillRect(0, 0, cols * cw, rows * ch);
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const r = rnd();
      if (r < 0.46) continue;
      g.fillStyle = r < 0.62 ? '#67e8f9' : r < 0.78 ? '#e879f9' : r < 0.9 ? '#fde68a' : '#a78bfa';
      g.fillRect(x * cw + 3, y * ch + 4, cw - 6, ch - 8);
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  winTex.set(seed, t);
  return t;
}

/** Neon tower: window facade, glowing corner strips, rooftop antenna and optional signage. Returns top height. */
function tower(parent: THREE.Object3D, rnd: () => number, x: number, z: number, w: number, h: number, d: number) {
  const g = new THREE.Group(); g.position.set(x, 0, z); parent.add(g);
  const tex = windowTexture(1 + Math.floor(rnd() * 6)).clone();
  tex.needsUpdate = true;
  tex.repeat.set(Math.max(1, Math.round(w / 6)), Math.max(1, Math.round(h / 12)));
  const mat = std(0x14102c, 0.6, 0.35, { emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.85 });
  mesh(g, new THREE.BoxGeometry(w, h, d), mat, 0, h / 2, 0);
  const c1 = PALETTE[Math.floor(rnd() * 4)], c2 = PALETTE[Math.floor(rnd() * 4)];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) mesh(g, new THREE.BoxGeometry(0.35, h, 0.35), glowMat((sx * sz > 0 ? c1 : c2)), sx * w / 2, h / 2, sz * d / 2);
  mesh(g, new THREE.BoxGeometry(w + 0.5, 0.5, d + 0.5), glowMat(c1), 0, h, 0);
  if (rnd() < 0.6) { // rooftop mast with a beacon
    mesh(g, new THREE.CylinderGeometry(0.15, 0.3, h * 0.25, 6), std(0x3a3860, 0.8, 0.3), 0, h + h * 0.125, 0);
    glowSprite(g, c2, 8, 0.7, 0, h + h * 0.26, 0);
  }
  if (rnd() < 0.5) { // vertical neon sign strip
    mesh(g, new THREE.BoxGeometry(0.5, h * 0.4, 1.6), glowMat(c2), w / 2 + 0.3, h * 0.55, 0);
  }
  return g;
}

/** A glowing screen showing falling green digits (registers its texture for scrolling). */
function digitWall(ctx: Ctx, parent: THREE.Object3D, w: number, h: number, x: number, y: number, z: number, ry: number, seed: number, tint = 0xffffff) {
  const tex = digitTexture(Math.max(4, Math.round(w / 2)), Math.max(8, Math.round(h / 2)), seed);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), digitMaterial(tex, 0.85, tint));
  m.position.set(x, y, z);
  m.rotation.y = ry;
  m.material.fog = false;
  parent.add(m);
  const frame = mesh(parent, new THREE.BoxGeometry(w + 1, h + 1, 0.4), glowMat(0x1a1440), x, y, z - 0.3);
  frame.rotation.y = ry;
  ctx.on((dt) => { tex.offset.y -= dt * 0.25; });
  return m;
}

/** Colour-cycling holo billboard (flat panel with a moving gradient). */
function holoBoard(ctx: Ctx, parent: THREE.Object3D, w: number, h: number, x: number, y: number, z: number, ry: number, c1: number, c2: number) {
  const tex = canvasTex(256, 128, (g) => {
    const gr = g.createLinearGradient(0, 0, 256, 0);
    gr.addColorStop(0, '#' + c1.toString(16).padStart(6, '0'));
    gr.addColorStop(0.5, '#f5f3ff');
    gr.addColorStop(1, '#' + c2.toString(16).padStart(6, '0'));
    g.fillStyle = gr; g.fillRect(0, 0, 256, 128);
    g.fillStyle = 'rgba(0,0,0,0.5)';
    for (let i = 0; i < 128; i += 6) g.fillRect(0, i, 256, 2);
  });
  tex.wrapS = THREE.RepeatWrapping;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, fog: false }));
  m.position.set(x, y, z); m.rotation.y = ry;
  parent.add(m);
  ctx.on((dt) => { tex.offset.x += dt * 0.12; });
  return m;
}

/** Rain + drifting data motes. */
const rain = (ctx: Ctx, count = 300, half = 64, top = 40) =>
  particles(ctx, { count, size: 0.15, color: 0xb8a8ff, opacity: 0.5, half: [half, half], y: [0.5, top], mode: 'fall', speed: 14, sway: 0.4 });
const codeFall = (ctx: Ctx, count = 160, half = 64, top = 50) =>
  particles(ctx, { count, size: 0.34, color: 0x4ade80, opacity: 0.8, half: [half, half], y: [0.5, top], mode: 'fall', speed: 4, sway: 0.3 });
const motes = (ctx: Ctx, color = 0x67e8f9, count = 120, half = 62, top = 36) =>
  particles(ctx, { count, size: 0.3, color, opacity: 0.7, half: [half, half], y: [0.5, top], mode: 'drift', speed: 1.4, sway: 1.4 });

/** Light streaks of flying traffic along fixed lanes. */
function traffic(ctx: Ctx, lanes: { y: number; z: number; dir: number }[], span = 160, count = 12) {
  const cars: { s: THREE.Sprite; lane: number; x: number; sp: number }[] = [];
  lanes.forEach((ln, li) => {
    for (let i = 0; i < count; i++) {
      const c = PALETTE[(i + li) % PALETTE.length];
      const s = glowSprite(ctx.root, c, 3 + (i % 3), 0.85, 0, ln.y, ln.z);
      cars.push({ s, lane: li, x: (i / count) * span - span / 2, sp: 18 + (i % 5) * 6 });
    }
  });
  ctx.on((dt) => cars.forEach((c) => {
    const ln = lanes[c.lane];
    c.x += ln.dir * c.sp * dt;
    if (c.x > span / 2) c.x = -span / 2; else if (c.x < -span / 2) c.x = span / 2;
    c.s.position.set(c.x, ln.y, ln.z);
  }));
}

/** Neon ring sign that spins. */
function neonRing(parent: THREE.Object3D, r: number, color: number, x: number, y: number, z: number, rx = 0) {
  return mesh(parent, new THREE.TorusGeometry(r, r * 0.04, 8, 56), glowMat(color), x, y, z, rx);
}

/** Server rack monolith with blinking LED rows. */
function rack(parent: THREE.Object3D, rnd: () => number, x: number, z: number, w: number, h: number, leds: THREE.MeshBasicMaterial[]) {
  const g = new THREE.Group(); g.position.set(x, 0, z); parent.add(g);
  mesh(g, new THREE.BoxGeometry(w, h, w), std(0x161430, 0.7, 0.35, { emissive: 0x0a0820, emissiveIntensity: 0.5 }), 0, h / 2, 0);
  const rows = Math.floor(h / 2.2);
  for (let i = 0; i < rows; i++) {
    const m = glowMat(PALETTE[Math.floor(rnd() * PALETTE.length)]) as THREE.MeshBasicMaterial;
    leds.push(m);
    mesh(g, new THREE.BoxGeometry(w * 0.8, 0.22, 0.12), m, 0, 1.6 + i * 2.2, w / 2 + 0.07);
  }
  mesh(g, new THREE.BoxGeometry(w + 0.4, 0.4, w + 0.4), glowMat(0x67e8f9), 0, h, 0);
  return g;
}

// ───────────────────────────── stages ─────────────────────────────

function buildNeonAvenue(ctx: Ctx) {
  const { root, rnd } = ctx;
  ground(ctx);
  for (let i = 0; i < 40; i++) { // two walls of neon towers lining the avenue, plus a skyline behind
    const side = i % 2 ? 1 : -1, row = Math.floor(i / 2);
    const x = side * (62 + (row % 3) * 10 + rnd() * 6), z = -110 + row * 11 + rnd() * 5;
    tower(root, rnd, x, z, 12 + rnd() * 10, 40 + rnd() * 70, 12 + rnd() * 10);
  }
  for (let i = 0; i < 18; i++) tower(root, rnd, -120 + i * 14 + rnd() * 6, -118 - rnd() * 24, 14 + rnd() * 10, 60 + rnd() * 90, 14 + rnd() * 8);
  digitWall(ctx, root, 26, 40, -55, 34, -40, Math.PI / 2, 1);
  digitWall(ctx, root, 26, 40, 55, 34, 30, -Math.PI / 2, 2, 0xbbf7d0);
  holoBoard(ctx, root, 40, 20, 0, 46, -96, 0, 0xe879f9, 0x67e8f9);
  for (let i = 0; i < 6; i++) neonRing(root, 5 + (i % 3) * 2, PALETTE[i], (i % 2 ? 1 : -1) * 58, 14 + i * 5, -70 + i * 22, Math.PI / 2);
  traffic(ctx, [{ y: 32, z: -62, dir: 1 }, { y: 40, z: -78, dir: -1 }, { y: 26, z: 70, dir: -1 }], 220, 10);
  rain(ctx, 360, 66, 42); motes(ctx, 0xe879f9, 80, 60, 30);
  beam(root, new THREE.Vector3(0, 120, -100), new THREE.Vector3(0, 0, -50), 4, 28, 0xe879f9, 0.05);
  ctx.on((_dt, t) => { ctx.hemi.intensity = 0.82 + Math.sin(t * 0.6) * 0.05; });
}

function buildNeonArcade(ctx: Ctx) {
  const { root, rnd } = ctx;
  ground(ctx, 0x0c0820, 0x16103a);
  // rows of arcade cabinets (glowing screens) around the perimeter
  const screens: THREE.MeshBasicMaterial[] = [];
  for (let i = 0; i < 70; i++) {
    const a = (i / 70) * TAU, r = 56 + (i % 3) * 5;
    const g = new THREE.Group(); g.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); g.rotation.y = -a + Math.PI / 2; root.add(g);
    mesh(g, new THREE.BoxGeometry(3.2, 7, 3), std(0x1c1840, 0.5, 0.4), 0, 3.5, 0);
    const sm = glowMat(PALETTE[i % PALETTE.length]) as THREE.MeshBasicMaterial; screens.push(sm);
    mesh(g, new THREE.BoxGeometry(2.4, 2.2, 0.1), sm, 0, 4.4, -1.55);
    mesh(g, new THREE.BoxGeometry(3.4, 0.25, 3.2), glowMat(PALETTE[(i + 2) % PALETTE.length]), 0, 7.1, 0);
  }
  for (let i = 0; i < 4; i++) digitWall(ctx, root, 40, 22, Math.cos(i * 1.57 + 0.78) * 80, 22, Math.sin(i * 1.57 + 0.78) * 80, -(i * 1.57 + 0.78) + Math.PI / 2, 10 + i);
  const rings: THREE.Mesh[] = [];
  for (let i = 0; i < 5; i++) rings.push(neonRing(root, 36 + i * 8, PALETTE[i], 0, 40 + i * 2, 0, Math.PI / 2));
  for (let i = 0; i < 14; i++) mesh(root, new THREE.CylinderGeometry(0.5, 0.5, 60, 6), glowMat(PALETTE[i % PALETTE.length], 0.7), Math.cos(i * 0.45) * 70, 30, Math.sin(i * 0.45) * 70); // light pillars
  codeFall(ctx, 100, 60, 44); motes(ctx, 0xe879f9, 90, 60, 30);
  beam(root, new THREE.Vector3(0, 60, 0), new THREE.Vector3(0, 0, 0), 3, 30, 0xc4b5fd, 0.05);
  ctx.on((_dt, t) => {
    screens.forEach((m, i) => m.color.setHex(PALETTE[(Math.floor(t * 1.5 + i) % PALETTE.length)]));
    rings.forEach((r, i) => { r.rotation.z = t * (0.1 + i * 0.03) * (i % 2 ? -1 : 1); });
    ctx.hemi.intensity = 0.84 + Math.sin(t * 0.8) * 0.05;
  });
  void rnd;
}

function buildDataStream(ctx: Ctx) {
  const { root, rnd } = ctx;
  ground(ctx, 0x041008, 0x062a14);
  // a glowing grid floor beyond the arena
  const grid = new THREE.GridHelper(600, 120, 0x4ade80, 0x0f5a32);
  grid.position.y = -0.2;
  (grid.material as THREE.Material).transparent = true; (grid.material as THREE.Material).opacity = 0.45;
  root.add(grid);
  // colossal columns of falling code
  const cols: THREE.Mesh[] = [];
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * TAU + rnd() * 0.2, r = 66 + rnd() * 50, h = 70 + rnd() * 60;
    const tex = digitTexture(6, 24, 30 + i);
    tex.repeat.x = 1;
    const m = mesh(root, new THREE.CylinderGeometry(5 + rnd() * 4, 5 + rnd() * 4, h, 14, 1, true), digitMaterial(tex, 0.75), Math.cos(a) * r, h / 2, Math.sin(a) * r);
    (m.material as THREE.MeshBasicMaterial).fog = false;
    cols.push(m);
    ctx.on((dt) => { tex.offset.y -= dt * (0.15 + (i % 4) * 0.05); });
  }
  const cubes: { m: THREE.Mesh; r: number; y: number; a0: number; sp: number }[] = [];
  for (let i = 0; i < 40; i++) {
    const s = 1 + rnd() * 2.2;
    const m = mesh(root, new THREE.BoxGeometry(s, s, s), glowMat(i % 3 ? 0x4ade80 : 0x67e8f9, 0.55));
    cubes.push({ m, r: 55 + rnd() * 60, y: 4 + rnd() * 50, a0: rnd() * TAU, sp: 0.02 + rnd() * 0.04 });
  }
  for (let i = 0; i < 6; i++) neonRing(root, 30 + i * 8, i % 2 ? 0x4ade80 : 0x67e8f9, 0, 8 + i * 12, -100, 0);
  beam(root, new THREE.Vector3(0, 130, -80), new THREE.Vector3(0, 0, -30), 6, 40, 0x4ade80, 0.06);
  codeFall(ctx, 380, 70, 60); motes(ctx, 0x86efac, 140, 66, 40);
  ctx.on((_dt, t) => {
    cubes.forEach((c, i) => { const a = c.a0 + t * c.sp; c.m.position.set(Math.cos(a) * c.r, c.y + Math.sin(t * 0.8 + i) * 1.4, Math.sin(a) * c.r); c.m.rotation.x += 0.004; c.m.rotation.y += 0.006; });
    ctx.hemi.intensity = 0.82 + Math.sin(t * 0.7) * 0.05;
  });
  void cols;
}

function buildBillboardSpire(ctx: Ctx) {
  const { root, rnd } = ctx;
  ground(ctx);
  for (let i = 0; i < 26; i++) { const a = rnd() * TAU, r = 70 + rnd() * 60; tower(root, rnd, Math.cos(a) * r, Math.sin(a) * r, 12 + rnd() * 10, 40 + rnd() * 80, 12 + rnd() * 10); }
  // the great spire behind the north wall, wrapped in billboards and spinning halos
  const spire = new THREE.Group(); spire.position.set(0, 0, -110); root.add(spire);
  mesh(spire, new THREE.CylinderGeometry(10, 18, 150, 8), std(0x1a1640, 0.7, 0.3, { emissive: 0x120a30, emissiveIntensity: 0.5 }), 0, 75, 0);
  const halos: THREE.Mesh[] = [];
  for (let k = 0; k < 6; k++) halos.push(neonRing(spire, 18 + k * 3, PALETTE[k], 0, 30 + k * 20, 0, Math.PI / 2));
  for (let k = 0; k < 4; k++) holoBoard(ctx, spire, 26, 34, Math.sin(k * 1.57) * 17, 70, Math.cos(k * 1.57) * 17, k * 1.57, PALETTE[k], PALETTE[(k + 2) % PALETTE.length]);
  mesh(spire, new THREE.ConeGeometry(4, 40, 6), glowMat(0xf5f3ff), 0, 170, 0);
  glowSprite(spire, 0xe879f9, 120, 0.4, 0, 150, 0);
  for (let i = 0; i < 6; i++) { // smaller side billboards on pylons
    const a = (i / 6) * TAU + 0.5, r = 74;
    const g = new THREE.Group(); g.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); root.add(g);
    mesh(g, new THREE.CylinderGeometry(1, 1.6, 34, 6), std(0x2a2650, 0.7, 0.3), 0, 17, 0);
    holoBoard(ctx, g, 22, 14, 0, 38, 0, -a + Math.PI / 2, PALETTE[i], PALETTE[(i + 3) % PALETTE.length]);
  }
  traffic(ctx, [{ y: 34, z: -60, dir: 1 }, { y: 48, z: 50, dir: -1 }], 220, 10);
  rain(ctx, 260, 64, 40); motes(ctx, 0xf472b6, 90, 62, 34);
  beam(root, new THREE.Vector3(0, 150, -110), new THREE.Vector3(0, 0, -40), 6, 36, 0xe879f9, 0.06);
  ctx.on((_dt, t) => {
    halos.forEach((h, i) => { h.rotation.z = t * (0.1 + i * 0.03) * (i % 2 ? -1 : 1); });
    ctx.hemi.intensity = 0.86 + Math.sin(t * 0.7) * 0.05;
  });
}

function buildServerBlock(ctx: Ctx) {
  const { root, rnd } = ctx;
  ground(ctx, 0x080618, 0x0c0a28);
  const leds: THREE.MeshBasicMaterial[] = [];
  for (let i = 0; i < 44; i++) { // canyons of rack monoliths
    const a = (i / 44) * TAU, r = 60 + (i % 4) * 9 + rnd() * 4;
    rack(root, rnd, Math.cos(a) * r, Math.sin(a) * r, 6 + rnd() * 4, 22 + rnd() * 30, leds);
  }
  for (let i = 0; i < 16; i++) { // cable arcs overhead
    const a = rnd() * TAU;
    const arc = mesh(root, new THREE.TorusGeometry(26 + rnd() * 16, 0.5, 6, 40, Math.PI), std(0x2a2850, 0.8, 0.3, { emissive: i % 2 ? 0x1a3a5a : 0x3a1a5a, emissiveIntensity: 0.6 }), Math.cos(a) * 36, 36, Math.sin(a) * 36, 0, a, 0);
    arc.rotation.x = 0;
  }
  const rings: THREE.Mesh[] = [];
  for (let i = 0; i < 4; i++) rings.push(neonRing(root, 44 + i * 8, i % 2 ? 0xe879f9 : 0x38bdf8, 0, 50 + i * 3, 0, Math.PI / 2));
  digitWall(ctx, root, 40, 24, 0, 26, -80, 0, 41);
  digitWall(ctx, root, 40, 24, 0, 26, 80, Math.PI, 42, 0xbbf7d0);
  beam(root, new THREE.Vector3(0, 70, 0), new THREE.Vector3(0, 0, 0), 3, 34, 0x7dd3fc, 0.06);
  codeFall(ctx, 200, 62, 46); motes(ctx, 0x38bdf8, 120, 62, 34);
  ctx.on((_dt, t) => {
    leds.forEach((m, i) => m.color.setHex(Math.sin(t * 2.2 + i * 1.9) > -0.1 ? PALETTE[i % PALETTE.length] : 0x14102c));
    rings.forEach((r, i) => { r.rotation.z = t * (0.08 + i * 0.03) * (i % 2 ? -1 : 1); });
    ctx.hemi.intensity = 0.8 + Math.sin(t * 0.8) * 0.05;
  });
}

function buildSkyway(ctx: Ctx) {
  const { root, rnd } = ctx;
  // the city lies far below: a glowing grid sea with towers rising from it
  mesh(root, new THREE.PlaneGeometry(700, 700), std(0x0a0820, 0.4, 0.5, { emissive: 0x1a0a40, emissiveIntensity: 0.5 }), 0, -40, 0, -Math.PI / 2);
  const grid = new THREE.GridHelper(700, 70, 0xe879f9, 0x3a1a6a);
  grid.position.y = -39.8;
  (grid.material as THREE.Material).transparent = true; (grid.material as THREE.Material).opacity = 0.6;
  root.add(grid);
  for (let i = 0; i < 70; i++) { const a = rnd() * TAU, r = 60 + rnd() * 160; tower(root, rnd, Math.cos(a) * r, Math.sin(a) * r, 10 + rnd() * 12, 20 + rnd() * 90, 10 + rnd() * 12).position.y = -40; }
  // transparent highway ribbons crossing under the deck + glass railings
  for (let i = 0; i < 4; i++) {
    const lane = mesh(root, new THREE.BoxGeometry(260, 0.4, 8), glowMat(PALETTE[i], 0.5), 0, -6 - i * 4, -50 - i * 30, 0, (i % 2) * 0.12, 0);
    void lane;
  }
  traffic(ctx, [{ y: -6, z: -50, dir: 1 }, { y: -10, z: -80, dir: -1 }, { y: -14, z: -110, dir: 1 }, { y: 6, z: 70, dir: -1 }], 260, 12);
  const mega: THREE.Mesh[] = [];
  for (let i = 0; i < 4; i++) mega.push(neonRing(root, 50 + i * 12, PALETTE[i], 0, 30 + i * 4, -150, 0));
  holoBoard(ctx, root, 70, 36, -60, 28, -120, 0.3, 0xe879f9, 0x67e8f9);
  holoBoard(ctx, root, 70, 36, 60, 34, -120, -0.3, 0xa78bfa, 0xf472b6);
  motes(ctx, 0xe879f9, 120, 66, 30); motes(ctx, 0x67e8f9, 80, 66, 22);
  beam(root, new THREE.Vector3(0, 120, -140), new THREE.Vector3(0, 0, -60), 5, 32, 0xf0abfc, 0.06);
  ctx.on((_dt, t) => {
    mega.forEach((m, i) => { m.rotation.z = t * (0.05 + i * 0.02) * (i % 2 ? -1 : 1); });
    ctx.hemi.intensity = 0.9 + Math.sin(t * 0.5) * 0.05;
  });
}

function buildNeonCore(ctx: Ctx) {
  const { root, rnd } = ctx;
  ground(ctx, 0x0a0620, 0x1a0c44);
  for (let i = 0; i < 24; i++) { const a = (i / 24) * TAU, r = 80 + rnd() * 30; tower(root, rnd, Math.cos(a) * r, Math.sin(a) * r, 12 + rnd() * 10, 50 + rnd() * 90, 12 + rnd() * 10); }
  // the core hub: a colossal armillary of neon rings around a bright core, behind the north wall
  const hub = new THREE.Group(); hub.position.set(0, 64, -130); root.add(hub);
  mesh(hub, new THREE.SphereGeometry(14, 28, 20), glowMat(0xf5f3ff));
  glowSprite(hub, 0xe879f9, 150, 0.5, 0, 0, 0);
  glowSprite(hub, 0x67e8f9, 240, 0.2, 0, 0, 0);
  const rings: THREE.Mesh[] = [];
  for (let k = 0; k < 5; k++) {
    const r = mesh(hub, new THREE.TorusGeometry(26 + k * 9, 1.2 + k * 0.2, 10, 90), glowMat(PALETTE[k % 4], 0.9));
    r.rotation.set(Math.PI / 2 + k * 0.45, k * 0.6, 0);
    rings.push(r);
  }
  // digit curtains and a ring of billboards around the arena
  for (let i = 0; i < 6; i++) digitWall(ctx, root, 30, 46, Math.cos(i * 1.047) * 88, 30, Math.sin(i * 1.047) * 88, -(i * 1.047) + Math.PI / 2, 60 + i, i % 2 ? 0xffffff : 0xf5d0fe);
  for (let i = 0; i < 8; i++) { // data pylons
    const a = (i / 8) * TAU + 0.2, r = 58;
    mesh(root, new THREE.CylinderGeometry(0.8, 1.2, 40 + (i % 3) * 8, 6), std(0x2a2650, 0.7, 0.3, { emissive: 0x1a1040, emissiveIntensity: 0.6 }), Math.cos(a) * r, 20, Math.sin(a) * r);
    glowSprite(root, PALETTE[i % PALETTE.length], 10, 0.8, Math.cos(a) * r, 42 + (i % 3) * 8, Math.sin(a) * r);
  }
  beam(root, new THREE.Vector3(0, 110, -120), new THREE.Vector3(0, 0, -30), 6, 38, 0xe879f9, 0.07);
  beam(root, new THREE.Vector3(-40, 100, -110), new THREE.Vector3(-26, 0, -20), 3, 20, 0x67e8f9, 0.05);
  beam(root, new THREE.Vector3(40, 100, -110), new THREE.Vector3(26, 0, -20), 3, 20, 0x4ade80, 0.05);
  traffic(ctx, [{ y: 40, z: -70, dir: 1 }, { y: 54, z: 70, dir: -1 }], 240, 10);
  codeFall(ctx, 260, 68, 56); rain(ctx, 200, 66, 40); motes(ctx, 0xe879f9, 120, 66, 34);
  ctx.on((_dt, t) => {
    rings.forEach((r, i) => { r.rotation.z = t * (0.08 + i * 0.03) * (i % 2 ? -1 : 1); });
    ctx.hemi.intensity = 0.88 + Math.sin(t * 0.9) * 0.06;
  });
  void additive;
}

export const NEON_BUILDERS: Record<NeonId, (ctx: Ctx) => void> = {
  neonavenue: buildNeonAvenue, neonarcade: buildNeonArcade, datastream: buildDataStream, billboardspire: buildBillboardSpire,
  serverblock: buildServerBlock, skyway: buildSkyway, neoncore: buildNeonCore,
};
