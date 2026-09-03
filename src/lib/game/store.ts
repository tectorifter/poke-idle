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
  isAnomalyFormName,
  baseSpeciesOf,
  megaFormsFor,
  gmaxFormFor,
  dynamaxUnlocked,
  teraUnlocked,
  teraFormsFor,
} from "./dex";
import type { AnomalyKind } from "./dex";
import { rollNature, NATURE_NAMES } from "./natures";
import { learnableMoveNames, moveAcquisitionCost, chosenMoves, bestMoveAgainst } from "./learnsets";
import {
  computeSynergy,
  encounterSynergy,
  stellarActive,
  NO_SYNERGY,
  isType,
  canAct,
  tickResidual,
  rollInflictions,
  GROUND_BLEED_FRAC,
  WATER_HEAL_FRAC,
} from "./synergy";
import { leagueEnemyPrestige } from "./league";
import { useLeague } from "./league-store";
import {
  attackDamage,
  BENCH_EXP_SHARE,
  STORAGE_EXP_SHARE,
  catchChance,
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
  STAT_KEYS,
  IV_MAX,
  EV_MAX_PER_STAT,
  EV_MAX_TOTAL,
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
  Nature,
  StatSpread,
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

/** Rayquaza Mega-Evolves by knowing Dragon Ascent — never via the Mega button.
 *  It still uses the normal Mega duration / recharge; this just auto-fills the slot. */
export function rayquazaAutoMega(mon: OwnedPoke | undefined, dex: Record<string, DexFlag>): boolean {
  if (!mon || baseSpeciesOf(mon.name) !== "Rayquaza") return false;
  if (!megaFormsFor(dex, "Rayquaza").includes("M-Rayquaza")) return false;
  const names = mon.moves?.length ? mon.moves : chosenMoves(mon, levelOf(mon)).map((m) => m.name);
  return names.includes("Dragon Ascent");
}

/** Effective attacker for a wild-combat mon: swaps to the Mega / G-Max / Tera
 *  species and reports the form kind + tera type for the damage formula. */
export function wildEffective(
  mon: OwnedPoke,
  wa: WildForms,
): { poke: OwnedPoke; form?: FormKind; teraType?: string } {
  if (wa.mega && wa.mega.uid === mon.uid && wa.mega.formName)
    return { poke: { ...mon, name: wa.mega.formName }, form: "mega" };
  if (wa.dynamax && wa.dynamax.uid === mon.uid)
    return wa.dynamax.formName
      ? { poke: { ...mon, name: wa.dynamax.formName }, form: "gmax" }
      : { poke: mon, form: "dynamax" };
  if (wa.tera && wa.tera.uid === mon.uid) {
    // Terapagos swaps to its chosen tera-form species; every other mon keeps
    // its name and just collapses its offensive typing to its tera type.
    if (wa.tera.formName) {
      const t = speciesByName(wa.tera.formName)?.types[0] ?? mon.teraType;
      return { poke: { ...mon, name: wa.tera.formName }, form: "tera", teraType: t };
    }
    return { poke: mon, form: "tera", teraType: mon.teraType };
  }
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
/** Grace period before a freshly-spawned wild enemy takes its first action. */
const ENEMY_FIRST_ATTACK_DELAY_MS = 1000;

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
  autoTapLevel: number; // 0–15
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
  /** When on, clearing every species on a route's wild list (all caught) auto-advances to the next route in the region. */
  autoAdvanceRoute: boolean;
  /** Which of the active mon's 4 move slots is fired (0–3). Resets on mon swap. */
  selectedMove: number;
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
  toggleAutoAdvanceRoute: () => void;
  /** Pick which of the active mon's 4 move slots is fired (0–3). */
  setSelectedMove: (index: number) => void;
  buyAutoTap: () => void;
  buyCatchUpgrade: () => void;
  /** Prestige the player (global). Requires at least one mon at Lv.100. */
  prestigePlayer: () => void;
  evolve: (uid: string, to: string) => void;
  /** Apply an IV / EV / nature / move edit to a party mon (see modifyPokeCost).
   *  Returns false if unaffordable. */
  modifyPoke: (uid: string, draft: PokeDraft) => boolean;
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
    autoAdvanceRoute: false,
    selectedMove: 0,
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
    autoAdvanceRoute: state.autoAdvanceRoute,
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

/** True once every species that can spawn on this route has been caught
 *  (dex flag >= 6 — owned, matching the same threshold uniqueCaught() uses). */
function isRouteDexComplete(region: string, routeId: string, dex: Record<string, DexFlag>): boolean {
  const def = ROUTES[region]?.[routeId];
  if (!def || def.pokes.length === 0) return false;
  return def.pokes.every((name) => (dex[name] ?? 0) >= 6);
}

/** Next route in the same region, ordered the same way the Map view presents
 *  them (by minLevel), skipping anything not yet unlocked. Null if this is
 *  already the region's last route. */
function nextRouteInRegion(
  region: string,
  currentRoute: string,
  dex: Record<string, DexFlag>,
): string | null {
  const regionRoutes = ROUTES[region];
  if (!regionRoutes) return null;
  const ordered = Object.entries(regionRoutes).sort((a, b) => a[1].minLevel - b[1].minLevel);
  const idx = ordered.findIndex(([id]) => id === currentRoute);
  if (idx < 0) return null;
  for (let i = idx + 1; i < ordered.length; i++) {
    const [id] = ordered[i];
    if (isRouteUnlocked(region, id, dex)) return id;
  }
  return null;
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

  // Backfill per-instance fields on saves that predate them, and hard-revert any
  // mon stuck in a temporary-activation form (Mega / Primal / Tera / Dynamax /
  // Gigantamax) back to its base species — those must never be permanent.
  const withMeta = (p: OwnedPoke): OwnedPoke => {
    const name = isAnomalyFormName(p.name) ? baseSpeciesOf(p.name) : p.name;
    return {
      ...p,
      name,
      teraType: p.teraType ?? rollTeraType(name),
      ivs: p.ivs ?? rollIVs(),
      evs: p.evs ?? zeroEVs(),
      nature: p.nature ?? rollNature(),
    };
  };
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
    autoAdvanceRoute: saved.autoAdvanceRoute ?? false,
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

// ─── Party-mon editor: draft sanitising + cost ───────────────────────────────
const MOD_CATEGORY_COST = 2000; // per changed category (IV / EV / nature)
const STAT_MOD_COST = 500; // per individual stat changed within IV or EV

export type PokeDraft = { ivs: StatSpread; evs: StatSpread; nature: Nature; moves: string[] };

const zeroSpread = (): StatSpread => ({ hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 });

/** Clamp a raw editor draft to the mon's limits and learnable pool. */
export function sanitizeDraft(poke: OwnedPoke, level: number, draft: PokeDraft): PokeDraft {
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.floor(v || 0)));
  const ivs = zeroSpread();
  for (const k of STAT_KEYS) ivs[k] = clamp(draft.ivs?.[k] ?? 0, 0, IV_MAX);
  const evs = zeroSpread();
  let left = EV_MAX_TOTAL;
  for (const k of STAT_KEYS) {
    const want = clamp(draft.evs?.[k] ?? 0, 0, EV_MAX_PER_STAT);
    evs[k] = Math.min(want, left);
    left -= evs[k];
  }
  const nature: Nature = NATURE_NAMES.includes(draft.nature) ? draft.nature : poke.nature ?? "Hardy";
  const learnable = new Set(learnableMoveNames(poke.name, level));
  const moves = [...new Set(draft.moves ?? [])].filter((n) => learnable.has(n)).slice(0, 4);
  return { ivs, evs, nature, moves };
}

/** ¥ cost of applying a (sanitized) draft: ¥2000 + ¥500/stat per changed IV or
 *  EV category, ¥2000 per nature change, plus TM/tutor cost for newly-added moves. */
export function modifyPokeCost(poke: OwnedPoke, level: number, d: PokeDraft): number {
  const ivDiff = STAT_KEYS.filter((k) => (poke.ivs?.[k] ?? 0) !== d.ivs[k]).length;
  const evDiff = STAT_KEYS.filter((k) => (poke.evs?.[k] ?? 0) !== d.evs[k]).length;
  let cost = 0;
  if (ivDiff > 0) cost += MOD_CATEGORY_COST + STAT_MOD_COST * ivDiff;
  if (evDiff > 0) cost += MOD_CATEGORY_COST + STAT_MOD_COST * evDiff;
  if ((poke.nature ?? d.nature) !== d.nature) cost += MOD_CATEGORY_COST;
  const curMoves = poke.moves?.length ? poke.moves : chosenMoves(poke, level).map((m) => m.name);
  for (const n of d.moves) if (!curMoves.includes(n)) cost += moveAcquisitionCost(poke.name, level, n);
  return cost;
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

    // Party type-synergy buffs. Terapagos-Stellar (Stellar type, incl. via Tera)
    // switches every synergy off — both sides — while it is the active fighter.
    let synergy =
      stellarActive(wildEffective(active, s.wildActivations).poke, s.enemy ?? undefined)
        ? NO_SYNERGY
        : computeSynergy(team);

    let playerHp = s.playerHp;
    let playerExp = s.playerExp;
    let lastHeal = s.lastHeal;
    let log = s.log;
    let dirty = false;

    // ── Timed Auto-Heal (Triggers strictly at 15s timer) ─────────────────
    if (now - lastHeal >= HEAL_COOLDOWN_MS) {
      const playerLvl = playerLevelOf(playerExp);
      playerHp = playerMaxHp(playerLvl, s.playerPrestige, synergy.hpPct);

      for (let i = 0; i < team.length; i++) {
        team[i].hp = combatStats(team[i], { synergy }).maxHp;
        team[i].status = undefined;
        team[i].flinch = undefined;
        team[i].bleed = undefined;
      }

      lastHeal = now;
      log = pushLog(log, "Auto-heal restored you and your party.", "system");
      dirty = true;
    }

    if (playerHp <= 0) {
      playerAtkCd = 0;
      enemyAtkCd = 0;
      // Wild faint: the encounter flees — no catch, no rewards. A fresh wild
      // shows up once the team finishes auto-healing.
      if (s.enemy) {
        respawnAt = now + RESPAWN_DELAY_MS;
        set({
          now,
          playerHp,
          team,
          lastHeal,
          enemy: null,
          lastCatch: "none",
          log: pushLog(log, `The wild ${s.enemy.name} fled.`, "escape"),
        });
        return;
      }
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
    let justSpawnedEnemy = false;
    if (s.enemy && s.enemy.hp > 0) {
      enemy = { ...s.enemy };
    } else if (pendingFaint && s.enemy) {
      enemy = { ...s.enemy };
    } else {
      const spawned = spawnEnemy(s.region, s.route, s.anomalyCleared, dex, s.gmaxChanceMult);
      if (!spawned) return;
      enemy = spawned;
      justSpawnedEnemy = true;
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

    // The wild encounter's own type-synergy (isolated from the player team): an
    // anomaly form gets tier 1 of every one of its types; a normal encounter
    // only the ones whose tier 1 needs a single mon. A Stellar mon on either
    // side switches everything off.
    const stellarOut = stellarActive(wildEffective(team[activeIndex], wildActivations).poke, enemy);
    if (stellarOut) synergy = NO_SYNERGY;
    const enemySynergy = stellarOut
      ? NO_SYNERGY
      : encounterSynergy(
          enemy,
          isAnomalyFormName(enemy.name) || isPermanentAnomalyCatch(enemy.name),
        );

    // Rayquaza auto-Mega-Evolves when it knows Dragon Ascent — same slot, same
    // duration/recharge as a button activation, it just triggers itself.
    if (
      enemy.hp > 0 &&
      !wildActivations.mega &&
      wildRecharge.mega === 0 &&
      !ANOMALY_KINDS.some((k) => wildActivations[k]?.uid === team[activeIndex]?.uid) &&
      rayquazaAutoMega(team[activeIndex], dex)
    ) {
      wildActivations = {
        ...wildActivations,
        mega: { uid: team[activeIndex].uid, formName: "M-Rayquaza", defeatsLeft: WILD_FORM_DEFEATS },
      };
      log = pushLog(log, `${team[activeIndex].name} Mega Evolved into Rayquaza via Dragon Ascent!`, "level");
      dirty = true;
    }

    const playerFaintLog = () => {
      lastHeal = now;
      log = pushLog(log, "You fainted! Auto-healing in 15 seconds...", "escape");
    };

    const playerAtk = () => {
      const atkPoke = team[activeIndex];
      if (!atkPoke || playerHp <= 0 || enemy.hp <= 0) return;
      const pMax = playerMaxHp(playerLevelOf(playerExp), s.playerPrestige, synergy.hpPct);

      // Status the enemy inflicted on the active mon: residual, bleed, flinch,
      // freeze / paralyze — all against the wild HP pool.
      if (atkPoke.status?.kind === "poison" || atkPoke.status?.kind === "toxic") {
        const r = tickResidual(playerHp, pMax, atkPoke.status);
        playerHp = r.hp;
        atkPoke.status = r.status;
        if (r.lost > 0) {
          playerHit = now;
          dirty = true;
        }
        if (playerHp <= 0) return playerFaintLog();
      }
      if (atkPoke.bleed) {
        playerHp = Math.max(0, playerHp - Math.max(1, Math.floor(pMax * GROUND_BLEED_FRAC)));
        playerHit = now;
        dirty = true;
        if (playerHp <= 0) return playerFaintLog();
      }
      if (atkPoke.flinch) {
        atkPoke.flinch = false;
        dirty = true;
        return;
      }
      const pAct = canAct(atkPoke.status);
      atkPoke.status = pAct.status;
      if (pAct.note === "thawed") log = pushLog(log, `${atkPoke.name} thawed out!`, "system");
      if (!pAct.ok) {
        dirty = true;
        return;
      }

      const eff = wildEffective(atkPoke, wildActivations);
      const picked = chosenMoves(atkPoke, levelOf(atkPoke))[s.selectedMove] ?? undefined;
      const { damage, missed } = attackDamage(eff.poke, enemy, {
        attackerIsPlayer: true,
        playerPrestige: s.playerPrestige,
        uniqueBonus,
        form: eff.form,
        teraType: eff.teraType,
        move: picked,
        synergy,
        critStageBonus: synergy.critStage,
        defenderSynergy: enemySynergy,
        attackerBurned: atkPoke.status?.kind === "burn",
      });
      if (missed) {
        log = pushLog(log, `${atkPoke.name}'s attack missed!`, "system");
        dirty = true;
        return;
      }
      enemy.hp = Math.max(s.falseSwipe ? 1 : 0, enemy.hp - damage);
      stats = { ...stats, damage: stats.damage + damage };
      enemyHit = now;
      dirty = true;

      // Enemy Ground synergy: chance to start the player's mon bleeding after it
      // strikes a Ground-type enemy.
      if (
        !atkPoke.bleed &&
        enemySynergy.groundBleedChance > 0 &&
        isType(enemy, "Ground") &&
        Math.random() < enemySynergy.groundBleedChance
      ) {
        atkPoke.bleed = true;
        log = pushLog(log, `${atkPoke.name} started bleeding!`, "system");
      }

      // Enemy Steel synergy: part of the hit comes back into the player's pool.
      if (enemySynergy.steelReturnPct > 0 && damage > 0 && isType(enemy, "Steel")) {
        playerHp = Math.max(0, playerHp - Math.max(1, Math.floor(damage * enemySynergy.steelReturnPct)));
        playerHit = now;
        if (playerHp <= 0) {
          lastHeal = now;
          log = pushLog(log, "You fainted! Auto-healing in 15 seconds...", "escape");
        }
      }

      // Water synergy: chance to heal the player's HP pool on a Water-type hit.
      if (
        synergy.waterHealChance > 0 &&
        isType(atkPoke, "Water") &&
        Math.random() < synergy.waterHealChance
      ) {
        const pMax = playerMaxHp(playerLevelOf(playerExp), s.playerPrestige, synergy.hpPct);
        playerHp = Math.min(pMax, playerHp + Math.max(1, Math.floor(pMax * WATER_HEAL_FRAC)));
      }

      // Party status inflictions (freeze/burn/poison/paralyze + Dark flinch).
      const inf = rollInflictions(synergy, atkPoke, enemy, !!enemy.status);
      if (inf.flinch) enemy.flinch = true;
      if (inf.status) {
        enemy.status = inf.status;
        log = pushLog(log, `${enemy.name} was ${inf.label}!`, "system");
      }
    };

    const enemyAtk = () => {
      const defPoke = team[activeIndex];
      if (!defPoke || playerHp <= 0 || enemy.hp <= 0) return;

      // Residual poison / toxic damage at the start of the enemy's turn.
      if (enemy.status?.kind === "poison" || enemy.status?.kind === "toxic") {
        const r = tickResidual(enemy.hp, combatStats(enemy, { synergy: enemySynergy }).maxHp, enemy.status);
        enemy.hp = r.hp;
        enemy.status = r.status;
        if (r.lost > 0) {
          enemyHit = now;
          dirty = true;
        }
        if (enemy.hp <= 0) return;
      }

      // Ground synergy: a bleeding enemy loses 2% max HP each time it attacks.
      if (enemy.bleed) {
        const eMax = combatStats(enemy, { synergy: enemySynergy }).maxHp;
        enemy.hp = Math.max(0, enemy.hp - Math.max(1, Math.floor(eMax * GROUND_BLEED_FRAC)));
        enemyHit = now;
        dirty = true;
        if (enemy.hp <= 0) return;
      }

      // Dark synergy: a flinching enemy loses this turn.
      if (enemy.flinch) {
        enemy.flinch = false;
        dirty = true;
        return;
      }

      // Freeze / paralyze may cost the enemy its turn.
      const act = canAct(enemy.status);
      enemy.status = act.status;
      if (act.note === "thawed") log = pushLog(log, `${enemy.name} thawed out!`, "system");
      if (!act.ok) {
        dirty = true;
        return;
      }

      const { damage, missed } = attackDamage(enemy, defPoke, {
        attackerIsPlayer: false,
        playerPrestige: s.playerPrestige,
        uniqueBonus,
        move: bestMoveAgainst(enemy, levelOf(enemy), combatStats(defPoke).types),
        synergy: enemySynergy,
        defenderSynergy: synergy,
        critStageBonus: enemySynergy.critStage,
        attackerBurned: enemy.status?.kind === "burn",
      });
      if (missed) {
        log = pushLog(log, `${enemy.name}'s attack missed!`, "system");
        dirty = true;
        return;
      }

      playerHp = Math.max(0, playerHp - damage);
      playerHit = now;
      dirty = true;

      // Enemy Water synergy: chance to heal itself on its attack.
      if (
        enemySynergy.waterHealChance > 0 &&
        isType(enemy, "Water") &&
        Math.random() < enemySynergy.waterHealChance
      ) {
        const eMax = combatStats(enemy, { synergy: enemySynergy }).maxHp;
        enemy.hp = Math.min(eMax, enemy.hp + Math.max(1, Math.floor(eMax * WATER_HEAL_FRAC)));
      }

      // Steel synergy: reflect part of the hit back as true damage.
      if (synergy.steelReturnPct > 0 && damage > 0 && isType(defPoke, "Steel")) {
        enemy.hp = Math.max(0, enemy.hp - Math.max(1, Math.floor(damage * synergy.steelReturnPct)));
        enemyHit = now;
      }
      // Ground synergy: chance to start the enemy bleeding after it hits a Ground mon.
      if (
        !enemy.bleed &&
        synergy.groundBleedChance > 0 &&
        isType(defPoke, "Ground") &&
        Math.random() < synergy.groundBleedChance
      ) {
        enemy.bleed = true;
        log = pushLog(log, `${enemy.name} started bleeding!`, "system");
      }

      // Enemy synergy status inflictions on the player's active mon.
      const eInf = rollInflictions(enemySynergy, enemy, defPoke, !!defPoke.status);
      if (eInf.flinch) defPoke.flinch = true;
      if (eInf.status) {
        defPoke.status = eInf.status;
        log = pushLog(log, `${defPoke.name} was ${eInf.label}!`, "system");
      }

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
        // Auto-catch: treated as a full-HP target, current-tier ball, no aim bonus.
        const chance = catchChance(spec?.catch ?? 45, s.catchTier, s.catchTier, s.catchLevel, 1, false);
        if (Math.random() < chance) {
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
    const playerSpe = Math.max(
      1,
      combatStats(effActive.poke, {
        isPlayer: true,
        playerPrestige: s.playerPrestige,
        uniqueBonus,
        form: effActive.form,
        synergy,
      }).spe - enemySynergy.enemySpeFlat,
    );
    const enemySpe = Math.max(
      1,
      combatStats(enemy, { synergy: enemySynergy }).spe - synergy.enemySpeFlat,
    );
    const playerInt = attackIntervalMs(playerSpe);
    const enemyInt = attackIntervalMs(enemySpe);

    // Speed-cap cooldowns count down toward "ready".
    playerAtkCd = Math.max(0, playerAtkCd - dtms);
    enemyAtkCd = Math.max(0, enemyAtkCd - dtms);
    // A genuinely new enemy (fresh spawn, not just a still-alive one from last
    // tick) waits out a 1-second grace period — at minimum — before its first
    // action, so the player always gets the opening move on a fresh encounter.
    if (justSpawnedEnemy) enemyAtkCd = Math.max(enemyInt, ENEMY_FIRST_ATTACK_DELAY_MS);

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
          break;
        }
      }
    };
    const runEnemyTurns = () => {
      let g = 0;
      while (enemyAtkCd <= 0 && enemy.hp > 0 && playerHp > 0 && g++ < 8) {
        enemyAtkCd = enemyInt;
        enemyAtk();
        // Steel-return / Ground-bleed synergy can KO the enemy on its own turn.
        if (enemy.hp <= 0) {
          onEnemyFaint();
          break;
        }
      }
    };

    // On a simultaneous turn the faster mon resolves first (so it can KO before
    // the slower one retaliates). Ghost synergy: a Ghost-type mon has a chance
    // to take its turn first regardless of Speed — the player's own roll wins
    // over the enemy's.
    const playerGhostFirst =
      synergy.ghostFirstChance > 0 &&
      !!team[activeIndex] &&
      isType(team[activeIndex], "Ghost") &&
      Math.random() < synergy.ghostFirstChance;
    const enemyGhostFirst =
      enemySynergy.ghostFirstChance > 0 &&
      isType(enemy, "Ghost") &&
      Math.random() < enemySynergy.ghostFirstChance;
    let playerFirst = playerSpe >= enemySpe;
    if (playerGhostFirst) playerFirst = true;
    else if (enemyGhostFirst) playerFirst = false;
    if (playerFirst) {
      runPlayerTurns();
      runEnemyTurns();
    } else {
      runEnemyTurns();
      runPlayerTurns();
    }

    // Grass synergy: chance to clear a status from any party mon that has one.
    if (synergy.grassCleanseChance > 0 && Math.random() < synergy.grassCleanseChance) {
      const cured = team.findIndex((p) => p.status);
      if (cured >= 0) {
        team[cured] = { ...team[cured], status: undefined };
        dirty = true;
      }
    }

    // Auto-advance: once every species on this route's wild list is caught,
    // move on to the next route in the region (opt-in, Settings toggle).
    let region = s.region;
    let route = s.route;
    if (s.autoAdvanceRoute && isRouteDexComplete(region, route, dex)) {
      const next = nextRouteInRegion(region, route, dex);
      if (next) {
        const def = ROUTES[region]?.[next];
        route = next;
        respawnAt = 0;
        playerAtkCd = 0;
        enemyAtkCd = 0;
        autoTapAcc = 0;
        pendingTaps = 0;
        const spawned = spawnEnemy(region, route, anomalyCleared, dex, s.gmaxChanceMult);
        if (spawned) {
          enemy = spawned;
          dex = markDex(dex, enemy.name, enemy.shiny ? 2 : 1);
          stats = enemy.shiny
            ? { ...stats, shinySeen: stats.shinySeen + 1 }
            : { ...stats, seen: stats.seen + 1 };
        }
        log = pushLog(log, `Route complete! Auto-advanced to ${def?.name ?? route}.`, "system");
        dirty = true;
      }
    }

    const shouldUi = dirty || uiAcc > 0.08;
    if (shouldUi) {
      uiAcc = 0;
      set({
        team,
        storage,
        active: activeIndex,
        region,
        route,
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
    const teamSyn = computeSynergy(s.team);
    const reset = (list: OwnedPoke[], syn?: ReturnType<typeof computeSynergy>) =>
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
          synergy: syn,
        }).maxHp;
        return next;
      });

    set({
      playerPrestige: s.playerPrestige + 1,
      playerHp: playerMaxHp(1, s.playerPrestige + 1, teamSyn.hpPct),
      playerExp: 0,
      team: reset(s.team, teamSyn),
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
    set({ active: index, selectedMove: 0 });
  },

  setSelectedMove: (index) => {
    set({ selectedMove: Math.max(0, Math.min(3, Math.floor(index) || 0)) });
  },

  setCatchMode: (catchMode) => {
    set({ catchMode });
    persist({ ...get() });
  },

  toggleFalseSwipe: () => {
    set({ falseSwipe: !get().falseSwipe });
    persist({ ...get() });
  },

  toggleAutoAdvanceRoute: () => {
    set({ autoAdvanceRoute: !get().autoAdvanceRoute });
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
      // Rayquaza Mega-Evolves by knowing Dragon Ascent, never via this button.
      if (baseSpeciesOf(mon.name) === "Rayquaza") return;
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
      const teraForms = teraFormsFor(s.dex, mon.name);
      if (teraForms.length > 0) {
        formName = formChoice && teraForms.includes(formChoice) ? formChoice : teraForms[0];
        verb = `Terastallized into ${formName.replace("Terapagos-", "")}`;
      } else {
        verb = `Terastallized${mon.teraType ? ` (${mon.teraType})` : ""}`;
      }
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
    // Manual: real formula with the enemy's live HP fraction + aim bonus.
    const eMax = combatStats(e).maxHp;
    const hpFrac = eMax > 0 ? e.hp / eMax : 0;
    const chance = catchChance(spec?.catch ?? 45, ball, s.catchTier, s.catchLevel, hpFrac, true);

    if (Math.random() >= chance) {
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
    // Mega / Primal / Tera / Dynamax / Gigantamax are activations, not evolutions.
    if (isAnomalyFormName(to)) return;
    const uniqueBonus = uniqueCaughtBonus(uniqueCaught(s.dex));
    const teamSyn = computeSynergy(s.team.map((p) => (p.uid === uid ? { ...p, name: to } : p)));
    const apply = (list: OwnedPoke[], syn?: ReturnType<typeof computeSynergy>) =>
      list.map((p) => {
        if (p.uid !== uid) return p;
        const next = { ...p, name: to };
        next.hp = combatStats(next, {
          isPlayer: true,
          playerPrestige: s.playerPrestige,
          uniqueBonus,
          synergy: syn,
        }).maxHp;
        return next;
      });
    const team = apply(s.team, teamSyn);
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

  modifyPoke: (uid, rawDraft) => {
    const s = get();
    const idx = s.team.findIndex((p) => p.uid === uid); // party mons only
    if (idx < 0) return false;
    const cur = s.team[idx];
    const lvl = levelOf(cur);
    const d = sanitizeDraft(cur, lvl, rawDraft);
    const cost = modifyPokeCost(cur, lvl, d);
    if (cost > s.pokeyen) return false;

    const uniqueBonus = uniqueCaughtBonus(uniqueCaught(s.dex));
    const next: OwnedPoke = {
      ...cur,
      ivs: d.ivs,
      evs: d.evs,
      nature: d.nature,
      moves: d.moves.length ? d.moves : undefined,
    };
    const synergy = computeSynergy(s.team);
    next.hp = Math.min(
      cur.hp,
      combatStats(next, { isPlayer: true, playerPrestige: s.playerPrestige, uniqueBonus, synergy }).maxHp,
    );

    set({
      team: s.team.map((p, i) => (i === idx ? next : p)),
      pokeyen: s.pokeyen - cost,
      log: pushLog(
        s.log,
        cost > 0 ? `${cur.name} retrained (−¥${cost.toLocaleString()}).` : `${cur.name} updated.`,
        "system",
      ),
    });
    persist({ ...get() });
    return true;
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