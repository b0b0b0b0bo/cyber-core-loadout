import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { SkillNode, SkillBranch, Weapon } from '../types';
import { sound } from '../utils/sound';
import { computeSkillTreeLayout, TREE_CENTER, isSpecificNode } from '../utils/skillTreeLayout';
import { usePalette, cutCorners } from '../theme';
import { maxNodeLevel, nodeLevelCap, nodeBreakCost, weaponBreakKey, weaponLevelCap, weaponBreakCost, weaponUpgradeCost, WEAPON_MAX_LEVEL, getNodeLevel, isNodeUpgradable, nodeUpgradeBulkCost, formatEffectValue, scaledEffectValue } from '../data/nodeLevels';
import {
  Shield,
  Zap,
  Flame,
  Cpu,
  Lock,
  Check,
  Sparkles,
  KeyRound,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Move,
  Crosshair,
  AlertCircle,
  Layers,
  Hexagon,
} from 'lucide-react';

const BreakButton: React.FC<{
  label: string;
  cost: number;
  beacons: number;
  scrap: number;
  have: number;
  onBreak: () => void;
}> = ({ label, cost, beacons, scrap, have, onBreak }) => {
  const ok = scrap >= cost && have >= beacons;
  return (
    <button
      onClick={() => {
        if (!ok) {
          sound.playDefeat();
          return;
        }
        sound.playUpgradeSuccess();
        onBreak();
      }}
      disabled={!ok}
      className={`w-full py-2 px-3 text-xs font-cyber font-bold transition-all cursor-pointer ${
        ok ? 'bg-hud-warn hover:brightness-110 text-hud-on-accent active:scale-[0.98]' : 'bg-hud-line text-hud-dim border border-hud-line-strong cursor-not-allowed'
      }`}
      style={{ clipPath: cutCorners(8) }}
    >
      <div>{label}</div>
      <div className="font-mono font-normal mt-0.5">{cost.toLocaleString()} SCRAP + {beacons} BEACON</div>
    </button>
  );
};

interface SkillTreeScreenProps {
  nodes: SkillNode[];
  weapons: Weapon[];
  userScrap: number;
  userBeacons?: number;
  weaponDamageLevels?: Record<string, number>;
  levelBreaks?: Record<string, number>;
  onBreakLimit?: (key: string) => void;
  onUnlockNode: (nodeId: string, cost: number) => void;
  /** G キーで全武器を解放する（デバッグ用ショートカット） */
  onUnlockAllWeapons?: () => void;
  onUpgradeWeaponDamage?: (weaponId: string, levels: number, cost: number) => void;
  nodeLevels?: Record<string, number>;
  onUpgradeNode?: (nodeId: string, levels: number, cost: number, beacons?: number) => void;
  /** 画面表示時に選択＆センタリングするノード */
  focusNodeId?: string | null;
}

/** パネルの四隅に置くHUD風のブラケット */
const CornerBrackets: React.FC<{ color?: string }> = ({ color = 'color-mix(in srgb, var(--hud-accent) 55%, transparent)' }) => (
  <>
    {(['top-0 left-0 border-t border-l', 'top-0 right-0 border-t border-r', 'bottom-0 left-0 border-b border-l', 'bottom-0 right-0 border-b border-r'] as const).map(
      (cls) => (
        <span key={cls} className={`pointer-events-none absolute w-4 h-4 ${cls}`} style={{ borderColor: color }} />
      ),
    )}
  </>
);

/** セクション見出し */
const SectionLabel: React.FC<{ children: React.ReactNode; icon?: React.ReactNode }> = ({ children, icon }) => (
  <div className="flex items-center gap-2 mb-2 text-[10px] font-cyber tracking-[0.2em] text-hud-dim uppercase">
    {icon}
    <span>{children}</span>
    <span className="flex-1 h-px bg-gradient-to-r from-hud-line-strong to-transparent" />
  </div>
);

export const SkillTreeScreen: React.FC<SkillTreeScreenProps> = ({
  nodes,
  weapons,
  userScrap,
  userBeacons = 0,
  weaponDamageLevels = {},
  levelBreaks = {},
  onBreakLimit,
  onUnlockNode,
  onUnlockAllWeapons,
  onUpgradeWeaponDamage,
  nodeLevels = {},
  onUpgradeNode,
  focusNodeId = null,
}) => {
  const HUD = usePalette();
  const [activeBranch, setActiveBranch] = useState<SkillBranch | 'ALL'>('ALL');
  const [selectedNodeId, setSelectedNodeId] = useState<string>('infight_passive_1');
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [showSpecific, setShowSpecific] = useState(false);

  // Pan & Zoom interactive canvas state
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) || nodes[0];

  // G キー: 全武器を解放
  const unlockAllRef = useRef(onUnlockAllWeapons);
  unlockAllRef.current = onUnlockAllWeapons;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'g' && e.key !== 'G') return;
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      unlockAllRef.current?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ノード構成から放射状ツリーの表示座標を自動計算 (構成が変わらない限り再計算しない)
  const layoutKey = nodes.map((n) => n.id + ':' + n.prerequisites.join(',')).join('|');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const layout = useMemo(() => computeSkillTreeLayout(nodes), [layoutKey]);
  const posOf = (n: SkillNode) => layout.pos[n.id] || { x: n.x, y: n.y };

  const outerRing = layout.ringRadii[layout.ringRadii.length - 1] || 400;
  const ellipsePoint = (angle: number, r: number) => ({
    x: TREE_CENTER.x + Math.cos(angle) * r * layout.xStretch,
    y: TREE_CENTER.y + Math.sin(angle) * r,
  });
  const sectorLabelPos = (from: number, to: number) => ellipsePoint((from + to) / 2, outerRing + 95);

  // 全ノードと系統ラベルが収まる表示範囲 (SVG viewBox)
  const vb = useMemo(() => {
    const pad = 60;
    let { minX, minY, maxX, maxY } = layout.bounds;
    layout.sectors.forEach(({ from, to }) => {
      const p = sectorLabelPos(from, to);
      minX = Math.min(minX, p.x - 110);
      maxX = Math.max(maxX, p.x + 110);
      minY = Math.min(minY, p.y - 35);
      maxY = Math.max(maxY, p.y + 30);
    });
    const x = minX - pad;
    const y = minY - pad;
    const w = maxX - minX + pad * 2;
    const h = maxY - minY + pad * 2;
    return { x, y, w, h, cx: x + w / 2, cy: y + h / 2 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout]);

  const [unlockedAnimNode, setUnlockedAnimNode] = useState<{ id: string; name: string; x: number; y: number; color: string } | null>(null);

  const branchThemes: Record<
    SkillBranch,
    { label: string; short: string; color: string; fill: string; icon: React.ReactNode }
  > = {
    INFIGHT: {
      label: 'INFIGHT // 近接・格闘',
      short: '近接・格闘',
      color: HUD.branch.INFIGHT,
      fill: `${HUD.branch.INFIGHT}29`,
      icon: <Shield className="w-3.5 h-3.5" />,
    },
    ASSAULT: {
      label: 'ASSAULT // フルオート射撃',
      short: 'フルオート射撃',
      color: HUD.branch.ASSAULT,
      fill: `${HUD.branch.ASSAULT}29`,
      icon: <Crosshair className="w-3.5 h-3.5" />,
    },
    GRENADE: {
      label: 'GRENADE // 単発・重火器・爆発物',
      short: '重火器・爆発物',
      color: HUD.branch.GRENADE,
      fill: `${HUD.branch.GRENADE}29`,
      icon: <Flame className="w-3.5 h-3.5" />,
    },
  };

  const isWeaponUnlocked = (weaponId: string): boolean => {
    const w = weapons.find((item) => item.id === weaponId);
    return !!w?.unlocked;
  };

  const isNodeVisible = (node: SkillNode): boolean => {
    if (!node.isWeaponSpecific) return true;
    if (!node.requiresWeaponUnlocked) return true;
    return isWeaponUnlocked(node.requiresWeaponUnlocked);
  };

  const isNodeAvailable = (node: SkillNode): boolean => {
    if (node.unlocked) return false;
    if (!isNodeVisible(node)) return false;
    if (node.prerequisites.length === 0) return true;
    return node.prerequisites.every((reqId) => {
      const parent = nodes.find((n) => n.id === reqId);
      return parent?.unlocked;
    });
  };

  const handleUnlock = (node: SkillNode) => {
    if (!isNodeAvailable(node) || userScrap < node.cost) {
      sound.playDefeat();
      return;
    }
    sound.playUpgradeSuccess();
    setUnlockedAnimNode({
      id: node.id,
      name: node.name,
      x: posOf(node).x,
      y: posOf(node).y,
      color: branchThemes[node.branch]?.color || HUD.accent,
    });
    setTimeout(() => {
      setUnlockedAnimNode(null);
    }, 1400);
    onUnlockNode(node.id, node.cost);
  };

  // 見やすさのため、表示するノードを絞り込む:
  //  - 系統フィルタ中は他系統を完全に非表示
  //  - 武器特有強化(○)は、トグルON or 選択ノードがその武器の解放ノード/同じ武器の○のときだけ表示
  const selectedRaw = nodes.find((n) => n.id === selectedNodeId);
  const isNodeShown = (node: SkillNode): boolean => {
    if (!isNodeVisible(node)) return false;
    if (node.id === 'core_root') return true;
    if (activeBranch !== 'ALL' && node.branch !== activeBranch) return false;
    if (!isSpecificNode(node) || showSpecific) return true;
    if (node.id === selectedNodeId) return true;
    if (!selectedRaw) return false;
    return node.prerequisites.some((p) => p === selectedRaw.id || selectedRaw.prerequisites.includes(p));
  };

  // 表示座標は自動レイアウト (重なり解消済み) をそのまま使う。
  // 非表示のノードも場所は確保されているので、表示を切り替えても位置は動かない。
  const visibleNodes = nodes.filter(isNodeShown).map((n) => ({ ...n, ...posOf(n) }));

  // Generate connector links
  const connections: { from: SkillNode; to: SkillNode }[] = [];
  visibleNodes.forEach((targetNode) => {
    targetNode.prerequisites.forEach((parentReqId) => {
      const parent = visibleNodes.find((n) => n.id === parentReqId);
      if (parent) {
        connections.push({ from: parent, to: targetNode });
      }
    });
  });

  const unlockedCount = nodes.filter((n) => n.unlocked && n.id !== 'core_root').length;
  const totalCount = nodes.filter((n) => n.id !== 'core_root').length;

  // Pan & Zoom handlers (マウス移動量を SVG 座標に換算して、カーソルに吸い付くように動かす)
  const screenToSvgScale = () => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return 1;
    return Math.max(vb.w / rect.width, vb.h / rect.height);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    isDraggingRef.current = true;
    const s = screenToSvgScale();
    dragStartRef.current = { x: e.clientX * s - pan.x, y: e.clientY * s - pan.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current) return;
    const s = screenToSvgScale();
    setPan({
      x: e.clientX * s - dragStartRef.current.x,
      y: e.clientY * s - dragStartRef.current.y,
    });
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  const ZOOM_MIN = 0.7;
  const ZOOM_MAX = 2.8;
  const handleWheel = (e: React.WheelEvent) => {
    const factor = e.deltaY > 0 ? 1 / 1.1 : 1.1;
    setZoom((z) => Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z * factor)));
  };

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // 系統を切り替えたら、その系統が画面いっぱいになるようにズーム＆センタリング
  useEffect(() => {
    if (activeBranch === 'ALL') {
      resetView();
      return;
    }
    const pts = nodes.filter((n) => (n.branch === activeBranch || n.id === 'core_root') && isNodeVisible(n));
    if (pts.length === 0) return;
    const xs = pts.map((n) => posOf(n).x);
    const ys = pts.map((n) => posOf(n).y);
    const w = Math.max(...xs) - Math.min(...xs) + 160;
    const h = Math.max(...ys) - Math.min(...ys) + 160;
    const cx = (Math.max(...xs) + Math.min(...xs)) / 2;
    const cy = (Math.max(...ys) + Math.min(...ys)) / 2;
    const z = Math.max(1, Math.min(2.4, 0.95 * Math.min(vb.w / w, vb.h / h)));
    setZoom(z);
    setPan({ x: -z * (cx - vb.cx), y: -z * (cy - vb.cy) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBranch, vb]);

  // 武器編成画面から飛んできたとき: そのノードを選択してセンタリング (系統切替の効果より後に実行して上書き)
  useEffect(() => {
    if (!focusNodeId) return;
    const node = nodes.find((n) => n.id === focusNodeId);
    if (!node) return;
    const p = posOf(node);
    const z = 1.8;
    setActiveBranch('ALL');
    setSelectedNodeId(node.id);
    setZoom(z);
    setPan({ x: -z * (p.x - vb.cx), y: -z * (p.y - vb.cy) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusNodeId]);

  // Helper to render pure SVG icon inside nodes
  const renderNodeIcon = (node: SkillNode, isUnlocked: boolean, isAvail: boolean, themeColor: string) => {
    const iconColor = isUnlocked ? themeColor : isAvail ? HUD.availStroke : HUD.lockedIcon;
    const isSpecific = isSpecificNode(node);
    const size = node.id === 'core_root' ? 24 : isSpecific ? 14 : 18;
    const half = size / 2;
    const type = node.iconType || (node.nodeType === 'WEAPON_UNLOCK' ? 'key' : 'zap');

    switch (type) {
      case 'shield':
        return (
          <g transform={`translate(${node.x - half}, ${node.y - half}) scale(${size / 20})`}>
            <path
              d="M 10 2 L 18 5 L 18 11 C 18 16 10 19 10 19 C 10 19 2 16 2 11 L 2 5 Z"
              fill="none"
              stroke={iconColor}
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        );
      case 'crosshair':
        return (
          <g transform={`translate(${node.x - half}, ${node.y - half}) scale(${size / 20})`}>
            <circle cx="10" cy="10" r="7" fill="none" stroke={iconColor} strokeWidth="1.8" />
            <line x1="10" y1="0" x2="10" y2="5" stroke={iconColor} strokeWidth="1.8" />
            <line x1="10" y1="15" x2="10" y2="20" stroke={iconColor} strokeWidth="1.8" />
            <line x1="0" y1="10" x2="5" y2="10" stroke={iconColor} strokeWidth="1.8" />
            <line x1="15" y1="10" x2="20" y2="10" stroke={iconColor} strokeWidth="1.8" />
          </g>
        );
      case 'key':
        return (
          <g transform={`translate(${node.x - half}, ${node.y - half}) scale(${size / 20})`}>
            <circle cx="7" cy="7" r="5" fill="none" stroke={iconColor} strokeWidth="1.8" />
            <path d="M 11 11 L 18 18 M 15 15 L 17 13 M 17 17 L 19 15" stroke={iconColor} strokeWidth="1.8" strokeLinecap="round" />
          </g>
        );
      case 'speed':
        return (
          <g transform={`translate(${node.x - half}, ${node.y - half}) scale(${size / 20})`}>
            <path
              d="M 3 13 L 13 3 M 7 17 L 17 7 M 2 7 L 13 7 L 8 18"
              fill="none"
              stroke={iconColor}
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        );
      case 'heavy':
        return (
          <g transform={`translate(${node.x - half}, ${node.y - half}) scale(${size / 20})`}>
            <circle cx="10" cy="12" r="6" fill="none" stroke={iconColor} strokeWidth="1.8" />
            <path d="M 13 6 L 16 3 M 17 2 L 18 3" stroke={iconColor} strokeWidth="1.8" strokeLinecap="round" />
          </g>
        );
      case 'railgun':
        return (
          <g transform={`translate(${node.x - half}, ${node.y - half}) scale(${size / 20})`}>
            <path
              d="M 2 10 L 18 10 M 6 4 L 14 10 L 6 16"
              fill="none"
              stroke={iconColor}
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        );
      case 'reaper':
        return (
          <g transform={`translate(${node.x - half}, ${node.y - half}) scale(${size / 20})`}>
            <circle cx="5" cy="10" r="1.8" fill={iconColor} />
            <circle cx="10" cy="6" r="1.8" fill={iconColor} />
            <circle cx="10" cy="14" r="1.8" fill={iconColor} />
            <circle cx="15" cy="10" r="1.8" fill={iconColor} />
          </g>
        );
      case 'sword':
        return (
          <g transform={`translate(${node.x - half}, ${node.y - half}) scale(${size / 20})`}>
            <path
              d="M 16 4 L 14 2 L 6 10 L 8 12 Z M 5 11 L 3 13 L 2 17 L 3 18 L 7 17 L 9 15 L 7 13"
              fill="none"
              stroke={iconColor}
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
          </g>
        );
      case 'magnum':
        return (
          <g transform={`translate(${node.x - half}, ${node.y - half}) scale(${size / 20})`}>
            <circle cx="10" cy="10" r="7" fill="none" stroke={iconColor} strokeWidth="1.8" />
            <circle cx="10" cy="6" r="1.5" fill={iconColor} />
            <circle cx="13.5" cy="8" r="1.5" fill={iconColor} />
            <circle cx="13.5" cy="12" r="1.5" fill={iconColor} />
            <circle cx="10" cy="14" r="1.5" fill={iconColor} />
            <circle cx="6.5" cy="12" r="1.5" fill={iconColor} />
            <circle cx="6.5" cy="8" r="1.5" fill={iconColor} />
          </g>
        );
      case 'heart':
        return (
          <g transform={`translate(${node.x - half}, ${node.y - half}) scale(${size / 20})`}>
            <path
              d="M 10 16 L 3.5 9.5 C 1.5 7.5 2 4 4.5 3 C 7 2 9 4 10 5.5 C 11 4 13 2 15.5 3 C 18 4 18.5 7.5 16.5 9.5 Z"
              fill="none"
              stroke={iconColor}
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
          </g>
        );
      case 'armor':
        return (
          <g transform={`translate(${node.x - half}, ${node.y - half}) scale(${size / 20})`}>
            <path
              d="M 10 2 L 17 5 L 17 11 C 17 15.5 10 18.5 10 18.5 C 10 18.5 3 15.5 3 11 L 3 5 Z M 10 6 L 10 15"
              fill="none"
              stroke={iconColor}
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
          </g>
        );
      case 'zap':
      default:
        return (
          <g transform={`translate(${node.x - half}, ${node.y - half}) scale(${size / 20})`}>
            <polygon
              points="11,2 4,12 10,12 8,20 16,9 10,9"
              fill="none"
              stroke={iconColor}
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
          </g>
        );
    }
  };

  const unlockedWeaponTarget = selectedNode.unlocksWeaponId
    ? weapons.find((w) => w.id === selectedNode.unlocksWeaponId)
    : undefined;

  const specificWeaponTarget = selectedNode.targetWeaponId
    ? weapons.find((w) => w.id === selectedNode.targetWeaponId)
    : undefined;

  const selectedTheme = branchThemes[selectedNode.branch];
  const selectedAvailable = isNodeAvailable(selectedNode);
  return (
    <div
      className="relative w-full h-full flex flex-col p-5 overflow-hidden text-hud-text select-none font-body"
      style={{ background: 'var(--hud-backdrop)' }}
    >
      {/* Scanlines */}
      <div className="pointer-events-none absolute inset-0 hud-scanlines" />

      {/* TOP HEADER */}
      <div className="relative flex items-end justify-between pb-4 mb-4 shrink-0">
        <div>
          <div className="text-[10px] tracking-[0.35em] text-hud-accent/80 font-cyber mb-1.5 flex items-center gap-2">
            <span className="inline-block w-1.5 h-1.5 bg-hud-accent rotate-45 shadow-[var(--hud-glow)]" />
            RADIAL GADGET TREE
            <span className="text-hud-dim">//</span>
            <span className="text-hud-dim tracking-[0.2em]">3系統放射状スキルマトリクス</span>
          </div>
          <h2 className="text-2xl font-black font-cyber tracking-[0.12em] text-hud-text leading-none">
            CYBER CORE <span className="text-transparent bg-clip-text bg-gradient-to-r from-hud-accent to-sky-500">CONSTELLATION</span>
          </h2>
          <div className="mt-2 flex items-center gap-3">
            <span className="text-xs text-hud-muted font-gothic tracking-wider">ガジェットツリー強化</span>
            <div className="flex items-center gap-2">
              <div className="w-40 h-1 bg-hud-line overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-hud-accent to-hud-accent-2 shadow-[var(--hud-glow)] transition-all duration-500"
                  style={{ width: `${(unlockedCount / Math.max(1, totalCount)) * 100}%` }}
                />
              </div>
              <span className="text-[10px] font-mono text-hud-accent/90 tabular-nums">
                SYNC {unlockedCount}/{totalCount}
              </span>
            </div>
          </div>
        </div>

        {/* Branch Filter & Currency */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            {(['ALL', 'INFIGHT', 'ASSAULT', 'GRENADE'] as const).map((branch) => {
              const active = activeBranch === branch;
              const color = branch === 'ALL' ? HUD.accent : branchThemes[branch].color;
              return (
                <button
                  key={branch}
                  onClick={() => {
                    sound.playUiClick();
                    setActiveBranch(branch);
                  }}
                  className="relative -skew-x-12 px-3.5 py-1.5 text-[11px] font-cyber tracking-[0.15em] font-bold transition-all cursor-pointer border"
                  style={{
                    color: active ? (HUD.isDark ? '#04070d' : '#ffffff') : color,
                    background: active ? color : 'var(--hud-tile)',
                    borderColor: active ? color : `${color}40`,
                    boxShadow: active ? `0 0 18px ${color}66` : 'none',
                  }}
                >
                  <span className="skew-x-12 inline-flex items-center gap-1.5">
                    {branch !== 'ALL' && branchThemes[branch].icon}
                    {branch}
                  </span>
                </button>
              );
            })}
          </div>

          <div
            className="relative flex items-center gap-2.5 bg-hud-tile px-4 py-2 border border-hud-accent/30"
            style={{ clipPath: cutCorners(10) }}
          >
            <Cpu className="w-4 h-4 text-hud-accent" />
            <span className="text-[10px] text-hud-dim font-cyber tracking-[0.2em]">SCRAP</span>
            <span className="text-lg font-bold font-cyber text-hud-accent tabular-nums drop-shadow-[var(--hud-glow)]">
              {userScrap.toLocaleString()}
            </span>
          </div>

          <div
            className="relative flex items-center gap-2.5 bg-hud-tile px-4 py-2 border border-hud-warn/40"
            style={{ clipPath: cutCorners(10) }}
          >
            <Hexagon className="w-4 h-4 text-hud-warn" />
            <span className="text-[10px] text-hud-dim font-cyber tracking-[0.2em]">BEACON</span>
            <span className="text-lg font-bold font-cyber text-hud-warn tabular-nums">{userBeacons.toLocaleString()}</span>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-hud-accent/60 via-hud-line to-transparent" />
      </div>

      {/* MAIN 2-COLUMN VIEWPORT */}
      <div className="relative flex-1 grid grid-cols-12 gap-5 min-h-0">
        {/* RADIAL SVG CANVAS (8 cols) */}
        <div
          className="col-span-8 relative overflow-hidden flex flex-col border border-hud-line bg-hud-panel cursor-grab active:cursor-grabbing"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
        >
          <CornerBrackets />

          {/* Canvas Controls Toolbar */}
          <div
            className="absolute top-4 left-4 z-10 flex items-center gap-1.5 bg-hud-panel backdrop-blur-md px-2.5 py-1.5 border border-hud-line-strong text-xs"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setZoom((z) => Math.min(ZOOM_MAX, z * 1.2))}
              className="p-1 hover:text-hud-accent cursor-pointer text-hud-muted transition-colors"
              title="ズームイン"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={() => setZoom((z) => Math.max(ZOOM_MIN, z / 1.2))}
              className="p-1 hover:text-hud-accent cursor-pointer text-hud-muted transition-colors"
              title="ズームアウト"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={resetView}
              className="p-1 hover:text-hud-accent cursor-pointer text-hud-muted transition-colors"
              title="表示位置リセット"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <div className="w-px h-3.5 bg-hud-line-strong mx-1" />
            <span className="font-mono text-[11px] text-hud-accent/90 tabular-nums w-9 text-right">
              {Math.round(zoom * 100)}%
            </span>
            <span className="text-[10px] text-hud-dim font-mono ml-1 flex items-center gap-1">
              <Move className="w-3 h-3" /> DRAG
            </span>
            <div className="w-px h-3.5 bg-hud-line-strong mx-1" />
            <button
              onClick={() => {
                sound.playUiClick();
                setShowSpecific((v) => !v);
              }}
              className={`px-2 py-0.5 text-[10px] font-cyber tracking-wider font-bold cursor-pointer border transition-colors flex items-center gap-1 ${
                showSpecific
                  ? 'bg-hud-warn/15 text-hud-warn border-hud-warn/50'
                  : 'bg-hud-tile text-hud-muted border-hud-line-strong hover:text-hud-text'
              }`}
              title="武器ごとの特有強化(○)を全て表示 / 選択中の武器のみ表示"
            >
              <Layers className="w-3 h-3" />
              特有強化 {showSpecific ? '全表示' : '選択時のみ'}
            </button>
          </div>

          {/* Legend */}
          <div className="absolute bottom-4 left-4 z-10 flex items-center gap-4 bg-hud-panel backdrop-blur-md px-3.5 py-2 border border-hud-line-strong text-[10px] font-mono text-hud-muted">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 border border-hud-muted" /> 武器解放
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 border border-hud-muted rotate-45" /> パッシブ
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full border border-hud-muted" /> 特有強化
            </span>
            <span className="w-px h-3 bg-hud-line-strong" />
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 bg-hud-accent shadow-[var(--hud-glow)]" /> 解放済み
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 border border-hud-text" /> 解放可能
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 border border-hud-line-strong" /> 未解放
            </span>
          </div>

          {/* SVG Vector Canvas */}
          <svg
            ref={svgRef}
            className="w-full h-full"
            viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              <style>{`
                @keyframes marchClockwise { from { stroke-dashoffset: 0; } to { stroke-dashoffset: -40; } }
                @keyframes marchCounterClockwise { from { stroke-dashoffset: 0; } to { stroke-dashoffset: 40; } }
                .marching-ants { animation: marchClockwise 1.5s linear infinite; }
                .marching-ants-reverse { animation: marchCounterClockwise 2.0s linear infinite; }
                .flow-line { animation: marchClockwise 1.2s linear infinite; }
              `}</style>
              <pattern id="tech-grid" width="48" height="48" patternUnits="userSpaceOnUse">
                <path d="M 48 0 L 0 0 0 48" fill="none" stroke={HUD.grid} strokeWidth="1" />
              </pattern>
              <radialGradient id="core-grad" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#e0f2fe" />
                <stop offset="35%" stopColor="#22d3ee" />
                <stop offset="100%" stopColor="#0c4a6e" />
              </radialGradient>
              <radialGradient id="core-aura" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="rgba(34, 211, 238, 0.35)" />
                <stop offset="100%" stopColor="rgba(34, 211, 238, 0)" />
              </radialGradient>
              <filter id="node-glow" x="-60%" y="-60%" width="220%" height="220%">
                <feGaussianBlur stdDeviation="3.5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Canvas Transform Group for Pan & Zoom */}
            <g
              transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}
              style={{ transformOrigin: `${vb.cx}px ${vb.cy}px` }}
            >
              <rect x={vb.x - 3000} y={vb.y - 3000} width={vb.w + 6000} height={vb.h + 6000} fill="url(#tech-grid)" />

              {/* Orbit rings */}
              {layout.ringRadii.map((r, i) => (
                <ellipse
                  key={`ring-${i}`}
                  cx={TREE_CENTER.x}
                  cy={TREE_CENTER.y}
                  rx={r * layout.xStretch}
                  ry={r}
                  fill="none"
                  stroke={HUD.ring}
                  strokeWidth="1"
                  strokeDasharray={i % 2 === 0 ? '2 6' : '10 6'}
                />
              ))}

              {/* Branch sectors: dividers + labels */}
              {layout.dividers.map(({ angle, branch }) => {
                const p1 = ellipsePoint(angle, 60);
                const p2 = ellipsePoint(angle, outerRing + 70);
                return (
                  <line
                    key={`div-${branch}`}
                    x1={p1.x}
                    y1={p1.y}
                    x2={p2.x}
                    y2={p2.y}
                    stroke={HUD.ring}
                    strokeWidth="1"
                    strokeDasharray="1 7"
                  />
                );
              })}
              {layout.sectors.map(({ branch, from, to }) => {
                const theme = branchThemes[branch];
                const p = sectorLabelPos(from, to);
                const dim = activeBranch !== 'ALL' && activeBranch !== branch;
                return (
                  <g key={`sector-${branch}`} opacity={dim ? 0.15 : 1} className="pointer-events-none">
                    <text
                      x={p.x}
                      y={p.y}
                      textAnchor="middle"
                      fontSize="30"
                      fontWeight={900}
                      letterSpacing="10"
                      fill={theme.color}
                      opacity={0.22}
                      style={{ fontFamily: 'var(--font-cyber)' }}
                    >
                      {branch}
                    </text>
                    <text
                      x={p.x}
                      y={p.y + 22}
                      textAnchor="middle"
                      fontSize="12"
                      letterSpacing="4"
                      fill={theme.color}
                      opacity={0.35}
                      style={{ fontFamily: 'var(--font-gothic)' }}
                    >
                      {theme.short}
                    </text>
                  </g>
                );
              })}

              {/* CONNECTION CONDUITS */}
              {connections.map(({ from, to }, idx) => {
                const isUnlocked = from.unlocked && to.unlocked;
                const isAvailableToUnlock = from.unlocked && !to.unlocked && isNodeAvailable(to);
                const color = branchThemes[to.branch].color;

                const dx = to.x - from.x;
                const dy = to.y - from.y;
                const dist = Math.hypot(dx, dy);
                if (dist < 1) return null;
                const ux = dx / dist;
                const uy = dy / dist;
                const boundary = (n: SkillNode) =>
                  n.id === 'core_root' ? 26 : isSpecificNode(n) ? 14 : n.nodeType === 'WEAPON_UNLOCK' ? 21 : 21;
                const x1 = from.x + ux * boundary(from);
                const y1 = from.y + uy * boundary(from);
                const x2 = to.x - ux * boundary(to);
                const y2 = to.y - uy * boundary(to);

                return (
                  <g key={`${from.id}->${to.id}-${idx}`}>
                    {isUnlocked && (
                      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={6} opacity={0.14} strokeLinecap="round" />
                    )}
                    <line
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke={isUnlocked ? color : isAvailableToUnlock ? HUD.availLine : HUD.lockedLine}
                      strokeWidth={isUnlocked ? 1.8 : isAvailableToUnlock ? 1.4 : 1.2}
                      strokeDasharray={isUnlocked ? 'none' : isAvailableToUnlock ? '6 4' : 'none'}
                      className={isAvailableToUnlock ? 'flow-line' : undefined}
                    />
                  </g>
                );
              })}

              {/* NODES (武器解放: 四角, パッシブ: 菱形, 特有強化: ○) */}
              {visibleNodes.map((node) => {
                const isSelected = selectedNodeId === node.id;
                const isHovered = hoveredNodeId === node.id;
                const isAvail = isNodeAvailable(node);
                const isRoot = node.id === 'core_root';
                const isSpecific = isSpecificNode(node);
                const isWeaponUnlock = node.nodeType === 'WEAPON_UNLOCK';
                const theme = branchThemes[node.branch];

                const fillColor = node.unlocked ? theme.fill : isAvail ? HUD.availFill : HUD.lockedFill;
                const strokeColor = node.unlocked ? theme.color : isAvail ? HUD.availStroke : HUD.lockedStroke;
                const strokeW = node.unlocked ? 2.2 : isAvail ? 1.8 : 1.3;
                const shapeProps = {
                  fill: fillColor,
                  stroke: strokeColor,
                  strokeWidth: strokeW,
                  filter: node.unlocked ? 'url(#node-glow)' : undefined,
                };
                const haloColor = node.unlocked ? theme.color : isAvail ? HUD.availStroke : HUD.textMuted;

                // 名前ラベルは解放済みノードのみ (選択中 / ホバー中 / 系統フィルタ中)
                const showLabel =
                  !isRoot && node.unlocked && (isSelected || isHovered || (activeBranch !== 'ALL' && !isSpecific));

                return (
                  <g
                    key={node.id}
                    className="cursor-pointer"
                    onMouseDown={(e) => e.stopPropagation()}
                    onMouseEnter={() => setHoveredNodeId(node.id)}
                    onMouseLeave={() => setHoveredNodeId((h) => (h === node.id ? null : h))}
                    onClick={(e) => {
                      e.stopPropagation();
                      sound.playUiHover();
                      setSelectedNodeId(node.id);
                    }}
                  >
                    {/* 解放可能ノードの呼吸するリング */}
                    {isAvail && !isSelected && (
                      <circle cx={node.x} cy={node.y} r={isSpecific ? 19 : 29} fill="none" stroke={theme.color} strokeWidth="1.2">
                        <animate attributeName="opacity" values="0.15;0.75;0.15" dur="2.2s" repeatCount="indefinite" />
                        <animate attributeName="r" values={isSpecific ? '17;21;17' : '27;32;27'} dur="2.2s" repeatCount="indefinite" />
                      </circle>
                    )}

                    {/* 選択中ハロー */}
                    {isSelected && (
                      <g className="pointer-events-none">
                        <circle
                          cx={node.x}
                          cy={node.y}
                          r={isRoot ? 36 : isSpecific ? 21 : 32}
                          fill="none"
                          stroke={haloColor}
                          strokeWidth="1.8"
                          strokeDasharray="7 5"
                          className="marching-ants"
                        />
                        <circle
                          cx={node.x}
                          cy={node.y}
                          r={isRoot ? 42 : isSpecific ? 26 : 38}
                          fill="none"
                          stroke={haloColor}
                          strokeWidth="0.8"
                          strokeDasharray="2 6"
                          opacity={0.6}
                          className="marching-ants-reverse"
                        />
                        {[0, 90, 180, 270].map((deg) => {
                          const r1 = isSpecific ? 23 : 34;
                          const r2 = isSpecific ? 29 : 42;
                          const a = (deg * Math.PI) / 180;
                          return (
                            <line
                              key={deg}
                              x1={node.x + Math.cos(a) * r1}
                              y1={node.y + Math.sin(a) * r1}
                              x2={node.x + Math.cos(a) * r2}
                              y2={node.y + Math.sin(a) * r2}
                              stroke={haloColor}
                              strokeWidth="1.5"
                            />
                          );
                        })}
                      </g>
                    )}

                    {/* NODE GEOMETRY */}
                    {isRoot ? (
                      <g>
                        <circle cx={node.x} cy={node.y} r={60} fill="url(#core-aura)" />
                        <circle cx={node.x} cy={node.y} r={30} fill="none" stroke="rgba(34,211,238,0.5)" strokeWidth="1" strokeDasharray="3 5">
                          <animateTransform attributeName="transform" type="rotate" from={`0 ${node.x} ${node.y}`} to={`360 ${node.x} ${node.y}`} dur="14s" repeatCount="indefinite" />
                        </circle>
                        <circle cx={node.x} cy={node.y} r={22} fill="url(#core-grad)" stroke="#a5f3fc" strokeWidth="1.5" filter="url(#node-glow)" />
                        <circle cx={node.x} cy={node.y} r={14} fill="none" stroke={HUD.bg} strokeWidth="1" opacity={0.5} />
                      </g>
                    ) : isWeaponUnlock ? (
                      <rect x={node.x - 20} y={node.y - 20} width={40} height={40} rx={3} {...shapeProps} />
                    ) : isSpecific ? (
                      <circle cx={node.x} cy={node.y} r={14} {...shapeProps} />
                    ) : (
                      <polygon
                        points={`${node.x},${node.y - 22} ${node.x + 22},${node.y} ${node.x},${node.y + 22} ${node.x - 22},${node.y}`}
                        {...shapeProps}
                      />
                    )}

                    {/* Icon Inside Node */}
                    {!isRoot && renderNodeIcon(node, node.unlocked, isAvail, theme.color)}

                    {/* Name label */}
                    {showLabel && (
                      <text
                        x={node.x}
                        y={node.y + (isSpecific ? 30 : 39)}
                        textAnchor="middle"
                        fontSize={isSelected ? 13 : 11.5}
                        fontWeight={700}
                        letterSpacing="1"
                        fill={isSelected ? HUD.text : HUD.textMuted}
                        stroke={HUD.labelHalo}
                        strokeWidth={4}
                        paintOrder="stroke"
                        className="pointer-events-none select-none"
                        style={{ fontFamily: 'var(--font-gothic)' }}
                      >
                        {(node.name.includes('//') ? node.name.split('//')[1].trim() : node.name).slice(0, 14)}
                      </text>
                    )}

                    {/* Level / check badge */}
                    {node.unlocked && (isNodeUpgradable(node) || !isRoot) && (
                      <g
                        transform={
                          isRoot
                            ? `translate(${node.x + 24}, ${node.y - 40})`
                            : isSpecific
                            ? `translate(${node.x + 8}, ${node.y - 15})`
                            : `translate(${node.x + 12}, ${node.y - 20})`
                        }
                      >
                        {isNodeUpgradable(node) ? (
                          <>
                            <circle
                              cx="5"
                              cy="5"
                              r="7"
                              fill={HUD.bg}
                              stroke={getNodeLevel(node, nodeLevels) >= maxNodeLevel(node) ? '#fbbf24' : theme.color}
                              strokeWidth="1.3"
                            />
                            <text
                              x="5"
                              y="8.3"
                              textAnchor="middle"
                              fontSize="8.5"
                              fontWeight={800}
                              fill={getNodeLevel(node, nodeLevels) >= maxNodeLevel(node) ? '#fbbf24' : theme.color}
                              className="pointer-events-none select-none"
                              style={{ fontFamily: 'var(--font-cyber)' }}
                            >
                              {getNodeLevel(node, nodeLevels)}
                            </text>
                          </>
                        ) : (
                          <>
                            <circle cx="5" cy="5" r="5" fill={theme.color} />
                            <path d="M 3 5 L 4.5 6.5 L 7.2 3.8" fill="none" stroke={HUD.bg} strokeWidth="1.4" strokeLinecap="round" />
                          </>
                        )}
                      </g>
                    )}
                  </g>
                );
              })}

              {/* UNLOCK BURST ANIMATION */}
              {unlockedAnimNode && (
                <g className="pointer-events-none" transform={`translate(${unlockedAnimNode.x}, ${unlockedAnimNode.y})`}>
                  <circle r="8" fill="none" stroke={unlockedAnimNode.color} strokeWidth="4">
                    <animate attributeName="r" from="8" to="72" dur="0.9s" fill="freeze" />
                    <animate attributeName="opacity" from="1" to="0" dur="0.9s" fill="freeze" />
                  </circle>
                  <circle r="12" fill="none" stroke="#a5f3fc" strokeWidth="2.5" strokeDasharray="6 4">
                    <animate attributeName="r" from="12" to="95" dur="1.2s" fill="freeze" />
                    <animate attributeName="opacity" from="0.9" to="0" dur="1.2s" fill="freeze" />
                    <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="1.2s" repeatCount="1" />
                  </circle>
                  <circle r="4" fill="none" stroke="#ffffff" strokeWidth="5">
                    <animate attributeName="r" from="4" to="48" dur="0.6s" fill="freeze" />
                    <animate attributeName="opacity" from="1" to="0" dur="0.6s" fill="freeze" />
                  </circle>
                  {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((angle) => {
                    const rad = (angle * Math.PI) / 180;
                    const cosA = Math.cos(rad);
                    const sinA = Math.sin(rad);
                    return (
                      <g key={angle}>
                        <circle cx="0" cy="0" r="4" fill={unlockedAnimNode.color}>
                          <animate attributeName="cx" from="0" to={`${cosA * 80}`} dur="1.0s" fill="freeze" />
                          <animate attributeName="cy" from="0" to={`${sinA * 80}`} dur="1.0s" fill="freeze" />
                          <animate attributeName="r" from="4" to="0.8" dur="1.0s" fill="freeze" />
                          <animate attributeName="opacity" from="1" to="0" dur="1.0s" fill="freeze" />
                        </circle>
                        <line x1="0" y1="0" x2="0" y2="0" stroke={unlockedAnimNode.color} strokeWidth="2">
                          <animate attributeName="x1" from="0" to={`${cosA * 25}`} dur="0.8s" fill="freeze" />
                          <animate attributeName="y1" from="0" to={`${sinA * 25}`} dur="0.8s" fill="freeze" />
                          <animate attributeName="x2" from="0" to={`${cosA * 70}`} dur="0.8s" fill="freeze" />
                          <animate attributeName="y2" from="0" to={`${sinA * 70}`} dur="0.8s" fill="freeze" />
                          <animate attributeName="opacity" from="0.9" to="0" dur="0.8s" fill="freeze" />
                        </line>
                      </g>
                    );
                  })}
                  <circle r="26" fill={unlockedAnimNode.color} opacity="0.6">
                    <animate attributeName="r" from="26" to="0" dur="0.7s" fill="freeze" />
                    <animate attributeName="opacity" from="0.7" to="0" dur="0.7s" fill="freeze" />
                  </circle>
                </g>
              )}
            </g>
          </svg>

          {/* Vignette */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: 'radial-gradient(ellipse at center, transparent 55%, var(--hud-vignette) 100%)' }}
          />

          {/* UNLOCK BANNER */}
          <AnimatePresence>
            {unlockedAnimNode && (
              <motion.div
                initial={{ opacity: 0, y: -20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.95 }}
                className="absolute top-6 left-1/2 -translate-x-1/2 z-40 bg-hud-panel backdrop-blur-md px-6 py-3 border flex items-center gap-4 pointer-events-none"
                style={{ borderColor: unlockedAnimNode.color, boxShadow: `0 0 30px ${unlockedAnimNode.color}55`, clipPath: cutCorners(12) }}
              >
                <div
                  className="w-10 h-10 flex items-center justify-center text-hud-on-accent"
                  style={{ backgroundColor: unlockedAnimNode.color, clipPath: cutCorners(6) }}
                >
                  <Sparkles className="w-5 h-5" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-cyber tracking-[0.3em] text-hud-muted">NODE UNLOCKED // 解放完了</span>
                  <span className="text-sm font-bold font-cyber text-hud-text">{unlockedAnimNode.name}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* RIGHT DETAIL PANEL (4 cols) */}
        <div className="col-span-4 flex flex-col min-h-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedNode.id}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="relative flex-1 bg-hud-panel backdrop-blur-md border border-hud-line flex flex-col justify-between overflow-hidden"
            >
              <CornerBrackets color={`${selectedTheme.color}aa`} />
              <div
                className="absolute top-0 left-0 right-0 h-[2px]"
                style={{ background: `linear-gradient(90deg, ${selectedTheme.color}, transparent)`, boxShadow: `0 0 12px ${selectedTheme.color}` }}
              />

              <div className="p-5 overflow-y-auto">
                {/* Header Tag */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2" style={{ color: selectedTheme.color }}>
                    {selectedTheme.icon}
                    <span className="font-cyber font-bold text-[11px] tracking-[0.25em]">
                      {selectedTheme.label.split('//')[0].trim()}
                    </span>
                  </div>
                  <span
                    className="text-[10px] font-cyber tracking-wider px-2 py-0.5 font-bold border"
                    style={
                      selectedNode.unlocked
                        ? { color: selectedTheme.color, borderColor: `${selectedTheme.color}66`, background: selectedTheme.fill }
                        : selectedAvailable
                        ? { color: 'var(--hud-text)', borderColor: 'var(--hud-line-strong)', background: 'var(--hud-tile)' }
                        : { color: 'var(--hud-dim)', borderColor: 'var(--hud-line)', background: 'var(--hud-tile)' }
                    }
                  >
                    {selectedNode.unlocked ? 'ACTIVE // 解放済み' : selectedAvailable ? 'READY // 解放可能' : 'LOCKED // 未解放'}
                  </span>
                </div>

                {/* Node Title */}
                <div className="mb-4">
                  <h3 className="text-lg font-bold font-cyber text-hud-text leading-snug tracking-wide">{selectedNode.name}</h3>
                  <div className="mt-2 flex items-center gap-2">
                    {selectedNode.nodeType === 'WEAPON_UNLOCK' ? (
                      <span className="px-2 py-0.5 text-[10px] text-hud-ok border border-hud-ok/40 bg-hud-ok/10 font-cyber tracking-wider flex items-center gap-1.5">
                        <span className="inline-block w-2 h-2 border border-hud-ok" />
                        WEAPON UNLOCK // 武器解放
                      </span>
                    ) : selectedNode.isWeaponSpecific ? (
                      <span className="px-2 py-0.5 text-[10px] text-hud-warn border border-hud-warn/40 bg-hud-warn/10 font-cyber tracking-wider flex items-center gap-1.5">
                        <span className="inline-block w-2 h-2 rounded-full border border-hud-warn" />
                        SPECIFIC // 武器特有強化
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 text-[10px] text-hud-accent-2 border border-hud-accent-2/40 bg-hud-accent-2/10 font-cyber tracking-wider flex items-center gap-1.5">
                        <span className="inline-block w-2 h-2 border border-hud-accent-2 rotate-45" />
                        PASSIVE // 系統パッシブ
                      </span>
                    )}
                  </div>
                </div>

                {/* Description */}
                <div className="mb-5">
                  <SectionLabel>Tactical Spec // 性能仕様</SectionLabel>
                  <p className="text-xs text-hud-text leading-relaxed bg-hud-tile p-3 border-l-2" style={{ borderColor: selectedTheme.color }}>
                    {selectedNode.description}
                  </p>
                </div>

                {/* Effects */}
                <div className="mb-5">
                  <SectionLabel icon={<Sparkles className="w-3 h-3 text-hud-accent" />}>Effects // 適用効果</SectionLabel>
                  <div className="space-y-1">
                    {selectedNode.effects.map((eff, i) => {
                      const selLevel = getNodeLevel(selectedNode, nodeLevels);
                      const shown = selLevel > 0 ? scaledEffectValue(eff.value, selLevel, selectedNode) : eff.value;
                      return (
                        <div
                          key={i}
                          className="flex items-center justify-between bg-hud-tile px-3 py-2 border border-hud-line text-xs"
                        >
                          <span className="text-hud-text">{eff.label}</span>
                          <span className="font-cyber font-bold tabular-nums" style={{ color: selectedTheme.color }}>
                            {eff.stat === 'unlockWeapon' ? '' : formatEffectValue(shown)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* ノード強化 (Lv1 -> Lv10) */}
                {selectedNode.unlocked && isNodeUpgradable(selectedNode) && (() => {
                  const lv = getNodeLevel(selectedNode, nodeLevels);
                  const maxLv = maxNodeLevel(selectedNode);
                  const maxed = lv >= maxLv;
                  const cap = nodeLevelCap(selectedNode, levelBreaks);
                  const brk = nodeBreakCost(selectedNode, lv, levelBreaks);
                  const one = nodeUpgradeBulkCost(selectedNode, lv, 1, cap);
                  const multi = nodeUpgradeBulkCost(selectedNode, lv, maxLv > 30 ? 10 : 5, cap);
                  const canAfford = (b: { cost: number; beacons: number }) => userScrap >= b.cost && userBeacons >= b.beacons;
                  const costLabel = (b: { cost: number; beacons: number }) =>
                    b.beacons > 0 ? `${b.cost} SCRAP + ${b.beacons} BEACON` : `${b.cost} SCRAP`;
                  const buy = (b: { count: number; cost: number; beacons: number }) => {
                    if (b.count <= 0 || !canAfford(b)) {
                      sound.playDefeat();
                      return;
                    }
                    sound.playUpgradeSuccess();
                    onUpgradeNode?.(selectedNode.id, b.count, b.cost, b.beacons);
                  };
                  return (
                    <div className="mb-5 bg-hud-tile p-3.5 border border-hud-accent/25">
                      <div className="flex items-center justify-between mb-2.5">
                        <div className="flex items-center gap-1.5 text-[11px] font-cyber tracking-wider font-bold text-hud-accent">
                          <Sparkles className="w-3.5 h-3.5 text-hud-warn" />
                          NODE LEVEL // ノード強化
                        </div>
                        <div className="text-xs font-cyber font-bold text-hud-warn tabular-nums">
                          Lv.{lv}<span className="text-hud-dim">/{maxLv}</span>
                        </div>
                      </div>
                      <div className="flex gap-0.5 mb-3">
                        {Array.from({ length: Math.min(maxLv, 20) }, (_, i) => (
                          <div
                            key={i}
                            className={`flex-1 h-1.5 -skew-x-12 ${i < Math.ceil((lv * Math.min(maxLv, 20)) / maxLv) ? 'bg-gradient-to-r from-hud-accent to-hud-accent-2 shadow-[var(--hud-glow)]' : 'bg-hud-line'}`}
                          />
                        ))}
                      </div>
                      <div className="space-y-1 mb-3">
                        {selectedNode.effects.filter((e) => e.stat !== 'unlockWeapon').map((e, i) => (
                          <div key={i} className="flex items-center justify-between text-[11px] font-mono">
                            <span className="text-hud-muted">{e.label.replace(/[+\-]?\d.*$/, '').trim() || e.stat}</span>
                            <span>
                              <span className="text-hud-accent font-bold">{formatEffectValue(scaledEffectValue(e.value, lv, selectedNode))}</span>
                              {!maxed && (
                                <span className="text-hud-ok font-bold"> → {formatEffectValue(scaledEffectValue(e.value, lv + 1, selectedNode))}</span>
                              )}
                            </span>
                          </div>
                        ))}
                      </div>
                      {maxed ? (
                        <div className="py-2 px-3 bg-hud-warn/10 text-hud-warn border border-hud-warn/40 text-center font-cyber font-bold text-xs tracking-wider">
                          MAX LEVEL // 最大強化完了
                        </div>
                      ) : brk ? (
                        <BreakButton
                          label={`LIMIT BREAK // 限界突破 (Lv.${lv} → 上限Lv.${cap + 10})`}
                          cost={brk.cost}
                          beacons={brk.beacons}
                          scrap={userScrap}
                          have={userBeacons}
                          onBreak={() => onBreakLimit?.(selectedNode.id)}
                        />
                      ) : (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => buy(one)}
                            disabled={!canAfford(one)}
                            className={`flex-1 py-2 px-3 text-xs font-cyber font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                              canAfford(one)
                                ? 'bg-hud-accent hover:brightness-110 text-hud-on-accent shadow-[var(--hud-glow)] active:scale-[0.98]'
                                : 'bg-hud-line text-hud-dim border border-hud-line-strong cursor-not-allowed'
                            }`}
                            style={{ clipPath: cutCorners(8) }}
                          >
                            <Zap className="w-3.5 h-3.5 fill-current" />
                            +1 LV [{costLabel(one)}]
                          </button>
                          {multi.count > 1 && (
                            <button
                              onClick={() => buy(multi)}
                              disabled={!canAfford(multi)}
                              className={`py-2 px-2.5 text-xs font-cyber font-bold transition-all cursor-pointer ${
                                canAfford(multi)
                                  ? 'bg-hud-warn hover:bg-hud-warn text-hud-on-accent active:scale-[0.98]'
                                  : 'bg-hud-line text-hud-dim border border-hud-line-strong cursor-not-allowed'
                              }`}
                              style={{ clipPath: cutCorners(8) }}
                            >
                              +{multi.count} LV [{multi.cost} S{multi.beacons > 0 ? ` + ${multi.beacons} B` : ''}]
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Weapon Unlock Preview & Damage Upgrade Matrix (Level 1-100) */}
                {unlockedWeaponTarget && (() => {
                  const isUnlockedNode = selectedNode.unlocked;
                  const currentLevel = weaponDamageLevels[unlockedWeaponTarget.id] || 0;
                  const currentBoostedDmg = Math.round(unlockedWeaponTarget.stats.damage * (1 + currentLevel * 0.03));
                  const nextBoostedDmg = Math.round(unlockedWeaponTarget.stats.damage * (1 + (currentLevel + 1) * 0.03));
                  const singleUpgradeCost = weaponUpgradeCost(currentLevel);
                  const wKey = weaponBreakKey(unlockedWeaponTarget.id);
                  const wBreaks = levelBreaks[wKey] || 0;
                  const wCap = weaponLevelCap(wBreaks);
                  const wBrk = weaponBreakCost(currentLevel, wBreaks);

                  const multiCount = Math.min(5, wCap - currentLevel);
                  let multiUpgradeCost = 0;
                  for (let i = 0; i < multiCount; i++) {
                    multiUpgradeCost += weaponUpgradeCost(currentLevel + i);
                  }

                  return (
                    <div className="mb-5 space-y-3">
                      <div className="bg-hud-ok/5 p-3 border border-hud-ok/30">
                        <div className="text-[10px] text-hud-ok font-cyber tracking-wider font-bold mb-1 flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <KeyRound className="w-3.5 h-3.5" />
                            WEAPON ARSENAL // 解放対象兵装
                          </span>
                          {currentLevel > 0 && (
                            <span className="font-mono text-[10px] bg-hud-ok text-hud-on-accent px-2 py-0.5 font-bold">Lv. {currentLevel}</span>
                          )}
                        </div>
                        <div className="text-sm font-bold text-hud-text font-cyber">{unlockedWeaponTarget.name}</div>
                        <div className="mt-1.5 text-[11px] text-hud-muted grid grid-cols-2 gap-x-3 gap-y-1 font-mono">
                          <div>
                            威力:{' '}
                            <span className="text-hud-ok font-bold">
                              {currentBoostedDmg}
                              {currentLevel > 0 && ` (+${currentLevel * 3}%)`}
                            </span>
                          </div>
                          <div>
                            装弾:{' '}
                            <span className="text-hud-ok font-bold">
                              {unlockedWeaponTarget.stats.maxAmmo === Infinity ? '∞' : unlockedWeaponTarget.stats.maxAmmo}
                            </span>
                          </div>
                          <div>種別: <span className="text-hud-accent-2 font-bold">{unlockedWeaponTarget.category}</span></div>
                          <div>射程: <span className="text-hud-accent-2 font-bold">{unlockedWeaponTarget.stats.range}m</span></div>
                        </div>
                      </div>

                      {/* 解放済み武器ノード選択時：武器ダメージ強化 (Lv.300まで可能 (100以降は限界突破が必要)) */}
                      {isUnlockedNode && (
                        <div className="bg-hud-tile p-3.5 border border-hud-accent/25">
                          <div className="flex items-center justify-between mb-2.5">
                            <div className="flex items-center gap-1.5 text-[11px] font-cyber tracking-wider font-bold text-hud-accent">
                              <Sparkles className="w-3.5 h-3.5 text-hud-warn" />
                              DAMAGE MATRIX // 兵装ダメージ強化
                            </div>
                            <div className="text-xs font-cyber font-bold text-hud-warn tabular-nums">
                              Lv.{currentLevel}<span className="text-hud-dim">/{WEAPON_MAX_LEVEL}</span>
                            </div>
                          </div>

                          <div className="w-full h-1.5 bg-hud-line overflow-hidden mb-3">
                            <div
                              className="h-full bg-gradient-to-r from-hud-accent via-hud-accent-2 to-hud-warn transition-all duration-300"
                              style={{ width: `${(currentLevel / WEAPON_MAX_LEVEL) * 100}%` }}
                            />
                          </div>

                          <div className="bg-hud-panel p-2.5 border border-hud-line mb-3 grid grid-cols-2 gap-2 text-xs font-mono">
                            <div>
                              <div className="text-[10px] text-hud-dim font-cyber">現在威力 (Lv.{currentLevel})</div>
                              <div className="text-base font-bold text-hud-accent tabular-nums">
                                {currentBoostedDmg} <span className="text-[10px] text-hud-dim font-normal">(+{currentLevel * 3}%)</span>
                              </div>
                            </div>
                            <div>
                              <div className="text-[10px] text-hud-dim font-cyber">次Lv威力 (Lv.{Math.min(WEAPON_MAX_LEVEL, currentLevel + 1)})</div>
                              <div className="text-base font-bold text-hud-ok tabular-nums">
                                {currentLevel < WEAPON_MAX_LEVEL ? `${nextBoostedDmg} (+${(currentLevel + 1) * 3}%)` : 'MAX LEVEL'}
                              </div>
                            </div>
                          </div>

                          {wBrk ? (
                            <BreakButton
                              label={`LIMIT BREAK // 限界突破 (Lv.${currentLevel} → 上限Lv.${wCap + 50})`}
                              cost={wBrk.cost}
                              beacons={wBrk.beacons}
                              scrap={userScrap}
                              have={userBeacons}
                              onBreak={() => onBreakLimit?.(wKey)}
                            />
                          ) : currentLevel < WEAPON_MAX_LEVEL ? (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => {
                                  if (userScrap < singleUpgradeCost) {
                                    sound.playDefeat();
                                    return;
                                  }
                                  sound.playUpgradeSuccess();
                                  onUpgradeWeaponDamage?.(unlockedWeaponTarget.id, 1, singleUpgradeCost);
                                }}
                                disabled={userScrap < singleUpgradeCost}
                                className={`flex-1 py-2 px-3 text-xs font-cyber font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                                  userScrap >= singleUpgradeCost
                                    ? 'bg-hud-accent hover:brightness-110 text-hud-on-accent shadow-[var(--hud-glow)] active:scale-[0.98]'
                                    : 'bg-hud-line text-hud-dim border border-hud-line-strong cursor-not-allowed'
                                }`}
                                style={{ clipPath: cutCorners(8) }}
                              >
                                <Zap className="w-3.5 h-3.5 fill-current" />
                                <span>+1 LV [{singleUpgradeCost} SCRAP]</span>
                              </button>

                              {multiCount > 1 && (
                                <button
                                  onClick={() => {
                                    if (userScrap < multiUpgradeCost) {
                                      sound.playDefeat();
                                      return;
                                    }
                                    sound.playUpgradeSuccess();
                                    onUpgradeWeaponDamage?.(unlockedWeaponTarget.id, multiCount, multiUpgradeCost);
                                  }}
                                  disabled={userScrap < multiUpgradeCost}
                                  className={`py-2 px-2.5 text-xs font-cyber font-bold transition-all cursor-pointer ${
                                    userScrap >= multiUpgradeCost
                                      ? 'bg-hud-warn hover:bg-hud-warn text-hud-on-accent active:scale-[0.98]'
                                      : 'bg-hud-line text-hud-dim border border-hud-line-strong cursor-not-allowed'
                                  }`}
                                  style={{ clipPath: cutCorners(8) }}
                                  title={`+${multiCount}レベル一括強化`}
                                >
                                  +{multiCount} LV [{multiUpgradeCost} S]
                                </button>
                              )}
                            </div>
                          ) : (
                            <div className="py-2 px-3 bg-hud-warn/10 text-hud-warn border border-hud-warn/40 text-center font-cyber font-bold text-xs flex items-center justify-center gap-2">
                              <Sparkles className="w-4 h-4" />
                              MAX LEVEL // 最大強化完了 (LV. {WEAPON_MAX_LEVEL}/{WEAPON_MAX_LEVEL})
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Weapon Specific Target Preview */}
                {specificWeaponTarget && (
                  <div className="mb-5 bg-hud-warn/5 p-3 border border-hud-warn/30">
                    <div className="text-[10px] text-hud-warn font-cyber tracking-wider font-bold mb-1">TARGET WEAPON // 強化対象兵装</div>
                    <div className="text-sm font-bold text-hud-text font-cyber">{specificWeaponTarget.name}</div>
                    <div className="text-[11px] text-hud-muted mt-1">※ この強化は該当武器を装備しているときにのみ反映されます。</div>
                  </div>
                )}

                {/* Prerequisites */}
                <div>
                  <SectionLabel>Prerequisites // 前提条件</SectionLabel>
                  {selectedNode.prerequisites.length === 0 ? (
                    <div className="text-xs text-hud-dim italic">なし（起点中枢）</div>
                  ) : (
                    <div className="space-y-1">
                      {selectedNode.prerequisites.map((reqId) => {
                        const reqNode = nodes.find((n) => n.id === reqId);
                        const isMet = reqNode?.unlocked;
                        return (
                          <button
                            key={reqId}
                            onClick={() => reqNode && setSelectedNodeId(reqNode.id)}
                            className="w-full flex items-center gap-2 text-xs bg-hud-tile px-2.5 py-1.5 border border-hud-line hover:border-hud-line-strong transition-colors cursor-pointer text-left"
                          >
                            {isMet ? <Check className="w-3.5 h-3.5 text-hud-ok" /> : <Lock className="w-3.5 h-3.5 text-hud-dim" />}
                            <span className={isMet ? 'text-hud-text' : 'text-hud-dim'}>{reqNode?.name || reqId}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom Action Footer */}
              <div className="p-5 pt-4 border-t border-hud-line bg-hud-panel">
                <div className="flex items-center justify-between mb-3 text-xs font-cyber">
                  <span className="text-hud-dim tracking-[0.2em] text-[10px]">UNLOCK COST</span>
                  <div className="flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-hud-accent" />
                    <span className="text-lg font-bold text-hud-text tabular-nums">{selectedNode.cost.toLocaleString()}</span>
                    <span className="text-[10px] text-hud-dim">SCRAP</span>
                  </div>
                </div>

                {selectedNode.unlocked ? (
                  <button
                    disabled
                    className="w-full py-3 font-cyber font-bold text-xs tracking-[0.2em] flex items-center justify-center gap-2 cursor-not-allowed border"
                    style={{ color: selectedTheme.color, borderColor: `${selectedTheme.color}55`, background: selectedTheme.fill, clipPath: cutCorners(12) }}
                  >
                    <Check className="w-4 h-4" />
                    ACQUIRED // 獲得済み
                  </button>
                ) : selectedAvailable ? (
                  userScrap >= selectedNode.cost ? (
                    <button
                      onClick={() => handleUnlock(selectedNode)}
                      className="group relative w-full py-3 bg-gradient-to-r from-hud-accent to-hud-accent-2 hover:from-hud-accent hover:to-hud-accent-2 text-hud-on-accent font-cyber font-black text-xs tracking-[0.2em] flex items-center justify-center gap-2 transition-all cursor-pointer shadow-[var(--hud-glow)] active:scale-[0.98]"
                      style={{ clipPath: cutCorners(12) }}
                    >
                      <Zap className="w-4 h-4 fill-current" />
                      UNLOCK // 解放する [−{selectedNode.cost}]
                    </button>
                  ) : (
                    <button
                      disabled
                      className="w-full py-3 bg-hud-tile text-hud-dim border border-hud-line font-cyber font-bold text-xs flex items-center justify-center gap-2 cursor-not-allowed"
                      style={{ clipPath: cutCorners(12) }}
                    >
                      <AlertCircle className="w-4 h-4 text-hud-warn" />
                      SCRAP不足 (必要: {selectedNode.cost})
                    </button>
                  )
                ) : (
                  <button
                    disabled
                    className="w-full py-3 bg-hud-tile text-hud-dim border border-hud-line font-cyber font-bold text-xs flex items-center justify-center gap-2 cursor-not-allowed"
                    style={{ clipPath: cutCorners(12) }}
                  >
                    <Lock className="w-4 h-4" />
                    前提ノードの解放が必要
                  </button>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
