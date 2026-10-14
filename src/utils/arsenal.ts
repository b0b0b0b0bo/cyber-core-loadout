import * as THREE from 'three';

/**
 * ARSENAL — the projectile / deployable systems of the newer player weapons. Each weapon gets a
 * mechanic the older arsenal does not have; the battle scene only calls the `fire*` entry points and
 * `update()` once per frame.
 *
 *   blade_disc       ORBITAL RONDO   thrown chakrams that cut on the way out AND back; HALO ORBIT skill
 *   sub_chrono       CHRONOS-7       time marks: hits store damage that detonates 1.2s later (+12% per mark)
 *   sub_hive         MICRO HIVE      hold to paint up to 6 lock-ons, release for a salvo of homing missiles
 *   sub_flare        HELIX FLARE     sticky flare: burns + MARKS the target (takes +25% damage from everything)
 *   main_needler     SPINE NEEDLER   needles stick in; 7 on one target = SUPERCOMBINE explosion
 *   main_sonic       ECHO RESONATOR  growing sonic rings that pass through cover; resonate in crowds
 *   main_buzzsaw     BUZZ RIPPER     saw blades ricochet off walls / cover and grind whatever they hit
 *   heavy_meteor     METEOR CALLER   plant a beacon, a meteor lands on it and leaves a burning crater
 *   heavy_sentry     VOLT SENTRY     deploy tesla turrets that zap and chain between enemies
 *   heavy_inferno    INFERNO ROAR    flamethrower cone, stacking burn, burning ground
 */

export interface ArsenalEnemy {
  mesh: THREE.Group;
  hp: number;
  maxHp: number;
  isDead: boolean;
  category: string;
  velocity: THREE.Vector3;
  attackCooldown: number;
  burnTimer?: number;
  burnDps?: number;
  shockTimer?: number;
  bleedTimer?: number;
  bleedDps?: number;
  /** HELIX FLARE mark: takes extra damage from every source while > 0 */
  vulnTimer?: number;
  vulnMul?: number;
}

export interface ArsenalCover {
  box: { minX: number; maxX: number; minZ: number; maxZ: number; height: number };
}

export interface ArsenalCtx {
  scene: THREE.Scene;
  camera: THREE.Camera;
  time: number;
  delta: number;
  /** player eye position */
  player: THREE.Vector3;
  enemies: ArsenalEnemy[];
  covers: ArsenalCover[];
  arenaHalf: number;
  hasSkill: (id: string) => boolean;
  /** apply damage (hp, stats, popup, hit marker). `silent` = no popup (ticks are summed by the arsenal) */
  damage: (e: ArsenalEnemy, dmg: number, label?: string, color?: string, silent?: boolean) => void;
  /** writes the enemy's hit centre into `out`, returns its hit radius */
  hitbox: (e: ArsenalEnemy, out: THREE.Vector3) => number;
  sparks: (pos: THREE.Vector3, color: string | number, count?: number) => void;
  text: (t: string, color: string) => void;
  announce: (t: string) => void;
  shake: (amp: number, dur: number) => void;
  sfx: { hit: () => void; boom: () => void; heavy: () => void; scan: () => void; sweep: () => void; dash: () => void; zap: () => void };
}

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();
const _d = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

const addMat = (color: THREE.ColorRepresentation, opacity = 1) =>
  new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });

function disposeObj(scene: THREE.Object3D | null, o: THREE.Object3D) {
  o.parent?.remove(o);
  if (scene) scene.remove(o);
  o.traverse((ch) => {
    const m = ch as THREE.Mesh;
    m.geometry?.dispose();
    const mat = m.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
    else mat?.dispose();
  });
}

/** Distance from point p to segment ab (also returns the closest point in `out`). */
function segDist(a: THREE.Vector3, b: THREE.Vector3, p: THREE.Vector3, out: THREE.Vector3): number {
  _d.subVectors(b, a);
  const L2 = _d.lengthSq();
  let t = 0;
  if (L2 > 1e-8) t = Math.max(0, Math.min(1, _c.subVectors(p, a).dot(_d) / L2));
  out.copy(a).addScaledVector(_d, t);
  return out.distanceTo(p);
}

function inCover(ctx: ArsenalCtx, p: THREE.Vector3): ArsenalCover | null {
  for (const c of ctx.covers) {
    const b = c.box;
    if (p.x >= b.minX && p.x <= b.maxX && p.z >= b.minZ && p.z <= b.maxZ && p.y >= 0 && p.y <= b.height) return c;
  }
  return null;
}

// ───────────────────────── entity types ─────────────────────────
interface Chakram {
  mesh: THREE.Group;
  side: number;
  mode: 'throw' | 'orbit' | 'burst';
  pos: THREE.Vector3;
  dir: THREE.Vector3;
  speed: number;
  travelled: number;
  range: number;
  returning: boolean;
  dmg: number;
  hitOut: Set<ArsenalEnemy>;
  hitBack: Set<ArsenalEnemy>;
  lastHit: Map<ArsenalEnemy, number>;
  age: number;
  life: number;
  angle: number;
}

interface Bolt {
  kind: 'chrono' | 'needle' | 'flare' | 'beacon' | 'canister';
  mesh: THREE.Object3D;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  gravity: number;
  dmg: number;
  life: number;
  radius: number;
}

interface Missile {
  mesh: THREE.Group;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  target: ArsenalEnemy | null;
  dmg: number;
  radius: number;
  life: number;
  age: number;
  trailT: number;
}

interface SonicRing {
  mesh: THREE.Group;
  pos: THREE.Vector3;
  dir: THREE.Vector3;
  speed: number;
  age: number;
  life: number;
  r0: number;
  r1: number;
  dmg: number;
  hit: Set<ArsenalEnemy>;
}

interface Saw {
  mesh: THREE.Group;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  dmg: number;
  life: number;
  bounces: number;
  stuck: ArsenalEnemy | null;
  grindLeft: number;
  tick: number;
  ignore: Map<ArsenalEnemy, number>;
}

interface Meteor {
  phase: 'beacon' | 'fall';
  t: number;
  at: THREE.Vector3;
  beacon: THREE.Group;
  rock: THREE.Group | null;
  dmg: number;
  mini: boolean;
}

interface Turret {
  mesh: THREE.Group;
  orb: THREE.Object3D;
  pos: THREE.Vector3;
  life: number;
  zapT: number;
  dmg: number;
  rise: number;
}

interface FirePatch {
  pos: THREE.Vector3;
  r: number;
  life: number;
  max: number;
  dps: number;
  mesh: THREE.Group;
  tick: number;
}

interface Flame {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  age: number;
  life: number;
  size: number;
}

interface Zap {
  line: THREE.Line;
  life: number;
}

interface Mark {
  stored: number;
  count: number;
  timer: number;
  ring: THREE.Group;
  pips: THREE.Mesh[];
}

interface NeedleStack {
  n: number;
  t: number;
  spikes: THREE.Object3D[];
}

const CHRONO_DELAY = 1.2;
const NEEDLE_LIFE = 3.0;

export class Arsenal {
  private scene: THREE.Scene;
  private chakrams: Chakram[] = [];
  private bolts: Bolt[] = [];
  private missiles: Missile[] = [];
  private sonics: SonicRing[] = [];
  private saws: Saw[] = [];
  private meteors: Meteor[] = [];
  private turrets: Turret[] = [];
  private patches: FirePatch[] = [];
  private flames: Flame[] = [];
  private zaps: Zap[] = [];
  private marks = new Map<ArsenalEnemy, Mark>();
  private needles = new Map<ArsenalEnemy, NeedleStack>();
  private locks: ArsenalEnemy[] = [];
  private lockMarkers = new Map<ArsenalEnemy, THREE.Group>();
  private lockT = 0;
  /** summed tick damage per enemy, shown as one popup every ~0.3s */
  private tickAcc = new Map<ArsenalEnemy, { dmg: number; t: number; label: string; color: string }>();
  private flameGeo = new THREE.SphereGeometry(1, 8, 6);
  hiveHolding = false;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  // ───────────────────────── shared helpers ─────────────────────────
  private tickDamage(ctx: ArsenalCtx, e: ArsenalEnemy, dmg: number, label: string, color: string) {
    ctx.damage(e, dmg, label, color, true);
    const acc = this.tickAcc.get(e) ?? { dmg: 0, t: 0, label, color };
    acc.dmg += dmg;
    this.tickAcc.set(e, acc);
  }

  /** enemies whose hit sphere touches the sphere (p, r) */
  private touching(ctx: ArsenalCtx, p: THREE.Vector3, r: number, cb: (e: ArsenalEnemy, center: THREE.Vector3) => void) {
    for (const e of ctx.enemies) {
      if (e.isDead) continue;
      const rr = ctx.hitbox(e, _a);
      if (_a.distanceTo(p) <= rr + r) cb(e, _a.clone());
    }
  }

  /** first enemy hit by the swept sphere a→b */
  private sweep(ctx: ArsenalCtx, a: THREE.Vector3, b: THREE.Vector3, r: number, skip?: (e: ArsenalEnemy) => boolean): { e: ArsenalEnemy; at: THREE.Vector3 } | null {
    let best: { e: ArsenalEnemy; at: THREE.Vector3 } | null = null;
    let bestD = Infinity;
    for (const e of ctx.enemies) {
      if (e.isDead || skip?.(e)) continue;
      const rr = ctx.hitbox(e, _a);
      const d = segDist(a, b, _a, _b);
      if (d <= rr + r) {
        const along = _b.distanceTo(a);
        if (along < bestD) {
          bestD = along;
          best = { e, at: _b.clone() };
        }
      }
    }
    return best;
  }

  private explode(ctx: ArsenalCtx, at: THREE.Vector3, radius: number, dmg: number, color: number, label: string, knock = 8) {
    let n = 0;
    this.touching(ctx, at, radius, (e, center) => {
      const d = center.distanceTo(at);
      const k = 1 - Math.min(0.5, (d / Math.max(0.1, radius)) * 0.5);
      ctx.damage(e, Math.round(dmg * k), label, '#' + new THREE.Color(color).getHexString());
      _c.subVectors(e.mesh.position, at).setY(0);
      if (_c.lengthSq() < 1e-4) _c.set(1, 0, 0);
      e.velocity.addScaledVector(_c.normalize(), knock);
      n++;
    });
    this.blastFx(at, radius, color);
    ctx.sparks(at.clone().setY(Math.max(0.4, at.y)), color, 24);
    ctx.sfx.boom();
    return n;
  }

  private blastFx(at: THREE.Vector3, radius: number, color: number) {
    const g = new THREE.Group();
    g.position.copy(at);
    const flash = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), addMat(0xffffff, 0.9));
    const shell = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 12), addMat(color, 0.55));
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 48), addMat(color, 0.9));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -at.y + 0.08;
    g.add(flash, shell, ring);
    this.scene.add(g);
    this.fxList.push({
      obj: g,
      life: 0.45,
      t: 0,
      update: (k) => {
        flash.scale.setScalar(radius * 0.35 * (0.4 + k));
        (flash.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - k) * (1 - k);
        shell.scale.setScalar(radius * (0.3 + 0.7 * Math.sqrt(k)));
        (shell.material as THREE.MeshBasicMaterial).opacity = 0.55 * (1 - k);
        ring.scale.setScalar(radius * (0.4 + 0.8 * k));
        (ring.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - k);
      },
    });
  }

  private fxList: { obj: THREE.Object3D; life: number; t: number; update: (k: number) => void }[] = [];

  private addPatch(at: THREE.Vector3, r: number, life: number, dps: number) {
    const g = new THREE.Group();
    g.position.set(at.x, 0.06, at.z);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(r, 32), addMat(0xff5a1a, 0.35));
    disc.rotation.x = -Math.PI / 2;
    const rim = new THREE.Mesh(new THREE.RingGeometry(r * 0.9, r, 40), addMat(0xffb36b, 0.8));
    rim.rotation.x = -Math.PI / 2;
    rim.position.y = 0.01;
    g.add(disc, rim);
    // licking flame tongues
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.random();
      const t = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.8 + Math.random() * 0.6, 6, 1, true), addMat(i % 2 ? 0xffd27a : 0xff6a1a, 0.6));
      t.position.set(Math.cos(a) * r * 0.55 * Math.random(), 0.4, Math.sin(a) * r * 0.55 * Math.random());
      t.userData.base = t.position.y;
      t.userData.seed = Math.random() * 10;
      g.add(t);
    }
    this.scene.add(g);
    this.patches.push({ pos: at.clone().setY(0), r, life, max: life, dps, mesh: g, tick: 0 });
  }

  // ───────────────────────── ORBITAL RONDO (chakram) ─────────────────────────
  private chakramMesh(color: string, R: number): THREE.Group {
    const g = new THREE.Group();
    const steel = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.9, roughness: 0.2, emissive: 0x2a2a2a });
    g.add(new THREE.Mesh(new THREE.TorusGeometry(R, R * 0.08, 8, 36), steel));
    g.add(new THREE.Mesh(new THREE.TorusGeometry(R * 0.82, R * 0.03, 6, 36), new THREE.MeshBasicMaterial({ color })));
    g.add(new THREE.Mesh(new THREE.CircleGeometry(R * 1.35, 36), addMat(color, 0.18)));
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const b = new THREE.Mesh(new THREE.ConeGeometry(R * 0.12, R * 0.45, 4), steel);
      b.position.set(Math.cos(a) * R * 1.12, Math.sin(a) * R * 1.12, 0);
      b.rotation.z = a - Math.PI / 2 - 0.5;
      b.scale.z = 0.35;
      g.add(b);
    }
    g.add(new THREE.Mesh(new THREE.SphereGeometry(R * 0.14, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff })));
    return g;
  }

  /** Is the chakram of this hand (+1 right / -1 left) still out? */
  chakramOut(side: number): boolean {
    return this.chakrams.some((c) => c.mode === 'throw' && c.side === side);
  }

  throwChakram(ctx: ArsenalCtx, side: number, origin: THREE.Vector3, dir: THREE.Vector3, dmg: number, range: number, color: string) {
    const mesh = this.chakramMesh(color, 0.34);
    mesh.position.copy(origin);
    this.scene.add(mesh);
    this.chakrams.push({
      mesh, side, mode: 'throw', pos: origin.clone(), dir: dir.clone().normalize(), speed: 30, travelled: 0, range,
      returning: false, dmg, hitOut: new Set(), hitBack: new Set(), lastHit: new Map(), age: 0, life: 6, angle: 0,
    });
    ctx.sfx.sweep();
  }

  /** HALO ORBIT: four chakrams circle the player, then burst outward. */
  haloOrbit(ctx: ArsenalCtx, dmg: number, color: string, duration: number) {
    for (let i = 0; i < 4; i++) {
      const mesh = this.chakramMesh(color, 0.42);
      this.scene.add(mesh);
      this.chakrams.push({
        mesh, side: 0, mode: 'orbit', pos: ctx.player.clone(), dir: new THREE.Vector3(), speed: 0, travelled: 0, range: 0,
        returning: false, dmg, hitOut: new Set(), hitBack: new Set(), lastHit: new Map(), age: 0, life: duration, angle: (i / 4) * Math.PI * 2,
      });
    }
    ctx.sfx.sweep();
  }

  private updateChakrams(ctx: ArsenalCtx) {
    const dt = ctx.delta;
    for (let i = this.chakrams.length - 1; i >= 0; i--) {
      const c = this.chakrams[i];
      c.age += dt;
      const prev = c.pos.clone();
      c.mesh.rotation.z += dt * 26;
      let done = false;
      if (c.mode === 'throw') {
        if (!c.returning) {
          // gentle curve toward the throwing side, like a real chakram
          c.dir.applyAxisAngle(UP, -c.side * 0.35 * dt).normalize();
          c.pos.addScaledVector(c.dir, c.speed * dt);
          c.travelled += c.speed * dt;
          if (c.travelled >= c.range || inCover(ctx, c.pos) || Math.abs(c.pos.x) > ctx.arenaHalf || Math.abs(c.pos.z) > ctx.arenaHalf) {
            c.returning = true;
            ctx.sparks(c.pos.clone(), '#fde68a', 8);
          }
        } else {
          // home back to the throwing hand
          _a.set(Math.cos(0), 0, 0);
          const hand = ctx.player.clone().add(new THREE.Vector3(0, -0.4, 0));
          const to = hand.clone().sub(c.pos);
          const d = to.length();
          c.speed = Math.min(42, c.speed + dt * 30);
          c.dir.lerp(to.normalize(), Math.min(1, dt * 8)).normalize();
          c.pos.addScaledVector(c.dir, c.speed * dt);
          if (d < 1.2 || c.age > c.life) done = true;
        }
        // orientation: flat-ish, tilted toward the travel direction
        c.mesh.position.copy(c.pos);
        c.mesh.lookAt(c.pos.clone().add(UP));
        c.mesh.rotateX(0.35);
        c.mesh.rotateZ(c.age * 26);
        const set = c.returning ? c.hitBack : c.hitOut;
        for (const e of ctx.enemies) {
          if (e.isDead || set.has(e)) continue;
          const rr = ctx.hitbox(e, _a);
          if (segDist(prev, c.pos, _a, _b) <= rr + 0.55) {
            set.add(e);
            ctx.damage(e, Math.round(c.dmg * (c.returning ? 0.8 : 1)), c.returning ? 'RETURN CUT' : 'RONDO', '#f59e0b');
            e.velocity.addScaledVector(c.dir, 4);
            ctx.sparks(_b.clone(), '#fde68a', 10);
            ctx.sfx.hit();
          }
        }
      } else {
        // orbit around the player, then burst outward
        const R = 3.2;
        if (c.mode === 'orbit') {
          c.angle += dt * 6.5;
          c.pos.set(ctx.player.x + Math.cos(c.angle) * R, ctx.player.y - 0.7 + Math.sin(c.angle * 2) * 0.15, ctx.player.z + Math.sin(c.angle) * R);
          if (c.age >= c.life) {
            c.mode = 'burst';
            c.age = 0;
            c.dir.set(Math.cos(c.angle), 0, Math.sin(c.angle));
            c.hitOut.clear();
            ctx.sfx.sweep();
          }
        } else {
          c.pos.addScaledVector(c.dir, 34 * dt);
          if (c.age >= 0.45) done = true;
        }
        c.mesh.position.copy(c.pos);
        c.mesh.lookAt(c.pos.clone().add(UP));
        c.mesh.rotateZ(c.age * 30);
        for (const e of ctx.enemies) {
          if (e.isDead) continue;
          const rr = ctx.hitbox(e, _a);
          if (segDist(prev, c.pos, _a, _b) > rr + 0.7) continue;
          if (c.mode === 'burst') {
            if (c.hitOut.has(e)) continue;
            c.hitOut.add(e);
            ctx.damage(e, Math.round(c.dmg * 2.2), 'HALO BURST', '#f59e0b');
            e.velocity.addScaledVector(c.dir, 16);
          } else {
            const last = c.lastHit.get(e) ?? -9;
            if (ctx.time - last < 0.3) continue;
            c.lastHit.set(e, ctx.time);
            this.tickDamage(ctx, e, Math.round(c.dmg * 0.6), 'HALO', '#f59e0b');
          }
          ctx.sparks(_b.clone(), '#fde68a', 6);
        }
      }
      if (done) {
        disposeObj(this.scene, c.mesh);
        this.chakrams.splice(i, 1);
      }
    }
  }

  // ───────────────────────── bolts (chrono / needle / flare / beacon / canister) ─────────────────────────
  private boltMesh(kind: Bolt['kind']): THREE.Object3D {
    const g = new THREE.Group();
    switch (kind) {
      case 'chrono': {
        g.add(new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff })));
        g.add(new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.02, 6, 20), addMat(0xc4b5fd, 0.9)));
        const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.07, 1.1, 8, 1, true), addMat(0xa78bfa, 0.6));
        tail.rotation.x = Math.PI / 2;
        tail.position.z = 0.55;
        g.add(tail);
        break;
      }
      case 'needle': {
        const n = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.36, 5), new THREE.MeshBasicMaterial({ color: 0xfbcfe8 }));
        n.rotation.x = -Math.PI / 2;
        g.add(n);
        g.add(new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), addMat(0xf472b6, 0.5)));
        break;
      }
      case 'flare': {
        g.add(new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffedd5 })));
        g.add(new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), addMat(0xf97316, 0.5)));
        break;
      }
      case 'beacon': {
        g.add(new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), new THREE.MeshBasicMaterial({ color: 0xfecaca })));
        g.add(new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 8), addMat(0xef4444, 0.45)));
        break;
      }
      case 'canister': {
        const steel = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.8, roughness: 0.3 });
        g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.42, 10), steel));
        g.add(new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.025, 6, 16), new THREE.MeshBasicMaterial({ color: 0x818cf8 })));
        break;
      }
    }
    this.scene.add(g);
    return g;
  }

  private addBolt(kind: Bolt['kind'], origin: THREE.Vector3, vel: THREE.Vector3, gravity: number, dmg: number, life: number, radius: number) {
    const mesh = this.boltMesh(kind);
    mesh.position.copy(origin);
    this.bolts.push({ kind, mesh, pos: origin.clone(), vel: vel.clone(), gravity, dmg, life, radius });
  }

  fireChrono(ctx: ArsenalCtx, origin: THREE.Vector3, dir: THREE.Vector3, dmg: number) {
    this.addBolt('chrono', origin, dir.clone().multiplyScalar(120), 0, dmg, 0.6, 0.3);
    void ctx;
  }
  fireNeedle(ctx: ArsenalCtx, origin: THREE.Vector3, dir: THREE.Vector3, dmg: number) {
    this.addBolt('needle', origin, dir.clone().multiplyScalar(72), 0, dmg, 0.8, 0.28);
    void ctx;
  }
  fireFlare(ctx: ArsenalCtx, origin: THREE.Vector3, dir: THREE.Vector3, dmg: number) {
    this.addBolt('flare', origin, dir.clone().multiplyScalar(58).add(new THREE.Vector3(0, 2, 0)), 9, dmg, 2.2, 0.35);
    void ctx;
  }
  fireMeteorBeacon(ctx: ArsenalCtx, origin: THREE.Vector3, dir: THREE.Vector3, dmg: number) {
    this.addBolt('beacon', origin, dir.clone().multiplyScalar(62).add(new THREE.Vector3(0, 2.5, 0)), 14, dmg, 3.0, 0.4);
    ctx.sfx.heavy();
  }
  deploySentry(ctx: ArsenalCtx, origin: THREE.Vector3, dir: THREE.Vector3, dmg: number) {
    const flat = dir.clone().setY(0).normalize();
    this.addBolt('canister', origin, flat.multiplyScalar(15).add(new THREE.Vector3(0, 7 + dir.y * 6, 0)), 22, dmg, 4, 0.3);
    ctx.sfx.heavy();
  }

  private updateBolts(ctx: ArsenalCtx) {
    const dt = ctx.delta;
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i];
      b.life -= dt;
      const prev = b.pos.clone();
      // SPINE NEEDLER: needles curve gently toward the nearest enemy in front of them
      if (b.kind === 'needle') {
        let best: ArsenalEnemy | null = null;
        let bestScore = -1;
        const dir = b.vel.clone().normalize();
        for (const e of ctx.enemies) {
          if (e.isDead) continue;
          ctx.hitbox(e, _a);
          _c.subVectors(_a, b.pos);
          const d = _c.length();
          if (d > 40) continue;
          const dot = _c.normalize().dot(dir);
          if (dot > 0.9 && dot > bestScore) {
            bestScore = dot;
            best = e;
          }
        }
        if (best) {
          ctx.hitbox(best, _a);
          const want = _a.sub(b.pos).normalize().multiplyScalar(b.vel.length());
          b.vel.lerp(want, Math.min(1, dt * 5));
        }
      }
      b.vel.y -= b.gravity * dt;
      b.pos.addScaledVector(b.vel, dt);
      b.mesh.position.copy(b.pos);
      if (b.vel.lengthSq() > 1e-4) b.mesh.lookAt(b.pos.clone().sub(b.vel));
      if (b.kind === 'chrono') b.mesh.rotateZ(ctx.time * 20);
      if (b.kind === 'flare' && Math.random() < 0.6) ctx.sparks(b.pos.clone(), Math.random() < 0.5 ? '#f97316' : '#fde68a', 1);

      // enemy hit (canisters ignore enemies)
      let hitEnemy: { e: ArsenalEnemy; at: THREE.Vector3 } | null = null;
      if (b.kind !== 'canister') hitEnemy = this.sweep(ctx, prev, b.pos, b.radius);
      const ground = b.pos.y <= 0.05;
      const cover = inCover(ctx, b.pos);
      const wall = Math.abs(b.pos.x) > ctx.arenaHalf || Math.abs(b.pos.z) > ctx.arenaHalf;
      let remove = b.life <= 0;
      if (hitEnemy) {
        this.onBoltHitEnemy(ctx, b, hitEnemy.e, hitEnemy.at);
        remove = true;
      } else if (ground || cover || wall) {
        const at = b.pos.clone();
        if (ground) at.y = 0;
        this.onBoltHitWorld(ctx, b, at, !!cover && !ground);
        remove = true;
      } else if (b.life <= 0) {
        if (b.kind === 'beacon' || b.kind === 'canister') this.onBoltHitWorld(ctx, b, b.pos.clone().setY(0), false);
      }
      if (remove) {
        disposeObj(this.scene, b.mesh);
        this.bolts.splice(i, 1);
      }
    }
  }

  private onBoltHitEnemy(ctx: ArsenalCtx, b: Bolt, e: ArsenalEnemy, at: THREE.Vector3) {
    switch (b.kind) {
      case 'chrono': {
        // 40% lands now, the rest is stored in a time mark that detonates later
        ctx.damage(e, Math.round(b.dmg * 0.4), 'TIME', '#c4b5fd');
        let m = this.marks.get(e);
        if (!m) {
          const ring = new THREE.Group();
          ring.add(new THREE.Mesh(new THREE.RingGeometry(0.55, 0.62, 40), addMat(0xc4b5fd, 0.9)));
          const pips: THREE.Mesh[] = [];
          for (let k = 0; k < 12; k++) {
            const a = (k / 12) * Math.PI * 2;
            const pip = new THREE.Mesh(new THREE.CircleGeometry(0.06, 8), addMat(0xffffff, 0.15));
            pip.position.set(Math.sin(a) * 0.45, Math.cos(a) * 0.45, 0);
            ring.add(pip);
            pips.push(pip);
          }
          const hand = new THREE.Mesh(new THREE.PlaneGeometry(0.04, 0.4), addMat(0xfde68a, 0.9));
          hand.position.y = 0.2;
          const handPivot = new THREE.Group();
          handPivot.name = 'hand';
          handPivot.add(hand);
          ring.add(handPivot);
          this.scene.add(ring);
          m = { stored: 0, count: 0, timer: CHRONO_DELAY, ring, pips };
          this.marks.set(e, m);
        }
        m.stored += b.dmg * 0.6;
        m.count = Math.min(12, m.count + 1);
        ctx.sparks(at, '#c4b5fd', 8);
        ctx.sfx.hit();
        break;
      }
      case 'needle': {
        ctx.damage(e, Math.round(b.dmg), 'NEEDLE', '#f472b6', true);
        let st = this.needles.get(e);
        if (!st) {
          st = { n: 0, t: 0, spikes: [] };
          this.needles.set(e, st);
        }
        st.n++;
        st.t = 0;
        // a crystal spike stays stuck in the target
        const spike = new THREE.Group();
        const cr = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.42, 5), new THREE.MeshBasicMaterial({ color: 0xfbcfe8 }));
        cr.rotation.x = Math.PI / 2;
        spike.add(cr);
        spike.add(new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), addMat(0xf472b6, 0.45)));
        e.mesh.updateMatrixWorld(true);
        const local = e.mesh.worldToLocal(at.clone());
        spike.position.copy(local);
        spike.lookAt(local.clone().add(b.vel.clone().normalize().multiplyScalar(-1)));
        e.mesh.add(spike);
        st.spikes.push(spike);
        ctx.sparks(at, '#f9a8d4', 5);
        const need = ctx.hasSkill('needle_mod_super') ? 5 : 7;
        if (st.n >= need) this.supercombine(ctx, e, b.dmg);
        break;
      }
      case 'flare': {
        ctx.damage(e, Math.round(b.dmg), 'FLARE', '#f97316');
        this.markFlare(ctx, e, at, 5);
        if (ctx.hasSkill('flare_mod_burst')) {
          let k = 0;
          for (const o of ctx.enemies) {
            if (o === e || o.isDead || k >= 4) continue;
            if (o.mesh.position.distanceTo(e.mesh.position) > 9) continue;
            k++;
            ctx.hitbox(o, _a);
            this.markFlare(ctx, o, _a.clone(), 3);
            this.zapLine(at, _a.clone(), 0xf97316);
          }
        }
        ctx.sfx.hit();
        break;
      }
      case 'beacon':
        this.plantMeteor(ctx, at.clone().setY(0), b.dmg);
        break;
    }
  }

  private onBoltHitWorld(ctx: ArsenalCtx, b: Bolt, at: THREE.Vector3, onCover: boolean) {
    switch (b.kind) {
      case 'flare':
        // a missed flare sets the floor on fire
        this.addPatch(at.clone().setY(0), 2.6, 3, 20);
        ctx.sparks(at, '#f97316', 12);
        break;
      case 'beacon':
        this.plantMeteor(ctx, at.clone().setY(0), b.dmg);
        break;
      case 'canister':
        this.spawnTurret(ctx, at.clone().setY(onCover ? at.y : 0), b.dmg);
        break;
      default:
        ctx.sparks(at, b.kind === 'chrono' ? '#c4b5fd' : '#f9a8d4', 4);
    }
  }

  private markFlare(ctx: ArsenalCtx, e: ArsenalEnemy, at: THREE.Vector3, dur: number) {
    e.burnTimer = Math.max(e.burnTimer ?? 0, dur);
    e.burnDps = Math.max(e.burnDps ?? 0, 25);
    e.vulnTimer = Math.max(e.vulnTimer ?? 0, dur);
    e.vulnMul = ctx.hasSkill('flare_mod_expose') ? 0.4 : 0.25;
    // the flare itself stays stuck in the target and keeps sputtering
    const f = new THREE.Group();
    f.add(new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfff7ed })));
    const halo = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), addMat(0xf97316, 0.4));
    f.add(halo);
    e.mesh.updateMatrixWorld(true);
    f.position.copy(e.mesh.worldToLocal(at.clone()));
    f.userData.flareLife = dur;
    e.mesh.add(f);
    this.stuckFlares.push({ obj: f, e, life: dur });
    ctx.text('MARKED', '#f97316');
  }
  private stuckFlares: { obj: THREE.Object3D; e: ArsenalEnemy; life: number }[] = [];

  private supercombine(ctx: ArsenalCtx, e: ArsenalEnemy, needleDmg: number) {
    const st = this.needles.get(e);
    if (st) {
      st.spikes.forEach((sp) => disposeObj(null, sp));
      this.needles.delete(e);
    }
    ctx.hitbox(e, _a);
    const at = _a.clone();
    const mul = ctx.hasSkill('needle_mod_blast') ? 1.5 : 1;
    ctx.damage(e, Math.round(needleDmg * 9 * mul), 'SUPERCOMBINE', '#f472b6');
    e.attackCooldown = Math.max(e.attackCooldown, 0.8);
    this.explode(ctx, at, 3.6, needleDmg * 4 * mul, 0xf472b6, 'SHARD BURST', 10);
    ctx.shake(0.06, 0.25);
    ctx.text('SUPERCOMBINE!', '#f9a8d4');
  }

  // ───────────────────────── MICRO HIVE (lock-on missiles) ─────────────────────────
  /** Call every frame while the trigger is held. */
  hiveHold(ctx: ArsenalCtx, maxLocks: number, fwd: THREE.Vector3) {
    if (!this.hiveHolding) {
      this.hiveHolding = true;
      this.lockT = 0;
      this.locks = [];
    }
    this.lockT -= ctx.delta;
    if (this.lockT > 0 || this.locks.length >= maxLocks) return;
    // candidate closest to the crosshair inside a 14° cone (max 3 locks per enemy)
    let best: ArsenalEnemy | null = null;
    let bestDot = Math.cos((14 * Math.PI) / 180);
    for (const e of ctx.enemies) {
      if (e.isDead) continue;
      const count = this.locks.filter((x) => x === e).length;
      if (count >= 3) continue;
      ctx.hitbox(e, _a);
      _c.subVectors(_a, ctx.player);
      const d = _c.length();
      if (d > 65) continue;
      const dot = _c.normalize().dot(fwd) - count * 0.02;
      if (dot > bestDot) {
        bestDot = dot;
        best = e;
      }
    }
    if (!best) return;
    this.lockT = 0.12;
    this.locks.push(best);
    ctx.sfx.scan();
    let marker = this.lockMarkers.get(best);
    if (!marker) {
      marker = new THREE.Group();
      const diamond = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.7, 4), addMat(0xfb7185, 0.95));
      marker.add(diamond);
      const inner = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.44, 4), addMat(0xffffff, 0.8));
      inner.name = 'inner';
      marker.add(inner);
      this.scene.add(marker);
      this.lockMarkers.set(best, marker);
    }
    marker.userData.count = this.locks.filter((x) => x === best).length;
    marker.scale.setScalar(1.6);
  }

  /** Trigger released: one missile per lock (limited by ammo). Returns how many were fired. */
  hiveRelease(ctx: ArsenalCtx, origin: THREE.Vector3, fwd: THREE.Vector3, dmg: number, ammo: number): number {
    this.hiveHolding = false;
    const locks = this.locks.length ? this.locks.slice(0, ammo) : ammo > 0 ? [null] : [];
    this.locks = [];
    this.lockMarkers.forEach((m) => disposeObj(this.scene, m));
    this.lockMarkers.clear();
    const warhead = ctx.hasSkill('hive_mod_warhead');
    const right = new THREE.Vector3().crossVectors(fwd, UP).normalize();
    locks.forEach((target, i) => {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 0.4, 8), new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.7, roughness: 0.3 }));
      body.rotation.x = Math.PI / 2;
      g.add(body);
      const nose = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.14, 8), new THREE.MeshBasicMaterial({ color: 0xfb7185 }));
      nose.rotation.x = -Math.PI / 2;
      nose.position.z = -0.27;
      g.add(nose);
      const exhaust = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), addMat(0xfda4af, 0.8));
      exhaust.position.z = 0.22;
      g.add(exhaust);
      g.position.copy(origin);
      this.scene.add(g);
      // fan the salvo out before the missiles turn onto their targets
      const fan = (i - (locks.length - 1) / 2) * 0.35;
      const vel = fwd.clone().multiplyScalar(14).addScaledVector(right, fan * 10).add(new THREE.Vector3(0, 6 + Math.random() * 3, 0));
      this.missiles.push({ mesh: g, pos: origin.clone(), vel, target, dmg: dmg * (warhead ? 1.4 : 1), radius: warhead ? 3.2 : 2.2, life: 4, age: -i * 0.04, trailT: 0 });
    });
    if (locks.length > 1) ctx.text(`SALVO ×${locks.length}`, '#fb7185');
    ctx.sfx.heavy();
    return locks.length;
  }

  private updateMissiles(ctx: ArsenalCtx) {
    const dt = ctx.delta;
    // lock markers follow their targets
    this.lockMarkers.forEach((m, e) => {
      if (e.isDead) {
        disposeObj(this.scene, m);
        this.lockMarkers.delete(e);
        return;
      }
      ctx.hitbox(e, _a);
      m.position.copy(_a);
      m.quaternion.copy(ctx.camera.quaternion);
      m.scale.setScalar(Math.max(1, m.scale.x - dt * 4));
      const inner = m.getObjectByName('inner');
      if (inner) inner.rotation.z += dt * (2 + (m.userData.count ?? 1) * 2);
    });
    for (let i = this.missiles.length - 1; i >= 0; i--) {
      const m = this.missiles[i];
      m.age += dt;
      if (m.age < 0) continue;
      m.life -= dt;
      const prev = m.pos.clone();
      if (m.target && m.target.isDead) m.target = null;
      if (!m.target) {
        // retarget the nearest enemy ahead
        let best: ArsenalEnemy | null = null;
        let bd = 30;
        for (const e of ctx.enemies) {
          if (e.isDead) continue;
          const d = e.mesh.position.distanceTo(m.pos);
          if (d < bd) {
            bd = d;
            best = e;
          }
        }
        m.target = best;
      }
      const speed = Math.min(44, 16 + m.age * 50);
      if (m.target && m.age > 0.18) {
        ctx.hitbox(m.target, _a);
        const want = _a.clone().sub(m.pos).normalize().multiplyScalar(speed);
        m.vel.lerp(want, Math.min(1, dt * (3 + m.age * 6)));
      } else {
        m.vel.y -= 6 * dt;
      }
      m.vel.setLength(speed);
      m.pos.addScaledVector(m.vel, dt);
      m.mesh.position.copy(m.pos);
      m.mesh.lookAt(m.pos.clone().add(m.vel));
      m.mesh.rotateY(Math.PI);
      m.trailT -= dt;
      if (m.trailT <= 0) {
        m.trailT = 0.03;
        ctx.sparks(m.pos.clone(), '#fecdd3', 1);
      }
      const hit = this.sweep(ctx, prev, m.pos, 0.35);
      if (hit || m.pos.y <= 0.1 || inCover(ctx, m.pos) || m.life <= 0) {
        this.explode(ctx, hit ? hit.at : m.pos.clone(), m.radius, m.dmg, 0xfb7185, 'MISSILE', 6);
        disposeObj(this.scene, m.mesh);
        this.missiles.splice(i, 1);
      }
    }
  }

  // ───────────────────────── ECHO RESONATOR (sonic rings) ─────────────────────────
  fireSonic(ctx: ArsenalCtx, origin: THREE.Vector3, dir: THREE.Vector3, dmg: number, range: number) {
    const wide = ctx.hasSkill('sonic_mod_wide') ? 1.5 : 1;
    const g = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.035, 6, 48), addMat(0x93c5fd, 0.9));
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.02, 6, 40), addMat(0xffffff, 0.7));
    const film = new THREE.Mesh(new THREE.CircleGeometry(1, 40), addMat(0x60a5fa, 0.12));
    g.add(ring, ring2, film);
    g.position.copy(origin);
    g.lookAt(origin.clone().add(dir));
    this.scene.add(g);
    const speed = 36;
    this.sonics.push({ mesh: g, pos: origin.clone(), dir: dir.clone().normalize(), speed, age: 0, life: range / speed, r0: 0.5 * wide, r1: 2.6 * wide, dmg, hit: new Set() });
    void ctx;
  }

  private updateSonics(ctx: ArsenalCtx) {
    const dt = ctx.delta;
    const resPer = ctx.hasSkill('sonic_mod_resonance') ? 0.25 : 0.15;
    for (let i = this.sonics.length - 1; i >= 0; i--) {
      const s = this.sonics[i];
      s.age += dt;
      const k = Math.min(1, s.age / s.life);
      const prev = s.pos.clone();
      s.pos.addScaledVector(s.dir, s.speed * dt);
      const r = s.r0 + (s.r1 - s.r0) * Math.sqrt(k);
      s.mesh.position.copy(s.pos);
      s.mesh.scale.setScalar(r);
      s.mesh.children.forEach((ch, idx) => {
        const mat = (ch as THREE.Mesh).material as THREE.MeshBasicMaterial;
        mat.opacity = (idx === 2 ? 0.12 : idx === 1 ? 0.7 : 0.9) * (1 - k * 0.8);
      });
      (s.mesh.children[1] as THREE.Object3D).scale.setScalar(0.85 + Math.sin(s.age * 40) * 0.08);
      // passes through cover and every enemy: each enemy is hit once
      for (const e of ctx.enemies) {
        if (e.isDead || s.hit.has(e)) continue;
        const rr = ctx.hitbox(e, _a);
        const d = segDist(prev, s.pos, _a, _b);
        if (d > r + rr * 0.6) continue;
        s.hit.add(e);
        let near = 0;
        for (const o of ctx.enemies) if (o !== e && !o.isDead && o.mesh.position.distanceTo(e.mesh.position) < 5) near++;
        const mul = 1 + Math.min(4, near) * resPer;
        ctx.damage(e, Math.round(s.dmg * mul), near > 0 ? `RESONANCE ×${near + 1}` : 'SONIC', '#93c5fd');
        e.velocity.addScaledVector(s.dir, 6);
        ctx.sparks(_a.clone(), '#bfdbfe', 6);
      }
      if (k >= 1) {
        disposeObj(this.scene, s.mesh);
        this.sonics.splice(i, 1);
      }
    }
  }

  // ───────────────────────── BUZZ RIPPER (ricochet saws) ─────────────────────────
  fireSaw(ctx: ArsenalCtx, origin: THREE.Vector3, dir: THREE.Vector3, dmg: number) {
    const g = new THREE.Group();
    const steel = new THREE.MeshStandardMaterial({ color: 0xd1d5db, metalness: 0.95, roughness: 0.15 });
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.025, 28), steel);
    g.add(disc);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const t = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.12, 3), steel);
      t.position.set(Math.cos(a) * 0.38, 0, Math.sin(a) * 0.38);
      t.rotation.set(0, -a, Math.PI / 2);
      g.add(t);
    }
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.05, 12), new THREE.MeshBasicMaterial({ color: 0xfacc15 })));
    const blur = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.5, 32), addMat(0xfacc15, 0.35));
    blur.rotation.x = -Math.PI / 2;
    g.add(blur);
    g.position.copy(origin);
    this.scene.add(g);
    const flat = dir.clone();
    flat.y *= 0.4;
    flat.normalize();
    this.saws.push({ mesh: g, pos: origin.clone(), vel: flat.multiplyScalar(30), dmg, life: 3.6, bounces: ctx.hasSkill('buzz_mod_bounce') ? 6 : 3, stuck: null, grindLeft: 0, tick: 0, ignore: new Map() });
  }

  private updateSaws(ctx: ArsenalCtx) {
    const dt = ctx.delta;
    const grindTime = ctx.hasSkill('buzz_mod_grind') ? 1.0 : 0.6;
    for (let i = this.saws.length - 1; i >= 0; i--) {
      const s = this.saws[i];
      s.life -= dt;
      s.mesh.rotation.y += dt * 40;
      if (s.stuck) {
        // grinding: ride the target and deal rapid ticks
        const e = s.stuck;
        if (e.isDead) {
          s.stuck = null;
        } else {
          ctx.hitbox(e, _a);
          s.pos.lerp(_a.clone().addScaledVector(s.vel.clone().normalize(), -0.6), Math.min(1, dt * 20));
          s.mesh.position.copy(s.pos);
          s.tick -= dt;
          if (s.tick <= 0) {
            s.tick = 0.1;
            this.tickDamage(ctx, e, Math.round(s.dmg * 0.55), 'GRIND', '#facc15');
            e.velocity.multiplyScalar(0.4);
            e.attackCooldown = Math.max(e.attackCooldown, 0.25);
            if (ctx.hasSkill('buzz_mod_grind')) {
              e.bleedTimer = 3;
              e.bleedDps = Math.max(e.bleedDps ?? 0, 18);
            }
            ctx.sparks(s.pos.clone(), Math.random() < 0.5 ? '#facc15' : '#fde68a', 5);
            ctx.sfx.zap();
          }
          s.grindLeft -= dt;
          if (s.grindLeft <= 0) {
            s.ignore.set(e, ctx.time + 0.6);
            s.stuck = null;
          }
          continue;
        }
      }
      const prev = s.pos.clone();
      s.pos.addScaledVector(s.vel, dt);
      // keep near waist height
      s.pos.y += (1.1 - s.pos.y) * Math.min(1, dt * 3);
      // bounce off arena walls and cover
      const H = ctx.arenaHalf;
      let bounced = false;
      if (Math.abs(s.pos.x) > H) {
        s.vel.x *= -1;
        s.pos.x = Math.sign(s.pos.x) * H;
        bounced = true;
      }
      if (Math.abs(s.pos.z) > H) {
        s.vel.z *= -1;
        s.pos.z = Math.sign(s.pos.z) * H;
        bounced = true;
      }
      const cov = inCover(ctx, s.pos);
      if (cov) {
        const b = cov.box;
        const dx = Math.min(Math.abs(prev.x - b.minX), Math.abs(prev.x - b.maxX));
        const dz = Math.min(Math.abs(prev.z - b.minZ), Math.abs(prev.z - b.maxZ));
        if (dx < dz) s.vel.x *= -1;
        else s.vel.z *= -1;
        s.pos.copy(prev);
        bounced = true;
      }
      if (bounced) {
        s.bounces--;
        ctx.sparks(s.pos.clone(), '#fde68a', 10);
        ctx.sfx.hit();
      }
      s.mesh.position.copy(s.pos);
      const hit = this.sweep(ctx, prev, s.pos, 0.45, (e) => (s.ignore.get(e) ?? -1) > ctx.time);
      if (hit) {
        s.stuck = hit.e;
        s.grindLeft = grindTime;
        s.tick = 0;
        ctx.damage(hit.e, Math.round(s.dmg), 'BUZZ', '#facc15');
      }
      if (s.life <= 0 || s.bounces < 0) {
        ctx.sparks(s.pos.clone(), '#facc15', 12);
        disposeObj(this.scene, s.mesh);
        this.saws.splice(i, 1);
      }
    }
  }

  // ───────────────────────── METEOR CALLER ─────────────────────────
  private plantMeteor(ctx: ArsenalCtx, at: THREE.Vector3, dmg: number, mini = false) {
    const beacon = new THREE.Group();
    beacon.position.copy(at).setY(0.05);
    const ring = new THREE.Mesh(new THREE.RingGeometry(mini ? 2.6 : 5.6, mini ? 2.9 : 6.2, 56), addMat(0xef4444, 0.8));
    ring.rotation.x = -Math.PI / 2;
    const inner = new THREE.Mesh(new THREE.CircleGeometry(mini ? 2.9 : 6.2, 56), addMat(0xef4444, 0.12));
    inner.rotation.x = -Math.PI / 2;
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 40, 8, 1, true), addMat(0xfca5a5, 0.5));
    beam.position.y = 20;
    beacon.add(ring, inner, beam);
    this.scene.add(beacon);
    this.meteors.push({ phase: 'beacon', t: 0, at: at.clone(), beacon, rock: null, dmg, mini });
    if (!mini) {
      ctx.text('METEOR INBOUND', '#ef4444');
      ctx.sfx.scan();
    }
  }

  private updateMeteors(ctx: ArsenalCtx) {
    const dt = ctx.delta;
    const FALL = 0.55;
    for (let i = this.meteors.length - 1; i >= 0; i--) {
      const m = this.meteors[i];
      m.t += dt;
      const lead = m.mini ? 0.25 : 1.1;
      const pulse = 0.6 + 0.4 * Math.sin(m.t * 24);
      m.beacon.children.forEach((ch, idx) => {
        const mat = (ch as THREE.Mesh).material as THREE.MeshBasicMaterial;
        mat.opacity = (idx === 0 ? 0.85 : idx === 1 ? 0.14 : 0.5) * pulse;
      });
      (m.beacon.children[0] as THREE.Object3D).scale.setScalar(1 - Math.min(1, m.t / (lead + FALL)) * 0.2);
      if (m.phase === 'beacon' && m.t >= lead) {
        m.phase = 'fall';
        const rock = new THREE.Group();
        const R = m.mini ? 0.8 : 1.6;
        const stone = new THREE.Mesh(new THREE.IcosahedronGeometry(R, 1), new THREE.MeshStandardMaterial({ color: 0x3f2a1e, roughness: 0.9, emissive: 0xff4a1a, emissiveIntensity: 0.6, flatShading: true }));
        rock.add(stone);
        rock.add(new THREE.Mesh(new THREE.SphereGeometry(R * 1.5, 14, 10), addMat(0xff7a1a, 0.5)));
        const trail = new THREE.Mesh(new THREE.ConeGeometry(R * 1.3, R * 12, 14, 1, true), addMat(0xffb36b, 0.5));
        trail.position.y = R * 6;
        rock.add(trail);
        this.scene.add(rock);
        m.rock = rock;
      }
      if (m.phase === 'fall' && m.rock) {
        const k = Math.min(1, (m.t - lead) / FALL);
        const from = m.at.clone().add(new THREE.Vector3(8, 42, -8));
        m.rock.position.lerpVectors(from, m.at, k * k);
        m.rock.lookAt(m.at);
        m.rock.rotateX(-Math.PI / 2);
        m.rock.children[0].rotation.x += dt * 6;
        if (Math.random() < 0.8) ctx.sparks(m.rock.position.clone(), Math.random() < 0.5 ? '#ff7a1a' : '#fde68a', 2);
        if (k >= 1) {
          const radius = m.mini ? 3.4 : 7;
          this.explode(ctx, m.at.clone().setY(0.5), radius, m.dmg * (m.mini ? 0.45 : 1), 0xff5a1a, m.mini ? 'FRAGMENT' : 'METEOR', m.mini ? 8 : 16);
          for (const e of ctx.enemies) {
            if (!e.isDead && e.mesh.position.distanceTo(m.at) < radius) e.velocity.y += 6;
          }
          ctx.shake(m.mini ? 0.08 : 0.22, m.mini ? 0.2 : 0.5);
          if (!m.mini) {
            const crater = ctx.hasSkill('meteor_mod_crater');
            this.addPatch(m.at, crater ? 6 : 4.5, crater ? 5 : 3, 30);
            if (ctx.hasSkill('meteor_mod_cluster')) {
              for (let k2 = 0; k2 < 3; k2++) {
                const a = (k2 / 3) * Math.PI * 2 + Math.random();
                this.plantMeteor(ctx, m.at.clone().add(new THREE.Vector3(Math.cos(a) * 5.5, 0, Math.sin(a) * 5.5)), m.dmg, true);
              }
            }
          }
          disposeObj(this.scene, m.rock);
          disposeObj(this.scene, m.beacon);
          this.meteors.splice(i, 1);
        }
      }
    }
  }

  // ───────────────────────── VOLT SENTRY ─────────────────────────
  private spawnTurret(ctx: ArsenalCtx, at: THREE.Vector3, dmg: number) {
    if (this.turrets.length >= 2) {
      const old = this.turrets.shift()!;
      disposeObj(this.scene, old.mesh);
    }
    const g = new THREE.Group();
    const steel = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8, roughness: 0.3 });
    const coilMat = new THREE.MeshStandardMaterial({ color: 0xb45309, metalness: 0.9, roughness: 0.3 });
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.6, 0.25, 8), steel));
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 1.5, 8), steel);
    mast.position.y = 0.9;
    g.add(mast);
    for (let i = 0; i < 5; i++) {
      const c = new THREE.Mesh(new THREE.TorusGeometry(0.22 - i * 0.02, 0.03, 6, 18), coilMat);
      c.rotation.x = Math.PI / 2;
      c.position.y = 0.45 + i * 0.2;
      g.add(c);
    }
    [-1, 1].forEach((s) => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.9), steel);
      leg.position.set(0, 0.05, 0);
      leg.rotation.y = s * 0.8;
      g.add(leg);
    });
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10), new THREE.MeshBasicMaterial({ color: 0xe0e7ff }));
    orb.position.y = 1.8;
    g.add(orb);
    const halo = new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 10), addMat(0x818cf8, 0.35));
    halo.position.y = 1.8;
    g.add(halo);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.02, 6, 28), addMat(0xc7d2fe, 0.8));
    ring.position.y = 1.8;
    ring.name = 'ring';
    g.add(ring);
    g.position.copy(at);
    g.scale.setScalar(0.01);
    this.scene.add(g);
    const life = ctx.hasSkill('sentry_mod_life') ? 24 : 16;
    this.turrets.push({ mesh: g, orb, pos: at.clone(), life, zapT: 0.5, dmg, rise: 0 });
    ctx.sparks(at.clone().setY(0.5), '#818cf8', 16);
    ctx.text('VOLT SENTRY ONLINE', '#a5b4fc');
    ctx.sfx.scan();
  }

  private zapMats = new Map<number, THREE.LineBasicMaterial>();

  private zapLine(a: THREE.Vector3, b: THREE.Vector3, color: number) {
    const pts: THREE.Vector3[] = [];
    const segs = 8;
    for (let i = 0; i <= segs; i++) {
      const p = a.clone().lerp(b, i / segs);
      if (i > 0 && i < segs) p.add(new THREE.Vector3((Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.5));
      pts.push(p);
    }
    // shared per-colour materials: creating / disposing one per zap churns shader programs
    let mat = this.zapMats.get(color);
    if (!mat) {
      mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false });
      this.zapMats.set(color, mat);
    }
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat);
    this.scene.add(line);
    this.zaps.push({ line, life: 0.14 });
  }

  private updateTurrets(ctx: ArsenalCtx) {
    const dt = ctx.delta;
    const chains = ctx.hasSkill('sentry_mod_chain') ? 4 : 2;
    const rate = ctx.hasSkill('sentry_mod_life') ? 0.32 : 0.45;
    for (let i = this.turrets.length - 1; i >= 0; i--) {
      const t = this.turrets[i];
      t.life -= dt;
      t.rise = Math.min(1, t.rise + dt * 3);
      t.mesh.scale.setScalar(Math.max(0.01, 1 - Math.pow(1 - t.rise, 3)));
      const ring = t.mesh.getObjectByName('ring');
      if (ring) ring.rotation.x += dt * 3;
      t.orb.scale.setScalar(1 + Math.sin(ctx.time * 9 + i) * 0.12);
      t.zapT -= dt;
      if (t.zapT <= 0 && t.rise >= 1) {
        t.zapT = rate;
        const orbPos = t.orb.getWorldPosition(new THREE.Vector3());
        let target: ArsenalEnemy | null = null;
        let bd = 15;
        for (const e of ctx.enemies) {
          if (e.isDead) continue;
          const d = e.mesh.position.distanceTo(t.pos);
          if (d < bd) {
            bd = d;
            target = e;
          }
        }
        if (target) {
          const hit = new Set<ArsenalEnemy>([target]);
          ctx.hitbox(target, _a);
          let last = _a.clone();
          this.zapLine(orbPos, last, 0xc7d2fe);
          this.tickDamage(ctx, target, Math.round(t.dmg), 'VOLT', '#a5b4fc');
          target.shockTimer = Math.max(target.shockTimer ?? 0, 1.2);
          let dmg = t.dmg * 0.6;
          for (let c = 0; c < chains; c++) {
            let next: ArsenalEnemy | null = null;
            let nd = 7.5;
            for (const e of ctx.enemies) {
              if (e.isDead || hit.has(e)) continue;
              ctx.hitbox(e, _b);
              const d = _b.distanceTo(last);
              if (d < nd) {
                nd = d;
                next = e;
              }
            }
            if (!next) break;
            hit.add(next);
            ctx.hitbox(next, _b);
            this.zapLine(last, _b.clone(), 0x818cf8);
            this.tickDamage(ctx, next, Math.round(dmg), 'VOLT', '#a5b4fc');
            next.shockTimer = Math.max(next.shockTimer ?? 0, 1.0);
            last = _b.clone();
            dmg *= 0.75;
          }
          ctx.sparks(_a.clone(), '#c7d2fe', 6);
          ctx.sfx.zap();
        }
      }
      if (t.life <= 0) {
        ctx.sparks(t.pos.clone().setY(1), '#818cf8', 18);
        disposeObj(this.scene, t.mesh);
        this.turrets.splice(i, 1);
      }
    }
    for (let i = this.zaps.length - 1; i >= 0; i--) {
      const z = this.zaps[i];
      z.life -= dt;
      z.line.visible = Math.random() > 0.2;
      if (z.life <= 0) {
        this.scene.remove(z.line);
        z.line.geometry.dispose();
        this.zaps.splice(i, 1);
      }
    }
  }

  // ───────────────────────── INFERNO ROAR ─────────────────────────
  private patchT = 0;

  /** One tick of the flamethrower (called at the weapon's fire rate while the trigger is held). */
  sprayInferno(ctx: ArsenalCtx, origin: THREE.Vector3, dir: THREE.Vector3, dmg: number) {
    const range = ctx.hasSkill('inferno_mod_range') ? 14 : 10;
    const napalm = ctx.hasSkill('inferno_mod_napalm');
    const cosHalf = Math.cos((15 * Math.PI) / 180);
    for (const e of ctx.enemies) {
      if (e.isDead) continue;
      ctx.hitbox(e, _a);
      _c.subVectors(_a, origin);
      const d = _c.length();
      if (d > range + 1) continue;
      if (_c.normalize().dot(dir) < cosHalf && d > 2) continue;
      // flames do not pass through cover
      let blocked = false;
      for (let s = 1; s <= 4 && !blocked; s++) {
        _b.copy(origin).addScaledVector(dir, (d * s) / 5);
        if (inCover(ctx, _b)) blocked = true;
      }
      if (blocked) continue;
      this.tickDamage(ctx, e, Math.round(dmg), 'SCORCH', '#fb923c');
      e.burnTimer = Math.max(e.burnTimer ?? 0, 3);
      e.burnDps = Math.min(napalm ? 60 : 40, (e.burnDps ?? 0) + (napalm ? 5 : 3.5));
    }
    // flame particles
    for (let i = 0; i < 5; i++) {
      if (this.flames.length > 260) break;
      const m = new THREE.Mesh(this.flameGeo, new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
      const spread = new THREE.Vector3((Math.random() - 0.5) * 0.28, (Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.28);
      const v = dir.clone().add(spread).normalize().multiplyScalar(range * (1.5 + Math.random() * 0.6));
      m.position.copy(origin).addScaledVector(dir, 0.3 + Math.random() * 0.4);
      m.scale.setScalar(0.08);
      this.scene.add(m);
      this.flames.push({ mesh: m, vel: v, age: 0, life: 0.42 + Math.random() * 0.15, size: 0.5 + Math.random() * 0.5 });
    }
    // the spray sets the floor at the end of the cone alight
    this.patchT -= 1 / 20;
    if (this.patchT <= 0) {
      this.patchT = 0.45;
      const end = origin.clone().addScaledVector(dir, range * 0.85);
      if (dir.y < 0.25) {
        end.y = 0;
        this.addPatch(end, napalm ? 2.4 : 1.7, 2.5, napalm ? 22 : 15);
      }
    }
  }

  private updateFlames(ctx: ArsenalCtx) {
    const dt = ctx.delta;
    for (let i = this.flames.length - 1; i >= 0; i--) {
      const f = this.flames[i];
      f.age += dt;
      const k = f.age / f.life;
      f.vel.multiplyScalar(Math.pow(0.12, dt));
      f.vel.y += 6 * dt;
      f.mesh.position.addScaledVector(f.vel, dt);
      f.mesh.scale.setScalar(0.08 + f.size * Math.sqrt(k) * 1.1);
      const mat = f.mesh.material as THREE.MeshBasicMaterial;
      // yellow → orange → deep red smoke
      mat.color.setHSL(0.13 - k * 0.12, 1, 0.6 - k * 0.35);
      mat.opacity = 0.85 * (1 - k);
      if (k >= 1 || inCover(ctx, f.mesh.position)) {
        this.scene.remove(f.mesh);
        mat.dispose();
        this.flames.splice(i, 1);
      }
    }
    for (let i = this.patches.length - 1; i >= 0; i--) {
      const p = this.patches[i];
      p.life -= dt;
      p.tick -= dt;
      const k = p.life / p.max;
      p.mesh.children.forEach((ch, idx) => {
        const mat = (ch as THREE.Mesh).material as THREE.MeshBasicMaterial;
        if (idx >= 2) {
          ch.position.y = (ch.userData.base ?? 0.4) + Math.sin(ctx.time * 9 + (ch.userData.seed ?? 0)) * 0.1;
          ch.scale.y = 0.7 + Math.abs(Math.sin(ctx.time * 7 + (ch.userData.seed ?? 0))) * 0.6;
          mat.opacity = 0.6 * Math.min(1, k * 2);
        } else {
          mat.opacity = (idx === 0 ? 0.35 : 0.8) * Math.min(1, k * 2);
        }
      });
      if (p.tick <= 0) {
        p.tick = 0.25;
        for (const e of ctx.enemies) {
          if (e.isDead) continue;
          if (Math.hypot(e.mesh.position.x - p.pos.x, e.mesh.position.z - p.pos.z) <= p.r + 0.6) {
            this.tickDamage(ctx, e, Math.round(p.dps * 0.25), 'BURN', '#f97316');
            e.burnTimer = Math.max(e.burnTimer ?? 0, 1.5);
            e.burnDps = Math.max(e.burnDps ?? 0, 8);
          }
        }
        if (Math.random() < 0.6) ctx.sparks(p.pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * p.r, 0.3, (Math.random() - 0.5) * p.r)), '#fb923c', 2);
      }
      if (p.life <= 0) {
        disposeObj(this.scene, p.mesh);
        this.patches.splice(i, 1);
      }
    }
  }

  // ───────────────────────── per-frame ─────────────────────────
  update(ctx: ArsenalCtx) {
    const dt = ctx.delta;
    this.updateChakrams(ctx);
    this.updateBolts(ctx);
    this.updateMissiles(ctx);
    this.updateSonics(ctx);
    this.updateSaws(ctx);
    this.updateMeteors(ctx);
    this.updateTurrets(ctx);
    this.updateFlames(ctx);

    // CHRONOS-7 time marks: tick down and detonate
    this.marks.forEach((m, e) => {
      if (e.isDead) {
        disposeObj(this.scene, m.ring);
        this.marks.delete(e);
        return;
      }
      m.timer -= dt;
      ctx.hitbox(e, _a);
      m.ring.position.copy(_a).add(new THREE.Vector3(0, 1.4, 0));
      m.ring.quaternion.copy(ctx.camera.quaternion);
      const hand = m.ring.getObjectByName('hand');
      if (hand) hand.rotation.z = -((CHRONO_DELAY - m.timer) / CHRONO_DELAY) * Math.PI * 2;
      m.pips.forEach((p, k) => (((p.material as THREE.MeshBasicMaterial).opacity = k < m.count ? 0.95 : 0.15)));
      m.ring.scale.setScalar(1 + (m.timer < 0.25 ? (0.25 - m.timer) * 2 : 0));
      if (m.timer <= 0) {
        const stack = ctx.hasSkill('chrono_mod_stack') ? 1.25 : 1;
        const total = Math.round(m.stored * (1 + 0.12 * (m.count - 1)) * stack);
        ctx.damage(e, total, `TIME BURST ×${m.count}`, '#c4b5fd');
        this.blastFx(_a.clone(), 1.6 + m.count * 0.15, 0xa78bfa);
        ctx.sparks(_a.clone(), '#ddd6fe', 16);
        ctx.sfx.boom();
        if (ctx.hasSkill('chrono_mod_chain')) {
          for (const o of ctx.enemies) {
            if (o === e || o.isDead) continue;
            if (o.mesh.position.distanceTo(e.mesh.position) < 4.5) ctx.damage(o, Math.round(total * 0.5), 'TIME ECHO', '#c4b5fd');
          }
        }
        disposeObj(this.scene, m.ring);
        this.marks.delete(e);
      }
    });

    // SPINE NEEDLER: unstable needles crumble if not combined in time
    this.needles.forEach((st, e) => {
      st.t += dt;
      if (e.isDead || st.t > NEEDLE_LIFE) {
        st.spikes.forEach((sp) => disposeObj(null, sp));
        this.needles.delete(e);
      } else {
        st.spikes.forEach((sp, k) => sp.scale.setScalar(1 + Math.sin(ctx.time * 12 + k) * 0.08 + (st.n >= 5 ? 0.15 : 0)));
      }
    });

    // stuck flares burn out
    for (let i = this.stuckFlares.length - 1; i >= 0; i--) {
      const f = this.stuckFlares[i];
      f.life -= dt;
      f.obj.scale.setScalar(0.8 + Math.random() * 0.4);
      if (Math.random() < dt * 8 && !f.e.isDead) ctx.sparks(f.obj.getWorldPosition(new THREE.Vector3()), '#f97316', 1);
      if (f.life <= 0 || f.e.isDead) {
        disposeObj(null, f.obj);
        this.stuckFlares.splice(i, 1);
      }
    }

    // transient blasts
    for (let i = this.fxList.length - 1; i >= 0; i--) {
      const fx = this.fxList[i];
      fx.t += dt;
      const k = Math.min(1, fx.t / fx.life);
      fx.update(k);
      if (k >= 1) {
        disposeObj(this.scene, fx.obj);
        this.fxList.splice(i, 1);
      }
    }

    // summed tick popups
    this.tickAcc.forEach((acc, e) => {
      acc.t += dt;
      if (acc.t >= 0.3 || e.isDead) {
        if (acc.dmg > 0) ctx.text(`${acc.label} -${Math.round(acc.dmg)}`, acc.color);
        this.tickAcc.delete(e);
      }
    });
  }

  clear() {
    const all: THREE.Object3D[] = [
      ...this.chakrams.map((c) => c.mesh),
      ...this.bolts.map((b) => b.mesh),
      ...this.missiles.map((m) => m.mesh),
      ...this.sonics.map((s) => s.mesh),
      ...this.saws.map((s) => s.mesh),
      ...this.meteors.flatMap((m) => (m.rock ? [m.rock, m.beacon] : [m.beacon])),
      ...this.turrets.map((t) => t.mesh),
      ...this.patches.map((p) => p.mesh),
      ...this.zaps.map((z) => {
        z.line.material = new THREE.LineBasicMaterial(); // shared material is disposed below
        return z.line;
      }),
      ...this.fxList.map((f) => f.obj),
      ...[...this.marks.values()].map((m) => m.ring),
      ...[...this.lockMarkers.values()],
    ];
    all.forEach((o) => disposeObj(this.scene, o));
    this.flames.forEach((f) => {
      this.scene.remove(f.mesh);
      (f.mesh.material as THREE.Material).dispose();
    });
    this.flameGeo.dispose();
    this.zapMats.forEach((m) => m.dispose());
    this.zapMats.clear();
    this.chakrams = [];
    this.bolts = [];
    this.missiles = [];
    this.sonics = [];
    this.saws = [];
    this.meteors = [];
    this.turrets = [];
    this.patches = [];
    this.zaps = [];
    this.flames = [];
    this.fxList = [];
    this.marks.clear();
    this.needles.clear();
    this.lockMarkers.clear();
  }
}

/** Weapons whose shots are handled by the Arsenal instead of the classic bullet list. */
export const ARSENAL_GUNS = new Set(['sub_chrono', 'sub_hive', 'sub_flare', 'main_needler', 'main_sonic', 'main_buzzsaw', 'heavy_meteor', 'heavy_sentry', 'heavy_inferno']);
