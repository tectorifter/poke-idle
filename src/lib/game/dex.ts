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

const SLUG_OVERRIDES: Record<string, string> = {
  "Nidoran f": "nidoran-f",
  "Nidoran m": "nidoran-m",
  "Mr. Mime": "mr-mime",
  "Mime Jr.": "mime-jr",
  Farfetchd: "farfetchd",
  "Type: Null": "type-null",
  "M-Venusaur": "venusaur-mega",
  "M-Charizard X": "charizard-megax",
  "M-Charizard Y": "charizard-megay",
  "M-Blastoise": "blastoise-mega",
  "M-Alakazam": "alakazam-mega",
  "M-Gengar": "gengar-mega",
  "M-Kangaskhan": "kangaskhan-mega",
  "M-Pinsir": "pinsir-mega",
  "M-Gyarados": "gyarados-mega",
  "M-Aerodactyl": "aerodactyl-mega",
  "M-Mewtwo X": "mewtwo-megax",
  "M-Mewtwo Y": "mewtwo-megay",
  "Ash-Greninja": "greninja-ash",
  "Wishiwashi-S": "wishiwashi-school",
  "A-Rattata": "rattata-alolan",
  "A-Raticate": "raticate-alolan",
  "A-Sandshrew": "sandshrew-alolan",
  "A-Sandslash": "sandslash-alolan",
  "A-Vulpix": "vulpix-alolan",
  "A-Ninetales": "ninetales-alolan",
  "A-Diglett": "diglett-alolan",
  "A-Dugtrio": "dugtrio-alolan",
  "A-Meowth": "meowth-alolan",
  "A-Persian": "persian-alolan",
  "A-Geodude": "geodude-alolan",
  "A-Graveler": "graveler-alolan",
  "A-Golem": "golem-alolan",
  "A-Grimer": "grimer-alolan",
  "A-Muk": "muk-alolan",
  "P-Kyogre": "kyogre-primal",
  "P-Groudon": "groudon-primal",
};

export function spriteSlug(name: string): string {
  if (SLUG_OVERRIDES[name]) return SLUG_OVERRIDES[name];
  if (name.startsWith("M-")) {
    return name.slice(2).toLowerCase().replace(/\s+/g, "") + "-mega";
  }
  return name
    .toLowerCase()
    .replace(/[.'’:]/g, "")
    .replace(/\s+/g, "-");
}

const SHOWDOWN_SLUG_OVERRIDES: Record<string, string> = {
  "Galarian Farfetchd": "farfetchdgalar",
  "Galarian Mr. Mime": "mrmimegalar",
  "Darmanitan-Zen": "darmanitangalarzen",
  "Galarian Darmanitan": "darmanitangalar",
  "Eiscue-Noice": "escuenoice",
  "Indeedee-F": "indeedeef",
  "Urshifu-Rapid": "urshifurapidstrike",
  "Zacian-Crowned": "zaciancrowned",
  "Zamazenta-Crowned": "zamazentacrowned",
  "Eternatus-Eternamax": "eternatuseternamax",
  "Calyrex-Ice": "calyrexice",
  "Calyrex-Shadow": "calyrexshadow",
  "Oinkologne-F": "oinkolognef",
  "Gimmighoul-Roaming": "gimmighoulroaming",
  "Palafin-Hero": "palafinhero",
  "Ogerpon-Wellspring": "ogerponwellspring",
  "Ogerpon-Hearthflame": "ogerponhearthflame",
  "Ogerpon-Cornerstone": "ogerponcornerstone",
  "Terapagos-Terastal": "terapagos-terastal",
  "Terapagos-Stellar": "terapagos-stellar",
};

/**
 * Converts species and form names into canonical Showdown ID slugs.
 */
function showdownSlug(name: string): string {
  if (SHOWDOWN_SLUG_OVERRIDES[name]) return SHOWDOWN_SLUG_OVERRIDES[name];

  let cleaned = name.trim();
  if (cleaned.startsWith("Dynamax ")) cleaned = cleaned.slice(8);
  if (cleaned.startsWith("Tera ")) cleaned = cleaned.slice(5);

  const toCleanId = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, "");

  if (cleaned.startsWith("Galarian ")) return `${toCleanId(cleaned.slice(9))}galar`;
  if (cleaned.startsWith("Paldean ")) return `${toCleanId(cleaned.slice(8))}paldea`;
  if (cleaned.startsWith("Hisuian ")) return `${toCleanId(cleaned.slice(8))}hisui`;
  if (cleaned.startsWith("Alolan ")) return `${toCleanId(cleaned.slice(7))}alola`;

  if (cleaned.startsWith("M-")) {
    const rest = cleaned.slice(2);
    if (rest.endsWith(" X") || rest.endsWith(" Y")) {
      const char = rest.slice(-1).toLowerCase();
      const base = toCleanId(rest.slice(0, -2));
      return `${base}mega${char}`;
    }
    return `${toCleanId(rest)}mega`;
  }
  if (cleaned.startsWith("A-")) return `${toCleanId(cleaned.slice(2))}alola`;
  if (cleaned.startsWith("P-")) return `${toCleanId(cleaned.slice(2))}primal`;
  if (cleaned.startsWith("H-")) return `${toCleanId(cleaned.slice(2))}hisui`;
  if (cleaned.startsWith("G-")) return `${toCleanId(cleaned.slice(2))}galar`;

  return toCleanId(cleaned);
}

/** Returns true for any "Tera Foo" named Pokémon (but NOT Terapagos). */
export function isTeraSpriteName(name: string): boolean {
  return name.startsWith("Tera ") && !name.startsWith("Terapagos");
}

/**
 * Returns Showdown 3D Animated models (.gif) or Showdown Static Sprites (.png)
 * entirely hosted on play.pokemonshowdown.com
 */
export function spriteUrl(name: string, shiny: boolean, animated = false): string {
  // Tera forms use the base Pokémon sprite — overlay handled in <Sprite>
  if (isTeraSpriteName(name)) return spriteUrl(name.slice(5), shiny, animated);

  const id = showdownSlug(name);

  // Animated 3D Models (.gif) from Showdown CDN
  if (animated) {
    const folder = shiny ? "ani-shiny" : "ani";
    return `https://play.pokemonshowdown.com/sprites/${folder}/${id}.gif`;
  }

  // Static 2D Sprites (.png) from Showdown CDN
  const folder = shiny ? "gen5-shiny" : "gen5";
  return `https://play.pokemonshowdown.com/sprites/${folder}/${id}.png`;
}

/**
 * Returns Showdown official dex artwork or falls back to Showdown static models
 */
export function artworkUrl(name: string): string {
  const id = showdownSlug(name);
  return `https://play.pokemonshowdown.com/sprites/dex/${id}.png`;
}

export const STARTERS = ["Bulbasaur", "Charmander", "Squirtle"] as const;