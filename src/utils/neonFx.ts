import * as THREE from 'three';

/**
 * Shared "digital" visuals for MAP 10 (NEON DISTRICT): falling green digit columns, used on holo-screens,
 * data curtains and enemy displays. Textures are cached; `scrollDigits` animates them.
 */

export const DATA_GREEN = 0x4ade80;
export const DATA_GREEN_HOT = 0xbbf7d0;

const cache = new Map<string, THREE.CanvasTexture>();

/** Columns of glowing green 0/1/hex characters on transparent black; brightest at the bottom of each column (the "head"). */
export function digitTexture(cols = 8, rows = 20, seed = 1, color = '#4ade80'): THREE.CanvasTexture {
  const key = `${cols}|${rows}|${seed}|${color}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const cw = 32, ch = 36;
  const c = document.createElement('canvas');
  c.width = cols * cw;
  c.height = rows * ch;
  const g = c.getContext('2d')!;
  g.clearRect(0, 0, c.width, c.height);
  g.font = `bold ${Math.round(ch * 0.78)}px monospace`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  let s = seed * 9301 + 49297;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const chars = '01234567890ABCDEF<>{}[]/=+*';
  for (let x = 0; x < cols; x++) {
    const start = Math.floor(rnd() * rows);
    const len = 6 + Math.floor(rnd() * (rows - 6));
    for (let k = 0; k < len; k++) {
      const y = (start + k) % rows;
      const a = Math.pow((k + 1) / len, 1.6);
      g.fillStyle = k === len - 1 ? 'rgba(220,255,230,1)' : hexA(color, 0.15 + a * 0.85);
      g.shadowColor = color;
      g.shadowBlur = k === len - 1 ? 10 : 4;
      g.fillText(chars[Math.floor(rnd() * chars.length)], x * cw + cw / 2, y * ch + ch / 2);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  cache.set(key, t);
  return t;
}

function hexA(hex: string, a: number) {
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** Additive screen material showing the digit columns. */
export function digitMaterial(tex: THREE.Texture, opacity = 0.9, tint = 0xffffff, side: THREE.Side = THREE.DoubleSide) {
  return new THREE.MeshBasicMaterial({ map: tex, color: tint, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side, toneMapped: false });
}

/** Scroll a digit texture downward. */
export const scrollDigits = (tex: THREE.Texture, dt: number, speed = 0.35) => { tex.offset.y -= dt * speed; };
