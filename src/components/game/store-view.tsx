import { uniqueCaught, useGame } from "@/lib/game/store";
import {
  autoTapCost,
  autoTapMsFromLevel,
  catchUpgradeCost,
  ballChargeCost,
  ballBonus,
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
  const selectedBall = useGame((s) => s.selectedBall);
  const ballCharges = useGame((s) => s.ballCharges);
  const setSelectedBall = useGame((s) => s.setSelectedBall);
  const buyBall = useGame((s) => s.buyBall);
  const buyAutoTap = useGame((s) => s.buyAutoTap);
  const buyCatchUpgrade = useGame((s) => s.buyCatchUpgrade);
  const setCatchMode = useGame((s) => s.setCatchMode);
  const prestigePlayer = useGame((s) => s.prestigePlayer);
  const stats = useGame((s) => s.stats);
  const dex = useGame((s) => s.dex);

  const owned = uniqueCaught(dex);
  const uniqueBonus = uniqueCaughtBonus(owned);
  const autoCost = autoTapCost(autoTapLevel);
  const autoMaxed = autoTapLevel >= MAX_AUTO_LEVEL;
  
  const catchCost = catchUpgradeCost(catchLevel, catchTier);
  const catchMaxed = catchTier === "timerball" && catchLevel >= 10;
  const curBall = BALL_META[catchTier].label;

  const bonus = ballBonus(catchTier, catchLevel);
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
          Level {autoTapLevel} / {MAX_AUTO_LEVEL}
          {!autoMaxed && ` · next ${autoTapMsFromLevel(autoTapLevel + 1)} ms`}
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
            ? `Maxed (${autoTapMsFromLevel(MAX_AUTO_LEVEL)} ms)`
            : `Buy → ${autoTapMsFromLevel(autoTapLevel + 1)} ms · ¥ ${autoCost.toLocaleString()}`}
        </button>
      </section>

      {/* ── Catch power (permanent upgrade track) + mode ── */}
      <section className="mt-4 rounded-3xl bg-surface p-4 shadow-border">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
          Catch Power
        </h3>
        <p className="mt-1 text-sm">
          {curBall} Lv.{catchLevel}
        </p>
        <p className="text-xs text-muted">
          Ball bonus ×{bonus.toFixed(2)} (real catch-rate formula)
          {catchTier !== "timerball" && " · reach Lv.10 to unlock the next ball type"}
        </p>
        <p className="mt-1 text-xs text-muted">
          Auto-catch is free &amp; always on (target fainted). Manual throws spend a purchased ball
          but use the target's live HP + a ×1.5 aim bonus.
        </p>

        {/* Catch mode toggle */}
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
          {catchMaxed ? "Maxed (×4)" : `Upgrade · ¥ ${catchCost.toLocaleString()}`}
        </button>
      </section>

      {/* ── Poké Ball stock (consumable, per type) ── */}
      <section className="mt-4 rounded-3xl bg-surface p-4 shadow-border">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
          Poké Balls
        </h3>
        <p className="mt-1 text-xs text-muted">
          Charges for the manual-catch button. Unlock a type by ranking Catch Power into it.
        </p>

        <div className="mt-3 flex gap-2">
          {CATCH_TIER_ORDER.map((b) => {
            const unlocked = tierIndex(b) <= tierIndex(catchTier);
            return (
              <button
                key={b}
                type="button"
                disabled={!unlocked}
                onClick={() => setSelectedBall(b)}
                title={BALL_META[b].label}
                className={cn(
                  "relative grid size-11 place-items-center rounded-xl",
                  !unlocked
                    ? "bg-surface-2 opacity-30"
                    : b === selectedBall
                      ? "bg-accent/20 ring-1 ring-accent"
                      : "bg-surface-2",
                )}
              >
                <BallIcon ball={b} className="size-6" />
                {unlocked && (
                  <span className="absolute -bottom-1 -right-1 rounded-full bg-bg px-1 font-mono text-[9px] tabular-nums text-muted">
                    {ballCharges[b] ?? 0}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex items-center justify-between text-sm">
          <span>
            {BALL_META[selectedBall].label}
            <span className="ml-2 font-mono text-xs text-muted">
              ×{ballCharges[selectedBall] ?? 0}
            </span>
          </span>
          <span className="font-mono text-xs text-muted">
            ¥ {BALL_META[selectedBall].price.toLocaleString()} each
          </span>
        </div>
        <div className="mt-2 flex gap-2">
          {[1, 10].map((qty) => {
            const cost = ballChargeCost(selectedBall, qty);
            return (
              <button
                key={qty}
                type="button"
                disabled={pokeyen < cost}
                onClick={() => buyBall(selectedBall, qty)}
                className={cn(
                  "h-11 flex-1 rounded-2xl text-sm font-semibold",
                  pokeyen < cost ? "bg-surface-2 text-muted" : "bg-accent text-accent-fg",
                )}
              >
                Buy ×{qty} · ¥ {cost.toLocaleString()}
              </button>
            );
          })}
        </div>
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