import { SkillNode, SkillBranch } from '../types';

/**
 * ガジェットツリーの自動レイアウト (放射状ツリー)
 *  - 中心: core_root
 *  - 距離(リング): 前提ノードを辿った最長ステップ数。リング半径はそのリングに必要な幅から決める
 *  - 角度: 系統ごとに同じ大きさの扇形セクターを割り当て、各サブツリーは連続した角度帯にまとめる
 *    (INFIGHT=西, ASSAULT=北, GRENADE=東)
 *  - 武器特有強化(○)は解放ノード(□)から外側へ扇状に枝分かれさせる。扇は子ノードと並ぶ専用の角度帯を持ち、
 *    表示/非表示に関わらず場所を確保する
 *  - 1系統だけ極端に深い場合、他系統の深さを超えた先 (尾) は外側へ伸ばさず、外周に沿って
 *    セクター内側へ巻き込むように並べ、枝の伸びの偏りを抑える
 *  - 最後にノードの大きさを考慮した衝突解消を行い、重なりを無くす
 * 保存データの x / y は使わない (元座標は兄弟の並び順のヒントにのみ使用)。
 */

export const TREE_CENTER = { x: 500, y: 400 };
const X_STRETCH = 1.3; // 横長キャンバスを活かして楕円状に広げる
const RING_1_MIN = 120;
const RING_MIN_STEP = 70;
const SECTOR_GAP = 0.1; // 系統セクター間の余白 (rad)
const NODE_GAP = 62; // 同じリング上で隣り合うノードの最小間隔 (px)
const LEAF_SHARE = 0.62; // 葉ノードは内外に互い違いに置けるので必要幅が減る
const SAT_OUT = 50; // □ の中心から ○ の扇までの距離
const SAT_STEP = 40; // ○ どうしの間隔
const CLEARANCE = 10; // 衝突解消後に確保するノード間の最小すき間 (px)
const TAIL_RISE = 0.06; // 尾ノードが外周に沿って進むときの外向きの広がり (弧長あたり)
const TAIL_OUT = 80; // 尾の最初の1歩 / 脇道の外向きの距離 (px)

const BRANCH_ORDER: SkillBranch[] = ['INFIGHT', 'ASSAULT', 'GRENADE'];
const START_ANGLE = Math.PI * 0.75; // 南西から時計回り (SVG座標: y下向き)

export interface SkillTreeLayout {
  pos: Record<string, { x: number; y: number }>;
  ringRadii: number[];
  /** 系統セクターの境界角 (rad) */
  dividers: { angle: number; branch: SkillBranch }[];
  /** 系統ごとの扇形の角度範囲 (rad) */
  sectors: { branch: SkillBranch; from: number; to: number }[];
  /** 全ノードを囲む矩形 */
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  xStretch: number;
}

export const isSpecificNode = (n: SkillNode) => n.isWeaponSpecific || n.nodeType === 'WEAPON_SPECIFIC';

/** 描画上のノード半径 (衝突判定用) */
export const nodeRadius = (n: SkillNode) =>
  n.id === 'core_root' ? 30 : isSpecificNode(n) ? 16 : n.nodeType === 'WEAPON_UNLOCK' ? 27 : 24;

export const computeSkillTreeLayout = (allNodes: SkillNode[]): SkillTreeLayout => {
  const nodes = allNodes.filter((n) => !isSpecificNode(n));
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const root = nodes.find((n) => n.id === 'core_root') || nodes[0];

  // ○ は最初の前提ノード (= 武器解放ノード) にぶら下げる
  const satellites = new Map<string, SkillNode[]>();
  allNodes.filter(isSpecificNode).forEach((n) => {
    const anchor = n.prerequisites.find((p) => byId.has(p)) || root.id;
    if (!satellites.has(anchor)) satellites.set(anchor, []);
    satellites.get(anchor)!.push(n);
  });
  const satCount = (id: string) => (satellites.get(id) || []).length;

  // 最長パス深さ
  const depth = new Map<string, number>();
  const getDepth = (id: string, stack = new Set<string>()): number => {
    if (depth.has(id)) return depth.get(id)!;
    const n = byId.get(id);
    if (!n || stack.has(id)) return 0;
    stack.add(id);
    const prereqs = n.prerequisites.filter((p) => byId.has(p));
    const d = prereqs.length === 0 ? (id === root.id ? 0 : 1) : 1 + Math.max(...prereqs.map((p) => getDepth(p, stack)));
    stack.delete(id);
    depth.set(id, d);
    return d;
  };
  nodes.forEach((n) => getDepth(n.id));

  // 元座標の角度 (兄弟の並び順のヒント)
  const hintAngle = (n: SkillNode) => {
    let a = Math.atan2(n.y - TREE_CENTER.y, n.x - TREE_CENTER.x);
    while (a < START_ANGLE) a += Math.PI * 2;
    return a;
  };

  // ツリー親 = 最も深い前提ノード (同深度なら同系統を優先)
  const children = new Map<string, SkillNode[]>();
  nodes.forEach((n) => {
    if (n.id === root.id) return;
    const prereqs = n.prerequisites.filter((p) => byId.has(p));
    let parent = root.id;
    if (prereqs.length) {
      parent = prereqs.reduce((best, p) => {
        const dp = depth.get(p)!;
        const db = depth.get(best)!;
        if (dp > db) return p;
        if (dp === db && byId.get(p)!.branch === n.branch && byId.get(best)!.branch !== n.branch) return p;
        return best;
      });
    }
    if (!children.has(parent)) children.set(parent, []);
    children.get(parent)!.push(n);
  });
  children.forEach((list) => list.sort((a, b) => hintAngle(a) - hintAngle(b)));
  const isLeaf = (id: string) => !(children.get(id) || []).length;
  const canStagger = (id: string) => isLeaf(id) && satCount(id) === 0;

  /** ノード1つ分の接線方向の幅 (px) */
  const ownWidth = (n: SkillNode) => NODE_GAP * (canStagger(n.id) ? LEAF_SHARE : 1);
  /** ○ の扇の幅 (px) */
  const fanWidth = (id: string) => (satCount(id) - 1) * SAT_STEP + NODE_GAP * 0.75;
  // 扇は子ノードの並びの中央に「仮想の子」として割り込ませる
  const FAN = '__fan__';
  // リングを割り当てる最大の深さ。これより深いノード (尾) は外周に沿って並べる
  let ringCap = Infinity;
  const childIds = (id: string): string[] => {
    const ids = depth.get(id)! >= ringCap ? [] : (children.get(id) || []).map((c) => c.id);
    if (satCount(id) > 0) ids.splice(Math.floor(ids.length / 2), 0, FAN + id);
    return ids;
  };

  // 起点直下を系統ごとにグループ化
  const rootKids = children.get(root.id) || [];
  const groups = BRANCH_ORDER.map((branch) => ({ branch, kids: rootKids.filter((k) => k.branch === branch) })).filter(
    (g) => g.kids.length > 0,
  );
  const usable = Math.PI * 2 - SECTOR_GAP * groups.length;
  // 系統ごとに同じ角度 (均等割り)。ノードが多い系統に合わせてリング半径を広げて収める
  const sectorSpan = usable / groups.length;

  // リング半径: 各リングのノードが一周に収まる半径 (内側リングより必ず外側)
  let maxDepth = 0;
  const ringNeed: number[] = [];
  const ringNeedByBranch = new Map<SkillBranch, number[]>();
  nodes.forEach((n) => {
    if (n.id === root.id) return;
    const d = depth.get(n.id)!;
    maxDepth = Math.max(maxDepth, d);
    if (!ringNeedByBranch.has(n.branch)) ringNeedByBranch.set(n.branch, []);
    const arr = ringNeedByBranch.get(n.branch)!;
    arr[d] = (arr[d] || 0) + ownWidth(n);
  });
  // 2番目に深い系統の深さまでをリングにする (突出した1系統だけが外へ伸び続けるのを防ぐ)
  const branchDepths = Array.from(ringNeedByBranch.values())
    .map((a) => a.length - 1)
    .sort((a, b) => b - a);
  ringCap = Math.min(maxDepth, branchDepths.length > 1 ? branchDepths[1] : maxDepth);
  for (let d = 1; d <= ringCap; d++) {
    ringNeed[d] = Math.max(0, ...Array.from(ringNeedByBranch.values()).map((a) => a[d] || 0));
  }
  const baseRadii: number[] = [0];
  for (let d = 1; d <= ringCap; d++) {
    const fit = ((ringNeed[d] || 0) * 1.08) / sectorSpan;
    baseRadii[d] = Math.max(d === 1 ? RING_1_MIN : baseRadii[d - 1] + RING_MIN_STEP, fit);
  }

  // サブツリーが必要とする角度 (rad) = max(自身の必要角, 子の必要角の合計)
  let radii = baseRadii;
  let weight = new Map<string, number>();
  const getWeight = (id: string): number => {
    if (weight.has(id)) return weight.get(id)!;
    if (id.startsWith(FAN)) {
      const anchor = id.slice(FAN.length);
      const w = fanWidth(anchor) / (radii[depth.get(anchor)!] + SAT_OUT);
      weight.set(id, w);
      return w;
    }
    const own = ownWidth(byId.get(id)!) / radii[depth.get(id)!];
    const w = Math.max(own, childIds(id).reduce((s, k) => s + getWeight(k), 0));
    weight.set(id, w);
    return w;
  };
  const groupWeights = () => groups.map((g) => g.kids.reduce((s, k) => s + getWeight(k.id), 0));
  // 起点直下の扇はセクター外なので使わない (起点に ○ は付かない想定)
  let gw = groupWeights();
  // サブツリーの偏りで一周に収まらない場合は全体を少しずつ拡大
  for (let scale = 1.04; gw.some((w) => w > sectorSpan) && scale < 1.6; scale += 0.04) {
    radii = baseRadii.map((r) => r * scale);
    weight = new Map();
    gw = groupWeights();
  }

  // 角度の割り当て
  const angle = new Map<string, number>();
  const fanSpan = new Map<string, [number, number]>();
  const assign = (list: string[], from: number, to: number) => {
    const total = list.reduce((s, k) => s + getWeight(k), 0) || 1;
    let cur = from;
    list.forEach((k) => {
      const span = ((to - from) * getWeight(k)) / total;
      if (k.startsWith(FAN)) {
        fanSpan.set(k.slice(FAN.length), [cur, cur + span]);
      } else {
        angle.set(k, cur + span / 2);
        const kids = childIds(k);
        if (kids.length) assign(kids, cur, cur + span);
      }
      cur += span;
    });
  };
  const dividers: SkillTreeLayout['dividers'] = [];
  const sectors: SkillTreeLayout['sectors'] = [];
  let cursor = START_ANGLE;
  groups.forEach((g, i) => {
    const span = sectorSpan;
    dividers.push({ angle: cursor - SECTOR_GAP / 2, branch: g.branch });
    sectors.push({ branch: g.branch, from: cursor, to: cursor + span });
    assign(g.kids.map((k) => k.id), cursor, cursor + span);
    cursor += span + SECTOR_GAP;
  });

  // 同じリング上で隣接する葉ノードが近すぎる場合、交互に外側へずらす
  const radius = new Map<string, number>();
  for (let d = 1; d <= ringCap; d++) {
    const r = radii[d];
    const ring = nodes.filter((n) => n.id !== root.id && depth.get(n.id) === d);
    ring.sort((a, b) => angle.get(a.id)! - angle.get(b.id)!);
    let prevOut = true;
    ring.forEach((n, i) => {
      radius.set(n.id, r);
      if (!canStagger(n.id)) {
        prevOut = true;
        return;
      }
      const prev = ring[i - 1];
      const tight = !!prev && (angle.get(n.id)! - angle.get(prev.id)!) * r < NODE_GAP;
      const out = tight && !prevOut;
      if (out) radius.set(n.id, r + RING_MIN_STEP * 0.5);
      prevOut = out;
    });
  }

  // 尾: リング外のノードを外周に沿ってセクターの内側方向へ並べる (渦を巻くように)
  const localStretch = (a: number) => Math.hypot(Math.sin(a) * X_STRETCH, Math.cos(a));
  /** 弧に沿って並べるときの片側の幅 (○ の扇が隣とぶつからない幅) */
  const tailHalf = (id: string) =>
    Math.max(NODE_GAP / 2 + 6, satCount(id) > 0 ? ((satCount(id) - 1) * SAT_STEP) / 2 + 24 : 0);
  const subtreeDepth = (id: string): number =>
    1 + Math.max(0, ...(children.get(id) || []).map((c) => subtreeDepth(c.id)));
  const placeTail = (parentId: string, dir: number) => {
    const kids = [...(children.get(parentId) || [])].sort((a, b) => subtreeDepth(b.id) - subtreeDepth(a.id));
    const a0 = angle.get(parentId)!;
    const r0 = radius.get(parentId)!;
    kids.forEach((k, i) => {
      if (i === 0) {
        // 最も深い子は外周に沿って巻き込みを続ける (最初の1歩だけ一段外へ出る)
        const step = tailHalf(parentId) + tailHalf(k.id);
        const r = (depth.get(parentId) === ringCap ? r0 + TAIL_OUT : r0) + step * TAIL_RISE;
        angle.set(k.id, a0 + (dir * step) / (((r + r0) / 2) * localStretch(a0)));
        radius.set(k.id, r);
      } else {
        // それ以外の子は親からまっすぐ外側へ短く伸ばす
        angle.set(k.id, a0 - dir * (i - 1) * 0.04);
        radius.set(k.id, r0 + TAIL_OUT);
      }
    });
    kids.forEach((k) => placeTail(k.id, dir));
  };
  nodes.forEach((n) => {
    if (depth.get(n.id) !== ringCap || !(children.get(n.id) || []).length) return;
    const sec = sectors.find((sc) => sc.branch === n.branch);
    const a = angle.get(n.id)!;
    const dir = sec && (sec.from + sec.to) / 2 < a ? -1 : 1;
    placeTail(n.id, dir);
  });

  const place = (a: number, r: number) => ({
    x: TREE_CENTER.x + Math.cos(a) * r * X_STRETCH,
    y: TREE_CENTER.y + Math.sin(a) * r,
  });
  const pos: SkillTreeLayout['pos'] = { [root.id]: { ...TREE_CENTER } };
  nodes.forEach((n) => {
    if (n.id !== root.id) pos[n.id] = place(angle.get(n.id)!, radius.get(n.id)!);
  });

  // ○ を □ の外側、専用の角度帯の中に扇状に並べる
  satellites.forEach((list, anchorId) => {
    const r = (radius.get(anchorId) ?? 0) + SAT_OUT;
    const [f0, f1] = fanSpan.get(anchorId) ?? [angle.get(anchorId) ?? 0, angle.get(anchorId) ?? 0];
    const mid = (f0 + f1) / 2;
    // 楕円上では方向によって実際の距離が変わるので、局所的な伸び率で角度を補正する
    const stretch = Math.hypot(Math.sin(mid) * X_STRETCH, Math.cos(mid));
    const step = SAT_STEP / (r * stretch);
    list.forEach((n, k) => {
      pos[n.id] = place(mid + (k - (list.length - 1) / 2) * step, r);
    });
  });

  // 大きさを考慮した衝突解消 (起点は固定)
  const all = allNodes.filter((n) => pos[n.id]);
  for (let pass = 0; pass < 240; pass++) {
    let moved = false;
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const a = pos[all[i].id];
        const b = pos[all[j].id];
        const need = nodeRadius(all[i]) + nodeRadius(all[j]) + CLEARANCE;
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let dist = Math.hypot(dx, dy);
        if (dist >= need) continue;
        if (dist < 0.01) {
          dx = Math.cos(i + j);
          dy = Math.sin(i + j);
          dist = 1;
        }
        const push = (need - dist) / 2 + 0.5;
        const ux = dx / dist;
        const uy = dy / dist;
        const aFixed = all[i].id === root.id;
        const bFixed = all[j].id === root.id;
        if (!aFixed) {
          a.x -= ux * push * (bFixed ? 2 : 1);
          a.y -= uy * push * (bFixed ? 2 : 1);
        }
        if (!bFixed) {
          b.x += ux * push * (aFixed ? 2 : 1);
          b.y += uy * push * (aFixed ? 2 : 1);
        }
        moved = true;
      }
    }
    if (!moved) break;
  }

  const pts = Object.values(pos);
  return {
    pos,
    ringRadii: radii.slice(1),
    dividers,
    sectors,
    bounds: {
      minX: Math.min(...pts.map((p) => p.x)),
      minY: Math.min(...pts.map((p) => p.y)),
      maxX: Math.max(...pts.map((p) => p.x)),
      maxY: Math.max(...pts.map((p) => p.y)),
    },
    xStretch: X_STRETCH,
  };
};
