import React from "react";
import { AbsoluteFill } from "remotion";
import { OverlayConfig } from "./types";

function hexToRgb(hex: string): [number, number, number] {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return r ? [parseInt(r[1], 16), parseInt(r[2], 16), parseInt(r[3], 16)] : [0, 0, 0];
}

export const GradientOverlay: React.FC<OverlayConfig> = ({
  colorTop,
  colorBottom,
  opacityTop = 0.1,
  opacityMiddle = 0.9,
}) => {
  const [r1, g1, b1] = hexToRgb(colorTop);
  const [r2, g2, b2] = hexToRgb(colorBottom);

  // 5 stops: independent color lerp + sine opacity curve (opacityTop → opacityMiddle → opacityTop)
  const stops = [0, 0.25, 0.5, 0.75, 1].map((t) => {
    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);
    const a = opacityTop + (opacityMiddle - opacityTop) * Math.sin(t * Math.PI);
    return `rgba(${r},${g},${b},${a.toFixed(3)})`;
  });

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(to bottom, ${stops.join(", ")})`,
        pointerEvents: "none",
      }}
    />
  );
};
