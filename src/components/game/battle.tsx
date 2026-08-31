import { Pause, Play } from "lucide-react";
import { speciesByName, POKEDEX } from "@/lib/game/dex";
import {
  combatStats,
  levelOf,
  nextLevelExp,
  thisLevelExp,
  autoTapMsFromLevel,
  uniqueCaughtBonus,
} from "@/lib/game/formulas";
import { ROUTES, useGame, uniqueCaught } from "@/lib/game/store";
import { cn } from "@/lib/utils";
import { Meter } from "./bars";
import { Sprite } from "./sprite";
import { TypeBadge } from "./type-badge";

export function BattleView() {
  const enemy = useGame((s) => s.enemy);
  const team = useGame((s) => s.team);
  const active = useGame((s) => s.active);
  const region = useGame((s) => s.region);
  const route = useGame((s) => s.route);
  const pokeyen = useGame((s) => s.pokeyen);
  const autoTapLevel = useGame((s) => s.autoTapLevel);
  const playerPrestige = useGame((s) => s.playerPrestige);
  const dex = useGame((s) => s.dex);
  const playerHit = useGame((s) => s.playerHit);
  const enemyHit = useGame((s) => s.enemyHit);
  const paused = useGame((s) => s.paused);
  const setActive = useGame((s) => s.setActive);
  const manualTap = useGame((s) => s.manualTap);
  const log = useGame((s) => s.log);

  const player = team[active];
  const routeName = ROUTES[region]?.[route]?.name ?? route;
  const owned = uniqueCaught(dex);
  const totalSpecies = POKEDEX.length;
  const autoMs = autoTapMsFromLevel(autoTapLevel);
  const uniqueBonus = uniqueCaughtBonus(owned);

  const pStats = player
    ? combatStats(player, {
        isPlayer: true,
        playerPrestige,
        uniqueBonus,
      })
    : null;
  const pLvl = player ? levelOf(player) : 1;
  const xp0 = player ? thisLevelExp(player) : 0;
  const xp1 = player ? nextLevelExp(player) : 1;

  return (
    <div className="flex h-full flex-col select-none">
      {/* ── Header row ── */}
      <div className="flex shrink-0 items-center justify-between px-4 pt-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
            {region}
          </p>
          <h2 className="font-display text-xl font-semibold tracking-tight">
            {routeName}
          </h2>
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

      {/* ── Yellow TAP ZONE (fills remaining space) ── */}
      <button
        type="button"
        className="relative min-h-0 flex-1 touch-manipulation overflow-hidden px-4 pb-2 active:bg-white/5"
        onPointerDown={(e) => {
          e.preventDefault();
          manualTap();
        }}
      >
        <div className="flex h-full flex-col gap-3 pt-2 pointer-events-none">
          {/* Enemy card */}
          {enemy && (
            <div className="rounded-3xl bg-surface p-4 shadow-border">
              <FighterCard poke={enemy} hitAt={enemyHit} side="wild" />
            </div>
          )}

          <div className="flex items-center gap-3 px-1">
            <div className="h-px flex-1 bg-border" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
              {paused ? "Paused" : `Tap · Auto ${autoMs} ms`}
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>

          {/* Player summary (HP / EXP / yen / caught) */}
          {player && pStats && (
            <div className="rounded-3xl bg-surface p-4 shadow-border space-y-2">
              {/* HP */}
              <div>
                <div className="flex justify-between font-mono text-[10px] tabular-nums text-muted">
                  <span>HP</span>
                  <span>
                    {Math.max(0, Math.floor(player.hp))} / {pStats.maxHp}
                  </span>
                </div>
                <Meter
                  value={player.hp}
                  max={pStats.maxHp}
                  tone="hp"
                  className="h-2.5 mt-1"
                />
              </div>

              {/* EXP */}
              <div>
                <div className="flex justify-between font-mono text-[10px] tabular-nums text-muted">
                  <span>XP</span>
                  <span>
                    {Math.max(0, Math.floor(player.exp - xp0))} /{" "}
                    {Math.max(1, Math.floor(xp1 - xp0))}
                  </span>
                </div>
                <Meter
                  value={player.exp - xp0}
                  max={xp1 - xp0}
                  tone="xp"
                  className="mt-1"
                />
              </div>

              {/* Yen + Caught */}
              <div className="flex justify-between pt-1 font-mono text-xs tabular-nums">
                <span className="text-warn">¥ {pokeyen.toLocaleString()}</span>
                <span className="text-muted">
                  Caught {owned}/{totalSpecies}
                </span>
              </div>

              {/* Types + combat stats */}
              <div className="flex items-start justify-between gap-3 pt-1">
                <div className="flex flex-wrap gap-1">
                  {speciesByName(player.name)?.types.map((t) => (
                    <TypeBadge key={t} type={t} />
                  ))}
                  {playerPrestige > 0 && (
                    <span className="rounded-full bg-accent/20 px-2 text-[10px] font-semibold text-accent">
                      +{playerPrestige}%
                    </span>
                  )}
                  {uniqueBonus > 0 && (
                    <span className="rounded-full bg-hp/20 px-2 text-[10px] font-semibold text-hp">
                      +{uniqueBonus} Atk/Def
                    </span>
                  )}
                </div>
                <div className="text-right font-mono text-[10px] tabular-nums text-muted leading-relaxed">
                  <div>Dmg {Math.floor(pStats.avgAtk)}</div>
                  <div>Def {Math.floor(pStats.avgDef)}</div>
                  <div>MaxHP {pStats.maxHp}</div>
                </div>
              </div>
            </div>
          )}

          {/* Tiny log */}
          <ol className="space-y-0.5 font-mono text-[10px] leading-relaxed text-muted">
            {[...log]
              .reverse()
              .slice(0, 4)
              .map((line) => (
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
      </button>

      {/* ── Team strip ── */}
      <div className="shrink-0 border-t border-border bg-bg px-3 pb-2 pt-2">
        <div className="flex flex-nowrap gap-1.5 overflow-x-auto [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {team.map((p, i) => {
            const stats = combatStats(p, {
              isPlayer: true,
              playerPrestige,
              uniqueBonus,
            });
            return (
              <button
                key={p.uid}
                type="button"
                onClick={() => setActive(i)}
                className={cn(
                  "flex min-w-[64px] flex-shrink-0 flex-col items-center rounded-2xl bg-surface px-2 py-1.5 shadow-border",
                  i === active && "ring-1 ring-accent",
                  p.hp <= 0 && "opacity-40",
                )}
              >
                <Sprite name={p.name} shiny={p.shiny} size={36} />
                <Meter
                  value={p.hp}
                  max={stats.maxHp}
                  tone="hp"
                  className="mt-1 w-full"
                />
              </button>
            );
          })}
        </div>
      </div>
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
  return (
    <div
      className={cn(
        "flex items-center gap-3",
        side === "you" && "flex-row-reverse",
      )}
    >
      <div
        className={cn(
          "grid size-24 shrink-0 place-items-center",
          shaking && "animate-hit",
        )}
      >
        <Sprite
          name={poke.name}
          shiny={poke.shiny}
          animated
          size={96}
          facing={side === "you" ? "back" : "front"}
        />
      </div>
      <div className={cn("min-w-0 flex-1", side === "you" && "text-right")}>
        <div
          className={cn(
            "flex flex-wrap items-center gap-1.5",
            side === "you" && "justify-end",
          )}
        >
          {poke.shiny && (
            <span className="rounded-full bg-warn/20 px-2 text-[10px] font-semibold uppercase tracking-wide text-warn">
              Shiny
            </span>
          )}
          <span className="font-display text-lg font-semibold">{poke.name}</span>
          <span className="font-mono text-xs tabular-nums text-muted">
            Lv.{lvl}
          </span>
        </div>
        <div
          className={cn(
            "mt-1 flex flex-wrap gap-1",
            side === "you" && "justify-end",
          )}
        >
          {spec?.types.map((t) => (
            <TypeBadge key={t} type={t} />
          ))}
        </div>
        <div className="mt-2 space-y-1">
          <div className="flex justify-between font-mono text-[10px] tabular-nums text-muted">
            <span>HP</span>
            <span>
              {Math.max(0, Math.floor(poke.hp))} / {stats.maxHp}
            </span>
          </div>
          <Meter value={poke.hp} max={stats.maxHp} tone="hp" className="h-2.5" />
        </div>
      </div>
    </div>
  );
}
