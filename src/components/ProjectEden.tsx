import React, { useMemo } from 'react';
import { Mission } from '../types';
import { EDEN_INFO, effectiveScrapReward } from '../data/initialData';
import { getRecommendedWeaponLevel } from './BattleScene3D';
import { getEnemyThumbnail } from '../utils/enemyThumbnails';
import { sound } from '../utils/sound';
import { cutCorners } from '../theme';
import { ArrowLeft, CheckCircle2, ChevronsRight, Cpu, Crosshair, FileText, Gift, Hexagon, Lock, Play, ShieldAlert, Skull, Sparkles } from 'lucide-react';

/**
 * PROJECT EDEN — the post-game tower (outside the WORLD MAP). Ten floors of angel-only enemies; floor 10 holds the boss.
 * Always drawn in white and gold, whatever the HUD theme is.
 */

const GOLD = '#c8962a';
const GOLD_SOFT = '#f5c542';
const INK = '#3a2f1a';
const MUTED = '#7a6a48';
const PAPER = 'rgba(255,253,246,0.92)';
const LINE = 'rgba(200,150,42,0.35)';
const DANGER = '#c2410c';
const OK = '#15803d';

interface ProjectEdenProps {
  /** PROJECT EDEN の階層 (mapId 11) だけを渡す */
  missions: Mission[];
  selectedMission: Mission | null;
  onSelectMission: (m: Mission) => void;
  onStartMission: (m: Mission) => void;
  onBack: () => void;
}

const floorNo = (m: Mission) => m.code.replace('EDEN-', '').slice(0, 2);

export const ProjectEden: React.FC<ProjectEdenProps> = ({ missions, selectedMission, onSelectMission, onStartMission, onBack }) => {
  const selected =
    (selectedMission && missions.find((m) => m.id === selectedMission.id)) ||
    missions.find((m) => m.unlocked && !m.cleared) ||
    missions[0] ||
    null;
  const cleared = missions.filter((m) => m.cleared).length;

  const thumbs = useMemo(() => {
    const out: Record<string, string | null> = {};
    selected?.enemies.forEach((e) => {
      if (!(e.enemyTypeId in out)) out[e.enemyTypeId] = getEnemyThumbnail(e.enemyTypeId);
    });
    return out;
  }, [selected?.id]);

  const select = (m: Mission) => {
    sound.playUiClick();
    onSelectMission(m);
  };

  const colorOf = (m: Mission) => (!m.unlocked ? '#a89b80' : m.cleared ? OK : m.isBoss ? DANGER : GOLD);

  return (
    <div
      className="relative w-full h-full overflow-hidden flex"
      style={{ background: 'radial-gradient(ellipse at 40% 20%, #fffdf4 0%, #f3efe2 45%, #dfe8f6 100%)', color: INK }}
    >
      {/* drifting halo rings */}
      <svg className="pointer-events-none absolute inset-0 w-full h-full opacity-60" viewBox="0 0 1000 700" preserveAspectRatio="xMidYMid slice" aria-hidden>
        <g style={{ transformOrigin: '420px 260px', animation: 'edenSpin 90s linear infinite' }}>
          <circle cx="420" cy="260" r="330" fill="none" stroke={GOLD_SOFT} strokeWidth="1.2" strokeDasharray="3 9" />
          <circle cx="420" cy="260" r="250" fill="none" stroke={GOLD} strokeWidth="0.8" />
          {Array.from({ length: 24 }).map((_, i) => {
            const a = (i / 24) * Math.PI * 2;
            return <circle key={i} cx={420 + Math.cos(a) * 250} cy={260 + Math.sin(a) * 250} r="3.4" fill="#fff" stroke={GOLD} strokeWidth="1" />;
          })}
        </g>
        <g style={{ transformOrigin: '420px 260px', animation: 'edenSpin 140s linear infinite reverse' }}>
          <ellipse cx="420" cy="260" rx="400" ry="120" fill="none" stroke={GOLD_SOFT} strokeWidth="0.8" />
          <ellipse cx="420" cy="260" rx="120" ry="400" fill="none" stroke={GOLD_SOFT} strokeWidth="0.8" />
        </g>
      </svg>
      <style>{`@keyframes edenSpin { to { transform: rotate(360deg); } } @keyframes edenGlow { 0%,100% { box-shadow: 0 0 0 0 rgba(245,197,66,0.0);} 50% { box-shadow: 0 0 22px 2px rgba(245,197,66,0.55);} }`}</style>

      {/* ═════════ TOWER ═════════ */}
      <div className="relative flex-1 min-w-0 h-full flex flex-col px-8 py-6 overflow-y-auto">
        <button
          onClick={() => {
            sound.playUiClick();
            onBack();
          }}
          className="self-start flex items-center gap-2 px-4 py-2 text-[11px] font-cyber font-bold tracking-[0.2em] cursor-pointer transition-all hover:brightness-95"
          style={{ border: `1px solid ${LINE}`, background: PAPER, color: GOLD, clipPath: cutCorners(8) }}
        >
          <ArrowLeft className="w-4 h-4" />
          WORLD MAP <span className="font-gothic tracking-wider font-normal">へ戻る</span>
        </button>

        <div className="mt-5">
          <div className="flex items-center gap-2 text-[11px] font-cyber tracking-[0.3em]" style={{ color: GOLD }}>
            <Sparkles className="w-3.5 h-3.5" />
            POST-GAME TOWER <span style={{ color: MUTED }}>//</span> <span className="font-gothic tracking-[0.15em]">最上位コンテンツ</span>
          </div>
          <h2 className="mt-2 text-[52px] leading-none font-black font-cyber tracking-[0.1em]" style={{ color: INK, textShadow: `0 0 24px ${GOLD_SOFT}` }}>
            PROJECT <span style={{ color: GOLD }}>EDEN</span>
          </h2>
          <div className="mt-2 text-sm font-cyber font-bold tracking-[0.15em]" style={{ color: GOLD }}>
            {EDEN_INFO.subName.split('//')[0].trim()} <span className="font-gothic">// {EDEN_INFO.subName.split('//')[1]?.trim()}</span>
          </div>
          <p className="mt-2 max-w-[560px] text-xs leading-relaxed" style={{ color: MUTED }}>{EDEN_INFO.description}</p>
          <div className="mt-3 flex items-center gap-3">
            <div className="flex gap-1">
              {missions.map((m) => (
                <span key={m.id} className="w-6 h-1.5 -skew-x-12" style={{ background: m.cleared ? OK : m.unlocked ? GOLD : '#d8cdb4' }} />
              ))}
            </div>
            <span className="text-[10px] font-mono tabular-nums" style={{ color: MUTED }}>CLEARED {cleared}/{missions.length}</span>
            <span className="text-[10px] font-cyber font-bold tracking-[0.15em] px-2 py-0.5 border" style={{ color: DANGER, borderColor: DANGER }}>
              推奨武器 Lv300〜
            </span>
          </div>
        </div>

        {/* floors, top (10) to bottom (01) */}
        <div className="mt-6 flex flex-col gap-2 max-w-[640px] pb-6">
          {[...missions].reverse().map((m) => {
            const col = colorOf(m);
            const isSel = selected?.id === m.id;
            return (
              <button
                key={m.id}
                onClick={() => select(m)}
                className="group relative flex items-center gap-4 pl-4 pr-5 py-3 text-left cursor-pointer transition-all hover:-translate-y-px"
                style={{
                  clipPath: cutCorners(10),
                  background: isSel ? `linear-gradient(90deg, ${col}, ${col}d0)` : m.isBoss ? 'rgba(255,244,230,0.95)' : PAPER,
                  border: `1px solid ${isSel ? col : LINE}`,
                  color: isSel ? '#fff' : INK,
                  animation: m.isBoss && m.unlocked && !m.cleared && !isSel ? 'edenGlow 2.4s ease-in-out infinite' : undefined,
                  opacity: m.unlocked || isSel ? 1 : 0.7,
                }}
              >
                <span className="w-14 shrink-0 text-center leading-none">
                  <span className="block text-[9px] font-cyber tracking-[0.2em]" style={{ color: isSel ? 'rgba(255,255,255,0.8)' : MUTED }}>FLOOR</span>
                  <span className="block text-[30px] font-cyber font-black" style={{ color: isSel ? '#fff' : col }}>{floorNo(m)}</span>
                </span>
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block text-[10px] font-cyber tracking-[0.18em]" style={{ color: isSel ? 'rgba(255,255,255,0.85)' : MUTED }}>
                    {m.code}{m.isBoss && ' // BOSS'}
                  </span>
                  <span className="block text-[17px] font-black font-gothic tracking-wide truncate">{m.name}</span>
                  <span className="block text-[10px] font-cyber tracking-wider truncate" style={{ color: isSel ? 'rgba(255,255,255,0.8)' : MUTED }}>{m.areaName}</span>
                </span>
                <span className="shrink-0 text-right leading-tight">
                  <span className="block text-[9px] font-cyber tracking-wider" style={{ color: isSel ? 'rgba(255,255,255,0.8)' : MUTED }}>REC.</span>
                  <span className="block text-sm font-cyber font-black" style={{ color: isSel ? '#fff' : col }}>Lv {getRecommendedWeaponLevel(m, false)}</span>
                </span>
                <span className="shrink-0 w-6 grid place-items-center" style={{ color: isSel ? '#fff' : col }}>
                  {!m.unlocked ? <Lock className="w-4 h-4" /> : m.cleared ? <CheckCircle2 className="w-5 h-5" /> : m.isBoss ? <Skull className="w-5 h-5" /> : <Crosshair className="w-5 h-5" />}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ═════════ BRIEFING PANEL ═════════ */}
      <aside className="relative w-[400px] shrink-0 h-full flex flex-col gap-3 p-4 pl-0 z-20">
        {selected ? (
          <>
            <div className="flex-1 min-h-0 flex flex-col backdrop-blur-xl overflow-hidden" style={{ background: PAPER, border: `1px solid ${LINE}`, clipPath: cutCorners(16), boxShadow: '0 10px 30px rgba(120,90,20,0.12)' }}>
              <div className="h-[3px] shrink-0" style={{ background: `linear-gradient(90deg, ${colorOf(selected)}, transparent)` }} />
              <div className="flex-1 min-h-0 overflow-y-auto p-5 flex flex-col gap-4">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="px-3 py-1 text-sm font-cyber font-black tracking-[0.15em] text-white" style={{ background: colorOf(selected), clipPath: cutCorners(6) }}>
                      {selected.code}
                    </span>
                    <span
                      className="px-3 py-0.5 text-[11px] font-cyber font-bold tracking-[0.15em] rounded-full border"
                      style={{ color: colorOf(selected), borderColor: colorOf(selected) }}
                    >
                      {!selected.unlocked ? 'LOCKED' : selected.cleared ? 'CLEARED' : selected.isBoss ? 'BOSS' : 'ACTIVE'}
                    </span>
                  </div>
                  <h3 className="mt-3 text-[24px] leading-tight font-black font-gothic tracking-wide">{selected.name}</h3>
                  <div className="mt-1 text-[11px] font-cyber tracking-[0.15em]" style={{ color: MUTED }}>{selected.areaName}</div>
                  <div className="mt-3 h-px" style={{ background: `linear-gradient(90deg, ${colorOf(selected)} 0 40px, ${LINE} 40px)` }} />
                </div>

                <div className="flex items-center justify-between px-4 py-3 rounded-lg border" style={{ borderColor: LINE, background: 'rgba(245,197,66,0.08)' }}>
                  <div className="flex items-center gap-2 text-xs font-bold">
                    <ShieldAlert className="w-4 h-4" style={{ color: DANGER }} />
                    作戦脅威度 <span className="font-cyber text-[10px] tracking-wider" style={{ color: MUTED }}>(THREAT)</span>
                  </div>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((lvl) => (
                      <span key={lvl} className="w-4 h-3 rounded-full" style={{ background: lvl <= selected.threatLevel ? (selected.isBoss ? DANGER : GOLD) : '#e4dcc6' }} />
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between px-4 py-3 rounded-lg border" style={{ borderColor: LINE, background: 'rgba(245,197,66,0.08)' }}>
                  <div className="flex items-center gap-2 text-xs font-bold">
                    <Crosshair className="w-4 h-4" style={{ color: GOLD }} />
                    推奨武器レベル <span className="font-cyber text-[10px] tracking-wider" style={{ color: MUTED }}>(REC. WEAPON LV)</span>
                  </div>
                  <div className="font-cyber text-lg font-black" style={{ color: GOLD }}>Lv {getRecommendedWeaponLevel(selected, false)}</div>
                </div>

                <section>
                  <Head icon={<FileText className="w-4 h-4" />} jp="作戦概要" en="BRIEFING" />
                  <p className="text-xs leading-relaxed rounded-lg border px-4 py-3" style={{ color: MUTED, borderColor: LINE, background: 'rgba(255,255,255,0.6)' }}>{selected.description}</p>
                </section>

                <section>
                  <Head icon={<Skull className="w-4 h-4" />} jp="出現敵性体" en="HOSTILE UNITS" />
                  <div className="flex flex-col gap-2">
                    {selected.enemies.map((enemy, idx) => {
                      const thumb = thumbs[enemy.enemyTypeId];
                      const boss = enemy.name.includes('[BOSS]');
                      return (
                        <div key={idx} className="flex items-center gap-3 p-2 pr-3 rounded-lg border" style={{ borderColor: LINE, background: 'rgba(255,255,255,0.6)' }}>
                          <div
                            className="w-14 h-14 rounded-md shrink-0 grid place-items-center overflow-hidden"
                            style={{ background: 'radial-gradient(circle at 50% 40%, #2c3e66, #0e1730)', outline: boss ? `1px solid ${DANGER}` : undefined }}
                          >
                            {thumb ? <img src={thumb} alt="" className="w-full h-full object-contain" draggable={false} /> : <Skull className="w-6 h-6" style={{ color: MUTED }} />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-bold truncate" style={boss ? { color: DANGER } : undefined}>{enemy.name}</div>
                            <div className="text-[11px] truncate" style={{ color: MUTED }}>{enemy.description}</div>
                          </div>
                          <span className="px-2.5 py-1 rounded-md border text-sm font-cyber font-bold tabular-nums" style={{ color: GOLD, borderColor: LINE, background: 'rgba(245,197,66,0.1)' }}>
                            ×{enemy.count}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </section>

                <section>
                  <Head icon={<Gift className="w-4 h-4" />} jp="クリア報酬" en="REWARDS" />
                  <div className="grid grid-cols-2 rounded-lg border divide-x" style={{ borderColor: LINE, background: 'rgba(255,255,255,0.6)' }}>
                    <div className="flex items-center gap-3 px-4 py-3">
                      <span className="w-10 h-10 grid place-items-center rounded-full" style={{ background: 'rgba(200,150,42,0.15)', color: GOLD }}><Cpu className="w-5 h-5" /></span>
                      <div>
                        <div className="text-[10px] font-cyber tracking-wider" style={{ color: MUTED }}>SCRAP</div>
                        <div className="text-xl font-cyber font-bold tabular-nums" style={{ color: GOLD }}>+{effectiveScrapReward(selected.scrapReward).toLocaleString()}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 px-4 py-3">
                      <span className="w-10 h-10 grid place-items-center rounded-full" style={{ background: 'rgba(194,65,12,0.12)', color: DANGER }}><Hexagon className="w-5 h-5" /></span>
                      <div>
                        <div className="text-[10px] font-cyber tracking-wider" style={{ color: MUTED }}>BEACON</div>
                        <div className="text-xl font-cyber font-bold tabular-nums" style={{ color: DANGER }}>+{selected.coreReward}</div>
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            </div>

            {selected.unlocked ? (
              <button
                onClick={() => onStartMission(selected)}
                className="group relative shrink-0 h-[92px] flex items-center justify-center gap-4 text-white cursor-pointer transition-all hover:brightness-105 active:scale-[0.985]"
                style={{
                  clipPath: cutCorners(18),
                  background: selected.isBoss && !selected.cleared ? 'linear-gradient(135deg, #f59e0b, #c2410c 55%, #9a3412)' : 'linear-gradient(135deg, #f8d56a, #c8962a 55%, #9a7016)',
                  boxShadow: '0 10px 30px rgba(200,150,42,0.4)',
                }}
              >
                <span className="absolute inset-[3px] border border-white/40 pointer-events-none" style={{ clipPath: cutCorners(16) }} />
                <span className="absolute inset-0 overflow-hidden pointer-events-none">
                  <span className="absolute -inset-y-4 -left-1/3 w-1/3 bg-white/30 skew-x-[-20deg] translate-x-0 group-hover:translate-x-[450%] transition-transform duration-700" />
                </span>
                <Play className="w-9 h-9 fill-current" />
                <span className="text-center leading-none">
                  <span className="block text-[34px] font-black font-gothic tracking-[0.12em]">出撃開始</span>
                  <span className="mt-1.5 flex items-center justify-center gap-2 text-[11px] font-cyber tracking-[0.6em] opacity-90">
                    <span className="w-5 h-px bg-white/70" />
                    SORTIE
                  </span>
                </span>
                <ChevronsRight className="w-9 h-9 opacity-70 group-hover:translate-x-1 transition-transform" />
              </button>
            ) : (
              <div className="shrink-0 h-[92px] flex flex-col items-center justify-center gap-1 border" style={{ clipPath: cutCorners(18), background: PAPER, borderColor: LINE, color: MUTED }}>
                <Lock className="w-6 h-6" />
                <span className="text-xs font-bold tracking-wider">LOCKED // 下の階層のクリアで解放</span>
              </div>
            )}
          </>
        ) : null}
      </aside>
    </div>
  );
};

const Head: React.FC<{ icon: React.ReactNode; jp: string; en: string }> = ({ icon, jp, en }) => (
  <div className="flex items-center gap-2 mb-2">
    <span style={{ color: GOLD }}>{icon}</span>
    <span className="text-sm font-bold">{jp}</span>
    <span className="text-[11px] font-cyber tracking-wider" style={{ color: MUTED }}>({en})</span>
  </div>
);
