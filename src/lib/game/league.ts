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

import { LEAGUE, speciesByName } from "./dex";
import { attackDamage, combatStats, makeOwned } from "./formulas";
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

/** Builds live OwnedPoke instances for a trainer's team, ready to battle against. */
export function buildTrainerTeam(trainer: TrainerDef): OwnedPoke[] {
  return trainer.team
    .filter((p) => speciesByName(p.name))
    .map((p) => makeOwned(p.name, p.level));
}

export type BattleTurnResult = {
  playerDamage: number;
  enemyDamage: number;
  enemyFainted: boolean;
  playerFainted: boolean;
};

/** One exchange of attacks between the player's active Pokemon and the current enemy. */
export function resolveTurn(player: OwnedPoke, enemy: OwnedPoke): BattleTurnResult {
  const toEnemy = attackDamage(player, enemy);
  enemy.hp = Math.max(0, enemy.hp - toEnemy.damage);
  const enemyFainted = enemy.hp <= 0;
  let toPlayer = { damage: 0, multiplier: 1 };
  if (!enemyFainted) {
    toPlayer = attackDamage(enemy, player);
    player.hp = Math.max(0, player.hp - toPlayer.damage);
  }
  return {
    playerDamage: toEnemy.damage,
    enemyDamage: toPlayer.damage,
    enemyFainted,
    playerFainted: player.hp <= 0,
  };
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

/** Call after the player's team clears the current stage's trainer. */
export function winStage(progress: LeagueProgress, team: OwnedPoke[]): { progress: LeagueProgress; team: OwnedPoke[] } {
  const healed = healTeam(team);
  const wasLastStage = progress.stageIndex >= STAGE_COUNT - 1;
  if (wasLastStage) {
    // Beat the final champion: loop back to gym 1, tally the clear.
    return { progress: { stageIndex: 0, runsCompleted: progress.runsCompleted + 1 }, team: healed };
  }
  return { progress: { ...progress, stageIndex: progress.stageIndex + 1 }, team: healed };
}

/** Call when the player's whole team faints against the current stage's trainer. */
export function loseStage(progress: LeagueProgress): LeagueProgress {
  return { stageIndex: 0, runsCompleted: progress.runsCompleted };
}

export function isRunComplete(progress: LeagueProgress): boolean {
  return progress.stageIndex >= STAGE_COUNT;
}
