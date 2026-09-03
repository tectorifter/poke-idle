import { speciesByName } from "./dex";
import type { OwnedPoke, StatusCondition } from "./types";

/** Party type-synergy buffs. A count of same-type mons in the team unlocks
 *  tier 1/2/3 of that type's effect. "Full team buff" effects apply to every
 *  active player fighter; enemy-facing effects modify the opponent side. */
export type TeamSynergy = {
  /** Flying — flat Speed for the player team. */
  speFlat: number;
  /** Fighting — flat Attack for the player team. */
  atkFlat: number;
  /** Psychic — flat Special Attack for the player team. */
  spaFlat: number;
  /** Rock — flat Defense + Special Defense for the player team. */
  defFlat: number;
  spdFlat: number;
  /** Bug — extra critical-hit stage (0–2) for the player team. */
  critStage: number;
  /** Normal — +max HP fraction for the player + team (0 / .1 / .2 / .3). */
  hpPct: number;
  /** Fairy — flat Speed removed from every enemy. */
  enemySpeFlat: number;
  /** Dragon — damage-taken reduction fraction, but ONLY for Dragon-type mons. */
  dragonDrPct: number;
  /** Steel — fraction of damage taken reflected as true damage, ONLY when a
   *  Steel-type mon is the one hit. */
  steelReturnPct: number;
  /** Water — chance, on a Water-type mon's attack, to heal it 5% of max HP. */
  waterHealChance: number;
  /** Ground — chance, when an enemy hits a Ground-type mon, to make that enemy
   *  bleed 2% max HP on every attack it makes afterwards. */
  groundBleedChance: number;
  /** Ice — chance an Ice-type attack freezes the target. */
  freezeChance: number;
  /** Poison — chance a Poison-type attack inflicts poison (or toxic at tier 3). */
  poisonChance: number;
  poisonIsToxic: boolean;
  /** Electric — chance an Electric-type mon paralyzes: the target when it
   *  attacks, and the attacker when it is hit ("Static"). */
  paralyzeChance: number;
  /** Dark — chance a Dark-type attack makes the target flinch (lose next turn). */
  flinchChance: number;
  /** Fire in team — chance ANY attack burns the target (Fire types are immune). */
  burnChance: number;
  /** Ghost — chance a Ghost-type player mon takes its turn first regardless of
   *  Speed. On a successful roll the other side also has GHOST_STRUGGLE_CHANCE to
   *  hurt itself with Struggle instead of acting. */
  ghostFirstChance: number;
  /** Grass — chance, per action, to clear one status from the player's team. */
  grassCleanseChance: number;
};

export const NO_SYNERGY: TeamSynergy = {
  speFlat: 0,
  atkFlat: 0,
  spaFlat: 0,
  defFlat: 0,
  spdFlat: 0,
  critStage: 0,
  hpPct: 0,
  enemySpeFlat: 0,
  dragonDrPct: 0,
  steelReturnPct: 0,
  waterHealChance: 0,
  groundBleedChance: 0,
  freezeChance: 0,
  poisonChance: 0,
  poisonIsToxic: false,
  paralyzeChance: 0,
  flinchChance: 0,
  burnChance: 0,
  ghostFirstChance: 0,
  grassCleanseChance: 0,
};

/** True when the mon's species has the given type. */
export function isType(poke: OwnedPoke, type: string): boolean {
  return (speciesByName(poke.name)?.types ?? []).includes(type);
}

/** The one and only Stellar-type Pokémon. */
export function isStellar(poke: OwnedPoke | undefined): boolean {
  return !!poke && (poke.name === "Terapagos-Stellar" || isType(poke, "Stellar"));
}

/** Terapagos-Stellar's field effect: while it is the active fighter on EITHER
 *  side, every synergy (both teams) is switched off. */
export function stellarActive(
  playerMon: OwnedPoke | undefined,
  enemyMon: OwnedPoke | undefined,
): boolean {
  return isStellar(playerMon) || isStellar(enemyMon);
}

/** How much HP a bleeding enemy loses each time it attacks (Ground synergy). */
export const GROUND_BLEED_FRAC = 0.05;
/** How much a Water-type mon heals when its heal proc triggers. */
export const WATER_HEAL_FRAC = 0.05;
/** A frozen mon loses this fraction of max HP at the start of each turn it
 *  spends frozen (in addition to losing the turn). */
export const FREEZE_DAMAGE_FRAC = 0.03;
/** Burned mons deal 90% damage. */
export const BURN_DAMAGE_MULT = 0.75;

/** Per-attack Ground-synergy bleed damage for a `maxHp` pool (min 1). */
export const bleedTick = (maxHp: number) => Math.max(1, Math.floor(maxHp * GROUND_BLEED_FRAC));
/** Water-synergy heal amount for a `maxHp` pool (min 1). */
export const waterHeal = (maxHp: number) => Math.max(1, Math.floor(maxHp * WATER_HEAL_FRAC));
/** Each turn a frozen mon has this chance to thaw (the thaw turn is still lost). */
export const THAW_CHANCE = 0.3;
/** Paralysis full-stop chance per turn (Pokémon Showdown value). */
export const FULL_PARA_CHANCE = 0.50;
/** Ghost synergy rider: when the Ghost mon wins the turn-order roll, the loser
 *  has this chance to hurt itself with Struggle instead of acting cleanly. */
export const GHOST_STRUGGLE_CHANCE = 0.5;

export const STATUS_LABEL: Record<StatusCondition["kind"], string> = {
  burn: "burned",
  poison: "poisoned",
  toxic: "badly poisoned",
  paralyze: "paralyzed",
  freeze: "frozen",
};

/** 0 below the first threshold, else 1/2/3 by which threshold `count` reaches. */
function tierOf(count: number, thresholds: [number, number, number]): 0 | 1 | 2 | 3 {
  if (count >= thresholds[2]) return 3;
  if (count >= thresholds[1]) return 2;
  if (count >= thresholds[0]) return 1;
  return 0;
}

/** How many mons of each type are on the team (dual-typed mons count for both). */
export function typeCounts(team: OwnedPoke[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const p of team) {
    for (const t of speciesByName(p.name)?.types ?? []) {
      counts[t] = (counts[t] ?? 0) + 1;
    }
  }
  return counts;
}

/** Team-count thresholds for each synergy's tier 1 / 2 / 3. Electric and Grass
 *  have a single meaningful threshold (their tier-2/3 slots repeat it). */
export const SYNERGY_THRESHOLDS: Record<string, [number, number, number]> = {
  Flying: [2, 3, 5],
  Fighting: [3, 4, 5],
  Psychic: [3, 4, 5],
  Normal: [4, 5, 6],
  Rock: [1, 3, 4],
  Bug: [2, 5, 5],
  Fairy: [1, 2, 3],
  Dragon: [2, 4, 6],
  Steel: [1, 2, 3],
  Water: [2, 3, 4],
  Ground: [1, 2, 4],
  Ice: [1, 5, 6],
  Poison: [1, 2, 6],
  Electric: [3, 3, 3],
  Dark: [1, 2, 3],
  Fire: [1, 2, 3],
  Ghost: [1, 2, 3],
  Grass: [1, 1, 1],
  Stellar: [1, 1, 1],
};

/** Build a synergy set from an arbitrary per-type mon count. */
export function synergyFromCounts(c: Record<string, number>): TeamSynergy {
  const t = (type: string) => tierOf(c[type] ?? 0, SYNERGY_THRESHOLDS[type]);
  const rock = t("Rock");
  const poison = t("Poison");
  return {
    speFlat: [0, 10, 20, 30][t("Flying")],
    atkFlat: [0, 5, 10, 15][t("Fighting")],
    spaFlat: [0, 5, 10, 15][t("Psychic")],
    defFlat: [0, 4, 8, 12][rock],
    spdFlat: [0, 4, 8, 12][rock],
    critStage: [0, 1, 2, 2][t("Bug")],
    hpPct: [0, 0.1, 0.12, 0.15][t("Normal")],
    enemySpeFlat: [0, 50, 60, 70][t("Fairy")],
    dragonDrPct: [0, 0.1, 0.2, 0.3][t("Dragon")],
    steelReturnPct: [0, 0.04, 0.06, 0.08][t("Steel")],
    waterHealChance: [0, 0.10, 0.18, 0.26][t("Water")],
    groundBleedChance: [0, 0.25, 0.5, 1][t("Ground")],
    freezeChance: [0, 0.05, 0.08, 0.12][t("Ice")],
    poisonChance: [0, 0.35, 0.55, 0.65][poison],
    poisonIsToxic: poison === 3,
    paralyzeChance: t("Electric") > 0 ? 0.6 : 0,
    flinchChance: [0, 0.15, 0.25, 0.35][t("Dark")],
    burnChance: [0, 0.25, 0.35, 0.40][t("Fire")],
    ghostFirstChance: [0, 0.2, 0.4, 0.6][t("Ghost")],
    grassCleanseChance: t("Grass") > 0 ? 0.8 : 0,
  };
}

export function computeSynergy(team: OwnedPoke[]): TeamSynergy {
  return synergyFromCounts(typeCounts(team));
}

/** Which tier (1/2/3) a given team count reaches, 0 if none. */
export function synergyTier(type: string, count: number): 0 | 1 | 2 | 3 {
  const th = SYNERGY_THRESHOLDS[type];
  return th ? tierOf(count, th) : 0;
}

/** Mons of `type` still needed to reach the next tier, or null if maxed. */
export function nextTierNeed(type: string, count: number): number | null {
  const th = SYNERGY_THRESHOLDS[type];
  if (!th) return null;
  for (const t of th) if (count < t) return t - count;
  return null;
}

/** Display copy for the synergy panel — label, one-line effect, per-tier value. */
export const SYNERGY_META: Record<
  string,
  { label: string; effect: string; tierValues: [string, string, string] }
> = {
  Flying: { label: "Tailwind", effect: "Flat Speed for the whole team", tierValues: ["+10", "+15", "+25"] },
  Fighting: { label: "Fighting Spirit", effect: "Flat Attack for the whole team", tierValues: ["+20", "+30", "+40"] },
  Psychic: { label: "Psychic Power", effect: "Flat Sp. Atk for the whole team", tierValues: ["+20", "+30", "+40"] },
  Normal: { label: "Endurance", effect: "+Max HP for the player and team", tierValues: ["+10%", "+20%", "+30%"] },
  Rock: { label: "Sturdy", effect: "Flat Def + Sp. Def for the whole team", tierValues: ["+15", "+30", "+45"] },
  Bug: { label: "Swarm", effect: "Extra critical-hit stage for the team", tierValues: ["+1 stage", "+2", "+2"] },
  Fairy: { label: "Misty Terrain", effect: "Enemy team loses flat Speed", tierValues: ["-15", "-20", "-30"] },
  Dragon: { label: "Dragonhide", effect: "Dragon-type mons take less damage", tierValues: ["-10%", "-20%", "-30%"] },
  Steel: { label: "Iron Barbs", effect: "Steel-type mons reflect a cut of damage taken (true)", tierValues: ["4%", "6%", "8%"] },
  Water: { label: "Drain", effect: "Water-type mons: chance to heal 5% max HP on hit", tierValues: ["5%", "10%", "20%"] },
  Ground: { label: "Spikes", effect: "Chance to bleed foes that hit a Ground mon (2%/turn)", tierValues: ["25%", "50%", "100%"] },
  Ice: { label: "Frostbite", effect: "Ice mons: chance to freeze on hit — frozen mons also lose 3% HP/turn", tierValues: ["5%", "8%", "12%"] },
  Poison: { label: "Venom", effect: "Poison-type hits: chance to poison (tier 3 = toxic)", tierValues: ["20%", "40%", "50% toxic"] },
  Electric: { label: "Static", effect: "Electric mons paralyze on hit AND when hit (needs 3)", tierValues: ["—", "—", "on"] },
  Dark: { label: "Intimidate", effect: "Dark-type hits: chance to flinch the target", tierValues: ["4%", "8%", "16%"] },
  Fire: { label: "Burn", effect: "Chance to burn — burned mons deal 10% less", tierValues: ["10%", "15%", "20%"] },
  Ghost: { label: "Phantom", effect: "Ghost mons strike first; the foe then has 50% to Struggle itself", tierValues: ["20%", "40%", "60%"] },
  Grass: { label: "Herbal Cure", effect: "Chance to clear a team status each action (needs 1)", tierValues: ["25%", "25%", "25%"] },
  Stellar: {
    label: "Stellar",
    effect: "While a Stellar mon (Terapagos-Stellar) is the active fighter, EVERY synergy — yours and the foe's — is switched off",
    tierValues: ["all off", "all off", "all off"],
  },
};

export const SYNERGY_TYPES = Object.keys(SYNERGY_META);

/** Synergy a single wild encounter grants ITS OWN side (isolated from the
 *  player's and league teams). An anomaly form activates tier 1 of every one of
 *  its types' synergies; a normal encounter only activates the ones whose tier 1
 *  needs a single mon. */
export function encounterSynergy(mon: OwnedPoke, isAnomaly: boolean): TeamSynergy {
  const counts: Record<string, number> = {};
  for (const type of speciesByName(mon.name)?.types ?? []) {
    const need = SYNERGY_THRESHOLDS[type]?.[0];
    if (need == null) continue;
    if (isAnomaly || need === 1) counts[type] = need;
  }
  return synergyFromCounts(counts);
}

/** Residual HP loss for a mon at the start of its turn — poison (flat ⅛),
 *  toxic (escalating n/16) and freeze (flat FREEZE_DAMAGE_FRAC). Pure — returns
 *  the new hp, the (possibly escalated) status, and how much was lost. */
export function tickResidual(
  hp: number,
  maxHp: number,
  status: StatusCondition | undefined,
): { hp: number; status: StatusCondition | undefined; lost: number } {
  if (status?.kind === "poison") {
    const lost = Math.max(1, Math.floor(maxHp / 8));
    return { hp: Math.max(0, hp - lost), status, lost };
  }
  if (status?.kind === "toxic") {
    const n = status.toxicN ?? 1;
    const lost = Math.max(1, Math.floor((maxHp * n) / 16));
    return { hp: Math.max(0, hp - lost), status: { kind: "toxic", toxicN: Math.min(15, n + 1) }, lost };
  }
  if (status?.kind === "freeze") {
    const lost = Math.max(1, Math.floor(maxHp * FREEZE_DAMAGE_FRAC));
    return { hp: Math.max(0, hp - lost), status, lost };
  }
  return { hp, status, lost: 0 };
}

/** Whether a status'd mon can act this turn. Handles freeze (THAW_CHANCE thaw,
 *  thaw turn still lost) and paralysis (FULL_PARA_CHANCE full-stop). Returns the
 *  possibly-cleared status and a short note for the log. */
export function canAct(status: StatusCondition | undefined): {
  ok: boolean;
  status: StatusCondition | undefined;
  note?: "thawed" | "frozen" | "paralyzed";
} {
  if (status?.kind === "freeze") {
    if (Math.random() < THAW_CHANCE) return { ok: false, status: undefined, note: "thawed" };
    return { ok: false, status, note: "frozen" };
  }
  if (status?.kind === "paralyze" && Math.random() < FULL_PARA_CHANCE) {
    return { ok: false, status, note: "paralyzed" };
  }
  return { ok: true, status };
}

/** Roll the player team's on-hit status inflictions against one target. Most
 *  effects are gated to a matching-type attacker; each type is immune to its own
 *  status (plus Steel to poison). One major status at a time. */
export function rollInflictions(
  syn: TeamSynergy,
  attacker: OwnedPoke,
  target: OwnedPoke,
  targetHasStatus: boolean,
): { status?: StatusCondition; flinch: boolean; label?: string } {
  const flinch =
    syn.flinchChance > 0 && isType(attacker, "Dark") && Math.random() < syn.flinchChance;

  if (targetHasStatus) return { flinch };
  const immune = (t: string) => isType(target, t);

  if (syn.freezeChance > 0 && isType(attacker, "Ice") && !immune("Ice") && Math.random() < syn.freezeChance)
    return { status: { kind: "freeze" }, flinch, label: STATUS_LABEL.freeze };

  if (syn.burnChance > 0 && !immune("Fire") && Math.random() < syn.burnChance)
    return { status: { kind: "burn" }, flinch, label: STATUS_LABEL.burn };

  if (
    syn.poisonChance > 0 &&
    isType(attacker, "Poison") &&
    !immune("Poison") &&
    !immune("Steel") &&
    Math.random() < syn.poisonChance
  ) {
    const kind = syn.poisonIsToxic ? "toxic" : "poison";
    return {
      status: syn.poisonIsToxic ? { kind: "toxic", toxicN: 1 } : { kind },
      flinch,
      label: STATUS_LABEL[kind],
    };
  }

  if (
    syn.paralyzeChance > 0 &&
    isType(attacker, "Electric") &&
    !immune("Electric") &&
    Math.random() < syn.paralyzeChance
  )
    return { status: { kind: "paralyze" }, flinch, label: STATUS_LABEL.paralyze };

  return { flinch };
}

// ─── Shared per-attack resolution (wild pool + league per-mon both use these) ──

export type PreAttack = {
  /** HP after residual (poison/toxic) + Ground bleed, clamped to 0. */
  hp: number;
  /** HP was actually lost this step (for the wild hit-flash / dirty flags). */
  tookDamage: boolean;
  /** Status after residual escalation / thaw. */
  status: StatusCondition | undefined;
  /** A flinch flag was consumed — the caller should clear it. */
  flinchConsumed: boolean;
  /** The mon gets to attack this turn. */
  acts: boolean;
  /** Freeze/paralyze/thaw note (only "thawed" is logged today). */
  note?: "thawed" | "frozen" | "paralyzed";
  /** The mon dropped to 0 from residual/bleed before it could act. */
  fainted: boolean;
};

/** Everything that happens to a mon *before* it swings: residual poison/toxic/
 *  freeze chip, Ground-synergy bleed, Dark-synergy flinch, then the freeze-thaw
 *  / paralyze roll. Pure — the caller applies `hp` / `status` to its own model. */
export function resolvePreAttack(
  hp: number,
  maxHp: number,
  status: StatusCondition | undefined,
  bleed: boolean | undefined,
  flinch: boolean | undefined,
): PreAttack {
  let curHp = hp;
  let st = status;
  let took = false;

  if (st?.kind === "poison" || st?.kind === "toxic" || st?.kind === "freeze") {
    const r = tickResidual(curHp, maxHp, st);
    if (r.lost > 0) took = true;
    curHp = r.hp;
    st = r.status;
    if (curHp <= 0)
      return { hp: 0, tookDamage: took, status: st, flinchConsumed: false, acts: false, fainted: true };
  }

  if (bleed) {
    curHp = Math.max(0, curHp - bleedTick(maxHp));
    took = true;
    if (curHp <= 0)
      return { hp: 0, tookDamage: took, status: st, flinchConsumed: false, acts: false, fainted: true };
  }

  if (flinch)
    return { hp: curHp, tookDamage: took, status: st, flinchConsumed: true, acts: false, fainted: false };

  const act = canAct(st);
  return {
    hp: curHp,
    tookDamage: took,
    status: act.status,
    flinchConsumed: false,
    acts: act.ok,
    note: act.note,
    fainted: false,
  };
}

export type OnHit = {
  /** True recoil the ATTACKER takes (defender's Steel synergy), 0 if none. */
  recoil: number;
  /** HP the attacker heals from its own Water synergy, 0 if none. */
  selfHeal: number;
  /** Attacker starts bleeding (defender's Ground synergy). */
  bleedAttacker: boolean;
  /** Major status the attacker inflicts on the defender. */
  inflictStatus?: StatusCondition;
  /** Attacker makes the defender flinch. */
  inflictFlinch: boolean;
  inflictLabel?: string;
  /** Status the DEFENDER inflicts back on the attacker — Electric "Static":
   *  hitting an Electric-type mon can paralyze the hitter. */
  inflictOnAttacker?: StatusCondition;
  inflictOnAttackerLabel?: string;
};

/** Everything that fires *after* a hit connects: Steel recoil, Ground bleed on
 *  the attacker, the attacker's own Water heal, and the status/flinch it
 *  inflicts. Order of the independent RNG rolls is fixed here so wild and
 *  league stay identical. */
export function resolveOnHit(
  attackerSyn: TeamSynergy,
  defenderSyn: TeamSynergy,
  attacker: OwnedPoke,
  defender: OwnedPoke,
  dmgDealt: number,
  attackerMaxHp: number,
  defenderHasStatus: boolean,
): OnHit {
  const recoil =
    defenderSyn.steelReturnPct > 0 && dmgDealt > 0 && isType(defender, "Steel")
      ? Math.max(1, Math.floor(dmgDealt * defenderSyn.steelReturnPct))
      : 0;

  const bleedAttacker =
    !attacker.bleed &&
    defenderSyn.groundBleedChance > 0 &&
    isType(defender, "Ground") &&
    Math.random() < defenderSyn.groundBleedChance;

  const selfHeal =
    attackerSyn.waterHealChance > 0 &&
    isType(attacker, "Water") &&
    Math.random() < attackerSyn.waterHealChance
      ? waterHeal(attackerMaxHp)
      : 0;

  const inf = rollInflictions(attackerSyn, attacker, defender, defenderHasStatus);

  // Electric "Static": the defender paralyzes the attacker that struck it,
  // regardless of the move used — same chance as the on-hit paralyze.
  const staticPara =
    defenderSyn.paralyzeChance > 0 &&
    isType(defender, "Electric") &&
    !isType(attacker, "Electric") &&
    !attacker.status &&
    Math.random() < defenderSyn.paralyzeChance
      ? ({ kind: "paralyze" } as StatusCondition)
      : undefined;

  return {
    recoil,
    selfHeal,
    bleedAttacker,
    inflictStatus: inf.status,
    inflictFlinch: inf.flinch,
    inflictLabel: inf.label,
    inflictOnAttacker: staticPara,
    inflictOnAttackerLabel: staticPara ? STATUS_LABEL.paralyze : undefined,
  };
}
