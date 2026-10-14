import * as THREE from 'three';
import { Weapon } from '../types';
import { populateBattleWeaponModel } from './battleWeaponModel';

/**
 * Loadout-screen weapon model.
 *
 * This is the SAME model that is used in battle (see battleWeaponModel.ts) — it is
 * only re-oriented, centred and scaled so it reads well on a display pedestal.
 * Used by both the big 3D viewer and the small list / slot thumbnails.
 */

/** Builds the battle model with its native (camera-space) orientation. */
export function buildWeaponModel(weapon: Weapon): THREE.Group {
  const group = new THREE.Group();
  populateBattleWeaponModel(group, weapon);
  return group;
}

/**
 * Returns a wrapper group containing the battle model, oriented for display
 * (long weapons shown side-on, blades upright with a slight tilt, gauntlets
 * facing the viewer), centred at the origin and scaled so its largest side is
 * `targetSize`. Callers rotate / animate the returned wrapper.
 */
export function createDisplayWeapon(weapon: Weapon, targetSize: number): THREE.Group {
  const model = buildWeaponModel(weapon);

  // Pick orientation from the model's longest axis (battle models point down -Z or stand along +Y)
  const native = new THREE.Box3().setFromObject(model);
  const size = native.getSize(new THREE.Vector3());

  const forwardExtent = Math.max(0, -native.min.z) + Math.max(0, native.max.z); // depth along the firing axis
  if (weapon.modelType === 'gauntlets') {
    model.rotation.y = Math.PI - 0.5; // face knuckles toward the viewer
    model.rotation.x = 0.15;
  } else if (weapon.modelType === 'twinblade') {
    model.rotation.x = 1.0; // stand both blades up in a V, facing the viewer
    model.rotation.y = 0.25;
  } else if (size.y >= size.z && size.y >= size.x && size.z < size.y * 0.3) {
    model.rotation.z = -0.55; // upright blade / polearm, tilted like a display pose
  } else {
    // long along Z (guns) or a haft with a forward-pointing head (harpoon, pile bunker): show side-on
    model.rotation.y = -Math.PI / 2 + (size.y > size.z ? 0.15 : 0.3);
    model.rotation.x = size.y > size.z ? 0.04 : 0.08;
    void forwardExtent;
  }

  const box = new THREE.Box3().setFromObject(model);
  const fitSize = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const s = targetSize / (Math.max(fitSize.x, fitSize.y, fitSize.z) || 1);
  model.scale.setScalar(s);
  model.position.copy(center).multiplyScalar(-s);

  const wrapper = new THREE.Group();
  wrapper.add(model);
  return wrapper;
}
