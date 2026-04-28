import React from "react";
import { Lacey } from "./Lacey";
import { Bryan } from "./Bryan";
import { Dirtbag } from "./Dirtbag";

export type CharacterProps = {
  colors?: Record<string, string>;
  props?: Record<string, unknown>;
  mouthHeight?: number;
  animation?: { type: string; localFrame: number; params?: Record<string, unknown> } | null;
};

export const characterRegistry: Record<string, React.FC<CharacterProps>> = {
  lacey: Lacey as React.FC<CharacterProps>,
  bryan: Bryan as React.FC<CharacterProps>,
  dirtbag: Dirtbag as React.FC<CharacterProps>,
};
