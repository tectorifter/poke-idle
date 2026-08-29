import { useEffect, useMemo, useState } from "react";
import { Swords, Trophy } from "lucide-react";
import { useGame } from "@/lib/game/store";
import { useLeague } from "@/lib/game/league-store";
import { currentStage, leagueOrder, trainerOf } from "@/lib/game/league";
import { Sprite } from "./sprite";
import { cn } from "@/lib/utils";

export function LeagueView() {
  const team = useGame((s) => s.team);
  const progress = useLeague((s) => s.progress);
  const rehydrate = useLeague((s) => s.rehydrate);
  const log = useLeague((s) => s.log);
  const lastResult = useLeague((s) => s.lastResult);
  const challenge = useLeague((s) => s.challenge);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    rehydrate();
  }, [rehydrate]);

  const totalStages = useMemo(() => leagueOrder().length, []);
  const stage = currentStage(progress);
  const trainer = stage ? trainerOf(stage) : null;
  const hasLivingPoke = team.some((p) => p.hp > 0);

  const stageLabel = stage
    ? stage.kind === "gym"
      ? `Gym ${stage.gym.number} — ${stage.gym.type}`
      : stage.kind === "elite-four"
        ? "Elite Four"
        : "Champion"
    : "League cleared";

  return (
    <div className="h-full overflow-y-auto px-4 pb-4 pt-3">
      <div className="flex items-center gap-2">
        <Trophy className="size-5 text-accent" />
        <h2 className="font-display text-xl font-semibold tracking-tight">Pokemon League</h2>
      </div>

      <div className="mt-2 flex items-center justify-between text-xs text-muted">
        <span>
          Stage {Math.min(progress.stageIndex + 1, totalStages)} / {totalStages}
        </span>
        <span>Runs cleared: {progress.runsCompleted}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-300"
          style={{ width: `${(progress.stageIndex / totalStages) * 100}%` }}
        />
      </div>

      {trainer ? (
        <div className="mt-4 rounded-2xl bg-surface p-4 shadow-border">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">{stageLabel}</div>
          <div className="mt-1 font-display text-lg font-semibold">{trainer.name}</div>
          {trainer.title && <div className="text-xs text-muted">{trainer.title}</div>}

          <div className="mt-3 flex flex-wrap gap-2">
            {trainer.team.map((p, i) => (
              <div key={i} className="flex flex-col items-center rounded-xl bg-surface-2 px-2 py-1.5">
                <Sprite name={p.name} size={40} />
                <span className="mt-0.5 text-[10px] text-muted">Lv.{p.level}</span>
              </div>
            ))}
          </div>

          <button
            type="button"
            disabled={!hasLivingPoke || busy}
            className={cn(
              "mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-sm font-semibold",
              hasLivingPoke ? "bg-accent text-white" : "bg-surface-2 text-muted",
            )}
            onClick={() => {
              setBusy(true);
              const healedOrDamagedTeam = challenge(team);
              useGame.setState({ team: healedOrDamagedTeam });
              setBusy(false);
            }}
          >
            <Swords className="size-4" />
            {hasLivingPoke ? "Challenge" : "Team fainted — heal first"}
          </button>
        </div>
      ) : (
        <div className="mt-4 rounded-2xl bg-surface p-4 text-center text-sm text-muted shadow-border">
          League complete — come back after a reset.
        </div>
      )}

      {lastResult !== "none" && (
        <div
          className={cn(
            "mt-3 rounded-2xl px-4 py-2 text-center text-sm font-semibold",
            lastResult === "win" ? "bg-hp/20 text-hp" : "bg-danger/20 text-danger",
          )}
        >
          {lastResult === "win" ? "Victory! +8 prestige for the whole team, healed, advancing." : "Defeated — run reset to Gym 1."}
        </div>
      )}

      {log.length > 0 && (
        <div className="mt-3 max-h-56 space-y-1 overflow-y-auto rounded-2xl bg-surface p-3 font-mono text-[11px] text-muted shadow-border">
          {log.map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </div>
      )}
    </div>
  );
}
