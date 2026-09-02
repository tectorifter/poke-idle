import { EXP_TABLE, EVOLUTIONS, speciesByName } from "./dex";
import { defenseMultiplier } from "./type-chart";
import { natureMult, rollNature } from "./natures";
import { CRIT_CHANCE, CRIT_MULT } from "./moves";
import type { MoveData } from "./moves";
import { chosenMove } from "./learnsets";
import type { CatchTier, GrowthRate, OwnedPoke, Species, StatKey, StatSpread } from "./types";

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
  "timerball",
];

/** Display name + flat price for ONE manual-throw charge of each ball type. */
export const BALL_META: Record<CatchTier, { label: string; price: number }> = {
  pokeball: { label: "Poké Ball", price: 200 },
  greatball: { label: "Great Ball", price: 600 },
  ultraball: { label: "Ultra Ball", price: 800 },
  timerball: { label: "Timer Ball", price: 1000 },
};

const TIER_LEVEL_OFFSET: Record<CatchTier, number> = {
  pokeball: 0, // Lv. 1  – 10  (totalLevel 1  to 10)
  greatball: 10, // Lv. 11 – 20
  ultraball: 20, // Lv. 21 – 30
  timerball: 30, // Lv. 31 – 40
};

const TIER_BASE_MULT: Record<CatchTier, number> = {
  pokeball: 0.5,
  greatball: 1.5,
  ultraball: 3,
  timerball: 5,
};

const MAX_CATCH_MULT = 10;
/** Final catch multiplier for a given tier + level (1–10). */
/** Dynamically spreads the tier difference across 10 levels */
export function catchMultiplier(tier: CatchTier, level: number): number {
  const lvl = Math.max(1, Math.min(10, level));
  const idx = CATCH_TIER_ORDER.indexOf(tier);
  const currentBase = TIER_BASE_MULT[tier];

  const isLastTier = idx === CATCH_TIER_ORDER.length - 1;
  const nextBase = isLastTier
    ? MAX_CATCH_MULT
    : TIER_BASE_MULT[CATCH_TIER_ORDER[idx + 1]];

  // Standard tiers divide by 10 so the tier upgrade grants the 10th step;
  // the last tier (Timer Ball) divides by 9 so Level 10 lands exactly on 20.0x.
  const step = isLastTier
    ? (nextBase - currentBase) / 9
    : (nextBase - currentBase) / 10;

  return Number((currentBase + (lvl - 1) * step).toFixed(1));
}

export function tierIndex(tier: CatchTier): number {
  return CATCH_TIER_ORDER.indexOf(tier);
}

/** Effective level a given ball throws at, given the player's current catch rank:
 *  a lower-tier ball is maxed (10) once you've ranked past it; the current tier
 *  uses your current level; a not-yet-unlocked tier returns 0. */
export function effectiveBallLevel(
  ball: CatchTier,
  curTier: CatchTier,
  curLevel: number,
): number {
  const b = tierIndex(ball);
  const c = tierIndex(curTier);
  if (b < c) return 10;
  if (b === c) return Math.max(1, Math.min(10, curLevel));
  return 0; // locked
}

/** Exponential cost of the next catch-power upgrade (permanent track). */
export function catchUpgradeCost(currentLevel: number, tier: CatchTier = "pokeball"): number {
  const totalLevel = TIER_LEVEL_OFFSET[tier] + Math.max(1, Math.min(10, currentLevel));
  return Math.floor(5000 * Math.pow(1.15, totalLevel - 1));
}

/** Price to buy `qty` throw charges of a ball type (flat per charge). */
export function ballChargeCost(ball: CatchTier, qty = 1): number {
  return BALL_META[ball].price * qty;
}

/** Chance % using permanent catch power (always available, no balls consumed). */
export function catchChancePercentPermanent(
  catchRate: number,
  tier: CatchTier,
  level: number,
): number {
  return (catchRate * catchMultiplier(tier, level)) / 3;
}

/** Manual (hand-thrown) catch chance: the chosen ball's rate, 50% better than
 *  the equivalent auto-catch. Returns 0 if the ball isn't unlocked yet. */
export function manualCatchChance(
  catchRate: number,
  ball: CatchTier,
  curTier: CatchTier,
  curLevel: number,
): number {
  const lvl = effectiveBallLevel(ball, curTier, curLevel);
  if (lvl === 0) return 0;
  return catchChancePercentPermanent(catchRate, ball, lvl) * 1.5;
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
export const HEAL_COOLDOWN_MS = 5_000;
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
const DYNAMAX_DAMAGE_MULT = 1.15;
const GMAX_DAMAGE_MULT = 1.25;
const TERA_DAMAGE_MULT = 1.1;

/** Temporary in-battle anomaly activation kinds (player side). */
export type FormKind = "mega" | "gmax" | "dynamax" | "tera";

/** Wild combat: activations last this many enemy defeats, then that anomaly type
 *  is locked party-wide for RECHARGE defeats. */
export const WILD_FORM_DEFEATS = 6;
export const WILD_RECHARGE_DEFEATS = 10;
/** League: Dynamax / Gigantamax real-time cap (Mega & Tera last until faint / fight end). */
export const LEAGUE_DYNAMAX_MS = 15_000;

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
export function isGmaxName(name: string): boolean {
  return name.startsWith("Gigantamax ");
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
    /** Active temporary anomaly form on this mon (player side). For mega/gmax the
     *  caller has already swapped `poke.name` to the form species. */
    form?: FormKind;
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

  const mega = isMegaName(poke.name) || opts.form === "mega";
  const formStatMult = mega ? MEGA_STAT_MULT : 1;

  // Anomaly form bonuses also apply to the player when an anomaly is equipped
  const anomalyActive = opts.isPlayer && isAnomalyName(poke.name);
  const effectiveFormMult = anomalyActive || mega ? formStatMult : 1;

  // Per-instance IV + EV contribution (real-formula term), one per stat.
  const ie = (k: StatKey, scale = 1) => ivEvBonus(poke, k, lvl) * scale;
  // Nature: +10% / −10% / neutral per stat (never HP).
  const nat = (k: StatKey) => natureMult(poke.nature, k);

  const atk = Math.floor(
    (Math.floor(((((spec.atk + 50) * lvl) / 150) * pMult * effectiveFormMult) + unique) + ie("atk")) *
      nat("atk"),
  );
  const def = Math.floor(
    (Math.floor(((((spec.def + 50) * lvl) / 150) * pMult * effectiveFormMult) + unique) + ie("def")) *
      nat("def"),
  );
  const spa = Math.floor(
    (Math.floor((((spec.spa + 50) * lvl) / 150) * pMult * effectiveFormMult) + ie("spa")) * nat("spa"),
  );
  const spd = Math.floor(
    (Math.floor((((spec.spd + 50) * lvl) / 150) * pMult * effectiveFormMult) + ie("spd")) * nat("spd"),
  );
  const spe = Math.floor(
    (Math.floor((((spec.spe + 50) * lvl) / 150) * pMult) + ie("spe")) * nat("spe"),
  );

  const speed = Math.floor((1000 / (500 + spe)) * 800);
  let maxHp = Math.floor(((spec.hp * lvl) / 40) * pMult * 3 * effectiveFormMult) + ie("hp", 3);
  maxHp = Math.max(3, maxHp);
  const dynamaxed =
    isDynamaxName(poke.name) || isGmaxName(poke.name) || opts.form === "dynamax" || opts.form === "gmax";
  if (dynamaxed && (opts.isPlayer || anomalyActive || opts.form === "dynamax" || opts.form === "gmax")) {
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

// ─── Attack cadence from Speed (wild combat) ─────────────────────────────────
const APS_MIN_SPEED = 4;
// Speed that would reach the 4 atk/s ceiling. Kept far above any realistic stat
// so the practical curve stays gentle (Spe 34 ≈ 1.9, 100 ≈ 2.4, 500 ≈ 3.1).
const APS_MAX_SPEED = 4000;

/** Attacks a mon is *allowed* per second from its resolved Speed stat: a
 *  guaranteed 1/s at Spe ≤ 4, approaching 4/s only at extreme speed. */
export function attacksPerSecond(speed: number): number {
  const s = Math.max(APS_MIN_SPEED, speed);
  const aps =
    1 + 3 * ((Math.log(s) - Math.log(APS_MIN_SPEED)) / (Math.log(APS_MAX_SPEED) - Math.log(APS_MIN_SPEED)));
  return Math.max(1, Math.min(4, aps));
}

/** Minimum ms between a mon's attack turns at the given resolved Speed. */
export function attackIntervalMs(speed: number): number {
  return 1000 / attacksPerSecond(speed);
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
    /** Active temporary anomaly form on the attacker (player side). */
    form?: FormKind;
    /** Terastal offense type — overrides the species' own `teraType`. */
    teraType?: string;
    /** The move being used. Defaults to a STAB attack for the mon's type. */
    move?: MoveData;
  } = {},
): { damage: number; multiplier: number; crit: boolean } {
  const move = opts.move ?? chosenMove(attacker, levelOf(attacker));

  // Status moves have no effect in this model (still listed elsewhere).
  if (move.category === "Status" || move.power <= 0) {
    return { damage: 0, multiplier: 1, crit: false };
  }

  const a = combatStats(attacker, {
    isPlayer: opts.attackerIsPlayer,
    playerPrestige: opts.playerPrestige,
    uniqueBonus: opts.uniqueBonus,
    form: opts.form,
  });
  const d = combatStats(defender, {
    isPlayer: !opts.attackerIsPlayer,
    playerPrestige: opts.attackerIsPlayer ? 0 : opts.playerPrestige,
    uniqueBonus: opts.attackerIsPlayer ? 0 : opts.uniqueBonus,
  });

  const attackerSpec = speciesByName(attacker.name);
  // Terastal collapses the attacker's offensive typing to its one tera type.
  const teraType =
    opts.form === "tera"
      ? opts.teraType ?? attacker.teraType
      : isTeraName(attacker.name)
        ? attackerSpec?.teraType
        : undefined;
  const moveType = teraType ?? move.type;

  const multiplier = defenseMultiplier(moveType, d.types); // move type vs defender
  if (multiplier === 0) return { damage: 0, multiplier: 0, crit: false };

  const physical = move.category === "Physical";
  const atkStat = physical ? a.atk : a.spa;
  const defStat = Math.max(1, physical ? d.def : d.spd);
  const lvl = levelOf(attacker);

  // Pokémon Showdown base-damage formula.
  let dmg =
    Math.floor(
      (Math.floor((Math.floor((2 * lvl) / 5) + 2) * move.power * atkStat) / defStat) / 50,
    ) + 2;

  const crit = Math.random() < CRIT_CHANCE;
  const spread = (85 + Math.floor(Math.random() * 16)) / 100; // 0.85–1.00
  const stab = a.types.includes(moveType) ? 1.5 : 1;

  dmg = dmg * (crit ? CRIT_MULT : 1) * spread * stab * multiplier;

  // Temporary anomaly-form damage multipliers.
  if (isMegaName(attacker.name) || opts.form === "mega") dmg *= MEGA_DAMAGE_MULT;
  if (opts.form === "gmax") dmg *= GMAX_DAMAGE_MULT;
  else if (opts.form === "dynamax") dmg *= DYNAMAX_DAMAGE_MULT;
  if (isTeraName(attacker.name) || opts.form === "tera") dmg *= TERA_DAMAGE_MULT;

  return { damage: Math.max(1, Math.floor(dmg)), multiplier, crit };
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

/** Roll the fixed Terastal type for a freshly created / migrated mon: a random
 *  pick among its own types, or its sole type when single-typed (no roll). */
export function rollTeraType(name: string): string | undefined {
  const spec = speciesByName(name);
  if (!spec || spec.types.length === 0) return undefined;
  if (spec.types.length === 1) return spec.types[0];
  return spec.types[Math.floor(Math.random() * spec.types.length)];
}

// ─── IVs / EVs (Phase 2) ─────────────────────────────────────────────────────
export const STAT_KEYS: StatKey[] = ["hp", "atk", "def", "spa", "spd", "spe"];
export const IV_MAX = 31;
export const EV_MAX_PER_STAT = 252;
export const EV_MAX_TOTAL = 510;

export function rollIVs(): StatSpread {
  const r = () => Math.floor(Math.random() * (IV_MAX + 1));
  return { hp: r(), atk: r(), def: r(), spa: r(), spd: r(), spe: r() };
}

export function zeroEVs(): StatSpread {
  return { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
}

export function evTotal(evs: StatSpread | undefined): number {
  return evs ? STAT_KEYS.reduce((n, k) => n + (evs[k] || 0), 0) : 0;
}

/** EV yield for defeating a species — its single highest base stat, 1–3 points
 *  by how high that base is. (Real games use per-species tables; this stands in
 *  for one until that data is imported.) */
export function evYield(spec: Species | undefined): Partial<StatSpread> {
  if (!spec) return {};
  const bases: [StatKey, number][] = [
    ["hp", spec.hp], ["atk", spec.atk], ["def", spec.def],
    ["spa", spec.spa], ["spd", spec.spd], ["spe", spec.spe],
  ];
  bases.sort((a, b) => b[1] - a[1]);
  const [key, val] = bases[0];
  return { [key]: val >= 120 ? 3 : val >= 90 ? 2 : 1 };
}

/** Add an EV yield to a spread, honouring the 252-per-stat and 510-total caps. */
export function addEVs(evs: StatSpread | undefined, gain: Partial<StatSpread>): StatSpread {
  const next = evs ? { ...evs } : zeroEVs();
  let total = evTotal(next);
  for (const k of STAT_KEYS) {
    const g = gain[k] ?? 0;
    if (g <= 0 || total >= EV_MAX_TOTAL) continue;
    const room = Math.min(EV_MAX_PER_STAT - next[k], EV_MAX_TOTAL - total, g);
    if (room > 0) {
      next[k] += room;
      total += room;
    }
  }
  return next;
}

/** The real-formula IV + EV contribution to one stat at a given level. */
function ivEvBonus(poke: OwnedPoke, key: StatKey, lvl: number): number {
  const iv = poke.ivs?.[key] ?? 0;
  const ev = poke.evs?.[key] ?? 0;
  return Math.floor(((iv + Math.floor(ev / 4)) * lvl) / 100);
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
    teraType: rollTeraType(name),
    ivs: rollIVs(),
    evs: zeroEVs(),
    nature: rollNature(),
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
