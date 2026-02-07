
import React, { useState, useEffect } from 'react';
import { 
  getMascotResourcePath,
  getResourceType,
  MascotCharacter, 
  MascotOutfit,
  SceneType,
  FALLBACK_MASCOT,
  getSelectedCharacter,
  getSelectedOutfit
} from '../utils/mascotUtils';

interface MascotProps {
  character?: MascotCharacter;
  scene?: SceneType;           // 场景类型（新）
  outfit?: MascotOutfit;
  width?: string | number;
  className?: string;
  style?: React.CSSProperties;
  src?: string;                // 自定义资源路径
  autoPlay?: boolean;          // 视频自动播放控制
}

const Mascot: React.FC<MascotProps> = ({ 
  character, 
  scene = 'default',
  outfit, 
  width = "100%", 
  className = "", 
  style = {},
  src,
  autoPlay = true
}) => {
  // 获取当前角色和服装，优先使用 props，否则从 localStorage 读取
  const activeCharacter = character || getSelectedCharacter();
  const activeOutfit = outfit || getSelectedOutfit();
  
  const [currentSrc, setCurrentSrc] = useState<string>(src || FALLBACK_MASCOT);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [hasError, setHasError] = useState(false);

  // 监听全局状态变化
  useEffect(() => {
    const handleCharacterChange = () => {
      if (!character) {
        // 如果组件没有指定 character，则响应全局变化
        updateResource();
      }
    };

    const handleOutfitChange = () => {
      if (!outfit) {
        // 如果组件没有指定 outfit，则响应全局变化
        updateResource();
      }
    };

    window.addEventListener('mascot-character-changed', handleCharacterChange);
    window.addEventListener('mascot-outfit-changed', handleOutfitChange);

    return () => {
      window.removeEventListener('mascot-character-changed', handleCharacterChange);
      window.removeEventListener('mascot-outfit-changed', handleOutfitChange);
    };
  }, [character, outfit, scene]);

  const updateResource = () => {
    if (src) return; // 如果有自定义 src，不自动更新

    try {
      const newPath = getMascotResourcePath(
        activeCharacter,
        scene,
        activeOutfit
      );
      
      setIsTransitioning(true);
      setHasError(false);

      // 启用动态加载
      const timer = setTimeout(() => {
        setCurrentSrc(newPath);
        setIsTransitioning(false);
      }, 200);

      return () => clearTimeout(timer);
    } catch (error) {
      console.error('Failed to load mascot resource:', error);
      setHasError(true);
      setCurrentSrc(FALLBACK_MASCOT);
    }
  };

  useEffect(() => {
    updateResource();
  }, [activeCharacter, activeOutfit, scene, src]);

  // 错误处理
  const handleError = () => {
    console.warn(`Failed to load mascot resource: ${currentSrc}`);
    if (!hasError) {
      setHasError(true);
      setCurrentSrc(FALLBACK_MASCOT);
    }
  };

  // 判断资源类型
  const resourceType = src 
    ? (currentSrc.match(/\.(mp4|webm|mov|ogg)$/i) ? 'video' : 'image')
    : getResourceType(scene);

  return (
    <div 
      className={`relative inline-block transition-opacity duration-300 ${isTransitioning ? 'opacity-70' : 'opacity-100'} ${className}`}
      style={{ width, ...style }}
    >
      {resourceType === 'video' ? (
        <video
          key={currentSrc}
          src={currentSrc}
          className="w-full h-full pointer-events-none object-contain"
          autoPlay={autoPlay}
          loop
          muted
          playsInline
          onError={handleError}
        />
      ) : (
        <img
          key={currentSrc}
          src={currentSrc}
          className="w-full h-full pointer-events-none object-contain"
          alt="Mascot"
          onError={handleError}
        />
      )}
    </div>
  );
};

export default Mascot;
