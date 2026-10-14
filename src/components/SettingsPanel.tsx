import React, { useEffect } from 'react';
import { motion } from 'motion/react';
import { Moon, Sun, Volume2, VolumeX, X, Settings, Check, Save } from 'lucide-react';
import { ThemeMode, useTheme, cutCorners } from '../theme';
import { sound } from '../utils/sound';

interface SettingsPanelProps {
  isMuted: boolean;
  onToggleMute: () => void;
  onResetSave: () => void;
  onClose: () => void;
}

const THEME_OPTIONS: { mode: ThemeMode; label: string; sub: string; icon: React.ReactNode; preview: { bg: string; panel: string; line: string; accent: string; text: string } }[] = [
  {
    mode: 'dark',
    label: 'DARK',
    sub: 'ダークモード',
    icon: <Moon className="w-4 h-4" />,
    preview: { bg: '#04070d', panel: '#0b1220', line: '#1e293b', accent: '#22d3ee', text: '#e2e8f0' },
  },
  {
    mode: 'light',
    label: 'LIGHT',
    sub: 'ライトモード',
    icon: <Sun className="w-4 h-4" />,
    preview: { bg: '#eef2f7', panel: '#ffffff', line: '#dbe3ee', accent: '#0284c7', text: '#0f172a' },
  },
];

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ isMuted, onToggleMute, onResetSave, onClose }) => {
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="relative w-[440px] max-w-[calc(100vw-32px)] bg-hud-bg border border-hud-line-strong text-hud-text"
        style={{ clipPath: cutCorners(18) }}
        initial={{ y: 16, scale: 0.97 }}
        animate={{ y: 0, scale: 1 }}
        exit={{ y: 16, scale: 0.97 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-hud-accent to-transparent" />

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-hud-line">
          <div>
            <div className="text-[10px] font-cyber tracking-[0.35em] text-hud-accent flex items-center gap-2">
              <Settings className="w-3 h-3" /> SYSTEM CONFIG
            </div>
            <h2 className="text-lg font-cyber font-black tracking-[0.12em] mt-1">SETTINGS // 設定</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-hud-muted hover:text-hud-text border border-hud-line hover:border-hud-line-strong transition-colors cursor-pointer"
            title="閉じる (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* Theme */}
          <section>
            <div className="flex items-center gap-2 mb-3 text-[10px] font-cyber tracking-[0.25em] text-hud-dim">
              DISPLAY THEME // 画面テーマ
              <span className="flex-1 h-px bg-hud-line" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {THEME_OPTIONS.map((opt) => {
                const active = theme === opt.mode;
                return (
                  <button
                    key={opt.mode}
                    onClick={() => {
                      sound.playUiClick();
                      setTheme(opt.mode);
                    }}
                    className={`relative text-left p-2.5 border transition-all cursor-pointer ${
                      active ? 'border-hud-accent shadow-[var(--hud-glow)]' : 'border-hud-line hover:border-hud-line-strong'
                    }`}
                  >
                    {/* mini preview */}
                    <div className="h-16 mb-2.5 p-1.5 flex gap-1.5" style={{ background: opt.preview.bg, border: `1px solid ${opt.preview.line}` }}>
                      <div className="flex-1 flex flex-col gap-1 p-1" style={{ background: opt.preview.panel, border: `1px solid ${opt.preview.line}` }}>
                        <div className="h-1 w-3/4" style={{ background: opt.preview.text, opacity: 0.8 }} />
                        <div className="h-1 w-1/2" style={{ background: opt.preview.text, opacity: 0.35 }} />
                        <div className="mt-auto h-2 w-full" style={{ background: opt.preview.accent }} />
                      </div>
                      <div className="w-8 flex items-center justify-center">
                        <div className="w-3 h-3 rotate-45" style={{ border: `1.5px solid ${opt.preview.accent}`, boxShadow: `0 0 6px ${opt.preview.accent}` }} />
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={active ? 'text-hud-accent' : 'text-hud-muted'}>{opt.icon}</span>
                        <div>
                          <div className="text-xs font-cyber font-bold tracking-[0.15em]">{opt.label}</div>
                          <div className="text-[10px] text-hud-muted">{opt.sub}</div>
                        </div>
                      </div>
                      {active && (
                        <span className="w-5 h-5 flex items-center justify-center bg-hud-accent text-hud-on-accent">
                          <Check className="w-3.5 h-3.5" />
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Audio */}
          <section>
            <div className="flex items-center gap-2 mb-3 text-[10px] font-cyber tracking-[0.25em] text-hud-dim">
              AUDIO // サウンド
              <span className="flex-1 h-px bg-hud-line" />
            </div>
            <button
              onClick={onToggleMute}
              className="w-full flex items-center justify-between px-3.5 py-3 border border-hud-line hover:border-hud-line-strong bg-hud-tile transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2.5 text-xs">
                {isMuted ? <VolumeX className="w-4 h-4 text-hud-danger" /> : <Volume2 className="w-4 h-4 text-hud-accent" />}
                効果音・BGM
              </span>
              <span className={`relative w-10 h-5 transition-colors ${isMuted ? 'bg-hud-line-strong' : 'bg-hud-accent'}`}>
                <span
                  className="absolute top-0.5 w-4 h-4 bg-hud-bg transition-all"
                  style={{ left: isMuted ? 2 : 22 }}
                />
              </span>
            </button>
          </section>

          {/* Save data */}
          <section>
            <div className="flex items-center gap-2 mb-3 text-[10px] font-cyber tracking-[0.25em] text-hud-dim">
              SAVE DATA // セーブデータ
              <span className="flex-1 h-px bg-hud-line" />
            </div>
            <button
              onClick={() => {
                if (window.confirm('セーブデータを消去して初期状態に戻します。よろしいですか？')) {
                  sound.playUiClick();
                  onResetSave();
                }
              }}
              className="w-full flex items-center justify-between px-3.5 py-3 border border-hud-line hover:border-hud-danger bg-hud-tile transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2.5 text-xs">
                <Save className="w-4 h-4 text-hud-danger" />
                進行状況を初期化
              </span>
              <span className="text-[10px] font-mono text-hud-muted">RESET</span>
            </button>
          </section>
        </div>

        <div className="px-6 pb-5 text-[10px] font-mono text-hud-dim">設定・進行状況はこのブラウザに自動保存されます · Esc で閉じる</div>
      </motion.div>
    </motion.div>
  );
};
