import React from 'react';
import { Weapon, WeaponSlot } from '../types';
import { getWeaponThumbnail } from '../utils/weaponThumbnails';
import { Shield, Heart, Crosshair, Play, LogOut, Lock, Skull, Cpu, Radio, Eye, Bomb, Zap } from 'lucide-react';

/**
 * Battle HUD (presentational only). All state lives in BattleScene3D; these components just draw it.
 * Style: dark tactical glass, angled cuts, segmented bars, accent colour taken from the active weapon.
 */

const cut = (s: number) => `polygon(${s}px 0, 100% 0, 100% calc(100% - ${s}px), calc(100% - ${s}px) 100%, 0 100%, 0 ${s}px)`;
const cutR = (s: number) => `polygon(0 0, calc(100% - ${s}px) 0, 100% ${s}px, 100% 100%, ${s}px 100%, 0 calc(100% - ${s}px))`;

const Glass: React.FC<{ className?: string; style?: React.CSSProperties; cutSize?: number; mirror?: boolean; children: React.ReactNode }> = ({
  className = '',
  style,
  cutSize = 14,
  mirror,
  children,
}) => (
  <div className={`bh-glass ${className}`} style={{ clipPath: mirror ? cutR(cutSize) : cut(cutSize), ...style }}>
    {children}
  </div>
);

// ───────────────────────── TOP BAR ─────────────────────────
export const HudTopBar: React.FC<{
  code: string;
  name: string;
  wave: number;
  totalWaves: number;
  hostiles: number;
  kills: number;
  scrap: number;
  announcement: string;
}> = ({ code, name, wave, totalWaves, hostiles, kills, scrap, announcement }) => (
  <div className="absolute top-3 left-1/2 -translate-x-1/2 pointer-events-none flex flex-col items-center gap-2 z-10">
    <div className="flex items-stretch">
      {/* mission */}
      <Glass className="flex items-center gap-2.5 pl-4 pr-5 py-2" cutSize={12}>
        <span className="relative flex w-2 h-2">
          <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-60" />
          <span className="relative w-2 h-2 rounded-full bg-emerald-400" />
        </span>
        <span className="text-[11px] font-cyber font-black tracking-[0.2em] text-cyan-300">{code}</span>
        <span className="text-xs font-gothic font-bold text-white/90 tracking-wider">{name}</span>
      </Glass>
      {/* wave */}
      <div className="bh-wave -mx-1 z-10 flex flex-col items-center justify-center px-6">
        <span className="text-[9px] font-cyber tracking-[0.35em] text-cyan-100/80">WAVE</span>
        <span className="text-2xl leading-none font-cyber font-black text-white tabular-nums">
          {String(wave).padStart(2, '0')}
          <span className="text-xs text-cyan-200/70">/{String(totalWaves).padStart(2, '0')}</span>
        </span>
        <span className="flex gap-1 mt-1">
          {Array.from({ length: totalWaves }, (_, i) => (
            <i key={i} className={`block w-3 h-[3px] -skew-x-[30deg] ${i < wave - 1 ? 'bg-white' : i === wave - 1 ? 'bg-amber-300 animate-pulse' : 'bg-white/25'}`} />
          ))}
        </span>
      </div>
      {/* stats */}
      <Glass className="flex items-center gap-4 pl-5 pr-4 py-2" cutSize={12} mirror>
        <Stat icon={<Radio className="w-3.5 h-3.5" />} label="HOSTILE" value={hostiles} color="text-rose-300" />
        <Stat icon={<Skull className="w-3.5 h-3.5" />} label="KILLS" value={kills} color="text-cyan-300" />
        <Stat icon={<Cpu className="w-3.5 h-3.5" />} label="SCRAP" value={`+${scrap}`} color="text-emerald-300" />
      </Glass>
    </div>
    {announcement && (
      <div key={announcement} className="bh-announce relative px-6 py-1 text-[11px] font-cyber font-bold tracking-[0.18em] text-white whitespace-nowrap">
        {announcement}
      </div>
    )}
  </div>
);

const Stat: React.FC<{ icon: React.ReactNode; label: string; value: React.ReactNode; color: string }> = ({ icon, label, value, color }) => (
  <div className="flex items-center gap-1.5">
    <span className={color}>{icon}</span>
    <span className="flex flex-col leading-none">
      <span className="text-[8px] font-cyber tracking-[0.25em] text-white/50">{label}</span>
      <span className={`text-sm font-cyber font-black tabular-nums ${color}`}>{value}</span>
    </span>
  </div>
);

// ───────────────────────── VITALS ─────────────────────────
const SegBar: React.FC<{ pct: number; color: string; glow: string; segments: number; height?: number }> = ({ pct, color, glow, segments, height = 10 }) => {
  const p = Math.max(0, Math.min(1, pct)) * 100;
  return (
    <div className="relative w-full -skew-x-[20deg] overflow-hidden" style={{ height, background: 'rgba(255,255,255,0.08)' }}>
      {/* trailing "damage taken" ghost */}
      <div className="absolute inset-y-0 left-0 bg-white/45 bh-ghost" style={{ width: `${p}%` }} />
      <div className="absolute inset-y-0 left-0 transition-[width] duration-75" style={{ width: `${p}%`, background: color, boxShadow: `0 0 12px ${glow}` }} />
      {/* segment gaps */}
      <div
        className="absolute inset-0"
        style={{ background: `repeating-linear-gradient(90deg, transparent 0 calc(${100 / segments}% - 2px), rgba(4,8,16,0.85) calc(${100 / segments}% - 2px) ${100 / segments}%)` }}
      />
    </div>
  );
};

export const HudBossBar: React.FC<{ name: string; hp: number; maxHp: number; phase: number }> = ({ name, hp, maxHp, phase }) => {
  const pct = maxHp > 0 ? hp / maxHp : 0;
  const color = phase >= 3 ? 'linear-gradient(90deg,#be123c,#fb7185)' : phase === 2 ? 'linear-gradient(90deg,#d97706,#fbbf24)' : 'linear-gradient(90deg,#dc2626,#f87171)';
  return (
    <div className="absolute top-[88px] left-1/2 -translate-x-1/2 w-[min(640px,60vw)] pointer-events-none z-10">
      <div className="flex items-end justify-between mb-1 px-1">
        <span className="flex items-center gap-2 text-sm font-gothic font-bold tracking-[0.18em] text-rose-200 drop-shadow-[0_0_8px_rgba(244,63,94,0.7)]">
          <Skull className="w-4 h-4 text-rose-400" />
          {name}
        </span>
        <span className="text-[10px] font-cyber tracking-widest text-white/70 tabular-nums">
          PHASE {phase} // {Math.round(pct * 100)}%
        </span>
      </div>
      <SegBar pct={pct} color={color} glow="rgba(244,63,94,0.65)" segments={30} height={12} />
    </div>
  );
};

export const HudVitals: React.FC<{ hp: number; maxHp: number; shield: number; maxShield: number }> = ({ hp, maxHp, shield, maxShield }) => {
  const hpPct = maxHp > 0 ? hp / maxHp : 0;
  const low = hpPct <= 0.3;
  return (
    <div className="absolute bottom-5 left-5 w-[340px] pointer-events-none z-10">
      <Glass className="px-5 pt-3.5 pb-4" cutSize={18}>
        <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: low ? '#fb7185' : '#22d3ee' }} />
        <div className="flex items-end justify-between">
          <div className="flex items-center gap-2">
            <span className={`w-9 h-9 grid place-items-center ${low ? 'text-rose-300 animate-pulse' : 'text-cyan-300'}`} style={{ clipPath: 'polygon(25% 0,75% 0,100% 50%,75% 100%,25% 100%,0 50%)', background: low ? 'rgba(244,63,94,0.2)' : 'rgba(34,211,238,0.15)' }}>
              <Heart className="w-4 h-4" />
            </span>
            <div className="leading-none">
              <div className="text-[9px] font-cyber tracking-[0.3em] text-white/50">VITAL CORE</div>
              <div className={`text-[10px] font-cyber font-bold tracking-[0.2em] mt-1 ${low ? 'text-rose-300' : 'text-emerald-300'}`}>
                {low ? '⚠ CRITICAL' : 'SYSTEM NOMINAL'}
              </div>
            </div>
          </div>
          <div className="font-cyber font-black tabular-nums leading-none text-white">
            <span className={`text-4xl ${low ? 'text-rose-300' : ''}`}>{hp}</span>
            <span className="text-sm text-white/40">/{maxHp}</span>
          </div>
        </div>
        <div className="mt-2.5">
          <SegBar pct={hpPct} color={low ? 'linear-gradient(90deg,#e11d48,#fb7185)' : 'linear-gradient(90deg,#f43f5e,#fda4af)'} glow="rgba(244,63,94,0.6)" segments={20} height={12} />
        </div>
        <div className="mt-2.5 flex items-center gap-2.5">
          <Shield className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
          <div className="flex-1">
            <SegBar pct={maxShield > 0 ? shield / maxShield : 0} color="linear-gradient(90deg,#0ea5e9,#67e8f9)" glow="rgba(34,211,238,0.6)" segments={16} height={6} />
          </div>
          <span className="text-[11px] font-cyber font-bold tabular-nums text-cyan-200 w-14 text-right">
            {shield}<span className="text-white/40">/{maxShield}</span>
          </span>
        </div>
        <div className="mt-2 flex items-center gap-1.5 text-[9px] font-cyber tracking-[0.2em] text-white/45">
          <Zap className="w-3 h-3 text-amber-300" /> DASH / JUMP <span className="text-emerald-300 font-bold">UNRESTRICTED</span>
        </div>
      </Glass>
    </div>
  );
};

// ───────────────────────── WEAPON PANEL ─────────────────────────
export interface HudWeaponState {
  ammo: number;
  maxAmmo: number;
  isReloading: boolean;
  reloadDuration: number;
  reloadId: number;
  comboStep: number;
  comboTimerPct: number;
  isMeleeCooldown: boolean;
  meleeCooldownRemaining: number;
  meleeCooldownPct: number;
  meleeCooldownReason: 'finisher' | 'skill' | null;
  skillCooldownRemaining: number;
  skillCooldownPct: number;
  rechargePct: number;
  isRechargeable: boolean;
}

export const HudWeapon: React.FC<{
  weapon: Weapon;
  slot: number;
  hud: HudWeaponState;
  isAiming: boolean;
  isGuarding: boolean;
  maxCombo: number;
}> = ({ weapon, slot, hud, isAiming, isGuarding, maxCombo }) => {
  const accent = weapon.color;
  const [shortName, subName] = weapon.name.split('//').map((s) => s.trim());
  const thumb = getWeaponThumbnail(weapon);
  const isMelee = weapon.category === 'MELEE';
  const ammoPct = hud.maxAmmo > 0 ? hud.ammo / hud.maxAmmo : 0;
  const lowAmmo = !isMelee && !hud.isRechargeable && ammoPct <= 0.25;
  const pipCount = Math.min(hud.maxAmmo, 40);

  return (
    <Glass className="relative w-[360px] px-5 pt-3.5 pb-4" cutSize={18} mirror style={{ ['--acc' as string]: accent }}>
      <div className="absolute right-0 top-0 bottom-0 w-[3px]" style={{ background: accent, boxShadow: `0 0 12px ${accent}` }} />
      {/* header */}
      <div className="flex items-start gap-3">
        <div className="relative w-[92px] h-[54px] shrink-0 grid place-items-center" style={{ background: `radial-gradient(ellipse at center, ${accent}33, transparent 70%)` }}>
          {thumb ? <img src={thumb} alt="" className="max-w-full max-h-full object-contain drop-shadow-[0_0_6px_rgba(255,255,255,0.25)]" draggable={false} /> : <Crosshair className="w-6 h-6" style={{ color: accent }} />}
        </div>
        <div className="min-w-0 flex-1 text-right">
          <div className="flex items-center justify-end gap-1.5 text-[9px] font-cyber tracking-[0.3em] text-white/50">
            SLOT {slot} <span style={{ color: accent }}>◆</span> {weapon.category}
          </div>
          <div className="text-xl font-cyber font-black text-white leading-tight truncate" style={{ textShadow: `0 0 14px ${accent}88` }}>
            {shortName}
          </div>
          <div className="text-[10px] font-cyber tracking-[0.12em] text-white/50 truncate">{subName}</div>
        </div>
      </div>

      {/* body */}
      <div className="mt-3">
        {isMelee ? (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {Array.from({ length: maxCombo }, (_, i) => {
                  const on = !hud.isMeleeCooldown && i < hud.comboStep && hud.comboTimerPct > 0;
                  const fin = i === maxCombo - 1;
                  return (
                    <span
                      key={i}
                      className={`grid place-items-center w-7 h-7 rotate-45 border-2 transition-all duration-100 ${on ? 'scale-110' : ''}`}
                      style={{
                        borderColor: on ? (fin ? '#fb7185' : accent) : 'rgba(255,255,255,0.25)',
                        background: on ? (fin ? 'rgba(251,113,133,0.35)' : `${accent}55`) : 'transparent',
                        boxShadow: on ? `0 0 12px ${fin ? '#fb7185' : accent}` : 'none',
                      }}
                    >
                      <span className="-rotate-45 text-[10px] font-cyber font-black text-white">{fin ? '★' : i + 1}</span>
                    </span>
                  );
                })}
              </div>
              <div className="text-right leading-tight">
                {hud.isMeleeCooldown ? (
                  <>
                    <div className="text-[9px] font-cyber tracking-[0.25em] text-amber-300/80">{hud.meleeCooldownReason === 'skill' ? 'SKILL COOLDOWN' : 'FINISHER RECOVERY'}</div>
                    <div className="text-2xl font-cyber font-black tabular-nums text-amber-300">{hud.meleeCooldownRemaining.toFixed(2)}<span className="text-xs">s</span></div>
                  </>
                ) : (
                  <>
                    <div className="text-[9px] font-cyber tracking-[0.25em] text-white/50">{isGuarding ? 'GUARD STANCE' : 'COMBO'}</div>
                    <div className="text-2xl font-cyber font-black tabular-nums" style={{ color: hud.comboStep >= maxCombo && hud.comboTimerPct > 0 ? '#fb7185' : accent }}>
                      {hud.comboTimerPct > 0 ? hud.comboStep : 0}<span className="text-xs text-white/40">/{maxCombo}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
            <div className="mt-2.5 h-[3px] bg-white/10 overflow-hidden">
              <div
                className="h-full transition-[width] duration-75"
                style={{
                  width: `${(hud.isMeleeCooldown ? hud.meleeCooldownPct : hud.comboTimerPct) * 100}%`,
                  background: hud.isMeleeCooldown ? '#fbbf24' : accent,
                  boxShadow: `0 0 8px ${hud.isMeleeCooldown ? '#fbbf24' : accent}`,
                }}
              />
            </div>
            {/* 溜め技 (右クリック長押し + 左クリック) のクールダウン */}
            {(() => {
              const ready = hud.skillCooldownRemaining <= 0;
              const c = ready ? '#34d399' : '#fb923c';
              return (
                <div className="mt-2.5">
                  <div className="flex items-center justify-between text-[9px] font-cyber tracking-[0.25em]">
                    <span className="text-white/50">CHARGE SKILL <span className="text-white/30">// R-CLICK HOLD + L-CLICK</span></span>
                    <span className="font-black tabular-nums" style={{ color: c }}>
                      {ready ? 'READY' : `${hud.skillCooldownRemaining.toFixed(1)}s`}
                    </span>
                  </div>
                  <div className="mt-1 h-[3px] bg-white/10 overflow-hidden">
                    <div
                      className="h-full transition-[width] duration-75"
                      style={{ width: `${(ready ? 1 : 1 - hud.skillCooldownPct) * 100}%`, background: c, boxShadow: `0 0 8px ${c}` }}
                    />
                  </div>
                </div>
              );
            })()}
          </>
        ) : hud.isRechargeable ? (
          <>
            <div className="flex items-end justify-between">
              <div className="flex gap-1.5">
                {Array.from({ length: hud.maxAmmo }, (_, i) => (
                  <Bomb key={i} className={`w-5 h-5 ${i < hud.ammo ? 'text-amber-300' : 'text-white/20'}`} />
                ))}
              </div>
              <div className="font-cyber font-black tabular-nums text-white leading-none">
                <span className="text-4xl">{hud.ammo}</span>
                <span className="text-sm text-white/40">/{hud.maxAmmo}</span>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1 h-[3px] bg-white/10 overflow-hidden">
                <div className="h-full bg-amber-300" style={{ width: hud.ammo < hud.maxAmmo ? `${hud.rechargePct * 100}%` : '100%' }} />
              </div>
              <span className="text-[9px] font-cyber tracking-[0.2em] text-white/55">{hud.ammo < hud.maxAmmo ? `RECHARGE ${Math.round(hud.rechargePct * 100)}%` : 'FULL STOCK'}</span>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-end justify-between">
              <div className="flex items-center gap-2">
                {isAiming && (
                  <span className="flex items-center gap-1 px-2 py-0.5 text-[9px] font-cyber font-bold tracking-[0.2em] text-black" style={{ background: accent }}>
                    <Eye className="w-3 h-3" /> ADS
                  </span>
                )}
                {hud.isReloading && <span className="text-xs font-cyber font-bold tracking-[0.2em] text-amber-300 animate-pulse">RELOADING…</span>}
                {lowAmmo && !hud.isReloading && <span className="text-[10px] font-cyber font-bold tracking-[0.2em] text-rose-300 animate-pulse">LOW AMMO</span>}
              </div>
              <div className="font-cyber font-black tabular-nums leading-none">
                <span className={`text-5xl ${hud.isReloading ? 'text-white/30' : lowAmmo ? 'text-rose-300' : 'text-white'}`} style={{ textShadow: `0 0 18px ${accent}66` }}>
                  {hud.ammo}
                </span>
                <span className="text-base text-white/40">/{hud.maxAmmo}</span>
              </div>
            </div>
            {/* reload progress bar */}
            {hud.isReloading && hud.reloadDuration > 0 && (
              <div className="mt-2.5 flex items-center gap-2">
                <style>{`@keyframes hudReloadFill{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@keyframes hudReloadSweep{from{transform:translateX(-120%)}to{transform:translateX(420%)}}
@keyframes hudReloadIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}`}</style>
                <div className="relative flex-1 h-[8px] bg-white/10 overflow-hidden -skew-x-[20deg]" style={{ animation: 'hudReloadIn .18s ease-out', boxShadow: `inset 0 0 0 1px ${accent}33` }}>
                  <div
                    key={hud.reloadId}
                    className="absolute inset-0 origin-left"
                    style={{ background: `linear-gradient(90deg, ${accent}55, ${accent})`, boxShadow: `0 0 10px ${accent}`, animation: `hudReloadFill ${hud.reloadDuration}s cubic-bezier(.45,.05,.4,1) forwards` }}
                  />
                  <div
                    key={`s${hud.reloadId}`}
                    className="absolute inset-y-0 w-1/5"
                    style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,.75), transparent)', animation: `hudReloadSweep ${Math.max(0.35, hud.reloadDuration / 2)}s linear infinite` }}
                  />
                  {[0.25, 0.5, 0.75].map((m) => (
                    <span key={m} className="absolute inset-y-0 w-px bg-black/60" style={{ left: `${m * 100}%` }} />
                  ))}
                </div>
                <span className="text-[9px] font-cyber tracking-[0.2em] text-amber-300 tabular-nums w-10 text-right">{hud.reloadDuration.toFixed(1)}s</span>
              </div>
            )}
            {/* round pips (right = next round) */}
            <div className="mt-2.5 flex gap-[2px] justify-end">
              {Array.from({ length: pipCount }, (_, i) => {
                const filled = i >= pipCount - Math.round(ammoPct * pipCount);
                return <span key={i} className="h-2.5 flex-1 max-w-[7px] -skew-x-[20deg]" style={{ background: filled ? (lowAmmo ? '#fb7185' : accent) : 'rgba(255,255,255,0.12)' }} />;
              })}
            </div>
          </>
        )}
      </div>

      {/* controls hint */}
      <div className="mt-3 pt-2 border-t border-white/10 flex justify-end gap-3 text-[9px] font-cyber tracking-[0.15em] text-white/45">
        {isMelee ? (
          <>
            <Key k="L" t="3段攻撃(長押し可)" /> <Key k="R" t="防御" /> <Key k="R+L" t="技" />
          </>
        ) : weapon.modelType === 'dynamite' ? (
          <Key k="L" t="投擲" />
        ) : (
          <>
            <Key k="L" t="射撃" /> <Key k="R" t="ADS" /> <Key k="R" t="リロード" kb />
          </>
        )}
      </div>
    </Glass>
  );
};

const Key: React.FC<{ k: string; t: string; kb?: boolean }> = ({ k, t, kb }) => (
  <span className="flex items-center gap-1">
    <span className={`px-1 py-px border ${kb ? 'border-white/40 rounded-[2px]' : 'border-white/30 rounded-full'} text-white/80 font-bold`}>{k}</span>
    <span className="font-gothic tracking-wider">{t}</span>
  </span>
);

// ───────────────────────── SLOT BAR ─────────────────────────
export const HudSlots: React.FC<{
  slots: { slot: WeaponSlot; weapon?: Weapon }[];
  current: number;
  onSelect: (slot: WeaponSlot) => void;
}> = ({ slots, current, onSelect }) => (
  <div className="flex gap-1.5 pointer-events-auto">
    {slots.map(({ slot, weapon }) => {
      const isCur = current === slot;
      const thumb = weapon ? getWeaponThumbnail(weapon) : null;
      return (
        <button
          key={slot}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(slot);
          }}
          disabled={!weapon}
          className={`bh-glass relative w-[86px] h-[52px] flex flex-col items-center justify-center transition-all ${
            weapon ? 'cursor-pointer' : 'opacity-40 cursor-not-allowed'
          } ${isCur ? '-translate-y-1' : 'hover:-translate-y-0.5'}`}
          style={{
            clipPath: cut(9),
            boxShadow: isCur && weapon ? `inset 0 -2px 0 ${weapon.color}` : undefined,
            background: isCur && weapon ? `linear-gradient(180deg, rgba(8,14,26,0.75), ${weapon.color}40)` : undefined,
          }}
        >
          <span className={`absolute top-0.5 left-1.5 text-[9px] font-cyber font-black ${isCur ? 'text-white' : 'text-white/45'}`}>{slot}</span>
          {thumb ? (
            <img src={thumb} alt="" className={`h-8 object-contain ${isCur ? '' : 'opacity-60 grayscale-[40%]'}`} draggable={false} />
          ) : (
            <span className="text-[9px] font-cyber text-white/40">{weapon ? weapon.codeName.split('-')[0] : 'EMPTY'}</span>
          )}
          {weapon && <span className={`text-[8px] font-cyber tracking-wider truncate max-w-[80px] ${isCur ? 'text-white' : 'text-white/45'}`}>{weapon.name.split('//')[0].trim()}</span>}
        </button>
      );
    })}
  </div>
);

// ───────────────────────── HIP CROSSHAIR ─────────────────────────
export const HudCrosshair: React.FC<{ bloomed: boolean; hit: boolean; color: string; melee: boolean }> = ({ bloomed, hit, color, melee }) => {
  const gap = bloomed ? 14 : 7;
  const len = bloomed ? 9 : 7;
  const tick = (rot: number) => (
    <span
      key={rot}
      className="absolute left-1/2 top-1/2 transition-all duration-75"
      style={{
        width: 2,
        height: len,
        background: bloomed ? '#fbbf24' : '#fff',
        boxShadow: '0 0 3px rgba(0,0,0,0.9)',
        transform: `translate(-50%, -50%) rotate(${rot}deg) translateY(${-(gap + len / 2)}px)`,
      }}
    />
  );
  return (
    <div className="relative w-20 h-20">
      {melee ? (
        // INFIGHT: angled brackets marking the swing arc
        <svg viewBox="0 0 80 80" className="absolute inset-0" style={{ filter: 'drop-shadow(0 0 2px rgba(0,0,0,0.9))' }}>
          <path d="M22 30 L16 40 L22 50 M58 30 L64 40 L58 50" fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M34 22 A20 20 0 0 1 46 22" fill="none" stroke="#fff" strokeOpacity="0.6" strokeWidth="1.5" />
          <circle cx="40" cy="40" r="2.2" fill="#fff" />
        </svg>
      ) : (
        <>
          {[0, 90, 180, 270].map(tick)}
          <span className="absolute left-1/2 top-1/2 w-[5px] h-[5px] -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ background: color, boxShadow: `0 0 6px ${color}, 0 0 2px #000` }} />
          <svg viewBox="0 0 80 80" className="absolute inset-0 transition-transform duration-100" style={{ transform: `scale(${bloomed ? 1.25 : 1})`, opacity: 0.45 }}>
            <circle cx="40" cy="40" r="22" fill="none" stroke="#fff" strokeWidth="1" strokeDasharray="6 28.5" />
          </svg>
        </>
      )}
      {hit && (
        <svg viewBox="0 0 80 80" className="absolute inset-0 bh-hit">
          <g stroke="#fb7185" strokeWidth="3" strokeLinecap="round">
            <path d="M26 26 L33 33 M54 26 L47 33 M26 54 L33 47 M54 54 L47 47" />
          </g>
        </svg>
      )}
    </div>
  );
};

// ───────────────────────── OVERLAYS ─────────────────────────
export const HudLockOverlay: React.FC<{ onLock: () => void }> = ({ onLock }) => (
  <div
    className="absolute inset-0 z-40 flex items-center justify-center p-6 cursor-pointer bg-[radial-gradient(ellipse_at_center,rgba(4,10,22,0.55),rgba(2,5,12,0.88))] backdrop-blur-[3px]"
    onClick={(e) => {
      e.stopPropagation();
      onLock();
    }}
    onMouseDown={(e) => {
      e.stopPropagation();
      onLock();
    }}
  >
    <Glass className="w-full max-w-md px-8 py-7 text-center pointer-events-auto" cutSize={22}>
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-300 to-transparent" />
      <div className="mx-auto w-14 h-14 grid place-items-center text-cyan-300 border border-cyan-300/40 rotate-45 mb-5">
        <Lock className="w-6 h-6 -rotate-45" />
      </div>
      <div className="text-[10px] font-cyber tracking-[0.4em] text-cyan-300/80">NEURAL LINK STANDBY</div>
      <h3 className="mt-1 text-2xl font-cyber font-black text-white tracking-[0.12em]">CLICK TO ENGAGE</h3>
      <p className="mt-3 text-xs text-white/65 leading-relaxed">
        クリックでマウスを画面中央に固定して戦闘を開始します。
        <br />
        <span className="text-white/45">[ESC] でいつでも一時停止・解除</span>
      </p>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onLock();
        }}
        className="mt-6 w-full py-3.5 flex items-center justify-center gap-2 font-cyber font-black text-xs tracking-[0.25em] text-[#03121c] bg-cyan-300 hover:bg-white transition-colors cursor-pointer"
        style={{ clipPath: cut(10) }}
      >
        <Crosshair className="w-4 h-4" /> ENGAGE // 戦闘開始
      </button>
    </Glass>
  </div>
);

const CONTROLS: [string, string][] = [
  ['WASD', '移動'],
  ['SHIFT', 'ダッシュ(タップ) / スプリント(長押し)'],
  ['SHIFT + SPACE', 'ダッシュジャンプ'],
  ['SPACE', 'ジャンプ'],
  ['左クリック', '射撃(長押しで連射) / 3段攻撃(長押し可)'],
  ['右長押し', 'ADS / 武器ごとの防御'],
  ['右 + 左', 'INFIGHT 技'],
  ['1 / 2 / 3 / 4', '武器切り替え'],
  ['ESC', 'ポーズ'],
];

export const HudPauseMenu: React.FC<{ onResume: () => void; onExit: () => void }> = ({ onResume, onExit }) => (
  <div className="absolute inset-0 z-50 flex items-center justify-center p-6 bg-[rgba(2,5,12,0.72)] backdrop-blur-sm" onClick={(e) => e.stopPropagation()}>
    <Glass className="w-full max-w-lg px-8 py-7" cutSize={24}>
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-300 to-transparent" />
      <div className="text-[10px] font-cyber tracking-[0.4em] text-cyan-300/80">TACTICAL HOLD</div>
      <h3 className="mt-1 text-3xl font-cyber font-black text-white tracking-[0.12em]">
        PAUSED <span className="text-base font-gothic text-white/60 tracking-wider">// 作戦一時停止</span>
      </h3>
      <div className="mt-5 grid grid-cols-[auto_1fr] gap-x-5 gap-y-1.5 text-xs">
        {CONTROLS.map(([k, v]) => (
          <React.Fragment key={k}>
            <span className="font-cyber font-bold text-cyan-200 tracking-wider text-[11px]">{k}</span>
            <span className="text-white/75">{v}</span>
          </React.Fragment>
        ))}
      </div>
      <div className="mt-7 flex gap-3">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onResume();
          }}
          className="flex-1 py-3.5 flex items-center justify-center gap-2 font-cyber font-black text-xs tracking-[0.25em] text-[#03121c] bg-cyan-300 hover:bg-white transition-colors cursor-pointer"
          style={{ clipPath: cut(10) }}
        >
          <Play className="w-4 h-4 fill-current" /> RESUME
        </button>
        <button
          onClick={onExit}
          className="px-6 py-3.5 flex items-center justify-center gap-2 font-cyber font-bold text-xs tracking-[0.2em] text-rose-200 border border-rose-300/40 hover:bg-rose-500/20 transition-colors cursor-pointer"
          style={{ clipPath: cut(10) }}
        >
          <LogOut className="w-4 h-4" /> 撤退
        </button>
      </div>
    </Glass>
  </div>
);
