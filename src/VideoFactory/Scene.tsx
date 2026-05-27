import React from "react";
import { AbsoluteFill, Audio, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { BackgroundConfig, CharacterConfig, SceneConfig } from "./types";
import { renderBackground } from "./backgrounds";
import { GradientOverlay } from "./GradientOverlay";
import { characterRegistry } from "./characters";
import { SubtitleOverlay } from "./SubtitleOverlay";
import { getMouthHeight } from "./utils/getMouthShape";
import { NameTag } from "./NameTag";
import { LIMB_ANIMATIONS, evaluateLimbs } from "./characters/limbAnimations";
import { sr } from "./utils/seededRand";

export const Scene: React.FC<{ config: SceneConfig; defaultBackground: BackgroundConfig; defaultCharacters: CharacterConfig[]; charColors: Record<string, string>; overlay?: import("./types").OverlayConfig }> = ({
  config,
  defaultBackground,
  defaultCharacters,
  charColors,
  overlay,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const baseBg = config.background ?? defaultBackground;
  const bg = config.tileSize != null && "tileSize" in baseBg
    ? { ...baseBg, tileSize: config.tileSize }
    : baseBg;
  const characters = config.characters ?? defaultCharacters;
  const isZoom = config.transition === "zoom-in" || config.transition === "zoom-out";
  const maxCharSize = Math.max(...characters.map((c) => c.size ?? 1), 1);
  const bgScale = isZoom ? maxCharSize / 2 : 1;

  const scale = config.transition === "zoom-in"
    ? spring({ frame, fps, from: 1.15, to: 1, config: { damping: 18, stiffness: 80 } })
    : config.transition === "zoom-out"
    ? spring({ frame, fps, from: 1, to: 1.15, config: { damping: 18, stiffness: 80 } })
    : 1;

  const getActiveAnimation = (charId: string) => {
    for (const anim of config.animations ?? []) {
      if (anim.characterId !== charId) continue;
      const start = anim.atFrame ?? 0;
      const def = LIMB_ANIMATIONS[anim.type];
      const duration = def ? def.duration(anim.params) : 60;
      if (frame >= start && frame < start + duration) {
        return { type: anim.type, localFrame: frame - start, params: anim.params };
      }
    }
    return null;
  };

  const getCharOpacityOverride = (charId: string): number | null => {
    for (const anim of config.animations ?? []) {
      if (anim.characterId !== charId) continue;
      const start = anim.atFrame ?? 0;
      const def = LIMB_ANIMATIONS[anim.type];
      const duration = def ? def.duration(anim.params) : 40;
      if (anim.type === "glitch-out" && frame >= start + duration) return 0;
      if (anim.type === "glitch-in"  && frame < start)             return 0;
    }
    return null;
  };

  const getGlitchWrapStyle = (anim: ReturnType<typeof getActiveAnimation>, charId: string) => {
    const opacityOverride = getCharOpacityOverride(charId);
    if (opacityOverride !== null && !anim) return { opacity: opacityOverride };
    if (!anim || (anim.type !== "glitch-in" && anim.type !== "glitch-out")) return null;
    const duration = (anim.params?.durationFrames as number | undefined) ?? 40;
    const t = Math.min(anim.localFrame / duration, 1);
    const intensity = anim.type === "glitch-in" ? 1 - t : t;
    const opacityRaw = anim.type === "glitch-in" ? t : 1 - t;
    const opacity = Math.round(opacityRaw * 3) / 3;
    const tick = anim.localFrame;
    const jitterX = (sr(tick * 5) - 0.5) * intensity * 40;
    const jitterY = (sr(tick * 7) - 0.5) * intensity * 10;
    const chromaOffset = Math.round(sr(tick * 3) * intensity * 20);
    return {
      opacity,
      filter: [
        `contrast(${1 + intensity * 1.5})`,
        `saturate(${1 + intensity * 2})`,
        `hue-rotate(${Math.round(sr(tick * 9) * intensity * 3) * 60}deg)`,
        `drop-shadow(${chromaOffset}px 0 0 rgba(255,0,0,0.9))`,
        `drop-shadow(${-chromaOffset}px 0 0 rgba(0,255,255,0.9))`,
      ].join(" "),
      transform: `translate(${jitterX}px, ${jitterY}px)`,
    };
  };

  const getCharMouthHeight = (charId: string): number => {
    for (const clip of config.audio ?? []) {
      if (clip.characterId !== charId || !clip.parsedMouthCues) continue;
      const localFrame = frame - (clip.startFrame ?? 0);
      if (localFrame < 0 || localFrame >= (clip.durationInFrames ?? 0)) continue;
      return getMouthHeight(localFrame, fps, clip.parsedMouthCues);
    }
    return 0;
  };
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ transform: `scale(${scale})` }}>
      <div style={{ position: "absolute", inset: 0, transform: `scale(${bgScale})` }}>
        {renderBackground(bg)}
        {overlay && <GradientOverlay {...overlay} />}
      </div>
      {(config.audio ?? []).map((clip) => (
        <Sequence key={clip.src} from={clip.startFrame ?? 0} durationInFrames={clip.durationInFrames}>
          <Audio
            src={staticFile(clip.src)}
            startFrom={clip.trimStartFrames ?? 0}
            volume={(f) => {
              if (!clip.parsedBleeps?.length) return clip.volume ?? 1;
              return clip.parsedBleeps.some((b) => f >= b.startFrame && f < b.endFrame)
                ? 0
                : clip.volume ?? 1;
            }}
          />
        </Sequence>
      ))}
      {(config.audio ?? []).flatMap((clip) =>
        (clip.parsedBleeps ?? []).map((b, i) => (
          <Sequence
            key={`bleep-${clip.src}-${i}`}
            from={(clip.startFrame ?? 0) + b.startFrame}
            durationInFrames={b.endFrame - b.startFrame}
          >
            <Audio src={staticFile("sfx/censor-beep.wav")} volume={() => 1} />
          </Sequence>
        ))
      )}
      {(config.sfx ?? []).map((sfx, i) => (
        <Sequence
          key={`sfx-${i}`}
          from={Math.round(sfx.atMs / 1000 * fps)}
          durationInFrames={Math.ceil(fps * 2)}
        >
          <Audio src={staticFile(sfx.src)} volume={() => sfx.volume ?? 1} />
        </Sequence>
      ))}
      {[...characters.filter(c => c.behind), ...characters.filter(c => !c.behind)].map((char) => {
        const CharComponent = characterRegistry[char.id];
        if (!CharComponent) return null;
        const anim = getActiveAnimation(char.id);
        const glitch = getGlitchWrapStyle(anim, char.id);
        const limbState = evaluateLimbs(anim);
        const posX = limbState.position != null ? limbState.position.x : char.x;
        const posY = limbState.position != null ? limbState.position.y : char.y;
        return (
          <React.Fragment key={char.id}>
            <div
              style={{
                position: "absolute",
                left: `${posX * 100}%`,
                top: `${posY * 100}%`,
                transform: `translate(-50%, -50%) scale(${char.size ?? 1})`,
              }}
            >
              <div style={glitch ?? undefined}>
                <CharComponent colors={char.colors} props={char.props} mouthHeight={getCharMouthHeight(char.id)} animation={anim} />
              </div>
            </div>
            {char.nameTag && (
              <div
                style={{
                  position: "absolute",
                  left: `${char.x * 100}%`,
                  top: `calc(${char.y * 100}% - 324px)`,
                  transform: "translateX(-50%)",
                  textAlign: "center",
                  pointerEvents: "none",
                  zIndex: 100,
                }}
              >
                <div style={glitch ?? undefined}>
                  <NameTag {...char.nameTag} />
                </div>
              </div>
            )}
          </React.Fragment>
        );
      })}
      </AbsoluteFill>
      {config.captions && config.captions.length > 0 && (
        <SubtitleOverlay
          captions={config.captions}
          audio={config.audio}
          charColors={charColors}
          censoredWords={(config.audio ?? []).flatMap((c) => c.censoredWords ?? [])}
        />
      )}
    </AbsoluteFill>
  );
};
