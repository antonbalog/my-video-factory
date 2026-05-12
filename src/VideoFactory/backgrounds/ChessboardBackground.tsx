import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";

export const ChessboardBackground: React.FC<{
  tileSize: number;
  color1: string;
  color2: string;
  pulse?: { amplitude?: number };
}> = ({ tileSize, color1, color2, pulse }) => {
  const frame = useCurrentFrame();
  const effectiveTile = pulse
    ? tileSize + Math.sin((frame / 30) * Math.PI) * (pulse.amplitude ?? 8)
    : tileSize;

  // Anchor a tile corner to screen center so the pulse radiates outward from there
  const cx = 1920 / 2, cy = 1080 / 2;
  const px = cx % effectiveTile;
  const py = cy % effectiveTile;

  return (
    <AbsoluteFill>
      <svg width="100%" height="100%" style={{ position: "absolute" }}>
        <defs>
          <pattern
            id="bg-pattern"
            patternUnits="userSpaceOnUse"
            x={px}
            y={py}
            width={effectiveTile}
            height={effectiveTile}
          >
            <rect width={effectiveTile} height={effectiveTile} fill={color1} />
            <rect x={0} y={0} width={effectiveTile / 2} height={effectiveTile / 2} fill={color2} />
            <rect
              x={effectiveTile / 2}
              y={effectiveTile / 2}
              width={effectiveTile / 2}
              height={effectiveTile / 2}
              fill={color2}
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#bg-pattern)" />
      </svg>
    </AbsoluteFill>
  );
};
