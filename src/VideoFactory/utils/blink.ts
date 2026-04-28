import { interpolate } from "remotion";

const CHECK_INTERVAL = 60; // check every second @ 60fps
const BLINK_CHANCE = 0.35; // ~35% chance per check → avg blink every ~3s
const BLINK_FRAMES = 16;   // frames to fully close + reopen

function seededRandom(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** Returns 0 (eyes open) to 1 (eyes fully closed) */
export function getBlinkProgress(frame: number, seed: number): number {
  const checkpoint = Math.floor(frame / CHECK_INTERVAL) * CHECK_INTERVAL;
  if (seededRandom(checkpoint + seed) > 1 - BLINK_CHANCE) {
    const f = frame - checkpoint;
    if (f < BLINK_FRAMES) {
      return interpolate(f, [0, BLINK_FRAMES / 2, BLINK_FRAMES], [0, 1, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
    }
  }
  return 0;
}
