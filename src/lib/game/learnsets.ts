import learnsetsData from "@/data/learnsets.json";
import { baseSpeciesOf, speciesByName } from "./dex";
import { MOVES, MOVE_BY_ID, moveId, fallbackTypeMove } from "./moves";
import type { MoveData } from "./moves";
import { defenseMultiplier } from "./type-chart";
import type { OwnedPoke } from "./types";

/** Per-species learnset (from Pokémon Showdown, merged up the pre-evolution
 *  chain). `level` is [moveId, minLevel] sorted by level; the rest are id lists. */
type RawLearnset = {
  level: [string, number][];
  machine: string[];
  egg: string[];
  tutor: string[];
};

const LEARNSETS = learnsetsData as unknown as Record<string, RawLearnset>;

export function rawLearnset(name: string): RawLearnset | undefined {
  return LEARNSETS[name] ?? LEARNSETS[baseSpeciesOf(name)];
}

const _learnCache = new Map<string, MoveData[]>();

/** Every move a mon can currently use. Below Lv.100: only level-up moves it is
 *  high enough level for. At Lv.100: also its TM (machine), egg and tutor moves. */
export function learnableMoves(speciesName: string, level: number): MoveData[] {
  const key = `${speciesName}|${level >= 100 ? 100 : level}`;
  const hit = _learnCache.get(key);
  if (hit) return hit;

  const ls = rawLearnset(speciesName);
  const out: MoveData[] = [];
  const seen = new Set<string>();
  if (ls) {
    for (const [id, lvl] of ls.level) {
      if (lvl > level) break; // level list is sorted
      const m = MOVE_BY_ID[id];
      if (m && !seen.has(m.name)) { seen.add(m.name); out.push(m); }
    }
    if (level >= 100) {
      for (const id of [...ls.machine, ...ls.egg, ...ls.tutor]) {
        const m = MOVE_BY_ID[id];
        if (m && !seen.has(m.name)) { seen.add(m.name); out.push(m); }
      }
    }
  }
  _learnCache.set(key, out);
  return out;
}

const scoreMove = (m: MoveData, stab: Set<string>) => m.power * (stab.has(m.type) ? 1.5 : 1);

/** Strongest damaging loadout: the highest-scoring move of each distinct type
 *  first (so a full loadout covers four types when the learnset allows), then
 *  the next-best moves regardless of type to fill any remaining slots. */
function pickLoadout(damaging: MoveData[], stab: Set<string>, count = 4): MoveData[] {
  const byScore = [...damaging].sort((a, b) => scoreMove(b, stab) - scoreMove(a, stab));
  const picked: MoveData[] = [];
  const usedTypes = new Set<string>();
  for (const m of byScore) {
    if (picked.length >= count) break;
    if (usedTypes.has(m.type)) continue;
    picked.push(m);
    usedTypes.add(m.type);
  }
  for (const m of byScore) {
    if (picked.length >= count) break;
    if (!picked.includes(m)) picked.push(m);
  }
  return picked;
}

/** The (up to) four moves a mon fights with: the player's picks if it has any,
 *  otherwise its strongest damaging learnable moves, spread across types. */
export function chosenMoves(poke: OwnedPoke, level: number): MoveData[] {
  if (poke.moves && poke.moves.length > 0) {
    const md = poke.moves.map((n) => MOVES[n]).filter(Boolean);
    if (md.length > 0) return md;
  }
  const spec = speciesByName(poke.name);
  const stab = new Set(spec?.types ?? []);
  const dmg = learnableMoves(poke.name, level).filter(
    (m) => m.category !== "Status" && m.power > 0,
  );
  const picked = pickLoadout(dmg, stab, 4);
  return picked.length > 0 ? picked : [fallbackTypeMove(poke)];
}

/** The move the mon actually attacks with: the best-scoring damaging move among
 *  its four (status moves have no effect in this model). */
export function chosenMove(poke: OwnedPoke, level: number): MoveData {
  const ms = chosenMoves(poke, level);
  const spec = speciesByName(poke.name);
  const stab = new Set(spec?.types ?? []);
  const dmg = ms.filter((m) => m.category !== "Status" && m.power > 0);
  if (dmg.length === 0) return ms[0] ?? fallbackTypeMove(poke);
  dmg.sort((a, b) => scoreMove(b, stab) - scoreMove(a, stab));
  return dmg[0];
}

/** The move a mon should fire at a *specific* defender: among its four equipped
 *  moves, the biggest hit — always a super-effective one when available, and
 *  never a 0× (immune) hit if any move connects. Used for enemy AI. */
export function bestMoveAgainst(
  poke: OwnedPoke,
  level: number,
  defenderTypes: string[],
): MoveData {
  const ms = chosenMoves(poke, level).filter((m) => m.category !== "Status" && m.power > 0);
  if (ms.length === 0) return fallbackTypeMove(poke);
  const stab = new Set(speciesByName(poke.name)?.types ?? []);
  const ranked = ms
    .map((m) => {
      const eff = defenseMultiplier(m.type, defenderTypes);
      return { m, eff, score: scoreMove(m, stab) * eff };
    })
    .sort((a, b) => b.score - a.score);
  const superEff = ranked.filter((r) => r.eff > 1);
  if (superEff.length > 0) return superEff[0].m;
  const connects = ranked.filter((r) => r.eff > 0);
  return (connects[0] ?? ranked[0]).m;
}

/** All learnable move names (level-up + Lv.100 TM/egg/tutor), for the editor. */
export function learnableMoveNames(speciesName: string, level: number): string[] {
  return learnableMoves(speciesName, level).map((m) => m.name).filter((n) => MOVES[n]);
}

/** ¥ to newly teach a move: free by level-up (≤ current level) or egg; TM / tutor
 *  moves cost by power — 1000 (<50), 2000 (<100), 3000 (≥100). */
export function moveAcquisitionCost(speciesName: string, level: number, moveName: string): number {
  const ls = rawLearnset(speciesName);
  if (!ls) return 0;
  const id = moveId(moveName);
  if (ls.level.some(([mid, lvl]) => mid === id && lvl <= level)) return 0;
  if (!(ls.machine.includes(id) || ls.tutor.includes(id))) return 0;
  const p = MOVES[moveName]?.power ?? 0;
  return p >= 100 ? 3000 : p >= 50 ? 2000 : 1000;
}
