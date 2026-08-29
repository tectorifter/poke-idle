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

// Showdown-style slugs for the Galar/Paldea/Anomalies additions. Not exhaustive/guaranteed —
// spot-check exotic forms (alt battle forms, masks) against play.pokemonshowdown.com/sprites/ani/.
const SHOWDOWN_SLUG_OVERRIDES: Record<string, string> = {
  "Galarian Farfetchd": "farfetchd-galar",
  "Galarian Mr. Mime": "mrmime-galar",
  "Darmanitan-Zen": "darmanitan-galar-zen",
  "Galarian Darmanitan": "darmanitan-galar",
  "Eiscue-Noice": "eiscue-noice",
  "Indeedee-F": "indeedee-f",
  "Urshifu-Rapid": "urshifu-rapid-strike",
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
};

function showdownSlug(name: string): string {
  if (SHOWDOWN_SLUG_OVERRIDES[name]) return SHOWDOWN_SLUG_OVERRIDES[name];
  if (name.startsWith("Dynamax ")) return showdownSlug(name.slice(8));
  if (name.startsWith("Tera ")) return showdownSlug(name.slice(5));
  if (name.startsWith("Galarian ")) return `${name.slice(9).toLowerCase().replace(/[.'’]/g, "").replace(/\s+/g, "")}-galar`;
  if (name.startsWith("Paldean ")) return `${name.slice(8).toLowerCase().replace(/[.'’]/g, "").replace(/\s+/g, "-")}-paldea`;
  return name
    .toLowerCase()
    .replace(/[.'’:]/g, "")
    .replace(/\s+/g, "-");
}

export function spriteUrl(name: string, shiny: boolean, animated = false): string {
  const spec = speciesByName(name);
  const id = spec?.id ?? 0;
  const isForm = /^(M-|A-|P-|B-|W-|H-|F-|Fan-)/.test(name) || name.includes("-");
  if (animated && id >= 1 && id <= 649 && !isForm) {
    const folder = shiny ? "shiny/" : "";
    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/${folder}${id}.gif`;
  }
  // Galar/Paldea/Anomalies (id > 895) and any regional/battle forms: Showdown's animated
  // frontal sprite set covers these; front-default only (no shiny variant requested).
  if (animated && (id > 895 || isForm)) {
    const folder = shiny ? "ani-shiny" : "ani";
    return `https://play.pokemonshowdown.com/sprites/${folder}/${showdownSlug(name)}.gif`;
  }
  if (id >= 1 && id <= 802 && !isForm) {
    const folder = shiny ? "shiny/" : "";
    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${folder}${id}.png`;
  }
  const slug = spriteSlug(name);
  return `https://img.pokemondb.net/sprites/home/${shiny ? "shiny" : "normal"}/${slug}.png`;
}

export function artworkUrl(name: string): string {
  const spec = speciesByName(name);
  const id = spec?.id ?? 0;
  if (id >= 1 && id <= 802 && !/^(M-|A-|P-)/.test(name)) {
    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;
  }
  return spriteUrl(name, false, false);
}

export const STARTERS = ["Bulbasaur", "Charmander", "Squirtle"] as const;
