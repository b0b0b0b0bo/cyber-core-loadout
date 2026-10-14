import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { Weapon } from '../types';

/**
 * Per-weapon identity layer.
 *
 * Several weapons share one base chassis in battleWeaponModel.ts (all handguns, the
 * rifles, the rail guns, the launchers, the shotguns). This adds weapon-specific
 * attachments on top so every weapon has its own silhouette, without touching the
 * animated parts of the base model (gunSlide, pumpForend, gunMag, lanceNeedle, ...).
 *
 * Everything here is purely additive and uses the weapon's accent colour.
 * Coordinates are the same camera-space as the base model: muzzle toward -Z, +Y up.
 */
export function applyWeaponVariant(holder: THREE.Object3D, weapon: Weapon): void {
  const accent = new THREE.Color(weapon.color);
  const gunMat = new THREE.MeshStandardMaterial({ color: 0x1e2837, metalness: 0.62, roughness: 0.38 });
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x36455a, metalness: 0.55, roughness: 0.42 });
  const steelMat = new THREE.MeshStandardMaterial({ color: 0x9aa8bb, metalness: 0.72, roughness: 0.26 });
  const rubberMat = new THREE.MeshStandardMaterial({ color: 0x0c121b, metalness: 0.05, roughness: 0.88 });
  const brassMat = new THREE.MeshStandardMaterial({ color: 0xc9a24a, metalness: 0.85, roughness: 0.3 });
  const trimMat = new THREE.MeshStandardMaterial({ color: accent.clone().multiplyScalar(0.55), metalness: 0.5, roughness: 0.35 });
  const energyMat = new THREE.MeshBasicMaterial({ color: accent });
  const coreMat = new THREE.MeshBasicMaterial({ color: accent.clone().lerp(new THREE.Color(0xffffff), 0.75) });
  const glowMat = new THREE.MeshBasicMaterial({
    color: accent,
    transparent: true,
    opacity: 0.26,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: accent.clone().lerp(new THREE.Color(0xffffff), 0.35),
    emissive: accent,
    emissiveIntensity: 0.55,
    metalness: 0.1,
    roughness: 0.15,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });

  const M = (g: THREE.BufferGeometry, m: THREE.Material) => new THREE.Mesh(g, m);
  const put = <T extends THREE.Object3D>(parent: THREE.Object3D, obj: T, x = 0, y = 0, z = 0): T => {
    obj.position.set(x, y, z);
    parent.add(obj);
    return obj;
  };
  const rb = (w: number, h: number, d: number, r = 0.004) =>
    new RoundedBoxGeometry(w, h, d, 2, Math.max(0.0005, Math.min(r, w * 0.45, h * 0.45, d * 0.45)));
  /** Cylinder along Z (radius at the -Z / muzzle end first). */
  const cylZ = (rFront: number, rRear: number, len: number, seg = 16, open = false) => {
    const g = new THREE.CylinderGeometry(rRear, rFront, len, seg, 1, open);
    g.rotateX(Math.PI / 2);
    return g;
  };
  const coneZ = (r: number, len: number, seg = 10) => {
    const g = new THREE.ConeGeometry(r, len, seg);
    g.rotateX(-Math.PI / 2);
    return g;
  };
  const ringZ = (R: number, r: number, seg = 24) => new THREE.TorusGeometry(R, r, 8, seg);
  const glowBox = (x: number, y: number, z: number, w: number, h: number, d: number) => {
    put(holder, M(new THREE.BoxGeometry(w, h, d), energyMat), x, y, z);
    put(holder, M(new THREE.BoxGeometry(w * 1.9 + 0.006, h * 1.9 + 0.006, d * 1.04), glowMat), x, y, z);
  };
  const glowSphere = (x: number, y: number, z: number, r: number) => {
    put(holder, M(new THREE.SphereGeometry(r, 14, 10), energyMat), x, y, z);
    put(holder, M(new THREE.SphereGeometry(r * 0.55, 10, 8), coreMat), x, y, z);
    put(holder, M(new THREE.SphereGeometry(r * 1.8, 12, 9), glowMat), x, y, z);
  };
  /** Rod from a to b (round). */
  const rod = (a: THREE.Vector3, b: THREE.Vector3, r: number, mat: THREE.Material) => {
    const dir = b.clone().sub(a);
    const len = dir.length();
    const m = M(new THREE.CylinderGeometry(r, r, len, 8), mat);
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    holder.add(m);
    return m;
  };
  /** Ring of N items around the Z axis centred at (cx, cy). */
  const around = (n: number, radius: number, cx: number, cy: number, fn: (x: number, y: number, a: number, i: number) => void, a0 = 0) => {
    for (let i = 0; i < n; i++) {
      const a = a0 + (i / n) * Math.PI * 2;
      fn(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius, a, i);
    }
  };

  switch (weapon.id) {
    // ───────────────────────────── HANDGUNS ─────────────────────────────
    case 'sub_pulsar': {
      // ARCHON 9 — finned energy pistol with a coil-wound emitter
      for (let i = 0; i < 7; i++) {
        put(holder, M(rb(0.03, 0.026, 0.006, 0.002), steelMat), 0, 0.099, -0.2 + i * 0.02);
      }
      glowBox(0, 0.086, -0.14, 0.02, 0.004, 0.14);
      for (let i = 0; i < 3; i++) {
        put(holder, M(ringZ(0.03, 0.006, 18), energyMat), 0, 0.04, -0.385 - i * 0.025);
        put(holder, M(ringZ(0.03, 0.016, 18), glowMat), 0, 0.04, -0.385 - i * 0.025);
      }
      put(holder, M(cylZ(0.012, 0.016, 0.07, 12), steelMat), 0, 0.04, -0.4);
      glowSphere(0, 0.04, -0.44, 0.012);
      // belt-clip style power cell under the frame
      put(holder, M(rb(0.04, 0.03, 0.12, 0.006), frameMat), 0, -0.08, -0.12);
      glowBox(0.021, -0.08, -0.12, 0.004, 0.012, 0.09);
      break;
    }
    case 'sub_arc_blaster': {
      // VOLT CHAIN — tesla prongs + side capacitors
      const prongs = 3;
      around(prongs, 0.034, 0, 0.04, (x, y, a) => {
        const start = new THREE.Vector3(x * 0.55, 0.04 + (y - 0.04) * 0.55, -0.37);
        const end = new THREE.Vector3(x * 1.5, 0.04 + (y - 0.04) * 1.5, -0.52);
        rod(start, end, 0.0045, steelMat);
        const tip = new THREE.Vector3().copy(end);
        glowSphere(tip.x, tip.y, tip.z, 0.008);
      }, Math.PI / 2);
      put(holder, M(cylZ(0.03, 0.03, 0.03, 14), frameMat), 0, 0.04, -0.375);
      [-1, 1].forEach((s) => {
        put(holder, M(cylZ(0.014, 0.014, 0.2, 14), frameMat), s * 0.05, 0.045, -0.17);
        for (let i = 0; i < 4; i++) put(holder, M(ringZ(0.0145, 0.003, 14), energyMat), s * 0.05, 0.045, -0.1 - i * 0.045);
        put(holder, M(rb(0.012, 0.03, 0.03, 0.004), steelMat), s * 0.04, 0.045, -0.07);
      });
      // jagged lightning decal on top
      const pts = [-0.04, -0.09, -0.13, -0.19, -0.23].map((z, i) => new THREE.Vector3(i % 2 ? 0.012 : -0.012, 0.0905, z));
      pts.forEach((p, i) => {
        if (i < pts.length - 1) rod(p, pts[i + 1], 0.0022, energyMat);
      });
      break;
    }
    case 'sub_ricochet_blade': {
      // RICOCHET EDGE — disc launcher: orbiting blade discs + disc magazine
      put(holder, M(ringZ(0.05, 0.007, 28), steelMat), 0, 0.04, -0.41);
      put(holder, M(ringZ(0.05, 0.016, 28), glowMat), 0, 0.04, -0.41);
      [Math.PI, 0, (3 * Math.PI) / 2].forEach((a) => {
        const dx = Math.cos(a) * 0.05;
        const dy = Math.sin(a) * 0.05;
        const disc = put(holder, M(new THREE.CylinderGeometry(0.026, 0.026, 0.006, 20), steelMat), dx, 0.04 + dy, -0.41);
        disc.rotation.x = Math.PI / 2;
        const rim = put(holder, M(new THREE.TorusGeometry(0.026, 0.0035, 6, 20), energyMat), dx, 0.04 + dy, -0.41);
        rim.rotation.x = 0;
      });
      // disc drum magazine under the barrel
      const drum = put(holder, M(new THREE.CylinderGeometry(0.045, 0.045, 0.05, 22), frameMat), 0, -0.06, -0.22);
      drum.rotation.z = Math.PI / 2;
      const drumCore = put(holder, M(new THREE.CylinderGeometry(0.03, 0.03, 0.056, 18), energyMat), 0, -0.06, -0.22);
      drumCore.rotation.z = Math.PI / 2;
      around(8, 0.039, 0, -0.06, (x, y) => {
        put(holder, M(new THREE.BoxGeometry(0.052, 0.008, 0.008), rubberMat), 0, y, -0.22 + x);
      });
      break;
    }
    case 'sub_drone_funnel': {
      // HORNET SWARM — docked micro-drones on both sides
      [-1, 1].forEach((s) => {
        [-0.13, -0.26].forEach((z, i) => {
          const d = new THREE.Group();
          const body = M(new THREE.SphereGeometry(0.026, 14, 10), steelMat);
          body.scale.set(1, 0.55, 1.15);
          d.add(body);
          put(d, M(new THREE.SphereGeometry(0.011, 10, 8), energyMat), 0, 0.012, -0.018);
          put(d, M(new THREE.TorusGeometry(0.03, 0.0035, 6, 14), frameMat), 0, 0, 0).rotation.x = Math.PI / 2;
          [-1, 1].forEach((w) => {
            const wing = put(d, M(rb(0.05, 0.004, 0.02, 0.002), trimMat), w * 0.035, 0.004, 0.012);
            wing.rotation.z = w * -0.2;
          });
          put(d, M(coneZ(0.006, 0.02, 6), energyMat), 0, -0.002, -0.036);
          put(holder, d, s * 0.058, 0.03 - i * 0.005, z);
          // docking rail
          put(holder, M(rb(0.008, 0.012, 0.09, 0.002), frameMat), s * 0.04, 0.02, z);
        });
      });
      glowBox(0, 0.086, -0.14, 0.02, 0.004, 0.14);
      put(holder, M(coneZ(0.02, 0.07, 8), steelMat), 0, 0.04, -0.4);
      break;
    }
    case 'sub_nanoswarm': {
      // PLAGUE BLOOM — reagent tank + wide dispersal nozzle + floating nanites
      put(holder, M(cylZ(0.03, 0.03, 0.2, 18), glassMat), 0, -0.052, -0.22);
      put(holder, M(cylZ(0.021, 0.021, 0.19, 14), energyMat), 0, -0.052, -0.22);
      [-0.12, -0.32].forEach((z) => put(holder, M(cylZ(0.034, 0.034, 0.012, 18), steelMat), 0, -0.052, z));
      [-0.18, -0.26].forEach((z) => put(holder, M(ringZ(0.031, 0.004, 18), frameMat), 0, -0.052, z));
      rod(new THREE.Vector3(0, -0.04, -0.33), new THREE.Vector3(0, 0.02, -0.38), 0.008, steelMat);
      // flared dispersal nozzle
      put(holder, M(cylZ(0.052, 0.022, 0.08, 20, true), steelMat), 0, 0.04, -0.41);
      put(holder, M(ringZ(0.052, 0.006, 20), energyMat), 0, 0.04, -0.45);
      const nano = [
        [0.04, 0.09, -0.5], [-0.05, 0.06, -0.55], [0.02, 0.0, -0.56], [-0.03, 0.12, -0.6],
        [0.07, 0.04, -0.62], [-0.07, 0.02, -0.5], [0.0, 0.08, -0.66], [0.05, 0.13, -0.58],
      ];
      nano.forEach(([x, y, z], i) => glowSphere(x, y, z, 0.006 + (i % 3) * 0.0015));
      break;
    }
    case 'main_spreader': {
      // SPREAD-ER — oversized drum magazine + ported barrel shroud
      const drum = put(holder, M(new THREE.CylinderGeometry(0.1, 0.1, 0.1, 24), gunMat), 0, -0.2, -0.1);
      drum.rotation.z = Math.PI / 2;
      for (let i = 0; i < 2; i++) {
        const cap = put(holder, M(new THREE.CylinderGeometry(0.085, 0.085, 0.006, 24), energyMat), (i ? -1 : 1) * 0.054, -0.2, -0.1);
        cap.rotation.z = Math.PI / 2;
      }
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        put(holder, M(new THREE.BoxGeometry(0.104, 0.012, 0.012), steelMat), 0, -0.2 + Math.sin(a) * 0.1, -0.1 + Math.cos(a) * 0.1);
      }
      [0, 1, 2, 3].forEach((i) => {
        put(holder, M(new THREE.BoxGeometry(0.07, 0.008, 0.016), rubberMat), 0, 0.075, -0.62 - i * 0.035);
        glowBox(0.045, 0.03, -0.62 - i * 0.035, 0.004, 0.02, 0.012);
        glowBox(-0.045, 0.03, -0.62 - i * 0.035, 0.004, 0.02, 0.012);
      });
      break;
    }
    case 'main_bubblas': {
      // BUBBLAS — soap-solution tank, bubble wand ring at the muzzle, a few floating bubbles
      put(holder, M(new THREE.SphereGeometry(0.075, 20, 14), glassMat), 0, 0.14, -0.12);
      put(holder, M(new THREE.SphereGeometry(0.052, 16, 12), glowMat), 0, 0.135, -0.12);
      put(holder, M(cylZ(0.03, 0.03, 0.03, 16), steelMat), 0, 0.075, -0.12);
      put(holder, M(ringZ(0.077, 0.004, 24), steelMat), 0, 0.14, -0.12).rotation.x = Math.PI / 2;
      // feed hose from tank to wand
      const hose = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0.04, 0.12, -0.16),
        new THREE.Vector3(0.075, 0.08, -0.3),
        new THREE.Vector3(0.06, 0.05, -0.5),
        new THREE.Vector3(0.0, 0.04, -0.66),
      ]);
      put(holder, M(new THREE.TubeGeometry(hose, 20, 0.007, 8, false), rubberMat));
      // wand ring with a soap film
      put(holder, M(cylZ(0.016, 0.016, 0.14, 12), gunMat), 0, 0.04, -0.62);
      put(holder, M(ringZ(0.05, 0.007, 28), energyMat), 0, 0.04, -0.7);
      put(holder, M(ringZ(0.05, 0.016, 28), glowMat), 0, 0.04, -0.7);
      put(holder, M(new THREE.CircleGeometry(0.047, 24), glassMat), 0, 0.04, -0.7);
      [[0.06, 0.1, -0.78, 0.014], [-0.05, 0.07, -0.86, 0.01], [0.02, 0.13, -0.93, 0.008]].forEach(([x, y, z, r]) => {
        put(holder, M(new THREE.SphereGeometry(r, 12, 9), glassMat), x, y, z);
      });
      glowBox(0.043, 0.0, -0.3, 0.004, 0.02, 0.2);
      glowBox(-0.043, 0.0, -0.3, 0.004, 0.02, 0.2);
      break;
    }
    case 'sub_smg': {
      // VECTOR-9 — suppressed rapid-fire SMG
      put(holder, M(cylZ(0.027, 0.027, 0.2, 18), gunMat), 0, 0.04, -0.47);
      for (let i = 0; i < 5; i++) put(holder, M(ringZ(0.0285, 0.0035, 16), steelMat), 0, 0.04, -0.4 - i * 0.04);
      put(holder, M(cylZ(0.03, 0.03, 0.012, 18), frameMat), 0, 0.04, -0.575);
      // long mag in front of the grip + vertical foregrip
      const mag = put(holder, new THREE.Group(), 0, -0.16, -0.075);
      mag.name = 'gunMag'; // swapped by the reload animation
      mag.rotation.x = 0.1;
      put(mag, M(rb(0.04, 0.2, 0.065, 0.008), gunMat), 0, 0, 0);
      [0.0215, -0.0215].forEach((sx) => put(mag, M(new THREE.BoxGeometry(0.004, 0.12, 0.04), energyMat), sx, 0.01, 0));
      put(holder, M(rb(0.03, 0.1, 0.045, 0.008), rubberMat), 0, -0.075, -0.27);
      for (let i = 0; i < 4; i++) put(holder, M(new THREE.BoxGeometry(0.034, 0.006, 0.048), gunMat), 0, -0.04 - i * 0.02, -0.27);
      // perforated barrel shroud
      for (let i = 0; i < 6; i++) {
        put(holder, M(new THREE.BoxGeometry(0.068, 0.009, 0.012), rubberMat), 0, 0.04, -0.255 - i * 0.018);
      }
      break;
    }
    case 'sub_akimbo': {
      // TWIN VIPER — viper-fang compensator + vented slide strip on each hand's pistol
      (['akimboRight', 'akimboLeft'] as const).forEach((name) => {
        const hand = holder.getObjectByName(name);
        if (!hand) return;
        put(hand, M(rb(0.07, 0.05, 0.07, 0.008), gunMat), 0, 0.04, -0.37);
        [-1, 1].forEach((s) => {
          const fang = put(hand, M(coneZ(0.008, 0.05, 6), steelMat), s * 0.022, 0.012, -0.405);
          fang.rotation.y = s * 0.12;
        });
        put(hand, M(ringZ(0.02, 0.004, 14), energyMat), 0, 0.04, -0.408);
        put(hand, M(ringZ(0.02, 0.01, 14), glowMat), 0, 0.04, -0.408);
        // slide-mounted parts ride with the per-hand blowback
        const slide = hand.getObjectByName(name === 'akimboRight' ? 'akimboSlideR' : 'akimboSlideL') ?? hand;
        const sy = slide === hand ? 0.04 : 0;
        const sz = slide === hand ? -0.12 : 0;
        for (let i = 0; i < 3; i++) put(slide, M(new THREE.BoxGeometry(0.054, 0.006, 0.01), rubberMat), 0, sy + 0.061, sz - 0.1 - i * 0.022);
        put(slide, M(new THREE.BoxGeometry(0.01, 0.004, 0.12), energyMat), 0, sy + 0.062, sz + 0.03);
        put(slide, M(new THREE.BoxGeometry(0.026, 0.01, 0.13), glowMat), 0, sy + 0.062, sz + 0.03);
      });
      break;
    }
    case 'sub_twin_revolver': {
      // TWIN PULSE BEAM — second emitter barrel + paired coils
      [-1, 1].forEach((s) => {
        put(holder, M(cylZ(0.016, 0.016, 0.32, 14), steelMat), s * 0.052, 0.035, -0.29);
        put(holder, M(cylZ(0.022, 0.022, 0.04, 14), gunMat), s * 0.052, 0.035, -0.43);
        for (let i = 0; i < 3; i++) {
          put(holder, M(ringZ(0.0185, 0.004, 14), energyMat), s * 0.052, 0.035, -0.22 - i * 0.07);
          put(holder, M(ringZ(0.0185, 0.012, 14), glowMat), s * 0.052, 0.035, -0.22 - i * 0.07);
        }
        put(holder, M(rb(0.016, 0.05, 0.14, 0.004), frameMat), s * 0.036, 0.03, -0.12);
        glowSphere(s * 0.052, 0.035, -0.455, 0.008);
      });
      break;
    }
    case 'sub_magnum': {
      // APOCRYPHA .50 — heavy ported barrel with underlug and brake
      put(holder, M(rb(0.052, 0.045, 0.3, 0.008), gunMat), 0, -0.012, -0.24);
      put(holder, M(cylZ(0.034, 0.034, 0.08, 16), steelMat), 0, 0.04, -0.4);
      for (let i = 0; i < 4; i++) put(holder, M(new THREE.BoxGeometry(0.07, 0.006, 0.01), rubberMat), 0, 0.04, -0.37 - i * 0.02);
      put(holder, M(ringZ(0.035, 0.005, 18), energyMat), 0, 0.04, -0.445);
      put(holder, M(ringZ(0.035, 0.014, 18), glowMat), 0, 0.04, -0.445);
      put(holder, M(rb(0.056, 0.012, 0.18, 0.004), brassMat), 0, 0.087, -0.2); // engraved trim rib
      [-1, 1].forEach((s) => put(holder, M(rb(0.006, 0.02, 0.1, 0.002), brassMat), s * 0.04, -0.01, -0.24));
      break;
    }

    // ───────────────────────────── RIFLES ─────────────────────────────
    case 'main_spectre': {
      // SPECTRE AR-4 — plasma cell carbine
      put(holder, M(cylZ(0.022, 0.022, 0.24, 16), glassMat), 0, -0.066, -0.47);
      put(holder, M(cylZ(0.014, 0.014, 0.23, 12), energyMat), 0, -0.066, -0.47);
      [-0.36, -0.58].forEach((z) => put(holder, M(cylZ(0.026, 0.026, 0.014, 16), steelMat), 0, -0.066, z));
      // side heat-vents + shoulder stock stub
      [-1, 1].forEach((s) => {
        for (let i = 0; i < 4; i++) put(holder, M(new THREE.BoxGeometry(0.004, 0.03, 0.01), energyMat), s * 0.0425, 0.035, -0.58 - i * 0.03);
      });
      break;
    }
    case 'main_plasma_wave': {
      // PLASMA TIDE — wave emitter horn
      put(holder, M(cylZ(0.085, 0.032, 0.2, 26, true), steelMat), 0, 0.01, -0.86);
      put(holder, M(cylZ(0.075, 0.026, 0.19, 26, true), gunMat), 0, 0.01, -0.86);
      [-0.78, -0.84, -0.9, -0.96].forEach((z, i) => {
        put(holder, M(ringZ(0.04 + i * 0.016, 0.005, 26), i % 2 ? frameMat : energyMat), 0, 0.01, z);
      });
      const disc = put(holder, M(new THREE.CircleGeometry(0.07, 24), glowMat), 0, 0.01, -0.955);
      disc.rotation.y = Math.PI;
      glowSphere(0, 0.01, -0.86, 0.016);
      // wave capacitor fins on the handguard
      [-1, 1].forEach((s) => {
        for (let i = 0; i < 4; i++) put(holder, M(rb(0.014, 0.07, 0.016, 0.003), frameMat), s * 0.05, 0.01, -0.34 - i * 0.07);
        glowBox(s * 0.058, 0.01, -0.45, 0.004, 0.012, 0.22);
      });
      break;
    }
    case 'main_hyperion': {
      // HYPERION-X — radiant burst coils + angled foregrip + sun emblem
      [-0.62, -0.68, -0.74].forEach((z) => {
        put(holder, M(ringZ(0.04, 0.007, 22), energyMat), 0, 0.01, z);
        put(holder, M(ringZ(0.04, 0.02, 22), glowMat), 0, 0.01, z);
      });
      const fg = put(holder, M(rb(0.032, 0.11, 0.04, 0.008), rubberMat), 0, -0.1, -0.5);
      fg.rotation.x = 0.35;
      for (let i = 0; i < 3; i++) put(holder, M(new THREE.BoxGeometry(0.036, 0.006, 0.044), gunMat), 0, -0.07 - i * 0.025, -0.495 - i * 0.012).rotation.x = 0.35;
      [-1, 1].forEach((s) => {
        const emblem = new THREE.Group();
        emblem.add(M(new THREE.TorusGeometry(0.018, 0.003, 6, 18), energyMat));
        emblem.add(M(new THREE.CircleGeometry(0.009, 12), coreMat));
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          const ray = M(new THREE.BoxGeometry(0.0035, 0.012, 0.001), energyMat);
          ray.position.set(Math.cos(a) * 0.03, Math.sin(a) * 0.03, 0);
          ray.rotation.z = a + Math.PI / 2;
          emblem.add(ray);
        }
        emblem.rotation.y = s * Math.PI / 2;
        put(holder, emblem, s * 0.0425, 0.01, -0.32);
      });
      // burst counter strip
      glowBox(0, 0.0745, -0.4, 0.03, 0.004, 0.12);
      break;
    }
    case 'heavy_photon_gatling': {
      // PHOTON GATLING — power cable + coolant jacket + side feed
      const cable = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0.042, 0.02, 0.05),
        new THREE.Vector3(0.09, 0.0, -0.12),
        new THREE.Vector3(0.09, 0.02, -0.4),
        new THREE.Vector3(0.04, 0.012, -0.64),
      ]);
      put(holder, M(new THREE.TubeGeometry(cable, 24, 0.008, 8, false), rubberMat));
      put(holder, M(new THREE.TubeGeometry(cable, 24, 0.0035, 6, false), energyMat));
      put(holder, M(cylZ(0.062, 0.062, 0.12, 20), frameMat), 0, 0.01, -0.62);
      around(6, 0.058, 0, 0.01, (x, y) => put(holder, M(new THREE.BoxGeometry(0.01, 0.01, 0.12), energyMat), x, y, -0.62));
      put(holder, M(rb(0.05, 0.08, 0.2, 0.01), gunMat), 0.065, -0.01, -0.2);
      glowBox(0.092, -0.01, -0.2, 0.004, 0.04, 0.14);
      break;
    }

    case 'heavy_shr1nker': {
      // SHR1NKER — stacked focusing lenses, coolant coils and a collapsing-ring emitter
      for (let i = 0; i < 4; i++) {
        const R = 0.07 - i * 0.012;
        put(holder, M(ringZ(R, 0.006, 28), energyMat), 0, 0.02, -0.5 - i * 0.07);
        put(holder, M(ringZ(R, 0.02, 28), glowMat), 0, 0.02, -0.5 - i * 0.07);
      }
      put(holder, M(new THREE.CircleGeometry(0.046, 24), glassMat), 0, 0.02, -0.78);
      glowSphere(0, 0.02, -0.74, 0.016);
      // converging prism fins
      around(4, 0.05, 0, 0.02, (x, y) => rod(new THREE.Vector3(x * 1.3, 0.02 + (y - 0.02) * 1.3, -0.5), new THREE.Vector3(x * 0.6, 0.02 + (y - 0.02) * 0.6, -0.78), 0.004, steelMat), Math.PI / 4);
      [-1, 1].forEach((s) => {
        put(holder, M(cylZ(0.022, 0.022, 0.34, 14), glassMat), s * 0.085, 0.0, -0.18);
        put(holder, M(cylZ(0.012, 0.012, 0.32, 12), energyMat), s * 0.085, 0.0, -0.18);
        for (let i = 0; i < 5; i++) put(holder, M(ringZ(0.024, 0.003, 14), steelMat), s * 0.085, 0.0, -0.06 - i * 0.07);
      });
      put(holder, M(rb(0.06, 0.05, 0.16, 0.008), frameMat), 0, 0.085, -0.3);
      glowBox(0, 0.114, -0.3, 0.03, 0.004, 0.1);
      break;
    }

    // ───────────────────────────── RAIL / SNIPER ─────────────────────────────
    case 'main_void_sniper': {
      // VOID SEEKER — phase vanes, long suppressor, folded bipod
      [-1, 1].forEach((s) => {
        const vane = put(holder, M(new THREE.BoxGeometry(0.003, 0.1, 0.5), glassMat), s * 0.06, 0.04, -0.55);
        vane.rotation.z = s * 0.45;
        put(holder, M(new THREE.BoxGeometry(0.004, 0.006, 0.5), energyMat), s * 0.096, 0.082, -0.55);
        rod(new THREE.Vector3(s * 0.04, 0.02, -0.42), new THREE.Vector3(s * 0.12, 0.09, -0.42), 0.003, steelMat);
      });
      put(holder, M(cylZ(0.026, 0.026, 0.3, 18), gunMat), 0, 0.03, -1.1);
      for (let i = 0; i < 5; i++) put(holder, M(ringZ(0.0275, 0.004, 16), steelMat), 0, 0.03, -0.98 - i * 0.06);
      glowSphere(0, 0.03, -1.26, 0.012);
      // folded bipod
      [-1, 1].forEach((s) => {
        rod(new THREE.Vector3(s * 0.035, -0.09, -0.5), new THREE.Vector3(s * 0.06, -0.12, -0.78), 0.006, steelMat);
        put(holder, M(rb(0.02, 0.014, 0.03, 0.004), rubberMat), s * 0.06, -0.12, -0.79);
      });
      put(holder, M(rb(0.06, 0.04, 0.05, 0.006), frameMat), 0, -0.1, -0.5);
      break;
    }
    case 'heavy_railgun': {
      // LONGINUS — coolant tanks, armour plating, flanged muzzle
      [-1, 1].forEach((s) => {
        put(holder, M(cylZ(0.036, 0.036, 0.42, 18), glassMat), s * 0.086, -0.02, -0.12);
        put(holder, M(cylZ(0.026, 0.026, 0.4, 14), energyMat), s * 0.086, -0.02, -0.12);
        [-0.33, 0.09].forEach((z) => put(holder, M(cylZ(0.04, 0.04, 0.016, 18), steelMat), s * 0.086, -0.02, z));
        put(holder, M(rb(0.02, 0.15, 0.3, 0.006), frameMat), s * 0.056, 0.0, -0.3);
        for (let i = 0; i < 5; i++) put(holder, M(new THREE.BoxGeometry(0.004, 0.1, 0.012), rubberMat), s * 0.067, 0.0, -0.18 - i * 0.05);
      });
      put(holder, M(cylZ(0.085, 0.085, 0.03, 24), steelMat), 0, 0.03, -0.96);
      put(holder, M(ringZ(0.085, 0.01, 24), energyMat), 0, 0.03, -0.98);
      put(holder, M(ringZ(0.085, 0.03, 24), glowMat), 0, 0.03, -0.98);
      around(6, 0.07, 0, 0.03, (x, y) => {
        put(holder, M(new THREE.CylinderGeometry(0.006, 0.006, 0.01, 6), steelMat), x, y, -0.945).rotateX(Math.PI / 2);
      });
      break;
    }

    // ───────────────────────────── LAUNCHERS ─────────────────────────────
    case 'heavy_launcher': {
      // SINGULARITY — floating gravity-well ring + orbiting masses
      const R = 0.1;
      put(holder, M(ringZ(R, 0.008, 40), energyMat), 0, 0.02, -0.82);
      put(holder, M(ringZ(R, 0.026, 40), glowMat), 0, 0.02, -0.82);
      put(holder, M(ringZ(R * 0.68, 0.004, 32), steelMat), 0, 0.02, -0.82);
      around(3, R, 0, 0.02, (x, y) => glowSphere(x, y, -0.82, 0.011), 0.4);
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        rod(new THREE.Vector3(Math.cos(a) * 0.07, 0.02 + Math.sin(a) * 0.07, -0.7), new THREE.Vector3(Math.cos(a) * R, 0.02 + Math.sin(a) * R, -0.82), 0.004, steelMat);
      }
      put(holder, M(new THREE.SphereGeometry(0.03, 16, 12), new THREE.MeshBasicMaterial({ color: 0x050a12 })), 0, 0.02, -0.82);
      // side ammo canisters
      [-1, 1].forEach((s) => {
        put(holder, M(cylZ(0.02, 0.02, 0.22, 14), frameMat), s * 0.094, -0.01, -0.3);
        put(holder, M(ringZ(0.0205, 0.004, 14), energyMat), s * 0.094, -0.01, -0.22);
      });
      break;
    }
    case 'heavy_frost_cannon': {
      // GLACIER — cryo tanks, ice crown, frost rimed barrel
      [-1, 1].forEach((s) => {
        put(holder, M(cylZ(0.034, 0.034, 0.4, 18), glassMat), s * 0.1, 0.035, -0.3);
        put(holder, M(cylZ(0.025, 0.025, 0.38, 14), energyMat), s * 0.1, 0.035, -0.3);
        [-0.1, -0.5].forEach((z) => put(holder, M(cylZ(0.038, 0.038, 0.016, 18), steelMat), s * 0.1, 0.035, z));
        rod(new THREE.Vector3(s * 0.1, 0.035, -0.5), new THREE.Vector3(s * 0.04, 0.02, -0.6), 0.008, steelMat);
      });
      around(8, 0.06, 0, 0.02, (x, y, a, i) => {
        const len = 0.1 + (i % 2) * 0.05;
        const spike = put(holder, M(coneZ(0.012, len, 6), glassMat), x * 1.1, 0.02 + (y - 0.02) * 1.1, -0.74 - len / 2);
        spike.rotation.z = 0;
      });
      around(8, 0.074, 0, 0.02, (x, y) => put(holder, M(new THREE.SphereGeometry(0.01, 8, 6), coreMat), x, y, -0.5 - ((x * 100) % 0.2)));
      put(holder, M(ringZ(0.075, 0.01, 28), steelMat), 0, 0.02, -0.7);
      break;
    }

    // ───────────────────────────── SHOTGUNS ─────────────────────────────
    case 'main_reaper': {
      // REAPER S-12 — flak shells on side-saddles + crown muzzle + heat shroud
      [-1, 1].forEach((s) => {
        put(holder, M(rb(0.008, 0.06, 0.27, 0.003), frameMat), s * 0.0465, 0.0, -0.02);
        for (let i = 0; i < 5; i++) {
          const z = 0.09 - i * 0.052;
          const shell = put(holder, M(new THREE.CylinderGeometry(0.0125, 0.0125, 0.045, 10), energyMat), s * 0.056, 0.0, z);
          shell.rotation.z = Math.PI / 2;
          const cap = put(holder, M(new THREE.CylinderGeometry(0.0132, 0.0132, 0.014, 10), brassMat), s * 0.0805, 0.0, z);
          cap.rotation.z = Math.PI / 2;
        }
      });
      around(5, 0.036, 0, 0.02, (x, y) => put(holder, M(coneZ(0.007, 0.03, 4), steelMat), x, y, -0.865));
      put(holder, M(ringZ(0.037, 0.005, 18), steelMat), 0, 0.02, -0.845);
      // flak counter display on the top cover
      put(holder, M(rb(0.04, 0.012, 0.07, 0.003), rubberMat), 0, 0.114, -0.1);
      glowBox(0, 0.121, -0.1, 0.024, 0.003, 0.05);
      break;
    }
    case 'main_slug_breacher': {
      // GOLIATH-10 — breaching crown + heavy shell carrier
      around(8, 0.04, 0, 0.02, (x, y) => put(holder, M(coneZ(0.011, 0.05, 4), steelMat), x, y, -0.87));
      put(holder, M(cylZ(0.046, 0.046, 0.03, 18), frameMat), 0, 0.02, -0.84);
      put(holder, M(ringZ(0.045, 0.005, 20), energyMat), 0, 0.02, -0.82);
      [-1, 1].forEach((s) => {
        put(holder, M(rb(0.016, 0.1, 0.34, 0.006), frameMat), s * 0.05, 0.0, -0.12);
        for (let i = 0; i < 4; i++) {
          const shell = put(holder, M(new THREE.CylinderGeometry(0.014, 0.014, 0.04, 10), energyMat), s * 0.062, -0.02 + (i % 2) * 0.04, -0.02 - Math.floor(i / 2) * 0.1);
          shell.rotation.z = Math.PI / 2;
          put(holder, M(new THREE.CylinderGeometry(0.0145, 0.0145, 0.012, 10), brassMat), s * 0.084, -0.02 + (i % 2) * 0.04, -0.02 - Math.floor(i / 2) * 0.1).rotation.z = Math.PI / 2;
        }
      });
      put(holder, M(rb(0.09, 0.03, 0.2, 0.006), trimMat), 0, 0.1, -0.2);
      break;
    }
    // ───────────────────────────── MELEE STRUCTURE FIXES ─────────────────────────────
    case 'blade_chainspear': {
      // Connect the winch to the harpoon head with a launch boom (the head used to float in front of the haft)
      put(holder, M(cylZ(0.03, 0.034, 0.4, 16), gunMat), 0, 0.027, -0.24);
      for (let i = 0; i < 3; i++) put(holder, M(ringZ(0.034, 0.005, 16), steelMat), 0, 0.027, -0.12 - i * 0.1);
      put(holder, M(rb(0.05, 0.05, 0.12, 0.008), frameMat), 0, 0.027, -0.02);
      glowBox(0, 0.06, -0.24, 0.006, 0.004, 0.26);
      break;
    }
    case 'blade_thunder_lance': {
      // Receiver block joining the haft to the pile housing
      put(holder, M(rb(0.07, 0.1, 0.22, 0.012), gunMat), 0, 0.0, 0.0);
      put(holder, M(rb(0.074, 0.02, 0.2, 0.006), frameMat), 0, 0.058, 0.0);
      glowBox(0.037, 0.0, 0.0, 0.004, 0.02, 0.14);
      glowBox(-0.037, 0.0, 0.0, 0.004, 0.02, 0.14);
      break;
    }

    // ───────────────────────────── MORE HEAVY WEAPONS ─────────────────────────────
    case 'heavy_hydra_missile': {
      // HYDRA — protruding launch tubes with visible warheads, hazard livery
      const offs: Array<[number, number]> = [[-0.05, 0.03], [0, 0.03], [0.05, 0.03], [-0.05, -0.03], [0, -0.03], [0.05, -0.03]];
      offs.forEach(([ox, oy]) => {
        put(holder, M(cylZ(0.024, 0.024, 0.14, 14, true), steelMat), ox, oy, -0.5);
        put(holder, M(ringZ(0.024, 0.004, 14), frameMat), ox, oy, -0.57);
        put(holder, M(cylZ(0.012, 0.012, 0.06, 10), steelMat), ox, oy, -0.5);
        put(holder, M(coneZ(0.014, 0.05, 10), energyMat), ox, oy, -0.555);
      });
      put(holder, M(rb(0.19, 0.152, 0.03, 0.01), frameMat), 0, 0, -0.43);
      [-1, 1].forEach((s) => {
        for (let i = 0; i < 6; i++) {
          put(holder, M(new THREE.BoxGeometry(0.004, 0.1, 0.018), i % 2 ? rubberMat : brassMat), s * 0.1, 0.0, -0.05 - i * 0.045).rotation.x = 0;
        }
      });
      [-1, 1].forEach((s) => put(holder, M(rb(0.02, 0.05, 0.06, 0.005), steelMat), s * 0.07, 0.1, -0.05)); // carry lugs
      break;
    }
    case 'heavy_solar_cannon': {
      // SOLAR FLARE — radiator fins + corona ring + heat-glow vents
      put(holder, M(ringZ(0.12, 0.007, 36), energyMat), 0, 0.02, -0.15);
      put(holder, M(ringZ(0.12, 0.022, 36), glowMat), 0, 0.02, -0.15);
      [-1, 1].forEach((s) => {
        for (let i = 0; i < 6; i++) put(holder, M(rb(0.012, 0.12, 0.016, 0.003), frameMat), s * 0.07, 0.0, 0.1 - i * 0.045);
        glowBox(s * 0.066, -0.075, -0.2, 0.004, 0.012, 0.3);
      });
      around(6, 0.1, 0, 0.02, (x, y) => rod(new THREE.Vector3(x * 0.4, 0.02 + (y - 0.02) * 0.4, -0.15), new THREE.Vector3(x, y, -0.15), 0.003, trimMat));
      break;
    }
    // ───────────────────────────── NEW ARSENAL ─────────────────────────────
    case 'sub_chrono': {
      // CHRONOS-7 — clockwork gear on the slide, clock face at the rear, coil rings and a pendulum
      [-1, 1].forEach((sx) => {
        const gear = new THREE.Group();
        put(gear, M(new THREE.TorusGeometry(0.03, 0.006, 6, 20), brassMat));
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2;
          const t = put(gear, M(new THREE.BoxGeometry(0.008, 0.012, 0.006), brassMat), Math.cos(a) * 0.036, Math.sin(a) * 0.036, 0);
          t.rotation.z = a;
        }
        put(gear, M(new THREE.CircleGeometry(0.022, 16), energyMat));
        gear.rotation.y = Math.PI / 2;
        put(holder, gear, sx * 0.035, 0.05, -0.08);
      });
      put(holder, M(cylZ(0.03, 0.03, 0.012, 20), brassMat), 0, 0.06, 0.1);
      put(holder, M(new THREE.CircleGeometry(0.026, 20), glassMat), 0, 0.06, 0.107);
      for (let i = 0; i < 3; i++) put(holder, M(ringZ(0.026, 0.005, 18), energyMat), 0, 0.04, -0.37 - i * 0.022);
      rod(new THREE.Vector3(0, -0.02, -0.28), new THREE.Vector3(0, -0.09, -0.27), 0.003, brassMat);
      glowSphere(0, -0.095, -0.27, 0.012);
      break;
    }
    case 'sub_hive': {
      // MICRO HIVE — 2×3 micro-missile pod riding on top of the slide, sensor dome at the front
      put(holder, M(rb(0.08, 0.055, 0.2, 0.01), frameMat), 0, 0.125, -0.14);
      for (let r = 0; r < 2; r++) {
        for (let c = 0; c < 3; c++) {
          const x = (c - 1) * 0.024;
          const y = 0.112 + r * 0.026;
          put(holder, M(cylZ(0.009, 0.009, 0.2, 8, true), gunMat), x, y, -0.15);
          put(holder, M(coneZ(0.008, 0.02, 8), energyMat), x, y, -0.255);
        }
      }
      put(holder, M(new THREE.SphereGeometry(0.02, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), glassMat), 0, 0.152, -0.05).rotation.x = -Math.PI / 2;
      glowBox(0, 0.153, -0.2, 0.05, 0.004, 0.06);
      break;
    }
    case 'sub_flare': {
      // HELIX FLARE — fat flare tube with hazard stripes, spare flares on the side
      put(holder, M(cylZ(0.038, 0.038, 0.24, 18), frameMat), 0, 0.04, -0.3);
      put(holder, M(cylZ(0.042, 0.042, 0.02, 18), trimMat), 0, 0.04, -0.42);
      for (let i = 0; i < 4; i++) put(holder, M(ringZ(0.039, 0.006, 18), i % 2 ? energyMat : rubberMat), 0, 0.04, -0.21 - i * 0.05);
      put(holder, M(new THREE.CircleGeometry(0.03, 16), glowMat), 0, 0.04, -0.432);
      [0, 1].forEach((i) => {
        put(holder, M(cylZ(0.012, 0.012, 0.07, 10), brassMat), 0.05, -0.02 - i * 0.03, -0.02);
        put(holder, M(cylZ(0.0125, 0.0125, 0.012, 10), energyMat), 0.05, -0.02 - i * 0.03, -0.06);
      });
      break;
    }
    case 'main_needler': {
      // SPINE NEEDLER — a dome of crystal needles on top, crystal spines along the handguard
      const crystal = new THREE.MeshStandardMaterial({ color: 0xfbcfe8, emissive: accent, emissiveIntensity: 0.6, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.9 });
      put(holder, M(new THREE.SphereGeometry(0.06, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), glassMat), 0, 0.09, -0.12);
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        const n = put(holder, M(new THREE.ConeGeometry(0.008, 0.07, 5), crystal), Math.cos(a) * 0.03, 0.115, -0.12 + Math.sin(a) * 0.03);
        n.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
      }
      [-1, 1].forEach((sx) => {
        for (let i = 0; i < 5; i++) {
          const sp = put(holder, M(new THREE.ConeGeometry(0.008, 0.05, 4), crystal), sx * 0.045, 0.04, -0.34 - i * 0.05);
          sp.rotation.z = -sx * 1.2;
        }
      });
      glowSphere(0, 0.01, -0.83, 0.016);
      break;
    }
    case 'main_sonic': {
      // ECHO RESONATOR — flared speaker horn with concentric emitter rings + tuning prongs
      put(holder, M(cylZ(0.085, 0.03, 0.16, 24, true), frameMat), 0, 0.01, -0.88);
      for (let i = 0; i < 3; i++) put(holder, M(ringZ(0.04 + i * 0.022, 0.004, 28), energyMat), 0, 0.01, -0.9 - i * 0.02);
      put(holder, M(new THREE.CircleGeometry(0.08, 28), glowMat), 0, 0.01, -0.96);
      [-1, 1].forEach((sx) => {
        put(holder, M(rb(0.008, 0.008, 0.2, 0.002), steelMat), sx * 0.05, 0.07, -0.5);
        glowSphere(sx * 0.05, 0.07, -0.61, 0.008);
      });
      for (let i = 0; i < 4; i++) put(holder, M(ringZ(0.048, 0.006, 20), trimMat), 0, 0.01, -0.36 - i * 0.07);
      break;
    }
    case 'main_buzzsaw': {
      // BUZZ RIPPER — a loaded saw blade spinning on top of the tube, side guide rails
      const saw = new THREE.Group();
      put(saw, M(new THREE.CylinderGeometry(0.1, 0.1, 0.008, 28), steelMat));
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * Math.PI * 2;
        const t = put(saw, M(new THREE.ConeGeometry(0.012, 0.03, 3), steelMat), Math.cos(a) * 0.108, 0, Math.sin(a) * 0.108);
        t.rotation.set(0, -a, Math.PI / 2);
      }
      put(saw, M(new THREE.CylinderGeometry(0.025, 0.025, 0.014, 12), energyMat));
      put(holder, saw, 0, 0.11, -0.36);
      [-1, 1].forEach((sx) => put(holder, M(rb(0.01, 0.03, 0.36, 0.004), frameMat), sx * 0.11, 0.1, -0.36));
      put(holder, M(new THREE.RingGeometry(0.08, 0.13, 28), glowMat), 0, 0.12, -0.36).rotation.x = -Math.PI / 2;
      break;
    }
    case 'heavy_meteor': {
      // METEOR CALLER — targeting dish + uplink antenna, heavy muzzle collar with a red beacon
      const dish = put(holder, M(new THREE.SphereGeometry(0.07, 16, 8, 0, Math.PI * 2, 0, Math.PI / 3), steelMat), 0.07, 0.13, -0.2);
      dish.rotation.set(-0.9, 0, 0.3);
      rod(new THREE.Vector3(0.07, 0.09, -0.2), new THREE.Vector3(0.07, 0.2, -0.26), 0.004, frameMat);
      glowSphere(0.07, 0.2, -0.26, 0.012);
      put(holder, M(cylZ(0.09, 0.09, 0.06, 24), trimMat), 0, 0.02, -0.66);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        put(holder, M(new THREE.BoxGeometry(0.012, 0.012, 0.08), rubberMat), Math.cos(a) * 0.095, 0.02 + Math.sin(a) * 0.095, -0.62);
      }
      glowBox(0, 0.1, -0.45, 0.012, 0.012, 0.2);
      break;
    }
    case 'heavy_sentry': {
      // VOLT SENTRY — a turret canister loaded in the muzzle, tesla coil wraps and charge prongs
      put(holder, M(cylZ(0.06, 0.06, 0.16, 18), steelMat), 0, 0.02, -0.72);
      for (let i = 0; i < 4; i++) put(holder, M(ringZ(0.062, 0.006, 20), brassMat), 0, 0.02, -0.66 - i * 0.035);
      glowSphere(0, 0.02, -0.81, 0.03);
      around(4, 0.085, 0, 0.02, (x, y) => rod(new THREE.Vector3(x, y, -0.6), new THREE.Vector3(x * 1.2, 0.02 + (y - 0.02) * 1.2, -0.76), 0.004, steelMat), Math.PI / 4);
      for (let i = 0; i < 5; i++) put(holder, M(ringZ(0.074, 0.005, 22), energyMat), 0, 0.02, -0.18 - i * 0.07);
      break;
    }
    case 'heavy_inferno': {
      // INFERNO ROAR — twin fuel tanks under the tube, pilot-light nozzle, heat-shield ribs
      [-1, 1].forEach((sx) => {
        put(holder, M(cylZ(0.035, 0.035, 0.34, 16), brassMat), sx * 0.05, -0.1, -0.22);
        put(holder, M(new THREE.SphereGeometry(0.035, 12, 8), brassMat), sx * 0.05, -0.1, -0.05);
        put(holder, M(new THREE.SphereGeometry(0.035, 12, 8), brassMat), sx * 0.05, -0.1, -0.39);
        glowBox(sx * 0.05, -0.065, -0.22, 0.012, 0.004, 0.22);
      });
      put(holder, M(cylZ(0.05, 0.07, 0.12, 18), frameMat), 0, 0.02, -0.74);
      put(holder, M(ringZ(0.05, 0.008, 20), energyMat), 0, 0.02, -0.8);
      glowSphere(0, -0.03, -0.79, 0.012); // pilot light
      for (let i = 0; i < 6; i++) put(holder, M(rb(0.16, 0.008, 0.02, 0.003), frameMat), 0, 0.1, -0.2 - i * 0.06);
      break;
    }
    default:
      break;
  }
}
