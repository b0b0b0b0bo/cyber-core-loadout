import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { createRig, EnemyRig } from './enemyAnimation';
import { panelTexture } from './bossModels';

/**
 * Elite enemy roster (MAP 2+). Built at a higher detail level than the base roster: bevelled armour with
 * panel textures, lathe-turned bodies, extruded blades, tubes and layered emissive trims. Each type has a
 * dedicated animator (`rig.custom`) that reads the AI's action cue (`rig.act`) to play its signature moves.
 *
 *   mender  HALO MENDER   修復天使ドローン   — floating support unit, heals allies with a tether beam
 *   wyrm    DUNE WYRM     掘削蛇機           — segmented worm, burrows and erupts under the player
 *   jester  PHASE JESTER  位相道化機         — acrobat that blinks around the player and throws chakrams
 *   carrier HIVE CARRIER  母艦蟲機           — flying brood ship that births mites and spits acid
 *   lancer  MANTIS LANCER 光刃蟷螂機         — mantis that sweeps a jumpable ground laser, slashes up close
 *   mite    HIVE MITE     子機               — small crawler released by the carrier (hound AI)
 *
 * Every model faces -Z with its feet on y = 0 (flying types are centred on their origin).
 */

export const ELITE_TYPES = ['mender', 'wyrm', 'jester', 'carrier', 'lancer', 'mite'] as const;
export type EliteType = (typeof ELITE_TYPES)[number];
export const isEliteType = (t: string): t is EliteType => (ELITE_TYPES as readonly string[]).includes(t);

export interface EliteStats {
  hp: number;
  speed: number;
  damage: number;
}

export const damp = (cur: number, target: number, rate: number, dt: number) => cur + (target - cur) * (1 - Math.exp(-rate * dt));

// ───────────────────────── textures ─────────────────────────
let harlequinTex: THREE.CanvasTexture | null = null;
function harlequinTexture(): THREE.CanvasTexture {
  if (harlequinTex) return harlequinTex;
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  g.fillStyle = '#1a0b2e';
  g.fillRect(0, 0, S, S);
  const n = 4;
  const w = S / n;
  for (let r = 0; r < n * 2; r++) {
    for (let q = 0; q < n + 1; q++) {
      const cx = q * w + (r % 2 ? w / 2 : 0);
      const cy = (r * w) / 2;
      g.beginPath();
      g.moveTo(cx, cy - w / 2);
      g.lineTo(cx + w / 2, cy);
      g.lineTo(cx, cy + w / 2);
      g.lineTo(cx - w / 2, cy);
      g.closePath();
      g.fillStyle = (r + q) % 2 ? '#6b21a8' : '#0f0618';
      g.fill();
      g.strokeStyle = 'rgba(253, 224, 71, 0.55)';
      g.lineWidth = 2;
      g.stroke();
    }
  }
  harlequinTex = new THREE.CanvasTexture(c);
  harlequinTex.colorSpace = THREE.SRGBColorSpace;
  harlequinTex.wrapS = harlequinTex.wrapT = THREE.RepeatWrapping;
  return harlequinTex;
}

// ───────────────────────── kit ─────────────────────────
export function kit() {
  // the battle scenes have no environment map: keep metalness low and add a faint self-glow of the base
  // colour so armour never collapses to black on the dark side
  const armor = (color: number, tex: THREE.Texture, metal = 0.45, rough = 0.42, clear = 0.5) =>
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.5),
      map: tex,
      bumpMap: tex,
      bumpScale: 1.2,
      metalness: Math.min(metal * 0.5, 0.25),
      roughness: Math.max(rough, 0.42),
      clearcoat: clear,
      clearcoatRoughness: 0.35,
      emissive: new THREE.Color(color).multiplyScalar(0.16),
    });
  const solid = (color: number, metal = 0.7, rough = 0.35) => new THREE.MeshStandardMaterial({ color, metalness: metal, roughness: rough });
  const emis = (color: number, emissive: number, intensity = 0.8) =>
    new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: intensity, metalness: 0.3, roughness: 0.3 });
  const glow = (color: number) => new THREE.MeshBasicMaterial({ color });
  const halo = (color: number, opacity = 0.28) =>
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });
  const glass = (color: number, opacity = 0.45, emissive = 0x000000) =>
    new THREE.MeshPhysicalMaterial({ color, transparent: true, opacity, roughness: 0.08, metalness: 0.1, clearcoat: 1, emissive, emissiveIntensity: 0.5, side: THREE.DoubleSide, depthWrite: false });

  const rbox = (w: number, h: number, d: number, r = 0.05) =>
    new RoundedBoxGeometry(w, h, d, 2, Math.max(0.005, Math.min(r, w / 2 - 0.002, h / 2 - 0.002, d / 2 - 0.002)));
  const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
  const cyl = (rt: number, rb: number, h: number, seg = 14) => new THREE.CylinderGeometry(rt, rb, h, seg);
  const sph = (r: number, seg = 16) => new THREE.SphereGeometry(r, seg, Math.max(8, seg - 4));
  const cone = (r: number, h: number, seg = 6) => new THREE.ConeGeometry(r, h, seg);
  const torus = (R: number, r: number, seg = 40, tube = 8, arc = Math.PI * 2) => new THREE.TorusGeometry(R, r, tube, seg, arc);
  const lathe = (pts: [number, number][], seg = 20) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg);
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

  const mk = (parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    parent.add(m);
    return m;
  };
  const grp = (parent: THREE.Object3D, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.set(rx, ry, rz);
    parent.add(g);
    return g;
  };
  /** Tapered strut between two points. */
  const strut = (parent: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3, r0: number, r1: number, mat: THREE.Material, seg = 10) => {
    const dir = new THREE.Vector3().subVectors(b, a);
    const len = dir.length();
    const m = new THREE.Mesh(cyl(r1, r0, len, seg), mat);
    m.position.copy(a).addScaledVector(dir, 0.5);
    m.quaternion.setFromUnitVectors(V(0, 1, 0), dir.normalize());
    parent.add(m);
    return m;
  };
  const tube = (parent: THREE.Object3D, pts: THREE.Vector3[], r: number, mat: THREE.Material, seg = 20) =>
    mk(parent, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), seg, r, 6, false), mat);
  /** Tapering blade pointing +Y (length len, base width w, thickness t). */
  const blade = (len: number, w: number, t: number, curve = 0) => {
    const sh = new THREE.Shape();
    sh.moveTo(-w / 2, 0);
    sh.lineTo(w / 2, 0);
    sh.quadraticCurveTo(w * 0.5 + curve, len * 0.55, curve * 1.6, len);
    sh.quadraticCurveTo(-w * 0.35 + curve, len * 0.5, -w / 2, 0);
    const g = new THREE.ExtrudeGeometry(sh, { depth: t, bevelEnabled: true, bevelThickness: t * 0.3, bevelSize: t * 0.3, bevelSegments: 1, curveSegments: 8 });
    g.translate(0, 0, -t / 2);
    return g;
  };
  /** Feather / leaf shape pointing +Y. */
  const feather = (len: number, w: number, t: number) => {
    const sh = new THREE.Shape();
    sh.moveTo(0, 0);
    sh.bezierCurveTo(w * 0.7, len * 0.15, w * 0.6, len * 0.7, 0, len);
    sh.bezierCurveTo(-w * 0.35, len * 0.65, -w * 0.45, len * 0.2, 0, 0);
    const g = new THREE.ExtrudeGeometry(sh, { depth: t, bevelEnabled: true, bevelThickness: t * 0.4, bevelSize: t * 0.4, bevelSegments: 2, curveSegments: 10 });
    g.translate(0, 0, -t / 2);
    return g;
  };

  /** Two-segment articulated limb: pivots at `a` and `b`, ends at `c` (model-space coordinates). */
  const artic = (
    parent: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3,
    rU: number, rL: number, mU: THREE.Material, mL: THREE.Material, kneeR = 0, kneeMat?: THREE.Material,
  ) => {
    const up = new THREE.Group();
    up.position.copy(a);
    parent.add(up);
    const low = new THREE.Group();
    low.position.copy(b).sub(a);
    up.add(low);
    strut(up, V(0, 0, 0), b.clone().sub(a), rU, rU * 0.85, mU);
    if (kneeR > 0) mk(low, sph(kneeR, 12), kneeMat ?? mL);
    strut(low, V(0, 0, 0), c.clone().sub(b), rL, rL * 0.7, mL);
    const onUp = (geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => mk(up, geo, mat, x - a.x, y - a.y, z - a.z, rx, ry, rz);
    const onLow = (geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => mk(low, geo, mat, x - b.x, y - b.y, z - b.z, rx, ry, rz);
    return { up, low, onUp, onLow };
  };

  return { armor, solid, emis, glow, halo, glass, rbox, box, cyl, sph, cone, torus, lathe, V, mk, grp, strut, tube, blade, feather, artic };
}

// ───────────────────────── HALO MENDER ─────────────────────────
function buildMender(root: THREE.Group, rig: EnemyRig): EliteStats {
  const K = kit();
  const { armor, solid, glow, halo, glass, rbox, box, cyl, sph, cone, torus, lathe, mk, grp, feather } = K;
  const body = new THREE.Group();
  root.add(body);
  rig.body = body;
  const pearl = armor(0xdbe6f5, panelTexture('#b8c7dc', '#ffffff', 4), 0.35, 0.38, 0.9);
  const gold = armor(0xd4a537, panelTexture('#8a6514', '#fde68a', 3), 0.8, 0.3);
  const dark = solid(0x17202e, 0.6, 0.4);
  const heal = glow(0x4ade80);
  const healSoft = halo(0x86efac, 0.3);
  const white = glow(0xf0fdf4);

  // lantern body
  mk(body, lathe([[0, -0.62], [0.18, -0.6], [0.36, -0.45], [0.48, -0.15], [0.5, 0.08], [0.42, 0.32], [0.26, 0.5], [0.1, 0.6], [0, 0.62]], 28), pearl);
  const shell = mk(body, sph(0.5, 24), glass(0xd1fae5, 0.25, 0x14532d));
  shell.scale.set(1.04, 1.1, 1.04);
  for (let i = 0; i < 4; i++) mk(body, torus(0.5, 0.02, 48, 6), gold, 0, 0, 0, 0, (i / 4) * Math.PI, 0); // cage meridians
  mk(body, torus(0.505, 0.035, 48, 8), gold, 0, 0.0, 0, Math.PI / 2, 0, 0);
  mk(body, torus(0.4, 0.03, 40, 8), gold, 0, -0.38, 0, Math.PI / 2, 0, 0);
  mk(body, torus(0.32, 0.028, 40, 8), gold, 0, 0.38, 0, Math.PI / 2, 0, 0);
  const core = mk(body, sph(0.24, 18), white);
  const coreHalo = mk(body, sph(0.46, 18), healSoft);
  rig.pulses.push({ obj: core, amp: 1.2, speed: 1.4 }, { obj: coreHalo, amp: 1.0, phase: 0.6 });
  // face mask with a single slit visor
  mk(body, rbox(0.44, 0.52, 0.14, 0.06), pearl, 0, 0.04, -0.46);
  mk(body, box(0.06, 0.36, 0.03), heal, 0, 0.04, -0.54);
  mk(body, cone(0.05, 0.18, 4), gold, 0, 0.33, -0.5, Math.PI, 0, 0);
  // crown spire + finials
  mk(body, cyl(0.1, 0.16, 0.16, 12), gold, 0, 0.66, 0);
  mk(body, cone(0.09, 0.55, 8), gold, 0, 1.0, 0);
  mk(body, new THREE.OctahedronGeometry(0.08, 0), white, 0, 1.33, 0);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    mk(body, cone(0.035, 0.22, 4), gold, Math.cos(a) * 0.2, 0.8, Math.sin(a) * 0.2, Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3);
  }
  // twin halo rings behind the head
  const haloP = grp(body, 0, 0.6, 0.32, -0.3, 0, 0);
  const ringA = grp(haloP);
  mk(ringA, torus(0.82, 0.035, 56, 8), gold);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    mk(ringA, i % 3 === 0 ? new THREE.OctahedronGeometry(0.07, 0) : sph(0.04, 8), i % 3 === 0 ? heal : white, Math.cos(a) * 0.82, Math.sin(a) * 0.82, 0);
  }
  const ringB = grp(haloP);
  mk(ringB, torus(0.66, 0.018, 48, 6), heal);
  mk(haloP, torus(0.82, 0.16, 40, 8), halo(0x86efac, 0.12));
  rig.spinners.push({ obj: ringA, axis: 'z', speed: 0.9 }, { obj: ringB, axis: 'z', speed: -1.8 });

  // four petal wings
  const wings: { obj: THREE.Object3D; side: number; base: number; upper: boolean }[] = [];
  [-1, 1].forEach((s) => {
    [0, 1].forEach((j) => {
      const upper = j === 0;
      const base = upper ? -s * 0.85 : -s * 2.25;
      const wp = grp(body, s * 0.36, upper ? 0.18 : -0.2, 0.15, 0, 0, base);
      const len = upper ? 1.55 : 1.05;
      mk(wp, feather(len, 0.55, 0.05), pearl, 0, 0.05, 0);
      mk(wp, box(0.025, len * 0.8, 0.03), heal, 0.04, len * 0.45, -0.04);
      for (let f = 0; f < 3; f++) {
        const sub = mk(wp, feather(len * (0.72 - f * 0.12), 0.32, 0.035), f % 2 ? gold : pearl, 0, 0.1, 0.05 + f * 0.03, 0, 0, s * (0.28 + f * 0.22));
        sub.scale.x = 0.9;
      }
      mk(wp, sph(0.08, 10), gold, 0, 0.02, 0);
      wings.push({ obj: wp, side: s, base, upper });
    });
  });
  // dangling censer tendrils
  const tendrils: THREE.Object3D[][] = [];
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + Math.PI / 2;
    let parent: THREE.Object3D = grp(body, Math.cos(a) * 0.2, -0.6, Math.sin(a) * 0.2);
    const chain: THREE.Object3D[] = [];
    for (let j = 0; j < 4; j++) {
      const seg = grp(parent, 0, j === 0 ? 0 : -0.3, 0);
      mk(seg, cyl(0.018, 0.022, 0.3, 6), dark, 0, -0.15, 0);
      mk(seg, sph(0.04, 8), j === 3 ? heal : gold, 0, -0.3, 0);
      chain.push(seg);
      parent = seg;
    }
    mk(parent, new THREE.OctahedronGeometry(0.09, 0), heal, 0, -0.42, 0);
    mk(parent, sph(0.2, 10), healSoft, 0, -0.42, 0);
    tendrils.push(chain);
  }
  // heal emitter under the lantern
  const emitter = grp(body, 0, -0.66, 0);
  mk(emitter, torus(0.16, 0.03, 24, 6), heal, 0, 0, 0, Math.PI / 2, 0, 0);
  mk(emitter, cone(0.1, 0.22, 8), gold, 0, -0.05, 0, Math.PI, 0, 0);
  rig.spinners.push({ obj: emitter, axis: 'y', speed: 2.4 });

  rig.hover = { bob: 0.14, tilt: 0.05 };
  rig.lunge = 0.1;
  rig.extras = { wings, tendrils, haloP, open: 0, fold: 0, core };
  rig.custom = (r, time, dt, move) => {
    const E = r.extras;
    const act = r.act;
    const healK = act.name === 'heal' ? act.k : 0;
    const flee = act.name === 'flee' ? act.k : 0;
    const cast = act.name === 'cast' ? act.k : 0;
    const pulse = act.name === 'sanctum' ? act.k : 0;
    E.open = damp(E.open, healK * 0.55 + cast * 0.35 + pulse * 0.8, 6, dt);
    E.fold = damp(E.fold, flee, 5, dt);
    const flapSpeed = 2.6 + healK * 3 + flee * 5;
    for (const w of E.wings as typeof wings) {
      const flap = Math.sin(time * flapSpeed + (w.upper ? 0 : 1.3) + w.side) * 0.12 * (1 - E.fold * 0.5);
      w.obj.rotation.z = w.upper ? w.base - w.side * (E.open + flap - E.fold * 0.5) : w.base + w.side * (E.open * 0.6 + flap * 0.6 + E.fold * 0.3);
      w.obj.rotation.x = E.fold * 0.9 - move * 0.15;
    }
    (E.tendrils as THREE.Object3D[][]).forEach((chain, i) => {
      chain.forEach((seg, j) => {
        seg.rotation.x = Math.sin(time * 1.9 + i * 2.1 + j * 0.6) * 0.18 + move * 0.25;
        seg.rotation.z = Math.cos(time * 1.5 + i + j * 0.8) * 0.14;
      });
    });
    const hs = 1 + healK * 0.2 + pulse * 0.45;
    E.haloP.scale.setScalar(hs);
  };
  return { hp: 165, speed: 4.6, damage: 14 };
}

// ───────────────────────── DUNE WYRM ─────────────────────────
const WYRM_SEGS = 11;
const WYRM_SPACING = 0.6;
const WYRM_HEIGHT = 3.6;

function buildWyrm(root: THREE.Group, rig: EnemyRig): EliteStats {
  const K = kit();
  const { armor, solid, emis, glow, halo, rbox, cyl, sph, cone, torus, lathe, mk, grp, blade } = K;
  const sand = armor(0xc7a26a, panelTexture('#8a6a3c', '#f5deb3', 4), 0.3, 0.55);
  const plate = armor(0x6b4f2c, panelTexture('#4a3519', '#d6b37a', 5), 0.45, 0.45);
  const belly = armor(0xe8d6b0, panelTexture('#b59a6c', '#fff7e0', 6), 0.2, 0.6);
  const bone = solid(0xefe4cc, 0.2, 0.5);
  const dark = solid(0x1a120a, 0.5, 0.5);
  const ember = glow(0xff8a1f);
  const W = new THREE.Group();
  root.add(W);

  // ── head ──
  const head = grp(W);
  mk(head, rbox(1.15, 0.85, 1.25, 0.28), sand, 0, 0, 0.05);
  mk(head, rbox(1.25, 0.24, 1.0, 0.1), plate, 0, 0.44, 0.15, -0.12, 0, 0); // brow plate
  for (let i = 0; i < 3; i++) mk(head, cone(0.09, 0.55 - i * 0.1, 5), bone, 0, 0.58, 0.25 + i * 0.32, -0.9, 0, 0); // crest spines
  [-1, 1].forEach((s) => {
    mk(head, rbox(0.25, 0.6, 1.0, 0.08), plate, s * 0.6, -0.02, 0.1, 0, s * 0.1, 0);
    for (let i = 0; i < 3; i++) mk(head, sph(0.065, 8), ember, s * 0.62, 0.15 - i * 0.14, -0.28 + i * 0.12); // eye rows
    mk(head, cone(0.08, 0.45, 5), bone, s * 0.52, 0.32, 0.55, -0.6, 0, s * 0.6);
  });
  // mouth: ring of teeth + glowing throat
  const mouth = grp(head, 0, 0, -0.55);
  mk(mouth, torus(0.42, 0.07, 32, 8), dark, 0, 0, 0);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const t = mk(mouth, cone(0.05, 0.22, 4), bone, Math.cos(a) * 0.36, Math.sin(a) * 0.36, -0.02);
    t.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(-Math.cos(a), -Math.sin(a), -0.6).normalize());
  }
  const throat = mk(mouth, sph(0.3, 16), ember, 0, 0, 0.25);
  const throatHalo = mk(mouth, sph(0.5, 14), halo(0xffa94d, 0.35), 0, 0, 0.1);
  rig.pulses.push({ obj: throat, amp: 1.4, speed: 1.6 }, { obj: throatHalo, amp: 1.2 });
  // three mandible petals around the mouth
  const petals: THREE.Object3D[] = [];
  for (let i = 0; i < 3; i++) {
    const th = Math.PI / 2 + (i / 3) * Math.PI * 2;
    const pr = grp(mouth, 0, 0, 0, 0, 0, th - Math.PI / 2);
    const hinge = grp(pr, 0, 0.36, 0.05);
    mk(hinge, blade(1.0, 0.62, 0.07, 0), plate, 0, 0, 0, -Math.PI / 2, 0, 0);
    mk(hinge, blade(0.75, 0.3, 0.05, 0), bone, 0, -0.08, -0.05, -Math.PI / 2 - 0.15, 0, 0);
    for (let j = 0; j < 3; j++) mk(hinge, cone(0.035, 0.16, 4), bone, (j - 1) * 0.14, -0.08, -0.35 - j * 0.15, Math.PI, 0, 0);
    petals.push(hinge);
  }

  // ── body segments (each built around its local Z axis; front = -Z) ──
  const segs: { g: THREE.Object3D; r: number }[] = [];
  for (let i = 0; i < WYRM_SEGS; i++) {
    const r = 0.56 * (1 - (i / WYRM_SEGS) * 0.58);
    const g = grp(W);
    const barrel = lathe([[r * 0.78, -0.34], [r, -0.2], [r * 1.04, 0.05], [r * 0.95, 0.24], [r * 0.8, 0.36]], 18);
    barrel.rotateX(Math.PI / 2);
    mk(g, barrel, i % 2 ? sand : plate);
    mk(g, rbox(r * 1.5, r * 0.4, 0.55, 0.06), plate, 0, r * 0.82, 0, 0.05, 0, 0); // dorsal plate
    mk(g, rbox(r * 1.2, r * 0.25, 0.5, 0.05), belly, 0, -r * 0.85, 0);           // belly plate
    mk(g, cone(0.06, 0.22 + r * 0.55, 5), bone, 0, r * 1.15, 0.05, 0.55, 0, 0);  // dorsal spine
    [-1, 1].forEach((s) => mk(g, cone(0.045, 0.18 + r * 0.3, 4), bone, s * r * 1.0, r * 0.2, 0.05, 0.4, 0, -s * 1.2));
    mk(g, torus(r * 0.97, 0.026, 24, 6), ember, 0, 0, 0.33);
    segs.push({ g, r });
  }
  // tail fin
  const last = segs[segs.length - 1].g;
  [-1, 0, 1].forEach((s) => mk(last, blade(0.7, 0.3, 0.05, 0), bone, s * 0.12, 0.05, 0.35, Math.PI / 2 - 0.3, 0, s * 0.6));

  // ── burrow mound (kept on the floor while the body tunnels underground) ──
  const mound = grp(root);
  const dirt = new THREE.MeshStandardMaterial({ color: 0x8a6a3c, roughness: 0.95, metalness: 0 });
  const hump = mk(mound, sph(1.1, 16), dirt, 0, -0.35, 0);
  hump.scale.set(1.2, 0.45, 1.5);
  const rocks: THREE.Object3D[] = [];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const rk = mk(mound, new THREE.DodecahedronGeometry(0.12 + (i % 3) * 0.06, 0), dirt, Math.cos(a) * 1.2, 0.1, Math.sin(a) * 1.4);
    rocks.push(rk);
  }
  const dust = mk(mound, torus(1.25, 0.25, 32, 8), halo(0xd6b37a, 0.22), 0, 0.1, 0, Math.PI / 2, 0, 0);
  mound.visible = false;

  rig.lunge = 0.35;
  rig.extras = {
    head, segs, petals, mound, rocks, dust,
    ph: 0, open: 0, rear: 0.55, sink: 0,
    pts: Array.from({ length: WYRM_SEGS + 1 }, () => new THREE.Vector3()),
  };

  const tmpA = new THREE.Vector3();
  const tmpB = new THREE.Vector3();
  const fwd = new THREE.Vector3(0, 0, -1);
  /** Lay the head + segments along a curve blending a ground slither (rear=0) and an upright strike pose (rear=1). */
  const layout = (E: any) => {
    const pts = E.pts as THREE.Vector3[];
    const rear = E.rear as number;
    for (let i = 0; i <= WYRM_SEGS; i++) {
      const s = i * WYRM_SPACING;
      const r = i === 0 ? 0.5 : segs[i - 1].r;
      const wave = Math.min(1, s / 1.4);
      // lying: snake trailing back along +Z
      const lx = Math.sin(E.ph - s * 1.15) * 0.42 * wave;
      const ly = r;
      const lz = s - 1.0;
      // upright: column rising from the floor, head leaning toward the player
      let ux: number, uy: number, uz: number;
      if (s < WYRM_HEIGHT) {
        const h = WYRM_HEIGHT - s;
        ux = Math.sin(E.ph * 0.6 - s) * 0.12 * (h / WYRM_HEIGHT);
        uy = h + r * 0.6;
        uz = -h * 0.22 - 0.4;
      } else {
        ux = Math.sin(E.ph - s * 1.1) * 0.3;
        uy = r;
        uz = s - WYRM_HEIGHT - 0.4;
      }
      pts[i].set(lx + (ux - lx) * rear, ly + (uy - ly) * rear - E.sink, lz + (uz - lz) * rear);
    }
    head.position.copy(pts[0]);
    for (let i = 0; i < WYRM_SEGS; i++) {
      const g = segs[i].g;
      g.position.copy(pts[i + 1]);
      tmpA.subVectors(pts[i], pts[i + 1]).normalize();
      g.quaternion.setFromUnitVectors(fwd, tmpA);
    }
    // head looks along the neck while slithering, down at the player while reared
    tmpA.subVectors(pts[0], pts[1]).normalize();
    tmpB.set(0, -0.38, -1).normalize();
    tmpA.lerp(tmpB, rear).normalize();
    head.quaternion.setFromUnitVectors(fwd, tmpA);
  };
  layout(rig.extras);
  petals.forEach((p) => (p.rotation.x = 0.25));

  rig.custom = (r, time, dt, move, mesh) => {
    const E = r.extras;
    const a = r.act;
    E.ph += dt * (2.2 + move * 7);
    let rearT = 0, sinkT = 0, openT = 0.05;
    switch (a.name) {
      case 'rear': rearT = a.k; openT = 0.15 + a.k * 0.3; break;
      case 'spit': rearT = 0.55 + a.k * 0.25; openT = a.k; break;
      case 'burrow': rearT = 0.75 * Math.sin(a.k * Math.PI); sinkT = Math.max(0, (a.k - 0.25) / 0.75) * 6; openT = 0.6; break;
      case 'tunnel': sinkT = 6; break;
      case 'erupt': rearT = 1; sinkT = (1 - a.k) * 5; openT = 1; break;
    }
    E.rear = damp(E.rear, rearT, a.name === 'erupt' ? 30 : 5, dt);
    E.sink = a.name === 'erupt' || a.name === 'tunnel' ? sinkT : damp(E.sink, sinkT, 8, dt);
    E.open = damp(E.open, openT, 10, dt);
    (E.petals as THREE.Object3D[]).forEach((p, i) => (p.rotation.x = -0.1 + E.open * 1.05 + Math.sin(time * 9 + i) * 0.04 * E.open));
    layout(E);
    // mound rides on the floor above the tunnelling body
    const mound = E.mound as THREE.Object3D;
    mound.visible = a.name === 'tunnel';
    if (mound.visible) {
      mound.position.set(0, -mesh.position.y, 0);
      (E.rocks as THREE.Object3D[]).forEach((rk, i) => {
        rk.position.y = 0.1 + Math.abs(Math.sin(time * 7 + i * 1.7)) * 0.35;
        rk.rotation.x += dt * 3;
      });
      (E.dust as THREE.Object3D).rotation.z += dt * 2;
      mound.scale.setScalar(1 + Math.sin(time * 9) * 0.06);
    }
  };
  return { hp: 300, speed: 5.0, damage: 30 };
}

// ───────────────────────── PHASE JESTER ─────────────────────────
function buildJester(root: THREE.Group, rig: EnemyRig): EliteStats {
  const K = kit();
  const { solid, glow, halo, rbox, cyl, sph, cone, torus, lathe, V, mk, grp, tube, blade, artic } = K;
  const body = new THREE.Group();
  root.add(body);
  rig.body = body;
  const suit = new THREE.MeshPhysicalMaterial({ color: 0xffffff, map: harlequinTexture(), roughness: 0.45, metalness: 0.2, clearcoat: 0.6, clearcoatRoughness: 0.3 });
  const porcelain = new THREE.MeshPhysicalMaterial({ color: 0xf8f5ff, roughness: 0.2, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.1 });
  const gold = new THREE.MeshPhysicalMaterial({ color: 0xe0b23a, roughness: 0.25, metalness: 0.9, clearcoat: 0.5 });
  const dark = solid(0x0d0614, 0.6, 0.4);
  const steel = solid(0xd8d4e8, 0.95, 0.15);
  const magenta = glow(0xe879f9);
  const cyan = glow(0x67e8f9);

  // legs (slim, curled-toe shoes with bells)
  [-1, 1].forEach((s) => {
    const leg = artic(root, V(s * 0.17, 1.08, 0), V(s * 0.22, 0.58, -0.1), V(s * 0.2, 0.1, 0.04), 0.075, 0.06, suit, suit, 0.08, gold);
    leg.onLow(rbox(0.16, 0.12, 0.34, 0.05), dark, s * 0.2, 0.06, -0.06);
    leg.onLow(cone(0.06, 0.32, 8), dark, s * 0.2, 0.14, -0.32, -Math.PI / 2 - 0.7, 0, 0);
    leg.onLow(sph(0.05, 10), gold, s * 0.2, 0.28, -0.42);
    leg.onUp(torus(0.08, 0.02, 16, 6), gold, s * 0.21, 0.62, -0.08, Math.PI / 2, 0, 0);
    rig.legs.push({ up: leg.up, low: leg.low, phase: s < 0 ? 0 : Math.PI, amp: 1.1 });
  });
  // pelvis + diamond tassets
  mk(body, rbox(0.46, 0.24, 0.3, 0.08), dark, 0, 1.1, 0);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const t = grp(body, Math.sin(a) * 0.24, 1.02, Math.cos(a) * 0.17);
    const d = mk(t, new THREE.OctahedronGeometry(0.11, 0), i % 2 ? suit : gold, 0, -0.08, 0);
    d.scale.set(1, 1.6, 0.35);
    t.rotation.y = a;
    rig.flutters.push({ obj: t, phase: i * 0.9, amp: 0.7, speed: 1.4 });
  }
  // torso
  mk(body, lathe([[0.17, 0], [0.2, 0.15], [0.27, 0.45], [0.3, 0.62], [0.22, 0.78], [0.1, 0.82]], 20), suit, 0, 1.15, 0);
  mk(body, torus(0.2, 0.03, 24, 6), gold, 0, 1.22, 0, Math.PI / 2, 0, 0);
  for (let i = 0; i < 3; i++) mk(body, sph(0.035, 8), gold, 0, 1.45 + i * 0.13, -0.27 + i * 0.01);
  // ruff collar
  const ruff = mk(body, torus(0.26, 0.09, 24, 10), porcelain, 0, 1.98, 0, Math.PI / 2, 0, 0);
  ruff.scale.set(1, 1, 0.55);
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const f = mk(body, sph(0.075, 8), i % 2 ? porcelain : suit, Math.cos(a) * 0.33, 1.98, Math.sin(a) * 0.33);
    f.scale.set(1, 0.5, 1);
  }
  // head: porcelain mask + three-horned hat with bells
  const head = grp(body, 0, 2.2, 0);
  rig.head = head;
  const mask = mk(head, sph(0.2, 24), porcelain, 0, 0.02, 0);
  mask.scale.set(0.9, 1.12, 0.88);
  [-1, 1].forEach((s) => {
    mk(head, rbox(0.09, 0.025, 0.03, 0.01), magenta, s * 0.075, 0.06, -0.17, 0, 0, s * 0.35);
    mk(head, new THREE.OctahedronGeometry(0.025, 0), cyan, s * 0.08, -0.04, -0.17);
  });
  mk(head, torus(0.07, 0.012, 16, 6, Math.PI), dark, 0, -0.08, -0.17, 0, 0, Math.PI);
  mk(head, cyl(0.2, 0.22, 0.12, 20), suit, 0, 0.18, 0);
  const horns: THREE.Object3D[] = [];
  [-1, 0, 1].forEach((s, i) => {
    const hp = grp(head, s * 0.1, 0.22, s === 0 ? 0.08 : 0);
    const pts = s === 0 ? [V(0, 0, 0), V(0, 0.25, 0.1), V(0, 0.38, 0.35), V(0, 0.25, 0.55)] : [V(0, 0, 0), V(s * 0.2, 0.22, 0), V(s * 0.42, 0.26, 0), V(s * 0.55, 0.05, 0.02)];
    tube(hp, pts, 0.055, i % 2 ? suit : dark, 16);
    const end = pts[pts.length - 1];
    mk(hp, sph(0.06, 12), gold, end.x, end.y - 0.04, end.z);
    mk(hp, sph(0.12, 10), halo(0xfde68a, 0.35), end.x, end.y - 0.04, end.z);
    rig.flutters.push({ obj: hp, phase: i * 1.7, amp: 1.4, speed: 1.6 });
    horns.push(hp);
  });

  // arms with chakrams
  const chakrams: Record<number, THREE.Object3D> = {};
  [-1, 1].forEach((s) => {
    const arm = artic(body, V(s * 0.33, 1.84, 0), V(s * 0.48, 1.44, -0.12), V(s * 0.52, 1.1, -0.3), 0.06, 0.05, suit, suit, 0.07, gold);
    arm.onUp(sph(0.11, 12), gold, s * 0.33, 1.86, 0);
    arm.onLow(sph(0.07, 10), porcelain, s * 0.52, 1.08, -0.31);
    // chakram held edge-on beside the hand
    const ch = new THREE.Group();
    ch.position.set(s * 0.52 - s * 0.48, 1.06 - 1.44, -0.34 + 0.12);
    arm.low.add(ch);
    const spinG = grp(ch, s * 0.06, 0, 0, 0, Math.PI / 2, 0);
    mk(spinG, torus(0.3, 0.03, 40, 8), steel);
    mk(spinG, torus(0.22, 0.015, 32, 6), magenta);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      mk(spinG, blade(0.2, 0.1, 0.02, 0.04), steel, Math.cos(a) * 0.32, Math.sin(a) * 0.32, 0, 0, 0, a - Math.PI / 2);
    }
    mk(spinG, torus(0.3, 0.09, 32, 6), halo(0xf0abfc, 0.18));
    chakrams[s] = ch;
    ch.userData.spin = spinG;
    rig.arms.push({ up: arm.up, low: arm.low, phase: s < 0 ? Math.PI : 0, amp: 0.8 });
  });
  // back ribbons
  [-1, 1].forEach((s) => {
    const rb = grp(body, s * 0.12, 1.9, 0.2);
    tube(rb, [V(0, 0, 0), V(s * 0.1, -0.35, 0.25), V(s * 0.05, -0.75, 0.35), V(s * 0.12, -1.1, 0.42)], 0.03, s < 0 ? suit : gold, 14);
    rig.flutters.push({ obj: rb, phase: s, amp: 1.5, speed: 1.2 });
  });
  // juggling orbs
  const orbs: THREE.Object3D[] = [0xe879f9, 0xfde68a, 0x67e8f9].map((c, i) => {
    const o = grp(body, 0, 1.6, -0.5);
    mk(o, sph(0.07, 12), glow(c));
    mk(o, sph(0.14, 10), halo(c, 0.35));
    o.userData.i = i;
    return o;
  });

  rig.gait = { freq: 1.4, swing: 0.85, knee: 1.05, bob: 0.09, lean: 0.09 };
  rig.lunge = 0.3;
  rig.extras = { chakrams, orbs, held: { [-1]: true, [1]: true }, throwSide: 1, blink: 0, spin: 0, twist: 0, horns };
  rig.custom = (r, time, dt, move, mesh) => {
    const E = r.extras;
    const a = r.act;
    // juggling orbs arc in front of the chest (scatter while moving fast)
    (E.orbs as THREE.Object3D[]).forEach((o) => {
      const i = o.userData.i as number;
      const t = time * 3.2 + (i * Math.PI * 2) / 3;
      o.position.set(Math.cos(t) * 0.28, 1.65 + Math.abs(Math.sin(t)) * 0.45, -0.55 + Math.sin(t) * 0.05);
      o.visible = a.name !== 'blink';
    });
    // chakrams spin in hand; hidden while thrown
    [-1, 1].forEach((s) => {
      const ch = E.chakrams[s] as THREE.Object3D;
      ch.visible = !!E.held[s];
      (ch.userData.spin as THREE.Object3D).rotation.z += dt * (6 + (a.name === 'throw' && E.throwSide === s ? 20 * a.k : 0));
    });
    // throwing arm: wind back over the shoulder, then whip forward
    if (a.name === 'throw') {
      const s = E.throwSide as number;
      const arm = r.arms.find((x) => Math.sign(x.up.position.x) === s);
      if (arm) {
        const k = a.k;
        const x = k < 0.72 ? 2.7 * (k / 0.72) : 2.7 - 1.9 * ((k - 0.72) / 0.28);
        arm.up.rotation.x = x;
        arm.up.rotation.z = s * (0.5 * Math.min(1, k * 2));
        arm.low.rotation.x = k < 0.72 ? 1.3 * (k / 0.72) : 0.2;
      }
      E.twist = -E.throwSide * (a.k < 0.72 ? 0.5 * (a.k / 0.72) : 0.5 - 1.1 * ((a.k - 0.72) / 0.28));
    } else {
      E.twist = damp(E.twist, 0, 8, dt);
      for (const arm of r.arms) arm.up.rotation.z = damp(arm.up.rotation.z, 0, 8, dt);
    }
    // blink: pirouette and squash into a sliver of light
    E.blink = a.name === 'blink' ? a.k : damp(E.blink, 0, 12, dt);
    const b = E.blink as number;
    E.spin = b > 0.02 ? E.spin + dt * b * 30 : 0;
    if (r.body) r.body.rotation.y = E.twist + E.spin;
    mesh.scale.set(Math.max(0.04, 1 - b * 0.96), 1 + b * 0.45, Math.max(0.04, 1 - b * 0.96));
  };
  return { hp: 190, speed: 6.4, damage: 18 };
}

// ───────────────────────── HIVE CARRIER ─────────────────────────
function buildCarrier(root: THREE.Group, rig: EnemyRig): EliteStats {
  const K = kit();
  const { armor, solid, emis, glow, halo, glass, rbox, cyl, sph, cone, torus, V, mk, grp, tube } = K;
  const body = new THREE.Group();
  root.add(body);
  rig.body = body;
  const chitin = armor(0x2f8a74, panelTexture('#1d5a4c', '#5eead4', 5), 0.4, 0.4, 0.8);
  const chitinD = armor(0x174a3e, panelTexture('#0f3a30', '#34d399', 6), 0.5, 0.38, 0.8);
  const bone = solid(0xd9e4c8, 0.2, 0.5);
  const dark = solid(0x050d0b, 0.5, 0.5);
  const amber = glow(0xfbbf24);
  const lime = glow(0xbef264);
  const red = glow(0xff3b3b);

  // carapace: overlapping shell bands, stretched front-to-back
  const shellG = grp(body, 0, 0.05, 0.1);
  shellG.scale.set(1.0, 0.95, 1.35);
  for (let i = 0; i < 5; i++) {
    const r = 1.55 + i * 0.03;
    mk(shellG, new THREE.SphereGeometry(r, 36, 8, 0, Math.PI * 2, i * 0.27, 0.34), i % 2 ? chitin : chitinD);
    mk(shellG, new THREE.TorusGeometry(r * Math.sin(i * 0.27 + 0.34), 0.025, 6, 48), amber, 0, r * Math.cos(i * 0.27 + 0.34), 0, Math.PI / 2, 0, 0);
  }
  // dorsal ridge spines + spiracle vents
  for (let i = 0; i < 6; i++) {
    const z = -1.3 + i * 0.5;
    mk(body, cone(0.09, 0.5 - Math.abs(i - 2.5) * 0.06, 6), bone, 0, 1.38 - Math.abs(z) * 0.18, z, -0.3, 0, 0);
  }
  [-1, 1].forEach((s) => {
    for (let i = 0; i < 3; i++) {
      mk(body, cyl(0.07, 0.1, 0.12, 10), dark, s * 0.8, 1.0, -0.6 + i * 0.6, 0, 0, s * 0.6);
      rig.pulses.push({ obj: mk(body, sph(0.06, 8), amber, s * 0.84, 1.05, -0.6 + i * 0.6), amp: 1.5, phase: i });
    }
  });
  // translucent brood sac with eggs
  const sac = mk(body, sph(1.2, 28), glass(0xa3e635, 0.35, 0x365314), 0, -0.45, 0.1);
  sac.scale.set(1.0, 0.62, 1.3);
  const eggs: THREE.Object3D[] = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const e = mk(body, sph(0.2, 12), emis(0xd9f99d, 0x84cc16, 0.9), Math.cos(a) * 0.55, -0.5 - (i % 2) * 0.12, 0.1 + Math.sin(a) * 0.75);
    e.scale.set(1, 1.25, 1);
    eggs.push(e);
  }
  const sacGlow = mk(body, sph(1.0, 16), halo(0xbef264, 0.15), 0, -0.45, 0.1);
  sacGlow.scale.set(1, 0.6, 1.3);
  // clamshell bay doors under the belly
  const doors: { obj: THREE.Object3D; side: number }[] = [];
  [-1, 1].forEach((s) => {
    const hinge = grp(body, s * 0.12, -0.72, 0.1);
    mk(hinge, rbox(1.05, 0.14, 2.3, 0.06), chitinD, s * 0.55, -0.02, 0, 0, 0, s * 0.32);
    mk(hinge, rbox(0.9, 0.05, 2.1, 0.02), amber, s * 0.55, 0.06, 0, 0, 0, s * 0.32);
    for (let i = 0; i < 4; i++) mk(hinge, cone(0.05, 0.25, 4), bone, s * 1.02, -0.18, -0.8 + i * 0.55, 0, 0, s * 2.6);
    doors.push({ obj: hinge, side: s });
  });
  // head cluster
  const head = grp(body, 0, 0.05, -1.95);
  rig.head = head;
  mk(head, rbox(0.95, 0.62, 0.7, 0.2), chitin, 0, 0, 0);
  mk(head, rbox(1.05, 0.18, 0.6, 0.06), chitinD, 0, 0.32, 0.05, -0.15, 0, 0);
  [[-0.24, 0.1], [0.24, 0.1], [0, 0.18], [-0.12, -0.08], [0.12, -0.08]].forEach(([x, y], i) => {
    mk(head, sph(i < 3 ? 0.085 : 0.055, 12), red, x, y, -0.34);
  });
  const spout = mk(head, cone(0.16, 0.36, 12), dark, 0, -0.18, -0.4, -Math.PI / 2, 0, 0);
  const spoutGlow = mk(head, sph(0.12, 10), lime, 0, -0.18, -0.58);
  const mandibles: { obj: THREE.Object3D; side: number }[] = [];
  [-1, 1].forEach((s) => {
    const m = grp(head, s * 0.3, -0.2, -0.3);
    mk(m, cone(0.07, 0.55, 5), bone, s * 0.08, 0, -0.25, -Math.PI / 2, 0, -s * 0.5);
    mandibles.push({ obj: m, side: s });
  });
  // membrane fins
  const finShape = new THREE.Shape();
  finShape.moveTo(0, 0);
  finShape.bezierCurveTo(0.6, 0.15, 1.3, 0.1, 1.6, -0.25);
  finShape.bezierCurveTo(1.1, -0.45, 0.5, -0.5, 0, -0.35);
  finShape.closePath();
  const finGeo = new THREE.ShapeGeometry(finShape, 12);
  const finMat = glass(0x99f6e4, 0.4, 0x0f766e);
  const fins: { obj: THREE.Object3D; side: number; i: number }[] = [];
  [-1, 1].forEach((s) => {
    [-0.55, 0.65].forEach((z, i) => {
      const f = grp(body, s * 1.35, 0.35, z);
      const m = mk(f, finGeo, finMat, 0, 0, 0, Math.PI / 2, 0, 0);
      m.scale.set(s * (1 - i * 0.2), 1 - i * 0.2, 1);
      tube(f, [V(0, 0, 0), V(s * 0.7, 0, -0.08), V(s * 1.5 * (1 - i * 0.2), 0, 0.2)], 0.025, bone, 10);
      fins.push({ obj: f, side: s, i });
    });
  });
  // dangling tendrils
  const tendrils: THREE.Object3D[][] = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    let parent: THREE.Object3D = grp(body, Math.cos(a) * 0.75, -0.85, 0.1 + Math.sin(a) * 1.0);
    const chain: THREE.Object3D[] = [];
    for (let j = 0; j < 4; j++) {
      const seg = grp(parent, 0, j === 0 ? 0 : -0.42, 0);
      mk(seg, cyl(0.06 - j * 0.012, 0.07 - j * 0.012, 0.42, 8), j % 2 ? chitin : chitinD, 0, -0.21, 0);
      mk(seg, sph(0.05, 8), j === 3 ? lime : amber, 0, -0.42, 0);
      chain.push(seg);
      parent = seg;
    }
    tendrils.push(chain);
  }
  // rear thrusters
  [-1, 1].forEach((s) => {
    mk(body, cyl(0.2, 0.26, 0.4, 14), dark, s * 0.55, 0.0, 2.05, Math.PI / 2, 0, 0);
    rig.pulses.push({ obj: mk(body, sph(0.2, 12), halo(0xfbbf24, 0.5), s * 0.55, 0.0, 2.3), amp: 1.4 });
  });

  rig.hover = { bob: 0.18, tilt: 0.035 };
  rig.lunge = 0.12;
  rig.extras = { doors, eggs, mandibles, fins, tendrils, spoutGlow, sac, open: 0, mouth: 0 };
  rig.custom = (r, time, dt, move) => {
    const E = r.extras;
    const a = r.act;
    const birth = a.name === 'birth' ? a.k : 0;
    const spit = a.name === 'spit' ? a.k : 0;
    E.open = damp(E.open, birth, 6, dt);
    E.mouth = damp(E.mouth, spit, 10, dt);
    for (const d of E.doors as typeof doors) d.obj.rotation.z = -d.side * 1.05 * E.open;
    (E.eggs as THREE.Object3D[]).forEach((e, i) => {
      const s = 1 + Math.sin(time * (2 + birth * 10) + i) * (0.05 + birth * 0.18);
      e.scale.set(s, s * 1.25, s);
    });
    (E.sac as THREE.Object3D).scale.set(1 + birth * 0.1, 0.62 + birth * 0.08 + Math.sin(time * 1.5) * 0.02, 1.3);
    for (const m of E.mandibles as typeof mandibles) m.obj.rotation.y = m.side * (0.15 + E.mouth * 0.7 + Math.sin(time * 4) * 0.05);
    (E.spoutGlow as THREE.Object3D).scale.setScalar(1 + E.mouth * 1.6);
    for (const f of E.fins as typeof fins) {
      f.obj.rotation.z = f.side * (Math.sin(time * (2.4 + move * 3) + f.i * 1.2) * 0.35 + 0.45);
    }
    (E.tendrils as THREE.Object3D[][]).forEach((chain, i) => {
      chain.forEach((seg, j) => {
        seg.rotation.x = Math.sin(time * 1.6 + i * 1.3 + j * 0.7) * (0.16 + birth * 0.25) + move * 0.3;
        seg.rotation.z = Math.cos(time * 1.3 + i + j * 0.9) * (0.12 + birth * 0.2);
      });
    });
    if (r.body && birth > 0.6) r.body.position.x = Math.sin(time * 45) * 0.03 * birth;
  };
  return { hp: 520, speed: 2.6, damage: 16 };
}

// ───────────────────────── HIVE MITE ─────────────────────────
function buildMite(root: THREE.Group, rig: EnemyRig): EliteStats {
  const K = kit();
  const { armor, solid, emis, glow, halo, rbox, sph, cone, V, mk, grp, artic } = K;
  const body = new THREE.Group();
  root.add(body);
  rig.body = body;
  const chitin = armor(0x1f5a4e, panelTexture('#123b33', '#5eead4', 5), 0.4, 0.4, 0.8);
  const dark = solid(0x050d0b, 0.5, 0.5);
  const bone = solid(0xd9e4c8, 0.2, 0.5);
  const abd = mk(body, sph(0.3, 16), emis(0xd9f99d, 0x84cc16, 0.8), 0, 0.45, 0.3);
  abd.scale.set(1, 0.85, 1.25);
  mk(body, sph(0.36, 14), halo(0xbef264, 0.18), 0, 0.45, 0.3);
  for (let i = 0; i < 3; i++) mk(body, rbox(0.5 - i * 0.08, 0.06, 0.16, 0.02), chitin, 0, 0.66 - i * 0.02, 0.12 + i * 0.18, 0.2, 0, 0);
  mk(body, rbox(0.34, 0.24, 0.34, 0.08), chitin, 0, 0.42, -0.1);
  const head = grp(body, 0, 0.42, -0.34);
  rig.head = head;
  mk(head, rbox(0.26, 0.2, 0.22, 0.07), chitin);
  [-1, 1].forEach((s) => mk(head, sph(0.035, 8), glow(0xff3b3b), s * 0.07, 0.04, -0.11));
  const jaw = grp(head, 0, -0.05, -0.08);
  rig.jaw = jaw;
  [-1, 1].forEach((s) => mk(jaw, cone(0.03, 0.2, 4), bone, s * 0.07, 0, -0.1, -Math.PI / 2, 0, -s * 0.4));
  for (let i = 0; i < 3; i++) {
    [-1, 1].forEach((s) => {
      const z = -0.2 + i * 0.18;
      const j = artic(root, V(s * 0.15, 0.42, z), V(s * 0.42, 0.55, z - 0.02), V(s * 0.55, 0.02, z + 0.04), 0.03, 0.022, chitin, dark, 0.03, bone);
      rig.legs.push({ up: j.up, low: j.low, phase: (i + (s > 0 ? 1 : 0)) % 2 ? Math.PI : 0, amp: 0.8 });
    });
  }
  rig.gait = { freq: 2.0, swing: 0.55, knee: 0.7, bob: 0.03, lean: 0.03 };
  rig.lunge = 0.35;
  return { hp: 45, speed: 8.2, damage: 9 };
}

// ───────────────────────── MANTIS LANCER ─────────────────────────
function buildLancer(root: THREE.Group, rig: EnemyRig): EliteStats {
  const K = kit();
  const { armor, solid, emis, glow, halo, rbox, cyl, sph, cone, torus, lathe, V, mk, grp, tube, blade, artic, strut } = K;
  const body = new THREE.Group();
  root.add(body);
  rig.body = body;
  const shell = armor(0x22262e, panelTexture('#16191f', '#9aa4b5', 5), 0.6, 0.32, 1);
  const pale = armor(0xd8d2c4, panelTexture('#a8a090', '#ffffff', 4), 0.3, 0.4, 0.8);
  const chrome = solid(0xc9d2de, 0.95, 0.12);
  const dark = solid(0x07080a, 0.5, 0.45);
  const crimson = glow(0xff2d55);
  const eyeMat = emis(0x5a0a14, 0xff1f3d, 1.2);
  eyeMat.flatShading = true;

  // four long walking legs
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz], idx) => {
    const hip = V(sx * 0.3, 1.55, sz * 0.3 + 0.2);
    const knee = V(sx * 0.95, 2.05, sz * 0.75 + 0.2);
    const foot = V(sx * 1.25, 0.05, sz * 1.05 + 0.2);
    const j = artic(root, hip, knee, foot, 0.07, 0.05, shell, chrome, 0.09, crimson);
    j.onLow(cone(0.06, 0.3, 5), dark, foot.x, 0.12, foot.z, 0, 0, 0);
    j.onUp(rbox(0.12, 0.08, 0.5, 0.03), pale, (hip.x + knee.x) / 2, (hip.y + knee.y) / 2 + 0.07, (hip.z + knee.z) / 2, 0, Math.atan2(knee.x - hip.x, knee.z - hip.z), 0);
    rig.legs.push({ up: j.up, low: j.low, phase: sx * sz > 0 ? 0 : Math.PI, amp: 0.7 });
  });
  // segmented abdomen sweeping back
  for (let i = 0; i < 6; i++) {
    const t = i / 5;
    const r = 0.36 * (1 - Math.abs(t - 0.35) * 0.9) + 0.08;
    const seg = lathe([[r * 0.7, -0.2], [r, -0.1], [r, 0.1], [r * 0.75, 0.2]], 16);
    seg.rotateX(Math.PI / 2);
    mk(body, seg, i % 2 ? shell : pale, 0, 1.6 - t * 0.55, 0.45 + t * 1.6, -0.35 - t * 0.2, 0, 0);
    mk(body, torus(r * 0.98, 0.018, 20, 6), crimson, 0, 1.6 - t * 0.55, 0.55 + t * 1.6, -0.35 - t * 0.2 + Math.PI / 2, 0, 0);
  }
  // thorax rising up
  mk(body, rbox(0.55, 0.5, 0.65, 0.15), shell, 0, 1.72, 0.05);
  const chest = mk(body, rbox(0.42, 1.0, 0.4, 0.12), pale, 0, 2.3, -0.2, 0.32, 0, 0);
  mk(body, rbox(0.46, 0.06, 0.44, 0.02), crimson, 0, 2.05, -0.12, 0.32, 0, 0);
  // elytra (wing cases) on the back
  const elytra: { obj: THREE.Object3D; side: number }[] = [];
  [-1, 1].forEach((s) => {
    const e = grp(body, s * 0.12, 2.25, 0.12, 0.35, 0, 0);
    const shellPlate = mk(e, rbox(0.3, 0.06, 1.6, 0.03), shell, s * 0.12, 0, 0.75);
    shellPlate.rotation.z = -s * 0.2;
    mk(e, rbox(0.06, 0.07, 1.5, 0.02), crimson, s * 0.26, 0.02, 0.75);
    mk(e, new THREE.PlaneGeometry(0.5, 1.4), halo(0xff2d55, 0.14), s * 0.4, -0.04, 0.75, Math.PI / 2, 0, 0);
    elytra.push({ obj: e, side: s });
  });
  // neck + triangular head with compound eyes and a crest crystal (beam emitter)
  strut(body, V(0, 2.75, -0.38), V(0, 3.05, -0.5), 0.09, 0.07, shell);
  const head = grp(body, 0, 3.1, -0.55);
  rig.head = head;
  const skull = mk(head, cone(0.36, 0.7, 3), pale, 0, -0.08, -0.05, Math.PI, 0, 0);
  skull.scale.set(1.1, 1, 0.6);
  [-1, 1].forEach((s) => {
    mk(head, new THREE.IcosahedronGeometry(0.17, 1), eyeMat, s * 0.3, 0.12, -0.02);
    mk(head, sph(0.24, 10), halo(0xff2d55, 0.2), s * 0.3, 0.12, -0.02);
    const ant = grp(head, s * 0.08, 0.2, -0.12);
    tube(ant, [V(0, 0, 0), V(s * 0.15, 0.4, -0.1), V(s * 0.4, 0.75, 0.05), V(s * 0.6, 0.9, 0.3)], 0.012, dark, 14);
    rig.flutters.push({ obj: ant, phase: s * 1.3, amp: 1.0, speed: 1.8 });
    mk(head, cone(0.03, 0.18, 4), chrome, s * 0.06, -0.42, -0.08, 0, 0, s * 0.4);
  });
  const crystal = mk(head, new THREE.OctahedronGeometry(0.11, 0), crimson, 0, 0.08, -0.24);
  crystal.scale.set(1, 1.5, 1);
  const crystalHalo = mk(head, sph(0.22, 12), halo(0xff2d55, 0.35), 0, 0.08, -0.26);
  const lens = grp(head, 0, 0.08, -0.32);
  mk(head, torus(0.15, 0.02, 24, 6), chrome, 0, 0.08, -0.22);
  // raptorial arms (folded in a praying pose), forearms are emitter blades
  const armRefs: { up: THREE.Object3D; low: THREE.Object3D; side: number }[] = [];
  [-1, 1].forEach((s) => {
    const a = V(s * 0.22, 2.55, -0.42);
    const b = V(s * 0.36, 1.95, -0.8);
    const c = V(s * 0.32, 2.5, -1.12);
    const arm = artic(body, a, b, c, 0.075, 0.05, pale, shell, 0.09, crimson);
    for (let i = 0; i < 4; i++) {
      const t = 0.2 + i * 0.2;
      const p = a.clone().lerp(b, t);
      arm.onUp(cone(0.025, 0.14, 4), chrome, p.x, p.y, p.z - 0.07, -Math.PI / 2 - 0.4, 0, 0);
    }
    // forearm scythe: runs from the elbow up along the folded forearm and past the wrist
    const bl = arm.onLow(blade(1.7, 0.3, 0.05, 0.12), chrome, b.x, b.y, b.z, -0.5, 0, 0);
    bl.scale.x = s;
    arm.onLow(new THREE.BoxGeometry(0.025, 1.45, 0.025), crimson, b.x + s * 0.05, b.y + 0.66, b.z - 0.36, -0.5, 0, 0);
    arm.onLow(blade(0.5, 0.12, 0.03, 0.06), chrome, b.x, b.y + 0.05, b.z - 0.05, -2.2, 0, 0); // hooked spur
    rig.arms.push({ up: arm.up, low: arm.low, phase: s < 0 ? Math.PI : 0, amp: 0.25 });
    armRefs.push({ up: arm.up, low: arm.low, side: s });
  });

  rig.gait = { freq: 0.95, swing: 0.5, knee: 0.6, bob: 0.05, lean: 0.03 };
  rig.lunge = 0.35;
  rig.extras = { elytra, armRefs, crystal, crystalHalo, lens, head, chest, charge: 0, slash: 0 };
  rig.custom = (r, time, dt, move) => {
    const E = r.extras;
    const a = r.act;
    const charge = a.name === 'charge' ? a.k : a.name === 'fire' ? 1 : 0;
    const slashK = a.name === 'slash' ? a.k : 0;
    E.charge = damp(E.charge, charge, 6, dt);
    for (const e of E.elytra as typeof elytra) {
      e.obj.rotation.x = 0.35 - E.charge * 0.9;
      e.obj.rotation.z = -e.side * E.charge * 0.55 + Math.sin(time * 40) * 0.02 * (a.name === 'fire' ? 1 : 0);
    }
    (E.crystalHalo as THREE.Object3D).scale.setScalar(1 + E.charge * 0.8 + (a.name === 'fire' ? Math.sin(time * 50) * 0.15 : 0));
    (E.crystal as THREE.Object3D).scale.set(1 + E.charge * 0.5, 1.5 + E.charge * 0.8, 1 + E.charge * 0.5);
    // aim the head down along the beam / brace the body
    const h = E.head as THREE.Object3D;
    h.rotation.x = h.rotation.x + E.charge * 0.35 + slashK * 0.2;
    if (r.body) r.body.position.y -= E.charge * 0.25;
    // arms: spread wide while charging, raise high then scythe down when slashing
    for (const arm of E.armRefs as typeof armRefs) {
      if (slashK > 0) {
        const up = slashK < 0.7 ? 2.4 * (slashK / 0.7) : 2.4 - 2.6 * ((slashK - 0.7) / 0.3);
        arm.up.rotation.x = up;
        arm.up.rotation.z = arm.side * 0.4 * Math.min(1, slashK * 2);
        arm.low.rotation.x = slashK < 0.7 ? -0.6 : 0.6;
      } else if (E.charge > 0.02) {
        arm.up.rotation.z = arm.side * E.charge * 0.9;
        arm.up.rotation.x = arm.up.rotation.x * (1 - E.charge) + 0.6 * E.charge;
      } else {
        arm.up.rotation.z = damp(arm.up.rotation.z, 0, 8, dt);
      }
    }
  };
  return { hp: 360, speed: 3.8, damage: 26 };
}

/**
 * Builds an elite enemy into `group` (registers its animation rig on `group.userData.enemyRig`).
 * Returns null for non-elite types.
 */
export function buildEliteEnemy(type: string, group: THREE.Group): EliteStats | null {
  if (!isEliteType(type)) return null;
  const rig = createRig(type);
  group.userData.enemyRig = rig;
  switch (type) {
    case 'mender': return buildMender(group, rig);
    case 'wyrm': return buildWyrm(group, rig);
    case 'jester': return buildJester(group, rig);
    case 'carrier': return buildCarrier(group, rig);
    case 'lancer': return buildLancer(group, rig);
    case 'mite': return buildMite(group, rig);
  }
  return null;
}

/** World position of an elite's emitter (lancer crest crystal, carrier spout, mender core). */
export function eliteEmitterWorld(group: THREE.Object3D, out: THREE.Vector3): THREE.Vector3 {
  const rig = group.userData.enemyRig as EnemyRig | undefined;
  const E = rig?.extras;
  const obj: THREE.Object3D | undefined = E?.lens ?? E?.spoutGlow ?? E?.core;
  if (obj) return obj.getWorldPosition(out);
  return out.copy(group.position).setY(group.position.y + 1);
}
