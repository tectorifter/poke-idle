import type { Nature, StatKey } from "./types";

/** Natures never touch HP. */
export type NatureStat = Exclude<StatKey, "hp">;

/** For each nature: the stat it raises +10% and the stat it lowers −10%.
 *  The five "neutral" natures (chart diagonal) have both null. */
export const NATURES: Record<Nature, { up: NatureStat | null; down: NatureStat | null }> = {
  Hardy: { up: null, down: null },
  Lonely: { up: "atk", down: "def" },
  Adamant: { up: "atk", down: "spa" },
  Naughty: { up: "atk", down: "spd" },
  Brave: { up: "atk", down: "spe" },
  Bold: { up: "def", down: "atk" },
  Docile: { up: null, down: null },
  Impish: { up: "def", down: "spa" },
  Lax: { up: "def", down: "spd" },
  Relaxed: { up: "def", down: "spe" },
  Modest: { up: "spa", down: "atk" },
  Mild: { up: "spa", down: "def" },
  Bashful: { up: null, down: null },
  Rash: { up: "spa", down: "spd" },
  Quiet: { up: "spa", down: "spe" },
  Calm: { up: "spd", down: "atk" },
  Gentle: { up: "spd", down: "def" },
  Careful: { up: "spd", down: "spa" },
  Quirky: { up: null, down: null },
  Sassy: { up: "spd", down: "spe" },
  Timid: { up: "spe", down: "atk" },
  Hasty: { up: "spe", down: "def" },
  Jolly: { up: "spe", down: "spa" },
  Naive: { up: "spe", down: "spd" },
  Serious: { up: null, down: null },
};

export const NATURE_NAMES = Object.keys(NATURES) as Nature[];

export const NATURE_STAT_LABEL: Record<NatureStat, string> = {
  atk: "Atk",
  def: "Def",
  spa: "SpA",
  spd: "SpD",
  spe: "Spe",
};

export function rollNature(): Nature {
  return NATURE_NAMES[Math.floor(Math.random() * NATURE_NAMES.length)];
}

/** Multiplier a nature applies to one stat: 1.1 (favoured), 0.9 (hindered), 1. */
export function natureMult(nature: Nature | undefined, key: StatKey): number {
  if (!nature || key === "hp") return 1;
  const n = NATURES[nature];
  if (key === n.up) return 1.1;
  if (key === n.down) return 0.9;
  return 1;
}

/** Short "+Atk / −SpA" tag for display, or "" for a neutral nature. */
export function natureTag(nature: Nature | undefined): string {
  if (!nature) return "";
  const n = NATURES[nature];
  if (!n.up || !n.down) return "";
  return `+${NATURE_STAT_LABEL[n.up]} / −${NATURE_STAT_LABEL[n.down]}`;
}
