import { useEffect } from "react";
import { BookOpen, Map, Package, Settings, Swords, Trophy, Users } from "lucide-react";
import { useGame } from "@/lib/game/store";
import { useAppearance } from "@/lib/appearance";
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
  const bgUrl = useAppearance((s) => s.url);
  const initBg = useAppearance((s) => s.init);
  const translucent = useAppearance((s) => s.translucentPanels);
  const bgAttenuation = useAppearance((s) => s.bgAttenuation);
  const owned = Object.values(dex).filter((f) => f >= 5).length;

  useEffect(() => {
    rehydrate();
  }, [rehydrate]);

  useEffect(() => {
    initBg();
  }, [initBg]);

  // Paint the player's custom image behind everything (falls back to the theme
  // colour when cleared). The attenuation slider layers a black overlay over it
  // — 0 = full natural colour, 1 = fully dimmed.
  useEffect(() => {
    const s = document.body.style;
    if (bgUrl) {
      const a = Math.max(0, Math.min(1, bgAttenuation));
      const dim = a > 0 ? `linear-gradient(rgba(0,0,0,${a}), rgba(0,0,0,${a})), ` : "";
      s.backgroundImage = `${dim}url("${bgUrl}")`;
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
  }, [bgUrl, bgAttenuation]);

  // Translucent panels: swap the opaque dark theme colours for semi-transparent
  // ones so the background image shows through every GUI window.
  useEffect(() => {
    const r = document.documentElement.style;
    if (translucent) {
      r.setProperty("--color-bg", "rgba(11, 12, 16, 0.55)");
      r.setProperty("--color-surface", "rgba(20, 21, 28, 0.62)");
      r.setProperty("--color-surface-2", "rgba(28, 30, 40, 0.68)");
    } else {
      r.removeProperty("--color-bg");
      r.removeProperty("--color-surface");
      r.removeProperty("--color-surface-2");
    }
  }, [translucent]);

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
    <div
      // No browser right-click menu anywhere in the game area.
      onContextMenu={(e) => e.preventDefault()}
      className={cn("flex min-h-dvh justify-center text-fg", bgUrl ? "bg-transparent" : "bg-bg")}
    >
      <div
        className={cn(
          "relative flex h-dvh w-full max-w-[430px] flex-col overflow-hidden shadow-[0_0_0_1px_rgba(255,255,255,0.04)]",
          // Dimming is handled by the attenuation slider on the body background;
          // the frame just stays transparent over it (a light blur helps
          // legibility once panels go translucent).
          !bgUrl ? "bg-bg" : translucent ? "bg-transparent backdrop-blur-[1px]" : "bg-transparent",
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
