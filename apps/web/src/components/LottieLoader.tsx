import React from 'react';
import Lottie from 'lottie-react';
import wallAnimation from '../assets/wall.json';

interface LottieLoaderProps {
  /** Width & height in px (default 150) */
  size?: number;
  /** Optional label shown below the animation */
  label?: string;
}

/**
 * Reusable loading animation — shows the "wall under construction" Lottie.
 * Drop-in replacement for `<ActivityIndicator size="large" …/>` on full-page loaders.
 */
export function LottieLoader({ size = 150, label }: LottieLoaderProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        flex: 1,
        minHeight: 200,
      }}
    >
      <Lottie
        animationData={wallAnimation}
        loop
        autoplay
        style={{ width: size, height: size }}
      />
      {label && (
        <p style={{ marginTop: 12, color: '#64748b', fontSize: 14, textAlign: 'center' }}>
          {label}
        </p>
      )}
    </div>
  );
}
