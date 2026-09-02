export const TYPE_CHART: Record<string, Record<string, number>> = {
  Fire: { Fire: 0.5, Water: 0.5, Grass: 2, Electric: 1, Ice: 2, Psychic: 1, Normal: 1, Fighting: 1, Flying: 1, Ground: 1, Rock: 0.5, Bug: 2, Poison: 1, Ghost: 1, Dragon: 0.5, Dark: 1, Steel: 2, Fairy: 1 },
  Water: { Fire: 2, Water: 0.5, Grass: 0.5, Electric: 1, Ice: 1, Psychic: 1, Normal: 1, Fighting: 1, Flying: 1, Ground: 2, Rock: 2, Bug: 1, Poison: 1, Ghost: 1, Dragon: 0.5, Dark: 1, Steel: 1, Fairy: 1 },
  Grass: { Fire: 0.5, Water: 2, Grass: 0.5, Electric: 1, Ice: 1, Psychic: 1, Normal: 1, Fighting: 1, Flying: 0.5, Ground: 2, Rock: 2, Bug: 0.5, Poison: 0.5, Ghost: 1, Dragon: 0.5, Dark: 1, Steel: 0.5, Fairy: 1 },
  Electric: { Fire: 1, Water: 2, Grass: 0.5, Electric: 0.5, Ice: 1, Psychic: 1, Normal: 1, Fighting: 1, Flying: 2, Ground: 0.25, Rock: 1, Bug: 1, Poison: 1, Ghost: 1, Dragon: 0.5, Dark: 1, Steel: 1, Fairy: 1 },
  Ice: { Fire: 0.5, Water: 0.5, Grass: 2, Electric: 1, Ice: 0.5, Psychic: 1, Normal: 1, Fighting: 1, Flying: 2, Ground: 2, Rock: 1, Bug: 1, Poison: 1, Ghost: 1, Dragon: 2, Dark: 1, Steel: 0.5, Fairy: 1 },
  Psychic: { Fire: 1, Water: 1, Grass: 1, Electric: 1, Ice: 1, Psychic: 0.5, Normal: 1, Fighting: 2, Flying: 1, Ground: 1, Rock: 1, Bug: 1, Poison: 2, Ghost: 1, Dragon: 1, Dark: 0.25, Steel: 0.5, Fairy: 1 },
  Normal: { Fire: 1, Water: 1, Grass: 1, Electric: 1, Ice: 1, Psychic: 1, Normal: 1, Fighting: 1, Flying: 1, Ground: 1, Rock: 0.5, Bug: 1, Poison: 1, Ghost: 0.25, Dragon: 1, Dark: 1, Steel: 0.5, Fairy: 1 },
  Fighting: { Fire: 1, Water: 1, Grass: 1, Electric: 1, Ice: 2, Psychic: 0.5, Normal: 2, Fighting: 1, Flying: 0.5, Ground: 1, Rock: 2, Bug: 0.5, Poison: 0.5, Ghost: 0.25, Dragon: 1, Dark: 2, Steel: 2, Fairy: 0.5 },
  Flying: { Fire: 1, Water: 1, Grass: 2, Electric: 0.5, Ice: 1, Psychic: 1, Normal: 1, Fighting: 2, Flying: 1, Ground: 1, Rock: 0.5, Bug: 2, Poison: 1, Ghost: 1, Dragon: 1, Dark: 1, Steel: 0.5, Fairy: 1 },
  Ground: { Fire: 2, Water: 1, Grass: 0.5, Electric: 2, Ice: 1, Psychic: 1, Normal: 1, Fighting: 1, Flying: 0.25, Ground: 1, Rock: 2, Bug: 0.5, Poison: 2, Ghost: 1, Dragon: 1, Dark: 1, Steel: 2, Fairy: 1 },
  Rock: { Fire: 2, Water: 1, Grass: 1, Electric: 1, Ice: 2, Psychic: 1, Normal: 1, Fighting: 0.5, Flying: 2, Ground: 0.5, Rock: 1, Bug: 2, Poison: 1, Ghost: 1, Dragon: 1, Dark: 1, Steel: 0.5, Fairy: 1 },
  Bug: { Fire: 0.5, Water: 1, Grass: 2, Electric: 1, Ice: 1, Psychic: 2, Normal: 1, Fighting: 0.5, Flying: 0.5, Ground: 1, Rock: 1, Bug: 1, Poison: 0.5, Ghost: 0.5, Dragon: 1, Dark: 2, Steel: 0.5, Fairy: 0.5 },
  Poison: { Fire: 1, Water: 1, Grass: 2, Electric: 1, Ice: 1, Psychic: 1, Normal: 1, Fighting: 1, Flying: 1, Ground: 0.5, Rock: 0.5, Bug: 1, Poison: 0.5, Ghost: 0.5, Dragon: 1, Dark: 1, Steel: 0.25, Fairy: 2 },
  Ghost: { Fire: 1, Water: 1, Grass: 1, Electric: 1, Ice: 1, Psychic: 2, Normal: 0.25, Fighting: 1, Flying: 1, Ground: 1, Rock: 1, Bug: 1, Poison: 1, Ghost: 2, Dragon: 1, Dark: 0.5, Steel: 1, Fairy: 1 },
  Dragon: { Fire: 1, Water: 1, Grass: 1, Electric: 1, Ice: 1, Psychic: 1, Normal: 1, Fighting: 1, Flying: 1, Ground: 1, Rock: 1, Bug: 1, Poison: 1, Ghost: 1, Dragon: 2, Dark: 1, Steel: 0.5, Fairy: 0.25 },
  Dark: { Fire: 1, Water: 1, Grass: 1, Electric: 1, Ice: 1, Psychic: 2, Normal: 1, Fighting: 0.5, Flying: 1, Ground: 1, Rock: 1, Bug: 1, Poison: 1, Ghost: 2, Dragon: 1, Dark: 0.5, Steel: 1, Fairy: 0.5 },
  Steel: { Fire: 0.5, Water: 0.5, Grass: 1, Electric: 0.5, Ice: 2, Psychic: 1, Normal: 1, Fighting: 1, Flying: 1, Ground: 1, Rock: 2, Bug: 1, Poison: 1, Ghost: 1, Dragon: 1, Dark: 1, Steel: 0.5, Fairy: 2 },
  Fairy: { Fire: 0.5, Water: 1, Grass: 1, Electric: 1, Ice: 1, Psychic: 1, Normal: 1, Fighting: 2, Flying: 1, Ground: 1, Rock: 1, Bug: 1, Poison: 0.5, Ghost: 1, Dragon: 2, Dark: 2, Steel: 0.5, Fairy: 1 },
  // Stellar (Terapagos-Stellar's exclusive typing): no resistances or weaknesses
  // taken (every other attacking type's chart lacks a Stellar column, so it
  // falls through to the neutral 1x default) -- and deals super effective only
  // against a Stellar-type defender, neutral against everything else.
  Stellar: { Stellar: 2 },
};

export const TYPE_COLOR: Record<string, string> = {
  Normal: "#a8a878",
  Fire: "#f08030",
  Water: "#6890f0",
  Grass: "#78c850",
  Electric: "#f8d030",
  Ice: "#98d8d8",
  Fighting: "#c03028",
  Poison: "#a040a0",
  Ground: "#e0c068",
  Flying: "#a890f0",
  Psychic: "#f85888",
  Bug: "#a8b820",
  Rock: "#b8a038",
  Ghost: "#705898",
  Dragon: "#7038f8",
  Dark: "#705848",
  Steel: "#b8b8d0",
  Fairy: "#ee99ac",
  Stellar: "#40b5a5",
};

// Rounds an additive multiplier adjustment to 2 decimals, clearing the float
// imprecision that (m - 0.2) / (m + 0.2) style arithmetic can introduce.
function roundDown2(v: number): number {
  return Math.floor(v * 100) / 100;
}

/** A single attacking type against a (mono or dual) defending type list.
 *  Same-direction dual defense is no longer a straight product of both
 *  factors: a double resist subtracts an extra flat 20 percentage points
 *  from the leading type's own reduction instead of compounding, and a
 *  double weakness adds an extra flat 20 percentage points the same way.
 *  Mixed (one resists, one is weak/neutral) and single-type cases are
 *  unchanged — still a straight product. */
function defenseMultiplier(atkType: string, defTypes: string[]): number {
  const chart = TYPE_CHART[atkType];
  if (!chart) return 1;
  const m1 = chart[defTypes[0]] ?? 1;
  if (!defTypes[1]) return m1;
  const m2 = chart[defTypes[1]] ?? 1;
  if (m1 === 0 || m2 === 0) return 0;
  if (m1 < 1 && m2 < 1) return Math.max(0, roundDown2(m1 - 0.2));
  if (m1 > 1 && m2 > 1) return roundDown2(m1 + 0.2);
  return m1 * m2;
}

/** `teraType`, when passed, forces offense to that single type only — no
 *  picking the better of two attacking types, since a terastallized
 *  Pokemon's attacks all carry its (one) tera type in this simplified model.
 *  Without it, the attacker still picks whichever of its own two types deals
 *  more damage, same as before. Defense is untouched by tera status either
 *  way — `defTypes` should always be the defender's original (pre-tera)
 *  typing. */
export function typeMultiplier(atkTypes: string[], defTypes: string[], teraType?: string): number {
  if (teraType) return defenseMultiplier(teraType, defTypes);
  const first = defenseMultiplier(atkTypes[0], defTypes);
  const second = atkTypes[1] ? defenseMultiplier(atkTypes[1], defTypes) : 0;
  return Math.max(first, second);
}
