import { AbsoluteFill, Sequence } from "remotion";
import { Scene } from "./Scene";
import { VideoConfig } from "./types";

export const VideoFactory: React.FC<VideoConfig> = ({ scenes }) => {
  let offset = 0;

  return (
    <AbsoluteFill>
      {scenes.map((scene) => {
        const from = offset;
        offset += scene.durationInFrames;
        return (
          <Sequence
            key={scene.id}
            from={from}
            durationInFrames={scene.durationInFrames}
          >
            <Scene config={scene} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
