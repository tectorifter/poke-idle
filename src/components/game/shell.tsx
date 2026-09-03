import { useEffect } from "react";
import { BookOpen, Map, Package, Settings, Swords, Trophy, Users } from "lucide-react";
import { useGame } from "@/lib/game/store";
import { useBackground } from "@/lib/bg-image";
import type { TabId } from "@/lib/game/types";
import { cn } from "@/lib/utils";
import { StoreView } from "./store-view";
import { SettingsView } from "./settings-view";
import { BattleView } from "./battle";
import { DexView } from "./dex-view";
import { LeagueView } from "./league-view";
import { MapView } from "./map-view";
import { StarterSelect } from "./starter";
import { TeamView } from "./team-view";

const TABS: { id: TabId; label: string; icon: typeof Swords }[] = [
  { id: "battle", label: "Battle", icon: Swords },
  { id: "map", label: "Map", icon: Map },
  { id: "league", label: "League", icon: Trophy },
  { id: "team", label: "Team", icon: Users },
  { id: "dex", label: "Dex", icon: BookOpen },
  { id: "store", label: "Store", icon: Package },
  { id: "settings", label: "Settings", icon: Settings },
];

export function GameShell() {
  const started = useGame((s) => s.started);
  const tab = useGame((s) => s.tab);
  const setTab = useGame((s) => s.setTab);
  const step = useGame((s) => s.step);
  const pokeyen = useGame((s) => s.pokeyen);
  const playerPrestige = useGame((s) => s.playerPrestige);
  const dex = useGame((s) => s.dex);
  const rehydrate = useGame((s) => s.rehydrate);
  const bgUrl = useBackground((s) => s.url);
  const initBg = useBackground((s) => s.init);
  const owned = Object.values(dex).filter((f) => f >= 5).length;

  useEffect(() => {
    rehydrate();
  }, [rehydrate]);

  useEffect(() => {
    initBg();
  }, [initBg]);

  // Paint the player's custom image behind everything (falls back to the theme
  // colour when cleared).
  useEffect(() => {
    const s = document.body.style;
    if (bgUrl) {
      s.backgroundImage = `url("${bgUrl}")`;
      s.backgroundSize = "cover";
      s.backgroundPosition = "center";
      s.backgroundRepeat = "no-repeat";
      s.backgroundAttachment = "fixed";
    } else {
      s.backgroundImage = "";
      s.backgroundSize = "";
      s.backgroundPosition = "";
      s.backgroundRepeat = "";
      s.backgroundAttachment = "";
    }
  }, [bgUrl]);

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
    <div className={cn("flex min-h-dvh justify-center text-fg", bgUrl ? "bg-transparent" : "bg-bg")}>
      <div
        className={cn(
          "relative flex h-dvh w-full max-w-[430px] flex-col overflow-hidden shadow-[0_0_0_1px_rgba(255,255,255,0.04)]",
          bgUrl ? "bg-black/35 backdrop-blur-[1px]" : "bg-bg",
        )}
      >
        <header className="flex h-12 shrink-0 items-center justify-between px-4 pt-[env(safe-area-inset-top)]">
          <div className="font-display text-base font-semibold tracking-tight">
            PokeIdle
          </div>
          <div className="flex items-center gap-3 font-mono text-[11px] tabular-nums text-muted">
            <span>Dex {owned}</span>
            {playerPrestige > 0 && (
              <span className="text-accent">+{playerPrestige}%</span>
            )}
            <span className="text-warn">¥ {pokeyen.toLocaleString()}</span>
          </div>
        </header>
        <main className="min-h-0 flex-1">
          {tab === "battle" && <BattleView />}
          {tab === "map" && <MapView />}
          {tab === "league" && <LeagueView />}
          {tab === "team" && <TeamView />}
          {tab === "dex" && <DexView />}
          {tab === "store" && <StoreView />}
          {tab === "settings" && <SettingsView />}
        </main>
        <nav className="grid h-[4.25rem] shrink-0 grid-cols-7 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)]">
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
