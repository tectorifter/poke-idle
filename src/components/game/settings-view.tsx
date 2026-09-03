import { useState } from "react";
import { useGame } from "@/lib/game/store";
import { levelOf } from "@/lib/game/formulas";
import { useAppearance } from "@/lib/appearance";
import { Sprite } from "./sprite";

export function SettingsView() {
  const exportSave = useGame((s) => s.exportSave);
  const importSave = useGame((s) => s.importSave);
  const resetGame = useGame((s) => s.resetGame);
  const autoAdvanceRoute = useGame((s) => s.autoAdvanceRoute);
  const toggleAutoAdvanceRoute = useGame((s) => s.toggleAutoAdvanceRoute);
  const team = useGame((s) => s.team);
  const bgUrl = useAppearance((s) => s.url);
  const setBgFromFile = useAppearance((s) => s.setFromFile);
  const setBgFromUrl = useAppearance((s) => s.setFromUrl);
  const clearBg = useAppearance((s) => s.clearBackground);
  const translucentPanels = useAppearance((s) => s.translucentPanels);
  const setTranslucentPanels = useAppearance((s) => s.setTranslucentPanels);
  const bgAttenuation = useAppearance((s) => s.bgAttenuation);
  const setBgAttenuation = useAppearance((s) => s.setBgAttenuation);
  const opaqueMenus = useAppearance((s) => s.opaqueMenus);
  const setOpaqueMenus = useAppearance((s) => s.setOpaqueMenus);

  const [saveText, setSaveText] = useState("");
  const [bgLink, setBgLink] = useState("");
  const [msg, setMsg] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const openPicker = () => {
    setSelected(new Set());
    setPickerOpen(true);
  };

  const toggleSelected = (uid: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  };

  const confirmExport = () => {
    const picked = team.filter((p) => selected.has(p.uid));
    if (picked.length === 0) return;
    const data = JSON.stringify(picked, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const stamp = new Date().toISOString().slice(0, 10);
    a.download = picked.length === 1 ? `${picked[0].name}-${stamp}.json` : `pokeidle-pokemon-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setPickerOpen(false);
    setMsg(`Exported ${picked.length} Pokemon.`);
  };

  return (
    <div className="h-full overflow-y-auto px-4 pb-4 pt-3">
      <h2 className="font-display text-xl font-semibold tracking-tight">Settings</h2>
      <p className="mt-1 text-xs text-muted">Back up, restore, or wipe your progress.</p>

      <h3 className="mt-6 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
        Gameplay
      </h3>
      <div className="mt-3">
        <label className="flex h-14 w-full items-center justify-between rounded-2xl bg-surface px-4 shadow-border">
          <span className="pr-3 text-sm font-medium">
            Auto-advance route
            <span className="mt-0.5 block text-xs font-normal text-muted">
              Move to the next route once every wild Pokemon on this one is caught.
            </span>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={autoAdvanceRoute}
            onClick={toggleAutoAdvanceRoute}
            className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
              autoAdvanceRoute ? "bg-accent" : "bg-surface-2"
            }`}
          >
            <span
              className={`absolute left-1 top-1 size-5 rounded-full bg-white transition-transform ${
                autoAdvanceRoute ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </label>
      </div>

      <h3 className="mt-6 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
        Appearance
      </h3>
      <div className="mt-3 space-y-2">
        <div className="flex items-center gap-3 rounded-2xl bg-surface px-4 py-3 shadow-border">
          <div
            className="size-12 shrink-0 rounded-xl bg-surface-2 bg-cover bg-center"
            style={bgUrl ? { backgroundImage: `url("${bgUrl}")` } : undefined}
          />
          <span className="min-w-0 flex-1 text-sm font-medium">
            App background
            <span className="mt-0.5 block text-xs font-normal text-muted">
              {bgUrl
                ? "A custom image is set as the app background."
                : "Use your own PNG / JPG / GIF instead of the plain background."}
            </span>
          </span>
        </div>
        <label className="flex h-11 w-full cursor-pointer items-center justify-center rounded-2xl bg-accent text-sm font-medium text-white shadow-border">
          Import background
          <input
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp,.png,.jpg,.jpeg,.gif,.webp"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              const err = await setBgFromFile(file);
              setMsg(err ?? "Background updated.");
            }}
          />
        </label>

        <div className="flex gap-2">
          <input
            type="url"
            inputMode="url"
            value={bgLink}
            onChange={(e) => setBgLink(e.target.value)}
            placeholder="…or paste an image link (https://)"
            className="h-11 min-w-0 flex-1 rounded-2xl bg-surface px-3 text-sm outline-none shadow-border placeholder:text-subtle"
          />
          <button
            type="button"
            disabled={!bgLink.trim()}
            className={`h-11 shrink-0 rounded-2xl px-4 text-sm font-medium shadow-border ${
              bgLink.trim() ? "bg-surface" : "bg-surface-2 text-muted"
            }`}
            onClick={async () => {
              setMsg("Loading link…");
              const err = await setBgFromUrl(bgLink);
              if (!err) setBgLink("");
              setMsg(err ?? "Background updated.");
            }}
          >
            Use link
          </button>
        </div>

        {bgUrl && (
          <>
            <button
              type="button"
              className="h-11 w-full rounded-2xl bg-surface text-sm font-medium shadow-border"
              onClick={async () => {
                await clearBg();
                setMsg("Background removed.");
              }}
            >
              Remove background
            </button>

            <div className="rounded-2xl bg-surface px-4 py-3 shadow-border">
              <div className="flex items-baseline justify-between text-sm font-medium">
                <span>Attenuation</span>
                <span className="font-mono text-xs text-muted">
                  {Math.round(bgAttenuation * 100)}%
                </span>
              </div>
              <p className="mt-0.5 text-xs text-muted">
                Dim the background — full natural colour at 0%, hidden at 100%.
              </p>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={Math.round(bgAttenuation * 100)}
                onChange={(e) => setBgAttenuation(Number(e.target.value) / 100)}
                className="mt-2 h-2 w-full cursor-pointer accent-accent"
                aria-label="Background attenuation"
              />
            </div>
          </>
        )}

        <label className="flex h-14 w-full items-center justify-between rounded-2xl bg-surface px-4 shadow-border">
          <span className="pr-3 text-sm font-medium">
            Translucent panels
            <span className="mt-0.5 block text-xs font-normal text-muted">
              Make the dark GUI windows see-through so the background shows behind them.
            </span>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={translucentPanels}
            onClick={() => setTranslucentPanels(!translucentPanels)}
            className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
              translucentPanels ? "bg-accent" : "bg-surface-2"
            }`}
          >
            <span
              className={`absolute left-1 top-1 size-5 rounded-full bg-white transition-transform ${
                translucentPanels ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </label>

        <label className="flex h-14 w-full items-center justify-between rounded-2xl bg-surface px-4 shadow-border">
          <span className="pr-3 text-sm font-medium">
            Solid menu windows
            <span className="mt-0.5 block text-xs font-normal text-muted">
              Keep the Synergies and Pokemon editor windows opaque even when panels are translucent.
            </span>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={opaqueMenus}
            onClick={() => setOpaqueMenus(!opaqueMenus)}
            className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
              opaqueMenus ? "bg-accent" : "bg-surface-2"
            }`}
          >
            <span
              className={`absolute left-1 top-1 size-5 rounded-full bg-white transition-transform ${
                opaqueMenus ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </label>
      </div>

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
        Pokemon export
      </h3>
      <div className="mt-3">
        <button
          type="button"
          className="h-11 w-full rounded-2xl bg-surface text-sm font-medium shadow-border"
          onClick={openPicker}
        >
          Export Pokemon (JSON)
        </button>
      </div>

      {pickerOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={() => setPickerOpen(false)}>
          <div
            className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-bg p-4 pb-6 shadow-border"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-lg font-semibold">Select Pokemon to export</h3>
            <p className="mt-1 text-xs text-muted">
              Choose which of your party's Pokemon to include in the JSON file.
            </p>

            <div className="mt-3 space-y-2">
              {team.length === 0 && <p className="text-sm text-muted">Your party is empty.</p>}
              {team.map((p) => {
                const checked = selected.has(p.uid);
                return (
                  <label
                    key={p.uid}
                    className={`flex items-center gap-3 rounded-2xl px-3 py-2 shadow-border ${
                      checked ? "bg-accent/15" : "bg-surface"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleSelected(p.uid)}
                      className="size-5 shrink-0 accent-accent"
                    />
                    <Sprite name={p.name} shiny={p.shiny} size={40} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {p.shiny ? "★ " : ""}
                        {p.name}
                      </span>
                      <span className="block text-xs text-muted">Lv. {levelOf(p)}</span>
                    </span>
                  </label>
                );
              })}
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                className="h-11 flex-1 rounded-2xl bg-surface text-sm font-medium shadow-border"
                onClick={() => setPickerOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={selected.size === 0}
                className={`h-11 flex-1 rounded-2xl text-sm font-semibold shadow-border ${
                  selected.size === 0 ? "bg-surface-2 text-muted" : "bg-accent text-white"
                }`}
                onClick={confirmExport}
              >
                Confirm & export ({selected.size})
              </button>
            </div>
          </div>
        </div>
      )}

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
