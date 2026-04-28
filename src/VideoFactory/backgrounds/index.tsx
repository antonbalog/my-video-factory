import React from "react";
import { BackgroundConfig } from "../types";
import { ColorBackground } from "./ColorBackground";
import { ChessboardBackground } from "./ChessboardBackground";
import { PatternBackground } from "./PatternBackground";
import { SvgBackground } from "./SvgBackground";

export const renderBackground = (bg: BackgroundConfig): React.ReactElement => {
  if (bg.type === "color") return <ColorBackground value={bg.value} />;
  if (bg.type === "chessboard")
    return <ChessboardBackground tileSize={bg.tileSize} color1={bg.color1} color2={bg.color2} />;
  if (bg.type === "pattern") return <PatternBackground src={bg.src} tileSize={bg.tileSize} />;
  return <SvgBackground src={bg.src} />;
};
