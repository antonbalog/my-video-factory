export type BackgroundConfig =
  | { type: "color"; value: string }
  | { type: "svg"; src: string }
  | { type: "pattern"; src: string; tileSize: number }
  | { type: "chessboard"; tileSize: number; color1: string; color2: string; pulse?: { amplitude?: number } };

export type NameTagConfig = {
  label: string;
  color: string;
  strikePrefix?: string;
};

export type CharacterConfig = {
  id: string;
  x: number;
  y: number;
  size?: number;
  colors?: Record<string, string>;
  props?: Record<string, unknown>;
  nameTag?: NameTagConfig;
  behind?: boolean;
};

import type { Caption } from "@remotion/captions";
import type { MouthCue } from "./utils/getMouthShape";

export type BleepConfig = { startMs: number; endMs: number };

export type SfxConfig = { src: string; atMs: number; volume?: number };

export type AudioConfig = {
  src: string;
  subtitles?: string;
  volume?: number;
  /** Rhubarb Lip Sync JSON output path (under public/) */
  mouthCues?: string;
  /** Character id that speaks this clip — used to drive lip sync */
  characterId?: string;
  bleeps?: BleepConfig[];
  censoredWords?: string[];
  trimStart?: number;
  trimEnd?: number;
  padEnd?: number;
  // Runtime-only (set by calculateMetadata):
  startFrame?: number;
  durationInFrames?: number;
  parsedMouthCues?: MouthCue[];
  parsedBleeps?: { startFrame: number; endFrame: number }[];
  trimStartFrames?: number;
};

export type AnimationEvent = {
  characterId: string;
  type: string;
  atMs: number;
  params?: Record<string, unknown>;
  atFrame?: number; // runtime
};

export type SceneConfig = {
  id: string;
  durationInFrames?: number;
  background?: BackgroundConfig;
  tileSize?: number;
  transition?: "cut" | "zoom-in" | "zoom-out";
  characters?: CharacterConfig[];
  audio?: AudioConfig[];
  captions?: Caption[];
  sfx?: SfxConfig[];
  animations?: AnimationEvent[];
};

export type OverlayConfig = {
  colorTop: string;
  colorBottom: string;
  opacityTop?: number;
  opacityMiddle?: number;
};

export type MusicTrack = { src: string; volume?: number };

export type MusicConfig = {
  src?: string;
  volume?: number;
  intro?: MusicTrack;
  loop?: MusicTrack;
  outro?: MusicTrack;
  muted?: boolean;
};

export type VideoConfig = {
  scenes: SceneConfig[];
  defaultBackground: BackgroundConfig;
  defaultCharacters?: CharacterConfig[];
  music?: MusicConfig;
  overlay?: OverlayConfig;
};
