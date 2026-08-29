import { useState } from "react";
import { useGame } from "@/lib/game/store";
import { POKEDEX } from "@/lib/game/dex";
import { cn } from "@/lib/utils";

export function BagView() {
  const balls = useGame((s) => s.balls);
  const stats = useGame((s) => s.stats);
  const autoPrestige = useGame((s) => s.autoPrestige);
  const setAutoPrestige = useGame((s) => s.setAutoPrestige);
  const exportSave = useGame((s) => s.exportSave);
  const importSave = useGame((s) => s.importSave);
  const resetGame = useGame((s) => s.resetGame);
  const dex = useGame((s) => s.dex);
  const [saveText, setSaveText] = useState("");
  const [msg, setMsg] = useState("");
  const owned = Object.values(dex).filter((f) => f >= 5).length;

  return (
    <div className="h-full overflow-y-auto px-4 pb-4 pt-3">
      <h2 className="font-display text-xl font-semibold tracking-tight">Bag</h2>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {(
          [
            ["Poke Balls", balls.pokeball],
            ["Great Balls", balls.greatball],
            ["Ultra Balls", balls.ultraball],
          ] as const
        ).map(([label, n]) => (
          <div key={label} className="rounded-2xl bg-surface px-3 py-3 text-center shadow-border">
            <div className="font-mono text-lg tabular-nums">{n}</div>
            <div className="text-[11px] text-muted">{label}</div>
          </div>
        ))}
      </div>

      <h3 className="mt-6 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Statistics</h3>
      <dl className="mt-2 divide-y divide-border rounded-2xl bg-surface shadow-border">
        {[
          ["Species owned", `${owned} / ${POKEDEX.length}`],
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

      <h3 className="mt-6 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Settings</h3>
      <label className="mt-2 flex h-12 items-center justify-between rounded-2xl bg-surface px-4 shadow-border">
        <span className="text-sm">Auto prestige at 100</span>
        <button
          type="button"
          role="switch"
          aria-checked={autoPrestige}
          onClick={() => setAutoPrestige(!autoPrestige)}
          className={cn(
            "relative h-6 w-11 rounded-full transition-colors",
            autoPrestige ? "bg-accent" : "bg-surface-2",
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 size-5 rounded-full bg-fg transition-transform",
              autoPrestige ? "translate-x-5" : "translate-x-0.5",
            )}
          />
        </button>
      </label>

      <div className="mt-3 space-y-2">
        <button
          type="button"
          className="h-11 w-full rounded-2xl bg-accent text-sm font-medium text-white shadow-border"
          onClick={() => {
            const data = exportSave();
            const blob = new Blob([data], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            const stamp = new Date().toISOString().slice(0, 10);
            a.href = url;
            a.download = `pokeidle-save-${stamp}.json`;
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
                const text = typeof reader.result === "string" ? reader.result : "";
                setMsg(importSave(text) ? "Save file loaded." : "Invalid save file.");
              };
              reader.onerror = () => setMsg("Could not read that file.");
              reader.readAsText(file);
            }}
          />
        </label>

        <details className="rounded-2xl bg-surface px-4 py-2.5 text-xs text-muted shadow-border">
          <summary className="cursor-pointer select-none">Copy/paste save instead</summary>
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
              onClick={() => setMsg(importSave(saveText) ? "Save loaded." : "Invalid save.")}
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
