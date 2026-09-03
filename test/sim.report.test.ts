import { describe, it, expect } from "vitest";
import { synergyFromCounts } from "@/lib/game/synergy";
import { attacksPerSecond, combatStats } from "@/lib/game/formulas";
import { mon } from "./_helpers";
import { simulate, type Aggregate, type Side } from "./_sim";

// A balancing dashboard, not a strict test. It prints tables and only asserts
// loose / directional bounds. Run just this file:
//     npm run sim
// Tweak a constant in src/lib/game/*, re-run, diff the numbers.

const RUNS = 1500;
const f = (n: number, d = 1) => n.toFixed(d).padStart(6);
const pct = (n: number) => `${(n * 100).toFixed(1)}%`.padStart(6);

/** fresh-mon factory (rolls new IVs/nature each fight) */
const P = (name: string, lvl: number, synergy?: Record<string, number>) => (): Side => ({
  poke: mon(name, lvl),
  synergy: synergy ? synergyFromCounts(synergy) : undefined,
});

function line(label: string, a: Aggregate) {
  return (
    "   " +
    [
      label.padEnd(24),
      `win ${pct(a.winA)}`,
      `${f(a.seconds)}s`,
      `dmg/hit ${f(a.aDmgPerHit)}`,
      `A-hits ${f(a.aHitsToKill)}`,
      `crit ${pct(a.aCritRate)}`,
      `miss ${pct(a.aMissRate)}`,
      a.aLostTurns > 0.05 ? `lostT ${f(a.aLostTurns, 2)}` : "",
      a.timeouts > 0.01 ? `TIMEOUT ${pct(a.timeouts)}` : "",
    ]
      .filter(Boolean)
      .join("  ")
  );
}

describe("SIM · level pacing (mirror, no synergy)", () => {
  it("fight length across the level curve", () => {
    console.log("\n  same species both sides, same level, no synergy — expect win ≈ 50%\n");
    for (const name of ["Pidgeot", "Charizard", "Dragonite", "Snorlax"]) {
      console.log(`  ${name}`);
      for (const lvl of [10, 25, 50, 75, 100]) {
        const a = simulate(P(name, lvl), P(name, lvl), RUNS);
        console.log(line(`Lv.${lvl}`, a));
        expect(a.winA).toBeGreaterThan(0.4); // mirror ≈ coin flip
        expect(a.winA).toBeLessThan(0.6);
        expect(a.timeouts).toBeLessThan(0.02); // no stalemates
      }
      console.log("");
    }
  });
});

describe("SIM · full-team stat synergies", () => {
  it("A = Charizard Lv.50 + <synergy tier> · B = plain Charizard Lv.50", () => {
    console.log("");
    const base = () => ({ poke: mon("Charizard", 50) });
    const cases: [string, Record<string, number>][] = [
      ["baseline (x0)", {}],
      ["Fighting x1 (3)", { Fighting: 3 }],
      ["Fighting x2 (4)", { Fighting: 4 }],
      ["Fighting x3 (5)", { Fighting: 5 }],
      ["Psychic x3 (5)", { Psychic: 5 }],
      ["Flying x3 (5)", { Flying: 5 }],
      ["Rock x3 (4)", { Rock: 4 }],
      ["Bug x3 (4)", { Bug: 4 }],
    ];
    const results = cases.map(([label, counts]) => {
      const a = simulate(() => ({ poke: mon("Charizard", 50), synergy: synergyFromCounts(counts) }), base, RUNS);
      console.log(line(label, a));
      return { label, a };
    });
    const t0 = results[0].a; // baseline
    const t1 = results[1].a; // Fighting x1
    const t3 = results[3].a; // Fighting x3
    // directional sanity only — the actual win% is what you eyeball for balance.
    expect(t0.winA).toBeGreaterThan(0.4); // baseline mirror ≈ coin flip
    expect(t0.winA).toBeLessThan(0.6);
    expect(t1.winA).toBeGreaterThan(t0.winA); // any tier helps
    expect(t3.winA).toBeGreaterThan(t1.winA - 0.02); // and scales up (allow noise)
    expect(t3.seconds).toBeLessThan(t0.seconds); // more Atk → faster kill
  });
});

describe("SIM · proc synergies", () => {
  it("burn / steel recoil / ground bleed / water lifesteal / dark flinch (Lv.50)", () => {
    console.log("\n  A carries the proc synergy vs a plain B\n");
    const rows: [string, () => Side, () => Side][] = [
      ["Fire burn x3 (20%)", P("Pikachu", 50, { Fire: 3 }), P("Pikachu", 50)],
      ["  vs baseline", P("Pikachu", 50), P("Pikachu", 50)],
      ["Steel recoil x3 (8%)", P("Steelix", 50, { Steel: 3 }), P("Machamp", 50)],
      ["  vs baseline", P("Steelix", 50), P("Machamp", 50)],
      ["Ground bleed x3 (B holds)", P("Machamp", 50), P("Rhydon", 50, { Ground: 4 })],
      ["  vs baseline", P("Machamp", 50), P("Rhydon", 50)],
      ["Water lifesteal x3 (20%)", P("Blastoise", 50, { Water: 4 }), P("Blastoise", 50)],
      ["  vs baseline", P("Blastoise", 50), P("Blastoise", 50)],
      ["Dark flinch x3 (16%)", P("Umbreon", 50, { Dark: 3 }), P("Umbreon", 50)],
      ["  vs baseline", P("Umbreon", 50), P("Umbreon", 50)],
    ];
    for (const [label, a, b] of rows) console.log(line(label, simulate(a, b, RUNS)));
    expect(true).toBe(true);
  });
});

describe("SIM · cross-species power (Lv.50, dmg/hit & A-hits-to-KO)", () => {
  it("attacker rows vs defender columns", () => {
    const atk = ["Magikarp", "Pidgeot", "Charizard", "Alakazam", "Machamp", "Dragonite"];
    const def = ["Snorlax", "Steelix", "Blastoise"];
    console.log("\n  cell = dmg/hit (A-hits over the fight)   attacker → defender, best learnable move\n");
    console.log("   " + "".padEnd(11) + def.map((d) => d.padStart(18)).join(""));
    for (const A of atk) {
      const cells = def.map((D) => {
        const s = simulate(P(A, 50), P(D, 50), 700);
        return `${s.aDmgPerHit.toFixed(0)} (${s.aHitsToKill.toFixed(1)})`.padStart(18);
      });
      console.log("   " + A.padEnd(11) + cells.join(""));
    }
    const weak = simulate(P("Magikarp", 50), P("Snorlax", 50), 700);
    const strong = simulate(P("Dragonite", 50), P("Blastoise", 50), 700);
    expect(weak.aDmgPerHit).toBeLessThan(strong.aDmgPerHit);
  });
});

describe("SIM · reference stat lines", () => {
  it("maxHp / stats / atk-per-second at Lv.50 & 100", () => {
    console.log("\n  species        Lv    HP    Atk   SpA   Def   SpD   Spe  atk/s\n");
    for (const name of ["Magikarp", "Pidgeot", "Charizard", "Snorlax", "Steelix", "Dragonite", "Alakazam"]) {
      for (const lvl of [50, 100]) {
        const s = combatStats(mon(name, lvl));
        console.log(
          `   ${name.padEnd(13)} ${String(lvl).padStart(3)} ${String(s.maxHp).padStart(6)} ` +
            `${String(s.atk).padStart(5)} ${String(s.spa).padStart(5)} ${String(s.def).padStart(5)} ` +
            `${String(s.spd).padStart(5)} ${String(s.spe).padStart(5)} ${attacksPerSecond(s.spe).toFixed(2).padStart(5)}`,
        );
      }
    }
    expect(true).toBe(true);
  });
});
