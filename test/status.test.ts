import { describe, it, expect } from "vitest";
import {
  tickResidual,
  canAct,
  rollInflictions,
  NO_SYNERGY,
  THAW_CHANCE,
  FULL_PARA_CHANCE,
} from "@/lib/game/synergy";
import type { TeamSynergy } from "@/lib/game/synergy";
import type { StatusCondition } from "@/lib/game/types";
import { mon, rate, expectRate, SPECIES } from "./_helpers";

const N = 60_000;
const syn = (o: Partial<TeamSynergy>): TeamSynergy => ({ ...NO_SYNERGY, ...o });

describe("tickResidual — poison / toxic DoT", () => {
  it("regular poison is a flat 1/8 max HP (min 1)", () => {
    expect(tickResidual(1000, 800, { kind: "poison" }).lost).toBe(100);
    expect(tickResidual(1000, 3, { kind: "poison" }).lost).toBe(1); // floor(3/8)=0 → min 1
    expect(tickResidual(1000, 800, { kind: "poison" }).status).toEqual({ kind: "poison" });
  });

  it("toxic escalates n/16 max HP each tick and bumps the counter", () => {
    let hp = 1600;
    let st: StatusCondition | undefined = { kind: "toxic", toxicN: 1 };
    const losses: number[] = [];
    for (let t = 0; t < 6; t++) {
      const r = tickResidual(hp, 1600, st);
      losses.push(r.lost);
      hp = r.hp;
      st = r.status;
    }
    expect(losses).toEqual([100, 200, 300, 400, 500, 600]); // 1..6 × (1600/16)
    expect(st).toEqual({ kind: "toxic", toxicN: 7 });
  });

  it("toxic counter caps at 15", () => {
    let st: StatusCondition | undefined = { kind: "toxic", toxicN: 14 };
    st = tickResidual(9999, 1600, st).status;
    expect(st).toEqual({ kind: "toxic", toxicN: 15 });
    st = tickResidual(9999, 1600, st).status;
    expect(st).toEqual({ kind: "toxic", toxicN: 15 }); // clamped
  });

  it("non-DoT statuses lose nothing", () => {
    for (const kind of ["burn", "paralyze", "freeze"] as const) {
      expect(tickResidual(500, 400, { kind }).lost).toBe(0);
    }
    expect(tickResidual(500, 400, undefined).lost).toBe(0);
  });

  it("residual never drives HP below 0", () => {
    expect(tickResidual(10, 800, { kind: "toxic", toxicN: 15 }).hp).toBe(0);
  });
});

describe("canAct — freeze / paralyze", () => {
  it("freeze thaws ≈ 50% of turns (thaw clears the status, turn still lost)", () => {
    const thawed = rate(() => canAct({ kind: "freeze" }).note === "thawed", N);
    expectRate(thawed, THAW_CHANCE, N);
    // whether it thaws or not, a frozen mon never acts
    for (let i = 0; i < 5_000; i++) expect(canAct({ kind: "freeze" }).ok).toBe(false);
  });

  it("a thawed mon has its status cleared; a still-frozen mon keeps it", () => {
    // force thaw
    const oldR = Math.random;
    Math.random = () => 0.1;
    expect(canAct({ kind: "freeze" })).toMatchObject({ ok: false, status: undefined, note: "thawed" });
    Math.random = () => 0.9;
    expect(canAct({ kind: "freeze" })).toMatchObject({
      ok: false,
      status: { kind: "freeze" },
      note: "frozen",
    });
    Math.random = oldR;
  });

  it("paralysis full-stops ≈ 25% of turns", () => {
    const stopped = rate(() => !canAct({ kind: "paralyze" }).ok, N);
    expectRate(stopped, FULL_PARA_CHANCE, N);
  });

  it("no status → always acts, nothing cleared", () => {
    expect(canAct(undefined)).toEqual({ ok: true, status: undefined });
    expect(canAct({ kind: "burn" })).toEqual({ ok: true, status: { kind: "burn" } });
  });
});

describe("rollInflictions — synergy status procs", () => {
  const ice = mon(SPECIES.ice); // Ice/Flying
  const fireMon = mon(SPECIES.fire);
  const poisonMon = mon(SPECIES.poison);
  const elec = mon(SPECIES.electric);
  const dark = mon(SPECIES.dark);
  const neutralTarget = mon(SPECIES.normal); // immune to none of the statuses

  it("Dark flinch fires ≈ flinchChance and only from a Dark attacker", () => {
    const s = syn({ flinchChance: 0.16 });
    expectRate(rate(() => rollInflictions(s, dark, neutralTarget, false).flinch, N), 0.16, N);
    expect(rate(() => rollInflictions(s, fireMon, neutralTarget, false).flinch, 20_000)).toBe(0);
  });

  it("Ice freezes ≈ freezeChance from an Ice attacker; not from others", () => {
    const s = syn({ freezeChance: 0.12 });
    const froze = rate(() => rollInflictions(s, ice, neutralTarget, false).status?.kind === "freeze", N);
    expectRate(froze, 0.12, N);
    expect(
      rate(() => rollInflictions(s, fireMon, neutralTarget, false).status?.kind === "freeze", 20_000),
    ).toBe(0);
  });

  it("Fire burn fires from ANY attacker (no type gate)", () => {
    const s = syn({ burnChance: 0.2 });
    const fromWater = rate(
      () => rollInflictions(s, mon(SPECIES.water), neutralTarget, false).status?.kind === "burn",
      N,
    );
    expectRate(fromWater, 0.2, N);
  });

  it("poison / toxic selection follows poisonIsToxic", () => {
    const reg = syn({ poisonChance: 0.5, poisonIsToxic: false });
    const tox = syn({ poisonChance: 0.5, poisonIsToxic: true });
    const r1 = rollInflictionsUntil(reg, poisonMon, neutralTarget, "poison");
    expect(r1.kind).toBe("poison");
    const r2 = rollInflictionsUntil(tox, poisonMon, neutralTarget, "toxic");
    expect(r2).toEqual({ kind: "toxic", toxicN: 1 });
  });

  it("type immunities: Ice↛freeze, Fire↛burn, Poison/Steel↛poison, Electric↛paralyze", () => {
    expect(
      rate(
        () => rollInflictions(syn({ freezeChance: 1 }), ice, mon(SPECIES.ice), false).status !== undefined,
        2_000,
      ),
    ).toBe(0);
    expect(
      rate(
        () => rollInflictions(syn({ burnChance: 1 }), fireMon, mon(SPECIES.fire), false).status !== undefined,
        2_000,
      ),
    ).toBe(0);
    for (const wall of [SPECIES.poison, SPECIES.steel]) {
      expect(
        rate(
          () =>
            rollInflictions(syn({ poisonChance: 1 }), poisonMon, mon(wall), false).status !== undefined,
          2_000,
        ),
      ).toBe(0);
    }
    expect(
      rate(
        () =>
          rollInflictions(syn({ paralyzeChance: 1 }), elec, mon(SPECIES.electric), false).status !==
          undefined,
        2_000,
      ),
    ).toBe(0);
  });

  it("a target that already has a status takes no new major status (flinch still rolls)", () => {
    const s = syn({ freezeChance: 1, flinchChance: 1 });
    const r = rollInflictions(s, ice, neutralTarget, true);
    expect(r.status).toBeUndefined();
    // ice isn't Dark so flinch is false here; use a Dark attacker to confirm flinch survives
    const r2 = rollInflictions(s, dark, neutralTarget, true);
    expect(r2.status).toBeUndefined();
    expect(r2.flinch).toBe(true);
  });

  it("only one major status per hit (burn is checked before poison)", () => {
    const s = syn({ burnChance: 1, poisonChance: 1 });
    // attacker is Poison-type so both could apply; burn wins by order
    const r = rollInflictions(s, poisonMon, neutralTarget, false);
    expect(r.status?.kind).toBe("burn");
  });
});

function rollInflictionsUntil(
  s: TeamSynergy,
  attacker: ReturnType<typeof mon>,
  target: ReturnType<typeof mon>,
  want: StatusCondition["kind"],
): StatusCondition {
  for (let i = 0; i < 5_000; i++) {
    const r = rollInflictions(s, attacker, target, false);
    if (r.status?.kind === want) return r.status;
  }
  throw new Error(`never rolled ${want}`);
}
