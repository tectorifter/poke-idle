import { STARTERS, speciesByName } from "@/lib/game/dex";
import { useGame } from "@/lib/game/store";
import { Sprite } from "./sprite";
import { TypeBadge } from "./type-badge";

const BLURBS: Record<string, string> = {
  Bulbasaur: "Steady grass starter. Strong early, grows into a wall.",
  Charmander: "Glass cannon. Slow start, devastating late firepower.",
  Squirtle: "Balanced tank. Forgives mistakes while you learn the routes.",
};

export function StarterSelect() {
  const startWith = useGame((s) => s.startWith);
  return (
    <div className="flex min-h-dvh flex-col bg-bg px-5 pb-10 pt-12 text-fg">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted">PokeIdle</p>
      <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight text-balance">
        Choose your partner
      </h1>
      <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted text-pretty">
        Auto-battles run while you watch. Catch every species, fill the dex, prestige at 100.
      </p>
      <div className="mt-8 grid gap-3">
        {STARTERS.map((name) => {
          const spec = speciesByName(name);
          return (
            <button
              key={name}
              type="button"
              onClick={() => startWith(name)}
              className="flex items-center gap-4 rounded-3xl bg-surface p-3 text-left shadow-border transition-transform duration-150 ease-out active:scale-[0.98]"
            >
              <div className="grid size-24 place-items-center rounded-2xl bg-surface-2">
                <Sprite name={name} size={88} animated />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-display text-lg font-semibold">{name}</span>
                  {spec?.types.map((t) => (
                    <TypeBadge key={t} type={t} />
                  ))}
                </div>
                <p className="mt-1 text-sm leading-snug text-muted">{BLURBS[name]}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
