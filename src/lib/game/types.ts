export type GrowthRate = "Slow" | "Medium Slow" | "Medium Fast" | "Fast";

export type Species = {
  id: number;
  name: string;
  types: string[];
  /** Set only on tera-flagged species — always one of `types`. Used for offense
   *  only; defense always uses the full `types` array regardless. */
  teraType?: string;
  catch: number;
  growth: GrowthRate;
  hp: number;
  atk: number;
  def: number;
  spa: number;
  spd: number;
  spe: number;
  exp: number;
};

export type OwnedPoke = {
  uid: string;
  name: string;
  exp: number;
  shiny: boolean;
  /** Kept for anomaly identification / display; no longer used for per-mon prestige. */
  prestige: number;
  hp: number;
};

/** Permanent catch-power tiers (no consumable balls). */
export type CatchTier = "pokeball" | "greatball" | "ultraball" | "masterball";

/** Catch behaviour is always available; the store only toggles which filter is active. */
export type CatchMode = "new" | "all";

export type TabId = "battle" | "map" | "team" | "dex" | "store" | "league";

export type LogLine = {
  id: number;
  text: string;
  tone: "neutral" | "hit" | "catch" | "escape" | "shiny" | "level" | "system";
};

export type DexFlag = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
/* 0 unseen, 1 seen, 2 shiny seen, 6 owned, 8 shiny owned */

export type Stats = {
  seen: number;
  beaten: number;
  caught: number;
  shinySeen: number;
  shinyCaught: number;
  damage: number;
};

export type RouteDef = {
  name: string;
  pokes: string[];
  minLevel: number;
  maxLevel: number;
  unlocked: boolean;
  requiredPrestige?: number;
  weights?: number[];
  subRoutes?: string[];
};

export type TrainerPokemon = { name: string; level: number };

export type TrainerDef = {
  id: string;
  name: string;
  title?: string;
  team: TrainerPokemon[];
};

export type GymDef = {
  id: string;
  number: number;
  name: string;
  type: string;
  minLevel: number;
  maxLevel: number;
  leader: TrainerDef;
  badge: string;
};

export type EliteFourDef = {
  id: string;
  members: TrainerDef[];
};

export type LeagueProgress = {
  stageIndex: number;
  runsCompleted: number;
};

export type LeagueDef = {
  minLevel: number;
  maxLevel: number;
  ballBonusPercent: number;
  gyms: GymDef[];
  eliteFours: EliteFourDef[];
  champions: TrainerDef[];
};

export type SaveBlob = {
  version: number;
  team: OwnedPoke[];
  storage: OwnedPoke[];
  active: number;
  pokeyen: number;
  /** Global player prestige (only the player prestiged now). */
  playerPrestige: number;
  autoTapLevel: number; // 0–25
  catchTier: CatchTier;
  catchLevel: number; // 1–10 inside current tier
  catchMode: CatchMode;
  region: string;
  route: string;
  dex: Record<string, DexFlag>;
  stats: Stats;
  lastHeal: number;
  started: boolean;
  anomalyCleared: Record<string, boolean>;
};
