import * as THREE from 'three';
import { createRig, EnemyRig } from './enemyAnimation';
import { panelTexture } from './bossModels';
import { kit, damp, EliteStats } from './eliteEnemyModels';

/**
 * APEX roster — ten enemies that each break one habit the player has formed against the older roster,
 * plus the three minions some of them create. Same build quality as the elite roster (bevelled panelled
 * armour, lathe / extruded parts, layered emissive trims) and each has a dedicated animator (`rig.custom`)
 * that reads the AI's action cue (`rig.act`).
 *
 *   aegis     AEGIS WARDEN      盾重装機       — slow-turning tower shield blocks shots from the front; flank it
 *   ronin     RONIN EDGE        機械侍         — iai dash across a telegraphed lane; spinning blade reflects bullets
 *   pyro      CINDER MAW        火炎放射機     — flame cone + burning floor patches (area denial)
 *   weaver    ARC WEAVER        電磁蜘蛛       — plants tesla pylons and links them with jumpable electric fences
 *   spotter   ORBITAL SPOTTER   軌道観測機     — flying; paints the player with a laser, then calls an orbital strike
 *   splitter  MERCURY SPLITTER  分裂液体金属   — leaping slime of liquid metal; splits in two when destroyed
 *   chrono    CHRONO REVERSER   時間逆行機     — slow fields; rewinds its own damage unless interrupted
 *   mirage    MIRAGE CASTER     幻影投影機     — projects holographic decoys and swaps places with them
 *   magnet    MAGNETAR          磁力機         — drags the player in, then detonates a magnetic nova
 *   berserker RAGE BERSERKER    狂戦機         — the lower its HP, the faster and harder it hits; cyclone + leap slam
 *
 *   pylon         TESLA PYLON   (weaver)   — stationary fence anchor
 *   splitling     SPLITLING     (splitter) — small blob (hound AI)
 *   mirage_echo   MIRAGE ECHO   (mirage)   — fragile hologram of the caster
 *
 * Every model faces -Z with its feet on y = 0 (the flying spotter is centred on its origin).
 */

export const APEX_TYPES = ['aegis', 'ronin', 'pyro', 'weaver', 'spotter', 'splitter', 'chrono', 'mirage', 'magnet', 'berserker', 'pylon', 'splitling', 'mirage_echo'] as const;
export type ApexType = (typeof APEX_TYPES)[number];
export const isApexType = (t: string): t is ApexType => (APEX_TYPES as readonly string[]).includes(t);

// ───────────────────────── AEGIS WARDEN ─────────────────────────
function buildAegis(root: THREE.Group, rig: EnemyRig): EliteStats {
  const K = kit();
  const { armor, solid, emis, glow, halo, rbox, cyl, sph, cone, torus, V, mk, grp, artic } = K;
  const body = new THREE.Group();
  root.add(body);
  rig.body = body;
  const plate = armor(0x3b4a5e, panelTexture('#253041', '#a5b4c8', 4), 0.6, 0.35, 0.9);
  const gold = armor(0xc9a24a, panelTexture('#7a5a14', '#fde68a', 3), 0.8, 0.3, 0.8);
  const dark = solid(0x0b1018, 0.6, 0.45);
  const steel = solid(0xb8c2d0, 0.9, 0.2);
  const cyan = glow(0x67e8f9);

  // legs (heavy, planted)
  [-1, 1].forEach((s) => {
    const j = artic(root, V(s * 0.38, 1.45, 0.05), V(s * 0.46, 0.78, -0.12), V(s * 0.44, 0.08, 0.02), 0.16, 0.13, plate, dark, 0.15, steel);
    j.onLow(rbox(0.38, 0.16, 0.6, 0.05), plate, s * 0.44, 0.08, -0.06);
    j.onUp(rbox(0.36, 0.42, 0.3, 0.06), plate, s * 0.42, 1.12, -0.12);
    j.onLow(rbox(0.26, 0.24, 0.12, 0.04), gold, s * 0.46, 0.8, -0.24);
    rig.legs.push({ up: j.up, low: j.low, phase: s > 0 ? 0 : Math.PI, amp: 0.6 });
  });
  // torso + pauldrons
  mk(body, rbox(1.0, 0.5, 0.7, 0.12), dark, 0, 1.55, 0);
  mk(body, rbox(1.25, 0.95, 0.85, 0.16), plate, 0, 2.15, 0);
  mk(body, rbox(0.7, 0.5, 0.12, 0.05), gold, 0, 2.25, -0.46);
  mk(body, rbox(0.5, 0.06, 0.13, 0.02), cyan, 0, 2.05, -0.47);
  [-1, 1].forEach((s) => {
    const p = mk(body, sph(0.42, 18), plate, s * 0.78, 2.55, 0);
    p.scale.set(1, 0.7, 1.1);
    mk(body, torus(0.38, 0.04, 28, 6), gold, s * 0.78, 2.45, 0, Math.PI / 2, 0, 0);
  });
  // helm with a single visor slit and crest
  const head = grp(body, 0, 2.85, -0.05);
  rig.head = head;
  mk(head, rbox(0.46, 0.5, 0.5, 0.14), plate);
  mk(head, rbox(0.4, 0.05, 0.06, 0.02), cyan, 0, 0.02, -0.25);
  mk(head, sph(0.12, 10), halo(0x67e8f9, 0.35), 0, 0.02, -0.26);
  mk(head, rbox(0.08, 0.3, 0.55, 0.03), gold, 0, 0.32, 0.02);
  // shield arm (left) — tower shield with an energy hex plate in front
  const shieldArm = grp(body, -0.7, 2.3, -0.2);
  mk(shieldArm, cyl(0.13, 0.11, 0.7, 10), dark, 0, -0.3, 0);
  const shield = grp(shieldArm, 0.35, -0.55, -0.55);
  mk(shield, rbox(1.35, 2.1, 0.16, 0.06), plate);
  mk(shield, rbox(1.45, 0.12, 0.2, 0.04), gold, 0, 1.02, 0);
  mk(shield, rbox(1.45, 0.12, 0.2, 0.04), gold, 0, -1.02, 0);
  mk(shield, rbox(0.12, 2.0, 0.2, 0.04), gold, 0, 0, -0.01);
  mk(shield, cyl(0.26, 0.26, 0.08, 6), gold, 0, 0.15, -0.1, Math.PI / 2, 0, 0);
  mk(shield, sph(0.12, 10), cyan, 0, 0.15, -0.15);
  const field = mk(shield, new THREE.PlaneGeometry(1.9, 2.5, 1, 1), halo(0x67e8f9, 0.16), 0, 0.05, -0.24);
  const hex = new THREE.Group();
  shield.add(hex);
  hex.position.set(0, 0.05, -0.25);
  for (let q = -2; q <= 2; q++) {
    for (let r = -3; r <= 3; r++) {
      const cell = new THREE.Mesh(new THREE.RingGeometry(0.15, 0.17, 6), halo(0x67e8f9, 0.5));
      cell.position.set(q * 0.3, r * 0.34 + (q % 2 ? 0.17 : 0), 0);
      cell.rotation.z = Math.PI / 6;
      hex.add(cell);
    }
  }
  // weapon arm (right) — shock mace
  const maceArm = artic(body, V(0.78, 2.45, 0), V(0.92, 1.85, -0.15), V(0.86, 1.4, -0.6), 0.13, 0.11, plate, dark, 0.14, steel);
  const mace = maceArm.onLow(cyl(0.05, 0.05, 1.1, 8), steel, 0.86, 1.6, -0.9, Math.PI / 2 + 0.3, 0, 0);
  void mace;
  maceArm.onLow(sph(0.2, 14), dark, 0.86, 1.78, -1.38);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    maceArm.onLow(cone(0.05, 0.16, 5), steel, 0.86 + Math.cos(a) * 0.2, 1.78 + Math.sin(a) * 0.2, -1.38, 0, 0, a - Math.PI / 2);
  }
  maceArm.onLow(sph(0.12, 10), cyan, 0.86, 1.78, -1.38);
  rig.arms.push({ up: maceArm.up, low: maceArm.low, phase: 0, amp: 0.3 });

  rig.gait = { freq: 0.75, swing: 0.45, knee: 0.5, bob: 0.06, lean: 0.03 };
  rig.lunge = 0.3;
  rig.extras = { shieldArm, shield, field, hex, brace: 0, bash: 0, emit: field };
  rig.custom = (r, time, dt) => {
    const E = r.extras;
    const a = r.act;
    E.brace = damp(E.brace, a.name === 'brace' || a.name === 'bash' ? 1 : 0.35, 6, dt);
    E.bash = damp(E.bash, a.name === 'bash' ? a.k : 0, 12, dt);
    const sa = E.shieldArm as THREE.Object3D;
    sa.position.x = -0.7 + E.brace * 0.25;
    sa.position.z = -0.2 - E.brace * 0.25 - E.bash * 0.5;
    sa.rotation.y = E.brace * 0.35;
    (E.hex as THREE.Object3D).rotation.z = Math.sin(time * 1.3) * 0.05;
    E.blockFlash = Math.max(0, (E.blockFlash ?? 0) - dt * 4);
    const fieldMat = (E.field as THREE.Mesh).material as THREE.MeshBasicMaterial;
    fieldMat.opacity = 0.08 + E.brace * 0.14 + E.blockFlash * 0.45;
    (E.hex as THREE.Object3D).scale.setScalar(1 + E.blockFlash * 0.06);
    if (r.body) r.body.position.y -= E.brace * 0.12;
  };
  return { hp: 640, speed: 2.5, damage: 30 };
}

// ───────────────────────── RONIN EDGE ─────────────────────────
function buildRonin(root: THREE.Group, rig: EnemyRig): EliteStats {
  const K = kit();
  const { armor, solid, emis, glow, halo, rbox, cyl, sph, cone, torus, V, mk, grp, artic, blade } = K;
  const body = new THREE.Group();
  root.add(body);
  rig.body = body;
  const lacquer = armor(0x5b0f1a, panelTexture('#3a0a10', '#fda4af', 5), 0.4, 0.35, 1);
  const black = armor(0x15161c, panelTexture('#0b0c10', '#64748b', 4), 0.5, 0.4, 0.8);
  const dark = solid(0x07080b, 0.5, 0.5);
  const steel = solid(0xe2e8f0, 0.95, 0.08);
  const edge = glow(0xfda4af);

  [-1, 1].forEach((s) => {
    const j = artic(root, V(s * 0.2, 1.1, 0), V(s * 0.26, 0.6, -0.14), V(s * 0.24, 0.05, 0.05), 0.08, 0.065, black, dark, 0.08, lacquer);
    j.onLow(rbox(0.18, 0.08, 0.36, 0.03), black, s * 0.24, 0.05, -0.04);
    j.onUp(rbox(0.26, 0.42, 0.06, 0.02), lacquer, s * 0.26, 0.9, -0.16, -0.2, 0, 0); // haidate
    rig.legs.push({ up: j.up, low: j.low, phase: s > 0 ? 0 : Math.PI, amp: 0.85 });
  });
  mk(body, rbox(0.46, 0.3, 0.32, 0.08), dark, 0, 1.2, 0);
  mk(body, rbox(0.56, 0.62, 0.38, 0.12), lacquer, 0, 1.62, 0);
  for (let i = 0; i < 3; i++) mk(body, rbox(0.6, 0.05, 0.4, 0.02), black, 0, 1.4 + i * 0.16, 0);
  [-1, 1].forEach((s) => {
    mk(body, rbox(0.34, 0.08, 0.36, 0.03), lacquer, s * 0.4, 1.9, 0, 0, 0, -s * 0.45); // sode
  });
  // tattered cape
  const cape = grp(body, 0, 1.92, 0.22);
  for (let i = 0; i < 4; i++) {
    const strip = mk(cape, new THREE.PlaneGeometry(0.2, 1.1), new THREE.MeshStandardMaterial({ color: 0x2a0a10, side: THREE.DoubleSide, roughness: 0.9 }), -0.3 + i * 0.2, -0.55, 0);
    rig.flutters.push({ obj: strip, phase: i * 0.8, amp: 1.4, speed: 1.4 });
  }
  // head: mask + kasa hat
  const head = grp(body, 0, 2.1, -0.02);
  rig.head = head;
  mk(head, rbox(0.24, 0.28, 0.24, 0.08), black);
  mk(head, rbox(0.2, 0.04, 0.03, 0.01), edge, 0, 0.03, -0.12);
  const hat = mk(head, cone(0.55, 0.22, 24), lacquer, 0, 0.22, 0);
  hat.scale.y = 0.9;
  mk(head, torus(0.53, 0.015, 32, 6), edge, 0, 0.12, 0, Math.PI / 2, 0, 0);
  // sword arm + katana; scabbard on the left hip
  const arm = artic(body, V(0.32, 1.88, 0), V(0.42, 1.48, -0.2), V(0.18, 1.3, -0.45), 0.065, 0.055, lacquer, black, 0.07, steel);
  const sword = new THREE.Group();
  arm.low.add(sword);
  sword.position.set(0.18 - 0.42, 1.3 - 1.48, -0.45 + 0.2);
  mk(sword, cyl(0.025, 0.025, 0.3, 8), dark, 0, 0, 0, Math.PI / 2, 0, 0);
  mk(sword, rbox(0.12, 0.03, 0.1, 0.01), steel, 0, 0, -0.16);
  const bladeG = grp(sword, 0, 0, -0.17);
  const bl = mk(bladeG, blade(1.1, 0.07, 0.02, -0.06), steel, 0, 0, 0, -Math.PI / 2, 0, 0);
  void bl;
  mk(bladeG, new THREE.BoxGeometry(0.008, 0.012, 1.0), edge, 0, -0.03, -0.52);
  const spinDisc = mk(bladeG, new THREE.RingGeometry(0.2, 1.15, 40), halo(0xfda4af, 0.0), 0, 0, -0.1, 0, 0, 0);
  spinDisc.visible = false;
  mk(body, cyl(0.035, 0.03, 0.95, 8), black, -0.28, 1.25, 0.05, 1.2, 0.4, 0);
  rig.arms.push({ up: arm.up, low: arm.low, phase: 0, amp: 0.3 });

  rig.gait = { freq: 1.25, swing: 0.6, knee: 0.75, bob: 0.04, lean: 0.07 };
  rig.lunge = 0.45;
  rig.extras = { sword, bladeG, spinDisc, armUp: arm.up, stance: 0, dash: 0, emit: sword };
  rig.custom = (r, time, dt) => {
    const E = r.extras;
    const a = r.act;
    E.stance = damp(E.stance, a.name === 'stance' ? a.k : 0, 10, dt);
    E.dash = damp(E.dash, a.name === 'dash' ? 1 : 0, 20, dt);
    const deflect = a.name === 'deflect';
    const up = E.armUp as THREE.Object3D;
    if (deflect) {
      up.rotation.x = 1.3;
      (E.bladeG as THREE.Object3D).rotation.z += dt * 38;
    } else {
      up.rotation.x = -0.4 * E.stance + 1.5 * E.dash;
      (E.bladeG as THREE.Object3D).rotation.z = damp((E.bladeG as THREE.Object3D).rotation.z % (Math.PI * 2), 0, 12, dt);
    }
    const disc = E.spinDisc as THREE.Mesh;
    disc.visible = deflect;
    (disc.material as THREE.MeshBasicMaterial).opacity = deflect ? 0.28 + Math.sin(time * 30) * 0.06 : 0;
    if (r.body) {
      r.body.position.y -= E.stance * 0.3;
      r.body.rotation.x += E.stance * 0.25 + E.dash * 0.35;
      r.body.rotation.y = -E.stance * 0.5;
    }
  };
  return { hp: 300, speed: 5.2, damage: 26 };
}

// ───────────────────────── CINDER MAW ─────────────────────────
function buildPyro(root: THREE.Group, rig: EnemyRig): EliteStats {
  const K = kit();
  const { armor, solid, emis, glow, halo, rbox, cyl, sph, cone, torus, lathe, V, mk, grp, artic, tube } = K;
  const body = new THREE.Group();
  root.add(body);
  rig.body = body;
  const iron = armor(0x4a2c1a, panelTexture('#2a170c', '#f59e0b', 4, true), 0.5, 0.45, 0.6);
  const soot = solid(0x16110d, 0.4, 0.7);
  const brass = solid(0xb7791f, 0.85, 0.3);
  const fire = glow(0xff7a1a);
  const hot = emis(0x7c2d12, 0xff5a1f, 1.4);

  [-1, 1].forEach((s) => {
    const j = artic(root, V(s * 0.45, 1.15, 0.1), V(s * 0.62, 0.6, -0.2), V(s * 0.6, 0.06, 0.1), 0.15, 0.12, iron, soot, 0.14, brass);
    j.onLow(rbox(0.42, 0.14, 0.6, 0.05), iron, s * 0.6, 0.07, 0.0);
    rig.legs.push({ up: j.up, low: j.low, phase: s > 0 ? 0 : Math.PI, amp: 0.55 });
  });
  // squat boiler body
  mk(body, lathe([[0, 0.9], [0.62, 0.95], [0.78, 1.3], [0.74, 1.8], [0.5, 2.1], [0, 2.15]], 22), iron, 0, 0, 0);
  const grille = grp(body, 0, 1.45, -0.72);
  for (let i = 0; i < 5; i++) mk(grille, rbox(0.7, 0.05, 0.06, 0.02), soot, 0, -0.2 + i * 0.1, 0);
  const furnace = mk(body, sph(0.32, 16), hot, 0, 1.45, -0.55);
  furnace.scale.z = 0.4;
  mk(body, torus(0.75, 0.05, 32, 6), brass, 0, 1.3, 0, Math.PI / 2, 0, 0);
  // eyes / head slit
  const head = grp(body, 0, 2.15, -0.25);
  rig.head = head;
  mk(head, rbox(0.6, 0.32, 0.5, 0.1), iron);
  [-1, 1].forEach((s) => mk(head, sph(0.06, 8), fire, s * 0.16, 0.02, -0.26));
  // fuel tanks on the back with pipes to the nozzle
  [-1, 1].forEach((s) => {
    mk(body, cyl(0.24, 0.24, 1.2, 14), brass, s * 0.38, 1.75, 0.62);
    mk(body, sph(0.24, 14), brass, s * 0.38, 2.35, 0.62);
    mk(body, rbox(0.06, 0.6, 0.06, 0.02), fire, s * 0.38, 1.75, 0.38);
    tube(body, [V(s * 0.38, 2.4, 0.6), V(s * 0.5, 2.5, 0.0), V(0.75, 1.9, -0.4)], 0.04, soot, 12);
  });
  for (let i = 0; i < 3; i++) {
    const stack = mk(body, cyl(0.07, 0.09, 0.5, 10), soot, -0.2 + i * 0.2, 2.3, 0.15);
    rig.pulses.push({ obj: stack, amp: 0.2, phase: i });
  }
  // flamethrower arm (right) + clamp arm (left)
  const arm = artic(body, V(0.78, 1.95, -0.05), V(0.95, 1.45, -0.4), V(0.75, 1.35, -1.0), 0.15, 0.12, iron, soot, 0.15, brass);
  const nozzle = grp(arm.low, 0.75 - 0.95, 1.35 - 1.45, -1.05 + 0.4);
  mk(nozzle, cyl(0.12, 0.16, 0.45, 12), brass, 0, 0, 0.1, Math.PI / 2, 0, 0);
  mk(nozzle, cyl(0.17, 0.12, 0.12, 12), soot, 0, 0, -0.16, Math.PI / 2, 0, 0);
  const pilot = mk(nozzle, sph(0.05, 8), fire, 0, -0.1, -0.2);
  rig.pulses.push({ obj: pilot, amp: 1.2, speed: 3 });
  // flame jet (shown while spraying)
  const flame = new THREE.Group();
  nozzle.add(flame);
  flame.position.set(0, 0, -0.25);
  const jetGeo = new THREE.ConeGeometry(0.9, 4.2, 16, 1, true);
  jetGeo.translate(0, -2.1, 0);
  jetGeo.rotateX(Math.PI / 2);
  const jetOuter = mk(flame, jetGeo, halo(0xff6a1a, 0.4));
  const jetInner = mk(flame, jetGeo.clone().scale(0.45, 0.45, 0.85), halo(0xffd27a, 0.7));
  flame.visible = false;
  rig.arms.push({ up: arm.up, low: arm.low, phase: 0, amp: 0.25 });
  const clamp = artic(body, V(-0.78, 1.95, -0.05), V(-0.92, 1.4, -0.3), V(-0.8, 1.1, -0.65), 0.13, 0.1, iron, soot, 0.13, brass);
  [-1, 1].forEach((s) => clamp.onLow(cone(0.06, 0.3, 5), brass, -0.8 + s * 0.08, 1.05, -0.75, -Math.PI / 2, 0, 0));
  rig.arms.push({ up: clamp.up, low: clamp.low, phase: Math.PI, amp: 0.4 });

  rig.gait = { freq: 0.85, swing: 0.45, knee: 0.5, bob: 0.07, lean: 0.03 };
  rig.lunge = 0.25;
  rig.extras = { flame, jetOuter, jetInner, furnace, armUp: arm.up, emit: nozzle, spray: 0 };
  rig.custom = (r, time, dt) => {
    const E = r.extras;
    const a = r.act;
    const spraying = a.name === 'spray';
    E.spray = damp(E.spray, spraying ? 1 : a.name === 'ignite' ? a.k * 0.4 : 0, 14, dt);
    const fl = E.flame as THREE.Object3D;
    fl.visible = E.spray > 0.03;
    const flick = 1 + Math.sin(time * 47) * 0.08 + Math.sin(time * 31) * 0.06;
    fl.scale.set(flick, flick, Math.max(0.05, E.spray) * (0.9 + Math.sin(time * 23) * 0.1));
    (E.jetInner as THREE.Object3D).rotation.z = time * 9;
    (E.armUp as THREE.Object3D).rotation.x = damp((E.armUp as THREE.Object3D).rotation.x, spraying ? 0.55 + Math.sin(time * 2.4) * 0.12 : 0, 8, dt);
    (E.furnace as THREE.Object3D).scale.setScalar(1 + E.spray * 0.35 + Math.sin(time * 9) * 0.04);
  };
  return { hp: 430, speed: 3.0, damage: 20 };
}

// ───────────────────────── ARC WEAVER ─────────────────────────
function buildWeaver(root: THREE.Group, rig: EnemyRig): EliteStats {
  const K = kit();
  const { armor, solid, emis, glow, halo, rbox, cyl, sph, cone, torus, V, mk, grp, artic, lathe } = K;
  const body = new THREE.Group();
  root.add(body);
  rig.body = body;
  const shell = armor(0x1e1b4b, panelTexture('#110f2e', '#a5b4fc', 5), 0.6, 0.3, 1);
  const chrome = solid(0xcbd5e1, 0.95, 0.12);
  const dark = solid(0x06060f, 0.5, 0.5);
  const arc = glow(0xa5f3fc);
  const coil = solid(0xb45309, 0.9, 0.3);

  // eight legs (four per side), high knees
  for (let i = 0; i < 4; i++) {
    [-1, 1].forEach((s) => {
      const z = -0.45 + i * 0.32;
      const j = artic(root, V(s * 0.32, 1.05, z), V(s * 1.05, 1.55, z + (i - 1.5) * 0.25), V(s * 1.45, 0.04, z + (i - 1.5) * 0.45), 0.05, 0.035, shell, chrome, 0.06, arc);
      j.onLow(cone(0.04, 0.22, 5), dark, s * 1.45, 0.12, z + (i - 1.5) * 0.45, Math.PI, 0, 0);
      rig.legs.push({ up: j.up, low: j.low, phase: (i + (s > 0 ? 1 : 0)) % 2 ? Math.PI : 0, amp: 0.55 });
    });
  }
  // cephalothorax + head with a cluster of eyes and fangs
  const thorax = mk(body, sph(0.5, 20), shell, 0, 1.1, -0.15);
  thorax.scale.set(1.1, 0.7, 1.2);
  const head = grp(body, 0, 1.15, -0.7);
  rig.head = head;
  mk(head, rbox(0.42, 0.28, 0.3, 0.1), shell);
  for (let i = 0; i < 6; i++) mk(head, sph(i < 2 ? 0.055 : 0.035, 8), arc, (i % 3 - 1) * 0.11, 0.06 + Math.floor(i / 3) * 0.07, -0.15);
  const jaw = grp(head, 0, -0.08, -0.12);
  rig.jaw = jaw;
  [-1, 1].forEach((s) => mk(jaw, cone(0.035, 0.22, 4), chrome, s * 0.09, -0.06, -0.06, -Math.PI / 2 - 0.4, 0, -s * 0.3));
  // abdomen = tesla coil
  const abd = grp(body, 0, 1.35, 0.65);
  const sac = mk(abd, sph(0.62, 20), shell);
  sac.scale.set(1, 0.85, 1.25);
  for (let i = 0; i < 5; i++) mk(abd, torus(0.5 - i * 0.04, 0.025, 28, 6), coil, 0, 0.1 + i * 0.12, 0, Math.PI / 2, 0, 0);
  mk(abd, cyl(0.06, 0.1, 0.8, 10), chrome, 0, 0.75, 0);
  const orb = mk(abd, sph(0.18, 14), arc, 0, 1.2, 0);
  const orbHalo = mk(abd, sph(0.34, 14), halo(0xa5f3fc, 0.3), 0, 1.2, 0);
  rig.pulses.push({ obj: orb, amp: 1.0, speed: 2.5 }, { obj: orbHalo, amp: 1.4, speed: 2.5 });
  // crackling arcs around the orb: one LineSegments with a fixed buffer, rewritten in place
  const SPARK_SEGS = 6 * 4;
  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SPARK_SEGS * 2 * 3), 3));
  const sparks = new THREE.LineSegments(sparkGeo, new THREE.LineBasicMaterial({ color: 0xe0f2fe, transparent: true, opacity: 0.9 }));
  sparks.frustumCulled = false;
  abd.add(sparks);
  sparks.position.y = 1.2;
  rig.gait = { freq: 1.5, swing: 0.45, knee: 0.55, bob: 0.03, lean: 0.03 };
  rig.lunge = 0.25;
  rig.extras = { abd, orb, sparks, emit: orb, cast: 0 };
  rig.custom = (r, time, dt) => {
    const E = r.extras;
    const a = r.act;
    E.cast = damp(E.cast, a.name === 'plant' || a.name === 'cast' ? a.k : 0, 10, dt);
    const ab = E.abd as THREE.Object3D;
    ab.rotation.x = -E.cast * 0.7 + Math.sin(time * 2) * 0.04;
    // flickering arcs around the orb (rewrite the fixed buffer ~14 times a second)
    const sp = E.sparks as THREE.LineSegments;
    if (Math.floor(time * 14) !== sp.userData.tick) {
      sp.userData.tick = Math.floor(time * 14);
      const pos = sp.geometry.getAttribute('position') as THREE.BufferAttribute;
      const n = 2 + Math.round(E.cast * 4);
      let idx = 0;
      for (let i = 0; i < 6; i++) {
        const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.2, Math.random() - 0.5).normalize();
        let px = 0;
        let py = 0;
        let pz = 0;
        for (let k = 1; k <= 4; k++) {
          const on = i < n;
          const nx = on ? dir.x * k * 0.16 + (Math.random() - 0.5) * 0.1 : 0;
          const ny = on ? dir.y * k * 0.16 + (Math.random() - 0.5) * 0.1 : 0;
          const nz = on ? dir.z * k * 0.16 + (Math.random() - 0.5) * 0.1 : 0;
          pos.setXYZ(idx++, px, py, pz);
          pos.setXYZ(idx++, nx, ny, nz);
          px = nx;
          py = ny;
          pz = nz;
        }
      }
      pos.needsUpdate = true;
    }
  };
  return { hp: 340, speed: 4.2, damage: 18 };
}

// ───────────────────────── TESLA PYLON (weaver minion) ─────────────────────────
function buildPylon(root: THREE.Group, rig: EnemyRig): EliteStats {
  const K = kit();
  const { armor, solid, glow, halo, cyl, sph, torus, mk, grp } = K;
  const base = armor(0x1e1b4b, panelTexture('#110f2e', '#a5b4fc', 3), 0.6, 0.3, 1);
  const coil = solid(0xb45309, 0.9, 0.3);
  const chrome = solid(0xcbd5e1, 0.95, 0.12);
  const body = grp(root);
  rig.body = body;
  mk(body, cyl(0.45, 0.6, 0.25, 6), base, 0, 0.12, 0);
  mk(body, cyl(0.07, 0.1, 1.7, 8), chrome, 0, 1.05, 0);
  for (let i = 0; i < 6; i++) mk(body, torus(0.22 - i * 0.02, 0.025, 20, 6), coil, 0, 0.5 + i * 0.18, 0, Math.PI / 2, 0, 0);
  const top = mk(body, sph(0.16, 12), glow(0xa5f3fc), 0, 1.95, 0);
  const topHalo = mk(body, sph(0.32, 12), halo(0xa5f3fc, 0.3), 0, 1.95, 0);
  const ring = grp(body, 0, 1.95, 0);
  mk(ring, torus(0.36, 0.02, 24, 6), glow(0xe0f2fe));
  rig.spinners.push({ obj: ring, axis: 'y', speed: 3 });
  rig.pulses.push({ obj: top, amp: 1.5, speed: 3 }, { obj: topHalo, amp: 1.8, speed: 3 });
  rig.extras = { emit: top };
  rig.gait = { freq: 0, swing: 0, knee: 0, bob: 0, lean: 0 };
  rig.lunge = 0;
  return { hp: 95, speed: 0, damage: 0 };
}

// ───────────────────────── ORBITAL SPOTTER ─────────────────────────
function buildSpotter(root: THREE.Group, rig: EnemyRig): EliteStats {
  const K = kit();
  const { armor, solid, emis, glow, halo, rbox, cyl, sph, cone, torus, V, mk, grp, lathe } = K;
  const body = new THREE.Group();
  root.add(body);
  rig.body = body;
  const white = armor(0xe2e8f0, panelTexture('#94a3b8', '#ffffff', 4), 0.4, 0.3, 1);
  const gold = solid(0xd4a537, 0.9, 0.25);
  const panelMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, emissive: 0x1d4ed8, emissiveIntensity: 0.35, metalness: 0.6, roughness: 0.3 });
  const red = glow(0xff2d2d);

  mk(body, lathe([[0, -0.4], [0.3, -0.35], [0.42, 0], [0.3, 0.35], [0, 0.4]], 20), white);
  mk(body, torus(0.43, 0.03, 32, 6), gold, 0, 0, 0, Math.PI / 2, 0, 0);
  // sensor eye
  const eye = grp(body, 0, -0.05, -0.38);
  mk(eye, cyl(0.17, 0.2, 0.18, 16), solid(0x0b1220, 0.6, 0.3), 0, 0, 0, Math.PI / 2, 0, 0);
  const lens = mk(eye, sph(0.12, 14), red, 0, 0, -0.08);
  mk(eye, sph(0.22, 12), halo(0xff2d2d, 0.3), 0, 0, -0.1);
  // solar wings
  const wings: THREE.Object3D[] = [];
  [-1, 1].forEach((s) => {
    const w = grp(body, s * 0.45, 0, 0);
    mk(w, cyl(0.025, 0.025, 0.4, 6), gold, s * 0.2, 0, 0, 0, 0, Math.PI / 2);
    for (let i = 0; i < 3; i++) {
      mk(w, rbox(0.42, 0.02, 0.62, 0.01), panelMat, s * (0.62 + i * 0.44), 0, 0);
      mk(w, rbox(0.43, 0.025, 0.04, 0.005), gold, s * (0.62 + i * 0.44), 0.005, 0);
    }
    wings.push(w);
  });
  // dish + antenna
  const dish = grp(body, 0, 0.42, 0.1);
  mk(dish, new THREE.SphereGeometry(0.28, 16, 8, 0, Math.PI * 2, 0, Math.PI / 3), white, 0, 0.1, 0, Math.PI, 0, 0);
  mk(dish, cyl(0.015, 0.015, 0.3, 6), gold, 0, 0.2, 0);
  mk(dish, sph(0.035, 8), red, 0, 0.36, 0);
  rig.spinners.push({ obj: dish, axis: 'y', speed: 1.4 });
  // thrusters
  [-1, 1].forEach((s) => {
    mk(body, cone(0.08, 0.2, 10), gold, s * 0.2, -0.38, 0.1, Math.PI, 0, 0);
    mk(body, sph(0.07, 8), halo(0x93c5fd, 0.5), s * 0.2, -0.5, 0.1);
  });
  rig.hover = { bob: 0.18, tilt: 0.05 };
  rig.lunge = 0.05;
  rig.extras = { wings, lens, emit: lens, paint: 0 };
  rig.custom = (r, time, dt) => {
    const E = r.extras;
    E.paint = damp(E.paint, r.act.name === 'paint' ? 1 : 0, 6, dt);
    (E.wings as THREE.Object3D[]).forEach((w, i) => {
      w.rotation.x = Math.sin(time * 0.8 + i) * 0.15 - E.paint * 0.6;
    });
    (E.lens as THREE.Object3D).scale.setScalar(1 + E.paint * 0.6 + Math.sin(time * 25) * 0.1 * E.paint);
  };
  return { hp: 150, speed: 5.4, damage: 44 };
}

// ───────────────────────── MERCURY SPLITTER (+ splitling) ─────────────────────────
function buildBlob(root: THREE.Group, rig: EnemyRig, scale: number): void {
  const K = kit();
  const { glow, halo, sph, torus, mk, grp } = K;
  const body = new THREE.Group();
  root.add(body);
  rig.body = body;
  const metal = new THREE.MeshPhysicalMaterial({ color: 0xcbd5e1, metalness: 0.25, roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.05, emissive: 0x334155, emissiveIntensity: 0.35 });
  const blob = grp(body, 0, 0.95 * scale, 0);
  const shellM = mk(blob, new THREE.IcosahedronGeometry(1.0 * scale, 3), metal);
  const core = mk(blob, sph(0.36 * scale, 16), glow(0xe879f9), 0, 0.05 * scale, 0);
  const coreHalo = mk(blob, sph(0.62 * scale, 16), halo(0xe879f9, 0.22), 0, 0.05 * scale, 0);
  rig.pulses.push({ obj: core, amp: 1.2, speed: 1.6 }, { obj: coreHalo, amp: 1.4, speed: 1.6 });
  // eye band
  const eyes = grp(blob, 0, 0.3 * scale, -0.86 * scale);
  [-1, 1].forEach((s) => mk(eyes, sph(0.09 * scale, 10), glow(0xf0abfc), s * 0.22 * scale, 0, 0));
  mk(blob, torus(0.98 * scale, 0.02 * scale, 40, 6), glow(0xf0abfc), 0, -0.05 * scale, 0, Math.PI / 2, 0, 0);
  // orbiting droplets
  const drops = grp(body, 0, 1.0 * scale, 0);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    mk(drops, sph((0.12 + (i % 2) * 0.06) * scale, 10), metal, Math.cos(a) * 1.35 * scale, Math.sin(a * 2) * 0.3 * scale, Math.sin(a) * 1.35 * scale);
  }
  rig.spinners.push({ obj: drops, axis: 'y', speed: 1.2 });
  // wobble the surface by perturbing vertices every frame
  const geo = shellM.geometry as THREE.BufferGeometry;
  const base = (geo.getAttribute('position').array as Float32Array).slice();
  rig.gait = { freq: 0, swing: 0, knee: 0, bob: 0, lean: 0 };
  rig.lunge = 0.3;
  rig.extras = { blob, geo, base, scale, squash: 0, emit: core };
  rig.custom = (r, time, dt, move) => {
    const E = r.extras;
    const a = r.act;
    const target = a.name === 'crouch' ? -0.35 * a.k : a.name === 'leap' ? 0.3 : a.name === 'land' ? -0.45 * (1 - a.k) : Math.sin(time * 6) * 0.05 * (0.4 + move);
    E.squash = damp(E.squash, target, a.name === 'land' ? 25 : 12, dt);
    const b = E.blob as THREE.Object3D;
    b.scale.set(1 - E.squash * 0.5, 1 + E.squash, 1 - E.squash * 0.5);
    b.position.y = (0.95 + E.squash * 0.9) * E.scale;
    const pos = (E.geo as THREE.BufferGeometry).getAttribute('position') as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    const src = E.base as Float32Array;
    for (let i = 0; i < arr.length; i += 3) {
      const x = src[i];
      const y = src[i + 1];
      const z = src[i + 2];
      const w = 1 + Math.sin(time * 3.1 + x * 4 + y * 3) * 0.05 + Math.sin(time * 4.3 + z * 5) * 0.035;
      arr[i] = x * w;
      arr[i + 1] = y * w;
      arr[i + 2] = z * w;
    }
    pos.needsUpdate = true;
  };
}

function buildSplitter(root: THREE.Group, rig: EnemyRig): EliteStats {
  buildBlob(root, rig, 1.0);
  return { hp: 400, speed: 3.4, damage: 24 };
}
function buildSplitling(root: THREE.Group, rig: EnemyRig): EliteStats {
  buildBlob(root, rig, 0.5);
  return { hp: 95, speed: 6.4, damage: 11 };
}

// ───────────────────────── CHRONO REVERSER ─────────────────────────
function clockFaceTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(128, 128, 10, 128, 128, 128);
  grd.addColorStop(0, '#1e1b4b');
  grd.addColorStop(1, '#0b0a1f');
  g.fillStyle = grd;
  g.beginPath();
  g.arc(128, 128, 126, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#fde68a';
  g.lineWidth = 4;
  g.beginPath();
  g.arc(128, 128, 118, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = '#fde68a';
  g.font = 'bold 26px serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const numerals = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
  numerals.forEach((n, i) => {
    const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
    g.fillText(n, 128 + Math.cos(a) * 92, 128 + Math.sin(a) * 92);
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function buildChrono(root: THREE.Group, rig: EnemyRig): EliteStats {
  const K = kit();
  const { armor, solid, glow, halo, rbox, cyl, sph, cone, torus, lathe, mk, grp } = K;
  const body = new THREE.Group();
  root.add(body);
  rig.body = body;
  const brass = armor(0xc9a24a, panelTexture('#7a5a14', '#fde68a', 4), 0.8, 0.3, 0.9);
  const night = armor(0x1e1b4b, panelTexture('#0f0d2e', '#818cf8', 5), 0.5, 0.35, 1);
  const violet = glow(0xa78bfa);
  // floating plinth + hourglass body
  mk(body, cyl(0.7, 0.9, 0.25, 8), night, 0, 0.35, 0);
  mk(body, torus(0.8, 0.04, 40, 6), violet, 0, 0.35, 0, Math.PI / 2, 0, 0);
  const glass = mk(body, lathe([[0.05, 0], [0.55, 0.15], [0.6, 0.5], [0.1, 1.05], [0.6, 1.6], [0.55, 1.95], [0.05, 2.1]], 24), new THREE.MeshPhysicalMaterial({ color: 0xc4b5fd, transparent: true, opacity: 0.35, roughness: 0.05, clearcoat: 1, side: THREE.DoubleSide, depthWrite: false }), 0, 0.55, 0);
  void glass;
  const sandTop = mk(body, cone(0.42, 0.5, 20), glow(0xfde68a), 0, 2.15, 0, Math.PI, 0, 0);
  const sandBot = mk(body, cone(0.48, 0.45, 20), glow(0xfde68a), 0, 0.85, 0);
  const stream = mk(body, cyl(0.02, 0.02, 0.6, 6), glow(0xfef3c7), 0, 1.5, 0);
  mk(body, cyl(0.62, 0.62, 0.1, 24), brass, 0, 0.55, 0);
  mk(body, cyl(0.62, 0.62, 0.1, 24), brass, 0, 2.65, 0);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    mk(body, cyl(0.04, 0.04, 2.1, 8), brass, Math.cos(a) * 0.6, 1.6, Math.sin(a) * 0.6);
  }
  // clock face head with hands
  const head = grp(body, 0, 3.25, 0);
  rig.head = head;
  const face = mk(head, new THREE.CircleGeometry(0.55, 40), new THREE.MeshBasicMaterial({ map: clockFaceTexture() }), 0, 0, -0.06);
  face.rotation.y = Math.PI;
  mk(head, cyl(0.6, 0.6, 0.12, 40), brass, 0, 0, 0.0, Math.PI / 2, 0, 0);
  const hourHand = grp(head, 0, 0, -0.08);
  mk(hourHand, rbox(0.05, 0.3, 0.02, 0.01), violet, 0, 0.15, 0);
  const minHand = grp(head, 0, 0, -0.09);
  mk(minHand, rbox(0.035, 0.45, 0.02, 0.01), glow(0xffffff), 0, 0.22, 0);
  mk(head, sph(0.05, 8), brass, 0, 0, -0.1);
  // gyroscope rings around the body
  const rings: THREE.Object3D[] = [];
  for (let i = 0; i < 3; i++) {
    const g = grp(body, 0, 1.6, 0);
    mk(g, torus(1.05 + i * 0.18, 0.025, 56, 6), i === 1 ? violet : brass);
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      mk(g, rbox(0.06, 0.12, 0.03, 0.01), violet, Math.cos(a) * (1.05 + i * 0.18), Math.sin(a) * (1.05 + i * 0.18), 0, 0, 0, a);
    }
    g.rotation.set(Math.PI / 2 + i * 0.5, i * 0.7, 0);
    rings.push(g);
  }
  const aura = mk(body, sph(1.5, 20), halo(0xa78bfa, 0.0), 0, 1.6, 0);
  rig.gait = { freq: 0, swing: 0, knee: 0, bob: 0.0, lean: 0.02 };
  rig.hover = undefined;
  rig.lunge = 0.15;
  rig.extras = { rings, hourHand, minHand, aura, sandTop, sandBot, stream, emit: face, rewind: 0, cast: 0 };
  rig.custom = (r, time, dt) => {
    const E = r.extras;
    const a = r.act;
    E.rewind = damp(E.rewind, a.name === 'rewind' ? 1 : 0, 6, dt);
    E.cast = damp(E.cast, a.name === 'cast' ? a.k : 0, 10, dt);
    const dir = E.rewind > 0.3 ? -1 : 1;
    (E.rings as THREE.Object3D[]).forEach((g, i) => {
      g.rotation.z += dt * dir * (0.6 + i * 0.4) * (1 + E.rewind * 6 + E.cast * 2);
    });
    (E.minHand as THREE.Object3D).rotation.z -= dt * dir * (1.2 + E.rewind * 14);
    (E.hourHand as THREE.Object3D).rotation.z -= dt * dir * (0.1 + E.rewind * 1.2);
    const aura = E.aura as THREE.Mesh;
    (aura.material as THREE.MeshBasicMaterial).opacity = E.rewind * (0.18 + Math.sin(time * 12) * 0.05) + E.cast * 0.08;
    aura.scale.setScalar(1 + E.rewind * 0.25 + Math.sin(time * 4) * 0.03);
    (E.stream as THREE.Object3D).visible = Math.sin(time * 20) > -0.6;
    if (r.body) r.body.position.y = 0.25 + Math.sin(time * 1.6) * 0.1 + (a.name === 'stagger' ? -0.2 : 0);
  };
  return { hp: 470, speed: 2.8, damage: 22 };
}

// ───────────────────────── MIRAGE CASTER (+ echo) ─────────────────────────
function buildMirageBody(root: THREE.Group, rig: EnemyRig, hologram: boolean): void {
  const K = kit();
  const { armor, solid, glow, halo, rbox, cyl, sph, cone, torus, lathe, V, mk, grp, artic } = K;
  const body = new THREE.Group();
  root.add(body);
  rig.body = body;
  const holo = (c: number, o = 0.42) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const robe = hologram ? holo(0x22d3ee, 0.3) : armor(0x134e4a, panelTexture('#0b2f2c', '#5eead4', 5), 0.4, 0.4, 0.8);
  const mask = hologram ? holo(0xa5f3fc, 0.5) : solid(0xe2e8f0, 0.6, 0.2);
  const trim = hologram ? holo(0xe0f2fe, 0.7) : glow(0x5eead4);
  const dark = hologram ? holo(0x0e7490, 0.25) : solid(0x06100f, 0.5, 0.5);
  // flowing robe (lathe bell) — hovers slightly
  const robeM = mk(body, lathe([[0.08, 0], [0.62, 0.05], [0.5, 0.6], [0.36, 1.3], [0.3, 1.75], [0.2, 1.95]], 24), robe, 0, 0.05, 0);
  void robeM;
  for (let i = 0; i < 3; i++) mk(body, torus(0.55 - i * 0.1, 0.02, 32, 6), trim, 0, 0.25 + i * 0.55, 0, Math.PI / 2, 0, 0);
  // shoulders + arms raised in a casting pose
  mk(body, rbox(0.8, 0.18, 0.32, 0.07), dark, 0, 1.85, 0);
  [-1, 1].forEach((s) => {
    const arm = artic(body, V(s * 0.4, 1.85, 0), V(s * 0.75, 1.55, -0.2), V(s * 0.85, 1.9, -0.55), 0.06, 0.05, robe, dark, 0.06, trim);
    arm.onLow(sph(0.07, 8), trim, s * 0.85, 1.92, -0.58);
    rig.arms.push({ up: arm.up, low: arm.low, phase: s > 0 ? 0 : Math.PI, amp: 0.2 });
  });
  // masked head with a crown of floating prisms
  const head = grp(body, 0, 2.15, 0);
  rig.head = head;
  mk(head, sph(0.2, 14), dark);
  const m = mk(head, rbox(0.3, 0.38, 0.06, 0.05), mask, 0, 0, -0.18);
  void m;
  [-1, 1].forEach((s) => mk(head, rbox(0.07, 0.02, 0.02, 0.005), trim, s * 0.07, 0.05, -0.22));
  const crown = grp(head, 0, 0.35, 0);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const p = mk(crown, new THREE.OctahedronGeometry(0.08, 0), hologram ? holo(0xa5f3fc, 0.6) : glow(0xa5f3fc), Math.cos(a) * 0.38, 0, Math.sin(a) * 0.38);
    p.scale.y = 1.8;
  }
  rig.spinners.push({ obj: crown, axis: 'y', speed: 1.6 });
  const prism = mk(body, new THREE.OctahedronGeometry(0.16, 0), hologram ? holo(0xffffff, 0.8) : glow(0xffffff), 0, 1.3, -0.55);
  rig.pulses.push({ obj: prism, amp: 1.3, speed: 2 });
  rig.gait = { freq: 0, swing: 0, knee: 0, bob: 0, lean: 0.03 };
  rig.lunge = 0.15;
  rig.extras = { prism, emit: prism, hologram, cast: 0 };
  rig.custom = (r, time, dt) => {
    const E = r.extras;
    E.cast = damp(E.cast, r.act.name === 'cast' || r.act.name === 'swap' ? r.act.k : 0, 10, dt);
    if (r.body) r.body.position.y = 0.2 + Math.sin(time * 1.8) * 0.08;
    (E.prism as THREE.Object3D).rotation.y = time * 3;
    if (E.hologram && r.body) {
      // hologram flicker / scanline jitter
      r.body.visible = Math.random() > 0.04;
      r.body.position.x = (Math.random() - 0.5) * 0.03;
    }
  };
}
function buildMirage(root: THREE.Group, rig: EnemyRig): EliteStats {
  buildMirageBody(root, rig, false);
  return { hp: 260, speed: 3.6, damage: 16 };
}
function buildMirageEcho(root: THREE.Group, rig: EnemyRig): EliteStats {
  buildMirageBody(root, rig, true);
  return { hp: 34, speed: 3.6, damage: 8 };
}

// ───────────────────────── MAGNETAR ─────────────────────────
function buildMagnet(root: THREE.Group, rig: EnemyRig): EliteStats {
  const K = kit();
  const { armor, solid, glow, halo, rbox, cyl, sph, torus, V, mk, grp, artic } = K;
  const body = new THREE.Group();
  root.add(body);
  rig.body = body;
  const red = armor(0xb91c1c, panelTexture('#7f1d1d', '#fecaca', 4), 0.5, 0.35, 0.9);
  const steel = armor(0x94a3b8, panelTexture('#475569', '#e2e8f0', 4), 0.7, 0.3, 1);
  const dark = solid(0x0a0d14, 0.6, 0.4);
  const blue = glow(0x60a5fa);
  [-1, 1].forEach((s) => {
    const j = artic(root, V(s * 0.42, 1.3, 0), V(s * 0.58, 0.7, -0.14), V(s * 0.52, 0.06, 0.05), 0.16, 0.13, steel, dark, 0.15, blue);
    j.onLow(rbox(0.4, 0.14, 0.62, 0.05), steel, s * 0.52, 0.07, -0.04);
    rig.legs.push({ up: j.up, low: j.low, phase: s > 0 ? 0 : Math.PI, amp: 0.55 });
  });
  mk(body, rbox(0.95, 0.5, 0.7, 0.14), dark, 0, 1.45, 0);
  mk(body, rbox(1.2, 0.9, 0.9, 0.18), steel, 0, 2.05, 0);
  // spinning reactor core in the chest
  const core = grp(body, 0, 2.05, -0.48);
  mk(core, sph(0.2, 14), blue);
  mk(core, sph(0.34, 14), halo(0x60a5fa, 0.3));
  const coreRing = grp(core);
  mk(coreRing, torus(0.32, 0.03, 28, 6), steel);
  mk(coreRing, torus(0.32, 0.03, 28, 6), steel, 0, 0, 0, 0, Math.PI / 2, 0);
  rig.spinners.push({ obj: coreRing, axis: 'y', speed: 2 });
  const head = grp(body, 0, 2.7, -0.05);
  rig.head = head;
  mk(head, rbox(0.5, 0.36, 0.45, 0.12), steel);
  mk(head, rbox(0.4, 0.06, 0.05, 0.02), blue, 0, 0.02, -0.23);
  // two horseshoe-magnet arms (red U, silver poles)
  const arms: { up: THREE.Object3D; side: number }[] = [];
  [-1, 1].forEach((s) => {
    const sh = grp(body, s * 0.78, 2.35, 0);
    mk(sh, sph(0.26, 14), red);
    const fore = grp(sh, s * 0.1, -0.35, -0.2);
    mk(fore, cyl(0.12, 0.1, 0.6, 10), dark, 0, 0, 0);
    const mag = grp(fore, 0, -0.45, -0.25);
    mk(mag, torus(0.3, 0.11, 24, 10, Math.PI), red, 0, 0, 0, 0, 0, Math.PI);
    [-1, 1].forEach((p) => {
      mk(mag, cyl(0.115, 0.115, 0.2, 12), steel, p * 0.3, 0.08, 0);
      mk(mag, cyl(0.12, 0.12, 0.03, 12), blue, p * 0.3, 0.19, 0);
    });
    mag.rotation.x = -Math.PI / 2;
    arms.push({ up: sh, side: s });
  });
  // field rings (visible while pulling)
  const field = grp(body, 0, 2.0, -1.6);
  const fieldRings: THREE.Mesh[] = [];
  for (let i = 0; i < 4; i++) {
    const r = mk(field, new THREE.TorusGeometry(0.6 + i * 0.35, 0.02, 6, 40), halo(0x93c5fd, 0.5), 0, 0, -i * 1.2);
    fieldRings.push(r as THREE.Mesh);
  }
  field.visible = false;
  rig.gait = { freq: 0.75, swing: 0.45, knee: 0.5, bob: 0.06, lean: 0.03 };
  rig.lunge = 0.25;
  rig.extras = { arms, field, fieldRings, coreRing, emit: core, pull: 0, nova: 0 };
  rig.custom = (r, time, dt) => {
    const E = r.extras;
    const a = r.act;
    E.pull = damp(E.pull, a.name === 'pull' ? 1 : 0, 8, dt);
    E.nova = damp(E.nova, a.name === 'nova' ? a.k : 0, 10, dt);
    for (const arm of E.arms as typeof arms) {
      arm.up.rotation.x = -E.pull * 1.2 + E.nova * 1.6;
      arm.up.rotation.z = arm.side * (E.nova * 0.9 - E.pull * 0.15);
    }
    const f = E.field as THREE.Object3D;
    f.visible = E.pull > 0.05;
    (E.fieldRings as THREE.Mesh[]).forEach((rm, i) => {
      // rings travel toward the body (pull) and pulse
      const ph = (time * 1.8 + i * 0.25) % 1;
      rm.position.z = -(1 - ph) * 5;
      rm.scale.setScalar(0.6 + (1 - ph) * 1.4);
      (rm.material as THREE.MeshBasicMaterial).opacity = 0.5 * E.pull * ph;
    });
    (E.coreRing as THREE.Object3D).rotation.x += dt * (1 + E.pull * 10 + E.nova * 16);
  };
  return { hp: 540, speed: 2.6, damage: 26 };
}

// ───────────────────────── RAGE BERSERKER ─────────────────────────
function buildBerserker(root: THREE.Group, rig: EnemyRig): EliteStats {
  const K = kit();
  const { armor, solid, emis, glow, halo, rbox, cyl, sph, cone, V, mk, grp, artic, blade } = K;
  const body = new THREE.Group();
  root.add(body);
  rig.body = body;
  const hide = armor(0x3f1d0b, panelTexture('#24100a', '#fb923c', 4), 0.4, 0.45, 0.6);
  const iron = armor(0x4b5563, panelTexture('#1f2937', '#d1d5db', 5), 0.7, 0.3, 0.8);
  const dark = solid(0x0b0606, 0.5, 0.5);
  const bone = solid(0xe7dcc4, 0.2, 0.5);
  const rage = emis(0x7f1d1d, 0xff2a1a, 1.0);
  [-1, 1].forEach((s) => {
    const j = artic(root, V(s * 0.42, 1.35, 0.05), V(s * 0.55, 0.75, -0.2), V(s * 0.5, 0.06, 0.08), 0.17, 0.13, hide, dark, 0.15, iron);
    j.onLow(rbox(0.36, 0.14, 0.55, 0.05), iron, s * 0.5, 0.07, 0.0);
    j.onLow(cone(0.06, 0.2, 5), bone, s * 0.55, 0.8, -0.38, -Math.PI / 2, 0, 0);
    rig.legs.push({ up: j.up, low: j.low, phase: s > 0 ? 0 : Math.PI, amp: 0.85 });
  });
  // hunched torso with exposed rage vents
  mk(body, rbox(0.9, 0.5, 0.65, 0.14), dark, 0, 1.5, 0);
  const torso = mk(body, rbox(1.35, 1.0, 0.95, 0.22), hide, 0, 2.1, 0.05, 0.2, 0, 0);
  void torso;
  const vents: THREE.Mesh[] = [];
  for (let i = 0; i < 4; i++) {
    const v = mk(body, rbox(0.9 - i * 0.12, 0.05, 0.08, 0.02), rage, 0, 1.85 + i * 0.16, -0.46 + i * 0.03, 0.2, 0, 0);
    vents.push(v as THREE.Mesh);
  }
  for (let i = 0; i < 5; i++) mk(body, cone(0.08, 0.4, 5), bone, -0.4 + i * 0.2, 2.65, 0.4, -0.9, 0, 0); // back spikes
  // horned skull head
  const head = grp(body, 0, 2.7, -0.42);
  rig.head = head;
  mk(head, rbox(0.42, 0.38, 0.42, 0.12), iron);
  [-1, 1].forEach((s) => {
    mk(head, sph(0.05, 8), glow(0xff3b1a), s * 0.1, 0.04, -0.21);
    const horn = mk(head, cone(0.08, 0.55, 6), bone, s * 0.26, 0.28, 0.05, -0.4, 0, -s * 0.9);
    void horn;
  });
  const jaw = grp(head, 0, -0.15, -0.08);
  rig.jaw = jaw;
  mk(jaw, rbox(0.34, 0.08, 0.3, 0.03), iron);
  // twin cleaver arms
  const armRefs: { up: THREE.Object3D; low: THREE.Object3D; side: number }[] = [];
  [-1, 1].forEach((s) => {
    const arm = artic(body, V(s * 0.85, 2.45, 0), V(s * 1.05, 1.8, -0.2), V(s * 0.95, 1.4, -0.7), 0.16, 0.13, hide, iron, 0.17, rage);
    const cl = arm.onLow(blade(1.25, 0.4, 0.05, s * 0.1), iron, s * 0.95, 1.4, -0.75, -Math.PI / 2 + 0.3, 0, 0);
    cl.scale.x = s;
    arm.onLow(new THREE.BoxGeometry(0.02, 0.02, 1.05), glow(0xff5a1a), s * 0.95 - s * 0.16, 1.3, -1.2, 0.3, 0, 0);
    rig.arms.push({ up: arm.up, low: arm.low, phase: s > 0 ? 0 : Math.PI, amp: 0.5 });
    armRefs.push({ up: arm.up, low: arm.low, side: s });
  });
  const cycloneDisc = mk(body, new THREE.RingGeometry(0.6, 2.4, 48), halo(0xff5a1a, 0.0), 0, 1.4, 0, -Math.PI / 2, 0, 0);
  rig.gait = { freq: 1.1, swing: 0.6, knee: 0.7, bob: 0.07, lean: 0.07 };
  rig.lunge = 0.45;
  rig.extras = { vents, armRefs, cycloneDisc, rage: 0, spin: 0, emit: head };
  rig.custom = (r, time, dt) => {
    const E = r.extras;
    const a = r.act;
    // rage level (0..1) is pushed by the AI through act 'rage:<k>' style cue on extras
    const rageK = (E.rageTarget as number) ?? 0;
    E.rage = damp(E.rage, rageK, 3, dt);
    const pulse = 0.55 + 0.45 * Math.sin(time * (4 + E.rage * 14));
    (E.vents as THREE.Mesh[]).forEach((v) => {
      ((v.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.6 + E.rage * 2.2 * pulse);
    });
    const spinning = a.name === 'cyclone';
    E.spin = spinning ? E.spin + dt * 16 : damp(E.spin % (Math.PI * 2), 0, 6, dt);
    if (r.body) {
      r.body.rotation.y = E.spin;
      if (a.name === 'roar') r.body.rotation.x -= 0.25 * a.k;
      if (a.name === 'leap') r.body.rotation.x += 0.3;
    }
    for (const arm of E.armRefs as typeof armRefs) {
      if (spinning) {
        arm.up.rotation.z = arm.side * 1.35;
        arm.up.rotation.x = 0.2;
      } else if (a.name === 'leap' || a.name === 'roar') {
        arm.up.rotation.x = 2.4;
        arm.up.rotation.z = arm.side * 0.3;
      } else {
        arm.up.rotation.z = damp(arm.up.rotation.z, 0, 8, dt);
      }
    }
    const disc = E.cycloneDisc as THREE.Mesh;
    (disc.material as THREE.MeshBasicMaterial).opacity = spinning ? 0.3 + Math.sin(time * 30) * 0.08 : 0;
  };
  return { hp: 560, speed: 3.8, damage: 34 };
}

/**
 * Builds an APEX enemy into `group` (registers its animation rig on `group.userData.enemyRig`).
 * Returns null for other types.
 */
export function buildApexEnemy(type: string, group: THREE.Group): EliteStats | null {
  if (!isApexType(type)) return null;
  const rig = createRig(type);
  group.userData.enemyRig = rig;
  switch (type) {
    case 'aegis': return buildAegis(group, rig);
    case 'ronin': return buildRonin(group, rig);
    case 'pyro': return buildPyro(group, rig);
    case 'weaver': return buildWeaver(group, rig);
    case 'pylon': return buildPylon(group, rig);
    case 'spotter': return buildSpotter(group, rig);
    case 'splitter': return buildSplitter(group, rig);
    case 'splitling': return buildSplitling(group, rig);
    case 'chrono': return buildChrono(group, rig);
    case 'mirage': return buildMirage(group, rig);
    case 'mirage_echo': return buildMirageEcho(group, rig);
    case 'magnet': return buildMagnet(group, rig);
    case 'berserker': return buildBerserker(group, rig);
  }
  return null;
}

/** World position of an APEX enemy's emitter (nozzle, lens, orb, ...). */
export function apexEmitterWorld(group: THREE.Object3D, out: THREE.Vector3): THREE.Vector3 {
  const rig = group.userData.enemyRig as EnemyRig | undefined;
  const obj: THREE.Object3D | undefined = rig?.extras?.emit;
  if (obj) return obj.getWorldPosition(out);
  return out.copy(group.position).setY(group.position.y + 1.4);
}
