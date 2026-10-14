/**
 * CYBER CORE - INFIGHT (近接) weapon style definitions
 *
 * 各近接武器に固有のスイングモーション（キーフレーム）と挙動パラメータを定義します。
 * このモジュールは three.js に依存しない純粋な数値計算のみを行います。
 *
 *   x,y,z   : カメラ空間でのビューモデル位置（絶対値）
 *   rx,ry,rz: ビューモデル回転（three.js の Euler 'XYZ' 順、絶対値）
 *
 * getMeleeSwingPose() は「待機姿勢(BASE)からの差分」を返します。
 * （既存のビューモデル処理が差分を加算する設計のため）
 */

export type MeleeStyle =
  | 'katana'
  | 'glaive'
  | 'dagger'
  | 'chainspear'
  | 'scythe'
  | 'hammer'
  | 'gauntlets'
  | 'twinblade'
  | 'lance'
  | 'chainsaw'
  | 'anchor'
  | 'rapier'
  | 'whip'
  | 'disc'
  | 'generic';

export interface SwingPose {
  x: number;
  y: number;
  z: number;
  rx: number;
  ry: number;
  rz: number;
}

export interface ArmPose extends SwingPose {}

export function getMeleeStyle(weapon: { id: string; modelType: string }): MeleeStyle {
  switch (weapon.id) {
    case 'blade_katana':
      return 'katana';
    case 'blade_glaive':
      return 'glaive';
    case 'blade_tachyon':
      return 'dagger';
    case 'blade_chainspear':
      return 'chainspear';
    case 'blade_scythe':
      return 'scythe';
    case 'blade_axe':
      return 'hammer';
    case 'blade_gauntlets':
      return 'gauntlets';
    case 'blade_astro_zwill':
      return 'twinblade';
    case 'blade_thunder_lance':
      return 'lance';
    case 'blade_chainsaw':
      return 'chainsaw';
    case 'blade_anchor':
      return 'anchor';
    case 'blade_rapier':
      return 'rapier';
    case 'blade_whip':
      return 'whip';
    case 'blade_disc':
      return 'disc';
    default:
      break;
  }
  if (weapon.modelType === 'gauntlets') return 'gauntlets';
  if (weapon.modelType === 'twinblade') return 'twinblade';
  if (weapon.modelType === 'axe') return 'hammer';
  if (weapon.modelType === 'katana') return 'katana';
  if (weapon.modelType === 'blade') return 'glaive';
  return 'generic';
}

export interface MeleeProfile {
  /** スイング速度（1.0 = 1秒で1モーション）。step 1..4 */
  speed: [number, number, number, number];
  /** 刃が当たる（ダメージ判定が視覚的に重なる）モーション進行度 0..1。step 1..4 */
  impact: [number, number, number, number];
  /** 連打防止の最小入力間隔(秒) */
  minInterval: number;
  /** 前方への踏み込み量。step 1..4 */
  lunge: [number, number, number, number];
  /** 攻撃判定で使う前方コサイン（小さいほど広角） */
  arcDot: number;
  /** 攻撃名（HUDアナウンス用） step 1..4 */
  moveNames: [string, string, string, string];
}

export const MELEE_PROFILES: Record<MeleeStyle, MeleeProfile> = {
  // 居合：速く鋭い。踏み込みで間合いを詰める
  katana: {
    speed: [3.6, 3.6, 2.7, 3.2],
    impact: [0.34, 0.34, 0.5, 0.45],
    minInterval: 0.16,
    lunge: [4.2, 4.2, 6.2, 4.6],
    arcDot: 0.32,
    moveNames: ['IAI DRAW SLASH', 'RISING REVERSE CUT', 'SKYFALL FLASH', 'CIRCLE FLASH'],
  },
  // 長柄：大振りで広範囲、遠心力で重い
  glaive: {
    speed: [2.6, 2.6, 2.1, 2.5],
    impact: [0.4, 0.4, 0.62, 0.45],
    minInterval: 0.26,
    lunge: [3.0, 3.0, 5.0, 3.6],
    arcDot: 0.0,
    moveNames: ['WIDE SWEEP', 'BACKHAND SWEEP', 'HELICOPTER SLAM', 'WHIRLWIND'],
  },
  // 短剣：超高速の連撃。フィニッシュは二連突き
  dagger: {
    speed: [5.4, 5.4, 3.8, 4.4],
    impact: [0.3, 0.3, 0.5, 0.4],
    minInterval: 0.1,
    lunge: [1.6, 1.6, 2.4, 2.0],
    arcDot: 0.4,
    moveNames: ['PHASE FLICK', 'REVERSE FLICK', 'TWIN PIERCE', 'PHASE SPIN'],
  },
  // 鎖槍：銛を射出して引き戻す
  chainspear: {
    speed: [3.0, 2.9, 2.2, 2.5],
    impact: [0.36, 0.36, 0.5, 0.45],
    minInterval: 0.28,
    lunge: [0.8, 0.8, 1.6, 1.2],
    arcDot: 0.45,
    moveNames: ['HARPOON SHOT', 'ARC HARPOON', 'ABYSS ANCHOR', 'CHAIN WHIRL'],
  },
  // 大鎌：三日月状の刈り取りと引き裂き
  scythe: {
    speed: [2.5, 2.5, 2.1, 2.4],
    impact: [0.42, 0.42, 0.6, 0.45],
    minInterval: 0.26,
    lunge: [2.6, 2.6, 3.8, 3.2],
    arcDot: -0.15,
    moveNames: ['CRESCENT REAP', 'RETURN REAP', 'SOUL RIP', 'TORNADO REAP'],
  },
  // 重力ハンマー：溜めて叩きつける。着弾で衝撃波
  hammer: {
    speed: [1.8, 1.7, 1.45, 1.6],
    impact: [0.52, 0.5, 0.58, 0.5],
    minInterval: 0.4,
    lunge: [1.2, 1.2, 1.8, 1.8],
    arcDot: 0.0,
    moveNames: ['GRAVITY SMASH', 'GROUND SWEEP', 'METEOR DROP', 'QUAKE SPIN'],
  },
  // 拳：左右交互のパンチ
  gauntlets: {
    speed: [4.6, 4.6, 3.4, 3.2],
    impact: [0.36, 0.36, 0.45, 0.45],
    minInterval: 0.13,
    lunge: [2.4, 2.4, 4.4, 4.6],
    arcDot: 0.45,
    moveNames: ['LEFT JAB', 'RIGHT CROSS', 'DUAL PALM BLAST', 'MEGA THUNDER PALM'],
  },
  // 双剣：右→左→十字の三段。軽快で手数が多い
  twinblade: {
    speed: [4.2, 4.2, 3.0, 2.8],
    impact: [0.36, 0.36, 0.46, 0.5],
    minInterval: 0.12,
    lunge: [3.0, 3.0, 5.0, 3.6],
    arcDot: 0.1,
    moveNames: ['STAR SLASH R', 'STAR SLASH L', 'TWIN NOVA X', 'TWIN CYCLONE'],
  },
  // パイルバンカー：溜めて撃ち出す
  lance: {
    speed: [2.6, 2.6, 2.2, 2.4],
    impact: [0.45, 0.45, 0.55, 0.5],
    minInterval: 0.3,
    lunge: [3.4, 3.4, 5.4, 4.2],
    arcDot: 0.45,
    moveNames: ['STAKE SHOT', 'FOLLOW-UP STAKE', 'DEEP PENETRATOR', 'STAKE CHARGE'],
  },
  // チェーンソー：長押しで振り下ろし→押し当てて削り続ける（通常の段コンボは使わない。step 4 = RIPPER RUSH）
  chainsaw: {
    speed: [3.4, 3.4, 3.0, 2.2],
    impact: [0.5, 0.5, 0.5, 0.3],
    minInterval: 0.05,
    lunge: [1.2, 1.2, 1.2, 0],
    arcDot: 0.35,
    moveNames: ['RAVAGE DROP', 'RAVAGE GRIND', 'RAVAGE GRIND', 'RIPPER RUSH'],
  },
  // 大錨：重い振り回し。叩きつけた敵を「係留」して動きを封じる
  anchor: {
    speed: [2.2, 2.2, 1.6, 2.0],
    impact: [0.46, 0.46, 0.6, 0.5],
    minInterval: 0.34,
    lunge: [2.2, 2.2, 3.0, 2.6],
    arcDot: -0.05,
    moveNames: ['FLUKE SWEEP', 'BACK FLUKE HOOK', 'ANCHOR DROP', 'DEEP HEAVE'],
  },
  // 氷晶細剣：突きの三連。速く、まっすぐ、遠くへ
  rapier: {
    speed: [4.4, 4.4, 2.6, 3.2],
    impact: [0.36, 0.36, 0.3, 0.45],
    minInterval: 0.12,
    lunge: [3.0, 3.0, 4.6, 3.6],
    arcDot: 0.62,
    moveNames: ['GLACIER LUNGE', 'RIME THRUST', 'DIAMOND FLURRY', 'FROST CIRCLE'],
  },
  // 雷蛇鞭：長い間合いの鞭打ち。2段目は横薙ぎ、3段目は絡め取って引き寄せる
  whip: {
    speed: [2.8, 2.6, 2.2, 2.4],
    impact: [0.42, 0.44, 0.46, 0.45],
    minInterval: 0.24,
    lunge: [0.6, 0.6, 0.4, 1.0],
    arcDot: 0.55,
    moveNames: ['VIPER CRACK', 'SERPENT LASH', 'COIL SNARE', 'STORM COIL'],
  },
  // 円月輪：投げて戻ってくる二枚の刃。手元へ戻るまで同じ側は投げられない
  disc: {
    speed: [3.4, 3.4, 2.6, 2.6],
    impact: [0.4, 0.4, 0.42, 0.45],
    minInterval: 0.18,
    lunge: [0.8, 0.8, 1.2, 1.0],
    arcDot: 0.5,
    moveNames: ['RONDO R', 'RONDO L', 'CROSS ECLIPSE', 'HALO ORBIT'],
  },
  generic: {
    speed: [3.2, 3.2, 3.0, 3.4],
    impact: [0.4, 0.4, 0.5, 0.45],
    minInterval: 0.2,
    lunge: [3.4, 3.4, 5.4, 4.2],
    arcDot: 0.45,
    moveNames: ['COMBO 1', 'COMBO 2', 'COMBO 3', 'SWEEP'],
  },
};

export function getMeleeProfile(style: MeleeStyle): MeleeProfile {
  return MELEE_PROFILES[style];
}

/* -------------------------------------------------------------------------- */
/*  Keyframe interpolation                                                    */
/* -------------------------------------------------------------------------- */

type Ease = 'lin' | 'io' | 'in' | 'out' | 'back';
/** [t, x, y, z, rx, ry, rz, ease(目的キーへの補間カーブ)] */
type KF = [number, number, number, number, number, number, number, Ease?];

/** 待機姿勢（近接武器共通）。BattleScene3D の Ready stance と一致させる */
export const MELEE_BASE: SwingPose = { x: 0.28, y: -0.25, z: -0.52, rx: 0.1, ry: -0.2, rz: 0.26 };

const B = MELEE_BASE;
const REST = (t: number, ease: Ease = 'io'): KF => [t, B.x, B.y, B.z, B.rx, B.ry, B.rz, ease];

function ease(kind: Ease, u: number): number {
  switch (kind) {
    case 'in':
      return u * u * u;
    case 'out':
      return 1 - Math.pow(1 - u, 3);
    case 'back': {
      const c1 = 1.9;
      const c3 = c1 + 1;
      return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2);
    }
    case 'lin':
      return u;
    default:
      return u * u * (3 - 2 * u);
  }
}

function sample(frames: KF[], p: number): SwingPose {
  const pp = Math.min(1, Math.max(0, p));
  let i = 0;
  while (i < frames.length - 2 && pp > frames[i + 1][0]) i++;
  const a = frames[i];
  const b = frames[i + 1];
  const span = Math.max(1e-5, b[0] - a[0]);
  const u = Math.min(1, Math.max(0, (pp - a[0]) / span));
  const e = ease(b[7] ?? 'io', u);
  const an = a as unknown as number[];
  const bn = b as unknown as number[];
  const L = (k: number) => an[k] + (bn[k] - an[k]) * e;
  return { x: L(1), y: L(2), z: L(3), rx: L(4), ry: L(5), rz: L(6) };
}

function diff(abs: SwingPose): SwingPose {
  return { x: abs.x - B.x, y: abs.y - B.y, z: abs.z - B.z, rx: abs.rx - B.rx, ry: abs.ry - B.ry, rz: abs.rz - B.rz };
}

const TAU = Math.PI * 2;

/* -------------------------------------------------------------------------- */
/*  Per-weapon swing keyframes                                                */
/* -------------------------------------------------------------------------- */

const SWINGS: Record<string, KF[]> = {
  /* ---------------- KATANA : 居合。溜め→一瞬で斬る→残心 ---------------- */
  'katana:1': [
    REST(0),
    [0.14, 0.52, -0.36, -0.32, -1.3, -0.24, -1.18, 'io'], // 右腰へ引く（抜刀の構え・体を捻る）
    [0.21, 0.55, -0.37, -0.3, -1.33, -0.27, -1.24, 'lin'], // 鞘走りの一瞬の溜め
    [0.37, -0.38, -0.17, -0.66, -1.44, -0.02, 1.34, 'out'], // 横一閃（振り抜き過ぎるほど速く）
    [0.6, -0.3, -0.21, -0.6, -1.38, -0.1, 1.22, 'io'], // 残心（わずかに戻して止める）
    REST(1),
  ],
  'katana:2': [
    REST(0),
    [0.14, -0.24, -0.52, -0.38, -1.02, -0.6, 1.3, 'io'], // 左下へ沈める
    [0.2, -0.26, -0.54, -0.37, -1.04, -0.62, 1.34, 'lin'],
    [0.37, 0.4, 0.07, -0.66, -0.98, 0.46, -1.24, 'out'], // 右上へ逆袈裟
    [0.6, 0.36, 0.04, -0.6, -0.97, 0.4, -1.16, 'io'],
    REST(1),
  ],
  'katana:3': [
    REST(0),
    [0.26, 0.12, 0.3, -0.28, 0.6, -0.1, 0.12, 'io'], // 大上段へ振りかぶる
    [0.34, 0.13, 0.33, -0.27, 0.66, -0.1, 0.12, 'lin'], // 一瞬の溜め（刃が震える間）
    [0.5, -0.03, -0.44, -0.74, -2.08, 0.0, 0.0, 'in'], // 唐竹割り（加速して振り下ろす）
    [0.56, -0.02, -0.39, -0.7, -1.9, 0.0, 0.0, 'out'], // 地面すれすれで止めた反動
    [0.76, 0.0, -0.42, -0.66, -1.95, 0.0, 0.0, 'io'],
    REST(1),
  ],
  'katana:4': [
    REST(0),
    [0.14, 0.4, -0.3, -0.4, -1.36, -0.1, -1.0, 'io'],
    [0.6, 0.0, -0.25, -0.5, -1.4, -0.1, -1.0 + TAU, 'io'], // 一回転の円斬
    REST(1),
  ],

  /* ---------------- GLAIVE : 長柄の大振り（遠心力）---------------- */
  'glaive:1': [
    REST(0),
    [0.22, 0.52, -0.2, -0.3, -0.95, -0.2, -1.25, 'io'], // 右後方へ大きく引く
    [0.55, -0.42, -0.3, -0.72, -1.38, -0.1, 1.45, 'in'], // 広い横薙ぎ
    [0.78, -0.5, -0.32, -0.66, -1.36, -0.1, 1.6, 'out'],
    REST(1),
  ],
  'glaive:2': [
    REST(0),
    [0.22, -0.46, -0.4, -0.35, -1.1, 0.1, 1.5, 'io'],
    [0.55, 0.46, -0.02, -0.7, -1.28, 0.1, -1.5, 'in'], // 逆手で斬り上げ
    [0.78, 0.5, 0.0, -0.64, -1.22, 0.1, -1.6, 'out'],
    REST(1),
  ],
  'glaive:3': [
    REST(0),
    [0.18, 0.1, 0.12, -0.38, -0.45, 0.0, 0.2, 'io'], // 頭上へ持ち上げる
    [0.5, 0.0, 0.14, -0.42, -0.45, 0.0, 0.2 - TAU * 1.0, 'io'], // 風車回し
    [0.7, 0.0, -0.5, -0.9, -2.05, 0.0, -0.3 - TAU, 'in'], // 叩きつけ
    [0.86, 0.0, -0.52, -0.85, -2.0, 0.0, -0.3 - TAU, 'out'],
    REST(1),
  ],
  'glaive:4': [
    REST(0),
    [0.12, 0.42, -0.3, -0.36, -1.45, -0.1, -0.8, 'io'],
    [0.7, 0.0, -0.3, -0.5, -1.45, -0.1, -0.8 + TAU * 1.0, 'io'], // 水平一回転
    REST(1),
  ],

  /* ---------------- SCYTHE : 三日月の刈り取り ---------------- */
  'scythe:1': [
    REST(0),
    [0.22, 0.55, -0.3, -0.36, -0.7, -0.45, -0.95, 'io'],
    [0.55, -0.42, -0.28, -0.66, -1.0, -0.15, 1.25, 'in'], // 横一文字に刈り取る
    [0.78, -0.5, -0.3, -0.6, -1.0, -0.15, 1.35, 'out'],
    REST(1),
  ],
  'scythe:2': [
    REST(0),
    [0.22, -0.5, -0.42, -0.36, -0.9, 0.3, 1.2, 'io'],
    [0.55, 0.5, -0.12, -0.66, -1.1, 0.1, -1.1, 'in'], // 戻り刃で斬り上げ
    [0.78, 0.55, -0.1, -0.6, -1.1, 0.1, -1.2, 'out'],
    REST(1),
  ],
  'scythe:3': [
    REST(0),
    [0.26, 0.2, 0.3, -0.2, 0.7, 0.0, 0.3, 'io'], // 大きく振り上げる
    [0.58, 0.0, -0.45, -0.66, -1.4, 0.0, 0.1, 'in'], // 引っ掛けて手前に引き裂く
    [0.8, 0.0, -0.22, -0.34, -0.5, 0.0, 0.1, 'out'], // 引き寄せ
    REST(1),
  ],
  'scythe:4': [
    REST(0),
    [0.12, 0.45, -0.28, -0.36, -1.3, -0.3, -0.8, 'io'],
    [0.72, 0.0, -0.28, -0.5, -1.3, -0.3, -0.8 + TAU * 1.0, 'io'], // 竜巻のように一回転
    REST(1),
  ],

  /* ---------------- HAMMER : 重い溜め→叩きつけ→余韻 ---------------- */
  'hammer:1': [
    REST(0),
    [0.4, 0.3, 0.18, -0.2, 0.95, -0.05, 0.1, 'io'], // 頭上へ持ち上げる（画面外へ）
    [0.52, 0.04, -0.48, -0.78, -1.45, 0.0, 0.0, 'in'], // 垂直に叩きつけ
    [0.64, 0.04, -0.4, -0.72, -1.3, 0.0, 0.0, 'back'], // 反動
    [0.86, 0.04, -0.46, -0.76, -1.4, 0.0, 0.0, 'lin'], // めり込み
    REST(1),
  ],
  'hammer:2': [
    REST(0),
    [0.4, 0.62, -0.4, -0.3, -0.5, -0.5, -1.1, 'io'], // 右後方へ振りかぶる
    [0.56, -0.46, -0.46, -0.72, -1.05, 0.2, 1.2, 'in'], // 地面すれすれの薙ぎ払い
    [0.76, -0.5, -0.46, -0.66, -1.0, 0.2, 1.3, 'out'],
    REST(1),
  ],
  'hammer:3': [
    REST(0),
    [0.42, 0.22, 0.34, -0.1, 1.1, 0.0, 0.2, 'io'], // さらに高く（跳躍）
    [0.58, 0.0, -0.58, -0.82, -1.55, 0.0, 0.0, 'in'], // 隕石のように叩き落とす
    [0.7, 0.0, -0.48, -0.74, -1.35, 0.0, 0.0, 'back'],
    [0.88, 0.0, -0.54, -0.8, -1.5, 0.0, 0.0, 'lin'],
    REST(1),
  ],
  'hammer:4': [
    REST(0),
    [0.22, 0.4, -0.4, -0.3, -0.9, -0.4, -1.0, 'io'],
    [0.7, 0.0, -0.45, -0.55, -1.2, 0.0, -1.0 + TAU, 'io'], // 重量級の一回転
    REST(1),
  ],

  /* ---------------- ANCHOR : 重い振り回し。薙ぎ → 引っ掛け → 碇落とし ---------------- */
  'anchor:1': [
    REST(0),
    [0.4, 0.62, -0.4, -0.3, -0.45, -0.55, -1.0, 'io'], // 右後方へ大きく引く
    [0.56, -0.5, -0.36, -0.72, -1.0, 0.3, 1.2, 'in'], // 錨の腕で横薙ぎ
    [0.78, -0.56, -0.36, -0.64, -0.95, 0.3, 1.3, 'out'], // 慣性で流れる
    REST(1),
  ],
  'anchor:2': [
    REST(0),
    [0.4, -0.5, -0.42, -0.3, -0.5, 0.5, 1.1, 'io'], // 左へ振りかぶる
    [0.56, 0.4, -0.3, -0.62, -1.15, -0.3, -1.15, 'in'], // 逆から腕を引っ掛ける
    [0.76, 0.1, -0.3, -0.5, -1.0, -0.2, -0.9, 'out'], // 手前へ引き込む
    REST(1),
  ],
  'anchor:3': [
    REST(0),
    [0.46, 0.2, 0.32, -0.15, 1.05, -0.05, 0.15, 'io'], // 頭上へ高く掲げる
    [0.62, 0.02, -0.62, -0.84, -1.55, 0.0, 0.0, 'in'], // 一気に叩き落とす（投錨）
    [0.74, 0.02, -0.5, -0.74, -1.35, 0.0, 0.0, 'back'], // 反動
    [0.9, 0.02, -0.56, -0.8, -1.5, 0.0, 0.0, 'lin'], // 地面に食い込む
    REST(1),
  ],
  'anchor:4': [
    REST(0),
    [0.25, 0.4, -0.4, -0.3, -0.9, -0.4, -1.0, 'io'],
    [0.72, 0.0, -0.4, -0.55, -1.2, 0.0, -1.0 + TAU, 'io'], // 鎖ごと大きく一回転
    REST(1),
  ],

  /* ---------------- DAGGER : 小さく速い。フィニッシュは二連突き ---------------- */
  'dagger:1': [
    REST(0),
    [0.18, 0.42, -0.2, -0.4, 0.0, -0.75, 0.5, 'io'],
    [0.42, -0.14, -0.2, -0.56, 0.0, 0.85, -0.2, 'out'], // 右→左へ小さく払う
    REST(1),
  ],
  'dagger:2': [
    REST(0),
    [0.18, -0.12, -0.24, -0.4, 0.0, 0.8, -0.6, 'io'],
    [0.42, 0.4, -0.18, -0.58, 0.0, -0.7, 0.4, 'out'], // 左→右へ払い戻し
    REST(1),
  ],
  'dagger:3': [
    REST(0),
    [0.14, 0.3, -0.22, -0.3, 0.1, -0.2, 0.3, 'io'], // 引く
    [0.3, 0.06, -0.14, -0.72, -0.05, 0.0, 0.0, 'out'], // 突き1
    [0.42, 0.22, -0.2, -0.38, 0.12, -0.1, 0.2, 'io'], // 引く
    [0.58, -0.04, -0.1, -0.8, -0.08, 0.05, -0.1, 'out'], // 突き2（深い）
    [0.76, 0.02, -0.12, -0.74, -0.05, 0.0, 0.0, 'lin'],
    REST(1),
  ],
  'dagger:4': [
    REST(0),
    [0.18, 0.2, -0.2, -0.46, -0.1, -0.3, 0.2, 'io'],
    [0.62, 0.0, -0.2, -0.5, -0.1, -0.3 - TAU, 0.2, 'io'], // その場で高速旋回
    REST(1),
  ],

  /* ---------------- CHAIN SPEAR : 引いて→射出→鎖を巻き戻す ---------------- */
  'chainspear:1': [
    REST(0),
    [0.2, 0.34, -0.2, -0.3, 0.2, -0.1, 0.0, 'io'], // 引き絞る
    [0.4, 0.08, -0.1, -1.1, -0.04, 0.05, 0.9, 'out'], // 射出（スピン）
    [0.58, 0.08, -0.1, -1.1, -0.04, 0.05, 1.6, 'lin'], // 伸びきった状態
    REST(1, 'io'), // 鎖を巻き戻す（ゆっくり）
  ],
  'chainspear:2': [
    REST(0),
    [0.22, 0.44, 0.22, -0.34, 0.5, -0.2, 0.3, 'io'], // 上方に振りかぶる
    [0.42, -0.1, -0.22, -1.05, -0.38, 0.18, 1.0, 'out'], // 斜め下へ投擲
    [0.6, -0.1, -0.22, -1.05, -0.38, 0.18, 1.7, 'lin'],
    REST(1),
  ],
  'chainspear:3': [
    REST(0),
    [0.3, 0.46, -0.02, -0.12, 0.5, -0.3, 0.6, 'io'], // 全身で引き絞る
    [0.5, 0.0, -0.12, -1.2, -0.06, 0.0, 1.6, 'out'], // 巨大な銛を叩き込む
    [0.68, 0.0, -0.12, -1.2, -0.06, 0.0, 2.6, 'lin'],
    REST(1),
  ],
  'chainspear:4': [
    REST(0),
    [0.16, 0.5, -0.2, -0.5, -0.1, -0.5, 0.2, 'io'],
    [0.7, 0.0, -0.15, -0.7, -0.1, -0.5 - TAU, 0.2, 'io'], // 鎖を振り回す
    REST(1),
  ],

  /* ---------------- LANCE : パイルバンカー（溜め→射出）---------------- */
  'lance:1': [
    REST(0),
    [0.3, 0.3, -0.2, -0.3, 0.05, -0.1, 0.1, 'io'], // 後ろへ引いて溜める（微振動は別途）
    [0.46, 0.12, -0.12, -1.1, -0.03, 0.0, 0.0, 'out'], // 杭射出
    [0.66, 0.12, -0.12, -1.04, -0.03, 0.0, 0.0, 'lin'],
    REST(1),
  ],
  'lance:2': [
    REST(0),
    [0.3, 0.3, -0.2, -0.3, 0.05, -0.1, 0.1, 'io'],
    [0.46, 0.12, -0.12, -1.1, -0.03, 0.0, 0.0, 'out'],
    [0.66, 0.12, -0.12, -1.04, -0.03, 0.0, 0.0, 'lin'],
    REST(1),
  ],
  'lance:3': [
    REST(0),
    [0.38, 0.4, -0.26, -0.18, 0.1, -0.1, 0.1, 'io'],
    [0.55, 0.1, -0.1, -1.25, -0.04, 0.0, 0.0, 'out'],
    [0.72, 0.1, -0.1, -1.18, -0.04, 0.0, 0.0, 'lin'],
    REST(1),
  ],
  'lance:4': [
    REST(0),
    [0.38, 0.4, -0.26, -0.18, 0.1, -0.1, 0.1, 'io'],
    [0.55, 0.1, -0.1, -1.25, -0.04, 0.0, 0.0, 'out'],
    REST(1),
  ],

  /* ---------------- CHAINSAW : 長押し中は getChainsawGrindPose を使う。ここは汎用の振り下ろし ---------------- */
  'chainsaw:1': [
    REST(0),
    [0.3, 0.18, 0.06, -0.38, 0.55, -0.1, 0.1, 'io'],
    [0.6, 0.12, -0.3, -0.66, -1.62, 0.04, 0.06, 'in'],
    REST(1),
  ],
  'chainsaw:4': [
    REST(0),
    [0.2, 0.08, -0.26, -0.78, -1.5, 0.0, 0.0, 'out'],
    [0.8, 0.08, -0.26, -0.8, -1.5, 0.0, 0.0, 'lin'],
    REST(1),
  ],

  /* ---------------- RAPIER : 半身で引き絞って一直線に突く ---------------- */
  'rapier:1': [
    REST(0),
    [0.16, 0.36, -0.16, -0.24, -1.32, -0.18, 0.05, 'io'], // 剣先を前へ倒して肘を引く
    [0.22, 0.38, -0.15, -0.22, -1.34, -0.2, 0.05, 'lin'],
    [0.38, 0.1, -0.1, -1.0, -1.55, 0.02, 0.0, 'out'], // 一直線の突き
    [0.6, 0.12, -0.11, -0.94, -1.52, 0.0, 0.0, 'io'],
    REST(1),
  ],
  'rapier:2': [
    REST(0),
    [0.16, 0.32, -0.26, -0.24, -1.2, -0.3, 0.4, 'io'], // 低く構え直す
    [0.38, 0.04, -0.2, -1.02, -1.45, 0.08, 0.35, 'out'], // 下から伸び上がる突き
    [0.6, 0.06, -0.2, -0.96, -1.42, 0.06, 0.3, 'io'],
    REST(1),
  ],
  'rapier:3': [
    REST(0),
    [0.12, 0.34, -0.15, -0.2, -1.4, -0.2, 0.0, 'io'],
    [0.22, 0.06, -0.12, -1.0, -1.55, 0.04, 0.0, 'out'], // 突き1
    [0.3, 0.26, -0.13, -0.32, -1.45, -0.12, 0.0, 'io'],
    [0.4, 0.14, -0.04, -1.04, -1.6, 0.0, 0.2, 'out'], // 突き2（やや上）
    [0.48, 0.28, -0.15, -0.34, -1.45, -0.12, 0.0, 'io'],
    [0.6, 0.04, -0.18, -1.1, -1.5, 0.06, -0.2, 'out'], // 突き3（深い）
    [0.78, 0.06, -0.17, -1.04, -1.5, 0.04, -0.15, 'io'],
    REST(1),
  ],
  'rapier:4': [
    REST(0),
    [0.14, 0.4, -0.3, -0.4, -1.36, -0.1, -1.0, 'io'],
    [0.66, 0.0, -0.25, -0.5, -1.4, -0.1, -1.0 + TAU, 'io'], // 氷輪の円斬
    REST(1),
  ],

  /* ---------------- WHIP : 手首のスナップで鞭を走らせる（鞭本体は getWhipPoints） ---------------- */
  'whip:1': [
    REST(0),
    [0.22, 0.32, 0.14, -0.2, 0.75, -0.1, 0.05, 'io'], // 肩の上へ振りかぶる
    [0.4, 0.14, -0.24, -0.62, -0.75, 0.0, 0.0, 'in'], // 振り下ろしてスナップ
    [0.62, 0.16, -0.22, -0.58, -0.68, 0.0, 0.0, 'out'],
    REST(1),
  ],
  'whip:2': [
    REST(0),
    [0.24, 0.55, -0.14, -0.3, -0.5, -0.65, -0.4, 'io'], // 右後方へ引く
    [0.46, -0.32, -0.16, -0.6, -0.6, 0.55, 0.3, 'in'], // 横一文字に薙ぐ
    [0.66, -0.36, -0.17, -0.56, -0.58, 0.6, 0.32, 'out'],
    REST(1),
  ],
  'whip:3': [
    REST(0),
    [0.2, 0.2, 0.0, -0.3, 0.3, -0.1, 0.1, 'io'],
    [0.38, 0.1, -0.2, -0.75, -0.7, 0.0, 0.0, 'out'], // 打ち出して絡める
    [0.56, 0.1, -0.18, -0.7, -0.66, 0.0, 0.0, 'lin'],
    [0.74, 0.3, -0.1, -0.22, 0.2, -0.2, 0.0, 'in'], // 手前へ引き寄せる
    REST(1),
  ],
  'whip:4': [
    REST(0),
    [0.14, 0.2, 0.2, -0.3, 0.5, 0, 0.1, 'io'],
    [0.7, 0.0, 0.25, -0.35, 0.5, TAU * 2, 0.1, 'io'], // 頭上で振り回す
    REST(1),
  ],

  /* ---------------- DISC : 円月輪を投げる（横投げ→逆手→両手の交差投げ） ---------------- */
  'disc:1': [
    REST(0),
    [0.2, 0.5, -0.1, -0.1, -0.4, -0.9, -0.5, 'io'], // 外へ巻き込む
    [0.42, -0.05, -0.1, -0.7, -0.5, 0.7, 0.2, 'out'], // 手首を返して放つ
    [0.62, -0.08, -0.12, -0.64, -0.48, 0.75, 0.22, 'io'],
    REST(1),
  ],
  'disc:2': [
    REST(0),
    [0.2, -0.3, -0.12, -0.12, -0.3, 0.7, 0.6, 'io'],
    [0.42, 0.42, -0.08, -0.66, -0.5, -0.6, -0.3, 'out'],
    [0.62, 0.44, -0.1, -0.6, -0.48, -0.62, -0.32, 'io'],
    REST(1),
  ],
  'disc:3': [
    REST(0),
    [0.26, 0.1, 0.18, -0.06, 0.6, 0.0, 0.0, 'io'], // 両腕を頭上で交差
    [0.46, 0.04, -0.2, -0.8, -0.9, 0.0, 0.0, 'in'], // 振り下ろして放つ
    [0.68, 0.04, -0.2, -0.74, -0.86, 0.0, 0.0, 'io'],
    REST(1),
  ],
  'disc:4': [
    REST(0),
    [0.16, 0.3, -0.2, -0.3, -1.0, -0.3, -0.6, 'io'],
    [0.7, 0.0, -0.2, -0.45, -1.0, -0.3, -0.6 + TAU, 'io'],
    REST(1),
  ],

  /* ---------------- GENERIC : 汎用（旧モーションの簡易版）---------------- */
  'generic:1': [REST(0), [0.2, 0.5, -0.3, -0.4, -1.2, -0.1, -1.0, 'io'], [0.5, -0.3, -0.2, -0.6, -1.3, -0.1, 1.1, 'out'], REST(1)],
  'generic:2': [REST(0), [0.2, -0.2, -0.45, -0.4, -1.0, -0.4, 1.1, 'io'], [0.5, 0.36, 0.0, -0.6, -1.0, 0.3, -1.0, 'out'], REST(1)],
  'generic:3': [REST(0), [0.3, 0.1, 0.28, -0.3, 0.5, 0, 0.1, 'io'], [0.55, 0.0, -0.4, -0.7, -1.9, 0, 0, 'in'], REST(1)],
  'generic:4': [REST(0), [0.15, 0.4, -0.3, -0.4, -1.3, -0.1, -1.0, 'io'], [0.65, 0.0, -0.25, -0.5, -1.3, -0.1, -1.0 + TAU, 'io'], REST(1)],
};

/** ガントレット以外の近接武器のビューモデル姿勢（待機姿勢からの差分） */
export function getMeleeSwingPose(style: MeleeStyle, step: number, p: number): SwingPose {
  const s = Math.max(1, Math.min(4, Math.round(step)));
  const frames = SWINGS[`${style}:${s}`] || SWINGS[`generic:${s}`];
  return diff(sample(frames, p));
}

/* -------------------------------------------------------------------------- */
/*  Gauntlets : 左右の拳を個別に動かす                                           */
/* -------------------------------------------------------------------------- */

const ZERO: SwingPose = { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0 };

type AF = [number, number, number, number, number, number, number, Ease?];
const AREST = (t: number, e: Ease = 'io'): AF => [t, 0, 0, 0, 0, 0, 0, e];

function sampleArm(frames: AF[], p: number): ArmPose {
  return sample(frames as unknown as KF[], p) as ArmPose;
}

// 各腕の差分キーフレーム（腕の待機位置からのオフセット）
// z<0 が前方。x の符号: 左腕は +x が中央寄り、右腕は -x が中央寄り
const L_JAB: AF[] = [
  AREST(0),
  [0.2, -0.03, -0.02, 0.1, 0.1, 0.0, 0.0, 'io'],
  [0.4, 0.14, 0.07, -0.62, -0.18, -0.18, 0.0, 'out'], // ジャブ：真っ直ぐ鋭く
  [0.58, 0.14, 0.07, -0.6, -0.18, -0.18, 0.0, 'lin'],
  AREST(1),
];
const R_CROSS: AF[] = [
  AREST(0),
  [0.2, 0.04, -0.03, 0.12, 0.1, 0.1, 0.1, 'io'],
  [0.42, -0.2, 0.08, -0.68, -0.2, 0.3, 0.22, 'out'], // クロス：体を捻って斜め中央へ
  [0.6, -0.2, 0.08, -0.64, -0.2, 0.3, 0.22, 'lin'],
  AREST(1),
];
const R_UPPER: AF[] = [
  AREST(0),
  [0.24, 0.02, -0.22, 0.1, 0.5, 0.0, 0.0, 'io'], // 腰まで落とす
  [0.46, -0.1, 0.34, -0.5, -1.0, 0.1, 0.0, 'out'], // 下から突き上げ
  [0.62, -0.1, 0.34, -0.46, -1.0, 0.1, 0.0, 'lin'],
  AREST(1),
];
const L_HOLD_GUARD: AF[] = [AREST(0), [0.3, 0.02, 0.05, 0.02, 0.0, 0.0, 0.0, 'io'], AREST(1)];

const DUAL_L: AF[] = [
  AREST(0),
  [0.26, -0.08, 0.02, 0.18, 0.2, 0.0, 0.0, 'io'], // 両拳を溜める
  [0.46, 0.1, 0.08, -0.7, -0.35, -0.25, 0.0, 'out'], // 双掌打
  [0.66, 0.1, 0.08, -0.66, -0.35, -0.25, 0.0, 'lin'],
  AREST(1),
];
const DUAL_R: AF[] = [
  AREST(0),
  [0.26, 0.08, 0.02, 0.18, 0.2, 0.0, 0.0, 'io'],
  [0.46, -0.1, 0.08, -0.7, -0.35, 0.25, 0.0, 'out'],
  [0.66, -0.1, 0.08, -0.66, -0.35, 0.25, 0.0, 'lin'],
  AREST(1),
];
const MEGA_L: AF[] = [
  AREST(0),
  [0.3, -0.12, -0.04, 0.26, 0.3, 0.0, 0.0, 'io'],
  [0.5, 0.12, 0.1, -0.9, -0.45, -0.3, 0.0, 'out'],
  [0.72, 0.12, 0.1, -0.84, -0.45, -0.3, 0.0, 'lin'],
  AREST(1),
];
const MEGA_R: AF[] = [
  AREST(0),
  [0.3, 0.12, -0.04, 0.26, 0.3, 0.0, 0.0, 'io'],
  [0.5, -0.12, 0.1, -0.9, -0.45, 0.3, 0.0, 'out'],
  [0.72, -0.12, 0.1, -0.84, -0.45, 0.3, 0.0, 'lin'],
  AREST(1),
];

export interface GauntletPoses {
  left: ArmPose;
  right: ArmPose;
  /** 体全体（ビューモデルグループ）に加える差分 */
  body: SwingPose;
}

/**
 * variant: 0 = 3段コンボ（3段目: 双掌打） / 1 = 4段コンボ解放済み（3段目: アッパー、4段目: 双掌）
 */
export function getGauntletPoses(step: number, p: number, variant: number): GauntletPoses {
  const arc = Math.sin(Math.min(1, Math.max(0, p)) * Math.PI);
  let left: ArmPose = { ...ZERO };
  let right: ArmPose = { ...ZERO };
  let body: SwingPose = { ...ZERO };

  if (step === 1) {
    left = sampleArm(L_JAB, p);
    right = sampleArm(L_HOLD_GUARD, p);
    body = { ...ZERO, ry: -0.04 * arc, z: -0.02 * arc };
  } else if (step === 2) {
    right = sampleArm(R_CROSS, p);
    left = sampleArm(L_HOLD_GUARD, p);
    body = { ...ZERO, ry: 0.08 * arc, rz: -0.03 * arc, z: -0.03 * arc };
  } else if (step === 3 && variant === 1) {
    right = sampleArm(R_UPPER, p);
    left = sampleArm(L_HOLD_GUARD, p);
    body = { ...ZERO, y: 0.03 * arc, rx: 0.06 * arc };
  } else if (step === 3) {
    left = sampleArm(DUAL_L, p);
    right = sampleArm(DUAL_R, p);
    body = { ...ZERO, z: -0.05 * arc, rx: -0.06 * arc };
  } else {
    left = sampleArm(MEGA_L, p);
    right = sampleArm(MEGA_R, p);
    body = { ...ZERO, z: -0.08 * arc, rx: -0.1 * arc, y: 0.02 * arc };
  }
  return { left, right, body };
}

/** ガントレットの各腕の待機位置（BattleScene3D のモデル構築と一致） */
export const GAUNTLET_ARM_BASE = {
  left: { x: -0.19, y: -0.22, z: -0.38 },
  right: { x: 0.19, y: -0.22, z: -0.38 },
};

/* -------------------------------------------------------------------------- */
/*  Twin blades (ASTRO-ZWILL) : 左右の剣を個別に動かす                           */
/* -------------------------------------------------------------------------- */

// 各剣の差分キーフレーム（待機位置/待機角からのオフセット）。
// 剣先は -Z。ry>0 で剣先が左(-x)へ、ry<0 で右(+x)へ振れる。rx>0 で剣先が上がる。rz は刃のロール。
// 1段目: 右剣が右上から左下へ袈裟斬り（左剣は構え）
const TW_R_SLASH: AF[] = [
  AREST(0),
  [0.2, 0.12, 0.1, 0.1, 0.35, -0.75, -0.5, 'io'], // 右上へ振りかぶる
  [0.42, -0.34, -0.16, -0.26, -0.5, 0.95, 0.5, 'out'], // 左下へ斬り抜け
  [0.62, -0.34, -0.16, -0.22, -0.5, 0.95, 0.5, 'lin'],
  AREST(1),
];
// 2段目: 左剣が左上から右下へ返しの袈裟斬り
const TW_L_SLASH: AF[] = [
  AREST(0),
  [0.2, -0.12, 0.1, 0.1, 0.35, 0.75, 0.5, 'io'],
  [0.42, 0.34, -0.16, -0.26, -0.5, -0.95, -0.5, 'out'],
  [0.62, 0.34, -0.16, -0.22, -0.5, -0.95, -0.5, 'lin'],
  AREST(1),
];
const TW_HOLD: AF[] = [AREST(0), [0.3, 0.0, 0.02, 0.02, 0.05, 0.0, 0.0, 'io'], AREST(1)];
// 3段目: 両剣を大きく開いて振りかぶり、中央で十字に交差させて斬り下ろす
const TW_FIN_L: AF[] = [
  AREST(0),
  [0.28, -0.2, 0.2, 0.14, 0.9, 0.95, 0.5, 'io'], // 左剣を左上に開く
  [0.5, 0.2, -0.14, -0.4, -0.55, -0.62, -0.4, 'in'], // 中央で右下へ
  [0.74, 0.2, -0.14, -0.36, -0.55, -0.62, -0.4, 'lin'],
  AREST(1),
];
const TW_FIN_R: AF[] = [
  AREST(0),
  [0.28, 0.2, 0.2, 0.14, 0.9, -0.95, -0.5, 'io'],
  [0.5, -0.2, -0.14, -0.4, -0.55, 0.62, 0.4, 'in'],
  [0.74, -0.2, -0.14, -0.36, -0.55, 0.62, 0.4, 'lin'],
  AREST(1),
];
// 4段目 (= ガード中の左クリック TWIN CYCLONE): 二刀を逆回転させて一回転
const TW_SPIN_L: AF[] = [
  AREST(0),
  [0.16, -0.1, 0.02, 0.1, 0.1, 0.5, 0.0, 'io'],
  [0.72, 0.0, 0.0, -0.1, 0.05, 0.5 + TAU, 0.0, 'io'],
  AREST(1),
];
const TW_SPIN_R: AF[] = [
  AREST(0),
  [0.16, 0.1, 0.02, 0.1, 0.1, -0.5, 0.0, 'io'],
  [0.72, 0.0, 0.0, -0.1, 0.05, -0.5 - TAU, 0.0, 'io'],
  AREST(1),
];

export interface TwinBladePoses {
  left: ArmPose;
  right: ArmPose;
  /** 体全体（ビューモデルグループ）に加える差分 */
  body: SwingPose;
}

export function getTwinBladePoses(step: number, p: number): TwinBladePoses {
  const arc = Math.sin(Math.min(1, Math.max(0, p)) * Math.PI);
  let left: ArmPose = { ...ZERO };
  let right: ArmPose = { ...ZERO };
  let body: SwingPose = { ...ZERO };

  if (step === 1) {
    right = sampleArm(TW_R_SLASH, p);
    left = sampleArm(TW_HOLD, p);
    body = { ...ZERO, ry: 0.05 * arc, z: -0.02 * arc };
  } else if (step === 2) {
    left = sampleArm(TW_L_SLASH, p);
    right = sampleArm(TW_HOLD, p);
    body = { ...ZERO, ry: -0.05 * arc, z: -0.02 * arc };
  } else if (step === 3) {
    left = sampleArm(TW_FIN_L, p);
    right = sampleArm(TW_FIN_R, p);
    body = { ...ZERO, z: -0.05 * arc, rx: -0.07 * arc };
  } else {
    left = sampleArm(TW_SPIN_L, p);
    right = sampleArm(TW_SPIN_R, p);
    body = { ...ZERO, z: -0.03 * arc, y: 0.01 * arc };
  }
  return { left, right, body };
}

/** 双剣の各腕の待機位置と角度（BattleScene3D のモデル構築と一致）。ry は内向き、rx は剣先を少し上げる */
export const TWIN_ARM_BASE = {
  left: { x: -0.2, y: -0.2, z: -0.18, rx: 0.3, ry: -0.14, rz: -0.06 },
  right: { x: 0.2, y: -0.2, z: -0.18, rx: 0.3, ry: 0.14, rz: 0.06 },
};

/** 双剣のガード（星十字）: 二刀を顔の前で交差させる腕の差分 */
export const TWIN_GUARD_ARMS = {
  left: [0.2, 0.08, -0.06, 0.2, -0.8, 0.0],
  right: [-0.2, 0.08, -0.06, 0.2, 0.8, 0.0],
};

/* -------------------------------------------------------------------------- */
/*  Scythe : REAPER TEMPEST（前進しながら大鎌を周囲へ振り回す溜め技）             */
/* -------------------------------------------------------------------------- */

/** REAPER TEMPEST の全体時間（秒） */
export const SCYTHE_TEMPEST_TIME = 1.0;

/**
 * 大鎌の旋風ポーズ（待機姿勢からの差分）。p: 0..1。
 * 振りかぶり → 2回転の乱舞（勢いよく加速し、減速して止まる）→ 構え直し。
 * 終了時の rz は 4π（= 見た目は元の姿勢）。呼び出し側は終了後に回転量を 2π の倍数で巻き戻すこと。
 */
export function getScytheTempestPose(p: number): SwingPose {
  const pp = Math.min(1, Math.max(0, p));
  const WIND = 0.14;
  const END = 0.86;
  if (pp < WIND) {
    const e = ease('out', pp / WIND);
    return { x: 0.22 * e, y: 0.1 * e, z: 0.12 * e, rx: 0.5 * e, ry: 0.1 * e, rz: 0.9 * e };
  }
  if (pp < END) {
    const u = (pp - WIND) / (END - WIND);
    const e = ease('io', u);
    const arc = Math.sin(u * Math.PI);
    const swirl = u * TAU * 2;
    return {
      x: 0.22 * (1 - u) + Math.sin(swirl) * 0.05,
      y: 0.1 * (1 - u) - 0.04 * arc,
      z: 0.12 * (1 - u) - 0.2 * arc,
      rx: 0.5 * (1 - u) - 0.35 * arc,
      ry: 0.1 + Math.sin(swirl) * 0.18 * arc,
      rz: 0.9 + TAU * 2 * e,
    };
  }
  const q = ease('out', (pp - END) / (1 - END));
  return { x: 0, y: -0.02 * (1 - q), z: -0.04 * (1 - q), rx: 0, ry: 0, rz: TAU * 2 + 0.9 * (1 - q) };
}

/** パイルバンカーの杭の突出量 0..1（溜め中は震え、射出で突き出し、戻る） */
export function getLanceNeedleExtension(p: number): number {
  if (p < 0.3) return 0;
  if (p < 0.5) return Math.min(1, (p - 0.3) / 0.08);
  if (p < 0.72) return 1;
  return Math.max(0, 1 - (p - 0.72) / 0.28);
}

/** パイルバンカー溜め中の震え（振幅） */
export function getLanceChargeShake(p: number): number {
  if (p >= 0.3) return 0;
  return Math.sin(p * 120) * 0.006 * (p / 0.3);
}

/* -------------------------------------------------------------------------- */
/*  Chainsaw : 長押しで振り下ろし、そのまま押し当てて削る                          */
/* -------------------------------------------------------------------------- */

/** 振りかぶり → 振り下ろし完了までの秒数。完了の瞬間に最初の一撃 (RAVAGE DROP) が当たる */
export const SAW_DROP_TIME = 0.16;
const SAW_WINDUP_TIME = 0.06;

const SAW_WINDUP: SwingPose = { x: 0.18, y: 0.06, z: -0.38, rx: 0.55, ry: -0.1, rz: 0.1 };
/** 刃を前下方へ押し当てた削りの構え（絶対姿勢） */
const SAW_GRIND: SwingPose = { x: 0.12, y: -0.3, z: -0.66, rx: -1.62, ry: 0.04, rz: 0.06 };
/** RIPPER RUSH: さらに前へ突き出す */
const SAW_RUSH: SwingPose = { x: 0.06, y: -0.26, z: -0.8, rx: -1.5, ry: 0.0, rz: 0.0 };

function lerpPose(a: SwingPose, b: SwingPose, u: number): SwingPose {
  return {
    x: a.x + (b.x - a.x) * u,
    y: a.y + (b.y - a.y) * u,
    z: a.z + (b.z - a.z) * u,
    rx: a.rx + (b.rx - a.rx) * u,
    ry: a.ry + (b.ry - a.ry) * u,
    rz: a.rz + (b.rz - a.rz) * u,
  };
}

/**
 * チェーンソーの長押し姿勢（待機姿勢からの差分）。
 * held: 押し始めてからの秒数 / time: 振動用の経過時間 / rpm: 回転数 0..1（振動の強さ）
 */
export function getChainsawGrindPose(held: number, time: number, rpm: number, rush = false): SwingPose {
  let abs: SwingPose;
  if (rush) {
    abs = { ...SAW_RUSH };
  } else if (held < SAW_WINDUP_TIME) {
    abs = lerpPose(B, SAW_WINDUP, ease('io', held / SAW_WINDUP_TIME));
  } else if (held < SAW_DROP_TIME) {
    abs = lerpPose(SAW_WINDUP, SAW_GRIND, ease('in', (held - SAW_WINDUP_TIME) / (SAW_DROP_TIME - SAW_WINDUP_TIME)));
  } else {
    abs = { ...SAW_GRIND };
  }
  if (held >= SAW_DROP_TIME || rush) {
    // 刃が食い込んで暴れる振動（回転数が上がるほど細かく強く）
    const amp = (rush ? 0.016 : 0.006) + 0.008 * rpm;
    abs.x += Math.sin(time * 71) * amp;
    abs.y += Math.sin(time * 93 + 1.3) * amp * 0.8;
    abs.z += Math.sin(time * 57 + 0.4) * amp * 0.5;
    abs.rx += Math.sin(time * 83 + 2.1) * amp * 1.6;
    abs.rz += Math.sin(time * 67 + 0.7) * amp * 1.2;
  }
  return diff(abs);
}

/** チェーンスピア：槍先（銛）が前方に飛び出している量 0..1 */
export function getHarpoonExtension(p: number): number {
  if (p < 0.34) return 0;
  if (p < 0.42) return (p - 0.34) / 0.08;
  if (p < 0.6) return 1;
  return Math.max(0, 1 - (p - 0.6) / 0.4);
}


/* -------------------------------------------------------------------------- */
/*  溜めポーズ（右クリック長押し）: 武器ごとの「力を溜める構え」                     */
/* -------------------------------------------------------------------------- */

/**
 * 溜め中の武器の姿勢（待機姿勢からの差分）。p: 溜め進行度 0..1 / time: 震え用の経過秒。
 * 満タン(p>=1)で震えが最大になり、技の解放を待つ。ハンマー・ガントレット・双剣は呼び出し側で別処理。
 */
export function getMeleeChargePose(style: MeleeStyle, p: number, time: number): SwingPose {
  const e = 1 - Math.pow(1 - Math.min(1, p), 3);
  const full = p >= 1 ? 1 : 0;
  const shake = p * (full ? 0.011 : 0.005);
  const sx = Math.sin(time * 61) * shake;
  const sy = Math.cos(time * 53) * shake;
  const sz = Math.sin(time * 41) * shake * 0.6;
  const srx = Math.sin(time * 47) * shake * 1.6;

  switch (style) {
    case 'katana': {
      // 居合の構え: 腰を落とし、刀を右腰へ引き絞る。満タンで刃が鳴くように微振動
      const settle = Math.min(1, p / 0.35);
      const es = settle * settle * (3 - 2 * settle);
      const hum = full ? Math.sin(time * 96) * 0.004 : 0;
      return {
        x: 0.2 * es + sx + hum,
        y: -0.08 * es + sy,
        z: 0.1 * es + sz,
        rx: -1.15 * es + srx,
        ry: -0.12 * es,
        rz: -1.25 * es - 0.12 * e + Math.cos(time * 51) * shake,
      };
    }
    case 'glaive':
    case 'scythe': {
      // 長柄を右後方へ大きく引き絞る
      return { x: 0.3 * e + sx, y: 0.04 * e + sy, z: 0.12 * e + sz, rx: -0.55 * e + srx, ry: -0.5 * e, rz: -1.1 * e };
    }
    case 'dagger': {
      // 低く構えて獲物を狙う
      return { x: 0.12 * e + sx, y: -0.1 * e + sy, z: 0.1 * e + sz, rx: 0.12 * e + srx, ry: -0.45 * e, rz: 0.4 * e };
    }
    case 'chainspear': {
      // 銛を肩口へ振りかぶる
      return { x: 0.18 * e + sx, y: 0.14 * e + sy, z: 0.16 * e + sz, rx: 0.5 * e + srx, ry: -0.25 * e, rz: 0.5 * e };
    }
    case 'lance': {
      // パイルを後ろへ引いて圧を溜める（杭が震える）
      return { x: 0.14 * e + sx, y: -0.04 * e + sy, z: 0.28 * e + sz + getLanceChargeShake(p * 0.3), rx: 0.05 * e + srx, ry: -0.1 * e, rz: 0.1 * e };
    }
    case 'anchor': {
      // 鎖を肩へ担ぎ上げる
      return { x: 0.2 * e + sx, y: 0.2 * e + sy, z: 0.14 * e + sz, rx: 0.7 * e + srx, ry: -0.3 * e, rz: -0.35 * e };
    }
    case 'rapier': {
      // 半身になって剣先を前へ倒し、肘を深く引き絞る（剣先に冷気が集まる）
      return { x: 0.12 * e + sx, y: 0.06 * e + sy, z: 0.24 * e + sz, rx: -1.3 * e + srx, ry: -0.25 * e, rz: 0.05 * e };
    }
    case 'whip': {
      // 頭上で鞭を回し始める
      return { x: -0.04 * e + sx, y: 0.16 * e + sy, z: 0.1 * e + sz, rx: 0.45 * e + srx, ry: Math.sin(time * 14) * 0.25 * e, rz: 0.1 * e };
    }
    case 'disc': {
      // 円月輪を胸の前で回転させて溜める
      return { x: -0.1 * e + sx, y: 0.05 * e + sy, z: 0.08 * e + sz, rx: -0.6 * e + srx, ry: 0.3 * e, rz: -0.4 * e };
    }
    default: {
      const dual = style === 'gauntlets' || style === 'twinblade';
      return {
        x: sx,
        y: (dual ? 0.03 : 0.1) * e + sy,
        z: (dual ? 0.08 : 0.14) * e,
        rx: (dual ? 0.1 : 0.55) * e + srx,
        ry: 0,
        rz: dual ? 0 : -0.25 * e,
      };
    }
  }
}


/* -------------------------------------------------------------------------- */
/*  Whip (VIPERCOIL) : 鞭本体の形（ビューモデル holder 空間）                      */
/* -------------------------------------------------------------------------- */

/** 鞭のセグメント数（battleWeaponModel の whipSeg0..N-1 と一致） */
export const WHIP_SEGMENTS = 18;
/** 柄の先端（鞭の付け根）の位置 */
export const WHIP_ROOT = { x: 0, y: 0.2, z: 0 };

/**
 * 鞭の各関節の位置（holder 空間、付け根→先端）を `out` に書き込む。
 * step: 0 = 待機 / 1 = 縦の打ち込み / 2 = 横薙ぎ / 3 = 絡め取り / 4 = 頭上旋回（溜め・技）
 * p: 振りの進行度 0..1。待機中も時間でゆらゆら揺れる。
 */
export function getWhipPoints(step: number, p: number, time: number, out: { x: number; y: number; z: number }[]): void {
  const N = WHIP_SEGMENTS;
  const seg = 0.09; // 1 関節の長さ(m) — 全長 約1.6m
  const R = WHIP_ROOT;
  for (let i = 0; i < N; i++) {
    const s = (i + 1) / N;
    // 待機: 柄から垂れ下がって前方へ流れる S 字
    let x = Math.sin(s * 3 + time * 1.6) * 0.035 * s;
    let y = R.y - s * 0.62 + Math.sin(s * 5 + time * 2.1) * 0.02 * s;
    let z = R.z - s * 0.32 + Math.sin(s * 4 + time * 1.3) * 0.04 * s;
    if (step >= 1 && step <= 3 && p > 0 && p < 1) {
      // 伸展量: 振りかぶり(後方へ流れる) → 一気に前へ伸び切る(打撃) → 戻る
      const back = p < 0.3 ? Math.sin((p / 0.3) * Math.PI * 0.5) : Math.max(0, 1 - (p - 0.3) / 0.1);
      const ext = p < 0.3 ? 0 : p < 0.46 ? (p - 0.3) / 0.16 : p < 0.6 ? 1 : Math.max(0, 1 - (p - 0.6) / 0.4);
      const extE = 1 - Math.pow(1 - Math.min(1, ext), 2);
      // 振りかぶり中は鞭が肩越しに後ろへ流れる
      const bx = Math.sin(s * 2.4) * 0.12 * s;
      const by = R.y + s * 0.35;
      const bz = R.z + s * 0.9;
      x = x + (bx - x) * back;
      y = y + (by - y) * back;
      z = z + (bz - z) * back;
      // 打撃: 前方へ一直線に伸び、先端に向かって進行波（しなり）が走る
      const L = s * N * seg * 1.15;
      let fx = 0;
      let fz = -L;
      let fy = R.y - s * 0.05;
      const wave = Math.sin(s * 9 - p * 34) * 0.08 * s * (1 - extE * 0.7);
      if (step === 2) {
        // 横薙ぎ: 伸びた鞭が右から左へ扇状に走る
        const ang = (0.9 - 1.8 * Math.min(1, Math.max(0, (p - 0.3) / 0.3))) * (0.4 + s * 0.6);
        fx = Math.sin(ang) * L;
        fz = -Math.cos(ang) * L;
        fy = R.y - 0.1 * s;
      }
      if (step === 3 && p > 0.5) {
        // 絡め取り: 先端が小さな輪を作って巻き付く
        const curl = Math.max(0, (s - 0.75) / 0.25) * Math.min(1, (p - 0.5) / 0.1);
        fx += Math.cos(s * 30 + time * 20) * 0.12 * curl;
        fy += Math.sin(s * 30 + time * 20) * 0.12 * curl;
      }
      x = x + (fx + wave - x) * extE;
      y = y + (fy + wave * 0.6 - y) * extE;
      z = z + (fz - z) * extE;
    } else if (step === 4) {
      // 頭上で水平に振り回す
      const a = time * 16 + s * 0.6;
      const r = 0.15 + s * 1.3;
      x = Math.cos(a) * r;
      z = Math.sin(a) * r - 0.2;
      y = R.y + 0.3 + Math.sin(s * 4 + time * 6) * 0.05;
    }
    out[i].x = x;
    out[i].y = y;
    out[i].z = z;
  }
}
