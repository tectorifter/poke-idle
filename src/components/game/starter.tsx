import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { rollStarters, speciesByName } from "@/lib/game/dex";
import { useGame } from "@/lib/game/store";
import { Sprite } from "./sprite";
import { TypeBadge } from "./type-badge";

export function StarterSelect() {
  const startWith = useGame((s) => s.startWith);
  const [options, setOptions] = useState<string[]>(() => rollStarters(6));

  return (
    <div className="flex min-h-dvh flex-col bg-bg px-5 pb-10 pt-12 text-fg">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted">PokeIdle</p>
      <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight text-balance">
        Choose your partner
      </h1>
      <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted text-pretty">
        Six first-stage partners, rolled at random. Not the one you want? Reroll.
      </p>

      <button
        type="button"
        onClick={() => setOptions(rollStarters(6))}
        className="mt-5 flex h-11 w-fit items-center gap-2 rounded-full bg-surface px-4 text-sm font-semibold shadow-border active:scale-[0.98]"
      >
        <RefreshCw className="size-4" />
        Reroll options
      </button>

      <div className="mt-6 grid gap-3">
        {options.map((name) => {
          const spec = speciesByName(name);
          return (
            <button
              key={name}
              type="button"
              onClick={() => startWith(name)}
              className="flex items-center gap-4 rounded-3xl bg-surface p-3 text-left shadow-border transition-transform duration-150 ease-out active:scale-[0.98]"
            >
              <div className="grid size-20 shrink-0 place-items-center rounded-2xl bg-surface-2">
                <Sprite name={name} size={72} animated />
              </div>
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                <span className="font-display text-lg font-semibold">{name}</span>
                {spec?.types.map((t) => (
                  <TypeBadge key={t} type={t} />
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
