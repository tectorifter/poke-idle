import { useState } from "react";
import {
  anyMegaOwned,
  baseSpeciesOf,
  dynamaxUnlocked,
  gmaxFormFor,
  megaFormsFor,
  teraUnlocked,
} from "@/lib/game/dex";
import type { AnomalyKind } from "@/lib/game/dex";
import { useGame } from "@/lib/game/store";
import { useLeague } from "@/lib/game/league-store";
import { cn } from "@/lib/utils";

const KIND_STYLE: Record<AnomalyKind, { label: string; on: string; ready: string }> = {
  mega: { label: "Mega", on: "bg-fuchsia-500 ring-2 ring-fuchsia-300", ready: "bg-fuchsia-500" },
  dynamax: { label: "Dynamax", on: "bg-red-500 ring-2 ring-red-300", ready: "bg-red-500" },
  tera: { label: "Tera", on: "bg-teal-500 ring-2 ring-teal-300", ready: "bg-teal-500" },
};

type Btn = {
  kind: AnomalyKind;
  /** rendered sub-label under the name */
  status: string;
  /** active right now on the current mon */
  active: boolean;
  /** clickable */
  enabled: boolean;
  /** dim / greyed */
  muted: boolean;
  onClick: () => void;
};

function ActivationButton({ b, forms, onPick }: { b: Btn; forms: string[]; onPick: (f: string) => void }) {
  const [picking, setPicking] = useState(false);
  const st = KIND_STYLE[b.kind];

  if (picking && forms.length > 1) {
    return (
      <div className="flex h-14 gap-1">
        {forms.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => {
              onPick(f);
              setPicking(false);
            }}
            className="flex flex-1 items-center justify-center rounded-2xl bg-fuchsia-500 text-xs font-bold text-white"
          >
            {f.replace(/^M-/, "").split(" ").pop()}
          </button>
        ))}
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={!b.enabled}
      onClick={() => {
        if (b.kind === "mega" && forms.length > 1) setPicking(true);
        else b.onClick();
      }}
      className={cn(
        "flex h-14 flex-col items-center justify-center rounded-2xl text-xs font-semibold text-white",
        b.active ? st.on : b.muted ? "bg-surface-2 text-muted" : st.ready,
      )}
    >
      {st.label}
      <span className="text-[10px] font-normal opacity-80">{b.status}</span>
    </button>
  );
}

function Bar({ btns, forms, onPick }: { btns: Btn[]; forms: string[]; onPick: (f: string) => void }) {
  if (!btns.length) return null;
  return (
    <div className={cn("grid gap-2", btns.length === 3 ? "grid-cols-3" : btns.length === 2 ? "grid-cols-2" : "grid-cols-1")}>
      {btns.map((b) => (
        <ActivationButton key={b.kind} b={b} forms={b.kind === "mega" ? forms : []} onPick={onPick} />
      ))}
    </div>
  );
}

/** Wild-combat activation row — cooldown driven (6 defeats active / 10 to recharge). */
export function WildActivationBar() {
  const dex = useGame((s) => s.dex);
  const anomalyCleared = useGame((s) => s.anomalyCleared);
  const team = useGame((s) => s.team);
  const active = useGame((s) => s.active);
  const enemy = useGame((s) => s.enemy);
  const wa = useGame((s) => s.wildActivations);
  const wr = useGame((s) => s.wildRecharge);
  const activate = useGame((s) => s.activateWild);

  const mon = team[active];
  if (!mon) return null;

  const showMega = anyMegaOwned(dex);
  const showDyn = dynamaxUnlocked(anomalyCleared);
  const showTera = teraUnlocked(dex);
  if (!showMega && !showDyn && !showTera) return null;

  const megaForms = megaFormsFor(dex, mon.name);
  const canFight = !!enemy && enemy.hp > 0;
  const isRayquaza = baseSpeciesOf(mon.name) === "Rayquaza";

  const build = (kind: AnomalyKind, unlockedForMon: boolean): Btn => {
    const rec = wa[kind];
    const onThisMon = rec?.uid === mon.uid;
    const onOtherMon = !!rec && !onThisMon;
    const recharge = wr[kind];
    // Rayquaza Mega-Evolves via a known Dragon Ascent, not this button.
    if (kind === "mega" && isRayquaza) {
      return {
        kind,
        active: onThisMon,
        status: onThisMon ? `Active · ${rec!.defeatsLeft}` : "Dragon Ascent",
        enabled: false,
        muted: !onThisMon,
        onClick: () => {},
      };
    }
    let status = "Ready";
    let enabled = canFight && unlockedForMon && !rec && recharge === 0;
    let muted = !enabled && !onThisMon;
    if (onThisMon) status = `Active · ${rec!.defeatsLeft}`;
    else if (onOtherMon) status = "In use";
    else if (recharge > 0) status = `Recharge · ${recharge}`;
    else if (!unlockedForMon) status = kind === "mega" ? "No Mega" : "Locked";
    return { kind, status, active: onThisMon, enabled, muted, onClick: () => activate(kind) };
  };

  const btns: Btn[] = [];
  if (showMega) btns.push(build("mega", megaForms.length > 0));
  if (showDyn) btns.push(build("dynamax", true));
  if (showTera) btns.push(build("tera", true));

  return (
    <Bar btns={btns} forms={megaForms} onPick={(f) => activate("mega", f)} />
  );
}

/** League activation row — one Mega + one Tera + one Dyna/Gmax per trainer fight. */
export function LeagueActivationBar() {
  const dex = useGame((s) => s.dex);
  const anomalyCleared = useGame((s) => s.anomalyCleared);
  const team = useGame((s) => s.team);
  const active = useGame((s) => s.active);
  const battle = useLeague((s) => s.battle);
  const activate = useLeague((s) => s.activateLeague);

  const mon = team[active];
  if (!battle || battle.result !== "fighting" || !mon) return null;

  const showMega = anyMegaOwned(dex);
  const showDyn = dynamaxUnlocked(anomalyCleared);
  const showTera = teraUnlocked(dex);
  if (!showMega && !showDyn && !showTera) return null;

  const megaForms = megaFormsFor(dex, mon.name);
  const { leagueForms: lf, formsUsed } = battle;
  const now = Date.now();
  const isRayquaza = baseSpeciesOf(mon.name) === "Rayquaza";

  const build = (kind: AnomalyKind, unlockedForMon: boolean): Btn => {
    const rec = lf[kind];
    const onThisMon = rec?.uid === mon.uid;
    if (kind === "mega" && isRayquaza) {
      return {
        kind,
        active: onThisMon,
        status: onThisMon ? "Active" : "Dragon Ascent",
        enabled: false,
        muted: !onThisMon,
        onClick: () => {},
      };
    }
    let status = "Ready";
    let enabled = unlockedForMon && !formsUsed[kind] && mon.hp > 0;
    if (kind === "dynamax" && lf.dynamax && now < lf.dynamax.until) {
      status = `${Math.ceil((lf.dynamax.until - now) / 1000)}s`;
      enabled = false;
    } else if (onThisMon) {
      status = "Active";
      enabled = false;
    } else if (formsUsed[kind]) {
      status = "Used";
      enabled = false;
    } else if (!unlockedForMon) {
      status = kind === "mega" ? "No Mega" : "Locked";
    }
    return { kind, status, active: onThisMon, enabled, muted: !enabled && !onThisMon, onClick: () => activate(kind) };
  };

  const btns: Btn[] = [];
  if (showMega) btns.push(build("mega", megaForms.length > 0));
  if (showDyn) btns.push(build("dynamax", true));
  if (showTera) btns.push(build("tera", true));

  return <Bar btns={btns} forms={megaForms} onPick={(f) => activate("mega", f)} />;
}
