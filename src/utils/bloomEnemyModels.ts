import * as THREE from 'three';
import { createRig, EnemyRig } from './enemyAnimation';
import { kit, EliteStats } from './eliteEnemyModels';

/**
 * MAP 7 (OVERGROWN SECTOR) roster: machines that have been taken over by vines, bark and fungus.
 * Each type reuses the movement / attack AI of a base category (see ENEMY_BASE_CATEGORY in BattleScene3D) and
 * only brings its own body, so they all animate through the generic rig (legs, arms, head, spinners ...).
 *
 *   bramble    BRAMBLE HOUND    棘蔦の猟犬機       (hound AI)
 *   pollen     POLLEN DRONE     花粉ドローン       (drone AI)
 *   creeper    IVY CREEPER      蔦の暗殺機         (stalker AI)
 *   thistle    THISTLE SENTRY   薊の固定砲台       (sentry AI)
 *   treant     TREANT GOLEM     樹人ゴーレム       (golem AI)
 *   rafflesia  RAFFLESIA MORTAR 花弁の砲兵         (titan AI)
 *   mushling   MUSHLING         茸の小型機兵       (hound AI, brood of MYCO KING)
 *
 * Every model faces -Z with its feet on y = 0 (flying types are centred on their origin).
 */

export const BLOOM_TYPES = ['bramble', 'pollen', 'creeper', 'thistle', 'treant', 'rafflesia', 'mushling'] as const;
export type BloomType = (typeof BLOOM_TYPES)[number];
export const isBloomType = (t: string): t is BloomType => (BLOOM_TYPES as readonly string[]).includes(t);

// ───────────────────────── textures / materials ─────────────────────────
let barkTex: THREE.CanvasTexture | null = null;
/** Vertical bark grain with mossy blotches. */
function barkTexture(): THREE.CanvasTexture {
  if (barkTex) return barkTex;
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  g.fillStyle = '#5a4128';
  g.fillRect(0, 0, S, S);
  for (let i = 0; i < 260; i++) {
    const x = Math.random() * S;
    const w = 1 + Math.random() * 4;
    g.strokeStyle = Math.random() < 0.55 ? 'rgba(20,12,4,0.55)' : 'rgba(190,150,100,0.22)';
    g.lineWidth = w;
    g.beginPath();
    g.moveTo(x, 0);
    for (let y = 0; y <= S; y += 32) g.lineTo(x + Math.sin(y * 0.05 + i) * 4, y);
    g.stroke();
  }
  for (let i = 0; i < 26; i++) {
    g.fillStyle = `rgba(${70 + Math.random() * 30},${120 + Math.random() * 40},30,${0.25 + Math.random() * 0.3})`;
    g.beginPath();
    g.ellipse(Math.random() * S, Math.random() * S, 8 + Math.random() * 22, 5 + Math.random() * 12, Math.random() * 3, 0, Math.PI * 2);
    g.fill();
  }
  barkTex = new THREE.CanvasTexture(c);
  barkTex.colorSpace = THREE.SRGBColorSpace;
  barkTex.wrapS = barkTex.wrapT = THREE.RepeatWrapping;
  return barkTex;
}

function plantKit() {
  const K = kit();
  const tex = barkTexture();
  const m = {
    bark: K.armor(0x8a6a44, tex, 0.1, 0.75, 0.1),
    barkDark: K.armor(0x4a3420, tex, 0.1, 0.8, 0.05),
    moss: K.solid(0x4d7c0f, 0.05, 0.85),
    leaf: K.solid(0x65a30d, 0.1, 0.55),
    leafDark: K.solid(0x3f6212, 0.1, 0.6),
    steel: K.solid(0x64748b, 0.85, 0.32),
    steelDark: K.solid(0x1e293b, 0.85, 0.4),
    thorn: K.solid(0xe9e7b0, 0.2, 0.5),
    cream: K.solid(0xf3ead2, 0.1, 0.6),
    lime: K.glow(0xa3e635),
    limeHalo: K.halo(0xbef264, 0.22),
    pink: K.glow(0xf472b6),
    pinkHalo: K.halo(0xf9a8d4, 0.22),
    amber: K.glow(0xfbbf24),
    amberHalo: K.halo(0xfcd34d, 0.24),
    purple: K.glow(0xc084fc),
    pollen: K.glow(0xfde047),
    pollenHalo: K.halo(0xfef08a, 0.22),
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

// ───────────────────────── BRAMBLE HOUND ─────────────────────────
function buildBramble(root: THREE.Group, rig: EnemyRig): EliteStats {
  const { K, m } = plantKit();
  const { rbox, cone, torus, sph, V, mk, grp, artic, strut, feather } = K;
  const body = new THREE.Group();
  root.add(body);
  rig.body = body;

  mk(body, rbox(0.62, 0.4, 1.15, 0.12), m.barkDark, 0, 0.8, 0.05);
  mk(body, rbox(0.7, 0.3, 0.6, 0.1), m.bark, 0, 0.88, -0.3, 0.1, 0, 0); // shoulder armour
  mk(body, rbox(0.56, 0.22, 0.5, 0.08), m.moss, 0, 0.98, 0.3);          // mossy haunch
  // vine wraps
  for (let i = 0; i < 4; i++) {
    const w = mk(body, torus(0.3, 0.025, 20, 6), m.leaf, 0, 0.8, -0.35 + i * 0.28);
    w.scale.set(1.02, 0.8, 1);
  }
  // thorn spines along the back
  for (let i = 0; i < 7; i++) spike(body, V(((i % 2) - 0.5) * 0.18, 1.0 + (i === 3 ? 0.04 : 0), -0.45 + i * 0.18), V(0, 1, 0.55), 0.045, 0.34 - Math.abs(i - 3) * 0.02, m.thorn, 4);
  // rose bud on the shoulder
  const bud = mk(body, sph(0.1, 10), m.pink, 0.0, 1.2, -0.35);
  mk(body, sph(0.2, 10), m.pinkHalo, 0, 1.2, -0.35);
  rig.pulses.push({ obj: bud, amp: 1.2, speed: 1.1 });

  // head with antler branches
  const head = grp(body, 0, 0.98, -0.7);
  rig.head = head;
  mk(head, rbox(0.34, 0.3, 0.46, 0.1), m.bark, 0, 0, 0);
  mk(head, rbox(0.24, 0.18, 0.34, 0.07), m.barkDark, 0, -0.04, -0.34);
  [-1, 1].forEach((s) => {
    mk(head, sph(0.04, 8), m.lime, s * 0.1, 0.05, -0.23);
    mk(head, feather(0.34, 0.12, 0.02), m.leaf, s * 0.17, 0.12, 0.08, 0.5, 0, -s * 0.9); // leaf ears
    // antler: a branching thorn stalk
    const a = V(s * 0.1, 0.14, 0.02), b = V(s * 0.22, 0.46, 0.0), c = V(s * 0.12, 0.66, -0.06);
    strut(head, a, b, 0.035, 0.025, m.barkDark);
    strut(head, b, c, 0.025, 0.015, m.barkDark);
    spike(head, b, V(s * 0.9, 0.35, 0), 0.02, 0.22, m.thorn, 4);
    spike(head, c, V(0, 1, -0.2), 0.02, 0.2, m.thorn, 4);
  });
  const jaw = grp(head, 0, -0.1, -0.05);
  rig.jaw = jaw;
  mk(jaw, rbox(0.22, 0.08, 0.34, 0.03), m.barkDark, 0, -0.03, -0.2);
  for (let i = -2; i <= 2; i++) spike(jaw, V(i * 0.045, 0.0, -0.34), V(0, 1, -0.2), 0.016, 0.1, m.thorn, 4);

  // legs
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
    const hip = V(sx * 0.26, 0.78, sz * 0.4), knee = V(sx * 0.38, 0.5, sz * 0.46), foot = V(sx * 0.32, 0.04, sz * 0.52);
    const j = artic(root, hip, knee, foot, 0.075, 0.055, m.bark, m.moss, 0.075, m.barkDark);
    j.onLow(cone(0.07, 0.24, 4), m.thorn, foot.x, 0.1, foot.z - 0.1, -Math.PI / 2, 0, 0);
    rig.legs.push({ up: j.up, low: j.low, phase: sx * sz > 0 ? 0 : Math.PI, amp: 0.8 });
  });
  // tail: whip of vine ending in a leaf blade
  const tail = grp(body, 0, 0.9, 0.6);
  strut(tail, V(0, 0, 0), V(0, -0.1, 0.7), 0.05, 0.03, m.leafDark);
  mk(tail, feather(0.4, 0.16, 0.025), m.leaf, 0, -0.1, 0.8, Math.PI / 2, 0, 0);
  rig.tails.push({ obj: tail, phase: 0.6, amp: 1 });
  rig.gait = { freq: 1.25, swing: 0.8, knee: 0.9, bob: 0.05, lean: 0.05 };
  rig.lunge = 0.35;
  return { hp: 230, speed: 6.2, damage: 22 };
}

// ───────────────────────── POLLEN DRONE ─────────────────────────
function buildPollen(root: THREE.Group, rig: EnemyRig): EliteStats {
  const { K, m } = plantKit();
  const { sph, cone, cyl, V, mk, grp, strut, feather, lathe } = K;
  const body = new THREE.Group();
  root.add(body);
  rig.body = body;

  // seed-pod hull around a glowing pollen core
  mk(body, lathe([[0, -0.36], [0.18, -0.34], [0.34, -0.2], [0.4, 0], [0.34, 0.2], [0.16, 0.33], [0, 0.36]], 18), m.barkDark);
  const core = mk(body, sph(0.24, 14), m.pollen);
  mk(body, sph(0.44, 14), m.pollenHalo);
  rig.pulses.push({ obj: core, amp: 1.3, speed: 1.2 }, { obj: body.children[body.children.length - 1], amp: 1.0, phase: 0.5 });
  // sepal leaves clamping the pod
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const o = grp(body, 0, 0.1, 0, 0, a, 0);
    mk(o, feather(0.5, 0.22, 0.03), m.leaf, 0, -0.05, -0.28, -0.25, 0, 0);
  }
  // eye lens
  mk(body, cyl(0.12, 0.12, 0.06, 14), m.steelDark, 0, 0.02, -0.4, Math.PI / 2, 0, 0);
  const eye = mk(body, sph(0.07, 10), m.lime, 0, 0.02, -0.45);
  rig.pulses.push({ obj: eye, amp: 1.6, speed: 1.8 });

  // petal rotor: six big petals spinning like a flower-shaped propeller
  const rotor = grp(body, 0, 0.42, 0);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const arm = grp(rotor, 0, 0, 0, 0, a, 0);
    mk(arm, feather(0.78, 0.32, 0.025), i % 2 ? K.glow(0xf9a8d4) : K.glow(0xfbcfe8), 0.0, 0, -0.1, Math.PI / 2 - 0.12, 0, 0);
  }
  mk(rotor, sph(0.07, 8), m.amber, 0, 0.0, 0);
  rig.spinners.push({ obj: rotor, axis: 'y', speed: 18 });
  mk(body, cyl(0.03, 0.05, 0.14, 8), m.barkDark, 0, 0.34, 0);
  // stamens dangling below (they tremble with movement)
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const st = grp(body, Math.cos(a) * 0.15, -0.3, Math.sin(a) * 0.15);
    strut(st, V(0, 0, 0), V(Math.cos(a) * 0.05, -0.34, Math.sin(a) * 0.05), 0.012, 0.008, m.leafDark);
    mk(st, sph(0.035, 6), m.pollen, Math.cos(a) * 0.05, -0.36, Math.sin(a) * 0.05);
    rig.flutters.push({ obj: st, phase: i * 1.1, amp: 1.2 });
  }
  // twin spore sacs on the flanks
  [-1, 1].forEach((s) => {
    mk(body, cone(0.05, 0.16, 5), m.thorn, s * 0.42, -0.04, 0.05, 0, 0, -s * Math.PI / 2);
    const sac = mk(body, sph(0.1, 8), m.pollen, s * 0.5, -0.04, 0.05);
    rig.pulses.push({ obj: sac, amp: 1.4, phase: s });
  });
  rig.hover = { bob: 0.07, tilt: 0.05 };
  rig.lunge = 0.2;
  return { hp: 95, speed: 5.4, damage: 15 };
}

// ───────────────────────── IVY CREEPER ─────────────────────────
function buildCreeper(root: THREE.Group, rig: EnemyRig): EliteStats {
  const { K, m } = plantKit();
  const { rbox, sph, torus, V, mk, grp, artic, strut, feather, cone } = K;
  const body = new THREE.Group();
  root.add(body);
  rig.body = body;

  mk(body, rbox(0.46, 0.72, 0.3, 0.1), m.barkDark, 0, 1.28, 0);
  mk(body, rbox(0.34, 0.26, 0.26, 0.08), m.moss, 0, 0.86, 0);
  const bud = mk(body, sph(0.13, 12), m.lime, 0, 1.36, -0.17);
  mk(body, sph(0.24, 12), m.limeHalo, 0, 1.36, -0.18);
  rig.pulses.push({ obj: bud, amp: 1.2 });
  for (let i = 0; i < 3; i++) {
    const w = mk(body, torus(0.27, 0.02, 22, 6), m.leaf, 0, 1.06 + i * 0.22, 0, Math.PI / 2, 0, 0);
    w.scale.set(1, 0.7, 1);
  }
  // head: a closed flower bud with one eye slit
  const head = grp(body, 0, 1.85, -0.02);
  rig.head = head;
  mk(head, sph(0.19, 12), m.leafDark);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const o = grp(head, 0, -0.1, 0, 0, a, 0);
    mk(o, feather(0.5, 0.26, 0.03), i % 2 ? m.leaf : m.moss, 0, 0, -0.1, -0.12, 0, 0);
  }
  mk(head, K.box(0.18, 0.035, 0.04), m.lime, 0, 0.0, -0.19);
  spike(head, V(0, 0.5, 0), V(0, 1, 0), 0.05, 0.22, m.pink, 5);
  // arms ending in leaf scythes
  [-1, 1].forEach((s) => {
    const arm = artic(body, V(s * 0.32, 1.55, 0), V(s * 0.42, 1.12, -0.12), V(s * 0.38, 0.86, -0.32), 0.045, 0.04, m.barkDark, m.leafDark, 0.055, m.moss);
    arm.onLow(feather(1.0, 0.22, 0.03), m.leaf, s * 0.38, 0.86, -0.36, -Math.PI / 2 + 0.25, 0, 0);
    arm.onLow(feather(0.9, 0.06, 0.035), m.lime, s * 0.38, 0.86, -0.38, -Math.PI / 2 + 0.25, 0, 0);
    rig.arms.push({ up: arm.up, low: arm.low, phase: s < 0 ? Math.PI : 0, amp: 0.9 });
    const leg = artic(root, V(s * 0.15, 0.8, 0), V(s * 0.22, 0.45, -0.14), V(s * 0.18, 0.04, 0.04), 0.07, 0.05, m.bark, m.moss, 0.07);
    leg.onLow(cone(0.06, 0.25, 4), m.thorn, s * 0.18, 0.05, -0.12, -Math.PI / 2, 0, 0);
    rig.legs.push({ up: leg.up, low: leg.low, phase: s < 0 ? 0 : Math.PI, amp: 1 });
  });
  // trailing ivy cloak
  for (let i = 0; i < 6; i++) {
    const sp = grp(body, (i - 2.5) * 0.11, 1.55 - Math.abs(i - 2.5) * 0.08, 0.17);
    strut(sp, V(0, 0, 0), V(0, -0.5 - (i % 3) * 0.12, 0.14), 0.02, 0.012, m.leafDark);
    mk(sp, feather(0.34, 0.16, 0.02), i % 2 ? m.leaf : m.moss, 0, -0.5 - (i % 3) * 0.12, 0.14, 2.6, 0, 0);
    rig.flutters.push({ obj: sp, phase: i * 0.8, amp: 1.2 });
  }
  rig.gait = { freq: 1.3, swing: 0.8, knee: 1.0, bob: 0.07, lean: 0.08 };
  rig.lunge = 0.35;
  return { hp: 180, speed: 7.0, damage: 28 };
}

// ───────────────────────── THISTLE SENTRY ─────────────────────────
function buildThistle(root: THREE.Group, rig: EnemyRig): EliteStats {
  const { K, m } = plantKit();
  const { cyl, sph, V, mk, grp, artic } = K;
  const body = new THREE.Group();
  root.add(body);
  rig.body = body;

  mk(body, cyl(0.52, 0.74, 0.2, 10), m.barkDark, 0, 0.1, 0);
  mk(body, K.torus(0.62, 0.03, 8, 10), m.lime, 0, 0.22, 0, Math.PI / 2, 0, 0);
  for (let i = 0; i < 3; i++) { // tripod roots
    const a = (i / 3) * Math.PI * 2 + Math.PI / 2;
    const ca = Math.cos(a), sa = Math.sin(a);
    const j = artic(root, V(ca * 0.3, 0.42, sa * 0.3), V(ca * 0.7, 0.52, sa * 0.7), V(ca * 0.9, 0.04, sa * 0.9), 0.06, 0.045, m.bark, m.moss, 0.06, m.barkDark);
    j.onLow(K.cone(0.09, 0.2, 5), m.barkDark, ca * 0.92, 0.06, sa * 0.92, Math.PI, 0, 0);
    rig.legs.push({ up: j.up, low: j.low, phase: i * ((Math.PI * 2) / 3), amp: 0.55 });
  }
  mk(body, cyl(0.16, 0.26, 0.5, 8), m.bark, 0, 0.45, 0);

  const head = grp(body, 0, 0.98, 0);
  rig.scanners.push({ obj: head, phase: 0, amp: 1 });
  mk(head, sph(0.42, 14), m.leaf);
  mk(head, sph(0.3, 10), m.leafDark, 0, -0.18, 0);
  // thistle prickles all over the bulb (left clear around the front gun)
  const N = 30;
  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const th = i * 2.399;
    const d = V(Math.cos(th) * r, y, Math.sin(th) * r);
    if (d.z < -0.55 && Math.abs(d.y) < 0.55) continue;
    spike(head, d.clone().multiplyScalar(0.4), d, 0.04, 0.26, m.thorn, 4);
  }
  // purple flower crown
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const tilt = 0.5 + (i % 2) * 0.25;
    spike(head, V(Math.cos(a) * 0.1, 0.4, Math.sin(a) * 0.1), V(Math.sin(tilt) * Math.cos(a), Math.cos(tilt), Math.sin(tilt) * Math.sin(a)), 0.03, 0.46, i % 2 ? m.purple : K.glow(0xe9d5ff), 4);
  }
  const eyeHalo = mk(head, sph(0.12, 10), m.limeHalo, 0, 0.04, -0.4);
  rig.pulses.push({ obj: eyeHalo, amp: 1.2 });
  mk(head, cyl(0.1, 0.1, 0.07, 12), m.steelDark, 0, 0.04, -0.4, Math.PI / 2, 0, 0);
  mk(head, sph(0.055, 8), m.lime, 0, 0.04, -0.45);
  // twin needle launchers
  [-1, 1].forEach((s) => {
    const gun = grp(head);
    rig.recoils.push({ obj: gun, amp: 0.8 });
    mk(gun, cyl(0.05, 0.06, 0.8, 8), m.bark, s * 0.24, -0.12, -0.5, Math.PI / 2, 0, 0);
    mk(gun, cyl(0.07, 0.07, 0.16, 8), m.steelDark, s * 0.24, -0.12, -0.88, Math.PI / 2, 0, 0);
    rig.pulses.push({ obj: mk(gun, sph(0.04, 8), m.lime, s * 0.24, -0.12, -0.98), amp: 2 });
  });
  rig.gait = { freq: 0.8, swing: 0.5, knee: 0.5, bob: 0.015, lean: 0.02 };
  rig.lunge = 0.08;
  return { hp: 200, speed: 4.2, damage: 34 };
}

// ───────────────────────── TREANT GOLEM ─────────────────────────
function buildTreant(root: THREE.Group, rig: EnemyRig): EliteStats {
  const { K, m } = plantKit();
  const { rbox, sph, cone, torus, lathe, V, mk, grp, artic, strut } = K;
  const body = new THREE.Group();
  root.add(body);
  rig.body = body;

  mk(body, rbox(1.3, 0.5, 0.9, 0.15), m.barkDark, 0, 1.1, 0);
  // trunk torso
  const trunk = mk(body, lathe([[0, 0], [0.62, 0], [0.72, 0.3], [0.64, 0.8], [0.8, 1.3], [0.82, 1.5], [0.5, 1.68], [0, 1.7]], 20), m.bark, 0, 1.25, 0);
  trunk.scale.set(1, 1, 0.78);
  for (let i = 0; i < 5; i++) { // bark ridges
    const a = -0.8 + i * 0.4;
    mk(body, rbox(0.12, 1.2, 0.14, 0.04), m.barkDark, Math.sin(a) * 0.74, 2.0, -Math.cos(a) * 0.58, 0, -a, 0.06 * (i - 2));
  }
  // heartwood core in a root-framed hollow
  mk(body, rbox(0.62, 0.7, 0.2, 0.08), m.steelDark, 0, 2.0, -0.6);
  const heart = mk(body, sph(0.22, 14), m.amber, 0, 2.0, -0.62);
  mk(body, sph(0.4, 14), m.amberHalo, 0, 2.0, -0.62);
  rig.pulses.push({ obj: heart, amp: 1.3 }, { obj: body.children[body.children.length - 1], amp: 1.3, phase: 0.6 });
  mk(body, torus(0.34, 0.04, 8, 20), m.barkDark, 0, 2.0, -0.62);
  // head
  const head = grp(body, 0, 2.95, -0.28);
  rig.head = head;
  mk(head, rbox(0.5, 0.45, 0.45, 0.1), m.bark, 0, 0, 0);
  [-1, 1].forEach((s) => mk(head, K.box(0.12, 0.05, 0.06), m.lime, s * 0.12, 0.04, -0.23));
  mk(head, K.box(0.26, 0.04, 0.05), m.barkDark, 0, -0.12, -0.23);
  for (let i = 0; i < 5; i++) spike(head, V((i - 2) * 0.09, -0.2, -0.2), V(0, -1, -0.15), 0.035, 0.2 + (i % 2) * 0.08, m.moss, 5); // mossy beard
  // foliage crown
  const crown = grp(body, 0, 3.15, -0.05);
  [[0, 0.18, 0, 0.5], [-0.38, 0.04, 0.12, 0.34], [0.4, 0.06, 0.1, 0.36], [0.1, 0.1, 0.4, 0.3], [-0.14, 0.02, -0.38, 0.28]].forEach(([x, y, z, r], i) => {
    const ball = mk(crown, new THREE.IcosahedronGeometry(r, 1), i % 2 ? m.leaf : m.leafDark, x, y, z);
    ball.scale.y = 0.8;
  });
  [-1, 1].forEach((s) => {
    const fl = mk(crown, sph(0.07, 8), m.pink, s * 0.3, 0.38, -0.1);
    rig.pulses.push({ obj: fl, amp: 1.2, phase: s });
  });
  // arms: long branches with root-claw hands
  [-1, 1].forEach((s) => {
    const arm = artic(body, V(s * 1.0, 2.55, 0), V(s * 1.3, 1.7, -0.15), V(s * 1.2, 0.95, -0.55), 0.2, 0.17, m.bark, m.barkDark, 0.2, m.moss);
    arm.onUp(new THREE.DodecahedronGeometry(0.46, 0), m.moss, s * 1.0, 2.72, 0);
    arm.onUp(new THREE.IcosahedronGeometry(0.3, 1), m.leaf, s * 1.05, 2.98, 0.05);
    arm.onLow(rbox(0.46, 0.4, 0.46, 0.1), m.bark, s * 1.2, 0.8, -0.6);
    for (let i = -1; i <= 1; i++) arm.onLow(cone(0.07, 0.4, 4), m.barkDark, s * 1.2 + i * 0.15, 0.6, -0.9, -Math.PI / 2 - 0.5, 0, 0);
    rig.arms.push({ up: arm.up, low: arm.low, phase: s < 0 ? Math.PI : 0, amp: 0.8 });
    // root legs
    const leg = artic(root, V(s * 0.45, 1.05, 0), V(s * 0.58, 0.58, 0.05), V(s * 0.6, 0.35, 0.05), 0.25, 0.2, m.bark, m.barkDark, 0.2, m.moss);
    leg.onLow(rbox(0.56, 0.3, 0.7, 0.1), m.barkDark, s * 0.6, 0.15, -0.05);
    for (let i = -1; i <= 1; i++) leg.onLow(cone(0.07, 0.4, 4), m.bark, s * 0.6 + i * 0.2, 0.1, -0.5, -Math.PI / 2, 0, 0);
    rig.legs.push({ up: leg.up, low: leg.low, phase: s < 0 ? 0 : Math.PI, amp: 0.85 });
  });
  // hanging vines
  for (let i = 0; i < 4; i++) {
    const v = grp(body, (i - 1.5) * 0.38, 2.7, 0.62);
    strut(v, V(0, 0, 0), V(0, -1.0, 0.12), 0.04, 0.025, m.leafDark);
    rig.flutters.push({ obj: v, phase: i * 1.3, amp: 0.8 });
  }
  rig.gait = { freq: 0.75, swing: 0.55, knee: 0.55, bob: 0.07, lean: 0.045 };
  rig.lunge = 0.3;
  return { hp: 420, speed: 3.6, damage: 34 };
}

// ───────────────────────── RAFFLESIA MORTAR ─────────────────────────
function buildRafflesia(root: THREE.Group, rig: EnemyRig): EliteStats {
  const { K, m } = plantKit();
  const { cyl, sph, cone, torus, lathe, V, mk, grp, artic, feather } = K;
  const body = new THREE.Group();
  root.add(body);
  rig.body = body;
  const petalMat = K.emis(0xb91c1c, 0x7f1d1d, 0.7);
  const petalEdge = K.emis(0xdc2626, 0xef4444, 0.5);

  // carapace bowl
  mk(body, lathe([[0, 0], [1.1, 0.05], [1.38, 0.32], [1.2, 0.68], [0.8, 0.88], [0.3, 0.94], [0, 0.94]], 22), m.bark, 0, 1.5, 0);
  mk(body, torus(1.3, 0.07, 8, 28), m.barkDark, 0, 1.85, 0, Math.PI / 2, 0, 0);
  // six root legs
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.52;
    const ca = Math.cos(a), sa = Math.sin(a);
    const j = artic(root, V(ca * 0.95, 1.6, sa * 0.95), V(ca * 1.85, 2.1, sa * 1.85), V(ca * 2.2, 0.06, sa * 2.2), 0.19, 0.14, m.bark, m.moss, 0.2, m.barkDark);
    j.onLow(cone(0.2, 0.5, 5), m.barkDark, ca * 2.2, 0.12, sa * 2.2, Math.PI, 0, 0);
    rig.legs.push({ up: j.up, low: j.low, phase: i % 2 ? Math.PI : 0, amp: 0.55 });
  }
  // five big spotted petals opening upward
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + Math.PI / 5;
    const outer = grp(body, 0, 2.3, 0, 0, a, 0);
    const petal = mk(outer, feather(2.1, 1.35, 0.1), petalMat, 0, 0, -0.55, -0.95, 0, 0);
    mk(petal, feather(1.9, 0.5, 0.04), petalEdge, 0, 0.1, 0.07);
    [[-0.28, 0.5], [0.3, 0.75], [-0.1, 1.05], [0.18, 1.35], [-0.2, 1.55]].forEach(([x, y], k) => {
      const spot = mk(petal, sph(0.08 + (k % 2) * 0.03, 8), m.cream, x, y, 0.1);
      spot.scale.z = 0.4;
    });
  }
  // spore mortar rising from the flower's mouth, tilted toward the front
  const tube = grp(body, 0, 2.15, -0.1, -0.5, 0, 0);
  rig.recoils.push({ obj: tube, amp: 0.7 });
  mk(tube, cyl(0.42, 0.55, 1.3, 14), m.barkDark, 0, 0.5, 0);
  mk(tube, torus(0.43, 0.05, 8, 18), m.steelDark, 0, 0.1, 0, Math.PI / 2, 0, 0);
  mk(tube, torus(0.43, 0.05, 8, 18), m.steelDark, 0, 0.7, 0, Math.PI / 2, 0, 0);
  mk(tube, cyl(0.5, 0.42, 0.16, 14), m.steel, 0, 1.2, 0);
  mk(tube, torus(0.46, 0.04, 8, 20), m.lime, 0, 1.28, 0, Math.PI / 2, 0, 0);
  const mouth = mk(tube, cyl(0.34, 0.34, 0.04, 14), m.lime, 0, 1.27, 0);
  mk(tube, sph(0.44, 12), m.limeHalo, 0, 1.3, 0);
  rig.pulses.push({ obj: mouth, amp: 1.4, speed: 1.3 });
  // spore sacs bulging around the carapace rim
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const sac = mk(body, sph(0.22, 10), m.pollen, Math.cos(a) * 1.25, 1.92, Math.sin(a) * 1.25);
    mk(body, sph(0.36, 10), m.pollenHalo, Math.cos(a) * 1.25, 1.92, Math.sin(a) * 1.25);
    rig.pulses.push({ obj: sac, amp: 1.2, phase: i * 1.0 });
  }
  // vines and a lens to aim with
  for (let i = 0; i < 3; i++) mk(body, torus(0.62, 0.035, 8, 20), m.leaf, 0, 1.55 + i * 0.22, 0, Math.PI / 2, 0, 0).scale.set(1.45, 1.45, 1);
  mk(body, sph(0.1, 8), m.lime, 0, 1.75, -1.3);
  rig.gait = { freq: 0.6, swing: 0.45, knee: 0.5, bob: 0.05, lean: 0.03 };
  rig.lunge = 0.1;
  return { hp: 700, speed: 2.5, damage: 48 };
}

// ───────────────────────── MUSHLING ─────────────────────────
const CAP_COLORS: [number, number][] = [[0xc2410c, 0x7c2d12], [0x9d174d, 0x500724], [0x6d28d9, 0x2e1065], [0xb45309, 0x78350f]];
function buildMushling(root: THREE.Group, rig: EnemyRig): EliteStats {
  const { K, m } = plantKit();
  const { sph, cyl, V, mk, grp, artic, lathe } = K;
  const body = new THREE.Group();
  root.add(body);
  rig.body = body;
  const [capC, capE] = CAP_COLORS[Math.floor(Math.random() * CAP_COLORS.length)];
  const capMat = K.emis(capC, capE, 0.55);
  capMat.side = THREE.DoubleSide;

  mk(body, lathe([[0, 0], [0.15, 0.02], [0.19, 0.12], [0.15, 0.3], [0, 0.34]], 14), m.cream, 0, 0.18, 0);
  const cap = grp(body, 0, 0.5, 0);
  rig.head = cap;
  const dome = mk(cap, new THREE.SphereGeometry(0.4, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), capMat);
  dome.scale.y = 0.7;
  mk(cap, cyl(0.4, 0.4, 0.02, 18), K.solid(0xf0abfc, 0.1, 0.6), 0, 0, 0);
  for (let i = 0; i < 9; i++) {
    const th = i * 2.399;
    const ph = 0.25 + (i % 3) * 0.32;
    const r = 0.4;
    const spot = mk(cap, sph(0.05 + (i % 2) * 0.02, 8), m.cream, Math.sin(ph) * Math.cos(th) * r, Math.cos(ph) * r * 0.7, Math.sin(ph) * Math.sin(th) * r);
    spot.scale.set(1, 0.5, 1);
  }
  [-1, 1].forEach((s) => {
    const eye = mk(body, sph(0.045, 8), m.lime, s * 0.075, 0.3, -0.17);
    rig.pulses.push({ obj: eye, amp: 1.5, phase: s });
  });
  mk(cap, sph(0.08, 8), m.pollen, 0, 0.26, 0);
  for (let i = 0; i < 2; i++) {
    [-1, 1].forEach((s) => {
      const z = -0.04 + i * 0.16;
      const j = artic(root, V(s * 0.12, 0.2, z), V(s * 0.24, 0.2, z), V(s * 0.28, 0.02, z + 0.03), 0.022, 0.018, m.steel, m.steelDark, 0.026);
      rig.legs.push({ up: j.up, low: j.low, phase: (i + (s > 0 ? 1 : 0)) % 2 ? Math.PI : 0, amp: 0.8 });
    });
  }
  rig.gait = { freq: 2.1, swing: 0.6, knee: 0.7, bob: 0.04, lean: 0.03 };
  rig.lunge = 0.3;
  return { hp: 52, speed: 7.8, damage: 10 };
}

/** Builds a MAP 7 enemy into `group` (registers its animation rig); returns null for other types. */
export function buildBloomEnemy(type: string, group: THREE.Group): EliteStats | null {
  if (!isBloomType(type)) return null;
  const rig = createRig(type);
  group.userData.enemyRig = rig;
  switch (type) {
    case 'bramble': return buildBramble(group, rig);
    case 'pollen': return buildPollen(group, rig);
    case 'creeper': return buildCreeper(group, rig);
    case 'thistle': return buildThistle(group, rig);
    case 'treant': return buildTreant(group, rig);
    case 'rafflesia': return buildRafflesia(group, rig);
    case 'mushling': return buildMushling(group, rig);
  }
  return null;
}
