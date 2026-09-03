import { useMemo, useState, type CSSProperties } from "react";
import { X } from "lucide-react";
import { combatStats, levelOf, uniqueCaughtBonus, IV_MAX, EV_MAX_PER_STAT, EV_MAX_TOTAL } from "@/lib/game/formulas";
import { learnableMoves, moveAcquisitionCost } from "@/lib/game/learnsets";
import { NATURE_NAMES, natureTag } from "@/lib/game/natures";
import { TYPE_COLOR } from "@/lib/game/type-chart";
import { computeSynergy } from "@/lib/game/synergy";
import { SOLID_PANEL_VARS, useAppearance } from "@/lib/appearance";
import { useGame, uniqueCaught, sanitizeDraft, modifyPokeCost } from "@/lib/game/store";
import type { Nature, OwnedPoke, StatKey, StatSpread } from "@/lib/game/types";
import { cn } from "@/lib/utils";

const STATS: { key: StatKey; label: string }[] = [
  { key: "hp", label: "HP" },
  { key: "atk", label: "Atk" },
  { key: "def", label: "Def" },
  { key: "spa", label: "Sp.A" },
  { key: "spd", label: "Sp.D" },
  { key: "spe", label: "Spe" },
];

const copy = (s: StatSpread | undefined): StatSpread => ({
  hp: s?.hp ?? 0, atk: s?.atk ?? 0, def: s?.def ?? 0, spa: s?.spa ?? 0, spd: s?.spd ?? 0, spe: s?.spe ?? 0,
});
const spreadEq = (a: StatSpread, b: StatSpread) =>
  STATS.every(({ key }) => a[key] === b[key]);
const evSum = (s: StatSpread) => STATS.reduce((n, { key }) => n + s[key], 0);

export function PokeEditor({ poke, onClose }: { poke: OwnedPoke; onClose: () => void }) {
  const pokeyen = useGame((s) => s.pokeyen);
  const playerPrestige = useGame((s) => s.playerPrestige);
  const dex = useGame((s) => s.dex);
  const team = useGame((s) => s.team);
  const modifyPoke = useGame((s) => s.modifyPoke);
  const opaque = useAppearance((s) => s.opaqueMenus);

  const [ivs, setIvs] = useState<StatSpread>(() => copy(poke.ivs));
  const [evs, setEvs] = useState<StatSpread>(() => copy(poke.evs));
  const [nature, setNature] = useState<Nature>(poke.nature ?? "Hardy");
  const [moves, setMoves] = useState<string[]>(() => [...(poke.moves ?? [])]);

  const lvl = levelOf(poke);
  const uniqueBonus = uniqueCaughtBonus(uniqueCaught(dex));
  const pool = useMemo(() => {
    const list = learnableMoves(poke.name, lvl);
    return [...list].sort((a, b) => {
      const ac = a.category === "Status" ? 1 : 0;
      const bc = b.category === "Status" ? 1 : 0;
      return ac - bc || b.power - a.power || a.name.localeCompare(b.name);
    });
  }, [poke.name, lvl]);

  const preview = combatStats(
    { ...poke, ivs, evs, nature },
    { isPlayer: true, playerPrestige, uniqueBonus, synergy: computeSynergy(team) },
  );

  const evTotal = evSum(evs);
  const ivChanged = !spreadEq(ivs, copy(poke.ivs));
  const evChanged = !spreadEq(evs, copy(poke.evs));
  const natChanged = (poke.nature ?? nature) !== nature;
  const movesChanged =
    JSON.stringify([...moves].sort()) !== JSON.stringify([...(poke.moves ?? [])].sort());
  const dirty = ivChanged || evChanged || natChanged || movesChanged;

  const sanitized = sanitizeDraft(poke, lvl, { ivs, evs, nature, moves });
  const cost = modifyPokeCost(poke, lvl, sanitized);
  const canApply = dirty && cost <= pokeyen;

  const bumpEv = (k: StatKey, d: number) => {
    setEvs((cur) => {
      const room = Math.min(EV_MAX_PER_STAT - cur[k], EV_MAX_TOTAL - evSum(cur));
      const next = Math.max(0, Math.min(cur[k] + d, cur[k] + Math.max(0, room)));
      return { ...cur, [k]: next };
    });
  };
  const bumpIv = (k: StatKey, d: number) =>
    setIvs((cur) => ({ ...cur, [k]: Math.max(0, Math.min(IV_MAX, cur[k] + d)) }));

  const toggleMove = (name: string) =>
    setMoves((cur) =>
      cur.includes(name) ? cur.filter((n) => n !== name) : cur.length >= 4 ? cur : [...cur, name],
    );

  return (
    <div
      className="fixed inset-0 z-50 mx-auto flex max-w-[430px] flex-col bg-bg text-fg"
      style={opaque ? (SOLID_PANEL_VARS as CSSProperties) : undefined}
    >
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
        <div>
          <div className="font-display text-lg font-semibold">{poke.name}</div>
          <div className="text-[11px] text-muted">
            Lv.{lvl} · edit IV / EV / nature / moves
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="grid size-9 place-items-center rounded-full bg-surface shadow-border"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-3">
        {/* Resulting stats preview */}
        <section className="rounded-2xl bg-surface p-3 shadow-border">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Resulting stats</h3>
          <div className="mt-2 grid grid-cols-3 gap-x-3 gap-y-1 font-mono text-xs tabular-nums">
            {STATS.map(({ key, label }) => (
              <div key={key} className="flex justify-between">
                <span className="text-muted">{label}</span>
                <span>{key === "hp" ? preview.maxHp : preview[key]}</span>
              </div>
            ))}
          </div>
        </section>

        {/* EVs */}
        <section className="rounded-2xl bg-surface p-3 shadow-border">
          <div className="flex items-baseline justify-between">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">EVs</h3>
            <span className="font-mono text-[11px] tabular-nums text-muted">{evTotal} / {EV_MAX_TOTAL}</span>
          </div>
          <div className="mt-2 space-y-2">
            {STATS.map(({ key, label }) => (
              <div key={key}>
                <div className="flex justify-between text-[11px]">
                  <span className="font-medium">{label}</span>
                  <span className="font-mono tabular-nums text-muted">{evs[key]}</span>
                </div>
                <div className="mt-1 grid grid-cols-6 gap-1">
                  {[-100, -10, -1, 1, 10, 100].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => bumpEv(key, d)}
                      className="h-7 rounded-lg bg-surface-2 text-[10px] font-semibold tabular-nums"
                    >
                      {d > 0 ? `+${d}` : d}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* IVs */}
        <section className="rounded-2xl bg-surface p-3 shadow-border">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">IVs (0–{IV_MAX})</h3>
          <div className="mt-2 space-y-2">
            {STATS.map(({ key, label }) => (
              <div key={key}>
                <div className="flex justify-between text-[11px]">
                  <span className="font-medium">{label}</span>
                  <span className="font-mono tabular-nums text-muted">{ivs[key]}</span>
                </div>
                <div className="mt-1 grid grid-cols-4 gap-1">
                  {[-10, -1, 1, 10].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => bumpIv(key, d)}
                      className="h-7 rounded-lg bg-surface-2 text-[10px] font-semibold tabular-nums"
                    >
                      {d > 0 ? `+${d}` : d}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Nature */}
        <section className="rounded-2xl bg-surface p-3 shadow-border">
          <div className="flex items-baseline justify-between">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Nature</h3>
            <span className="text-[11px] text-muted">{natureTag(nature) || "neutral"}</span>
          </div>
          <div className="mt-2 grid grid-cols-5 gap-1">
            {NATURE_NAMES.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setNature(n)}
                className={cn(
                  "h-8 rounded-lg text-[10px] font-medium",
                  n === nature ? "bg-accent text-accent-fg" : "bg-surface-2 text-muted",
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </section>

        {/* Moves */}
        <section className="rounded-2xl bg-surface p-3 shadow-border">
          <div className="flex items-baseline justify-between">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Moves</h3>
            <span className="text-[11px] text-muted">
              {moves.length}/4{moves.length === 0 && " · auto"}
            </span>
          </div>
          <p className="mt-1 text-[10px] text-subtle">
            Level-up moves are free · TM / tutor cost ¥1k / ¥2k / ¥3k by power
            {lvl < 100 && " · TM / egg / tutor unlock at Lv.100"}
          </p>
          <div className="mt-2 max-h-64 space-y-1 overflow-y-auto">
            {pool.map((m) => {
              const on = moves.includes(m.name);
              const mc = moveAcquisitionCost(poke.name, lvl, m.name);
              return (
                <button
                  key={m.name}
                  type="button"
                  onClick={() => toggleMove(m.name)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-[11px]",
                    on ? "bg-accent/20 ring-1 ring-accent" : "bg-surface-2",
                    !on && moves.length >= 4 && "opacity-40",
                  )}
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate font-medium">{m.name}</span>
                    {mc > 0 && (
                      <span className="shrink-0 font-mono text-[9px] text-warn">¥{mc / 1000}k</span>
                    )}
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    <span
                      className="rounded px-1 text-[9px] font-semibold uppercase text-white"
                      style={{ background: TYPE_COLOR[m.type] ?? "#8b8f9a" }}
                    >
                      {m.type}
                    </span>
                    <span className="w-12 text-right font-mono tabular-nums text-muted">
                      {m.category === "Status" ? "—" : m.power}
                    </span>
                  </span>
                </button>
              );
            })}
            {pool.length === 0 && <p className="text-[11px] text-muted">No learnable moves.</p>}
          </div>
          {moves.length > 0 && (
            <button
              type="button"
              onClick={() => setMoves([])}
              className="mt-2 h-8 w-full rounded-lg bg-surface-2 text-[11px] font-medium text-muted"
            >
              Reset to auto-pick
            </button>
          )}
        </section>
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t border-border px-4 py-3">
        <div className="mb-2 flex justify-between text-xs">
          <span className="text-muted">
            Cost: <span className="font-mono tabular-nums text-warn">¥{cost.toLocaleString()}</span>
          </span>
          <span className="font-mono tabular-nums text-muted">have ¥{pokeyen.toLocaleString()}</span>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-11 flex-1 rounded-2xl bg-surface text-sm font-semibold shadow-border"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canApply}
            onClick={() => {
              if (modifyPoke(poke.uid, { ivs, evs, nature, moves })) onClose();
            }}
            className={cn(
              "h-11 flex-[2] rounded-2xl text-sm font-semibold",
              canApply ? "bg-accent text-accent-fg" : "bg-surface-2 text-muted",
            )}
          >
            {!dirty ? "No changes" : cost > pokeyen ? "Not enough ¥" : "Apply"}
          </button>
        </div>
      </div>
    </div>
  );
}
