import { create } from "zustand";
import { ROUTES, REGIONS, REGION_UNLOCK, speciesByName, STARTERS } from "./dex";
import {
  attackDamage,
  BENCH_EXP_SHARE,
  catchChancePercent,
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
} from "./formulas";
import type {
  BallKind,
  CatchMode,
  DexFlag,
  LogLine,
  OwnedPoke,
  SaveBlob,
  Stats,
  TabId,
} from "./types";

const SAVE_KEY = "pokeidle-save-v1";
const SAVE_VERSION = 1;
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

function hasPokemon(team: OwnedPoke[], storage: OwnedPoke[], name: string, shiny: boolean): boolean {
  return team.some((p) => p.name === name && p.shiny === shiny) || storage.some((p) => p.name === name && p.shiny === shiny);
}

function loadSave(): Partial<SaveBlob> | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SaveBlob;
    if (!parsed || parsed.version !== SAVE_VERSION) return parsed;
    return parsed;
  } catch {
    return null;
  }
}

let logSeq = 1;
let playerTimer = 0;
let enemyTimer = 0;
let uiAcc = 0;
let saveAcc = 0;

export type GameState = {
  started: boolean;
  tab: TabId;
  team: OwnedPoke[];
  storage: OwnedPoke[];
  active: number;
  enemy: OwnedPoke | null;
  balls: Record<BallKind, number>;
  selectedBall: BallKind;
  catchMode: CatchMode;
  region: string;
  route: string;
  dex: Record<string, DexFlag>;
  stats: Stats;
  lastHeal: number;
  autoPrestige: boolean;
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
  setTab: (tab: TabId) => void;
  setRoute: (region: string, route: string) => void;
  setActive: (index: number) => void;
  setCatchMode: (mode: CatchMode) => void;
  setBall: (ball: BallKind) => void;
  heal: () => void;
  evolve: (uid: string, to: string) => void;
  prestige: (uid: string) => void;
  moveToStorage: (uid: string) => void;
  moveToTeam: (uid: string) => void;
  release: (uid: string, from: "team" | "storage") => void;
  setAutoPrestige: (v: boolean) => void;
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
    balls: { pokeball: 100, greatball: 50, ultraball: 10 },
    selectedBall: "pokeball",
    catchMode: "new",
    region: "Kanto",
    route: "route",
    dex: {},
    stats: defaultStats(),
    lastHeal: 0,
    autoPrestige: false,
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
    balls: state.balls,
    selectedBall: state.selectedBall,
    catchMode: state.catchMode,
    region: state.region,
    route: state.route,
    dex: state.dex,
    stats: state.stats,
    lastHeal: state.lastHeal,
    autoPrestige: state.autoPrestige,
    started: state.started,
  };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(blob));
  } catch {
    /* quota / private mode */
  }
}

function spawnEnemy(region: string, routeId: string): OwnedPoke | null {
  const route = ROUTES[region]?.[routeId];
  if (!route || route.pokes.length === 0) return null;
  const name = pickWeighted(route.pokes, route.weights);
  if (!speciesByName(name)) return null;
  const shiny = Math.random() < SHINY_ODDS;
  return makeOwned(name, randomLevel(route.minLevel, route.maxLevel), shiny, 0);
}

function markDex(dex: Record<string, DexFlag>, name: string, flag: DexFlag): Record<string, DexFlag> {
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
  const route = saved.route && ROUTES[region]?.[saved.route] ? saved.route : "route";
  const team = (saved.team ?? []).map((p) => ({ ...p, hp: Math.min(p.hp, combatStats(p).maxHp) }));
  const state: GameState = {
    ...base,
    started: true,
    team,
    storage: saved.storage ?? [],
    active: Math.min(saved.active ?? 0, Math.max(0, team.length - 1)),
    balls: saved.balls ?? base.balls,
    selectedBall: saved.selectedBall ?? "pokeball",
    catchMode: saved.catchMode ?? "new",
    region,
    route,
    dex: saved.dex ?? {},
    stats: { ...defaultStats(), ...saved.stats },
    lastHeal: saved.lastHeal ?? 0,
    autoPrestige: !!saved.autoPrestige,
    enemy: spawnEnemy(region, route),
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
    set(next);
  },

  startWith: (name) => {
    const starter = makeOwned(name, 5, false, 0);
    const enemy = spawnEnemy("Kanto", "route");
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
      log: pushLog([], `Go, ${name}! Route 1 awaits.`, "system"),
      now: Date.now(),
    };
    persist(next);
    playerTimer = 0;
    enemyTimer = 0;
    set(next);
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

    const living = team.findIndex((p) => p.hp > 0);
    if (living < 0) {
      if (uiAcc > 0.2) {
        uiAcc = 0;
        set({ now });
      }
      return;
    }
    let activeIndex = s.active;
    if (active.hp <= 0) {
      activeIndex = living;
    }

    const spawned = s.enemy ? { ...s.enemy } : spawnEnemy(s.region, s.route);
    if (!spawned) return;
    let enemy: OwnedPoke = spawned;

    let log = s.log;
    let dex = s.dex;
    let stats = s.stats;
    let balls = s.balls;
    let storage = s.storage;
    let playerHit = s.playerHit;
    let enemyHit = s.enemyHit;
    let lastCatch: GameState["lastCatch"] = "none";
    let dirty = false;

    const playerAtk = () => {
      const atkPoke = team[activeIndex];
      if (!atkPoke || atkPoke.hp <= 0 || enemy.hp <= 0) return;
      const { damage, multiplier } = attackDamage(atkPoke, enemy);
      enemy.hp = Math.max(0, enemy.hp - damage);
      stats = { ...stats, damage: stats.damage + damage };
      enemyHit = now;
      dirty = true;
      if (multiplier >= 2) log = pushLog(log, `Super effective! ${damage} dmg`, "hit");
      else if (multiplier <= 0.5 && multiplier > 0) log = pushLog(log, `Not very effective… ${damage}`, "hit");
    };

    const enemyAtk = () => {
      const defPoke = team[activeIndex];
      if (!defPoke || defPoke.hp <= 0 || enemy.hp <= 0) return;
      const { damage } = attackDamage(enemy, defPoke);
      defPoke.hp = Math.max(0, defPoke.hp - damage);
      playerHit = now;
      dirty = true;
      if (defPoke.hp <= 0) {
        log = pushLog(log, `${defPoke.name} fainted!`, "escape");
        const nextLiving = team.findIndex((p) => p.hp > 0);
        if (nextLiving >= 0) {
          activeIndex = nextLiving;
          log = pushLog(log, `Go, ${team[nextLiving].name}!`, "system");
        } else {
          log = pushLog(log, "Your team is down. Heal to continue.", "system");
        }
      }
    };

    const onEnemyFaint = () => {
      const fallen = enemy;
      stats = {
        ...stats,
        beaten: stats.beaten + 1,
      };
      log = pushLog(log, `Felled ${fallen.shiny ? "Shiny " : ""}${fallen.name}!`, fallen.shiny ? "shiny" : "neutral");

      const wantCatch =
        s.catchMode === "all" ||
        (s.catchMode === "new" && !hasPokemon(team, storage, fallen.name, false)) ||
        fallen.shiny;

      if (wantCatch) {
        const ball: BallKind = fallen.shiny
          ? (["ultraball", "greatball", "pokeball"] as BallKind[]).find((b) => balls[b] > 0) ?? s.selectedBall
          : s.selectedBall;
        if (balls[ball] > 0) {
          balls = { ...balls, [ball]: balls[ball] - 1 };
          const spec = speciesByName(fallen.name);
          const chance = catchChancePercent(spec?.catch ?? 45, ball);
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
      }

      if (Math.random() * 100 < 5) {
        const drop = (["pokeball", "pokeball", "pokeball", "pokeball", "pokeball", "pokeball", "greatball", "greatball", "ultraball"] as BallKind[])[
          Math.floor(Math.random() * 9)
        ];
        const amt = 1 + Math.floor(Math.random() * 2);
        balls = { ...balls, [drop]: balls[drop] + amt };
        log = pushLog(log, `Found ${amt} ${drop.replace("ball", " Ball")}!`, "system");
      }

      const atkPoke = team[activeIndex];
      const fullReward = expReward(fallen);
      if (atkPoke) {
        const before = levelOf(atkPoke);
        atkPoke.exp += fullReward;
        const after = levelOf(atkPoke);
        if (after > before) {
          atkPoke.hp = combatStats(atkPoke).maxHp;
          log = pushLog(log, `${atkPoke.name} grew to Lv. ${after}!`, "level");
          if (s.autoPrestige && after >= 100) {
            atkPoke.prestige += 1;
            const spec = speciesByName(atkPoke.name);
            atkPoke.exp = expAtLevel((spec?.growth ?? "Medium Fast") as "Medium Fast", 1);
            atkPoke.hp = combatStats(atkPoke).maxHp;
            log = pushLog(log, `${atkPoke.name} prestiged to +${atkPoke.prestige}%!`, "level");
          }
        }
      }
      for (const p of team) {
        if (p === atkPoke) continue;
        const before = levelOf(p);
        p.exp += fullReward * BENCH_EXP_SHARE;
        if (levelOf(p) > before) {
          p.hp = combatStats(p).maxHp;
          log = pushLog(log, `${p.name} grew to Lv. ${levelOf(p)}!`, "level");
        }
      }

      const next = spawnEnemy(s.region, s.route);
      if (next) {
        enemy = next;
        dex = markDex(dex, next.name, next.shiny ? 2 : 1);
        if (next.shiny) {
          stats = { ...stats, shinySeen: stats.shinySeen + 1 };
          log = pushLog(log, `A Shiny ${next.name} appeared!`, "shiny");
        } else {
          stats = { ...stats, seen: stats.seen + 1 };
        }
      }
      dirty = true;
    };

    playerTimer += dt * 1000;
    enemyTimer += dt * 1000;
    const pSpeed = combatStats(team[activeIndex]).speedMs;
    const eSpeed = combatStats(enemy).speedMs;

    let guard = 0;
    while (playerTimer >= pSpeed && guard++ < 8) {
      playerTimer -= pSpeed;
      if (enemy.hp > 0 && team[activeIndex].hp > 0) playerAtk();
      if (enemy.hp <= 0) {
        onEnemyFaint();
        playerTimer = 0;
        enemyTimer = 0;
        break;
      }
    }
    guard = 0;
    while (enemyTimer >= eSpeed && guard++ < 8 && enemy.hp > 0) {
      enemyTimer -= eSpeed;
      if (team[activeIndex].hp > 0) enemyAtk();
    }

    const shouldUi = dirty || uiAcc > 0.08;
    if (shouldUi) {
      uiAcc = 0;
      const nextState: Partial<GameState> = {
        team,
        storage,
        active: activeIndex,
        enemy,
        balls,
        dex,
        stats,
        log,
        playerHit,
        enemyHit,
        lastCatch,
        now,
      };
      set(nextState);
      if (saveAcc > 4) {
        saveAcc = 0;
        persist({ ...get() });
      }
    }
  },

  setTab: (tab) => set({ tab }),

  setRoute: (region, route) => {
    const caught = uniqueCaught(get().dex);
    const need = REGION_UNLOCK[region] ?? 0;
    if (caught < need) return;
    const def = ROUTES[region]?.[route];
    if (!def) return;
    const prestige = get().team.reduce((n, p) => n + p.prestige, 0);
    if (def.requiredPrestige != null && prestige < def.requiredPrestige) return;
    playerTimer = 0;
    enemyTimer = 0;
    const enemy = spawnEnemy(region, route);
    let dex = get().dex;
    let stats = get().stats;
    let log = get().log;
    if (enemy) {
      dex = markDex(dex, enemy.name, enemy.shiny ? 2 : 1);
      stats = enemy.shiny ? { ...stats, shinySeen: stats.shinySeen + 1 } : { ...stats, seen: stats.seen + 1 };
      log = pushLog(log, `Entered ${def.name}.`, "system");
    }
    set({ region, route, enemy, dex, stats, log, tab: "battle" });
    persist({ ...get(), region, route, enemy, dex, stats, log, tab: "battle" } as GameState);
  },

  setActive: (index) => {
    const team = get().team;
    if (!team[index] || team[index].hp <= 0) return;
    playerTimer = 0;
    set({ active: index });
  },

  setCatchMode: (catchMode) => set({ catchMode }),
  setBall: (selectedBall) => set({ selectedBall }),

  heal: () => {
    const s = get();
    if (Date.now() - s.lastHeal < HEAL_COOLDOWN_MS) return;
    const team = s.team.map((p) => ({ ...p, hp: combatStats(p).maxHp }));
    set({
      team,
      lastHeal: Date.now(),
      log: pushLog(s.log, "Your team was healed.", "system"),
    });
    persist({ ...get() });
  },

  evolve: (uid, to) => {
    const s = get();
    const apply = (list: OwnedPoke[]) =>
      list.map((p) => {
        if (p.uid !== uid) return p;
        const next = { ...p, name: to };
        next.hp = combatStats(next).maxHp;
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

  prestige: (uid) => {
    const s = get();
    const apply = (list: OwnedPoke[]) =>
      list.map((p) => {
        if (p.uid !== uid) return p;
        if (levelOf(p) < 100) return p;
        const spec = speciesByName(p.name);
        const next = {
          ...p,
          prestige: p.prestige + 1,
          exp: expAtLevel((spec?.growth ?? "Medium Fast") as "Medium Fast", 1),
        };
        next.hp = combatStats(next).maxHp;
        return next;
      });
    set({
      team: apply(s.team),
      storage: apply(s.storage),
      log: pushLog(s.log, "Prestiged! Stats boosted.", "level"),
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

  setAutoPrestige: (autoPrestige) => {
    set({ autoPrestige });
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
      localStorage.setItem(SAVE_KEY, JSON.stringify({ ...parsed, version: SAVE_VERSION }));
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

export function regionUnlocked(region: string, dex: Record<string, DexFlag>): boolean {
  return uniqueCaught(dex) >= (REGION_UNLOCK[region] ?? 0);
}

export { REGIONS, ROUTES, uniqueCaught };
