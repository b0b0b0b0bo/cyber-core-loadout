import * as THREE from 'three';

/**
 * Telegraphed area attacks + sweeping beams shared by elite enemies and bosses.
 *
 *  Hazard  : a floor marker (circle / ring / line / sector) whose inner fill grows until it detonates.
 *            Optional `drop` flies a projectile into the marker, `track` makes the marker follow a target
 *            until `lockAt` seconds before detonation (so the player sees exactly where it will land).
 *  Beam    : a horizontal laser that sweeps around an origin. A thin flickering guide line shows the
 *            starting direction during `warn`, then it goes live. `jumpable` beams can be hopped over.
 *
 * Angles are yaw angles in world space: direction = (sin a, 0, cos a), i.e. `Math.atan2(dx, dz)`.
 */

export type HazardShape = 'circle' | 'ring' | 'line' | 'sector';
export type HazardFx = 'none' | 'blast' | 'pillar' | 'spikes' | 'slash' | 'beam' | 'geyser';

export interface HurtOptions {
  knockUp?: number;
  knockBack?: number;
  /** knock-back away from this point (defaults to the hazard centre) */
  from?: { x: number; z: number };
  /** guard can block it as a melee / projectile hit; AoE defaults to unblockable */
  guard?: 'melee' | 'projectile';
}

export type HurtFn = (dmg: number, label: string, color: string, opts?: HurtOptions) => void;

export interface HazardSpec {
  shape: HazardShape;
  x: number;
  z: number;
  /** circle / sector radius, ring outer radius, line half-width */
  radius: number;
  /** ring inner radius */
  inner?: number;
  /** line length */
  length?: number;
  /** line / sector facing */
  angle?: number;
  /** sector total angle */
  arc?: number;
  delay: number;
  damage: number;
  label: string;
  color: number;
  /** airborne players (feet above ~0.55m) are not hit */
  jumpable?: boolean;
  knockUp?: number;
  knockBack?: number;
  fx?: HazardFx;
  /** projectile visual that arrives exactly at detonation */
  drop?: { from: THREE.Vector3; color: number; size?: number; arc?: number; fall?: boolean; mesh?: THREE.Object3D; orient?: 'point' | 'tumble' };
  /** follow a target until `lockAt` seconds before detonation */
  track?: () => { x: number; z: number; angle?: number } | null;
  lockAt?: number;
  owner?: { isDead: boolean };
  /** fired at detonation (after the damage test) */
  onBurst?: (hitPlayer: boolean, h: Hazard) => void;
  shake?: number;
}

export interface Hazard extends HazardSpec {
  t: number;
  group: THREE.Group;
  fill: THREE.Mesh;
  outline: THREE.Mesh;
  base: THREE.Mesh;
  done: boolean;
  dropMesh?: THREE.Object3D;
}

export interface BeamSpec {
  /** world origin of the beam (re-evaluated every frame), null = owner gone */
  origin: () => THREE.Vector3 | null;
  /** absolute yaw at time t (0 .. warn + life) for spoke `i` */
  angleAt: (t: number, i: number) => number;
  spokes?: number;
  length: number;
  /** beam thickness (m) */
  width: number;
  /** beam height above the floor (centre) */
  height: number;
  warn: number;
  life: number;
  damage: number;
  /** seconds between damage ticks */
  tick: number;
  color: number;
  jumpable: boolean;
  label: string;
  owner?: { isDead: boolean };
}

interface Beam extends BeamSpec {
  t: number;
  lastHit: number;
  group: THREE.Group;
  spokesG: { root: THREE.Group; guide: THREE.Mesh; core: THREE.Mesh; glow: THREE.Mesh; tip: THREE.Mesh }[];
  done: boolean;
}

interface TransientFx {
  obj: THREE.Object3D;
  t: number;
  life: number;
  update: (k: number, obj: THREE.Object3D) => void;
}

const FLOOR_Y = 0.07;
const PLAYER_R = 0.4;
/** player eye height when standing (feet on the floor) */
const EYE_Y = 1.7;

const _v = new THREE.Vector3();
const _prev = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _yUp = new THREE.Vector3(0, 1, 0);
const _yDown = new THREE.Vector3(0, -1, 0);

export const yawTo = (fx: number, fz: number, tx: number, tz: number) => Math.atan2(tx - fx, tz - fz);
const wrapPi = (a: number) => {
  a = (a + Math.PI) % (Math.PI * 2);
  if (a < 0) a += Math.PI * 2;
  return a - Math.PI;
};

function flatMat(color: number, opacity: number, additive = true) {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
}

/** Geometry for a hazard in its local frame (local +Z = facing). Lies flat on the floor. */
function shapeGeometry(h: HazardSpec, outline: boolean): THREE.BufferGeometry {
  switch (h.shape) {
    case 'circle':
      return outline ? new THREE.RingGeometry(h.radius * 0.92, h.radius, 56) : new THREE.CircleGeometry(h.radius, 56);
    case 'ring': {
      const inner = h.inner ?? h.radius * 0.6;
      return outline ? new THREE.RingGeometry(inner, inner + 0.18, 64) : new THREE.RingGeometry(inner, h.radius, 64);
    }
    case 'line': {
      const len = h.length ?? 10;
      // the -90° X rotation maps plane +Y to world -Z, so build along -Y to extend toward local +Z (the facing)
      const g = outline ? new THREE.EdgesGeometry(new THREE.PlaneGeometry(h.radius * 2, len)) : new THREE.PlaneGeometry(h.radius * 2, len);
      g.translate(0, -len / 2, 0);
      return g;
    }
    case 'sector': {
      const arc = h.arc ?? Math.PI / 2;
      // CircleGeometry theta is measured from +X towards +Y; after the -90° X rotation +Y maps to -Z,
      // so the arc centred on -PI/2 faces local +Z.
      const start = -Math.PI / 2 - arc / 2;
      return outline ? new THREE.RingGeometry(h.radius * 0.94, h.radius, 48, 1, start, arc) : new THREE.CircleGeometry(h.radius, 48, start, arc);
    }
  }
}

export class CombatHazards {
  private scene: THREE.Scene;
  private hazards: Hazard[] = [];
  private beams: Beam[] = [];
  private fx: TransientFx[] = [];
  /** called with an amplitude when something big lands near the player */
  onShake?: (amp: number, dur: number) => void;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  get activeCount() {
    return this.hazards.length + this.beams.length;
  }

  // ───────────────────────── hazards ─────────────────────────
  add(spec: HazardSpec): Hazard {
    const group = new THREE.Group();
    group.position.set(spec.x, FLOOR_Y, spec.z);
    group.rotation.y = spec.angle ?? 0;
    const flat = (m: THREE.Object3D) => {
      m.rotation.x = -Math.PI / 2;
      group.add(m);
      return m;
    };
    // markers use normal blending so they stay readable on bright floors (additive washes out)
    const base = flat(new THREE.Mesh(shapeGeometry(spec, false), flatMat(spec.color, 0.16, false))) as THREE.Mesh;
    const fill = flat(new THREE.Mesh(shapeGeometry(spec, false), flatMat(spec.color, 0.4, false))) as THREE.Mesh;
    fill.position.y = 0.01;
    let outline: THREE.Mesh;
    if (spec.shape === 'line') {
      const edges = new THREE.LineSegments(shapeGeometry(spec, true), new THREE.LineBasicMaterial({ color: spec.color, transparent: true, opacity: 0.9 }));
      flat(edges);
      outline = edges as unknown as THREE.Mesh;
    } else {
      outline = flat(new THREE.Mesh(shapeGeometry(spec, true), flatMat(spec.color, 0.9))) as THREE.Mesh;
      outline.position.y = 0.02;
    }
    if (spec.shape === 'circle' || spec.shape === 'sector') fill.scale.setScalar(0.001);
    if (spec.shape === 'line') fill.scale.set(1, 0.001, 1);
    this.scene.add(group);

    const h: Hazard = { ...spec, t: 0, group, fill, outline, base, done: false };
    if (spec.drop) {
      const m =
        spec.drop.mesh ??
        (() => {
          const g = new THREE.Group();
          const r = spec.drop!.size ?? 0.45;
          g.add(new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), new THREE.MeshBasicMaterial({ color: 0xffffff })));
          g.add(new THREE.Mesh(new THREE.SphereGeometry(r * 1.9, 14, 10), flatMat(spec.drop!.color, 0.45)));
          const trail = new THREE.Mesh(new THREE.ConeGeometry(r * 1.2, r * 7, 10, 1, true), flatMat(spec.drop!.color, 0.3));
          trail.name = 'trail';
          g.add(trail);
          return g;
        })();
      m.position.copy(spec.drop.from);
      this.scene.add(m);
      h.dropMesh = m;
    }
    this.hazards.push(h);
    return h;
  }

  /** Remove every hazard / beam (scene teardown). */
  clear() {
    this.hazards.forEach((h) => this.disposeHazard(h));
    this.beams.forEach((b) => this.disposeBeam(b));
    this.fx.forEach((f) => this.disposeObj(f.obj));
    this.hazards = [];
    this.beams = [];
    this.fx = [];
  }

  private disposeObj(o: THREE.Object3D) {
    this.scene.remove(o);
    o.traverse((c) => {
      const m = c as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose();
    });
  }

  private disposeHazard(h: Hazard) {
    this.disposeObj(h.group);
    if (h.dropMesh) this.disposeObj(h.dropMesh);
  }

  private disposeBeam(b: Beam) {
    this.disposeObj(b.group);
  }

  /** Is (px, pz) inside the hazard footprint? */
  contains(h: HazardSpec, px: number, pz: number, pad = PLAYER_R): boolean {
    const dx = px - h.x;
    const dz = pz - h.z;
    const d = Math.hypot(dx, dz);
    switch (h.shape) {
      case 'circle':
        return d <= h.radius + pad;
      case 'ring':
        return d >= (h.inner ?? h.radius * 0.6) - pad && d <= h.radius + pad;
      case 'line': {
        const a = h.angle ?? 0;
        const fx = Math.sin(a);
        const fz = Math.cos(a);
        const along = dx * fx + dz * fz;
        const perp = Math.abs(dx * fz - dz * fx);
        return along >= -pad && along <= (h.length ?? 10) + pad && perp <= h.radius + pad;
      }
      case 'sector': {
        if (d > h.radius + pad) return false;
        if (d < 1.2) return true;
        const diff = wrapPi(Math.atan2(dx, dz) - (h.angle ?? 0));
        return Math.abs(diff) <= (h.arc ?? Math.PI / 2) / 2 + pad / Math.max(1, d);
      }
    }
  }

  // ───────────────────────── beams ─────────────────────────
  addBeam(spec: BeamSpec): void {
    const group = new THREE.Group();
    this.scene.add(group);
    const n = Math.max(1, spec.spokes ?? 1);
    const spokesG: Beam['spokesG'] = [];
    for (let i = 0; i < n; i++) {
      const root = new THREE.Group();
      group.add(root);
      // all beam parts are unit-length along +Z and scaled to the beam length
      const unit = (w: number, h: number, mat: THREE.Material) => {
        const g = new THREE.BoxGeometry(w, h, 1);
        g.translate(0, 0, 0.5);
        const m = new THREE.Mesh(g, mat);
        root.add(m);
        return m;
      };
      const guide = unit(0.06, 0.06, flatMat(spec.color, 0.8));
      const core = unit(spec.width * 0.35, spec.width * 0.35, new THREE.MeshBasicMaterial({ color: 0xffffff }));
      const glow = unit(spec.width, spec.width, flatMat(spec.color, 0.55));
      const tip = new THREE.Mesh(new THREE.SphereGeometry(spec.width * 1.2, 12, 8), flatMat(spec.color, 0.7));
      root.add(tip);
      core.visible = false;
      glow.visible = false;
      tip.visible = false;
      spokesG.push({ root, guide, core, glow, tip });
    }
    this.beams.push({ ...spec, t: 0, lastHit: -9, group, spokesG, done: false });
  }

  // ───────────────────────── fx ─────────────────────────
  private addFx(obj: THREE.Object3D, life: number, update: TransientFx['update']) {
    this.scene.add(obj);
    this.fx.push({ obj, t: 0, life, update });
  }

  /** Expanding shock ring on the floor. */
  ringFx(x: number, z: number, radius: number, color: number, life = 0.45) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.82, 1, 64), flatMat(color, 0.9));
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, FLOOR_Y + 0.03, z);
    this.addFx(m, life, (k, o) => {
      o.scale.setScalar(Math.max(0.01, radius * (0.25 + 0.75 * Math.sqrt(k))));
      ((o as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - k);
    });
  }

  /** Bright column of light / energy rising from the floor. */
  columnFx(x: number, z: number, radius: number, height: number, color: number, life = 0.5) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    const geo = new THREE.CylinderGeometry(radius, radius * 1.15, 1, 24, 1, true);
    geo.translate(0, 0.5, 0);
    const outer = new THREE.Mesh(geo, flatMat(color, 0.55));
    const coreGeo = new THREE.CylinderGeometry(radius * 0.35, radius * 0.45, 1, 16, 1, true);
    coreGeo.translate(0, 0.5, 0);
    const inner = new THREE.Mesh(coreGeo, flatMat(0xffffff, 0.8));
    g.add(outer, inner);
    this.addFx(g, life, (k, o) => {
      const rise = Math.min(1, k * 5);
      o.scale.set(1 + k * 0.6, Math.max(0.01, height * rise), 1 + k * 0.6);
      (outer.material as THREE.MeshBasicMaterial).opacity = 0.55 * (1 - k);
      (inner.material as THREE.MeshBasicMaterial).opacity = 0.8 * (1 - k) * (1 - k);
    });
  }

  /** Jagged spikes bursting out of the floor (rock wave / glass swords). */
  spikesFx(x: number, z: number, radius: number, color: number, count = 7, height = 2.6, life = 0.9) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    const mat = new THREE.MeshStandardMaterial({ color: 0x3a3330, roughness: 0.8, metalness: 0.1, emissive: color, emissiveIntensity: 0.35 });
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + Math.random() * 0.6;
      const r = radius * (i === 0 ? 0 : 0.35 + Math.random() * 0.55);
      const h = height * (i === 0 ? 1.15 : 0.55 + Math.random() * 0.5);
      const sp = new THREE.Mesh(new THREE.ConeGeometry(0.28 + Math.random() * 0.25, h, 5), mat);
      sp.position.set(Math.cos(a) * r, h / 2, Math.sin(a) * r);
      sp.rotation.set((Math.random() - 0.5) * 0.5, Math.random() * 3, (Math.random() - 0.5) * 0.5);
      sp.userData.h = h;
      g.add(sp);
    }
    this.addFx(g, life, (k, o) => {
      const up = k < 0.15 ? k / 0.15 : k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
      o.children.forEach((c) => {
        c.scale.y = Math.max(0.01, up);
        c.position.y = (c.userData.h / 2) * up - (1 - up) * 0.3;
      });
    });
  }

  /** Bright beam slab along a line hazard. */
  beamFx(x: number, z: number, angle: number, length: number, width: number, color: number, y = 1.4, life = 0.45) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = angle;
    const glowGeo = new THREE.BoxGeometry(width, width, length);
    glowGeo.translate(0, 0, length / 2);
    const coreGeo = new THREE.BoxGeometry(width * 0.35, width * 0.35, length);
    coreGeo.translate(0, 0, length / 2);
    const glow = new THREE.Mesh(glowGeo, flatMat(color, 0.7));
    const core = new THREE.Mesh(coreGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true }));
    g.add(glow, core);
    this.addFx(g, life, (k) => {
      const w = 1 + Math.sin(k * 40) * 0.08;
      glow.scale.set(w * (1 - k * 0.6), w * (1 - k * 0.6), 1);
      (glow.material as THREE.MeshBasicMaterial).opacity = 0.7 * (1 - k);
      (core.material as THREE.MeshBasicMaterial).opacity = 1 - k;
    });
  }

  /** Flat flash in the hazard's own footprint (sector slashes etc.). */
  private footprintFlash(h: Hazard) {
    const m = new THREE.Mesh(shapeGeometry(h, false), flatMat(0xffffff, 0.75));
    m.rotation.x = -Math.PI / 2;
    const g = new THREE.Group();
    g.position.set(h.x, FLOOR_Y + 0.05, h.z);
    g.rotation.y = h.angle ?? 0;
    g.add(m);
    const tint = new THREE.Mesh(shapeGeometry(h, false), flatMat(h.color, 0.8));
    tint.rotation.x = -Math.PI / 2;
    tint.position.y = 0.4;
    g.add(tint);
    this.addFx(g, 0.35, (k) => {
      (m.material as THREE.MeshBasicMaterial).opacity = 0.75 * (1 - k);
      (tint.material as THREE.MeshBasicMaterial).opacity = 0.8 * (1 - k);
      tint.position.y = 0.4 + k * 1.2;
    });
  }

  private burstFx(h: Hazard) {
    const fx = h.fx ?? 'blast';
    if (fx === 'none') return;
    const R = h.shape === 'line' ? h.radius : h.radius;
    switch (fx) {
      case 'blast':
        this.ringFx(h.x, h.z, R * 1.25, h.color, 0.4);
        this.columnFx(h.x, h.z, R * 0.55, 5, h.color, 0.45);
        this.footprintFlash(h);
        break;
      case 'pillar':
        this.columnFx(h.x, h.z, R * 0.8, 14, h.color, 0.7);
        this.ringFx(h.x, h.z, R * 1.4, h.color, 0.5);
        break;
      case 'geyser':
        this.columnFx(h.x, h.z, R * 0.7, 7, h.color, 0.8);
        this.ringFx(h.x, h.z, R * 1.3, 0xe0f2fe, 0.5);
        break;
      case 'spikes':
        this.spikesFx(h.x, h.z, R, h.color, 7, 2.2 + R * 0.4);
        this.ringFx(h.x, h.z, R * 1.2, h.color, 0.35);
        break;
      case 'slash':
        this.footprintFlash(h);
        break;
      case 'beam':
        this.beamFx(h.x, h.z, h.angle ?? 0, h.length ?? 10, h.radius * 2, h.color, 1.4, 0.5);
        this.footprintFlash(h);
        break;
    }
  }

  // ───────────────────────── update ─────────────────────────
  /**
   * @param player eye position of the player
   * @param hurt   damage callback
   */
  update(dt: number, time: number, player: THREE.Vector3, hurt: HurtFn): void {
    const feet = player.y - EYE_Y;
    const airborne = feet > 0.55;

    // hazards
    for (let i = this.hazards.length - 1; i >= 0; i--) {
      const h = this.hazards[i];
      if (h.owner?.isDead && !h.drop) {
        h.done = true;
      } else {
        h.t += dt;
        const p = Math.min(1, h.t / Math.max(0.01, h.delay));
        const lockAt = h.lockAt ?? 0.3;
        if (h.track && h.t < h.delay - lockAt) {
          const tr = h.track();
          if (tr) {
            h.x = tr.x;
            h.z = tr.z;
            if (tr.angle !== undefined) h.angle = tr.angle;
          }
        }
        h.group.position.set(h.x, FLOOR_Y, h.z);
        h.group.rotation.y = h.angle ?? 0;
        // fill grows; flicker in the last 30%
        if (h.shape === 'circle' || h.shape === 'sector') h.fill.scale.setScalar(Math.max(0.001, p));
        else if (h.shape === 'line') h.fill.scale.set(1, Math.max(0.001, p), 1);
        const flick = p > 0.7 ? 0.5 + 0.5 * Math.sin(time * 38) : 1;
        (h.fill.material as THREE.MeshBasicMaterial).opacity = (0.28 + 0.32 * p) * (0.75 + 0.25 * flick);
        (h.outline.material as THREE.MeshBasicMaterial).opacity = 0.6 + 0.4 * flick;
        const locked = !h.track || h.t >= h.delay - lockAt;
        (h.base.material as THREE.MeshBasicMaterial).opacity = locked ? 0.24 : 0.12;

        if (h.dropMesh && h.drop) {
          const from = h.drop.from;
          const e = h.drop.fall ? p * p : p;
          _v.set(h.x, 0.6, h.z);
          _prev.copy(h.dropMesh.position);
          h.dropMesh.position.lerpVectors(from, _v, e);
          h.dropMesh.position.y += (h.drop.arc ?? 0) * 4 * e * (1 - e);
          // the trail cone points back along the flight path
          const trail = h.dropMesh.getObjectByName('trail');
          _dir.subVectors(h.dropMesh.position, _prev);
          if (trail && _dir.lengthSq() > 1e-6) {
            _dir.normalize();
            trail.quaternion.setFromUnitVectors(_yUp, _dir.negate());
            trail.position.copy(_dir).multiplyScalar((h.drop.size ?? 0.45) * 3.5);
          } else if (!trail && _dir.lengthSq() > 1e-6) {
            // custom meshes: swords point their tip (-Y) along the path, boulders tumble
            if (h.drop.orient === 'point') h.dropMesh.quaternion.setFromUnitVectors(_yDown, _dir.normalize());
            else {
              h.dropMesh.rotation.x += dt * 5;
              h.dropMesh.rotation.z += dt * 3;
            }
          }
        }

        if (h.t >= h.delay) {
          let hit = false;
          if (h.damage > 0 && this.contains(h, player.x, player.z) && !(h.jumpable && airborne)) {
            hit = true;
            hurt(h.damage, h.label, '#' + new THREE.Color(h.color).getHexString(), {
              knockUp: h.knockUp,
              knockBack: h.knockBack,
              from: { x: h.x, z: h.z },
            });
          }
          this.burstFx(h);
          const d = Math.hypot(player.x - h.x, player.z - h.z);
          if (h.shake && this.onShake) this.onShake(h.shake * Math.max(0.15, 1 - d / 30), 0.35);
          h.onBurst?.(hit, h);
          h.done = true;
        }
      }
      if (h.done) {
        this.disposeHazard(h);
        this.hazards.splice(i, 1);
      }
    }

    // beams
    for (let i = this.beams.length - 1; i >= 0; i--) {
      const b = this.beams[i];
      b.t += dt;
      const org = b.owner?.isDead ? null : b.origin();
      if (!org || b.t >= b.warn + b.life) {
        this.disposeBeam(b);
        this.beams.splice(i, 1);
        continue;
      }
      const live = b.t >= b.warn;
      const ramp = live ? Math.min(1, (b.t - b.warn) / 0.12) * Math.min(1, (b.warn + b.life - b.t) / 0.15) : 0;
      let touching = false;
      b.spokesG.forEach((s, idx) => {
        const a = b.angleAt(b.t, idx);
        s.root.position.set(org.x, b.height, org.z);
        s.root.rotation.y = a;
        s.guide.scale.z = b.length;
        s.guide.visible = !live;
        (s.guide.material as THREE.MeshBasicMaterial).opacity = 0.35 + 0.55 * (0.5 + 0.5 * Math.sin(b.t * 30));
        s.core.visible = live;
        s.glow.visible = live;
        s.tip.visible = live;
        if (live) {
          const w = ramp * (1 + Math.sin(time * 50 + idx) * 0.1);
          s.core.scale.set(w, w, b.length);
          s.glow.scale.set(w, w, b.length);
          s.tip.position.set(0, 0, b.length);
          s.tip.scale.setScalar(Math.max(0.01, w));
          // hit test against the spoke as a segment on the floor plane
          const fx = Math.sin(a);
          const fz = Math.cos(a);
          const dx = player.x - org.x;
          const dz = player.z - org.z;
          const along = dx * fx + dz * fz;
          const perp = Math.abs(dx * fz - dz * fx);
          const beamTop = b.height + b.width * 0.5;
          const above = b.jumpable && feet > beamTop - 0.15;
          if (along > 0 && along < b.length && perp < b.width * 0.5 + PLAYER_R && !above && ramp > 0.5) touching = true;
        }
      });
      if (touching && b.t - b.lastHit >= b.tick) {
        b.lastHit = b.t;
        hurt(b.damage, b.label, '#' + new THREE.Color(b.color).getHexString(), { guard: 'projectile' });
      }
    }

    // transient fx
    for (let i = this.fx.length - 1; i >= 0; i--) {
      const f = this.fx[i];
      f.t += dt;
      const k = Math.min(1, f.t / f.life);
      f.update(k, f.obj);
      if (k >= 1) {
        this.disposeObj(f.obj);
        this.fx.splice(i, 1);
      }
    }
  }
}
