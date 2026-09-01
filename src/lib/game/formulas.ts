import { EXP_TABLE, EVOLUTIONS, speciesByName } from "./dex";
import { typeMultiplier } from "./type-chart";
import type { CatchTier, GrowthRate, OwnedPoke, Species } from "./types";

// ─── Auto-tap & store constants ───────────────────────────────────────────
export const BASE_AUTO_MS = 3000;
export const MIN_AUTO_MS = 500;
export const AUTO_STEP_MS = 100; // −100 ms per level
export const MAX_AUTO_LEVEL = 29; // 3000 → 100

export const MIN_MANUAL_MS = 50;

/** Cost for the next auto-tap level (currentLevel is 0-based). */
export function autoTapCost(currentLevel: number): number {
   return Math.floor(5000 * Math.pow(1.20, currentLevel - 1));
}

export function autoTapMsFromLevel(level: number): number {
  return Math.max(MIN_AUTO_MS, BASE_AUTO_MS - level * AUTO_STEP_MS);
}

// ─── Catch tiers (permanent power, no consumables) ────────────────────────
export const CATCH_TIER_ORDER: CatchTier[] = [
  "pokeball",
  "greatball",
  "ultraball",
  "masterball",
];

const TIER_BASE_MULT: Record<CatchTier, number> = {
  pokeball: 1,
  greatball: 4,
  ultraball: 7,
  masterball: 10,
};

const TIER_LEVEL_OFFSET: Record<CatchTier, number> = {
  pokeball: 0,    // Level 1:   0 + 1 = 1
  greatball: 4,  // Level 1:  10 + 1 = 11
  ultraball: 7,  // Level 1:  20 + 1 = 21
  masterball: 10, // Level 1:  30 + 1 = 31
};

const MAX_CATCH_MULT = 20;
/** Final catch multiplier for a given tier + level (1–10). Caps at 50. */
/** Dynamically spreads the tier difference across 10 levels */
export function catchMultiplier(tier: CatchTier, level: number): number {
  const lvl = Math.max(1, Math.min(10, level));
  const idx = CATCH_TIER_ORDER.indexOf(tier);
  const currentBase = TIER_BASE_MULT[tier];
  
  const isLastTier = idx === CATCH_TIER_ORDER.length - 1;
  const nextBase = isLastTier 
    ? MAX_CATCH_MULT 
    : TIER_BASE_MULT[CATCH_TIER_ORDER[idx + 1]];

  // Standard tiers divide by 10 so the tier upgrade grants the 10th step
  // Master Ball divides by 9 so Level 10 lands exactly on 20.0x
  const step = isLastTier 
    ? (nextBase - currentBase) / 9 
    : (nextBase - currentBase) / 10;

  return Number((currentBase + (lvl - 1) * step).toFixed(1));
}

/** Same cost curve as auto-tap for each catch level (level is 1-based). */
export function catchUpgradeCost(currentLevel: number, tier: CatchTier = "pokeball"): number {
  const totalLevel = TIER_LEVEL_OFFSET[tier] + currentLevel;
  // Scales by 15% compounded each level continuously
  return Math.floor(5000 * Math.pow(1.15, totalLevel - 1));
}

/** Chance % using permanent catch power (always available, no balls consumed). */
export function catchChancePercentPermanent(
  catchRate: number,
  tier: CatchTier,
  level: number,
): number {
  return (catchRate * catchMultiplier(tier, level)) / 3;
}

// ─── Pokeyen reward ───────────────────────────────────────────────────────
/** Base 25 + 3.5 per enemy level. */
export function pokeyenReward(enemyLevel: number): number {
  return Math.floor(25 + 3.5 * enemyLevel);
}

// ─── Unique-caught bonus ──────────────────────────────────────────────────
/** Every 30 unique species caught grants +1 Atk and +1 Def to the player. */
export function uniqueCaughtBonus(uniqueCount: number): number {
  return Math.floor(uniqueCount / 30);
}

// ─── Player prestige ──────────────────────────────────────────────────────
/** Global player prestige multiplies combat stats the same way old per-mon prestige did. */
export function playerPrestigeMult(prestige: number): number {
  return 1 + prestige / 100;
}

// ─── Anomaly detection ────────────────────────────────────────────────────
/** Anomaly forms are identified by name prefix / region flag. */
export function isAnomalyName(name: string): boolean {
  return (
    name.startsWith("M-") ||
    name.startsWith("Dynamax ") ||
    name.startsWith("Tera ") ||
    name.includes("Anomaly")
  );
}

// ─── Existing combat helpers (adapted) ────────────────────────────────────
export const HEAL_COOLDOWN_MS = 15_000;
export const SHINY_ODDS = 1 / 8192;
export const TEAM_SIZE = 6;

export function newUid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export function levelOf(poke: OwnedPoke, growth?: GrowthRate): number {
  const spec = speciesByName(poke.name);
  const table = EXP_TABLE[(growth ?? spec?.growth ?? "Medium Fast") as GrowthRate];
  if (!table) return 1;
  let lvl = 0;
  for (let i = 0; i < table.length; i++) {
    if (table[i] <= poke.exp) lvl = i + 1;
    else break;
  }
  return Math.max(1, Math.min(100, lvl));
}

export function expAtLevel(growth: GrowthRate, level: number): number {
  const table = EXP_TABLE[growth];
  return table[Math.max(0, Math.min(100, level) - 1)] ?? 1;
}

export function thisLevelExp(poke: OwnedPoke): number {
  const spec = speciesByName(poke.name);
  const table = EXP_TABLE[(spec?.growth ?? "Medium Fast") as GrowthRate];
  const lvl = levelOf(poke);
  return table[lvl - 1] ?? 1;
}

export function nextLevelExp(poke: OwnedPoke): number {
  const spec = speciesByName(poke.name);
  const table = EXP_TABLE[(spec?.growth ?? "Medium Fast") as GrowthRate];
  const lvl = levelOf(poke);
  return table[Math.min(100, lvl)] ?? table[table.length - 1];
}

const MEGA_STAT_MULT = 1.05;
const MEGA_DAMAGE_MULT = 1.02;
const DYNAMAX_HP_MULT = 1.5;
const TERA_DAMAGE_MULT = 1.1;

const TERA_EXCLUSIVE_NAMES = new Set([
  "Ogerpon",
  "Ogerpon-Wellspring",
  "Ogerpon-Hearthflame",
  "Ogerpon-Cornerstone",
  "Terapagos",
  "Terapagos-Terastal",
  "Terapagos-Stellar",
]);

export function isMegaName(name: string): boolean {
  return name.startsWith("M-");
}
export function isDynamaxName(name: string): boolean {
  return name.startsWith("Dynamax ");
}
export function isTeraName(name: string): boolean {
  return name.startsWith("Tera ") || TERA_EXCLUSIVE_NAMES.has(name);
}

/**
 * Combat stats for a Pokémon.
 * - playerPrestige: global player prestige (only the player can prestige)
 * - uniqueBonus: floor(uniqueCaught / 30) → flat +Atk/+Def
 * - anomalyEquipped: when the active mon is an anomaly, its form mults also apply to the player side
 */
export function combatStats(
  poke: OwnedPoke,
  opts: {
    playerPrestige?: number;
    uniqueBonus?: number;
    /** When true, treat this mon as the player's active fighter (apply global bonuses). */
    isPlayer?: boolean;
  } = {},
) {
  const spec = speciesByName(poke.name);
  if (!spec) {
    return {
      maxHp: 10,
      atk: 1,
      def: 1,
      spa: 1,
      spd: 1,
      spe: 1,
      avgAtk: 1,
      avgDef: 1,
      speedMs: 800,
      types: ["Normal"] as string[],
    };
  }

  const lvl = levelOf(poke);
  const prestige = opts.isPlayer ? (opts.playerPrestige ?? 0) : 0;
  const unique = opts.isPlayer ? (opts.uniqueBonus ?? 0) : 0;
  const pMult = playerPrestigeMult(prestige);

  const mega = isMegaName(poke.name);
  const formStatMult = mega ? MEGA_STAT_MULT : 1;

  // Anomaly form bonuses also apply to the player when an anomaly is equipped
  const anomalyActive = opts.isPlayer && isAnomalyName(poke.name);
  const effectiveFormMult = anomalyActive || mega ? formStatMult : 1;

  const atk =
    Math.floor(
      ((((spec.atk + 50) * lvl) / 150) * pMult * effectiveFormMult) + unique,
    );
  const def =
    Math.floor(
      ((((spec.def + 50) * lvl) / 150) * pMult * effectiveFormMult) + unique,
    );
  const spa = Math.floor((((spec.spa + 50) * lvl) / 150) * pMult * effectiveFormMult);
  const spd = Math.floor((((spec.spd + 50) * lvl) / 150) * pMult * effectiveFormMult);
  const spe = Math.floor((((spec.spe + 50) * lvl) / 150) * pMult);

  const speed = Math.floor((1000 / (500 + spe)) * 800);
  let maxHp = Math.floor(((spec.hp * lvl) / 40) * pMult * 3 * effectiveFormMult);
  maxHp = Math.max(3, maxHp);
  if (isDynamaxName(poke.name) && (opts.isPlayer || anomalyActive)) {
    maxHp = Math.floor(maxHp * DYNAMAX_HP_MULT);
  }

  return {
    maxHp,
    atk,
    def,
    spa,
    spd,
    spe,
    avgAtk: (atk + spa) / 2,
    avgDef: (def + spd) / 2,
    speedMs: speed <= 300 ? 300 : speed,
    types: spec.types,
  };
}

export function rollDamage(
  attackerAtk: number,
  defenderDef: number,
  multiplier: number,
  levelDmgBonus = 0,
): number {
  const power = attackerAtk * multiplier;
  const raw = power - defenderDef / 10;
  const base = raw <= 0 ? 0 : Math.ceil((raw * ((Math.random() + 0.1) * 2)) / 100);
  return base + levelDmgBonus;
}

export function levelDamageBonus(
  level: number,
  prestige: number,
  multiplier: number,
): number {
  return Math.floor((level / 10) * 1.5 * playerPrestigeMult(prestige) * multiplier);
}

/** Wild-route player HP pool. Independent of equipped mon; scales with level + prestige. */
export function playerMaxHp(level: number, prestige: number): number {
  const lvl = Math.max(1, Math.min(100, level));
  return Math.max(10, Math.floor(((50 * lvl) / 40) * playerPrestigeMult(prestige) * 3));
}

export function playerLevelOf(exp: number): number {
  const table = EXP_TABLE["Slow"];
  let lvl = 0;
  for (let i = 0; i < table.length; i++) {
    if (table[i] <= exp) lvl = i + 1;
    else break;
  }
  return Math.max(1, Math.min(100, lvl));
}

export function playerThisLevelExp(level: number): number {
  return EXP_TABLE["Slow"][level - 1] ?? 1;
}

export function playerNextLevelExp(level: number): number {
  return EXP_TABLE["Slow"][Math.min(100, level)] ?? EXP_TABLE["Slow"][EXP_TABLE["Slow"].length - 1];
}

export function attackDamage(
  attacker: OwnedPoke,
  defender: OwnedPoke,
  opts: {
    attackerIsPlayer?: boolean;
    playerPrestige?: number;
    uniqueBonus?: number;
  } = {},
): { damage: number; multiplier: number } {
  const a = combatStats(attacker, {
    isPlayer: opts.attackerIsPlayer,
    playerPrestige: opts.playerPrestige,
    uniqueBonus: opts.uniqueBonus,
  });
  const d = combatStats(defender, {
    isPlayer: !opts.attackerIsPlayer,
    playerPrestige: opts.attackerIsPlayer ? 0 : opts.playerPrestige,
    uniqueBonus: opts.attackerIsPlayer ? 0 : opts.uniqueBonus,
  });

  const attackerSpec = speciesByName(attacker.name);
  const teraType = isTeraName(attacker.name) ? attackerSpec?.teraType : undefined;
  const multiplier = typeMultiplier(a.types, d.types, teraType);

  const prestigeForBonus = opts.attackerIsPlayer ? (opts.playerPrestige ?? 0) : 0;
  const bonus = levelDamageBonus(levelOf(attacker), prestigeForBonus, multiplier);

  let damage = rollDamage(a.avgAtk, d.avgDef, multiplier, bonus);
  if (damage > 0) {
    if (isMegaName(attacker.name)) damage = Math.round(damage * MEGA_DAMAGE_MULT);
    if (isTeraName(attacker.name)) damage = Math.round(damage * TERA_DAMAGE_MULT);
  }
  return { damage, multiplier };
}

export function expReward(enemy: OwnedPoke): number {
  const spec = speciesByName(enemy.name);
  const base = spec?.exp ?? 50;
  const lvl = levelOf(enemy);
  return base / 15 + lvl * 28;
}

export const BENCH_EXP_SHARE = 0.6;
export const STORAGE_EXP_SHARE = 0.3;

export function eligibleEvolutions(poke: OwnedPoke) {
  const lvl = levelOf(poke);
  return (EVOLUTIONS[poke.name] ?? []).filter((e) => lvl >= e.level);
}

export function makeOwned(
  name: string,
  level: number,
  shiny = false,
  prestige = 0,
): OwnedPoke {
  const spec = speciesByName(name);
  const growth = (spec?.growth ?? "Medium Fast") as GrowthRate;
  const poke: OwnedPoke = {
    uid: newUid(),
    name,
    exp: expAtLevel(growth, level),
    shiny,
    prestige,
    hp: 1,
  };
  poke.hp = combatStats(poke).maxHp;
  return poke;
}

export function randomLevel(min: number, max: number): number {
  return min + Math.round(Math.random() * (max - min));
}

export function pickWeighted(names: string[], weights?: number[]): string {
  if (!weights || weights.length !== names.length) {
    return names[Math.floor(Math.random() * names.length)] ?? names[0];
  }
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = Math.random() * total;
  for (let i = 0; i < names.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return names[i];
  }
  return names[names.length - 1];
}
