import { digitTexture, digitMaterial } from './neonFx';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

/**
 * High-detail boss models (all face -Z, feet on y = 0, built inside a rig scaled by BOSS_SCALE):
 *   boss        → ARCHON GOLGOTHA      (winged war-angel, cyan / crimson)
 *   boss_golem  → ARCH-GOLEM PRIME     (cathedral colossus, bronze / amber)
 *   boss_titan  → TITAN DREADNOUGHT    (walking fortress, gunmetal / red)
 *
 * Models are built from bevelled armour, layered plates, hydraulics, cables and emissive
 * trims with a procedural panel texture. `animateBoss` drives the moving parts and the
 * enrage colour shift per phase.
 */

export type BossKind = 'golgotha' | 'golem' | 'titan' | 'kraken' | 'warden' | 'frost' | 'myco' | 'magma' | 'storm' | 'neon';
export const BOSS_SCALE = 1.8;

export const bossKindOf = (typeId: string): BossKind | null =>
  typeId === 'boss' ? 'golgotha'
    : typeId === 'boss_golem' ? 'golem'
    : typeId === 'boss_titan' ? 'titan'
    : typeId === 'boss_kraken' ? 'kraken'
    : typeId === 'boss_warden' ? 'warden'
    : typeId === 'boss_frost' ? 'frost'
    : typeId === 'boss_myco' ? 'myco'
    : typeId === 'boss_magma' ? 'magma'
    : typeId === 'boss_storm' ? 'storm'
    : typeId === 'boss_neon' ? 'neon'
    : null;

export interface BossStats {
  hp: number;
  speed: number;
  damage: number;
}

export const BOSS_STATS: Record<BossKind, BossStats> = {
  golgotha: { hp: 5400, speed: 4.1, damage: 62 },
  golem: { hp: 4200, speed: 3.4, damage: 70 },
  titan: { hp: 4900, speed: 3.0, damage: 64 },
  kraken: { hp: 6200, speed: 3.3, damage: 66 },
  warden: { hp: 7000, speed: 3.9, damage: 70 },
  frost: { hp: 7600, speed: 4.2, damage: 72 },
  myco: { hp: 8200, speed: 3.9, damage: 74 },
  magma: { hp: 8800, speed: 3.8, damage: 78 },
  storm: { hp: 9400, speed: 3.6, damage: 82 },
  neon: { hp: 10000, speed: 3.7, damage: 86 },
};

interface BossRefs {
  kind: BossKind;
  rig: THREE.Group;
  spinners: { obj: THREE.Object3D; axis: 'x' | 'y' | 'z'; speed: number }[];
  orbiters: { obj: THREE.Object3D; r: number; y: number; a0: number; speed: number; bob: number }[];
  wings: { obj: THREE.Object3D; baseZ: number; side: number; idx: number }[];
  pulses: { obj: THREE.Object3D; amp: number }[];
  sways: { obj: THREE.Object3D; axis: 'x' | 'y' | 'z'; base: number; amp: number; speed: number; phase: number }[];
  accents: { mat: THREE.MeshBasicMaterial; base: THREE.Color }[];
  enrage: THREE.Color;
  /** shoulder pivots (rest = 0): x raises the arm forward/up, z spreads it out, y swings it across */
  arms: { obj: THREE.Object3D; side: number }[];
  /** tentacle lift pivots (x > 0 raises) */
  lifts: { obj: THREE.Object3D; idx: number; front: boolean; side: number }[];
  /** gun mounts that elevate for lobbed shots (x > 0 raises the muzzle) */
  guns: { obj: THREE.Object3D }[];
  pose: { ax: number; az: number; ay: number; lift: number; gun: number; wing: number; hit: number };
}

// ───────────────────────── procedural panel texture ─────────────────────────
const texCache = new Map<string, THREE.CanvasTexture>();

export function panelTexture(base: string, seam: string, cells: number, hazard = false): THREE.CanvasTexture {
  const key = `${base}|${seam}|${cells}|${hazard}`;
  const hit = texCache.get(key);
  if (hit) return hit;
  const S = 512;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  g.fillStyle = base;
  g.fillRect(0, 0, S, S);
  // mottled wear
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.035)';
    const s = 2 + Math.random() * 10;
    g.fillRect(Math.random() * S, Math.random() * S, s, s * (0.3 + Math.random()));
  }
  // panel grid with irregular rows
  const step = S / cells;
  g.lineWidth = 3;
  for (let r = 0; r <= cells; r++) {
    const y = r * step + (r % 2 ? step * 0.18 : 0);
    g.strokeStyle = 'rgba(0,0,0,0.65)';
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(S, y);
    g.stroke();
    g.strokeStyle = seam;
    g.globalAlpha = 0.35;
    g.beginPath();
    g.moveTo(0, y + 3);
    g.lineTo(S, y + 3);
    g.stroke();
    g.globalAlpha = 1;
    for (let q = 0; q <= cells; q++) {
      const x = q * step + (r % 2 ? step * 0.5 : 0);
      g.strokeStyle = 'rgba(0,0,0,0.55)';
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x, y + step);
      g.stroke();
      g.fillStyle = seam;
      g.globalAlpha = 0.55;
      [[6, 6], [-6, 6]].forEach(([dx, dy]) => {
        g.beginPath();
        g.arc(x + dx, y + dy + 4, 2.2, 0, Math.PI * 2);
        g.fill();
      });
      g.globalAlpha = 1;
    }
  }
  // scratches
  g.lineWidth = 1;
  for (let i = 0; i < 70; i++) {
    g.strokeStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.25)';
    const x = Math.random() * S;
    const y = Math.random() * S;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + (Math.random() - 0.5) * 90, y + (Math.random() - 0.5) * 30);
    g.stroke();
  }
  if (hazard) {
    g.save();
    g.beginPath();
    g.rect(0, S - 64, S, 40);
    g.clip();
    g.fillStyle = '#facc15';
    g.fillRect(0, S - 64, S, 40);
    g.fillStyle = '#111827';
    for (let x = -80; x < S + 80; x += 48) {
      g.beginPath();
      g.moveTo(x, S - 24);
      g.lineTo(x + 24, S - 24);
      g.lineTo(x + 64, S - 64);
      g.lineTo(x + 40, S - 64);
      g.closePath();
      g.fill();
    }
    g.restore();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  texCache.set(key, t);
  return t;
}

// ───────────────────────── build kit ─────────────────────────
function createKit(kind: BossKind, rig: THREE.Group, enrage: number) {
  const refs: BossRefs = {
    kind,
    rig,
    spinners: [],
    orbiters: [],
    wings: [],
    pulses: [],
    sways: [],
    accents: [],
    enrage: new THREE.Color(enrage),
    arms: [],
    lifts: [],
    guns: [],
    pose: { ax: 0, az: 0, ay: 0, lift: 0, gun: 0, wing: 0, hit: 0 },
  };
  const armor = (color: number, tex: THREE.Texture, metal = 0.6, rough = 0.42) =>
    new THREE.MeshPhysicalMaterial({
      // no environment map in the battle scene: keep metalness moderate and let the texture carry the base colour
      color: new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.55),
      map: tex,
      bumpMap: tex,
      bumpScale: 1.4,
      metalness: Math.min(metal, 0.45),
      roughness: Math.max(rough, 0.45),
      clearcoat: 0.45,
      clearcoatRoughness: 0.4,
    });
  const solid = (color: number, metal = 0.7, rough = 0.35) => new THREE.MeshStandardMaterial({ color, metalness: metal, roughness: rough });
  const glow = (color: number, accent = false) => {
    const m = new THREE.MeshBasicMaterial({ color });
    if (accent) refs.accents.push({ mat: m, base: new THREE.Color(color) });
    return m;
  };
  const halo = (color: number, opacity = 0.25, accent = false) => {
    const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });
    if (accent) refs.accents.push({ mat: m as THREE.MeshBasicMaterial, base: new THREE.Color(color) });
    return m;
  };

  const rbox = (w: number, h: number, d: number, r = 0.06) => new RoundedBoxGeometry(w, h, d, 2, Math.max(0.005, Math.min(r, w / 2 - 0.002, h / 2 - 0.002, d / 2 - 0.002)));
  const cyl = (rt: number, rb: number, h: number, seg = 14) => new THREE.CylinderGeometry(rt, rb, h, seg);
  const sph = (r: number, seg = 16) => new THREE.SphereGeometry(r, seg, Math.max(8, seg - 4));
  const cone = (r: number, h: number, seg = 6) => new THREE.ConeGeometry(r, h, seg);
  const torus = (R: number, r: number, seg = 40, tube = 10, arc = Math.PI * 2) => new THREE.TorusGeometry(R, r, tube, seg, arc);

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
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  /** Tapered strut between two points. */
  const strut = (parent: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3, r0: number, r1: number, mat: THREE.Material, seg = 12) => {
    const dir = new THREE.Vector3().subVectors(b, a);
    const len = dir.length();
    const m = new THREE.Mesh(cyl(r1, r0, len, seg), mat);
    m.position.copy(a).addScaledVector(dir, 0.5);
    m.quaternion.setFromUnitVectors(V(0, 1, 0), dir.normalize());
    parent.add(m);
    return m;
  };
  const cable = (parent: THREE.Object3D, pts: THREE.Vector3[], r: number, mat: THREE.Material) =>
    mk(parent, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, r, 6, false), mat);
  /** Tapering blade pointing +Y (length len, base width w, thickness t). */
  const blade = (len: number, w: number, t: number, curve = 0.0) => {
    const sh = new THREE.Shape();
    sh.moveTo(-w / 2, 0);
    sh.lineTo(w / 2, 0);
    sh.lineTo(w * 0.42 + curve, len * 0.55);
    sh.lineTo(curve * 1.6, len);
    sh.lineTo(-w * 0.42 + curve, len * 0.55);
    sh.closePath();
    const g = new THREE.ExtrudeGeometry(sh, { depth: t, bevelEnabled: true, bevelThickness: t * 0.25, bevelSize: t * 0.25, bevelSegments: 1, curveSegments: 1 });
    g.translate(0, 0, -t / 2);
    return g;
  };
  const spin = (obj: THREE.Object3D, axis: 'x' | 'y' | 'z', speed: number) => refs.spinners.push({ obj, axis, speed });
  const orbit = (obj: THREE.Object3D, r: number, y: number, a0: number, speed: number, bob = 0.25) => refs.orbiters.push({ obj, r, y, a0, speed, bob });
  const pulse = (obj: THREE.Object3D, amp = 0.08) => refs.pulses.push({ obj, amp });
  const sway = (obj: THREE.Object3D, axis: 'x' | 'y' | 'z', amp: number, speed: number, phase = 0) =>
    refs.sways.push({ obj, axis, base: obj.rotation[axis], amp, speed, phase });

  /** Shoulder pivot at (x,y,z); parts added to the returned group keep their rig-space coordinates. */
  const armPivot = (side: number, x: number, y: number, z: number) => {
    const p = grp(rig, x, y, z);
    refs.arms.push({ obj: p, side });
    return grp(p, -x, -y, -z);
  };

  return { refs, armor, solid, glow, halo, rbox, cyl, sph, cone, torus, mk, grp, V, strut, cable, blade, spin, orbit, pulse, sway, armPivot };
}
type Kit = ReturnType<typeof createKit>;

// ───────────────────────── ARCHON GOLGOTHA ─────────────────────────
function buildGolgotha(rig: THREE.Group): BossRefs {
  const k = createKit('golgotha', rig, 0xff2a2a);
  const { armor, solid, glow, halo, rbox, cyl, sph, cone, torus, mk, grp, V, strut, cable, blade, spin, orbit, pulse } = k;
  const texA = panelTexture('#252d3d', '#8a9bb5', 5);
  const texB = panelTexture('#3b4f6c', '#a8b8cf', 4);
  const texG = panelTexture('#6b4210', '#fcd34d', 3);
  const black = armor(0x10131c, texA, 0.7, 0.34);
  const hull = armor(0x2b3a52, texB, 0.62, 0.4);
  const plate = armor(0x475a78, texB, 0.6, 0.38);
  const gold = armor(0xc98a1c, texG, 0.82, 0.28);
  const steel = solid(0xaab6c8, 0.9, 0.22);
  const dark = solid(0x05070b, 0.4, 0.6);
  const cyan = glow(0x38bdf8, true);
  const crimson = glow(0xff0044, true);
  const white = glow(0xe0f2fe);

  // ── legs ──
  [-1, 1].forEach((s) => {
    mk(rig, rbox(1.05, 0.34, 1.6, 0.1), hull, s * 1.0, 0.17, -0.25);                       // foot
    for (let i = -1; i <= 1; i++) mk(rig, rbox(0.3, 0.2, 0.55, 0.06), gold, s * 1.0 + i * 0.34, 0.2, -1.1); // toes
    mk(rig, cone(0.22, 0.7, 5), black, s * 1.0, 0.3, 0.7, -Math.PI / 2, 0, 0);               // heel spike
    strut(rig, V(s * 1.0, 0.35, 0), V(s * 1.0, 1.3, -0.05), 0.46, 0.34, hull);               // shin
    mk(rig, rbox(0.75, 1.0, 0.25, 0.08), plate, s * 1.0, 0.85, -0.42, 0.1, 0, 0);            // greave
    mk(rig, new THREE.BoxGeometry(0.07, 0.8, 0.03), cyan, s * 1.0, 0.85, -0.56, 0.1, 0, 0);
    mk(rig, sph(0.4), gold, s * 1.0, 1.35, -0.05);                                            // knee
    mk(rig, cone(0.16, 0.55, 5), black, s * 1.0, 1.35, -0.5, -Math.PI / 2, 0, 0);             // knee spike
    strut(rig, V(s * 0.95, 1.4, 0), V(s * 0.9, 2.3, 0), 0.4, 0.5, hull);                      // thigh
    mk(rig, rbox(0.85, 0.9, 0.3, 0.09), plate, s * 0.95, 1.85, -0.5, -0.1, 0, 0);             // thigh plate
    strut(rig, V(s * 1.3, 0.95, 0.35), V(s * 1.2, 2.2, 0.35), 0.06, 0.06, steel, 8);          // piston rod
    mk(rig, cyl(0.1, 0.1, 0.9, 10), black, s * 1.25, 1.55, 0.35);                             // piston sleeve
  });

  // ── pelvis / abdomen ──
  mk(rig, rbox(2.4, 0.6, 1.6, 0.14), black, 0, 2.45, 0);
  [-0.85, 0, 0.85].forEach((x) => {
    mk(rig, rbox(0.75, 0.85, 0.12, 0.05), plate, x, 2.15, -0.88, 0.14, 0, 0);               // fauld
    mk(rig, new THREE.BoxGeometry(0.75, 0.05, 0.05), gold, x, 1.72, -0.93);
  });
  for (let i = 0; i < 4; i++) {
    mk(rig, rbox(2.1 - i * 0.06, 0.26, 1.5 - i * 0.04, 0.09), i % 2 ? black : hull, 0, 2.95 + i * 0.28, 0);
    mk(rig, new THREE.BoxGeometry(0.9, 0.04, 0.04), cyan, 0, 2.95 + i * 0.28, -0.76);
  }
  mk(rig, cyl(0.12, 0.12, 1.3, 10), steel, 0, 3.55, -0.06, 0, 0, 0);

  // ── chest ──
  mk(rig, rbox(3.6, 1.9, 2.3, 0.3), black, 0, 4.4, 0);
  [-1, 1].forEach((s) => {
    mk(rig, rbox(1.7, 1.35, 0.45, 0.12), hull, s * 0.95, 4.55, -1.2, 0.15, s * -0.1, 0);      // pectoral plate
    mk(rig, rbox(1.6, 0.07, 0.1, 0.02), gold, s * 0.95, 3.92, -1.43);
    for (let i = 0; i < 3; i++) mk(rig, new THREE.BoxGeometry(0.06, 1.0, 0.04), crimson, s * (0.45 + i * 0.4), 4.6, -1.46);
  });
  mk(rig, rbox(3.9, 0.28, 2.5, 0.1), gold, 0, 5.4, 0);                                         // collar
  mk(rig, rbox(3.85, 0.18, 2.45, 0.07), gold, 0, 3.52, 0);                                     // belt
  // reactor
  mk(rig, cyl(0.88, 0.95, 0.32, 24), dark, 0, 4.2, -1.22, Math.PI / 2, 0, 0);
  const coreRing = mk(rig, torus(0.78, 0.07), cyan, 0, 4.2, -1.4);
  const coreRing2 = mk(rig, torus(0.55, 0.05, 36, 8), crimson, 0, 4.2, -1.42);
  spin(coreRing, 'z', 0.8);
  spin(coreRing2, 'z', -1.4);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    mk(rig, rbox(0.14, 0.22, 0.12, 0.02), gold, Math.cos(a) * 0.98, 4.2 + Math.sin(a) * 0.98, -1.4, 0, 0, a);
  }
  const core = mk(rig, sph(0.34), white, 0, 4.2, -1.42);
  const coreHalo = mk(rig, sph(1.0), halo(0x38bdf8, 0.22, true), 0, 4.2, -1.42);
  pulse(core, 0.14);
  pulse(coreHalo, 0.1);

  // ── head ──
  mk(rig, cyl(0.32, 0.42, 0.45, 12), black, 0, 5.62, -0.05);
  mk(rig, rbox(0.98, 1.0, 1.0, 0.22), black, 0, 6.1, -0.05);
  mk(rig, rbox(0.74, 0.74, 0.32, 0.1), hull, 0, 6.05, -0.52);                                  // faceplate
  mk(rig, new THREE.BoxGeometry(0.66, 0.1, 0.06), crimson, 0, 6.12, -0.7);                    // visor
  mk(rig, new THREE.BoxGeometry(0.16, 0.08, 0.07), white, 0, 6.12, -0.72);
  mk(rig, new THREE.OctahedronGeometry(0.1, 0), cyan, 0, 6.5, -0.6);
  mk(rig, cone(0.12, 0.5, 4), plate, 0, 5.68, -0.62, Math.PI, 0, 0);                           // jaw spike
  [-1, 1].forEach((s) => {
    mk(rig, blade(0.7, 0.2, 0.05), plate, s * 0.55, 5.9, -0.1, 0, 0, s * 0.9 + Math.PI);       // cheek blades
    mk(rig, cone(0.13, 1.1, 5), black, s * 0.5, 6.7, 0.05, 0, 0, s * -0.7);                    // horns
  });
  for (let i = -2; i <= 2; i++) {
    mk(rig, cone(0.1, 0.9 - Math.abs(i) * 0.18, 4), gold, i * 0.2, 6.85 - Math.abs(i) * 0.04, -0.05, 0, 0, i * -0.18);
  }

  // ── halo ──
  const haloRig = grp(rig, 0, 5.95, 0.95);
  const haloRing = mk(haloRig, torus(1.9, 0.09, 56, 12), cyan);
  mk(haloRig, torus(1.9, 0.3, 40, 8), halo(0x38bdf8, 0.14, true));
  mk(haloRig, torus(1.5, 0.06, 48, 10), crimson, 0, 0, 0.02);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    mk(haloRing, cone(0.09, i % 2 ? 0.45 : 0.7, 4), white, Math.cos(a) * 2.05, Math.sin(a) * 2.05, 0, 0, 0, a - Math.PI / 2);
  }
  spin(haloRing, 'z', 0.55);

  // ── wings ──
  [-1, 1].forEach((s) => {
    for (let i = 0; i < 4; i++) {
      const len = 3.9 - i * 0.5;
      const pivot = grp(rig, s * 1.5, 5.0 - i * 0.45, 0.95, 0, s * 0.3, s * -(0.55 + i * 0.3));
      mk(pivot, blade(len, 1.25 - i * 0.12, 0.12, s * 0.12), i === 0 ? black : hull, 0, 0, 0);
      mk(pivot, new THREE.BoxGeometry(0.035, len * 0.92, 0.03), i % 2 ? cyan : crimson, s * 0.02, len * 0.46, -0.08);
      mk(pivot, new THREE.BoxGeometry(0.035, len * 0.92, 0.03), i % 2 ? cyan : crimson, s * 0.02, len * 0.46, 0.08);
      mk(pivot, rbox(0.34, 0.5, 0.22, 0.06), gold, 0, 0.1, 0);
      k.refs.wings.push({ obj: pivot, baseZ: pivot.rotation.z, side: s, idx: i });
    }
  });

  // ── shoulders + arms ──
  [-1, 1].forEach((s) => {
    const pa = mk(rig, sph(1.0), plate, s * 2.35, 5.0, 0);
    pa.scale.set(1, 0.72, 1.1);
    const pb = mk(rig, sph(0.62), gold, s * 2.5, 5.55, 0);
    pb.scale.set(1, 0.7, 1);
    for (let i = 0; i < 3; i++) mk(rig, cone(0.15, 0.95, 5), black, s * (2.25 + i * 0.36), 5.95 + (i === 1 ? 0.2 : 0), 0.1, 0, 0, s * -(0.5 + i * 0.25));
    mk(rig, new THREE.BoxGeometry(0.1, 1.0, 0.05), cyan, s * 2.4, 4.9, -1.0);
    const arm = k.armPivot(s, s * 2.35, 4.7, 0);
    const elbow = V(s * 2.75, 3.55, -0.2);
    strut(arm, V(s * 2.35, 4.7, 0), elbow, 0.46, 0.4, hull);
    mk(arm, rbox(0.7, 1.0, 0.7, 0.16), plate, s * 2.55, 4.1, -0.1, 0, 0, s * -0.18);
    mk(arm, sph(0.46), gold, elbow.x, elbow.y, elbow.z);
    mk(arm, cone(0.16, 0.6, 5), black, elbow.x + s * 0.4, elbow.y, elbow.z, 0, 0, s * -Math.PI / 2);
    const wrist = V(s * 2.6, 2.1, -0.9);
    strut(arm, elbow, wrist, 0.5, 0.58, black);
    mk(arm, rbox(0.95, 1.2, 0.5, 0.14), hull, s * 2.68, 2.85, -0.62, 0.55, 0, 0);
    mk(arm, new THREE.BoxGeometry(0.06, 1.0, 0.04), crimson, s * 2.68, 2.85, -0.9, 0.55, 0, 0);
    // fist + blade claws
    mk(arm, rbox(1.0, 0.85, 1.0, 0.18), plate, s * 2.6, 1.7, -1.05);
    for (let i = -1; i <= 1; i++) {
      mk(arm, blade(0.9, 0.2, 0.07), crimson, s * 2.6 + i * 0.3, 1.5, -1.6, -Math.PI / 2 - 0.12, 0, 0);
      mk(arm, cone(0.07, 0.3, 4), steel, s * 2.6 + i * 0.3, 2.0, -1.2);
    }
    mk(arm, sph(0.28), gold, s * 2.6, 1.7, -1.62);
    // shards
    for (let i = 0; i < 3; i++) {
      const sh = mk(rig, new THREE.OctahedronGeometry(0.26 + i * 0.04, 0), cyan);
      orbit(sh, 4.0 + i * 0.35, 2.6 + i * 1.5, (s > 0 ? 0 : Math.PI) + i * 2.1, 0.9 + i * 0.15);
    }
  });

  // ── back reactor spine + cables ──
  for (let i = 0; i < 5; i++) {
    mk(rig, rbox(0.38, 0.3, 0.55, 0.06), i % 2 ? crimson : black, 0, 2.9 + i * 0.5, 1.25);
    mk(rig, cone(0.16, 0.5, 6), i % 2 ? black : gold, 0, 3.1 + i * 0.5, 1.7, Math.PI / 2, 0, 0);
  }
  [-1, 1].forEach((s) => {
    cable(rig, [V(s * 0.3, 3.0, 1.1), V(s * 1.0, 3.4, 1.4), V(s * 1.7, 4.2, 1.2), V(s * 2.1, 4.9, 0.6)], 0.06, dark);
    cable(rig, [V(s * 0.9, 2.5, 0.7), V(s * 1.5, 2.2, 1.0), V(s * 1.3, 1.8, 0.5)], 0.05, dark);
  });
  return k.refs;
}

// ───────────────────────── ARCH-GOLEM PRIME ─────────────────────────
function buildGolem(rig: THREE.Group): BossRefs {
  const k = createKit('golem', rig, 0xff3b1f);
  const { armor, solid, glow, halo, rbox, cyl, sph, cone, torus, mk, grp, V, strut, cable, spin, orbit, pulse } = k;
  const texS = panelTexture('#5b5148', '#c4bcb2', 4);
  const texD = panelTexture('#35302b', '#9a928a', 5);
  const texC = panelTexture('#7a3f14', '#fbbf77', 3);
  const stone = armor(0x4a423b, texS, 0.35, 0.65);
  const iron = armor(0x1d1a17, texD, 0.7, 0.4);
  const bronze = armor(0xb4651f, texC, 0.85, 0.3);
  const steel = solid(0xb9b2a8, 0.9, 0.25);
  const dark = solid(0x070504, 0.4, 0.6);
  const amber = glow(0xffa21f, true);
  const ember = glow(0xff5a1a, true);
  const white = glow(0xfff1d0);

  // ── legs ──
  [-1, 1].forEach((s) => {
    mk(rig, rbox(1.7, 0.45, 2.2, 0.14), iron, s * 1.25, 0.22, -0.3);                           // foot
    for (let i = -1; i <= 1; i++) mk(rig, cone(0.2, 0.7, 5), bronze, s * 1.25 + i * 0.5, 0.28, -1.5, -Math.PI / 2, 0, 0); // claws
    mk(rig, rbox(1.2, 1.3, 1.25, 0.2), stone, s * 1.25, 1.0, -0.1);                            // shin
    mk(rig, rbox(1.0, 0.9, 0.2, 0.06), bronze, s * 1.25, 1.0, -0.76);
    mk(rig, new THREE.BoxGeometry(0.08, 0.7, 0.03), amber, s * 1.25, 1.0, -0.88);
    mk(rig, sph(0.5), bronze, s * 1.25, 1.75, -0.1);                                           // knee
    for (let i = 0; i < 3; i++) mk(rig, cone(0.12, 0.5, 5), iron, s * 1.25 + (i - 1) * 0.28, 1.75, -0.6, -Math.PI / 2, 0, 0);
    mk(rig, rbox(1.3, 1.1, 1.35, 0.22), stone, s * 1.2, 2.45, -0.05);                          // thigh
    mk(rig, cyl(0.12, 0.12, 1.2, 10), steel, s * 1.9, 1.5, 0.2);                               // piston
  });
  // ── hips / torso ──
  mk(rig, rbox(3.4, 0.7, 2.0, 0.2), iron, 0, 3.1, 0);
  mk(rig, rbox(3.3, 1.3, 2.3, 0.3), stone, 0, 3.95, 0);
  mk(rig, rbox(4.3, 1.9, 2.7, 0.35), iron, 0, 5.1, 0);
  mk(rig, rbox(4.5, 0.25, 2.9, 0.1), bronze, 0, 4.2, 0);                                       // belt
  mk(rig, rbox(4.55, 0.22, 2.95, 0.1), bronze, 0, 6.1, 0);                                     // collar
  for (let i = 0; i < 6; i++) mk(rig, rbox(0.55, 1.5, 0.12, 0.04), stone, -1.9 + i * 0.76, 5.15, -1.4); // rib plates
  // rose window
  const rose = grp(rig, 0, 5.1, -1.5);
  mk(rose, cyl(1.05, 1.05, 0.12, 36), dark, 0, 0, 0, Math.PI / 2, 0, 0);
  const rr1 = mk(rose, torus(0.95, 0.07, 40, 8), amber, 0, 0, 0.08);
  const rr2 = mk(rose, torus(0.6, 0.05, 32, 8), ember, 0, 0, 0.09);
  spin(rr1, 'z', 0.3);
  spin(rr2, 'z', -0.7);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    mk(rose, new THREE.BoxGeometry(0.05, 0.9, 0.04), amber, Math.cos(a) * 0.5, Math.sin(a) * 0.5, 0.08, 0, 0, a - Math.PI / 2);
  }
  const rcore = mk(rose, sph(0.26), white, 0, 0, 0.1);
  pulse(rcore, 0.18);
  pulse(mk(rose, sph(0.9), halo(0xffa21f, 0.2, true), 0, 0, 0.1), 0.1);
  mk(rose, torus(1.18, 0.1, 30, 8, Math.PI), bronze, 0, 0, 0.02);                              // gothic arch
  [-1, 1].forEach((s) => mk(rose, cyl(0.08, 0.08, 1.0, 8), bronze, s * 1.18, -0.5, 0.02));

  // ── shoulders: spires + flying buttresses ──
  [-1, 1].forEach((s) => {
    mk(rig, rbox(1.9, 1.0, 1.9, 0.25), stone, s * 2.85, 5.85, 0);
    mk(rig, rbox(2.0, 0.18, 2.0, 0.06), bronze, s * 2.85, 6.4, 0);
    for (let i = 0; i < 4; i++) {
      const hgt = 1.9 - Math.abs(i - 1.5) * 0.35;
      mk(rig, cone(0.24, hgt, 4), i % 2 ? iron : bronze, s * (2.35 + i * 0.32), 6.4 + hgt / 2, (i % 2 ? 0.35 : -0.35));
    }
    mk(rig, torus(1.1, 0.12, 24, 8, Math.PI * 0.8), stone, s * 2.1, 6.0, 0.9, 0, Math.PI / 2, s > 0 ? 0 : 0);
    const arm = k.armPivot(s, s * 2.9, 5.4, 0);
    // arm
    const elbow = V(s * 3.2, 3.8, -0.3);
    strut(arm, V(s * 2.9, 5.4, 0), elbow, 0.62, 0.55, iron);
    mk(arm, rbox(1.2, 1.3, 1.2, 0.25), stone, s * 3.05, 4.6, -0.1);
    mk(arm, sph(0.62), bronze, elbow.x, elbow.y, elbow.z);
    mk(arm, rbox(1.75, 1.7, 1.65, 0.28), stone, s * 3.25, 2.8, -0.7);                         // forearm gauntlet
    mk(arm, rbox(1.8, 0.2, 1.7, 0.08), bronze, s * 3.25, 3.5, -0.7);
    mk(arm, new THREE.BoxGeometry(0.08, 1.2, 0.04), amber, s * 3.25, 2.8, -1.55);
    mk(arm, rbox(1.55, 1.25, 1.5, 0.25), iron, s * 3.25, 1.4, -0.95);                         // fist
    for (let i = 0; i < 4; i++) mk(arm, cone(0.17, 0.5, 5), bronze, s * 3.25 + (i - 1.5) * 0.36, 1.5, -1.8, -Math.PI / 2, 0, 0);
    // chains
    for (let i = 0; i < 7; i++) {
      const lk = mk(arm, torus(0.1, 0.03, 10, 6), steel, s * 4.1, 3.4 - i * 0.2, -0.3 + Math.sin(i) * 0.04, i % 2 ? Math.PI / 2 : 0, 0, 0);
      lk.scale.y = 1.4;
    }
  });
  // ── head ──
  mk(rig, cyl(0.45, 0.6, 0.5, 12), iron, 0, 6.4, 0);
  const bell = new THREE.LatheGeometry([V(0, 0, 0), V(0.55, 0, 0), V(0.62, 0.35, 0), V(0.5, 0.75, 0), V(0.22, 0.98, 0), V(0, 1.05, 0)].map((v) => new THREE.Vector2(v.x, v.y)), 20);
  mk(rig, bell, stone, 0, 6.55, 0);
  mk(rig, rbox(0.95, 0.55, 0.5, 0.12), iron, 0, 6.85, -0.4);                                   // cowl face
  mk(rig, new THREE.BoxGeometry(0.75, 0.1, 0.05), amber, 0, 6.9, -0.68);                       // eye slit
  mk(rig, new THREE.BoxGeometry(0.14, 0.14, 0.06), white, 0, 6.9, -0.7);
  const crown = grp(rig, 0, 7.55, 0);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    mk(crown, cone(0.09, 0.6 + (i % 2) * 0.25, 4), i % 2 ? bronze : amber, Math.cos(a) * 0.5, 0, Math.sin(a) * 0.5);
  }
  mk(crown, torus(0.5, 0.04, 28, 6), amber, 0, -0.25, 0, Math.PI / 2, 0, 0);
  spin(crown, 'y', 0.5);
  // ── back: bell tower hump ──
  mk(rig, rbox(2.6, 2.0, 1.2, 0.3), stone, 0, 5.3, 1.9);
  mk(rig, cone(0.9, 1.6, 4), iron, 0, 7.1, 1.9, 0, Math.PI / 4, 0);
  [-0.65, 0.65].forEach((x) => {
    const b2 = new THREE.LatheGeometry([[0, 0], [0.4, 0], [0.5, 0.25], [0.36, 0.55], [0.1, 0.7], [0, 0.72]].map(([a, b]) => new THREE.Vector2(a, b)), 16);
    mk(rig, b2, bronze, x, 5.5, 2.5, Math.PI, 0, 0);
    mk(rig, sph(0.1), amber, x, 4.85, 2.5);
  });
  [-1, 1].forEach((s) => {
    mk(rig, cyl(0.18, 0.24, 0.8, 8), iron, s * 1.5, 6.3, 1.5);
    mk(rig, cone(0.2, 0.55, 6), ember, s * 1.5, 6.9, 1.5);
    mk(rig, sph(0.34), halo(0xff5a1a, 0.3, true), s * 1.5, 6.95, 1.5);
  });
  cable(rig, [V(-1.2, 3.4, 1.0), V(-1.8, 4.0, 1.5), V(-1.1, 5.0, 1.4)], 0.07, dark);
  cable(rig, [V(1.2, 3.4, 1.0), V(1.8, 4.0, 1.5), V(1.1, 5.0, 1.4)], 0.07, dark);
  // rune stones
  for (let i = 0; i < 5; i++) {
    const st = mk(rig, rbox(0.4, 0.7, 0.2, 0.05), i % 2 ? bronze : stone);
    orbit(st, 4.6 + (i % 2) * 0.5, 2.2 + i * 1.1, i * 1.26, 0.55 + i * 0.05);
    mk(st, new THREE.BoxGeometry(0.1, 0.34, 0.04), amber, 0, 0, -0.11);
  }
  return k.refs;
}

// ───────────────────────── TITAN DREADNOUGHT PRIME ─────────────────────────
function buildTitan(rig: THREE.Group): BossRefs {
  const k = createKit('titan', rig, 0xff1a1a);
  const { armor, solid, glow, halo, rbox, cyl, sph, cone, torus, mk, grp, V, strut, cable, spin, orbit, pulse } = k;
  const texH = panelTexture('#46505e', '#aab8cc', 5);
  const texD = panelTexture('#272d38', '#8494ab', 6);
  const texZ = panelTexture('#566074', '#dbe4f0', 4, true);
  const hullM = armor(0x3a4453, texH, 0.7, 0.36);
  const dark = armor(0x12151b, texD, 0.75, 0.35);
  const skirt = armor(0x4a5565, texZ, 0.65, 0.4);
  const steel = solid(0xb5c0cf, 0.92, 0.22);
  const black = solid(0x050608, 0.4, 0.6);
  const red = glow(0xff2a1a, true);
  const orange = glow(0xff8a1f, true);
  const white = glow(0xffe8e0);
  const lens = glow(0xff3322, true);

  // ── legs ──
  [-1, 1].forEach((s) => {
    mk(rig, rbox(2.0, 0.5, 2.6, 0.14), dark, s * 1.9, 0.25, -0.2);                             // foot
    mk(rig, rbox(1.7, 0.2, 0.4, 0.05), skirt, s * 1.9, 0.55, -1.35);
    for (let i = 0; i < 3; i++) mk(rig, rbox(0.5, 0.3, 0.5, 0.06), steel, s * 1.9 + (i - 1) * 0.6, 0.2, -1.65);
    strut(rig, V(s * 1.9, 0.5, 0.1), V(s * 1.9, 1.7, -0.1), 0.55, 0.45, hullM);                // shin
    mk(rig, rbox(1.3, 1.3, 0.3, 0.1), skirt, s * 1.9, 1.15, -0.65);
    mk(rig, cyl(0.15, 0.15, 1.5, 10), steel, s * 2.55, 1.2, 0.2);                              // piston
    mk(rig, cyl(0.24, 0.24, 0.8, 10), dark, s * 2.55, 0.8, 0.2);
    mk(rig, sph(0.62), dark, s * 1.9, 1.75, -0.1);                                             // knee
    mk(rig, torus(0.62, 0.06, 24, 8), orange, s * 1.9, 1.75, -0.1, 0, Math.PI / 2, 0);
    mk(rig, rbox(1.5, 1.3, 1.5, 0.25), hullM, s * 1.9, 2.5, -0.05);                            // thigh
  });
  // ── hull ──
  mk(rig, rbox(5.1, 1.0, 3.2, 0.2), dark, 0, 3.35, 0);
  mk(rig, rbox(4.6, 1.8, 3.0, 0.3), hullM, 0, 4.5, 0);
  mk(rig, rbox(4.0, 0.9, 0.5, 0.15), skirt, 0, 4.95, -1.62, 0.28, 0, 0);                       // sloped glacis
  [-1, 1].forEach((s) => {
    mk(rig, rbox(0.35, 1.7, 3.1, 0.1), skirt, s * 2.7, 4.0, 0);
    mk(rig, rbox(0.3, 0.14, 3.2, 0.04), orange, s * 2.72, 4.9, 0);
  });
  mk(rig, rbox(4.8, 0.22, 3.2, 0.08), steel, 0, 5.45, 0);                                       // roof plate
  // chest furnace grill
  mk(rig, rbox(2.0, 1.1, 0.2, 0.06), black, 0, 4.15, -2.12, 0.28, 0, 0);
  for (let i = 0; i < 9; i++) mk(rig, new THREE.BoxGeometry(0.12, 0.95, 0.06), i % 2 ? red : orange, -0.88 + i * 0.22, 4.13, -2.2, 0.28, 0, 0);
  pulse(mk(rig, new THREE.BoxGeometry(2.1, 1.2, 0.04), halo(0xff4a1a, 0.18, true), 0, 4.15, -2.26, 0.28, 0, 0), 0.06);
  // ── bridge / head ──
  mk(rig, rbox(1.9, 0.95, 1.5, 0.28), hullM, 0, 5.95, -0.3);
  mk(rig, rbox(1.5, 0.45, 0.3, 0.1), black, 0, 6.0, -1.0);
  mk(rig, new THREE.BoxGeometry(1.35, 0.16, 0.05), lens, 0, 6.05, -1.16);
  mk(rig, new THREE.BoxGeometry(0.25, 0.1, 0.06), white, 0, 6.05, -1.18);
  const dishRig = grp(rig, 0.8, 6.6, 0.1);
  mk(dishRig, cone(0.5, 0.4, 20), steel, 0, 0, 0, Math.PI, 0, 0);
  mk(dishRig, cyl(0.04, 0.04, 0.5, 6), steel, 0, 0.35, 0);
  mk(dishRig, sph(0.08), red, 0, 0.62, 0);
  spin(dishRig, 'y', 1.6);
  for (let i = 0; i < 4; i++) {
    mk(rig, cyl(0.03, 0.03, 1.2 + i * 0.4, 6), steel, -0.8 + i * 0.25, 6.9 + i * 0.1, 0.2);
    mk(rig, sph(0.05), red, -0.8 + i * 0.25, 7.5 + i * 0.3, 0.2);
  }
  // ── shoulder turrets with long guns ──
  [-1, 1].forEach((s) => {
    const tur = grp(rig, s * 2.5, 5.7, 0.1);
    k.refs.guns.push({ obj: tur });
    mk(tur, cyl(0.95, 1.05, 0.45, 24), dark, 0, 0, 0);
    mk(tur, rbox(1.5, 0.8, 1.7, 0.2), hullM, 0, 0.55, 0.1);
    mk(tur, rbox(0.4, 0.7, 1.2, 0.08), skirt, s * 0.75, 0.55, -0.1);
    [-0.32, 0.32].forEach((bx) => {
      mk(tur, cyl(0.14, 0.17, 3.6, 14), steel, bx, 0.6, -2.0, Math.PI / 2, 0, 0);
      mk(tur, cyl(0.24, 0.24, 1.3, 14), dark, bx, 0.6, -0.9, Math.PI / 2, 0, 0);             // coolant jacket
      mk(tur, cyl(0.22, 0.2, 0.35, 12), black, bx, 0.6, -3.85, Math.PI / 2, 0, 0);            // muzzle brake
      mk(tur, torus(0.2, 0.03, 16, 6), red, bx, 0.6, -3.7, 0, 0, 0);
      for (let i = 0; i < 3; i++) mk(tur, torus(0.2, 0.025, 16, 6), orange, bx, 0.6, -1.6 - i * 0.55);
    });
    mk(tur, sph(0.18), red, 0, 1.0, -0.5);
  });
  // ── arms: rotary cannons ──
  [-1, 1].forEach((s) => {
    const arm = k.armPivot(s, s * 3.0, 4.7, 0);
    strut(arm, V(s * 3.0, 4.7, 0), V(s * 3.3, 3.5, -0.4), 0.6, 0.55, dark);
    mk(arm, rbox(1.2, 1.3, 1.3, 0.22), hullM, s * 3.25, 4.4, -0.1);
    mk(arm, sph(0.55), skirt, s * 3.3, 3.5, -0.4);
    mk(arm, rbox(1.2, 1.1, 1.8, 0.2), hullM, s * 3.3, 2.95, -0.9);
    const gat = grp(arm, s * 3.3, 2.9, -2.1);
    mk(gat, cyl(0.46, 0.5, 0.7, 18), dark, 0, 0, 0.6, Math.PI / 2, 0, 0);
    const bar = grp(gat, 0, 0, 0);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      mk(bar, cyl(0.075, 0.075, 1.9, 8), steel, Math.cos(a) * 0.28, Math.sin(a) * 0.28, -0.3, Math.PI / 2, 0, 0);
      mk(bar, cyl(0.09, 0.09, 0.12, 8), orange, Math.cos(a) * 0.28, Math.sin(a) * 0.28, -1.28, Math.PI / 2, 0, 0);
    }
    mk(bar, torus(0.34, 0.045, 24, 6), steel, 0, 0, -0.5);
    mk(bar, torus(0.34, 0.045, 24, 6), steel, 0, 0, -1.0);
    spin(bar, 'z', s * 2.2);
    for (let i = 0; i < 3; i++) mk(arm, rbox(0.3, 0.16, 1.4, 0.04), orange, s * 3.9, 2.6 + i * 0.3, -0.9);
  });
  // ── back: missile racks + exhaust stacks ──
  [-1, 1].forEach((s) => {
    mk(rig, rbox(1.9, 1.7, 1.1, 0.14), dark, s * 1.35, 5.2, 1.75);
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 4; c++) {
        const x = s * 1.35 + (c - 1.5) * 0.4;
        const y = 4.7 + r * 0.45;
        mk(rig, cyl(0.15, 0.15, 0.4, 10), steel, x, y, 2.35, Math.PI / 2, 0, 0);
        mk(rig, cone(0.12, 0.28, 8), (r + c) % 2 ? red : orange, x, y, 2.5, -Math.PI / 2, 0, 0);
      }
    }
    mk(rig, cyl(0.28, 0.34, 1.6, 12), dark, s * 0.4, 6.1, 1.2);
    mk(rig, torus(0.28, 0.05, 18, 6), orange, s * 0.4, 6.9, 1.2, Math.PI / 2, 0, 0);
    mk(rig, sph(0.3), halo(0xff6a1a, 0.3, true), s * 0.4, 7.0, 1.2);
  });
  cable(rig, [V(-1.5, 3.2, 1.4), V(-2.3, 3.9, 1.8), V(-2.9, 4.8, 0.6)], 0.08, black);
  cable(rig, [V(1.5, 3.2, 1.4), V(2.3, 3.9, 1.8), V(2.9, 4.8, 0.6)], 0.08, black);
  // reactor strip around the hull
  const belt = mk(rig, torus(2.55, 0.05, 48, 6), red, 0, 3.9, 0, Math.PI / 2, 0, 0);
  belt.scale.set(1, 0.62, 1);
  pulse(belt, 0.03);
  // drifting plates
  for (let i = 0; i < 4; i++) {
    const p = mk(rig, rbox(0.8, 0.12, 0.5, 0.03), skirt);
    orbit(p, 5.0 + (i % 2) * 0.5, 2.0 + i * 1.3, i * 1.57, 0.4 + i * 0.05, 0.3);
  }
  return k.refs;
}

// ───────────────────────── LEVIATHAN MK-IV (tidal sanctum) ─────────────────────────
function buildKraken(rig: THREE.Group): BossRefs {
  const k = createKit('kraken', rig, 0xff5a2a);
  const { armor, solid, glow, halo, rbox, cyl, sph, cone, torus, mk, grp, V, cable, blade, spin, orbit, pulse, sway } = k;
  const texH = panelTexture('#2f8aa0', '#b6fff4', 4);
  const texP = panelTexture('#1d5566', '#5eead4', 5);
  const texC = panelTexture('#c2674f', '#fecdd3', 3);
  const hull = armor(0x3a9ab4, texH, 0.5, 0.45);
  const dark = armor(0x1f5a6a, texP, 0.6, 0.4);
  const coral = armor(0xc2674f, texC, 0.4, 0.5);
  const steel = solid(0x9fb6c2, 0.85, 0.25);
  const black = solid(0x03080b, 0.4, 0.6);
  const teal = glow(0x2dd4bf, true);
  const aqua = glow(0x67e8f9, true);
  const white = glow(0xe6fffb);

  // ── armoured mantle (dome) ──
  const dome = mk(rig, sph(2.5, 28), hull, 0, 4.3, 0.2);
  dome.scale.set(1, 0.95, 1.2);
  for (let i = 0; i < 6; i++) {
    const r = mk(rig, torus(2.55 - i * 0.05, 0.1, 48, 8, Math.PI), dark, 0, 4.3, 0.2, 0, (i / 6) * Math.PI, 0);
    r.scale.set(1, 0.95, 1.2);
    r.rotation.x = 0;
  }
  mk(rig, torus(2.45, 0.14, 48, 10), teal, 0, 3.55, 0.2, Math.PI / 2, 0, 0).scale.set(1, 1.2, 1);
  // dorsal crest of blades
  for (let i = 0; i < 7; i++) {
    const h = 1.5 - Math.abs(i - 3) * 0.2;
    mk(rig, blade(h, 0.42, 0.1), coral, 0, 6.35 - Math.abs(i - 3) * 0.12, 1.6 - i * 0.55, 0.4 - i * 0.12, 0, 0);
  }
  // ── face / eye ──
  mk(rig, rbox(3.0, 1.9, 1.0, 0.35), dark, 0, 4.1, -2.35);
  const eye = mk(rig, sph(0.82, 24), aqua, 0, 4.2, -2.75);
  mk(rig, torus(0.92, 0.1, 36, 10), steel, 0, 4.2, -2.8);
  mk(rig, torus(1.18, 0.05, 40, 8), teal, 0, 4.2, -2.76);
  const eyeHalo = mk(rig, sph(1.5), halo(0x67e8f9, 0.2, true), 0, 4.2, -2.75);
  mk(rig, new THREE.BoxGeometry(0.16, 0.9, 0.06), black, 0, 4.2, -3.55);
  pulse(eye, 0.12); pulse(eyeHalo, 0.1);
  [-1, 1].forEach((s) => {
    mk(rig, sph(0.28), teal, s * 1.3, 4.55, -2.75);
    mk(rig, sph(0.2), teal, s * 1.5, 3.85, -2.7);
    mk(rig, blade(1.0, 0.3, 0.08), steel, s * 1.75, 3.5, -2.5, 0, 0, s * 2.4);          // mandible blades
  });
  // ── anglerfish lure ──
  const lure = grp(rig, 0, 6.2, -1.2);
  cable(lure, [V(0, 0, 0), V(0, 1.2, -0.6), V(0, 1.9, -1.8), V(0, 1.2, -2.8)], 0.07, black);
  const bulb = mk(lure, sph(0.34), white, 0, 1.2, -2.85);
  const bulbHalo = mk(lure, sph(0.9), halo(0x99f6e4, 0.25, true), 0, 1.2, -2.85);
  pulse(bulb, 0.2); pulse(bulbHalo, 0.15);
  sway(lure, 'z', 0.1, 1.2);
  // ── shoulder pods with cannons ──
  [-1, 1].forEach((s) => {
    const pod = grp(rig, s * 2.9, 4.6, -0.6);
    k.refs.guns.push({ obj: pod });
    mk(pod, sph(0.9), dark);
    mk(pod, rbox(1.1, 0.7, 1.4, 0.2), hull, 0, 0.55, -0.1);
    mk(pod, cyl(0.2, 0.26, 2.8, 14), steel, 0, 0.4, -1.8, Math.PI / 2, 0, 0);
    mk(pod, torus(0.26, 0.04, 20, 6), teal, 0, 0.4, -3.1);
    mk(pod, cyl(0.3, 0.3, 0.8, 14), dark, 0, 0.4, -0.9, Math.PI / 2, 0, 0);
    sway(pod, 'y', 0.08, 0.9, s);
  });
  // ── tentacles ──
  const SEG = 5;
  const tentacle = (x: number, z: number, yaw: number, rise: number, bend: number, len: number, r0: number, ph: number) => {
    const root = grp(rig, x, 3.0, z, 0, yaw, 0);
    const lift = grp(root);
    k.refs.lifts.push({ obj: lift, idx: k.refs.lifts.length, front: z < 0, side: Math.sign(x) || 1 });
    let parent: THREE.Object3D = lift;
    for (let i = 0; i < SEG; i++) {
      const L = len * (1 - i * 0.1);
      const r = r0 * (1 - i * 0.16);
      const g = grp(parent, 0, 0, i === 0 ? 0 : -len * (1 - (i - 1) * 0.1), i === 0 ? rise : bend, 0, 0);
      mk(g, cyl(r * 0.84, r, L, 12), i % 2 ? hull : dark, 0, 0, -L / 2, Math.PI / 2, 0, 0);
      mk(g, torus(r * 0.95, 0.045, 20, 6), i % 2 ? teal : aqua, 0, 0, -L * 0.05, 0, 0, 0);
      mk(g, sph(r * 0.95, 10), steel, 0, 0, 0);
      if (i < SEG - 1) for (let j = 0; j < 3; j++) mk(g, cone(r * 0.2, r * 0.9, 4), coral, r * 0.9, 0, -L * (0.25 + j * 0.25), 0, 0, -Math.PI / 2);
      sway(g, 'y', 0.2 + i * 0.05, 1.1, ph + i * 0.7);
      parent = g;
      if (i === SEG - 1) {
        const tip = grp(g, 0, 0, -L, 0, 0, 0);
        for (let j = -1; j <= 1; j++) mk(tip, blade(r * 4.2, r * 1.2, 0.08), coral, j * r * 0.9, 0, 0, -Math.PI / 2 + 0.2, 0, j * 0.3);
        mk(tip, sph(r * 0.7, 8), teal, 0, 0, 0);
      }
    }
  };
  // front tentacles curl down to the floor, rear ones rise behind the mantle
  tentacle(-1.7, -1.4, 0.35, -0.1, -0.5, 2.1, 0.6, 0.0);
  tentacle(1.7, -1.4, -0.35, -0.1, -0.5, 2.1, 0.6, 1.6);
  tentacle(-2.4, -0.2, 1.25, 0.0, -0.55, 2.1, 0.62, 3.1);
  tentacle(2.4, -0.2, -1.25, 0.0, -0.55, 2.1, 0.62, 4.7);
  tentacle(-2.2, 1.6, 2.35, 0.45, -0.38, 2.2, 0.56, 0.8);
  tentacle(2.2, 1.6, -2.35, 0.45, -0.38, 2.2, 0.56, 2.4);
  tentacle(-0.9, 2.2, 3.0, 0.65, -0.3, 2.2, 0.52, 3.9);
  tentacle(0.9, 2.2, -3.0, 0.65, -0.3, 2.2, 0.52, 5.5);
  // drifting plates / bubbles
  for (let i = 0; i < 5; i++) {
    const p = mk(rig, rbox(0.7, 0.12, 0.5, 0.03), hull);
    orbit(p, 5.4 + (i % 2) * 0.5, 1.8 + i * 1.2, i * 1.25, 0.35 + i * 0.04, 0.35);
  }
  for (let i = 0; i < 6; i++) {
    const b = mk(rig, sph(0.22, 10), halo(0x99f6e4, 0.3, true));
    orbit(b, 3.8 + (i % 3) * 0.6, 1.0 + i * 1.0, i * 1.05, 0.5 + i * 0.05, 0.4);
  }
  spin(mk(rig, torus(3.2, 0.05, 56, 6), teal, 0, 3.2, 0.2, Math.PI / 2, 0, 0), 'z', 0.4);
  return k.refs;
}

// ───────────────────────── HELIOS WARDEN (glass citadel) ─────────────────────────
function buildWarden(rig: THREE.Group): BossRefs {
  const k = createKit('warden', rig, 0xff3d6e);
  const { armor, solid, glow, halo, rbox, cyl, sph, cone, torus, mk, grp, V, strut, cable, blade, spin, orbit, pulse, sway } = k;
  const texV = panelTexture('#5b43a8', '#e0d4ff', 4);
  const texD = panelTexture('#2e2358', '#a78bfa', 5);
  const texG = panelTexture('#7a5a14', '#fde68a', 3);
  const robe = armor(0x7a60d0, texV, 0.45, 0.45);
  const dark = armor(0x3a2d6e, texD, 0.6, 0.38);
  const gold = armor(0xd4a017, texG, 0.85, 0.28);
  const steel = solid(0xcfc7ee, 0.9, 0.2);
  const black = solid(0x04030a, 0.4, 0.6);
  const violet = glow(0xa78bfa, true);
  const sun = glow(0xfde68a, true);
  const white = glow(0xfdf9ff);
  const glass = new THREE.MeshPhysicalMaterial({ color: 0xd9ccff, transparent: true, opacity: 0.55, metalness: 0.1, roughness: 0.05, clearcoat: 1, emissive: 0x5b21b6, emissiveIntensity: 0.35 });

  // ── legs hidden in a layered tabard ──
  [-1, 1].forEach((s) => {
    mk(rig, rbox(1.1, 0.4, 1.7, 0.12), dark, s * 1.1, 0.2, -0.2);
    strut(rig, V(s * 1.1, 0.4, 0), V(s * 1.0, 2.2, 0), 0.5, 0.42, dark);
    mk(rig, rbox(0.85, 1.1, 0.3, 0.1), gold, s * 1.1, 1.0, -0.48, 0.05, 0, 0);
    mk(rig, sph(0.42), gold, s * 1.0, 2.2, -0.05);
    mk(rig, new THREE.BoxGeometry(0.07, 0.8, 0.03), violet, s * 1.1, 1.0, -0.66);
  });
  for (let i = 0; i < 5; i++) {
    const w = 3.6 - i * 0.3;
    mk(rig, rbox(w, 1.8 - i * 0.18, 0.2, 0.07), i % 2 ? robe : dark, 0, 2.2 - i * 0.2 + 0.2, -0.9 + i * 0.06, 0.1 + i * 0.03, 0, 0);
  }
  // ── hips / torso ──
  mk(rig, rbox(2.6, 0.7, 1.7, 0.2), dark, 0, 3.0, 0);
  mk(rig, rbox(2.9, 1.6, 2.0, 0.3), robe, 0, 4.1, 0);
  mk(rig, rbox(3.8, 1.5, 2.3, 0.32), dark, 0, 5.2, 0);
  mk(rig, rbox(3.95, 0.22, 2.45, 0.08), gold, 0, 4.4, 0);
  mk(rig, rbox(4.0, 0.2, 2.5, 0.08), gold, 0, 5.95, 0);
  for (let i = 0; i < 5; i++) mk(rig, rbox(0.5, 1.3, 0.1, 0.04), robe, -1.5 + i * 0.75, 5.2, -1.2);
  // sun core
  const coreRig = grp(rig, 0, 5.2, -1.35);
  mk(coreRig, cyl(0.85, 0.9, 0.2, 28), black, 0, 0, 0, Math.PI / 2, 0, 0);
  const cr1 = mk(coreRig, torus(0.75, 0.06, 40, 8), sun, 0, 0, 0.12);
  const cr2 = mk(coreRig, torus(0.5, 0.05, 32, 8), violet, 0, 0, 0.14);
  spin(cr1, 'z', 0.6); spin(cr2, 'z', -1.1);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    mk(cr1, cone(0.07, i % 2 ? 0.3 : 0.5, 4), sun, Math.cos(a) * 0.95, Math.sin(a) * 0.95, 0, 0, 0, a - Math.PI / 2);
  }
  const core = mk(coreRig, sph(0.3), white, 0, 0, 0.15);
  const coreHalo = mk(coreRig, sph(1.0), halo(0xfde68a, 0.25, true), 0, 0, 0.15);
  pulse(core, 0.15); pulse(coreHalo, 0.12);
  // ── head with veil ──
  mk(rig, cyl(0.3, 0.4, 0.4, 12), dark, 0, 6.2, -0.05);
  mk(rig, rbox(1.0, 1.1, 1.0, 0.25), dark, 0, 6.75, -0.05);
  mk(rig, rbox(0.78, 0.8, 0.3, 0.1), robe, 0, 6.7, -0.55);
  mk(rig, new THREE.BoxGeometry(0.7, 0.08, 0.05), violet, 0, 6.78, -0.72);
  mk(rig, new THREE.BoxGeometry(0.12, 0.3, 0.05), sun, 0, 6.5, -0.72);
  for (let i = -2; i <= 2; i++) mk(rig, cone(0.09, 0.9 - Math.abs(i) * 0.15, 4), gold, i * 0.22, 7.5, -0.05, 0, 0, i * -0.16);
  // ── solar halo (big ring behind the head) ──
  const haloRig = grp(rig, 0, 6.9, 1.1);
  const ringA = mk(haloRig, torus(2.5, 0.12, 64, 12), gold);
  const ringB = mk(haloRig, torus(2.0, 0.07, 56, 8), violet, 0, 0, 0.04);
  mk(haloRig, torus(2.5, 0.4, 48, 8), halo(0xfde68a, 0.12, true));
  spin(ringA, 'z', 0.25); spin(ringB, 'z', -0.5);
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2;
    mk(ringA, cone(0.12, i % 2 ? 0.7 : 1.2, 4), i % 2 ? sun : white, Math.cos(a) * 2.75, Math.sin(a) * 2.75, 0, 0, 0, a - Math.PI / 2);
  }
  // ── arms: lance (right) and prism shield (left) ──
  const armInner: Record<number, THREE.Group> = {};
  [-1, 1].forEach((s) => {
    mk(rig, sph(0.95), robe, s * 2.35, 5.5, 0).scale.set(1, 0.7, 1.1);
    mk(rig, sph(0.6), gold, s * 2.5, 6.0, 0).scale.set(1, 0.7, 1);
    for (let i = 0; i < 3; i++) mk(rig, cone(0.13, 0.9, 5), dark, s * (2.2 + i * 0.35), 6.35, 0.1, 0, 0, s * -(0.5 + i * 0.25));
    const arm = k.armPivot(s, s * 2.35, 5.2, 0);
    armInner[s] = arm;
    const elbow = V(s * 2.8, 4.1, -0.3);
    strut(arm, V(s * 2.35, 5.2, 0), elbow, 0.42, 0.38, dark);
    mk(arm, sph(0.42), gold, elbow.x, elbow.y, elbow.z);
    const wrist = V(s * 2.7, 3.0, -1.4);
    strut(arm, elbow, wrist, 0.45, 0.4, robe);
    mk(arm, rbox(0.9, 0.9, 0.9, 0.16), gold, wrist.x, wrist.y, wrist.z);
  });
  // lance
  const lance = grp(armInner[1], 2.7, 3.0, -1.4, -0.05, 0, 0);
  mk(lance, cyl(0.09, 0.09, 8.5, 10), steel, 0, 1.6, 0);
  mk(lance, cone(0.38, 2.0, 4), glass, 0, 6.7, 0);
  mk(lance, cone(0.18, 2.2, 4), white, 0, 6.8, 0);
  mk(lance, torus(0.3, 0.05, 20, 6), sun, 0, 5.4, 0, Math.PI / 2, 0, 0);
  sway(lance, 'x', 0.04, 0.8);
  // prism shield
  const shield = grp(armInner[-1], -3.3, 3.5, -1.6, 0, 0.35, 0);
  mk(shield, new THREE.CylinderGeometry(1.5, 1.5, 0.22, 6), glass, 0, 0, 0, Math.PI / 2, 0, 0);
  mk(shield, new THREE.CylinderGeometry(1.6, 1.6, 0.12, 6), gold, 0, 0, 0.14, Math.PI / 2, 0, 0);
  mk(shield, new THREE.OctahedronGeometry(0.5, 0), violet, 0, 0, -0.2);
  sway(shield, 'y', 0.06, 0.7, 1);
  // ── floating glass blades ──
  for (let i = 0; i < 8; i++) {
    const b = grp(rig, 0, 0, 0);
    mk(b, blade(1.6, 0.34, 0.08), i % 2 ? glass : steel, 0, 0, 0, Math.PI, 0, 0);
    mk(b, new THREE.BoxGeometry(0.03, 1.3, 0.02), i % 2 ? violet : sun, 0, -0.75, 0.05);
    orbit(b, 4.8 + (i % 2) * 0.7, 2.2 + (i % 4) * 1.3, i * 0.785, 0.55 + (i % 3) * 0.08, 0.3);
  }
  // cloak cables
  [-1, 1].forEach((s) => cable(rig, [V(s * 0.4, 3.2, 1.0), V(s * 1.3, 3.8, 1.5), V(s * 2.0, 4.8, 0.9)], 0.07, black));
  return k.refs;
}

// ───────────────────────── FROST CORE (frozen archive vault) ─────────────────────────
// Eight-legged cryo walker: navy chassis, white armour, ice-blade legs, a crystal core and a floating halo.
function buildFrost(rig: THREE.Group): BossRefs {
  const k = createKit('frost', rig, 0xff5577);
  const { armor, solid, glow, halo, rbox, cyl, sph, cone, torus, mk, grp, V, strut, blade, spin, orbit, pulse, sway } = k;
  const texW = panelTexture('#c6d8e8', '#ffffff', 4);
  const texD = panelTexture('#0f1b2e', '#4f7ba6', 5);
  const white = armor(0xe6f1fa, texW, 0.4, 0.4);
  const navy = armor(0x16263d, texD, 0.6, 0.38);
  const steel = solid(0x9fb6cc, 0.85, 0.25);
  const black = solid(0x040810, 0.4, 0.6);
  const cyan = glow(0x38bdf8, true);
  const aqua = glow(0x67e8f9, true);
  const snow = glow(0xf0fbff);
  const ice = new THREE.MeshPhysicalMaterial({ color: 0x7fd4ff, transparent: true, opacity: 0.72, metalness: 0.1, roughness: 0.05, clearcoat: 1, emissive: 0x1a90e0, emissiveIntensity: 0.5, flatShading: true });
  const iceDeep = new THREE.MeshPhysicalMaterial({ color: 0x5cc8f5, transparent: true, opacity: 0.75, metalness: 0.1, roughness: 0.05, clearcoat: 1, emissive: 0x1a8ad0, emissiveIntensity: 0.7, flatShading: true });
  const orient = (o: THREE.Object3D, dir: THREE.Vector3) => o.quaternion.setFromUnitVectors(V(0, 1, 0), dir.clone().normalize());
  /** Cone with its base at a and its tip at b. */
  const spike = (parent: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3, r: number, mat: THREE.Material, seg = 5) => {
    const dir = new THREE.Vector3().subVectors(b, a);
    const m = mk(parent, cone(r, dir.length(), seg), mat);
    m.position.copy(a).addScaledVector(dir, 0.5);
    orient(m, dir);
    return m;
  };

  // ── eight legs: each pivots at the hip and extends along local -Z (angle a = from forward toward +X) ──
  const leg = (a: number, hipR: number, len: number, ph: number) => {
    const root = grp(rig, Math.sin(a) * hipR, 3.3, -Math.cos(a) * hipR, 0, -a, 0);
    const lift = grp(root);
    k.refs.lifts.push({ obj: lift, idx: k.refs.lifts.length, front: Math.abs(a) < Math.PI / 2, side: Math.sign(a) || 1 });
    const hip = V(0, 0, 0);
    const knee = V(0, 1.0 * len, -1.9 * len);
    const foot = V(0, -3.15, -3.5 * len);
    // hip joint disc with a cyan ring on both faces
    mk(lift, cyl(0.62, 0.62, 0.55, 18), navy, 0, 0, 0, 0, 0, Math.PI / 2);
    for (const sx of [-1, 1]) mk(lift, torus(0.44, 0.05, 24, 8), cyan, sx * 0.29, 0, 0, 0, Math.PI / 2, 0);
    // upper segment: navy strut plus a white armour spike lying on top
    strut(lift, hip, knee, 0.34, 0.27, navy);
    spike(lift, V(0, 0.38, 0.1), V(knee.x, knee.y + 0.5, knee.z - 0.1), 0.34, white, 4);
    // knee joint
    mk(lift, sph(0.46, 14), navy, knee.x, knee.y, knee.z);
    for (const sx of [-1, 1]) mk(lift, torus(0.36, 0.045, 20, 8), aqua, knee.x + sx * 0.4, knee.y, knee.z, 0, Math.PI / 2, 0);
    // lower segment: armoured core wrapped in a long ice blade that stabs the floor
    strut(lift, knee, foot, 0.3, 0.12, navy, 8);
    spike(lift, V(0, knee.y + 0.05, knee.z + 0.05), foot.clone().lerp(knee, 0.12), 0.5, white, 4);
    // flat ice blades flank the white armour core on both sides and reach past the tip
    const ld = foot.clone().sub(knee).normalize();
    const tipEnd = foot.clone().addScaledVector(ld, 0.5);
    for (const sx of [-1, 1]) {
      const b = mk(lift, blade(knee.distanceTo(tipEnd) * 0.98, 0.62, 0.14), ice, sx * 0.34, knee.y, knee.z);
      orient(b, ld);
      b.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), Math.PI / 2)); // stand the fin on edge
    }
    mk(lift, new THREE.BoxGeometry(0.05, 0.05, 2.6 * len), aqua, 0, knee.y - 1.05, knee.z - 1.25 * len, 0.62, 0, 0);
    sway(root, 'y', 0.035, 0.9, ph);
  };
  const D = Math.PI / 180;
  leg(-38 * D, 1.5, 0.78, 0.0); leg(38 * D, 1.5, 0.78, 1.6);
  leg(-78 * D, 1.7, 1.0, 3.1); leg(78 * D, 1.7, 1.0, 4.7);
  leg(-112 * D, 1.7, 1.0, 0.8); leg(112 * D, 1.7, 1.0, 2.4);
  leg(-152 * D, 1.5, 0.85, 3.9); leg(152 * D, 1.5, 0.85, 5.5);

  // ── chassis ──
  mk(rig, rbox(3.2, 1.2, 3.6, 0.3), navy, 0, 3.5, 0.1);
  mk(rig, rbox(2.3, 0.6, 2.9, 0.2), black, 0, 2.85, 0.1);
  mk(rig, rbox(2.7, 0.5, 3.2, 0.18), white, 0, 4.25, 0.15, -0.04, 0, 0);       // upper shell
  mk(rig, rbox(1.6, 0.45, 2.0, 0.15), white, 0, 4.05, -2.0, -0.28, 0, 0);       // prow plate
  for (const s of [-1, 1]) {
    mk(rig, rbox(0.5, 1.05, 3.0, 0.14), white, s * 1.65, 3.9, 0.1, 0, 0, s * -0.28);   // flank armour
    mk(rig, new THREE.BoxGeometry(0.05, 0.9, 0.05), cyan, s * 1.92, 3.9, -0.9, 0, 0, s * -0.28);
    mk(rig, new THREE.BoxGeometry(0.05, 0.9, 0.05), cyan, s * 1.92, 3.9, 0.9, 0, 0, s * -0.28);
    for (let i = 0; i < 3; i++) spike(rig, V(s * (0.9 + i * 0.5), 4.4, 1.2 + i * 0.4), V(s * (1.1 + i * 0.6), 4.8, 3.1 + i * 0.5), 0.22, white, 4);  // rear fins
  }
  // rear reactor vent
  mk(rig, rbox(1.4, 0.9, 0.3, 0.08), black, 0, 3.6, 1.95);
  for (let i = -2; i <= 2; i++) mk(rig, new THREE.BoxGeometry(0.1, 0.7, 0.04), aqua, i * 0.24, 3.6, 2.13);

  // ── ice crystal core on the chest ──
  const coreRig = grp(rig, 0, 3.95, -1.95);
  mk(coreRig, rbox(1.5, 1.7, 0.5, 0.12), black, 0, 0, 0.35);
  const crystal = mk(coreRig, new THREE.OctahedronGeometry(1, 0), iceDeep, 0, 0, 0);
  crystal.scale.set(0.78, 1.25, 0.8);
  const inner = mk(coreRig, new THREE.OctahedronGeometry(1, 0), snow, 0, 0, 0);
  inner.scale.set(0.3, 0.6, 0.3);
  const coreHalo = mk(coreRig, sph(1.25), halo(0x67e8f9, 0.22, true), 0, 0, 0);
  spin(mk(coreRig, torus(1.0, 0.04, 40, 8), aqua, 0, 0, -0.1), 'z', 0.7);
  pulse(inner, 0.16); pulse(coreHalo, 0.1);
  for (const s of [-1, 1]) { mk(rig, sph(0.13, 10), cyan, s * 0.9, 4.55, -2.55); mk(rig, sph(0.1, 10), aqua, s * 1.15, 4.2, -2.5); }

  // ── twin ice blades on the shoulders (they swing with the arm cues) ──
  [-1, 1].forEach((s) => {
    const base = V(s * 1.5, 4.9, 0.2);
    const arm = k.armPivot(s, base.x, base.y, base.z);
    mk(arm, rbox(1.0, 0.75, 1.3, 0.16), white, base.x, base.y, base.z);
    mk(arm, sph(0.48, 14), navy, base.x, base.y, base.z);
    mk(arm, torus(0.4, 0.05, 20, 8), cyan, base.x + s * 0.3, base.y, base.z, 0, Math.PI / 2, 0);
    const dir = V(s * 0.8, 0.3, 0.55).normalize();
    const bl = mk(arm, blade(8.0, 1.7, 0.32), ice, base.x, base.y, base.z);
    orient(bl, dir);
    const sheath = mk(arm, blade(3.6, 1.2, 0.5), white, base.x, base.y, base.z);
    orient(sheath, dir);
    const edge = mk(arm, blade(7.2, 0.26, 0.38), aqua, base.x, base.y, base.z);
    orient(edge, dir);
    for (let i = 0; i < 3; i++) {
      const o = base.clone().addScaledVector(dir, 2.4 + i * 1.7).add(V(0, 0.55, 0));
      spike(arm, o, o.clone().addScaledVector(dir, 1.1).add(V(0, 0.9, 0)), 0.17, ice, 4);
    }
  });

  // ── crown: floating halo with a crystal spire and orbiting diamonds ──
  const crown = grp(rig, 0, 6.5, 0.1);
  const ringA = mk(crown, torus(1.9, 0.07, 56, 8), cyan, 0, 0, 0, Math.PI / 2, 0, 0);
  const ringB = mk(crown, torus(1.4, 0.045, 48, 8), aqua, 0, 0.06, 0, Math.PI / 2, 0, 0);
  mk(crown, torus(1.9, 0.3, 40, 8), halo(0x67e8f9, 0.12, true), 0, 0, 0, Math.PI / 2, 0, 0);
  spin(ringA, 'z', 0.35); spin(ringB, 'z', -0.7);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    mk(ringA, cone(0.09, i % 2 ? 0.35 : 0.6, 4), i % 2 ? aqua : snow, Math.cos(a) * 2.05, Math.sin(a) * 2.05, 0, 0, 0, a - Math.PI / 2);
  }
  const spire = mk(crown, cone(0.55, 2.8, 6), ice, 0, 1.5, 0);
  mk(crown, cone(0.26, 2.9, 6), snow, 0, 1.55, 0);
  mk(crown, cone(0.4, 1.2, 6), ice, 0, -0.65, 0, Math.PI, 0, 0);
  const spireHalo = mk(crown, sph(1.0), halo(0x67e8f9, 0.2, true), 0, 1.0, 0);
  pulse(spireHalo, 0.12);
  void spire;
  for (let i = 0; i < 5; i++) {
    const d = mk(rig, new THREE.OctahedronGeometry(0.28, 0), i % 2 ? ice : iceDeep);
    d.scale.set(0.7, 1.4, 0.7);
    orbit(d, 2.5 + (i % 2) * 0.4, 6.0 + (i % 3) * 0.55, i * 1.26, 0.7 + i * 0.05, 0.25);
  }
  // loose ice shards circling low around the legs
  for (let i = 0; i < 7; i++) {
    const s = mk(rig, cone(0.2, 1.3, 4), i % 2 ? ice : white, 0, 0, 0, Math.PI, 0, 0);
    orbit(s, 5.6 + (i % 3) * 0.6, 1.4 + (i % 4) * 1.1, i * 0.9, 0.4 + i * 0.04, 0.3);
  }
  // cooling-field ring on the floor
  spin(mk(rig, torus(5.6, 0.05, 64, 6), aqua, 0, 0.12, 0, Math.PI / 2, 0, 0), 'z', 0.25);
  spin(mk(rig, torus(4.2, 0.03, 56, 6), cyan, 0, 0.12, 0, Math.PI / 2, 0, 0), 'z', -0.4);
  return k.refs;
}

// ───────────────────────── MYCO KING (overgrown sector throne) ─────────────────────────
// Mushroom-king walker: bark-armoured stem, steel face plate, a huge glowing cap that hangs brood sacs under its gills.
function buildMyco(rig: THREE.Group): BossRefs {
  const k = createKit('myco', rig, 0xff4d6d);
  const { armor, solid, glow, halo, rbox, cyl, sph, cone, torus, mk, grp, V, strut, cable, spin, orbit, pulse, sway } = k;
  const texBark = panelTexture('#4a3420', '#a98c5a', 5);
  const texCap = panelTexture('#8a3a10', '#fbbf24', 4);
  const texStem = panelTexture('#cfc6a4', '#fffbe6', 4);
  const texSteel = panelTexture('#16241d', '#6b8a78', 5);
  const bark = armor(0x8a6a44, texBark, 0.1, 0.8);
  const capM = armor(0xb8390c, texCap, 0.2, 0.55);
  capM.side = THREE.DoubleSide;
  const stemM = armor(0xeee6cc, texStem, 0.15, 0.6);
  const steel = armor(0x38503f, texSteel, 0.6, 0.4);
  const black = solid(0x040a07, 0.4, 0.6);
  const moss = solid(0x4d7c0f, 0.05, 0.85);
  const leaf = solid(0x65a30d, 0.1, 0.6);
  const cream = solid(0xfff3c4, 0.1, 0.5);
  const lime = glow(0xa3e635, true);
  const limeSoft = glow(0xd9f99d, true);
  const spore = glow(0xfde047, true);
  const orient = (o: THREE.Object3D, dir: THREE.Vector3) => o.quaternion.setFromUnitVectors(V(0, 1, 0), dir.clone().normalize());
  /** Cone with its base at a and its tip at b. */
  const spike = (parent: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3, r: number, mat: THREE.Material, seg = 5) => {
    const dir = new THREE.Vector3().subVectors(b, a);
    const m = mk(parent, cone(r, dir.length(), seg), mat);
    m.position.copy(a).addScaledVector(dir, 0.5);
    orient(m, dir);
    return m;
  };

  // ── six root legs (same lift rig as the other walkers) ──
  const leg = (a: number, hipR: number, len: number, ph: number) => {
    const root = grp(rig, Math.sin(a) * hipR, 2.7, -Math.cos(a) * hipR, 0, -a, 0);
    const lift = grp(root);
    k.refs.lifts.push({ obj: lift, idx: k.refs.lifts.length, front: Math.abs(a) < Math.PI / 2, side: Math.sign(a) || 1 });
    const hip = V(0, 0, 0);
    const knee = V(0, 0.9 * len, -1.7 * len);
    const foot = V(0, -2.6, -3.1 * len);
    mk(lift, sph(0.7, 12), bark, 0, 0, 0);
    strut(lift, hip, knee, 0.58, 0.42, bark);
    mk(lift, sph(0.56, 12), moss, knee.x, knee.y, knee.z);
    strut(lift, knee, foot, 0.42, 0.16, bark, 8);
    // moss mantle + thorn on the shin
    spike(lift, V(0, knee.y - 0.1, knee.z - 0.1), foot.clone().lerp(knee, 0.2), 0.42, moss, 5);
    for (let i = 0; i < 3; i++) spike(lift, foot.clone().add(V((i - 1) * 0.25, 0.25, 0.1)), foot.clone().add(V((i - 1) * 0.55, -0.1, -0.55)), 0.09, cream, 4);
    mk(lift, new THREE.TorusGeometry(0.46, 0.06, 8, 18), lime, knee.x, knee.y, knee.z, 0, Math.PI / 2, 0);
    sway(root, 'y', 0.03, 0.9, ph);
  };
  const D = Math.PI / 180;
  leg(-40 * D, 1.7, 0.85, 0.0); leg(40 * D, 1.7, 0.85, 1.6);
  leg(-92 * D, 1.9, 1.0, 3.1); leg(92 * D, 1.9, 1.0, 4.7);
  leg(-142 * D, 1.7, 0.9, 0.8); leg(142 * D, 1.7, 0.9, 2.4);

  // ── stem torso: lathe-turned trunk with steel bands ──
  const stemGeo = new THREE.LatheGeometry([V(0, 0, 0), V(2.6, 0, 0), V(2.4, 0.5, 0), V(1.9, 1.4, 0), V(1.85, 2.0, 0), V(2.1, 2.9, 0), V(2.4, 3.2, 0), V(0, 3.3, 0)].map((v) => new THREE.Vector2(v.x, v.y)), 28);
  mk(rig, stemGeo, stemM, 0, 2.4, 0);
  mk(rig, rbox(4.4, 0.7, 4.4, 0.2), steel, 0, 2.5, 0);
  mk(rig, cyl(2.0, 2.5, 0.9, 26), stemM, 0, 6.0, 0);
  mk(rig, torus(2.2, 0.12, 36, 8), lime, 0, 5.75, 0, Math.PI / 2, 0, 0);
  for (const [y, r] of [[3.4, 2.15], [4.5, 2.0], [5.3, 2.4]] as const) {
    mk(rig, torus(r, 0.11, 36, 8), steel, 0, y, 0, Math.PI / 2, 0, 0);
    mk(rig, torus(r + 0.02, 0.04, 36, 8), lime, 0, y + 0.1, 0, Math.PI / 2, 0, 0);
  }
  // steel face plate on the front with a visor of slit eyes and a vent mouth
  mk(rig, rbox(2.7, 2.0, 0.6, 0.2), steel, 0, 4.0, -2.0, -0.04, 0, 0);
  mk(rig, rbox(2.2, 0.5, 0.2, 0.08), black, 0, 4.35, -2.33);
  for (const s of [-1, 1]) mk(rig, new THREE.BoxGeometry(0.7, 0.14, 0.12), lime, s * 0.52, 4.38, -2.44, 0, 0, s * -0.22);
  for (let i = 0; i < 5; i++) mk(rig, new THREE.BoxGeometry(1.2 - Math.abs(i - 2) * 0.12, 0.06, 0.1), spore, 0, 3.7 + i * 0.1 - 0.15, -2.35);
  // brood-core in the chest (glows brighter as it births)
  const core = grp(rig, 0, 2.95, -2.0);
  mk(core, rbox(1.2, 1.0, 0.4, 0.14), black, 0, 0, 0.1);
  const coreOrb = mk(core, sph(0.4, 16), spore, 0, 0, -0.1);
  const coreHalo = mk(core, sph(0.75, 16), halo(0xfde047, 0.22, true), 0, 0, -0.1);
  pulse(coreOrb, 0.14); pulse(coreHalo, 0.1);
  // back: exhaust spores and a tangle of vines
  mk(rig, rbox(1.6, 1.2, 0.5, 0.14), black, 0, 4.0, 1.6);
  for (let i = -2; i <= 2; i++) mk(rig, new THREE.BoxGeometry(0.1, 0.9, 0.05), limeSoft, i * 0.26, 4.0, 1.88);

  // ── great cap ──
  const crown = grp(rig, 0, 6.45, 0);
  const dome = mk(crown, new THREE.SphereGeometry(4.6, 36, 14, 0, Math.PI * 2, 0, Math.PI / 2), capM, 0, 0, 0);
  dome.scale.set(1, 0.68, 1);
  mk(crown, torus(4.55, 0.34, 48, 10), bark, 0, 0.02, 0, Math.PI / 2, 0, 0);
  mk(crown, torus(4.6, 0.07, 56, 8), lime, 0, 0.16, 0, Math.PI / 2, 0, 0);
  mk(crown, new THREE.CircleGeometry(4.5, 44), halo(0xa3e635, 0.2, true), 0, -0.06, 0, Math.PI / 2, 0, 0);
  const gills = grp(crown, 0, -0.12, 0);
  for (let i = 0; i < 30; i++) {
    const a = (i / 30) * Math.PI * 2;
    mk(gills, new THREE.BoxGeometry(4.2, 0.12, 0.05), i % 3 ? limeSoft : lime, Math.cos(a) * 2.15, 0, Math.sin(a) * 2.15, 0, -a, 0);
  }
  spin(gills, 'y', 0.12);
  for (let i = 0; i < 16; i++) { // pale spots
    const th = i * 2.399, ph = 0.2 + (i % 4) * 0.28;
    const sp = mk(crown, sph(0.34 + (i % 3) * 0.12, 10), cream, Math.sin(ph) * Math.cos(th) * 4.6, Math.cos(ph) * 4.6 * 0.68 - 0.05, Math.sin(ph) * Math.sin(th) * 4.6);
    sp.scale.y = 0.5;
  }
  for (let i = 0; i < 6; i++) { // riveted steel plates along the front rim
    const a = (-0.9 + i * 0.36) - Math.PI / 2;
    mk(crown, rbox(1.3, 0.28, 0.9, 0.1), steel, Math.cos(a) * 4.05, 0.4, Math.sin(a) * 4.05, 0, -a + Math.PI / 2, 0);
    mk(crown, new THREE.BoxGeometry(0.9, 0.05, 0.06), lime, Math.cos(a) * 4.25, 0.58, Math.sin(a) * 4.25, 0, -a + Math.PI / 2, 0);
  }
  // spore vent on the crown
  mk(crown, cyl(0.7, 1.0, 0.9, 16), steel, 0, 3.0, 0);
  const vent = mk(crown, cyl(0.5, 0.5, 0.1, 16), lime, 0, 3.49, 0);
  const ventHalo = mk(crown, sph(1.1, 14), halo(0xbef264, 0.22, true), 0, 3.7, 0);
  pulse(vent, 0.12); pulse(ventHalo, 0.14);
  for (let i = 0; i < 4; i++) {
    const m = mk(crown, new THREE.OctahedronGeometry(0.2, 0), spore, 0, 4.1 + i * 0.5, 0);
    orbit(m, 0.4 + i * 0.12, 6.45 + 4.1 + i * 0.5, i * 1.6, 1.4 + i * 0.2, 0.12);
    crown.remove(m); rig.add(m);
  }

  // ── brood sacs hanging under the gills (little mushrooms ripening inside) ──
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + 0.2;
    const r = 2.9 + (i % 2) * 0.8;
    if (Math.sin(a) * r < -1.0) continue; // keep the face plate clear
    const hang = grp(rig, Math.cos(a) * r, 6.3, Math.sin(a) * r);
    const len = 1.1 + (i % 3) * 0.35;
    strut(hang, V(0, 0, 0), V(0, -len, 0), 0.07, 0.05, leaf);
    const sac = mk(hang, sph(0.5, 12), halo(0xbef264, 0.4, true), 0, -len - 0.35, 0);
    sac.scale.set(1, 1.25, 1);
    mk(hang, sph(0.22, 8), spore, 0, -len - 0.4, 0);
    const mcap = mk(hang, new THREE.SphereGeometry(0.2, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), capM, 0, -len - 0.28, 0);
    mcap.scale.y = 0.7;
    pulse(sac, 0.1);
    sway(hang, 'x', 0.1, 1.1, i * 0.7);
    sway(hang, 'z', 0.08, 0.9, i * 1.1);
  }
  // ivy hanging from the cap rim
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    if (Math.sin(a) < -0.55) continue;
    const base = V(Math.cos(a) * 4.5, 6.45, Math.sin(a) * 4.5);
    const g = grp(rig, base.x, base.y, base.z);
    cable(g, [V(0, 0, 0), V(Math.cos(a) * 0.2, -0.9, Math.sin(a) * 0.2), V(Math.cos(a) * 0.1, -1.9 - (i % 3) * 0.5, Math.sin(a) * 0.1)], 0.05, leaf);
    mk(g, cone(0.18, 0.5, 4), leaf, 0, -2.0 - (i % 3) * 0.5, 0, Math.PI, 0, 0);
    sway(g, 'z', 0.12, 1.0, i);
  }

  // ── spore-cannon arms ──
  [-1, 1].forEach((s) => {
    const base = V(s * 2.9, 5.0, 0);
    const arm = k.armPivot(s, base.x, base.y, base.z);
    mk(arm, sph(0.7, 14), steel, base.x, base.y, base.z);
    const pa = mk(arm, new THREE.SphereGeometry(0.85, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), capM, base.x, base.y + 0.2, base.z); // little cap pauldron
    pa.scale.y = 0.6;
    mk(arm, torus(0.82, 0.05, 20, 8), lime, base.x, base.y + 0.2, base.z, Math.PI / 2, 0, 0);
    const elbow = V(s * 3.7, 3.6, -0.6), hand = V(s * 3.5, 2.6, -2.8);
    strut(arm, base, elbow, 0.5, 0.42, bark);
    mk(arm, sph(0.5, 12), moss, elbow.x, elbow.y, elbow.z);
    strut(arm, elbow, hand, 0.5, 0.65, steel);
    // cannon muzzle (a hollow bell flower)
    const mz = mk(arm, cyl(0.62, 0.95, 0.9, 14), black, hand.x, hand.y - 0.15, hand.z - 0.35, -0.5, 0, 0);
    mk(arm, torus(0.95, 0.07, 20, 8), lime, hand.x, hand.y - 0.5, hand.z - 0.7, -0.5 + Math.PI / 2, 0, 0);
    const m1 = mk(arm, sph(0.42, 12), spore, hand.x, hand.y - 0.35, hand.z - 0.55);
    const m2 = mk(arm, sph(0.8, 12), halo(0xfde047, 0.22, true), hand.x, hand.y - 0.35, hand.z - 0.55);
    pulse(m1, 0.16); pulse(m2, 0.12);
    void mz;
    for (let i = 0; i < 4; i++) { // thorn knuckles
      const a = (i / 4) * Math.PI * 2;
      spike(arm, V(hand.x + Math.cos(a) * 0.5, hand.y + Math.sin(a) * 0.5 + 0.1, hand.z + 0.2), V(hand.x + Math.cos(a) * 0.75, hand.y + Math.sin(a) * 0.75 + 0.1, hand.z - 0.35), 0.1, cream, 4);
    }
  });

  // ── small mushrooms growing out of the shoulders and back ──
  for (let i = 0; i < 7; i++) {
    const a = 0.6 + i * 0.75;
    const x = Math.cos(a) * 1.7, z = Math.sin(a) * 1.7 + 0.6, y = 4.6 + (i % 3) * 0.35;
    const mg = grp(rig, x, y, z, (i % 2 ? 0.4 : -0.4), 0, (i % 3 - 1) * 0.5);
    mk(mg, cyl(0.07, 0.11, 0.55, 6), stemM, 0, 0.27, 0);
    const c = mk(mg, new THREE.SphereGeometry(0.3, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), i % 2 ? capM : steel, 0, 0.5, 0);
    c.scale.y = 0.65;
    mk(mg, sph(0.07, 6), i % 2 ? spore : lime, 0, 0.58, 0.18);
  }

  // ── orbiting spores + mycelium rings on the floor ──
  for (let i = 0; i < 12; i++) {
    const o = mk(rig, sph(0.18 + (i % 3) * 0.06, 8), i % 2 ? spore : limeSoft);
    orbit(o, 4.6 + (i % 3) * 0.8, 1.6 + (i % 5) * 1.5, i * 0.52, 0.5 + i * 0.03, 0.3);
  }
  spin(mk(rig, torus(5.8, 0.06, 64, 6), lime, 0, 0.12, 0, Math.PI / 2, 0, 0), 'z', 0.2);
  spin(mk(rig, torus(4.3, 0.04, 56, 6), limeSoft, 0, 0.12, 0, Math.PI / 2, 0, 0), 'z', -0.35);
  return k.refs;
}

// ───────────────────────── MAGMA CORE UNIT (molten foundry core chamber) ─────────────────────────
// Four-legged magma walker: cooled-basalt armour split by glowing seams, claw-blade legs that drip lava,
// a ring-shaped upper deck and a huge molten core in a ring housing on the chest (the muzzle of its magma cannon).
function buildMagma(rig: THREE.Group): BossRefs {
  const k = createKit('magma', rig, 0xffe9a0);
  const { armor, solid, glow, halo, rbox, cyl, sph, cone, torus, mk, grp, V, strut, blade, spin, orbit, pulse, sway } = k;
  const texBasalt = panelTexture('#4a3a36', '#ff7a1a', 5);
  const texPlate = panelTexture('#7a6a64', '#d8c4b4', 4);
  const texDark = panelTexture('#352a27', '#7a5a4c', 5);
  const basalt = armor(0x6a5650, texBasalt, 0.35, 0.6);
  const plate = armor(0x8a7468, texPlate, 0.45, 0.5);
  const dark = armor(0x2a201e, texDark, 0.5, 0.5);
  const steel = solid(0x7c726c, 0.85, 0.3);
  const black = solid(0x050302, 0.4, 0.6);
  const lava = glow(0xff4a0a, true);
  const lavaHot = glow(0xff8a1a, true);
  const lavaCore = glow(0xffd27a);
  const blue = glow(0x7dd3fc);
  const orient = (o: THREE.Object3D, dir: THREE.Vector3) => o.quaternion.setFromUnitVectors(V(0, 1, 0), dir.clone().normalize());
  /** Cone with its base at a and its tip at b. */
  const spike = (parent: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3, r: number, mat: THREE.Material, seg = 5) => {
    const dir = new THREE.Vector3().subVectors(b, a);
    const m = mk(parent, cone(r, dir.length(), seg), mat);
    m.position.copy(a).addScaledVector(dir, 0.5);
    orient(m, dir);
    return m;
  };

  // ── four claw legs: pivot at the hip, extend along local -Z (angle a = from forward toward +X) ──
  const leg = (a: number, hipR: number, len: number, ph: number) => {
    const root = grp(rig, Math.sin(a) * hipR, 3.6, -Math.cos(a) * hipR, 0, -a, 0);
    const lift = grp(root);
    k.refs.lifts.push({ obj: lift, idx: k.refs.lifts.length, front: Math.abs(a) < Math.PI / 2, side: Math.sign(a) || 1 });
    const hip = V(0, 0, 0);
    const knee = V(0, 1.5 * len, -2.0 * len);
    const foot = V(0, -3.55, -3.7 * len);
    // hip joint: dark drum with glowing rims
    mk(lift, cyl(0.85, 0.85, 0.9, 18), dark, 0, 0, 0, 0, 0, Math.PI / 2);
    for (const sx of [-1, 1]) mk(lift, torus(0.62, 0.06, 24, 8), lava, sx * 0.48, 0, 0, 0, Math.PI / 2, 0);
    // upper segment: thick strut with a basalt armour slab on top
    strut(lift, hip, knee, 0.5, 0.4, dark);
    const up = knee.clone().sub(hip);
    const slab = mk(lift, rbox(1.2, up.length() * 0.9, 0.5, 0.12), basalt, 0, 0, 0);
    slab.position.copy(hip).addScaledVector(up, 0.5).add(V(0, 0.42, 0.1));
    orient(slab, up);
    // knee joint with molten ring
    mk(lift, sph(0.72, 14), dark, knee.x, knee.y, knee.z);
    for (const sx of [-1, 1]) mk(lift, torus(0.55, 0.07, 22, 8), lavaHot, knee.x + sx * 0.62, knee.y, knee.z, 0, Math.PI / 2, 0);
    // lower segment: a long pointed claw plate whose centre seam glows, with lava creeping down it
    const ld = foot.clone().sub(knee).normalize();
    const tipEnd = foot.clone().addScaledVector(ld, 0.35);
    const clawLen = knee.distanceTo(tipEnd);
    const claw = mk(lift, blade(clawLen, 1.9, 0.62), plate, knee.x, knee.y, knee.z);
    orient(claw, ld);
    const seam = mk(lift, blade(clawLen * 0.94, 0.3, 0.7), lavaHot, knee.x, knee.y, knee.z);
    orient(seam, ld);
    for (const sx of [-1, 1]) {
      const edge = mk(lift, blade(clawLen * 0.96, 0.5, 0.5), basalt, knee.x + sx * 0.55, knee.y, knee.z);
      orient(edge, ld);
    }
    // glowing veins crossing the claw
    for (let i = 0; i < 3; i++) {
      const p = knee.clone().addScaledVector(ld, clawLen * (0.25 + i * 0.22));
      const v = mk(lift, new THREE.BoxGeometry(0.9 - i * 0.2, 0.05, 0.06), lava, p.x, p.y, p.z + 0.31);
      v.quaternion.copy(claw.quaternion);
    }
    // lava dripping off the tip
    mk(lift, cyl(0.05, 0.03, 1.4, 6), lava, foot.x, foot.y + 0.1, foot.z, 0, 0, 0);
    sway(root, 'y', 0.03, 0.9, ph);
  };
  const D = Math.PI / 180;
  leg(-42 * D, 1.9, 0.95, 0.0); leg(42 * D, 1.9, 0.95, 1.6);
  leg(-140 * D, 1.9, 1.0, 3.1); leg(140 * D, 1.9, 1.0, 4.7);

  // ── chassis ──
  mk(rig, rbox(4.6, 1.5, 5.0, 0.4), dark, 0, 3.7, 0.1);
  mk(rig, rbox(3.4, 0.7, 3.8, 0.25), black, 0, 2.95, 0.1);                       // underbelly
  // molten underside: glowing plate + two lava streams falling to the floor
  mk(rig, rbox(2.6, 0.12, 2.8, 0.05), lava, 0, 2.55, 0.1);
  for (const s of [-1, 1]) {
    mk(rig, cyl(0.2, 0.28, 2.4, 10), lava, s * 0.7, 1.35, -0.2);
    mk(rig, cyl(0.36, 0.5, 2.4, 10), halo(0xff7a1a, 0.22, true), s * 0.7, 1.35, -0.2);
    mk(rig, new THREE.CircleGeometry(1.1, 22), halo(0xff8a2a, 0.5, true), s * 0.7, 0.1, -0.2, -Math.PI / 2, 0, 0);
  }
  // upper deck: a wide steel ring with a glowing inner lip, plus basalt shell plates
  mk(rig, torus(3.7, 0.5, 52, 12), steel, 0, 4.55, 0.1, Math.PI / 2, 0, 0);
  mk(rig, torus(3.55, 0.09, 52, 8), lava, 0, 4.85, 0.1, Math.PI / 2, 0, 0);
  mk(rig, torus(3.2, 0.05, 52, 8), lavaHot, 0, 4.55, 0.1, Math.PI / 2, 0, 0);
  mk(rig, rbox(4.4, 0.5, 4.6, 0.25), basalt, 0, 4.15, 0.1);
  for (let i = 0; i < 12; i++) { // riveted plates around the ring
    const a = (i / 12) * Math.PI * 2;
    mk(rig, rbox(1.3, 0.32, 0.55, 0.1), plate, Math.cos(a) * 3.7, 4.78, 0.1 + Math.sin(a) * 3.7, 0, -a + Math.PI / 2, 0);
  }
  // flank armour + blue status lamps
  for (const s of [-1, 1]) {
    mk(rig, rbox(0.6, 1.3, 3.4, 0.16), plate, s * 2.45, 3.8, 0.1, 0, 0, s * -0.12);
    mk(rig, new THREE.BoxGeometry(0.05, 1.0, 0.06), lava, s * 2.78, 3.8, -1.0, 0, 0, s * -0.12);
    mk(rig, new THREE.BoxGeometry(0.05, 1.0, 0.06), lava, s * 2.78, 3.8, 1.0, 0, 0, s * -0.12);
  }
  mk(rig, new THREE.BoxGeometry(0.12, 0.34, 0.12), blue, -2.2, 4.1, -1.8);

  // ── the magma core: ring-housed molten sphere on the chest ──
  const coreRig = grp(rig, 0, 3.75, -2.55);
  mk(coreRig, rbox(3.3, 3.3, 0.6, 0.3), black, 0, 0, 0.5);
  mk(coreRig, cyl(1.75, 1.85, 0.7, 36), steel, 0, 0, 0.1, Math.PI / 2, 0, 0);
  const ringOuter = mk(coreRig, torus(1.7, 0.16, 48, 10), plate, 0, 0, -0.2);
  const ringMid = mk(coreRig, torus(1.45, 0.07, 48, 8), lavaHot, 0, 0, -0.3);
  const ringInner = mk(coreRig, torus(1.2, 0.1, 48, 8), steel, 0, 0, -0.35);
  spin(ringOuter, 'z', 0.18); spin(ringMid, 'z', -0.5); spin(ringInner, 'z', 0.9);
  for (let i = 0; i < 12; i++) { // ring segments with glowing slits
    const a = (i / 12) * Math.PI * 2;
    mk(coreRig, rbox(0.34, 0.5, 0.3, 0.06), i % 2 ? dark : plate, Math.cos(a) * 1.72, Math.sin(a) * 1.72, -0.15, 0, 0, a);
    mk(coreRig, new THREE.BoxGeometry(0.05, 0.28, 0.05), lavaHot, Math.cos(a) * 1.72, Math.sin(a) * 1.72, -0.34, 0, 0, a);
  }
  const orb = mk(coreRig, sph(1.12, 28), lava, 0, 0, -0.45);
  const orbHot = mk(coreRig, sph(0.8, 24), lavaHot, 0, 0, -0.5);
  const orbCore = mk(coreRig, sph(0.42, 18), lavaCore, 0, 0, -0.55);
  const orbHalo = mk(coreRig, sph(1.7, 20), halo(0xff7a1a, 0.26, true), 0, 0, -0.45);
  const orbHalo2 = mk(coreRig, sph(2.3, 20), halo(0xffa94d, 0.12, true), 0, 0, -0.45);
  pulse(orbHot, 0.1); pulse(orbCore, 0.18); pulse(orbHalo, 0.08); pulse(orbHalo2, 0.12);
  void orb;
  // muzzle lip: the cannon's barrel-bell in front of the sphere, glowing from inside
  mk(coreRig, torus(1.28, 0.2, 40, 10), steel, 0, 0, -1.0);
  mk(coreRig, torus(1.12, 0.06, 40, 8), lavaHot, 0, 0, -1.12);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    spike(coreRig, V(Math.cos(a) * 1.3, Math.sin(a) * 1.3, -1.0), V(Math.cos(a) * 1.5, Math.sin(a) * 1.5, -1.9), 0.13, plate, 4);
  }
  // the great arch framing the core (the curved visor over the front)
  mk(rig, torus(3.2, 0.55, 40, 12, Math.PI), steel, 0, 3.75, -2.3);
  mk(rig, torus(3.2, 0.1, 40, 8, Math.PI), lava, 0, 3.75, -2.78);
  mk(rig, torus(2.75, 0.2, 40, 10, Math.PI), plate, 0, 3.75, -2.3);

  // ── towers rising from the deck ──
  mk(rig, rbox(1.5, 2.6, 1.5, 0.2), basalt, 0, 6.1, 0.3);
  mk(rig, rbox(1.1, 0.3, 1.1, 0.1), steel, 0, 7.55, 0.3);
  const vent = mk(rig, cyl(0.38, 0.38, 0.12, 14), lava, 0, 7.72, 0.3);
  const ventHalo = mk(rig, sph(0.6, 14), halo(0xff7a1a, 0.2, true), 0, 7.85, 0.3);
  pulse(vent, 0.14); pulse(ventHalo, 0.12);
  for (const s of [-1, 1]) {
    mk(rig, rbox(0.95, 1.8, 0.95, 0.16), basalt, s * 1.55, 5.65, 0.7);
    mk(rig, new THREE.BoxGeometry(0.06, 1.3, 0.06), lava, s * 1.55, 5.65, 0.2);
    mk(rig, cone(0.32, 0.9, 5), plate, s * 1.55, 6.9, 0.7);
    mk(rig, new THREE.BoxGeometry(0.05, 1.7, 0.05), lavaHot, s * 0.38, 6.1, -0.46);
  }
  mk(rig, cyl(0.04, 0.04, 1.8, 6), steel, 0.6, 8.2, 0.9);
  mk(rig, sph(0.1, 8), glow(0xff3b2f, true), 0.6, 9.1, 0.9);
  // lava seams running over the shell
  for (let i = 0; i < 5; i++) mk(rig, new THREE.BoxGeometry(0.1, 0.05, 1.6 + (i % 2) * 0.8), lava, (i - 2) * 0.8, 4.43, -1.2 + (i % 3) * 0.5);

  // ── rear reactor disc (matches the back view) ──
  const back = grp(rig, 0, 3.8, 2.75);
  mk(back, rbox(2.4, 2.4, 0.4, 0.2), black, 0, 0, 0);
  const rear = mk(back, torus(0.82, 0.07, 32, 8), lava, 0, 0, 0.25);
  const rear2 = mk(back, torus(0.5, 0.05, 28, 8), lavaHot, 0, 0, 0.27);
  spin(rear, 'z', 0.6); spin(rear2, 'z', -1.1);
  const rearCore = mk(back, sph(0.22, 12), lavaCore, 0, 0, 0.3);
  pulse(rearCore, 0.16);
  for (let i = 0; i < 6; i++) spike(back, V(Math.cos(i * 1.047) * 1.0, Math.sin(i * 1.047) * 1.0, 0.2), V(Math.cos(i * 1.047) * 1.2, Math.sin(i * 1.047) * 1.2, 0.9), 0.1, plate, 4);

  // ── molten debris and embers orbiting the legs ──
  for (let i = 0; i < 9; i++) {
    const r = mk(rig, new THREE.DodecahedronGeometry(0.3 + (i % 3) * 0.12, 0), i % 2 ? dark : plate);
    orbit(r, 5.8 + (i % 3) * 0.7, 1.2 + (i % 4) * 1.1, i * 0.7, 0.35 + i * 0.03, 0.3);
  }
  for (let i = 0; i < 14; i++) {
    const e = mk(rig, sph(0.14 + (i % 3) * 0.05, 8), i % 2 ? lavaHot : lava);
    orbit(e, 4.8 + (i % 4) * 0.8, 0.8 + (i % 6) * 1.5, i * 0.45, 0.55 + i * 0.03, 0.35);
  }
  // heat rings on the floor
  spin(mk(rig, torus(6.2, 0.07, 64, 6), lava, 0, 0.12, 0, Math.PI / 2, 0, 0), 'z', 0.2);
  spin(mk(rig, torus(4.6, 0.04, 56, 6), lavaHot, 0, 0.12, 0, Math.PI / 2, 0, 0), 'z', -0.35);
  return k.refs;
}

// ───────────────────────── STORM CORE REGNA (storm array core chamber) ─────────────────────────
// Floating storm fortress: a boiling thundercloud mass ringed by steel decks, a glowing eye-core on the front,
// a funnel of wind hanging beneath it and eight lance-shaped pods dangling around the rim.
function buildStorm(rig: THREE.Group): BossRefs {
  const k = createKit('storm', rig, 0xe0d4ff);
  const { armor, solid, glow, halo, rbox, cyl, sph, cone, torus, mk, grp, V, spin, orbit, pulse, sway } = k;
  const texHull = panelTexture('#566480', '#6fb4ff', 5);
  const texPlate = panelTexture('#7a869c', '#cfe2ff', 4);
  const texDark = panelTexture('#3a4560', '#4a78b8', 5);
  const hull = armor(0x6a768c, texHull, 0.45, 0.5);
  const plate = armor(0x9aa6bc, texPlate, 0.5, 0.45);
  const dark = armor(0x3a4458, texDark, 0.5, 0.5);
  const steel = solid(0x9aa8c0, 0.85, 0.28);
  const black = solid(0x04060c, 0.4, 0.6);
  const blue = glow(0x38bdf8, true);
  const blueHot = glow(0x9bd8ff, true);
  const white = glow(0xf0f9ff);
  const cloudMats = [
    new THREE.MeshStandardMaterial({ color: 0x8a92a8, roughness: 1, metalness: 0, emissive: 0x2a3456, emissiveIntensity: 0.6, flatShading: true }),
    new THREE.MeshStandardMaterial({ color: 0x4e576e, roughness: 1, metalness: 0, emissive: 0x182040, emissiveIntensity: 0.6, flatShading: true }),
    new THREE.MeshStandardMaterial({ color: 0xc2c9de, roughness: 1, metalness: 0, emissive: 0x3a4670, emissiveIntensity: 0.5, flatShading: true }),
  ];
  const orient = (o: THREE.Object3D, dir: THREE.Vector3) => o.quaternion.setFromUnitVectors(V(0, 1, 0), dir.clone().normalize());
  const spike = (parent: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3, r: number, mat: THREE.Material, seg = 5) => {
    const dir = new THREE.Vector3().subVectors(b, a);
    const m = mk(parent, cone(r, dir.length(), seg), mat);
    m.position.copy(a).addScaledVector(dir, 0.5);
    orient(m, dir);
    return m;
  };
  /** Glowing zig-zag lightning tube from a to b. */
  const bolt = (parent: THREE.Object3D, mat: THREE.Material, a: THREE.Vector3, b: THREE.Vector3, jag: number, r = 0.06, seed = 0) => {
    const n = 8;
    const d = b.clone().sub(a);
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= n; i++) {
      const f = i / n, env = Math.sin(Math.PI * f) * jag;
      pts.push(a.clone().addScaledVector(d, f).add(V((((i * 7 + seed) % 5) - 2) * 0.5 * env, (((i * 3 + seed) % 4) - 1.5) * 0.3 * env, (((i * 5 + seed) % 5) - 2) * 0.5 * env)));
    }
    return mk(parent, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.2), 24, r, 5, false), mat);
  };

  // ── thundercloud mass (a fat cluster of lumpy cloud that slowly boils) ──
  const clouds = grp(rig, 0, 4.1, 0);
  for (let i = 0; i < 34; i++) {
    const a = i * 2.399, ph = ((i * 37) % 17) / 17;
    const rr = 1.3 + ((i * 13) % 7) * 0.22;
    const dist = (i < 6 ? 0.4 : 1.6 + (i % 5) * 0.5) * (1 + ph * 0.2);
    const lump = new THREE.Group();
    lump.position.set(Math.cos(a) * dist, -0.6 + ph * 2.4 + (i % 3) * 0.2, Math.sin(a) * dist * 0.95);
    const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(rr, 1), cloudMats[i % 3]);
    ball.scale.y = 0.82;
    lump.add(ball);
    clouds.add(lump);
    sway(lump, 'y', 0.12, 0.4 + (i % 4) * 0.1, i);
  }
  // inner glow lighting the cloud from within, plus crawling lightning
  const inner = mk(clouds, sph(2.6, 20), halo(0x3b9eff, 0.2, true), 0, -0.2, 0);
  pulse(inner, 0.12);
  for (let i = 0; i < 9; i++) {
    const a = i * 0.7;
    const b = bolt(clouds, i % 2 ? blueHot : blue, V(Math.cos(a) * 0.6, 0.2, Math.sin(a) * 0.6), V(Math.cos(a + 0.5) * 4.3, 0.8 + (i % 3) * 0.6 - 0.6, Math.sin(a + 0.5) * 4.3), 1.1, 0.045, i);
    sway(b, 'y', 0.2, 0.9, i);
  }

  // ── ring decks above (concentric rotating rings, spires, an antenna crown) ──
  const decks = grp(rig, 0, 0, 0);
  const deckRing = (R: number, y: number, tube: number, speed: number, bladeN: number) => {
    const g = grp(decks, 0, y, 0);
    const ring = mk(g, torus(R, tube, 56, 12), hull, 0, 0, 0, Math.PI / 2, 0, 0);
    mk(g, torus(R - tube * 0.2, tube * 0.28, 56, 8), blue, 0, tube * 0.7, 0, Math.PI / 2, 0, 0);
    mk(g, torus(R + tube * 0.3, tube * 0.18, 56, 8), blueHot, 0, -tube * 0.4, 0, Math.PI / 2, 0, 0);
    for (let i = 0; i < bladeN; i++) {
      const a = (i / bladeN) * Math.PI * 2;
      mk(g, rbox(R * 0.3, tube * 0.9, tube * 1.6, 0.1), i % 2 ? plate : dark, Math.cos(a) * R, tube * 0.55, Math.sin(a) * R, 0, -a + Math.PI / 2, 0);
    }
    spin(g, 'y', speed);
    return { g, ring };
  };
  deckRing(5.4, 6.0, 0.42, 0.06, 16);
  deckRing(4.1, 6.9, 0.36, -0.1, 12);
  const crown = deckRing(2.6, 7.7, 0.3, 0.16, 8);
  for (let i = 0; i < 4; i++) { // lightning-rod spires on the second deck
    const a = (i / 4) * Math.PI * 2 + 0.4;
    spike(decks, V(Math.cos(a) * 4.1, 7.1, Math.sin(a) * 4.1), V(Math.cos(a) * 4.1, 10.2, Math.sin(a) * 4.1), 0.2, plate, 5);
    mk(decks, sph(0.14, 8), blueHot, Math.cos(a) * 4.1, 10.2, Math.sin(a) * 4.1);
  }
  spike(crown.g, V(0, 0.2, 0), V(0, 2.6, 0), 0.34, steel, 6);
  const crownOrb = mk(crown.g, sph(0.3, 12), white, 0, 2.7, 0);
  const crownHalo = mk(crown.g, sph(0.9, 12), halo(0x7cc4ff, 0.26, true), 0, 2.7, 0);
  pulse(crownOrb, 0.18); pulse(crownHalo, 0.12);
  // overhead core glow: rings seen from above (concentric ring face on the top deck)
  mk(decks, new THREE.CircleGeometry(2.3, 40), halo(0x38bdf8, 0.28, true), 0, 7.75, 0, -Math.PI / 2, 0, 0);

  // ── the eye: concentric rings and a molten-blue orb on the front of the cloud ──
  const eye = grp(rig, 0, 3.9, -4.7);
  mk(eye, rbox(2.6, 2.6, 0.5, 0.25), black, 0, 0, 0.35);
  const eRing1 = mk(eye, torus(1.15, 0.12, 40, 10), steel, 0, 0, -0.1);
  const eRing2 = mk(eye, torus(0.88, 0.06, 40, 8), blue, 0, 0, -0.18);
  const eRing3 = mk(eye, torus(0.62, 0.08, 36, 8), plate, 0, 0, -0.22);
  spin(eRing1, 'z', 0.25); spin(eRing2, 'z', -0.7); spin(eRing3, 'z', 1.2);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    mk(eye, rbox(0.2, 0.34, 0.2, 0.05), i % 2 ? dark : plate, Math.cos(a) * 1.16, Math.sin(a) * 1.16, -0.1, 0, 0, a);
    mk(eye, new THREE.BoxGeometry(0.04, 0.2, 0.04), blueHot, Math.cos(a) * 1.16, Math.sin(a) * 1.16, -0.22, 0, 0, a);
  }
  const eyeOrb = mk(eye, sph(0.5, 20), blueHot, 0, 0, -0.3);
  const eyeCore = mk(eye, sph(0.25, 14), white, 0, 0, -0.38);
  const eyeHalo = mk(eye, sph(1.3, 18), halo(0x38bdf8, 0.26, true), 0, 0, -0.3);
  const eyeHalo2 = mk(eye, sph(1.9, 18), halo(0x7cc4ff, 0.12, true), 0, 0, -0.3);
  pulse(eyeOrb, 0.1); pulse(eyeCore, 0.18); pulse(eyeHalo, 0.1); pulse(eyeHalo2, 0.12);

  // ── funnel beneath: stacked wind rings that spin at different rates, with a lightning column down the middle ──
  const funnel = grp(rig, 0, 0, 0.2);
  for (let i = 0; i < 9; i++) {
    const y = 3.0 - i * 0.32, R = 0.35 + (i < 4 ? 1.6 - i * 0.36 : 0.35 + (8 - i) * 0.08) + (i === 0 ? 0.6 : 0);
    const r = mk(funnel, torus(R, 0.05 + (i % 2) * 0.03, 40, 6), i % 2 ? blue : blueHot, 0, y, 0, Math.PI / 2, 0, 0);
    spin(r, 'z', (i % 2 ? -1 : 1) * (0.8 + i * 0.2));
  }
  const wind = new THREE.MeshBasicMaterial({ color: 0x9bd0ff, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  mk(funnel, new THREE.CylinderGeometry(2.0, 0.25, 3.0, 24, 1, true), wind, 0, 1.55, 0);
  bolt(funnel, blueHot, V(0, 3.0, 0), V(0, 0.1, 0), 0.5, 0.07, 2);
  const ground = mk(rig, new THREE.CircleGeometry(1.4, 24), halo(0x7cc4ff, 0.45, true), 0, 0.1, 0.2, -Math.PI / 2, 0, 0);
  pulse(ground, 0.12);

  // ── eight lance pods hanging around the rim; they lift with the attack cues ──
  const pod = (a: number, R: number, y: number, len: number, ph: number) => {
    const root = grp(rig, Math.sin(a) * R, y, -Math.cos(a) * R, 0, -a, 0);
    const lift = grp(root);
    k.refs.lifts.push({ obj: lift, idx: k.refs.lifts.length, front: Math.abs(a) < Math.PI / 2, side: Math.sign(a) || 1 });
    // pylon from the deck down to the pod
    mk(lift, rbox(0.7, 1.4, 0.7, 0.15), dark, 0, 1.0, 0);
    mk(lift, sph(0.5, 12), hull, 0, 0.25, 0);
    mk(lift, torus(0.42, 0.05, 20, 8), blue, 0, 0.25, 0, Math.PI / 2, 0, 0);
    // lance body: hexagonal taper pointing straight down, with a glowing spine and armour fins
    const lance = mk(lift, new THREE.CylinderGeometry(1.0, 0.08, len, 6), plate, 0, -len / 2 + 0.2, 0);
    mk(lift, new THREE.BoxGeometry(0.12, len * 0.86, 0.12), blueHot, 0, -len / 2 + 0.1, -0.8);
    for (const sx of [-1, 1]) mk(lift, rbox(0.2, len * 0.6, 0.9, 0.06), hull, sx * 0.85, -len * 0.3, 0.05);
    spike(lift, V(0, -len + 0.25, 0), V(0, -len - 0.5, 0), 0.07, blueHot, 5);
    void lance;
    sway(root, 'z', 0.04, 0.8, ph);
  };
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.2;
    pod(a, 4.5 + (i % 2) * 0.5, 4.7, 3.4 + (i % 2) * 1.3, i * 0.8);
  }

  // ── satellite discs and debris orbiting the fortress ──
  for (let i = 0; i < 5; i++) {
    const g = new THREE.Group();
    mk(g, cyl(1.0, 1.1, 0.3, 24), hull);
    mk(g, torus(0.82, 0.05, 28, 8), blue, 0, 0.17, 0, Math.PI / 2, 0, 0);
    mk(g, sph(0.22, 10), blueHot, 0, 0.3, 0);
    rig.add(g);
    orbit(g, 7.6 + (i % 2) * 1.0, 3.0 + (i % 3) * 1.4, i * 1.26, 0.2 + i * 0.02, 0.5);
  }
  for (let i = 0; i < 12; i++) {
    const r = mk(rig, new THREE.DodecahedronGeometry(0.2 + (i % 3) * 0.12, 0), i % 2 ? dark : plate);
    orbit(r, 6.2 + (i % 4) * 0.8, 0.8 + (i % 6) * 1.4, i * 0.55, 0.45 + i * 0.03, 0.35);
  }
  // rain-like sparks falling around
  for (let i = 0; i < 10; i++) {
    const s = mk(rig, sph(0.1, 6), i % 2 ? blueHot : blue);
    orbit(s, 4.0 + (i % 4) * 0.9, 1.0 + (i % 5) * 1.6, i * 0.63, 0.7 + i * 0.04, 0.5);
  }
  // charge rings on the floor
  spin(mk(rig, torus(6.6, 0.07, 64, 6), blue, 0, 0.12, 0, Math.PI / 2, 0, 0), 'z', 0.2);
  spin(mk(rig, torus(4.8, 0.04, 56, 6), blueHot, 0, 0.12, 0, Math.PI / 2, 0, 0), 'z', -0.35);
  return k.refs;
}

// ───────────────────────── NEON MEDUSA (neon district core chamber) ─────────────────────────
// Floating cyber-jellyfish: a ringed armoured umbrella wearing tilted neon crown rings, a curtain of falling green
// digits around its core, a thicket of glowing light tendrils below and six blade pods hanging off the rim.
function buildNeon(rig: THREE.Group): BossRefs {
  const k = createKit('neon', rig, 0xffffff);
  const { armor, solid, glow, halo, rbox, cyl, sph, cone, torus, mk, grp, V, spin, orbit, pulse, sway, blade } = k;
  const texHull = panelTexture('#34345a', '#e879f9', 5);
  const texPlate = panelTexture('#6a68a0', '#67e8f9', 4);
  const texDark = panelTexture('#1e1e3a', '#a78bfa', 5);
  const hull = armor(0x5a58a0, texHull, 0.5, 0.42);
  const plate = armor(0x8a88c0, texPlate, 0.5, 0.4);
  const dark = armor(0x2a2a4e, texDark, 0.55, 0.45);
  const steel = solid(0xa8a6d0, 0.85, 0.26);
  const black = solid(0x05040c, 0.4, 0.6);
  const magenta = glow(0xe879f9, true);
  const cyan = glow(0x67e8f9, true);
  const violet = glow(0xa78bfa, true);
  const white = glow(0xf5f3ff);
  const holo = (color: number, op: number) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const holoViolet = holo(0xa78bfa, 0.34);
  const holoCyan = holo(0x67e8f9, 0.3);
  const holoMagenta = holo(0xe879f9, 0.3);
  const orient = (o: THREE.Object3D, dir: THREE.Vector3) => o.quaternion.setFromUnitVectors(V(0, 1, 0), dir.clone().normalize());
  const scrollTex: THREE.Texture[] = [];
  const digits = (cols: number, rows: number, seed: number, repeatX = 1) => {
    const t = digitTexture(cols, rows, seed);
    t.repeat.x = repeatX;
    if (!scrollTex.includes(t)) scrollTex.push(t);
    return digitMaterial(t, 0.9);
  };

  // ── umbrella: stacked armoured discs, a flared bell underneath and a glowing mouth ──
  const bell = grp(rig, 0, 0, 0);
  mk(bell, cyl(2.7, 3.1, 0.55, 40), hull, 0, 5.5, 0);
  mk(bell, cyl(2.1, 2.6, 0.5, 40), dark, 0, 6.0, 0);
  mk(bell, cyl(1.4, 1.9, 0.5, 36), plate, 0, 6.45, 0);
  for (const [y, r, c] of [[5.25, 3.1, magenta], [5.78, 2.65, cyan], [6.25, 2.0, violet], [6.72, 1.45, magenta]] as const) {
    mk(bell, torus(r, 0.07, 56, 8), c, 0, y, 0, Math.PI / 2, 0, 0);
  }
  const bellGeo = new THREE.LatheGeometry([V(3.1, 5.2, 0), V(3.2, 4.9, 0), V(2.9, 4.5, 0), V(2.2, 4.0, 0), V(1.4, 3.5, 0), V(0.9, 3.15, 0), V(0.0, 3.05, 0)].map((v) => new THREE.Vector2(v.x, v.y)), 32);
  mk(bell, bellGeo, dark, 0, 0, 0).material = new THREE.MeshPhysicalMaterial({ color: 0x4a4880, metalness: 0.4, roughness: 0.4, clearcoat: 0.6, side: THREE.DoubleSide, emissive: 0x1a1640, emissiveIntensity: 0.6 });
  for (let i = 0; i < 16; i++) { // armour fins and neon ribs running down the bell
    const a = (i / 16) * Math.PI * 2;
    mk(bell, rbox(0.3, 1.8, 0.16, 0.05), i % 2 ? plate : hull, Math.cos(a) * 2.85, 4.5, Math.sin(a) * 2.85, 0.5 * (i % 2 ? 1 : 0.6), -a + Math.PI / 2, 0).rotateX(0);
    mk(bell, new THREE.BoxGeometry(0.05, 1.6, 0.05), i % 3 === 0 ? cyan : i % 3 === 1 ? magenta : violet, Math.cos(a) * 3.0, 4.5, Math.sin(a) * 3.0, 0, -a + Math.PI / 2, 0);
  }
  // mouth + core
  const mouth = mk(bell, sph(0.75, 20), cyan, 0, 3.1, 0);
  const mouthCore = mk(bell, sph(0.4, 16), white, 0, 3.1, 0);
  const mouthHalo = mk(bell, sph(1.7, 18), halo(0x67e8f9, 0.28, true), 0, 3.0, 0);
  const mouthHalo2 = mk(bell, sph(2.6, 18), halo(0xe879f9, 0.12, true), 0, 3.4, 0);
  pulse(mouth, 0.1); pulse(mouthCore, 0.18); pulse(mouthHalo, 0.1); pulse(mouthHalo2, 0.12);
  // front visor: a wide eye-slit looking at the target
  mk(rig, rbox(2.6, 0.7, 0.5, 0.2), black, 0, 5.1, -3.0, -0.1, 0, 0);
  const eyeBar = mk(rig, new THREE.BoxGeometry(2.2, 0.16, 0.1), cyan, 0, 5.15, -3.28, -0.1, 0, 0);
  void eyeBar;
  for (const s of [-1, 1]) mk(rig, new THREE.BoxGeometry(0.5, 0.12, 0.1), magenta, s * 0.9, 4.9, -3.26, -0.1, 0, s * 0.3);

  // ── crown rings: big tilted bands of dark armour with translucent neon ribbons ──
  const crownRing = (R: number, y: number, tiltX: number, tiltZ: number, speed: number, arc: number) => {
    const tilt = grp(rig, 0, y, 0, tiltX, 0, tiltZ);
    const spinner = grp(tilt);
    mk(spinner, torus(R, 0.48, 64, 12, arc), hull, 0, 0, 0, Math.PI / 2, 0, 0);
    mk(spinner, torus(R, 0.1, 64, 8, arc), cyan, 0, 0.36, 0, Math.PI / 2, 0, 0);
    mk(spinner, torus(R, 0.08, 64, 8, arc), magenta, 0, -0.36, 0, Math.PI / 2, 0, 0);
    const ribbon = mk(spinner, new THREE.RingGeometry(R - 0.5, R + 1.1, 72, 1, 0, arc), holoViolet, 0, -0.1, 0, Math.PI / 2, 0, 0);
    void ribbon;
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * arc;
      mk(spinner, rbox(R * 0.3, 0.35, 0.8, 0.1), i % 2 ? plate : dark, Math.cos(a) * R, 0.2, Math.sin(a) * R, 0, -a + Math.PI / 2, 0);
    }
    spin(spinner, 'y', speed);
    return spinner;
  };
  crownRing(6.6, 6.2, 0.38, -0.12, 0.12, Math.PI * 1.55);
  crownRing(5.0, 7.0, -0.3, 0.26, -0.2, Math.PI * 1.7);
  crownRing(3.3, 7.7, 0.18, 0.1, 0.34, Math.PI * 1.9);
  const crownOrb = mk(rig, sph(0.4, 14), white, 0, 7.4, 0);
  const crownHalo = mk(rig, sph(1.2, 14), halo(0xe879f9, 0.26, true), 0, 7.4, 0);
  pulse(crownOrb, 0.18); pulse(crownHalo, 0.12);
  spike(rig, V(0, 7.4, 0), V(0, 10.0, 0), 0.22, steel, 6);

  function spike(parent: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3, r: number, mat: THREE.Material, seg = 5) {
    const dir = new THREE.Vector3().subVectors(b, a);
    const m = mk(parent, cone(r, dir.length(), seg), mat);
    m.position.copy(a).addScaledVector(dir, 0.5);
    orient(m, dir);
    return m;
  }

  // ── light tendrils: armoured cores wrapped in translucent neon sheaths, swaying below the bell ──
  const tendril = (a: number, r0: number, reach: number, curl: number, mat: THREE.Material, ph: number) => {
    const g = grp(rig, 0, 0, 0);
    const pts = [V(Math.cos(a) * r0, 3.4, Math.sin(a) * r0), V(Math.cos(a) * (r0 + reach * 0.35), 2.4, Math.sin(a) * (r0 + reach * 0.35)),
      V(Math.cos(a + curl) * (r0 + reach * 0.8), 1.4, Math.sin(a + curl) * (r0 + reach * 0.8)), V(Math.cos(a + curl * 1.6) * (r0 + reach), 0.5, Math.sin(a + curl * 1.6) * (r0 + reach))];
    const curve = new THREE.CatmullRomCurve3(pts);
    mk(g, new THREE.TubeGeometry(curve, 28, 0.22, 6, false), dark);
    mk(g, new THREE.TubeGeometry(curve, 28, 0.5, 8, false), mat);
    mk(g, sph(0.22, 8), white, pts[3].x, pts[3].y, pts[3].z);
    sway(g, 'y', 0.12, 0.7 + (ph % 3) * 0.15, ph);
    return g;
  };
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    tendril(a, 0.6 + (i % 2) * 0.5, 2.4 + (i % 3) * 0.7, 0.5 + (i % 4) * 0.1, i % 3 === 0 ? holoCyan : i % 3 === 1 ? holoMagenta : holoViolet, i * 0.9);
  }
  // data curtain: an open cylinder of falling green digits around the tendrils
  const curtain = mk(rig, new THREE.CylinderGeometry(2.5, 2.9, 4.2, 36, 1, true), digits(10, 18, 4, 3), 0, 2.4, 0);
  void curtain;
  // second, wider curtain
  mk(rig, new THREE.CylinderGeometry(4.0, 4.4, 4.6, 40, 1, true), digits(12, 20, 8, 4), 0, 2.3, 0);

  // ── six blade pods hanging off the rim (they swing with the attack cues) ──
  const pod = (a: number, R: number, y: number, ph: number) => {
    const root = grp(rig, Math.sin(a) * R, y, -Math.cos(a) * R, 0, -a, 0);
    const lift = grp(root);
    k.refs.lifts.push({ obj: lift, idx: k.refs.lifts.length, front: Math.abs(a) < Math.PI / 2, side: Math.sign(a) || 1 });
    const dir = V(0, -0.85, -1).normalize();
    mk(lift, sph(0.55, 14), hull, 0, 0, 0);
    mk(lift, torus(0.46, 0.05, 20, 8), magenta, 0, 0, 0, Math.PI / 2, 0, 0);
    // fuselage: tapered blade-like pod ending in a long point
    const body = mk(lift, blade(4.6, 1.9, 0.9), plate, 0, 0, 0);
    orient(body, dir);
    const glowEdge = mk(lift, blade(4.4, 0.5, 1.0), cyan, 0, 0, 0);
    orient(glowEdge, dir);
    const sheath = mk(lift, blade(3.4, 2.6, 0.2), holoViolet, 0, 0, 0.1);
    orient(sheath, dir);
    // ring emblem on the side of the pod
    const side = dir.clone().multiplyScalar(1.6);
    for (const sx of [-1, 1]) {
      mk(lift, torus(0.55, 0.07, 24, 8), i2(sx), side.x + sx * 0.5, side.y, side.z, 0, Math.PI / 2, 0);
      mk(lift, torus(0.34, 0.05, 20, 8), white, side.x + sx * 0.52, side.y, side.z, 0, Math.PI / 2, 0);
    }
    sway(root, 'z', 0.04, 0.8, ph);
  };
  function i2(sx: number) { return sx > 0 ? magenta : cyan; }
  for (let i = 0; i < 6; i++) pod((i / 6) * Math.PI * 2 + 0.52, 4.4, 4.6, i * 0.9);

  // ── floating holo screens, satellite ring-discs and pixel cubes ──
  for (let i = 0; i < 4; i++) {
    const g = new THREE.Group();
    mk(g, new THREE.PlaneGeometry(2.2, 1.4), digits(8, 10, 20 + i), 0, 0, 0);
    mk(g, rbox(2.4, 1.6, 0.06, 0.03), holoCyan, 0, 0, 0.03);
    mk(g, new THREE.BoxGeometry(2.4, 0.06, 0.08), i % 2 ? magenta : cyan, 0, 0.8, 0);
    mk(g, new THREE.BoxGeometry(2.4, 0.06, 0.08), i % 2 ? cyan : magenta, 0, -0.8, 0);
    rig.add(g);
    orbit(g, 8.0 + (i % 2) * 0.8, 2.6 + (i % 3) * 1.2, i * 1.57, 0.18 + i * 0.02, 0.5);
  }
  for (let i = 0; i < 4; i++) {
    const g = new THREE.Group();
    mk(g, cyl(0.9, 1.0, 0.28, 24), hull);
    mk(g, torus(0.74, 0.05, 28, 8), i % 2 ? magenta : cyan, 0, 0.16, 0, Math.PI / 2, 0, 0);
    mk(g, sph(0.2, 10), white, 0, 0.28, 0);
    rig.add(g);
    orbit(g, 7.0 + (i % 2) * 1.2, 4.2 + (i % 3) * 1.0, i * 1.57 + 0.7, 0.24 + i * 0.02, 0.5);
  }
  for (let i = 0; i < 16; i++) {
    const g = new THREE.Group();
    const s = 0.2 + (i % 3) * 0.1;
    mk(g, rbox(s * 2, s * 2, s * 2, s * 0.3), i % 2 ? dark : plate);
    mk(g, new THREE.BoxGeometry(s * 2.05, s * 0.3, s * 2.05), i % 3 === 0 ? cyan : i % 3 === 1 ? magenta : violet, 0, s * 0.5, 0);
    rig.add(g);
    orbit(g, 5.8 + (i % 4) * 0.7, 0.8 + (i % 6) * 1.3, i * 0.4, 0.45 + i * 0.03, 0.4);
  }
  // neon charge rings on the floor
  spin(mk(rig, torus(6.6, 0.07, 64, 6), magenta, 0, 0.12, 0, Math.PI / 2, 0, 0), 'z', 0.2);
  spin(mk(rig, torus(4.8, 0.04, 56, 6), cyan, 0, 0.12, 0, Math.PI / 2, 0, 0), 'z', -0.35);
  rig.userData.scrollTex = scrollTex;
  return k.refs;
}

export function buildBossModel(kind: BossKind, group: THREE.Group): BossStats {
  const rig = new THREE.Group();
  rig.scale.setScalar(BOSS_SCALE);
  group.add(rig);
  const refs =
    kind === 'golgotha' ? buildGolgotha(rig)
    : kind === 'golem' ? buildGolem(rig)
    : kind === 'kraken' ? buildKraken(rig)
    : kind === 'warden' ? buildWarden(rig)
    : kind === 'frost' ? buildFrost(rig)
    : kind === 'myco' ? buildMyco(rig)
    : kind === 'magma' ? buildMagma(rig)
    : kind === 'storm' ? buildStorm(rig)
    : kind === 'neon' ? buildNeon(rig)
    : buildTitan(rig);
  group.userData.bossRefs = refs;
  return BOSS_STATS[kind];
}

const dampTo = (cur: number, target: number, rate: number, dt: number) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
const _white = new THREE.Color(0xffffff);

/**
 * Advances the moving parts of a boss model. `phase` is 1..3 (enrage tiers).
 * Reads the telegraph cue (`group.userData.bossCue = { name, k, side }`) written by the boss AI and poses
 * arms / tentacles / guns / wings into a readable wind-up; `userData.bossHitPart` (set on release) snaps
 * them through the strike. Accent lights flicker white just before an attack lands.
 */
export function animateBoss(group: THREE.Object3D, time: number, delta: number, phase: number): void {
  const refs = group.userData.bossRefs as BossRefs | undefined;
  if (!refs) return;
  const enr = (phase - 1) / 2;
  const rate = 1 + enr * 0.9;
  const ud = group.userData;
  const cue = (ud.bossCue as { name: string; k: number; side?: number } | undefined) ?? { name: 'idle', k: 0 };
  const k = Math.max(0, Math.min(1, cue.k));
  const side = cue.side ?? 1;
  const P = refs.pose;
  if (ud.bossHitPart > 0) {
    P.hit = Math.max(P.hit, ud.bossHitPart);
    ud.bossHitPart = 0;
  }
  P.hit = Math.max(0, P.hit - delta * 2.4);
  const hit = P.hit * P.hit;

  // ── pose targets per cue ──
  let ax = 0, az = 0, lift = 0, gun = 0, wing = 0, armBoost = 0;
  switch (cue.name) {
    case 'raise': ax = 2.55 * k; az = 0.35 * k; lift = 1.0 * k; gun = 0.35 * k; wing = 0.4 * k; break;
    case 'crouch': ax = -0.55 * k; az = 0.45 * k; lift = -0.2 * k; wing = -0.3 * k; break;
    case 'charge': ax = -0.75; az = 0.3; lift = -0.15; wing = -0.4; break;
    case 'cast': ax = 1.35 * k; az = 0.6 * k; lift = 0.55 * k; gun = 0.25 * k; wing = 0.45 * k; break;
    case 'spin': ax = 0.25 * k; az = 1.35 * k; lift = 0.7 * k; wing = 0.55 * k; break;
    case 'lob': ax = 1.9 * k; az = 0.2 * k; lift = 0.75 * k; gun = 0.85 * k; wing = 0.3 * k; break;
    case 'aim': ax = 1.5 * k; az = 0.05 * k; lift = 0.35 * k; gun = 0.06 * k; wing = 0.2 * k; break;
    case 'sweep': ax = 0.9 * k; az = 0.6 * k; lift = 0.85 * k; wing = 0.3 * k; armBoost = 0.8 * k; break;
    case 'channel': ax = 1.0 * k; az = 0.95 * k; lift = 0.8 * k; gun = 0.3 * k; wing = 0.5 * k; break;
    case 'recover': ax = -0.25; az = 0.15; lift = -0.35; wing = -0.2; break;
    case 'roar': ax = 2.0 * k; az = 1.0 * k; lift = 1.1 * k; gun = 0.5 * k; wing = 0.7 * k; break;
  }
  const r = 9;
  P.ax = dampTo(P.ax, ax, r, delta);
  P.az = dampTo(P.az, az, r, delta);
  P.lift = dampTo(P.lift, lift, r * 0.8, delta);
  P.gun = dampTo(P.gun, gun, r * 0.7, delta);
  P.wing = dampTo(P.wing, wing, r * 0.6, delta);
  P.ay = dampTo(P.ay, armBoost, r, delta);
  const smash = cue.name === 'raise' || cue.name === 'cast' || cue.name === 'lob' || cue.name === 'roar' || cue.name === 'idle';
  const tremble = (cue.name === 'crouch' || cue.name === 'roar' || (k > 0.75 && cue.name !== 'idle')) ? Math.sin(time * 52) * 0.03 : 0;

  for (const a of refs.arms) {
    const lead = cue.name === 'sweep' ? (a.side === side ? 1 : 0.35) : 1;
    let x = P.ax * lead + tremble;
    let z = a.side * P.az * lead + a.side * P.ay * (a.side === side ? 1 : 0);
    let y = 0;
    if (hit > 0) {
      if (cue.name === 'sweep') {
        // the leading arm whips across the front
        if (a.side === side) {
          y = a.side * 1.5 * hit;
          z = a.side * (1.3 * hit);
          x = 0.9;
        }
      } else if (smash) {
        x = P.ax - 2.4 * hit + 0.6 * hit; // drive the raised arms down through the strike
      } else if (cue.name === 'charge' || cue.name === 'crouch') {
        x = 1.2 * hit;
      }
    }
    a.obj.rotation.set(x, y, z);
  }
  for (const L of refs.lifts) {
    const lead = cue.name === 'sweep' ? (L.side === side ? 1.2 : 0.4) : L.front ? 1 : 0.55;
    const wave = cue.name === 'channel' ? Math.sin(time * 3 + L.idx) * 0.25 * k : 0;
    L.obj.rotation.x = P.lift * lead + wave - (smash || cue.name === 'sweep' ? hit * 1.4 * (L.front ? 1 : 0.4) : 0);
    L.obj.rotation.y = cue.name === 'sweep' && hit > 0 && L.side === side ? -L.side * 0.9 * hit : 0;
  }
  for (const g of refs.guns) g.obj.rotation.x = P.gun + (cue.name === 'aim' ? tremble * 0.3 : 0);

  for (const s of refs.spinners) s.obj.rotation[s.axis] += s.speed * rate * delta * (1 + k * 2.5);
  for (const o of refs.orbiters) {
    const a = o.a0 + time * o.speed * rate * (1 + k * 0.8);
    const rr = o.r * (1 - 0.18 * k * (cue.name === 'cast' || cue.name === 'channel' ? 1 : 0));
    o.obj.position.set(Math.cos(a) * rr, o.y + Math.sin(time * 1.3 + o.a0) * o.bob, Math.sin(a) * rr);
    o.obj.rotation.y += delta * 1.5;
    o.obj.rotation.x += delta * 0.9;
  }
  for (const w of refs.wings) {
    const flap = Math.sin(time * 1.4 * rate + w.idx * 0.45) * 0.06 * rate;
    w.obj.rotation.z = w.baseZ + w.side * (flap - enr * 0.14 + P.wing * (1 + w.idx * 0.25) - hit * 0.35);
  }
  for (const w of refs.sways) {
    w.obj.rotation[w.axis] = w.base + Math.sin(time * w.speed * rate + w.phase) * w.amp * (1 + enr * 0.6);
  }
  for (const p of refs.pulses) {
    const sc = 1 + Math.sin(time * (3 + phase * 2.2)) * p.amp * (1 + enr) + k * 0.35 + hit * 0.5;
    p.obj.scale.setScalar(sc);
  }
  refs.rig.position.y = Math.sin(time * 1.1) * 0.04;
  const scrollTex = refs.rig.userData.scrollTex as THREE.Texture[] | undefined;
  if (scrollTex) for (const t of scrollTex) t.offset.y -= delta * 0.3;
  // telegraph flash: accents flicker toward white as the wind-up completes, and flare on release
  const flash = (k > 0.55 && cue.name !== 'idle' && cue.name !== 'recover' ? (0.5 + 0.5 * Math.sin(time * 30)) * ((k - 0.55) / 0.45) * 0.7 : 0) + hit * 0.8;
  for (const a of refs.accents) {
    a.mat.color.copy(a.base).lerp(refs.enrage, Math.min(1, enr * 1.15));
    if (flash > 0) a.mat.color.lerp(_white, Math.min(1, flash));
  }
}
