/**
 * CYBER CORE - INFIGHT (近接) weapon visual effects
 *
 * 近接武器ごとに固有の斬撃・衝撃波・ヒットエフェクトを生成します。
 * BattleScene3D の spatialEffectsRef に積める形（group / particles / light / onUpdate）で返します。
 *
 * 注意: 更新ループ側で子メッシュの material.opacity が一律でフェードされるため、
 *       すべてのマテリアルは transparent: true にしてください。
 */
import * as THREE from 'three';
import type { MeleeStyle } from './meleeStyles';

export interface MeleeFxParticle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  gravity: number;
  decay: number;
}

export interface MeleeFxResult {
  group: THREE.Object3D;
  particles: MeleeFxParticle[];
  light?: THREE.PointLight;
  lifetime: number;
  direction?: THREE.Vector3;
  forwardSpeed?: number;
  expansionRate?: number;
  onUpdate?: (progress: number, delta: number) => void;
}

export interface MeleeFxContext {
  style: MeleeStyle;
  step: number;
  /** ガントレット: 4段コンボ解放済みなら 1 */
  variant: number;
  color: string;
  camera: THREE.Camera;
  scene: THREE.Scene;
  /** 攻撃の最大射程（メートル） */
  range: number;
}

const TAU = Math.PI * 2;
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/* -------------------------------------------------------------------------- */
/*  Small helpers                                                             */
/* -------------------------------------------------------------------------- */

const addMat = (color: THREE.ColorRepresentation, opacity = 1, side: THREE.Side = THREE.DoubleSide) =>
  new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side, blending: THREE.AdditiveBlending, depthWrite: false });

function scaleColor(hex: THREE.ColorRepresentation, k: number): THREE.Color {
  return new THREE.Color(hex).multiplyScalar(k);
}

interface RibbonPoint {
  p: THREE.Vector3;
  n: THREE.Vector3;
}

interface RibbonOpts {
  width: number;
  taper?: number;
  front?: number;
  back?: number;
  outer: THREE.ColorRepresentation;
  core?: THREE.ColorRepresentation;
  coreScale?: number;
  trail?: boolean;
  zOffset?: number;
  /** 経路の t=1 → t=0 の向きに振り抜く（刃先の移動方向が経路と逆の武器用） */
  reverse?: boolean;
}

/**
 * Per-vertex data of an animated ribbon: progress along the swing (0 = start of the swing, 1 = where
 * the blade ends) and which edge the vertex sits on (1 = cutting edge, 0 = trailing edge).
 * animateRibbons() rewrites the vertex colours every frame so the slash is *drawn* in the direction
 * of the swing, has a bright head, and dissolves from its tail.
 */
interface RibbonAnim {
  u: Float32Array;
  edge: Float32Array;
  /** brightness multiplier of this layer */
  gain: number;
}

/** 経路と法線から、三層（外側オーラ/白い芯/残光）のリボン状斬撃メッシュを構築 */
function buildRibbon(pts: RibbonPoint[], o: RibbonOpts): THREE.Group {
  const group = new THREE.Group();
  const segs = pts.length - 1;
  const front = o.front ?? 0.82;
  const back = o.back ?? 0.38;
  const taperPow = o.taper ?? 0.45;

  const geo = (scale: number, zOff: number) => {
    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    const u = new Float32Array((segs + 1) * 2);
    const edge = new Float32Array((segs + 1) * 2);
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const { p, n } = pts[i];
      const taper = Math.pow(Math.sin(t * Math.PI), taperPow);
      const w = o.width * scale * Math.max(0.03, taper);
      positions.push(p.x + n.x * w * front, p.y + n.y * w * front, p.z + n.z * w * front + zOff);
      uvs.push(t, 1);
      positions.push(p.x - n.x * w * back, p.y - n.y * w * back, p.z - n.z * w * back + zOff);
      uvs.push(t, 0);
      const ut = o.reverse ? 1 - t : t;
      u[i * 2] = ut;
      u[i * 2 + 1] = ut;
      edge[i * 2] = 1;
      edge[i * 2 + 1] = 0;
    }
    for (let i = 0; i < segs; i++) {
      const a = i * 2;
      const b = a + 1;
      const c = a + 2;
      const d = a + 3;
      indices.push(a, b, c, c, b, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array((segs + 1) * 2 * 3).fill(1), 3));
    g.setIndex(indices);
    return { g, u, edge };
  };

  const z0 = o.zOffset ?? 0;
  const layer = (scale: number, zOff: number, color: THREE.ColorRepresentation, opacity: number, gain: number) => {
    const { g, u, edge } = geo(scale, zOff);
    const mat = addMat(color, opacity);
    mat.vertexColors = true;
    const mesh = new THREE.Mesh(g, mat);
    mesh.userData.ribbon = { u, edge, gain } as RibbonAnim;
    group.add(mesh);
  };
  layer(1.0, z0, o.outer, 0.9, 1);
  layer(o.coreScale ?? 0.38, z0 + 0.005, o.core ?? 0xffffff, 1.0, 1.25);
  if (o.trail !== false) layer(0.82, z0 - 0.035, scaleColor(o.outer, 0.6), 0.5, 0.8);
  // start fully hidden: the first animateRibbons() call draws the head in
  animateRibbons(group, 0);
  return group;
}

const smooth01 = (a: number, b: number, x: number) => {
  const u = Math.min(1, Math.max(0, (x - a) / Math.max(1e-5, b - a)));
  return u * u * (3 - 2 * u);
};

/**
 * Drives every ribbon under `root` for effect progress p (0..1):
 *   0 .. REVEAL   the slash is drawn from the start of the swing to its end (soft leading edge)
 *   ERASE .. 1    the tail dissolves toward the head, leaving a thin bright filament last
 * The cutting edge stays brighter than the trailing edge and the head flares while it is moving.
 */
export function animateRibbons(root: THREE.Object3D, p: number, reveal = 0.3, erase = 0.38): void {
  const head = smooth01(0, reveal, p) * 1.12; // overshoot slightly so the end of the path is fully lit
  const tail = smooth01(erase, 1, p) * 1.05;
  const moving = 1 - smooth01(reveal * 0.6, reveal * 1.6, p);
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    const ra = mesh.userData?.ribbon as RibbonAnim | undefined;
    if (!ra) return;
    const col = mesh.geometry.getAttribute('color') as THREE.BufferAttribute;
    const arr = col.array as Float32Array;
    for (let i = 0; i < ra.u.length; i++) {
      const u = ra.u[i];
      // visible between the dissolving tail and the advancing head (soft on both ends)
      const lead = 1 - smooth01(head - 0.12, head, u);
      const trailing = smooth01(tail - 0.18, tail + 0.02, u);
      // brightness rises toward the head; the head itself flares while the blade is still moving
      const along = 0.35 + 0.65 * Math.pow(Math.min(1, u / Math.max(0.05, Math.min(1, head))), 1.4);
      const flare = 1 + 0.9 * moving * smooth01(head - 0.22, head - 0.02, u) * (1 - smooth01(head - 0.02, head + 0.04, u));
      const edgeK = ra.edge[i] > 0.5 ? 1 : 0.42;
      const v = Math.max(0, lead * trailing * along * flare * edgeK * ra.gain);
      arr[i * 3] = v;
      arr[i * 3 + 1] = v;
      arr[i * 3 + 2] = v;
    }
    col.needsUpdate = true;
  });
}

/** 画面平面に垂直な法線（経路の接線に直交）を自動計算 */
function pathFromFn(
  fn: (t: number) => THREE.Vector3,
  segments: number,
  normalFn?: (t: number, p: THREE.Vector3, tangent: THREE.Vector3) => THREE.Vector3
): RibbonPoint[] {
  const pts: RibbonPoint[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const p = fn(t);
    const pn = fn(Math.min(1, t + 1 / segments));
    const pp = fn(Math.max(0, t - 1 / segments));
    const tangent = pn.clone().sub(pp).normalize();
    const n = normalFn ? normalFn(t, p, tangent).normalize() : V(-tangent.y, tangent.x, 0.12).normalize();
    pts.push({ p, n });
  }
  return pts;
}

function makeParticle(
  scene: THREE.Scene,
  worldPos: THREE.Vector3,
  vel: THREE.Vector3,
  color: THREE.ColorRepresentation,
  size: number,
  gravity: number,
  decay: number,
  box = false
): MeleeFxParticle {
  const geo = box ? new THREE.BoxGeometry(size, size, size) : new THREE.SphereGeometry(size, 4, 4);
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false }));
  mesh.position.copy(worldPos);
  scene.add(mesh);
  return { mesh, velocity: vel, gravity, decay };
}

function lightningLine(from: THREE.Vector3, to: THREE.Vector3, segs: number, jitter: number, color: THREE.ColorRepresentation): THREE.Line {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const p = from.clone().lerp(to, t);
    if (i > 0 && i < segs) {
      p.x += (Math.random() - 0.5) * jitter;
      p.y += (Math.random() - 0.5) * jitter;
      p.z += (Math.random() - 0.5) * jitter;
    }
    pts.push(p);
  }
  const g = new THREE.BufferGeometry().setFromPoints(pts);
  return new THREE.Line(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false }));
}

/** 画面（カメラ）に正対する十字の輝き */
function glint(size: number, color: THREE.ColorRepresentation): THREE.Group {
  const g = new THREE.Group();
  const m1 = new THREE.Mesh(new THREE.PlaneGeometry(size, size * 0.06), addMat(color, 1));
  const m2 = new THREE.Mesh(new THREE.PlaneGeometry(size * 0.06, size), addMat(color, 1));
  const m3 = new THREE.Mesh(new THREE.PlaneGeometry(size * 0.55, size * 0.04), addMat(0xffffff, 1));
  m3.rotation.z = Math.PI / 4;
  const m4 = m3.clone();
  m4.rotation.z = -Math.PI / 4;
  g.add(m1, m2, m3, m4);
  return g;
}

function floorRing(inner: number, outer: number, color: THREE.ColorRepresentation, opacity = 0.9): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.RingGeometry(inner, outer, 48), addMat(color, opacity));
  mesh.rotation.x = -Math.PI / 2;
  return mesh;
}

/**
 * Optional pooled-light provider (set by the battle scene). Adding / removing PointLights changes the
 * scene's light count, which makes three.js switch (and often recompile) every lit material's shader —
 * a visible hitch. With a provider, effects borrow one of a fixed set of lights instead.
 */
type FxLightProvider = (color: THREE.ColorRepresentation, intensity: number, dist: number, pos: THREE.Vector3) => THREE.PointLight;
let fxLightProvider: FxLightProvider | null = null;
export function setFxLightProvider(fn: FxLightProvider | null): void {
  fxLightProvider = fn;
}

function addLight(scene: THREE.Scene, color: THREE.ColorRepresentation, pos: THREE.Vector3, intensity = 5.2, dist = 13): THREE.PointLight {
  if (fxLightProvider) return fxLightProvider(color, intensity, dist, pos);
  const l = new THREE.PointLight(color, intensity, dist);
  l.position.copy(pos);
  scene.add(l);
  return l;
}

interface CamFrame {
  origin: THREE.Vector3;
  forward: THREE.Vector3;
  right: THREE.Vector3;
  up: THREE.Vector3;
}

function camFrame(camera: THREE.Camera): CamFrame {
  const origin = camera.position.clone();
  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);
  const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
  const up = new THREE.Vector3().crossVectors(right, forward).normalize();
  return { origin, forward, right, up };
}

function camGroup(camera: THREE.Camera): THREE.Group {
  const g = new THREE.Group();
  g.position.copy(camera.position);
  g.quaternion.copy(camera.quaternion);
  return g;
}

/** カメラ空間のローカル座標をワールドへ */
function toWorld(camera: THREE.Camera, local: THREE.Vector3): THREE.Vector3 {
  return local.clone().applyQuaternion(camera.quaternion).add(camera.position);
}

/** 水平方向（地面に平行）の前方ベクトル */
function flatForward(f: THREE.Vector3): THREE.Vector3 {
  const v = f.clone();
  v.y = 0;
  if (v.lengthSq() < 1e-4) v.set(0, 0, -1);
  return v.normalize();
}

/* -------------------------------------------------------------------------- */
/*  KATANA — 細く鋭い一閃。残像と煌めき                                          */
/* -------------------------------------------------------------------------- */

function buildKatana(c: MeleeFxContext): MeleeFxResult {
  const { camera, scene, step } = c;
  const group = camGroup(camera);
  const col = new THREE.Color(c.color);
  const particles: MeleeFxParticle[] = [];
  const white = 0xe0f2fe;

  let pts: RibbonPoint[];
  let glintPos = V(-0.9, -0.1, -1.2);

  if (step === 1) {
    // 右から左への水平一閃（やや上り）
    pts = pathFromFn((t) => V(1.05 - 2.1 * t, -0.22 + 0.2 * t + 0.05 * Math.sin(t * Math.PI), -1.25 + 0.12 * Math.sin(t * Math.PI)), 48);
    glintPos = V(-1.0, -0.02, -1.2);
  } else if (step === 2) {
    // 左下から右上への逆袈裟
    pts = pathFromFn((t) => V(-0.95 + 1.9 * t, -0.62 + 1.2 * t, -1.2 + 0.1 * Math.sin(t * Math.PI)), 48);
    glintPos = V(0.95, 0.58, -1.2);
  } else if (step === 3) {
    // 天から足元への唐竹割り（縦の一本線）
    pts = pathFromFn((t) => V(0.0, 1.0 - 2.0 * t, -1.2), 48, () => V(1, 0, 0.1));
    glintPos = V(0, -0.98, -1.2);
  } else {
    // 水平円斬り（プレイヤーを囲むリング）
    pts = pathFromFn(
      (t) => {
        const a = -Math.PI + t * TAU;
        return V(Math.sin(a) * 1.5, -0.2, -Math.cos(a) * 1.5);
      },
      72,
      () => V(0, 1, 0)
    );
  }

  const baseWidth = step === 3 ? 0.18 : step === 4 ? 0.34 : 0.3;
  group.add(
    buildRibbon(pts, { width: baseWidth, taper: 0.28, front: 0.5, back: 0.5, outer: col, core: 0xffffff, coreScale: 0.3, trail: false })
  );

  // 残像（わずかにずらした薄い二本目）
  const ghost = buildRibbon(pts.map((q) => ({ p: q.p.clone().add(V(0.0, -0.06, -0.05)), n: q.n })), {
    width: baseWidth * 1.6,
    taper: 0.3,
    front: 0.5,
    back: 0.5,
    outer: scaleColor(col, 0.45),
    core: scaleColor(white, 0.4),
    coreScale: 0.2,
    trail: false,
  });
  group.add(ghost);
  // 残像をさらに二枚、軌跡の後ろへ時間差で重ねる（高周波ブレードの余韻）
  [0.1, 0.2].forEach((k, i) => {
    const echo = buildRibbon(pts.map((q) => ({ p: q.p.clone().add(V(0.0, -0.1 * (i + 1), -0.1 * (i + 1))), n: q.n })), {
      width: baseWidth * (1.9 + i * 0.5),
      taper: 0.34,
      front: 0.5,
      back: 0.5,
      outer: scaleColor(col, 0.3 - k * 0.5),
      core: scaleColor(white, 0.18),
      coreScale: 0.12,
      trail: false,
    });
    group.add(echo);
  });

  // 切り終わりの煌めき
  const g = glint(step === 3 ? 0.8 : 0.6, white);
  g.position.copy(glintPos);
  group.add(g);

  if (step === 3) {
    // 縦一閃の衝撃：地面の横線
    const line = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.05), addMat(white, 1));
    line.position.set(0, -0.95, -1.5);
    group.add(line);
  }
  if (step === 4) {
    // 円斬りの床リング
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.4, 1.62, 64), addMat(col, 0.9));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(0, -1.1, 0);
    group.add(ring);
  }

  // 鋭い火花（接線方向）
  const f = camFrame(camera);
  const count = step === 4 ? 26 : 16;
  for (let i = 0; i < count; i++) {
    const idx = Math.floor(THREE.MathUtils.lerp(4, pts.length - 4, i / count));
    const nxt = pts[Math.min(pts.length - 1, idx + 1)].p;
    const tangent = nxt.clone().sub(pts[idx].p).normalize();
    const worldVel = tangent.multiplyScalar(9).applyQuaternion(camera.quaternion).addScaledVector(f.forward, 2.0);
    particles.push(makeParticle(scene, toWorld(camera, pts[idx].p), worldVel, white, 0.022, 1.2, 3.4));
  }

  const light = addLight(scene, col, f.origin.clone().addScaledVector(f.forward, 1.3), 4.6, 11);
  return { group, particles, light, lifetime: step === 3 ? 0.3 : 0.26, direction: f.forward.clone(), forwardSpeed: step === 4 ? 0 : 1.2, expansionRate: 0.1 };
}

/* -------------------------------------------------------------------------- */
/*  GLAIVE — 幅広の大弧。熱の余波と舞い上がる火の粉                              */
/* -------------------------------------------------------------------------- */

function buildGlaive(c: MeleeFxContext): MeleeFxResult {
  const { camera, scene, step } = c;
  const group = camGroup(camera);
  const col = new THREE.Color(c.color);
  const hot = new THREE.Color(0xffb36b);
  const particles: MeleeFxParticle[] = [];
  const f = camFrame(camera);
  let pts: RibbonPoint[];
  let width = 1.0;

  if (step === 1) {
    pts = pathFromFn(
      (t) => {
        const a = THREE.MathUtils.lerp(-1.25, 1.25, t);
        return V(Math.sin(a) * 1.9, -0.28 + 0.16 * Math.cos(a), -0.2 - Math.cos(a) * 1.6);
      },
      60,
      () => V(0, 1, 0.22)
    );
  } else if (step === 2) {
    pts = pathFromFn(
      (t) => {
        const a = THREE.MathUtils.lerp(1.25, -1.25, t);
        return V(Math.sin(a) * 1.9, -0.55 + 0.9 * t, -0.2 - Math.cos(a) * 1.6);
      },
      60,
      () => V(0, 1, 0.3)
    );
  } else if (step === 3) {
    // 頭上で風車のように一回転 → 叩きつけ
    pts = pathFromFn((t) => {
      const a = -Math.PI / 2 + t * TAU * 0.92;
      return V(Math.cos(a) * 1.05, 0.15 + Math.sin(a) * 0.95, -1.35);
    }, 64);
    width = 0.8;
  } else {
    pts = pathFromFn(
      (t) => {
        const a = -Math.PI + t * TAU;
        return V(Math.sin(a) * 2.0, -0.22, -Math.cos(a) * 2.0);
      },
      80,
      () => V(0, 1, 0)
    );
    width = 1.1;
  }

  group.add(buildRibbon(pts, { width, taper: 0.5, outer: col, core: hot, coreScale: 0.42, reverse: step <= 2 }));

  if (step === 3) {
    // 叩きつけた先の熱柱（火柱）と床の衝撃リング
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.5, 2.6, 14, 1, true), addMat(col, 0.7));
    pillar.position.set(0, -0.2, -3.2);
    group.add(pillar);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.4, 1.9, 40), addMat(hot, 0.85));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(0, -1.5, -3.2);
    group.add(ring);
  }

  // 火の粉：ふわりと上昇
  const count = step === 4 ? 40 : 30;
  for (let i = 0; i < count; i++) {
    const idx = Math.floor(THREE.MathUtils.lerp(2, pts.length - 2, i / count));
    const lp = pts[idx].p.clone();
    const vel = V((Math.random() - 0.5) * 1.8, 1.2 + Math.random() * 2.4, (Math.random() - 0.5) * 1.8).applyQuaternion(camera.quaternion);
    particles.push(
      makeParticle(scene, toWorld(camera, lp), vel, i % 3 === 0 ? 0xfff1c2 : 0xff8a3d, 0.04 + Math.random() * 0.03, -1.4, 1.6)
    );
  }

  const light = addLight(scene, 0xff7a3d, f.origin.clone().addScaledVector(f.forward, 1.6), 5.6, 14);
  return { group, particles, light, lifetime: 0.4, direction: f.forward.clone(), forwardSpeed: step === 4 ? 0 : 1.0, expansionRate: 0.14 };
}

/* -------------------------------------------------------------------------- */
/*  DAGGER — 高速の細かな斬線 + 位相の残像(ゴースト) + グリッチ                   */
/* -------------------------------------------------------------------------- */

function buildDagger(c: MeleeFxContext): MeleeFxResult {
  const { camera, scene, step } = c;
  const group = camGroup(camera);
  const col = new THREE.Color(c.color);
  const light = addLight(scene, col, camera.position.clone(), 4.2, 9);
  const particles: MeleeFxParticle[] = [];
  const f = camFrame(camera);
  const bright = new THREE.Color(0xe9d5ff);

  const streak = (a: THREE.Vector3, b: THREE.Vector3, w: number) => {
    const pts = pathFromFn((t) => a.clone().lerp(b, t), 20);
    group.add(buildRibbon(pts, { width: w, taper: 0.3, front: 0.5, back: 0.5, outer: col, core: bright, coreScale: 0.35, trail: false }));
  };

  if (step === 1) {
    streak(V(0.7, 0.18, -1.0), V(-0.7, -0.16, -1.0), 0.14);
    streak(V(0.62, 0.0, -1.1), V(-0.8, -0.3, -1.1), 0.1);
    streak(V(0.55, -0.16, -1.05), V(-0.55, -0.42, -1.05), 0.08);
  } else if (step === 2) {
    streak(V(-0.7, 0.2, -1.0), V(0.7, -0.14, -1.0), 0.14);
    streak(V(-0.8, 0.02, -1.1), V(0.6, -0.28, -1.1), 0.1);
    streak(V(-0.5, -0.1, -1.05), V(0.55, -0.4, -1.05), 0.08);
  } else if (step === 3) {
    // 二連突き：奥へ伸びる二本の光線
    [0.0, 0.0].forEach((_, i) => {
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.07, 4.2 + i * 1.6, 10, 1, true), addMat(col, 0.9));
      beam.rotation.x = Math.PI / 2;
      beam.position.set(i === 0 ? -0.06 : 0.06, -0.12 + i * 0.03, -2.6 - i * 0.8);
      group.add(beam);
      const core = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.025, 4.2 + i * 1.6, 6, 1, true), addMat(bright, 1));
      core.rotation.x = Math.PI / 2;
      core.position.copy(beam.position);
      group.add(core);
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.34, 20), addMat(col, 0.9));
      ring.position.set(beam.position.x, beam.position.y, -3.2 - i * 1.2);
      group.add(ring);
    });
  } else {
    // 高速旋回の円環
    const pts = pathFromFn(
      (t) => {
        const a = -Math.PI + t * TAU;
        return V(Math.sin(a) * 1.2, -0.12, -Math.cos(a) * 1.2);
      },
      60,
      () => V(0, 1, 0)
    );
    group.add(buildRibbon(pts, { width: 0.2, taper: 0.2, front: 0.5, back: 0.5, outer: col, core: bright, coreScale: 0.4, trail: false }));
  }

  // ブリンク残像：前方に向かって等間隔の位相ゴースト（薄いダガーのシルエット）
  const ghostCount = step >= 3 ? 4 : 3;
  const ghosts: THREE.Mesh[] = [];
  for (let i = 0; i < ghostCount; i++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.02, 0.8), addMat(scaleColor(col, 0.7), 0.6));
    m.position.set(0.1 - i * 0.04, -0.2, -0.5 - i * 0.7);
    m.rotation.y = (i % 2 === 0 ? 1 : -1) * 0.2;
    group.add(m);
    ghosts.push(m);
  }

  // グリッチ破片（小さな立方体）
  const glitchCount = step === 4 ? 22 : 16;
  for (let i = 0; i < glitchCount; i++) {
    const lp = V((Math.random() - 0.5) * 1.6, (Math.random() - 0.5) * 0.7 - 0.15, -0.7 - Math.random() * 1.8);
    const vel = V((Math.random() - 0.5) * 3, (Math.random() - 0.5) * 2, -Math.random() * 6).applyQuaternion(camera.quaternion);
    particles.push(makeParticle(scene, toWorld(camera, lp), vel, i % 2 ? 0xc084fc : 0xf5d0fe, 0.035 + Math.random() * 0.03, 0.5, 3.6, true));
  }

  return {
    group,
    particles,
    light,
    lifetime: 0.26,
    direction: f.forward.clone(),
    forwardSpeed: step >= 3 ? 3.4 : 1.4,
    onUpdate: (p) => {
      // ゴーストが一瞬ちらつく（位相ズレ）
      ghosts.forEach((g, i) => {
        g.visible = Math.sin(p * 55 + i * 1.7) > -0.2;
      });
    },
  };
}

/* -------------------------------------------------------------------------- */
/*  CHAIN SPEAR — 銛が射出され、鎖が伸び、巻き戻る                              */
/* -------------------------------------------------------------------------- */

function buildChainSpear(c: MeleeFxContext): MeleeFxResult {
  const { camera, scene, step } = c;
  const group = camGroup(camera);
  const col = new THREE.Color(c.color);
  const particles: MeleeFxParticle[] = [];
  const f = camFrame(camera);
  const bright = new THREE.Color(0xfff2cc);
  const light = addLight(scene, col, f.origin.clone().addScaledVector(f.forward, 2), 4.0, 12);

  if (step === 4) {
    // 鎖を振り回す：回転する腕（鎖＋銛）
    const arm = new THREE.Group();
    const chain = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, 5.2), addMat(col, 0.9));
    chain.position.set(0, -0.2, -2.6);
    arm.add(chain);
    for (let i = 0; i < 9; i++) {
      const link = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.016, 5, 10), addMat(bright, 0.9));
      link.position.set(0, -0.2, -0.6 - i * 0.55);
      link.rotation.y = (i % 2) * Math.PI * 0.5;
      arm.add(link);
    }
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.8, 8), addMat(bright, 1));
    head.rotation.x = -Math.PI / 2;
    head.position.set(0, -0.2, -5.6);
    arm.add(head);
    group.add(arm);

    const ringPts = pathFromFn(
      (t) => {
        const a = -Math.PI + t * TAU;
        return V(Math.sin(a) * 5.0, -0.5, -Math.cos(a) * 5.0);
      },
      80,
      () => V(0, 1, 0)
    );
    group.add(buildRibbon(ringPts, { width: 0.5, taper: 0.2, front: 0.5, back: 0.5, outer: col, core: bright, coreScale: 0.3, trail: false }));

    return {
      group,
      particles,
      light,
      lifetime: 0.42,
      onUpdate: (p) => {
        arm.rotation.y = -p * TAU * 1.1;
      },
    };
  }

  // 射出：銛（先端）+ 鎖（箱の伸縮）
  const reach = step === 3 ? Math.min(c.range, 16) : Math.min(c.range, 13);
  const dir = V(step === 2 ? -0.08 : 0.0, step === 2 ? -0.12 : -0.03, -1).normalize();
  const rig = new THREE.Group();
  group.add(rig);

  const chain = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 1), addMat(col, 0.95));
  rig.add(chain);
  const links: THREE.Mesh[] = [];
  for (let i = 0; i < 14; i++) {
    const link = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.014, 5, 10), addMat(bright, 0.9));
    link.rotation.y = (i % 2) * Math.PI * 0.5;
    rig.add(link);
    links.push(link);
  }
  const head = new THREE.Group();
  const cone = new THREE.Mesh(new THREE.ConeGeometry(step === 3 ? 0.3 : 0.2, step === 3 ? 1.0 : 0.7, 8), addMat(bright, 1));
  cone.rotation.x = -Math.PI / 2;
  head.add(cone);
  [-1, 1].forEach((s) => {
    const barb = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.2, 0.34), addMat(col, 1));
    barb.position.set(s * 0.14, 0, 0.25);
    barb.rotation.y = s * 0.5;
    head.add(barb);
  });
  rig.add(head);

  const impactRing = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.55, 24), addMat(bright, 0.9));
  impactRing.visible = false;
  group.add(impactRing);

  const startOffset = V(0.12, -0.2, -0.5);
  return {
    group,
    particles,
    light,
    lifetime: 0.5,
    onUpdate: (p) => {
      // 0..0.45 射出 / 0.45..0.6 静止 / 0.6..1 巻き戻し
      let k: number;
      if (p < 0.45) k = 1 - Math.pow(1 - p / 0.45, 3);
      else if (p < 0.6) k = 1;
      else k = 1 - (p - 0.6) / 0.4;
      const d = Math.max(0.01, reach * k);
      const tip = startOffset.clone().addScaledVector(dir, d);
      head.position.copy(tip);
      head.quaternion.setFromUnitVectors(V(0, 0, -1), dir);
      head.rotateZ(p * 20); // 回転しながら飛ぶ
      chain.position.copy(startOffset).addScaledVector(dir, d / 2);
      chain.scale.set(1, 1, d);
      chain.quaternion.setFromUnitVectors(V(0, 0, -1), dir);
      links.forEach((l, i) => {
        const q = (i + 1) / (links.length + 1);
        l.position.copy(startOffset).addScaledVector(dir, d * q);
      });
      if (p > 0.4 && p < 0.7) {
        impactRing.visible = true;
        impactRing.position.copy(tip);
        const s = 1 + (p - 0.4) * 5;
        impactRing.scale.set(s, s, s);
      } else {
        impactRing.visible = false;
      }
    },
  };
}

/* -------------------------------------------------------------------------- */
/*  SCYTHE — 巨大な三日月 + 渦。引き裂き                                        */
/* -------------------------------------------------------------------------- */

function buildScythe(c: MeleeFxContext): MeleeFxResult {
  const { camera, scene, step } = c;
  const group = camGroup(camera);
  const col = new THREE.Color(c.color);
  const dark = new THREE.Color(0x5b21b6);
  const bright = new THREE.Color(0xf5d0fe);
  const particles: MeleeFxParticle[] = [];
  const f = camFrame(camera);
  const spinners: THREE.Object3D[] = [];
  let pts: RibbonPoint[];
  let center = V(0, -0.15, -1.2);

  if (step === 1) {
    // 右上 → 左下へ、巨大な三日月
    pts = pathFromFn(
      (t) => {
        const a = THREE.MathUtils.lerp(-1.3, 1.3, t);
        return V(Math.sin(a) * 2.1, 0.5 - 0.95 * t + 0.25 * Math.cos(a), -0.4 - Math.cos(a) * 1.7);
      },
      64,
      (t, p) => V(0, 1, 0.3)
    );
  } else if (step === 2) {
    pts = pathFromFn(
      (t) => {
        const a = THREE.MathUtils.lerp(1.3, -1.3, t);
        return V(Math.sin(a) * 2.1, -0.6 + 0.9 * t + 0.2 * Math.cos(a), -0.4 - Math.cos(a) * 1.7);
      },
      64,
      () => V(0, 1, 0.3)
    );
  } else if (step === 3) {
    // 縦の三日月：頭上から手前へ引き裂く
    pts = pathFromFn(
      (t) => {
        const a = THREE.MathUtils.lerp(-1.2, 1.2, t);
        return V(0.15 * Math.sin(t * Math.PI), Math.sin(-a) * 1.3 + 0.1, -0.8 - Math.cos(a) * 1.3);
      },
      64,
      () => V(1, 0, 0.2)
    );
  } else {
    pts = pathFromFn(
      (t) => {
        const a = -Math.PI + t * TAU;
        return V(Math.sin(a) * 2.0, -0.2, -Math.cos(a) * 2.0);
      },
      80,
      () => V(0, 1, 0)
    );
  }

  const scytheRev = step <= 2;
  group.add(buildRibbon(pts, { width: step === 4 ? 0.9 : 1.15, taper: 0.55, outer: col, core: bright, coreScale: 0.3, reverse: scytheRev }));
  // 暗紫の裏刃（奥行き）
  group.add(
    buildRibbon(pts.map((q) => ({ p: q.p.clone().add(V(0, -0.12, -0.12)), n: q.n })), {
      width: 1.4,
      taper: 0.6,
      outer: scaleColor(dark, 0.7),
      core: scaleColor(col, 0.4),
      coreScale: 0.25,
      trail: false,
      reverse: scytheRev,
    })
  );

  // 渦（回転するリング）
  const ringCount = step === 4 ? 3 : 2;
  for (let i = 0; i < ringCount; i++) {
    const r = (step === 4 ? 0.9 : 0.7) + i * (step === 4 ? 0.55 : 0.4);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.02, 6, 36), addMat(i % 2 ? bright : col, 0.9));
    ring.rotation.x = Math.PI / 2 + (step === 3 ? Math.PI / 2 : 0);
    ring.position.copy(step === 4 ? V(0, -0.3 + i * 0.3, 0) : center);
    group.add(ring);
    spinners.push(ring);
  }

  // 魂の残滓：渦に吸い込まれる紫の粒子（中心へ収束）
  const count = step === 4 ? 36 : 28;
  for (let i = 0; i < count; i++) {
    const idx = Math.floor(THREE.MathUtils.lerp(2, pts.length - 2, i / count));
    const lp = pts[idx].p;
    const toCenter = center.clone().sub(lp).multiplyScalar(1.4);
    const vel = toCenter.applyQuaternion(camera.quaternion).add(V((Math.random() - 0.5) * 2, 0.6 + Math.random() * 1.5, (Math.random() - 0.5) * 2));
    particles.push(makeParticle(scene, toWorld(camera, lp), vel, i % 2 ? 0xd8b4fe : 0xa855f7, 0.04 + Math.random() * 0.03, -0.6, 1.9));
  }

  const light = addLight(scene, col, f.origin.clone().addScaledVector(f.forward, 1.6), 5.4, 14);
  return {
    group,
    particles,
    light,
    lifetime: 0.42,
    direction: f.forward.clone(),
    forwardSpeed: step === 4 ? 0 : step === 3 ? -0.6 : 0.9, // SOUL RIP は手前に引き寄せる
    expansionRate: 0.12,
    onUpdate: (p) => {
      spinners.forEach((s, i) => {
        s.rotation.z += (i % 2 ? -1 : 1) * 0.35;
      });
      if (step === 4) group.rotation.y += 0.02 * Math.sin(p * Math.PI);
    },
  };
}

/* -------------------------------------------------------------------------- */
/*  HAMMER — 着弾の衝撃・床の亀裂・衝撃波リング・飛び散る破片                    */
/* -------------------------------------------------------------------------- */

function buildHammer(c: MeleeFxContext): MeleeFxResult {
  const { camera, scene, step } = c;
  const f = camFrame(camera);
  const ff = flatForward(f.forward);
  const col = new THREE.Color(c.color);
  const bright = new THREE.Color(0xffe0b2);
  const group = new THREE.Group();
  const particles: MeleeFxParticle[] = [];
  const floorY = 0.06;
  const impactDist = step === 2 ? 3.0 : 2.6;
  const impact = new THREE.Vector3(camera.position.x, floorY, camera.position.z).addScaledVector(ff, impactDist);
  const maxR = Math.max(4, Math.min(c.range, 9));

  // 衝撃波リング（プレイヤー中心＝ダメージ判定と一致）
  const rings: THREE.Mesh[] = [];
  const ringCount = step === 3 ? 3 : step === 4 ? 3 : 2;
  for (let i = 0; i < ringCount; i++) {
    const r = floorRing(0.82, 1.0, i === 0 ? bright : col, 0.9);
    r.position.set(camera.position.x, floorY + i * 0.01, camera.position.z);
    group.add(r);
    rings.push(r);
  }

  // 地面の亀裂（着弾点から放射状のジグザグ線）
  const crackCount = step === 3 ? 12 : 8;
  for (let i = 0; i < crackCount; i++) {
    const ang = (i / crackCount) * TAU + Math.random() * 0.3;
    const len = (step === 3 ? 5.2 : 3.6) * (0.6 + Math.random() * 0.6);
    const to = impact.clone().add(V(Math.cos(ang) * len, 0.02, Math.sin(ang) * len));
    group.add(lightningLine(impact.clone(), to, 7, 0.5, col));
  }

  // 着弾の閃光と衝撃柱
  const flash = new THREE.Mesh(new THREE.SphereGeometry(0.6, 12, 10), addMat(bright, 0.95));
  flash.position.copy(impact).add(V(0, 0.4, 0));
  group.add(flash);
  const pillarH = step === 3 ? 5.5 : 2.6;
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.3, step === 3 ? 1.2 : 0.8, pillarH, 14, 1, true), addMat(col, 0.7));
  pillar.position.copy(impact).add(V(0, pillarH / 2, 0));
  group.add(pillar);

  if (step === 2) {
    // 薙ぎ払い：地面を這う低い弧（砂塵の帯）
    const arc = pathFromFn(
      (t) => {
        const a = THREE.MathUtils.lerp(1.0, -1.0, t);
        return V(camera.position.x + (ff.x * Math.cos(a) - ff.z * Math.sin(a)) * 2.8, floorY + 0.25, camera.position.z + (ff.z * Math.cos(a) + ff.x * Math.sin(a)) * 2.8);
      },
      40,
      () => V(0, 1, 0)
    );
    group.add(buildRibbon(arc, { width: 0.7, taper: 0.5, outer: col, core: bright, coreScale: 0.3 }));
  }

  // 破片と砂塵：放射状に飛び散る
  const debris = step === 3 ? 44 : 30;
  for (let i = 0; i < debris; i++) {
    const ang = Math.random() * TAU;
    const sp = 2 + Math.random() * 5;
    const vel = V(Math.cos(ang) * sp, 3 + Math.random() * 5, Math.sin(ang) * sp);
    particles.push(
      makeParticle(scene, impact.clone().add(V(0, 0.1, 0)), vel, i % 3 === 0 ? 0xffc08a : 0xd6a77a, 0.06 + Math.random() * 0.07, 14, 1.3, true)
    );
  }

  scene.add(group);
  const light = addLight(scene, col, impact.clone().add(V(0, 1.0, 0)), step === 3 ? 8 : 6, 16);
  return {
    group,
    particles,
    light,
    lifetime: step === 3 ? 0.62 : 0.5,
    onUpdate: (p) => {
      rings.forEach((r, i) => {
        const delay = i * 0.12;
        const pp = Math.max(0, Math.min(1, (p - delay) / (1 - delay)));
        const s = 0.4 + maxR * (1 - Math.pow(1 - pp, 3));
        r.scale.set(s, s, s);
      });
      const fs = 1 + p * 2.4;
      flash.scale.set(fs, fs, fs);
      pillar.scale.set(1 + p * 0.8, 1 + p * 0.2, 1 + p * 0.8);
    },
  };
}

/* -------------------------------------------------------------------------- */
/*  ANCHOR — 重い薙ぎ払いと、叩き落としの水柱・波紋                              */
/* -------------------------------------------------------------------------- */

function buildAnchor(c: MeleeFxContext): MeleeFxResult {
  const { camera, scene, step } = c;
  const f = camFrame(camera);
  const ff = flatForward(f.forward);
  const col = new THREE.Color(c.color);
  const foam = new THREE.Color(0xe0fdf8);
  const group = new THREE.Group();
  const particles: MeleeFxParticle[] = [];
  const floorY = 0.06;

  if (step <= 2) {
    // 横薙ぎ: 胸の高さを走る幅広の弧（2段目は逆向き）
    const dirSign = step === 1 ? 1 : -1;
    const R = Math.min(c.range, 6) * 0.62;
    const arc = pathFromFn(
      (t) => {
        const a = THREE.MathUtils.lerp(1.15, -1.15, t) * dirSign;
        return V(
          camera.position.x + (ff.x * Math.cos(a) - ff.z * Math.sin(a)) * R,
          camera.position.y - 0.55 + Math.sin(t * Math.PI) * 0.25,
          camera.position.z + (ff.z * Math.cos(a) + ff.x * Math.sin(a)) * R
        );
      },
      40,
      () => V(0, 1, 0)
    );
    group.add(buildRibbon(arc, { width: 0.85, taper: 0.5, outer: col, core: foam, coreScale: 0.3 }));
    for (let i = 0; i < 16; i++) {
      const t = Math.random();
      const a = THREE.MathUtils.lerp(1.15, -1.15, t) * dirSign;
      const pos = V(camera.position.x + (ff.x * Math.cos(a) - ff.z * Math.sin(a)) * R, camera.position.y - 0.5, camera.position.z + (ff.z * Math.cos(a) + ff.x * Math.sin(a)) * R);
      particles.push(makeParticle(scene, pos, V((Math.random() - 0.5) * 3, 1 + Math.random() * 2, (Math.random() - 0.5) * 3), i % 2 ? 0x99f6e4 : 0xe0f2fe, 0.045, 9, 1.5));
    }
    scene.add(group);
    return { group, particles, lifetime: 0.34 };
  }

  // 叩き落とし / 旋回: 足元から広がる波紋と水柱
  const impact = new THREE.Vector3(camera.position.x, floorY, camera.position.z).addScaledVector(ff, step === 3 ? 2.6 : 0);
  const maxR = Math.max(4, Math.min(c.range, 9));
  const rings: THREE.Mesh[] = [];
  for (let i = 0; i < 3; i++) {
    const r = floorRing(0.84, 1.0, i === 0 ? foam : col, 0.85);
    r.position.set(camera.position.x, floorY + i * 0.01, camera.position.z);
    group.add(r);
    rings.push(r);
  }
  const pillarH = step === 3 ? 4.6 : 2.2;
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 1.1, pillarH, 16, 1, true), addMat(col, 0.6));
  pillar.position.copy(impact).add(V(0, pillarH / 2, 0));
  group.add(pillar);
  const flash = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 10), addMat(foam, 0.9));
  flash.position.copy(impact).add(V(0, 0.35, 0));
  group.add(flash);
  for (let i = 0; i < (step === 3 ? 40 : 24); i++) {
    const ang = Math.random() * TAU;
    const sp = 2 + Math.random() * 5;
    particles.push(makeParticle(scene, impact.clone().add(V(0, 0.1, 0)), V(Math.cos(ang) * sp, 3 + Math.random() * 5, Math.sin(ang) * sp), i % 3 ? 0x99f6e4 : 0xe0f2fe, 0.05 + Math.random() * 0.04, 14, 1.2));
  }
  scene.add(group);
  const light = addLight(scene, col, impact.clone().add(V(0, 1.0, 0)), 6, 14);
  return {
    group,
    particles,
    light,
    lifetime: step === 3 ? 0.6 : 0.48,
    onUpdate: (p) => {
      rings.forEach((r, i) => {
        const delay = i * 0.12;
        const pp = Math.max(0, Math.min(1, (p - delay) / (1 - delay)));
        const sc = 0.4 + maxR * (1 - Math.pow(1 - pp, 3));
        r.scale.set(sc, sc, sc);
      });
      flash.scale.setScalar(1 + p * 2.2);
      pillar.scale.set(1 + p * 0.8, 1 + p * 0.15, 1 + p * 0.8);
    },
  };
}

/* -------------------------------------------------------------------------- */
/*  GAUNTLETS — 拳ごとの衝撃。電撃                                              */
/* -------------------------------------------------------------------------- */

function buildGauntlets(c: MeleeFxContext): MeleeFxResult {
  const { camera, scene, step, variant } = c;
  const group = camGroup(camera);
  const col = new THREE.Color(c.color);
  const bright = new THREE.Color(0xcffafe);
  const particles: MeleeFxParticle[] = [];
  const f = camFrame(camera);
  const rings: THREE.Mesh[] = [];

  const addShock = (pos: THREE.Vector3, r0: number, r1: number) => {
    const ring = new THREE.Mesh(new THREE.RingGeometry(r0, r1, 28), addMat(col, 0.95));
    ring.position.copy(pos);
    group.add(ring);
    const core = new THREE.Mesh(new THREE.RingGeometry(r0 * 0.4, r0 * 0.95, 24), addMat(bright, 1));
    core.position.copy(pos).add(V(0, 0, 0.01));
    group.add(core);
    rings.push(ring, core);
  };

  const bolts = (from: THREE.Vector3, count: number, len: number, spread: number) => {
    for (let i = 0; i < count; i++) {
      const to = from.clone().add(V((Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread, -len * (0.5 + Math.random() * 0.6)));
      group.add(lightningLine(from, to, 6, 0.28, i % 2 ? bright : col));
    }
  };

  const isUpper = step === 3 && variant === 1;
  const isDual = (step === 3 && variant === 0) || step === 4;

  if (step === 1) {
    // 左ジャブ：小さく鋭い
    const pos = V(-0.2, -0.14, -1.2);
    addShock(pos, 0.2, 0.46);
    const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.4, 1.0, 12, 1, true), addMat(col, 0.7));
    cone.rotation.x = Math.PI / 2;
    cone.position.set(-0.18, -0.14, -1.7);
    group.add(cone);
    bolts(pos, 3, 1.4, 0.5);
  } else if (step === 2) {
    // 右クロス：外から内への弧
    const arc = pathFromFn((t) => V(0.75 - 0.9 * t, -0.02 + 0.1 * Math.sin(t * Math.PI), -1.15 + 0.2 * Math.sin(t * Math.PI)), 28);
    group.add(buildRibbon(arc, { width: 0.4, taper: 0.4, outer: col, core: bright, coreScale: 0.4, trail: false }));
    const pos = V(-0.1, -0.06, -1.25);
    addShock(pos, 0.26, 0.6);
    bolts(pos, 4, 1.6, 0.7);
  } else if (isUpper) {
    // アッパー：下から上への弧と、上方への電撃
    const arc = pathFromFn((t) => V(0.35 - 0.35 * t, -0.8 + 1.5 * t, -1.0 - 0.3 * Math.sin(t * Math.PI)), 28);
    group.add(buildRibbon(arc, { width: 0.45, taper: 0.4, outer: col, core: bright, coreScale: 0.4, trail: false }));
    const pos = V(0, 0.35, -1.3);
    addShock(pos, 0.3, 0.75);
    bolts(pos, 6, 1.0, 1.2);
  } else if (isDual) {
    // 双掌：大きな衝撃波＋放射状の稲妻
    const big = step === 4;
    const pos = V(0, -0.05, -1.3);
    addShock(pos, big ? 0.7 : 0.45, big ? 1.55 : 1.05);
    if (big) addShock(V(0, -0.05, -2.2), 0.5, 1.2);
    const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.15, big ? 1.3 : 0.9, 1.6, 18, 1, true), new THREE.MeshBasicMaterial({ color: col, wireframe: true, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
    cone.rotation.x = Math.PI / 2;
    cone.position.set(0, -0.05, -1.9);
    group.add(cone);
    bolts(pos, big ? 12 : 8, big ? 3.0 : 2.0, big ? 3.2 : 2.2);
  }

  // 前方へ噴き出す火花
  const count = step >= 3 ? 30 : 18;
  for (let i = 0; i < count; i++) {
    const lp = V((Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.5 - 0.1, -1.15);
    const vel = f.forward.clone().multiplyScalar(9 + Math.random() * 5).addScaledVector(f.right, (Math.random() - 0.5) * 4).addScaledVector(f.up, (Math.random() - 0.5) * 4);
    particles.push(makeParticle(scene, toWorld(camera, lp), vel, i % 2 ? 0xa5f3fc : 0x22d3ee, 0.04, 2.2, 3.2));
  }

  const light = addLight(scene, col, f.origin.clone().addScaledVector(f.forward, 1.4), step >= 3 ? 7 : 5, 13);
  return {
    group,
    particles,
    light,
    lifetime: step >= 3 ? 0.38 : 0.3,
    direction: f.forward.clone(),
    forwardSpeed: step >= 3 ? 2.6 : 1.6,
    expansionRate: step >= 3 ? 0.4 : 0.22,
    onUpdate: () => {
      // 電撃のちらつき
      group.children.forEach((ch) => {
        if ((ch as THREE.Line).isLine) ch.visible = Math.random() > 0.25;
      });
    },
  };
}

/* -------------------------------------------------------------------------- */
/*  CHAINSAW — 振り下ろしの赤い斬痕 / RIPPER RUSH の突進ライン と火花               */
/* -------------------------------------------------------------------------- */

function buildChainsaw(c: MeleeFxContext): MeleeFxResult {
  const { camera, scene, step } = c;
  const group = camGroup(camera);
  const col = new THREE.Color(c.color);
  const hot = new THREE.Color(0xfde68a);
  const particles: MeleeFxParticle[] = [];
  const f = camFrame(camera);

  if (step === 4) {
    // RIPPER RUSH: 前方へ伸びる赤い突進ラインと、両脇へ吹き出す火花
    [-0.32, 0.32].forEach((x, i) => {
      const pts = pathFromFn((t) => V(x * (1 - t * 0.6), -0.32 + 0.08 * Math.sin(t * Math.PI), -0.6 - t * 6.5), 32, () => V(0, 1, 0));
      group.add(buildRibbon(pts, { width: 0.26, taper: 0.3, outer: i ? col : scaleColor(col, 0.7), core: hot, coreScale: 0.25 }));
    });
    for (let i = 0; i < 30; i++) {
      const side = i % 2 ? 1 : -1;
      const local = V(side * (0.15 + Math.random() * 0.2), -0.35, -0.9 - Math.random() * 1.5);
      const vel = f.right.clone().multiplyScalar(side * (3 + Math.random() * 4)).add(V(0, 1.5 + Math.random() * 2.5, 0)).addScaledVector(f.forward, 4);
      particles.push(makeParticle(scene, toWorld(camera, local), vel, i % 3 ? 0xfbbf24 : 0xef4444, 0.018 + Math.random() * 0.014, 9, 2.4));
    }
    const light = addLight(scene, col, f.origin.clone().addScaledVector(f.forward, 2), 6, 14);
    return { group, particles, light, lifetime: 0.45, direction: f.forward.clone(), forwardSpeed: 3.5, expansionRate: 0.05 };
  }

  // RAVAGE DROP: 頭上から前下方へ叩きつける縦の斬痕（刃のギザギザを模した鋸歯の縁）
  const pts = pathFromFn(
    (t) => {
      const a = THREE.MathUtils.lerp(-1.2, 0.9, t);
      return V(0.28, Math.sin(-a) * 0.8 - 0.25, -1.6 - Math.cos(a) * 1.1);
    },
    48,
    () => V(1, 0, 0.2)
  );
  group.add(buildRibbon(pts, { width: 0.42, taper: 0.5, outer: col, core: hot, coreScale: 0.28 }));
  const teeth = new THREE.Group();
  for (let i = 4; i < pts.length - 2; i += 4) {
    const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.07, 3), addMat(i % 2 ? hot : col, 0.95));
    tooth.position.copy(pts[i].p);
    tooth.lookAt(pts[i].p.clone().add(V(0, 0, 1)));
    teeth.add(tooth);
  }
  group.add(teeth);
  // 着地点から火花が噴き出す
  const impact = pts[pts.length - 6].p;
  for (let i = 0; i < 26; i++) {
    // 奥と左右へ飛ばす（手前に飛ぶとカメラ直前で巨大な玉に見える）
    const vel = V((Math.random() - 0.5) * 6, 1.5 + Math.random() * 3.5, -1 - Math.random() * 3).applyQuaternion(camera.quaternion);
    particles.push(makeParticle(scene, toWorld(camera, impact), vel, i % 3 ? 0xfbbf24 : 0xef4444, 0.018 + Math.random() * 0.016, 10, 2.6));
  }
  const light = addLight(scene, col, toWorld(camera, impact), 5.5, 12);
  return {
    group,
    particles,
    light,
    lifetime: 0.28,
    direction: f.forward.clone(),
    forwardSpeed: 0.4,
    expansionRate: 0.04,
    onUpdate: (p) => {
      teeth.position.y = -p * 0.1;
    },
  };
}

/* -------------------------------------------------------------------------- */
/*  TWIN BLADE (ASTRO-ZWILL) — 星屑を引く二筋の斬光。フィニッシュは十字             */
/* -------------------------------------------------------------------------- */

function buildTwinBlade(c: MeleeFxContext): MeleeFxResult {
  const { camera, scene, step } = c;
  const group = camGroup(camera);
  const col = new THREE.Color(c.color);
  const particles: MeleeFxParticle[] = [];
  const bright = new THREE.Color(0xfce7f3);
  const f = camFrame(camera);

  const streak = (pts: RibbonPoint[], w: number, core: THREE.ColorRepresentation = bright) =>
    group.add(buildRibbon(pts, { width: w, taper: 0.3, front: 0.5, back: 0.5, outer: col, core, coreScale: 0.3, trail: false }));

  let sparkPts: RibbonPoint[];
  if (step === 1) {
    // 右上から左下への袈裟斬り
    sparkPts = pathFromFn((t) => V(1.0 - 2.0 * t, 0.55 - 0.95 * t + 0.1 * Math.sin(t * Math.PI), -1.2), 40);
    streak(sparkPts, 0.26);
  } else if (step === 2) {
    // 左上から右下への返し袈裟
    sparkPts = pathFromFn((t) => V(-1.0 + 2.0 * t, 0.55 - 0.95 * t + 0.1 * Math.sin(t * Math.PI), -1.2), 40);
    streak(sparkPts, 0.26);
  } else if (step === 3) {
    // 十字斬り：二本の斬光が中央で交差し、星の輝きと床の衝撃波が走る
    sparkPts = pathFromFn((t) => V(-0.95 + 1.9 * t, 0.85 - 1.7 * t, -1.2), 36);
    streak(sparkPts, 0.3);
    streak(pathFromFn((t) => V(0.95 - 1.9 * t, 0.85 - 1.7 * t, -1.2), 36), 0.3);
    const star = glint(1.3, bright);
    star.position.set(0, 0, -1.15);
    group.add(star);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.5, 40), addMat(col, 0.9));
    ring.position.set(0, 0, -1.3);
    group.add(ring);
    const floor = new THREE.Mesh(new THREE.RingGeometry(1.3, 1.5, 48), addMat(col, 0.8));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, -1.1, -1.5);
    group.add(floor);
  } else {
    // 双刃旋風：二重の円環
    const ring = (r: number, y: number, w: number) =>
      group.add(
        buildRibbon(
          pathFromFn((t) => {
            const a = -Math.PI + t * TAU;
            return V(Math.sin(a) * r, y, -Math.cos(a) * r);
          }, 64, () => V(0, 1, 0)),
          { width: w, taper: 0.2, front: 0.5, back: 0.5, outer: col, core: bright, coreScale: 0.35, trail: false }
        )
      );
    ring(1.5, -0.1, 0.3);
    ring(1.15, 0.12, 0.2);
    sparkPts = pathFromFn((t) => V(Math.sin(-Math.PI + t * TAU) * 1.5, -0.1, -Math.cos(-Math.PI + t * TAU) * 1.5), 30);
  }

  // 星屑（斬光に沿って散る小さな光の粒）
  const count = step >= 3 ? 26 : 16;
  for (let i = 0; i < count; i++) {
    const idx = Math.floor(THREE.MathUtils.lerp(2, sparkPts.length - 3, i / count));
    const pt = sparkPts[idx].p;
    const vel = V((Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3 + 0.8, -Math.random() * 3).applyQuaternion(camera.quaternion);
    particles.push(makeParticle(scene, toWorld(camera, pt), vel, i % 3 === 0 ? 0xffffff : i % 2 ? 0xf9a8d4 : 0xc4b5fd, 0.03 + Math.random() * 0.025, 0.4, 2.8, i % 4 === 0));
  }

  const light = addLight(scene, col, f.origin.clone().addScaledVector(f.forward, 1.3), 4.4, 11);
  return { group, particles, light, lifetime: step >= 3 ? 0.3 : 0.24, direction: f.forward.clone(), forwardSpeed: step === 4 ? 0 : 1.6, expansionRate: 0.08 };
}

/* -------------------------------------------------------------------------- */
/*  GLACIEL (RAPIER) — 一直線の突きの光条 + 霜の結晶                              */
/* -------------------------------------------------------------------------- */

function buildRapier(c: MeleeFxContext): MeleeFxResult {
  const { camera, scene, step } = c;
  const group = camGroup(camera);
  const col = new THREE.Color(c.color);
  const ice = new THREE.Color(0xe0f2fe);
  const particles: MeleeFxParticle[] = [];
  const f = camFrame(camera);
  const reach = Math.min(c.range, 6.5);

  const thrust = (x0: number, y0: number, x1: number, y1: number, w: number) => {
    const pts = pathFromFn((t) => V(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, -0.55 - t * reach), 24, () => V(0, 1, 0.05));
    group.add(buildRibbon(pts, { width: w, taper: 0.25, front: 0.5, back: 0.5, outer: col, core: ice, coreScale: 0.35, trail: false }));
    // the point: a tiny frost burst at the end of the thrust
    const tip = glint(0.38, ice);
    tip.position.set(x1, y1, -0.55 - reach);
    group.add(tip);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.08, 0.22, 6), addMat(ice, 0.9));
    ring.position.copy(tip.position);
    group.add(ring);
  };
  if (step === 1) thrust(0.14, -0.1, 0.02, -0.04, 0.09);
  else if (step === 2) thrust(0.12, -0.22, 0.0, 0.0, 0.09);
  else if (step === 3) {
    thrust(0.16, -0.06, 0.06, 0.02, 0.07);
    thrust(0.1, -0.02, -0.04, 0.1, 0.07);
    thrust(0.12, -0.14, 0.0, -0.08, 0.1);
  } else {
    const pts = pathFromFn((t) => {
      const a = -Math.PI + t * TAU;
      return V(Math.sin(a) * 1.6, -0.25, -Math.cos(a) * 1.6);
    }, 64, () => V(0, 1, 0));
    group.add(buildRibbon(pts, { width: 0.26, taper: 0.25, front: 0.5, back: 0.5, outer: col, core: ice, coreScale: 0.3, trail: false }));
  }
  // frost shards drifting off the thrust line
  const n = step === 3 ? 30 : 18;
  for (let i = 0; i < n; i++) {
    const t = Math.random();
    const lp = V((Math.random() - 0.5) * 0.25, -0.05 + (Math.random() - 0.5) * 0.2, -0.6 - t * reach);
    const vel = V((Math.random() - 0.5) * 2.4, 0.4 + Math.random() * 1.6, (Math.random() - 0.5) * 2).applyQuaternion(camera.quaternion);
    particles.push(makeParticle(scene, toWorld(camera, lp), vel, i % 3 === 0 ? 0xffffff : i % 2 ? 0xbae6fd : col, 0.025 + Math.random() * 0.02, 1.5, 2.2, i % 2 === 0));
  }
  const light = addLight(scene, col, f.origin.clone().addScaledVector(f.forward, 2), 4.2, 12);
  return { group, particles, light, lifetime: step === 3 ? 0.3 : 0.24, direction: f.forward.clone(), forwardSpeed: 2.2, expansionRate: 0.05 };
}

/* -------------------------------------------------------------------------- */
/*  VIPERCOIL (WHIP) — 雷鳴の鞭打ち。先端の破裂音と放電                           */
/* -------------------------------------------------------------------------- */

function buildWhip(c: MeleeFxContext): MeleeFxResult {
  const { camera, scene, step } = c;
  const group = camGroup(camera);
  const col = new THREE.Color(c.color);
  const bright = new THREE.Color(0xf7fee7);
  const particles: MeleeFxParticle[] = [];
  const f = camFrame(camera);
  const L = Math.min(c.range, 10);
  const bolts: THREE.Line[] = [];
  const crack = (tip: THREE.Vector3) => {
    const g = glint(0.9, bright);
    g.position.copy(tip);
    group.add(g);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.12, 0.42, 20), addMat(col, 0.9));
    ring.position.copy(tip);
    group.add(ring);
    for (let i = 0; i < 5; i++) {
      const to = tip.clone().add(V((Math.random() - 0.5) * 1.4, (Math.random() - 0.5) * 1.0, (Math.random() - 0.5) * 1.4));
      const ln = lightningLine(tip, to, 5, 0.25, i % 2 ? bright : col);
      group.add(ln);
      bolts.push(ln);
    }
    for (let i = 0; i < 16; i++) {
      const vel = V((Math.random() - 0.5) * 6, (Math.random() - 0.2) * 5, (Math.random() - 0.5) * 6).applyQuaternion(camera.quaternion);
      particles.push(makeParticle(scene, toWorld(camera, tip), vel, i % 2 ? 0xd9f99d : 0xffffff, 0.025, 4, 3.2));
    }
  };
  if (step === 1 || step === 3) {
    // straight crack out to the tip, a travelling lightning thread along the whip line
    const tip = V(0, -0.35, -0.6 - L);
    const pts = pathFromFn((t) => V(0.15 * (1 - t), -0.15 - 0.2 * t + Math.sin(t * Math.PI * 3) * 0.06 * (1 - t), -0.6 - t * L), 40, () => V(1, 0, 0));
    group.add(buildRibbon(pts, { width: 0.06, taper: 0.2, front: 0.5, back: 0.5, outer: col, core: bright, coreScale: 0.4, trail: false }));
    const thread = lightningLine(V(0.15, -0.15, -0.6), tip, 18, 0.18, bright);
    group.add(thread);
    bolts.push(thread);
    crack(tip);
    if (step === 3) {
      // snare: a coil of light wrapping the target
      const coil = pathFromFn((t) => {
        const a = t * TAU * 2.5;
        return V(Math.cos(a) * 0.55, -0.3 + (t - 0.5) * 0.9, -0.6 - L + Math.sin(a) * 0.55);
      }, 60, () => V(0, 1, 0));
      group.add(buildRibbon(coil, { width: 0.07, taper: 0.15, front: 0.5, back: 0.5, outer: col, core: bright, coreScale: 0.4, trail: false }));
    }
  } else if (step === 2) {
    // wide lash: right → left fan at waist height
    const pts = pathFromFn(
      (t) => {
        const a = THREE.MathUtils.lerp(0.95, -0.95, t);
        return V(Math.sin(a) * L * 0.75, -0.3 + 0.1 * Math.sin(t * Math.PI), -0.4 - Math.cos(a) * L * 0.75);
      },
      56,
      () => V(0, 1, 0.1)
    );
    group.add(buildRibbon(pts, { width: 0.3, taper: 0.4, outer: col, core: bright, coreScale: 0.25 }));
    crack(pts[pts.length - 4].p.clone());
  } else {
    const pts = pathFromFn((t) => {
      const a = -Math.PI + t * TAU;
      return V(Math.sin(a) * 3.2, 0.4, -Math.cos(a) * 3.2);
    }, 72, () => V(0, 1, 0));
    group.add(buildRibbon(pts, { width: 0.25, taper: 0.2, front: 0.5, back: 0.5, outer: col, core: bright, coreScale: 0.35, trail: false }));
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      const p0 = V(Math.sin(a) * 3.2, 0.4, -Math.cos(a) * 3.2);
      const ln = lightningLine(p0, p0.clone().add(V(0, -1.8, 0)), 6, 0.3, i % 2 ? bright : col);
      group.add(ln);
      bolts.push(ln);
    }
  }
  const light = addLight(scene, col, f.origin.clone().addScaledVector(f.forward, 3), 5.2, 16);
  return {
    group,
    particles,
    light,
    lifetime: 0.3,
    onUpdate: () => {
      bolts.forEach((b) => (b.visible = Math.random() > 0.3));
    },
  };
}

/* -------------------------------------------------------------------------- */
/*  ORBITAL RONDO (CHAKRAM) — 放った瞬間の円弧（刃そのものは arsenal が飛ばす）      */
/* -------------------------------------------------------------------------- */

function buildDisc(c: MeleeFxContext): MeleeFxResult {
  const { camera, scene, step } = c;
  const group = camGroup(camera);
  const col = new THREE.Color(c.color);
  const bright = new THREE.Color(0xfef3c7);
  const particles: MeleeFxParticle[] = [];
  const f = camFrame(camera);
  const arc = (dir: number, y: number) => {
    const pts = pathFromFn((t) => {
      const a = THREE.MathUtils.lerp(0.9 * dir, -0.4 * dir, t);
      return V(Math.sin(a) * 1.1, y, -0.5 - Math.cos(a) * 1.1);
    }, 40, () => V(0, 1, 0.2));
    group.add(buildRibbon(pts, { width: 0.22, taper: 0.35, outer: col, core: bright, coreScale: 0.3, trail: false }));
  };
  if (step === 1) arc(1, -0.1);
  else if (step === 2) arc(-1, -0.05);
  else if (step === 3) {
    arc(1, 0.05);
    arc(-1, -0.15);
  } else {
    const pts = pathFromFn((t) => {
      const a = -Math.PI + t * TAU;
      return V(Math.sin(a) * 2.4, -0.15, -Math.cos(a) * 2.4);
    }, 72, () => V(0, 1, 0));
    group.add(buildRibbon(pts, { width: 0.3, taper: 0.2, front: 0.5, back: 0.5, outer: col, core: bright, coreScale: 0.35, trail: false }));
  }
  for (let i = 0; i < 14; i++) {
    const vel = V((Math.random() - 0.5) * 4, (Math.random() - 0.2) * 3, -2 - Math.random() * 4).applyQuaternion(camera.quaternion);
    particles.push(makeParticle(scene, toWorld(camera, V((Math.random() - 0.5) * 0.6, -0.1, -0.9)), vel, i % 2 ? 0xfde68a : col, 0.025, 2, 3));
  }
  const light = addLight(scene, col, f.origin.clone().addScaledVector(f.forward, 1.4), 3.6, 10);
  return { group, particles, light, lifetime: 0.24, direction: f.forward.clone(), forwardSpeed: 1.2 };
}

/* -------------------------------------------------------------------------- */
/*  Public: swing effect                                                       */
/* -------------------------------------------------------------------------- */

/**
 * 武器固有の斬撃/打撃エフェクトを生成。固有表現のない武器(lance/generic)は null を返し、
 * 呼び出し側が従来のエフェクトにフォールバックします。
 * 生成された group / particles / light はすでに scene に追加済みです（group がカメラ空間の場合は呼び出し側不要）。
 */
export function buildMeleeSwingFx(c: MeleeFxContext): MeleeFxResult | null {
  let res: MeleeFxResult | null = null;
  switch (c.style) {
    case 'katana':
      res = buildKatana(c);
      break;
    case 'glaive':
      res = buildGlaive(c);
      break;
    case 'dagger':
      res = buildDagger(c);
      break;
    case 'chainspear':
      res = buildChainSpear(c);
      break;
    case 'scythe':
      res = buildScythe(c);
      break;
    case 'hammer':
      res = buildHammer(c);
      break;
    case 'gauntlets':
      res = buildGauntlets(c);
      break;
    case 'twinblade':
      res = buildTwinBlade(c);
      break;
    case 'chainsaw':
      res = buildChainsaw(c);
      break;
    case 'anchor':
      res = buildAnchor(c);
      break;
    case 'rapier':
      res = buildRapier(c);
      break;
    case 'whip':
      res = buildWhip(c);
      break;
    case 'disc':
      res = buildDisc(c);
      break;
    default:
      res = null;
  }
  if (res) addSwingPolish(c, res);
  if (res && !res.group.parent) c.scene.add(res.group);
  return res;
}

/* -------------------------------------------------------------------------- */
/*  共通ポリッシュ層: 全INFIGHT武器の通常攻撃に重ねる「高品質な見た目」            */
/* -------------------------------------------------------------------------- */

const POLISH_TINT: Record<MeleeStyle, number> = {
  katana: 0xbae6fd,
  glaive: 0xfdba74,
  dagger: 0xe9d5ff,
  chainspear: 0xfde68a,
  scythe: 0xd8b4fe,
  hammer: 0xfed7aa,
  gauntlets: 0xa5f3fc,
  twinblade: 0xfbcfe8,
  lance: 0xa5f3fc,
  chainsaw: 0xfde68a,
  anchor: 0x99f6e4,
  rapier: 0xe0f2fe,
  whip: 0xd9f99d,
  disc: 0xfde68a,
  generic: 0xffffff,
};

/**
 * 斬撃の最中に画面へ重なる共通演出:
 *   - 画面周辺へ流れる集中線（スピード感）
 *   - 振り抜きの瞬間に広がる衝撃リング（空気の破裂）
 *   - 刃の軌跡から散る二色の火花（細い白 + 属性色の破片）
 * 終端段（3段目以降）ほど大きく・派手になる。
 */
function addSwingPolish(c: MeleeFxContext, res: MeleeFxResult): void {
  const { camera, scene, step, style } = c;
  // 重い武器は既存の専用演出が十分に大きいので控えめにする
  const heavy = style === 'hammer' || style === 'anchor';
  const finisher = step >= 3;
  const tint = POLISH_TINT[style] ?? 0xffffff;
  const col = new THREE.Color(c.color);

  // 集中線: カメラ空間の放射状ストリーク（hammer / anchor のグループはワールド空間なので対象外）
  const lineCount = heavy ? 0 : finisher ? 18 : 12;
  const lines = new THREE.Group();
  for (let i = 0; i < lineCount; i++) {
    const a = (i / lineCount) * TAU + Math.random() * 0.25;
    const r0 = 0.85 + Math.random() * 0.35;
    const len = (finisher ? 0.55 : 0.38) + Math.random() * 0.35;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.012 + Math.random() * 0.012), addMat(i % 3 === 0 ? tint : col, 0.8));
    m.position.set(Math.cos(a) * (r0 + len / 2), Math.sin(a) * (r0 + len / 2) * 0.7, -1.6);
    m.rotation.z = a;
    lines.add(m);
  }
  res.group.add(lines);

  // 空気の破裂リング（振り抜き点）。多重にして厚みを出す
  const ringZ = style === 'gauntlets' || style === 'lance' || style === 'chainspear' ? -2.2 : -1.7;
  for (let i = 0; i < (heavy ? 0 : finisher ? 2 : 1); i++) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.42 + i * 0.12, 0.47 + i * 0.12, 40), addMat(i === 0 ? tint : col, 0.75));
    ring.position.set(0, -0.05, ringZ - i * 0.08);
    res.group.add(ring);
  }

  // 二色火花: 細い白と属性色の欠片
  const f = camFrame(camera);
  const n = heavy ? 8 : finisher ? 22 : 12;
  for (let i = 0; i < n; i++) {
    const local = V((Math.random() - 0.5) * 2.0, (Math.random() - 0.5) * 1.2, -1.2 - Math.random() * 0.6);
    const dirLocal = V((Math.random() - 0.5) * 2, (Math.random() - 0.3) * 1.4, -0.4).normalize().multiplyScalar(4 + Math.random() * 6);
    const vel = dirLocal.applyQuaternion(camera.quaternion).addScaledVector(f.forward, 1.5);
    const box = i % 3 === 0;
    res.particles.push(makeParticle(scene, toWorld(camera, local), vel, i % 2 ? tint : col, box ? 0.03 : 0.018, 5 + Math.random() * 3, 3.0, box));
  }
  res.lifetime = Math.max(res.lifetime, finisher ? 0.38 : 0.3);

  // 斬光の描画アニメーション: 振り抜く向きに走って描かれ、尾から溶けて消える
  const quick = style === 'dagger' || style === 'twinblade' || style === 'katana';
  const reveal = quick ? 0.22 : heavy ? 0.36 : 0.3;
  const erase = quick ? 0.32 : 0.42;
  const prev = res.onUpdate;
  res.onUpdate = (p, d) => {
    animateRibbons(res.group, p, reveal, erase);
    prev?.(p, d);
  };
}

/* -------------------------------------------------------------------------- */
/*  Public: hit-impact effect (敵に当たった瞬間の武器別エフェクト)               */
/* -------------------------------------------------------------------------- */

export function buildMeleeHitFx(
  style: MeleeStyle,
  pos: THREE.Vector3,
  step: number,
  color: string,
  scene: THREE.Scene,
  camera: THREE.Camera
): MeleeFxResult | null {
  const group = new THREE.Group();
  group.position.copy(pos);
  const col = new THREE.Color(color);
  const particles: MeleeFxParticle[] = [];
  let lifetime = 0.3;
  let onUpdate: ((p: number, d: number) => void) | undefined;

  const world = (x = 0, y = 0, z = 0) => pos.clone().add(V(x, y, z));

  switch (style) {
    case 'katana': {
      // 交差する細い斬痕
      const mk = (ang: number, len: number) => {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.045), addMat(0xe0f2fe, 1));
        m.rotation.z = ang;
        group.add(m);
      };
      mk(0.6 + Math.random() * 0.4, 1.6);
      if (step >= 2) mk(-0.7 - Math.random() * 0.3, 1.3);
      if (step >= 3) mk(Math.PI / 2 + (Math.random() - 0.5) * 0.3, 2.0);
      const g = glint(0.55, 0xe0f2fe);
      group.add(g);
      group.quaternion.copy(camera.quaternion); // 常にプレイヤーの視界に正対
      onUpdate = (p) => {
        group.scale.set(1 + p * 0.5, 1 + p * 0.1, 1);
      };
      lifetime = 0.2;
      break;
    }
    case 'glaive': {
      // 熱の爆ぜ（火の粉と衝撃リング）
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.5, 24), addMat(0xffa65c, 0.9));
      ring.rotation.x = -Math.PI / 2;
      group.add(ring);
      onUpdate = (p) => {
        const s = 1 + p * 4;
        ring.scale.set(s, s, s);
      };
      for (let i = 0; i < 18; i++) {
        const vel = V((Math.random() - 0.5) * 5, 2 + Math.random() * 5, (Math.random() - 0.5) * 5);
        particles.push(makeParticle(scene, world(0, 0.1, 0), vel, i % 2 ? 0xffd08a : 0xff6a2d, 0.05, -1.0, 1.8));
      }
      lifetime = 0.45;
      break;
    }
    case 'dagger': {
      // 位相グリッチ：ずれた十字と立方体
      const a = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.04), addMat(0xe9d5ff, 1));
      const b = new THREE.Mesh(new THREE.PlaneGeometry(0.04, 1.0), addMat(col, 1));
      group.add(a, b);
      group.quaternion.copy(camera.quaternion);
      for (let i = 0; i < 12; i++) {
        const vel = V((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6);
        particles.push(makeParticle(scene, world(), vel, i % 2 ? 0xc084fc : 0xf5d0fe, 0.05, 0, 3.4, true));
      }
      onUpdate = (p) => {
        a.position.x = (Math.random() - 0.5) * 0.12 * (1 - p);
        b.position.y = (Math.random() - 0.5) * 0.12 * (1 - p);
      };
      lifetime = 0.22;
      break;
    }
    case 'scythe': {
      // 紫の魂が螺旋状に立ち昇る
      for (let i = 0; i < 16; i++) {
        const ang = (i / 16) * TAU;
        const vel = V(Math.cos(ang) * 1.6, 2.2 + Math.random() * 2.2, Math.sin(ang) * 1.6);
        particles.push(makeParticle(scene, world(Math.cos(ang) * 0.3, 0.1, Math.sin(ang) * 0.3), vel, i % 2 ? 0xd8b4fe : 0xa855f7, 0.055, -0.8, 1.4));
      }
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.025, 6, 24), addMat(col, 0.9));
      ring.rotation.x = Math.PI / 2;
      group.add(ring);
      onUpdate = (p) => {
        const s = 1 + p * 2.2;
        ring.scale.set(s, s, s);
        ring.position.y = p * 1.2;
      };
      lifetime = 0.5;
      break;
    }
    case 'hammer': {
      // 敵の足元に押し潰されるような衝撃波
      const ring = floorRing(0.5, 0.7, 0xffe0b2, 0.9);
      ring.position.y = 0.05 - pos.y;
      group.add(ring);
      onUpdate = (p) => {
        const s = 1 + p * 3.5;
        ring.scale.set(s, s, s);
      };
      for (let i = 0; i < 14; i++) {
        const ang = Math.random() * TAU;
        const vel = V(Math.cos(ang) * 3, 2 + Math.random() * 3, Math.sin(ang) * 3);
        particles.push(makeParticle(scene, world(0, -pos.y + 0.1, 0), vel, 0xd6a77a, 0.07, 12, 1.4, true));
      }
      lifetime = 0.4;
      break;
    }
    case 'gauntlets': {
      // 敵の体表を走る電撃
      for (let i = 0; i < 5; i++) {
        const to = V((Math.random() - 0.5) * 1.6, (Math.random() - 0.5) * 1.6, (Math.random() - 0.5) * 1.6);
        group.add(lightningLine(V(0, 0, 0), to, 5, 0.3, i % 2 ? 0xcffafe : col));
      }
      onUpdate = () => {
        group.children.forEach((ch) => {
          ch.visible = Math.random() > 0.3;
        });
      };
      lifetime = 0.25;
      break;
    }
    case 'twinblade': {
      // 交差する斬痕と星屑の弾け
      const mk = (ang: number, len: number) => {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.05), addMat(0xfce7f3, 1));
        m.rotation.z = ang;
        group.add(m);
      };
      mk(Math.PI / 4, 1.5);
      mk(-Math.PI / 4, 1.5);
      if (step >= 3) mk(0, 1.1);
      group.add(glint(0.5, col));
      group.quaternion.copy(camera.quaternion);
      for (let i = 0; i < 10; i++) {
        const vel = V((Math.random() - 0.5) * 5, (Math.random() - 0.5) * 5 + 1, (Math.random() - 0.5) * 5);
        particles.push(makeParticle(scene, world(), vel, i % 2 ? 0xf9a8d4 : 0xc4b5fd, 0.04, 0, 3.2));
      }
      onUpdate = (p) => {
        group.scale.set(1 + p * 0.6, 1 + p * 0.6, 1);
      };
      lifetime = 0.22;
      break;
    }
    case 'anchor': {
      // 係留: 足元に広がる波紋と、飛び散る水滴
      const ring = floorRing(0.4, 0.55, 0x99f6e4, 0.9);
      ring.position.y = 0.06 - pos.y;
      group.add(ring);
      onUpdate = (p) => {
        const sc = 1 + p * (step >= 3 ? 3.2 : 2.0);
        ring.scale.set(sc, sc, sc);
      };
      for (let i = 0; i < (step >= 3 ? 14 : 8); i++) {
        const ang = Math.random() * TAU;
        const vel = V(Math.cos(ang) * 2.5, 2 + Math.random() * 3.5, Math.sin(ang) * 2.5);
        particles.push(makeParticle(scene, world(), vel, i % 2 ? 0x99f6e4 : 0xe0f2fe, 0.045, 9, 1.6));
      }
      lifetime = step >= 3 ? 0.45 : 0.3;
      break;
    }
    case 'chainsaw': {
      // 削り: 火花が扇状に噴き出し、赤熱した装甲片が飛び散る（超高頻度で出るので軽量に）
      const flash = glint(0.4 + Math.random() * 0.2, 0xfde68a);
      flash.rotation.z = Math.random() * Math.PI;
      group.add(flash);
      group.quaternion.copy(camera.quaternion);
      const right = V(1, 0, 0).applyQuaternion(camera.quaternion);
      const side = Math.random() < 0.5 ? -1 : 1;
      for (let i = 0; i < 7; i++) {
        const vel = right.clone().multiplyScalar(side * (2 + Math.random() * 4)).add(V((Math.random() - 0.5) * 2, 1.5 + Math.random() * 3, (Math.random() - 0.5) * 2));
        particles.push(makeParticle(scene, world(), vel, i % 2 ? 0xfbbf24 : 0xfde68a, 0.022, 12, 3.2));
      }
      for (let i = 0; i < (step >= 3 ? 5 : 2); i++) {
        const vel = V((Math.random() - 0.5) * 4, 1 + Math.random() * 3, (Math.random() - 0.5) * 4);
        particles.push(makeParticle(scene, world(), vel, 0xef4444, 0.035, 10, 2.2, true));
      }
      onUpdate = (p) => {
        flash.scale.setScalar(1 - p * 0.6);
      };
      lifetime = 0.14;
      break;
    }
    case 'rapier': {
      // 霜の破砕: 透き通った氷片が弾け、足元に霜の輪が広がる
      const ring = floorRing(0.25, 0.42, 0xe0f2fe, 0.85);
      ring.position.y = 0.06 - pos.y;
      group.add(ring);
      for (let i = 0; i < (step >= 3 ? 16 : 9); i++) {
        const vel = V((Math.random() - 0.5) * 5, 1 + Math.random() * 4, (Math.random() - 0.5) * 5);
        particles.push(makeParticle(scene, world(), vel, i % 2 ? 0xe0f2fe : 0x7dd3fc, 0.035 + Math.random() * 0.03, 9, 2.2, true));
      }
      const g = glint(0.5, 0xffffff);
      g.quaternion.copy(camera.quaternion);
      group.add(g);
      onUpdate = (p) => {
        const sc = 1 + p * 3;
        ring.scale.set(sc, sc, sc);
        g.scale.setScalar(1 - p * 0.7);
      };
      lifetime = 0.32;
      break;
    }
    case 'whip': {
      // 雷鳴: 敵の体を走る放電と破裂の閃光
      for (let i = 0; i < 6; i++) {
        const to = V((Math.random() - 0.5) * 1.8, (Math.random() - 0.5) * 1.8, (Math.random() - 0.5) * 1.8);
        group.add(lightningLine(V(0, 0, 0), to, 5, 0.3, i % 2 ? 0xf7fee7 : col));
      }
      const g = glint(0.7, 0xf7fee7);
      g.quaternion.copy(camera.quaternion);
      group.add(g);
      onUpdate = () => {
        group.children.forEach((ch) => {
          if ((ch as THREE.Line).isLine) ch.visible = Math.random() > 0.3;
        });
      };
      lifetime = 0.24;
      break;
    }
    case 'disc': {
      // 円月輪の切り抜け: 回転する金色の斬痕
      const ringM = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.42, 36, 1, 0, Math.PI * 1.5), addMat(0xfde68a, 0.95));
      ringM.quaternion.copy(camera.quaternion);
      group.add(ringM);
      for (let i = 0; i < 10; i++) {
        const vel = V((Math.random() - 0.5) * 5, (Math.random() - 0.3) * 4, (Math.random() - 0.5) * 5);
        particles.push(makeParticle(scene, world(), vel, i % 2 ? 0xfde68a : col, 0.03, 6, 3));
      }
      onUpdate = (p) => {
        ringM.rotateZ(0.6);
        ringM.scale.setScalar(1 + p * 1.6);
      };
      lifetime = 0.22;
      break;
    }
    default:
      return null;
  }

  addHitPolish(group, particles, pos, step, color, style, scene, camera);

  // ヒットエフェクトは PointLight を追加しない（ライト数の増減によるシェーダ再コンパイルのヒッチ防止）
  scene.add(group);
  return { group, particles, lifetime, onUpdate };
}

/**
 * 全武器共通のヒット演出: 先の尖った放射状スパーク（衝撃の星）+ 属性色の破片。
 * 星はカメラに正対し、段が上がるほど枚数・長さが増す。
 */
function addHitPolish(
  group: THREE.Group,
  particles: MeleeFxParticle[],
  pos: THREE.Vector3,
  step: number,
  color: string,
  style: MeleeStyle,
  scene: THREE.Scene,
  camera: THREE.Camera
): void {
  if (style === 'chainsaw') return; // 超高頻度で出るため軽量のまま
  const col = new THREE.Color(color);
  const tint = POLISH_TINT[style] ?? 0xffffff;
  const rays = 5 + step * 2;
  const star = new THREE.Group();
  for (let i = 0; i < rays; i++) {
    const a = (i / rays) * TAU + Math.random() * 0.3;
    const len = (0.55 + Math.random() * 0.7) * (0.8 + step * 0.18);
    // 根元が太く先が細い放射スパイク（三角形）
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([0, -0.03, 0, 0, 0.03, 0, len, 0, 0], 3));
    const m = new THREE.Mesh(g, addMat(i % 2 ? tint : col, 0.95));
    m.rotation.z = a;
    star.add(m);
  }
  star.quaternion.copy(camera.quaternion);
  group.add(star);
  // 破片: 地面側へ落ちる金属片と、細く速い火の筋
  for (let i = 0; i < 4 + step * 2; i++) {
    const vel = V((Math.random() - 0.5) * 6, 1.5 + Math.random() * 3.5, (Math.random() - 0.5) * 6);
    particles.push(makeParticle(scene, pos.clone(), vel, i % 2 ? tint : col, 0.024 + Math.random() * 0.02, 9, 2.6, i % 2 === 0));
  }
}

/* -------------------------------------------------------------------------- */
/*  GRAVITON MAUL — 溜め技 TITAN LEAP SLAM                                      */
/* -------------------------------------------------------------------------- */

/**
 * 溜め中に断続的に発生する重力収束エフェクト。
 * 足元から外側のリングが絞られ、粒子がハンマー側（前方上空）へ吸い込まれる。
 * p: 溜め進行度 0..1（進むほど大きく・密に）
 */
export function buildHammerChargeFx(camera: THREE.Camera, scene: THREE.Scene, color: string, p: number): MeleeFxResult {
  const f = camFrame(camera);
  const ff = flatForward(f.forward);
  const col = new THREE.Color(color);
  const bright = new THREE.Color(0xffe0b2);
  const group = new THREE.Group();
  const particles: MeleeFxParticle[] = [];
  const floorY = 0.07;
  const foot = V(camera.position.x, floorY, camera.position.z);

  const startR = 3.4 + p * 1.6;
  const ring = floorRing(0.9, 1.0, p >= 1 ? bright : col, 0.55 + p * 0.35);
  ring.position.copy(foot);
  group.add(ring);
  const ring2 = floorRing(0.94, 1.0, bright, 0.5);
  ring2.position.copy(foot).add(V(0, 0.01, 0));
  group.add(ring2);

  // 吸い込まれる砂塵・破片: 足元の円周上から中心（ハンマー直下）へ渦を巻いて収束
  const target = foot.clone().addScaledVector(ff, 0.9);
  const count = 6 + Math.round(p * 8);
  for (let i = 0; i < count; i++) {
    const a = Math.random() * TAU;
    const r = startR * (0.7 + Math.random() * 0.4);
    const from = V(foot.x + Math.cos(a) * r, floorY + Math.random() * 0.15, foot.z + Math.sin(a) * r);
    const dir = target.clone().sub(from);
    const dist = dir.length();
    dir.normalize();
    const swirl = V(-dir.z, 0, dir.x).multiplyScalar(2.2);
    const vel = dir.multiplyScalar(dist / 0.38).add(swirl).add(V(0, 1.6 + Math.random() * 2.2, 0));
    particles.push(makeParticle(scene, from, vel, i % 3 === 0 ? 0xffe0b2 : i % 3 === 1 ? col : 0xd6a77a, 0.03 + Math.random() * 0.04, -1.0, 2.2, i % 2 === 0));
  }

  scene.add(group);
  const lifetime = 0.4;
  return {
    group,
    particles,
    lifetime,
    onUpdate: (t) => {
      const e = 1 - Math.pow(1 - t, 2);
      const s = startR * (1 - e * 0.88);
      ring.scale.set(s, s, s);
      ring2.scale.set(s * 0.82, s * 0.82, s * 0.82);
    },
  };
}

/**
 * 叩きつけ着弾の大エフェクト（プレイヤー中心＝ダメージ判定半径と一致）。
 * 多重衝撃波リング / 重力ドーム / 放射状の亀裂と熱線 / 衝撃柱 / 砂塵と破片 / 閃光
 */
export function buildHammerSlamFx(camera: THREE.Camera, scene: THREE.Scene, color: string, radius: number): MeleeFxResult {
  const f = camFrame(camera);
  const ff = flatForward(f.forward);
  const col = new THREE.Color(color);
  const bright = new THREE.Color(0xfff1d6);
  const hot = new THREE.Color(0xff6a1a);
  const group = new THREE.Group();
  const particles: MeleeFxParticle[] = [];
  const floorY = 0.07;
  const center = V(camera.position.x, floorY, camera.position.z);
  const impact = center.clone().addScaledVector(ff, 2.6);
  const maxR = Math.max(5, radius);

  // 衝撃波リング: 白い先端リング + 色リング + 外側の薄い残響リング
  const rings: { m: THREE.Mesh; delay: number; speed: number }[] = [];
  const ringDefs: Array<[number, number, THREE.Color, number, number, number]> = [
    [0.86, 1.0, bright, 1.0, 0, 1.0],
    [0.7, 1.0, col, 0.85, 0.07, 0.92],
    [0.9, 1.0, hot, 0.7, 0.16, 0.8],
    [0.94, 1.0, col, 0.45, 0.28, 0.7],
  ];
  ringDefs.forEach(([i0, o0, c0, op, delay, spd], i) => {
    const r = floorRing(i0, o0, c0, op);
    r.position.set(center.x, floorY + i * 0.012, center.z);
    group.add(r);
    rings.push({ m: r, delay, speed: spd });
  });

  // 重力ドーム: 半球状のシェルが一瞬で広がって消える
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 14, 0, TAU, 0, Math.PI / 2), addMat(col, 0.38));
  dome.position.copy(center);
  group.add(dome);
  const domeInner = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 10, 0, TAU, 0, Math.PI / 2), addMat(bright, 0.3));
  domeInner.position.copy(center);
  group.add(domeInner);

  // 放射状の亀裂（中心→外周）。長短を混ぜ、枝分かれを付ける
  const crackCount = 18;
  for (let i = 0; i < crackCount; i++) {
    const ang = (i / crackCount) * TAU + (Math.random() - 0.5) * 0.25;
    const len = maxR * (i % 3 === 0 ? 0.95 : 0.5 + Math.random() * 0.35);
    const to = center.clone().add(V(Math.cos(ang) * len, 0.02, Math.sin(ang) * len));
    const line = lightningLine(center.clone().add(V(0, 0.02, 0)), to, 9, 0.55, i % 2 ? hot : bright);
    group.add(line);
    if (i % 3 === 0) {
      const bAng = ang + (Math.random() > 0.5 ? 0.35 : -0.35);
      const from = center.clone().lerp(to, 0.45 + Math.random() * 0.2);
      const bTo = from.clone().add(V(Math.cos(bAng) * len * 0.3, 0.02, Math.sin(bAng) * len * 0.3));
      group.add(lightningLine(from, bTo, 5, 0.4, col));
    }
  }

  // 中心の閃光と垂直の衝撃柱
  const flash = new THREE.Mesh(new THREE.SphereGeometry(0.9, 14, 12), addMat(bright, 1));
  flash.position.copy(center).add(V(0, 0.5, 0));
  group.add(flash);
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 1.7, 7.5, 18, 1, true), addMat(col, 0.65));
  pillar.position.copy(center).add(V(0, 3.75, 0));
  group.add(pillar);
  const pillarCore = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.7, 7.5, 12, 1, true), addMat(bright, 0.85));
  pillarCore.position.copy(pillar.position);
  group.add(pillarCore);

  // 破片（岩塊）: 上方向へ大きく打ち上げ、地面を割った感触を出す
  for (let i = 0; i < 46; i++) {
    const ang = Math.random() * TAU;
    const sp = 2.5 + Math.random() * 7;
    const vel = V(Math.cos(ang) * sp, 5 + Math.random() * 8, Math.sin(ang) * sp);
    particles.push(
      makeParticle(scene, center.clone().add(V(Math.cos(ang) * 0.6, 0.15, Math.sin(ang) * 0.6)), vel, i % 3 === 0 ? 0xffc08a : i % 3 === 1 ? 0xd6a77a : 0x8a7a6a, 0.07 + Math.random() * 0.12, 16, 0.9, true)
    );
  }
  // 火花（熱）
  for (let i = 0; i < 40; i++) {
    const ang = Math.random() * TAU;
    const sp = 4 + Math.random() * 9;
    particles.push(makeParticle(scene, center.clone().add(V(0, 0.2, 0)), V(Math.cos(ang) * sp, 2 + Math.random() * 6, Math.sin(ang) * sp), i % 2 ? hot : bright, 0.03 + Math.random() * 0.03, 10, 1.6));
  }
  // 砂塵の帯: 地面を這って外へ広がる
  for (let i = 0; i < 36; i++) {
    const ang = (i / 36) * TAU + Math.random() * 0.2;
    const sp = 6 + Math.random() * 5;
    particles.push(makeParticle(scene, center.clone().add(V(Math.cos(ang) * 0.8, 0.12, Math.sin(ang) * 0.8)), V(Math.cos(ang) * sp, 0.6 + Math.random() * 1.2, Math.sin(ang) * sp), 0xcdb598, 0.14 + Math.random() * 0.12, 1.5, 1.1));
  }

  scene.add(group);
  const light = addLight(scene, col, center.clone().add(V(0, 1.4, 0)), 12, 22);
  const lifetime = 0.95;
  return {
    group,
    particles,
    light,
    lifetime,
    onUpdate: (p) => {
      rings.forEach((r, i) => {
        const pp = Math.max(0, Math.min(1, (p - r.delay) / (1 - r.delay)));
        const s = 0.3 + maxR * r.speed * (1 - Math.pow(1 - pp, 3));
        r.m.scale.set(s, s, s);
        r.m.visible = p >= r.delay;
      });
      const dp = Math.min(1, p / 0.45);
      const ds = 0.6 + maxR * 0.75 * (1 - Math.pow(1 - dp, 3));
      dome.scale.set(ds, ds * 0.42, ds);
      domeInner.scale.set(ds * 0.86, ds * 0.36, ds * 0.86);
      dome.visible = domeInner.visible = p < 0.5;
      const fs = 1 + Math.min(1, p / 0.3) * 2.2;
      flash.scale.set(fs, fs * (1 - Math.min(1, p / 0.5) * 0.6), fs);
      pillar.scale.set(1 + p * 0.9, 1 + p * 0.25, 1 + p * 0.9);
      pillarCore.scale.set(1 - p * 0.5, 1 + p * 0.25, 1 - p * 0.5);
    },
  };
}


/* -------------------------------------------------------------------------- */
/*  ECHO BLADE — 溜め技 MUGEN IAI：斬撃波                                       */
/* -------------------------------------------------------------------------- */

export interface SlashWaveOpts {
  scene: THREE.Scene;
  /** 発射位置（ワールド）。高さはそのまま斬撃波の高さになる */
  origin: THREE.Vector3;
  /** 進行方向（水平の単位ベクトル） */
  dir: THREE.Vector3;
  color: string;
  /** 刃面の傾き（rad）。0 = 横一文字、±π/2 = 縦の斬り上げ/落とし */
  roll: number;
  /** 三日月の半幅（m）。当たり判定の横幅の目安にもなる */
  halfWidth: number;
  /** 進行速度（m/s）と寿命（秒）。射程 = speed × life */
  speed: number;
  life: number;
  /** 三日月の厚み倍率 */
  thickness?: number;
  /** 毎フレーム呼ばれる: 現在位置・前進距離・経過秒 */
  onFrame?: (pos: THREE.Vector3, traveled: number, dt: number) => void;
}

/** 先端が尖り、中央が前へせり出す三日月形のジオメトリ（x: 幅 / y: 厚み / z: 後方への反り） */
function crescentGeometry(halfWidth: number, thick: number, sweep: number, segs = 40): THREE.BufferGeometry {
  const pos: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= segs; i++) {
    const s = (i / segs) * 2 - 1; // -1..1
    const body = Math.pow(Math.max(0, 1 - s * s), 0.85);
    const x = s * halfWidth;
    const z = sweep * s * s; // 先端ほど後ろへ反る
    pos.push(x, thick * body, z); // 上縁（厚い）
    pos.push(x, -thick * body * 0.28, z); // 下縁（鋭い）
  }
  for (let i = 0; i < segs; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 2, a + 1, a + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}

/**
 * 斬撃波。三日月が地を這うように前進し、触れた敵を斬る（判定は呼び出し側 onFrame で行う）。
 * 層構造: 外殻オーラ / 白熱の芯 / 前縁の細線 / 時間差の残像三枚 / 足元の滑走ライン / 発射時の閃光
 */
export function buildSlashWaveFx(o: SlashWaveOpts): MeleeFxResult {
  const { scene } = o;
  const col = new THREE.Color(o.color);
  const white = new THREE.Color(0xf0f9ff);
  const th = (o.thickness ?? 1) * Math.max(0.18, o.halfWidth * 0.075);
  const sweep = o.halfWidth * 0.42;

  const root = new THREE.Group();
  root.position.copy(o.origin);
  root.lookAt(o.origin.clone().sub(o.dir)); // ローカル -Z が進行方向
  scene.add(root);

  const blade = new THREE.Group();
  blade.rotation.z = o.roll;
  root.add(blade);

  blade.add(new THREE.Mesh(crescentGeometry(o.halfWidth, th * 1.55, sweep), addMat(col, 0.75)));
  blade.add(new THREE.Mesh(crescentGeometry(o.halfWidth * 0.97, th * 0.8, sweep), addMat(white, 0.7)));
  const edge = new THREE.Mesh(crescentGeometry(o.halfWidth * 1.02, th * 0.16, sweep - 0.04), addMat(0xffffff, 1));
  edge.position.z = -0.05;
  blade.add(edge);
  // 時間差の残像: 後ろへ下がるほど細く暗い
  for (let i = 1; i <= 3; i++) {
    const ghost = new THREE.Mesh(crescentGeometry(o.halfWidth * (1 - i * 0.07), th * (1.3 - i * 0.22), sweep * (1 + i * 0.1)), addMat(scaleColor(col, 0.62 - i * 0.14), 0.6 - i * 0.12));
    ghost.position.z = i * (o.speed * 0.016);
    blade.add(ghost);
  }

  // 足元の滑走ライン（刃面の傾きとは無関係に地面へ沿わせる）
  const floorY = 0.06 - o.origin.y;
  const streak = new THREE.Mesh(new THREE.PlaneGeometry(o.halfWidth * 1.5, o.halfWidth * 0.16), addMat(col, 0.55));
  streak.rotation.x = -Math.PI / 2;
  streak.position.set(0, floorY, 0.4);
  root.add(streak);
  const streakCore = new THREE.Mesh(new THREE.PlaneGeometry(o.halfWidth * 1.0, o.halfWidth * 0.04), addMat(white, 0.85));
  streakCore.rotation.x = -Math.PI / 2;
  streakCore.position.set(0, floorY + 0.01, 0.2);
  root.add(streakCore);

  // 発射閃光: 刃面に正対する十字の輝き（視界を潰さない大きさ）
  const flash = glint(Math.min(1.6, o.halfWidth * 0.4), white);
  flash.rotation.z = o.roll;
  flash.position.z = 0.3;
  root.add(flash);

  const particles: MeleeFxParticle[] = [];
  // 射出時の火花: 前縁から扇状に散る
  for (let i = 0; i < 26; i++) {
    const s = (Math.random() * 2 - 1) * o.halfWidth * 0.9;
    const local = V(Math.cos(o.roll) * s, Math.sin(o.roll) * s, 0);
    const wp = local.clone().applyQuaternion(root.quaternion).add(o.origin);
    const v = o.dir.clone().multiplyScalar(o.speed * (0.15 + Math.random() * 0.35)).add(V((Math.random() - 0.5) * 5, (Math.random() - 0.2) * 5, (Math.random() - 0.5) * 5));
    particles.push(makeParticle(scene, wp, v, i % 2 ? 0xe0f2fe : col, 0.02 + Math.random() * 0.02, 4, 2.6, i % 4 === 0));
  }

  const light = addLight(scene, col, o.origin.clone(), 6, 14);
  let traveled = 0;
  let emit = 0;
  const lateral = V(1, 0, 0).applyQuaternion(root.quaternion);
  const upAxis = V(0, 1, 0).applyQuaternion(root.quaternion);
  // 発射直後は小さく、前へ進みながら一気に広がる（目の前で全幅に開いて視界を白く潰さないように）
  root.scale.setScalar(0.25);
  return {
    group: root,
    particles,
    light,
    lifetime: o.life,
    direction: o.dir.clone(),
    forwardSpeed: o.speed,
    onUpdate: (p, d) => {
      traveled += o.speed * d;
      const open = Math.min(1, traveled / 6);
      root.scale.setScalar(0.25 + 0.75 * (1 - Math.pow(1 - open, 2)) + p * 0.28);
      // 先端付近から細かい火花と滑走煙を毎フレーム放出
      emit += d * 70;
      while (emit >= 1 && particles.length < 90) {
        emit -= 1;
        const s = (Math.random() * 2 - 1) * o.halfWidth * 0.85;
        const along = lateral.clone().multiplyScalar(Math.cos(o.roll) * s).addScaledVector(upAxis, Math.sin(o.roll) * s);
        const wp = root.position.clone().add(along);
        wp.addScaledVector(o.dir, -0.2);
        const ground = Math.random() < 0.35;
        if (ground) wp.y = 0.1;
        const v = ground ? V((Math.random() - 0.5) * 2, 0.8 + Math.random() * 1.6, (Math.random() - 0.5) * 2) : V((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2).addScaledVector(o.dir, -2);
        particles.push(makeParticle(scene, wp, v, ground ? 0xb6c6d8 : Math.random() < 0.5 ? 0xe0f2fe : col, ground ? 0.05 : 0.016, ground ? -0.6 : 0.5, ground ? 1.6 : 3.2));
      }
      flash.scale.setScalar(Math.max(0.01, 1 - p * 3));
      streak.scale.x = 1 + p * 0.6;
      o.onFrame?.(root.position, traveled, d);
    },
  };
}

/* -------------------------------------------------------------------------- */
/*  溜めエフェクト（全INFIGHT武器共通の骨格 + 武器別の味付け）                    */
/* -------------------------------------------------------------------------- */

/**
 * 右クリック溜め中に断続的に出す収束エフェクト。武器の位置（右下前方）へ粒子と光条が吸い込まれる。
 * katana は居合らしく「細い光条が腰の鞘へ収束」し、満タン時は刃の鳴き（白い十字閃光）を出す。
 * p: 溜め進行度 0..1
 */
export function buildMeleeChargeFx(style: MeleeStyle, camera: THREE.Camera, scene: THREE.Scene, color: string, p: number): MeleeFxResult {
  const f = camFrame(camera);
  const ff = flatForward(f.forward);
  const col = new THREE.Color(color);
  const tint = new THREE.Color(POLISH_TINT[style] ?? 0xffffff);
  const group = new THREE.Group();
  const particles: MeleeFxParticle[] = [];
  const foot = V(camera.position.x, 0.07, camera.position.z);
  const hand = toWorld(camera, V(0.3, -0.3, -0.9)); // 武器の位置

  // 足元の収束リング（絞られて消える）
  const startR = 2.2 + p * 1.2;
  const ring = floorRing(0.9, 1.0, p >= 1 ? 0xffffff : col, 0.5 + p * 0.4);
  ring.position.copy(foot);
  group.add(ring);

  const count = 5 + Math.round(p * 8);
  for (let i = 0; i < count; i++) {
    const a = Math.random() * TAU;
    const r = startR * (0.7 + Math.random() * 0.5);
    const from = V(foot.x + Math.cos(a) * r, 0.2 + Math.random() * 1.6, foot.z + Math.sin(a) * r);
    const toward = hand.clone().sub(from);
    const dist = toward.length();
    toward.normalize();
    let vel = toward.multiplyScalar(dist / 0.34);
    let size = 0.022 + Math.random() * 0.02;
    let gravity = 0;
    let box = false;
    switch (style) {
      case 'glaive':
        vel = vel.add(V(0, 1.5, 0)); // 火の粉は舞い上がりながら収束
        gravity = -1.5;
        break;
      case 'scythe':
      case 'dagger':
        vel = vel.add(V(-toward.z, 0, toward.x).multiplyScalar(2.4)); // 渦を巻いて吸い込まれる
        break;
      case 'twinblade':
        box = true;
        size *= 1.3;
        break;
      case 'gauntlets':
        vel = vel.multiplyScalar(1.15);
        box = true;
        break;
      default:
        break;
    }
    particles.push(makeParticle(scene, from, vel, i % 3 === 0 ? tint : col, size, gravity, 2.4, box));
  }

  if (style === 'katana') {
    // 居合の光条: 細長い板が腰の鞘へ向かって収束する
    const n = 2 + Math.round(p * 4);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU;
      const r = 0.9 + Math.random() * 0.9;
      const from = hand.clone().addScaledVector(f.right, Math.cos(a) * r).addScaledVector(f.up, Math.sin(a) * r * 0.7).addScaledVector(f.forward, 0.6 + Math.random());
      const dirv = hand.clone().sub(from);
      const len = dirv.length();
      const m = new THREE.Mesh(new THREE.PlaneGeometry(len * 0.55, 0.014 + p * 0.012), addMat(i % 2 ? 0xffffff : tint, 0.9));
      m.position.copy(from).addScaledVector(dirv, 0.35);
      m.quaternion.setFromUnitVectors(V(1, 0, 0), dirv.clone().normalize());
      group.add(m);
    }
    if (p >= 1) {
      // 満タン: 刃の鳴き（白い十字の閃光）
      const g = glint(0.55, 0xffffff);
      g.position.copy(hand);
      g.quaternion.copy(camera.quaternion);
      group.add(g);
    }
  } else if (style === 'gauntlets') {
    for (let i = 0; i < 2 + Math.round(p * 3); i++) {
      const a = hand.clone().addScaledVector(f.right, (Math.random() - 0.5) * 0.6).addScaledVector(f.up, (Math.random() - 0.5) * 0.4);
      const b = a.clone().add(V((Math.random() - 0.5) * 1.1, (Math.random() - 0.5) * 1.1, (Math.random() - 0.5) * 1.1));
      group.add(lightningLine(a, b, 5, 0.18, i % 2 ? 0xffffff : col));
    }
  }

  // 武器の周りで絞られていく光輪（画面に正対）。溜まるほど明るく、満タンでは放射状の光条が弾ける
  const halo = new THREE.Group();
  halo.position.copy(hand);
  halo.quaternion.copy(camera.quaternion);
  const haloRing = new THREE.Mesh(new THREE.RingGeometry(0.15, 0.16 + p * 0.012, 48), addMat(p >= 1 ? 0xffffff : col, 0.45 + p * 0.4));
  halo.add(haloRing);
  const haloSoft = new THREE.Mesh(new THREE.RingGeometry(0.12, 0.2, 48), addMat(tint, 0.1 + p * 0.14));
  halo.add(haloSoft);
  const burst = new THREE.Group();
  if (p >= 1) {
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU + Math.random() * 0.2;
      const len = 0.16 + Math.random() * 0.18;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute([0, -0.006, 0, 0, 0.006, 0, len, 0, 0], 3));
      const ray = new THREE.Mesh(g, addMat(i % 2 ? 0xffffff : col, 0.9));
      ray.rotation.z = a;
      ray.position.set(Math.cos(a) * 0.06, Math.sin(a) * 0.06, 0);
      burst.add(ray);
    }
    halo.add(burst);
  }
  group.add(halo);

  scene.add(group);
  const lifetime = p >= 1 ? 0.42 : 0.34;
  return {
    group,
    particles,
    lifetime,
    onUpdate: (t) => {
      const e = 1 - Math.pow(1 - t, 2);
      const sc = startR * (1 - e * 0.9);
      ring.scale.set(sc, sc, sc);
      // 光輪は外から武器へ絞られる / 満タンの光条は外へ弾ける
      const hs = 1.5 - e * 1.0;
      haloRing.scale.setScalar(hs);
      haloSoft.scale.setScalar(hs * 1.05);
      burst.scale.setScalar(0.6 + e * 1.8);
      burst.rotation.z = t * 1.5;
    },
  };
}
