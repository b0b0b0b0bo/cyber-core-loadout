/**
 * Reload animations for every non-melee weapon, as keyframes over the normalized reload
 * progress t (0..1). One style per weapon family, all staged like a modern FPS reload —
 * the off hand does the work, every mechanical event lands with a kick, and each style
 * ends with a small flourish before the gun settles back into the ready pose:
 *
 *   pistol   → thumb the release, flick the old mag out, seat a fresh one with a palm slap,
 *              overhand slide rack on an empty gun (see ./pistolReload)
 *   revolver → cylinder flicked out, muzzle up to dump the brass, speed-loader in, wrist flick
 *              to close it, then a full trigger-guard spin
 *   akimbo   → TWIN VIPER: both mags dropped at once, guns dipped to the hip pouches, brought
 *              back up crossed in an X and snapped apart as both slides slam home
 *   rifle    → canted mag drop, fresh mag driven home with a slap, off hand rips the charging handle
 *   shotgun  → rolled over, shells thumbed in one by one, off hand racks the pump and presents
 *   heavy    → rolled over, spent energy cell vents and pops free, fresh cell slammed in, power-up hum
 *
 * The battle scene applies:
 *   gun    → offset added to the viewmodel rig's pose
 *   part   → offset of the reload part (`gunMag` / `heavyCell` / `reloadShell`) from its docked position
 *   hand   → absolute holder-space pose of the off hand (`gunReloadHand`)
 *   loader → absolute holder-space pose of the revolver speed-loader (`speedLoader`)
 *   spin   → rotation (rad) of the whole weapon about the trigger guard (revolver flourish)
 *   chargeHandle → 0..1 travel of the rifle charging handle (`chargingHandle`)
 *   slide / pump / drum / handR / handL / mags → named sub-meshes (see battleWeaponModel.ts)
 */
import { Weapon } from '../types';
import type { ReloadSfxName } from './sound';
import { PartPose } from './pistolReload';

export type ReloadStyle = 'pistol' | 'revolver' | 'akimbo' | 'rifle' | 'shotgun' | 'heavy';

export function getReloadStyle(w: Weapon): ReloadStyle | null {
  if (w.category === 'MELEE') return null;
  switch (w.modelType) {
    case 'handgun':
      if (w.id === 'sub_akimbo') return 'akimbo';
      return w.id === 'sub_smg' ? 'rifle' : 'pistol';
    case 'revolver':
      return 'revolver';
    case 'rifle':
      return 'rifle';
    case 'shotgun':
      return 'shotgun';
    case 'launcher':
    case 'railgun':
      return 'heavy';
    default:
      return null;
  }
}

/** Side effects the battle scene performs when an event's time is reached. */
export type ReloadAction =
  | 'dropMag' // detach the pistol / rifle magazine and let it fall
  | 'ejectCell' // the spent heavy cell pops up and flies out
  | 'casings' // revolver brass dumped out of the cylinder
  | 'dropAkimbo' // both TWIN VIPER magazines fall at once
  | 'steam'; // pressure vent puff at the receiver

export interface ReloadSfxEvent {
  t: number;
  step?: ReloadSfxName;
  action?: ReloadAction;
}

const PISTOL_EVENTS = (fromEmpty: boolean): ReloadSfxEvent[] => [
  { t: 0.1, step: 'release' },
  { t: 0.15, step: 'drop', action: 'dropMag' },
  { t: 0.58, step: 'seat' },
  { t: 0.62, step: 'slap' },
  ...(fromEmpty
    ? [
        { t: 0.72, step: 'pull' as const },
        { t: 0.77, step: 'slide' as const },
      ]
    : [{ t: 0.74, step: 'flick' as const }]),
];

const EVENTS: Record<Exclude<ReloadStyle, 'pistol'>, ReloadSfxEvent[]> = {
  revolver: [
    { t: 0.1, step: 'cylinder' },
    { t: 0.22, step: 'drop', action: 'casings' },
    { t: 0.52, step: 'seat' },
    { t: 0.66, step: 'cylinder' },
    { t: 0.7, step: 'flick' },
    { t: 0.9, step: 'slide' },
  ],
  akimbo: [
    { t: 0.1, step: 'release' },
    { t: 0.15, step: 'drop', action: 'dropAkimbo' },
    { t: 0.42, step: 'seat' },
    { t: 0.47, step: 'seat' },
    { t: 0.56, step: 'flick' },
    { t: 0.68, step: 'slide' },
  ],
  rifle: [
    { t: 0.1, step: 'release' },
    { t: 0.16, step: 'drop', action: 'dropMag' },
    { t: 0.46, step: 'seat' },
    { t: 0.52, step: 'slap' },
    { t: 0.65, step: 'pull' },
    { t: 0.72, step: 'slide' },
  ],
  shotgun: [
    { t: 0.2, step: 'shell' },
    { t: 0.32, step: 'shell' },
    { t: 0.44, step: 'shell' },
    { t: 0.56, step: 'shell' },
    { t: 0.77, step: 'pump' },
    { t: 0.88, step: 'flick' },
  ],
  heavy: [
    { t: 0.08, step: 'hiss', action: 'steam' },
    { t: 0.17, step: 'release', action: 'ejectCell' },
    { t: 0.56, step: 'seat' },
    { t: 0.62, step: 'slap' },
    { t: 0.72, step: 'power' },
    { t: 0.84, step: 'slide' },
  ],
};

export function getReloadEvents(style: ReloadStyle, fromEmpty: boolean): ReloadSfxEvent[] {
  return style === 'pistol' ? PISTOL_EVENTS(fromEmpty) : EVENTS[style];
}

/** @deprecated kept for older call sites; use getReloadEvents */
export const RELOAD_SFX = EVENTS;

export type HandPose = PartPose & { visible: boolean };

export interface WeaponReloadPose {
  gun: PartPose;
  part: PartPose & { visible: boolean };
  slideBack: number;
  pump: number;
  /** Revolver cylinder: sideways swing-out and spin about its axis. */
  drum: { x: number; rz: number };
  /** TWIN VIPER: per-hand offsets and slide travel. */
  handR: PartPose;
  handL: PartPose;
  slideR: number;
  slideL: number;
  /** TWIN VIPER: are the magazines in the grips */
  magR: boolean;
  magL: boolean;
  /** off hand (holder space, absolute) */
  hand: HandPose;
  /** revolver speed-loader (holder space, absolute) */
  loader: HandPose;
  /** rifle charging handle travel 0..1 */
  chargeHandle: number;
  /** whole-weapon spin about the trigger guard (rad) */
  spin: number;
}

/** Where reload parts sit when docked (holder space) — must match battleWeaponModel.ts. */
export interface ReloadDocks {
  mag: { x: number; y: number; z: number; rx: number };
  shell: { x: number; y: number; z: number };
  cell: { x: number; y: number; z: number };
}

export const DEFAULT_DOCKS: ReloadDocks = {
  mag: { x: 0, y: -0.16, z: -0.12, rx: 0.2 },
  shell: { x: 0, y: -0.08, z: -0.04 },
  cell: { x: 0, y: 0, z: -0.3 },
};

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const ss = (a: number, b: number, t: number) => {
  const u = clamp01((t - a) / (b - a));
  return u * u * (3 - 2 * u);
};
const easeInOutCubic = (u: number) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
const easeOutBack = (u: number) => {
  const c1 = 1.5;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2);
};
const seg = (a: number, b: number, t: number) => clamp01((t - a) / (b - a));
/** 0 → 1 → 0 pulse over [a, b]. */
const bump = (a: number, b: number, t: number) => (t > a && t < b ? Math.sin((Math.PI * (t - a)) / (b - a)) : 0);
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
const pose = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0): PartPose => ({ x, y, z, rx, ry, rz });
const lerpPose = (a: PartPose, b: PartPose, u: number): PartPose =>
  pose(lerp(a.x, b.x, u), lerp(a.y, b.y, u), lerp(a.z, b.z, u), lerp(a.rx, b.rx, u), lerp(a.ry, b.ry, u), lerp(a.rz, b.rz, u));
const addPose = (a: PartPose, b: PartPose): PartPose => pose(a.x + b.x, a.y + b.y, a.z + b.z, a.rx + b.rx, a.ry + b.ry, a.rz + b.rz);
const hidden = (): HandPose => ({ ...pose(), visible: false });
const shown = (p: PartPose): HandPose => ({ ...p, visible: true });

/** Rotate (x, y, z) by Euler XYZ (rx, ry, rz) — used to keep the hand cupped under a tilted part. */
function rot(v: [number, number, number], rx: number, ry: number, rz: number): [number, number, number] {
  let [x, y, z] = v;
  // three.js Euler 'XYZ' = Rx * Ry * Rz applied to the vector (Rz first)
  let c = Math.cos(rz);
  let s = Math.sin(rz);
  [x, y] = [x * c - y * s, x * s + y * c];
  c = Math.cos(ry);
  s = Math.sin(ry);
  [x, z] = [x * c + z * s, -x * s + z * c];
  c = Math.cos(rx);
  s = Math.sin(rx);
  [y, z] = [y * c - z * s, y * s + z * c];
  return [x, y, z];
}

/** Hand cupping a part from below: part absolute pose + a local offset in the part's frame. */
function handOn(part: PartPose, off: [number, number, number], extra: PartPose = pose()): PartPose {
  const [ox, oy, oz] = rot(off, part.rx, part.ry, part.rz);
  return pose(part.x + ox + extra.x, part.y + oy + extra.y, part.z + oz + extra.z, part.rx + extra.rx, part.ry + extra.ry, part.rz + extra.rz);
}

/** Off-screen spot (lower left) the off hand comes from / goes back to. */
const HAND_OFF = pose(-0.42, -0.62, 0.28, -0.4, 0.3, 0.9);

const emptyPose = (): WeaponReloadPose => ({
  gun: pose(),
  part: { ...pose(), visible: false },
  slideBack: 0,
  pump: 0,
  drum: { x: 0, rz: 0 },
  handR: pose(),
  handL: pose(),
  slideR: 0,
  slideL: 0,
  magR: true,
  magL: true,
  hand: hidden(),
  loader: hidden(),
  chargeHandle: 0,
  spin: 0,
});

// ───────────────────────────── RIFLE / SMG ─────────────────────────────
const RIFLE_MAG_START = pose(-0.24, -0.5, 0.2, -0.7, 0.35, 1.0);
/** charging handle (holder space) — the hand hooks it with the fingers */
const CHARGING_HANDLE = pose(-0.045, 0.075, 0.1, 0.25, 0.35, -1.25);

function rifleReload(t: number, d: ReloadDocks): WeaponReloadPose {
  const out = emptyPose();
  // cant to the right to show the mag well, then roll back level for the charging handle
  const cant = ss(0.02, 0.13, t) * (1 - ss(0.5, 0.6, t));
  const top = ss(0.52, 0.6, t) * (1 - ss(0.78, 0.92, t));
  const seat = bump(0.45, 0.53, t);
  const slap = bump(0.51, 0.57, t);
  const rip = bump(0.64, 0.74, t);
  const snap = bump(0.72, 0.8, t);
  out.gun = pose(
    -0.13 * cant - 0.05 * top,
    0.15 * cant + 0.06 * top + 0.025 * seat + 0.02 * slap,
    -0.03 * cant + 0.03 * rip - 0.025 * snap,
    0.2 * cant + 0.14 * top - 0.07 * seat + 0.06 * rip - 0.08 * snap,
    0.26 * cant + 0.28 * top,
    -0.72 * cant - 0.32 * top + 0.06 * snap,
  );

  // magazine (offset from its dock)
  let part = pose();
  let visible = true;
  if (t < 0.16) {
    part.y = -0.11 * ss(0.1, 0.16, t); // released, slides out of the well
    part.rz = 0.1 * ss(0.12, 0.16, t);
  } else if (t < 0.2) {
    visible = false; // the old mag is falling as a detached object
  } else if (t < 0.38) {
    part = lerpPose(RIFLE_MAG_START, pose(0, -0.1, 0.004, 0.08, 0, -0.06), easeOutBack(seg(0.2, 0.38, t)));
  } else if (t < 0.46) {
    // drive it in: angled hook at the front of the well, then rock back and up
    const u = seg(0.38, 0.46, t);
    part = pose(0, lerp(-0.1, -0.012, u * u), lerp(0.004, 0, u), lerp(0.08, 0, u), 0, lerp(-0.06, 0, u));
  } else if (t < 0.52) {
    part.y = lerp(-0.012, 0, ss(0.46, 0.5, t));
  }
  out.part = { ...part, visible };

  // off hand
  const magAbs = pose(d.mag.x + part.x, d.mag.y + part.y, d.mag.z + part.z, d.mag.rx + part.rx, part.ry, part.rz);
  const cup: [number, number, number] = [0, -0.14, 0];
  if (t >= 0.18 && t < 0.5) {
    out.hand = shown(handOn(magAbs, cup));
  } else if (t >= 0.5 && t < 0.58) {
    // palm slap: drop a few cm and smack the base plate
    const sl = bump(0.5, 0.58, t);
    out.hand = shown(handOn(magAbs, [0, -0.14 - 0.05 * sl, 0], pose(0, 0, 0, -0.2 * sl, 0, 0)));
  } else if (t >= 0.58 && t < 0.65) {
    // travel up and over to the charging handle
    const from = handOn(pose(d.mag.x, d.mag.y, d.mag.z, d.mag.rx), cup);
    out.hand = shown(lerpPose(from, CHARGING_HANDLE, easeInOutCubic(seg(0.58, 0.65, t))));
  } else if (t >= 0.65 && t < 0.74) {
    // rip it back
    const pull = ss(0.65, 0.7, t) * (1 - ss(0.72, 0.74, t));
    out.chargeHandle = pull;
    out.hand = shown(addPose(CHARGING_HANDLE, pose(-0.01 * pull, 0.01 * pull, 0.09 * pull, 0, 0, 0)));
  } else if (t >= 0.74 && t < 0.88) {
    // flick the hand away down-left
    out.hand = shown(lerpPose(addPose(CHARGING_HANDLE, pose(-0.01, 0.01, 0.09)), HAND_OFF, ss(0.74, 0.88, t)));
  }
  return out;
}

// ───────────────────────────── HEAVY ─────────────────────────────
const HEAVY_CELL_START = pose(-0.26, -0.55, 0.18, -0.6, 0.3, 1.0);

function heavyReload(t: number, d: ReloadDocks): WeaponReloadPose {
  const out = emptyPose();
  const env = ss(0.02, 0.15, t) * (1 - ss(0.82, 0.97, t));
  const vent = bump(0.06, 0.16, t);
  const seat = bump(0.55, 0.64, t);
  const slap = bump(0.61, 0.68, t);
  const hum = t > 0.7 && t < 0.86 ? Math.sin(t * 190) * 0.005 * (1 - ss(0.7, 0.86, t)) : 0;
  const lock = bump(0.83, 0.9, t);
  out.gun = pose(
    -0.11 * env + hum,
    0.08 * env + 0.03 * seat + 0.03 * slap + 0.012 * vent,
    0.05 * env - 0.02 * lock,
    0.38 * env - 0.06 * seat - 0.05 * slap + 0.04 * vent - 0.05 * lock,
    0.22 * env,
    -0.7 * env + hum * 2 + 0.04 * vent,
  );

  let part = pose();
  let visible = false;
  if (t >= 0.08 && t < 0.17) {
    // spent cell unlocks and rises out of the receiver
    visible = true;
    const u = ss(0.09, 0.17, t);
    part = pose(-0.01 * u, -0.16 * u, 0, 0, 0, 0.2 * u);
  } else if (t >= 0.24 && t < 0.48) {
    visible = true;
    part = lerpPose(HEAVY_CELL_START, pose(0, -0.17, 0, 0.05, 0, -0.08), easeOutBack(seg(0.24, 0.48, t)));
  } else if (t >= 0.48 && t < 0.64) {
    visible = true;
    const u = ss(0.48, 0.56, t);
    part = pose(0, lerp(-0.17, 0, u * u), 0, lerp(0.05, 0, u), 0, lerp(-0.08, 0, u));
  }
  out.part = { ...part, visible };

  const cellAbs = pose(d.cell.x + part.x, d.cell.y + part.y, d.cell.z + part.z, part.rx, part.ry, part.rz);
  if (t >= 0.24 && t < 0.58) {
    out.hand = shown(handOn(cellAbs, [0, -0.09, 0]));
  } else if (t >= 0.58 && t < 0.7) {
    // heel-of-the-palm slam under the receiver
    const sl = bump(0.6, 0.68, t);
    out.hand = shown(handOn(pose(d.cell.x, d.cell.y, d.cell.z), [0, -0.1 - 0.06 * (1 - sl), 0], pose(0, 0, 0, -0.25 * sl, 0, 0)));
  } else if (t >= 0.7 && t < 0.84) {
    out.hand = shown(lerpPose(handOn(pose(d.cell.x, d.cell.y, d.cell.z), [0, -0.12, 0]), HAND_OFF, ss(0.7, 0.84, t)));
  }
  return out;
}

// ───────────────────────────── SHOTGUN ─────────────────────────────
const SHELL_TIMES = [0.2, 0.32, 0.44, 0.56];
const SHELL_START = pose(0.16, -0.34, 0.14, 0.4, 0.3, 0.9);
/** the pump forend (holder space) — must match battleWeaponModel.ts */
const PUMP_POS = pose(0, -0.03, -0.42);

function shotgunReload(t: number, d: ReloadDocks): WeaponReloadPose {
  const out = emptyPose();
  const roll = ss(0.02, 0.13, t) * (1 - ss(0.6, 0.7, t));
  let thumb = 0;
  SHELL_TIMES.forEach((c) => (thumb += bump(c - 0.02, c + 0.06, t)));
  // rack: pump back 0.74..0.79, forward 0.8..0.85
  const back = ss(0.74, 0.79, t) * (1 - ss(0.8, 0.85, t));
  out.pump = back;
  const present = bump(0.84, 0.98, t); // muzzle flips up as the round chambers
  out.gun = pose(
    0.05 * roll,
    0.1 * roll - 0.012 * thumb + 0.03 * present,
    -0.03 * roll + 0.04 * back,
    0.26 * roll + 0.03 * thumb - 0.04 * back + 0.14 * present,
    -0.2 * roll,
    0.66 * roll - 0.08 * present,
  );

  let visible = false;
  let part = pose();
  for (const c of SHELL_TIMES) {
    if (t >= c - 0.1 && t < c + 0.015) {
      visible = true;
      part = lerpPose(SHELL_START, pose(), easeInOutCubic(seg(c - 0.1, c, t)));
      break;
    }
  }
  out.part = { ...part, visible };

  if (t >= 0.08 && t < 0.62) {
    if (visible) {
      // thumb pushes the shell into the port: hand rides just behind / below the shell
      const shellAbs = pose(d.shell.x + part.x, d.shell.y + part.y, d.shell.z + part.z, part.rx, part.ry, part.rz);
      out.hand = shown(handOn(shellAbs, [0.01, -0.07, 0.05], pose(0.3, 0, 0, 0, 0, 0)));
    } else {
      // between shells the hand drops back to the shell carrier
      out.hand = shown(addPose(pose(d.shell.x, d.shell.y, d.shell.z), pose(0.14, -0.26, 0.12, 0.6, 0.3, 0.9)));
    }
  } else if (t >= 0.62 && t < 0.74) {
    const from = addPose(pose(d.shell.x, d.shell.y, d.shell.z), pose(0.14, -0.26, 0.12, 0.6, 0.3, 0.9));
    out.hand = shown(lerpPose(from, addPose(PUMP_POS, pose(0, -0.06, 0, 0, 0, 0)), easeInOutCubic(seg(0.62, 0.74, t))));
  } else if (t >= 0.74 && t < 0.88) {
    out.hand = shown(addPose(PUMP_POS, pose(0, -0.06, 0.09 * back)));
  } else if (t >= 0.88 && t < 0.98) {
    out.hand = shown(lerpPose(addPose(PUMP_POS, pose(0, -0.06, 0)), HAND_OFF, ss(0.88, 0.98, t)));
  }
  return out;
}

// ───────────────────────────── REVOLVER ─────────────────────────────
/** revolver cylinder rear when swung out (holder space) — the speed-loader lines up here */
const DRUM_OUT = pose(-0.085, 0.02, -0.005);
const LOADER_START = pose(-0.2, -0.46, 0.24, -0.5, 0.3, 0.8);

function revolverReload(t: number): WeaponReloadPose {
  const out = emptyPose();
  const env = ss(0.02, 0.12, t) * (1 - ss(0.66, 0.74, t));
  const dump = ss(0.14, 0.22, t) * (1 - ss(0.26, 0.36, t)); // muzzle jerked up to dump the brass
  const load = ss(0.3, 0.4, t) * (1 - ss(0.6, 0.68, t)); // muzzle down to load
  const flick = bump(0.64, 0.72, t);
  out.gun = pose(
    -0.12 * env + 0.03 * flick,
    0.12 * env + 0.05 * dump - 0.04 * load,
    -0.03 * env,
    0.28 * env + 0.75 * dump - 0.42 * load + 0.1 * flick,
    0.22 * env,
    -0.62 * env + 0.35 * flick,
  );
  const swing = ss(0.06, 0.13, t) * (1 - ss(0.64, 0.68, t));
  out.drum = { x: -0.085 * swing, rz: Math.PI * 2 * (0.5 * ss(0.13, 0.3, t) + 1.5 * ss(0.62, 0.78, t)) };

  // speed-loader + hand
  if (t >= 0.3 && t < 0.6) {
    let lp: PartPose;
    if (t < 0.49) lp = lerpPose(LOADER_START, addPose(DRUM_OUT, pose(0, 0, 0.05)), easeOutBack(seg(0.3, 0.49, t)));
    else lp = addPose(DRUM_OUT, pose(0, 0, lerp(0.05, 0.0, ss(0.49, 0.52, t)), 0, 0, 0.6 * ss(0.53, 0.57, t)));
    out.loader = shown(lp);
    out.hand = shown(handOn(lp, [0, -0.02, 0.07], pose(-1.2, 0, 0, 0, 0, 0)));
  } else if (t >= 0.6 && t < 0.72) {
    const lp = lerpPose(addPose(DRUM_OUT, pose(0, 0, 0, 0, 0, 0.6)), LOADER_START, ss(0.6, 0.72, t));
    out.loader = shown(lp);
    out.loader.visible = t < 0.66;
    out.hand = shown(handOn(lp, [0, -0.02, 0.07], pose(-1.2, 0, 0, 0, 0, 0)));
  }
  // flourish: one full spin about the trigger guard, decelerating into the grip
  const sp = seg(0.7, 0.9, t);
  out.spin = sp > 0 ? Math.PI * 2 * (1 - Math.pow(1 - sp, 2.4)) : 0;
  return out;
}

// ───────────────────────────── TWIN VIPER ─────────────────────────────
function akimboReload(t: number): WeaponReloadPose {
  const out = emptyPose();
  const tilt = ss(0.02, 0.12, t) * (1 - ss(0.2, 0.26, t));
  const dip = ss(0.2, 0.32, t) * (1 - ss(0.44, 0.56, t)); // down to the hip pouches, off screen
  const cross = ss(0.5, 0.62, t) * (1 - ss(0.68, 0.8, t)); // crossed in an X
  const snap = bump(0.67, 0.76, t);
  out.gun = pose(0, -0.02 * tilt + 0.02 * cross, 0.02 * tilt - 0.03 * cross, 0.04 * tilt + 0.05 * cross);
  const hand = (side: 1 | -1): PartPose =>
    pose(
      -side * 0.05 * tilt - side * 0.16 * cross + side * 0.03 * snap,
      0.08 * tilt - 0.42 * dip + 0.04 * cross,
      0.03 * tilt + 0.12 * dip - 0.04 * cross,
      0.5 * tilt - 0.9 * dip + 0.2 * cross - 0.12 * snap,
      side * 0.22 * tilt + side * 0.3 * cross,
      side * 0.85 * tilt + side * 0.7 * cross - side * 0.25 * snap,
    );
  out.handR = hand(1);
  out.handL = hand(-1);
  // both slides lock open once the mags drop, then slam home together
  const open = ss(0.15, 0.2, t) * (1 - ss(0.67, 0.69, t));
  out.slideR = open;
  out.slideL = open;
  out.magR = t < 0.15 || t > 0.4;
  out.magL = t < 0.15 || t > 0.45;
  return out;
}

export function getWeaponReloadPose(style: Exclude<ReloadStyle, 'pistol'>, t: number, docks: ReloadDocks = DEFAULT_DOCKS): WeaponReloadPose {
  switch (style) {
    case 'rifle':
      return rifleReload(t, docks);
    case 'heavy':
      return heavyReload(t, docks);
    case 'shotgun':
      return shotgunReload(t, docks);
    case 'revolver':
      return revolverReload(t);
    case 'akimbo':
      return akimboReload(t);
  }
}

/**
 * Shared "feel" layer added on top of every reload's keyframes (pistol included):
 *   - anticipation: the gun dips slightly the other way just before it tilts away
 *   - impacts: each mechanical event (mag seat, shell in, slide snap) kicks the gun and rings out
 *     as a damped spring instead of stopping dead
 *   - settle: a small overshoot as the gun returns to the ready pose
 *   - hand tremor while the gun is held tilted
 * Returned offsets are additive on top of the style's own gun pose.
 */
const IMPACTS: Record<ReloadStyle, number[]> = {
  pistol: [0.1, 0.15, 0.58, 0.62, 0.77],
  revolver: [0.1, 0.22, 0.52, 0.66, 0.9],
  akimbo: [0.15, 0.42, 0.47, 0.68],
  rifle: [0.1, 0.16, 0.46, 0.52, 0.72],
  shotgun: [0.2, 0.32, 0.44, 0.56, 0.79, 0.85],
  heavy: [0.17, 0.56, 0.62, 0.84],
};

export function getReloadPolish(style: ReloadStyle, t: number, time: number): PartPose {
  if (t <= 0 || t >= 1) return pose();
  // anticipation: brief counter-motion (down/forward) before the tilt-away starts
  const ant = bump(0, 0.07, t);
  let y = -0.014 * ant;
  let z = 0.016 * ant;
  let rx = -0.06 * ant;
  let rz = 0.03 * ant;
  // impacts: decaying sine kick after each event
  for (const c of IMPACTS[style]) {
    const dt = t - c;
    if (dt < 0 || dt > 0.14) continue;
    const decay = Math.exp(-dt * 30);
    const ring = Math.sin(dt * 120);
    y += -0.013 * ring * decay;
    z += 0.009 * ring * decay;
    rx += 0.05 * ring * decay;
    rz += 0.022 * ring * decay;
  }
  // settle overshoot when returning to rest
  const settle = t > 0.9 ? Math.exp(-(t - 0.9) * 40) * Math.sin((t - 0.9) * 150) : 0;
  y += 0.012 * settle;
  rx -= 0.045 * settle;
  // light tremor while held in the working pose
  const hold = ss(0.1, 0.25, t) * (1 - ss(0.8, 0.92, t));
  const x = Math.sin(time * 31) * 0.0018 * hold;
  y += Math.cos(time * 27) * 0.0014 * hold;
  rz += Math.sin(time * 23) * 0.006 * hold;
  return pose(x, y, z, rx, 0, rz);
}
