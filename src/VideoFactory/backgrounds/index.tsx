import React from "react";
import { BackgroundConfig } from "../types";
import { ChessboardBackground } from "./ChessboardBackground";

export const renderBackground = (bg: BackgroundConfig): React.ReactElement => (
  <ChessboardBackground tileSize={bg.tileSize} color1={bg.color1} color2={bg.color2} pulse={bg.pulse} />
);
