import { useEffect, useMemo, useState } from "react";
import { Heart, Swords, Trophy } from "lucide-react";
import { useGame } from "@/lib/game/store";
import { combatStats } from "@/lib/game/formulas";
import { currentStage, leagueOrder, trainerOf } from "@/lib/game/league";
import { useLeague } from "@/lib/game/league-store";
import type { LeagueProgress } from "@/lib/game/types";
import { cn } from "@/lib/utils";
import { FighterCard } from "./battle";
import { Meter } from "./bars";
import { Sprite } from "./sprite";

export function LeagueView() {
  const team = useGame((s) => s.team);
  const active = useGame((s) => s.active);
  const setActive = useGame((s) => s.setActive);
  const progress = useLeague((s) => s.progress);
  const battle = useLeague((s) => s.battle);
  const rehydrate = useLeague((s) => s.rehydrate);
  const startChallenge = useLeague((s) => s.startChallenge);
  const tick = useLeague((s) => s.tick);
  const cheerUp = useLeague((s) => s.cheerUp);
  const resist = useLeague((s) => s.resist);
  const healOverTime = useLeague((s) => s.healOverTime);
  const clearBattle = useLeague((s) => s.clearBattle);
  const [, forceRender] = useState(0);

  useEffect(() => {
    rehydrate();
  }, [rehydrate]);

  useEffect(() => {
    if (!battle || battle.result !== "fighting") return;
    let raf = 0;
    let last = performance.now();
    const loop = (t: number) => {
      const dt = Math.min((t - last) / 1000, 0.1);
      last = t;
      tick(dt);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [battle?.result, tick]);

  // Purely re-renders cooldown/active countdown labels between real ticks.
  useEffect(() => {
    if (!battle) return;
    const id = setInterval(() => forceRender((n) => n + 1), 250);
    return () => clearInterval(id);
  }, [battle]);

  const totalStages = useMemo(() => leagueOrder().length, []);
  const stage = currentStage(progress);
  const trainer = stage ? trainerOf(stage) : null;
  const hasLivingPoke = team.some((p) => p.hp > 0);
  const now = Date.now();

  const stageLabel = stage
    ? stage.kind === "gym"
      ? `Gym ${stage.gym.number} — ${stage.gym.type}`
      : stage.kind === "elite-four"
        ? "Elite Four"
        : "Champion"
    : "League cleared";

  if (!battle) {
    return (
      <div className="h-full overflow-y-auto px-4 pb-4 pt-3">
        <LeagueHeader progress={progress} totalStages={totalStages} />
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
              disabled={!hasLivingPoke}
              className={cn(
                "mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-sm font-semibold",
                hasLivingPoke ? "bg-accent text-white" : "bg-surface-2 text-muted",
              )}
              onClick={startChallenge}
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
      </div>
    );
  }

  const enemy = battle.enemyTeam[battle.enemyIndex] ?? null;
  const player = team[active];
  const won = battle.result === "win";
  const lost = battle.result === "lose";
  const finished = won || lost;

  const cheerLeft = Math.max(0, battle.buffs.cheerCooldownUntil - now);
  const resistLeft = Math.max(0, battle.buffs.resistCooldownUntil - now);
  const healLeft = Math.max(0, battle.buffs.healCooldownUntil - now);
  const cheerActive = now < battle.buffs.cheerUntil;
  const resistActive = now < battle.buffs.resistUntil;

  return (
    <div className="h-full overflow-y-auto px-4 pb-4 pt-3">
      <LeagueHeader progress={progress} totalStages={totalStages} />

      <div className="mt-3 text-center text-xs text-muted">
        {stageLabel} — {battle.trainer.name}
      </div>

      <div className="mt-2 flex flex-wrap justify-center gap-2">
        {battle.enemyTeam.map((p, i) => (
          <div
            key={i}
            className={cn(
              "flex flex-col items-center rounded-xl bg-surface-2 px-2 py-1.5",
              battle.enemyFainted[i] && "opacity-30 grayscale",
              i === battle.enemyIndex && !battle.enemyFainted[i] && "ring-1 ring-accent",
            )}
          >
            <Sprite name={p.name} size={32} />
          </div>
        ))}
      </div>

      {enemy && <FighterCard poke={enemy} hitAt={0} side="wild" />}
      {player && <FighterCard poke={player} hitAt={0} side="you" />}

      <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
        {team.map((p, i) => {
          const stats = combatStats(p);
          return (
            <button
              key={p.uid}
              type="button"
              onClick={() => setActive(i)}
              disabled={finished}
              className={cn(
                "flex min-w-[64px] flex-col items-center rounded-2xl bg-surface px-2 py-2 shadow-border",
                i === active && "ring-1 ring-accent",
                p.hp <= 0 && "opacity-40",
              )}
            >
              <Sprite name={p.name} shiny={p.shiny} size={36} />
              <Meter value={p.hp} max={stats.maxHp} tone="hp" className="mt-1 w-full" />
            </button>
          );
        })}
      </div>

      {!finished && (
        <div className="mt-3 grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={cheerUp}
            disabled={cheerLeft > 0}
            className={cn(
              "flex h-14 flex-col items-center justify-center rounded-2xl text-xs font-semibold text-white",
              cheerActive ? "bg-hp ring-2 ring-hp" : cheerLeft > 0 ? "bg-surface-2 text-muted" : "bg-hp",
            )}
          >
            Cheer up!
            <span className="text-[10px] font-normal opacity-80">
              {cheerActive ? "Active" : cheerLeft > 0 ? `${Math.ceil(cheerLeft / 1000)}s` : "Ready"}
            </span>
          </button>
          <button
            type="button"
            onClick={resist}
            disabled={resistLeft > 0}
            className={cn(
              "flex h-14 flex-col items-center justify-center rounded-2xl text-xs font-semibold text-white",
              resistActive ? "bg-sky-500 ring-2 ring-sky-400" : resistLeft > 0 ? "bg-surface-2 text-muted" : "bg-sky-500",
            )}
          >
            Resist!
            <span className="text-[10px] font-normal opacity-80">
              {resistActive ? "Active" : resistLeft > 0 ? `${Math.ceil(resistLeft / 1000)}s` : "Ready"}
            </span>
          </button>
          <button
            type="button"
            onClick={healOverTime}
            disabled={healLeft > 0}
            className={cn(
              "flex h-14 flex-col items-center justify-center gap-0.5 rounded-2xl text-xs font-semibold",
              healLeft > 0 ? "bg-surface-2 text-muted" : "bg-accent text-accent-fg",
            )}
          >
            <Heart className="size-4" />
            {healLeft > 0 ? `${Math.ceil(healLeft / 1000)}s` : "Heal"}
          </button>
        </div>
      )}

      {finished && (
        <div className="mt-3 space-y-2">
          <div
            className={cn(
              "rounded-2xl px-4 py-2 text-center text-sm font-semibold",
              won ? "bg-hp/20 text-hp" : "bg-danger/20 text-danger",
            )}
          >
            {won ? "Victory! +1 prestige for the whole team, healed, advancing." : "Defeated — run reset to Gym 1."}
          </div>
          <button
            type="button"
            className="h-11 w-full rounded-2xl bg-accent text-sm font-semibold text-accent-fg"
            onClick={clearBattle}
          >
            Continue
          </button>
        </div>
      )}

      <div className="mt-3 max-h-40 space-y-1 overflow-y-auto rounded-2xl bg-surface p-3 font-mono text-[11px] text-muted shadow-border">
        {[...battle.log].reverse().slice(0, 12).map((line, i) => (
          <div key={i}>{line}</div>
        ))}
      </div>
    </div>
  );
}

function LeagueHeader({ progress, totalStages }: { progress: LeagueProgress; totalStages: number }) {
  return (
    <div>
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
    </div>
  );
}
