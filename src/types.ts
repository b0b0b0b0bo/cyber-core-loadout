/**
 * CYBER CORE - Core Type Definitions
 */

export type ScreenState = 'MISSION_SELECT' | 'LOADOUT' | 'SKILL_TREE' | 'BATTLE' | 'RESULT';

export type WeaponSlot = 1 | 2 | 3 | 4;

export type WeaponCategory = 'MELEE' | 'SUB' | 'MAIN' | 'HEAVY';

export interface WeaponStats {
  damage: number;       // Base damage per hit/projectile
  fireRate: number;     // Rounds per second or swings per second
  maxAmmo: number;      // Magazine capacity (Infinity for Melee)
  reloadTime: number;   // In seconds
  range: number;        // Effective combat range in meters
  accuracy: number;     // 0 - 100%
  critRate: number;     // 0 - 100%
}

export interface Weapon {
  id: string;
  name: string;
  codeName: string;
  category: WeaponCategory; // Descriptive category, NOT restricted to a single slot
  stats: WeaponStats;
  description: string;
  lore: string;
  color: string;         // Hex color for energy glow
  unlocked: boolean;
  costToUnlock?: number; // Scrap cost if bought
  modelType: 'blade' | 'katana' | 'handgun' | 'revolver' | 'rifle' | 'shotgun' | 'launcher' | 'railgun' | 'dynamite' | 'axe' | 'gauntlets' | 'twinblade';
  isRechargeable?: boolean; // For throwables like Dynamite with automatic recharge
  rechargeTime?: number;   // Seconds to recharge 1 unit
  upgradeLevel?: number;   // Damage upgrade level (0 - 100)
}

export type SkillBranch = 'INFIGHT' | 'ASSAULT' | 'GRENADE';

export type SkillNodeType = 'PASSIVE_STAT' | 'WEAPON_UNLOCK' | 'WEAPON_SPECIFIC';

export interface SkillEffect {
  stat: string;
  value: number;        // e.g. 0.15 for +15%
  label: string;
}

export interface SkillNode {
  id: string;
  name: string;
  branch: SkillBranch;
  nodeType: SkillNodeType;
  description: string;
  cost: number;         // Scrap required
  unlocked: boolean;
  tier: number;         // 1 to 4
  x: number;            // Graph X coordinate (0-1000 scale)
  y: number;            // Graph Y coordinate (0-800 scale)
  prerequisites: string[]; // Node IDs required before unlocking
  effects: SkillEffect[];
  
  // Weapon Unlock Integration
  unlocksWeaponId?: string; // If nodeType === 'WEAPON_UNLOCK', unlocking this node unlocks this weapon!
  
  // Weapon Specific Node Constraints
  isWeaponSpecific: boolean;
  targetWeaponId?: string; // If set, only affects this specific weapon
  // Note: Weapon specific nodes MUST have 0 outgoing connections (terminal dead-end)
  // And they only appear/reveal when the targetWeapon is unlocked!
  requiresWeaponUnlocked?: string; // Hidden or locked until this weapon is unlocked
  iconType?: 'core' | 'sword' | 'shield' | 'zap' | 'crosshair' | 'reaper' | 'magnum' | 'heavy' | 'railgun' | 'key' | 'speed' | 'star' | 'heart' | 'armor';
}

export interface EnemyType {
  id: string;
  name: string;
  category: 'drone' | 'hound' | 'golem' | 'boss' | 'sentry' | 'stalker' | 'titan' | 'mender' | 'wyrm' | 'jester' | 'carrier' | 'lancer'
    | 'aegis' | 'ronin' | 'pyro' | 'weaver' | 'spotter' | 'splitter' | 'chrono' | 'mirage' | 'magnet' | 'berserker';
  maxHp: number;
  damage: number;
  speed: number;
  color: string;
  size: number;
}

export type MapId = 1 | 2 | 3 | 4 | 5 | 6;

export interface WorldMapDef {
  id: MapId;
  name: string;
  subName: string;
  description: string;
  badge: string;
  themeColor: string;
  accentColor: number;
  bossMissionId: string;
  requiredBossMissionId?: string;
  requiredBossName?: string;
}

export interface Mission {
  id: string;
  mapId: MapId; // 1: Gothic Metropolis, 2: Orbital Citadel, 3: Deep Research, 4: Tidal Ruins, 5: Silent Wastes, 6: Frozen Archive
  code: string;
  name: string;
  areaName: string;
  description: string;
  threatLevel: 1 | 2 | 3 | 4 | 5;
  cleared: boolean;
  unlocked: boolean;
  isBoss: boolean;
  mapCoords: [number, number, number]; // 3D coordinates for hologram crystal
  enemies: {
    enemyTypeId: string;
    name: string;
    count: number;
    description: string;
  }[];
  scrapReward: number;
  coreReward: number;
  unlockedWeaponRewardId?: string;
}

export interface BattleStats {
  kills: number;
  damageDealt: number;
  damageTaken: number;
  timeSeconds: number;
  sweepsUsed: number;
  headshots: number;
  scrapEarned: number;
  coresEarned: number;
}

export interface BattleResult {
  missionId: string;
  isVictory: boolean;
  rank: 'S' | 'A' | 'B' | 'C';
  stats: BattleStats;
  rewards: {
    scrap: number;
    cores: number;
    weaponUnlocked?: Weapon;
    nextMissionUnlocked?: Mission;
  };
  /** ハードMAPでの戦闘結果 */
  hard?: boolean;
}

export interface PlayerStats {
  hp: number;
  maxHp: number;
  shield: number;
  maxShield: number;
  stamina: number;      // For guard and sweep attack
  maxStamina: number;
  scrap: number;
  beacons: number;
  activeLoadout: Record<WeaponSlot, string | null>; // slot 1..4 -> weaponId (or null for empty slot)
  weaponDamageLevels: Record<string, number>; // weaponId -> level (0 to 100)
  nodeLevels: Record<string, number>; // skill node id -> level (1 to 10, unlocked nodes only)
}
