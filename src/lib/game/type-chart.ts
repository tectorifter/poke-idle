export const TYPE_CHART: Record<string, Record<string, number>> = {
  Fire: { Fire: 0.5, Water: 0.5, Grass: 2, Electric: 1, Ice: 2, Psychic: 1, Normal: 1, Fighting: 1, Flying: 1, Ground: 1, Rock: 0.5, Bug: 2, Poison: 1, Ghost: 1, Dragon: 0.5, Dark: 1, Steel: 0.5, Fairy: 0.5 },
  Water: { Fire: 2, Water: 0.5, Grass: 0.5, Electric: 1, Ice: 1, Psychic: 1, Normal: 1, Fighting: 1, Flying: 1, Ground: 2, Rock: 2, Bug: 1, Poison: 1, Ghost: 1, Dragon: 0.5, Dark: 1, Steel: 0.5, Fairy: 1 },
  Grass: { Fire: 0.5, Water: 2, Grass: 0.5, Electric: 1, Ice: 1, Psychic: 1, Normal: 1, Fighting: 1, Flying: 0.5, Ground: 2, Rock: 2, Bug: 0.5, Poison: 0.5, Ghost: 1, Dragon: 0.5, Dark: 1, Steel: 1, Fairy: 1 },
  Electric: { Fire: 1, Water: 2, Grass: 0.5, Electric: 0.5, Ice: 1, Psychic: 1, Normal: 1, Fighting: 1, Flying: 2, Ground: 0.25, Rock: 1, Bug: 1, Poison: 1, Ghost: 1, Dragon: 0.5, Dark: 1, Steel: 0.5, Fairy: 1 },
  Ice: { Fire: 0.5, Water: 0.5, Grass: 2, Electric: 1, Ice: 0.5, Psychic: 1, Normal: 1, Fighting: 1, Flying: 2, Ground: 2, Rock: 1, Bug: 1, Poison: 1, Ghost: 1, Dragon: 2, Dark: 1, Steel: 2, Fairy: 1 },
  Psychic: { Fire: 1, Water: 1, Grass: 1, Electric: 1, Ice: 1, Psychic: 0.5, Normal: 1, Fighting: 2, Flying: 1, Ground: 1, Rock: 1, Bug: 1, Poison: 2, Ghost: 1, Dragon: 1, Dark: 2, Steel: 1, Fairy: 1 },
  Normal: { Fire: 1, Water: 1, Grass: 1, Electric: 1, Ice: 1, Psychic: 1, Normal: 1, Fighting: 1, Flying: 1, Ground: 1, Rock: 0.5, Bug: 1, Poison: 1, Ghost: 0.25, Dragon: 1, Dark: 1, Steel: 1, Fairy: 1 },
  Fighting: { Fire: 1, Water: 1, Grass: 1, Electric: 1, Ice: 2, Psychic: 0.5, Normal: 2, Fighting: 1, Flying: 0.5, Ground: 1, Rock: 2, Bug: 0.5, Poison: 0.5, Ghost: 0.25, Dragon: 1, Dark: 0.5, Steel: 1, Fairy: 2 },
  Flying: { Fire: 1, Water: 1, Grass: 2, Electric: 0.5, Ice: 1, Psychic: 1, Normal: 1, Fighting: 2, Flying: 1, Ground: 1, Rock: 0.5, Bug: 2, Poison: 1, Ghost: 1, Dragon: 1, Dark: 0.5, Steel: 1, Fairy: 1 },
  Ground: { Fire: 2, Water: 1, Grass: 0.5, Electric: 2, Ice: 1, Psychic: 1, Normal: 1, Fighting: 1, Flying: 0.25, Ground: 1, Rock: 0.5, Bug: 2, Poison: 1, Ghost: 1, Dragon: 1, Dark: 1, Steel: 1, Fairy: 1 },
  Rock: { Fire: 2, Water: 1, Grass: 1, Electric: 1, Ice: 2, Psychic: 1, Normal: 1, Fighting: 0.5, Flying: 2, Ground: 0.5, Rock: 1, Bug: 2, Poison: 1, Ghost: 1, Dragon: 1, Dark: 1, Steel: 2, Fairy: 1 },
  Bug: { Fire: 0.5, Water: 1, Grass: 2, Electric: 1, Ice: 1, Psychic: 2, Normal: 1, Fighting: 0.5, Flying: 0.5, Ground: 1, Rock: 1, Bug: 1, Poison: 2, Ghost: 1, Dragon: 1, Dark: 1, Steel: 1, Fairy: 1 },
  Poison: { Fire: 1, Water: 1, Grass: 2, Electric: 1, Ice: 1, Psychic: 1, Normal: 1, Fighting: 1, Flying: 1, Ground: 0.5, Rock: 0.5, Bug: 2, Poison: 0.5, Ghost: 0.5, Dragon: 1, Dark: 1, Steel: 1, Fairy: 0.5 },
  Ghost: { Fire: 1, Water: 1, Grass: 1, Electric: 1, Ice: 1, Psychic: 2, Normal: 0.25, Fighting: 1, Flying: 1, Ground: 1, Rock: 1, Bug: 1, Poison: 1, Ghost: 2, Dragon: 1, Dark: 2, Steel: 1, Fairy: 1 },
  Dragon: { Fire: 1, Water: 1, Grass: 1, Electric: 1, Ice: 1, Psychic: 1, Normal: 1, Fighting: 1, Flying: 1, Ground: 1, Rock: 1, Bug: 1, Poison: 1, Ghost: 1, Dragon: 2, Dark: 1, Steel: 1, Fairy: 2 },
  Dark: { Fire: 1, Water: 1, Grass: 1, Electric: 1, Ice: 1, Psychic: 0.25, Normal: 1, Fighting: 2, Flying: 1, Ground: 1, Rock: 1, Bug: 2, Poison: 1, Ghost: 0.5, Dragon: 1, Dark: 0.5, Steel: 1, Fairy: 2 },
  Steel: { Fire: 2, Water: 1, Grass: 0.5, Electric: 1, Ice: 0.5, Psychic: 0.5, Normal: 0.5, Fighting: 2, Flying: 0.5, Ground: 2, Rock: 0.5, Bug: 0.5, Poison: 0.25, Ghost: 1, Dragon: 0.5, Dark: 1, Steel: 0.5, Fairy: 0.5 },
  Fairy: { Fire: 1, Water: 1, Grass: 1, Electric: 1, Ice: 1, Psychic: 1, Normal: 1, Fighting: 0.5, Flying: 1, Ground: 1, Rock: 1, Bug: 0.5, Poison: 2, Ghost: 1, Dragon: 0.25, Dark: 0.5, Steel: 2, Fairy: 1 },
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
};

export function typeMultiplier(atkTypes: string[], defTypes: string[]): number {
  const effectiveness = (atk: string, defs: string[]) => {
    const chart = TYPE_CHART[atk];
    if (!chart) return 1;
    const a = chart[defs[0]] ?? 1;
    const b = defs[1] ? (chart[defs[1]] ?? 1) : 1;
    return a * b;
  };
  const first = effectiveness(atkTypes[0], defTypes);
  const second = atkTypes[1] ? effectiveness(atkTypes[1], defTypes) : 0;
  return Math.max(first, second);
}
