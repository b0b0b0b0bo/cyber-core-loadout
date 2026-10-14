import React from 'react';
import { Weapon } from '../types';

export type SightKind =
  | 'combat' | 'acog' | 'sniper' | 'rail'                                   // optical scopes
  | 'holo' | 'reddot' | 'magnum' | 'twin' | 'viper' | 'bead' | 'breacher'  // handheld / close range
  | 'arc' | 'ricochet' | 'swarm' | 'nano'                                   // special sidearms
  | 'launcher' | 'frost' | 'hydra' | 'wave' | 'gatling' | 'solar' | 'shrinker'
  | 'bubble';           // heavy ordnance

export interface SightProfile {
  kind: SightKind;
  scoped: boolean;
  fov: number;
  color: string;
  label: string;
  /** small readout under the label */
  sub: string;
}

/** Picks the ADS sight that matches a weapon's physical model and gimmick. */
export function getSightProfile(w: Weapon): SightProfile {
  const p = (kind: SightKind, scoped: boolean, fov: number, color: string, label: string, sub: string): SightProfile => ({ kind, scoped, fov, color, label, sub });
  switch (w.id) {
    // ── optics ──
    case 'main_spectre': return p('combat', true, 38, '#22d3ee', 'SPECTRE // 3.5X PLASMA COMBAT SCOPE', 'RANGE 85m // STABILIZER 100%');
    case 'main_hyperion': return p('acog', true, 46, '#fb923c', 'HYPERION // 2.5X RADIANT ACOG', '3-ROUND BURST // CHEVRON BDC');
    case 'main_void_sniper': return p('sniper', true, 20, '#c084fc', 'VOID SEEKER // 10X PHASE SCOPE', 'WINDAGE 0.0 // PHASE LOCK');
    case 'heavy_railgun': return p('rail', true, 26, '#38bdf8', 'LONGINUS // 6.0X KINETIC RANGEFINDER', 'RAIL CAPACITORS NOMINAL');
    // ── sidearms ──
    case 'sub_pulsar': return p('holo', false, 60, '#38bdf8', 'ARCHON 9 // HOLO RING', 'STANDARD ISSUE // ENERGY CELL');
    case 'sub_magnum': return p('magnum', false, 56, '#fbbf24', 'APOCRYPHA .50 // HEAVY NOTCH', 'PIERCE ×1 // .50 CORE ROUND');
    case 'sub_twin_revolver': return p('twin', false, 58, '#38bdf8', 'TWIN PULSE // DUAL CONVERGENCE', 'PULSE OVERLOAD // EVERY 8TH');
    case 'sub_akimbo': return p('viper', false, 60, '#4ade80', 'TWIN VIPER // FANG SIGHT', 'L/R ALTERNATE FIRE');
    case 'sub_arc_blaster': return p('arc', false, 58, '#7dd3fc', 'VOLT CHAIN // ARC CONDUCTOR', 'CHAIN ×3 // 35% DECAY');
    case 'sub_ricochet_blade': return p('ricochet', false, 58, '#34d399', 'RICOCHET EDGE // BOUNCE VECTOR', 'REFLECT ×3 // 8% DECAY');
    case 'sub_drone_funnel': return p('swarm', false, 58, '#22d3ee', 'HORNET SWARM // HIVE DESIGNATOR', 'DRONE LINK // 12s LIFETIME');
    case 'sub_nanoswarm': return p('nano', false, 58, '#4ade80', 'PLAGUE BLOOM // SPORE TRACKER', 'INFECTION STACK ×3');
    case 'main_spreader': return p('reddot', false, 58, '#fb923c', 'SPREAD-ER // WIDE RING DOT', 'RATE ↑ SPREAD ↑ // RESETS ON RELEASE');
    case 'sub_smg': return p('reddot', false, 58, '#f87171', 'VECTOR-9 // MICRO RED DOT', 'FULL AUTO // CQB');
    // ── shotguns ──
    case 'main_reaper': return p('bead', false, 60, '#fb7185', 'REAPER // GHOST-RING BEAD', 'FLAK ×7 // ≤4m BONUS');
    case 'main_slug_breacher': return p('breacher', false, 60, '#fdba74', 'GOLIATH // SLUG BREACH SIGHT', 'SLUG // PIERCE + KNOCKBACK');
    // ── heavy ──
    case 'heavy_launcher': return p('launcher', false, 54, '#34d399', 'SINGULARITY // GRAVITY LOCK', 'IMPLOSION FIELD // ARMED');
    case 'heavy_frost_cannon': return p('frost', false, 54, '#7dd3fc', 'GLACIER // CRYO LOCK-ON', 'CHILL 8 → FREEZE 2s');
    case 'heavy_hydra_missile': return p('hydra', false, 54, '#f43f5e', 'HYDRA // MULTI-TARGET LOCK', 'CLUSTER BOMBLETS // ARMED');
    case 'main_plasma_wave': return p('wave', false, 56, '#38bdf8', 'PLASMA TIDE // WAVE SPREAD GUIDE', 'PIERCE ALL // 12% DECAY');
    case 'heavy_photon_gatling': return p('gatling', false, 58, '#fbbf24', 'PHOTON GATLING // SUPPRESSION RING', 'CHARGE 3.0s MAX');
    case 'main_bubblas': return p('bubble', false, 58, '#67e8f9', 'BUBBLAS // BUBBLE WAND RING', 'PASS-THROUGH // POPS WHEN SPENT');
    case 'heavy_shr1nker': return p('shrinker', false, 52, '#a78bfa', 'SHR1NKER // COLLAPSE LENS', 'CHARGE 3.0s MAX // BEAM ×2 TIME');
    case 'heavy_solar_cannon': return p('solar', false, 50, '#facc15', 'SOLAR FLARE // CORONA BEAM SIGHT', 'CHARGE 1.0s // SCORCH');
    // ── new arsenal ──
    case 'sub_chrono': return p('holo', false, 60, '#c4b5fd', 'CHRONOS-7 // CLOCKWORK RING', 'TIME MARK // BURST 1.2s');
    case 'sub_hive': return p('swarm', false, 58, '#fb7185', 'MICRO HIVE // LOCK-ON DESIGNATOR', 'HOLD TO LOCK ×6 // RELEASE');
    case 'sub_flare': return p('magnum', false, 58, '#f97316', 'HELIX FLARE // MARKER NOTCH', 'MARK +25% // BURN');
    case 'main_needler': return p('reddot', false, 58, '#f472b6', 'SPINE NEEDLER // CRYSTAL DOT', '7 NEEDLES → SUPERCOMBINE');
    case 'main_sonic': return p('wave', false, 56, '#60a5fa', 'ECHO RESONATOR // RESONANCE GUIDE', 'PASSES COVER // CROWD BONUS');
    case 'main_buzzsaw': return p('breacher', false, 58, '#facc15', 'BUZZ RIPPER // BOUNCE VECTOR', 'RICOCHET ×3 // GRIND');
    case 'heavy_meteor': return p('hydra', false, 52, '#ef4444', 'METEOR CALLER // ORBITAL BEACON', 'IMPACT 1.1s // CRATER');
    case 'heavy_sentry': return p('arc', false, 56, '#818cf8', 'VOLT SENTRY // DEPLOY ARC', 'TURRETS ×2 // 16s');
    case 'heavy_inferno': return p('launcher', false, 60, '#fb923c', 'INFERNO ROAR // NOZZLE GUIDE', 'RANGE 10m // STACKING BURN');
  }
  // Fallback by model type for any weapon added later
  if (w.modelType === 'railgun') return p('rail', true, 26, w.color, 'KINETIC RANGEFINDER', '');
  if (w.modelType === 'rifle') return p('combat', true, 38, w.color, 'COMBAT SCOPE', '');
  if (w.modelType === 'revolver') return p('magnum', false, 58, w.color, 'NOTCH & POST', '');
  if (w.modelType === 'shotgun') return p('bead', false, 60, w.color, 'BEAD SIGHT', '');
  if (w.modelType === 'launcher') return p('launcher', false, 54, w.color, 'LAUNCHER LOCK', '');
  return p('holo', false, 60, w.color, 'HOLOGRAPHIC SIGHT', '');
}

export const hasOpticalScope = (w: Weapon): boolean => getSightProfile(w).scoped;

// ───────────────────────── drawing helpers ─────────────────────────
const C = 500; // viewBox centre
const range = (a: number, b: number, step: number) => { const o: number[] = []; for (let v = a; v <= b; v += step) o.push(v); return o; };
const polar = (r: number, deg: number) => [C + Math.cos((deg * Math.PI) / 180) * r, C + Math.sin((deg * Math.PI) / 180) * r] as const;
/** SVG arc path on the centre circle from a0 to a1 (degrees, clockwise). */
const arc = (r: number, a0: number, a1: number) => {
  const [x0, y0] = polar(r, a0);
  const [x1, y1] = polar(r, a1);
  return `M${x0} ${y0}A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1} ${y1}`;
};

/** Infinite rotation about the centre (SMIL, no JS). */
const Spin: React.FC<{ dur: number; reverse?: boolean }> = ({ dur, reverse }) => (
  <animateTransform attributeName="transform" type="rotate" from={`${reverse ? 360 : 0} ${C} ${C}`} to={`${reverse ? 0 : 360} ${C} ${C}`} dur={`${dur}s`} repeatCount="indefinite" />
);
/** Opacity breathing. */
const Pulse: React.FC<{ dur?: number; min?: number; max?: number; begin?: string }> = ({ dur = 1.6, min = 0.35, max = 1, begin = '0s' }) => (
  <animate attributeName="opacity" values={`${max};${min};${max}`} dur={`${dur}s`} begin={begin} repeatCount="indefinite" />
);

const line = (x1: number, y1: number, x2: number, y2: number, c: string, w = 1.5, o = 1, key?: string | number) => (
  <line key={key} x1={x1} y1={y1} x2={x2} y2={y2} stroke={c} strokeWidth={w} strokeOpacity={o} strokeLinecap="round" />
);

const text = (x: number, y: number, s: string, c: string, size = 11, anchor: 'start' | 'middle' | 'end' = 'middle', o = 0.85) => (
  <text x={x} y={y} fill={c} fillOpacity={o} fontSize={size} fontFamily="Orbitron, monospace" fontWeight="bold" letterSpacing="2.5" textAnchor={anchor}>{s}</text>
);

/** Weapon name + readout plate under (or above) a sight. */
const Caption: React.FC<{ p: SightProfile; y: number }> = ({ p, y }) => (
  <g>
    {line(C - 150, y - 16, C - 40, y - 16, p.color, 1, 0.35)}
    {line(C + 40, y - 16, C + 150, y - 16, p.color, 1, 0.35)}
    <path d={`M${C - 6} ${y - 16}l6 -5l6 5l-6 5z`} fill={p.color} fillOpacity={0.8} />
    {text(C, y, p.label, p.color, 10)}
    {p.sub && text(C, y + 15, p.sub, p.color, 8, 'middle', 0.55)}
  </g>
);

/** Corner brackets framing the sight. */
const Brackets: React.FC<{ s: number; len: number; c: string; w?: number; o?: number }> = ({ s, len, c, w = 2, o = 0.8 }) => (
  <path
    d={[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sy]) => `M${C + sx * s} ${C + sy * (s - len)}V${C + sy * s}H${C + sx * (s - len)}`).join('')}
    fill="none" stroke={c} strokeWidth={w} strokeOpacity={o}
  />
);

/** Dark mask over the screen with a circular window cut out for the scope picture. */
const ScopeMask: React.FC<{ r: number; opacity: number }> = ({ r, opacity }) => (
  <path
    fillRule="evenodd"
    fill={`rgba(2,6,23,${opacity})`}
    d={`M-2000 -2000H3000V3000H-2000Z M${C - r} ${C}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`}
  />
);

/** Bright centre point with a soft halo. */
const Dot: React.FC<{ c: string; r?: number; core?: string }> = ({ c, r = 3, core }) => (
  <g>
    <circle cx={C} cy={C} r={r * 3.2} fill={c} fillOpacity={0.18} />
    <circle cx={C} cy={C} r={r} fill={core ?? c} />
  </g>
);

// ───────────────────────── magnified optics ─────────────────────────
const Scope: React.FC<{ p: SightProfile }> = ({ p }) => {
  const c = p.color;

  if (p.kind === 'combat') {
    const R = 245;
    return (
      <g>
        <ScopeMask r={R} opacity={0.38} />
        <circle cx={C} cy={C} r={R} fill="rgba(8,47,73,0.08)" stroke="#0f172a" strokeWidth={10} />
        <circle cx={C} cy={C} r={R - 6} fill="none" stroke={c} strokeOpacity={0.4} strokeWidth={1.5} />
        <g filter="url(#adsGlow)">
          <g opacity={0.5}><Spin dur={30} /><path d={arc(R - 24, 0, 70) + arc(R - 24, 90, 160) + arc(R - 24, 180, 250) + arc(R - 24, 270, 340)} fill="none" stroke={c} strokeWidth={1.2} strokeDasharray="2 6" /></g>
          {line(C - R, C, C - 22, C, c, 1.2, 0.8)}{line(C + 22, C, C + R, C, c, 1.2, 0.8)}
          {line(C, C - R, C, C - 22, c, 1.2, 0.8)}{line(C, C + 22, C, C + R, c, 1.2, 0.8)}
          {[-160, -120, -80, -40, 40, 80, 120, 160].map((o) => (
            <g key={o}>{line(C + o, C - 6, C + o, C + 6, c, 1.5, 0.9)}{line(C - 6, C + o, C + 6, C + o, c, 1.5, 0.9)}</g>
          ))}
          {[20, 36, 52, 70].map((w, i) => line(C - w, C + 135 + i * 18, C + w, C + 135 + i * 18, c, 1.5, 0.7, i))}
          <circle cx={C} cy={C} r={10} fill="none" stroke={c} strokeWidth={1.5} />
          <Dot c={c} r={2.5} />
          {text(C, C - R + 28, p.label, c)}
          {text(C, C + R - 18, p.sub, c, 9, 'middle', 0.7)}
        </g>
      </g>
    );
  }

  if (p.kind === 'acog') {
    const R = 215;
    return (
      <g>
        <ScopeMask r={R} opacity={0.6} />
        <circle cx={C} cy={C} r={R} fill="none" stroke="#1c1917" strokeWidth={18} />
        <circle cx={C} cy={C} r={R - 10} fill="none" stroke={c} strokeOpacity={0.5} strokeWidth={2} />
        {line(C - R, C, C - 60, C, '#0a0a0a', 7)}{line(C + 60, C, C + R, C, '#0a0a0a', 7)}{line(C, C + 60, C, C + R, '#0a0a0a', 7)}
        <g filter="url(#adsGlow)">
          {line(C - 60, C, C - 18, C, c, 2)}{line(C + 18, C, C + 60, C, c, 2)}{line(C, C + 18, C, C + 60, c, 2)}
          {[0, 1, 2, 3].map((i) => (
            <path key={i} d={`M${C - 26 - i * 8} ${C + 55 + i * 34}L${C} ${C + 38 + i * 34}L${C + 26 + i * 8} ${C + 55 + i * 34}`} fill="none" stroke={c} strokeWidth={i === 0 ? 3 : 2} strokeOpacity={1 - i * 0.14} />
          ))}
          {/* three burst pips */}
          {[-1, 0, 1].map((i) => (
            <circle key={i} cx={C + i * 14} cy={C - 30} r={2.5} fill={c}><Pulse dur={0.9} begin={`${(i + 1) * 0.15}s`} /></circle>
          ))}
          <path d={`M${C} ${C - 12}L${C + 9} ${C + 6}H${C - 9}Z`} fill="none" stroke={c} strokeWidth={2} />
          <Dot c={c} r={2.5} />
          {text(C, C - R + 34, p.label, c, 10)}
          {text(C, C + R - 26, p.sub, c, 8, 'middle', 0.65)}
        </g>
      </g>
    );
  }

  if (p.kind === 'sniper') {
    const R = 270;
    return (
      <g>
        <ScopeMask r={R} opacity={0.94} />
        <circle cx={C} cy={C} r={R} fill="none" stroke="#020617" strokeWidth={16} />
        <circle cx={C} cy={C} r={R - 10} fill="none" stroke={c} strokeOpacity={0.55} strokeWidth={2} />
        {line(C - R + 8, C, C - 70, C, '#020617', 8)}{line(C + 70, C, C + R - 8, C, '#020617', 8)}
        {line(C, C - R + 8, C, C - 70, '#020617', 8)}{line(C, C + 70, C, C + R - 8, '#020617', 8)}
        <g filter="url(#adsGlow)">
          <g><Spin dur={40} reverse /><circle cx={C} cy={C} r={R - 28} fill="none" stroke={c} strokeOpacity={0.3} strokeWidth={1} strokeDasharray="3 9" /></g>
          {line(C - 70, C, C - 6, C, c, 1)}{line(C + 6, C, C + 70, C, c, 1)}{line(C, C - 70, C, C - 6, c, 1)}{line(C, C + 6, C, C + 70, c, 1)}
          {range(-200, 200, 25).filter((v) => Math.abs(v) > 30).map((v) => (
            <g key={v}>{line(C + v, C - 5, C + v, C + 5, c, 1.2, 0.85)}{line(C - 5, C + v, C + 5, C + v, c, 1.2, 0.85)}</g>
          ))}
          {/* phase rift marks that breathe in and out */}
          <g>
            <Pulse dur={2.4} min={0.3} />
            {[0, 90, 180, 270].map((a) => (
              <path key={a} d={`M${C + 100} ${C - 14}L${C + 118} ${C}L${C + 100} ${C + 14}`} fill="none" stroke={c} strokeOpacity={0.7} strokeWidth={1.5} transform={`rotate(${a} ${C} ${C})`} />
            ))}
          </g>
          <Dot c={c} r={2} />
          {text(C, C - R + 34, p.label, c)}
          {text(C, C + R - 22, p.sub, c, 9, 'middle', 0.7)}
        </g>
      </g>
    );
  }

  // rail: wide rangefinder scope with brackets and a charging bar
  const R = 255;
  return (
    <g>
      <ScopeMask r={R} opacity={0.66} />
      <circle cx={C} cy={C} r={R} fill="rgba(2,132,199,0.06)" stroke="#0b1220" strokeWidth={14} />
      <circle cx={C} cy={C} r={R - 9} fill="none" stroke={c} strokeOpacity={0.5} strokeWidth={2} />
      <g filter="url(#adsGlow)">
        {line(C - R, C, C - 12, C, c, 1, 0.6)}{line(C + 12, C, C + R, C, c, 1, 0.6)}{line(C, C - R, C, C - 12, c, 1, 0.6)}{line(C, C + 12, C, C + R, c, 1, 0.6)}
        {[90, 150, 210].map((r, i) => (
          <g key={r}><Spin dur={20 + i * 10} reverse={i % 2 === 1} /><circle cx={C} cy={C} r={r} fill="none" stroke={c} strokeOpacity={0.3} strokeWidth={1} strokeDasharray={i === 1 ? '14 10' : undefined} /></g>
        ))}
        <Brackets s={120} len={50} c={c} w={2.5} o={0.9} />
        {[1, 2, 3, 4].map((i) => line(C - 12 - i * 3, C + 130 + i * 22, C + 12 + i * 3, C + 130 + i * 22, c, 1.5, 0.75, i))}
        {/* capacitor charge bar */}
        <rect x={C - 80} y={C - 150} width={160} height={6} fill="none" stroke={c} strokeOpacity={0.5} />
        <rect x={C - 78} y={C - 148} width={156} height={2} fill={c}>
          <animate attributeName="width" values="0;156;156" keyTimes="0;0.7;1" dur="1.6s" repeatCount="indefinite" />
        </rect>
        <Dot c={c} r={2.5} />
        {text(C - R + 70, C - 6, 'ELEV', c, 8, 'middle', 0.6)}{text(C + R - 70, C - 6, 'WIND', c, 8, 'middle', 0.6)}
        {text(C, C - R + 30, p.label, c, 10)}
        {text(C, C + R - 18, p.sub, c, 9, 'middle', 0.7)}
      </g>
    </g>
  );
};

// ───────────────────────── reflex / iron / special sights ─────────────────────────
const Close: React.FC<{ p: SightProfile }> = ({ p }) => {
  const c = p.color;
  switch (p.kind) {
    case 'holo':
      // ARCHON 9: clean holographic ring with segmented, slowly rotating outer band
      return (
        <g>
          <g><Spin dur={14} /><path d={[0, 90, 180, 270].map((a) => arc(58, a + 12, a + 78)).join('')} fill="none" stroke={c} strokeWidth={2} strokeOpacity={0.55} /></g>
          <circle cx={C} cy={C} r={40} fill={c} fillOpacity={0.04} stroke={c} strokeWidth={2.2} />
          {[0, 90, 180, 270].map((a) => <line key={a} x1={C} y1={C - 40} x2={C} y2={C - 28} stroke={c} strokeWidth={2.5} transform={`rotate(${a} ${C} ${C})`} />)}
          <Dot c={c} r={3.2} core="#fff" />
          <Caption p={p} y={C + 110} />
        </g>
      );

    case 'reddot':
      // VECTOR-9: compact window frame + fat red dot + spray-arc ticks
      return (
        <g>
          <rect x={C - 74} y={C - 56} width={148} height={112} rx={14} fill="rgba(248,113,113,0.04)" stroke={c} strokeOpacity={0.35} strokeWidth={2} />
          <circle cx={C} cy={C} r={30} fill="none" stroke={c} strokeOpacity={0.9} strokeWidth={2.5} />
          <g><Spin dur={1.8} /><path d={arc(30, -20, 20) + arc(30, 160, 200)} fill="none" stroke="#fff" strokeOpacity={0.6} strokeWidth={2.5} /></g>
          {[-45, -15, 15, 45].map((a) => <line key={a} x1={C} y1={C + 38} x2={C} y2={C + 48} stroke={c} strokeWidth={2} strokeOpacity={0.6} transform={`rotate(${a} ${C} ${C})`} />)}
          <circle cx={C} cy={C} r={11} fill={c} fillOpacity={0.25} />
          <circle cx={C} cy={C} r={5} fill={c} />
          <Caption p={p} y={C + 100} />
        </g>
      );

    case 'magnum':
      // APOCRYPHA .50: heavy notch & post with a turning 6-chamber cylinder ring
      return (
        <g>
          <g opacity={0.8}><Spin dur={12} />{range(0, 300, 60).map((a) => { const [x, y] = polar(72, a); return <circle key={a} cx={x} cy={y} r={7} fill="none" stroke={c} strokeWidth={2} />; })}</g>
          <circle cx={C} cy={C} r={72} fill="none" stroke={c} strokeOpacity={0.15} strokeWidth={22} />
          <path d={`M${C - 130} ${C + 66}V${C + 12}H${C - 30}L${C - 13} ${C + 40}V${C + 66}Z`} fill="rgba(11,18,32,0.88)" stroke={c} strokeOpacity={0.7} strokeWidth={1.5} />
          <path d={`M${C + 130} ${C + 66}V${C + 12}H${C + 30}L${C + 13} ${C + 40}V${C + 66}Z`} fill="rgba(11,18,32,0.88)" stroke={c} strokeOpacity={0.7} strokeWidth={1.5} />
          <circle cx={C - 50} cy={C + 30} r={3.5} fill={c} /><circle cx={C + 50} cy={C + 30} r={3.5} fill={c} />
          <rect x={C - 7} y={C - 38} width={14} height={50} fill="rgba(11,18,32,0.92)" stroke={c} strokeWidth={1.5} />
          <circle cx={C} cy={C - 30} r={4} fill={c}><Pulse dur={2} min={0.6} /></circle>
          {/* penetration arrow */}
          <path d={`M${C} ${C - 62}l-8 -12h16z`} fill={c} fillOpacity={0.8} />
          <Caption p={p} y={C + 120} />
        </g>
      );

    case 'twin':
      // TWIN PULSE: two converging rings + an 8-pip overload counter that keeps cycling
      return (
        <g>
          {[-1, 1].map((s) => (
            <g key={s}>
              <circle cx={C + s * 46} cy={C} r={22} fill="none" stroke={c} strokeWidth={2} strokeOpacity={0.85} />
              <circle cx={C + s * 46} cy={C} r={3} fill={c} />
              <path d={`M${C + s * 74} ${C - 18}l${s * 14} 18l${-s * 14} 18`} fill="none" stroke={c} strokeWidth={2} strokeOpacity={0.6} />
            </g>
          ))}
          {line(C - 24, C, C - 10, C, c, 2)}{line(C + 10, C, C + 24, C, c, 2)}
          <path d={`M${C} ${C - 7}l7 7l-7 7l-7 -7z`} fill={c} />
          {range(0, 7, 1).map((i) => {
            const [x, y] = polar(64, 120 - i * (60 / 7) + 0);
            return (
              <rect key={i} x={x - 3} y={y - 3} width={6} height={6} fill={i === 7 ? '#fff' : c} transform={`rotate(45 ${x} ${y})`}>
                <animate attributeName="opacity" values="0.15;1;1;0.15" keyTimes={`0;${(i / 8).toFixed(3)};0.97;1`} dur="2.4s" repeatCount="indefinite" />
              </rect>
            );
          })}
          <Caption p={p} y={C + 112} />
        </g>
      );

    case 'viper':
      // TWIN VIPER: two fangs closing on a slit snake-eye, alternating like the guns
      return (
        <g>
          <g opacity={0.5}><Spin dur={10} reverse /><circle cx={C} cy={C} r={84} fill="none" stroke={c} strokeWidth={1.5} strokeDasharray="10 7 2 7" /></g>
          {[-1, 1].map((s, i) => (
            <path key={s} d={`M${C + s * 66} ${C - 46}Q${C + s * 34} ${C - 10} ${C + s * 30} ${C + 4}Q${C + s * 34} ${C - 4} ${C + s * 50} ${C - 6}Q${C + s * 58} ${C + 28} ${C + s * 66} ${C + 46}`} fill={c} fillOpacity={0.18} stroke={c} strokeWidth={2.2} strokeLinejoin="round">
              <animate attributeName="fill-opacity" values="0.1;0.55;0.1" dur="0.55s" begin={`${i * 0.275}s`} repeatCount="indefinite" />
            </path>
          ))}
          <ellipse cx={C} cy={C} rx={5} ry={15} fill="none" stroke={c} strokeWidth={2} />
          <ellipse cx={C} cy={C} rx={1.6} ry={9} fill="#fff" />
          {text(C - 98, C + 4, 'L', c, 10, 'middle', 0.6)}{text(C + 98, C + 4, 'R', c, 10, 'middle', 0.6)}
          <Caption p={p} y={C + 124} />
        </g>
      );

    case 'arc':
      // VOLT CHAIN: jagged electric ring with chain nodes hopping outward
      return (
        <g>
          <path
            d={range(0, 23, 1).map((i) => { const [x, y] = polar(i % 2 ? 46 : 54, i * 15); return `${i ? 'L' : 'M'}${x} ${y}`; }).join('') + 'Z'}
            fill="none" stroke={c} strokeWidth={1.8} strokeLinejoin="round"
          >
            <animate attributeName="stroke-opacity" values="1;0.4;0.9;0.5;1" dur="0.4s" repeatCount="indefinite" />
          </path>
          <g><Spin dur={3} />
            {[0, 120, 240].map((a, i) => {
              const [x1, y1] = polar(70, a);
              const [x2, y2] = polar(100, a + 20);
              return (
                <g key={a}>
                  <path d={`M${polar(56, a).join(' ')}L${x1} ${y1}L${(x1 + x2) / 2 + 6} ${(y1 + y2) / 2 - 6}L${x2} ${y2}`} fill="none" stroke={c} strokeWidth={1.5} strokeOpacity={0.75} />
                  <circle cx={x2} cy={y2} r={4} fill={c}><Pulse dur={0.6} begin={`${i * 0.2}s`} /></circle>
                </g>
              );
            })}
          </g>
          <path d={`M${C + 4} ${C - 14}L${C - 5} ${C + 2}H${C + 3}L${C - 4} ${C + 14}`} fill="none" stroke="#fff" strokeWidth={2.2} strokeLinejoin="round" />
          <Caption p={p} y={C + 132} />
        </g>
      );

    case 'ricochet':
      // RICOCHET EDGE: diamond reticle with reflected bounce vectors tracing round
      return (
        <g>
          <path d={`M${C} ${C - 52}L${C + 52} ${C}L${C} ${C + 52}L${C - 52} ${C}Z`} fill="none" stroke={c} strokeWidth={2} />
          <path d={`M${C} ${C - 30}L${C + 30} ${C}L${C} ${C + 30}L${C - 30} ${C}Z`} fill="none" stroke={c} strokeWidth={1} strokeOpacity={0.4} />
          <path
            d={`M${C - 120} ${C - 40}L${C - 60} ${C + 40}L${C} ${C - 40}L${C + 60} ${C + 40}L${C + 120} ${C - 40}`}
            fill="none" stroke={c} strokeWidth={1.5} strokeOpacity={0.6} strokeDasharray="8 8"
          >
            <animate attributeName="stroke-dashoffset" values="0;-32" dur="0.8s" repeatCount="indefinite" />
          </path>
          {[[-60, 40], [0, -40], [60, 40]].map(([x, y], i) => (
            <circle key={i} cx={C + x} cy={C + y} r={4} fill="none" stroke={c} strokeWidth={1.5}><Pulse dur={1.2} begin={`${i * 0.3}s`} /></circle>
          ))}
          {text(C - 66, C + 62, '×1', c, 8, 'middle', 0.6)}{text(C, C - 52, '×2', c, 8, 'middle', 0.6)}{text(C + 66, C + 62, '×3', c, 8, 'middle', 0.6)}
          <Dot c={c} r={3} core="#fff" />
          <Caption p={p} y={C + 108} />
        </g>
      );

    case 'swarm':
      // HORNET SWARM: honeycomb hive with drones orbiting the aim point
      return (
        <g>
          {[[0, 0], ...range(0, 300, 60).map((a) => [Math.cos((a * Math.PI) / 180) * 52, Math.sin((a * Math.PI) / 180) * 52])].map(([x, y], i) => (
            <polygon
              key={i}
              points={range(0, 300, 60).map((a) => `${C + x + Math.cos(((a + 30) * Math.PI) / 180) * 28},${C + y + Math.sin(((a + 30) * Math.PI) / 180) * 28}`).join(' ')}
              fill={c} fillOpacity={i === 0 ? 0.06 : 0.02} stroke={c} strokeWidth={i === 0 ? 2 : 1} strokeOpacity={i === 0 ? 0.95 : 0.35}
            />
          ))}
          {[0, 1, 2, 3].map((i) => (
            <g key={i}>
              <Spin dur={2.4 + i * 0.6} reverse={i % 2 === 1} />
              <path d={`M${C + 92 + i * 6} ${C}l-10 -6v12z`} fill={c} transform={`rotate(${i * 90} ${C} ${C})`} />
            </g>
          ))}
          <Dot c={c} r={3} core="#fff" />
          <Caption p={p} y={C + 128} />
        </g>
      );

    case 'nano':
      // PLAGUE BLOOM: three-lobed bloom with spores drifting outwards
      return (
        <g>
          <g><Spin dur={9} />
            {[0, 120, 240].map((a) => <path key={a} d={arc(42, a - 50, a + 50)} fill="none" stroke={c} strokeWidth={3} />)}
            {[60, 180, 300].map((a) => { const [x, y] = polar(42, a); return <circle key={a} cx={x} cy={y} r={3} fill={c} fillOpacity={0.6} />; })}
          </g>
          <circle cx={C} cy={C} r={16} fill="none" stroke={c} strokeWidth={1.5} strokeOpacity={0.7} />
          {range(0, 330, 30).map((a, i) => {
            const [x0, y0] = polar(58, a);
            const [x1, y1] = polar(96, a + 10);
            return (
              <circle key={a} r={2.4} fill={c}>
                <animate attributeName="cx" values={`${x0};${x1}`} dur="1.8s" begin={`${(i % 4) * 0.45}s`} repeatCount="indefinite" />
                <animate attributeName="cy" values={`${y0};${y1}`} dur="1.8s" begin={`${(i % 4) * 0.45}s`} repeatCount="indefinite" />
                <animate attributeName="opacity" values="1;0" dur="1.8s" begin={`${(i % 4) * 0.45}s`} repeatCount="indefinite" />
              </circle>
            );
          })}
          <Dot c={c} r={3} />
          <Caption p={p} y={C + 130} />
        </g>
      );

    case 'bead':
      // REAPER: wide ghost ring = pellet spread, with a close-range bonus band
      return (
        <g>
          <circle cx={C} cy={C} r={78} fill="none" stroke={c} strokeOpacity={0.22} strokeWidth={16} />
          <circle cx={C} cy={C} r={78} fill="none" stroke={c} strokeWidth={2.5} />
          <g><Spin dur={6} reverse /><path d={range(0, 6, 1).map((i) => arc(96, i * 51.4, i * 51.4 + 14)).join('')} fill="none" stroke={c} strokeWidth={3} strokeOpacity={0.7} /></g>
          {range(0, 6, 1).map((i) => { const [x, y] = polar(40, i * 51.4 - 90); return <circle key={i} cx={x} cy={y} r={2.5} fill={c} fillOpacity={0.7} />; })}
          <circle cx={C} cy={C} r={7} fill={c} /><circle cx={C} cy={C} r={13} fill="none" stroke="#fff" strokeOpacity={0.55} />
          <Caption p={p} y={C + 132} />
        </g>
      );

    case 'breacher':
      // GOLIATH: heavy square breach frame with a single slug lane
      return (
        <g>
          <Brackets s={88} len={46} c={c} w={4} />
          <rect x={C - 64} y={C - 64} width={128} height={128} fill="none" stroke={c} strokeOpacity={0.18} strokeWidth={1} />
          {line(C - 40, C, C - 14, C, c, 3)}{line(C + 14, C, C + 40, C, c, 3)}
          {line(C, C - 40, C, C - 14, c, 3)}
          <rect x={C - 5} y={C - 5} width={10} height={10} fill={c} transform={`rotate(45 ${C} ${C})`} />
          <path d={`M${C - 20} ${C + 30}H${C + 20}`} stroke={c} strokeWidth={6} strokeOpacity={0.8}><Pulse dur={1.4} min={0.4} /></path>
          <Caption p={p} y={C + 132} />
        </g>
      );

    case 'launcher':
      // SINGULARITY: gravity well — rings collapsing into the centre
      return (
        <g>
          <Brackets s={92} len={36} c={c} w={3} />
          {[0, 1, 2].map((i) => (
            <circle key={i} cx={C} cy={C} r={70} fill="none" stroke={c} strokeWidth={1.5}>
              <animate attributeName="r" values="70;6" dur="1.8s" begin={`${i * 0.6}s`} repeatCount="indefinite" />
              <animate attributeName="opacity" values="0;0.8;0" dur="1.8s" begin={`${i * 0.6}s`} repeatCount="indefinite" />
            </circle>
          ))}
          <circle cx={C} cy={C} r={26} fill="none" stroke={c} strokeWidth={2} />
          {line(C - 46, C, C - 26, C, c, 2)}{line(C + 26, C, C + 46, C, c, 2)}{line(C, C - 46, C, C - 26, c, 2)}
          {[1, 2, 3, 4].map((i) => line(C - 10 - i * 4, C + 40 + i * 14, C + 10 + i * 4, C + 40 + i * 14, c, 1.5, 0.8, i))}
          <Dot c={c} r={3} />
          <Caption p={p} y={C + 140} />
        </g>
      );

    case 'frost':
      // GLACIER: hexagonal snowflake lock with crystal growth
      return (
        <g>
          <polygon points={range(0, 5, 1).map((i) => polar(86, i * 60).join(',')).join(' ')} fill="rgba(125,211,252,0.05)" stroke={c} strokeWidth={2.5} />
          <g><Spin dur={18} />
            {[0, 60, 120, 180, 240, 300].map((a) => (
              <g key={a} transform={`rotate(${a} ${C} ${C})`}>
                {line(C + 20, C, C + 70, C, c, 1.5, 0.75)}
                <path d={`M${C + 46} ${C}l10 -9M${C + 46} ${C}l10 9M${C + 60} ${C}l7 -6M${C + 60} ${C}l7 6`} stroke={c} strokeWidth={1.5} strokeOpacity={0.75} fill="none" />
              </g>
            ))}
          </g>
          <polygon points={range(0, 5, 1).map((i) => polar(16, i * 60 + 30).join(',')).join(' ')} fill="none" stroke="#fff" strokeWidth={1.5} />
          <circle cx={C} cy={C} r={3.5} fill="#fff" />
          <Caption p={p} y={C + 124} />
        </g>
      );

    case 'hydra':
      // HYDRA: six lock boxes that blink in sequence around a dashed search ring
      return (
        <g>
          <g><Spin dur={12} /><circle cx={C} cy={C} r={112} fill="none" stroke={c} strokeOpacity={0.4} strokeDasharray="6 8" strokeWidth={1.5} /></g>
          {[[-62, -36], [0, -36], [62, -36], [-62, 36], [0, 36], [62, 36]].map(([x, y], i) => (
            <g key={i}>
              <path d={`M${C + x - 16} ${C + y - 16}h10M${C + x - 16} ${C + y - 16}v10M${C + x + 16} ${C + y - 16}h-10M${C + x + 16} ${C + y - 16}v10M${C + x - 16} ${C + y + 16}h10M${C + x - 16} ${C + y + 16}v-10M${C + x + 16} ${C + y + 16}h-10M${C + x + 16} ${C + y + 16}v-10`} fill="none" stroke={c} strokeWidth={2} />
              <rect x={C + x - 4} y={C + y - 4} width={8} height={8} fill={c}>
                <animate attributeName="opacity" values="0;0;1;1" keyTimes={`0;${(i / 6).toFixed(3)};${((i + 0.5) / 6).toFixed(3)};1`} dur="1.8s" repeatCount="indefinite" />
              </rect>
            </g>
          ))}
          <Dot c={c} r={3} />
          <Caption p={p} y={C + 146} />
        </g>
      );

    case 'wave':
      // PLASMA TIDE: horizontal wave guide with a travelling sine
      return (
        <g>
          {[1, -1].map((s) => (
            <g key={s}>
              <path d={`M${C + s * 60} ${C - 70}Q${C + s * 120} ${C} ${C + s * 60} ${C + 70}`} fill="none" stroke={c} strokeWidth={3} />
              <path d={`M${C + s * 90} ${C - 90}Q${C + s * 170} ${C} ${C + s * 90} ${C + 90}`} fill="none" stroke={c} strokeWidth={1.5} strokeOpacity={0.45} />
            </g>
          ))}
          <path d={range(-50, 50, 5).map((x, i) => `${i ? 'L' : 'M'}${C + x} ${C + Math.sin(x / 8) * 6}`).join('')} fill="none" stroke={c} strokeWidth={1.8} strokeOpacity={0.8} strokeDasharray="10 6">
            <animate attributeName="stroke-dashoffset" values="0;-32" dur="0.6s" repeatCount="indefinite" />
          </path>
          <Dot c={c} r={3.5} core="#fff" />
          <Caption p={p} y={C + 124} />
        </g>
      );

    case 'gatling':
      // PHOTON GATLING: barrel-cluster ring spinning up around a suppression circle
      return (
        <g>
          <circle cx={C} cy={C} r={98} fill="none" stroke={c} strokeWidth={2.5} />
          <g><Spin dur={0.9} />{range(0, 300, 60).map((a) => { const [x, y] = polar(98, a); return <circle key={a} cx={x} cy={y} r={6} fill="rgba(11,18,32,0.8)" stroke={c} strokeWidth={2} />; })}</g>
          <circle cx={C} cy={C} r={54} fill="none" stroke={c} strokeOpacity={0.55} strokeDasharray="3 5" />
          {[0, 90, 180, 270].map((a) => <line key={a} x1={C + 20} y1={C} x2={C + 44} y2={C} stroke={c} strokeWidth={2.5} transform={`rotate(${a} ${C} ${C})`} />)}
          <Dot c={c} r={3} />
          <Caption p={p} y={C + 140} />
        </g>
      );

    case 'bubble':
      // BUBBLAS: a wand ring with a few drifting bubbles
      return (
        <g>
          <circle cx={C} cy={C} r={74} fill="none" stroke={c} strokeWidth={2.5} />
          <circle cx={C} cy={C} r={74} fill={c} fillOpacity={0.06} />
          <circle cx={C} cy={C} r={88} fill="none" stroke={c} strokeOpacity={0.3} strokeDasharray="2 8" />
          {[[-34, -22, 11], [30, -34, 7], [38, 26, 13], [-26, 36, 8], [4, 52, 5]].map(([x, y, r], i) => (
            <g key={i}>
              <circle cx={C + x} cy={C + y} r={r} fill="none" stroke={c} strokeOpacity={0.8} strokeWidth={1.6}>
                <animate attributeName="cy" values={`${C + y};${C + y - 10};${C + y}`} dur={`${2 + i * 0.4}s`} repeatCount="indefinite" />
              </circle>
              <circle cx={C + x - r * 0.35} cy={C + y - r * 0.35} r={Math.max(1.2, r * 0.18)} fill="#fff" fillOpacity={0.8} />
            </g>
          ))}
          <Dot c={c} r={3} />
          <Caption p={p} y={C + 124} />
        </g>
      );

    case 'shrinker':
      // SHR1NKER: concentric rings collapsing onto the aim point
      return (
        <g>
          {[110, 76, 46].map((r, i) => (
            <circle key={r} cx={C} cy={C} r={r} fill="none" stroke={c} strokeWidth={i === 2 ? 2.5 : 1.6} strokeOpacity={0.9 - i * 0.2} strokeDasharray={i === 1 ? '14 8' : undefined} />
          ))}
          <circle cx={C} cy={C} r={110} fill="none" stroke={c} strokeWidth={2}>
            <animate attributeName="r" values="116;24" dur="1.2s" repeatCount="indefinite" />
            <animate attributeName="stroke-opacity" values="0;0.9;0" dur="1.2s" repeatCount="indefinite" />
          </circle>
          {[0, 90, 180, 270].map((a) => <line key={a} x1={C + 18} y1={C} x2={C + 38} y2={C} stroke={c} strokeWidth={3} transform={`rotate(${a} ${C} ${C})`} />)}
          <Dot c={c} r={3} core="#fff" />
          <Caption p={p} y={C + 142} />
        </g>
      );

    case 'solar':
    default:
      // SOLAR FLARE: corona with rotating rays and a charging core
      return (
        <g>
          <circle cx={C} cy={C} r={30} fill="none" stroke={c} strokeWidth={2.5} />
          <circle cx={C} cy={C} r={70} fill="none" stroke={c} strokeOpacity={0.55} strokeWidth={1.5} />
          <circle cx={C} cy={C} r={70} fill="none" stroke={c} strokeOpacity={0.18} strokeWidth={12} />
          <g><Spin dur={16} />
            {range(0, 350, 30).map((a) => <line key={a} x1={C + 82} y1={C} x2={C + (a % 90 === 0 ? 122 : 102)} y2={C} stroke={c} strokeWidth={a % 90 === 0 ? 3 : 1.5} strokeOpacity={0.85} transform={`rotate(${a} ${C} ${C})`} />)}
          </g>
          <circle cx={C} cy={C} r={10} fill={c} fillOpacity={0.4}>
            <animate attributeName="r" values="4;22;4" dur="1s" repeatCount="indefinite" />
            <animate attributeName="fill-opacity" values="0.6;0.1;0.6" dur="1s" repeatCount="indefinite" />
          </circle>
          <circle cx={C} cy={C} r={4} fill="#fff" />
          <Caption p={p} y={C + 156} />
        </g>
      );
  }
};

/** Full-screen ADS overlay that matches the equipped weapon's sight. */
export const AdsSight: React.FC<{ weapon: Weapon; hit: boolean }> = ({ weapon, hit }) => {
  const p = getSightProfile(weapon);
  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
      <svg key={weapon.id} viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid meet" className="w-full h-full ads-sight-in" style={{ overflow: 'visible' }}>
        <defs>
          <filter id="adsGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.2" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <radialGradient id="adsVig" cx="50%" cy="50%" r="50%">
            <stop offset="35%" stopColor="rgba(2,6,23,0)" /><stop offset="100%" stopColor="rgba(2,6,23,0.42)" />
          </radialGradient>
        </defs>
        {p.scoped ? <Scope p={p} /> : (
          <>
            <rect x={-2000} y={-2000} width={5000} height={5000} fill="url(#adsVig)" opacity={0.7} />
            <g filter="url(#adsGlow)"><Close p={p} /></g>
          </>
        )}
        {hit && (
          <g stroke="#f43f5e" strokeWidth={4} strokeLinecap="round" filter="url(#adsGlow)">
            <line x1={C - 22} y1={C - 22} x2={C - 10} y2={C - 10} /><line x1={C + 22} y1={C - 22} x2={C + 10} y2={C - 10} />
            <line x1={C - 22} y1={C + 22} x2={C - 10} y2={C + 10} /><line x1={C + 22} y1={C + 22} x2={C + 10} y2={C + 10} />
          </g>
        )}
      </svg>
    </div>
  );
};
