import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { BattleResult } from '../types';
import { WORLD_MAPS } from '../data/initialData';
import { sound } from '../utils/sound';
import confetti from 'canvas-confetti';
import { usePalette, cutCorners } from '../theme';
import {
  Trophy,
  AlertTriangle,
  RotateCcw,
  Zap,
  ArrowRight,
  Cpu,
  Clock,
  Skull,
  Crosshair,
  Sparkles,
  Unlock,
  Globe,
  Swords,
} from 'lucide-react';

interface ResultScreenProps {
  result: BattleResult;
  onRetry: () => void;
  onGoToUpgrade: () => void;
  onReturnToMap: () => void;
}

/** 0 から目標値まで数字を増やして表示する */
const useCountUp = (target: number, duration = 1100, delay = 350) => {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now() + delay;
    const tick = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - start) / duration));
      setValue(Math.round(target * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, delay]);
  return value;
};

const StatTile: React.FC<{ icon: React.ReactNode; label: string; value: number; unit: string; delay: number }> = ({
  icon,
  label,
  value,
  unit,
  delay,
}) => {
  const shown = useCountUp(value, 1000, 400 + delay * 1000);
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 + delay, duration: 0.35 }}
      className="relative px-3.5 py-3 bg-hud-tile border border-hud-line"
    >
      <div className="flex items-center gap-1.5 text-[10px] font-cyber tracking-[0.18em] text-hud-dim">
        {icon}
        {label}
      </div>
      <div className="mt-1 font-cyber font-bold text-xl tabular-nums text-hud-text">
        {shown.toLocaleString()}
        <span className="ml-1 text-[10px] text-hud-muted tracking-wider">{unit}</span>
      </div>
    </motion.div>
  );
};

export const ResultScreen: React.FC<ResultScreenProps> = ({ result, onRetry, onGoToUpgrade, onReturnToMap }) => {
  const { isVictory, rank, stats, rewards } = result;
  const HUD = usePalette();

  useEffect(() => {
    if (isVictory) {
      sound.playVictory();
      try {
        confetti({
          particleCount: 120,
          spread: 80,
          origin: { y: 0.55 },
          colors: [HUD.accent, '#fbbf24', '#ffffff', HUD.branch.ASSAULT],
        });
      } catch {
        // safe
      }
    } else {
      sound.playDefeat();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVictory]);

  const tone = isVictory ? 'var(--hud-warn)' : 'var(--hud-danger)';
  const rankColor = !isVictory
    ? 'var(--hud-danger)'
    : ({ S: 'var(--hud-warn)', A: 'var(--hud-accent)', B: 'var(--hud-ok)', C: 'var(--hud-muted)' } as const)[rank];
  const scrapShown = useCountUp(rewards.scrap, 1200, 900);
  const coresShown = useCountUp(rewards.cores, 1200, 900);

  const unlocks: { icon: React.ReactNode; title: string; body: string; color: string }[] = [];
  if (rewards.nextMissionUnlocked) {
    unlocks.push({
      icon: <Unlock className="w-3.5 h-3.5" />,
      title: 'NEXT MISSION // 次作戦解放',
      body: `${rewards.nextMissionUnlocked.code} ${rewards.nextMissionUnlocked.name}`,
      color: 'var(--hud-accent)',
    });
  }
  if (isVictory) {
    const clearedIdx = WORLD_MAPS.findIndex((wm) => wm.bossMissionId === result.missionId);
    if (clearedIdx >= 0) {
      const next = WORLD_MAPS[clearedIdx + 1];
      const cur = WORLD_MAPS[clearedIdx];
      if (next) {
        unlocks.push({
          icon: <Globe className="w-3.5 h-3.5" />,
          title: 'NEW WORLD // マップ解放',
          body: `${next.badge}: ${next.name.split('//')[1]?.trim() ?? next.name}`,
          color: next.themeColor,
        });
      } else {
        unlocks.push({
          icon: <Trophy className="w-3.5 h-3.5" />,
          title: `${cur.badge} CLEARED // 領域突破`,
          body: `${cur.name.split('//')[1]?.trim() ?? cur.name}を突破。奥から届く信号は、まだ途絶えていない…`,
          color: 'var(--hud-ok)',
        });
      }
    }
  }
  if (rewards.weaponUnlocked) {
    unlocks.push({
      icon: <Swords className="w-3.5 h-3.5" />,
      title: 'NEW WEAPON // 新兵装',
      body: rewards.weaponUnlocked.name.split('//')[0].trim(),
      color: 'var(--hud-ok)',
    });
  }

  return (
    <div
      className="relative w-full h-full flex items-center justify-center p-6 overflow-hidden select-none text-hud-text"
      style={{ background: 'var(--hud-backdrop)' }}
    >
      <div className="pointer-events-none absolute inset-0 hud-scanlines" />
      {/* 結果に応じた色の光 */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: `radial-gradient(ellipse at 50% 30%, color-mix(in srgb, ${tone} 16%, transparent), transparent 60%)` }}
      />
      {/* 背景の巨大文字 */}
      <motion.div
        initial={{ opacity: 0, scale: 1.15 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
        className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 text-center font-cyber font-black leading-none whitespace-nowrap text-transparent"
        style={{ fontSize: '22vw', WebkitTextStroke: `1px color-mix(in srgb, ${tone} 22%, transparent)` }}
      >
        {isVictory ? 'VICTORY' : 'DEFEAT'}
      </motion.div>

      <div className="relative z-10 w-full max-w-3xl flex flex-col items-center gap-7">
        {/* HEADER */}
        <div className="text-center">
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex items-center justify-center gap-3 text-[11px] font-cyber tracking-[0.35em]"
            style={{ color: tone }}
          >
            <span className="w-12 h-px" style={{ background: tone }} />
            {isVictory ? <Trophy className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            {isVictory ? 'MISSION ACCOMPLISHED // 作戦目標達成' : 'TACTICAL DEFEAT // 戦線離脱'}
            <span className="w-12 h-px" style={{ background: tone }} />
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, letterSpacing: '0.5em', filter: 'blur(10px)' }}
            animate={{ opacity: 1, letterSpacing: '0.14em', filter: 'blur(0px)' }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="mt-3 text-6xl font-black font-cyber text-transparent bg-clip-text"
            style={{
              backgroundImage: isVictory
                ? 'linear-gradient(180deg, var(--hud-text) 30%, var(--hud-warn))'
                : 'linear-gradient(180deg, var(--hud-text) 10%, var(--hud-danger))',
            }}
          >
            {isVictory ? 'VICTORY' : 'MISSION FAILED'}
          </motion.h1>

          <p className="text-xs text-hud-muted font-gothic tracking-wider mt-3 max-w-lg mx-auto">
            {isVictory
              ? '対象領域の全敵性体を排除完了。回収したスクラップとコアを保管庫へ転送しました。'
              : '機体バイタル低下により強制離脱。ガジェットツリーで武器解放や能力強化を行い再挑戦せよ。'}
          </p>
        </div>

        {/* RANK + STATS */}
        <div className="w-full grid grid-cols-12 gap-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.6, rotate: -8 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ delay: 0.25, type: 'spring', stiffness: 220, damping: 16 }}
            className="col-span-4 relative flex flex-col items-center justify-center py-5 bg-hud-panel backdrop-blur-md border"
            style={{ borderColor: `color-mix(in srgb, ${rankColor} 50%, transparent)`, clipPath: cutCorners(16) }}
          >
            <span className="text-[10px] font-cyber tracking-[0.3em] text-hud-dim">EVALUATION</span>
            <div className="relative my-4 w-28 h-28 flex items-center justify-center">
              <div
                className="absolute inset-4 rotate-45 border-2"
                style={{ borderColor: rankColor, boxShadow: `0 0 24px color-mix(in srgb, ${rankColor} 45%, transparent)` }}
              />
              <div className="absolute inset-[26px] rotate-45 border" style={{ borderColor: `color-mix(in srgb, ${rankColor} 40%, transparent)` }} />
              <span
                className="relative text-6xl font-black font-cyber"
                style={{ color: rankColor, textShadow: `0 0 20px color-mix(in srgb, ${rankColor} 60%, transparent)` }}
              >
                {isVictory ? rank : 'F'}
              </span>
            </div>
            <span className="text-[10px] font-mono text-hud-muted tracking-wider">
              {isVictory ? `RATING // TIER-${rank}` : 'DEFEATED IN ACTION'}
            </span>
          </motion.div>

          <div className="col-span-8 grid grid-cols-2 gap-2">
            <StatTile icon={<Skull className="w-3 h-3 text-hud-accent" />} label="KILLS // 撃破数" value={stats.kills} unit="UNITS" delay={0} />
            <StatTile icon={<Clock className="w-3 h-3 text-hud-warn" />} label="TIME // 経過時間" value={Math.round(stats.timeSeconds)} unit="SEC" delay={0.08} />
            <StatTile icon={<Crosshair className="w-3 h-3 text-hud-danger" />} label="DAMAGE // 与ダメージ" value={Math.round(stats.damageDealt)} unit="DMG" delay={0.16} />
            <StatTile icon={<Sparkles className="w-3 h-3 text-hud-accent" />} label="SWEEP // 使用回数" value={stats.sweepsUsed} unit="TIMES" delay={0.24} />
          </div>
        </div>

        {/* REWARDS */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.4 }}
          className="w-full bg-hud-panel backdrop-blur-md border border-hud-line p-4"
        >
          <div className="flex items-center gap-2 mb-3 text-[10px] font-cyber tracking-[0.25em] text-hud-dim">
            <Cpu className="w-3 h-3 text-hud-accent" /> RECOVERED // 獲得物資
            <span className="flex-1 h-px bg-hud-line" />
          </div>
          <div className="flex items-stretch gap-3">
            <div className="flex-1 min-w-[150px] px-4 py-2">
              <div className="text-[10px] text-hud-dim font-cyber tracking-wider">SCRAP</div>
              <div className="text-3xl font-black font-cyber text-hud-accent tabular-nums">+{scrapShown.toLocaleString()}</div>
            </div>
            <div className="w-px bg-hud-line" />
            <div className="flex-1 min-w-[120px] px-4 py-2">
              <div className="text-[10px] text-hud-dim font-cyber tracking-wider">BEACON</div>
              <div className="text-3xl font-black font-cyber text-hud-warn tabular-nums">+{coresShown}</div>
            </div>
          </div>
          {unlocks.length > 0 && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            {unlocks.map((u, i) => (
              <motion.div
                key={u.title}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1.0 + i * 0.12 }}
                className="px-3 py-2 border"
                style={{ borderColor: u.color, background: `color-mix(in srgb, ${u.color} 10%, transparent)`, clipPath: cutCorners(8) }}
              >
                <div className="text-[10px] font-cyber tracking-wider font-bold flex items-center gap-1.5" style={{ color: u.color }}>
                  {u.icon}
                  {u.title}
                </div>
                <div className="text-xs font-bold mt-0.5 truncate">{u.body}</div>
              </motion.div>
            ))}
          </div>
          )}
        </motion.div>

        {/* ACTIONS */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="w-full grid grid-cols-2 gap-3"
        >
          {isVictory ? (
            <>
              <button
                onClick={onGoToUpgrade}
                className="py-4 bg-hud-tile hover:bg-hud-panel border border-hud-line-strong hover:border-hud-accent/60 font-cyber font-bold text-xs tracking-[0.2em] flex items-center justify-center gap-2 transition-all cursor-pointer"
                style={{ clipPath: cutCorners(12) }}
              >
                <Zap className="w-4 h-4 text-hud-accent" />
                UPGRADE // ガジェット強化
              </button>
              <button
                onClick={onReturnToMap}
                className="group py-4 bg-gradient-to-r from-hud-accent to-hud-accent-2 text-hud-on-accent font-cyber font-black text-xs tracking-[0.2em] flex items-center justify-center gap-2 transition-all cursor-pointer shadow-[var(--hud-glow)] hover:brightness-110 active:scale-[0.98]"
                style={{ clipPath: cutCorners(12) }}
              >
                NEXT MISSION // 次の作戦へ
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onRetry}
                className="py-4 text-white font-cyber font-black text-xs tracking-[0.2em] flex items-center justify-center gap-2 transition-all cursor-pointer hover:brightness-110 active:scale-[0.98]"
                style={{
                  background: 'linear-gradient(90deg, var(--hud-danger), color-mix(in srgb, var(--hud-danger) 70%, white))',
                  boxShadow: '0 0 24px color-mix(in srgb, var(--hud-danger) 35%, transparent)',
                  clipPath: cutCorners(12),
                }}
              >
                <RotateCcw className="w-4 h-4" />
                RETRY // 再挑戦
              </button>
              <button
                onClick={onGoToUpgrade}
                className="group py-4 bg-gradient-to-r from-hud-accent to-hud-accent-2 text-hud-on-accent font-cyber font-black text-xs tracking-[0.2em] flex items-center justify-center gap-2 transition-all cursor-pointer shadow-[var(--hud-glow)] hover:brightness-110 active:scale-[0.98]"
                style={{ clipPath: cutCorners(12) }}
              >
                <Zap className="w-4 h-4" />
                UPGRADE // 強化して挑む
              </button>
            </>
          )}
        </motion.div>

        {!isVictory && (
          <button onClick={onReturnToMap} className="text-[11px] font-cyber tracking-[0.2em] text-hud-dim hover:text-hud-text transition-colors cursor-pointer">
            ← MISSION MAP // マップへ戻る
          </button>
        )}
      </div>
    </div>
  );
};
