import { create } from "zustand";
import {
  attackDamage,
  attackIntervalMs,
  combatStats,
  HEAL_COOLDOWN_MS,
  LEAGUE_DYNAMAX_MS,
  levelOf,
} from "./formulas";
import type { FormKind } from "./formulas";
import { bestMoveAgainst, chosenMoves } from "./learnsets";
import {
  computeSynergy,
  stellarActive,
  NO_SYNERGY,
  resolvePreAttack,
  resolveOnHit,
} from "./synergy";
import type { TeamSynergy } from "./synergy";
import {
  baseSpeciesOf,
  megaFormsFor,
  gmaxFormFor,
  dynamaxUnlocked,
  teraUnlocked,
  teraFormsFor,
  speciesByName,
} from "./dex";
import type { AnomalyKind } from "./dex";
import {
  anomalyInfusionFraction,
  buildTrainerTeam,
  currentStage,
  initialLeagueProgress,
  leagueEnemyPrestige,
  leagueOrder,
  loseStage,
  trainerOf,
  winStage,
} from "./league";
import { rayquazaAutoMega, useGame } from "./store";
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
function applyHealTick(
  team: OwnedPoke[],
  synergy: TeamSynergy,
): { team: OwnedPoke[]; revived: number; healedAny: boolean } {
  let revived = 0;
  let healedAny = false;

  const next = team.map((p) => {
    const stats = combatStats(p, { synergy });

    if (p.hp <= 0) {
      revived += 1;
      const reviveHp = Math.max(1, Math.floor(stats.maxHp * LEAGUE_HEAL_TICK_PERCENT)); // ensure at least 1 HP
      if (reviveHp > 0) healedAny = true;
      // Fainting clears status.
      return { ...p, hp: reviveHp, status: undefined, flinch: undefined, bleed: undefined };
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
  tera: { uid: string; formName?: string | null } | null;
};
const freshLeagueForms = (): LeagueForms => ({ mega: null, dynamax: null, tera: null });
const freshFormsUsed = () => ({ mega: false, dynamax: false, tera: false });

/** Effective attacker for a league mon: swap to the Mega / G-Max / Tera species
 *  and report the form kind + tera type for the damage formula. */
export function leagueEffective(
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
  if (lf.tera && lf.tera.uid === mon.uid) {
    if (lf.tera.formName) {
      const t = speciesByName(lf.tera.formName)?.types[0] ?? mon.teraType;
      return { poke: { ...mon, name: lf.tera.formName }, form: "tera", teraType: t };
    }
    return { poke: mon, form: "tera", teraType: mon.teraType };
  }
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
  /** Which of the active mon's 4 move slots is fired each speed-paced turn (0–3). */
  selectedMove: number;
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
  /** Pick which of the active mon's 4 move slots is fired (0–3). */
  selectMove: (index: number) => void;
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
        selectedMove: 0,
        log: [`${trainer.name} wants to battle!`],
        result: "fighting",
      },
    });
    // Freeze the wild-route loop for the duration -- both loops would otherwise
    // fight over the same team/HP state at once. Clear any status carried in
    // from wild combat so the league fight starts clean.
    useGame.setState({
      paused: true,
      team: useGame
        .getState()
        .team.map((p) => ({ ...p, status: undefined, flinch: undefined, bleed: undefined })),
    });
  },

  clearBattle: () => {
    set({ battle: null });
    useGame.setState({ paused: false });
  },

  selectMove: (index) => {
    const b = get().battle;
    if (!b || b.result !== "fighting") return;
    set({ battle: { ...b, selectedMove: Math.max(0, Math.min(3, Math.floor(index) || 0)) } });
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
    const { team, revived, healedAny } = applyHealTick(gs.team, computeSynergy(gs.team));
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
      // Rayquaza Mega-Evolves via a known Dragon Ascent, not this button.
      if (baseSpeciesOf(mon.name) === "Rayquaza") return;
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
        { form: formName ? "gmax" : "dynamax", synergy: computeSynergy(gs.team) },
      ).maxHp;
      useGame.setState({
        team: gs.team.map((p) => (p.uid === mon.uid ? { ...p, hp: boosted } : p)),
      });
      line = `${mon.name} ${formName ? "Gigantamaxed" : "Dynamaxed"}!`;
    } else {
      if (!teraUnlocked(gs.dex)) return;
      const teraForms = teraFormsFor(gs.dex, mon.name);
      if (teraForms.length > 0) {
        const formName =
          formChoice && teraForms.includes(formChoice) ? formChoice : teraForms[0];
        next.tera = { uid: mon.uid, formName };
        line = `${mon.name} Terastallized into ${formName.replace("Terapagos-", "")}!`;
      } else {
        next.tera = { uid: mon.uid };
        line = `${mon.name} Terastallized${mon.teraType ? ` (${mon.teraType})` : ""}!`;
      }
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
    // Party type-synergy buffs apply in league fights too — unless a Stellar mon
    // (Terapagos-Stellar, incl. via Tera) is the active fighter on either side,
    // which switches every synergy off.
    const activeForStellar = gs.team[gs.active];
    const stellarOut = stellarActive(
      activeForStellar ? leagueEffective(activeForStellar, b.leagueForms, now).poke : undefined,
      b.enemyTeam[b.enemyIndex],
    );
    const synergy = stellarOut ? NO_SYNERGY : computeSynergy(team);
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
      const result = applyHealTick(team, synergy);
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

    // Rayquaza auto-Mega-Evolves in a league fight when it knows Dragon Ascent —
    // consumes the one-per-fight Mega slot, same as a button activation would.
    let formsUsed = b.formsUsed;
    if (
      !formsUsed.mega &&
      !lf.mega &&
      player.hp > 0 &&
      lf.dynamax?.uid !== player.uid &&
      lf.tera?.uid !== player.uid &&
      rayquazaAutoMega(player, gs.dex)
    ) {
      lf.mega = { uid: player.uid, formName: "M-Rayquaza" };
      formsUsed = { ...formsUsed, mega: true };
      log = [...log, `${player.name} Mega Evolved into Rayquaza via Dragon Ascent!`];
    }

    const enemyTeam = b.enemyTeam.map((p) => ({ ...p }));
    let enemyIndex = b.enemyIndex;
    let enemy = enemyTeam[enemyIndex];
    let enemyFainted = b.enemyFainted;

    // League enemy teams count as a TEAM for synergy — read the whole trainer
    // roster, not the one mon in play. (Off entirely while a Stellar mon is out.)
    const enemySynergy = stellarOut ? NO_SYNERGY : computeSynergy(enemyTeam);

    // Same Speed "judge" as wild combat — but here it directly owns how often a
    // mon attacks (no tapping in the league). 1–4 attacks/s from resolved Speed.
    const pSpeedEff = leagueEffective(player, lf, now);
    const playerSpeed = attackIntervalMs(
      Math.max(
        1,
        combatStats(pSpeedEff.poke, { form: pSpeedEff.form, synergy }).spe - enemySynergy.enemySpeFlat,
      ),
    );
    const enemySpeed = attackIntervalMs(
      Math.max(1, combatStats(enemy, { synergy: enemySynergy }).spe - synergy.enemySpeFlat),
    );
    let playerTimer = b.playerTimer + dt * 1000;
    let enemyTimer = b.enemyTimer + dt * 1000;
    const pickedMove = chosenMoves(player, levelOf(player))[b.selectedMove] ?? undefined;

    // Shared enemy-faint resolution — reused by the player's own attacks and by
    // the Steel-return / Ground-bleed synergy damage that can KO an enemy on
    // its own turn. Sets `won` when the last enemy drops (handled after both
    // loops so it can `return` from tick cleanly).
    let won = false;
    const resolveEnemyFaint = () => {
      enemyFainted = enemyFainted.map((f, i) => (i === enemyIndex ? true : f));
      log = [...log, `${enemy.name} fainted!`];
      enemyIndex += 1;
      playerTimer = 0;
      enemyTimer = 0;
      if (enemyIndex >= enemyTeam.length) won = true;
      else enemy = enemyTeam[enemyIndex];
    };
    /** Player mon dropped — log it and switch to the next living mon if any. */
    const faintPlayer = () => {
      log = [...log, `${player.name} fainted!`];
      team[activeIndex] = player;
      const next = team.findIndex((p) => p.hp > 0);
      if (next >= 0) {
        activeIndex = next;
        player = team[activeIndex];
        log = [...log, `Go, ${player.name}!`];
      }
    };

    let guard = 0;
    while (playerTimer >= playerSpeed && guard++ < 8 && enemy.hp > 0 && player.hp > 0) {
      playerTimer -= playerSpeed;

      // Enemy-inflicted status on the active mon: residual, bleed, flinch,
      // freeze / paralyze — all resolved before the mon can act.
      const pMax = combatStats(player, { synergy }).maxHp;
      const pre = resolvePreAttack(player.hp, pMax, player.status, player.bleed, player.flinch);
      player = {
        ...player,
        hp: pre.hp,
        status: pre.status,
        flinch: pre.flinchConsumed ? false : player.flinch,
      };
      if (pre.note === "thawed") log = [...log, `${player.name} thawed out!`];
      if (pre.fainted) {
        faintPlayer();
        break;
      }
      if (!pre.acts) continue;

      const eff = leagueEffective(player, lf, now);
      const { damage, multiplier, crit, missed } = attackDamage(eff.poke, enemy, {
        form: eff.form,
        teraType: eff.teraType,
        move: pickedMove,
        synergy,
        critStageBonus: synergy.critStage,
        defenderSynergy: enemySynergy,
        attackerBurned: player.status?.kind === "burn",
      });
      if (missed) {
        log = [...log, `${player.name}'s attack missed!`];
        continue;
      }
      const dmg = now < buffs.cheerUntil ? Math.round(damage * LEAGUE_CHEER_MULT) : damage;
      enemy = { ...enemy, hp: Math.max(0, enemy.hp - dmg) };
      enemyTeam[enemyIndex] = enemy;
      const critTag = crit ? "Critical hit! " : "";
      if (multiplier >= 2) log = [...log, `${critTag}Super effective! ${dmg} dmg`];
      else if (multiplier > 0 && multiplier <= 0.5) log = [...log, `${critTag}Not very effective... ${dmg}`];
      else log = [...log, `${critTag}${player.name} hits ${enemy.name} for ${dmg}.`];

      // On-hit synergy procs (enemy Steel recoil onto the player, enemy Ground
      // bleed on the player, the player's own Water heal, status onto the enemy).
      const oh = resolveOnHit(synergy, enemySynergy, player, enemy, dmg, pMax, !!enemy.status);
      if (oh.recoil > 0) {
        player = { ...player, hp: Math.max(0, player.hp - oh.recoil) };
        log = [...log, `${player.name} takes ${oh.recoil} from ${enemy.name}'s Steel synergy.`];
        if (player.hp <= 0) {
          faintPlayer();
          break;
        }
      }
      if (oh.bleedAttacker) {
        player = { ...player, bleed: true };
        log = [...log, `${player.name} started bleeding!`];
      }
      if (oh.selfHeal > 0) player = { ...player, hp: Math.min(pMax, player.hp + oh.selfHeal) };
      if (oh.inflictFlinch || oh.inflictStatus) {
        enemy = {
          ...enemy,
          flinch: oh.inflictFlinch || enemy.flinch,
          status: oh.inflictStatus ?? enemy.status,
        };
        enemyTeam[enemyIndex] = enemy;
        if (oh.inflictStatus) log = [...log, `${enemy.name} was ${oh.inflictLabel}!`];
      }
      if (oh.inflictOnAttacker) {
        player = { ...player, status: oh.inflictOnAttacker };
        log = [...log, `${player.name} was ${oh.inflictOnAttackerLabel}!`];
      }

      if (enemy.hp <= 0) {
        resolveEnemyFaint();
        break;
      }
    }

    guard = 0;
    while (enemyTimer >= enemySpeed && guard++ < 8 && enemy.hp > 0 && player.hp > 0) {
      enemyTimer -= enemySpeed;

      // Residual / bleed / flinch / freeze-paralyze at the start of the turn.
      const eMax = combatStats(enemy, { synergy: enemySynergy }).maxHp;
      const pre = resolvePreAttack(enemy.hp, eMax, enemy.status, enemy.bleed, enemy.flinch);
      enemy = {
        ...enemy,
        hp: pre.hp,
        status: pre.status,
        flinch: pre.flinchConsumed ? false : enemy.flinch,
      };
      enemyTeam[enemyIndex] = enemy;
      if (pre.note === "thawed") log = [...log, `${enemy.name} thawed out!`];
      if (pre.fainted) {
        resolveEnemyFaint();
        break;
      }
      if (!pre.acts) continue;

      const { damage, missed } = attackDamage(enemy, player, {
        move: bestMoveAgainst(enemy, levelOf(enemy), combatStats(player).types),
        synergy: enemySynergy,
        defenderSynergy: synergy,
        critStageBonus: enemySynergy.critStage,
        attackerBurned: enemy.status?.kind === "burn",
      });
      if (missed) {
        log = [...log, `${enemy.name}'s attack missed!`];
        continue;
      }
      const dmg = now < buffs.resistUntil ? Math.round(damage * LEAGUE_RESIST_TAKEN_MULT) : damage;
      player = { ...player, hp: Math.max(0, player.hp - dmg) };
      log = [...log, `${enemy.name} hits ${player.name} for ${dmg}.`];

      // On-hit synergy procs (enemy Water self-heal, player-Steel recoil onto
      // the enemy, player-Ground bleed on the enemy, status onto the player).
      const oh = resolveOnHit(enemySynergy, synergy, enemy, player, dmg, eMax, !!player.status);
      if (oh.selfHeal > 0) {
        enemy = { ...enemy, hp: Math.min(eMax, enemy.hp + oh.selfHeal) };
        enemyTeam[enemyIndex] = enemy;
      }
      if (oh.recoil > 0) {
        enemy = { ...enemy, hp: Math.max(0, enemy.hp - oh.recoil) };
        enemyTeam[enemyIndex] = enemy;
        log = [...log, `${enemy.name} takes ${oh.recoil} from Steel synergy.`];
      }
      if (oh.bleedAttacker) {
        enemy = { ...enemy, bleed: true };
        enemyTeam[enemyIndex] = enemy;
        log = [...log, `${enemy.name} started bleeding!`];
      }
      if (oh.inflictFlinch || oh.inflictStatus) {
        player = {
          ...player,
          flinch: oh.inflictFlinch || player.flinch,
          status: oh.inflictStatus ?? player.status,
        };
        if (oh.inflictStatus) log = [...log, `${player.name} was ${oh.inflictLabel}!`];
      }
      if (oh.inflictOnAttacker) {
        enemy = { ...enemy, status: oh.inflictOnAttacker };
        enemyTeam[enemyIndex] = enemy;
        log = [...log, `${enemy.name} was ${oh.inflictOnAttackerLabel}!`];
      }

      if (player.hp <= 0) {
        faintPlayer();
        break;
      }
      if (enemy.hp <= 0) {
        resolveEnemyFaint();
        break;
      }
    }
    team[activeIndex] = player;

    // Grass synergy: chance to clear a status from any party mon that has one.
    if (synergy.grassCleanseChance > 0 && Math.random() < synergy.grassCleanseChance) {
      const cured = team.findIndex((p) => p.status);
      if (cured >= 0) team[cured] = { ...team[cured], status: undefined };
    }

    if (won) {
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

    // Expire league activations: Dynamax on its real-time cap (clamp HP back),
    // Mega / Tera when the transformed mon has fainted.
    if (lf.dynamax && now >= lf.dynamax.until) {
      const i = team.findIndex((p) => p.uid === lf.dynamax!.uid);
      if (i >= 0) team[i] = { ...team[i], hp: Math.min(team[i].hp, combatStats(team[i], { synergy }).maxHp) };
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
        formsUsed,
        leagueForms: lf,
        log: log.length > 40 ? log.slice(-40) : log,
      },
    });
  },
}));

export { leagueOrder };
