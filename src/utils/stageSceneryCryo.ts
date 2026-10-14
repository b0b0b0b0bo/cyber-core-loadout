import * as THREE from 'three';
import {
  std, basic, additive, mesh, box, canvasTex, glowSprite, beam, particles, makeArc, buildMech,
} from './stageScenery';
import type { Ctx, SceneryConfig } from './stageScenery';

/**
 * MAP 6 FROZEN ARCHIVE — ice meets sci-fi: frozen data vaults, cryo pods, rimed server halls (SEC-36 .. SEC-42).
 * Everything is visual set dressing outside the arena walls (|x|,|z| > 41) or overhead.
 */

type CryoId = 'outskirts' | 'cryobay' | 'stacks' | 'servers' | 'echohall' | 'conduit' | 'frostvault';

export const CRYO_CONFIG: Record<CryoId, SceneryConfig> = {
  outskirts: {
    sky: {
      top: 0x051a3a, horizon: 0xa8dcf2, bottom: 0x0a1c30, exponent: 0.5, stars: 0.012,
      aurora: { color: 0x5eead4, strength: 0.75 },
      clouds: { color: 0xcfe8f6, coverage: 0.4, speed: 0.01, opacity: 0.55 }, horizonGlow: { color: 0xbae6fd, strength: 0.4 },
    },
    fogColor: 0x7aa8c4, fogDensity: 0.009,
    ambient: [0xd8f0ff, 0.65], hemi: [0xbfe6ff, 0x24425c, 0.8],
    sun: { color: 0xe6f6ff, intensity: 1.2, pos: [-40, 36, -60] },
    wallHeight: 2.2, gridOpacity: 0.26, cornerLight: [0x67e8f9, 1.8],
    floorTint: 0xc8dcec, env: 'sky', envIntensity: 1.0,
  },
  cryobay: {
    sky: { top: 0x040c18, horizon: 0x16324a, bottom: 0x060e18 },
    fogColor: 0x0c2236, fogDensity: 0.0115,
    ambient: [0xbfe4ff, 0.6], hemi: [0x9fd4f5, 0x0c1a28, 0.85],
    sun: { color: 0xd8f0ff, intensity: 0.9, pos: [0, 40, 10] },
    wallHeight: 9, gridOpacity: 0.24, cornerLight: [0x38bdf8, 2.2],
    floorTint: 0xaec6d8, env: 'hemi', envIntensity: 0.9,
  },
  stacks: {
    sky: { top: 0x050a16, horizon: 0x1a3a5c, bottom: 0x070d18 },
    fogColor: 0x0e2238, fogDensity: 0.0105,
    ambient: [0xc8e8ff, 0.62], hemi: [0xa8dcff, 0x0c1828, 0.85],
    sun: { color: 0xe0f4ff, intensity: 1.0, pos: [0, 50, 0] },
    wallHeight: 14, gridOpacity: 0.22, cornerLight: [0x7dd3fc, 2.4],
    floorTint: 0xb4cadc, env: 'hemi', envIntensity: 0.95,
  },
  servers: {
    sky: { top: 0x03070f, horizon: 0x0c2a44, bottom: 0x04080f },
    fogColor: 0x08182a, fogDensity: 0.0125,
    ambient: [0xa8dcff, 0.55], hemi: [0x78c8ff, 0x08121e, 0.8],
    sun: { color: 0xbfe6ff, intensity: 0.8, pos: [10, 40, 10] },
    wallHeight: 10, gridOpacity: 0.3, cornerLight: [0x22d3ee, 2.4],
    floorTint: 0xa0b8cc, env: 'hemi', envIntensity: 0.85,
  },
  echohall: {
    sky: {
      top: 0x040818, horizon: 0x2a4a78, bottom: 0x060c1c, exponent: 0.5, stars: 0.03,
      aurora: { color: 0x7dd3fc, strength: 0.6 }, nebula: { a: 0x2563eb, b: 0x22d3ee, strength: 0.3 },
      horizonGlow: { color: 0x93c5fd, strength: 0.3 },
    },
    fogColor: 0x102844, fogDensity: 0.0095,
    ambient: [0xcfe6ff, 0.6], hemi: [0xa8d0ff, 0x0e1a30, 0.8],
    sun: { color: 0xe0f0ff, intensity: 0.9, pos: [0, 55, -20] },
    wallHeight: 3, gridOpacity: 0.28, cornerLight: [0x93c5fd, 2.0],
    floorTint: 0xb0c6dc, env: 'sky', envIntensity: 0.95,
  },
  conduit: {
    sky: {
      top: 0x03102a, horizon: 0x2c6a96, bottom: 0x06121f, exponent: 0.5, stars: 0.02,
      aurora: { color: 0x34d399, strength: 0.9 }, horizonGlow: { color: 0x67e8f9, strength: 0.45 },
    },
    fogColor: 0x12385a, fogDensity: 0.0088,
    ambient: [0xc8f0ff, 0.62], hemi: [0x9fe4ff, 0x0c2236, 0.85],
    sun: { color: 0xd8f8ff, intensity: 1.0, pos: [20, 50, -40] },
    wallHeight: 2.6, gridOpacity: 0.28, cornerLight: [0x2dd4bf, 2.2],
    floorTint: 0xb8d2e4, env: 'sky', envIntensity: 1.0,
  },
  frostvault: {
    sky: {
      top: 0x030a24, horizon: 0x7ac8f0, bottom: 0x081226, exponent: 0.45, stars: 0.02,
      aurora: { color: 0x67e8f9, strength: 0.85 }, nebula: { a: 0x38bdf8, b: 0xa5f3fc, strength: 0.3 },
      sun: { dir: [0.0, 0.32, -0.95], color: 0xe0f7ff, size: 0.01, glow: 1.0 }, horizonGlow: { color: 0xbae6fd, strength: 0.5 },
    },
    fogColor: 0x143a5e, fogDensity: 0.0078,
    ambient: [0xdaf2ff, 0.68], hemi: [0xbfe8ff, 0x16304a, 0.85],
    sun: { color: 0xe6f8ff, intensity: 1.3, pos: [0, 30, -90] },
    wallHeight: 2.4, gridOpacity: 0.3, cornerLight: [0x67e8f9, 2.3],
    floorTint: 0xc8def0, env: 'sky', envIntensity: 1.05,
  },
};

const TAU = Math.PI * 2;
const CYAN = 0x67e8f9;
const ICE = 0xbfe8ff;

// ───────────────────────────── shared helpers ─────────────────────────────

const iceMat = (c = ICE, o = 0.62, emissive = 0.3) =>
  new THREE.MeshPhysicalMaterial({ color: c, transparent: true, opacity: o, roughness: 0.06, metalness: 0.1, clearcoat: 1, emissive: c, emissiveIntensity: emissive, flatShading: true });

/** Faceted ice crystal (hexagonal prism with a pointed tip). */
function crystalGeo(r: number, h: number) {
  const tip = new THREE.CylinderGeometry(0, r, h * 0.3, 6, 1).translate(0, h * 0.85, 0).toNonIndexed();
  const body = new THREE.CylinderGeometry(r, r * 1.05, h * 0.7, 6, 1).translate(0, h * 0.35, 0).toNonIndexed();
  const pos = new Float32Array(tip.attributes.position.array.length + body.attributes.position.array.length);
  pos.set(tip.attributes.position.array as Float32Array, 0);
  pos.set(body.attributes.position.array as Float32Array, tip.attributes.position.array.length);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

function iceCluster(parent: THREE.Object3D, rnd: () => number, x: number, z: number, scale: number, color = ICE, emissive = 0.3) {
  const mat = iceMat(color, 0.7, emissive);
  const g = new THREE.Group(); g.position.set(x, 0, z); parent.add(g);
  const n = 3 + Math.floor(rnd() * 4);
  for (let i = 0; i < n; i++) {
    const h = (5 + rnd() * 12) * scale;
    const m = new THREE.Mesh(crystalGeo((0.8 + rnd() * 1.3) * scale, h), mat);
    m.position.set((rnd() - 0.5) * 5 * scale, -0.5, (rnd() - 0.5) * 5 * scale);
    m.rotation.set((rnd() - 0.5) * 0.7, rnd() * TAU, (rnd() - 0.5) * 0.7);
    g.add(m);
  }
  return g;
}

/** Blowing snow that follows the world (slow sideways streaks). */
function snowfall(ctx: Ctx, count = 420, wind = 1.4) {
  return particles(ctx, { count, size: 0.22, color: 0xf0faff, opacity: 0.75, half: [70, 70], y: [0.3, 50], mode: 'fall', speed: 2.0, sway: wind });
}

/** Cold vapour drifting near the floor. */
function mist(ctx: Ctx, color = 0xbfe6ff, opacity = 0.07) {
  return particles(ctx, { count: 160, size: 12, color, opacity, half: [70, 70], y: [0.2, 7], mode: 'drift', speed: 0.3, sway: 0.7 });
}

/** Holographic text / data panel texture. */
function holoPanel(lines: string[], color = '#67e8f9', w = 512, h = 256) {
  return canvasTex(w, h, (c) => {
    c.fillStyle = 'rgba(4,20,40,0.85)'; c.fillRect(0, 0, w, h);
    c.strokeStyle = color; c.lineWidth = 4; c.shadowColor = color; c.shadowBlur = 14; c.strokeRect(8, 8, w - 16, h - 16);
    c.fillStyle = color; c.font = 'bold 34px monospace'; c.textBaseline = 'top';
    lines.forEach((l, i) => c.fillText(l, 28, 26 + i * 46));
    c.globalAlpha = 0.45;
    for (let y = 0; y < h; y += 6) c.fillRect(12, y, w - 24, 1);
  });
}

/** Steel tower with a blinking beacon. */
function mast(parent: THREE.Object3D, x: number, z: number, h: number, steel: THREE.Material, beacon: THREE.Sprite[]) {
  box(parent, 1.2, h, 1.2, steel, x, h / 2, z);
  box(parent, 6, 0.3, 0.3, steel, x, h * 0.78, z);
  box(parent, 0.3, 0.3, 4.5, steel, x, h * 0.62, z);
  beacon.push(glowSprite(parent, 0x38bdf8, 5, 0.9, x, h + 1.2, z));
}

// ───────────────────────────── SEC-36 凍原外縁 ─────────────────────────────
// Snowfield under an aurora: ice crags, dead relay masts with blinking beacons, a ruined perimeter wall and a holo sign.
function buildOutskirts(ctx: Ctx) {
  const { root, rnd } = ctx;
  const snow = std(0xe8f4fc, 0.05, 0.85, { emissive: 0x1a3a58, emissiveIntensity: 0.2 });
  const steel = std(0x5a6c80, 0.85, 0.4);
  const dark = std(0x1c2836, 0.7, 0.5);
  mesh(root, new THREE.PlaneGeometry(600, 600), snow, 0, -0.3, 0, -Math.PI / 2);
  // Snow drifts.
  for (let i = 0; i < 36; i++) {
    const a = rnd() * TAU, r = 78 + rnd() * 100, w = 14 + rnd() * 24, h = 2.5 + rnd() * 8;
    const d = mesh(root, new THREE.SphereGeometry(1, 14, 8), snow, Math.cos(a) * r, -1, Math.sin(a) * r);
    d.scale.set(w, h, w * (0.6 + rnd() * 0.5)); d.rotation.y = rnd() * TAU;
  }
  // Ice crags and crystal outcrops.
  const cols = [0xbfe8ff, 0x9ad8ff, 0xd8f4ff, 0x7dd3fc];
  for (let i = 0; i < 16; i++) {
    const a = rnd() * TAU, r = 48 + rnd() * 70;
    iceCluster(root, rnd, Math.cos(a) * r, Math.sin(a) * r, 1 + rnd() * 1.5, cols[i % cols.length]);
  }
  for (let i = 0; i < 10; i++) {
    const a = rnd() * TAU, r = 100 + rnd() * 60, s = 12 + rnd() * 22;
    const m = mesh(root, new THREE.DodecahedronGeometry(s, 0), std(0xdcecf8, 0.05, 0.4), Math.cos(a) * r, s * 0.3, Math.sin(a) * r);
    m.scale.y = 1.4; m.rotation.set(rnd(), rnd(), rnd());
  }
  // Dead relay masts with blinking beacons.
  const beacons: THREE.Sprite[] = [];
  for (const [x, z, h] of [[-62, -48, 34], [70, -30, 26], [-48, 66, 30], [58, 62, 38]] as const) mast(root, x, z, h, steel, beacons);
  // Ruined perimeter wall with a holographic sector sign.
  for (let i = 0; i < 9; i++) {
    const x = -72 + i * 18;
    box(root, 14, 6 + rnd() * 6, 2.4, dark, x, 4, -96, 0, 0, (rnd() - 0.5) * 0.06);
    box(root, 14, 0.4, 2.6, basic(0x38bdf8, { toneMapped: false }), x, 7.2, -96);
  }
  const signTex = holoPanel(['SECTOR 36', 'FROZEN ARCHIVE', 'ACCESS: LOST'], '#67e8f9');
  const sign = mesh(root, new THREE.PlaneGeometry(40, 20), basic(0xffffff, { map: signTex, transparent: true, opacity: 0.85, toneMapped: false, side: THREE.DoubleSide }), 0, 28, -92);
  glowSprite(root, CYAN, 70, 0.14, 0, 28, -92);
  // A crashed transport half-buried in the snow.
  const wreck = buildMech(steel, std(0x3a5068, 0.7, 0.5), dark, basic(0x38bdf8, { toneMapped: false }));
  wreck.scale.setScalar(1.5); wreck.position.set(92, -5, 30); wreck.rotation.set(-0.3, -1.7, 0.5);
  root.add(wreck);
  snowfall(ctx, 500, 1.8);
  mist(ctx);
  ctx.on((_dt, t) => {
    beacons.forEach((b, i) => { (b.material as THREE.SpriteMaterial).opacity = Math.sin(t * 2.2 + i * 1.7) > 0.3 ? 0.95 : 0.12; });
    (sign.material as THREE.MeshBasicMaterial).opacity = Math.sin(t * 13) * Math.sin(t * 3.1) > 0.6 ? 0.35 : 0.85;
  });
}

// ───────────────────────────── SEC-37 冷却ベイ ─────────────────────────────
// Cryo bay: rows of frosted stasis pods with frozen figures, overhead gantry, venting steam.
function buildCryoBay(ctx: Ctx) {
  const { root, rnd } = ctx;
  const R = 58;
  const hull = std(0x2a3c50, 0.75, 0.4);
  const hullLight = std(0x4a627c, 0.7, 0.4);
  const cyan = basic(0x38bdf8, { toneMapped: false });
  mesh(root, new THREE.CylinderGeometry(R + 10, R + 10, 80, 40, 1, true), std(0x16222f, 0.5, 0.8, { side: THREE.BackSide }), 0, 38, 0);
  mesh(root, new THREE.PlaneGeometry(260, 260), std(0x101a26, 0.4, 0.8), 0, 62, 0, Math.PI / 2);
  mesh(root, new THREE.PlaneGeometry(260, 260), std(0x1a2836, 0.5, 0.6), 0, -0.3, 0, -Math.PI / 2);
  // Stasis pods in a ring against the walls.
  const frost = iceMat(0xd8f4ff, 0.5, 0.18);
  const bodies = std(0x9fc4dc, 0.3, 0.6, { emissive: 0x10304a, emissiveIntensity: 0.4 });
  const pods: THREE.Sprite[] = [];
  const N = 22;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * TAU, x = Math.cos(a) * (R - 1), z = Math.sin(a) * (R - 1);
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = -a + Math.PI / 2; root.add(g);
    box(g, 6.4, 1.4, 5, hullLight, 0, 0.7, 0);
    mesh(g, new THREE.CylinderGeometry(2.3, 2.3, 9, 14, 1, true), frost, 0, 6, 0).material.side = THREE.DoubleSide;
    mesh(g, new THREE.CylinderGeometry(2.4, 2.4, 0.6, 14), hull, 0, 10.6, 0);
    if (rnd() > 0.25) { // frozen occupant
      mesh(g, new THREE.CapsuleGeometry(0.8, 3.4, 4, 8), bodies, 0, 5.6, 0);
      mesh(g, new THREE.SphereGeometry(0.75, 10, 8), bodies, 0, 8.2, 0);
    }
    box(g, 0.4, 7.6, 0.3, cyan, 2.7, 6, 0);
    pods.push(glowSprite(g, 0x38bdf8, 9, 0.28, 0, 6, 0));
  }
  // Overhead gantry with a hanging cryo-lift and chains.
  const rail = new THREE.Group(); rail.position.set(0, 46, 0); root.add(rail);
  box(rail, 120, 1.6, 3, hull, 0, 0, 0);
  box(rail, 3, 1.6, 120, hull, 0, 0, 0);
  const lift = new THREE.Group(); lift.position.set(0, 0, 0); rail.add(lift);
  box(lift, 0.4, 24, 0.4, hull, 0, -12, 0);
  box(lift, 8, 1.2, 8, hullLight, 0, -24.5, 0);
  for (const [x, z] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) box(lift, 0.3, 4, 0.3, cyan, x, -27, z);
  glowSprite(lift, 0x38bdf8, 16, 0.4, 0, -25, 0);
  // Coolant pipes ringing the ceiling.
  for (let i = 0; i < 3; i++) mesh(root, new THREE.TorusGeometry(R - 4 - i * 3, 0.9, 8, 60), i % 2 ? hull : hullLight, 0, 40 + i * 3.4, 0, Math.PI / 2);
  // Ice stalactites.
  for (let i = 0; i < 30; i++) {
    const a = rnd() * TAU, r = 20 + rnd() * 44, h = 3 + rnd() * 9;
    mesh(root, new THREE.ConeGeometry(0.6 + rnd() * 1.2, h, 5), iceMat(0xd8f4ff, 0.75, 0.25), Math.cos(a) * r, 60 - h / 2, Math.sin(a) * r, Math.PI);
  }
  beam(root, new THREE.Vector3(0, 62, 0), new THREE.Vector3(0, 0, 0), 5, 26, 0x9fe0ff, 0.06);
  // Steam vents.
  particles(ctx, { count: 260, size: 4.5, color: 0xdaf2ff, opacity: 0.1, half: [50, 50], y: [0.5, 24], mode: 'rise', speed: 2.4, sway: 0.8 });
  particles(ctx, { count: 160, size: 0.2, color: 0xe0f7ff, opacity: 0.65, half: [50, 50], y: [0.5, 40], mode: 'fall', speed: 0.8, sway: 0.5 });
  ctx.on((_dt, t) => {
    lift.position.x = Math.sin(t * 0.25) * 34; lift.position.z = Math.cos(t * 0.19) * 34;
    pods.forEach((p, i) => { (p.material as THREE.SpriteMaterial).opacity = 0.2 + 0.12 * Math.sin(t * 1.4 + i); });
    ctx.hemi.intensity = 0.85 + Math.sin(t * 0.9) * 0.04;
  });
}

// ───────────────────────────── SEC-38 凍結書庫 ─────────────────────────────
// Frozen stacks: towering racks of data cartridges rimed with ice, drifting holo pages, a central light shaft.
function buildStacks(ctx: Ctx) {
  const { root, rnd } = ctx;
  const frame = std(0x32465c, 0.8, 0.4);
  const rime = iceMat(0xe0f4ff, 0.55, 0.15);
  const cart = [basic(0x38bdf8, { toneMapped: false }), basic(0x7dd3fc, { toneMapped: false }), basic(0xe0f2fe, { toneMapped: false }), basic(0x22d3ee, { toneMapped: false })];
  mesh(root, new THREE.PlaneGeometry(600, 600), std(0x14202e, 0.5, 0.6), 0, -0.3, 0, -Math.PI / 2);
  mesh(root, new THREE.PlaneGeometry(300, 300), std(0x0c1622, 0.4, 0.8), 0, 78, 0, Math.PI / 2);
  // Rack canyons on every side.
  const rackRow = (x: number, z: number, rot: number) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot; root.add(g);
    const H = 56;
    for (const sx of [-11, 11]) box(g, 1.2, H, 1.2, frame, sx, H / 2, 0);
    for (let y = 4; y < H; y += 6) {
      box(g, 24, 0.5, 4, frame, 0, y, 0);
      for (let k = 0; k < 9; k++) if (rnd() > 0.15) box(g, 1.5, 3.4, 2.6, cart[(k + Math.floor(y)) % cart.length], -10 + k * 2.5, y + 2, 0);
    }
    mesh(g, new THREE.BoxGeometry(24, H * 0.5, 4.6), rime, 0, H * 0.25, 0);
    return g;
  };
  for (let i = -3; i <= 3; i++) {
    rackRow(i * 26, -64, 0); rackRow(i * 26, 64, Math.PI);
    if (Math.abs(i) < 3) { rackRow(-64, i * 26, Math.PI / 2); rackRow(64, i * 26, -Math.PI / 2); }
  }
  // Central skylight shaft.
  beam(root, new THREE.Vector3(0, 100, 0), new THREE.Vector3(0, 0, 0), 6, 30, 0xd8f4ff, 0.08);
  beam(root, new THREE.Vector3(-34, 90, -30), new THREE.Vector3(-20, 0, -12), 2, 12, 0x9fe0ff, 0.06);
  beam(root, new THREE.Vector3(36, 90, 28), new THREE.Vector3(22, 0, 10), 2, 12, 0x9fe0ff, 0.06);
  // Floating holo pages.
  const pages: THREE.Mesh[] = [];
  for (let i = 0; i < 40; i++) {
    const tex = holoPanel([`DATA ${(1000 + i * 37) % 9999}`, '▒▒▒▒▒▒▒', 'ARCHIVED'], '#7dd3fc', 256, 160);
    const p = mesh(root, new THREE.PlaneGeometry(4 + rnd() * 3, 2.6 + rnd() * 2), basic(0xffffff, { map: tex, transparent: true, opacity: 0.6, toneMapped: false, side: THREE.DoubleSide, depthWrite: false }));
    const a = rnd() * TAU, r = 46 + rnd() * 16;
    p.position.set(Math.cos(a) * r, 6 + rnd() * 40, Math.sin(a) * r);
    p.rotation.y = rnd() * TAU;
    pages.push(p);
  }
  snowfall(ctx, 260, 0.6);
  mist(ctx, 0xd8f0ff, 0.06);
  ctx.on((_dt, t) => {
    pages.forEach((p, i) => { p.rotation.y += 0.004 + (i % 4) * 0.001; p.position.y += Math.sin(t * 0.7 + i) * 0.006; });
  });
}

// ───────────────────────────── SEC-39 氷結サーバー ─────────────────────────────
// Server hall: LED-blinking racks, frozen cable bundles, icicles and arcing power lines.
function buildServers(ctx: Ctx) {
  const { root, rnd } = ctx;
  const casing = std(0x1e2c3c, 0.8, 0.4);
  const face = std(0x2e4258, 0.7, 0.45);
  mesh(root, new THREE.PlaneGeometry(600, 600), std(0x0e1824, 0.5, 0.6), 0, -0.3, 0, -Math.PI / 2);
  mesh(root, new THREE.PlaneGeometry(300, 300), std(0x0a121c, 0.4, 0.8), 0, 62, 0, Math.PI / 2);
  // LED texture for rack faces.
  const ledTex = canvasTex(128, 256, (c) => {
    c.fillStyle = '#0a1420'; c.fillRect(0, 0, 128, 256);
    for (let y = 8; y < 256; y += 14) {
      c.fillStyle = '#16283a'; c.fillRect(6, y, 116, 10);
      for (let x = 10; x < 118; x += 8) { c.fillStyle = rnd() > 0.5 ? '#22d3ee' : rnd() > 0.5 ? '#38bdf8' : '#0e3a50'; c.fillRect(x, y + 3, 4, 4); }
    }
  });
  ledTex.wrapS = ledTex.wrapT = THREE.RepeatWrapping;
  const ledMat = basic(0xffffff, { map: ledTex, toneMapped: false });
  const blinkers: THREE.Mesh[] = [];
  const rackBlock = (x: number, z: number, rot: number, w: number) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot; root.add(g);
    box(g, w, 40, 6, casing, 0, 20, 0);
    const f = mesh(g, new THREE.PlaneGeometry(w - 1, 38), ledMat, 0, 20, 3.05);
    blinkers.push(f);
    box(g, w + 0.6, 1, 6.6, face, 0, 40.5, 0);
    for (let k = 0; k < 4; k++) mesh(g, new THREE.ConeGeometry(0.4 + rnd() * 0.4, 3 + rnd() * 6, 5), iceMat(0xdaf4ff, 0.75, 0.2), -w / 2 + 2 + k * (w / 4), 40 - 1.8, 3.4, Math.PI);
    return g;
  };
  for (let i = -3; i <= 3; i++) {
    rackBlock(i * 22, -66, 0, 20); rackBlock(i * 22, 66, Math.PI, 20);
    if (Math.abs(i) < 3) { rackBlock(-66, i * 22, Math.PI / 2, 20); rackBlock(66, i * 22, -Math.PI / 2, 20); }
  }
  // Frozen cable bundles dropping from the ceiling.
  for (let i = 0; i < 18; i++) {
    const a = rnd() * TAU, r = 46 + rnd() * 14, h = 20 + rnd() * 24;
    mesh(root, new THREE.CylinderGeometry(0.6, 0.9, h, 8), std(0x1a2a3a, 0.6, 0.5), Math.cos(a) * r, 62 - h / 2, Math.sin(a) * r);
    mesh(root, new THREE.CylinderGeometry(0.9, 1.3, h * 0.7, 6), iceMat(0xdaf4ff, 0.55, 0.15), Math.cos(a) * r, 62 - h * 0.35, Math.sin(a) * r);
  }
  // Power arcs between rack tops.
  const arcs = [makeArc(root, 0x7dd3fc, 0.1), makeArc(root, 0x22d3ee, 0.1), makeArc(root, 0xbae6fd, 0.1)];
  const ends: [THREE.Vector3, THREE.Vector3][] = [
    [new THREE.Vector3(-44, 40, -66), new THREE.Vector3(-22, 40, -66)],
    [new THREE.Vector3(44, 40, 66), new THREE.Vector3(22, 40, 66)],
    [new THREE.Vector3(-66, 40, -22), new THREE.Vector3(-66, 40, 0)],
  ];
  // Scan line sweeping the hall.
  const scan = mesh(root, new THREE.PlaneGeometry(200, 3), additive(0x22d3ee, 0.07, { side: THREE.DoubleSide }), 0, 20, -60, 0, 0, 0);
  glowSprite(root, 0x22d3ee, 90, 0.1, 0, 30, 0);
  particles(ctx, { count: 200, size: 0.2, color: 0x9fe8ff, opacity: 0.55, half: [60, 60], y: [0.5, 40], mode: 'drift', speed: 0.6, sway: 0.4 });
  mist(ctx, 0xa8dcff, 0.06);
  let arcT = 0;
  ctx.on((dt, t) => {
    ledTex.offset.y = Math.floor(t * 4) / 18;
    scan.position.z = -60 + ((t * 16) % 120);
    arcT -= dt;
    if (arcT < 0) {
      arcT = 0.1 + Math.random() * 0.35;
      arcs.forEach((a, i) => { const on = Math.random() > 0.4; a.visible(on); if (on) a.set(ends[i][0], ends[i][1], 3); });
    }
    blinkers.forEach((b, i) => { (b.material as THREE.MeshBasicMaterial).color.setScalar(0.85 + 0.15 * Math.sin(t * 6 + i)); });
  });
}

// ───────────────────────────── SEC-40 残像ホール ─────────────────────────────
// Echo hall: ice-encased figures frozen mid-motion, flickering projector pillars, an aurora dome overhead.
function buildEchoHall(ctx: Ctx) {
  const { root, rnd } = ctx;
  const steel = std(0x3a4e66, 0.8, 0.4);
  const holo = (c: number, o = 0.4) => additive(c, o, { side: THREE.DoubleSide });
  mesh(root, new THREE.PlaneGeometry(600, 600), std(0x0e1a2c, 0.5, 0.5), 0, -0.3, 0, -Math.PI / 2);
  // Frozen figures: giant ice blocks holding mech silhouettes.
  const figures: { g: THREE.Group; base: number }[] = [];
  const fig = (x: number, z: number, s: number, ry: number) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; root.add(g);
    const mech = buildMech(std(0x6a8aa8, 0.5, 0.5), std(0x8ab0cc, 0.5, 0.5), std(0x20303f, 0.6, 0.5), basic(0x38bdf8, { toneMapped: false }));
    mech.scale.setScalar(s * 0.8); mech.rotation.set((rnd() - 0.5) * 0.3, 0, (rnd() - 0.5) * 0.3);
    g.add(mech);
    const block = new THREE.Mesh(crystalGeo(11 * s, 34 * s), iceMat(0xcdeeff, 0.4, 0.2));
    block.position.y = -1; g.add(block);
    glowSprite(g, CYAN, 36 * s, 0.14, 0, 12 * s, 0);
    figures.push({ g, base: ry });
    return g;
  };
  for (let i = 0; i < 9; i++) { const a = (i / 9) * TAU + 0.2, r = 70 + (i % 2) * 14; fig(Math.cos(a) * r, Math.sin(a) * r, 1 + rnd() * 0.5, -a + Math.PI / 2); }
  // Projector pillars with holo figures that flicker.
  const holos: THREE.Mesh[] = [];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU, r = 58;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    box(root, 2.4, 6, 2.4, steel, x, 3, z);
    mesh(root, new THREE.CylinderGeometry(0.2, 2.2, 24, 12, 1, true), holo(0x7dd3fc, 0.1), x, 18, z);
    const h = mesh(root, new THREE.CapsuleGeometry(1.5, 6, 4, 10), holo(0x93c5fd, 0.35), x, 14, z);
    holos.push(h);
    glowSprite(root, 0x7dd3fc, 10, 0.5, x, 3.5, z);
  }
  // Aurora ring overhead.
  const ring = new THREE.Group(); ring.position.set(0, 110, 0); ring.rotation.x = 0.25; root.add(ring);
  mesh(ring, new THREE.TorusGeometry(70, 0.9, 8, 100), basic(0xbae6fd, { fog: false, toneMapped: false }));
  mesh(ring, new THREE.TorusGeometry(70, 6, 8, 100), additive(0x38bdf8, 0.1, { fog: false }));
  particles(ctx, { count: 280, size: 0.22, color: 0xcfeaff, opacity: 0.6, half: [70, 70], y: [0.5, 50], mode: 'rise', speed: 0.7, sway: 0.5 });
  mist(ctx, 0x9fd0ff, 0.06);
  ctx.on((_dt, t) => {
    holos.forEach((h, i) => {
      const flick = Math.sin(t * 9 + i * 2.3) * Math.sin(t * 2.7 + i) > 0.55 ? 0.08 : 0.34;
      (h.material as THREE.MeshBasicMaterial).opacity = flick;
      h.rotation.y += 0.01;
    });
    figures.forEach((f, i) => { f.g.rotation.y = f.base + Math.sin(t * 0.1 + i) * 0.02; });
    ring.rotation.z = t * 0.03;
  });
}

// ───────────────────────────── SEC-41 オーロラ導管 ─────────────────────────────
// Open-top cooling tower: vertical energy conduits, rotating coolant rings, aurora spilling from above.
function buildConduit(ctx: Ctx) {
  const { root, rnd } = ctx;
  const steel = std(0x40566e, 0.85, 0.35, { emissive: 0x0a2438, emissiveIntensity: 0.25 });
  const pipe = std(0x6a8aa8, 0.9, 0.3);
  const glow = basic(0x2dd4bf, { toneMapped: false });
  mesh(root, new THREE.PlaneGeometry(600, 600), std(0xdcecf8, 0.05, 0.7, { emissive: 0x143048, emissiveIntensity: 0.25 }), 0, -0.3, 0, -Math.PI / 2);
  // Tall conduit pylons ring.
  const rings: THREE.Mesh[] = [];
  const pulses: THREE.Mesh[] = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU, r = 70 + (i % 2) * 10, h = 60 + rnd() * 40;
    const g = new THREE.Group(); g.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); root.add(g);
    mesh(g, new THREE.CylinderGeometry(2.2, 3.4, h, 8), steel, 0, h / 2, 0);
    mesh(g, new THREE.CylinderGeometry(0.5, 0.5, h * 0.95, 6), glow, 0, h / 2, 0);
    pulses.push(g.children[1] as THREE.Mesh);
    for (let y = 12; y < h; y += 16) {
      const rg = mesh(g, new THREE.TorusGeometry(4.4, 0.5, 6, 20), i % 2 ? pipe : glow, 0, y, 0, Math.PI / 2);
      rings.push(rg);
    }
    glowSprite(g, 0x2dd4bf, 14, 0.3, 0, h, 0);
    mesh(g, new THREE.ConeGeometry(2.6, 7, 6), iceMat(0xd8f8ff, 0.7, 0.35), 0, h + 3.5, 0);
  }
  // Central coolant spire in the far distance.
  const core = new THREE.Group(); core.position.set(0, 0, -128); root.add(core);
  mesh(core, new THREE.CylinderGeometry(10, 16, 120, 12), steel, 0, 60, 0);
  const ringsBig: THREE.Mesh[] = [];
  for (let y = 20; y < 120; y += 22) ringsBig.push(mesh(core, new THREE.TorusGeometry(15, 1.4, 8, 36), glow, 0, y, 0, Math.PI / 2));
  beam(root, new THREE.Vector3(0, 220, -128), new THREE.Vector3(0, 120, -128), 14, 4, 0x2dd4bf, 0.1);
  // Aurora curtains overhead.
  for (let i = 0; i < 4; i++) {
    const c = mesh(root, new THREE.PlaneGeometry(240, 70), additive(i % 2 ? 0x34d399 : 0x67e8f9, 0.06, { side: THREE.DoubleSide, fog: false }), -60 + i * 40, 120, -80 + i * 20, 0, 0.3 * (i - 1.5));
    c.userData.ph = i;
  }
  for (let i = 0; i < 12; i++) { const a = rnd() * TAU, r = 48 + rnd() * 50; iceCluster(root, rnd, Math.cos(a) * r, Math.sin(a) * r, 0.9 + rnd(), ICE); }
  snowfall(ctx, 360, 1.2);
  particles(ctx, { count: 140, size: 0.3, color: 0x6ee7b7, opacity: 0.6, half: [60, 60], y: [0.5, 60], mode: 'rise', speed: 2.6, sway: 0.4 });
  mist(ctx, 0xbfe6ff, 0.06);
  ctx.on((dt, t) => {
    rings.forEach((r, i) => { r.rotation.z += dt * (0.5 + (i % 3) * 0.2) * (i % 2 ? 1 : -1); });
    ringsBig.forEach((r, i) => { r.rotation.z += dt * 0.3 * (i % 2 ? 1 : -1); });
    pulses.forEach((p, i) => { p.scale.x = p.scale.z = 1 + 0.4 * Math.sin(t * 3 + i); });
    root.children.forEach((o) => { if (o.userData.ph !== undefined) o.position.x += Math.sin(t * 0.3 + o.userData.ph) * 0.02; });
  });
}

// ───────────────────────────── SEC-42 氷晶の記録庫 ─────────────────────────────
// Boss vault: a colossal crystal reactor behind the north wall, rotating coolant rings, orbiting ice blades.
function buildFrostVault(ctx: Ctx) {
  const { root, rnd } = ctx;
  const gold = std(0xcfe4f4, 0.9, 0.22, { emissive: 0x1a3a58, emissiveIntensity: 0.35 });
  const lineM = basic(0x67e8f9, { toneMapped: false });
  const whiteM = basic(0xe0f7ff, { toneMapped: false });
  mesh(root, new THREE.PlaneGeometry(600, 600), new THREE.MeshPhysicalMaterial({ color: 0x1a3a5a, roughness: 0.08, metalness: 0.5, clearcoat: 1 }), 0, -0.3, 0, -Math.PI / 2);
  // Ring of crystal spires.
  const palette = [0x9ad8ff, 0xd8f4ff, 0x7dd3fc, 0xbfe8ff];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU + 0.1, r = 66 + (i % 2) * 14, h = 40 + rnd() * 46;
    const m = new THREE.Mesh(crystalGeo(3.2 + rnd() * 3, h), iceMat(palette[i % palette.length], 0.62, 0.3));
    m.position.set(Math.cos(a) * r, -1, Math.sin(a) * r); m.rotation.y = rnd() * TAU; root.add(m);
    box(root, 7, 1.2, 7, gold, Math.cos(a) * r, 0.4, Math.sin(a) * r);
  }
  // The crystal reactor core behind the north wall.
  const keep = new THREE.Group(); keep.position.set(0, 0, -112); root.add(keep);
  keep.add(new THREE.Mesh(crystalGeo(15, 100), iceMat(0xa5e8ff, 0.5, 0.4)));
  for (const s of [-1, 1]) { const m = new THREE.Mesh(crystalGeo(7, 64), iceMat(0xe0f7ff, 0.5, 0.35)); m.position.set(s * 26, 0, 8); m.rotation.z = -s * 0.18; keep.add(m); }
  box(keep, 74, 3, 26, gold, 0, 1, 4);
  for (let x = -32; x <= 32; x += 8) box(keep, 1.1, 12, 1.1, gold, x, 7, 14);
  const coreGlow = glowSprite(keep, 0xa5f3fc, 70, 0.35, 0, 46, 0);
  // Coolant discs (a double halo like a sun-disc, but frozen).
  const disc = new THREE.Group(); disc.position.set(0, 70, -156); root.add(disc);
  const dA = mesh(disc, new THREE.TorusGeometry(46, 1.4, 10, 80), whiteM);
  const dB = mesh(disc, new THREE.TorusGeometry(36, 0.8, 8, 72), lineM);
  mesh(disc, new THREE.TorusGeometry(46, 6, 8, 64), additive(0x67e8f9, 0.1, { fog: false }));
  for (let k = 0; k < 24; k++) { const a = (k / 24) * TAU; mesh(dA, new THREE.ConeGeometry(1.2, k % 2 ? 9 : 16, 4), whiteM, Math.cos(a) * 54, Math.sin(a) * 54, 0, 0, 0, a - Math.PI / 2); }
  glowSprite(disc, 0xbae6fd, 150, 0.3, 0, 0, -2);
  // Orbiting ice blades.
  const blades: { g: THREE.Group; r: number; y: number; a0: number; sp: number }[] = [];
  for (let i = 0; i < 14; i++) {
    const g = new THREE.Group(); root.add(g);
    mesh(g, new THREE.ConeGeometry(0.6, 9, 4), iceMat(i % 2 ? 0xe0f7ff : 0x7dd3fc, 0.75, 0.4), 0, 0, 0, Math.PI, 0, 0);
    blades.push({ g, r: 58 + (i % 3) * 8, y: 14 + (i % 4) * 9, a0: (i / 14) * TAU, sp: 0.06 + (i % 3) * 0.015 });
  }
  beam(root, new THREE.Vector3(0, 130, -90), new THREE.Vector3(0, 0, -30), 3, 26, 0xd8f4ff, 0.08);
  beam(root, new THREE.Vector3(-40, 120, -60), new THREE.Vector3(-26, 0, -20), 2, 14, 0x9fe0ff, 0.06);
  beam(root, new THREE.Vector3(44, 120, -60), new THREE.Vector3(30, 0, -20), 2, 14, 0x9fe0ff, 0.06);
  snowfall(ctx, 320, 1.0);
  particles(ctx, { count: 260, size: 0.25, color: 0xbae6fd, opacity: 0.7, half: [60, 60], y: [0.5, 60], mode: 'rise', speed: 0.9, sway: 0.5 });
  const arc = makeArc(root, 0x7dd3fc, 0.12);
  let arcT = 0;
  ctx.on((dt, t) => {
    dA.rotation.z = t * 0.08; dB.rotation.z = -t * 0.14;
    (coreGlow.material as THREE.SpriteMaterial).opacity = 0.3 + Math.sin(t * 1.6) * 0.08;
    blades.forEach((b, i) => {
      const a = b.a0 + t * b.sp;
      b.g.position.set(Math.cos(a) * b.r, b.y + Math.sin(t * 0.8 + i) * 1.2, Math.sin(a) * b.r);
      b.g.rotation.set(0.2, -a, Math.sin(t + i) * 0.2);
    });
    arcT -= dt;
    if (arcT < 0) {
      arcT = 0.12 + Math.random() * 0.4;
      const on = Math.random() > 0.5; arc.visible(on);
      if (on) { const a = new THREE.Vector3((Math.random() - 0.5) * 40, 30 + Math.random() * 30, -108); arc.set(a, a.clone().add(new THREE.Vector3((Math.random() - 0.5) * 16, -14, (Math.random() - 0.5) * 8)), 3); }
    }
    ctx.hemi.intensity = 0.85 + Math.sin(t * 0.5) * 0.05;
  });
}

export const CRYO_BUILDERS: Record<CryoId, (ctx: Ctx) => void> = {
  outskirts: buildOutskirts, cryobay: buildCryoBay, stacks: buildStacks, servers: buildServers,
  echohall: buildEchoHall, conduit: buildConduit, frostvault: buildFrostVault,
};
