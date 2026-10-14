import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Weapon, WeaponSlot, SkillBranch } from '../types';
import { INITIAL_SKILL_NODES } from '../data/initialData';
import { HologramWeaponViewer, HologramWeaponViewerHandle } from './HologramWeaponViewer';
import { getWeaponThumbnail } from '../utils/weaponThumbnails';
import { sound } from '../utils/sound';
import {
  Crosshair,
  Zap,
  Check,
  Sparkles,
  ArrowLeftRight,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Plus,
  RefreshCw,
  ZoomIn,
  Orbit,
  Eye,
  EyeOff,
  Swords,
  RotateCcw,
} from 'lucide-react';

type WeaponBranch = SkillBranch;

const BRANCH_META: Record<WeaponBranch, { label: string; color: string }> = {
  INFIGHT: { label: 'INFIGHT', color: '#0284c7' },
  ASSAULT: { label: 'ASSAULT', color: '#059669' },
  GRENADE: { label: 'GRENADE', color: '#d97706' },
};
const BRANCH_ORDER: WeaponBranch[] = ['INFIGHT', 'ASSAULT', 'GRENADE'];

// Weapon -> branch, taken from the gadget tree node that unlocks it (single source of truth)
const BRANCH_BY_WEAPON_ID: Record<string, WeaponBranch> = {};
INITIAL_SKILL_NODES.forEach((n) => {
  if (n.unlocksWeaponId && (n.branch === 'INFIGHT' || n.branch === 'ASSAULT' || n.branch === 'GRENADE')) {
    BRANCH_BY_WEAPON_ID[n.unlocksWeaponId] = n.branch;
  }
});
const FALLBACK_BRANCH: Record<Weapon['category'], WeaponBranch> = {
  MELEE: 'INFIGHT',
  SUB: 'ASSAULT',
  MAIN: 'ASSAULT',
  HEAVY: 'GRENADE',
};
const getBranch = (w: Weapon): WeaponBranch => BRANCH_BY_WEAPON_ID[w.id] || FALLBACK_BRANCH[w.category];

type SortKey = 'DEFAULT' | 'DAMAGE' | 'FIRE_RATE' | 'NAME';
const SORT_LABELS: Record<SortKey, string> = {
  DEFAULT: '標準',
  DAMAGE: '攻撃力',
  FIRE_RATE: '連射速度',
  NAME: '名前',
};

const shortName = (w: Weapon) => w.name.split('//')[0].trim();

/** Small still render of the weapon's actual 3D model (shared with the big viewer). */
const WeaponThumb: React.FC<{ weapon: Weapon; className?: string }> = ({ weapon, className = '' }) => {
  const [failed, setFailed] = useState(false);
  const src = useMemo(() => getWeaponThumbnail(weapon), [weapon]);
  useEffect(() => setFailed(false), [src]);
  return (
    <div
      className={`shrink-0 rounded-lg overflow-hidden flex items-center justify-center ${className}`}
      style={{
        background: `radial-gradient(circle at 50% 55%, ${weapon.color}26 0%, ${weapon.color}0d 55%, var(--color-white) 100%)`,
        border: `1px solid ${weapon.color}44`,
      }}
    >
      {src && !failed ? (
        <img
          src={src}
          alt={weapon.name}
          draggable={false}
          onError={() => setFailed(true)}
          className="w-full h-full object-contain pointer-events-none"
        />
      ) : (
        <Swords className="w-1/2 h-1/2" style={{ color: weapon.color }} />
      )}
    </div>
  );
};

const effectiveDamage = (w: Weapon, levels: Record<string, number>) =>
  Math.round(w.stats.damage * (1 + (levels[w.id] || 0) * 0.03));

interface StatRowDef {
  key: string;
  label: string;
  value: (w: Weapon) => number; // Infinity => INF, NaN => none
  display: (w: Weapon) => string;
  bar: (w: Weapon) => number; // 0-100
  lowerIsBetter?: boolean;
  unit?: string;
}

interface LoadoutScreenProps {
  weapons: Weapon[];
  activeLoadout: Record<WeaponSlot, string | null>;
  userScrap: number;
  weaponDamageLevels?: Record<string, number>;
  onEquipWeapon: (slot: WeaponSlot, weaponId: string | null) => void;
  onGoToSkillTree?: () => void;
}

export const LoadoutScreen: React.FC<LoadoutScreenProps> = ({
  weapons,
  activeLoadout,
  weaponDamageLevels = {},
  onEquipWeapon,
  onGoToSkillTree,
}) => {
  const unlockedWeapons = useMemo(() => weapons.filter((w) => w.unlocked), [weapons]);

  const [selectedSlot, setSelectedSlot] = useState<WeaponSlot>(1);
  const [selectedWeaponId, setSelectedWeaponId] = useState<string | null>(
    () => activeLoadout[1] || unlockedWeapons[0]?.id || null
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | WeaponBranch>('ALL');
  const [sortKey, setSortKey] = useState<SortKey>('DEFAULT');
  const [showCompare, setShowCompare] = useState(true);
  const viewerRef = useRef<HologramWeaponViewerHandle>(null);

  // Keep the selection valid if the inventory changes
  useEffect(() => {
    if (selectedWeaponId && !unlockedWeapons.some((w) => w.id === selectedWeaponId)) {
      setSelectedWeaponId(activeLoadout[selectedSlot] || unlockedWeapons[0]?.id || null);
    }
  }, [unlockedWeapons, selectedWeaponId, activeLoadout, selectedSlot]);

  const selectedWeapon =
    weapons.find((w) => w.id === selectedWeaponId) || unlockedWeapons[0] || weapons[0];
  const slotWeapon = weapons.find((w) => w.id === activeLoadout[selectedSlot]) || null;
  const equippedCount = Object.values(activeLoadout).filter(Boolean).length;

  const getSlotForWeapon = (weaponId: string): WeaponSlot | null => {
    for (const [slotStr, id] of Object.entries(activeLoadout)) {
      if (id === weaponId) return Number(slotStr) as WeaponSlot;
    }
    return null;
  };

  const filteredWeapons = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = unlockedWeapons.filter((w) => {
      const matchesCategory = categoryFilter === 'ALL' || getBranch(w) === categoryFilter;
      const matchesQuery = q === '' || w.name.toLowerCase().includes(q) || w.codeName.toLowerCase().includes(q);
      return matchesCategory && matchesQuery;
    });
    const sorted = [...list];
    if (sortKey === 'DAMAGE') sorted.sort((a, b) => b.stats.damage - a.stats.damage);
    else if (sortKey === 'FIRE_RATE') sorted.sort((a, b) => b.stats.fireRate - a.stats.fireRate);
    else if (sortKey === 'NAME') sorted.sort((a, b) => shortName(a).localeCompare(shortName(b)));
    return sorted;
  }, [unlockedWeapons, searchQuery, categoryFilter, sortKey]);

  const equippedWeaponsList = ([1, 2, 3, 4] as WeaponSlot[])
    .map((slot) => weapons.find((w) => w.id === activeLoadout[slot]))
    .filter((w): w is Weapon => !!w);

  const selectWeapon = (id: string) => {
    sound.playUiHover();
    setSelectedWeaponId(id);
  };

  const stepPreviewWeapon = (direction: 1 | -1) => {
    if (unlockedWeapons.length === 0) return;
    const idx = unlockedWeapons.findIndex((w) => w.id === selectedWeapon.id);
    const next = idx === -1 ? 0 : (idx + direction + unlockedWeapons.length) % unlockedWeapons.length;
    selectWeapon(unlockedWeapons[next].id);
  };

  const handleSelectSlot = (slot: WeaponSlot) => {
    sound.playUiClick();
    setSelectedSlot(slot);
    const w = activeLoadout[slot];
    if (w) setSelectedWeaponId(w);
  };

  const handleEquip = () => {
    if (!selectedWeapon?.unlocked) return;
    const currentSlotOfWeapon = getSlotForWeapon(selectedWeapon.id);
    if (currentSlotOfWeapon === selectedSlot) return;
    sound.playUpgradeSuccess();
    if (currentSlotOfWeapon !== null) {
      onEquipWeapon(currentSlotOfWeapon, activeLoadout[selectedSlot]);
    }
    onEquipWeapon(selectedSlot, selectedWeapon.id);
  };

  const statRows: StatRowDef[] = [
    {
      key: 'damage',
      label: '攻撃力 (DAMAGE)',
      value: (w) => effectiveDamage(w, weaponDamageLevels),
      display: (w) => String(effectiveDamage(w, weaponDamageLevels)),
      bar: (w) => Math.min(100, (effectiveDamage(w, weaponDamageLevels) / 400) * 100),
    },
    {
      key: 'rof',
      label: '連射速度 (FIRE RATE)',
      value: (w) => w.stats.fireRate,
      display: (w) => `${w.stats.fireRate}/s`,
      bar: (w) => Math.min(100, (w.stats.fireRate / 10) * 100),
    },
    {
      key: 'cap',
      label: '装弾数 (CAPACITY)',
      value: (w) => (w.stats.maxAmmo === Infinity ? Infinity : w.stats.maxAmmo),
      display: (w) => (w.stats.maxAmmo === Infinity ? 'INF' : String(w.stats.maxAmmo)),
      bar: (w) => (w.stats.maxAmmo === Infinity ? 100 : Math.min(100, (w.stats.maxAmmo / 40) * 100)),
    },
    {
      key: 'reload',
      label: 'リロード時間 (RELOAD)',
      value: (w) => (w.stats.maxAmmo === Infinity || w.stats.reloadTime === 0 ? NaN : w.stats.reloadTime),
      display: (w) => (w.stats.maxAmmo === Infinity || w.stats.reloadTime === 0 ? '—' : `${w.stats.reloadTime}s`),
      bar: (w) =>
        w.stats.maxAmmo === Infinity || w.stats.reloadTime === 0
          ? 0
          : Math.max(8, 100 - (w.stats.reloadTime / 4) * 100),
      lowerIsBetter: true,
    },
  ];

  const renderDiff = (row: StatRowDef) => {
    if (!slotWeapon || slotWeapon.id === selectedWeapon.id) return <span className="text-slate-300">—</span>;
    const a = row.value(slotWeapon);
    const b = row.value(selectedWeapon);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return <span className="text-slate-300">—</span>;
    const diff = b - a;
    if (Math.abs(diff) < 0.0001) return <span className="text-slate-300">—</span>;
    const good = row.lowerIsBetter ? diff < 0 : diff > 0;
    const text = Number.isInteger(diff) ? String(Math.abs(diff)) : Math.abs(diff).toFixed(1);
    return (
      <span className={`font-cyber text-[11px] font-bold ${good ? 'text-emerald-500' : 'text-rose-500'}`}>
        {diff > 0 ? '↑+' : '↓-'}
        {text}
      </span>
    );
  };

  const isEquippedHere = activeLoadout[selectedSlot] === selectedWeapon?.id;
  const selectedInOtherSlot = selectedWeapon ? getSlotForWeapon(selectedWeapon.id) : null;

  const panel = 'rounded-2xl border border-sky-100 bg-white/80 shadow-[0_4px_18px_-6px_rgba(14,116,184,0.18)] backdrop-blur-sm';

  return (
    <div className="relative w-full h-full flex flex-col gap-3 p-4 overflow-hidden"
      style={{ background: 'var(--hud-backdrop)' }}>
      {/* TOP: TITLE + 4 SLOTS */}
      <div className="flex items-stretch gap-4 shrink-0">
        <div className="shrink-0 w-[250px] flex flex-col justify-center">
          <div className="flex items-center gap-2">
            <span className="inline-block w-3 h-3 bg-sky-500 rotate-45 shrink-0" />
            <h2 className="text-lg font-bold font-cyber text-slate-800 leading-tight">
              WEAPON LOADOUT <span className="text-slate-400 font-normal">//</span> 武器編成
            </h2>
          </div>
          <p className="text-[11px] text-slate-500 mt-1 leading-snug">
            装備する武器を選択し、スロットにセットしてください。
          </p>
        </div>

        <div className="flex-1 grid grid-cols-4 gap-3 min-w-0">
          {([1, 2, 3, 4] as WeaponSlot[]).map((slot) => {
            const w = weapons.find((x) => x.id === activeLoadout[slot]);
            const isSelected = selectedSlot === slot;
            return (
              <button
                key={slot}
                onClick={() => handleSelectSlot(slot)}
                className={`relative text-left rounded-xl border px-2.5 py-2 transition-all cursor-pointer flex items-center gap-2.5 min-w-0 ${
                  isSelected
                    ? 'bg-white border-sky-400 shadow-[0_0_0_2px_rgba(56,189,248,0.25),0_6px_16px_-6px_rgba(14,116,184,0.35)]'
                    : w
                    ? 'bg-white/80 border-sky-100 hover:border-sky-300'
                    : 'bg-white/50 border-dashed border-slate-300 hover:border-sky-300'
                }`}
              >
                {w ? (
                  <WeaponThumb weapon={w} className="w-16 h-14" />
                ) : (
                  <div className="w-16 h-14 shrink-0 rounded-lg border border-dashed border-slate-300 bg-slate-100/60 flex items-center justify-center text-slate-300">
                    <Plus className="w-4 h-4" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <span
                      className={`font-cyber font-bold text-[10px] px-1.5 py-0.5 rounded-md ${
                        isSelected ? 'bg-sky-500 text-white' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      SLOT {slot}
                    </span>
                    <span className="text-[9px] font-mono text-slate-400 truncate">
                      {w ? BRANCH_META[getBranch(w)].label : 'EMPTY'}
                    </span>
                  </div>
                  <div className={`text-[13px] font-bold font-cyber truncate ${w ? 'text-slate-800' : 'text-slate-400'}`}>
                    {w ? shortName(w) : '空きスロット'}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono truncate">{w ? w.codeName : '未装備'}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* MAIN 3-COLUMN LAYOUT */}
      <div className="flex-1 grid grid-cols-[minmax(280px,28%)_minmax(0,1fr)_minmax(320px,33%)] gap-4 min-h-0">
        {/* LEFT: OWNED WEAPONS */}
        <div className={`${panel} p-3 flex flex-col gap-2.5 min-h-0`}>
          <div className="relative shrink-0">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="武器名で検索..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-sky-100 bg-white text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-sky-400 focus:border-sky-400"
            />
          </div>

          <div className="flex items-center gap-1.5 shrink-0 overflow-x-auto pb-0.5">
            {([
              { key: 'ALL', label: 'ALL' },
              ...BRANCH_ORDER.map((k) => ({ key: k, label: BRANCH_META[k].label })),
            ] as { key: 'ALL' | WeaponBranch; label: string }[]).map((tab) => {
              const active = categoryFilter === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => {
                    sound.playUiClick();
                    setCategoryFilter(tab.key);
                  }}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition-all cursor-pointer border ${
                    active
                      ? 'bg-sky-500 text-white border-sky-500 shadow-sm'
                      : 'bg-white text-slate-500 border-sky-100 hover:border-sky-300'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between shrink-0 text-[11px]">
            <span className="font-bold text-slate-700">
              所持武器一覧 <span className="text-slate-400 font-mono">// {unlockedWeapons.length}/{weapons.length}</span>
            </span>
            <label className="relative flex items-center gap-1 text-slate-500">
              <span>並び替え:</span>
              <span className="relative">
                <select
                  value={sortKey}
                  onChange={(e) => setSortKey(e.target.value as SortKey)}
                  className="appearance-none pl-2 pr-5 py-1 rounded-md border border-sky-100 bg-white text-[11px] text-slate-700 font-bold cursor-pointer focus:outline-none focus:ring-1 focus:ring-sky-400"
                >
                  {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
                    <option key={k} value={k}>
                      {SORT_LABELS[k]}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3 h-3 absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </span>
            </label>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-2 pr-1">
            {filteredWeapons.length === 0 ? (
              <div className="p-5 rounded-xl border border-dashed border-slate-300 bg-white text-center text-xs text-slate-500">
                {unlockedWeapons.length === 0 ? '所持している武器がありません' : '条件に一致する武器がありません'}
              </div>
            ) : (
              filteredWeapons.map((weapon) => {
                const slotOf = getSlotForWeapon(weapon.id);
                const inActive = slotOf === selectedSlot;
                const isSelected = selectedWeapon?.id === weapon.id;
                const meta = BRANCH_META[getBranch(weapon)];
                return (
                  <button
                    key={weapon.id}
                    onClick={() => selectWeapon(weapon.id)}
                    onDoubleClick={() => {
                      setSelectedWeaponId(weapon.id);
                      if (slotOf !== selectedSlot) {
                        sound.playUpgradeSuccess();
                        if (slotOf !== null) onEquipWeapon(slotOf, activeLoadout[selectedSlot]);
                        onEquipWeapon(selectedSlot, weapon.id);
                      }
                    }}
                    className={`text-left rounded-xl border p-2 flex gap-2.5 transition-all cursor-pointer shrink-0 ${
                      isSelected
                        ? 'bg-white border-sky-400 shadow-[0_0_0_2px_rgba(56,189,248,0.22)]'
                        : 'bg-white/90 border-sky-100 hover:border-sky-300'
                    }`}
                  >
                    <WeaponThumb weapon={weapon} className="w-[84px] h-[66px]" />
                    <div className="min-w-0 flex-1 flex flex-col justify-between">
                      <div className="flex items-start justify-between gap-1.5">
                        <div className="min-w-0">
                          <div className="text-[13px] font-bold font-cyber text-slate-800 truncate">
                            {shortName(weapon)}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono truncate">{weapon.codeName}</div>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span
                            className="px-1.5 py-px rounded text-[9px] font-bold border"
                            style={{ color: meta.color, borderColor: `${meta.color}55`, background: `${meta.color}0f` }}
                          >
                            {meta.label}
                          </span>
                          {slotOf !== null ? (
                            <span
                              className={`px-1.5 py-px rounded text-[9px] font-bold ${
                                inActive ? 'bg-sky-500 text-white' : 'bg-sky-50 text-sky-600 border border-sky-200'
                              }`}
                            >
                              {inActive ? '装備中' : `SLOT ${slotOf}`}
                            </span>
                          ) : (
                            <span className="px-1.5 py-px rounded text-[9px] font-bold bg-slate-100 text-slate-400">
                              未装備
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-slate-500 font-mono mt-1">
                        <span>
                          ATK <strong className="text-slate-800">{weapon.stats.damage}</strong>
                        </span>
                        <span>
                          ROF <strong className="text-slate-800">{weapon.stats.fireRate}/s</strong>
                        </span>
                        <span>
                          CAP{' '}
                          <strong className="text-slate-800">
                            {weapon.stats.maxAmmo === Infinity ? 'INF' : weapon.stats.maxAmmo}
                          </strong>
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })
            )}

            {weapons.some((w) => !w.unlocked) && onGoToSkillTree && (
              <div className="mt-1 p-2.5 rounded-xl bg-sky-50/80 border border-sky-200/80 flex items-center justify-between gap-2 shrink-0">
                <div className="text-[11px] text-slate-600">
                  <span className="font-bold text-sky-800 flex items-center gap-1">
                    <Zap className="w-3.5 h-3.5 text-sky-500" />
                    未解放の武器があります
                  </span>
                  <p className="text-[10px] text-slate-500 mt-0.5">ガジェットツリーで解放するとここに追加されます</p>
                </div>
                <button
                  onClick={onGoToSkillTree}
                  className="px-2.5 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-white text-[10px] font-bold shrink-0 cursor-pointer"
                >
                  ツリーへ
                </button>
              </div>
            )}
          </div>
        </div>

        {/* CENTER: 3D VIEW */}
        <div className="flex flex-col gap-2.5 min-h-0 min-w-0">
          <div className={`${panel} relative flex-1 min-h-0 overflow-hidden`}>
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_60%,rgba(125,211,252,0.22),rgba(255,255,255,0)_65%)]" />
            <div className="absolute inset-0">
              <HologramWeaponViewer ref={viewerRef} weapon={selectedWeapon} />
            </div>

            {/* 3D VIEW controls */}
            <div className="absolute top-3 left-3 rounded-xl border border-sky-100 bg-white/90 shadow-sm p-1.5 flex flex-col gap-0.5 text-[11px]">
              <div className="px-2 pt-0.5 pb-1 font-cyber text-[10px] font-bold text-sky-600 tracking-wider">3D VIEW</div>
              {[
                { icon: Orbit, label: '回転', title: '1ステップ回転（ドラッグでも回転できます）', fn: () => viewerRef.current?.rotateStep() },
                { icon: ZoomIn, label: 'ズーム', title: 'ズームイン（ホイールでも調整できます）', fn: () => viewerRef.current?.zoomIn() },
                { icon: RefreshCw, label: 'リセット', title: '視点をリセット', fn: () => viewerRef.current?.reset() },
              ].map(({ icon: Icon, label, title, fn }) => (
                <button
                  key={label}
                  title={title}
                  onClick={fn}
                  className="flex items-center gap-2 px-2 py-1 rounded-md text-slate-600 hover:bg-sky-50 hover:text-sky-700 transition-colors cursor-pointer"
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </button>
              ))}
            </div>

            {unlockedWeapons.length > 1 && (
              <>
                <button
                  onClick={() => stepPreviewWeapon(-1)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 border border-sky-100 shadow-sm flex items-center justify-center text-sky-500 hover:text-sky-700 hover:border-sky-300 cursor-pointer"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={() => stepPreviewWeapon(1)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 border border-sky-100 shadow-sm flex items-center justify-center text-sky-500 hover:text-sky-700 hover:border-sky-300 cursor-pointer"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </>
            )}

            {/* Equipped weapons quick strip */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2">
              {equippedWeaponsList.map((w) => (
                <button
                  key={w.id}
                  onClick={() => selectWeapon(w.id)}
                  title={shortName(w)}
                  className={`rounded-lg cursor-pointer transition-all ${
                    selectedWeapon?.id === w.id ? 'ring-2 ring-sky-400' : 'opacity-85 hover:opacity-100'
                  }`}
                >
                  <WeaponThumb weapon={w} className="w-[68px] h-12" />
                </button>
              ))}
              {onGoToSkillTree && (
                <button
                  onClick={onGoToSkillTree}
                  title="ガジェットツリーで新武器を解放"
                  className="w-12 h-12 shrink-0 rounded-lg border border-sky-200 bg-white/90 flex items-center justify-center text-sky-400 hover:text-sky-600 hover:border-sky-400 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Special action / lore */}
          <div className={`${panel} shrink-0 px-3.5 py-2.5`}>
            {selectedWeapon.category === 'MELEE' ? (
              <>
                <div className="flex items-center gap-1.5 font-cyber text-[11px] font-bold text-sky-600 tracking-wider">
                  <Sparkles className="w-3.5 h-3.5" />
                  SPECIAL ACTION
                </div>
                <div className="text-[13px] font-bold text-slate-800 mt-0.5">SWEEP ATTACK（薙ぎ払い斬撃）</div>
                <p className="text-[11px] text-slate-500 leading-relaxed mt-0.5">
                  ガード（右クリック長押し）中に左クリックで高速踏み込み＋扇状薙ぎ払いを発動。シアンの斬撃波が複数敵をノックバック。
                </p>
              </>
            ) : (
              <>
                <div className="flex items-center gap-1.5 font-cyber text-[11px] font-bold text-sky-600 tracking-wider">
                  <Crosshair className="w-3.5 h-3.5" />
                  WEAPON NOTE
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed mt-1 italic">“{selectedWeapon.lore}”</p>
              </>
            )}
          </div>
        </div>

        {/* RIGHT: INFO + COMPARISON */}
        <div className="flex flex-col gap-3 min-h-0 min-w-0">
          <div className={`${panel} p-4 shrink-0`}>
            <div
              className="text-[11px] font-bold flex items-center gap-1.5"
              style={{ color: BRANCH_META[getBranch(selectedWeapon)].color }}
            >
              <Crosshair className="w-3 h-3" />
              {BRANCH_META[getBranch(selectedWeapon)].label}
            </div>
            <h3 className="text-xl font-bold font-cyber text-slate-800 leading-tight mt-1">{shortName(selectedWeapon)}</h3>
            <div className="text-xs text-slate-400 font-mono">{selectedWeapon.codeName}</div>
            <p className="text-[11px] text-slate-600 leading-relaxed mt-2 line-clamp-3">{selectedWeapon.description}</p>
          </div>

          <div className={`${panel} p-4 flex-1 min-h-0 flex flex-col`}>
            <div className="flex items-center gap-2 text-sm font-bold text-slate-800 shrink-0">
              <span className="inline-block w-2.5 h-2.5 bg-sky-500 rotate-45" />
              性能比較
            </div>

            {/* Compare slot tabs */}
            <div className="flex items-center gap-2 mt-2.5 shrink-0">
              <span className="text-[10px] text-slate-500 shrink-0">比較対象スロット</span>
              <div className="flex gap-1 flex-1">
                {([1, 2, 3, 4] as WeaponSlot[]).map((slot) => (
                  <button
                    key={slot}
                    onClick={() => {
                      sound.playUiClick();
                      setSelectedSlot(slot);
                    }}
                    className={`flex-1 py-1 rounded-md text-[10px] font-cyber font-bold border cursor-pointer transition-colors ${
                      selectedSlot === slot
                        ? 'bg-sky-500 text-white border-sky-500'
                        : 'bg-white text-slate-500 border-sky-100 hover:border-sky-300'
                    }`}
                  >
                    SLOT {slot}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto mt-3 pr-0.5">
              {/* current vs selected headers */}
              <div className={`grid gap-2 ${showCompare ? 'grid-cols-2' : 'grid-cols-1'}`}>
                {showCompare && (
                  <div className="rounded-xl border border-sky-100 bg-sky-50/50 p-2 min-w-0">
                    <div className="text-[9px] text-slate-500 font-bold mb-1">現在の装備 (SLOT {selectedSlot})</div>
                    {slotWeapon ? (
                      <div className="flex items-center gap-2">
                        <WeaponThumb weapon={slotWeapon} className="w-11 h-9" />
                        <div className="min-w-0">
                          <div className="text-[11px] font-bold font-cyber text-slate-800 truncate">{shortName(slotWeapon)}</div>
                          <div className="text-[9px] text-slate-400 font-mono truncate">{slotWeapon.codeName}</div>
                        </div>
                      </div>
                    ) : (
                      <div className="h-9 flex items-center text-[11px] text-slate-400">未装備</div>
                    )}
                  </div>
                )}
                <div className="rounded-xl border border-sky-200 bg-white p-2 min-w-0">
                  <div className="text-[9px] text-sky-600 font-bold mb-1">選択中の武器</div>
                  <div className="flex items-center gap-2">
                    <WeaponThumb weapon={selectedWeapon} className="w-11 h-9" />
                    <div className="min-w-0">
                      <div className="text-[11px] font-bold font-cyber text-slate-800 truncate">{shortName(selectedWeapon)}</div>
                      <div className="text-[9px] text-slate-400 font-mono truncate">{selectedWeapon.codeName}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* stat rows */}
              <div className="mt-3 flex flex-col gap-2.5">
                {statRows.map((row) => (
                  <div key={row.key} className={`grid gap-2 items-end ${showCompare ? 'grid-cols-2' : 'grid-cols-1'}`}>
                    {showCompare && (
                      <div className="min-w-0">
                        <div className="flex items-baseline justify-between gap-1">
                          <span className="text-[10px] text-slate-500 truncate">{row.label}</span>
                          <span className="font-cyber font-bold text-sm text-slate-800">
                            {slotWeapon ? row.display(slotWeapon) : '—'}
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-sky-100 overflow-hidden mt-1">
                          <div
                            className="h-full bg-sky-500 rounded-full transition-all duration-300"
                            style={{ width: `${slotWeapon ? row.bar(slotWeapon) : 0}%` }}
                          />
                        </div>
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-baseline justify-between gap-1">
                        <span className="text-[10px] text-slate-500 truncate">{showCompare ? '' : row.label}</span>
                        <span className="flex items-baseline gap-1.5">
                          <span className="font-cyber font-bold text-sm text-slate-800">{row.display(selectedWeapon)}</span>
                          {showCompare && renderDiff(row)}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-sky-100 overflow-hidden mt-1">
                        <div
                          className="h-full bg-sky-400 rounded-full transition-all duration-300"
                          style={{ width: `${row.bar(selectedWeapon)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}

                <div className="grid grid-cols-2 gap-2 mt-0.5">
                  <div className="rounded-lg bg-sky-50/60 border border-sky-100 px-2.5 py-1.5">
                    <div className="text-[9px] text-slate-500">有効射程</div>
                    <div className="font-cyber font-bold text-sm text-slate-800">{selectedWeapon.stats.range}m</div>
                  </div>
                  <div className="rounded-lg bg-sky-50/60 border border-sky-100 px-2.5 py-1.5">
                    <div className="text-[9px] text-slate-500">命中精度</div>
                    <div className="font-cyber font-bold text-sm text-slate-800">{selectedWeapon.stats.accuracy}%</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="shrink-0 pt-3 mt-2 border-t border-sky-100 flex items-center gap-2">
              <button
                onClick={() => {
                  sound.playUiClick();
                  setShowCompare((v) => !v);
                }}
                className="shrink-0 px-3 py-2.5 rounded-xl border border-sky-200 bg-white text-[11px] font-bold text-slate-600 hover:border-sky-400 hover:text-sky-700 flex items-center gap-1.5 cursor-pointer"
              >
                {showCompare ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                {showCompare ? '比較を閉じる' : '比較を開く'}
              </button>
              <button
                onClick={handleEquip}
                disabled={isEquippedHere}
                className={`flex-1 py-2.5 px-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                  isEquippedHere
                    ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-default'
                    : 'bg-gradient-to-b from-sky-400 to-sky-500 hover:from-sky-300 hover:to-sky-500 text-white shadow-[0_6px_14px_-4px_rgba(14,165,233,0.55)] active:scale-[0.98] cursor-pointer'
                }`}
              >
                {isEquippedHere ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-500" />
                    SLOT {selectedSlot} に装備中
                  </>
                ) : selectedInOtherSlot !== null ? (
                  <>
                    <ArrowLeftRight className="w-4 h-4" />
                    SLOT {selectedSlot} と入替え
                  </>
                ) : (
                  <>
                    <Crosshair className="w-4 h-4" />
                    装備する
                  </>
                )}
              </button>
            </div>
            {slotWeapon && equippedCount > 1 && (
              <button
                onClick={() => {
                  sound.playUiClick();
                  onEquipWeapon(selectedSlot, null);
                }}
                className="mt-2 shrink-0 text-[10px] text-slate-400 hover:text-rose-500 flex items-center justify-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                SLOT {selectedSlot} の装備を外す
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
