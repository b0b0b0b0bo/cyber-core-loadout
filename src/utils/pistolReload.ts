/**
 * Handgun magazine-swap reload, as keyframes over the normalized reload progress t (0..1).
 * The battle scene applies:
 *   gun   → offset added to the viewmodel rig's hip pose
 *   mag   → `pistolMag` offset inside `pistolMagWell` (grip frame: +Y up the grip)
 *   hand  → `reloadHand` offset inside `pistolMagWell`
 *   slideBack → 0..1 of the slide's travel (held open on an empty reload)
 *
 * Timeline:
 *   0.00–0.12  cant the gun hard inward and tip the muzzle up
 *   0.10       thumb the mag release → a wrist flick throws the old mag out at MAG_DROP_T
 *   0.18–0.46  off hand brings a fresh mag up to the well (overshoots slightly, then lines up)
 *   0.46–0.58  drive it in → MAG_SEAT_T, then a palm slap on the base plate (0.62)
 *   empty:     hand sweeps over the top, racks the slide back and lets it slam (SLIDE_RELEASE_T)
 *   loaded:    hand peels away and the gun gets a little presentation flick
 *   0.84–1.00  back to the ready pose
 */

export const MAG_RELEASE_T = 0.1;
export const MAG_DROP_T = 0.15;
export const MAG_SEAT_T = 0.58;
export const SLIDE_RELEASE_T = 0.77;

const NEW_MAG_SHOW_T = 0.18;
/** Hand origin relative to the magazine origin while it holds the base plate. */
const HAND_ON_MAG_Y = -0.13;

export interface PartPose {
  x: number;
  y: number;
  z: number;
  rx: number;
  ry: number;
  rz: number;
}

export interface PistolReloadPose {
  gun: PartPose;
  mag: PartPose & { visible: boolean };
  hand: PartPose & { visible: boolean };
  slideBack: number;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const ss = (a: number, b: number, t: number) => {
  const u = clamp01((t - a) / (b - a));
  return u * u * (3 - 2 * u);
};
const easeOutBack = (u: number) => {
  const c1 = 1.4;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2);
};
/** 0 → 1 → 0 pulse over [a, b]. */
const bump = (a: number, b: number, t: number) => (t > a && t < b ? Math.sin((Math.PI * (t - a)) / (b - a)) : 0);
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
const pose = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0): PartPose => ({ x, y, z, rx, ry, rz });
const lerpPose = (a: PartPose, b: PartPose, u: number): PartPose =>
  pose(lerp(a.x, b.x, u), lerp(a.y, b.y, u), lerp(a.z, b.z, u), lerp(a.rx, b.rx, u), lerp(a.ry, b.ry, u), lerp(a.rz, b.rz, u));

/** Where the fresh mag (and hand) start, well below-left of the grip, off screen. */
const MAG_START = pose(-0.26, -0.52, 0.24, -0.45, 0.25, 0.8);
/** Lined up just under the mag well, ready to push in. */
const MAG_LINED_UP = pose(0, -0.17, 0, 0, 0, 0);
/** Hand on the base plate (relative to the seated mag). */
const HAND_ON_PLATE = pose(0, HAND_ON_MAG_Y, 0);
/** Overhand grip on the rear of the slide (well frame): fingers over the top, arm from the left. */
const HAND_OVER_SLIDE = pose(-0.045, 0.2, -0.07, 0.15, 0.1, -1.3);
/** Where the hand ends up after letting go. */
const HAND_AWAY = pose(-0.3, -0.5 + HAND_ON_MAG_Y, 0.22, -0.25, 0.25, 0.95);

export function getPistolReloadPose(t: number, fromEmpty: boolean): PistolReloadPose {
  // ── gun: hard inward cant, wrist flick on the drop, kicks on seat / slap / slide ──
  const env = ss(0.02, 0.12, t) * (1 - ss(0.82, 0.98, t));
  const flick = bump(MAG_DROP_T - 0.04, MAG_DROP_T + 0.05, t);
  const seat = bump(MAG_SEAT_T - 0.02, MAG_SEAT_T + 0.06, t);
  const slap = bump(0.61, 0.67, t);
  const rack = fromEmpty ? bump(0.7, 0.77, t) : 0;
  const slideKick = fromEmpty ? bump(SLIDE_RELEASE_T, SLIDE_RELEASE_T + 0.07, t) : 0;
  const present = fromEmpty ? 0 : bump(0.72, 0.86, t);
  const gun = pose(
    -0.17 * env + 0.02 * present,
    0.27 * env + 0.03 * seat + 0.025 * slap - 0.03 * flick + 0.03 * present,
    -0.06 * env + 0.025 * slideKick - 0.02 * rack,
    0.38 * env - 0.1 * seat - 0.07 * slap + 0.08 * slideKick - 0.12 * flick + 0.12 * present,
    0.32 * env + 0.05 * rack,
    -0.95 * env + 0.12 * flick - 0.1 * rack + 0.3 * present,
  );

  // ── magazine ──
  let mag = pose();
  let magVisible = true;
  if (t < MAG_DROP_T) {
    // old mag: released and sliding out of the grip under its own weight
    mag.y = -0.13 * ss(MAG_RELEASE_T, MAG_DROP_T, t);
  } else if (t < NEW_MAG_SHOW_T) {
    magVisible = false; // old mag is falling as a detached object; fresh one not yet in view
  } else if (t < 0.46) {
    const u = easeOutBack(clamp01((t - NEW_MAG_SHOW_T) / (0.46 - NEW_MAG_SHOW_T)));
    mag = lerpPose(MAG_START, MAG_LINED_UP, u);
  } else if (t < MAG_SEAT_T - 0.02) {
    // push it into the well, accelerating
    const u = (t - 0.46) / (MAG_SEAT_T - 0.02 - 0.46);
    mag.y = lerp(MAG_LINED_UP.y, -0.025, u * u);
  } else if (t < MAG_SEAT_T + 0.03) {
    mag.y = lerp(-0.025, 0, ss(MAG_SEAT_T - 0.02, MAG_SEAT_T + 0.03, t));
  }

  // ── hand: rides the mag base plate, slaps it, then racks the slide (empty) or peels away ──
  let hand = pose(mag.x, mag.y + HAND_ON_MAG_Y, mag.z, mag.rx, mag.ry, mag.rz);
  let handVisible = t >= NEW_MAG_SHOW_T && t < 0.9;
  if (t >= MAG_SEAT_T + 0.01 && t < 0.67) {
    const sl = bump(0.6, 0.67, t);
    hand = pose(0, HAND_ON_MAG_Y - 0.05 * sl, 0, -0.25 * sl, 0, 0);
  } else if (t >= 0.67) {
    if (fromEmpty) {
      if (t < 0.71) {
        hand = lerpPose(HAND_ON_PLATE, HAND_OVER_SLIDE, ss(0.67, 0.71, t));
      } else if (t < SLIDE_RELEASE_T) {
        // grip and pull the slide back
        const pull = ss(0.71, 0.75, t);
        hand = pose(HAND_OVER_SLIDE.x, HAND_OVER_SLIDE.y + 0.005 * pull, HAND_OVER_SLIDE.z + 0.06 * pull, HAND_OVER_SLIDE.rx, HAND_OVER_SLIDE.ry, HAND_OVER_SLIDE.rz);
      } else {
        // let go: the hand snaps off up-left, then drops out of view
        const u = ss(SLIDE_RELEASE_T, 0.9, t);
        hand = lerpPose(pose(HAND_OVER_SLIDE.x - 0.02, HAND_OVER_SLIDE.y + 0.03, HAND_OVER_SLIDE.z + 0.08, HAND_OVER_SLIDE.rx, HAND_OVER_SLIDE.ry, HAND_OVER_SLIDE.rz), HAND_AWAY, u * u);
      }
    } else {
      const u = ss(0.67, 0.84, t);
      hand = lerpPose(HAND_ON_PLATE, HAND_AWAY, u * u);
      handVisible = t < 0.84;
    }
  }

  // ── slide: locked open on an empty mag; on the rack it is pulled fully back, then slams home ──
  let slideBack = 0;
  if (fromEmpty) {
    if (t < 0.71) slideBack = 1;
    else if (t < SLIDE_RELEASE_T) slideBack = 1 + 0.25 * ss(0.71, 0.75, t);
    else slideBack = 1.25 * (1 - ss(SLIDE_RELEASE_T, SLIDE_RELEASE_T + 0.03, t));
  }

  return {
    gun,
    mag: { ...mag, visible: magVisible },
    hand: { ...hand, visible: handVisible },
    slideBack,
  };
}
