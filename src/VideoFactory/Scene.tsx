import { AbsoluteFill } from "remotion";
import { SceneConfig } from "./types";

export const Scene: React.FC<{ config: SceneConfig }> = ({ config }) => {
  return <AbsoluteFill style={{ backgroundColor: config.backgroundColor }} />;
};
