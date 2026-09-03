import movesData from "@/data/moves.json";
import { speciesByName } from "./dex";
import type { OwnedPoke } from "./types";

export type MoveCategory = "Physical" | "Special" | "Status";

/** Trimmed move data (from Pokémon Showdown): base power + accuracy — no
 *  secondary effects, priority, or multi-hit. Status moves have no effect but
 *  are still listed; multi-hit and variable-power moves are flattened to 80.
 *  `accuracy` is the Showdown value: a percentage, or `true` for "never misses". */
export type MoveData = {
  name: string;
  type: string;
  category: MoveCategory;
  power: number;
  accuracy: number | true;
};

/** Pokémon Showdown accuracy check (no accuracy/evasion stages in this model):
 *  `true` always lands; otherwise roll 0–99 < accuracy. */
export function moveHits(accuracy: number | true): boolean {
  return accuracy === true || Math.floor(Math.random() * 100) < accuracy;
}

export const MOVES = movesData as Record<string, MoveData>;

/** Showdown-style id for a move name (learnsets reference moves by id). */
export const moveId = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
export const MOVE_BY_ID: Record<string, MoveData> = {};
for (const m of Object.values(MOVES)) MOVE_BY_ID[moveId(m.name)] = m;

export function getMove(name: string): MoveData | undefined {
  return MOVES[name] ?? MOVE_BY_ID[moveId(name)];
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
    accuracy: 100,
  };
}

// ─── Dynamax / Gigantamax move conversion ────────────────────────────────────
const MAX_MOVE_NAME: Record<string, string> = {
  Normal: "Max Strike", Fire: "Max Flare", Water: "Max Geyser", Grass: "Max Overgrowth",
  Electric: "Max Lightning", Ice: "Max Hailstorm", Fighting: "Max Knuckle", Poison: "Max Ooze",
  Ground: "Max Quake", Flying: "Max Airstream", Psychic: "Max Mindstorm", Bug: "Max Flutterby",
  Rock: "Max Rockfall", Ghost: "Max Phantasm", Dragon: "Max Wyrmwind", Dark: "Max Darkness",
  Steel: "Max Steelspike", Fairy: "Max Starfall", Stellar: "Max Strike",
};

/** Gigantamax signature move per G-Max species — replaces the Max move of that
 *  one type; other types still get the regular Max move. */
const GMAX_MOVE_BY_SPECIES: Record<string, { type: string; name: string }> = {
  "Gigantamax Venusaur": { type: "Grass", name: "G-Max Vine Lash" },
  "Gigantamax Charizard": { type: "Fire", name: "G-Max Wildfire" },
  "Gigantamax Blastoise": { type: "Water", name: "G-Max Cannonade" },
  "Gigantamax Butterfree": { type: "Bug", name: "G-Max Befuddle" },
  "Gigantamax Pikachu": { type: "Electric", name: "G-Max Volt Crash" },
  "Gigantamax Meowth": { type: "Normal", name: "G-Max Gold Rush" },
  "Gigantamax Machamp": { type: "Fighting", name: "G-Max Chi Strike" },
  "Gigantamax Gengar": { type: "Ghost", name: "G-Max Terror" },
  "Gigantamax Kingler": { type: "Water", name: "G-Max Foam Burst" },
  "Gigantamax Lapras": { type: "Ice", name: "G-Max Resonance" },
  "Gigantamax Eevee": { type: "Normal", name: "G-Max Cuddle" },
  "Gigantamax Snorlax": { type: "Normal", name: "G-Max Replenish" },
  "Gigantamax Garbodor": { type: "Poison", name: "G-Max Malodor" },
  "Gigantamax Rillaboom": { type: "Grass", name: "G-Max Drum Solo" },
  "Gigantamax Cinderace": { type: "Fire", name: "G-Max Fireball" },
  "Gigantamax Inteleon": { type: "Water", name: "G-Max Hydrosnipe" },
  "Gigantamax Corviknight": { type: "Flying", name: "G-Max Wind Rage" },
  "Gigantamax Orbeetle": { type: "Psychic", name: "G-Max Gravitas" },
  "Gigantamax Drednaw": { type: "Water", name: "G-Max Stonesurge" },
  "Gigantamax Coalossal": { type: "Rock", name: "G-Max Volcalith" },
  "Gigantamax Flapple": { type: "Grass", name: "G-Max Tartness" },
  "Gigantamax Appletun": { type: "Grass", name: "G-Max Sweetness" },
  "Gigantamax Sandaconda": { type: "Ground", name: "G-Max Sandblast" },
  "Gigantamax Toxtricity": { type: "Electric", name: "G-Max Stun Shock" },
  "Gigantamax Centiskorch": { type: "Fire", name: "G-Max Centiferno" },
  "Gigantamax Hatterene": { type: "Fairy", name: "G-Max Smite" },
  "Gigantamax Grimmsnarl": { type: "Dark", name: "G-Max Snooze" },
  "Gigantamax Alcremie": { type: "Fairy", name: "G-Max Finale" },
  "Gigantamax Copperajah": { type: "Steel", name: "G-Max Steelsurge" },
  "Gigantamax Duraludon": { type: "Dragon", name: "G-Max Depletion" },
  "Gigantamax Urshifu": { type: "Dark", name: "G-Max One Blow" },
  "Gigantamax Urshifu-Rapid": { type: "Water", name: "G-Max Rapid Flow" },
};

/** Max Move base power from the original move's power (standard Gen 8 table;
 *  Fighting / Poison Max moves are weaker). */
export function maxMovePower(power: number, type: string): number {
  const weak = type === "Fighting" || type === "Poison";
  const rows: [number, number][] = weak
    ? [[40, 70], [50, 75], [60, 80], [70, 85], [100, 90], [140, 95]]
    : [[40, 90], [50, 100], [60, 110], [70, 120], [100, 130], [140, 140]];
  for (const [cap, out] of rows) if (power <= cap) return out;
  return weak ? 100 : 150;
}

/** Convert a move to its Dynamax (Max) form. Max moves never miss. */
export function toMaxMove(move: MoveData): MoveData {
  if (move.category === "Status") {
    return { name: "Max Guard", type: move.type, category: "Status", power: 0, accuracy: true };
  }
  return {
    name: MAX_MOVE_NAME[move.type] ?? "Max Strike",
    type: move.type,
    category: move.category,
    power: maxMovePower(move.power, move.type),
    accuracy: true,
  };
}

/** Convert a move to its Gigantamax form for a specific G-Max species: the
 *  signature-type move becomes the G-Max move, others become regular Max moves. */
export function toGMaxMove(move: MoveData, gmaxSpecies: string): MoveData {
  const sig = GMAX_MOVE_BY_SPECIES[gmaxSpecies];
  if (sig && move.type === sig.type && move.category !== "Status") {
    return {
      name: sig.name,
      type: move.type,
      category: move.category,
      power: maxMovePower(move.power, move.type),
      accuracy: true,
    };
  }
  return toMaxMove(move);
}
