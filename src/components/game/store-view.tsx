import { useGame } from "@/lib/game/store";
import {
  autoTapCost,
  autoTapMsFromLevel,
  catchUpgradeCost,
  catchMultiplier,
  BALL_META,
  CATCH_TIER_ORDER,
  tierIndex,
  MAX_AUTO_LEVEL,
  uniqueCaughtBonus,
  levelOf,
} from "@/lib/game/formulas";
import { POKEDEX } from "@/lib/game/dex";
import { cn } from "@/lib/utils";
import type { CatchMode } from "@/lib/game/types";
import { BallIcon } from "./ball-icon";

export function StoreView() {
  const pokeyen = useGame((s) => s.pokeyen);
  const autoTapLevel = useGame((s) => s.autoTapLevel);
  const catchTier = useGame((s) => s.catchTier);
  const catchLevel = useGame((s) => s.catchLevel);
  const catchMode = useGame((s) => s.catchMode);
  const playerPrestige = useGame((s) => s.playerPrestige);
  const team = useGame((s) => s.team);
  const buyAutoTap = useGame((s) => s.buyAutoTap);
  const buyCatchUpgrade = useGame((s) => s.buyCatchUpgrade);
  const setCatchMode = useGame((s) => s.setCatchMode);
  const prestigePlayer = useGame((s) => s.prestigePlayer);
  const stats = useGame((s) => s.stats);
  const dex = useGame((s) => s.dex);

  const owned = Object.values(dex).filter((f) => f >= 5).length;
  const uniqueBonus = uniqueCaughtBonus(owned);
  const autoCost = autoTapCost(autoTapLevel);
  const autoMaxed = autoTapLevel >= MAX_AUTO_LEVEL;
  
  const catchCost = catchUpgradeCost(catchLevel, catchTier);
  const catchMaxed = catchTier === "timerball" && catchLevel >= 10;
  const curBall = BALL_META[catchTier].label;

  const mult = catchMultiplier(catchTier, catchLevel);
  const canPrestige = team.some((p) => levelOf(p) >= 100);

  return (
    <div className="h-full overflow-y-auto px-4 pb-4 pt-3">
      <h2 className="font-display text-xl font-semibold tracking-tight">Store</h2>
      <p className="mt-1 font-mono text-sm tabular-nums text-warn">
        ¥ {pokeyen.toLocaleString()}
      </p>

      {/* ── Autotap ── */}
      <section className="mt-5 rounded-3xl bg-surface p-4 shadow-border">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
          Autotap
        </h3>
        <p className="mt-1 text-sm">
          Current cooldown:{" "}
          <span className="font-mono tabular-nums">
            {autoTapMsFromLevel(autoTapLevel)} ms
          </span>
        </p>
        <p className="text-xs text-muted">
          Level {autoTapLevel} / {MAX_AUTO_LEVEL} · −100 ms each
        </p>
        <button
          type="button"
          disabled={autoMaxed || pokeyen < autoCost}
          onClick={buyAutoTap}
          className={cn(
            "mt-3 flex h-12 w-full items-center justify-center rounded-2xl text-sm font-semibold",
            autoMaxed || pokeyen < autoCost
              ? "bg-surface-2 text-muted"
              : "bg-accent text-accent-fg",
          )}
        >
          {autoMaxed
            ? "Maxed (500 ms)"
            : `Buy −100 ms · ¥ ${autoCost.toLocaleString()}`}
        </button>
      </section>

      {/* ── Catch power + mode ── */}
      <section className="mt-4 rounded-3xl bg-surface p-4 shadow-border">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
          Catch Power
        </h3>
        <p className="mt-1 text-sm">
          {curBall} Lv.{catchLevel}
        </p>
        <p className="text-xs text-muted">
          Multiplier ×{mult.toFixed(1)}
          {catchTier !== "timerball" && " · next ball at Lv.10"}
        </p>
        <p className="mt-1 text-xs text-muted">
          No balls consumed — auto-catch is always active. Manual throws are 10% better.
        </p>

        {/* Which ball tiers are unlocked for manual throws */}
        <div className="mt-3 flex gap-2">
          {CATCH_TIER_ORDER.map((b) => {
            const unlocked = tierIndex(b) <= tierIndex(catchTier);
            return (
              <div
                key={b}
                title={`${BALL_META[b].label}${unlocked ? "" : ` · ¥${BALL_META[b].price} / Lv`}`}
                className={cn(
                  "grid size-9 place-items-center rounded-xl",
                  unlocked ? "bg-surface-2" : "bg-surface-2 opacity-30",
                )}
              >
                <BallIcon ball={b} className="size-5" />
              </div>
            );
          })}
        </div>

        {/* Catch mode toggle lives here under the ball shop */}
        <div className="mt-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted mb-1.5">
            Catch filter
          </p>
          <div className="flex rounded-full bg-surface-2 p-0.5">
            {(["new", "all"] as CatchMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setCatchMode(m)}
                className={cn(
                  "h-9 flex-1 rounded-full px-3 text-xs font-medium capitalize",
                  catchMode === m ? "bg-accent text-accent-fg" : "text-muted",
                )}
              >
                {m === "new" ? "New only" : "All"}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          disabled={catchMaxed || pokeyen < catchCost}
          onClick={buyCatchUpgrade}
          className={cn(
            "mt-3 flex h-12 w-full items-center justify-center rounded-2xl text-sm font-semibold",
            catchMaxed || pokeyen < catchCost
              ? "bg-surface-2 text-muted"
              : "bg-accent text-accent-fg",
          )}
        >
          {catchMaxed
            ? "Maxed (×20)"
            : `Upgrade ${curBall} · ¥ ${catchCost.toLocaleString()}`}
        </button>
      </section>

      {/* ── Player Prestige ── */}
      <section className="mt-4 rounded-3xl bg-surface p-4 shadow-border">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
          Player Prestige
        </h3>
        <p className="mt-1 text-sm">
          Current:{" "}
          <span className="font-mono tabular-nums">+{playerPrestige}%</span>
        </p>
        <p className="text-xs text-muted">
          Resets team/storage to Lv.1. Requires a Lv.100 mon on your team.
          Anomaly form bonuses still apply when an anomaly is your active mon.
        </p>
        {uniqueBonus > 0 && (
          <p className="mt-1 text-xs text-hp">
            Unique bonus: +{uniqueBonus} Atk/Def (every 30 species)
          </p>
        )}
        <button
          type="button"
          disabled={!canPrestige}
          onClick={prestigePlayer}
          className={cn(
            "mt-3 flex h-12 w-full items-center justify-center rounded-2xl text-sm font-semibold",
            !canPrestige
              ? "bg-surface-2 text-muted"
              : "bg-accent text-accent-fg",
          )}
        >
          {canPrestige ? "Prestige player" : "Need Lv.100 on team"}
        </button>
      </section>

      {/* ── Stats ── */}
      <h3 className="mt-6 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
        Statistics
      </h3>
      <dl className="mt-2 divide-y divide-border rounded-2xl bg-surface shadow-border">
        {[
          ["Species owned", `${owned} / ${POKEDEX.length}`],
          ["Unique Atk/Def bonus", `+${uniqueBonus}`],
          ["Player prestige", `+${playerPrestige}%`],
          ["Seen", stats.seen],
          ["Defeated", stats.beaten],
          ["Caught", stats.caught],
          ["Shiny seen", stats.shinySeen],
          ["Shiny caught", stats.shinyCaught],
          ["Damage dealt", Math.floor(stats.damage)],
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between px-4 py-2.5 text-sm">
            <dt className="text-muted">{k}</dt>
            <dd className="font-mono tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>

      <p className="mt-6 text-center text-xs text-muted">
        Save management moved to the Settings tab.
      </p>
    </div>
  );
}