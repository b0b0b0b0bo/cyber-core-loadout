import React, { useState, useEffect } from 'react';
import {
  ScreenState,
  Weapon,
  WeaponSlot,
  Mission,
  SkillNode,
  PlayerStats,
  BattleResult,
} from './types';
import { loadGameState, saveGameState, clearGameSave } from './utils/save';
import { sound } from './utils/sound';
import { MissionMap3D } from './components/MissionMap3D';
import { LoadoutScreen } from './components/LoadoutScreen';
import { maxNodeLevel } from './data/nodeLevels';
import { SkillTreeScreen } from './components/SkillTreeScreen';
import { BattleScene3D } from './components/BattleScene3D';
import { ResultScreen } from './components/ResultScreen';
import { SettingsPanel } from './components/SettingsPanel';
import { cutCorners } from './theme';
import { motion, AnimatePresence } from 'motion/react';
import {
  Compass,
  Crosshair,
  GitFork,
  Volume2,
  VolumeX,
  Cpu,
  Settings,
} from 'lucide-react';

const NAV_ITEMS: { screen: ScreenState; label: string; sub: string; icon: React.ReactNode }[] = [
  { screen: 'MISSION_SELECT', label: 'MISSION', sub: '作戦選定', icon: <Compass className="w-3.5 h-3.5" /> },
  { screen: 'LOADOUT', label: 'LOADOUT', sub: '兵装編成', icon: <Crosshair className="w-3.5 h-3.5" /> },
  { screen: 'SKILL_TREE', label: 'GADGET', sub: 'ツリー強化', icon: <GitFork className="w-3.5 h-3.5" /> },
];

export default function App() {
  // Global Game State
  const [currentScreen, setCurrentScreen] = useState<ScreenState>('MISSION_SELECT');
  // 起動時にセーブデータから進行状況を復元（無ければ初期状態）
  const [initialGame] = useState(() => loadGameState());
  const [weapons, setWeapons] = useState<Weapon[]>(initialGame.weapons);
  const [missions, setMissions] = useState<Mission[]>(initialGame.missions);
  const [skillNodes, setSkillNodes] = useState<SkillNode[]>(initialGame.skillNodes);
  const [playerStats, setPlayerStats] = useState<PlayerStats>(initialGame.playerStats);

  // Active Selected Mission for 3D Map / Sortie
  const [selectedMission, setSelectedMission] = useState<Mission | null>(initialGame.selectedMission);

  // 進行状況が変わるたびに自動保存
  useEffect(() => {
    saveGameState({ weapons, missions, skillNodes, playerStats, selectedMission });
  }, [weapons, missions, skillNodes, playerStats, selectedMission]);

  // Last Battle Result
  const [lastBattleResult, setLastBattleResult] = useState<BattleResult | null>(null);

  // Sound Mute State
  const [isMuted, setIsMuted] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Start ambient on first interaction
  useEffect(() => {
    const handleFirstUserClick = () => {
      sound.startAmbient();
      window.removeEventListener('click', handleFirstUserClick);
    };
    window.addEventListener('click', handleFirstUserClick);
    return () => window.removeEventListener('click', handleFirstUserClick);
  }, []);

  // Screen Switch Handler
  const handleNavClick = (screen: ScreenState) => {
    sound.playUiClick();
    setCurrentScreen(screen);
  };

  // Toggle Mute
  const handleToggleMute = () => {
    const muted = sound.toggleMute();
    setIsMuted(muted);
  };

  // セーブデータ消去（初期状態に戻すためリロード）
  const handleResetSave = () => {
    clearGameSave();
    window.location.reload();
  };

  // Equip / Unequip Weapon to Slot
  const handleEquipWeapon = (slot: WeaponSlot, weaponId: string | null) => {
    setPlayerStats((prev) => ({
      ...prev,
      activeLoadout: {
        ...prev.activeLoadout,
        [slot]: weaponId,
      },
    }));
  };

  // Unlock Skill Node with Scrap:
  // When a WEAPON_UNLOCK node is unlocked, automatically unlock that weapon in common inventory
  // and make its specific upgrade nodes appear on the skill tree!
  const handleUnlockSkillNode = (nodeId: string, cost: number) => {
    if (playerStats.scrap < cost) return;

    const targetNode = skillNodes.find((n) => n.id === nodeId);

    // Deduct scrap and mark node unlocked
    setPlayerStats((prev) => ({ ...prev, scrap: prev.scrap - cost }));
    setSkillNodes((prev) =>
      prev.map((n) => (n.id === nodeId ? { ...n, unlocked: true } : n))
    );

    // If node unlocks a weapon, unlock it in the weapons list!
    if (targetNode?.nodeType === 'WEAPON_UNLOCK' && targetNode.unlocksWeaponId) {
      const weaponToUnlock = targetNode.unlocksWeaponId;
      setWeapons((prev) =>
        prev.map((w) => (w.id === weaponToUnlock ? { ...w, unlocked: true } : w))
      );
    }
  };

  // DEBUG: GADGET画面で G キー → 全武器を解放（武器解放ノードも解放済みにして専用強化ノードを出現させる）
  const handleUnlockAllWeapons = () => {
    setWeapons((prev) => prev.map((w) => (w.unlocked ? w : { ...w, unlocked: true })));
    setSkillNodes((prev) =>
      prev.map((n) => (n.nodeType === 'WEAPON_UNLOCK' && !n.unlocked ? { ...n, unlocked: true } : n))
    );
    sound.playUiClick();
  };

  // Upgrade Weapon Damage Level (Up to Level 100)
  const handleUpgradeWeaponDamage = (weaponId: string, levelsToAdd: number, totalCost: number) => {
    if (playerStats.scrap < totalCost) return;

    setPlayerStats((prev) => {
      const curLevel = prev.weaponDamageLevels?.[weaponId] || 0;
      const newLevel = Math.min(100, curLevel + levelsToAdd);
      return {
        ...prev,
        scrap: prev.scrap - totalCost,
        weaponDamageLevels: {
          ...prev.weaponDamageLevels,
          [weaponId]: newLevel,
        },
      };
    });
  };

  // Upgrade an unlocked skill node (Lv1 -> Lv10)
  const handleUpgradeNode = (nodeId: string, levelsToAdd: number, totalCost: number, beaconCost = 0) => {
    if (playerStats.scrap < totalCost || playerStats.beacons < beaconCost) return;
    const targetNode = skillNodes.find((n) => n.id === nodeId);
    setPlayerStats((prev) => {
      const cur = Math.max(1, prev.nodeLevels?.[nodeId] || 1);
      return {
        ...prev,
        scrap: prev.scrap - totalCost,
        beacons: prev.beacons - beaconCost,
        nodeLevels: { ...prev.nodeLevels, [nodeId]: Math.min(targetNode ? maxNodeLevel(targetNode) : 1, cur + levelsToAdd) },
      };
    });
  };

  // Start Mission
  const handleStartMission = (mission: Mission) => {
    sound.playUiClick();
    setSelectedMission(mission);
    setCurrentScreen('BATTLE');
  };

  // Finish Battle
  const handleFinishBattle = (result: BattleResult) => {
    // Apply rewards
    setPlayerStats((prev) => ({
      ...prev,
      scrap: prev.scrap + result.rewards.scrap,
      beacons: prev.beacons + result.rewards.cores,
    }));

    if (result.isVictory) {
      const clearedIdx = missions.findIndex((m) => m.id === result.missionId);
      let newlyUnlockedNext: Mission | undefined;
      if (clearedIdx >= 0 && clearedIdx + 1 < missions.length) {
        const nextM = missions[clearedIdx + 1];
        if (!nextM.unlocked) {
          newlyUnlockedNext = { ...nextM, unlocked: true };
        }
      }

      setMissions((prev) => {
        const updated = prev.map((m) => (m.id === result.missionId ? { ...m, cleared: true } : m));
        const idx = updated.findIndex((m) => m.id === result.missionId);
        if (idx >= 0 && idx + 1 < updated.length) {
          updated[idx + 1] = { ...updated[idx + 1], unlocked: true };
          setSelectedMission(updated[idx + 1]);
        } else if (idx >= 0) {
          setSelectedMission(updated[idx]);
        }
        return updated;
      });

      if (newlyUnlockedNext) {
        result = {
          ...result,
          rewards: {
            ...result.rewards,
            nextMissionUnlocked: newlyUnlockedNext,
          },
        };
      }

      if (result.rewards.weaponUnlocked) {
        setWeapons((prev) =>
          prev.map((w) =>
            w.id === result.rewards.weaponUnlocked?.id ? { ...w, unlocked: true } : w
          )
        );
      }
    }

    setLastBattleResult(result);
    setCurrentScreen('RESULT');
  };

  return (
    <div className="relative w-screen h-screen bg-hud-bg text-hud-text flex flex-col overflow-hidden font-body select-none">
      {/* TOP NAVIGATION BAR */}
      {currentScreen !== 'BATTLE' && (
        <header className="relative z-40 h-14 px-5 bg-hud-panel backdrop-blur-md flex items-center justify-between gap-8 shrink-0">
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-hud-accent/70 via-hud-line to-hud-line" />

          {/* Wordmark */}
          <div className="flex items-center gap-3 whitespace-nowrap shrink-0">
            <span className="w-2.5 h-2.5 bg-hud-accent rotate-45 shadow-[var(--hud-glow)]" />
            <h1 className="text-lg font-black font-cyber tracking-[0.2em] text-hud-text">CYBER CORE</h1>
            <span className="text-[9px] text-hud-accent font-mono tracking-[0.2em] px-1.5 py-0.5 border border-hud-accent/40">
              v3.0-TACTICAL
            </span>
          </div>

          {/* Navigation */}
          <nav className="flex items-stretch h-full">
            {NAV_ITEMS.map((item) => {
              const active = currentScreen === item.screen;
              return (
                <button
                  key={item.screen}
                  onClick={() => handleNavClick(item.screen)}
                  className={`relative px-5 flex items-center gap-2 text-[11px] font-cyber tracking-[0.18em] font-bold transition-colors cursor-pointer whitespace-nowrap ${
                    active ? 'text-hud-accent' : 'text-hud-muted hover:text-hud-text'
                  }`}
                >
                  {item.icon}
                  {item.label}
                  <span className={`text-[10px] font-gothic tracking-wider font-normal ${active ? 'text-hud-accent/80' : 'text-hud-dim'}`}>
                    {item.sub}
                  </span>
                  {active && (
                    <motion.span
                      layoutId="nav-underline"
                      className="absolute left-3 right-3 bottom-0 h-[2px] bg-hud-accent shadow-[var(--hud-glow)]"
                    />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Scrap counter, sound & settings */}
          <div className="flex items-center gap-2 whitespace-nowrap shrink-0">
            <div
              className="flex items-center gap-2 bg-hud-tile px-3.5 py-1.5 border border-hud-line text-xs"
              style={{ clipPath: cutCorners(8) }}
            >
              <Cpu className="w-3.5 h-3.5 text-hud-accent" />
              <span className="font-cyber font-bold text-hud-accent tabular-nums">{playerStats.scrap.toLocaleString()}</span>
              <span className="text-[9px] text-hud-dim font-cyber tracking-[0.2em]">SCRAP</span>
            </div>

            <button
              onClick={handleToggleMute}
              className="p-2 border border-hud-line hover:border-hud-line-strong text-hud-muted hover:text-hud-text transition-colors cursor-pointer"
              title={isMuted ? 'サウンドを有効化' : 'ミュート'}
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-hud-danger" /> : <Volume2 className="w-4 h-4 text-hud-accent" />}
            </button>
            <button
              onClick={() => {
                sound.playUiClick();
                setIsSettingsOpen(true);
              }}
              className="p-2 border border-hud-line hover:border-hud-accent/60 text-hud-muted hover:text-hud-accent transition-colors cursor-pointer"
              title="設定"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </header>
      )}

      <AnimatePresence>
        {isSettingsOpen && (
          <SettingsPanel
            isMuted={isMuted}
            onToggleMute={handleToggleMute}
            onResetSave={handleResetSave}
            onClose={() => setIsSettingsOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* SCREEN CONTAINER WITH SMOOTH FRAMER MOTION TRANSITIONS */}
      <main className="relative flex-1 w-full h-full min-h-0 overflow-hidden bg-hud-bg">
        <AnimatePresence mode="wait">
          {currentScreen === 'MISSION_SELECT' && (
            <motion.div
              key="MISSION_SELECT"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="w-full h-full"
            >
              <MissionMap3D
                missions={missions}
                selectedMission={selectedMission}
                onSelectMission={(m) => setSelectedMission(m)}
                onStartMission={handleStartMission}
                onUnlockAll={() => setMissions((prev) => prev.map((m) => (m.unlocked ? m : { ...m, unlocked: true })))}
              />
            </motion.div>
          )}

          {currentScreen === 'LOADOUT' && (
            <motion.div
              key="LOADOUT"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="w-full h-full theme-remap"
            >
              <LoadoutScreen
                weapons={weapons}
                activeLoadout={playerStats.activeLoadout}
                userScrap={playerStats.scrap}
                weaponDamageLevels={playerStats.weaponDamageLevels}
                onEquipWeapon={handleEquipWeapon}
                onGoToSkillTree={() => setCurrentScreen('SKILL_TREE')}
              />
            </motion.div>
          )}

          {currentScreen === 'SKILL_TREE' && (
            <motion.div
              key="SKILL_TREE"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="w-full h-full"
            >
              <SkillTreeScreen
                nodes={skillNodes}
                weapons={weapons}
                userScrap={playerStats.scrap}
                userBeacons={playerStats.beacons}
                weaponDamageLevels={playerStats.weaponDamageLevels}
                onUnlockNode={handleUnlockSkillNode}
                onUnlockAllWeapons={handleUnlockAllWeapons}
                onUpgradeWeaponDamage={handleUpgradeWeaponDamage}
                nodeLevels={playerStats.nodeLevels}
                onUpgradeNode={handleUpgradeNode}
              />
            </motion.div>
          )}

          {currentScreen === 'BATTLE' && selectedMission && (
            <motion.div
              key="BATTLE"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="w-full h-full"
            >
              <BattleScene3D
                mission={selectedMission}
                weapons={weapons}
                activeLoadout={playerStats.activeLoadout}
                skillNodes={skillNodes}
                weaponDamageLevels={playerStats.weaponDamageLevels}
                nodeLevels={playerStats.nodeLevels}
                onFinishBattle={handleFinishBattle}
                onExitToMenu={() => setCurrentScreen('MISSION_SELECT')}
              />
            </motion.div>
          )}

          {currentScreen === 'RESULT' && lastBattleResult && (
            <motion.div
              key="RESULT"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="w-full h-full"
            >
              <ResultScreen
                result={lastBattleResult}
                onRetry={() => {
                  sound.playUiClick();
                  setCurrentScreen('BATTLE');
                }}
                onGoToUpgrade={() => {
                  sound.playUiClick();
                  setCurrentScreen('SKILL_TREE');
                }}
                onReturnToMap={() => {
                  sound.playUiClick();
                  setCurrentScreen('MISSION_SELECT');
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
