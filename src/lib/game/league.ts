// League logic: gyms / Elite Four / Champions.
// This module is intentionally separate from:
//   - league data          -> @/data/league.json (pure content, no logic)
//   - the wild-encounter loop in store.ts (untouched — trainer battles are a
//     distinct flow: no catching, a fixed enemy team fought in sequence)
//
// It reuses the existing combat math from formulas.ts rather than introducing
// a second damage model, so trainer fights feel consistent with wild ones.

import { LEAGUE, ROUTES, speciesByName } from "./dex";
import { combatStats, evenEVs, makeOwned, maxIVs, NEUTRAL_NATURE } from "./formulas";
import { computeSynergy } from "./synergy";
import type { EliteFourDef, GymDef, LeagueProgress, OwnedPoke, TrainerDef } from "./types";

export type LeagueStage =
  | { kind: "gym"; gym: GymDef }
  | { kind: "elite-four"; group: EliteFourDef; member: TrainerDef; memberIndex: number }
  | { kind: "champion"; trainer: TrainerDef; index: number };

/** Flattens gyms -> elite four members -> champions into one ordered progression. */
export function leagueOrder(): LeagueStage[] {
  const stages: LeagueStage[] = [];
  for (const gym of LEAGUE.gyms) stages.push({ kind: "gym", gym });
  LEAGUE.eliteFours.forEach((group) => {
    group.members.forEach((member, memberIndex) => {
      stages.push({ kind: "elite-four", group, member, memberIndex });
    });
  });
  LEAGUE.champions.forEach((trainer, index) => {
    stages.push({ kind: "champion", trainer, index });
  });
  return stages;
}

export function stageId(stage: LeagueStage): string {
  if (stage.kind === "gym") return stage.gym.id;
  if (stage.kind === "elite-four") return stage.member.id;
  return stage.trainer.id;
}

export function trainerOf(stage: LeagueStage): TrainerDef {
  return stage.kind === "gym"
    ? stage.gym.leader
    : stage.kind === "elite-four"
      ? stage.member
      : stage.trainer;
}

/** Full anomaly-tier species pool. */
function anomalyPool(): string[] {
  const anomalies = ROUTES["Anomalies"];
  if (!anomalies) return [];
  return Object.values(anomalies).flatMap((r) => r.pokes);
}

/** Fraction of each trainer's team that gets swapped for anomaly-tier Pokemon. */
export function anomalyInfusionFraction(runsCompleted: number): number {
  if (runsCompleted < 3) return 0;
  if (runsCompleted >= 6) return 1;
  return (runsCompleted - 3) / 3;
}

/** Builds live OwnedPoke instances for a trainer's team. League opponents are
 *  fully trained by default — 31 IVs, EVs spread evenly (85 each), neutral
 *  nature — unless the trainer def pins its own `ivs` / `evs` / `nature`. */
export function buildTrainerTeam(
  trainer: TrainerDef,
  prestige = 0,
  anomalyFraction = 0,
): OwnedPoke[] {
  const pool = anomalyFraction > 0 ? anomalyPool() : [];
  return trainer.team
    .filter((p) => speciesByName(p.name))
    .map((p) => {
      const name =
        pool.length > 0 && Math.random() < anomalyFraction
          ? pool[Math.floor(Math.random() * pool.length)]
          : p.name;
      return makeOwned(name, p.level, false, prestige, {
        ivs: p.ivs ?? maxIVs(),
        evs: p.evs ?? evenEVs(),
        nature: p.nature ?? NEUTRAL_NATURE,
      });
    });
}

export type BattleTurnResult = {
  playerDamage: number;
  enemyDamage: number;
  enemyFainted: boolean;
  playerFainted: boolean;
};

/** League fights are real-time paced like wild routes, just faster. */
export function leagueSpeedMs(normalSpeedMs: number): number {
  return Math.max(1, normalSpeedMs / 4);
}

/**
 * Legacy ball-reward helper — balls are no longer consumable.
 * Kept as a no-op multiplier so any remaining callers compile.
 * Prefer awarding pokeyen directly instead.
 */
export function leagueBallReward(baseAmount: number): number {
  return Math.round(baseAmount * (1 + LEAGUE.ballBonusPercent / 100));
}

export function isLeagueUnlockedFor(highestOwnedLevel: number): boolean {
  return highestOwnedLevel >= LEAGUE.minLevel;
}

const STAGE_COUNT = leagueOrder().length;

export function initialLeagueProgress(): LeagueProgress {
  return { stageIndex: 0, runsCompleted: 0 };
}

export function currentStage(progress: LeagueProgress): LeagueStage | null {
  const order = leagueOrder();
  return order[progress.stageIndex] ?? null;
}

export function healTeam(team: OwnedPoke[]): OwnedPoke[] {
  const synergy = computeSynergy(team);
  return team.map((p) => ({ ...p, hp: combatStats(p, { synergy }).maxHp }));
}

export const LEAGUE_PRESTIGE_REWARD = 1;

export const LEAGUE_ENEMY_PRESTIGE_PER_RUN = 8;

export function leagueEnemyPrestige(progress: LeagueProgress): number {
  return progress.runsCompleted * LEAGUE_ENEMY_PRESTIGE_PER_RUN;
}

/**
 * Call after the player's team clears the current stage's trainer.
 * Normal wins do NOT award player prestige.
 * The +1 player prestige is reserved for the final Champion
 * (handled by the UI / store via prestigePlayer when appropriate).
 * Enemy prestige tier advances via runsCompleted on full clear.
 */
export function winStage(
  progress: LeagueProgress,
  team: OwnedPoke[],
): { progress: LeagueProgress; team: OwnedPoke[] } {
  const wasLastStage = progress.stageIndex >= STAGE_COUNT - 1;

  if (wasLastStage) {
    // No longer bumps per-mon prestige — player prestige is global via Store.
    const healed = healTeam(team);
    return {
      progress: {
        stageIndex: 0,
        runsCompleted: progress.runsCompleted + 1,
      },
      team: healed,
    };
  }

  return {
    progress: { ...progress, stageIndex: progress.stageIndex + 1 },
    team: healTeam(team),
  };
}

export function loseStage(progress: LeagueProgress): LeagueProgress {
  return { stageIndex: 0, runsCompleted: progress.runsCompleted };
}

export function isRunComplete(progress: LeagueProgress): boolean {
  return progress.stageIndex >= STAGE_COUNT;
}
