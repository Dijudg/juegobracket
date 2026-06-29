import type { BracketSavePayload, GroupSelections, Match, ScorePredictionState, Seeds, Team } from "./types";
import { QUARTER_FINAL_MAP, ROUND_OF_16_MAP, ROUND_OF_32_BASE, SEMI_FINAL_MAP } from "./officialBracket";

export const CURRENT_BRACKET_SAVE_VERSION = 6;

const MAX_THIRD = 8;
const GROUP_LETTERS = "ABCDEFGHIJKL".split("");

const legacyR16Map = [
  { id: "r16-89", label: "89", a: "r32-73", b: "r32-74" },
  { id: "r16-90", label: "90", a: "r32-75", b: "r32-76" },
  { id: "r16-91", label: "91", a: "r32-77", b: "r32-78" },
  { id: "r16-92", label: "92", a: "r32-79", b: "r32-80" },
  { id: "r16-93", label: "93", a: "r32-81", b: "r32-82" },
  { id: "r16-94", label: "94", a: "r32-83", b: "r32-84" },
  { id: "r16-95", label: "95", a: "r32-85", b: "r32-86" },
  { id: "r16-96", label: "96", a: "r32-87", b: "r32-88" },
] as const;

const legacyQfMap = [
  { id: "qf-97", label: "97", a: "r16-89", b: "r16-90" },
  { id: "qf-98", label: "98", a: "r16-91", b: "r16-92" },
  { id: "qf-99", label: "99", a: "r16-93", b: "r16-94" },
  { id: "qf-100", label: "100", a: "r16-95", b: "r16-96" },
] as const;

const legacySfMap = [
  { id: "sf-101", label: "101", a: "qf-97", b: "qf-98" },
  { id: "sf-102", label: "102", a: "qf-99", b: "qf-100" },
] as const;

const LKP_SEED_ORDER = ["A1", "B1", "D1", "E1", "G1", "I1", "K1", "L1"] as const;

const LKP_ALLOWED_GROUPS: Record<string, string[]> = {
  A1: ["C", "E", "F", "H", "I"],
  E1: ["A", "B", "C", "D", "F"],
  I1: ["C", "D", "F", "G", "H"],
  L1: ["E", "H", "I", "J", "K"],
  D1: ["B", "E", "F", "I", "J"],
  G1: ["A", "E", "H", "I", "J"],
  B1: ["E", "F", "G", "I", "J"],
  K1: ["D", "E", "I", "J", "L"],
};

const postR32MatchPattern = /^(r16|qf|sf|third|final)-/i;

const normalizeKey = (value?: string) => (value || "").toString().trim().toUpperCase();

const normalizeThirdGroups = (groups: string[]) => {
  const seen = new Set<string>();
  const ordered: string[] = [];
  groups.forEach((group) => {
    const normalized = group?.toString().trim().toUpperCase();
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    ordered.push(normalized);
  });
  return ordered;
};

const assignThirdGroupsToSeeds = (thirdsQualified: string[]) => {
  const orderedThirds = normalizeThirdGroups(thirdsQualified);
  if (orderedThirds.length < MAX_THIRD) return null;

  const entry: Record<string, string> = {};
  const used = new Set<string>();

  const backtrack = (seedIdx: number): boolean => {
    if (seedIdx >= LKP_SEED_ORDER.length) return true;
    const seed = LKP_SEED_ORDER[seedIdx];
    const allowed = LKP_ALLOWED_GROUPS[seed] || GROUP_LETTERS;
    for (const group of orderedThirds) {
      if (used.has(group) || !allowed.includes(group)) continue;
      used.add(group);
      entry[seed] = `3${group}`;
      if (backtrack(seedIdx + 1)) return true;
      used.delete(group);
      delete entry[seed];
    }
    return false;
  };

  return backtrack(0) ? entry : null;
};

const buildRoundOf32 = (seeds: Seeds, thirdsQualifiedGroups: string[]): Match[] => {
  const entry = assignThirdGroupsToSeeds(thirdsQualifiedGroups);
  if (!entry) return [];

  const slotTeam = (seed: string): Team | undefined => {
    const group = seed[0];
    const pos = seed[1];
    if (pos === "1") return seeds.firsts[group];
    if (pos === "2") return seeds.seconds[group];
    return undefined;
  };

  const thirdSeedToTeam = (code: string): Team | undefined => {
    const group = entry[code]?.[1];
    return group ? seeds.thirds[group] : undefined;
  };

  return ROUND_OF_32_BASE.map((cfg) => ({
    id: `r32-${cfg.id}`,
    label: cfg.id,
    equipoA: cfg.home.startsWith("LKP_") ? thirdSeedToTeam(cfg.home.slice(4)) : slotTeam(cfg.home),
    equipoB: cfg.away.startsWith("LKP_") ? thirdSeedToTeam(cfg.away.slice(4)) : slotTeam(cfg.away),
  }));
};

const hasScorePrediction = (prediction?: { home?: number | null; away?: number | null }) =>
  typeof prediction?.home === "number" && typeof prediction?.away === "number";

const getScoreBasedWinner = (
  match: Match,
  scorePredictions: ScorePredictionState,
  penaltyPredictions: ScorePredictionState,
) => {
  if (!match.equipoA || !match.equipoB) return undefined;
  const prediction = scorePredictions[match.id];
  if (!hasScorePrediction(prediction)) return undefined;
  if ((prediction!.home as number) > (prediction!.away as number)) return match.equipoA;
  if ((prediction!.away as number) > (prediction!.home as number)) return match.equipoB;

  const penalty = penaltyPredictions[match.id];
  if (!hasScorePrediction(penalty) || penalty!.home === penalty!.away) return undefined;
  return (penalty!.home as number) > (penalty!.away as number) ? match.equipoA : match.equipoB;
};

const buildRounds = (
  base: Match[],
  picks: Record<string, string | undefined>,
  scorePredictions: ScorePredictionState,
  penaltyPredictions: ScorePredictionState,
  gameMode: BracketSavePayload["gameMode"] = "classic",
  maps: {
    r16: typeof legacyR16Map | typeof ROUND_OF_16_MAP;
    qf: typeof legacyQfMap | typeof QUARTER_FINAL_MAP;
    sf: typeof legacySfMap | typeof SEMI_FINAL_MAP;
  },
) => {
  const pickWinner = (match: Match): Team | undefined => {
    if (gameMode === "full") return getScoreBasedWinner(match, scorePredictions, penaltyPredictions);
    const picked = normalizeKey(picks[match.id]);
    if (picked && normalizeKey(match.equipoA?.id) === picked) return match.equipoA;
    if (picked && normalizeKey(match.equipoB?.id) === picked) return match.equipoB;
    return undefined;
  };

  const attachWinners = (matches: Match[]): Match[] =>
    matches.map((match) => {
      const ganador = pickWinner(match);
      const perdedor =
        ganador && match.equipoA && match.equipoB
          ? normalizeKey(ganador.id) === normalizeKey(match.equipoA.id)
            ? match.equipoB
            : match.equipoA
          : undefined;
      return { ...match, ganador, perdedor };
    });

  const r32 = attachWinners(base);
  const winner = (items: Match[], id: string) => items.find((match) => match.id === id)?.ganador;
  const r16 = attachWinners(
    maps.r16.map((match) => ({
      id: match.id,
      label: match.label,
      equipoA: winner(r32, match.a),
      equipoB: winner(r32, match.b),
    })),
  );
  const qf = attachWinners(
    maps.qf.map((match) => ({
      id: match.id,
      label: match.label,
      equipoA: winner(r16, match.a),
      equipoB: winner(r16, match.b),
    })),
  );
  const sf = attachWinners(
    maps.sf.map((match) => ({
      id: match.id,
      label: match.label,
      equipoA: winner(qf, match.a),
      equipoB: winner(qf, match.b),
    })),
  );
  const final = attachWinners([
    {
      id: "final-104",
      label: "104",
      equipoA: winner(sf, "sf-101"),
      equipoB: winner(sf, "sf-102"),
    },
  ]);
  const thirdPlace = attachWinners([
    {
      id: "third-103",
      label: "103",
      equipoA: sf.find((match) => match.id === "sf-101")?.perdedor,
      equipoB: sf.find((match) => match.id === "sf-102")?.perdedor,
    },
  ]);

  return { r32, r16, qf, sf, final, thirdPlace };
};

const teamInMatch = (match: Match, team?: Team) => {
  if (!team) return false;
  const id = normalizeKey(team.id);
  return normalizeKey(match.equipoA?.id) === id || normalizeKey(match.equipoB?.id) === id;
};

const findMatchForTeam = (matches: Match[], team?: Team) => matches.find((match) => teamInMatch(match, team));

const stripPostR32Picks = (picks: Record<string, string | undefined>) => {
  const next: Record<string, string | undefined> = {};
  Object.entries(picks || {}).forEach(([key, value]) => {
    if (!postR32MatchPattern.test(key)) next[key] = value;
  });
  return next;
};

const migrateClassicPicks = (
  base: Match[],
  payload: BracketSavePayload,
): Record<string, string | undefined> => {
  const originalPicks = payload.picks || {};
  const migratedPicks = stripPostR32Picks(originalPicks);
  const sourceMaps =
    Number(payload.version || 1) >= 4
      ? { r16: ROUND_OF_16_MAP, qf: QUARTER_FINAL_MAP, sf: legacySfMap }
      : { r16: legacyR16Map, qf: legacyQfMap, sf: legacySfMap };
  const legacyRounds = buildRounds(
    base,
    originalPicks,
    payload.scorePredictions || {},
    payload.penaltyPredictions || {},
    "classic",
    sourceMaps,
  );

  const migrateRound = (
    legacyMatches: Match[],
    currentMatches: Match[],
  ) => {
    legacyMatches.forEach((legacyMatch) => {
      if (!originalPicks[legacyMatch.id] || !legacyMatch.ganador) return;
      const target = findMatchForTeam(currentMatches, legacyMatch.ganador);
      if (!target || migratedPicks[target.id]) return;
      migratedPicks[target.id] = legacyMatch.ganador.id;
    });
  };

  let currentRounds = buildRounds(base, migratedPicks, {}, {}, "classic", { r16: ROUND_OF_16_MAP, qf: QUARTER_FINAL_MAP, sf: SEMI_FINAL_MAP });
  migrateRound(legacyRounds.r16, currentRounds.r16);

  currentRounds = buildRounds(base, migratedPicks, {}, {}, "classic", { r16: ROUND_OF_16_MAP, qf: QUARTER_FINAL_MAP, sf: SEMI_FINAL_MAP });
  migrateRound(legacyRounds.qf, currentRounds.qf);

  currentRounds = buildRounds(base, migratedPicks, {}, {}, "classic", { r16: ROUND_OF_16_MAP, qf: QUARTER_FINAL_MAP, sf: SEMI_FINAL_MAP });
  migrateRound(legacyRounds.sf, currentRounds.sf);

  currentRounds = buildRounds(base, migratedPicks, {}, {}, "classic", { r16: ROUND_OF_16_MAP, qf: QUARTER_FINAL_MAP, sf: SEMI_FINAL_MAP });
  migrateRound(legacyRounds.thirdPlace, currentRounds.thirdPlace);
  migrateRound(legacyRounds.final, currentRounds.final);

  return migratedPicks;
};

const countValidClassicPostR32Picks = (
  base: Match[],
  payload: BracketSavePayload,
  maps: {
    r16: typeof legacyR16Map | typeof ROUND_OF_16_MAP;
    qf: typeof legacyQfMap | typeof QUARTER_FINAL_MAP;
    sf: typeof legacySfMap | typeof SEMI_FINAL_MAP;
  },
) => {
  const picks = payload.picks || {};
  const rounds = buildRounds(base, picks, {}, {}, "classic", maps);
  const matches = [...rounds.r16, ...rounds.qf, ...rounds.sf, ...rounds.thirdPlace, ...rounds.final];
  return matches.reduce((count, match) => {
    const picked = normalizeKey(picks[match.id]);
    if (!picked) return count;
    return normalizeKey(match.equipoA?.id) === picked || normalizeKey(match.equipoB?.id) === picked
      ? count + 1
      : count;
  }, 0);
};

const preserveScoresByMatchNumber = (
  payload: BracketSavePayload,
) => {
  const originalScores = payload.scorePredictions || {};
  const originalPenalties = payload.penaltyPredictions || {};
  const nextScores: ScorePredictionState = {};
  const nextPenalties: ScorePredictionState = {};

  Object.entries(originalScores).forEach(([key, value]) => {
    if (value) nextScores[key] = value;
  });
  Object.entries(originalPenalties).forEach(([key, value]) => {
    if (value) nextPenalties[key] = value;
  });

  return { scorePredictions: nextScores, penaltyPredictions: nextPenalties };
};

export const migrateLegacyBracketPayload = (
  payload: BracketSavePayload,
  context: { seeds: Seeds; thirdsQualifiedGroups: string[] },
): BracketSavePayload => {
  if (!payload || Number(payload.version || 1) >= CURRENT_BRACKET_SAVE_VERSION) return payload;
  const base = buildRoundOf32(context.seeds, context.thirdsQualifiedGroups);
  if (base.length === 0) return { ...payload, version: CURRENT_BRACKET_SAVE_VERSION };

  if (payload.gameMode === "full") {
    const scores = preserveScoresByMatchNumber(payload);
    return {
      ...payload,
      version: CURRENT_BRACKET_SAVE_VERSION,
      scorePredictions: scores.scorePredictions,
      penaltyPredictions: scores.penaltyPredictions,
    };
  }

  const currentValidPicks = countValidClassicPostR32Picks(base, payload, {
    r16: ROUND_OF_16_MAP,
    qf: QUARTER_FINAL_MAP,
    sf: SEMI_FINAL_MAP,
  });
  const legacyValidPicks = countValidClassicPostR32Picks(base, payload, {
    r16: Number(payload.version || 1) >= 4 ? ROUND_OF_16_MAP : legacyR16Map,
    qf: Number(payload.version || 1) >= 4 ? QUARTER_FINAL_MAP : legacyQfMap,
    sf: legacySfMap,
  });
  if (currentValidPicks >= legacyValidPicks) {
    return {
      ...payload,
      version: CURRENT_BRACKET_SAVE_VERSION,
    };
  }

  return {
    ...payload,
    version: CURRENT_BRACKET_SAVE_VERSION,
    picks: migrateClassicPicks(base, payload),
  };
};

export const buildThirdQualifiedGroupsForMigration = (
  selections: GroupSelections,
  bestThirdIds: string[] = [],
) => {
  const thirdsAvailable = GROUP_LETTERS.map((group) => selections[group]?.tercero).filter(Boolean) as Team[];
  return bestThirdIds
    .map((id) => thirdsAvailable.find((team) => normalizeKey(team.id) === normalizeKey(id)))
    .filter(Boolean)
    .map((team) => team!.grupo?.toUpperCase())
    .filter(Boolean) as string[];
};
