import { describe, it, expect } from "vitest";
import { attacksPerSecond, attackIntervalMs } from "@/lib/game/formulas";

describe("attacksPerSecond — Speed → attack rate judge", () => {
  it("is clamped to [1, 4]", () => {
    expect(attacksPerSecond(0)).toBe(1);
    expect(attacksPerSecond(1)).toBe(1);
    expect(attacksPerSecond(4)).toBeCloseTo(1, 5);
    expect(attacksPerSecond(999_999)).toBe(4);
    expect(attacksPerSecond(-50)).toBe(1);
  });

  it("is monotonically non-decreasing in Speed", () => {
    let prev = 0;
    for (let spe = 1; spe <= 4000; spe += 17) {
      const aps = attacksPerSecond(spe);
      expect(aps).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = aps;
    }
  });

  it("hits the intended reference points (gentle curve)", () => {
    // documented in formulas.ts: Spe 34 ≈ 1.9, 100 ≈ 2.4, 500 ≈ 3.1
    expect(attacksPerSecond(34)).toBeGreaterThan(1.6);
    expect(attacksPerSecond(34)).toBeLessThan(2.2);
    expect(attacksPerSecond(100)).toBeGreaterThan(2.1);
    expect(attacksPerSecond(100)).toBeLessThan(2.7);
    expect(attacksPerSecond(500)).toBeGreaterThan(2.8);
    expect(attacksPerSecond(500)).toBeLessThan(3.4);
  });
});

describe("attackIntervalMs", () => {
  it("is exactly 1000 / attacksPerSecond", () => {
    for (const spe of [1, 10, 50, 200, 800, 4000]) {
      expect(attackIntervalMs(spe)).toBeCloseTo(1000 / attacksPerSecond(spe), 6);
    }
  });

  it("stays within [250, 1000] ms (the 4/s and 1/s bounds)", () => {
    for (let spe = 1; spe <= 5000; spe += 23) {
      const ms = attackIntervalMs(spe);
      expect(ms).toBeGreaterThanOrEqual(250 - 1e-6);
      expect(ms).toBeLessThanOrEqual(1000 + 1e-6);
    }
  });
});
