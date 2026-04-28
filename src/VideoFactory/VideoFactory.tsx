import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import { Scene } from "./Scene";
import { VideoConfig } from "./types";

export const VideoFactory: React.FC<VideoConfig> = ({ scenes, defaultBackground, defaultCharacters = [], music }) => {
  const sceneOffsets = scenes.map((_, i) =>
    scenes.slice(0, i).reduce((s, sc) => s + (sc.durationInFrames ?? 300), 0)
  );

  // Build a global character color map from all scenes (for subtitle coloring)
  const charColors: Record<string, string> = {};
  for (const scene of scenes) {
    for (const char of scene.characters ?? defaultCharacters) {
      if (char.nameTag?.color && !charColors[char.id]) {
        charColors[char.id] = char.nameTag.color;
      }
    }
  }

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {music && <Audio src={staticFile(music.src)} volume={() => music.volume ?? 1} loop />}
      {scenes.map((scene, i) => {
        const duration = scene.durationInFrames ?? 300;
        return (
          <Sequence
            key={scene.id}
            from={sceneOffsets[i]}
            durationInFrames={duration}
          >
            <Scene config={scene} defaultBackground={defaultBackground} defaultCharacters={defaultCharacters} charColors={charColors} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
