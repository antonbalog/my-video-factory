import { Composition, staticFile } from "remotion";
import { HelloWorld, myCompSchema } from "./HelloWorld";
import { Logo, myCompSchema2 } from "./HelloWorld/Logo";
import { VideoFactory } from "./VideoFactory/VideoFactory";
import { VideoConfig } from "./VideoFactory/types";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="HelloWorld"
        component={HelloWorld}
        durationInFrames={150}
        fps={30}
        width={1920}
        height={1080}
        schema={myCompSchema}
        defaultProps={{
          titleText: "Welcome to Remotion",
          titleColor: "#000000",
          logoColor1: "#91EAE4",
          logoColor2: "#86A8E7",
        }}
      />

      <Composition
        id="OnlyLogo"
        component={Logo}
        durationInFrames={150}
        fps={30}
        width={1920}
        height={1080}
        schema={myCompSchema2}
        defaultProps={{
          logoColor1: "#91dAE2" as const,
          logoColor2: "#86A8E7" as const,
        }}
      />

      <Composition
        id="VideoFactory"
        component={VideoFactory}
        fps={60}
        width={1920}
        height={1080}
        durationInFrames={1}
        defaultProps={{ scenes: [] } as VideoConfig}
        calculateMetadata={async ({ abortSignal }) => {
          const response = await fetch(staticFile("config.json"), {
            signal: abortSignal,
          });
          const config: VideoConfig = await response.json();
          const totalFrames = config.scenes.reduce(
            (sum, scene) => sum + scene.durationInFrames,
            0,
          );
          return {
            durationInFrames: totalFrames,
            props: config,
          };
        }}
      />
    </>
  );
};
