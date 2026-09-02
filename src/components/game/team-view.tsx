import { useRef, useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, Trash2 } from "lucide-react";
import {
  combatStats,
  eligibleEvolutions,
  evTotal,
  IV_MAX,
  levelOf,
  STAT_KEYS,
  TEAM_SIZE,
  uniqueCaughtBonus,
} from "@/lib/game/formulas";
import { useGame, uniqueCaught } from "@/lib/game/store";
import { cn } from "@/lib/utils";
import { Meter } from "./bars";
import { Sprite } from "./sprite";

export function TeamView() {
  const team = useGame((s) => s.team);
  const storage = useGame((s) => s.storage);
  const active = useGame((s) => s.active);
  const playerPrestige = useGame((s) => s.playerPrestige);
  const dex = useGame((s) => s.dex);
  const setActive = useGame((s) => s.setActive);
  const evolve = useGame((s) => s.evolve);
  const moveToStorage = useGame((s) => s.moveToStorage);
  const moveToTeam = useGame((s) => s.moveToTeam);
  const release = useGame((s) => s.release);
  const setTab = useGame((s) => s.setTab);

  const uniqueBonus = uniqueCaughtBonus(uniqueCaught(dex));
  const showPc = storage.length > 0;

  return (
    <div className="h-full overflow-y-auto px-4 pb-4 pt-3">
      <h2 className="font-display text-xl font-semibold tracking-tight">Team</h2>
      <p className="text-xs text-muted">
        {team.length}/{TEAM_SIZE} fighting · {storage.length} in PC
        {playerPrestige > 0 && <span className="ml-2 text-accent">Player +{playerPrestige}%</span>}
        {uniqueBonus > 0 && <span className="ml-2 text-hp">+{uniqueBonus} Atk/Def</span>}
      </p>
      <p className="mt-1 text-[11px] text-muted">
        Prestige is global — open{" "}
        <button type="button" className="underline text-accent" onClick={() => setTab("store")}>
          Store
        </button>{" "}
        to prestige the player (needs a Lv.100 on the team).
      </p>

      {/* Party — 3 columns */}
      <h3 className="mt-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Party</h3>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {team.map((p, i) => (
          <PokeCell
            key={p.uid}
            poke={p}
            active={i === active}
            playerPrestige={playerPrestige}
            uniqueBonus={uniqueBonus}
            onSelect={() => setActive(i)}
            onEvolve={(to) => evolve(p.uid, to)}
            onMove={team.length > 1 ? () => moveToStorage(p.uid) : undefined}
            MoveIcon={ArrowDownToLine}
            moveTitle="Send to PC"
          />
        ))}
      </div>

      {/* PC storage — under Party, 2 columns */}
      {showPc && (
        <>
          <h3 className="mt-6 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">PC storage</h3>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {storage.map((p) => (
              <PokeCell
                key={p.uid}
                poke={p}
                playerPrestige={playerPrestige}
                uniqueBonus={uniqueBonus}
                onEvolve={(to) => evolve(p.uid, to)}
                onMove={team.length < TEAM_SIZE ? () => moveToTeam(p.uid) : undefined}
                MoveIcon={ArrowUpFromLine}
                moveTitle="Send to Team"
                onRelease={() => release(p.uid, "storage")}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function PokeCell({
  poke,
  active,
  playerPrestige,
  uniqueBonus,
  onSelect,
  onEvolve,
  onMove,
  MoveIcon,
  moveTitle,
  onRelease,
}: {
  poke: import("@/lib/game/types").OwnedPoke;
  active?: boolean;
  playerPrestige: number;
  uniqueBonus: number;
  onSelect?: () => void;
  onEvolve: (to: string) => void;
  onMove?: () => void;
  MoveIcon: typeof ArrowDownToLine;
  moveTitle: string;
  onRelease?: () => void;
}) {
  const stats = combatStats(poke, { isPlayer: true, playerPrestige, uniqueBonus });
  const lvl = levelOf(poke);
  const evos = eligibleEvolutions(poke);
  const ivSum = poke.ivs ? STAT_KEYS.reduce((n, k) => n + (poke.ivs![k] || 0), 0) : 0;
  const evSum = evTotal(poke.evs);
  const [confirmRelease, setConfirmRelease] = useState(false);
  const confirmTimer = useRef<number | undefined>(undefined);

  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-2xl bg-surface p-2 shadow-border",
        onSelect && "cursor-pointer",
        active && "ring-1 ring-accent",
      )}
      onClick={onSelect}
    >
      <div className="grid place-items-center">
        <Sprite name={poke.name} shiny={poke.shiny} animated size={44} />
      </div>
      <div className="flex items-baseline justify-between gap-1">
        <span className="truncate text-[11px] font-medium">{poke.name}</span>
        <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted">Lv.{lvl}</span>
      </div>
      <Meter value={poke.hp} max={stats.maxHp} tone="hp" className="h-1.5" />
      <div className="font-mono text-[9px] tabular-nums text-muted">
        IV {ivSum}/{IV_MAX * 6} · EV {evSum}/510
      </div>

      <div className="mt-0.5 flex flex-wrap gap-1">
        {evos.map((e) => (
          <button
            key={e.to}
            type="button"
            onClick={(ev) => {
              ev.stopPropagation();
              onEvolve(e.to);
            }}
            className="h-7 w-full truncate rounded-lg bg-accent px-1.5 text-[10px] font-semibold text-accent-fg"
          >
            ▲ {e.to}
          </button>
        ))}
        {onMove && (
          <button
            type="button"
            title={moveTitle}
            aria-label={moveTitle}
            onClick={(ev) => {
              ev.stopPropagation();
              onMove();
            }}
            className="grid size-7 shrink-0 place-items-center rounded-lg bg-surface-2"
          >
            <MoveIcon className="size-3.5" />
          </button>
        )}
        {onRelease && (
          <button
            type="button"
            onClick={(ev) => {
              ev.stopPropagation();
              if (confirmRelease) {
                window.clearTimeout(confirmTimer.current);
                onRelease();
              } else {
                setConfirmRelease(true);
                confirmTimer.current = window.setTimeout(() => setConfirmRelease(false), 3000);
              }
            }}
            className={cn(
              "inline-flex h-7 flex-1 items-center justify-center gap-1 rounded-lg px-1.5 text-[10px] font-semibold",
              confirmRelease ? "bg-danger text-white" : "bg-surface-2 text-danger",
            )}
          >
            <Trash2 className="size-3" /> {confirmRelease ? "Confirm?" : "Release"}
          </button>
        )}
      </div>
    </div>
  );
}
