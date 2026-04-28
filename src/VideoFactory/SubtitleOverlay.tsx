import type { Caption } from "@remotion/captions";
import { createTikTokStyleCaptions } from "@remotion/captions";
import { loadFont } from "@remotion/google-fonts/BebasNeue";
import { useCurrentFrame, useVideoConfig } from "remotion";
import type { AudioConfig } from "./types";

const { fontFamily } = loadFont();

const censorToken = (text: string, censored: Set<string>): string => {
  return text.replace(/[a-zA-Z]+/g, (word) => {
    if (!censored.has(word.toLowerCase())) return word;
    if (word.length <= 2) return word;
    return word[0] + "*".repeat(word.length - 2) + word[word.length - 1];
  });
};

export const SubtitleOverlay: React.FC<{
  captions: Caption[];
  audio?: AudioConfig[];
  charColors?: Record<string, string>;
  censoredWords?: string[];
}> = ({ captions, audio = [], charColors = {}, censoredWords = [] }) => {
  const censored = new Set(censoredWords.map((w) => w.toLowerCase()));
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const ref = Math.min(width, height);

  const activeClip = audio.find((clip) => {
    const start = clip.startFrame ?? 0;
    const end = start + (clip.durationInFrames ?? 0);
    return frame >= start && frame < end;
  });
  const subtitleColor = activeClip?.characterId
    ? (charColors[activeClip.characterId] ?? "#FFF")
    : "#FFF";
  const currentMs = (frame / fps) * 1000;

  const { pages } = createTikTokStyleCaptions({
    captions,
    combineTokensWithinMilliseconds: 500,
  });

  let currentPage = null;
  for (let i = pages.length - 1; i >= 0; i--) {
    const p = pages[i];
    const endMs = Math.max(...p.tokens.map((t) => t.toMs));
    if (p.startMs <= currentMs && currentMs < endMs) {
      currentPage = p;
      break;
    }
  }

  if (!currentPage) return null;

  const activeTokens = currentPage.tokens.filter(
    (t) => currentMs >= t.fromMs && currentMs < t.toMs
  );
  const activeToken =
    activeTokens.length > 0
      ? activeTokens.reduce((a, b) => (b.fromMs > a.fromMs ? b : a))
      : null;

  if (!activeToken) return null;

  return (
    <div
      style={{
        position: "absolute",
        bottom: "8%",
        left: "10%",
        right: "10%",
        textAlign: "center",
        pointerEvents: "none",
        zIndex: 9999,
      }}
    >
      <span
        style={{
          fontSize: Math.round(ref * 0.067),
          fontFamily,
          fontWeight: 900,
          color: subtitleColor,
          textShadow: "0 0 8px rgba(0,0,0,0.9), 2px 2px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000",
          lineHeight: 1.2,
        }}
      >
        {censorToken(activeToken.text, censored)}
      </span>
    </div>
  );
};
