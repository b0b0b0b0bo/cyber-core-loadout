import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import * as THREE from 'three';
import { Weapon } from '../types';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createDisplayWeapon } from '../utils/weaponModel';

interface HologramWeaponViewerProps {
  weapon: Weapon;
  className?: string;
}

export interface HologramWeaponViewerHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  reset: () => void;
  rotateStep: () => void;
}

const DEFAULT_CAMERA_Z = 5.6;
const MIN_CAMERA_Z = 3;
const MAX_CAMERA_Z = 9;
const CAMERA_Y = 0.9;

export const HologramWeaponViewer = forwardRef<HologramWeaponViewerHandle, HologramWeaponViewerProps>(({ weapon, className = '' }, ref) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const weaponGroupRef = useRef<THREE.Group | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 400;
    const height = container.clientHeight || 400;
    const weaponColor = new THREE.Color(weapon.color || '#38bdf8');

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(32, width / height, 0.1, 100);
    camera.position.set(0, CAMERA_Y, DEFAULT_CAMERA_Z);
    camera.lookAt(0, -0.1, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    rendererRef.current = renderer;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Image-based lighting so metal surfaces reflect something (matches the thumbnails)
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    // Lighting tuned for the light UI: soft sky fill + white key + coloured accent
    scene.add(new THREE.HemisphereLight(0xffffff, 0x9cc4e8, 2.0));
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.6);
    keyLight.position.set(3, 4, 4);
    scene.add(keyLight);
    const accent = new THREE.PointLight(weaponColor, 6, 12);
    accent.position.set(-2.5, 1, 2.5);
    scene.add(accent);
    const rimLight = new THREE.DirectionalLight(0x9fd4ff, 1.6);
    rimLight.position.set(-3, -1, -3);
    scene.add(rimLight);

    // Pedestal: concentric light-blue hologram rings under the weapon
    const pedestal = new THREE.Group();
    pedestal.position.y = -1.75;
    scene.add(pedestal);

    const discMat = new THREE.MeshBasicMaterial({ color: 0xdff1ff, transparent: true, opacity: 0.55, side: THREE.DoubleSide });
    const disc = new THREE.Mesh(new THREE.CircleGeometry(1.7, 64), discMat);
    disc.rotation.x = -Math.PI / 2;
    pedestal.add(disc);

    const ringSpecs: Array<[number, number, number]> = [
      [1.74, 1.8, 0.9],
      [1.45, 1.49, 0.55],
      [1.1, 1.13, 0.7],
    ];
    ringSpecs.forEach(([inner, outer, opacity]) => {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(inner, outer, 96),
        new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity, side: THREE.DoubleSide })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.01;
      pedestal.add(ring);
    });

    // Rotating dashed outer ring (tick marks)
    const tickRing = new THREE.Mesh(
      new THREE.RingGeometry(1.9, 2.0, 48, 1),
      new THREE.MeshBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.6, side: THREE.DoubleSide, wireframe: true })
    );
    tickRing.rotation.x = -Math.PI / 2;
    tickRing.position.y = 0.02;
    pedestal.add(tickRing);

    // Floating dust
    const particleCount = 50;
    const positions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 4;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 3;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 4;
    }
    const particleGeo = new THREE.BufferGeometry();
    particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const particles = new THREE.Points(
      particleGeo,
      new THREE.PointsMaterial({ color: 0x38bdf8, size: 0.035, transparent: true, opacity: 0.55 })
    );
    scene.add(particles);

    // Battle-scene weapon model, centred and scaled to fit
    const weaponGroup = createDisplayWeapon(weapon, 2.6);
    weaponGroupRef.current = weaponGroup;
    scene.add(weaponGroup);

    // Mouse drag interaction
    let isDragging = false;
    let prevMouseX = 0;
    let prevMouseY = 0;

    const handleMouseDown = (e: MouseEvent) => {
      isDragging = true;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
    };
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !weaponGroupRef.current) return;
      weaponGroupRef.current.rotation.y += (e.clientX - prevMouseX) * 0.012;
      weaponGroupRef.current.rotation.x += (e.clientY - prevMouseY) * 0.012;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
    };
    const handleMouseUp = () => {
      isDragging = false;
    };
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const cam = cameraRef.current;
      if (!cam) return;
      cam.position.z = THREE.MathUtils.clamp(cam.position.z + e.deltaY * 0.004, MIN_CAMERA_Z, MAX_CAMERA_Z);
    };

    container.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    container.addEventListener('wheel', handleWheel, { passive: false });

    const clock = new THREE.Clock();
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();
      if (!isDragging && weaponGroupRef.current) {
        weaponGroupRef.current.rotation.y += 0.01;
        weaponGroupRef.current.position.y = Math.sin(t * 1.8) * 0.06;
      }
      tickRing.rotation.z -= 0.004;
      particles.rotation.y += 0.002;
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (!w || !h) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(handleResize) : null;
    ro?.observe(container);

    return () => {
      cancelAnimationFrame(animationFrameId);
      ro?.disconnect();
      window.removeEventListener('resize', handleResize);
      container.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      container.removeEventListener('wheel', handleWheel);
      // Release the GL context right away; browsers cap live contexts and the loadout
      // thumbnails share the page with this viewer.
      renderer.dispose();
      renderer.forceContextLoss();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [weapon]);

  useImperativeHandle(ref, () => ({
    zoomIn: () => {
      const cam = cameraRef.current;
      if (cam) cam.position.z = THREE.MathUtils.clamp(cam.position.z - 0.7, MIN_CAMERA_Z, MAX_CAMERA_Z);
    },
    zoomOut: () => {
      const cam = cameraRef.current;
      if (cam) cam.position.z = THREE.MathUtils.clamp(cam.position.z + 0.7, MIN_CAMERA_Z, MAX_CAMERA_Z);
    },
    reset: () => {
      const cam = cameraRef.current;
      if (cam) cam.position.set(0, CAMERA_Y, DEFAULT_CAMERA_Z);
      if (weaponGroupRef.current) weaponGroupRef.current.rotation.set(0, 0, 0);
    },
    rotateStep: () => {
      if (weaponGroupRef.current) weaponGroupRef.current.rotation.y += Math.PI / 4;
    },
  }));

  return (
    <div
      ref={mountRef}
      className={`relative w-full h-full cursor-grab active:cursor-grabbing select-none ${className}`}
    />
  );
});

HologramWeaponViewer.displayName = 'HologramWeaponViewer';
