import { Composition, staticFile } from "remotion";
import { parseMedia } from "@remotion/media-parser";
import { VideoFactory } from "./VideoFactory/VideoFactory";
import { VideoConfig } from "./VideoFactory/types";
import { parseVtt } from "./VideoFactory/utils/parseVtt";

const FPS = 60;

const loadConfig = async (abortSignal: AbortSignal, fps: number) => {
  const response = await fetch(staticFile("config.json"), { signal: abortSignal });
  const config: VideoConfig = await response.json();

  // Resolve each scene: fetch VTT captions and derive durationInFrames from audio clips
  for (const scene of config.scenes) {
    let clipStartFrame = 0;
    const allCaptions: import("@remotion/captions").Caption[] = [];

    for (const clip of scene.audio ?? []) {
      let durationInSeconds: number | null = null;
      try {
        ({ durationInSeconds } = await parseMedia({
          src: staticFile(clip.src),
          fields: { durationInSeconds: true },
          acknowledgeRemotionLicense: true,
        }));
      } catch {
        console.warn(`Skipping missing audio: ${clip.src}`);
        clip.startFrame = clipStartFrame;
        clip.durationInFrames = 0;
        continue;
      }
      const trimStart = clip.trimStart ?? 0;
      const trimEnd   = clip.trimEnd   ?? 0;
      const padEnd    = clip.padEnd    ?? 0;
      const trimStartFrames = Math.round(trimStart * fps);
      const padEndFrames    = Math.round(padEnd    * fps);
      const clipFrames = Math.ceil(((durationInSeconds ?? 0) - trimStart - trimEnd) * fps) + padEndFrames;
      clip.trimStartFrames = trimStartFrames;

      if (clip.mouthCues) {
        try {
          const res = await fetch(staticFile(clip.mouthCues), { signal: abortSignal });
          if (res.ok) {
            const rhubarbData = await res.json();
            clip.parsedMouthCues = rhubarbData.mouthCues;
          }
        } catch {
          // Mouth cues file not yet generated — lip sync will be skipped
        }
      }

      if (clip.subtitles) {
        try {
          const res = await fetch(staticFile(clip.subtitles), { signal: abortSignal });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const vttText = await res.text();
          // NOTE: if trim-start cuts into actual speech, captions from the trimmed
          // portion get negative timestamps and may flash at frame 0. Acceptable
          // for now since trim-start is only used to cut leading silence.
          const offsetMs = (clipStartFrame / fps) * 1000 - trimStart * 1000;
          const captions = parseVtt(vttText).map((c) => ({
            ...c,
            startMs: c.startMs + offsetMs,
            endMs: c.endMs + offsetMs,
            timestampMs: (c.timestampMs ?? c.startMs) + offsetMs,
          }));
          allCaptions.push(...captions);
        } catch {
          console.warn(`Skipping missing subtitles: ${clip.subtitles}`);
        }
      }

      clip.startFrame = clipStartFrame;
      clip.durationInFrames = clipFrames;
      if (clip.bleeps?.length) {
        clip.parsedBleeps = clip.bleeps.map((b) => ({
          startFrame: Math.round(b.startMs / 1000 * fps) - trimStartFrames,
          endFrame:   Math.ceil(b.endMs   / 1000 * fps) - trimStartFrames,
        }));
      }
      clipStartFrame += clipFrames;
    }

    if (allCaptions.length > 0) {
      scene.captions = allCaptions;
    }

    for (const anim of scene.animations ?? []) {
      anim.atFrame = Math.round(anim.atMs / 1000 * fps);
    }

    // Derive scene duration from clips if not set
    if (scene.durationInFrames == null) {
      scene.durationInFrames = clipStartFrame > 0 ? clipStartFrame : 300;
    }
  }

  // Pad the last pre-outro scene so middle content ends on a loop boundary
  if (config.music?.loop) {
    let loopSeconds = 4;
    try {
      const { durationInSeconds } = await parseMedia({
        src: staticFile(config.music.loop.src),
        fields: { durationInSeconds: true },
        acknowledgeRemotionLicense: true,
      });
      loopSeconds = durationInSeconds ?? 4;
    } catch {
      console.warn("Could not parse loop music duration, assuming 4s");
    }
    const loopFrames = Math.round(loopSeconds * fps);
    const middleScenes = config.scenes.filter(s => s.id !== "intro" && s.id !== "outro");
    if (middleScenes.length > 0) {
      const middleTotal = middleScenes.reduce((s, sc) => s + (sc.durationInFrames ?? 0), 0);
      const remainder = middleTotal % loopFrames;
      if (remainder !== 0) {
        const pad = loopFrames - remainder;
        const last = middleScenes[middleScenes.length - 1];
        last.durationInFrames = (last.durationInFrames ?? 0) + pad;
      }
    }
  }

  const totalFrames = config.scenes.reduce(
    (sum, scene) => sum + (scene.durationInFrames ?? 0),
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
        fps={FPS}
        width={1920}
        height={1080}
        durationInFrames={1}
        defaultProps={{ scenes: [], defaultBackground: { type: "color", value: "#000000" } } as VideoConfig}
        calculateMetadata={async ({ abortSignal }) => {
          const { config, totalFrames } = await loadConfig(abortSignal, FPS);
          return { durationInFrames: totalFrames, props: config };
        }}
      />

      <Composition
        id="Shorts"
        component={VideoFactory}
        fps={FPS}
        width={1080}
        height={1920}
        durationInFrames={1}
        defaultProps={{ scenes: [], defaultBackground: { type: "color", value: "#000000" } } as VideoConfig}
        calculateMetadata={async ({ abortSignal }) => {
          const { config, totalFrames } = await loadConfig(abortSignal, FPS);
          return { durationInFrames: totalFrames, props: config };
        }}
      />
    </>
  );
};
