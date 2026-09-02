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
  Anomalies: 620,
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
]);

export function showdownSlug(name: string): string {
  if (SHOWDOWN_SLUG_OVERRIDES[name]) return SHOWDOWN_SLUG_OVERRIDES[name];
  if (name.startsWith("Dynamax ")) return showdownSlug(name.slice(8));
  if (name.startsWith("Gigantamax ")) return showdownSlug(name.slice(11));
  if (name.startsWith("G-Max ")) return showdownSlug(name.slice(6));
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

export const STARTERS = ["Bulbasaur", "Charmander", "Squirtle"] as const;