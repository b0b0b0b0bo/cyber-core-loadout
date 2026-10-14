import React, { createContext, useContext, useEffect, useState } from 'react';

/**
 * 画面テーマ (ダーク / ライト)
 *  - 選択は localStorage に保存し、<html data-theme="..."> に反映する
 *  - HTML 側は index.css の CSS 変数 (bg-hud-* / text-hud-* など) で色が切り替わる
 *  - SVG / three.js など JS で色を渡す箇所は usePalette() の値を使う
 */
export type ThemeMode = 'dark' | 'light';

const STORAGE_KEY = 'cyber-core-theme';

const readStoredTheme = (): ThemeMode => {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'dark' || v === 'light') return v;
  } catch {
    // storage unavailable
  }
  return 'dark';
};

// 初回描画前に属性を付けて、ちらつきを防ぐ
if (typeof document !== 'undefined') {
  document.documentElement.dataset.theme = readStoredTheme();
}

interface ThemeContextValue {
  theme: ThemeMode;
  setTheme: (t: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue>({ theme: 'dark', setTheme: () => {} });

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<ThemeMode>(readStoredTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // storage unavailable
    }
  }, [theme]);

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => useContext(ThemeContext);

/** JS から直接色を指定する箇所 (SVG 属性 / three.js) 用のパレット */
export interface Palette {
  isDark: boolean;
  bg: string;
  text: string;
  textMuted: string;
  accent: string;
  /** ツリーの未解放ノード */
  lockedFill: string;
  lockedStroke: string;
  lockedIcon: string;
  availFill: string;
  availStroke: string;
  lockedLine: string;
  availLine: string;
  grid: string;
  ring: string;
  labelHalo: string;
  branch: Record<'INFIGHT' | 'ASSAULT' | 'GRENADE', string>;
  /** three.js 用 (数値カラー) */
  three: { fog: number; grid: number; spire: number; spireOpacity: number; ambient: number; locked: number };
}

const DARK: Palette = {
  isDark: true,
  bg: '#04070d',
  text: '#e2e8f0',
  textMuted: '#94a3b8',
  accent: '#22d3ee',
  lockedFill: '#070c16',
  lockedStroke: '#1e2a40',
  lockedIcon: '#334155',
  availFill: '#0b1424',
  availStroke: '#e2e8f0',
  lockedLine: '#141d2e',
  availLine: '#64748b',
  grid: 'rgba(56, 189, 248, 0.055)',
  ring: 'rgba(148, 163, 184, 0.09)',
  labelHalo: '#04070d',
  branch: { INFIGHT: '#38bdf8', ASSAULT: '#34d399', GRENADE: '#fbbf24' },
  three: { fog: 0x04070d, grid: 0x1e293b, spire: 0x38bdf8, spireOpacity: 0.18, ambient: 0.9, locked: 0x334155 },
};

const LIGHT: Palette = {
  isDark: false,
  bg: '#eef2f7',
  text: '#0f172a',
  textMuted: '#475569',
  accent: '#0284c7',
  lockedFill: '#f1f5f9',
  lockedStroke: '#cbd5e1',
  lockedIcon: '#94a3b8',
  availFill: '#ffffff',
  availStroke: '#0f172a',
  lockedLine: '#dbe3ee',
  availLine: '#64748b',
  grid: 'rgba(2, 132, 199, 0.07)',
  ring: 'rgba(100, 116, 139, 0.18)',
  labelHalo: '#f5f8fc',
  branch: { INFIGHT: '#0284c7', ASSAULT: '#059669', GRENADE: '#d97706' },
  three: { fog: 0xeef2f7, grid: 0xcbd5e1, spire: 0x94a3b8, spireOpacity: 0.35, ambient: 1.8, locked: 0x94a3b8 },
};

export const usePalette = (): Palette => (useTheme().theme === 'dark' ? DARK : LIGHT);

/** 角を斜めに落としたパネル形状 (clip-path) */
export const cutCorners = (s: number) =>
  `polygon(0 0, calc(100% - ${s}px) 0, 100% ${s}px, 100% 100%, ${s}px 100%, 0 calc(100% - ${s}px))`;
