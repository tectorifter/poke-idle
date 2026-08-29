export type GrowthRate = "Slow" | "Medium Slow" | "Medium Fast" | "Fast";

export type Species = {
  id: number;
  name: string;
  types: string[];
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
  prestige: number;
  hp: number;
};

export type BallKind = "pokeball" | "greatball" | "ultraball";

export type CatchMode = "off" | "new" | "all";

export type TabId = "battle" | "map" | "team" | "dex" | "bag";

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

/** Persisted separately from SaveBlob's wild-encounter fields — merge in wherever you save. */
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
  balls: Record<BallKind, number>;
  selectedBall: BallKind;
  catchMode: CatchMode;
  region: string;
  route: string;
  dex: Record<string, DexFlag>;
  stats: Stats;
  lastHeal: number;
  autoPrestige: boolean;
  started: boolean;
};
