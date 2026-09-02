import { create } from "zustand";
import { combatStats, attackDamage, HEAL_COOLDOWN_MS, LEAGUE_DYNAMAX_MS } from "./formulas";
import type { FormKind } from "./formulas";
import {
  megaFormsFor,
  gmaxFormFor,
  dynamaxUnlocked,
  teraUnlocked,
} from "./dex";
import type { AnomalyKind } from "./dex";
import {
  anomalyInfusionFraction,
  buildTrainerTeam,
  currentStage,
  initialLeagueProgress,
  leagueEnemyPrestige,
  leagueOrder,
  leagueSpeedMs,
  loseStage,
  trainerOf,
  winStage,
} from "./league";
import { useGame } from "./store";
import type { LeagueProgress, OwnedPoke, TrainerDef } from "./types";

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

// --- League-exclusive abilities -------------------------------------------
// These only exist inside a league battle -- route combat's Heal button is
// untouched (instant full heal there; here it's a heal-over-time instead).
export const LEAGUE_BUFF_DURATION_MS = 10_000;
export const LEAGUE_BUFF_COOLDOWN_MS = 40_000;
export const LEAGUE_CHEER_MULT = 1.25;
/** "Resist" reduces damage taken by 10% -- the player takes 90% of whatever
 *  damage remains after every other modifier (type, level bonus, mega/tera, etc). */
export const LEAGUE_RESIST_TAKEN_MULT = 0.9;
export const LEAGUE_HEAL_TICK_MS = 1_000;
export const LEAGUE_HEAL_TICKS = 6; // 4 * 3s = 12s total
export const LEAGUE_HEAL_TICK_PERCENT = 0.02;

type LeagueBuffs = {
  cheerUntil: number;
  cheerCooldownUntil: number;
  resistUntil: number;
  resistCooldownUntil: number;
  healCooldownUntil: number;
  healTicksLeft: number;
  nextHealTickAt: number;
};

function freshBuffs(): LeagueBuffs {
  return {
    cheerUntil: 0,
    cheerCooldownUntil: 0,
    resistUntil: 0,
    resistCooldownUntil: 0,
    healCooldownUntil: 0,
    healTicksLeft: 0,
    nextHealTickAt: 0,
  };
}

/** One heal-over-time application across the whole team: fainted members
 *  revive to full HP outright, living ones recover 2% of their own current
 *  missing HP. Shared by the immediate on-press application and the
 *  subsequent tick-driven ones so both behave identically. */
function applyHealTick(team: OwnedPoke[]): { team: OwnedPoke[]; revived: number; healedAny: boolean } {
  let revived = 0;
  let healedAny = false;

  const next = team.map((p) => {
    const stats = combatStats(p);

    if (p.hp <= 0) {
      revived += 1;
      const reviveHp = Math.max(1, Math.floor(stats.maxHp * LEAGUE_HEAL_TICK_PERCENT)); // ensure at least 1 HP
      if (reviveHp > 0) healedAny = true;
      return { ...p, hp: reviveHp };
    }

    const missing = stats.maxHp - p.hp;
    const restore = Math.floor(missing * LEAGUE_HEAL_TICK_PERCENT);

    if (restore > 0) healedAny = true;

    return restore > 0
      ? { ...p, hp: Math.min(stats.maxHp, p.hp + restore) }
      : p;
  });

  return { team: next, revived, healedAny };
}

function healLogLine(revived: number, healedAny: boolean): string | null {
  if (revived > 0) return `${revived} Pokemon revived!`;
  if (healedAny) return "Your team recovers some HP.";
  return null;
}

/** League anomaly activations — one of each per trainer fight, no recharge.
 *  Mega/Tera persist until the mon faints or the fight ends; Dynamax/Gmax has a
 *  real-time cap (`until`). */
export type LeagueForms = {
  mega: { uid: string; formName: string } | null;
  dynamax: { uid: string; formName: string | null; until: number } | null;
  tera: { uid: string } | null;
};
const freshLeagueForms = (): LeagueForms => ({ mega: null, dynamax: null, tera: null });
const freshFormsUsed = () => ({ mega: false, dynamax: false, tera: false });

/** Effective attacker for a league mon: swap to the Mega / G-Max species and
 *  report the form kind + tera type for the damage formula. */
function leagueEffective(
  mon: OwnedPoke,
  lf: LeagueForms,
  now: number,
): { poke: OwnedPoke; form?: FormKind; teraType?: string } {
  if (lf.mega && lf.mega.uid === mon.uid)
    return { poke: { ...mon, name: lf.mega.formName }, form: "mega" };
  if (lf.dynamax && lf.dynamax.uid === mon.uid && now < lf.dynamax.until)
    return lf.dynamax.formName
      ? { poke: { ...mon, name: lf.dynamax.formName }, form: "gmax" }
      : { poke: mon, form: "dynamax" };
  if (lf.tera && lf.tera.uid === mon.uid)
    return { poke: mon, form: "tera", teraType: mon.teraType };
  return { poke: mon };
}

export type LeagueBattleSession = {
  trainer: TrainerDef;
  enemyTeam: OwnedPoke[];
  enemyIndex: number;
  /** Per-slot faint flags for the trainer's team, for the grayed-out silhouette display. */
  enemyFainted: boolean[];
  playerTimer: number;
  enemyTimer: number;
  buffs: LeagueBuffs;
  leagueForms: LeagueForms;
  formsUsed: { mega: boolean; dynamax: boolean; tera: boolean };
  log: string[];
  result: "fighting" | "win" | "lose";
};

export type LeagueBattleState = {
  progress: LeagueProgress;
  battle: LeagueBattleSession | null;
  rehydrate: () => void;
  startChallenge: () => void;
  tick: (dt: number) => void;
  cheerUp: () => void;
  resist: () => void;
  healOverTime: () => void;
  activateLeague: (kind: AnomalyKind, formChoice?: string) => void;
  clearBattle: () => void;
};

export const useLeague = create<LeagueBattleState>((set, get) => ({
  progress: initialLeagueProgress(),
  battle: null,

  rehydrate: () => {
    set({ progress: loadProgress() });
  },

  startChallenge: () => {
    const stage = currentStage(get().progress);
    if (!stage) return;
    const trainer = trainerOf(stage);
    const enemyTeam = buildTrainerTeam(
      trainer,
      leagueEnemyPrestige(get().progress),
      anomalyInfusionFraction(get().progress.runsCompleted),
    );
    set({
      battle: {
        trainer,
        enemyTeam,
        enemyIndex: 0,
        enemyFainted: enemyTeam.map(() => false),
        playerTimer: 0,
        enemyTimer: 0,
        buffs: freshBuffs(),
        leagueForms: freshLeagueForms(),
        formsUsed: freshFormsUsed(),
        log: [`${trainer.name} wants to battle!`],
        result: "fighting",
      },
    });
    // Freeze the wild-route loop for the duration -- both loops would otherwise
    // fight over the same team/HP state at once.
    useGame.setState({ paused: true });
  },

  clearBattle: () => {
    set({ battle: null });
    useGame.setState({ paused: false });
  },

  cheerUp: () => {
    const b = get().battle;
    if (!b || b.result !== "fighting") return;
    const now = Date.now();
    if (now < b.buffs.cheerCooldownUntil) return;
    set({
      battle: {
        ...b,
        buffs: { ...b.buffs, cheerUntil: now + LEAGUE_BUFF_DURATION_MS, cheerCooldownUntil: now + LEAGUE_BUFF_COOLDOWN_MS },
        log: [...b.log, "Cheer up! Damage boosted!"],
      },
    });
  },

  resist: () => {
    const b = get().battle;
    if (!b || b.result !== "fighting") return;
    const now = Date.now();
    if (now < b.buffs.resistCooldownUntil) return;
    set({
      battle: {
        ...b,
        buffs: { ...b.buffs, resistUntil: now + LEAGUE_BUFF_DURATION_MS, resistCooldownUntil: now + LEAGUE_BUFF_COOLDOWN_MS },
        log: [...b.log, "Resist! Damage taken reduced!"],
      },
    });
  },

  healOverTime: () => {
    const b = get().battle;
    if (!b || b.result !== "fighting") return;
    const now = Date.now();
    if (now < b.buffs.healCooldownUntil) return;

    // First application fires immediately on press; the remaining ticks
    // follow the normal 3s cadence from here.
    const gs = useGame.getState();
    const { team, revived, healedAny } = applyHealTick(gs.team);
    useGame.setState({ team });
    const line = healLogLine(revived, healedAny);

    set({
      battle: {
        ...b,
        buffs: {
          ...b.buffs,
          healCooldownUntil: now + HEAL_COOLDOWN_MS,
          healTicksLeft: LEAGUE_HEAL_TICKS - 1,
          nextHealTickAt: now + LEAGUE_HEAL_TICK_MS,
        },
        log: line ? [...b.log, "Healing over time!", line] : [...b.log, "Healing over time!"],
      },
    });
  },

  activateLeague: (kind, formChoice) => {
    const b = get().battle;
    if (!b || b.result !== "fighting" || b.formsUsed[kind]) return;
    const gs = useGame.getState();
    const mon = gs.team[gs.active];
    if (!mon || mon.hp <= 0) return;
    const lf = b.leagueForms;
    // One transformation per mon.
    if (lf.mega?.uid === mon.uid || lf.dynamax?.uid === mon.uid || lf.tera?.uid === mon.uid) return;

    const now = Date.now();
    const next: LeagueForms = { ...lf };
    let line: string;
    if (kind === "mega") {
      const owned = megaFormsFor(gs.dex, mon.name);
      if (!owned.length) return;
      const formName = formChoice && owned.includes(formChoice) ? formChoice : owned[0];
      next.mega = { uid: mon.uid, formName };
      line = `${mon.name} Mega Evolved into ${formName.replace(/^M-/, "")}!`;
    } else if (kind === "dynamax") {
      if (!dynamaxUnlocked(gs.anomalyCleared)) return;
      const formName = gmaxFormFor(gs.dex, mon.name);
      next.dynamax = { uid: mon.uid, formName, until: now + LEAGUE_DYNAMAX_MS };
      // Refill to the boosted max for the duration; clamped back when it wears off.
      const boosted = combatStats(
        { ...mon, name: formName ?? mon.name },
        { form: formName ? "gmax" : "dynamax" },
      ).maxHp;
      useGame.setState({
        team: gs.team.map((p) => (p.uid === mon.uid ? { ...p, hp: boosted } : p)),
      });
      line = `${mon.name} ${formName ? "Gigantamaxed" : "Dynamaxed"}!`;
    } else {
      if (!teraUnlocked(gs.dex)) return;
      next.tera = { uid: mon.uid };
      line = `${mon.name} Terastallized${mon.teraType ? ` (${mon.teraType})` : ""}!`;
    }

    set({
      battle: {
        ...b,
        leagueForms: next,
        formsUsed: { ...b.formsUsed, [kind]: true },
        log: [...b.log, line],
      },
    });
  },

  tick: (dt) => {
    const b = get().battle;
    if (!b || b.result !== "fighting") return;
    const now = Date.now();

    const gs = useGame.getState();
    let team = gs.team.map((p) => ({ ...p }));
    let log = b.log;
    const buffs = { ...b.buffs };
    const lf: LeagueForms = {
      mega: b.leagueForms.mega ? { ...b.leagueForms.mega } : null,
      dynamax: b.leagueForms.dynamax ? { ...b.leagueForms.dynamax } : null,
      tera: b.leagueForms.tera ? { ...b.leagueForms.tera } : null,
    };

    // Heal-over-time now covers the whole team, not just whoever's active:
    // fainted members are revived to full HP outright, living ones get 2% of
    // their own current missing HP — recomputed fresh each tick, applied
    // before the "whole team down" check so a pending tick can save a run.
    if (buffs.healTicksLeft > 0 && now >= buffs.nextHealTickAt) {
      const result = applyHealTick(team);
      team = result.team;
      const line = healLogLine(result.revived, result.healedAny);
      if (line) log = [...log, line];
      buffs.healTicksLeft -= 1;
      buffs.nextHealTickAt = now + LEAGUE_HEAL_TICK_MS;
    }

    let activeIndex = gs.active;
    if (!team[activeIndex] || team[activeIndex].hp <= 0) {
      const living = team.findIndex((p) => p.hp > 0);
      activeIndex = living;
    }
    if (activeIndex < 0) {
      const progress = loseStage(get().progress);
      persist(progress);
      useGame.setState({ team });
      set({ progress, battle: { ...b, buffs: freshBuffs(), result: "lose", log: [...log, "Your team has no Pokemon left!"] } });
      useGame.setState({ paused: false });
      return;
    }

    let player = team[activeIndex];
    const enemyTeam = b.enemyTeam.map((p) => ({ ...p }));
    let enemyIndex = b.enemyIndex;
    let enemy = enemyTeam[enemyIndex];
    let enemyFainted = b.enemyFainted;

    const playerSpeed = leagueSpeedMs(combatStats(player).speedMs);
    const enemySpeed = leagueSpeedMs(combatStats(enemy).speedMs);
    let playerTimer = b.playerTimer + dt * 1000;
    let enemyTimer = b.enemyTimer + dt * 1000;

    let guard = 0;
    while (playerTimer >= playerSpeed && guard++ < 8 && enemy.hp > 0 && player.hp > 0) {
      playerTimer -= playerSpeed;
      const eff = leagueEffective(player, lf, now);
      const { damage, multiplier, crit } = attackDamage(eff.poke, enemy, {
        form: eff.form,
        teraType: eff.teraType,
      });
      const dmg = now < buffs.cheerUntil ? Math.round(damage * LEAGUE_CHEER_MULT) : damage;
      enemy = { ...enemy, hp: Math.max(0, enemy.hp - dmg) };
      enemyTeam[enemyIndex] = enemy;
      const critTag = crit ? "Critical hit! " : "";
      if (multiplier >= 2) log = [...log, `${critTag}Super effective! ${dmg} dmg`];
      else if (multiplier > 0 && multiplier <= 0.5) log = [...log, `${critTag}Not very effective... ${dmg}`];
      else log = [...log, `${critTag}${player.name} hits ${enemy.name} for ${dmg}.`];

      if (enemy.hp <= 0) {
        enemyFainted = enemyFainted.map((f, i) => (i === enemyIndex ? true : f));
        log = [...log, `${enemy.name} fainted!`];
        enemyIndex += 1;
        playerTimer = 0;
        enemyTimer = 0;
        if (enemyIndex >= enemyTeam.length) {
          const prevRuns = get().progress.runsCompleted;
          const { progress, team: healed } = winStage(get().progress, team);
          persist(progress);
          team[activeIndex] = player;
          useGame.setState({ team: healed, active: 0 });
          const fullClear = progress.runsCompleted > prevRuns;
          const winMsg = fullClear
            ? `Defeated ${b.trainer.name}! League cleared — team +1 prestige, enemy prestige +8.`
            : `Defeated ${b.trainer.name}!`;
          set({
            progress,
            battle: {
              ...b,
              enemyTeam,
              enemyIndex,
              enemyFainted,
              buffs: freshBuffs(),
              log: [...log, winMsg],
              result: "win",
            },
          });
          useGame.setState({ paused: false });
          return;
        }
        enemy = enemyTeam[enemyIndex];
        break;
      }
    }

    guard = 0;
    while (enemyTimer >= enemySpeed && guard++ < 8 && enemy.hp > 0 && player.hp > 0) {
      enemyTimer -= enemySpeed;
      const { damage } = attackDamage(enemy, player);
      const dmg = now < buffs.resistUntil ? Math.round(damage * LEAGUE_RESIST_TAKEN_MULT) : damage;
      player = { ...player, hp: Math.max(0, player.hp - dmg) };
      log = [...log, `${enemy.name} hits ${player.name} for ${dmg}.`];
      if (player.hp <= 0) {
        log = [...log, `${player.name} fainted!`];
        team[activeIndex] = player;
        const nextLiving = team.findIndex((p) => p.hp > 0);
        if (nextLiving >= 0) {
          activeIndex = nextLiving;
          player = team[activeIndex];
          log = [...log, `Go, ${player.name}!`];
        }
        break;
      }
    }
    team[activeIndex] = player;

    // Expire league activations: Dynamax on its real-time cap (clamp HP back),
    // Mega / Tera when the transformed mon has fainted.
    if (lf.dynamax && now >= lf.dynamax.until) {
      const i = team.findIndex((p) => p.uid === lf.dynamax!.uid);
      if (i >= 0) team[i] = { ...team[i], hp: Math.min(team[i].hp, combatStats(team[i]).maxHp) };
      lf.dynamax = null;
      log = [...log, "Dynamax wore off."];
    }
    for (const k of ["mega", "tera"] as const) {
      const rec = lf[k];
      if (rec && !team.some((p) => p.uid === rec.uid && p.hp > 0)) lf[k] = null;
    }

    if (team.every((p) => p.hp <= 0)) {
      const progress = loseStage(get().progress);
      persist(progress);
      useGame.setState({ team, active: activeIndex });
      set({ progress, battle: { ...b, enemyTeam, enemyIndex, enemyFainted, buffs: freshBuffs(), log: [...log, "Your team is down!"], result: "lose" } });
      useGame.setState({ paused: false });
      return;
    }

    useGame.setState({ team, active: activeIndex });
    set({
      battle: {
        ...b,
        enemyTeam,
        enemyIndex,
        enemyFainted,
        playerTimer,
        enemyTimer,
        buffs,
        leagueForms: lf,
        log: log.length > 40 ? log.slice(-40) : log,
      },
    });
  },
}));

export { leagueOrder };
