import { describe, it, expect } from "vitest";
import {
  resolvePreAttack,
  resolveOnHit,
  tickResidual,
  canAct,
  bleedTick,
  waterHeal,
  rollInflictions,
  NO_SYNERGY,
} from "@/lib/game/synergy";
import type { TeamSynergy } from "@/lib/game/synergy";
import type { StatusCondition, OwnedPoke } from "@/lib/game/types";
import { mon, rate, expectRate, SPECIES } from "./_helpers";

const syn = (o: Partial<TeamSynergy>): TeamSynergy => ({ ...NO_SYNERGY, ...o });

describe("resolvePreAttack — behaviour", () => {
  it("clean mon acts, loses nothing", () => {
    expect(resolvePreAttack(500, 500, undefined, false, false)).toEqual({
      hp: 500,
      tookDamage: false,
      status: undefined,
      flinchConsumed: false,
      acts: true,
      note: undefined,
      fainted: false,
    });
  });

  it("residual reduces HP, escalates toxic, sets tookDamage", () => {
    const r = resolvePreAttack(1600, 1600, { kind: "toxic", toxicN: 2 }, false, false);
    expect(r.hp).toBe(1600 - 200);
    expect(r.status).toEqual({ kind: "toxic", toxicN: 3 });
    expect(r.tookDamage).toBe(true);
    expect(r.acts).toBe(true);
  });

  it("residual KO → fainted, does not act", () => {
    const r = resolvePreAttack(50, 1600, { kind: "toxic", toxicN: 15 }, false, false);
    expect(r).toMatchObject({ hp: 0, fainted: true, acts: false });
  });

  it("bleed subtracts bleedTick(maxHp); KO → fainted", () => {
    const r = resolvePreAttack(500, 400, undefined, true, false);
    expect(r.hp).toBe(500 - bleedTick(400));
    expect(r.tookDamage).toBe(true);
    const ko = resolvePreAttack(bleedTick(400), 400, undefined, true, false);
    expect(ko).toMatchObject({ hp: 0, fainted: true, acts: false });
  });

  it("flinch consumes the turn (hp untouched, flinchConsumed, no act)", () => {
    const r = resolvePreAttack(500, 500, undefined, false, true);
    expect(r).toMatchObject({ hp: 500, flinchConsumed: true, acts: false, fainted: false });
  });

  it("frozen → no act, status kept, note 'frozen'; thawed → status cleared", () => {
    const old = Math.random;
    Math.random = () => 0.9; // stay frozen
    expect(resolvePreAttack(500, 500, { kind: "freeze" }, false, false)).toMatchObject({
      acts: false,
      note: "frozen",
      status: { kind: "freeze" },
    });
    Math.random = () => 0.1; // thaw
    expect(resolvePreAttack(500, 500, { kind: "freeze" }, false, false)).toMatchObject({
      acts: false,
      note: "thawed",
      status: undefined,
    });
    Math.random = old;
  });

  it("residual runs BEFORE flinch — a mon can faint to poison even while flinched", () => {
    const r = resolvePreAttack(50, 1600, { kind: "toxic", toxicN: 15 }, false, true);
    expect(r).toMatchObject({ fainted: true, acts: false });
  });
});

describe("resolvePreAttack — equivalence with the pre-refactor inline sequence", () => {
  // Faithful re-implementation of what store.ts / league-store.ts used to inline.
  function inlineOld(
    hp: number,
    maxHp: number,
    status: StatusCondition | undefined,
    bleed: boolean,
    flinch: boolean,
  ) {
    let curHp = hp;
    let st = status;
    let took = false;
    if (st?.kind === "poison" || st?.kind === "toxic") {
      const r = tickResidual(curHp, maxHp, st);
      curHp = r.hp;
      st = r.status;
      if (r.lost > 0) took = true;
      if (curHp <= 0) return { hp: 0, status: st, took, acts: false, note: undefined, fainted: true, flinchConsumed: false };
    }
    if (bleed) {
      curHp = Math.max(0, curHp - bleedTick(maxHp));
      took = true;
      if (curHp <= 0) return { hp: 0, status: st, took, acts: false, note: undefined, fainted: true, flinchConsumed: false };
    }
    if (flinch) return { hp: curHp, status: st, took, acts: false, note: undefined, fainted: false, flinchConsumed: true };
    const a = canAct(st);
    return { hp: curHp, status: a.status, took, acts: a.ok, note: a.note, fainted: false, flinchConsumed: false };
  }

  it("matches on 40k randomised cases (same RNG draws)", () => {
    const statuses: (StatusCondition | undefined)[] = [
      undefined,
      { kind: "poison" },
      { kind: "toxic", toxicN: 4 },
      { kind: "freeze" },
      { kind: "paralyze" },
      { kind: "burn" },
    ];
    const realRandom = Math.random;
    let mismatches = 0;
    for (let t = 0; t < 40_000; t++) {
      const hp = 1 + Math.floor(realRandom() * 400);
      const maxHp = 40 + Math.floor(realRandom() * 500);
      const status = statuses[Math.floor(realRandom() * statuses.length)];
      const bleed = realRandom() < 0.5;
      const flinch = realRandom() < 0.4;
      const draws = [realRandom(), realRandom()];

      let i = 0;
      Math.random = () => draws[i++] ?? 0;
      const N = resolvePreAttack(hp, maxHp, status, bleed, flinch);
      i = 0;
      Math.random = () => draws[i++] ?? 0;
      const O = inlineOld(hp, maxHp, status, bleed, flinch);
      Math.random = realRandom;

      if (
        N.hp !== O.hp ||
        N.acts !== O.acts ||
        N.fainted !== O.fainted ||
        (N.note ?? null) !== (O.note ?? null) ||
        N.tookDamage !== O.took ||
        N.flinchConsumed !== O.flinchConsumed ||
        JSON.stringify(N.status) !== JSON.stringify(O.status)
      ) {
        mismatches++;
      }
    }
    expect(mismatches).toBe(0);
  });
});

describe("resolveOnHit — procs", () => {
  const water = mon(SPECIES.water);
  const steelWall = mon(SPECIES.steel);
  const groundWall = mon(SPECIES.ground);
  const plain = mon(SPECIES.normal);
  const N = 40_000;

  it("Steel recoil = floor(dmg * pct) only when the DEFENDER is Steel", () => {
    const defSyn = syn({ steelReturnPct: 0.08 });
    expect(resolveOnHit(NO_SYNERGY, defSyn, plain, steelWall, 200, 500, false).recoil).toBe(16);
    expect(resolveOnHit(NO_SYNERGY, defSyn, plain, plain, 200, 500, false).recoil).toBe(0);
    // no recoil on a 0-damage hit
    expect(resolveOnHit(NO_SYNERGY, defSyn, plain, steelWall, 0, 500, false).recoil).toBe(0);
  });

  it("Water self-heal fires ≈ chance for a Water attacker; amount = waterHeal(maxHp)", () => {
    const atkSyn = syn({ waterHealChance: 0.2 });
    const healed = rate(
      () => resolveOnHit(atkSyn, NO_SYNERGY, water, plain, 100, 800, false).selfHeal > 0,
      N,
    );
    expectRate(healed, 0.2, N);
    // when it does heal, it's the fixed amount
    const old = Math.random;
    Math.random = () => 0.0; // force the proc
    expect(resolveOnHit(atkSyn, NO_SYNERGY, water, plain, 100, 800, false).selfHeal).toBe(waterHeal(800));
    Math.random = old;
    // non-Water attacker never heals
    expect(rate(() => resolveOnHit(atkSyn, NO_SYNERGY, plain, plain, 100, 800, false).selfHeal > 0, 20_000)).toBe(0);
  });

  it("Ground bleed-on-attacker fires ≈ chance when defender is Ground and attacker isn't already bleeding", () => {
    const defSyn = syn({ groundBleedChance: 0.5 });
    const bled = rate(
      () => resolveOnHit(NO_SYNERGY, defSyn, plain, groundWall, 50, 400, false).bleedAttacker,
      N,
    );
    expectRate(bled, 0.5, N);
    // already bleeding → never re-triggers
    const bleeding: OwnedPoke = { ...plain, bleed: true };
    expect(
      rate(() => resolveOnHit(NO_SYNERGY, defSyn, bleeding, groundWall, 50, 400, false).bleedAttacker, 20_000),
    ).toBe(0);
    // non-Ground defender → never
    expect(
      rate(() => resolveOnHit(NO_SYNERGY, defSyn, plain, plain, 50, 400, false).bleedAttacker, 20_000),
    ).toBe(0);
  });

  it("inflict fields mirror a direct rollInflictions call (same RNG)", () => {
    const atkSyn = syn({ burnChance: 0.5, flinchChance: 0.3 });
    const realRandom = Math.random;
    for (let t = 0; t < 5_000; t++) {
      const draws = Array.from({ length: 6 }, () => realRandom());
      let i = 0;
      Math.random = () => draws[i++] ?? 0;
      // resolveOnHit consumes bleed + water rolls first (both 0-chance here → 0 draws), then rollInflictions
      const oh = resolveOnHit(atkSyn, NO_SYNERGY, mon(SPECIES.dark), plain, 100, 500, false);
      i = 0;
      Math.random = () => draws[i++] ?? 0;
      const direct = rollInflictions(atkSyn, mon(SPECIES.dark), plain, false);
      Math.random = realRandom;
      expect(oh.inflictFlinch).toBe(direct.flinch);
      expect(JSON.stringify(oh.inflictStatus)).toBe(JSON.stringify(direct.status));
    }
  });
});
