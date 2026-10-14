/**
 * CYBER CORE - 協力プレイの戦闘同期
 *
 *  - 敵・ウェーブ・ボスの進行はホストだけが計算する (host-authoritative)
 *  - ゲストは敵の「人形 (puppet)」を表示し、与えたダメージをホストへ報告する
 *  - プレイヤー位置は全員が約20Hzで送り合い、味方はアバターとして表示される
 *  - 敵の攻撃は最も近い (ダウンしていない) プレイヤーを狙い、被弾は該当プレイヤーへ `hit` で通知する
 */
import * as THREE from 'three';
import { NetSession, HOST_ID } from './netplay';
import type { NetMsg } from './netplay';
import type { HazardSpec } from './combatHazards';

/** 同期に必要なだけの敵インスタンス (BattleScene3D の EnemyInstance が構造的に満たす) */
export interface CoopEnemy {
  mesh: THREE.Group;
  hp: number;
  maxHp: number;
  typeId: string;
  name?: string;
  category: string;
  isDead: boolean;
  scrapValue: number;
  bossPhase?: number;
  isPuppet?: boolean;
  netId?: number;
  /** ゲスト: ホストが把握しているはずの HP (これより減った分をダメージとして報告する) */
  netHp?: number;
  netPos?: { x: number; y: number; z: number; ry: number };
  /** ホスト: 直近のスナップショット時点の HP / 最後にダメージを与えたプレイヤー */
  netSnapHp?: number;
  lastDamager?: string;
}

export interface CoopLocalState {
  /** 目線の位置 */
  pos: THREE.Vector3;
  yaw: number;
  pitch: number;
  hp: number;
  maxHp: number;
  ko: boolean;
  color: string;
}

export interface CoopWaveInfo {
  wave: number;
  total: number;
  final: boolean;
  boss: boolean;
  bossName?: string;
}

export interface BulletMirror {
  from: number[];
  dir: number[];
  speed: number;
  life: number;
  color: number;
  size: number;
  radius: number;
}

export interface CoopCtx {
  scene: THREE.Scene;
  enemies: () => CoopEnemy[];
  local: () => CoopLocalState;
  spawnPuppet: (typeId: string, name: string, x: number, z: number) => CoopEnemy;
  /** ゲスト: ホストの敵が倒された (演出・報酬・片付け) */
  removePuppet: (e: CoopEnemy) => void;
  hurtLocal: (dmg: number, label: string, color: string, opts: Record<string, unknown>) => void;
  onWave: (w: CoopWaveInfo) => void;
  onEnd: (victory: boolean) => void;
  onAnnounce: (text: string) => void;
  addHazardMirror: (spec: HazardSpec) => void;
  addBulletMirror: (b: BulletMirror) => void;
  setLiving: (n: number) => void;
  /** 近くの味方に起こされた */
  revive: (fraction: number) => void;
  notify: (text: string) => void;
}

interface Remote {
  id: string;
  name: string;
  color: string;
  eye: THREE.Vector3;
  target: THREE.Vector3;
  yaw: number;
  targetYaw: number;
  pitch: number;
  hp: number;
  maxHp: number;
  ko: boolean;
  seen: boolean;
  group: THREE.Group;
  gun: THREE.Group;
  body: THREE.Mesh;
  label: THREE.Sprite;
  labelCtx: CanvasRenderingContext2D;
  labelTex: THREE.CanvasTexture;
  labelKey: string;
}

interface Tracer {
  line: THREE.Line;
  life: number;
}

export const PLAYER_COLORS = ['#22d3ee', '#f472b6', '#a3e635', '#fbbf24'];
const EYE_Y = 1.7;
const STATE_HZ = 20;
const SNAP_HZ = 15;

const round2 = (n: number) => Math.round(n * 100) / 100;

function shortestAngle(from: number, to: number): number {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export class CoopBattle {
  readonly net: NetSession;
  readonly isHost: boolean;
  private ctx: CoopCtx;
  private remotes = new Map<string, Remote>();
  private tracers: Tracer[] = [];
  private off: () => void;
  private stateAcc = 0;
  private snapAcc = 0;
  private reportAcc = 0;
  private netSeq = 0;
  private lastSnapSeq = -1;
  private byNet = new Map<number, CoopEnemy>();
  private reviveT = 0;
  private lastKo = false;
  private disposed = false;

  constructor(net: NetSession, ctx: CoopCtx) {
    this.net = net;
    this.isHost = net.isHost;
    this.ctx = ctx;
    this.off = net.on(this.handle);
  }

  // ───────────── 参照 ─────────────
  get remoteList(): Remote[] {
    return [...this.remotes.values()];
  }

  /** 参加人数 (自分を含む) */
  get playerCount(): number {
    return 1 + this.net.remoteIds.length;
  }

  private colorFor(id: string): string {
    const idx = Math.max(0, this.net.players.findIndex((p) => p.id === id));
    return PLAYER_COLORS[idx % PLAYER_COLORS.length];
  }

  getRemote(id: string): Remote | undefined {
    return this.remotes.get(id);
  }

  /** ホスト: 全員ダウンしているか */
  allDown(localKo: boolean): boolean {
    if (!localKo) return false;
    // まだ状態が届いていない参加者は生存扱い
    for (const id of this.net.remoteIds) if (!this.remotes.get(id)?.ko) return false;
    return true;
  }

  // ───────────── 送信 ─────────────
  sendHit(id: string, dmg: number, label: string, color: string, opts: Record<string, unknown>) {
    this.net.sendTo(id, { t: 'hit', d: dmg, label, color, opts });
  }

  sendWave(w: CoopWaveInfo) {
    if (this.isHost) this.net.send({ t: 'wave', ...w });
  }

  sendAnnounce(text: string) {
    if (this.isHost) this.net.send({ t: 'ann', text });
  }

  sendEnd(victory: boolean) {
    if (this.isHost) this.net.send({ t: 'end', victory });
  }

  /** ホスト: 敵弾の見た目をゲストへ (被弾判定はホストが行う) */
  sendBullet(spec: { from: THREE.Vector3; dir: THREE.Vector3; speed: number; life: number; color: number; size: number; radius: number }) {
    if (!this.isHost || this.net.peerCount === 0) return;
    this.net.send(
      {
        t: 'eb',
        f: [round2(spec.from.x), round2(spec.from.y), round2(spec.from.z)],
        d: [round2(spec.dir.x), round2(spec.dir.y), round2(spec.dir.z)],
        sp: spec.speed, l: spec.life, c: spec.color, s: spec.size, r: spec.radius,
      },
      false,
    );
  }

  sendHazard(spec: HazardSpec) {
    if (!this.isHost || this.net.peerCount === 0) return;
    this.net.send({
      t: 'hz',
      s: {
        shape: spec.shape, x: round2(spec.x), z: round2(spec.z), radius: spec.radius, inner: spec.inner, length: spec.length,
        angle: spec.angle, arc: spec.arc, delay: spec.delay, label: spec.label, color: spec.color, fx: spec.fx, jumpable: spec.jumpable,
      },
    });
  }

  // ───────────── 受信 ─────────────
  private handle = (msg: NetMsg, from: string) => {
    if (this.disposed) return;
    switch (msg.t) {
      case 'ps': {
        if (from === this.net.myId) return;
        this.applyPlayerState(from, msg);
        break;
      }
      case 'es': {
        if (!this.isHost) this.applySnapshot(msg);
        break;
      }
      case 'dmg': {
        if (this.isHost) this.applyRemoteDamage(from, msg.l as number[][]);
        break;
      }
      case 'hit': {
        if (!this.isHost) {
          this.ctx.hurtLocal(Number(msg.d) || 0, String(msg.label ?? ''), String(msg.color ?? '#ef4444'), (msg.opts as Record<string, unknown>) ?? {});
        }
        break;
      }
      case 'wave':
        if (!this.isHost) this.ctx.onWave(msg as unknown as CoopWaveInfo);
        break;
      case 'ann':
        if (!this.isHost) this.ctx.onAnnounce(String(msg.text ?? ''));
        break;
      case 'end':
        if (!this.isHost) this.ctx.onEnd(Boolean(msg.victory));
        break;
      case 'eb':
        if (!this.isHost) {
          this.ctx.addBulletMirror({
            from: msg.f as number[], dir: msg.d as number[], speed: Number(msg.sp), life: Number(msg.l),
            color: Number(msg.c), size: Number(msg.s) || 0.2, radius: Number(msg.r) || 0.3,
          });
        }
        break;
      case 'hz':
        if (!this.isHost) this.ctx.addHazardMirror(msg.s as HazardSpec);
        break;
    }
  };

  private applyPlayerState(id: string, m: NetMsg) {
    let r = this.remotes.get(id);
    if (!r) {
      r = this.makeRemote(id);
      this.remotes.set(id, r);
    }
    const x = Number(m.x), y = Number(m.y), z = Number(m.z);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return;
    r.target.set(x, y, z);
    if (!r.seen) {
      r.seen = true;
      r.eye.copy(r.target);
      r.yaw = r.targetYaw = Number(m.yaw) || 0;
    }
    r.targetYaw = Number(m.yaw) || 0;
    r.pitch = Number(m.pitch) || 0;
    r.hp = Number(m.hp) || 0;
    r.maxHp = Number(m.mhp) || 100;
    r.ko = Boolean(m.ko);
  }

  /** ホスト: ゲストの与えたダメージを敵に適用 */
  private applyRemoteDamage(from: string, list: number[][]) {
    if (!Array.isArray(list)) return;
    const enemies = this.ctx.enemies();
    for (const entry of list) {
      const [id, d] = entry;
      const en = enemies.find((e) => e.netId === id && !e.isDead);
      if (!en || !(d > 0)) continue;
      en.hp -= Math.min(d, en.maxHp);
      en.lastDamager = from;
    }
  }

  /** ゲスト: ホストの敵スナップショットを反映 */
  private applySnapshot(m: NetMsg) {
    const seq = Number(m.n);
    if (seq <= this.lastSnapSeq) return;
    this.lastSnapSeq = seq;
    const list = m.e as (string | number)[][];
    if (!Array.isArray(list)) return;
    const seen = new Set<number>();
    for (const a of list) {
      const id = a[0] as number;
      seen.add(id);
      let en = this.byNet.get(id);
      if (!en) {
        en = this.ctx.spawnPuppet(String(a[1]), String(a[2]), Number(a[3]), Number(a[5]));
        en.isPuppet = true;
        en.netId = id;
        en.mesh.position.set(Number(a[3]), Number(a[4]), Number(a[5]));
        this.byNet.set(id, en);
      }
      en.netPos = { x: Number(a[3]), y: Number(a[4]), z: Number(a[5]), ry: Number(a[6]) };
      en.maxHp = Number(a[8]);
      en.hp = Number(a[7]);
      en.netHp = en.hp;
      en.bossPhase = Number(a[9]) || 1;
    }
    this.byNet.forEach((en, id) => {
      if (!seen.has(id)) {
        this.byNet.delete(id);
        this.ctx.removePuppet(en);
      }
    });
    this.ctx.setLiving(list.length);
    const fx = m.fx as [string, number][] | undefined;
    if (fx) {
      for (const [by, id] of fx) {
        if (by === this.net.myId) continue;
        const en = this.byNet.get(id);
        if (en) this.spawnTracer(by, en.mesh.position, en.category === 'boss' ? 4 : 1.0);
      }
    }
  }

  // ───────────── 毎フレーム ─────────────
  update(delta: number) {
    if (this.disposed) return;
    const local = this.ctx.local();

    // 退出したプレイヤーのアバターを片付ける
    const ids = new Set(this.net.players.map((p) => p.id));
    this.remotes.forEach((r, id) => {
      if (!ids.has(id)) {
        this.ctx.notify(`${r.name} が退出しました`);
        this.disposeRemote(r);
        this.remotes.delete(id);
      }
    });

    // アバター補間
    const k = 1 - Math.exp(-delta * 14);
    this.remotes.forEach((r) => {
      const named = this.net.nameOf(r.id);
      if (named !== r.name) {
        r.name = named;
        r.labelKey = '';
      }
      r.color = this.colorFor(r.id);
      r.eye.lerp(r.target, k);
      r.yaw += shortestAngle(r.yaw, r.targetYaw) * k;
      r.group.position.set(r.eye.x, r.eye.y - EYE_Y, r.eye.z);
      r.group.rotation.y = r.yaw;
      r.gun.rotation.x = r.pitch;
      r.group.rotation.x = 0;
      // 自分のカメラに近すぎると視界を塞ぐので隠す
      r.group.visible = Math.hypot(r.eye.x - local.pos.x, r.eye.z - local.pos.z) > 1.3;
      r.body.rotation.z = r.ko ? Math.PI / 2 : 0;
      r.body.position.y = r.ko ? 0.35 : 1.0;
      r.group.children.forEach((c) => {
        if (c !== r.label && c !== r.body) c.visible = !r.ko;
      });
      this.drawLabel(r);
    });

    // ダウン → 近くの味方が一定時間そばにいると復帰
    if (local.ko) {
      let near = false;
      this.remotes.forEach((r) => {
        if (!r.ko && r.seen && Math.hypot(r.eye.x - local.pos.x, r.eye.z - local.pos.z) < 3.5) near = true;
      });
      this.reviveT = near ? this.reviveT + delta : 0;
      if (this.reviveT >= 4) {
        this.reviveT = 0;
        this.ctx.revive(0.4);
        this.ctx.notify('味方に救助された！');
      }
    } else {
      this.reviveT = 0;
    }
    this.lastKo = local.ko;

    // トレーサー
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.life -= delta;
      (t.line.material as THREE.LineBasicMaterial).opacity = Math.max(0, t.life / 0.14);
      if (t.life <= 0) {
        this.ctx.scene.remove(t.line);
        t.line.geometry.dispose();
        (t.line.material as THREE.Material).dispose();
        this.tracers.splice(i, 1);
      }
    }

    // 自分の状態送信
    this.stateAcc += delta;
    if (this.stateAcc >= 1 / STATE_HZ) {
      this.stateAcc = 0;
      this.net.send(
        {
          t: 'ps',
          x: round2(local.pos.x), y: round2(local.pos.y), z: round2(local.pos.z),
          yaw: round2(local.yaw), pitch: round2(local.pitch),
          hp: Math.round(local.hp), mhp: Math.round(local.maxHp), ko: local.ko,
        },
        false,
      );
    }

    if (this.isHost) {
      this.snapAcc += delta;
      if (this.snapAcc >= 1 / SNAP_HZ) {
        this.snapAcc = 0;
        this.sendSnapshot();
      }
    } else {
      this.reportAcc += delta;
      if (this.reportAcc >= 1 / STATE_HZ) {
        this.reportAcc = 0;
        this.reportDamage();
      }
    }
  }

  private sendSnapshot() {
    if (this.net.peerCount === 0) return;
    const e: (string | number)[][] = [];
    const fx: [string, number][] = [];
    for (const en of this.ctx.enemies()) {
      if (en.isDead) continue;
      if (en.netId === undefined) en.netId = ++this.netSeq;
      const prev = en.netSnapHp ?? en.hp;
      if (en.hp < prev - 0.5) fx.push([en.lastDamager ?? HOST_ID, en.netId]);
      en.netSnapHp = en.hp;
      en.lastDamager = undefined;
      e.push([
        en.netId, en.typeId, en.name ?? '',
        round2(en.mesh.position.x), round2(en.mesh.position.y), round2(en.mesh.position.z), round2(en.mesh.rotation.y),
        Math.round(en.hp), Math.round(en.maxHp), en.bossPhase ?? 1,
      ]);
    }
    this.net.send({ t: 'es', n: ++this.snapSeq, e, fx: fx.slice(0, 12) }, false);
    // ホスト自身のダメージの弾道は、ゲストからも見えるようにここで描く
    for (const [by, id] of fx) {
      if (by === this.net.myId) continue;
      const en = this.ctx.enemies().find((x) => x.netId === id);
      if (en) this.spawnTracer(by, en.mesh.position, en.category === 'boss' ? 4 : 1.0);
    }
  }
  private snapSeq = 0;

  /** ゲスト: 人形の HP が減った分を、ホストへダメージとして報告する */
  private reportDamage() {
    const list: number[][] = [];
    this.byNet.forEach((en, id) => {
      const base = en.netHp ?? en.hp;
      const d = base - en.hp;
      if (d >= 0.5) {
        list.push([id, Math.round(d)]);
        en.netHp = en.hp;
      }
    });
    if (list.length) this.net.send({ t: 'dmg', l: list });
  }

  /** 人形の位置・向きをスナップショットへ追従させる */
  stepPuppet(en: CoopEnemy, delta: number) {
    const p = en.netPos;
    if (!p) return;
    const m = en.mesh;
    const dist = Math.hypot(p.x - m.position.x, p.z - m.position.z);
    if (dist > 8) {
      m.position.set(p.x, p.y, p.z);
      m.rotation.y = p.ry;
      return;
    }
    const k = 1 - Math.exp(-delta * 16);
    m.position.x += (p.x - m.position.x) * k;
    m.position.y += (p.y - m.position.y) * k;
    m.position.z += (p.z - m.position.z) * k;
    m.rotation.y += shortestAngle(m.rotation.y, p.ry) * k;
  }

  // ───────────── アバター ─────────────
  private makeRemote(id: string): Remote {
    const color = this.colorFor(id);
    const col = new THREE.Color(color);
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.6, roughness: 0.4, emissive: col, emissiveIntensity: 0.18 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.8, 4, 10), bodyMat);
    body.position.y = 1.0;
    group.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.5, roughness: 0.4 }));
    head.position.y = 1.62;
    group.add(head);
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.09, 0.12), new THREE.MeshBasicMaterial({ color: col }));
    visor.position.set(0, 1.64, -0.17);
    group.add(visor);
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.5, 0.2), new THREE.MeshStandardMaterial({ color: 0x0f172a, emissive: col, emissiveIntensity: 0.25 }));
    pack.position.set(0, 1.1, 0.3);
    group.add(pack);
    const gun = new THREE.Group();
    gun.position.set(0.32, 1.3, -0.1);
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.7), new THREE.MeshStandardMaterial({ color: 0x0f172a, emissive: col, emissiveIntensity: 0.4 }));
    barrel.position.z = -0.35;
    gun.add(barrel);
    group.add(gun);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.62, 28), new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide, transparent: true, opacity: 0.7 }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.05;
    group.add(ring);

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const labelCtx = canvas.getContext('2d')!;
    const labelTex = new THREE.CanvasTexture(canvas);
    const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex, transparent: true, depthTest: false }));
    label.scale.set(2.2, 0.55, 1);
    label.position.y = 2.35;
    label.renderOrder = 999;
    group.add(label);

    this.ctx.scene.add(group);
    return {
      id, name: this.net.nameOf(id), color,
      eye: new THREE.Vector3(0, EYE_Y, 0), target: new THREE.Vector3(0, EYE_Y, 0),
      yaw: 0, targetYaw: 0, pitch: 0, hp: 100, maxHp: 100, ko: false, seen: false,
      group, gun, body, label, labelCtx, labelTex, labelKey: '',
    };
  }

  private drawLabel(r: Remote) {
    const pct = r.maxHp > 0 ? Math.max(0, Math.min(1, r.hp / r.maxHp)) : 0;
    const key = `${r.name}|${Math.round(pct * 20)}|${r.ko}|${r.color}`;
    if (key === r.labelKey) return;
    r.labelKey = key;
    const c = r.labelCtx;
    c.clearRect(0, 0, 256, 64);
    c.fillStyle = 'rgba(2,6,23,0.65)';
    c.fillRect(8, 6, 240, 52);
    c.fillStyle = r.color;
    c.font = 'bold 24px monospace';
    c.textAlign = 'center';
    c.fillText(r.ko ? `${r.name} [DOWN]` : r.name, 128, 32);
    c.fillStyle = '#1e293b';
    c.fillRect(24, 42, 208, 8);
    c.fillStyle = r.ko ? '#64748b' : pct > 0.35 ? '#34d399' : '#fb7185';
    c.fillRect(24, 42, 208 * pct, 8);
    r.labelTex.needsUpdate = true;
  }

  private spawnTracer(by: string, to: THREE.Vector3, height: number) {
    const r = by === this.net.myId ? null : this.remotes.get(by);
    if (!r || !r.seen || this.tracers.length > 24) return;
    const from = new THREE.Vector3(r.eye.x, r.eye.y - 0.4, r.eye.z);
    const end = new THREE.Vector3(to.x, to.y + height, to.z);
    const geo = new THREE.BufferGeometry().setFromPoints([from, end]);
    const mat = new THREE.LineBasicMaterial({ color: new THREE.Color(r.color), transparent: true, opacity: 1 });
    const line = new THREE.Line(geo, mat);
    this.ctx.scene.add(line);
    this.tracers.push({ line, life: 0.14 });
  }

  private disposeRemote(r: Remote) {
    this.ctx.scene.remove(r.group);
    r.group.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.Sprite) {
        (o as THREE.Mesh).geometry?.dispose?.();
        const mat = (o as THREE.Mesh).material as THREE.Material | THREE.Material[];
        (Array.isArray(mat) ? mat : [mat]).forEach((m) => m.dispose());
      }
    });
    r.labelTex.dispose();
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.off();
    this.remotes.forEach((r) => this.disposeRemote(r));
    this.remotes.clear();
    this.tracers.forEach((t) => {
      this.ctx.scene.remove(t.line);
      t.line.geometry.dispose();
      (t.line.material as THREE.Material).dispose();
    });
    this.tracers = [];
    this.byNet.clear();
  }
}
