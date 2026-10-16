import * as THREE from 'three';
import type { BossKind } from './bossModels';
import { yawTo, HazardFx } from './combatHazards';
import type { CombatCtx, CombatEnemy } from './eliteEnemyAI';

/**
 * Boss attack patterns. Every attack has a wind-up with
 *   1) a full-body telegraph pose (cue → animateBoss / animateBossMotion: rear up, crouch, aim, spin ...),
 *   2) a floor marker that fills up until the hit lands (hazard system), and
 *   3) a white flash on the boss' accent lights right before release.
 * Each boss draws from its own weighted pool and unlocks extra moves at HP 66% / 33%.
 *
 *  shared     : seraph_charge, holy_laser_fan, meteor_bomb, nova_ring, spiral_barrage, judgement_slam
 *  signature  : sky_dive (GOLGOTHA / WARDEN), rock_wave (GOLEM / KRAKEN), rail_cannon (TITAN / WARDEN),
 *               artillery_rain (all, kind-specific shells), tentacle_sweep (KRAKEN / GOLEM / GOLGOTHA),
 *               whirlpool (KRAKEN), prism_beam (WARDEN), summon_guard (phase 2+), phase_shift (on enrage)
 */

export const BOSS_FX: Record<BossKind, { a: number; b: number; slam: number; radius: number }> = {
  golgotha: { a: 0x38bdf8, b: 0xff0055, slam: 0x38bdf8, radius: 9.5 },
  golem: { a: 0xffa21f, b: 0xff5a1a, slam: 0xf97316, radius: 9 },
  titan: { a: 0xff3322, b: 0xff8a1f, slam: 0xff3322, radius: 10.5 },
  kraken: { a: 0x2dd4bf, b: 0x67e8f9, slam: 0x14b8a6, radius: 10 },
  warden: { a: 0xa78bfa, b: 0xfde68a, slam: 0x8b5cf6, radius: 9.5 },
  frost: { a: 0x67e8f9, b: 0xe0f7ff, slam: 0x38bdf8, radius: 10 },
  myco: { a: 0xa3e635, b: 0xfde047, slam: 0x65a30d, radius: 10.5 },
  magma: { a: 0xff6a1a, b: 0xffc15a, slam: 0xea580c, radius: 10.5 },
  storm: { a: 0x38bdf8, b: 0xbae6fd, slam: 0x3b82f6, radius: 11 },
  neon: { a: 0xe879f9, b: 0x67e8f9, slam: 0x8b5cf6, radius: 11 },
  eden: { a: 0xfde68a, b: 0xffffff, slam: 0xfbbf24, radius: 11.5 },
};

/** Which elite guards each boss calls in (summon_guard). */
const SUMMONS: Record<BossKind, string[]> = {
  golgotha: ['jester', 'mirage'],
  golem: ['mite', 'mite', 'mite', 'mite'],
  titan: ['carrier', 'aegis'],
  kraken: ['wyrm', 'splitter'],
  warden: ['mender', 'lancer', 'berserker'],
  frost: ['weaver', 'chrono', 'lancer'],
  myco: ['wyrm', 'carrier', 'jester'],
  magma: ['pyro', 'wyrm', 'lancer'],
  storm: ['weaver', 'lancer', 'magnet'],
  neon: ['mirage', 'jester', 'weaver'],
  eden: ['virtue', 'seraphim', 'archangel'],
};

/** First move after an enrage roar. */
const SIGNATURE: Record<BossKind, string> = {
  golgotha: 'sky_dive',
  golem: 'rock_wave',
  titan: 'rail_cannon',
  kraken: 'tentacle_sweep',
  warden: 'prism_beam',
  frost: 'rock_wave',
  myco: 'spore_brood',
  magma: 'magma_cannon',
  storm: 'thunder_strike',
  neon: 'data_rain',
  eden: 'thunder_strike',
};

const LABELS: Record<string, Partial<Record<BossKind, string>> & { def: string }> = {
  seraph_charge: { def: 'CHARGE', myco: 'CAP STAMPEDE', magma: 'MAGMA RUSH', storm: 'GALE RUSH', neon: 'BURST DASH', eden: 'SERAPH DESCENT', golgotha: 'SERAPH CHARGE', golem: 'COLOSSUS RAM', titan: 'DREADNOUGHT RAM', kraken: 'TIDAL RUSH', warden: 'LANCE CHARGE', frost: 'GLACIAL RUSH' },
  artillery_rain: { def: 'BARRAGE', myco: 'SPORE BOMBARD', magma: 'MAGMA SHELLING', storm: 'BALL LIGHTNING', neon: 'NEON LANCES', eden: 'RAIN OF FEATHERS', golgotha: 'HEAVEN PILLAR', golem: 'BOULDER RAIN', titan: 'ARTILLERY RAIN', kraken: 'WATER BOMB', warden: 'SWORD RAIN', frost: 'ICICLE RAIN' },
  rock_wave: { def: 'ROCK WAVE', myco: 'MYCELIUM RUN', magma: 'LAVA UPTHRUST', storm: 'THUNDER RUN', neon: 'PACKET WAVE', eden: 'RIVER OF LIGHT', golem: 'ROCK WAVE', kraken: 'GEYSER LINE', frost: 'GLACIER LINE' },
  tentacle_sweep: { def: 'SWEEP', myco: 'HYPHAE SWEEP', magma: 'CLAW SWEEP', storm: 'WIND BLADE', neon: 'TENDRIL SWEEP', eden: 'SIX-WING SCYTHE', kraken: 'TENTACLE SWEEP', golem: 'TITAN SWEEP', golgotha: 'WING SCYTHE', frost: 'BLADE SWEEP' },
  rail_cannon: { def: 'RAIL CANNON', storm: 'THUNDER LANCE', neon: 'DATA LANCE', eden: 'TRUMPET BLAST', myco: 'SPORE LANCE', titan: 'RAIL CANNON', warden: 'PRISM LANCE', frost: 'CRYO LANCE' },
};
const EXTRA_LABELS: Record<string, Partial<Record<BossKind, string>>> = {
  holy_laser_fan: { myco: 'SPORE FAN', magma: 'HEAT FAN', storm: 'ARC FAN', neon: 'SPECTRUM FAN', eden: 'FLAMING BLADES' },
  meteor_bomb: { myco: 'PUFFBALL', magma: 'SLAG BOMB', storm: 'STATIC BOMB', neon: 'GLITCH BOMB', eden: 'HAILSTONES' },
  nova_ring: { myco: 'SPORE RING', magma: 'FLARE RING', storm: 'EM FIELD', neon: 'PULSE RING', eden: 'SEVEN BOWLS' },
  spiral_barrage: { myco: 'SPORE SPIRAL', magma: 'CORE VORTEX', storm: 'TEMPEST SPIRAL', neon: 'CODE SPIRAL', eden: 'WHEELS OF EYES' },
  judgement_slam: { myco: 'CAP SLAM', magma: 'CORE SLAM', storm: 'EM FIELD SLAM', neon: 'OVERLOAD SLAM', eden: 'HOLY JUDGEMENT' },
  spore_brood: { myco: 'SPORE BROOD' },
  magma_cannon: { magma: 'MAGMA CANNON' },
  thunder_strike: { storm: 'THUNDER JUDGEMENT', eden: 'PILLARS OF HEAVEN' },
  storm_vortex: { storm: 'STORM VORTEX', eden: 'WHIRLWIND OF EZEKIEL' },
  data_rain: { neon: 'DATA RAIN' },
  prism_beam: { neon: 'NEON PRISM', eden: 'SEVENFOLD LIGHT' },
};
const labelOf = (p: string, k: BossKind) => EXTRA_LABELS[p]?.[k] ?? LABELS[p]?.[k] ?? LABELS[p]?.def ?? p.toUpperCase();

const phaseWind = (ph: number) => (ph >= 3 ? 0.78 : ph === 2 ? 0.9 : 1);

/** Pattern length (s) for the current phase. */
function durationOf(p: string, ph: number): number {
  const f = phaseWind(ph);
  switch (p) {
    case 'seraph_charge': return ph >= 3 ? 0.8 * f + 0.7 + 0.5 * f + 0.7 + 0.7 : 0.8 * f + 0.7 + 0.8;
    case 'holy_laser_fan': return 0.2 + (ph >= 2 ? 3 : 2) * 1.15 * f + 0.6;
    case 'meteor_bomb': return 0.15 + 2 * 1.5 * f + 0.4;
    case 'nova_ring': return 0.9 * f + (ph >= 3 ? 1.7 : ph === 2 ? 1.2 : 0.8);
    case 'spiral_barrage': return 4.6;
    case 'judgement_slam': return (1.25 - ph * 0.1) + (ph >= 2 ? 1.7 : 1.0);
    case 'artillery_rain': return 0.8 * f + 1.0 + (4 + ph * 2) * 0.14 + 0.5;
    case 'rail_cannon': return ph >= 3 ? 1.7 * f + 0.35 + 1.0 * f + 0.8 : 1.7 * f + 0.9;
    case 'rock_wave': return 0.75 * f + 1.7;
    case 'sky_dive': return 0.6 * f + 2.1 + 0.9;
    case 'tentacle_sweep': return ph >= 2 ? 0.1 + 1.1 * f + 0.55 + 0.75 * f + 0.7 : 0.1 + 1.1 * f + 0.8;
    case 'whirlpool': return 3.8;
    case 'prism_beam': return 1.0 * f + 4.2 + 0.5;
    case 'spore_brood': return 1.1 * f + 0.25 + 1.6 + 0.8;
    case 'magma_cannon': return 1.4 * f + 0.2 + (8 + ph * 3) * 0.1 + 0.9;
    case 'thunder_strike': return 1.0 * f + (ph >= 3 ? 4 : 3) * 0.85 + 0.95 + 0.7;
    case 'storm_vortex': return 1.2 * f + 4.2 + 0.7;
    case 'data_rain': return 1.1 * f + (ph >= 3 ? 3 : ph >= 2 ? 2 : 1) * 1.5 + 1.3 + 0.5;
    case 'summon_guard': return 2.2;
    case 'phase_shift': return 2.4;
  }
  return 3;
}

function pool(kind: BossKind, ph: number, dist: number, e: CombatEnemy, c: CombatCtx): [string, number][] {
  const p: [string, number][] = [];
  const near = dist < 14;
  const guards = SUMMONS[kind];
  const guardsAlive = c.enemies.filter((o) => !o.isDead && guards.includes(o.typeId)).length;
  const canSummon = ph >= 2 && guardsAlive < (kind === 'golem' ? 6 : 3) && !(e.ai?.summonedPhase === ph);
  switch (kind) {
    case 'golgotha':
      p.push(['seraph_charge', 2], ['holy_laser_fan', 3], ['meteor_bomb', 2], ['judgement_slam', near ? 2 : 0.6], ['sky_dive', 1.8], ['artillery_rain', 1.4], ['tentacle_sweep', near ? 1.2 : 0.3]);
      if (ph >= 2) p.push(['nova_ring', 2], ['spiral_barrage', 2.5]);
      if (ph >= 3) p.push(['sky_dive', 1.5], ['spiral_barrage', 1]);
      break;
    case 'golem':
      p.push(['seraph_charge', 2.6], ['judgement_slam', near ? 3 : 1], ['rock_wave', 3], ['tentacle_sweep', near ? 2.2 : 0.5], ['meteor_bomb', 1.4]);
      if (ph >= 2) p.push(['nova_ring', 2], ['artillery_rain', 2]);
      if (ph >= 3) p.push(['rock_wave', 2], ['spiral_barrage', 1.5]);
      break;
    case 'titan':
      p.push(['rail_cannon', 3], ['artillery_rain', 3], ['holy_laser_fan', 2.5], ['meteor_bomb', 2], ['seraph_charge', 1.4]);
      if (ph >= 2) p.push(['spiral_barrage', 2], ['judgement_slam', near ? 1.6 : 0.5]);
      if (ph >= 3) p.push(['rail_cannon', 2], ['artillery_rain', 1.5]);
      break;
    case 'kraken':
      p.push(['tentacle_sweep', near ? 3.5 : 1.6], ['rock_wave', 2.5], ['judgement_slam', dist < 16 ? 3 : 1], ['spiral_barrage', 2.5], ['whirlpool', 1.8], ['artillery_rain', 1.2]);
      if (ph >= 2) p.push(['nova_ring', 2], ['holy_laser_fan', 1.5]);
      if (ph >= 3) p.push(['whirlpool', 1.5], ['tentacle_sweep', 1.5]);
      break;
    case 'frost':
      p.push(['rail_cannon', 3], ['artillery_rain', 3], ['tentacle_sweep', near ? 3 : 1.4], ['rock_wave', 2.5], ['holy_laser_fan', 2.2], ['seraph_charge', 1.6], ['nova_ring', 1.5]);
      if (ph >= 2) p.push(['prism_beam', 2], ['sky_dive', 1.8], ['spiral_barrage', 2]);
      if (ph >= 3) p.push(['prism_beam', 2], ['rock_wave', 1.5], ['tentacle_sweep', 1.5], ['judgement_slam', near ? 2 : 0.6]);
      break;
    case 'myco':
      p.push(['spore_brood', 3.2], ['artillery_rain', 2.6], ['rock_wave', 2.4], ['tentacle_sweep', near ? 3 : 1.2], ['holy_laser_fan', 2], ['judgement_slam', near ? 2.4 : 0.6], ['nova_ring', 1.4]);
      if (ph >= 2) p.push(['spore_brood', 2.4], ['spiral_barrage', 2.2], ['meteor_bomb', 1.8], ['seraph_charge', 1.6]);
      if (ph >= 3) p.push(['spore_brood', 2.4], ['nova_ring', 1.6], ['rock_wave', 1.6], ['artillery_rain', 1.6]);
      break;
    case 'magma':
      p.push(['magma_cannon', 3.4], ['artillery_rain', 2.6], ['rock_wave', 2.8], ['tentacle_sweep', near ? 3 : 1.2], ['judgement_slam', near ? 2.6 : 0.7], ['holy_laser_fan', 1.6], ['nova_ring', 1.4]);
      if (ph >= 2) p.push(['magma_cannon', 2.6], ['spiral_barrage', 2], ['meteor_bomb', 1.8], ['seraph_charge', 1.6]);
      if (ph >= 3) p.push(['magma_cannon', 2.6], ['nova_ring', 1.6], ['rock_wave', 1.8], ['artillery_rain', 1.6]);
      break;
    case 'storm':
      p.push(['thunder_strike', 3.4], ['storm_vortex', 2.6], ['rail_cannon', 2.4], ['holy_laser_fan', 2], ['artillery_rain', 2], ['judgement_slam', near ? 2.8 : 0.7], ['nova_ring', near ? 2.4 : 1.2]);
      if (ph >= 2) p.push(['thunder_strike', 2.6], ['storm_vortex', 2.2], ['spiral_barrage', 2], ['meteor_bomb', 1.6], ['tentacle_sweep', near ? 2 : 0.6]);
      if (ph >= 3) p.push(['thunder_strike', 2.6], ['storm_vortex', 2], ['rail_cannon', 2], ['nova_ring', 1.6]);
      break;
    case 'neon':
      p.push(['data_rain', 3.4], ['prism_beam', 2.4], ['holy_laser_fan', 2], ['artillery_rain', 2], ['spiral_barrage', 1.6], ['judgement_slam', near ? 2.6 : 0.7], ['nova_ring', near ? 2.2 : 1.2]);
      if (ph >= 2) p.push(['data_rain', 2.6], ['prism_beam', 2], ['meteor_bomb', 1.6], ['tentacle_sweep', near ? 2.4 : 0.8], ['rail_cannon', 1.8]);
      if (ph >= 3) p.push(['data_rain', 2.6], ['prism_beam', 2.2], ['nova_ring', 1.6], ['spiral_barrage', 1.8]);
      break;
    case 'eden':
      p.push(['thunder_strike', 3.2], ['prism_beam', 2.4], ['holy_laser_fan', 2.4], ['artillery_rain', 2.2], ['storm_vortex', 2], ['judgement_slam', near ? 2.8 : 0.8], ['tentacle_sweep', near ? 2.4 : 0.8], ['nova_ring', near ? 2.2 : 1.2]);
      if (ph >= 2) p.push(['thunder_strike', 2.4], ['spiral_barrage', 2.2], ['rail_cannon', 2], ['meteor_bomb', 1.8], ['seraph_charge', 1.6], ['prism_beam', 1.8]);
      if (ph >= 3) p.push(['thunder_strike', 2.6], ['storm_vortex', 2.2], ['prism_beam', 2.2], ['sky_dive', 1.8], ['nova_ring', 1.8], ['spiral_barrage', 1.8]);
      break;
    case 'warden':
      p.push(['prism_beam', 3], ['holy_laser_fan', 3], ['artillery_rain', 2.5], ['meteor_bomb', 2], ['rail_cannon', 1.5], ['nova_ring', 1.5]);
      if (ph >= 2) p.push(['sky_dive', 2], ['spiral_barrage', 2]);
      if (ph >= 3) p.push(['prism_beam', 2], ['sky_dive', 1]);
      break;
  }
  if (canSummon) p.push(['summon_guard', 2.2]);
  return p;
}

/** Undo everything a pattern may have left behind (cue, airborne state, temp meshes). */
function endPattern(e: CombatEnemy, c: CombatCtx) {
  const ud = e.mesh.userData;
  ud.bossCue = { name: 'idle', k: 0 };
  e.airY = 0;
  e.noContact = false;
  e.ignoreStandoff = false;
  e.faceAngle = undefined;
  const A = e.ai;
  if (A?.temp) {
    for (const o of A.temp as THREE.Object3D[]) {
      c.scene.remove(o);
      o.traverse((ch) => {
        const m = ch as THREE.Mesh;
        m.geometry?.dispose();
        (m.material as THREE.Material | undefined)?.dispose?.();
      });
    }
    A.temp = [];
  }
  if (A) {
    A.orb = undefined;
    A.swirl = undefined;
  }
}

/** Pick the next boss pattern (called when `patternTimer` runs out). */
export function chooseBossPattern(e: CombatEnemy, c: CombatCtx, dist: number): void {
  e.ai ??= {};
  endPattern(e, c);
  const kind = (e.bossKind ?? 'golgotha') as BossKind;
  const ph = e.bossPhase ?? 1;
  const prev = e.aiPattern;
  let pick: string;
  if (e.bossState === -1) {
    pick = 'phase_shift';
  } else if (e.ai.next) {
    pick = e.ai.next;
    e.ai.next = undefined;
  } else {
    const all = pool(kind, ph, dist, e, c);
    const usable = all.filter(([n]) => n !== prev);
    const list = usable.length ? usable : all;
    const total = list.reduce((a, [, w]) => a + w, 0);
    let r = Math.random() * total;
    pick = list[list.length - 1][0];
    for (const [n, w] of list) {
      r -= w;
      if (r <= 0) {
        pick = n;
        break;
      }
    }
  }
  e.aiPattern = pick;
  e.actionSubTimer = 0;
  e.bossState = 0;
  e.bossSpin = Math.random() * Math.PI * 2;
  e.shootCooldown = 6;
  e.ai.dashA = undefined;
  e.ai.waveA = undefined;
  e.ai.cannonA = undefined;
  e.ai.dive = undefined;
  e.patternTimer = durationOf(pick, ph);
}

const _v = new THREE.Vector3();

/** Runs the current boss pattern for one frame. */
export function runBossPattern(e: CombatEnemy, c: CombatCtx, dist: number): void {
  const A = (e.ai ??= {});
  A.temp ??= [];
  const kind = (e.bossKind ?? 'golgotha') as BossKind;
  const fx = BOSS_FX[kind];
  const ph = e.bossPhase ?? 1;
  const f = phaseWind(ph);
  const t = e.actionSubTimer;
  const pos = e.mesh.position;
  const ud = e.mesh.userData;
  const p = e.aiPattern;

  const cue = (name: string, k: number, side?: number) => {
    ud.bossCue = { name, k: Math.max(0, Math.min(1, k)), side };
  };
  const impact = (s = 1) => {
    ud.bossHit = s;
    ud.bossHitPart = s;
  };
  /** true exactly once per pattern for each flag bit */
  const once = (bit: number) => {
    const m = 1 << bit;
    if (((e.bossState ?? 0) & m) !== 0) return false;
    e.bossState = (e.bossState ?? 0) | m;
    return true;
  };
  const aimYaw = () => yawTo(pos.x, pos.z, c.player.x, c.player.z);
  const dirFromYaw = (a: number, y: number, out = new THREE.Vector3()) => {
    // aim down from the firing height toward the player's chest
    const d = Math.max(4, dist);
    const dy = (c.player.y - 0.5 - (pos.y + y)) / d;
    return out.set(Math.sin(a), dy, Math.cos(a)).normalize();
  };
  const fire = (dir: THREE.Vector3, speed: number, dmgMul: number, color: number, size: number, radius: number, y: number, life = 4.0) => {
    c.fireBullet({ from: new THREE.Vector3(pos.x, pos.y + y, pos.z), dir: dir.clone().normalize(), speed, damage: Math.round(e.damage * dmgMul), color, size, radius, life });
  };
  const novaRing = (offset: number, n = 20 + ph * 6, speed = 13) => {
    const gapEvery = Math.floor(n / 4);
    for (let i = 0; i < n; i++) {
      if (i % gapEvery < 2) continue; // four gaps to slip through
      const a = offset + (i / n) * Math.PI * 2;
      fire(new THREE.Vector3(Math.cos(a), 0, Math.sin(a)), speed, 0.8, fx.b, 0.3, 0.42, 1.5, 4.6);
    }
  };
  const approach = (minDist: number, accel = 2.0) => {
    if (dist > minDist) {
      _v.set(c.player.x - pos.x, 0, c.player.z - pos.z).normalize();
      e.velocity.addScaledVector(_v, e.speed * c.delta * accel);
    }
  };
  const announceOnce = (bit: number, text: string) => {
    if (once(bit)) c.announce(text);
  };

  switch (p) {
    // ───────────── 突進: crouch + lane marker → dash along the locked lane ─────────────
    case 'seraph_charge': {
      const dashes = ph >= 3 ? 2 : 1;
      let start = 0;
      let done = true;
      for (let i = 0; i < dashes; i++) {
        const wind = (i === 0 ? 0.8 : 0.5) * f;
        const dash = 0.7;
        const u = t - start;
        if (u < wind) {
          done = false;
          cue('crouch', u / wind);
          e.velocity.multiplyScalar(0.5);
          e.faceAngle = undefined;
          if (once(i)) {
            c.hazards.add({
              shape: 'line', x: pos.x, z: pos.z, radius: 3.0, length: 30, angle: aimYaw(), delay: wind, lockAt: 0.25,
              track: () => ({ x: pos.x, z: pos.z, angle: aimYaw() }),
              damage: 0, label: '', color: fx.a, fx: 'none', owner: e,
              onBurst: (_hit, h) => { A.dashA = h.angle; },
            });
            if (i === 0) c.sfx.scan();
          }
          break;
        }
        if (u < wind + dash) {
          done = false;
          const a = A.dashA ?? aimYaw();
          cue('charge', 1);
          e.faceAngle = a;
          e.velocity.set(Math.sin(a), 0, Math.cos(a)).multiplyScalar(e.speed * 6.8);
          if (once(4 + i)) {
            c.sfx.dash();
            impact(0.6);
            c.hazards.ringFx(pos.x, pos.z, 6, fx.a, 0.4);
          }
          if (dist < 8.6 && once(8 + i)) {
            c.hurt(Math.round(e.damage * 1.4), labelOf(p, kind), '#' + new THREE.Color(fx.a).getHexString(), { knockBack: 16, knockUp: 6, from: { x: pos.x, z: pos.z }, guard: 'melee' });
            c.shake(0.4, 0.4);
          }
          break;
        }
        start += wind + dash;
      }
      if (done) {
        cue('recover', 1);
        e.faceAngle = undefined;
        e.velocity.multiplyScalar(0.8);
        if (ph >= 2 && once(12) && Math.random() < 0.4) A.next = 'judgement_slam';
      }
      break;
    }

    // ───────────── 扇状弾幕: fan-shaped floor marker shows the spread before each volley ─────────────
    case 'holy_laser_fan': {
      approach(9, 2.2);
      const volleys = ph >= 2 ? 3 : 2;
      const spacing = 1.15 * f;
      const wind = 0.6 * f;
      const count = 5 + (ph - 1) * 2;
      const spread = 0.2;
      let k = 0;
      for (let i = 0; i < volleys; i++) {
        const s0 = 0.2 + i * spacing;
        const u = t - s0;
        if (u >= 0 && u < wind) k = u / wind;
        if (u >= 0 && once(i)) {
          c.hazards.add({
            shape: 'sector', x: pos.x, z: pos.z, radius: 24, arc: (count - 1) * spread + 0.12, angle: aimYaw(), delay: wind, lockAt: 0.12,
            track: () => ({ x: pos.x, z: pos.z, angle: aimYaw() }),
            damage: 0, label: '', color: fx.a, fx: 'none', owner: e,
            onBurst: (_h, h) => {
              if (e.isDead) return;
              const a0 = h.angle ?? aimYaw();
              const half = ((count - 1) / 2) * spread;
              for (let j = 0; j < count; j++) fire(dirFromYaw(a0 - half + j * spread, 4.5), 28, 0.7, fx.a, 0.18, 0.3, 4.5, 3.5);
              A.fanA = a0;
              impact(0.5);
              c.sfx.heavy();
            },
          });
        }
        // phase 2+: an interleaved follow-up fan
        if (ph >= 2 && u >= wind + 0.32 && once(4 + i)) {
          const a0 = A.fanA ?? aimYaw();
          const n2 = count - 1;
          const half = ((n2 - 1) / 2) * spread;
          for (let j = 0; j < n2; j++) fire(dirFromYaw(a0 - half + j * spread, 4.5), 30, 0.65, fx.b, 0.18, 0.3, 4.5, 3.5);
        }
      }
      cue('cast', k > 0 ? k : 0.35);
      break;
    }

    // ───────────── 重プラズマ弾: an orb swells in front of the boss, then fires ─────────────
    case 'meteor_bomb': {
      approach(8, 2.0);
      const wind = 0.75 * f;
      const spacing = 1.5 * f;
      let k = 0;
      for (let i = 0; i < 2; i++) {
        const s0 = 0.15 + i * spacing;
        const u = t - s0;
        if (u < 0) continue;
        if (u < wind) {
          k = u / wind;
          if (!A.orb) {
            const g = new THREE.Group();
            g.add(new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffffff })));
            g.add(new THREE.Mesh(new THREE.SphereGeometry(1.0, 16, 12), new THREE.MeshBasicMaterial({ color: fx.b, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false })));
            c.scene.add(g);
            A.orb = g;
            A.temp.push(g);
          }
          const a = aimYaw();
          A.orb.position.set(pos.x + Math.sin(a) * 4.5, pos.y + 7.5 + k * 1.5, pos.z + Math.cos(a) * 4.5);
          A.orb.scale.setScalar(0.3 + k * 0.85 + Math.sin(c.time * 40) * 0.05 * k);
        } else if (once(i)) {
          if (A.orb) {
            c.scene.remove(A.orb);
            A.temp = A.temp.filter((o: THREE.Object3D) => o !== A.orb);
            A.orb.traverse((ch: THREE.Object3D) => {
              const m = ch as THREE.Mesh;
              m.geometry?.dispose();
              (m.material as THREE.Material | undefined)?.dispose?.();
            });
            A.orb = undefined;
          }
          for (let j = 0; j < ph; j++) {
            const d = dirFromYaw(aimYaw() + (j - (ph - 1) / 2) * 0.16, 8.5);
            fire(d, 18, 1.5, fx.b, 0.45, 0.6, 8.5, 4.5);
          }
          impact(0.7);
          c.sfx.heavy();
        }
      }
      cue('cast', k);
      break;
    }

    // ───────────── 衝撃弾環: rear up, ring marker expands, slam releases gapped rings ─────────────
    case 'nova_ring': {
      e.velocity.multiplyScalar(0.85);
      const wind = 0.9 * f;
      if (once(0)) {
        c.hazards.add({ shape: 'ring', x: pos.x, z: pos.z, radius: 9, inner: 6.5, delay: wind, damage: 0, label: '', color: fx.b, fx: 'none', owner: e, track: () => ({ x: pos.x, z: pos.z }), lockAt: 0 });
      }
      if (t < wind) cue('raise', t / wind);
      else {
        cue('raise', Math.max(0, 1 - (t - wind) * 2));
        if (once(1)) {
          const off = Math.random() * Math.PI * 2;
          A.novaOff = off;
          novaRing(off);
          c.hazards.ringFx(pos.x, pos.z, 8, fx.b, 0.45);
          impact(1);
          c.sfx.boom();
          c.shake(0.25, 0.3);
        }
        if (ph >= 2 && t >= wind + 0.65 && once(2)) {
          novaRing(A.novaOff + Math.PI / (10 + ph * 3));
          impact(0.6);
        }
        if (ph >= 3 && t >= wind + 1.3 && once(3)) {
          novaRing(A.novaOff);
          impact(0.6);
        }
      }
      break;
    }

    // ───────────── 回転弾幕: spin up (no fire) → spiral arms → wind down ─────────────
    case 'spiral_barrage': {
      e.velocity.multiplyScalar(0.9);
      approach(14, 1.2);
      const side = e.strafeSign || 1;
      const spinUp = 0.7 * f;
      const end = durationOf(p, ph) - 0.5;
      if (t < spinUp) {
        cue('spin', t / spinUp, side);
        if (once(0)) c.sfx.scan();
      } else if (t < end) {
        cue('spin', 1, side);
        e.bossSpin = (e.bossSpin ?? 0) + c.delta * (2.0 + ph * 0.5) * side;
        e.shootCooldown = (e.shootCooldown ?? 0.2) > 1 ? 0.05 : (e.shootCooldown ?? 0.2) - c.delta;
        if (e.shootCooldown <= 0) {
          e.shootCooldown = 0.13 - ph * 0.014;
          const arms = ph >= 3 ? 3 : 2;
          for (let k = 0; k < arms; k++) {
            const a = (e.bossSpin ?? 0) + (k / arms) * Math.PI * 2;
            fire(new THREE.Vector3(Math.cos(a), 0, Math.sin(a)), 14, 0.55, fx.a, 0.22, 0.32, 1.4, 4.0);
          }
          A.spiralN = (A.spiralN ?? 0) + 1;
          if (A.spiralN % 8 === 0) fire(dirFromYaw(aimYaw(), 1.4), 20, 0.7, fx.b, 0.28, 0.4, 1.4, 4.0);
        }
      } else {
        cue('spin', Math.max(0, (durationOf(p, ph) - t) / 0.5), side);
        e.shootCooldown = 6;
      }
      break;
    }

    // ───────────── 裁きの叩きつけ: rear up over a growing circle; phase 2+ adds jumpable aftershock rings ─────────────
    case 'judgement_slam': {
      e.velocity.multiplyScalar(0.3);
      const slamR = fx.radius + (ph - 1) * 1.0;
      const wind = 1.25 - ph * 0.1;
      if (once(0)) {
        c.hazards.add({
          shape: 'circle', x: pos.x, z: pos.z, radius: slamR, delay: wind, lockAt: 0.25,
          track: () => ({ x: pos.x, z: pos.z }),
          damage: Math.round(e.damage * 1.5), knockUp: 9, knockBack: 12,
          label: 'JUDGEMENT', color: fx.slam, fx: 'blast', shake: 0.6, owner: e,
          onBurst: () => {
            if (e.isDead) return;
            impact(1);
            c.sfx.boom();
            c.sfx.heavy();
            if (ph >= 3) novaRing(Math.random() * Math.PI * 2);
          },
        });
      }
      if (t < wind) cue('raise', t / wind);
      else {
        cue(t < wind + 0.25 ? 'raise' : 'recover', t < wind + 0.25 ? 1 : Math.min(1, (t - wind) * 2));
        if (ph >= 2 && once(1)) {
          announceOnce(5, '⚠ AFTERSHOCK // 衝撃波の輪をジャンプで越えろ');
          const rings = ph >= 3 ? 3 : 2;
          for (let i = 0; i < rings; i++) {
            c.hazards.add({
              shape: 'ring', x: pos.x, z: pos.z, inner: slamR + i * 4, radius: slamR + i * 4 + 3.6, delay: 0.55 + i * 0.4,
              damage: Math.round(e.damage * 0.9), knockUp: 5, jumpable: true,
              label: 'AFTERSHOCK', color: fx.b, fx: 'blast', owner: e,
            });
          }
        }
      }
      break;
    }

    // ───────────── 曲射弾雨: lob shells / pillars / swords onto marked circles around the player ─────────────
    case 'artillery_rain': {
      e.velocity.multiplyScalar(0.6);
      const wind = 0.8 * f;
      if (t < wind) {
        cue('lob', t / wind);
        if (once(0)) {
          c.announce(`⚠ ${labelOf(p, kind)} // 着弾地点から離れろ`);
          c.sfx.scan();
        }
      } else {
        cue('lob', Math.max(0, 1 - (t - wind - 0.4) * 2));
        if (once(1)) {
          impact(0.7);
          c.sfx.heavy();
          const n = 4 + ph * 2;
          const vx = c.player.x;
          const vz = c.player.z;
          for (let i = 0; i < n; i++) {
            let x = vx;
            let z = vz;
            if (i > 0) {
              const a = Math.random() * Math.PI * 2;
              const r = 3 + Math.random() * 8;
              x += Math.cos(a) * r;
              z += Math.sin(a) * r;
            }
            x = THREE.MathUtils.clamp(x, -37, 37);
            z = THREE.MathUtils.clamp(z, -37, 37);
            const fromSky = kind === 'golgotha' || kind === 'warden' || kind === 'frost' || kind === 'eden';
            const from = fromSky ? new THREE.Vector3(x, 34, z) : new THREE.Vector3(pos.x, pos.y + 9, pos.z);
            let mesh: THREE.Object3D | undefined;
            let fxKind: HazardFx = 'blast';
            if (kind === 'warden') {
              mesh = new THREE.Group();
              const bl = new THREE.Mesh(new THREE.ConeGeometry(0.35, 3.2, 4), new THREE.MeshBasicMaterial({ color: 0xede9fe }));
              bl.position.y = -1.2;
              bl.rotation.x = Math.PI;
              const guard = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.15, 0.25), new THREE.MeshBasicMaterial({ color: 0xfde68a }));
              guard.position.y = 0.4;
              const glowS = new THREE.Mesh(new THREE.ConeGeometry(0.7, 3.6, 4), new THREE.MeshBasicMaterial({ color: fx.a, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
              glowS.position.y = -1.2;
              glowS.rotation.x = Math.PI;
              mesh.add(bl, guard, glowS);
              fxKind = 'spikes';
            } else if (kind === 'frost') {
              mesh = new THREE.Group();
              const lance = new THREE.Mesh(new THREE.ConeGeometry(0.4, 3.6, 6), new THREE.MeshBasicMaterial({ color: 0xe0f7ff }));
              lance.position.y = -1.3;
              lance.rotation.x = Math.PI;
              const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.38, 1.4, 6), new THREE.MeshBasicMaterial({ color: 0x9fe0ff }));
              shaft.position.y = 0.9;
              const glowS = new THREE.Mesh(new THREE.ConeGeometry(0.8, 4.0, 6), new THREE.MeshBasicMaterial({ color: fx.a, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
              glowS.position.y = -1.3;
              glowS.rotation.x = Math.PI;
              mesh.add(lance, shaft, glowS);
              fxKind = 'spikes';
            } else if (kind === 'myco') {
              mesh = new THREE.Group();
              const pod = new THREE.Mesh(new THREE.SphereGeometry(0.75, 12, 10), new THREE.MeshBasicMaterial({ color: 0xbef264 }));
              const podCap = new THREE.Mesh(new THREE.SphereGeometry(0.85, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xea580c }));
              podCap.position.y = 0.2;
              podCap.scale.y = 0.7;
              const glowS = new THREE.Mesh(new THREE.SphereGeometry(1.3, 12, 10), new THREE.MeshBasicMaterial({ color: fx.a, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false }));
              mesh.add(pod, podCap, glowS);
              fxKind = 'geyser';
            } else if (kind === 'magma') {
              mesh = new THREE.Group();
              const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.85, 0), new THREE.MeshStandardMaterial({ color: 0x3a2a26, roughness: 0.85, emissive: 0xff5a1a, emissiveIntensity: 0.8 }));
              const hot = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffb347 }));
              const glowS = new THREE.Mesh(new THREE.SphereGeometry(1.35, 12, 10), new THREE.MeshBasicMaterial({ color: fx.a, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false }));
              mesh.add(rock, hot, glowS);
              fxKind = 'pillar';
            } else if (kind === 'storm') {
              mesh = new THREE.Group();
              const orb = new THREE.Mesh(new THREE.SphereGeometry(0.6, 12, 10), new THREE.MeshBasicMaterial({ color: 0xf0f9ff }));
              const shell = new THREE.Mesh(new THREE.SphereGeometry(0.95, 12, 10), new THREE.MeshBasicMaterial({ color: fx.a, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
              const ring = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.05, 6, 24), new THREE.MeshBasicMaterial({ color: fx.b }));
              mesh.add(orb, shell, ring);
              fxKind = 'pillar';
            } else if (kind === 'neon') {
              mesh = new THREE.Group();
              const cube = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.9), new THREE.MeshBasicMaterial({ color: 0x4ade80 }));
              const wire = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.3, 1.3), new THREE.MeshBasicMaterial({ color: fx.a, wireframe: true }));
              const glowS = new THREE.Mesh(new THREE.SphereGeometry(1.3, 12, 10), new THREE.MeshBasicMaterial({ color: 0x4ade80, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false }));
              mesh.add(cube, wire, glowS);
              fxKind = 'pillar';
            } else if (kind === 'eden') {
              mesh = new THREE.Group();
              const fe = new THREE.Mesh(new THREE.ConeGeometry(0.28, 3.0, 4), new THREE.MeshBasicMaterial({ color: 0xffffff }));
              fe.position.y = -1.0;
              fe.rotation.x = Math.PI;
              const glowS = new THREE.Mesh(new THREE.SphereGeometry(1.1, 12, 10), new THREE.MeshBasicMaterial({ color: fx.a, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
              const ring = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.05, 6, 24), new THREE.MeshBasicMaterial({ color: fx.slam }));
              ring.rotation.x = Math.PI / 2;
              mesh.add(fe, glowS, ring);
              fxKind = 'pillar';
            } else if (kind === 'golem') {
              mesh = new THREE.Mesh(new THREE.DodecahedronGeometry(0.9, 0), new THREE.MeshStandardMaterial({ color: 0x5b5148, roughness: 0.9, emissive: 0xff5a1a, emissiveIntensity: 0.25 }));
              fxKind = 'spikes';
            } else if (kind === 'golgotha') fxKind = 'pillar';
            else if (kind === 'kraken') fxKind = 'geyser';
            c.hazards.add({
              shape: 'circle', x, z, radius: 3.0, delay: 1.0 + i * 0.14,
              damage: Math.round(e.damage * 1.1), knockUp: 4,
              label: labelOf(p, kind), color: kind === 'warden' || kind === 'frost' ? fx.a : fx.b, fx: fxKind, shake: 0.25,
              drop: { from, color: fx.b, size: 0.5, arc: fromSky ? 0 : 12, fall: fromSky, mesh, orient: kind === 'warden' || kind === 'frost' ? 'point' : 'tumble' },
            });
          }
        }
      }
      break;
    }

    // ───────────── レールキャノン: tracking laser line locks on, then a piercing beam ─────────────
    case 'rail_cannon': {
      e.velocity.multiplyScalar(0.3);
      const shots = ph >= 3 ? 2 : 1;
      let s0 = 0;
      let active = false;
      for (let i = 0; i < shots; i++) {
        const wind = (i === 0 ? 1.7 : 1.0) * f;
        const u = t - s0;
        if (u >= 0 && u < wind + 0.3) {
          active = true;
          cue('aim', Math.min(1, u / wind));
          if (once(i)) {
            if (i === 0) c.announce(`⚠ ${labelOf(p, kind)} // 射線から外れろ`);
            c.sfx.scan();
            c.hazards.add({
              shape: 'line', x: pos.x, z: pos.z, radius: 1.15, length: 64, angle: aimYaw(), delay: wind, lockAt: 0.42,
              track: () => ({ x: pos.x, z: pos.z, angle: aimYaw() }),
              damage: Math.round(e.damage * 2.0), knockBack: 14, knockUp: 3,
              label: labelOf(p, kind), color: fx.a, fx: 'beam', shake: 0.7, owner: e,
              onBurst: (_hit, h) => {
                if (e.isDead) return;
                e.faceAngle = h.angle;
                impact(1);
                c.sfx.heavy();
                c.sfx.boom();
              },
            });
          }
        }
        s0 += wind + 0.35;
      }
      if (!active) {
        cue('recover', 1);
        e.faceAngle = undefined;
      }
      break;
    }

    // ───────────── 岩盤波: slam sends a travelling line of eruptions toward the player ─────────────
    case 'rock_wave': {
      e.velocity.multiplyScalar(0.4);
      const wind = 0.75 * f;
      const lines = ph >= 2 ? 3 : 1;
      if (once(0)) {
        c.hazards.add({
          shape: 'line', x: pos.x, z: pos.z, radius: 1.9, length: 28, angle: aimYaw(), delay: wind, lockAt: 0.2,
          track: () => ({ x: pos.x, z: pos.z, angle: aimYaw() }),
          damage: 0, label: '', color: fx.slam, fx: 'none', owner: e,
          onBurst: (_h, h) => { A.waveA = h.angle; },
        });
      }
      if (t < wind) cue('raise', t / wind);
      else {
        cue(t < wind + 0.3 ? 'raise' : 'recover', 1);
        if (once(1)) {
          impact(1);
          c.sfx.boom();
          c.hazards.ringFx(pos.x, pos.z, 7, fx.slam, 0.4);
          c.shake(0.3, 0.3);
          const a0 = A.waveA ?? aimYaw();
          const offs = lines === 3 ? [-0.38, 0, 0.38] : [0];
          for (const off of offs) {
            const a = a0 + off;
            for (let j = 0; j < 9; j++) {
              const d = 4.2 + j * 2.6;
              const x = pos.x + Math.sin(a) * d;
              const z = pos.z + Math.cos(a) * d;
              if (Math.abs(x) > 38 || Math.abs(z) > 38) break;
              c.hazards.add({
                shape: 'circle', x, z, radius: 1.95, delay: 0.3 + j * 0.11,
                damage: Math.round(e.damage * 1.1), knockUp: 8,
                label: labelOf(p, kind), color: fx.slam, fx: kind === 'kraken' ? 'geyser' : kind === 'golem' || kind === 'frost' || kind === 'myco' || kind === 'magma' ? 'spikes' : 'pillar',
                shake: j % 3 === 0 ? 0.15 : 0,
              });
            }
          }
        }
      }
      break;
    }

    // ───────────── 天墜: leap out of sight, a shadow hunts the player, then crash down ─────────────
    case 'sky_dive': {
      const crouch = 0.6 * f;
      const DIVE = 2.1;
      const PEAK = 30;
      if (t < crouch) {
        cue('crouch', t / crouch);
        e.velocity.multiplyScalar(0.4);
      } else {
        const u = t - crouch;
        if (once(0)) {
          c.announce('⚠ SKY DIVE // 影から逃げろ');
          c.sfx.dash();
          impact(0.5);
          c.hazards.ringFx(pos.x, pos.z, 8, fx.a, 0.5);
          c.hazards.columnFx(pos.x, pos.z, 3, 18, fx.a, 0.5);
          A.dive = c.hazards.add({
            shape: 'circle', x: c.player.x, z: c.player.z, radius: ph >= 3 ? 8.5 : 7.5, delay: DIVE, lockAt: 0.6,
            track: () => ({ x: c.player.x, z: c.player.z }),
            damage: Math.round(e.damage * 1.8), knockUp: 10, knockBack: 15,
            label: 'SKY DIVE', color: fx.slam, fx: 'blast', shake: 0.9, owner: e,
            onBurst: () => {
              if (e.isDead) return;
              impact(1);
              c.sfx.boom();
              c.sfx.heavy();
              if (ph >= 2) novaRing(Math.random() * Math.PI * 2);
            },
          });
        }
        if (u < DIVE) {
          e.noContact = true;
          e.ignoreStandoff = true;
          e.velocity.set(0, 0, 0);
          const rise = Math.min(1, u / 0.45);
          const fall = u > DIVE - 0.3 ? (DIVE - u) / 0.3 : 1;
          e.airY = PEAK * (1 - (1 - rise) * (1 - rise)) * fall * fall;
          const h = A.dive;
          if (h && u > 0.4) pos.set(h.x, pos.y, h.z);
          cue(u > DIVE - 0.35 ? 'raise' : 'charge', 1);
        } else {
          e.airY = 0;
          e.noContact = false;
          e.ignoreStandoff = u < DIVE + 0.15;
          cue('recover', 1);
          if (ph >= 3 && once(3) && Math.random() < 0.5) A.next = 'spiral_barrage';
        }
      }
      break;
    }

    // ───────────── 薙ぎ払い: wide arc in front — jump over it ─────────────
    case 'tentacle_sweep': {
      e.velocity.multiplyScalar(0.5);
      const sweeps = ph >= 2 ? 2 : 1;
      A.sweepSide ??= Math.random() < 0.5 ? 1 : -1;
      let s0 = 0.1;
      let active = false;
      for (let i = 0; i < sweeps; i++) {
        const wind = (i === 0 ? 1.1 : 0.75) * f;
        const side = i % 2 ? -A.sweepSide : A.sweepSide;
        const u = t - s0;
        if (u >= 0 && u < wind + 0.45) {
          active = true;
          cue('sweep', u < wind ? u / wind : 1, side);
          if (once(i)) {
            if (i === 0) c.announce(`⚠ ${labelOf(p, kind)} // ジャンプで回避`);
            c.hazards.add({
              shape: 'sector', x: pos.x, z: pos.z, radius: 16, arc: 3.6, angle: aimYaw(), delay: wind, lockAt: 0.3,
              track: () => ({ x: pos.x, z: pos.z, angle: aimYaw() }),
              damage: Math.round(e.damage * 1.35), jumpable: true, knockBack: 12, knockUp: 4,
              label: labelOf(p, kind), color: fx.a, fx: 'slash', shake: 0.4, owner: e,
              onBurst: () => {
                if (e.isDead) return;
                impact(1);
                c.sfx.sweep();
                c.sfx.heavy();
              },
            });
          }
        }
        s0 += wind + 0.55;
      }
      if (!active) cue('recover', 1);
      break;
    }

    // ───────────── 大渦: pulls the player in, slow rings, then a tidal crash at the centre ─────────────
    case 'whirlpool': {
      e.velocity.multiplyScalar(0.3);
      cue('channel', Math.min(1, t / 0.6));
      if (once(0)) {
        c.announce('⚠ MAELSTROM // 引き込みに抗え');
        const g = new THREE.Group();
        for (let i = 0; i < 3; i++) {
          const m = new THREE.Mesh(
            new THREE.TorusGeometry(5 + i * 4, 0.18, 6, 48, Math.PI * 1.4),
            new THREE.MeshBasicMaterial({ color: i % 2 ? fx.a : fx.b, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }),
          );
          m.rotation.x = Math.PI / 2;
          m.rotation.z = i * 2;
          m.userData.speed = 1.6 - i * 0.35;
          g.add(m);
        }
        g.position.set(pos.x, 0.15, pos.z);
        c.scene.add(g);
        A.temp.push(g);
        A.swirl = g;
        c.sfx.scan();
      }
      if (A.swirl) {
        A.swirl.position.set(pos.x, 0.15, pos.z);
        A.swirl.children.forEach((m: THREE.Object3D) => {
          m.rotation.z += c.delta * m.userData.speed * 2;
          m.scale.setScalar(1 - ((t * 0.25 + m.userData.speed) % 1) * 0.3);
        });
      }
      if (t > 0.6 && t < 3.2 && dist > 3) {
        const pull = (ph >= 3 ? 10 : 8) * c.delta;
        _v.set(pos.x - c.player.x, 0, pos.z - c.player.z).normalize();
        // swirl: mostly inward with a tangential drift
        c.pushPlayer(_v.x * pull - _v.z * pull * 0.45, _v.z * pull + _v.x * pull * 0.45);
      }
      const ringAt = [1.0, 1.9, 2.8];
      ringAt.forEach((at, i) => {
        if (t >= at && once(1 + i)) novaRing(Math.random() * Math.PI * 2, 14 + ph * 2, 9);
      });
      if (t >= 2.4 && once(6)) {
        c.hazards.add({
          shape: 'circle', x: pos.x, z: pos.z, radius: 11, delay: 0.85,
          damage: Math.round(e.damage * 1.3), knockUp: 8, knockBack: 10,
          label: 'TIDAL CRASH', color: fx.b, fx: 'geyser', shake: 0.6, owner: e,
          onBurst: () => {
            if (e.isDead) return;
            impact(1);
            c.sfx.boom();
          },
        });
      }
      break;
    }

    // ───────────── プリズムビーム: rotating floor-level beams around the boss — hop over them ─────────────
    case 'prism_beam': {
      e.velocity.multiplyScalar(0.2);
      const wind = 1.0 * f;
      const life = 4.2;
      if (once(0)) {
        c.announce('⚠ PRISM BEAM // 光線を跳び越えろ');
        const n = 1 + ph;
        const dir = Math.random() < 0.5 ? 1 : -1;
        const w = 0.85 + ph * 0.15;
        const a0 = aimYaw() - dir * 0.75;
        c.hazards.addBeam({
          origin: () => (e.isDead ? null : new THREE.Vector3(pos.x, 0, pos.z)),
          angleAt: (tt, i) => a0 + (i * Math.PI * 2) / n + (tt < wind ? 0 : dir * w * (tt - wind)),
          spokes: n,
          length: 36,
          width: 0.62,
          height: 0.8,
          warn: wind,
          life,
          damage: Math.round(e.damage * 0.75),
          tick: 0.4,
          color: fx.b,
          jumpable: true,
          label: 'PRISM BEAM',
          owner: e,
        });
        c.sfx.scan();
      }
      if (t < wind) cue('cast', t / wind);
      else {
        cue('channel', 1);
        if (once(1)) {
          impact(0.6);
          c.sfx.heavy();
        }
      }
      break;
    }

    // ───────────── マグマ砲: the chest core charges, then spits a stream of molten bolts along the locked line ─────────────
    case 'magma_cannon': {
      e.velocity.multiplyScalar(0.25);
      const wind = 1.4 * f;
      const n = 8 + ph * 3;
      const gap = 0.1;
      const fireStart = wind + 0.2;
      if (t < wind) {
        cue('aim', t / wind);
        if (once(0)) {
          c.announce(`⚠ ${labelOf(p, kind)} // 炉心の射線から外れろ`);
          c.sfx.scan();
          c.hazards.add({
            shape: 'line', x: pos.x, z: pos.z, radius: 1.5, length: 44, angle: aimYaw(), delay: wind, lockAt: 0.35,
            track: () => ({ x: pos.x, z: pos.z, angle: aimYaw() }),
            damage: 0, label: '', color: fx.a, fx: 'none', owner: e,
            onBurst: (_h, h) => { A.cannonA = h.angle; },
          });
        }
      } else if (t < fireStart + n * gap) {
        cue('aim', 1);
        const a0 = A.cannonA ?? aimYaw();
        e.faceAngle = a0;
        const idx = Math.floor((t - fireStart) / gap);
        if (idx >= 0 && idx < n && once(4 + idx)) {
          // the stream sweeps across the lane, so stepping sideways is not enough on its own
          const side = e.strafeSign || 1;
          const yaw = a0 + (idx / Math.max(1, n - 1) - 0.5) * (ph >= 2 ? 0.95 : 0.55) * side + (Math.random() - 0.5) * 0.04;
          const big = ph >= 2 && idx % 4 === 3;
          const muzzle = new THREE.Vector3(pos.x + Math.sin(yaw) * 6.2, pos.y + 6.7, pos.z + Math.cos(yaw) * 6.2);
          const d = dirFromYaw(yaw, 6.7);
          c.fireBullet({ from: muzzle, dir: d, speed: big ? 17 : 24, damage: Math.round(e.damage * (big ? 1.1 : 0.62)), color: big ? fx.b : fx.a, size: big ? 0.75 : 0.45, radius: big ? 0.9 : 0.6, life: 3.4 });
          c.sparks(muzzle, fx.b, big ? 10 : 5);
          impact(big ? 0.7 : 0.3);
          if (idx % 3 === 0) c.sfx.heavy(); else c.sfx.shot();
        }
      } else {
        cue('recover', 1);
        e.faceAngle = undefined;
      }
      break;
    }

    // ───────────── 天罰の雷: waves of marked circles; lightning strikes the player's position and the ground around it ─────────────
    case 'thunder_strike': {
      e.velocity.multiplyScalar(0.4);
      const wind = 1.0 * f;
      const waves = ph >= 3 ? 4 : 3;
      const spacing = 0.85;
      const n = 4 + ph * 2;
      if (t < wind) {
        cue('raise', t / wind);
        if (once(0)) {
          c.announce(`⚠ ${labelOf(p, kind)} // 落雷の予兆から離れろ`);
          c.sfx.scan();
        }
      } else {
        cue('raise', Math.max(0.4, 1 - (t - wind) * 0.3));
        for (let w = 0; w < waves; w++) {
          if (t >= wind + w * spacing && once(4 + w)) {
            for (let i = 0; i < n; i++) {
              let x = c.player.x;
              let z = c.player.z;
              if (i > 0) {
                const a = Math.random() * Math.PI * 2;
                const r = 2.5 + Math.random() * 11;
                x += Math.cos(a) * r;
                z += Math.sin(a) * r;
              }
              x = THREE.MathUtils.clamp(x, -37, 37);
              z = THREE.MathUtils.clamp(z, -37, 37);
              c.hazards.add({
                shape: 'circle', x, z, radius: 2.6, delay: 0.95 + i * 0.03,
                damage: Math.round(e.damage * 1.15), knockUp: 7,
                label: labelOf(p, kind), color: fx.b, fx: 'pillar', shake: i === 0 ? 0.3 : 0.1, owner: e,
                onBurst: i === 0 ? () => { if (!e.isDead) { impact(0.5); c.sfx.boom(); } } : undefined,
              });
            }
          }
        }
      }
      break;
    }

    // ───────────── 嵐の渦: a tornado spawns ahead, drifts toward the player and drags them in while chewing through anything close ─────────────
    case 'storm_vortex': {
      e.velocity.multiplyScalar(0.3);
      const wind = 1.2 * f;
      const life = 4.2;
      if (once(0)) {
        c.announce(`⚠ ${labelOf(p, kind)} // 渦から距離を取れ`);
        c.sfx.scan();
        const g = new THREE.Group();
        const ringMat = new THREE.MeshBasicMaterial({ color: fx.a, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false });
        const rings: THREE.Mesh[] = [];
        for (let i = 0; i < 9; i++) {
          const rr = 0.9 + i * 0.5;
          const ring = new THREE.Mesh(new THREE.TorusGeometry(rr, 0.12, 6, 28), ringMat);
          ring.rotation.x = Math.PI / 2;
          ring.position.y = 0.4 + i * 1.3;
          g.add(ring);
          rings.push(ring);
        }
        const body = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 0.7, 12, 20, 1, true), new THREE.MeshBasicMaterial({ color: fx.b, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
        body.position.y = 6;
        g.add(body);
        const a = aimYaw();
        const sx = THREE.MathUtils.clamp(pos.x + Math.sin(a) * 10, -34, 34);
        const sz = THREE.MathUtils.clamp(pos.z + Math.cos(a) * 10, -34, 34);
        g.position.set(sx, 0, sz);
        g.scale.setScalar(0.1);
        c.scene.add(g);
        A.temp.push(g);
        A.vortex = { g, rings, x: sx, z: sz, tick: 0 };
      }
      const V = A.vortex as { g: THREE.Group; rings: THREE.Mesh[]; x: number; z: number; tick: number } | undefined;
      if (t < wind) {
        cue('channel', t / wind);
        if (V) V.g.scale.setScalar(0.1 + 0.9 * (t / wind));
      } else if (t < wind + life) {
        cue('channel', 1);
        if (V) {
          const u = t - wind;
          const grow = Math.min(1, (life - u) / 0.6);
          V.g.scale.setScalar(Math.max(0.05, grow));
          // drift toward the player
          const dx = c.player.x - V.x;
          const dz = c.player.z - V.z;
          const d = Math.hypot(dx, dz) || 1;
          const sp = (3.0 + ph * 0.6) * c.delta;
          V.x = THREE.MathUtils.clamp(V.x + (dx / d) * sp, -36, 36);
          V.z = THREE.MathUtils.clamp(V.z + (dz / d) * sp, -36, 36);
          V.g.position.set(V.x, 0, V.z);
          V.rings.forEach((r, i) => { r.rotation.z += c.delta * (3 + i * 0.5) * (i % 2 ? -1 : 1); });
          // suction: pulls the player toward the eye, strongest near the centre
          const R = 12;
          if (d < R) {
            const pull = (1 - d / R) * (9 + ph * 2);
            c.pushPlayer((-dx / d) * pull * c.delta * 2.2, (-dz / d) * pull * c.delta * 2.2);
          }
          V.tick -= c.delta;
          if (d < 3.6 && V.tick <= 0) {
            V.tick = 0.45;
            c.hurt(Math.round(e.damage * 0.4), labelOf(p, kind), '#' + new THREE.Color(fx.a).getHexString(), { knockUp: 5, from: { x: V.x, z: V.z } });
            c.shake(0.25, 0.25);
          }
          if (Math.random() < 0.5) c.sparks(new THREE.Vector3(V.x + (Math.random() - 0.5) * 5, 1 + Math.random() * 8, V.z + (Math.random() - 0.5) * 5), fx.b, 2);
        }
      } else {
        cue('recover', 1);
      }
      break;
    }

    // ───────────── データレイン: lanes of falling green code sweep across the arena (more waves, rotated each time) ─────────────
    case 'data_rain': {
      e.velocity.multiplyScalar(0.3);
      const wind = 1.1 * f;
      const waves = ph >= 3 ? 3 : ph >= 2 ? 2 : 1;
      const GREEN = 0x4ade80;
      if (t < wind) {
        cue('cast', t / wind);
        if (once(0)) {
          c.announce(`⚠ ${labelOf(p, kind)} // コードの降下レーンから外れろ`);
          c.sfx.scan();
        }
      } else {
        cue('channel', 1);
      }
      for (let w = 0; w < waves; w++) {
        if (t >= w * 1.5 && once(4 + w)) {
          const base = aimYaw() + w * (Math.PI / 2) + (w === 2 ? Math.PI / 4 : 0);
          const dx = Math.sin(base), dz = Math.cos(base);
          const px = Math.cos(base), pz = -Math.sin(base);
          const n = 3 + ph;
          const spacing = 7.2;
          // the centre lane is locked onto where the player stands right now
          const off0 = (c.player.x - pos.x) * px + (c.player.z - pos.z) * pz;
          for (let i = 0; i < n; i++) {
            const off = i === Math.floor(n / 2) ? off0 : (i - (n - 1) / 2) * spacing + off0 * 0.3;
            const cx = pos.x + px * off, cz = pos.z + pz * off;
            c.hazards.add({
              shape: 'line', x: cx - dx * 46, z: cz - dz * 46, radius: 2.0, length: 92, angle: base, delay: wind + 0.9 + i * 0.16,
              damage: Math.round(e.damage * 1.2), knockUp: 6,
              label: labelOf(p, kind), color: GREEN, fx: 'beam', shake: 0.15, owner: e,
            });
          }
          // a scatter of falling code blocks between the lanes
          const blocks = 4 + ph * 2;
          for (let i = 0; i < blocks; i++) {
            const a = Math.random() * Math.PI * 2, r = 3 + Math.random() * 13;
            c.hazards.add({
              shape: 'circle', x: THREE.MathUtils.clamp(c.player.x + Math.cos(a) * r, -37, 37), z: THREE.MathUtils.clamp(c.player.z + Math.sin(a) * r, -37, 37),
              radius: 1.9, delay: wind + 1.2 + i * 0.1, damage: Math.round(e.damage * 0.9), knockUp: 5,
              label: labelOf(p, kind), color: GREEN, fx: 'pillar', owner: e,
            });
          }
          if (w > 0) { c.announce('⚠ DATA RAIN // 再走査'); c.sfx.scan(); }
        }
      }
      break;
    }

    // ───────────── 胞子産み: the cap opens, pods are spat out and burst into Mushlings ─────────────
    case 'spore_brood': {
      e.velocity.multiplyScalar(0.3);
      const wind = 1.1 * f;
      cue(t < wind ? 'roar' : 'recover', t < wind ? t / wind : Math.max(0, 1 - (t - wind) * 1.2));
      if (once(0)) {
        c.announce('SPORE BROOD // 菌王機が小型茸機を産み落とした');
        c.sfx.scan();
        const alive = c.enemies.filter((o) => !o.isDead && o.typeId === 'mushling').length;
        const n = Math.max(0, Math.min(6 + ph * 2, 22 - alive));
        for (let i = 0; i < n; i++) {
          // half the pods rain around the player (forcing movement), the rest ring the boss
          const nearPlayer = i % 2 === 0;
          const a = Math.random() * Math.PI * 2;
          const r = nearPlayer ? 4 + Math.random() * 7 : 8 + Math.random() * 10;
          const cx = nearPlayer ? c.player.x : pos.x;
          const cz = nearPlayer ? c.player.z : pos.z;
          const x = THREE.MathUtils.clamp(cx + Math.cos(a) * r, -36, 36);
          const z = THREE.MathUtils.clamp(cz + Math.sin(a) * r, -36, 36);
          c.hazards.add({
            shape: 'circle', x, z, radius: 1.7, delay: wind + 0.25 + i * 0.09,
            damage: Math.round(e.damage * 0.45), knockUp: 3,
            label: labelOf(p, kind), color: fx.a, fx: 'pillar', owner: e,
            drop: { from: new THREE.Vector3(pos.x, pos.y + 10, pos.z), color: 0xbef264, size: 0.5, arc: 10 },
            onBurst: () => {
              if (e.isDead) return;
              c.spawnMinion('mushling', new THREE.Vector3(x, 0, z));
            },
          });
        }
      }
      if (t >= wind && once(1)) impact(0.9);
      break;
    }

    // ───────────── 増援召喚: portals open, elite guards step out ─────────────
    case 'summon_guard': {
      e.velocity.multiplyScalar(0.4);
      const wind = 1.2;
      cue(t < wind ? 'cast' : 'recover', t < wind ? t / wind : 1);
      if (once(0)) {
        A.summonedPhase = ph;
        c.announce('REINFORCEMENT // ボスが護衛を召喚した');
        c.sfx.scan();
        const types = SUMMONS[kind];
        const base = aimYaw();
        types.forEach((type, i) => {
          const a = base + (i - (types.length - 1) / 2) * 0.9 + (types.length === 1 ? 0.8 : 0);
          const x = THREE.MathUtils.clamp(pos.x + Math.sin(a) * 7, -34, 34);
          const z = THREE.MathUtils.clamp(pos.z + Math.cos(a) * 7, -34, 34);
          c.hazards.add({
            shape: 'circle', x, z, radius: 1.9, delay: wind, damage: 0, label: '', color: fx.a, fx: 'pillar', owner: e,
            onBurst: () => {
              if (e.isDead) return;
              c.spawnMinion(type, new THREE.Vector3(x, 0, z));
            },
          });
        });
      }
      if (t >= wind && once(1)) impact(0.8);
      break;
    }

    // ───────────── 形態移行: roar → shockwave → signature move ─────────────
    case 'phase_shift': {
      e.velocity.multiplyScalar(0.3);
      const wind = 0.9;
      cue('roar', t < wind ? t / wind : Math.max(0, 1 - (t - wind) * 1.5));
      if (once(0)) {
        c.hazards.add({
          shape: 'circle', x: pos.x, z: pos.z, radius: 15, delay: wind,
          damage: Math.round(e.damage * 0.5), knockBack: 20, knockUp: 6,
          label: 'SHOCKWAVE', color: fx.b, fx: 'blast', shake: 0.8, owner: e,
          onBurst: () => {
            if (e.isDead) return;
            impact(1);
            novaRing(Math.random() * Math.PI * 2);
            c.hazards.ringFx(pos.x, pos.z, 22, fx.a, 0.7);
          },
        });
      }
      if (t >= wind && once(1)) A.next = SIGNATURE[kind];
      break;
    }

    default:
      cue('idle', 0);
      approach(8, 2.0);
  }
}

/** Clear transient boss state (on death). */
export function disposeBossPattern(e: CombatEnemy, c: CombatCtx): void {
  endPattern(e, c);
}

