import pokedex from "@/data/pokedex.json";
import evolutions from "@/data/evolutions.json";
import routes from "@/data/routes.json";
import expTable from "@/data/exp-table.json";
import league from "@/data/league.json";
import type { GrowthRate, LeagueDef, RouteDef, Species } from "./types";

export const POKEDEX = pokedex as Species[];
export const EVOLUTIONS = evolutions as Record<string, { level: number; to: string }[]>;
export const ROUTES = routes as Record<string, Record<string, RouteDef>>;
export const EXP_TABLE = expTable as Record<GrowthRate, number[]>;
export const LEAGUE = league as LeagueDef;

export const REGIONS = Object.keys(ROUTES);
export const REGION_UNLOCK: Record<string, number> = {
  Kanto: 0,
  Johto: 40,
  Hoenn: 90,
  Sinnoh: 150,
  Unova: 220,
  Kalos: 300,
  Alolan: 380,
  Galar: 460,
  Paldea: 540,
  "Kalos Anomaly": 620,
  "Alola Anomaly": 620,
  "Galar Anomaly": 620,
  "Paldea Anomaly": 620,
};

const byName = new Map<string, Species>();
for (const s of POKEDEX) byName.set(s.name, s);

export function speciesByName(name: string): Species | undefined {
  return byName.get(name);
}

export function speciesById(id: number): Species | undefined {
  return POKEDEX[id - 1];
}

const SHOWDOWN_SLUG_OVERRIDES: Record<string, string> = {
  "Nidoran f": "nidoranf",
  "Nidoran m": "nidoranm",
  "Nidoran♀": "nidoranf",
  "Nidoran♂": "nidoranm",
  "Mr. Mime": "mrmime",
  "Mime Jr.": "mimejr",
  "Mr. Rime": "mrrime",
  Farfetchd: "farfetchd",
  "Farfetch'd": "farfetchd",
  "Sirfetch'd": "sirfetchd",
  Sirfetchd: "sirfetchd",
  "Ho-Oh": "hooh",
  "Porygon-Z": "porygonz",
  "Type: Null": "typenull",
  "Galarian Farfetchd": "farfetchd-galar",
  "Galarian Farfetch'd": "farfetchd-galar",
  "Galarian Mr. Mime": "mrmime-galar",
  "Galarian Mr. Rime": "mrrime",
  "Darmanitan-Zen": "darmanitan-zen",
  "Galarian Darmanitan": "darmanitan-galar",
  "Galarian Darmanitan Zen": "darmanitan-galarzen",
  // Hyphenated variant actually used in pokedex/routes data. Without this the
  // "Galarian " prefix strips to "Darmanitan-Zen" -> "darmanitan-zen" -> a
  // "-galar" suffix is appended, yielding "darmanitan-zen-galar" which 404s on
  // Showdown (both ani/ and home/). The real slug is "darmanitan-galarzen".
  "Galarian Darmanitan-Zen": "darmanitan-galarzen",
  "Eiscue-Noice": "eiscue-noice",
  "Indeedee-F": "indeedee-f",
  "Urshifu-Rapid": "urshifu-rapidstrike",
  "Urshifu-Rapid-Strike": "urshifu-rapidstrike",
  "Zacian-Crowned": "zacian-crowned",
  "Zamazenta-Crowned": "zamazenta-crowned",
  "Eternatus-Eternamax": "eternatus-eternamax",
  "Calyrex-Ice": "calyrex-ice",
  "Calyrex-Shadow": "calyrex-shadow",
  "Oinkologne-F": "oinkologne-f",
  "Gimmighoul-Roaming": "gimmighoul-roaming",
  "Palafin-Hero": "palafin-hero",
  "Ogerpon-Wellspring": "ogerpon-wellspring",
  "Ogerpon-Hearthflame": "ogerpon-hearthflame",
  "Ogerpon-Cornerstone": "ogerpon-cornerstone",
  "Terapagos-Terastal": "terapagos-terastal",
  "Terapagos-Stellar": "terapagos-stellar",
  "Necrozma-Dusk-Mane": "necrozma-duskmane",
  "Necrozma-Dawn-Wings": "necrozma-dawnwings",
  "Necrozma-Ultra": "necrozma-ultra",
  "A-Rattata": "rattata-alola",
  "A-Raticate": "raticate-alola",
  "A-Sandshrew": "sandshrew-alola",
  "A-Sandslash": "sandslash-alola",
  "A-Vulpix": "vulpix-alola",
  "A-Ninetales": "ninetales-alola",
  "A-Diglett": "diglett-alola",
  "A-Dugtrio": "dugtrio-alola",
  "A-Meowth": "meowth-alola",
  "A-Persian": "persian-alola",
  "A-Geodude": "geodude-alola",
  "A-Graveler": "graveler-alola",
  "A-Golem": "golem-alola",
  "A-Grimer": "grimer-alola",
  "A-Muk": "muk-alola",
  "A-Exeggutor": "exeggutor-alola",
  "A-Marowak": "marowak-alola",
  "A-Raichu": "raichu-alola",
  "Ting-Lu": "tinglu",
  "Chien-Pao": "chienpao",
  "Wo-Chien": "wochien",
  "Chi-Yu": "chiyu",
  "Great Tusk": "greattusk",
  "Scream Tail": "screamtail",
  "Brute Bonnet": "brutebonnet",
  "Flutter Mane": "fluttermane",
  "Slither Wing": "slitherwing",
  "Sandy Shocks": "sandyshocks",
  "Iron Treads": "irontreads",
  "Iron Bundle": "ironbundle",
  "Iron Hands": "ironhands",
  "Iron Jugulis": "ironjugulis",
  "Iron Moth": "ironmoth",
  "Iron Thorns": "ironthorns",
  "Roaring Moon": "roaringmoon",
  "Iron Valiant": "ironvaliant",
  "Walking Wake": "walkingwake",
  "Iron Leaves": "ironleaves",
  "Gouging Fire": "gougingfire",
  "Raging Bolt": "ragingbolt",
  "Iron Boulder": "ironboulder",
  "Iron Crown": "ironcrown",

  // Alternate-forme names that collide with reserved prefixes (M-/H-/A-/G-/P-)
  // or whose Showdown slug doesn't match a plain lowercase strip of the name.
  "B-Kyurem": "kyurem-black",
  "W-Kyurem": "kyurem-white",
  "Giratina-O": "giratina-origin",
  "Shaymin-S": "shaymin-sky",
  "Deoxys-A": "deoxys-attack",
  "Deoxys-D": "deoxys-defense",
  "Deoxys-S": "deoxys-speed",
  "Tornadus-T": "tornadus-therian",
  "Thundurus-T": "thundurus-therian",
  "Landorus-T": "landorus-therian",
  "Keldeo-R": "keldeo-resolute",
  "Meloetta-P": "meloetta-pirouette",
  "Darmanitan-Z": "darmanitan-zen",
  "Aegislash-B": "aegislash-blade",
  "Zygarde-10": "zygarde-10",
  "Zygarde-C": "zygarde-complete",
  "Hoopa-U": "hoopa-unbound",
  "Lycanroc-M": "lycanroc-midnight",
  "Lycanroc-Dusk": "lycanroc-dusk",
  "Wishiwashi-S": "wishiwashi-school",
  "Ash-Greninja": "greninja-ash",
  // Rotom's 5 appliance formes predate the M-/H- prefix conventions used
  // elsewhere and collide with them (Mega, Hisuian) — explicit overrides needed.
  "H-Rotom": "rotom-heat",
  "W-Rotom": "rotom-wash",
  "F-Rotom": "rotom-frost",
  "Fan-Rotom": "rotom-fan",
  "M-Rotom": "rotom-mow",
  "Paldean Tauros-Combat": "tauros-paldeacombat",
  "Paldean Tauros-Blaze": "tauros-paldeablaze",
  "Paldean Tauros-Aqua": "tauros-paldeaaqua",

  // Hisuian additions -- same hyphen-preserved pattern as the other compound names above.
  "Basculin-White-Striped": "basculin-whitestriped",
  "Enamorus-Therian": "enamorus-therian",
  "Ursaluna-Bloodmoon": "ursaluna-bloodmoon",
  "Basculegion-F": "basculegion-f",

  // Let's Go partner forms.
  "Partner Pikachu": "pikachu-starter",
  "Partner Eevee": "eevee-starter",
};

const KNOWN_MISSING_GIFS = new Set<string>([
  // Confirmed absent from /sprites/ani/ on Showdown as of this check -- only
  // static 'home' renders exist for these. Add more here if the same turns up
  // for other species; this is a manually-verified list, not a guess.
  "Ogerpon",
  "Ogerpon-Wellspring",
  "Ogerpon-Hearthflame",
  "Ogerpon-Cornerstone",
  "Terapagos",
  "Terapagos-Terastal",
  "Terapagos-Stellar",

  // Gen 9 paradox mons + Pecharunt: Showdown never produced BW-style animated
  // sprites for these, only static 'home' renders. Listed here so we skip the
  // guaranteed-404 ani/ GIF request (and the broken-image flash before onError
  // swaps in the static PNG). Verified absent from /sprites/ani/ on Showdown.
  "Iron Treads",
  "Iron Bundle",
  "Iron Hands",
  "Iron Jugulis",
  "Iron Moth",
  "Iron Thorns",
  "Iron Valiant",
  "Iron Leaves",
  "Iron Boulder",
  "Iron Crown",
  "Miraidon",
  "Dynamax Miraidon",
  "Pecharunt",

  // Gigantamax forms whose *-gmax slug has only a static 'home' render on
  // Showdown (no ani/ GIF). Verified 2026 — the rest of the G-Max roster has GIFs.
  "Gigantamax Venusaur",
  "Gigantamax Blastoise",
  "Gigantamax Rillaboom",
  "Gigantamax Cinderace",
  "Gigantamax Urshifu",
  "Gigantamax Urshifu-Rapid",
]);

export function showdownSlug(name: string): string {
  if (SHOWDOWN_SLUG_OVERRIDES[name]) return SHOWDOWN_SLUG_OVERRIDES[name];
  if (name.startsWith("Dynamax ")) return showdownSlug(name.slice(8));
  if (name.startsWith("Gigantamax ")) return `${showdownSlug(name.slice(11))}-gmax`;
  if (name.startsWith("G-Max ")) return `${showdownSlug(name.slice(6))}-gmax`;
  if (name.startsWith("Tera ")) return showdownSlug(name.slice(5));

  if (name.startsWith("Alolan ")) return `${showdownSlug(name.slice(7))}-alola`;
  if (name.startsWith("A-")) return `${showdownSlug(name.slice(2))}-alola`;
  if (name.startsWith("Galarian ")) return `${showdownSlug(name.slice(9))}-galar`;
  if (name.startsWith("G-")) return `${showdownSlug(name.slice(2))}-galar`;
  if (name.startsWith("Hisuian ")) return `${showdownSlug(name.slice(8))}-hisui`;
  if (name.startsWith("H-")) return `${showdownSlug(name.slice(2))}-hisui`;
  if (name.startsWith("Paldean ")) return `${showdownSlug(name.slice(8))}-paldea`;

  if (name.startsWith("M-") || name.startsWith("Mega ")) {
    const raw = name.startsWith("M-") ? name.slice(2) : name.slice(5);
    if (raw.endsWith(" X") || raw.endsWith(" x")) {
      return `${showdownSlug(raw.slice(0, -2))}-megax`;
    }
    if (raw.endsWith(" Y") || raw.endsWith(" y")) {
      return `${showdownSlug(raw.slice(0, -2))}-megay`;
    }
    return `${showdownSlug(raw)}-mega`;
  }

  if (name.startsWith("P-") || name.startsWith("Primal ")) {
    const raw = name.startsWith("P-") ? name.slice(2) : name.slice(7);
    return `${showdownSlug(raw)}-primal`;
  }

  return name
    .toLowerCase()
    .replace(/[.'’:]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

export function isTeraSpriteName(name: string): boolean {
  return name.startsWith("Tera ") && !name.startsWith("Terapagos");
}

export function staticSpriteUrl(name: string, shiny = false, _isBack = false): string {
  if (isTeraSpriteName(name)) return staticSpriteUrl(name.slice(5), shiny, _isBack);

  // 'home' is Showdown's actively-maintained modern static render set (covers
  // through current gen, including Ogerpon/Terapagos); the older 'gen5' BW-style
  // icon set predates most post-Gen5 content and was missing recent additions.
  const folder = shiny ? "home-shiny" : "home";
  return `https://play.pokemonshowdown.com/sprites/${folder}/${showdownSlug(name)}.png`;
}

export function spriteUrl(name: string, shiny = false, animated = true, _isBack = false): string {
  if (isTeraSpriteName(name)) return spriteUrl(name.slice(5), shiny, animated, _isBack);

  if (!animated || KNOWN_MISSING_GIFS.has(name)) {
    return staticSpriteUrl(name, shiny, _isBack);
  }

  const folder = shiny ? "ani-shiny" : "ani";
  return `https://play.pokemonshowdown.com/sprites/${folder}/${showdownSlug(name)}.gif`;
}

export function artworkUrl(name: string): string {
  const spec = speciesByName(name);
  const id = spec?.id ?? 0;
  if (id >= 1 && id <= 1025 && !/^(M-|A-|P-|G-|H-|Mega|Primal|Alolan|Galarian|Hisuian|Paldean)/.test(name)) {
    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;
  }
  return staticSpriteUrl(name, false, false);
}

// Real National Dex number for species whose internal `id` (in pokedex.json)
// was appended sequentially far past 1025 when this dex grew, so it no longer
// matches PokeAPI's numbering. Needed to build a correct third-tier fallback.
const NATIONAL_DEX_ID: Record<string, number> = {
  Ogerpon: 1017,
  "Ogerpon-Wellspring": 1017,
  "Ogerpon-Hearthflame": 1017,
  "Ogerpon-Cornerstone": 1017,
  Terapagos: 1024,
  "Terapagos-Terastal": 1024,
  "Terapagos-Stellar": 1024,
  "Partner Pikachu": 25,
  "Partner Eevee": 133,
};

/** Third-tier fallback, independently verified against a different host
 *  (raw.githubusercontent.com, no hotlink restriction) in case Showdown's own
 *  static folder fails to load for some environment-specific reason. Shows the
 *  base form's artwork when the exact alternate form isn't separately modeled
 *  there -- not pixel-perfect, but never a fully broken image. */
export function ultimateFallbackUrl(name: string): string | null {
  const nationalId = NATIONAL_DEX_ID[name];
  if (!nationalId) return null;
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${nationalId}.png`;
}

// ─── Starter selection: first-stage, non-legendary/mythical pool ────────────

/** Never offered as a random starter: legendaries, mythicals, Ultra Beasts,
 *  paradox mons, plus a handful of item/trade/regional evolutions that the
 *  evolution data doesn't record as evolution targets. */
const NON_STARTER = new Set<string>([
  "Articuno", "Zapdos", "Moltres", "Mewtwo", "Mew",
  "Raikou", "Entei", "Suicune", "Lugia", "Ho-Oh", "Celebi",
  "Regirock", "Regice", "Registeel", "Latias", "Latios", "Kyogre", "Groudon", "Rayquaza", "Jirachi", "Deoxys",
  "Uxie", "Mesprit", "Azelf", "Dialga", "Palkia", "Heatran", "Regigigas", "Giratina", "Cresselia",
  "Phione", "Manaphy", "Darkrai", "Shaymin", "Arceus",
  "Victini", "Cobalion", "Terrakion", "Virizion", "Tornadus", "Thundurus", "Reshiram", "Zekrom",
  "Landorus", "Kyurem", "Keldeo", "Meloetta", "Genesect",
  "Xerneas", "Yveltal", "Zygarde", "Diancie", "Hoopa", "Volcanion",
  "Type: Null", "Silvally", "Tapu Koko", "Tapu Lele", "Tapu Bulu", "Tapu Fini",
  "Cosmog", "Cosmoem", "Solgaleo", "Lunala", "Necrozma", "Magearna", "Marshadow", "Zeraora", "Meltan", "Melmetal",
  "Nihilego", "Buzzwole", "Pheromosa", "Xurkitree", "Celesteela", "Kartana", "Guzzlord",
  "Poipole", "Naganadel", "Stakataka", "Blacephalon",
  "Zacian", "Zamazenta", "Eternatus", "Kubfu", "Urshifu", "Regieleki", "Regidrago",
  "Glastrier", "Spectrier", "Calyrex", "Enamorus",
  "Wo-Chien", "Chien-Pao", "Ting-Lu", "Chi-Yu", "Koraidon", "Miraidon",
  "Walking Wake", "Iron Leaves", "Gouging Fire", "Raging Bolt", "Iron Boulder", "Iron Crown",
  "Ogerpon", "Terapagos", "Pecharunt",
  "Great Tusk", "Scream Tail", "Brute Bonnet", "Flutter Mane", "Slither Wing", "Sandy Shocks",
  "Iron Treads", "Iron Bundle", "Iron Hands", "Iron Jugulis", "Iron Moth", "Iron Thorns",
  "Roaring Moon", "Iron Valiant",
  "Slowking", "Gallade", "Froslass", "Polteageist", "Sirfetchd", "Mr. Rime", "Runerigus",
  "Perrserker", "Cursola", "Obstagoon",
]);

const STARTER_FORM_RE =
  /^(M-|A-|G-|H-|P-|B-|W-|F-|Fan-|Mega |Primal |Alolan |Galarian |Hisuian |Paldean |Dynamax |Gigantamax |Tera |G-Max |Ash-)/;

const EVO_TARGETS = new Set<string>();
for (const arr of Object.values(EVOLUTIONS)) for (const e of arr) EVO_TARGETS.add(e.to);

/** First-stage, non-legendary/mythical species pickable as a starter, plus the
 *  two Let's Go partner forms. */
export const STARTER_POOL: string[] = [
  ...POKEDEX.filter(
    (s) =>
      s.id >= 1 &&
      s.id <= 1025 &&
      !STARTER_FORM_RE.test(s.name) &&
      !(s.name.includes("-") && s.name !== "Jangmo-o") &&
      !EVO_TARGETS.has(s.name) &&
      !NON_STARTER.has(s.name),
  ).map((s) => s.name),
  "Partner Pikachu",
  "Partner Eevee",
];

/** `count` distinct random starter options. */
export function rollStarters(count = 6): string[] {
  const pool = [...STARTER_POOL];
  const out: string[] = [];
  for (let i = 0; i < count && pool.length; i++) {
    out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  }
  return out;
}

/** Legacy fixed trio — kept for any callers that still reference it. */
export const STARTERS = ["Bulbasaur", "Charmander", "Squirtle"] as const;

// ─── Anomaly system: base⇄form maps, catch rules, progression gates ──────────

/** Strip an anomaly prefix/suffix down to the base species the form belongs to.
 *  Ultra-Space mons and the Ogerpon / Terapagos forms have no base — they are
 *  caught as themselves (see `isPermanentAnomalyCatch`) — and pass through. */
export function baseSpeciesOf(name: string): string {
  if (name.startsWith("Gigantamax ")) return name.slice(11);
  if (name.startsWith("Dynamax ")) return name.slice(8);
  if (name.startsWith("Tera ")) return name.slice(5);
  if (name.startsWith("M-")) {
    const raw = name.slice(2);
    return raw.endsWith(" X") || raw.endsWith(" Y") ? raw.slice(0, -2) : raw;
  }
  if (name.startsWith("P-")) return name.slice(2);
  return name;
}

function formsByPrefix(prefix: string): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const s of POKEDEX) {
    if (!s.name.startsWith(prefix)) continue;
    const base = baseSpeciesOf(s.name);
    (map[base] ??= []).push(s.name);
  }
  return map;
}

/** base species name → its Mega form species (X and Y both listed where they exist). */
export const MEGA_FORMS = formsByPrefix("M-");
/** base species name → its `Dynamax <base>` species (legendaries only). */
export const DYNAMAX_FORMS = formsByPrefix("Dynamax ");
/** base species name → its `Gigantamax <base>` species. */
export const GMAX_FORMS = formsByPrefix("Gigantamax ");

const ULTRA_SPACE = new Set([
  "Nihilego", "Buzzwole", "Pheromosa", "Xurkitree", "Celesteela", "Kartana", "Guzzlord",
  "Poipole", "Naganadel", "Stakataka", "Blacephalon",
  "Necrozma", "Necrozma-Dusk-Mane", "Necrozma-Dawn-Wings", "Necrozma-Ultra",
]);

/** Anomaly-region species that are caught *as themselves*. Every other anomaly
 *  species records its Dex flag on catch (that flag is the activation unlock)
 *  but the mon added to the party is its base form. */
export function isPermanentAnomalyCatch(name: string): boolean {
  return ULTRA_SPACE.has(name) || name.startsWith("Ogerpon") || name.startsWith("Terapagos");
}

/** A temporary-activation form (Mega / Primal / Tera / Dynamax / Gigantamax) that
 *  must never be a mon's permanent name — it should always revert to its base. */
export function isAnomalyFormName(name: string): boolean {
  return !isPermanentAnomalyCatch(name) && baseSpeciesOf(name) !== name;
}

// --- progression gates ------------------------------------------------------
type Dex = Record<string, number>;
const dexHas = (d: Dex, n: string) => (d[n] ?? 0) >= 5;
const dexHasAll = (d: Dex, ns: string[]) => ns.every((n) => dexHas(d, n));

const namesWithPrefix = (p: string) => POKEDEX.filter((s) => s.name.startsWith(p)).map((s) => s.name);
const MEGA_GATE = namesWithPrefix("M-").filter((n) => n !== "M-Rayquaza");
const DYNAMAX_GATE = namesWithPrefix("Dynamax ").filter((n) => n !== "Dynamax Eternatus");
const TERA_GATE = namesWithPrefix("Tera ");
const OGERPON_ALL = ["Ogerpon", "Ogerpon-Wellspring", "Ogerpon-Hearthflame", "Ogerpon-Cornerstone"];

/** Per-species spawn gate: a name here only appears as a wild encounter once its
 *  predicate holds (checked in `store.spawnEnemy` against the live Dex). */
export const SPECIES_UNLOCK: Record<string, (dex: Dex) => boolean> = {
  "M-Rayquaza": (d) => dexHas(d, "P-Groudon") && dexHas(d, "P-Kyogre"),
  "Eternatus-Eternamax": (d) => dexHas(d, "Eternatus") && dexHasAll(d, DYNAMAX_GATE),
  Necrozma: (d) => dexHas(d, "Solgaleo") && dexHas(d, "Lunala"),
  "Necrozma-Dusk-Mane": (d) => dexHas(d, "Necrozma"),
  "Necrozma-Dawn-Wings": (d) => dexHas(d, "Necrozma"),
  "Necrozma-Ultra": (d) => dexHasAll(d, ["Necrozma", "Necrozma-Dusk-Mane", "Necrozma-Dawn-Wings"]),
  Ogerpon: (d) => dexHasAll(d, TERA_GATE),
  "Ogerpon-Wellspring": (d) => dexHasAll(d, TERA_GATE),
  "Ogerpon-Hearthflame": (d) => dexHasAll(d, TERA_GATE),
  "Ogerpon-Cornerstone": (d) => dexHasAll(d, TERA_GATE),
  Terapagos: (d) => dexHasAll(d, OGERPON_ALL),
  "Terapagos-Terastal": (d) => dexHas(d, "Terapagos"),
  "Terapagos-Stellar": (d) => dexHas(d, "Terapagos"),
};

/** Whole-route gate keyed `"<Region>/<routeId>"`. */
export const ROUTE_UNLOCK: Record<string, (dex: Dex) => boolean> = {
  "Kalos Anomaly/primal": (d) => dexHasAll(d, MEGA_GATE),
};

export function isRouteUnlocked(
  region: string,
  routeId: string,
  dex: Dex,
  playerPrestige: number,
): boolean {
  const def = ROUTES[region]?.[routeId];
  if (!def) return false;
  if (def.requiredPrestige != null && playerPrestige < def.requiredPrestige) return false;
  const pred = ROUTE_UNLOCK[`${region}/${routeId}`];
  return pred ? pred(dex) : true;
}

/** Short human label for what a locked route still needs (Map view). */
export function routeRequirementLabel(region: string, routeId: string): string | null {
  if (`${region}/${routeId}` === "Kalos Anomaly/primal") return "Catch every Mega Evolution";
  const def = ROUTES[region]?.[routeId];
  if (def?.requiredPrestige != null) return `Prestige ${def.requiredPrestige}`;
  return null;
}

/** The three player-facing activation buttons. */
export type AnomalyKind = "mega" | "dynamax" | "tera";

/** Owned Mega form species for a mon's base species (X and Y both if caught).
 *  Empty ⇒ Mega activation unavailable for this mon. */
export function megaFormsFor(dex: Dex, monName: string): string[] {
  const base = baseSpeciesOf(monName);
  return (MEGA_FORMS[base] ?? []).filter((n) => dexHas(dex, n));
}

/** True once the player has caught any Mega form at all (⇒ show the Mega button). */
export function anyMegaOwned(dex: Dex): boolean {
  return namesWithPrefix("M-").some((n) => dexHas(dex, n));
}

/** The caught G-Max species for a mon's base, else null (⇒ plain Dynamax). */
export function gmaxFormFor(dex: Dex, monName: string): string | null {
  const base = baseSpeciesOf(monName);
  const form = (GMAX_FORMS[base] ?? [])[0];
  return form && dexHas(dex, form) ? form : null;
}

/** Dynamax / Gigantamax activation unlocks once the Eternamax anomaly is beaten. */
export function dynamaxUnlocked(anomalyCleared: Record<string, boolean>): boolean {
  return !!anomalyCleared["galar-eternamax"];
}

/** Party-wide Terastallization unlocks on catching Stellar Terapagos. */
export function teraUnlocked(dex: Dex): boolean {
  return dexHas(dex, "Terapagos-Stellar");
}