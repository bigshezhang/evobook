
import React from 'react';

interface MascotProps {
  src: string;
  width?: string | number;
  className?: string;
  // Added style prop to support custom CSS properties like animationDuration
  style?: React.CSSProperties;
}

const Mascot: React.FC<MascotProps> = ({ src, width = "100%", className = "", style = {} }) => {
  const isVideo = src.match(/\.(mp4|webm|mov|ogg)$/i);

  if (isVideo) {
    return (
      <video
        src={src}
        width={width}
        className={`pointer-events-none object-contain ${className}`}
        autoPlay
        loop
        muted
        playsInline
        // Combine hardware acceleration style with passed style prop
        style={{ transform: 'translateZ(0)', ...style }}
      />
    );
  }

  return (
    <img
      src={src}
      width={width}
      alt="Mascot"
      className={`pointer-events-none object-contain ${className}`}
      // Combine hardware acceleration style with passed style prop
      style={{ transform: 'translateZ(0)', ...style }}
    />
  );
};

export default Mascot;
