import * as THREE from 'three';

/**
 * Procedural enemy animation (walk / idle / attack) driven entirely by the enemy's own motion:
 *  - movement speed is measured from the position delta, so every AI pattern animates correctly
 *  - ranged attacks are detected when `shootCooldown` jumps back up (a shot was just fired)
 *    and wind up while it counts down to 0
 *  - melee attacks are detected when `attackCooldown` jumps back up (a hit just landed)
 *
 * Models register their moving parts into an `EnemyRig` (see `buildEnemyModel`), which is stored
 * on `group.userData.enemyRig`. Rest pose = all rotations 0, so un-animated models look unchanged.
 */

export interface RigLimb {
  /** pivot at the hip / shoulder */
  up: THREE.Object3D;
  /** pivot at the knee / elbow (child of `up`) */
  low: THREE.Object3D;
  /** gait phase offset (rad) */
  phase: number;
  /** swing amplitude multiplier */
  amp?: number;
}

export interface RigPart {
  obj: THREE.Object3D;
  /** phase / seed */
  phase?: number;
  /** amplitude multiplier */
  amp?: number;
  /** rotation / spin speed multiplier */
  speed?: number;
}

export interface EnemyRig {
  type: string;
  /** moves the whole upper body (everything except planted legs) */
  body?: THREE.Object3D;
  legs: RigLimb[];
  arms: RigLimb[];
  /** head pivot (nods with the stride, thrusts on melee) */
  head?: THREE.Object3D;
  /** lower jaw pivot (opens on melee) */
  jaw?: THREE.Object3D;
  tails: RigPart[];
  /** parts that spin continuously (rotors, gyro rings); speed rises with movement */
  spinners: (RigPart & { axis: 'x' | 'y' | 'z' })[];
  /** parts that slide back along +z on firing (barrels, tail cannons) */
  recoils: RigPart[];
  /** parts that sway gently (cloaks, antennas, spikes) */
  flutters: RigPart[];
  /** parts that pulse in scale (glowing cores, lenses) — also flare during wind-up */
  pulses: RigPart[];
  /** parts that yaw to scan while idle (turret heads) */
  scanners: RigPart[];
  /** rollers / wheels that roll with distance travelled */
  wheels: RigPart[];
  /** hover-type: tilt toward velocity, bob in place */
  hover?: { bob: number; tilt: number };
  /** gait tuning */
  gait: { freq: number; swing: number; knee: number; bob: number; lean: number };
  /** how strongly attacks lunge the body forward */
  lunge: number;
  /**
   * Current action cue written by the AI every frame (e.g. 'heal', 'burrow', 'throw', 'charge') and its
   * progress `k` (0..1). Type-specific animators read it to play dedicated motions.
   */
  act: { name: string; k: number };
  /** type-specific animator, run after the generic gait (see eliteEnemyModels.ts) */
  custom?: (rig: EnemyRig, time: number, dt: number, moveAmt: number, mesh: THREE.Object3D) => void;
  /** free slots for type-specific parts used by `custom` */
  extras: Record<string, any>;
  // ── runtime state ──
  rt: {
    last: THREE.Vector3;
    ready: boolean;
    speed: number;
    cycle: number;
    prevShoot: number;
    prevMelee: number;
    fire: number; // 0..1 recoil kick, decays
    strike: number; // 0..1 melee strike, decays
    meleeWind: number; // 0..1 melee wind-up
    windup: number; // 0..1 charge before a shot
    wheel: number;
    seed: number;
  };
}

export const createRig = (type: string): EnemyRig => ({
  type,
  legs: [],
  arms: [],
  tails: [],
  spinners: [],
  recoils: [],
  flutters: [],
  pulses: [],
  scanners: [],
  wheels: [],
  gait: { freq: 1, swing: 0.7, knee: 0.9, bob: 0.04, lean: 0.06 },
  lunge: 0.25,
  act: { name: 'idle', k: 0 },
  extras: {},
  rt: {
    last: new THREE.Vector3(),
    ready: false,
    speed: 0,
    cycle: Math.random() * 6,
    prevShoot: 0,
    prevMelee: 0,
    fire: 0,
    strike: 0,
    meleeWind: 0,
    windup: 0,
    wheel: 0,
    seed: Math.random() * 100,
  },
});

const _lv = new THREE.Vector3();
const _lq = new THREE.Quaternion();
const damp = (cur: number, target: number, rate: number, dt: number) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);

export interface EnemyAnimInput {
  /** world-facing enemy root (position is read, rotation is owned by the AI) */
  mesh: THREE.Object3D;
  shootCooldown?: number;
  attackCooldown: number;
  /** true while the player is within melee reach (used to wind up before a strike) */
  near?: boolean;
}

/** Call once per enemy per frame (alive enemies only). */
export function animateEnemy(input: EnemyAnimInput, time: number, dt: number): void {
  const rig = input.mesh.userData.enemyRig as EnemyRig | undefined;
  if (!rig) return;
  const rt = rig.rt;
  const dtc = Math.min(dt, 0.05);
  if (dtc <= 0) return;

  // ── measured speed (units / s), smoothed ──
  const pos = input.mesh.position;
  if (!rt.ready) {
    rt.last.copy(pos);
    rt.ready = true;
  }
  const dx = pos.x - rt.last.x;
  const dz = pos.z - rt.last.z;
  const dy = pos.y - rt.last.y;
  rt.last.copy(pos);
  const inst = Math.hypot(dx, dz) / dtc;
  rt.speed = damp(rt.speed, Math.min(inst, 14), 10, dtc);
  const moveAmt = Math.min(1, rt.speed / 3.5); // 0 idle .. 1 full stride
  const g = rig.gait;

  // ── attack events ──
  const shoot = input.shootCooldown;
  if (shoot !== undefined) {
    if (shoot > rt.prevShoot + 0.25 && rt.prevShoot < 0.6) rt.fire = 1; // just fired
    rt.windup = shoot > 0 && shoot < 0.7 ? 1 - shoot / 0.7 : 0; // last 0.7s before firing
    rt.prevShoot = shoot;
  }
  // melee: wind up while the cooldown is about to expire and the player is close, strike on the hit
  if (input.attackCooldown > rt.prevMelee + 0.5) rt.strike = 1;
  rt.prevMelee = input.attackCooldown;
  const meleeWindTarget = input.near && input.attackCooldown > 0 && input.attackCooldown < 0.4 ? 1 - input.attackCooldown / 0.4 : 0;
  rt.meleeWind = damp(rt.meleeWind, meleeWindTarget, 18, dtc);
  rt.fire = Math.max(0, rt.fire - dtc * 3.2);
  rt.strike = Math.max(0, rt.strike - dtc * 2.8);
  const fire = easeOut(rt.fire);
  const strike = easeOut(rt.strike);
  const wind = rt.meleeWind;

  // ── gait cycle ──
  rt.cycle += dtc * (2.2 + rt.speed * 1.35) * g.freq * (moveAmt > 0.02 ? 1 : 0.4);
  const cyc = rt.cycle;
  const breathe = Math.sin(time * 1.7 + rt.seed);

  // ── body ──
  if (rig.body) {
    const b = rig.body;
    const step = Math.abs(Math.sin(cyc));
    const bobY = step * g.bob * moveAmt + breathe * 0.012;
    const pitch = -g.lean * 0.7 * moveAmt - strike * rig.lunge + wind * rig.lunge * 0.5 + rt.windup * 0.06 + fire * 0.05;
    const roll = Math.sin(cyc) * g.lean * moveAmt;
    const offZ = -strike * rig.lunge * 1.2 + wind * rig.lunge * 0.4 + fire * 0.1;
    if (rig.hover) {
      // world velocity -> the enemy's local frame (-Z is forward)
      _lv.set(dx / dtc, 0, dz / dtc).applyQuaternion(_lq.copy(input.mesh.quaternion).invert());
      const lvx = _lv.x;
      const lvz = _lv.z;
      b.position.y = Math.sin(time * 2.1 + rt.seed) * rig.hover.bob;
      b.rotation.x = damp(b.rotation.x, THREE.MathUtils.clamp(lvz * rig.hover.tilt, -0.4, 0.4) + (dy < -0.01 ? 0.05 : 0) + pitch, 6, dtc);
      b.rotation.z = damp(b.rotation.z, THREE.MathUtils.clamp(-lvx * rig.hover.tilt, -0.45, 0.45), 6, dtc);
    } else {
      b.position.y = bobY;
      b.rotation.x = pitch;
      b.rotation.z = roll;
    }
    b.position.z = offZ;
  }

  // ── legs: diagonal gait with knee flex; idle = subtle weight shifting ──
  for (const L of rig.legs) {
    const ph = cyc + L.phase;
    const amp = (L.amp ?? 1) * g.swing;
    L.up.rotation.x = Math.sin(ph) * amp * moveAmt + Math.sin(time * 1.3 + L.phase) * 0.015 * (1 - moveAmt);
    // the knee folds while the leg swings forward
    L.low.rotation.x = -Math.max(0, Math.cos(ph)) * g.knee * moveAmt * (L.amp ?? 1) - wind * 0.15;
  }

  // ── arms: counter-swing, then raise overhead (wind-up) and slam forward (strike) ──
  for (const A of rig.arms) {
    const ph = cyc + A.phase;
    const amp = (A.amp ?? 1) * g.swing * 0.8;
    const up = Math.sin(ph) * amp * moveAmt + Math.sin(time * 1.4 + A.phase) * 0.03 + wind * 1.7 + strike * 0.75 - rt.windup * 0.25;
    const low = Math.max(0, Math.cos(ph)) * 0.45 * moveAmt + 0.08 + wind * 0.7 - strike * 0.25 + rt.windup * 0.3;
    A.up.rotation.x = damp(A.up.rotation.x, up, 30, dtc);
    A.low.rotation.x = damp(A.low.rotation.x, low, 30, dtc);
  }

  // ── head ──
  if (rig.head) {
    const h = rig.head;
    if (h.userData.baseZ === undefined) h.userData.baseZ = h.position.z;
    h.rotation.x = Math.sin(cyc * 2) * 0.05 * moveAmt + wind * 0.3 - strike * 0.5 - rt.windup * 0.1;
    h.rotation.y = Math.sin(time * 0.9 + rt.seed) * 0.12 * (1 - moveAmt * 0.6);
    h.rotation.z = Math.sin(cyc) * 0.05 * moveAmt;
    h.position.z = h.userData.baseZ - strike * 0.22 + wind * 0.08;
  }
  if (rig.jaw) {
    rig.jaw.rotation.x = -(wind * 0.6 + strike * 0.4 + moveAmt * 0.05 + Math.max(0, Math.sin(time * 6 + rt.seed)) * 0.02);
  }

  // ── tails ──
  for (const T of rig.tails) {
    const ph = T.phase ?? 0;
    const a = T.amp ?? 1;
    T.obj.rotation.y = Math.sin(time * 2.4 + ph + cyc * 0.5) * 0.35 * a * (0.5 + moveAmt);
    T.obj.rotation.x = -fire * 0.45 * a + Math.sin(time * 1.6 + ph) * 0.06 * a + wind * 0.25 * a - strike * 0.35 * a;
  }

  // ── spinners ──
  for (const S of rig.spinners) {
    S.obj.rotation[S.axis] += dtc * (S.speed ?? 1) * (1 + moveAmt * 0.6 + rt.windup * 0.8);
  }

  // ── recoil ──
  for (const R of rig.recoils) {
    if (R.obj.userData.baseZ === undefined) R.obj.userData.baseZ = R.obj.position.z;
    R.obj.position.z = R.obj.userData.baseZ + fire * 0.35 * (R.amp ?? 1) - rt.windup * 0.04;
  }

  // ── flutters ──
  for (const F of rig.flutters) {
    const ph = F.phase ?? 0;
    const a = F.amp ?? 1;
    F.obj.rotation.x = Math.sin(time * 2.6 * (F.speed ?? 1) + ph) * 0.12 * a * (0.5 + moveAmt) + moveAmt * 0.18 * a;
    F.obj.rotation.z = Math.cos(time * 2.0 * (F.speed ?? 1) + ph * 1.3) * 0.08 * a;
  }

  // ── pulses (glow flares during wind-up) ──
  for (const P of rig.pulses) {
    if (P.obj.userData.baseScale === undefined) P.obj.userData.baseScale = P.obj.scale.x;
    const k = 1 + Math.sin(time * 3 * (P.speed ?? 1) + (P.phase ?? 0)) * 0.06 * (P.amp ?? 1) + (rt.windup + wind) * 0.45 * (P.amp ?? 1) + fire * 0.25;
    P.obj.scale.setScalar(P.obj.userData.baseScale * k);
  }

  // ── scanners (turret / sensor heads) ──
  for (const C of rig.scanners) {
    C.obj.rotation.y = Math.sin(time * 0.8 + (C.phase ?? 0) + rt.seed) * 0.35 * (C.amp ?? 1) * (1 - rt.windup);
  }

  // ── rolling wheels ──
  if (rig.wheels.length) {
    rt.wheel += rt.speed * dtc;
    for (const W of rig.wheels) W.obj.rotation.x = -rt.wheel * (W.speed ?? 1.8);
  }

  // ── dedicated per-type motion (elite enemies) ──
  rig.custom?.(rig, time, dtc, moveAmt, input.mesh);
}

/** Boss telegraph cue written by the boss AI each frame: pose name + wind-up progress (0..1). */
export interface BossCue {
  name: string;
  k: number;
  /** -1 / +1: which side a sweep comes from */
  side?: number;
}

/**
 * Boss-level motion for the monolithic boss rigs (feet sit at y = 0 inside `bossRefs.rig`):
 * heavy stomp bob + sway while walking, lean into movement, rear back on wind-up and
 * slam forward on every attack, with enrage shudder.
 */
export function animateBossMotion(input: EnemyAnimInput, rig: THREE.Object3D, time: number, dt: number, phase: number): void {
  const dtc = Math.min(dt, 0.05);
  if (dtc <= 0) return;
  let st = rig.userData.motion as
    | { last: THREE.Vector3; speed: number; cycle: number; prevShoot: number; prevMelee: number; fire: number; strike: number; windup: number; wind: number; ready: boolean }
    | undefined;
  if (!st) {
    st = { last: new THREE.Vector3(), speed: 0, cycle: 0, prevShoot: 0, prevMelee: 0, fire: 0, strike: 0, windup: 0, wind: 0, ready: false };
    rig.userData.motion = st;
  }
  const pos = input.mesh.position;
  if (!st.ready) {
    st.last.copy(pos);
    st.ready = true;
  }
  const inst = Math.hypot(pos.x - st.last.x, pos.z - st.last.z) / dtc;
  st.last.copy(pos);
  st.speed = damp(st.speed, Math.min(inst, 10), 8, dtc);
  const move = Math.min(1, st.speed / 3);

  const shoot = input.shootCooldown;
  if (shoot !== undefined) {
    if (shoot > st.prevShoot + 0.25 && st.prevShoot < 0.8) st.fire = 1;
    st.windup = shoot > 0 && shoot < 0.9 ? 1 - shoot / 0.9 : 0;
    st.prevShoot = shoot;
  }
  if (input.attackCooldown > st.prevMelee + 0.5) st.strike = 1;
  st.prevMelee = input.attackCooldown;
  const bossWindT = input.near && input.attackCooldown > 0 && input.attackCooldown < 0.5 ? 1 - input.attackCooldown / 0.5 : 0;
  st.wind = damp(st.wind, bossWindT, 14, dtc);
  st.fire = Math.max(0, st.fire - dtc * 2.6);
  st.strike = Math.max(0, st.strike - dtc * 1.8);

  st.cycle += dtc * (1.4 + st.speed * 0.55) * (1 + (phase - 1) * 0.2);
  const stomp = Math.abs(Math.sin(st.cycle));
  const sway = Math.sin(st.cycle);
  const strike = easeOut(st.strike);
  const fire = easeOut(st.fire);
  const enr = (phase - 1) / 2;

  // ── telegraph cue: readable full-body wind-ups (rear up, crouch, spin, aim ...) ──
  const ud = input.mesh.userData;
  const cue = (ud.bossCue as BossCue | undefined) ?? { name: 'idle', k: 0 };
  if (ud.bossHit > 0) {
    st.strike = Math.max(st.strike, Math.min(1, ud.bossHit));
    ud.bossHitBody = 1;
    ud.bossHit = 0;
  }
  const P = (st as any).pose ?? ((st as any).pose = { pitch: 0, lift: 0, twist: 0, spin: 0, spinRate: 0, tremble: 0 });
  const ck = THREE.MathUtils.clamp(cue.k, 0, 1);
  let tPitch = 0, tLift = 0, tTwist = 0, tTremble = 0, tSpin = 0;
  switch (cue.name) {
    case 'raise': tPitch = 0.13 * ck; tLift = 1.0 * ck; tTremble = ck > 0.7 ? 0.5 : 0; break;
    case 'crouch': tPitch = -0.12 * ck; tLift = -0.6 * ck; tTremble = ck; break;
    case 'charge': tPitch = -0.24; tLift = -0.25; break;
    case 'cast': tPitch = 0.06 * ck; tLift = 0.45 * ck; tTremble = 0.4 * ck; break;
    case 'spin': tSpin = ck * (cue.side ?? 1) * 4.2; tLift = 0.3 * ck; break;
    case 'lob': tPitch = 0.12 * ck; tLift = 0.25 * ck; break;
    case 'aim': tPitch = -0.05 * ck; tTremble = ck > 0.8 ? 0.6 : 0; break;
    case 'sweep': tTwist = -(cue.side ?? 1) * 0.7 * ck; tPitch = -0.05 * ck; tLift = -0.3 * ck; break;
    case 'channel': tLift = 0.55 * ck + Math.sin(time * 3) * 0.15 * ck; tPitch = 0.04 * ck; tTremble = 0.3 * ck; break;
    case 'recover': tPitch = -0.14; tLift = -0.3; break;
    case 'roar': tPitch = 0.2 * ck; tLift = 0.5 * ck; tTremble = 1; break;
  }
  // a sweep that has been released whips the body around the other way
  const hitBody = ud.bossHitBody ?? 0;
  if (cue.name === 'sweep' && hitBody > 0) tTwist = (cue.side ?? 1) * 0.9 * hitBody;
  ud.bossHitBody = Math.max(0, hitBody - dtc * 2.2);
  P.pitch = damp(P.pitch, tPitch, 7, dtc);
  P.lift = damp(P.lift, tLift, 6, dtc);
  P.twist = damp(P.twist, tTwist, cue.name === 'sweep' && hitBody > 0 ? 16 : 6, dtc);
  P.tremble = damp(P.tremble, tTremble, 8, dtc);
  P.spinRate = damp(P.spinRate, tSpin, 2.5, dtc);
  P.spin += P.spinRate * dtc;
  if (Math.abs(P.spinRate) < 0.05) P.spin = damp(P.spin, Math.round(P.spin / (Math.PI * 2)) * Math.PI * 2, 4, dtc);
  const trem = Math.sin(time * 47) * 0.012 * P.tremble;

  rig.rotation.x = -0.035 * move - strike * 0.11 + st.wind * 0.07 + st.windup * 0.045 + fire * 0.03 + P.pitch + trem;
  rig.rotation.z = sway * 0.03 * move + Math.sin(time * 38) * 0.004 * enr + Math.sin(time * 41) * 0.01 * P.tremble;
  rig.rotation.y = Math.sin(time * 0.7) * 0.015 + sway * 0.015 * move + P.twist + P.spin;
  rig.position.y += stomp * 0.14 * move - strike * 0.18 + Math.sin(time * 33) * 0.01 * enr * st.windup + P.lift;
  rig.position.z = -strike * 0.5 + st.wind * 0.25 + fire * 0.18;
}
