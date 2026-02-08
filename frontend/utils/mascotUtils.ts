
/**
 * Mascot Asset Manager & Registry
 */

import {
  MascotCharacter,
  MascotOutfit,
  SceneType,
  getMascotResourcePath,
  getMascotVideoSources,
  getResourceType
} from './mascotConfig';

// 兼容旧代码的类型定义
export type MascotAction = 'idle' | 'jump' | 'wave' | 'run' | 'success';
export type MascotView = 'front' | 'back' | 'side';

// Re-export types from mascotConfig for convenience
export type { MascotCharacter, MascotOutfit, SceneType };

import { STORAGE_KEYS } from './constants';

// Storage keys
export const MASCOT_STORAGE_KEY = STORAGE_KEYS.USER_MASCOT;
export const OUTFIT_STORAGE_KEY = STORAGE_KEYS.USER_OUTFIT;

/**
 * 获取当前选中的角色
 */
export const getSelectedCharacter = (): MascotCharacter => {
  const saved = localStorage.getItem(MASCOT_STORAGE_KEY);
  return (saved as MascotCharacter) || 'oliver';
};

/**
 * 设置当前选中的角色
 */
export const setSelectedCharacter = (character: MascotCharacter) => {
  localStorage.setItem(MASCOT_STORAGE_KEY, character);
  // 触发自定义事件，通知其他组件角色已更新
  window.dispatchEvent(new CustomEvent('mascot-character-changed', { detail: character }));
};

/**
 * 获取当前选中的服装
 */
export const getSelectedOutfit = (): MascotOutfit => {
  const saved = localStorage.getItem(OUTFIT_STORAGE_KEY);
  return (saved as MascotOutfit) || 'default';
};

/**
 * 设置当前选中的服装
 */
export const setSelectedOutfit = (outfit: MascotOutfit) => {
  localStorage.setItem(OUTFIT_STORAGE_KEY, outfit);
  // 触发自定义事件，通知其他组件服装已更新
  window.dispatchEvent(new CustomEvent('mascot-outfit-changed', { detail: outfit }));
};

interface MascotConfig {
  character: MascotCharacter;
  action: MascotAction;
  view?: MascotView;
  outfit?: MascotOutfit;
}

/**
 * 获取资源路径（兼容旧代码）
 * @deprecated 请使用 getMascotResourcePath 代替
 */
export const getMascotPath = ({
  character,
  action,
  view = 'front',
  outfit = 'default'
}: MascotConfig): string => {
  // 根据 view 和 action 映射到新的 scene 系统
  let scene: SceneType = 'default';

  if (view === 'back') {
    scene = 'travel';
  } else if (action === 'idle' || action === 'wave') {
    scene = 'onboarding';
  }

  return getMascotResourcePath(character, scene, outfit);
};

/**
 * 获取场景化的资源路径（新方法）
 */
export { getMascotResourcePath, getMascotVideoSources, getResourceType };

export const FALLBACK_MASCOT = "https://lh3.googleusercontent.com/aida-public/AB6AXuCnRMVMv3VQCalsOm2RCkci09ous1fHuESh9sMZOzls1ru6VuE5HAlxYcKU6AswyAOsq12l9kr0vdwHeD8hswbrsxz4xZRK5oDlUPQMkmsbBJks_RVJ7JpcWNSLbPi4ISfkMH__idCAOv8RTmRLMNFkIzfyPwb3vJzSQ628ux_fwHE7XdjKa0LbGIrGOhhEmLaWRqfg-nPFNVhkih46KYodq5ipAZkQGeaLwK99YG7Az-UcKbMDqfxhd6RQqOg4faz2K3kd90U7PsXV";
