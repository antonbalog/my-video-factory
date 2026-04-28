import { interpolate } from "remotion";

export type LimbState = {
  right: { x: number; y: number } | null;
  left: { x: number; y: number };
  rightBehind: boolean;
  leftBehind: boolean;
};

type AnimDef = {
  duration: (params?: Record<string, unknown>) => number;
  evaluate: (localFrame: number, params?: Record<string, unknown>) => LimbState;
};

const DEFAULT: LimbState = {
  right: null,
  left: { x: 75, y: 100 },
  rightBehind: true,
  leftBehind: false,
};

const WAVE_FRAMES = 100;
const TRANS_FRAMES = 20;
const REST_X = 65;
const REST_Y = 100;
const WAVE_Y = 60;

const FORTNITE_RIGHT_X      = [85, 45, 85, 45, 85, 45];
const FORTNITE_LEFT_X       = [95, 55, 95, 55, 95, 55];
const FORTNITE_RIGHT_BEHIND = [true,  true,  false, false, false, false];
const FORTNITE_LEFT_BEHIND  = [false, false, false, true,  true,  false];

export const LIMB_ANIMATIONS: Record<string, AnimDef> = {
  "wave-intro": {
    duration: () => 120,
    evaluate: (lf) => {
      let rightX: number;
      let rightY: number;
      if (lf < WAVE_FRAMES) {
        rightX = interpolate(lf % 50, [0, 25, 50], [25, 35, 25], { extrapolateRight: "clamp" });
        rightY = WAVE_Y;
      } else {
        const t = lf - WAVE_FRAMES;
        rightX = interpolate(t, [0, TRANS_FRAMES], [25, REST_X], { extrapolateRight: "clamp" });
        rightY = interpolate(t, [0, TRANS_FRAMES], [WAVE_Y, REST_Y], { extrapolateRight: "clamp" });
      }
      return { ...DEFAULT, right: { x: rightX, y: rightY } };
    },
  },

  "wave-outro": {
    duration: () => 120,
    evaluate: (lf) => {
      let rightX: number;
      let rightY: number;
      if (lf < TRANS_FRAMES) {
        rightX = interpolate(lf, [0, TRANS_FRAMES], [REST_X, 25], { extrapolateRight: "clamp" });
        rightY = interpolate(lf, [0, TRANS_FRAMES], [REST_Y, WAVE_Y], { extrapolateRight: "clamp" });
      } else {
        const wf = lf - TRANS_FRAMES;
        rightX = interpolate(wf % 50, [0, 25, 50], [25, 35, 25], { extrapolateRight: "clamp" });
        rightY = WAVE_Y;
      }
      return { ...DEFAULT, right: { x: rightX, y: rightY } };
    },
  },

  "fortnite-dance": {
    duration: (params) => {
      const cycles = (params?.cycles as number | undefined) ?? 1;
      const returnFrames = (params?.returnFrames as number | undefined) ?? 20;
      return cycles * 120 + returnFrames;
    },
    evaluate: (lf, params) => {
      const cycles = (params?.cycles as number | undefined) ?? 1;
      const returnFrames = (params?.returnFrames as number | undefined) ?? 20;
      if (lf < cycles * 120) {
        const stepIndex = Math.floor(lf / 20);
        const t = lf % 20;
        const si = stepIndex % 6;
        const prevSi = stepIndex === 0 ? -1 : (stepIndex - 1) % 6;
        const prevRightX = prevSi === -1 ? 75 : FORTNITE_RIGHT_X[prevSi];
        const prevLeftX  = prevSi === -1 ? 75 : FORTNITE_LEFT_X[prevSi];
        return {
          right: { x: interpolate(t, [0, 20], [prevRightX, FORTNITE_RIGHT_X[si]], { extrapolateRight: "clamp" }), y: 100 },
          left:  { x: interpolate(t, [0, 20], [prevLeftX,  FORTNITE_LEFT_X[si]],  { extrapolateRight: "clamp" }), y: 100 },
          rightBehind: FORTNITE_RIGHT_BEHIND[si],
          leftBehind:  FORTNITE_LEFT_BEHIND[si],
        };
      } else {
        const t = lf - cycles * 120;
        return {
          right: { x: interpolate(t, [0, returnFrames], [45, REST_X], { extrapolateRight: "clamp" }), y: 100 },
          left:  { x: interpolate(t, [0, returnFrames], [55, 75],     { extrapolateRight: "clamp" }), y: 100 },
          rightBehind: true,
          leftBehind: false,
        };
      }
    },
  },

  "tv-glitch": {
    duration: (params) => (params?.durationFrames as number | undefined) ?? 90,
    evaluate: () => DEFAULT,
  },

  "glitch-in": {
    duration: (params) => (params?.durationFrames as number | undefined) ?? 40,
    evaluate: () => DEFAULT,
  },

  "glitch-out": {
    duration: (params) => (params?.durationFrames as number | undefined) ?? 40,
    evaluate: () => DEFAULT,
  },
};

export function evaluateLimbs(
  animation: { type: string; localFrame: number; params?: Record<string, unknown> } | null,
): LimbState {
  if (!animation) return DEFAULT;
  const def = LIMB_ANIMATIONS[animation.type];
  if (!def) return DEFAULT;
  return def.evaluate(animation.localFrame, animation.params);
}
