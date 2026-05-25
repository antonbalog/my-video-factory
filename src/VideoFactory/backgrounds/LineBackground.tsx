import React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { sr } from "../utils/seededRand";

export const LineBackground: React.FC<{ color?: string }> = ({ color = "#222222" }) => {
  const { width, height } = useVideoConfig();
  const lineY = (height * 2) / 3;
  const u = Math.min(width, height) / 80;

  // Three levels, each separated by a 2u edge-to-edge gap from the line above
  const levels = [lineY + 3 * u, lineY + 6 * u, lineY + 9 * u];

  const levelColors = ["#333333", "#444444", "#555555"];
  const marks: { x: number; y: number; w: number; c: string }[] = [];
  let seed = 0;

  for (let li = 0; li < levels.length; li++) {
    const y = levels[li];
    const w = u * (3 - li);
    const c = levelColors[li];
    let x = sr(seed++) * u * 15;
    while (x < width) {
      marks.push({ x, y, w, c });
      x += w + sr(seed++) * u * 20;
    }
  }

  return (
    <AbsoluteFill style={{ backgroundColor: "#FFFFFF" }}>
      <svg width={width} height={height}>
        <line x1={0} y1={lineY} x2={width} y2={lineY} stroke={color} strokeWidth={u} />
        {marks.map((m, i) => (
          <line key={i} x1={m.x} y1={m.y} x2={m.x + m.w} y2={m.y} stroke={m.c} strokeWidth={u} />
        ))}
      </svg>
    </AbsoluteFill>
  );
};
