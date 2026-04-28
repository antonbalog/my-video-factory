import { interpolate } from "remotion";

export type MouthShape = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "X";

export type MouthCue = {
  start: number; // seconds
  end: number;   // seconds
  value: MouthShape;
};

export function getMouthShape(frame: number, fps: number, cues: MouthCue[]): MouthShape {
  const time = frame / fps;
  for (const cue of cues) {
    if (time >= cue.start && time < cue.end) return cue.value;
  }
  return "X";
}

const SHAPE_HEIGHT: Record<MouthShape, number> = {
  X: 0, A: 2, B: 5, F: 5, G: 5, C: 10, D: 10, E: 10, H: 10,
};

export function getMouthHeight(
  frame: number,
  fps: number,
  cues: MouthCue[],
  transitionFrames = 4,
): number {
  const time = frame / fps;

  let activeCue: MouthCue | null = null;
  for (const cue of cues) {
    if (time >= cue.start && time < cue.end) { activeCue = cue; break; }
  }
  if (activeCue === null) return 0;

  const targetHeight = SHAPE_HEIGHT[activeCue.value];

  let prevCue: MouthCue | null = null;
  for (const cue of cues) {
    if (cue.end <= activeCue.start && (prevCue === null || cue.end > prevCue.end)) prevCue = cue;
  }
  const prevHeight = prevCue !== null ? SHAPE_HEIGHT[prevCue.value] : 0;

  const framesIntoThisCue = frame - activeCue.start * fps;
  if (framesIntoThisCue >= transitionFrames) return targetHeight;

  return interpolate(framesIntoThisCue, [0, transitionFrames], [prevHeight, targetHeight], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}
