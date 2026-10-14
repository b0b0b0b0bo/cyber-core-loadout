/**
 * CYBER CORE - 協力マルチプレイ用 WebRTC (P2P) 通信
 *
 * 8桁の数字の部屋コードで接続する。接続の取り次ぎ (シグナリング) だけ PeerJS の公開ブローカーを使い、
 * ゲーム中の通信はプレイヤー同士の P2P。ホストを中心としたスター型で、ゲスト同士の通信はホストが中継する。
 *   ホスト : host(name).open(コード)
 *   ゲスト : guest(name).join(コード)
 */
import Peer, { DataConnection } from 'peerjs';

export type NetRole = 'host' | 'guest';

export interface NetPlayer {
  id: string;
  name: string;
}

export interface NetMsg {
  t: string;
  [key: string]: unknown;
}

export const HOST_ID = 'h';
export const MAX_GUESTS = 3;

type Listener = (msg: NetMsg, from: string) => void;

interface Link {
  id: string;
  name: string;
  conn: DataConnection;
  open: boolean;
}

/** ホストが中継して他のゲストにも転送するメッセージ */
const RELAYED = new Set(['ps']);

const ROOM_PREFIX = 'cybercore-coop-';
export const ROOM_CODE_LENGTH = 8;

export const isValidRoomCode = (code: string): boolean => /^\d{8}$/.test(code);

export const randomRoomCode = (): string => String(Math.floor(Math.random() * 1e8)).padStart(ROOM_CODE_LENGTH, '0');

export class NetSession {
  readonly role: NetRole;
  myId: string;
  name: string;
  /** 自分を含む参加者 (ホストが先頭) */
  players: NetPlayer[];
  roomCode = '';
  closed = false;

  private peer: Peer | null = null;
  private links = new Map<string, Link>();
  private listeners = new Set<Listener>();
  private changeListeners = new Set<() => void>();
  private guestSeq = 0;

  private constructor(role: NetRole, name: string) {
    this.role = role;
    this.name = name;
    this.myId = role === 'host' ? HOST_ID : '';
    this.players = role === 'host' ? [{ id: HOST_ID, name }] : [];
  }

  static host(name: string): NetSession {
    return new NetSession('host', name);
  }

  static guest(name: string): NetSession {
    return new NetSession('guest', name);
  }

  static isSupported(): boolean {
    return typeof RTCPeerConnection !== 'undefined';
  }

  get isHost(): boolean {
    return this.role === 'host';
  }

  /** 接続済みの他プレイヤー数 */
  get peerCount(): number {
    let n = 0;
    this.links.forEach((l) => {
      if (l.open) n++;
    });
    return n;
  }

  get remoteIds(): string[] {
    return this.players.filter((p) => p.id !== this.myId).map((p) => p.id);
  }

  nameOf(id: string): string {
    return this.players.find((p) => p.id === id)?.name ?? id;
  }

  on(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  onChange(fn: () => void): () => void {
    this.changeListeners.add(fn);
    return () => this.changeListeners.delete(fn);
  }

  private emitChange() {
    this.changeListeners.forEach((fn) => fn());
  }

  // ───────────── ホスト: 部屋を開く ─────────────
  open(code: string): Promise<void> {
    if (!this.isHost) return Promise.reject(new Error('host only'));
    if (!isValidRoomCode(code)) return Promise.reject(new Error('コードは8桁の数字にしてください'));
    return new Promise((resolve, reject) => {
      const peer = new Peer(ROOM_PREFIX + code);
      this.peer = peer;
      let opened = false;
      peer.on('open', () => {
        opened = true;
        this.roomCode = code;
        this.emitChange();
        resolve();
      });
      peer.on('error', (err) => {
        if (!opened) {
          peer.destroy();
          this.peer = null;
          reject(new Error(err.type === 'unavailable-id' ? 'そのコードは使用中です。別の数字にしてください' : '接続サーバーに繋がりません'));
        }
      });
      peer.on('connection', (conn) => this.acceptGuest(conn));
      peer.on('disconnected', () => {
        // ブローカーとの接続が切れても、確立済みのP2Pは維持される。新規参加用に再接続を試みる
        if (!this.closed) peer.reconnect();
      });
    });
  }

  private acceptGuest(conn: DataConnection) {
    if (this.players.length > MAX_GUESTS) {
      conn.on('open', () => {
        conn.send({ t: 'full' });
        setTimeout(() => conn.close(), 300);
      });
      return;
    }
    const id = `g${++this.guestSeq}`;
    const link: Link = { id, name: '', conn, open: false };
    this.links.set(id, link);
    conn.on('open', () => {
      link.open = true;
    });
    conn.on('data', (data) => this.handle(link, data as NetMsg));
    conn.on('close', () => this.dropLink(id));
    conn.on('error', () => this.dropLink(id));
  }

  // ───────────── ゲスト: 参加する ─────────────
  join(code: string): Promise<void> {
    if (this.isHost) return Promise.reject(new Error('guest only'));
    if (!isValidRoomCode(code)) return Promise.reject(new Error('コードは8桁の数字です'));
    return new Promise((resolve, reject) => {
      const peer = new Peer();
      this.peer = peer;
      let settled = false;
      const fail = (text: string) => {
        if (settled) return;
        settled = true;
        peer.destroy();
        this.peer = null;
        reject(new Error(text));
      };
      // どの段階で止まったかを区別する: broker=接続サーバー, room=部屋の検索, link=端末同士の接続
      let stage: 'broker' | 'room' | 'link' = 'broker';
      const timer = setTimeout(() => {
        if (stage === 'broker') fail('接続サーバー (0.peerjs.com) に繋がりません。この端末のネットワークが遮断している可能性があります');
        else fail('部屋は見つかりましたが、ホストの端末と直接接続できませんでした (ネットワークが通信を遮断している可能性)');
      }, 25000);
      peer.on('error', (err) => {
        clearTimeout(timer);
        fail(
          err.type === 'peer-unavailable'
            ? '部屋が見つかりません (コードが違うか、ホストが部屋を開いていません)'
            : `接続サーバーに繋がりません (${err.type})`,
        );
      });
      peer.on('open', () => {
        stage = 'room';
        const conn = peer.connect(ROOM_PREFIX + code, { reliable: true });
        const link: Link = { id: HOST_ID, name: '', conn, open: false };
        this.links.set(HOST_ID, link);
        // 部屋のホストが応答すると、端末同士の接続の確立待ちになる
        setTimeout(() => {
          if (!link.open) stage = 'link';
        }, 3000);
        conn.on('open', () => {
          clearTimeout(timer);
          link.open = true;
          this.roomCode = code;
          this.rawSend(link, { t: 'hello', name: this.name });
        });
        conn.on('data', (data) => {
          const msg = data as NetMsg;
          if (msg.t === 'full') return fail('部屋が満員です');
          if (msg.t === 'welcome' && !settled) {
            settled = true;
            resolve();
          }
          this.handle(link, msg);
        });
        conn.on('close', () => this.dropLink(HOST_ID));
        conn.on('error', () => this.dropLink(HOST_ID));
      });
    });
  }

  // ───────────── 共通 ─────────────
  private dropLink(id: string) {
    const link = this.links.get(id);
    if (!link) return;
    this.links.delete(id);
    const wasOpen = link.open;
    link.open = false;
    try {
      link.conn.close();
    } catch {
      /* already closed */
    }
    if (this.closed) return;
    if (this.isHost) {
      if (this.players.some((p) => p.id === id)) {
        this.players = this.players.filter((p) => p.id !== id);
        this.broadcastPlayers();
        this.listeners.forEach((fn) => fn({ t: 'left', id }, id));
        this.emitChange();
      }
    } else if (wasOpen || id === HOST_ID) {
      this.players = [];
      this.listeners.forEach((fn) => fn({ t: 'host-lost' }, HOST_ID));
      this.emitChange();
    }
  }

  private broadcastPlayers() {
    this.send({ t: 'players', list: this.players });
  }

  private handle(link: Link, msg: NetMsg) {
    if (!msg || typeof msg.t !== 'string') return;
    if (this.isHost) {
      if (msg.t === 'hello') {
        link.name = String(msg.name ?? '').slice(0, 16) || link.id;
        if (!this.players.some((p) => p.id === link.id)) this.players.push({ id: link.id, name: link.name });
        this.rawSend(link, { t: 'welcome', id: link.id, list: this.players });
        this.broadcastPlayers();
        this.emitChange();
        return;
      }
      if (RELAYED.has(msg.t)) {
        const relayed = { ...msg, from: link.id };
        this.links.forEach((l) => {
          if (l !== link && l.open) this.rawSend(l, relayed);
        });
      }
      this.listeners.forEach((fn) => fn(msg, link.id));
      return;
    }
    // ゲスト側
    if (msg.t === 'welcome') {
      this.myId = String(msg.id);
      this.players = (msg.list as NetPlayer[]) ?? [];
      this.emitChange();
      this.listeners.forEach((fn) => fn(msg, HOST_ID));
      return;
    }
    if (msg.t === 'players') {
      this.players = (msg.list as NetPlayer[]) ?? [];
      this.emitChange();
    }
    const from = typeof msg.from === 'string' ? msg.from : HOST_ID;
    this.listeners.forEach((fn) => fn(msg, from));
  }

  private rawSend(link: Link, msg: NetMsg) {
    if (!link.conn.open) return;
    try {
      link.conn.send(msg);
    } catch {
      /* closing */
    }
  }

  /** ホスト: 全ゲストへ / ゲスト: ホストへ (第2引数は旧API互換。全て順序保証つきで送る) */
  send(msg: NetMsg, _reliable = true) {
    this.links.forEach((l) => {
      if (l.open) this.rawSend(l, msg);
    });
  }

  /** ホストから特定のゲストへ */
  sendTo(id: string, msg: NetMsg, _reliable = true) {
    const l = this.links.get(id);
    if (l?.open) this.rawSend(l, msg);
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    [...this.links.keys()].forEach((id) => this.dropLink(id));
    this.peer?.destroy();
    this.peer = null;
    this.players = [];
    this.listeners.clear();
    this.emitChange();
    this.changeListeners.clear();
  }
}
