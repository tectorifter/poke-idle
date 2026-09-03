import { useState, type CSSProperties } from "react";
import { Sparkles, X } from "lucide-react";
import {
  SYNERGY_META,
  SYNERGY_TYPES,
  nextTierNeed,
  synergyTier,
  typeCounts,
} from "@/lib/game/synergy";
import type { OwnedPoke } from "@/lib/game/types";
import { SOLID_PANEL_VARS, useAppearance } from "@/lib/appearance";
import { cn } from "@/lib/utils";
import { TypeBadge } from "./type-badge";

/** One row per type synergy: current tier, its value, the one-line effect, and
 *  how many more mons of that type reach the next tier. */
function SynergyPanel({ team, onClose }: { team: OwnedPoke[]; onClose: () => void }) {
  const counts = typeCounts(team);
  const opaque = useAppearance((s) => s.opaqueMenus);

  const rows = SYNERGY_TYPES.map((type) => {
    const count = counts[type] ?? 0;
    const tier = synergyTier(type, count);
    const need = nextTierNeed(type, count);
    return { type, count, tier, need, meta: SYNERGY_META[type] };
  }).sort((a, b) => b.tier - a.tier || b.count - a.count || a.type.localeCompare(b.type));

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-bg"
      style={opaque ? (SOLID_PANEL_VARS as CSSProperties) : undefined}
    >
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-accent" />
          <h2 className="font-display text-lg font-semibold">Team Synergies</h2>
        </div>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="grid size-9 place-items-center rounded-full bg-surface shadow-border"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-2">
        {rows.map(({ type, count, tier, need, meta }) => (
          <div
            key={type}
            className={cn(
              "flex gap-2.5 border-b border-border py-2.5",
              tier === 0 && "opacity-55",
            )}
          >
            <div className="w-16 shrink-0 pt-0.5">
              <TypeBadge type={type} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-semibold">
                  {meta.label}
                  <span className="ml-1.5 font-mono text-[10px] font-normal text-muted">
                    {count} in party
                  </span>
                </span>
                <span className="shrink-0 font-mono text-[10px] text-muted">
                  {tier > 0 ? `Tier ${tier}` : "inactive"}
                </span>
              </div>
              <p className="mt-0.5 text-[11px] leading-snug text-muted">{meta.effect}</p>
              <div className="mt-1 flex items-center gap-1.5 font-mono text-[10px]">
                {meta.tierValues.map((v, i) => (
                  <span
                    key={i}
                    className={cn(
                      i + 1 === tier ? "font-bold text-fg" : "text-subtle",
                    )}
                  >
                    {i > 0 && <span className="mr-1.5 text-subtle">·</span>}
                    {v}
                  </span>
                ))}
                <span className="ml-auto shrink-0 text-accent">
                  {need == null ? "Max" : `${need} more`}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Round header button that opens the synergy panel. */
export function SynergyButton({ team, className }: { team: OwnedPoke[]; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-label="Team synergies"
        onClick={() => setOpen(true)}
        className={cn(
          "grid size-11 place-items-center rounded-full bg-surface shadow-border",
          className,
        )}
      >
        <Sparkles className="size-4" />
      </button>
      {open && <SynergyPanel team={team} onClose={() => setOpen(false)} />}
    </>
  );
}
