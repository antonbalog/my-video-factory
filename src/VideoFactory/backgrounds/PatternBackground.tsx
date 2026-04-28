import React from "react";
import { AbsoluteFill, staticFile } from "remotion";

export const PatternBackground: React.FC<{ src: string; tileSize: number }> = ({
  src,
  tileSize,
}) => (
  <AbsoluteFill>
    <svg width="100%" height="100%" style={{ position: "absolute" }}>
      <defs>
        <pattern
          id="bg-pattern"
          patternUnits="userSpaceOnUse"
          width={tileSize}
          height={tileSize}
        >
          <image href={staticFile(src)} width={tileSize} height={tileSize} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#bg-pattern)" />
    </svg>
  </AbsoluteFill>
);
