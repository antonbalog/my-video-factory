// Single source of truth for Dirtbag's SVG geometry.
// limbAnimations.ts and Dirtbag.tsx both import from here so that
// moving a limb in the SVG automatically keeps animations in sync.
export const DB = {
  // Right arm (wave / thumb animations)
  R_ARM_W:    10,
  R_ARM_H:    10,
  R_ARM_X:    65,  // rest x (matches SVG body path)
  R_ARM_Y:   100,  // rest y

  // Left arm
  L_ARM_W:    10,
  L_ARM_H:    10,
  L_ARM_X:    75,  // rest x
  L_ARM_Y:   100,  // rest y

  // Thumb (always on the right arm)
  THUMB_W:     5,
  THUMB_H:     5,
  THUMB_DX:    5,    // offset from arm top-left x
  THUMB_DY:    2.5,  // offset from arm top-left y

  // Gesture target (arm moves here for thumb-up/down)
  GESTURE_X:  45,
  GESTURE_Y:  90,

  // Thumb extended positions (relative to SVG coordinate space)
  THUMB_UP_Y:   85,
  THUMB_DOWN_Y: 100,

  // Wave height
  WAVE_Y: 60,

  // Tear drop
  TEAR_X:       85,
  TEAR_W:        5,
  TEAR_H_START:  5,
  TEAR_H_END:   10,
  TEAR_START_Y: 70,
  TEAR_END_Y:  110,  // body bottom (120) minus max tear height (10)
  TEAR_COLOR:  "#00FFF0",
} as const;
