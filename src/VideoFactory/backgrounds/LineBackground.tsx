import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { sr } from "../utils/seededRand";

const REF_W = 1920;
const REF_H = 720; // 2/3 of 1080
const STAR_GAP = 5;

const STARS: { rx: number; ry: number; size: number }[] = [];
for (let i = 0; i < 80; i++) {
  const size = Math.random() > 0.5 ? 10 : 5;
  for (let attempt = 0; attempt < 200; attempt++) {
    const rx = Math.random();
    const ry = Math.random();
    const px = rx * REF_W;
    const py = ry * REF_H;
    const ok = STARS.every((s) => {
      const minDist = (size + s.size) / 2 + STAR_GAP;
      return Math.abs(px - s.rx * REF_W) >= minDist || Math.abs(py - s.ry * REF_H) >= minDist;
    });
    if (ok) { STARS.push({ rx, ry, size }); break; }
  }
}

export const LineBackground: React.FC<{ color?: string }> = ({ color = "#222222" }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const lineY = (height * 2) / 3;
  const u = Math.min(width, height) / 80;

  // Three levels, each separated by a 2u edge-to-edge gap from the line above
  const levels = [lineY + 3 * u, lineY + 6 * u, lineY + 9 * u];

  const stars = STARS.map((s) => ({ x: s.rx * width, y: s.ry * lineY, size: s.size }));

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
    <AbsoluteFill style={{ backgroundColor: "#FFF" }}>
      <svg width={width} height={height}>
        <rect x={0} y={0} width={width} height={lineY} fill="#FFF" />
        {stars.map((s, i) => {
          const pulse = 1 + ((Math.sin(frame / 40 + i * 1.7) + 1) / 2) * 0.5;
          const sz = s.size * pulse;
          return (
            <g key={`star-${i}`} transform={`translate(${s.x - sz / 2}, ${s.y - sz / 2}) scale(${sz / 124})`}>
              <path
                d="M56 6 H68 V40 H76 V48 H84 V56 H118 V68 H84 V76 H76 V84 H68 V118 H56 V84 H48 V76 H40 V68 H6 V56 H40 V48 H48 V40 H56 V6 Z"
                fill="#FFF"
                stroke="#FFF"
                strokeWidth={2}
                vectorEffect="non-scaling-stroke"
              />
            </g>
          );
        })}
        <line x1={0} y1={lineY} x2={width} y2={lineY} stroke={color} strokeWidth={u} />
        {marks.map((m, i) => (
          <line key={i} x1={m.x} y1={m.y} x2={m.x + m.w} y2={m.y} stroke={m.c} strokeWidth={u} />
        ))}
      </svg>
    </AbsoluteFill>
  );
};
