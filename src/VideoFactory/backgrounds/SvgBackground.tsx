import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";

export const SvgBackground: React.FC<{ src: string }> = ({ src }) => (
  <AbsoluteFill>
    <Img
      src={staticFile(src)}
      style={{ width: "100%", height: "100%", objectFit: "cover" }}
    />
  </AbsoluteFill>
);
