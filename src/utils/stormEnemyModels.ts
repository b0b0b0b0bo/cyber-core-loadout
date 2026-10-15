import * as THREE from 'three';
import { createRig, EnemyRig } from './enemyAnimation';
import { kit, EliteStats } from './eliteEnemyModels';

/**
 * MAP 9 (STORM ARRAY) roster: machines wrapped in thunderclouds, wind and static.
 * Each type reuses the movement / attack AI of a base category (see ENEMY_BASE_CATEGORY in BattleScene3D) and
 * only brings its own body, so they all animate through the generic rig (legs, arms, head, spinners ...).
 *
 *   cumulus     CUMULUS DRONE    積雲ドローン       (drone AI)
 *   galehound   GALE HOUND       疾風の猟犬機       (hound AI)
 *   tempest     FLASH TEMPEST    雷光の暗殺機       (stalker AI)
 *   stormrod    LIGHTNING ROD    避雷砲台           (sentry AI)
 *   nimbusgolem NIMBUS COLOSSUS  雷雲巨兵           (golem AI)
 *
 * Every model faces -Z with its feet on y = 0 (flying types are centred on their origin).
 */

export const STORM_TYPES = ['cumulus', 'galehound', 'tempest', 'stormrod', 'nimbusgolem'] as const;
export type StormType = (typeof STORM_TYPES)[number];
export const isStormType = (t: string): t is StormType => (STORM_TYPES as readonly string[]).includes(t);

// ───────────────────────── textures / materials ─────────────────────────
let plateTex: THREE.CanvasTexture | null = null;
/** Dark gunmetal plating with thin glowing blue circuit lines. */
function plateTexture(): THREE.CanvasTexture {
  if (plateTex) return plateTex;
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  g.fillStyle = '#3a4458';
  g.fillRect(0, 0, S, S);
  for (let i = 0; i < 260; i++) {
    g.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,0.25)' : 'rgba(150,170,210,0.12)';
    g.fillRect(Math.random() * S, Math.random() * S, 2 + Math.random() * 14, 1 + Math.random() * 3);
  }
  g.strokeStyle = 'rgba(80,170,255,0.8)';
  g.lineWidth = 2;
  for (let i = 0; i < 8; i++) {
    let x = Math.random() * S, y = Math.random() * S;
    g.beginPath();
    g.moveTo(x, y);
    for (let k = 0; k < 4; k++) {
      if (k % 2) y += (Math.random() - 0.5) * 70; else x += (Math.random() - 0.5) * 90;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  g.strokeStyle = 'rgba(0,0,0,0.5)';
  g.lineWidth = 3;
  g.strokeRect(2, 2, S - 4, S - 4);
  plateTex = new THREE.CanvasTexture(c);
  plateTex.colorSpace = THREE.SRGBColorSpace;
  plateTex.wrapS = plateTex.wrapT = THREE.RepeatWrapping;
  return plateTex;
}

function stormKit() {
  const K = kit();
  const tex = plateTexture();
  const m = {
    plate: K.armor(0x7a869c, tex, 0.35, 0.5, 0.2),
    plateDark: K.armor(0x4a566c, tex, 0.4, 0.5, 0.1),
    steel: K.solid(0x8d9ab0, 0.8, 0.3),
    steelDark: K.solid(0x2a3040, 0.8, 0.4),
    // storm cloud: soft, matte, faintly self-lit so it reads as cloud in dark skies
    cloud: new THREE.MeshStandardMaterial({ color: 0x8a92a6, roughness: 1, metalness: 0, emissive: 0x2a3250, emissiveIntensity: 0.55, flatShading: true }),
    cloudDark: new THREE.MeshStandardMaterial({ color: 0x4a5266, roughness: 1, metalness: 0, emissive: 0x161c34, emissiveIntensity: 0.55, flatShading: true }),
    cloudLight: new THREE.MeshStandardMaterial({ color: 0xc4cadc, roughness: 1, metalness: 0, emissive: 0x3a4468, emissiveIntensity: 0.5, flatShading: true }),
    blue: K.glow(0x38bdf8),
    blueHot: K.glow(0xbae6fd),
    white: K.glow(0xf0f9ff),
    violet: K.glow(0x818cf8),
    blueHalo: K.halo(0x3b9eff, 0.26),
    whiteHalo: K.halo(0xbfe4ff, 0.22),
    wind: new THREE.MeshBasicMaterial({ color: 0xbfdcff, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
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

/** A lumpy cloud: several overlapping icosahedra. */
function cloudMass(parent: THREE.Object3D, mats: THREE.Material[], x: number, y: number, z: number, r: number, lumps = 6) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  for (let i = 0; i < lumps; i++) {
    const a = i * 2.4 + 0.5;
    const rr = r * (i === 0 ? 1 : 0.55 + (i % 3) * 0.12);
    const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(rr, 1), mats[i % mats.length]);
    const off = i === 0 ? 0 : r * 0.7;
    ball.position.set(Math.cos(a) * off, (i % 3 - 1) * r * 0.18, Math.sin(a) * off);
    ball.scale.y = 0.8;
    g.add(ball);
  }
  return g;
}

/** Zig-zag lightning bolt mesh (glowing tube) from a to b. */
function bolt(parent: THREE.Object3D, mat: THREE.Material, a: THREE.Vector3, b: THREE.Vector3, jag: number, r = 0.015) {
  const n = 6;
  const pts: THREE.Vector3[] = [];
  const d = b.clone().sub(a);
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    const env = Math.sin(Math.PI * f) * jag;
    pts.push(a.clone().addScaledVector(d, f).add(new THREE.Vector3((((i * 7) % 5) - 2) * 0.5 * env, (((i * 3) % 4) - 1.5) * 0.3 * env, (((i * 5) % 5) - 2) * 0.5 * env)));
  }
  const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.2), 18, r, 4, false), mat);
  parent.add(m);
  return m;
}

// ───────────────────────── CUMULUS DRONE ─────────────────────────
function buildCumulus(root: THREE.Group, rig: EnemyRig): EliteStats {
  const { K, m } = stormKit();
  const { sph, cyl, torus, V, mk, grp } = K;
  const body = new THREE.Group();
  root.add(body);
  rig.body = body;

  // metal core ball wrapped in a puffy cumulus
  const core = mk(body, sph(0.2, 12), m.blueHot);
  mk(body, sph(0.34, 12), m.blueHalo);
  rig.pulses.push({ obj: core, amp: 1.4, speed: 1.4 });
  mk(body, torus(0.3, 0.03, 8, 22), m.steel, 0, 0, 0, Math.PI / 2, 0.3, 0);
  const puff = cloudMass(body, [m.cloud, m.cloudLight, m.cloudDark], 0, 0.05, 0, 0.3, 7);
  rig.flutters.push({ obj: puff, phase: 0, amp: 0.6 });
  // eye lens poking out of the cloud
  mk(body, cyl(0.1, 0.1, 0.07, 14), m.steelDark, 0, 0.02, -0.38, Math.PI / 2, 0, 0);
  const eye = mk(body, sph(0.06, 10), m.blue, 0, 0.02, -0.43);
  rig.pulses.push({ obj: eye, amp: 1.6, speed: 1.9 });
  // little lightning sparks crawling off the cloud
  for (let i = 0; i < 3; i++) {
    const a = i * 2.1;
    const sp = grp(body, Math.cos(a) * 0.3, 0.1 - i * 0.1, Math.sin(a) * 0.3);
    bolt(sp, m.blueHot, V(0, 0, 0), V(Math.cos(a) * 0.3, -0.1 - i * 0.05, Math.sin(a) * 0.3), 0.14);
    rig.flutters.push({ obj: sp, phase: i * 1.7, amp: 1.5 });
  }
  // drizzle droplets
  for (let i = 0; i < 4; i++) {
    const dr = grp(body, (i - 1.5) * 0.12, -0.38, (i % 2) * 0.1);
    mk(dr, sph(0.025, 6), m.blue, 0, -0.06, 0);
    rig.flutters.push({ obj: dr, phase: i * 1.2, amp: 1.0 });
  }
  // two stub rotors keep it afloat
  [-1, 1].forEach((s) => {
    const rot = grp(body, s * 0.42, -0.02, 0.05);
    mk(rot, cyl(0.02, 0.03, 0.1, 8), m.steelDark, 0, 0, 0);
    mk(rot, K.box(0.34, 0.012, 0.06), m.steel, 0, 0.06, 0);
    mk(rot, K.box(0.06, 0.012, 0.34), m.steel, 0, 0.06, 0);
    rig.spinners.push({ obj: rot, axis: 'y', speed: 22 * s });
  });
  rig.hover = { bob: 0.09, tilt: 0.05 };
  rig.lunge = 0.2;
  return { hp: 100, speed: 5.4, damage: 16 };
}

// ───────────────────────── GALE HOUND ─────────────────────────
function buildGaleHound(root: THREE.Group, rig: EnemyRig): EliteStats {
  const { K, m } = stormKit();
  const { rbox, box, cone, sph, torus, V, mk, grp, artic } = K;
  const body = new THREE.Group();
  root.add(body);
  rig.body = body;

  mk(body, rbox(0.56, 0.36, 1.15, 0.12), m.plateDark, 0, 0.8, 0.05);
  mk(body, rbox(0.62, 0.26, 0.6, 0.1), m.plate, 0, 0.9, -0.3, 0.1, 0, 0);
  mk(body, rbox(0.5, 0.2, 0.5, 0.08), m.plate, 0, 0.96, 0.3);
  // glowing circuit stripes and a turbine in the chest
  for (const s of [-1, 1]) mk(body, box(0.03, 0.04, 0.9), m.blue, s * 0.29, 0.82, 0.05);
  const fan = grp(body, 0, 0.82, -0.02);
  mk(fan, torus(0.15, 0.02, 8, 18), m.steel, 0, 0, 0, Math.PI / 2, 0, 0);
  for (let i = 0; i < 6; i++) mk(grp(fan, 0, 0, 0, 0, (i / 6) * Math.PI * 2, 0), box(0.025, 0.02, 0.14), m.blueHot, 0, 0, -0.08);
  rig.spinners.push({ obj: fan, axis: 'y', speed: 14 });
  // wind streak fins along the back
  for (let i = 0; i < 4; i++) {
    const f = mk(body, cone(0.05, 0.4, 4), m.steel, 0, 1.06, -0.3 + i * 0.28, Math.PI / 2 + 0.15, 0, 0);
    rig.flutters.push({ obj: f, phase: i * 0.9, amp: 0.8 });
  }
  // head: streamlined with swept visor
  const head = grp(body, 0, 0.96, -0.7);
  rig.head = head;
  mk(head, rbox(0.3, 0.26, 0.46, 0.1), m.plate);
  mk(head, rbox(0.22, 0.14, 0.34, 0.06), m.plateDark, 0, -0.04, -0.34);
  [-1, 1].forEach((s) => {
    mk(head, box(0.1, 0.03, 0.04), m.blueHot, s * 0.09, 0.04, -0.23);
    spike(head, V(s * 0.1, 0.1, 0.1), V(s * 0.4, 0.5, 1), 0.035, 0.42, m.steel, 4); // swept antenna blades
  });
  const jaw = grp(head, 0, -0.1, -0.05);
  rig.jaw = jaw;
  mk(jaw, rbox(0.2, 0.07, 0.32, 0.03), m.plateDark, 0, -0.03, -0.2);
  for (let i = -2; i <= 2; i++) spike(jaw, V(i * 0.04, 0.0, -0.32), V(0, 1, -0.2), 0.014, 0.09, m.white, 4);
  // legs
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
    const hip = V(sx * 0.24, 0.78, sz * 0.4), knee = V(sx * 0.36, 0.5, sz * 0.46), foot = V(sx * 0.3, 0.04, sz * 0.52);
    const j = artic(root, hip, knee, foot, 0.065, 0.048, m.plate, m.plateDark, 0.07, m.blue);
    j.onLow(cone(0.06, 0.24, 4), m.steel, foot.x, 0.1, foot.z - 0.1, -Math.PI / 2, 0, 0);
    rig.legs.push({ up: j.up, low: j.low, phase: sx * sz > 0 ? 0 : Math.PI, amp: 0.85 });
  });
  // tail: a ribbon of wind ending in a glowing tip
  const tail = grp(body, 0, 0.9, 0.6);
  for (let i = 0; i < 3; i++) mk(tail, torus(0.07 + i * 0.03, 0.012, 6, 16), m.wind, 0, -0.04 * i, 0.2 + i * 0.22, 0, Math.PI / 2, 0);
  const tip = mk(tail, sph(0.07, 8), m.blueHot, 0, -0.1, 0.9);
  mk(tail, sph(0.16, 8), m.blueHalo, 0, -0.1, 0.9);
  rig.pulses.push({ obj: tip, amp: 1.2, phase: 1 });
  rig.tails.push({ obj: tail, phase: 0.6, amp: 1.2 });
  rig.gait = { freq: 1.45, swing: 0.9, knee: 0.9, bob: 0.05, lean: 0.07 };
  rig.lunge = 0.4;
  return { hp: 220, speed: 7.0, damage: 22 };
}

// ───────────────────────── FLASH TEMPEST ─────────────────────────
function buildTempest(root: THREE.Group, rig: EnemyRig): EliteStats {
  const { K, m } = stormKit();
  const { rbox, box, sph, cone, V, mk, grp, artic, blade } = K;
  const body = new THREE.Group();
  root.add(body);
  rig.body = body;

  mk(body, rbox(0.42, 0.7, 0.26, 0.1), m.plateDark, 0, 1.28, 0);
  mk(body, rbox(0.5, 0.2, 0.3, 0.08), m.plate, 0, 1.56, 0);
  mk(body, rbox(0.3, 0.24, 0.24, 0.08), m.steelDark, 0, 0.88, 0);
  // chest: a lightning-bolt glyph over a glowing core
  const core = mk(body, sph(0.09, 10), m.white, 0, 1.3, -0.14);
  mk(body, sph(0.18, 10), m.blueHalo, 0, 1.3, -0.15);
  rig.pulses.push({ obj: core, amp: 1.4 });
  mk(body, box(0.04, 0.3, 0.03), m.blue, 0.06, 1.38, -0.14, 0, 0, 0.35);
  mk(body, box(0.04, 0.3, 0.03), m.blue, -0.06, 1.22, -0.14, 0, 0, 0.35);
  // head: smooth helm with a lightning crest
  const head = grp(body, 0, 1.82, -0.02);
  rig.head = head;
  mk(head, rbox(0.24, 0.26, 0.26, 0.08), m.plate);
  mk(head, box(0.18, 0.035, 0.04), m.blueHot, 0, 0.02, -0.14);
  spike(head, V(0, 0.12, 0.04), V(0, 0.7, 1), 0.06, 0.38, m.blue, 4);
  spike(head, V(0.06, 0.12, 0.04), V(0.5, 1, 0.3), 0.03, 0.26, m.blueHot, 4);
  spike(head, V(-0.06, 0.12, 0.04), V(-0.5, 1, 0.3), 0.03, 0.26, m.blueHot, 4);
  // arms ending in bolt-blades (jagged, glowing)
  [-1, 1].forEach((s) => {
    const arm = artic(body, V(s * 0.32, 1.55, 0), V(s * 0.42, 1.12, -0.1), V(s * 0.38, 0.86, -0.3), 0.048, 0.04, m.plateDark, m.plate, 0.055, m.blue);
    arm.onLow(blade(1.1, 0.16, 0.035), m.steel, s * 0.38, 0.86, -0.34, -Math.PI / 2 + 0.2, 0, 0);
    arm.onLow(blade(1.0, 0.06, 0.045), m.blueHot, s * 0.38, 0.86, -0.36, -Math.PI / 2 + 0.2, 0, 0);
    // crackle arcing along the blade
    bolt(arm.low, m.blueHot, V(-0.04 * s, -0.26, -0.24), V(-0.04 * s, -0.4, -1.2), 0.16, 0.012);
    rig.arms.push({ up: arm.up, low: arm.low, phase: s < 0 ? Math.PI : 0, amp: 0.9 });
    const leg = artic(root, V(s * 0.14, 0.8, 0), V(s * 0.21, 0.45, -0.14), V(s * 0.17, 0.04, 0.04), 0.065, 0.048, m.plate, m.steelDark, 0.065, m.blue);
    leg.onLow(cone(0.055, 0.24, 4), m.steel, s * 0.17, 0.05, -0.12, -Math.PI / 2, 0, 0);
    rig.legs.push({ up: leg.up, low: leg.low, phase: s < 0 ? 0 : Math.PI, amp: 1 });
  });
  // streaming static cloak
  for (let i = 0; i < 6; i++) {
    const sp = grp(body, (i - 2.5) * 0.1, 1.55 - Math.abs(i - 2.5) * 0.08, 0.16);
    K.strut(sp, V(0, 0, 0), V(0, -0.5 - (i % 3) * 0.14, 0.14), 0.02, 0.01, m.steelDark);
    mk(sp, sph(0.03, 6), i % 2 ? m.blueHot : m.blue, 0, -0.5 - (i % 3) * 0.14, 0.14);
    rig.flutters.push({ obj: sp, phase: i * 0.8, amp: 1.4 });
  }
  rig.gait = { freq: 1.4, swing: 0.85, knee: 1.0, bob: 0.07, lean: 0.09 };
  rig.lunge = 0.35;
  return { hp: 180, speed: 7.4, damage: 30 };
}

// ───────────────────────── LIGHTNING ROD ─────────────────────────
function buildStormRod(root: THREE.Group, rig: EnemyRig): EliteStats {
  const { K, m } = stormKit();
  const { cyl, sph, cone, torus, V, mk, grp, artic } = K;
  const body = new THREE.Group();
  root.add(body);
  rig.body = body;

  mk(body, cyl(0.54, 0.76, 0.22, 10), m.plateDark, 0, 0.11, 0);
  mk(body, torus(0.64, 0.03, 8, 10), m.blue, 0, 0.24, 0, Math.PI / 2, 0, 0);
  for (let i = 0; i < 3; i++) { // tripod legs
    const a = (i / 3) * Math.PI * 2 + Math.PI / 2;
    const ca = Math.cos(a), sa = Math.sin(a);
    const j = artic(root, V(ca * 0.3, 0.42, sa * 0.3), V(ca * 0.7, 0.52, sa * 0.7), V(ca * 0.9, 0.04, sa * 0.9), 0.06, 0.048, m.steel, m.plateDark, 0.06, m.steelDark);
    j.onLow(cone(0.09, 0.2, 5), m.steelDark, ca * 0.92, 0.06, sa * 0.92, Math.PI, 0, 0);
    rig.legs.push({ up: j.up, low: j.low, phase: i * ((Math.PI * 2) / 3), amp: 0.55 });
  }
  mk(body, cyl(0.2, 0.3, 0.5, 8), m.steel, 0, 0.47, 0);

  const head = grp(body, 0, 1.0, 0);
  rig.scanners.push({ obj: head, phase: 0, amp: 1 });
  // tesla coil: stacked rings narrowing to a spire with a glowing orb on top
  mk(head, cyl(0.3, 0.38, 0.18, 12), m.plate, 0, 0.06, 0);
  for (let i = 0; i < 5; i++) mk(head, torus(0.3 - i * 0.04, 0.035, 8, 20), i % 2 ? m.steel : m.blue, 0, 0.22 + i * 0.16, 0, Math.PI / 2, 0, 0);
  mk(head, cyl(0.04, 0.07, 1.0, 8), m.steel, 0, 0.62, 0);
  spike(head, V(0, 1.1, 0), V(0, 1, 0), 0.035, 0.5, m.steel, 6); // the rod
  const orb = mk(head, sph(0.15, 12), m.blueHot, 0, 1.2, 0);
  mk(head, sph(0.3, 12), m.blueHalo, 0, 1.2, 0);
  rig.pulses.push({ obj: orb, amp: 1.5, speed: 1.6 });
  // arcs jumping from the orb to the rings
  for (let i = 0; i < 4; i++) {
    const a = i * 1.57 + 0.4;
    const ar = grp(head, 0, 0, 0);
    bolt(ar, m.blueHot, V(0, 1.2, 0), V(Math.cos(a) * 0.36, 0.5, Math.sin(a) * 0.36), 0.14, 0.014);
    rig.flutters.push({ obj: ar, phase: i * 1.4, amp: 1.6 });
  }
  // spark cannon on the side facing the target
  const gun = grp(head);
  rig.recoils.push({ obj: gun, amp: 0.8 });
  mk(gun, cyl(0.07, 0.1, 0.8, 10), m.steel, 0, 0.3, -0.5, Math.PI / 2, 0, 0);
  mk(gun, cyl(0.13, 0.13, 0.12, 10), m.steelDark, 0, 0.3, -0.92, Math.PI / 2, 0, 0);
  mk(gun, torus(0.11, 0.025, 8, 14), m.blue, 0, 0.3, -0.99);
  rig.pulses.push({ obj: mk(gun, sph(0.08, 8), m.blueHot, 0, 0.3, -0.97), amp: 2 });
  rig.gait = { freq: 0.8, swing: 0.5, knee: 0.5, bob: 0.015, lean: 0.02 };
  rig.lunge = 0.08;
  return { hp: 200, speed: 4.1, damage: 34 };
}

// ───────────────────────── NIMBUS COLOSSUS ─────────────────────────
function buildNimbusGolem(root: THREE.Group, rig: EnemyRig): EliteStats {
  const { K, m } = stormKit();
  const { rbox, box, sph, cone, torus, V, mk, grp, artic } = K;
  const body = new THREE.Group();
  root.add(body);
  rig.body = body;

  mk(body, rbox(1.2, 0.5, 0.85, 0.15), m.plateDark, 0, 1.1, 0);
  // torso: a steel frame stuffed with dark thundercloud
  mk(body, rbox(1.3, 1.5, 0.9, 0.18), m.plateDark, 0, 2.0, 0);
  const chest = cloudMass(body, [m.cloudDark, m.cloud, m.cloudDark], 0, 2.1, -0.1, 0.62, 7);
  rig.flutters.push({ obj: chest, phase: 0.4, amp: 0.3 });
  // storm core in a ring housing on the chest
  mk(body, torus(0.34, 0.05, 8, 24), m.steel, 0, 2.05, -0.62);
  const heart = mk(body, sph(0.2, 14), m.white, 0, 2.05, -0.64);
  mk(body, sph(0.42, 14), m.blueHalo, 0, 2.05, -0.64);
  rig.pulses.push({ obj: heart, amp: 1.4 }, { obj: body.children[body.children.length - 1], amp: 1.3, phase: 0.6 });
  for (let i = 0; i < 6; i++) { // lightning forking inside the cloud
    const a = i * 1.05;
    const ar = grp(body, 0, 0, 0);
    bolt(ar, m.blueHot, V(0, 2.05, -0.64), V(Math.cos(a) * 0.55, 2.05 + Math.sin(a * 2) * 0.4, -0.5 + Math.sin(a) * 0.3), 0.2, 0.014);
    rig.flutters.push({ obj: ar, phase: i * 1.1, amp: 1.2 });
  }
  // head: a metal skull face sunk into a cloud hood
  const head = grp(body, 0, 3.05, -0.22);
  rig.head = head;
  mk(head, rbox(0.46, 0.42, 0.42, 0.1), m.plate);
  [-1, 1].forEach((s) => mk(head, box(0.12, 0.05, 0.05), m.blueHot, s * 0.11, 0.03, -0.22));
  mk(head, box(0.24, 0.04, 0.05), m.blue, 0, -0.1, -0.22);
  cloudMass(head, [m.cloud, m.cloudLight], 0, 0.28, 0.05, 0.3, 5);
  spike(head, V(0, 0.45, 0), V(0, 1, 0), 0.04, 0.5, m.steel, 5); // lightning-rod crown
  // shoulders: ring pauldrons
  [-1, 1].forEach((s) => {
    mk(body, torus(0.42, 0.07, 8, 22), m.steel, s * 0.85, 2.75, 0, Math.PI / 2 - 0.3, 0, 0);
    mk(body, torus(0.34, 0.025, 8, 22), m.blue, s * 0.85, 2.77, 0, Math.PI / 2 - 0.3, 0, 0);
    const arm = artic(body, V(s * 0.95, 2.55, 0), V(s * 1.3, 1.7, -0.15), V(s * 1.2, 0.95, -0.55), 0.18, 0.16, m.plateDark, m.plate, 0.19, m.blue);
    arm.onUp(sph(0.38, 10), m.cloud, s * 1.0, 2.62, 0);
    arm.onLow(sph(0.42, 10), m.cloudDark, s * 1.2, 0.82, -0.6); // cloud fists
    arm.onLow(sph(0.26, 10), m.blueHot, s * 1.2, 0.82, -0.82);
    arm.onLow(sph(0.5, 10), m.blueHalo, s * 1.2, 0.82, -0.82);
    for (let i = -1; i <= 1; i++) arm.onLow(cone(0.05, 0.32, 4), m.steel, s * 1.2 + i * 0.13, 0.64, -0.96, -Math.PI / 2 - 0.4, 0, 0);
    rig.arms.push({ up: arm.up, low: arm.low, phase: s < 0 ? Math.PI : 0, amp: 0.8 });
    const leg = artic(root, V(s * 0.42, 1.05, 0), V(s * 0.56, 0.58, 0.05), V(s * 0.58, 0.35, 0.05), 0.22, 0.18, m.plate, m.plateDark, 0.18, m.blue);
    leg.onLow(rbox(0.5, 0.28, 0.66, 0.1), m.plateDark, s * 0.58, 0.15, -0.05);
    leg.onLow(box(0.44, 0.03, 0.56), m.blue, s * 0.58, 0.29, -0.05);
    rig.legs.push({ up: leg.up, low: leg.low, phase: s < 0 ? 0 : Math.PI, amp: 0.85 });
  });
  // drizzle falling from the belt
  for (let i = 0; i < 4; i++) {
    const d = grp(body, (i - 1.5) * 0.34, 1.32, -0.4);
    mk(d, K.cyl(0.015, 0.02, 0.4, 6), m.wind, 0, -0.2, 0);
    mk(d, sph(0.04, 8), m.blue, 0, -0.42, 0);
    rig.flutters.push({ obj: d, phase: i * 1.3, amp: 0.7 });
  }
  rig.gait = { freq: 0.75, swing: 0.55, knee: 0.55, bob: 0.07, lean: 0.045 };
  rig.lunge = 0.3;
  return { hp: 440, speed: 3.6, damage: 36 };
}

/** Builds a MAP 9 enemy into `group` (registers its animation rig); returns null for other types. */
export function buildStormEnemy(type: string, group: THREE.Group): EliteStats | null {
  if (!isStormType(type)) return null;
  const rig = createRig(type);
  group.userData.enemyRig = rig;
  switch (type) {
    case 'cumulus': return buildCumulus(group, rig);
    case 'galehound': return buildGaleHound(group, rig);
    case 'tempest': return buildTempest(group, rig);
    case 'stormrod': return buildStormRod(group, rig);
    case 'nimbusgolem': return buildNimbusGolem(group, rig);
  }
  return null;
}
