import { SkillNode } from '../types';

/** 解放したパッシブ / 特有強化ノードをさらに強化できる最大レベル。解放直後が Lv1。 */
export const MAX_NODE_LEVEL = 30;
/** カテゴリ強化ノードは 10 レベルごとに限界突破が必要 */
export const NODE_BREAK_INTERVAL = 10;

/** 1レベルごとに基本効果へ加算される割合 (Lv10 で約2.1倍) */
const EFFECT_PER_LEVEL = 0.12;

/** 武器解放ノードは武器側のダメージ強化があるので、ノード強化の対象外。
 *  武器特有強化ノードは一度解放するだけで、レベルアップ不可 */
export const isNodeUpgradable = (node: SkillNode): boolean =>
  node.nodeType !== 'WEAPON_UNLOCK' &&
  node.nodeType !== 'WEAPON_SPECIFIC' &&
  !node.isWeaponSpecific &&
  node.effects.length > 0;

/** 中枢コアは Lv500 まで強化できる。Lv100 で最初の突破、以降 50 レベルごと (武器と同じ方式) */
export const CORE_MAX_LEVEL = 500;
export const CORE_FIRST_BREAK = 100;
export const CORE_BREAK_INTERVAL = 50;
/** コアの 1 レベルごとの効果加算割合 (Lv100 で約 5 倍、以降は伸びを半分にして Lv500 で約 13 倍) */
const CORE_EFFECT_PER_LEVEL = 0.04;
const CORE_EFFECT_PER_LEVEL_HIGH = 0.02;

export const maxNodeLevel = (node: SkillNode): number => (node.id === 'core_root' ? CORE_MAX_LEVEL : MAX_NODE_LEVEL);

/** 限界突破の記録キー (ノードID / 武器は 'w:武器ID') */
export const weaponBreakKey = (weaponId: string) => `w:${weaponId}`;

/** 突破回数を考慮した現在のレベル上限 (中枢コアは突破不要) */
export const nodeLevelCap = (node: SkillNode, breaks: Record<string, number> = {}): number =>
  node.id === 'core_root'
    ? Math.min(CORE_MAX_LEVEL, CORE_FIRST_BREAK + CORE_BREAK_INTERVAL * (breaks[node.id] || 0))
    : Math.min(MAX_NODE_LEVEL, NODE_BREAK_INTERVAL * ((breaks[node.id] || 0) + 1));

/** 1 回の限界突破で上限が増えるレベル数 */
export const nodeBreakStep = (node: SkillNode): number => (node.id === 'core_root' ? CORE_BREAK_INTERVAL : NODE_BREAK_INTERVAL);

/** 次の限界突破に必要な素材。上限に達していなければ null */
export const nodeBreakCost = (node: SkillNode, level: number, breaks: Record<string, number> = {}): { cost: number; beacons: number } | null => {
  if (node.id === 'core_root') {
    if (level < nodeLevelCap(node, breaks) || level >= CORE_MAX_LEVEL) return null;
    const kc = (breaks[node.id] || 0) + 1; // 1回目 Lv100 ... 8回目 Lv450
    if (kc <= 4) return { cost: 10000 * kc * kc, beacons: 20 * kc * kc };
    return { cost: 160000 + 100000 * (kc - 4), beacons: 320 + 80 * (kc - 4) };
  }
  if (level < nodeLevelCap(node, breaks) || level >= MAX_NODE_LEVEL) return null;
  const k = (breaks[node.id] || 0) + 1; // 1回目 Lv10, 2回目 Lv20
  return { cost: Math.round(node.cost * 12 * k * k), beacons: 15 * k * k };
};

/** 武器ダメージ強化: 最大 Lv500。Lv100 で最初の突破、以降 50 レベルごと (突破は計8回) */
export const WEAPON_MAX_LEVEL = 500;
export const WEAPON_FIRST_BREAK = 100;
export const WEAPON_BREAK_INTERVAL = 50;

export const weaponLevelCap = (breaks = 0): number => Math.min(WEAPON_MAX_LEVEL, WEAPON_FIRST_BREAK + WEAPON_BREAK_INTERVAL * breaks);

export const weaponBreakCost = (level: number, breaks = 0): { cost: number; beacons: number } | null => {
  if (level < weaponLevelCap(breaks) || level >= WEAPON_MAX_LEVEL) return null;
  const k = breaks + 1; // 1回目 Lv100 ... 8回目 Lv450
  // 4回目まではこれまで通りの二乗カーブ。5回目以降は一定ペースで増やす (二乗のままだと8回目が膨らみすぎる)
  if (k <= 4) return { cost: 15000 * k * k, beacons: 30 * k * k };
  return { cost: 240000 + 150000 * (k - 4), beacons: 480 + 120 * (k - 4) };
};

export const weaponUpgradeCost = (level: number): number => Math.round(35 + level * 8);

export const getNodeLevel = (node: SkillNode, levels: Record<string, number>): number =>
  node.unlocked ? (!isNodeUpgradable(node) ? 1 : Math.max(1, Math.min(maxNodeLevel(node), levels[node.id] || 1))) : 0;

/** レベルに応じた効果倍率 (未解放は 0) */
export const nodeEffectScale = (level: number, node?: SkillNode): number =>
  level <= 0
    ? 0
    : node?.id === 'core_root'
    ? 1 + (Math.min(level, 100) - 1) * CORE_EFFECT_PER_LEVEL + Math.max(0, level - 100) * CORE_EFFECT_PER_LEVEL_HIGH
    : 1 + (level - 1) * EFFECT_PER_LEVEL;

/** level -> level+1 に必要な SCRAP */
export const nodeUpgradeCost = (node: SkillNode, level: number): number =>
  node.id === 'core_root' ? 85 + 17 * level : Math.max(40, Math.round(node.cost * 0.3 * level));

/** level -> level+1 に必要な BEACON (中枢コアの強化のみ必要) */
export const nodeUpgradeBeaconCost = (node: SkillNode, level: number): number =>
  node.id === 'core_root' ? (level < 100 ? 1 + Math.floor(level / 10) : 11 + Math.floor((level - 100) / 25)) : 0;

export const nodeUpgradeBulkCost = (
  node: SkillNode,
  level: number,
  count: number,
  cap: number = maxNodeLevel(node),
): { count: number; cost: number; beacons: number } => {
  const n = Math.max(0, Math.min(count, cap - level));
  let cost = 0;
  let beacons = 0;
  for (let i = 0; i < n; i++) {
    cost += nodeUpgradeCost(node, level + i);
    beacons += nodeUpgradeBeaconCost(node, level + i);
  }
  return { count: n, cost, beacons };
};

const truncToward0 = (v: number) => Math.trunc(Math.abs(v) + 1e-9) * Math.sign(v);

/** 効果値の小数切り捨て (1 未満は割合なので 1% 単位、それ以上は整数単位)。内部計算・表示で共通 */
export const truncEffectValue = (value: number): number =>
  Math.abs(value) < 1 ? truncToward0(value * 100) / 100 : truncToward0(value);

/** レベル倍率を掛けた後の実効値 (小数切り捨て済み) */
export const scaledEffectValue = (value: number, level: number, node?: SkillNode): number =>
  truncEffectValue(value * nodeEffectScale(level, node));

/** 効果値を表示用に整形 (小数は%表記。値は truncEffectValue 済みのものを渡す) */
export const formatEffectValue = (value: number): string => {
  const v = truncEffectValue(value);
  const sign = v > 0 ? '+' : '';
  if (Math.abs(v) < 1 && v !== 0) return `${sign}${Math.round(v * 100)}%`;
  return `${sign}${v}`;
};
