import React from "react";
import { BackgroundConfig } from "../types";
import { ColorBackground } from "./ColorBackground";
import { ChessboardBackground } from "./ChessboardBackground";
import { PatternBackground } from "./PatternBackground";
import { SvgBackground } from "./SvgBackground";
import { PerspectiveFloorBackground } from "./PerspectiveFloorBackground";
import { NightGrassBackground } from "./NightGrassBackground";

export const renderBackground = (bg: BackgroundConfig): React.ReactElement => {
  if (bg.type === "color") return <ColorBackground value={bg.value} />;
  if (bg.type === "chessboard")
    return <ChessboardBackground tileSize={bg.tileSize} color1={bg.color1} color2={bg.color2} pulse={bg.pulse} />;
  if (bg.type === "pattern") return <PatternBackground src={bg.src} tileSize={bg.tileSize} />;
  if (bg.type === "perspective-floor")
    return <PerspectiveFloorBackground tileSize={bg.tileSize} color1={bg.color1} color2={bg.color2} horizon={bg.horizon} />;
  if (bg.type === "night-grass")
    return <NightGrassBackground horizon={bg.horizon} />;
  return <SvgBackground src={bg.src} />;
};
