import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { X, Users, Copy, Check, Link2, LogOut, Crown } from 'lucide-react';
import { cutCorners } from '../theme';
import { sound } from '../utils/sound';
import { NetSession, MAX_GUESTS } from '../utils/netplay';

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

const CodeBox: React.FC<{ value: string; label: string }> = ({ value, label }) => {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-hud-dim font-cyber tracking-[0.2em]">{label}</span>
        <button
          className="flex items-center gap-1 text-[10px] text-hud-accent font-cyber tracking-widest cursor-pointer"
          onClick={() => {
            navigator.clipboard?.writeText(value).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            });
          }}
        >
          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          {copied ? 'COPIED' : 'COPY'}
        </button>
      </div>
      <textarea
        readOnly
        value={value}
        onFocus={(e) => e.currentTarget.select()}
        className="w-full h-16 resize-none bg-hud-tile border border-hud-line p-2 text-[10px] font-mono text-hud-muted break-all"
      />
    </div>
  );
};

export const CoopPanel: React.FC<CoopPanelProps> = ({ net, onNetChange, missionName, onClose }) => {
  const [name, setName] = useState(loadName);
  const [, force] = useState(0);
  const [mode, setMode] = useState<'none' | 'host' | 'guest'>(net ? (net.isHost ? 'host' : 'guest') : 'none');
  const [invite, setInvite] = useState<{ code: string; finish: (c: string) => Promise<void>; cancel: () => void } | null>(null);
  const [replyIn, setReplyIn] = useState('');
  const [inviteIn, setInviteIn] = useState('');
  const [replyOut, setReplyOut] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const inviteRef = useRef(invite);
  inviteRef.current = invite;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // 参加者が増えたら招待フォームを閉じる
  const playerCountRef = useRef(net?.players.length ?? 0);
  useEffect(() => {
    playerCountRef.current = net?.players.length ?? 0;
    return net?.onChange(() => {
      const n = net.players.length;
      if (net.isHost && n > playerCountRef.current) setInvite(null);
      playerCountRef.current = n;
      force((c) => c + 1);
    });
  }, [net]);

  const saveName = (n: string) => {
    setName(n);
    try {
      localStorage.setItem(NAME_KEY, n);
    } catch {
      /* ignore */
    }
  };

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : '接続に失敗しました');
    } finally {
      setBusy(false);
    }
  };

  const startHost = () => {
    if (!NetSession.isSupported()) return setError('このブラウザは WebRTC に対応していません');
    sound.playUiClick();
    const s = NetSession.host(name.trim() || 'HOST');
    onNetChange(s);
    setMode('host');
  };

  const startGuest = () => {
    if (!NetSession.isSupported()) return setError('このブラウザは WebRTC に対応していません');
    sound.playUiClick();
    const s = NetSession.guest(name.trim() || 'GUEST');
    onNetChange(s);
    setMode('guest');
  };

  const leave = () => {
    sound.playUiClick();
    inviteRef.current?.cancel();
    net?.close();
    onNetChange(null);
    setMode('none');
    setInvite(null);
    setReplyIn('');
    setInviteIn('');
    setReplyOut('');
    setError('');
  };

  const makeInvite = () =>
    run(async () => {
      if (!net) return;
      invite?.cancel();
      setInvite(await net.createInvite());
      setReplyIn('');
    });

  const connectGuest = () =>
    run(async () => {
      if (!invite) return;
      await invite.finish(replyIn);
      setInvite(null);
      setReplyIn('');
    });

  const makeReply = () =>
    run(async () => {
      if (!net) return;
      setReplyOut(await net.acceptInvite(inviteIn));
    });

  const guestCount = net ? net.players.length - 1 : 0;

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
          {/* 名前 */}
          <label className="flex flex-col gap-1">
            <span className="text-[10px] text-hud-dim font-cyber tracking-[0.2em]">PILOT NAME</span>
            <input
              value={name}
              maxLength={16}
              disabled={mode !== 'none'}
              onChange={(e) => saveName(e.target.value)}
              className="bg-hud-tile border border-hud-line px-3 py-2 text-sm font-mono text-hud-text disabled:opacity-60"
            />
          </label>

          {mode === 'none' && (
            <div className="flex flex-col gap-3">
              <p className="text-[11px] text-hud-muted leading-relaxed">
                サーバーを使わず、招待コードのやり取りだけで接続します。ホストが作戦を選んで出撃すると全員が同じ作戦に出撃します。
                敵はホスト側で動き、全員で共有されます。
              </p>
              <div className="flex gap-3">
                <button className={`${btnPrimary} flex-1`} onClick={startHost}>
                  HOST // 部屋を作る
                </button>
                <button className={`${btnPrimary} flex-1`} onClick={startGuest}>
                  JOIN // 参加する
                </button>
              </div>
            </div>
          )}

          {net && (
            <div className="flex flex-col gap-2">
              <span className="text-[10px] text-hud-dim font-cyber tracking-[0.2em]">
                PLAYERS {net.players.length}/{MAX_GUESTS + 1}
              </span>
              {net.players.length === 0 && <span className="text-xs text-hud-muted">ホストとの接続待ち…</span>}
              {net.players.map((p) => (
                <div key={p.id} className="flex items-center gap-2 border border-hud-line bg-hud-tile px-3 py-1.5 text-sm">
                  {p.id === 'h' ? <Crown className="w-3.5 h-3.5 text-hud-warn" /> : <Link2 className="w-3.5 h-3.5 text-hud-ok" />}
                  <span className="font-mono">{p.name}</span>
                  {p.id === net.myId && <span className="text-[9px] text-hud-accent font-cyber tracking-widest">YOU</span>}
                </div>
              ))}
            </div>
          )}

          {mode === 'host' && net && (
            <div className="flex flex-col gap-3">
              {!invite && (
                <button className={btnPrimary} disabled={busy || net.players.length > MAX_GUESTS} onClick={makeInvite}>
                  {busy ? '作成中…' : '＋ 招待コードを発行'}
                </button>
              )}
              {invite && (
                <div className="flex flex-col gap-3 border border-hud-line p-3">
                  <CodeBox value={invite.code} label="① 招待コード (友達に送る)" />
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] text-hud-dim font-cyber tracking-[0.2em]">② 友達から届いた返信コードを貼り付け</span>
                    <textarea
                      value={replyIn}
                      onChange={(e) => setReplyIn(e.target.value)}
                      className="w-full h-16 resize-none bg-hud-tile border border-hud-line p-2 text-[10px] font-mono text-hud-text break-all"
                    />
                  </label>
                  <div className="flex gap-2">
                    <button className={`${btnPrimary} flex-1`} disabled={busy || !replyIn.trim()} onClick={connectGuest}>
                      接続
                    </button>
                    <button
                      className={btnGhost}
                      onClick={() => {
                        invite.cancel();
                        setInvite(null);
                      }}
                    >
                      キャンセル
                    </button>
                  </div>
                </div>
              )}
              <p className="text-[11px] text-hud-muted">
                {guestCount > 0
                  ? `${guestCount}人が参加中。MISSION 画面で作戦を選んで出撃すると全員で出撃します。`
                  : '参加者が接続するまで一人で出撃もできます。'}
                {missionName && <span className="text-hud-accent"> 現在の作戦: {missionName}</span>}
              </p>
            </div>
          )}

          {mode === 'guest' && net && (
            <div className="flex flex-col gap-3">
              {net.players.length === 0 && (
                <>
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] text-hud-dim font-cyber tracking-[0.2em]">① ホストの招待コードを貼り付け</span>
                    <textarea
                      value={inviteIn}
                      onChange={(e) => setInviteIn(e.target.value)}
                      className="w-full h-16 resize-none bg-hud-tile border border-hud-line p-2 text-[10px] font-mono text-hud-text break-all"
                    />
                  </label>
                  <button className={btnPrimary} disabled={busy || !inviteIn.trim() || !!replyOut} onClick={makeReply}>
                    {busy ? '作成中…' : '返信コードを作成'}
                  </button>
                  {replyOut && (
                    <>
                      <CodeBox value={replyOut} label="② 返信コード (ホストに送り返す)" />
                      <p className="text-[11px] text-hud-muted">ホストが返信コードを入力すると自動で接続されます。</p>
                    </>
                  )}
                </>
              )}
              {net.players.length > 0 && (
                <p className="text-[11px] text-hud-ok">接続しました。ホストが出撃するのを待っています…</p>
              )}
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
