export type SceneConfig = {
  id: string;
  backgroundColor: string;
  durationInFrames: number;
};

export type VideoConfig = {
  scenes: SceneConfig[];
};
