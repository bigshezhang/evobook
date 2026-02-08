
import React, { useState, useEffect, useRef } from 'react';
import {
  getMascotResourcePath,
  getMascotVideoSources,
  getResourceType,
  MascotCharacter,
  MascotOutfit,
  SceneType,
  getSelectedCharacter,
  getSelectedOutfit
} from '../utils/mascotUtils';
import type { VideoSource } from '../utils/mascotConfig';

interface MascotProps {
  character?: MascotCharacter;
  scene?: SceneType;           // 场景类型
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

  const [currentSrc, setCurrentSrc] = useState<string>(src || '');
  const [videoSources, setVideoSources] = useState<VideoSource[]>([]);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [hasError, setHasError] = useState(false);

  // 监听全局状态变化
  useEffect(() => {
    const handleCharacterChange = () => {
      if (!character) {
        updateResource();
      }
    };

    const handleOutfitChange = () => {
      if (!outfit) {
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
      const resourceType = getResourceType(scene);

      setIsTransitioning(true);
      setHasError(false);

      const timer = setTimeout(() => {
        if (resourceType === 'video') {
          // 视频场景：生成多格式 source 列表
          const sources = getMascotVideoSources(activeCharacter, scene, activeOutfit);
          setVideoSources(sources);
          // currentSrc 用作 key 触发重新渲染
          setCurrentSrc(sources[sources.length - 1]?.src || '');
        } else {
          // 图片场景：单路径
          const newPath = getMascotResourcePath(activeCharacter, scene, activeOutfit);
          setVideoSources([]);
          setCurrentSrc(newPath);
        }
        setIsTransitioning(false);
      }, 200);

      return () => clearTimeout(timer);
    } catch (error) {
      console.error('Failed to load mascot resource:', error);
      setHasError(true);
      setCurrentSrc('');
    }
  };

  useEffect(() => {
    updateResource();
  }, [activeCharacter, activeOutfit, scene, src]);

  const videoRef = useRef<HTMLVideoElement>(null);

  // 资源加载失败处理
  const handleError = () => {
    console.warn(`Failed to load mascot resource: ${currentSrc}`);
    if (!hasError) {
      setHasError(true);
      setCurrentSrc('');
    }
  };

  // 判断资源类型
  const resourceType = src
    ? (currentSrc.match(/\.(mp4|webm|mov|ogg)$/i) ? 'video' : 'image')
    : getResourceType(scene);

  // 如果没有有效的资源路径，不渲染任何内容
  if (!currentSrc || hasError) {
    return null;
  }

  return (
    <div
      className={`relative inline-block transition-opacity duration-300 ${isTransitioning ? 'opacity-70' : 'opacity-100'} ${className}`}
      style={{ width, ...style }}
    >
      {resourceType === 'video' ? (
        <video
          ref={videoRef}
          key={currentSrc}
          className="w-full h-full pointer-events-none object-contain"
          autoPlay={autoPlay}
          loop
          muted
          playsInline
          preload="auto"
        >
          {/* 自定义 src 直接用单 source；否则用浏览器最佳格式 */}
          {src ? (
            <source src={currentSrc} onError={handleError} />
          ) : (
            videoSources.map((s) => (
              <source key={s.src} src={s.src} type={s.type} onError={handleError} />
            ))
          )}
        </video>
      ) : (
        <img
          key={currentSrc}
          src={currentSrc}
          className="w-full h-full pointer-events-none object-contain"
          alt="Mascot"
          loading="lazy"
          onError={handleError}
        />
      )}
    </div>
  );
};

export default Mascot;
