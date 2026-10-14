import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { Mission, Weapon, WeaponSlot, BattleResult, BattleStats, SkillNode } from '../types';
import { sound } from '../utils/sound';
import { createStageTextures, stageMaterial } from '../utils/stageTextures';
import { buildScenery, SCENERY_CONFIG, SceneryId, StageScenery } from '../utils/stageScenery';
import { AdsSight, getSightProfile, hasOpticalScope } from './AdsSight';
import { HudTopBar, HudVitals, HudWeapon, HudSlots, HudCrosshair, HudLockOverlay, HudPauseMenu, HudBossBar } from './BattleHud';
import {
  getMeleeStyle,
  getMeleeProfile,
  getMeleeSwingPose,
  getGauntletPoses,
  getTwinBladePoses,
  getScytheTempestPose,
  SCYTHE_TEMPEST_TIME,
  TWIN_ARM_BASE,
  TWIN_GUARD_ARMS,
  getLanceNeedleExtension,
  getLanceChargeShake,
  getHarpoonExtension,
  getChainsawGrindPose,
  getMeleeChargePose,
  getWhipPoints,
  WHIP_SEGMENTS,
  WHIP_ROOT,
  SAW_DROP_TIME,
  GAUNTLET_ARM_BASE,
} from '../utils/meleeStyles';
import { buildMeleeSwingFx, buildMeleeHitFx, buildHammerChargeFx, buildHammerSlamFx, buildMeleeChargeFx, buildSlashWaveFx, setFxLightProvider } from '../utils/meleeFx';
import { WeaponTrail, findTrailAnchors } from '../utils/weaponTrail';
import { Arsenal, ArsenalCtx, ARSENAL_GUNS, MAX_TURRETS } from '../utils/arsenal';
import { buildExplosionFx } from '../utils/explosionFx';
import { populateBattleWeaponModel, AKIMBO_HAND_X, updateChainsawChain } from '../utils/battleWeaponModel';
import { bossKindOf, buildBossModel, animateBoss, BossKind } from '../utils/bossModels';
import { createRig, animateEnemy, animateBossMotion, EnemyRig } from '../utils/enemyAnimation';
import { buildEliteEnemy, isEliteType } from '../utils/eliteEnemyModels';
import { buildApexEnemy, isApexType } from '../utils/apexEnemyModels';
import { updateApexEnemy, isApexCategory, apexDamageGate, apexOnDeath } from '../utils/apexEnemyAI';
import { CombatHazards, HurtFn } from '../utils/combatHazards';
import { updateEliteEnemy, isEliteCategory, isFlyingCategory, disposeEnemyAux, CombatCtx, EnemyBulletSpec } from '../utils/eliteEnemyAI';
import { chooseBossPattern, runBossPattern, disposeBossPattern } from '../utils/bossPatterns';
import { getReloadStyle, getWeaponReloadPose, getReloadPolish, getReloadEvents, DEFAULT_DOCKS, ReloadDocks } from '../utils/weaponReload';
import { getPistolReloadPose } from '../utils/pistolReload';
import { GUARD_PROFILES, MELEE_READY_POSE, LANCE_MAX_CHARGE, buildGuardFx, updateGuardFx } from '../utils/meleeGuards';
import { getNodeLevel, scaledEffectValue } from '../data/nodeLevels';
import { WORLD_MAPS } from '../data/initialData';
import { NetSession } from '../utils/netplay';
import { CoopBattle, CoopEnemy, ReviveInfo } from '../utils/coopBattle';
import {
  HealDrone, HEAL_DRONE_RANGE, HEAL_DRONE_RANGE_HOLD, HEAL_DRONE_HPS, HEAL_DRONE_PCT,
  HEAL_DRONE_RANGE_WIDE, HEAL_DRONE_RANGE_HOLD_WIDE, HEAL_DRONE_MAX_BEAMS,
} from '../utils/healDrone';

interface BattleScene3DProps {
  mission: Mission;
  weapons: Weapon[];
  activeLoadout: Record<WeaponSlot, string | null>;
  skillNodes: SkillNode[];
  weaponDamageLevels?: Record<string, number>;
  nodeLevels?: Record<string, number>;
  /** 協力プレイのセッション (ソロなら null) */
  net?: NetSession | null;
  /** ハードモード (3MAP先の敵の強さ) */
  hard?: boolean;
  onFinishBattle: (result: BattleResult) => void;
  /** 開発者モード: G キーでステージを即クリア */
  devMode?: boolean;
  onExitToMenu: () => void;
}

/** ステージ開始カットインの長さ (秒)。終了と同時に WAVE 1 が出現する */
const STAGE_INTRO_SECONDS = 3.2;
// 無被弾回復: 被弾(HP/シールドの減少)から DELAY 秒経つと HP がゆっくり回復する。
// シールド自動回復(毎秒5)より低く抑える
const HP_REGEN_DELAY_SECONDS = 5;
const HP_REGEN_PER_SECOND = 2;

type EnemyCategory = 'hound' | 'drone' | 'golem' | 'boss' | 'sentry' | 'stalker' | 'titan' | 'mender' | 'wyrm' | 'jester' | 'carrier' | 'lancer'
  | 'aegis' | 'ronin' | 'pyro' | 'weaver' | 'pylon' | 'spotter' | 'splitter' | 'chrono' | 'mirage' | 'mirage_echo' | 'magnet' | 'berserker';

/** 新型の敵 -> 行動パターン(AI/当たり判定)を共有する基本カテゴリ */
const ENEMY_BASE_CATEGORY: Record<string, EnemyCategory> = {
  raptor: 'hound',
  mauler: 'hound',
  seeker: 'drone',
  gunship: 'drone',
  scorpion: 'sentry',
  wraith: 'stalker',
  bulwark: 'golem',
  howitzer: 'titan',
  mite: 'hound',
  splitling: 'hound',
  boss_golem: 'boss',
  boss_titan: 'boss',
  boss_kraken: 'boss',
  boss_warden: 'boss',
  boss_frost: 'boss',
};
const baseCategoryOf = (typeId: string): EnemyCategory =>
  ENEMY_BASE_CATEGORY[typeId] ?? (typeId as EnemyCategory);

interface EnemyInstance {
  mesh: THREE.Group;
  typeId: string;
  name?: string;
  category: EnemyCategory;
  hp: number;
  maxHp: number;
  speed: number;
  baseSpeed: number;
  damage: number;
  scoreValue: number;
  scrapValue: number;
  attackCooldown: number;
  shootCooldown?: number;
  laserBeam?: THREE.Line;
  cloakTime?: number;
  isDead: boolean;
  velocity: THREE.Vector3;
  overheadGroup?: THREE.Group;
  hpBarMesh?: THREE.Mesh;
  groundRingMesh?: THREE.Mesh;

  // Dynamic AI Tactical Patterns
  aiPattern: string;
  patternTimer: number;
  actionSubTimer: number;
  strafeSign: number;
  isCharging?: boolean;
  isSniping?: boolean;
  bossKind?: BossKind;
  bossPhase?: number;
  bossSpin?: number;
  bossState?: number;
  sniperLaserLine?: THREE.Line;
  telegraphMesh?: THREE.Mesh;

  // Status Ailments
  frozenTimer?: number;
  /** PALCER: 行動不能の残り秒数 */
  stunTimer?: number;
  /** ゲスト: ホストへ報告待ちのスタン秒数 */
  stunReq?: number;
  chillSlowTimer?: number;
  chillHits?: number;
  shockTimer?: number;
  naniteDotTimer?: number;
  naniteDotDamage?: number;
  naniteNextTick?: number;
  naniteStacks?: number;
  burnTimer?: number;
  burnDps?: number;
  // RAVAGER-09 bleed (saw_mod_serrate / SHRED GUARD)
  bleedTimer?: number;
  bleedDps?: number;
  bleedTextTimer?: number;
  burnTextTimer?: number;
  freezeImmuneTimer?: number;
  isPulled?: boolean;
  // ANCHRON-G2 mooring: marked = slowed + takes bonus anchor damage; rooted = cannot move at all
  mooredTimer?: number;
  rootTimer?: number;
  // HELIX FLARE mark: every hit landing while vulnTimer > 0 is amplified by vulnMul
  vulnTimer?: number;
  vulnMul?: number;
  vulnPrevHp?: number;

  // Elite / boss pattern state (see eliteEnemyAI.ts / bossPatterns.ts)
  /** vertical offset after ground snapping (burrowing wyrm, leaping boss) */
  airY?: number;
  /** no melee contact damage while set (burrowed, blinking, airborne, flying support) */
  noContact?: boolean;
  /** skip the player stand-off push while set */
  ignoreStandoff?: boolean;
  /** face this yaw instead of the player (dash lanes, locked beams) */
  faceAngle?: number;
  /** scene object owned by the enemy (heal tether), disposed on death */
  auxMesh?: THREE.Object3D;
  /** free-form AI memory */
  ai?: any;

  // CO-OP (see utils/coopBattle.ts)
  isPuppet?: boolean;
  netId?: number;
  netHp?: number;
  netPos?: { x: number; y: number; z: number; ry: number };
  netSnapHp?: number;
  lastDamager?: string;
}

interface BulletInstance {
  /** 協力プレイ: ホストの敵弾の見た目だけを再現する (被弾判定なし) */
  visualOnly?: boolean;
  mesh: THREE.Mesh | THREE.Group;
  direction: THREE.Vector3;
  speed: number;
  damage: number;
  lifetime: number;
  isPlayer: boolean;
  prevPosition: THREE.Vector3;
  bulletRadius: number;

  // Unique Weapon Capabilities
  weaponId?: string;
  isPiercing?: boolean;
  pierceRemaining?: number;
  piercedEnemyIds?: number[];
  hasRailBurst?: boolean;
  isHoming?: boolean;
  isRicochet?: boolean;
  ricochetBouncesRemaining?: number;
  isWave?: boolean;
  waveWidth?: number;
  isFrost?: boolean;
  isNanite?: boolean;
  isCluster?: boolean;
  isGravity?: boolean;
  isArc?: boolean;
  // Balance layer: per-weapon falloff / pierce decay / knockback / burn
  originPos?: THREE.Vector3;
  weaponRange?: number;
  falloffMode?: 'none' | 'short' | 'mid';
  pierceDecay?: number;
  knockback?: number;
  burnDps?: number;
  burnDuration?: number;
  isCrit?: boolean;
  minDamage?: number;
  detonated?: boolean;
  // BUBBLAS: drifting soap bubbles that pass through enemies and pop when their momentum is spent
  isBubble?: boolean;
  bubbleAge?: number;
  bubbleLife?: number;
  bubbleSpeed0?: number;
  bubblePhase?: number;
  // PHASE JESTER chakram: curves out, then homes back to its thrower
  boomerang?: { owner: EnemyInstance; t: number; out: number; curve: number; onDone?: () => void };
}

interface GravityWellEntity {
  mesh: THREE.Group;
  position: THREE.Vector3;
  lifetime: number;
  damage: number;
  radius: number;
  hasShockwave?: boolean;
  pullPower?: number;
}

interface DroneFunnelEntity {
  mesh: THREE.Group;
  angleOffset: number;
  shootCooldown: number;
  damage: number;
  lifetime: number;
}

interface ClusterBombletEntity {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  lifetime: number;
  damage: number;
  blastRadius?: number;
  hasSecondary?: boolean;
}

/** 敵撃破時の BEACON ドロップ率 (カテゴリ別) */
const BEACON_DROP_CHANCE: Partial<Record<EnemyCategory, number>> = {
  drone: 0.02,
  hound: 0.03,
  sentry: 0.05,
  stalker: 0.05,
  golem: 0.08,
  titan: 0.5,
  boss: 1,
  mender: 0.12,
  wyrm: 0.1,
  jester: 0.08,
  carrier: 0.15,
  lancer: 0.12,
  aegis: 0.12,
  ronin: 0.1,
  pyro: 0.1,
  weaver: 0.12,
  pylon: 0,
  spotter: 0.1,
  splitter: 0.08,
  chrono: 0.14,
  mirage: 0.1,
  mirage_echo: 0,
  magnet: 0.12,
  berserker: 0.14,
};

interface ScrapDrop {
  mesh: THREE.Mesh;
  amount: number;
  /** BEACON ドロップ (稀) の個数。指定時は SCRAP ではなく BEACON を拾う */
  beacon?: number;
  position: THREE.Vector3;
}

interface DynamiteProjectile {
  mesh: THREE.Group;
  velocity: THREE.Vector3;
  lifetime: number;
  damage: number;
  /** blast = ダイナマイトの爆風 / stun = PALCER の閃光 (少量ダメージ + 行動不能) */
  kind: 'blast' | 'stun';
}

/** 投擲物ごとの初速 (視線方向への速さ / 上向きの初速) と爆発半径。予測線と実際の軌道で共用する */
const THROW_PROFILE = {
  blast: { speed: 22, up: 7.0, radius: 6.5 },
  stun: { speed: 42, up: 9.0, radius: 7.5 },
} as const;
const PALCER_STUN_SEC = 3;
const throwKindOf = (weaponId: string): 'blast' | 'stun' => (weaponId === 'grenade_palcer' ? 'stun' : 'blast');

interface FloatingText {
  id: number;
  text: string;
  x: number;
  y: number;
  color: string;
}

// Temporary math vectors to avoid allocations in game loop
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _moveDir = new THREE.Vector3();
const _toEnemy = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _zeroVec = new THREE.Vector3(0, 0, 0);
const _tempSeg = new THREE.Vector3();
const _tempToCenter = new THREE.Vector3();
const _tempClosest = new THREE.Vector3();
const _enemyCenter = new THREE.Vector3();
const _beamOrg = new THREE.Vector3();
const _beamFwd = new THREE.Vector3();
const _beamRight = new THREE.Vector3();
const _beamStart = new THREE.Vector3();
const _beamEnd = new THREE.Vector3();
const _beamMid = new THREE.Vector3();
const _beamDir = new THREE.Vector3();
const _beamPt = new THREE.Vector3();
const _beamUp = new THREE.Vector3(0, 1, 0);
const _trailBase = new THREE.Vector3();
const _trailTip = new THREE.Vector3();
const _whipPts = Array.from({ length: 18 }, () => ({ x: 0, y: 0, z: 0 }));
const _whipA = new THREE.Vector3();
const _whipB = new THREE.Vector3();
const _whipC = new THREE.Vector3();

// Accurate 3D hitbox calculation for each enemy category
const getEnemyHitbox = (enemy: EnemyInstance, outCenter: THREE.Vector3) => {
  const pos = enemy.mesh.position;
  let offsetY = 0.6;
  let height = 1.1;
  let radius = 1.05;

  switch (enemy.category) {
    case 'hound':
      offsetY = 0.55;
      height = 1.1;
      radius = 1.1;
      break;
    case 'drone':
      // Drones hover in mid-air, mesh origin is centered directly at drone body
      offsetY = 0.0;
      height = 1.2;
      radius = 1.25;
      break;
    case 'sentry':
      offsetY = 0.65;
      height = 1.3;
      radius = 1.2;
      break;
    case 'stalker':
      offsetY = 1.1;
      height = 2.1;
      radius = 1.2;
      break;
    case 'golem':
      offsetY = 1.6;
      height = 2.8;
      radius = 2.0;
      break;
    case 'titan':
      offsetY = 1.8;
      height = 3.2;
      radius = 2.7;
      break;
    case 'boss':
      offsetY = 5.4;
      height = 10.4;
      radius = 6.0;
      break;
    case 'wyrm':
      offsetY = 1.3;
      height = 3.4;
      radius = 1.6;
      break;
    case 'jester':
      offsetY = 1.2;
      height = 2.5;
      radius = 1.1;
      break;
    case 'lancer':
      offsetY = 1.7;
      height = 3.5;
      radius = 1.7;
      break;
    case 'aegis':
      offsetY = 1.6;
      height = 3.2;
      radius = 1.55;
      break;
    case 'ronin':
    case 'mirage':
    case 'mirage_echo':
      offsetY = 1.15;
      height = 2.5;
      radius = 1.0;
      break;
    case 'pyro':
      offsetY = 1.3;
      height = 2.6;
      radius = 1.45;
      break;
    case 'weaver':
      offsetY = 1.0;
      height = 2.4;
      radius = 1.5;
      break;
    case 'pylon':
      offsetY = 1.0;
      height = 2.2;
      radius = 0.75;
      break;
    case 'splitter':
      offsetY = 1.0;
      height = 2.1;
      radius = 1.3;
      break;
    case 'chrono':
      offsetY = 1.8;
      height = 3.8;
      radius = 1.3;
      break;
    case 'magnet':
    case 'berserker':
      offsetY = 1.6;
      height = 3.2;
      radius = 1.6;
      break;
    case 'mender':
    case 'spotter':
    case 'carrier': {
      // flying, centred on the origin
      const h = enemy.category === 'carrier' ? 2.6 : enemy.category === 'spotter' ? 1.3 : 1.8;
      radius = enemy.category === 'carrier' ? 2.5 : enemy.category === 'spotter' ? 1.3 : 1.35;
      outCenter.set(pos.x, pos.y, pos.z);
      return { minY: pos.y - h / 2, maxY: pos.y + h / 2, radius, offsetY: 0 };
    }
    default:
      offsetY = 0.8;
      height = 1.6;
      radius = 1.2;
      break;
  }

  outCenter.set(pos.x, pos.y + offsetY, pos.z);
  return {
    minY: pos.y - 0.2,
    maxY: pos.y + height + 0.2,
    radius,
    offsetY,
  };
};

// Minimum distance enemies keep from the player (prevents hugging / clipping into the camera)
const getEnemyStandoff = (category: string): number => {
  switch (category) {
    case 'boss': return 7.0;
    case 'titan': return 4.5;
    case 'golem': return 3.0;
    case 'sentry': return 3.5;
    case 'drone': return 3.2;
    case 'hound':
    case 'stalker': return 2.4;
    case 'carrier': return 4.0;
    case 'mender': return 3.2;
    case 'lancer': return 3.2;
    case 'wyrm': return 2.6;
    case 'jester': return 2.4;
    case 'aegis': return 3.4;
    case 'magnet': return 3.4;
    case 'berserker': return 2.9;
    case 'pyro': return 3.0;
    case 'chrono': return 3.0;
    case 'spotter': return 4.0;
    default: return 2.6;
  }
};

// Helper to check if weapon is an automatic assault firearm
/** INFIGHT 溜め技 (右クリック長押し) の必要時間(秒) */
const MELEE_CHARGE_TIME = 0.75;

/** INFIGHT: 三段攻撃後 / 左右クリック技後のクールタイム(秒) */
const MELEE_SKILL_COOLDOWN = 0.5;
/** 溜め技のクールダウン(秒)。全武器共通 */
const MELEE_CHARGE_SKILL_COOLDOWN = 5;

const isAssaultTypeWeapon = (w: Weapon): boolean => {
  return (
    w.modelType === 'rifle' ||
    w.id === 'main_spectre' ||
    w.id === 'sub_smg' ||
    w.id === 'sub_pulsar' ||
    w.stats.fireRate >= 4.0
  );
};

/** PHOTON GATLING: seconds of holding the trigger for a full charge. */
const GATLING_CHARGE_TIME = 3.0;
/** PHOTON GATLING: sustained-fire seconds granted at 0% / 100% charge. */
const GATLING_FIRE_MIN = 0.8;
const GATLING_FIRE_MAX = 7.0;
/** PHOTON GATLING: seconds of continuous firing to reach the top fire rate, and the extra rate multiplier gained by then. */
const GATLING_RAMP_TIME = 3.0;
const GATLING_RATE_BONUS = 1.0;
/** SHR1NKER: seconds of holding the trigger for a full charge; the beam then runs for BEAM_TIME_MUL x the charged time. */
const SHR1NKER_CHARGE_TIME = 3.0;
const SHR1NKER_MIN_CHARGE = 0.25;
const SHR1NKER_BEAM_TIME_MUL = 2;
/** SHR1NKER: beam half-width (m) at 0% / 100% charge, and seconds between damage ticks. */
const SHR1NKER_RADIUS_MIN = 0.07;
const SHR1NKER_RADIUS_MAX = 1.0;
const SHR1NKER_TICK = 0.1;
/** BUBBLAS: how long (s) a bubble keeps drifting before it bursts. */
const BUBBLAS_LIFE_MIN = 1.7;
const BUBBLAS_LIFE_VAR = 0.6;
const BUBBLAS_SPEED = 30;
/** SPREAD-ER: seconds of continuous fire to reach max rate / max spread. */
const SPREADER_RAMP_TIME = 3.5;
const SPREADER_RATE_BONUS = 1.2;

export { hasOpticalScope };

export interface CoverObject {
  mesh: THREE.Object3D;
  box: { minX: number; maxX: number; minZ: number; maxZ: number; height: number };
}

export interface StageEnvironmentTheme {
  floorRoughness: number;
  floorMetalness: number;
  gridMain: number;
  gridSub: number;
  accentColor: number;
  nameJa: string;
  subName: string;
  scenery: SceneryId;
  style: 'apartments' | 'sanctuary' | 'foundry' | 'cathedral' | 'spire' | 'dock' | 'monolith' | 'omega' | 'abyss' | 'relic' | 'cryo';
}

export function getStageTheme(missionId: string): StageEnvironmentTheme {
  switch (missionId) {
    // ================= MAP 1: GOTHIC METROPOLIS =================
    case 'm1_apartments':
      return {
        floorRoughness: 0.35,
        floorMetalness: 0.45,
        gridMain: 0x0284c7,
        gridSub: 0x94a3b8,
        accentColor: 0x0284c7,
        nameJa: '廃棄回廊クリアランス',
        subName: 'GOTHIC APARTMENTS // SECTOR 01',
        scenery: 'apartments',
        style: 'apartments',
      };
    case 'm1b_market':
      return {
        floorRoughness: 0.3,
        floorMetalness: 0.5,
        gridMain: 0xec4899,
        gridSub: 0x22d3ee,
        accentColor: 0xec4899,
        nameJa: 'ネオン闇市街の制圧',
        subName: 'NEON BLACK MARKET // SECTOR 02',
        scenery: 'market',
        style: 'sanctuary',
      };
    case 'm2_sanctuary':
      return {
        floorRoughness: 0.2,
        floorMetalness: 0.6,
        gridMain: 0x06b6d4,
        gridSub: 0xa855f7,
        accentColor: 0x06b6d4,
        nameJa: 'ネオン聖堂の外郭掃討',
        subName: 'NEON SANCTUARY // SECTOR 03',
        scenery: 'sanctuary',
        style: 'sanctuary',
      };
    case 'm2b_aqueduct':
      return {
        floorRoughness: 0.3,
        floorMetalness: 0.55,
        gridMain: 0x14b8a6,
        gridSub: 0x64748b,
        accentColor: 0x14b8a6,
        nameJa: '旧帝都アクアダクト突破',
        subName: 'IMPERIAL AQUEDUCT // SECTOR 04',
        scenery: 'aqueduct',
        style: 'foundry',
      };
    case 'm3_foundry':
      return {
        floorRoughness: 0.45,
        floorMetalness: 0.45,
        gridMain: 0xf97316,
        gridSub: 0xfb923c,
        accentColor: 0xea580c,
        nameJa: '地下鋳造カタコンベ浄化',
        subName: 'SUBTERRANEAN FOUNDRY // SECTOR 05',
        scenery: 'foundry',
        style: 'foundry',
      };
    case 'm3b_belfry':
      return {
        floorRoughness: 0.3,
        floorMetalness: 0.5,
        gridMain: 0xa855f7,
        gridSub: 0xeab308,
        accentColor: 0xa855f7,
        nameJa: '鐘楼回廊の強行突破',
        subName: 'BELFRY CLOISTER // SECTOR 06',
        scenery: 'belfry',
        style: 'cathedral',
      };
    case 'm4_nave':
      return {
        floorRoughness: 0.25,
        floorMetalness: 0.55,
        gridMain: 0xeab308,
        gridSub: 0x0284c7,
        accentColor: 0xfacc15,
        nameJa: '大聖堂尖兵中枢：決戦重装ゴーレム',
        subName: 'CATHEDRAL CENTRAL NAVE // SECTOR 07 [MAP 1 BOSS]',
        scenery: 'cathedral',
        style: 'cathedral',
      };

    // ================= MAP 2: ORBITAL CITADEL =================
    case 'm5_spire':
      return {
        floorRoughness: 0.15,
        floorMetalness: 0.7,
        gridMain: 0x8b5cf6,
        gridSub: 0x38bdf8,
        accentColor: 0x8b5cf6,
        nameJa: '軌道電磁尖塔の防衛',
        subName: 'ORBITAL SPIRE // SECTOR 08',
        scenery: 'spire',
        style: 'spire',
      };
    case 'm5b_skybridge':
      return {
        floorRoughness: 0.12,
        floorMetalness: 0.75,
        gridMain: 0x38bdf8,
        gridSub: 0xf8fafc,
        accentColor: 0x38bdf8,
        nameJa: '成層圏スカイブリッジ',
        subName: 'STRATOSPHERE SKYBRIDGE // SECTOR 09',
        scenery: 'skybridge',
        style: 'spire',
      };
    case 'm6_dock':
      return {
        floorRoughness: 0.45,
        floorMetalness: 0.45,
        gridMain: 0xf59e0b,
        gridSub: 0x64748b,
        accentColor: 0xf59e0b,
        nameJa: '機神格納庫最終防衛線',
        subName: 'TITAN MECH DOCK // SECTOR 10',
        scenery: 'mechdock',
        style: 'dock',
      };
    case 'm6b_relay':
      return {
        floorRoughness: 0.2,
        floorMetalness: 0.7,
        gridMain: 0x84cc16,
        gridSub: 0x38bdf8,
        accentColor: 0x84cc16,
        nameJa: '軌道送電リレー基地',
        subName: 'ORBITAL RELAY STATION // SECTOR 11',
        scenery: 'relay',
        style: 'spire',
      };
    case 'm7_monolith':
      return {
        floorRoughness: 0.1,
        floorMetalness: 0.8,
        gridMain: 0xd946ef,
        gridSub: 0x38bdf8,
        accentColor: 0xd946ef,
        nameJa: '封印のモノリス深奥突破',
        subName: 'FORBIDDEN MONOLITH // SECTOR 12',
        scenery: 'monolith',
        style: 'monolith',
      };
    case 'm7b_arsenal':
      return {
        floorRoughness: 0.4,
        floorMetalness: 0.55,
        gridMain: 0xf97316,
        gridSub: 0x64748b,
        accentColor: 0xf97316,
        nameJa: '天空重砲兵器廠',
        subName: 'SKY ARSENAL // SECTOR 13',
        scenery: 'arsenal',
        style: 'dock',
      };
    case 'm8_dock_boss':
      return {
        floorRoughness: 0.25,
        floorMetalness: 0.7,
        gridMain: 0xf59e0b,
        gridSub: 0xef4444,
        accentColor: 0xf59e0b,
        nameJa: '軌道核融合炉：天動巨神タイタン',
        subName: 'ORBITAL FUSION CORE // SECTOR 14 [MAP 2 BOSS]',
        scenery: 'fusion',
        style: 'dock',
      };

    // ================= MAP 3: DEEP RESEARCH SECTOR =================
    case 'm9_rift':
      return {
        floorRoughness: 0.2,
        floorMetalness: 0.65,
        gridMain: 0x22d3ee,
        gridSub: 0x0e7490,
        accentColor: 0x22d3ee,
        nameJa: '深部連絡回廊の制圧',
        subName: 'CONNECTING CORRIDOR // SECTOR 15',
        scenery: 'corridor',
        style: 'apartments',
      };
    case 'm9b_biolab':
      return {
        floorRoughness: 0.2,
        floorMetalness: 0.6,
        gridMain: 0x22c55e,
        gridSub: 0x0e7490,
        accentColor: 0x22c55e,
        nameJa: '生体工学ラボの封鎖',
        subName: 'BIO-ENGINEERING LAB // SECTOR 16',
        scenery: 'biolab',
        style: 'omega',
      };
    case 'm10_observatory':
      return {
        floorRoughness: 0.15,
        floorMetalness: 0.75,
        gridMain: 0x06b6d4,
        gridSub: 0x3b82f6,
        accentColor: 0x06b6d4,
        nameJa: '施設観測ステーション',
        subName: 'RESEARCH OBSERVATORY // SECTOR 17',
        scenery: 'observatory',
        style: 'spire',
      };
    case 'm10b_archive':
      return {
        floorRoughness: 0.12,
        floorMetalness: 0.8,
        gridMain: 0x818cf8,
        gridSub: 0xd946ef,
        accentColor: 0x818cf8,
        nameJa: '禁断データアーカイブ',
        subName: 'FORBIDDEN ARCHIVE // SECTOR 18',
        scenery: 'archive',
        style: 'monolith',
      };
    case 'm11_antimatter':
      return {
        floorRoughness: 0.2,
        floorMetalness: 0.7,
        gridMain: 0xec4899,
        gridSub: 0x8b5cf6,
        accentColor: 0xec4899,
        nameJa: '動力制御室の掃討',
        subName: 'POWER CONTROL ROOM // SECTOR 19',
        scenery: 'powerroom',
        style: 'omega',
      };
    case 'm11b_reactor':
      return {
        floorRoughness: 0.2,
        floorMetalness: 0.75,
        gridMain: 0xf43f5e,
        gridSub: 0xf59e0b,
        accentColor: 0xf43f5e,
        nameJa: '反物質炉心の冷却区画',
        subName: 'ANTIMATTER REACTOR // SECTOR 20',
        scenery: 'reactor',
        style: 'omega',
      };
    // ================= MAP 4: TIDAL RUINS =================
    case 'm13_harbor':
      return {
        floorRoughness: 0.25,
        floorMetalness: 0.5,
        gridMain: 0x14b8a6,
        gridSub: 0x38bdf8,
        accentColor: 0x14b8a6,
        nameJa: '沈没港湾の哨戒',
        subName: 'SUNKEN HARBOR // SECTOR 22',
        scenery: 'harbor',
        style: 'abyss',
      };
    case 'm13b_reef':
      return {
        floorRoughness: 0.15,
        floorMetalness: 0.45,
        gridMain: 0xfb7185,
        gridSub: 0x2dd4bf,
        accentColor: 0xfb7185,
        nameJa: '珊瑚ドーム街の掃討',
        subName: 'CORAL DOME DISTRICT // SECTOR 23',
        scenery: 'reef',
        style: 'abyss',
      };
    case 'm14_whalefall':
      return {
        floorRoughness: 0.35,
        floorMetalness: 0.35,
        gridMain: 0x67e8f9,
        gridSub: 0x94a3b8,
        accentColor: 0x67e8f9,
        nameJa: '鯨骨の回廊',
        subName: 'WHALEFALL CORRIDOR // SECTOR 24',
        scenery: 'whalefall',
        style: 'abyss',
      };
    case 'm14b_vents':
      return {
        floorRoughness: 0.45,
        floorMetalness: 0.4,
        gridMain: 0xf97316,
        gridSub: 0x14b8a6,
        accentColor: 0xf97316,
        nameJa: '熱水噴出域の突破',
        subName: 'HYDROTHERMAL VENTS // SECTOR 25',
        scenery: 'vents',
        style: 'abyss',
      };
    case 'm15_aquarium':
      return {
        floorRoughness: 0.12,
        floorMetalness: 0.6,
        gridMain: 0x38bdf8,
        gridSub: 0xa5f3fc,
        accentColor: 0x38bdf8,
        nameJa: '深海水族館の封鎖',
        subName: 'ABYSS AQUARIUM // SECTOR 26',
        scenery: 'aquarium',
        style: 'abyss',
      };
    case 'm15b_trench':
      return {
        floorRoughness: 0.2,
        floorMetalness: 0.55,
        gridMain: 0x22d3ee,
        gridSub: 0x6366f1,
        accentColor: 0x22d3ee,
        nameJa: '発光海溝の強行突破',
        subName: 'LUMINOUS TRENCH // SECTOR 27',
        scenery: 'trench',
        style: 'abyss',
      };
    case 'm16_kraken_boss':
      return {
        floorRoughness: 0.18,
        floorMetalness: 0.65,
        gridMain: 0x2dd4bf,
        gridSub: 0xfb7185,
        accentColor: 0x2dd4bf,
        nameJa: '潮流の聖域：触腕機リヴァイアサン',
        subName: 'TIDAL SANCTUM // SECTOR 28 [MAP 4 BOSS]',
        scenery: 'sanctum',
        style: 'abyss',
      };

    // ================= MAP 5: SILENT WASTES =================
    case 'm17_dunes':
      return {
        floorRoughness: 0.5,
        floorMetalness: 0.3,
        gridMain: 0xfbbf24,
        gridSub: 0xf472b6,
        accentColor: 0xfbbf24,
        nameJa: '硝子砂丘の横断',
        subName: 'GLASS DUNES // SECTOR 29',
        scenery: 'dunes',
        style: 'relic',
      };
    case 'm17b_graveyard':
      return {
        floorRoughness: 0.55,
        floorMetalness: 0.5,
        gridMain: 0xfb923c,
        gridSub: 0x78716c,
        accentColor: 0xfb923c,
        nameJa: '機神墓場の探索',
        subName: 'TITAN GRAVEYARD // SECTOR 30',
        scenery: 'graveyard',
        style: 'relic',
      };
    case 'm18_clockwork':
      return {
        floorRoughness: 0.3,
        floorMetalness: 0.65,
        gridMain: 0xfcd34d,
        gridSub: 0xa16207,
        accentColor: 0xfcd34d,
        nameJa: '歯車時計塔の攻略',
        subName: 'CLOCKWORK SPIRE // SECTOR 31',
        scenery: 'clockwork',
        style: 'relic',
      };
    case 'm18b_crater':
      return {
        floorRoughness: 0.5,
        floorMetalness: 0.35,
        gridMain: 0xef4444,
        gridSub: 0xf97316,
        accentColor: 0xef4444,
        nameJa: '流星クレーターの防衛',
        subName: 'STARFALL CRATER // SECTOR 32',
        scenery: 'crater',
        style: 'relic',
      };
    case 'm19_chapel':
      return {
        floorRoughness: 0.15,
        floorMetalness: 0.7,
        gridMain: 0xc084fc,
        gridSub: 0xe9d5ff,
        accentColor: 0xc084fc,
        nameJa: '逆さの礼拝堂',
        subName: 'INVERTED CHAPEL // SECTOR 33',
        scenery: 'chapel',
        style: 'relic',
      };
    case 'm19b_gate':
      return {
        floorRoughness: 0.2,
        floorMetalness: 0.7,
        gridMain: 0x8b5cf6,
        gridSub: 0x38bdf8,
        accentColor: 0x8b5cf6,
        nameJa: '沈黙の門の突破',
        subName: 'SILENT GATE // SECTOR 34',
        scenery: 'gate',
        style: 'relic',
      };
    case 'm20_warden_boss':
      return {
        floorRoughness: 0.1,
        floorMetalness: 0.8,
        gridMain: 0xa78bfa,
        gridSub: 0xfde68a,
        accentColor: 0xa78bfa,
        nameJa: '硝子の城砦：番人ヘリオス',
        subName: 'GLASS CITADEL // SECTOR 35 [MAP 5 BOSS]',
        scenery: 'citadel',
        style: 'relic',
      };

    // ================= MAP 6: FROZEN ARCHIVE =================
    case 'm21_outskirts':
      return {
        floorRoughness: 0.2,
        floorMetalness: 0.4,
        gridMain: 0x67e8f9,
        gridSub: 0xe0f2fe,
        accentColor: 0x67e8f9,
        nameJa: '凍原外縁の突破',
        subName: 'FROZEN OUTSKIRTS // SECTOR 36',
        scenery: 'outskirts',
        style: 'cryo',
      };
    case 'm21b_cryobay':
      return {
        floorRoughness: 0.15,
        floorMetalness: 0.55,
        gridMain: 0x38bdf8,
        gridSub: 0xa5f3fc,
        accentColor: 0x38bdf8,
        nameJa: '冷却ベイの制圧',
        subName: 'CRYO BAY // SECTOR 37',
        scenery: 'cryobay',
        style: 'cryo',
      };
    case 'm22_stacks':
      return {
        floorRoughness: 0.18,
        floorMetalness: 0.5,
        gridMain: 0x7dd3fc,
        gridSub: 0xe0f2fe,
        accentColor: 0x7dd3fc,
        nameJa: '凍結書庫の探索',
        subName: 'FROZEN STACKS // SECTOR 38',
        scenery: 'stacks',
        style: 'cryo',
      };
    case 'm22b_servers':
      return {
        floorRoughness: 0.2,
        floorMetalness: 0.6,
        gridMain: 0x22d3ee,
        gridSub: 0x6366f1,
        accentColor: 0x22d3ee,
        nameJa: '氷結サーバー群の防衛',
        subName: 'GLACIAL SERVER HALL // SECTOR 39',
        scenery: 'servers',
        style: 'cryo',
      };
    case 'm23_echohall':
      return {
        floorRoughness: 0.12,
        floorMetalness: 0.6,
        gridMain: 0x93c5fd,
        gridSub: 0xbae6fd,
        accentColor: 0x93c5fd,
        nameJa: '残像ホールの攻略',
        subName: 'ECHO HALL // SECTOR 40',
        scenery: 'echohall',
        style: 'cryo',
      };
    case 'm23b_conduit':
      return {
        floorRoughness: 0.15,
        floorMetalness: 0.55,
        gridMain: 0x2dd4bf,
        gridSub: 0x67e8f9,
        accentColor: 0x2dd4bf,
        nameJa: 'オーロラ導管の突破',
        subName: 'AURORA CONDUIT // SECTOR 41',
        scenery: 'conduit',
        style: 'cryo',
      };
    case 'm24_frost_boss':
      return {
        floorRoughness: 0.08,
        floorMetalness: 0.75,
        gridMain: 0x67e8f9,
        gridSub: 0xe0f2fe,
        accentColor: 0x67e8f9,
        nameJa: '氷晶の記録庫：氷結機フロストコア',
        subName: 'CRYSTAL VAULT // SECTOR 42 [MAP 6 BOSS]',
        scenery: 'frostvault',
        style: 'cryo',
      };

    case 'm12_omega_boss':
    default:
      return {
        floorRoughness: 0.15,
        floorMetalness: 0.8,
        gridMain: 0xef4444,
        gridSub: 0xff0044,
        accentColor: 0xff0044,
        nameJa: '深部格納庫：大型機動神機アーコン',
        subName: 'ARCHON HANGAR // SECTOR 21 [MAP 3 BOSS]',
        scenery: 'hangar',
        style: 'omega',
      };
  }
}

// ================= WAVE SYSTEM INTERFACES & FACTORIES =================
export interface WaveEnemyDef {
  enemyTypeId: string;
  name: string;
  count: number;
  description?: string;
}

export interface WaveConfig {
  waveIndex: number;
  enemies: WaveEnemyDef[];
  isFinalWave: boolean;
  isBossWave: boolean;
}

export function buildMissionWaves(mission: Mission): WaveConfig[] {
  const isBossMission = mission.isBoss;

  const bossEnemies: WaveEnemyDef[] = [];
  const regularEnemies: WaveEnemyDef[] = [];

  mission.enemies.forEach((en) => {
    if (baseCategoryOf(en.enemyTypeId) === 'boss' || en.name.includes('[BOSS]')) {
      bossEnemies.push({ ...en });
    } else {
      regularEnemies.push({ ...en });
    }
  });

  const waves: WaveConfig[] = [
    { waveIndex: 0, enemies: [], isFinalWave: false, isBossWave: false },
    { waveIndex: 1, enemies: [], isFinalWave: false, isBossWave: false },
    { waveIndex: 2, enemies: [], isFinalWave: true, isBossWave: isBossMission },
  ];

  if (isBossMission) {
    // Boss spawns exclusively in the final Climax wave!
    if (bossEnemies.length > 0) waves[2].enemies.push({ ...bossEnemies[0], count: 1 });

    regularEnemies.forEach((en) => {
      if (en.count <= 1) {
        waves[1].enemies.push({ ...en, count: 1 });
      } else if (en.count === 2) {
        waves[0].enemies.push({ ...en, count: 1 });
        waves[1].enemies.push({ ...en, count: 1 });
      } else if (en.count === 3) {
        waves[0].enemies.push({ ...en, count: 1 });
        waves[1].enemies.push({ ...en, count: 1 });
        waves[2].enemies.push({ ...en, count: 1 });
      } else {
        // Distribute minions across 3 waves so Wave 1 and 2 have ~10, and Wave 3 has Boss + ~9 minions (~10 total)
        const c1 = Math.round(en.count * 0.36);
        const c2 = Math.round(en.count * 0.36);
        const c3 = en.count - c1 - c2;
        if (c1 > 0) waves[0].enemies.push({ ...en, count: c1 });
        if (c2 > 0) waves[1].enemies.push({ ...en, count: c2 });
        if (c3 > 0) waves[2].enemies.push({ ...en, count: c3 });
      }
    });
  } else {
    // Standard mission: split regular enemies evenly across 3 waves targeting ~10 enemies per wave
    regularEnemies.forEach((en) => {
      if (en.count === 1) {
        waves[2].enemies.push({ ...en, count: 1 });
      } else if (en.count === 2) {
        waves[0].enemies.push({ ...en, count: 1 });
        waves[1].enemies.push({ ...en, count: 1 });
      } else if (en.count === 3) {
        waves[0].enemies.push({ ...en, count: 1 });
        waves[1].enemies.push({ ...en, count: 1 });
        waves[2].enemies.push({ ...en, count: 1 });
      } else {
        const c1 = Math.round(en.count / 3);
        const c2 = Math.round((en.count - c1) / 2);
        const c3 = en.count - c1 - c2;
        if (c1 > 0) waves[0].enemies.push({ ...en, count: c1 });
        if (c2 > 0) waves[1].enemies.push({ ...en, count: c2 });
        if (c3 > 0) waves[2].enemies.push({ ...en, count: c3 });
      }
    });
  }

  // Filter out any empty wave
  const activeWaves = waves.filter((w) => w.enemies.length > 0);
  activeWaves.forEach((w, idx) => {
    w.waveIndex = idx;
    w.isFinalWave = idx === activeWaves.length - 1;
    w.isBossWave = isBossMission && w.isFinalWave;
  });
  return activeWaves.length > 0 ? activeWaves : [waves[0]];
}

export function buildStageEnvironment(mission: Mission, scene: THREE.Scene): CoverObject[] {
  const theme = getStageTheme(mission.id);
  const sceneryCfg = SCENERY_CONFIG[theme.scenery];
  const coverObjects: CoverObject[] = [];
  const arenaSize = 80;

  // 1. Atmosphere: sky dome, fog and set dressing matching the stage name
  scene.background = new THREE.Color(sceneryCfg.fogColor);
  scene.fog = new THREE.FogExp2(sceneryCfg.fogColor, sceneryCfg.fogDensity);
  scene.userData.stageScenery = buildScenery(theme.scenery, scene, theme.accentColor);

  // 2. Floor with distinctive style & procedural texture
  const stageTex = createStageTextures(theme);

  const floorGeo = new THREE.PlaneGeometry(arenaSize, arenaSize);
  const floorMat = stageMaterial(stageTex.floor, { metalness: Math.min(theme.floorMetalness, 0.55), bumpScale: 2.6 });
  floorMat.color.set(sceneryCfg.floorTint);
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  // Luminous Grid Helper (kept subtle so the floor material reads through)
  const grid = new THREE.GridHelper(arenaSize, 40, theme.gridMain, theme.gridSub);
  grid.position.y = 0.02;
  (grid.material as THREE.Material).transparent = true;
  (grid.material as THREE.Material).opacity = sceneryCfg.gridOpacity;
  (grid.material as THREE.Material).depthWrite = false;
  scene.add(grid);

  // 3. Perimeter walls, height per stage (low railings for open-air stages, full height indoors)
  const wallH = sceneryCfg.wallHeight;
  const wallMaps = stageTex.wall;
  const [wallRx, wallRy] = sceneryCfg.wallRepeat ?? [8, Math.max(0.2, (2 * wallH) / 12)];
  [wallMaps.map, wallMaps.bumpMap, wallMaps.roughnessMap, wallMaps.emissiveMap].forEach((t) => t.repeat.set(wallRx, wallRy));
  const wallMat = stageMaterial(wallMaps, { metalness: 0.3, bumpScale: 3.0 });
  const accentNeonMat = new THREE.MeshBasicMaterial({ color: theme.accentColor });
  const stripY = Math.min(2.0, wallH - 0.25);

  const buildWall = (w: number, h: number, d: number, x: number, y: number, z: number, isHoriz: boolean) => {
    const wallMesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
    wallMesh.position.set(x, y, z);
    scene.add(wallMesh);

    // Neon stripe on wall
    const stripGeo = new THREE.BoxGeometry(isHoriz ? w : 0.4, 0.28, isHoriz ? 0.4 : d);
    const strip = new THREE.Mesh(stripGeo, accentNeonMat);
    strip.position.set(x, stripY, z);
    scene.add(strip);

    const baseStripGeo = new THREE.BoxGeometry(isHoriz ? w : 0.35, 0.22, isHoriz ? 0.35 : d);
    const baseStrip = new THREE.Mesh(baseStripGeo, accentNeonMat);
    baseStrip.position.set(x, 0.3, z);
    scene.add(baseStrip);
  };

  buildWall(arenaSize, wallH, 1.2, 0, wallH / 2, -arenaSize / 2, true);
  buildWall(arenaSize, wallH, 1.2, 0, wallH / 2, arenaSize / 2, true);
  buildWall(1.2, wallH, arenaSize, arenaSize / 2, wallH / 2, 0, false);
  buildWall(1.2, wallH, arenaSize, -arenaSize / 2, wallH / 2, 0, false);

  // 4. Accent Point Lights in 4 corners of arena
  const cornerOffsets = [
    [-24, 7, -24],
    [24, 7, -24],
    [-24, 7, 24],
    [24, 7, 24],
  ];
  cornerOffsets.forEach(([lx, ly, lz]) => {
    const pLight = new THREE.PointLight(sceneryCfg.cornerLight[0], sceneryCfg.cornerLight[1], 48);
    pLight.position.set(lx, ly, lz);
    scene.add(pLight);
  });

  // 5. STAGE-THEMED COVER OBJECTS BUILDER
  const addCover = (
    group: THREE.Group,
    centerX: number,
    centerZ: number,
    width: number,
    depth: number,
    height: number
  ) => {
    group.position.set(centerX, 0, centerZ);
    scene.add(group);
    coverObjects.push({
      mesh: group,
      box: {
        minX: centerX - width / 2,
        maxX: centerX + width / 2,
        minZ: centerZ - depth / 2,
        maxZ: centerZ + depth / 2,
        height,
      },
    });
  };

  // COVER 1 & 2: Center Tactical Barricades (x: -9, 0) and (x: 9, 0)
  [-9, 9].forEach((cx) => {
    const group = new THREE.Group();
    const w = 5.2;
    const d = 1.6;
    const h = 2.2;

    const base = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      stageMaterial(stageTex.panel, { metalness: 0.65 })
    );
    base.position.y = h / 2;
    group.add(base);

    // Glowing Neon Rim
    const topBar = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.1, 0.16, d + 0.1),
      new THREE.MeshBasicMaterial({ color: theme.accentColor })
    );
    topBar.position.y = h + 0.08;
    group.add(topBar);

    // Tech plating vents
    [-1.5, 1.5].forEach((vx) => {
      const vent = new THREE.Mesh(
        new THREE.BoxGeometry(1.3, 1.0, d + 0.14),
        new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.85, roughness: 0.2 })
      );
      vent.position.set(vx, h / 2, 0);
      group.add(vent);
    });

    addCover(group, cx, 0, w, d, h);
  });

  // COVER 3 & 4: Forward Flank Themed Mega Pillars / Towers (x: -16, z: -14) and (x: 16, z: -14)
  [-16, 16].forEach((px) => {
    const group = new THREE.Group();
    const w = 3.6;
    const d = 3.6;
    const h = 6.8;

    if (theme.style === 'cathedral' || theme.style === 'sanctuary') {
      // Gothic Octagonal Pillar
      const pillar = new THREE.Mesh(
        new THREE.CylinderGeometry(1.6, 1.9, h, 8),
        stageMaterial(stageTex.panel, { metalness: 0.45 })
      );
      pillar.position.y = h / 2;
      group.add(pillar);

      // Gold/Neon Accent Rings
      [2.0, 4.8].forEach((ry) => {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(1.88, 0.09, 8, 20),
          new THREE.MeshBasicMaterial({ color: theme.accentColor })
        );
        ring.rotation.x = Math.PI / 2;
        ring.position.y = ry;
        group.add(ring);
      });
    } else if (theme.style === 'foundry') {
      // Industrial Smelter Core Block
      const block = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        new THREE.MeshStandardMaterial({ color: 0x1f140e, metalness: 0.75, roughness: 0.35 })
      );
      block.position.y = h / 2;
      group.add(block);

      const moltenCore = new THREE.Mesh(
        new THREE.BoxGeometry(w * 0.75, h * 0.42, d + 0.12),
        new THREE.MeshBasicMaterial({ color: 0xf97316 })
      );
      moltenCore.position.y = h / 2;
      group.add(moltenCore);
    } else if (theme.style === 'abyss') {
      // Barnacled coral spire with a bioluminescent core
      const spire = new THREE.Mesh(
        new THREE.CylinderGeometry(1.0, 1.9, h, 7),
        stageMaterial(stageTex.panel, { metalness: 0.25 })
      );
      spire.position.y = h / 2;
      group.add(spire);
      [1.8, 3.6, 5.3].forEach((ry, i) => {
        const bulb = new THREE.Mesh(
          new THREE.SphereGeometry(0.34 - i * 0.04, 10, 8),
          new THREE.MeshBasicMaterial({ color: theme.accentColor })
        );
        bulb.position.set(Math.cos(i * 2.1) * (1.55 - i * 0.28), ry, Math.sin(i * 2.1) * (1.55 - i * 0.28));
        group.add(bulb);
      });
    } else if (theme.style === 'relic') {
      // Cracked glass crystal pillar
      const crystal = new THREE.Mesh(
        new THREE.OctahedronGeometry(2.0, 0),
        new THREE.MeshStandardMaterial({ color: 0x2b2147, metalness: 0.6, roughness: 0.12, emissive: theme.accentColor, emissiveIntensity: 0.25 })
      );
      crystal.scale.set(0.85, h / 4, 0.85);
      crystal.position.y = h / 2;
      group.add(crystal);
      const seam = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, h * 0.7, 0.1),
        new THREE.MeshBasicMaterial({ color: theme.accentColor })
      );
      seam.position.set(0, h / 2, 1.0);
      group.add(seam);
    } else if (theme.style === 'cryo') {
      // Frozen data column: rimed steel core wrapped in a faceted ice crystal with a cyan status strip
      const core = new THREE.Mesh(
        new THREE.CylinderGeometry(0.9, 1.3, h, 6),
        new THREE.MeshStandardMaterial({ color: 0x24384c, metalness: 0.8, roughness: 0.35 })
      );
      core.position.y = h / 2;
      group.add(core);
      const ice = new THREE.Mesh(
        new THREE.OctahedronGeometry(2.0, 0),
        new THREE.MeshPhysicalMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.55, metalness: 0.1, roughness: 0.06, clearcoat: 1, emissive: theme.accentColor, emissiveIntensity: 0.3, flatShading: true })
      );
      ice.scale.set(0.95, h / 4.4, 0.95);
      ice.position.y = h / 2;
      group.add(ice);
      const strip = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, h * 0.7, 0.1),
        new THREE.MeshBasicMaterial({ color: theme.accentColor })
      );
      strip.position.set(0, h / 2, 1.0);
      group.add(strip);
    } else if (theme.style === 'monolith' || theme.style === 'omega') {
      // Obsidian Obelisk Monolith
      const mono = new THREE.Mesh(
        new THREE.CylinderGeometry(1.3, 1.9, h, 4),
        new THREE.MeshStandardMaterial({ color: 0x050508, metalness: 0.95, roughness: 0.1 })
      );
      mono.rotation.y = Math.PI / 4;
      mono.position.y = h / 2;
      group.add(mono);

      const rune = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, h * 0.75, 0.14),
        new THREE.MeshBasicMaterial({ color: theme.accentColor })
      );
      rune.position.set(0, h / 2, 1.45);
      group.add(rune);
    } else {
      // High-Tech Fortified Battery Tower
      const tower = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        stageMaterial(stageTex.panel, { metalness: 0.8 })
      );
      tower.position.y = h / 2;
      group.add(tower);

      const neonBand = new THREE.Mesh(
        new THREE.BoxGeometry(w + 0.12, 0.32, d + 0.12),
        new THREE.MeshBasicMaterial({ color: theme.accentColor })
      );
      neonBand.position.y = h * 0.65;
      group.add(neonBand);
    }

    addCover(group, px, -14, w, d, h);
  });

  // COVER 5 & 6: Rear Logistics & Supply Crates (x: -14, z: 14) and (x: 14, z: 14)
  [-14, 14].forEach((rx) => {
    const group = new THREE.Group();
    const w = 4.0;
    const d = 2.6;
    const h = 2.2;

    const block = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      stageMaterial(stageTex.panel, { metalness: 0.7 })
    );
    block.position.y = h / 2;
    group.add(block);

    const lid = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.14, 0.16, d + 0.14),
      new THREE.MeshBasicMaterial({ color: theme.accentColor })
    );
    lid.position.y = h;
    group.add(lid);

    addCover(group, rx, 14, w, d, h);
  });

  // COVER 7 & 8: Lateral Heavy Arch Bunkers (x: -25, z: 0) and (x: 25, z: 0)
  [-25, 25].forEach((lx) => {
    const group = new THREE.Group();
    const w = 3.4;
    const d = 6.6;
    const h = 4.8;

    const bunker = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      stageMaterial(stageTex.panel, { metalness: 0.65 })
    );
    bunker.position.y = h / 2;
    group.add(bunker);

    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.12, 0.28, d + 0.12),
      new THREE.MeshBasicMaterial({ color: theme.accentColor })
    );
    strip.position.y = h * 0.55;
    group.add(strip);

    addCover(group, lx, 0, w, d, h);
  });

  // COVER 9: Deep Central Command Monolith / Shrine (x: 0, z: -28)
  {
    const group = new THREE.Group();
    const w = 7.2;
    const d = 3.4;
    const h = 3.8;

    const commandBase = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      stageMaterial(stageTex.panel, { metalness: 0.8 })
    );
    commandBase.position.y = h / 2;
    group.add(commandBase);

    // Glowing core crystal / display
    const coreCrystal = new THREE.Mesh(
      new THREE.OctahedronGeometry(1.2, 0),
      new THREE.MeshBasicMaterial({ color: theme.accentColor })
    );
    coreCrystal.position.set(0, h + 1.25, 0);
    group.add(coreCrystal);

    const beaconLight = new THREE.PointLight(theme.accentColor, 2.8, 22);
    beaconLight.position.set(0, h + 1.25, 0);
    group.add(beaconLight);

    addCover(group, 0, -28, w, d, h);
  }

  // COVER 10 & 11: Tactical Flank Mid-Cover Crates (x: -12, z: -4) and (x: 12, z: -4)
  [-12, 12].forEach((tx) => {
    const group = new THREE.Group();
    const w = 2.4;
    const d = 2.4;
    const h = 1.8;

    const crate = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      stageMaterial(stageTex.panel, { metalness: 0.8 })
    );
    crate.position.y = h / 2;
    group.add(crate);

    const rim = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.08, 0.12, d + 0.08),
      new THREE.MeshBasicMaterial({ color: theme.accentColor })
    );
    rim.position.y = h;
    group.add(rim);

    addCover(group, tx, -4, w, d, h);
  });

  return coverObjects;
}

// Procedural, per-enemy surface patterns: each archetype gets a readable material texture.
function createEnemySurfaceTexture(type: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const palettes: Record<string, [string, string, string]> = {
    hound: ['#172536', '#64748b', '#ef4444'], drone: ['#071a27', '#0e7490', '#67e8f9'],
    sentry: ['#202a35', '#94a3b8', '#f87171'], stalker: ['#24113a', '#a855f7', '#e9d5ff'],
    golem: ['#293746', '#64748b', '#fb923c'], titan: ['#101923', '#475569', '#ef4444'],
    boss: ['#09090b', '#334155', '#38bdf8'],
    raptor: ['#0b2530', '#155e75', '#22d3ee'], mauler: ['#1c1410', '#78350f', '#f97316'],
    seeker: ['#1f1b24', '#4c1d3a', '#fb7185'], gunship: ['#111827', '#3730a3', '#a5b4fc'],
    scorpion: ['#1a1a1a', '#713f12', '#facc15'], wraith: ['#042f2e', '#0f766e', '#5eead4'],
    bulwark: ['#18181b', '#52525b', '#38bdf8'], howitzer: ['#14201a', '#3f5a3f', '#ef4444'],
  };
  const [base, metal, glow] = palettes[type] || palettes.boss;
  type = baseCategoryOf(type);
  ctx.fillStyle = base; ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = metal; ctx.lineWidth = 3;
  // Panel seams and fine industrial crosshatching
  for (let y = 16; y < 256; y += 32) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y); ctx.stroke(); }
  for (let x = 16; x < 256; x += 48) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 256); ctx.stroke(); }
  ctx.strokeStyle = glow; ctx.lineWidth = 5;
  if (type === 'hound') { for (let i=0;i<5;i++){ctx.beginPath();ctx.moveTo(20+i*48,35);ctx.lineTo(42+i*48,56);ctx.lineTo(20+i*48,77);ctx.stroke();} }
  else if (type === 'drone') { for(let r=18;r<120;r+=28){ctx.beginPath();ctx.arc(128,128,r,0,Math.PI*2);ctx.stroke();} }
  else if (type === 'sentry') { for(let i=0;i<6;i++){ctx.beginPath();ctx.moveTo(20+i*40,20);ctx.lineTo(20+i*40,236);ctx.stroke();} }
  else if (type === 'stalker') { for(let i=0;i<7;i++){ctx.beginPath();ctx.moveTo(i*40,0);ctx.lineTo(256-i*25,256);ctx.stroke();} }
  else if (type === 'golem') { for(let i=0;i<9;i++){ctx.beginPath();ctx.moveTo(0,i*31);ctx.lineTo(80+(i%3)*40,i*31+18);ctx.lineTo(256,i*31-8);ctx.stroke();} }
  else { for(let i=0;i<8;i++){ctx.beginPath();ctx.moveTo(i*36,0);ctx.lineTo(i*36+24,256);ctx.stroke();} }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace; texture.needsUpdate = true;
  return texture;
}

// Stage-based progression difficulty multiplier
// Increases enemy HP smoothly as the player advances through missions (7 stages per map)
const STAGE_DIFFICULTY: Record<string, number> = {
  // MAP 1: Gothic Metropolis
  m1_apartments: 1.0, m1b_market: 1.09, m2_sanctuary: 1.18, m2b_aqueduct: 1.27,
  m3_foundry: 1.35, m3b_belfry: 1.45, m4_nave: 1.55,
  // MAP 2: Orbital Citadel
  m5_spire: 1.75, m5b_skybridge: 1.85, m6_dock: 1.95, m6b_relay: 2.06,
  m7_monolith: 2.18, m7b_arsenal: 2.31, m8_dock_boss: 2.45,
  // MAP 3: Deep Research Sector
  m9_rift: 2.70, m9b_biolab: 2.82, m10_observatory: 2.95, m10b_archive: 3.08,
  m11_antimatter: 3.20, m11b_reactor: 3.34, m12_omega_boss: 3.50,
  // MAP 4: Tidal Ruins
  m13_harbor: 3.72, m13b_reef: 3.84, m14_whalefall: 3.97, m14b_vents: 4.10,
  m15_aquarium: 4.23, m15b_trench: 4.37, m16_kraken_boss: 4.55,
  // MAP 5: Silent Wastes
  m17_dunes: 4.80, m17b_graveyard: 4.95, m18_clockwork: 5.10, m18b_crater: 5.26,
  m19_chapel: 5.42, m19b_gate: 5.58, m20_warden_boss: 5.80,
  // MAP 6: Frozen Archive
  m21_outskirts: 6.00, m21b_cryobay: 6.16, m22_stacks: 6.32, m22b_servers: 6.48,
  m23_echohall: 6.64, m23b_conduit: 6.80, m24_frost_boss: 7.05,
};

/** ハードモード: 同じMAP内の同じ位置のステージから3MAP(=21ステージ)先の難易度になる */
const HARD_STAGE_OFFSET = 21;
const STAGE_ORDER = Object.keys(STAGE_DIFFICULTY);

function getMissionDifficultyMultiplier(mission?: Mission, hard = false): number {
  if (!mission) return 1.0;
  const ramp = STAGE_DIFFICULTY[mission.id];
  if (hard && ramp !== undefined) {
    const idx = STAGE_ORDER.indexOf(mission.id) + HARD_STAGE_OFFSET;
    if (idx < STAGE_ORDER.length) return STAGE_DIFFICULTY[STAGE_ORDER[idx]];
    // MAP5を超える分は、MAP5終盤の上昇ペースで外挿
    return STAGE_DIFFICULTY[STAGE_ORDER[STAGE_ORDER.length - 1]] + (idx - (STAGE_ORDER.length - 1)) * 0.2;
  }
  if (ramp !== undefined) return ramp;
  const threat = mission.threatLevel || 1;
  const map = (mission.mapId || 1) + (hard ? 3 : 0);
  return 1.0 + (map - 1) * 0.65 + (threat - 1) * 0.22;
}

// ───────────────────────── Procedural enemy models ─────────────────────────
// Every enemy faces -Z. Models are built from layered armor, joints and emissive details.

export function buildEnemyModel(type: string, group: THREE.Group): { hp: number; speed: number; damage: number } {
  const bossKind = bossKindOf(type);
  if (bossKind) return buildBossModel(bossKind, group);
  const elite = buildEliteEnemy(type, group);
  if (elite) return elite;
  const apex = buildApexEnemy(type, group);
  if (apex) return apex;
  const std = (color: number, metalness = 0.82, roughness = 0.38) => new THREE.MeshStandardMaterial({ color, metalness, roughness });
  const glow = (color: number) => new THREE.MeshBasicMaterial({ color });
  const halo = (color: number, opacity = 0.28) => new THREE.MeshBasicMaterial({
    color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const add = (
    parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material,
    x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0
  ) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    parent.add(m);
    return m;
  };
  const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
  const cyl = (rt: number, rb: number, h: number, seg = 10) => new THREE.CylinderGeometry(rt, rb, h, seg);
  const cone = (r: number, h: number, seg = 6) => new THREE.ConeGeometry(r, h, seg);
  const sph = (r: number, seg = 12) => new THREE.SphereGeometry(r, seg, Math.max(6, seg - 4));

  /** Cylinder strut between two points (for limbs / pistons). */
  const limb = (parent: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3, r: number, mat: THREE.Material) => {
    const dir = new THREE.Vector3().subVectors(b, a);
    const len = dir.length();
    const m = new THREE.Mesh(cyl(r, r * 0.9, len, 8), mat);
    m.position.copy(a).addScaledVector(dir, 0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    parent.add(m);
    return m;
  };
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

  // ── animation rig: everything except planted legs lives in `body` so it can bob / lean / lunge ──
  const rig: EnemyRig = createRig(type);
  group.userData.enemyRig = rig;
  const root = group;
  const body = new THREE.Group();
  root.add(body);
  rig.body = body;
  group = body;

  /** Two-segment articulated limb: pivots at `a` (hip/shoulder) and `b` (knee/elbow), ends at `c`.
   *  Meshes are built in pivot-local space; `onUp` / `onLow` add extras using the same model-space coordinates. */
  const artic = (
    parent: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3,
    rU: number, rL: number, mU: THREE.Material, mL: THREE.Material, kneeR = 0, kneeMat?: THREE.Material,
  ) => {
    const up = new THREE.Group(); up.position.copy(a); parent.add(up);
    const low = new THREE.Group(); low.position.copy(b).sub(a); up.add(low);
    limb(up, V(0, 0, 0), b.clone().sub(a), rU, mU);
    if (kneeR > 0) add(low, sph(kneeR, 8), kneeMat ?? mL, 0, 0, 0);
    limb(low, V(0, 0, 0), c.clone().sub(b), rL, mL);
    const onUp = (geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) =>
      add(up, geo, mat, x - a.x, y - a.y, z - a.z, rx, ry, rz);
    const onLow = (geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) =>
      add(low, geo, mat, x - b.x, y - b.y, z - b.z, rx, ry, rz);
    return { up, low, onUp, onLow };
  };
  const addLeg = (j: { up: THREE.Object3D; low: THREE.Object3D }, phase: number, amp = 1) => { rig.legs.push({ up: j.up, low: j.low, phase, amp }); };
  const addArm = (j: { up: THREE.Object3D; low: THREE.Object3D }, phase: number, amp = 1) => { rig.arms.push({ up: j.up, low: j.low, phase, amp }); };
  /** pivot group at (x,y,z) so a part can sway / recoil / spin about that point */
  const pivot = (parent: THREE.Object3D, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };

  // ───────────── HOUND: armored cyber-wolf ─────────────
  if (type === 'hound') {
    const dark = std(0x1e293b, 0.88, 0.3), plate = std(0x475569, 0.85, 0.3), joint = std(0x0f172a, 0.6, 0.5);
    add(group, box(0.62, 0.38, 1.1), dark, 0, 0.72, 0.05);
    add(group, box(0.72, 0.3, 0.55), plate, 0, 0.8, -0.3, 0.12, 0, 0); // chest armor
    add(group, box(0.56, 0.2, 0.5), plate, 0, 0.86, 0.4);               // haunch armor
    add(group, box(0.12, 0.1, 0.9), joint, 0, 0.5, 0.05);               // belly spine
    for (let i = 0; i < 4; i++) add(group, cone(0.06, 0.2 + (i % 2) * 0.05, 4), std(0x94a3b8), 0, 0.98, -0.3 + i * 0.22, 0, 0, 0); // back fins
    for (let i = 0; i < 3; i++) add(group, box(0.64, 0.02, 0.03), glow(0xef4444), 0, 0.92, -0.05 + i * 0.2); // glowing seams
    // neck + head
    add(group, cyl(0.12, 0.16, 0.4, 8), joint, 0, 0.9, -0.62, 0.9, 0, 0);
    const head = new THREE.Group(); head.position.set(0, 0.98, -0.88); group.add(head);
    add(head, box(0.34, 0.28, 0.4), dark, 0, 0, 0);
    add(head, box(0.22, 0.16, 0.34), plate, 0, -0.02, -0.34);              // snout
    const jaw = pivot(head, 0, -0.1, -0.12);
    add(jaw, box(0.2, 0.05, 0.3), std(0x0f172a), 0, -0.04, -0.18, 0.12, 0, 0); // jaw
    rig.jaw = jaw;
    rig.head = head;
    [-1, 1].forEach((s) => {
      add(head, box(0.05, 0.05, 0.12), glow(0xef4444), s * 0.1, 0.05, -0.2);          // eyes
      add(head, cone(0.06, 0.3, 4), plate, s * 0.13, 0.26, 0.08, -0.35, 0, s * -0.2);  // ears / blades
      add(head, cone(0.02, 0.07, 4), glow(0xf8fafc), s * 0.07, -0.18, -0.44, Math.PI, 0, 0); // fangs
    });
    // legs: thigh -> shin -> paw
    [[-0.3, -0.35], [0.3, -0.35], [-0.3, 0.45], [0.3, 0.45]].forEach(([lx, lz], idx) => {
      const back = idx >= 2;
      const hip = V(lx, 0.68, lz), knee = V(lx * 1.25, 0.4, lz + (back ? 0.2 : -0.12)), foot = V(lx * 1.25, 0.04, lz + (back ? -0.02 : -0.1));
      const j = artic(root, hip, knee, foot, 0.07, 0.05, plate, dark, 0.075, joint);
      j.onLow(box(0.12, 0.05, 0.22), std(0x94a3b8), foot.x, 0.025, foot.z - 0.05);
      addLeg(j, idx === 0 || idx === 3 ? 0 : Math.PI, back ? 0.9 : 1); // diagonal gallop
    });
    // tail + exhausts
    const tail = pivot(group, 0, 0.8, 0.6);
    limb(tail, V(0, 0, 0), V(0, 0.25, 0.45), 0.045, joint);
    add(tail, cone(0.07, 0.22, 4), glow(0xef4444), 0, 0.32, 0.55, Math.PI / 2 + 0.4, 0, 0);
    rig.tails.push({ obj: tail, phase: 0, amp: 1 });
    rig.gait = { freq: 1.25, swing: 0.75, knee: 0.9, bob: 0.05, lean: 0.07 };
    rig.lunge = 0.4;
    [-0.2, 0.2].forEach((x) => { add(group, cyl(0.07, 0.09, 0.26, 8), glow(0xf97316), x, 0.76, 0.66, Math.PI / 2, 0, 0); });
    return { hp: 135, speed: 6.8, damage: 15 };
  }

  // ───────────── DRONE: quad-rotor recon orb ─────────────
  if (type === 'drone') {
    const dark = std(0x0f172a, 0.9, 0.2), hull = std(0x155e75, 0.85, 0.3);
    add(group, new THREE.OctahedronGeometry(0.5, 1), dark);
    add(group, new THREE.IcosahedronGeometry(0.58, 0), halo(0x06b6d4, 0.12));
    const ringA = pivot(group); add(ringA, new THREE.TorusGeometry(0.68, 0.035, 8, 28), glow(0x06b6d4), 0, 0, 0, Math.PI / 2, 0, 0);
    const ringB = pivot(group); add(ringB, new THREE.TorusGeometry(0.56, 0.03, 8, 28), glow(0x67e8f9), 0, 0, 0, 0.4, 0, 0.5);
    rig.spinners.push({ obj: ringA, axis: 'x', speed: 1.4 }, { obj: ringB, axis: 'z', speed: -2.0 });
    // eye lens
    add(group, cyl(0.2, 0.2, 0.08, 16), std(0x020617, 0.6, 0.2), 0, 0, -0.44, Math.PI / 2, 0, 0);
    rig.pulses.push({ obj: add(group, sph(0.12, 12), glow(0x38bdf8), 0, 0, -0.5), amp: 1.4 });
    add(group, sph(0.05, 8), glow(0xffffff), 0, 0, -0.56);
    // rotor arms
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2 + Math.PI / 4;
      const x = Math.cos(a), z = Math.sin(a);
      add(group, box(0.1, 0.08, 0.7), hull, x * 0.55, 0.02, z * 0.55, 0, -a + Math.PI / 2, 0);
      add(group, cyl(0.1, 0.12, 0.14, 10), dark, x * 0.92, 0.02, z * 0.92);
      const rotor = pivot(group, x * 0.92, 0.12, z * 0.92);
      add(rotor, new THREE.CircleGeometry(0.36, 20), new THREE.MeshBasicMaterial({ color: 0x67e8f9, transparent: true, opacity: 0.22, side: THREE.DoubleSide }), 0, 0, 0, -Math.PI / 2, 0, 0);
      add(rotor, box(0.7, 0.012, 0.05), glow(0x67e8f9), 0, 0, 0, 0, a, 0);
      add(rotor, box(0.7, 0.012, 0.05), glow(0x67e8f9), 0, 0, 0, 0, a + Math.PI / 2, 0);
      rig.spinners.push({ obj: rotor, axis: 'y', speed: (i % 2 ? -1 : 1) * 24 });
    }
    // underslung gun pods + top antenna
    [-0.18, 0.18].forEach((x) => {
      add(group, box(0.1, 0.1, 0.3), hull, x, -0.42, -0.1);
      rig.recoils.push({ obj: add(group, cyl(0.025, 0.025, 0.24, 6), std(0x94a3b8), x, -0.42, -0.34, Math.PI / 2, 0, 0), amp: 0.5 });
    });
    add(group, cyl(0.015, 0.03, 0.4, 6), std(0x94a3b8), 0, 0.65, 0.1);
    add(group, sph(0.05, 8), glow(0xef4444), 0, 0.88, 0.1);
    rig.hover = { bob: 0.06, tilt: 0.05 };
    rig.lunge = 0.2;
    return { hp: 105, speed: 5.2, damage: 16 };
  }

  // ───────────── SENTRY: fortified turret walker ─────────────
  if (type === 'sentry') {
    const dark = std(0x0f172a, 0.92, 0.28), plate = std(0x64748b, 0.8, 0.35), steel = std(0x94a3b8, 0.85, 0.3);
    add(group, cyl(0.62, 0.82, 0.22, 6), std(0x1e293b, 0.9, 0.3), 0, 0.11, 0);
    add(group, new THREE.TorusGeometry(0.68, 0.03, 6, 6), glow(0xef4444), 0, 0.24, 0, Math.PI / 2, 0, 0);
    for (let i = 0; i < 3; i++) { // tripod legs
      const a = i * (Math.PI * 2 / 3) + Math.PI / 2;
      const hip = V(Math.cos(a) * 0.3, 0.45, Math.sin(a) * 0.3), foot = V(Math.cos(a) * 0.85, 0.05, Math.sin(a) * 0.85);
      const knee = V(Math.cos(a) * 0.72, 0.5, Math.sin(a) * 0.72);
      const j = artic(root, hip, knee, foot, 0.05, 0.045, plate, plate, 0.06, dark);
      j.onLow(box(0.18, 0.04, 0.22), steel, Math.cos(a) * 0.88, 0.02, Math.sin(a) * 0.88, 0, -a, 0);
      addLeg(j, i * (Math.PI * 2 / 3), 0.55);
    }
    add(group, cyl(0.22, 0.3, 0.36, 8), dark, 0, 0.42, 0);
    // rotating-style turret head
    const head = new THREE.Group(); head.position.set(0, 0.85, 0); group.add(head);
    rig.scanners.push({ obj: head, phase: 0, amp: 1 });
    add(head, box(0.7, 0.46, 0.7), dark, 0, 0, 0);
    add(head, box(0.5, 0.3, 0.3), plate, 0, 0.05, -0.45, 0.2, 0, 0);          // sloped front glacis
    add(head, box(0.78, 0.1, 0.5), plate, 0, 0.28, 0.05);                       // roof plate
    [-1, 1].forEach((s) => {
      add(head, box(0.14, 0.4, 0.62), plate, s * 0.42, 0, 0);                    // side armor
      const gun = pivot(head);
      rig.recoils.push({ obj: gun, amp: 0.8 });
      add(gun, cyl(0.045, 0.05, 1.0, 8), steel, s * 0.17, -0.02, -0.82, Math.PI / 2, 0, 0); // barrels
      add(gun, cyl(0.07, 0.07, 0.14, 8), dark, s * 0.17, -0.02, -1.3, Math.PI / 2, 0, 0);   // muzzle brake
      rig.pulses.push({ obj: add(gun, sph(0.04, 8), glow(0xef4444), s * 0.17, -0.02, -1.4), amp: 2 });
      add(gun, cyl(0.07, 0.07, 0.3, 8), steel, s * 0.17, -0.02, -0.5, Math.PI / 2, 0, 0);   // barrel shroud
    });
    add(head, cyl(0.09, 0.09, 0.08, 12), std(0x020617), 0, 0.12, -0.6, Math.PI / 2 - 0.2, 0, 0); // sensor lens
    add(head, sph(0.06, 8), glow(0xef4444), 0, 0.15, -0.64);
    const ant = pivot(head, 0.28, 0.25, 0.25);
    add(ant, cyl(0.02, 0.035, 0.5, 6), steel, 0, 0.25, 0);
    add(ant, sph(0.08, 8), glow(0xef4444), 0, 0.53, 0);
    rig.flutters.push({ obj: ant, phase: 1.3, amp: 0.8, speed: 1.4 });
    add(head, box(0.5, 0.2, 0.2), std(0x1e293b), 0, 0.02, 0.45);  // ammo drum
    rig.gait = { freq: 0.8, swing: 0.5, knee: 0.5, bob: 0.015, lean: 0.02 };
    rig.lunge = 0.08;
    return { hp: 195, speed: 4.4, damage: 38 };
  }

  // ───────────── STALKER: phantom assassin ─────────────
  if (type === 'stalker') {
    const ghost = new THREE.MeshStandardMaterial({ color: 0x9333ea, transparent: true, opacity: 0.55, metalness: 0.8, roughness: 0.15 });
    const dark = std(0x2e1065, 0.85, 0.3), core = glow(0xd8b4fe);
    add(group, box(0.5, 0.7, 0.3), ghost, 0, 1.25, 0);
    add(group, box(0.36, 0.3, 0.34), dark, 0, 0.78, 0);                           // waist
    rig.pulses.push({ obj: add(group, box(0.3, 0.32, 0.12), core, 0, 1.3, -0.17), amp: 1.2 });                         // chest crystal
    add(group, new THREE.OctahedronGeometry(0.26, 0), halo(0xc084fc, 0.2), 0, 1.3, -0.2);
    add(group, new THREE.OctahedronGeometry(0.22, 0), ghost, 0, 1.82, 0);          // head
    add(group, box(0.26, 0.05, 0.05), glow(0xf0abfc), 0, 1.84, -0.19);              // visor
    [-1, 1].forEach((s) => {
      const arm = artic(group, V(s * 0.4, 1.45, 0), V(s * 0.5, 1.0, -0.15), V(s * 0.45, 0.72, -0.4), 0.05, 0.04, ghost, dark);
      add(arm.up, new THREE.OctahedronGeometry(0.2, 0), dark, s * -0.02, 0.05, 0);   // shoulder
      // wrist blade
      arm.onLow(box(0.03, 0.04, 0.7), glow(0xc084fc), s * 0.45, 0.72, -0.8);
      arm.onLow(cone(0.04, 0.2, 4), glow(0xf5d0fe), s * 0.45, 0.72, -1.25, -Math.PI / 2, 0, 0);
      addArm(arm, s < 0 ? Math.PI : 0, 0.9);
      // digitigrade legs
      const leg = artic(root, V(s * 0.14, 0.75, 0), V(s * 0.2, 0.42, -0.12), V(s * 0.16, 0.04, 0.05), 0.07, 0.05, ghost, dark);
      leg.onLow(cone(0.06, 0.25, 4), dark, s * 0.16, 0.03, -0.1, -Math.PI / 2, 0, 0);
      addLeg(leg, s < 0 ? 0 : Math.PI);
    });
    // trailing shroud spikes (each sways on its own)
    for (let i = 0; i < 5; i++) {
      const sp = pivot(group, (i - 2) * 0.12, 1.2 - Math.abs(i - 2) * 0.1, 0.28);
      add(sp, cone(0.06, 0.8 - i * 0.08, 4), dark, 0, 0, 0, 0.5, 0, 0);
      rig.flutters.push({ obj: sp, phase: i * 0.8, amp: 1.2 });
    }
    rig.gait = { freq: 1.3, swing: 0.8, knee: 1.0, bob: 0.07, lean: 0.08 };
    rig.lunge = 0.35;
    return { hp: 175, speed: 7.2, damage: 28 };
  }

  // ───────────── GOLEM: heavy siege brute ─────────────
  if (type === 'golem') {
    const hull = std(0x334155, 0.85, 0.4), dark = std(0x1e293b, 0.92, 0.3), steel = std(0x64748b, 0.85, 0.3);
    add(group, box(1.7, 0.5, 1.1), dark, 0, 1.0, 0);                               // pelvis
    add(group, box(1.8, 1.6, 1.3), hull, 0, 2.0, 0);                               // torso
    add(group, box(1.4, 0.7, 0.3), steel, 0, 2.5, -0.62, 0.15, 0, 0);               // chest plate
    add(group, box(1.5, 0.12, 0.2), steel, 0, 1.55, -0.62);
    const gRing = pivot(group, 0, 1.95, -0.68); add(gRing, new THREE.TorusGeometry(0.36, 0.06, 8, 20), glow(0xf97316));
    rig.spinners.push({ obj: gRing, axis: 'z', speed: 1.6 });
    rig.pulses.push({ obj: add(group, sph(0.26, 12), glow(0xfb923c), 0, 1.95, -0.66), amp: 1.3 });
    rig.pulses.push({ obj: add(group, sph(0.46, 12), halo(0xf97316, 0.22), 0, 1.95, -0.66), amp: 1.3, phase: 0.6 });
    for (let i = 0; i < 4; i++) add(group, box(1.2, 0.05, 0.05), glow(0xf97316), 0, 2.45 - i * 0.08, 0.68); // back vents
    const gHead = pivot(group, 0, 2.95, -0.05); rig.head = gHead;
    add(gHead, box(0.5, 0.35, 0.5), dark, 0, 0, 0);                          // head
    add(gHead, box(0.36, 0.06, 0.1), glow(0xf97316), 0, 0.02, -0.25);                // eye slit
    add(gHead, box(0.12, 0.3, 0.2), steel, 0, 0.3, 0.15);
    [-1, 1].forEach((s) => {
      const arm = artic(group, V(s * 1.15, 2.5, 0), V(s * 1.3, 1.6, -0.1), V(s * 1.25, 0.85, -0.5), 0.2, 0.22, hull, dark, 0.2, dark);
      arm.onUp(new THREE.DodecahedronGeometry(0.5, 0), steel, s * 1.15, 2.7, 0);                // pauldron
      arm.onUp(box(0.1, 0.5, 0.1), glow(0xf97316), s * 1.15, 2.7, -0.42);
      arm.onLow(box(0.5, 0.46, 0.5), steel, s * 1.25, 0.65, -0.55);                             // fist
      for (let i = -1; i <= 1; i++) arm.onLow(box(0.1, 0.12, 0.2), std(0x94a3b8), s * 1.25 + i * 0.15, 0.62, -0.88);
      addArm(arm, s < 0 ? Math.PI : 0, 0.8);
      const leg = artic(root, V(s * 0.5, 1.0, 0), V(s * 0.6, 0.5, 0.05), V(s * 0.6, 0.4, 0.05), 0.24, 0.2, hull, dark);  // thigh
      leg.onLow(box(0.5, 0.5, 0.65), dark, s * 0.6, 0.22, -0.05);                               // boot
      addLeg(leg, s < 0 ? 0 : Math.PI, 0.85);
    });
    rig.gait = { freq: 0.75, swing: 0.55, knee: 0.55, bob: 0.07, lean: 0.045 };
    rig.lunge = 0.3;
    return { hp: 390, speed: 3.8, damage: 32 };
  }

  // ───────────── TITAN: quad-legged artillery walker ─────────────
  if (type === 'titan') {
    const hull = std(0x1e293b, 0.9, 0.3), plate = std(0x334155, 0.85, 0.35), steel = std(0x64748b, 0.85, 0.3);
    add(group, box(2.5, 0.9, 2.8), hull, 0, 2.0, 0);                                  // chassis
    add(group, box(2.2, 0.35, 2.4), plate, 0, 2.55, 0.05);                              // deck
    add(group, box(2.0, 0.8, 0.8), plate, 0, 1.95, -1.55, 0.3, 0, 0);                   // wedge prow
    add(group, box(1.2, 0.12, 0.1), glow(0xef4444), 0, 2.1, -1.95);
    add(group, box(0.8, 0.5, 0.08), glow(0xef4444), 0, 1.8, -1.42);
    // turret
    const turret = new THREE.Group(); turret.position.set(0, 2.95, 0.1); group.add(turret);
    rig.scanners.push({ obj: turret, phase: 0, amp: 0.8 });
    add(turret, cyl(0.9, 1.0, 0.5, 8), plate, 0, 0, 0);
    add(turret, box(1.1, 0.4, 1.0), hull, 0, 0.4, 0);
    [-1, 1].forEach((s) => {
      const tube = pivot(turret);
      rig.recoils.push({ obj: tube, amp: 1.2 });
      add(tube, cyl(0.17, 0.2, 1.7, 10), steel, s * 0.65, 0.65, -0.35, Math.PI / 2 + 0.45, 0, 0);   // mortar tubes
      add(tube, cyl(0.24, 0.24, 0.2, 10), hull, s * 0.65, 1.1, -1.05, Math.PI / 2 + 0.45, 0, 0);    // muzzle
      rig.pulses.push({ obj: add(tube, sph(0.1, 8), glow(0xef4444), s * 0.65, 1.2, -1.18), amp: 2 });
    });
    add(turret, cyl(0.02, 0.04, 0.8, 6), steel, 0.6, 0.85, 0.5);
    add(turret, sph(0.07, 8), glow(0xef4444), 0.6, 1.3, 0.5);
    // rocket pods on the flanks
    [-1, 1].forEach((s) => {
      add(group, box(0.5, 0.6, 1.1), plate, s * 1.45, 2.3, 0.2);
      for (let r = 0; r < 4; r++) add(group, cyl(0.09, 0.09, 0.1, 8), glow(0xf97316), s * 1.45 + ((r % 2) - 0.5) * 0.22, 2.2 + Math.floor(r / 2) * 0.28, -0.4, Math.PI / 2, 0, 0);
    });
    // four hydraulic legs
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
      const hip = V(sx * 1.2, 2.0, sz * 1.1), knee = V(sx * 1.85, 2.2, sz * 1.5), foot = V(sx * 2.0, 0.08, sz * 1.65);
      const j = artic(root, hip, knee, foot, 0.15, 0.12, plate, steel, 0.2, hull);
      j.onLow(cyl(0.28, 0.34, 0.12, 8), hull, foot.x, 0.06, foot.z);
      addLeg(j, sx * sz > 0 ? 0 : Math.PI, 0.7); // crawling diagonal gait
    });
    rig.gait = { freq: 0.55, swing: 0.4, knee: 0.55, bob: 0.06, lean: 0.025 };
    rig.lunge = 0.1;
    return { hp: 640, speed: 2.8, damage: 44 };
  }

  // ───────────── RAPTOR: bipedal blade-runner (hound AI) ─────────────
  if (type === 'raptor') {
    const dark = std(0x14202e, 0.88, 0.3), plate = std(0x0e7490, 0.85, 0.3), blade = std(0xcbd5e1, 0.9, 0.2);
    add(group, box(0.4, 0.42, 1.0), dark, 0, 0.95, 0.05, -0.18, 0, 0);               // slanted torso
    add(group, box(0.46, 0.2, 0.6), plate, 0, 1.08, -0.15, -0.18, 0, 0);               // back armor
    add(group, cyl(0.1, 0.14, 0.5, 8), dark, 0, 1.2, -0.6, 0.7, 0, 0);                 // neck
    const head = new THREE.Group(); head.position.set(0, 1.42, -0.85); group.add(head);
    rig.head = head;
    add(head, box(0.26, 0.24, 0.52), plate, 0, 0, 0);
    add(head, cone(0.1, 0.35, 4), blade, 0, 0.06, -0.42, -Math.PI / 2, 0, 0);          // beak blade
    add(head, cone(0.07, 0.4, 4), blade, 0, 0.22, 0.2, 0.9, 0, 0);                     // crest
    [-1, 1].forEach((s) => add(head, box(0.04, 0.05, 0.14), glow(0x22d3ee), s * 0.09, 0.04, -0.2));
    [-1, 1].forEach((s) => {
      const hip = V(s * 0.22, 0.85, 0.1), knee = V(s * 0.3, 0.55, -0.15), foot = V(s * 0.3, 0.04, 0.05);
      const leg = artic(root, hip, knee, foot, 0.09, 0.06, plate, dark, 0.09);
      leg.onLow(cone(0.08, 0.34, 4), blade, s * 0.3, 0.05, -0.2, -Math.PI / 2, 0, 0);   // claw
      addLeg(leg, s < 0 ? 0 : Math.PI, 1.15);
      // forearm scythe blades
      const arm = artic(group, V(s * 0.24, 1.0, -0.4), V(s * 0.34, 0.8, -0.7), V(s * 0.36, 0.76, -0.8), 0.04, 0.035, dark, dark);
      arm.onLow(cone(0.06, 0.8, 4), glow(0x67e8f9), s * 0.36, 0.75, -1.05, -Math.PI / 2 - 0.3, 0, 0);
      addArm(arm, s < 0 ? Math.PI : 0, 0.7);
    });
    const tail = pivot(group, 0, 0.95, 0.5);                                              // tail
    limb(tail, V(0, 0, 0), V(0, -0.15, 0.8), 0.06, dark);
    add(tail, cone(0.08, 0.3, 4), glow(0x22d3ee), 0, -0.17, 0.95, Math.PI / 2, 0, 0);
    rig.tails.push({ obj: tail, phase: 1, amp: 0.8 });
    rig.gait = { freq: 1.5, swing: 0.95, knee: 1.1, bob: 0.06, lean: 0.07 };
    rig.lunge = 0.4;
    return { hp: 105, speed: 8.4, damage: 14 };
  }

  // ───────────── MAULER: armored siege hound (hound AI) ─────────────
  if (type === 'mauler') {
    const dark = std(0x1c1917, 0.9, 0.3), plate = std(0x78350f, 0.85, 0.35), steel = std(0xa8a29e, 0.85, 0.3);
    add(group, box(1.0, 0.7, 1.7), dark, 0, 0.95, 0.1);
    add(group, box(1.15, 0.4, 1.0), plate, 0, 1.4, -0.2);                                  // dorsal armor
    add(group, box(1.1, 0.6, 0.5), plate, 0, 1.0, -0.95, 0.15, 0, 0);                      // chest guard
    for (let i = 0; i < 5; i++) add(group, cone(0.1, 0.4, 4), steel, ((i % 2) - 0.5) * 0.5, 1.7, -0.5 + i * 0.28); // spikes
    for (let i = 0; i < 3; i++) add(group, box(1.12, 0.03, 0.04), glow(0xf97316), 0, 1.25 - i * 0.18, -0.74);
    const head = new THREE.Group(); head.position.set(0, 1.1, -1.35); group.add(head);
    rig.head = head;
    add(head, box(0.6, 0.5, 0.6), plate, 0, 0, 0);
    const jaw = pivot(head, 0, -0.12, -0.05); rig.jaw = jaw;
    add(jaw, box(0.5, 0.22, 0.4), dark, 0, -0.08, -0.25);                                    // jaw
    for (let i = -2; i <= 2; i++) add(jaw, cone(0.04, 0.14, 4), steel, i * 0.1, -0.18, -0.4, Math.PI, 0, 0);
    [-1, 1].forEach((s) => {
      add(head, box(0.1, 0.07, 0.12), glow(0xf97316), s * 0.18, 0.08, -0.31);
      add(head, cone(0.1, 0.5, 4), steel, s * 0.34, 0.3, 0.05, -0.2, 0, s * -0.5);           // horns
    });
    [[-0.5, -0.65], [0.5, -0.65], [-0.5, 0.7], [0.5, 0.7]].forEach(([lx, lz]) => {
      const j = artic(root, V(lx, 0.9, lz), V(lx * 1.15, 0.45, lz), V(lx * 1.15, 0.06, lz - 0.05), 0.17, 0.13, plate, dark, 0.17);
      j.onLow(box(0.32, 0.1, 0.46), steel, lx * 1.15, 0.05, lz - 0.1);
      addLeg(j, (lx < 0) === (lz < 0) ? 0 : Math.PI, 0.8);
    });
    [-0.3, 0.3].forEach((x) => rig.pulses.push({ obj: add(group, cyl(0.1, 0.12, 0.3, 8), glow(0xf97316), x, 1.0, 1.0, Math.PI / 2, 0, 0), amp: 0.8 }));
    rig.gait = { freq: 1.0, swing: 0.6, knee: 0.7, bob: 0.06, lean: 0.05 };
    rig.lunge = 0.5;
    return { hp: 260, speed: 5.4, damage: 24 };
  }

  // ───────────── SEEKER: spiked kamikaze orb (drone AI) ─────────────
  if (type === 'seeker') {
    const dark = std(0x1f1b24, 0.9, 0.25), spike = std(0xe2e8f0, 0.9, 0.2);
    add(group, new THREE.IcosahedronGeometry(0.4, 1), dark);
    add(group, new THREE.IcosahedronGeometry(0.5, 0), halo(0xfb7185, 0.14));
    const spikes = pivot(group);
    for (let i = 0; i < 10; i++) {
      const a = i * 2.399, y = 1 - (i / 9) * 2, r = Math.sqrt(Math.max(0, 1 - y * y));
      const dx = Math.cos(a) * r, dz = Math.sin(a) * r;
      const sp = add(spikes, cone(0.07, 0.34, 4), i % 3 === 0 ? glow(0xfb7185) : spike, dx * 0.5, y * 0.5, dz * 0.5);
      sp.quaternion.setFromUnitVectors(V(0, 1, 0), V(dx, y, dz));
    }
    rig.spinners.push({ obj: spikes, axis: 'z', speed: 1.8 });
    add(group, sph(0.17, 12), std(0x020617, 0.6, 0.2), 0, 0, -0.34);
    rig.pulses.push({ obj: add(group, sph(0.1, 10), glow(0xfb7185), 0, 0, -0.42), amp: 2.2, speed: 2 });
    const sRingA = pivot(group); add(sRingA, new THREE.TorusGeometry(0.58, 0.025, 8, 24), glow(0xfb7185), 0, 0, 0, Math.PI / 2, 0, 0);
    const sRingB = pivot(group); add(sRingB, new THREE.TorusGeometry(0.58, 0.025, 8, 24), glow(0xfda4af), 0, 0, 0, 0, Math.PI / 2, 0);
    rig.spinners.push({ obj: sRingA, axis: 'x', speed: 3.2 }, { obj: sRingB, axis: 'z', speed: -2.6 });
    rig.hover = { bob: 0.08, tilt: 0.05 };
    rig.lunge = 0.3;
    return { hp: 70, speed: 7.0, damage: 15 };
  }

  // ───────────── GUNSHIP: twin-rotor gun platform (drone AI) ─────────────
  if (type === 'gunship') {
    const dark = std(0x111827, 0.9, 0.25), hull = std(0x4338ca, 0.85, 0.3), steel = std(0x94a3b8, 0.85, 0.3);
    add(group, box(0.9, 0.5, 1.5), dark, 0, 0, 0);
    add(group, box(0.7, 0.3, 0.9), hull, 0, 0.3, 0.1);
    add(group, box(0.6, 0.35, 0.5), hull, 0, -0.02, -0.85, 0.25, 0, 0);                    // nose
    add(group, sph(0.14, 10), glow(0xa5b4fc), 0, 0.02, -1.12);
    add(group, box(1.9, 0.08, 0.2), steel, 0, 0.05, 0.1);                                    // wing spar
    [-1, 1].forEach((s) => {
      add(group, cyl(0.2, 0.24, 0.3, 10), dark, s * 0.95, 0.1, 0.1);
      const rotor = pivot(group, s * 0.95, 0.28, 0.1);
      add(rotor, new THREE.CircleGeometry(0.62, 24), new THREE.MeshBasicMaterial({ color: 0xa5b4fc, transparent: true, opacity: 0.2, side: THREE.DoubleSide }), 0, 0, 0, -Math.PI / 2, 0, 0);
      add(rotor, box(1.2, 0.015, 0.07), glow(0xc7d2fe), 0, 0, 0);
      add(rotor, box(1.2, 0.015, 0.07), glow(0xc7d2fe), 0, 0, 0, 0, Math.PI / 2, 0);
      rig.spinners.push({ obj: rotor, axis: 'y', speed: s * 22 });
      add(group, box(0.18, 0.2, 0.7), hull, s * 0.5, -0.28, -0.3);                           // gun pod
      rig.recoils.push({ obj: add(group, cyl(0.04, 0.045, 0.9, 8), steel, s * 0.5, -0.28, -0.95, Math.PI / 2, 0, 0), amp: 0.7 });
      add(group, sph(0.05, 8), glow(0xef4444), s * 0.5, -0.28, -1.42);
    });
    add(group, box(0.1, 0.3, 0.9), hull, 0, 0.3, 0.7, 0, 0, 0);                              // tail fin
    add(group, cyl(0.02, 0.03, 0.5, 6), steel, 0, 0.65, 0.3);
    add(group, sph(0.05, 8), glow(0xef4444), 0, 0.92, 0.3);
    rig.hover = { bob: 0.07, tilt: 0.04 };
    rig.lunge = 0.15;
    return { hp: 200, speed: 4.2, damage: 20 };
  }

  // ───────────── SCORPION: tail-cannon crawler (sentry AI) ─────────────
  if (type === 'scorpion') {
    const dark = std(0x1a1a1a, 0.92, 0.28), shell = std(0x854d0e, 0.85, 0.3), steel = std(0xa1a1aa, 0.85, 0.3);
    add(group, box(0.9, 0.35, 1.3), dark, 0, 0.55, 0);
    add(group, box(0.8, 0.22, 0.9), shell, 0, 0.78, 0.05);
    add(group, box(0.5, 0.2, 0.4), shell, 0, 0.62, -0.78, 0.2, 0, 0);
    [-1, 1].forEach((s) => {
      add(group, sph(0.07, 8), glow(0xfacc15), s * 0.14, 0.7, -0.98);
      // claws
      const claw = artic(group, V(s * 0.4, 0.6, -0.5), V(s * 0.75, 0.55, -1.0), V(s * 0.78, 0.55, -1.1), 0.07, 0.06, dark, dark);
      claw.onLow(box(0.22, 0.1, 0.5), shell, s * 0.8, 0.55, -1.3);
      claw.onLow(cone(0.1, 0.4, 4), steel, s * 0.8, 0.55, -1.7, -Math.PI / 2, 0, 0);
      addArm(claw, s < 0 ? 0 : Math.PI, 0.5);
    });
    // six legs (alternating tripod gait)
    for (let i = 0; i < 3; i++) [-1, 1].forEach((s) => {
      const z = -0.35 + i * 0.4;
      const j = artic(root, V(s * 0.4, 0.55, z), V(s * 0.85, 0.7, z), V(s * 1.0, 0.03, z + 0.05), 0.045, 0.04, steel, dark);
      addLeg(j, (i + (s > 0 ? 1 : 0)) % 2 ? Math.PI : 0, 0.9);
    });
    // arched tail with cannon (one pivot, so the whole tail sways / whips on firing)
    const tailRoot = pivot(group, 0, 0.7, 0.6);
    const tail = [V(0, 0, 0), V(0, 0.2, 0.45), V(0, 0.7, 0.6), V(0, 1.15, 0.35), V(0, 1.3, -0.1)];
    for (let i = 0; i < tail.length - 1; i++) {
      limb(tailRoot, tail[i], tail[i + 1], 0.1 - i * 0.01, shell);
      add(tailRoot, sph(0.115 - i * 0.01, 8), dark, tail[i + 1].x, tail[i + 1].y, tail[i + 1].z);
    }
    add(tailRoot, box(0.26, 0.26, 0.5), dark, 0, 1.3, -0.3, 0.3, 0, 0);
    const cannon = pivot(tailRoot);
    add(cannon, cyl(0.06, 0.07, 0.8, 8), steel, 0, 1.22, -0.7, Math.PI / 2 + 0.5, 0, 0);
    rig.pulses.push({ obj: add(cannon, sph(0.07, 8), glow(0xfacc15), 0, 1.08, -1.05), amp: 2 });
    rig.recoils.push({ obj: cannon, amp: 0.8 });
    rig.tails.push({ obj: tailRoot, phase: 0.5, amp: 0.9 });
    rig.gait = { freq: 1.6, swing: 0.5, knee: 0.7, bob: 0.025, lean: 0.03 };
    rig.lunge = 0.3;
    return { hp: 240, speed: 4.8, damage: 42 };
  }

  // ───────────── WRAITH: scythe phantom (stalker AI) ─────────────
  if (type === 'wraith') {
    const ghost = new THREE.MeshStandardMaterial({ color: 0x0d9488, transparent: true, opacity: 0.5, metalness: 0.8, roughness: 0.15 });
    const dark = std(0x042f2e, 0.85, 0.3), core = glow(0x5eead4);
    for (let i = 0; i < 6; i++) {
      const cl = pivot(group, ((i % 3) - 1) * 0.12, 0.6 + i * 0.05 + 0.5, 0.05 + i * 0.04);
      add(cl, cone(0.34 - i * 0.03, 1.0 - i * 0.08, 5), i % 2 ? ghost : dark, 0, -0.5, 0, Math.PI, 0, 0); // tattered cloak
      rig.flutters.push({ obj: cl, phase: i * 1.1, amp: 0.9 + (i % 3) * 0.2, speed: 0.8 });
    }
    add(group, box(0.5, 0.75, 0.3), ghost, 0, 1.4, 0);
    rig.pulses.push({ obj: add(group, box(0.26, 0.4, 0.1), core, 0, 1.42, -0.17), amp: 1.2 });
    add(group, new THREE.OctahedronGeometry(0.3, 0), halo(0x5eead4, 0.18), 0, 1.42, -0.2);
    add(group, cone(0.26, 0.5, 5), dark, 0, 2.05, 0, Math.PI, 0, 0);                         // hood
    add(group, sph(0.17, 10), dark, 0, 1.98, 0);
    [-1, 1].forEach((s) => add(group, box(0.06, 0.05, 0.05), glow(0x99f6e4), s * 0.07, 1.98, -0.15));
    [-1, 1].forEach((s) => {
      const arm = artic(group, V(s * 0.4, 1.62, 0), V(s * 0.55, 1.2, -0.3), V(s * 0.45, 1.0, -0.65), 0.05, 0.04, ghost, dark);
      arm.onUp(new THREE.OctahedronGeometry(0.2, 0), dark, s * 0.4, 1.68, 0);
      // scythe held in the right hand: pole + blades ride on the forearm
      if (s > 0) {
        arm.onLow(cyl(0.03, 0.03, 1.8, 6), dark, 0.45, 1.3, -0.65);
        arm.onLow(cone(0.06, 0.9, 4), glow(0x5eead4), 0.45, 2.35, -0.95, -Math.PI / 2 - 0.2, 0, 0);
        arm.onLow(cone(0.05, 0.4, 4), glow(0xccfbf1), 0.45, 2.2, -1.35, -Math.PI / 2 + 0.6, 0, 0);
      }
      addArm(arm, s < 0 ? Math.PI : 0, 0.5);
    });
    rig.gait = { freq: 1.2, swing: 0.3, knee: 0.3, bob: 0.1, lean: 0.1 };
    rig.lunge = 0.45;
    return { hp: 140, speed: 8.0, damage: 26 };
  }

  // ───────────── BULWARK: shield golem (golem AI) ─────────────
  if (type === 'bulwark') {
    const hull = std(0x3f3f46, 0.88, 0.38), dark = std(0x18181b, 0.92, 0.3), steel = std(0x71717a, 0.85, 0.3);
    add(group, box(1.5, 0.5, 1.0), dark, 0, 1.0, 0);
    add(group, box(1.6, 1.4, 1.2), hull, 0, 1.95, 0);
    add(group, box(1.0, 0.5, 0.9), steel, 0, 2.8, 0);                                         // shoulder yoke
    add(group, box(0.5, 0.4, 0.5), dark, 0, 3.15, -0.05);
    add(group, box(0.4, 0.06, 0.1), glow(0x38bdf8), 0, 3.17, -0.3);
    rig.pulses.push({ obj: add(group, sph(0.22, 12), glow(0x38bdf8), 0, 1.95, -0.62), amp: 1.3 });
    rig.pulses.push({ obj: add(group, sph(0.4, 12), halo(0x38bdf8, 0.2), 0, 1.95, -0.62), amp: 1.3, phase: 0.5 });
    // tower shield on the left arm
    // left arm carries the tower shield (it braces forward on wind-up)
    const lArm = artic(group, V(-1.0, 2.6, 0), V(-1.3, 1.8, -0.4), V(-1.35, 1.7, -0.6), 0.2, 0.18, hull, hull);
    const shield = new THREE.Group(); shield.position.set(-1.35 + 1.3, 0, -0.7 + 0.4); // model-space (-1.35,1.8,-0.7) relative to the elbow
    lArm.low.add(shield);
    add(shield, box(0.25, 2.3, 1.5), steel, 0, 0, 0);
    add(shield, box(0.3, 2.0, 1.2), hull, -0.04, 0, 0);
    add(shield, box(0.32, 0.1, 1.3), glow(0x38bdf8), -0.05, 0.9, 0);
    add(shield, box(0.32, 0.1, 1.3), glow(0x38bdf8), -0.05, -0.9, 0);
    add(shield, cone(0.18, 0.6, 4), steel, -0.2, 0, 0, 0, 0, Math.PI / 2);
    addArm(lArm, 0, 0.3);
    // right arm: piston hammer
    const rArm = artic(group, V(1.0, 2.6, 0), V(1.3, 1.7, -0.2), V(1.25, 0.9, -0.6), 0.2, 0.22, hull, dark);
    rArm.onLow(box(0.7, 0.7, 0.7), steel, 1.25, 0.6, -0.65);
    rArm.onLow(cyl(0.1, 0.1, 0.8, 8), glow(0xf97316), 1.25, 1.05, -0.45, Math.PI / 2 - 0.5, 0, 0);
    addArm(rArm, Math.PI, 1.1);
    [-1, 1].forEach((s) => {
      const leg = artic(root, V(s * 0.45, 1.0, 0), V(s * 0.55, 0.45, 0.05), V(s * 0.55, 0.38, 0.05), 0.24, 0.2, hull, dark);
      leg.onLow(box(0.55, 0.45, 0.7), dark, s * 0.55, 0.22, -0.05);
      addLeg(leg, s < 0 ? 0 : Math.PI, 0.8);
    });
    rig.gait = { freq: 0.8, swing: 0.5, knee: 0.5, bob: 0.06, lean: 0.04 };
    rig.lunge = 0.25;
    return { hp: 520, speed: 3.2, damage: 28 };
  }

  // ───────────── HOWITZER: tracked siege cannon (titan AI) ─────────────
  if (type === 'howitzer') {
    const hull = std(0x1c2a1c, 0.88, 0.35), plate = std(0x3f5a3f, 0.85, 0.35), steel = std(0x78716c, 0.85, 0.3), dark = std(0x0c0a09, 0.9, 0.3);
    add(group, box(2.6, 0.9, 3.6), hull, 0, 1.0, 0);
    add(group, box(2.4, 0.5, 2.6), plate, 0, 1.65, 0.2);
    add(group, box(2.2, 0.7, 0.9), plate, 0, 1.2, -1.95, 0.4, 0, 0);                         // glacis
    [-1, 1].forEach((s) => {
      add(group, box(0.8, 0.85, 3.8), dark, s * 1.55, 0.45, 0);                               // tracks
      for (let i = 0; i < 6; i++) rig.wheels.push({ obj: add(group, cyl(0.3, 0.3, 0.86, 10), steel, s * 1.55, 0.35, -1.5 + i * 0.6, 0, 0, Math.PI / 2), speed: 3.3 });
      add(group, box(0.1, 0.1, 3.4), glow(0xef4444), s * 1.97, 0.7, 0);
    });
    const turret = new THREE.Group(); turret.position.set(0, 2.1, 0.3); group.add(turret);
    rig.scanners.push({ obj: turret, phase: 0, amp: 0.5 });
    add(turret, cyl(1.0, 1.15, 0.6, 8), plate, 0, 0, 0);
    add(turret, box(1.7, 0.7, 1.7), hull, 0, 0.6, 0.1);
    add(turret, box(1.0, 0.5, 0.7), dark, 0, 0.55, 1.0);
    add(turret, cyl(0.28, 0.34, 0.8, 10), steel, 0, 0.75, -1.0, Math.PI / 2 + 0.3, 0, 0);    // barrel base
    const barrel = pivot(turret);
    rig.recoils.push({ obj: barrel, amp: 2.2 });
    add(barrel, cyl(0.17, 0.2, 3.2, 10), steel, 0, 1.3, -2.5, Math.PI / 2 + 0.3, 0, 0);       // main barrel
    add(barrel, cyl(0.3, 0.3, 0.5, 10), dark, 0, 1.75, -3.95, Math.PI / 2 + 0.3, 0, 0);       // muzzle brake
    rig.pulses.push({ obj: add(barrel, sph(0.1, 8), glow(0xef4444), 0, 1.85, -4.2), amp: 2.5 });
    add(turret, cyl(0.03, 0.05, 1.0, 6), steel, -0.7, 1.2, 0.7);
    add(turret, sph(0.08, 8), glow(0xef4444), -0.7, 1.75, 0.7);
    for (let i = 0; i < 3; i++) add(group, box(1.8, 0.05, 0.05), glow(0xef4444), 0, 1.45 - i * 0.1, -2.2 + i * 0.01);
    rig.gait = { freq: 0.5, swing: 0, knee: 0, bob: 0.02, lean: 0.015 };
    rig.lunge = 0.08;
    return { hp: 820, speed: 2.4, damage: 52 };
  }

  // Unreachable for known types; keep a harmless fallback
  return { hp: 100, speed: 3, damage: 10 };
}


function createEnemyInstance(
  enDef: WaveEnemyDef,
  scene: THREE.Scene,
  coverObjects?: CoverObject[],
  difficultyMultiplier: number = 1.0,
  /** spawn here instead of a random arena position (summons / brood) */
  at?: THREE.Vector3
): EnemyInstance {
  const group = new THREE.Group();
  const baseType = baseCategoryOf(enDef.enemyTypeId);
  const isBossDef = baseType === 'boss';
  const bossKind = bossKindOf(enDef.enemyTypeId) ?? undefined;
  const { hp, speed, damage } = buildEnemyModel(enDef.enemyTypeId, group);

  // Apply archetype-specific procedural surface textures to solid enemy armor (elites carry their own).
  const elite = isEliteType(enDef.enemyTypeId) || isApexType(enDef.enemyTypeId);
  const enemyTexture = elite || isBossDef ? null : createEnemySurfaceTexture(enDef.enemyTypeId);
  if (enemyTexture) group.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    mats.forEach((mat) => {
      if (mat instanceof THREE.MeshStandardMaterial || mat instanceof THREE.MeshPhysicalMaterial) {
        mat.map = enemyTexture; mat.needsUpdate = true;
      }
    });
  });

  // Calculate safe spawn position away from any solid stage cover boxes
  let spawnX = 0;
  let spawnZ = 0;
  for (let attempt = 0; attempt < (at ? 0 : 25); attempt++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 16 + Math.random() * 18;
    spawnX = Math.cos(angle) * dist;
    spawnZ = Math.sin(angle) * dist;

    let inCover = false;
    if (coverObjects && coverObjects.length > 0) {
      for (let c = 0; c < coverObjects.length; c++) {
        const b = coverObjects[c].box;
        const pad = 2.4;
        if (
          spawnX >= b.minX - pad &&
          spawnX <= b.maxX + pad &&
          spawnZ >= b.minZ - pad &&
          spawnZ <= b.maxZ + pad
        ) {
          inCover = true;
          break;
        }
      }
    }
    if (!inCover) break;
  }

  if (at) {
    spawnX = at.x;
    spawnZ = at.z;
  }
  const spawnY = baseType === 'drone' ? 2.8 : baseType === 'mender' ? 3.7 : baseType === 'carrier' ? 4.9 : baseType === 'spotter' ? 6.4 : 0;
  group.position.set(spawnX, spawnY, spawnZ);
  scene.add(group);

  // Holographic cyber spawn circle
  const ringGeo = new THREE.RingGeometry(0.2, isBossDef ? 9.0 : 2.25, 24);
  const ringMat = new THREE.MeshBasicMaterial({
    color: isBossDef ? 0xef4444 : 0x0284c7,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.95,
  });
  const ringMesh = new THREE.Mesh(ringGeo, ringMat);
  ringMesh.rotation.x = Math.PI / 2;
  ringMesh.position.set(group.position.x, 0.05, group.position.z);
  scene.add(ringMesh);
  setTimeout(() => {
    scene.remove(ringMesh);
    ringGeo.dispose();
    ringMat.dispose();
  }, 850);

  // Overhead Target Billboard & High-Contrast HP Bar
  const enemyH =
    isBossDef
      ? 11.6
      : baseType === 'lancer'
      ? 3.9
      : baseType === 'wyrm'
      ? 2.6
      : baseType === 'jester'
      ? 2.6
      : baseType === 'carrier'
      ? 1.9
      : baseType === 'mender'
      ? 1.5
      : baseType === 'spotter'
      ? 1.0
      : baseType === 'chrono'
      ? 4.0
      : baseType === 'aegis' || baseType === 'magnet' || baseType === 'berserker'
      ? 3.4
      : baseType === 'ronin' || baseType === 'pyro' || baseType === 'mirage' || baseType === 'mirage_echo' || baseType === 'weaver'
      ? 2.7
      : baseType === 'pylon'
      ? 2.4
      : baseType === 'splitter'
      ? 2.3
      : enDef.enemyTypeId === 'splitling'
      ? 1.2
      : enDef.enemyTypeId === 'mite'
      ? 0.9
      : baseType === 'titan'
      ? 3.9
      : baseType === 'golem'
      ? 2.9
      : baseType === 'stalker'
      ? 2.2
      : baseType === 'sentry'
      ? 1.4
      : baseType === 'drone'
      ? 0.9
      : 1.2;

  const overheadGroup = new THREE.Group();
  overheadGroup.position.set(0, enemyH + 0.45, 0);
  if (isBossDef) overheadGroup.scale.setScalar(2.4);

  const hpBg = new THREE.Mesh(
    new THREE.PlaneGeometry(1.4, 0.18),
    new THREE.MeshBasicMaterial({ color: 0x0f172a, side: THREE.DoubleSide })
  );
  overheadGroup.add(hpBg);

  const hpFg = new THREE.Mesh(
    new THREE.PlaneGeometry(1.34, 0.12),
    new THREE.MeshBasicMaterial({
      color: isBossDef ? 0xff0044 : 0xef4444,
      side: THREE.DoubleSide,
    })
  );
  hpFg.position.z = 0.01;
  overheadGroup.add(hpFg);

  const chevron = new THREE.Mesh(
    new THREE.ConeGeometry(0.12, 0.22, 3),
    new THREE.MeshBasicMaterial({ color: isBossDef ? 0xff0044 : 0xef4444 })
  );
  chevron.rotation.z = Math.PI;
  chevron.position.set(0, 0.22, 0);
  overheadGroup.add(chevron);

  group.add(overheadGroup);

  const ringR =
    isBossDef
      ? 5.8
      : baseType === 'carrier'
      ? 2.4
      : baseType === 'lancer' || baseType === 'aegis' || baseType === 'magnet' || baseType === 'berserker' || baseType === 'weaver'
      ? 1.9
      : baseType === 'chrono' || baseType === 'splitter' || baseType === 'pyro'
      ? 1.5
      : baseType === 'pylon'
      ? 0.9
      : baseType === 'titan'
      ? 2.5
      : baseType === 'golem'
      ? 1.8
      : 1.25;
  const groundRingGeo = new THREE.RingGeometry(ringR * 0.85, ringR * 1.1, 24);
  const groundRingMat = new THREE.MeshBasicMaterial({
    color: isBossDef ? 0xff0044 : 0xef4444,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.75,
  });
  const groundRingMesh = new THREE.Mesh(groundRingGeo, groundRingMat);
  groundRingMesh.rotation.x = Math.PI / 2;
  groundRingMesh.position.set(group.position.x, 0.04, group.position.z);
  scene.add(groundRingMesh);

  const scaledHp = Math.round(hp * difficultyMultiplier);
  const scaledDamage = Math.round(damage * (1 + (difficultyMultiplier - 1) * 0.15));

  return {
    mesh: group,
    typeId: enDef.enemyTypeId,
    category: baseType,
    hp: scaledHp,
    maxHp: scaledHp,
    speed,
    baseSpeed: speed,
    damage: scaledDamage,
    scoreValue: Math.round(scaledHp * 5),
    scrapValue: Math.round(scaledHp * 0.2),
    attackCooldown: Math.random() * 2,
    shootCooldown: 1.5 + Math.random() * 2.0,
    isDead: false,
    velocity: new THREE.Vector3(),
    overheadGroup,
    hpBarMesh: hpFg,
    groundRingMesh,
    aiPattern: 'normal',
    patternTimer: 1.2 + Math.random() * 2.4,
    actionSubTimer: 0,
    strafeSign: Math.random() < 0.5 ? 1 : -1,
    isCharging: false,
    isSniping: false,
    bossKind,
    bossPhase: 1,
    bossSpin: 0,
    bossState: 0,
    name: enDef.name,
  };
}

export const BattleScene3D: React.FC<BattleScene3DProps> = ({
  mission,
  weapons,
  activeLoadout,
  skillNodes,
  weaponDamageLevels = {},
  nodeLevels = {},
  net = null,
  hard = false,
  onFinishBattle,
  devMode,
  onExitToMenu,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const firstOccupiedSlot = ([1, 2, 3, 4] as WeaponSlot[]).find((s) => Boolean(activeLoadout[s])) || 1;
  const currentSlotRef = useRef<WeaponSlot>(firstOccupiedSlot);
  const weaponsRef = useRef(weapons);
  weaponsRef.current = weapons;
  const weaponDamageLevelsRef = useRef(weaponDamageLevels);
  weaponDamageLevelsRef.current = weaponDamageLevels;

  const getWeaponDamageMultiplier = useCallback((weaponId: string) => {
    const level = weaponDamageLevelsRef.current[weaponId] || 0;
    return 1 + level * 0.03;
  }, []);

  const getWeaponInSlot = useCallback((slot: WeaponSlot): Weapon => {
    const weaponId = activeLoadout[slot];
    let base: Weapon | undefined;
    if (weaponId) base = weaponsRef.current.find((w) => w.id === weaponId);
    if (!base) {
      for (const s of [1, 2, 3, 4] as WeaponSlot[]) {
        const id = activeLoadout[s];
        if (id) { base = weaponsRef.current.find((w) => w.id === id); if (base) break; }
      }
    }
    base = base || weaponsRef.current[0];
    if (!base) return base as Weapon;

    // Weapon-specific upgrades are applied to a derived copy so every combat
    // path that asks for the active weapon sees the upgraded values.
    const effects = skillNodes.filter((n) => n.unlocked && n.targetWeaponId === base!.id)
      .flatMap((n) => {
        const lv = getNodeLevel(n, nodeLevels);
        return n.effects.map((e) => ({ ...e, value: scaledEffectValue(e.value, lv, n) }));
      });
    const sum = (stat: string) => effects.filter((e) => e.stat === stat).reduce((v, e) => v + e.value, 0);
    const damageBonus = sum('damage') + sum('comboFinisherDmg') + sum('slamDamage');
    const damagePct = sum('allDamage') + sum('meleeDamage') + sum('rangedDamage') + sum('heavyDamage') + sum('armorPenetration') + sum('armorPierce');
    const fireRateBonus = sum('fireRate') + sum('meleeSpeed');
    const reloadBonus = sum('reloadTime') + sum('rechargeSpeed');
    const rangeBonus = sum('range') + sum('sweepLunge') + sum('thrustPower');
    const radiusBonus = sum('blastRadius') + sum('slamRadius') + sum('sweepRange');
    const stats = {
      ...base.stats,
      damage: Math.max(0, (base.stats.damage + damageBonus) * (1 + damagePct)),
      fireRate: Math.max(0.05, base.stats.fireRate * (1 + fireRateBonus)),
      range: Math.max(0.1, base.stats.range + rangeBonus + radiusBonus),
      critRate: Math.min(100, base.stats.critRate + sum('critRate') * (base.stats.critRate <= 1 ? 100 : 1)),
      accuracy: Math.min(100, base.stats.accuracy + sum('accuracy')),
      maxAmmo: Math.max(1, base.stats.maxAmmo + sum('maxAmmo')),
      reloadTime: Math.max(0.1, base.stats.reloadTime * Math.max(0.1, 1 - reloadBonus)),
    };
    return { ...base, stats };
  }, [activeLoadout, skillNodes, nodeLevels]);

  const getActiveWeapon = useCallback((): Weapon => getWeaponInSlot(currentSlotRef.current), [getWeaponInSlot]);

  // Stocked ammo per slot
  const ammoStockRef = useRef<Record<WeaponSlot, number>>({
    1: (activeLoadout[1] && weapons.find((w) => w.id === activeLoadout[1])?.stats.maxAmmo) || 18,
    2: (activeLoadout[2] && weapons.find((w) => w.id === activeLoadout[2])?.stats.maxAmmo) || 0,
    3: (activeLoadout[3] && weapons.find((w) => w.id === activeLoadout[3])?.stats.maxAmmo) || 0,
    4: (activeLoadout[4] && weapons.find((w) => w.id === activeLoadout[4])?.stats.maxAmmo) || 0,
  });

  // Combat status refs
  const playerHpRef = useRef(100);
  const netRef = useRef(net);
  netRef.current = net;
  /** 協力プレイ: ダウン中 (無敵・攻撃不可。次のウェーブか味方の救助で復帰) */
  const koRef = useRef(false);
  const [koUi, setKoUi] = useState(false);
  const [reviveInfo, setReviveInfo] = useState<ReviveInfo>({ selfRemain: null, rescue: null, downed: [] });
  const playerShieldRef = useRef(80);
  const staminaRef = useRef(100);
  const dashCooldownRef = useRef(0);
  const isGuardingRef = useRef(false);
  // INFIGHT guard: start time (perfect window), impact flash, pile-bunker charge, 3D effect
  const guardStartRef = useRef(0);
  const guardFlashRef = useRef(0);
  const guardStrengthRef = useRef(0);
  const lanceChargeRef = useRef(0);
  // RAVAGER-09 chainsaw: hold-to-grind state
  const sawGrindStartRef = useRef(0); // performance.now()/1000 when the current press started (0 = not grinding)
  const sawDropDoneRef = useRef(false); // the opening RAVAGE DROP has landed
  const sawNextTickRef = useRef(0);
  const sawRpmRef = useRef(0); // 0..1, ramps up while grinding
  const sawRushUntilRef = useRef(0); // RIPPER RUSH end time
  /** 溜め技の突進: この間は摩擦を無視して一定速度で進む（x/z = 方向, speed = m/s, until = 終了時刻） */
  const skillDashRef = useRef({ x: 0, z: 0, speed: 0, until: 0 });
  const scytheTempestStartRef = useRef(0); // REAPER TEMPEST start time
  const scytheTempestUntilRef = useRef(0); // REAPER TEMPEST end time (0 = inactive)
  const sawTextRef = useRef({ dmg: 0, t: 0 }); // grind damage is summed into one popup every 0.35s
  const guardFxRef = useRef<THREE.Group | null>(null);
  const isSweepingRef = useRef(false);
  const isReloadingRef = useRef(false);
  const reloadDurationRef = useRef(0);
  const reloadIdRef = useRef(0);
  const isPausedRef = useRef(false);
  const killsRef = useRef(0);
  const scrapCollectedRef = useRef(0);

  // ADS & Full-Auto State Refs
  const isAimingRef = useRef(false);
  const isMouseDownRef = useRef(false);
  const lastFireTimeRef = useRef(0);
  const autoFireRef = useRef(false);       // true while the frame loop (already rate-limited) drives a held-trigger shot
  const lastGunShotRef = useRef(0);        // performance.now()/1000 of the last firearm shot (fire-rate gate)
  const gatlingSpinRef = useRef(0);        // 0..1 barrel spin for PHOTON GATLING (follows charge, 1 while firing)
  const gatlingChargeRef = useRef(0);      // 0..1 hold-to-charge progress (3s to full)
  // SHR1NKER: hold-to-charge beam state (charge = seconds held, beamLeft/beamTotal = seconds of laser)
  const shr1nkerRef = useRef({
    charge: 0, beamLeft: 0, beamTotal: 0, thick: 0, tick: 0, spark: 0, textAcc: 0, textTimer: 0, sfx: 0, chargeSfx: 0, active: false,
    group: null as THREE.Group | null, core: null as THREE.Mesh | null, glow: null as THREE.Mesh | null,
    flare: null as THREE.Mesh | null, impact: null as THREE.Mesh | null, orb: null as THREE.Mesh | null,
    glowNear: null as THREE.Mesh | null, coreNear: null as THREE.Mesh | null,
  });
  // BUBBLAS: expanding "pop" shells left behind by bursting bubbles
  const bubblePopsRef = useRef<{ mesh: THREE.Mesh; age: number; life: number; size: number }[]>([]);
  const gatlingFireLeftRef = useRef(0);    // seconds of sustained fire remaining after release
  const gatlingFireTotalRef = useRef(0);
  const spreaderHeatRef = useRef(0);       // 0..1 SPREAD-ER ramp: fire rate up + spread up while the trigger is held
  const burstBypassRef = useRef(false);    // lets follow-up rounds of a burst skip the fire-rate gate
  const twinSideRef = useRef(1);           // alternates left/right gun for TWIN PULSE
  const twinCountRef = useRef(0);          // PULSE OVERLOAD counter (every 8th shot crits)
  const pumpActionActiveRef = useRef(false);

  // Dash-Jump Momentum Mechanics
  const isAirborneDashJumpRef = useRef(false);

  // MELEE 3-HIT COMBO & COOLDOWN SYSTEM (三段攻撃後・左右クリック技後のクールタイム)
  const comboStepRef = useRef<number>(1);
  const lastComboTimeRef = useRef<number>(0);
  const meleeCooldownUntilRef = useRef<number>(0);
  /** 溜め技の共通クールダウン終了時刻（通常の近接攻撃には影響しない） */
  const skillCooldownUntilRef = useRef<number>(0);
  const meleeCooldownDurationRef = useRef<number>(0);
  const meleeCooldownReasonRef = useRef<'finisher' | 'skill' | null>(null);
  const lastMeleeSwingTimeRef = useRef<number>(0);

  // DYNAMITE AUTO-RECHARGE SYSTEM
  const rechargeTimerRef = useRef<number>(0); // 現在装備中スロットのタイマー (HUD表示用)
  const rechargeTimersRef = useRef<Record<number, number>>({}); // スロットごとのタイマー (持っていなくても回復)
  const grenadeAimRef = useRef(false); // 投擲物: 長押し中 (予測線表示)
  const dynamiteProjectilesRef = useRef<DynamiteProjectile[]>([]);
  const throwSigRef = useRef(-1);

  // React UI state
  const [isPaused, setIsPaused] = useState(false);
  const [isAiming, setIsAiming] = useState(false);
  const [crosshairBloomed, setCrosshairBloomed] = useState(false);
  const initialWeapon =
    (activeLoadout[firstOccupiedSlot] && weapons.find((w) => w.id === activeLoadout[firstOccupiedSlot])) ||
    weapons.find((w) => w.id === activeLoadout[1]) ||
    weapons[0];
  const [hudStats, setHudStats] = useState({
    hp: 100,
    maxHp: 100,
    shield: 80,
    maxShield: 80,
    stamina: 100,
    ammo: initialWeapon?.stats.maxAmmo || 10,
    maxAmmo: initialWeapon?.stats.maxAmmo || 10,
    currentSlot: firstOccupiedSlot as WeaponSlot,
    weaponName: initialWeapon.name,
    category: initialWeapon.category,
    modelType: initialWeapon.modelType,
    weaponId: initialWeapon.id,
    hasScope: hasOpticalScope(initialWeapon),
    kills: 0,
    scrap: 0,
    isReloading: false,
    reloadDuration: 0,
    reloadId: 0,
    isGuarding: false,
    isSweeping: false,
    comboStep: 1,
    comboTimerPct: 0,
    isMeleeCooldown: false,
    meleeCooldownRemaining: 0,
    meleeCooldownPct: 0,
    meleeCooldownReason: null as 'finisher' | 'skill' | null,
    skillCooldownRemaining: 0,
    skillCooldownPct: 0,
    rechargePct: 0,
    isRechargeable: false,
    throwInfo: null as { label: string; cur: number; max: number } | null,
    slotStock: {} as Record<number, { cur: number; max: number }>,
    boss: null as { name: string; hp: number; maxHp: number; phase: number } | null,
  });

  // WAVE SYSTEM STATE
  const [currentWave, setCurrentWave] = useState(1);
  const [totalWaves, setTotalWaves] = useState(3);
  const [livingEnemiesCount, setLivingEnemiesCount] = useState(0);
  const currentWaveIndexRef = useRef(0);
  const wavesListRef = useRef<WaveConfig[]>([]);
  const isIntermissionRef = useRef(false);
  const intermissionTimerRef = useRef(0);
  const prevLivingCountRef = useRef(-1);

  // Visual FX State (Refined, Restrained)
  const [hitMarkerActive, setHitMarkerActive] = useState(false);
  const [damageVignette, setDamageVignette] = useState(false);
  const [floatingTexts, setFloatingTexts] = useState<FloatingText[]>([]);
  const [announcement, setAnnouncement] = useState('MISSION COMMENCED');
  const [waveCutin, setWaveCutin] = useState<{ wave: number; total: number; final: boolean; boss: boolean; bossName?: string } | null>(null);
  // pending: scene still warming up / playing: stage cut-in on screen / done: waves running
  const [introPhase, setIntroPhase] = useState<'pending' | 'playing' | 'done'>('pending');
  const introRef = useRef({ frames: 0, startedAt: 0, done: false });

  // Input & Camera tracking
  const [isPointerLocked, setIsPointerLocked] = useState(false);
  const isPointerLockedRef = useRef(false);
  const keysPressed = useRef<{ [key: string]: boolean }>({});
  const prevMousePos = useRef<{ x: number; y: number } | null>(null);

  // Ultra-Smooth Camera Aiming Refs (Decoupled input accumulation + requestAnimationFrame Lerp)
  const targetRotation = useRef<{ yaw: number; pitch: number }>({ yaw: 0, pitch: 0 });
  const currentRotation = useRef<{ yaw: number; pitch: number }>({ yaw: 0, pitch: 0 });

  // 3D Engine references
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const playerPos = useRef(new THREE.Vector3(0, 1.7, 10));
  const playerVelocity = useRef(new THREE.Vector3(0, 0, 0));
  /** CHRONO REVERSER の時間遅延フィールド: until(秒) まで移動速度に mult を掛ける */
  const playerSlowRef = useRef({ mult: 1, until: 0 });

  // Viewmodel
  const viewmodelGroupRef = useRef<THREE.Group | null>(null);
  const weaponMeshHolderRef = useRef<THREE.Group | null>(null);
  const muzzleFlashLightRef = useRef<THREE.PointLight | null>(null);

  // Viewmodel Procedural Animation Machine (Smooth springs & continuous curves)
  const viewmodelAnimRef = useRef({
    recoilPos: new THREE.Vector3(0, 0, 0),
    recoilRotX: 0,
    recoilRotY: 0,
    drawProgress: 1.0,
    meleeActive: false,
    meleeStep: 1,
    meleeProgress: 1.0,
    slamActive: false,
    slamProgress: 1.0,
    /** TITAN LEAP SLAM のフェーズ: 0=なし 1=跳躍・振りかぶり 2=頂点で溜め 3=急降下の叩きつけ 4=着弾後の反動と復帰 */
    slamPhase: 0,
    slamTime: 0,
    pumpActive: false,
    pumpProgress: 1.0,
    slideBlowback: 0.0,
    // TWIN VIPER: per-hand recoil kick (1 = just fired, decays to 0)
    akimboKickL: 0.0,
    akimboKickR: 0.0,
    throwActive: false,
    throwProgress: 1.0,
    reloadProgress: 0.0,
    // ARCHON 9 magazine-swap reload: started on an empty mag (slide locked open) / next sound keyframe
    reloadFromEmpty: false,
    reloadSfxStep: 0,
    swayX: 0,
    swayY: 0,
    // Smooth continuous melee animation vectors (prevents any jerky snapping)
    meleeCurrentPos: new THREE.Vector3(0, 0, 0),
    meleeCurrentRot: new THREE.Vector3(0, 0, 0),
    meleeTargetPos: new THREE.Vector3(0, 0, 0),
    meleeTargetRot: new THREE.Vector3(0, 0, 0),
    // 武器固有モーション用（ガントレット4段コンボ解放フラグ / 左右の拳の個別姿勢）
    meleeVariant: 0,
    gauntL: [0, 0, 0, 0, 0, 0] as number[],
    gauntR: [0, 0, 0, 0, 0, 0] as number[],
    // RAVAGER-09: chain position (laps) and speed (laps/s)
    sawChainOffset: 0,
    sawChainSpeed: 0,
  });

  // Combat Entities
  const enemiesRef = useRef<EnemyInstance[]>([]);
  const bulletsRef = useRef<BulletInstance[]>([]);
  const scrapDropsRef = useRef<ScrapDrop[]>([]);
  const beaconDroppedRef = useRef(0); // 敵からドロップして拾った BEACON
  const gravityWellsRef = useRef<GravityWellEntity[]>([]);
  const droneFunnelsRef = useRef<DroneFunnelEntity[]>([]);
  const clusterBombletsRef = useRef<ClusterBombletEntity[]>([]);
  const railChargedRef = useRef(false);
  const chargeStartRef = useRef(0); // seconds (performance.now()/1000) when the trigger hold began; 0 = not charging
  const chargeReadyRef = useRef(false);
  /** INFIGHT 溜め技: 右クリックを押し始めた時刻 (秒)。0 = 溜めていない */
  const meleeChargeStartRef = useRef(0);
  /** 画面揺れ（TITAN LEAP SLAM 着弾など）。amp はカメラ位置のずれ(m)、dur で減衰 */
  const cameraShakeRef = useRef({ amp: 0, until: 0, dur: 1 });
  /** GRAVITON MAUL 溜め中の重力収束エフェクトの次回発生時刻 */
  const hammerChargeFxNextRef = useRef(0);
  /** 他の近接武器の溜め収束エフェクトの次回発生時刻 */
  const meleeChargeFxNextRef = useRef(0);
  /** ヒットストップ: この時刻(秒)まではゲーム時間をほぼ止める（近接の命中の重み） */
  const hitStopUntilRef = useRef(0);
  /** 斬撃に合わせたカメラのロール（ばね）。v = 角度(rad), vel = 角速度 */
  const camRollRef = useRef({ v: 0, vel: 0 });
  /**
   * エフェクト用の点光源プール。点光源を足し引きするとシーンのライト数が変わり、全マテリアルの
   * シェーダ切り替え（再コンパイル）でカクつくため、固定数を使い回す。
   */
  const fxLightPoolRef = useRef<THREE.PointLight[]>([]);
  const fxLightSeqRef = useRef(0);
  const acquireFxLight = (color: THREE.ColorRepresentation, intensity: number, dist: number, pos: THREE.Vector3): THREE.PointLight => {
    const pool = fxLightPoolRef.current;
    if (!pool.length) {
      const l = new THREE.PointLight(color, intensity, dist);
      l.position.copy(pos);
      sceneRef.current?.add(l);
      return l;
    }
    // reuse the dimmest light
    let best = pool[0];
    for (const l of pool) if (l.intensity < best.intensity) best = l;
    best.color.set(color);
    best.intensity = intensity;
    best.distance = dist;
    best.position.copy(pos);
    best.userData.ownerId = ++fxLightSeqRef.current;
    return best;
  };
  /** 新兵装（円月輪・時限弾・誘導弾・フレア・針・音響・回転鋸・隕石・タレット・火炎）の弾と設置物 */
  const arsenalRef = useRef<Arsenal | null>(null);
  const arsenalCtxRef = useRef<ArsenalCtx | null>(null);
  /** INFERNO ROAR: 炎の音を数ティックごとに鳴らすためのカウンタ */
  const flameSfxRef = useRef(0);
  /** VIPERCOIL SERPENT STORM: 終了時刻（頭上で鞭を振り回す見た目） */
  const whipStormUntilRef = useRef(0);
  /** ORBITAL RONDO HALO ORBIT: 終了時刻（手元の円月輪を隠す） */
  const discHaloUntilRef = useRef(0);
  /** 近接武器の刃の軌跡（刃先を毎フレーム追う斬光リボン） */
  const weaponTrailsRef = useRef<{ trail: WeaponTrail; obj: THREE.Object3D; base: THREE.Vector3; tip: THREE.Vector3 }[]>([]);
  const meleeChargeReadyRef = useRef(false);
  const chargeGaugeRef = useRef<SVGSVGElement | null>(null);
  const chargePieRef = useRef<SVGPathElement | null>(null);
  /** Draw the charge pie gauge (progress 0..1 as a swept angle); null hides it. */
  /** PHOTON GATLING: fire-rate multiplier that grows the longer the current burst has been running. */
  const gatlingRateMul = () => {
    const elapsed = gatlingFireTotalRef.current - gatlingFireLeftRef.current;
    return 1 + GATLING_RATE_BONUS * Math.min(1, Math.max(0, elapsed / GATLING_RAMP_TIME));
  };
  const setChargeGauge = (progress: number | null, color = '#22d3ee') => {
    const svg = chargeGaugeRef.current;
    const pie = chargePieRef.current;
    if (!svg || !pie) return;
    if (progress === null || progress <= 0) {
      svg.style.opacity = '0';
      return;
    }
    const R = 24;
    const a = Math.min(progress, 0.9999) * Math.PI * 2;
    const x = 50 + R * Math.sin(a);
    const y = 50 - R * Math.cos(a);
    pie.setAttribute('d', `M50 50 L50 ${50 - R} A${R} ${R} 0 ${a > Math.PI ? 1 : 0} 1 ${x.toFixed(2)} ${y.toFixed(2)} Z`);
    pie.setAttribute('stroke', progress >= 1 ? '#ffffff' : color);
    svg.style.opacity = '1';
  };
  const damageTextsCounter = useRef(0);
  const slashFxIdCounter = useRef(0);

  // 3D Spatial Effects System (立体的な斬撃・衝撃波・火花・空間照明)
  const spatialEffectsRef = useRef<{
    mesh: THREE.Object3D;
    light?: THREE.PointLight;
    particles: {
      mesh: THREE.Mesh;
      velocity: THREE.Vector3;
      gravity: number;
      decay: number;
    }[];
    lifetime: number;
    maxLifetime: number;
    direction?: THREE.Vector3;
    forwardSpeed?: number;
    expansionRate?: number;
    onUpdate?: (progress: number, delta: number) => void;
    /** pooled light owner token captured on the first update */
    lightOwner?: number;
  }[]>([]);

  // Stage Physical Cover Objects (Barricades, Pillars, Consoles, Crates)
  const coverObjectsRef = useRef<CoverObject[]>([]);

  // Session Statistics
  const battleStats = useRef<BattleStats>({
    kills: 0,
    damageDealt: 0,
    damageTaken: 0,
    timeSeconds: 0,
    sweepsUsed: 0,
    headshots: 0,
    scrapEarned: 0,
    coresEarned: 0,
  });

  // Passive multipliers from Skill Tree
  const passivesRef = useRef({
    meleeDamageMultiplier: 1.0,
    meleeSpeedMultiplier: 1.0,
    rangedDamageMultiplier: 1.0,
    sweepRangeMultiplier: 1.0,
    sweepKnockbackMultiplier: 1.0,
    reloadSpeedMultiplier: 1.0,
    moveSpeedMultiplier: 1.0,
    dashCooldownMultiplier: 1.0,
    rechargeSpeedMultiplier: 1.0,
  });

  // Quick lookup helper for unlocked skill nodes
  const unlockedSkillsSet = React.useMemo(() => new Set(skillNodes.filter((n) => n.unlocked).map((n) => n.id)), [skillNodes]);
  const hasSkill = useCallback((skillId: string) => unlockedSkillsSet.has(skillId), [unlockedSkillsSet]);

  const maxHpRef = useRef(100);
  const maxShieldRef = useRef(80);
  const lastShieldHudSyncRef = useRef(0);
  // 無被弾回復の計測: 最後に被弾してからの経過秒数 / 前フレーム末の HP+シールド合計
  const sinceLastHitRef = useRef(0);
  const hpShieldPrevRef = useRef(0);

  // Calculate passives
  useEffect(() => {
    const p = {
      meleeDamageMultiplier: 1.0,
      meleeSpeedMultiplier: 1.0,
      rangedDamageMultiplier: 1.0,
      sweepRangeMultiplier: 1.0,
      sweepKnockbackMultiplier: 1.0,
      reloadSpeedMultiplier: 1.0,
      moveSpeedMultiplier: 1.0,
      dashCooldownMultiplier: 1.0,
      rechargeSpeedMultiplier: 1.0,
    };
    let totalHpBonus = 0;
    let totalShieldBonus = 0;
    skillNodes.forEach((node) => {
      if (node.unlocked) {
        const lv = getNodeLevel(node, nodeLevels);
        node.effects.forEach((rawEff) => {
          const eff = { ...rawEff, value: scaledEffectValue(rawEff.value, lv, node) };
          if (eff.stat === 'meleeDamage') p.meleeDamageMultiplier += eff.value;
          if (eff.stat === 'meleeSpeed') p.meleeSpeedMultiplier += eff.value;
          if (eff.stat === 'rangedDamage') p.rangedDamageMultiplier += eff.value;
          if (eff.stat === 'allDamage') {
            p.meleeDamageMultiplier += eff.value;
            p.rangedDamageMultiplier += eff.value;
          }
          if (eff.stat === 'sweepRange') p.sweepRangeMultiplier += eff.value;
          if (eff.stat === 'sweepKnockback') p.sweepKnockbackMultiplier += eff.value;
          if (eff.stat === 'reloadTime') p.reloadSpeedMultiplier += eff.value;
          if (eff.stat === 'moveSpeed') p.moveSpeedMultiplier += eff.value;
          if (eff.stat === 'dashCooldown') p.dashCooldownMultiplier += eff.value;
          if (eff.stat === 'rechargeSpeed') p.rechargeSpeedMultiplier += eff.value;
          if (eff.stat === 'maxHp') totalHpBonus += eff.value;
          if (eff.stat === 'maxShield') totalShieldBonus += eff.value;
        });
      }
    });
    passivesRef.current = p;
    maxHpRef.current = 100 + totalHpBonus;
    maxShieldRef.current = 80 + totalShieldBonus;
    playerHpRef.current = 100 + totalHpBonus;
    playerShieldRef.current = 80 + totalShieldBonus;
  }, [skillNodes, nodeLevels]);

  // Sync HUD state
  const syncHudState = useCallback(() => {
    const w = getActiveWeapon();
    const slot = currentSlotRef.current;
    const now = performance.now() / 1000;
    const timeSinceLastCombo = now - lastComboTimeRef.current;
    const comboTimerPct = timeSinceLastCombo < 0.75 ? Math.max(0, 1 - timeSinceLastCombo / 0.75) : 0;

    const meleeCooldownRemaining = Math.max(0, meleeCooldownUntilRef.current - now);
    const isMeleeCooldown = meleeCooldownRemaining > 0;
    const meleeCooldownPct =
      isMeleeCooldown && meleeCooldownDurationRef.current > 0
        ? Math.min(1, meleeCooldownRemaining / meleeCooldownDurationRef.current)
        : 0;

    const skillCooldownRemaining = Math.max(0, skillCooldownUntilRef.current - now);
    const skillCooldownPct = Math.min(1, skillCooldownRemaining / MELEE_CHARGE_SKILL_COOLDOWN);

    // 投擲系の武器の「いま場に出ている数 / 持ち手に残っている数」
    const throwInfoOf = (weaponId: string): { label: string; cur: number; max: number } | null => {
      const ars = arsenalRef.current;
      if (!ars) return null;
      if (weaponId === 'heavy_sentry') return { label: 'DEPLOYED', cur: ars.turretCount, max: MAX_TURRETS };
      if (weaponId === 'blade_disc') return { label: 'IN HAND', cur: Math.max(0, 2 - ars.chakramsThrown), max: 2 };
      return null;
    };

    const baseRecharge = (w.rechargeTime ?? 6.0) / (1 + (passivesRef.current.rechargeSpeedMultiplier - 1));
    const rechargePct =
      w.isRechargeable || w.modelType === 'dynamite'
        ? Math.min(1, rechargeTimerRef.current / baseRecharge)
        : 0;

    const bossEnemy = enemiesRef.current.find((e) => e.category === 'boss' && !e.isDead);
    setHudStats({
      boss: bossEnemy
        ? {
            name: (bossEnemy.name || 'BOSS').replace(/\s*\[BOSS\]\s*/g, ' ').trim(),
            hp: Math.max(0, Math.round(bossEnemy.hp)),
            maxHp: bossEnemy.maxHp,
            phase: bossEnemy.bossPhase ?? 1,
          }
        : null,
      hp: Math.round(playerHpRef.current),
      maxHp: maxHpRef.current,
      shield: Math.round(playerShieldRef.current),
      maxShield: maxShieldRef.current,
      stamina: Math.round(staminaRef.current),
      ammo: ammoStockRef.current[slot] ?? w.stats.maxAmmo,
      maxAmmo: w.stats.maxAmmo,
      currentSlot: slot,
      weaponName: w.name,
      category: w.category,
      modelType: w.modelType,
      weaponId: w.id,
      hasScope: hasOpticalScope(w),
      kills: killsRef.current,
      scrap: scrapCollectedRef.current,
      isReloading: isReloadingRef.current,
      reloadDuration: reloadDurationRef.current,
      reloadId: reloadIdRef.current,
      isGuarding: isGuardingRef.current,
      isSweeping: isSweepingRef.current,
      comboStep: comboStepRef.current,
      comboTimerPct,
      isMeleeCooldown,
      meleeCooldownRemaining,
      meleeCooldownPct,
      meleeCooldownReason: isMeleeCooldown ? meleeCooldownReasonRef.current : null,
      skillCooldownRemaining,
      skillCooldownPct,
      rechargePct,
      isRechargeable: !!(w.isRechargeable || w.modelType === 'dynamite'),
      throwInfo: throwInfoOf(w.id),
      // 投擲物の所持数は、手に持っていないスロットの分も右下のスロット表示に出す
      slotStock: (([1, 2, 3, 4] as WeaponSlot[]) as number[]).reduce<Record<number, { cur: number; max: number }>>((acc, sl) => {
        if (!activeLoadout[sl as WeaponSlot]) return acc;
        const sw = getWeaponInSlot(sl as WeaponSlot);
        if (sw.modelType !== 'dynamite') return acc;
        acc[sl] = { cur: ammoStockRef.current[sl as WeaponSlot] ?? sw.stats.maxAmmo, max: sw.stats.maxAmmo };
        return acc;
      }, {}),
    });
  }, [getActiveWeapon]);

  // 出撃時の弾数は、武器強化(maxAmmo)込みの最大値で満タンにする
  useEffect(() => {
    (([1, 2, 3, 4] as WeaponSlot[]).filter((s) => activeLoadout[s])).forEach((s) => {
      ammoStockRef.current[s] = getWeaponInSlot(s).stats.maxAmmo;
    });
    syncHudState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Floating text spawner
  const spawnDamageText = useCallback((text: string, color = '#0284c7') => {
    const id = ++damageTextsCounter.current;
    const rx = 48 + (Math.random() - 0.5) * 6;
    const ry = 46 + (Math.random() - 0.5) * 6;
    setFloatingTexts((prev) => [...prev, { id, text, x: rx, y: ry, color }]);
    setTimeout(() => {
      setFloatingTexts((prev) => prev.filter((item) => item.id !== id));
    }, 550);
  }, []);

  // 3D SPATIAL HIT IMPACT SPARKS (敵や遮蔽物に当たった際の立体的な破片・火花エフェクト)
  const spawn3DHitSparks = useCallback((hitPos: THREE.Vector3, color: string | number, count = 12) => {
    if (!sceneRef.current) return;
    const scene = sceneRef.current;
    const colorHex = new THREE.Color(color);
    const particles: typeof spatialEffectsRef.current[0]['particles'] = [];

    const sparkGroup = new THREE.Group();
    sparkGroup.position.copy(hitPos);
    scene.add(sparkGroup);

    for (let i = 0; i < count; i++) {
      const pGeo = new THREE.SphereGeometry(0.035, 4, 4);
      const pMat = new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 1.0 });
      const pMesh = new THREE.Mesh(pGeo, pMat);
      pMesh.position.copy(hitPos);
      scene.add(pMesh);

      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 4.2,
        Math.random() * 3.2 + 1.2,
        (Math.random() - 0.5) * 4.2
      );

      particles.push({
        mesh: pMesh,
        velocity: vel,
        gravity: 8.0,
        decay: 3.8,
      });
    }

    const hitLight = acquireFxLight(colorHex, 2.5, 4.0, hitPos);

    spatialEffectsRef.current.push({
      mesh: sparkGroup,
      light: hitLight,
      particles,
      lifetime: 0.22,
      maxLifetime: 0.22,
    });
  }, []);

  // BUBBLAS: a cheap, light-free burst (thin shell that swells and fades) where a bubble pops
  const spawnBubblePop = useCallback((pos: THREE.Vector3, size: number) => {
    if (!sceneRef.current || bubblePopsRef.current.length > 60) return;
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(1, 10, 8),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color().setHSL(Math.random(), 0.7, 0.8),
        transparent: true,
        opacity: 0.55,
        wireframe: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    mesh.position.copy(pos);
    mesh.scale.setScalar(size * 0.4);
    sceneRef.current.add(mesh);
    bubblePopsRef.current.push({ mesh, age: 0, life: 0.18, size });
  }, []);

  // ================= 3D DYNAMIC SWEPT BLADE SLICE GEOMETRY (剣・斧の流線型・傾き・ダイナミック立体軌道) =================
  const createDynamicSlashMesh = (
    step: number,
    weapon: Weapon
  ): {
    mesh: THREE.Group;
    tangentSparks: { pos: THREE.Vector3; vel: THREE.Vector3 }[];
  } => {
    const group = new THREE.Group();
    const isAxe = weapon.modelType === 'axe';
    const colorHex = new THREE.Color(weapon.color);

    const segments = 56;
    const pathPoints: THREE.Vector3[] = [];
    const normals: THREE.Vector3[] = [];

    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      let px = 0;
      let py = 0;
      let pz = -1.14;
      let nx = 0;
      let ny = 1;
      let nz = 0;

      if (isAxe) {
        // ================= AXE SWINGS (重量感のある超弩級ヘビークリーブ・叩きつけ) =================
        if (step === 1) {
          // COMBO 1 (斧): 右肩頭上から左下へ豪快に振り下ろす急傾斜大判ヘビースラッシュ！(傾き ~ -55°)
          px = 0.82 - 1.64 * t;
          py = 0.62 - 1.22 * t + 0.16 * Math.sin(t * Math.PI);
          pz = -1.16 + 0.32 * Math.sin(t * Math.PI);
          nx = 0.66;
          ny = -0.74;
          nz = 0.26;
        } else if (step === 2) {
          // COMBO 2 (斧): 地面すれすれの低い左側から右上へカチ上げるリバースアックス！(傾き ~ +52°)
          px = -0.80 + 1.60 * t;
          py = -0.56 + 1.14 * t + 0.16 * Math.sin(t * Math.PI);
          pz = -1.16 + 0.32 * Math.sin(t * Math.PI);
          nx = -0.66;
          ny = 0.74;
          nz = 0.26;
        } else if (step === 3) {
          // COMBO 3 (斧): 全身の体重を乗せた垂直ヘビースマッシュ唐竹割り！(完全垂直 90°)
          px = 0.03 * Math.sin(t * Math.PI);
          py = 1.05 - 2.05 * t;
          pz = -1.18 + 0.38 * Math.sin(t * Math.PI);
          nx = 0.96;
          ny = 0.0;
          nz = 0.28;
        } else {
          // COMBO 4 (斧 Sweep / Leap Slam): 大車輪全方位薙ぎ払い
          const angle = (1 - t) * Math.PI * 1.35 - Math.PI * 0.675;
          px = Math.sin(angle) * 1.25;
          py = -0.06 + 0.18 * Math.sin(t * Math.PI);
          pz = -0.96 - Math.cos(angle) * 0.42;
          nx = 0.0;
          ny = 0.96;
          nz = -0.28;
        }
      } else {
        // ================= SWORD / KATANA / GLAIVE / SCYTHE (鋭利な高周波刀身の流線型スラッシュ) =================
        if (step === 1) {
          // COMBO 1 (剣): 右肩上から左脇腹へ鋭利に斜め一閃する流麗な大袈裟斬り！(傾き ~ -40°)
          px = 0.88 - 1.76 * t;
          py = 0.52 - 1.04 * t + 0.18 * Math.sin(t * Math.PI);
          pz = -1.12 + 0.36 * Math.sin(t * Math.PI);
          nx = 0.60;
          ny = -0.79;
          nz = 0.26;
        } else if (step === 2) {
          // COMBO 2 (剣): 左脇から右上空へ鋭利に跳ね上がるリバース斬り上げ！(傾き ~ +44°)
          px = -0.86 + 1.72 * t;
          py = -0.48 + 0.98 * t + 0.18 * Math.sin(t * Math.PI);
          pz = -1.12 + 0.36 * Math.sin(t * Math.PI);
          nx = -0.60;
          ny = 0.79;
          nz = 0.26;
        } else if (step === 3) {
          // COMBO 3 (剣): 天上から手前足元へ唐竹割りする垂直必殺フィニッシャー！(垂直 90°)
          px = -0.02 + 0.04 * (1 - t);
          py = 0.96 - 1.92 * t;
          pz = -1.16 + 0.42 * Math.sin(t * Math.PI);
          nx = 0.96;
          ny = 0.0;
          nz = 0.28;
        } else {
          // COMBO 4 (剣 Sweep): 視界いっぱいに広がる流線型水平薙ぎ払い！(~245° panoramic arc)
          const angle = (1 - t) * Math.PI * 1.34 - Math.PI * 0.67;
          px = Math.sin(angle) * 1.22;
          py = -0.06 + 0.18 * Math.sin(t * Math.PI);
          pz = -0.96 - Math.cos(angle) * 0.42;
          nx = 0.0;
          ny = 0.96;
          nz = -0.28;
        }
      }

      pathPoints.push(new THREE.Vector3(px, py, pz));
      normals.push(new THREE.Vector3(nx, ny, nz).normalize());
    }

    // 大迫力のワイドスケール設定 (以前の約2.5倍に拡大)
    const baseWidth = isAxe
      ? (step === 4 ? 0.98 : step === 3 ? 0.90 : 0.74)
      : (step === 4 ? 0.86 : step === 3 ? 0.78 : 0.62);

    const buildRibbonGeo = (widthScale: number, zOffset: number) => {
      const positions: number[] = [];
      const uvs: number[] = [];
      const indices: number[] = [];

      for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const pt = pathPoints[i];
        const norm = normals[i];

        const taper = Math.pow(Math.sin(t * Math.PI), isAxe ? 0.42 : 0.48);
        const w = baseWidth * widthScale * Math.max(0.04, taper);

        // Outer cutting edge (斬撃の進行方向に大きく突き出る刃先)
        positions.push(pt.x + norm.x * w * 0.82, pt.y + norm.y * w * 0.82, pt.z + norm.z * w * 0.82 + zOffset);
        uvs.push(t, 1);

        // Inner trailing edge (流麗に尾を引く残光面)
        positions.push(pt.x - norm.x * w * 0.38, pt.y - norm.y * w * 0.38, pt.z - norm.z * w * 0.38 + zOffset);
        uvs.push(t, 0);
      }

      for (let i = 0; i < segments; i++) {
        const a = i * 2;
        const b = i * 2 + 1;
        const c = (i + 1) * 2;
        const d = (i + 1) * 2 + 1;
        indices.push(a, b, c);
        indices.push(c, b, d);
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      geo.setIndex(indices);
      geo.computeVertexNormals();
      return geo;
    };

    // 1. Outer luminous plasma aura
    const outerGeo = buildRibbonGeo(1.0, 0);
    const outerMat = new THREE.MeshBasicMaterial({
      color: colorHex,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
    });
    group.add(new THREE.Mesh(outerGeo, outerMat));

    // 2. Inner razor-sharp pure white cutting core
    const coreGeo = buildRibbonGeo(0.38, 0.005);
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 1.0,
      blending: THREE.AdditiveBlending,
    });
    group.add(new THREE.Mesh(coreGeo, coreMat));

    // 3. Trailing ghost energy ribbon (立体的な残光帯)
    const trailGeo = buildRibbonGeo(0.82, -0.035);
    const trailMat = new THREE.MeshBasicMaterial({
      color: colorHex,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.52,
      blending: THREE.AdditiveBlending,
    });
    group.add(new THREE.Mesh(trailGeo, trailMat));

    // Tangent particle sparks along the curved blade edge
    const tangentSparks: { pos: THREE.Vector3; vel: THREE.Vector3 }[] = [];
    const sparkCount = step === 4 ? 36 : step === 3 ? 30 : 24;
    for (let s = 0; s < sparkCount; s++) {
      const idx = Math.floor(THREE.MathUtils.lerp(3, segments - 3, s / sparkCount));
      const pt = pathPoints[idx];
      const nextPt = pathPoints[Math.min(segments, idx + 1)];
      const tangent = nextPt.clone().sub(pt).normalize();
      tangentSparks.push({
        pos: pt.clone(),
        vel: tangent.multiplyScalar(isAxe ? 5.2 : 6.8),
      });
    }

    return { mesh: group, tangentSparks };
  };

  // 3D SPATIAL MELEE SLASH & SHOCKWAVE EFFECTS (画面内に綺麗に全体が収まるスケールと視界角設計)
  const spawn3DMeleeSlashEffect = useCallback((step: number, weapon: Weapon, range?: number) => {
    if (!sceneRef.current || !cameraRef.current) return;
    const scene = sceneRef.current;
    const camera = cameraRef.current;

    // 武器ごとに固有の斬撃/打撃エフェクト（katana / glaive / dagger / chainspear / scythe / hammer / gauntlets）
    const meleeStyle = getMeleeStyle(weapon);
    if (meleeStyle !== 'lance' && meleeStyle !== 'generic') {
      const res = buildMeleeSwingFx({
        style: meleeStyle,
        step,
        variant: viewmodelAnimRef.current.meleeVariant,
        color: weapon.color,
        camera,
        scene,
        range: range ?? weapon.stats.range,
      });
      if (res) {
        spatialEffectsRef.current.push({
          mesh: res.group,
          light: res.light,
          particles: res.particles,
          lifetime: res.lifetime,
          maxLifetime: res.lifetime,
          direction: res.direction,
          forwardSpeed: res.forwardSpeed,
          expansionRate: res.expansionRate,
          onUpdate: res.onUpdate,
        });
        return;
      }
    }

    const colorHex = new THREE.Color(weapon.color);
    const origin = camera.position.clone();
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);

    const right = new THREE.Vector3();
    right.crossVectors(forward, _up).normalize();

    const up = new THREE.Vector3();
    up.crossVectors(right, forward).normalize();

    const fxGroup = new THREE.Group();
    fxGroup.position.copy(origin);
    fxGroup.quaternion.copy(camera.quaternion);

    const particles: typeof spatialEffectsRef.current[0]['particles'] = [];

    if (weapon.modelType === 'gauntlets') {
      // ================= 3D SUPERSONIC CONICAL SHOCKWAVE (大迫力パルス衝撃波) =================
      const outerR = step === 3 ? 1.45 : 0.88;
      const innerR = step === 3 ? 0.65 : 0.42;

      const ringGeo = new THREE.RingGeometry(innerR, outerR, 28);
      const ringMat = new THREE.MeshBasicMaterial({
        color: colorHex,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.position.set(0, 0, -1.18);
      fxGroup.add(ringMesh);

      const coreGeo = new THREE.RingGeometry(innerR * 0.35, innerR * 0.95, 24);
      const coreMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 1.0,
        blending: THREE.AdditiveBlending,
      });
      const coreMesh = new THREE.Mesh(coreGeo, coreMat);
      coreMesh.position.set(0, 0, -1.17);
      fxGroup.add(coreMesh);

      const coneGeo = new THREE.CylinderGeometry(0.18, step === 3 ? 1.05 : 0.72, 1.2, 16, 1, true);
      const coneMat = new THREE.MeshBasicMaterial({
        color: colorHex,
        wireframe: true,
        transparent: true,
        opacity: 0.75,
        blending: THREE.AdditiveBlending,
      });
      const coneMesh = new THREE.Mesh(coneGeo, coneMat);
      coneMesh.rotation.x = Math.PI / 2;
      coneMesh.position.set(0, 0, -1.55);
      fxGroup.add(coneMesh);

      // Particle sparks jetting forward in 3D
      const sparkTotal = step === 3 ? 32 : 22;
      for (let p = 0; p < sparkTotal; p++) {
        const pGeo = new THREE.SphereGeometry(0.04, 4, 4);
        const pMat = new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 1 });
        const pMesh = new THREE.Mesh(pGeo, pMat);

        const localPos = new THREE.Vector3(
          (Math.random() - 0.5) * 0.6,
          (Math.random() - 0.5) * 0.6,
          -1.15
        );
        localPos.applyQuaternion(camera.quaternion);
        pMesh.position.copy(origin).add(localPos);
        scene.add(pMesh);

        const pVel = forward.clone().multiplyScalar(9.5 + Math.random() * 4.5)
          .add(right.clone().multiplyScalar((Math.random() - 0.5) * 3.5))
          .add(up.clone().multiplyScalar((Math.random() - 0.5) * 3.5));

        particles.push({
          mesh: pMesh,
          velocity: pVel,
          gravity: 2.2,
          decay: 3.2,
        });
      }
    } else if (weapon.id === 'blade_thunder_lance') {
      // ================= VALKYRIE-07 THUNDER LANCE (迅雷衝角パイルランス貫通電磁ドリル) =================
      const drillLength = step === 3 ? 5.2 : 3.8;
      const drillGeo = new THREE.CylinderGeometry(0.06, 0.55, drillLength, 12, 1, true);
      const drillMat = new THREE.MeshBasicMaterial({
        color: 0x67e8f9,
        wireframe: true,
        transparent: true,
        opacity: 0.90,
        blending: THREE.AdditiveBlending,
      });
      const drillMesh = new THREE.Mesh(drillGeo, drillMat);
      drillMesh.rotation.x = Math.PI / 2;
      drillMesh.position.set(0, 0, -drillLength / 2 - 0.6);
      fxGroup.add(drillMesh);

      // Expanding coaxial shockwave rings
      [1.2, 2.5, 3.8].forEach((distZ, idx) => {
        const ringGeo = new THREE.RingGeometry(0.18 + idx * 0.12, 0.42 + idx * 0.18, 20);
        const ringMat = new THREE.MeshBasicMaterial({
          color: 0x38bdf8,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.85,
          blending: THREE.AdditiveBlending,
        });
        const rMesh = new THREE.Mesh(ringGeo, ringMat);
        rMesh.position.set(0, 0, -distZ);
        fxGroup.add(rMesh);
      });

      for (let p = 0; p < 28; p++) {
        const pGeo = new THREE.SphereGeometry(0.035, 4, 4);
        const pMat = new THREE.MeshBasicMaterial({ color: 0x67e8f9, transparent: true, opacity: 1 });
        const pMesh = new THREE.Mesh(pGeo, pMat);
        const localPos = new THREE.Vector3(
          (Math.random() - 0.5) * 0.35,
          (Math.random() - 0.5) * 0.35,
          -0.8 - Math.random() * 2.5
        );
        localPos.applyQuaternion(camera.quaternion);
        pMesh.position.copy(origin).add(localPos);
        scene.add(pMesh);
        const pVel = forward.clone().multiplyScalar(14.0 + Math.random() * 6.0)
          .add(right.clone().multiplyScalar((Math.random() - 0.5) * 2.0));
        particles.push({ mesh: pMesh, velocity: pVel, gravity: 0.5, decay: 3.5 });
      }
    } else {
      // ================= 3D DYNAMIC SWEPT SLICE MESH (袈裟斬り・逆袈裟・唐竹割り・ヘビーアックス) =================
      const { mesh: slashMesh, tangentSparks } = createDynamicSlashMesh(step, weapon);
      fxGroup.add(slashMesh);

      tangentSparks.forEach(({ pos, vel }) => {
        const pGeo = new THREE.SphereGeometry(0.038, 4, 4);
        const pMat = new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 1 });
        const pMesh = new THREE.Mesh(pGeo, pMat);

        const worldP = pos.clone().applyQuaternion(camera.quaternion);
        pMesh.position.copy(origin).add(worldP);
        scene.add(pMesh);

        const worldVel = vel.clone().applyQuaternion(camera.quaternion)
          .add(forward.clone().multiplyScalar(2.8));

        particles.push({
          mesh: pMesh,
          velocity: worldVel,
          gravity: 2.4,
          decay: 3.0,
        });
      });
    }

    // Dynamic 3D Point Light casting intense illumination on environment and enemies
    const fxLight = acquireFxLight(colorHex, 5.2, 13.0, origin.clone().addScaledVector(forward, 1.4));

    scene.add(fxGroup);

    spatialEffectsRef.current.push({
      mesh: fxGroup,
      light: fxLight,
      particles,
      lifetime: 0.34,
      maxLifetime: 0.34,
      direction: forward.clone(),
      forwardSpeed: step === 3 ? 2.2 : step === 4 ? 1.0 : 1.5,
      expansionRate: 0.16,
    });
  }, []);

  // 武器固有のヒットエフェクト（敵に当たった瞬間）
  const spawnMeleeHitFx = useCallback((style: ReturnType<typeof getMeleeStyle>, pos: THREE.Vector3, step: number, color: string) => {
    if (!sceneRef.current || !cameraRef.current) return;
    const res = buildMeleeHitFx(style, pos, step, color, sceneRef.current, cameraRef.current);
    if (!res) return;
    spatialEffectsRef.current.push({
      mesh: res.group,
      light: res.light,
      particles: res.particles,
      lifetime: res.lifetime,
      maxLifetime: res.lifetime,
      onUpdate: res.onUpdate,
    });
  }, []);

  /** GRAVITON MAUL 溜め中の重力収束エフェクト */
  const spawnHammerChargeFx = useCallback((p: number, color: string) => {
    if (!sceneRef.current || !cameraRef.current) return;
    const res = buildHammerChargeFx(cameraRef.current, sceneRef.current, color, p);
    spatialEffectsRef.current.push({
      mesh: res.group,
      light: res.light,
      particles: res.particles,
      lifetime: res.lifetime,
      maxLifetime: res.lifetime,
      onUpdate: res.onUpdate,
    });
  }, []);

  /** GRAVITON MAUL 叩きつけ着弾の大衝撃波エフェクト */
  const spawnHammerSlamFx = useCallback((radius: number, color: string) => {
    if (!sceneRef.current || !cameraRef.current) return;
    const res = buildHammerSlamFx(cameraRef.current, sceneRef.current, color, radius);
    spatialEffectsRef.current.push({
      mesh: res.group,
      light: res.light,
      particles: res.particles,
      lifetime: res.lifetime,
      maxLifetime: res.lifetime,
      onUpdate: res.onUpdate,
    });
  }, []);

  /** 全INFIGHT武器の溜め中に断続的に出す収束エフェクト（ハンマーは専用） */
  const spawnMeleeChargeFx = useCallback((style: ReturnType<typeof getMeleeStyle>, p: number, color: string) => {
    if (!sceneRef.current || !cameraRef.current) return;
    const res = buildMeleeChargeFx(style, cameraRef.current, sceneRef.current, color, p);
    spatialEffectsRef.current.push({
      mesh: res.group,
      light: res.light,
      particles: res.particles,
      lifetime: res.lifetime,
      maxLifetime: res.lifetime,
      onUpdate: res.onUpdate,
    });
  }, []);

  /** ヒットストップ: 命中の瞬間だけゲーム時間をほぼ止めて「斬った重さ」を出す（実時間で sec 秒） */
  const triggerHitStop = (sec: number) => {
    const now = performance.now() / 1000;
    hitStopUntilRef.current = Math.max(hitStopUntilRef.current, now + sec);
  };
  /** 振りの向きにカメラを少し傾ける（ばねで戻る）。+ = 右から左への振り */
  const swingCameraRoll = (amount: number) => {
    camRollRef.current.vel += amount;
  };
  /** 通常攻撃が当たった瞬間の手応え: 段が上がるほど長いヒットストップと強い揺れ */
  const meleeImpactFeel = (style: ReturnType<typeof getMeleeStyle>, step: number, hits: number) => {
    if (hits <= 0) return;
    const heavy = style === 'hammer' || style === 'anchor' || style === 'lance';
    const fast = style === 'dagger' || style === 'twinblade' || style === 'gauntlets' || style === 'rapier';
    let stop = step >= 3 ? 0.085 : 0.05;
    if (heavy) stop += 0.025;
    if (fast) stop *= 0.7;
    triggerHitStop(stop * Math.min(1.3, 0.9 + hits * 0.1));
    if (step >= 3) {
      const amp = heavy ? 0.09 : 0.045;
      const cur = cameraShakeRef.current;
      const now = performance.now() / 1000;
      if (now >= cur.until || cur.amp < amp) cameraShakeRef.current = { amp, until: now + 0.22, dur: 0.22 };
    }
  };

  // Safe pointer lock request
  const requestLock = useCallback(() => {
    const canvas = rendererRef.current?.domElement;
    if (canvas && typeof canvas.requestPointerLock === 'function') {
      try {
        const p = canvas.requestPointerLock();
        if (p && typeof (p as any).catch === 'function') {
          (p as any).catch(() => {});
        }
      } catch {}
    }
  }, []);

  // Resume Combat
  const resumeCombat = useCallback(() => {
    isPausedRef.current = false;
    setIsPaused(false);
    prevMousePos.current = null;
    requestLock();
  }, [requestLock]);

  // Pause Combat
  const pauseCombat = useCallback(() => {
    isPausedRef.current = true;
    setIsPaused(true);
    isMouseDownRef.current = false;
    gatlingChargeRef.current = 0;
    gatlingFireLeftRef.current = 0;
    spreaderHeatRef.current = 0;
    shr1nkerRef.current.charge = 0;
    shr1nkerRef.current.beamLeft = 0;
    chargeStartRef.current = 0;
    chargeReadyRef.current = false;
    isAimingRef.current = false;
    setIsAiming(false);
    if (document.pointerLockElement) {
      try {
        document.exitPointerLock();
      } catch {}
    }
  }, []);

  // DYNAMIC 3D VIEWMODEL MESH BUILDER
  // Aligns weapon pointing straight forward down the -Z axis for natural FPS ADS sight alignment
  const buildViewmodelForWeapon = useCallback((weapon: Weapon) => {
    const holder = weaponMeshHolderRef.current;
    if (!holder) return;

    // Dispose every nested mesh resource before clearing the hierarchy. Removing only the
    // top-level child's geometry left nested weapon parts behind on some model swaps.
    const disposeTree = (object: THREE.Object3D) => {
      object.traverse((node: any) => {
        if (node.geometry && typeof node.geometry.dispose === 'function') node.geometry.dispose();
        if (node.material) {
          const materials = Array.isArray(node.material) ? node.material : [node.material];
          materials.forEach((material: any) => {
            if (material && typeof material.dispose === 'function') material.dispose();
          });
        }
      });
    };
    while (holder.children.length > 0) {
      const child = holder.children[0];
      holder.remove(child);
      disposeTree(child);
    }

    // Always rebuild from a clean transform so attack/equip motion cannot accumulate
    // scale or rotation on the weapon model itself.
    holder.position.set(0, 0, 0);
    holder.rotation.set(0, 0, 0);
    holder.scale.set(1, 1, 1);

    populateBattleWeaponModel(holder, weapon);

    // 近接武器: 刃の根元と刃先を求めて、軌跡リボンを作り直す（ガントレットは拳の衝撃波で表現するので無し）
    weaponTrailsRef.current.forEach((t) => t.trail.dispose());
    weaponTrailsRef.current = [];
    const cam = cameraRef.current;
    if (cam && weapon.category === 'MELEE' && weapon.modelType !== 'gauntlets' && weapon.id !== 'blade_whip' && weapon.id !== 'blade_disc') {
      const roots: THREE.Object3D[] = [];
      if (weapon.modelType === 'twinblade') {
        ['twinBladeL', 'twinBladeR'].forEach((n) => {
          const o = holder.getObjectByName(n);
          if (o) roots.push(o);
        });
      } else {
        roots.push(holder);
      }
      roots.forEach((root) => {
        const a = findTrailAnchors(root, weapon.modelType === 'twinblade' ? '-z' : 'auto');
        if (!a) return;
        weaponTrailsRef.current.push({ trail: new WeaponTrail(cam, weapon.color), obj: root, base: a.base, tip: a.tip });
      });
    }
  }, []);

  // Switch weapon slot
  const switchWeapon = useCallback(
    (slot: WeaponSlot) => {
      if (!activeLoadout[slot]) {
        sound.playUiHover();
        setAnnouncement(`SLOT ${slot} // 未装備 [EMPTY]`);
        return;
      }
      sound.playUiClick();
      currentSlotRef.current = slot;
      isGuardingRef.current = false;
      isSweepingRef.current = false;
      isReloadingRef.current = false;
      grenadeAimRef.current = false;
      rechargeTimerRef.current = rechargeTimersRef.current[slot] ?? 0;
      chargeStartRef.current = 0;
      chargeReadyRef.current = false;
      railChargedRef.current = false;
      isAimingRef.current = false;
      setIsAiming(false);

      // Trigger smooth procedural draw/equip animation
      viewmodelAnimRef.current.drawProgress = 0.0;
      viewmodelAnimRef.current.reloadProgress = 0.0;

      const nextWeapon = getActiveWeapon();
      buildViewmodelForWeapon(nextWeapon);
      syncHudState();
    },
    [activeLoadout, getActiveWeapon, buildViewmodelForWeapon, syncHudState]
  );

  // Sweep Attack (STAMINA SYSTEM ABOLISHED - FREE MOBILITY & COMBAT)
  const executeSweepAttack = useCallback(() => {
    const now = performance.now() / 1000;
    if (isSweepingRef.current || now < skillCooldownUntilRef.current) return;
    battleStats.current.sweepsUsed++;
    sound.playSweepAttack();

    // 左右クリック技のクールタイム (0.5秒)
    const skillCooldown = MELEE_SKILL_COOLDOWN;
    skillCooldownUntilRef.current = now + MELEE_CHARGE_SKILL_COOLDOWN; // 溜め技は共通クールダウン（通常攻撃は使える）
    comboStepRef.current = 1;

    const activeW = getActiveWeapon();

    // Trigger bold 360-degree spin cleave animation
    viewmodelAnimRef.current.meleeActive = true;
    viewmodelAnimRef.current.meleeStep = 4;
    viewmodelAnimRef.current.meleeProgress = 0.0;

    // Bold forward momentum and camera impulse
    _forward.set(0, 0, -1).applyAxisAngle(_up, currentRotation.current.yaw);
    playerVelocity.current.add(_forward.clone().multiplyScalar(4.2));
    viewmodelAnimRef.current.recoilRotY = 0.28;

    // 3D Spatial Melee Slash Effect (武器固有の全方位技エフェクト)
    const sweepStyle = getMeleeStyle(activeW);
    const sweepProfile = getMeleeProfile(sweepStyle);
    spawn3DMeleeSlashEffect(4, activeW, 6.2 * passivesRef.current.sweepRangeMultiplier);

    isSweepingRef.current = true;
    setTimeout(() => {
      isSweepingRef.current = false;
      syncHudState();
    }, 380);

    const sweepRange = 6.2 * passivesRef.current.sweepRangeMultiplier;
    const sweepDamage = Math.round(activeW.stats.damage * 1.65 * passivesRef.current.meleeDamageMultiplier * getWeaponDamageMultiplier(activeW.id));
    const knockback = 20 * passivesRef.current.sweepKnockbackMultiplier;

    let hitCount = 0;
    enemiesRef.current.forEach((enemy) => {
      if (enemy.isDead) return;
      const dist = playerPos.current.distanceTo(enemy.mesh.position);
      if (dist <= sweepRange) {
        hitCount++;
        enemy.hp -= sweepDamage;
        battleStats.current.damageDealt += sweepDamage;
        sound.playEnemyHit();

        // 3D Hit Impact Sparks
        spawn3DHitSparks(enemy.mesh.position.clone().add(new THREE.Vector3(0, 0.8, 0)), activeW.color, 18);
        spawnMeleeHitFx(sweepStyle, enemy.mesh.position.clone().add(new THREE.Vector3(0, 0.8, 0)), 4, activeW.color);

        _toEnemy.subVectors(enemy.mesh.position, playerPos.current).normalize();
        _toEnemy.y = 0.35;
        enemy.velocity.add(_toEnemy.multiplyScalar(knockback));

        spawnDamageText(`SWEEP! -${sweepDamage}`, '#38bdf8');
        setHitMarkerActive(true);
        setTimeout(() => setHitMarkerActive(false), 120);
      }
    });

    if (hitCount > 0) {
      setAnnouncement(`${sweepProfile.moveNames[3]} // ${hitCount} ENEMIES HIT`);
    } else {
      setAnnouncement(`SWEEP ATTACK // ${sweepProfile.moveNames[3]}`);
    }
    syncHudState();
  }, [getActiveWeapon, spawnDamageText, syncHudState]);

  // EXECUTIONER TITAN LEAP SLAM ATTACK (右クリック+左クリックで前方に大ジャンプし、斧を叩きつける)
  const executeExecutionerLeapSlam = useCallback(() => {
    const now = performance.now() / 1000;
    if (isSweepingRef.current || now < skillCooldownUntilRef.current) return;
    battleStats.current.sweepsUsed++;

    // 左右クリック技のクールタイム (0.5秒)
    const skillCooldown = MELEE_SKILL_COOLDOWN;
    skillCooldownUntilRef.current = now + MELEE_CHARGE_SKILL_COOLDOWN; // 溜め技は共通クールダウン（通常攻撃は使える）
    comboStepRef.current = 1;

    // 1. High leap forward into the air!
    _forward.set(0, 0, -1).applyAxisAngle(_up, currentRotation.current.yaw);
    playerVelocity.current.y = 22.0; // 頂点まで約0.85秒・高さ約9m の大ジャンプ
    playerVelocity.current.add(_forward.clone().multiplyScalar(11.0));
    isAirborneDashJumpRef.current = true;

    sound.playBladeSlash(3);
    sound.playSweepAttack();
    setAnnouncement('EXECUTIONER // TITAN LEAP SLAM!');

    // Trigger slam visual in viewmodel
    viewmodelAnimRef.current.slamActive = true;
    viewmodelAnimRef.current.slamProgress = 0.0;
    viewmodelAnimRef.current.slamPhase = 1;
    viewmodelAnimRef.current.slamTime = 0;
    isSweepingRef.current = true;

    // Brief launch, then force a steep dive. Resolve the slam only after ground contact.
    setTimeout(() => {
      if (playerPos.current.y > 1.72) {
        playerVelocity.current.y = -30;
      }
      // 頂点で一瞬溜めてから、ハンマーを全力で叩きつける急降下フェーズへ
      viewmodelAnimRef.current.slamPhase = 3;
      viewmodelAnimRef.current.slamTime = 0;
      const slamWaitStartedAt = performance.now();
      const waitForGroundContact = () => {
        const grounded = playerPos.current.y <= 1.72 && playerVelocity.current.y <= 0.5;
        // Avoid leaving the attack state locked if a collision edge case prevents landing.
        if (!grounded && performance.now() - slamWaitStartedAt < 2200) {
          setTimeout(waitForGroundContact, 16);
          return;
        }
        playerPos.current.y = 1.7;
        playerVelocity.current.y = 0;
        isAirborneDashJumpRef.current = false;
        isSweepingRef.current = false;
      sound.playHeavyLaunch();
      sound.playEnemyExplode();

      // 着弾演出: 多重衝撃波 / 重力ドーム / 亀裂 / 破片、反動と画面揺れ
      const slamFxRadius = 8.5 * passivesRef.current.sweepRangeMultiplier;
      spawnHammerSlamFx(slamFxRadius, getActiveWeapon().color);
      viewmodelAnimRef.current.slamPhase = 4;
      viewmodelAnimRef.current.slamTime = 0;
      cameraShakeRef.current = { amp: 0.22, until: performance.now() / 1000 + 0.55, dur: 0.55 };
      setTimeout(() => sound.playEnemyExplode(), 70);

      // Camera recoil shake
      viewmodelAnimRef.current.recoilPos.z = 0.2;
      viewmodelAnimRef.current.recoilRotX = -0.38;

      // AOE shockwave damage to all enemies within 8.5m
      const activeW = getActiveWeapon();
      const slamDamage = Math.round(activeW.stats.damage * 2.5 * passivesRef.current.meleeDamageMultiplier * getWeaponDamageMultiplier(activeW.id));
      const slamRadius = 8.5 * passivesRef.current.sweepRangeMultiplier;
      let hitCount = 0;

      enemiesRef.current.forEach((enemy) => {
        if (enemy.isDead) return;
        const dist = playerPos.current.distanceTo(enemy.mesh.position);
        if (dist <= slamRadius) {
          hitCount++;
          enemy.hp -= slamDamage;
          battleStats.current.damageDealt += slamDamage;
          _toEnemy.subVectors(enemy.mesh.position, playerPos.current).normalize();
          _toEnemy.y = 0.6; // Launch enemies into air
          enemy.velocity.add(_toEnemy.multiplyScalar(24));

          spawn3DHitSparks(enemy.mesh.position.clone().add(new THREE.Vector3(0, 0.8, 0)), '#f97316', 24);
          spawnDamageText(`TITAN SLAM! -${slamDamage}`, '#f97316');
        }
      });

      if (hitCount > 0) {
        setHitMarkerActive(true);
        setTimeout(() => setHitMarkerActive(false), 140);
        setAnnouncement(`TITAN SLAM // ${hitCount} ENEMIES CRUSHED!`);
      }
      syncHudState();
      };
      waitForGroundContact();
    }, 800);
  }, [spawnDamageText, syncHudState, spawnHammerSlamFx]);

  // VALKYRIE THUNDER LANCE PILE BUNKER CHARGE THRUST (ガード長押し+攻撃で超高速突進パイル貫通突き)
  const executeThunderLanceThrust = useCallback(() => {
    const now = performance.now() / 1000;
    if (isSweepingRef.current || now < skillCooldownUntilRef.current) return;
    battleStats.current.sweepsUsed++;

    // 左右クリック技のクールタイム (0.5秒)
    const skillCooldown = MELEE_SKILL_COOLDOWN;
    skillCooldownUntilRef.current = now + MELEE_CHARGE_SKILL_COOLDOWN; // 溜め技は共通クールダウン（通常攻撃は使える）
    comboStepRef.current = 1;

    // Explosive forward rocket dash
    _forward.set(0, 0, -1).applyAxisAngle(_up, currentRotation.current.yaw);
    const thrustOrigin = playerPos.current.clone();
    const thrustDirection = _forward.clone().normalize();
    skillDashRef.current = { x: thrustDirection.x, z: thrustDirection.z, speed: 42, until: now + 0.26 }; // 約11m突進
    sound.playBladeSlash(3);
    sound.playSweepAttack();
    sound.playHeavyLaunch();
    setAnnouncement('VALKYRIE // THUNDER THRUST (迅雷超突進貫通突き)!');

    viewmodelAnimRef.current.meleeActive = true;
    viewmodelAnimRef.current.meleeStep = 3;
    viewmodelAnimRef.current.meleeProgress = 0.0;
    viewmodelAnimRef.current.recoilRotX = -0.35;
    isSweepingRef.current = true;

    // Pierce shockwave line
    setTimeout(() => {
      isSweepingRef.current = false;
      const activeW = getActiveWeapon();
      const thrustDamage = Math.round(activeW.stats.damage * 2.2 * passivesRef.current.meleeDamageMultiplier * getWeaponDamageMultiplier(activeW.id) * consumeLanceCharge(activeW.id));
      const thrustRange = 11.5 * passivesRef.current.sweepRangeMultiplier;
      let hitCount = 0;

      enemiesRef.current.forEach((enemy) => {
        if (enemy.isDead) return;
        const relative = _toEnemy.subVectors(enemy.mesh.position, thrustOrigin);
        const along = relative.dot(thrustDirection);
        const lateral = relative.clone().addScaledVector(thrustDirection, -along).length();
        if (along >= 0 && along <= thrustRange && lateral <= 2.2) {
            hitCount++;
            enemy.hp -= thrustDamage;
            battleStats.current.damageDealt += thrustDamage;
            enemy.velocity.add(_forward.clone().multiplyScalar(28));
            spawn3DHitSparks(enemy.mesh.position.clone().add(new THREE.Vector3(0, 0.8, 0)), '#06b6d4', 28);
            spawnDamageText(`THUNDER THRUST! -${thrustDamage}`, '#06b6d4');
        }
      });

      if (hitCount > 0) {
        sound.playEnemyHit();
        setHitMarkerActive(true);
        setTimeout(() => setHitMarkerActive(false), 140);
        setAnnouncement(`THUNDER THRUST // ${hitCount} ENEMIES PIERCED!`);
      }
      syncHudState();
    }, 280);
  }, [spawnDamageText, syncHudState]);

  // ───────────── RAVAGER-09 PLASMA CHAINSAW ─────────────

  /** Shows the summed grind damage as one popup (ticks are too fast for a popup each). */
  const flushChainsawText = useCallback((force = false) => {
    const acc = sawTextRef.current;
    const now = performance.now() / 1000;
    if (acc.dmg > 0 && (force || now - acc.t >= 0.35)) {
      spawnDamageText(`GRIND! -${Math.round(acc.dmg)}`, '#ef4444');
      acc.dmg = 0;
      acc.t = now;
    }
  }, [spawnDamageText]);

  /**
   * One chainsaw contact: damages the nearest enemies in front of the bar.
   * `drop` = the opening overhead strike (more damage, small knockback); otherwise a grind tick that pins the target.
   */
  const chainsawStrike = useCallback((w: Weapon, mult: number, drop: boolean): number => {
    _forward.set(0, 0, -1).applyAxisAngle(_up, currentRotation.current.yaw);
    const profile = getMeleeProfile('chainsaw');
    const range = (w.stats.range + (drop ? 0.6 : 0)) * passivesRef.current.sweepRangeMultiplier;
    const base = w.stats.damage * mult * passivesRef.current.meleeDamageMultiplier * getWeaponDamageMultiplier(w.id);
    const bleedDps = hasSkill('saw_mod_serrate') ? 30 : 0;
    const targets = enemiesRef.current
      .filter((e) => {
        if (e.isDead) return false;
        const to = _toEnemy.subVectors(e.mesh.position, playerPos.current);
        return to.length() <= range && _forward.dot(to.normalize()) > profile.arcDot;
      })
      .sort((a, b) => a.mesh.position.distanceToSquared(playerPos.current) - b.mesh.position.distanceToSquared(playerPos.current))
      .slice(0, drop ? 4 : 3); // the bar only reaches a few bodies at once

    targets.forEach((enemy, i) => {
      let dmg = base;
      if ((enemy.frozenTimer ?? 0) > 0) dmg *= hasSkill('frost_mod_damage') ? 1.6 : 1.25;
      dmg = Math.round(dmg);
      enemy.hp -= dmg;
      battleStats.current.damageDealt += dmg;
      if (drop) {
        enemy.velocity.addScaledVector(_forward, 4);
      } else {
        // 刃が食い込んで動きを止める
        enemy.velocity.multiplyScalar(0.35);
        enemy.velocity.addScaledVector(_forward, 0.5);
      }
      // 削られている敵は怯んで攻撃できない（ボスは遅らせるだけ。横や後ろの敵は普通に殴ってくる）
      if (enemy.category === 'boss') enemy.attackCooldown += drop ? 0.25 : 0.03;
      else enemy.attackCooldown = Math.max(enemy.attackCooldown, drop ? 0.6 : 0.3);
      if (bleedDps > 0) {
        enemy.bleedTimer = 3;
        enemy.bleedDps = Math.max(enemy.bleedDps ?? 0, bleedDps);
      }
      // contact point: the side of the enemy facing the player
      const hitPos = enemy.mesh.position.clone().add(new THREE.Vector3(0, 0.8, 0));
      hitPos.add(playerPos.current.clone().sub(hitPos).setY(0).normalize().multiplyScalar(0.45));
      if (i === 0 || drop) spawnMeleeHitFx('chainsaw', hitPos, drop ? 3 : 1, w.color);
      if (drop) {
        spawn3DHitSparks(hitPos, '#fbbf24', 18);
        spawnDamageText(`RAVAGE DROP! -${dmg}`, '#e11d48');
      } else {
        sawTextRef.current.dmg += dmg;
      }
    });
    if (targets.length > 0) {
      setHitMarkerActive(true);
      setTimeout(() => setHitMarkerActive(false), 60);
    }
    return targets.length;
  }, [getWeaponDamageMultiplier, hasSkill, spawnMeleeHitFx, spawn3DHitSparks, spawnDamageText]);

  /** Called every frame while the left button is held: opening drop, then rapid grind ticks. */
  const updateChainsawGrind = useCallback(() => {
    const start = sawGrindStartRef.current;
    if (start === 0) return;
    const now = performance.now() / 1000;
    const w = getActiveWeapon();
    const held = now - start;
    // 回転数: 振り下ろし後 0.8 秒で最高回転（リミッター解除で即最高回転）
    sawRpmRef.current = hasSkill('saw_mod_rpm') ? 1 : Math.min(1, Math.max(0, held - SAW_DROP_TIME) / 0.8);
    if (held < SAW_DROP_TIME) return;

    if (!sawDropDoneRef.current) {
      sawDropDoneRef.current = true;
      spawn3DMeleeSlashEffect(1, w, w.stats.range);
      viewmodelAnimRef.current.recoilRotX = -0.22;
      viewmodelAnimRef.current.recoilPos.y = -0.08;
      const n = chainsawStrike(w, 2.4, true);
      if (n > 0) sound.playEnemyHit();
      sawNextTickRef.current = now + 0.05;
      sawTextRef.current.t = now;
      syncHudState();
      return;
    }

    if (now < sawNextTickRef.current) return;
    // 攻撃間隔: 回転数に応じて fireRate の 55% → 100%（12回/秒、強化で約16回/秒）
    const rate = w.stats.fireRate * (passivesRef.current.meleeSpeedMultiplier || 1) * (0.55 + 0.45 * sawRpmRef.current);
    sawNextTickRef.current = Math.max(sawNextTickRef.current + 1 / rate, now);
    const n = chainsawStrike(w, 1 + 0.25 * sawRpmRef.current, false);
    sound.playChainsawTick(sawRpmRef.current, n > 0);
    viewmodelAnimRef.current.recoilRotX += n > 0 ? -0.02 : -0.006;
    flushChainsawText();
  }, [getActiveWeapon, hasSkill, chainsawStrike, flushChainsawText, spawn3DMeleeSlashEffect, syncHudState]);
  const updateChainsawGrindRef = useRef(updateChainsawGrind);
  updateChainsawGrindRef.current = updateChainsawGrind;

  const endChainsawGrind = useCallback(() => {
    if (sawGrindStartRef.current === 0) return;
    sawGrindStartRef.current = 0;
    sawDropDoneRef.current = false;
    sawRpmRef.current = 0;
    flushChainsawText(true);
  }, [flushChainsawText]);
  const endChainsawGrindRef = useRef(endChainsawGrind);
  endChainsawGrindRef.current = endChainsawGrind;

  // RIPPER RUSH (右クリック+左クリック): 出力全開で突進し、巻き込んだ敵を引きずりながら切り刻み、最後に斬り上げる
  const executeRipperRush = useCallback(() => {
    const now = performance.now() / 1000;
    if (isSweepingRef.current || now < skillCooldownUntilRef.current) return;
    battleStats.current.sweepsUsed++;
    endChainsawGrind();

    const rushDuration = 0.5;
    const ticks = 8 + (hasSkill('saw_mod_serrate') ? 4 : 0);
    // 左右クリック技のクールタイム (突進が終わってから 0.5秒)
    const skillCooldown = rushDuration + MELEE_SKILL_COOLDOWN;
    skillCooldownUntilRef.current = now + MELEE_CHARGE_SKILL_COOLDOWN; // 溜め技は共通クールダウン（通常攻撃は使える）
    comboStepRef.current = 1;

    const w = getActiveWeapon();
    const dir = new THREE.Vector3(0, 0, -1).applyAxisAngle(_up, currentRotation.current.yaw);
    const lateralAxis = new THREE.Vector3(1, 0, 0).applyAxisAngle(_up, currentRotation.current.yaw);
    skillDashRef.current = { x: dir.x, z: dir.z, speed: 22, until: now + rushDuration }; // 約11m突進
    sawRushUntilRef.current = now + rushDuration;
    isSweepingRef.current = true;
    viewmodelAnimRef.current.meleeActive = false;
    viewmodelAnimRef.current.recoilRotX = -0.2;
    sound.playChainsawRev(true);
    sound.playSweepAttack();
    spawn3DMeleeSlashEffect(4, w, 8);
    setAnnouncement('RAVAGER-09 // RIPPER RUSH!');

    const base = w.stats.damage * passivesRef.current.meleeDamageMultiplier * getWeaponDamageMultiplier(w.id);
    const caught = new Set<EnemyInstance>();
    const dealt = new Map<EnemyInstance, number>();
    const hurt = (enemy: EnemyInstance, dmg: number) => {
      enemy.hp -= dmg;
      battleStats.current.damageDealt += dmg;
      dealt.set(enemy, (dealt.get(enemy) ?? 0) + dmg);
    };

    for (let i = 0; i < ticks; i++) {
      setTimeout(() => {
        // 進路上の敵を巻き込む
        enemiesRef.current.forEach((enemy) => {
          if (enemy.isDead || caught.has(enemy)) return;
          const rel = enemy.mesh.position.clone().sub(playerPos.current);
          const along = rel.dot(dir);
          if (along > -0.5 && along < 4.2 && Math.abs(rel.dot(lateralAxis)) < 2.0) caught.add(enemy);
        });
        let first = true;
        caught.forEach((enemy) => {
          if (enemy.isDead) return;
          hurt(enemy, Math.round(base * 0.9));
          // 刃の前に引きずる
          const hold = playerPos.current.clone().addScaledVector(dir, 2.0);
          enemy.mesh.position.x += (hold.x - enemy.mesh.position.x) * 0.5;
          enemy.mesh.position.z += (hold.z - enemy.mesh.position.z) * 0.5;
          enemy.velocity.set(0, enemy.velocity.y, 0);
          if (first) {
            spawnMeleeHitFx('chainsaw', enemy.mesh.position.clone().add(new THREE.Vector3(0, 0.8, 0)), 3, w.color);
            first = false;
          }
        });
        sound.playChainsawTick(1, caught.size > 0);
        viewmodelAnimRef.current.recoilRotX += -0.03;
      }, (i * rushDuration * 1000) / ticks);
    }

    // フィニッシュ: 斬り上げて吹き飛ばす
    setTimeout(() => {
      isSweepingRef.current = false;
      sawRushUntilRef.current = 0;
      let hitCount = 0;
      caught.forEach((enemy) => {
        if (enemy.isDead) return;
        hitCount++;
        hurt(enemy, Math.round(base * 3.2));
        enemy.velocity.addScaledVector(dir, 14);
        enemy.velocity.y += 9;
        spawn3DHitSparks(enemy.mesh.position.clone().add(new THREE.Vector3(0, 0.9, 0)), '#ef4444', 26);
      });
      dealt.forEach((dmg) => spawnDamageText(`RIPPER RUSH! -${dmg}`, '#ef4444'));
      viewmodelAnimRef.current.recoilRotX = 0.3;
      viewmodelAnimRef.current.recoilPos.y = 0.06;
      if (hitCount > 0) {
        sound.playEnemyHit();
        sound.playBladeSlash(3);
        setHitMarkerActive(true);
        setTimeout(() => setHitMarkerActive(false), 140);
        setAnnouncement(`RIPPER RUSH // ${hitCount} ENEMIES SHREDDED!`);
      }
      syncHudState();
    }, rushDuration * 1000);
  }, [endChainsawGrind, getActiveWeapon, getWeaponDamageMultiplier, hasSkill, spawnMeleeHitFx, spawn3DHitSparks, spawnDamageText, spawn3DMeleeSlashEffect, syncHudState]);

  // VORTEX SCYTHE: REAPER TEMPEST（溜め技）。大きく前進しながら大鎌を周囲へ振り回し、周囲を巻き込んで最後に吹き飛ばす
  const executeScytheTempest = useCallback(() => {
    const now = performance.now() / 1000;
    if (isSweepingRef.current || now < skillCooldownUntilRef.current) return;
    battleStats.current.sweepsUsed++;

    const D = SCYTHE_TEMPEST_TIME;
    const skillCooldown = D + MELEE_SKILL_COOLDOWN;
    skillCooldownUntilRef.current = now + MELEE_CHARGE_SKILL_COOLDOWN; // 溜め技は共通クールダウン（通常攻撃は使える）
    comboStepRef.current = 1;

    const w = getActiveWeapon();
    const dir = new THREE.Vector3(0, 0, -1).applyAxisAngle(_up, currentRotation.current.yaw);
    skillDashRef.current = { x: dir.x, z: dir.z, speed: 15, until: now + D * 0.92 }; // 約14m前進
    isSweepingRef.current = true;
    scytheTempestStartRef.current = now;
    scytheTempestUntilRef.current = now + D;
    viewmodelAnimRef.current.meleeActive = false;
    viewmodelAnimRef.current.recoilRotX = 0.2;
    sound.playSweepAttack();
    sound.playMeleeSwing('scythe', 3);
    setAnnouncement('VORTEX SCYTHE // REAPER TEMPEST!');

    // 足元の暗黒渦（プレイヤーに追従しながら回転）
    if (sceneRef.current) {
      const col = new THREE.Color(w.color);
      const mat = (c: THREE.ColorRepresentation, o: number) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false });
      const vortex = new THREE.Group();
      const blades = new THREE.Group();
      for (let i = 0; i < 4; i++) {
        const b = new THREE.Mesh(new THREE.RingGeometry(2.2, 7.4, 32, 1, (i * Math.PI) / 2, Math.PI * 0.34), mat(i % 2 ? 0xf0abfc : col, 0.8));
        blades.add(b);
      }
      blades.rotation.x = -Math.PI / 2;
      vortex.add(blades);
      const rim = new THREE.Mesh(new THREE.RingGeometry(7.2, 7.5, 64), mat(0xe9d5ff, 0.9));
      rim.rotation.x = -Math.PI / 2;
      vortex.add(rim);
      const well = new THREE.Mesh(new THREE.CircleGeometry(7.2, 48), mat(0x581c87, 0.22));
      well.rotation.x = -Math.PI / 2;
      vortex.add(well);
      vortex.position.set(playerPos.current.x, 0.1, playerPos.current.z);
      sceneRef.current.add(vortex);
      spatialEffectsRef.current.push({
        mesh: vortex,
        particles: [],
        lifetime: D + 0.2,
        maxLifetime: D + 0.2,
        onUpdate: (_p, d) => {
          vortex.position.set(playerPos.current.x, 0.1, playerPos.current.z);
          blades.rotation.z -= d * 16;
        },
      });
    }

    const base = w.stats.damage * passivesRef.current.meleeDamageMultiplier * getWeaponDamageMultiplier(w.id);
    const dealt = new Map<EnemyInstance, number>();
    const hurt = (enemy: EnemyInstance, dmg: number) => {
      enemy.hp -= dmg;
      battleStats.current.damageDealt += dmg;
      dealt.set(enemy, (dealt.get(enemy) ?? 0) + dmg);
    };
    const around = (radius: number, fn: (enemy: EnemyInstance, dist: number) => void) =>
      enemiesRef.current.forEach((enemy) => {
        if (enemy.isDead) return;
        const dist = playerPos.current.distanceTo(enemy.mesh.position);
        if (dist <= radius) fn(enemy, dist);
      });

    // 前進しながら連続して周囲を斬り裂く
    const ticks = 7;
    for (let i = 0; i < ticks; i++) {
      setTimeout(() => {
        let fx = 0;
        around(7.5, (enemy) => {
          hurt(enemy, Math.round(base * 0.8));
          // 渦に引き込む（斬撃範囲に留める）
          const pull = playerPos.current.clone().sub(enemy.mesh.position).setY(0).normalize();
          enemy.velocity.addScaledVector(pull, 4);
          const hitPos = enemy.mesh.position.clone().add(new THREE.Vector3(0, 0.8, 0));
          spawn3DHitSparks(hitPos, '#e9d5ff', 8);
          if (fx++ < 3) spawnMeleeHitFx('scythe', hitPos, 3, w.color);
        });
        if (i % 2 === 0) spawn3DMeleeSlashEffect(4, w, 7.5);
        sound.playMeleeSwing('scythe', 1 + (i % 3));
        if (fx > 0) sound.playEnemyHit();
        viewmodelAnimRef.current.recoilRotY = (i % 2 ? 1 : -1) * 0.1;
      }, D * 1000 * (0.12 + (0.72 * i) / (ticks - 1)));
    }

    // フィニッシュ: 周囲を一閃して大きく吹き飛ばす
    setTimeout(() => {
      isSweepingRef.current = false;
      let hitCount = 0;
      around(9, (enemy) => {
        hitCount++;
        hurt(enemy, Math.round(base * 2.6));
        const away = enemy.mesh.position.clone().sub(playerPos.current).setY(0);
        if (away.lengthSq() < 0.0001) away.copy(dir);
        enemy.velocity.addScaledVector(away.normalize(), 24);
        enemy.velocity.y += 9;
        const hitPos = enemy.mesh.position.clone().add(new THREE.Vector3(0, 0.9, 0));
        spawn3DHitSparks(hitPos, '#d8b4fe', 24);
        spawnMeleeHitFx('scythe', hitPos, 3, w.color);
      });
      spawn3DMeleeSlashEffect(3, w, 9);
      spawn3DMeleeSlashEffect(4, w, 9);
      let total = 0;
      dealt.forEach((dmg) => {
        total += dmg;
        spawnDamageText(`TEMPEST! -${dmg}`, '#c084fc');
      });
      // 刈り取った魂でHPを少し回復
      const heal = Math.min(40, Math.round(total * 0.04));
      if (heal > 0) {
        playerHpRef.current = Math.min(maxHpRef.current, playerHpRef.current + heal);
        spawnDamageText(`SOUL DRAIN +${heal}`, '#c084fc');
      }
      viewmodelAnimRef.current.recoilRotX = -0.35;
      viewmodelAnimRef.current.recoilPos.y = -0.14;
      sound.playBladeSlash(3);
      if (hitCount > 0) {
        sound.playEnemyHit();
        setHitMarkerActive(true);
        setTimeout(() => setHitMarkerActive(false), 160);
        setAnnouncement(`REAPER TEMPEST // ${hitCount} SOULS HARVESTED!`);
      }
      syncHudState();
    }, D * 1000);
  }, [getActiveWeapon, getWeaponDamageMultiplier, spawnMeleeHitFx, spawn3DHitSparks, spawnDamageText, spawn3DMeleeSlashEffect, syncHudState]);

  // ───────────────────────── 溜め技（右クリック溜め + 左クリック）: 武器ごとの固有技 ─────────────────────────
  type SkillCtx = { now: number; w: Weapon; dir: THREE.Vector3; base: number };
  /** 溜め技の共通開始処理。使えない状態なら null */
  const beginMeleeSkill = (duration: number, announce: string): SkillCtx | null => {
    const now = performance.now() / 1000;
    if (isSweepingRef.current || now < skillCooldownUntilRef.current) return null;
    battleStats.current.sweepsUsed++;
    const cd = duration + MELEE_SKILL_COOLDOWN;
    skillCooldownUntilRef.current = now + MELEE_CHARGE_SKILL_COOLDOWN; // 溜め技は共通クールダウン（通常攻撃は使える）
    comboStepRef.current = 1;
    const w = getActiveWeapon();
    const dir = new THREE.Vector3(0, 0, -1).applyAxisAngle(_up, currentRotation.current.yaw);
    isSweepingRef.current = true;
    sound.playSweepAttack();
    setAnnouncement(announce);
    return { now, w, dir, base: w.stats.damage * passivesRef.current.meleeDamageMultiplier * getWeaponDamageMultiplier(w.id) };
  };
  const endMeleeSkill = () => {
    isSweepingRef.current = false;
    syncHudState();
  };
  const startSkillDash = (dir: THREE.Vector3, speed: number, seconds: number) => {
    skillDashRef.current = { x: dir.x, z: dir.z, speed, until: performance.now() / 1000 + seconds };
  };
  const skillSwing = (step: number) => {
    const a = viewmodelAnimRef.current;
    a.meleeActive = true;
    a.meleeStep = step;
    a.meleeProgress = 0;
  };
  const later = (ms: number, fn: () => void) => setTimeout(fn, ms);
  /** 技のダメージを敵ごとに集計し、最後にまとめて表示 */
  const makeDealer = (label: string, color: string) => {
    const dealt = new Map<EnemyInstance, number>();
    return {
      hurt: (enemy: EnemyInstance, dmg: number) => {
        enemy.hp -= dmg;
        battleStats.current.damageDealt += dmg;
        dealt.set(enemy, (dealt.get(enemy) ?? 0) + dmg);
      },
      flush: () => dealt.forEach((d) => spawnDamageText(`${label}! -${d}`, color)),
      /** 表示済みの集計を捨てる（区切って表示する技用） */
      reset: () => dealt.clear(),
      get total() {
        let t = 0;
        dealt.forEach((d) => (t += d));
        return t;
      },
    };
  };
  const enemyHitPos = (e: EnemyInstance) => e.mesh.position.clone().add(new THREE.Vector3(0, 0.85, 0));
  /**
   * ANCHRON-G2: moor an enemy. `markSec` = slowed + takes bonus anchor damage, `rootSec` = fully pinned in place
   * (bosses / titans are pinned for half as long). Drops a ring of chain links at its feet while it lasts.
   */
  const moorEnemy = (enemy: EnemyInstance, markSec: number, rootSec = 0) => {
    const bonus = hasSkill('anchor_mod_chain') ? 1.0 : 0;
    const heavy = enemy.category === 'boss' || enemy.category === 'titan';
    const wasMarked = (enemy.mooredTimer ?? 0) > 0;
    const wasRooted = (enemy.rootTimer ?? 0) > 0;
    enemy.mooredTimer = Math.max(enemy.mooredTimer ?? 0, markSec + (markSec > 0 ? bonus * 1.5 : 0));
    if (rootSec > 0) {
      const r = (rootSec + bonus) * (heavy ? 0.5 : 1);
      if (r > (enemy.rootTimer ?? 0)) enemy.rootTimer = r;
    }
    // only show the chain ring when something new happens (first mark, or a fresh pin)
    if ((wasMarked && rootSec <= 0) || wasRooted) return;
    const dur = Math.max(enemy.rootTimer ?? 0, 0.6);
    if (!sceneRef.current) return;
    const g = new THREE.Group();
    const mat = (c: number, o: number) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.95, 1.1, 32), mat(0x2dd4bf, 0.9));
    ring.rotation.x = -Math.PI / 2;
    g.add(ring);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const link = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.03, 5, 10), mat(i % 2 ? 0xe0fdf8 : 0x2dd4bf, 0.9));
      link.position.set(Math.cos(a) * 1.02, 0.12, Math.sin(a) * 1.02);
      link.rotation.set(i % 2 ? Math.PI / 2 : 0, a, 0);
      g.add(link);
    }
    g.position.set(enemy.mesh.position.x, 0.08, enemy.mesh.position.z);
    sceneRef.current.add(g);
    spatialEffectsRef.current.push({
      mesh: g,
      particles: [],
      lifetime: dur,
      maxLifetime: dur,
      onUpdate: (_p, d) => {
        g.position.set(enemy.mesh.position.x, 0.08, enemy.mesh.position.z);
        g.rotation.y += d * 1.2;
        if (enemy.isDead) g.visible = false;
      },
    });
    spawnDamageText('MOORED!', '#2dd4bf');
  };
  const hitFlash = (count = 1) => {
    setHitMarkerActive(true);
    setTimeout(() => setHitMarkerActive(false), 120 * count);
  };
  /** プレイヤーに追従して回る地面の円環エフェクト */
  const spawnSkillRings = (colorHex: string, radius: number, life: number, spin: number, accent: number | string = 0xffffff) => {
    if (!sceneRef.current) return;
    const mat = (c: THREE.ColorRepresentation, o: number) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false });
    const g = new THREE.Group();
    const arcs = new THREE.Group();
    for (let i = 0; i < 3; i++) arcs.add(new THREE.Mesh(new THREE.RingGeometry(radius * 0.45, radius * 0.98, 28, 1, (i * Math.PI * 2) / 3, Math.PI * 0.4), mat(i % 2 ? accent : colorHex, 0.75)));
    arcs.rotation.x = -Math.PI / 2;
    g.add(arcs);
    const rim = new THREE.Mesh(new THREE.RingGeometry(radius * 0.97, radius, 64), mat(accent, 0.85));
    rim.rotation.x = -Math.PI / 2;
    g.add(rim);
    g.position.set(playerPos.current.x, 0.1, playerPos.current.z);
    sceneRef.current.add(g);
    spatialEffectsRef.current.push({
      mesh: g,
      particles: [],
      lifetime: life,
      maxLifetime: life,
      onUpdate: (_p, d) => {
        g.position.set(playerPos.current.x, 0.1, playerPos.current.z);
        arcs.rotation.z += d * spin;
      },
    });
  };

  /**
   * 斬撃波: 三日月の刃が地を這うように飛び、触れた敵をすべて斬り抜ける（貫通・1体1回）。
   * roll = 刃面の傾き (0 = 横一文字, ±π/2 = 縦)。halfWidth = 三日月の半幅(m)。
   */
  const launchSlashWave = (opts: {
    w: Weapon;
    dir: THREE.Vector3;
    roll: number;
    halfWidth: number;
    speed: number;
    life: number;
    damage: number;
    label: string;
    thickness?: number;
    knock?: number;
    launch?: number;
    onHit?: (enemy: EnemyInstance) => void;
  }) => {
    if (!sceneRef.current) return;
    const { w, dir } = opts;
    const origin = playerPos.current.clone().addScaledVector(dir, 2.0);
    origin.y = Math.max(0.9, playerPos.current.y - 0.55);
    const lateral = new THREE.Vector3(-dir.z, 0, dir.x);
    const hitSet = new Set<EnemyInstance>();
    const dealer = makeDealer(opts.label, '#e0f2fe');
    let fxBudget = 6;
    let lastFlush = 0;
    const res = buildSlashWaveFx({
      scene: sceneRef.current,
      origin,
      dir,
      color: w.color,
      roll: opts.roll,
      halfWidth: opts.halfWidth,
      speed: opts.speed,
      life: opts.life,
      thickness: opts.thickness,
      onFrame: (pos, traveled, dt) => {
        const grow = 1 + Math.min(1, traveled / (opts.speed * opts.life)) * 0.28;
        // 刃面の水平方向の届く幅と、縦方向の届く高さ（斜め・縦の波は縦にも長い）
        const reachH = Math.max(1.1, opts.halfWidth * grow * Math.abs(Math.cos(opts.roll))) + 0.6;
        const reachV = 1.6 + opts.halfWidth * grow * Math.abs(Math.sin(opts.roll));
        const depth = 1.0 + opts.speed * dt;
        let hits = 0;
        enemiesRef.current.forEach((enemy) => {
          if (enemy.isDead || hitSet.has(enemy)) return;
          const rel = enemy.mesh.position.clone().sub(pos);
          const along = rel.dot(dir);
          if (along < -depth || along > depth) return;
          if (Math.abs(rel.x * lateral.x + rel.z * lateral.z) > reachH + (enemy.category === 'boss' ? 4 : enemy.category === 'titan' ? 1.6 : 0.6)) return;
          const ey = enemy.mesh.position.y + (isFlyingCategory(enemy.category) ? 0 : 1.0);
          if (Math.abs(ey - pos.y) > reachV + (enemy.category === 'boss' ? 6 : 0)) return;
          hitSet.add(enemy);
          hits++;
          let dmg = opts.damage;
          if ((enemy.frozenTimer ?? 0) > 0) dmg *= hasSkill('frost_mod_damage') ? 1.6 : 1.25;
          dealer.hurt(enemy, Math.round(dmg));
          if (opts.knock) enemy.velocity.addScaledVector(dir, opts.knock);
          if (opts.launch && !isFlyingCategory(enemy.category)) enemy.velocity.y += opts.launch;
          opts.onHit?.(enemy);
          const hp = enemyHitPos(enemy);
          spawn3DHitSparks(hp, '#e0f2fe', 14);
          if (fxBudget-- > 0) spawnMeleeHitFx('katana', hp, 3, w.color);
        });
        if (hits > 0) {
          sound.playEnemyHit();
          hitFlash();
          triggerHitStop(0.025);
        }
        // 当たった分は少しずつまとめて表示（毎フレーム出すと読めない）
        lastFlush += dt;
        if (lastFlush > 0.25) {
          lastFlush = 0;
          dealer.flush();
          dealerReset(dealer);
        }
      },
    });
    spatialEffectsRef.current.push({
      mesh: res.group,
      light: res.light,
      particles: res.particles,
      lifetime: res.lifetime,
      maxLifetime: res.lifetime,
      direction: res.direction,
      forwardSpeed: res.forwardSpeed,
      expansionRate: res.expansionRate,
      onUpdate: (p, d) => {
        res.onUpdate?.(p, d);
        if (p >= 0.999 || res.group.parent === null) {
          dealer.flush();
          dealerReset(dealer);
        }
      },
    });
    return dealer;
  };
  /** makeDealer の集計を空にする（斬撃波のダメージ表示を区切って出す用） */
  const dealerReset = (dealer: ReturnType<typeof makeDealer>) => dealer.reset();

  // ECHO BLADE / 高周波刀: 居合・斬撃波「KOKŪ-DACHI（虚空断ち）」。
  // 抜刀の構えから逆袈裟→袈裟の二連で十字の斬撃波を放ち、最後に納刀の一閃で巨大な三日月の斬撃波を飛ばす
  const executeKatanaIai = () => {
    const s = beginMeleeSkill(0.95, 'MURAMASA-X // 居合・斬撃波 KOKŪ-DACHI');
    if (!s) return;
    const { w, dir, base } = s;
    const reach = hasSkill('blade_mod_reach') ? 1.25 : 1;
    const echo = hasSkill('blade_mod_echo');
    // 抜刀の構え: 一瞬だけ腰を落として刃を鞘へ引き絞る（踏み込みは小さく、波で間合いを取る）
    playerVelocity.current.addScaledVector(dir, -3);
    viewmodelAnimRef.current.recoilRotY = 0.18;
    viewmodelAnimRef.current.recoilPos.z = 0.06;
    sound.playBladeGuard();

    // 一ノ太刀: 逆袈裟（左下→右上）の斬撃波
    later(90, () => {
      skillSwing(2);
      sound.playMeleeSwing('katana', 2);
      sound.playBladeSlash(2);
      spawn3DMeleeSlashEffect(2, w, 8);
      swingCameraRoll(-0.9);
      launchSlashWave({ w, dir, roll: 0.62, halfWidth: 2.3 * reach, speed: 48, life: 0.5 * reach, damage: base * 1.35, label: 'KOKŪ', knock: 4 });
    });
    // 二ノ太刀: 袈裟（右上→左下）で十字に重ねる
    later(240, () => {
      skillSwing(1);
      sound.playMeleeSwing('katana', 1);
      sound.playBladeSlash(2);
      spawn3DMeleeSlashEffect(1, w, 8);
      swingCameraRoll(0.9);
      launchSlashWave({ w, dir, roll: -0.62, halfWidth: 2.3 * reach, speed: 48, life: 0.5 * reach, damage: base * 1.35, label: 'KOKŪ', knock: 4 });
    });
    // 終ノ太刀: 納刀の一閃 → 視界いっぱいの横一文字の三日月が飛ぶ（貫通・吹き飛ばし）
    later(520, () => {
      skillSwing(4);
      sound.playMeleeSwing('katana', 3);
      sound.playBladeSlash(3);
      sound.playSweepAttack();
      spawn3DMeleeSlashEffect(4, w, 10);
      swingCameraRoll(1.4);
      cameraShakeRef.current = { amp: 0.06, until: performance.now() / 1000 + 0.3, dur: 0.3 };
      viewmodelAnimRef.current.recoilRotX = -0.25;
      launchSlashWave({
        w,
        dir,
        roll: 0.03,
        halfWidth: 4.6 * reach,
        speed: 40,
        life: 0.72 * reach,
        damage: base * 2.9,
        label: 'KOKŪ-DACHI',
        thickness: 1.7,
        knock: 16,
        launch: 6,
      });
      setAnnouncement('KOKŪ-DACHI // 虚空断ち!');
    });
    // 残光斬撃（強化）: 少し遅れて縦一文字の残響波が地面を割って走る
    if (echo) {
      later(700, () => {
        sound.playBladeSlash(3);
        launchSlashWave({ w, dir, roll: Math.PI / 2, halfWidth: 2.4, speed: 56, life: 0.5, damage: base * 1.6, label: 'ECHO', thickness: 1.3, knock: 6 });
        if (sceneRef.current) {
          // 地割れの光線（波の進路）
          const len = 56 * 0.5;
          const crack = new THREE.Mesh(
            new THREE.PlaneGeometry(0.22, len),
            new THREE.MeshBasicMaterial({ color: 0xe0f2fe, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
          );
          crack.rotation.x = -Math.PI / 2;
          crack.rotation.z = -Math.atan2(dir.x, -dir.z);
          crack.position.copy(playerPos.current).addScaledVector(dir, len / 2 + 1).setY(0.06);
          sceneRef.current.add(crack);
          spatialEffectsRef.current.push({ mesh: crack, particles: [], lifetime: 0.9, maxLifetime: 0.9 });
        }
      });
    }
    later(echo ? 900 : 820, endMeleeSkill);
  };

  // TITAN REACH / グレイブ: INFERNO WINDMILL。前進しながら炎の風車となって薙ぎ払い、最後に炎の衝撃波
  const executeGlaiveInferno = () => {
    const D = 0.9;
    const s = beginMeleeSkill(D, 'TG-03 GLAIVE // INFERNO WINDMILL');
    if (!s) return;
    const { w, dir, base } = s;
    startSkillDash(dir, 12, D * 0.9); // 約10m
    skillSwing(4);
    later(420, () => skillSwing(4));
    sound.playMeleeSwing('glaive', 3);
    spawnSkillRings(w.color, 8, D + 0.25, 12, 0xfdba74);
    const dealer = makeDealer('INFERNO', '#fb923c');
    const burn = (e: EnemyInstance, secs: number) => {
      e.burnTimer = secs;
      e.burnDps = Math.max(e.burnDps ?? 0, 18);
    };
    const ticks = 6;
    for (let i = 0; i < ticks; i++) {
      later(D * 1000 * (0.1 + (0.7 * i) / (ticks - 1)), () => {
        let n = 0;
        enemiesRef.current.forEach((enemy) => {
          if (enemy.isDead || playerPos.current.distanceTo(enemy.mesh.position) > 8) return;
          dealer.hurt(enemy, Math.round(base * 0.7));
          burn(enemy, 3);
          spawn3DHitSparks(enemyHitPos(enemy), '#fdba74', 8);
          if (n++ < 3) spawnMeleeHitFx('glaive', enemyHitPos(enemy), 3, w.color);
        });
        if (i % 2 === 0) spawn3DMeleeSlashEffect(4, w, 8);
        sound.playMeleeSwing('glaive', 1 + (i % 3));
        if (n > 0) sound.playEnemyHit();
        viewmodelAnimRef.current.recoilRotY = (i % 2 ? 1 : -1) * 0.12;
      });
    }
    later(D * 1000, () => {
      let n = 0;
      enemiesRef.current.forEach((enemy) => {
        if (enemy.isDead || playerPos.current.distanceTo(enemy.mesh.position) > 10.5) return;
        n++;
        dealer.hurt(enemy, Math.round(base * 2.4));
        burn(enemy, 4);
        const away = enemy.mesh.position.clone().sub(playerPos.current).setY(0);
        if (away.lengthSq() < 1e-4) away.copy(dir);
        enemy.velocity.addScaledVector(away.normalize(), 20);
        enemy.velocity.y += 7;
        spawn3DHitSparks(enemyHitPos(enemy), '#fb923c', 24);
        spawnMeleeHitFx('glaive', enemyHitPos(enemy), 3, w.color);
      });
      spawn3DMeleeSlashEffect(3, w, 10.5);
      spawn3DMeleeSlashEffect(4, w, 10.5);
      dealer.flush();
      viewmodelAnimRef.current.recoilRotX = -0.35;
      sound.playBladeSlash(3);
      if (n > 0) {
        sound.playEnemyHit();
        hitFlash(1.3);
        setAnnouncement(`INFERNO WINDMILL // ${n} ENEMIES IGNITED!`);
      }
      endMeleeSkill();
    });
  };

  // TACHYON FANG / 位相ダガー: PHASE BARRAGE。敵から敵へ位相ブリンクしながら連続でバックスタブ
  const executePhaseBarrage = () => {
    const D = 1.0;
    const s = beginMeleeSkill(D, 'TE-99 PHASE // PHASE BARRAGE');
    if (!s) return;
    const { w, dir, base } = s;
    const dealer = makeDealer('PHASE', '#c084fc');
    const hits = 7;
    let last: EnemyInstance | null = null;
    const bound = 38; // アリーナ(80m)の内側
    for (let i = 0; i < hits; i++) {
      later(80 + i * 130, () => {
        const final = i === hits - 1;
        const alive = enemiesRef.current
          .filter((e) => !e.isDead && e !== last && playerPos.current.distanceTo(e.mesh.position) < 24)
          .sort((a, b) => playerPos.current.distanceTo(a.mesh.position) - playerPos.current.distanceTo(b.mesh.position));
        const target = alive.length > 0 ? alive[Math.floor(Math.random() * Math.min(3, alive.length))] : null;
        sound.playDash();
        if (!target) {
          // 標的がいなければ前方へブリンク
          playerPos.current.addScaledVector(dir, 3.5);
          spawn3DMeleeSlashEffect(1 + (i % 2), w, 6);
          return;
        }
        last = target;
        // 敵の向こう側へ抜けるようにブリンクして背後を取る
        const through = target.mesh.position.clone().sub(playerPos.current).setY(0);
        if (through.lengthSq() < 1e-4) through.copy(dir);
        through.normalize();
        playerPos.current.x = THREE.MathUtils.clamp(target.mesh.position.x + through.x * 1.8, -bound, bound);
        playerPos.current.z = THREE.MathUtils.clamp(target.mesh.position.z + through.z * 1.8, -bound, bound);
        const face = target.mesh.position.clone().sub(playerPos.current);
        const yaw = Math.atan2(-face.x, -face.z);
        targetRotation.current.yaw = yaw;
        currentRotation.current.yaw = yaw;
        skillSwing(final ? 3 : 1 + (i % 2));
        spawn3DMeleeSlashEffect(final ? 3 : 1 + (i % 2), w, 6);
        sound.playMeleeSwing('dagger', final ? 3 : 1);
        dealer.hurt(target, Math.round(base * (final ? 3.2 : 1.1)));
        target.velocity.addScaledVector(through, final ? 14 : 3);
        spawn3DHitSparks(enemyHitPos(target), '#e9d5ff', final ? 28 : 12);
        spawnMeleeHitFx('dagger', enemyHitPos(target), final ? 3 : 1, w.color);
        sound.playEnemyHit();
        hitFlash();
        viewmodelAnimRef.current.recoilRotY = (i % 2 ? 1 : -1) * 0.1;
        if (final) {
          dealer.flush();
          setAnnouncement('PHASE BARRAGE // FINAL PIERCE!');
        }
      });
    }
    later(80 + hits * 130 + 150, endMeleeSkill);
  };

  // LEVIATHAN HOOK / 鎖槍: ABYSS HAUL。広範囲の敵へ銛を撃ち込んで引きずり寄せ、鎖の渦で薙ぎ払う
  const executeAbyssHaul = () => {
    const s = beginMeleeSkill(0.95, 'CS-16 CHAIN // ABYSS HAUL');
    if (!s) return;
    const { w, dir, base } = s;
    const dealer = makeDealer('HAUL', '#fbbf24');
    skillSwing(3);
    sound.playMeleeSwing('chainspear', 3);
    sound.playHeavyLaunch();
    viewmodelAnimRef.current.recoilRotX = -0.25;
    const cable = (enemy: EnemyInstance) => {
      if (!sceneRef.current) return;
      const geo = new THREE.BufferGeometry().setFromPoints([playerPos.current.clone().add(new THREE.Vector3(0, -0.3, 0)), enemyHitPos(enemy)]);
      const mat = new THREE.LineBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.95 });
      const line = new THREE.Line(geo, mat);
      sceneRef.current.add(line);
      setTimeout(() => { sceneRef.current?.remove(line); geo.dispose(); mat.dispose(); }, 240);
    };
    const haul = (power: number, dmgMul: number) => {
      let n = 0;
      enemiesRef.current.forEach((enemy) => {
        if (enemy.isDead || n >= 10) return;
        const rel = enemy.mesh.position.clone().sub(playerPos.current);
        if (rel.length() > 26) return;
        n++;
        dealer.hurt(enemy, Math.round(base * dmgMul));
        const toPlayer = rel.clone().negate().setY(0).normalize();
        enemy.velocity.addScaledVector(toPlayer, power);
        enemy.shockTimer = 1.6;
        enemy.attackCooldown += 1.0;
        cable(enemy);
        spawn3DHitSparks(enemyHitPos(enemy), '#fbbf24', 12);
        if (n <= 3) spawnMeleeHitFx('chainspear', enemyHitPos(enemy), 3, w.color);
      });
      if (n > 0) {
        sound.playEnemyHit();
        hitFlash();
      }
      return n;
    };
    haul(36, 1.2);
    later(260, () => haul(26, 0.6));
    later(520, () => {
      // 引き寄せた敵を鎖の渦で一掃
      skillSwing(4);
      spawnSkillRings(w.color, 7, 0.5, 14, 0xfef3c7);
      spawn3DMeleeSlashEffect(4, w, 7);
      spawn3DMeleeSlashEffect(3, w, 7);
      sound.playMeleeSwing('chainspear', 3);
      let n = 0;
      enemiesRef.current.forEach((enemy) => {
        if (enemy.isDead || playerPos.current.distanceTo(enemy.mesh.position) > 7.5) return;
        n++;
        dealer.hurt(enemy, Math.round(base * 2.5));
        const away = enemy.mesh.position.clone().sub(playerPos.current).setY(0);
        if (away.lengthSq() < 1e-4) away.copy(dir);
        enemy.velocity.addScaledVector(away.normalize(), 20);
        enemy.velocity.y += 6;
        spawn3DHitSparks(enemyHitPos(enemy), '#fde68a', 22);
        spawnMeleeHitFx('chainspear', enemyHitPos(enemy), 3, w.color);
      });
      dealer.flush();
      viewmodelAnimRef.current.recoilRotX = -0.3;
      sound.playBladeSlash(3);
      if (n > 0) {
        sound.playEnemyHit();
        hitFlash(1.3);
        setAnnouncement(`ABYSS HAUL // ${n} ENEMIES CRUSHED!`);
      }
      later(200, endMeleeSkill);
    });
  };

  // STORMBREAKER / ガントレット: THUNDER BARRAGE。突進しながらの超高速連打から極大雷撃パームで貫く
  const executeThunderBarrage = () => {
    const D = 0.62;
    const s = beginMeleeSkill(D, 'TS-02 THUNDER // THUNDER BARRAGE');
    if (!s) return;
    const { w, dir, base } = s;
    const origin = playerPos.current.clone();
    startSkillDash(dir, 20, 0.52); // 約10m
    const dealer = makeDealer('THUNDER', '#22d3ee');
    const ticks = 10;
    for (let i = 0; i < ticks; i++) {
      later(40 + i * 48, () => {
        skillSwing(1 + (i % 2));
        sound.playMeleeSwing('gauntlets', 1 + (i % 2));
        viewmodelAnimRef.current.recoilRotY = (i % 2 ? -1 : 1) * 0.08;
        let n = 0;
        enemiesRef.current.forEach((enemy) => {
          if (enemy.isDead) return;
          const rel = enemy.mesh.position.clone().sub(playerPos.current);
          if (rel.length() > 5.8 || dir.dot(rel.clone().normalize()) < 0.2) return;
          dealer.hurt(enemy, Math.round(base * 0.5));
          enemy.shockTimer = 1.2;
          enemy.velocity.addScaledVector(dir, 5);
          spawn3DHitSparks(enemyHitPos(enemy), '#67e8f9', 8);
          if (n++ < 2) spawnMeleeHitFx('gauntlets', enemyHitPos(enemy), 2, w.color);
        });
        if (n > 0) sound.playEnemyHit();
      });
    }
    later(D * 1000, () => {
      skillSwing(4);
      sound.playMeleeSwing('gauntlets', 3);
      sound.playBladeSlash(3);
      spawn3DMeleeSlashEffect(3, w, 12);
      spawn3DMeleeSlashEffect(4, w, 12);
      const lateral = new THREE.Vector3(1, 0, 0).applyAxisAngle(_up, currentRotation.current.yaw);
      let n = 0;
      enemiesRef.current.forEach((enemy) => {
        if (enemy.isDead) return;
        const rel = enemy.mesh.position.clone().sub(playerPos.current);
        const along = rel.dot(dir);
        const inLine = along > -1 && along < 13 && Math.abs(rel.dot(lateral)) < 3.4;
        if (!inLine && rel.length() > 5) return;
        n++;
        dealer.hurt(enemy, Math.round(base * 3.0));
        enemy.shockTimer = 2.2;
        enemy.velocity.addScaledVector(dir, 26);
        enemy.velocity.y += 8;
        spawn3DHitSparks(enemyHitPos(enemy), '#cffafe', 26);
        spawnMeleeHitFx('gauntlets', enemyHitPos(enemy), 3, w.color);
        // 雷撃の連鎖
        let hops = 0;
        enemiesRef.current.forEach((o) => {
          if (o === enemy || o.isDead || hops >= 3 || o.mesh.position.distanceTo(enemy.mesh.position) > 9) return;
          hops++;
          dealer.hurt(o, Math.round(base * 1.2));
          o.shockTimer = 2.0;
          spawn3DHitSparks(enemyHitPos(o), '#22d3ee', 12);
        });
      });
      dealer.flush();
      viewmodelAnimRef.current.recoilRotX = -0.4;
      viewmodelAnimRef.current.recoilPos.y = -0.16;
      if (n > 0) {
        sound.playEnemyHit();
        hitFlash(1.4);
        setAnnouncement(`THUNDER BARRAGE // ${n} ENEMIES ELECTROCUTED!`);
      }
      void origin;
      later(220, endMeleeSkill);
    });
  };

  // ASTRO-ZWILL / 双剣: TWIN CYCLONE。二刀を逆回転させて突進し、最後に十字の星爆
  const executeTwinCyclone = () => {
    const D = 0.7;
    const s = beginMeleeSkill(D, 'AZ-77 ZWILL // TWIN CYCLONE');
    if (!s) return;
    const { w, dir, base } = s;
    startSkillDash(dir, 16, D * 0.92); // 約10m
    skillSwing(4);
    later(330, () => skillSwing(4));
    sound.playMeleeSwing('twinblade', 4);
    spawnSkillRings(w.color, 6.5, D + 0.25, 15, 0xfce7f3);
    const dealer = makeDealer('CYCLONE', '#f472b6');
    const ticks = 5;
    for (let i = 0; i < ticks; i++) {
      later(D * 1000 * (0.1 + (0.5 * i) / (ticks - 1)), () => {
        let n = 0;
        enemiesRef.current.forEach((enemy) => {
          if (enemy.isDead || playerPos.current.distanceTo(enemy.mesh.position) > 6.5) return;
          dealer.hurt(enemy, Math.round(base * 0.75));
          const pull = playerPos.current.clone().sub(enemy.mesh.position).setY(0).normalize();
          enemy.velocity.addScaledVector(pull, 3);
          spawn3DHitSparks(enemyHitPos(enemy), '#f9a8d4', 8);
          if (n++ < 3) spawnMeleeHitFx('twinblade', enemyHitPos(enemy), 2, w.color);
        });
        if (i % 2 === 0) spawn3DMeleeSlashEffect(4, w, 6.5);
        sound.playMeleeSwing('twinblade', 1 + (i % 2));
        if (n > 0) sound.playEnemyHit();
        viewmodelAnimRef.current.recoilRotY = (i % 2 ? 1 : -1) * 0.1;
      });
    }
    later(D * 1000, () => {
      skillSwing(3);
      spawn3DMeleeSlashEffect(3, w, 8.5);
      spawn3DMeleeSlashEffect(4, w, 8.5);
      sound.playMeleeSwing('twinblade', 3);
      sound.playBladeSlash(3);
      let n = 0;
      enemiesRef.current.forEach((enemy) => {
        if (enemy.isDead || playerPos.current.distanceTo(enemy.mesh.position) > 8.5) return;
        n++;
        dealer.hurt(enemy, Math.round(base * 2.4));
        const away = enemy.mesh.position.clone().sub(playerPos.current).setY(0);
        if (away.lengthSq() < 1e-4) away.copy(dir);
        enemy.velocity.addScaledVector(away.normalize(), 20);
        enemy.velocity.y += 8;
        spawn3DHitSparks(enemyHitPos(enemy), '#f9a8d4', 24);
        spawnMeleeHitFx('twinblade', enemyHitPos(enemy), 3, w.color);
      });
      dealer.flush();
      viewmodelAnimRef.current.recoilRotX = -0.35;
      if (n > 0) {
        sound.playEnemyHit();
        hitFlash(1.3);
        setAnnouncement(`TWIN CYCLONE // ${n} ENEMIES STARBURST!`);
      }
      later(160, endMeleeSkill);
    });
  };

  // ANCHRON-G2: ABYSSAL TRAWL。碇を前方へ投げ込み、鎖で敵を引きずり寄せて着底点で叩き潰す
  const executeAbyssalTrawl = () => {
    const s = beginMeleeSkill(1.15, 'AG-02 MOOR // ABYSSAL TRAWL');
    if (!s) return;
    const { w, dir, base } = s;
    const scene = sceneRef.current;
    const dealer = makeDealer('TRAWL', '#2dd4bf');
    const throwDist = 14;
    const target = playerPos.current.clone().addScaledVector(dir, throwDist);
    target.y = 0;
    const R = 8.5; // 着底点を中心にした引き寄せ・粉砕の半径
    skillSwing(3);
    sound.playMeleeSwing('anchor', 3);
    sound.playHeavyLaunch();
    viewmodelAnimRef.current.recoilRotX = -0.3;

    // 投擲される碇（簡易モデル）と鎖
    const mat = (c: number, o = 1) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o });
    const anchor = new THREE.Group();
    anchor.add(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 2.6, 8), mat(0x94a3b8)));
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.5, 8), mat(0xcbd5e1));
    bar.rotation.z = Math.PI / 2;
    bar.position.y = 0.7;
    anchor.add(bar);
    const crown = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.11, 8, 20, Math.PI), mat(0x94a3b8));
    crown.position.y = -1.0;
    crown.rotation.z = Math.PI;
    anchor.add(crown);
    const ringTop = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.05, 6, 14), mat(0x2dd4bf));
    ringTop.position.y = 1.4;
    anchor.add(ringTop);
    const chainGeo = new THREE.BufferGeometry();
    const chainLine = new THREE.Line(chainGeo, new THREE.LineBasicMaterial({ color: 0x99f6e4, transparent: true, opacity: 0.95 }));
    const hand = () => playerPos.current.clone().add(new THREE.Vector3(0, 0.9, 0)).addScaledVector(dir, 0.4);
    const setChain = (to: THREE.Vector3) => {
      const a = hand();
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 14; i++) {
        const t = i / 14;
        const p = a.clone().lerp(to, t);
        p.y -= Math.sin(t * Math.PI) * 0.8 * (1 - 0.0);
        pts.push(p);
      }
      chainGeo.setFromPoints(pts);
    };
    if (scene) {
      scene.add(anchor);
      scene.add(chainLine);
    }
    const apex = new THREE.Vector3();
    const flightMs = 340;
    const t0 = performance.now();
    const fly = () => {
      const k = Math.min(1, (performance.now() - t0) / flightMs);
      apex.copy(hand()).lerp(target.clone().setY(1.4), k);
      apex.y += Math.sin(k * Math.PI) * 2.2;
      anchor.position.copy(apex);
      anchor.rotation.set(k * 5, 0, 0.3);
      setChain(apex);
      if (k < 1) requestAnimationFrame(fly);
    };
    fly();

    // 着底: 周囲の敵を係留して鎖で引き寄せる
    later(flightMs, () => {
      anchor.position.copy(target).setY(1.0);
      anchor.rotation.set(0, 0, 0.12);
      setChain(anchor.position.clone());
      cameraShakeRef.current = { amp: 0.06, until: performance.now() / 1000 + 0.25, dur: 0.25 };
      sound.playEnemyExplode();
      spawn3DHitSparks(target.clone().setY(0.4), '#99f6e4', 30);
      spawnMeleeHitFx('anchor', target.clone().setY(0.3), 3, w.color);
      let n = 0;
      enemiesRef.current.forEach((enemy) => {
        if (enemy.isDead || enemy.mesh.position.distanceTo(target) > R) return;
        n++;
        dealer.hurt(enemy, Math.round(base * 0.9));
        const pull = target.clone().sub(enemy.mesh.position).setY(0);
        if (pull.lengthSq() > 1e-4) enemy.velocity.addScaledVector(pull.normalize(), Math.min(26, pull.length() * 3.2));
        moorEnemy(enemy, 3.5);
        spawn3DHitSparks(enemyHitPos(enemy), '#99f6e4', 10);
      });
      if (n > 0) {
        sound.playEnemyHit();
        hitFlash();
      }
    });
    // 巻き上げ: さらに一点へ絞り込み、完全に係留
    later(flightMs + 380, () => {
      sound.playMeleeSwing('anchor', 2);
      let n = 0;
      enemiesRef.current.forEach((enemy) => {
        if (enemy.isDead || enemy.mesh.position.distanceTo(target) > R + 3) return;
        n++;
        dealer.hurt(enemy, Math.round(base * 0.7));
        const pull = target.clone().sub(enemy.mesh.position).setY(0);
        if (pull.lengthSq() > 1e-4) enemy.velocity.addScaledVector(pull.normalize(), Math.min(22, pull.length() * 3));
        moorEnemy(enemy, 3.5, 1.2);
      });
      if (n > 0) hitFlash();
    });
    // 粉砕: 着底点で衝撃波。碇は巻き戻されて手元へ
    later(flightMs + 780, () => {
      spawn3DMeleeSlashEffect(4, w, R);
      sound.playBladeSlash(3);
      sound.playEnemyExplode();
      cameraShakeRef.current = { amp: 0.08, until: performance.now() / 1000 + 0.3, dur: 0.3 };
      let n = 0;
      enemiesRef.current.forEach((enemy) => {
        if (enemy.isDead || enemy.mesh.position.distanceTo(target) > R) return;
        n++;
        dealer.hurt(enemy, Math.round(base * 2.2 * ((enemy.mooredTimer ?? 0) > 0 ? (hasSkill('anchor_mod_weight') ? 1.6 : 1.25) : 1)));
        enemy.velocity.y += 6;
        spawn3DHitSparks(enemyHitPos(enemy), '#e0fdf8', 22);
        spawnMeleeHitFx('anchor', enemyHitPos(enemy), 3, w.color);
      });
      dealer.flush();
      spawn3DHitSparks(target.clone().setY(0.4), '#e0fdf8', 36);
      if (n > 0) {
        sound.playEnemyHit();
        hitFlash(1.4);
        setAnnouncement(`ABYSSAL TRAWL // ${n} ENEMIES DRAGGED UNDER!`);
      }
      // 巻き戻し
      const t1 = performance.now();
      const reel = () => {
        const k = Math.min(1, (performance.now() - t1) / 300);
        anchor.position.copy(target).setY(1.0).lerp(hand(), k);
        anchor.rotation.x += 0.4;
        setChain(anchor.position);
        if (k < 1) {
          requestAnimationFrame(reel);
        } else if (scene) {
          scene.remove(anchor);
          scene.remove(chainLine);
          anchor.traverse((o) => {
            const m = o as THREE.Mesh;
            if (m.geometry) m.geometry.dispose();
            if (m.material) (m.material as THREE.Material).dispose();
          });
          chainGeo.dispose();
          (chainLine.material as THREE.Material).dispose();
        }
      };
      reel();
      later(300, endMeleeSkill);
    });
  };

  // ───────────────────────── 新INFIGHT兵装の共通処理 ─────────────────────────
  /** GLACIEL: 冷気の蓄積 → 凍結。凍った敵を三段目以降で突くと砕けて追加ダメージ */
  const applyRapierFrost = (enemy: EnemyInstance, step: number, dmg: number) => {
    if ((enemy.frozenTimer ?? 0) > 0 && step >= 3) {
      const bonus = Math.round(dmg * 1.2);
      enemy.hp -= bonus;
      battleStats.current.damageDealt += bonus;
      enemy.frozenTimer = 0;
      spawnDamageText(`SHATTER! -${bonus}`, '#e0f2fe');
      spawn3DHitSparks(enemy.mesh.position.clone().add(new THREE.Vector3(0, 1, 0)), '#ffffff', 26);
      triggerHitStop(0.06);
      return;
    }
    enemy.chillSlowTimer = 3.8;
    if ((enemy.frozenTimer ?? 0) <= 0 && (enemy.freezeImmuneTimer ?? 0) <= 0) {
      enemy.chillHits = (enemy.chillHits ?? 0) + (step >= 3 ? 3 : 2);
      if ((enemy.chillHits ?? 0) >= 8) {
        let dur = hasSkill('rapier_mod_frost') ? 3.0 : 2.0;
        if (enemy.category === 'boss' || enemy.category === 'titan') dur *= 0.5;
        enemy.frozenTimer = dur;
        enemy.freezeImmuneTimer = dur + 4;
        enemy.chillHits = 0;
        spawnDamageText('FROZEN!', '#7dd3fc');
        spawn3DHitSparks(enemy.mesh.position.clone().add(new THREE.Vector3(0, 1, 0)), '#bae6fd', 18);
      }
    }
  };

  /** ORBITAL RONDO: 円月輪を投げる（1段目=右、2段目=左、3段目=両方を交差させて遠くへ） */
  const throwRondo = (step: number, w: Weapon, dmg: number) => {
    const ars = arsenalRef.current;
    const actx = arsenalCtxRef.current;
    const cam = cameraRef.current;
    if (!ars || !actx || !cam) return;
    const fwd = new THREE.Vector3();
    cam.getWorldDirection(fwd);
    const right = new THREE.Vector3().crossVectors(fwd, _up).normalize();
    const range = (step >= 3 ? 17 : 12.5) * passivesRef.current.sweepRangeMultiplier * (hasSkill('disc_mod_range') ? 1.3 : 1);
    const sides = step >= 3 ? [1, -1] : [step === 1 ? 1 : -1];
    let thrown = 0;
    sides.forEach((side) => {
      let sd = side;
      if (ars.chakramOut(sd)) {
        sd = -sd;
        if (ars.chakramOut(sd)) return;
      }
      const origin = cam.position.clone().addScaledVector(fwd, 0.7).addScaledVector(right, sd * 0.35).add(new THREE.Vector3(0, -0.25, 0));
      const dir = fwd.clone().applyAxisAngle(_up, sd * (step >= 3 ? 0.14 : 0.07));
      ars.throwChakram(actx, sd, origin, dir, dmg * (step >= 3 ? 1.15 : 1), range, w.color);
      thrown++;
    });
    if (thrown === 0) setAnnouncement('ORBITAL RONDO // 円月輪の帰還待ち');
  };

  // GLACIEL / 氷晶細剣: DIAMOND DUST FLÈCHE。踏み込みの連続突きで駆け抜け、霜の新星で周囲を凍らせる
  const executeRapierFleche = () => {
    const s = beginMeleeSkill(0.9, 'GL-04 GLACIEL // DIAMOND DUST FLÈCHE');
    if (!s) return;
    const { w, dir, base } = s;
    const origin = playerPos.current.clone();
    startSkillDash(dir, 38, 0.3); // 約11m
    skillSwing(1);
    sound.playDash();
    sound.playMeleeSwing('rapier', 1);
    const dealer = makeDealer('FLÈCHE', '#bae6fd');
    const lateral = new THREE.Vector3(1, 0, 0).applyAxisAngle(_up, currentRotation.current.yaw);
    const thrusts = 8;
    for (let i = 0; i < thrusts; i++) {
      later(30 + i * 50, () => {
        skillSwing(1 + (i % 2));
        if (i % 2 === 0) spawn3DMeleeSlashEffect(1 + (i % 2), w, 6);
        sound.playMeleeSwing('rapier', 1 + (i % 2));
        viewmodelAnimRef.current.recoilRotY = (i % 2 ? 1 : -1) * 0.06;
        let n = 0;
        enemiesRef.current.forEach((enemy) => {
          if (enemy.isDead) return;
          const rel = enemy.mesh.position.clone().sub(origin);
          const along = rel.dot(dir);
          if (along < -1 || along > 15 || Math.abs(rel.dot(lateral)) > 2.6) return;
          if (playerPos.current.distanceTo(enemy.mesh.position) > 6.5) return;
          dealer.hurt(enemy, Math.round(base * 0.55));
          applyRapierFrost(enemy, 1, 0);
          if (n++ < 2) spawnMeleeHitFx('rapier', enemyHitPos(enemy), 1, w.color);
        });
        if (n > 0) {
          sound.playEnemyHit();
          hitFlash();
        }
      });
    }
    // 霜の新星: 周囲を一気に凍結させる
    later(560, () => {
      skillSwing(4);
      sound.playBladeSlash(3);
      sound.playSweepAttack();
      spawn3DMeleeSlashEffect(4, w, 7.5);
      spawnSkillRings('#7dd3fc', 7.5, 0.6, 6, 0xe0f2fe);
      cameraShakeRef.current = { amp: 0.05, until: performance.now() / 1000 + 0.25, dur: 0.25 };
      let n = 0;
      enemiesRef.current.forEach((enemy) => {
        if (enemy.isDead || playerPos.current.distanceTo(enemy.mesh.position) > 7.5) return;
        n++;
        dealer.hurt(enemy, Math.round(base * 2.0));
        enemy.chillHits = (enemy.chillHits ?? 0) + 6;
        applyRapierFrost(enemy, 1, 0);
        const away = enemy.mesh.position.clone().sub(playerPos.current).setY(0);
        if (away.lengthSq() > 1e-4) enemy.velocity.addScaledVector(away.normalize(), 10);
        spawn3DHitSparks(enemyHitPos(enemy), '#e0f2fe', 20);
        spawnMeleeHitFx('rapier', enemyHitPos(enemy), 3, w.color);
      });
      dealer.flush();
      if (n > 0) {
        triggerHitStop(0.08);
        hitFlash(1.3);
        setAnnouncement(`DIAMOND DUST // ${n} ENEMIES FROZEN!`);
      }
      later(200, endMeleeSkill);
    });
  };

  // VIPERCOIL / 雷蛇鞭: SERPENT STORM。頭上で鞭を振り回して雷の渦を作り、最後に前方へ雷鳴の一撃
  const executeWhipStorm = () => {
    const D = 1.0;
    const s = beginMeleeSkill(D, 'VC-09 VIPERCOIL // SERPENT STORM');
    if (!s) return;
    const { w, dir, base } = s;
    whipStormUntilRef.current = performance.now() / 1000 + D;
    spawnSkillRings(w.color, 8.5, D + 0.2, 14, 0xf7fee7);
    sound.playMeleeSwing('whip', 4);
    const dealer = makeDealer('STORM', '#a3e635');
    const ticks = 8;
    for (let i = 0; i < ticks; i++) {
      later(80 + i * 100, () => {
        if (i % 2 === 0) spawn3DMeleeSlashEffect(4, w, 8.5);
        sound.playMeleeSwing('whip', 1 + (i % 2));
        let n = 0;
        enemiesRef.current.forEach((enemy) => {
          if (enemy.isDead || playerPos.current.distanceTo(enemy.mesh.position) > 8.5) return;
          dealer.hurt(enemy, Math.round(base * 0.5));
          enemy.shockTimer = Math.max(enemy.shockTimer ?? 0, 1.2);
          const pull = playerPos.current.clone().sub(enemy.mesh.position).setY(0).normalize();
          enemy.velocity.addScaledVector(pull, 3);
          spawn3DHitSparks(enemyHitPos(enemy), '#d9f99d', 6);
          if (n++ < 3) spawnMeleeHitFx('whip', enemyHitPos(enemy), 2, w.color);
        });
        if (n > 0) sound.playZap();
      });
    }
    later(D * 1000, () => {
      skillSwing(1);
      sound.playBladeSlash(3);
      sound.playEnemyExplode();
      spawn3DMeleeSlashEffect(1, w, 14);
      swingCameraRoll(0.9);
      cameraShakeRef.current = { amp: 0.06, until: performance.now() / 1000 + 0.25, dur: 0.25 };
      const lateral = new THREE.Vector3(1, 0, 0).applyAxisAngle(_up, currentRotation.current.yaw);
      let n = 0;
      enemiesRef.current.forEach((enemy) => {
        if (enemy.isDead) return;
        const rel = enemy.mesh.position.clone().sub(playerPos.current);
        const along = rel.dot(dir);
        if (along < -1 || along > 15 || Math.abs(rel.dot(lateral)) > 3.2) return;
        n++;
        dealer.hurt(enemy, Math.round(base * 2.6));
        enemy.shockTimer = Math.max(enemy.shockTimer ?? 0, 2.2);
        enemy.velocity.addScaledVector(dir, 14);
        spawn3DHitSparks(enemyHitPos(enemy), '#f7fee7', 22);
        spawnMeleeHitFx('whip', enemyHitPos(enemy), 3, w.color);
      });
      dealer.flush();
      if (n > 0) {
        triggerHitStop(0.07);
        hitFlash(1.3);
        setAnnouncement(`SERPENT STORM // ${n} ENEMIES THUNDERSTRUCK!`);
      }
      later(160, endMeleeSkill);
    });
  };

  // ORBITAL RONDO / 円月輪: HALO ORBIT。四枚の円月輪が周囲を周回して切り刻み、最後に外へ弾け飛ぶ
  const executeDiscHalo = () => {
    const s = beginMeleeSkill(0.45, 'OR-12 RONDO // HALO ORBIT');
    if (!s) return;
    const { w, base } = s;
    skillSwing(4);
    sound.playMeleeSwing('disc', 4);
    spawn3DMeleeSlashEffect(4, w, 4);
    const dur = hasSkill('disc_mod_halo') ? 5.5 : 3.6;
    if (arsenalRef.current && arsenalCtxRef.current) arsenalRef.current.haloOrbit(arsenalCtxRef.current, base, w.color, dur);
    discHaloUntilRef.current = performance.now() / 1000 + dur + 0.5;
    later(450, endMeleeSkill);
  };

  /**
   * Resolves a hit taken while guarding with an INFIGHT weapon. Each weapon defends differently
   * (see utils/meleeGuards.ts). Returns the damage that still gets through (shield first, then HP).
   */
  const applyGuardBlock = useCallback((incoming: number, kind: 'melee' | 'projectile', attacker?: EnemyInstance): number => {
    const w = getActiveWeapon();
    const style = getMeleeStyle(w);
    const g = GUARD_PROFILES[style];
    const held = performance.now() / 1000 - guardStartRef.current;
    const inWindow = g.perfectWindow > 0 && held <= g.perfectWindow;
    let taken = Math.round(incoming * (1 - (kind === 'melee' ? g.meleeReduce : g.projReduce)));
    let label = 'BLOCKED!';
    guardFlashRef.current = 1;
    const atkPos = attacker ? attacker.mesh.position.clone().add(new THREE.Vector3(0, 0.8, 0)) : null;
    const pushAway = (power: number) => {
      if (!attacker) return;
      const away = attacker.mesh.position.clone().sub(playerPos.current).setY(0);
      if (away.lengthSq() < 0.0001) away.set(0, 0, -1);
      attacker.velocity.add(away.normalize().multiplyScalar(power));
    };
    const hurt = (dmg: number, text: string) => {
      if (!attacker) return;
      attacker.hp -= dmg;
      battleStats.current.damageDealt += dmg;
      spawnDamageText(`${text} -${dmg}`, g.color);
    };

    switch (style) {
      case 'katana':
        if (inWindow) {
          taken = 0;
          label = 'PERFECT PARRY!';
          viewmodelAnimRef.current.recoilRotY = 0.3;
          if (attacker && atkPos) {
            hurt(Math.round(w.stats.damage * 1.6 * passivesRef.current.meleeDamageMultiplier), 'IAI COUNTER!');
            pushAway(10);
            spawn3DHitSparks(atkPos, '#ffffff', 22);
          }
        } else label = 'MIKIRI GUARD';
        break;
      case 'gauntlets':
        label = 'VOLT CROSS';
        if (attacker && atkPos) {
          hurt(Math.round(w.stats.damage * 0.6), 'DISCHARGE!');
          attacker.shockTimer = 1.4;
          attacker.attackCooldown += 0.9;
          spawn3DHitSparks(atkPos, g.color, 16);
        }
        break;
      case 'twinblade':
        if (inWindow) {
          taken = 0;
          label = 'PERFECT CROSS!';
          viewmodelAnimRef.current.recoilRotY = -0.3;
          if (attacker && atkPos) {
            hurt(Math.round(w.stats.damage * 1.8 * passivesRef.current.meleeDamageMultiplier), 'NOVA COUNTER!');
            attacker.shockTimer = 1.0;
            pushAway(11);
            spawn3DHitSparks(atkPos, '#f9a8d4', 24);
            spawnMeleeHitFx('twinblade', atkPos, 3, w.color);
          }
        } else label = 'STELLAR CROSS';
        break;
      case 'hammer':
        label = 'GRAVITY DOME';
        pushAway(26);
        if (atkPos) spawn3DHitSparks(atkPos, g.color, 10);
        break;
      case 'glaive':
        label = kind === 'projectile' ? 'INCINERATED!' : 'HEAT WINDMILL';
        if (attacker) {
          attacker.burnTimer = 3;
          attacker.burnDps = Math.max(attacker.burnDps ?? 0, 14);
          pushAway(8);
        }
        break;
      case 'dagger':
        if (inWindow || Math.random() < 0.5) {
          taken = 0;
          label = 'PHASE EVADE!';
        } else label = 'PHASE GRAZE';
        break;
      case 'anchor':
        label = 'ANCHOR BERTH!';
        if (attacker) {
          moorEnemy(attacker, 3.0, 1.5);
          attacker.attackCooldown += 0.8;
          if (atkPos) spawn3DHitSparks(atkPos, g.color, 14);
        }
        break;
      case 'chainspear':
        label = 'CHAIN BIND!';
        if (attacker) {
          attacker.velocity.set(0, 0, 0);
          attacker.attackCooldown += 1.3;
          attacker.isPulled = true;
          setTimeout(() => { attacker.isPulled = false; }, 900);
        }
        break;
      case 'scythe': {
        const heal = Math.round((incoming - taken) * 0.4);
        playerHpRef.current = Math.min(maxHpRef.current, playerHpRef.current + heal);
        label = `SOUL DRAIN +${heal}`;
        break;
      }
      case 'chainsaw':
        if (kind === 'projectile') {
          label = 'SHREDDED!';
          if (atkPos) spawn3DHitSparks(playerPos.current.clone().add(new THREE.Vector3(0, -0.2, 0)).addScaledVector(new THREE.Vector3(0, 0, -1).applyAxisAngle(_up, currentRotation.current.yaw), 1.2), '#fbbf24', 10);
        } else {
          label = 'SAW PARRY!';
          if (attacker && atkPos) {
            hurt(Math.round(w.stats.damage * 3 * passivesRef.current.meleeDamageMultiplier), 'SHRED!');
            attacker.bleedTimer = 3;
            attacker.bleedDps = Math.max(attacker.bleedDps ?? 0, 25);
            pushAway(9);
            spawn3DHitSparks(atkPos, '#fbbf24', 18);
          }
        }
        break;
      case 'lance':
        lanceChargeRef.current = Math.min(LANCE_MAX_CHARGE, lanceChargeRef.current + 1);
        label = `STAKE CHARGE ${lanceChargeRef.current}/${LANCE_MAX_CHARGE}`;
        break;
      case 'rapier':
        if (inWindow) {
          taken = 0;
          label = 'HOARFROST PARRY!';
          viewmodelAnimRef.current.recoilRotY = 0.25;
          if (attacker && atkPos) {
            hurt(Math.round(w.stats.damage * 1.4 * passivesRef.current.meleeDamageMultiplier), 'FROST RIPOSTE!');
            if ((attacker.freezeImmuneTimer ?? 0) <= 0) {
              const dur = attacker.category === 'boss' || attacker.category === 'titan' ? 0.75 : 1.6;
              attacker.frozenTimer = dur;
              attacker.freezeImmuneTimer = dur + 3;
            }
            spawn3DHitSparks(atkPos, '#e0f2fe', 22);
            spawnMeleeHitFx('rapier', atkPos, 3, w.color);
          }
        } else {
          label = 'FROST GUARD';
          if (attacker) {
            attacker.chillSlowTimer = 3;
            attacker.chillHits = (attacker.chillHits ?? 0) + 2;
          }
        }
        break;
      case 'whip':
        label = kind === 'projectile' ? 'COIL DEFLECT' : 'COIL WARD';
        if (attacker && atkPos) {
          hurt(Math.round(w.stats.damage * 0.5), 'COIL SHOCK!');
          attacker.shockTimer = 1.6;
          attacker.attackCooldown += 0.7;
          pushAway(12);
          spawn3DHitSparks(atkPos, '#d9f99d', 14);
        }
        break;
      case 'disc':
        label = 'RONDO SHIELD';
        if (attacker && atkPos) {
          hurt(Math.round(w.stats.damage * 0.9 * passivesRef.current.meleeDamageMultiplier), 'RONDO COUNTER!');
          pushAway(7);
          spawnMeleeHitFx('disc', atkPos, 2, w.color);
        }
        break;
    }

    sound.playShieldBlock();
    spawnDamageText(taken > 0 ? `${label} -${taken}` : label, g.color);
    if (taken > 0) {
      const absorb = Math.min(playerShieldRef.current, taken);
      playerShieldRef.current -= absorb;
      playerHpRef.current = Math.max(0, playerHpRef.current - (taken - absorb));
      battleStats.current.damageTaken += taken;
    }
    return taken;
  }, [getActiveWeapon, spawnDamageText, spawn3DHitSparks, spawnMeleeHitFx]);
  const applyGuardBlockRef = useRef(applyGuardBlock);
  applyGuardBlockRef.current = applyGuardBlock;

  /** Pile bunker: consume stored guard charge as a damage multiplier for the next hit. */
  const consumeLanceCharge = (weaponId: string): number => {
    if (weaponId !== 'blade_thunder_lance' || lanceChargeRef.current <= 0) return 1;
    const n = lanceChargeRef.current;
    lanceChargeRef.current = 0;
    setAnnouncement(`IRON BASTION // STAKE OVERCHARGE ×${n} (+${n * 50}%)`);
    return 1 + 0.5 * n;
  };

  /** Hold time (s) needed before a charge weapon can release a full shot. */
  const getChargeDuration = (w: Weapon): number =>
    w.id === 'heavy_solar_cannon' ? 0.95 : hasSkill('rail_mod_charge') ? 0.38 : 0.72;

  // INFIGHT 固有技（右クリック）: Sweep / Leap Slam / Thunder Thrust / Ripper Rush
  const executeMeleeSkill = () => {
    const activeW = getActiveWeapon();
    if (activeW.category !== 'MELEE') return;
    if (performance.now() / 1000 < skillCooldownUntilRef.current) return;
    if (activeW.modelType === 'axe' || activeW.id === 'blade_axe') {
      executeExecutionerLeapSlam();
    } else if (activeW.id === 'blade_thunder_lance') {
      executeThunderLanceThrust();
    } else if (activeW.id === 'blade_chainsaw') {
      executeRipperRush();
    } else if (activeW.id === 'blade_scythe') {
      executeScytheTempest();
    } else if (activeW.id === 'blade_katana') {
      executeKatanaIai();
    } else if (activeW.id === 'blade_glaive') {
      executeGlaiveInferno();
    } else if (activeW.id === 'blade_tachyon') {
      executePhaseBarrage();
    } else if (activeW.id === 'blade_chainspear') {
      executeAbyssHaul();
    } else if (activeW.id === 'blade_gauntlets') {
      executeThunderBarrage();
    } else if (activeW.id === 'blade_astro_zwill') {
      executeTwinCyclone();
    } else if (activeW.id === 'blade_anchor') {
      executeAbyssalTrawl();
    } else if (activeW.id === 'blade_rapier') {
      executeRapierFleche();
    } else if (activeW.id === 'blade_whip') {
      executeWhipStorm();
    } else if (activeW.id === 'blade_disc') {
      executeDiscHalo();
    } else {
      executeSweepAttack();
    }
  };
  const executeMeleeSkillRef = useRef(executeMeleeSkill);
  executeMeleeSkillRef.current = executeMeleeSkill;

  /** 右クリック溜めが完了していれば（左クリックと同時押しで）固有技を発動する。発動したら true */
  const tryChargedMeleeSkill = (): boolean => {
    if (meleeChargeStartRef.current === 0 || !meleeChargeReadyRef.current) return false;
    if (getActiveWeapon().category !== 'MELEE') return false;
    const now = performance.now() / 1000;
    if (now < skillCooldownUntilRef.current || isSweepingRef.current) return false;
    executeMeleeSkillRef.current();
    // 発動後はクールダウンに入るので溜めを終了（右クリックを押し続けていても通常攻撃が使える）
    meleeChargeStartRef.current = 0;
    meleeChargeReadyRef.current = false;
    setChargeGauge(null);
    return true;
  };

  /** 溜め中の武器モーション用の進行度 0..1 (溜めていない / 技の最中は 0) */
  const getMeleeChargeAnimP = (): number => {
    if (meleeChargeStartRef.current === 0) return 0;
    const now = performance.now() / 1000;
    if (isSweepingRef.current) return 0;
    const a = viewmodelAnimRef.current;
    if (a.meleeActive && a.meleeProgress < 1.0) return 0;
    return Math.min(1, (now - meleeChargeStartRef.current) / MELEE_CHARGE_TIME);
  };

  // Primary Attack
  const executePrimaryAttack = useCallback(() => {
    const activeW = getActiveWeapon();
    const curSlot = currentSlotRef.current;
    const now = performance.now() / 1000;
    if (tryChargedMeleeSkill()) return;
    // 溜め中（右クリック押下中）は通常の近接攻撃はできない
    if (activeW.category === 'MELEE' && meleeChargeStartRef.current !== 0) return;

    if (isReloadingRef.current) return;

    // 1. MELEE ATTACK (武器ごとに固有のモーション・エフェクト・判定タイミング)
    if (activeW.category === 'MELEE') {
      // クールタイム中は近接攻撃不可（三段攻撃後または技後の硬直時間）
      if (now < meleeCooldownUntilRef.current || isSweepingRef.current) return;

      // RAVAGER-09: 押した瞬間に振り下ろし開始。以降は押している間ずっと削る (updateChainsawGrind)
      if (activeW.id === 'blade_chainsaw') {
        if (isSweepingRef.current || sawGrindStartRef.current > 0) return;
        sawGrindStartRef.current = now;
        sawDropDoneRef.current = false;
        sawRpmRef.current = 0;
        sawTextRef.current = { dmg: 0, t: now };
        viewmodelAnimRef.current.meleeActive = false;
        _forward.set(0, 0, -1).applyAxisAngle(_up, currentRotation.current.yaw);
        playerVelocity.current.addScaledVector(_forward, getMeleeProfile('chainsaw').lunge[0]);
        sound.playChainsawRev();
        sound.playMeleeSwing('chainsaw', 1);
        setAnnouncement('RAVAGER-09 // RAVAGE DROP → GRIND');
        return;
      }

      const meleeStyle = getMeleeStyle(activeW);
      const profile = getMeleeProfile(meleeStyle);
      // 極端な連打による一瞬の連続発射を防止（武器ごとの最小間隔）
      if (now - lastMeleeSwingTimeRef.current < profile.minInterval) return;
      lastMeleeSwingTimeRef.current = now;

      const timeSinceLast = now - lastComboTimeRef.current;
      const hasGauntletCombo4 = activeW.id === 'blade_gauntlets' && hasSkill('gauntlet_mod_combo');
      const maxComboStep = hasGauntletCombo4 ? 4 : 3;
      const comboWindow = meleeStyle === 'hammer' ? 1.1 : meleeStyle === 'glaive' || meleeStyle === 'scythe' ? 0.95 : 0.75;

      let currentStep = 1;
      if (timeSinceLast < comboWindow) {
        currentStep = comboStepRef.current === 1 ? 2 : comboStepRef.current === 2 ? 3 : (maxComboStep === 4 && comboStepRef.current === 3) ? 4 : 1;
      }
      comboStepRef.current = currentStep;
      lastComboTimeRef.current = now;

      sound.playMeleeSwing(meleeStyle, currentStep);

      // Trigger weapon-specific procedural swing animation in game loop
      viewmodelAnimRef.current.meleeActive = true;
      viewmodelAnimRef.current.meleeStep = currentStep;
      viewmodelAnimRef.current.meleeProgress = 0.0;
      viewmodelAnimRef.current.meleeVariant = hasGauntletCombo4 ? 1 : 0;

      // Forward lunge (武器ごとに踏み込み量が違う)
      _forward.set(0, 0, -1).applyAxisAngle(_up, currentRotation.current.yaw);
      playerVelocity.current.add(_forward.clone().multiplyScalar(profile.lunge[currentStep - 1]));

      // Phase Dagger blink ability (瞬歩空間跳躍)
      if (activeW.id === 'blade_tachyon') {
        _forward.set(0, 0, -1).applyAxisAngle(_up, currentRotation.current.yaw);
        const blinkDist = hasSkill('phase_mod_distance') ? 5.5 : 3.2;
        playerPos.current.addScaledVector(_forward, blinkDist);
        sound.playDash();
      }

      // Camera impulse & recoil (軽い武器ほど小さく、ハンマーは着弾時に別途)
      const rs = meleeStyle === 'dagger' ? 0.4 : meleeStyle === 'katana' ? 0.8 : meleeStyle === 'gauntlets' ? 0.7 : meleeStyle === 'twinblade' ? 0.6 : meleeStyle === 'hammer' ? 0 : 1;
      if (currentStep === 1) {
        viewmodelAnimRef.current.recoilRotY = 0.16 * rs;
        viewmodelAnimRef.current.recoilRotX = 0.08 * rs;
      } else if (currentStep === 2) {
        viewmodelAnimRef.current.recoilRotY = -0.18 * rs;
        viewmodelAnimRef.current.recoilRotX = -0.08 * rs;
      } else if (currentStep === 3) {
        viewmodelAnimRef.current.recoilRotX = -0.32 * rs;
        viewmodelAnimRef.current.recoilPos.y = -0.12 * rs;
      } else {
        viewmodelAnimRef.current.recoilRotX = -0.42 * rs;
        viewmodelAnimRef.current.recoilPos.y = -0.18 * rs;
      }

      // Damage calculation
      const stepMulti = currentStep === 1 ? 1.0 : currentStep === 2 ? 1.25 : currentStep === 3 ? 1.85 : 2.45;
      const totalDmg = Math.round(activeW.stats.damage * stepMulti * passivesRef.current.meleeDamageMultiplier * getWeaponDamageMultiplier(activeW.id) * consumeLanceCharge(activeW.id));
      const isLance = activeW.id === 'blade_thunder_lance';
      const isChainSpear = activeW.id === 'blade_chainspear';
      const isHammer = activeW.id === 'blade_axe';
      const isKatana = activeW.id === 'blade_katana';
      const isAnchor = activeW.id === 'blade_anchor';

      const slashRange = (
        isLance ? (currentStep >= 3 ? 12.5 : 10.5) :
        isChainSpear ? (hasSkill('chain_mod_range') ? 22.0 : 14.5) :
        isHammer ? ((hasSkill('hammer_mod_radius') ? 8.2 : 5.8) + (currentStep >= 3 ? 1.5 : 0)) :
        isKatana ? ((hasSkill('blade_mod_reach') ? activeW.stats.range * 1.3 : activeW.stats.range) + (currentStep >= 3 ? 1.4 : 0)) :
        (activeW.stats.range + (currentStep >= 3 ? 1.2 : 0))
      ) * passivesRef.current.sweepRangeMultiplier;

      // ダメージ判定とエフェクトは「刃が当たる瞬間」に合わせる（重い武器ほど遅れて着弾）
      const speedMul = passivesRef.current.meleeSpeedMultiplier || 1;
      const hitDelay = Math.min(0.35, profile.impact[currentStep - 1] / (profile.speed[currentStep - 1] * speedMul));

      const performHit = () => {
        _forward.set(0, 0, -1).applyAxisAngle(_up, currentRotation.current.yaw);

        // 武器固有の3D斬撃・衝撃波エフェクト
        spawn3DMeleeSlashEffect(currentStep, activeW, slashRange);

        // 着弾時のカメラの揺れ（重量武器）
        if (isHammer) {
          viewmodelAnimRef.current.recoilRotX = currentStep === 3 ? -0.4 : -0.26;
          viewmodelAnimRef.current.recoilPos.y = currentStep === 3 ? -0.2 : -0.12;
        } else if (isAnchor) {
          viewmodelAnimRef.current.recoilRotX = currentStep === 3 ? -0.38 : -0.2;
          viewmodelAnimRef.current.recoilPos.y = currentStep === 3 ? -0.18 : -0.1;
          if (currentStep === 3) {
            cameraShakeRef.current = { amp: 0.07, until: performance.now() / 1000 + 0.28, dur: 0.28 };
            sound.playEnemyExplode();
          }
        } else if (meleeStyle === 'glaive' || meleeStyle === 'scythe') {
          viewmodelAnimRef.current.recoilRotY = (currentStep === 2 ? 1 : -1) * 0.12;
        }

        // ORBITAL RONDO: 刃は投擲物として飛ぶ（命中判定は arsenal 側）
        if (meleeStyle === 'disc') {
          throwRondo(currentStep, activeW, totalDmg);
          swingCameraRoll(currentStep === 2 ? -0.7 : 0.7);
          syncHudState();
          return;
        }

        // 振り抜きに合わせてカメラを傾ける（右→左の振りは +、左→右は -、縦振りは小さく）
        {
          const dirSign = currentStep === 1 ? 1 : currentStep === 2 ? (meleeStyle === 'hammer' ? 1 : -1) : 0;
          const rollAmt = (meleeStyle === 'dagger' ? 0.5 : meleeStyle === 'hammer' || meleeStyle === 'anchor' ? 1.1 : 0.85) * (currentStep >= 3 ? 0.4 : 1);
          swingCameraRoll(dirSign !== 0 ? dirSign * rollAmt : (Math.random() < 0.5 ? -1 : 1) * rollAmt * 0.5);
        }

        // Hit Detection
        let meleeHitCount = 0;
        let chainSpearHits = 0;
        const maxChainSpearHits = hasSkill('chain_mod_pierce') ? 3 : 1;

        enemiesRef.current.forEach((enemy) => {
          if (enemy.isDead) return;
          const dist = playerPos.current.distanceTo(enemy.mesh.position);
          if (dist <= slashRange) {
            const toEnemy = _toEnemy.subVectors(enemy.mesh.position, playerPos.current);
            const forwardDistance = toEnemy.dot(_forward);
            const lateralAxis = new THREE.Vector3(1, 0, 0).applyAxisAngle(_up, currentRotation.current.yaw);
            const lateralDistance = Math.abs(toEnemy.dot(lateralAxis));
            const inLanceThrust = (isLance || isChainSpear) && forwardDistance > 0.4 && forwardDistance <= slashRange && lateralDistance <= (currentStep >= 3 ? 4.2 : 3.2);
            const inHammerRadial = isHammer && dist <= slashRange; // Gravity hammer attacks in circular shockwave
            const arcDot = meleeStyle === 'whip' && currentStep === 2 ? -0.05 : profile.arcDot;
            const inStandardArc = !isLance && !isChainSpear && !isHammer && dist <= slashRange && _forward.dot(toEnemy.clone().normalize()) > arcDot;
            // ANCHOR DROP lands all around the player
            const inAnchorDrop = isAnchor && currentStep === 3 && dist <= slashRange;

            if (inLanceThrust || inHammerRadial || inStandardArc || inAnchorDrop) {
              if (isChainSpear && chainSpearHits >= maxChainSpearHits) return;
              if (isChainSpear) chainSpearHits++;

              // Backstab detection for Phase Dagger
              let actualMeleeDmg = totalDmg;
              let isBackstab = false;
              if (activeW.id === 'blade_tachyon') {
                isBackstab = _forward.dot(toEnemy.clone().normalize()) > 0.55;
                if (isBackstab) {
                  const backMult = hasSkill('phase_mod_backstab') ? 2.6 : 1.8;
                  actualMeleeDmg = Math.round(totalDmg * backMult);
                }
              }

              // Frozen target extra damage
              if ((enemy.frozenTimer ?? 0) > 0) {
                const fMult = hasSkill('frost_mod_damage') ? 1.6 : 1.25;
                actualMeleeDmg = Math.round(actualMeleeDmg * fMult);
              }

              // ANCHRON-G2: moored targets take extra damage from the anchor
              if (isAnchor && ((enemy.mooredTimer ?? 0) > 0 || (enemy.rootTimer ?? 0) > 0)) {
                actualMeleeDmg = Math.round(actualMeleeDmg * (hasSkill('anchor_mod_weight') ? 1.6 : 1.25));
              }

              enemy.hp -= actualMeleeDmg;
              battleStats.current.damageDealt += actualMeleeDmg;
              sound.playEnemyHit();
              meleeHitCount++;

              // 3D Hit Impact Sparks + 武器固有のヒットエフェクト
              const hitPos = enemy.mesh.position.clone().add(new THREE.Vector3(0, 0.8, 0));
              spawn3DHitSparks(hitPos, activeW.color, currentStep >= 3 ? 24 : 14);
              spawnMeleeHitFx(meleeStyle, hitPos, currentStep, activeW.color);

              // GLACIEL: 突くたびに冷気が溜まり凍結。凍った敵への三段目は粉砕
              if (meleeStyle === 'rapier') applyRapierFrost(enemy, currentStep, actualMeleeDmg);

              // VIPERCOIL: 雷が近くの敵へ跳ぶ。三段目は絡め取って手元へ引きずり寄せる
              if (meleeStyle === 'whip') {
                const near = enemiesRef.current.find((o) => o !== enemy && !o.isDead && o.mesh.position.distanceTo(enemy.mesh.position) < 6);
                if (near) {
                  const arc = Math.round(actualMeleeDmg * 0.35);
                  near.hp -= arc;
                  near.shockTimer = Math.max(near.shockTimer ?? 0, 1.2);
                  battleStats.current.damageDealt += arc;
                  spawn3DHitSparks(near.mesh.position.clone().add(new THREE.Vector3(0, 0.8, 0)), '#d9f99d', 8);
                  spawnDamageText(`ARC -${arc}`, '#a3e635');
                }
                if (currentStep === 3) {
                  const pull = playerPos.current.clone().sub(enemy.mesh.position).setY(0);
                  const pd = pull.length();
                  if (pd > 2.5) enemy.velocity.addScaledVector(pull.normalize(), Math.min(30, pd * 3.2));
                  enemy.attackCooldown = Math.max(enemy.attackCooldown, 1.0);
                  enemy.shockTimer = Math.max(enemy.shockTimer ?? 0, 1.5);
                  spawnDamageText('SNARED!', '#a3e635');
                }
              }

              // Special: Energy Blade Echo Slash (残光斬撃)
              if (isKatana && hasSkill('blade_mod_echo') && Math.random() < 0.35) {
                const echoDmg = Math.round(actualMeleeDmg * 0.48);
                enemy.hp -= echoDmg;
                battleStats.current.damageDealt += echoDmg;
                spawnDamageText(`ECHO SLASH! -${echoDmg}`, '#38bdf8');
                spawn3DHitSparks(enemy.mesh.position.clone().add(new THREE.Vector3(0, 0.9, 0)), '#38bdf8', 16);
              }

              // Special: Chain Spear pulls enemy toward player
              if (isChainSpear) {
                const toPlayer = playerPos.current.clone().sub(enemy.mesh.position).normalize();
                toPlayer.y = 0.25;
                enemy.velocity.addScaledVector(toPlayer, 28);
                enemy.shockTimer = 1.4;

                const pullBonus = hasSkill('chain_mod_pull') ? 1.4 : 1.0;
                const finalSpearDmg = Math.round(actualMeleeDmg * pullBonus);
                if (finalSpearDmg > actualMeleeDmg) {
                  const extraPullDmg = finalSpearDmg - actualMeleeDmg;
                  enemy.hp -= extraPullDmg;
                  battleStats.current.damageDealt += extraPullDmg;
                }

                spawnDamageText(`HARPOON PULL! -${finalSpearDmg}`, '#f59e0b');
                setAnnouncement('LEVIATHAN HOOK // REELED IN!');

                // Harpoon cable line
                if (sceneRef.current) {
                  const cGeo = new THREE.BufferGeometry().setFromPoints([playerPos.current.clone(), enemy.mesh.position.clone()]);
                  const cMat = new THREE.LineBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.95 });
                  const cLine = new THREE.Line(cGeo, cMat);
                  sceneRef.current.add(cLine);
                  setTimeout(() => { sceneRef.current?.remove(cLine); cGeo.dispose(); cMat.dispose(); }, 180);
                }
              } else if (isHammer) {
                // Gravity hammer: circular shockwave knocks all surrounding enemies outward from center
                const hammerKnock = (hasSkill('hammer_mod_knockback') ? 28.0 : 18.0) * passivesRef.current.sweepKnockbackMultiplier;
                const radialDir = enemy.mesh.position.clone().sub(playerPos.current).normalize();
                radialDir.y = 0.45;
                enemy.velocity.x += radialDir.x * hammerKnock;
                enemy.velocity.z += radialDir.z * hammerKnock;
                enemy.mesh.position.y = isFlyingCategory(enemy.category) ? enemy.mesh.position.y : 0;
              } else if (isAnchor) {
                // ANCHRON-G2: every hit moors the target; the hook drags it in, the drop pins it to the spot
                if (currentStep === 1) {
                  enemy.velocity.x += _forward.x * 7;
                  enemy.velocity.z += _forward.z * 7;
                  moorEnemy(enemy, 3.0);
                } else if (currentStep === 2) {
                  const pull = playerPos.current.clone().sub(enemy.mesh.position).setY(0).normalize();
                  enemy.velocity.x += pull.x * 18;
                  enemy.velocity.z += pull.z * 18;
                  moorEnemy(enemy, 3.0);
                } else {
                  enemy.velocity.x = 0;
                  enemy.velocity.z = 0;
                  moorEnemy(enemy, 3.0, 1.6);
                }
                enemy.mesh.position.y = isFlyingCategory(enemy.category) ? enemy.mesh.position.y : 0;
              } else if (meleeStyle === 'whip' && currentStep === 3) {
                // pulled in above
              } else if (meleeStyle === 'scythe' && currentStep === 3) {
                // SOUL RIP: 敵を手前へ引き裂くように引き寄せる
                const pull = playerPos.current.clone().sub(enemy.mesh.position).normalize();
                pull.y = 0.15;
                enemy.velocity.addScaledVector(pull, 16);
              } else {
                // Standard & Pile bunker knockback
                const knockMagnitude = isLance ? (currentStep >= 3 ? 24 : 16) : (currentStep >= 3 ? 17 : 10);
                enemy.velocity.x += _forward.x * knockMagnitude;
                enemy.velocity.z += _forward.z * knockMagnitude;
                enemy.mesh.position.y = isFlyingCategory(enemy.category) ? enemy.mesh.position.y : 0;

                // Pile Bunker Wall Crash Enhancement
                if (isLance && hasSkill('pile_mod_wall')) {
                  const bound = 36.0;
                  if (Math.abs(enemy.mesh.position.x) >= bound || Math.abs(enemy.mesh.position.z) >= bound) {
                    const wallDmg = Math.round(actualMeleeDmg * 0.55);
                    enemy.hp -= wallDmg;
                    battleStats.current.damageDealt += wallDmg;
                    spawnDamageText(`WALL CRUSH! -${wallDmg}`, '#06b6d4');
                    spawn3DHitSparks(enemy.mesh.position, '#06b6d4', 24);
                  }
                }
              }

              // Special: ASTRO-ZWILL 十字斬りフィニッシュは周囲へ星屑の爆ぜ（スプラッシュ）
              if (meleeStyle === 'twinblade' && currentStep >= 3) {
                let splashed = 0;
                enemiesRef.current.forEach((other) => {
                  if (other === enemy || other.isDead || splashed >= 4) return;
                  if (other.mesh.position.distanceTo(enemy.mesh.position) > 4.5) return;
                  splashed++;
                  const novaDmg = Math.round(actualMeleeDmg * 0.4);
                  other.hp -= novaDmg;
                  battleStats.current.damageDealt += novaDmg;
                  spawnDamageText(`NOVA! -${novaDmg}`, '#f472b6');
                  spawn3DHitSparks(other.mesh.position.clone().add(new THREE.Vector3(0, 0.8, 0)), '#f9a8d4', 12);
                });
              }

              // Special: Thunder Gauntlets chain shock discharge on combo step >= 2
              if (activeW.id === 'blade_gauntlets' && currentStep >= 2) {
                let hops = 0;
                const chainRadius = hasSkill('gauntlet_mod_radius') ? 12.0 : 7.0;
                enemiesRef.current.forEach((other) => {
                  if (other !== enemy && !other.isDead && hops < 4) {
                    if (other.mesh.position.distanceTo(enemy.mesh.position) <= chainRadius) {
                      hops++;
                      const shockDmg = Math.round(actualMeleeDmg * 0.45);
                      other.hp -= shockDmg;
                      other.shockTimer = 2.0;
                      battleStats.current.damageDealt += shockDmg;
                      spawnDamageText(`SHOCK! -${shockDmg}`, '#06b6d4');
                      spawn3DHitSparks(other.mesh.position.clone().add(new THREE.Vector3(0, 0.8, 0)), '#06b6d4', 12);
                    }
                  }
                });
              }

              if (isLance) {
                const thrustDir = _forward.clone().normalize();
                const impact = enemy.mesh.position.clone().add(new THREE.Vector3(0, 0.95, 0));
                spawn3DHitSparks(impact, '#67e8f9', currentStep >= 3 ? 32 : 22);
                const lineGeo = new THREE.CylinderGeometry(0.035, 0.11, 2.2, 8, 1, true);
                const lineMat = new THREE.MeshBasicMaterial({ color: '#67e8f9', transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending });
                const thrustFx = new THREE.Mesh(lineGeo, lineMat);
                thrustFx.position.copy(impact).addScaledVector(thrustDir, -1.1);
                thrustFx.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), thrustDir);
                if (sceneRef.current) {
                  sceneRef.current.add(thrustFx);
                  spatialEffectsRef.current.push({ mesh: thrustFx, particles: [], lifetime: 0.12, maxLifetime: 0.12 });
                }
              }

              // Phase Dagger kill reset
              if (enemy.hp <= 0 && activeW.id === 'blade_tachyon' && hasSkill('phase_mod_refresh')) {
                meleeCooldownUntilRef.current = 0;
                setAnnouncement('TACHYON FANG // KILL REFRESH (BLINK READY)!');
              }

              if (!isChainSpear) {
                const label = isBackstab ? 'BACKSTAB' : isLance ? 'THRUST' : profile.moveNames[currentStep - 1];
                spawnDamageText(`${label}! -${actualMeleeDmg}`, isBackstab ? '#a855f7' : currentStep >= 3 ? '#e11d48' : '#0284c7');
              }
              setHitMarkerActive(true);
              setTimeout(() => setHitMarkerActive(false), 90);
            }
          }
        });

        // Gravity Hammer Lingering Gravity Field
        if (isHammer && hasSkill('hammer_mod_gravity') && sceneRef.current) {
          const wellGroup = new THREE.Group();
          const torus = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.06, 6, 18), new THREE.MeshBasicMaterial({ color: 0xf97316, transparent: true, opacity: 0.85 }));
          torus.rotation.x = Math.PI / 2;
          wellGroup.add(torus);
          wellGroup.position.copy(playerPos.current);
          sceneRef.current.add(wellGroup);
          gravityWellsRef.current.push({
            mesh: wellGroup,
            position: playerPos.current.clone(),
            lifetime: 1.8,
            damage: Math.round(activeW.stats.damage * 0.4),
            radius: 7.0,
          });
        }
        meleeImpactFeel(meleeStyle, currentStep, meleeHitCount);
        syncHudState();
      };

      if (hitDelay > 0.06) setTimeout(performHit, hitDelay * 1000);
      else performHit();

      if (activeW.modelType === 'gauntlets') {
        if (currentStep === 1) setAnnouncement('PUNCH 1 // LEFT JAB');
        else if (currentStep === 2) setAnnouncement('PUNCH 2 // RIGHT CROSS');
        else if (currentStep === 3) setAnnouncement(maxComboStep === 4 ? 'PUNCH 3 // UPPERCUT' : 'PUNCH 3 // DUAL PALM FINISHER (COOLING DOWN)');
        else setAnnouncement('PUNCH 4 // MEGA THUNDER PALM FINISHER (COOLING DOWN)');
      } else if (activeW.id === 'blade_thunder_lance') {
        if (currentStep === 1) setAnnouncement('STAKE 1 // LONG-RANGE SHOT');
        else if (currentStep === 2) setAnnouncement('STAKE 2 // FOLLOW-UP PIERCE');
        else setAnnouncement('STAKE 3 // DEEP PENETRATION FINISHER (COOLING DOWN)');
      } else {
        const shortName = activeW.name.split(' // ')[0];
        setAnnouncement(`${shortName} // ${profile.moveNames[currentStep - 1]}${currentStep >= maxComboStep ? ' (COOLING DOWN)' : ''}`);
      }

      // 三段攻撃（フィニッシャー）の後は少しのクールタイムを設ける
      if (currentStep >= maxComboStep) {
        let finisherCooldown = MELEE_SKILL_COOLDOWN;
        if (isLance && hasSkill('pile_mod_charge')) finisherCooldown = 0.38;
        if (isKatana && hasSkill('blade_mod_combo')) finisherCooldown = 0.35;
        // クールタイム明けの次の一撃は必ず1段目から始める（長押しでも連打でも同じ）
        lastComboTimeRef.current = -1e9;

        meleeCooldownUntilRef.current = now + finisherCooldown;
        meleeCooldownDurationRef.current = finisherCooldown;
        meleeCooldownReasonRef.current = 'finisher';
        setTimeout(() => {
          comboStepRef.current = 1;
          syncHudState();
        }, finisherCooldown * 1000);
      }

      syncHudState();
      return;
    }

    // 2. DYNAMITE THROW
    if (activeW.modelType === 'dynamite') {
      const curAmmo = ammoStockRef.current[curSlot] ?? activeW.stats.maxAmmo;
      if (curAmmo <= 0) {
        sound.playDefeat();
        setAnnouncement(activeW.id === 'heavy_sentry' ? 'RECHARGING VOLT SENTRY...' : activeW.id === 'grenade_palcer' ? 'RECHARGING PALCER...' : 'RECHARGING DYNAMITE...');
        return;
      }

      if (now - lastGunShotRef.current < 0.9 / activeW.stats.fireRate) return;
      lastGunShotRef.current = now;

      ammoStockRef.current[curSlot] = curAmmo - 1;
      syncHudState();
      sound.playHeavyLaunch();
      const isSentryThrow = activeW.id === 'heavy_sentry';
      const throwKind = throwKindOf(activeW.id);
      setAnnouncement(isSentryThrow ? 'VOLT SENTRY THROWN!' : throwKind === 'stun' ? 'PALCER THROWN!' : 'DYNAMITE THROWN!');

      // Trigger smooth procedural dynamite throw windup & toss animation
      viewmodelAnimRef.current.throwActive = true;
      viewmodelAnimRef.current.throwProgress = 0.0;

      // VOLT SENTRY: 畳まれたタレットを投げ、着地点で展開する (設置数の上限は arsenal 側で管理)
      if (isSentryThrow) {
        const ars = arsenalRef.current;
        const actx = arsenalCtxRef.current;
        const cam = cameraRef.current;
        if (ars && actx && cam) {
          const dir = new THREE.Vector3();
          cam.getWorldDirection(dir);
          const dmg = activeW.stats.damage * getWeaponDamageMultiplier(activeW.id) * passivesRef.current.rangedDamageMultiplier;
          ars.deploySentry(actx, cam.position.clone().addScaledVector(dir, 0.6), dir, dmg);
        }
        return;
      }

      if (sceneRef.current && cameraRef.current) {
        const origin = cameraRef.current.position.clone();
        const dir = new THREE.Vector3();
        cameraRef.current.getWorldDirection(dir);

        const dynGroup = new THREE.Group();
        if (throwKind === 'stun') {
          // PALCER: 銀の円筒 + シアンの発光リング
          const body = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.26, 12), new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8, roughness: 0.3 }));
          dynGroup.add(body);
          const band = new THREE.Mesh(new THREE.CylinderGeometry(0.074, 0.074, 0.05, 12), new THREE.MeshBasicMaterial({ color: 0x67e8f9 }));
          band.position.y = 0.04;
          dynGroup.add(band);
          const cap = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
          cap.position.y = 0.15;
          dynGroup.add(cap);
        } else {
          const stickGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.45, 8);
          const stickMat = new THREE.MeshStandardMaterial({ color: 0xdc2626 });
          const m1 = new THREE.Mesh(stickGeo, stickMat);
          m1.position.set(-0.05, 0, 0);
          dynGroup.add(m1);
          const m2 = new THREE.Mesh(stickGeo, stickMat);
          m2.position.set(0.05, 0, 0);
          dynGroup.add(m2);
        }

        dynGroup.position.copy(origin).addScaledVector(dir, 0.6);
        sceneRef.current.add(dynGroup);

        const prof = THROW_PROFILE[throwKind];
        const initialVel = dir.clone().multiplyScalar(prof.speed).add(new THREE.Vector3(0, prof.up, 0));
        dynamiteProjectilesRef.current.push({
          mesh: dynGroup,
          velocity: initialVel,
          lifetime: 3.5,
          damage: Math.round(activeW.stats.damage * getWeaponDamageMultiplier(activeW.id)),
          kind: throwKind,
        });
      }
      return;
    }

    // 3. GUNS & FIREARMS
    const curAmmo = ammoStockRef.current[curSlot] ?? activeW.stats.maxAmmo;
    if (curAmmo <= 0) {
      sound.playDefeat();
      setAnnouncement('RELOAD REQUIRED [R]');
      return;
    }
    // MICRO HIVE: pressing only starts painting lock-ons; the salvo is fired from the frame loop on release
    if (activeW.id === 'sub_hive') {
      setAnnouncement('MICRO HIVE // LOCKING... (RELEASE TO FIRE)');
      return;
    }

    // PHOTON GATLING only fires during the sustained burst that follows a charge (driven from the frame loop)
    if (activeW.id === 'heavy_photon_gatling' && gatlingFireLeftRef.current <= 0) return;
    // SHR1NKER is charged and released entirely from the frame loop
    if (activeW.id === 'heavy_shr1nker') return;

    // Unified fire-rate gate: semi-auto guns can no longer be click-spammed past their stat.
    // (Photon Gatling's effective rate depends on its barrel spin-up; burst follow-ups bypass the gate.)
    if (!burstBypassRef.current) {
      const rampRate = activeW.id === 'main_spreader' ? 1 + SPREADER_RATE_BONUS * spreaderHeatRef.current
        : activeW.id === 'heavy_photon_gatling' ? gatlingRateMul()
        : 1;
      if (!autoFireRef.current && now - lastGunShotRef.current < 0.9 / (activeW.stats.fireRate * rampRate)) return;
    }

    // Beam-class charge mechanic (長押しでチャージ → 離すと超高速弾を発射): LONGINUS / SOLAR FLARE
    if (activeW.id === 'heavy_railgun' || activeW.id === 'heavy_solar_cannon') {
      const isSolarCharge = activeW.id === 'heavy_solar_cannon';
      if (!railChargedRef.current) {
        // Pressing the trigger only starts charging; the shot is released in handleMouseUp.
        if (chargeStartRef.current === 0) {
          chargeStartRef.current = now;
          chargeReadyRef.current = false;
          sound.playUiHover();
          setAnnouncement(isSolarCharge ? 'SOLAR CORE // CHARGING PHOTON CHAMBER... (HOLD)' : 'RAIL CANNON // CHARGING CAPACITOR... (HOLD)');
        }
        return;
      }
      railChargedRef.current = false;
      setAnnouncement(isSolarCharge ? 'SOLAR FLARE // PHOTON BEAM RELEASED!' : 'RAIL CANNON // DISCHARGED!');
    }

    if (!burstBypassRef.current) lastGunShotRef.current = now;

    ammoStockRef.current[curSlot] = curAmmo - 1;
    syncHudState();

    // HYPERION-X: 3-round burst (the first round is fired now, two follow-ups shortly after)
    if (activeW.id === 'main_hyperion' && !burstBypassRef.current) {
      [70, 140].forEach((ms) => {
        setTimeout(() => {
          if (!sceneRef.current || isPausedRef.current || isReloadingRef.current) return;
          if (getActiveWeapon().id !== 'main_hyperion') return;
          burstBypassRef.current = true;
          try {
            executePrimaryAttack();
          } finally {
            burstBypassRef.current = false;
          }
        }, ms);
      });
    }

    if (activeW.id === 'heavy_inferno') {
      if (flameSfxRef.current++ % 3 === 0) sound.playFlameTick();
    } else if (activeW.id === 'main_sonic') {
      sound.playBeamPulse(0.6);
    } else if (activeW.id === 'main_buzzsaw') {
      sound.playChainsawRev(true);
    } else if (activeW.id === 'main_needler') {
      sound.playBubbleShot();
      sound.playHandgunShot();
    } else if (activeW.modelType === 'handgun' || activeW.modelType === 'revolver') {
      sound.playHandgunShot();
    } else if (activeW.modelType === 'shotgun') {
      sound.playShotgunBlast();
    } else if (activeW.modelType === 'launcher' || activeW.modelType === 'railgun') {
      sound.playHeavyLaunch();
    } else if (activeW.id === 'main_bubblas') {
      sound.playBubbleShot();
    } else {
      sound.playRifleShot();
    }

    // Muzzle Flash
    if (muzzleFlashLightRef.current) {
      muzzleFlashLightRef.current.intensity = 2.5;
      setTimeout(() => {
        if (muzzleFlashLightRef.current) muzzleFlashLightRef.current.intensity = 0;
      }, 35);
    }

    // Smooth procedural spring recoil impulse
    const isAds = isAimingRef.current;
    if (!isAds) {
      setCrosshairBloomed(true);
      setTimeout(() => setCrosshairBloomed(false), 130);
    }

    // TWIN VIPER mostly recoils per hand, so the shared rig only gets a light nudge
    const rigKick = activeW.id === 'sub_akimbo' ? 0.3 : activeW.id === 'main_bubblas' ? 0.2 : activeW.id === 'heavy_inferno' ? 0.08 : activeW.id === 'main_needler' ? 0.45 : 1;
    const kickZ = (isAds ? 0.035 : activeW.category === 'HEAVY' ? 0.08 : 0.055) * rigKick;
    const kickY = (isAds ? -0.008 : 0.012) * rigKick;
    const kickRotX = (isAds ? 0.026 : activeW.category === 'HEAVY' ? 0.06 : 0.045) * rigKick;

    viewmodelAnimRef.current.recoilPos.z += kickZ;
    viewmodelAnimRef.current.recoilPos.y += kickY;
    viewmodelAnimRef.current.recoilRotX += kickRotX;
    viewmodelAnimRef.current.recoilRotY += (Math.random() - 0.5) * 0.008;

    if (activeW.modelType === 'shotgun') {
      viewmodelAnimRef.current.pumpActive = true;
      viewmodelAnimRef.current.pumpProgress = 0.0;
    } else if (activeW.modelType === 'handgun' || activeW.modelType === 'revolver') {
      viewmodelAnimRef.current.slideBlowback = 0.06;
    }

    // Spawn Projectiles with dynamic accuracy
    if (sceneRef.current && cameraRef.current) {
      const origin = cameraRef.current.position.clone();
      const forwardDir = new THREE.Vector3();
      cameraRef.current.getWorldDirection(forwardDir);

      // New arsenal weapons: their projectiles / deployables live in utils/arsenal.ts
      if (ARSENAL_GUNS.has(activeW.id) && arsenalRef.current && arsenalCtxRef.current) {
        const ars = arsenalRef.current;
        const actx = arsenalCtxRef.current;
        const right = new THREE.Vector3().crossVectors(forwardDir, _up).normalize();
        const muzzle = origin.clone().addScaledVector(forwardDir, 0.75).addScaledVector(right, isAds ? 0.0 : 0.16).add(new THREE.Vector3(0, -0.13, 0));
        // aim from the muzzle at the point under the crosshair (hip fire adds a little spread)
        const spread = isAds ? 0.004 : activeW.id === 'heavy_inferno' ? 0.0 : activeW.id === 'main_needler' ? 0.05 : 0.025;
        const target = origin.clone().addScaledVector(forwardDir, 40);
        const aim = target.sub(muzzle).normalize();
        aim.x += (Math.random() - 0.5) * spread;
        aim.y += (Math.random() - 0.5) * spread;
        aim.z += (Math.random() - 0.5) * spread;
        aim.normalize();
        const crit = Math.random() * 100 < activeW.stats.critRate ? 1.75 : 1;
        const dmg = activeW.stats.damage * getWeaponDamageMultiplier(activeW.id) * passivesRef.current.rangedDamageMultiplier * crit;
        switch (activeW.id) {
          case 'sub_chrono':
            ars.fireChrono(actx, muzzle, aim, dmg);
            break;
          case 'sub_flare':
            ars.fireFlare(actx, muzzle, aim, dmg);
            break;
          case 'main_needler':
            ars.fireNeedle(actx, muzzle, aim, dmg);
            break;
          case 'main_sonic':
            ars.fireSonic(actx, muzzle, aim, dmg, activeW.stats.range);
            break;
          case 'main_buzzsaw':
            ars.fireSaw(actx, muzzle, aim, dmg);
            break;
          case 'heavy_meteor':
            ars.fireMeteorBeacon(actx, muzzle, aim, dmg);
            break;
          case 'heavy_inferno':
            ars.sprayInferno(actx, muzzle.clone().addScaledVector(forwardDir, 0.25), forwardDir.clone(), dmg);
            break;
        }
        if (crit > 1 && activeW.id !== 'heavy_inferno') spawnDamageText('CRITICAL SHOT', '#facc15');
        return;
      }

      const isSlug = activeW.id === 'main_slug_breacher';
      const count =
        isSlug
          ? 1
          : activeW.modelType === 'shotgun'
          ? 7
          : activeW.id === 'main_void_sniper' && hasSkill('void_mod_multilock')
          ? 2
          : 1;
      const bColor = new THREE.Color(activeW.color);

      // Critical hit roll (once per trigger pull so a shotgun blast crits as a whole)
      let shotCrit = Math.random() * 100 < activeW.stats.critRate;
      if (activeW.id === 'sub_twin_revolver') {
        twinCountRef.current += 1;
        if (twinCountRef.current % 8 === 0) {
          shotCrit = true;
          setAnnouncement('PULSE OVERLOAD // GUARANTEED CRITICAL!');
        }
      }
      const twinSide = (activeW.id === 'sub_twin_revolver' || activeW.id === 'sub_akimbo') ? (twinSideRef.current *= -1) : 0;
      if (activeW.id === 'sub_akimbo') {
        // TWIN VIPER: only the hand that fired kicks back; the muzzle light follows it
        if (twinSide > 0) viewmodelAnimRef.current.akimboKickR = 1;
        else viewmodelAnimRef.current.akimboKickL = 1;
        if (muzzleFlashLightRef.current) muzzleFlashLightRef.current.position.x = twinSide * AKIMBO_HAND_X;
      } else if (muzzleFlashLightRef.current) {
        muzzleFlashLightRef.current.position.x = 0.15;
      }
      const camRight = new THREE.Vector3().crossVectors(forwardDir, new THREE.Vector3(0, 1, 0)).normalize();

      // Detect movement for dynamic spread expansion
      const isPlayerMoving = playerVelocity.current.lengthSq() > 1.2;
      const isAirborne = playerPos.current.y > 1.76 || isAirborneDashJumpRef.current;

      for (let i = 0; i < count; i++) {
        const spreadDir = forwardDir.clone();

        if (activeW.id === 'main_bubblas') {
          // BUBBLAS: bubbles are blown out loosely; ADS only tightens the cloud a little
          const bj = isAds ? 0.03 : 0.085;
          spreadDir.x += (Math.random() - 0.5) * bj;
          spreadDir.y += (Math.random() - 0.5) * bj;
          spreadDir.z += (Math.random() - 0.5) * bj;
          spreadDir.normalize();
        } else if (activeW.id === 'main_spreader') {
          // SPREAD-ER: spread depends only on how long the trigger has been held (ADS / movement do not help)
          const sj = 0.008 + spreaderHeatRef.current * 0.2;
          spreadDir.x += (Math.random() - 0.5) * sj;
          spreadDir.y += (Math.random() - 0.5) * sj;
          spreadDir.z += (Math.random() - 0.5) * sj;
          spreadDir.normalize();
        } else if (activeW.modelType === 'shotgun') {
          // Shotgun: ADS provides tight concentrated choke; Hipfire spreads widely
          const spreadScale = isSlug
            ? (isAds ? 0.002 : isPlayerMoving ? 0.03 : 0.018)
            : (isAds ? 0.018 : isPlayerMoving ? 0.098 : 0.078);
          spreadDir.x += (Math.random() - 0.5) * spreadScale;
          spreadDir.y += (Math.random() - 0.5) * spreadScale;
          spreadDir.z += (Math.random() - 0.5) * spreadScale;
          spreadDir.normalize();
        } else if (count > 1 && activeW.id === 'main_void_sniper') {
          // Multi-lock void sniper projectiles fan out slightly
          const fanOffset = (i === 0 ? -1 : 1) * 0.08;
          spreadDir.x += fanOffset;
          spreadDir.normalize();
        } else if (!isAds) {
          // ================= HIP-FIRE (腰撃ち) INACCURACY =================
          let hipSpread = 0.046;
          if (activeW.modelType === 'railgun') {
            hipSpread = 0.088;
          } else if (activeW.modelType === 'rifle') {
            hipSpread = 0.052;
          } else if (activeW.modelType === 'launcher') {
            hipSpread = 0.058;
          } else if (activeW.modelType === 'handgun' || activeW.modelType === 'revolver') {
            hipSpread = 0.040;
          }

          if (isPlayerMoving) hipSpread *= 1.45;
          if (isAirborne) hipSpread *= 1.85;

          spreadDir.x += (Math.random() - 0.5) * hipSpread;
          spreadDir.y += (Math.random() - 0.5) * hipSpread;
          spreadDir.z += (Math.random() - 0.5) * hipSpread;
          spreadDir.normalize();
        } else {
          // ================= ADS (Aim Down Sights) PINPOINT PRECISION =================
          const adsSpread = hasOpticalScope(activeW) ? 0.0003 : 0.0012;
          spreadDir.x += (Math.random() - 0.5) * adsSpread;
          spreadDir.y += (Math.random() - 0.5) * adsSpread;
          spreadDir.z += (Math.random() - 0.5) * adsSpread;
          spreadDir.normalize();
        }

        // PHOTON GATLING: constant barrel spread while the burst is running
        if (activeW.id === 'heavy_photon_gatling') {
          const j = 0.012 + gatlingSpinRef.current * 0.03;
          spreadDir.x += (Math.random() - 0.5) * j;
          spreadDir.y += (Math.random() - 0.5) * j;
          spreadDir.z += (Math.random() - 0.5) * j;
          spreadDir.normalize();
        }

        // Special: Drone Funnel autonomous drones deployment (12s sortie; fire again for FOCUS FIRE)
        if (activeW.id === 'sub_drone_funnel') {
          if (droneFunnelsRef.current.length > 0) {
            droneFunnelsRef.current.forEach((dr, di) => {
              dr.shootCooldown = Math.min(dr.shootCooldown, 0.04 + di * 0.07);
            });
          }
          if (droneFunnelsRef.current.length === 0 && sceneRef.current) {
            const numDrones = hasSkill('funnel_mod_count') ? 3 : 2;
            const offsets = numDrones === 3 ? [-1.2, 0, 1.2] : [-1, 1];
            offsets.forEach((side, idx) => {
              const dGroup = new THREE.Group();
              const dCore = new THREE.Mesh(new THREE.OctahedronGeometry(0.18, 0), new THREE.MeshBasicMaterial({ color: 0x06b6d4 }));
              dGroup.add(dCore);
              const dRing = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.03, 6, 16), new THREE.MeshBasicMaterial({ color: 0x38bdf8 }));
              dRing.rotation.x = Math.PI / 2;
              dGroup.add(dRing);
              sceneRef.current?.add(dGroup);
              droneFunnelsRef.current.push({
                mesh: dGroup,
                angleOffset: side * 1.15,
                shootCooldown: 0.2 + idx * 0.25,
                lifetime: 12,
                damage: Math.round(activeW.stats.damage * 0.9 * passivesRef.current.rangedDamageMultiplier),
              });
            });
            setAnnouncement(`DRONE FUNNEL // ${numDrones} ATTACK DRONES DEPLOYED!`);
          }
        }

        const isRailgun = activeW.id === 'heavy_railgun';
        const isSolar = activeW.id === 'heavy_solar_cannon';
        const isBeam = isRailgun || isSolar;
        const isMagnum = activeW.id === 'sub_magnum';
        const isWave = activeW.id === 'main_plasma_wave';
        const isFrost = activeW.id === 'heavy_frost_cannon';
        const isRicochet = activeW.id === 'sub_ricochet_blade';
        const isHoming = activeW.id === 'main_void_sniper';
        const isCluster = activeW.id === 'heavy_hydra_missile';
        const isGravity = activeW.id === 'heavy_launcher';
        const isArc = activeW.id === 'sub_arc_blaster';
        const isNanite = activeW.id === 'sub_nanoswarm';
        const isBubble = activeW.id === 'main_bubblas';

        let bulletRadius =
          isBubble ? 0.3 :
          isWave ? (hasSkill('wave_mod_width') ? 3.6 : 2.4) :
          isSolar ? 0.95 :
          isRailgun ? 0.65 :
          isGravity ? 0.8 :
          isCluster ? 0.7 :
          isFrost ? 0.6 :
          isSlug ? 0.6 :
          isHoming ? 0.55 :
          isRicochet ? (hasSkill('ricochet_mod_size') ? 0.75 : 0.5) :
          activeW.modelType === 'railgun' ? 0.55 :
          activeW.modelType === 'launcher' ? 0.70 :
          activeW.modelType === 'shotgun' ? 0.42 : 0.35;

        let bulletSpeed =
          isBubble ? BUBBLAS_SPEED * (0.85 + Math.random() * 0.3) :
          isWave ? 52 :
          isSolar ? 330 :
          isRailgun ? 240 :
          isGravity ? 48 :
          isCluster ? 54 :
          isFrost ? 68 :
          isHoming ? 150 :
          isRicochet ? 85 :
          activeW.modelType === 'railgun' ? 180 :
          activeW.modelType === 'launcher' ? 55 :
          activeW.modelType === 'shotgun' ? 110 : 120;

        let bGeo: THREE.BufferGeometry;
        if (isBubble) {
          bGeo = new THREE.SphereGeometry(0.06 + Math.random() * 0.07, 12, 9);
        } else if (isWave) {
          bGeo = new THREE.CylinderGeometry(0.08, 0.08, hasSkill('wave_mod_width') ? 6.8 : 4.2, 12);
        } else if (isRicochet) {
          const rSize = hasSkill('ricochet_mod_size') ? 0.34 : 0.24;
          bGeo = new THREE.TorusGeometry(rSize, 0.06, 8, 16);
        } else if (isSolar) {
          bGeo = new THREE.CylinderGeometry(0.16, 0.16, 5.5, 10);
        } else if (isRailgun) {
          bGeo = new THREE.CylinderGeometry(0.05, 0.05, 2.8, 8);
        } else if (isGravity || isCluster || isFrost || activeW.category === 'HEAVY') {
          bGeo = new THREE.SphereGeometry(0.18, 8, 8);
        } else {
          bGeo = new THREE.SphereGeometry(0.055, 6, 6);
        }

        const bubbleHue = Math.random();
        const bMat = isBubble
          ? new THREE.MeshBasicMaterial({
              color: new THREE.Color().setHSL(bubbleHue, 0.75, 0.72),
              transparent: true,
              opacity: 0.38,
              side: THREE.DoubleSide,
              depthWrite: false,
              blending: THREE.AdditiveBlending,
            })
          : new THREE.MeshBasicMaterial({ color: bColor });
        const bShell = new THREE.Mesh(bGeo, bMat);
        let bMesh: THREE.Mesh | THREE.Group = bShell;
        if (isBubble) {
          // soap-film look: a tinted shell, a faint rim and a bright glint
          const rimGeo = new THREE.SphereGeometry((bGeo as THREE.SphereGeometry).parameters.radius * 1.04, 12, 9);
          const rim = new THREE.Mesh(rimGeo, new THREE.MeshBasicMaterial({
            color: new THREE.Color().setHSL((bubbleHue + 0.35) % 1, 0.8, 0.8),
            transparent: true,
            opacity: 0.22,
            wireframe: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
          }));
          const glint = new THREE.Mesh(new THREE.SphereGeometry((bGeo as THREE.SphereGeometry).parameters.radius * 0.22, 6, 5), new THREE.MeshBasicMaterial({ color: 0xffffff }));
          glint.position.set(-0.3, 0.35, 0.3).multiplyScalar((bGeo as THREE.SphereGeometry).parameters.radius);
          const bubbleGroup = new THREE.Group();
          bubbleGroup.add(bShell, rim, glint);
          bMesh = bubbleGroup;
        }
        bMesh.position.copy(origin).addScaledVector(forwardDir, 0.4);
        if (isBubble) bMesh.position.addScaledVector(camRight, 0.13).addScaledVector(_beamUp, -0.1).addScaledVector(forwardDir, 0.35);
        if (twinSide !== 0) bMesh.position.addScaledVector(camRight, twinSide * (activeW.id === 'sub_akimbo' ? 0.24 : 0.28)).addScaledVector(new THREE.Vector3(0, 1, 0), -0.12);
        if (isWave) {
          bMesh.rotation.z = Math.PI / 2;
        } else if (isBeam) {
          bMesh.rotation.x = Math.PI / 2;
        } else if (isRicochet) {
          bMesh.rotation.x = Math.PI / 2;
        }
        sceneRef.current.add(bMesh);

        const voidDmgMult = (isHoming && hasSkill('void_mod_damage')) ? 1.35 : 1.0;
        const critMult = shotCrit ? 1.75 : 1.0;
        const finalDmg = Math.round(((activeW.stats.damage * voidDmgMult * getWeaponDamageMultiplier(activeW.id)) / count) * passivesRef.current.rangedDamageMultiplier * critMult);

        const pierceCount = isRailgun ? (hasSkill('rail_mod_pierce') ? 10 : 5) : isSolar ? 99 : (isMagnum || isSlug) ? 1 : 0;
        const falloffMode: 'none' | 'short' | 'mid' =
          activeW.id === 'sub_smg' || activeW.id === 'main_reaper' ? 'short' :
          activeW.id === 'main_spreader' ? 'mid' :
          activeW.modelType === 'handgun' || activeW.modelType === 'revolver' || activeW.id === 'main_spectre' || activeW.id === 'heavy_photon_gatling' || activeW.id === 'heavy_frost_cannon' ? 'mid' :
          'none';
        const rangeLife = (activeW.stats.range / bulletSpeed) * (isHoming ? 1.6 : 1.15);

        bulletsRef.current.push({
          mesh: bMesh,
          direction: spreadDir,
          speed: bulletSpeed,
          damage: finalDmg,
          lifetime: isBubble ? BUBBLAS_LIFE_MIN + Math.random() * BUBBLAS_LIFE_VAR : isRicochet ? 3.5 : Math.max(0.35, rangeLife),
          isPlayer: true,
          prevPosition: origin.clone(),
          bulletRadius,
          weaponId: activeW.id,
          isPiercing: pierceCount > 0 || isBubble,
          pierceRemaining: isBubble ? 99999 : pierceCount,
          pierceDecay: isRailgun ? 0.15 : isSolar ? 0.08 : isMagnum ? 0.2 : isSlug ? 0.3 : isWave ? 0.12 : 0,
          minDamage: isWave ? Math.round(finalDmg * 0.5) : Math.round(finalDmg * 0.3),
          originPos: origin.clone(),
          weaponRange: activeW.stats.range,
          falloffMode: isSlug ? 'mid' : falloffMode,
          knockback: isSlug ? 16 : isBubble ? 0.25 : activeW.id === 'main_reaper' ? 1.4 : activeW.id === 'heavy_photon_gatling' ? 0.8 : undefined,
          burnDps: isSolar ? 70 : activeW.id === 'main_reaper' ? 7 : 0,
          burnDuration: isSolar ? 3.0 : 2.0,
          isCrit: shotCrit,
          isBubble,
          bubbleAge: 0,
          bubbleSpeed0: bulletSpeed,
          bubblePhase: Math.random() * Math.PI * 2,
          hasRailBurst: isRailgun && hasSkill('rail_mod_burst'),
          isHoming,
          isRicochet,
          ricochetBouncesRemaining: isRicochet ? (hasSkill('ricochet_mod_bounces') ? 6 : 3) : 0,
          isWave,
          waveWidth: isWave ? (hasSkill('wave_mod_width') ? 7.5 : 4.8) : 0,
          isFrost,
          isNanite,
          isCluster,
          isGravity,
          isArc,
        });
      }
    }
  }, [getActiveWeapon, executeSweepAttack, spawnDamageText, syncHudState]);

  // Dash Action (Shift key tap) - STAMINA SYSTEM ABOLISHED (UNRESTRICTED AGILITY)
  const executeDash = useCallback(() => {
    if (dashCooldownRef.current > 0 || isPausedRef.current || koRef.current) return;
    sound.playDash();
    dashCooldownRef.current = Math.max(0.5, 1.0 * passivesRef.current.dashCooldownMultiplier);

    _forward.set(0, 0, -1).applyAxisAngle(_up, currentRotation.current.yaw);
    playerVelocity.current.add(_forward.multiplyScalar(24));
    setAnnouncement('RAPID DASH // 推進突進');
    syncHudState();
  }, [syncHudState]);

  // Jump Action (Space key) - WITH DASH-JUMP MOMENTUM INHERITANCE (FREE & UNLIMITED)
  const executeJump = useCallback(() => {
    if (isPausedRef.current || koRef.current) return;
    // Check if player is on the ground
    if (playerPos.current.y <= 1.72) {
      const k = keysPressed.current;
      const isSprinting = !!k['shift'];
      const hSpeed = Math.hypot(playerVelocity.current.x, playerVelocity.current.z);
      const isMovingForward = !!k['w'] || hSpeed > 5.0;
      const isDashJump = (isSprinting || dashCooldownRef.current > 0.4) && isMovingForward;

      if (isDashJump) {
        // ================= DASH JUMP (ダッシュジャンプ) =================
        // Inherits current momentum + injects explosive forward velocity boost + floatier arc
        sound.playJump();
        sound.playDash();

        // Higher, buoyant vertical leap
        playerVelocity.current.y = 10.4;

        _forward.set(0, 0, -1).applyAxisAngle(_up, currentRotation.current.yaw);
        _right.set(1, 0, 0).applyAxisAngle(_up, currentRotation.current.yaw);

        _moveDir.set(0, 0, 0);
        if (k['w']) _moveDir.add(_forward);
        if (k['s']) _moveDir.sub(_forward);
        if (k['d']) _moveDir.add(_right);
        if (k['a']) _moveDir.sub(_right);

        if (_moveDir.lengthSq() > 0) {
          _moveDir.normalize();
          playerVelocity.current.addScaledVector(_moveDir, 16.0);
        } else {
          playerVelocity.current.addScaledVector(_forward, 16.0);
        }

        // Multiply existing horizontal speed so momentum carries through
        playerVelocity.current.x *= 1.45;
        playerVelocity.current.z *= 1.45;

        // Mark airborne dash-jump state to reduce air friction during flight
        isAirborneDashJumpRef.current = true;
        setAnnouncement('DASH JUMP // 慣性跳躍 (MOMENTUM BOOST)');
      } else {
        // ================= REGULAR JUMP =================
        sound.playJump();
        playerVelocity.current.y = 9.0;
        isAirborneDashJumpRef.current = false;
        setAnnouncement('JUMP BOOST // 跳躍');
      }

      syncHudState();
    }
  }, [syncHudState]);

  // Reload Action
  const executeReload = useCallback(() => {
    const activeW = getActiveWeapon();
    const curSlot = currentSlotRef.current;
    if (
      isReloadingRef.current ||
      activeW.category === 'MELEE' ||
      activeW.modelType === 'dynamite' ||
      ammoStockRef.current[curSlot] === activeW.stats.maxAmmo ||
      isPausedRef.current
    )
      return;

    isReloadingRef.current = true;
    chargeStartRef.current = 0;
    chargeReadyRef.current = false;
    viewmodelAnimRef.current.reloadProgress = 0.0;
    if (getReloadStyle(activeW)) {
      // sounds are played per keyframe by the viewmodel animation
      viewmodelAnimRef.current.reloadFromEmpty = (ammoStockRef.current[curSlot] ?? activeW.stats.maxAmmo) <= 0;
      viewmodelAnimRef.current.reloadSfxStep = 0;
    } else {
      sound.playReload();
    }
    const duration = Math.max(Math.min(0.6, activeW.stats.reloadTime), activeW.stats.reloadTime * (1 + passivesRef.current.reloadSpeedMultiplier));
    reloadDurationRef.current = duration;
    reloadIdRef.current += 1;
    syncHudState();

    setTimeout(() => {
      ammoStockRef.current[curSlot] = activeW.stats.maxAmmo;
      isReloadingRef.current = false;
      setAnnouncement('RELOAD COMPLETED');
      syncHudState();
    }, duration * 1000);
  }, [getActiveWeapon, syncHudState]);

  // MAIN THREE.JS MOUNT & GAMELOOP
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    const arenaSize = 80;

    // 1. SCENE
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // 2. CAMERA
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 180);
    camera.position.copy(playerPos.current);
    cameraRef.current = camera;

    // 3. RENDERER
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
    renderer.shadowMap.enabled = false;
    rendererRef.current = renderer;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 4. LIGHTING
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.3);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.4);
    dirLight.position.set(20, 35, 20);
    scene.add(dirLight);

    // Stage-specific light mood (moonlit rain, lava glow, stained-glass gold, ...)
    const lightCfg = SCENERY_CONFIG[getStageTheme(mission.id).scenery];
    ambientLight.color.set(lightCfg.ambient[0]);
    ambientLight.intensity = lightCfg.ambient[1];
    dirLight.color.set(lightCfg.sun.color);
    dirLight.intensity = lightCfg.sun.intensity;
    dirLight.position.set(...lightCfg.sun.pos);

    // fixed pool of effect lights (see acquireFxLight)
    fxLightPoolRef.current = [];
    for (let i = 0; i < 4; i++) {
      const l = new THREE.PointLight(0xffffff, 0, 10);
      l.userData.pooled = true;
      scene.add(l);
      fxLightPoolRef.current.push(l);
    }
    setFxLightProvider(acquireFxLight);

    const muzzleLight = new THREE.PointLight(0x38bdf8, 0, 8);
    muzzleLight.position.set(0.15, -0.1, -0.5);
    muzzleFlashLightRef.current = muzzleLight;
    camera.add(muzzleLight);

    // 5. STAGE ENVIRONMENT (STAGE NAME THEMATIC GOTHIC-CYBERPUNK ARENA & TACTICAL COVERS)
    const covers = buildStageEnvironment(mission, scene);
    coverObjectsRef.current = covers;
    const stageScenery = scene.userData.stageScenery as StageScenery | undefined;
    stageScenery?.bakeEnvironment(renderer);

    // 6. VIEWMODEL RIG
    const viewmodelGroup = new THREE.Group();
    viewmodelGroupRef.current = viewmodelGroup;
    camera.add(viewmodelGroup);
    scene.add(camera);

    const weaponMeshHolder = new THREE.Group();
    weaponMeshHolderRef.current = weaponMeshHolder;
    viewmodelGroup.add(weaponMeshHolder);

    buildViewmodelForWeapon(getActiveWeapon());

    // ARCHON 9 reload: the spent magazine is detached into camera space and falls out of view
    const droppedMags: { obj: THREE.Object3D; vel: THREE.Vector3; spin: THREE.Vector3; age: number }[] = [];
    const _gravityLocal = new THREE.Vector3();
    const _camInvQuat = new THREE.Quaternion();
    const dropPistolMag = (partName = 'pistolMag', opts?: { vel?: THREE.Vector3; spin?: THREE.Vector3 }) => {
      const mag = weaponMeshHolderRef.current?.getObjectByName(partName);
      if (!mag) return;
      const copy = mag.clone();
      copy.visible = true;
      copy.traverse((node: any) => {
        if (node.geometry) node.geometry = node.geometry.clone();
      });
      mag.updateWorldMatrix(true, false);
      mag.matrixWorld.decompose(copy.position, copy.quaternion, copy.scale);
      camera.attach(copy);
      // keep falling along the grip axis (grip "down" in camera space), plus a little scatter
      const gripDown = new THREE.Vector3(0, -1, 0).applyQuaternion(copy.quaternion);
      droppedMags.push({
        obj: copy,
        vel: opts?.vel ?? gripDown.multiplyScalar(0.9).add(new THREE.Vector3(-0.15, 0, 0.05)),
        spin: opts?.spin ?? new THREE.Vector3((Math.random() - 0.5) * 4, (Math.random() - 0.5) * 3, -2 - Math.random() * 2),
        age: 0,
      });
      mag.visible = false;
    };
    // Revolver: the spent brass is dumped out of the swung-out cylinder (small cases tumbling down)
    const casingGeo = new THREE.CylinderGeometry(0.0085, 0.0085, 0.05, 8);
    casingGeo.rotateX(Math.PI / 2);
    const casingMat = new THREE.MeshStandardMaterial({ color: 0xc9a24a, metalness: 0.9, roughness: 0.25, emissive: 0x3a2a08 });
    const ejectCasings = (count: number) => {
      const drum = weaponMeshHolderRef.current?.getObjectByName('revolverDrum');
      if (!drum) return;
      drum.updateWorldMatrix(true, false);
      const origin = new THREE.Vector3();
      drum.getWorldPosition(origin);
      camera.worldToLocal(origin);
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2;
        const c = new THREE.Mesh(casingGeo.clone(), casingMat);
        c.position.copy(origin).add(new THREE.Vector3(Math.cos(a) * 0.035, Math.sin(a) * 0.035, 0.04));
        camera.add(c);
        droppedMags.push({
          obj: c,
          vel: new THREE.Vector3(-0.2 + (Math.random() - 0.5) * 0.5, -0.4 - Math.random() * 0.5, 0.3 + Math.random() * 0.4),
          spin: new THREE.Vector3((Math.random() - 0.5) * 18, (Math.random() - 0.5) * 18, (Math.random() - 0.5) * 18),
          age: -Math.random() * 0.05,
        });
      }
    };
    // Heavy cell: a short burst of vapour where the receiver vents
    const ventSteam = () => {
      const cell = weaponMeshHolderRef.current?.getObjectByName('heavyCell');
      if (!cell) return;
      const p = new THREE.Vector3();
      cell.getWorldPosition(p);
      spawn3DHitSparks(p, '#e2e8f0', 10);
    };
    const updateDroppedMags = (delta: number) => {
      _camInvQuat.copy(camera.quaternion).invert();
      _gravityLocal.set(0, -7, 0).applyQuaternion(_camInvQuat);
      for (let i = droppedMags.length - 1; i >= 0; i--) {
        const d = droppedMags[i];
        d.age += delta;
        d.vel.addScaledVector(_gravityLocal, delta);
        d.obj.position.addScaledVector(d.vel, delta);
        d.obj.rotation.x += d.spin.x * delta;
        d.obj.rotation.y += d.spin.y * delta;
        d.obj.rotation.z += d.spin.z * delta;
        if (d.age > 0.8) {
          camera.remove(d.obj);
          d.obj.traverse((node: any) => node.geometry?.dispose?.());
          droppedMags.splice(i, 1);
        }
      }
    };


    // 7. SETUP WAVE SYSTEM & INITIALIZE WAVE 1
    const missionWaves = buildMissionWaves(mission);
    wavesListRef.current = missionWaves;
    setTotalWaves(missionWaves.length);
    currentWaveIndexRef.current = 0;
    isIntermissionRef.current = false;
    intermissionTimerRef.current = 0;
    prevLivingCountRef.current = -1;

    // ── CO-OP: ホストが敵を動かし、ゲストは人形を表示する ──
    const netSession = netRef.current;
    const isGuest = !!netSession && !netSession.isHost && netSession.players.length > 1;
    let coop: CoopBattle | null = null;
    /** ホスト: いま処理中の敵が狙っているリモートプレイヤー (null = ホスト自身) */
    let activeRemoteId: string | null = null;
    let reviveLocal: (fraction: number) => void = () => {};

    // The wave cut-in plays first; the enemies appear once it has finished (see gameLoop).
    let pendingWaveSpawn: { idx: number; left: number } | null = null;

    const spawnCurrentWave = (waveIdx: number) => {
      const wave = missionWaves[waveIdx];
      if (!wave) return;
      setCurrentWave(waveIdx + 1);
      const cutinBoss = wave.enemies.find((e) => baseCategoryOf(e.enemyTypeId) === 'boss' || e.name.includes('[BOSS]'));
      const cutinMs = wave.isBossWave ? 3600 : 2300;
      setWaveCutin({ wave: waveIdx + 1, total: missionWaves.length, final: wave.isFinalWave, boss: wave.isBossWave, bossName: cutinBoss?.name });
      window.setTimeout(() => setWaveCutin(null), cutinMs);
      pendingWaveSpawn = { idx: waveIdx, left: cutinMs / 1000 };
      coop?.sendWave({ wave: waveIdx + 1, total: missionWaves.length, final: wave.isFinalWave, boss: wave.isBossWave, bossName: cutinBoss?.name });
      reviveLocal(0.5);
    };

    const performWaveSpawn = (waveIdx: number) => {
      const wave = missionWaves[waveIdx];
      if (!wave) return;

      // Clean up previous dead enemies from scene
      for (let i = enemiesRef.current.length - 1; i >= 0; i--) {
        if (enemiesRef.current[i].isDead) {
          scene.remove(enemiesRef.current[i].mesh);
          if (enemiesRef.current[i].groundRingMesh) {
            scene.remove(enemiesRef.current[i].groundRingMesh!);
            enemiesRef.current[i].groundRingMesh!.geometry.dispose();
          }
          enemiesRef.current.splice(i, 1);
        }
      }

      const diffMult = getMissionDifficultyMultiplier(mission, hard);
      wave.enemies.forEach((enDef) => {
        // Balanced enemy squads for crisp, tactical, high-performance combat
        const spawnCount = Math.max(1, enDef.count);
        for (let i = 0; i < spawnCount; i++) {
          const enemyInst = createEnemyInstance(enDef, scene, coverObjectsRef.current, diffMult);
          if (coop) {
            // 人数が増えるほど敵は硬くなる
            const mult = 1 + 0.6 * (coop.playerCount - 1);
            enemyInst.hp = enemyInst.maxHp = Math.round(enemyInst.maxHp * mult);
          }
          enemiesRef.current.push(enemyInst);
        }
      });

      const living = enemiesRef.current.filter((e) => !e.isDead).length;
      setLivingEnemiesCount(living);

      sound.playDash();
      if (living >= 30) {
        sound.playHeavyLaunch();
        setAnnouncement(`HORDE BREACH // 敵大群接近！ ${living} UNITS`);
      }
      if (wave.isBossWave) {
        sound.playHeavyLaunch();
        const boss = wave.enemies.find((e) => baseCategoryOf(e.enemyTypeId) === 'boss' || e.name.includes('[BOSS]'));
        setAnnouncement(`FINAL WAVE // ${boss ? boss.name : 'BOSS UNIT'} 起動！`);
      } else if (wave.isFinalWave) {
        sound.playSweepAttack();
        setAnnouncement(`FINAL WAVE // 敵精鋭部隊出現！ (${living}体)`);
      } else {
        setAnnouncement(`WAVE ${waveIdx + 1} / ${missionWaves.length} // 敵部隊接近！ (${living}体)`);
      }
    };

    enemiesRef.current = [];
    // Stage-start cut-in plays first; wave 1 spawns when it ends (see gameLoop).
    introRef.current = { frames: 0, startedAt: 0, done: false };
    setIntroPhase('pending');

    // 8. OPTIMIZED MOUSE AIMING & POINTER LOCK
    const handleMouseMove = (e: MouseEvent) => {
      if (isPausedRef.current) return;

      // 戦闘中はポインターロックを必須化: マウスカーソルが画面外へ移動して外部をクリックしてしまうのを完全に防止
      if (!document.pointerLockElement) return;

      const dx = e.movementX ?? 0;
      const dy = e.movementY ?? 0;

      // Ignore abnormal jump spikes on initial pointer lock acquisition
      if (Math.abs(dx) > 3000 || Math.abs(dy) > 3000) return;

      // Perfectly tuned FPS mouse sensitivity: crisp, non-sticky, responsive
      const baseSens = 0.0022;
      const sens = isAimingRef.current ? baseSens * 0.58 : baseSens;

      targetRotation.current.yaw -= dx * sens;
      targetRotation.current.pitch -= dy * sens;
      targetRotation.current.pitch = Math.max(-1.48, Math.min(1.48, targetRotation.current.pitch));

      // Smooth viewmodel mouse inertia sway
      if (!isAimingRef.current) {
        viewmodelAnimRef.current.swayX = Math.max(-0.015, Math.min(0.015, viewmodelAnimRef.current.swayX - dx * 0.0003));
        viewmodelAnimRef.current.swayY = Math.max(-0.015, Math.min(0.015, viewmodelAnimRef.current.swayY - dy * 0.0003));
      }
    };

    const handlePointerLockChange = () => {
      const locked = !!document.pointerLockElement;
      isPointerLockedRef.current = locked;
      setIsPointerLocked(locked);
    };

    const handlePointerLockError = () => {
      isPointerLockedRef.current = false;
      setIsPointerLocked(false);
    };

    const handleCanvasClick = (e: MouseEvent) => {
      if (isPausedRef.current) {
        resumeCombat();
      } else {
        prevMousePos.current = { x: e.clientX, y: e.clientY };
        requestLock();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (!isPausedRef.current) pauseCombat();
        else resumeCombat();
        return;
      }

      if (isPausedRef.current) return;
      const k = e.key.toLowerCase();
      keysPressed.current[k] = true;

      if (e.key === '1') switchWeapon(1);
      if (e.key === '2') switchWeapon(2);
      if (e.key === '3') switchWeapon(3);
      if (e.key === '4') switchWeapon(4);
      if (e.key === 'r' || e.key === 'R') executeReload();

      // Space key for Jumping / Dash-Jumping
      if (e.code === 'Space' || e.key === ' ') {
        executeJump();
      }

      // Shift key for Dash / Sprint
      if (e.key === 'Shift') {
        executeDash();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      keysPressed.current[k] = false;
    };

    const handleWheel = (e: WheelEvent) => {
      if (isPausedRef.current) return;
      const occupied = ([1, 2, 3, 4] as WeaponSlot[]).filter((s) => Boolean(activeLoadout[s]));
      if (occupied.length <= 1) return;
      const currentIdx = occupied.indexOf(currentSlotRef.current);
      if (currentIdx === -1) {
        switchWeapon(occupied[0]);
        return;
      }
      if (e.deltaY > 0) {
        const nextIdx = (currentIdx + 1) % occupied.length;
        switchWeapon(occupied[nextIdx]);
      } else {
        const prevIdx = (currentIdx - 1 + occupied.length) % occupied.length;
        switchWeapon(occupied[prevIdx]);
      }
    };

    const GRENADE_AIM_STEPS = 120;
    const GRENADE_AIM_DT = 1 / 30;
    let grenadeAimLine: THREE.Line | null = null;
    let grenadeAimRing: THREE.Mesh | null = null;

    const handleMouseDown = (e: MouseEvent) => {
      if (isPausedRef.current) {
        resumeCombat();
        return;
      }
      // マウスが固定されていない場合は即座にポインターロックを要求
      if (!isPointerLockedRef.current) {
        requestLock();
      }
      prevMousePos.current = { x: e.clientX, y: e.clientY };
      if (koRef.current) return; // ダウン中は攻撃・防御できない

      if (e.button === 0) {
        isMouseDownRef.current = true;
        const downW = getActiveWeapon();
        const stock = ammoStockRef.current[currentSlotRef.current] ?? downW.stats.maxAmmo;
        if (downW.modelType === 'dynamite' && stock > 0) {
          // 投擲物: 押している間は予測線を表示し、離したときに投げる
          grenadeAimRef.current = true;
        } else {
          executePrimaryAttack();
        }
        lastFireTimeRef.current = clock.getElapsedTime();
      } else if (e.button === 2) {
        // Right click: Melee Guard OR Firearms ADS
        const curW = getActiveWeapon();
        if (curW.category === 'MELEE') {
          // 右クリックを押し続けて溜める（0.75秒 + 左クリック同時押しで固有技）
          if (!isPausedRef.current) {
            const t0 = performance.now() / 1000;
            if (t0 < skillCooldownUntilRef.current) {
              // クールダウン中は溜められない（左クリックの通常攻撃は使える）
              setAnnouncement(`溜め技 クールダウン ${(skillCooldownUntilRef.current - t0).toFixed(1)}s`);
            } else {
              meleeChargeStartRef.current = t0;
              meleeChargeReadyRef.current = false;
            }
          }
        } else if (curW.modelType !== 'dynamite') {
          isAimingRef.current = true;
          setIsAiming(true);
          sound.playAimZoom();
        }
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 0) {
        isMouseDownRef.current = false;
        if (grenadeAimRef.current) {
          grenadeAimRef.current = false;
          if (!isPausedRef.current && getActiveWeapon().modelType === 'dynamite') executePrimaryAttack();
        }
        if (chargeStartRef.current !== 0) {
          const curW = getActiveWeapon();
          const held = performance.now() / 1000 - chargeStartRef.current;
          chargeStartRef.current = 0;
          chargeReadyRef.current = false;
          if ((curW.id === 'heavy_railgun' || curW.id === 'heavy_solar_cannon') && held >= getChargeDuration(curW)) {
            railChargedRef.current = true;
            executePrimaryAttack();
            railChargedRef.current = false;
          } else {
            setAnnouncement('CHARGE ABORTED // HOLD LONGER');
          }
        }
      } else if (e.button === 2) {
        const curW = getActiveWeapon();
        meleeChargeStartRef.current = 0;
        meleeChargeReadyRef.current = false;
        if (curW.category === 'MELEE') {
          isGuardingRef.current = false;
          syncHudState();
        } else {
          isAimingRef.current = false;
          setIsAiming(false);
        }
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    window.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('pointerlockchange', handlePointerLockChange);
    document.addEventListener('pointerlockerror', handlePointerLockError);
    renderer.domElement.addEventListener('click', handleCanvasClick);
    renderer.domElement.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    renderer.domElement.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('wheel', handleWheel);

    // 9. ANIMATION LOOP
    let animationId: number;
    let clock = new THREE.Clock();
    let battleFinished = false;
    let walkCycle = 0;
    let hudUpdateCounter = 0;

    const handleBattleEnd = (isVictory: boolean) => {
      if (battleFinished) return;
      battleFinished = true;
      coop?.sendEnd(isVictory);

      if (document.exitPointerLock) {
        try {
          document.exitPointerLock();
        } catch {}
      }

      let rank: 'S' | 'A' | 'B' | 'C' = 'C';
      if (isVictory) {
        const time = battleStats.current.timeSeconds;
        const dmgTaken = battleStats.current.damageTaken;
        if (time < 45 && dmgTaken < 50) rank = 'S';
        else if (time < 70 && dmgTaken < 100) rank = 'A';
        else rank = 'B';
        sound.playVictory();
      } else {
        sound.playDefeat();
      }

      battleStats.current.coresEarned = (isVictory ? mission.coreReward : 0) + beaconDroppedRef.current;
      battleStats.current.scrapEarned += isVictory ? mission.scrapReward : 25;

      const result: BattleResult = {
        missionId: mission.id,
        isVictory,
        rank,
        stats: battleStats.current,
        rewards: {
          scrap: battleStats.current.scrapEarned,
          cores: battleStats.current.coresEarned,
          weaponUnlocked: mission.unlockedWeaponRewardId
            ? weaponsRef.current.find((w) => w.id === mission.unlockedWeaponRewardId)
            : undefined,
        },
      };

      setTimeout(() => {
        onFinishBattle(result);
      }, 700);
    };

    // DEV: G キーで即クリア (VITE_DEV_MODE のときのみ)
    const handleDevClear = (e: KeyboardEvent) => {
      if (e.key !== 'g' && e.key !== 'G') return;
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      handleBattleEnd(true);
    };
    if (devMode) window.addEventListener('keydown', handleDevClear);

    // ── Telegraphed hazards / beams + the combat context shared by elite and boss AI ──
    const hazards = new CombatHazards(scene);
    hazards.onShake = (amp, dur) => {
      const now = performance.now() / 1000;
      const cur = cameraShakeRef.current;
      if (now < cur.until && cur.amp > amp) return;
      cameraShakeRef.current = { amp, until: now + dur, dur };
    };
    let minionsSpawnedThisFrame = 0;
    /** HP が 0 になった: ソロなら敗北、協力ならダウン (全員ダウンでホストが敗北を宣言) */
    const onLocalHpZero = () => {
      if (!coop) {
        handleBattleEnd(false);
        return;
      }
      if (koRef.current || battleFinished) return;
      koRef.current = true;
      setKoUi(true);
      playerHpRef.current = 0;
      isMouseDownRef.current = false;
      isAimingRef.current = false;
      sound.playDefeat();
      setAnnouncement('DOWN // 円内に味方が5秒いると蘇生 ／ 次のウェーブで復帰');
      syncHudState();
    };
    reviveLocal = (fraction: number) => {
      if (!koRef.current) return;
      koRef.current = false;
      setKoUi(false);
      playerHpRef.current = Math.max(1, Math.round(maxHpRef.current * fraction));
      playerShieldRef.current = Math.max(playerShieldRef.current, maxShieldRef.current * 0.5);
      setAnnouncement('REVIVED // 戦線復帰');
      syncHudState();
    };
    const hurtPlayer: HurtFn = (dmg, label, color, opts = {}) => {
      if (battleFinished || koRef.current) return;
      // 溜め技の発動中(操作不能時間)は被ダメージ 75% カット
      const base = Math.round(dmg * (isSweepingRef.current ? 0.25 : 1));
      if (opts.guard && isGuardingRef.current) {
        applyGuardBlockRef.current(base, opts.guard);
      } else {
        sound.playHurt();
        setDamageVignette(true);
        setTimeout(() => setDamageVignette(false), 180);
        let incoming = base;
        if (playerShieldRef.current > 0) {
          const absorb = Math.min(playerShieldRef.current, incoming);
          playerShieldRef.current -= absorb;
          incoming -= absorb;
        }
        playerHpRef.current = Math.max(0, playerHpRef.current - incoming);
        battleStats.current.damageTaken += base;
        spawnDamageText(label ? `${label}! -${base}` : `-${base}`, color);
        if (opts.knockUp) playerVelocity.current.y = Math.max(playerVelocity.current.y, opts.knockUp);
        if (opts.knockBack) {
          const from = opts.from ?? { x: playerPos.current.x, z: playerPos.current.z + 1 };
          let kx = playerPos.current.x - from.x;
          let kz = playerPos.current.z - from.z;
          const kl = Math.hypot(kx, kz);
          if (kl < 0.01) {
            kx = -Math.sin(currentRotation.current.yaw);
            kz = -Math.cos(currentRotation.current.yaw);
          } else {
            kx /= kl;
            kz /= kl;
          }
          playerVelocity.current.x += kx * opts.knockBack;
          playerVelocity.current.z += kz * opts.knockBack;
        }
      }
      if (playerHpRef.current <= 0) onLocalHpZero();
    };
    const fireEnemyBullet = (spec: EnemyBulletSpec) => {
      coop?.sendBullet(spec);
      let mesh: THREE.Mesh | THREE.Group;
      if (spec.mesh) {
        mesh = spec.mesh as THREE.Group;
      } else {
        mesh = new THREE.Mesh(new THREE.SphereGeometry(spec.size, 10, 8), new THREE.MeshBasicMaterial({ color: spec.color }));
      }
      mesh.position.copy(spec.from);
      scene.add(mesh);
      bulletsRef.current.push({
        mesh,
        direction: spec.dir.clone().normalize(),
        speed: spec.speed,
        damage: spec.damage,
        lifetime: spec.life,
        isPlayer: false,
        prevPosition: mesh.position.clone(),
        bulletRadius: spec.radius,
        boomerang: spec.boomerang
          ? { owner: spec.boomerang.owner as EnemyInstance, t: 0, out: spec.boomerang.out, curve: spec.boomerang.curve, onDone: spec.boomerang.onDone }
          : undefined,
      });
    };
    const spawnMinion = (type: string, at: THREE.Vector3, owner?: unknown) => {
      if (battleFinished) return null;
      const living = enemiesRef.current.reduce((n, e) => n + (e.isDead ? 0 : 1), 0);
      if (living >= 45) return null;
      const inst = createEnemyInstance(
        { enemyTypeId: type, name: type === 'mite' ? 'Hive Mite' : type === 'splitling' ? 'Splitling' : type === 'pylon' ? 'Tesla Pylon' : type === 'mirage_echo' ? 'Mirage Echo' : type.toUpperCase(), count: 1, description: '' },
        scene,
        coverObjectsRef.current,
        getMissionDifficultyMultiplier(mission, hard),
        at,
      );
      if (owner) inst.ai = { owner };
      if (type === 'mite' || type === 'splitling' || type === 'pylon') {
        inst.scrapValue = Math.min(inst.scrapValue, 6);
        inst.scoreValue = Math.round(inst.scoreValue * 0.3);
      }
      if (type === 'mirage_echo') {
        inst.scrapValue = 0;
        inst.scoreValue = 0;
      }
      inst.attackCooldown = 0.8;
      enemiesRef.current.push(inst);
      minionsSpawnedThisFrame++;
      return inst;
    };
    const combatCtx: CombatCtx = {
      scene,
      time: 0,
      delta: 0,
      player: playerPos.current,
      playerYaw: 0,
      enemies: enemiesRef.current,
      hazards,
      hurt: hurtPlayer,
      fireBullet: fireEnemyBullet,
      spawnMinion: (type, at, owner) => spawnMinion(type, at, owner),
      sparks: (pos, color, count) => spawn3DHitSparks(pos, color, count ?? 12),
      text: (text, color) => spawnDamageText(text, color),
      announce: (text) => setAnnouncement(text),
      shake: (amp, dur) => hazards.onShake?.(amp, dur),
      pushPlayer: (ax, az) => {
        playerVelocity.current.x += ax;
        playerVelocity.current.z += az;
      },
      slowPlayer: (mult, dur) => {
        const now = performance.now() / 1000;
        const sl = playerSlowRef.current;
        sl.mult = now < sl.until ? Math.min(sl.mult, mult) : mult;
        sl.until = Math.max(sl.until, now + dur);
      },
      isBlocked: (x, z, pad) => {
        if (Math.abs(x) > arenaSize / 2 - 3 || Math.abs(z) > arenaSize / 2 - 3) return true;
        return coverObjectsRef.current.some((c) => x >= c.box.minX - pad && x <= c.box.maxX + pad && z >= c.box.minZ - pad && z <= c.box.maxZ + pad);
      },
      sfx: {
        shot: () => sound.playEnemyHit(),
        heavy: () => sound.playHeavyLaunch(),
        boom: () => sound.playEnemyExplode(),
        dash: () => sound.playDash(),
        sweep: () => sound.playSweepAttack(),
        scan: () => sound.playScan(),
      },
    };

    const arsenal = new Arsenal(scene);
    arsenalRef.current = arsenal;
    const arsenalCtx: ArsenalCtx = {
      scene,
      camera,
      time: 0,
      delta: 0,
      player: playerPos.current,
      enemies: enemiesRef.current,
      covers: coverObjectsRef.current,
      arenaHalf: arenaSize / 2 - 1,
      hasSkill: (id) => hasSkill(id),
      damage: (e, dmg, label, color, silent) => {
        const en = e as EnemyInstance;
        if (en.isDead || dmg <= 0) return;
        en.hp -= dmg;
        battleStats.current.damageDealt += dmg;
        if (!silent) {
          spawnDamageText(label ? `${label}! -${dmg}` : `-${dmg}`, color ?? '#0284c7');
          setHitMarkerActive(true);
          setTimeout(() => setHitMarkerActive(false), 80);
        }
      },
      hitbox: (e, out) => getEnemyHitbox(e as EnemyInstance, out).radius,
      sparks: (pos, color, count) => spawn3DHitSparks(pos, color, count ?? 10),
      text: (t, c) => spawnDamageText(t, c),
      announce: (t) => setAnnouncement(t),
      shake: (amp, dur) => {
        const now = performance.now() / 1000;
        const cur = cameraShakeRef.current;
        if (now >= cur.until || cur.amp < amp) cameraShakeRef.current = { amp, until: now + dur, dur };
      },
      sfx: {
        hit: () => sound.playEnemyHit(),
        boom: () => sound.playEnemyExplode(),
        heavy: () => sound.playHeavyLaunch(),
        scan: () => sound.playScan(),
        sweep: () => sound.playSweepAttack(),
        dash: () => sound.playDash(),
        zap: () => sound.playZap(),
      },
    };
    arsenalCtxRef.current = arsenalCtx;

    // VITALIS: 構えている間だけ出る回復ドローン (自分の分。味方のドローンは CoopBattle が描く)
    let healDrone: HealDrone | null = null;
    let healDroneInfo: { x: number; y: number; z: number; target: string[] } | null = null;
    let healTargetIds: string[] = [];
    let healSendAcc = 0;
    const healSendAmt = new Map<string, number>();
    const healTargetPos = [new THREE.Vector3(), new THREE.Vector3()];
    // 強化ノード (VITALIS 専用): 回復割合化 / 回復範囲拡大
    const vitalisPercent = skillNodes.some((n) => n.id === 'vitalis_mod_percent' && n.unlocked);
    const vitalisWide = skillNodes.some((n) => n.id === 'vitalis_mod_reach' && n.unlocked);
    let lastHealFxAt = 0;
    const healAnchor = new THREE.Vector3();
    const remoteHurt = (id: string): HurtFn => (dmg, label, color, opts = {}) => {
      coop?.sendHit(id, dmg, label, color, opts as Record<string, unknown>);
    };
    if (netSession && netSession.players.length > 1) {
      coop = new CoopBattle(netSession, {
        scene,
        enemies: () => enemiesRef.current as unknown as CoopEnemy[],
        local: () => ({
          pos: playerPos.current,
          yaw: currentRotation.current.yaw,
          pitch: currentRotation.current.pitch,
          hp: playerHpRef.current,
          maxHp: maxHpRef.current,
          ko: koRef.current,
          color: '#22d3ee',
          drone: healDroneInfo,
        }),
        spawnPuppet: (typeId, name, x, z) =>
          {
            const inst = createEnemyInstance({ enemyTypeId: typeId, name, count: 1, description: '' }, scene, coverObjectsRef.current, 1, new THREE.Vector3(x, 0, z));
            enemiesRef.current.push(inst);
            return inst as unknown as CoopEnemy;
          },
        removePuppet: (e) => {
          const en = e as unknown as EnemyInstance;
          en.isDead = true;
          sound.playEnemyExplode();
          spawn3DHitSparks(en.mesh.position.clone().add(new THREE.Vector3(0, 0.8, 0)), '#38bdf8', 18);
          scene.remove(en.mesh);
          if (en.groundRingMesh) {
            scene.remove(en.groundRingMesh);
            en.groundRingMesh.geometry.dispose();
          }
          disposeEnemyAux(en, scene);
          battleStats.current.kills++;
          killsRef.current++;
          scrapCollectedRef.current += en.scrapValue;
          battleStats.current.scrapEarned += en.scrapValue;
          spawnDamageText(`+${en.scrapValue} SCRAP`, '#10b981');
          const i = enemiesRef.current.indexOf(en);
          if (i >= 0) enemiesRef.current.splice(i, 1);
          syncHudState();
        },
        hurtLocal: (dmg, label, color, opts) => hurtPlayer(dmg, label, color, opts as Parameters<HurtFn>[3]),
        healLocal: (amount) => {
          if (battleFinished || koRef.current || !(amount > 0) || playerHpRef.current >= maxHpRef.current) return;
          playerHpRef.current = Math.min(maxHpRef.current, playerHpRef.current + Math.min(amount, 40));
          const nowMs = performance.now();
          if (nowMs - lastHealFxAt > 700) {
            lastHealFxAt = nowMs;
            spawnDamageText('+HEAL', '#f472b6');
            syncHudState();
          } else if (nowMs - lastShieldHudSyncRef.current > 66) {
            lastShieldHudSyncRef.current = nowMs;
            syncHudState();
          }
        },
        onWave: (w) => {
          setCurrentWave(w.wave);
          setTotalWaves(w.total);
          setWaveCutin({ wave: w.wave, total: w.total, final: w.final, boss: w.boss, bossName: w.bossName });
          window.setTimeout(() => setWaveCutin(null), w.boss ? 3600 : 2300);
          sound.playDash();
          reviveLocal(0.5);
        },
        onEnd: (victory) => handleBattleEnd(victory),
        onAnnounce: (text) => setAnnouncement(text),
        addHazardMirror: (spec) => {
          // 見た目だけ (ダメージ判定はホストが行い、被弾は `hit` で届く)
          hazards.add({ ...spec, damage: 0, drop: undefined, track: undefined, owner: undefined, onBurst: undefined });
        },
        addBulletMirror: (b) => {
          const mesh = new THREE.Mesh(new THREE.SphereGeometry(b.size, 10, 8), new THREE.MeshBasicMaterial({ color: b.color }));
          mesh.position.set(b.from[0], b.from[1], b.from[2]);
          scene.add(mesh);
          bulletsRef.current.push({
            mesh,
            direction: new THREE.Vector3(b.dir[0], b.dir[1], b.dir[2]).normalize(),
            speed: b.speed,
            damage: 0,
            lifetime: b.life,
            isPlayer: false,
            prevPosition: mesh.position.clone(),
            bulletRadius: b.radius,
            visualOnly: true,
          });
        },
        setLiving: () => {},
        revive: (fraction) => reviveLocal(fraction),
        onReviveInfo: (info) => setReviveInfo(info),
        notify: (text) => setAnnouncement(text),
      });
      if (coop.isHost) hazards.onAdd = (spec) => coop?.sendHazard(spec);
      // 全員が同じ場所に重ならないよう、開始位置を横にずらす
      const myIdx = Math.max(0, netSession.players.findIndex((pl) => pl.id === netSession.myId));
      playerPos.current.x += (myIdx - (netSession.players.length - 1) / 2) * 3;
    }

    const gameLoop = () => {
      animationId = requestAnimationFrame(gameLoop);
      const rawDelta = Math.min(0.06, clock.getDelta());
      // ヒットストップ中はゲーム時間をほぼ止める（カメラの視点操作だけは実時間で追従させる）
      const hitStopped = performance.now() / 1000 < hitStopUntilRef.current;
      const delta = hitStopped ? rawDelta * 0.06 : rawDelta;

      if (isPausedRef.current) {
        renderer.render(scene, camera);
        return;
      }

      stageScenery?.update(delta, camera);
      updateDroppedMags(delta);
      const intro = introRef.current;
      if (!intro.done) {
        // Let the first (shader-compiling) frames pass so the CSS cut-in isn't spent behind a frozen screen.
        // Timed in real time to stay in step with the CSS animation.
        if (intro.frames < 3) {
          intro.frames += 1;
          if (intro.frames === 3) {
            intro.startedAt = performance.now();
            setIntroPhase('playing');
            sound.playScan();
          }
        } else if (performance.now() - intro.startedAt >= STAGE_INTRO_SECONDS * 1000) {
          intro.done = true;
          setIntroPhase('done');
          if (!isGuest) spawnCurrentWave(0);
        }
      } else {
        battleStats.current.timeSeconds += delta;
      }

      if (pendingWaveSpawn) {
        pendingWaveSpawn.left -= delta;
        if (pendingWaveSpawn.left <= 0) {
          const idx = pendingWaveSpawn.idx;
          pendingWaveSpawn = null;
          performWaveSpawn(idx);
        }
      }

      // 1. BUTTERY SMOOTH CAMERA ROTATION VIA LERP
      // Exponential linear smoothing eliminates micro-stutters and hitching
      const smoothFactor = Math.min(1.0, 1.0 - Math.exp(-rawDelta * 55));
      currentRotation.current.yaw = THREE.MathUtils.lerp(
        currentRotation.current.yaw,
        targetRotation.current.yaw,
        smoothFactor
      );
      currentRotation.current.pitch = THREE.MathUtils.lerp(
        currentRotation.current.pitch,
        targetRotation.current.pitch,
        smoothFactor
      );

      camera.rotation.order = 'YXZ';
      camera.rotation.y = currentRotation.current.yaw;
      camera.rotation.x = currentRotation.current.pitch;
      {
        // 斬撃のカメラロール: 減衰ばね（実時間で動かし、ヒットストップ中も自然に戻る）
        const roll = camRollRef.current;
        const dt = Math.min(rawDelta, 0.033);
        roll.vel += (-roll.v * 190 - roll.vel * 17) * dt;
        roll.v += roll.vel * dt;
        if (Math.abs(roll.v) < 1e-4 && Math.abs(roll.vel) < 1e-3) roll.v = roll.vel = 0;
        camera.rotation.z = THREE.MathUtils.clamp(roll.v, -0.12, 0.12);
      }

      // 2. PLAYER MOVEMENT & SPRINT & JUMP / DASH-JUMP PHYSICS
      _forward.set(0, 0, -1).applyAxisAngle(_up, currentRotation.current.yaw);
      _right.set(1, 0, 0).applyAxisAngle(_up, currentRotation.current.yaw);

      _moveDir.set(0, 0, 0);
      const k = keysPressed.current;
      if (k['w']) _moveDir.add(_forward);
      if (k['s']) _moveDir.sub(_forward);
      if (k['d']) _moveDir.add(_right);
      if (k['a']) _moveDir.sub(_right);
      if (koRef.current) {
        // ダウン中は動けない
        _moveDir.set(0, 0, 0);
        playerVelocity.current.x = 0;
        playerVelocity.current.z = 0;
      }

      const isSprintingActive = !!k['shift'];
      const speedMultiplier = isSprintingActive ? 1.75 : 1.0;
      const slowNow = performance.now() / 1000 < playerSlowRef.current.until ? playerSlowRef.current.mult : 1;
      const baseSpeed = 12 * passivesRef.current.moveSpeedMultiplier * speedMultiplier * slowNow;

      if (_moveDir.lengthSq() > 0) {
        _moveDir.normalize();
        playerVelocity.current.add(_moveDir.multiplyScalar(baseSpeed * delta * 5));
        walkCycle += delta * (isSprintingActive ? 14 : 9);
      }

      // Horizontal Friction & Momentum Preservation
      if (playerPos.current.y > 1.72) {
        // Airborne: Dash-Jump drastically preserves horizontal momentum for long flights!
        if (isAirborneDashJumpRef.current) {
          playerVelocity.current.x *= Math.pow(0.985, delta * 60);
          playerVelocity.current.z *= Math.pow(0.985, delta * 60);
        } else {
          playerVelocity.current.x *= Math.pow(0.92, delta * 60);
          playerVelocity.current.z *= Math.pow(0.92, delta * 60);
        }
      } else {
        // Grounded friction
        playerVelocity.current.x *= Math.pow(0.84, delta * 60);
        playerVelocity.current.z *= Math.pow(0.84, delta * 60);
        isAirborneDashJumpRef.current = false;
      }

      // 溜め技の突進（摩擦を無視して一定速度で前進。壁・障害物は後段の衝突処理で止まる）
      {
        const sd = skillDashRef.current;
        if (sd.until > 0) {
          if (performance.now() / 1000 < sd.until) {
            playerVelocity.current.x = sd.x * sd.speed;
            playerVelocity.current.z = sd.z * sd.speed;
          } else {
            sd.until = 0;
          }
        }
      }

      // Vertical Gravity & Jump integration
      playerVelocity.current.y -= 26.0 * delta; // Gravity
      playerPos.current.y += playerVelocity.current.y * delta;
      if (playerPos.current.y <= 1.7) {
        playerPos.current.y = 1.7;
        playerVelocity.current.y = 0;
        isAirborneDashJumpRef.current = false;
      }

      playerPos.current.x += playerVelocity.current.x * delta;
      playerPos.current.z += playerVelocity.current.z * delta;

      // Player physical collision against stage cover objects (barricades, pillars, crates)
      const pRadius = 0.55;
      for (let c = 0; c < coverObjectsRef.current.length; c++) {
        const b = coverObjectsRef.current[c].box;
        if (playerPos.current.y <= b.height + 0.15) {
          if (
            playerPos.current.x + pRadius > b.minX &&
            playerPos.current.x - pRadius < b.maxX &&
            playerPos.current.z + pRadius > b.minZ &&
            playerPos.current.z - pRadius < b.maxZ
          ) {
            const olLeft = playerPos.current.x + pRadius - b.minX;
            const olRight = b.maxX - (playerPos.current.x - pRadius);
            const olTop = playerPos.current.z + pRadius - b.minZ;
            const olBottom = b.maxZ - (playerPos.current.z - pRadius);
            const minOl = Math.min(olLeft, olRight, olTop, olBottom);
            if (minOl === olLeft) playerPos.current.x = b.minX - pRadius;
            else if (minOl === olRight) playerPos.current.x = b.maxX + pRadius;
            else if (minOl === olTop) playerPos.current.z = b.minZ - pRadius;
            else playerPos.current.z = b.maxZ + pRadius;
          }
        }
      }

      const bound = arenaSize / 2 - 2;
      playerPos.current.x = Math.max(-bound, Math.min(bound, playerPos.current.x));
      playerPos.current.z = Math.max(-bound, Math.min(bound, playerPos.current.z));

      camera.position.copy(playerPos.current);
      {
        const sh = cameraShakeRef.current;
        const shNow = performance.now() / 1000;
        if (sh.amp > 0 && shNow < sh.until) {
          const k = (sh.until - shNow) / sh.dur;
          const a = sh.amp * k * k;
          camera.position.x += (Math.random() - 0.5) * a;
          camera.position.y += (Math.random() - 0.5) * a * 1.4;
          camera.position.z += (Math.random() - 0.5) * a;
        }
      }

      // 3. FULL-AUTO RAPID FIRE
      if (chargeStartRef.current !== 0) {
        const chW = getActiveWeapon();
        if (chW.id !== 'heavy_railgun' && chW.id !== 'heavy_solar_cannon') {
          chargeStartRef.current = 0;
          chargeReadyRef.current = false;
          setChargeGauge(null);
        } else {
          const need = getChargeDuration(chW);
          const held = performance.now() / 1000 - chargeStartRef.current;
          const p = Math.min(1, held / need);
          setChargeGauge(p, chW.color);
          viewmodelAnimRef.current.recoilRotX += 0.0015 * p;
          viewmodelAnimRef.current.recoilRotY += (Math.random() - 0.5) * 0.002 * p;
          if (p >= 1 && !chargeReadyRef.current) {
            chargeReadyRef.current = true;
            sound.playUiClick();
            setAnnouncement('FULLY CHARGED // RELEASE TO FIRE!');
          }
        }
      }
      else if (meleeChargeStartRef.current === 0) setChargeGauge(null);
      if (meleeChargeStartRef.current !== 0) {
        // INFIGHT 溜め技: 右クリック0.75秒ホールドで完了（中央の照準のゲージで確認）
        const mW = getActiveWeapon();
        if (mW.category !== 'MELEE' || isPausedRef.current) {
          meleeChargeStartRef.current = 0;
          meleeChargeReadyRef.current = false;
          setChargeGauge(null);
        } else {
          const p = Math.min(1, (performance.now() / 1000 - meleeChargeStartRef.current) / MELEE_CHARGE_TIME);
          setChargeGauge(Math.max(0.02, p), mW.color);
          if (mW.id === 'blade_axe' && !isSweepingRef.current) {
            // GRAVITON MAUL: 溜めるほど短い間隔で重力収束リングと粒子を発生させる
            const fxNow = performance.now() / 1000;
            if (fxNow >= hammerChargeFxNextRef.current) {
              spawnHammerChargeFx(p, mW.color);
              hammerChargeFxNextRef.current = fxNow + 0.24 - 0.12 * p;
            }
          } else if (!isSweepingRef.current) {
            // 他の近接武器: 武器の位置へ光の粒・光条が吸い込まれる（溜まるほど密に）
            const fxNow = performance.now() / 1000;
            if (fxNow >= meleeChargeFxNextRef.current) {
              spawnMeleeChargeFx(getMeleeStyle(mW), p, mW.color);
              meleeChargeFxNextRef.current = fxNow + 0.2 - 0.09 * p;
            }
          }
          if (p >= 1 && !meleeChargeReadyRef.current) {
            meleeChargeReadyRef.current = true;
            if (mW.id === 'blade_axe') {
              // 満タンの合図: 大きな収束リング + 小さな画面揺れ
              spawnHammerChargeFx(1, '#ffffff');
              cameraShakeRef.current = { amp: 0.05, until: performance.now() / 1000 + 0.25, dur: 0.25 };
            } else {
              // 満タンの合図: 白い収束 + 刃の鳴き + 武器の小さな跳ね
              spawnMeleeChargeFx(getMeleeStyle(mW), 1, '#ffffff');
              spawnMeleeChargeFx(getMeleeStyle(mW), 1, mW.color);
              viewmodelAnimRef.current.recoilRotX += 0.06;
              cameraShakeRef.current = { amp: 0.025, until: performance.now() / 1000 + 0.18, dur: 0.18 };
              sound.playBladeGuard();
            }
            sound.playUiClick();
            setAnnouncement('CHARGED // 左クリックで固有技を発動!');
          }
          // 左クリック押しっぱなしのまま溜め完了した場合も発動
          if (meleeChargeReadyRef.current && isMouseDownRef.current) tryChargedMeleeSkill();
        }
      }
      // MICRO HIVE: hold the trigger to paint lock-ons near the crosshair, release to fire one missile per lock
      {
        const hw = getActiveWeapon();
        const hFwd = _forward.set(0, 0, -1).applyQuaternion(camera.quaternion);
        if (hw.id === 'sub_hive' && !isReloadingRef.current) {
          const hAmmo = ammoStockRef.current[currentSlotRef.current] ?? hw.stats.maxAmmo;
          if (isMouseDownRef.current && hAmmo > 0) {
            arsenal.hiveHold(arsenalCtx, hasSkill('hive_mod_locks') ? 10 : 6, hFwd);
          } else if (arsenal.hiveHolding) {
            const hOrigin = camera.position.clone().addScaledVector(hFwd, 0.7).add(new THREE.Vector3(0, -0.15, 0));
            const hDmg = hw.stats.damage * getWeaponDamageMultiplier(hw.id) * passivesRef.current.rangedDamageMultiplier;
            const fired = arsenal.hiveRelease(arsenalCtx, hOrigin, hFwd.clone(), hDmg, hAmmo);
            if (fired > 0) {
              ammoStockRef.current[currentSlotRef.current] = hAmmo - fired;
              viewmodelAnimRef.current.recoilPos.z += 0.05 + 0.01 * fired;
              viewmodelAnimRef.current.recoilRotX += 0.05 + 0.01 * fired;
              viewmodelAnimRef.current.slideBlowback = 0.06;
              setAnnouncement(`MICRO HIVE // ${fired} MISSILE${fired > 1 ? 'S' : ''} AWAY`);
              syncHudState();
            }
          }
        } else if (arsenal.hiveHolding) {
          arsenal.hiveRelease(arsenalCtx, camera.position.clone(), hFwd.clone(), 0, 0); // switched away: drop the locks
        }
      }
      {
        const gW = getActiveWeapon();
        const ammoNow = ammoStockRef.current[currentSlotRef.current] ?? gW.stats.maxAmmo;
        // PHOTON GATLING: hold to charge (max 3s) -> release to fire a burst whose length scales with the charge
        if (gW.id !== 'heavy_photon_gatling' || isReloadingRef.current || isPausedRef.current) {
          gatlingChargeRef.current = 0;
          gatlingFireLeftRef.current = 0;
          gatlingSpinRef.current = Math.max(0, gatlingSpinRef.current - delta / 0.8);
        } else if (gatlingFireLeftRef.current > 0) {
          gatlingFireLeftRef.current -= delta;
          gatlingSpinRef.current = 1;
          if (gatlingFireLeftRef.current <= 0 || ammoNow <= 0) {
            gatlingFireLeftRef.current = 0;
            gatlingChargeRef.current = 0;
            setChargeGauge(null);
          } else {
            setChargeGauge(gatlingFireLeftRef.current / Math.max(0.01, gatlingFireTotalRef.current), gW.color);
          }
        } else if (isMouseDownRef.current && ammoNow > 0) {
          if (gatlingChargeRef.current === 0) setAnnouncement('PHOTON GATLING // CHARGING... (RELEASE TO FIRE)');
          gatlingChargeRef.current = Math.min(1, gatlingChargeRef.current + delta / GATLING_CHARGE_TIME);
          gatlingSpinRef.current = gatlingChargeRef.current;
          setChargeGauge(Math.max(0.02, gatlingChargeRef.current), gW.color);
          if (gatlingChargeRef.current >= 1) setChargeGauge(1, gW.color);
        } else if (gatlingChargeRef.current > 0 && ammoNow > 0) {
          // trigger released -> burst
          gatlingFireTotalRef.current = GATLING_FIRE_MIN + (GATLING_FIRE_MAX - GATLING_FIRE_MIN) * gatlingChargeRef.current;
          gatlingFireLeftRef.current = gatlingFireTotalRef.current;
          gatlingChargeRef.current = 0;
          gatlingSpinRef.current = 1;
          setAnnouncement('PHOTON GATLING // FIRING!');
        } else {
          gatlingChargeRef.current = 0;
          gatlingSpinRef.current = Math.max(0, gatlingSpinRef.current - delta / 0.8);
        }

        // SPREAD-ER: rate and spread ramp up while firing; everything resets the moment the trigger is released
        if (gW.id === 'main_spreader' && isMouseDownRef.current && !isReloadingRef.current && ammoNow > 0) {
          spreaderHeatRef.current = Math.min(1, spreaderHeatRef.current + delta / SPREADER_RAMP_TIME);
        } else {
          spreaderHeatRef.current = 0;
        }
      }
      // RAVAGER-09: 押している間だけ削り続ける（離す / ガード / 武器切替で終了）
      if (sawGrindStartRef.current > 0) {
        const switched = getActiveWeapon().id !== 'blade_chainsaw';
        const released = !isMouseDownRef.current || isGuardingRef.current || meleeChargeStartRef.current !== 0;
        // 短く押しただけでも振り下ろしの一撃は最後まで出す
        if (switched || (released && sawDropDoneRef.current)) endChainsawGrindRef.current();
        else updateChainsawGrindRef.current();
      }
      if (gatlingFireLeftRef.current > 0 && getActiveWeapon().id === 'heavy_photon_gatling') {
        const gat = getActiveWeapon();
        const gatInterval = 1.0 / (gat.stats.fireRate * gatlingRateMul() * (1 + (passivesRef.current.meleeSpeedMultiplier - 1)));
        if (clock.getElapsedTime() - lastFireTimeRef.current >= gatInterval) {
          lastFireTimeRef.current = clock.getElapsedTime();
          executePrimaryAttack();
        }
      }
      if (isMouseDownRef.current && getActiveWeapon().id === 'blade_chainsaw') {
        // 押しっぱなしのまま技やガードが終わったら、そのまま振り下ろしから再開
        if (sawGrindStartRef.current === 0 && !isGuardingRef.current && meleeChargeStartRef.current === 0) executePrimaryAttack();
      } else if (isMouseDownRef.current) {
        const curW = getActiveWeapon();
        if (curW.category === 'MELEE') {
          // 長押しで三段攻撃: 前の振りが終わりかけたら次の段を自動で繰り出す
          // (左右クリック技は長押しで連発しない / クールタイム中は executePrimaryAttack 側で弾く)
          const ma = viewmodelAnimRef.current;
          if (!isGuardingRef.current && (!ma.meleeActive || ma.meleeProgress >= 0.9)) {
            executePrimaryAttack();
          }
        } else if (isAssaultTypeWeapon(curW) && curW.id !== 'heavy_photon_gatling') {
          const rampMul = curW.id === 'main_spreader' ? 1 + SPREADER_RATE_BONUS * spreaderHeatRef.current : 1;
          const fireInterval = 1.0 / (curW.stats.fireRate * rampMul * (1 + (passivesRef.current.meleeSpeedMultiplier - 1)));
          const nowT = clock.getElapsedTime();
          const sinceFire = nowT - lastFireTimeRef.current;
          if (sinceFire >= fireInterval) {
            const shotBefore = lastGunShotRef.current;
            // 連射の周期はこのループ側で管理済み（パッシブの連射倍率込み）。内部の判定が別基準で弾いて間が空くのを防ぐ
            autoFireRef.current = true;
            try {
              executePrimaryAttack();
            } finally {
              autoFireRef.current = false;
            }
            if (lastGunShotRef.current !== shotBefore) {
              // 撃てたら端数を持ち越して間隔を一定に保つ
              lastFireTimeRef.current = sinceFire < fireInterval * 2 ? lastFireTimeRef.current + fireInterval : nowT;
            } else if (performance.now() / 1000 - lastGunShotRef.current >= fireInterval) {
              // リロード中・弾切れなどで撃てない: 次の周期まで待つ（毎フレーム再試行しない）
              lastFireTimeRef.current = nowT;
            }
            // それ以外（内部の発射レート判定に僅差で弾かれた）は次フレームで再試行して取りこぼさない
          }
        }
      }

      // 4. BUTTERY SMOOTH VIEWMODEL POSTURE & ALL-WEAPON PROCEDURAL ANIMATIONS
      if (viewmodelGroupRef.current) {
        // Weapon attacks should animate pose/position only; lock scale to avoid model squashing.
        viewmodelGroupRef.current.scale.set(1, 1, 1);
        // Keep the holder's authored scale: some procedural weapon models rely on it.
        // Resetting it every frame erased per-weapon sizing and made models appear distorted.
        const curW = getActiveWeapon();
        const anim = viewmodelAnimRef.current;
        const isAds = isAimingRef.current && curW.category !== 'MELEE' && curW.modelType !== 'dynamite';

        // 4A. Update animation timers and transitions
        // Weapon draw/equip swoop (0 -> 1)
        if (anim.drawProgress < 1.0) {
          anim.drawProgress = Math.min(1.0, anim.drawProgress + delta * 4.2);
        }

        // Shotgun pump cycling (0 -> 1)
        if (anim.pumpActive) {
          anim.pumpProgress += delta * 2.8;
          if (anim.pumpProgress >= 1.0) {
            anim.pumpActive = false;
            anim.pumpProgress = 1.0;
          }
        }

        // Handgun slide blowback decay
        if (anim.slideBlowback > 0) {
          anim.slideBlowback = THREE.MathUtils.lerp(anim.slideBlowback, 0, 1 - Math.exp(-delta * 30));
        }
        const akimboDecay = Math.exp(-delta * 16);
        anim.akimboKickL *= akimboDecay;
        anim.akimboKickR *= akimboDecay;

        // Dynamite throw progress (0 -> 1)
        if (anim.throwActive) {
          anim.throwProgress += delta * 3.6;
          if (anim.throwProgress >= 1.0) {
            anim.throwActive = false;
            anim.throwProgress = 1.0;
          }
        }

        // Melee continuous swing progress (0 -> 1)
        if (anim.meleeActive) {
          const swingSpeed = getMeleeProfile(getMeleeStyle(curW)).speed[Math.max(0, Math.min(3, anim.meleeStep - 1))] * passivesRef.current.meleeSpeedMultiplier;
          anim.meleeProgress += delta * swingSpeed;
          if (anim.meleeProgress >= 1.0) {
            anim.meleeActive = false;
            anim.meleeProgress = 1.0;
          }
        }

        // Executioner Leap Slam progress
        if (anim.slamActive) {
          anim.slamTime += delta;
          // フェーズ時間: 跳躍 0.8s(→急降下へ切替は着地処理側) / 着弾後の復帰 0.62s / 異常時の安全弁
          if ((anim.slamPhase === 4 && anim.slamTime >= 0.62) || anim.slamTime > 4.0) {
            anim.slamActive = false;
            anim.slamProgress = 1.0;
            anim.slamPhase = 0;
          }
        }

        // Reload animation progress
        const reloadStyle = getReloadStyle(curW);
        // keyframe events of the reload: one mechanical sound each, plus detached parts (mag drop, brass, cell)
        const runReloadEvents = () => {
          if (!reloadStyle) return;
          const events = getReloadEvents(reloadStyle, anim.reloadFromEmpty);
          const rp = anim.reloadProgress;
          while (anim.reloadSfxStep < events.length && rp >= events[anim.reloadSfxStep].t) {
            const ev = events[anim.reloadSfxStep];
            if (ev.step) sound.playPistolReloadStep(ev.step);
            switch (ev.action) {
              case 'dropMag':
                dropPistolMag(reloadStyle === 'pistol' ? 'pistolMag' : 'gunMag');
                break;
              case 'ejectCell':
                // the spent cell pops up out of the receiver and tumbles away to the left
                dropPistolMag('heavyCell', { vel: new THREE.Vector3(-0.9, 1.5, 0.35), spin: new THREE.Vector3(7, 2, 9) });
                break;
              case 'casings':
                ejectCasings(6);
                break;
              case 'dropAkimbo':
                dropPistolMag('akimboMagR', { vel: new THREE.Vector3(0.1, -1.0, 0.1), spin: new THREE.Vector3(3, 1, -2) });
                dropPistolMag('akimboMagL', { vel: new THREE.Vector3(-0.1, -1.0, 0.1), spin: new THREE.Vector3(3, -1, 2) });
                break;
              case 'steam':
                ventSteam();
                break;
            }
            anim.reloadSfxStep++;
          }
        };
        if (isReloadingRef.current) {
          const reloadDuration = Math.max(Math.min(0.6, curW.stats.reloadTime), curW.stats.reloadTime * (1 + passivesRef.current.reloadSpeedMultiplier));
          anim.reloadProgress = Math.min(1.0, anim.reloadProgress + delta / reloadDuration);
          runReloadEvents();
        } else if (reloadStyle) {
          // The keyframed reload ends at rest, so easing the progress back would replay it in reverse.
          // If the frames fell behind the reload timer, quickly play out the remainder instead of snapping.
          const wasRunning = anim.reloadProgress > 0 && anim.reloadProgress < 1;
          anim.reloadProgress = wasRunning ? Math.min(1, anim.reloadProgress + delta * 3) : 0;
          if (wasRunning) runReloadEvents();
        } else {
          anim.reloadProgress = THREE.MathUtils.lerp(anim.reloadProgress, 0, 1 - Math.exp(-delta * 14));
        }

        // Exponential spring recoil recovery
        const recoilDecay = 1 - Math.exp(-delta * 22);
        anim.recoilPos.lerp(_zeroVec, recoilDecay);
        anim.recoilRotX = THREE.MathUtils.lerp(anim.recoilRotX, 0, recoilDecay);
        anim.recoilRotY = THREE.MathUtils.lerp(anim.recoilRotY, 0, recoilDecay);

        // Mouse look sway damping
        anim.swayX = THREE.MathUtils.lerp(anim.swayX, 0, 1 - Math.exp(-delta * 12));
        anim.swayY = THREE.MathUtils.lerp(anim.swayY, 0, 1 - Math.exp(-delta * 12));

        // 4B. Calculate Target Base Posture (Hipfire vs ADS as requested in reference image)
        let targetX = 0.25;
        let targetY = -0.23;
        let targetZ = -0.48;
        let targetRotX = 0.04;
        let targetRotY = -0.05;
        let targetRotZ = 0.02;

        // ARCHON 9 drops out of ADS to swap the magazine
        // (scoped weapons keep their sight line; everything else lowers the gun to reload)
        const keyReloading = !!reloadStyle && anim.reloadProgress > 0 && anim.reloadProgress < 1;
        const adsPose = isAds && !(keyReloading && (reloadStyle === 'pistol' || !hasOpticalScope(curW)));
        if (adsPose) {
          if (!hasOpticalScope(curW)) {
            // ================= 1枚目の画像: スコープがない武器 (ピストル、ロケットランチャー等) =================
            // 照準のほぼ下に銃のモデルが来るように配置（正面中央、照準直下にフロントサイトとバレルを構える）
            targetX = 0.0;
            targetY =
              curW.modelType === 'launcher'
                ? -0.22
                : curW.modelType === 'handgun' || curW.modelType === 'revolver'
                ? -0.21
                : -0.22;
            targetZ = -0.38;
            targetRotX = -0.01;
            targetRotY = 0.0;
            targetRotZ = 0.0;
          } else {
            // ================= 2枚目の画像: スコープがある武器 (スナイパー、アサルトライフル等) =================
            targetX = 0.0;
            targetY = curW.modelType === 'railgun' ? -0.36 : -0.32;
            targetZ = -0.35;
            targetRotX = -0.02;
            targetRotY = 0.0;
            targetRotZ = 0.0;
          }
        } else if (curW.id === 'sub_akimbo') {
          // 二丁拳銃の構え: 画面中央下部、左右の手に1丁ずつ
          targetX = 0.0;
          targetY = -0.2;
          targetZ = -0.5;
          targetRotX = 0.03;
          targetRotY = 0.0;
          targetRotZ = 0.0;
        } else if (curW.modelType === 'gauntlets') {
          // 両手ガントレットの構え: 画面中央下部に両拳を左右対称に構える
          if (isGuardingRef.current) {
            targetX = 0.0;
            targetY = -0.12;
            targetZ = -0.34;
            targetRotX = 0.25;
            targetRotY = 0.0;
            targetRotZ = 0.0;
          } else {
            targetX = 0.0;
            targetY = -0.20;
            targetZ = -0.42;
            targetRotX = 0.04;
            targetRotY = 0.0;
            targetRotZ = 0.0;
          }
        } else if (curW.modelType === 'twinblade') {
          // 双剣の構え: 画面中央下部に二刀を左右対称に構える（ガード中は星十字）
          const tgp = GUARD_PROFILES.twinblade.pose;
          if (isGuardingRef.current) {
            targetX = tgp.x;
            targetY = tgp.y;
            targetZ = tgp.z;
            targetRotX = tgp.rx;
            targetRotY = 0.0;
            targetRotZ = 0.0;
          } else {
            targetX = 0.0;
            targetY = -0.2;
            targetZ = -0.42;
            targetRotX = 0.04;
            targetRotY = 0.0;
            targetRotZ = 0.0;
          }
        } else if (curW.category === 'MELEE') {
          if (isGuardingRef.current) {
            // 武器ごとの防御の構え (utils/meleeGuards.ts)
            const gp = GUARD_PROFILES[getMeleeStyle(curW)].pose;
            targetX = gp.x;
            targetY = gp.y;
            targetZ = gp.z;
            targetRotX = gp.rx;
            targetRotY = gp.ry;
            targetRotZ = gp.rz;
            // TACHYON FANG: 位相回避中は構えが揺らぐ
            if (getMeleeStyle(curW) === 'dagger') {
              const tt = clock.getElapsedTime();
              targetX += Math.sin(tt * 23) * 0.012;
              targetY += Math.cos(tt * 17) * 0.008;
            }
          } else {
            // Ready stance
            targetX = 0.28;
            targetY = -0.25;
            targetZ = -0.52;
            targetRotX = 0.10;
            targetRotY = -0.20;
            targetRotZ = 0.26;
          }
        } else if (curW.modelType === 'dynamite') {
          targetX = 0.24;
          targetY = -0.21;
          targetZ = -0.44;
          targetRotX = 0.16;
          targetRotY = -0.12;
          targetRotZ = 0.08;
        }

        // 4C. Procedural Dynamic Offsets
        // 1. Weapon draw upward swoop
        const drawEase = 1 - Math.pow(1 - anim.drawProgress, 3);
        const drawOffsetY = (1 - drawEase) * -0.25;
        const drawOffsetRotX = (1 - drawEase) * 0.3;

        // 2. Breathing and Locomotion Bobbing
        const isMoving = _moveDir.lengthSq() > 0 && playerPos.current.y <= 1.72;
        let bobX = 0;
        let bobY = Math.sin(clock.getElapsedTime() * 1.8) * 0.002;
        if (isMoving) {
          const moveBobMult = isAds ? 0.08 : 1.0; // ADS drastically stabilizes weapon bobbing for precision!
          bobX = Math.sin(walkCycle) * 0.012 * moveBobMult;
          bobY += Math.abs(Math.cos(walkCycle)) * 0.01 * moveBobMult;
        }

        // 3. Reload tilting & lowering
        let reloadOffsetX = 0;
        let reloadOffsetY = 0;
        let reloadOffsetZ = 0;
        let reloadOffsetRotX = 0;
        let reloadOffsetRotY = 0;
        let reloadOffsetRotZ = 0;
        const pulsarReload = reloadStyle === 'pistol' ? getPistolReloadPose(anim.reloadProgress, anim.reloadFromEmpty) : null;
        // reload parts' docked positions (heavy cells sit at a different depth per weapon)
        let reloadDocks: ReloadDocks = DEFAULT_DOCKS;
        if (reloadStyle === 'heavy' && weaponMeshHolderRef.current) {
          const cellObj = weaponMeshHolderRef.current.getObjectByName('heavyCell');
          const dp = (cellObj?.userData.dock?.p as THREE.Vector3 | undefined) ?? cellObj?.position;
          if (dp) reloadDocks = { ...DEFAULT_DOCKS, cell: { x: dp.x, y: dp.y, z: dp.z } };
        }
        const wReload = reloadStyle && reloadStyle !== 'pistol' ? getWeaponReloadPose(reloadStyle, anim.reloadProgress, reloadDocks) : null;
        if (wReload) {
          reloadOffsetX = wReload.gun.x;
          reloadOffsetY = wReload.gun.y;
          reloadOffsetZ = wReload.gun.z;
          reloadOffsetRotX = wReload.gun.rx;
          reloadOffsetRotY = wReload.gun.ry;
          reloadOffsetRotZ = wReload.gun.rz;
        } else if (pulsarReload) {
          // ARCHON 9: realistic magazine swap (utils/pistolReload.ts)
          reloadOffsetX = pulsarReload.gun.x;
          reloadOffsetY = pulsarReload.gun.y;
          reloadOffsetZ = pulsarReload.gun.z;
          reloadOffsetRotX = pulsarReload.gun.rx;
          reloadOffsetRotY = pulsarReload.gun.ry;
          reloadOffsetRotZ = pulsarReload.gun.rz;
        } else if (anim.reloadProgress > 0) {
          const rCurve = Math.sin(anim.reloadProgress * Math.PI);
          reloadOffsetY = -0.16 * rCurve;
          reloadOffsetRotZ = 0.24 * rCurve;
          reloadOffsetRotX = 0.12 * rCurve;
        }
        if (reloadStyle && (wReload || pulsarReload)) {
          // anticipation / impact ring / settle / tremor shared by every reload style
          const pol = getReloadPolish(reloadStyle, anim.reloadProgress, clock.getElapsedTime());
          reloadOffsetX += pol.x;
          reloadOffsetY += pol.y;
          reloadOffsetZ += pol.z;
          reloadOffsetRotX += pol.rx;
          reloadOffsetRotY += pol.ry;
          reloadOffsetRotZ += pol.rz;
        }

        // 4. Melee Combo Procedural Swing Curves (Smooth continuous splines for Blades / Gauntlets)
        let targetMeleeX = 0;
        let targetMeleeY = 0;
        let targetMeleeZ = 0;
        let targetMeleeRotX = 0;
        let targetMeleeRotY = 0;
        let targetMeleeRotZ = 0;

        const nowSec = performance.now() / 1000;
        const sawRushing = nowSec < sawRushUntilRef.current;
        if (curW.id === 'blade_chainsaw' && (sawGrindStartRef.current > 0 || sawRushing)) {
          // RAVAGER-09: 振り下ろし → 押し当てて削る構え（刃の振動つき）
          const sp = getChainsawGrindPose(nowSec - sawGrindStartRef.current, clock.getElapsedTime(), sawRushing ? 1 : sawRpmRef.current, sawRushing);
          targetMeleeX = sp.x;
          targetMeleeY = sp.y;
          targetMeleeZ = sp.z;
          targetMeleeRotX = sp.rx;
          targetMeleeRotY = sp.ry;
          targetMeleeRotZ = sp.rz;
          if (isGuardingRef.current) {
            const gp = GUARD_PROFILES.chainsaw.pose;
            targetMeleeX += MELEE_READY_POSE.x - gp.x;
            targetMeleeY += MELEE_READY_POSE.y - gp.y;
            targetMeleeZ += MELEE_READY_POSE.z - gp.z;
            targetMeleeRotX += MELEE_READY_POSE.rx - gp.rx;
            targetMeleeRotY += MELEE_READY_POSE.ry - gp.ry;
            targetMeleeRotZ += MELEE_READY_POSE.rz - gp.rz;
          }
        } else if (curW.id === 'blade_scythe' && nowSec < scytheTempestUntilRef.current) {
          // REAPER TEMPEST: 前進しながら大鎌を振り回す
          const sp = getScytheTempestPose((nowSec - scytheTempestStartRef.current) / SCYTHE_TEMPEST_TIME);
          targetMeleeX = sp.x;
          targetMeleeY = sp.y;
          targetMeleeZ = sp.z;
          targetMeleeRotX = sp.rx;
          targetMeleeRotY = sp.ry;
          targetMeleeRotZ = sp.rz;
        } else if (anim.meleeActive && anim.meleeProgress < 1.0) {
          const p = anim.meleeProgress;
          const mStyle = getMeleeStyle(curW);
          if (mStyle === 'gauntlets') {
            // 拳は左右個別に動かす（体全体は軽く連動するだけ）
            const gp = getGauntletPoses(anim.meleeStep, p, anim.meleeVariant);
            targetMeleeX = gp.body.x;
            targetMeleeY = gp.body.y;
            targetMeleeZ = gp.body.z;
            targetMeleeRotX = gp.body.rx;
            targetMeleeRotY = gp.body.ry;
            targetMeleeRotZ = gp.body.rz;
            if (isGuardingRef.current) {
              // ガード構えの基準姿勢との差を補正（待機姿勢基準のモーションを再現）
              targetMeleeY += -0.08;
              targetMeleeZ += -0.08;
              targetMeleeRotX += -0.21;
            }
          } else if (mStyle === 'twinblade') {
            // 二刀は左右個別に動かす（体全体は軽く連動するだけ）
            const tp = getTwinBladePoses(anim.meleeStep, p);
            targetMeleeX = tp.body.x;
            targetMeleeY = tp.body.y;
            targetMeleeZ = tp.body.z;
            targetMeleeRotX = tp.body.rx;
            targetMeleeRotY = tp.body.ry;
            targetMeleeRotZ = tp.body.rz;
            if (isGuardingRef.current) {
              // ガード構えの基準姿勢との差を補正（待機姿勢基準のモーションを再現）
              targetMeleeY += -0.06;
              targetMeleeZ += -0.04;
              targetMeleeRotX += -0.16;
            }
          } else {
            // 武器固有キーフレーム（待機姿勢からの差分）
            const sp = getMeleeSwingPose(mStyle, anim.meleeStep, p);
            targetMeleeX = sp.x;
            targetMeleeY = sp.y;
            targetMeleeZ = sp.z;
            targetMeleeRotX = sp.rx;
            targetMeleeRotY = sp.ry;
            targetMeleeRotZ = sp.rz;
            if (isGuardingRef.current) {
              // ガード構え中のSweepでも待機姿勢基準で振れるよう補正 (構え - 待機 の差を打ち消す)
              const gp = GUARD_PROFILES[mStyle].pose;
              targetMeleeX += MELEE_READY_POSE.x - gp.x;
              targetMeleeY += MELEE_READY_POSE.y - gp.y;
              targetMeleeZ += MELEE_READY_POSE.z - gp.z;
              targetMeleeRotX += MELEE_READY_POSE.rx - gp.rx;
              targetMeleeRotY += MELEE_READY_POSE.ry - gp.ry;
              targetMeleeRotZ += MELEE_READY_POSE.rz - gp.rz;
            }
          }
        }

        // 溜めモーション: 武器を振りかぶって力を溜める（溜まるほど震える）。全近接武器共通の差分姿勢
        const chargeP = curW.category === 'MELEE' ? getMeleeChargeAnimP() : 0;
        if (chargeP > 0 && curW.id === 'blade_axe') {
          // GRAVITON MAUL: 一度ぐっと腰を落として引き込み → 両手で頭上へ重量物を持ち上げ → 限界でビリビリ震える
          const ct = clock.getElapsedTime();
          const sink = Math.sin(Math.min(1, chargeP / 0.3) * Math.PI) * (1 - Math.min(1, chargeP / 0.3) * 0.3);
          const lift = Math.pow(Math.max(0, chargeP - 0.15) / 0.85, 0.8);
          const eLift = lift * lift * (3 - 2 * lift);
          const strain = chargeP >= 1 ? 1 : chargeP * chargeP;
          const shake = 0.004 + strain * 0.012;
          const pulse = chargeP >= 1 ? Math.sin(ct * 18) * 0.012 : 0;
          targetMeleeX = 0.045 * eLift + Math.sin(ct * 63) * shake;
          targetMeleeY = -0.07 * sink + 0.3 * eLift + Math.cos(ct * 57) * shake + pulse;
          targetMeleeZ = 0.07 * sink + 0.2 * eLift + Math.sin(ct * 41) * shake * 0.6;
          targetMeleeRotX = 0.2 * sink - 1.35 * eLift + Math.sin(ct * 47) * shake * 2.2;
          targetMeleeRotY = 0.1 * eLift;
          targetMeleeRotZ = -0.14 * eLift + Math.cos(ct * 51) * shake * 1.6;
        } else if (chargeP > 0) {
          // 武器ごとの「力を溜める構え」(utils/meleeStyles.ts getMeleeChargePose)。満タンで震えが最大になる
          const cp = getMeleeChargePose(getMeleeStyle(curW), chargeP, clock.getElapsedTime());
          targetMeleeX = cp.x;
          targetMeleeY = cp.y;
          targetMeleeZ = cp.z;
          targetMeleeRotX = cp.rx;
          targetMeleeRotY = cp.ry;
          targetMeleeRotZ = cp.rz;
          if (isGuardingRef.current && curW.modelType !== 'gauntlets' && curW.modelType !== 'twinblade') {
            // 溜め中は右クリック（＝ガード構え）中なので、構えとの差を打ち消して待機姿勢基準で溜める
            const gp = GUARD_PROFILES[getMeleeStyle(curW)].pose;
            targetMeleeX += MELEE_READY_POSE.x - gp.x;
            targetMeleeY += MELEE_READY_POSE.y - gp.y;
            targetMeleeZ += MELEE_READY_POSE.z - gp.z;
            targetMeleeRotX += MELEE_READY_POSE.rx - gp.rx;
            targetMeleeRotY += MELEE_READY_POSE.ry - gp.ry;
            targetMeleeRotZ += MELEE_READY_POSE.rz - gp.rz;
          }
        }

        // REAPER TEMPEST 終了: 溜まった回転量を 2π の倍数で巻き戻し、元の構えへ逆回転しないようにする
        if (scytheTempestUntilRef.current > 0 && nowSec >= scytheTempestUntilRef.current) {
          scytheTempestUntilRef.current = 0;
          anim.meleeCurrentRot.z -= Math.round(anim.meleeCurrentRot.z / (Math.PI * 2)) * Math.PI * 2;
        }

        // Apply smooth exponential damping to target melee positions (eliminates ANY hitching or snapping)
        const meleeDamp = Math.min(1.0, delta * 34);
        anim.meleeCurrentPos.x = THREE.MathUtils.lerp(anim.meleeCurrentPos.x, targetMeleeX, meleeDamp);
        anim.meleeCurrentPos.y = THREE.MathUtils.lerp(anim.meleeCurrentPos.y, targetMeleeY, meleeDamp);
        anim.meleeCurrentPos.z = THREE.MathUtils.lerp(anim.meleeCurrentPos.z, targetMeleeZ, meleeDamp);

        anim.meleeCurrentRot.x = THREE.MathUtils.lerp(anim.meleeCurrentRot.x, targetMeleeRotX, meleeDamp);
        anim.meleeCurrentRot.y = THREE.MathUtils.lerp(anim.meleeCurrentRot.y, targetMeleeRotY, meleeDamp);
        anim.meleeCurrentRot.z = THREE.MathUtils.lerp(anim.meleeCurrentRot.z, targetMeleeRotZ, meleeDamp);

        // Executioner Titan Leap Slam Animation Curves
        let slamOffsetX = 0;
        let slamOffsetY = 0;
        let slamOffsetZ = 0;
        let slamOffsetRotX = 0;
        let slamOffsetRotZ = 0;
        if (anim.slamActive && anim.slamPhase > 0) {
          // 頂点（振りかぶり）と最下点（叩きつけ）のキーポーズ
          const APEX = { y: 0.36, z: 0.2, x: 0.04, rx: -1.4, rz: -0.12 };
          const LOW = { y: -0.44, z: -0.34, x: 0.0, rx: 1.2, rz: 0.05 };
          const st = anim.slamTime;
          if (anim.slamPhase <= 2) {
            // 跳躍: 一度ぐっと沈み込んでから、ハンマーを頭上へ引き上げる
            const t = Math.min(1, st / 0.55);
            const e = 1 - Math.pow(1 - t, 3);
            const dip = Math.sin(Math.min(1, t / 0.35) * Math.PI) * 0.06 * (1 - t);
            const tremble = t >= 1 ? Math.sin(st * 90) * 0.006 : 0;
            slamOffsetY = APEX.y * e - dip + tremble;
            slamOffsetZ = APEX.z * e + dip * 0.8;
            slamOffsetX = APEX.x * e + tremble;
            slamOffsetRotX = APEX.rx * e;
            slamOffsetRotZ = APEX.rz * e;
          } else if (anim.slamPhase === 3) {
            // 急降下: 加速しながら全力で振り下ろす（ease-in）
            const t = Math.min(1, st / 0.17);
            const a = t * t * t;
            slamOffsetY = APEX.y + (LOW.y - APEX.y) * a;
            slamOffsetZ = APEX.z + (LOW.z - APEX.z) * a;
            slamOffsetX = APEX.x + (LOW.x - APEX.x) * a;
            slamOffsetRotX = APEX.rx + (LOW.rx - APEX.rx) * a;
            slamOffsetRotZ = APEX.rz + (LOW.rz - APEX.rz) * a;
          } else {
            // 着弾: 衝撃で跳ね返りながら減衰振動し、ゆっくり構えへ復帰
            const hold = Math.min(1, Math.max(0, (st - 0.1) / 0.5));
            const k = 1 - hold * hold * (3 - 2 * hold);
            const bounce = Math.sin(st * 46) * 0.035 * Math.exp(-st * 8);
            slamOffsetY = LOW.y * k + bounce;
            slamOffsetZ = LOW.z * k - bounce * 0.8;
            slamOffsetX = LOW.x * k;
            slamOffsetRotX = LOW.rx * k - bounce * 3;
            slamOffsetRotZ = LOW.rz * k;
          }
        }

        // 5. Dynamite Throw Pullback & Forward Toss
        let dynOffsetX = 0;
        let dynOffsetY = 0;
        let dynOffsetZ = 0;
        let dynOffsetRotX = 0;
        if (anim.throwActive && anim.throwProgress < 1.0) {
          const p = anim.throwProgress;
          if (p < 0.35) {
            const t = p / 0.35;
            dynOffsetZ = 0.12 * t;
            dynOffsetY = 0.06 * t;
            dynOffsetRotX = 0.35 * t;
          } else {
            const t = (p - 0.35) / 0.65;
            dynOffsetZ = 0.12 - 0.45 * t;
            dynOffsetY = 0.06 - 0.12 * t;
            dynOffsetRotX = 0.35 - 0.75 * t;
          }
        }

        // 4D. Apply final smoothed positions & rotations to viewmodelGroup
        const finalTargetX = targetX + bobX + anim.swayX + reloadOffsetX + anim.recoilPos.x + anim.meleeCurrentPos.x + slamOffsetX + dynOffsetX;
        const finalTargetY = targetY + bobY + anim.swayY + drawOffsetY + reloadOffsetY + anim.recoilPos.y + anim.meleeCurrentPos.y + slamOffsetY + dynOffsetY;
        const finalTargetZ = targetZ + reloadOffsetZ + anim.recoilPos.z + anim.meleeCurrentPos.z + slamOffsetZ + dynOffsetZ;

        const finalTargetRotX = targetRotX + anim.recoilRotX + drawOffsetRotX + reloadOffsetRotX + anim.meleeCurrentRot.x + slamOffsetRotX + dynOffsetRotX;
        const finalTargetRotY = targetRotY + anim.recoilRotY - anim.swayX * 1.5 + reloadOffsetRotY + anim.meleeCurrentRot.y;
        const finalTargetRotZ = targetRotZ + anim.swayX * 2.0 + reloadOffsetRotZ + anim.meleeCurrentRot.z + slamOffsetRotZ;

        const lerpFactor = Math.min(1.0, delta * 24);
        viewmodelGroupRef.current.position.x = THREE.MathUtils.lerp(viewmodelGroupRef.current.position.x, finalTargetX, lerpFactor);
        viewmodelGroupRef.current.position.y = THREE.MathUtils.lerp(viewmodelGroupRef.current.position.y, finalTargetY, lerpFactor);
        viewmodelGroupRef.current.position.z = THREE.MathUtils.lerp(viewmodelGroupRef.current.position.z, finalTargetZ, lerpFactor);

        viewmodelGroupRef.current.rotation.x = THREE.MathUtils.lerp(viewmodelGroupRef.current.rotation.x, finalTargetRotX, lerpFactor);
        viewmodelGroupRef.current.rotation.y = THREE.MathUtils.lerp(viewmodelGroupRef.current.rotation.y, finalTargetRotY, lerpFactor);
        viewmodelGroupRef.current.rotation.z = THREE.MathUtils.lerp(viewmodelGroupRef.current.rotation.z, finalTargetRotZ, lerpFactor);

        // 4E. Sub-mesh Mechanical Animations (Shotgun Pump & Handgun Slide)
        if (weaponMeshHolderRef.current) {
          const pumpMesh = weaponMeshHolderRef.current.getObjectByName('pumpForend');
          if (pumpMesh) {
            if (anim.pumpActive) {
              const pumpCycle = Math.sin(anim.pumpProgress * Math.PI);
              pumpMesh.position.z = -0.42 + pumpCycle * 0.09;
            } else {
              pumpMesh.position.z = -0.42 + (wReload ? wReload.pump * 0.09 : 0);
            }
          }

          const slideMesh = weaponMeshHolderRef.current.getObjectByName('gunSlide');
          if (slideMesh) {
            let slideBack = anim.slideBlowback;
            if (pulsarReload) {
              // slide locks open on the last round and stays there until the reload's slide release
              const lockedOpen = !isReloadingRef.current && (ammoStockRef.current[currentSlotRef.current] ?? curW.stats.maxAmmo) <= 0;
              slideBack = Math.max(slideBack, (lockedOpen ? 1 : pulsarReload.slideBack) * 0.06);
            }
            slideMesh.position.z = -0.12 + slideBack;
          }

          // Rifle / shotgun / heavy: magazine, shell or energy cell of the reload (offset from its docked position)
          if (wReload) {
            const partName = reloadStyle === 'rifle' ? 'gunMag' : reloadStyle === 'heavy' ? 'heavyCell' : reloadStyle === 'shotgun' ? 'reloadShell' : '';
            const partObj = partName ? weaponMeshHolderRef.current.getObjectByName(partName) : null;
            if (partObj) {
              if (!partObj.userData.dock) partObj.userData.dock = { p: partObj.position.clone(), r: partObj.rotation.clone() };
              const { p: dp, r: dr } = partObj.userData.dock as { p: THREE.Vector3; r: THREE.Euler };
              const pt = wReload.part;
              partObj.visible = pt.visible;
              partObj.position.set(dp.x + pt.x, dp.y + pt.y, dp.z + pt.z);
              partObj.rotation.set(dr.x + pt.rx, dr.y + pt.ry, dr.z + pt.rz);
            }
            const drumObj = weaponMeshHolderRef.current.getObjectByName('revolverDrum');
            if (drumObj) {
              if (!drumObj.userData.dock) drumObj.userData.dock = drumObj.position.clone();
              const dp = drumObj.userData.dock as THREE.Vector3;
              drumObj.position.set(dp.x + wReload.drum.x, dp.y, dp.z);
              drumObj.rotation.z = wReload.drum.rz;
            }
            // off hand / speed-loader (absolute holder-space poses)
            const offHand = weaponMeshHolderRef.current.getObjectByName('gunReloadHand');
            if (offHand) {
              const h = wReload.hand;
              offHand.visible = h.visible;
              offHand.position.set(h.x, h.y, h.z);
              offHand.rotation.set(h.rx, h.ry, h.rz);
            }
            const loaderObj = weaponMeshHolderRef.current.getObjectByName('speedLoader');
            if (loaderObj) {
              const l = wReload.loader;
              loaderObj.visible = l.visible;
              loaderObj.position.set(l.x, l.y, l.z);
              loaderObj.rotation.set(l.rx, l.ry, l.rz);
            }
            const handleObj = weaponMeshHolderRef.current.getObjectByName('chargingHandle');
            if (handleObj) {
              if (handleObj.userData.dockZ === undefined) handleObj.userData.dockZ = handleObj.position.z;
              handleObj.position.z = handleObj.userData.dockZ + wReload.chargeHandle * 0.085;
            }
            // TWIN VIPER magazines (dropped, then re-seated off screen)
            const magR = weaponMeshHolderRef.current.getObjectByName('akimboMagR');
            const magL = weaponMeshHolderRef.current.getObjectByName('akimboMagL');
            if (magR) magR.visible = wReload.magR;
            if (magL) magL.visible = wReload.magL;
            // revolver flourish: spin the whole gun about the trigger guard (pivot below the frame)
            const hold = weaponMeshHolderRef.current;
            if (wReload.spin !== 0 || hold.rotation.x !== 0) {
              const PIVOT_Y = -0.06;
              const PIVOT_Z = 0.02;
              const a = wReload.spin;
              hold.rotation.x = a;
              // keep the pivot fixed: p' = P - R(P)
              hold.position.y = PIVOT_Y - (PIVOT_Y * Math.cos(a) - PIVOT_Z * Math.sin(a));
              hold.position.z = PIVOT_Z - (PIVOT_Y * Math.sin(a) + PIVOT_Z * Math.cos(a));
              if (a === 0) hold.position.set(0, 0, 0);
            }
          }

          // ARCHON 9: magazine + left hand of the reload
          const pistolMag = weaponMeshHolderRef.current.getObjectByName('pistolMag');
          const reloadHand = weaponMeshHolderRef.current.getObjectByName('reloadHand');
          if (pulsarReload && pistolMag && reloadHand) {
            const { mag, hand } = pulsarReload;
            pistolMag.visible = mag.visible;
            pistolMag.position.set(mag.x, mag.y, mag.z);
            pistolMag.rotation.set(mag.rx, mag.ry, mag.rz);
            reloadHand.visible = hand.visible;
            reloadHand.position.set(hand.x, hand.y, hand.z);
            reloadHand.rotation.set(hand.rx, hand.ry, hand.rz);
          }

          // TWIN VIPER: each hand kicks up/back on its own shot, its slide cycles independently
          const akimboR = weaponMeshHolderRef.current.getObjectByName('akimboRight');
          const akimboL = weaponMeshHolderRef.current.getObjectByName('akimboLeft');
          if (akimboR && akimboL) {
            const adsTuck = isAds ? 0.55 : 1; // ADS pulls both guns in toward the sight line
            ([[akimboR, anim.akimboKickR, 1, 'akimboSlideR'], [akimboL, anim.akimboKickL, -1, 'akimboSlideL']] as const).forEach(([hand, k, side, slideName]) => {
              // sharp snap at the start of the kick, then ease back
              const kick = k * k * (3 - 2 * k);
              const rl = wReload ? (side === 1 ? wReload.handR : wReload.handL) : null;
              hand.position.set(side * AKIMBO_HAND_X * adsTuck - side * kick * 0.012 + (rl?.x ?? 0), kick * 0.03 + (rl?.y ?? 0), kick * 0.075 + (rl?.z ?? 0));
              hand.rotation.set(kick * 0.32 + (rl?.rx ?? 0), side * kick * 0.04 + (rl?.ry ?? 0), -side * 0.07 - side * kick * 0.06 + (rl?.rz ?? 0));
              const sl = hand.getObjectByName(slideName);
              const reloadSlide = wReload ? (side === 1 ? wReload.slideR : wReload.slideL) : 0;
              if (sl) sl.position.z = -0.12 + Math.max(Math.min(1, k * 1.6), reloadSlide) * 0.06;
            });
          }

          // ---- 近接武器固有のサブメッシュ・アニメーション ----
          const holderObj = weaponMeshHolderRef.current;
          const swinging = anim.meleeActive && anim.meleeProgress < 1.0;
          const mp = swinging ? anim.meleeProgress : 0;

          // GRAVITON MAUL: 溜め・叩きつけ中はヘッドの重力コアが励起し、結晶片が高速で周回する
          const hCore = holderObj.getObjectByName('hammerCore');
          const hHalo = holderObj.getObjectByName('hammerHalo') as THREE.Mesh | null;
          const hOrbit = holderObj.getObjectByName('hammerOrbit');
          if (hCore && hHalo && hOrbit) {
            const hp = curW.id === 'blade_axe' ? getMeleeChargeAnimP() : 0;
            const slamGlow = anim.slamActive ? (anim.slamPhase === 4 ? Math.max(0, 1 - anim.slamTime / 0.5) : 1) : 0;
            const glow = Math.max(hp, slamGlow);
            const ht = clock.getElapsedTime();
            const beat = glow > 0 ? 0.5 + 0.5 * Math.sin(ht * (10 + glow * 18)) : 0;
            const haloMat = hHalo.material as THREE.MeshBasicMaterial;
            haloMat.opacity = THREE.MathUtils.lerp(haloMat.opacity, 0.26 + glow * (0.45 + beat * 0.25), Math.min(1, delta * 14));
            const hs = 1 + glow * 0.45 + beat * glow * 0.15;
            hHalo.scale.set(1, hs, hs);
            hCore.scale.set(1, 1 + glow * 0.18, 1 + glow * 0.18);
            const os = THREE.MathUtils.lerp(hOrbit.scale.x, glow > 0.02 ? 0.5 + glow * 0.7 : 0.0001, Math.min(1, delta * 12));
            hOrbit.scale.setScalar(Math.max(0.0001, os));
            hOrbit.rotation.x += delta * (3 + glow * 26);
          }

          // ガントレット：左右の拳を個別に動かす
          const lArm = holderObj.getObjectByName('leftGauntlet');
          const rArm = holderObj.getObjectByName('rightGauntlet');
          if (lArm && rArm) {
            const gp = swinging && curW.modelType === 'gauntlets' ? getGauntletPoses(anim.meleeStep, mp, anim.meleeVariant) : null;
            // 電磁クロスガード: 構え中は両腕を顔の前で交差させる
            const cross = isGuardingRef.current && !gp;
            const tl = gp ? [gp.left.x, gp.left.y, gp.left.z, gp.left.rx, gp.left.ry, gp.left.rz] : cross ? [0.13, 0.05, -0.02, 0.15, 0.25, -0.75] : [0, 0, 0, 0, 0, 0];
            const tr = gp ? [gp.right.x, gp.right.y, gp.right.z, gp.right.rx, gp.right.ry, gp.right.rz] : cross ? [-0.13, 0.09, 0.0, 0.15, -0.25, 0.75] : [0, 0, 0, 0, 0, 0];
            const k = Math.min(1, delta * 42);
            const gcp = curW.modelType === 'gauntlets' ? getMeleeChargeAnimP() : 0;
            if (gcp > 0) {
              // 溜め: 両拳を腰まで引き絞って小刻みに震える
              const ge = 1 - Math.pow(1 - gcp, 3);
              const gs = Math.sin(clock.getElapsedTime() * 63) * 0.008 * gcp;
              tl.splice(0, 6, -0.06 * ge + gs, 0.02 * ge, 0.22 * ge, 0.3 * ge, 0.15 * ge, 0);
              tr.splice(0, 6, 0.06 * ge - gs, 0.02 * ge, 0.22 * ge, 0.3 * ge, -0.15 * ge, 0);
            }
            for (let i = 0; i < 6; i++) {
              anim.gauntL[i] += (tl[i] - anim.gauntL[i]) * k;
              anim.gauntR[i] += (tr[i] - anim.gauntR[i]) * k;
            }
            lArm.position.set(GAUNTLET_ARM_BASE.left.x + anim.gauntL[0], GAUNTLET_ARM_BASE.left.y + anim.gauntL[1], GAUNTLET_ARM_BASE.left.z + anim.gauntL[2]);
            lArm.rotation.set(anim.gauntL[3], anim.gauntL[4], anim.gauntL[5]);
            rArm.position.set(GAUNTLET_ARM_BASE.right.x + anim.gauntR[0], GAUNTLET_ARM_BASE.right.y + anim.gauntR[1], GAUNTLET_ARM_BASE.right.z + anim.gauntR[2]);
            rArm.rotation.set(anim.gauntR[3], anim.gauntR[4], anim.gauntR[5]);
          }

          // ASTRO-ZWILL: 二刀を個別に動かす（ガード中は顔の前で星十字に交差）
          const tL = holderObj.getObjectByName('twinBladeL');
          const tR = holderObj.getObjectByName('twinBladeR');
          if (tL && tR) {
            const tp = swinging && curW.modelType === 'twinblade' ? getTwinBladePoses(anim.meleeStep, mp) : null;
            const crossGuard = isGuardingRef.current && !tp;
            const zero = [0, 0, 0, 0, 0, 0];
            const tl = tp ? [tp.left.x, tp.left.y, tp.left.z, tp.left.rx, tp.left.ry, tp.left.rz] : crossGuard ? TWIN_GUARD_ARMS.left : zero;
            const tr = tp ? [tp.right.x, tp.right.y, tp.right.z, tp.right.rx, tp.right.ry, tp.right.rz] : crossGuard ? TWIN_GUARD_ARMS.right : zero;
            const k = Math.min(1, delta * 42);
            const tcp = curW.modelType === 'twinblade' ? getMeleeChargeAnimP() : 0;
            let tlc = tl;
            let trc = tr;
            if (tcp > 0) {
              // 溜め: 二刀を大きく左右へ開いて振りかぶり、星屑の力を溜める
              const te = 1 - Math.pow(1 - tcp, 3);
              const ts = Math.sin(clock.getElapsedTime() * 63) * 0.01 * tcp;
              tlc = [-0.2 * te + ts, 0.2 * te, 0.14 * te, 0.9 * te, 0.95 * te, 0.5 * te];
              trc = [0.2 * te - ts, 0.2 * te, 0.14 * te, 0.9 * te, -0.95 * te, -0.5 * te];
            }
            for (let i = 0; i < 6; i++) {
              anim.gauntL[i] += (tlc[i] - anim.gauntL[i]) * k;
              anim.gauntR[i] += (trc[i] - anim.gauntR[i]) * k;
            }
            const bl = TWIN_ARM_BASE.left;
            const br = TWIN_ARM_BASE.right;
            tL.position.set(bl.x + anim.gauntL[0], bl.y + anim.gauntL[1], bl.z + anim.gauntL[2]);
            tL.rotation.set(bl.rx + anim.gauntL[3], bl.ry + anim.gauntL[4], bl.rz + anim.gauntL[5]);
            tR.position.set(br.x + anim.gauntR[0], br.y + anim.gauntR[1], br.z + anim.gauntR[2]);
            tR.rotation.set(br.rx + anim.gauntR[3], br.ry + anim.gauntR[4], br.rz + anim.gauntR[5]);
          }

          // RAVAGER-09: チェーンが刃の周りを回る（削り・突進・ガード中は高速、待機中はアイドリング）
          const sawChain = holderObj.getObjectByName('sawChain');
          if (sawChain) {
            const targetSpeed = sawRushing || isGuardingRef.current ? 0.8 : sawGrindStartRef.current > 0 ? 0.35 + 0.4 * sawRpmRef.current : 0.06;
            anim.sawChainSpeed += (targetSpeed - anim.sawChainSpeed) * Math.min(1, delta * 8);
            anim.sawChainOffset = (anim.sawChainOffset + delta * anim.sawChainSpeed) % 1;
            updateChainsawChain(sawChain, anim.sawChainOffset);
            const blur = holderObj.getObjectByName('sawBlur') as THREE.Mesh | undefined;
            if (blur) (blur.material as THREE.MeshBasicMaterial).opacity = Math.max(0, Math.min(0.55, (anim.sawChainSpeed - 0.1) * 0.8));
          }

          // パイルバンカー：溜めで震え、杭が前方へ突き出して戻る
          const needle = holderObj.getObjectByName('lanceNeedle');
          if (needle) {
            needle.position.z = -0.75 - 0.32 * (swinging ? getLanceNeedleExtension(mp) : 0);
            holderObj.position.x = swinging ? getLanceChargeShake(mp) : 0;
          }

          // チェーンスピア：銛が射出されている間は手元の銛先を隠す（エフェクト側の銛が飛ぶ）
          if (curW.id === 'blade_chainspear') {
            const away = swinging && anim.meleeStep < 4 && getHarpoonExtension(mp) > 0.02;
            holderObj.children.forEach((ch) => {
              if (ch.name === 'harpoonPart') ch.visible = !away;
            });
          }

          // VIPERCOIL: 鞭の各関節をカメラ空間で組み立て（振りの向きに関わらず前方へ伸びる）
          if (curW.id === 'blade_whip') {
            const stormNow = nowSec < whipStormUntilRef.current || (getMeleeChargeAnimP() > 0 && !swinging);
            const wStep = swinging ? anim.meleeStep : stormNow ? 4 : 0;
            getWhipPoints(wStep, mp, clock.getElapsedTime(), _whipPts);
            camera.updateMatrixWorld(true);
            const rootCam = camera.worldToLocal(holderObj.localToWorld(_whipA.set(WHIP_ROOT.x, WHIP_ROOT.y, WHIP_ROOT.z)));
            const prevW = camera.localToWorld(_whipB.copy(rootCam));
            for (let i = 0; i < WHIP_SEGMENTS; i++) {
              const seg = holderObj.getObjectByName(`whipSeg${i}`);
              const p = _whipPts[i];
              const curW3 = camera.localToWorld(_whipC.set(rootCam.x + p.x - WHIP_ROOT.x, rootCam.y + p.y - WHIP_ROOT.y, rootCam.z + p.z - WHIP_ROOT.z));
              if (seg) {
                seg.position.copy(holderObj.worldToLocal(prevW.clone()));
                seg.lookAt(curW3);
                const len = prevW.distanceTo(curW3);
                seg.scale.set(1, 1, Math.max(0.2, len / 0.095));
              }
              prevW.copy(curW3);
            }
            const tipObj = holderObj.getObjectByName('whipTip');
            if (tipObj) {
              tipObj.position.copy(holderObj.worldToLocal(prevW.clone()));
              tipObj.scale.setScalar(1 + (swinging && mp > 0.35 && mp < 0.55 ? 1.2 : 0));
            }
          }
          // ORBITAL RONDO: 投げた（飛んでいる）円月輪は手元から消す
          if (curW.id === 'blade_disc' && arsenalRef.current) {
            const halo = nowSec < discHaloUntilRef.current;
            const dR = holderObj.getObjectByName('discR');
            const dL = holderObj.getObjectByName('discL');
            if (dR) {
              dR.visible = !halo && !arsenalRef.current.chakramOut(1);
              dR.rotation.z += delta * (getMeleeChargeAnimP() > 0 ? 18 : 1.5);
            }
            if (dL) {
              dL.visible = !halo && !arsenalRef.current.chakramOut(-1);
              dL.rotation.z -= delta * (getMeleeChargeAnimP() > 0 ? 18 : 1.5);
            }
          }

          // 刃の軌跡: 振っている間（通常攻撃・溜め技・跳躍叩きつけ）だけ刃先の軌跡を残す
          if (weaponTrailsRef.current.length) {
            const tempest = curW.id === 'blade_scythe' && nowSec < scytheTempestUntilRef.current;
            // 振りの「溜め」部分（序盤）は軌跡を出さず、振り抜きの速い区間だけ描く
            const swingFast = swinging && mp > 0.12 && mp < 0.8;
            const emit = curW.category === 'MELEE' && (swingFast || tempest || (anim.slamActive && anim.slamPhase >= 3) || (sawRushing && curW.id === 'blade_chainsaw'));
            const boost = isSweepingRef.current || tempest ? 0.7 : swinging && anim.meleeStep >= 3 ? 0.45 : 0;
            camera.updateMatrixWorld(true);
            weaponTrailsRef.current.forEach((wt) => {
              wt.trail.boost = boost;
              wt.trail.life = curW.id === 'blade_tachyon' ? 0.1 : curW.id === 'blade_axe' || curW.id === 'blade_anchor' ? 0.2 : 0.15;
              const b = wt.obj.localToWorld(_trailBase.copy(wt.base));
              const t = wt.obj.localToWorld(_trailTip.copy(wt.tip));
              camera.worldToLocal(b);
              camera.worldToLocal(t);
              wt.trail.update(b, t, nowSec, emit);
            });
          }
        }

        // 4F. Dynamic FOV Zooming on ADS / Dash-Jump / Sprint
        let targetFov = 75;
        if (adsPose) {
          targetFov = getSightProfile(curW).fov; // 武器ごとのスコープ/サイト倍率
        } else if (isAirborneDashJumpRef.current) {
          targetFov = 84;
        } else if (isSprintingActive && _moveDir.lengthSq() > 0) {
          targetFov = 82;
        }

        camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, Math.min(1, delta * 18));
        camera.updateProjectionMatrix();
      }

      // 5. STAT REGENERATION & DYNAMITE RECHARGE
      dashCooldownRef.current = Math.max(0, dashCooldownRef.current - delta);
      staminaRef.current = 100;
      // HP+シールドが前フレームより減っていたら被弾とみなして無被弾時間をリセット
      const hpShieldBefore = playerHpRef.current + playerShieldRef.current;
      if (hpShieldBefore < hpShieldPrevRef.current - 0.001) sinceLastHitRef.current = 0;
      else sinceLastHitRef.current += delta;
      const shieldRegenerating = playerShieldRef.current < maxShieldRef.current;
      if (shieldRegenerating) {
        playerShieldRef.current = Math.min(maxShieldRef.current, playerShieldRef.current + delta * 5);
      }
      const hpRegenerating =
        !koRef.current &&
        playerHpRef.current > 0 &&
        playerHpRef.current < maxHpRef.current &&
        sinceLastHitRef.current >= HP_REGEN_DELAY_SECONDS;
      if (hpRegenerating) {
        playerHpRef.current = Math.min(maxHpRef.current, playerHpRef.current + delta * HP_REGEN_PER_SECOND);
      }
      hpShieldPrevRef.current = playerHpRef.current + playerShieldRef.current;
      if (shieldRegenerating || hpRegenerating) {
        // HUDはイベント時しか更新されないため、回復中は約15Hzで継続的に反映する
        const regenNow = performance.now();
        const regenFinished =
          (shieldRegenerating && playerShieldRef.current >= maxShieldRef.current) ||
          (hpRegenerating && playerHpRef.current >= maxHpRef.current);
        if (regenNow - lastShieldHudSyncRef.current > 66 || regenFinished) {
          lastShieldHudSyncRef.current = regenNow;
          syncHudState();
        }
      }

      const curSlot = currentSlotRef.current;
      const curW = getActiveWeapon();
      // 投擲物は手に持っていなくても全スロット分が自動で回復する
      for (const rs of [1, 2, 3, 4] as WeaponSlot[]) {
        const rw = rs === curSlot ? curW : weaponsRef.current.find((w) => w.id === activeLoadout[rs]);
        if (!rw || !(rw.modelType === 'dynamite' || rw.isRechargeable)) continue;
        const maxA = rw.stats.maxAmmo;
        const curA = ammoStockRef.current[rs] ?? maxA;
        const baseRecharge = (rw.rechargeTime ?? 6.0) / (1 + (passivesRef.current.rechargeSpeedMultiplier - 1));
        if (curA < maxA) {
          const t = (rechargeTimersRef.current[rs] ?? 0) + delta;
          if (t >= baseRecharge) {
            rechargeTimersRef.current[rs] = 0;
            ammoStockRef.current[rs] = curA + 1;
            sound.playScan();
            setAnnouncement(rw.id === 'heavy_sentry' ? 'VOLT SENTRY RECHARGED [+1]' : rw.id === 'grenade_palcer' ? 'PALCER RECHARGED [+1]' : 'DYNAMITE RECHARGED [+1]');
            syncHudState();
          } else {
            rechargeTimersRef.current[rs] = t;
          }
        } else {
          rechargeTimersRef.current[rs] = 0;
        }
      }
      rechargeTimerRef.current = rechargeTimersRef.current[curSlot] ?? 0;

      // 設置数・手元の円月輪数が変わったらHUDを更新する
      {
        const ars = arsenalRef.current;
        const sig = ars ? (curW.id === 'heavy_sentry' ? ars.turretCount : curW.id === 'blade_disc' ? ars.chakramsThrown : -1) : -1;
        if (sig !== throwSigRef.current) {
          throwSigRef.current = sig;
          syncHudState();
        }
      }

      // 投擲物の予測線 (長押し中のみ表示 / 離すとこの軌道で投げる)
      {
        const aimW = curW;
        const isGrenade = aimW.modelType === 'dynamite';
        if (!isGrenade) grenadeAimRef.current = false;
        const hasStock = (ammoStockRef.current[curSlot] ?? aimW.stats.maxAmmo) > 0;
        const showAim = grenadeAimRef.current && isGrenade && hasStock && !isPausedRef.current;
        if (showAim) {
          if (!grenadeAimLine) {
            const geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(GRENADE_AIM_STEPS * 3), 3));
            grenadeAimLine = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.9, depthTest: false }));
            grenadeAimLine.frustumCulled = false;
            grenadeAimLine.renderOrder = 999;
            scene.add(grenadeAimLine);
            grenadeAimRing = new THREE.Mesh(
              new THREE.RingGeometry(6.2, 6.5, 40),
              new THREE.MeshBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthTest: false }),
            );
            grenadeAimRing.rotation.x = -Math.PI / 2;
            grenadeAimRing.renderOrder = 999;
            scene.add(grenadeAimRing);
          }
          camera.getWorldDirection(_forward);
          const gp = _tempClosest.copy(camera.position).addScaledVector(_forward, 0.6);
          const aimProf = THROW_PROFILE[throwKindOf(aimW.id)];
          const gv = _tempToCenter.copy(_forward).multiplyScalar(aimProf.speed);
          gv.y += aimProf.up;
          const attr = grenadeAimLine.geometry.getAttribute('position') as THREE.BufferAttribute;
          let n = 0;
          attr.setXYZ(n++, gp.x, gp.y, gp.z);
          const dt = GRENADE_AIM_DT;
          for (let t = 0; t < 3.5 && n < GRENADE_AIM_STEPS; t += dt) {
            gv.y -= 25 * dt;
            gp.addScaledVector(gv, dt);
            attr.setXYZ(n++, gp.x, gp.y, gp.z);
            if (gp.y <= 0.3) break;
            let hit = false;
            for (let e = 0; e < enemiesRef.current.length; e++) {
              const enemy = enemiesRef.current[e];
              if (enemy.isDead) continue;
              const hb = getEnemyHitbox(enemy, _enemyCenter);
              if (gp.distanceTo(_enemyCenter) < hb.radius + 0.45) { hit = true; break; }
            }
            if (hit) break;
          }
          attr.needsUpdate = true;
          grenadeAimLine.geometry.setDrawRange(0, n);
          grenadeAimLine.visible = true;
          grenadeAimRing!.position.set(gp.x, 0.12, gp.z);
          grenadeAimRing!.scale.setScalar(aimProf.radius / THROW_PROFILE.blast.radius);
          grenadeAimRing!.visible = aimW.id !== 'heavy_sentry'; // 爆風半径リングはダイナマイト/PALCER用
        } else if (grenadeAimLine) {
          grenadeAimLine.visible = false;
          grenadeAimRing!.visible = false;
        }
      }

      // 6. SHIELD MESH
      {
        // INFIGHT guard effect (weapon-specific, rebuilt when the melee weapon changes)
        const gw = getActiveWeapon();
        const gStyle = gw.category === 'MELEE' ? getMeleeStyle(gw) : null;
        if (gStyle && (guardFxRef.current?.userData.weaponId !== gw.id || guardFxRef.current?.parent !== camera)) {
          if (guardFxRef.current) {
            guardFxRef.current.parent?.remove(guardFxRef.current);
            guardFxRef.current.traverse((o) => {
              const m = o as THREE.Mesh;
              m.geometry?.dispose();
              const mat = m.material as THREE.Material | undefined;
              if (mat && !Array.isArray(mat)) {
                (mat as THREE.MeshBasicMaterial).map?.dispose();
                mat.dispose();
              }
            });
          }
          const fx = buildGuardFx(gStyle, GUARD_PROFILES[gStyle].color);
          fx.userData.weaponId = gw.id;
          camera.add(fx);
          guardFxRef.current = fx;
        }
        const target = gStyle && isGuardingRef.current ? 1 : 0;
        guardStrengthRef.current += (target - guardStrengthRef.current) * Math.min(1, delta * 14);
        guardFlashRef.current = Math.max(0, guardFlashRef.current - delta * 3.5);
        if (guardFxRef.current) {
          if (!gStyle) guardFxRef.current.visible = false;
          else
            updateGuardFx(guardFxRef.current, clock.getElapsedTime(), {
              strength: guardStrengthRef.current,
              flash: guardFlashRef.current,
              held: performance.now() / 1000 - guardStartRef.current,
              perfectWindow: GUARD_PROFILES[gStyle].perfectWindow,
              lanceCharge: lanceChargeRef.current,
            });
        }
      }

      // Shared detonation for HYDRA (cluster bomblets) and SINGULARITY (gravity well).
      // Used on enemy impact, cover/floor impact and when the projectile runs out of range.
      const detonateSpecial = (bullet: BulletInstance, at: THREE.Vector3) => {
        if (bullet.detonated || !sceneRef.current) return;
        bullet.detonated = true;
        const pos = at.clone();
        pos.y = Math.max(0.3, pos.y);

        if (bullet.isCluster) {
          sound.playEnemyExplode();
          const splitNum = hasSkill('cluster_mod_split') ? 8 : 5;
          const bRadius = hasSkill('cluster_mod_radius') ? 6.0 : 4.0;
          for (let b = 0; b < splitNum; b++) {
            const bGeo = new THREE.SphereGeometry(0.12, 6, 6);
            const bMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
            const bomblet = new THREE.Mesh(bGeo, bMat);
            bomblet.position.copy(pos).add(new THREE.Vector3(0, 0.4, 0));
            sceneRef.current.add(bomblet);

            const bAngle = (b / splitNum) * Math.PI * 2 + Math.random() * 0.6;
            const bSpeed = 5.0 + Math.random() * 7.0;
            const bVel = new THREE.Vector3(Math.cos(bAngle) * bSpeed, 4.5 + Math.random() * 3.5, Math.sin(bAngle) * bSpeed);
            clusterBombletsRef.current.push({
              mesh: bomblet,
              velocity: bVel,
              lifetime: 1.4,
              damage: Math.round(bullet.damage * 0.38),
              blastRadius: bRadius,
              hasSecondary: hasSkill('cluster_mod_secondary'),
            });
          }
          spawnDamageText(`CLUSTER BURST!`, '#f59e0b');
        }

        if (bullet.isGravity) {
          sound.playSweepAttack();
          const wellGroup = new THREE.Group();
          const torusGeo = new THREE.TorusGeometry(1.6, 0.08, 8, 24);
          const torusMat = new THREE.MeshBasicMaterial({ color: 0xa855f7, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending });
          const torusMesh = new THREE.Mesh(torusGeo, torusMat);
          torusMesh.rotation.x = Math.PI / 2;
          wellGroup.add(torusMesh);

          const centerSphere = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 12), new THREE.MeshBasicMaterial({ color: 0x6b21a8 }));
          wellGroup.add(centerSphere);

          wellGroup.position.copy(pos);
          sceneRef.current.add(wellGroup);

          const gRadius = hasSkill('gravity_mod_radius') ? 12.0 : 8.5;
          const gPull = hasSkill('gravity_mod_pull') ? 34.0 : 20.0;
          gravityWellsRef.current.push({
            mesh: wellGroup,
            position: pos.clone(),
            lifetime: 2.4,
            damage: Math.round(bullet.damage * 0.9),
            radius: gRadius,
            pullPower: gPull,
            hasShockwave: hasSkill('gravity_mod_shockwave'),
          });
          setAnnouncement('GRAVITY WELL // SINGULARITY ENGAGED!');
        }
      };

      // 7. BULLETS UPDATE (CONTINUOUS SWEPT SEGMENT COLLISION DETECTION)
      for (let i = bulletsRef.current.length - 1; i >= 0; i--) {
        const bullet = bulletsRef.current[i];
        bullet.lifetime -= delta;

        // --- HOMING BULLET STEERING (Void Sniper) ---
        if (bullet.isHoming && bullet.isPlayer) {
          let bestTarget: EnemyInstance | null = null;
          let bestScore = -1;
          for (let e = 0; e < enemiesRef.current.length; e++) {
            const en = enemiesRef.current[e];
            if (en.isDead) continue;
            const d = bullet.mesh.position.distanceTo(en.mesh.position);
            const toEn = en.mesh.position.clone().sub(bullet.mesh.position).normalize();
            // only enemies within ~50° of the flight path can be locked (no more U-turns onto rear targets)
            if (d <= 55 && toEn.dot(bullet.direction) > 0.64) {
              // Prioritizes distant enemies and high durability (HP) targets
              const score = (d * 1.6) + (en.hp * 0.9);
              if (score > bestScore) {
                bestScore = score;
                bestTarget = en;
              }
            }
          }
          if (bestTarget) {
            const targetAim = (bestTarget as EnemyInstance).mesh.position.clone().add(new THREE.Vector3(0, 0.9, 0));
            const toTarget = targetAim.sub(bullet.mesh.position).normalize();
            bullet.direction.lerp(toTarget, delta * 7.5).normalize();
            bullet.mesh.lookAt(bullet.mesh.position.clone().add(bullet.direction));
          }
        }

        // BUBBLAS: bubbles lose momentum as they age, wobble and float upward, then burst
        if (bullet.isBubble) {
          bullet.bubbleAge = (bullet.bubbleAge ?? 0) + delta;
          if (bullet.bubbleLife === undefined) bullet.bubbleLife = bullet.lifetime + delta;
          const bk = Math.min(1, bullet.bubbleAge / bullet.bubbleLife);
          bullet.speed = (bullet.bubbleSpeed0 ?? BUBBLAS_SPEED) * Math.max(0.04, Math.pow(1 - bk, 1.6));
          const ph = (bullet.bubblePhase ?? 0) + bullet.bubbleAge * 6;
          bullet.mesh.position.x += Math.sin(ph) * delta * (0.3 + bk * 0.7);
          bullet.mesh.position.z += Math.cos(ph * 0.8) * delta * (0.3 + bk * 0.7);
          bullet.mesh.position.y += delta * (0.15 + bk * 1.1);
          // wobbling film, swelling just before it bursts
          const wob = 1 + 0.1 * Math.sin(ph * 2.3) + (bk > 0.8 ? (bk - 0.8) * 1.6 : 0);
          bullet.mesh.scale.set(wob, 1 / Math.sqrt(wob), wob);
        }

        // PHASE JESTER chakram: arcs out, then homes back to the thrower
        if (bullet.boomerang) {
          const bm = bullet.boomerang;
          bm.t += delta;
          bullet.mesh.rotation.z += delta * 18;
          if (bm.t < bm.out) {
            bullet.direction.applyAxisAngle(_up, bm.curve * delta).normalize();
          } else if (!bm.owner.isDead) {
            _tempSeg.copy(bm.owner.mesh.position).setY(bm.owner.mesh.position.y + 1.4).sub(bullet.mesh.position);
            if (_tempSeg.length() < 1.2) bullet.lifetime = 0; // caught
            bullet.direction.lerp(_tempSeg.normalize(), Math.min(1, delta * 5)).normalize();
            bullet.speed = Math.min(30, bullet.speed + delta * 12);
          }
        }

        const oldPos = bullet.prevPosition ? bullet.prevPosition.clone() : bullet.mesh.position.clone();
        bullet.mesh.position.addScaledVector(bullet.direction, bullet.speed * delta);
        const newPos = bullet.mesh.position.clone();
        bullet.prevPosition.copy(newPos);

        let hit = false;
        if (bullet.isPlayer) {
          // Continuous swept line segment test from oldPos to newPos
          _tempSeg.subVectors(newPos, oldPos);
          const segLenSq = _tempSeg.lengthSq();

          for (let e = 0; e < enemiesRef.current.length; e++) {
            const enemy = enemiesRef.current[e];
            if (enemy.isDead) continue;

            // Prevent multi-hitting the exact same enemy during a single piercing/wave pass
            if (bullet.isPiercing || bullet.isWave) {
              bullet.piercedEnemyIds = bullet.piercedEnemyIds || [];
              if (bullet.piercedEnemyIds.includes(e)) {
                continue;
              }
            }

            const hitbox = getEnemyHitbox(enemy, _enemyCenter);

            // Calculate closest point on bullet travel segment [oldPos, newPos] to enemyCenter
            let t = 0;
            if (segLenSq > 0.00001) {
              t = _tempToCenter.subVectors(_enemyCenter, oldPos).dot(_tempSeg) / segLenSq;
              t = Math.max(0, Math.min(1, t));
            }
            _tempClosest.copy(oldPos).addScaledVector(_tempSeg, t);

            // 1. Precise 3D Sphere distance test against true 3D visual enemy center
            const distSq = _tempClosest.distanceToSquared(_enemyCenter);
            const effectiveSphereR = hitbox.radius + bullet.bulletRadius;
            let isColliding = distSq <= effectiveSphereR * effectiveSphereR;

            // 2. Continuous cylinder/torso test (guarantees direct hits on limbs/heads never miss)
            if (!isColliding) {
              const dx = _tempClosest.x - enemy.mesh.position.x;
              const dz = _tempClosest.z - enemy.mesh.position.z;
              const horizDistSq = dx * dx + dz * dz;
              const effectiveHorizR = hitbox.radius * 0.92 + bullet.bulletRadius;
              if (
                _tempClosest.y >= hitbox.minY &&
                _tempClosest.y <= hitbox.maxY &&
                horizDistSq <= effectiveHorizR * effectiveHorizR
              ) {
                isColliding = true;
              }
            }

            if (isColliding) {
              if (bullet.isPiercing || bullet.isWave) {
                bullet.piercedEnemyIds = bullet.piercedEnemyIds || [];
                bullet.piercedEnemyIds.push(e);
              }

              let finalDmg = bullet.damage;

              // Range falloff (SMG / shotgun fall off hard, pistols & rifles mildly, snipers & heavies none)
              if (bullet.originPos && bullet.weaponRange && bullet.falloffMode && bullet.falloffMode !== 'none') {
                const travelled = bullet.originPos.distanceTo(_tempClosest);
                const startAt = bullet.weaponRange * (bullet.falloffMode === 'short' ? 0.35 : 0.6);
                const minMul = bullet.falloffMode === 'short' ? 0.45 : 0.7;
                let mul = 1;
                if (travelled > startAt) {
                  const f = Math.min(1, (travelled - startAt) / Math.max(1, bullet.weaponRange - startAt));
                  mul = 1 - (1 - minMul) * f;
                }
                // REAPER point-blank bonus
                if (bullet.weaponId === 'main_reaper' && travelled <= 4) mul = 1.25;
                finalDmg = Math.round(finalDmg * mul);
              }

              // Direct-hit scaling for area weapons (the real damage is in the detonation)
              if (bullet.isGravity) finalDmg = Math.round(finalDmg * 0.35);
              if (bullet.isCluster) finalDmg = Math.round(finalDmg * 0.6);

              // GLACIER: frozen targets shatter for bonus damage
              if (bullet.isFrost && (enemy.frozenTimer ?? 0) > 0) {
                finalDmg = Math.round(finalDmg * 1.3);
              }

              // Weakspot extra damage analysis for Void Sniper
              if (bullet.isHoming && hasSkill('void_mod_weakspot')) {
                const weakspotThreshold = isFlyingCategory(enemy.category) ? enemy.mesh.position.y : 1.35;
                if (_tempClosest.y >= weakspotThreshold) {
                  const critBonus = Math.round(bullet.damage * 0.85);
                  finalDmg += critBonus;
                  spawnDamageText(`WEAKSPOT CRIT! -${finalDmg}`, '#ef4444');
                  spawn3DHitSparks(_tempClosest, '#ef4444', 22);
                }
              }

              enemy.hp -= finalDmg;
              battleStats.current.damageDealt += finalDmg;
              sound.playEnemyHit();

              // Snap visual projectile to impact location
              bullet.mesh.position.copy(_tempClosest);

              // 1. Arc Chain Gun (VOLT CHAIN): 最寄りの敵へ連鎖 (基本3体 / 強化6体、連鎖ごとに35%減衰)
              if (bullet.isArc) {
                const shockDur = hasSkill('arc_mod_duration') ? 3.8 : 2.2;
                enemy.shockTimer = shockDur;
                const maxChains = hasSkill('arc_mod_chain') ? 6 : 3;
                let curArcDmg = Math.round(bullet.damage * 0.65);
                let lastPos = _tempClosest.clone();
                const chained = new Set<EnemyInstance>([enemy]);
                for (let hop = 0; hop < maxChains && curArcDmg > 5; hop++) {
                  let nearest: EnemyInstance | null = null;
                  let nearestD = 9.0;
                  enemiesRef.current.forEach((nextEn) => {
                    if (nextEn.isDead || chained.has(nextEn)) return;
                    const d = nextEn.mesh.position.distanceTo(lastPos);
                    if (d < nearestD) {
                      nearestD = d;
                      nearest = nextEn;
                    }
                  });
                  if (!nearest) break;
                  const nextEn = nearest as EnemyInstance;
                  chained.add(nextEn);
                  nextEn.hp -= curArcDmg;
                  nextEn.shockTimer = shockDur;
                  battleStats.current.damageDealt += curArcDmg;
                  spawnDamageText(`ARC CHAIN! -${curArcDmg}`, '#06b6d4');
                  const hopPos = nextEn.mesh.position.clone().add(new THREE.Vector3(0, 0.8, 0));
                  spawn3DHitSparks(hopPos, '#06b6d4', 12);

                  // Electric arc visual lightning line between targets
                  if (sceneRef.current) {
                    const lGeo = new THREE.BufferGeometry().setFromPoints([lastPos.clone(), hopPos.clone()]);
                    const lMat = new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.95 });
                    const lLine = new THREE.Line(lGeo, lMat);
                    sceneRef.current.add(lLine);
                    setTimeout(() => { sceneRef.current?.remove(lLine); lGeo.dispose(); lMat.dispose(); }, 120);
                  }

                  lastPos = hopPos;
                  curArcDmg = Math.round(curArcDmg * 0.65);
                }
              }

              // 2. Frost Cannon (GLACIER): 冷気が8回蓄積で2秒凍結。凍結後4秒は耐性、ボスは凍結時間半減
              if (bullet.isFrost) {
                enemy.chillSlowTimer = 3.8;
                if ((enemy.frozenTimer ?? 0) <= 0 && (enemy.freezeImmuneTimer ?? 0) <= 0) {
                  enemy.chillHits = (enemy.chillHits ?? 0) + 1;
                }
                if ((enemy.chillHits ?? 0) >= 8) {
                  let freezeDur = hasSkill('frost_mod_duration') ? 3.4 : 2.0;
                  if (enemy.category === 'boss' || enemy.category === 'titan') freezeDur *= 0.5;
                  enemy.frozenTimer = freezeDur;
                  enemy.freezeImmuneTimer = freezeDur + 4.0;
                  enemy.chillHits = 0;
                  spawnDamageText(`FROZEN!`, '#38bdf8');
                  setAnnouncement('FROST CANNON // TARGET FROZEN!');

                  if (hasSkill('frost_mod_nova')) {
                    const novaRadius = 7.5;
                    enemiesRef.current.forEach((nearEn) => {
                      if (nearEn !== enemy && !nearEn.isDead) {
                        if (nearEn.mesh.position.distanceTo(enemy.mesh.position) <= novaRadius) {
                          nearEn.chillSlowTimer = 3.8;
                          nearEn.chillHits = Math.min(7, (nearEn.chillHits ?? 0) + 3);
                          nearEn.hp -= Math.round(bullet.damage * 0.45);
                          spawnDamageText('FROST NOVA!', '#93c5fd');
                          spawn3DHitSparks(nearEn.mesh.position.clone().add(new THREE.Vector3(0, 0.8, 0)), '#93c5fd', 12);
                        }
                      }
                    });
                  }
                }
              }

              // 3. Nanoswarm (PLAGUE BLOOM): 感染は最大3スタック、重なるほど継続ダメージ増加
              if (bullet.isNanite) {
                enemy.naniteStacks = (enemy.naniteDotTimer ?? 0) > 0 ? Math.min(3, (enemy.naniteStacks ?? 1) + 1) : 1;
                enemy.naniteDotTimer = 4.5;
                enemy.naniteDotDamage = Math.max(8, Math.round(bullet.damage * 0.3));
                enemy.naniteNextTick = 0.5;
                spawnDamageText(`INFECTED x${enemy.naniteStacks}`, '#10b981');
              }

              // Burn (SOLAR FLARE / REAPER): 灼熱の継続ダメージ
              if ((bullet.burnDps ?? 0) > 0) {
                enemy.burnDps = Math.max(enemy.burnDps ?? 0, bullet.burnDps ?? 0);
                enemy.burnTimer = Math.max(enemy.burnTimer ?? 0, bullet.burnDuration ?? 2);
              }

              // 4/5. Cluster (HYDRA) & Gravity (SINGULARITY) detonate at the impact point
              if (bullet.isCluster || bullet.isGravity) {
                detonateSpecial(bullet, _tempClosest);
              }

              // Railgun Burst at impact (rail_mod_burst)
              if (bullet.hasRailBurst && sceneRef.current) {
                sound.playEnemyExplode();
                const burstRad = 5.4;
                enemiesRef.current.forEach((nearEn) => {
                  if (nearEn.isDead) return;
                  const dist = nearEn.mesh.position.distanceTo(_tempClosest);
                  if (dist <= burstRad) {
                    const bDmg = Math.round(bullet.damage * 0.55);
                    nearEn.hp -= bDmg;
                    battleStats.current.damageDealt += bDmg;
                    spawnDamageText(`RAIL BURST! -${bDmg}`, '#ef4444');
                  }
                });
                spawn3DHitSparks(_tempClosest, '#ef4444', 24);
              }

              // 6. Ricochet Blade (RICOCHET EDGE): 往復・反射バウンス
              if (bullet.isRicochet && (bullet.ricochetBouncesRemaining ?? 0) > 0) {
                bullet.ricochetBouncesRemaining = (bullet.ricochetBouncesRemaining ?? 1) - 1;
                hit = false; // Does not destroy projectile, bounces!

                // 反射ごとに8%減衰 (RAMP強化で逆に25%増加)
                bullet.damage = Math.round(bullet.damage * (hasSkill('ricochet_mod_ramp') ? 1.25 : 0.92));

                let nextTarget: EnemyInstance | null = null;
                let minDist = Infinity;
                enemiesRef.current.forEach((otherEn) => {
                  if (otherEn !== enemy && !otherEn.isDead) {
                    const d = otherEn.mesh.position.distanceTo(_tempClosest);
                    if (d < minDist && d <= 26) {
                      minDist = d;
                      nextTarget = otherEn;
                    }
                  }
                });

                if (nextTarget) {
                  bullet.direction.subVectors((nextTarget as EnemyInstance).mesh.position.clone().add(new THREE.Vector3(0, 0.8, 0)), _tempClosest).normalize();
                } else {
                  // Return path back towards player
                  const toPlayer = playerPos.current.clone().add(new THREE.Vector3(0, 1.0, 0)).sub(_tempClosest).normalize();
                  bullet.direction.copy(toPlayer);
                }
                bullet.direction.add(new THREE.Vector3((Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.1, (Math.random() - 0.5) * 0.2)).normalize();
                bullet.mesh.position.addScaledVector(bullet.direction, 0.8);
                bullet.lifetime = 2.5;
                spawnDamageText(`RICOCHET! -${bullet.damage}`, '#a855f7');
              } else if (bullet.isBubble) {
                hit = false; // bubbles drift straight through every enemy
              } else if (bullet.isPiercing && (bullet.pierceRemaining ?? 0) > 0) {
                bullet.pierceRemaining = (bullet.pierceRemaining ?? 1) - 1;
                bullet.damage = Math.max(bullet.minDamage ?? 0, Math.round(bullet.damage * (1 - (bullet.pierceDecay ?? 0))));
                hit = false; // Pierces through enemy!
                spawnDamageText(`PIERCE! -${finalDmg}`, '#38bdf8');
              } else if (bullet.isWave) {
                bullet.damage = Math.max(bullet.minDamage ?? 0, Math.round(bullet.damage * (1 - (bullet.pierceDecay ?? 0))));
                hit = false; // Wave penetrates all targets!
                spawnDamageText(`WAVE! -${finalDmg}`, '#a855f7');
              } else {
                hit = true;
              }

              // Firearms stagger / knockback
              const waveKnock = hasSkill('wave_mod_knockback') ? 22.0 : 12.0;
              const knockScale = bullet.isWave ? waveKnock : (bullet.knockback ?? 2.0);
              enemy.velocity.x += bullet.direction.x * knockScale;
              enemy.velocity.z += bullet.direction.z * knockScale;
              enemy.mesh.position.y = isFlyingCategory(enemy.category) ? enemy.mesh.position.y : 0;

              // 3D Spatial hit impact sparks
              if (bullet.isBubble) {
                spawnBubblePop(_tempClosest, 0.22);
                sound.playBubblePop();
              } else {
                spawn3DHitSparks(_tempClosest, bullet.isArc ? '#06b6d4' : bullet.isFrost ? '#93c5fd' : '#38bdf8', 12);
              }

              if (bullet.isCrit) {
                spawnDamageText(`CRITICAL! -${finalDmg}`, '#facc15');
                spawn3DHitSparks(_tempClosest, '#facc15', 10);
              } else {
                spawnDamageText(`-${finalDmg}`, '#0284c7');
              }
              setHitMarkerActive(true);
              setTimeout(() => setHitMarkerActive(false), 85);

              if (hit) {
                break;
              }
            }
          }
        } else {
          // Enemy projectile hitting player (swept segment test against player core)
          _tempSeg.subVectors(newPos, oldPos);
          const segLenSq = _tempSeg.lengthSq();

          const playerCenter = playerPos.current.clone();
          playerCenter.y += 0.9;

          let t = 0;
          if (segLenSq > 0.00001) {
            t = _tempToCenter.subVectors(playerCenter, oldPos).dot(_tempSeg) / segLenSq;
            t = Math.max(0, Math.min(1, t));
          }
          _tempClosest.copy(oldPos).addScaledVector(_tempSeg, t);

          if (!bullet.visualOnly && !koRef.current && _tempClosest.distanceTo(playerCenter) <= 1.35) {
            hit = true;
            // 溜め技の発動中(操作不能時間)は被ダメージ 75% カット
            const bulletDmg = Math.round(bullet.damage * (isSweepingRef.current ? 0.25 : 1));
            let incoming = bulletDmg;
            if (isGuardingRef.current) {
              applyGuardBlockRef.current(incoming, 'projectile');
            } else {
              sound.playHurt();
              setDamageVignette(true);
              setTimeout(() => setDamageVignette(false), 160);
              if (playerShieldRef.current > 0) {
                const absorb = Math.min(playerShieldRef.current, incoming);
                playerShieldRef.current -= absorb;
                incoming -= absorb;
              }
              playerHpRef.current = Math.max(0, playerHpRef.current - incoming);
              battleStats.current.damageTaken += bulletDmg;
              spawnDamageText(`-${bulletDmg}`, '#ef4444');
            }
            if (playerHpRef.current <= 0) {
              onLocalHpZero();
            }
          }
          // CO-OP (ホスト): 味方への被弾判定。ダメージ処理は本人の側で行う
          if (!hit && !bullet.visualOnly && coop?.isHost) {
            for (const r of coop.remoteList) {
              if (r.ko || !r.seen) continue;
              const rc = r.eye.clone();
              rc.y += 0.9;
              let rt = 0;
              if (segLenSq > 0.00001) {
                rt = _tempToCenter.subVectors(rc, oldPos).dot(_tempSeg) / segLenSq;
                rt = Math.max(0, Math.min(1, rt));
              }
              _tempClosest.copy(oldPos).addScaledVector(_tempSeg, rt);
              if (_tempClosest.distanceTo(rc) <= 1.35) {
                hit = true;
                coop.sendHit(r.id, Math.round(bullet.damage), '', '#ef4444', { guard: 'projectile' });
                break;
              }
            }
          }
        }

        // HYDRA / SINGULARITY shells burst on the floor too
        if (!hit && bullet.isPlayer && (bullet.isCluster || bullet.isGravity) && bullet.mesh.position.y <= 0.25) {
          hit = true;
        }

        // Continuous collision against stage covers (both player and enemy shots blocked by cover!)
        if (!hit) {
          const bPos = bullet.mesh.position;
          for (let c = 0; c < coverObjectsRef.current.length; c++) {
            const cb = coverObjectsRef.current[c].box;
            if (
              bPos.x >= cb.minX && bPos.x <= cb.maxX &&
              bPos.z >= cb.minZ && bPos.z <= cb.maxZ &&
              bPos.y >= 0 && bPos.y <= cb.height
            ) {
              hit = true;
              spawn3DHitSparks(bPos.clone(), '#94a3b8', 6);
              break;
            }
          }
        }

        if ((hit || bullet.lifetime <= 0) && bullet.isPlayer && (bullet.isCluster || bullet.isGravity) && !bullet.detonated) {
          detonateSpecial(bullet, bullet.mesh.position);
        }

        if (hit || bullet.lifetime <= 0) {
          bullet.boomerang?.onDone?.();
          if (bullet.isBubble) {
            spawnBubblePop(bullet.mesh.position, 0.4 + bullet.mesh.scale.x * 0.1);
            sound.playBubblePop();
          }
          scene.remove(bullet.mesh);
          if (bullet.mesh instanceof THREE.Mesh) {
            bullet.mesh.geometry.dispose();
          } else {
            bullet.mesh.traverse((child) => {
              if (child instanceof THREE.Mesh) {
                child.geometry.dispose();
              }
            });
          }
          bulletsRef.current.splice(i, 1);
        }
      }

      // 7.4 BUBBLAS pop shells
      for (let b = bubblePopsRef.current.length - 1; b >= 0; b--) {
        const pop = bubblePopsRef.current[b];
        pop.age += delta;
        const pk = pop.age / pop.life;
        if (pk >= 1) {
          scene.remove(pop.mesh);
          pop.mesh.geometry.dispose();
          (pop.mesh.material as THREE.Material).dispose();
          bubblePopsRef.current.splice(b, 1);
        } else {
          pop.mesh.scale.setScalar(pop.size * (0.4 + pk * 1.6));
          (pop.mesh.material as THREE.MeshBasicMaterial).opacity = 0.55 * (1 - pk);
        }
      }

      // 7.45 SHR1NKER: hold to charge (max 3s) -> release to fire a laser for 2x the charged time; thicker with more charge
      {
        const st = shr1nkerRef.current;
        const sW = getActiveWeapon();
        const sAmmo = ammoStockRef.current[currentSlotRef.current] ?? sW.stats.maxAmmo;
        const sUsable = sW.id === 'heavy_shr1nker' && !isReloadingRef.current && !isPausedRef.current;
        const sColor = new THREE.Color(sW.color);
        // lazily build the beam meshes once and keep them hidden until needed
        if (!st.group) {
          const g = new THREE.Group();
          // the beam is a thin-at-the-muzzle taper followed by a straight run, so a thick beam never swallows the camera
          const cyl = new THREE.CylinderGeometry(1, 1, 1, 14, 1, true);
          const taper = new THREE.CylinderGeometry(1, 0.1, 1, 14, 1, true);
          const glowMat = () => new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
          const coreMat = () => new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
          st.glow = new THREE.Mesh(cyl, glowMat());
          st.core = new THREE.Mesh(cyl.clone(), coreMat());
          st.glowNear = new THREE.Mesh(taper, glowMat());
          st.coreNear = new THREE.Mesh(taper.clone(), coreMat());
          g.add(st.glowNear, st.coreNear);
          st.flare = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 10), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending }));
          st.impact = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 10), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }));
          g.add(st.glow, st.core, st.flare, st.impact);
          g.visible = false;
          g.frustumCulled = false;
          scene.add(g);
          st.group = g;
          st.orb = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 12), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }));
          st.orb.visible = false;
          st.orb.frustumCulled = false;
          scene.add(st.orb);
        }
        const hideBeam = () => {
          if (st.group) st.group.visible = false;
          if (st.orb) st.orb.visible = false;
        };

        camera.getWorldDirection(_beamFwd);
        _beamOrg.copy(camera.position);
        _beamRight.crossVectors(_beamFwd, _beamUp).normalize();

        if (!sUsable) {
          if (st.active) setChargeGauge(null);
          st.active = false;
          st.charge = 0;
          st.beamLeft = 0;
          hideBeam();
        } else if (st.beamLeft > 0) {
          // ---- FIRING: sweep the laser along the crosshair ----
          st.active = true;
          st.beamLeft -= delta;
          if (st.beamLeft <= 0) {
            st.beamLeft = 0;
            st.active = false;
            hideBeam();
            setChargeGauge(null);
          } else {
            setChargeGauge(st.beamLeft / Math.max(0.01, st.beamTotal), sW.color);
            const radius = SHR1NKER_RADIUS_MIN + (SHR1NKER_RADIUS_MAX - SHR1NKER_RADIUS_MIN) * st.thick;
            // the beam stops at the first cover block or the floor
            let len = sW.stats.range;
            if (_beamFwd.y < -0.001) len = Math.min(len, Math.max(0.5, _beamOrg.y / -_beamFwd.y));
            for (let d = 1; d < len; d += 1) {
              _beamPt.copy(_beamOrg).addScaledVector(_beamFwd, d);
              let blocked = false;
              for (let c = 0; c < coverObjectsRef.current.length; c++) {
                const cb = coverObjectsRef.current[c].box;
                if (_beamPt.x >= cb.minX && _beamPt.x <= cb.maxX && _beamPt.z >= cb.minZ && _beamPt.z <= cb.maxZ && _beamPt.y >= 0 && _beamPt.y <= cb.height) {
                  blocked = true;
                  break;
                }
              }
              if (blocked) { len = d; break; }
            }

            // visuals: from the muzzle to the end point, flickering slightly
            const flick = 1 + 0.08 * Math.sin(performance.now() * 0.05);
            _beamStart.copy(_beamOrg).addScaledVector(_beamRight, 0.14).addScaledVector(_beamUp, -0.12).addScaledVector(_beamFwd, 0.75);
            _beamEnd.copy(_beamOrg).addScaledVector(_beamFwd, Math.max(len, 1.5));
            _beamDir.subVectors(_beamEnd, _beamStart);
            const vLen = Math.max(0.1, _beamDir.length());
            _beamDir.divideScalar(vLen);
            _beamMid.addVectors(_beamStart, _beamEnd).multiplyScalar(0.5);
            const fadeIn = Math.min(1, (st.beamTotal - st.beamLeft) / 0.12);
            const fadeOut = Math.min(1, st.beamLeft / 0.25);
            const vis = Math.min(fadeIn, fadeOut);
            if (st.group && st.glow && st.core && st.glowNear && st.coreNear && st.flare && st.impact) {
              st.group.visible = true;
              const nearLen = Math.min(vLen, 4);
              const farLen = Math.max(0.01, vLen - nearLen);
              const rGlow = radius * 1.0 * flick * vis;
              const rCore = radius * 0.38 * flick * vis;
              st.glowNear.position.copy(_beamStart).addScaledVector(_beamDir, nearLen / 2);
              st.coreNear.position.copy(st.glowNear.position);
              st.glow.position.copy(_beamStart).addScaledVector(_beamDir, nearLen + farLen / 2);
              st.core.position.copy(st.glow.position);
              [st.glow, st.core, st.glowNear, st.coreNear].forEach((m) => m.quaternion.setFromUnitVectors(_beamUp, _beamDir));
              st.glowNear.scale.set(rGlow, nearLen, rGlow);
              st.coreNear.scale.set(rCore, nearLen, rCore);
              st.glow.scale.set(rGlow, farLen, rGlow);
              st.core.scale.set(rCore, farLen, rCore);
              (st.glow.material as THREE.MeshBasicMaterial).color.copy(sColor);
              (st.glowNear.material as THREE.MeshBasicMaterial).color.copy(sColor);
              (st.core.material as THREE.MeshBasicMaterial).color.copy(sColor).lerp(new THREE.Color(0xffffff), 0.8);
              (st.coreNear.material as THREE.MeshBasicMaterial).color.copy((st.core.material as THREE.MeshBasicMaterial).color);
              st.flare.position.copy(_beamStart);
              st.flare.scale.setScalar(Math.min(0.14, radius * 0.3 + 0.03) * flick * vis);
              (st.flare.material as THREE.MeshBasicMaterial).color.copy(sColor).lerp(new THREE.Color(0xffffff), 0.5);
              st.impact.position.copy(_beamEnd);
              st.impact.scale.setScalar(radius * 1.9 * flick * vis + 0.02);
              (st.impact.material as THREE.MeshBasicMaterial).color.copy(sColor);
            }

            // damage ticks: everything within the beam's width along [0, len] is burned
            st.tick -= delta;
            st.spark -= delta;
            st.textTimer -= delta;
            if (st.tick <= 0) {
              st.tick += SHR1NKER_TICK;
              const tickDmg = Math.round(
                sW.stats.damage * (0.55 + 0.9 * st.thick) * getWeaponDamageMultiplier(sW.id) * passivesRef.current.rangedDamageMultiplier,
              );
              let anyHit = false;
              for (let e = 0; e < enemiesRef.current.length; e++) {
                const en = enemiesRef.current[e];
                if (en.isDead) continue;
                const hb = getEnemyHitbox(en, _enemyCenter);
                _tempToCenter.subVectors(_enemyCenter, _beamOrg);
                const along = _tempToCenter.dot(_beamFwd);
                if (along < 0 || along > len + hb.radius) continue;
                _tempClosest.copy(_beamOrg).addScaledVector(_beamFwd, Math.min(along, len));
                const sphereR = hb.radius + radius;
                let inBeam = _tempClosest.distanceToSquared(_enemyCenter) <= sphereR * sphereR;
                if (!inBeam) {
                  const dx = _tempClosest.x - en.mesh.position.x;
                  const dz = _tempClosest.z - en.mesh.position.z;
                  const cr = hb.radius * 0.92 + radius;
                  inBeam = _tempClosest.y >= hb.minY && _tempClosest.y <= hb.maxY && dx * dx + dz * dz <= cr * cr;
                }
                if (!inBeam) continue;
                anyHit = true;
                en.hp -= tickDmg;
                battleStats.current.damageDealt += tickDmg;
                st.textAcc += tickDmg;
                if (st.spark <= 0) spawn3DHitSparks(_enemyCenter, sW.color, 3);
              }
              if (anyHit) {
                if (st.spark <= 0) st.spark = 0.2;
                sound.playEnemyHit();
                setHitMarkerActive(true);
                setTimeout(() => setHitMarkerActive(false), 60);
                if (st.textTimer <= 0 && st.textAcc > 0) {
                  spawnDamageText(`-${st.textAcc}`, sW.color);
                  st.textAcc = 0;
                  st.textTimer = 0.3;
                }
              }
            }
            // low pulse + shake that grows with thickness
            st.sfx -= delta;
            if (st.sfx <= 0) {
              st.sfx = 0.2;
              sound.playBeamPulse(st.thick);
            }
            cameraShakeRef.current = { amp: 0.006 + 0.02 * st.thick, until: performance.now() / 1000 + 0.1, dur: 0.1 };
            viewmodelAnimRef.current.recoilRotY += (Math.random() - 0.5) * 0.003 * (0.3 + st.thick);
          }
        } else if (isMouseDownRef.current && sAmmo > 0) {
          // ---- CHARGING ----
          if (st.charge === 0) setAnnouncement('SHR1NKER // CHARGING... (RELEASE TO FIRE)');
          const wasFull = st.charge >= SHR1NKER_CHARGE_TIME;
          st.charge = Math.min(SHR1NKER_CHARGE_TIME, st.charge + delta);
          st.active = true;
          const cp = st.charge / SHR1NKER_CHARGE_TIME;
          setChargeGauge(Math.max(0.02, cp), sW.color);
          st.chargeSfx -= delta;
          if (st.chargeSfx <= 0) {
            st.chargeSfx = 0.14;
            sound.playBeamCharge(cp);
          }
          if (cp >= 1 && !wasFull) {
            sound.playUiClick();
            setAnnouncement('SHR1NKER // FULL CHARGE! RELEASE!');
          }
          if (st.orb) {
            const flick = 1 + 0.15 * Math.sin(performance.now() * 0.04);
            st.orb.visible = true;
            st.orb.position.copy(_beamOrg).addScaledVector(_beamRight, 0.14).addScaledVector(_beamUp, -0.12).addScaledVector(_beamFwd, 0.75);
            st.orb.scale.setScalar((0.006 + cp * 0.04) * flick);
            (st.orb.material as THREE.MeshBasicMaterial).color.copy(sColor).lerp(new THREE.Color(0xffffff), 0.4 + 0.5 * cp);
          }
          viewmodelAnimRef.current.recoilRotX += 0.0012 * cp;
          viewmodelAnimRef.current.recoilRotY += (Math.random() - 0.5) * 0.002 * cp;
        } else if (st.charge >= SHR1NKER_MIN_CHARGE && sAmmo > 0) {
          // ---- RELEASE: fire for twice the charged time ----
          const slot = currentSlotRef.current;
          ammoStockRef.current[slot] = sAmmo - 1;
          syncHudState();
          st.thick = st.charge / SHR1NKER_CHARGE_TIME;
          st.beamTotal = st.charge * SHR1NKER_BEAM_TIME_MUL;
          st.beamLeft = st.beamTotal;
          st.tick = 0;
          st.spark = 0;
          st.sfx = 0;
          st.textAcc = 0;
          st.textTimer = 0;
          st.charge = 0;
          if (st.orb) st.orb.visible = false;
          sound.playHeavyLaunch();
          viewmodelAnimRef.current.recoilPos.z += 0.08 + 0.08 * st.thick;
          viewmodelAnimRef.current.recoilRotX += 0.05;
          setAnnouncement(`SHR1NKER // BEAM ${st.beamTotal.toFixed(1)}s`);
        } else {
          if (st.charge > 0) setAnnouncement('CHARGE ABORTED // HOLD LONGER');
          if (st.active) setChargeGauge(null);
          st.active = false;
          st.charge = 0;
          if (st.orb) st.orb.visible = false;
        }
      }

      // 7.48 ARSENAL (新兵装の弾・設置物)
      arsenalCtx.time = clock.getElapsedTime();
      arsenalCtx.delta = delta;
      arsenalCtx.enemies = enemiesRef.current;
      arsenalCtx.covers = coverObjectsRef.current;
      arsenal.update(arsenalCtx);

      // 7.5 UPDATE 3D SPATIAL ATTACK EFFECTS (立体的な斬撃・超音速衝撃波・火花・空間照明)
      for (let f = spatialEffectsRef.current.length - 1; f >= 0; f--) {
        const fx = spatialEffectsRef.current[f];
        fx.lifetime -= delta;

        const progress = Math.min(1.0, Math.max(0, 1.0 - fx.lifetime / fx.maxLifetime));

        // 0. Weapon-specific custom animation hook
        if (fx.onUpdate) fx.onUpdate(progress, delta);

        // 1. Advance in 3D world space
        if (fx.direction && fx.forwardSpeed) {
          fx.mesh.position.addScaledVector(fx.direction, fx.forwardSpeed * delta);
          if (fx.light) {
            fx.light.position.copy(fx.mesh.position);
          }
        }

        // 2. Expand scale in 3D space
        if (fx.expansionRate) {
          const s = 1.0 + progress * fx.expansionRate;
          fx.mesh.scale.set(s, s, s);
        }

        // 3. Fade opacity & point light in 3D
        //    Each material keeps its own authored opacity (layered auras / cores / halos stay distinct);
        //    the effect holds full strength briefly, then eases out.
        const fade = Math.max(0, fx.lifetime / fx.maxLifetime);
        const fadeK = fade > 0.6 ? 1 : Math.pow(fade / 0.6, 1.25);
        fx.mesh.traverse((child) => {
          const mat = (child as any).material as THREE.Material | undefined;
          if (mat && !Array.isArray(mat)) {
            if (mat.userData.fxBaseOpacity === undefined) mat.userData.fxBaseOpacity = mat.opacity;
            mat.opacity = mat.userData.fxBaseOpacity * fadeK;
          }
        });
        if (fx.light) {
          // a pooled light may have been handed to a newer effect: only its current owner drives it
          if (fx.lightOwner === undefined) fx.lightOwner = fx.light.userData.ownerId ?? 0;
          if (!fx.light.userData.pooled || fx.light.userData.ownerId === fx.lightOwner) fx.light.intensity = fadeK * 3.8;
        }

        // 4. Update 3D particles (true 3D velocity and gravity)
        for (let p = fx.particles.length - 1; p >= 0; p--) {
          const part = fx.particles[p];
          part.mesh.position.addScaledVector(part.velocity, delta);
          part.velocity.y -= part.gravity * delta;
          if ((part.mesh.material as any)) {
            (part.mesh.material as any).opacity = Math.max(0, (part.mesh.material as any).opacity - part.decay * delta);
          }
          if (fx.lifetime <= 0) {
            scene.remove(part.mesh);
            part.mesh.geometry.dispose();
          }
        }

        if (fx.lifetime <= 0) {
          scene.remove(fx.mesh);
          fx.mesh.traverse((child) => {
            if ((child as any).geometry) (child as any).geometry.dispose();
            if ((child as any).material) (child as any).material.dispose();
          });
          if (fx.light) {
            if (fx.light.userData.pooled) {
              if (fx.light.userData.ownerId === fx.lightOwner) fx.light.intensity = 0;
            } else {
              scene.remove(fx.light);
              fx.light.dispose();
            }
          }
          spatialEffectsRef.current.splice(f, 1);
        }
      }

      // 8. DYNAMITE PHYSICAL PROJECTILES
      for (let d = dynamiteProjectilesRef.current.length - 1; d >= 0; d--) {
        const proj = dynamiteProjectilesRef.current[d];
        proj.lifetime -= delta;
        proj.velocity.y -= 25 * delta;
        proj.mesh.position.addScaledVector(proj.velocity, delta);
        proj.mesh.rotation.x += 6 * delta;

        let exploded = false;
        if (proj.mesh.position.y <= 0.3 || proj.lifetime <= 0) {
          exploded = true;
        } else {
          for (let e = 0; e < enemiesRef.current.length; e++) {
            const enemy = enemiesRef.current[e];
            if (enemy.isDead) continue;
            const hitbox = getEnemyHitbox(enemy, _enemyCenter);
            if (proj.mesh.position.distanceTo(_enemyCenter) < hitbox.radius + 0.45) {
              exploded = true;
              break;
            }
          }
        }

        if (exploded) {
          sound.playEnemyExplode();
          const impactPos = proj.mesh.position.clone();
          const isStun = proj.kind === 'stun';
          const aoeRadius = THROW_PROFILE[proj.kind].radius;

          // 爆発パーティクル (火球・衝撃波・煙・破片 / PALCER は閃光とスパーク)
          const fx = buildExplosionFx(proj.kind, scene, impactPos, aoeRadius, acquireFxLight);
          spatialEffectsRef.current.push({
            mesh: fx.group,
            light: fx.light,
            particles: fx.particles,
            lifetime: fx.lifetime,
            maxLifetime: fx.lifetime,
            onUpdate: fx.onUpdate,
          });

          let enemiesHit = 0;
          enemiesRef.current.forEach((en) => {
            if (en.isDead) return;
            const hitbox = getEnemyHitbox(en, _enemyCenter);
            const dist = impactPos.distanceTo(_enemyCenter);
            if (dist <= aoeRadius) {
              enemiesHit++;
              if (isStun) {
                // PALCER: 少量のダメージ + 3秒間の行動不能 (ボス/タイタンは半減)
                const dmg = Math.round(proj.damage * (1 - dist / (aoeRadius * 2)));
                en.hp -= dmg;
                battleStats.current.damageDealt += dmg;
                const big = en.category === 'boss' || en.category === 'titan';
                const stunSec = big ? PALCER_STUN_SEC * 0.5 : PALCER_STUN_SEC;
                // 協力プレイのゲスト: 敵の人形は動かさないので、ホストへスタンを報告する
                if (en.isPuppet) en.stunReq = Math.max(en.stunReq ?? 0, stunSec);
                else en.stunTimer = Math.max(en.stunTimer ?? 0, stunSec);
                en.velocity.set(0, 0, 0);
                en.attackCooldown = Math.max(en.attackCooldown, 0.6);
                spawnDamageText(`STUN! -${dmg}`, '#67e8f9');
                spawn3DHitSparks(en.mesh.position.clone().add(new THREE.Vector3(0, 1.2, 0)), '#e0f2fe', 14);
                return;
              }
              const dmg = Math.round(proj.damage * (1 - dist / (aoeRadius * 1.35)));
              en.hp -= dmg;
              battleStats.current.damageDealt += dmg;
              const push = _enemyCenter.clone().sub(impactPos).normalize().multiplyScalar(10);
              push.y = 3.5;
              en.velocity.add(push);
              spawnDamageText(`BLAST! -${dmg}`, '#f59e0b');
            }
          });

          if (enemiesHit > 0) {
            setAnnouncement(isStun ? `PALCER STUN // ${enemiesHit} TARGETS` : `DYNAMITE BLAST // ${enemiesHit} HITS`);
            setHitMarkerActive(true);
            setTimeout(() => setHitMarkerActive(false), 100);
          }

          scene.remove(proj.mesh);
          dynamiteProjectilesRef.current.splice(d, 1);
        }
      }

      // 8.1. UPDATE GRAVITY WELLS (SINGULARITY / ハンマー重力場)
      for (let g = gravityWellsRef.current.length - 1; g >= 0; g--) {
        const well = gravityWellsRef.current[g];
        well.lifetime -= delta;
        well.mesh.rotation.z += 4.5 * delta;

        // Visual pulsing animation
        const pulse = 1.0 + 0.14 * Math.sin(well.lifetime * 14);
        well.mesh.scale.set(pulse, pulse, pulse);

        // Pull nearby enemies inward
        const pullPower = well.pullPower ?? 22.0;
        enemiesRef.current.forEach((en) => {
          if (en.isDead) return;
          const dist = en.mesh.position.distanceTo(well.position);
          if (dist <= well.radius && dist > 0.4) {
            const toCenter = well.position.clone().sub(en.mesh.position).normalize();
            toCenter.y = 0.15;
            en.velocity.addScaledVector(toCenter, pullPower * delta * (1 - dist / (well.radius * 1.4)));
          }
        });

        // Explode on duration expiration
        if (well.lifetime <= 0) {
          sound.playEnemyExplode();
          const boomPos = well.position.clone();

          // Shockwave floor ring
          if (sceneRef.current) {
            const ringGeo = new THREE.RingGeometry(0.5, well.radius * 0.9, 24);
            const ringMat = new THREE.MeshBasicMaterial({ color: 0xa855f7, side: THREE.DoubleSide });
            const shockRing = new THREE.Mesh(ringGeo, ringMat);
            shockRing.rotation.x = Math.PI / 2;
            shockRing.position.set(boomPos.x, 0.1, boomPos.z);
            sceneRef.current.add(shockRing);
            setTimeout(() => { sceneRef.current?.remove(shockRing); ringGeo.dispose(); ringMat.dispose(); }, 240);
          }

          enemiesRef.current.forEach((en) => {
            if (en.isDead) return;
            const d = en.mesh.position.distanceTo(boomPos);
            if (d <= well.radius) {
              const dmg = Math.round(well.damage * (1 - d / (well.radius * 1.25)));
              en.hp -= dmg;
              battleStats.current.damageDealt += dmg;
              spawnDamageText(`SINGULARITY BURST! -${dmg}`, '#a855f7');

              const outward = en.mesh.position.clone().sub(boomPos).normalize();
              outward.y = 0.5;
              const pushForce = well.hasShockwave ? 32 : 18;
              en.velocity.addScaledVector(outward, pushForce);
              if (well.hasShockwave) {
                const extraDmg = Math.round(dmg * 0.45);
                en.hp -= extraDmg;
                battleStats.current.damageDealt += extraDmg;
                spawnDamageText(`SHOCKWAVE! -${extraDmg}`, '#f97316');
              }
            }
          });

          scene.remove(well.mesh);
          well.mesh.traverse((c) => {
            if ((c as any).geometry) (c as any).geometry.dispose();
            if ((c as any).material) (c as any).material.dispose();
          });
          gravityWellsRef.current.splice(g, 1);
        }
      }

      // 8.2. UPDATE CLUSTER BOMBLETS (HYDRA小型爆弾)
      for (let b = clusterBombletsRef.current.length - 1; b >= 0; b--) {
        const bomblet = clusterBombletsRef.current[b];
        bomblet.lifetime -= delta;
        bomblet.velocity.y -= 22 * delta;
        bomblet.mesh.position.addScaledVector(bomblet.velocity, delta);

        let exploded = false;
        if (bomblet.mesh.position.y <= 0.2 || bomblet.lifetime <= 0) {
          exploded = true;
        } else {
          for (let e = 0; e < enemiesRef.current.length; e++) {
            const en = enemiesRef.current[e];
            if (en.isDead) continue;
            if (bomblet.mesh.position.distanceTo(en.mesh.position) <= 1.2) {
              exploded = true;
              break;
            }
          }
        }

        if (exploded) {
          sound.playEnemyHit();
          const blastPos = bomblet.mesh.position.clone();
          const blastRad = bomblet.blastRadius ?? 4.5;

          spawn3DHitSparks(blastPos, '#f59e0b', 16);

          enemiesRef.current.forEach((en) => {
            if (en.isDead) return;
            const d = en.mesh.position.distanceTo(blastPos);
            if (d <= blastRad) {
              const dScale = 1 - d / (blastRad * 1.3);
              const dmg = Math.round(bomblet.damage * Math.max(0.4, dScale));
              en.hp -= dmg;
              battleStats.current.damageDealt += dmg;
              const push = en.mesh.position.clone().sub(blastPos).normalize();
              push.y = 0.35;
              en.velocity.addScaledVector(push, 10);
              spawnDamageText(`BOMBLET! -${dmg}`, '#f59e0b');
            }
          });

          if (bomblet.hasSecondary && Math.random() < 0.5) {
            spawn3DHitSparks(blastPos.clone().add(new THREE.Vector3(0, 0.4, 0)), '#fbbf24', 22);
            enemiesRef.current.forEach((en) => {
              if (en.isDead) return;
              if (en.mesh.position.distanceTo(blastPos) <= blastRad * 1.2) {
                const secDmg = Math.round(bomblet.damage * 0.4);
                en.hp -= secDmg;
                battleStats.current.damageDealt += secDmg;
                spawnDamageText(`MINI BURST! -${secDmg}`, '#fbbf24');
              }
            });
          }

          scene.remove(bomblet.mesh);
          bomblet.mesh.geometry.dispose();
          clusterBombletsRef.current.splice(b, 1);
        }
      }

      // 8.3. UPDATE DRONE FUNNELS (HORNET SWARM自律追従射撃)
      for (let d = 0; d < droneFunnelsRef.current.length; d++) {
        const drone = droneFunnelsRef.current[d];
        const orbitSpeed = 1.4;
        const currentAngle = clock.getElapsedTime() * orbitSpeed + drone.angleOffset;
        const orbitRadius = 2.0;

        // Hover in 3D around player regardless of active weapon
        const targetX = playerPos.current.x + Math.cos(currentAngle) * orbitRadius;
        const targetZ = playerPos.current.z + Math.sin(currentAngle) * orbitRadius;
        const targetY = playerPos.current.y + 1.6 + Math.sin(clock.getElapsedTime() * 3.0 + drone.angleOffset) * 0.25;

        drone.mesh.position.lerp(new THREE.Vector3(targetX, targetY, targetZ), delta * 12);
        drone.mesh.rotation.y += 2.8 * delta;

        // Search for nearest enemy target
        let nearestEn: EnemyInstance | null = null;
        let nearestDist = 28.0;
        enemiesRef.current.forEach((en) => {
          if (en.isDead) return;
          const dist = en.mesh.position.distanceTo(drone.mesh.position);
          if (dist < nearestDist) {
            nearestDist = dist;
            nearestEn = en;
          }
        });

        if (nearestEn) {
          drone.mesh.lookAt((nearestEn as EnemyInstance).mesh.position.clone().add(new THREE.Vector3(0, 0.8, 0)));
        }

        drone.lifetime -= delta;
        if (drone.lifetime <= 0 && sceneRef.current) {
          spawn3DHitSparks(drone.mesh.position.clone(), '#06b6d4', 10);
          sceneRef.current.remove(drone.mesh);
          drone.mesh.traverse((c) => {
            if ((c as any).geometry) (c as any).geometry.dispose();
            if ((c as any).material) (c as any).material.dispose();
          });
          droneFunnelsRef.current.splice(d, 1);
          d--;
          continue;
        }

        drone.shootCooldown -= delta;
        if (drone.shootCooldown <= 0 && nearestEn && sceneRef.current) {
          const shootInterval = hasSkill('funnel_mod_rate') ? 0.5 : 0.8;
          drone.shootCooldown = shootInterval;
          sound.playHandgunShot();

          const muzzle = drone.mesh.position.clone();
          const targetLoc = (nearestEn as EnemyInstance).mesh.position.clone().add(new THREE.Vector3(0, 0.8, 0));
          const shootDir = targetLoc.sub(muzzle).normalize();

          const bGeo = new THREE.SphereGeometry(0.08, 6, 6);
          const bMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4 });
          const bMesh = new THREE.Mesh(bGeo, bMat);
          bMesh.position.copy(muzzle);
          sceneRef.current.add(bMesh);

          bulletsRef.current.push({
            mesh: bMesh,
            direction: shootDir,
            speed: 90,
            damage: drone.damage,
            lifetime: 2.2,
            isPlayer: true,
            prevPosition: muzzle.clone(),
            bulletRadius: 0.3,
          });

          spawn3DHitSparks(muzzle, '#06b6d4', 6);
        }
      }

      // 8.9 TELEGRAPHED HAZARDS / BEAMS
      combatCtx.time = clock.getElapsedTime();
      combatCtx.delta = delta;
      combatCtx.enemies = enemiesRef.current;
      combatCtx.playerYaw = currentRotation.current.yaw;
      if (coop) {
        coop.update(delta);
        if (playerHpRef.current <= 0 && !koRef.current) onLocalHpZero();
        if (coop.isHost && !battleFinished && coop.allDown(koRef.current)) handleBattleEnd(false);
      }
      // 8.8 VITALIS HEAL DRONE
      {
        const hw = getActiveWeapon();
        const holding = hw.id === 'sub_vitalis' && !koRef.current && !battleFinished;
        if (holding) {
          if (!healDrone) healDrone = new HealDrone(scene);
          const eye = playerPos.current;
          HealDrone.hoverPoint(eye, currentRotation.current.yaw, healAnchor);
          // 回復対象: 範囲内でHPが減っている味方を、HPの割合が低い順に最大 beams 人 (回復中の人は少し遠くても維持)
          const beams = vitalisWide ? HEAL_DRONE_MAX_BEAMS : 1;
          const rng = vitalisWide ? HEAL_DRONE_RANGE_WIDE : HEAL_DRONE_RANGE;
          const rngHold = vitalisWide ? HEAL_DRONE_RANGE_HOLD_WIDE : HEAL_DRONE_RANGE_HOLD;
          type Ally = NonNullable<typeof coop>['remoteList'][number];
          const picked: Ally[] = [];
          if (coop) {
            const cands: { r: Ally; score: number }[] = [];
            for (const r of coop.remoteList) {
              if (r.ko || !r.seen || r.hp >= r.maxHp) continue;
              const had = healTargetIds.includes(r.id);
              if (Math.hypot(r.eye.x - eye.x, r.eye.y - eye.y, r.eye.z - eye.z) > (had ? rngHold : rng)) continue;
              cands.push({ r, score: r.hp / Math.max(1, r.maxHp) - (had ? 0.08 : 0) });
            }
            cands.sort((a, b) => a.score - b.score);
            for (const c of cands.slice(0, beams)) picked.push(c.r);
          }
          const ids: string[] = picked.map((r) => r.id);
          const targets: THREE.Vector3[] = [];
          picked.forEach((r, i) => {
            healTargetPos[i].set(r.eye.x, r.eye.y - 0.55, r.eye.z);
            targets.push(healTargetPos[i]);
            const amt = vitalisPercent ? HEAL_DRONE_PCT * r.maxHp : HEAL_DRONE_HPS;
            healSendAmt.set(r.id, (healSendAmt.get(r.id) ?? 0) + amt * delta);
          });
          for (const k of [...healSendAmt.keys()]) if (!ids.includes(k)) healSendAmt.delete(k);
          healSendAcc += delta;
          if (healSendAcc >= 0.25) {
            healSendAcc = 0;
            healSendAmt.forEach((v, id) => coop?.sendHeal(id, v));
            healSendAmt.clear();
          }
          // 枠が空いていて自分のHPが減っていれば、自分も回復する
          const healSelf = picked.length < beams && playerHpRef.current < maxHpRef.current;
          if (healSelf) {
            healTargetPos[picked.length].set(eye.x, eye.y - 0.55, eye.z);
            targets.push(healTargetPos[picked.length]);
            ids.push(netSession?.myId ?? 'self');
            const selfAmt = vitalisPercent ? HEAL_DRONE_PCT * maxHpRef.current : HEAL_DRONE_HPS;
            playerHpRef.current = Math.min(maxHpRef.current, playerHpRef.current + selfAmt * delta);
            const nowMs = performance.now();
            if (nowMs - lastShieldHudSyncRef.current > 66 || playerHpRef.current >= maxHpRef.current) {
              lastShieldHudSyncRef.current = nowMs;
              syncHudState();
            }
          }
          healTargetIds = picked.map((r) => r.id);
          healDrone.update(delta, healAnchor, targets);
          healDroneInfo = { x: healAnchor.x, y: healAnchor.y, z: healAnchor.z, target: ids };
        } else if (healDrone) {
          healDrone.dispose();
          healDrone = null;
          healDroneInfo = null;
          healTargetIds = [];
          healSendAcc = 0;
          healSendAmt.clear();
        }
      }
      const hazardTargets = coop?.isHost
        ? coop.remoteList.filter((r) => !r.ko && r.seen).map((r) => ({ pos: r.eye, hurt: remoteHurt(r.id) }))
        : undefined;
      hazards.update(delta, combatCtx.time, playerPos.current, hurtPlayer, hazardTargets);
      minionsSpawnedThisFrame = 0;

      // 9. ENEMY AI
      let livingCount = 0;
      const stepEnemy = (enemy: EnemyInstance) => {
        if (enemy.isDead) return;

        // HELIX FLARE: a marked enemy takes extra damage from every hit that landed this frame
        if ((enemy.vulnTimer ?? 0) > 0) {
          enemy.vulnTimer = (enemy.vulnTimer ?? 0) - delta;
          if (enemy.vulnPrevHp !== undefined && enemy.hp < enemy.vulnPrevHp) {
            const extra = (enemy.vulnPrevHp - enemy.hp) * (enemy.vulnMul ?? 0.25);
            enemy.hp -= extra;
            battleStats.current.damageDealt += extra;
          }
        }
        enemy.vulnPrevHp = enemy.hp;

        // APEX: frontal shield / deflect / rewind tracking act on this frame's damage before the death check
        if (isApexCategory(enemy.category) && !enemy.isPuppet) {
          apexDamageGate(enemy, combatCtx, Math.hypot(playerPos.current.x - enemy.mesh.position.x, playerPos.current.z - enemy.mesh.position.z));
        }

        if (enemy.hp <= 0 && !enemy.isPuppet) {
          enemy.isDead = true;
          if (isApexCategory(enemy.category)) apexOnDeath(enemy, combatCtx);
          sound.playEnemyExplode();
          scene.remove(enemy.mesh);
          if (enemy.groundRingMesh) {
            scene.remove(enemy.groundRingMesh);
            enemy.groundRingMesh.geometry.dispose();
          }
          if (enemy.sniperLaserLine) {
            scene.remove(enemy.sniperLaserLine);
            enemy.sniperLaserLine.geometry.dispose();
            (enemy.sniperLaserLine.material as any).dispose();
            enemy.sniperLaserLine = undefined;
          }
          if (enemy.telegraphMesh) {
            scene.remove(enemy.telegraphMesh);
            enemy.telegraphMesh.geometry.dispose();
            (enemy.telegraphMesh.material as any).dispose();
            enemy.telegraphMesh = undefined;
          }
          disposeEnemyAux(enemy, scene);
          if (enemy.category === 'boss') disposeBossPattern(enemy, combatCtx);
          // HIVE CARRIER: the brood sac bursts and releases its last mites
          if (enemy.typeId === 'carrier') {
            const at = enemy.mesh.position.clone().setY(0);
            hazards.ringFx(at.x, at.z, 5, 0xbef264, 0.6);
            hazards.columnFx(at.x, at.z, 1.6, 6, 0xa3e635, 0.6);
            spawn3DHitSparks(enemy.mesh.position.clone(), '#bef264', 28);
            for (let m = 0; m < 3; m++) {
              const a = (m / 3) * Math.PI * 2;
              spawnMinion('mite', new THREE.Vector3(at.x + Math.cos(a) * 1.4, 0, at.z + Math.sin(a) * 1.4));
            }
          }
          // Nanoswarm contagion: If infected enemy dies, spread infection to nearest living enemies
          if ((enemy.naniteDotTimer ?? 0) > 0) {
            const maxInfections = hasSkill('nanoswarm_mod_chains') ? 3 : 1;
            const spreadRad = hasSkill('nanoswarm_mod_radius') ? 16.0 : 10.0;
            let infectedCount = 0;
            enemiesRef.current.forEach((other) => {
              if (other !== enemy && !other.isDead && infectedCount < maxInfections) {
                if (other.mesh.position.distanceTo(enemy.mesh.position) <= spreadRad) {
                  other.naniteDotTimer = (other.naniteDotTimer ?? 0) + 5.0;
                  other.naniteDotDamage = enemy.naniteDotDamage ?? 18;
                  other.naniteStacks = Math.max(1, (enemy.naniteStacks ?? 1) - 1);
                  other.naniteNextTick = 0.3;
                  infectedCount++;
                  spawnDamageText('NANITE SPREAD!', '#10b981');
                  spawn3DHitSparks(other.mesh.position.clone().add(new THREE.Vector3(0, 0.8, 0)), '#10b981', 14);
                }
              }
            });
          }

          // Arc Chain Gun discharge when shocked enemy dies (arc_mod_discharge)
          if ((enemy.shockTimer ?? 0) > 0) {
            sound.playSweepAttack();
            const shockDischargeRad = 9.0;
            const dischargeDmg = hasSkill('arc_mod_discharge') ? 55 : 35;
            enemiesRef.current.forEach((other) => {
              if (other !== enemy && !other.isDead) {
                if (other.mesh.position.distanceTo(enemy.mesh.position) <= shockDischargeRad) {
                  other.hp -= dischargeDmg;
                  other.shockTimer = 2.0;
                  battleStats.current.damageDealt += dischargeDmg;
                  spawnDamageText(`OVERLOAD DISCHARGE! -${dischargeDmg}`, '#06b6d4');
                  spawn3DHitSparks(other.mesh.position.clone().add(new THREE.Vector3(0, 0.8, 0)), '#06b6d4', 16);
                }
              }
            });
          }

          battleStats.current.kills++;
          killsRef.current++;

          const scrapGeo = new THREE.OctahedronGeometry(0.25, 0);
          const scrapMat = new THREE.MeshBasicMaterial({ color: 0x0284c7, wireframe: true });
          const scrapMesh = new THREE.Mesh(scrapGeo, scrapMat);
          scrapMesh.position.copy(enemy.mesh.position);
          scrapMesh.position.y = 0.5;
          scene.add(scrapMesh);

          scrapDropsRef.current.push({
            mesh: scrapMesh,
            amount: enemy.scrapValue,
            position: scrapMesh.position.clone(),
          });

          // BEACON は稀にドロップ (強い敵ほど出やすい)
          const beaconChance = enemy.typeId === 'mite' ? 0 : BEACON_DROP_CHANCE[enemy.category] ?? 0.03;
          if (Math.random() < beaconChance) {
            const beaconMesh = new THREE.Mesh(
              new THREE.OctahedronGeometry(0.35, 0),
              new THREE.MeshBasicMaterial({ color: 0xfbbf24, wireframe: true }),
            );
            beaconMesh.position.copy(enemy.mesh.position);
            beaconMesh.position.x += 0.8;
            beaconMesh.position.y = 0.7;
            scene.add(beaconMesh);
            scrapDropsRef.current.push({
              mesh: beaconMesh,
              amount: 0,
              beacon: enemy.category === 'boss' || enemy.category === 'titan' ? 1 + Math.floor(Math.random() * 3) : 1,
              position: beaconMesh.position.clone(),
            });
          }
          return;
        }

        livingCount++;

        // Status Effects 1: Nanite DoT Tick Damage
        if ((enemy.naniteDotTimer ?? 0) > 0) {
          enemy.naniteDotTimer = (enemy.naniteDotTimer ?? 0) - delta;
          enemy.naniteNextTick = (enemy.naniteNextTick ?? 0.5) - delta;
          if (enemy.naniteNextTick <= 0) {
            enemy.naniteNextTick = 0.5;
            let dotDmg = Math.round((enemy.naniteDotDamage ?? 18) * [1, 1.5, 2.0][Math.max(0, Math.min(2, (enemy.naniteStacks ?? 1) - 1))]);
            if (hasSkill('nanoswarm_mod_dot')) {
              dotDmg = Math.round(dotDmg * 1.6);
            }
            enemy.hp -= dotDmg;
            battleStats.current.damageDealt += dotDmg;
            spawnDamageText(`NANITE -${dotDmg}`, '#10b981');
            spawn3DHitSparks(enemy.mesh.position.clone().add(new THREE.Vector3(0, 0.8, 0)), '#10b981', 6);
          }
        }

        if ((enemy.naniteDotTimer ?? 0) <= 0) enemy.naniteStacks = 0;

        // Status Effects 1b: Burn (SOLAR FLARE / REAPER)
        if ((enemy.burnTimer ?? 0) > 0) {
          const burnDelta = Math.min(delta, enemy.burnTimer ?? 0);
          enemy.burnTimer = (enemy.burnTimer ?? 0) - delta;
          const burnDmg = (enemy.burnDps ?? 0) * burnDelta;
          enemy.hp -= burnDmg;
          battleStats.current.damageDealt += burnDmg;
          enemy.burnTextTimer = (enemy.burnTextTimer ?? 0.5) - delta;
          if (enemy.burnTextTimer <= 0) {
            enemy.burnTextTimer = 0.5;
            spawnDamageText(`BURN -${Math.round((enemy.burnDps ?? 0) * 0.5)}`, '#f97316');
            spawn3DHitSparks(enemy.mesh.position.clone().add(new THREE.Vector3(0, 0.8, 0)), '#f97316', 5);
          }
          if ((enemy.burnTimer ?? 0) <= 0) enemy.burnDps = 0;
        }

        // Status Effects 1c: Bleed (RAVAGER-09)
        if ((enemy.bleedTimer ?? 0) > 0) {
          const bleedDelta = Math.min(delta, enemy.bleedTimer ?? 0);
          enemy.bleedTimer = (enemy.bleedTimer ?? 0) - delta;
          const bleedDmg = (enemy.bleedDps ?? 0) * bleedDelta;
          enemy.hp -= bleedDmg;
          battleStats.current.damageDealt += bleedDmg;
          enemy.bleedTextTimer = (enemy.bleedTextTimer ?? 0.5) - delta;
          if (enemy.bleedTextTimer <= 0) {
            enemy.bleedTextTimer = 0.5;
            spawnDamageText(`BLEED -${Math.round((enemy.bleedDps ?? 0) * 0.5)}`, '#dc2626');
            spawn3DHitSparks(enemy.mesh.position.clone().add(new THREE.Vector3(0, 0.8, 0)), '#dc2626', 5);
          }
          if ((enemy.bleedTimer ?? 0) <= 0) enemy.bleedDps = 0;
        }

        // Freeze immunity cooldown (GLACIER)
        if ((enemy.freezeImmuneTimer ?? 0) > 0) {
          enemy.freezeImmuneTimer = (enemy.freezeImmuneTimer ?? 0) - delta;
        }

        // Status Effects 2: Shock Timer Tick
        if ((enemy.shockTimer ?? 0) > 0) {
          enemy.shockTimer = (enemy.shockTimer ?? 0) - delta;
        }

        // CO-OP (ゲスト): ホストの敵の人形。状態異常のダメージ以外は動かさず、スナップショットに追従させる
        if (enemy.isPuppet) {
          enemy.velocity.set(0, 0, 0);
          coop?.stepPuppet(enemy as unknown as CoopEnemy, delta);
          // PALCER: ホストの敵がスタン中なら、人形にもスパークを出す (残り秒数はスナップショットで更新される)
          if ((enemy.stunTimer ?? 0) > 0) {
            enemy.stunTimer = (enemy.stunTimer ?? 0) - delta;
            if (Math.random() < delta * 2.5) {
              spawn3DHitSparks(enemy.mesh.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.8, 1.6 + Math.random() * 0.5, (Math.random() - 0.5) * 0.8)), '#bae6fd', 3);
            }
          }
          if (enemy.groundRingMesh) enemy.groundRingMesh.position.set(enemy.mesh.position.x, 0.04, enemy.mesh.position.z);
          if (enemy.overheadGroup) enemy.overheadGroup.quaternion.copy(camera.quaternion);
          if (enemy.hpBarMesh) {
            const hpRatio = Math.max(0.001, Math.min(1.0, enemy.hp / enemy.maxHp));
            enemy.hpBarMesh.scale.x = hpRatio;
            enemy.hpBarMesh.position.x = -(1.34 * (1 - hpRatio)) / 2;
          }
          const puppetAnim = { mesh: enemy.mesh, shootCooldown: 1, attackCooldown: 1, near: false };
          if (enemy.category === 'boss') {
            const phase = enemy.bossPhase ?? 1;
            animateBoss(enemy.mesh, clock.getElapsedTime(), delta, phase);
            const bossRig = enemy.mesh.userData.bossRefs?.rig as THREE.Object3D | undefined;
            if (bossRig) animateBossMotion(puppetAnim, bossRig, clock.getElapsedTime(), delta, phase);
          } else {
            animateEnemy(puppetAnim, clock.getElapsedTime(), delta);
          }
          return;
        }

        // PALCER stun: 完全に行動不能 (凍結と違い被ダメージ増加なし)
        if ((enemy.stunTimer ?? 0) > 0) {
          enemy.stunTimer = (enemy.stunTimer ?? 0) - delta;
          enemy.velocity.set(0, 0, 0);
          if (Math.random() < delta * 2.5) {
            spawn3DHitSparks(enemy.mesh.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.8, 1.6 + Math.random() * 0.5, (Math.random() - 0.5) * 0.8)), '#bae6fd', 3);
          }
          return;
        }

        // Status Effects 3: Frozen immobilization
        if ((enemy.frozenTimer ?? 0) > 0) {
          enemy.frozenTimer = (enemy.frozenTimer ?? 0) - delta;
          enemy.velocity.set(0, 0, 0);
          // Frozen enemy is completely paralyzed and cannot act
          return;
        }

        // Status Effects 4: Chill slow down (50% speed penalty)
        let enemySpeedMultiplier = 1.0;
        if ((enemy.chillSlowTimer ?? 0) > 0) {
          enemy.chillSlowTimer = (enemy.chillSlowTimer ?? 0) - delta;
          enemySpeedMultiplier = 0.50;
          if ((enemy.chillSlowTimer ?? 0) <= 0) enemy.chillHits = 0;
        }

        // ANCHRON-G2 mooring: marked targets are slowed, rooted targets cannot move
        if ((enemy.mooredTimer ?? 0) > 0) {
          enemy.mooredTimer = (enemy.mooredTimer ?? 0) - delta;
          enemySpeedMultiplier = Math.min(enemySpeedMultiplier, 0.4);
        }
        if ((enemy.rootTimer ?? 0) > 0) {
          enemy.rootTimer = (enemy.rootTimer ?? 0) - delta;
          enemy.velocity.x = 0;
          enemy.velocity.z = 0;
          enemySpeedMultiplier = 0;
        }

        // Update high-visibility overhead HUD and ground hazard ring
        if (enemy.groundRingMesh) {
          enemy.groundRingMesh.position.set(enemy.mesh.position.x, 0.04, enemy.mesh.position.z);
        }
        if (enemy.overheadGroup && cameraRef.current) {
          enemy.overheadGroup.quaternion.copy(cameraRef.current.quaternion);
        }
        if (enemy.hpBarMesh) {
          const hpRatio = Math.max(0.001, Math.min(1.0, enemy.hp / enemy.maxHp));
          enemy.hpBarMesh.scale.x = hpRatio;
          enemy.hpBarMesh.position.x = -(1.34 * (1 - hpRatio)) / 2;
        }

        // ================= DYNAMIC AI PATTERN MACHINE (敵種別・ランダム化行動制御) =================
        _toEnemy.subVectors(playerPos.current, enemy.mesh.position);
        _toEnemy.y = 0;
        const dist = _toEnemy.length();

        // BOSS: enrage phases at 66% / 33% HP (faster, harder-hitting, new attack patterns)
        let bossPhaseNow = 1;
        if (enemy.category === 'boss') {
          const hpR = enemy.hp / enemy.maxHp;
          bossPhaseNow = hpR > 0.66 ? 1 : hpR > 0.33 ? 2 : 3;
          if (bossPhaseNow !== (enemy.bossPhase ?? 1)) {
            const rising = bossPhaseNow > (enemy.bossPhase ?? 1);
            enemy.bossPhase = bossPhaseNow;
            enemy.speed = enemy.baseSpeed * (1 + 0.22 * (bossPhaseNow - 1));
            if (rising) {
              enemy.damage = Math.round(enemy.damage * 1.12);
              enemy.patternTimer = 0;
              enemy.bossState = -1;
              enemy.attackCooldown = Math.max(enemy.attackCooldown, 1.0);
              sound.playHeavyLaunch();
              sound.playEnemyExplode();
              spawn3DHitSparks(enemy.mesh.position.clone().add(new THREE.Vector3(0, 6, 0)), bossPhaseNow === 3 ? '#ef4444' : '#f59e0b', 36);
              setAnnouncement(bossPhaseNow === 3 ? '⚠ BOSS PHASE 3 // 最終形態：暴走状態 ⚠' : '⚠ BOSS PHASE 2 // 戦闘強化モード起動 ⚠');
            }
          }
          animateBoss(enemy.mesh, clock.getElapsedTime(), delta, bossPhaseNow);
        }

        // 1. Tactical Behavior Transition Timer & Randomized Selector
        // (elite units run their own state machines; bosses pick from their pattern pools)
        const apex = isApexCategory(enemy.category);
        const elite = isEliteCategory(enemy.category) || apex;
        if (!elite) {
          enemy.patternTimer -= delta;
          enemy.actionSubTimer += delta;
        }

        if (!elite && enemy.patternTimer <= 0 && enemy.category === 'boss') {
          chooseBossPattern(enemy, combatCtx, dist);
        } else if (!elite && enemy.patternTimer <= 0) {
          // Clean up any ongoing telegraph or sniper laser
          if (enemy.sniperLaserLine && sceneRef.current) {
            sceneRef.current.remove(enemy.sniperLaserLine);
            enemy.sniperLaserLine.geometry.dispose();
            (enemy.sniperLaserLine.material as any).dispose();
            enemy.sniperLaserLine = undefined;
          }
          if (enemy.telegraphMesh && sceneRef.current) {
            sceneRef.current.remove(enemy.telegraphMesh);
            enemy.telegraphMesh.geometry.dispose();
            (enemy.telegraphMesh.material as any).dispose();
            enemy.telegraphMesh = undefined;
          }

          enemy.actionSubTimer = 0;
          enemy.patternTimer = 2.0 + Math.random() * 2.8;
          enemy.strafeSign = Math.random() < 0.5 ? 1 : -1;
          const roll = Math.random();

          switch (enemy.category) {
            case 'hound':
              if (dist > 10.0) {
                enemy.aiPattern = roll < 0.70 ? 'charge' : 'flank';
              } else if (dist > 4.5) {
                enemy.aiPattern = roll < 0.50 ? 'charge' : roll < 0.80 ? 'stalk' : 'flank';
              } else {
                enemy.aiPattern = roll < 0.60 ? 'stalk' : 'charge';
              }
              break;

            case 'sentry':
              if (dist >= 8.5) {
                enemy.aiPattern = roll < 0.65 ? 'snipe' : roll < 0.88 ? 'burst' : 'reposition';
              } else {
                enemy.aiPattern = roll < 0.70 ? 'reposition' : 'burst';
              }
              break;

            case 'stalker':
              enemy.aiPattern = roll < 0.55 ? 'zigzag_rush' : roll < 0.80 ? 'shadow_fade' : 'flank';
              break;

            case 'golem':
              if (dist <= 7.0) {
                enemy.aiPattern = roll < 0.52 ? 'ground_slam' : roll < 0.80 ? 'ram_charge' : 'heavy_march';
              } else {
                enemy.aiPattern = roll < 0.60 ? 'ram_charge' : 'heavy_march';
              }
              break;

            case 'drone':
              enemy.aiPattern = roll < 0.45 ? 'dive_bomb' : roll < 0.80 ? 'hover_snipe' : 'erratic_strafe';
              break;

            case 'titan':
              enemy.aiPattern = roll < 0.45 ? 'artillery_mortar' : roll < 0.75 ? 'rocket_salvo' : 'suppression_fire';
              break;

            default:
              enemy.aiPattern = 'normal';
              break;
          }
        }

        // 2. Pattern Execution per Archetype
        if (enemy.category === 'drone') {
          // --- DRONE: ホバリング支援射撃 / 急降下爆撃 / 変則回避 ---
          if (enemy.aiPattern === 'dive_bomb') {
            // 急降下突進・低空掃射
            const diveY = 1.35 + Math.sin(enemy.actionSubTimer * 2.8) * 0.45;
            enemy.mesh.position.y = diveY;
            _toEnemy.normalize();
            enemy.velocity.addScaledVector(_toEnemy, enemy.speed * delta * 4.4);

            enemy.shootCooldown = (enemy.shootCooldown ?? 1.2) - delta;
            if (enemy.shootCooldown <= 0 && sceneRef.current) {
              enemy.shootCooldown = 0.55;
              const bGeo = new THREE.SphereGeometry(0.12, 6, 6);
              const bMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4 });
              const bMesh = new THREE.Mesh(bGeo, bMat);
              bMesh.position.copy(enemy.mesh.position);
              sceneRef.current.add(bMesh);
              const shootDir = playerPos.current.clone().sub(bMesh.position).normalize();
              bulletsRef.current.push({
                mesh: bMesh,
                direction: shootDir,
                speed: 34,
                damage: Math.round(enemy.damage * 0.85),
                lifetime: 3.0,
                isPlayer: false,
                prevPosition: bMesh.position.clone(),
                bulletRadius: 0.22,
              });
            }
          } else if (enemy.aiPattern === 'hover_snipe') {
            // 高高度ホバリング長距離射撃
            enemy.mesh.position.y = 4.2 + Math.sin(clock.getElapsedTime() * 2.2 + enemy.hp) * 0.25;
            if (dist > 11.0) {
              _toEnemy.normalize();
              enemy.velocity.addScaledVector(_toEnemy, enemy.speed * delta * 2.8);
            } else if (dist < 6.0) {
              _toEnemy.normalize();
              enemy.velocity.addScaledVector(_toEnemy, -enemy.speed * delta * 2.2);
            }
            const strafeDir = new THREE.Vector3().crossVectors(_toEnemy, _up).normalize();
            enemy.velocity.addScaledVector(strafeDir, enemy.strafeSign * enemy.speed * delta * 1.8);

            enemy.shootCooldown = (enemy.shootCooldown ?? 2.0) - delta;
            if (enemy.shootCooldown <= 0 && sceneRef.current) {
              enemy.shootCooldown = 1.8 + Math.random() * 0.6;
              const bGeo = new THREE.SphereGeometry(0.11, 6, 6);
              const bMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
              const bMesh = new THREE.Mesh(bGeo, bMat);
              bMesh.position.copy(enemy.mesh.position);
              sceneRef.current.add(bMesh);
              const shootDir = playerPos.current.clone().sub(bMesh.position).normalize();
              bulletsRef.current.push({
                mesh: bMesh,
                direction: shootDir,
                speed: 30,
                damage: enemy.damage,
                lifetime: 3.5,
                isPlayer: false,
                prevPosition: bMesh.position.clone(),
                bulletRadius: 0.22,
              });
            }
          } else {
          // Erratic / Normal strafe
          enemy.mesh.position.y = 2.8 + Math.sin(clock.getElapsedTime() * 2.6 + enemy.hp) * 0.35;
          if (dist > 9.5) {
            _toEnemy.normalize();
            enemy.velocity.addScaledVector(_toEnemy, enemy.speed * delta * 3.4);
          } else if (dist < 4.5) {
            _toEnemy.normalize();
            enemy.velocity.addScaledVector(_toEnemy, -enemy.speed * delta * 2.2);
          }
          const strafeDir = new THREE.Vector3().crossVectors(_toEnemy, _up).normalize();
          enemy.velocity.addScaledVector(strafeDir, Math.sin(clock.getElapsedTime() * 2.4 + enemy.speed) * enemy.speed * delta * 2.2);
          }

        } else if (enemy.category === 'sentry') {
          // --- SENTRY: 遠距離狙撃 (Precision Sniping) / 3連バースト / 戦術陣地転換 ---
          if (enemy.aiPattern === 'snipe') {
            // 遠距離狙撃: 移動を止め、照準レーザーを放射して狙いを定めた後、高威力・超高速弾を放つ
            enemy.velocity.multiplyScalar(0.45);

            const muzzlePos = enemy.mesh.position.clone().add(new THREE.Vector3(0, 0.7, 0));
            const targetPos = playerPos.current.clone().add(new THREE.Vector3(0, 0.9, 0));

            // Aiming beam visualization
            if (!enemy.sniperLaserLine && sceneRef.current) {
              const lineGeo = new THREE.BufferGeometry().setFromPoints([muzzlePos, targetPos]);
              const lineMat = new THREE.LineBasicMaterial({
                color: 0xef4444,
                transparent: true,
                opacity: 0.90,
                blending: THREE.AdditiveBlending,
              });
              const line = new THREE.Line(lineGeo, lineMat);
              sceneRef.current.add(line);
              enemy.sniperLaserLine = line;
            } else if (enemy.sniperLaserLine) {
              const posAttr = enemy.sniperLaserLine.geometry.attributes.position;
              posAttr.setXYZ(0, muzzlePos.x, muzzlePos.y, muzzlePos.z);
              posAttr.setXYZ(1, targetPos.x, targetPos.y, targetPos.z);
              posAttr.needsUpdate = true;
              (enemy.sniperLaserLine.material as THREE.LineBasicMaterial).opacity =
                0.5 + 0.5 * Math.sin(enemy.actionSubTimer * 16);
            }

            // Sniping shot trigger at 0.85s charge
            if (enemy.actionSubTimer >= 0.85) {
              if (enemy.sniperLaserLine && sceneRef.current) {
                sceneRef.current.remove(enemy.sniperLaserLine);
                enemy.sniperLaserLine.geometry.dispose();
                (enemy.sniperLaserLine.material as any).dispose();
                enemy.sniperLaserLine = undefined;
              }

              if (sceneRef.current) {
                const bGeo = new THREE.CylinderGeometry(0.06, 0.06, 1.4, 6);
                const bMat = new THREE.MeshBasicMaterial({ color: 0xff0044 });
                const bMesh = new THREE.Mesh(bGeo, bMat);
                bMesh.rotation.x = Math.PI / 2;
                bMesh.position.copy(muzzlePos);
                sceneRef.current.add(bMesh);

                const shootDir = playerPos.current.clone().sub(muzzlePos).normalize();
                bulletsRef.current.push({
                  mesh: bMesh,
                  direction: shootDir,
                  speed: 72,
                  damage: Math.round(enemy.damage * 1.6),
                  lifetime: 2.5,
                  isPlayer: false,
                  prevPosition: bMesh.position.clone(),
                  bulletRadius: 0.28,
                });
                sound.playHeavyLaunch();
              }
              enemy.aiPattern = 'reposition';
              enemy.patternTimer = 2.2;
              enemy.actionSubTimer = 0;
            }
          } else if (enemy.aiPattern === 'burst') {
            // 3-Round burst with lateral strafe
            if (dist > 7.0) {
              _toEnemy.normalize();
              enemy.velocity.addScaledVector(_toEnemy, enemy.speed * delta * 2.4);
            }
            const strafeDir = new THREE.Vector3().crossVectors(_toEnemy, _up).normalize();
            enemy.velocity.addScaledVector(strafeDir, enemy.strafeSign * enemy.speed * delta * 2.2);

            enemy.shootCooldown = (enemy.shootCooldown ?? 1.8) - delta;
            if (enemy.shootCooldown <= 0 && sceneRef.current) {
              enemy.shootCooldown = 1.9;
              for (let b = 0; b < 3; b++) {
                setTimeout(() => {
                  if (enemy.isDead || !sceneRef.current) return;
                  const muzzle = enemy.mesh.position.clone().add(new THREE.Vector3(0, 0.7, 0));
                  const bGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.7, 6);
                  const bMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
                  const bMesh = new THREE.Mesh(bGeo, bMat);
                  bMesh.rotation.x = Math.PI / 2;
                  bMesh.position.copy(muzzle);
                  sceneRef.current?.add(bMesh);
                  const sDir = playerPos.current.clone().sub(muzzle).normalize();
                  sDir.x += (Math.random() - 0.5) * 0.04;
                  sDir.z += (Math.random() - 0.5) * 0.04;
                  sDir.normalize();
                  bulletsRef.current.push({
                    mesh: bMesh,
                    direction: sDir,
                    speed: 42,
                    damage: Math.round(enemy.damage * 0.75),
                    lifetime: 3.0,
                    isPlayer: false,
                    prevPosition: bMesh.position.clone(),
                    bulletRadius: 0.22,
                  });
                }, b * 160);
              }
            }
          } else {
            // Reposition: Maintain tactical stand-off range (12m - 20m)
            _toEnemy.normalize();
            if (dist < 10.0) {
              enemy.velocity.addScaledVector(_toEnemy, -enemy.speed * delta * 2.8);
            } else if (dist > 18.0) {
              enemy.velocity.addScaledVector(_toEnemy, enemy.speed * delta * 2.4);
            }
            const strafeDir = new THREE.Vector3().crossVectors(_toEnemy, _up).normalize();
            enemy.velocity.addScaledVector(strafeDir, enemy.strafeSign * enemy.speed * delta * 2.4);
          }

        } else if (enemy.category === 'hound') {
          // --- HOUND: 近接突進 (Melee Charge) / 旋回包囲 (Circling Stalk) / 側面強襲 (Flank) ---
          if (enemy.aiPattern === 'charge') {
            // 近接高速突進！溜めからの爆発的ダッシュ
            if (enemy.actionSubTimer < 0.35) {
              // 0.35秒の溜め姿勢（速度低下・姿勢低下）
              enemy.velocity.multiplyScalar(0.6);
            } else {
              // 爆発的突進ラッシュ (速度 1.95倍)
              _toEnemy.normalize();
              enemy.velocity.addScaledVector(_toEnemy, enemy.speed * 1.95 * delta * 4.6);

              // 飛びかかり跳躍攻撃 (Pounce leap when close)
              if (dist <= 3.8 && enemy.actionSubTimer > 0.6) {
                enemy.velocity.y += 2.2;
                enemy.velocity.addScaledVector(_toEnemy, 6.0);
              }
            }
          } else if (enemy.aiPattern === 'stalk') {
            // 旋回包囲: プレイヤーの周囲5-8mを旋回しながら隙を窺う
            _toEnemy.normalize();
            if (dist > 8.0) {
              enemy.velocity.addScaledVector(_toEnemy, enemy.speed * delta * 2.5);
            } else if (dist < 5.0) {
              enemy.velocity.addScaledVector(_toEnemy, -enemy.speed * delta * 2.2);
            }
            const strafeDir = new THREE.Vector3().crossVectors(_toEnemy, _up).normalize();
            enemy.velocity.addScaledVector(strafeDir, enemy.strafeSign * enemy.speed * delta * 3.6);
          } else {
            // Flank: 側面へ大回りダッシュ
            _toEnemy.normalize();
            const strafeDir = new THREE.Vector3().crossVectors(_toEnemy, _up).normalize();
            enemy.velocity.addScaledVector(strafeDir, enemy.strafeSign * enemy.speed * delta * 4.0);
            enemy.velocity.addScaledVector(_toEnemy, enemy.speed * delta * 2.2);
          }

        } else if (enemy.category === 'stalker') {
          // --- STALKER: 高速ジグザグ奇襲突進 / 瞬間離脱フェーズダッシュ / 背後回り込み ---
          if (enemy.aiPattern === 'zigzag_rush') {
            // ジグザグ奇襲突進: 左右に鋭く蛇行しながら高速で肉薄
            _toEnemy.normalize();
            enemy.velocity.addScaledVector(_toEnemy, enemy.speed * 1.7 * delta * 4.2);
            const strafeDir = new THREE.Vector3().crossVectors(_toEnemy, _up).normalize();
            const zigzag = Math.sin(clock.getElapsedTime() * 9.0) * enemy.speed * delta * 4.8;
            enemy.velocity.addScaledVector(strafeDir, zigzag);
          } else if (enemy.aiPattern === 'shadow_fade') {
            // 瞬間離脱フェーズダッシュ: 攻撃後や被弾時に後退または側面へ高速離脱
            _toEnemy.normalize();
            enemy.velocity.addScaledVector(_toEnemy, -enemy.speed * delta * 3.8);
            const strafeDir = new THREE.Vector3().crossVectors(_toEnemy, _up).normalize();
            enemy.velocity.addScaledVector(strafeDir, enemy.strafeSign * enemy.speed * delta * 3.2);
          } else {
            // 背後回り込み (Flank hunt)
            _toEnemy.normalize();
            const strafeDir = new THREE.Vector3().crossVectors(_toEnemy, _up).normalize();
            enemy.velocity.addScaledVector(strafeDir, enemy.strafeSign * enemy.speed * delta * 3.6);
            enemy.velocity.addScaledVector(_toEnemy, enemy.speed * delta * 2.8);
          }

        } else if (enemy.category === 'golem') {
          // --- GOLEM: 重装突進 (Ramming Charge) / 激震スラム (Ground Slam) / 重装前進 ---
          if (enemy.aiPattern === 'ground_slam') {
            // 激震グラウンドスラム: 停止して両腕を振り上げ、地面を叩き割る衝撃波を発生
            enemy.velocity.multiplyScalar(0.3);

            // Ground slam warning telegraph
            if (!enemy.telegraphMesh && sceneRef.current) {
              const slamGeo = new THREE.RingGeometry(0.5, 5.2, 24);
              const slamMat = new THREE.MeshBasicMaterial({
                color: 0xf97316,
                side: THREE.DoubleSide,
                transparent: true,
                opacity: 0.65,
              });
              const tMesh = new THREE.Mesh(slamGeo, slamMat);
              tMesh.rotation.x = Math.PI / 2;
              tMesh.position.set(enemy.mesh.position.x, 0.05, enemy.mesh.position.z);
              sceneRef.current.add(tMesh);
              enemy.telegraphMesh = tMesh;
            } else if (enemy.telegraphMesh) {
              enemy.telegraphMesh.position.set(enemy.mesh.position.x, 0.05, enemy.mesh.position.z);
              (enemy.telegraphMesh.material as THREE.MeshBasicMaterial).opacity =
                0.3 + 0.6 * (enemy.actionSubTimer / 0.75);
            }

            if (enemy.actionSubTimer >= 0.75) {
              // Slam impacts the ground!
              if (enemy.telegraphMesh && sceneRef.current) {
                sceneRef.current.remove(enemy.telegraphMesh);
                enemy.telegraphMesh.geometry.dispose();
                (enemy.telegraphMesh.material as any).dispose();
                enemy.telegraphMesh = undefined;
              }

              sound.playEnemyExplode();
              sound.playHeavyLaunch();

              // Spawn floor shockwave ring
              if (sceneRef.current) {
                const ringGeo = new THREE.RingGeometry(0.8, 5.6, 24);
                const ringMat = new THREE.MeshBasicMaterial({
                  color: 0xf97316,
                  side: THREE.DoubleSide,
                  transparent: true,
                  opacity: 0.85,
                });
                const sRing = new THREE.Mesh(ringGeo, ringMat);
                sRing.rotation.x = Math.PI / 2;
                sRing.position.set(enemy.mesh.position.x, 0.06, enemy.mesh.position.z);
                sceneRef.current.add(sRing);
                setTimeout(() => {
                  sceneRef.current?.remove(sRing);
                  ringGeo.dispose();
                  ringMat.dispose();
                }, 280);
              }

              // Check if player is caught in ground slam radius (5.5m)
              if (activeRemoteId && coop) {
                if (dist <= 5.5 && playerPos.current.y <= 2.2) {
                  coop.sendHit(activeRemoteId, Math.round(enemy.damage * 1.3), 'GROUND SLAM', '#f97316', {
                    knockUp: 8.5,
                    knockBack: 10,
                    from: { x: enemy.mesh.position.x, z: enemy.mesh.position.z },
                  });
                }
              } else if (dist <= 5.5 && playerPos.current.y <= 2.2 && !koRef.current) {
                const slamDmg = Math.round(enemy.damage * 1.3 * (isSweepingRef.current ? 0.25 : 1)); // 溜め技中は被ダメージ 75% カット
                sound.playHurt();
                setDamageVignette(true);
                setTimeout(() => setDamageVignette(false), 180);
                if (playerShieldRef.current > 0) {
                  const absorb = Math.min(playerShieldRef.current, slamDmg);
                  playerShieldRef.current -= absorb;
                }
                playerHpRef.current = Math.max(0, playerHpRef.current - slamDmg);
                playerVelocity.current.y = 8.5; // High vertical knockup
                _forward.set(0, 0, -1).applyAxisAngle(_up, currentRotation.current.yaw);
                playerVelocity.current.addScaledVector(_forward, -10.0);
                spawnDamageText(`GROUND SLAM! -${slamDmg}`, '#f97316');
              }

              enemy.aiPattern = 'heavy_march';
              enemy.patternTimer = 2.8;
              enemy.actionSubTimer = 0;
            }
          } else if (enemy.aiPattern === 'ram_charge') {
            // 重装突進: 重量級ダッシュで直進体当たり (速度 1.75倍)
            _toEnemy.normalize();
            enemy.velocity.addScaledVector(_toEnemy, enemy.speed * 1.75 * delta * 3.8);
          } else {
            // 重装前進 (Heavy march)
            if (dist > 1.4) {
              _toEnemy.normalize();
              enemy.velocity.addScaledVector(_toEnemy, enemy.speed * delta * 2.8);
            }
          }

        } else if (enemy.category === 'titan') {
          // --- TITAN: 遠距離支援砲撃 (Artillery Mortar) / ロケット斉射 / 制圧弾幕 ---
          if (enemy.aiPattern === 'artillery_mortar') {
            // 遠距離迫撃砲: 砲身を上に向けて2発の放物線曲射砲弾をプレイヤー地点へ投射
            enemy.velocity.multiplyScalar(0.5);
            enemy.shootCooldown = (enemy.shootCooldown ?? 2.4) - delta;
            if (enemy.shootCooldown <= 0 && sceneRef.current) {
              enemy.shootCooldown = 2.8;
              [-0.85, 0.85].forEach((ox, idx) => {
                setTimeout(() => {
                  if (enemy.isDead || !sceneRef.current) return;
                  const mPos = enemy.mesh.position.clone().add(new THREE.Vector3(ox, 2.8, 0));
                  const bGeo = new THREE.SphereGeometry(0.24, 8, 8);
                  const bMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
                  const bMesh = new THREE.Mesh(bGeo, bMat);
                  bMesh.position.copy(mPos);
                  sceneRef.current?.add(bMesh);

                  const targetLoc = playerPos.current.clone().add(new THREE.Vector3(
                    (Math.random() - 0.5) * 2.0,
                    0,
                    (Math.random() - 0.5) * 2.0
                  ));
                  const shootDir = targetLoc.sub(mPos).normalize();
                  shootDir.y += 0.35; // Arcing trajectory
                  shootDir.normalize();

                  bulletsRef.current.push({
                    mesh: bMesh,
                    direction: shootDir,
                    speed: 26,
                    damage: Math.round(enemy.damage * 1.2),
                    lifetime: 3.5,
                    isPlayer: false,
                    prevPosition: bMesh.position.clone(),
                    bulletRadius: 0.42,
                  });
                  sound.playHeavyLaunch();
                }, idx * 240);
              });
            }
          } else if (enemy.aiPattern === 'rocket_salvo') {
            if (dist > 8.0) {
              _toEnemy.normalize();
              enemy.velocity.addScaledVector(_toEnemy, enemy.speed * delta * 2.4);
            }
            enemy.shootCooldown = (enemy.shootCooldown ?? 2.5) - delta;
            if (enemy.shootCooldown <= 0 && sceneRef.current) {
              enemy.shootCooldown = 2.6;
              [-0.8, 0.8].forEach((ox) => {
                const bGeo = new THREE.SphereGeometry(0.18, 8, 8);
                const bMat = new THREE.MeshBasicMaterial({ color: 0xf97316 });
                const bMesh = new THREE.Mesh(bGeo, bMat);
                bMesh.position.copy(enemy.mesh.position).add(new THREE.Vector3(ox, 2.5, 0));
                sceneRef.current?.add(bMesh);
                const shootDir = playerPos.current.clone().sub(bMesh.position).normalize();
                bulletsRef.current.push({
                  mesh: bMesh,
                  direction: shootDir,
                  speed: 26,
                  damage: enemy.damage,
                  lifetime: 4.0,
                  isPlayer: false,
                  prevPosition: bMesh.position.clone(),
                  bulletRadius: 0.35,
                });
              });
            }
          } else {
            // Suppression sweep: 3-shell spread
            if (dist > 7.0) {
              _toEnemy.normalize();
              enemy.velocity.addScaledVector(_toEnemy, enemy.speed * delta * 2.2);
            }
            enemy.shootCooldown = (enemy.shootCooldown ?? 3.0) - delta;
            if (enemy.shootCooldown <= 0 && sceneRef.current) {
              enemy.shootCooldown = 3.0;
              [-0.25, 0, 0.25].forEach((angle) => {
                const bGeo = new THREE.SphereGeometry(0.18, 8, 8);
                const bMat = new THREE.MeshBasicMaterial({ color: 0xeab308 });
                const bMesh = new THREE.Mesh(bGeo, bMat);
                bMesh.position.copy(enemy.mesh.position).add(new THREE.Vector3(0, 2.2, 0));
                sceneRef.current?.add(bMesh);
                const shootDir = playerPos.current.clone().sub(bMesh.position).normalize();
                shootDir.applyAxisAngle(_up, angle);
                bulletsRef.current.push({
                  mesh: bMesh,
                  direction: shootDir,
                  speed: 28,
                  damage: Math.round(enemy.damage * 0.9),
                  lifetime: 3.5,
                  isPlayer: false,
                  prevPosition: bMesh.position.clone(),
                  bulletRadius: 0.35,
                });
              });
            }
          }

        } else if (enemy.category === 'boss') {
          // --- BOSS: 3形態マルチパターン戦術 (HP 66% / 33% で強化) — 予兆モーション付きの攻撃パターン ---
          runBossPattern(enemy, combatCtx, dist);
        } else if (apex) {
          // --- APEX: 盾重装 / 機械侍 / 火炎放射 / 電磁蜘蛛 / 軌道観測 / 分裂液体金属 / 時間逆行 / 幻影 / 磁力 / 狂戦 ---
          updateApexEnemy(enemy, combatCtx, dist);
        } else if (elite) {
          // --- ELITE: 修復天使 / 掘削蛇機 / 位相道化 / 母艦蟲機 / 光刃蟷螂 ---
          updateEliteEnemy(enemy, combatCtx, dist);
        } else {
          // Default advance
          if (dist > 1.2) {
            _toEnemy.normalize();
            enemy.velocity.addScaledVector(_toEnemy, enemy.speed * delta * 3.2);
          }
        }

        if (enemySpeedMultiplier < 1.0) {
          enemy.velocity.x *= enemySpeedMultiplier;
          enemy.velocity.z *= enemySpeedMultiplier;
        }

        enemy.velocity.x *= 0.89;
        enemy.velocity.z *= 0.89;
        enemy.mesh.position.addScaledVector(enemy.velocity, delta);

        if (isFlyingCategory(enemy.category)) {
          enemy.velocity.y = 0;
        } else {
          enemy.mesh.position.y = enemy.airY ?? 0;
          enemy.velocity.y = 0;
        }

        const enemyRadius =
          enemy.category === 'boss'
            ? 4.4
            : enemy.category === 'carrier'
            ? 2.0
            : enemy.category === 'lancer' || enemy.category === 'aegis' || enemy.category === 'magnet' || enemy.category === 'berserker' || enemy.category === 'weaver'
            ? 1.4
            : enemy.category === 'pyro' || enemy.category === 'chrono' || enemy.category === 'splitter'
            ? 1.25
            : enemy.category === 'wyrm'
            ? 1.2
            : enemy.category === 'titan'
            ? 2.2
            : enemy.category === 'golem'
            ? 1.6
            : enemy.category === 'sentry'
            ? 1.2
            : 1.0;

        // 密着防止: プレイヤーとの最小間隔(スタンドオフ距離)を保つ。内側へ向かう速度成分も打ち消す
        const standoff = getEnemyStandoff(enemy.category);
        {
          const sx = enemy.mesh.position.x - playerPos.current.x;
          const sz = enemy.mesh.position.z - playerPos.current.z;
          const sd = Math.hypot(sx, sz);
          if (sd < standoff && !enemy.ignoreStandoff) {
            const nx = sd > 0.001 ? sx / sd : Math.cos(enemy.strafeSign * 1.3);
            const nz = sd > 0.001 ? sz / sd : Math.sin(enemy.strafeSign * 1.3);
            enemy.mesh.position.x = playerPos.current.x + nx * standoff;
            enemy.mesh.position.z = playerPos.current.z + nz * standoff;
            const inward = enemy.velocity.x * nx + enemy.velocity.z * nz;
            if (inward < 0) {
              enemy.velocity.x -= nx * inward;
              enemy.velocity.z -= nz * inward;
            }
          }
        }

        const arenaLimit = 40 - 0.6 - enemyRadius;
        enemy.mesh.position.x = THREE.MathUtils.clamp(enemy.mesh.position.x, -arenaLimit, arenaLimit);
        enemy.mesh.position.z = THREE.MathUtils.clamp(enemy.mesh.position.z, -arenaLimit, arenaLimit);

        // Continuous Circle-AABB obstacle collision & sliding navigation
        for (let c = 0; c < coverObjectsRef.current.length; c++) {
          const b = coverObjectsRef.current[c].box;
          if (isFlyingCategory(enemy.category) && enemy.mesh.position.y >= b.height + 0.3) {
            continue;
          }
          if (enemy.mesh.position.y < b.height) {
            const cx = THREE.MathUtils.clamp(enemy.mesh.position.x, b.minX, b.maxX);
            const cz = THREE.MathUtils.clamp(enemy.mesh.position.z, b.minZ, b.maxZ);
            const diffX = enemy.mesh.position.x - cx;
            const diffZ = enemy.mesh.position.z - cz;
            const distSq = diffX * diffX + diffZ * diffZ;
            const safeR = enemyRadius + 0.12;

            if (distSq < safeR * safeR) {
              if (distSq > 0.0001) {
                const d = Math.sqrt(distSq);
                const nx = diffX / d;
                const nz = diffZ / d;
                const overlap = safeR - d;
                enemy.mesh.position.x += nx * overlap;
                enemy.mesh.position.z += nz * overlap;

                const vDotN = enemy.velocity.x * nx + enemy.velocity.z * nz;
                if (vDotN < 0) {
                  enemy.velocity.x -= vDotN * nx;
                  enemy.velocity.z -= vDotN * nz;
                }

                // Smooth sliding along obstacle boundary towards player
                let tx = -nz;
                let tz = nx;
                const toPx = playerPos.current.x - enemy.mesh.position.x;
                const toPz = playerPos.current.z - enemy.mesh.position.z;
                if (tx * toPx + tz * toPz < 0) {
                  tx = -tx;
                  tz = -tz;
                }
                enemy.velocity.x += tx * enemy.speed * delta * 2.6;
                enemy.velocity.z += tz * enemy.speed * delta * 2.6;
              } else {
                const dLeft = enemy.mesh.position.x - b.minX;
                const dRight = b.maxX - enemy.mesh.position.x;
                const dFront = enemy.mesh.position.z - b.minZ;
                const dBack = b.maxZ - enemy.mesh.position.z;
                const minD = Math.min(dLeft, dRight, dFront, dBack);
                if (minD === dLeft) enemy.mesh.position.x = b.minX - safeR;
                else if (minD === dRight) enemy.mesh.position.x = b.maxX + safeR;
                else if (minD === dFront) enemy.mesh.position.z = b.minZ - safeR;
                else enemy.mesh.position.z = b.maxZ + safeR;
                enemy.velocity.x = 0;
                enemy.velocity.z = 0;
              }
            }
          }
        }

        // Keep ground hazard threat ring perfectly aligned
        if (enemy.groundRingMesh) {
          enemy.groundRingMesh.position.set(enemy.mesh.position.x, 0.04, enemy.mesh.position.z);
        }
        if (enemy.faceAngle !== undefined) {
          // locked facing (dash lane / beam): models face -Z, so yaw = facing + PI
          enemy.mesh.rotation.set(0, enemy.faceAngle + Math.PI, 0);
        } else {
          enemy.mesh.lookAt(playerPos.current.x, enemy.mesh.position.y, playerPos.current.z);
          enemy.mesh.rotateY(Math.PI); // all enemy models face -Z: turn the front toward the player
        }

        // Procedural walk / idle / attack animation (all enemy models + boss body motion)
        const animIn = {
          mesh: enemy.mesh,
          shootCooldown: enemy.shootCooldown,
          attackCooldown: enemy.attackCooldown,
          near: dist <= standoff + 1.4,
        };
        if (enemy.category === 'boss') {
          const bossRig = enemy.mesh.userData.bossRefs?.rig as THREE.Object3D | undefined;
          if (bossRig) animateBossMotion(animIn, bossRig, clock.getElapsedTime(), delta, bossPhaseNow);
        } else {
          animateEnemy(animIn, clock.getElapsedTime(), delta);
        }

        // Attack cooldown
        enemy.attackCooldown -= delta;
        if (dist <= standoff + 0.6 && enemy.attackCooldown <= 0 && !enemy.noContact) {
          enemy.attackCooldown = 1.3;
          // 溜め技の発動中(操作不能時間)は被ダメージ 75% カット
          const meleeTaken = Math.round(enemy.damage * (isSweepingRef.current ? 0.25 : 1));
          let incomingDmg = meleeTaken;

          if (activeRemoteId && coop) {
            // CO-OP: 狙っているのは味方。被弾処理は本人の側で行う
            coop.sendHit(activeRemoteId, enemy.damage, '', '#ef4444', { guard: 'melee' });
          } else if (koRef.current) {
            // ダウン中は無敵
          } else if (isGuardingRef.current) {
            applyGuardBlockRef.current(incomingDmg, 'melee', enemy);
          } else {
            sound.playHurt();
            setDamageVignette(true);
            setTimeout(() => setDamageVignette(false), 160);

            if (playerShieldRef.current > 0) {
              const absorb = Math.min(playerShieldRef.current, incomingDmg);
              playerShieldRef.current -= absorb;
              incomingDmg -= absorb;
            }
            playerHpRef.current = Math.max(0, playerHpRef.current - incomingDmg);
            battleStats.current.damageTaken += meleeTaken;
            spawnDamageText(`-${meleeTaken}`, '#ef4444');
          }

          if (!activeRemoteId && playerHpRef.current <= 0) {
            onLocalHpZero();
          }
        }
      };
      const localPosVec = playerPos.current;
      enemiesRef.current.forEach((enemy) => {
        activeRemoteId = null;
        // CO-OP (ホスト): 敵は最も近い (ダウンしていない) プレイヤーを狙う
        if (coop && coop.isHost && !enemy.isDead && !enemy.isPuppet) {
          let best = koRef.current ? Infinity : Math.hypot(localPosVec.x - enemy.mesh.position.x, localPosVec.z - enemy.mesh.position.z);
          for (const r of coop.remoteList) {
            if (r.ko || !r.seen) continue;
            const d = Math.hypot(r.eye.x - enemy.mesh.position.x, r.eye.z - enemy.mesh.position.z);
            if (d < best) {
              best = d;
              activeRemoteId = r.id;
            }
          }
          const target = activeRemoteId ? coop.getRemote(activeRemoteId) : undefined;
          if (target) {
            playerPos.current = target.eye;
            combatCtx.player = target.eye;
            combatCtx.playerYaw = target.yaw;
            combatCtx.hurt = remoteHurt(target.id);
          } else {
            activeRemoteId = null;
          }
        }
        try {
          stepEnemy(enemy);
        } finally {
          if (playerPos.current !== localPosVec) {
            playerPos.current = localPosVec;
            combatCtx.player = localPosVec;
            combatCtx.playerYaw = currentRotation.current.yaw;
            combatCtx.hurt = hurtPlayer;
          }
          activeRemoteId = null;
        }
      });

      // Scrap auto-pickup
      for (let s = scrapDropsRef.current.length - 1; s >= 0; s--) {
        const drop = scrapDropsRef.current[s];
        drop.mesh.rotation.y += 0.05;
        if (playerPos.current.distanceTo(drop.position) < 3.2) {
          sound.playScrapPickup();
          if (drop.beacon) {
            beaconDroppedRef.current += drop.beacon;
            spawnDamageText(`+${drop.beacon} BEACON`, '#fbbf24');
          } else {
            scrapCollectedRef.current += drop.amount;
            battleStats.current.scrapEarned += drop.amount;
            spawnDamageText(`+${drop.amount} SCRAP`, '#10b981');
          }
          scene.remove(drop.mesh);
          drop.mesh.geometry.dispose();
          scrapDropsRef.current.splice(s, 1);
        }
      }

      livingCount += minionsSpawnedThisFrame;
      if (livingCount !== prevLivingCountRef.current) {
        prevLivingCountRef.current = livingCount;
        setLivingEnemiesCount(livingCount);
      }

      // 10. WAVE ADVANCEMENT & VICTORY TRIGGER
      if (!isGuest && livingCount === 0 && enemiesRef.current.length > 0 && !pendingWaveSpawn) {
        if (!isIntermissionRef.current) {
          if (currentWaveIndexRef.current < wavesListRef.current.length - 1) {
            // Wave cleared! Start intermission breather
            isIntermissionRef.current = true;
            intermissionTimerRef.current = 2.4;
            setAnnouncement(`WAVE ${currentWaveIndexRef.current + 1} CLEARED // 次の増援接近中...`);
            sound.playUiClick();
          } else {
            // All waves cleared and all enemies defeated!
            setAnnouncement('ALL WAVES CLEARED // 作戦目標達成！');
            handleBattleEnd(true);
          }
        } else {
          // Intermission countdown
          intermissionTimerRef.current -= delta;
          if (intermissionTimerRef.current <= 0) {
            isIntermissionRef.current = false;
            currentWaveIndexRef.current += 1;
            spawnCurrentWave(currentWaveIndexRef.current);
          }
        }
      }

      hudUpdateCounter += delta;
      if (hudUpdateCounter >= 0.05) {
        hudUpdateCounter = 0;
        const nowSec = performance.now() / 1000;
        if (nowSec < meleeCooldownUntilRef.current || nowSec < skillCooldownUntilRef.current + 0.1 || (rechargeTimerRef.current > 0 && rechargeTimerRef.current < 6.0)) {
          syncHudState();
        }
      }

      renderer.render(scene, camera);
    };

    animationId = requestAnimationFrame(gameLoop);

    return () => {
      cancelAnimationFrame(animationId);
      coop?.dispose();
      healDrone?.dispose();
      healDrone = null;
      hazards.clear();
      arsenal.clear();
      arsenalRef.current = null;
      setFxLightProvider(null);
      arsenalCtxRef.current = null;
      enemiesRef.current.forEach((en) => {
        disposeEnemyAux(en, scene);
        if (en.sniperLaserLine) {
          scene.remove(en.sniperLaserLine);
          en.sniperLaserLine.geometry.dispose();
          (en.sniperLaserLine.material as any).dispose();
          en.sniperLaserLine = undefined;
        }
        if (en.telegraphMesh) {
          scene.remove(en.telegraphMesh);
          en.telegraphMesh.geometry.dispose();
          (en.telegraphMesh.material as any).dispose();
          en.telegraphMesh = undefined;
        }
      });
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('pointerlockchange', handlePointerLockChange);
      document.removeEventListener('pointerlockerror', handlePointerLockError);
      renderer.domElement.removeEventListener('click', handleCanvasClick);
      renderer.domElement.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      renderer.domElement.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keydown', handleDevClear);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('wheel', handleWheel);
      if (document.pointerLockElement === renderer.domElement) {
        try {
          document.exitPointerLock();
        } catch {}
      }
      if (grenadeAimLine) {
        scene.remove(grenadeAimLine);
        grenadeAimLine.geometry.dispose();
        (grenadeAimLine.material as THREE.Material).dispose();
      }
      if (grenadeAimRing) {
        scene.remove(grenadeAimRing);
        grenadeAimRing.geometry.dispose();
        (grenadeAimRing.material as THREE.Material).dispose();
      }
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [
    mission.id,
    resumeCombat,
    pauseCombat,
    requestLock,
    executePrimaryAttack,
    executeDash,
    executeJump,
    executeReload,
    switchWeapon,
    getActiveWeapon,
    buildViewmodelForWeapon,
    syncHudState,
    spawnDamageText,
    onFinishBattle,
  ]);

  return (
    <div
      className={`relative w-full h-full overflow-hidden select-none bg-white ${
        isPointerLocked && !isPaused ? 'cursor-none' : 'cursor-default'
      }`}
      onClick={() => {
        if (!isPaused && !isPointerLockedRef.current) requestLock();
      }}
      onMouseDown={() => {
        if (!isPaused && !isPointerLockedRef.current) requestLock();
      }}
    >
      {introPhase === 'playing' && (() => {
        const hex = getStageTheme(mission.id).accentColor;
        const mapDef = WORLD_MAPS.find((m) => m.id === mission.mapId);
        return (
          <div
            key={`stage-${mission.id}`}
            className={`sc-root ${mission.isBoss ? 'is-boss' : ''}`}
            style={{ '--sc': `${(hex >> 16) & 255},${(hex >> 8) & 255},${hex & 255}` } as React.CSSProperties}
          >
            <div className="sc-dim" />
            <div className="sc-scan" />
            <div className="sc-band" />
            <div className="sc-line sc-line-top" /><div className="sc-line sc-line-bot" />
            <div className="sc-ghost" aria-hidden="true">{mission.code.replace('-BOSS', '')}</div>
            <span className="sc-corner tl" /><span className="sc-corner tr" /><span className="sc-corner bl" /><span className="sc-corner br" />
            <div className="sc-head">
              <span className="sc-tag">{hard ? 'HARD // ' : ''}{mission.isBoss ? 'BOSS OPERATION' : 'MISSION START'}</span>
              <span className="sc-tag-ja">作戦開始</span>
            </div>
            <div className="sc-center">
              <div className="sc-code">{mapDef?.badge ?? `MAP ${mission.mapId}`} <b>//</b> {mission.code}</div>
              <div className="sc-name">{mission.name}</div>
              <div className="sc-area">{mission.areaName.replace(/\s*\[.*?\]\s*/g, '')}</div>
              <div className="sc-meta">
                <span>THREAT<span className="sc-threat">{[1, 2, 3, 4, 5].map((i) => <i key={i} className={i <= mission.threatLevel ? 'on' : ''} />)}</span></span>
                <span>WAVES<b>{totalWaves}</b></span>
                <span>OBJECTIVE<b>全敵性体を殲滅せよ</b></span>
              </div>
            </div>
            <div className="sc-flash" />
          </div>
        );
      })()}
      {waveCutin && !waveCutin.boss && (
        <div key={`wave-${waveCutin.wave}-${waveCutin.total}`} className={`wc-root ${waveCutin.final ? 'is-final' : ''}`}>
          <div className="wc-dim" />
          <div className="wc-scan" />
          <div className="wc-bar wc-bar-top" aria-hidden="true"><div className="wc-ticker"><span>{(waveCutin.wave === 1 ? 'OPERATION COMMENCED // ' : 'TACTICAL REINFORCEMENT // ').repeat(14)}</span></div></div>
          <div className="wc-bar wc-bar-bot" aria-hidden="true"><div className="wc-ticker"><span>{'HOSTILE SIGNATURES DETECTED // '.repeat(14)}</span></div></div>
          <div className="wc-slash" style={{ left: '38%' }} /><div className="wc-slash" style={{ left: '62%', animationDelay: '.08s' }} />
          <div className="wc-ghost" aria-hidden="true">{waveCutin.wave.toString().padStart(2, '0')}</div>
          <span className="wc-corner tl" /><span className="wc-corner tr" /><span className="wc-corner bl" /><span className="wc-corner br" />
          <div className="wc-center">
            <div className="wc-kicker">{waveCutin.final ? 'FINAL PHASE' : waveCutin.wave === 1 ? 'FIRST CONTACT' : 'PHASE TRANSITION'}</div>
            <div className="wc-title"><span>WAVE</span><span className="wc-num">{waveCutin.wave.toString().padStart(2, '0')}</span></div>
            <div className="wc-sub">{waveCutin.final ? <>FINAL WAVE <b>//</b> ELITE HOSTILES</> : <>INCOMING HOSTILES <b>//</b> {waveCutin.wave} / {waveCutin.total}</>}</div>
            <div className="wc-pips" aria-hidden="true">
              {Array.from({ length: waveCutin.total }, (_, i) => (
                <span key={i} className={`wc-pip ${i + 1 < waveCutin.wave ? 'on' : i + 1 === waveCutin.wave ? 'now' : ''}`} />
              ))}
            </div>
          </div>
        </div>
      )}
      {waveCutin && waveCutin.boss && (
        <div key={`boss-${waveCutin.wave}`} className="bc-root">
          <div className="bc-dim" />
          <div className="bc-scan" />
          <div className="bc-hazard bc-hazard-top" aria-hidden="true" />
          <div className="bc-hazard bc-hazard-bot" aria-hidden="true" />
          <div className="bc-warnbar bc-warnbar-top" aria-hidden="true"><div className="bc-track"><span>{'⚠ DANGER ⚠　BOSS DETECTED　'.repeat(6)}</span><span>{'⚠ DANGER ⚠　BOSS DETECTED　'.repeat(6)}</span></div></div>
          <div className="bc-warnbar bc-warnbar-bot" aria-hidden="true"><div className="bc-track"><span>{'THREAT LEVEL CRITICAL　HOSTILE APPROACHING　'.repeat(4)}</span><span>{'THREAT LEVEL CRITICAL　HOSTILE APPROACHING　'.repeat(4)}</span></div></div>
          <svg className="bc-ring" viewBox="0 0 200 200" aria-hidden="true">
            <g className="bc-ring-spin" fill="none" stroke="rgb(239,68,68)">
              <circle cx="100" cy="100" r="96" strokeWidth="1.2" strokeDasharray="2 5" />
              <circle cx="100" cy="100" r="90" strokeWidth="2.5" strokeDasharray="60 20 14 20" />
            </g>
            <g className="bc-ring-spin r" fill="none" stroke="rgba(254,202,202,.8)">
              <circle cx="100" cy="100" r="78" strokeWidth="1" strokeDasharray="4 3" />
              {[0, 90, 180, 270].map((a) => <path key={a} d="M100 4 L106 16 L94 16 Z" fill="rgb(239,68,68)" stroke="none" transform={`rotate(${a} 100 100)`} />)}
            </g>
            <g stroke="rgba(239,68,68,.7)" strokeWidth="1"><path d="M100 30 V70 M100 130 V170 M30 100 H70 M130 100 H170" /></g>
          </svg>
          <span className="bc-corner tl" /><span className="bc-corner tr" /><span className="bc-corner bl" /><span className="bc-corner br" />
          <div className="bc-center">
            <div className="bc-warning">⚠ WARNING ⚠</div>
            <div className="bc-title" data-text="BOSS">BOSS</div>
            <div className="bc-name">{(waveCutin.bossName || 'UNKNOWN ENTITY').replace(/\s*\[BOSS\]\s*/g, '')}</div>
            <div className="bc-sub">ARCHON-CLASS ENTITY // LETHAL THREAT</div>
            <div className="bc-threat">THREAT LEVEL
              {[0, 1, 2, 3, 4].map((i) => <i key={i} style={{ animationDelay: `${0.7 + i * 0.16}s` }} />)}
            </div>
          </div>
          <div className="bc-flash" />
        </div>
      )}
      {/* 3D WebGL Canvas */}
      <div ref={mountRef} className="w-full h-full" />

      {/* POINTER LOCK ENGAGEMENT OVERLAY (戦闘中のマウス画面外脱出・誤クリック防止) */}
      {!isPointerLocked && !isPaused && introPhase === 'done' && <HudLockOverlay onLock={requestLock} />}

      {/* Low HP pulse + hurt flash */}
      {hudStats.hp > 0 && hudStats.hp / hudStats.maxHp <= 0.3 && <div className="absolute inset-0 pointer-events-none bh-lowhp" />}
      {damageVignette && <div className="absolute inset-0 pointer-events-none bh-hurt" />}
      {koUi && (
        <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center bg-red-950/40">
          <div className="text-5xl font-black tracking-[0.4em] text-red-400 font-cyber">DOWN</div>
          {reviveInfo.selfRemain !== null ? (
            <div className="mt-4 flex flex-col items-center">
              <div className="text-xs tracking-[0.3em] text-emerald-300 font-cyber">REVIVING</div>
              <div className="text-6xl font-black text-emerald-300 font-cyber tabular-nums">{reviveInfo.selfRemain.toFixed(1)}</div>
            </div>
          ) : (
            <div className="mt-3 text-sm text-slate-200 font-gothic">味方が足元の円内に5秒いると蘇生 ／ 次のウェーブで復帰</div>
          )}
        </div>
      )}
      {reviveInfo.rescue && (
        <div className="absolute left-1/2 top-[58%] -translate-x-1/2 pointer-events-none z-20 flex flex-col items-center">
          <div className="text-xs tracking-[0.3em] text-emerald-300 font-cyber">RESCUING // {reviveInfo.rescue.name}</div>
          <div className="text-5xl font-black text-emerald-300 font-cyber tabular-nums">{reviveInfo.rescue.remain.toFixed(1)}</div>
        </div>
      )}
      {reviveInfo.downed.length > 0 && !koUi && (
        <div className="absolute left-1/2 top-24 -translate-x-1/2 pointer-events-none z-20 px-4 py-1.5 bg-red-950/70 border border-red-500/60 font-cyber text-sm font-black tracking-widest text-red-300 animate-pulse">
          ⚠ {reviveInfo.downed.join(' / ')} がダウン // 救助せよ
        </div>
      )}

      {/* ================= INFIGHT GUARD BADGE (武器ごとの防御技) ================= */}
      {hudStats.isGuarding && (() => {
        const gw = weapons.find((w) => w.id === hudStats.weaponId);
        if (!gw || gw.category !== 'MELEE') return null;
        const gp = GUARD_PROFILES[getMeleeStyle(gw)];
        return (
          <div className="absolute left-1/2 top-[62%] -translate-x-1/2 pointer-events-none z-20 flex flex-col items-center gap-1 ads-sight-in">
            <div
              className="flex items-center gap-2 px-4 py-1.5 font-cyber font-black text-xs tracking-[0.25em] text-white"
              style={{
                background: `linear-gradient(90deg, transparent, ${gp.color}cc 20%, ${gp.color}cc 80%, transparent)`,
                textShadow: `0 0 10px ${gp.color}`,
              }}
            >
              <span className="w-1.5 h-1.5 rotate-45 bg-white" />
              {gp.name}
              <span className="font-gothic tracking-wider font-bold opacity-90">// {gp.jp}</span>
              <span className="w-1.5 h-1.5 rotate-45 bg-white" />
            </div>
            <div className="text-[10px] font-bold text-white/85 tracking-wide" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
              {gp.desc}
            </div>
          </div>
        );
      })()}

      {/* ================= CENTER CROSSHAIR & ADS SIGHT SYSTEM ================= */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        {isAiming ? (
          (() => {
            const adsWeapon = weapons.find((w) => w.id === hudStats.weaponId);
            return adsWeapon ? <AdsSight weapon={adsWeapon} hit={hitMarkerActive} /> : null;
          })()
        ) : (
          // ================= HIP-FIRE CROSSHAIR (射撃で拡散 / 近接は斬撃ブラケット) =================
          (() => {
            const cw = weapons.find((w) => w.id === hudStats.weaponId);
            return (
              <HudCrosshair
                bloomed={crosshairBloomed}
                hit={hitMarkerActive}
                color={cw?.color ?? '#22d3ee'}
                melee={hudStats.category === 'MELEE'}
              />
            );
          })()
        )}
      </div>

      {/* CHARGE GAUGE (pie): swept angle = charge amount, for railgun / solar cannon */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        <svg ref={chargeGaugeRef} viewBox="0 0 100 100" width={110} height={110} style={{ opacity: 0, filter: 'drop-shadow(0 0 3px rgba(0,0,0,0.9))' }}>
          <circle cx={50} cy={50} r={24} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth={1} />
          <path ref={chargePieRef} d="" fill="none" strokeWidth={2.5} strokeLinejoin="round" />
        </svg>
      </div>

      {/* FLOATING DAMAGE NUMBERS */}
      {floatingTexts.map((ft) => (
        <div
          key={ft.id}
          className="absolute font-cyber font-black text-base pointer-events-none whitespace-nowrap bh-float"
          style={{ left: `${ft.x}%`, top: `${ft.y}%`, color: ft.color }}
        >
          {ft.text}
        </div>
      ))}

      {/* TOP COMBAT BAR */}
      <HudTopBar
        code={mission.code}
        name={mission.name}
        wave={currentWave}
        totalWaves={totalWaves}
        hostiles={livingEnemiesCount}
        kills={hudStats.kills}
        scrap={hudStats.scrap}
        announcement={announcement}
      />

      {/* PAUSE MENU */}
      {isPaused && <HudPauseMenu onResume={resumeCombat} onExit={onExitToMenu} />}

      {/* TOP: BOSS HP */}
      {hudStats.boss && <HudBossBar {...hudStats.boss} />}

      {/* BOTTOM LEFT: VITALS */}
      <HudVitals hp={hudStats.hp} maxHp={hudStats.maxHp} shield={hudStats.shield} maxShield={hudStats.maxShield} />

      {/* BOTTOM RIGHT: ACTIVE WEAPON + SLOTS */}
      <div className="absolute bottom-5 right-5 pointer-events-none flex flex-col items-end gap-2 z-10">
        <HudSlots
          slots={([1, 2, 3, 4] as WeaponSlot[]).map((slot) => ({ slot, weapon: weapons.find((item) => item.id === activeLoadout[slot]) }))}
          current={hudStats.currentSlot}
          stock={hudStats.slotStock}
          onSelect={(slot) => {
            if (activeLoadout[slot]) switchWeapon(slot);
            else {
              sound.playUiHover();
              setAnnouncement(`SLOT ${slot} // 未装備 [EMPTY]`);
            }
          }}
        />
        {(() => {
          const hw = weapons.find((w) => w.id === hudStats.weaponId);
          if (!hw) return null;
          const maxCombo = hw.id === 'blade_gauntlets' && hasSkill('gauntlet_mod_combo') ? 4 : 3;
          return <HudWeapon weapon={hw} slot={hudStats.currentSlot} hud={hudStats} isAiming={isAiming} isGuarding={hudStats.isGuarding} maxCombo={maxCombo} />;
        })()}
      </div>
    </div>
  );
};
