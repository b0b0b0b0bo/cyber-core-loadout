import * as THREE from 'three';
import { createRig, EnemyRig } from './enemyAnimation';
import { kit, EliteStats } from './eliteEnemyModels';

/**
 * MAP 8 (MOLTEN FOUNDRY) roster: machines forged in lava, plated in cooled basalt and slag.
 * Each type reuses the movement / attack AI of a base category (see ENEMY_BASE_CATEGORY in BattleScene3D) and
 * only brings its own body, so they all animate through the generic rig (legs, arms, head, spinners ...).
 *
 *   embercur    EMBER CUR        溶岩の猟犬機       (hound AI)
 *   cinderwisp  CINDER WISP      火の粉ドローン     (drone AI)
 *   lavablade   LAVA BLADE       熔刃の暗殺機       (stalker AI)
 *   crucible    CRUCIBLE TURRET  溶鉱坩堝の砲台     (sentry AI)
 *   slaggolem   SLAG COLOSSUS    溶岩巨兵           (golem AI)
 *
 * Every model faces -Z with its feet on y = 0 (flying types are centred on their origin).
 */

export const MAGMA_TYPES = ['embercur', 'cinderwisp', 'lavablade', 'crucible', 'slaggolem'] as const;
export type MagmaType = (typeof MAGMA_TYPES)[number];
export const isMagmaType = (t: string): t is MagmaType => (MAGMA_TYPES as readonly string[]).includes(t);

// ───────────────────────── textures / materials ─────────────────────────
let basaltTex: THREE.CanvasTexture | null = null;
/** Dark cooled basalt plates split by glowing orange cracks. */
function basaltTexture(): THREE.CanvasTexture {
  if (basaltTex) return basaltTex;
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  g.fillStyle = '#34292a';
  g.fillRect(0, 0, S, S);
  for (let i = 0; i < 320; i++) {
    g.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,0.28)' : 'rgba(120,96,88,0.14)';
    g.fillRect(Math.random() * S, Math.random() * S, 2 + Math.random() * 14, 1 + Math.random() * 4);
  }
  const cracks = (w: number, color: string) => {
    g.strokeStyle = color;
    g.lineWidth = w;
    g.lineCap = 'round';
    for (let i = 0; i < 9; i++) {
      let x = Math.random() * S, y = Math.random() * S, a = Math.random() * Math.PI * 2;
      g.beginPath();
      g.moveTo(x, y);
      for (let k = 0; k < 6; k++) {
        a += (Math.random() - 0.5) * 1.3;
        x += Math.cos(a) * (14 + Math.random() * 22);
        y += Math.sin(a) * (14 + Math.random() * 22);
        g.lineTo(x, y);
      }
      g.stroke();
    }
  };
  cracks(5, 'rgba(255,90,20,0.35)');
  cracks(2, 'rgba(255,200,90,0.9)');
  basaltTex = new THREE.CanvasTexture(c);
  basaltTex.colorSpace = THREE.SRGBColorSpace;
  basaltTex.wrapS = basaltTex.wrapT = THREE.RepeatWrapping;
  return basaltTex;
}

function magmaKit() {
  const K = kit();
  const tex = basaltTexture();
  const m = {
    basalt: K.armor(0x7a6458, tex, 0.2, 0.7, 0.1),
    basaltDark: K.armor(0x4a3a34, tex, 0.2, 0.75, 0.05),
    soot: K.solid(0x1a1412, 0.5, 0.6),
    steel: K.solid(0x6b625c, 0.8, 0.38),
    steelDark: K.solid(0x2a2522, 0.8, 0.45),
    horn: K.solid(0xd8c8b0, 0.2, 0.5),
    hotPlate: K.emis(0x4a2a1c, 0xff4500, 0.55),
    lava: K.glow(0xff6a1a),
    lavaHot: K.glow(0xffb347),
    lavaCore: K.glow(0xfff1c2),
    lavaHalo: K.halo(0xff7a1a, 0.26),
    lavaHaloHot: K.halo(0xffc15a, 0.24),
    ember: K.glow(0xff3d00),
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

// ───────────────────────── EMBER CUR ─────────────────────────
function buildEmberCur(root: THREE.Group, rig: EnemyRig): EliteStats {
  const { K, m } = magmaKit();
  const { rbox, box, cone, sph, V, mk, grp, artic } = K;
  const body = new THREE.Group();
  root.add(body);
  rig.body = body;

  mk(body, rbox(0.62, 0.4, 1.15, 0.12), m.basaltDark, 0, 0.8, 0.05);
  mk(body, rbox(0.7, 0.3, 0.6, 0.1), m.basalt, 0, 0.9, -0.3, 0.1, 0, 0); // shoulder plate
  mk(body, rbox(0.56, 0.24, 0.5, 0.08), m.basalt, 0, 0.98, 0.3);           // haunch plate
  // glowing seams between the plates
  for (let i = 0; i < 4; i++) mk(body, box(0.66, 0.025, 0.04), m.lava, 0, 0.8 + (i % 2) * 0.02, -0.4 + i * 0.28);
  for (const s of [-1, 1]) mk(body, box(0.03, 0.2, 0.9), m.lavaHot, s * 0.32, 0.8, 0.05);
  // dorsal vents breathing embers
  for (let i = 0; i < 3; i++) {
    const v = grp(body, 0, 1.06, -0.25 + i * 0.3);
    mk(v, K.cyl(0.07, 0.09, 0.1, 8), m.steelDark, 0, 0, 0);
    const f = mk(v, cone(0.07, 0.3, 6), m.lavaHot, 0, 0.2, 0);
    mk(v, sph(0.14, 8), m.lavaHalo, 0, 0.14, 0);
    rig.flutters.push({ obj: f, phase: i * 1.4, amp: 1.5 });
  }
  const core = mk(body, sph(0.12, 10), m.lavaHot, 0, 0.8, -0.05);
  mk(body, sph(0.24, 10), m.lavaHalo, 0, 0.8, -0.05);
  rig.pulses.push({ obj: core, amp: 1.3, speed: 1.1 });

  // head: basalt skull with a furnace maw
  const head = grp(body, 0, 0.98, -0.7);
  rig.head = head;
  mk(head, rbox(0.34, 0.3, 0.46, 0.1), m.basalt, 0, 0, 0);
  mk(head, rbox(0.24, 0.16, 0.34, 0.07), m.basaltDark, 0, -0.04, -0.34);
  [-1, 1].forEach((s) => {
    mk(head, box(0.1, 0.035, 0.04), m.lavaHot, s * 0.1, 0.05, -0.23);
    spike(head, V(s * 0.1, 0.12, 0.05), V(s * 0.8, 1, 0.3), 0.04, 0.34, m.horn, 5); // swept-back horns
  });
  const jaw = grp(head, 0, -0.1, -0.05);
  rig.jaw = jaw;
  mk(jaw, rbox(0.22, 0.08, 0.34, 0.03), m.basaltDark, 0, -0.03, -0.2);
  mk(jaw, box(0.18, 0.025, 0.28), m.lava, 0, 0.02, -0.2); // molten tongue
  for (let i = -2; i <= 2; i++) spike(jaw, V(i * 0.045, 0.0, -0.34), V(0, 1, -0.2), 0.016, 0.1, m.horn, 4);
  // drip from the chin
  const drip = mk(head, sph(0.04, 8), m.lava, 0, -0.22, -0.4);
  rig.flutters.push({ obj: drip, phase: 0.5, amp: 1.2 });

  // legs: basalt shins with white-hot knees
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
    const hip = V(sx * 0.26, 0.78, sz * 0.4), knee = V(sx * 0.38, 0.5, sz * 0.46), foot = V(sx * 0.32, 0.04, sz * 0.52);
    const j = artic(root, hip, knee, foot, 0.075, 0.055, m.basalt, m.basaltDark, 0.075, m.lavaHot);
    j.onLow(cone(0.07, 0.24, 4), m.horn, foot.x, 0.1, foot.z - 0.1, -Math.PI / 2, 0, 0);
    rig.legs.push({ up: j.up, low: j.low, phase: sx * sz > 0 ? 0 : Math.PI, amp: 0.8 });
  });
  // tail: chain of slag lumps ending in a molten ball
  const tail = grp(body, 0, 0.9, 0.6);
  for (let i = 0; i < 3; i++) mk(tail, sph(0.07 - i * 0.01, 8), m.basaltDark, 0, -0.05 * i, 0.2 + i * 0.22);
  const tip = mk(tail, sph(0.1, 10), m.lavaHot, 0, -0.15, 0.9);
  mk(tail, sph(0.2, 10), m.lavaHalo, 0, -0.15, 0.9);
  rig.pulses.push({ obj: tip, amp: 1.2, phase: 1 });
  rig.tails.push({ obj: tail, phase: 0.6, amp: 1 });
  rig.gait = { freq: 1.25, swing: 0.8, knee: 0.9, bob: 0.05, lean: 0.05 };
  rig.lunge = 0.35;
  return { hp: 240, speed: 6.4, damage: 24 };
}

// ───────────────────────── CINDER WISP ─────────────────────────
function buildCinderWisp(root: THREE.Group, rig: EnemyRig): EliteStats {
  const { K, m } = magmaKit();
  const { sph, cone, cyl, torus, V, mk, grp, strut, lathe } = K;
  const body = new THREE.Group();
  root.add(body);
  rig.body = body;

  // glowing heat core held in a cracked basalt cage
  const core = mk(body, sph(0.22, 14), m.lavaCore);
  const coreHot = mk(body, sph(0.32, 14), m.lava);
  mk(body, sph(0.52, 14), m.lavaHalo);
  rig.pulses.push({ obj: core, amp: 1.3, speed: 1.3 }, { obj: coreHot, amp: 1.1, phase: 0.5 });
  for (let i = 0; i < 4; i++) { // cage ribs
    const rib = mk(body, torus(0.4, 0.035, 8, 22, Math.PI), m.basaltDark, 0, 0, 0, 0, (i / 4) * Math.PI, 0);
    rib.rotation.z = Math.PI / 2;
  }
  mk(body, torus(0.4, 0.04, 8, 24), m.steelDark, 0, 0, 0, Math.PI / 2, 0, 0);
  // eye lens
  mk(body, cyl(0.11, 0.11, 0.06, 14), m.steelDark, 0, 0.02, -0.4, Math.PI / 2, 0, 0);
  const eye = mk(body, sph(0.065, 10), m.lavaHot, 0, 0.02, -0.45);
  rig.pulses.push({ obj: eye, amp: 1.6, speed: 1.8 });

  // hot-air turbine on top: a ring of glowing vanes
  const rotor = grp(body, 0, 0.5, 0);
  mk(rotor, torus(0.55, 0.035, 8, 28), m.steel, 0, 0, 0, Math.PI / 2, 0, 0);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const vane = grp(rotor, 0, 0, 0, 0, a, 0);
    mk(vane, K.box(0.08, 0.02, 0.5), i % 2 ? m.lavaHot : m.lava, 0, 0, -0.3, 0.3, 0, 0);
  }
  mk(rotor, sph(0.08, 8), m.lavaHot, 0, 0, 0);
  rig.spinners.push({ obj: rotor, axis: 'y', speed: 20 });
  mk(body, cyl(0.04, 0.06, 0.22, 8), m.steelDark, 0, 0.36, 0);

  // ember trail dangling below
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const st = grp(body, Math.cos(a) * 0.14, -0.3, Math.sin(a) * 0.14);
    strut(st, V(0, 0, 0), V(Math.cos(a) * 0.05, -0.32 - (i % 2) * 0.1, Math.sin(a) * 0.05), 0.014, 0.008, m.basaltDark);
    mk(st, sph(0.04, 6), i % 2 ? m.lavaHot : m.ember, Math.cos(a) * 0.05, -0.34 - (i % 2) * 0.1, Math.sin(a) * 0.05);
    rig.flutters.push({ obj: st, phase: i * 1.1, amp: 1.3 });
  }
  // twin exhaust nozzles
  [-1, 1].forEach((s) => {
    mk(body, cone(0.07, 0.2, 6), m.steel, s * 0.46, -0.06, 0.08, 0, 0, -s * Math.PI / 2);
    const jet = mk(body, sph(0.08, 8), m.lavaHot, s * 0.58, -0.06, 0.08);
    rig.pulses.push({ obj: jet, amp: 1.4, phase: s });
  });
  void lathe;
  rig.hover = { bob: 0.08, tilt: 0.05 };
  rig.lunge = 0.2;
  return { hp: 100, speed: 5.5, damage: 16 };
}

// ───────────────────────── LAVA BLADE ─────────────────────────
function buildLavaBlade(root: THREE.Group, rig: EnemyRig): EliteStats {
  const { K, m } = magmaKit();
  const { rbox, box, sph, cone, V, mk, grp, artic, strut, blade } = K;
  const body = new THREE.Group();
  root.add(body);
  rig.body = body;

  mk(body, rbox(0.44, 0.7, 0.28, 0.1), m.basaltDark, 0, 1.28, 0);
  mk(body, rbox(0.52, 0.22, 0.32, 0.08), m.basalt, 0, 1.56, 0);   // shoulder yoke
  mk(body, rbox(0.34, 0.24, 0.26, 0.08), m.steelDark, 0, 0.88, 0);
  // glowing chest slit and spine
  mk(body, box(0.26, 0.05, 0.03), m.lavaHot, 0, 1.36, -0.15);
  mk(body, box(0.04, 0.5, 0.03), m.lava, 0, 1.28, 0.15);
  const heart = mk(body, sph(0.08, 10), m.lavaCore, 0, 1.2, -0.15);
  mk(body, sph(0.16, 10), m.lavaHalo, 0, 1.2, -0.16);
  rig.pulses.push({ obj: heart, amp: 1.3 });

  // head: crested helm with a single hot visor
  const head = grp(body, 0, 1.82, -0.02);
  rig.head = head;
  mk(head, rbox(0.26, 0.28, 0.28, 0.08), m.basalt);
  mk(head, box(0.2, 0.04, 0.04), m.lavaHot, 0, 0.02, -0.15);
  spike(head, V(0, 0.12, 0.04), V(0, 0.6, 1), 0.07, 0.4, m.hotPlate, 4); // swept crest
  spike(head, V(0, 0.1, 0.1), V(0, 1, 0.1), 0.03, 0.22, m.lava, 4);

  // arms ending in long heat-blades
  [-1, 1].forEach((s) => {
    const arm = artic(body, V(s * 0.34, 1.55, 0), V(s * 0.44, 1.12, -0.1), V(s * 0.4, 0.86, -0.3), 0.05, 0.042, m.basaltDark, m.basalt, 0.056, m.lavaHot);
    arm.onLow(blade(1.15, 0.2, 0.04), m.steel, s * 0.4, 0.86, -0.34, -Math.PI / 2 + 0.2, 0, 0);
    arm.onLow(blade(1.0, 0.07, 0.05), m.lavaHot, s * 0.4, 0.86, -0.36, -Math.PI / 2 + 0.2, 0, 0);
    arm.onLow(K.rbox(0.14, 0.12, 0.16, 0.04), m.basaltDark, s * 0.4, 0.86, -0.28);
    rig.arms.push({ up: arm.up, low: arm.low, phase: s < 0 ? Math.PI : 0, amp: 0.9 });
    const leg = artic(root, V(s * 0.15, 0.8, 0), V(s * 0.22, 0.45, -0.14), V(s * 0.18, 0.04, 0.04), 0.07, 0.05, m.basalt, m.steelDark, 0.07, m.lava);
    leg.onLow(cone(0.06, 0.25, 4), m.horn, s * 0.18, 0.05, -0.12, -Math.PI / 2, 0, 0);
    rig.legs.push({ up: leg.up, low: leg.low, phase: s < 0 ? 0 : Math.PI, amp: 1 });
  });
  // shimmering heat-haze cloak: strips that sway behind it
  for (let i = 0; i < 6; i++) {
    const sp = grp(body, (i - 2.5) * 0.11, 1.55 - Math.abs(i - 2.5) * 0.08, 0.17);
    strut(sp, V(0, 0, 0), V(0, -0.55 - (i % 3) * 0.14, 0.14), 0.024, 0.012, m.steelDark);
    mk(sp, sph(0.035, 6), i % 2 ? m.lavaHot : m.ember, 0, -0.55 - (i % 3) * 0.14, 0.14);
    rig.flutters.push({ obj: sp, phase: i * 0.8, amp: 1.2 });
  }
  rig.gait = { freq: 1.3, swing: 0.8, knee: 1.0, bob: 0.07, lean: 0.08 };
  rig.lunge = 0.35;
  return { hp: 190, speed: 7.2, damage: 30 };
}

// ───────────────────────── CRUCIBLE TURRET ─────────────────────────
function buildCrucible(root: THREE.Group, rig: EnemyRig): EliteStats {
  const { K, m } = magmaKit();
  const { cyl, sph, cone, torus, lathe, V, mk, grp, artic } = K;
  const body = new THREE.Group();
  root.add(body);
  rig.body = body;

  mk(body, cyl(0.54, 0.76, 0.22, 10), m.basaltDark, 0, 0.11, 0);
  mk(body, torus(0.64, 0.03, 8, 10), m.lava, 0, 0.24, 0, Math.PI / 2, 0, 0);
  for (let i = 0; i < 3; i++) { // tripod legs
    const a = (i / 3) * Math.PI * 2 + Math.PI / 2;
    const ca = Math.cos(a), sa = Math.sin(a);
    const j = artic(root, V(ca * 0.3, 0.42, sa * 0.3), V(ca * 0.7, 0.52, sa * 0.7), V(ca * 0.9, 0.04, sa * 0.9), 0.065, 0.05, m.steel, m.basaltDark, 0.065, m.steelDark);
    j.onLow(cone(0.09, 0.2, 5), m.steelDark, ca * 0.92, 0.06, sa * 0.92, Math.PI, 0, 0);
    rig.legs.push({ up: j.up, low: j.low, phase: i * ((Math.PI * 2) / 3), amp: 0.55 });
  }
  mk(body, cyl(0.2, 0.3, 0.5, 8), m.steel, 0, 0.47, 0);

  const head = grp(body, 0, 1.0, 0);
  rig.scanners.push({ obj: head, phase: 0, amp: 1 });
  // the crucible bowl riding on the turret, filled with molten metal
  mk(head, lathe([[0, -0.02], [0.3, 0], [0.5, 0.16], [0.52, 0.34], [0.46, 0.34], [0.44, 0.18], [0.28, 0.04], [0, 0.02]], 18), m.basalt, 0, 0, 0);
  mk(head, torus(0.5, 0.04, 8, 24), m.steelDark, 0, 0.34, 0, Math.PI / 2, 0, 0);
  const pool = mk(head, cyl(0.45, 0.45, 0.02, 20), m.lavaHot, 0, 0.3, 0);
  mk(head, sph(0.5, 12), m.lavaHalo, 0, 0.36, 0);
  rig.pulses.push({ obj: pool, amp: 0.4, speed: 0.9 });
  for (let i = 0; i < 3; i++) { // bubbles popping on the surface
    const b = mk(head, sph(0.05 + i * 0.015, 8), m.lavaCore, (i - 1) * 0.2, 0.34, (i % 2 ? 0.1 : -0.12));
    rig.pulses.push({ obj: b, amp: 1.5, speed: 1.6, phase: i * 1.7 });
  }
  // pouring spout lobbing slag toward the target
  const gun = grp(head);
  rig.recoils.push({ obj: gun, amp: 0.8 });
  mk(gun, cyl(0.1, 0.14, 0.9, 10), m.steel, 0, 0.12, -0.55, Math.PI / 2, 0, 0);
  mk(gun, cyl(0.16, 0.16, 0.14, 10), m.steelDark, 0, 0.12, -1.0, Math.PI / 2, 0, 0);
  mk(gun, torus(0.14, 0.03, 8, 14), m.lava, 0, 0.12, -1.08);
  rig.pulses.push({ obj: mk(gun, sph(0.09, 8), m.lavaHot, 0, 0.12, -1.06), amp: 2 });
  // exhaust stacks
  [-1, 1].forEach((s) => {
    mk(head, cyl(0.06, 0.08, 0.5, 8), m.steelDark, s * 0.4, 0.1, 0.3);
    const fl = mk(head, cone(0.08, 0.28, 6), m.lavaHot, s * 0.4, 0.46, 0.3);
    rig.flutters.push({ obj: fl, phase: s * 1.3, amp: 1.5 });
  });
  rig.gait = { freq: 0.8, swing: 0.5, knee: 0.5, bob: 0.015, lean: 0.02 };
  rig.lunge = 0.08;
  return { hp: 210, speed: 4.0, damage: 36 };
}

// ───────────────────────── SLAG COLOSSUS ─────────────────────────
function buildSlagGolem(root: THREE.Group, rig: EnemyRig): EliteStats {
  const { K, m } = magmaKit();
  const { rbox, box, sph, cone, cyl, torus, lathe, V, mk, grp, artic } = K;
  const body = new THREE.Group();
  root.add(body);
  rig.body = body;

  mk(body, rbox(1.3, 0.5, 0.9, 0.15), m.basaltDark, 0, 1.1, 0);
  // torso: stacked slabs with molten seams
  const slabs: [number, number, number][] = [[1.15, 0.5, 0.8], [1.35, 0.55, 0.9], [1.5, 0.5, 0.95]];
  slabs.forEach(([w, h, d], i) => {
    const y = 1.55 + i * 0.52;
    mk(body, rbox(w, h, d, 0.12), i % 2 ? m.basalt : m.basaltDark, 0, y, 0);
    mk(body, box(w + 0.02, 0.04, d + 0.02), m.lava, 0, y - h / 2 - 0.01, 0);
  });
  // furnace window in the chest
  mk(body, rbox(0.66, 0.62, 0.18, 0.08), m.soot, 0, 2.05, -0.5);
  const heart = mk(body, sph(0.24, 14), m.lavaHot, 0, 2.05, -0.56);
  mk(body, sph(0.44, 14), m.lavaHaloHot, 0, 2.05, -0.56);
  rig.pulses.push({ obj: heart, amp: 1.4 }, { obj: body.children[body.children.length - 1], amp: 1.3, phase: 0.6 });
  mk(body, torus(0.36, 0.045, 8, 22), m.steelDark, 0, 2.05, -0.58);
  for (let i = 0; i < 4; i++) mk(body, box(0.03, 0.5, 0.04), m.steel, -0.24 + i * 0.16, 2.05, -0.62); // furnace grate

  // head: heavy brow with ember eyes and a crown of horns
  const head = grp(body, 0, 3.1, -0.22);
  rig.head = head;
  mk(head, rbox(0.52, 0.44, 0.46, 0.1), m.basalt);
  mk(head, box(0.5, 0.08, 0.1), m.basaltDark, 0, 0.12, -0.24);
  [-1, 1].forEach((s) => mk(head, box(0.12, 0.05, 0.05), m.lavaHot, s * 0.12, 0.03, -0.24));
  mk(head, box(0.26, 0.04, 0.05), m.lava, 0, -0.12, -0.24);
  for (let i = 0; i < 5; i++) spike(head, V((i - 2) * 0.11, 0.2, 0.0), V((i - 2) * 0.35, 1, -0.1), 0.045, 0.28 + (i % 2 ? 0 : 0.1), m.horn, 5);
  // smokestacks on the shoulders venting embers
  [-1, 1].forEach((s) => {
    const st = grp(body, s * 0.72, 3.0, 0.18);
    mk(st, cyl(0.1, 0.14, 0.62, 8), m.steelDark, 0, 0.3, 0);
    mk(st, torus(0.11, 0.025, 6, 12), m.lava, 0, 0.62, 0, Math.PI / 2, 0, 0);
    const puff = mk(st, cone(0.12, 0.42, 6), m.lavaHot, 0, 0.88, 0);
    mk(st, sph(0.22, 8), m.lavaHalo, 0, 0.78, 0);
    rig.flutters.push({ obj: puff, phase: s * 1.4, amp: 1.6 });
  });
  // arms: slag-fist hammers
  [-1, 1].forEach((s) => {
    const arm = artic(body, V(s * 1.0, 2.55, 0), V(s * 1.32, 1.7, -0.15), V(s * 1.22, 0.95, -0.55), 0.2, 0.18, m.basaltDark, m.basalt, 0.2, m.lavaHot);
    arm.onUp(new THREE.DodecahedronGeometry(0.5, 0), m.basalt, s * 1.0, 2.72, 0);
    arm.onUp(box(0.6, 0.05, 0.6), m.lava, s * 1.0, 2.5, 0);
    arm.onLow(new THREE.DodecahedronGeometry(0.46, 0), m.basaltDark, s * 1.22, 0.8, -0.6);
    arm.onLow(sph(0.28, 10), m.lavaHot, s * 1.22, 0.78, -0.82);
    arm.onLow(sph(0.5, 10), m.lavaHalo, s * 1.22, 0.78, -0.82);
    for (let i = -1; i <= 1; i++) arm.onLow(cone(0.07, 0.34, 4), m.horn, s * 1.22 + i * 0.15, 0.62, -0.96, -Math.PI / 2 - 0.4, 0, 0);
    rig.arms.push({ up: arm.up, low: arm.low, phase: s < 0 ? Math.PI : 0, amp: 0.8 });
    const leg = artic(root, V(s * 0.45, 1.05, 0), V(s * 0.58, 0.58, 0.05), V(s * 0.6, 0.35, 0.05), 0.25, 0.2, m.basalt, m.basaltDark, 0.2, m.lava);
    leg.onLow(rbox(0.56, 0.3, 0.7, 0.1), m.basaltDark, s * 0.6, 0.15, -0.05);
    leg.onLow(box(0.5, 0.03, 0.6), m.lava, s * 0.6, 0.31, -0.05);
    rig.legs.push({ up: leg.up, low: leg.low, phase: s < 0 ? 0 : Math.PI, amp: 0.85 });
  });
  // dripping slag from the belt
  for (let i = 0; i < 4; i++) {
    const d = grp(body, (i - 1.5) * 0.36, 1.32, -0.42);
    mk(d, cyl(0.025, 0.04, 0.5, 6), m.lava, 0, -0.25, 0);
    mk(d, sph(0.06, 8), m.lavaHot, 0, -0.52, 0);
    rig.flutters.push({ obj: d, phase: i * 1.3, amp: 0.7 });
  }
  void lathe;
  rig.gait = { freq: 0.75, swing: 0.55, knee: 0.55, bob: 0.07, lean: 0.045 };
  rig.lunge = 0.3;
  return { hp: 460, speed: 3.5, damage: 38 };
}

/** Builds a MAP 8 enemy into `group` (registers its animation rig); returns null for other types. */
export function buildMagmaEnemy(type: string, group: THREE.Group): EliteStats | null {
  if (!isMagmaType(type)) return null;
  const rig = createRig(type);
  group.userData.enemyRig = rig;
  switch (type) {
    case 'embercur': return buildEmberCur(group, rig);
    case 'cinderwisp': return buildCinderWisp(group, rig);
    case 'lavablade': return buildLavaBlade(group, rig);
    case 'crucible': return buildCrucible(group, rig);
    case 'slaggolem': return buildSlagGolem(group, rig);
  }
  return null;
}
