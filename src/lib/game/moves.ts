import movesData from "@/data/moves.json";
import { speciesByName } from "./dex";
import type { OwnedPoke } from "./types";

export type MoveCategory = "Physical" | "Special" | "Status";

/** Trimmed move data (from Pokémon Showdown): base power only — no accuracy,
 *  secondary effects, priority, or multi-hit. Status moves have no effect but
 *  are still listed; multi-hit and variable-power moves are flattened to 80. */
export type MoveData = {
  name: string;
  type: string;
  category: MoveCategory;
  power: number;
};

export const MOVES = movesData as Record<string, MoveData>;

const toID = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
/** Showdown-style move id → move data (learnsets reference moves by id). */
export const MOVE_BY_ID: Record<string, MoveData> = {};
for (const m of Object.values(MOVES)) MOVE_BY_ID[toID(m.name)] = m;

export function getMove(name: string): MoveData | undefined {
  return MOVES[name] ?? MOVE_BY_ID[toID(name)];
}

/** Base-power crit chance (Gen 6+ tier 0): 1 in 24, ×1.5 damage. */
export const CRIT_CHANCE = 1 / 24;
export const CRIT_MULT = 1.5;

/** A solid STAB attack per type — used as a mon's move until move selection
 *  (learnsets / editor) lands. */
const DEFAULT_MOVE_BY_TYPE: Record<string, string> = {
  Normal: "Body Slam",
  Fire: "Flamethrower",
  Water: "Surf",
  Grass: "Energy Ball",
  Electric: "Thunderbolt",
  Ice: "Ice Beam",
  Fighting: "Brick Break",
  Poison: "Sludge Bomb",
  Ground: "Earthquake",
  Flying: "Air Slash",
  Psychic: "Psychic",
  Bug: "Bug Buzz",
  Rock: "Rock Slide",
  Ghost: "Shadow Ball",
  Dragon: "Dragon Claw",
  Dark: "Crunch",
  Steel: "Iron Head",
  Fairy: "Moonblast",
  Stellar: "Body Slam",
};

/** A generic STAB attack for a mon's primary type — the last-resort move when a
 *  mon has no damaging move in its learnable pool (e.g. Magikarp). */
export function fallbackTypeMove(poke: OwnedPoke): MoveData {
  const spec = speciesByName(poke.name);
  const type = spec?.types[0] ?? "Normal";
  const named = getMove(DEFAULT_MOVE_BY_TYPE[type] ?? "Tackle");
  if (named) return named;
  return {
    name: `${type} Attack`,
    type,
    category: spec && spec.spa > spec.atk ? "Special" : "Physical",
    power: 75,
  };
}
