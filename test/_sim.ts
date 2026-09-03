import { attackDamage, attackIntervalMs, combatStats } from "@/lib/game/formulas";
import { NO_SYNERGY, resolveOnHit, resolvePreAttack } from "@/lib/game/synergy";
import type { TeamSynergy } from "@/lib/game/synergy";
import type { MoveData } from "@/lib/game/moves";
import type { OwnedPoke } from "@/lib/game/types";

/** One combatant in a duel. */
export type Side = {
  poke: OwnedPoke;
  synergy?: TeamSynergy;
  /** Force a move; omit to let attackDamage pick the mon's best learnable one. */
  move?: MoveData;
};

export type FightResult = {
  winner: "a" | "b" | "timeout";
  seconds: number;
  hits: { a: number; b: number };
  swings: { a: number; b: number }; // hits + misses + lost turns
  dmg: { a: number; b: number };
  crits: { a: number; b: number };
  misses: { a: number; b: number };
  lostTurns: { a: number; b: number }; // frozen / paralysed / flinched
};

/** Full mon-vs-mon duel using the real combat helpers + speed cadence.
 *  Both sides use per-mon HP (mirrors league; a fair proxy for wild power). */
export function fight(aSide: Side, bSide: Side, maxSeconds = 180): FightResult {
  const aSyn = aSide.synergy ?? NO_SYNERGY;
  const bSyn = bSide.synergy ?? NO_SYNERGY;
  const A = { ...aSide.poke };
  const B = { ...bSide.poke };
  const aSt = combatStats(A, { synergy: aSyn });
  const bSt = combatStats(B, { synergy: bSyn });

  const hp = { a: aSt.maxHp, b: bSt.maxHp };
  const max = { a: aSt.maxHp, b: bSt.maxHp };
  const int = { a: attackIntervalMs(aSt.spe), b: attackIntervalMs(bSt.spe) };
  const cd = { a: int.a, b: int.b }; // one interval before the first swing

  const R: FightResult = {
    winner: "timeout",
    seconds: 0,
    hits: { a: 0, b: 0 },
    swings: { a: 0, b: 0 },
    dmg: { a: 0, b: 0 },
    crits: { a: 0, b: 0 },
    misses: { a: 0, b: 0 },
    lostTurns: { a: 0, b: 0 },
  };

  const swing = (k: "a" | "b") => {
    const o = k === "a" ? "b" : "a";
    const atk = k === "a" ? A : B;
    const def = k === "a" ? B : A;
    const atkSyn = k === "a" ? aSyn : bSyn;
    const defSyn = k === "a" ? bSyn : aSyn;
    R.swings[k]++;

    const pre = resolvePreAttack(hp[k], max[k], atk.status, atk.bleed, atk.flinch);
    hp[k] = pre.hp;
    atk.status = pre.status;
    if (pre.flinchConsumed) atk.flinch = undefined;
    if (hp[k] <= 0) return;
    if (!pre.acts) {
      R.lostTurns[k]++;
      return;
    }

    const res = attackDamage(atk, def, {
      move: k === "a" ? aSide.move : bSide.move,
      synergy: atkSyn,
      defenderSynergy: defSyn,
      critStageBonus: atkSyn.critStage,
      attackerBurned: atk.status?.kind === "burn",
    });
    if (res.missed) {
      R.misses[k]++;
      return;
    }
    R.hits[k]++;
    if (res.crit) R.crits[k]++;
    hp[o] = Math.max(0, hp[o] - res.damage);
    R.dmg[k] += res.damage;

    const oh = resolveOnHit(atkSyn, defSyn, atk, def, res.damage, max[k], !!def.status);
    if (oh.recoil) hp[k] = Math.max(0, hp[k] - oh.recoil);
    if (oh.selfHeal) hp[k] = Math.min(max[k], hp[k] + oh.selfHeal);
    if (oh.bleedAttacker) atk.bleed = true;
    if (oh.inflictFlinch) def.flinch = true;
    if (oh.inflictStatus) def.status = oh.inflictStatus;
  };

  let t = 0;
  while (t < maxSeconds * 1000 && hp.a > 0 && hp.b > 0) {
    const step = Math.min(cd.a, cd.b);
    t += step;
    cd.a -= step;
    cd.b -= step;
    // faster mon (or A on a tie) resolves first
    if (cd.a <= 1e-9) {
      swing("a");
      cd.a = int.a;
      if (hp.b <= 0) break;
    }
    if (cd.b <= 1e-9) {
      swing("b");
      cd.b = int.b;
      if (hp.a <= 0) break;
    }
  }

  R.seconds = t / 1000;
  R.winner = hp.b <= 0 ? "a" : hp.a <= 0 ? "b" : "timeout";
  return R;
}

export type Aggregate = {
  runs: number;
  winA: number; // fraction
  timeouts: number;
  seconds: number; // mean
  aDmgPerHit: number;
  bDmgPerHit: number;
  aHitsToKill: number; // A's hits over the fight (≈ hits to KO B when A wins)
  aCritRate: number;
  aMissRate: number;
  aLostTurns: number;
};

/** Run `runs` duels and average the numbers you care about for balancing.
 *  Pass *factories* so every fight rolls fresh IVs/natures — the averages then
 *  sample the whole spread instead of one lucky/unlucky pairing. */
export function simulate(makeA: () => Side, makeB: () => Side, runs = 2000): Aggregate {
  const acc = {
    winA: 0,
    timeouts: 0,
    seconds: 0,
    aDPH: 0,
    bDPH: 0,
    aHits: 0,
    aCrit: 0,
    aMiss: 0,
    aLost: 0,
  };
  for (let i = 0; i < runs; i++) {
    const r = fight(makeA(), makeB());
    if (r.winner === "a") acc.winA++;
    if (r.winner === "timeout") acc.timeouts++;
    acc.seconds += r.seconds;
    acc.aDPH += r.hits.a ? r.dmg.a / r.hits.a : 0;
    acc.bDPH += r.hits.b ? r.dmg.b / r.hits.b : 0;
    acc.aHits += r.hits.a;
    const aTries = r.hits.a + r.misses.a;
    acc.aCrit += aTries ? r.crits.a / aTries : 0;
    acc.aMiss += aTries ? r.misses.a / aTries : 0;
    acc.aLost += r.lostTurns.a;
  }
  return {
    runs,
    winA: acc.winA / runs,
    timeouts: acc.timeouts / runs,
    seconds: acc.seconds / runs,
    aDmgPerHit: acc.aDPH / runs,
    bDmgPerHit: acc.bDPH / runs,
    aHitsToKill: acc.aHits / runs,
    aCritRate: acc.aCrit / runs,
    aMissRate: acc.aMiss / runs,
    aLostTurns: acc.aLost / runs,
  };
}
