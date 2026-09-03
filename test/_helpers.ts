import { afterEach, expect } from "vitest";
import { makeOwned } from "@/lib/game/formulas";
import type { MoveData, MoveCategory } from "@/lib/game/moves";
import type { OwnedPoke } from "@/lib/game/types";

// ── deterministic RNG ────────────────────────────────────────────────────────
const realRandom = Math.random;
afterEach(() => {
  Math.random = realRandom;
});

/** Force Math.random to a fixed value (or cycle through a list). */
export function stubRandom(...values: number[]) {
  let i = 0;
  Math.random = () => values[i++ % values.length];
}

/** Feed Math.random from a queue; throws if it runs dry (catches over-consumption). */
export function queueRandom(values: number[]) {
  let i = 0;
  Math.random = () => {
    if (i >= values.length) throw new Error(`RNG queue exhausted after ${values.length} draws`);
    return values[i++];
  };
}

// ── Monte-Carlo helpers ─────────────────────────────────────────────────────

/** Run `fn` `n` times; return the fraction of runs where it returned truthy. */
export function rate(fn: () => unknown, n: number): number {
  let hits = 0;
  for (let i = 0; i < n; i++) if (fn()) hits++;
  return hits / n;
}

/** ±tolerance for an observed proportion `p` over `n` samples at `z` sigma.
 *  z=5 → a spurious failure roughly once in 3M assertions. */
export function binomTol(p: number, n: number, z = 5): number {
  return z * Math.sqrt(Math.max(p * (1 - p), 1e-6) / n) + 0.5 / n;
}

/** Assert an observed rate matches `expected` within statistical noise. */
export function expectRate(observed: number, expected: number, n: number, z = 5) {
  const tol = binomTol(expected, n, z);
  expect(
    Math.abs(observed - expected),
    `rate ${observed.toFixed(4)} vs expected ${expected} (±${tol.toFixed(4)}, n=${n})`,
  ).toBeLessThanOrEqual(tol);
}

/** Average of `fn` over `n` runs. */
export function mean(fn: () => number, n: number): number {
  let s = 0;
  for (let i = 0; i < n; i++) s += fn();
  return s / n;
}

// ── fixtures ────────────────────────────────────────────────────────────────

/** A real party mon at a given level, with optional field overrides. */
export function mon(name: string, level = 50, over: Partial<OwnedPoke> = {}): OwnedPoke {
  return { ...makeOwned(name, level), ...over };
}

/** A synthetic move — full control over type/category/power/accuracy. */
export function move(
  type: string,
  category: MoveCategory,
  power: number,
  accuracy: number | true = true,
): MoveData {
  return { name: `Test ${type} ${category}`, type, category, power, accuracy };
}

/** Well-known species with unambiguous typings, for type-interaction tests. */
export const SPECIES = {
  fire: "Charizard", // Fire / Flying
  water: "Blastoise", // Water
  grass: "Venusaur", // Grass / Poison
  electric: "Pikachu", // Electric
  psychic: "Alakazam", // Psychic
  fighting: "Machamp", // Fighting
  ghost: "Gengar", // Ghost / Poison
  normal: "Snorlax", // Normal
  ground: "Rhydon", // Ground / Rock
  rock: "Golem", // Rock / Ground
  steel: "Steelix", // Steel / Ground
  dragon: "Dragonite", // Dragon / Flying
  dark: "Umbreon", // Dark
  bug: "Scizor", // Bug / Steel
  ice: "Articuno", // Ice / Flying
  fairy: "Gardevoir", // Psychic / Fairy
  flying: "Pidgeot", // Normal / Flying
  poison: "Muk", // Poison
} as const;
