import { useEffect } from "react";
import { BookOpen, Map, Package, Swords, Users } from "lucide-react";
import { useGame } from "@/lib/game/store";
import type { TabId } from "@/lib/game/types";
import { cn } from "@/lib/utils";
import { BagView } from "./bag-view";
import { BattleView } from "./battle";
import { DexView } from "./dex-view";
import { MapView } from "./map-view";
import { StarterSelect } from "./starter";
import { TeamView } from "./team-view";

const TABS: { id: TabId; label: string; icon: typeof Swords }[] = [
  { id: "battle", label: "Battle", icon: Swords },
  { id: "map", label: "Map", icon: Map },
  { id: "team", label: "Team", icon: Users },
  { id: "dex", label: "Dex", icon: BookOpen },
  { id: "bag", label: "Bag", icon: Package },
];

export function GameShell() {
  const started = useGame((s) => s.started);
  const tab = useGame((s) => s.tab);
  const setTab = useGame((s) => s.setTab);
  const step = useGame((s) => s.step);
  const balls = useGame((s) => s.balls);
  const dex = useGame((s) => s.dex);
  const rehydrate = useGame((s) => s.rehydrate);
  const owned = Object.values(dex).filter((f) => f >= 5).length;

  useEffect(() => {
    rehydrate();
  }, [rehydrate]);

  useEffect(() => {
    if (!started) return;
    let raf = 0;
    let last = performance.now();
    const loop = (t: number) => {
      const dt = Math.min((t - last) / 1000, 0.1);
      last = t;
      step(dt);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const onHide = () => {
      if (document.hidden) {
        last = performance.now();
        return;
      }
      const elapsed = Math.min((performance.now() - last) / 1000, 45);
      last = performance.now();
      const chunks = Math.floor(elapsed / 0.05);
      for (let i = 0; i < chunks; i++) step(0.05);
    };
    document.addEventListener("visibilitychange", onHide);
    const onPageHide = () => {
      useGame.getState().exportSave();
    };
    window.addEventListener("pagehide", onPageHide);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [step, started]);

  if (!started) return <StarterSelect />;

  return (
    <div className="flex min-h-dvh justify-center bg-bg text-fg">
      <div className="relative flex h-dvh w-full max-w-[430px] flex-col overflow-hidden bg-bg shadow-[0_0_0_1px_rgba(255,255,255,0.04)]">
        <header className="flex h-12 shrink-0 items-center justify-between px-4 pt-[env(safe-area-inset-top)]">
          <div className="font-display text-base font-semibold tracking-tight">PokeIdle</div>
          <div className="flex items-center gap-3 font-mono text-[11px] tabular-nums text-muted">
            <span>Dex {owned}</span>
            <span>P {balls.pokeball}</span>
            <span>G {balls.greatball}</span>
            <span>U {balls.ultraball}</span>
          </div>
        </header>
        <main className="min-h-0 flex-1">
          {tab === "battle" && <BattleView />}
          {tab === "map" && <MapView />}
          {tab === "team" && <TeamView />}
          {tab === "dex" && <DexView />}
          {tab === "bag" && <BagView />}
        </main>
        <nav className="grid h-[4.25rem] shrink-0 grid-cols-5 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)]">
          {TABS.map((t) => {
            const Icon = t.icon;
            const on = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium",
                  on ? "text-fg" : "text-muted",
                )}
              >
                <Icon className="size-5" strokeWidth={on ? 2.2 : 1.8} />
                {t.label}
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
