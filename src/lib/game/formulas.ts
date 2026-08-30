import { EXP_TABLE, EVOLUTIONS, speciesByName } from "./dex";
import { typeMultiplier } from "./type-chart";
import type { BallKind, GrowthRate, OwnedPoke, Species } from "./types";

export const BALL_RNG: Record<BallKind, number> = {
  pokeball: 1,
  greatball: 1.5,
  ultraball: 2,
};

export const HEAL_COOLDOWN_MS = 15_000;
/** Flat per-turn pacing for wild-route combat — independent of any Pokemon's
 *  speed stat (that stat still matters for combatStats().speedMs, which the
 *  league's own pacing derives from — this constant only governs routes). */
export const ROUTE_TURN_MS = 1_000;
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

function prestigeMult(prestige: number): number {
  return 1 + prestige / 100;
}

// Permanent flavor bonuses for anomaly-caught Pokemon — derived from the name itself
// (which never changes once caught), so no extra save data is needed for these to
// persist forever on a caught mon, whether it's actively battling or just owned.
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

export function statValue(raw: number, level: number, prestige: number): number {
  return Math.floor((((raw + 50) * level) / 150) * prestigeMult(prestige));
}

export function maxHpOf(spec: Species, level: number, prestige: number): number {
  const base = Math.max(3, Math.floor(((spec.hp * level) / 40) * prestigeMult(prestige)) * 3);
  return base;
}

export function combatStats(poke: OwnedPoke) {
  const spec = speciesByName(poke.name);
  if (!spec) {
    return { maxHp: 10, atk: 1, def: 1, spa: 1, spd: 1, spe: 1, avgAtk: 1, avgDef: 1, speedMs: 800, types: ["Normal"] as string[] };
  }
  const lvl = levelOf(poke);
  const mega = isMegaName(poke.name);
  const statMult = mega ? MEGA_STAT_MULT : 1;
  const atk = Math.floor(statValue(spec.atk, lvl, poke.prestige) * statMult);
  const def = Math.floor(statValue(spec.def, lvl, poke.prestige) * statMult);
  const spa = Math.floor(statValue(spec.spa, lvl, poke.prestige) * statMult);
  const spd = Math.floor(statValue(spec.spd, lvl, poke.prestige) * statMult);
  const spe = Math.floor(statValue(spec.spe, lvl, poke.prestige) * statMult);
  const speed = Math.floor((1000 / (500 + spe)) * 800);
  let maxHp = Math.floor(maxHpOf(spec, lvl, poke.prestige) * statMult);
  if (isDynamaxName(poke.name)) maxHp = Math.floor(maxHp * DYNAMAX_HP_MULT);
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

export function rollDamage(attackerAtk: number, defenderDef: number, multiplier: number, levelDmgBonus = 0): number {
  const power = attackerAtk * multiplier;
  const raw = power - defenderDef / 10;
  const base = raw <= 0 ? 0 : Math.ceil(raw * ((Math.random() + 0.1) * 2) / 100);
  return base + levelDmgBonus;
}

/** Extra flat damage from the attacker's level, scaled by their prestige and by
 *  how effective the hit is — so a super-effective, highly-prestiged, high-level
 *  hit visibly outpaces a neutral low-level one instead of both rounding to 1. */
export function levelDamageBonus(level: number, prestige: number, multiplier: number): number {
  return Math.floor((level / 10) * 1.5 * prestigeMult(prestige) * multiplier);
}

export function attackDamage(attacker: OwnedPoke, defender: OwnedPoke): { damage: number; multiplier: number } {
  const a = combatStats(attacker);
  const d = combatStats(defender);
  const attackerSpec = speciesByName(attacker.name);
  const teraType = isTeraName(attacker.name) ? attackerSpec?.teraType : undefined;
  const multiplier = typeMultiplier(a.types, d.types, teraType);
  const bonus = levelDamageBonus(levelOf(attacker), attacker.prestige, multiplier);
  let damage = rollDamage(a.avgAtk, d.avgDef, multiplier, bonus);
  if (damage > 0) {
    if (isMegaName(attacker.name)) damage = Math.round(damage * MEGA_DAMAGE_MULT);
    if (isTeraName(attacker.name)) damage = Math.round(damage * TERA_DAMAGE_MULT);
  }
  return { damage, multiplier };
}

export function catchChancePercent(catchRate: number, ball: BallKind): number {
  return (catchRate * BALL_RNG[ball]) / 3;
}

/** Full exp reward for a kill. The active Pokemon gets all of this;
 *  benched teammates get BENCH_EXP_SHARE of it;
 *  PC storage gets STORAGE_EXP_SHARE of it (see store.ts). */
export function expReward(enemy: OwnedPoke): number {
  const spec = speciesByName(enemy.name);
  const base = spec?.exp ?? 50;
  const lvl = levelOf(enemy);
  return base / 16 + lvl * 7;
}

export const BENCH_EXP_SHARE = 0.6;
export const STORAGE_EXP_SHARE = 0.3;

export function eligibleEvolutions(poke: OwnedPoke) {
  const lvl = levelOf(poke);
  return (EVOLUTIONS[poke.name] ?? []).filter((e) => lvl >= e.level);
}

export function makeOwned(name: string, level: number, shiny = false, prestige = 0): OwnedPoke {
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
