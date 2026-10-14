/**
 * CYBER CORE - 投擲爆発エフェクト
 *
 * ダイナマイト (blast) と PALCER スタングレネード (stun) の爆発を生成する。
 * BattleScene3D の spatialEffectsRef に積める形 (group / particles / light / onUpdate) で返す。
 *
 * 注意: 更新ループ側で子メッシュの material.opacity が一律でフェードされるため、
 *       すべてのマテリアルは transparent: true にしている。
 */
import * as THREE from 'three';

export interface ExplosionParticle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  gravity: number;
  decay: number;
}

export interface ExplosionFxResult {
  group: THREE.Group;
  particles: ExplosionParticle[];
  light?: THREE.PointLight;
  lifetime: number;
  onUpdate: (progress: number, delta: number) => void;
}

export type ExplosionKind = 'blast' | 'stun';
export type ExplosionLightFn = (color: THREE.ColorRepresentation, intensity: number, dist: number, pos: THREE.Vector3) => THREE.PointLight;

const TAU = Math.PI * 2;
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const easeOut = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);

const addMat = (color: THREE.ColorRepresentation, opacity: number, side: THREE.Side = THREE.DoubleSide) =>
  new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side, blending: THREE.AdditiveBlending, depthWrite: false });
const smokeMat = (color: THREE.ColorRepresentation, opacity: number) =>
  new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false });

function particle(
  scene: THREE.Scene,
  pos: THREE.Vector3,
  vel: THREE.Vector3,
  color: THREE.ColorRepresentation,
  size: number,
  gravity: number,
  decay: number,
  opts: { box?: boolean; additive?: boolean } = {},
): ExplosionParticle {
  const geo = opts.box ? new THREE.BoxGeometry(size, size, size * 0.6) : new THREE.SphereGeometry(size, 5, 4);
  const mat = opts.additive === false
    ? new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1, depthWrite: false })
    : new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(pos);
  mesh.rotation.set(Math.random() * TAU, Math.random() * TAU, 0);
  scene.add(mesh);
  return { mesh, velocity: vel, gravity, decay };
}

function groundRing(inner: number, color: THREE.ColorRepresentation, opacity: number): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.RingGeometry(inner, 1, 40), addMat(color, opacity));
  m.rotation.x = -Math.PI / 2;
  return m;
}

function sparkBolt(from: THREE.Vector3, to: THREE.Vector3, color: THREE.ColorRepresentation): THREE.Line {
  const pts: THREE.Vector3[] = [];
  const segs = 7;
  for (let i = 0; i <= segs; i++) {
    const p = from.clone().lerp(to, i / segs);
    if (i > 0 && i < segs) p.add(V((Math.random() - 0.5) * 0.7, (Math.random() - 0.5) * 0.7, (Math.random() - 0.5) * 0.7));
    pts.push(p);
  }
  return new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(pts),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
}

/**
 * @param center 着弾点 (ワールド座標)
 * @param radius 爆風の半径 (m) — リングや火球の広がりの目安
 */
export function buildExplosionFx(
  kind: ExplosionKind,
  scene: THREE.Scene,
  center: THREE.Vector3,
  radius: number,
  acquireLight?: ExplosionLightFn,
): ExplosionFxResult {
  const group = new THREE.Group();
  const particles: ExplosionParticle[] = [];
  const floorY = 0.08;
  const base = V(center.x, Math.max(center.y, floorY), center.z);
  const stun = kind === 'stun';

  const core = new THREE.Color(stun ? 0xffffff : 0xfff3c4);
  const hot = new THREE.Color(stun ? 0xbae6fd : 0xffb020);
  const deep = new THREE.Color(stun ? 0x38bdf8 : 0xff4a12);

  // ── 中心の閃光 ──
  const flash = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), addMat(core, 0.85));
  flash.position.copy(base).add(V(0, 0.6, 0));
  group.add(flash);

  // ── 火球 (複数の球が重なって膨らみ、上昇する) ──
  const balls: { m: THREE.Mesh; dx: number; dz: number; rise: number; size: number; delay: number }[] = [];
  const ballCount = stun ? 3 : 7;
  for (let i = 0; i < ballCount; i++) {
    const col = i === 0 ? hot : i % 2 ? hot : deep;
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), addMat(col, stun ? 0.4 : i === 0 ? 0.55 : 0.42));
    const a = (i / ballCount) * TAU;
    const spread = i === 0 ? 0 : radius * 0.12;
    m.position.copy(base).add(V(Math.cos(a) * spread, 0.6, Math.sin(a) * spread));
    group.add(m);
    balls.push({
      m,
      dx: Math.cos(a) * spread,
      dz: Math.sin(a) * spread,
      rise: stun ? 0.4 : 0.9 + (i % 3) * 0.5,
      size: radius * (stun ? 0.34 : 0.26 + (i === 0 ? 0.12 : Math.random() * 0.1)),
      delay: i === 0 ? 0 : 0.04 + i * 0.025,
    });
  }

  // ── 地面を走る衝撃波リング ──
  const rings: { m: THREE.Mesh; delay: number; speed: number }[] = [];
  const ringDefs: Array<[number, THREE.Color, number, number, number]> = [
    [0.82, core, 0.8, 0, 1.0],
    [0.7, hot, 0.8, 0.06, 0.88],
    [0.9, deep, 0.55, 0.14, 0.7],
  ];
  ringDefs.forEach(([inner, col, op, delay, speed], i) => {
    const r = groundRing(inner, col, op);
    r.position.set(base.x, floorY + i * 0.012, base.z);
    group.add(r);
    rings.push({ m: r, delay, speed });
  });

  // ── 球状の衝撃殻 ──
  const shell = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 14), addMat(hot, stun ? 0.16 : 0.12));
  shell.position.copy(base).add(V(0, 0.5, 0));
  group.add(shell);

  // ── 煙 (ダイナマイトのみ。黒煙がゆっくり上がる) ──
  const smokes: { m: THREE.Mesh; vx: number; vz: number; rise: number; size: number }[] = [];
  if (!stun) {
    for (let i = 0; i < 9; i++) {
      const a = Math.random() * TAU;
      const d = Math.random() * radius * 0.28;
      const m = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), smokeMat(i % 3 === 0 ? 0x2a2522 : 0x45403b, 0.55));
      m.position.copy(base).add(V(Math.cos(a) * d, 0.5 + Math.random() * 0.6, Math.sin(a) * d));
      group.add(m);
      smokes.push({
        m,
        vx: Math.cos(a) * (0.5 + Math.random() * 1.1),
        vz: Math.sin(a) * (0.5 + Math.random() * 1.1),
        rise: 1.6 + Math.random() * 1.8,
        size: radius * (0.16 + Math.random() * 0.12),
      });
    }
  }

  // ── スタン: 放射状のスパーク (電撃) ──
  if (stun) {
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU + Math.random() * 0.3;
      const len = radius * (0.5 + Math.random() * 0.5);
      const e = V(Math.cos(a) * len, 0.2 + Math.random() * 1.6, Math.sin(a) * len);
      group.add(sparkBolt(base.clone().add(V(0, 0.5, 0)), base.clone().add(e), i % 2 ? core : hot));
    }
  }

  // ── 粒子 ──
  if (stun) {
    // 白青の火花: 全方位へ高速で飛び散る
    for (let i = 0; i < 70; i++) {
      const a = Math.random() * TAU;
      const sp = 5 + Math.random() * 12;
      particles.push(particle(scene, base.clone().add(V(0, 0.5, 0)), V(Math.cos(a) * sp, (Math.random() - 0.3) * 8, Math.sin(a) * sp), i % 3 ? core : hot, 0.03 + Math.random() * 0.04, 6, 2.2));
    }
  } else {
    // 火花 (高速・短命)
    for (let i = 0; i < 60; i++) {
      const a = Math.random() * TAU;
      const sp = 5 + Math.random() * 13;
      const up = 3 + Math.random() * 11;
      particles.push(particle(scene, base.clone().add(V(0, 0.4, 0)), V(Math.cos(a) * sp, up, Math.sin(a) * sp), i % 3 === 0 ? core : i % 3 === 1 ? hot : deep, 0.03 + Math.random() * 0.045, 16, 1.7));
    }
    // 燃えさし (ゆっくり落ちる)
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * TAU;
      const sp = 1.5 + Math.random() * 4.5;
      particles.push(particle(scene, base.clone().add(V(0, 0.8, 0)), V(Math.cos(a) * sp, 4 + Math.random() * 6, Math.sin(a) * sp), 0xff7a1a, 0.05 + Math.random() * 0.05, 5, 0.9));
    }
    // 土砂・破片 (回転する塊が打ち上がる)
    for (let i = 0; i < 28; i++) {
      const a = Math.random() * TAU;
      const sp = 2.5 + Math.random() * 8;
      particles.push(particle(scene, base.clone().add(V(Math.cos(a) * 0.5, 0.2, Math.sin(a) * 0.5)), V(Math.cos(a) * sp, 6 + Math.random() * 9, Math.sin(a) * sp), i % 2 ? 0x6b5a4a : 0x3b332c, 0.08 + Math.random() * 0.12, 22, 0.8, { box: true, additive: false }));
    }
    // 地面を這う砂塵
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * TAU + Math.random() * 0.2;
      const sp = 5 + Math.random() * 5;
      particles.push(particle(scene, base.clone().add(V(Math.cos(a) * 0.6, 0.15, Math.sin(a) * 0.6)), V(Math.cos(a) * sp, 0.4 + Math.random(), Math.sin(a) * sp), 0xb9a58a, 0.13 + Math.random() * 0.1, 1.2, 1.1, { additive: false }));
    }
  }

  scene.add(group);
  const lightColor = stun ? 0xbfe6ff : 0xffa030;
  const lightPos = base.clone().add(V(0, 1.6, 0));
  const light = acquireLight?.(lightColor, stun ? 14 : 16, radius * 3.4, lightPos);

  const lifetime = stun ? 0.8 : 1.15;
  return {
    group,
    particles,
    light,
    lifetime,
    onUpdate: (p) => {
      // 閃光: 一瞬で膨らみ、すぐ縮む
      const fp = Math.min(1, p / 0.18);
      const fs = radius * (0.08 + easeOut(fp) * (stun ? 0.2 : 0.14)) * Math.max(0, 1 - Math.max(0, p - 0.18) * 3.2);
      flash.scale.setScalar(Math.max(0.01, fs));
      flash.visible = p < 0.5;

      balls.forEach((b) => {
        const bp = Math.max(0, (p - b.delay) / (1 - b.delay));
        const s = Math.max(0.01, b.size * (0.25 + easeOut(bp * 1.6) * 1.1) * (1 - bp * 0.45));
        b.m.scale.setScalar(s);
        b.m.position.set(base.x + b.dx * (1 + bp * 1.5), base.y + 0.5 + b.rise * easeOut(bp), base.z + b.dz * (1 + bp * 1.5));
        b.m.visible = p >= b.delay;
      });

      rings.forEach((r) => {
        const rp = Math.max(0, Math.min(1, (p - r.delay) / (1 - r.delay)));
        const s = 0.4 + radius * r.speed * easeOut(rp);
        r.m.scale.set(s, s, s);
        r.m.visible = p >= r.delay;
      });

      const sp = Math.min(1, p / 0.35);
      const ss = 0.5 + radius * 0.85 * easeOut(sp);
      shell.scale.set(ss, ss * 0.7, ss);
      shell.visible = p < 0.45;

      smokes.forEach((s) => {
        const t = p * lifetime;
        s.m.position.set(s.m.position.x + s.vx * 0.016 * (1 - p), base.y + 0.6 + s.rise * t, s.m.position.z + s.vz * 0.016 * (1 - p));
        s.m.scale.setScalar(s.size * (0.4 + easeOut(p * 1.3) * 1.4));
      });
    },
  };
}
