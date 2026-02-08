
/**
 * Mascot Asset Manager & Registry
 *
 * Character and outfit getters/setters now delegate to useMascotStore.
 * The function signatures are preserved for backward compatibility
 * with non-React callers.
 */

import {
  MascotCharacter,
  MascotOutfit,
  SceneType,
  getMascotResourcePath,
  getMascotVideoSources,
  getResourceType
} from './mascotConfig';

import { useMascotStore } from './stores/mascotStore';

// Legacy action/view types for backward compatibility
export type MascotAction = 'idle' | 'jump' | 'wave' | 'run' | 'success';
export type MascotView = 'front' | 'back' | 'side';

// Re-export types from mascotConfig for convenience
export type { MascotCharacter, MascotOutfit, SceneType };

/**
 * Get the currently selected character from the store.
 */
export const getSelectedCharacter = (): MascotCharacter => {
  return useMascotStore.getState().character;
};

/**
 * Set the currently selected character via the store.
 * Also dispatches 'mascot-character-changed' event (handled inside store).
 */
export const setSelectedCharacter = (character: MascotCharacter): void => {
  useMascotStore.getState().setCharacter(character);
};

/**
 * Get the currently selected outfit from the store.
 */
export const getSelectedOutfit = (): MascotOutfit => {
  return useMascotStore.getState().outfit;
};

/**
 * Set the currently selected outfit via the store.
 * Also dispatches 'mascot-outfit-changed' event (handled inside store).
 */
export const setSelectedOutfit = (outfit: MascotOutfit): void => {
  useMascotStore.getState().setOutfit(outfit);
};

interface MascotConfig {
  character: MascotCharacter;
  action: MascotAction;
  view?: MascotView;
  outfit?: MascotOutfit;
}

/**
 * Get resource path (backward-compatible helper).
 * @deprecated Use getMascotResourcePath instead
 */
export const getMascotPath = ({
  character,
  action,
  view = 'front',
  outfit = 'default'
}: MascotConfig): string => {
  let scene: SceneType = 'default';

  if (view === 'back') {
    scene = 'travel';
  } else if (action === 'idle' || action === 'wave') {
    scene = 'onboarding';
  }

  return getMascotResourcePath(character, scene, outfit);
};

/**
 * Re-export scene-based resource helpers.
 */
export { getMascotResourcePath, getMascotVideoSources, getResourceType };

export const FALLBACK_MASCOT = "https://lh3.googleusercontent.com/aida-public/AB6AXuCnRMVMv3VQCalsOm2RCkci09ous1fHuESh9sMZOzls1ru6VuE5HAlxYcKU6AswyAOsq12l9kr0vdwHeD8hswbrsxz4xZRK5oDlUPQMkmsbBJks_RVJ7JpcWNSLbPi4ISfkMH__idCAOv8RTmRLMNFkIzfyPwb3vJzSQ628ux_fwHE7XdjKa0LbGIrGOhhEmLaWRqfg-nPFNVhkih46KYodq5ipAZkQGeaLwK99YG7Az-UcKbMDqfxhd6RQqOg4faz2K3kd90U7PsXV";
