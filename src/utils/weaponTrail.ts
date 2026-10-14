import * as THREE from 'three';

/**
 * Blade trail ("swoosh") for the first-person INFIGHT weapons.
 *
 * Every frame the battle scene samples two anchor points on the weapon (near the guard and at the tip)
 * in camera space. While a swing is active the samples form a ribbon that follows the real blade path
 * exactly; Catmull-Rom subdivision keeps fast arcs round instead of faceted, and every sample fades
 * out by age so the trail always shows only the last ~0.15s of motion.
 *
 * Two layers: a coloured sheet across the blade and a thin white-hot filament along the tip.
 */

interface Sample {
  base: THREE.Vector3;
  tip: THREE.Vector3;
  time: number;
}

const MAX_SAMPLES = 26;
const SUBDIV = 4;
const MAX_POINTS = (MAX_SAMPLES - 1) * SUBDIV + 1;

const catmull = (p0: THREE.Vector3, p1: THREE.Vector3, p2: THREE.Vector3, p3: THREE.Vector3, t: number, out: THREE.Vector3) => {
  const t2 = t * t;
  const t3 = t2 * t;
  out.set(
    0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
    0.5 * (2 * p1.z + (-p0.z + p2.z) * t + (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * t2 + (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * t3),
  );
  return out;
};

class TrailLayer {
  readonly mesh: THREE.Mesh;
  private pos: Float32Array;
  private col: Float32Array;
  private geo: THREE.BufferGeometry;

  constructor(color: THREE.ColorRepresentation, opacity: number) {
    this.pos = new Float32Array(MAX_POINTS * 2 * 3);
    this.col = new Float32Array(MAX_POINTS * 2 * 3);
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    const idx: number[] = [];
    for (let i = 0; i < MAX_POINTS - 1; i++) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 2, a + 1, a + 3);
    }
    this.geo.setIndex(idx);
    this.geo.setDrawRange(0, 0);
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(this.geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
  }

  write(i: number, base: THREE.Vector3, tip: THREE.Vector3, iBase: number, iTip: number) {
    const o = i * 6;
    this.pos[o] = tip.x;
    this.pos[o + 1] = tip.y;
    this.pos[o + 2] = tip.z;
    this.pos[o + 3] = base.x;
    this.pos[o + 4] = base.y;
    this.pos[o + 5] = base.z;
    this.col[o] = this.col[o + 1] = this.col[o + 2] = iTip;
    this.col[o + 3] = this.col[o + 4] = this.col[o + 5] = iBase;
  }

  commit(points: number) {
    this.geo.setDrawRange(0, Math.max(0, points - 1) * 6);
    (this.geo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;
  }

  setColor(c: THREE.ColorRepresentation) {
    (this.mesh.material as THREE.MeshBasicMaterial).color.set(c);
  }

  dispose() {
    this.geo.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}

export class WeaponTrail {
  private samples: Sample[] = [];
  private sheet: TrailLayer;
  private filament: TrailLayer;
  private parent: THREE.Object3D;
  /** seconds a sample stays visible */
  life = 0.15;
  /** extra brightness (finishers / skills) */
  boost = 0;

  private _a = new THREE.Vector3();
  private _b = new THREE.Vector3();
  private _c = new THREE.Vector3();
  private _d = new THREE.Vector3();

  constructor(parent: THREE.Object3D, color: THREE.ColorRepresentation) {
    this.parent = parent;
    this.sheet = new TrailLayer(color, 0.85);
    this.filament = new TrailLayer(0xffffff, 1);
    parent.add(this.sheet.mesh, this.filament.mesh);
  }

  setColor(c: THREE.ColorRepresentation) {
    this.sheet.setColor(c);
  }

  /** Forget all samples (weapon switch / teleport). */
  reset() {
    this.samples.length = 0;
    this.sheet.commit(0);
    this.filament.commit(0);
  }

  /**
   * Add this frame's anchors (in the parent's space) and rebuild the ribbon.
   * `emit` = false while the weapon is idle: no new samples, the old ones just fade away.
   */
  update(base: THREE.Vector3 | null, tip: THREE.Vector3 | null, now: number, emit: boolean) {
    if (emit && base && tip) {
      const last = this.samples[this.samples.length - 1];
      // skip near-duplicate samples (weapon held still) so the ribbon does not collapse into a smear
      if (!last || last.tip.distanceToSquared(tip) > 1e-6 || now - last.time > 0.05) {
        this.samples.push({ base: base.clone(), tip: tip.clone(), time: now });
        if (this.samples.length > MAX_SAMPLES) this.samples.shift();
      }
    }
    while (this.samples.length && now - this.samples[0].time > this.life) this.samples.shift();

    const n = this.samples.length;
    if (n < 2) {
      this.sheet.commit(0);
      this.filament.commit(0);
      return;
    }
    const S = this.samples;
    let k = 0;
    const boost = 1 + this.boost;
    for (let i = 0; i < n - 1; i++) {
      const s0 = S[Math.max(0, i - 1)];
      const s1 = S[i];
      const s2 = S[i + 1];
      const s3 = S[Math.min(n - 1, i + 2)];
      const steps = i === n - 2 ? SUBDIV + 1 : SUBDIV;
      for (let j = 0; j < steps; j++) {
        const t = j / SUBDIV;
        const tip = catmull(s0.tip, s1.tip, s2.tip, s3.tip, t, this._a);
        const base = catmull(s0.base, s1.base, s2.base, s3.base, t, this._b);
        const time = s1.time + (s2.time - s1.time) * t;
        const age = Math.min(1, (now - time) / this.life);
        const fade = Math.pow(1 - age, 1.7);
        // newest part of the ribbon flares, older part thins out toward the tip
        const head = age < 0.18 ? 1 + (0.18 - age) * 3 : 1;
        this.sheet.write(k, base, tip, 0.12 * fade, Math.min(2.2, fade * head * boost));
        // filament: a narrow strip hugging the tip
        const fBase = this._c.copy(tip).lerp(base, 0.16 * (1 - age * 0.6));
        const fTip = this._d.copy(tip);
        this.filament.write(k, fBase, fTip, 0, Math.min(2, fade * fade * 1.4 * boost));
        k++;
      }
    }
    this.sheet.commit(k);
    this.filament.commit(k);
  }

  dispose() {
    this.parent.remove(this.sheet.mesh, this.filament.mesh);
    this.sheet.dispose();
    this.filament.dispose();
  }
}

/**
 * Finds trail anchors for a melee viewmodel: returns the local (holder-space) base and tip of the
 * blade, estimated from the model's bounds along its main axis (+Y for blades / hammers, -Z for
 * spears / pile bunkers). Twin blades and gauntlets pass the arm group to get one pair per arm.
 */
export function findTrailAnchors(root: THREE.Object3D, axisIn: 'y' | '-z' | 'auto' = 'auto'): { base: THREE.Vector3; tip: THREE.Vector3 } | null {
  root.updateWorldMatrix(true, true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const box = new THREE.Box3();
  const tmp = new THREE.Box3();
  const m = new THREE.Matrix4();
  let any = false;
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    const mat = mesh.material as THREE.Material & { blending?: number };
    // ignore additive halos: they over-extend the bounds
    if (mat && (mat as THREE.MeshBasicMaterial).blending === THREE.AdditiveBlending) return;
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    m.multiplyMatrices(inv, mesh.matrixWorld);
    tmp.copy(mesh.geometry.boundingBox!).applyMatrix4(m);
    box.union(tmp);
    any = true;
  });
  if (!any || box.isEmpty()) return null;
  const c = box.getCenter(new THREE.Vector3());
  const axis = axisIn === 'auto' ? (box.max.y - box.min.y >= box.max.z - box.min.z ? 'y' : '-z') : axisIn;
  if (axis === 'y') {
    const len = box.max.y - box.min.y;
    return { base: new THREE.Vector3(c.x, box.min.y + len * 0.42, c.z), tip: new THREE.Vector3(c.x, box.max.y, c.z) };
  }
  const len = box.max.z - box.min.z;
  return { base: new THREE.Vector3(c.x, c.y, box.max.z - len * 0.55), tip: new THREE.Vector3(c.x, c.y, box.min.z) };
}
