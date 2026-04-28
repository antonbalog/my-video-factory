import React from "react";
import { AbsoluteFill } from "remotion";

export const ChessboardBackground: React.FC<{
  tileSize: number;
  color1: string;
  color2: string;
}> = ({ tileSize, color1, color2 }) => (
  <AbsoluteFill>
    <svg width="100%" height="100%" style={{ position: "absolute" }}>
      <defs>
        <pattern
          id="bg-pattern"
          patternUnits="userSpaceOnUse"
          width={tileSize}
          height={tileSize}
        >
          <rect width={tileSize} height={tileSize} fill={color1} />
          <rect x={0} y={0} width={tileSize / 2} height={tileSize / 2} fill={color2} />
          <rect
            x={tileSize / 2}
            y={tileSize / 2}
            width={tileSize / 2}
            height={tileSize / 2}
            fill={color2}
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#bg-pattern)" />
    </svg>
  </AbsoluteFill>
);
