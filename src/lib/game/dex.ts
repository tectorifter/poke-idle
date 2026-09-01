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
  "Mr. Mime": "mrmime",
  "Mime Jr.": "mimejr",
  Farfetchd: "farfetchd",
  "Farfetch'd": "farfetchd",
  "Sirfetch'd": "sirfetchd",
  "Ho-Oh": "hooh",
  "Porygon-Z": "porygonz",
  "Type: Null": "typenull",
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
};

function showdownSlug(name: string): string {
  if (SHOWDOWN_SLUG_OVERRIDES[name]) return SHOWDOWN_SLUG_OVERRIDES[name];
  if (name.startsWith("Dynamax ")) return showdownSlug(name.slice(8));
  if (name.startsWith("Tera ")) return showdownSlug(name.slice(5));
  if (name.startsWith("Galarian ")) return `${name.slice(9).toLowerCase().replace(/[.'’]/g, "").replace(/\s+/g, "")}-galar`;
  if (name.startsWith("Paldean ")) return `${name.slice(8).toLowerCase().replace(/[.'’]/g, "").replace(/\s+/g, "-")}-paldea`;
  if (name.startsWith("M-")) {
    return name.slice(2).toLowerCase().replace(/\s+/g, "") + "-mega";
  }
  return name
    .toLowerCase()
    .replace(/[.'’:]/g, "")
    .replace(/\s+/g, "");
}

export function isTeraSpriteName(name: string): boolean {
  return name.startsWith("Tera ") && !name.startsWith("Terapagos");
}

export function spriteUrl(name: string, shiny = false, _animated = true, isBack = false): string {
  if (isTeraSpriteName(name)) return spriteUrl(name.slice(5), shiny, _animated, isBack);

  const folder = isBack
    ? shiny
      ? "ani-back-shiny"
      : "ani-back"
    : shiny
      ? "ani-shiny"
      : "ani";

  return `https://play.pokemonshowdown.com/sprites/${folder}/${showdownSlug(name)}.gif`;
}

export function artworkUrl(name: string): string {
  const spec = speciesByName(name);
  const id = spec?.id ?? 0;
  if (id >= 1 && id <= 802 && !/^(M-|A-|P-)/.test(name)) {
    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;
  }
  return spriteUrl(name, false, true, false);
}

export const STARTERS = ["Bulbasaur", "Charmander", "Squirtle"] as const;