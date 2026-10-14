import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { X, Users, Link2, LogOut, Crown, Dices } from 'lucide-react';
import { cutCorners } from '../theme';
import { sound } from '../utils/sound';
import { NetSession, MAX_GUESTS, isValidRoomCode, randomRoomCode } from '../utils/netplay';

interface CoopPanelProps {
  net: NetSession | null;
  onNetChange: (net: NetSession | null) => void;
  missionName: string | null;
  onClose: () => void;
}

const NAME_KEY = 'cyber-core-pilot-name';

const loadName = (): string => {
  try {
    const saved = localStorage.getItem(NAME_KEY);
    if (saved) return saved;
  } catch {
    /* ignore */
  }
  return `PILOT-${Math.floor(1000 + Math.random() * 9000)}`;
};

const btn =
  'px-4 py-2 border text-[11px] font-cyber tracking-[0.18em] font-bold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed';
const btnPrimary = `${btn} border-hud-accent/60 text-hud-accent hover:bg-hud-accent/10`;
const btnGhost = `${btn} border-hud-line text-hud-muted hover:text-hud-text hover:border-hud-line-strong`;

export const CoopPanel: React.FC<CoopPanelProps> = ({ net, onNetChange, missionName, onClose }) => {
  const [name, setName] = useState(loadName);
  const [, force] = useState(0);
  const [mode, setMode] = useState<'none' | 'host' | 'guest'>(net ? (net.isHost ? 'host' : 'guest') : 'none');
  const [code, setCode] = useState(net?.roomCode ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => net?.onChange(() => force((c) => c + 1)), [net]);

  const saveName = (n: string) => {
    setName(n);
    try {
      localStorage.setItem(NAME_KEY, n);
    } catch {
      /* ignore */
    }
  };

  const connect = async (role: 'host' | 'guest') => {
    if (!NetSession.isSupported()) return setError('このブラウザは WebRTC に対応していません');
    if (!isValidRoomCode(code)) return setError('コードは8桁の数字にしてください');
    sound.playUiClick();
    setBusy(true);
    setError('');
    const s = role === 'host' ? NetSession.host(name.trim() || 'HOST') : NetSession.guest(name.trim() || 'GUEST');
    try {
      if (role === 'host') await s.open(code);
      else await s.join(code);
      onNetChange(s);
      setMode(role);
    } catch (e) {
      s.close();
      setError(e instanceof Error ? e.message : '接続に失敗しました');
    } finally {
      setBusy(false);
    }
  };

  const leave = () => {
    sound.playUiClick();
    net?.close();
    onNetChange(null);
    setMode('none');
    setCode('');
    setError('');
  };

  const guestCount = net ? net.players.length - 1 : 0;
  const inRoom = !!net;

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="relative w-[520px] max-w-[calc(100vw-32px)] max-h-[calc(100vh-48px)] overflow-y-auto bg-hud-bg border border-hud-line-strong text-hud-text"
        style={{ clipPath: cutCorners(18) }}
        initial={{ y: 16, scale: 0.97 }}
        animate={{ y: 0, scale: 1 }}
        exit={{ y: 16, scale: 0.97 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-hud-accent to-transparent" />
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-hud-accent" />
            <h2 className="font-cyber font-black tracking-[0.2em] text-sm">CO-OP</h2>
            <span className="text-[10px] text-hud-dim font-gothic">協力プレイ (最大{MAX_GUESTS + 1}人)</span>
          </div>
          <button onClick={onClose} className="p-1 text-hud-muted hover:text-hud-text cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 pb-5 flex flex-col gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] text-hud-dim font-cyber tracking-[0.2em]">PILOT NAME</span>
            <input
              value={name}
              maxLength={16}
              disabled={inRoom}
              onChange={(e) => saveName(e.target.value)}
              className="bg-hud-tile border border-hud-line px-3 py-2 text-sm font-mono text-hud-text disabled:opacity-60"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[10px] text-hud-dim font-cyber tracking-[0.2em]">ROOM CODE // 8桁の数字</span>
            <div className="flex gap-2">
              <input
                value={code}
                inputMode="numeric"
                placeholder="12345678"
                disabled={inRoom}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
                className="flex-1 bg-hud-tile border border-hud-line px-3 py-2 text-lg font-mono tracking-[0.3em] text-hud-text disabled:opacity-60"
              />
              {!inRoom && (
                <button className={btnGhost} title="ランダムなコード" onClick={() => setCode(randomRoomCode())}>
                  <Dices className="w-4 h-4" />
                </button>
              )}
            </div>
          </label>

          {!inRoom && (
            <div className="flex flex-col gap-3">
              <p className="text-[11px] text-hud-muted leading-relaxed">
                ホストは好きな8桁のコードで部屋を作り、友達にコードを伝えます。友達は同じコードを入れて参加します。
                ホストが作戦を選んで出撃すると全員が同じ作戦に出撃し、敵はホスト側で動いて全員で共有されます。
              </p>
              <div className="flex gap-3">
                <button className={`${btnPrimary} flex-1`} disabled={busy || code.length !== 8} onClick={() => connect('host')}>
                  {busy ? '接続中…' : 'HOST // 部屋を作る'}
                </button>
                <button className={`${btnPrimary} flex-1`} disabled={busy || code.length !== 8} onClick={() => connect('guest')}>
                  {busy ? '接続中…' : 'JOIN // 参加する'}
                </button>
              </div>
            </div>
          )}

          {net && (
            <div className="flex flex-col gap-2">
              <span className="text-[10px] text-hud-dim font-cyber tracking-[0.2em]">
                PLAYERS {net.players.length}/{MAX_GUESTS + 1}
              </span>
              {net.players.map((p) => (
                <div key={p.id} className="flex items-center gap-2 border border-hud-line bg-hud-tile px-3 py-1.5 text-sm">
                  {p.id === 'h' ? <Crown className="w-3.5 h-3.5 text-hud-warn" /> : <Link2 className="w-3.5 h-3.5 text-hud-ok" />}
                  <span className="font-mono">{p.name}</span>
                  {p.id === net.myId && <span className="text-[9px] text-hud-accent font-cyber tracking-widest">YOU</span>}
                </div>
              ))}
              <p className="text-[11px] text-hud-muted">
                {mode === 'host'
                  ? guestCount > 0
                    ? `${guestCount}人が参加中。MISSION 画面で作戦を選んで出撃すると全員で出撃します。`
                    : `コード ${net.roomCode} で待機中。参加者がいなくても一人で出撃できます。`
                  : '接続しました。ホストが出撃するのを待っています…'}
                {mode === 'host' && missionName && <span className="text-hud-accent"> 現在の作戦: {missionName}</span>}
              </p>
            </div>
          )}

          {error && <p className="text-[11px] text-hud-danger">{error}</p>}

          {mode !== 'none' && (
            <button className={`${btnGhost} flex items-center justify-center gap-2`} onClick={leave}>
              <LogOut className="w-3.5 h-3.5" />
              {mode === 'host' ? '部屋を閉じる' : '退出'}
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};
