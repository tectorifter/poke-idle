import { Lock } from "lucide-react";
import { REGION_UNLOCK, speciesByName } from "@/lib/game/dex";
import { regionUnlocked, ROUTES, uniqueOwnedCount, useGame } from "@/lib/game/store";
import { cn } from "@/lib/utils";

export function MapView() {
  const region = useGame((s) => s.region);
  const route = useGame((s) => s.route);
  const dex = useGame((s) => s.dex);
  const setRoute = useGame((s) => s.setRoute);
  const team = useGame((s) => s.team);
  const owned = uniqueOwnedCount(dex);
  const prestige = team.reduce((n, p) => n + p.prestige, 0);
  const regions = Object.keys(ROUTES);

  const routes = Object.entries(ROUTES[region] ?? {}).filter(([, r]) => !r.subRoutes);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="px-4 pt-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Regions</p>
        <div className="mt-2 flex gap-2 overflow-x-auto pb-2">
          {regions.map((r) => {
            const open = regionUnlocked(r, dex);
            return (
              <button
                key={r}
                type="button"
                disabled={!open}
                onClick={() => {
                  const first = Object.keys(ROUTES[r] ?? {})[0];
                  if (first) setRoute(r, first);
                }}
                className={cn(
                  "h-10 shrink-0 rounded-full px-4 text-sm font-medium",
                  region === r ? "bg-accent text-accent-fg" : "bg-surface text-fg shadow-border",
                  !open && "opacity-40",
                )}
              >
                {r}
                {!open && <span className="ml-1 text-[10px]">{REGION_UNLOCK[r]}</span>}
              </button>
            );
          })}
        </div>
        <p className="pb-2 text-xs text-muted">
          Dex {owned} / {Object.keys(REGION_UNLOCK).length ? "895" : "—"} · Prestige {prestige}
        </p>
      </div>
      <ul className="flex-1 space-y-2 overflow-y-auto px-4 pb-4">
        {routes.map(([id, def]) => {
          const locked = def.requiredPrestige != null && prestige < def.requiredPrestige;
          const known = def.pokes.filter((n) => speciesByName(n));
          const got = known.filter((n) => (dex[n] ?? 0) >= 5).length;
          const shiny = known.filter((n) => (dex[n] ?? 0) >= 7).length;
          const complete = known.length > 0 && got === known.length;
          const shinyDone = known.length > 0 && shiny === known.length;
          const active = id === route;
          return (
            <li key={id}>
              <button
                type="button"
                disabled={locked}
                onClick={() => setRoute(region, id)}
                className={cn(
                  "flex w-full items-center justify-between rounded-2xl bg-surface px-4 py-3 text-left shadow-border",
                  active && "ring-1 ring-accent",
                  locked && "opacity-50",
                )}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {locked && <Lock className="size-3.5 text-muted" />}
                    <span className="truncate font-medium">{def.name}</span>
                  </div>
                  <p className="mt-0.5 font-mono text-[11px] tabular-nums text-muted">
                    Lv.{def.minLevel}–{def.maxLevel} · {got}/{known.length}
                    {shinyDone ? " · shiny" : ""}
                  </p>
                </div>
                <span
                  className={cn(
                    "size-2.5 shrink-0 rounded-full",
                    shinyDone ? "bg-warn" : complete ? "bg-xp" : "bg-danger/70",
                  )}
                />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
