/**
 * CYBER CORE - 協力マルチプレイ用 WebRTC (P2P) 通信
 *
 * サーバーを使わず、招待コード / 返信コードをコピー＆ペーストして接続する (手動シグナリング)。
 *   ホスト : createInvite() → 招待コードを友達に渡す → 返信コードを finish() に渡す
 *   ゲスト : acceptInvite(招待コード) → 返信コードをホストに返す
 * ホストを中心としたスター型。ゲスト同士の通信はホストが中継する。
 */

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

interface Peer {
  id: string;
  name: string;
  pc: RTCPeerConnection;
  rel: RTCDataChannel | null;
  fast: RTCDataChannel | null;
  open: boolean;
}

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }],
};

/** ホストが中継して他のゲストにも転送するメッセージ */
const RELAYED = new Set(['ps']);

const CODE_PREFIX = 'CC1.';

async function pump(data: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const writer = stream.writable.getWriter();
  void writer.write(data as unknown as BufferSource);
  void writer.close();
  return new Uint8Array(await new Response(stream.readable).arrayBuffer());
}

async function encodeCode(desc: RTCSessionDescriptionInit): Promise<string> {
  const raw = new TextEncoder().encode(JSON.stringify({ t: desc.type, s: desc.sdp }));
  let bytes: Uint8Array = raw;
  let tag = 'r';
  if (typeof CompressionStream !== 'undefined') {
    bytes = await pump(raw, new CompressionStream('deflate-raw'));
    tag = 'z';
  }
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return CODE_PREFIX + tag + btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function decodeCode(code: string): Promise<RTCSessionDescriptionInit> {
  const trimmed = code.replace(/\s+/g, '');
  if (!trimmed.startsWith(CODE_PREFIX)) throw new Error('コードの形式が正しくありません');
  const tag = trimmed[CODE_PREFIX.length];
  const b64 = trimmed.slice(CODE_PREFIX.length + 1).replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  let bytes: Uint8Array = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  if (tag === 'z') bytes = await pump(bytes, new DecompressionStream('deflate-raw'));
  const obj = JSON.parse(new TextDecoder().decode(bytes));
  return { type: obj.t, sdp: obj.s };
}

function waitIceComplete(pc: RTCPeerConnection, timeoutMs = 3500): Promise<void> {
  return new Promise((resolve) => {
    if (pc.iceGatheringState === 'complete') return resolve();
    const done = () => {
      pc.removeEventListener('icegatheringstatechange', onChange);
      clearTimeout(timer);
      resolve();
    };
    const onChange = () => {
      if (pc.iceGatheringState === 'complete') done();
    };
    const timer = setTimeout(done, timeoutMs);
    pc.addEventListener('icegatheringstatechange', onChange);
  });
}

export class NetSession {
  readonly role: NetRole;
  myId: string;
  name: string;
  /** 自分を含む参加者 (ホストが先頭) */
  players: NetPlayer[];
  closed = false;

  private peers = new Map<string, Peer>();
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
    this.peers.forEach((p) => {
      if (p.open) n++;
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

  // ───────────── ホスト側: 招待 ─────────────
  async createInvite(): Promise<{ code: string; finish: (answerCode: string) => Promise<void>; cancel: () => void }> {
    if (!this.isHost) throw new Error('host only');
    if (this.players.length + this.pendingCount() > MAX_GUESTS) throw new Error('満員です');
    const id = `g${++this.guestSeq}`;
    const pc = new RTCPeerConnection(RTC_CONFIG);
    const peer: Peer = { id, name: '', pc, rel: null, fast: null, open: false };
    this.attachChannel(peer, pc.createDataChannel('rel', { ordered: true }), 'rel');
    this.attachChannel(peer, pc.createDataChannel('fast', { ordered: false, maxRetransmits: 0 }), 'fast');
    this.watchConnection(peer);
    this.peers.set(id, peer);
    await pc.setLocalDescription(await pc.createOffer());
    await waitIceComplete(pc);
    const code = await encodeCode(pc.localDescription!);
    return {
      code,
      finish: async (answerCode: string) => {
        await pc.setRemoteDescription(await decodeCode(answerCode));
      },
      cancel: () => {
        if (!peer.open) this.dropPeer(id);
      },
    };
  }

  private pendingCount(): number {
    let n = 0;
    this.peers.forEach((p) => {
      if (!p.open) n++;
    });
    return n;
  }

  // ───────────── ゲスト側: 参加 ─────────────
  async acceptInvite(inviteCode: string): Promise<string> {
    if (this.isHost) throw new Error('guest only');
    this.dropPeer(HOST_ID);
    const offer = await decodeCode(inviteCode);
    if (offer.type !== 'offer') throw new Error('これは招待コードではありません');
    const pc = new RTCPeerConnection(RTC_CONFIG);
    const peer: Peer = { id: HOST_ID, name: '', pc, rel: null, fast: null, open: false };
    pc.ondatachannel = (ev) => {
      const label = ev.channel.label === 'fast' ? 'fast' : 'rel';
      this.attachChannel(peer, ev.channel, label);
    };
    this.watchConnection(peer);
    this.peers.set(HOST_ID, peer);
    await pc.setRemoteDescription(offer);
    await pc.setLocalDescription(await pc.createAnswer());
    await waitIceComplete(pc);
    return encodeCode(pc.localDescription!);
  }

  // ───────────── 共通 ─────────────
  private attachChannel(peer: Peer, dc: RTCDataChannel, kind: 'rel' | 'fast') {
    if (kind === 'rel') peer.rel = dc;
    else peer.fast = dc;
    dc.onopen = () => {
      const relReady = peer.rel?.readyState === 'open';
      const fastReady = peer.fast?.readyState === 'open';
      if (relReady && fastReady && !peer.open) {
        peer.open = true;
        // ゲストから名乗る
        if (!this.isHost) this.rawSend(peer, { t: 'hello', name: this.name }, true);
      }
    };
    dc.onmessage = (ev) => {
      let msg: NetMsg;
      try {
        msg = JSON.parse(ev.data as string);
      } catch {
        return;
      }
      this.handle(peer, msg);
    };
    dc.onclose = () => this.dropPeer(peer.id);
  }

  private watchConnection(peer: Peer) {
    peer.pc.onconnectionstatechange = () => {
      const s = peer.pc.connectionState;
      if (s === 'failed' || s === 'closed' || s === 'disconnected') {
        // 一時的な disconnected は少し待ってから切断扱いにする
        if (s === 'disconnected') {
          setTimeout(() => {
            if (peer.pc.connectionState === 'disconnected') this.dropPeer(peer.id);
          }, 4000);
        } else {
          this.dropPeer(peer.id);
        }
      }
    };
  }

  private dropPeer(id: string) {
    const peer = this.peers.get(id);
    if (!peer) return;
    this.peers.delete(id);
    const wasOpen = peer.open;
    peer.open = false;
    try {
      peer.rel?.close();
      peer.fast?.close();
      peer.pc.close();
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

  private handle(peer: Peer, msg: NetMsg) {
    if (this.isHost) {
      if (msg.t === 'hello') {
        peer.name = String(msg.name ?? '').slice(0, 16) || peer.id;
        if (!this.players.some((p) => p.id === peer.id)) this.players.push({ id: peer.id, name: peer.name });
        this.rawSend(peer, { t: 'welcome', id: peer.id, list: this.players }, true);
        this.broadcastPlayers();
        this.emitChange();
        return;
      }
      if (RELAYED.has(msg.t)) {
        const relayed = { ...msg, from: peer.id };
        this.peers.forEach((p) => {
          if (p !== peer && p.open) this.rawSend(p, relayed, false);
        });
      }
      this.listeners.forEach((fn) => fn(msg, peer.id));
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

  private rawSend(peer: Peer, msg: NetMsg, reliable: boolean) {
    const ch = reliable ? peer.rel : peer.fast ?? peer.rel;
    if (!ch || ch.readyState !== 'open') return;
    try {
      ch.send(JSON.stringify(msg));
    } catch {
      /* channel closing */
    }
  }

  /** ホスト: 全ゲストへ / ゲスト: ホストへ。reliable=false は欠落を許容する高頻度メッセージ用 */
  send(msg: NetMsg, reliable = true) {
    this.peers.forEach((p) => {
      if (p.open) this.rawSend(p, msg, reliable);
    });
  }

  /** ホストから特定のゲストへ */
  sendTo(id: string, msg: NetMsg, reliable = true) {
    const p = this.peers.get(id);
    if (p?.open) this.rawSend(p, msg, reliable);
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    [...this.peers.keys()].forEach((id) => this.dropPeer(id));
    this.players = [];
    this.listeners.clear();
    this.emitChange();
    this.changeListeners.clear();
  }
}
