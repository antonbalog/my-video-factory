import React from "react";
import { useCurrentFrame } from "remotion";
import { getBlinkProgress } from "../utils/blink";
import { evaluateLimbs } from "./limbAnimations";

type Props = {
  colors?: {
    bodyStart?: string;
    bodyEnd?: string;
    headStart?: string;
    headEnd?: string;
    mouth?: string;
  };
  props?: Record<string, unknown>;
  mouthHeight?: number;
  animation?: { type: string; localFrame: number; params?: Record<string, unknown> } | null;
};

export const Dirtbag: React.FC<Props> = ({ colors = {}, mouthHeight = 0, animation = null }) => {
  const frame = useCurrentFrame();
  const bodyStart = colors.bodyStart ?? "#F3E5AB";
  const bodyEnd = colors.bodyEnd ?? "#222";
  const headStart = colors.headStart ?? "#FFF";
  const headEnd = colors.headEnd ?? "#777";
  const mouth = colors.mouth ?? "#780606";

  const blink = getBlinkProgress(frame, 1);
  const bobY = Math.sqrt(mouthHeight) * 0.67;

  const { right: rightPos, left: leftPos, rightBehind, leftBehind } = evaluateLimbs(animation);

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="400"
      height="400"
      viewBox="0 0 124 124"
      fill="none"
    >
      <defs>
        <linearGradient id="dirtbag-head-gradient" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={headStart} />
          <stop offset="100%" stopColor={headEnd} />
        </linearGradient>
        <linearGradient id="dirtbag-body-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={bodyStart} />
          <stop offset="100%" stopColor={bodyEnd} />
        </linearGradient>
      </defs>
      <g
        stroke="#000"
        strokeWidth="2"
        fill="url(#dirtbag-body-gradient)"
        strokeLinejoin="round"
        strokeLinecap="round"
        transform="translate(-13 -8)"
      >
        {rightPos && rightBehind  && <rect x={rightPos.x} y={rightPos.y} width="10" height="10" fill="url(#dirtbag-head-gradient)" />}
        {leftBehind               && <rect x={leftPos.x}  y={leftPos.y}  width="10" height="10" fill="url(#dirtbag-head-gradient)" />}
        <path d="M60 80 L85 80 L85 120 L75 120 L75 110 L70 110 L70 120 L65 120 L65 80 Z" />
        {rightPos && !rightBehind && <rect x={rightPos.x} y={rightPos.y} width="10" height="10" fill="url(#dirtbag-head-gradient)" />}
        {!leftBehind              && <rect x={leftPos.x}  y={leftPos.y}  width="10" height="10" fill="url(#dirtbag-head-gradient)" />}
        <g transform={`translate(0, ${bobY})`}>
          <rect x="55" y="40" width="40" height="40" fill="url(#dirtbag-head-gradient)" />
          <rect x="55" y="60" width="10" height="10" fill="#FFF" />
          <rect x="70" y="55" width="20" height="20" fill="#FFF" />
          <rect x="60" y="65" width="2" height="2" fill="#000" />
          <rect x="73" y="65" width="2" height="2" fill="#000" />
          {blink > 0 && (
            <>
              <rect x="55" y="60" width="10" height={blink * 10} fill="url(#dirtbag-head-gradient)" />
              <rect x="70" y="55" width="20" height={blink * 20} fill="url(#dirtbag-head-gradient)" />
            </>
          )}
          {mouthHeight > 0 && (
            <>
              <rect x="60" y="75" width="15" height={mouthHeight} fill={mouth} />
              <rect x="60" y="76" width="15" height={Math.max(0, Math.min(mouthHeight - 6, 4))} fill="#FFF" />
            </>
          )}
        </g>
      </g>
    </svg>
  );
};
