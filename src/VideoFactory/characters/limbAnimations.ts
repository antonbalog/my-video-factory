import { Easing, interpolate } from "remotion";

export type LimbState = {
  right: { x: number; y: number } | null;
  left: { x: number; y: number };
  rightBehind: boolean;
  leftBehind: boolean;
  thumb?: { x: number; y: number } | null;
  thumbBehind?: boolean;
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

  "thumb-up": {
    duration: () => 180,
    evaluate: (lf) => {
      const easing = Easing.inOut(Easing.quad);
      const HAND_REST_X = 65, HAND_REST_Y = 100;
      const HAND_TARGET_X = 45, HAND_TARGET_Y = 90;
      const THUMB_DX = 5, THUMB_DY = 2.5;
      const THUMB_OUT_Y = 85;

      let handX: number, handY: number, thumbX: number, thumbY: number;
      if (lf < 30) {
        handX = interpolate(lf, [0, 29], [HAND_REST_X, HAND_TARGET_X], { extrapolateRight: "clamp", easing });
        handY = interpolate(lf, [0, 29], [HAND_REST_Y, HAND_TARGET_Y], { extrapolateRight: "clamp", easing });
        thumbX = handX + THUMB_DX;
        thumbY = handY + THUMB_DY;
      } else if (lf < 60) {
        handX = HAND_TARGET_X; handY = HAND_TARGET_Y;
        thumbX = HAND_TARGET_X + THUMB_DX;
        thumbY = interpolate(lf, [30, 59], [HAND_TARGET_Y + THUMB_DY, THUMB_OUT_Y], { extrapolateRight: "clamp", easing });
      } else if (lf < 120) {
        handX = HAND_TARGET_X; handY = HAND_TARGET_Y;
        thumbX = HAND_TARGET_X + THUMB_DX; thumbY = THUMB_OUT_Y;
      } else if (lf < 150) {
        handX = HAND_TARGET_X; handY = HAND_TARGET_Y;
        thumbX = HAND_TARGET_X + THUMB_DX;
        thumbY = interpolate(lf, [120, 149], [THUMB_OUT_Y, HAND_TARGET_Y + THUMB_DY], { extrapolateRight: "clamp", easing });
      } else {
        handX = interpolate(lf, [150, 179], [HAND_TARGET_X, HAND_REST_X], { extrapolateRight: "clamp", easing });
        handY = interpolate(lf, [150, 179], [HAND_TARGET_Y, HAND_REST_Y], { extrapolateRight: "clamp", easing });
        thumbX = handX + THUMB_DX;
        thumbY = handY + THUMB_DY;
      }
      return { ...DEFAULT, right: { x: handX, y: handY }, rightBehind: true, thumb: { x: thumbX, y: thumbY }, thumbBehind: true };
    },
  },

  "thumb-down": {
    duration: () => 180,
    evaluate: (lf) => {
      const easing = Easing.inOut(Easing.quad);
      const HAND_REST_X = 65, HAND_REST_Y = 100;
      const HAND_TARGET_X = 45, HAND_TARGET_Y = 90;
      const THUMB_DX = 5, THUMB_DY = 2.5;
      const THUMB_OUT_Y = 100;

      let handX: number, handY: number, thumbX: number, thumbY: number;
      if (lf < 30) {
        handX = interpolate(lf, [0, 29], [HAND_REST_X, HAND_TARGET_X], { extrapolateRight: "clamp", easing });
        handY = interpolate(lf, [0, 29], [HAND_REST_Y, HAND_TARGET_Y], { extrapolateRight: "clamp", easing });
        thumbX = handX + THUMB_DX;
        thumbY = handY + THUMB_DY;
      } else if (lf < 60) {
        handX = HAND_TARGET_X; handY = HAND_TARGET_Y;
        thumbX = HAND_TARGET_X + THUMB_DX;
        thumbY = interpolate(lf, [30, 59], [HAND_TARGET_Y + THUMB_DY, THUMB_OUT_Y], { extrapolateRight: "clamp", easing });
      } else if (lf < 120) {
        handX = HAND_TARGET_X; handY = HAND_TARGET_Y;
        thumbX = HAND_TARGET_X + THUMB_DX; thumbY = THUMB_OUT_Y;
      } else if (lf < 150) {
        handX = HAND_TARGET_X; handY = HAND_TARGET_Y;
        thumbX = HAND_TARGET_X + THUMB_DX;
        thumbY = interpolate(lf, [120, 149], [THUMB_OUT_Y, HAND_TARGET_Y + THUMB_DY], { extrapolateRight: "clamp", easing });
      } else {
        handX = interpolate(lf, [150, 179], [HAND_TARGET_X, HAND_REST_X], { extrapolateRight: "clamp", easing });
        handY = interpolate(lf, [150, 179], [HAND_TARGET_Y, HAND_REST_Y], { extrapolateRight: "clamp", easing });
        thumbX = handX + THUMB_DX;
        thumbY = handY + THUMB_DY;
      }
      return { ...DEFAULT, right: { x: handX, y: handY }, rightBehind: true, thumb: { x: thumbX, y: thumbY }, thumbBehind: true };
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
