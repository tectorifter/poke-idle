export type GrowthRate = "Slow" | "Medium Slow" | "Medium Fast" | "Fast";

export type StatKey = "hp" | "atk" | "def" | "spa" | "spd" | "spe";
/** A value per battle stat (IVs, EVs, …). */
export type StatSpread = Record<StatKey, number>;

/** The 25 Pokémon natures (see natures.ts for what each raises / lowers). */
export type Nature =
  | "Hardy" | "Lonely" | "Adamant" | "Naughty" | "Brave"
  | "Bold" | "Docile" | "Impish" | "Lax" | "Relaxed"
  | "Modest" | "Mild" | "Bashful" | "Rash" | "Quiet"
  | "Calm" | "Gentle" | "Careful" | "Quirky" | "Sassy"
  | "Timid" | "Hasty" | "Jolly" | "Naive" | "Serious";

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
  /** Terastal type rolled once at creation from this mon's own types (single-typed
   *  mons get their sole type). Fixed for the mon's life; drives Tera activation. */
  teraType?: string;
  /** Individual Values (0–31 per stat) rolled once at creation. */
  ivs?: StatSpread;
  /** Effort Values (0–252 per stat, 510 total) trained by party mons on exp gain. */
  evs?: StatSpread;
  /** Nature rolled once at creation: +10% one stat, −10% another (5 are neutral). */
  nature?: Nature;
  /** Player-chosen move names (≤ 4). Unset ⇒ auto-picked from the learnable pool. */
  moves?: string[];
  /** Enemy only: Ground team-synergy bleed — loses 2% max HP on every attack it
   *  makes. Set for the duration of the fight; never persisted meaningfully. */
  bleed?: boolean;
  /** Enemy only: a major status condition inflicted by a party type-synergy. */
  status?: StatusCondition;
  /** Enemy only: Dark-synergy flinch — the mon loses its next turn. */
  flinch?: boolean;
};

/** A major status condition. `toxicN` is the Showdown "badly poisoned" counter
 *  (residual = n/16 max HP, climbing each turn). */
export type StatusCondition = {
  kind: "burn" | "poison" | "toxic" | "paralyze" | "freeze";
  toxicN?: number;
};

/** A live temporary anomaly activation on one wild-combat mon. `formName` is the
 *  Mega / Gigantamax species to render (null for plain Dynamax and for Tera). */
export type WildActivation = { uid: string; formName: string | null; defeatsLeft: number };
export type WildForms = { mega: WildActivation | null; dynamax: WildActivation | null; tera: WildActivation | null };
/** Wild defeats remaining until each anomaly type is available again (0 = ready). */
export type RechargeCounts = { mega: number; dynamax: number; tera: number };

/** Catch-power tiers. The upgrade track (catchTier + catchLevel) is permanent and
 *  drives auto-catch; each tier also gates buying that ball type's throw charges. */
export type CatchTier = "pokeball" | "greatball" | "ultraball" | "timerball";

/** Consumable manual-throw charges, one count per ball type. */
export type BallCharges = Record<CatchTier, number>;

/** Catch behaviour is always available; the store only toggles which filter is active. */
export type CatchMode = "new" | "all";

export type TabId = "battle" | "map" | "team" | "dex" | "store" | "league" | "settings";

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
  /** Total Pokédex entries owned (species caught) required to unlock this route.
   *  0 ⇒ no requirement. */
  dex?: number;
  requiredPrestige?: number;
  weights?: number[];
  subRoutes?: string[];
};

export type TrainerPokemon = {
  name: string;
  level: number;
  /** Optional fixed statline — defaults to 31 IVs / even EVs / neutral nature. */
  ivs?: StatSpread;
  evs?: StatSpread;
  nature?: Nature;
};

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
  /** Current wild-combat HP pool (not per-mon). */
  playerHp: number;
  playerExp: number;
  autoTapLevel: number; // 0–15
  catchTier: CatchTier;
  catchLevel: number; // 1–10 inside current tier
  /** Ball the manual-catch button throws AND the Store buys charges for. */
  selectedBall?: CatchTier;
  /** Manual-throw charges per ball type. */
  ballCharges?: BallCharges;
  catchMode: CatchMode;
  region: string;
  route: string;
  dex: Record<string, DexFlag>;
  stats: Stats;
  lastHeal: number;
  started: boolean;
  anomalyCleared: Record<string, boolean>;
  gmaxChanceMult: number;
  wildActivations?: WildForms;
  wildRecharge?: RechargeCounts;
  falseSwipe?: boolean;
  autoAdvanceRoute?: boolean;
};
