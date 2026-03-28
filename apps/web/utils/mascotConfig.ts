/**
 * Mascot Resource Configuration
 * 
 * 统一管理助教资源的映射关系和路径配置
 * 
 * 透明视频兼容策略：
 * - Chrome/Firefox: VP9 alpha (.webm)
 * - Safari: HEVC alpha (.mov, type="video/quicktime; codecs=hvc1")
 * HEVC source 必须在 WebM 前面，因为 Safari 虽然能播放 webm 但不支持 VP9 alpha
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
  default: '/compressed_output/smile_transparent',
};

// 场景资源类型
export const SCENE_RESOURCE_TYPE: Record<SceneType, 'image' | 'video'> = {
  store: 'image',
  onboarding: 'video',
  hello: 'video',
  travel: 'image',
  default: 'video',
};

// 图片场景的扩展名
export const IMAGE_EXTENSION: Record<string, string> = {
  store: 'webp',
  travel: 'webp',
};

/**
 * 视频源信息（用于 <source> 多格式 fallback）
 */
export interface VideoSource {
  src: string;
  type: string;
}

/**
 * 生成视频文件名的基础部分（不含扩展名）
 */
function getVideoBaseName(
  scene: SceneType,
  character: MascotCharacter,
  outfit: MascotOutfit
): string {
  const resourceCharacter = CHARACTER_MAPPING[character];

  switch (scene) {
    case 'onboarding':
    case 'default':
      return outfit === 'default'
        ? `${resourceCharacter}_smile`
        : `${resourceCharacter}_smile_${outfit}`;
    case 'hello':
      return `${resourceCharacter}_hello_${outfit}`;
    default:
      return '';
  }
}

/**
 * 检测浏览器视频格式支持（结果会缓存，只检测一次）
 */
let _preferredFormat: 'hevc' | 'webm' | null = null;

function getPreferredVideoFormat(): 'hevc' | 'webm' {
  if (_preferredFormat) return _preferredFormat;

  const video = document.createElement('video');
  // Safari 支持 HEVC alpha（透明视频更好）
  const canHEVC = video.canPlayType('video/quicktime; codecs="hvc1"') !== '';
  _preferredFormat = canHEVC ? 'hevc' : 'webm';
  return _preferredFormat;
}

/**
 * 根据浏览器能力只返回最佳格式，避免加载无用资源浪费流量
 * - Safari: HEVC alpha (.mov)
 * - Chrome/Firefox: VP9 alpha (.webm)
 */
export function getMascotVideoSources(
  character: MascotCharacter,
  scene: SceneType,
  outfit: MascotOutfit = 'default'
): VideoSource[] {
  // hello 场景没有 default 版本，回退到 onboarding
  if (scene === 'hello' && outfit === 'default') {
    return getMascotVideoSources(character, 'onboarding', 'default');
  }
  if (scene === 'default') {
    return getMascotVideoSources(character, 'onboarding', outfit);
  }

  const basePath = SCENE_BASE_PATHS[scene];
  const baseName = getVideoBaseName(scene, character, outfit);
  const format = getPreferredVideoFormat();

  if (format === 'hevc') {
    return [{ src: `${basePath}/${baseName}.mov`, type: 'video/quicktime; codecs="hvc1"' }];
  }
  return [{ src: `${basePath}/${baseName}.webm`, type: 'video/webm' }];
}

/**
 * 生成资源路径（图片场景用，视频场景请用 getMascotVideoSources）
 */
export function getMascotResourcePath(
  character: MascotCharacter,
  scene: SceneType,
  outfit: MascotOutfit = 'default'
): string {
  const basePath = SCENE_BASE_PATHS[scene];
  const resourceCharacter = CHARACTER_MAPPING[character];

  switch (scene) {
    case 'store': {
      const ext = IMAGE_EXTENSION['store'];
      return outfit === 'default'
        ? `${basePath}/default.webp`
        : `${basePath}/${outfit}.${ext}`;
    }

    case 'travel': {
      const ext = IMAGE_EXTENSION['travel'];
      return outfit === 'default'
        ? `${basePath}/${resourceCharacter}_back.${ext}`
        : `${basePath}/${resourceCharacter}_back_${outfit}.${ext}`;
    }

    // 视频场景：返回 webm 路径作为默认（兼容旧代码）
    case 'onboarding':
    case 'hello':
    case 'default':
    default: {
      const sources = getMascotVideoSources(character, scene, outfit);
      // 返回 webm 源（列表中最后一个）作为后备
      return sources[sources.length - 1].src;
    }
  }
}

/**
 * 获取资源类型（图片或视频）
 */
export function getResourceType(scene: SceneType): 'image' | 'video' {
  return SCENE_RESOURCE_TYPE[scene] || 'video';
}

/**
 * 检查是否为视频场景
 */
export function isVideoScene(scene: SceneType): boolean {
  return getResourceType(scene) === 'video';
}
