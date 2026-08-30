// League logic: gyms / Elite Four / Champions.
// This module is intentionally separate from:
//   - league data          -> @/data/league.json (pure content, no logic)
//   - the wild-encounter loop in store.ts (untouched — trainer battles are a
//     distinct flow: no catching, a fixed enemy team fought in sequence)
//
// It reuses the existing combat math from formulas.ts rather than introducing
// a second damage model, so trainer fights feel consistent with wild ones.
// Wiring this into a UI screen (a "League" tab, gym unlock gating, victory
// screens) is a separate follow-up — this file only provides the building
// blocks: which stage is next, whether the player's team can enter it, how to
// resolve one trainer fight, and the ball-reward bonus.

import { LEAGUE, ROUTES, speciesByName } from "./dex";
import { combatStats, makeOwned } from "./formulas";
import type { BallKind, EliteFourDef, GymDef, LeagueProgress, OwnedPoke, TrainerDef } from "./types";

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
  return stage.kind === "gym" ? stage.gym.leader : stage.kind === "elite-four" ? stage.member : stage.trainer;
}

/** Full anomaly-tier species pool (Dynamax/Mega/Ultra Beast/Tera routes combined) —
 *  the same pool the Anomalies region spawns from, reused here as the substitution
 *  pool once the league starts infusing anomaly Pokemon into its rosters. */
function anomalyPool(): string[] {
  const anomalies = ROUTES["Anomalies"];
  if (!anomalies) return [];
  return Object.values(anomalies).flatMap((r) => r.pokes);
}

/** Fraction of each trainer's team that gets swapped for anomaly-tier Pokemon:
 *  0 before the 3rd full league clear, ramping linearly, 100% by the 6th clear. */
export function anomalyInfusionFraction(runsCompleted: number): number {
  if (runsCompleted < 3) return 0;
  if (runsCompleted >= 6) return 1;
  return (runsCompleted - 3) / 3;
}

/** Builds live OwnedPoke instances for a trainer's team, ready to battle against.
 *  `prestige` scales the trainer's own mons (see leagueEnemyPrestige) — this is how
 *  the league keeps pace with the player across repeat clears, independent of the
 *  player's own reward on winning (see LEAGUE_PRESTIGE_REWARD). `anomalyFraction`
 *  independently swaps in anomaly-tier species per slot (level kept the same, only
 *  the species identity changes) once the league starts infusing them (see
 *  anomalyInfusionFraction). */
export function buildTrainerTeam(trainer: TrainerDef, prestige = 0, anomalyFraction = 0): OwnedPoke[] {
  const pool = anomalyFraction > 0 ? anomalyPool() : [];
  return trainer.team
    .filter((p) => speciesByName(p.name))
    .map((p) => {
      const name = pool.length > 0 && Math.random() < anomalyFraction ? pool[Math.floor(Math.random() * pool.length)] : p.name;
      return makeOwned(name, p.level, false, prestige);
    });
}

export type BattleTurnResult = {
  playerDamage: number;
  enemyDamage: number;
  enemyFainted: boolean;
  playerFainted: boolean;
};

/** League fights are real-time paced like wild routes, just faster — a quarter
 *  of the normal per-attacker interval, so trainer battles feel snappier than
 *  grinding a route without going instant. */
export function leagueSpeedMs(normalSpeedMs: number): number {
  return Math.max(1, normalSpeedMs / 4);
}

/** Ball rewards after clearing a league trainer: +ballBonusPercent vs a normal wild-route reward. */
export function leagueBallReward(baseAmount: number, ball: BallKind): number {
  void ball;
  return Math.round(baseAmount * (1 + LEAGUE.ballBonusPercent / 100));
}

export function isLeagueUnlockedFor(highestOwnedLevel: number): boolean {
  return highestOwnedLevel >= LEAGUE.minLevel;
}

// --- Progression ---------------------------------------------------------
// Rule: beat a stage -> team heals, advance one stage.
//       lose a stage -> run resets to the very first gym.
//       beat every champion -> run resets to the first gym too (loop, +1 to
//       runsCompleted), so repeat clears are the idle-game "New Game+" grind.
// This state is deliberately separate from SaveBlob's wild-encounter fields;
// merge it into the save wherever you persist runsCompleted/stageIndex.

const STAGE_COUNT = leagueOrder().length;

export function initialLeagueProgress(): LeagueProgress {
  return { stageIndex: 0, runsCompleted: 0 };
}

export function currentStage(progress: LeagueProgress): LeagueStage | null {
  const order = leagueOrder();
  return order[progress.stageIndex] ?? null;
}

export function healTeam(team: OwnedPoke[]): OwnedPoke[] {
  return team.map((p) => ({ ...p, hp: combatStats(p).maxHp }));
}

export const LEAGUE_PRESTIGE_REWARD = 1;

/** How much prestige the league's own trainer mons carry, scaled by full clears.
 *  This value advances only when the entire league is beaten (final Champion).
 *  The Anomalies route reads the same value, but retains its existing delayed
 *  per-route unlock before applying it to anomaly encounters. */
export const LEAGUE_ENEMY_PRESTIGE_PER_RUN = 8;

export function leagueEnemyPrestige(progress: LeagueProgress): number {
  return progress.runsCompleted * LEAGUE_ENEMY_PRESTIGE_PER_RUN;
}

/** Call after the player's team clears the current stage's trainer.
 *  Normal leader / Elite Four / Champion wins do NOT award player prestige.
 *  The +1 player prestige is reserved for the final Champion, i.e. the moment
 *  the whole league has been beaten. The +8 enemy prestige tier is advanced at
 *  that same moment via runsCompleted. */
export function winStage(progress: LeagueProgress, team: OwnedPoke[]): { progress: LeagueProgress; team: OwnedPoke[] } {
  const wasLastStage = progress.stageIndex >= STAGE_COUNT - 1;

  if (wasLastStage) {
    const boosted = team.map((p) => ({ ...p, prestige: p.prestige + LEAGUE_PRESTIGE_REWARD }));
    const healed = healTeam(boosted);

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

/** Call when the player's whole team faints against the current stage's trainer. */
export function loseStage(progress: LeagueProgress): LeagueProgress {
  return { stageIndex: 0, runsCompleted: progress.runsCompleted };
}

export function isRunComplete(progress: LeagueProgress): boolean {
  return progress.stageIndex >= STAGE_COUNT;
}
