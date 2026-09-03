import { useMemo, useState } from "react";
import { POKEDEX } from "@/lib/game/dex";
import { uniqueCaught, useGame } from "@/lib/game/store";
import { cn } from "@/lib/utils";
import { Sprite } from "./sprite";

type Filter = "all" | "owned" | "missing" | "shiny";

export function DexView() {
  const dex = useGame((s) => s.dex);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const owned = uniqueCaught(dex);
  const shiny = Object.values(dex).filter((f) => f >= 7).length;

  const list = useMemo(() => {
    const query = q.trim().toLowerCase();
    return POKEDEX.filter((s) => {
      const flag = dex[s.name] ?? 0;
      if (filter === "owned" && flag < 5) return false;
      if (filter === "missing" && flag >= 5) return false;
      if (filter === "shiny" && flag < 7) return false;
      if (query && !s.name.toLowerCase().includes(query) && !String(s.id).includes(query)) return false;
      return true;
    });
  }, [dex, filter, q]);

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pt-3">
        <h2 className="font-display text-xl font-semibold tracking-tight">Pokedex</h2>
        <p className="text-xs text-muted">
          {owned} owned · {shiny} shiny · {POKEDEX.length} total
        </p>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name or number"
          className="mt-3 h-11 w-full rounded-2xl bg-surface px-4 text-sm shadow-border outline-none placeholder:text-subtle"
        />
        <div className="mt-2 flex gap-1.5">
          {(["all", "owned", "missing", "shiny"] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn(
                "h-8 rounded-full px-3 text-xs font-medium capitalize",
                filter === f ? "bg-accent text-accent-fg" : "bg-surface text-muted shadow-border",
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>
      <ul className="mt-3 grid grid-cols-3 gap-2 overflow-y-auto px-4 pb-4">
        {list.map((s) => {
          const flag = dex[s.name] ?? 0;
          const seen = flag >= 1;
          const got = flag >= 5;
          const isShiny = flag >= 7;
          return (
            <li
              key={`${s.id}-${s.name}`}
              className={cn(
                "flex flex-col items-center rounded-2xl bg-surface px-2 py-3 shadow-border",
                !seen && "opacity-40",
              )}
            >
              <span className="font-mono text-[10px] tabular-nums text-muted">#{String(s.id).padStart(3, "0")}</span>
              <Sprite
                name={s.name}
                shiny={isShiny}
                animated
                size={64}
                className={cn(!seen && "brightness-0")}
              />
              <span className="mt-1 truncate text-center text-xs font-medium">{seen ? s.name : "????"}</span>
              <span className="text-[10px] text-muted">{got ? (isShiny ? "Shiny" : "Owned") : seen ? "Seen" : "—"}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}