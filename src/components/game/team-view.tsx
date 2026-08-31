import { ArrowDownToLine, ArrowUpFromLine, Trash2 } from "lucide-react";
import { speciesByName } from "@/lib/game/dex";
import { combatStats, eligibleEvolutions, levelOf, TEAM_SIZE, uniqueCaughtBonus } from "@/lib/game/formulas";
import { useGame, uniqueCaught } from "@/lib/game/store";
import { cn } from "@/lib/utils";
import { Meter } from "./bars";
import { Sprite } from "./sprite";
import { TypeBadge } from "./type-badge";

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

  return (
    <div className="h-full overflow-y-auto px-4 pb-4 pt-3">
      <h2 className="font-display text-xl font-semibold tracking-tight">Team</h2>
      <p className="text-xs text-muted">
        {team.length}/{TEAM_SIZE} fighting · {storage.length} in PC
        {playerPrestige > 0 && (
          <span className="ml-2 text-accent">Player +{playerPrestige}%</span>
        )}
        {uniqueBonus > 0 && (
          <span className="ml-2 text-hp">+{uniqueBonus} Atk/Def</span>
        )}
      </p>
      <p className="mt-1 text-[11px] text-muted">
        Prestige is global — open{" "}
        <button
          type="button"
          className="underline text-accent"
          onClick={() => setTab("store")}
        >
          Store
        </button>{" "}
        to prestige the player (needs a Lv.100 on the team).
      </p>
      <ul className="mt-3 space-y-2">
        {team.map((p, i) => (
          <PokeRow
            key={p.uid}
            poke={p}
            active={i === active}
            playerPrestige={playerPrestige}
            uniqueBonus={uniqueBonus}
            onSelect={() => setActive(i)}
            onEvolve={(to) => evolve(p.uid, to)}
            onMove={() => moveToStorage(p.uid)}
            moveLabel="PC"
            MoveIcon={ArrowDownToLine}
            onRelease={team.length > 1 ? () => release(p.uid, "team") : undefined}
          />
        ))}
      </ul>
      {storage.length > 0 && (
        <>
          <h3 className="mt-6 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
            PC storage
          </h3>
          <ul className="mt-2 space-y-2">
            {storage.map((p) => (
              <PokeRow
                key={p.uid}
                poke={p}
                playerPrestige={playerPrestige}
                uniqueBonus={uniqueBonus}
                onEvolve={(to) => evolve(p.uid, to)}
                onMove={
                  team.length < TEAM_SIZE ? () => moveToTeam(p.uid) : undefined
                }
                moveLabel="Team"
                MoveIcon={ArrowUpFromLine}
                onRelease={() => release(p.uid, "storage")}
              />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function PokeRow({
  poke,
  active,
  playerPrestige,
  uniqueBonus,
  onSelect,
  onEvolve,
  onMove,
  moveLabel,
  MoveIcon,
  onRelease,
}: {
  poke: import("@/lib/game/types").OwnedPoke;
  active?: boolean;
  playerPrestige: number;
  uniqueBonus: number;
  onSelect?: () => void;
  onEvolve: (to: string) => void;
  onMove?: () => void;
  moveLabel: string;
  MoveIcon: typeof ArrowDownToLine;
  onRelease?: () => void;
}) {
  const spec = speciesByName(poke.name);
  const stats = combatStats(poke, {
    isPlayer: true,
    playerPrestige,
    uniqueBonus,
  });
  const lvl = levelOf(poke);
  const evos = eligibleEvolutions(poke);
  return (
    <li
      className={cn(
        "rounded-2xl bg-surface p-3 shadow-border",
        active && "ring-1 ring-accent",
      )}
      onClick={onSelect}
    >
      <div className="flex items-center gap-3">
        <Sprite name={poke.name} shiny={poke.shiny} size={56} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium">{poke.name}</span>
            <span className="font-mono text-xs tabular-nums text-muted">
              Lv.{lvl}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            {spec?.types.map((t) => (
              <TypeBadge key={t} type={t} />
            ))}
          </div>
          <Meter value={poke.hp} max={stats.maxHp} tone="hp" className="mt-2" />
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {evos.map((e) => (
          <button
            key={e.to}
            type="button"
            onClick={(ev) => {
              ev.stopPropagation();
              onEvolve(e.to);
            }}
            className="h-9 rounded-full bg-accent px-3 text-xs font-semibold text-accent-fg"
          >
            Evolve → {e.to}
          </button>
        ))}
        {onMove && (
          <button
            type="button"
            onClick={(ev) => {
              ev.stopPropagation();
              onMove();
            }}
            className="inline-flex h-9 items-center gap-1 rounded-full bg-surface-2 px-3 text-xs font-medium"
          >
            <MoveIcon className="size-3.5" /> {moveLabel}
          </button>
        )}
        {onRelease && (
          <button
            type="button"
            onClick={(ev) => {
              ev.stopPropagation();
              onRelease();
            }}
            className="inline-flex h-9 items-center gap-1 rounded-full bg-surface-2 px-3 text-xs font-medium text-danger"
          >
            <Trash2 className="size-3.5" /> Release
          </button>
        )}
      </div>
    </li>
  );
}
