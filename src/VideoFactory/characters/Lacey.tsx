import React from "react";
import { useCurrentFrame } from "remotion";
import { getBlinkProgress } from "../utils/blink";
type Props = { colors?: { body1?: string; body2?: string; mouth?: string }; mouthHeight?: number };

export const Lacey: React.FC<Props> = ({ colors = {}, mouthHeight = 0 }) => {
  const frame = useCurrentFrame();
  const body1 = colors.body1 ?? "#CCC";
  const body2 = colors.body2 ?? "#EEE";
  const mouth = colors.mouth ?? "#780606";
  const blink = getBlinkProgress(frame, 3);
  const bobY = Math.sqrt(mouthHeight) * 2.2;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="400"
      height="400"
      viewBox="0 0 124 124"
      fill="none"
      style={{ transform: `translateY(${bobY}px)` }}
    >
      <defs>
        <pattern
          id="lacey-chess-board"
          width="10"
          height="10"
          patternUnits="userSpaceOnUse"
        >
          <rect x="0" y="0" width="5" height="5" fill={body1} />
          <rect x="5" y="0" width="5" height="5" fill={body2} />
          <rect x="0" y="5" width="5" height="5" fill={body2} />
          <rect x="5" y="5" width="5" height="5" fill={body1} />
        </pattern>
      </defs>
      <g
        stroke="#000"
        strokeWidth="2"

        strokeLinecap="round"
        transform="translate(-8 -8)"
      >
        <rect x="55" y="40" width="40" height="80" fill="url(#lacey-chess-board)" />
        <rect x="45" y="55" width="20" height="20" fill="#FFF" />
        <rect x="70" y="60" width="10" height="10" fill="#FFF" />
        <g strokeLinejoin="round">
          <rect x="60" y="65" width="2" height="2" fill="#000" />
          <rect x="73" y="65" width="2" height="2" fill="#000" />
        </g>
        {blink > 0 && (
          <>
            <rect x="45" y="55" width="20" height={blink * 20} fill="url(#lacey-chess-board)" />
            <rect x="70" y="60" width="10" height={blink * 10} fill="url(#lacey-chess-board)" />
          </>
        )}
        {/* Mouth — hidden when silent, height eases smoothly between cues */}
        {mouthHeight > 0 && (
          <>
            <rect x="60" y="75" width="15" height={mouthHeight} fill={mouth} />
            <rect x="60" y="76" width="15" height={Math.max(0, Math.min(mouthHeight - 6, 4))} fill="#FFF" />
          </>
        )}
      </g>
    </svg>
  );
};
