/**
 * VITALIS の回復ドローン。
 *  - 持ち主の肩の上あたりに浮かび、回復中の味方へピンク色のビームを繋ぐ
 *  - 自分のドローンも、協力プレイで他プレイヤーが出しているドローンも同じクラスで描く
 */
import * as THREE from 'three';

export const HEAL_DRONE_COLOR = 0xf472b6;
/** ドローンが回復できる、持ち主からの最大距離 (m) */
export const HEAL_DRONE_RANGE = 24;
/** 回復を始めた後、この距離まで離れても回復を続ける (ターゲットのチラつき防止) */
export const HEAL_DRONE_RANGE_HOLD = 30;
/** 回復量 (HP/秒) */
export const HEAL_DRONE_HPS = 14;
/** 強化ノード「回復割合化」: 対象の最大HPに対する割合 (/秒)。最大HP100なら毎秒14HPで、固定値と同じ */
export const HEAL_DRONE_PCT = 0.14;
/** 強化ノード「回復範囲拡大」: 同時に回復できる人数と範囲 */
export const HEAL_DRONE_RANGE_WIDE = 34;
export const HEAL_DRONE_RANGE_HOLD_WIDE = 42;
export const HEAL_DRONE_MAX_BEAMS = 2;

const UP = new THREE.Vector3(0, 1, 0);

interface Beam {
  group: THREE.Group;
  core: THREE.Mesh;
  glow: THREE.Mesh;
  motes: THREE.Mesh[];
  amt: number;
}

export class HealDrone {
  readonly group = new THREE.Group();
  private scene: THREE.Scene;
  private body = new THREE.Group();
  private ringA: THREE.Mesh;
  private ringB: THREE.Mesh;
  private core: THREE.Mesh;
  private beams: Beam[] = [];
  private mats: THREE.Material[] = [];
  private geos: THREE.BufferGeometry[] = [];
  private t = Math.random() * 10;
  private placed = false;
  private tmpA = new THREE.Vector3();
  private tmpB = new THREE.Vector3();
  private tmpDir = new THREE.Vector3();
  private lastEnd = [new THREE.Vector3(), new THREE.Vector3()];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    const pink = new THREE.Color(HEAL_DRONE_COLOR);
    const shell = this.mat(new THREE.MeshStandardMaterial({ color: 0xfbcfe8, metalness: 0.35, roughness: 0.3, emissive: pink, emissiveIntensity: 0.25 }));
    const dark = this.mat(new THREE.MeshStandardMaterial({ color: 0x831843, metalness: 0.5, roughness: 0.4 }));
    const glow = this.mat(new THREE.MeshBasicMaterial({ color: pink }));
    const halo = this.mat(new THREE.MeshBasicMaterial({ color: pink, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false }));

    const shellMesh = new THREE.Mesh(this.geo(new THREE.SphereGeometry(0.17, 18, 14)), shell);
    shellMesh.scale.set(1, 0.72, 1);
    this.body.add(shellMesh);
    const belly = new THREE.Mesh(this.geo(new THREE.CylinderGeometry(0.1, 0.07, 0.08, 14)), dark);
    belly.position.y = -0.1;
    this.body.add(belly);
    this.core = new THREE.Mesh(this.geo(new THREE.SphereGeometry(0.06, 12, 10)), glow);
    this.core.position.y = -0.02;
    this.body.add(this.core);
    const haloMesh = new THREE.Mesh(this.geo(new THREE.SphereGeometry(0.3, 14, 10)), halo);
    this.body.add(haloMesh);
    // 医療十字
    const crossA = new THREE.Mesh(this.geo(new THREE.BoxGeometry(0.2, 0.03, 0.06)), glow);
    const crossB = new THREE.Mesh(this.geo(new THREE.BoxGeometry(0.06, 0.03, 0.2)), glow);
    crossA.position.y = crossB.position.y = 0.115;
    this.body.add(crossA, crossB);
    // 回転リング (プロペラ代わり)
    const ringGeo = this.geo(new THREE.TorusGeometry(0.26, 0.012, 6, 28));
    this.ringA = new THREE.Mesh(ringGeo, glow);
    this.ringA.rotation.x = Math.PI / 2;
    this.ringB = new THREE.Mesh(ringGeo, glow);
    this.ringB.rotation.x = Math.PI / 2;
    this.ringB.scale.setScalar(0.78);
    this.body.add(this.ringA, this.ringB);
    this.group.add(this.body);

    // ビーム: 原点から +Y 方向へ長さ 1 の円柱。長さは scale.y、向きは quaternion で決める
    const beamGeo = this.geo(new THREE.CylinderGeometry(1, 1, 1, 10, 1, true));
    beamGeo.translate(0, 0.5, 0);
    const moteGeo = this.geo(new THREE.SphereGeometry(0.07, 8, 6));
    const moteMat = this.mat(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
    const coreMat = this.mat(new THREE.MeshBasicMaterial({ color: 0xfce7f3, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    for (let b = 0; b < HEAL_DRONE_MAX_BEAMS; b++) {
      const group = new THREE.Group();
      const glowMat = this.mat(new THREE.MeshBasicMaterial({ color: pink, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      const glowMesh = new THREE.Mesh(beamGeo, glowMat);
      const coreMesh = new THREE.Mesh(beamGeo, coreMat);
      group.add(glowMesh, coreMesh);
      group.visible = false;
      const motes: THREE.Mesh[] = [];
      for (let i = 0; i < 5; i++) {
        const m = new THREE.Mesh(moteGeo, moteMat);
        m.visible = false;
        motes.push(m);
        this.group.add(m);
      }
      scene.add(group);
      this.beams.push({ group, core: coreMesh, glow: glowMesh, motes, amt: 0 });
    }
    this.group.visible = false;
    scene.add(this.group);
  }

  private mat<T extends THREE.Material>(m: T): T {
    this.mats.push(m);
    return m;
  }

  private geo<T extends THREE.BufferGeometry>(g: T): T {
    this.geos.push(g);
    return g;
  }

  /** 持ち主の目線位置・向きから、ドローンが浮かぶ位置を求める (右肩の斜め上、少し前) */
  static hoverPoint(eye: THREE.Vector3, yaw: number, out: THREE.Vector3): THREE.Vector3 {
    const sx = Math.cos(yaw), sz = -Math.sin(yaw); // 右方向
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw); // 前方向
    return out.set(eye.x + sx * 0.95 + fx * 0.3, eye.y + 0.45, eye.z + sz * 0.95 + fz * 0.3);
  }

  /**
   * @param anchor ドローンが居たい位置 (HealDrone.hoverPoint など)
   * @param targets 回復中の味方の胸元 (最大 HEAL_DRONE_MAX_BEAMS 人。空なら回復していない)
   */
  update(delta: number, anchor: THREE.Vector3 | null, targets: THREE.Vector3[]) {
    if (!anchor) {
      this.group.visible = false;
      this.beams.forEach((b) => {
        b.group.visible = false;
        b.amt = 0;
        b.motes.forEach((m) => (m.visible = false));
      });
      this.placed = false;
      return;
    }
    this.t += delta;
    const g = this.group;
    g.visible = true;
    if (!this.placed || g.position.distanceToSquared(anchor) > 400) {
      g.position.copy(anchor);
      this.placed = true;
    } else {
      g.position.lerp(anchor, 1 - Math.exp(-delta * 7));
    }
    const bob = Math.sin(this.t * 2.6) * 0.05;
    this.body.position.y = bob;
    this.body.rotation.z = Math.sin(this.t * 1.7) * 0.08;
    this.ringA.rotation.z += delta * 9;
    this.ringB.rotation.z -= delta * 12;
    const active = targets.length;
    this.core.scale.setScalar(1 + Math.sin(this.t * 7) * 0.12 + Math.min(1, active) * 0.25);

    const origin = this.tmpA.set(g.position.x, g.position.y + bob - 0.05, g.position.z);
    this.beams.forEach((beam, bi) => {
      const target = targets[bi] ?? null;
      beam.amt += ((target ? 1 : 0) - beam.amt) * (1 - Math.exp(-delta * 12));
      const show = target !== null || beam.amt > 0.02;
      beam.group.visible = show;
      beam.motes.forEach((m) => (m.visible = show && target !== null));
      if (!show) return;
      if (target) this.lastEnd[bi].copy(target);
      const end = this.lastEnd[bi];
      const dir = this.tmpDir.subVectors(end, origin);
      const len = Math.max(0.001, dir.length());
      beam.group.position.copy(origin);
      beam.group.quaternion.setFromUnitVectors(UP, dir.divideScalar(len));
      const pulse = 1 + Math.sin(this.t * 14 + bi) * 0.18;
      const w = beam.amt;
      beam.core.scale.set(0.012 * w * pulse, len, 0.012 * w * pulse);
      beam.glow.scale.set(0.045 * w * pulse, len, 0.045 * w * pulse);
      (beam.glow.material as THREE.MeshBasicMaterial).opacity = 0.3 + Math.sin(this.t * 9 + bi) * 0.08;
      if (target) {
        beam.motes.forEach((m, i) => {
          const u = (this.t * 1.1 + i / beam.motes.length) % 1;
          m.position.set(origin.x + (end.x - origin.x) * u - g.position.x, origin.y + (end.y - origin.y) * u - g.position.y, origin.z + (end.z - origin.z) * u - g.position.z);
          m.scale.setScalar(0.5 + Math.sin(u * Math.PI) * 0.9);
        });
      }
    });
  }

  dispose() {
    this.scene.remove(this.group);
    this.beams.forEach((b) => this.scene.remove(b.group));
    this.geos.forEach((g) => g.dispose());
    this.mats.forEach((m) => m.dispose());
  }
}
