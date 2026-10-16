import * as THREE from 'three';
import { createRig, EnemyRig } from './enemyAnimation';
import { kit, EliteStats } from './eliteEnemyModels';

/**
 * PROJECT EDEN roster: fifteen angels drawn from the Biblical hierarchy and visions (Ezekiel, Isaiah, Revelation).
 * Each type reuses the movement / attack AI of a base category (see ENEMY_BASE_CATEGORY in BattleScene3D) and only
 * brings its own body, so they all animate through the generic rig (legs, arms, wings, spinners ...).
 *
 *   messenger    MESSENGER ANGEL   伝令の天使        (drone AI)   two wings, halo, spear of light
 *   ophanim      OPHANIM           車輪の天使        (drone AI)   wheels within wheels, rims full of eyes
 *   cherubim     CHERUBIM          智天使            (drone AI)   four faces (man / lion / ox / eagle), four wings
 *   seraphim     SERAPHIM          熾天使            (drone AI)   six wings, flaming body
 *   lionwing     WINGED LION       有翼の獅子        (hound AI)   the lion face of the living creatures
 *   bullwing     WINGED OX         有翼の牡牛        (hound AI)   the ox face of the living creatures
 *   archangel    ARCHANGEL         大天使            (stalker AI) armoured, flaming sword
 *   principality PRINCIPALITY      権天使            (stalker AI) crowned, spear and cape
 *   powers       POWERS            能天使            (stalker AI) chain-bound warrior, mace of light
 *   trumpeter    TRUMPETER         吹鳴の天使        (sentry AI)  the great trumpet of Revelation
 *   censer       CENSER ANGEL      香炉の天使        (sentry AI)  golden censer thrown down as fire
 *   dominion     DOMINION          主天使            (golem AI)   colossus with sceptre and orb
 *   gatekeeper   GATEKEEPER        楽園の門番        (golem AI)   cherub with the turning flaming sword
 *   throne       THRONE            座天使            (golem AI)   walking chariot-throne carrying wheels of eyes
 *   virtue       VIRTUE            力天使            (mender AI)  healing angel with a lily staff
 *
 * Every model faces -Z with its feet on y = 0 (flying types are centred on their origin).
 */

export const EDEN_TYPES = [
  'messenger', 'ophanim', 'cherubim', 'seraphim', 'lionwing', 'bullwing', 'archangel', 'principality',
  'powers', 'trumpeter', 'censer', 'dominion', 'gatekeeper', 'throne', 'virtue',
] as const;
export type EdenType = (typeof EDEN_TYPES)[number];
export const isEdenType = (t: string): t is EdenType => (EDEN_TYPES as readonly string[]).includes(t);

// ───────────────────────── materials / shared parts ─────────────────────────
function edenKit() {
  const K = kit();
  const m = {
    white: K.emis(0xf6f3ea, 0xfff1d0, 0.5),
    pearl: K.emis(0xe4dccb, 0xffe7b0, 0.34),
    robe: K.emis(0xfdfbf4, 0xfff6dc, 0.55),
    gold: K.emis(0xe8b83c, 0xb8860b, 0.6),
    goldDark: K.solid(0xa87a1c, 0.7, 0.35),
    skin: K.emis(0xf3e3cf, 0xffd9a8, 0.3),
    dark: K.solid(0x3a2f20, 0.4, 0.6),
    feather: K.emis(0xffffff, 0xffffff, 0.55),
    featherGold: K.emis(0xfff0b8, 0xffd87a, 0.6),
    glowW: K.glow(0xffffff),
    glowG: K.glow(0xfde68a),
    glowFire: K.glow(0xffa84a),
    glowBlue: K.glow(0xa5d8ff),
    haloG: K.halo(0xfde68a, 0.3),
    haloW: K.halo(0xffffff, 0.3),
    haloFire: K.halo(0xff9d3a, 0.32),
    haloBlue: K.halo(0xa5d8ff, 0.26),
  };
  return { K, m };
}
type EK = ReturnType<typeof edenKit>;

/** Halo ring facing forward / tilted over the head. */
function halo(e: EK, parent: THREE.Object3D, r: number, x: number, y: number, z: number, tilt = -0.25) {
  const g = e.K.grp(parent, x, y, z, tilt, 0, 0);
  e.K.mk(g, e.K.torus(r, r * 0.07, 36, 8), e.m.glowG, 0, 0, 0, Math.PI / 2, 0, 0);
  e.K.mk(g, e.K.torus(r, r * 0.22, 36, 8), e.m.haloG, 0, 0, 0, Math.PI / 2, 0, 0);
  return g;
}

/** A feathered wing. Returns the flutter pivot (at the shoulder) and the inner pose group. */
function wing(e: EK, parent: THREE.Object3D, side: number, x: number, y: number, z: number, len: number, o: { u0?: number; u1?: number; n?: number; pose?: [number, number, number]; gold?: boolean } = {}) {
  const { K, m } = e;
  const pv = K.grp(parent, x, y, z);
  const pose = K.grp(pv, 0, 0, 0, ...(o.pose ?? [0, 0, 0]));
  const n = o.n ?? 7, u0 = o.u0 ?? -0.35, u1 = o.u1 ?? 0.95;
  for (let row = 0; row < 2; row++) {
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0.5 : i / (n - 1);
      const u = THREE.MathUtils.lerp(u0, u1, t);
      const L = len * (row ? 0.62 : 1) * (1 - 0.3 * Math.abs(t - 0.45));
      const f = K.mk(pose, K.feather(L, L * 0.2, 0.025), row ? (o.gold ? m.featherGold : m.feather) : (o.gold && i % 3 === 0 ? m.featherGold : m.feather), 0, 0, row ? 0.02 : 0, 0, 0, -side * (Math.PI / 2 - u));
      f.position.z += i * 0.003;
    }
  }
  // wing arm bone with a golden joint
  K.mk(pose, K.cyl(len * 0.018, len * 0.03, len * 0.5, 6), m.gold, side * len * 0.2, len * 0.04, -0.01, 0, 0, -side * (Math.PI / 2 - 0.1));
  K.mk(pose, K.sph(len * 0.035, 8), m.gold, side * len * 0.44, len * 0.1, -0.01);
  return { pv, pose };
}

/** A single watching eye on a surface, looking along `dir`. */
function eye(e: EK, parent: THREE.Object3D, r: number, x: number, y: number, z: number, dir = new THREE.Vector3(0, 0, -1)) {
  const { K, m } = e;
  const g = K.grp(parent, x, y, z);
  g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir.clone().normalize());
  const ball = K.mk(g, K.sph(r, 10), m.glowW);
  ball.scale.z = 0.55;
  K.mk(g, K.sph(r * 0.52, 8), m.dark, 0, 0, r * 0.28).scale.z = 0.4;
  K.mk(g, K.sph(r * 0.2, 6), m.glowW, r * 0.1, r * 0.1, r * 0.44);
  K.mk(g, K.torus(r * 1.05, r * 0.14, 14, 6), m.gold, 0, 0, 0);
  return g;
}

/** Sword of fire: a pale blade wrapped in flame. */
function fireSword(e: EK, parent: THREE.Object3D, len: number, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) {
  const { K, m } = e;
  const g = K.grp(parent, x, y, z, rx, ry, rz);
  K.mk(g, K.blade(len, len * 0.1, 0.05), m.glowW, 0, 0, 0);
  const fl = K.mk(g, K.blade(len * 1.05, len * 0.2, 0.04), m.glowFire, 0, 0.0, -0.03);
  fl.scale.set(1, 1, 1);
  K.mk(g, K.blade(len * 1.1, len * 0.34, 0.03), m.haloFire, 0, -0.02, -0.05);
  K.mk(g, K.box(len * 0.34, len * 0.04, 0.07), m.gold, 0, -0.02, 0);
  K.mk(g, K.cyl(0.035, 0.035, len * 0.18, 6), m.goldDark, 0, -len * 0.1, 0);
  return g;
}

interface HumanoidOpts {
  s?: number;
  /** vertical offset of the body (flying angels hover with their feet off the ground) */
  lift?: number;
  walk?: boolean;
  robe?: boolean;
  armor?: boolean;
  crown?: boolean;
  wings?: 'two' | 'four' | 'none';
  wingLen?: number;
  /** hand lines (grip points in local space of the lower arm) are filled by callers via `arms` */
  armsRaised?: boolean;
}
interface HumanoidRefs {
  body: THREE.Group;
  head: THREE.Group;
  arms: ReturnType<EK['K']['artic']>[];
  legs: THREE.Group;
}

/** Shared humanoid angel: torso, head with halo, arms, optional legs or robe, optional wings. Registered in the rig. */
function humanoid(e: EK, root: THREE.Group, rig: EnemyRig, o: HumanoidOpts = {}): HumanoidRefs {
  const { K, m } = e;
  const { V, mk, grp, artic } = K;
  const s = o.s ?? 1;
  const lift = o.lift ?? 0;
  const body = new THREE.Group();
  body.position.y = lift;
  body.scale.setScalar(s);
  root.add(body);
  rig.body = body;
  const legs = new THREE.Group();
  legs.position.y = lift;
  legs.scale.setScalar(s);
  root.add(legs);
  const armorM = o.armor ? m.pearl : m.robe;

  // torso
  mk(body, K.rbox(0.46, 0.66, 0.28, 0.1), armorM, 0, 1.3, 0);
  mk(body, K.rbox(0.52, 0.2, 0.3, 0.08), o.armor ? m.white : armorM, 0, 1.6, 0);
  mk(body, K.rbox(0.36, 0.2, 0.26, 0.08), o.armor ? m.pearl : m.robe, 0, 0.92, 0);
  mk(body, K.box(0.5, 0.05, 0.31), m.gold, 0, 1.0, 0);
  mk(body, K.sph(0.07, 10), m.glowG, 0, 1.38, -0.15);
  mk(body, K.sph(0.15, 10), m.haloG, 0, 1.38, -0.15);
  if (o.armor) {
    for (const sx of [-1, 1]) {
      mk(body, K.sph(0.17, 10), m.white, sx * 0.34, 1.62, 0);
      mk(body, K.torus(0.17, 0.025, 14, 6), m.gold, sx * 0.34, 1.62, 0, 0, Math.PI / 2, 0);
    }
    mk(body, K.box(0.04, 0.5, 0.02), m.gold, 0, 1.3, -0.15);
  }
  // head
  const head = grp(body, 0, 1.9, 0);
  rig.head = head;
  mk(head, K.sph(0.15, 14), m.skin).scale.set(1, 1.1, 1);
  mk(head, new THREE.SphereGeometry(0.165, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), m.pearl, 0, 0.03, 0.02);
  for (const sx of [-1, 1]) mk(head, K.box(0.045, 0.02, 0.02), m.dark, sx * 0.06, 0.02, -0.14);
  halo(e, head, 0.26, 0, 0.3, 0.04);
  if (o.crown) {
    mk(head, K.torus(0.17, 0.025, 20, 6), m.gold, 0, 0.17, 0, Math.PI / 2, 0, 0);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      mk(head, K.cone(0.03, 0.12, 4), m.gold, Math.cos(a) * 0.17, 0.25, Math.sin(a) * 0.17);
    }
  }
  // robe / legs
  if (o.walk) {
    for (const sx of [-1, 1]) {
      const leg = artic(legs, V(sx * 0.13, 0.9, 0), V(sx * 0.16, 0.5, -0.06), V(sx * 0.14, 0.05, 0.02), 0.07, 0.055, armorM, m.pearl, 0.06, m.gold);
      leg.onLow(K.rbox(0.14, 0.08, 0.28, 0.03), m.gold, sx * 0.14, 0.05, -0.06);
      if (o.armor) leg.onUp(K.rbox(0.16, 0.26, 0.04, 0.02), m.white, sx * 0.14, 0.7, -0.07);
      rig.legs.push({ up: leg.up, low: leg.low, phase: sx < 0 ? 0 : Math.PI, amp: 1 });
    }
    // tabard hanging from the belt
    mk(body, K.rbox(0.3, 0.7, 0.04, 0.02), armorM, 0, 0.55, -0.15, 0.04, 0, 0);
    mk(body, K.box(0.04, 0.68, 0.045), m.gold, 0, 0.55, -0.16, 0.04, 0, 0);
  } else {
    // a floating robe: a long tapering skirt of cloth
    const robe = mk(body, K.cone(0.42, 1.5, 12), armorM, 0, 0.2, 0, Math.PI, 0, 0);
    rig.flutters.push({ obj: robe, phase: 0.3, amp: 0.5 });
    mk(body, K.torus(0.4, 0.03, 20, 6), m.gold, 0, 0.78, 0, Math.PI / 2, 0, 0);
  }
  // arms
  const arms: HumanoidRefs['arms'] = [];
  for (const sx of [-1, 1]) {
    const arm = artic(body, V(sx * 0.31, 1.58, 0), V(sx * 0.4, 1.22, -0.08), V(sx * 0.36, 0.98, -0.28), 0.052, 0.042, armorM, m.skin, 0.055, m.gold);
    arm.onLow(K.sph(0.05, 8), m.skin, sx * 0.36, 0.98, -0.3);
    if (o.armor) arm.onUp(K.rbox(0.1, 0.2, 0.1, 0.03), m.white, sx * 0.36, 1.4, -0.04);
    rig.arms.push({ up: arm.up, low: arm.low, phase: sx < 0 ? Math.PI : 0, amp: 0.9 });
    arms.push(arm);
  }
  // wings
  const w = o.wings ?? 'two';
  if (w !== 'none') {
    const L = o.wingLen ?? 1.5;
    const sets: [number, number, number, number, number][] = w === 'four'
      ? [[1.62, 0.2, L, 0.9, -0.2], [1.35, 0.22, L * 0.8, 0.5, -0.5]]
      : [[1.55, 0.2, L, 0.95, -0.3]];
    sets.forEach(([y, z, len, u1, u0], k) => {
      for (const sx of [-1, 1]) {
        const wg = wing(e, body, sx, sx * 0.18, y, z, len, { u0, u1, pose: [0, sx * 0.25, 0], gold: k === 1 });
        rig.flutters.push({ obj: wg.pv, phase: sx * 0.5 + k, amp: 1.4 });
      }
    });
  }
  rig.gait = { freq: 1.35, swing: 0.8, knee: 0.9, bob: 0.06, lean: 0.07 };
  rig.lunge = 0.3;
  return { body, head, arms, legs };
}

// ───────────────────────── MESSENGER ANGEL ─────────────────────────
function buildMessenger(root: THREE.Group, rig: EnemyRig): EliteStats {
  const e = edenKit();
  const h = humanoid(e, root, rig, { s: 0.85, wings: 'two', wingLen: 1.4, robe: true });
  // spear of light held in the right hand
  h.arms[1].onLow(e.K.cyl(0.02, 0.02, 1.7, 6), e.m.gold, 0.36, 0.98, -0.45, Math.PI / 2, 0, 0);
  h.arms[1].onLow(e.K.cone(0.06, 0.34, 6), e.m.glowW, 0.36, 0.98, -1.4, -Math.PI / 2, 0, 0);
  e.K.mk(h.body, e.K.sph(0.2, 8), e.m.haloW, 0.36, 0.98, -1.4);
  rig.hover = { bob: 0.12, tilt: 0.08 };
  rig.lunge = 0.25;
  return { hp: 130, speed: 5.8, damage: 20 };
}

// ───────────────────────── OPHANIM ─────────────────────────
function buildOphanim(root: THREE.Group, rig: EnemyRig): EliteStats {
  const e = edenKit();
  const { K, m } = e;
  const body = new THREE.Group();
  root.add(body);
  rig.body = body;
  // central watching eye
  const core = K.mk(body, K.sph(0.2, 14), m.glowW);
  K.mk(body, K.sph(0.36, 12), m.haloG);
  eye(e, body, 0.17, 0, 0, -0.18, new THREE.Vector3(0, 0, -1));
  rig.pulses.push({ obj: core, amp: 0.3, speed: 1.4 });
  // wheels within wheels, each rim studded with eyes
  const makeRing = (R: number, rx: number, ry: number, speed: number, axis: 'x' | 'y' | 'z', eyes: number) => {
    const g = K.grp(body, 0, 0, 0, rx, ry, 0);
    const spin = K.grp(g);
    K.mk(spin, K.torus(R, R * 0.07, 40, 10), m.gold);
    K.mk(spin, K.torus(R * 0.9, R * 0.03, 40, 8), m.glowG);
    for (let i = 0; i < eyes; i++) {
      const a = (i / eyes) * Math.PI * 2;
      const ey = K.mk(spin, K.sph(R * 0.1, 8), m.glowW, Math.cos(a) * R, Math.sin(a) * R, 0);
      ey.scale.z = 0.5;
      K.mk(spin, K.sph(R * 0.05, 6), m.dark, Math.cos(a) * R, Math.sin(a) * R, R * 0.04);
    }
    for (let i = 0; i < 4; i++) K.mk(spin, K.box(R * 1.8, 0.02, 0.02), m.glowG, 0, 0, 0, 0, 0, (i / 4) * Math.PI);
    rig.spinners.push({ obj: spin, axis, speed });
    return g;
  };
  makeRing(0.62, 0, 0, 1.6, 'z', 12);
  makeRing(0.5, Math.PI / 2, 0, -2.2, 'z', 10);
  makeRing(0.4, Math.PI / 4, Math.PI / 4, 2.8, 'z', 8);
  K.mk(body, K.sph(0.9, 14), m.haloW);
  rig.hover = { bob: 0.14, tilt: 0.1 };
  rig.lunge = 0.2;
  return { hp: 180, speed: 5.0, damage: 22 };
}

// ───────────────────────── CHERUBIM ─────────────────────────
function buildCherubim(root: THREE.Group, rig: EnemyRig): EliteStats {
  const e = edenKit();
  const { K, m } = e;
  const body = new THREE.Group();
  root.add(body);
  rig.body = body;
  // robed body under four faces
  K.mk(body, K.cone(0.38, 1.0, 10), m.robe, 0, -0.42, 0, Math.PI, 0, 0);
  K.mk(body, K.torus(0.36, 0.03, 20, 6), m.gold, 0, -0.1, 0, Math.PI / 2, 0, 0);
  const core = K.mk(body, K.sph(0.09, 10), m.glowG, 0, -0.2, -0.28);
  rig.pulses.push({ obj: core, amp: 0.4 });
  // the head: four faces around the neck (man, lion, ox, eagle)
  const head = K.grp(body, 0, 0.32, 0);
  rig.head = head;
  const face = (ang: number, kind: 'man' | 'lion' | 'ox' | 'eagle') => {
    const f = K.grp(head, 0, 0, 0, 0, ang, 0);
    K.mk(f, K.sph(0.2, 14), kind === 'eagle' ? m.white : m.skin, 0, 0, -0.04).scale.set(1, 1.1, 0.9);
    for (const sx of [-1, 1]) {
      K.mk(f, K.sph(0.035, 8), kind === 'eagle' ? m.glowG : m.glowW, sx * 0.075, 0.04, -0.2);
      K.mk(f, K.sph(0.017, 6), m.dark, sx * 0.075, 0.04, -0.225);
    }
    if (kind === 'man') {
      K.mk(f, K.cone(0.025, 0.07, 4), m.skin, 0, -0.02, -0.22, -Math.PI / 2, 0, 0);
    } else if (kind === 'lion') {
      K.mk(f, K.torus(0.24, 0.06, 18, 8), m.featherGold, 0, 0, -0.02);
      K.mk(f, K.rbox(0.13, 0.1, 0.12, 0.04), m.gold, 0, -0.06, -0.22);
    } else if (kind === 'ox') {
      for (const sx of [-1, 1]) K.mk(f, K.cone(0.035, 0.22, 6), m.white, sx * 0.19, 0.17, -0.04, 0, 0, -sx * 0.9);
      K.mk(f, K.rbox(0.15, 0.1, 0.12, 0.04), m.pearl, 0, -0.07, -0.21);
    } else {
      K.mk(f, K.cone(0.05, 0.2, 5), m.gold, 0, -0.03, -0.26, -Math.PI / 2 - 0.3, 0, 0);
    }
  };
  face(0, 'man'); face(Math.PI / 2, 'lion'); face(Math.PI, 'ox'); face(-Math.PI / 2, 'eagle');
  halo(e, head, 0.34, 0, 0.34, 0, 0);
  rig.spinners.push({ obj: head, axis: 'y', speed: 0.5 });
  // four wings: two upper pairs and two folded pairs; wing-tips full of eyes
  for (const sx of [-1, 1]) {
    const wu = wing(e, body, sx, sx * 0.25, 0.1, 0.1, 1.5, { u0: 0, u1: 1.15, pose: [0, sx * 0.2, 0] });
    rig.flutters.push({ obj: wu.pv, phase: sx, amp: 1.4 });
    const wl = wing(e, body, sx, sx * 0.2, -0.1, 0.1, 1.2, { u0: -0.9, u1: -0.1, gold: true, pose: [0, sx * 0.15, 0] });
    rig.flutters.push({ obj: wl.pv, phase: sx + 1.5, amp: 1.2 });
    eye(e, body, 0.06, sx * 0.9, 0.5, 0.02, new THREE.Vector3(0, 0, -1));
    eye(e, body, 0.05, sx * 1.15, 0.3, 0.02, new THREE.Vector3(0, 0, -1));
  }
  rig.hover = { bob: 0.12, tilt: 0.08 };
  rig.lunge = 0.2;
  return { hp: 200, speed: 5.2, damage: 24 };
}

// ───────────────────────── SERAPHIM ─────────────────────────
function buildSeraphim(root: THREE.Group, rig: EnemyRig): EliteStats {
  const e = edenKit();
  const { K, m } = e;
  const body = new THREE.Group();
  root.add(body);
  rig.body = body;
  // flaming body: a glowing column of fire in a pale core
  const core = K.mk(body, K.sph(0.2, 14), m.glowW, 0, 0, 0);
  K.mk(body, K.sph(0.5, 12), m.haloFire);
  K.mk(body, K.cone(0.22, 1.0, 10), m.glowFire, 0, -0.6, 0, Math.PI, 0, 0);
  K.mk(body, K.cone(0.32, 1.2, 10), m.haloFire, 0, -0.6, 0, Math.PI, 0, 0);
  rig.pulses.push({ obj: core, amp: 0.35, speed: 1.6 });
  const head = K.grp(body, 0, 0.42, 0);
  rig.head = head;
  K.mk(head, K.sph(0.15, 12), m.skin);
  for (const sx of [-1, 1]) K.mk(head, K.box(0.04, 0.02, 0.02), m.dark, sx * 0.055, 0.02, -0.14);
  halo(e, head, 0.25, 0, 0.28, 0, 0);
  // six wings: the upper pair veils the face, the lower pair covers the feet, the middle pair carries it
  for (const sx of [-1, 1]) {
    const up = wing(e, body, sx, sx * 0.12, 0.48, 0.05, 1.05, { u0: 0.9, u1: 2.1, n: 6, pose: [0, sx * 0.1, 0] });
    const mid = wing(e, body, sx, sx * 0.14, 0.1, 0.1, 1.9, { u0: -0.15, u1: 0.8, n: 8, gold: true, pose: [0, sx * 0.3, 0] });
    const lo = wing(e, body, sx, sx * 0.1, -0.2, 0.05, 1.05, { u0: -2.2, u1: -1.1, n: 6, pose: [0, sx * 0.1, 0] });
    rig.flutters.push({ obj: up.pv, phase: sx, amp: 0.8 }, { obj: mid.pv, phase: sx + 1, amp: 1.7 }, { obj: lo.pv, phase: sx + 2, amp: 0.8 });
  }
  rig.hover = { bob: 0.16, tilt: 0.1 };
  rig.lunge = 0.2;
  return { hp: 240, speed: 5.6, damage: 26 };
}

// ───────────────────────── WINGED LION / WINGED OX ─────────────────────────
function quadruped(e: EK, root: THREE.Group, rig: EnemyRig, o: { ox: boolean }) {
  const { K, m } = e;
  const { V, mk, grp, artic } = K;
  const body = new THREE.Group();
  root.add(body);
  rig.body = body;
  const bulk = o.ox ? 1.2 : 1;
  mk(body, K.rbox(0.56 * bulk, 0.46 * bulk, 1.2, 0.16), m.white, 0, 0.84, 0.05);
  mk(body, K.rbox(0.62 * bulk, 0.34, 0.6, 0.12), m.pearl, 0, 0.98, -0.32, 0.08, 0, 0);
  mk(body, K.box(0.05, 0.03, 1.0), m.gold, 0, 1.1 + (o.ox ? 0.06 : 0), 0.05);
  const core = mk(body, K.sph(0.09, 10), m.glowG, 0, 0.85, -0.02);
  mk(body, K.sph(0.22, 10), m.haloG, 0, 0.85, -0.02);
  rig.pulses.push({ obj: core, amp: 0.4 });
  // head
  const head = grp(body, 0, 1.02, -0.72);
  rig.head = head;
  if (o.ox) {
    mk(head, K.rbox(0.34, 0.32, 0.46, 0.1), m.white);
    mk(head, K.rbox(0.26, 0.2, 0.2, 0.08), m.pearl, 0, -0.08, -0.3);
    mk(head, K.torus(0.05, 0.015, 10, 5), m.gold, 0, -0.14, -0.4, Math.PI / 2, 0, 0);
    for (const sx of [-1, 1]) {
      mk(head, K.torus(0.22, 0.045, 14, 8, Math.PI * 0.85), m.gold, sx * 0.2, 0.14, -0.04, 0, sx * 0.4, sx > 0 ? 0.5 : Math.PI - 0.5);
      mk(head, K.cone(0.05, 0.2, 6), m.glowW, sx * 0.4, 0.34, -0.05, 0, 0, -sx * 0.2);
    }
  } else {
    mk(head, K.rbox(0.3, 0.28, 0.4, 0.1), m.skin);
    mk(head, K.rbox(0.2, 0.16, 0.2, 0.06), m.skin, 0, -0.06, -0.28);
    mk(head, K.torus(0.3, 0.1, 18, 8), m.featherGold, 0, 0, 0.06, 0, 0, 0); // mane of light around the face
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      mk(head, K.cone(0.04, 0.26, 4), m.glowG, Math.cos(a) * 0.34, Math.sin(a) * 0.34, 0.08, 0, 0, a - Math.PI / 2);
    }
  }
  for (const sx of [-1, 1]) {
    mk(head, K.sph(0.035, 8), m.glowW, sx * 0.1, 0.05, -0.2 - (o.ox ? 0.03 : 0));
    mk(head, K.sph(0.016, 6), m.dark, sx * 0.1, 0.05, -0.234 - (o.ox ? 0.03 : 0));
  }
  halo(e, head, 0.3, 0, 0.36, 0, -0.2);
  const jaw = grp(head, 0, -0.1, -0.05);
  rig.jaw = jaw;
  mk(jaw, K.rbox(0.18, 0.05, 0.26, 0.02), m.pearl, 0, -0.03, -0.18);
  // legs
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
    const hip = V(sx * 0.24 * bulk, 0.76, sz * 0.4), knee = V(sx * 0.32 * bulk, 0.46, sz * 0.46), foot = V(sx * 0.28 * bulk, 0.04, sz * 0.5);
    const j = artic(root, hip, knee, foot, 0.075 * bulk, 0.055 * bulk, m.white, m.pearl, 0.08, m.gold);
    j.onLow(o.ox ? K.rbox(0.16, 0.1, 0.2, 0.03) : K.sph(0.08, 8), m.gold, foot.x, 0.06, foot.z - 0.04);
    rig.legs.push({ up: j.up, low: j.low, phase: sx * sz > 0 ? 0 : Math.PI, amp: 0.85 });
  });
  // tail
  const tail = grp(body, 0, 0.9, 0.65);
  for (let i = 0; i < 4; i++) mk(tail, K.cyl(0.04 - i * 0.006, 0.045 - i * 0.006, 0.22, 6), m.white, 0, -0.04 * i, 0.12 + i * 0.2, Math.PI / 2, 0, 0);
  if (o.ox) mk(tail, K.sph(0.09, 8), m.gold, 0, -0.18, 0.95);
  else {
    mk(tail, K.sph(0.12, 8), m.glowG, 0, -0.18, 0.95);
    mk(tail, K.sph(0.24, 8), m.haloG, 0, -0.18, 0.95);
  }
  rig.tails.push({ obj: tail, phase: 0.4, amp: 1.2 });
  // wings folded upright on the back
  for (const sx of [-1, 1]) {
    const w = wing(e, body, sx, sx * 0.18, 1.08, 0.18, o.ox ? 1.0 : 1.3, { u0: 0.2, u1: 1.3, pose: [0, sx * 0.3, 0.0], gold: o.ox });
    rig.flutters.push({ obj: w.pv, phase: sx * 1.1, amp: 1.5 });
  }
  rig.gait = { freq: o.ox ? 1.2 : 1.5, swing: 0.9, knee: 0.9, bob: 0.05, lean: 0.07 };
  rig.lunge = o.ox ? 0.5 : 0.4;
}
function buildLionwing(root: THREE.Group, rig: EnemyRig): EliteStats {
  quadruped(edenKit(), root, rig, { ox: false });
  return { hp: 260, speed: 7.4, damage: 26 };
}
function buildBullwing(root: THREE.Group, rig: EnemyRig): EliteStats {
  quadruped(edenKit(), root, rig, { ox: true });
  return { hp: 340, speed: 6.6, damage: 30 };
}

// ───────────────────────── ARCHANGEL ─────────────────────────
function buildArchangel(root: THREE.Group, rig: EnemyRig): EliteStats {
  const e = edenKit();
  const h = humanoid(e, root, rig, { s: 1.0, walk: true, armor: true, wings: 'two', wingLen: 1.7 });
  // flaming sword in the right hand, pointed forward; round shield of light on the left arm
  fireSword(e, h.arms[1].low, 1.5, 0.36, 0.98, -0.34, -Math.PI / 2 + 0.1, 0, 0);
  const sh = e.K.grp(h.arms[0].low, -0.4, 1.0, -0.36);
  e.K.mk(sh, e.K.cyl(0.34, 0.34, 0.05, 20), e.m.white, 0, 0, 0, Math.PI / 2, 0, 0);
  e.K.mk(sh, e.K.torus(0.34, 0.03, 24, 6), e.m.gold, 0, 0, 0);
  e.K.mk(sh, e.K.sph(0.07, 8), e.m.glowG, 0, 0, -0.05);
  rig.gait = { freq: 1.45, swing: 0.85, knee: 1.0, bob: 0.07, lean: 0.1 };
  rig.lunge = 0.4;
  return { hp: 220, speed: 7.8, damage: 36 };
}

// ───────────────────────── PRINCIPALITY ─────────────────────────
function buildPrincipality(root: THREE.Group, rig: EnemyRig): EliteStats {
  const e = edenKit();
  const { K, m } = e;
  const h = humanoid(e, root, rig, { s: 1.0, walk: true, armor: true, crown: true, wings: 'two', wingLen: 1.4 });
  // long spear with a leaf-shaped head; a flowing cape of light
  const sp = K.grp(h.arms[1].low, 0.36, 0.98, -0.3);
  K.mk(sp, K.cyl(0.022, 0.022, 2.3, 6), m.gold, 0, 0, -0.5, Math.PI / 2, 0, 0);
  K.mk(sp, K.blade(0.55, 0.16, 0.04), m.glowW, 0, 0, -1.9, -Math.PI / 2, 0, 0);
  K.mk(sp, K.sph(0.2, 8), m.haloW, 0, 0, -2.05);
  for (let i = 0; i < 3; i++) K.mk(sp, K.torus(0.05, 0.012, 12, 5), m.gold, 0, 0, -1.2 + i * 0.12, 0, 0, 0);
  const cape = K.grp(h.body, 0, 1.6, 0.16);
  K.mk(cape, new THREE.PlaneGeometry(0.62, 1.25), m.glowG, 0, -0.62, 0.04, 0.08, 0, 0).material = new THREE.MeshBasicMaterial({ color: 0xfff3c0, transparent: true, opacity: 0.55, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false });
  rig.flutters.push({ obj: cape, phase: 0.5, amp: 1.3 });
  rig.gait = { freq: 1.4, swing: 0.85, knee: 1.0, bob: 0.07, lean: 0.1 };
  rig.lunge = 0.38;
  return { hp: 200, speed: 7.4, damage: 34 };
}

// ───────────────────────── POWERS ─────────────────────────
function buildPowers(root: THREE.Group, rig: EnemyRig): EliteStats {
  const e = edenKit();
  const { K, m } = e;
  const h = humanoid(e, root, rig, { s: 1.08, walk: true, armor: true, wings: 'two', wingLen: 1.25 });
  // broken chains wrapped over the chest and trailing from the wrists; a mace of light
  for (let i = 0; i < 2; i++) K.mk(h.body, K.torus(0.34, 0.025, 20, 6), m.goldDark, 0, 1.28, 0, Math.PI / 2 + (i ? 0.5 : -0.5), 0, i ? 0.3 : -0.3);
  for (const arm of h.arms) {
    for (let k = 0; k < 4; k++) {
      const link = K.mk(arm.low, K.torus(0.045, 0.012, 10, 5), m.goldDark, 0, 0, 0);
      link.position.set(arm.low.position.x * 0, -0.1 - k * 0.1, 0.02);
      link.rotation.set(0, k % 2 ? Math.PI / 2 : 0, 0);
    }
  }
  const mace = K.grp(h.arms[1].low, 0.36, 0.98, -0.3);
  K.mk(mace, K.cyl(0.03, 0.03, 1.1, 6), m.gold, 0, 0, -0.4, Math.PI / 2, 0, 0);
  K.mk(mace, K.sph(0.2, 10), m.glowW, 0, 0, -1.0);
  K.mk(mace, K.sph(0.36, 10), m.haloG, 0, 0, -1.0);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    K.mk(mace, K.cone(0.04, 0.16, 4), m.gold, Math.cos(a) * 0.2, Math.sin(a) * 0.2, -1.0, 0, 0, a - Math.PI / 2);
  }
  rig.gait = { freq: 1.3, swing: 0.8, knee: 0.95, bob: 0.08, lean: 0.08 };
  rig.lunge = 0.4;
  return { hp: 240, speed: 7.0, damage: 38 };
}

// ───────────────────────── TRUMPETER ─────────────────────────
function buildTrumpeter(root: THREE.Group, rig: EnemyRig): EliteStats {
  const e = edenKit();
  const { K, m } = e;
  const h = humanoid(e, root, rig, { s: 1.0, lift: 1.6, wings: 'four', wingLen: 1.6, robe: true });
  rig.scanners.push({ obj: h.head, phase: 0, amp: 1 });
  // raised arms hold a great trumpet along the line of fire; sound rings at the bell
  const gun = K.grp(h.body, 0, 1.45, -0.3);
  rig.recoils.push({ obj: gun, amp: 0.8 });
  K.mk(gun, K.cyl(0.035, 0.035, 0.9, 8), m.gold, 0, 0, -0.45, Math.PI / 2, 0, 0);
  K.mk(gun, new THREE.CylinderGeometry(0.04, 0.5, 1.5, 14, 1, true), m.gold, 0, 0, -1.55, Math.PI / 2, 0, 0).material = new THREE.MeshStandardMaterial({ color: 0xe8b83c, emissive: 0xb8860b, emissiveIntensity: 0.6, metalness: 0.6, roughness: 0.3, side: THREE.DoubleSide });
  K.mk(gun, K.torus(0.5, 0.04, 20, 8), m.gold, 0, 0, -2.3);
  K.mk(gun, K.cyl(0.42, 0.42, 0.04, 20), m.glowW, 0, 0, -2.29, Math.PI / 2, 0, 0);
  const bell = K.mk(gun, K.sph(0.3, 10), m.haloW, 0, 0, -2.4);
  rig.pulses.push({ obj: bell, amp: 0.6, speed: 2 });
  for (let i = 0; i < 3; i++) K.mk(gun, K.torus(0.3 + i * 0.16, 0.012, 20, 5), m.glowG, 0, 0, -2.6 - i * 0.18);
  for (const arm of h.arms) { arm.up.rotation.x = -1.2; arm.low.rotation.x = -0.5; }
  rig.hover = { bob: 0.14, tilt: 0.05 };
  rig.gait = { freq: 0.8, swing: 0.4, knee: 0.4, bob: 0.015, lean: 0.02 };
  rig.lunge = 0.08;
  return { hp: 230, speed: 4.2, damage: 38 };
}

// ───────────────────────── CENSER ANGEL ─────────────────────────
function buildCenser(root: THREE.Group, rig: EnemyRig): EliteStats {
  const e = edenKit();
  const { K, m } = e;
  const h = humanoid(e, root, rig, { s: 1.0, lift: 1.5, wings: 'two', wingLen: 1.7, robe: true, crown: true });
  rig.scanners.push({ obj: h.head, phase: 0, amp: 1 });
  // a golden censer on chains, swung forward; smoke and fire spill from its lid
  const gun = K.grp(h.body, 0.4, 1.05, -0.5);
  rig.recoils.push({ obj: gun, amp: 0.9 });
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    K.mk(gun, K.cyl(0.008, 0.008, 0.7, 4), m.goldDark, Math.cos(a) * 0.12, 0.34, Math.sin(a) * 0.12);
  }
  K.mk(gun, K.sph(0.26, 12), m.gold, 0, -0.1, 0).scale.set(1, 0.85, 1);
  K.mk(gun, K.torus(0.26, 0.03, 20, 6), m.goldDark, 0, -0.1, 0, Math.PI / 2, 0, 0);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    K.mk(gun, K.box(0.04, 0.12, 0.02), m.dark, Math.cos(a) * 0.24, -0.04, Math.sin(a) * 0.24, 0, -a, 0);
  }
  const fire = K.mk(gun, K.sph(0.15, 10), m.glowFire, 0, 0.1, 0);
  K.mk(gun, K.sph(0.34, 10), m.haloFire, 0, 0.1, 0);
  rig.pulses.push({ obj: fire, amp: 0.5, speed: 1.8 });
  K.mk(gun, K.cone(0.1, 0.4, 7), m.haloW, 0, 0.45, 0);
  h.arms[1].up.rotation.x = -0.9;
  rig.hover = { bob: 0.12, tilt: 0.05 };
  rig.gait = { freq: 0.8, swing: 0.4, knee: 0.4, bob: 0.015, lean: 0.02 };
  rig.lunge = 0.08;
  return { hp: 240, speed: 4.0, damage: 40 };
}

// ───────────────────────── DOMINION ─────────────────────────
function buildDominion(root: THREE.Group, rig: EnemyRig): EliteStats {
  const e = edenKit();
  const { K, m } = e;
  const h = humanoid(e, root, rig, { s: 1.9, walk: true, armor: true, crown: true, wings: 'two', wingLen: 1.6 });
  // sceptre topped with a glowing orb; a heavy golden collar
  const sc = K.grp(h.arms[1].low, 0.36, 0.98, -0.3);
  K.mk(sc, K.cyl(0.03, 0.03, 1.8, 6), m.gold, 0, 0.3, 0, 0, 0, 0);
  const orb = K.mk(sc, K.sph(0.18, 12), m.glowW, 0, 1.25, 0);
  K.mk(sc, K.sph(0.34, 12), m.haloG, 0, 1.25, 0);
  K.mk(sc, K.torus(0.24, 0.025, 20, 6), m.gold, 0, 1.25, 0, Math.PI / 2, 0.4, 0);
  K.mk(sc, K.torus(0.24, 0.025, 20, 6), m.gold, 0, 1.25, 0, 0.4, 0, 0);
  rig.pulses.push({ obj: orb, amp: 0.3, speed: 1.2 });
  K.mk(h.body, K.torus(0.42, 0.06, 20, 8), m.gold, 0, 1.68, 0, Math.PI / 2, 0, 0);
  // a ring of floating gold sigils behind the head
  const sig = K.grp(h.body, 0, 2.0, 0.3);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    K.mk(sig, K.box(0.05, 0.16, 0.02), m.glowG, Math.cos(a) * 0.5, Math.sin(a) * 0.5, 0, 0, 0, a);
  }
  rig.spinners.push({ obj: sig, axis: 'z', speed: 0.9 });
  rig.gait = { freq: 0.8, swing: 0.55, knee: 0.55, bob: 0.07, lean: 0.045 };
  rig.lunge = 0.3;
  return { hp: 520, speed: 3.7, damage: 42 };
}

// ───────────────────────── GATEKEEPER ─────────────────────────
function buildGatekeeper(root: THREE.Group, rig: EnemyRig): EliteStats {
  const e = edenKit();
  const { K, m } = e;
  const h = humanoid(e, root, rig, { s: 1.7, walk: true, armor: true, wings: 'four', wingLen: 1.7 });
  // the flaming sword that turns every way (Genesis 3:24), hovering and spinning at the right hand
  const turn = K.grp(h.body, 0.75, 1.3, -0.7);
  const sw = fireSword(e, turn, 1.9, 0, -0.95, 0, 0, 0, 0);
  void sw;
  rig.spinners.push({ obj: turn, axis: 'y', speed: 2.4 });
  K.mk(turn, K.torus(0.5, 0.02, 24, 6), m.haloFire, 0, 0, 0, Math.PI / 2, 0, 0);
  // faces of the cherub on the chest plate and shoulders
  for (const sx of [-1, 1]) eye(e, h.body, 0.08, sx * 0.34, 1.62, -0.12, new THREE.Vector3(sx * 0.3, 0.2, -1));
  const crest = K.grp(h.head, 0, 0.16, 0);
  for (let i = -2; i <= 2; i++) K.mk(crest, K.cone(0.025, 0.28, 4), m.gold, i * 0.07, 0.2 - Math.abs(i) * 0.03, 0, 0, 0, -i * 0.25);
  rig.gait = { freq: 0.8, swing: 0.55, knee: 0.55, bob: 0.07, lean: 0.045 };
  rig.lunge = 0.3;
  return { hp: 560, speed: 3.6, damage: 44 };
}

// ───────────────────────── THRONE ─────────────────────────
function buildThrone(root: THREE.Group, rig: EnemyRig): EliteStats {
  const e = edenKit();
  const { K, m } = e;
  const { V, mk, grp, artic } = K;
  const body = new THREE.Group();
  root.add(body);
  rig.body = body;
  // a walking chariot-throne: a broad pearl seat with a high back, carried on four stout legs
  mk(body, K.rbox(1.6, 0.5, 1.5, 0.15), m.pearl, 0, 1.3, 0);
  mk(body, K.rbox(1.3, 1.6, 0.3, 0.1), m.white, 0, 2.3, 0.55);
  mk(body, K.rbox(1.5, 0.12, 1.5, 0.05), m.gold, 0, 1.58, 0);
  for (const sx of [-1, 1]) {
    mk(body, K.rbox(0.18, 0.6, 1.2, 0.06), m.white, sx * 0.72, 1.9, 0.0);
    mk(body, K.sph(0.14, 8), m.gold, sx * 0.72, 2.25, -0.5);
  }
  mk(body, K.cone(0.22, 0.8, 4), m.gold, 0, 3.4, 0.55);
  const seat = mk(body, K.sph(0.2, 12), m.glowW, 0, 1.95, -0.1);
  mk(body, K.sph(0.5, 12), m.haloG, 0, 1.95, -0.1);
  rig.pulses.push({ obj: seat, amp: 0.3, speed: 1.2 });
  // veiled occupant: a sheet of light
  mk(body, new THREE.PlaneGeometry(0.8, 1.2), new THREE.MeshBasicMaterial({ color: 0xfff3c0, transparent: true, opacity: 0.55, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }), 0, 2.2, 0.35);
  // two upright eye-wheels on either side
  for (const sx of [-1, 1]) {
    const wheel = grp(body, sx * 1.15, 2.1, 0, 0, Math.PI / 2, 0);
    const spin = grp(wheel);
    mk(spin, K.torus(0.8, 0.07, 36, 10), m.gold);
    mk(spin, K.torus(0.62, 0.025, 36, 8), m.glowG);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      mk(spin, K.sph(0.07, 8), m.glowW, Math.cos(a) * 0.8, Math.sin(a) * 0.8, 0).scale.z = 0.5;
      mk(spin, K.sph(0.035, 6), m.dark, Math.cos(a) * 0.8, Math.sin(a) * 0.8, 0.03);
    }
    for (let i = 0; i < 4; i++) mk(spin, K.box(1.6, 0.025, 0.025), m.glowG, 0, 0, 0, 0, 0, (i / 4) * Math.PI);
    mk(wheel, K.sph(0.12, 8), m.glowW);
    rig.spinners.push({ obj: spin, axis: 'z', speed: sx * 1.6 });
  }
  // four legs
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
    const j = artic(root, V(sx * 0.62, 1.2, sz * 0.5), V(sx * 0.7, 0.7, sz * 0.55), V(sx * 0.68, 0.05, sz * 0.58), 0.2, 0.16, m.white, m.pearl, 0.17, m.gold);
    j.onLow(K.rbox(0.42, 0.14, 0.52, 0.05), m.gold, sx * 0.68, 0.07, sz * 0.58 - 0.04);
    rig.legs.push({ up: j.up, low: j.low, phase: sx * sz > 0 ? 0 : Math.PI, amp: 0.7 });
  });
  halo(e, body, 0.8, 0, 3.2, 0.5, 0);
  rig.gait = { freq: 0.7, swing: 0.5, knee: 0.5, bob: 0.06, lean: 0.03 };
  rig.lunge = 0.25;
  return { hp: 600, speed: 3.4, damage: 46 };
}

// ───────────────────────── VIRTUE ─────────────────────────
function buildVirtue(root: THREE.Group, rig: EnemyRig): EliteStats {
  const e = edenKit();
  const { K, m } = e;
  const h = humanoid(e, root, rig, { s: 0.9, wings: 'two', wingLen: 1.6, robe: true });
  // lily staff: the heal source
  const st = K.grp(h.arms[1].low, 0.36, 0.98, -0.3);
  K.mk(st, K.cyl(0.02, 0.02, 1.7, 6), m.gold, 0, 0.25, 0);
  const core = K.mk(st, K.sph(0.11, 10), m.glowG, 0, 1.2, 0);
  K.mk(st, K.sph(0.3, 10), m.haloG, 0, 1.2, 0);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    K.mk(st, K.feather(0.28, 0.1, 0.02), m.feather, Math.cos(a) * 0.04, 1.14, Math.sin(a) * 0.04, 0.5 * Math.sin(a), 0, -0.5 * Math.cos(a)).rotation.y = a;
  }
  rig.pulses.push({ obj: core, amp: 0.4, speed: 1.5 });
  rig.extras.core = core;
  // a halo of soft stars around the body
  const stars = K.grp(h.body, 0, 1.3, 0);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    K.mk(stars, K.sph(0.035, 6), m.glowW, Math.cos(a) * 0.62, 0, Math.sin(a) * 0.62);
  }
  rig.spinners.push({ obj: stars, axis: 'y', speed: 1.1 });
  rig.hover = { bob: 0.14, tilt: 0.06 };
  return { hp: 150, speed: 4.8, damage: 18 };
}

/** Builds a PROJECT EDEN enemy into `group` (registers its animation rig); returns null for other types. */
export function buildEdenEnemy(type: string, group: THREE.Group): EliteStats | null {
  if (!isEdenType(type)) return null;
  const rig = createRig(type);
  group.userData.enemyRig = rig;
  switch (type) {
    case 'messenger': return buildMessenger(group, rig);
    case 'ophanim': return buildOphanim(group, rig);
    case 'cherubim': return buildCherubim(group, rig);
    case 'seraphim': return buildSeraphim(group, rig);
    case 'lionwing': return buildLionwing(group, rig);
    case 'bullwing': return buildBullwing(group, rig);
    case 'archangel': return buildArchangel(group, rig);
    case 'principality': return buildPrincipality(group, rig);
    case 'powers': return buildPowers(group, rig);
    case 'trumpeter': return buildTrumpeter(group, rig);
    case 'censer': return buildCenser(group, rig);
    case 'dominion': return buildDominion(group, rig);
    case 'gatekeeper': return buildGatekeeper(group, rig);
    case 'throne': return buildThrone(group, rig);
    case 'virtue': return buildVirtue(group, rig);
  }
  return null;
}
