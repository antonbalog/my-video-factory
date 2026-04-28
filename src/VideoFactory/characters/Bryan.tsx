import React from "react";
import { useCurrentFrame } from "remotion";
import { getBlinkProgress } from "../utils/blink";
import { sr } from "../utils/seededRand";

type Props = {
  colors?: { gradStart?: string; gradEnd?: string; mouth?: string };
  mouthHeight?: number;
  animation?: { type: string; localFrame: number; params?: Record<string, unknown> } | null;
};

export const Bryan: React.FC<Props> = ({ colors = {}, mouthHeight = 0, animation = null }) => {
  const frame = useCurrentFrame();
  const gradStart = colors.gradStart ?? "#CCC";
  const gradEnd = colors.gradEnd ?? "#FF8DA1";
  const mouth = colors.mouth ?? "#780606";
  const blink = getBlinkProgress(frame, 2);
  const bobY = Math.sqrt(mouthHeight) * 2.2;

  const isGlitching = animation?.type === "tv-glitch";
  const lf = animation?.localFrame ?? 0;

  const tick = Math.floor(lf / 2);
  const intensity = isGlitching ? (sr(tick) > 0.35 ? sr(tick * 7) : 0) : 0;
  const jitterX = (sr(tick * 5) - 0.5) * intensity * 8;
  const jitterY = (sr(tick * 5 + 1) - 0.5) * intensity * 6;
  const hue = sr(tick * 9) * intensity * 180;
  const bright = 1 + intensity * 0.4;

  const NUM_SLICES = 6;
  const slices = Array.from({ length: NUM_SLICES }, (_, i) => ({
    y0: Math.round(i * 124 / NUM_SLICES),
    y1: Math.round((i + 1) * 124 / NUM_SLICES),
    dx: (sr(tick * 3 + i) - 0.5) * 2 * intensity * 24,
  }));

  const body = (
    <g
      stroke="#000"
      strokeWidth="2"
      fill="url(#bryan-brain-gradient)"
      strokeLinejoin="round"
      strokeLinecap="round"
      transform="translate(2 -8)"
    >
      <path d="M50 50 L75 50 L75 55 L85 55 L85 60 L90 60 L90 70 L80 70 L80 75 L70 75 L70 80 L60 80 L60 85 L50 85 L50 90 L45 90 L45 85 L40 85 L40 80 L35 80 L35 75 L30 75 L30 60 L35 60 L35 55 L40 55 L45 55 L45 50 Z" />
      <rect x="45" y="55" width="20" height="20" fill="#FFF" />
      <rect x="70" y="60" width="10" height="10" fill="#FFF" />
      <rect x="60" y="65" width="2" height="2" fill="#000" />
      <rect x="73" y="65" width="2" height="2" fill="#000" />
      {blink > 0 && (
        <>
          <rect x="45" y="55" width="20" height={blink * 20} fill="url(#bryan-brain-gradient)" />
          <rect x="70" y="60" width="10" height={blink * 10} fill="url(#bryan-brain-gradient)" />
        </>
      )}
      {mouthHeight > 0 && (
        <>
          <rect x="60" y="75" width="15" height={mouthHeight} fill={mouth} />
          <rect x="60" y="76" width="15" height={Math.max(0, Math.min(mouthHeight - 6, 4))} fill="#FFF" />
        </>
      )}
    </g>
  );

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="400"
      height="400"
      viewBox="0 0 124 124"
      fill="none"
      style={{
        transform: `translateY(${bobY}px)${isGlitching ? ` translate(${jitterX}px, ${jitterY}px)` : ""}`,
        filter: isGlitching && intensity > 0 ? `hue-rotate(${hue}deg) brightness(${bright})` : undefined,
      }}
    >
      <defs>
        <linearGradient id="bryan-brain-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={gradStart} />
          <stop offset="100%" stopColor={gradEnd} />
        </linearGradient>
        {isGlitching && slices.map((s, i) => (
          <clipPath key={i} id={`bgs${i}`}>
            <rect x="-50" y={s.y0} width="224" height={s.y1 - s.y0} />
          </clipPath>
        ))}
      </defs>

      {body}

      {isGlitching && slices.map((s, i) => (
        <g key={i} clipPath={`url(#bgs${i})`} transform={`translate(${s.dx}, 0)`}>
          {body}
        </g>
      ))}

    </svg>
  );
};
