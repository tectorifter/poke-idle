import { EXP_TABLE, EVOLUTIONS, speciesByName } from "./dex";
import { typeMultiplier } from "./type-chart";
import type { BallKind, GrowthRate, OwnedPoke, Species } from "./types";

export const BALL_RNG: Record<BallKind, number> = {
  pokeball: 1,
  greatball: 1.5,
  ultraball: 2,
};

export const HEAL_COOLDOWN_MS = 30_000;
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

export function statValue(raw: number, level: number, prestige: number): number {
  return Math.floor((((raw + 50) * level) / 150) * prestigeMult(prestige));
}

export function maxHpOf(spec: Species, level: number, prestige: number): number {
  return Math.max(3, Math.floor(((spec.hp * level) / 40) * prestigeMult(prestige)) * 3);
}

export function combatStats(poke: OwnedPoke) {
  const spec = speciesByName(poke.name);
  if (!spec) {
    return { maxHp: 10, atk: 1, def: 1, spa: 1, spd: 1, spe: 1, avgAtk: 1, avgDef: 1, speedMs: 800, types: ["Normal"] as string[] };
  }
  const lvl = levelOf(poke);
  const atk = statValue(spec.atk, lvl, poke.prestige);
  const def = statValue(spec.def, lvl, poke.prestige);
  const spa = statValue(spec.spa, lvl, poke.prestige);
  const spd = statValue(spec.spd, lvl, poke.prestige);
  const spe = statValue(spec.spe, lvl, poke.prestige);
  const speed = Math.floor((1000 / (500 + spe)) * 800);
  return {
    maxHp: maxHpOf(spec, lvl, poke.prestige),
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

export function rollDamage(attackerAtk: number, defenderDef: number, multiplier: number): number {
  const power = attackerAtk * multiplier;
  const raw = power - defenderDef / 10;
  if (raw <= 0) return 0;
  return Math.ceil(raw * ((Math.random() + 0.1) * 2) / 100);
}

export function attackDamage(attacker: OwnedPoke, defender: OwnedPoke): { damage: number; multiplier: number } {
  const a = combatStats(attacker);
  const d = combatStats(defender);
  const multiplier = typeMultiplier(a.types, d.types);
  return { damage: rollDamage(a.avgAtk, d.avgDef, multiplier), multiplier };
}

export function catchChancePercent(catchRate: number, ball: BallKind): number {
  return (catchRate * BALL_RNG[ball]) / 3;
}

export function expReward(enemy: OwnedPoke, active: boolean): number {
  const spec = speciesByName(enemy.name);
  const base = spec?.exp ?? 50;
  const lvl = levelOf(enemy);
  if (active) return base / 16 + lvl * 3;
  return base / 50 + lvl / 5;
}

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
