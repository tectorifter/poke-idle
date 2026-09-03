import { useState } from "react";
import { useHoldPress } from "./use-hold-press";
import {
  anyMegaOwned,
  baseSpeciesOf,
  dynamaxUnlocked,
  gmaxFormFor,
  megaFormsFor,
  teraFormsFor,
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

/** Short label for a form chip: "X" / "Y" for Megas, "Stellar" / "Terastal"
 *  for Terapagos, else the trailing word. */
function formChipLabel(f: string): string {
  if (f.startsWith("M-")) return f.replace(/^M-/, "").split(" ").pop() ?? f;
  if (f.startsWith("Terapagos-")) return f.replace("Terapagos-", "");
  return f.split(" ").pop() ?? f;
}

function ActivationButton({
  b,
  forms,
  onPick,
  compact,
}: {
  b: Btn;
  forms: string[];
  onPick: (f: string) => void;
  compact?: boolean;
}) {
  const [picking, setPicking] = useState(false);
  const st = KIND_STYLE[b.kind];
  const h = compact ? "h-10" : "h-14";
  const multi = forms.length > 1;
  // Tap = activate the default form; hold = open the form picker (2+ forms only).
  const press = useHoldPress({
    onTap: () => {
      if (!picking) b.onClick();
    },
    onHold: multi && b.enabled ? () => setPicking(true) : undefined,
    delayMs: 400,
  });

  if (picking && multi) {
    return (
      <div className={cn("flex gap-1", h)}>
        {forms.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => {
              onPick(f);
              setPicking(false);
            }}
            className={cn(
              "flex flex-1 items-center justify-center rounded-2xl text-[11px] font-bold text-white",
              st.ready,
            )}
          >
            {formChipLabel(f)}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setPicking(false)}
          className="flex w-8 items-center justify-center rounded-2xl bg-surface-2 text-xs text-muted"
        >
          ✕
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={!b.enabled}
      {...press}
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl font-semibold text-white",
        h,
        compact ? "text-[10px] leading-tight" : "text-xs",
        b.active ? st.on : b.muted ? "bg-surface-2 text-muted" : st.ready,
      )}
    >
      {st.label}
      {multi && !b.active && <span className="text-[8px] font-normal opacity-70">hold to choose</span>}
      <span className={cn("font-normal opacity-80", compact ? "text-[9px]" : "text-[10px]")}>{b.status}</span>
    </button>
  );
}

function Bar({
  btns,
  formsFor,
  onPick,
  compact,
}: {
  btns: Btn[];
  formsFor: (kind: AnomalyKind) => string[];
  onPick: (kind: AnomalyKind, f: string) => void;
  compact?: boolean;
}) {
  if (!btns.length) return null;
  return (
    <div
      className={cn(
        "grid",
        compact ? "gap-1.5" : "gap-2",
        btns.length === 3 ? "grid-cols-3" : btns.length === 2 ? "grid-cols-2" : "grid-cols-1",
      )}
    >
      {btns.map((b) => (
        <ActivationButton
          key={b.kind}
          b={b}
          forms={formsFor(b.kind)}
          onPick={(f) => onPick(b.kind, f)}
          compact={compact}
        />
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
  const teraForms = teraUnlocked(dex) ? teraFormsFor(dex, mon.name) : [];
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
    <Bar
      btns={btns}
      formsFor={(k) => (k === "mega" ? megaForms : k === "tera" ? teraForms : [])}
      onPick={(k, f) => activate(k, f)}
    />
  );
}

/** League activation row — one Mega + one Tera + one Dyna/Gmax per trainer fight. */
export function LeagueActivationBar({ compact }: { compact?: boolean } = {}) {
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
  const teraForms = teraUnlocked(dex) ? teraFormsFor(dex, mon.name) : [];
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

  return (
    <Bar
      btns={btns}
      formsFor={(k) => (k === "mega" ? megaForms : k === "tera" ? teraForms : [])}
      onPick={(k, f) => activate(k, f)}
      compact={compact}
    />
  );
}
