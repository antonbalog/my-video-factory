import React from "react";
import { AbsoluteFill } from "remotion";

export const ColorBackground: React.FC<{ value: string }> = ({ value }) => (
  <AbsoluteFill style={{ backgroundColor: value }} />
);
