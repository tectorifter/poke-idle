import { create } from "zustand";
import {
  currentStage,
  initialLeagueProgress,
  loseStage,
  simulateLeagueBattle,
  trainerOf,
  winStage,
  type LeagueStage,
} from "./league";
import type { LeagueProgress, OwnedPoke } from "./types";

const SAVE_KEY = "pokeidle-league-v1";

function loadProgress(): LeagueProgress {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return initialLeagueProgress();
    const parsed = JSON.parse(raw) as Partial<LeagueProgress>;
    return {
      stageIndex: typeof parsed.stageIndex === "number" ? parsed.stageIndex : 0,
      runsCompleted: typeof parsed.runsCompleted === "number" ? parsed.runsCompleted : 0,
    };
  } catch {
    return initialLeagueProgress();
  }
}

function persist(progress: LeagueProgress) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(progress));
  } catch {
    /* quota / private mode */
  }
}

export type LeagueBattleState = {
  progress: LeagueProgress;
  log: string[];
  lastResult: "none" | "win" | "lose";
  rehydrate: () => void;
  /** Runs the current stage's fight against the given team; returns the post-battle team
   *  (healed on a win) so the caller can write it back into the main game store. */
  challenge: (team: OwnedPoke[]) => OwnedPoke[];
};

export const useLeague = create<LeagueBattleState>((set, get) => ({
  progress: initialLeagueProgress(),
  log: [],
  lastResult: "none",

  rehydrate: () => {
    set({ progress: loadProgress() });
  },

  challenge: (team) => {
    const stage: LeagueStage | null = currentStage(get().progress);
    if (!stage) return team;
    const trainer = trainerOf(stage);
    const outcome = simulateLeagueBattle(team, trainer);

    if (outcome.playerWon) {
      const { progress, team: healed } = winStage(get().progress, outcome.team);
      persist(progress);
      set({ progress, log: outcome.log, lastResult: "win" });
      return healed;
    }

    const progress = loseStage(get().progress);
    persist(progress);
    set({ progress, log: outcome.log, lastResult: "lose" });
    return outcome.team;
  },
}));
