import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import { Scene } from "./Scene";
import { VideoConfig } from "./types";

export const VideoFactory: React.FC<VideoConfig> = ({ scenes, defaultBackground, defaultCharacters = [], music, overlay }) => {
  const sceneOffsets = scenes.map((_, i) =>
    scenes.slice(0, i).reduce((s, sc) => s + (sc.durationInFrames ?? 300), 0)
  );

  const totalFrames = scenes.reduce((s, sc) => s + (sc.durationInFrames ?? 300), 0);
  const introFrames = scenes.find(s => s.id === "intro")?.durationInFrames ?? 0;
  const outroFrames = scenes.find(s => s.id === "outro")?.durationInFrames ?? 0;
  const middleFrames = totalFrames - introFrames - outroFrames;

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
      {/* Legacy single-track music */}
      {!music?.muted && music?.src && !music.loop && <Audio src={staticFile(music.src)} volume={() => music.volume ?? 1} loop />}
      {/* Structured intro / loop / outro music */}
      {!music?.muted && music?.intro && introFrames > 0 && (
        <Sequence durationInFrames={introFrames}>
          <Audio src={staticFile(music.intro.src)} volume={() => music.intro!.volume ?? 1} />
        </Sequence>
      )}
      {!music?.muted && music?.loop && middleFrames > 0 && (
        <Sequence from={introFrames} durationInFrames={middleFrames}>
          <Audio src={staticFile(music.loop.src)} volume={() => music.loop!.volume ?? 1} loop />
        </Sequence>
      )}
      {!music?.muted && music?.outro && outroFrames > 0 && (
        <Sequence from={totalFrames - outroFrames} durationInFrames={outroFrames}>
          <Audio src={staticFile(music.outro.src)} volume={() => music.outro!.volume ?? 1} />
        </Sequence>
      )}
      {scenes.map((scene, i) => {
        const duration = scene.durationInFrames ?? 300;
        return (
          <Sequence
            key={scene.id}
            from={sceneOffsets[i]}
            durationInFrames={duration}
          >
            <Scene config={scene} defaultBackground={defaultBackground} defaultCharacters={defaultCharacters} charColors={charColors} overlay={overlay} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
