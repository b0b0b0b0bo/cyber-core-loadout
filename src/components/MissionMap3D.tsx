import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { MapId, Mission, WorldMapDef } from '../types';
import { WORLD_MAPS, effectiveScrapReward } from '../data/initialData';
import { sound } from '../utils/sound';
import { getEnemyThumbnail } from '../utils/enemyThumbnails';
import {
  ShieldAlert,
  Cpu,
  Hexagon,
  Lock,
  CheckCircle2,
  Globe,
  AlertTriangle,
  Skull,
  Radar,
  Building2,
  Satellite,
  FlaskConical,
  Waves,
  Mountain,
  Snowflake,
  Trees,
  Flame,
  CloudLightning,
  CircuitBoard,
  FileText,
  Crosshair,
  Gift,
  ChevronsRight,
  ChevronsLeft,
  Play,
  Navigation,
} from 'lucide-react';
import { getRecommendedWeaponLevel } from './BattleScene3D';
import { usePalette, cutCorners } from '../theme';

const MAP_ICONS: Record<number, React.ReactNode> = {
  1: <Building2 className="w-5 h-5" />,
  2: <Satellite className="w-5 h-5" />,
  3: <FlaskConical className="w-5 h-5" />,
  4: <Waves className="w-5 h-5" />,
  5: <Mountain className="w-5 h-5" />,
  6: <Snowflake className="w-5 h-5" />,
  7: <Trees className="w-5 h-5" />,
  8: <Flame className="w-5 h-5" />,
  9: <CloudLightning className="w-5 h-5" />,
  10: <CircuitBoard className="w-5 h-5" />,
};

/** World-map districts: a shallow zig-zag centred on the origin, one spot per map (so adding a map needs no layout edit). */
const WORLD_SPACING = 1.9;
const WORLD_ZIGZAG = [1.6, -1.8, 1.0, -2.0, 1.4, -1.6, 1.1, -1.9];
const worldSpots: [number, number][] = WORLD_MAPS.map((_, i) => [(i - (WORLD_MAPS.length - 1) / 2) * WORLD_SPACING, WORLD_ZIGZAG[i % WORLD_ZIGZAG.length]]);

/** Ground-plane scale applied to Mission.mapCoords (x, z). Height comes from mapCoords[1]. */
const COORD_SCALE = 1.3;
const beaconGround = (m: Mission) => new THREE.Vector3(m.mapCoords[0] * COORD_SCALE, 0, m.mapCoords[2] * COORD_SCALE);
const beaconHeight = (m: Mission) => (m.isBoss ? 1.55 : 1.0) + (m.mapCoords[1] + 0.5) * 0.35;

/** Deterministic RNG so each map's skyline is always the same. */
const mulberry32 = (seed: number) => () => {
  let t = (seed += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

type ViewMode = 'world' | 'map';
type Status = 'locked' | 'cleared' | 'boss' | 'active';

const statusKind = (m: Mission): Status => (!m.unlocked ? 'locked' : m.cleared ? 'cleared' : m.isBoss ? 'boss' : 'active');

interface MissionMap3DProps {
  /** 表示用ミッション (ハード表示中は、ハード側の解放/クリア状況に差し替え済み) */
  missions: Mission[];
  /** 通常側の実進行 (MAP解放・ハード解放の判定用) */
  baseMissions: Mission[];
  selectedMission: Mission | null;
  onSelectMission: (mission: Mission) => void;
  onStartMission: (mission: Mission) => void;
  /** ハードモード (そのMAPのボス撃破後に選択可能) */
  hardMode: boolean;
  onToggleHard: (hard: boolean) => void;
  /** Debug shortcut (G): unlock every stage. */
  onUnlockAll?: () => void;
}

export const MissionMap3D: React.FC<MissionMap3DProps> = ({ missions, baseMissions, selectedMission, onSelectMission, onStartMission, hardMode, onToggleHard, onUnlockAll }) => {
  useEffect(() => {
    if (!onUnlockAll) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      if (e.key === 'g' || e.key === 'G') onUnlockAll();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onUnlockAll]);

  const mountRef = useRef<HTMLDivElement>(null);
  const labelElsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const compassRef = useRef<HTMLDivElement>(null);
  const hoveredIdRef = useRef<string | null>(null);
  const selectedIdRef = useRef<string | null>(selectedMission?.id ?? null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('map');
  const [activeMapId, setActiveMapId] = useState<MapId>(selectedMission?.mapId || 1);
  const [lockNotice, setLockNotice] = useState<string | null>(null);
  const HUD = usePalette();
  // ハードMAP表示中は黄色基調
  const HARD_COLOR = '#facc15';
  const isHardView = (id: number): boolean => {
    const def = WORLD_MAPS.find((wm) => wm.id === id);
    return hardMode && !!def && baseMissions.some((m) => m.id === def.bossMissionId && m.cleared);
  };
  const mapColor = (m: WorldMapDef) => (isHardView(m.id) ? HARD_COLOR : HUD.accent);
  const mapHex = (m: WorldMapDef) => parseInt(mapColor(m).replace('#', ''), 16);

  // A map opens once the previous map's boss is cleared (or any of its stages is already unlocked, e.g. via save data / debug unlock).
  const isMapUnlocked = (id: number) => {
    const def = WORLD_MAPS.find((wm) => wm.id === id);
    if (!def?.requiredBossMissionId) return true;
    return baseMissions.some((m) => m.id === def.requiredBossMissionId && m.cleared) || baseMissions.some((m) => m.mapId === id && m.unlocked);
  };
  const isMapLocked = (id: number) => !isMapUnlocked(id);

  useEffect(() => {
    selectedIdRef.current = selectedMission?.id ?? null;
    if (selectedMission && selectedMission.mapId !== activeMapId) setActiveMapId(selectedMission.mapId);
  }, [selectedMission]);

  const activeMapDef = WORLD_MAPS.find((wm) => wm.id === activeMapId) || WORLD_MAPS[0];
  const activeMapMissions = missions.filter((m) => m.mapId === activeMapId);
  const hardOn = isHardView(activeMapId);
  const accent = mapColor(activeMapDef);

  const statusColor = (s: Status) =>
    s === 'locked' ? 'var(--hud-dim)' : s === 'cleared' ? 'var(--hud-ok)' : s === 'boss' ? 'var(--hud-danger)' : accent;

  const handleSelectMap = (mapId: MapId) => {
    if (isMapLocked(mapId)) {
      sound.playDefeat();
      const def = WORLD_MAPS.find((wm) => wm.id === mapId);
      setLockNotice(`【MAP ${mapId} ロック中】前のマップのボス「${def?.requiredBossName ?? ''}」を撃破すると解放されます！`);
      setTimeout(() => setLockNotice(null), 4000);
      return;
    }
    sound.playUiClick();
    setActiveMapId(mapId);
    setViewMode('map');
    const firstM =
      missions.find((m) => m.mapId === mapId && m.unlocked && !m.cleared) ||
      missions.find((m) => m.mapId === mapId && m.unlocked) ||
      missions.find((m) => m.mapId === mapId);
    if (firstM) onSelectMission(firstM);
  };

  const selectMission = (m: Mission) => {
    sound.playUiClick();
    onSelectMission(m);
  };

  // Latest callbacks for the three.js event handlers (the scene is not rebuilt on every render)
  const actionsRef = useRef({ handleSelectMap, selectMission, missions });
  actionsRef.current = { handleSelectMap, selectMission, missions };

  // Rebuild the scene only when what it draws changes (not on selection: that is read from a ref)
  const progressKey = (hardMode ? 'H' : 'N') + missions.map((m) => `${m.id}:${m.unlocked ? 1 : 0}${m.cleared ? 1 : 0}`).join('|');

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;
    const isWorld = viewMode === 'world';

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(HUD.three.fog, isWorld ? 0.035 : 0.045);

    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    // world view: pull the camera back until the outermost district (plus its ~1.7-unit-wide label) fits the canvas width
    const worldDist = (() => {
      const halfW = ((WORLD_MAPS.length - 1) / 2) * WORLD_SPACING + 2.4;
      const tanH = Math.tan((38 * Math.PI) / 360) * (width / height);
      return Math.max(16.6, halfW / tanH);
    })();
    const camBase = isWorld ? new THREE.Vector3(0, 0.568, 0.823).multiplyScalar(worldDist) : new THREE.Vector3(0, 7.0, 9.4);
    const camTarget = isWorld ? new THREE.Vector3(0, 0.4, -0.4) : new THREE.Vector3(-0.7, 0.9, -0.9);
    camera.position.copy(camBase);
    camera.lookAt(camTarget);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const root = new THREE.Group();
    scene.add(root);
    const disposables: { dispose: () => void }[] = [];
    const track = <T extends { dispose: () => void }>(x: T): T => {
      disposables.push(x);
      return x;
    };

    const themeHex = isWorld ? (HUD.isDark ? 0x38bdf8 : 0x0284c7) : mapHex(activeMapDef);
    const okHex = HUD.isDark ? 0x34d399 : 0x10b981;
    const dangerHex = HUD.isDark ? 0xfb7185 : 0xef4444;
    const lockedHex = HUD.three.locked;
    const lineOpacity = HUD.isDark ? 0.5 : 0.5;

    // ───────── ground: grid, radar rings, tick marks, sweep ─────────
    const grid = new THREE.GridHelper(16, 48, themeHex, HUD.three.grid);
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = HUD.isDark ? 0.35 : 0.55;
    root.add(grid);

    const ringMat = (opacity: number) =>
      track(new THREE.MeshBasicMaterial({ color: themeHex, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false }));
    [1.4, 2.6, 3.8, 5.0].forEach((r, i) => {
      const ring = new THREE.Mesh(track(new THREE.RingGeometry(r, r + (i === 3 ? 0.05 : 0.025), 128)), ringMat(0.35 + i * 0.08));
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.005;
      root.add(ring);
    });
    // outer bezel ticks
    const tickPos: number[] = [];
    for (let i = 0; i < 120; i++) {
      const a = (i / 120) * Math.PI * 2;
      const r0 = 5.12;
      const r1 = i % 10 === 0 ? 5.45 : i % 5 === 0 ? 5.3 : 5.2;
      tickPos.push(Math.cos(a) * r0, 0.01, Math.sin(a) * r0, Math.cos(a) * r1, 0.01, Math.sin(a) * r1);
    }
    const tickGeo = track(new THREE.BufferGeometry());
    tickGeo.setAttribute('position', new THREE.Float32BufferAttribute(tickPos, 3));
    root.add(new THREE.LineSegments(tickGeo, track(new THREE.LineBasicMaterial({ color: themeHex, transparent: true, opacity: 0.55 }))));

    // radar sweep wedge (canvas gradient texture)
    const sweepCanvas = document.createElement('canvas');
    sweepCanvas.width = sweepCanvas.height = 512;
    const sctx = sweepCanvas.getContext('2d')!;
    const c = new THREE.Color(themeHex);
    const rgb = `${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)}`;
    const cg = sctx.createConicGradient(0, 256, 256);
    cg.addColorStop(0, `rgba(${rgb},0)`);
    cg.addColorStop(0.75, `rgba(${rgb},0)`);
    cg.addColorStop(0.97, `rgba(${rgb},0.16)`);
    cg.addColorStop(0.995, `rgba(${rgb},0.45)`);
    cg.addColorStop(1, `rgba(${rgb},0)`);
    sctx.fillStyle = cg;
    sctx.beginPath();
    sctx.arc(256, 256, 256, 0, Math.PI * 2);
    sctx.fill();
    const sweepTex = track(new THREE.CanvasTexture(sweepCanvas));
    const sweep = new THREE.Mesh(
      track(new THREE.CircleGeometry(5.0, 96)),
      track(new THREE.MeshBasicMaterial({ map: sweepTex, transparent: true, depthWrite: false, blending: HUD.isDark ? THREE.AdditiveBlending : THREE.NormalBlending, opacity: HUD.isDark ? 0.5 : 0.4 }))
    );
    sweep.rotation.x = -Math.PI / 2;
    sweep.position.y = 0.02;
    root.add(sweep);

    // ───────── wireframe skyline ─────────
    const edgeMat = track(new THREE.LineBasicMaterial({ color: HUD.isDark ? new THREE.Color(themeHex).lerp(new THREE.Color(0xffffff), 0.35) : 0x7aa7c7, transparent: true, opacity: lineOpacity }));
    const faceMat = track(
      new THREE.MeshBasicMaterial({ color: HUD.isDark ? 0x0a1424 : 0xf4f8fc, transparent: true, opacity: HUD.isDark ? 0.35 : 0.45, depthWrite: true })
    );
    const addBuilding = (parent: THREE.Object3D, geo: THREE.BufferGeometry, x: number, y: number, z: number, ry = 0) => {
      track(geo);
      const mesh = new THREE.Mesh(geo, faceMat);
      const edges = new THREE.LineSegments(track(new THREE.EdgesGeometry(geo, 20)), edgeMat);
      [mesh, edges].forEach((o) => {
        o.position.set(x, y, z);
        o.rotation.y = ry;
        parent.add(o);
      });
    };

    /** A cluster of gothic/sci-fi buildings. `style` varies the silhouette per map. */
    const buildSkyline = (parent: THREE.Object3D, seed: number, style: number, rMin: number, rMax: number, count: number, avoid: THREE.Vector3[], scale = 1) => {
      const rnd = mulberry32(seed);
      let placed = 0;
      for (let tries = 0; placed < count && tries < count * 8; tries++) {
        const a = rnd() * Math.PI * 2;
        const r = rMin + Math.sqrt(rnd()) * (rMax - rMin);
        const x = Math.cos(a) * r;
        const z = Math.sin(a) * r;
        if (avoid.some((p) => (p.x - x) ** 2 + (p.z - z) ** 2 < 0.45)) continue;
        placed++;
        const w = (0.18 + rnd() * 0.3) * scale;
        const d = (0.18 + rnd() * 0.3) * scale;
        // outer ring is taller: reads like a city bowl around the arena
        const hBase = (0.4 + (r / rMax) * 1.6) * scale;
        const h = hBase * (0.5 + rnd() * 0.9) * (style === 2 ? 1.35 : style === 3 ? 0.75 : style === 4 ? 0.6 : style === 5 ? 1.15 : 1);
        const ry = rnd() * Math.PI;
        addBuilding(parent, new THREE.BoxGeometry(w, h, d), x, h / 2, z, ry);
        const kind = rnd();
        if (style === 1) {
          // gothic: pointed roofs and needle spires
          if (kind < 0.45) addBuilding(parent, new THREE.ConeGeometry(Math.max(w, d) * 0.62, h * 0.45, 4), x, h + h * 0.225, z, ry + Math.PI / 4);
          else if (kind < 0.7) addBuilding(parent, new THREE.ConeGeometry(w * 0.18, h * 0.9, 4), x, h + h * 0.45, z, ry);
        } else if (style === 2) {
          // orbital: stacked set-backs and antenna masts
          if (kind < 0.5) addBuilding(parent, new THREE.BoxGeometry(w * 0.6, h * 0.4, d * 0.6), x, h + h * 0.2, z, ry);
          if (kind > 0.6) addBuilding(parent, new THREE.CylinderGeometry(0.01, 0.01, h * 0.7, 4), x, h + h * 0.35, z, 0);
        } else if (style === 4) {
          // tidal ruins: glass domes, broken columns and sea stacks
          if (kind < 0.5) addBuilding(parent, new THREE.SphereGeometry(Math.min(w, d) * 0.8, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2), x, h, z, 0);
          else if (kind < 0.8) addBuilding(parent, new THREE.CylinderGeometry(w * 0.22, w * 0.3, h * 0.8, 6), x + w * 0.7, h * 0.4, z, 0);
        } else if (style === 5) {
          // silent wastes: crystal shards and leaning obelisks
          if (kind < 0.6) addBuilding(parent, new THREE.ConeGeometry(Math.max(w, d) * 0.4, h * 0.9, 5), x, h + h * 0.45, z, ry);
          else addBuilding(parent, new THREE.CylinderGeometry(0.01, w * 0.3, h * 1.2, 4), x + w * 0.5, h * 0.6, z, ry);
        } else if (style === 6) {
          // frozen archive: hexagonal ice towers with frosted caps and shards
          if (kind < 0.55) addBuilding(parent, new THREE.ConeGeometry(Math.max(w, d) * 0.5, h * 0.7, 6), x, h + h * 0.35, z, ry);
          else if (kind < 0.8) addBuilding(parent, new THREE.CylinderGeometry(w * 0.2, w * 0.35, h * 1.1, 6), x + w * 0.5, h * 0.55, z, ry);
        } else if (style === 7) {
          // overgrown sector: giant mushroom caps, tall trunks and leafy crowns
          if (kind < 0.45) addBuilding(parent, new THREE.SphereGeometry(Math.max(w, d) * 0.85, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2), x, h * 0.95, z, 0);
          else if (kind < 0.8) addBuilding(parent, new THREE.IcosahedronGeometry(Math.max(w, d) * 0.7, 0), x, h + Math.max(w, d) * 0.45, z, ry);
        } else if (style === 8) {
          // molten foundry: smokestacks, blast-furnace drums and slag cones
          if (kind < 0.4) addBuilding(parent, new THREE.CylinderGeometry(w * 0.22, w * 0.34, h * 1.5, 8), x, h * 0.75, z, 0);
          else if (kind < 0.7) addBuilding(parent, new THREE.CylinderGeometry(w * 0.5, w * 0.55, h * 0.5, 10), x, h * 0.3, z, 0);
          else if (kind < 0.9) addBuilding(parent, new THREE.ConeGeometry(Math.max(w, d) * 0.55, h * 0.8, 6), x, h + h * 0.4, z, ry);
        } else if (style === 9) {
          // storm array: cloud-puff domes, ring decks on pylons and lightning-rod spires
          if (kind < 0.4) addBuilding(parent, new THREE.SphereGeometry(Math.max(w, d) * 0.7, 10, 6), x, h + Math.max(w, d) * 0.4, z, 0);
          else if (kind < 0.7) addBuilding(parent, new THREE.TorusGeometry(Math.max(w, d) * 0.6, Math.max(w, d) * 0.12, 6, 14), x, h * 1.1, z, ry);
          else if (kind < 0.9) addBuilding(parent, new THREE.ConeGeometry(w * 0.18, h * 1.6, 5), x, h * 0.8, z, 0);
        } else if (style === 10) {
          // neon district: slab towers, round data pylons and antenna spires
          if (kind < 0.45) addBuilding(parent, new THREE.BoxGeometry(w * 0.8, h * 1.7, d * 0.8), x, h * 0.85, z, ry);
          else if (kind < 0.75) addBuilding(parent, new THREE.CylinderGeometry(w * 0.3, w * 0.36, h * 1.4, 8), x, h * 0.7, z, 0);
          else if (kind < 0.92) addBuilding(parent, new THREE.ConeGeometry(w * 0.16, h * 1.9, 4), x, h * 0.95, z, ry);
        } else {
          // research: domes and silos
          if (kind < 0.4) addBuilding(parent, new THREE.SphereGeometry(Math.min(w, d) * 0.55, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), x, h, z, 0);
          else if (kind < 0.6) addBuilding(parent, new THREE.CylinderGeometry(w * 0.3, w * 0.3, h * 0.5, 8), x + w * 0.6, h * 0.25, z, 0);
        }
      }
      // a few landmark spires
      for (let i = 0; i < 4; i++) {
        const a = rnd() * Math.PI * 2;
        const r = rMax * (0.75 + rnd() * 0.25);
        const x = Math.cos(a) * r;
        const z = Math.sin(a) * r;
        const h = (2.2 + rnd() * 1.4) * scale;
        addBuilding(parent, new THREE.BoxGeometry(0.34 * scale, h, 0.34 * scale), x, h / 2, z, a);
        addBuilding(parent, new THREE.ConeGeometry(0.26 * scale, h * 0.55, 4), x, h + h * 0.275, z, a + Math.PI / 4);
      }
    };

    // ───────── floating particles ─────────
    const pCount = 220;
    const pPos = new Float32Array(pCount * 3);
    const prnd = mulberry32(99);
    for (let i = 0; i < pCount; i++) {
      pPos[i * 3] = (prnd() - 0.5) * 11;
      pPos[i * 3 + 1] = prnd() * 3.5;
      pPos[i * 3 + 2] = (prnd() - 0.5) * 11;
    }
    const pGeo = track(new THREE.BufferGeometry());
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    const particles = new THREE.Points(
      pGeo,
      track(new THREE.PointsMaterial({ color: themeHex, size: 0.035, transparent: true, opacity: 0.75, depthWrite: false }))
    );
    root.add(particles);

    // ───────── beacons ─────────
    interface Beacon {
      id: string;
      crystal: THREE.Mesh;
      aura: THREE.Mesh;
      pulse: THREE.Mesh;
      target: THREE.Group;
      anchor: THREE.Object3D;
      baseY: number;
      phase: number;
      dim: boolean;
    }
    const beacons: Beacon[] = [];
    const hitTargets: THREE.Object3D[] = [];
    const routeDots: { curve: THREE.LineCurve3; dot: THREE.Mesh; offset: number }[] = [];

    const makeBeacon = (id: string, ground: THREE.Vector3, h: number, colorHex: number, size: number, dim: boolean, phase: number) => {
      const g = new THREE.Group();
      g.position.copy(ground);
      root.add(g);
      // ground target: disc + double ring
      const target = new THREE.Group();
      target.rotation.x = -Math.PI / 2;
      target.position.y = 0.03;
      const tMat = (o: number) => track(new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: o, side: THREE.DoubleSide, depthWrite: false }));
      target.add(new THREE.Mesh(track(new THREE.CircleGeometry(0.34 * size, 48)), tMat(dim ? 0.08 : 0.22)));
      target.add(new THREE.Mesh(track(new THREE.RingGeometry(0.34 * size, 0.38 * size, 48)), tMat(dim ? 0.3 : 0.85)));
      target.add(new THREE.Mesh(track(new THREE.RingGeometry(0.12 * size, 0.17 * size, 32)), tMat(dim ? 0.3 : 0.9)));
      g.add(target);
      const pulse = new THREE.Mesh(track(new THREE.RingGeometry(0.36, 0.4, 48)), tMat(dim ? 0 : 0.7));
      pulse.rotation.x = -Math.PI / 2;
      pulse.position.y = 0.04;
      g.add(pulse);
      // pin
      const pin = new THREE.Mesh(
        track(new THREE.CylinderGeometry(0.012, 0.012, h, 8)),
        track(new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: dim ? 0.35 : 0.85 }))
      );
      pin.position.y = h / 2;
      g.add(pin);
      // light column
      if (!dim) {
        const col = new THREE.Mesh(
          track(new THREE.CylinderGeometry(0.16 * size, 0.3 * size, h * 0.9, 24, 1, true)),
          track(new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.08, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }))
        );
        col.position.y = h * 0.45;
        g.add(col);
      }
      // crystal (stretched octahedron)
      const crystalGeo = track(new THREE.OctahedronGeometry(0.2 * size, 0));
      crystalGeo.scale(1, 1.45, 1);
      const crystal = new THREE.Mesh(
        crystalGeo,
        track(
          new THREE.MeshStandardMaterial({
            color: colorHex,
            emissive: colorHex,
            emissiveIntensity: dim ? 0.35 : 0.75,
            roughness: 0.25,
            metalness: 0.4,
            flatShading: true,
            transparent: dim,
            opacity: dim ? 0.8 : 1,
          })
        )
      );
      crystal.position.y = h;
      crystal.userData = { beaconId: id };
      g.add(crystal);
      const aura = new THREE.Mesh(
        crystalGeo,
        track(new THREE.MeshBasicMaterial({ color: colorHex, wireframe: true, transparent: true, opacity: dim ? 0.2 : 0.5 }))
      );
      aura.scale.setScalar(1.35);
      aura.position.y = h;
      g.add(aura);
      // generous invisible hitbox
      const hit = new THREE.Mesh(track(new THREE.CylinderGeometry(0.32 * size, 0.32 * size, h + 0.4, 8)), track(new THREE.MeshBasicMaterial({ visible: false })));
      hit.position.y = (h + 0.4) / 2;
      hit.userData = { beaconId: id };
      g.add(hit);
      hitTargets.push(hit);
      const anchor = new THREE.Object3D();
      anchor.position.y = h;
      g.add(anchor);
      beacons.push({ id, crystal, aura, pulse, target, anchor, baseY: h, phase, dim });
      return g;
    };

    const addRoute = (a: THREE.Vector3, b: THREE.Vector3, colorHex: number, live: boolean, dashed: boolean) => {
      const p0 = a.clone().setY(0.05);
      const p1 = b.clone().setY(0.05);
      const geo = track(new THREE.BufferGeometry().setFromPoints([p0, p1]));
      const mat = dashed
        ? track(new THREE.LineDashedMaterial({ color: colorHex, dashSize: 0.12, gapSize: 0.1, transparent: true, opacity: 0.6 }))
        : track(new THREE.LineBasicMaterial({ color: colorHex, transparent: true, opacity: 0.9 }));
      const line = new THREE.Line(geo, mat);
      if (dashed) line.computeLineDistances();
      root.add(line);
      // soft glow band under live routes
      if (live) {
        const len = p0.distanceTo(p1);
        const band = new THREE.Mesh(
          track(new THREE.PlaneGeometry(0.12, len)),
          track(new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide }))
        );
        band.position.copy(p0).add(p1).multiplyScalar(0.5).setY(0.03);
        band.rotation.x = -Math.PI / 2;
        band.rotation.z = -Math.atan2(p1.z - p0.z, p1.x - p0.x) + Math.PI / 2;
        root.add(band);
        for (let k = 0; k < 2; k++) {
          const dot = new THREE.Mesh(track(new THREE.SphereGeometry(0.035, 10, 8)), track(new THREE.MeshBasicMaterial({ color: colorHex })));
          root.add(dot);
          routeDots.push({ curve: new THREE.LineCurve3(p0.clone().setY(0.07), p1.clone().setY(0.07)), dot, offset: k * 0.5 });
        }
      }
    };

    if (isWorld) {
      const spots = worldSpots;
      WORLD_MAPS.forEach((wm, i) => {
        const [x, z] = spots[i] ?? [0, 0];
        const locked = isMapLocked(wm.id);
        const district = new THREE.Group();
        district.position.set(x, 0, z);
        root.add(district);
        buildSkyline(district, 11 + wm.id * 7, wm.id, 0.4, 1.2, 14, [new THREE.Vector3(0, 0, 0)], 0.6);
        const plate = new THREE.Mesh(
          track(new THREE.RingGeometry(1.32, 1.4, 6)),
          track(new THREE.MeshBasicMaterial({ color: locked ? lockedHex : mapHex(wm), transparent: true, opacity: 0.9, side: THREE.DoubleSide }))
        );
        plate.rotation.x = -Math.PI / 2;
        plate.position.y = 0.02;
        district.add(plate);
        makeBeacon(`map-${wm.id}`, new THREE.Vector3(x, 0, z), 1.9, locked ? lockedHex : mapHex(wm), 1.25, locked, i);
      });
      for (let i = 1; i < WORLD_MAPS.length && i < spots.length; i++) {
        const open = !isMapLocked(WORLD_MAPS[i].id);
        addRoute(new THREE.Vector3(spots[i - 1][0], 0, spots[i - 1][1]), new THREE.Vector3(spots[i][0], 0, spots[i][1]), open ? themeHex : lockedHex, open, !open);
      }
    } else {
      const grounds = activeMapMissions.map(beaconGround);
      buildSkyline(root, activeMapDef.id * 131, activeMapDef.id, 0.5, 5.3, 110, grounds);
      activeMapMissions.forEach((m, i) => {
        const s = statusKind(m);
        const hex = s === 'locked' ? lockedHex : s === 'cleared' ? okHex : s === 'boss' ? dangerHex : themeHex;
        makeBeacon(m.id, grounds[i], beaconHeight(m), hex, m.isBoss ? 1.3 : 1, s === 'locked', i);
        if (i > 0) {
          const live = m.unlocked;
          addRoute(grounds[i - 1], grounds[i], live ? (m.isBoss && !m.cleared ? dangerHex : themeHex) : lockedHex, live, !live);
        }
      });
    }

    // ───────── lights ─────────
    scene.add(new THREE.AmbientLight(0xffffff, HUD.three.ambient));
    const dir = new THREE.DirectionalLight(0xffffff, 1.6);
    dir.position.set(4, 8, 5);
    scene.add(dir);

    // ───────── interaction ─────────
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let dragging = false;
    let dragMoved = 0;
    let prevX = 0;
    let velocity = 0;
    let targetRot = 0;

    const setHover = (id: string | null) => {
      if (id === hoveredIdRef.current) return;
      hoveredIdRef.current = id;
      setHoveredId(id);
      if (id) sound.playScan();
    };

    const onPointerMove = (e: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      if (dragging) {
        const dx = e.clientX - prevX;
        prevX = e.clientX;
        dragMoved += Math.abs(dx);
        velocity = dx * 0.005;
        targetRot += velocity;
        return;
      }
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const hit = raycaster.intersectObjects(hitTargets, false)[0];
      setHover(hit ? (hit.object.userData.beaconId as string) : null);
      container.style.cursor = hit ? 'pointer' : 'grab';
    };
    const onPointerDown = (e: PointerEvent) => {
      dragging = true;
      dragMoved = 0;
      prevX = e.clientX;
      velocity = 0;
      container.style.cursor = 'grabbing';
    };
    const onPointerUp = () => {
      if (!dragging) return;
      dragging = false;
      container.style.cursor = 'grab';
      if (dragMoved < 4 && hoveredIdRef.current) activate(hoveredIdRef.current);
    };
    const activate = (id: string) => {
      const { handleSelectMap: selMap, selectMission: selM, missions: ms } = actionsRef.current;
      if (id.startsWith('map-')) {
        selMap(Number(id.slice(4)) as 1 | 2 | 3);
        return;
      }
      const m = ms.find((mm) => mm.id === id);
      if (m) selM(m);
    };
    container.addEventListener('pointermove', onPointerMove);
    container.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointerup', onPointerUp);
    const onLeave = () => setHover(null);
    container.addEventListener('pointerleave', onLeave);

    // ───────── loop ─────────
    let animId = 0;
    const clock = new THREE.Clock();
    const proj = new THREE.Vector3();
    const tmpScale = new THREE.Vector3();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();

      if (!dragging) {
        velocity *= 0.92;
        targetRot += velocity;
      }
      root.rotation.y += (targetRot - root.rotation.y) * 0.12;
      camera.position.set(camBase.x + Math.sin(t * 0.25) * 0.15, camBase.y + Math.sin(t * 0.4) * 0.05, camBase.z);
      camera.lookAt(camTarget);

      sweep.rotation.z = -t * 0.9;
      particles.rotation.y = t * 0.02;

      const selId = isWorld ? `map-${activeMapId}` : selectedIdRef.current;
      beacons.forEach((b) => {
        const active = b.id === selId || b.id === hoveredIdRef.current;
        b.crystal.rotation.y = t * 0.8 + b.phase;
        b.aura.rotation.y = -t * 0.5 + b.phase;
        const y = b.baseY + Math.sin(t * 1.6 + b.phase) * 0.05;
        b.crystal.position.y = y;
        b.aura.position.y = y;
        b.anchor.position.y = y;
        const s = active ? 1.3 : 1;
        b.crystal.scale.lerp(tmpScale.set(s, s, s), 0.15);
        const ts = b.id === selId ? 1.35 : 1;
        b.target.scale.lerp(tmpScale.set(ts, ts, ts), 0.15);
        const pp = (t * 0.6 + b.phase * 0.3) % 1;
        b.pulse.scale.setScalar(0.8 + pp * (b.id === selId ? 2.2 : 1.4));
        (b.pulse.material as THREE.MeshBasicMaterial).opacity = b.dim ? 0 : (1 - pp) * 0.75;
      });

      routeDots.forEach((r) => {
        const u = (t * 0.35 + r.offset) % 1;
        r.curve.getPoint(u, r.dot.position);
      });

      renderer.render(scene, camera);

      // project label anchors to screen space
      const w = container.clientWidth;
      const h = container.clientHeight;
      beacons.forEach((b) => {
        const el = labelElsRef.current.get(b.id);
        if (!el) return;
        b.anchor.getWorldPosition(proj);
        proj.project(camera);
        const x = (proj.x * 0.5 + 0.5) * w;
        const y = (-proj.y * 0.5 + 0.5) * h;
        el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
        el.style.zIndex = String(Math.round((1 - proj.z) * 1000));
      });
      if (compassRef.current) compassRef.current.style.transform = `rotate(${(-root.rotation.y * 180) / Math.PI}deg)`;
    };
    animate();

    const handleResize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const ro = new ResizeObserver(handleResize);
    ro.observe(container);

    return () => {
      cancelAnimationFrame(animId);
      ro.disconnect();
      container.removeEventListener('pointermove', onPointerMove);
      container.removeEventListener('pointerdown', onPointerDown);
      container.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('pointerup', onPointerUp);
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, activeMapId, progressKey, HUD]);

  const hostileThumbs = useMemo(() => {
    const out: Record<string, string | null> = {};
    selectedMission?.enemies.forEach((e) => {
      if (!(e.enemyTypeId in out)) out[e.enemyTypeId] = getEnemyThumbnail(e.enemyTypeId);
    });
    return out;
  }, [selectedMission?.id]);

  const clearedCount = activeMapMissions.filter((m) => m.cleared).length;
  const selKind = selectedMission ? statusKind(selectedMission) : null;
  const selColor = selKind ? statusColor(selKind) : accent;
  const ctaColor = selectedMission?.isBoss && !selectedMission.cleared ? 'var(--hud-danger)' : accent;
  const hardAvailable = !!selectedMission && baseMissions.some((m) => m.id === activeMapDef.bossMissionId && m.cleared);
  const hovered = hoveredId && !hoveredId.startsWith('map-') ? missions.find((m) => m.id === hoveredId) : null;

  const StatusIcon: React.FC<{ s: Status; className?: string }> = ({ s, className = 'w-3.5 h-3.5' }) =>
    s === 'cleared' ? <CheckCircle2 className={className} /> : s === 'locked' ? <Lock className={className} /> : s === 'boss' ? <Skull className={className} /> : <Crosshair className={className} />;

  const panelStyle: React.CSSProperties = {
    background: 'var(--hud-panel)',
    border: '1px solid var(--hud-line)',
    boxShadow: HUD.isDark ? '0 10px 30px rgba(0,0,0,0.35)' : '0 10px 30px rgba(15,40,80,0.08)',
  };

  return (
    <div className="relative w-full h-full overflow-hidden flex text-hud-text" style={{ background: 'var(--hud-backdrop)' }}>
      {/* ═════════ 3D RADAR ═════════ */}
      <div className="relative flex-1 h-full min-w-0">
        <div ref={mountRef} className="absolute inset-0" style={{ cursor: 'grab', touchAction: 'none' }} />
        <div className="pointer-events-none absolute inset-0 hud-scanlines opacity-60" />
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: 'radial-gradient(ellipse at 50% 55%, transparent 55%, var(--hud-vignette) 100%)' }}
        />

        {/* Projected beacon labels */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {viewMode === 'map'
            ? activeMapMissions.map((m) => {
                const s = statusKind(m);
                const col = statusColor(s);
                const isSel = selectedMission?.id === m.id;
                const isHov = hoveredId === m.id;
                return (
                  <div
                    key={m.id}
                    ref={(el) => {
                      if (el) labelElsRef.current.set(m.id, el);
                      else labelElsRef.current.delete(m.id);
                    }}
                    className="absolute left-0 top-0 will-change-transform"
                  >
                    <button
                      onClick={() => selectMission(m)}
                      onMouseEnter={() => setHoveredId(m.id)}
                      onMouseLeave={() => setHoveredId(null)}
                      className="pointer-events-auto absolute flex items-center gap-2 pl-2 pr-3 py-1.5 text-left whitespace-nowrap cursor-pointer transition-all duration-200"
                      style={{
                        left: 22,
                        top: -18,
                        clipPath: cutCorners(7),
                        background: isSel
                          ? `color-mix(in srgb, ${col} 88%, #0b1220)`
                          : s === 'locked'
                          ? HUD.isDark
                            ? 'rgba(30,41,59,0.85)'
                            : 'rgba(71,85,105,0.82)'
                          : HUD.isDark
                          ? 'rgba(8,18,34,0.88)'
                          : 'rgba(30,58,95,0.86)',
                        color: '#f8fafc',
                        boxShadow: isSel || isHov ? `0 0 18px color-mix(in srgb, ${col} 55%, transparent)` : 'none',
                        transform: isHov && !isSel ? 'translateY(-2px)' : undefined,
                        opacity: s === 'locked' && !isSel && !isHov ? 0.85 : 1,
                      }}
                    >
                      <span
                        className="w-5 h-5 grid place-items-center rounded-full shrink-0"
                        style={{ background: isSel ? 'rgba(255,255,255,0.22)' : `color-mix(in srgb, ${col} 35%, transparent)`, color: isSel ? '#fff' : col }}
                      >
                        <StatusIcon s={s} className="w-3 h-3" />
                      </span>
                      <span className="leading-tight">
                        <span className="block text-[11px] font-cyber font-bold tracking-[0.12em]">{m.code}</span>
                        <span className="block text-[10px] font-gothic opacity-85">{m.name}</span>
                      </span>
                    </button>
                    {/* leader line */}
                    <span className="absolute h-px" style={{ left: 6, top: 0, width: 16, background: col, opacity: 0.8 }} />
                  </div>
                );
              })
            : WORLD_MAPS.map((wm) => {
                const locked = isMapLocked(wm.id);
                const col = locked ? 'var(--hud-dim)' : mapColor(wm);
                const done = missions.filter((m) => m.mapId === wm.id && m.cleared).length;
                const total = missions.filter((m) => m.mapId === wm.id).length;
                return (
                  <div
                    key={wm.id}
                    ref={(el) => {
                      const k = `map-${wm.id}`;
                      if (el) labelElsRef.current.set(k, el);
                      else labelElsRef.current.delete(k);
                    }}
                    className="absolute left-0 top-0 will-change-transform"
                  >
                    <button
                      onClick={() => handleSelectMap(wm.id)}
                      className="pointer-events-auto absolute -translate-x-1/2 flex flex-col items-center gap-0.5 px-4 py-2 whitespace-nowrap cursor-pointer hover:-translate-y-0.5 transition-transform"
                      style={{
                        top: -92,
                        clipPath: cutCorners(9),
                        background: HUD.isDark ? 'rgba(8,18,34,0.9)' : 'rgba(30,58,95,0.88)',
                        color: '#f8fafc',
                        borderTop: `2px solid ${col}`,
                      }}
                    >
                      <span className="flex items-center gap-1.5 text-[10px] font-cyber tracking-[0.2em]" style={{ color: col }}>
                        {locked ? <Lock className="w-3 h-3" /> : MAP_ICONS[wm.id]}
                        {wm.badge}
                      </span>
                      <span className="text-sm font-cyber font-bold tracking-wider">{wm.name.split('//')[0].trim()}</span>
                      <span className="text-[10px] font-gothic opacity-80">
                        {locked ? `ロック中 — ${wm.requiredBossName ?? ''} 撃破で解放` : `${wm.name.split('//')[1]?.trim()} ・ ${done}/${total} CLEARED`}
                      </span>
                    </button>
                  </div>
                );
              })}
        </div>

        {/* Title block */}
        <div className="pointer-events-none absolute top-5 left-6 max-w-[420px]">
          <div className="flex items-center gap-2 text-[11px] font-cyber tracking-[0.25em]" style={{ color: accent }}>
            <Radar className="w-3.5 h-3.5" />
            3D TACTICAL ORBIT RADAR <span className="text-hud-dim">//</span>
            <span className="font-gothic tracking-[0.15em]">戦略マップ</span>
          </div>
          {viewMode === 'world' ? (
            <>
              <h2 className="mt-2 text-[40px] leading-none font-black font-cyber tracking-[0.06em]">WORLD MAP</h2>
              <div className="mt-1.5 text-sm font-cyber font-bold tracking-[0.15em]" style={{ color: accent }}>
                AREA 01 - {String(WORLD_MAPS.length).padStart(2, '0')} <span className="font-gothic">// 作戦区域全域</span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-hud-muted">各エリアのボスを撃破すると次のエリアへの侵攻ルートが開通する。</p>
            </>
          ) : (
            <>
              <h2 className="mt-2 text-[40px] leading-none font-black font-cyber tracking-[0.06em]">
                {activeMapDef.name.split('//')[0].trim()}
              </h2>
              <div className="mt-1.5 text-sm font-cyber font-bold tracking-[0.15em]" style={{ color: accent }}>
                {activeMapDef.subName.split('//')[0].trim()} <span className="font-gothic">// {activeMapDef.subName.split('//')[1]?.trim()}</span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-hud-muted">{activeMapDef.description}</p>
              <div className="mt-3 flex items-center gap-2.5">
                <div className="flex gap-1">
                  {activeMapMissions.map((m) => (
                    <span
                      key={m.id}
                      className="w-6 h-1.5 -skew-x-12"
                      style={{ background: m.cleared ? 'var(--hud-ok)' : m.unlocked ? accent : 'var(--hud-line-strong)' }}
                    />
                  ))}
                </div>
                <span className="text-[10px] font-mono text-hud-muted tabular-nums">
                  CLEARED {clearedCount}/{activeMapMissions.length}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Map tabs + route */}
        <div className="absolute top-4 right-5 flex flex-col items-end gap-2.5 z-10" style={{ maxWidth: 'calc(100% - 470px)' }}>
          <div className="flex flex-wrap justify-end items-stretch gap-1.5 p-1.5 backdrop-blur-md" style={{ ...panelStyle, clipPath: cutCorners(12) }}>
            <button
              onClick={() => {
                sound.playUiClick();
                setViewMode('world');
              }}
              className="flex items-center gap-2.5 px-3.5 py-2 cursor-pointer transition-all"
              style={
                viewMode === 'world'
                  ? { background: accent, color: '#fff', clipPath: cutCorners(8) }
                  : { color: 'var(--hud-muted)' }
              }
            >
              <Globe className="w-5 h-5" />
              <span className="text-left text-[11px] font-cyber font-bold leading-tight tracking-[0.12em]">
                WORLD
                <br />
                MAP
              </span>
            </button>
            {(() => {
              const idx = WORLD_MAPS.findIndex((wm) => wm.id === activeMapId);
              const wm = WORLD_MAPS[idx];
              const isCur = viewMode === 'map';
              const c = mapColor(wm);
              const arrow = (dir: -1 | 1) => {
                const target = WORLD_MAPS[idx + dir];
                const Icon = dir < 0 ? ChevronsLeft : ChevronsRight;
                return (
                  <button
                    onClick={() => target && handleSelectMap(target.id)}
                    disabled={!target}
                    title={target ? `${target.badge} ${target.name.split('//')[0].trim()}` : undefined}
                    className="w-9 flex items-center justify-center cursor-pointer transition-all hover:bg-hud-tile disabled:opacity-25 disabled:cursor-default"
                    style={{ color: c, clipPath: cutCorners(8) }}
                  >
                    <Icon className="w-5 h-5" />
                  </button>
                );
              };
              return (
                <>
                  {arrow(-1)}
                  <button
                    onClick={() => handleSelectMap(wm.id)}
                    title={wm.name}
                    className="relative flex items-center gap-2 pl-2.5 pr-3 py-2 min-w-[150px] cursor-pointer transition-all"
                    style={{
                      clipPath: cutCorners(8),
                      background: isCur ? `linear-gradient(135deg, ${c}, color-mix(in srgb, ${c} 70%, #0b1220))` : HUD.isDark ? 'rgba(15,23,42,0.6)' : 'rgba(226,232,240,0.6)',
                      color: isCur ? '#fff' : 'var(--hud-muted)',
                      boxShadow: isCur ? `0 0 18px color-mix(in srgb, ${c} 45%, transparent)` : 'none',
                    }}
                  >
                    {MAP_ICONS[wm.id]}
                    <span className="text-left leading-tight">
                      <span className="block text-[10px] font-cyber tracking-[0.18em] opacity-90">{wm.badge}</span>
                      <span className="block text-[11px] font-cyber font-bold tracking-wider">{wm.name.split('//')[0].trim()}</span>
                    </span>
                    {baseMissions.some((m) => m.id === wm.bossMissionId && m.cleared) && (
                      <CheckCircle2 className="w-3.5 h-3.5 ml-auto" style={{ color: isCur ? '#fff' : 'var(--hud-ok)' }} />
                    )}
                  </button>
                  {arrow(1)}
                </>
              );
            })()}
          </div>

          {viewMode === 'map' && (
            <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1.5 px-3 py-2 backdrop-blur-md" style={{ ...panelStyle, clipPath: cutCorners(10) }}>
              <span className="text-[10px] font-cyber font-bold tracking-[0.18em] text-hud-muted mr-1 whitespace-nowrap">
                {activeMapDef.badge} ROUTE:
              </span>
              {activeMapMissions.map((m, i) => {
                const s = statusKind(m);
                const col = statusColor(s);
                const isSel = selectedMission?.id === m.id;
                return (
                  <React.Fragment key={m.id}>
                    {i > 0 && <ChevronsRight className="w-3 h-3 text-hud-dim shrink-0" />}
                    <button
                      onClick={() => selectMission(m)}
                      onMouseEnter={() => setHoveredId(m.id)}
                      onMouseLeave={() => setHoveredId(null)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-cyber font-bold tracking-wider border-2 rounded-md cursor-pointer transition-all whitespace-nowrap ${
                        m.isBoss && m.unlocked && !m.cleared ? 'animate-pulse-subtle' : ''
                      }`}
                      style={{
                        color: isSel ? '#fff' : col,
                        borderColor: s === 'locked' ? 'var(--hud-line-strong)' : col,
                        background: isSel ? (s === 'locked' ? 'var(--hud-muted)' : col) : `color-mix(in srgb, ${col} ${s === 'locked' ? 0 : 8}%, transparent)`,
                        boxShadow: isSel ? `0 0 14px color-mix(in srgb, ${col} 45%, transparent)` : 'none',
                      }}
                    >
                      <StatusIcon s={s} />
                      {m.code}
                      {m.isBoss && <span className="text-[9px] opacity-80">-BOSS</span>}
                    </button>
                  </React.Fragment>
                );
              })}
            </div>
          )}
        </div>

        {/* Lock toast */}
        {lockNotice && (
          <div
            className="absolute top-40 right-5 p-3.5 bg-hud-panel backdrop-blur-md border border-hud-warn/60 max-w-md text-xs text-hud-text flex items-start gap-2.5 z-20 shadow-[0_0_24px_rgba(251,191,36,0.2)]"
            style={{ clipPath: cutCorners(10) }}
          >
            <AlertTriangle className="w-4 h-4 text-hud-warn shrink-0 mt-0.5" />
            <div className="leading-relaxed">{lockNotice}</div>
          </div>
        )}

        {/* Compass */}
        <div className="pointer-events-none absolute left-8 bottom-[236px] w-14 h-14 rounded-full grid place-items-center backdrop-blur-sm" style={panelStyle}>
          <div ref={compassRef} className="relative w-full h-full">
            <span className="absolute left-1/2 top-0.5 -translate-x-1/2 text-[9px] font-cyber font-bold" style={{ color: accent }}>
              N
            </span>
            <Navigation className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5" style={{ color: accent }} />
          </div>
        </div>

        {/* Legend */}
        <div className="absolute bottom-5 left-5 w-[330px] px-5 py-4 backdrop-blur-md" style={{ ...panelStyle, clipPath: cutCorners(12) }}>
          <div className="text-[11px] font-cyber font-bold tracking-[0.18em] text-hud-muted mb-2.5">
            BEACON CLASSIFICATION <span className="text-hud-dim">//</span> <span className="font-gothic">信号定義</span>
          </div>
          {[
            { color: accent, icon: <span className="w-3 h-3 rotate-45" style={{ background: accent }} />, label: '未クリア作戦（Active Mission）', sub: '現在選択可能なミッションです。' },
            { color: 'var(--hud-ok)', icon: <CheckCircle2 className="w-4 h-4" />, label: '制圧完了（Cleared）', sub: '既にクリアしたミッションです。' },
            { color: 'var(--hud-danger)', icon: <span className="w-3 h-3 rotate-45" style={{ background: 'var(--hud-danger)' }} />, label: '決戦ボスエリア（Boss Threat）', sub: 'ボスが出現する高危険度エリアです。' },
            { color: 'var(--hud-dim)', icon: <Lock className="w-4 h-4" />, label: 'ロック中セクター（Locked）', sub: '前の作戦をクリアすると解放されます。' },
          ].map((it) => (
            <div key={it.label} className="flex items-start gap-3 py-1">
              <span className="w-4 h-4 mt-0.5 grid place-items-center shrink-0" style={{ color: it.color }}>
                {it.icon}
              </span>
              <div className="leading-tight">
                <div className="text-xs font-bold" style={{ color: it.color === 'var(--hud-dim)' ? 'var(--hud-muted)' : it.color }}>
                  {it.label}
                </div>
                <div className="text-[10px] text-hud-dim mt-0.5">{it.sub}</div>
              </div>
            </div>
          ))}
        </div>

        {hovered && hovered.id !== selectedMission?.id && (
          <div className="pointer-events-none absolute bottom-5 right-5 px-3 py-2 backdrop-blur-md text-xs text-hud-muted" style={panelStyle}>
            クリックで選択: <span className="font-bold text-hud-text">{hovered.code} {hovered.name}</span>
          </div>
        )}
        {viewMode === 'map' && (
          <div className="pointer-events-none absolute bottom-5 left-1/2 -translate-x-1/2 text-[10px] font-cyber tracking-[0.2em] text-hud-dim">
            DRAG TO ROTATE // ドラッグで回転
          </div>
        )}
      </div>

      {/* ═════════ BRIEFING PANEL ═════════ */}
      <aside className="relative w-[400px] shrink-0 h-full flex flex-col gap-3 p-4 pl-0 z-20">
        {selectedMission && selKind ? (
          <>
            <div className="flex-1 min-h-0 flex flex-col backdrop-blur-xl overflow-hidden" style={{ ...panelStyle, clipPath: cutCorners(16) }}>
              <div className="h-[3px] shrink-0" style={{ background: `linear-gradient(90deg, ${selColor}, transparent)` }} />
              <div className="flex-1 min-h-0 overflow-y-auto p-5 flex flex-col gap-4">
                {/* Header */}
                <div>
                  <div className="flex items-center justify-between">
                    <span
                      className="px-3 py-1 text-sm font-cyber font-black tracking-[0.15em] text-white"
                      style={{ background: selColor, clipPath: cutCorners(6) }}
                    >
                      {selectedMission.code}
                    </span>
                    <span
                      className="px-3 py-0.5 text-[11px] font-cyber font-bold tracking-[0.15em] rounded-full border"
                      style={{ color: selColor, borderColor: selColor, background: `color-mix(in srgb, ${selColor} 10%, transparent)` }}
                    >
                      {selKind === 'locked' ? 'LOCKED' : selKind === 'cleared' ? 'CLEARED' : selKind === 'boss' ? ('BOSS') : 'ACTIVE'}
                    </span>
                  </div>
                  <h3 className="mt-3 text-[26px] leading-tight font-black font-gothic tracking-wide">{selectedMission.name}</h3>
                  <div className="mt-1 text-[11px] font-cyber tracking-[0.15em] text-hud-muted">{selectedMission.areaName}</div>
                  <div className="mt-3 h-px" style={{ background: `linear-gradient(90deg, ${selColor} 0 40px, var(--hud-line) 40px)` }} />
                </div>

                {/* Threat */}
                <div className="flex items-center justify-between px-4 py-3 rounded-lg bg-hud-tile border border-hud-line">
                  <div className="flex items-center gap-2 text-xs font-bold">
                    <ShieldAlert className="w-4 h-4 text-hud-warn" />
                    作戦脅威度 <span className="text-hud-dim font-cyber text-[10px] tracking-wider">(THREAT)</span>
                  </div>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((lvl) => (
                      <span
                        key={lvl}
                        className="w-4 h-3 rounded-full"
                        style={{
                          background:
                            lvl <= selectedMission.threatLevel ? (selectedMission.isBoss ? 'var(--hud-danger)' : 'var(--hud-warn)') : 'var(--hud-line)',
                        }}
                      />
                    ))}
                  </div>
                </div>

                {/* Recommended weapon level */}
                <div className="flex items-center justify-between px-4 py-3 rounded-lg bg-hud-tile border border-hud-line">
                  <div className="flex items-center gap-2 text-xs font-bold">
                    <Crosshair className="w-4 h-4 text-hud-warn" />
                    推奨武器レベル <span className="text-hud-dim font-cyber text-[10px] tracking-wider">(REC. WEAPON LV)</span>
                  </div>
                  <div className="font-cyber text-lg font-black" style={{ color: selColor }}>
                    Lv {getRecommendedWeaponLevel(selectedMission, hardMode)}
                  </div>
                </div>

                {/* Briefing */}
                <section>
                  <SectionHead icon={<FileText className="w-4 h-4" />} jp="作戦概要" en="BRIEFING" color={accent} />
                  <p className="text-xs leading-relaxed text-hud-muted rounded-lg bg-hud-tile border border-hud-line px-4 py-3">
                    {selectedMission.description}
                  </p>
                </section>

                {/* Hostiles */}
                <section>
                  <SectionHead icon={<Skull className="w-4 h-4" />} jp="出現敵性体" en="HOSTILE UNITS" color={accent} />
                  <div className="flex flex-col gap-2">
                    {selectedMission.enemies.map((enemy, idx) => {
                      const thumb = hostileThumbs[enemy.enemyTypeId];
                      const boss = enemy.name.includes('[BOSS]');
                      return (
                        <div key={idx} className="flex items-center gap-3 p-2 pr-3 rounded-lg bg-hud-tile border border-hud-line">
                          <div
                            className="w-14 h-14 rounded-md shrink-0 grid place-items-center overflow-hidden"
                            style={{
                              background: HUD.isDark
                                ? 'radial-gradient(circle at 50% 40%, #1e3a5f, #0b1220)'
                                : 'radial-gradient(circle at 50% 40%, #e0f2fe, #cbd5e1)',
                              outline: boss ? '1px solid var(--hud-danger)' : undefined,
                            }}
                          >
                            {thumb ? <img src={thumb} alt="" className="w-full h-full object-contain" draggable={false} /> : <Skull className="w-6 h-6 text-hud-dim" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-bold truncate" style={boss ? { color: 'var(--hud-danger)' } : undefined}>
                              {enemy.name}
                            </div>
                            <div className="text-[11px] text-hud-dim truncate">{enemy.description}</div>
                          </div>
                          <span
                            className="px-2.5 py-1 rounded-md border text-sm font-cyber font-bold tabular-nums"
                            style={{ color: accent, borderColor: `color-mix(in srgb, ${accent} 50%, transparent)`, background: `color-mix(in srgb, ${accent} 8%, transparent)` }}
                          >
                            ×{enemy.count}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </section>

                {/* Rewards */}
                <section>
                  <SectionHead icon={<Gift className="w-4 h-4" />} jp="クリア報酬" en="REWARDS" color={accent} />
                  <div className="grid grid-cols-2 rounded-lg bg-hud-tile border border-hud-line divide-x divide-hud-line">
                    <div className="flex items-center gap-3 px-4 py-3">
                      <span className="w-10 h-10 grid place-items-center rounded-full" style={{ background: `color-mix(in srgb, ${accent} 15%, transparent)`, color: accent }}>
                        <Cpu className="w-5 h-5" />
                      </span>
                      <div>
                        <div className="text-[10px] text-hud-dim font-cyber tracking-wider">SCRAP</div>
                        <div className="text-xl font-cyber font-bold tabular-nums" style={{ color: accent }}>
                          +{effectiveScrapReward(selectedMission.scrapReward).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 px-4 py-3">
                      <span className="w-10 h-10 grid place-items-center rounded-full" style={{ background: 'color-mix(in srgb, var(--hud-warn) 15%, transparent)', color: 'var(--hud-warn)' }}>
                        <Hexagon className="w-5 h-5" />
                      </span>
                      <div>
                        <div className="text-[10px] text-hud-dim font-cyber tracking-wider">BEACON</div>
                        <div className="text-xl font-cyber font-bold tabular-nums text-hud-warn">+{selectedMission.coreReward}</div>
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            </div>

            {/* Sortie */}
            {hardAvailable && (
              <button
                onClick={() => onToggleHard(!hardMode)}
                className="shrink-0 h-10 flex items-center justify-between px-4 border text-xs font-cyber tracking-[0.2em] font-bold cursor-pointer transition-colors"
                style={{
                  borderColor: hardOn ? HARD_COLOR : 'var(--hud-line-strong)',
                  color: hardOn ? HARD_COLOR : 'var(--hud-muted)',
                  background: hardOn ? 'color-mix(in srgb, #facc15 14%, transparent)' : 'transparent',
                }}
              >
                <span className="flex items-center gap-2"><Skull className="w-4 h-4" />HARD MODE <span className="font-gothic tracking-wider font-normal">ハードモード</span></span>
                <span>{hardOn ? 'HARD MAP' : 'NORMAL'}</span>
              </button>
            )}
            {selectedMission.unlocked ? (
              <button
                onClick={() => onStartMission(selectedMission)}
                className="group relative shrink-0 h-[92px] flex items-center justify-center gap-4 text-white cursor-pointer transition-all hover:brightness-110 active:scale-[0.985]"
                style={{
                  clipPath: cutCorners(18),
                  background: `linear-gradient(135deg, color-mix(in srgb, ${ctaColor} 80%, white), ${ctaColor} 45%, color-mix(in srgb, ${ctaColor} 70%, #0b1220))`,
                  boxShadow: `0 10px 30px color-mix(in srgb, ${ctaColor} 40%, transparent)`,
                }}
              >
                <span className="absolute inset-[3px] border border-white/30 pointer-events-none" style={{ clipPath: cutCorners(16) }} />
                <span className="absolute inset-0 overflow-hidden pointer-events-none">
                  <span className="absolute -inset-y-4 -left-1/3 w-1/3 bg-white/20 skew-x-[-20deg] translate-x-0 group-hover:translate-x-[450%] transition-transform duration-700" />
                </span>
                <Play className="w-9 h-9 fill-current" />
                <span className="text-center leading-none">
                  <span className="block text-[34px] font-black font-gothic tracking-[0.12em]">{hardOn ? 'ハード出撃' : '出撃開始'}</span>
                  <span className="mt-1.5 flex items-center justify-center gap-2 text-[11px] font-cyber tracking-[0.6em] opacity-85">
                    <span className="w-5 h-px bg-white/70" />
                    SORTIE
                  </span>
                </span>
                <ChevronsRight className="w-9 h-9 opacity-70 group-hover:translate-x-1 transition-transform" />
              </button>
            ) : (
              <div
                className="shrink-0 h-[92px] flex flex-col items-center justify-center gap-1 bg-hud-tile border border-hud-line text-hud-dim"
                style={{ clipPath: cutCorners(18) }}
              >
                <Lock className="w-6 h-6" />
                <span className="text-xs font-bold tracking-wider">LOCKED // 前のステージクリアで解放</span>
              </div>
            )}
          </>
        ) : (
          <div className="h-full grid place-items-center text-center text-hud-dim text-xs backdrop-blur-xl" style={{ ...panelStyle, clipPath: cutCorners(16) }}>
            マップ上のビーコンを選択してください
          </div>
        )}
      </aside>
    </div>
  );
};

const SectionHead: React.FC<{ icon: React.ReactNode; jp: string; en: string; color: string }> = ({ icon, jp, en, color }) => (
  <div className="flex items-center gap-2 mb-2">
    <span style={{ color }}>{icon}</span>
    <span className="text-sm font-bold">{jp}</span>
    <span className="text-[11px] font-cyber tracking-wider text-hud-dim">({en})</span>
  </div>
);
