import { describe, it, expect } from "vitest";
import {
  moveHits,
  maxMovePower,
  toMaxMove,
  toGMaxMove,
  MOVES,
  getMove,
} from "@/lib/game/moves";
import { rate, expectRate, move } from "./_helpers";

const N = 60_000;

describe("moveHits — Showdown accuracy check", () => {
  it("accuracy:true always lands", () => {
    expect(rate(() => moveHits(true), 20_000)).toBe(1);
  });

  it.each([100, 95, 85, 70, 50, 30])("land rate at accuracy %i", (acc) => {
    expectRate(rate(() => moveHits(acc), N), acc / 100, N);
  });

  it("accuracy 100 never misses (roll is 0–99 < 100)", () => {
    expect(rate(() => moveHits(100), 50_000)).toBe(1);
  });
});

describe("moves.json data integrity", () => {
  it("every move has a valid type/category/power/accuracy", () => {
    for (const [name, m] of Object.entries(MOVES)) {
      expect(m.name, name).toBe(name);
      expect(["Physical", "Special", "Status"]).toContain(m.category);
      expect(m.power, name).toBeGreaterThanOrEqual(0);
      expect(m.accuracy === true || (m.accuracy > 0 && m.accuracy <= 100), name).toBe(true);
      if (m.category === "Status") expect(m.power, name).toBe(0);
    }
  });

  it("a few known Showdown accuracy values are intact", () => {
    expect(getMove("Tackle")?.accuracy).toBe(100);
    expect(getMove("Swift")?.accuracy).toBe(true);
    expect(getMove("Thunder")?.accuracy).toBe(70);
    expect(getMove("Fissure")?.accuracy).toBe(30);
    expect(getMove("Fire Blast")?.accuracy).toBe(85);
  });
});

describe("Max / G-Max move conversion", () => {
  it("maxMovePower follows the Gen-8 table (Fighting/Poison weaker)", () => {
    expect(maxMovePower(40, "Normal")).toBe(90);
    expect(maxMovePower(70, "Normal")).toBe(120);
    expect(maxMovePower(71, "Normal")).toBe(130);
    expect(maxMovePower(140, "Normal")).toBe(140);
    expect(maxMovePower(250, "Normal")).toBe(150);
    expect(maxMovePower(40, "Fighting")).toBe(70);
    expect(maxMovePower(250, "Poison")).toBe(100);
  });

  it("toMaxMove keeps type/category, upgrades power, and never misses", () => {
    const m = toMaxMove(move("Fire", "Special", 90));
    expect(m).toMatchObject({ type: "Fire", category: "Special", accuracy: true });
    expect(m.power).toBe(maxMovePower(90, "Fire"));
  });

  it("a status move becomes Max Guard (0 power, never misses)", () => {
    expect(toMaxMove(move("Normal", "Status", 0))).toMatchObject({
      name: "Max Guard",
      power: 0,
      accuracy: true,
    });
  });

  it("toGMaxMove swaps in the signature move for the matching type only", () => {
    const sig = toGMaxMove(move("Fire", "Special", 90), "Gigantamax Charizard");
    expect(sig.name).toBe("G-Max Wildfire");
    // off-type move on the same species falls back to the regular Max move
    const offType = toGMaxMove(move("Flying", "Physical", 90), "Gigantamax Charizard");
    expect(offType.name).not.toBe("G-Max Wildfire");
  });
});
