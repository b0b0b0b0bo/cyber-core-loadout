import * as THREE from 'three';
import type { CombatCtx, CombatEnemy } from './eliteEnemyAI';
import { setAct, rigOf } from './eliteEnemyAI';
import { yawTo } from './combatHazards';
import { apexEmitterWorld } from './apexEnemyModels';

/**
 * Behaviour for the APEX roster (see apexEnemyModels.ts).
 *
 * Every type runs its own small state machine and writes an action cue (`setAct`) for its animator.
 * Dangerous moves always go through the telegraphed hazard / beam system. Mechanics that change how
 * damage lands (frontal shield, reflecting stance, time rewind) are applied in `apexDamageGate`, which
 * the battle scene calls every frame BEFORE it checks for death — it compares the HP with last frame,
 * so it works for every damage source without touching the many places that deal damage.
 */

const _v = new THREE.Vector3();
const _w = new THREE.Vector3();
const _side = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

export const APEX_CATEGORIES = ['aegis', 'ronin', 'pyro', 'weaver', 'spotter', 'splitter', 'chrono', 'mirage', 'magnet', 'berserker', 'pylon', 'mirage_echo'] as const;
export const isApexCategory = (cat: string) => (APEX_CATEGORIES as readonly string[]).includes(cat);

const wrapPi = (a: number) => {
  a = (a + Math.PI) % (Math.PI * 2);
  if (a < 0) a += Math.PI * 2;
  return a - Math.PI;
};
const turnToward = (cur: number, target: number, maxStep: number) => {
  const d = wrapPi(target - cur);
  return cur + Math.max(-maxStep, Math.min(maxStep, d));
};
const yawOf = (e: CombatEnemy, c: CombatCtx) => yawTo(e.mesh.position.x, e.mesh.position.z, c.player.x, c.player.z);

function toPlayerDir(e: CombatEnemy, c: CombatCtx, out: THREE.Vector3) {
  out.set(c.player.x - e.mesh.position.x, 0, c.player.z - e.mesh.position.z);
  if (out.lengthSq() < 1e-6) out.set(1, 0, 0);
  return out.normalize();
}

/** Steer: approach/retreat to keep `lo..hi` metres and strafe sideways. */
function keepRange(e: CombatEnemy, c: CombatCtx, dist: number, lo: number, hi: number, strafe: number, accel = 2.6) {
  toPlayerDir(e, c, _v);
  if (dist > hi) e.velocity.addScaledVector(_v, e.speed * c.delta * accel);
  else if (dist < lo) e.velocity.addScaledVector(_v, -e.speed * c.delta * accel);
  _side.crossVectors(_v, _up).normalize();
  e.velocity.addScaledVector(_side, e.strafeSign * e.speed * c.delta * strafe);
}

/** Ring of a few bolts aimed at the player. */
function volley(e: CombatEnemy, c: CombatCtx, n: number, spread: number, speed: number, dmgMul: number, color: number, size = 0.16) {
  const from = apexEmitterWorld(e.mesh, new THREE.Vector3());
  for (let i = 0; i < n; i++) {
    const off = n === 1 ? 0 : (i / (n - 1) - 0.5) * spread;
    const d = new THREE.Vector3(c.player.x, c.player.y - 0.4, c.player.z).sub(from).normalize().applyAxisAngle(_up, off);
    c.fireBullet({ from: from.clone(), dir: d, speed, damage: Math.round(e.damage * dmgMul), color, size, radius: size * 1.8, life: 3.6 });
  }
  c.sfx.shot();
}

// ───────────────────────── AEGIS WARDEN ─────────────────────────
function updateAegis(e: CombatEnemy, c: CombatCtx, dist: number) {
  const A = (e.ai ??= { state: 'advance', t: 0, yaw: yawOf(e, c), bashCd: 2.5 + Math.random() * 1.5 });
  A.t += c.delta;
  A.bashCd -= c.delta;
  const set = (s: string) => {
    A.state = s;
    A.t = 0;
  };
  // the tower shield is heavy: the warden turns slowly (circle-strafe to reach its back)
  if (A.state !== 'windup' && A.state !== 'bash') A.yaw = turnToward(A.yaw, yawOf(e, c), 1.05 * c.delta);
  e.faceAngle = A.yaw;
  switch (A.state) {
    case 'advance': {
      e.ignoreStandoff = false;
      keepRange(e, c, dist, 3.6, 6, 0.5, 2.2);
      setAct(e, 'brace', 0.35);
      if (A.bashCd <= 0 && dist < 14) {
        set('windup');
        A.yaw = yawOf(e, c);
        c.hazards.add({
          shape: 'line',
          x: e.mesh.position.x,
          z: e.mesh.position.z,
          angle: A.yaw,
          length: 13,
          radius: 1.35,
          delay: 0.85,
          damage: Math.round(e.damage * 1.6),
          knockBack: 16,
          label: 'SHIELD BASH',
          color: 0x67e8f9,
          fx: 'slash',
          owner: e,
        });
        c.sfx.scan();
      }
      break;
    }
    case 'windup': {
      e.velocity.multiplyScalar(0.6);
      setAct(e, 'brace', 1);
      if (A.t >= 0.85) {
        set('bash');
        c.sfx.dash();
      }
      break;
    }
    case 'bash': {
      setAct(e, 'bash', 1);
      e.ignoreStandoff = true;
      e.velocity.set(Math.sin(A.yaw) * 24, 0, Math.cos(A.yaw) * 24);
      if (Math.random() < c.delta * 20) c.sparks(e.mesh.position.clone().setY(0.4), '#67e8f9', 3);
      if (A.t >= 0.5) {
        set('recover');
        e.velocity.multiplyScalar(0.2);
        c.hazards.ringFx(e.mesh.position.x, e.mesh.position.z, 3, 0x67e8f9, 0.4);
      }
      break;
    }
    case 'recover': {
      e.ignoreStandoff = false;
      setAct(e, 'brace', 0.15);
      e.velocity.multiplyScalar(0.8);
      if (A.t >= 0.8) {
        A.bashCd = 4.5 + Math.random() * 2;
        set('advance');
      }
      break;
    }
  }
}

// ───────────────────────── RONIN EDGE ─────────────────────────
function updateRonin(e: CombatEnemy, c: CombatCtx, dist: number) {
  const R = (e.ai ??= { state: 'stalk', t: 0, dashCd: 2 + Math.random() * 1.5, deflectCd: 2 + Math.random() * 2, shotAt: -9 });
  R.t += c.delta;
  R.dashCd -= c.delta;
  R.deflectCd -= c.delta;
  const set = (s: string) => {
    R.state = s;
    R.t = 0;
  };
  switch (R.state) {
    case 'stalk': {
      e.faceAngle = undefined;
      e.noContact = false;
      e.ignoreStandoff = false;
      setAct(e, 'idle', 0);
      keepRange(e, c, dist, 6, 10, 2.8 + Math.sin(c.time * 2.3) * 1.2, 3.2);
      // under fire from range: raise the spinning-blade stance
      if (R.deflectCd <= 0 && c.time - R.shotAt < 0.4 && dist > 5) {
        set('deflect');
        c.text('DEFLECT STANCE', '#fda4af');
        c.sfx.sweep();
      } else if (R.dashCd <= 0 && dist < 17) {
        set('stance');
        R.yaw = yawOf(e, c);
        R.len = Math.min(22, dist + 5);
        R.mark = c.hazards.add({
          shape: 'line',
          x: e.mesh.position.x,
          z: e.mesh.position.z,
          angle: R.yaw,
          length: R.len,
          radius: 1.05,
          delay: 0.8,
          lockAt: 0.28,
          track: () => {
            if (e.isDead) return null;
            R.yaw = yawOf(e, c);
            R.len = Math.min(22, Math.hypot(c.player.x - e.mesh.position.x, c.player.z - e.mesh.position.z) + 5);
            return { x: e.mesh.position.x, z: e.mesh.position.z, angle: R.yaw };
          },
          damage: Math.round(e.damage * 1.9),
          knockBack: 8,
          label: 'IAIDO',
          color: 0xfda4af,
          fx: 'slash',
          owner: e,
        });
        c.sfx.scan();
      }
      break;
    }
    case 'stance': {
      e.velocity.multiplyScalar(0.5);
      e.faceAngle = R.yaw;
      setAct(e, 'stance', Math.min(1, R.t / 0.8));
      if (R.t >= 0.8) {
        set('dash');
        R.from = e.mesh.position.clone();
        c.sfx.dash();
      }
      break;
    }
    case 'dash': {
      // a blink-fast draw cut along the locked lane
      e.noContact = true;
      e.ignoreStandoff = true;
      setAct(e, 'dash', 1);
      const k = Math.min(1, R.t / 0.16);
      const len = R.len as number;
      const from = R.from as THREE.Vector3;
      const tx = from.x + Math.sin(R.yaw) * len;
      const tz = from.z + Math.cos(R.yaw) * len;
      if (!c.isBlocked(from.x + Math.sin(R.yaw) * len * k, from.z + Math.cos(R.yaw) * len * k, 0.6)) {
        e.mesh.position.x = from.x + (tx - from.x) * k;
        e.mesh.position.z = from.z + (tz - from.z) * k;
      }
      e.velocity.set(0, 0, 0);
      if (Math.random() < 0.7) c.sparks(e.mesh.position.clone().setY(1.2), '#fda4af', 4);
      if (R.t >= 0.16) {
        set('recover');
        c.sfx.sweep();
      }
      break;
    }
    case 'recover': {
      // zanshin: holds the follow-through — the window to punish
      e.noContact = false;
      e.ignoreStandoff = false;
      setAct(e, 'stance', Math.max(0, 0.6 - R.t));
      e.velocity.multiplyScalar(0.7);
      if (R.t >= 0.9) {
        R.dashCd = 3 + Math.random() * 1.5;
        set('stalk');
      }
      break;
    }
    case 'deflect': {
      e.faceAngle = undefined;
      setAct(e, 'deflect', 1);
      e.velocity.multiplyScalar(0.5);
      if (R.t >= 1.7) {
        R.deflectCd = 5 + Math.random() * 2;
        set('stalk');
      }
      break;
    }
  }
}

// ───────────────────────── CINDER MAW ─────────────────────────
function updatePyro(e: CombatEnemy, c: CombatCtx, dist: number) {
  const P = (e.ai ??= { state: 'approach', t: 0, sprayCd: 1.2 + Math.random(), tick: 0 });
  P.t += c.delta;
  P.sprayCd -= c.delta;
  const set = (s: string) => {
    P.state = s;
    P.t = 0;
  };
  switch (P.state) {
    case 'approach': {
      e.faceAngle = undefined;
      setAct(e, 'idle', 0);
      keepRange(e, c, dist, 4.5, 7.5, 1.0, 2.6);
      if (P.sprayCd <= 0 && dist < 11) {
        set('ignite');
        P.yaw = yawOf(e, c);
        c.hazards.add({
          shape: 'sector',
          x: e.mesh.position.x,
          z: e.mesh.position.z,
          angle: P.yaw,
          arc: 1.0,
          radius: 9.5,
          delay: 0.6,
          damage: 0,
          label: 'FLAME',
          color: 0xff7a1a,
          fx: 'none',
          owner: e,
        });
        c.sfx.scan();
      }
      break;
    }
    case 'ignite': {
      e.velocity.multiplyScalar(0.6);
      e.faceAngle = P.yaw;
      setAct(e, 'ignite', P.t / 0.6);
      if (P.t >= 0.6) {
        set('spray');
        c.sfx.heavy();
      }
      break;
    }
    case 'spray': {
      // the cone sweeps slowly after the player; each pulse is a short telegraphed burn
      e.velocity.multiplyScalar(0.7);
      P.yaw = turnToward(P.yaw, yawOf(e, c), 0.9 * c.delta);
      e.faceAngle = P.yaw;
      setAct(e, 'spray', 1);
      P.tick -= c.delta;
      if (P.tick <= 0) {
        P.tick = 0.22;
        c.hazards.add({
          shape: 'sector',
          x: e.mesh.position.x,
          z: e.mesh.position.z,
          angle: P.yaw,
          arc: 0.9,
          radius: 9,
          delay: 0.2,
          damage: Math.round(e.damage * 0.45),
          label: 'BURN',
          color: 0xff7a1a,
          fx: 'none',
          owner: e,
        });
        for (let i = 0; i < 3; i++) {
          const r = 2 + Math.random() * 6.5;
          const a = P.yaw + (Math.random() - 0.5) * 0.8;
          c.sparks(new THREE.Vector3(e.mesh.position.x + Math.sin(a) * r, 1.0 + Math.random() * 0.6, e.mesh.position.z + Math.cos(a) * r), Math.random() < 0.5 ? '#ff7a1a' : '#ffd27a', 4);
        }
      }
      if (P.t >= 1.7) {
        // the spilled fuel ignites: burning patches around the player
        for (let i = 0; i < 2; i++) {
          const a = Math.random() * Math.PI * 2;
          const r = i === 0 ? 0 : 3 + Math.random() * 2;
          c.hazards.add({
            shape: 'circle',
            x: c.player.x + Math.cos(a) * r,
            z: c.player.z + Math.sin(a) * r,
            radius: 2.3,
            delay: 1.0 + i * 0.25,
            damage: Math.round(e.damage * 0.9),
            label: 'FIRE PATCH',
            color: 0xff5a1f,
            fx: 'pillar',
            drop: { from: apexEmitterWorld(e.mesh, new THREE.Vector3()), color: 0xff7a1a, size: 0.3, arc: 3 },
          });
        }
        P.sprayCd = 4.2 + Math.random() * 1.5;
        set('approach');
      }
      break;
    }
  }
}

// ───────────────────────── ARC WEAVER (+ pylons) ─────────────────────────
function updateWeaver(e: CombatEnemy, c: CombatCtx, dist: number) {
  const W = (e.ai ??= { state: 'roam', t: 0, plantCd: 1.2, fenceCd: 2.5, boltCd: 2 + Math.random(), pylons: [] as CombatEnemy[] });
  W.t += c.delta;
  W.plantCd -= c.delta;
  W.fenceCd -= c.delta;
  W.boltCd -= c.delta;
  W.pylons = (W.pylons as CombatEnemy[]).filter((p) => !p.isDead);
  const set = (s: string) => {
    W.state = s;
    W.t = 0;
  };
  // electric fences between neighbouring pylons (jumpable)
  if (W.fenceCd <= 0 && W.pylons.length >= 2) {
    W.fenceCd = 5.5;
    const ps = W.pylons as CombatEnemy[];
    const pairs: [CombatEnemy, CombatEnemy][] = [];
    for (let i = 0; i < ps.length; i++) {
      const j = (i + 1) % ps.length;
      if (ps.length === 2 && i === 1) break;
      pairs.push([ps[i], ps[j]]);
    }
    pairs.forEach(([a, b]) => {
      c.hazards.addBeam({
        origin: () => (a.isDead || b.isDead || e.isDead ? null : new THREE.Vector3(a.mesh.position.x, 0, a.mesh.position.z)),
        angleAt: () => yawTo(a.mesh.position.x, a.mesh.position.z, b.mesh.position.x, b.mesh.position.z),
        length: a.mesh.position.distanceTo(b.mesh.position),
        width: 0.45,
        height: 0.85,
        warn: 1.0,
        life: 3.4,
        damage: Math.round(e.damage * 0.65),
        tick: 0.3,
        color: 0xa5f3fc,
        jumpable: true,
        label: 'ARC FENCE',
        owner: e,
      });
    });
    c.sfx.scan();
  }
  switch (W.state) {
    case 'roam': {
      setAct(e, 'idle', 0);
      keepRange(e, c, dist, 9, 15, 2.4, 2.8);
      if (W.plantCd <= 0 && W.pylons.length < 3) set('plant');
      else if (W.boltCd <= 0 && dist < 26) set('cast');
      break;
    }
    case 'plant': {
      setAct(e, 'plant', W.t / 0.7);
      e.velocity.multiplyScalar(0.7);
      if (W.t >= 0.7) {
        // anchor the pylon somewhere around the player so the fences cut the arena
        for (let k = 0; k < 10; k++) {
          const a = Math.random() * Math.PI * 2;
          const r = 6 + Math.random() * 4;
          const x = c.player.x + Math.cos(a) * r;
          const z = c.player.z + Math.sin(a) * r;
          if (c.isBlocked(x, z, 1.2)) continue;
          const p = c.spawnMinion('pylon', new THREE.Vector3(x, 0, z), e);
          if (p) {
            W.pylons.push(p);
            c.hazards.columnFx(x, z, 0.6, 5, 0xa5f3fc, 0.5);
            c.hazards.ringFx(x, z, 2.2, 0xa5f3fc, 0.4);
          }
          break;
        }
        c.sfx.heavy();
        W.plantCd = 3.2 + Math.random();
        set('roam');
      }
      break;
    }
    case 'cast': {
      setAct(e, 'cast', W.t / 0.5);
      e.velocity.multiplyScalar(0.8);
      if (W.t >= 0.5) {
        volley(e, c, 3, 0.4, 22, 0.6, 0xa5f3fc, 0.14);
        W.boltCd = 2.8 + Math.random();
        set('roam');
      }
      break;
    }
  }
}

function updatePylon(e: CombatEnemy) {
  e.noContact = true;
  e.ignoreStandoff = true;
  e.velocity.set(0, 0, 0);
  e.airY = 0;
  const owner = e.ai?.owner as CombatEnemy | undefined;
  if (owner && owner.isDead) e.hp = 0; // the network collapses with its weaver
}

// ───────────────────────── ORBITAL SPOTTER ─────────────────────────
function paintLine(scene: THREE.Scene): THREE.Group {
  const g = new THREE.Group();
  const geo = new THREE.CylinderGeometry(0.03, 0.03, 1, 6, 1, true);
  geo.translate(0, 0.5, 0);
  g.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xff2d2d, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })));
  const glowGeo = new THREE.CylinderGeometry(0.1, 0.1, 1, 8, 1, true);
  glowGeo.translate(0, 0.5, 0);
  g.add(new THREE.Mesh(glowGeo, new THREE.MeshBasicMaterial({ color: 0xff2d2d, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false })));
  scene.add(g);
  return g;
}

function updateSpotter(e: CombatEnemy, c: CombatCtx, dist: number) {
  const S = (e.ai ??= { state: 'drift', t: 0, paintCd: 2 + Math.random() * 1.5, seed: Math.random() * 10 });
  e.noContact = true;
  e.mesh.position.y = 6.4 + Math.sin(c.time * 1.4 + S.seed) * 0.4;
  S.t += c.delta;
  S.paintCd -= c.delta;
  const set = (s: string) => {
    S.state = s;
    S.t = 0;
  };
  const showLaser = (on: boolean) => {
    if (!on) {
      if (e.auxMesh) e.auxMesh.visible = false;
      return;
    }
    if (!e.auxMesh) e.auxMesh = paintLine(c.scene);
    const l = e.auxMesh;
    l.visible = Math.sin(c.time * 40) > -0.5;
    apexEmitterWorld(e.mesh, _v);
    _w.set(c.player.x, c.player.y - 0.6, c.player.z);
    l.position.copy(_v);
    const dir = _w.sub(_v);
    l.scale.set(1, dir.length(), 1);
    l.quaternion.setFromUnitVectors(_up, dir.normalize());
  };
  switch (S.state) {
    case 'drift': {
      setAct(e, 'idle', 0);
      showLaser(false);
      keepRange(e, c, dist, 14, 22, 2.0, 2.2);
      if (S.paintCd <= 0 && dist < 34) {
        set('paint');
        c.text('TARGET PAINTED', '#ff2d2d');
        c.hazards.add({
          shape: 'circle',
          x: c.player.x,
          z: c.player.z,
          radius: 3.3,
          delay: 2.5,
          lockAt: 0.6,
          track: () => ({ x: c.player.x, z: c.player.z }),
          damage: Math.round(e.damage * 1.4),
          knockUp: 8,
          knockBack: 6,
          label: 'ORBITAL STRIKE',
          color: 0xff2d2d,
          fx: 'pillar',
          shake: 0.55,
          owner: e, // shoot the spotter down and the strike is called off
        });
        c.sfx.scan();
      }
      break;
    }
    case 'paint': {
      setAct(e, 'paint', 1);
      e.velocity.multiplyScalar(0.85);
      showLaser(S.t < 1.9);
      if (S.t >= 2.5) {
        showLaser(false);
        S.paintCd = 5 + Math.random() * 2;
        set('drift');
      }
      break;
    }
  }
}

// ───────────────────────── MERCURY SPLITTER ─────────────────────────
function updateSplitter(e: CombatEnemy, c: CombatCtx, dist: number) {
  const B = (e.ai ??= { state: 'hop', t: 0, leapCd: 1.5 + Math.random() * 1.5 });
  B.t += c.delta;
  B.leapCd -= c.delta;
  const set = (s: string) => {
    B.state = s;
    B.t = 0;
  };
  switch (B.state) {
    case 'hop': {
      e.airY = Math.abs(Math.sin(c.time * 5)) * 0.25;
      e.noContact = false;
      e.ignoreStandoff = false;
      setAct(e, 'idle', 0);
      keepRange(e, c, dist, 2.5, 5, 1.4, 2.6);
      if (B.leapCd <= 0 && dist < 17) {
        set('crouch');
        B.mark = c.hazards.add({
          shape: 'circle',
          x: c.player.x,
          z: c.player.z,
          radius: 3.3,
          delay: 1.3,
          lockAt: 0.5,
          track: () => ({ x: c.player.x, z: c.player.z }),
          damage: Math.round(e.damage * 1.5),
          knockUp: 6,
          knockBack: 9,
          label: 'MERCURY CRASH',
          color: 0xe879f9,
          fx: 'blast',
          shake: 0.35,
          owner: e,
        });
      }
      break;
    }
    case 'crouch': {
      e.velocity.multiplyScalar(0.5);
      e.airY = 0;
      setAct(e, 'crouch', B.t / 0.55);
      if (B.t >= 0.55) {
        set('leap');
        B.from = e.mesh.position.clone();
        c.sfx.dash();
      }
      break;
    }
    case 'leap': {
      e.noContact = true;
      e.ignoreStandoff = true;
      setAct(e, 'leap', 1);
      const k = Math.min(1, B.t / 0.75);
      const h = B.mark as { x: number; z: number } | null;
      const from = B.from as THREE.Vector3;
      if (h) {
        e.mesh.position.x = from.x + (h.x - from.x) * k;
        e.mesh.position.z = from.z + (h.z - from.z) * k;
      }
      e.velocity.set(0, 0, 0);
      e.airY = Math.sin(k * Math.PI) * 6;
      if (B.t >= 0.75) {
        set('land');
        e.airY = 0;
        c.sparks(e.mesh.position.clone().setY(0.4), '#f0abfc', 18);
      }
      break;
    }
    case 'land': {
      setAct(e, 'land', Math.min(1, B.t / 0.5));
      e.noContact = false;
      e.ignoreStandoff = B.t < 0.2;
      e.velocity.multiplyScalar(0.5);
      if (B.t >= 0.6) {
        B.leapCd = 3.2 + Math.random() * 1.5;
        set('hop');
      }
      break;
    }
  }
}

// ───────────────────────── CHRONO REVERSER ─────────────────────────
interface SlowField {
  x: number;
  z: number;
  r: number;
  life: number;
  delay: number;
  mesh: THREE.Group;
}

function slowFieldMesh(scene: THREE.Scene, r: number): THREE.Group {
  const g = new THREE.Group();
  const mat = (c: number, o: number) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const disc = new THREE.Mesh(new THREE.CircleGeometry(r, 48), mat(0x7c3aed, 0.18));
  disc.rotation.x = -Math.PI / 2;
  g.add(disc);
  const rim = new THREE.Mesh(new THREE.RingGeometry(r * 0.95, r, 64), mat(0xc4b5fd, 0.8));
  rim.rotation.x = -Math.PI / 2;
  g.add(rim);
  const dial = new THREE.Group();
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const tick = new THREE.Mesh(new THREE.PlaneGeometry(0.08, r * 0.18), mat(0xfde68a, 0.7));
    tick.rotation.x = -Math.PI / 2;
    tick.rotation.z = -a;
    tick.position.set(Math.sin(a) * r * 0.82, 0.01, Math.cos(a) * r * 0.82);
    dial.add(tick);
  }
  const hand = new THREE.Mesh(new THREE.PlaneGeometry(0.12, r * 0.7), mat(0xffffff, 0.6));
  hand.rotation.x = -Math.PI / 2;
  hand.position.z = r * 0.35;
  const handPivot = new THREE.Group();
  handPivot.add(hand);
  dial.add(handPivot);
  dial.userData.hand = handPivot;
  g.add(dial);
  g.userData.dial = dial;
  scene.add(g);
  return g;
}

function updateChrono(e: CombatEnemy, c: CombatCtx, dist: number) {
  const C = (e.ai ??= { state: 'drift', t: 0, fieldCd: 1.6, boltCd: 1.4, rewound: false, fields: [] as SlowField[] });
  C.t += c.delta;
  C.fieldCd -= c.delta;
  C.boltCd -= c.delta;
  const set = (s: string) => {
    C.state = s;
    C.t = 0;
  };
  // slow fields: telegraph ring, then a time-dilated disc that drags the player's movement
  for (let i = (C.fields as SlowField[]).length - 1; i >= 0; i--) {
    const f = C.fields[i] as SlowField;
    if (f.delay > 0) {
      f.delay -= c.delta;
      f.mesh.scale.setScalar(Math.max(0.05, 1 - f.delay));
      continue;
    }
    f.life -= c.delta;
    const dial = f.mesh.userData.dial as THREE.Group;
    dial.rotation.y -= c.delta * 0.6;
    (dial.userData.hand as THREE.Object3D).rotation.y += c.delta * 3;
    if (Math.hypot(c.player.x - f.x, c.player.z - f.z) < f.r) c.slowPlayer?.(0.45, 0.15);
    if (f.life <= 0) {
      disposeObj(c.scene, f.mesh);
      C.fields.splice(i, 1);
    }
  }
  switch (C.state) {
    case 'drift': {
      setAct(e, 'idle', 0);
      keepRange(e, c, dist, 10, 16, 1.4, 2.2);
      if (!C.rewound && e.hp / e.maxHp < 0.4) {
        set('rewind');
        C.channelDmg = 0;
        c.text('TIME REWIND // 攻撃で阻止せよ!', '#a78bfa');
        c.announce('CHRONO REVERSER // 時間逆行の詠唱中 — 大ダメージで阻止!');
        c.sfx.scan();
      } else if (C.fieldCd <= 0 && dist < 30 && (C.fields as SlowField[]).length < 2) {
        set('cast');
      } else if (C.boltCd <= 0 && dist < 28) {
        volley(e, c, 2, 0.3, 13, 0.8, 0xc4b5fd, 0.22);
        C.boltCd = 2.4 + Math.random();
      }
      break;
    }
    case 'cast': {
      setAct(e, 'cast', C.t / 0.6);
      e.velocity.multiplyScalar(0.7);
      if (C.t >= 0.6) {
        const r = 5.2;
        const f: SlowField = { x: c.player.x, z: c.player.z, r, life: 5.5, delay: 0.9, mesh: slowFieldMesh(c.scene, r) };
        f.mesh.position.set(f.x, 0.08, f.z);
        C.fields.push(f);
        c.hazards.ringFx(f.x, f.z, r, 0xa78bfa, 0.9);
        c.sfx.scan();
        C.fieldCd = 5.5 + Math.random();
        set('drift');
      }
      break;
    }
    case 'rewind': {
      setAct(e, 'rewind', 1);
      e.velocity.multiplyScalar(0.5);
      if (Math.random() < c.delta * 12) c.sparks(e.mesh.position.clone().setY(1.6 + Math.random() * 1.5), '#c4b5fd', 4);
      if (C.channelDmg >= e.maxHp * 0.16) {
        C.rewound = true;
        c.text('REWIND BROKEN!', '#fde68a');
        c.hazards.ringFx(e.mesh.position.x, e.mesh.position.z, 4, 0xfde68a, 0.5);
        c.sfx.boom();
        set('stagger');
      } else if (C.t >= 2.6) {
        C.rewound = true;
        const restored = Math.max(e.hp, Math.min(e.maxHp, (C.histHp as number) ?? e.maxHp * 0.7), e.maxHp * 0.7);
        e.hp = restored;
        c.text('TIME REWOUND', '#a78bfa');
        c.hazards.ringFx(e.mesh.position.x, e.mesh.position.z, 7, 0xa78bfa, 0.7);
        c.hazards.columnFx(e.mesh.position.x, e.mesh.position.z, 1.4, 7, 0xc4b5fd, 0.6);
        c.sfx.scan();
        set('drift');
      }
      break;
    }
    case 'stagger': {
      setAct(e, 'stagger', 1);
      e.velocity.multiplyScalar(0.6);
      if (C.t >= 1.6) set('drift');
      break;
    }
  }
}

// ───────────────────────── MIRAGE CASTER (+ echoes) ─────────────────────────
function updateMirage(e: CombatEnemy, c: CombatCtx, dist: number) {
  const M = (e.ai ??= { state: 'float', t: 0, castCd: 0.8, swapCd: 5, boltCd: 2.2, echoes: [] as CombatEnemy[] });
  M.t += c.delta;
  M.castCd -= c.delta;
  M.swapCd -= c.delta;
  M.boltCd -= c.delta;
  M.echoes = (M.echoes as CombatEnemy[]).filter((x) => !x.isDead);
  const set = (s: string) => {
    M.state = s;
    M.t = 0;
  };
  switch (M.state) {
    case 'float': {
      setAct(e, 'idle', 0);
      keepRange(e, c, dist, 10, 15, 2.0, 2.4);
      if (M.castCd <= 0 && M.echoes.length < 2) set('cast');
      else if (M.swapCd <= 0 && M.echoes.length > 0) set('swap');
      else if (M.boltCd <= 0 && dist < 26) {
        volley(e, c, 3, 0.5, 17, 0.7, 0x5eead4, 0.15);
        M.boltCd = 2.4 + Math.random();
      }
      break;
    }
    case 'cast': {
      setAct(e, 'cast', M.t / 0.8);
      e.velocity.multiplyScalar(0.7);
      if (M.t >= 0.8) {
        toPlayerDir(e, c, _v);
        _side.crossVectors(_v, _up).normalize();
        for (const s of [-1, 1]) {
          if (M.echoes.length >= 2) break;
          const at = e.mesh.position.clone().addScaledVector(_side, s * 4.5).setY(0);
          if (c.isBlocked(at.x, at.z, 1)) at.copy(e.mesh.position).addScaledVector(_v, -3).setY(0);
          const echo = c.spawnMinion('mirage_echo', at, e);
          if (echo) {
            M.echoes.push(echo);
            c.hazards.columnFx(at.x, at.z, 0.7, 3.2, 0x5eead4, 0.45);
          }
        }
        c.sfx.scan();
        M.castCd = 7 + Math.random() * 2;
        set('float');
      }
      break;
    }
    case 'swap': {
      setAct(e, 'swap', M.t / 0.35);
      if (M.t >= 0.35) {
        const echo = (M.echoes as CombatEnemy[])[Math.floor(Math.random() * M.echoes.length)];
        if (echo) {
          const a = e.mesh.position.clone();
          const b = echo.mesh.position.clone();
          c.hazards.columnFx(a.x, a.z, 0.7, 3.2, 0x5eead4, 0.4);
          c.hazards.columnFx(b.x, b.z, 0.7, 3.2, 0x5eead4, 0.4);
          e.mesh.position.set(b.x, e.mesh.position.y, b.z);
          echo.mesh.position.set(a.x, echo.mesh.position.y, a.z);
          e.velocity.set(0, 0, 0);
          c.sfx.dash();
        }
        M.swapCd = 4 + Math.random() * 2;
        set('float');
      }
      break;
    }
  }
}

function updateMirageEcho(e: CombatEnemy, c: CombatCtx, dist: number) {
  const X = (e.ai ??= { boltCd: 1.5 + Math.random() });
  const owner = X.owner as CombatEnemy | undefined;
  if (owner && owner.isDead) {
    e.hp = 0; // the projection collapses with its caster
    return;
  }
  e.noContact = true;
  X.boltCd = (X.boltCd ?? 2) - c.delta;
  setAct(e, 'idle', 0);
  keepRange(e, c, dist, 9, 15, 2.2, 2.4);
  if (X.boltCd <= 0 && dist < 26) {
    volley(e, c, 1, 0, 16, 0.6, 0x67e8f9, 0.13);
    X.boltCd = 2.6 + Math.random();
  }
}

// ───────────────────────── MAGNETAR ─────────────────────────
function updateMagnet(e: CombatEnemy, c: CombatCtx, dist: number) {
  const G = (e.ai ??= { state: 'walk', t: 0, pullCd: 2 + Math.random() * 1.5, repelCd: 0 });
  G.t += c.delta;
  G.pullCd -= c.delta;
  G.repelCd -= c.delta;
  const set = (s: string) => {
    G.state = s;
    G.t = 0;
  };
  // too close: magnetic shove
  if (dist < 3.6 && G.repelCd <= 0 && G.state === 'walk') {
    G.repelCd = 3;
    toPlayerDir(e, c, _v);
    c.pushPlayer(_v.x * 16, _v.z * 16);
    c.hazards.ringFx(e.mesh.position.x, e.mesh.position.z, 4, 0x60a5fa, 0.35);
    c.text('REPEL', '#60a5fa');
    c.sfx.sweep();
  }
  switch (G.state) {
    case 'walk': {
      e.faceAngle = undefined;
      setAct(e, 'idle', 0);
      keepRange(e, c, dist, 6, 11, 1.2, 2.4);
      if (G.pullCd <= 0 && dist < 21) {
        set('pull');
        c.text('MAGNETIC PULL', '#93c5fd');
        c.sfx.scan();
      }
      break;
    }
    case 'pull': {
      setAct(e, 'pull', 1);
      e.velocity.multiplyScalar(0.4);
      toPlayerDir(e, c, _v);
      // drag the player in (they can still run against it)
      const strength = 30 * Math.min(1, G.t / 0.4);
      c.pushPlayer(-_v.x * strength * c.delta, -_v.z * strength * c.delta);
      if (Math.random() < c.delta * 10) c.sparks(new THREE.Vector3(c.player.x, c.player.y - 0.8, c.player.z), '#93c5fd', 3);
      if (G.t >= 1.9) {
        set('nova');
        c.hazards.add({
          shape: 'circle',
          x: e.mesh.position.x,
          z: e.mesh.position.z,
          radius: 6.8,
          delay: 0.85,
          damage: Math.round(e.damage * 1.6),
          knockBack: 15,
          knockUp: 4,
          label: 'MAGNETIC NOVA',
          color: 0x60a5fa,
          fx: 'blast',
          shake: 0.4,
          owner: e,
        });
      }
      break;
    }
    case 'nova': {
      setAct(e, 'nova', Math.min(1, G.t / 0.85));
      e.velocity.multiplyScalar(0.3);
      if (G.t >= 1.3) {
        G.pullCd = 5.5 + Math.random() * 2;
        set('walk');
      }
      break;
    }
  }
}

// ───────────────────────── RAGE BERSERKER ─────────────────────────
function updateBerserker(e: CombatEnemy, c: CombatCtx, dist: number) {
  const Z = (e.ai ??= { state: 'chase', t: 0, leapCd: 2.5, cycCd: 3.5, roared: false, baseDmg: e.damage, tick: 0 });
  Z.t += c.delta;
  Z.leapCd -= c.delta;
  Z.cycCd -= c.delta;
  const set = (s: string) => {
    Z.state = s;
    Z.t = 0;
  };
  // rage: the more it is hurt, the faster and harder it hits
  const rage = Math.max(0, Math.min(1, 1 - e.hp / e.maxHp));
  e.speed = e.baseSpeed * (1 + rage * 0.9);
  e.damage = Math.round(Z.baseDmg * (1 + rage * 0.8));
  const rig = rigOf(e);
  if (rig) rig.extras.rageTarget = rage;
  if (!Z.roared && rage > 0.5 && Z.state === 'chase') {
    Z.roared = true;
    set('roar');
    c.text('RAGE AWAKENS', '#ff5a1a');
    c.announce('RAGE BERSERKER // 激昂 — 速度と攻撃力が上昇!');
    c.hazards.ringFx(e.mesh.position.x, e.mesh.position.z, 8, 0xff5a1a, 0.6);
    c.sfx.boom();
  }
  switch (Z.state) {
    case 'chase': {
      e.noContact = false;
      e.ignoreStandoff = false;
      e.airY = 0;
      setAct(e, 'idle', 0);
      keepRange(e, c, dist, 2.4, 3.4, 0.8, 3.2);
      if (Z.cycCd <= 0 && dist < 9) set('cyclone');
      else if (Z.leapCd <= 0 && dist > 6 && dist < 21) {
        set('crouch');
        Z.mark = c.hazards.add({
          shape: 'circle',
          x: c.player.x,
          z: c.player.z,
          radius: 3.6,
          delay: 1.15,
          lockAt: 0.45,
          track: () => ({ x: c.player.x, z: c.player.z }),
          damage: Math.round(e.damage * 1.7),
          knockUp: 7,
          knockBack: 8,
          label: 'RAGE SLAM',
          color: 0xff5a1a,
          fx: 'spikes',
          shake: 0.45,
          owner: e,
        });
      }
      break;
    }
    case 'cyclone': {
      setAct(e, 'cyclone', 1);
      toPlayerDir(e, c, _v);
      e.velocity.addScaledVector(_v, e.speed * c.delta * 2.4);
      Z.tick -= c.delta;
      if (Z.tick <= 0) {
        Z.tick = 0.34;
        c.hazards.add({
          shape: 'circle',
          x: e.mesh.position.x,
          z: e.mesh.position.z,
          radius: 3.2,
          delay: 0.28,
          damage: Math.round(e.damage * 0.55),
          label: 'CYCLONE',
          color: 0xff5a1a,
          fx: 'slash',
          owner: e,
        });
        c.sfx.sweep();
      }
      if (Z.t >= 2.2 - rage * 0.6) {
        Z.cycCd = 5.5 - rage * 2;
        set('chase');
      }
      break;
    }
    case 'crouch': {
      setAct(e, 'roar', Math.min(1, Z.t / 0.4));
      e.velocity.multiplyScalar(0.5);
      if (Z.t >= 0.45) {
        set('leap');
        Z.from = e.mesh.position.clone();
        c.sfx.dash();
      }
      break;
    }
    case 'leap': {
      e.noContact = true;
      e.ignoreStandoff = true;
      setAct(e, 'leap', 1);
      const k = Math.min(1, Z.t / 0.7);
      const h = Z.mark as { x: number; z: number } | null;
      const from = Z.from as THREE.Vector3;
      if (h) {
        e.mesh.position.x = from.x + (h.x - from.x) * k;
        e.mesh.position.z = from.z + (h.z - from.z) * k;
      }
      e.velocity.set(0, 0, 0);
      e.airY = Math.sin(k * Math.PI) * 7;
      if (Z.t >= 0.7) {
        e.airY = 0;
        Z.leapCd = 5 - rage * 2;
        set('chase');
      }
      break;
    }
    case 'roar': {
      setAct(e, 'roar', Math.min(1, Z.t / 0.5));
      e.velocity.multiplyScalar(0.4);
      if (Z.t >= 0.9) {
        Z.cycCd = Math.min(Z.cycCd, 0.5);
        set('chase');
      }
      break;
    }
  }
}

/** Runs one frame of APEX AI. `dist` = horizontal distance to the player. */
export function updateApexEnemy(e: CombatEnemy, c: CombatCtx, dist: number): void {
  switch (e.category) {
    case 'aegis': updateAegis(e, c, dist); break;
    case 'ronin': updateRonin(e, c, dist); break;
    case 'pyro': updatePyro(e, c, dist); break;
    case 'weaver': updateWeaver(e, c, dist); break;
    case 'pylon': updatePylon(e); break;
    case 'spotter': updateSpotter(e, c, dist); break;
    case 'splitter': updateSplitter(e, c, dist); break;
    case 'chrono': updateChrono(e, c, dist); break;
    case 'mirage': updateMirage(e, c, dist); break;
    case 'mirage_echo': updateMirageEcho(e, c, dist); break;
    case 'magnet': updateMagnet(e, c, dist); break;
    case 'berserker': updateBerserker(e, c, dist); break;
  }
}

/**
 * Damage interception, called every frame before the death check (see the header comment).
 * Uses the HP difference since the previous frame; `dist` = horizontal distance to the player.
 */
export function apexDamageGate(e: CombatEnemy, c: CombatCtx, dist: number): void {
  // the AI creates its own memory on its first update (do not pre-create it here)
  const ai = e.ai;
  if (!ai) return;
  const prev = ai.prevHp as number | undefined;
  const lost = prev !== undefined ? prev - e.hp : 0;
  if (lost > 0) {
    switch (e.category) {
      case 'aegis': {
        // the tower shield stops anything coming from the front — unless the attacker is inside its reach
        const yaw = (ai.yaw as number | undefined) ?? yawOf(e, c);
        const off = Math.abs(wrapPi(yawOf(e, c) - yaw));
        if (off < 1.05 && dist > 5.2) {
          e.hp += lost * 0.85;
          if (c.time - (ai.blockTxt ?? -9) > 0.45) {
            ai.blockTxt = c.time;
            c.text('SHIELDED', '#67e8f9');
          }
          c.sparks(e.mesh.position.clone().add(new THREE.Vector3(Math.sin(yaw) * 1.1, 1.6, Math.cos(yaw) * 1.1)), '#67e8f9', 5);
          const rig = rigOf(e);
          if (rig) rig.extras.blockFlash = 1;
        }
        break;
      }
      case 'ronin': {
        ai.shotAt = c.time;
        if (ai.state === 'deflect') {
          if (dist > 4.5) {
            // ranged hits are cut out of the air and sent back
            e.hp += lost;
            if (c.time - (ai.reflectAt ?? -9) > 0.12) {
              ai.reflectAt = c.time;
              volley(e, c, 1, 0, 30, 0.5, 0xfda4af, 0.12);
              if (c.time - (ai.blockTxt ?? -9) > 0.5) {
                ai.blockTxt = c.time;
                c.text('DEFLECTED!', '#fda4af');
              }
            }
          } else {
            // a melee strike breaks the stance
            ai.state = 'recover';
            ai.t = 0;
            c.text('GUARD BREAK!', '#fde68a');
          }
        }
        break;
      }
      case 'chrono': {
        if (ai.state === 'rewind') ai.channelDmg = (ai.channelDmg ?? 0) + lost;
        break;
      }
    }
  }
  // CHRONO: remember the HP of ~5 seconds ago (what a rewind restores)
  if (e.category === 'chrono') {
    ai.histT = (ai.histT ?? 0) + c.delta;
    if (ai.histT >= 0.5) {
      ai.histT = 0;
      const h: number[] = (ai.hist ??= []);
      h.push(e.hp);
      if (h.length > 10) h.shift();
      ai.histHp = h[0];
    }
  }
  ai.prevHp = e.hp;
}

/** Death side effects (split / collapse). */
export function apexOnDeath(e: CombatEnemy, c: CombatCtx): void {
  switch (e.category) {
    case 'splitter': {
      toPlayerDir(e, c, _v);
      _side.crossVectors(_v, _up).normalize();
      c.hazards.ringFx(e.mesh.position.x, e.mesh.position.z, 3.5, 0xe879f9, 0.5);
      c.sparks(e.mesh.position.clone().setY(1), '#f0abfc', 26);
      for (const s of [-1, 1]) {
        const at = e.mesh.position.clone().addScaledVector(_side, s * 1.4).setY(0);
        c.spawnMinion('splitling', at);
      }
      c.text('SPLIT!', '#f0abfc');
      break;
    }
    case 'weaver': {
      ((e.ai?.pylons as CombatEnemy[] | undefined) ?? []).forEach((p) => {
        if (!p.isDead) p.hp = 0;
      });
      break;
    }
    case 'mirage': {
      ((e.ai?.echoes as CombatEnemy[] | undefined) ?? []).forEach((x) => {
        if (!x.isDead) x.hp = 0;
      });
      break;
    }
    case 'chrono': {
      ((e.ai?.fields as SlowField[] | undefined) ?? []).forEach((f) => disposeObj(c.scene, f.mesh));
      if (e.ai) e.ai.fields = [];
      break;
    }
  }
}

function disposeObj(scene: THREE.Scene, o: THREE.Object3D) {
  scene.remove(o);
  o.traverse((ch) => {
    const m = ch as THREE.Mesh;
    m.geometry?.dispose();
    (m.material as THREE.Material | undefined)?.dispose?.();
  });
}
