
import React, { useState, useEffect } from 'react';
import { 
  getMascotPath, 
  MascotCharacter, 
  MascotAction, 
  MascotOutfit, 
  MascotView,
  FALLBACK_MASCOT,
  getSelectedCharacter 
} from '../utils/mascotUtils';

interface MascotProps {
  character?: MascotCharacter;
  action?: MascotAction;
  view?: MascotView; // 新增视角属性
  outfit?: MascotOutfit;
  width?: string | number;
  className?: string;
  style?: React.CSSProperties;
  src?: string; 
}

const Mascot: React.FC<MascotProps> = ({ 
  character, 
  action = 'idle', 
  view = 'front', // 默认视角为正面
  outfit = 'default', 
  width = "100%", 
  className = "", 
  style = {},
  src
}) => {
  const activeCharacter = character || getSelectedCharacter();
  const [currentSrc, setCurrentSrc] = useState<string>(src || FALLBACK_MASCOT);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    if (!src) {
      const newPath = getMascotPath({ 
        character: activeCharacter, 
        action, 
        view, // 应用视角
        outfit 
      });
      
      setIsTransitioning(true);
      const timer = setTimeout(() => {
        // 生产环境下取消下面注释以启用动态 MP4 加载
        // setCurrentSrc(newPath); 
        setIsTransitioning(false);
      }, 200);

      return () => clearTimeout(timer);
    }
  }, [activeCharacter, action, view, outfit, src]);

  const isVideo = currentSrc.match(/\.(mp4|webm|mov|ogg)$/i);

  return (
    <div 
      className={`relative inline-block transition-opacity duration-300 ${isTransitioning ? 'opacity-70' : 'opacity-100'} ${className}`}
      style={{ width, ...style }}
    >
      {isVideo ? (
        <video
          key={currentSrc}
          src={currentSrc}
          className="w-full h-full pointer-events-none object-contain"
          autoPlay
          loop
          muted
          playsInline
        />
      ) : (
        <img
          src={currentSrc}
          className="w-full h-full pointer-events-none object-contain"
          alt="Mascot"
        />
      )}
    </div>
  );
};

export default Mascot;
