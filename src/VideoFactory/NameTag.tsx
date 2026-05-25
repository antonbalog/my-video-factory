import React from "react";
import { useVideoConfig } from "remotion";
import type { NameTagConfig } from "./types";
import { fontFamily } from "./fonts";

const shadow = "0 0 8px rgba(0,0,0,0.9), 2px 2px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000";

export const NameTag: React.FC<NameTagConfig> = ({ label, color, strikePrefix }) => {
  const { width, height } = useVideoConfig();
  const ref = Math.min(width, height);
  return (
  <span
    style={{
      fontSize: Math.round(ref * 0.06),
      fontFamily,
      fontWeight: "bold",
      color,
      textTransform: "uppercase",
      textShadow: shadow,
      lineHeight: 1.2,
      whiteSpace: "nowrap",
    }}
  >
    {strikePrefix && (
      <span style={{ textDecoration: "line-through", textDecorationColor: "#000000", textDecorationThickness: 10 }}>{strikePrefix}</span>
    )}
    {label}
  </span>
  );
};
