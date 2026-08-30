import { Heart, Pause, Play } from "lucide-react";
import { speciesByName } from "@/lib/game/dex";
import { combatStats, HEAL_COOLDOWN_MS, levelOf, nextLevelExp, thisLevelExp } from "@/lib/game/formulas";
import { ROUTES, useGame } from "@/lib/game/store";
import type { BallKind, CatchMode } from "@/lib/game/types";
import { cn } from "@/lib/utils";
import { Meter } from "./bars";
import { Sprite } from "./sprite";
import { TypeBadge } from "./type-badge";

const BALLS: { id: BallKind; label: string }[] = [
  { id: "pokeball", label: "Poke" },
  { id: "greatball", label: "Great" },
  { id: "ultraball", label: "Ultra" },
];

export function BattleView() {
  const enemy = useGame((s) => s.enemy);
  const team = useGame((s) => s.team);
  const active = useGame((s) => s.active);
  const region = useGame((s) => s.region);
  const route = useGame((s) => s.route);
  const catchMode = useGame((s) => s.catchMode);
  const setCatchMode = useGame((s) => s.setCatchMode);
  const balls = useGame((s) => s.balls);
  const selectedBall = useGame((s) => s.selectedBall);
  const setBall = useGame((s) => s.setBall);
  const heal = useGame((s) => s.heal);
  const lastHeal = useGame((s) => s.lastHeal);
  const now = useGame((s) => s.now);
  const log = useGame((s) => s.log);
  const playerHit = useGame((s) => s.playerHit);
  const enemyHit = useGame((s) => s.enemyHit);
  const paused = useGame((s) => s.paused);
  const setActive = useGame((s) => s.setActive);

  const player = team[active];
  const routeName = ROUTES[region]?.[route]?.name ?? route;
  const healLeft = Math.max(0, HEAL_COOLDOWN_MS - (now - lastHeal));
  const canHeal = healLeft <= 0;
  const allDown = team.every((p) => p.hp <= 0);

  return (
    <div className="flex h-auto min-h-full flex-col gap-3 overflow-y-auto px-4 pb-12 pt-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">{region}</p>
          <h2 className="font-display text-xl font-semibold tracking-tight">{routeName}</h2>
        </div>
        <button
          type="button"
          className="grid size-11 place-items-center rounded-full bg-surface shadow-border"
          onClick={() => useGame.setState({ paused: !paused })}
          aria-label={paused ? "Resume" : "Pause"}
        >
          {paused ? <Play className="size-4" /> : <Pause className="size-4" />}
        </button>
      </div>

      {enemy && <FighterCard poke={enemy} hitAt={enemyHit} side="wild" />}

      <div className="flex items-center gap-3 px-1">
        <div className="h-px flex-1 bg-border" />
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
          {allDown ? "Fainted" : paused ? "Paused" : "Idle battle"}
        </span>
        <div className="h-px flex-1 bg-border" />
      </div>

      {player && <FighterCard poke={player} hitAt={playerHit} side="you" />}

      {/* Team strip – touch-pan-x + overscroll-x-contain fix nested scroll on mobile */}
      <div className="flex flex-nowrap gap-1.5 overflow-x-auto pb-1 touch-pan-x overscroll-x-contain [-webkit-overflow-scrolling:touch]">
        {team.map((p, i) => {
          const stats = combatStats(p);
          return (
            <button
              key={p.uid}
              type="button"
              onClick={() => setActive(i)}
              className={cn(
                "flex min-w-[72px] flex-col items-center rounded-2xl bg-surface px-2 py-2 shadow-border",
                i === active && "ring-1 ring-accent",
                p.hp <= 0 && "opacity-40",
              )}
            >
              <Sprite name={p.name} shiny={p.shiny} size={40} />
              <Meter value={p.hp} max={stats.maxHp} tone="hp" className="mt-1 w-full" />
            </button>
          );
        })}
      </div>

      <div className="mt-6 rounded-3xl bg-surface p-4 shadow-border">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Catch</p>
          <div className="flex rounded-full bg-surface-2 p-0.5">
            {(["off", "new", "all"] as CatchMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setCatchMode(m)}
                className={cn(
                  "h-8 rounded-full px-3 text-xs font-medium capitalize",
                  catchMode === m ? "bg-accent text-accent-fg" : "text-muted",
                )}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {BALLS.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => setBall(b.id)}
              className={cn(
                "rounded-2xl bg-surface-2 px-2 py-2 text-center",
                selectedBall === b.id && "ring-1 ring-accent",
              )}
            >
              <div className="text-xs font-medium">{b.label}</div>
              <div className="mt-0.5 font-mono text-sm tabular-nums">{balls[b.id]}</div>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={heal}
          disabled={!canHeal}
          className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-accent text-sm font-semibold text-accent-fg disabled:bg-surface-2 disabled:text-muted"
        >
          <Heart className="size-4" />
          {canHeal ? "Heal team" : `Heal in ${Math.ceil(healLeft / 1000)}s`}
        </button>
      </div>

      <ol className="space-y-1 pb-2 font-mono text-[11px] leading-relaxed text-muted">
        {[...log].reverse().slice(0, 8).map((line) => (
          <li
            key={line.id}
            className={cn(
              line.tone === "catch" && "text-hp",
              line.tone === "shiny" && "text-warn",
              line.tone === "escape" && "text-danger",
              line.tone === "level" && "text-xp",
            )}
          >
            {line.text}
          </li>
        ))}
      </ol>
    </div>
  );
}

export function FighterCard({
  poke,
  hitAt,
  side,
}: {
  poke: import("@/lib/game/types").OwnedPoke;
  hitAt: number;
  side: "wild" | "you";
}) {
  const spec = speciesByName(poke.name);
  const stats = combatStats(poke);
  const lvl = levelOf(poke);
  const shaking = Date.now() - hitAt < 180;
  const xp0 = thisLevelExp(poke);
  const xp1 = nextLevelExp(poke);
  return (
    <div className="rounded-3xl bg-surface p-4 shadow-border">
      <div className={cn("flex items-center gap-3", side === "you" && "flex-row-reverse")}>
        <div className={cn("grid size-28 shrink-0 place-items-center", shaking && "animate-hit")}>
          <Sprite name={poke.name} shiny={poke.shiny} animated size={112} facing={side === "you" ? "back" : "front"} />
        </div>
        <div className={cn("min-w-0 flex-1", side === "you" && "text-right")}>
          <div className={cn("flex flex-wrap items-center gap-1.5", side === "you" && "justify-end")}>
            {poke.shiny && (
              <span className="rounded-full bg-warn/20 px-2 text-[10px] font-semibold uppercase tracking-wide text-warn">
                Shiny
              </span>
            )}
            <span className="font-display text-lg font-semibold">{poke.name}</span>
            <span className="font-mono text-xs tabular-nums text-muted">Lv.{lvl}</span>
          </div>
          <div className={cn("mt-1 flex flex-wrap gap-1", side === "you" && "justify-end")}>
            {spec?.types.map((t) => (
              <TypeBadge key={t} type={t} />
            ))}
            {poke.prestige > 0 && (
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">+{poke.prestige}%</span>
            )}
          </div>
          <div className="mt-3 space-y-1.5">
            <div className="flex justify-between font-mono text-[10px] tabular-nums text-muted">
              <span>HP</span>
              <span>
                {Math.max(0, Math.floor(poke.hp))} / {stats.maxHp}
              </span>
            </div>
            <Meter value={poke.hp} max={stats.maxHp} tone="hp" className="h-2.5" />
            {side === "you" && (
              <>
                <div className="flex justify-between font-mono text-[10px] tabular-nums text-muted">
                  <span>XP</span>
                  <span>
                    {Math.max(0, Math.floor(poke.exp - xp0))} / {Math.max(1, Math.floor(xp1 - xp0))}
                  </span>
                </div>
                <Meter value={poke.exp - xp0} max={xp1 - xp0} tone="xp" />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
