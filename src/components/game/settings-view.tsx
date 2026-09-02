import { useState } from "react";
import { useGame } from "@/lib/game/store";

export function SettingsView() {
  const exportSave = useGame((s) => s.exportSave);
  const importSave = useGame((s) => s.importSave);
  const resetGame = useGame((s) => s.resetGame);

  const [saveText, setSaveText] = useState("");
  const [msg, setMsg] = useState("");

  return (
    <div className="h-full overflow-y-auto px-4 pb-4 pt-3">
      <h2 className="font-display text-xl font-semibold tracking-tight">Settings</h2>
      <p className="mt-1 text-xs text-muted">Back up, restore, or wipe your progress.</p>

      <h3 className="mt-6 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
        Save file
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
                const text = typeof reader.result === "string" ? reader.result : "";
                setMsg(importSave(text) ? "Save file loaded." : "Invalid save file.");
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
              onClick={() => setMsg(importSave(saveText) ? "Save loaded." : "Invalid save.")}
            >
              Import pasted save
            </button>
          </div>
        </details>
      </div>

      <h3 className="mt-6 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
        Danger zone
      </h3>
      <div className="mt-3 space-y-2">
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
