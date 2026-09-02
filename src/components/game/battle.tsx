import { useRef, useState } from "react";
import { Pause, Play, Scissors, Shield, Sparkles, Swords } from "lucide-react";
import { speciesByName } from "@/lib/game/dex";
import { TYPE_COLOR } from "@/lib/game/type-chart";
import {
  combatStats,
  levelOf,
  attacksPerSecond,
  uniqueCaughtBonus,
  playerMaxHp,
  playerLevelOf,
  playerThisLevelExp,
  playerNextLevelExp,
  BALL_META,
  CATCH_TIER_ORDER,
  tierIndex,
} from "@/lib/game/formulas";
import { chosenMoves } from "@/lib/game/learnsets";
import type { MoveData } from "@/lib/game/moves";
import type { OwnedPoke } from "@/lib/game/types";
import { ROUTES, useGame, uniqueCaught } from "@/lib/game/store";
import { cn } from "@/lib/utils";
import { Meter } from "./bars";
import { Sprite } from "./sprite";
import { TypeBadge } from "./type-badge";
import { WildActivationBar } from "./activation-bar";
import { BallIcon } from "./ball-icon";

/** Manual-catch button: tap to throw the selected ball, hold to pick a ball. */
function CatchBallButton() {
  const selectedBall = useGame((s) => s.selectedBall);
  const catchTier = useGame((s) => s.catchTier);
  const ballCharges = useGame((s) => s.ballCharges);
  const manualCatch = useGame((s) => s.manualCatch);
  const setSelectedBall = useGame((s) => s.setSelectedBall);
  const [pickerOpen, setPickerOpen] = useState(false);
  const holdTimer = useRef<number | undefined>(undefined);
  const held = useRef(false);

  const unlocked = CATCH_TIER_ORDER.slice(0, tierIndex(catchTier) + 1);
  const charges = ballCharges[selectedBall] ?? 0;

  return (
    <div className="relative shrink-0">
      {pickerOpen && (
        <>
          <div className="fixed inset-0 z-10" onPointerDown={() => setPickerOpen(false)} />
          <div className="absolute bottom-full left-0 z-20 mb-2 flex gap-1 rounded-2xl bg-surface p-1.5 shadow-border">
            {unlocked.map((b) => (
              <button
                key={b}
                type="button"
                title={BALL_META[b].label}
                onClick={() => {
                  setSelectedBall(b);
                  setPickerOpen(false);
                }}
                className={cn(
                  "relative grid size-10 place-items-center rounded-xl",
                  b === selectedBall ? "bg-accent/20 ring-1 ring-accent" : "bg-surface-2",
                )}
              >
                <BallIcon ball={b} className="size-6" />
                <span className="absolute -bottom-1 -right-1 rounded-full bg-bg px-1 font-mono text-[9px] tabular-nums text-muted">
                  {ballCharges[b] ?? 0}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
      <button
        type="button"
        aria-label={`Throw ${BALL_META[selectedBall].label} (${charges} left) — hold to switch`}
        onPointerDown={() => {
          held.current = false;
          holdTimer.current = window.setTimeout(() => {
            held.current = true;
            setPickerOpen(true);
          }, 350);
        }}
        onPointerUp={() => {
          window.clearTimeout(holdTimer.current);
          if (!held.current && !pickerOpen) manualCatch();
        }}
        onPointerLeave={() => window.clearTimeout(holdTimer.current)}
        className={cn(
          "relative grid size-11 place-items-center rounded-full bg-surface shadow-border active:scale-95",
          charges === 0 && "opacity-50",
        )}
      >
        <BallIcon ball={selectedBall} className="size-6" />
        <span className="absolute -bottom-1 -right-1 rounded-full bg-bg px-1 font-mono text-[9px] tabular-nums text-muted">
          {charges}
        </span>
      </button>
    </div>
  );
}

/** Compact party control: shows only the leading mon; tap/hold reveals the rest
 *  of the party so the player can swap the lead fighter. */
function PartyButton() {
  const team = useGame((s) => s.team);
  const active = useGame((s) => s.active);
  const setActive = useGame((s) => s.setActive);
  const [open, setOpen] = useState(false);
  const holdTimer = useRef<number | undefined>(undefined);
  const held = useRef(false);

  const lead = team[active];
  if (!lead) return null;

  return (
    <div className="relative shrink-0">
      {open && (
        <>
          <div className="fixed inset-0 z-10" onPointerDown={() => setOpen(false)} />
          <div className="absolute bottom-full left-0 z-20 mb-2 flex w-max max-w-[240px] flex-wrap gap-1 rounded-2xl bg-surface p-1.5 shadow-border">
            {team.map((p, i) => (
              <button
                key={p.uid}
                type="button"
                onClick={() => {
                  setActive(i);
                  setOpen(false);
                }}
                className={cn(
                  "grid size-11 place-items-center rounded-xl",
                  i === active ? "bg-accent/20 ring-1 ring-accent" : "bg-surface-2",
                  p.hp <= 0 && "opacity-40",
                )}
              >
                <Sprite name={p.name} shiny={p.shiny} size={36} />
              </button>
            ))}
          </div>
        </>
      )}
      <button
        type="button"
        aria-label={`Lead: ${lead.name} — hold to swap`}
        onPointerDown={() => {
          held.current = false;
          holdTimer.current = window.setTimeout(() => {
            held.current = true;
            setOpen(true);
          }, 350);
        }}
        onPointerUp={() => {
          window.clearTimeout(holdTimer.current);
          if (!held.current) setOpen((o) => !o);
        }}
        onPointerLeave={() => window.clearTimeout(holdTimer.current)}
        className="grid size-11 place-items-center rounded-2xl bg-surface shadow-border active:scale-95"
      >
        <Sprite name={lead.name} shiny={lead.shiny} size={40} />
      </button>
    </div>
  );
}

/** Compact False Swipe toggle — same footprint as the catch button. */
function FalseSwipeButton() {
  const falseSwipe = useGame((s) => s.falseSwipe);
  const toggle = useGame((s) => s.toggleFalseSwipe);
  return (
    <button
      type="button"
      onClick={toggle}
      title="False Swipe"
      aria-label={`False Swipe ${falseSwipe ? "on" : "off"}`}
      className={cn(
        "grid size-11 shrink-0 place-items-center rounded-full shadow-border active:scale-95",
        falseSwipe ? "bg-warn text-black" : "bg-surface text-muted",
      )}
    >
      <Scissors className="size-5" />
    </button>
  );
}

const CATEGORY_ICON: Record<MoveData["category"], typeof Swords> = {
  Physical: Swords,
  Special: Sparkles,
  Status: Shield,
};

/** The active mon's four move slots — its best learnable moves for now; the
 *  move editor (next phase) will let the player choose. */
function movesFor(mon: OwnedPoke | undefined): (MoveData | null)[] {
  const picked = mon ? chosenMoves(mon, levelOf(mon)) : [];
  return [0, 1, 2, 3].map((i) => picked[i] ?? null);
}

function MoveButton({
  index,
  move,
  selected,
  onSelect,
}: {
  index: number;
  move: MoveData | null;
  selected: boolean;
  onSelect: () => void;
}) {
  const Icon = move ? CATEGORY_ICON[move.category] : null;
  const color = move ? TYPE_COLOR[move.type] ?? "#8b8f9a" : undefined;
  return (
    <button
      type="button"
      disabled={!move}
      onClick={onSelect}
      aria-label={
        move ? `${move.name} — ${move.type} ${move.category}, ${move.power} power` : `Move ${index + 1} (empty)`
      }
      style={move ? { backgroundColor: color } : undefined}
      className={cn(
        "flex min-h-0 flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-[10px] font-bold leading-tight",
        move
          ? selected
            ? "text-white ring-2 ring-white"
            : "text-white/85 opacity-60"
          : "border border-dashed border-border bg-surface-2 text-subtle",
      )}
    >
      {Icon ? <Icon className="size-3.5" /> : <span className="text-sm leading-none">·</span>}
      <span className="w-full truncate text-center">{move ? move.name : `Move ${index + 1}`}</span>
      {move && move.category !== "Status" && (
        <span className="text-[9px] font-normal opacity-80">{move.power}</span>
      )}
    </button>
  );
}

/** 2×2 grid of move buttons. */
function MoveGrid() {
  const team = useGame((s) => s.team);
  const active = useGame((s) => s.active);
  const moves = movesFor(team[active]);
  // HOOK: which slot is the "selected" move to use in battle.
  const [selected, setSelected] = useState(0);
  return (
    <div className="grid flex-1 grid-cols-2 grid-rows-2 gap-1.5">
      {moves.map((m, i) => (
        <MoveButton
          key={i}
          index={i}
          move={m}
          selected={i === selected}
          onSelect={() => setSelected(i)}
        />
      ))}
    </div>
  );
}

/** One `label  value` cell in the active mon's 2×3 stat grid. */
function StatCell({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted">{label}</span>
      <span className="text-fg">{Math.floor(value)}</span>
    </div>
  );
}

export function BattleView() {
  const enemy = useGame((s) => s.enemy);
  const team = useGame((s) => s.team);
  const active = useGame((s) => s.active);
  const region = useGame((s) => s.region);
  const route = useGame((s) => s.route);
  const pokeyen = useGame((s) => s.pokeyen);
  const playerPrestige = useGame((s) => s.playerPrestige);
  const playerHp = useGame((s) => s.playerHp);
  const playerExp = useGame((s) => s.playerExp);
  const dex = useGame((s) => s.dex);
  const playerHit = useGame((s) => s.playerHit);
  const enemyHit = useGame((s) => s.enemyHit);
  const paused = useGame((s) => s.paused);
  const manualTap = useGame((s) => s.manualTap);
  const log = useGame((s) => s.log);

  const player = team[active];
  const routeName = ROUTES[region]?.[route]?.name ?? route;
  const owned = uniqueCaught(dex);
  const routePokes = ROUTES[region]?.[route]?.pokes ?? [];
  const routeOwned = routePokes.filter((name) => (dex[name] ?? 0) >= 5).length;
  const uniqueBonus = uniqueCaughtBonus(owned);

  const pStats = player
    ? combatStats(player, {
        isPlayer: true,
        playerPrestige,
        uniqueBonus,
      })
    : null;
  const playerLvl = playerLevelOf(playerExp);
  const playerMax = playerMaxHp(playerLvl, playerPrestige);
  const xp0 = playerThisLevelExp(playerLvl);
  const xp1 = playerNextLevelExp(playerLvl);

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
              {paused
                ? "Paused"
                : pStats
                  ? `Tap · ${attacksPerSecond(pStats.spe).toFixed(1)} atk/s`
                  : "Tap"}
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
                    {Math.max(0, Math.floor(playerHp))} / {playerMax}
                  </span>
                </div>
                <Meter
                  value={playerHp}
                  max={playerMax}
                  tone="hp"
                  className="h-2.5 mt-1"
                />
              </div>

              {/* EXP */}
              <div>
                <div className="flex justify-between font-mono text-[10px] tabular-nums text-muted">
                  <span>Player Lv. {playerLvl}</span>
                  <span>
                    {Math.max(0, Math.floor(playerExp - xp0))} /{" "}
                    {Math.max(1, Math.floor(xp1 - xp0))}
                  </span>
                </div>
                <Meter
                  value={playerExp - xp0}
                  max={xp1 - xp0}
                  tone="xp"
                  className="mt-1"
                />
              </div>

              {/* Yen + Caught */}
              <div className="flex justify-between pt-1 font-mono text-xs tabular-nums">
                <span className="text-warn">¥ {pokeyen.toLocaleString()}</span>
                <span className="text-muted">
                  Caught {routeOwned}/{routePokes.length}
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
                <div className="grid shrink-0 grid-cols-2 gap-x-3 gap-y-0.5 font-mono text-[10px] tabular-nums leading-relaxed min-w-[128px]">
                  <StatCell label="HP" value={pStats.maxHp} />
                  <StatCell label="Speed" value={pStats.spe} />
                  <StatCell label="Atk" value={pStats.atk} />
                  <StatCell label="Sp.A" value={pStats.spa} />
                  <StatCell label="Def" value={pStats.def} />
                  <StatCell label="Sp.D" value={pStats.spd} />
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

      {/* ── Combat controls ── */}
      <div className="shrink-0 border-t border-border bg-bg px-3 pb-2 pt-2">
        <WildActivationBar />
        <div className="mt-2 flex gap-2">
          <div className="flex shrink-0 flex-col gap-1.5">
            <PartyButton />
            <CatchBallButton />
            <FalseSwipeButton />
          </div>
          <MoveGrid />
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
          isBack={side === "you"}
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
