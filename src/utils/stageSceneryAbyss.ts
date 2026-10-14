import * as THREE from 'three';
import {
  std, basic, additive, mesh, box, canvasTex, softDot, glowSprite, beam, particles, catenary, WALL,
} from './stageScenery';
import type { Ctx, SceneryConfig } from './stageScenery';

/**
 * MAP 4 TIDAL RUINS — sunken-city stages (SEC-22 .. SEC-28).
 * Everything is visual set dressing outside the arena walls (|x|,|z| > 41) or overhead.
 */

type AbyssId = 'harbor' | 'reef' | 'whalefall' | 'vents' | 'aquarium' | 'trench' | 'sanctum';

export const ABYSS_CONFIG: Record<AbyssId, SceneryConfig> = {
  harbor: {
    sky: { top: 0x063a52, horizon: 0x3bb8b0, bottom: 0x0a2a36, exponent: 0.5, sun: { dir: [0.15, 0.97, -0.15], color: 0xd8fff8, size: 0.02, glow: 0.9 }, horizonGlow: { color: 0x5eead4, strength: 0.45 } },
    fogColor: 0x0e5560, fogDensity: 0.011,
    ambient: [0x9ff5ee, 0.6], hemi: [0x7dd3d0, 0x10343a, 0.75],
    sun: { color: 0xc8fff4, intensity: 1.0, pos: [10, 50, -10] },
    wallHeight: 3, gridOpacity: 0.26, cornerLight: [0x2dd4bf, 1.8],
    floorTint: 0x8fb4b4, env: 'sky', envIntensity: 0.9,
  },
  reef: {
    sky: { top: 0x0a4a66, horizon: 0x5fd6c6, bottom: 0x0c3446, exponent: 0.5, sun: { dir: [0.0, 1.0, 0.05], color: 0xeafff9, size: 0.03, glow: 1.0 }, horizonGlow: { color: 0xfda4af, strength: 0.25 } },
    fogColor: 0x127080, fogDensity: 0.009,
    ambient: [0xb8fff0, 0.65], hemi: [0x8ee9dc, 0x163e48, 0.8],
    sun: { color: 0xe0fff8, intensity: 1.1, pos: [0, 60, 0] },
    wallHeight: 3.5, gridOpacity: 0.26, cornerLight: [0xfb7185, 1.8],
    floorTint: 0xa4c4c0, env: 'sky', envIntensity: 1.0,
  },
  whalefall: {
    sky: { top: 0x010a12, horizon: 0x0c2b3c, bottom: 0x01070c, exponent: 0.55, sun: { dir: [0.1, 0.98, 0.0], color: 0x6bc6d8, size: 0.015, glow: 0.45 } },
    fogColor: 0x061a24, fogDensity: 0.016,
    ambient: [0x6aa8c0, 0.45], hemi: [0x4a8fa8, 0x06121a, 0.6],
    sun: { color: 0x8fd4e8, intensity: 0.6, pos: [0, 50, 0] },
    wallHeight: 4, gridOpacity: 0.22, cornerLight: [0x67e8f9, 1.7],
    floorTint: 0x7a949c, env: 'hemi', envIntensity: 0.7,
  },
  vents: {
    sky: { top: 0x04070d, horizon: 0x2a1410, bottom: 0x05080c, exponent: 0.55, horizonGlow: { color: 0xea580c, strength: 0.4 } },
    fogColor: 0x1a0f0c, fogDensity: 0.016,
    ambient: [0xffa070, 0.5], hemi: [0x3a6a7a, 0xff6a20, 0.85],
    sun: { color: 0xffb080, intensity: 0.6, pos: [0, 40, 10] },
    wallHeight: 4, gridOpacity: 0.2, cornerLight: [0xf97316, 2.4],
    floorTint: 0xa88f84, env: 'hemi', envIntensity: 0.75,
  },
  aquarium: {
    sky: { top: 0x04101c, horizon: 0x0a2a40, bottom: 0x040c14 },
    fogColor: 0x082436, fogDensity: 0.008,
    ambient: [0xb0e8ff, 0.7], hemi: [0x7fd0f0, 0x10202c, 0.8],
    sun: { color: 0xd8f4ff, intensity: 0.9, pos: [0, 40, 5] },
    wallHeight: 5, gridOpacity: 0.28, cornerLight: [0x38bdf8, 2.2],
    floorTint: 0xb4c8d4, env: 'hemi', envIntensity: 0.9,
  },
  trench: {
    sky: { top: 0x010208, horizon: 0x070a22, bottom: 0x010106, exponent: 0.6, nebula: { a: 0x0e7490, b: 0x4f46e5, strength: 0.25 } },
    fogColor: 0x03061a, fogDensity: 0.015,
    ambient: [0x7a8cff, 0.4], hemi: [0x5a6cf0, 0x03040e, 0.55],
    sun: { color: 0x8fa0ff, intensity: 0.45, pos: [0, 40, 0] },
    wallHeight: 4, gridOpacity: 0.3, cornerLight: [0x22d3ee, 2.2],
    floorTint: 0x70789c, env: 'hemi', envIntensity: 0.7,
  },
  sanctum: {
    sky: { top: 0x021a2e, horizon: 0x0f5a6e, bottom: 0x020e18, exponent: 0.5, sun: { dir: [0.0, 1.0, -0.1], color: 0xc8fff4, size: 0.035, glow: 1.0 }, horizonGlow: { color: 0x2dd4bf, strength: 0.4 } },
    fogColor: 0x083844, fogDensity: 0.011,
    ambient: [0x9ffff0, 0.55], hemi: [0x5eead4, 0x0a2028, 0.75],
    sun: { color: 0xc8fff4, intensity: 1.0, pos: [0, 60, -10] },
    wallHeight: 4.5, gridOpacity: 0.28, cornerLight: [0x2dd4bf, 2.4],
    floorTint: 0x92b8b8, env: 'sky', envIntensity: 0.95,
  },
};

// ───────────────────────────── shared underwater kit ─────────────────────────────

const TAU = Math.PI * 2;

function causticTexture(rnd: () => number) {
  const t = canvasTex(256, 256, (c) => {
    c.fillStyle = '#000'; c.fillRect(0, 0, 256, 256);
    c.lineWidth = 2;
    for (let i = 0; i < 70; i++) {
      const x = rnd() * 256, y = rnd() * 256, r = 14 + rnd() * 34;
      c.strokeStyle = `rgba(190,255,250,${0.25 + rnd() * 0.5})`;
      for (const ox of [-256, 0, 256]) for (const oy of [-256, 0, 256]) {
        c.beginPath(); c.arc(x + ox, y + oy, r, rnd() * TAU, rnd() * TAU + 2.2); c.stroke();
      }
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** Sea floor beyond the arena, light shafts, caustics, surface glimmer and marine snow. */
function seaCommon(ctx: Ctx, o: {
  floor?: number; shafts?: number; shaftColor?: number; shaftOpacity?: number;
  caustic?: number; causticColor?: number; surface?: number; snow?: number; snowColor?: number;
}) {
  const { root, rnd } = ctx;
  if (o.floor !== undefined) mesh(root, new THREE.PlaneGeometry(520, 520), std(o.floor, 0.05, 0.95), 0, -0.4, 0, -Math.PI / 2);
  const shafts: THREE.Mesh[] = [];
  for (let i = 0; i < (o.shafts ?? 0); i++) {
    const a = rnd() * TAU, r = 25 + rnd() * 75;
    const top = new THREE.Vector3(Math.cos(a) * r + 20, 90, Math.sin(a) * r - 12);
    const bot = new THREE.Vector3(top.x - 26, -4, top.z + 8);
    shafts.push(beam(root, top, bot, 1.5 + rnd() * 2.5, 8 + rnd() * 9, o.shaftColor ?? 0xbff8f0, (o.shaftOpacity ?? 0.07) * (0.6 + rnd() * 0.8)));
  }
  const tex = causticTexture(rnd);
  if (o.caustic) {
    tex.repeat.set(7, 7);
    mesh(root, new THREE.PlaneGeometry(80, 80), additive(o.causticColor ?? 0x9ff5ee, o.caustic, { map: tex, fog: false }), 0, 0.08, 0, -Math.PI / 2);
  }
  let surfTex: THREE.Texture | null = null;
  if (o.surface) {
    surfTex = tex.clone(); surfTex.needsUpdate = true; surfTex.repeat.set(26, 26);
    mesh(root, new THREE.PlaneGeometry(520, 520), additive(o.causticColor ?? 0x9ff5ee, o.surface, { map: surfTex, fog: false, side: THREE.DoubleSide }), 0, 95, 0, Math.PI / 2);
  }
  if (o.snow) particles(ctx, { count: o.snow, size: 0.16, color: o.snowColor ?? 0xd8fff8, opacity: 0.55, half: [60, 60], y: [0, 40], mode: 'fall', speed: 0.6, sway: 0.5 });
  ctx.on((dt, t) => {
    if (o.caustic) tex.offset.set(t * 0.025, t * 0.017);
    if (surfTex) surfTex.offset.set(t * 0.01, -t * 0.008);
    shafts.forEach((s, i) => { s.rotation.z += Math.sin(t * 0.3 + i) * dt * 0.012; });
  });
}

/** Instanced fish swimming in an elliptical loop. */
function fishSchool(ctx: Ctx, o: { count: number; color: number; c: [number, number, number]; rx: number; rz: number; ry: number; speed: number; size: number; dir?: number }) {
  const geo = new THREE.ConeGeometry(0.2 * o.size, 0.9 * o.size, 4);
  geo.rotateX(-Math.PI / 2);
  const im = new THREE.InstancedMesh(geo, basic(o.color), o.count);
  im.frustumCulled = false;
  ctx.root.add(im);
  const seed: number[] = [];
  for (let i = 0; i < o.count; i++) seed.push(ctx.rnd());
  const d = new THREE.Object3D();
  const dir = o.dir ?? 1;
  ctx.on((_dt, t) => {
    for (let i = 0; i < o.count; i++) {
      const s = seed[i];
      const ph = t * o.speed * dir + s * 0.9 + i * 0.012;
      const wob = Math.sin(t * 1.7 + s * 30) * 1.4;
      d.position.set(o.c[0] + Math.cos(ph) * (o.rx + wob), o.c[1] + Math.sin(ph * 1.3 + s * 5) * o.ry, o.c[2] + Math.sin(ph) * (o.rz + wob));
      const vx = -Math.sin(ph) * o.rx * dir, vz = Math.cos(ph) * o.rz * dir;
      d.rotation.set(0, Math.atan2(-vx, -vz), Math.sin(t * 9 + s * 20) * 0.15);
      d.updateMatrix();
      im.setMatrixAt(i, d.matrix);
    }
    im.instanceMatrix.needsUpdate = true;
  });
}

/** Swaying kelp / sea-grass stalks. */
function kelp(ctx: Ctx, count: number, rMin: number, rMax: number, hMin: number, hMax: number, color: number) {
  const { root, rnd } = ctx;
  const mat = std(color, 0.05, 0.7, { emissive: color, emissiveIntensity: 0.12 });
  const chains: { g: THREE.Group; ph: number; i: number }[] = [];
  for (let k = 0; k < count; k++) {
    const a = rnd() * TAU, r = rMin + rnd() * (rMax - rMin);
    const h = hMin + rnd() * (hMax - hMin), segs = 5, L = h / segs;
    let parent: THREE.Object3D = new THREE.Group();
    parent.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    root.add(parent);
    const ph = rnd() * TAU;
    for (let i = 0; i < segs; i++) {
      const g = new THREE.Group();
      g.position.y = i === 0 ? 0 : L;
      parent.add(g);
      const leaf = box(g, 0.9 * (1 - i * 0.12), L, 0.08, mat, 0, L / 2, 0);
      leaf.rotation.y = a;
      chains.push({ g, ph, i });
      parent = g;
    }
  }
  ctx.on((_dt, t) => {
    for (const c of chains) {
      c.g.rotation.z = Math.sin(t * 0.8 + c.ph + c.i * 0.55) * 0.11;
      c.g.rotation.x = Math.cos(t * 0.65 + c.ph * 1.3 + c.i * 0.5) * 0.09;
    }
  });
}

/** Branching coral cluster. */
function coralCluster(parent: THREE.Object3D, rnd: () => number, x: number, z: number, scale: number, colors: number[]) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  parent.add(g);
  const n = 5 + Math.floor(rnd() * 5);
  for (let i = 0; i < n; i++) {
    const c = colors[Math.floor(rnd() * colors.length)];
    const m = std(c, 0.1, 0.55, { emissive: c, emissiveIntensity: 0.22 });
    const h = (2.5 + rnd() * 4.5) * scale;
    const b = new THREE.Group();
    b.position.set((rnd() - 0.5) * 3.5 * scale, 0, (rnd() - 0.5) * 3.5 * scale);
    b.rotation.set((rnd() - 0.5) * 0.5, rnd() * TAU, (rnd() - 0.5) * 0.5);
    g.add(b);
    mesh(b, new THREE.CylinderGeometry(0.12 * scale, 0.4 * scale, h, 6), m, 0, h / 2, 0);
    for (let k = 0; k < 3; k++) {
      const arm = mesh(b, new THREE.CylinderGeometry(0.08 * scale, 0.2 * scale, h * 0.5, 5), m, 0, h * (0.4 + k * 0.15), 0);
      arm.rotation.set((rnd() - 0.5) * 1.2, 0, (rnd() - 0.5) * 1.6);
      mesh(b, new THREE.SphereGeometry(0.26 * scale, 6, 5), m, Math.sin(arm.rotation.z) * -h * 0.25, h * (0.65 + k * 0.1), 0);
    }
  }
  if (rnd() < 0.6) {
    const c = colors[Math.floor(rnd() * colors.length)];
    const brain = mesh(g, new THREE.SphereGeometry(1.6 * scale, 12, 8), std(c, 0.1, 0.6, { emissive: c, emissiveIntensity: 0.18 }), 2 * scale, 0.5 * scale, 1 * scale);
    brain.scale.y = 0.6;
  }
  return g;
}

/** Translucent jellyfish with trailing tentacles, bobbing and pulsing. */
function jellyfish(ctx: Ctx, n: number, rMin: number, rMax: number, yMin: number, yMax: number, color: number, size: number) {
  const { root, rnd } = ctx;
  const items: { g: THREE.Group; bell: THREE.Mesh; y: number; ph: number; sp: number }[] = [];
  const bellMat = additive(color, 0.28, { side: THREE.DoubleSide });
  const rimMat = basic(color, { toneMapped: false });
  for (let i = 0; i < n; i++) {
    const a = rnd() * TAU, r = rMin + rnd() * (rMax - rMin), y = yMin + rnd() * (yMax - yMin), s = size * (0.7 + rnd() * 0.8);
    const g = new THREE.Group();
    g.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
    root.add(g);
    const bell = mesh(g, new THREE.SphereGeometry(s, 16, 10, 0, TAU, 0, Math.PI / 2), bellMat);
    mesh(g, new THREE.TorusGeometry(s, s * 0.04, 6, 24), rimMat, 0, 0, 0, Math.PI / 2);
    mesh(g, new THREE.SphereGeometry(s * 0.35, 8, 6), additive(color, 0.5), 0, s * 0.35, 0);
    for (let k = 0; k < 7; k++) {
      const ta = (k / 7) * TAU, len = s * (2.2 + rnd() * 1.6);
      mesh(g, new THREE.CylinderGeometry(s * 0.012, s * 0.03, len, 4), additive(color, 0.35), Math.cos(ta) * s * 0.7, -len / 2, Math.sin(ta) * s * 0.7);
    }
    glowSprite(g, color, s * 4.5, 0.18, 0, s * 0.2, 0);
    items.push({ g, bell, y, ph: rnd() * TAU, sp: 0.4 + rnd() * 0.4 });
  }
  ctx.on((_dt, t) => {
    for (const j of items) {
      const p = Math.sin(t * j.sp * 2.2 + j.ph);
      j.g.position.y = j.y + Math.sin(t * j.sp + j.ph) * 2.5;
      j.bell.scale.set(1 + p * 0.07, 1 - p * 0.1, 1 + p * 0.07);
    }
  });
}

/** Geodesic dome (triangles above the waterline of the floor only). */
function hemiGeodesic(r: number, detail: number) {
  const full = new THREE.IcosahedronGeometry(r, detail).toNonIndexed();
  const pos = full.attributes.position;
  const keep: number[] = [];
  for (let i = 0; i < pos.count; i += 3) {
    const cy = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3;
    if (cy < -2) continue;
    for (let k = 0; k < 3; k++) keep.push(pos.getX(i + k), pos.getY(i + k), pos.getZ(i + k));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(keep, 3));
  return g;
}

const hullShape = (len: number, w: number) => {
  const s = new THREE.Shape();
  s.moveTo(-len / 2, -w / 2);
  s.lineTo(len / 2 - w * 1.2, -w / 2);
  s.quadraticCurveTo(len / 2 + w * 0.4, -w * 0.3, len / 2 + w * 0.9, 0);
  s.quadraticCurveTo(len / 2 + w * 0.4, w * 0.3, len / 2 - w * 1.2, w / 2);
  s.lineTo(-len / 2, w / 2);
  s.closePath();
  return s;
};

// ───────────────────────────── SEC-22 沈没港湾 ─────────────────────────────
// Quay wall with toppled gantry cranes, rusted ship hulls half sunk, buoys on chains, bright shallow water.
function buildHarbor(ctx: Ctx) {
  const { root, rnd } = ctx;
  seaCommon(ctx, { floor: 0x3f7f86, shafts: 9, shaftOpacity: 0.085, caustic: 0.2, surface: 0.22, snow: 260 });
  const concrete = std(0x6f8a8c, 0.1, 0.85);
  const rust = std(0x7a4a34, 0.5, 0.7);
  const rustDark = std(0x4a2e22, 0.5, 0.75);
  const steel = std(0x8aa0a6, 0.7, 0.45);
  const teal = basic(0x5eead4, { toneMapped: false });
  // Quay along the north with mooring bollards and piles.
  box(root, 150, 9, 8, concrete, 0, 3.5, -62);
  box(root, 150, 1.2, 9, std(0x5a7476, 0.1, 0.8), 0, 8.4, -62);
  for (let x = -66; x <= 66; x += 11) {
    mesh(root, new THREE.CylinderGeometry(0.7, 0.9, 5, 8), steel, x, 11, -58.4);
    mesh(root, new THREE.CylinderGeometry(1.0, 1.0, 20, 8), std(0x3d4a44, 0.2, 0.9), x + 5.5, 4, -56);
  }
  // Gantry cranes: one standing, one fallen against the quay.
  const crane = (x: number, tilt: number) => {
    const g = new THREE.Group(); g.position.set(x, 8.4, -62); g.rotation.z = tilt; root.add(g);
    for (const s of [-1, 1]) {
      box(g, 1.4, 38, 1.4, rust, s * 7, 19, 0);
      for (let y = 4; y < 36; y += 6) box(g, 14.4, 0.5, 0.5, rustDark, 0, y, 0, 0, 0, 0);
    }
    box(g, 18, 2.6, 3, rust, 0, 38.5, 0);
    box(g, 4, 2.6, 46, rust, 0, 40, 18);
    for (let z = 0; z < 44; z += 4) box(g, 0.4, 3, 0.4, rustDark, 0, 40, z - 2, 0, 0, 0.6);
    box(g, 2.2, 3, 2.2, steel, 0, 36, 28);
    return g;
  };
  crane(-26, 0);
  crane(38, 1.1).position.x = 42;
  // Sunken ships: extruded hull, cabin, masts, glowing portholes.
  const ship = (x: number, z: number, ry: number, rz: number, len: number, w: number) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.set(0, ry, rz); root.add(g);
    mesh(g, new THREE.ExtrudeGeometry(hullShape(len, w), { depth: 11, bevelEnabled: false }), rust, 0, 1, 0, -Math.PI / 2, 0, 0);
    box(g, len * 0.22, 8, w * 0.7, rustDark, -len * 0.18, 12, 0);
    box(g, len * 0.1, 5, w * 0.5, rust, -len * 0.18, 18, 0);
    mesh(g, new THREE.CylinderGeometry(0.4, 0.55, 22, 6), steel, len * 0.12, 18, 0);
    mesh(g, new THREE.CylinderGeometry(0.3, 0.4, 16, 6), steel, -len * 0.38, 15, 0);
    mesh(g, new THREE.CylinderGeometry(2.4, 2.8, 10, 10), rustDark, -len * 0.05, 14, 0);
    for (let i = 0; i < 8; i++) glowSprite(g, 0x5eead4, 1.6, 0.7, -len * 0.3 + i * (len * 0.08), 9.5, w / 2 + 0.2);
    return g;
  };
  ship(78, 14, 0.5, 0.28, 62, 16);
  ship(-82, -18, -0.7, -0.2, 54, 14);
  ship(-18, 92, 1.4, 0.34, 66, 17);
  ship(30, -108, 0.1, 0.5, 70, 18);
  // Buoys riding on long chains.
  const buoys: THREE.Group[] = [];
  for (let i = 0; i < 9; i++) {
    const a = rnd() * TAU, r = 55 + rnd() * 40, h = 14 + rnd() * 26;
    const g = new THREE.Group(); g.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); root.add(g);
    mesh(g, new THREE.CylinderGeometry(0.1, 0.1, h, 4), std(0x2a3a3a, 0.8, 0.5), 0, h / 2, 0);
    const b = mesh(g, new THREE.SphereGeometry(1.6, 12, 8), std(i % 2 ? 0xdc2626 : 0xf8fafc, 0.2, 0.5), 0, h + 1, 0);
    mesh(g, new THREE.TorusGeometry(1.62, 0.2, 6, 16), std(0xf8fafc, 0.2, 0.5), 0, h + 1, 0, Math.PI / 2);
    glowSprite(g, 0xff4040, 3.5, 0.6, 0, h + 3, 0);
    buoys.push(g);
    void b;
  }
  kelp(ctx, 30, 46, 95, 8, 20, 0x2f9e6a);
  fishSchool(ctx, { count: 70, color: 0xd9f99d, c: [0, 12, 0], rx: 55, rz: 48, ry: 4, speed: 0.22, size: 0.8 });
  fishSchool(ctx, { count: 50, color: 0x7dd3fc, c: [10, 20, -10], rx: 70, rz: 62, ry: 6, speed: 0.15, size: 1.0, dir: -1 });
  ctx.on((_dt, t) => { buoys.forEach((b, i) => { b.rotation.z = Math.sin(t * 0.5 + i) * 0.04; b.rotation.x = Math.cos(t * 0.4 + i * 2) * 0.04; }); });
  void teal;
}

// ───────────────────────────── SEC-23 珊瑚ドーム街 ─────────────────────────────
// Glass geodesic dome over a living reef; jellyfish and colourful schools.
function buildReef(ctx: Ctx) {
  const { root, rnd } = ctx;
  seaCommon(ctx, { floor: 0xc9b99a, shafts: 8, shaftOpacity: 0.07, caustic: 0.24, snow: 150 });
  const frame = std(0xdfe9ec, 0.7, 0.3);
  // Geodesic dome and its glowing struts.
  const dome = hemiGeodesic(78, 2);
  mesh(root, dome, additive(0x7fe8dc, 0.05, { side: THREE.DoubleSide, fog: false }), 0, 0, 0);
  root.add(new THREE.LineSegments(new THREE.EdgesGeometry(dome, 1), new THREE.LineBasicMaterial({ color: 0xcffafe, transparent: true, opacity: 0.55, fog: false })));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    mesh(root, new THREE.CylinderGeometry(1.4, 2.0, 12, 6), frame, Math.cos(a) * 77, 5, Math.sin(a) * 77);
    glowSprite(root, 0x7fe8dc, 10, 0.3, Math.cos(a) * 75, 10, Math.sin(a) * 75);
  }
  // Coral reef in the ring between the walls and the dome.
  const cols = [0xfb7185, 0xfb923c, 0xc084fc, 0xf472b6, 0xfacc15, 0x2dd4bf];
  for (let i = 0; i < 46; i++) {
    const a = rnd() * TAU, r = 46 + rnd() * 26;
    coralCluster(root, rnd, Math.cos(a) * r, Math.sin(a) * r, 1.0 + rnd() * 1.4, cols);
  }
  // Giant sea-fan and anemone beds.
  for (let i = 0; i < 14; i++) {
    const a = rnd() * TAU, r = 44 + rnd() * 24;
    const fan = mesh(root, new THREE.CircleGeometry(3 + rnd() * 3, 14), additive(cols[i % cols.length], 0.55, { side: THREE.DoubleSide }), Math.cos(a) * r, 4, Math.sin(a) * r);
    fan.rotation.y = a + Math.PI / 2;
    fan.scale.y = 1.4;
  }
  kelp(ctx, 26, 45, 74, 6, 14, 0x34d399);
  jellyfish(ctx, 9, 50, 90, 12, 40, 0xf0abfc, 2.6);
  fishSchool(ctx, { count: 80, color: 0xfacc15, c: [0, 10, 0], rx: 56, rz: 52, ry: 3, speed: 0.2, size: 0.8 });
  fishSchool(ctx, { count: 60, color: 0xfb7185, c: [0, 16, 0], rx: 66, rz: 60, ry: 5, speed: 0.17, size: 0.9, dir: -1 });
  fishSchool(ctx, { count: 50, color: 0x38bdf8, c: [0, 24, 0], rx: 50, rz: 56, ry: 6, speed: 0.28, size: 0.7 });
  // Dome-wall plankton glow.
  particles(ctx, { count: 160, size: 0.35, color: 0xa7f3d0, opacity: 0.5, half: [60, 60], y: [1, 40], mode: 'drift', speed: 0.5, sway: 0.4 });
}

// ───────────────────────────── SEC-24 鯨骨の回廊 ─────────────────────────────
// A colossal whale skeleton: rib arches over the arena, spine and skull, bioluminescent specks.
function buildWhalefall(ctx: Ctx) {
  const { root, rnd } = ctx;
  seaCommon(ctx, { floor: 0x1c2e34, shafts: 3, shaftColor: 0x6bc6d8, shaftOpacity: 0.05, caustic: 0.08, snow: 520, snowColor: 0xc8e8f0 });
  const bone = std(0xd8d0bc, 0.05, 0.85, { emissive: 0x1a3a44, emissiveIntensity: 0.3 });
  const boneDark = std(0xa09a88, 0.05, 0.9);
  const glow = basic(0x67e8f9, { toneMapped: false });
  // Ribs: arches over the arena springing from a spine at x = -66.
  const buildSkeleton = (sx: number, dirX: number, R: number, count: number, zStep: number) => {
    for (let k = 0; k < count; k++) {
      const z = (k - (count - 1) / 2) * zStep;
      const r = R * (1 - Math.abs(k - (count - 1) / 2) * 0.07);
      const rib = mesh(root, new THREE.TorusGeometry(r, 1.3, 8, 28, Math.PI * 0.95), bone, sx + dirX * r, 0, z);
      rib.rotation.z = dirX > 0 ? Math.PI * 0.05 : 0;
      rib.scale.set(1, 1.15, 0.8);
      mesh(root, new THREE.CylinderGeometry(1.8, 2.3, 4, 8), boneDark, sx, 1.5, z);
      mesh(root, new THREE.SphereGeometry(3.2, 10, 8), bone, sx, 5, z).scale.set(0.8, 0.6, 1.0);
      glowSprite(root, 0x67e8f9, 3, 0.55, sx + dirX * 1.5, 3, z + 1.5);
    }
    box(root, 2.4, 2.4, count * zStep + 20, boneDark, sx, 0.8, 0);
  };
  buildSkeleton(-64, 1, 26, 9, 12);
  buildSkeleton(70, -1, 18, 7, 13);
  // Skull at the north end of the left skeleton.
  const skull = new THREE.Group(); skull.position.set(-56, 0, -76); skull.rotation.y = 0.3; root.add(skull);
  mesh(skull, new THREE.SphereGeometry(13, 18, 12), bone, 0, 8, 0).scale.set(1.2, 0.8, 1.6);
  box(skull, 16, 4, 26, boneDark, 0, 1.6, -18);
  for (let i = 0; i < 14; i++) mesh(skull, new THREE.ConeGeometry(0.6, 3, 5), bone, -6 + (i % 7) * 2, 3.2, -26 + Math.floor(i / 7) * 8, Math.PI);
  for (const s of [-1, 1]) { mesh(skull, new THREE.SphereGeometry(2.4, 10, 8), basic(0x020608), s * 9, 9, -8); glowSprite(skull, 0x67e8f9, 6, 0.45, s * 9, 9, -9); }
  // Scavengers glowing in the dark.
  const specks: THREE.Sprite[] = [];
  for (let i = 0; i < 40; i++) {
    const a = rnd() * TAU, r = 48 + rnd() * 60;
    specks.push(glowSprite(root, rnd() > 0.5 ? 0x67e8f9 : 0x5eead4, 1.4 + rnd() * 1.6, 0.7, Math.cos(a) * r, 1 + rnd() * 30, Math.sin(a) * r));
  }
  jellyfish(ctx, 5, 60, 100, 18, 45, 0x67e8f9, 2.0);
  fishSchool(ctx, { count: 36, color: 0x93c5fd, c: [0, 22, 0], rx: 62, rz: 58, ry: 5, speed: 0.12, size: 1.2 });
  ctx.on((_dt, t) => { specks.forEach((s, i) => { (s.material as THREE.SpriteMaterial).opacity = 0.35 + 0.4 * Math.sin(t * 1.2 + i * 1.7); }); });
  void glow;
}

// ───────────────────────────── SEC-25 熱水噴出域 ─────────────────────────────
// Black-smoker chimneys with glowing mouths, billowing sulfur smoke, tube-worm thickets.
function buildVents(ctx: Ctx) {
  const { root, rnd } = ctx;
  seaCommon(ctx, { floor: 0x2a2220, shafts: 0, snow: 220, snowColor: 0xffc9a0 });
  const rock = std(0x2d2522, 0.3, 0.95, { emissive: 0x4a1a08, emissiveIntensity: 0.25 });
  const crust = std(0x4a3a2c, 0.2, 0.9);
  const vents: { x: number; z: number; h: number }[] = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU + rnd() * 0.4, r = 56 + rnd() * 34, h = 16 + rnd() * 34;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const g = new THREE.Group(); g.position.set(x, 0, z); root.add(g);
    mesh(g, new THREE.CylinderGeometry(2 + rnd(), 6 + rnd() * 3, h, 9), rock, 0, h / 2, 0);
    for (let k = 0; k < 4; k++) mesh(g, new THREE.ConeGeometry(1.2, 4 + rnd() * 5, 6), crust, (rnd() - 0.5) * 7, 2, (rnd() - 0.5) * 7);
    mesh(g, new THREE.CylinderGeometry(2.6, 2.2, 0.6, 12), basic(0xff7a1a, { toneMapped: false }), 0, h + 0.1, 0);
    glowSprite(g, 0xff6a20, 16, 0.5, 0, h + 1, 0);
    if (i % 4 === 0) { const pl = new THREE.PointLight(0xff6a20, 2.4, 70); pl.position.set(x * 0.7, h * 0.7, z * 0.7); root.add(pl); }
    vents.push({ x, z, h });
  }
  // Smoke columns rising from every chimney.
  const SN = vents.length * 26;
  const sp = new Float32Array(SN * 3), ss = new Float32Array(SN);
  for (let i = 0; i < SN; i++) ss[i] = rnd();
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const smoke = new THREE.Points(sg, new THREE.PointsMaterial({ size: 12, map: softDot(), color: 0x4a3a34, transparent: true, opacity: 0.35, depthWrite: false, sizeAttenuation: true }));
  smoke.frustumCulled = false; root.add(smoke);
  const sg2 = new THREE.BufferGeometry(); sg2.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const embers = new THREE.Points(sg2, new THREE.PointsMaterial({ size: 1.1, map: softDot(), color: 0xff8a40, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
  embers.frustumCulled = false; root.add(embers);
  // Tube-worm thickets around the chimney bases.
  const worm = std(0xf1f5f9, 0.1, 0.6);
  const tip = basic(0xef4444, { toneMapped: false });
  for (let i = 0; i < 70; i++) {
    const a = rnd() * TAU, r = 46 + rnd() * 40, h = 2 + rnd() * 3.4;
    const g = new THREE.Group(); g.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); g.rotation.set((rnd() - 0.5) * 0.3, 0, (rnd() - 0.5) * 0.3); root.add(g);
    mesh(g, new THREE.CylinderGeometry(0.12, 0.18, h, 5), worm, 0, h / 2, 0);
    mesh(g, new THREE.SphereGeometry(0.2, 6, 5), tip, 0, h, 0);
  }
  ctx.on((_dt, t) => {
    for (let i = 0; i < SN; i++) {
      const v = vents[i % vents.length], s = ss[i];
      const f = (t * (0.07 + s * 0.05) + s) % 1;
      sp[i * 3] = v.x + Math.sin(s * 40 + t * 0.6) * (2 + f * 8);
      sp[i * 3 + 1] = v.h + f * 46;
      sp[i * 3 + 2] = v.z + Math.cos(s * 31 + t * 0.5) * (2 + f * 8);
    }
    sg.attributes.position.needsUpdate = true;
    sg2.attributes.position.needsUpdate = true;
    ctx.hemi.intensity = 0.8 + Math.sin(t * 0.9) * 0.05;
  });
}

// ───────────────────────────── SEC-26 深海水族館 ─────────────────────────────
// Giant viewing windows on all four sides, whale shark and rays drifting behind the glass, signage overhead.
function buildAquarium(ctx: Ctx) {
  const { root, rnd } = ctx;
  const C = 30; // ceiling
  const metal = std(0x1b2a38, 0.8, 0.4);
  const trim = basic(0x7dd3fc, { toneMapped: false });
  mesh(root, new THREE.PlaneGeometry(240, 240), std(0x061018, 0.5, 0.6), 0, C, 0, Math.PI / 2);
  mesh(root, new THREE.PlaneGeometry(260, 260), std(0x0a1822, 0.3, 0.8), 0, -0.4, 0, -Math.PI / 2);
  const tex = causticTexture(rnd);
  tex.repeat.set(10, 10);
  mesh(root, new THREE.PlaneGeometry(240, 240), additive(0x7dd3fc, 0.16, { map: tex, fog: false }), 0, C - 0.2, 0, Math.PI / 2);
  // Ceiling light bars.
  for (let x = -60; x <= 60; x += 20) box(root, 1.2, 0.3, 140, basic(0xe0f7ff, { toneMapped: false }), x, C - 0.4, 0);
  // Four tank windows (north/south/east/west).
  const fishDefs: { c: THREE.Vector3; dir: number }[] = [];
  const whaleSharks: THREE.Group[] = [];
  for (let k = 0; k < 4; k++) {
    const g = new THREE.Group(); g.rotation.y = (k * Math.PI) / 2; root.add(g);
    const Z = -46; // glass plane distance
    for (let x = -60; x <= 60; x += 20) {
      box(g, 1.6, C, 1.6, metal, x, C / 2, Z);
      box(g, 0.3, C - 5, 0.3, trim, x + 0.9, C / 2, Z + 0.6);
    }
    box(g, 130, 1.4, 1.8, metal, 0, 5.2, Z);
    box(g, 130, 1.2, 1.8, metal, 0, C - 0.4, Z);
    mesh(g, new THREE.PlaneGeometry(130, C - 6), additive(0x1d6fa0, 0.22, { side: THREE.DoubleSide }), 0, (C + 5.2) / 2, Z - 0.4);
    // Water body behind the glass, lit from above.
    mesh(g, new THREE.PlaneGeometry(130, C - 6), new THREE.MeshBasicMaterial({ color: 0x0a4a6e, transparent: true, opacity: 0.75, depthWrite: false }), 0, (C + 5.2) / 2, Z - 32);
    const sun = new THREE.Vector3(0, C, Z - 8);
    beam(g, sun.clone().add(new THREE.Vector3(-20, 0, 0)), new THREE.Vector3(-34, 4, Z - 20), 1, 10, 0xbff0ff, 0.09);
    beam(g, sun.clone().add(new THREE.Vector3(24, 0, 0)), new THREE.Vector3(10, 4, Z - 22), 1, 9, 0xbff0ff, 0.08);
    // Rockwork and coral inside the tank.
    for (let i = 0; i < 6; i++) mesh(g, new THREE.DodecahedronGeometry(3 + rnd() * 4, 0), std(0x24404a, 0.1, 0.9), -50 + i * 20 + rnd() * 6, 2, Z - 18 - rnd() * 10);
    // Whale shark (or manta) crossing the tank.
    const body = new THREE.Group(); g.add(body); whaleSharks.push(body);
    const skin = std(0x3a5666, 0.1, 0.6);
    mesh(body, new THREE.SphereGeometry(1, 16, 10), skin).scale.set(9, 2.4, 2.6);
    mesh(body, new THREE.ConeGeometry(1.2, 6, 6), skin, -10, 0.2, 0, 0, 0, Math.PI / 2);
    mesh(body, new THREE.ConeGeometry(0.8, 5, 4), skin, -13, 1.8, 0, 0, 0, Math.PI / 2 - 0.5);
    mesh(body, new THREE.ConeGeometry(0.6, 4, 4), skin, 0, 2.6, 0).scale.set(1, 1, 0.4);
    for (let i = 0; i < 16; i++) glowSprite(body, 0xe0f2fe, 0.7, 0.8, -6 + rnd() * 12, (rnd() - 0.2) * 2.2, (rnd() - 0.5) * 3.4);
    body.userData = { k, ph: rnd() * 6 };
    fishDefs.push({ c: new THREE.Vector3(0, 14, Z - 20), dir: 1 });
  }
  const fishLayers = [0xfacc15, 0x7dd3fc, 0xfb7185, 0xa7f3d0];
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2;
    const cx = Math.sin(a) * -66, cz = Math.cos(a) * -66;
    fishSchool(ctx, { count: 50, color: fishLayers[k], c: [cx, 14, cz], rx: Math.abs(Math.cos(a)) > 0.5 ? 40 : 6, rz: Math.abs(Math.cos(a)) > 0.5 ? 6 : 40, ry: 4, speed: 0.3, size: 0.8, dir: k % 2 ? -1 : 1 });
  }
  // Signage hanging from the ceiling.
  const sign = canvasTex(1024, 256, (c) => {
    c.fillStyle = '#04141f'; c.fillRect(0, 0, 1024, 256);
    c.strokeStyle = '#38bdf8'; c.lineWidth = 8; c.shadowColor = '#38bdf8'; c.shadowBlur = 26; c.strokeRect(14, 14, 996, 228);
    c.fillStyle = '#e0f7ff'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = 'bold 110px "Noto Sans JP", sans-serif'; c.fillText('深海水族館', 512, 100);
    c.font = 'bold 60px monospace'; c.fillStyle = '#38bdf8'; c.fillText('ABYSS AQUARIUM', 512, 190);
  });
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2;
    const s = mesh(root, new THREE.PlaneGeometry(26, 6.5), basic(0xffffff, { map: sign, toneMapped: false }), Math.sin(a) * -43, 22, Math.cos(a) * -43, 0, a, 0);
    s.rotation.y = a;
  }
  particles(ctx, { count: 200, size: 0.12, color: 0xbff0ff, opacity: 0.5, half: [38, 38], y: [0.5, 28], mode: 'drift', speed: 0.4, sway: 0.3 });
  ctx.on((_dt, t) => {
    tex.offset.set(t * 0.02, t * 0.012);
    whaleSharks.forEach((b, i) => {
      const f = ((t * 0.035 + b.userData.ph * 0.1 + i * 0.25) % 1);
      b.position.set(-70 + f * 140, 12 + Math.sin(t * 0.4 + i) * 2.5, -64);
      b.rotation.y = 0; b.rotation.z = Math.sin(t * 0.8 + i) * 0.04;
    });
  });
  void fishDefs;
  void WALL;
}

// ───────────────────────────── SEC-27 発光海溝 ─────────────────────────────
// Pitch-dark trench: huge glowing jellyfish, angler lures and a vast presence watching from the dark.
function buildTrench(ctx: Ctx) {
  const { root, rnd } = ctx;
  seaCommon(ctx, { floor: 0x0a0e1c, snow: 420, snowColor: 0x9db4ff });
  const rock = std(0x101426, 0.3, 0.95, { emissive: 0x1a2060, emissiveIntensity: 0.25 });
  // Canyon walls with luminous mineral veins.
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * TAU, r = 78 + rnd() * 16, h = 30 + rnd() * 50;
    const m = mesh(root, new THREE.CylinderGeometry(4 + rnd() * 6, 8 + rnd() * 6, h, 6), rock, Math.cos(a) * r, h / 2 - 4, Math.sin(a) * r);
    m.rotation.y = rnd() * TAU;
    for (let k = 0; k < 3; k++) glowSprite(root, rnd() > 0.5 ? 0x6366f1 : 0x22d3ee, 3 + rnd() * 4, 0.55, Math.cos(a) * (r - 6), 4 + rnd() * h * 0.8, Math.sin(a) * (r - 6));
  }
  jellyfish(ctx, 8, 50, 105, 14, 55, 0x22d3ee, 5.5);
  jellyfish(ctx, 6, 55, 105, 20, 60, 0x818cf8, 4.5);
  // Angler lures: twin glowing spheres on a stalk, blinking.
  const lures: THREE.Sprite[] = [];
  for (let i = 0; i < 14; i++) {
    const a = rnd() * TAU, r = 55 + rnd() * 50, y = 6 + rnd() * 28, x = Math.cos(a) * r, z = Math.sin(a) * r;
    lures.push(glowSprite(root, 0xfde68a, 3.2, 0.9, x, y, z));
    glowSprite(root, 0xfde68a, 11, 0.12, x, y, z);
  }
  // The watcher: two vast eyes in the far dark.
  const eyes = new THREE.Group(); eyes.position.set(8, 34, -128); root.add(eyes);
  mesh(eyes, new THREE.SphereGeometry(58, 16, 10), basic(0x02030a), 0, -10, -10);
  const eyeMats: THREE.SpriteMaterial[] = [];
  for (const s of [-1, 1]) {
    const e = glowSprite(eyes, 0x22d3ee, 22, 0.85, s * 20, 6, 52);
    glowSprite(eyes, 0xffffff, 6, 0.9, s * 20, 6, 52.5);
    glowSprite(eyes, 0x22d3ee, 60, 0.12, s * 20, 6, 52);
    eyeMats.push(e.material as THREE.SpriteMaterial);
  }
  // Drifting bioluminescent specks.
  particles(ctx, { count: 320, size: 0.5, color: 0x5eead4, opacity: 0.6, half: [70, 70], y: [1, 50], mode: 'drift', speed: 0.7, sway: 0.7 });
  particles(ctx, { count: 160, size: 0.4, color: 0x818cf8, opacity: 0.6, half: [70, 70], y: [1, 50], mode: 'drift', speed: 0.6, sway: 0.6 });
  ctx.on((_dt, t) => {
    lures.forEach((l, i) => { (l.material as THREE.SpriteMaterial).opacity = Math.sin(t * 1.3 + i * 2.1) > -0.3 ? 0.9 : 0.1; });
    const blink = (t % 11) > 10.6 ? 0.05 : 1;
    eyeMats.forEach((m) => { m.opacity = 0.85 * blink; });
    eyes.position.x = 8 + Math.sin(t * 0.1) * 6;
  });
}

// ───────────────────────────── SEC-28 潮流の聖域 ─────────────────────────────
// Sunken temple: fluted colonnades, a trident statue, tidal rings turning behind the sanctum.
function buildSanctum(ctx: Ctx) {
  const { root, rnd } = ctx;
  seaCommon(ctx, { floor: 0x4a7a7c, shafts: 7, shaftColor: 0xc8fff4, shaftOpacity: 0.09, caustic: 0.26, surface: 0.2, snow: 280 });
  const stone = std(0x7fa4a6, 0.1, 0.85, { emissive: 0x0d3a40, emissiveIntensity: 0.25 });
  const stoneDark = std(0x4a6c70, 0.1, 0.9);
  const teal = basic(0x2dd4bf, { toneMapped: false });
  const rose = basic(0xfb7185, { toneMapped: false });
  // Colonnades along the east and west with broken tops and coral growth.
  const caps: THREE.Object3D[] = [];
  for (const s of [-1, 1]) for (let z = -70; z <= 70; z += 14) {
    const h = 24 + (Math.abs(z) % 3) * 3 - (rnd() > 0.7 ? 9 : 0);
    const g = new THREE.Group(); g.position.set(s * 56, 0, z); root.add(g);
    mesh(g, new THREE.CylinderGeometry(3.0, 3.4, h, 14), stone, 0, h / 2, 0);
    for (let k = 0; k < 10; k++) { const a = (k / 10) * TAU; box(g, 0.3, h, 0.6, stoneDark, Math.cos(a) * 3.1, h / 2, Math.sin(a) * 3.1, 0, -a, 0); }
    box(g, 8, 1.6, 8, stoneDark, 0, 0.8, 0);
    box(g, 7.4, 1.6, 7.4, stoneDark, 0, h + 0.8, 0);
    mesh(g, new THREE.TorusGeometry(3.1, 0.18, 6, 24), teal, 0, h * 0.6, 0, Math.PI / 2);
    caps.push(g);
  }
  for (let i = 0; i < 22; i++) {
    const a = rnd() * TAU, r = 50 + rnd() * 40;
    coralCluster(root, rnd, Math.cos(a) * r, Math.sin(a) * r, 1.1 + rnd(), [0xfb7185, 0xf472b6, 0x2dd4bf, 0xfdba74]);
  }
  // Trident statue behind the north wall.
  const tri = new THREE.Group(); tri.position.set(0, 0, -86); root.add(tri);
  box(tri, 22, 4, 22, stoneDark, 0, 2, 0);
  box(tri, 14, 4, 14, stone, 0, 6, 0);
  mesh(tri, new THREE.CylinderGeometry(1.8, 2.4, 52, 10), stone, 0, 34, 0);
  mesh(tri, new THREE.TorusGeometry(5, 0.7, 8, 24, Math.PI), stone, 0, 60, 0, 0, 0, Math.PI);
  for (const x of [-5, 0, 5]) mesh(tri, new THREE.ConeGeometry(x === 0 ? 1.4 : 1.1, x === 0 ? 14 : 10, 6), stone, x, x === 0 ? 66 : 63, 0);
  mesh(tri, new THREE.SphereGeometry(2.4, 14, 10), teal, 0, 40, 4);
  glowSprite(tri, 0x2dd4bf, 30, 0.5, 0, 40, 4);
  for (let y = 12; y < 56; y += 8) mesh(tri, new THREE.TorusGeometry(2.1, 0.12, 6, 20), rose, 0, y, 0, Math.PI / 2);
  // Tidal rings turning behind the statue.
  const rings: THREE.Mesh[] = [];
  [28, 38, 48].forEach((R, i) => {
    const r = mesh(tri, new THREE.TorusGeometry(R, 0.5, 8, 72), i === 1 ? rose : teal, 0, 42, -14 - i * 1.2);
    for (let k = 0; k < 24; k++) { const a = (k / 24) * TAU; glowSprite(r, 0xc8fff4, 2.4, 0.7, Math.cos(a) * R, Math.sin(a) * R, 0); }
    rings.push(r);
  });
  // Big central god-ray.
  beam(root, new THREE.Vector3(0, 95, -20), new THREE.Vector3(0, -2, -20), 6, 24, 0xe0fff9, 0.1);
  kelp(ctx, 18, 46, 80, 8, 18, 0x2f9e8a);
  fishSchool(ctx, { count: 60, color: 0xfde68a, c: [0, 18, 0], rx: 62, rz: 56, ry: 6, speed: 0.18, size: 0.9 });
  jellyfish(ctx, 4, 60, 100, 24, 50, 0xfda4af, 3.2);
  ctx.on((_dt, t) => {
    rings.forEach((r, i) => { r.rotation.z = t * (0.12 + i * 0.05) * (i % 2 ? -1 : 1); });
    ctx.hemi.intensity = 0.75 + Math.sin(t * 0.8) * 0.06;
  });
  void catenary;
}

export const ABYSS_BUILDERS: Record<AbyssId, (ctx: Ctx) => void> = {
  harbor: buildHarbor, reef: buildReef, whalefall: buildWhalefall, vents: buildVents,
  aquarium: buildAquarium, trench: buildTrench, sanctum: buildSanctum,
};
