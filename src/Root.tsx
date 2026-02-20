import { Composition, staticFile } from "remotion";
import { VideoFactory } from "./VideoFactory/VideoFactory";
import { VideoConfig } from "./VideoFactory/types";

const loadConfig = async (abortSignal: AbortSignal) => {
  const response = await fetch(staticFile("config.json"), { signal: abortSignal });
  const config: VideoConfig = await response.json();
  const totalFrames = config.scenes.reduce(
    (sum, scene) => sum + scene.durationInFrames,
    0,
  );
  return { config, totalFrames };
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="Youtube"
        component={VideoFactory}
        fps={60}
        width={1920}
        height={1080}
        durationInFrames={1}
        defaultProps={{ scenes: [] } as VideoConfig}
        calculateMetadata={async ({ abortSignal }) => {
          const { config, totalFrames } = await loadConfig(abortSignal);
          return { durationInFrames: totalFrames, props: config };
        }}
      />

      <Composition
        id="Shorts"
        component={VideoFactory}
        fps={60}
        width={1080}
        height={1920}
        durationInFrames={1}
        defaultProps={{ scenes: [] } as VideoConfig}
        calculateMetadata={async ({ abortSignal }) => {
          const { config, totalFrames } = await loadConfig(abortSignal);
          return { durationInFrames: totalFrames, props: config };
        }}
      />
    </>
  );
};
