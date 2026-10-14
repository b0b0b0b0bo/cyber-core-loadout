import * as THREE from 'three';
import { Weapon } from '../types';
import { applyWeaponVariant } from './weaponVariants';
import { foldedTurretMesh } from './arsenal';

/**
 * First-person (battle) weapon model. Single source of truth: the battle scene
 * builds its viewmodel with this, and the loadout screen (3D viewer + thumbnails)
 * renders exactly the same meshes.
 *
 * Coordinates are camera-space: the weapon points down -Z (blades stand along +Y).
 *
 * The battle scene animates some parts BY NAME and by absolute local position, so these
 * must keep their name and origin:
 *   gunSlide (0,0.04,-0.12)  pumpForend (0,-0.03,-0.42)  lanceNeedle (0,0.02,-0.75)
 *   leftGauntlet / rightGauntlet / twinBladeL / twinBladeR (arm origins)  akimboRight / akimboLeft (x = ±AKIMBO_HAND_X)
 *   akimboSlideR / akimboSlideL (same origin as gunSlide, inside each akimbo hand)  harpoonPart (direct children of the holder)
 *   pistolMagWell > pistolMag (seated at origin) / reloadHand (handgun reload)
 *   gunMag (rifle / SMG) / heavyCell (launchers, railguns) / reloadShell (shotguns) / revolverDrum (revolvers) — reload parts, docked at their origin
 *   bladeEdge / axeBladeEdge / gunMag (cosmetic, kept for compatibility)
 */
/** Horizontal offset of each TWIN VIPER pistol from the holder centre. */
export const AKIMBO_HAND_X = 0.19;

/** RAVAGER-09 guide bar: straight edges from y0 to y1 (nose sprocket centre), chain runs at ±halfWidth along Z. */
const CHAINSAW_BAR = { y0: 0.03, y1: 0.86, halfWidth: 0.058 };
const CHAINSAW_TEETH = 40;

/**
 * Point on the chain loop at u (0..1): up the cutting edge (-Z), round the nose, down the back (+Z),
 * round the hidden drive sprocket. Returns the local position and the rotation about X that aligns +Y with the travel direction.
 */
function chainsawChainPoint(u: number): { y: number; z: number; rx: number } {
  const { y0, y1, halfWidth: R } = CHAINSAW_BAR;
  const straight = y1 - y0;
  const arc = Math.PI * R;
  const total = 2 * straight + 2 * arc;
  let d = (((u % 1) + 1) % 1) * total;
  if (d < straight) return { y: y0 + d, z: -R, rx: 0 };
  d -= straight;
  if (d < arc) {
    const psi = -Math.PI / 2 + d / R;
    return { y: y1 + R * Math.cos(psi), z: R * Math.sin(psi), rx: Math.atan2(Math.cos(psi), -Math.sin(psi)) };
  }
  d -= arc;
  if (d < straight) return { y: y1 - d, z: R, rx: Math.PI };
  d -= straight;
  const psi = Math.PI / 2 + d / R;
  return { y: y0 + R * Math.cos(psi), z: R * Math.sin(psi), rx: Math.atan2(Math.cos(psi), -Math.sin(psi)) };
}

/** Moves the RAVAGER-09 chain teeth along the bar. `offset` is in loops (1 = one full lap). */
export function updateChainsawChain(chain: THREE.Object3D, offset: number): void {
  chain.children.forEach((tooth) => {
    const p = chainsawChainPoint((tooth.userData.u0 as number) + offset);
    tooth.position.set(0, p.y, p.z);
    tooth.rotation.set(p.rx, 0, 0);
  });
}

export function populateBattleWeaponModel(holder: THREE.Object3D, weapon: Weapon): void {
  // ───────────────────────── materials ─────────────────────────
  const accent = new THREE.Color(weapon.color);
  // VITALIS: ピンク基調のボディ (スライド=濃いピンク / フレーム=淡いピンク)
  const isVitalis = weapon.id === 'sub_vitalis';
  const gunMat = new THREE.MeshStandardMaterial({ color: isVitalis ? 0xd6609b : 0x1e2837, metalness: isVitalis ? 0.4 : 0.62, roughness: isVitalis ? 0.32 : 0.38 });
  const frameMat = new THREE.MeshStandardMaterial({ color: isVitalis ? 0xf9c4de : 0x36455a, metalness: isVitalis ? 0.35 : 0.55, roughness: isVitalis ? 0.3 : 0.42 });
  const steelMat = new THREE.MeshStandardMaterial({ color: 0x9aa8bb, metalness: 0.72, roughness: 0.26 });
  const rubberMat = new THREE.MeshStandardMaterial({ color: 0x0c121b, metalness: 0.05, roughness: 0.88 });
  const trimMat = new THREE.MeshStandardMaterial({
    color: accent.clone().multiplyScalar(0.45),
    metalness: 0.5,
    roughness: 0.35,
  });
  const energyMat = new THREE.MeshBasicMaterial({ color: accent });
  const coreMat = new THREE.MeshBasicMaterial({ color: accent.clone().lerp(new THREE.Color(0xffffff), 0.75) });
  const glowMat = new THREE.MeshBasicMaterial({
    color: accent,
    transparent: true,
    opacity: 0.26,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const lensMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.85 });
  const lensFrameMat = new THREE.MeshStandardMaterial({ color: 0x0b1220, metalness: 0.7, roughness: 0.3 });

  // ───────────────────────── geometry helpers ─────────────────────────
  /** Box with bevelled (rounded) edges. */
  const rb = (w: number, h: number, d: number, r = 0.006): THREE.BufferGeometry => {
    const rr = Math.max(0, Math.min(r, w * 0.45, h * 0.45, d * 0.45));
    if (rr < 0.0008) return new THREE.BoxGeometry(w, h, d);
    const iw = w - 2 * rr;
    const ih = h - 2 * rr;
    const id = Math.max(d - 2 * rr, 0.0001);
    const sh = new THREE.Shape();
    sh.moveTo(-iw / 2, -ih / 2);
    sh.lineTo(iw / 2, -ih / 2);
    sh.lineTo(iw / 2, ih / 2);
    sh.lineTo(-iw / 2, ih / 2);
    sh.closePath();
    const g = new THREE.ExtrudeGeometry(sh, {
      depth: id,
      bevelEnabled: true,
      bevelThickness: rr,
      bevelSize: rr,
      bevelSegments: 2,
      curveSegments: 1,
    });
    g.translate(0, 0, -id / 2);
    return g;
  };

  /** Cylinder lying along Z. `rFront` is the radius at the -Z (muzzle) end. */
  const cylZ = (rFront: number, rRear: number, len: number, seg = 14): THREE.BufferGeometry => {
    const g = new THREE.CylinderGeometry(rRear, rFront, len, seg);
    g.rotateX(Math.PI / 2);
    return g;
  };

  /** Cone lying along Z with its tip toward -Z. */
  const coneZ = (r: number, len: number, seg = 12): THREE.BufferGeometry => {
    const g = new THREE.ConeGeometry(r, len, seg);
    g.rotateX(-Math.PI / 2);
    return g;
  };

  /** Torus ring lying in the XY plane (axis = Z). */
  const ringZ = (R: number, r: number, seg = 20): THREE.BufferGeometry => new THREE.TorusGeometry(R, r, 8, seg);

  const put = <T extends THREE.Object3D>(parent: THREE.Object3D, obj: T, x = 0, y = 0, z = 0, name?: string): T => {
    obj.position.set(x, y, z);
    if (name) obj.name = name;
    parent.add(obj);
    return obj;
  };
  const M = (g: THREE.BufferGeometry, m: THREE.Material) => new THREE.Mesh(g, m);

  /** Glowing element = bright mesh + faint additive halo. */
  const glowBox = (parent: THREE.Object3D, w: number, h: number, d: number, x: number, y: number, z: number) => {
    put(parent, M(new THREE.BoxGeometry(w, h, d), energyMat), x, y, z);
    put(parent, M(new THREE.BoxGeometry(w * 1.9 + 0.006, h * 1.9 + 0.006, d * 1.04), glowMat), x, y, z);
  };
  const glowSphere = (parent: THREE.Object3D, r: number, x: number, y: number, z: number) => {
    put(parent, M(new THREE.SphereGeometry(r, 16, 12), energyMat), x, y, z);
    put(parent, M(new THREE.SphereGeometry(r * 0.55, 10, 8), coreMat), x, y, z);
    put(parent, M(new THREE.SphereGeometry(r * 1.7, 14, 10), glowMat), x, y, z);
  };

  /** A glowing thread following a curve (used for blade edges). */
  const edgeTube = (pts: THREE.Vector3[], radius: number): THREE.Group => {
    const g = new THREE.Group();
    const curve = new THREE.CatmullRomCurve3(pts);
    g.add(M(new THREE.TubeGeometry(curve, 24, radius, 5, false), energyMat));
    g.add(M(new THREE.TubeGeometry(curve, 24, radius * 2.6, 5, false), glowMat));
    return g;
  };

  /**
   * Flat tapered blade. Length along +Y, width across Z (edge toward -Z), thickness along X.
   * `tip` = length of the point section, `sweep` = how far the tip sits toward the spine (0..1).
   */
  const bladeGeo = (len: number, width: number, thick: number, tip: number, sweep = 0.25, belly = 0): THREE.BufferGeometry => {
    const w2 = width / 2;
    const sh = new THREE.Shape();
    sh.moveTo(-w2, 0);
    sh.lineTo(-w2, len - tip * 0.5);
    sh.lineTo(-w2 + width * sweep, len);
    sh.quadraticCurveTo(w2 + belly, len - tip * 0.9, w2, len - tip * 1.7);
    sh.lineTo(w2, 0);
    sh.closePath();
    const g = new THREE.ExtrudeGeometry(sh, {
      depth: Math.max(thick - 0.004, 0.001),
      bevelEnabled: true,
      bevelThickness: 0.002,
      bevelSize: 0.0025,
      bevelSegments: 1,
      curveSegments: 6,
    });
    g.translate(0, 0, -(thick - 0.004) / 2);
    g.rotateY(Math.PI / 2); // X(width) -> -Z, Z(thickness) -> X
    return g;
  };

  /** Rows of small slots / ribs along Z on a surface (visual detail). */
  const ribsZ = (
    parent: THREE.Object3D,
    n: number,
    spacing: number,
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z0: number,
    mat: THREE.Material = rubberMat
  ) => {
    for (let i = 0; i < n; i++) put(parent, M(new THREE.BoxGeometry(w, h, d), mat), x, y, z0 - i * spacing);
  };

  /** Picatinny-style top rail: base bar + cross ribs. */
  const topRail = (parent: THREE.Object3D, len: number, x: number, y: number, zCenter: number, width = 0.036) => {
    put(parent, M(rb(width, 0.012, len, 0.003), frameMat), x, y, zCenter);
    const n = Math.max(2, Math.floor(len / 0.022));
    for (let i = 0; i < n; i++) {
      put(parent, M(new THREE.BoxGeometry(width + 0.006, 0.008, 0.009), gunMat), x, y + 0.009, zCenter - len / 2 + 0.011 + i * (len - 0.022) / (n - 1));
    }
  };

  /** Point at distance t along a shaft centred at (cy,cz) that is tilted by `tilt` about X. */
  const along = (cy: number, cz: number, tilt: number, t: number): [number, number] => [cy + t * Math.cos(tilt), cz + t * Math.sin(tilt)];

  /** Simple blocky trigger guard (bars) under a receiver. */
  const triggerGuard = (parent: THREE.Object3D, y: number, zFront: number, zRear: number) => {
    const len = zRear - zFront;
    put(parent, M(rb(0.008, 0.006, len, 0.002), steelMat), 0, y, (zFront + zRear) / 2);
    put(parent, M(rb(0.008, 0.032, 0.006, 0.002), steelMat), 0, y + 0.016, zFront);
    put(parent, M(rb(0.008, 0.032, 0.006, 0.002), steelMat), 0, y + 0.016, zRear);
    put(parent, M(rb(0.008, 0.028, 0.012, 0.003), steelMat), 0, y + 0.016, (zFront + zRear) / 2 + len * 0.1).rotation.x = 0.3;
  };

  const bolt = (parent: THREE.Object3D, x: number, y: number, z: number, r = 0.005, axis: 'x' | 'y' | 'z' = 'x') => {
    const m = M(new THREE.CylinderGeometry(r, r, r * 0.8, 6), steelMat);
    if (axis === 'x') m.rotation.z = Math.PI / 2;
    if (axis === 'z') m.rotation.x = Math.PI / 2;
    put(parent, m, x, y, z);
  };

  /** Holographic reflex sight (kept at the original ADS position). */
  const reflexSight = (parent: THREE.Object3D, x: number, y: number, z: number) => {
    put(parent, M(rb(0.065, 0.034, 0.14, 0.006), gunMat), x, y, z + 0.04);
    put(parent, M(rb(0.012, 0.06, 0.02, 0.003), lensFrameMat), x - 0.034, y + 0.03, z, undefined);
    put(parent, M(rb(0.012, 0.06, 0.02, 0.003), lensFrameMat), x + 0.034, y + 0.03, z, undefined);
    put(parent, M(rb(0.08, 0.012, 0.024, 0.003), lensFrameMat), x, y + 0.062, z);
    put(parent, M(new THREE.BoxGeometry(0.056, 0.05, 0.004), lensMat), x, y + 0.03, z);
    glowBox(parent, 0.006, 0.006, 0.004, x, y + 0.03, z + 0.004);
  };

  /**
   * Off hand used by the reloads (glove + armoured sleeve). Origin = palm centre; the palm faces up,
   * the fingers wrap up the +X side and curl over, the forearm runs back toward the lower-left of the screen.
   */
  const buildHand = (): THREE.Group => {
    const hand = new THREE.Group();
    put(hand, M(rb(0.072, 0.032, 0.1, 0.012), rubberMat), -0.008, -0.012, 0.0); // palm
    put(hand, M(rb(0.05, 0.008, 0.07, 0.003), frameMat), -0.01, -0.03, 0.0); // back-of-hand plate
    for (let i = 0; i < 4; i++) {
      const z = -0.036 + i * 0.024;
      const len = i === 0 || i === 3 ? 0.06 : 0.07;
      put(hand, M(rb(0.017, len, 0.019, 0.007), rubberMat), 0.032, len / 2 - 0.005, z);
      put(hand, M(rb(0.016, 0.022, 0.018, 0.007), rubberMat), 0.026, len + 0.002, z).rotation.z = 0.6;
      put(hand, M(new THREE.BoxGeometry(0.004, 0.012, 0.012), frameMat), 0.041, len * 0.45, z); // knuckle armour
    }
    const thumb = put(hand, M(rb(0.018, 0.06, 0.02, 0.008), rubberMat), -0.034, 0.02, -0.03);
    thumb.rotation.z = -0.25;
    const sleeve = new THREE.Group();
    put(hand, sleeve, -0.03, -0.03, 0.03);
    sleeve.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(-0.6, -0.55, 0.45).normalize());
    put(sleeve, M(cylZ(0.034, 0.03, 0.06, 14), rubberMat), 0, 0, 0.02); // wrist
    put(sleeve, M(cylZ(0.04, 0.048, 0.42, 16), frameMat), 0, 0, 0.26); // forearm
    put(sleeve, M(rb(0.06, 0.03, 0.28, 0.01), gunMat), 0, 0.04, 0.27); // armour plate
    glowBox(sleeve, 0.006, 0.006, 0.22, 0, 0.057, 0.27);
    put(sleeve, M(ringZ(0.045, 0.005, 18), energyMat), 0, 0, 0.07); // cuff ring
    return hand;
  };
  /** Reload off hand for rifles / shotguns / heavies / revolvers (animated in holder space, hidden at rest). */
  const addReloadHand = (parent: THREE.Object3D) => {
    const hand = buildHand();
    hand.visible = false;
    put(parent, hand, 0, -0.4, 0.1, 'gunReloadHand');
  };

  // ═════════════════════ 1. DUAL MECHA GAUNTLETS ═════════════════════
  if (weapon.modelType === 'gauntlets') {
    const makeGauntletArm = (isLeft: boolean) => {
      const s = isLeft ? -1 : 1;
      const arm = new THREE.Group();
      arm.name = isLeft ? 'leftGauntlet' : 'rightGauntlet';
      arm.position.set(s * 0.19, -0.22, -0.38);

      // Forearm chassis with layered armour
      put(arm, M(rb(0.12, 0.14, 0.32, 0.02), gunMat), 0, 0, 0.05);
      put(arm, M(rb(0.1, 0.03, 0.27, 0.012), frameMat), 0, 0.082, 0.05);
      put(arm, M(rb(0.022, 0.1, 0.26, 0.008), frameMat), s * 0.07, 0, 0.05);
      put(arm, M(rb(0.022, 0.1, 0.26, 0.008), frameMat), -s * 0.07, 0, 0.05);
      // heat-vent strips on the top plate
      for (let i = 0; i < 4; i++) put(arm, M(new THREE.BoxGeometry(0.06, 0.004, 0.012), energyMat), 0, 0.099, 0.14 - i * 0.045);
      // armour seams
      [-0.02, 0.1].forEach((zz) => put(arm, M(new THREE.BoxGeometry(0.125, 0.145, 0.006), rubberMat), 0, 0, zz));
      // rear cuff
      put(arm, M(cylZ(0.082, 0.082, 0.05, 16), steelMat), 0, 0, 0.21);
      put(arm, M(cylZ(0.074, 0.074, 0.056, 16), rubberMat), 0, 0, 0.21);

      // Pneumatic pistons with sleeves
      put(arm, M(cylZ(0.016, 0.016, 0.28, 10), steelMat), s * 0.065, 0.02, 0.04).rotation.x = 0;
      put(arm, M(cylZ(0.022, 0.022, 0.12, 10), gunMat), s * 0.065, 0.02, 0.1);
      put(arm, M(ringZ(0.022, 0.004, 14), energyMat), s * 0.065, 0.02, 0.04);

      // Wrist guard + knuckle assembly
      put(arm, M(rb(0.13, 0.15, 0.05, 0.015), frameMat), 0, 0.005, -0.03);
      const knuckle = new THREE.Group();
      knuckle.name = isLeft ? 'leftKnuckle' : 'rightKnuckle';
      put(knuckle, M(rb(0.14, 0.11, 0.14, 0.022), gunMat), 0, 0, 0);
      put(knuckle, M(rb(0.12, 0.03, 0.12, 0.01), frameMat), 0, 0.06, 0.0);
      for (let i = 0; i < 4; i++) {
        put(knuckle, M(rb(0.03, 0.05, 0.07, 0.008), steelMat), -0.045 + i * 0.03, 0.025, -0.07);
      }
      bolt(knuckle, -0.071, 0.0, 0.03, 0.006, 'x');
      bolt(knuckle, 0.071, 0.0, 0.03, 0.006, 'x');
      put(arm, knuckle, 0, 0.02, -0.14);

      // Glowing impact plate + halo
      put(arm, M(rb(0.136, 0.05, 0.026, 0.006), rubberMat), 0, 0.04, -0.21);
      glowBox(arm, 0.12, 0.03, 0.02, 0, 0.04, -0.226);
      // Wrist LED strip
      glowBox(arm, 0.06, 0.012, 0.05, 0, 0.1, 0.08);
      glowBox(arm, 0.02, 0.012, 0.02, s * 0.03, 0.1, 0.165);
      return arm;
    };
    holder.add(makeGauntletArm(true));
    holder.add(makeGauntletArm(false));

    // ═════════════════════ 1b. ASTRO-ZWILL (TWIN STAR BLADES) ═════════════════════
  } else if (weapon.modelType === 'twinblade') {
    const makeTwinBlade = (isLeft: boolean) => {
      const s = isLeft ? -1 : 1; // +1 = right hand. The spine (back edge) faces outward (+s), the cutting edge inward.
      const arm = new THREE.Group();
      arm.name = isLeft ? 'twinBladeL' : 'twinBladeR';
      arm.position.set(s * 0.2, -0.2, -0.18);
      arm.rotation.set(0.3, -s * 0.14, s * 0.06);

      // Grip along the aim axis (rear = +Z) with wrapped rings
      put(arm, M(cylZ(0.02, 0.022, 0.2, 14), rubberMat), 0, 0, 0.12);
      for (let i = 0; i < 5; i++) put(arm, M(cylZ(0.0235, 0.0235, 0.012, 14), i % 2 ? gunMat : frameMat), 0, 0, 0.05 + i * 0.038);
      // Star pommel
      put(arm, M(new THREE.OctahedronGeometry(0.03, 0), steelMat), 0, 0, 0.235);
      glowSphere(arm, 0.014, 0, 0, 0.255);

      // Swept crossguard with a floating "astro" halo ring
      put(arm, M(rb(0.13, 0.022, 0.034, 0.008), steelMat), 0, 0, 0.012);
      put(arm, M(rb(0.05, 0.05, 0.07, 0.01), gunMat), 0, 0, 0.0);
      const wing = put(arm, M(coneZ(0.014, 0.1, 5), steelMat), s * 0.07, 0, -0.03);
      wing.rotation.y = -s * 0.35;
      put(arm, M(coneZ(0.007, 0.06, 4), energyMat), s * 0.078, 0, -0.07).rotation.y = -s * 0.35;
      const halo = put(arm, M(ringZ(0.055, 0.004, 24), energyMat), 0, 0, -0.045);
      halo.rotation.x = Math.PI / 2 - 0.0;
      put(arm, M(ringZ(0.055, 0.012, 24), glowMat), 0, 0, -0.045).rotation.x = Math.PI / 2;
      glowSphere(arm, 0.016, 0, 0.034, 0.0); // core gem
      put(arm, M(rb(0.044, 0.022, 0.07, 0.006), frameMat), 0, 0, -0.065); // ricasso

      // Single-edged curved blade, flat face up: width across X, length along -Z.
      const L = 0.5;
      const bs = new THREE.Shape();
      bs.moveTo(-s * -0.02, 0); // spine root (outer)
      bs.lineTo(s * 0.03, 0);
      bs.lineTo(s * 0.036, 0.06);
      bs.quadraticCurveTo(s * 0.04, 0.3, s * 0.014, L - 0.04); // spine, slightly belly
      bs.lineTo(-s * 0.026, L); // swept tip curls inward
      bs.quadraticCurveTo(-s * 0.04, 0.3, -s * 0.034, 0.06);
      bs.lineTo(-s * 0.026, 0);
      bs.closePath();
      const bg = new THREE.ExtrudeGeometry(bs, { depth: 0.008, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.0025, bevelSegments: 1, curveSegments: 8 });
      bg.translate(0, 0, -0.004);
      bg.rotateX(-Math.PI / 2); // shape +Y -> -Z, extrusion -> Y
      put(arm, M(bg, steelMat), 0, 0, -0.1);
      // Glowing fuller + cutting edge line + spine studs
      glowBox(arm, 0.006, 0.004, 0.34, s * 0.004, 0.009, -0.27);
      put(arm, M(new THREE.BoxGeometry(0.0035, 0.004, 0.36), energyMat), -s * 0.03, 0.009, -0.29).rotation.y = -s * 0.03;
      for (let i = 0; i < 4; i++) put(arm, M(new THREE.OctahedronGeometry(0.008, 0), energyMat), s * 0.036, 0.009, -0.17 - i * 0.09);
      // Star-dust afterimage
      const ghost = put(arm, M(bg, glowMat), -s * 0.02, -0.012, -0.07);
      ghost.scale.set(0.85, 1, 0.92);
      return arm;
    };
    holder.add(makeTwinBlade(true));
    holder.add(makeTwinBlade(false));

    // ═════════════════════ 2. CHAIN SPEAR ═════════════════════
  } else if (weapon.id === 'blade_chainspear') {
    // Haft runs along the aim axis (-Z) so it lines up with the harpoon head
    put(holder, M(cylZ(0.022, 0.025, 0.95, 14), gunMat), 0, 0.03, 0.02);
    for (let i = 0; i < 5; i++) put(holder, M(cylZ(0.0285, 0.0285, 0.05, 14), rubberMat), 0, 0.03, 0.2 + i * 0.075);
    [0.17, 0.4].forEach((zz) => put(holder, M(cylZ(0.031, 0.031, 0.012, 14), steelMat), 0, 0.03, zz));
    put(holder, M(new THREE.SphereGeometry(0.034, 12, 10), steelMat), 0, 0.03, 0.51); // pommel

    // Chain spool winch with flanges
    const spool = put(holder, M(new THREE.CylinderGeometry(0.065, 0.065, 0.12, 16), steelMat), 0, 0.03, 0.02);
    spool.rotation.z = Math.PI / 2;
    [-0.065, 0.065].forEach((sx) => {
      const fl = put(holder, M(new THREE.CylinderGeometry(0.078, 0.078, 0.012, 16), frameMat), sx, 0.03, 0.02);
      fl.rotation.z = Math.PI / 2;
    });
    // chain links: alternating orientation
    for (let c = 0; c < 4; c++) {
      const link = put(holder, M(new THREE.TorusGeometry(0.052, 0.012, 6, 14), energyMat), -0.04 + c * 0.026, 0.03, 0.02);
      link.rotation.y = Math.PI / 2;
      if (c % 2) link.rotation.x = Math.PI / 5;
    }

    // Harpoon head (all direct children of the holder, named so the scene can hide them while it flies)
    const collar = put(holder, M(rb(0.09, 0.09, 0.1, 0.014), gunMat), 0, 0.03, -0.45, 'harpoonPart');
    put(collar, M(rb(0.1, 0.1, 0.022, 0.005), steelMat), 0, 0, 0.04);
    put(collar, M(rb(0.1, 0.1, 0.022, 0.005), steelMat), 0, 0, -0.04);
    const tipG = new THREE.Group();
    put(tipG, M(coneZ(0.045, 0.42, 6), steelMat), 0, 0, 0);
    put(tipG, M(coneZ(0.047, 0.2, 6), trimMat), 0, 0, 0.12);
    glowBox(tipG, 0.006, 0.006, 0.28, 0, 0.03, 0.02);
    put(holder, tipG, 0, 0.03, -0.7, 'harpoonPart');
    [-1, 1].forEach((side) => {
      const barb = new THREE.Group();
      put(barb, M(rb(0.018, 0.06, 0.14, 0.004), energyMat), 0, 0, 0);
      put(barb, M(coneZ(0.02, 0.06, 4), steelMat), 0, 0, -0.09);
      barb.rotation.y = side * 0.4;
      put(holder, barb, side * 0.06, 0.03, -0.58, 'harpoonPart');
    });

    // ═════════════════════ 3. PHASE DAGGER ═════════════════════
  } else if (weapon.id === 'blade_tachyon') {
    // Everything lies on the aim axis (-Z): grip (rear) -> guard -> blade (front)
    put(holder, M(cylZ(0.02, 0.022, 0.18, 14), rubberMat), 0, 0, 0.11);
    for (let i = 0; i < 5; i++) put(holder, M(cylZ(0.0235, 0.0235, 0.012, 14), i % 2 ? gunMat : frameMat), 0, 0, 0.045 + i * 0.034);
    put(holder, M(new THREE.OctahedronGeometry(0.03, 0), steelMat), 0, 0, 0.215); // pommel
    glowSphere(holder, 0.014, 0, 0, 0.235);

    // crossguard with forward-swept fangs
    put(holder, M(rb(0.16, 0.024, 0.036, 0.008), steelMat), 0, 0, 0.005);
    put(holder, M(rb(0.052, 0.05, 0.075, 0.01), gunMat), 0, 0, 0.0);
    [-1, 1].forEach((side) => {
      const fang = put(holder, M(coneZ(0.014, 0.085, 5), steelMat), side * 0.085, 0, -0.03);
      fang.rotation.y = side * 0.25;
      put(holder, M(coneZ(0.007, 0.05, 4), energyMat), side * 0.092, 0, -0.065).rotation.y = side * 0.25;
    });
    glowSphere(holder, 0.016, 0, 0.034, 0.0); // phase core gem
    put(holder, M(rb(0.046, 0.022, 0.07, 0.006), frameMat), 0, 0, -0.06); // emitter ricasso

    // double-edged leaf blade, flat to the camera: width across X, length along -Z
    const L = 0.54;
    const bs = new THREE.Shape();
    bs.moveTo(-0.02, 0);
    bs.lineTo(-0.036, 0.05);
    bs.lineTo(-0.037, 0.3);
    bs.lineTo(0, L);
    bs.lineTo(0.037, 0.3);
    bs.lineTo(0.036, 0.05);
    bs.lineTo(0.02, 0);
    bs.closePath();
    const bg = new THREE.ExtrudeGeometry(bs, { depth: 0.008, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.0025, bevelSegments: 1, curveSegments: 1 });
    bg.translate(0, 0, -0.004);
    bg.rotateX(-Math.PI / 2); // shape +Y -> -Z, extrusion -> Y
    put(holder, M(bg, steelMat), 0, 0, -0.085);
    // glowing fuller + edge lines on the top face
    glowBox(holder, 0.006, 0.004, 0.36, 0, 0.009, -0.27);
    [-1, 1].forEach((side) => {
      put(holder, M(new THREE.BoxGeometry(0.0035, 0.004, 0.3), energyMat), side * 0.0335, 0.009, -0.245).rotation.y = side * -0.0;
      put(holder, M(new THREE.BoxGeometry(0.0035, 0.004, 0.26), energyMat), side * 0.02, 0.009, -0.5).rotation.y = side * 0.14;
    });
    put(holder, M(new THREE.BoxGeometry(0.003, 0.003, 0.34), coreMat), 0, 0.0105, -0.27);
    // phase afterimages trailing the blade (additive ghosts)
    [-1, 1].forEach((side) => {
      const ghost = put(holder, M(bg, glowMat), side * 0.052, -0.012, -0.045);
      ghost.scale.set(0.8, 1, 0.9);
    });

    // ═════════════════════ 4. SIEGE STAKE (PILE BUNKER) ═════════════════════
  } else if (weapon.id === 'blade_thunder_lance') {
    // Haft runs along the aim axis (-Z) into the receiver / pile housing
    put(holder, M(cylZ(0.025, 0.028, 0.8, 14), gunMat), 0, 0.0, 0.4);
    for (let i = 0; i < 4; i++) put(holder, M(cylZ(0.032, 0.032, 0.06, 14), rubberMat), 0, 0.0, 0.2 + i * 0.12);
    put(holder, M(new THREE.SphereGeometry(0.036, 12, 10), steelMat), 0, 0.0, 0.81); // pommel
    // Guard plate + reinforced collar
    put(holder, M(cylZ(0.09, 0.08, 0.06, 16), steelMat), 0, 0.02, -0.1);
    put(holder, M(cylZ(0.1, 0.1, 0.012, 16), frameMat), 0, 0.02, -0.07);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      bolt(holder, Math.cos(a) * 0.085, 0.02 + Math.sin(a) * 0.085, -0.065, 0.007, 'z');
    }
    // Pile housing: armoured barrel with ribs and vents
    put(holder, M(cylZ(0.05, 0.06, 0.45, 16), gunMat), 0, 0.02, -0.32);
    for (let i = 0; i < 4; i++) put(holder, M(cylZ(0.062, 0.062, 0.016, 16), frameMat), 0, 0.02, -0.17 - i * 0.1);
    put(holder, M(rb(0.04, 0.05, 0.16, 0.008), frameMat), 0, 0.08, -0.22); // top feed box
    glowBox(holder, 0.03, 0.006, 0.12, 0, 0.108, -0.22);
    put(holder, M(rb(0.04, 0.03, 0.12, 0.006), rubberMat), 0, -0.04, -0.12); // trigger grip block
    // Needle (animated by name: origin must stay at z=-0.75)
    const needle = new THREE.Group();
    put(needle, M(coneZ(0.038, 0.55, 14), energyMat), 0, 0, 0);
    put(needle, M(coneZ(0.02, 0.5, 10), coreMat), 0, 0, -0.01);
    put(needle, M(coneZ(0.058, 0.55, 10), glowMat), 0, 0, 0);
    put(holder, needle, 0, 0.02, -0.75, 'lanceNeedle');
    // High-voltage induction coils
    for (let i = 0; i < 3; i++) {
      put(holder, M(ringZ(0.058, 0.01, 18), energyMat), 0, 0.02, -0.25 - i * 0.12);
      put(holder, M(ringZ(0.058, 0.026, 18), glowMat), 0, 0.02, -0.25 - i * 0.12);
    }

    // ═════════════════════ 4b. ANCHRON-G2 (MOORING ANCHOR) ═════════════════════
  } else if (weapon.id === 'blade_anchor') {
    const anchorRoot = new THREE.Group();
    anchorRoot.scale.setScalar(0.72);
    holder.add(anchorRoot);
    // The anchor is held upside-down by its shackle ring; stock = crossguard, crown + flukes = striking head
    put(anchorRoot, M(new THREE.CylinderGeometry(0.026, 0.026, 1.14, 14), gunMat), 0, 0.07, 0);
    put(anchorRoot, M(new THREE.CylinderGeometry(0.03, 0.03, 0.4, 14), rubberMat), 0, -0.3, 0);
    for (let i = 0; i < 4; i++) put(anchorRoot, M(new THREE.CylinderGeometry(0.034, 0.034, 0.012, 14), steelMat), 0, -0.45 + i * 0.1, 0);
    // shackle ring pommel with a glowing inner ring
    put(anchorRoot, M(new THREE.TorusGeometry(0.055, 0.014, 8, 20), steelMat), 0, -0.6, 0);
    put(anchorRoot, M(new THREE.TorusGeometry(0.055, 0.005, 6, 20), energyMat), 0, -0.6, 0);
    // stock (crossbar) with end knobs
    const stock = put(anchorRoot, M(new THREE.CylinderGeometry(0.02, 0.02, 0.46, 12), steelMat), 0, -0.04, 0);
    stock.rotation.z = Math.PI / 2;
    [-1, 1].forEach((sx) => put(anchorRoot, M(new THREE.SphereGeometry(0.034, 10, 8), frameMat), sx * 0.23, -0.04, 0));
    put(anchorRoot, M(rb(0.07, 0.06, 0.07, 0.01), frameMat), 0, -0.04, 0);
    // chain wound around the shank (energy links)
    const helix: THREE.Vector3[] = [];
    for (let i = 0; i <= 40; i++) {
      const t = i / 40;
      helix.push(new THREE.Vector3(Math.cos(t * Math.PI * 7) * 0.04, 0.08 + t * 0.34, Math.sin(t * Math.PI * 7) * 0.04));
    }
    const chainCurve = new THREE.CatmullRomCurve3(helix);
    put(anchorRoot, M(new THREE.TubeGeometry(chainCurve, 80, 0.006, 6, false), energyMat));
    put(anchorRoot, M(new THREE.TubeGeometry(chainCurve, 80, 0.011, 6, false), glowMat));
    // crown: a heavy arch bowing over the shank end, ending in two flukes
    const CY = 0.44;
    const arch = put(anchorRoot, M(new THREE.TorusGeometry(0.22, 0.032, 10, 28, Math.PI), steelMat), 0, CY, 0);
    put(arch, M(new THREE.TorusGeometry(0.22, 0.008, 6, 28, Math.PI), energyMat), 0, 0, 0.032);
    put(anchorRoot, M(new THREE.CylinderGeometry(0.04, 0.034, 0.08, 12), frameMat), 0, CY + 0.2, 0);
    [-1, 1].forEach((sx) => {
      const fluke = put(anchorRoot, M(new THREE.ConeGeometry(0.075, 0.24, 4), steelMat), sx * 0.24, CY - 0.07, 0);
      fluke.scale.z = 0.3;
      fluke.rotation.z = -sx * (Math.PI / 2 + 0.55);
      put(anchorRoot, M(new THREE.ConeGeometry(0.03, 0.12, 4), energyMat), sx * 0.31, CY - 0.1, 0).rotation.z = -sx * (Math.PI / 2 + 0.55);
    });
    glowSphere(anchorRoot, 0.026, 0, CY + 0.06, 0.035);
    glowSphere(anchorRoot, 0.02, 0, 0.02, 0.035);

    // ═════════════════════ 5. VORTEX SCYTHE ═════════════════════
  } else if (weapon.id === 'blade_scythe') {
    put(holder, M(new THREE.CylinderGeometry(0.024, 0.024, 1.45, 12), gunMat), 0, 0.15, 0);
    for (let i = 0; i < 7; i++) put(holder, M(new THREE.CylinderGeometry(0.027, 0.027, 0.012, 12), steelMat), 0, -0.4 + i * 0.2, 0);
    put(holder, M(new THREE.CylinderGeometry(0.03, 0.03, 0.22, 12), rubberMat), 0, -0.2, 0);
    put(holder, M(new THREE.CylinderGeometry(0.03, 0.03, 0.22, 12), rubberMat), 0, 0.35, 0);
    put(holder, M(new THREE.SphereGeometry(0.034, 12, 10), steelMat), 0, -0.58, 0);
    glowBox(holder, 0.01, 0.1, 0.01, 0, 0.1, 0.027);
    // Neck coupler
    put(holder, M(rb(0.08, 0.14, 0.12, 0.014), gunMat), 0.04, 0.85, -0.02);
    put(holder, M(rb(0.1, 0.03, 0.14, 0.008), frameMat), 0.04, 0.78, -0.02);
    glowSphere(holder, 0.032, 0.04, 0.85, 0.05);

    // Crescent blade: a vertical (XY) plane crescent that leaves the neck sideways (-X) and droops down to the tip
    const NX = 0.04;
    const NY = 0.85;
    const spineC = new THREE.CubicBezierCurve3(new THREE.Vector3(0.06, 0.1, 0), new THREE.Vector3(-0.2, 0.24, 0), new THREE.Vector3(-0.62, 0.24, 0), new THREE.Vector3(-0.84, -0.2, 0));
    const innerC = new THREE.CubicBezierCurve3(new THREE.Vector3(-0.84, -0.2, 0), new THREE.Vector3(-0.58, 0.0, 0), new THREE.Vector3(-0.26, -0.02, 0), new THREE.Vector3(-0.02, -0.1, 0));
    const sh = new THREE.Shape();
    spineC.getPoints(24).forEach((q, i) => (i === 0 ? sh.moveTo(q.x, q.y) : sh.lineTo(q.x, q.y)));
    innerC.getPoints(24).slice(1).forEach((q) => sh.lineTo(q.x, q.y));
    sh.closePath();
    const bg = new THREE.ExtrudeGeometry(sh, { depth: 0.014, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 1, curveSegments: 1 });
    bg.translate(0, 0, -0.007);
    put(holder, M(bg, steelMat), NX, NY, 0);
    // spine reinforcement ribs following the back of the blade
    [0.2, 0.42, 0.64].forEach((t) => {
      const q = spineC.getPoint(t);
      put(holder, M(rb(0.05, 0.03, 0.03, 0.006), frameMat), NX + q.x, NY + q.y, 0);
    });
    // plasma edge following the inner (cutting) curve
    const edge = edgeTube(innerC.getPoints(14).map((q) => new THREE.Vector3(NX + q.x, NY + q.y, 0.009)), 0.007);
    edge.name = 'bladeEdge';
    holder.add(edge);

    // ═════════════════════ 5b. RAVAGER-09 PLASMA CHAINSAW ═════════════════════
  } else if (weapon.id === 'blade_chainsaw') {
    // Engine housing (the hand holds it from below; the guide bar stands along +Y, cutting edge toward -Z)
    put(holder, M(rb(0.11, 0.2, 0.22, 0.02), gunMat), 0, -0.1, 0.03);
    put(holder, M(rb(0.116, 0.05, 0.2, 0.01), trimMat), 0, -0.02, 0.03); // red cowl band
    [-1, 1].forEach((side) => {
      for (let i = 0; i < 5; i++) put(holder, M(rb(0.008, 0.13, 0.016, 0.003), frameMat), side * 0.06, -0.11, -0.05 + i * 0.035); // cooling fins
      glowBox(holder, 0.004, 0.1, 0.006, side * 0.057, -0.11, 0.1);
    });
    // Exhaust stack with plasma glow
    const exhaust = put(holder, M(new THREE.CylinderGeometry(0.018, 0.022, 0.12, 12), steelMat), 0.07, -0.05, 0.11);
    exhaust.rotation.z = -0.4;
    glowSphere(holder, 0.014, 0.095, 0.0, 0.11);
    // Clutch cover where the bar enters the housing
    put(holder, M(cylZ(0.05, 0.05, 0.02, 16), frameMat), 0, 0.02, 0).rotation.y = Math.PI / 2;
    bolt(holder, 0.012, 0.02, 0.0, 0.008, 'x');
    bolt(holder, -0.012, 0.02, 0.0, 0.008, 'x');
    // Wrap-around top handle (loop over the housing) + rear pistol grip with trigger
    const loop = put(holder, M(new THREE.TorusGeometry(0.11, 0.012, 8, 18, Math.PI), rubberMat), 0, -0.06, 0.04);
    loop.rotation.y = Math.PI / 2;
    loop.rotation.x = -0.25;
    const grip = put(holder, M(rb(0.04, 0.15, 0.05, 0.012), rubberMat), 0, -0.25, 0.12);
    grip.rotation.x = -0.35;
    put(holder, M(rb(0.012, 0.03, 0.02, 0.004), steelMat), 0, -0.2, 0.07).rotation.x = 0.3; // trigger
    put(holder, M(rb(0.05, 0.02, 0.07, 0.006), frameMat), 0, -0.32, 0.15); // grip butt
    // Starter pull handle on the rear
    put(holder, M(rb(0.05, 0.012, 0.012, 0.004), steelMat), 0, -0.04, 0.16);

    // Guide bar: stadium-shaped plate, width across Z, thickness along X
    const barLen = 0.86;
    const R = CHAINSAW_BAR.halfWidth - 0.008;
    const bs = new THREE.Shape();
    bs.moveTo(-R, CHAINSAW_BAR.y0);
    bs.lineTo(-R, CHAINSAW_BAR.y1);
    bs.absarc(0, CHAINSAW_BAR.y1, R, Math.PI, 0, true);
    bs.lineTo(R, CHAINSAW_BAR.y0);
    bs.closePath();
    const barGeo = new THREE.ExtrudeGeometry(bs, { depth: 0.01, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 1, curveSegments: 16 });
    barGeo.translate(0, 0, -0.005);
    barGeo.rotateY(Math.PI / 2); // X(width) -> -Z, Z(thickness) -> X
    put(holder, M(barGeo, steelMat), 0, 0, 0);
    // Bar detail: dark centre rail, plasma slot, rivets
    put(holder, M(new THREE.BoxGeometry(0.016, barLen - 0.12, 0.05), gunMat), 0, CHAINSAW_BAR.y0 + (barLen - 0.12) / 2 + 0.04, 0);
    glowBox(holder, 0.018, barLen - 0.24, 0.008, 0, CHAINSAW_BAR.y0 + (barLen - 0.24) / 2 + 0.1, 0);
    for (let i = 0; i < 4; i++) {
      bolt(holder, 0.011, 0.14 + i * 0.2, 0.026, 0.006, 'x');
      bolt(holder, 0.011, 0.14 + i * 0.2, -0.026, 0.006, 'x');
    }
    put(holder, M(new THREE.CylinderGeometry(0.018, 0.018, 0.02, 14), frameMat), 0, CHAINSAW_BAR.y1, 0).rotation.z = Math.PI / 2; // nose sprocket

    // Chain (animated by name: each tooth is re-placed along the bar every frame)
    const chain = new THREE.Group();
    const linkGeo = new THREE.BoxGeometry(0.008, 0.02, 0.008);
    const cutterGeo = new THREE.BoxGeometry(0.009, 0.014, 0.016);
    cutterGeo.translate(0, 0.002, -0.009);
    for (let i = 0; i < CHAINSAW_TEETH; i++) {
      const tooth = new THREE.Group();
      tooth.add(M(linkGeo, steelMat));
      tooth.add(M(cutterGeo, i % 2 ? energyMat : steelMat));
      tooth.userData.u0 = i / CHAINSAW_TEETH;
      chain.add(tooth);
    }
    put(holder, chain, 0, 0, 0, 'sawChain');
    updateChainsawChain(chain, 0);
    // Motion blur around the chain (opacity follows the RPM)
    const blurMat = new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false });
    const loopPts: THREE.Vector3[] = [];
    for (let i = 0; i <= 64; i++) {
      const p = chainsawChainPoint(i / 64);
      loopPts.push(new THREE.Vector3(0, p.y, p.z));
    }
    put(holder, M(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(loopPts, true), 96, 0.014, 6, true), blurMat), 0, 0, 0, 'sawBlur');

    // ═════════════════════ 5b. GLACIEL (CRYO RAPIER) ═════════════════════
  } else if (weapon.id === 'blade_rapier') {
    const iceMat = new THREE.MeshStandardMaterial({ color: 0xbae6fd, emissive: 0x38bdf8, emissiveIntensity: 0.5, metalness: 0.1, roughness: 0.1, transparent: true, opacity: 0.8 });
    // grip (tilted like the katana) + wire wrap + pommel
    const grip = put(holder, M(new THREE.CylinderGeometry(0.019, 0.021, 0.2, 12), rubberMat), 0, -0.1, 0.06);
    grip.rotation.x = 0.2;
    for (let i = 0; i < 6; i++) {
      const [yy, zz] = along(-0.1, 0.06, 0.2, -0.085 + i * 0.034);
      put(holder, M(new THREE.TorusGeometry(0.021, 0.003, 4, 14), steelMat), 0, yy, zz).rotation.x = Math.PI / 2 + 0.2;
    }
    {
      const [yy, zz] = along(-0.1, 0.06, 0.2, -0.115);
      put(holder, M(new THREE.SphereGeometry(0.03, 14, 10), steelMat), 0, yy, zz);
      glowSphere(holder, 0.012, 0, yy - 0.025, zz + 0.005);
    }
    // swept hilt: cup guard + flowing rings around the hand
    const cup = put(holder, M(new THREE.SphereGeometry(0.075, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2.4), steelMat), 0, 0.005, 0.02);
    cup.rotation.x = Math.PI;
    put(holder, M(new THREE.TorusGeometry(0.075, 0.006, 6, 28), energyMat), 0, -0.012, 0.02).rotation.x = Math.PI / 2;
    [[-0.5, 0.11], [0.5, 0.11], [0, 0.13]].forEach(([rz, R]) => {
      const ring = put(holder, M(new THREE.TorusGeometry(R, 0.006, 6, 24, Math.PI * 1.1), steelMat), 0, -0.06, 0.04);
      ring.rotation.set(0, Math.PI / 2, rz + Math.PI * 0.95);
    });
    // quillons
    const q = put(holder, M(new THREE.CylinderGeometry(0.008, 0.008, 0.26, 8), steelMat), 0, 0.025, 0.02);
    q.rotation.z = Math.PI / 2;
    [-1, 1].forEach((sx) => glowSphere(holder, 0.01, sx * 0.13, 0.025, 0.02));
    // long thin blade
    put(holder, M(bladeGeo(1.15, 0.026, 0.01, 0.22, 0.5), steelMat), 0, 0.03, 0);
    const edge = edgeTube([new THREE.Vector3(0, 0.08, -0.012), new THREE.Vector3(0, 0.6, -0.012), new THREE.Vector3(0, 1.1, -0.008), new THREE.Vector3(0, 1.17, 0)], 0.0028);
    edge.name = 'bladeEdge';
    holder.add(edge);
    // frost crystals climbing the blade from the guard
    const frost = new THREE.Group();
    frost.name = 'rapierFrost';
    for (let i = 0; i < 9; i++) {
      const c = put(frost, M(new THREE.OctahedronGeometry(0.018 + (i % 3) * 0.006, 0), iceMat), (i % 2 ? 1 : -1) * 0.014, 0.08 + i * 0.045, (i % 3 - 1) * 0.008);
      c.scale.set(0.6, 1.8, 0.6);
      c.rotation.z = (i % 2 ? 1 : -1) * 0.4;
    }
    holder.add(frost);
    put(holder, M(new THREE.CylinderGeometry(0.03, 0.012, 0.5, 10, 1, true), glowMat), 0, 0.3, 0);

    // ═════════════════════ 5c. VIPERCOIL (PLASMA WHIP) ═════════════════════
  } else if (weapon.id === 'blade_whip') {
    // handle stands along +Y; the whip body (whipSeg0..) is posed every frame by the battle scene
    put(holder, M(new THREE.CylinderGeometry(0.026, 0.03, 0.34, 14), rubberMat), 0, -0.02, 0.04);
    for (let i = 0; i < 5; i++) put(holder, M(new THREE.CylinderGeometry(0.032, 0.032, 0.012, 14), i % 2 ? steelMat : frameMat), 0, -0.14 + i * 0.06, 0.04);
    put(holder, M(new THREE.SphereGeometry(0.036, 14, 10), steelMat), 0, -0.21, 0.04);
    glowSphere(holder, 0.016, 0, -0.24, 0.04);
    // emitter collar where the whip leaves the handle
    put(holder, M(new THREE.CylinderGeometry(0.045, 0.032, 0.07, 14), gunMat), 0, 0.17, 0.0);
    put(holder, M(new THREE.TorusGeometry(0.045, 0.008, 6, 20), energyMat), 0, 0.2, 0.0).rotation.x = Math.PI / 2;
    put(holder, M(new THREE.TorusGeometry(0.06, 0.018, 6, 20), glowMat), 0, 0.2, 0.0).rotation.x = Math.PI / 2;
    // capacitor fins on the handle
    [-1, 1].forEach((sx) => {
      put(holder, M(rb(0.008, 0.16, 0.04, 0.003), frameMat), sx * 0.034, 0.03, 0.04);
      glowBox(holder, 0.004, 0.12, 0.008, sx * 0.04, 0.03, 0.02);
    });
    const segMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.6, roughness: 0.35, emissive: accent, emissiveIntensity: 0.25 });
    for (let i = 0; i < 18; i++) {
      const g = new THREE.Group();
      const r0 = 0.016 * (1 - i / 22);
      const geo = new THREE.CylinderGeometry(r0 * 0.85, r0, 0.095, 8);
      geo.rotateX(Math.PI / 2);
      geo.translate(0, 0, 0.0475);
      g.add(M(geo, segMat));
      const glowGeo = new THREE.CylinderGeometry(r0 * 1.9, r0 * 2.1, 0.095, 8, 1, true);
      glowGeo.rotateX(Math.PI / 2);
      glowGeo.translate(0, 0, 0.0475);
      g.add(M(glowGeo, glowMat));
      if (i % 3 === 0) {
        const ring = M(new THREE.TorusGeometry(r0 * 1.15, 0.0025, 4, 10), energyMat);
        g.add(ring);
      }
      put(holder, g, 0, 0.2 - i * 0.03, -i * 0.02, `whipSeg${i}`);
    }
    // barbed plasma tip
    const tip = new THREE.Group();
    put(tip, M(coneZ(0.02, 0.07, 6), steelMat), 0, 0, -0.03);
    glowSphere(tip, 0.016, 0, 0, 0);
    put(holder, tip, 0, -0.4, -0.3, 'whipTip');

    // ═════════════════════ 5d. ORBITAL RONDO (TWIN CHAKRAM) ═════════════════════
  } else if (weapon.id === 'blade_disc') {
    const makeDisc = (name: string, R: number) => {
      const d = new THREE.Group();
      d.name = name;
      put(d, M(new THREE.TorusGeometry(R, R * 0.07, 8, 40), steelMat));
      put(d, M(new THREE.TorusGeometry(R * 0.82, R * 0.025, 6, 40), energyMat));
      put(d, M(new THREE.TorusGeometry(R * 0.86, R * 0.12, 6, 40), glowMat));
      // swept blades on the rim
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const b = put(d, M(new THREE.ConeGeometry(R * 0.11, R * 0.42, 4), steelMat), Math.cos(a) * R * 1.12, Math.sin(a) * R * 1.12, 0);
        b.rotation.z = a - Math.PI / 2 - 0.5;
        b.scale.z = 0.35;
      }
      // grip bar across the centre
      const bar = put(d, M(new THREE.CylinderGeometry(R * 0.08, R * 0.08, R * 1.5, 10), rubberMat));
      bar.rotation.z = Math.PI / 2;
      glowSphere(d, R * 0.12, 0, 0, 0);
      return d;
    };
    const right = makeDisc('discR', 0.17);
    right.position.set(0, 0.12, -0.02);
    right.rotation.set(0.3, 1.1, 0.2);
    holder.add(right);
    const left = makeDisc('discL', 0.15);
    left.position.set(-0.46, 0.06, 0.1);
    left.rotation.set(0.2, -1.0, -0.3);
    holder.add(left);

    // ═════════════════════ 6. TITAN REACH GLAIVE ═════════════════════
  } else if (weapon.id === 'blade_glaive') {
    put(holder, M(new THREE.CylinderGeometry(0.024, 0.026, 1.1, 12), gunMat), 0, 0.0, 0.05);
    [-0.3, 0.2].forEach((yy) => {
      put(holder, M(new THREE.CylinderGeometry(0.032, 0.032, 0.16, 12), rubberMat), 0, yy, 0.05);
      [-0.07, 0.07].forEach((o) => put(holder, M(new THREE.CylinderGeometry(0.035, 0.035, 0.012, 12), steelMat), 0, yy + o, 0.05));
    });
    put(holder, M(new THREE.SphereGeometry(0.034, 12, 10), steelMat), 0, -0.56, 0.05);
    // blade socket with heat vents
    put(holder, M(rb(0.09, 0.2, 0.09, 0.014), gunMat), 0, 0.62, 0.05);
    put(holder, M(rb(0.11, 0.03, 0.11, 0.008), steelMat), 0, 0.52, 0.05);
    [-1, 1].forEach((side) => glowBox(holder, 0.012, 0.14, 0.1, side * 0.05, 0.62, 0.05));
    // curved wide blade (single extruded outline with a gentle sweep)
    const sh = new THREE.Shape();
    sh.moveTo(0.05, 0.72);
    sh.lineTo(0.06, 0.95);
    sh.bezierCurveTo(0.075, 1.25, 0.0, 1.55, -0.2, 1.8);
    sh.bezierCurveTo(-0.14, 1.55, -0.1, 1.3, -0.075, 1.0);
    sh.lineTo(-0.05, 0.72);
    sh.closePath();
    const bg = new THREE.ExtrudeGeometry(sh, { depth: 0.014, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 1, curveSegments: 20 });
    bg.translate(0, 0, -0.007);
    put(holder, M(bg, steelMat), 0, 0, 0.05);
    // fuller groove
    put(holder, M(new THREE.BoxGeometry(0.014, 0.5, 0.027), gunMat), 0.0, 1.0, 0.05);
    const edge = edgeTube(
      [
        new THREE.Vector3(-0.052, 0.74, 0.05),
        ...new THREE.CubicBezierCurve3(
          new THREE.Vector3(-0.075, 1.0, 0.05),
          new THREE.Vector3(-0.1, 1.3, 0.05),
          new THREE.Vector3(-0.14, 1.55, 0.05),
          new THREE.Vector3(-0.2, 1.8, 0.05)
        ).getPoints(8),
      ],
      0.006
    );
    edge.name = 'bladeEdge';
    holder.add(edge);

    // ═════════════════════ 7. KATANA / GENERIC BLADE ═════════════════════
  } else if (weapon.modelType === 'katana' || weapon.modelType === 'blade') {
    const isGlaive = weapon.modelType === 'blade';
    const haftLength = isGlaive ? 0.8 : 0.35;
    const hilt = put(holder, M(new THREE.CylinderGeometry(0.022, 0.022, haftLength, 12), rubberMat), 0, -0.15, 0.1);
    hilt.rotation.x = 0.2;
    // wrap bands + pommel along the (tilted) hilt
    const bands = Math.max(3, Math.round(haftLength / 0.045));
    for (let i = 0; i < bands; i++) {
      const t = -haftLength / 2 + 0.03 + (i * (haftLength - 0.06)) / (bands - 1);
      const [yy, zz] = along(-0.15, 0.1, 0.2, t);
      put(holder, M(new THREE.CylinderGeometry(0.0245, 0.0245, 0.012, 12), i % 2 ? gunMat : frameMat), 0, yy, zz).rotation.x = 0.2;
    }
    {
      const [yy, zz] = along(-0.15, 0.1, 0.2, -haftLength / 2 - 0.005);
      put(holder, M(new THREE.CylinderGeometry(0.03, 0.026, 0.03, 12), steelMat), 0, yy, zz).rotation.x = 0.2;
    }
    // tsuba (round guard) + habaki collar + energy coupler
    put(holder, M(new THREE.CylinderGeometry(0.06, 0.06, 0.012, 20), steelMat), 0, 0, 0.05);
    put(holder, M(new THREE.TorusGeometry(0.06, 0.006, 6, 24), frameMat), 0, 0.0, 0.05).rotation.x = Math.PI / 2;
    put(holder, M(rb(0.03, 0.05, 0.09, 0.008), gunMat), 0, 0.03, 0.05);
    put(holder, M(new THREE.CylinderGeometry(0.028, 0.028, 0.06, 12), energyMat), 0, 0.04, 0.05);
    put(holder, M(new THREE.CylinderGeometry(0.04, 0.04, 0.05, 12), glowMat), 0, 0.04, 0.05);

    const bladeLen = isGlaive ? 1.4 : 1.1;
    const bladeW = isGlaive ? 0.08 : 0.06;
    put(holder, M(bladeGeo(bladeLen, bladeW, 0.014, isGlaive ? 0.2 : 0.14, 0.25, 0.004), steelMat), 0, 0, 0);
    // spine ridge + hamon-style glowing edge
    put(holder, M(new THREE.BoxGeometry(0.019, bladeLen - 0.2, 0.01), gunMat), 0, bladeLen / 2, bladeW / 2 - 0.005);
    const edge = edgeTube(
      [
        new THREE.Vector3(0, 0.05, -bladeW / 2 + 0.003),
        new THREE.Vector3(0, bladeLen * 0.5, -bladeW / 2 + 0.003),
        new THREE.Vector3(0, bladeLen - 0.12, -bladeW / 2 + 0.003),
        new THREE.Vector3(0, bladeLen - 0.02, -bladeW / 2 + bladeW * 0.18),
      ],
      0.0035
    );
    edge.name = 'bladeEdge';
    holder.add(edge);
    // emitter slits along the flat
    for (let i = 0; i < 4; i++) put(holder, M(new THREE.BoxGeometry(0.018, 0.04, 0.008), energyMat), 0, 0.2 + i * (bladeLen / 4.6), 0.008);

    // ═════════════════════ 8. GRAVITY HAMMER / EXECUTIONER AXE ═════════════════════
  } else if (weapon.modelType === 'axe') {
    const isHammer = weapon.id === 'blade_axe';
    put(holder, M(new THREE.CylinderGeometry(0.032, 0.032, 1.3, 12), gunMat), 0, 0.2, 0);
    for (let i = 0; i < 6; i++) put(holder, M(new THREE.CylinderGeometry(0.036, 0.036, 0.05, 12), rubberMat), 0, -0.3 + i * 0.08, 0);
    put(holder, M(new THREE.SphereGeometry(0.042, 12, 10), steelMat), 0, -0.47, 0);
    // hydraulic collar
    put(holder, M(new THREE.CylinderGeometry(0.046, 0.046, 0.14, 12), steelMat), 0, 0.58, 0);
    [-0.06, 0.06].forEach((o) => put(holder, M(new THREE.CylinderGeometry(0.052, 0.052, 0.014, 12), frameMat), 0, 0.58 + o, 0));

    if (isHammer) {
      const head = put(holder, M(new THREE.CylinderGeometry(0.16, 0.16, 0.44, 20), gunMat), 0, 0.65, 0);
      head.rotation.z = Math.PI / 2;
      [-0.22, 0.22].forEach((sx) => {
        const cap = put(holder, M(new THREE.CylinderGeometry(0.18, 0.18, 0.04, 20), steelMat), sx, 0.65, 0);
        cap.rotation.z = Math.PI / 2;
        const face = put(holder, M(new THREE.CylinderGeometry(0.12, 0.12, 0.044, 20), frameMat), sx, 0.65, 0);
        face.rotation.z = Math.PI / 2;
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          bolt(holder, sx + Math.sign(sx) * 0.022, 0.65 + Math.cos(a) * 0.15, Math.sin(a) * 0.15, 0.01, 'x');
        }
      });
      // gravity core: ring + glowing band + halo
      const core = put(holder, M(new THREE.TorusGeometry(0.17, 0.03, 10, 28), energyMat), 0, 0.65, 0);
      core.rotation.y = Math.PI / 2;
      core.name = 'hammerCore';
      const halo = put(holder, M(new THREE.TorusGeometry(0.17, 0.07, 8, 28), glowMat), 0, 0.65, 0);
      halo.rotation.y = Math.PI / 2;
      halo.name = 'hammerHalo';
      // 溜め/叩きつけ中だけ現れる重力オービット（ヘッドの周囲を回る結晶片）。通常時は scale 0 で非表示
      const orbit = new THREE.Group();
      orbit.name = 'hammerOrbit';
      orbit.position.set(0, 0.65, 0);
      orbit.scale.setScalar(0.0001);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const shard = M(new THREE.OctahedronGeometry(i % 2 ? 0.022 : 0.032, 0), i % 2 ? coreMat : energyMat);
        shard.position.set(0, Math.cos(a) * 0.3, Math.sin(a) * 0.3);
        shard.rotation.set(a, a * 0.5, 0);
        orbit.add(shard);
      }
      const orbitRing = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.006, 6, 40), glowMat);
      orbitRing.rotation.y = Math.PI / 2;
      orbit.add(orbitRing);
      holder.add(orbit);
      [-0.1, 0.1].forEach((sx) => {
        const r = put(holder, M(new THREE.TorusGeometry(0.162, 0.012, 6, 28), steelMat), sx, 0.65, 0);
        r.rotation.y = Math.PI / 2;
      });
    } else {
      // Axe head: bearded crescent blade extruded from an outline, plus armoured back block
      put(holder, M(rb(0.14, 0.44, 0.09, 0.012), gunMat), 0.07, 0.62, 0);
      const sh = new THREE.Shape();
      sh.moveTo(0.08, 0.82);
      sh.lineTo(0.3, 0.84);
      sh.lineTo(0.5, 0.92);
      sh.quadraticCurveTo(0.68, 0.62, 0.5, 0.32);
      sh.lineTo(0.3, 0.4);
      sh.lineTo(0.08, 0.42);
      sh.closePath();
      const bg = new THREE.ExtrudeGeometry(sh, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 1, curveSegments: 16 });
      bg.translate(0, 0, -0.02);
      put(holder, M(bg, steelMat), 0, 0, 0);
      // inset panel
      put(holder, M(rb(0.18, 0.2, 0.056, 0.01), gunMat), 0.3, 0.62, 0);
      for (let i = 0; i < 3; i++) bolt(holder, 0.22 + i * 0.07, 0.62, 0.03, 0.007, 'z');
      // Rocket booster nozzle (rear of head)
      const nozzle = put(holder, M(new THREE.CylinderGeometry(0.04, 0.06, 0.14, 12), steelMat), -0.12, 0.62, 0);
      nozzle.rotation.z = Math.PI / 2;
      put(holder, M(new THREE.TorusGeometry(0.058, 0.008, 6, 14), frameMat), -0.17, 0.62, 0).rotation.y = Math.PI / 2;
      const flame = put(holder, M(new THREE.ConeGeometry(0.04, 0.1, 10), energyMat), -0.23, 0.62, 0);
      flame.rotation.z = Math.PI / 2;
      const flameHalo = put(holder, M(new THREE.ConeGeometry(0.065, 0.14, 10), glowMat), -0.25, 0.62, 0);
      flameHalo.rotation.z = Math.PI / 2;
      // Plasma cutting edge hugging the convex edge
      const edge = edgeTube(
        new THREE.QuadraticBezierCurve3(new THREE.Vector3(0.5, 0.92, 0), new THREE.Vector3(0.68, 0.62, 0), new THREE.Vector3(0.5, 0.32, 0)).getPoints(14),
        0.012
      );
      edge.name = 'axeBladeEdge';
      holder.add(edge);
      // spike on the haft top
      put(holder, M(new THREE.ConeGeometry(0.03, 0.14, 8), steelMat), 0, 0.92, 0);
    }

    // ═════════════════════ 9. HANDGUN / REVOLVER ═════════════════════
  } else if (weapon.modelType === 'handgun' || weapon.modelType === 'revolver') {
    const isRevolver = weapon.modelType === 'revolver';

    /**
     * ARCHON 9 only: removable magazine + the left hand that swaps it during the reload.
     * Everything lives in `pistolMagWell`, a frame aligned with the grip (local +Y = up the grip,
     * origin = grip centre). The battle scene animates `pistolMag` / `reloadHand` inside it.
     */
    const buildMagAndReloadHand = (P: THREE.Object3D) => {
      const well = put(P, new THREE.Group(), 0, -0.11, 0.08, 'pistolMagWell');
      well.rotation.x = -0.25;

      // magazine (origin = seated position); the body hides inside the grip, only the base plate shows
      const mag = put(well, new THREE.Group(), 0, 0, 0, 'pistolMag');
      put(mag, M(rb(0.04, 0.2, 0.066, 0.006), gunMat), 0, 0.0, 0.0);
      put(mag, M(rb(0.042, 0.03, 0.068, 0.004), frameMat), 0, 0.085, 0.0);
      glowBox(mag, 0.0045, 0.15, 0.004, 0.0205, -0.01, 0.0); // cell charge strip
      glowBox(mag, 0.0045, 0.15, 0.004, -0.0205, -0.01, 0.0);
      put(mag, M(new THREE.BoxGeometry(0.018, 0.008, 0.04), coreMat), 0, 0.103, 0.0); // contact head
      put(mag, M(rb(0.06, 0.016, 0.1, 0.004), steelMat), 0, -0.111, 0.0); // base plate

      // left hand (glove + armoured sleeve), cupping the base plate from below
      const hand = put(well, buildHand(), 0, -0.13, 0, 'reloadHand');
      hand.visible = false;
    };

    /** One complete pistol built into `P`. TWIN VIPER builds two of these (one per hand). */
    const brassLoaderMat = new THREE.MeshStandardMaterial({ color: 0xc9a24a, metalness: 0.85, roughness: 0.3 });
    const buildPistol = (P: THREE.Object3D, slideName: string) => {
      // grip with panels + base plate
      const grip = put(P, M(rb(0.055, 0.22, 0.09, 0.012), rubberMat), 0, -0.11, 0.08);
      grip.rotation.x = -0.25;
      [-1, 1].forEach((s) => {
        const panel = put(P, M(rb(0.006, 0.16, 0.07, 0.003), frameMat), s * 0.029, -0.1, 0.08);
        panel.rotation.x = -0.25;
        for (let i = 0; i < 4; i++) {
          const rib = put(P, M(new THREE.BoxGeometry(0.008, 0.01, 0.06), gunMat), s * 0.031, -0.06 - i * 0.03, 0.075 + i * 0.0 - i * 0.0);
          rib.rotation.x = -0.25;
        }
      });
      if (weapon.modelType === 'handgun' && weapon.id !== 'sub_akimbo' && weapon.id !== 'sub_smg') buildMagAndReloadHand(P);
      else if (weapon.id === 'sub_akimbo') {
        // TWIN VIPER: removable magazine (dropped / re-seated by the reload), aligned with the grip
        const mw = put(P, new THREE.Group(), 0, -0.11, 0.08, slideName === 'akimboSlideR' ? 'akimboMagR' : 'akimboMagL');
        mw.rotation.x = -0.25;
        put(mw, M(rb(0.04, 0.2, 0.066, 0.006), gunMat), 0, 0.0, 0.0);
        glowBox(mw, 0.0045, 0.15, 0.004, 0.0205, -0.01, 0.0);
        put(mw, M(rb(0.06, 0.016, 0.1, 0.004), steelMat), 0, -0.111, 0.0);
      } else put(P, M(rb(0.06, 0.016, 0.1, 0.004), steelMat), 0, -0.215, 0.115).rotation.x = -0.25;
      glowBox(P, 0.004, 0.08, 0.004, 0.0295, -0.1, 0.045);
      // frame + trigger guard + trigger + hammer
      put(P, M(rb(0.05, 0.05, 0.16, 0.01), frameMat), 0, -0.01, 0.0);
      triggerGuard(P, -0.06, -0.045, 0.03);
      put(P, M(rb(0.014, 0.03, 0.02, 0.004), gunMat), 0, 0.07, 0.115).rotation.x = 0.4;

      // slide (animated by name — origin must stay at (0,0.04,-0.12))
      const slide = new THREE.Group();
      put(slide, M(rb(0.065, 0.09, 0.42, 0.012), steelMat), 0, 0, 0);
      put(slide, M(rb(0.05, 0.02, 0.38, 0.006), gunMat), 0, 0.05, 0);
      for (let i = 0; i < 7; i++) put(slide, M(new THREE.BoxGeometry(0.068, 0.07, 0.006), gunMat), 0, 0, 0.14 - i * 0.014); // rear serrations
      put(slide, M(new THREE.BoxGeometry(0.003, 0.03, 0.09), rubberMat), 0.0325, 0.012, -0.04); // ejection port
      put(slide, M(new THREE.BoxGeometry(0.003, 0.03, 0.09), rubberMat), -0.0325, 0.012, -0.04);
      glowBox(slide, 0.004, 0.006, 0.26, 0.033, -0.022, -0.04);
      glowBox(slide, 0.004, 0.006, 0.26, -0.033, -0.022, -0.04);
      put(P, slide, 0, 0.04, -0.12, slideName);

      // barrel + muzzle + recoil-spring guide
      put(P, M(cylZ(0.018, 0.018, 0.38, 12), gunMat), 0, 0.04, -0.14);
      put(P, M(cylZ(0.024, 0.024, 0.05, 12), steelMat), 0, 0.04, -0.34);
      put(P, M(cylZ(0.012, 0.012, 0.052, 10), rubberMat), 0, 0.04, -0.342);
      put(P, M(rb(0.04, 0.025, 0.14, 0.006), gunMat), 0, -0.012, -0.24); // under-barrel rail
      if (isRevolver) {
        // chunky revolver drum with chamber flutes (spun / swung out by the reload)
        const drum = put(P, new THREE.Group(), 0, 0.02, -0.07, 'revolverDrum');
        put(drum, M(cylZ(0.058, 0.058, 0.11, 18), steelMat), 0, 0, 0);
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          put(drum, M(cylZ(0.01, 0.01, 0.114, 8), rubberMat), Math.cos(a) * 0.038, Math.sin(a) * 0.038, 0);
        }
        put(drum, M(cylZ(0.06, 0.06, 0.012, 18), frameMat), 0, 0, 0.06);
        glowBox(P, 0.01, 0.01, 0.12, 0, 0.083, -0.07);
        // speed-loader (six rounds in a knurled ring) used by the reload, hidden at rest
        const loader = new THREE.Group();
        put(loader, M(cylZ(0.05, 0.05, 0.022, 18), frameMat), 0, 0, 0.03);
        put(loader, M(cylZ(0.02, 0.026, 0.04, 12), steelMat), 0, 0, 0.06); // knob
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          put(loader, M(cylZ(0.0095, 0.0095, 0.07, 8), brassLoaderMat), Math.cos(a) * 0.038, Math.sin(a) * 0.038, -0.01);
          put(loader, M(cylZ(0.006, 0.0095, 0.012, 8), energyMat), Math.cos(a) * 0.038, Math.sin(a) * 0.038, -0.05);
        }
        loader.visible = false;
        put(P, loader, 0, 0.02, 0.0, 'speedLoader');
        addReloadHand(P);
      }
      // front & rear sights (kept for ADS alignment)
      glowBox(P, 0.012, 0.035, 0.015, 0, 0.095, -0.3);
      put(P, M(rb(0.018, 0.035, 0.015, 0.003), gunMat), -0.02, 0.095, 0.06);
      put(P, M(rb(0.018, 0.035, 0.015, 0.003), gunMat), 0.02, 0.095, 0.06);
      put(P, M(new THREE.BoxGeometry(0.004, 0.008, 0.016), coreMat), -0.02, 0.108, 0.06);
      put(P, M(new THREE.BoxGeometry(0.004, 0.008, 0.016), coreMat), 0.02, 0.108, 0.06);
    };

    if (weapon.id === 'sub_akimbo') {
      // TWIN VIPER — a full pistol in each hand, canted slightly inward.
      // akimboRight / akimboLeft + akimboSlideR / akimboSlideL are animated by the battle scene.
      ([['akimboRight', 'akimboSlideR', 1], ['akimboLeft', 'akimboSlideL', -1]] as const).forEach(([name, slideName, s]) => {
        const hand = new THREE.Group();
        hand.rotation.z = -s * 0.07;
        put(holder, hand, s * AKIMBO_HAND_X, 0, 0, name);
        buildPistol(hand, slideName);
      });
    } else {
      buildPistol(holder, 'gunSlide');
    }

    // ═════════════════════ 10. RIFLE / SMG (and Photon Gatling) ═════════════════════
  } else if (weapon.modelType === 'rifle') {
    const isGatling = weapon.id === 'heavy_photon_gatling';
    // receiver: upper + lower with seam, ejection port, charging handle
    put(holder, M(rb(0.075, 0.085, 0.62, 0.012), gunMat), 0, 0.03, -0.15);
    put(holder, M(rb(0.07, 0.07, 0.4, 0.01), frameMat), 0, -0.045, -0.06);
    put(holder, M(new THREE.BoxGeometry(0.078, 0.004, 0.6), rubberMat), 0, -0.012, -0.15);
    put(holder, M(new THREE.BoxGeometry(0.003, 0.03, 0.1), rubberMat), 0.038, 0.04, -0.05); // ejection port
    put(holder, M(rb(0.02, 0.02, 0.05, 0.004), steelMat), -0.03, 0.065, 0.1, 'chargingHandle'); // charging handle (pulled by the reload)
    glowBox(holder, 0.004, 0.012, 0.28, 0.039, 0.01, -0.16);
    glowBox(holder, 0.004, 0.012, 0.28, -0.039, 0.01, -0.16);
    // pistol grip + trigger guard
    const pg = put(holder, M(rb(0.045, 0.12, 0.06, 0.01), rubberMat), 0, -0.14, 0.08);
    pg.rotation.x = -0.3;
    triggerGuard(holder, -0.105, -0.05, 0.04);
    // handguard with M-LOK slots + vents
    put(holder, M(rb(0.08, 0.11, 0.35, 0.014), gunMat), 0, 0.01, -0.45);
    for (let i = 0; i < 6; i++) {
      put(holder, M(new THREE.BoxGeometry(0.003, 0.02, 0.028), rubberMat), 0.0405, 0.005, -0.32 - i * 0.05);
      put(holder, M(new THREE.BoxGeometry(0.003, 0.02, 0.028), rubberMat), -0.0405, 0.005, -0.32 - i * 0.05);
    }
    for (let i = 0; i < 5; i++) put(holder, M(new THREE.BoxGeometry(0.04, 0.003, 0.02), rubberMat), 0, 0.0655, -0.34 - i * 0.055);
    glowBox(holder, 0.004, 0.012, 0.25, 0.0415, -0.03, -0.45);
    glowBox(holder, 0.004, 0.012, 0.25, -0.0415, -0.03, -0.45);
    put(holder, M(rb(0.04, 0.03, 0.08, 0.008), frameMat), 0, -0.065, -0.5); // fore-grip stub

    if (isGatling) {
      // rotary barrel cluster
      put(holder, M(cylZ(0.05, 0.05, 0.1, 18), steelMat), 0, 0.01, -0.67);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        put(holder, M(cylZ(0.011, 0.011, 0.42, 8), gunMat), Math.cos(a) * 0.035, 0.01 + Math.sin(a) * 0.035, -0.56);
        put(holder, M(cylZ(0.014, 0.014, 0.02, 8), energyMat), Math.cos(a) * 0.035, 0.01 + Math.sin(a) * 0.035, -0.775);
      }
      [-0.42, -0.58, -0.74].forEach((zz) => put(holder, M(ringZ(0.05, 0.007, 18), steelMat), 0, 0.01, zz));
      put(holder, M(ringZ(0.05, 0.012, 18), glowMat), 0, 0.01, -0.775);
    } else {
      // barrel with fluting, flash-hider + glowing coil
      put(holder, M(cylZ(0.022, 0.022, 0.42, 14), steelMat), 0, 0.01, -0.58);
      for (let i = 0; i < 3; i++) put(holder, M(ringZ(0.026, 0.005, 14), frameMat), 0, 0.01, -0.5 - i * 0.07);
      put(holder, M(cylZ(0.03, 0.026, 0.07, 12), gunMat), 0, 0.01, -0.8);
      for (let i = 0; i < 3; i++) put(holder, M(new THREE.BoxGeometry(0.066, 0.006, 0.014), rubberMat), 0, 0.01, -0.78 - i * 0.02);
      put(holder, M(ringZ(0.027, 0.006, 14), energyMat), 0, 0.01, -0.44);
      put(holder, M(ringZ(0.027, 0.016, 14), glowMat), 0, 0.01, -0.44);
    }

    // magazine (name kept; coloured indicator strip + dark body)
    const mag = new THREE.Group();
    put(mag, M(rb(0.06, 0.22, 0.09, 0.012), gunMat), 0, 0, 0);
    put(mag, M(rb(0.064, 0.02, 0.095, 0.006), steelMat), 0, -0.1, 0);
    glowBox(mag, 0.004, 0.14, 0.05, 0.031, 0.0, 0);
    glowBox(mag, 0.004, 0.14, 0.05, -0.031, 0.0, 0);
    mag.rotation.x = 0.2;
    put(holder, mag, 0, -0.16, -0.12, 'gunMag');
    // top rail + holographic sight (original ADS position)
    topRail(holder, 0.45, 0, 0.082, -0.2);
    glowBox(holder, 0.03, 0.004, 0.4, 0, 0.1, -0.2);
    reflexSight(holder, 0, 0.1, -0.22);
    addReloadHand(holder);

    // ═════════════════════ 11. SHOTGUN ═════════════════════
  } else if (weapon.modelType === 'shotgun') {
    put(holder, M(rb(0.085, 0.15, 0.58, 0.016), gunMat), 0, 0, -0.12);
    put(holder, M(rb(0.078, 0.05, 0.3, 0.01), frameMat), 0, 0.085, -0.1); // top cover
    put(holder, M(new THREE.BoxGeometry(0.003, 0.05, 0.12), rubberMat), 0.0435, 0.01, -0.05); // ejection port
    glowBox(holder, 0.004, 0.012, 0.3, 0.0435, -0.04, -0.12);
    glowBox(holder, 0.004, 0.012, 0.3, -0.0435, -0.04, -0.12);
    // pistol grip + trigger guard
    const pg = put(holder, M(rb(0.05, 0.14, 0.07, 0.012), rubberMat), 0, -0.13, 0.08);
    pg.rotation.x = -0.28;
    triggerGuard(holder, -0.095, -0.07, 0.03);
    // barrel with heat shroud (vents) and under-barrel tube magazine
    put(holder, M(cylZ(0.026, 0.026, 0.55, 14), steelMat), 0, 0.02, -0.55);
    put(holder, M(cylZ(0.034, 0.034, 0.3, 14), gunMat), 0, 0.02, -0.46);
    for (let i = 0; i < 6; i++) put(holder, M(new THREE.BoxGeometry(0.072, 0.008, 0.016), rubberMat), 0, 0.02, -0.34 - i * 0.045);
    put(holder, M(cylZ(0.016, 0.016, 0.45, 10), frameMat), 0, -0.04, -0.48);
    put(holder, M(cylZ(0.034, 0.03, 0.05, 12), gunMat), 0, 0.02, -0.83); // choke / muzzle
    put(holder, M(ringZ(0.028, 0.005, 14), energyMat), 0, 0.02, -0.78);
    put(holder, M(ringZ(0.028, 0.016, 14), glowMat), 0, 0.02, -0.78);
    // Pump forend (animated by name — origin must stay at (0,-0.03,-0.42)); ribbed with glow bands
    const pump = new THREE.Group();
    put(pump, M(cylZ(0.042, 0.042, 0.26, 16), frameMat), 0, 0, 0);
    for (let i = 0; i < 6; i++) put(pump, M(cylZ(0.0445, 0.0445, 0.012, 16), rubberMat), 0, 0, -0.1 + i * 0.04);
    put(pump, M(cylZ(0.0455, 0.0455, 0.014, 16), energyMat), 0, 0, -0.13);
    put(pump, M(cylZ(0.0455, 0.0455, 0.014, 16), energyMat), 0, 0, 0.13);
    put(holder, pump, 0, -0.03, -0.42, 'pumpForend');
    // shell thumbed into the loading port during the reload (hidden otherwise)
    const shell = new THREE.Group();
    put(shell, M(cylZ(0.014, 0.014, 0.05, 10), gunMat), 0, 0, 0);
    put(shell, M(cylZ(0.015, 0.015, 0.012, 10), energyMat), 0, 0, 0.03);
    put(shell, M(cylZ(0.0145, 0.0145, 0.018, 10), steelMat), 0, 0, -0.03);
    shell.visible = false;
    put(holder, shell, 0, -0.08, -0.04, 'reloadShell');
    addReloadHand(holder);
    // front bead + rear notch
    glowSphere(holder, 0.012, 0, 0.075, -0.75);
    put(holder, M(rb(0.04, 0.02, 0.03, 0.005), gunMat), 0, 0.1, -0.02);

    // ═════════════════════ 12. DYNAMITE BUNDLE ═════════════════════
  } else if (weapon.id === 'heavy_sentry') {
    // VOLT SENTRY: 畳まれたタレットを片手で持つ (投げて設置する)
    const sentry = foldedTurretMesh();
    sentry.scale.setScalar(1.25);
    sentry.rotation.x = -0.4;
    holder.add(sentry);
  } else if (weapon.modelType === 'dynamite') {
    const dynGroup = new THREE.Group();
    const paperMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, metalness: 0.15, roughness: 0.55 });
    const tapeMat = new THREE.MeshStandardMaterial({ color: 0xe5d9b6, metalness: 0.0, roughness: 0.85 });
    const positions: Array<[number, number]> = [
      [-0.035, -0.03],
      [0.035, -0.03],
      [0, 0.035],
    ];
    positions.forEach(([px, pz]) => {
      put(dynGroup, M(new THREE.CylinderGeometry(0.04, 0.04, 0.42, 16), paperMat), px, 0, pz);
      put(dynGroup, M(new THREE.CylinderGeometry(0.041, 0.041, 0.05, 16), tapeMat), px, 0.12, pz);
      put(dynGroup, M(new THREE.CylinderGeometry(0.041, 0.041, 0.05, 16), tapeMat), px, -0.12, pz);
      put(dynGroup, M(new THREE.CylinderGeometry(0.035, 0.035, 0.012, 16), steelMat), px, 0.216, pz);
      put(dynGroup, M(new THREE.CylinderGeometry(0.035, 0.035, 0.012, 16), steelMat), px, -0.216, pz);
    });
    // metal straps
    [0.06, -0.06].forEach((yy) => put(dynGroup, M(new THREE.CylinderGeometry(0.085, 0.085, 0.022, 20), gunMat), 0, yy, 0.0));
    // wired detonator box with LED + antenna
    put(dynGroup, M(rb(0.075, 0.075, 0.075, 0.012), gunMat), 0, 0.05, 0.08);
    glowBox(dynGroup, 0.05, 0.016, 0.004, 0, 0.065, 0.12);
    put(dynGroup, M(rb(0.04, 0.012, 0.004, 0.002), lensMat), 0, 0.04, 0.12);
    put(dynGroup, M(new THREE.CylinderGeometry(0.004, 0.004, 0.08, 6), steelMat), 0.03, 0.12, 0.08);
    // fuse wire + spark
    const fuse = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.216, 0.0),
      new THREE.Vector3(0.02, 0.26, 0.02),
      new THREE.Vector3(-0.01, 0.3, 0.0),
    ]);
    put(dynGroup, M(new THREE.TubeGeometry(fuse, 10, 0.004, 5, false), rubberMat), 0, 0, 0);
    glowSphere(dynGroup, 0.01, -0.01, 0.305, 0.0);
    holder.add(dynGroup);

    // ═════════════════════ 13. HYDRA MISSILE POD ═════════════════════
  } else if (weapon.id === 'heavy_hydra_missile') {
    put(holder, M(rb(0.18, 0.14, 0.45, 0.02), gunMat), 0, 0, -0.2);
    put(holder, M(rb(0.19, 0.03, 0.4, 0.008), frameMat), 0, 0.085, -0.2);
    [-1, 1].forEach((s) => {
      put(holder, M(rb(0.012, 0.1, 0.38, 0.006), frameMat), s * 0.096, 0, -0.2);
      glowBox(holder, 0.004, 0.012, 0.3, s * 0.103, -0.03, -0.2);
    });
    ribsZ(holder, 5, 0.06, 0.1, 0.004, 0.014, 0, 0.1, -0.08, rubberMat);
    const tubeOffsets: Array<[number, number]> = [
      [-0.05, 0.03],
      [0.0, 0.03],
      [0.05, 0.03],
      [-0.05, -0.03],
      [0.0, -0.03],
      [0.05, -0.03],
    ];
    tubeOffsets.forEach(([ox, oy]) => {
      put(holder, M(cylZ(0.018, 0.018, 0.42, 12), steelMat), ox, oy, -0.2);
      put(holder, M(cylZ(0.022, 0.022, 0.03, 12), frameMat), ox, oy, -0.41);
      put(holder, M(coneZ(0.015, 0.06, 10), energyMat), ox, oy, -0.42);
      put(holder, M(coneZ(0.024, 0.07, 10), glowMat), ox, oy, -0.42);
      put(holder, M(ringZ(0.019, 0.004, 12), gunMat), ox, oy, 0.0);
    });
    // rear exhaust shroud + grip + trigger guard + sensor pod
    put(holder, M(rb(0.17, 0.12, 0.05, 0.01), frameMat), 0, 0, 0.04);
    const grip = put(holder, M(rb(0.05, 0.2, 0.08, 0.012), rubberMat), 0, -0.15, -0.08);
    grip.rotation.x = -0.15;
    put(holder, M(rb(0.02, 0.014, 0.1, 0.004), steelMat), 0, -0.085, -0.18);
    put(holder, M(rb(0.05, 0.04, 0.09, 0.008), gunMat), 0, 0.12, -0.3);
    put(holder, M(new THREE.BoxGeometry(0.036, 0.026, 0.004), lensMat), 0, 0.12, -0.347);

    // ═════════════════════ 14. SOLAR FLARE CANNON ═════════════════════
  } else if (weapon.id === 'heavy_solar_cannon') {
    put(holder, M(rb(0.12, 0.16, 0.72, 0.02), gunMat), 0, 0, -0.2);
    put(holder, M(rb(0.13, 0.03, 0.5, 0.01), frameMat), 0, 0.095, -0.15);
    for (let i = 0; i < 5; i++) put(holder, M(new THREE.BoxGeometry(0.124, 0.014, 0.02), rubberMat), 0, -0.07, -0.0 - i * 0.08);
    // solar reactor: sphere + containment cage + halos
    glowSphere(holder, 0.065, 0, 0.02, -0.15);
    [0, Math.PI / 2, Math.PI / 4].forEach((rot) => {
      const r = put(holder, M(new THREE.TorusGeometry(0.095, 0.008, 6, 24), steelMat), 0, 0.02, -0.15);
      r.rotation.y = rot;
    });
    // golden guide rails with insulator rings
    [0.05, -0.05].forEach((sx) => {
      put(holder, M(rb(0.025, 0.025, 0.58, 0.006), steelMat), sx, 0.02, -0.45);
      for (let i = 0; i < 5; i++) put(holder, M(rb(0.036, 0.036, 0.014, 0.004), frameMat), sx, 0.02, -0.25 - i * 0.12);
    });
    // focusing torus + emitter lens
    put(holder, M(new THREE.TorusGeometry(0.07, 0.015, 10, 24), energyMat), 0, 0.02, -0.72);
    put(holder, M(new THREE.TorusGeometry(0.07, 0.04, 8, 24), glowMat), 0, 0.02, -0.72);
    put(holder, M(new THREE.TorusGeometry(0.052, 0.008, 6, 24), steelMat), 0, 0.02, -0.68);
    put(holder, M(new THREE.CircleGeometry(0.045, 20), glowMat), 0, 0.02, -0.74);
    // handle + trigger guard
    const grip = put(holder, M(rb(0.05, 0.18, 0.08, 0.012), rubberMat), 0, -0.15, 0.0);
    grip.rotation.x = -0.15;
    put(holder, M(rb(0.02, 0.014, 0.1, 0.004), steelMat), 0, -0.09, -0.08);
    put(holder, M(rb(0.045, 0.03, 0.12, 0.006), gunMat), 0, 0.12, -0.12);
    put(holder, M(new THREE.BoxGeometry(0.03, 0.02, 0.004), lensMat), 0, 0.12, -0.06);

    // ═════════════════════ 15. GRAVITY LAUNCHER ═════════════════════
  } else if (weapon.modelType === 'launcher') {
    put(holder, M(cylZ(0.065, 0.07, 0.72, 20), gunMat), 0, 0.02, -0.32);
    [-0.1, -0.26, -0.42, -0.58].forEach((zz) => put(holder, M(cylZ(0.072, 0.072, 0.018, 20), steelMat), 0, 0.02, zz));
    put(holder, M(cylZ(0.074, 0.074, 0.05, 20), frameMat), 0, 0.02, 0.05); // breech
    put(holder, M(cylZ(0.06, 0.095, 0.1, 18), steelMat), 0, 0.02, 0.1); // rear exhaust funnel
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      put(holder, M(new THREE.BoxGeometry(0.01, 0.01, 0.1), rubberMat), Math.cos(a) * 0.07, 0.02 + Math.sin(a) * 0.07, -0.34);
    }
    put(holder, M(new THREE.TorusGeometry(0.072, 0.016, 10, 24), energyMat), 0, 0.02, -0.68);
    put(holder, M(new THREE.TorusGeometry(0.072, 0.04, 8, 24), glowMat), 0, 0.02, -0.68);
    put(holder, M(coneZ(0.045, 0.12, 12), energyMat), 0, 0.02, -0.64);
    glowBox(holder, 0.006, 0.006, 0.3, 0, 0.088, -0.3);
    // grip, trigger guard, carry handle
    const grip = put(holder, M(rb(0.06, 0.22, 0.1, 0.014), rubberMat), 0, -0.14, -0.1);
    grip.rotation.x = -0.12;
    put(holder, M(rb(0.02, 0.014, 0.12, 0.004), steelMat), 0, -0.05, -0.2);
    put(holder, M(rb(0.04, 0.04, 0.16, 0.008), frameMat), 0, -0.07, -0.34);
    // sight box + screen
    put(holder, M(rb(0.05, 0.06, 0.12, 0.01), gunMat), -0.08, 0.11, -0.25);
    put(holder, M(new THREE.BoxGeometry(0.035, 0.04, 0.005), energyMat), -0.08, 0.11, -0.19);
    put(holder, M(rb(0.02, 0.04, 0.04, 0.005), frameMat), -0.05, 0.075, -0.25);

    // ═════════════════════ 16. RAILGUN / SNIPER ═════════════════════
  } else {
    put(holder, M(rb(0.09, 0.18, 0.75, 0.016), gunMat), 0, 0, -0.2);
    put(holder, M(rb(0.094, 0.05, 0.5, 0.01), frameMat), 0, 0.1, -0.12);
    for (let i = 0; i < 6; i++) put(holder, M(new THREE.BoxGeometry(0.096, 0.012, 0.02), rubberMat), 0, 0.0, 0.04 - i * 0.05);
    // twin accelerator rails with insulator blocks and capacitor coils
    [-0.035, 0.035].forEach((sx) => {
      glowBox(holder, 0.025, 0.025, 0.65, sx, 0.03, -0.55);
      for (let i = 0; i < 6; i++) put(holder, M(rb(0.04, 0.04, 0.016, 0.004), frameMat), sx, 0.03, -0.3 - i * 0.1);
    });
    for (let i = 0; i < 3; i++) {
      put(holder, M(ringZ(0.06, 0.012, 20), energyMat), 0, 0.03, -0.35 - i * 0.18);
      put(holder, M(ringZ(0.06, 0.03, 20), glowMat), 0, 0.03, -0.35 - i * 0.18);
    }
    put(holder, M(cylZ(0.03, 0.03, 0.1, 14), steelMat), 0, 0.03, -0.9); // muzzle brake
    for (let i = 0; i < 3; i++) put(holder, M(new THREE.BoxGeometry(0.07, 0.008, 0.014), rubberMat), 0, 0.03, -0.87 - i * 0.025);
    // sniper scope: tube, bell, eyepiece, turrets, mounts
    put(holder, M(cylZ(0.04, 0.04, 0.45, 18), gunMat), 0, 0.14, -0.2);
    put(holder, M(cylZ(0.052, 0.04, 0.1, 18), frameMat), 0, 0.14, -0.4); // objective bell
    put(holder, M(new THREE.CylinderGeometry(0.014, 0.014, 0.03, 10), steelMat), 0, 0.185, -0.2); // elevation turret
    const wind = put(holder, M(new THREE.CylinderGeometry(0.014, 0.014, 0.03, 10), steelMat), 0.045, 0.14, -0.2);
    wind.rotation.z = Math.PI / 2;
    [-0.32, -0.08].forEach((zz) => put(holder, M(rb(0.05, 0.06, 0.03, 0.006), steelMat), 0, 0.1, zz));
    put(holder, M(ringZ(0.045, 0.006, 18), energyMat), 0, 0.14, -0.45);
    // scope lens (faces the shooter, original position)
    put(holder, M(new THREE.CircleGeometry(0.036, 16), lensMat), 0, 0.14, 0.03);
    put(holder, M(new THREE.RingGeometry(0.036, 0.046, 18), lensFrameMat), 0, 0.14, 0.031);
    put(holder, M(cylZ(0.046, 0.046, 0.012, 18), frameMat), 0, 0.14, 0.022); // eyepiece rim
    // grip + trigger guard
    const grip = put(holder, M(rb(0.05, 0.16, 0.07, 0.012), rubberMat), 0, -0.15, 0.1);
    grip.rotation.x = -0.25;
    put(holder, M(rb(0.02, 0.014, 0.1, 0.004), steelMat), 0, -0.1, 0.02);
  }

  // Launchers / railguns: energy cell that is ejected and replaced during the reload (hidden otherwise)
  if (weapon.modelType === 'launcher' || weapon.modelType === 'railgun') {
    const cellZ = weapon.id === 'heavy_hydra_missile' ? -0.2 : weapon.id === 'heavy_solar_cannon' ? -0.3 : weapon.modelType === 'launcher' ? -0.4 : -0.3;
    const cell = new THREE.Group();
    put(cell, M(new THREE.CylinderGeometry(0.032, 0.032, 0.12, 14), gunMat), 0, 0, 0);
    put(cell, M(new THREE.CylinderGeometry(0.0345, 0.0345, 0.016, 14), steelMat), 0, -0.058, 0);
    put(cell, M(new THREE.CylinderGeometry(0.0345, 0.0345, 0.016, 14), steelMat), 0, 0.058, 0);
    put(cell, M(new THREE.CylinderGeometry(0.0345, 0.0345, 0.04, 14), energyMat), 0, 0, 0);
    put(cell, M(new THREE.CylinderGeometry(0.05, 0.05, 0.06, 14), glowMat), 0, 0, 0);
    cell.visible = false;
    put(holder, cell, 0, 0, cellZ, 'heavyCell');
    addReloadHand(holder);
  }

  // Weapon-specific attachments so weapons sharing a chassis still look distinct
  applyWeaponVariant(holder, weapon);
}
