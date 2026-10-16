import * as THREE from 'three';

/**
 * High-quality procedural PBR texture sets for the battle stages.
 * Every surface is painted into four aligned canvases (albedo / height / roughness / emissive)
 * so floors, walls and cover get real bevels, grime, scratches and glowing inlays.
 * All drawing is toroidally wrapped so the textures tile seamlessly.
 */

export interface StageMaps {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
  emissiveMap: THREE.CanvasTexture;
}

export interface StageTextureSet {
  floor: StageMaps;
  wall: StageMaps;
  panel: StageMaps;
}

type Style = 'apartments' | 'sanctuary' | 'foundry' | 'cathedral' | 'spire' | 'dock' | 'monolith' | 'omega' | 'abyss' | 'relic' | 'cryo' | 'overgrow' | 'molten' | 'storm' | 'neon' | 'eden';

interface Theme {
  style: Style;
  floorRoughness: number;
  accentColor: number;
}

const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');
const clamp255 = (v: number) => Math.max(0, Math.min(255, Math.round(v)));

/** Multiply a #rrggbb colour by a factor. */
function shade(c: string, f: number): string {
  const n = parseInt(c.slice(1), 16);
  const h = (v: number) => clamp255(v * f).toString(16).padStart(2, '0');
  return '#' + h((n >> 16) & 255) + h((n >> 8) & 255) + h(n & 255);
}
function lighten(c: string, t: number): string {
  const n = parseInt(c.slice(1), 16);
  const m = (v: number) => clamp255(v + (255 - v) * t);
  return `rgb(${m((n >> 16) & 255)},${m((n >> 8) & 255)},${m(n & 255)})`;
}
const gray = (v: number) => `rgb(${clamp255(v)},${clamp255(v)},${clamp255(v)})`;

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class Surface {
  readonly a: CanvasRenderingContext2D; // albedo
  readonly h: CanvasRenderingContext2D; // height
  readonly r: CanvasRenderingContext2D; // roughness
  readonly e: CanvasRenderingContext2D; // emissive
  readonly all: CanvasRenderingContext2D[];
  readonly canvases: HTMLCanvasElement[];
  rnd: () => number;

  constructor(readonly S: number, seed: number, base: string, rough: number) {
    const mk = () => {
      const c = document.createElement('canvas');
      c.width = S; c.height = S;
      return c;
    };
    this.canvases = [mk(), mk(), mk(), mk()];
    [this.a, this.h, this.r, this.e] = this.canvases.map((c) => c.getContext('2d')!) as CanvasRenderingContext2D[];
    this.all = [this.a, this.h, this.r, this.e];
    this.rnd = mulberry32(seed);
    this.a.fillStyle = base; this.a.fillRect(0, 0, S, S);
    this.h.fillStyle = gray(128); this.h.fillRect(0, 0, S, S);
    this.r.fillStyle = gray(rough * 255); this.r.fillRect(0, 0, S, S);
    this.e.fillStyle = '#000'; this.e.fillRect(0, 0, S, S);
  }

  /** Run `fn` at the 9 wrapped offsets so features crossing an edge tile seamlessly. */
  wrap(fn: () => void) {
    const S = this.S;
    for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) {
      this.all.forEach((c) => { c.save(); c.translate(dx, dy); });
      fn();
      this.all.forEach((c) => c.restore());
    }
  }

  /** Per-pixel film grain on albedo / height / roughness. */
  grain(a: number, h: number, r: number) {
    const S = this.S;
    const apply = (ctx: CanvasRenderingContext2D, amt: number) => {
      if (amt <= 0) return;
      const img = ctx.getImageData(0, 0, S, S);
      const d = img.data;
      for (let i = 0; i < d.length; i += 4) {
        const n = (this.rnd() - 0.5) * amt;
        d[i] = clamp255(d[i] + n); d[i + 1] = clamp255(d[i + 1] + n); d[i + 2] = clamp255(d[i + 2] + n);
      }
      ctx.putImageData(img, 0, 0);
    };
    apply(this.a, a); apply(this.h, h); apply(this.r, r);
  }

  /** Large soft mottling (value noise) for natural unevenness. */
  mottle(count: number, maxR: number, alpha: number, tint = '0,0,0') {
    for (let i = 0; i < count; i++) {
      const x = this.rnd() * this.S, y = this.rnd() * this.S, rad = maxR * (0.3 + this.rnd() * 0.7);
      const light = this.rnd() > 0.5;
      this.wrap(() => {
        const g = this.a.createRadialGradient(x, y, 0, x, y, rad);
        const col = light ? '255,255,255' : tint;
        g.addColorStop(0, `rgba(${col},${alpha * (0.4 + this.rnd() * 0.6)})`);
        g.addColorStop(1, `rgba(${col},0)`);
        this.a.fillStyle = g; this.a.fillRect(x - rad, y - rad, rad * 2, rad * 2);
      });
    }
  }

  /** Bevelled panel: raised plate with light/dark edge shading and per-panel tonal variation. */
  panel(x: number, y: number, w: number, hgt: number, base: string, opts: { gap?: number; bevel?: number; vary?: number; rough?: number; metalTone?: number } = {}) {
    const gap = opts.gap ?? 4, bev = opts.bevel ?? 5, vary = opts.vary ?? 0.1;
    const f = 1 + (this.rnd() - 0.5) * 2 * vary;
    const px = x + gap, py = y + gap, pw = w - gap * 2, ph = hgt - gap * 2;
    // gap: dark and low
    this.a.fillStyle = 'rgba(0,0,0,0.55)'; this.a.fillRect(x, y, w, hgt);
    this.h.fillStyle = gray(44); this.h.fillRect(x, y, w, hgt);
    // plate
    this.a.fillStyle = shade(base, f); this.a.fillRect(px, py, pw, ph);
    this.h.fillStyle = gray(150); this.h.fillRect(px, py, pw, ph);
    // bevel (height ramp + shading)
    for (let i = 0; i < bev; i++) {
      const t = i / bev;
      this.h.strokeStyle = gray(150 - (1 - t) * 60); this.h.lineWidth = 1;
      this.h.strokeRect(px + i + 0.5, py + i + 0.5, pw - i * 2 - 1, ph - i * 2 - 1);
    }
    this.a.lineWidth = 2;
    this.a.strokeStyle = 'rgba(255,255,255,0.28)';
    this.a.beginPath(); this.a.moveTo(px, py + ph); this.a.lineTo(px, py); this.a.lineTo(px + pw, py); this.a.stroke();
    this.a.strokeStyle = 'rgba(0,0,0,0.32)';
    this.a.beginPath(); this.a.moveTo(px + pw, py); this.a.lineTo(px + pw, py + ph); this.a.lineTo(px, py + ph); this.a.stroke();
    const rv = opts.rough ?? 0;
    this.r.fillStyle = gray(Math.max(0, Math.min(255, (rv || 0.5) * 255 + (this.rnd() - 0.5) * 50)));
    this.r.fillRect(px, py, pw, ph);
    this.r.fillStyle = gray(235); this.r.fillRect(x, y, gap, hgt); this.r.fillRect(x, y, w, gap);
  }

  rivet(x: number, y: number, rad = 5) {
    this.wrap(() => {
      this.a.fillStyle = 'rgba(0,0,0,0.5)'; this.a.beginPath(); this.a.arc(x + 1, y + 1.5, rad + 1, 0, Math.PI * 2); this.a.fill();
      const g = this.a.createRadialGradient(x - rad * 0.3, y - rad * 0.3, 0, x, y, rad);
      g.addColorStop(0, 'rgba(235,240,245,0.95)'); g.addColorStop(1, 'rgba(70,78,90,0.95)');
      this.a.fillStyle = g; this.a.beginPath(); this.a.arc(x, y, rad, 0, Math.PI * 2); this.a.fill();
      const hg = this.h.createRadialGradient(x, y, 0, x, y, rad);
      hg.addColorStop(0, gray(240)); hg.addColorStop(1, gray(150));
      this.h.fillStyle = hg; this.h.beginPath(); this.h.arc(x, y, rad, 0, Math.PI * 2); this.h.fill();
    });
  }

  /** Engraved groove line. */
  groove(x1: number, y1: number, x2: number, y2: number, w = 4) {
    this.wrap(() => {
      this.h.strokeStyle = gray(40); this.h.lineWidth = w; this.h.beginPath(); this.h.moveTo(x1, y1); this.h.lineTo(x2, y2); this.h.stroke();
      this.a.strokeStyle = 'rgba(0,0,0,0.45)'; this.a.lineWidth = w; this.a.beginPath(); this.a.moveTo(x1, y1); this.a.lineTo(x2, y2); this.a.stroke();
      this.a.strokeStyle = 'rgba(255,255,255,0.18)'; this.a.lineWidth = 1; this.a.beginPath(); this.a.moveTo(x1, y1 + w / 2 + 1); this.a.lineTo(x2, y2 + w / 2 + 1); this.a.stroke();
    });
  }

  /** Glowing energy line: emissive bloom + bright albedo core, slightly recessed. */
  glow(path: (c: CanvasRenderingContext2D) => void, color: string, w = 6) {
    this.wrap(() => {
      const strokeWith = (c: CanvasRenderingContext2D, col: string, lw: number, blur = 0, blurCol = col) => {
        c.save(); c.strokeStyle = col; c.lineWidth = lw; c.lineCap = 'round'; c.lineJoin = 'round';
        c.shadowColor = blurCol; c.shadowBlur = blur; c.beginPath(); path(c); c.stroke(); c.restore();
      };
      strokeWith(this.h, gray(70), w + 6);
      strokeWith(this.a, 'rgba(0,0,0,0.5)', w + 6);
      strokeWith(this.e, color, w + 2, 18);
      strokeWith(this.e, lighten(color, 0.55), Math.max(1, w * 0.45), 6);
      strokeWith(this.a, color, w);
      strokeWith(this.a, lighten(color, 0.7), Math.max(1, w * 0.4));
      strokeWith(this.r, gray(30), w + 2);
    });
  }

  glowRect(x: number, y: number, w: number, hgt: number, color: string) {
    this.wrap(() => {
      this.e.fillStyle = color; this.e.shadowColor = color; this.e.shadowBlur = 16; this.e.fillRect(x, y, w, hgt); this.e.shadowBlur = 0;
      this.a.fillStyle = lighten(color, 0.4); this.a.fillRect(x, y, w, hgt);
      this.h.fillStyle = gray(105); this.h.fillRect(x, y, w, hgt);
      this.r.fillStyle = gray(40); this.r.fillRect(x, y, w, hgt);
    });
  }

  scratches(n: number, len: number) {
    for (let i = 0; i < n; i++) {
      const x = this.rnd() * this.S, y = this.rnd() * this.S, a = this.rnd() * Math.PI, l = len * (0.3 + this.rnd());
      const light = this.rnd() > 0.35;
      this.wrap(() => {
        this.a.strokeStyle = light ? `rgba(255,255,255,${0.06 + this.rnd() * 0.12})` : `rgba(0,0,0,${0.08 + this.rnd() * 0.12})`;
        this.a.lineWidth = 0.6 + this.rnd() * 1.1;
        this.a.beginPath(); this.a.moveTo(x, y); this.a.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); this.a.stroke();
        this.r.strokeStyle = 'rgba(255,255,255,0.25)'; this.r.lineWidth = 1;
        this.r.beginPath(); this.r.moveTo(x, y); this.r.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); this.r.stroke();
        this.h.strokeStyle = 'rgba(0,0,0,0.25)'; this.h.lineWidth = 1;
        this.h.beginPath(); this.h.moveTo(x, y); this.h.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); this.h.stroke();
      });
    }
  }

  /** Jagged crack. */
  crack(x: number, y: number, len: number, dir: number) {
    const pts: Array<[number, number]> = [[x, y]];
    let cx = x, cy = y, d = dir;
    for (let i = 0; i < 14; i++) {
      d += (this.rnd() - 0.5) * 0.9;
      cx += Math.cos(d) * (len / 14); cy += Math.sin(d) * (len / 14);
      pts.push([cx, cy]);
    }
    this.wrap(() => {
      this.h.strokeStyle = gray(30); this.h.lineWidth = 3; this.a.strokeStyle = 'rgba(10,10,12,0.7)'; this.a.lineWidth = 2;
      for (const c of [this.h, this.a]) { c.beginPath(); pts.forEach(([px, py], i) => (i ? c.lineTo(px, py) : c.moveTo(px, py))); c.stroke(); }
    });
  }

  hazard(x: number, y: number, w: number, hgt: number, c1: string, c2: string, step = 36) {
    this.wrap(() => {
      for (const c of [this.a]) {
        c.save(); c.beginPath(); c.rect(x, y, w, hgt); c.clip();
        c.fillStyle = c2; c.fillRect(x, y, w, hgt);
        c.fillStyle = c1;
        for (let i = -hgt; i < w + hgt; i += step * 2) {
          c.beginPath(); c.moveTo(x + i, y + hgt); c.lineTo(x + i + step, y + hgt); c.lineTo(x + i + step + hgt, y); c.lineTo(x + i + hgt, y); c.fill();
        }
        c.restore();
      }
      this.h.fillStyle = gray(135); this.h.fillRect(x, y, w, hgt);
      this.r.fillStyle = gray(150); this.r.fillRect(x, y, w, hgt);
    });
  }

  grime(n: number) {
    for (let i = 0; i < n; i++) {
      const x = this.rnd() * this.S, y = this.rnd() * this.S, rw = 20 + this.rnd() * 80, rh = rw * (0.4 + this.rnd());
      this.wrap(() => {
        const g = this.a.createRadialGradient(x, y, 0, x, y, rw);
        g.addColorStop(0, `rgba(20,16,12,${0.1 + this.rnd() * 0.12})`); g.addColorStop(1, 'rgba(20,16,12,0)');
        this.a.save(); this.a.translate(x, y); this.a.scale(1, rh / rw); this.a.translate(-x, -y);
        this.a.fillStyle = g; this.a.fillRect(x - rw, y - rw, rw * 2, rw * 2); this.a.restore();
        this.r.fillStyle = 'rgba(255,255,255,0.05)'; this.r.beginPath(); this.r.arc(x, y, rw * 0.5, 0, Math.PI * 2); this.r.fill();
      });
    }
  }

  vertGrime(n: number) {
    for (let i = 0; i < n; i++) {
      const x = this.rnd() * this.S, y = this.rnd() * this.S, l = 60 + this.rnd() * 220, w = 3 + this.rnd() * 10;
      this.wrap(() => {
        const g = this.a.createLinearGradient(0, y, 0, y + l);
        g.addColorStop(0, 'rgba(15,12,10,0.0)'); g.addColorStop(0.25, `rgba(15,12,10,${0.1 + this.rnd() * 0.1})`); g.addColorStop(1, 'rgba(15,12,10,0)');
        this.a.fillStyle = g; this.a.fillRect(x, y, w, l);
      });
    }
  }

  toMaps(): StageMaps {
    const mk = (c: HTMLCanvasElement, srgb: boolean) => {
      const t = new THREE.CanvasTexture(c);
      t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = 8;
      t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      t.needsUpdate = true;
      return t;
    };
    return { map: mk(this.canvases[0], true), bumpMap: mk(this.canvases[1], false), roughnessMap: mk(this.canvases[2], false), emissiveMap: mk(this.canvases[3], true) };
  }
}

const PALETTE: Record<Style, { floor: string; wall: string }> = {
  apartments: { floor: '#b4bcc6', wall: '#c8d0da' },
  sanctuary: { floor: '#e4dff0', wall: '#dcd5ec' },
  foundry: { floor: '#8d817a', wall: '#a0948b' },
  cathedral: { floor: '#d9d1c1', wall: '#cdc4af' },
  spire: { floor: '#7b8397', wall: '#939bb0' },
  dock: { floor: '#838b97', wall: '#a0a7b1' },
  monolith: { floor: '#6e617c', wall: '#827590' },
  omega: { floor: '#6a5660', wall: '#7f6a74' },
  abyss: { floor: '#5f7c82', wall: '#6d8c92' },
  relic: { floor: '#8a7a9a', wall: '#9a8aae' },
  cryo: { floor: '#9db8cc', wall: '#aac4d8' },
  overgrow: { floor: '#7d9468', wall: '#8aa075' },
  molten: { floor: '#6a5a54', wall: '#76645c' },
  storm: { floor: '#5c6a84', wall: '#66748e' },
  neon: { floor: '#4a4670', wall: '#58548a' },
  eden: { floor: '#e8e4da', wall: '#efeadf' },
};

const S = 1024;
const styleSeed = (s: string, k: number) => { let h = k * 2654435761; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };

// ───────────────────────────── FLOORS ─────────────────────────────
function paintFloor(theme: Theme): StageMaps {
  const accent = hex(theme.accentColor);
  const base = PALETTE[theme.style].floor;
  const s = new Surface(S, styleSeed(theme.style, 1), base, theme.floorRoughness);
  const grid = (n: number, fn: (x: number, y: number, w: number) => void) => { const w = S / n; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) fn(i * w, j * w, w); };

  switch (theme.style) {
    case 'apartments': { // poured-concrete slabs, expansion joints, cyan power conduits
      grid(4, (x, y, w) => { s.panel(x, y, w, w, base, { gap: 5, bevel: 4, vary: 0.07, rough: 0.78 }); });
      s.mottle(60, 160, 0.06); s.grime(26);
      for (let i = 0; i < 6; i++) s.crack(s.rnd() * S, s.rnd() * S, 80 + s.rnd() * 160, s.rnd() * 6.28);
      s.glow((c) => { c.moveTo(0, 128); c.lineTo(S, 128); }, accent, 7);
      s.glow((c) => { c.moveTo(640, 0); c.lineTo(640, S); }, accent, 7);
      s.hazard(20, 20, 110, 110, '#0284c7', '#0f172a', 22);
      s.hazard(S - 150, S - 150, 110, 110, '#0284c7', '#0f172a', 22);
      for (let i = 0; i < 4; i++) { s.rivet(8 + (i % 2) * 14, 8 + Math.floor(i / 2) * 14, 3); }
      break;
    }
    case 'sanctuary': { // polished marble with veining and glowing inlay medallion
      grid(4, (x, y, w) => s.panel(x, y, w, w, base, { gap: 3, bevel: 3, vary: 0.05, rough: 0.2 }));
      for (let i = 0; i < 22; i++) { // marble veins
        const x = s.rnd() * S, y = s.rnd() * S; let cx = x, cy = y, d = s.rnd() * 6.28;
        s.wrap(() => { s.a.strokeStyle = `rgba(110,100,150,${0.1 + s.rnd() * 0.12})`; s.a.lineWidth = 1 + s.rnd() * 2; s.a.beginPath(); s.a.moveTo(cx, cy); });
        const pts: Array<[number, number]> = [];
        for (let k = 0; k < 18; k++) { d += (s.rnd() - 0.5) * 0.8; cx += Math.cos(d) * 22; cy += Math.sin(d) * 22; pts.push([cx, cy]); }
        s.wrap(() => { s.a.strokeStyle = `rgba(110,100,150,${0.12 + s.rnd() * 0.1})`; s.a.lineWidth = 1.2; s.a.beginPath(); s.a.moveTo(x, y); pts.forEach(([px, py]) => s.a.lineTo(px, py)); s.a.stroke(); });
      }
      s.mottle(70, 170, 0.07, '90,80,130');
      s.glow((c) => { c.arc(S / 2, S / 2, 230, 0, Math.PI * 2); }, accent, 7);
      s.glow((c) => { c.arc(S / 2, S / 2, 150, 0, Math.PI * 2); }, '#a855f7', 5);
      s.glow((c) => { for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; c.moveTo(S / 2 + Math.cos(a) * 150, S / 2 + Math.sin(a) * 150); c.lineTo(S / 2 + Math.cos(a) * 230, S / 2 + Math.sin(a) * 230); } }, accent, 4);
      s.glow((c) => { c.moveTo(0, 256); c.lineTo(S, 256); c.moveTo(0, 768); c.lineTo(S, 768); }, '#06b6d4', 3);
      break;
    }
    case 'foundry': { // basalt grating plates, bolts, scorch marks, glowing magma channels
      grid(4, (x, y, w) => {
        s.panel(x, y, w, w, base, { gap: 8, bevel: 6, vary: 0.12, rough: 0.6 });
        [[22, 22], [w - 22, 22], [22, w - 22], [w - 22, w - 22]].forEach(([rx, ry]) => s.rivet(x + rx, y + ry, 6));
        // grating slots
        for (let k = 0; k < 6; k++) { s.h.fillStyle = gray(30); s.h.fillRect(x + 60, y + 48 + k * 26, w - 120, 10); s.a.fillStyle = 'rgba(0,0,0,0.55)'; s.a.fillRect(x + 60, y + 48 + k * 26, w - 120, 10); }
      });
      s.mottle(80, 150, 0.1, '30,12,4'); s.grime(34); s.scratches(160, 70);
      const magma = (c: CanvasRenderingContext2D) => { c.moveTo(0, 256); c.lineTo(400, 256); c.lineTo(520, 380); c.lineTo(S, 380); };
      s.glow(magma, '#f97316', 18);
      s.glow(magma, '#fde047', 5);
      s.glow((c) => { c.moveTo(768, 0); c.lineTo(768, 256); c.lineTo(640, 380); c.moveTo(130, 380); c.lineTo(130, S); }, '#f97316', 10);
      break;
    }
    case 'cathedral': { // cream marble with deep-blue + gold inlay
      grid(4, (x, y, w) => s.panel(x, y, w, w, base, { gap: 3, bevel: 3, vary: 0.06, rough: 0.22 }));
      s.mottle(90, 150, 0.08, '120,100,70');
      for (let i = 0; i < 18; i++) { const x = s.rnd() * S, y = s.rnd() * S; s.crack(x, y, 120 + s.rnd() * 140, s.rnd() * 6.28); }
      s.wrap(() => { s.a.fillStyle = 'rgba(30,58,138,0.22)'; s.a.fillRect(0, 0, S, S); });
      s.mottle(60, 140, 0.06, '70,60,40');
      s.glow((c) => { c.moveTo(S / 2, 60); c.lineTo(S / 2, S - 60); c.moveTo(60, S / 2); c.lineTo(S - 60, S / 2); }, '#facc15', 6);
      s.glow((c) => { c.arc(S / 2, S / 2, 240, 0, Math.PI * 2); }, '#facc15', 6);
      s.glow((c) => { c.arc(S / 2, S / 2, 160, 0, Math.PI * 2); }, '#fde68a', 3);
      s.glow((c) => { for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; c.moveTo(S / 2 + Math.cos(a) * 160, S / 2 + Math.sin(a) * 160); c.lineTo(S / 2 + Math.cos(a + Math.PI / 12) * 240, S / 2 + Math.sin(a + Math.PI / 12) * 240); } }, '#facc15', 3);
      break;
    }
    case 'spire': { // carbon-fibre twill, violet lattice
      s.a.fillStyle = shade(base, 0.7); s.a.fillRect(0, 0, S, S);
      const cell = 16;
      for (let i = 0; i < S / cell; i++) for (let j = 0; j < S / cell; j++) {
        const dir = (Math.floor(i / 2) + Math.floor(j / 2)) % 2;
        const g = s.a.createLinearGradient(i * cell, j * cell, dir ? i * cell + cell : i * cell, dir ? j * cell : j * cell + cell);
        g.addColorStop(0, 'rgba(255,255,255,0.18)'); g.addColorStop(0.5, 'rgba(0,0,0,0.12)'); g.addColorStop(1, 'rgba(255,255,255,0.1)');
        s.a.fillStyle = g; s.a.fillRect(i * cell, j * cell, cell - 1, cell - 1);
        s.h.fillStyle = gray(dir ? 150 : 120); s.h.fillRect(i * cell, j * cell, cell - 1, cell - 1);
      }
      s.r.fillStyle = gray(40); s.r.fillRect(0, 0, S, S);
      grid(2, (x, y, w) => { s.glow((c) => c.rect(x + 40, y + 40, w - 80, w - 80), accent, 5); s.glow((c) => { c.moveTo(x + 40, y + 40); c.lineTo(x + w - 40, y + w - 40); c.moveTo(x + w - 40, y + 40); c.lineTo(x + 40, y + w - 40); }, '#c084fc', 3); });
      s.glow((c) => { c.moveTo(0, 0); c.lineTo(S, 0); c.moveTo(0, 0); c.lineTo(0, S); }, '#2563eb', 4);
      s.scratches(70, 90); s.mottle(40, 160, 0.05);
      break;
    }
    case 'dock': { // diamond tread plate, hazard lane, gantry rails
      const cell = 32;
      s.a.fillStyle = shade(base, 0.95); s.a.fillRect(0, 0, S, S);
      for (let i = 0; i < S / cell; i++) for (let j = 0; j < S / cell; j++) {
        const dir = (i + j) % 2 ? 1 : -1;
        const cx = i * cell + cell / 2, cy = j * cell + cell / 2;
        s.wrap(() => {
          s.h.save(); s.h.translate(cx, cy); s.h.rotate(dir * 0.7);
          const g = s.h.createLinearGradient(-11, 0, 11, 0); g.addColorStop(0, gray(150)); g.addColorStop(0.5, gray(235)); g.addColorStop(1, gray(150));
          s.h.fillStyle = g; s.h.fillRect(-11, -3, 22, 6); s.h.restore();
          s.a.save(); s.a.translate(cx, cy); s.a.rotate(dir * 0.7); s.a.fillStyle = 'rgba(255,255,255,0.22)'; s.a.fillRect(-11, -3, 22, 2); s.a.fillStyle = 'rgba(0,0,0,0.22)'; s.a.fillRect(-11, 1, 22, 2); s.a.restore();
        });
      }
      s.hazard(0, 448, S, 128, '#f59e0b', '#14181f', 44);
      s.groove(0, 442, S, 442, 6); s.groove(0, 582, S, 582, 6);
      s.glow((c) => { c.moveTo(0, 160); c.lineTo(S, 160); c.moveTo(0, 864); c.lineTo(S, 864); }, '#fbbf24', 7);
      s.grime(44); s.scratches(220, 120); s.mottle(60, 140, 0.08, '40,30,10');
      [[256, 700], [768, 280]].forEach(([x, y]) => { for (let k = 0; k < 4; k++) s.rivet(x + (k % 2) * 28, y + Math.floor(k / 2) * 28, 6); });
      break;
    }
    case 'monolith': { // mirror obsidian with magenta fractal circuits
      s.a.fillStyle = shade(base, 0.62); s.a.fillRect(0, 0, S, S);
      s.r.fillStyle = gray(60); s.r.fillRect(0, 0, S, S);
      grid(2, (x, y, w) => s.panel(x, y, w, w, '#4a3f56', { gap: 4, bevel: 4, vary: 0.05, rough: 0.26 }));
      const cx = S / 2, cy = S / 2;
      for (let r = 70; r < 480; r += 70) s.glow((c) => c.arc(cx, cy, r, s.rnd() * 0.0, Math.PI * 2), accent, r % 140 ? 3 : 6);
      s.glow((c) => { for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) { c.moveTo(cx + Math.cos(a) * 70, cy + Math.sin(a) * 70); c.lineTo(cx + Math.cos(a) * 480, cy + Math.sin(a) * 480); } }, '#e879f9', 2.5);
      s.glow((c) => { for (let k = 0; k < 12; k++) { const a = k * Math.PI / 6 + 0.26; c.moveTo(cx + Math.cos(a) * 210, cy + Math.sin(a) * 210); c.lineTo(cx + Math.cos(a + 0.26) * 280, cy + Math.sin(a + 0.26) * 280); c.lineTo(cx + Math.cos(a + 0.52) * 210, cy + Math.sin(a + 0.52) * 210); } }, '#f0abfc', 3);
      s.mottle(60, 170, 0.07, '40,10,60'); s.scratches(60, 100);
      break;
    }
    case 'abyss': { // wet seabed flagstones: encrusted barnacles, ripple caustics, teal inlay
      grid(4, (x, y, w) => s.panel(x, y, w, w, base, { gap: 6, bevel: 5, vary: 0.1, rough: 0.5 }));
      s.mottle(80, 170, 0.1, '10,40,50'); s.grime(34);
      for (let i = 0; i < 90; i++) { // barnacle clusters
        const bx = s.rnd() * S, by = s.rnd() * S, br = 3 + s.rnd() * 7;
        s.a.fillStyle = 'rgba(210,225,220,0.55)'; s.a.beginPath(); s.a.arc(bx, by, br, 0, Math.PI * 2); s.a.fill();
        s.h.fillStyle = gray(190); s.h.beginPath(); s.h.arc(bx, by, br, 0, Math.PI * 2); s.h.fill();
      }
      for (let i = 0; i < 5; i++) s.crack(s.rnd() * S, s.rnd() * S, 90 + s.rnd() * 160, s.rnd() * 6.28);
      s.glow((c) => { for (let k = 0; k < 4; k++) { c.moveTo(0, 130 + k * 250); for (let x = 0; x <= S; x += 32) c.lineTo(x, 130 + k * 250 + Math.sin(x * 0.02 + k) * 16); } }, accent, 4);
      s.glow((c) => c.arc(S / 2, S / 2, 210, 0, Math.PI * 2), '#67e8f9', 5);
      s.glow((c) => { for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; c.moveTo(S / 2 + Math.cos(a) * 210, S / 2 + Math.sin(a) * 210); c.lineTo(S / 2 + Math.cos(a) * 320, S / 2 + Math.sin(a) * 320); } }, accent, 3);
      break;
    }
    case 'eden': { // pale pearl marble: gold inlay rings, rose-window medallion and soft light veins
      grid(4, (x, y, w) => s.panel(x, y, w, w, base, { gap: 3, bevel: 3, vary: 0.04, rough: 0.16 }));
      s.mottle(220, 245, 0.06, '255,250,230'); s.grime(4);
      for (let i = 0; i < 14; i++) s.crack(s.rnd() * S, s.rnd() * S, 80 + s.rnd() * 150, s.rnd() * 6.28);
      const cx = S / 2, cy = S / 2;
      s.glow((c) => c.arc(cx, cy, 320, 0, Math.PI * 2), accent, 5);
      s.glow((c) => c.arc(cx, cy, 230, 0, Math.PI * 2), '#fff7d6', 3);
      s.glow((c) => c.arc(cx, cy, 110, 0, Math.PI * 2), accent, 4);
      s.glow((c) => { for (let k = 0; k < 12; k++) { const a = k * Math.PI / 6; c.moveTo(cx + Math.cos(a) * 110, cy + Math.sin(a) * 110); c.lineTo(cx + Math.cos(a) * 320, cy + Math.sin(a) * 320); } }, '#fde68a', 2.5);
      s.glow((c) => { c.moveTo(0, 128); c.lineTo(S, 128); c.moveTo(0, 896); c.lineTo(S, 896); }, accent, 3);
      for (let k = 0; k < 8; k++) s.rivet(60 + (k % 4) * 30, 60 + Math.floor(k / 4) * 30, 4);
      break;
    }
    case 'cryo': { // frosted deck plates: ice veins, cyan data traces, hex cooling inlay
      grid(4, (x, y, w) => s.panel(x, y, w, w, base, { gap: 5, bevel: 5, vary: 0.07, rough: 0.2 }));
      s.mottle(80, 175, 0.08, '20,60,90'); s.grime(10);
      for (let i = 0; i < 12; i++) s.crack(s.rnd() * S, s.rnd() * S, 110 + s.rnd() * 220, s.rnd() * 6.28); // ice fractures
      const cx = S / 2, cy = S / 2;
      s.glow((c) => c.arc(cx, cy, 300, 0, Math.PI * 2), accent, 6);
      s.glow((c) => c.arc(cx, cy, 170, 0, Math.PI * 2), '#e0f2fe', 3);
      s.glow((c) => { for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; c.moveTo(cx + Math.cos(a) * 170, cy + Math.sin(a) * 170); c.lineTo(cx + Math.cos(a) * 300, cy + Math.sin(a) * 300); } }, '#a5f3fc', 3);
      s.glow((c) => { for (let k = 0; k < 4; k++) { c.moveTo(0, 110 + k * 270); c.lineTo(160, 110 + k * 270); c.lineTo(200, 150 + k * 270); c.lineTo(S, 150 + k * 270); } }, accent, 2.5);
      for (let k = 0; k < 8; k++) s.rivet(60 + (k % 4) * 30, 60 + Math.floor(k / 4) * 30, 5);
      break;
    }
    case 'overgrow': { // moss-split flagstones: root veins, clover patches, glowing lime spore trails
      grid(4, (x, y, w) => s.panel(x, y, w, w, base, { gap: 6, bevel: 4, vary: 0.1, rough: 0.8 }));
      s.mottle(90, 170, 0.1, '30,60,10'); s.grime(14);
      for (let i = 0; i < 7; i++) s.crack(s.rnd() * S, s.rnd() * S, 100 + s.rnd() * 200, s.rnd() * 6.28);
      // roots creeping along the joints
      for (let i = 0; i < 14; i++) {
        const x = s.rnd() * S, y = s.rnd() * S, a = s.rnd() * 6.28, len = 120 + s.rnd() * 220;
        s.wrap(() => {
          s.a.strokeStyle = 'rgba(56,36,18,0.85)'; s.a.lineWidth = 5 + s.rnd() * 5; s.a.lineCap = 'round';
          s.h.strokeStyle = 'rgba(230,230,230,0.9)'; s.h.lineWidth = 6;
          for (const c of [s.a, s.h]) {
            c.beginPath(); c.moveTo(x, y);
            c.bezierCurveTo(x + Math.cos(a) * len * 0.3, y + Math.sin(a + 0.7) * len * 0.3, x + Math.cos(a + 0.6) * len * 0.7, y + Math.sin(a) * len * 0.7, x + Math.cos(a) * len, y + Math.sin(a) * len);
            c.stroke();
          }
        });
      }
      // moss + clover patches
      for (let i = 0; i < 70; i++) {
        const x = s.rnd() * S, y = s.rnd() * S, r = 10 + s.rnd() * 38;
        s.wrap(() => {
          const g = s.a.createRadialGradient(x, y, 0, x, y, r);
          g.addColorStop(0, `rgba(${60 + s.rnd() * 30},${120 + s.rnd() * 50},30,0.55)`); g.addColorStop(1, 'rgba(60,120,30,0)');
          s.a.fillStyle = g; s.a.fillRect(x - r, y - r, r * 2, r * 2);
        });
      }
      // luminous spore trails
      const cx = S / 2, cy = S / 2;
      s.glow((c) => { c.moveTo(0, 190); c.bezierCurveTo(260, 90, 420, 300, S, 170); }, accent, 4);
      s.glow((c) => { c.moveTo(120, S); c.bezierCurveTo(300, 700, 600, 880, 900, 600); }, '#d9f99d', 3);
      s.glow((c) => c.arc(cx, cy, 230, 0, Math.PI * 2), accent, 3);
      for (let k = 0; k < 18; k++) s.glowRect(s.rnd() * S, s.rnd() * S, 6, 6, k % 3 ? '#d9f99d' : '#fde68a');
      break;
    }
    case 'molten': { // cooled basalt slabs split by glowing lava fissures, heat-scorched with ember specks
      grid(4, (x, y, w) => s.panel(x, y, w, w, base, { gap: 6, bevel: 5, vary: 0.12, rough: 0.82 }));
      s.mottle(100, 190, 0.12, '20,8,4'); s.grime(34);
      for (let i = 0; i < 10; i++) s.crack(s.rnd() * S, s.rnd() * S, 120 + s.rnd() * 240, s.rnd() * 6.28);
      // lava fissures: wide dull-red under-glow, narrow white-hot core
      for (let i = 0; i < 9; i++) {
        const x = s.rnd() * S, y = s.rnd() * S, a = s.rnd() * 6.28, len = 160 + s.rnd() * 300;
        const pts: [number, number][] = [[x, y]];
        let cx = x, cy = y, ca = a;
        for (let k = 0; k < 6; k++) { ca += (s.rnd() - 0.5) * 1.1; cx += Math.cos(ca) * len / 6; cy += Math.sin(ca) * len / 6; pts.push([cx, cy]); }
        const path = (c: CanvasRenderingContext2D) => { c.moveTo(pts[0][0], pts[0][1]); for (let k = 1; k < pts.length; k++) c.lineTo(pts[k][0], pts[k][1]); };
        s.glow(path, accent, 7);
        s.glow(path, '#fde68a', 2.5);
      }
      const cx = S / 2, cy = S / 2;
      s.glow((c) => c.arc(cx, cy, 250, 0, Math.PI * 2), accent, 4);
      for (let k = 0; k < 22; k++) s.glowRect(s.rnd() * S, s.rnd() * S, 6, 6, k % 3 ? '#fb923c' : '#fde68a');
      break;
    }
    case 'storm': { // wet gunmetal deck plates: rain sheen, blue conduit circuits and concentric charge rings
      grid(4, (x, y, w) => s.panel(x, y, w, w, base, { gap: 5, bevel: 5, vary: 0.08, rough: 0.3 }));
      s.mottle(80, 170, 0.08, '10,20,50'); s.grime(14);
      for (let i = 0; i < 6; i++) s.crack(s.rnd() * S, s.rnd() * S, 80 + s.rnd() * 160, s.rnd() * 6.28);
      const cx = S / 2, cy = S / 2;
      for (let r = 80; r <= 320; r += 80) s.glow((c) => c.arc(cx, cy, r, 0, Math.PI * 2), r % 160 ? accent : '#bae6fd', r % 160 ? 3 : 5);
      s.glow((c) => { for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; c.moveTo(cx + Math.cos(a) * 80, cy + Math.sin(a) * 80); c.lineTo(cx + Math.cos(a) * 320, cy + Math.sin(a) * 320); } }, accent, 3);
      // forked lightning-like traces across the plates
      for (let i = 0; i < 6; i++) {
        const x = s.rnd() * S, y = s.rnd() * S;
        const pts: [number, number][] = [[x, y]];
        let px = x, py = y;
        for (let k = 0; k < 6; k++) { px += (s.rnd() - 0.5) * 120; py += 40 + s.rnd() * 60; pts.push([px, py]); }
        s.glow((c) => { c.moveTo(pts[0][0], pts[0][1]); for (let k = 1; k < pts.length; k++) c.lineTo(pts[k][0], pts[k][1]); }, '#7dd3fc', 2.5);
      }
      for (let k = 0; k < 18; k++) s.glowRect(s.rnd() * S, s.rnd() * S, 6, 6, k % 3 ? '#7dd3fc' : '#e0f2fe');
      for (let k = 0; k < 8; k++) s.rivet(60 + (k % 4) * 30, 60 + Math.floor(k / 4) * 30, 5);
      break;
    }
    case 'neon': { // wet black-violet tiles: magenta/cyan neon grid, circuit traces and scattered green code glyphs
      grid(4, (x, y, w) => s.panel(x, y, w, w, base, { gap: 5, bevel: 4, vary: 0.07, rough: 0.18 }));
      s.mottle(80, 170, 0.07, '20,10,50'); s.grime(10);
      const cx = S / 2, cy = S / 2;
      s.glow((c) => { c.moveTo(0, 128); c.lineTo(S, 128); c.moveTo(0, 640); c.lineTo(S, 640); }, accent, 4);
      s.glow((c) => { c.moveTo(384, 0); c.lineTo(384, S); c.moveTo(896, 0); c.lineTo(896, S); }, '#67e8f9', 4);
      s.glow((c) => c.arc(cx, cy, 250, 0, Math.PI * 2), accent, 5);
      s.glow((c) => c.arc(cx, cy, 130, 0, Math.PI * 2), '#67e8f9', 3);
      s.glow((c) => { for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; c.moveTo(cx + Math.cos(a) * 130, cy + Math.sin(a) * 130); c.lineTo(cx + Math.cos(a) * 250, cy + Math.sin(a) * 250); } }, '#a78bfa', 3);
      // circuit traces
      for (let i = 0; i < 8; i++) {
        const x = s.rnd() * S, y = s.rnd() * S;
        const pts: [number, number][] = [[x, y]];
        let px = x, py = y;
        for (let k = 0; k < 5; k++) { if (k % 2) py += (s.rnd() - 0.5) * 160; else px += (s.rnd() - 0.5) * 200; pts.push([px, py]); }
        s.glow((c) => { c.moveTo(pts[0][0], pts[0][1]); for (let k = 1; k < pts.length; k++) c.lineTo(pts[k][0], pts[k][1]); }, i % 2 ? '#67e8f9' : '#e879f9', 2.5);
        s.glowRect(px - 5, py - 5, 10, 10, '#f5f3ff');
      }
      // green digits scattered across the tiles (albedo + emissive)
      const glyphs = '0123456789ABCDEF';
      for (let k = 0; k < 46; k++) {
        const gx = s.rnd() * S, gy = s.rnd() * S;
        const txt = glyphs[Math.floor(s.rnd() * 16)] + glyphs[Math.floor(s.rnd() * 16)];
        for (const ctx2 of [s.a, s.e]) {
          ctx2.save(); ctx2.font = 'bold 26px monospace'; ctx2.fillStyle = `rgba(74,222,128,${0.5 + s.rnd() * 0.5})`; ctx2.shadowColor = '#4ade80'; ctx2.shadowBlur = 8; ctx2.fillText(txt, gx, gy); ctx2.restore();
        }
      }
      break;
    }
    case 'relic': { // fused glass-sand slabs with golden sun inlay and violet fractures
      grid(2, (x, y, w) => s.panel(x, y, w, w, base, { gap: 5, bevel: 5, vary: 0.08, rough: 0.22 }));
      s.mottle(70, 170, 0.09, '50,30,80'); s.grime(18);
      for (let i = 0; i < 9; i++) s.crack(s.rnd() * S, s.rnd() * S, 140 + s.rnd() * 220, s.rnd() * 6.28);
      const cx = S / 2, cy = S / 2;
      s.glow((c) => c.arc(cx, cy, 330, 0, Math.PI * 2), '#fcd34d', 6);
      s.glow((c) => c.arc(cx, cy, 200, 0, Math.PI * 2), accent, 5);
      s.glow((c) => { for (let k = 0; k < 16; k++) { const a = k * Math.PI / 8; const r1 = k % 2 ? 250 : 330; c.moveTo(cx + Math.cos(a) * 200, cy + Math.sin(a) * 200); c.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); } }, '#fde68a', 3);
      s.glow((c) => { c.moveTo(0, 90); c.lineTo(S, 90); c.moveTo(0, S - 90); c.lineTo(S, S - 90); }, '#fcd34d', 3);
      for (let k = 0; k < 8; k++) s.rivet(60 + (k % 4) * 30, 60 + Math.floor(k / 4) * 30, 5);
      break;
    }
    default: { // omega: abyssal vault with arterial crimson veins
      grid(2, (x, y, w) => s.panel(x, y, w, w, base, { gap: 7, bevel: 6, vary: 0.08, rough: 0.3 }));
      s.mottle(80, 170, 0.1, '30,0,10'); s.grime(30);
      for (let i = 0; i < 7; i++) s.crack(s.rnd() * S, s.rnd() * S, 150 + s.rnd() * 200, s.rnd() * 6.28);
      const cx = S / 2, cy = S / 2;
      s.glow((c) => c.arc(cx, cy, 360, 0, Math.PI * 2), '#ff0044', 8);
      s.glow((c) => c.arc(cx, cy, 190, 0, Math.PI * 2), '#ef4444', 5);
      s.glow((c) => { // branching arteries
        for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; c.moveTo(cx + Math.cos(a) * 190, cy + Math.sin(a) * 190); c.lineTo(cx + Math.cos(a) * 275, cy + Math.sin(a) * 275); c.lineTo(cx + Math.cos(a + 0.2) * 360, cy + Math.sin(a + 0.2) * 360); c.moveTo(cx + Math.cos(a) * 275, cy + Math.sin(a) * 275); c.lineTo(cx + Math.cos(a - 0.2) * 360, cy + Math.sin(a - 0.2) * 360); }
      }, '#ff2a5f', 3);
      for (let k = 0; k < 8; k++) s.rivet(40 + (k % 4) * 30, 40 + Math.floor(k / 4) * 30, 5);
      break;
    }
  }
  s.grain(10, 8, 12);
  s.scratches(60, 80);
  return s.toMaps();
}

// ───────────────────────────── WALLS ─────────────────────────────
function paintWall(theme: Theme): StageMaps {
  const accent = hex(theme.accentColor);
  const base = PALETTE[theme.style].wall;
  const s = new Surface(S, styleSeed(theme.style, 2), base, 0.55);

  switch (theme.style) {
    case 'apartments': { // composite cladding with louvers and utility conduit
      for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) s.panel(i * 256, j * 512, 256, 512, base, { gap: 5, bevel: 4, vary: 0.06, rough: 0.55 });
      for (let i = 0; i < 4; i++) for (let k = 0; k < 8; k++) { const x = i * 256 + 40, y = 70 + k * 28; s.h.fillStyle = gray(36); s.h.fillRect(x, y, 176, 12); s.a.fillStyle = 'rgba(2,6,23,0.7)'; s.a.fillRect(x, y, 176, 12); s.a.fillStyle = 'rgba(255,255,255,0.2)'; s.a.fillRect(x, y + 12, 176, 2); }
      s.glow((c) => { c.moveTo(0, 500); c.lineTo(S, 500); }, accent, 8);
      for (let i = 0; i < 4; i++) { [[14, 14], [242, 14], [14, 498], [242, 498]].forEach(([x, y]) => s.rivet(i * 256 + x, y, 4)); }
      s.vertGrime(36); s.grime(20);
      break;
    }
    case 'sanctuary': { // gothic tracery arches with stained-glass glow
      for (let i = 0; i < 2; i++) s.panel(i * 512, 0, 512, S, base, { gap: 4, bevel: 5, vary: 0.04, rough: 0.28 });
      for (let i = 0; i < 2; i++) {
        const ox = i * 512;
        const arch = (c: CanvasRenderingContext2D) => { c.moveTo(ox + 90, 1000); c.lineTo(ox + 90, 400); c.quadraticCurveTo(ox + 90, 150, ox + 256, 70); c.quadraticCurveTo(ox + 422, 150, ox + 422, 400); c.lineTo(ox + 422, 1000); };
        s.glow(arch, accent, 6);
        s.glow((c) => { c.moveTo(ox + 256, 120); c.lineTo(ox + 256, 960); c.moveTo(ox + 90, 520); c.lineTo(ox + 422, 520); }, '#6366f1', 4);
        s.glow((c) => c.arc(ox + 256, 330, 70, 0, Math.PI * 2), '#a855f7', 4);
        // stained glass tint
        s.a.fillStyle = 'rgba(99,102,241,0.14)'; s.a.fillRect(ox + 100, 410, 312, 580);
        s.glowRect(ox + 104, 700, 304, 8, '#06b6d4');
      }
      s.mottle(60, 140, 0.05, '70,60,120'); s.vertGrime(20);
      break;
    }
    case 'foundry': { // blast plates with hazard stripes and furnace vents
      for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) s.panel(i * 512, j * 512, 512, 512, base, { gap: 8, bevel: 7, vary: 0.1, rough: 0.6 });
      s.hazard(0, 0, S, 90, '#ea580c', '#14110f', 44);
      s.hazard(0, S - 90, S, 90, '#ea580c', '#14110f', 44);
      s.a.fillStyle = '#0c0a09'; s.a.fillRect(140, 200, 744, 620); s.h.fillStyle = gray(50); s.h.fillRect(140, 200, 744, 620);
      for (let k = 0; k < 14; k++) s.glowRect(170, 230 + k * 42, 684, 14, k % 3 ? '#f97316' : '#fb923c');
      for (let i = 0; i < 6; i++) s.rivet(110, 230 + i * 110, 8);
      for (let i = 0; i < 6; i++) s.rivet(914, 230 + i * 110, 8);
      s.grime(40); s.vertGrime(40); s.mottle(60, 140, 0.1, '30,10,0');
      break;
    }
    case 'cathedral': { // gilded lancet arcade on stone blocks
      for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) s.panel(i * 256 + ((j % 2) * 128), j * 256, 256, 256, base, { gap: 4, bevel: 4, vary: 0.1, rough: 0.6 });
      for (let i = 0; i < 2; i++) {
        const ox = 70 + i * 450;
        const lancet = (c: CanvasRenderingContext2D) => { c.moveTo(ox, 980); c.lineTo(ox, 400); c.quadraticCurveTo(ox, 180, ox + 190, 90); c.quadraticCurveTo(ox + 380, 180, ox + 380, 400); c.lineTo(ox + 380, 980); c.closePath(); };
        s.a.save(); s.a.beginPath(); lancet(s.a); s.a.fillStyle = 'rgba(23,37,84,0.55)'; s.a.fill(); s.a.restore();
        s.h.save(); s.h.beginPath(); lancet(s.h); s.h.fillStyle = gray(70); s.h.fill(); s.h.restore();
        s.glow(lancet, '#eab308', 7);
        s.glow((c) => { c.moveTo(ox + 190, 140); c.lineTo(ox + 190, 960); c.moveTo(ox + 40, 470); c.lineTo(ox + 340, 470); c.moveTo(ox + 40, 720); c.lineTo(ox + 340, 720); }, '#facc15', 3);
        s.glow((c) => c.arc(ox + 190, 330, 50, 0, Math.PI * 2), '#fde68a', 3);
      }
      s.grime(30); s.vertGrime(30);
      break;
    }
    case 'spire': { // dielectric blocks with arcing conduits
      for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) s.panel(i * 512, j * 512, 512, 512, base, { gap: 6, bevel: 6, vary: 0.07, rough: 0.35 });
      [200, 280, 760, 840].forEach((y) => s.glow((c) => { c.moveTo(60, y); c.lineTo(S - 60, y); }, '#a855f7', 6));
      s.glow((c) => { c.rect(70, 70, S - 140, S - 140); }, '#8b5cf6', 4);
      for (let k = 0; k < 6; k++) s.glowRect(170 + k * 130, 420, 70, 180, k % 2 ? '#c084fc' : '#818cf8');
      for (let i = 0; i < 8; i++) { s.rivet(100 + i * 118, 110, 6); s.rivet(100 + i * 118, 914, 6); }
      s.mottle(50, 150, 0.06, '30,20,70'); s.scratches(80, 120);
      break;
    }
    case 'dock': { // armoured bulkhead with X-bracing and hazard trim
      for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) s.panel(i * 512, j * 512, 512, 512, base, { gap: 7, bevel: 7, vary: 0.08, rough: 0.5 });
      s.hazard(0, 0, S, 70, '#f59e0b', '#14181f', 40);
      s.groove(60, 90, S - 60, S - 90, 10); s.groove(S - 60, 90, 60, S - 90, 10);
      s.glow((c) => { c.moveTo(60, 90); c.lineTo(S - 60, S - 90); c.moveTo(S - 60, 90); c.lineTo(60, S - 90); }, '#f59e0b', 3);
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) s.rivet(80 + i * 290, 120 + j * 250, 7);
      s.a.fillStyle = 'rgba(255,255,255,0.8)'; s.a.font = 'bold 70px monospace'; s.a.fillText('BAY-06', 360, 560);
      s.h.fillStyle = gray(170); s.h.font = 'bold 70px monospace'; s.h.fillText('BAY-06', 360, 560);
      s.grime(40); s.vertGrime(44); s.scratches(160, 140);
      break;
    }
    case 'monolith': { // obsidian slabs with rune lines
      for (let i = 0; i < 2; i++) s.panel(i * 512, 0, 512, S, '#53465f', { gap: 6, bevel: 6, vary: 0.04, rough: 0.3 });
      for (let i = 0; i < 2; i++) {
        const ox = i * 512;
        s.glow((c) => { c.moveTo(ox + 256, 80); c.lineTo(ox + 256, 940); c.moveTo(ox + 110, 480); c.lineTo(ox + 402, 480); c.rect(ox + 70, 60, 372, 900); }, accent, 5);
        s.glow((c) => { for (let k = 0; k < 7; k++) { c.moveTo(ox + 140, 200 + k * 100); c.lineTo(ox + 190 + (k % 3) * 40, 200 + k * 100); c.lineTo(ox + 190 + (k % 3) * 40, 240 + k * 100); } }, '#f0abfc', 3);
        s.glowRect(ox + 246, 460, 20, 40, '#f5d0fe');
      }
      s.mottle(60, 150, 0.08, '40,10,60'); s.scratches(50, 100);
      break;
    }
    case 'abyss': { // eroded sea-wall blocks, coral encrustation, bioluminescent veins
      for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) s.panel(i * 256 + ((j % 2) * 128), j * 256, 256, 256, base, { gap: 5, bevel: 5, vary: 0.12, rough: 0.6 });
      for (let i = 0; i < 70; i++) {
        const bx = s.rnd() * S, by = S * 0.55 + s.rnd() * S * 0.45, br = 3 + s.rnd() * 9;
        s.a.fillStyle = s.rnd() > 0.5 ? 'rgba(251,113,133,0.5)' : 'rgba(210,225,220,0.5)'; s.a.beginPath(); s.a.arc(bx, by, br, 0, Math.PI * 2); s.a.fill();
        s.h.fillStyle = gray(200); s.h.beginPath(); s.h.arc(bx, by, br, 0, Math.PI * 2); s.h.fill();
      }
      for (let i = 0; i < 2; i++) {
        const ox = i * 512;
        s.glow((c) => { c.moveTo(ox + 90, 960); c.lineTo(ox + 90, 420); c.quadraticCurveTo(ox + 90, 140, ox + 256, 100); c.quadraticCurveTo(ox + 422, 140, ox + 422, 420); c.lineTo(ox + 422, 960); }, accent, 5);
        s.glow((c) => { c.moveTo(ox + 256, 160); c.bezierCurveTo(ox + 200, 380, ox + 320, 560, ox + 256, 900); }, '#67e8f9', 3);
      }
      s.vertGrime(44); s.grime(30); s.mottle(60, 140, 0.08, '10,40,50');
      break;
    }
    case 'cryo': { // rimed archive racks: frozen data columns with cyan status strips
      for (let i = 0; i < 4; i++) s.panel(i * 256, 0, 256, S, base, { gap: 6, bevel: 6, vary: 0.06, rough: 0.28 });
      for (let i = 0; i < 4; i++) {
        const ox = i * 256;
        s.glow((c) => { c.rect(ox + 40, 70, 176, 880); }, '#e0f2fe', 3);
        s.glow((c) => { for (let k = 0; k < 10; k++) { c.moveTo(ox + 60, 120 + k * 80); c.lineTo(ox + 60 + 40 + (k * 37 % 90), 120 + k * 80); } }, accent, 4);
        for (let k = 0; k < 10; k++) s.glowRect(ox + 190, 112 + k * 80, 10, 16, k % 3 ? '#67e8f9' : '#e0f2fe');
      }
      for (let i = 0; i < 6; i++) s.crack(s.rnd() * S, s.rnd() * S, 120 + s.rnd() * 200, s.rnd() * 6.28);
      s.mottle(60, 160, 0.08, '20,60,90'); s.vertGrime(14);
      break;
    }
    case 'overgrow': { // vine-wrapped ruin walls: ivy curtains, moss, glowing blossoms
      for (let i = 0; i < 4; i++) s.panel(i * 256, 0, 256, S, base, { gap: 6, bevel: 5, vary: 0.08, rough: 0.8 });
      s.mottle(70, 150, 0.1, '30,60,10');
      // ivy curtains hanging from the top edge
      for (let i = 0; i < 16; i++) {
        const x = s.rnd() * S, len = 260 + s.rnd() * 560;
        s.wrap(() => {
          s.a.strokeStyle = 'rgba(40,86,22,0.9)'; s.a.lineWidth = 4;
          s.h.strokeStyle = 'rgba(220,220,220,0.8)'; s.h.lineWidth = 4;
          for (const c of [s.a, s.h]) { c.beginPath(); c.moveTo(x, 0); for (let y = 0; y <= len; y += 24) c.lineTo(x + Math.sin(y * 0.03 + i) * 12, y); c.stroke(); }
          for (let y = 30; y < len; y += 26) {
            const lx = x + Math.sin(y * 0.03 + i) * 12 + (y % 52 ? 9 : -9);
            s.a.fillStyle = y % 3 ? 'rgba(86,140,38,0.95)' : 'rgba(58,104,28,0.95)';
            s.a.beginPath(); s.a.ellipse(lx, y, 9, 5, y % 52 ? 0.6 : -0.6, 0, Math.PI * 2); s.a.fill();
            s.h.fillStyle = 'rgba(210,210,210,0.8)'; s.h.beginPath(); s.h.ellipse(lx, y, 9, 5, y % 52 ? 0.6 : -0.6, 0, Math.PI * 2); s.h.fill();
          }
        });
      }
      // glowing blossoms on the vines
      for (let i = 0; i < 26; i++) {
        const x = s.rnd() * S, y = 80 + s.rnd() * 700;
        s.glowRect(x, y, 8, 8, i % 3 ? accent : '#fbcfe8');
      }
      for (let i = 0; i < 4; i++) {
        const ox = i * 256;
        s.glow((c) => { c.moveTo(ox + 50, 960); c.lineTo(ox + 50, 300); c.quadraticCurveTo(ox + 128, 150, ox + 206, 300); c.lineTo(ox + 206, 960); }, accent, 3);
      }
      for (let i = 0; i < 6; i++) s.crack(s.rnd() * S, s.rnd() * S, 120 + s.rnd() * 200, s.rnd() * 6.28);
      s.vertGrime(20);
      break;
    }
    case 'molten': { // scorched foundry plating: riveted steel panels, glowing seams, soot streaks, heat vents
      for (let i = 0; i < 4; i++) s.panel(i * 256, 0, 256, S, base, { gap: 6, bevel: 6, vary: 0.08, rough: 0.55, metalTone: 0.4 });
      s.mottle(70, 160, 0.1, '30,10,4'); s.vertGrime(36);
      for (let i = 0; i < 4; i++) {
        const ox = i * 256;
        s.glow((c) => { c.moveTo(ox + 128, 90); c.lineTo(ox + 128, 930); }, accent, 4);
        s.glow((c) => { for (let k = 0; k < 8; k++) { c.moveTo(ox + 50, 150 + k * 100); c.lineTo(ox + 206, 150 + k * 100); } }, '#fdba74', 2);
        for (let k = 0; k < 8; k++) s.glowRect(ox + 40, 130 + k * 100, 8, 8, k % 3 ? '#fb923c' : '#fde68a');
      }
      for (let i = 0; i < 8; i++) s.crack(s.rnd() * S, s.rnd() * S, 100 + s.rnd() * 220, s.rnd() * 6.28);
      s.vertGrime(16);
      break;
    }
    case 'storm': { // rain-streaked storm plating: riveted navy panels, blue conduit strips and status lights
      for (let i = 0; i < 4; i++) s.panel(i * 256, 0, 256, S, base, { gap: 6, bevel: 6, vary: 0.07, rough: 0.35, metalTone: 0.5 });
      s.mottle(70, 160, 0.08, '10,20,50'); s.vertGrime(30);
      for (let i = 0; i < 4; i++) {
        const ox = i * 256;
        s.glow((c) => { c.moveTo(ox + 128, 80); c.lineTo(ox + 128, 940); }, accent, 4);
        s.glow((c) => { for (let k = 0; k < 8; k++) { c.moveTo(ox + 56, 140 + k * 100); c.lineTo(ox + 200, 140 + k * 100); } }, '#bae6fd', 2);
        for (let k = 0; k < 8; k++) s.glowRect(ox + 40, 122 + k * 100, 8, 8, k % 3 ? '#38bdf8' : '#e0f2fe');
      }
      for (let i = 0; i < 6; i++) s.crack(s.rnd() * S, s.rnd() * S, 100 + s.rnd() * 200, s.rnd() * 6.28);
      s.vertGrime(18);
      break;
    }
    case 'neon': { // dark glass facades: neon strip lines, window grids and falling green code columns
      for (let i = 0; i < 4; i++) s.panel(i * 256, 0, 256, S, base, { gap: 6, bevel: 5, vary: 0.06, rough: 0.25, metalTone: 0.5 });
      s.mottle(70, 160, 0.07, '20,10,50'); s.vertGrime(14);
      for (let i = 0; i < 4; i++) {
        const ox = i * 256;
        s.glow((c) => { c.moveTo(ox + 24, 60); c.lineTo(ox + 24, 960); c.moveTo(ox + 232, 60); c.lineTo(ox + 232, 960); }, i % 2 ? '#e879f9' : '#67e8f9', 4);
        s.glow((c) => { for (let k = 0; k < 6; k++) { c.moveTo(ox + 50, 150 + k * 130); c.lineTo(ox + 206, 150 + k * 130); } }, '#a78bfa', 2);
        for (let k = 0; k < 12; k++) s.glowRect(ox + 60 + (k % 3) * 56, 120 + Math.floor(k / 3) * 190, 30, 60, k % 4 === 0 ? '#67e8f9' : k % 4 === 1 ? '#e879f9' : '#312e81');
      }
      const glyphs = '01ABCDEF';
      for (let col = 0; col < 14; col++) {
        const x = 20 + col * 72, y0 = s.rnd() * 500;
        for (let k = 0; k < 10; k++) for (const ctx2 of [s.a, s.e]) {
          ctx2.save(); ctx2.font = 'bold 22px monospace'; ctx2.fillStyle = `rgba(74,222,128,${0.15 + (k / 10) * 0.85})`; ctx2.shadowColor = '#4ade80'; ctx2.shadowBlur = 6;
          ctx2.fillText(glyphs[Math.floor(s.rnd() * glyphs.length)], x, y0 + k * 30); ctx2.restore();
        }
      }
      s.vertGrime(10);
      break;
    }
    case 'eden': { // white marble colonnade: fluted pilasters with gold capitals, feather relief and halo medallions
      for (let i = 0; i < 4; i++) s.panel(i * 256, 0, 256, S, base, { gap: 5, bevel: 5, vary: 0.04, rough: 0.2, metalTone: 0.3 });
      s.mottle(220, 245, 0.05, '255,250,235'); s.vertGrime(4);
      for (let i = 0; i < 4; i++) {
        const ox = i * 256;
        s.glow((c) => { c.moveTo(ox + 30, 40); c.lineTo(ox + 30, 984); c.moveTo(ox + 226, 40); c.lineTo(ox + 226, 984); }, '#fbbf24', 3);
        s.glow((c) => c.arc(ox + 128, 210, 56, 0, Math.PI * 2), '#fde68a', 3);
        s.glow((c) => c.arc(ox + 128, 210, 30, 0, Math.PI * 2), '#fbbf24', 2);
        s.glow((c) => { for (let k = 0; k < 7; k++) { c.moveTo(ox + 70, 420 + k * 70); c.quadraticCurveTo(ox + 128, 450 + k * 70, ox + 186, 420 + k * 70); } }, '#fcd34d', 2);
        s.glowRect(ox + 100, 860, 56, 14, '#fbbf24');
      }
      s.vertGrime(4);
      break;
    }
    case 'relic': { // sun-glyph plates of fused glass with gold trim
      for (let i = 0; i < 2; i++) s.panel(i * 512, 0, 512, S, base, { gap: 6, bevel: 6, vary: 0.06, rough: 0.3 });
      for (let i = 0; i < 2; i++) {
        const ox = i * 512, cx = ox + 256, cy = 400;
        s.glow((c) => { c.rect(ox + 60, 60, 392, 900); }, '#fcd34d', 4);
        s.glow((c) => c.arc(cx, cy, 120, 0, Math.PI * 2), accent, 5);
        s.glow((c) => { for (let k = 0; k < 16; k++) { const a = k * Math.PI / 8; c.moveTo(cx + Math.cos(a) * 130, cy + Math.sin(a) * 130); c.lineTo(cx + Math.cos(a) * (k % 2 ? 170 : 200), cy + Math.sin(a) * (k % 2 ? 170 : 200)); } }, '#fde68a', 3);
        s.glowRect(cx - 12, cy - 12, 24, 24, '#fef3c7');
        s.glow((c) => { for (let k = 0; k < 5; k++) { c.moveTo(ox + 120, 640 + k * 56); c.lineTo(ox + 200 + (k % 3) * 40, 640 + k * 56); } }, accent, 3);
      }
      s.mottle(60, 150, 0.08, '50,30,80'); s.scratches(60, 100); s.vertGrime(20);
      break;
    }
    default: { // omega containment lattice
      for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) s.panel(i * 512, j * 512, 512, 512, base, { gap: 8, bevel: 7, vary: 0.08, rough: 0.35 });
      const cx = S / 2, cy = S / 2;
      s.glow((c) => c.rect(60, 60, S - 120, S - 120), '#ff0044', 6);
      s.glow((c) => c.arc(cx, cy, 300, 0, Math.PI * 2), '#ff0044', 7);
      s.glow((c) => c.arc(cx, cy, 190, 0, Math.PI * 2), '#ef4444', 4);
      s.glow((c) => { for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; c.moveTo(cx + Math.cos(a) * 190, cy + Math.sin(a) * 190); c.lineTo(cx + Math.cos(a) * 300, cy + Math.sin(a) * 300); } c.moveTo(60, 60); c.lineTo(cx - 212, cy - 212); c.moveTo(S - 60, 60); c.lineTo(cx + 212, cy - 212); c.moveTo(60, S - 60); c.lineTo(cx - 212, cy + 212); c.moveTo(S - 60, S - 60); c.lineTo(cx + 212, cy + 212); }, '#ff2a5f', 3);
      s.glowRect(cx - 14, cy - 14, 28, 28, '#fecdd3');
      for (let k = 0; k < 8; k++) { s.rivet(100 + k * 118, 100, 6); s.rivet(100 + k * 118, S - 100, 6); }
      for (let i = 0; i < 5; i++) s.crack(s.rnd() * S, s.rnd() * S, 150 + s.rnd() * 160, s.rnd() * 6.28);
      s.mottle(70, 150, 0.1, '30,0,10'); s.vertGrime(24);
      break;
    }
  }
  s.grain(10, 8, 12);
  s.scratches(80, 90);
  return s.toMaps();
}

// ───────────────────────────── COVER PANEL ─────────────────────────────
function paintPanel(theme: Theme): StageMaps {
  const accent = hex(theme.accentColor);
  const base = PALETTE[theme.style].wall;
  const P = 512;
  const s = new Surface(P, styleSeed(theme.style, 3), base, 0.45);
  s.panel(0, 0, 256, 256, shade(base, 0.9), { gap: 5, bevel: 5, vary: 0.05, rough: 0.4 });
  s.panel(256, 0, 256, 256, shade(base, 1.0), { gap: 5, bevel: 5, vary: 0.05, rough: 0.4 });
  s.panel(0, 256, 256, 256, shade(base, 1.05), { gap: 5, bevel: 5, vary: 0.05, rough: 0.4 });
  s.panel(256, 256, 256, 256, shade(base, 0.95), { gap: 5, bevel: 5, vary: 0.05, rough: 0.4 });
  [[0, 0], [256, 0], [0, 256], [256, 256]].forEach(([x, y]) => {
    [[20, 20], [236, 20], [20, 236], [236, 236]].forEach(([rx, ry]) => s.rivet(x + rx, y + ry, 4.5));
  });
  // vents
  [[40, 90], [296, 346]].forEach(([x, y]) => { for (let k = 0; k < 5; k++) { s.h.fillStyle = gray(34); s.h.fillRect(x, y + k * 14, 160, 7); s.a.fillStyle = 'rgba(0,0,0,0.6)'; s.a.fillRect(x, y + k * 14, 160, 7); } });
  s.glow((c) => { c.moveTo(0, 256); c.lineTo(P, 256); }, accent, 4);
  s.glowRect(300, 40, 120, 8, accent);
  s.glowRect(60, 330, 8, 100, accent);
  s.grime(8); s.vertGrime(8); s.scratches(40, 60);
  s.grain(10, 8, 12);
  return s.toMaps();
}

export function createStageTextures(theme: Theme): StageTextureSet {
  const floor = paintFloor(theme);
  floor.map.repeat.set(10, 10); floor.bumpMap.repeat.set(10, 10); floor.roughnessMap.repeat.set(10, 10); floor.emissiveMap.repeat.set(10, 10);
  const wall = paintWall(theme);
  [wall.map, wall.bumpMap, wall.roughnessMap, wall.emissiveMap].forEach((t) => t.repeat.set(8, 2));
  const panel = paintPanel(theme);
  [panel.map, panel.bumpMap, panel.roughnessMap, panel.emissiveMap].forEach((t) => t.repeat.set(1, 1));
  return { floor, wall, panel };
}

/** Build a PBR material from a texture set. Roughness is baked into the map, so the scalar stays 1. */
export function stageMaterial(maps: StageMaps, opts: { metalness: number; bumpScale?: number; emissiveIntensity?: number }): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    map: maps.map,
    bumpMap: maps.bumpMap,
    bumpScale: opts.bumpScale ?? 2.2,
    roughnessMap: maps.roughnessMap,
    roughness: 1,
    metalness: opts.metalness,
    emissive: 0xffffff,
    emissiveMap: maps.emissiveMap,
    emissiveIntensity: opts.emissiveIntensity ?? 0.85,
  });
}
