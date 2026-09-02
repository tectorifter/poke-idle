import { create } from "zustand";
import {
  ROUTES,
  REGIONS,
  REGION_UNLOCK,
  speciesByName,
  POKEDEX,
  SPECIES_UNLOCK,
  GMAX_FORMS,
  isRouteUnlocked,
  isPermanentAnomalyCatch,
  baseSpeciesOf,
  megaFormsFor,
  gmaxFormFor,
  dynamaxUnlocked,
  teraUnlocked,
} from "./dex";
import type { AnomalyKind } from "./dex";
import { rollNature } from "./natures";
import { leagueEnemyPrestige } from "./league";
import { useLeague } from "./league-store";
import {
  attackDamage,
  BENCH_EXP_SHARE,
  STORAGE_EXP_SHARE,
  catchChancePercentPermanent,
  combatStats,
  expAtLevel,
  expReward,
  HEAL_COOLDOWN_MS,
  levelOf,
  makeOwned,
  pickWeighted,
  randomLevel,
  rollTeraType,
  rollIVs,
  zeroEVs,
  evYield,
  addEVs,
  attackIntervalMs,
  WILD_FORM_DEFEATS,
  WILD_RECHARGE_DEFEATS,
  SHINY_ODDS,
  TEAM_SIZE,
  MAX_AUTO_LEVEL,
  autoTapCost,
  autoTapMsFromLevel,
  catchUpgradeCost,
  ballChargeCost,
  BALL_META,
  CATCH_TIER_ORDER,
  manualCatchChance,
  tierIndex,
  pokeyenReward,
  uniqueCaughtBonus,
  playerMaxHp,
  playerLevelOf,
} from "./formulas";
import type { FormKind } from "./formulas";
import type {
  BallCharges,
  CatchMode,
  CatchTier,
  DexFlag,
  LogLine,
  OwnedPoke,
  RechargeCounts,
  SaveBlob,
  Stats,
  TabId,
  WildActivation,
  WildForms,
} from "./types";

const SAVE_KEY = "pokeidle-save-v5";
const LEGACY_SAVE_KEY = "pokeidle-save-v4";
const SAVE_VERSION = 5;

/** Old single "Anomalies" region → the four themed anomaly regions, keyed by
 *  the route id the player was last standing on. */
const ANOMALY_REGION_MIGRATION: Record<string, [string, string]> = {
  mega: ["Kalos Anomaly", "mega"],
  primal: ["Kalos Anomaly", "primal"],
  ultrabeast: ["Alola Anomaly", "ultraspace"],
  ultraspace: ["Alola Anomaly", "ultraspace"],
  dynamax: ["Galar Anomaly", "dynamax"],
  tera: ["Paldea Anomaly", "tera"],
};
const MAX_LOG = 24;

const defaultStats = (): Stats => ({
  seen: 0,
  beaten: 0,
  caught: 0,
  shinySeen: 0,
  shinyCaught: 0,
  damage: 0,
});

function uniqueCaught(dex: Record<string, DexFlag>): number {
  return Object.values(dex).filter((f) => f >= 5).length;
}

function hasPokemon(
  team: OwnedPoke[],
  storage: OwnedPoke[],
  name: string,
  shiny: boolean,
): boolean {
  return (
    team.some((p) => p.name === name && p.shiny === shiny) ||
    storage.some((p) => p.name === name && p.shiny === shiny)
  );
}

function loadSave(): Partial<SaveBlob> | null {
  try {
    const raw =
      localStorage.getItem(SAVE_KEY) ??
      localStorage.getItem(LEGACY_SAVE_KEY);

    if (!raw) return null;
    return JSON.parse(raw) as SaveBlob;
  } catch {
    return null;
  }
}

let logSeq = 1;
/** ms until the player's active mon is *allowed* its next attack (Speed cap). 0 = ready. */
let playerAtkCd = 0;
/** ms until the enemy takes its next (automatic) attack. 0 = ready. */
let enemyAtkCd = 0;
/** Auto-tap timer accumulator (ms). */
let autoTapAcc = 0;
/** Queued tap requests (auto-tap + manual). Consumed at the Speed-allowed rate. */
let pendingTaps = 0;
const MAX_PENDING_TAPS = 6;
let uiAcc = 0;
let saveAcc = 0;
let lastManualTap = 0;
let lastManualCatch = 0;

// ─── Wild anomaly-activation helpers ──────────────────────────────────────────
const freshBallCharges = (): BallCharges => ({ pokeball: 10, greatball: 0, ultraball: 0, timerball: 0 });
function normalizeCharges(raw: Partial<BallCharges> | undefined): BallCharges {
  const base = raw ? { pokeball: 0, greatball: 0, ultraball: 0, timerball: 0 } : freshBallCharges();
  for (const b of CATCH_TIER_ORDER) {
    const n = Number(raw?.[b]);
    base[b] = Number.isFinite(n) && n > 0 ? Math.floor(n) : base[b];
  }
  return base;
}

const ANOMALY_KINDS: AnomalyKind[] = ["mega", "dynamax", "tera"];
const ACTIVATION_LABEL: Record<AnomalyKind, string> = {
  mega: "Mega Evolution",
  dynamax: "Dynamax",
  tera: "Terastallization",
};
const freshWildForms = (): WildForms => ({ mega: null, dynamax: null, tera: null });
const freshRecharge = (): RechargeCounts => ({ mega: 0, dynamax: 0, tera: 0 });

/** Drop activations whose target mon is no longer on the team. */
function pruneActivations(wa: WildForms, team: OwnedPoke[]): WildForms {
  const live = new Set(team.map((p) => p.uid));
  const out = { ...wa };
  for (const k of ANOMALY_KINDS) if (out[k] && !live.has(out[k]!.uid)) out[k] = null;
  return out;
}

/** Effective attacker for a wild-combat mon: swaps to the Mega / G-Max species
 *  and reports the form kind + tera type for the damage formula. */
function wildEffective(
  mon: OwnedPoke,
  wa: WildForms,
): { poke: OwnedPoke; form?: FormKind; teraType?: string } {
  if (wa.mega && wa.mega.uid === mon.uid && wa.mega.formName)
    return { poke: { ...mon, name: wa.mega.formName }, form: "mega" };
  if (wa.dynamax && wa.dynamax.uid === mon.uid)
    return wa.dynamax.formName
      ? { poke: { ...mon, name: wa.dynamax.formName }, form: "gmax" }
      : { poke: mon, form: "dynamax" };
  if (wa.tera && wa.tera.uid === mon.uid)
    return { poke: mon, form: "tera", teraType: mon.teraType };
  return { poke: mon };
}

/** One wild defeat: tick every live activation's duration and every recharge
 *  counter. Returns the next {wa, wr} plus any log lines to emit. */
function tickWildAnomalies(
  wa: WildForms,
  wr: RechargeCounts,
): { wa: WildForms; wr: RechargeCounts; expired: AnomalyKind[] } {
  const nextWa = { ...wa };
  const nextWr = { ...wr };
  const expired: AnomalyKind[] = [];
  for (const k of ANOMALY_KINDS) {
    const a = nextWa[k];
    if (a) {
      const left = a.defeatsLeft - 1;
      if (left <= 0) {
        nextWa[k] = null;
        nextWr[k] = WILD_RECHARGE_DEFEATS;
        expired.push(k);
      } else {
        nextWa[k] = { ...a, defeatsLeft: left };
      }
    } else if (nextWr[k] > 0) {
      nextWr[k] = nextWr[k] - 1;
    }
  }
  return { wa: nextWa, wr: nextWr, expired };
}
/** Timestamp (ms) when the next wild encounter may spawn. 0 = ready now. */
let respawnAt = 0;
const RESPAWN_DELAY_MS = 200;

export type GameState = {
  started: boolean;
  tab: TabId;
  team: OwnedPoke[];
  storage: OwnedPoke[];
  active: number;
  enemy: OwnedPoke | null;
  pokeyen: number;
  /** Global player prestige — only the player prestiged now. */
  playerPrestige: number;
  playerHp: number;
  playerExp: number;
  autoTapLevel: number; // 0–25
  catchTier: CatchTier;
  catchLevel: number; // 1–10
  /** Ball the manual-catch button throws AND the Store buys charges for. */
  selectedBall: CatchTier;
  /** Manual-throw charges per ball type. */
  ballCharges: BallCharges;
  /** Always-on catch; only filters which mons are attempted. */
  catchMode: CatchMode;
  region: string;
  route: string;
  dex: Record<string, DexFlag>;
  stats: Stats;
  lastHeal: number;
  anomalyCleared: Record<string, boolean>;
  /** Multiplier on the base 1/2000 wild Gigantamax replacement chance in Galar. */
  gmaxChanceMult: number;
  /** Live temporary anomaly activations for wild combat (one per kind, party-wide). */
  wildActivations: WildForms;
  /** Wild defeats left until each anomaly type can be activated again. */
  wildRecharge: RechargeCounts;
  /** When on, wild HP is clamped to a floor of 1 (nothing can be knocked out). */
  falseSwipe: boolean;
  log: LogLine[];
  paused: boolean;
  playerHit: number;
  enemyHit: number;
  lastCatch: "none" | "caught" | "escaped" | "shiny";
  now: number;
};

type GameActions = {
  startWith: (name: string) => void;
  step: (dt: number) => void;
  manualTap: () => void;
  setTab: (tab: TabId) => void;
  setRoute: (region: string, route: string) => void;
  setActive: (index: number) => void;
  setCatchMode: (mode: CatchMode) => void;
  /** Fire a temporary anomaly activation on the active wild-combat mon. */
  activateWild: (kind: AnomalyKind, formChoice?: string) => void;
  /** Manually attempt to catch the current wild enemy right now (uses selectedBall). */
  manualCatch: () => void;
  /** Choose which ball the manual-catch button throws / the Store buys. */
  setSelectedBall: (ball: CatchTier) => void;
  /** Buy `qty` throw charges of a ball type (must be an unlocked tier). */
  buyBall: (ball: CatchTier, qty?: number) => void;
  toggleFalseSwipe: () => void;
  buyAutoTap: () => void;
  buyCatchUpgrade: () => void;
  /** Prestige the player (global). Requires at least one mon at Lv.100. */
  prestigePlayer: () => void;
  evolve: (uid: string, to: string) => void;
  moveToStorage: (uid: string) => void;
  moveToTeam: (uid: string) => void;
  release: (uid: string, from: "team" | "storage") => void;
  exportSave: () => string;
  importSave: (raw: string) => boolean;
  resetGame: () => void;
  rehydrate: () => void;
};

function emptyState(): GameState {
  return {
    started: false,
    tab: "battle",
    team: [],
    storage: [],
    active: 0,
    enemy: null,
    pokeyen: 0,
    playerPrestige: 0,
    playerHp: 10,
    playerExp: 0,
    autoTapLevel: 0,
    catchTier: "pokeball",
    catchLevel: 1,
    selectedBall: "pokeball",
    ballCharges: freshBallCharges(),
    catchMode: "new",
    region: "Kanto",
    route: "route",
    dex: {},
    stats: defaultStats(),
    lastHeal: Date.now(),
    anomalyCleared: {},
    gmaxChanceMult: 1,
    wildActivations: freshWildForms(),
    wildRecharge: freshRecharge(),
    falseSwipe: false,
    log: [],
    paused: false,
    playerHit: 0,
    enemyHit: 0,
    lastCatch: "none",
    now: Date.now(),
  };
}

function persist(state: GameState) {
  const blob: SaveBlob = {
    version: SAVE_VERSION,
    team: state.team,
    storage: state.storage,
    active: state.active,
    pokeyen: state.pokeyen,
    playerPrestige: state.playerPrestige,
    playerHp: state.playerHp,
    playerExp: state.playerExp,
    autoTapLevel: state.autoTapLevel,
    catchTier: state.catchTier,
    catchLevel: state.catchLevel,
    selectedBall: state.selectedBall,
    ballCharges: state.ballCharges,
    catchMode: state.catchMode,
    region: state.region,
    route: state.route,
    dex: state.dex,
    stats: state.stats,
    lastHeal: state.lastHeal,
    started: state.started,
    anomalyCleared: state.anomalyCleared,
    gmaxChanceMult: state.gmaxChanceMult,
    wildActivations: state.wildActivations,
    wildRecharge: state.wildRecharge,
    falseSwipe: state.falseSwipe,
  };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(blob));
  } catch {
    /* quota / private mode */
  }
}

function spawnEnemy(
  region: string,
  routeId: string,
  anomalyCleared: Record<string, boolean>,
  dex: Record<string, DexFlag>,
  gmaxChanceMult = 1,
): OwnedPoke | null {
  const route = ROUTES[region]?.[routeId];
  if (!route || route.pokes.length === 0) return null;

  // Drop species still behind a spawn gate; keep weights aligned with the pool.
  const pool: string[] = [];
  const weights: number[] = [];
  route.pokes.forEach((n, i) => {
    const gate = SPECIES_UNLOCK[n];
    if (gate && !gate(dex)) return;
    pool.push(n);
    if (route.weights) weights.push(route.weights[i] ?? 1);
  });
  if (pool.length === 0) return null;

  let name = pickWeighted(pool, route.weights ? weights : undefined);
  if (!speciesByName(name)) return null;

  // Gigantamax: a normal Galar-route spawn is rarely swapped for its G-Max form.
  // `gmaxChanceMult` is a hook for a future rate upgrade (default 1, unused UI-side).
  if (region === "Galar" && GMAX_FORMS[name] && Math.random() < (1 / 2000) * gmaxChanceMult) {
    name = GMAX_FORMS[name][0];
  }

  const shiny = Math.random() < SHINY_ODDS;
  const prestige =
    region.endsWith(" Anomaly") && anomalyCleared[routeId]
      ? leagueEnemyPrestige(useLeague.getState().progress)
      : 0;
  return makeOwned(name, randomLevel(route.minLevel, route.maxLevel), shiny, prestige);
}

function markDex(
  dex: Record<string, DexFlag>,
  name: string,
  flag: DexFlag,
): Record<string, DexFlag> {
  const cur = dex[name] ?? 0;
  if (flag <= cur) return dex;
  return { ...dex, [name]: flag };
}

function pushLog(log: LogLine[], text: string, tone: LogLine["tone"]): LogLine[] {
  const next = [...log, { id: logSeq++, text, tone }];
  return next.length > MAX_LOG ? next.slice(next.length - MAX_LOG) : next;
}

function hydrate(): GameState {
  const saved = typeof window !== "undefined" ? loadSave() : null;
  const base = emptyState();
  if (!saved || !saved.started) return base;

  let region = saved.region && ROUTES[saved.region] ? saved.region : "Kanto";
  let route = saved.route && ROUTES[region]?.[saved.route] ? saved.route : "";
  if (saved.region === "Anomalies") {
    [region, route] = ANOMALY_REGION_MIGRATION[saved.route ?? ""] ?? ["Kalos Anomaly", "mega"];
  }
  if (!route || !ROUTES[region]?.[route]) {
    route = ROUTES[region]?.route ? "route" : Object.keys(ROUTES[region] ?? {})[0] ?? "route";
  }

  // Master Ball was replaced by Timer Ball.
  const rawTier = (saved.catchTier as string) === "masterball" ? "timerball" : saved.catchTier;
  const catchTier: CatchTier = CATCH_TIER_ORDER.includes(rawTier as CatchTier)
    ? (rawTier as CatchTier)
    : "pokeball";
  const savedBall = (saved.selectedBall as string) === "masterball" ? "timerball" : saved.selectedBall;
  const selectedBall = CATCH_TIER_ORDER.includes(savedBall as CatchTier)
    ? (savedBall as CatchTier)
    : undefined;

  // Backfill per-instance fields on saves that predate them (teraType, IVs, EVs).
  const withMeta = (p: OwnedPoke): OwnedPoke => ({
    ...p,
    teraType: p.teraType ?? rollTeraType(p.name),
    ivs: p.ivs ?? rollIVs(),
    evs: p.evs ?? zeroEVs(),
    nature: p.nature ?? rollNature(),
  });
  const team = (saved.team ?? []).map((raw) => {
    const p = withMeta(raw);
    return { ...p, hp: Math.min(p.hp, combatStats(p).maxHp) };
  });
  const storage = (saved.storage ?? []).map(withMeta);
  const activeIndex = Math.min(
    saved.active ?? 0,
    Math.max(0, team.length - 1),
  );
  const playerExp = saved.playerExp ?? 0;
  const playerLvl = playerLevelOf(playerExp);
  const maxHp = playerMaxHp(playerLvl, saved.playerPrestige ?? 0);
  const state: GameState = {
    ...base,
    started: true,
    team,
    storage,
    active: activeIndex,
    pokeyen: saved.pokeyen ?? 0,
    playerPrestige: saved.playerPrestige ?? 0,
    playerHp: Math.min(saved.playerHp ?? maxHp, maxHp),
    playerExp,
    autoTapLevel: Math.min(MAX_AUTO_LEVEL, saved.autoTapLevel ?? 0),
    catchTier: catchTier,
    catchLevel: Math.max(1, Math.min(10, saved.catchLevel ?? 1)),
    selectedBall:
      selectedBall && tierIndex(selectedBall) <= tierIndex(catchTier) ? selectedBall : catchTier,
    ballCharges: normalizeCharges(saved.ballCharges),
    catchMode: saved.catchMode === "all" ? "all" : "new",
    region,
    route,
    dex: saved.dex ?? {},
    stats: { ...defaultStats(), ...saved.stats },
    lastHeal: saved.lastHeal ?? Date.now(),
    anomalyCleared: saved.anomalyCleared ?? {},
    gmaxChanceMult: saved.gmaxChanceMult ?? 1,
    wildActivations: pruneActivations(saved.wildActivations ?? freshWildForms(), team),
    wildRecharge: saved.wildRecharge ?? freshRecharge(),
    falseSwipe: saved.falseSwipe ?? false,
    enemy: spawnEnemy(region, route, saved.anomalyCleared ?? {}, saved.dex ?? {}, saved.gmaxChanceMult ?? 1),
    now: Date.now(),
  };
  if (state.enemy) {
    state.dex = markDex(state.dex, state.enemy.name, state.enemy.shiny ? 2 : 1);
    if (state.enemy.shiny) state.stats.shinySeen += 1;
    else state.stats.seen += 1;
  }
  return state;
}

export const useGame = create<GameState & GameActions>((set, get) => ({
  ...emptyState(),

  rehydrate: () => {
    const next = hydrate();
    playerAtkCd = 0;
    enemyAtkCd = 0;
    autoTapAcc = 0;
    pendingTaps = 0;
    lastManualTap = 0;
    respawnAt = 0;
    set(next);
  },

  startWith: (name) => {
    const starter = makeOwned(name, 5, false, 0);
    const enemy = spawnEnemy("Kanto", "route", {}, {});
    const dex: Record<string, DexFlag> = { [name]: 6 };
    let stats = defaultStats();
    if (enemy) {
      dex[enemy.name] = enemy.shiny ? 2 : 1;
      if (enemy.shiny) stats = { ...stats, shinySeen: 1 };
      else stats = { ...stats, seen: 1 };
    }
    const next: GameState = {
      ...emptyState(),
      started: true,
      team: [starter],
      enemy,
      dex,
      stats,
      playerExp: 0,
      playerHp: playerMaxHp(1, 0),
      lastHeal: Date.now(),
      log: pushLog([], `Go, ${name}! Route 1 awaits.`, "system"),
      now: Date.now(),
    };
    persist(next);
    playerAtkCd = 0;
    enemyAtkCd = 0;
    autoTapAcc = 0;
    pendingTaps = 0;
    lastManualTap = 0;
    respawnAt = 0;
    set(next);
  },

  manualTap: () => {
    const s = get();
    if (!s.started || s.paused || s.playerHp <= 0) return;
    const now = Date.now();
    if (now - lastManualTap < 20) return;
    if (now < respawnAt || !s.enemy || s.enemy.hp <= 0) return;
    lastManualTap = now;
    // A tap just *requests* an attack. The step loop fires it on the next turn
    // the mon's Speed allows; extra taps beyond the cap are dropped.
    pendingTaps = Math.min(MAX_PENDING_TAPS, pendingTaps + 1);
  },

  step: (dt) => {
    const s = get();
    if (!s.started || s.paused) return;
    const now = Date.now();
    uiAcc += dt;
    saveAcc += dt;

    const team = s.team.map((p) => ({ ...p }));
    const active = team[s.active];
    if (!active) return;

    let playerHp = s.playerHp;
    let playerExp = s.playerExp;
    let lastHeal = s.lastHeal;
    let log = s.log;
    let dirty = false;

    // ── Timed Auto-Heal (Triggers strictly at 15s timer) ─────────────────
    if (now - lastHeal >= HEAL_COOLDOWN_MS) {
      const playerLvl = playerLevelOf(playerExp);
      playerHp = playerMaxHp(playerLvl, s.playerPrestige);

      for (let i = 0; i < team.length; i++) {
        team[i].hp = combatStats(team[i]).maxHp;
      }

      lastHeal = now;
      log = pushLog(log, "Auto-heal restored you and your party.", "system");
      dirty = true;
    }

    if (playerHp <= 0) {
      playerAtkCd = 0;
      enemyAtkCd = 0;
      if (dirty || uiAcc > 0.2) {
        uiAcc = 0;
        set({ now, playerHp, team, lastHeal, log });
      }
      return;
    }

    let activeIndex = s.active;

    if (respawnAt > 0 && now < respawnAt) {
      if (uiAcc > 0.05) {
        uiAcc = 0;
        set({ now, enemy: null });
      }
      return;
    }

    let dex = s.dex;
    let stats = s.stats;
    let storage = s.storage;
    let anomalyCleared = s.anomalyCleared;
    let pokeyen = s.pokeyen;
    let playerHit = s.playerHit;
    let enemyHit = s.enemyHit;
    let wildActivations = s.wildActivations;
    let wildRecharge = s.wildRecharge;
    let lastCatch: GameState["lastCatch"] = "none";

    const uniqueBonus = uniqueCaughtBonus(uniqueCaught(dex));

    const pendingFaint = !!(s.enemy && s.enemy.hp <= 0 && respawnAt === 0);

    let enemy: OwnedPoke;
    if (s.enemy && s.enemy.hp > 0) {
      enemy = { ...s.enemy };
    } else if (pendingFaint && s.enemy) {
      enemy = { ...s.enemy };
    } else {
      const spawned = spawnEnemy(s.region, s.route, s.anomalyCleared, dex, s.gmaxChanceMult);
      if (!spawned) return;
      enemy = spawned;
      respawnAt = 0;
      dex = markDex(dex, enemy.name, enemy.shiny ? 2 : 1);
      if (enemy.shiny) {
        stats = { ...stats, shinySeen: stats.shinySeen + 1 };
        log = pushLog(log, `A Shiny ${enemy.name} appeared!`, "shiny");
      } else {
        stats = { ...stats, seen: stats.seen + 1 };
      }
      dirty = true;
    }

    const playerAtk = () => {
      const atkPoke = team[activeIndex];
      if (!atkPoke || playerHp <= 0 || enemy.hp <= 0) return;
      const eff = wildEffective(atkPoke, wildActivations);
      const { damage } = attackDamage(eff.poke, enemy, {
        attackerIsPlayer: true,
        playerPrestige: s.playerPrestige,
        uniqueBonus,
        form: eff.form,
        teraType: eff.teraType,
      });
      enemy.hp = Math.max(s.falseSwipe ? 1 : 0, enemy.hp - damage);
      stats = { ...stats, damage: stats.damage + damage };
      enemyHit = now;
      dirty = true;
    };

    const enemyAtk = () => {
      const defPoke = team[activeIndex];
      if (!defPoke || playerHp <= 0 || enemy.hp <= 0) return;

      const { damage } = attackDamage(enemy, defPoke, {
        attackerIsPlayer: false,
        playerPrestige: s.playerPrestige,
        uniqueBonus,
      });

      playerHp = Math.max(0, playerHp - damage);
      playerHit = now;
      dirty = true;

      if (playerHp <= 0) {
        lastHeal = now;
        log = pushLog(log, "You fainted! Auto-healing in 15 seconds...", "escape");
      }
    };

    const onEnemyFaint = () => {
      const fallen = enemy;
      stats = { ...stats, beaten: stats.beaten + 1 };
      if (s.region.endsWith(" Anomaly") && !anomalyCleared[s.route]) {
        anomalyCleared = { ...anomalyCleared, [s.route]: true };
      }
      if (fallen.name === "Eternatus-Eternamax" && !anomalyCleared["galar-eternamax"]) {
        anomalyCleared = { ...anomalyCleared, "galar-eternamax": true };
        log = pushLog(log, "The Eternamax anomaly collapses — Dynamax is yours to command!", "level");
      }

      // Tick temporary anomaly activations + recharge counters on every wild defeat.
      {
        const t = tickWildAnomalies(wildActivations, wildRecharge);
        wildActivations = t.wa;
        wildRecharge = t.wr;
        for (const k of t.expired) log = pushLog(log, `${ACTIVATION_LABEL[k]} wore off.`, "system");
      }

      const yenGain = pokeyenReward(levelOf(fallen));
      pokeyen += yenGain;
      log = pushLog(
        log,
        `+¥${yenGain} · ${fallen.shiny ? "Shiny " : ""}${fallen.name}`,
        fallen.shiny ? "shiny" : "neutral",
      );

      // ── Refined Catch Trigger Condition ────────────────────────────────
      // - Shinies are ALWAYS attempted (regardless of mode or dex status)
      // - 'all' mode attempts every wild encounter
      // - 'new' mode attempts only Pokémon unregistered in the Pokédex (flag < 5)
      const isUnregisteredInDex = (dex[fallen.name] ?? 0) < 5;
      const wantCatch =
        fallen.shiny ||
        s.catchMode === "all" ||
        (s.catchMode === "new" && isUnregisteredInDex);

      if (wantCatch) {
        const spec = speciesByName(fallen.name);
        const chance = catchChancePercentPermanent(
          spec?.catch ?? 45,
          s.catchTier,
          s.catchLevel,
        );
        if (Math.random() * 100 < chance) {
          // Anomaly forms register their Dex flag (that flag is the activation
          // unlock) but hand you the base species — except the permanent catches
          // (Ultra Space, Ogerpon, Terapagos) which come as themselves.
          const gained = isPermanentAnomalyCatch(fallen.name)
            ? fallen.name
            : baseSpeciesOf(fallen.name);
          const morphed = gained !== fallen.name;
          const caught = makeOwned(gained, levelOf(fallen), fallen.shiny, 0);
          if (team.length < TEAM_SIZE) team.push(caught);
          else storage = [...storage, caught];
          dex = markDex(dex, fallen.name, fallen.shiny ? 8 : 6);
          if (morphed) dex = markDex(dex, gained, fallen.shiny ? 8 : 6);
          if (fallen.shiny) {
            stats = { ...stats, shinyCaught: stats.shinyCaught + 1 };
            log = pushLog(log, `Caught Shiny ${fallen.name}!!`, "shiny");
            lastCatch = "shiny";
          } else {
            stats = { ...stats, caught: stats.caught + 1 };
            log = pushLog(
              log,
              morphed ? `Caught ${fallen.name}! ${gained} joined — form unlocked.` : `Caught ${fallen.name}!`,
              "catch",
            );
            lastCatch = "caught";
          }
        } else {
          log = pushLog(log, `${fallen.name} broke free!`, "escape");
          lastCatch = "escaped";
        }
      }

      const atkPoke = team[activeIndex];
      const fullReward = expReward(fallen);

      // EV training: every party mon gains the fallen species' EV yield (caps at
      // 252/stat, 510 total). Storage mons and the player pool are excluded.
      const evGain = evYield(speciesByName(fallen.name));
      for (let i = 0; i < team.length; i++) {
        team[i].evs = addEVs(team[i].evs, evGain);
      }

      const beforePlayerLvl = playerLevelOf(playerExp);
      playerExp += fullReward;
      const afterPlayerLvl = playerLevelOf(playerExp);
      if (afterPlayerLvl > beforePlayerLvl) {
        log = pushLog(log, `You grew to Lv. ${afterPlayerLvl}!`, "level");
      }

      if (atkPoke) {
        const before = levelOf(atkPoke);
        atkPoke.exp += fullReward;
        const after = levelOf(atkPoke);
        if (after > before) {
          log = pushLog(log, `${atkPoke.name} grew to Lv. ${after}!`, "level");
        }
      }
      for (const p of team) {
        if (p === atkPoke) continue;
        const before = levelOf(p);
        p.exp += fullReward * BENCH_EXP_SHARE;
        if (levelOf(p) > before) {
          log = pushLog(log, `${p.name} grew to Lv. ${levelOf(p)}!`, "level");
        }
      }
      storage = storage.map((p) => {
        const before = levelOf(p);
        const nextPoke = { ...p, exp: p.exp + fullReward * STORAGE_EXP_SHARE };
        if (levelOf(nextPoke) > before) {
          nextPoke.hp = combatStats(nextPoke).maxHp;
          log = pushLog(log, `${nextPoke.name} grew to Lv. ${levelOf(nextPoke)}!`, "level");
        }
        return nextPoke;
      });

      enemy = { ...fallen, hp: 0 };
      respawnAt = now + RESPAWN_DELAY_MS;
      dirty = true;
    };

    if (pendingFaint) {
      onEnemyFaint();
      playerAtkCd = 0;
      enemyAtkCd = 0;
    }

    // ── Attack cadence ─────────────────────────────────────────────────────
    // Speed only JUDGES what's possible: it sets the minimum gap between a mon's
    // attacks (attackIntervalMs). It never fires an attack on its own.
    //   • Player: attacks come from TAP REQUESTS — auto-tap adds one every
    //     autoTapMsFromLevel(level) ms; manual taps add one each. A queued tap
    //     only lands when the Speed gap has elapsed; excess taps are dropped.
    //   • Enemy: attacks automatically every Speed-allowed turn.
    const dtms = dt * 1000;
    const effActive = wildEffective(team[activeIndex], wildActivations);
    const playerSpe = combatStats(effActive.poke, {
      isPlayer: true,
      playerPrestige: s.playerPrestige,
      uniqueBonus,
      form: effActive.form,
    }).spe;
    const enemySpe = combatStats(enemy).spe;
    const playerInt = attackIntervalMs(playerSpe);
    const enemyInt = attackIntervalMs(enemySpe);

    // Speed-cap cooldowns count down toward "ready".
    playerAtkCd = Math.max(0, playerAtkCd - dtms);
    enemyAtkCd = Math.max(0, enemyAtkCd - dtms);

    // Auto-tap: queue a tap request at the upgrade-controlled cadence.
    autoTapAcc += dtms;
    const autoMs = autoTapMsFromLevel(s.autoTapLevel);
    let aGuard = 0;
    while (autoTapAcc >= autoMs && aGuard++ < 8) {
      autoTapAcc -= autoMs;
      pendingTaps = Math.min(MAX_PENDING_TAPS, pendingTaps + 1);
    }

    const runPlayerTurns = () => {
      let g = 0;
      while (pendingTaps > 0 && playerAtkCd <= 0 && enemy.hp > 0 && playerHp > 0 && g++ < 8) {
        pendingTaps -= 1;
        playerAtkCd = playerInt;
        playerAtk();
        if (enemy.hp <= 0) {
          onEnemyFaint();
          playerAtkCd = 0;
          enemyAtkCd = 0;
          break;
        }
      }
    };
    const runEnemyTurns = () => {
      let g = 0;
      while (enemyAtkCd <= 0 && enemy.hp > 0 && playerHp > 0 && g++ < 8) {
        enemyAtkCd = enemyInt;
        enemyAtk();
      }
    };

    // On a simultaneous turn the faster mon resolves first (so it can KO before
    // the slower one retaliates).
    if (playerSpe >= enemySpe) {
      runPlayerTurns();
      runEnemyTurns();
    } else {
      runEnemyTurns();
      runPlayerTurns();
    }

    const shouldUi = dirty || uiAcc > 0.08;
    if (shouldUi) {
      uiAcc = 0;
      set({
        team,
        storage,
        active: activeIndex,
        enemy,
        pokeyen,
        playerHp,
        playerExp,
        lastHeal,
        dex,
        stats,
        log,
        playerHit,
        enemyHit,
        lastCatch,
        anomalyCleared,
        wildActivations,
        wildRecharge,
        now,
      });
      if (saveAcc > 4) {
        saveAcc = 0;
        persist({ ...get() });
      }
    }
  },

  buyAutoTap: () => {
    const s = get();
    if (s.autoTapLevel >= MAX_AUTO_LEVEL) return;
    const cost = autoTapCost(s.autoTapLevel);
    if (s.pokeyen < cost) return;
    set({
      pokeyen: s.pokeyen - cost,
      autoTapLevel: s.autoTapLevel + 1,
      log: pushLog(
        s.log,
        `Auto-tap improved! Now ${autoTapMsFromLevel(s.autoTapLevel + 1)} ms`,
        "system",
      ),
    });
    persist({ ...get() });
  },

  buyCatchUpgrade: () => {
    const s = get();

  // Guard against purchasing past the absolute max tier/level
    const isMaxTier = CATCH_TIER_ORDER.indexOf(s.catchTier) === CATCH_TIER_ORDER.length - 1;
    if (isMaxTier && s.catchLevel >= 10) return;

  // Calculate cost using both the level within tier and current tier
    const cost = catchUpgradeCost(s.catchLevel, s.catchTier);
    if (s.pokeyen < cost) return;

    let nextTier = s.catchTier;
    let nextLevel = s.catchLevel + 1;

    if (nextLevel > 10) {
      const idx = CATCH_TIER_ORDER.indexOf(s.catchTier);
      nextTier = CATCH_TIER_ORDER[idx + 1];
      nextLevel = 1;
    }

    // Auto-select the newly unlocked ball for manual throws.
    const selectedBall = nextTier !== s.catchTier ? nextTier : s.selectedBall;

    set({
      pokeyen: s.pokeyen - cost,
      catchTier: nextTier,
      catchLevel: nextLevel,
      selectedBall,
      log: pushLog(
        s.log,
        `Catch power up! ${nextTier} Lv.${nextLevel}`,
        "system",
      ),
    });
    persist({ ...get() });
  },

  setSelectedBall: (ball) => {
    const s = get();
    if (tierIndex(ball) > tierIndex(s.catchTier)) return; // not unlocked
    set({ selectedBall: ball });
    persist({ ...get() });
  },

  buyBall: (ball, qty = 1) => {
    const s = get();
    if (tierIndex(ball) > tierIndex(s.catchTier)) return; // tier not unlocked yet
    const n = Math.max(1, Math.floor(qty));
    const cost = ballChargeCost(ball, n);
    if (s.pokeyen < cost) return;
    set({
      pokeyen: s.pokeyen - cost,
      ballCharges: { ...s.ballCharges, [ball]: s.ballCharges[ball] + n },
      log: pushLog(s.log, `Bought ${n}× ${BALL_META[ball].label} (−¥${cost.toLocaleString()}).`, "system"),
    });
    persist({ ...get() });
  },

  prestigePlayer: () => {
    const s = get();
    const ready = s.team.some((p) => levelOf(p) >= 100);
    if (!ready) {
      set({
        log: pushLog(
          s.log,
          "Need a Lv.100 Pokémon on your team to prestige.",
          "system",
        ),
      });
      return;
    }
    const reset = (list: OwnedPoke[]) =>
      list.map((p) => {
        const spec = speciesByName(p.name);
        const next = {
          ...p,
          exp: expAtLevel((spec?.growth ?? "Medium Fast") as "Medium Fast", 1),
        };
        next.hp = combatStats(next, {
          isPlayer: true,
          playerPrestige: s.playerPrestige + 1,
          uniqueBonus: uniqueCaughtBonus(uniqueCaught(s.dex)),
        }).maxHp;
        return next;
      });

    set({
      playerPrestige: s.playerPrestige + 1,
      playerHp: playerMaxHp(1, s.playerPrestige + 1),
      playerExp: 0,
      team: reset(s.team),
      storage: reset(s.storage),
      log: pushLog(
        s.log,
        `Player prestiged to +${s.playerPrestige + 1}%! Team reset to Lv.1.`,
        "level",
      ),
    });
    persist({ ...get() });
  },

  setTab: (tab) => set({ tab }),

  setRoute: (region, route) => {
    const caught = uniqueCaught(get().dex);
    const need = REGION_UNLOCK[region] ?? 0;
    if (caught < need) return;
    const def = ROUTES[region]?.[route];
    if (!def) return;
    if (!isRouteUnlocked(region, route, get().dex, get().playerPrestige)) return;
    playerAtkCd = 0;
    enemyAtkCd = 0;
    autoTapAcc = 0;
    pendingTaps = 0;
    respawnAt = 0;
    const enemy = spawnEnemy(region, route, get().anomalyCleared, get().dex, get().gmaxChanceMult);
    let dex = get().dex;
    let stats = get().stats;
    let log = get().log;
    if (enemy) {
      dex = markDex(dex, enemy.name, enemy.shiny ? 2 : 1);
      stats = enemy.shiny
        ? { ...stats, shinySeen: stats.shinySeen + 1 }
        : { ...stats, seen: stats.seen + 1 };
      log = pushLog(log, `Entered ${def.name}.`, "system");
    }
    set({ region, route, enemy, dex, stats, log, tab: "battle" });
    persist({ ...get() });
  },

  setActive: (index) => {
    const team = get().team;
    if (!team[index]) return;
    playerAtkCd = 0;
    set({ active: index });
  },

  setCatchMode: (catchMode) => {
    set({ catchMode });
    persist({ ...get() });
  },

  toggleFalseSwipe: () => {
    set({ falseSwipe: !get().falseSwipe });
    persist({ ...get() });
  },

  activateWild: (kind, formChoice) => {
    const s = get();
    if (!s.started || s.paused || !s.enemy || s.enemy.hp <= 0) return;
    if (s.wildActivations[kind] || s.wildRecharge[kind] > 0) return;
    const mon = s.team[s.active];
    if (!mon) return;
    // One activation per mon at a time.
    if (ANOMALY_KINDS.some((k) => s.wildActivations[k]?.uid === mon.uid)) return;

    let formName: string | null = null;
    let verb: string;
    if (kind === "mega") {
      const owned = megaFormsFor(s.dex, mon.name);
      if (!owned.length) return;
      formName = formChoice && owned.includes(formChoice) ? formChoice : owned[0];
      verb = `Mega Evolved into ${formName.replace(/^M-/, "")}`;
    } else if (kind === "dynamax") {
      if (!dynamaxUnlocked(s.anomalyCleared)) return;
      formName = gmaxFormFor(s.dex, mon.name);
      verb = formName ? "Gigantamaxed" : "Dynamaxed";
    } else {
      if (!teraUnlocked(s.dex)) return;
      verb = `Terastallized${mon.teraType ? ` (${mon.teraType})` : ""}`;
    }

    set({
      wildActivations: {
        ...s.wildActivations,
        [kind]: { uid: mon.uid, formName, defeatsLeft: WILD_FORM_DEFEATS },
      },
      log: pushLog(s.log, `${mon.name} ${verb}!`, "level"),
    });
    persist({ ...get() });
  },

  manualCatch: () => {
    const s = get();
    if (!s.started || s.paused) return;
    const e = s.enemy;
    if (!e || e.hp <= 0) return;
    const now = Date.now();
    if (now - lastManualCatch < 350) return;
    lastManualCatch = now;

    const ball = s.selectedBall;
    if ((s.ballCharges[ball] ?? 0) <= 0) {
      set({
        log: pushLog(s.log, `Out of ${BALL_META[ball].label} — buy more in the Store.`, "system"),
      });
      return;
    }
    const ballCharges = { ...s.ballCharges, [ball]: s.ballCharges[ball] - 1 };

    const spec = speciesByName(e.name);
    // Chosen ball, 10% better than the equivalent auto-catch.
    const chance = manualCatchChance(spec?.catch ?? 45, ball, s.catchTier, s.catchLevel);

    if (Math.random() * 100 >= chance) {
      set({
        ballCharges,
        log: pushLog(
          s.log,
          `${e.name} broke free! · ${ballCharges[ball]} ${BALL_META[ball].label} left`,
          "escape",
        ),
        lastCatch: "escaped",
      });
      return;
    }

    const gained = isPermanentAnomalyCatch(e.name) ? e.name : baseSpeciesOf(e.name);
    const morphed = gained !== e.name;
    const caught = makeOwned(gained, levelOf(e), e.shiny, 0);
    let team = s.team;
    let storage = s.storage;
    if (team.length < TEAM_SIZE) team = [...team, caught];
    else storage = [...storage, caught];
    let dex = markDex(s.dex, e.name, e.shiny ? 8 : 6);
    if (morphed) dex = markDex(dex, gained, e.shiny ? 8 : 6);
    const stats = e.shiny
      ? { ...s.stats, shinyCaught: s.stats.shinyCaught + 1 }
      : { ...s.stats, caught: s.stats.caught + 1 };

    respawnAt = now + RESPAWN_DELAY_MS;
    set({
      team,
      storage,
      dex,
      stats,
      ballCharges,
      enemy: { ...e, hp: 0 },
      lastCatch: e.shiny ? "shiny" : "caught",
      log: pushLog(
        s.log,
        morphed
          ? `Caught ${e.name}! ${gained} joined — form unlocked.`
          : `Caught ${e.shiny ? "Shiny " : ""}${e.name}!`,
        e.shiny ? "shiny" : "catch",
      ),
    });
    persist({ ...get() });
  },

  evolve: (uid, to) => {
    const s = get();
    const uniqueBonus = uniqueCaughtBonus(uniqueCaught(s.dex));
    const apply = (list: OwnedPoke[]) =>
      list.map((p) => {
        if (p.uid !== uid) return p;
        const next = { ...p, name: to };
        next.hp = combatStats(next, {
          isPlayer: true,
          playerPrestige: s.playerPrestige,
          uniqueBonus,
        }).maxHp;
        return next;
      });
    const team = apply(s.team);
    const storage = apply(s.storage);
    const poke = [...team, ...storage].find((p) => p.uid === uid);
    let dex = s.dex;
    if (poke) dex = markDex(dex, to, poke.shiny ? 8 : 6);
    set({
      team,
      storage,
      dex,
      log: pushLog(s.log, `Evolved into ${to}!`, "level"),
    });
    persist({ ...get() });
  },

  moveToStorage: (uid) => {
    const s = get();
    const poke = s.team.find((p) => p.uid === uid);
    if (!poke || s.team.length <= 1) return;
    const team = s.team.filter((p) => p.uid !== uid);
    set({
      team,
      storage: [...s.storage, poke],
      active: Math.min(s.active, team.length - 1),
    });
    persist({ ...get() });
  },

  moveToTeam: (uid) => {
    const s = get();
    if (s.team.length >= TEAM_SIZE) return;
    const poke = s.storage.find((p) => p.uid === uid);
    if (!poke) return;
    set({
      team: [...s.team, poke],
      storage: s.storage.filter((p) => p.uid !== uid),
    });
    persist({ ...get() });
  },

  release: (uid, from) => {
    const s = get();
    if (from === "team") {
      if (s.team.length <= 1) return;
      const team = s.team.filter((p) => p.uid !== uid);
      set({ team, active: Math.min(s.active, team.length - 1) });
    } else {
      set({ storage: s.storage.filter((p) => p.uid !== uid) });
    }
    persist({ ...get() });
  },

  exportSave: () => {
    persist(get());
    return localStorage.getItem(SAVE_KEY) ?? "";
  },

  importSave: (raw) => {
    try {
      const parsed = JSON.parse(raw) as SaveBlob;
      if (!parsed || typeof parsed !== "object") return false;
      localStorage.setItem(
        SAVE_KEY,
        JSON.stringify({ ...parsed, version: SAVE_VERSION }),
      );
      const next = hydrate();
      playerAtkCd = 0;
      enemyAtkCd = 0;
      autoTapAcc = 0;
      pendingTaps = 0;
      set(next);
      return true;
    } catch {
      return false;
    }
  },

  resetGame: () => {
    localStorage.removeItem(SAVE_KEY);
    playerAtkCd = 0;
    enemyAtkCd = 0;
    autoTapAcc = 0;
    pendingTaps = 0;
    set(emptyState());
  },
}));

export function uniqueOwnedCount(dex: Record<string, DexFlag>): number {
  return uniqueCaught(dex);
}

export function regionUnlocked(
  region: string,
  dex: Record<string, DexFlag>,
): boolean {
  return uniqueCaught(dex) >= (REGION_UNLOCK[region] ?? 0);
}

export { REGIONS, ROUTES, uniqueCaught };