import type { Caption } from "@remotion/captions";
import { createTikTokStyleCaptions } from "@remotion/captions";
import { useCurrentFrame, useVideoConfig } from "remotion";
import type { AudioConfig } from "./types";
import { fontFamily } from "./fonts";

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

  const clipStartMs = activeClip ? ((activeClip.startFrame ?? 0) / fps) * 1000 : null;
  const clipEndMs = activeClip ? (((activeClip.startFrame ?? 0) + (activeClip.durationInFrames ?? 0)) / fps) * 1000 : null;
  const activeClipCaptions = clipStartMs !== null && clipEndMs !== null
    ? captions.filter((c) => c.startMs >= clipStartMs && c.startMs < clipEndMs)
    : [];

  const { pages } = createTikTokStyleCaptions({
    captions: activeClipCaptions,
    combineTokensWithinMilliseconds: 300,
  });

  const MAX_WORDS = 5;
  const splitPages = pages.flatMap((page) => {
    if (page.tokens.length <= MAX_WORDS) return [page];
    const result = [];
    let i = 0;
    while (i < page.tokens.length) {
      const chunk = page.tokens.slice(i, i + MAX_WORDS);
      result.push({ startMs: chunk[0].fromMs, tokens: chunk });
      i += MAX_WORDS;
    }
    return result;
  });

  let currentPage = null;
  for (let i = splitPages.length - 1; i >= 0; i--) {
    const p = splitPages[i];
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

  const isPortrait = height > width;
  const bottomSafe = isPortrait ? "28%" : "12%";
  const rightSafe = isPortrait ? "20%" : "10%";

  return (
    <div
      style={{
        position: "absolute",
        bottom: bottomSafe,
        left: "10%",
        right: rightSafe,
        textAlign: "center",
        pointerEvents: "none",
        zIndex: 9999,
      }}
    >
      <span
        style={{
          fontSize: Math.round(ref * 0.045),
          fontFamily,
          fontWeight: "bold",
          textTransform: "uppercase",
          lineHeight: 1.2,
        }}
      >
        {currentPage.tokens.map((t, i) => (
          <span
            key={i}
            style={{
              color: t === activeToken ? "#FFFFFF" : subtitleColor,
              textShadow: "0 0 8px rgba(0,0,0,0.9), 2px 2px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000",
            }}
          >
            {censorToken(t.text, censored)}{" "}
          </span>
        ))}
      </span>
    </div>
  );
};
