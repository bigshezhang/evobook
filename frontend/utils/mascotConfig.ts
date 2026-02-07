/**
 * Mascot Resource Configuration
 * 
 * 统一管理助教资源的映射关系和路径配置
 */

export type MascotCharacter = 'oliver' | 'luna' | 'bolt';
export type MascotOutfit = 'default' | 'dress' | 'glass' | 'suit' | 'super';
export type SceneType = 'store' | 'onboarding' | 'hello' | 'travel' | 'default';

// 角色名称映射：代码中的名称 -> 资源文件名称
export const CHARACTER_MAPPING: Record<MascotCharacter, string> = {
  oliver: 'owl',
  luna: 'bee',
  bolt: 'sheep',
};

// 场景资源目录映射
export const SCENE_BASE_PATHS: Record<SceneType, string> = {
  store: '/compressed_output/cloth_processed',
  onboarding: '/compressed_output/smile_transparent',
  hello: '/compressed_output/dress_hello',
  travel: '/compressed_output/back_processed',
  default: '/compressed_output/smile_transparent', // 默认使用 smile_transparent
};

// 场景资源文件扩展名
export const SCENE_EXTENSIONS: Record<SceneType, 'webp' | 'mp4' | 'webm'> = {
  store: 'webp',      // 服装图片
  onboarding: 'webm',  // 微笑动画（支持透明通道）
  hello: 'webm',       // 问候动画（支持透明通道）
  travel: 'webp',     // 背影图片
  default: 'webm',
};

/**
 * 生成资源路径
 * @param character 角色
 * @param scene 场景
 * @param outfit 服装（可选）
 * @returns 完整的资源路径
 */
export function getMascotResourcePath(
  character: MascotCharacter,
  scene: SceneType,
  outfit: MascotOutfit = 'default'
): string {
  const basePath = SCENE_BASE_PATHS[scene];
  const extension = SCENE_EXTENSIONS[scene];
  const resourceCharacter = CHARACTER_MAPPING[character];
  
  // 不同场景的命名规则
  switch (scene) {
    case 'store':
      // 商店只显示服装，不需要角色名
      // 例如: /compressed_output/cloth_processed/dress.webp
      return outfit === 'default' 
        ? `${basePath}/default.webp`  // 如果没有 default 图片，可以返回空
        : `${basePath}/${outfit}.${extension}`;
    
    case 'onboarding':
      // 引导阶段：微笑动画
      // 例如: /compressed_output/smile/owl_smile.webm 或 owl_smile_dress.webm
      if (outfit === 'default') {
        return `${basePath}/${resourceCharacter}_smile.${extension}`;
      } else {
        return `${basePath}/${resourceCharacter}_smile_${outfit}.${extension}`;
      }
    
    case 'hello':
      // 问候动画：必须带服装
      // 例如: /compressed_output/dress_hello/owl_hello_dress.webm
      if (outfit === 'default') {
        // hello 动画没有 default 版本，使用 smile 作为回退
        return getMascotResourcePath(character, 'onboarding', 'default');
      }
      return `${basePath}/${resourceCharacter}_hello_${outfit}.${extension}`;
    
    case 'travel':
      // 背影图片
      // 例如: /compressed_output/back_processed/owl_back.webp 或 owl_back_dress.webp
      if (outfit === 'default') {
        return `${basePath}/${resourceCharacter}_back.${extension}`;
      } else {
        return `${basePath}/${resourceCharacter}_back_${outfit}.${extension}`;
      }
    
    case 'default':
    default:
      // 默认使用 onboarding 场景
      return getMascotResourcePath(character, 'onboarding', outfit);
  }
}

/**
 * 获取资源类型（图片或视频）
 */
export function getResourceType(scene: SceneType): 'image' | 'video' {
  const ext = SCENE_EXTENSIONS[scene];
  return (ext === 'mp4' || ext === 'webm') ? 'video' : 'image';
}

/**
 * 检查是否为视频场景
 */
export function isVideoScene(scene: SceneType): boolean {
  return getResourceType(scene) === 'video';
}
