import * as THREE from 'three';
import { createRig, EnemyRig } from './enemyAnimation';
import { kit, EliteStats } from './eliteEnemyModels';
import { digitTexture, digitMaterial } from './neonFx';

/**
 * MAP 10 (NEON DISTRICT) roster: machines born from the city's data, wrapped in neon light and holograms.
 * Each type reuses the movement / attack AI of a base category (see ENEMY_BASE_CATEGORY in BattleScene3D) and
 * only brings its own body, so they all animate through the generic rig (legs, arms, head, spinners ...).
 *
 *   glitchling   GLITCH SPRITE    グリッチスプライト   (drone AI)
 *   neonhound    NEON HOUND       ネオンの猟犬機       (hound AI)
 *   cipher       CIPHER BLADE     暗号の暗殺機         (stalker AI)
 *   signaltower  SIGNAL TOWER     信号塔の砲台         (sentry AI)
 *   mainframe    MAINFRAME GOLEM  メインフレーム巨兵   (golem AI)
 *
 * Every model faces -Z with its feet on y = 0 (flying types are centred on their origin).
 */

export const NEON_TYPES = ['glitchling', 'neonhound', 'cipher', 'signaltower', 'mainframe'] as const;
export type NeonType = (typeof NEON_TYPES)[number];
export const isNeonType = (t: string): t is NeonType => (NEON_TYPES as readonly string[]).includes(t);

// ───────────────────────── textures / materials ─────────────────────────
let hullTex: THREE.CanvasTexture | null = null;
/** Near-black navy plating with thin neon trace lines. */
function hullTexture(): THREE.CanvasTexture {
  if (hullTex) return hullTex;
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  g.fillStyle = '#2a2a4a';
  g.fillRect(0, 0, S, S);
  for (let i = 0; i < 220; i++) {
    g.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,0.3)' : 'rgba(150,140,230,0.14)';
    g.fillRect(Math.random() * S, Math.random() * S, 2 + Math.random() * 14, 1 + Math.random() * 3);
  }
  const traces = (col: string, n: number) => {
    g.strokeStyle = col;
    g.lineWidth = 2;
    for (let i = 0; i < n; i++) {
      let x = Math.random() * S, y = Math.random() * S;
      g.beginPath();
      g.moveTo(x, y);
      for (let k = 0; k < 4; k++) {
        if (k % 2) y += (Math.random() - 0.5) * 80; else x += (Math.random() - 0.5) * 100;
        g.lineTo(x, y);
      }
      g.stroke();
    }
  };
  traces('rgba(232,121,249,0.85)', 5);
  traces('rgba(103,232,249,0.85)', 5);
  g.strokeStyle = 'rgba(0,0,0,0.5)';
  g.lineWidth = 3;
  g.strokeRect(2, 2, S - 4, S - 4);
  hullTex = new THREE.CanvasTexture(c);
  hullTex.colorSpace = THREE.SRGBColorSpace;
  hullTex.wrapS = hullTex.wrapT = THREE.RepeatWrapping;
  return hullTex;
}

function neonKit() {
  const K = kit();
  const tex = hullTexture();
  const holo = (color: number, opacity = 0.4) =>
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const m = {
    hull: K.armor(0x7a78a8, tex, 0.4, 0.45, 0.4),
    hullDark: K.armor(0x4a4878, tex, 0.45, 0.45, 0.2),
    steel: K.solid(0x9a98c0, 0.85, 0.28),
    steelDark: K.solid(0x1c1c34, 0.8, 0.4),
    magenta: K.glow(0xe879f9),
    cyan: K.glow(0x67e8f9),
    violet: K.glow(0xa78bfa),
    pink: K.glow(0xf472b6),
    white: K.glow(0xf5f3ff),
    green: K.glow(0x4ade80),
    magentaHalo: K.halo(0xe879f9, 0.26),
    cyanHalo: K.halo(0x67e8f9, 0.24),
    holoCyan: holo(0x67e8f9, 0.32),
    holoMagenta: holo(0xe879f9, 0.32),
    holoViolet: holo(0xa78bfa, 0.3),
  };
  return { K, m, holo };
}

/** Cone with its base at `base` and its tip along `dir`. */
function spike(parent: THREE.Object3D, base: THREE.Vector3, dir: THREE.Vector3, r: number, h: number, mat: THREE.Material, seg = 5) {
  const d = dir.clone().normalize();
  const mesh = new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), mat);
  mesh.position.copy(base).addScaledVector(d, h / 2);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
  parent.add(mesh);
  return mesh;
}

/** Flat screen showing green digit columns (double sided, additive). */
function digitScreen(parent: THREE.Object3D, w: number, h: number, x: number, y: number, z: number, seed: number, ry = 0) {
  const tex = digitTexture(6, 14, seed);
  const geo = new THREE.PlaneGeometry(w, h);
  const scr = new THREE.Mesh(geo, digitMaterial(tex, 0.95));
  scr.position.set(x, y, z);
  scr.rotation.y = ry;
  parent.add(scr);
  return scr;
}

// ───────────────────────── GLITCH SPRITE ─────────────────────────
function buildGlitchling(root: THREE.Group, rig: EnemyRig): EliteStats {
  const { K, m } = neonKit();
  const { rbox, box, sph, cyl, V, mk, grp } = K;
  const body = new THREE.Group();
  root.add(body);
  rig.body = body;

  // a bright core ringed by drifting pixel cubes (a loose, glitching cube-cloud)
  const core = mk(body, sph(0.17, 12), m.white);
  mk(body, sph(0.3, 12), m.magentaHalo);
  rig.pulses.push({ obj: core, amp: 1.5, speed: 1.5 });
  const cubes: [number, number, number, number][] = [
    [0.34, 0.08, -0.1, 0.17], [-0.36, -0.04, 0.0, 0.15], [0.05, 0.36, 0.06, 0.14], [-0.1, -0.34, -0.06, 0.16],
    [0.2, -0.22, 0.28, 0.12], [-0.24, 0.24, -0.28, 0.12], [0.3, 0.3, 0.2, 0.1], [-0.3, -0.3, 0.2, 0.1],
  ];
  cubes.forEach(([x, y, z, s], i) => {
    const g = grp(body, x, y, z, i * 0.4, i * 0.7, 0);
    mk(g, rbox(s * 2, s * 2, s * 2, s * 0.3), i % 2 ? m.hullDark : m.hull);
    mk(g, box(s * 2.06, s * 0.2, s * 2.06), i % 3 === 0 ? m.cyan : i % 3 === 1 ? m.magenta : m.violet, 0, s * 0.4, 0);
    rig.flutters.push({ obj: g, phase: i * 0.9, amp: 1.4 });
  });
  // a front screen flashing digits at the target
  digitScreen(body, 0.34, 0.34, 0, 0.02, -0.46, 3);
  const eye = mk(body, cyl(0.07, 0.07, 0.04, 12), m.cyan, 0, 0.02, -0.42, Math.PI / 2, 0, 0);
  rig.pulses.push({ obj: eye, amp: 1.6, speed: 1.9 });
  // orbit rings (spinning)
  const ring = grp(body, 0, 0, 0, 0.5, 0, 0.3);
  mk(ring, K.torus(0.5, 0.016, 8, 40), m.holoCyan, 0, 0, 0, Math.PI / 2, 0, 0);
  rig.spinners.push({ obj: ring, axis: 'y', speed: 4 });
  const ring2 = grp(body, 0, 0, 0, -0.4, 0, -0.5);
  mk(ring2, K.torus(0.42, 0.014, 8, 36), m.holoMagenta, 0, 0, 0, Math.PI / 2, 0, 0);
  rig.spinners.push({ obj: ring2, axis: 'y', speed: -5.5 });
  rig.hover = { bob: 0.1, tilt: 0.06 };
  rig.lunge = 0.2;
  void V;
  return { hp: 100, speed: 5.6, damage: 16 };
}

// ───────────────────────── NEON HOUND ─────────────────────────
function buildNeonHound(root: THREE.Group, rig: EnemyRig): EliteStats {
  const { K, m } = neonKit();
  const { rbox, box, cone, sph, V, mk, grp, artic } = K;
  const body = new THREE.Group();
  root.add(body);
  rig.body = body;

  mk(body, rbox(0.54, 0.34, 1.15, 0.12), m.hullDark, 0, 0.8, 0.05);
  mk(body, rbox(0.6, 0.24, 0.6, 0.1), m.hull, 0, 0.9, -0.3, 0.1, 0, 0);
  mk(body, rbox(0.48, 0.2, 0.5, 0.08), m.hull, 0, 0.96, 0.3);
  // neon racing stripes down both flanks and the spine
  for (const s of [-1, 1]) {
    mk(body, box(0.03, 0.04, 1.0), s > 0 ? m.magenta : m.cyan, s * 0.28, 0.82, 0.05);
    mk(body, box(0.03, 0.04, 0.5), s > 0 ? m.cyan : m.magenta, s * 0.28, 0.72, 0.05);
  }
  mk(body, box(0.05, 0.03, 0.9), m.violet, 0, 1.08, 0.05);
  // ghost afterimages: translucent copies trailing behind it
  for (let i = 1; i <= 2; i++) {
    const gh = mk(body, rbox(0.5, 0.3, 1.0, 0.1), i === 1 ? m.holoCyan : m.holoMagenta, 0, 0.8, 0.05 + i * 0.35);
    rig.flutters.push({ obj: gh, phase: i * 1.3, amp: 0.8 });
  }
  const core = mk(body, sph(0.1, 10), m.white, 0, 0.82, -0.02);
  mk(body, sph(0.2, 10), m.magentaHalo, 0, 0.82, -0.02);
  rig.pulses.push({ obj: core, amp: 1.4 });
  // head with a visor and swept antenna blades
  const head = grp(body, 0, 0.96, -0.7);
  rig.head = head;
  mk(head, rbox(0.3, 0.26, 0.46, 0.1), m.hull);
  mk(head, rbox(0.22, 0.14, 0.34, 0.06), m.hullDark, 0, -0.04, -0.34);
  mk(head, box(0.24, 0.05, 0.04), m.cyan, 0, 0.05, -0.23);
  [-1, 1].forEach((s) => spike(head, V(s * 0.1, 0.1, 0.1), V(s * 0.4, 0.5, 1), 0.03, 0.46, s > 0 ? m.magenta : m.cyan, 4));
  const jaw = grp(head, 0, -0.1, -0.05);
  rig.jaw = jaw;
  mk(jaw, rbox(0.2, 0.07, 0.32, 0.03), m.hullDark, 0, -0.03, -0.2);
  mk(jaw, box(0.16, 0.02, 0.26), m.magenta, 0, 0.01, -0.2);
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
    const hip = V(sx * 0.24, 0.78, sz * 0.4), knee = V(sx * 0.36, 0.5, sz * 0.46), foot = V(sx * 0.3, 0.04, sz * 0.52);
    const j = artic(root, hip, knee, foot, 0.06, 0.045, m.hull, m.hullDark, 0.07, sx > 0 ? m.magenta : m.cyan);
    j.onLow(cone(0.055, 0.24, 4), m.steel, foot.x, 0.1, foot.z - 0.1, -Math.PI / 2, 0, 0);
    rig.legs.push({ up: j.up, low: j.low, phase: sx * sz > 0 ? 0 : Math.PI, amp: 0.85 });
  });
  const tail = grp(body, 0, 0.9, 0.6);
  for (let i = 0; i < 4; i++) mk(tail, box(0.05, 0.02, 0.2), i % 2 ? m.magenta : m.cyan, 0, -0.05 * i, 0.2 + i * 0.2);
  const tip = mk(tail, sph(0.07, 8), m.white, 0, -0.2, 1.0);
  mk(tail, sph(0.16, 8), m.cyanHalo, 0, -0.2, 1.0);
  rig.pulses.push({ obj: tip, amp: 1.2, phase: 1 });
  rig.tails.push({ obj: tail, phase: 0.6, amp: 1.2 });
  rig.gait = { freq: 1.45, swing: 0.9, knee: 0.9, bob: 0.05, lean: 0.07 };
  rig.lunge = 0.4;
  return { hp: 220, speed: 7.2, damage: 22 };
}

// ───────────────────────── CIPHER BLADE ─────────────────────────
function buildCipher(root: THREE.Group, rig: EnemyRig): EliteStats {
  const { K, m, holo } = neonKit();
  const { rbox, box, sph, cone, V, mk, grp, artic, blade } = K;
  const body = new THREE.Group();
  root.add(body);
  rig.body = body;

  mk(body, rbox(0.4, 0.68, 0.24, 0.1), m.hullDark, 0, 1.28, 0);
  mk(body, rbox(0.48, 0.18, 0.28, 0.08), m.hull, 0, 1.56, 0);
  mk(body, rbox(0.28, 0.22, 0.22, 0.08), m.steelDark, 0, 0.88, 0);
  const core = mk(body, sph(0.08, 10), m.white, 0, 1.3, -0.13);
  mk(body, sph(0.17, 10), m.magentaHalo, 0, 1.3, -0.14);
  rig.pulses.push({ obj: core, amp: 1.4 });
  mk(body, box(0.3, 0.025, 0.03), m.cyan, 0, 1.46, -0.13);
  mk(body, box(0.3, 0.025, 0.03), m.magenta, 0, 1.14, -0.13);
  // masked head: a visor that shows scrolling digits
  const head = grp(body, 0, 1.82, -0.02);
  rig.head = head;
  mk(head, rbox(0.24, 0.26, 0.24, 0.08), m.hull);
  digitScreen(head, 0.16, 0.12, 0, 0.02, -0.13, 5);
  spike(head, V(0, 0.12, 0.04), V(0, 0.7, 1), 0.05, 0.36, m.magenta, 4);
  // arms ending in translucent hologram blades
  [-1, 1].forEach((s) => {
    const arm = artic(body, V(s * 0.31, 1.55, 0), V(s * 0.41, 1.12, -0.1), V(s * 0.37, 0.86, -0.3), 0.046, 0.038, m.hullDark, m.hull, 0.052, s > 0 ? m.magenta : m.cyan);
    arm.onLow(blade(1.15, 0.2, 0.03), holo(s > 0 ? 0xe879f9 : 0x67e8f9, 0.55), s * 0.37, 0.86, -0.34, -Math.PI / 2 + 0.2, 0, 0);
    arm.onLow(blade(1.05, 0.05, 0.04), m.white, s * 0.37, 0.86, -0.36, -Math.PI / 2 + 0.2, 0, 0);
    rig.arms.push({ up: arm.up, low: arm.low, phase: s < 0 ? Math.PI : 0, amp: 0.9 });
    const leg = artic(root, V(s * 0.14, 0.8, 0), V(s * 0.21, 0.45, -0.14), V(s * 0.17, 0.04, 0.04), 0.062, 0.046, m.hull, m.steelDark, 0.062, s > 0 ? m.cyan : m.magenta);
    leg.onLow(cone(0.052, 0.24, 4), m.steel, s * 0.17, 0.05, -0.12, -Math.PI / 2, 0, 0);
    rig.legs.push({ up: leg.up, low: leg.low, phase: s < 0 ? 0 : Math.PI, amp: 1 });
  });
  // encrypted cloak: a few translucent strips carrying digits that flutter behind
  for (let i = 0; i < 5; i++) {
    const sp = grp(body, (i - 2) * 0.1, 1.56 - Math.abs(i - 2) * 0.06, 0.15);
    const strip = mk(sp, new THREE.PlaneGeometry(0.09, 0.8 + (i % 2) * 0.2), digitMaterial(digitTexture(1, 12, 7 + i), 0.85), 0, -0.4, 0.1, 0.2, 0, 0);
    void strip;
    rig.flutters.push({ obj: sp, phase: i * 0.8, amp: 1.5 });
  }
  rig.gait = { freq: 1.4, swing: 0.85, knee: 1.0, bob: 0.07, lean: 0.09 };
  rig.lunge = 0.35;
  void box;
  return { hp: 180, speed: 7.6, damage: 30 };
}

// ───────────────────────── SIGNAL TOWER ─────────────────────────
function buildSignalTower(root: THREE.Group, rig: EnemyRig): EliteStats {
  const { K, m } = neonKit();
  const { cyl, sph, cone, torus, box, V, mk, grp, artic } = K;
  const body = new THREE.Group();
  root.add(body);
  rig.body = body;

  mk(body, cyl(0.54, 0.76, 0.22, 10), m.hullDark, 0, 0.11, 0);
  mk(body, torus(0.64, 0.03, 8, 10), m.magenta, 0, 0.24, 0, Math.PI / 2, 0, 0);
  for (let i = 0; i < 3; i++) { // tripod legs
    const a = (i / 3) * Math.PI * 2 + Math.PI / 2;
    const ca = Math.cos(a), sa = Math.sin(a);
    const j = artic(root, V(ca * 0.3, 0.42, sa * 0.3), V(ca * 0.7, 0.52, sa * 0.7), V(ca * 0.9, 0.04, sa * 0.9), 0.06, 0.048, m.steel, m.hullDark, 0.06, m.cyan);
    j.onLow(cone(0.09, 0.2, 5), m.steelDark, ca * 0.92, 0.06, sa * 0.92, Math.PI, 0, 0);
    rig.legs.push({ up: j.up, low: j.low, phase: i * ((Math.PI * 2) / 3), amp: 0.55 });
  }
  mk(body, cyl(0.2, 0.3, 0.5, 8), m.steel, 0, 0.47, 0);

  const head = grp(body, 0, 1.0, 0);
  rig.scanners.push({ obj: head, phase: 0, amp: 1 });
  // a mini electronic billboard on a mast
  mk(head, cyl(0.28, 0.34, 0.18, 12), m.hull, 0, 0.06, 0);
  mk(head, cyl(0.05, 0.07, 0.9, 8), m.steel, 0, 0.55, 0);
  mk(head, K.rbox(0.9, 0.62, 0.1, 0.05), m.steelDark, 0, 0.92, 0);
  for (const sz of [-1, 1]) digitScreen(head, 0.8, 0.52, 0, 0.92, sz * 0.07, 11, sz > 0 ? 0 : Math.PI);
  mk(head, box(0.96, 0.04, 0.12), m.magenta, 0, 1.25, 0);
  mk(head, box(0.96, 0.04, 0.12), m.cyan, 0, 0.59, 0);
  mk(head, box(0.04, 0.7, 0.12), m.magenta, -0.47, 0.92, 0);
  mk(head, box(0.04, 0.7, 0.12), m.cyan, 0.47, 0.92, 0);
  // antenna spire with a pulsing beacon
  spike(head, V(0, 1.25, 0), V(0, 1, 0), 0.03, 0.55, m.steel, 6);
  const beacon = mk(head, sph(0.1, 10), m.white, 0, 1.85, 0);
  mk(head, sph(0.24, 10), m.magentaHalo, 0, 1.85, 0);
  rig.pulses.push({ obj: beacon, amp: 1.6, speed: 1.7 });
  // data cannon
  const gun = grp(head);
  rig.recoils.push({ obj: gun, amp: 0.8 });
  mk(gun, cyl(0.07, 0.1, 0.8, 10), m.steel, 0, 0.2, -0.5, Math.PI / 2, 0, 0);
  mk(gun, cyl(0.13, 0.13, 0.12, 10), m.steelDark, 0, 0.2, -0.92, Math.PI / 2, 0, 0);
  mk(gun, torus(0.11, 0.025, 8, 14), m.green, 0, 0.2, -0.99);
  rig.pulses.push({ obj: mk(gun, sph(0.08, 8), m.green, 0, 0.2, -0.97), amp: 2 });
  rig.gait = { freq: 0.8, swing: 0.5, knee: 0.5, bob: 0.015, lean: 0.02 };
  rig.lunge = 0.08;
  return { hp: 210, speed: 4.1, damage: 36 };
}

// ───────────────────────── MAINFRAME GOLEM ─────────────────────────
function buildMainframe(root: THREE.Group, rig: EnemyRig): EliteStats {
  const { K, m } = neonKit();
  const { rbox, box, sph, cone, cyl, V, mk, grp, artic, tube } = K;
  const body = new THREE.Group();
  root.add(body);
  rig.body = body;

  mk(body, rbox(1.2, 0.5, 0.85, 0.15), m.hullDark, 0, 1.1, 0);
  // torso: a server rack with rows of blinking LED strips
  mk(body, rbox(1.4, 1.7, 0.9, 0.12), m.hullDark, 0, 2.0, 0);
  for (let i = 0; i < 7; i++) {
    const y = 1.35 + i * 0.22;
    mk(body, rbox(1.2, 0.17, 0.08, 0.03), m.steelDark, 0, y, -0.47);
    for (let k = 0; k < 4; k++) {
      const led = mk(body, box(0.14 + (k % 2) * 0.1, 0.04, 0.03), (i + k) % 3 === 0 ? m.magenta : (i + k) % 3 === 1 ? m.cyan : m.green, -0.42 + k * 0.28, y, -0.52);
      if ((i * 4 + k) % 5 === 0) rig.pulses.push({ obj: led, amp: 0.9, speed: 1.2, phase: i + k });
    }
  }
  // chest monitor with digits and a glowing core
  mk(body, rbox(0.66, 0.5, 0.08, 0.04), m.steelDark, 0, 2.52, -0.5);
  digitScreen(body, 0.58, 0.42, 0, 2.52, -0.55, 9);
  const heart = mk(body, sph(0.12, 12), m.white, 0, 1.96, -0.52);
  mk(body, sph(0.26, 12), m.magentaHalo, 0, 1.96, -0.52);
  rig.pulses.push({ obj: heart, amp: 1.4 });
  // head: a CRT-ish monitor
  const head = grp(body, 0, 3.2, -0.22);
  rig.head = head;
  mk(head, rbox(0.56, 0.44, 0.4, 0.1), m.hull);
  mk(head, rbox(0.44, 0.32, 0.06, 0.04), m.steelDark, 0, 0, -0.22);
  [-1, 1].forEach((s) => mk(head, box(0.1, 0.05, 0.04), m.cyan, s * 0.1, 0.03, -0.26));
  mk(head, box(0.22, 0.03, 0.04), m.magenta, 0, -0.08, -0.26);
  spike(head, V(0, 0.22, 0), V(0, 1, 0), 0.03, 0.5, m.steel, 5);
  mk(head, sph(0.06, 8), m.magenta, 0, 0.78, 0);
  // arms: cable-wrapped pistons ending in holo-fists
  [-1, 1].forEach((s) => {
    mk(body, K.torus(0.4, 0.06, 8, 22), m.steel, s * 0.95, 2.85, 0, Math.PI / 2 - 0.3, 0, 0);
    mk(body, K.torus(0.32, 0.022, 8, 22), s > 0 ? m.magenta : m.cyan, s * 0.95, 2.87, 0, Math.PI / 2 - 0.3, 0, 0);
    const arm = artic(body, V(s * 1.0, 2.6, 0), V(s * 1.3, 1.7, -0.15), V(s * 1.2, 0.95, -0.55), 0.17, 0.15, m.hullDark, m.hull, 0.18, s > 0 ? m.magenta : m.cyan);
    arm.onLow(rbox(0.48, 0.44, 0.48, 0.1), m.hull, s * 1.2, 0.82, -0.6);
    arm.onLow(sph(0.26, 10), m.white, s * 1.2, 0.82, -0.84);
    arm.onLow(sph(0.5, 10), s > 0 ? m.magentaHalo : m.cyanHalo, s * 1.2, 0.82, -0.84);
    for (let i = -1; i <= 1; i++) arm.onLow(cone(0.05, 0.3, 4), m.steel, s * 1.2 + i * 0.14, 0.64, -0.96, -Math.PI / 2 - 0.4, 0, 0);
    rig.arms.push({ up: arm.up, low: arm.low, phase: s < 0 ? Math.PI : 0, amp: 0.8 });
    const leg = artic(root, V(s * 0.45, 1.05, 0), V(s * 0.58, 0.58, 0.05), V(s * 0.6, 0.35, 0.05), 0.22, 0.18, m.hull, m.hullDark, 0.18, s > 0 ? m.cyan : m.magenta);
    leg.onLow(rbox(0.52, 0.28, 0.68, 0.1), m.hullDark, s * 0.6, 0.15, -0.05);
    leg.onLow(box(0.46, 0.03, 0.58), s > 0 ? m.magenta : m.cyan, s * 0.6, 0.29, -0.05);
    rig.legs.push({ up: leg.up, low: leg.low, phase: s < 0 ? 0 : Math.PI, amp: 0.85 });
  });
  // dangling cables with glowing plugs
  for (let i = 0; i < 4; i++) {
    const d = grp(body, (i - 1.5) * 0.4, 1.32, 0.45);
    tube(d, [V(0, 0, 0), V(0.05, -0.3, 0.1), V(-0.04, -0.62, 0.05)], 0.02, m.steelDark);
    mk(d, cyl(0.04, 0.04, 0.1, 6), i % 2 ? m.cyan : m.magenta, -0.04, -0.66, 0.05);
    rig.flutters.push({ obj: d, phase: i * 1.3, amp: 0.8 });
  }
  rig.gait = { freq: 0.75, swing: 0.55, knee: 0.55, bob: 0.07, lean: 0.045 };
  rig.lunge = 0.3;
  return { hp: 450, speed: 3.6, damage: 38 };
}

/** Builds a MAP 10 enemy into `group` (registers its animation rig); returns null for other types. */
export function buildNeonEnemy(type: string, group: THREE.Group): EliteStats | null {
  if (!isNeonType(type)) return null;
  const rig = createRig(type);
  group.userData.enemyRig = rig;
  switch (type) {
    case 'glitchling': return buildGlitchling(group, rig);
    case 'neonhound': return buildNeonHound(group, rig);
    case 'cipher': return buildCipher(group, rig);
    case 'signaltower': return buildSignalTower(group, rig);
    case 'mainframe': return buildMainframe(group, rig);
  }
  return null;
}
