import React, { useMemo } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { sr } from "../utils/seededRand";

export const PerspectiveFloorBackground: React.FC<{
  tileSize?: number;
  color1?: string;
  color2?: string;
  horizon?: number;
}> = ({ tileSize = 80, color1 = "#141414", color2 = "#2A2A2A", horizon = 0.5 }) => {
  const { height } = useVideoConfig();
  const frame = useCurrentFrame();

  const tinyStars = useMemo(() =>
    Array.from({ length: 60 }, (_, i) => {
      const col = i % 10, row = Math.floor(i / 10);
      const cw = 100 / 10, ch = (horizon * 100) / 6;
      return { x: col * cw + sr(i * 3) * cw, y: row * ch + sr(i * 3 + 1) * ch,
               phase: sr(i * 7) * Math.PI * 2, speed: sr(i * 11) * 0.03 + 0.01 };
    }),
  [horizon]);

  const mediumStars = useMemo(() =>
    Array.from({ length: 20 }, (_, i) => {
      const col = i % 5, row = Math.floor(i / 5);
      const cw = 100 / 5, ch = (horizon * 100) / 4;
      return { x: col * cw + sr((i + 60) * 3) * cw, y: row * ch + sr((i + 60) * 3 + 1) * ch,
               phase: sr((i + 60) * 7) * Math.PI * 2, speed: sr((i + 60) * 11) * 0.02 + 0.008 };
    }),
  [horizon]);

  const heroStars = useMemo(() =>
    Array.from({ length: 5 }, (_, i) => ({
      x: sr((i + 80) * 3) * 90 + 5,
      y: sr((i + 80) * 3 + 1) * (horizon * 100 * 0.8) + horizon * 100 * 0.1,
      size: sr((i + 80) * 3 + 2) * 1.5 + 3,
      phase: sr((i + 80) * 7) * Math.PI * 2,
      speed: sr((i + 80) * 11) * 0.015 + 0.005,
    })),
  [horizon]);

  return (
    <div style={{ position: "absolute", inset: 0, backgroundColor: color1 }}>
      {/* Tiny stars — 10×6 grid, 1px */}
      {tinyStars.map((s, i) => (
        <div key={`t${i}`} style={{
          position: "absolute", left: `${s.x}%`, top: `${s.y}%`,
          width: 1, height: 1, borderRadius: "50%", backgroundColor: "#FFFFFF",
          opacity: 0.1 + Math.sin(frame * s.speed + s.phase) * 0.2,
          transform: "translate(-50%, -50%)",
        }} />
      ))}
      {/* Medium stars — 5×4 grid, 2px */}
      {mediumStars.map((s, i) => (
        <div key={`m${i}`} style={{
          position: "absolute", left: `${s.x}%`, top: `${s.y}%`,
          width: 2, height: 2, borderRadius: "50%", backgroundColor: "#FFFFFF",
          opacity: 0.25 + Math.sin(frame * s.speed + s.phase) * 0.25,
          transform: "translate(-50%, -50%)",
        }} />
      ))}
      {/* Hero stars — 5 random, 3–4.5px with glow */}
      {heroStars.map((s, i) => (
        <div key={`h${i}`} style={{
          position: "absolute", left: `${s.x}%`, top: `${s.y}%`,
          width: s.size, height: s.size, borderRadius: "50%", backgroundColor: "#FFFFFF",
          opacity: 0.7 + Math.sin(frame * s.speed + s.phase) * 0.3,
          boxShadow: "0 0 8px rgba(255,255,255,0.8), 0 0 16px rgba(255,255,255,0.3)",
          transform: "translate(-50%, -50%)",
        }} />
      ))}
      {/* Perspective floor — container starts at horizon so overflow:hidden clips any tiles above it */}
      <div
        style={{
          position: "absolute",
          top: `${horizon * 100}%`, left: 0, right: 0, bottom: 0,
          perspective: `${height * 0.75}px`,
          perspectiveOrigin: "50% 0%",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute", bottom: 0, left: "-100%",
            width: "300%", height: "250%",
            background: `repeating-conic-gradient(${color1} 0% 25%, ${color2} 0% 50%) 0 0 / ${tileSize}px ${tileSize}px`,
            transform: "rotateX(75deg)",
            transformOrigin: "50% 100%",
          }}
        />
      </div>
      {/* Horizon fog — starts exactly at horizon, no conflict with stars above */}
      <div
        style={{
          position: "absolute",
          top: `${horizon * 100}%`, left: 0, right: 0, bottom: 0,
          background: `linear-gradient(to bottom, ${color1} 0%, transparent 50%)`,
          pointerEvents: "none",
        }}
      />
    </div>
  );
};
