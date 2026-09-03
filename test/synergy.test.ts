import { describe, it, expect } from "vitest";
import {
  synergyFromCounts,
  synergyTier,
  nextTierNeed,
  encounterSynergy,
  SYNERGY_THRESHOLDS,
  isStellar,
  stellarActive,
  NO_SYNERGY,
} from "@/lib/game/synergy";
import { mon, SPECIES } from "./_helpers";

const num = (s: object, field: string) => (s as Record<string, number>)[field];

/** [type] → the exact synergy field + expected value at each tier. */
const TIER_VALUES: Record<string, { field: string; vals: [number, number, number] }> = {
  Flying: { field: "speFlat", vals: [10, 15, 25] },
  Fighting: { field: "atkFlat", vals: [20, 30, 40] },
  Psychic: { field: "spaFlat", vals: [20, 30, 40] },
  Normal: { field: "hpPct", vals: [0.1, 0.2, 0.3] },
  Rock: { field: "defFlat", vals: [15, 30, 45] },
  Bug: { field: "critStage", vals: [1, 2, 3] },
  Fairy: { field: "enemySpeFlat", vals: [15, 20, 30] },
  Dragon: { field: "dragonDrPct", vals: [0.1, 0.2, 0.3] },
  Steel: { field: "steelReturnPct", vals: [0.04, 0.06, 0.08] },
  Water: { field: "waterHealChance", vals: [0.05, 0.1, 0.2] },
  Ground: { field: "groundBleedChance", vals: [0.25, 0.5, 1] },
  Ice: { field: "freezeChance", vals: [0.05, 0.08, 0.12] },
  Poison: { field: "poisonChance", vals: [0.2, 0.4, 0.5] },
  Dark: { field: "flinchChance", vals: [0.04, 0.08, 0.16] },
  Fire: { field: "burnChance", vals: [0.1, 0.15, 0.2] },
  Ghost: { field: "ghostFirstChance", vals: [0.2, 0.4, 0.6] },
};

describe("synergyFromCounts — tier thresholds", () => {
  it("no mons of a type → that synergy stays at its NO_SYNERGY value", () => {
    const s = synergyFromCounts({});
    expect(s).toEqual(NO_SYNERGY);
  });

  for (const [type, { field, vals }] of Object.entries(TIER_VALUES)) {
    it(`${type}: tiers activate at ${SYNERGY_THRESHOLDS[type].join(" / ")}`, () => {
      const [t1, t2, t3] = SYNERGY_THRESHOLDS[type];
      // one below tier 1 → still zero/default
      if (t1 > 1) expect(num(synergyFromCounts({ [type]: t1 - 1 }), field)).toBe(num(NO_SYNERGY, field));
      expect(num(synergyFromCounts({ [type]: t1 }), field)).toBeCloseTo(vals[0], 10);
      expect(num(synergyFromCounts({ [type]: t2 }), field)).toBeCloseTo(vals[1], 10);
      expect(num(synergyFromCounts({ [type]: t3 }), field)).toBeCloseTo(vals[2], 10);
      // well past the top → stays at tier 3
      expect(num(synergyFromCounts({ [type]: t3 + 5 }), field)).toBeCloseTo(vals[2], 10);
    });
  }

  it("Electric paralyze needs 3 and is binary (30% or nothing)", () => {
    expect(synergyFromCounts({ Electric: 2 }).paralyzeChance).toBe(0);
    expect(synergyFromCounts({ Electric: 3 }).paralyzeChance).toBe(0.3);
    expect(synergyFromCounts({ Electric: 6 }).paralyzeChance).toBe(0.3);
  });

  it("Grass cleanse needs 1 and is binary (25%)", () => {
    expect(synergyFromCounts({ Grass: 0 }).grassCleanseChance).toBe(0);
    expect(synergyFromCounts({ Grass: 1 }).grassCleanseChance).toBe(0.25);
  });

  it("Poison tier 3 flips to toxic", () => {
    expect(synergyFromCounts({ Poison: 2 }).poisonIsToxic).toBe(false);
    expect(synergyFromCounts({ Poison: 6 }).poisonIsToxic).toBe(true);
  });

  it("Rock buffs Def AND SpD equally", () => {
    const s = synergyFromCounts({ Rock: 4 });
    expect(s.defFlat).toBe(45);
    expect(s.spdFlat).toBe(45);
  });
});

describe("synergyTier / nextTierNeed", () => {
  it("tier is 0/1/2/3 by threshold", () => {
    expect(synergyTier("Rock", 0)).toBe(0);
    expect(synergyTier("Rock", 1)).toBe(1);
    expect(synergyTier("Rock", 3)).toBe(2);
    expect(synergyTier("Rock", 4)).toBe(3);
    expect(synergyTier("Rock", 9)).toBe(3);
  });

  it("nextTierNeed counts mons to the next threshold, null when maxed", () => {
    expect(nextTierNeed("Fire", 0)).toBe(1); // → tier 1
    expect(nextTierNeed("Fire", 1)).toBe(1); // → tier 2 (needs 2)
    expect(nextTierNeed("Fire", 2)).toBe(1); // → tier 3 (needs 3)
    expect(nextTierNeed("Fire", 3)).toBeNull();
    expect(nextTierNeed("Electric", 0)).toBe(3);
    expect(nextTierNeed("Electric", 3)).toBeNull();
  });
});

describe("encounterSynergy — wild rules", () => {
  it("an anomaly gets tier 1 of EVERY one of its typings", () => {
    // pretend Charizard (Fire/Flying) is an anomaly
    const s = encounterSynergy(mon(SPECIES.fire), true);
    expect(s.burnChance).toBe(0.1); // Fire tier 1
    expect(s.speFlat).toBe(10); // Flying tier 1 (needs 2 normally, forced here)
  });

  it("a normal encounter only activates synergies whose tier 1 needs a single mon", () => {
    // Rhydon = Ground/Rock; both tier-1 thresholds are 1 → both fire
    const rhydon = encounterSynergy(mon(SPECIES.ground), false);
    expect(rhydon.groundBleedChance).toBe(0.25);
    expect(rhydon.defFlat).toBe(15);

    // Pidgeot = Normal/Flying; Normal needs 4, Flying needs 2 → nothing
    const pidgeot = encounterSynergy(mon(SPECIES.flying), false);
    expect(pidgeot).toEqual(NO_SYNERGY);
  });

  it("a normal Electric encounter never gets paralyze (needs 3)", () => {
    expect(encounterSynergy(mon(SPECIES.electric), false).paralyzeChance).toBe(0);
    expect(encounterSynergy(mon(SPECIES.electric), true).paralyzeChance).toBe(0.3);
  });
});

describe("Stellar", () => {
  it("isStellar is true only for Terapagos-Stellar", () => {
    expect(isStellar(mon("Terapagos-Stellar"))).toBe(true);
    expect(isStellar(mon(SPECIES.psychic))).toBe(false);
    expect(isStellar(undefined)).toBe(false);
  });

  it("stellarActive triggers when either side's active mon is Stellar", () => {
    const stellar = mon("Terapagos-Stellar");
    const other = mon(SPECIES.normal);
    expect(stellarActive(stellar, other)).toBe(true);
    expect(stellarActive(other, stellar)).toBe(true);
    expect(stellarActive(other, other)).toBe(false);
  });
});
