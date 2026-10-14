import * as THREE from 'three';
import { MeleeStyle, SwingPose } from './meleeStyles';

/**
 * CYBER CORE - INFIGHT guard (右クリック防御) definitions.
 *
 * 各近接武器が固有の防御方法を持つ:
 *   - 構え (viewmodel pose, 絶対値)
 *   - 軽減率 (近接 / 射撃)
 *   - 固有効果 (パリィ, 回避, 反撃, 吸収 など。処理は BattleScene3D 側)
 *   - 3D エフェクト (カメラ空間, buildGuardFx / updateGuardFx)
 */

export interface GuardProfile {
  /** 技名 (HUD) */
  name: string;
  jp: string;
  /** 効果の一行説明 (HUD) */
  desc: string;
  color: string;
  /** 被ダメージ軽減率 0..1 */
  meleeReduce: number;
  projReduce: number;
  /** 構え始めからこの秒数は特殊判定 (ジャストガード / 位相回避) */
  perfectWindow: number;
  /** 防御中の構え (ビューモデル絶対姿勢) */
  pose: SwingPose;
}

/** Ready stance of the generic melee rig (must match BattleScene3D). */
export const MELEE_READY_POSE: SwingPose = { x: 0.28, y: -0.25, z: -0.52, rx: 0.1, ry: -0.2, rz: 0.26 };

export const GUARD_PROFILES: Record<MeleeStyle, GuardProfile> = {
  katana: {
    name: 'MIKIRI PARRY', jp: '見切り・居合返し',
    desc: '構えた直後0.3秒はジャストパリィ：無傷＋居合で反撃',
    color: '#38bdf8', meleeReduce: 0.65, projReduce: 0.7, perfectWindow: 0.3,
    pose: { x: 0.02, y: -0.13, z: -0.42, rx: 0.1, ry: 0.32, rz: 1.45 },
  },
  gauntlets: {
    name: 'VOLT CROSS GUARD', jp: '電磁クロスガード',
    desc: '両腕を交差して防御。殴ってきた敵に放電してスタン',
    color: '#22d3ee', meleeReduce: 0.75, projReduce: 0.7, perfectWindow: 0,
    pose: { x: 0, y: -0.12, z: -0.34, rx: 0.25, ry: 0, rz: 0 },
  },
  twinblade: {
    name: 'STELLAR CROSS', jp: '星十字受け',
    desc: '二刀を交差して受ける。直後0.25秒はジャストパリィ：無傷＋十字の反撃',
    color: '#f472b6', meleeReduce: 0.7, projReduce: 0.75, perfectWindow: 0.25,
    pose: { x: 0, y: -0.14, z: -0.38, rx: 0.2, ry: 0, rz: 0 },
  },
  hammer: {
    name: 'GRAVITY DOME', jp: '重力障壁',
    desc: 'ハンマーを立てて重力ドームを展開。近づく敵を弾き飛ばす',
    color: '#fb923c', meleeReduce: 0.85, projReduce: 0.85, perfectWindow: 0,
    pose: { x: 0.04, y: -0.36, z: -0.5, rx: -0.05, ry: 0.85, rz: 0.04 },
  },
  glaive: {
    name: 'HEAT WINDMILL', jp: '熱風車',
    desc: '長柄を高速回転。弾は焼き払い、殴ってきた敵を炎上',
    color: '#f43f5e', meleeReduce: 0.55, projReduce: 1.0, perfectWindow: 0,
    pose: { x: 0.06, y: -0.22, z: -0.52, rx: 0.12, ry: 0.1, rz: 0.78 },
  },
  dagger: {
    name: 'PHASE SHIFT', jp: '位相回避',
    desc: '防がずにすり抜ける。直後0.45秒は完全回避、以降50%で回避',
    color: '#a78bfa', meleeReduce: 0.35, projReduce: 0.35, perfectWindow: 0.45,
    pose: { x: 0.14, y: -0.2, z: -0.36, rx: 0.5, ry: -0.4, rz: -0.6 },
  },
  chainspear: {
    name: 'CHAIN BARRIER', jp: '鎖結界',
    desc: '鎖を旋回させて結界を張る。殴ってきた敵を鎖で拘束',
    color: '#fbbf24', meleeReduce: 0.7, projReduce: 0.85, perfectWindow: 0,
    pose: { x: 0.18, y: -0.3, z: -0.55, rx: -0.1, ry: -0.1, rz: 0.05 },
  },
  scythe: {
    name: 'SOUL VORTEX', jp: '魂喰らいの渦',
    desc: '大鎌の渦で受け流し、防いだダメージの40%をHPとして吸収',
    color: '#c084fc', meleeReduce: 0.65, projReduce: 0.65, perfectWindow: 0,
    pose: { x: 0.05, y: -0.18, z: -0.5, rx: 0.2, ry: 0.5, rz: -0.9 },
  },
  lance: {
    name: 'IRON BASTION', jp: '鉄壁装甲',
    desc: '装甲板で受け止める（軽減90%）。防ぐたびに杭がチャージ',
    color: '#06b6d4', meleeReduce: 0.9, projReduce: 0.9, perfectWindow: 0,
    pose: { x: 0.1, y: -0.24, z: -0.42, rx: 0.25, ry: -0.1, rz: 0.1 },
  },
  chainsaw: {
    name: 'SHRED GUARD', jp: '回転刃受け',
    desc: '回転刃で弾を削り落とす。殴ってきた敵を切り返して出血させる',
    color: '#ef4444', meleeReduce: 0.6, projReduce: 0.8, perfectWindow: 0,
    pose: { x: 0.04, y: -0.2, z: -0.5, rx: 0.15, ry: 0.2, rz: 1.35 },
  },
  anchor: {
    name: 'ANCHOR BERTH', jp: '投錨係留',
    desc: '錨を地面に打ち込んで踏ん張る（軽減85%）。殴ってきた敵を係留して動きを封じる',
    color: '#2dd4bf', meleeReduce: 0.85, projReduce: 0.8, perfectWindow: 0,
    pose: { x: 0.04, y: -0.34, z: -0.55, rx: -0.08, ry: 0.3, rz: 0.08 },
  },
  rapier: {
    name: 'HOARFROST PARRY', jp: '霜鏡の受け流し',
    desc: '構えた直後0.3秒はジャストパリィ：無傷＋殴ってきた敵を凍結。以降は60%軽減',
    color: '#7dd3fc', meleeReduce: 0.6, projReduce: 0.6, perfectWindow: 0.3,
    pose: { x: 0.08, y: -0.12, z: -0.42, rx: -0.9, ry: 0.15, rz: 0.4 },
  },
  whip: {
    name: 'COIL WARD', jp: '雷蛇の結界',
    desc: '鞭を高速旋回させて弾を叩き落とす（射撃90%軽減）。殴ってきた敵は感電して弾かれる',
    color: '#a3e635', meleeReduce: 0.55, projReduce: 0.9, perfectWindow: 0,
    pose: { x: 0.06, y: -0.2, z: -0.5, rx: 0.3, ry: 0.0, rz: 0.1 },
  },
  disc: {
    name: 'RONDO SHIELD', jp: '円月の盾',
    desc: '円月輪を前で回して受ける（射撃85%・近接60%軽減）。殴ってきた敵を切り返す',
    color: '#f59e0b', meleeReduce: 0.6, projReduce: 0.85, perfectWindow: 0,
    pose: { x: 0.0, y: -0.16, z: -0.44, rx: -0.2, ry: 0.0, rz: 0.0 },
  },
  generic: {
    name: 'BLADE GUARD', jp: 'ブレードガード',
    desc: '刃で受け止める',
    color: '#0284c7', meleeReduce: 0.7, projReduce: 0.75, perfectWindow: 0,
    pose: { x: 0.04, y: -0.16, z: -0.44, rx: 0.12, ry: 0.35, rz: 1.25 },
  },
};

/** Pile bunker: stake charges gained from blocking (each adds +50% to the next hit). */
export const LANCE_MAX_CHARGE = 3;

// ─────────────────────────────── 3D effects ───────────────────────────────

const additive = (color: THREE.ColorRepresentation, opacity: number, side: THREE.Side = THREE.DoubleSide) =>
  new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, side });
const lineMat = (color: THREE.ColorRepresentation, opacity: number) =>
  new THREE.LineBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false });

/** Remembers each material's full opacity so the effect can fade as a whole. */
const tagOpacity = (root: THREE.Object3D) => {
  root.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.Material | undefined;
    if (m && !Array.isArray(m)) m.userData.baseOpacity = m.opacity;
  });
};

/**
 * Builds the guard effect for a melee style, in camera space (place it under the camera).
 * Parts that animate are named; updateGuardFx drives them.
 */
export function buildGuardFx(style: MeleeStyle, colorHex: string): THREE.Group {
  const g = new THREE.Group();
  g.name = 'guardFx';
  g.userData.style = style;
  g.position.set(0, -0.03, -1.35);
  g.renderOrder = 999;
  const color = new THREE.Color(colorHex);
  const white = new THREE.Color(0xffffff);
  const add = <T extends THREE.Object3D>(o: T, name?: string): T => {
    if (name) o.name = name;
    o.renderOrder = 999;
    g.add(o);
    return o;
  };

  switch (style) {
    case 'katana': {
      // 居合の三日月: 横一文字の細い弧と、ジャスト判定中だけ光る鞘走りの閃光
      add(new THREE.Mesh(new THREE.RingGeometry(0.62, 0.635, 64, 1, Math.PI * 0.08, Math.PI * 0.84), additive(color, 0.75)), 'arc');
      add(new THREE.Mesh(new THREE.RingGeometry(0.6, 0.66, 64, 1, Math.PI * 0.08, Math.PI * 0.84), additive(color, 0.18)), 'arcHalo');
      const flash = add(new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.012), additive(white, 0.9)), 'perfect');
      flash.position.y = 0.05;
      add(new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.06), additive(color, 0.35)), 'perfectHalo').position.y = 0.05;
      break;
    }
    case 'gauntlets': {
      // 電磁格子の球殻 + ランダムに走る稲妻
      add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(0.52, 1)), lineMat(color, 0.55)), 'shell');
      add(new THREE.Mesh(new THREE.SphereGeometry(0.5, 24, 16), additive(color, 0.06)));
      const boltGeo = new THREE.BufferGeometry();
      boltGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(6 * 7 * 2 * 3), 3));
      add(new THREE.LineSegments(boltGeo, lineMat(white, 0.9)), 'bolts');
      break;
    }
    case 'twinblade': {
      // 星十字: 交差する二本の光刃 + 星型リング。ジャスト判定中は白く閃く
      const blade = (rot: number) => {
        const m = add(new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.04), additive(color, 0.8)));
        m.rotation.z = rot;
        const h = add(new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.16), additive(color, 0.18)));
        h.rotation.z = rot;
      };
      blade(Math.PI / 4);
      blade(-Math.PI / 4);
      add(new THREE.Mesh(new THREE.RingGeometry(0.46, 0.48, 48), additive(color, 0.7)), 'orbit');
      add(new THREE.Mesh(new THREE.RingGeometry(0.62, 0.635, 5, 1), additive(white, 0.55)), 'star');
      add(new THREE.Mesh(new THREE.CircleGeometry(0.1, 16), additive(white, 0.9)), 'perfect');
      break;
    }
    case 'hammer': {
      // 重力ドーム: 傾いた軌道リングが別々に回る + 歪んだ膜
      for (let i = 0; i < 3; i++) {
        const ring = add(new THREE.Mesh(new THREE.TorusGeometry(0.58 + i * 0.05, 0.006, 6, 80), additive(color, 0.5 - i * 0.12)), `orbit${i}`);
        ring.rotation.set(0.6 + i * 0.7, i * 0.9, 0);
      }
      add(new THREE.Mesh(new THREE.SphereGeometry(0.6, 32, 16), additive(color, 0.07)), 'membrane');
      add(new THREE.Mesh(new THREE.RingGeometry(0.1, 0.62, 64), additive(color, 0.08)), 'well');
      break;
    }
    case 'glaive': {
      // 熱風車: 回転する炎の円盤と2本の残光ブレード
      const cv = document.createElement('canvas');
      cv.width = cv.height = 128;
      const ctx = cv.getContext('2d')!;
      const grd = ctx.createRadialGradient(64, 64, 8, 64, 64, 64);
      grd.addColorStop(0, 'rgba(255,240,200,0.9)');
      grd.addColorStop(0.35, `rgba(${Math.round(color.r * 255)},${Math.round(color.g * 255)},${Math.round(color.b * 255)},0.5)`);
      grd.addColorStop(0.75, 'rgba(249,115,22,0.18)');
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, 128, 128);
      const disc = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false });
      add(new THREE.Mesh(new THREE.CircleGeometry(0.6, 48), disc), 'disc');
      const blades = add(new THREE.Group(), 'blades');
      for (let i = 0; i < 2; i++) {
        const b = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.6, 32, 1, i * Math.PI, Math.PI * 0.35), additive(i ? 0xfb923c : color, 0.5));
        b.renderOrder = 999;
        blades.add(b);
      }
      add(new THREE.Mesh(new THREE.RingGeometry(0.58, 0.6, 64), additive(0xfdba74, 0.6)));
      break;
    }
    case 'dagger': {
      // 位相回避: ずれて揺らぐ残像フレーム
      for (let i = 0; i < 4; i++) {
        const frame = add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(1.25, 0.72)), lineMat(color, 0.5 - i * 0.1)), `ghost${i}`);
        frame.position.z = -i * 0.04;
      }
      add(new THREE.Mesh(new THREE.RingGeometry(0.3, 0.32, 6), additive(white, 0.7)), 'core');
      break;
    }
    case 'chainspear': {
      // 鎖結界: 輪状に並んだ鎖のリンクが旋回
      const ring = add(new THREE.Group(), 'chain');
      const linkGeo = new THREE.TorusGeometry(0.035, 0.008, 6, 12);
      const linkMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, depthTest: false });
      const N = 36;
      for (let i = 0; i < N; i++) {
        const a = (i / N) * Math.PI * 2;
        const l = new THREE.Mesh(linkGeo, linkMat);
        l.position.set(Math.cos(a) * 0.58, Math.sin(a) * 0.58, 0);
        l.rotation.z = a;
        l.rotation.x = i % 2 ? Math.PI / 2 : 0;
        l.renderOrder = 999;
        ring.add(l);
      }
      add(new THREE.Mesh(new THREE.RingGeometry(0.52, 0.64, 64), additive(color, 0.12)));
      const hook = add(new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.14, 4), new THREE.MeshBasicMaterial({ color: 0xfef3c7, transparent: true, depthTest: false })), 'hook');
      hook.position.set(0.58, 0, 0);
      break;
    }
    case 'scythe': {
      // 魂喰らいの渦: 内側へ巻き込む螺旋
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 160; i++) {
        const t = i / 160;
        const a = t * Math.PI * 6;
        const r = 0.08 + t * 0.55;
        pts.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0));
      }
      const spiral = new THREE.BufferGeometry().setFromPoints(pts);
      add(new THREE.Line(spiral, lineMat(color, 0.8)), 'spiral');
      const s2 = add(new THREE.Line(spiral, lineMat(0xf0abfc, 0.4)), 'spiral2');
      s2.rotation.z = Math.PI;
      add(new THREE.Mesh(new THREE.CircleGeometry(0.6, 48), additive(0x581c87, 0.18)), 'void');
      break;
    }
    case 'lance': {
      // 鉄壁装甲: 六角セルの重装甲板
      const plate = add(new THREE.Group(), 'plate');
      const hex = new THREE.CircleGeometry(0.1, 6);
      const hexEdge = new THREE.EdgesGeometry(hex);
      for (let q = -3; q <= 3; q++) {
        for (let r = -2; r <= 2; r++) {
          const x = q * 0.16;
          const y = r * 0.18 + (q % 2 ? 0.09 : 0);
          if (Math.abs(x) / 0.62 + Math.abs(y) / 0.42 > 1.15) continue;
          const cell = new THREE.Mesh(hex, additive(color, 0.1));
          cell.position.set(x, y, 0);
          cell.rotation.z = Math.PI / 6;
          cell.renderOrder = 999;
          plate.add(cell);
          const e = new THREE.LineSegments(hexEdge, lineMat(color, 0.7));
          e.position.copy(cell.position);
          e.rotation.z = Math.PI / 6;
          e.renderOrder = 999;
          plate.add(e);
        }
      }
      // charge pips (0..3)
      for (let i = 0; i < LANCE_MAX_CHARGE; i++) {
        const pip = add(new THREE.Mesh(new THREE.CircleGeometry(0.025, 6), additive(white, 0.15)), `pip${i}`);
        pip.position.set((i - 1) * 0.09, -0.5, 0.01);
      }
      break;
    }
    case 'anchor': {
      // 係留: 外へ広がる波紋と、中心に降りる碇の十字
      for (let i = 0; i < 3; i++) add(new THREE.Mesh(new THREE.RingGeometry(0.5, 0.515, 64), additive(color, 0.6 - i * 0.12)), `ripple${i}`);
      add(new THREE.Mesh(new THREE.CircleGeometry(0.62, 48), additive(color, 0.07)));
      const cross = add(new THREE.Group(), 'moor');
      cross.add(new THREE.Mesh(new THREE.PlaneGeometry(0.025, 0.5), additive(white, 0.8)));
      const bar = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.025), additive(white, 0.8));
      bar.position.y = 0.12;
      cross.add(bar);
      const arc = new THREE.Mesh(new THREE.RingGeometry(0.15, 0.17, 24, 1, Math.PI, Math.PI), additive(color, 0.9));
      arc.position.y = -0.23;
      cross.add(arc);
      break;
    }
    case 'chainsaw': {
      // 回転刃: 鋸歯の外周リング + 飛び散る火花の円盤
      const saw = add(new THREE.Group(), 'saw');
      const N = 28;
      const toothGeo = new THREE.ConeGeometry(0.03, 0.08, 3);
      for (let i = 0; i < N; i++) {
        const a = (i / N) * Math.PI * 2;
        const tooth = new THREE.Mesh(toothGeo, additive(i % 2 ? white : color, 0.85));
        tooth.position.set(Math.cos(a) * 0.6, Math.sin(a) * 0.6, 0);
        tooth.rotation.z = a - Math.PI / 2 + 0.5; // 刃先を回転方向へ傾ける
        tooth.renderOrder = 999;
        saw.add(tooth);
      }
      add(new THREE.Mesh(new THREE.RingGeometry(0.5, 0.6, 64), additive(color, 0.22)), 'rim');
      add(new THREE.Mesh(new THREE.CircleGeometry(0.5, 48), additive(0x7f1d1d, 0.12)));
      const sparkGeo = new THREE.BufferGeometry();
      sparkGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(10 * 2 * 3), 3));
      add(new THREE.LineSegments(sparkGeo, lineMat(0xfde68a, 0.9)), 'sparks');
      break;
    }
    case 'rapier': {
      // 霜鏡: 結晶の六芒と、ジャスト判定中に光る氷の面
      const flake = add(new THREE.Group(), 'flake');
      for (let i = 0; i < 6; i++) {
        const arm = new THREE.Mesh(new THREE.PlaneGeometry(0.03, 0.62), additive(color, 0.7));
        arm.rotation.z = (i / 6) * Math.PI;
        arm.renderOrder = 999;
        flake.add(arm);
        for (let k = 1; k <= 2; k++) {
          const tw = new THREE.Mesh(new THREE.PlaneGeometry(0.02, 0.12), additive(white, 0.6));
          const a = (i / 6) * Math.PI * 2;
          tw.position.set(Math.sin(a) * 0.12 * k, Math.cos(a) * 0.12 * k, 0);
          tw.rotation.z = -a + 0.6;
          tw.renderOrder = 999;
          flake.add(tw);
        }
      }
      add(new THREE.Mesh(new THREE.CircleGeometry(0.58, 6), additive(color, 0.08)));
      add(new THREE.Mesh(new THREE.CircleGeometry(0.62, 6), additive(white, 0.5)), 'perfect');
      break;
    }
    case 'whip': {
      // 雷蛇の結界: 渦を巻く光の鞭
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 120; i++) {
        const t = i / 120;
        const a = t * Math.PI * 4;
        pts.push(new THREE.Vector3(Math.cos(a) * (0.25 + t * 0.35), Math.sin(a) * (0.25 + t * 0.35), 0));
      }
      add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat(color, 0.85)), 'coil');
      add(new THREE.Mesh(new THREE.RingGeometry(0.58, 0.6, 64), additive(white, 0.5)), 'rim');
      add(new THREE.Mesh(new THREE.CircleGeometry(0.6, 48), additive(color, 0.06)));
      break;
    }
    case 'disc': {
      // 円月の盾: 回転する金輪と刃
      const disc = add(new THREE.Group(), 'disc');
      disc.add(new THREE.Mesh(new THREE.RingGeometry(0.5, 0.56, 64), additive(color, 0.8)));
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const b = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.12, 3), additive(white, 0.8));
        b.position.set(Math.cos(a) * 0.6, Math.sin(a) * 0.6, 0);
        b.rotation.z = a - Math.PI / 2 - 0.5;
        b.renderOrder = 999;
        disc.add(b);
      }
      add(new THREE.Mesh(new THREE.CircleGeometry(0.5, 48), additive(color, 0.07)));
      break;
    }
    default: {
      add(new THREE.Mesh(new THREE.RingGeometry(0.3, 0.75, 6), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: 0.6, wireframe: true, depthTest: false })), 'hexRing');
    }
  }
  tagOpacity(g);
  g.visible = false;
  return g;
}

export interface GuardFxState {
  /** 0..1 fade in/out */
  strength: number;
  /** 0..1 impact flash (decays) */
  flash: number;
  /** seconds since guard started */
  held: number;
  perfectWindow: number;
  lanceCharge: number;
}

/** Animates a guard effect built by buildGuardFx. */
export function updateGuardFx(g: THREE.Group, t: number, s: GuardFxState): void {
  g.visible = s.strength > 0.01;
  if (!g.visible) return;
  const style = g.userData.style as MeleeStyle;
  const k = s.strength;
  const fl = s.flash;
  const inPerfect = s.perfectWindow > 0 && s.held <= s.perfectWindow;

  g.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.Material | undefined;
    if (m && !Array.isArray(m) && m.userData.baseOpacity !== undefined) {
      m.opacity = Math.min(1, m.userData.baseOpacity * k * (1 + fl * 1.2));
    }
  });
  g.scale.setScalar(0.85 + 0.15 * k + fl * 0.08);
  const get = (n: string) => g.getObjectByName(n);

  switch (style) {
    case 'katana': {
      const p = get('perfect') as THREE.Mesh;
      const ph = get('perfectHalo') as THREE.Mesh;
      const w = inPerfect ? 1 - s.held / s.perfectWindow : 0;
      p.visible = ph.visible = w > 0 || fl > 0.2;
      p.scale.x = 0.2 + 0.8 * (inPerfect ? w : fl);
      ph.scale.x = p.scale.x;
      get('arc')!.rotation.z = Math.sin(t * 2) * 0.03;
      break;
    }
    case 'gauntlets': {
      get('shell')!.rotation.set(t * 0.6, t * 0.9, 0);
      const bolts = get('bolts') as THREE.LineSegments;
      if (Math.floor(t * 18) !== bolts.userData.tick) {
        bolts.userData.tick = Math.floor(t * 18);
        const pos = bolts.geometry.getAttribute('position') as THREE.BufferAttribute;
        let idx = 0;
        for (let b = 0; b < 6; b++) {
          const a0 = Math.random() * Math.PI * 2;
          const p0 = Math.random() * Math.PI;
          let prev = new THREE.Vector3().setFromSphericalCoords(0.52, p0, a0);
          for (let sgm = 0; sgm < 7; sgm++) {
            const next = new THREE.Vector3().setFromSphericalCoords(0.52, p0 + (Math.random() - 0.5) * 0.5, a0 + (sgm + 1) * 0.18);
            pos.setXYZ(idx++, prev.x, prev.y, prev.z);
            pos.setXYZ(idx++, next.x, next.y, next.z);
            prev = next;
          }
        }
        pos.needsUpdate = true;
      }
      break;
    }
    case 'twinblade': {
      get('orbit')!.rotation.z = t * 1.4;
      get('star')!.rotation.z = -t * 0.9;
      const pf = get('perfect') as THREE.Mesh;
      pf.visible = inPerfect || fl > 0.2;
      pf.scale.setScalar(inPerfect ? 2.5 - (s.held / s.perfectWindow) * 1.5 : 1 + fl * 4);
      break;
    }
    case 'hammer': {
      for (let i = 0; i < 3; i++) {
        const r = get(`orbit${i}`)!;
        r.rotation.z = t * (0.8 + i * 0.5) * (i % 2 ? -1 : 1);
        r.rotation.y += 0.004 * (i + 1);
      }
      get('membrane')!.scale.setScalar(1 + Math.sin(t * 3) * 0.02 + fl * 0.12);
      get('well')!.rotation.z = -t * 1.5;
      break;
    }
    case 'glaive': {
      get('disc')!.rotation.z = -t * 14;
      get('blades')!.rotation.z = -t * 18;
      break;
    }
    case 'dagger': {
      for (let i = 0; i < 4; i++) {
        const f = get(`ghost${i}`)!;
        const jitter = inPerfect ? 0.05 : 0.02;
        f.position.x = Math.sin(t * (7 + i * 3) + i) * jitter * (i + 1);
        f.position.y = Math.cos(t * (5 + i * 2) + i) * jitter * 0.6 * (i + 1);
        f.rotation.z = Math.sin(t * 3 + i) * 0.03 * i;
      }
      const core = get('core')!;
      core.rotation.z = t * 2;
      core.scale.setScalar(inPerfect ? 1.4 : 1);
      break;
    }
    case 'chainspear': {
      get('chain')!.rotation.z = t * 4.5;
      const hook = get('hook')!;
      const a = t * 4.5;
      hook.position.set(Math.cos(a) * 0.6, Math.sin(a) * 0.6, 0);
      hook.rotation.z = a;
      break;
    }
    case 'scythe': {
      get('spiral')!.rotation.z = t * 3;
      get('spiral2')!.rotation.z = Math.PI + t * 3;
      get('void')!.scale.setScalar(1 + Math.sin(t * 4) * 0.04 + fl * 0.15);
      break;
    }
    case 'lance': {
      const plate = get('plate')!;
      plate.position.z = -fl * 0.05;
      for (let i = 0; i < LANCE_MAX_CHARGE; i++) {
        const pip = get(`pip${i}`) as THREE.Mesh;
        const on = i < s.lanceCharge;
        (pip.material as THREE.MeshBasicMaterial).opacity = (on ? 0.95 : 0.15) * k;
        pip.scale.setScalar(on ? 1.2 + Math.sin(t * 8 + i) * 0.15 : 1);
      }
      break;
    }
    case 'anchor': {
      for (let i = 0; i < 3; i++) {
        const r = get(`ripple${i}`) as THREE.Mesh;
        const rm = r.material as THREE.MeshBasicMaterial;
        const ph = (t * 0.7 + i / 3) % 1;
        r.scale.setScalar(0.5 + ph * 1.0);
        rm.opacity = Math.min(1, (rm.userData.baseOpacity ?? 0.5) * k * (1 - ph) * 1.6);
      }
      get('moor')!.position.y = -0.04 * Math.sin(t * 2) - fl * 0.06;
      break;
    }
    case 'chainsaw': {
      get('saw')!.rotation.z = -t * 22;
      get('rim')!.scale.setScalar(1 + fl * 0.1);
      const sparks = get('sparks') as THREE.LineSegments;
      if (Math.floor(t * 30) !== sparks.userData.tick) {
        sparks.userData.tick = Math.floor(t * 30);
        const pos = sparks.geometry.getAttribute('position') as THREE.BufferAttribute;
        for (let i = 0; i < 10; i++) {
          // 刃の外周から接線方向へ飛ぶ火花
          const a = Math.random() * Math.PI * 2;
          const len = 0.08 + Math.random() * (0.18 + fl * 0.3);
          const x0 = Math.cos(a) * 0.6;
          const y0 = Math.sin(a) * 0.6;
          pos.setXYZ(i * 2, x0, y0, 0);
          pos.setXYZ(i * 2 + 1, x0 + Math.sin(a) * len, y0 - Math.cos(a) * len, 0);
        }
        pos.needsUpdate = true;
      }
      break;
    }
    case 'rapier': {
      get('flake')!.rotation.z = t * 0.6;
      const pf = get('perfect') as THREE.Mesh;
      pf.visible = inPerfect || fl > 0.2;
      pf.scale.setScalar(inPerfect ? 1 - (s.held / s.perfectWindow) * 0.3 : 1 + fl * 0.3);
      break;
    }
    case 'whip': {
      get('coil')!.rotation.z = -t * 9;
      get('rim')!.scale.setScalar(1 + fl * 0.12);
      break;
    }
    case 'disc': {
      get('disc')!.rotation.z = -t * 12;
      break;
    }
    default: {
      const r = get('hexRing');
      if (r) r.rotation.z = t * 1.8;
    }
  }
}
