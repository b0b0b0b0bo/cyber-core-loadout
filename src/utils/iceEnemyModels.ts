import * as THREE from 'three';
import { createRig, EnemyRig } from './enemyAnimation';
import { kit, EliteStats } from './eliteEnemyModels';

/**
 * MAP 6 (FROZEN ARCHIVE) roster: machines frozen into crystal and rime.
 * Each type reuses the movement / attack AI of a base category (see ENEMY_BASE_CATEGORY in BattleScene3D) and
 * only brings its own body, so they all animate through the generic rig.
 *
 *   flurry     FLURRY DRONE     雪結晶ドローン     (drone AI)
 *   yeti       CRYO YETI        氷河の雪男機       (golem AI)
 *   shard      SHARD SENTRY     氷晶の固定砲台     (sentry AI)
 *
 * Every model faces -Z with its feet on y = 0 (flying types are centred on their origin).
 */

export const ICE_TYPES = ['flurry', 'yeti', 'shard'] as const;
export type IceType = (typeof ICE_TYPES)[number];
export const isIceType = (t: string): t is IceType => (ICE_TYPES as readonly string[]).includes(t);

function iceKit() {
  const K = kit();
  const ice = K.glass(0x9bdcff, 0.62, 0x0b3a63);
  const m = {
    ice,
    iceDeep: K.emis(0x38bdf8, 0x075985, 0.55),
    frost: K.solid(0xe0f2fe, 0.15, 0.55),
    snow: K.solid(0xf8fafc, 0.05, 0.85),
    steel: K.solid(0x94a3b8, 0.8, 0.35),
    steelDark: K.solid(0x1e293b, 0.85, 0.4),
    navy: K.solid(0x0f2a4a, 0.7, 0.4),
    cyan: K.glow(0x67e8f9),
    cyanHalo: K.halo(0x7dd3fc, 0.26),
    white: K.glow(0xf0f9ff),
    whiteHalo: K.halo(0xe0f2fe, 0.24),
  };
  return { K, m };
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

// ───────────────────────── FLURRY DRONE ─────────────────────────
function buildFlurry(root: THREE.Group, rig: EnemyRig): EliteStats {
  const { K, m } = iceKit();
  const { sph, cyl, V, mk, grp, strut, lathe, rbox } = K;
  const body = new THREE.Group();
  root.add(body);
  rig.body = body;

  // crystal core hull
  mk(body, lathe([[0, -0.3], [0.16, -0.26], [0.3, -0.1], [0.3, 0.1], [0.16, 0.26], [0, 0.3]], 6), m.navy);
  const core = mk(body, new THREE.OctahedronGeometry(0.2, 0), m.cyan);
  mk(body, sph(0.4, 14), m.cyanHalo);
  rig.pulses.push({ obj: core, amp: 1.3, speed: 1.1 }, { obj: body.children[body.children.length - 1], amp: 1.0, phase: 0.5 });
  rig.spinners.push({ obj: core, axis: 'y', speed: 2.5 });

  // front eye
  mk(body, cyl(0.1, 0.1, 0.06, 12), m.steelDark, 0, 0, -0.34, Math.PI / 2, 0, 0);
  const eye = mk(body, sph(0.055, 10), m.white, 0, 0, -0.39);
  rig.pulses.push({ obj: eye, amp: 1.6, speed: 1.8 });

  // snowflake rotor: six branching arms spinning flat on top
  const rotor = grp(body, 0, 0.34, 0);
  for (let i = 0; i < 6; i++) {
    const arm = grp(rotor, 0, 0, 0, 0, (i / 6) * Math.PI * 2, 0);
    strut(arm, V(0, 0, 0), V(0, 0, -0.78), 0.028, 0.02, m.frost);
    [0.3, 0.55].forEach((d, k) => {
      [-1, 1].forEach((s) => strut(arm, V(0, 0, -d), V(s * (0.2 - k * 0.06), 0, -d - 0.2), 0.02, 0.012, m.frost));
    });
    mk(arm, new THREE.OctahedronGeometry(0.06, 0), m.white, 0, 0, -0.8);
  }
  mk(rotor, sph(0.07, 8), m.white);
  rig.spinners.push({ obj: rotor, axis: 'y', speed: 16 });
  mk(body, cyl(0.03, 0.05, 0.1, 8), m.steel, 0, 0.28, 0);

  // dangling icicles (tremble with movement)
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const ic = grp(body, Math.cos(a) * 0.17, -0.26, Math.sin(a) * 0.17);
    spike(ic, V(0, 0, 0), V(0, -1, 0), 0.04, 0.3 + (i % 2) * 0.12, m.ice, 5);
    rig.flutters.push({ obj: ic, phase: i * 1.1, amp: 0.8 });
  }
  // frost emitters on the flanks
  [-1, 1].forEach((s) => {
    mk(body, rbox(0.14, 0.1, 0.3, 0.03), m.steel, s * 0.38, -0.02, 0.0);
    rig.pulses.push({ obj: mk(body, sph(0.05, 8), m.cyan, s * 0.38, -0.02, -0.17), amp: 1.4, phase: s });
  });
  rig.hover = { bob: 0.07, tilt: 0.05 };
  rig.lunge = 0.2;
  return { hp: 105, speed: 5.6, damage: 16 };
}

// ───────────────────────── CRYO YETI ─────────────────────────
function buildYeti(root: THREE.Group, rig: EnemyRig): EliteStats {
  const { K, m } = iceKit();
  const { rbox, sph, cone, V, mk, grp, artic } = K;
  const body = new THREE.Group();
  root.add(body);
  rig.body = body;

  // hunched torso: steel frame under a shell of frosted plating
  mk(body, rbox(1.1, 0.5, 0.8, 0.14), m.navy, 0, 1.15, 0.05);
  const chest = mk(body, rbox(1.5, 1.15, 0.95, 0.2), m.frost, 0, 1.95, -0.1);
  chest.rotation.x = 0.08;
  mk(body, rbox(1.3, 0.2, 0.8, 0.08), m.snow, 0, 2.6, -0.1);
  // crystal core window
  mk(body, rbox(0.6, 0.62, 0.16, 0.06), m.steelDark, 0, 1.95, -0.62);
  const heart = mk(body, new THREE.OctahedronGeometry(0.2, 0), m.cyan, 0, 1.95, -0.66);
  mk(body, sph(0.38, 12), m.cyanHalo, 0, 1.95, -0.66);
  rig.pulses.push({ obj: heart, amp: 1.3 }, { obj: body.children[body.children.length - 1], amp: 1.3, phase: 0.6 });
  // ice crystals growing from the back and shoulders
  for (let i = 0; i < 7; i++) spike(body, V((i - 3) * 0.2, 2.45, 0.28), V((i - 3) * 0.12, 1, 0.35), 0.1, 0.55 + (i % 3) * 0.2, m.ice, 5);
  [-1, 1].forEach((s) => {
    spike(body, V(s * 0.85, 2.5, -0.1), V(s * 0.6, 1, 0), 0.13, 0.75, m.iceDeep, 5);
    spike(body, V(s * 0.7, 2.55, 0.2), V(s * 0.3, 1, 0.3), 0.09, 0.5, m.ice, 5);
  });

  // head
  const head = grp(body, 0, 2.95, -0.45);
  rig.head = head;
  mk(head, rbox(0.52, 0.44, 0.5, 0.12), m.snow, 0, 0, 0);
  mk(head, rbox(0.4, 0.14, 0.14, 0.04), m.steelDark, 0, 0.04, -0.22);
  [-1, 1].forEach((s) => mk(head, K.box(0.1, 0.05, 0.05), m.cyan, s * 0.1, 0.04, -0.3));
  for (let i = 0; i < 4; i++) spike(head, V((i - 1.5) * 0.1, -0.2, -0.22), V(0, -1, -0.15), 0.03, 0.18 + (i % 2) * 0.08, m.ice, 4); // icicle fangs
  [-1, 1].forEach((s) => spike(head, V(s * 0.2, 0.15, 0), V(s * 0.8, 1, 0), 0.06, 0.38, m.iceDeep, 5));

  // long arms with ice-hammer fists
  [-1, 1].forEach((s) => {
    const arm = artic(body, V(s * 0.95, 2.35, -0.05), V(s * 1.3, 1.55, -0.2), V(s * 1.15, 0.8, -0.65), 0.2, 0.18, m.frost, m.steel, 0.2, m.navy);
    arm.onLow(new THREE.DodecahedronGeometry(0.46, 0), m.ice, s * 1.15, 0.7, -0.7);
    for (let i = -1; i <= 1; i++) arm.onLow(cone(0.08, 0.4, 5), m.iceDeep, s * 1.15 + i * 0.16, 0.5, -1.0, -Math.PI / 2 - 0.4, 0, 0);
    rig.arms.push({ up: arm.up, low: arm.low, phase: s < 0 ? Math.PI : 0, amp: 0.85 });
    // stubby legs
    const leg = artic(root, V(s * 0.42, 1.1, 0), V(s * 0.54, 0.62, 0.05), V(s * 0.56, 0.35, 0.05), 0.24, 0.2, m.frost, m.steel, 0.2, m.navy);
    leg.onLow(rbox(0.56, 0.3, 0.72, 0.1), m.snow, s * 0.56, 0.15, -0.05);
    for (let i = -1; i <= 1; i++) leg.onLow(cone(0.07, 0.3, 4), m.ice, s * 0.56 + i * 0.2, 0.1, -0.5, -Math.PI / 2, 0, 0);
    rig.legs.push({ up: leg.up, low: leg.low, phase: s < 0 ? 0 : Math.PI, amp: 0.85 });
  });
  rig.gait = { freq: 0.75, swing: 0.55, knee: 0.55, bob: 0.07, lean: 0.045 };
  rig.lunge = 0.3;
  return { hp: 460, speed: 3.5, damage: 36 };
}

// ───────────────────────── SHARD SENTRY ─────────────────────────
function buildShard(root: THREE.Group, rig: EnemyRig): EliteStats {
  const { K, m } = iceKit();
  const { cyl, sph, V, mk, grp, artic, torus } = K;
  const body = new THREE.Group();
  root.add(body);
  rig.body = body;

  mk(body, cyl(0.52, 0.74, 0.2, 6), m.navy, 0, 0.1, 0);
  mk(body, torus(0.62, 0.03, 8, 6), m.cyan, 0, 0.22, 0, Math.PI / 2, 0, 0);
  for (let i = 0; i < 3; i++) { // tripod legs
    const a = (i / 3) * Math.PI * 2 + Math.PI / 2;
    const ca = Math.cos(a), sa = Math.sin(a);
    const j = artic(root, V(ca * 0.3, 0.42, sa * 0.3), V(ca * 0.7, 0.52, sa * 0.7), V(ca * 0.9, 0.04, sa * 0.9), 0.06, 0.045, m.steel, m.frost, 0.06, m.steelDark);
    j.onLow(K.cone(0.09, 0.2, 5), m.ice, ca * 0.92, 0.06, sa * 0.92, Math.PI, 0, 0);
    rig.legs.push({ up: j.up, low: j.low, phase: i * ((Math.PI * 2) / 3), amp: 0.55 });
  }
  mk(body, cyl(0.16, 0.26, 0.5, 6), m.steel, 0, 0.45, 0);
  // frozen base crystals
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    spike(body, V(Math.cos(a) * 0.45, 0.2, Math.sin(a) * 0.45), V(Math.cos(a) * 0.5, 1, Math.sin(a) * 0.5), 0.07, 0.4 + (i % 2) * 0.15, m.ice, 5);
  }

  const head = grp(body, 0, 0.98, 0);
  rig.scanners.push({ obj: head, phase: 0, amp: 1 });
  // faceted crystal cluster around a glowing heart
  mk(head, sph(0.3, 10), m.navy);
  const heart = mk(head, new THREE.OctahedronGeometry(0.2, 0), m.cyan);
  mk(head, sph(0.36, 10), m.cyanHalo);
  rig.pulses.push({ obj: heart, amp: 1.3, speed: 1.2 });
  rig.spinners.push({ obj: heart, axis: 'y', speed: 2 });
  const N = 16;
  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const th = i * 2.399;
    const d = V(Math.cos(th) * r, y, Math.sin(th) * r);
    if (d.z < -0.5 && Math.abs(d.y) < 0.55) continue; // keep the front clear for the gun
    spike(head, d.clone().multiplyScalar(0.28), d, 0.07, 0.4 + (i % 3) * 0.15, i % 2 ? m.ice : m.iceDeep, 5);
  }
  mk(head, cyl(0.1, 0.1, 0.07, 12), m.steelDark, 0, 0.04, -0.3, Math.PI / 2, 0, 0);
  mk(head, sph(0.055, 8), m.white, 0, 0.04, -0.35);
  // twin shard launchers
  [-1, 1].forEach((s) => {
    const gun = grp(head);
    rig.recoils.push({ obj: gun, amp: 0.8 });
    mk(gun, cyl(0.05, 0.06, 0.8, 8), m.steel, s * 0.24, -0.12, -0.5, Math.PI / 2, 0, 0);
    mk(gun, cyl(0.07, 0.07, 0.16, 8), m.steelDark, s * 0.24, -0.12, -0.88, Math.PI / 2, 0, 0);
    rig.pulses.push({ obj: mk(gun, sph(0.04, 8), m.cyan, s * 0.24, -0.12, -0.98), amp: 2 });
  });
  rig.gait = { freq: 0.8, swing: 0.5, knee: 0.5, bob: 0.015, lean: 0.02 };
  rig.lunge = 0.08;
  return { hp: 220, speed: 4.2, damage: 34 };
}

/** Builds a MAP 6 ice enemy into `group` (registers its animation rig); returns null for other types. */
export function buildIceEnemy(type: string, group: THREE.Group): EliteStats | null {
  if (!isIceType(type)) return null;
  const rig = createRig(type);
  group.userData.enemyRig = rig;
  switch (type) {
    case 'flurry': return buildFlurry(group, rig);
    case 'yeti': return buildYeti(group, rig);
    case 'shard': return buildShard(group, rig);
  }
  return null;
}
