import { create } from "zustand";
import { ROUTES, REGIONS, REGION_UNLOCK, speciesByName, STARTERS, POKEDEX } from "./dex";
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
  SHINY_ODDS,
  TEAM_SIZE,
  MAX_AUTO_LEVEL,
  autoTapCost,
  autoTapMsFromLevel,
  catchUpgradeCost,
  CATCH_TIER_ORDER,
  pokeyenReward,
  uniqueCaughtBonus,
} from "./formulas";
import type {
  CatchMode,
  CatchTier,
  DexFlag,
  LogLine,
  OwnedPoke,
  SaveBlob,
  Stats,
  TabId,
} from "./types";

const SAVE_KEY = "pokeidle-save-v4";
const LEGACY_SAVE_KEY = "pokeidle-save-v3";
const SAVE_VERSION = 4;
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
let playerTimer = 0; // auto-tap accumulator (ms)
let enemyTimer = 0;
let uiAcc = 0;
let saveAcc = 0;
let lastManualTap = 0;
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
  autoTapLevel: number; // 0–25
  catchTier: CatchTier;
  catchLevel: number; // 1–10
  /** Always-on catch; only filters which mons are attempted. */
  catchMode: CatchMode;
  region: string;
  route: string;
  dex: Record<string, DexFlag>;
  stats: Stats;
  lastHeal: number;
  anomalyCleared: Record<string, boolean>;
  log: LogLine[];
  paused: boolean;
  playerHit: number;
  enemyHit: number;
  lastCatch: "none" | "caught" | "escaped" | "shiny";
  now: number;
};

type GameActions = {
  startWith: (name: (typeof STARTERS)[number]) => void;
  step: (dt: number) => void;
  manualTap: () => void;
  setTab: (tab: TabId) => void;
  setRoute: (region: string, route: string) => void;
  setActive: (index: number) => void;
  setCatchMode: (mode: CatchMode) => void;
  buyAutoTap: () => void;
  buyCatchUpgrade: () => void;
  /** Prestige the player (global). Requires at least one mon at Lv.100. */
  prestigePlayer: () => void;
  heal: () => void;
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
    autoTapLevel: 0,
    catchTier: "pokeball",
    catchLevel: 1,
    catchMode: "new",
    region: "Kanto",
    route: "route",
    dex: {},
    stats: defaultStats(),
    lastHeal: 0,
    anomalyCleared: {},
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
    autoTapLevel: state.autoTapLevel,
    catchTier: state.catchTier,
    catchLevel: state.catchLevel,
    catchMode: state.catchMode,
    region: state.region,
    route: state.route,
    dex: state.dex,
    stats: state.stats,
    lastHeal: state.lastHeal,
    started: state.started,
    anomalyCleared: state.anomalyCleared,
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
): OwnedPoke | null {
  const route = ROUTES[region]?.[routeId];
  if (!route || route.pokes.length === 0) return null;
  const name = pickWeighted(route.pokes, route.weights);
  if (!speciesByName(name)) return null;
  const shiny = Math.random() < SHINY_ODDS;
  const prestige =
    region === "Anomalies" && anomalyCleared[routeId]
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
  const region = saved.region && ROUTES[saved.region] ? saved.region : "Kanto";
  const route =
    saved.route && ROUTES[region]?.[saved.route] ? saved.route : "route";
  const team = (saved.team ?? []).map((p) => ({
    ...p,
    hp: Math.min(p.hp, combatStats(p).maxHp),
  }));
  const activeIndex = Math.min(
    saved.active ?? 0,
    Math.max(0, team.length - 1),
  );
  const activePoke = team[activeIndex];
  const maxHp = activePoke
    ? playerMaxHp(levelOf(activePoke), saved.playerPrestige ?? 0)
    : 10;
  const state: GameState = {
    ...base,
    started: true,
    team,
    storage: saved.storage ?? [],
    active: activeIndex,
    pokeyen: saved.pokeyen ?? 0,
    playerPrestige: saved.playerPrestige ?? 0,
    playerHp: Math.min(saved.playerHp ?? maxHp, maxHp),
    autoTapLevel: Math.min(MAX_AUTO_LEVEL, saved.autoTapLevel ?? 0),
    catchTier: saved.catchTier ?? "pokeball",
    catchLevel: Math.max(1, Math.min(10, saved.catchLevel ?? 1)),
    catchMode: saved.catchMode === "all" ? "all" : "new",
    region,
    route,
    dex: saved.dex ?? {},
    stats: { ...defaultStats(), ...saved.stats },
    lastHeal: saved.lastHeal ?? 0,
    anomalyCleared: saved.anomalyCleared ?? {},
    enemy: spawnEnemy(region, route, saved.anomalyCleared ?? {}),
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
    playerTimer = 0;
    enemyTimer = 0;
    lastManualTap = 0;
    respawnAt = 0;
    set(next);
  },

  startWith: (name) => {
    const starter = makeOwned(name, 5, false, 0);
    const enemy = spawnEnemy("Kanto", "route", {});
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
      playerHp: playerMaxHp(levelOf(starter), 0),
      log: pushLog([], `Go, ${name}! Route 1 awaits.`, "system"),
      now: Date.now(),
    };
    persist(next);
    playerTimer = 0;
    enemyTimer = 0;
    lastManualTap = 0;
    respawnAt = 0;
    set(next);
  },

  manualTap: () => {
    const s = get();
    if (!s.started || s.paused) return;
    const now = Date.now();
    if (now - lastManualTap < 50) return;
    // Don't attack during respawn gap
    if (now < respawnAt || !s.enemy || s.enemy.hp <= 0) return;
    lastManualTap = now;

    const team = s.team.map((p) => ({ ...p }));
    const activeIndex = s.active;
    const atkPoke = team[activeIndex];
    if (!atkPoke || s.playerHp <= 0) return;

    const uniqueBonus = uniqueCaughtBonus(uniqueCaught(s.dex));
    let enemy = { ...s.enemy };
    const { damage } = attackDamage(atkPoke, enemy, {
      attackerIsPlayer: true,
      playerPrestige: s.playerPrestige,
      uniqueBonus,
    });
    enemy.hp = Math.max(0, enemy.hp - damage);
    const stats = { ...s.stats, damage: s.stats.damage + damage };

    // Let the next step() frame run onEnemyFaint when hp hit 0
    set({
      team,
      enemy,
      stats,
      enemyHit: now,
      now,
    });
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

    if (playerHp <= 0) {
      if (now - s.lastHeal >= HEAL_COOLDOWN_MS) {
        const maxHp = playerMaxHp(levelOf(active), s.playerPrestige);
        set({
          playerHp: maxHp,
          lastHeal: now,
          log: pushLog(s.log, "You fainted and were auto-healed.", "system"),
          now,
        });
        persist({ ...get() });
        return;
      }

      if (uiAcc > 0.2) {
        uiAcc = 0;
        set({ now });
      }
      return;
    }

    let activeIndex = s.active;

    // Respawn gate: wait RESPAWN_DELAY_MS after a faint before the next wild mon
    if (respawnAt > 0 && now < respawnAt) {
      if (uiAcc > 0.05) {
        uiAcc = 0;
        set({ now, enemy: null });
      }
      return;
    }

    let log = s.log;
    let dex = s.dex;
    let stats = s.stats;
    let storage = s.storage;
    let anomalyCleared = s.anomalyCleared;
    let pokeyen = s.pokeyen;
    let playerHit = s.playerHit;
    let enemyHit = s.enemyHit;
    let lastCatch: GameState["lastCatch"] = "none";
    let dirty = false;

    const uniqueBonus = uniqueCaughtBonus(uniqueCaught(dex));

    // Pending manual-tap kill (hp already 0, rewards not applied yet)
    const pendingFaint = !!(s.enemy && s.enemy.hp <= 0 && respawnAt === 0);

    let enemy: OwnedPoke;
    if (s.enemy && s.enemy.hp > 0) {
      enemy = { ...s.enemy };
    } else if (pendingFaint && s.enemy) {
      enemy = { ...s.enemy }; // dead; onEnemyFaint will process below
    } else {
      const spawned = spawnEnemy(s.region, s.route, s.anomalyCleared);
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
      const { damage } = attackDamage(atkPoke, enemy, {
        attackerIsPlayer: true,
        playerPrestige: s.playerPrestige,
        uniqueBonus,
      });
      enemy.hp = Math.max(0, enemy.hp - damage);
      stats = { ...stats, damage: stats.damage + damage };
      enemyHit = now;
      dirty = true;
      // No per-hit damage log — pokeyen on faint is what matters
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
        log = pushLog(log, "You fainted! Heal to continue.", "escape");
      }
    };

    const onEnemyFaint = () => {
      const fallen = enemy;
      stats = { ...stats, beaten: stats.beaten + 1 };
      if (s.region === "Anomalies" && !anomalyCleared[s.route]) {
        anomalyCleared = { ...anomalyCleared, [s.route]: true };
      }

      // Pokeyen: base 25 + 3.5 per enemy level — primary combat feedback
      const yenGain = pokeyenReward(levelOf(fallen));
      pokeyen += yenGain;
      log = pushLog(
        log,
        `+¥${yenGain} · ${fallen.shiny ? "Shiny " : ""}${fallen.name}`,
        fallen.shiny ? "shiny" : "neutral",
      );

      // Catch is ALWAYS on — only filtered by catchMode (new / all)
      const wantCatch =
        s.catchMode === "all" ||
        (s.catchMode === "new" &&
          !hasPokemon(team, storage, fallen.name, false)) ||
        fallen.shiny;

      if (wantCatch) {
        const spec = speciesByName(fallen.name);
        const chance = catchChancePercentPermanent(
          spec?.catch ?? 45,
          s.catchTier,
          s.catchLevel,
        );
        if (Math.random() * 100 < chance) {
          const caught = makeOwned(fallen.name, levelOf(fallen), fallen.shiny, 0);
          if (team.length < TEAM_SIZE) team.push(caught);
          else storage = [...storage, caught];
          dex = markDex(dex, fallen.name, fallen.shiny ? 8 : 6);
          if (fallen.shiny) {
            stats = { ...stats, shinyCaught: stats.shinyCaught + 1 };
            log = pushLog(log, `Caught Shiny ${fallen.name}!!`, "shiny");
            lastCatch = "shiny";
          } else {
            stats = { ...stats, caught: stats.caught + 1 };
            log = pushLog(log, `Caught ${fallen.name}!`, "catch");
            lastCatch = "caught";
          }
        } else {
          log = pushLog(log, `${fallen.name} broke free!`, "escape");
          lastCatch = "escaped";
        }
      }

      const atkPoke = team[activeIndex];
      const fullReward = expReward(fallen);
      if (atkPoke) {
        const before = levelOf(atkPoke);
        atkPoke.exp += fullReward;
        const after = levelOf(atkPoke);
        if (after > before) {
          playerHp = playerMaxHp(after, s.playerPrestige);
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

      // Clear enemy and schedule next spawn in 200ms
      enemy = { ...fallen, hp: 0 };
      respawnAt = now + RESPAWN_DELAY_MS;
      dirty = true;
    };

    // Process a kill that came from manualTap on the previous frame
    if (pendingFaint) {
      onEnemyFaint();
      playerTimer = 0;
      enemyTimer = 0;
    }

    // ── Auto-tap ──────────────────────────────────────────────────────────
    const autoMs = autoTapMsFromLevel(s.autoTapLevel);
    playerTimer += dt * 1000;
    enemyTimer += dt * 1000;

    let guard = 0;
    while (playerTimer >= autoMs && guard++ < 12) {
      playerTimer -= autoMs;
      if (enemy.hp > 0 && playerHp > 0) playerAtk();
      if (enemy.hp <= 0) {
        onEnemyFaint();
        playerTimer = 0;
        enemyTimer = 0;
        break;
      }
    }

    // Enemy attacks on a fixed 1 s cadence
    const eSpeed = 1000;
    guard = 0;
    while (enemyTimer >= eSpeed && guard++ < 8 && enemy.hp > 0) {
      enemyTimer -= eSpeed;
      if (playerHp > 0) enemyAtk();
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
        dex,
        stats,
        log,
        playerHit,
        enemyHit,
        lastCatch,
        anomalyCleared,
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
    const cost = catchUpgradeCost(s.catchLevel);
    if (s.pokeyen < cost) return;

    let nextTier = s.catchTier;
    let nextLevel = s.catchLevel + 1;

    if (nextLevel > 10) {
      const idx = CATCH_TIER_ORDER.indexOf(s.catchTier);
      if (idx >= CATCH_TIER_ORDER.length - 1) return; // already master 10
      nextTier = CATCH_TIER_ORDER[idx + 1];
      nextLevel = 1;
    }

    set({
      pokeyen: s.pokeyen - cost,
      catchTier: nextTier,
      catchLevel: nextLevel,
      log: pushLog(
        s.log,
        `Catch power up! ${nextTier} Lv.${nextLevel}`,
        "system",
      ),
    });
    persist({ ...get() });
  },

  prestigePlayer: () => {
    const s = get();
    // Require at least one team mon at Lv.100
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
    // Reset all team/storage exp to Lv.1, keep names/shinies, bump player prestige
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
    // Region unlock still uses total prestige-like check via playerPrestige if needed
    if (def.requiredPrestige != null && get().playerPrestige < def.requiredPrestige)
      return;
    playerTimer = 0;
    enemyTimer = 0;
    respawnAt = 0;
    const enemy = spawnEnemy(region, route, get().anomalyCleared);
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
    playerTimer = 0;
    set({ active: index });
  },

  setCatchMode: (catchMode) => {
    set({ catchMode });
    persist({ ...get() });
  },

  heal: () => {
    const s = get();
    if (Date.now() - s.lastHeal < HEAL_COOLDOWN_MS) return;

    const active = s.team[s.active] ?? s.team[0];
    const maxHp = active
      ? playerMaxHp(levelOf(active), s.playerPrestige)
      : 10;

    set({
      playerHp: maxHp,
      lastHeal: Date.now(),
      log: pushLog(s.log, "You were healed.", "system"),
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
      playerTimer = 0;
      enemyTimer = 0;
      set(next);
      return true;
    } catch {
      return false;
    }
  },

  resetGame: () => {
    localStorage.removeItem(SAVE_KEY);
    playerTimer = 0;
    enemyTimer = 0;
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
