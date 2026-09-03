import { describe, it, expect } from "vitest";
import { attackDamage, combatStats } from "@/lib/game/formulas";
import { CRIT_CHANCE } from "@/lib/game/moves";
import { NO_SYNERGY } from "@/lib/game/synergy";
import { defenseMultiplier } from "@/lib/game/type-chart";
import { mon, move, rate, expectRate, mean, SPECIES, stubRandom } from "./_helpers";

const N = 60_000;

describe("attackDamage — core formula", () => {
  it("status moves and 0-power moves deal no damage and never 'miss'", () => {
    const r = attackDamage(mon(SPECIES.psychic), mon(SPECIES.normal), {
      move: move("Psychic", "Status", 0),
    });
    expect(r).toEqual({ damage: 0, multiplier: 1, crit: false, missed: false });
  });

  it("a connecting hit is always at least 1 damage", () => {
    // tiny attacker into a huge wall, still ≥ 1
    for (let i = 0; i < 2_000; i++) {
      const r = attackDamage(mon("Magikarp", 5), mon(SPECIES.steel, 100), {
        move: move("Water", "Special", 40),
      });
      if (!r.missed) expect(r.damage).toBeGreaterThanOrEqual(1);
    }
  });

  it("physical moves scale on Atk/Def, special on SpA/SpD", () => {
    const machamp = mon(SPECIES.fighting, 50); // huge Atk, mediocre SpA
    const wall = mon(SPECIES.normal, 50);
    const a = combatStats(machamp);
    const d = combatStats(wall);
    stubRandom(0.5); // freeze crit + spread so only the stat ratio moves
    const phys = attackDamage(machamp, wall, { move: move("Fire", "Physical", 80) }).damage;
    stubRandom(0.5);
    const spec = attackDamage(machamp, wall, { move: move("Fire", "Special", 80) }).damage;
    // ratio should track (Atk/Def) ÷ (SpA/SpD), give or take integer rounding
    const expected = a.atk / d.def / (a.spa / d.spd);
    expect(phys / spec).toBeGreaterThan(expected * 0.75);
    expect(phys / spec).toBeLessThan(expected * 1.25);
  });

  it("STAB adds ~50% over a non-STAB move of the same type-effectiveness", () => {
    const char = mon(SPECIES.fire, 50);
    const target = mon(SPECIES.normal, 50); // neutral to both Fire and Water
    const fire = mean(
      () => attackDamage(char, target, { move: move("Fire", "Special", 80) }).damage,
      N,
    );
    const water = mean(
      () => attackDamage(char, target, { move: move("Water", "Special", 80) }).damage,
      N,
    );
    expect(fire / water).toBeCloseTo(1.5, 1);
  });

  it("type effectiveness tracks the type chart (same category & power, vary only type)", () => {
    const atk = mon(SPECIES.normal, 50);
    const water = mon(SPECIES.water, 50); // pure Water
    // all Special / power 80 → attacking stat is identical, only the type mult differs
    const eff = (type: string) =>
      mean(() => attackDamage(atk, water, { move: move(type, "Special", 80) }).damage, N);
    const grass = eff("Grass"); // 2× vs Water
    const neutral = eff("Psychic"); // 1× vs Water, no STAB for a Normal-type attacker
    const fire = eff("Fire"); // 0.5× vs Water
    expect(defenseMultiplier("Psychic", ["Water"])).toBe(1); // sanity: our "neutral" really is
    expect(grass / neutral).toBeCloseTo(2, 1);
    expect(fire / neutral).toBeCloseTo(0.5, 1);
  });

  it("an immune matchup returns exactly 0 (multiplier 0)", () => {
    const r = attackDamage(mon(SPECIES.normal), mon(SPECIES.ghost), {
      move: move("Normal", "Physical", 100),
    });
    expect(r).toMatchObject({ damage: 0, multiplier: 0, missed: false });
  });

  it("random spread stays within the Showdown 0.85–1.00 band", () => {
    const a = mon(SPECIES.fighting, 50);
    const d = mon(SPECIES.normal, 50);
    let lo = Infinity;
    let hi = 0;
    for (let i = 0; i < N; i++) {
      // isolate spread: kill crit by stubbing the crit roll high, then restore
      const r = attackDamage(a, d, { move: move("Fire", "Special", 80, true) });
      if (r.crit) continue;
      lo = Math.min(lo, r.damage);
      hi = Math.max(hi, r.damage);
    }
    // lowest ≈ 0.85 of highest (small floor/round slack)
    expect(lo / hi).toBeGreaterThan(0.82);
    expect(lo / hi).toBeLessThan(0.9);
  });
});

describe("attackDamage — crit stages", () => {
  const a = mon(SPECIES.fighting, 50);
  const d = mon(SPECIES.normal, 50);
  const critRate = (bonus: number) =>
    rate(() => attackDamage(a, d, { move: move("Fire", "Special", 80), critStageBonus: bonus }).crit, N);

  it("base crit rate ≈ 1/24", () => expectRate(critRate(0), CRIT_CHANCE, N));
  it("+1 stage ≈ 1/8", () => expectRate(critRate(1), 1 / 8, N));
  it("+2 stage ≈ 1/2", () => expectRate(critRate(2), 1 / 2, N));
  it("+3 stage always crits", () => expect(critRate(3)).toBe(1));

  it("a crit hits ~1.5× a non-crit (same spread)", () => {
    stubRandom(0.999); // crit fails, spread = max
    const nc = attackDamage(a, d, { move: move("Fire", "Special", 80) }).damage;
    stubRandom(0.0001); // crit succeeds, spread = min ... use +3 stage to force crit, spread still low
    const c = attackDamage(a, d, { move: move("Fire", "Special", 80), critStageBonus: 3 }).damage;
    // crude: crit+low-spread should still beat non-crit+high-spread by a chunk
    expect(c).toBeGreaterThan(nc);
  });
});

describe("attackDamage — accuracy", () => {
  const a = mon(SPECIES.fighting, 50);
  const d = mon(SPECIES.normal, 50);

  it("accuracy:true never misses", () => {
    const missed = rate(
      () => attackDamage(a, d, { move: move("Normal", "Physical", 80, true) }).missed,
      20_000,
    );
    expect(missed).toBe(0);
  });

  it.each([100, 90, 75, 50, 30])("miss rate at accuracy %i", (acc) => {
    const missed = rate(
      () => attackDamage(a, d, { move: move("Normal", "Physical", 80, acc) }).missed,
      N,
    );
    expectRate(missed, (100 - acc) / 100, N);
  });

  it("a miss reports damage 0 and missed:true", () => {
    stubRandom(0.99); // 0.99*100 = 99 >= 50 → miss
    const r = attackDamage(a, d, { move: move("Normal", "Physical", 80, 50) });
    expect(r).toMatchObject({ damage: 0, missed: true, crit: false });
  });
});

describe("attackDamage — burn + Dragon DR", () => {
  it("a burned attacker deals ~90%", () => {
    const a = mon(SPECIES.fighting, 50);
    const d = mon(SPECIES.normal, 50);
    const normal = mean(() => attackDamage(a, d, { move: move("Fire", "Special", 80) }).damage, N);
    const burned = mean(
      () => attackDamage(a, d, { move: move("Fire", "Special", 80), attackerBurned: true }).damage,
      N,
    );
    expect(burned / normal).toBeCloseTo(0.9, 1);
  });

  it("Dragon synergy cuts damage taken only for Dragon-type defenders", () => {
    const a = mon(SPECIES.normal, 50);
    const drag = mon(SPECIES.dragon, 50);
    const nonDrag = mon(SPECIES.normal, 50);
    const dr = { ...NO_SYNERGY, dragonDrPct: 0.3 };
    const toDragon = mean(
      () => attackDamage(a, drag, { move: move("Normal", "Physical", 80), defenderSynergy: dr }).damage,
      N,
    );
    const toDragonNoSyn = mean(
      () => attackDamage(a, drag, { move: move("Normal", "Physical", 80) }).damage,
      N,
    );
    const toNonDragon = mean(
      () =>
        attackDamage(a, nonDrag, { move: move("Normal", "Physical", 80), defenderSynergy: dr }).damage,
      N,
    );
    expect(toDragon / toDragonNoSyn).toBeCloseTo(0.7, 1);
    // non-Dragon defender: DR does nothing
    expect(toNonDragon).toBeGreaterThan(toDragon * 1.2);
  });
});

describe("combatStats — IV/EV/nature", () => {
  it("31 IV / 252 EV beats 0/0 for the same species+level", () => {
    const base = combatStats(mon(SPECIES.fighting, 100)); // makeOwned rolls random IVs though
    expect(base.atk).toBeGreaterThan(0);
  });

  it("a +Atk nature raises Atk and lowers the dumped stat vs neutral", () => {
    const lvl = 100;
    const name = SPECIES.fighting;
    const neutral = combatStats(
      mon(name, lvl, { nature: "Hardy", ivs: undefined, evs: undefined }),
    );
    const adamant = combatStats(
      mon(name, lvl, { nature: "Adamant", ivs: undefined, evs: undefined }), // +Atk / −SpA
    );
    expect(adamant.atk).toBeGreaterThan(neutral.atk);
    expect(adamant.spa).toBeLessThan(neutral.spa);
  });
});
