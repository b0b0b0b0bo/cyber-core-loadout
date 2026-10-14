import * as THREE from 'three';
import type { EnemyRig } from './enemyAnimation';
import { CombatHazards, HurtFn, yawTo } from './combatHazards';
import { eliteEmitterWorld } from './eliteEnemyModels';

/**
 * Behaviour for the elite roster (see eliteEnemyModels.ts). Each type runs its own little state machine,
 * writes an action cue into its rig (`rig.act`) for the dedicated animation, and attacks through the
 * shared hazard / beam system so every dangerous move has a readable telegraph.
 */

/** Structural view of the battle scene's enemy instance (only what the AI needs). */
export interface CombatEnemy {
  mesh: THREE.Group;
  typeId: string;
  category: string;
  hp: number;
  maxHp: number;
  speed: number;
  baseSpeed: number;
  damage: number;
  isDead: boolean;
  velocity: THREE.Vector3;
  aiPattern: string;
  patternTimer: number;
  actionSubTimer: number;
  strafeSign: number;
  attackCooldown: number;
  shootCooldown?: number;
  groundRingMesh?: THREE.Mesh;
  overheadGroup?: THREE.Group;
  /** vertical offset applied after ground snapping (burrowing, leaping) */
  airY?: number;
  /** no melee contact damage while set */
  noContact?: boolean;
  /** skip the player stand-off push while set */
  ignoreStandoff?: boolean;
  /** face this yaw instead of the player */
  faceAngle?: number;
  /** a scene object owned by the enemy (tethers etc.), removed when it dies */
  auxMesh?: THREE.Object3D;
  /** free-form AI memory */
  ai?: any;
  // boss-only
  bossKind?: string;
  bossPhase?: number;
  bossSpin?: number;
  bossState?: number;
}

export interface EnemyBulletSpec {
  from: THREE.Vector3;
  dir: THREE.Vector3;
  speed: number;
  damage: number;
  color: number;
  size: number;
  radius: number;
  life: number;
  mesh?: THREE.Object3D;
  boomerang?: { owner: CombatEnemy; out: number; curve: number; onDone?: () => void };
}

export interface CombatCtx {
  scene: THREE.Scene;
  time: number;
  delta: number;
  /** player eye position */
  player: THREE.Vector3;
  playerYaw: number;
  enemies: CombatEnemy[];
  hazards: CombatHazards;
  hurt: HurtFn;
  fireBullet: (spec: EnemyBulletSpec) => void;
  spawnMinion: (type: string, at: THREE.Vector3, owner?: CombatEnemy) => CombatEnemy | null;
  sparks: (pos: THREE.Vector3, color: string | number, count?: number) => void;
  text: (text: string, color: string) => void;
  announce: (text: string) => void;
  shake: (amp: number, dur: number) => void;
  /** add (ax, az) m/s to the player's horizontal velocity */
  pushPlayer: (ax: number, az: number) => void;
  /** scale the player's move speed by `mult` for the next `dur` seconds (time-dilation fields) */
  slowPlayer?: (mult: number, dur: number) => void;
  /** true if (x, z) is inside / too close to a cover box or outside the arena */
  isBlocked: (x: number, z: number, pad: number) => boolean;
  sfx: { shot: () => void; heavy: () => void; boom: () => void; dash: () => void; sweep: () => void; scan: () => void };
}

const _v = new THREE.Vector3();
const _w = new THREE.Vector3();
const _side = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

export const rigOf = (e: CombatEnemy) => e.mesh.userData.enemyRig as EnemyRig | undefined;
export const setAct = (e: CombatEnemy, name: string, k: number) => {
  const r = rigOf(e);
  if (r) {
    r.act.name = name;
    r.act.k = Math.max(0, Math.min(1, k));
  }
};

/** Steer: approach/retreat to keep `lo..hi` metres and strafe sideways. */
function keepRange(e: CombatEnemy, c: CombatCtx, dist: number, lo: number, hi: number, strafe: number, accel = 2.6) {
  _v.set(c.player.x - e.mesh.position.x, 0, c.player.z - e.mesh.position.z);
  if (_v.lengthSq() < 1e-6) _v.set(1, 0, 0);
  _v.normalize();
  if (dist > hi) e.velocity.addScaledVector(_v, e.speed * c.delta * accel);
  else if (dist < lo) e.velocity.addScaledVector(_v, -e.speed * c.delta * accel);
  _side.crossVectors(_v, _up).normalize();
  e.velocity.addScaledVector(_side, e.strafeSign * e.speed * c.delta * strafe);
}

const toPlayerDir = (e: CombatEnemy, c: CombatCtx, out: THREE.Vector3) => out.set(c.player.x - e.mesh.position.x, 0, c.player.z - e.mesh.position.z).normalize();

export const isEliteCategory = (cat: string) => cat === 'mender' || cat === 'wyrm' || cat === 'jester' || cat === 'carrier' || cat === 'lancer';
export const isFlyingCategory = (cat: string) => cat === 'drone' || cat === 'mender' || cat === 'carrier' || cat === 'spotter';

// ───────────────────────── HALO MENDER ─────────────────────────
function tetherMesh(scene: THREE.Scene): THREE.Group {
  const g = new THREE.Group();
  const outerGeo = new THREE.CylinderGeometry(0.16, 0.16, 1, 10, 1, true);
  outerGeo.translate(0, 0.5, 0);
  const coreGeo = new THREE.CylinderGeometry(0.045, 0.045, 1, 6, 1, true);
  coreGeo.translate(0, 0.5, 0);
  g.add(new THREE.Mesh(outerGeo, new THREE.MeshBasicMaterial({ color: 0x4ade80, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false })));
  g.add(new THREE.Mesh(coreGeo, new THREE.MeshBasicMaterial({ color: 0xf0fdf4, transparent: true, opacity: 0.9 })));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.05, 6, 32), new THREE.MeshBasicMaterial({ color: 0x86efac, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
  ring.name = 'ring';
  scene.add(ring);
  g.userData.ring = ring;
  scene.add(g);
  return g;
}

function updateMender(e: CombatEnemy, c: CombatCtx, dist: number) {
  const M = (e.ai ??= { castT: -1, castCd: 2.5, sanctumCd: 6, sanctumT: -1, seed: Math.random() * 10 });
  e.noContact = true;
  e.mesh.position.y = 3.7 + Math.sin(c.time * 1.8 + M.seed) * 0.3;
  M.castCd -= c.delta;
  M.sanctumCd -= c.delta;

  // most damaged ally in range
  let target: CombatEnemy | null = null;
  let worst = 0.96;
  let wounded = 0;
  for (const o of c.enemies) {
    if (o === e || o.isDead || o.category === 'boss' || o.typeId === 'mender') continue;
    const d = o.mesh.position.distanceTo(e.mesh.position);
    if (d > 46) continue; // menders cross the arena to reach wounded allies
    const ratio = o.hp / o.maxHp;
    if (ratio < 0.9 && d < 11) wounded++;
    if (ratio < worst) {
      worst = ratio;
      target = o;
    }
  }

  let tethered = false;
  /** heal beam to the chosen ally (works while repositioning or retreating) */
  const tether = (target: CombatEnemy) => {
    const td = target.mesh.position.distanceTo(e.mesh.position);
    if (td > 17) return false;
    target.hp = Math.min(target.maxHp, target.hp + target.maxHp * 0.075 * c.delta);
    if (!e.auxMesh) e.auxMesh = tetherMesh(c.scene);
    const t = e.auxMesh;
    t.visible = true;
    eliteEmitterWorld(e.mesh, _v);
    _w.copy(target.mesh.position).setY(target.mesh.position.y + (target.category === 'drone' ? 0 : 1.0));
    t.position.copy(_v);
    const dir = _w.clone().sub(_v);
    const len = dir.length();
    t.scale.set(1 + Math.sin(c.time * 30) * 0.15, len, 1 + Math.sin(c.time * 30) * 0.15);
    t.quaternion.setFromUnitVectors(_up, dir.normalize());
    const ring = t.userData.ring as THREE.Mesh;
    ring.visible = true;
    ring.position.set(target.mesh.position.x, 0.12, target.mesh.position.z);
    ring.rotation.x = Math.PI / 2;
    ring.scale.setScalar(1 + 0.15 * Math.sin(c.time * 8));
    if (Math.random() < c.delta * 6) c.sparks(_w, '#4ade80', 3);
    return true;
  };
  if (M.sanctumT >= 0) {
    // REPAIR FIELD: hover in place, wings flared, pulse heals everything nearby
    M.sanctumT += c.delta;
    setAct(e, 'sanctum', Math.min(1, M.sanctumT / 0.7));
    e.velocity.multiplyScalar(0.8);
    if (M.sanctumT >= 0.7 && !M.sanctumFired) {
      M.sanctumFired = true;
      c.hazards.ringFx(e.mesh.position.x, e.mesh.position.z, 11, 0x4ade80, 0.7);
      c.hazards.columnFx(e.mesh.position.x, e.mesh.position.z, 1.2, 6, 0x86efac, 0.6);
      for (const o of c.enemies) {
        if (o.isDead || o.category === 'boss' || o === e) continue;
        if (o.mesh.position.distanceTo(e.mesh.position) <= 11.5) {
          o.hp = Math.min(o.maxHp, o.hp + o.maxHp * 0.16);
          c.sparks(o.mesh.position.clone().add(new THREE.Vector3(0, 1, 0)), '#4ade80', 10);
        }
      }
      c.text('REPAIR FIELD', '#4ade80');
      c.sfx.scan();
    }
    if (M.sanctumT >= 1.2) {
      M.sanctumT = -1;
      M.sanctumFired = false;
      M.sanctumCd = 7.5;
    }
  } else if (dist < 6.5) {
    // too close: flee with wings folded back (still feeding the tether if an ally is in reach)
    toPlayerDir(e, c, _v);
    e.velocity.addScaledVector(_v, -e.speed * c.delta * 4.2);
    _side.crossVectors(_v, _up);
    e.velocity.addScaledVector(_side, e.strafeSign * e.speed * c.delta * 2.5);
    tethered = !!target && tether(target);
    setAct(e, tethered ? 'heal' : 'flee', 1);
  } else if (wounded >= 2 && M.sanctumCd <= 0) {
    M.sanctumT = 0;
  } else if (target) {
    // hover behind the ally (relative to the player) and tether it
    _w.copy(target.mesh.position).sub(c.player).setY(0).normalize().multiplyScalar(4).add(target.mesh.position);
    _v.set(_w.x - e.mesh.position.x, 0, _w.z - e.mesh.position.z);
    if (_v.length() > 1.5) e.velocity.addScaledVector(_v.normalize(), e.speed * c.delta * 3.2);
    tethered = tether(target);
    setAct(e, tethered ? 'heal' : 'idle', tethered ? Math.min(1, (rigOf(e)?.act.k ?? 0) + c.delta * 3) : 0);
  } else {
    keepRange(e, c, dist, 11, 16, 1.8);
    // seed orb volley
    if (M.castT >= 0) {
      M.castT += c.delta;
      setAct(e, 'cast', M.castT / 0.55);
      if (M.castT >= 0.55) {
        M.castT = -1;
        M.castCd = 2.8 + Math.random();
        eliteEmitterWorld(e.mesh, _v);
        for (let i = -1; i <= 1; i++) {
          const d = new THREE.Vector3().subVectors(c.player, _v).normalize();
          d.applyAxisAngle(_up, i * 0.14);
          c.fireBullet({ from: _v.clone(), dir: d, speed: 15, damage: Math.round(e.damage * 0.8), color: 0x86efac, size: 0.16, radius: 0.3, life: 3.4 });
        }
        c.sfx.shot();
      }
    } else {
      setAct(e, 'idle', 0);
      if (M.castCd <= 0 && dist < 26) M.castT = 0;
    }
  }
  if (!tethered && e.auxMesh) {
    e.auxMesh.visible = false;
    (e.auxMesh.userData.ring as THREE.Object3D).visible = false;
  }
}

// ───────────────────────── DUNE WYRM ─────────────────────────
function updateWyrm(e: CombatEnemy, c: CombatCtx, dist: number) {
  const W = (e.ai ??= { state: 'surface', t: 0, spitCd: 1.8, spitT: -1, cycle: 4.5 + Math.random() * 2 });
  W.t += c.delta;
  const setState = (s: string) => {
    W.state = s;
    W.t = 0;
  };
  const showRing = (v: boolean) => {
    if (e.groundRingMesh) e.groundRingMesh.visible = v;
  };
  switch (W.state) {
    case 'surface': {
      e.airY = 0;
      e.noContact = false;
      e.ignoreStandoff = false;
      showRing(true);
      keepRange(e, c, dist, 6, 12, 2.4 + Math.sin(c.time * 2) * 1.2, 2.8);
      W.spitCd -= c.delta;
      W.cycle -= c.delta;
      if (W.spitT >= 0) {
        W.spitT += c.delta;
        setAct(e, 'spit', W.spitT / 0.5);
        e.velocity.multiplyScalar(0.85);
        if (W.spitT >= 0.5) {
          W.spitT = -1;
          W.spitCd = 2.4 + Math.random() * 0.8;
          const from = e.mesh.position.clone().setY(2.4);
          for (let i = -2; i <= 2; i++) {
            const d = new THREE.Vector3().subVectors(c.player, from).normalize().applyAxisAngle(_up, i * 0.17);
            c.fireBullet({ from: from.clone(), dir: d, speed: 26, damage: Math.round(e.damage * 0.6), color: 0xf5deb3, size: 0.12, radius: 0.28, life: 2.6 });
          }
          c.sfx.shot();
        }
      } else {
        setAct(e, 'rear', 0.12);
        if (W.spitCd <= 0 && dist < 22) W.spitT = 0;
        else if (W.cycle <= 0 && dist < 28) setState('dive');
      }
      break;
    }
    case 'dive': {
      setAct(e, 'burrow', W.t / 0.75);
      e.velocity.multiplyScalar(0.6);
      if (W.t >= 0.75) {
        c.sparks(e.mesh.position.clone().setY(0.4), '#d6b37a', 18);
        c.hazards.ringFx(e.mesh.position.x, e.mesh.position.z, 3, 0xd6b37a, 0.5);
        c.sfx.dash();
        setState('tunnel');
      }
      break;
    }
    case 'tunnel': {
      setAct(e, 'tunnel', 1);
      e.airY = -9;
      e.noContact = true;
      e.ignoreStandoff = true;
      showRing(false);
      toPlayerDir(e, c, _v);
      e.velocity.addScaledVector(_v, e.speed * c.delta * 5.5);
      if (Math.random() < c.delta * 5) c.sparks(e.mesh.position.clone().setY(0.3), '#d6b37a', 4);
      if (W.t >= 2.4 || dist < 2.5) {
        e.velocity.set(0, 0, 0);
        W.mark = c.hazards.add({
          shape: 'circle',
          x: c.player.x,
          z: c.player.z,
          radius: 2.9,
          delay: 1.05,
          lockAt: 0.55,
          track: () => ({ x: c.player.x, z: c.player.z }),
          damage: Math.round(e.damage * 1.7),
          knockUp: 9,
          knockBack: 6,
          label: 'WYRM ERUPTION',
          color: 0xffa94d,
          fx: 'spikes',
          shake: 0.45,
          owner: e,
          onBurst: () => {
            if (e.isDead) return;
            W.erupted = true;
          },
        });
        setState('mark');
      }
      break;
    }
    case 'mark': {
      setAct(e, 'tunnel', 1);
      e.velocity.set(0, 0, 0);
      const h = W.mark;
      if (h) e.mesh.position.set(h.x, e.mesh.position.y, h.z);
      if (W.erupted || W.t > 1.4) {
        W.erupted = false;
        W.mark = null;
        e.airY = 0;
        e.noContact = false;
        showRing(true);
        c.sfx.boom();
        c.sparks(e.mesh.position.clone().setY(0.6), '#ffa94d', 22);
        setState('emerged');
      }
      break;
    }
    case 'emerged': {
      e.ignoreStandoff = W.t < 0.3;
      e.velocity.multiplyScalar(0.5);
      if (W.t < 0.3) setAct(e, 'erupt', W.t / 0.3);
      else setAct(e, 'rear', Math.max(0.15, 1 - (W.t - 0.3) / 2.2));
      if (W.t >= 0.75 && !W.ring) {
        // spine ring burst while reared
        W.ring = true;
        const from = e.mesh.position.clone().setY(3.0);
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2;
          c.fireBullet({ from: from.clone(), dir: new THREE.Vector3(Math.sin(a), -0.12, Math.cos(a)), speed: 17, damage: Math.round(e.damage * 0.55), color: 0xf5deb3, size: 0.13, radius: 0.3, life: 2.4 });
        }
        c.sfx.shot();
      }
      if (W.t >= 2.6) {
        W.ring = false;
        W.cycle = 5 + Math.random() * 2.5;
        setState('surface');
      }
      break;
    }
  }
}

// ───────────────────────── PHASE JESTER ─────────────────────────
function updateJester(e: CombatEnemy, c: CombatCtx, dist: number) {
  const J = (e.ai ??= { state: 'dance', t: 0, throws: 0, evadeCd: 0, side: 1, next: 1.2 + Math.random() * 0.6 });
  const rig = rigOf(e);
  const E = rig?.extras;
  J.t += c.delta;
  J.evadeCd -= c.delta;
  const setState = (s: string) => {
    J.state = s;
    J.t = 0;
  };
  if (J.state !== 'blink' && dist < 4.2 && J.evadeCd <= 0) {
    J.evadeCd = 3.5;
    setState('blink');
  }
  switch (J.state) {
    case 'dance': {
      e.noContact = false;
      setAct(e, 'idle', 0);
      keepRange(e, c, dist, 7, 11, 3.4 + Math.sin(c.time * 3.3) * 1.5, 3.0);
      if (J.t >= J.next) {
        const s = J.side as number;
        if (E?.held?.[s]) setState('throw');
        else if (E?.held?.[-s]) {
          J.side = -s;
          setState('throw');
        } else J.t = J.next - 0.3;
      }
      break;
    }
    case 'throw': {
      if (E) E.throwSide = J.side;
      setAct(e, 'throw', J.t / 0.78);
      e.velocity.multiplyScalar(0.8);
      if (J.t >= 0.56 && !J.released) {
        J.released = true;
        const s = J.side as number;
        if (E) E.held[s] = false;
        const ch = E?.chakrams?.[s] as THREE.Object3D | undefined;
        const from = ch ? ch.getWorldPosition(new THREE.Vector3()) : e.mesh.position.clone().setY(1.6);
        const dir = new THREE.Vector3().subVectors(c.player, from).normalize().applyAxisAngle(_up, -s * 0.5);
        const mesh = new THREE.Group();
        mesh.add(new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.05, 8, 28), new THREE.MeshBasicMaterial({ color: 0xf5f3ff })));
        mesh.add(new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.16, 8, 28), new THREE.MeshBasicMaterial({ color: 0xe879f9, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false })));
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          const sp = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.2, 4), new THREE.MeshBasicMaterial({ color: 0xf5f3ff }));
          sp.position.set(Math.cos(a) * 0.42, Math.sin(a) * 0.42, 0);
          sp.rotation.z = a - Math.PI / 2;
          mesh.add(sp);
        }
        mesh.rotation.x = Math.PI / 2;
        c.fireBullet({
          from,
          dir,
          speed: 21,
          damage: Math.round(e.damage * 1.1),
          color: 0xe879f9,
          size: 0.3,
          radius: 0.45,
          life: 3.6,
          mesh,
          boomerang: {
            owner: e,
            out: 0.75,
            curve: s * 1.25,
            onDone: () => {
              if (E) E.held[s] = true;
            },
          },
        });
        c.sfx.sweep();
      }
      if (J.t >= 0.78) {
        J.released = false;
        J.throws++;
        J.side = -J.side;
        J.next = 0.9 + Math.random() * 0.7;
        setState(J.throws >= 2 ? 'blink' : 'dance');
      }
      break;
    }
    case 'blink': {
      e.noContact = true;
      e.velocity.multiplyScalar(0.5);
      if (J.t < 0.3) setAct(e, 'blink', J.t / 0.3);
      else if (!J.ported) {
        J.ported = true;
        const old = e.mesh.position.clone();
        // reappear on a flank or behind the player
        let best: THREE.Vector3 | null = null;
        for (let i = 0; i < 8; i++) {
          const a = c.playerYaw + Math.PI + (Math.random() - 0.5) * 2.6;
          const r = 7 + Math.random() * 3;
          const x = c.player.x - Math.sin(a) * r;
          const z = c.player.z - Math.cos(a) * r;
          if (!c.isBlocked(x, z, 1.4)) {
            best = new THREE.Vector3(x, 0, z);
            break;
          }
        }
        if (best) {
          e.mesh.position.set(best.x, e.mesh.position.y, best.z);
          e.velocity.set(0, 0, 0);
        }
        c.hazards.columnFx(old.x, old.z, 0.7, 3.2, 0xe879f9, 0.5);
        c.hazards.ringFx(old.x, old.z, 2.2, 0xe879f9, 0.4);
        c.hazards.columnFx(e.mesh.position.x, e.mesh.position.z, 0.7, 3.2, 0x67e8f9, 0.5);
        c.sparks(e.mesh.position.clone().setY(1.2), '#f0abfc', 14);
        c.sfx.dash();
      } else {
        setAct(e, 'blink', 1 - (J.t - 0.3) / 0.25);
      }
      if (J.t >= 0.55) {
        J.ported = false;
        J.throws = 0;
        J.next = 0.5 + Math.random() * 0.4;
        setState('dance');
      }
      break;
    }
  }
}

// ───────────────────────── HIVE CARRIER ─────────────────────────
function updateCarrier(e: CombatEnemy, c: CombatCtx, dist: number) {
  const C = (e.ai ??= { state: 'drift', t: 0, birthCd: 3.0, spitCd: 2.2, spawned: 0, seed: Math.random() * 10 });
  e.noContact = true;
  e.mesh.position.y = 4.9 + Math.sin(c.time * 1.2 + C.seed) * 0.35;
  C.t += c.delta;
  C.birthCd -= c.delta;
  C.spitCd -= c.delta;
  const setState = (s: string) => {
    C.state = s;
    C.t = 0;
  };
  switch (C.state) {
    case 'drift': {
      setAct(e, 'idle', 0);
      keepRange(e, c, dist, 13, 20, 1.2, 2.0);
      const mine = c.enemies.filter((o) => !o.isDead && o.ai?.owner === e).length;
      if (C.birthCd <= 0 && mine < 4 && C.spawned < 10) setState('birth');
      else if (C.spitCd <= 0 && dist < 28) setState('spit');
      break;
    }
    case 'birth': {
      setAct(e, 'birth', C.t / 0.9);
      e.velocity.multiplyScalar(0.7);
      if (C.t >= 0.9 && !C.born) {
        C.born = true;
        for (const s of [-1, 1]) {
          _v.set(s * 0.9, 0, 0).applyQuaternion(e.mesh.quaternion).add(e.mesh.position).setY(0);
          if (c.spawnMinion('mite', _v.clone(), e)) C.spawned++;
          c.sparks(_v.clone().setY(1.5), '#bef264', 10);
        }
        c.hazards.ringFx(e.mesh.position.x, e.mesh.position.z, 2.5, 0xbef264, 0.45);
        c.sfx.heavy();
      }
      if (C.t >= 1.5) {
        C.born = false;
        C.birthCd = 6 + Math.random() * 1.5;
        setState('drift');
      }
      break;
    }
    case 'spit': {
      setAct(e, 'spit', C.t / 0.6);
      e.velocity.multiplyScalar(0.8);
      if (C.t >= 0.6 && !C.spat) {
        C.spat = true;
        const from = eliteEmitterWorld(e.mesh, new THREE.Vector3());
        const lead = new THREE.Vector3(c.player.x, 0, c.player.z);
        c.hazards.add({
          shape: 'circle',
          x: lead.x + (Math.random() - 0.5) * 1.5,
          z: lead.z + (Math.random() - 0.5) * 1.5,
          radius: 2.7,
          delay: 1.05,
          damage: Math.round(e.damage * 1.6),
          knockUp: 3,
          label: 'ACID GLOB',
          color: 0xa3e635,
          fx: 'blast',
          drop: { from, color: 0xa3e635, size: 0.42, arc: 5 },
          shake: 0.2,
        });
        c.sfx.shot();
      }
      if (C.t >= 0.95) {
        C.spat = false;
        C.spitCd = 3.2 + Math.random();
        setState('drift');
      }
      break;
    }
  }
}

// ───────────────────────── MANTIS LANCER ─────────────────────────
function updateLancer(e: CombatEnemy, c: CombatCtx, dist: number) {
  const L = (e.ai ??= { state: 'stalk', t: 0, beamCd: 2.2 + Math.random() * 1.5, slashCd: 0.5 });
  L.t += c.delta;
  L.beamCd -= c.delta;
  L.slashCd -= c.delta;
  const setState = (s: string) => {
    L.state = s;
    L.t = 0;
  };
  const WARN = 1.3;
  const LIFE = 1.5;
  switch (L.state) {
    case 'stalk': {
      e.faceAngle = undefined;
      setAct(e, 'idle', 0);
      keepRange(e, c, dist, 8.5, 14, 1.8, 2.6);
      if (dist < 5.8 && L.slashCd <= 0) setState('slash');
      else if (L.beamCd <= 0 && dist < 24) setState('beam');
      break;
    }
    case 'beam': {
      e.velocity.multiplyScalar(0.25);
      if (!L.fired) {
        L.fired = true;
        const sign = Math.random() < 0.5 ? 1 : -1;
        const arc = 2.0;
        const a0 = yawTo(e.mesh.position.x, e.mesh.position.z, c.player.x, c.player.z);
        const start = a0 - (sign * arc) / 2;
        L.lockYaw = a0;
        c.hazards.addBeam({
          origin: () => {
            if (e.isDead) return null;
            // emitted from between the blade arms, just in front of the body
            return new THREE.Vector3(e.mesh.position.x + Math.sin(L.lockYaw) * 1.4, 0, e.mesh.position.z + Math.cos(L.lockYaw) * 1.4);
          },
          angleAt: (t) => (t < WARN ? start : start + sign * arc * Math.min(1, (t - WARN) / LIFE)),
          length: 26,
          width: 0.55,
          height: 0.75,
          warn: WARN,
          life: LIFE,
          damage: Math.round(e.damage * 0.9),
          tick: 0.35,
          color: 0xff2d55,
          jumpable: true,
          label: 'MANTIS BEAM',
          owner: e,
        });
        c.sfx.scan();
      }
      e.faceAngle = L.lockYaw;
      if (L.t < WARN) setAct(e, 'charge', L.t / WARN);
      else setAct(e, 'fire', 1);
      if (L.t >= WARN && !L.heard) {
        L.heard = true;
        c.sfx.heavy();
      }
      if (L.t >= WARN + LIFE + 0.45) {
        L.fired = false;
        L.heard = false;
        L.beamCd = 5 + Math.random() * 2;
        setState('stalk');
      }
      break;
    }
    case 'slash': {
      e.velocity.multiplyScalar(0.7);
      setAct(e, 'slash', L.t / 0.72);
      if (!L.slashH) {
        L.slashH = c.hazards.add({
          shape: 'sector',
          x: e.mesh.position.x,
          z: e.mesh.position.z,
          radius: 5.6,
          arc: 2.1,
          angle: yawTo(e.mesh.position.x, e.mesh.position.z, c.player.x, c.player.z),
          track: () => ({ x: e.mesh.position.x, z: e.mesh.position.z, angle: yawTo(e.mesh.position.x, e.mesh.position.z, c.player.x, c.player.z) }),
          lockAt: 0.16,
          delay: 0.5,
          damage: Math.round(e.damage * 1.4),
          knockBack: 9,
          label: 'SCYTHE SLASH',
          color: 0xff2d55,
          fx: 'slash',
          owner: e,
        });
      }
      if (L.t >= 0.5 && !L.lunged) {
        L.lunged = true;
        toPlayerDir(e, c, _v);
        e.velocity.addScaledVector(_v, 9);
        c.sfx.sweep();
      }
      if (L.t >= 0.95) {
        L.slashH = null;
        L.lunged = false;
        L.slashCd = 2.6;
        setState('stalk');
      }
      break;
    }
  }
}

/** Runs one frame of elite AI. `dist` = horizontal distance to the player. */
export function updateEliteEnemy(e: CombatEnemy, c: CombatCtx, dist: number): void {
  switch (e.category) {
    case 'mender': updateMender(e, c, dist); break;
    case 'wyrm': updateWyrm(e, c, dist); break;
    case 'jester': updateJester(e, c, dist); break;
    case 'carrier': updateCarrier(e, c, dist); break;
    case 'lancer': updateLancer(e, c, dist); break;
  }
}

/** Remove scene objects an enemy owns (tether beams etc.). */
export function disposeEnemyAux(e: CombatEnemy, scene: THREE.Scene): void {
  const aux = e.auxMesh;
  if (!aux) return;
  const extra = aux.userData.ring as THREE.Object3D | undefined;
  [aux, extra].forEach((o) => {
    if (!o) return;
    scene.remove(o);
    o.traverse((ch) => {
      const m = ch as THREE.Mesh;
      m.geometry?.dispose();
      (m.material as THREE.Material | undefined)?.dispose?.();
    });
  });
  e.auxMesh = undefined;
}
