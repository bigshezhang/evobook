
/**
 * Mascot Asset Manager & Registry
 */

export type MascotCharacter = 'oliver' | 'luna' | 'bolt' | 'dog' | 'owl' | 'cat';
export type MascotAction = 'idle' | 'jump' | 'wave' | 'run' | 'success';
export type MascotOutfit = 'default' | 'hat' | 'suit' | 'glasses';
// 新增：视角维度
export type MascotView = 'front' | 'back' | 'side';

export const MASCOT_STORAGE_KEY = 'evo_user_mascot';

export const getSelectedCharacter = (): MascotCharacter => {
  const saved = localStorage.getItem(MASCOT_STORAGE_KEY);
  return (saved as MascotCharacter) || 'oliver';
};

export const setSelectedCharacter = (character: MascotCharacter) => {
  localStorage.setItem(MASCOT_STORAGE_KEY, character);
};

interface MascotConfig {
  character: MascotCharacter;
  action: MascotAction;
  view?: MascotView; // 新增视角参数
  outfit?: MascotOutfit;
}

const BASE_URL = '/assets/mascots'; 

export const getMascotPath = ({ 
  character, 
  action, 
  view = 'front', 
  outfit = 'default' 
}: MascotConfig): string => {
  // 路径规范更新: [character]_[view]_[action]_[outfit].mp4
  // 示例: oliver_back_jump_default.mp4
  return `${BASE_URL}/${character}_${view}_${action}_${outfit}.mp4`;
};

export const FALLBACK_MASCOT = "https://lh3.googleusercontent.com/aida-public/AB6AXuCnRMVMv3VQCalsOm2RCkci09ous1fHuESh9sMZOzls1ru6VuE5HAlxYcKU6AswyAOsq12l9kr0vdwHeD8hswbrsxz4xZRK5oDlUPQMkmsbBJks_RVJ7JpcWNSLbPi4ISfkMH__idCAOv8RTmRLMNFkIzfyPwb3vJzSQ628ux_fwHE7XdjKa0LbGIrGOhhEmLaWRqfg-nPFNVhkih46KYodq5ipAZkQGeaLwK99YG7Az-UcKbMDqfxhd6RQqOg4faz2K3kd90U7PsXV";
