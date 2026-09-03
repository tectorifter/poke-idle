import { describe, it, expect } from "vitest";
import {
  catchProbability,
  catchChance,
  ballBonus,
  effectiveBallLevel,
  MANUAL_CATCH_BONUS,
  CATCH_TIER_ORDER,
  BALL_BONUS_MAX,
} from "@/lib/game/formulas";

describe("catchProbability — linear a/255", () => {
  it("a ≥ 255 is a guaranteed catch, a ≤ 0 is impossible", () => {
    expect(catchProbability(255)).toBe(1);
    expect(catchProbability(9999)).toBe(1);
    expect(catchProbability(0)).toBe(0);
    expect(catchProbability(-10)).toBe(0);
  });

  it("scales linearly between", () => {
    expect(catchProbability(127.5)).toBeCloseTo(0.5, 5);
    expect(catchProbability(51)).toBeCloseTo(0.2, 5);
    for (let a = 1; a < 255; a += 7) {
      expect(catchProbability(a)).toBeCloseTo(a / 255, 6);
    }
  });
});

describe("ballBonus — tier/level ramp", () => {
  it("each non-final tier's Lv.10 nearly reaches the next tier's Lv.1", () => {
    for (let i = 0; i < CATCH_TIER_ORDER.length - 1; i++) {
      const here = CATCH_TIER_ORDER[i];
      const next = CATCH_TIER_ORDER[i + 1];
      // Lv.10 is 9/10 of the way from this tier's base to the next tier's base.
      expect(ballBonus(here, 10)).toBeGreaterThan(ballBonus(here, 1));
      expect(ballBonus(here, 10)).toBeLessThanOrEqual(ballBonus(next, 1) + 1e-6);
      expect(ballBonus(here, 10)).toBeGreaterThan(ballBonus(next, 1) * 0.9 - 1e-6);
    }
  });

  it("Timer Ball Lv.10 lands exactly on the ×4 cap", () => {
    expect(ballBonus("timerball", 10)).toBeCloseTo(BALL_BONUS_MAX, 3);
  });

  it("is strictly increasing across the whole track", () => {
    let prev = 0;
    for (const tier of CATCH_TIER_ORDER) {
      for (let lvl = 1; lvl <= 10; lvl++) {
        const b = ballBonus(tier, lvl);
        expect(b).toBeGreaterThanOrEqual(prev - 1e-9);
        prev = b;
      }
    }
  });
});

describe("effectiveBallLevel", () => {
  it("lower tiers max out, current tier uses current level, higher tiers lock", () => {
    expect(effectiveBallLevel("pokeball", "ultraball", 3)).toBe(10);
    expect(effectiveBallLevel("ultraball", "ultraball", 4)).toBe(4);
    expect(effectiveBallLevel("timerball", "ultraball", 4)).toBe(0);
  });
});

describe("catchChance — full formula", () => {
  const rate = 45;

  it("returns 0 for a locked ball tier", () => {
    expect(catchChance(rate, "timerball", "pokeball", 5)).toBe(0);
  });

  it("a fainted target (hpFrac 0) is easier than a full-HP one", () => {
    const fainted = catchChance(rate, "pokeball", "pokeball", 5, 0);
    const full = catchChance(rate, "pokeball", "pokeball", 5, 1);
    expect(fainted).toBeGreaterThan(full);
  });

  it("the manual aim bonus multiplies `a` by 1.5", () => {
    const auto = catchChance(rate, "greatball", "greatball", 5, 0.5, false);
    const manual = catchChance(rate, "greatball", "greatball", 5, 0.5, true);
    // below the guaranteed cap the ratio is exactly the bonus
    if (auto < 1 && manual < 1) expect(manual / auto).toBeCloseTo(MANUAL_CATCH_BONUS, 3);
    else expect(manual).toBeGreaterThanOrEqual(auto);
  });

  it("a better ball tier never lowers the chance", () => {
    let prev = -1;
    for (const tier of CATCH_TIER_ORDER) {
      const c = catchChance(rate, tier, "timerball", 10, 0.3);
      expect(c).toBeGreaterThanOrEqual(prev);
      prev = c;
    }
  });

  it("catch rate is floored at 1 (rate 0 still yields a positive chance)", () => {
    expect(catchChance(0, "pokeball", "pokeball", 10, 0)).toBeGreaterThan(0);
  });
});
