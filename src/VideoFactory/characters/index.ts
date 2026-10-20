import React from "react";
import { Lacey } from "./Lacey";
import { Bryan } from "./Bryan";
import { Dirtbag } from "./Dirtbag";
import { Ufo } from "./Ufo";
import characters from "../../../characters.json";

export type CharacterProps = {
  colors?: Record<string, string>;
  props?: Record<string, unknown>;
  mouthHeight?: number;
  animation?: { type: string; localFrame: number; params?: Record<string, unknown> } | null;
};

// Must have exactly one component per key in characters.json (checked by tsc)
type CharacterId = keyof typeof characters;

const registry = {
  lacey: Lacey as React.FC<CharacterProps>,
  bryan: Bryan as React.FC<CharacterProps>,
  dirtbag: Dirtbag as React.FC<CharacterProps>,
  ufo: Ufo as React.FC<CharacterProps>,
} satisfies Record<CharacterId, React.FC<CharacterProps>>;

export const characterRegistry: Record<string, React.FC<CharacterProps>> = registry;
