import { useState } from "react";
import { useGame } from "@/lib/game/store";
import {
  autoTapCost,
  autoTapMsFromLevel,
  catchUpgradeCost,
  catchMultiplier,
  MAX_AUTO_LEVEL,
  uniqueCaughtBonus,
  levelOf,
} from "@/lib/game/formulas";
import { POKEDEX } from "@/lib/game/dex";
import { cn } from "@/lib/utils";
import type { CatchMode } from "@/lib/game/types";

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
  const exportSave = useGame((s) => s.exportSave);
  const importSave = useGame((s) => s.importSave);
  const resetGame = useGame((s) => s.resetGame);
  const dex = useGame((s) => s.dex);

  const [saveText, setSaveText] = useState("");
  const [msg, setMsg] = useState("");

  const owned = Object.values(dex).filter((f) => f >= 5).length;
  const uniqueBonus = uniqueCaughtBonus(owned);
  const autoCost = autoTapCost(autoTapLevel);
  const autoMaxed = autoTapLevel >= MAX_AUTO_LEVEL;
  
  // Updated to pass catchTier into formula:
  const catchCost = catchUpgradeCost(catchLevel, catchTier);
  const catchMaxed = catchTier === "masterball" && catchLevel >= 10;
  
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
        <p className="mt-1 text-sm capitalize">
          {catchTier.replace("ball", " Ball")} Lv.{catchLevel}
        </p>
        <p className="text-xs text-muted">
          Multiplier ×{mult.toFixed(1)}
          {catchTier !== "masterball" && " · next tier at Lv.10"}
        </p>
        <p className="mt-1 text-xs text-muted">
          No balls consumed — catch is always active.
        </p>

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
            ? "Maxed (×50)"
            : `Upgrade · ¥ ${catchCost.toLocaleString()}`}
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

      {/* ── Settings + save ── */}
      <h3 className="mt-6 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
        Settings
      </h3>

      <div className="mt-3 space-y-2">
        <button
          type="button"
          className="h-11 w-full rounded-2xl bg-accent text-sm font-medium text-white shadow-border"
          onClick={() => {
            const data = exportSave();
            const blob = new Blob([data], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `pokeidle-save-${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
            setMsg("Save file downloaded.");
          }}
        >
          Download save file
        </button>
        <label className="flex h-11 w-full cursor-pointer items-center justify-center rounded-2xl bg-surface text-sm font-medium shadow-border">
          Load save file
          <input
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              const reader = new FileReader();
              reader.onload = () => {
                const text =
                  typeof reader.result === "string" ? reader.result : "";
                setMsg(
                  importSave(text) ? "Save file loaded." : "Invalid save file.",
                );
              };
              reader.readAsText(file);
            }}
          />
        </label>

        <details className="rounded-2xl bg-surface px-4 py-2.5 text-xs text-muted shadow-border">
          <summary className="cursor-pointer select-none">Copy/paste save</summary>
          <div className="mt-2 space-y-2">
            <button
              type="button"
              className="h-9 w-full rounded-xl bg-surface-2 text-xs font-medium"
              onClick={() => {
                const data = exportSave();
                setSaveText(data);
                void navigator.clipboard?.writeText(data);
                setMsg("Save copied to clipboard.");
              }}
            >
              Copy save to clipboard
            </button>
            <textarea
              value={saveText}
              onChange={(e) => setSaveText(e.target.value)}
              placeholder="Paste save data to import"
              className="h-24 w-full rounded-2xl bg-surface-2 p-3 font-mono text-[11px] outline-none"
            />
            <button
              type="button"
              className="h-9 w-full rounded-xl bg-surface-2 text-xs font-medium"
              onClick={() =>
                setMsg(importSave(saveText) ? "Save loaded." : "Invalid save.")
              }
            >
              Import pasted save
            </button>
          </div>
        </details>

        <button
          type="button"
          className="h-11 w-full rounded-2xl bg-surface text-sm font-medium text-danger shadow-border"
          onClick={() => {
            if (confirm("Reset all progress?")) resetGame();
          }}
        >
          Reset game
        </button>
        {msg && <p className="text-center text-xs text-muted">{msg}</p>}
      </div>
    </div>
  );
}