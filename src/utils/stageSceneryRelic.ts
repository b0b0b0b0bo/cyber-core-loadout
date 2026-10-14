import * as THREE from 'three';
import {
  std, basic, additive, mesh, box, canvasTex, glowSprite, beam, particles, makeArc, gothicTower, buildMech,
} from './stageScenery';
import type { Ctx, SceneryConfig } from './stageScenery';

/**
 * MAP 5 SILENT WASTES — glass desert and relic stages (SEC-29 .. SEC-35).
 * Everything is visual set dressing outside the arena walls (|x|,|z| > 41) or overhead.
 */

type RelicId = 'dunes' | 'graveyard' | 'clockwork' | 'crater' | 'chapel' | 'gate' | 'citadel';

export const RELIC_CONFIG: Record<RelicId, SceneryConfig> = {
  dunes: {
    sky: {
      top: 0x2a1850, horizon: 0xffa070, bottom: 0x3a2040, exponent: 0.45, stars: 0.006,
      sun: { dir: [-0.55, 0.14, -0.82], color: 0xffd9a8, size: 0.003, glow: 1.0 },
      clouds: { color: 0xe08a7a, coverage: 0.3, speed: 0.006, opacity: 0.5 }, horizonGlow: { color: 0xff8a5a, strength: 0.4 },
    },
    fogColor: 0x6a3a4a, fogDensity: 0.007,
    ambient: [0xffd2b8, 0.6], hemi: [0xffb08a, 0x4a2a46, 0.7],
    sun: { color: 0xffc890, intensity: 1.5, pos: [-55, 14, -82] },
    wallHeight: 1.5, gridOpacity: 0.24, cornerLight: [0xfbbf24, 1.6],
    floorTint: 0xd8c0c8, env: 'sky', envIntensity: 1.0,
  },
  graveyard: {
    sky: { top: 0x1c1410, horizon: 0x6a4a34, bottom: 0x1a120e, exponent: 0.5, clouds: { color: 0x5a4636, coverage: 0.75, speed: 0.01, opacity: 0.9 }, horizonGlow: { color: 0xf97316, strength: 0.3 } },
    fogColor: 0x3a2a20, fogDensity: 0.011,
    ambient: [0xffc08a, 0.55], hemi: [0xd8a070, 0x2a1c14, 0.7],
    sun: { color: 0xffb070, intensity: 1.0, pos: [30, 30, -40] },
    wallHeight: 3, gridOpacity: 0.22, cornerLight: [0xfb923c, 2.0],
    floorTint: 0xb09a8a, env: 'sky', envIntensity: 0.85,
  },
  clockwork: {
    sky: { top: 0x120c04, horizon: 0x2a1c08, bottom: 0x0c0804 },
    fogColor: 0x1e1408, fogDensity: 0.01,
    ambient: [0xffd890, 0.6], hemi: [0xffd070, 0x1c1206, 0.85],
    sun: { color: 0xffe0a0, intensity: 1.0, pos: [0, 40, 10] },
    wallHeight: 12, gridOpacity: 0.2, cornerLight: [0xfcd34d, 2.4],
    floorTint: 0xc8b090, env: 'hemi', envIntensity: 0.9,
  },
  crater: {
    sky: {
      top: 0x1a0408, horizon: 0xc8402a, bottom: 0x1a0a08, exponent: 0.5, stars: 0.012,
      sun: { dir: [0.4, 0.45, -0.8], color: 0xff9a6a, size: 0.012, glow: 0.8 },
      clouds: { color: 0x6a2018, coverage: 0.6, speed: 0.012, opacity: 0.8 }, horizonGlow: { color: 0xff5a2a, strength: 0.55 },
    },
    fogColor: 0x3a1410, fogDensity: 0.009,
    ambient: [0xff9a7a, 0.55], hemi: [0xff7a5a, 0x2a0e0a, 0.7],
    sun: { color: 0xff9a6a, intensity: 1.2, pos: [40, 45, -80] },
    wallHeight: 2, gridOpacity: 0.24, cornerLight: [0xef4444, 2.0],
    floorTint: 0xb89a90, env: 'sky', envIntensity: 0.95,
  },
  chapel: {
    sky: {
      top: 0x0a0420, horizon: 0x7a3a90, bottom: 0x1a0a30, exponent: 0.5, stars: 0.03,
      nebula: { a: 0xc026d3, b: 0x6d28d9, strength: 0.45 }, horizonGlow: { color: 0xe879f9, strength: 0.4 },
    },
    fogColor: 0x24103c, fogDensity: 0.008,
    ambient: [0xe0c8ff, 0.6], hemi: [0xc4a0ff, 0x1c0e30, 0.7],
    sun: { color: 0xf0d8ff, intensity: 0.9, pos: [0, 50, -30] },
    wallHeight: 2.6, gridOpacity: 0.28, cornerLight: [0xc084fc, 1.9],
    floorTint: 0xb8a8d0, env: 'sky', envIntensity: 0.95,
  },
  gate: {
    sky: { top: 0x0c0a18, horizon: 0x3a3450, bottom: 0x0a0812, exponent: 0.5, stars: 0.01, clouds: { color: 0x4a4260, coverage: 0.5, speed: 0.002, opacity: 0.6 }, horizonGlow: { color: 0xa78bfa, strength: 0.25 } },
    fogColor: 0x241f38, fogDensity: 0.011,
    ambient: [0xc0b8e8, 0.5], hemi: [0x9a90d8, 0x14101e, 0.6],
    sun: { color: 0xe0d8ff, intensity: 0.7, pos: [0, 40, -50] },
    wallHeight: 2.4, gridOpacity: 0.26, cornerLight: [0x8b5cf6, 1.8],
    floorTint: 0xa8a0c0, env: 'sky', envIntensity: 0.85,
  },
  citadel: {
    sky: {
      top: 0x120838, horizon: 0xf0a850, bottom: 0x1a0e30, exponent: 0.45, stars: 0.014,
      sun: { dir: [0.0, 0.3, -0.95], color: 0xfff0c0, size: 0.01, glow: 1.0 },
      nebula: { a: 0x7c3aed, b: 0xf59e0b, strength: 0.3 }, horizonGlow: { color: 0xfcd34d, strength: 0.5 },
    },
    fogColor: 0x2a1a48, fogDensity: 0.0075,
    ambient: [0xf0e0ff, 0.65], hemi: [0xd8c0ff, 0x2a1a3a, 0.8],
    sun: { color: 0xffe6b0, intensity: 1.3, pos: [0, 30, -90] },
    wallHeight: 2.4, gridOpacity: 0.3, cornerLight: [0xa78bfa, 2.2],
    floorTint: 0xc4b4dc, env: 'sky', envIntensity: 1.0,
  },
};

const TAU = Math.PI * 2;

// ───────────────────────────── shared helpers ─────────────────────────────

/** Horizontal wind-blown streaks that follow the camera. */
function windStreaks(ctx: Ctx, n: number, color: number, opacity: number, speed: number, ymax: number) {
  const { root, rnd } = ctx;
  const wp = new Float32Array(n * 6);
  const reset = (i: number, spread: boolean) => {
    const x = (spread ? -90 + rnd() * 180 : -90 - rnd() * 20), y = 0.5 + rnd() * ymax, z = (rnd() * 2 - 1) * 90, l = 3 + rnd() * 8;
    wp.set([x, y, z, x + l, y, z], i * 6);
  };
  for (let i = 0; i < n; i++) reset(i, true);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(wp, 3));
  const lines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false }));
  lines.frustumCulled = false; root.add(lines);
  ctx.on((dt) => {
    for (let i = 0; i < n; i++) {
      const k = i * 6, sp = speed * (0.7 + (i % 7) * 0.12);
      wp[k] += sp * dt; wp[k + 3] += sp * dt;
      if (wp[k] > 95) reset(i, false);
    }
    g.attributes.position.needsUpdate = true;
  });
}

/** Faceted glass crystal (elongated octahedron / hexagonal prism with a pointed tip). */
function crystalGeo(r: number, h: number) {
  const g = new THREE.CylinderGeometry(0, r, h * 0.35, 6, 1).translate(0, h * 0.825, 0);
  const body = new THREE.CylinderGeometry(r, r * 1.05, h * 0.65, 6, 1).translate(0, h * 0.325, 0);
  const merged = new THREE.BufferGeometry();
  const a = g.toNonIndexed(), b = body.toNonIndexed();
  const pos = new Float32Array(a.attributes.position.array.length + b.attributes.position.array.length);
  pos.set(a.attributes.position.array as Float32Array, 0);
  pos.set(b.attributes.position.array as Float32Array, a.attributes.position.array.length);
  merged.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  merged.computeVertexNormals();
  return merged;
}

function crystalCluster(parent: THREE.Object3D, rnd: () => number, x: number, z: number, scale: number, color: number, emissive = 0.35) {
  const mat = new THREE.MeshPhysicalMaterial({ color, transparent: true, opacity: 0.72, roughness: 0.08, metalness: 0.15, clearcoat: 1, emissive: color, emissiveIntensity: emissive, flatShading: true });
  const g = new THREE.Group(); g.position.set(x, 0, z); parent.add(g);
  const n = 3 + Math.floor(rnd() * 4);
  for (let i = 0; i < n; i++) {
    const h = (6 + rnd() * 12) * scale;
    const m = new THREE.Mesh(crystalGeo((0.9 + rnd() * 1.4) * scale, h), mat);
    m.position.set((rnd() - 0.5) * 6 * scale, -0.5, (rnd() - 0.5) * 6 * scale);
    m.rotation.set((rnd() - 0.5) * 0.7, rnd() * TAU, (rnd() - 0.5) * 0.7);
    g.add(m);
  }
  return g;
}

function gearGeometry(rOut: number, rIn: number, teeth: number, depth: number, hole = 0.3) {
  const s = new THREE.Shape();
  const step = TAU / teeth;
  s.moveTo(rIn, 0);
  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    s.lineTo(Math.cos(a) * rIn, Math.sin(a) * rIn);
    s.lineTo(Math.cos(a + step * 0.12) * rOut, Math.sin(a + step * 0.12) * rOut);
    s.lineTo(Math.cos(a + step * 0.38) * rOut, Math.sin(a + step * 0.38) * rOut);
    s.lineTo(Math.cos(a + step * 0.5) * rIn, Math.sin(a + step * 0.5) * rIn);
  }
  s.closePath();
  const h = new THREE.Path(); h.absarc(0, 0, rIn * hole, 0, TAU, true); s.holes.push(h);
  return new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false });
}

// ───────────────────────────── SEC-29 硝子砂丘 ─────────────────────────────
// Rolling dunes of fused glass, giant crystal outcrops, a fallen machine rib and a low sun.
function buildDunes(ctx: Ctx) {
  const { root, rnd } = ctx;
  const sand = std(0xc9a58a, 0.1, 0.85, { emissive: 0x3a1c18, emissiveIntensity: 0.25 });
  const glassSand = new THREE.MeshPhysicalMaterial({ color: 0xe8b8c8, roughness: 0.2, metalness: 0.1, clearcoat: 0.8, emissive: 0x4a2030, emissiveIntensity: 0.25 });
  const bone = std(0x6a5a52, 0.6, 0.6);
  mesh(root, new THREE.PlaneGeometry(600, 600), sand, 0, -0.3, 0, -Math.PI / 2);
  for (let i = 0; i < 40; i++) {
    const a = rnd() * TAU, r = 80 + rnd() * 100, w = 16 + rnd() * 26, h = 3 + rnd() * 10;
    const d = mesh(root, new THREE.SphereGeometry(1, 16, 8), i % 3 ? sand : glassSand, Math.cos(a) * r, -1, Math.sin(a) * r);
    d.scale.set(w, h, w * (0.6 + rnd() * 0.5));
    d.rotation.y = rnd() * TAU;
  }
  const cols = [0xf0abfc, 0xfbbf24, 0x7dd3fc, 0xfda4af];
  for (let i = 0; i < 18; i++) {
    const a = rnd() * TAU, r = 46 + rnd() * 70;
    crystalCluster(root, rnd, Math.cos(a) * r, Math.sin(a) * r, 1 + rnd() * 1.6, cols[i % cols.length]);
  }
  // A colossal fallen rib arching out of the sand.
  const ribs: THREE.Mesh[] = [];
  for (let i = 0; i < 5; i++) {
    const r = mesh(root, new THREE.TorusGeometry(34 - i * 2, 2.6, 8, 30, Math.PI * 0.8), bone, 70, 0, -46 + i * 16);
    r.rotation.set(0, 0.2, 0.3);
    ribs.push(r);
  }
  box(root, 4, 4, 90, bone, 44, 1, -6);
  // Distant monolithic ruins and a sun glint.
  for (let i = 0; i < 6; i++) { const a = -2.6 + i * 0.2; box(root, 3 + rnd() * 3, 20 + rnd() * 30, 3, std(0x4a3a50, 0.3, 0.8), Math.cos(a) * 150, 14, Math.sin(a) * 150, 0, 0, rnd() * 0.2); }
  glowSprite(root, 0xffd9a8, 90, 0.35, -86, 22, -122);
  const heat = mesh(root, new THREE.PlaneGeometry(500, 12), additive(0xffb890, 0.05, { fog: false }), 0, 5, -130);
  windStreaks(ctx, 220, 0xffe0c8, 0.22, 34, 8);
  particles(ctx, { count: 360, size: 0.16, color: 0xffd0a8, opacity: 0.45, half: [60, 60], y: [0.3, 14], mode: 'drift', speed: 1.1, sway: 1.2 });
  ctx.on((_dt, t) => { heat.position.y = 5 + Math.sin(t * 0.7) * 0.6; });
  void ribs;
}

// ───────────────────────────── SEC-30 機神墓場 ─────────────────────────────
// Titan wrecks: collapsed mech, half-buried head with a failing eye, rusted ribs, scrap cranes and sparks.
function buildGraveyard(ctx: Ctx) {
  const { root, rnd } = ctx;
  const rust = std(0x8a5a3a, 0.7, 0.6);
  const rustDark = std(0x4a3022, 0.6, 0.7);
  const steel = std(0x7a7a80, 0.8, 0.45);
  const scrapFloor = std(0x3a2c24, 0.3, 0.95);
  mesh(root, new THREE.PlaneGeometry(600, 600), scrapFloor, 0, -0.3, 0, -Math.PI / 2);
  // Scrap mounds.
  for (let i = 0; i < 34; i++) {
    const a = rnd() * TAU, r = 52 + rnd() * 90, s = 4 + rnd() * 9;
    const m = mesh(root, new THREE.DodecahedronGeometry(s, 0), i % 2 ? rustDark : rust, Math.cos(a) * r, s * 0.25, Math.sin(a) * r);
    m.scale.y = 0.5; m.rotation.set(rnd(), rnd(), rnd());
    for (let k = 0; k < 4; k++) box(root, 1 + rnd() * 2, 6 + rnd() * 10, 1 + rnd() * 2, steel, Math.cos(a) * r + (rnd() - 0.5) * s, s * 0.5, Math.sin(a) * r + (rnd() - 0.5) * s, rnd(), rnd(), rnd());
  }
  // A fallen titan, half-buried and leaning (reused giant mech silhouette).
  const wreck = buildMech(rust, std(0x5a3a28, 0.7, 0.6), rustDark, basic(0xff3a1a, { toneMapped: false }));
  wreck.scale.setScalar(1.7); wreck.position.set(-86, -4, -70); wreck.rotation.set(0.25, 0.5, -0.55);
  root.add(wreck);
  const wreck2 = buildMech(rust, std(0x5a3a28, 0.7, 0.6), rustDark, basic(0xff3a1a, { toneMapped: false }));
  wreck2.scale.setScalar(1.3); wreck2.position.set(92, -6, 40); wreck2.rotation.set(-0.35, -1.9, 0.5);
  root.add(wreck2);
  // Half-buried colossal head with a flickering eye.
  const head = new THREE.Group(); head.position.set(10, 0, -96); head.rotation.set(0.2, 0.1, 0.1); root.add(head);
  box(head, 30, 22, 26, rust, 0, 8, 0);
  box(head, 32, 3, 28, rustDark, 0, 20, 0);
  for (const s of [-1, 1]) box(head, 5, 14, 6, steel, s * 12, 6, -14);
  for (let i = 0; i < 7; i++) box(head, 2.2, 5, 0.8, rustDark, -9 + i * 3, 0, -13.3);
  box(head, 30, 3, 6, steel, 0, 16.5, -12);
  const eye = glowSprite(head, 0xff3a1a, 12, 0.9, 0, 12, -13.5);
  const eyeCore = box(head, 14, 2.2, 0.6, basic(0xff3a1a, { toneMapped: false }), 0, 12, -13.2);
  // Magnet cranes swinging scrap.
  const cranes: THREE.Group[] = [];
  for (const [x, z] of [[-60, 60], [66, 70], [0, 100]]) {
    box(root, 2.4, 50, 2.4, steel, x, 25, z);
    box(root, 2, 2, 34, steel, x, 50, z + 14);
    const g = new THREE.Group(); g.position.set(x, 49, z + 28); root.add(g); cranes.push(g);
    box(g, 0.2, 22, 0.2, steel, 0, -11, 0);
    mesh(g, new THREE.CylinderGeometry(3.2, 3.6, 1.4, 14), std(0x303038, 0.8, 0.4), 0, -22, 0);
    for (let k = 0; k < 5; k++) box(g, 1.6, 1.2, 1.6, rustDark, (rnd() - 0.5) * 3, -23.5 - rnd(), (rnd() - 0.5) * 3, rnd(), rnd(), rnd());
  }
  // Sparks and dust haze.
  particles(ctx, { count: 220, size: 0.3, color: 0xffa050, opacity: 0.7, half: [60, 60], y: [0.5, 26], mode: 'rise', speed: 2.2, sway: 1.0 });
  particles(ctx, { count: 160, size: 6, color: 0xb8805a, opacity: 0.05, half: [60, 60], y: [0, 6], mode: 'drift', speed: 0.5, sway: 0.8 });
  windStreaks(ctx, 90, 0xd8a070, 0.16, 22, 10);
  const arc = makeArc(root, 0xffb060, 0.1);
  let arcT = 0;
  ctx.on((dt, t) => {
    cranes.forEach((c, i) => { c.rotation.z = Math.sin(t * 0.5 + i * 2) * 0.1; c.rotation.x = Math.cos(t * 0.4 + i) * 0.08; });
    const flick = Math.sin(t * 17) * Math.sin(t * 5.3) > 0.2 ? 0.2 : 0.9;
    (eye.material as THREE.SpriteMaterial).opacity = flick;
    (eyeCore.material as THREE.MeshBasicMaterial).color.setHex(flick > 0.5 ? 0xff3a1a : 0x401008);
    arcT -= dt;
    if (arcT < 0) {
      arcT = 0.12 + Math.random() * 0.4;
      const on = Math.random() > 0.45;
      arc.visible(on);
      if (on) { const a = new THREE.Vector3(-86 + Math.random() * 30, 8 + Math.random() * 20, -70); arc.set(a, a.clone().add(new THREE.Vector3(Math.random() * 10 - 5, -8, Math.random() * 10 - 5)), 3); }
    }
  });
}

// ───────────────────────────── SEC-31 歯車時計塔 ─────────────────────────────
// Brass gear hall: meshing gear walls, a great pendulum, a clock face and drifting gold dust.
function buildClockwork(ctx: Ctx) {
  const { root } = ctx;
  const R = 56, H = 54;
  const brass = std(0xb8862a, 0.9, 0.3, { emissive: 0x3a2204, emissiveIntensity: 0.3 });
  const brassDark = std(0x6a4a14, 0.85, 0.4);
  const iron = std(0x2a2620, 0.8, 0.5);
  const gold = basic(0xfcd34d, { toneMapped: false });
  const stone = std(0x3a3026, 0.2, 0.9);
  // Hall shell.
  mesh(root, new THREE.CylinderGeometry(R + 10, R + 10, 120, 40, 1, true), std(0x241c12, 0.4, 0.8, { side: THREE.BackSide }), 0, 55, 0);
  mesh(root, new THREE.PlaneGeometry(260, 260), stone, 0, 62, 0, Math.PI / 2);
  mesh(root, new THREE.PlaneGeometry(260, 260), std(0x1c160e, 0.3, 0.9), 0, -0.3, 0, -Math.PI / 2);
  // Gear walls: rings of gears at different radii and speeds.
  const gears: { g: THREE.Mesh; sp: number }[] = [];
  for (let k = 0; k < 4; k++) {
    const g = new THREE.Group(); g.rotation.y = (k * Math.PI) / 2; root.add(g);
    const Z = -(R + 3);
    const sizes = [[-30, 24, 16, 20], [-6, 40, 22, 28], [20, 22, 12, 16], [40, 34, 16, 24], [-44, 44, 10, 14]];
    sizes.forEach(([x, y, r, teeth], i) => {
      const dir = (i + k) % 2 ? 1 : -1;
      const m = mesh(g, gearGeometry(r, r * 0.88, teeth, 2.4, 0.22), i % 2 ? brass : brassDark, x, y, Z);
      mesh(m, new THREE.TorusGeometry(r * 0.55, 0.35, 6, 32), gold, 0, 0, 1.3);
      for (let q = 0; q < 6; q++) { const a = (q / 6) * TAU; box(m, 0.8, r * 0.6, 0.8, iron, Math.cos(a) * r * 0.3, Math.sin(a) * r * 0.3, 1.2, 0, 0, a - Math.PI / 2); }
      gears.push({ g: m, sp: (0.35 / (r / 12)) * dir });
    });
    for (let x = -50; x <= 50; x += 25) box(g, 2.6, H, 2.6, iron, x, H / 2, Z + 1);
  }
  // Clock face on the north wall.
  const face = canvasTex(512, 512, (c) => {
    c.fillStyle = '#1a1208'; c.beginPath(); c.arc(256, 256, 250, 0, TAU); c.fill();
    c.strokeStyle = '#fcd34d'; c.lineWidth = 10; c.shadowColor = '#fcd34d'; c.shadowBlur = 20; c.beginPath(); c.arc(256, 256, 236, 0, TAU); c.stroke();
    c.fillStyle = '#fde68a'; c.font = 'bold 54px serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'].forEach((n, i) => { const a = (i / 12) * TAU - Math.PI / 2; c.fillText(n, 256 + Math.cos(a) * 190, 256 + Math.sin(a) * 190); });
  });
  mesh(root, new THREE.CircleGeometry(24, 48), basic(0xffffff, { map: face, toneMapped: false }), 0, 36, -R + 2.2);
  const hands = new THREE.Group(); hands.position.set(0, 36, -R + 2.6); root.add(hands);
  box(hands, 1.2, 11, 0.4, gold, 0, 5, 0);
  box(hands, 0.8, 17, 0.4, gold, 0, 8, 0.4);
  hands.children[1].rotation.z = 0;
  mesh(hands, new THREE.SphereGeometry(1.4, 10, 8), gold, 0, 0, 0.8);
  // Great pendulum swinging in front of the clock.
  const pend = new THREE.Group(); pend.position.set(0, H + 8, -30); root.add(pend);
  box(pend, 0.8, 52, 0.8, brassDark, 0, -26, 0);
  mesh(pend, new THREE.CylinderGeometry(7, 7, 1.6, 28), brass, 0, -52, 0, Math.PI / 2);
  mesh(pend, new THREE.TorusGeometry(7.4, 0.5, 8, 36), gold, 0, -52, 0.9);
  glowSprite(pend, 0xfcd34d, 26, 0.35, 0, -52, 0.9);
  // Hanging chains and a golden shaft of light.
  for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU, r = 48 + (i % 2) * 6; box(root, 0.3, 40, 0.3, iron, Math.cos(a) * r, 40, Math.sin(a) * r); }
  beam(root, new THREE.Vector3(0, 118, 0), new THREE.Vector3(0, 0, 0), 4, 28, 0xffe6a0, 0.07);
  particles(ctx, { count: 260, size: 0.22, color: 0xfde68a, opacity: 0.7, half: [50, 50], y: [0.5, 40], mode: 'drift', speed: 0.6, sway: 0.5 });
  ctx.on((dt, t) => {
    gears.forEach((q) => { q.g.rotation.z += q.sp * dt; });
    pend.rotation.z = Math.sin(t * 1.1) * 0.5;
    hands.rotation.z = -t * 0.05;
    ctx.hemi.intensity = 0.8 + Math.sin(t * 1.1 * 2) * 0.03;
  });
}

// ───────────────────────────── SEC-32 流星クレーター ─────────────────────────────
// Red sky, meteors streaking down, glowing fissures along the crater rim and rising smoke.
function buildCrater(ctx: Ctx) {
  const { root, rnd } = ctx;
  const rock = std(0x3a2420, 0.3, 0.95, { emissive: 0x3a0e08, emissiveIntensity: 0.3 });
  const ash = std(0x2a1a16, 0.2, 0.95);
  mesh(root, new THREE.PlaneGeometry(600, 600), ash, 0, -0.3, 0, -Math.PI / 2);
  // Crater rim: a ring of jagged boulders and slopes.
  for (let i = 0; i < 46; i++) {
    const a = (i / 46) * TAU + rnd() * 0.1, r = 62 + rnd() * 18, h = 8 + rnd() * 22;
    const m = mesh(root, new THREE.ConeGeometry(6 + rnd() * 8, h, 5), rock, Math.cos(a) * r, h / 2 - 1, Math.sin(a) * r);
    m.rotation.y = rnd() * TAU;
    if (i % 3 === 0) glowSprite(root, 0xff5a2a, 8, 0.6, Math.cos(a) * (r - 6), 2 + rnd() * 4, Math.sin(a) * (r - 6));
  }
  // Molten fissures radiating from the arena.
  const fissureMat = basic(0xff6a2a, { toneMapped: false });
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU + 0.2, len = 40 + rnd() * 30;
    const g = new THREE.Group(); g.position.set(Math.cos(a) * (41 + len / 2), 0.05, Math.sin(a) * (41 + len / 2)); g.rotation.y = Math.PI / 2 - a; root.add(g);
    mesh(g, new THREE.PlaneGeometry(1.4 + rnd() * 1.4, len), fissureMat, 0, 0, 0, -Math.PI / 2, 0, 0);
  }
  // The planet-sized ember in the sky.
  const moon = mesh(root, new THREE.SphereGeometry(30, 28, 20), basic(0x6a2418, { fog: false }), -60, 70, -190);
  glowSprite(root, 0xff7a4a, 140, 0.35, -60, 70, -190);
  void moon;
  // Meteors: streak + head, repeating across the sky with impact flashes.
  const meteors: { g: THREE.Group; v: THREE.Vector3; life: number; flash: THREE.Sprite; hit: THREE.Vector3 }[] = [];
  for (let i = 0; i < 6; i++) {
    const g = new THREE.Group(); root.add(g);
    mesh(g, new THREE.SphereGeometry(1.4, 8, 6), basic(0xffd0a0, { fog: false, toneMapped: false }));
    const tail = mesh(g, new THREE.CylinderGeometry(0.05, 1.3, 30, 8, 1, true), additive(0xff8a50, 0.7, { fog: false }), 0, 15, 0);
    tail.position.set(0, 15, 0);
    glowSprite(g, 0xffa060, 9, 0.8, 0, 0, 0);
    const flash = glowSprite(root, 0xffb080, 1, 0, 0, 3, 0);
    meteors.push({ g, v: new THREE.Vector3(), life: -rnd() * 8, flash, hit: new THREE.Vector3() });
  }
  const spawn = (m: typeof meteors[number]) => {
    const a = rnd() * TAU, r = 90 + rnd() * 80;
    const hit = new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r);
    const start = hit.clone().add(new THREE.Vector3(60 + rnd() * 50, 130 + rnd() * 40, 30 - rnd() * 60));
    m.g.position.copy(start);
    m.v.copy(hit).sub(start).divideScalar(2.8 + rnd() * 1.4);
    // orient the tail along -velocity
    m.g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), m.v.clone().negate().normalize());
    m.hit.copy(hit);
    m.life = 1;
  };
  // Smoke columns and falling embers.
  particles(ctx, { count: 300, size: 0.28, color: 0xff7a40, opacity: 0.7, half: [70, 70], y: [0.5, 40], mode: 'rise', speed: 2.4, sway: 1.4 });
  particles(ctx, { count: 120, size: 9, color: 0x2a1410, opacity: 0.12, half: [80, 80], y: [4, 36], mode: 'drift', speed: 0.5, sway: 1.0 });
  ctx.on((dt, t) => {
    meteors.forEach((m, i) => {
      const fl = m.flash.material as THREE.SpriteMaterial;
      if (m.life <= 0) {
        m.life += dt;
        m.g.visible = false;
        fl.opacity = Math.max(0, fl.opacity - dt * 1.5);
        if (m.life > 0) { m.life = 0; spawn(m); }
        return;
      }
      m.g.visible = true;
      m.g.position.addScaledVector(m.v, dt);
      if (m.g.position.y <= 2) {
        m.g.visible = false; m.life = -(2 + Math.random() * 6);
        m.flash.position.copy(m.hit).setY(4);
        m.flash.scale.setScalar(26); fl.opacity = 0.9;
      }
      void i;
    });
    ctx.hemi.intensity = 0.7 + Math.sin(t * 0.7) * 0.04;
  });
}

// ───────────────────────────── SEC-33 逆さの礼拝堂 ─────────────────────────────
// A cathedral hanging upside-down in the sky, drifting candles and glass petals.
function buildChapel(ctx: Ctx) {
  const { root, rnd } = ctx;
  const stone = std(0x6a5a8a, 0.3, 0.7, { emissive: 0x241048, emissiveIntensity: 0.35 });
  const trim = std(0xcaa84a, 0.8, 0.35);
  const gold = basic(0xfde68a, { toneMapped: false });
  const violet = basic(0xc084fc, { toneMapped: false });
  mesh(root, new THREE.PlaneGeometry(600, 600), std(0x2a1c46, 0.5, 0.6), 0, -0.3, 0, -Math.PI / 2);
  // The upside-down nave, hanging from the sky.
  const nave = new THREE.Group(); nave.position.set(0, 88, -26); nave.scale.y = -1; root.add(nave);
  for (const s of [-1, 1]) for (let z = -60; z <= 60; z += 20) gothicTower(nave, stone, 7, 38 + ((z + 60) % 3) * 6, 18, s * 38, z, trim);
  for (let z = -60; z <= 60; z += 20) box(nave, 76, 4, 4, stone, 0, 26, z);
  box(nave, 80, 6, 150, stone, 0, 0, 0);
  box(nave, 30, 60, 8, stone, 0, 30, -72);
  gothicTower(nave, stone, 9, 70, 30, 0, -72, trim);
  // Inverted rose window glowing in the sky.
  const rose = new THREE.Group(); rose.position.set(0, 52, -104); root.add(rose);
  const rings: THREE.Mesh[] = [];
  [14, 9, 4.5].forEach((r, i) => {
    const m = mesh(rose, new THREE.TorusGeometry(r, 0.7, 8, 40), i % 2 ? gold : violet);
    rings.push(m);
    for (let k = 0; k < 8 + i * 4; k++) { const a = (k / (8 + i * 4)) * TAU; box(m, 0.4, r * 0.6, 0.4, trim, Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5, 0, 0, 0, a - Math.PI / 2); }
  });
  mesh(rose, new THREE.CircleGeometry(14, 40), additive(0xc084fc, 0.22, { side: THREE.DoubleSide }), 0, 0, -0.2);
  glowSprite(rose, 0xe879f9, 80, 0.3, 0, 0, 0);
  // Floating stained-glass petals.
  const petals: THREE.Mesh[] = [];
  for (let i = 0; i < 44; i++) {
    const a = rnd() * TAU, r = 48 + rnd() * 70;
    const p = mesh(root, new THREE.PlaneGeometry(2 + rnd() * 3, 3 + rnd() * 5), additive([0xc084fc, 0xfde68a, 0x7dd3fc, 0xfda4af][i % 4], 0.5, { side: THREE.DoubleSide }), Math.cos(a) * r, 8 + rnd() * 50, Math.sin(a) * r);
    p.rotation.set(rnd() * TAU, rnd() * TAU, 0);
    petals.push(p);
  }
  // Candles hanging from invisible threads.
  const flames: THREE.Sprite[] = [];
  for (let i = 0; i < 50; i++) {
    const a = rnd() * TAU, r = 46 + rnd() * 60, y = 3 + rnd() * 30;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    box(root, 0.5, 2, 0.5, std(0xfef3c7, 0.1, 0.7), x, y, z);
    flames.push(glowSprite(root, 0xffd27a, 2.2, 0.95, x, y + 1.4, z));
    glowSprite(root, 0xffb347, 7, 0.14, x, y + 1.4, z);
  }
  beam(root, new THREE.Vector3(-30, 110, -40), new THREE.Vector3(-14, 0, -10), 2, 14, 0xe9d5ff, 0.08);
  beam(root, new THREE.Vector3(34, 110, -30), new THREE.Vector3(18, 0, -4), 2, 12, 0xfde68a, 0.07);
  particles(ctx, { count: 260, size: 0.25, color: 0xe9d5ff, opacity: 0.65, half: [60, 60], y: [0.5, 50], mode: 'rise', speed: 0.8, sway: 0.6 });
  ctx.on((_dt, t) => {
    rings.forEach((r, i) => { r.rotation.z = t * (0.1 + i * 0.07) * (i % 2 ? -1 : 1); });
    petals.forEach((p, i) => { p.rotation.x += 0.004 + (i % 5) * 0.001; p.rotation.y += 0.003; p.position.y += Math.sin(t + i) * 0.004; });
    flames.forEach((f, i) => { (f.material as THREE.SpriteMaterial).opacity = 0.75 + Math.sin(t * 9 + i * 3) * 0.2; });
    nave.position.y = 88 + Math.sin(t * 0.15) * 1.2;
  });
}

// ───────────────────────────── SEC-34 沈黙の門 ─────────────────────────────
// A colossal gate whose seam of light slowly breathes; silent obelisks, drifting ash and a pale ring above.
function buildGate(ctx: Ctx) {
  const { root, rnd } = ctx;
  const stone = std(0x4a4660, 0.3, 0.8, { emissive: 0x1c1838, emissiveIntensity: 0.3 });
  const stoneDark = std(0x2a2840, 0.3, 0.85);
  const rune = basic(0xa78bfa, { toneMapped: false });
  mesh(root, new THREE.PlaneGeometry(600, 600), std(0x1e1c2e, 0.3, 0.9), 0, -0.3, 0, -Math.PI / 2);
  // The gate: twin towers, a lintel and two enormous doors with a luminous seam.
  const gate = new THREE.Group(); gate.position.set(0, 0, -98); root.add(gate);
  for (const s of [-1, 1]) {
    box(gate, 22, 90, 22, stone, s * 36, 45, 0);
    box(gate, 26, 4, 26, stoneDark, s * 36, 92, 0);
    box(gate, 4, 70, 3, rune, s * 25, 40, 11.6);
    for (let y = 10; y < 80; y += 12) box(gate, 14, 1, 1, rune, s * 36, y, 11.6);
  }
  box(gate, 94, 14, 24, stone, 0, 84, 0);
  box(gate, 98, 3, 28, stoneDark, 0, 92, 0);
  const doorL = box(gate, 25, 76, 6, stoneDark, -12.6, 38, 0);
  const doorR = box(gate, 25, 76, 6, stoneDark, 12.6, 38, 0);
  for (const d of [doorL, doorR]) for (let y = 10; y < 70; y += 14) box(d, 22, 0.8, 0.8, rune, 0, y - 38, 3.2);
  const seam = box(gate, 1.2, 76, 2, basic(0xf5f3ff, { toneMapped: false }), 0, 38, 0.5);
  const seamGlow = glowSprite(gate, 0xe0d8ff, 70, 0.4, 0, 38, 4);
  beam(gate, new THREE.Vector3(0, 78, 6), new THREE.Vector3(0, 0, 70), 1, 18, 0xe0d8ff, 0.06);
  // Silent obelisk avenue.
  const pulses: THREE.Mesh[] = [];
  for (const s of [-1, 1]) for (let z = -70; z <= 70; z += 20) {
    if (Math.abs(s * 50) < 0) continue;
    const h = 20 + ((z + 70) % 3) * 4;
    mesh(root, new THREE.CylinderGeometry(1.4, 2.8, h, 4), stone, s * 56, h / 2, z).rotation.y = Math.PI / 4;
    const r = box(root, 0.3, h * 0.7, 0.3, rune, s * 56, h / 2, z + 2.2);
    pulses.push(r);
  }
  // The pale ring overhead.
  const ring = new THREE.Group(); ring.position.set(0, 120, -170); ring.rotation.x = 0.35; root.add(ring);
  mesh(ring, new THREE.TorusGeometry(60, 0.8, 8, 96), basic(0xddd6fe, { fog: false, toneMapped: false }));
  mesh(ring, new THREE.TorusGeometry(60, 5, 8, 96), additive(0xa78bfa, 0.1, { fog: false }));
  // Low drifting mist plane.
  const mist = particles(ctx, { count: 220, size: 14, color: 0xa8a0d8, opacity: 0.06, half: [70, 70], y: [0.5, 6], mode: 'drift', speed: 0.2, sway: 0.5 });
  particles(ctx, { count: 200, size: 0.3, color: 0xe0d8ff, opacity: 0.4, half: [60, 60], y: [0.5, 40], mode: 'fall', speed: 0.5, sway: 0.2 });
  void mist; void rnd;
  ctx.on((_dt, t) => {
    const open = 0.5 + 0.5 * Math.sin(t * 0.25);
    doorL.position.x = -12.6 - open * 1.4; doorR.position.x = 12.6 + open * 1.4;
    seam.scale.x = 1 + open * 5;
    (seamGlow.material as THREE.SpriteMaterial).opacity = 0.3 + open * 0.3;
    pulses.forEach((p, i) => { (p.material as THREE.MeshBasicMaterial).color.setHex(Math.sin(t * 0.7 + i * 0.8) > 0 ? 0xa78bfa : 0x4c3d8a); });
    ring.rotation.z = t * 0.02;
  });
}

// ───────────────────────────── SEC-35 硝子の城砦 ─────────────────────────────
// A citadel of faceted glass, a great sun-disc rotating behind it, orbiting glass blades.
function buildCitadel(ctx: Ctx) {
  const { root, rnd } = ctx;
  const glass = (c: number, o = 0.65) => new THREE.MeshPhysicalMaterial({ color: c, transparent: true, opacity: o, roughness: 0.06, metalness: 0.2, clearcoat: 1, emissive: c, emissiveIntensity: 0.28, flatShading: true });
  const goldM = std(0xd4a017, 0.9, 0.25, { emissive: 0x4a3004, emissiveIntensity: 0.4 });
  const gold = basic(0xfde68a, { toneMapped: false });
  const violet = basic(0xa78bfa, { toneMapped: false });
  mesh(root, new THREE.PlaneGeometry(600, 600), new THREE.MeshPhysicalMaterial({ color: 0x2a1a48, roughness: 0.1, metalness: 0.5, clearcoat: 1 }), 0, -0.3, 0, -Math.PI / 2);
  // Citadel spires ring.
  const palette = [0xa78bfa, 0xfde68a, 0xc4b5fd, 0xf0abfc];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU + 0.1, r = 66 + (i % 2) * 14;
    const h = 40 + rnd() * 50;
    const m = new THREE.Mesh(crystalGeo(3.2 + rnd() * 3, h), glass(palette[i % palette.length]));
    m.position.set(Math.cos(a) * r, -1, Math.sin(a) * r);
    m.rotation.y = rnd() * TAU;
    root.add(m);
    box(root, 7, 1.4, 7, goldM, Math.cos(a) * r, 0.4, Math.sin(a) * r);
  }
  // Central glass keep behind the north wall.
  const keep = new THREE.Group(); keep.position.set(0, 0, -108); root.add(keep);
  keep.add(new THREE.Mesh(crystalGeo(14, 96), glass(0xc4b5fd, 0.55)));
  for (const s of [-1, 1]) { const m = new THREE.Mesh(crystalGeo(7, 62), glass(0xfde68a, 0.55)); m.position.set(s * 26, 0, 6); keep.add(m); }
  box(keep, 70, 3, 24, goldM, 0, 1, 4);
  for (let x = -30; x <= 30; x += 10) box(keep, 1.2, 14, 1.2, goldM, x, 8, 14);
  // The sun-disc.
  const disc = new THREE.Group(); disc.position.set(0, 66, -150); root.add(disc);
  const dA = mesh(disc, new THREE.TorusGeometry(46, 1.4, 10, 80), gold);
  const dB = mesh(disc, new THREE.TorusGeometry(36, 0.8, 8, 72), violet);
  mesh(disc, new THREE.TorusGeometry(46, 6, 8, 64), additive(0xfde68a, 0.1, { fog: false }));
  for (let k = 0; k < 24; k++) { const a = (k / 24) * TAU; mesh(dA, new THREE.ConeGeometry(1.2, k % 2 ? 9 : 16, 4), gold, Math.cos(a) * 54, Math.sin(a) * 54, 0, 0, 0, a - Math.PI / 2); }
  glowSprite(disc, 0xfde68a, 150, 0.3, 0, 0, -2);
  // Orbiting glass blades.
  const blades: { g: THREE.Group; r: number; y: number; a0: number; sp: number }[] = [];
  for (let i = 0; i < 12; i++) {
    const g = new THREE.Group(); root.add(g);
    mesh(g, new THREE.ConeGeometry(0.6, 8, 4), glass(i % 2 ? 0xfde68a : 0xa78bfa, 0.7), 0, 0, 0, Math.PI, 0, 0);
    blades.push({ g, r: 58 + (i % 3) * 8, y: 14 + (i % 4) * 9, a0: (i / 12) * TAU, sp: 0.06 + (i % 3) * 0.015 });
  }
  beam(root, new THREE.Vector3(0, 130, -90), new THREE.Vector3(0, 0, -30), 3, 26, 0xfff2c8, 0.08);
  beam(root, new THREE.Vector3(-40, 120, -60), new THREE.Vector3(-26, 0, -20), 2, 14, 0xe9d5ff, 0.06);
  beam(root, new THREE.Vector3(44, 120, -60), new THREE.Vector3(30, 0, -20), 2, 14, 0xe9d5ff, 0.06);
  particles(ctx, { count: 300, size: 0.25, color: 0xfde68a, opacity: 0.7, half: [60, 60], y: [0.5, 60], mode: 'rise', speed: 0.9, sway: 0.5 });
  ctx.on((_dt, t) => {
    dA.rotation.z = t * 0.08; dB.rotation.z = -t * 0.14;
    blades.forEach((b, i) => {
      const a = b.a0 + t * b.sp;
      b.g.position.set(Math.cos(a) * b.r, b.y + Math.sin(t * 0.8 + i) * 1.2, Math.sin(a) * b.r);
      b.g.rotation.set(0.2, -a, Math.sin(t + i) * 0.2);
    });
    ctx.hemi.intensity = 0.8 + Math.sin(t * 0.5) * 0.05;
  });
}

export const RELIC_BUILDERS: Record<RelicId, (ctx: Ctx) => void> = {
  dunes: buildDunes, graveyard: buildGraveyard, clockwork: buildClockwork, crater: buildCrater,
  chapel: buildChapel, gate: buildGate, citadel: buildCitadel,
};
