import { Mission, PlayerStats, SkillNode, Weapon } from '../types';
import {
  INITIAL_MISSIONS,
  INITIAL_PLAYER_STATS,
  INITIAL_SKILL_NODES,
  INITIAL_WEAPONS,
} from '../data/initialData';

/**
 * 進行状況のセーブ（localStorage）。
 * 保存するのは「プレイヤーの進行」だけで、武器・ミッション・ノードの定義データは
 * 毎回 initialData から読み直す。そのため定義を変更しても古いセーブが壊れない。
 */

const SAVE_KEY = 'cyber-core-save';
const SAVE_VERSION = 1;

interface SaveData {
  version: number;
  scrap: number;
  beacons: number;
  activeLoadout: PlayerStats['activeLoadout'];
  weaponDamageLevels: Record<string, number>;
  nodeLevels: Record<string, number>;
  unlockedWeaponIds: string[];
  unlockedNodeIds: string[];
  missionProgress: Record<string, { unlocked: boolean; cleared: boolean }>;
  selectedMissionId: string | null;
}

export interface RestoredState {
  weapons: Weapon[];
  missions: Mission[];
  skillNodes: SkillNode[];
  playerStats: PlayerStats;
  selectedMission: Mission | null;
}

const readSave = (): SaveData | null => {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as SaveData;
    return data.version === SAVE_VERSION ? data : null;
  } catch {
    // 壊れたJSON・ストレージ拒否時は新規扱い
    return null;
  }
};

/** 保存済みの進行を初期データに重ねて復元する。セーブが無ければ初期状態を返す。 */
export const loadGameState = (): RestoredState => {
  const save = readSave();

  const weapons = INITIAL_WEAPONS.map((w) => ({
    ...w,
    unlocked: save ? save.unlockedWeaponIds.includes(w.id) || w.unlocked : w.unlocked,
  }));

  // 旧セーブに無いミッション（後から追加されたMAP）は、直前のミッションをクリア済みなら解放済みにする
  const missions = INITIAL_MISSIONS.map((m, i) => {
    const p = save?.missionProgress[m.id];
    if (p) return { ...m, unlocked: p.unlocked, cleared: p.cleared };
    const prev = i > 0 ? save?.missionProgress[INITIAL_MISSIONS[i - 1].id] : undefined;
    return prev?.cleared ? { ...m, unlocked: true } : m;
  });

  const skillNodes = INITIAL_SKILL_NODES.map((n) => ({
    ...n,
    unlocked: save ? save.unlockedNodeIds.includes(n.id) || n.unlocked : n.unlocked,
  }));

  // 後から差し込まれた補助ノード(fill_*)は、先にある子ノードを解放済みなら自動で解放済みにする
  if (save) {
    for (let changed = true; changed; ) {
      changed = false;
      for (const n of skillNodes) {
        if (n.unlocked || !n.id.startsWith('fill_')) continue;
        if (skillNodes.some((c) => c.unlocked && c.prerequisites.includes(n.id))) {
          n.unlocked = true;
          changed = true;
        }
      }
    }
  }

  const playerStats: PlayerStats = save
    ? {
        ...INITIAL_PLAYER_STATS,
        scrap: save.scrap,
        beacons: save.beacons,
        activeLoadout: { ...INITIAL_PLAYER_STATS.activeLoadout, ...save.activeLoadout },
        weaponDamageLevels: save.weaponDamageLevels,
        nodeLevels: save.nodeLevels,
      }
    : INITIAL_PLAYER_STATS;

  const selectedMission =
    missions.find((m) => m.id === save?.selectedMissionId) ?? missions[0] ?? null;

  return { weapons, missions, skillNodes, playerStats, selectedMission };
};

/** 進行状況を保存する。ストレージが使えない環境では何もしない。 */
export const saveGameState = (state: RestoredState) => {
  const data: SaveData = {
    version: SAVE_VERSION,
    scrap: state.playerStats.scrap,
    beacons: state.playerStats.beacons,
    activeLoadout: state.playerStats.activeLoadout,
    weaponDamageLevels: state.playerStats.weaponDamageLevels,
    nodeLevels: state.playerStats.nodeLevels,
    unlockedWeaponIds: state.weapons.filter((w) => w.unlocked).map((w) => w.id),
    unlockedNodeIds: state.skillNodes.filter((n) => n.unlocked).map((n) => n.id),
    missionProgress: Object.fromEntries(
      state.missions.map((m) => [m.id, { unlocked: !!m.unlocked, cleared: !!m.cleared }])
    ),
    selectedMissionId: state.selectedMission?.id ?? null,
  };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    // 容量超過・プライベートモードなどは無視してゲームは継続
  }
};

/** セーブデータを消去する。 */
export const clearGameSave = () => {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // 無視
  }
};
