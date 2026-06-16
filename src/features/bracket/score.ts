import { useEffect, useMemo, useState } from "react";
import type { BracketSavePayload, PlayoffPickState, ScorePredictionState } from "./types";
import localTeamsPayload from "../../data/teams.json";
import localStandingsPayload from "../../data/standings.json";
import localMatchesPayload from "../../data/matches.json";
import localPlayoffPayload from "../../data/playoff-match-snapshots.json";
import { isPlayoffFixtureId, loadPlayoffScoreSheetData } from "./playoffScoreSheet";

export type BracketScoreInput = {
  picks: Record<string, string | undefined>;
  intercontinentalPicks: PlayoffPickState;
  uefaPicks: PlayoffPickState;
  selections?: BracketSavePayload["selections"];
  bestThirdIds?: string[];
};

export type ScoreFixture = {
  fixtureId: string;
  winnerId: string;
  homeId?: string;
  awayId?: string;
  homeScore?: number | null;
  awayScore?: number | null;
  homePenaltyScore?: number | null;
  awayPenaltyScore?: number | null;
};

export type OfficialGroupStanding = {
  group: string;
  position: number;
  teamId: string;
  points: number;
  played: number;
  wins: number;
  goalDifference: number;
  goalsFor: number;
};

export type ScoreSheetData = {
  fixturesById: Map<string, ScoreFixture>;
  selectionByToken: Map<string, string>;
  groupStandings: Map<string, OfficialGroupStanding[]>;
};

export type ScoreTab = "repechajes" | "grupos" | "dieciseisavos" | "llaves";

export type BracketScoreSummary = {
  totalPoints: number;
  hitCount: number;
  evaluatedCount: number;
  pointsByTab: Record<ScoreTab, number>;
  pointsByMatchId: Record<string, number>;
  exactCount?: number;
  winnerCount?: number;
  goalCount?: number;
  uniqueExactCount?: number;
  penaltyExactCount?: number;
  groupPositionHitCount?: number;
  bestThirdHitCount?: number;
};

export type BracketScoreOptions = {
  enabledTabs?: Partial<Record<ScoreTab, boolean>>;
};

export type FullBracketScoreInput = BracketScoreInput & {
  scorePredictions: ScorePredictionState;
  penaltyPredictions?: ScorePredictionState;
};

const FULL_POINTS = {
  exactScore: 5,
  winner: 2,
  goal: 1,
  uniqueExact: 5,
  roundOf16Bonus: 8,
  quarterBonus: 4,
  semifinalBonus: 2,
  finalBonus: 5,
  exactPenalty: 1,
} as const;

const WORLD_FIXTURES_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRi2qMMbibzuc4bjv38DBJYnfY24e4Mt0c20CqpDDFzgBn_aJ6NR0HcrXjdbKLhAEsy3zJUdvr3npRU/pub?gid=171585554&single=true&output=tsv";
const SELECCIONES_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRi2qMMbibzuc4bjv38DBJYnfY24e4Mt0c20CqpDDFzgBn_aJ6NR0HcrXjdbKLhAEsy3zJUdvr3npRU/pub?gid=0&single=true&output=csv";
const TELEGRAFO_TEAMS_URL = "https://especiales.eltelegrafo.com.ec/api/teams.json";
const TELEGRAFO_STANDINGS_URL = "https://especiales.eltelegrafo.com.ec/api/standings.json";
const TELEGRAFO_MATCHES_URL = "https://especiales.eltelegrafo.com.ec/api/matches.json";
const TELEGRAFO_PLAYOFF_SNAPSHOTS_URL =
  "https://especiales.eltelegrafo.com.ec/api/playoff-match-snapshots.json";
const POINTS_PER_HIT = 3;
const TEAM_ALIASES: Record<string, string> = {
  SWE: "SUE",
  NRL: "NIR",
};

const PLAYOFF_PICK_TO_FIXTURE: Record<string, string> = {
  "INT-K2-SF": "RI1",
  "INT-K2-FINAL": "RI2",
  "INT-K1-SF": "RI3",
  "INT-K1-FINAL": "RI4",
  "UEFA1-SF1": "RA1",
  "UEFA1-SF2": "RA2",
  "UEFA1-FINAL": "RA3",
  "UEFA2-SF1": "RB1",
  "UEFA2-SF2": "RB2",
  "UEFA2-FINAL": "RB3",
  "UEFA3-SF1": "RC1",
  "UEFA3-SF2": "RC2",
  "UEFA3-FINAL": "RC3",
  "UEFA4-SF1": "RD1",
  "UEFA4-SF2": "RD2",
  "UEFA4-FINAL": "RD3",
};

const FIXTURE_TO_PLAYOFF_PICK = Object.fromEntries(
  Object.entries(PLAYOFF_PICK_TO_FIXTURE).map(([pickId, fixtureId]) => [fixtureId, pickId]),
) as Record<string, string>;

let scoreSheetCachePromise: Promise<ScoreSheetData> | null = null;

const normalizeKey = (value?: string) => (value || "").toString().trim().toUpperCase();

const normalizeComparable = (value?: string) =>
  normalizeKey(
    (value || "")
      .toString()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, ""),
  );

const parseCSVLine = (line: string): string[] => {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === "\"") {
      if (inQuotes && line[i + 1] === "\"") {
        current += "\"";
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  result.push(current.trim());
  return result;
};

const parseLines = (content: string) =>
  content
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

const resolveFixtureIdFromPick = (pickId: string) => {
  const key = normalizeKey(pickId);
  if (PLAYOFF_PICK_TO_FIXTURE[key]) return PLAYOFF_PICK_TO_FIXTURE[key];
  if (/^(R32|R16|QF|SF)-\d+$/.test(key)) return `P${key.split("-")[1]}`;
  if (/^(THIRD|FINAL)-\d+$/.test(key)) return `P${key.split("-")[1]}`;
  if (/^\d+$/.test(key)) return `P${Number.parseInt(key, 10)}`;
  if (/^P\d+$/.test(key)) return key;
  return null;
};

const resolvePickIdFromFixture = (fixtureId: string) => {
  const key = normalizeKey(fixtureId);
  if (FIXTURE_TO_PLAYOFF_PICK[key]) return FIXTURE_TO_PLAYOFF_PICK[key];
  const fixtureNum = parseFixtureNumericId(key);
  if (fixtureNum === null || fixtureNum < 73 || fixtureNum > 104) return null;
  if (fixtureNum <= 88) return `r32-${fixtureNum}`;
  if (fixtureNum <= 96) return `r16-${fixtureNum}`;
  if (fixtureNum <= 100) return `qf-${fixtureNum}`;
  if (fixtureNum <= 102) return `sf-${fixtureNum}`;
  if (fixtureNum === 103) return "third-103";
  return "final-104";
};

const resolveScorePredictionIdFromFixture = (fixtureId: string) => {
  const key = normalizeKey(fixtureId);
  if (FIXTURE_TO_PLAYOFF_PICK[key]) return FIXTURE_TO_PLAYOFF_PICK[key];
  const fixtureNum = parseFixtureNumericId(key);
  if (fixtureNum === null || fixtureNum < 1 || fixtureNum > 104) return null;
  if (fixtureNum <= 72) return `${fixtureNum}`;
  return resolvePickIdFromFixture(key);
};

const resolveSelectionLabel = (token: string, map: Map<string, string>) => {
  const key = normalizeKey(token);
  if (!key) return "";
  if (key === "EMPATE") return "Empate";
  return map.get(key) || token;
};

const resolveComparableSelection = (token: string, map: Map<string, string>) =>
  normalizeComparable(resolveSelectionLabel(token, map));

const parseFixtureNumericId = (fixtureId: string) => {
  const key = normalizeKey(fixtureId);
  if (!key.startsWith("P")) return null;
  const num = Number.parseInt(key.slice(1), 10);
  return Number.isFinite(num) ? num : null;
};

const PLAYOFF_SNAPSHOT_META: Record<string, { fixtureId: string; home?: string; away?: string; finalSeed?: string; finalFrom?: string }> = {
  "LIGUILLA-UEFA-RUTA-A-SF-1": { fixtureId: "RA1", home: "ITA", away: "NIR" },
  "LIGUILLA-UEFA-RUTA-A-SF-2": { fixtureId: "RA2", home: "WAL", away: "BIH" },
  "LIGUILLA-UEFA-RUTA-A-FINAL": { fixtureId: "RA3", finalFrom: "LIGUILLA-UEFA-RUTA-A" },
  "LIGUILLA-UEFA-RUTA-B-SF-1": { fixtureId: "RB1", home: "UKR", away: "SUE" },
  "LIGUILLA-UEFA-RUTA-B-SF-2": { fixtureId: "RB2", home: "POL", away: "ALB" },
  "LIGUILLA-UEFA-RUTA-B-FINAL": { fixtureId: "RB3", finalFrom: "LIGUILLA-UEFA-RUTA-B" },
  "LIGUILLA-UEFA-RUTA-C-SF-1": { fixtureId: "RC1", home: "TUR", away: "ROU" },
  "LIGUILLA-UEFA-RUTA-C-SF-2": { fixtureId: "RC2", home: "SVK", away: "KOS" },
  "LIGUILLA-UEFA-RUTA-C-FINAL": { fixtureId: "RC3", finalFrom: "LIGUILLA-UEFA-RUTA-C" },
  "LIGUILLA-UEFA-RUTA-D-SF-1": { fixtureId: "RD1", home: "DEN", away: "MKD" },
  "LIGUILLA-UEFA-RUTA-D-SF-2": { fixtureId: "RD2", home: "CZE", away: "IRL" },
  "LIGUILLA-UEFA-RUTA-D-FINAL": { fixtureId: "RD3", finalFrom: "LIGUILLA-UEFA-RUTA-D" },
  "LIGUILLA-INT-1": { fixtureId: "RI1", home: "BOL", away: "SUR" },
  "LIGUILLA-INT-FINAL-1": { fixtureId: "RI2", finalSeed: "IRQ", finalFrom: "LIGUILLA-INT-1" },
  "LIGUILLA-INT-2": { fixtureId: "RI3", home: "NCL", away: "JAM" },
  "LIGUILLA-INT-FINAL-2": { fixtureId: "RI4", finalSeed: "COD", finalFrom: "LIGUILLA-INT-2" },
};

const toRecord = (value: unknown): Record<string, any> | null =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, any>) : null;

const unwrapArray = (payload: unknown, preferredKeys: string[]) => {
  if (Array.isArray(payload)) return payload;
  const obj = toRecord(payload);
  if (!obj) return [];
  for (const key of preferredKeys) {
    const value = obj[key];
    if (Array.isArray(value)) return value;
    const nested = toRecord(value);
    if (nested) {
      for (const nestedKey of preferredKeys) {
        if (Array.isArray(nested[nestedKey])) return nested[nestedKey];
      }
    }
  }
  return [];
};

const firstValue = (row: Record<string, any>, keys: string[]) => {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && `${value}`.trim() !== "") return value;
  }
  return "";
};

const stringifyToken = (value: unknown): string => {
  if (value === undefined || value === null) return "";
  if (typeof value === "string" || typeof value === "number") return `${value}`;
  const obj = toRecord(value);
  if (!obj) return "";
  return `${firstValue(obj, [
    "id",
    "teamId",
    "team_id",
    "seleccion_id",
    "codigo_fixture",
    "code",
    "fifa_code",
    "slug",
    "name",
    "nombre",
    "nombre_seleccion",
    "seleccion",
  ])}`;
};

const registerSelectionToken = (map: Map<string, string>, rawToken: unknown, rawLabel?: unknown) => {
  const token = normalizeKey(stringifyToken(rawToken));
  const label = stringifyToken(rawLabel || rawToken).trim();
  if (!token || !label) return;
  map.set(token, label);
  map.set(normalizeComparable(label), label);
  const canonical = TEAM_ALIASES[token] || token;
  if (canonical !== token) map.set(canonical, label);
  Object.entries(TEAM_ALIASES).forEach(([alias, target]) => {
    if (target === token || target === canonical) map.set(alias, label);
  });
};

const registerTeamLikeRow = (map: Map<string, string>, raw: unknown) => {
  const row = toRecord(raw);
  if (!row) return;
  const label = stringifyToken(
    firstValue(row, [
      "seleccion",
      "nombre",
      "nombre_seleccion",
      "name",
      "fullName",
      "shortName",
      "team_name",
      "short_name",
      "country",
    ]),
  ).trim();
  if (!label) return;
  [
    "id",
    "teamId",
    "team_id",
    "seleccion_id",
    "codigo_fixture",
    "code",
    "fifa_code",
    "slug",
    "abbreviation",
    "name",
    "nombre",
    "seleccion",
  ].forEach((key) => registerSelectionToken(map, row[key], label));
};

const readNumber = (row: Record<string, any>, keys: string[]) => {
  const raw = firstValue(row, keys);
  if (raw === "" || raw === undefined || raw === null) return null;
  const n = Number.parseInt(`${raw}`, 10);
  return Number.isFinite(n) ? n : null;
};

const resolveScoresFromRow = (row: Record<string, any>) => {
  const homeScore = readNumber(row, ["gol_local", "golLocal", "homeScore", "home_score", "score_home", "local_score", "homeGoals"]);
  const awayScore = readNumber(row, ["gol_visita", "golVisita", "awayScore", "away_score", "score_away", "visit_score", "awayGoals"]);
  return { homeScore, awayScore };
};

const resolvePenaltyScoresFromRow = (row: Record<string, any>) => {
  const homePenaltyScore = readNumber(row, [
    "penal_local",
    "penales_local",
    "penalesLocal",
    "penaltyHome",
    "homePenalty",
    "home_penalty",
    "penalty_home",
    "penalties_home",
    "homePenalties",
    "pen_local",
  ]);
  const awayPenaltyScore = readNumber(row, [
    "penal_visita",
    "penales_visita",
    "penalesVisita",
    "penaltyAway",
    "awayPenalty",
    "away_penalty",
    "penalty_away",
    "penalties_away",
    "awayPenalties",
    "pen_visita",
  ]);
  return { homePenaltyScore, awayPenaltyScore };
};

const resolveWinnerFromScores = (row: Record<string, any>) => {
  const { homeScore, awayScore } = resolveScoresFromRow(row);
  if (homeScore === null || awayScore === null) return "";
  if (homeScore === awayScore) return "EMPATE";
  return homeScore > awayScore
    ? stringifyToken(firstValue(row, ["local_id", "home_id", "homeTeamId", "home_team_id", "homeTeamCode", "local"]))
    : stringifyToken(firstValue(row, ["visita_id", "away_id", "awayTeamId", "away_team_id", "awayTeamCode", "visita"]));
};

const resolveWinnerFromSnapshot = (
  row: Record<string, any>,
  snapshotWinners: Map<string, string>,
): { fixtureId: string; winnerId: string } | null => {
  const snapshotId = normalizeKey(stringifyToken(firstValue(row, ["id", "slug", "matchId"])));
  const meta = PLAYOFF_SNAPSHOT_META[snapshotId];
  if (!meta) return null;

  const homeScore = readNumber(row, ["golLocal", "gol_local", "homeScore", "home_score"]);
  const awayScore = readNumber(row, ["golVisita", "gol_visita", "awayScore", "away_score"]);
  if (homeScore === null || awayScore === null || homeScore === awayScore) return null;

  let home = meta.home;
  let away = meta.away;
  if (meta.finalFrom) {
    const semifinalKeys = [`${meta.finalFrom}-SF-1`, `${meta.finalFrom}-SF-2`];
    const semifinalWinners = semifinalKeys
      .map((key) => snapshotWinners.get(key))
      .filter(Boolean) as string[];
    if (meta.finalSeed) {
      home = meta.finalSeed;
      away = snapshotWinners.get(meta.finalFrom);
    } else {
      home = semifinalWinners[0];
      away = semifinalWinners[1];
    }
  }

  const winnerId = homeScore > awayScore ? home : away;
  if (!winnerId) return null;
  snapshotWinners.set(snapshotId, winnerId);
  return { fixtureId: meta.fixtureId, winnerId };
};

const registerFixtureAliases = (
  map: Map<string, ScoreFixture>,
  fixtureId: string,
  winnerId: string,
  extra: Partial<ScoreFixture> = {},
) => {
  const normalizedFixtureId = normalizeKey(fixtureId);
  const normalizedWinnerId = normalizeKey(winnerId);
  if (!normalizedFixtureId || !normalizedWinnerId) return;
  const fixture: ScoreFixture = { fixtureId: normalizedFixtureId, winnerId: normalizedWinnerId, ...extra };
  map.set(normalizedFixtureId, fixture);
  if (/^\d+$/.test(normalizedFixtureId)) {
    map.set(`P${normalizedFixtureId}`, { ...fixture, fixtureId: `P${normalizedFixtureId}` });
  }
};

const registerMatchLikeRow = (
  fixturesById: Map<string, ScoreFixture>,
  selectionByToken: Map<string, string>,
  raw: unknown,
  fixtureAliases: string[] = [],
) => {
  const row = toRecord(raw);
  if (!row) return;
  const status = normalizeComparable(stringifyToken(firstValue(row, ["status", "estado", "matchStatus", "match_status"])));
  if (status && !["FINALIZADO", "FINAL", "FINISHED", "COMPLETED"].includes(status)) return;
  const fixtureId = stringifyToken(
    firstValue(row, [
      "id_partido",
      "matchId",
      "fixture_id",
      "match_id",
      "partido_id",
      "id",
      "codigo",
      "code",
      "slug",
    ]),
  );
  if (!fixtureId) return;

  const home = firstValue(row, ["local", "home", "home_team", "homeTeam", "local_team", "homeTeamName"]);
  const away = firstValue(row, ["visita", "away", "away_team", "awayTeam", "visit_team", "awayTeamName"]);
  registerTeamLikeRow(selectionByToken, home);
  registerTeamLikeRow(selectionByToken, away);

  const homeId = stringifyToken(firstValue(row, ["local_id", "home_id", "homeTeamId", "home_team_id", "homeTeamCode"]));
  const awayId = stringifyToken(firstValue(row, ["visita_id", "away_id", "awayTeamId", "away_team_id", "awayTeamCode"]));
  if (homeId) registerSelectionToken(selectionByToken, homeId, stringifyToken(home) || homeId);
  if (awayId) registerSelectionToken(selectionByToken, awayId, stringifyToken(away) || awayId);
  registerSelectionToken(selectionByToken, row.homeTeamCode, stringifyToken(home) || row.homeTeamCode);
  registerSelectionToken(selectionByToken, row.awayTeamCode, stringifyToken(away) || row.awayTeamCode);

  const directWinner = firstValue(row, [
    "ganador_id",
    "winnerId",
    "winner_id",
    "winning_team_id",
    "winnerTeamId",
    "winner_code",
    "winner",
    "ganador",
  ]);
  const winnerId = stringifyToken(directWinner) || resolveWinnerFromScores(row);
  const { homeScore, awayScore } = resolveScoresFromRow(row);
  const { homePenaltyScore, awayPenaltyScore } = resolvePenaltyScoresFromRow(row);
  const extra = {
    homeId: normalizeKey(homeId),
    awayId: normalizeKey(awayId),
    homeScore,
    awayScore,
    homePenaltyScore,
    awayPenaltyScore,
  };
  registerFixtureAliases(fixturesById, fixtureId, winnerId, extra);
  fixtureAliases.forEach((alias) => registerFixtureAliases(fixturesById, alias, winnerId, extra));
};

const registerPlayoffSnapshotRows = (
  fixturesById: Map<string, ScoreFixture>,
  rows: unknown[],
) => {
  const snapshotWinners = new Map<string, string>();
  rows.forEach((raw) => {
    const row = toRecord(raw);
    if (!row) return;
    const result = resolveWinnerFromSnapshot(row, snapshotWinners);
    if (!result) return;
    registerFixtureAliases(fixturesById, result.fixtureId, result.winnerId);
  });
};

const fetchJsonOrNull = async (url: string) => {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
};

const buildTelegrafoScoreData = (
  teamsPayload: unknown,
  standingsPayload: unknown,
  matchesPayload: unknown,
  playoffPayload: unknown,
): ScoreSheetData | null => {
  const fixturesById = new Map<string, ScoreFixture>();
  const selectionByToken = new Map<string, string>();
  const groupStandings = new Map<string, OfficialGroupStanding[]>();

  unwrapArray(teamsPayload, ["teams", "data", "items"]).forEach((team) => {
    registerTeamLikeRow(selectionByToken, team);
  });
  unwrapArray(standingsPayload, ["standings", "groups", "data", "items", "teams"]).forEach((standing) => {
    const row = toRecord(standing);
    if (!row) return;
    registerTeamLikeRow(selectionByToken, row);
    registerTeamLikeRow(selectionByToken, firstValue(row, ["team", "selection", "seleccion"]));
    if (Array.isArray(row.equipos)) {
      row.equipos.forEach((team) => registerTeamLikeRow(selectionByToken, team));
    }
    if (Array.isArray(row.teams)) {
      row.teams.forEach((team) => registerTeamLikeRow(selectionByToken, team));
    }
    const group = normalizeKey(stringifyToken(firstValue(row, ["nombre", "group", "grupo", "name"])));
    const teams = Array.isArray(row.equipos) ? row.equipos : Array.isArray(row.teams) ? row.teams : [];
    if (!group || teams.length === 0) return;
    const parsed = teams
      .map((rawTeam, index): OfficialGroupStanding | null => {
        const team = toRecord(rawTeam);
        if (!team) return null;
        const teamId = stringifyToken(
          firstValue(team, ["codigo_fixture", "code", "fifa_code", "seleccion_id", "teamId", "team_id", "id"]),
        );
        if (!teamId) return null;
        return {
          group,
          position: readNumber(team, ["orden", "position", "posicion", "rank"]) || index + 1,
          teamId: normalizeKey(teamId),
          points: readNumber(team, ["pts", "points", "puntos"]) || 0,
          played: readNumber(team, ["pj", "played", "gamesPlayed"]) || 0,
          wins: readNumber(team, ["pg", "wins", "gamesWon"]) || 0,
          goalDifference: readNumber(team, ["dif", "goalDifference", "goal_difference"]) || 0,
          goalsFor: readNumber(team, ["gf", "goalsFor", "goals_for"]) || 0,
        };
      })
      .filter((team): team is OfficialGroupStanding => !!team)
      .sort((a, b) => a.position - b.position);
    if (parsed.length > 0) groupStandings.set(group, parsed);
  });
  unwrapArray(matchesPayload, ["matches", "fixtures", "data", "items"]).forEach((match, index) => {
    registerMatchLikeRow(fixturesById, selectionByToken, match, [`P${index + 1}`]);
  });
  const playoffRows = unwrapArray(playoffPayload, ["snapshots", "matches", "fixtures", "data", "items"]);
  registerPlayoffSnapshotRows(fixturesById, playoffRows);
  playoffRows.forEach((match) => {
    registerMatchLikeRow(fixturesById, selectionByToken, match);
  });

  if (fixturesById.size === 0 && selectionByToken.size === 0 && groupStandings.size === 0) return null;
  return { fixturesById, selectionByToken, groupStandings };
};

const loadRemoteTelegrafoScoreData = async (): Promise<ScoreSheetData | null> => {
  const [teamsPayload, standingsPayload, matchesPayload, playoffPayload] = await Promise.all([
    fetchJsonOrNull(TELEGRAFO_TEAMS_URL),
    fetchJsonOrNull(TELEGRAFO_STANDINGS_URL),
    fetchJsonOrNull(TELEGRAFO_MATCHES_URL),
    fetchJsonOrNull(TELEGRAFO_PLAYOFF_SNAPSHOTS_URL),
  ]);

  return buildTelegrafoScoreData(teamsPayload, standingsPayload, matchesPayload, playoffPayload);
};

const mergeScoreData = (...sources: Array<ScoreSheetData | null | undefined>): ScoreSheetData => {
  const fixturesById = new Map<string, ScoreFixture>();
  const selectionByToken = new Map<string, string>();
  const groupStandings = new Map<string, OfficialGroupStanding[]>();
  sources.forEach((source) => {
    source?.selectionByToken.forEach((value, key) => selectionByToken.set(key, value));
    source?.fixturesById.forEach((value, key) => fixturesById.set(key, value));
    source?.groupStandings.forEach((value, key) => groupStandings.set(key, value));
  });
  return { fixturesById, selectionByToken, groupStandings };
};

const loadFallbackScoreSheetData = async (): Promise<ScoreSheetData> => {
  const [fixturesRes, seleccionesRes] = await Promise.all([
    fetch(WORLD_FIXTURES_URL),
    fetch(SELECCIONES_URL),
  ]);
  if (!fixturesRes.ok || !seleccionesRes.ok) {
    throw new Error("No se pudo cargar la tabla de resultados.");
  }

  const [fixturesRaw, seleccionesRaw] = await Promise.all([fixturesRes.text(), seleccionesRes.text()]);
  const fixturesById = new Map<string, ScoreFixture>();
  const selectionByToken = new Map<string, string>();
  const groupStandings = new Map<string, OfficialGroupStanding[]>();

  const fixtureLines = parseLines(fixturesRaw);
  if (fixtureLines.length < 2) throw new Error("Tabla de partidos vacia.");
  const fixtureHeaders = fixtureLines[0].split("\t").map((h) => h.trim().toLowerCase());
  const idxFixtureId = fixtureHeaders.findIndex((h) => h === "id_partido");
  const idxWinnerId = fixtureHeaders.findIndex((h) => h === "ganador_id");
  const idxHomeScore = fixtureHeaders.findIndex((h) =>
    ["gol_local", "gollocal", "homescore", "home_score", "score_home", "local_score", "homegoals"].includes(h),
  );
  const idxAwayScore = fixtureHeaders.findIndex((h) =>
    ["gol_visita", "golvisita", "awayscore", "away_score", "score_away", "visit_score", "awaygoals"].includes(h),
  );
  const idxHomePenalty = fixtureHeaders.findIndex((h) =>
    ["penal_local", "penales_local", "penaleslocal", "penaltyhome", "homepenalty", "home_penalty", "penalty_home", "penalties_home", "homepenalties", "pen_local"].includes(h),
  );
  const idxAwayPenalty = fixtureHeaders.findIndex((h) =>
    ["penal_visita", "penales_visita", "penalesvisita", "penaltyaway", "awaypenalty", "away_penalty", "penalty_away", "penalties_away", "awaypenalties", "pen_visita"].includes(h),
  );
  if (idxFixtureId < 0 || idxWinnerId < 0) {
    throw new Error("No se encontraron columnas de resultados en partidos-mundial.");
  }
  for (let i = 1; i < fixtureLines.length; i++) {
    const row = fixtureLines[i].split("\t");
    const fixtureId = normalizeKey(row[idxFixtureId]);
    if (!fixtureId) continue;
    fixturesById.set(fixtureId, {
      fixtureId,
      winnerId: normalizeKey(row[idxWinnerId]),
      homeScore: idxHomeScore >= 0 ? readNumber({ value: row[idxHomeScore] }, ["value"]) : null,
      awayScore: idxAwayScore >= 0 ? readNumber({ value: row[idxAwayScore] }, ["value"]) : null,
      homePenaltyScore: idxHomePenalty >= 0 ? readNumber({ value: row[idxHomePenalty] }, ["value"]) : null,
      awayPenaltyScore: idxAwayPenalty >= 0 ? readNumber({ value: row[idxAwayPenalty] }, ["value"]) : null,
    });
  }

  const selectionLines = parseLines(seleccionesRaw);
  if (selectionLines.length >= 2) {
    const headers = parseCSVLine(selectionLines[0]).map((h) => h.trim().toLowerCase());
    const idxId = headers.findIndex((h) => h === "id");
    const idxCode = headers.findIndex((h) => h.includes("codigo_fixture"));
    const idxSelection = headers.findIndex((h) => h === "seleccion");
    for (let i = 1; i < selectionLines.length; i++) {
      const cols = parseCSVLine(selectionLines[i]);
      const selection = (cols[idxSelection] || "").trim();
      if (!selection) continue;
      const id = normalizeKey(cols[idxId]);
      const code = normalizeKey(cols[idxCode]);
      if (id) selectionByToken.set(id, selection);
      if (code) selectionByToken.set(code, selection);
      selectionByToken.set(normalizeKey(selection), selection);
    }
  }

  return { fixturesById, selectionByToken, groupStandings };
};

const resolveTabForIds = (pickId: string, fixtureId: string): ScoreTab => {
  const pickKey = normalizeKey(pickId);
  const fixtureKey = normalizeKey(fixtureId);

  if (pickKey.startsWith("INT-") || pickKey.startsWith("UEFA")) return "repechajes";
  if (fixtureKey.startsWith("RI") || fixtureKey.startsWith("RA") || fixtureKey.startsWith("RB") || fixtureKey.startsWith("RC") || fixtureKey.startsWith("RD")) {
    return "repechajes";
  }
  if (pickKey.startsWith("R32-") || pickKey.startsWith("R16-")) return "dieciseisavos";
  if (pickKey.startsWith("QF-") || pickKey.startsWith("SF-") || pickKey.startsWith("THIRD-") || pickKey.startsWith("FINAL-")) {
    return "llaves";
  }

  const fixtureNum = parseFixtureNumericId(fixtureKey);
  if (fixtureNum !== null) {
    if (fixtureNum >= 1 && fixtureNum <= 72) return "grupos";
    if (fixtureNum >= 73 && fixtureNum <= 88) return "dieciseisavos";
    if (fixtureNum >= 89 && fixtureNum <= 104) return "llaves";
  }

  return "grupos";
};

const isScoreTabEnabled = (tab: ScoreTab, options?: BracketScoreOptions) =>
  options?.enabledTabs?.[tab] !== false;

export const loadScoreSheetData = async (): Promise<ScoreSheetData> => {
  if (scoreSheetCachePromise) return scoreSheetCachePromise;

  scoreSheetCachePromise = (async () => {
    const [telegrafoData, fallbackData, playoffSheetData] = await Promise.all([
      loadRemoteTelegrafoScoreData().catch(() => null),
      loadFallbackScoreSheetData().catch(() => null),
      loadPlayoffScoreSheetData().catch(() => null),
    ]);
    const localTelegrafoData = buildTelegrafoScoreData(
      localTeamsPayload,
      localStandingsPayload,
      localMatchesPayload,
      localPlayoffPayload,
    );
    const merged = mergeScoreData(fallbackData, localTelegrafoData, telegrafoData, playoffSheetData);
    const authoritativeFixtures = [telegrafoData, localTelegrafoData, fallbackData]
      .find((source) => source && source.fixturesById.size > 0)
      ?.fixturesById;
    if ((!authoritativeFixtures || authoritativeFixtures.size === 0) && !playoffSheetData?.fixturesById.size) {
      throw new Error("No se pudo cargar la tabla de resultados.");
    }
    const fixturesById = new Map(authoritativeFixtures || []);
    Array.from(fixturesById.keys()).forEach((fixtureId) => {
      if (isPlayoffFixtureId(fixtureId)) fixturesById.delete(fixtureId);
    });
    playoffSheetData?.fixturesById.forEach((fixture, fixtureId) => {
      fixturesById.set(fixtureId, fixture);
    });
    return {
      fixturesById,
      selectionByToken: merged.selectionByToken,
      groupStandings: telegrafoData?.groupStandings.size
        ? telegrafoData.groupStandings
        : localTelegrafoData?.groupStandings || merged.groupStandings,
    };
  })().catch((error) => {
    scoreSheetCachePromise = null;
    throw error;
  });

  return scoreSheetCachePromise;
};

const completeMissingOfficialPicks = (
  picks: Record<string, string | undefined>,
  sheetData: ScoreSheetData,
  acceptsPickId: (pickId: string) => boolean,
) => {
  const completed = { ...(picks || {}) };
  sheetData.fixturesById.forEach((fixture, fixtureAlias) => {
    const pickId = resolvePickIdFromFixture(fixtureAlias);
    if (!pickId || !acceptsPickId(pickId) || completed[pickId]) return;
    const winnerId = normalizeKey(fixture.winnerId);
    if (!winnerId || winnerId === "EMPATE" || winnerId.includes("/")) return;
    completed[pickId] = winnerId;
  });
  return completed;
};

const completeMissingOfficialScores = (
  predictions: ScorePredictionState,
  sheetData: ScoreSheetData,
  penalties = false,
) => {
  const completed = { ...(predictions || {}) };
  sheetData.fixturesById.forEach((fixture, fixtureAlias) => {
    const predictionId = resolveScorePredictionIdFromFixture(fixtureAlias);
    if (!predictionId) return;
    const current = completed[predictionId];
    if (typeof current?.home === "number" && typeof current?.away === "number") return;
    const home = penalties ? fixture.homePenaltyScore : fixture.homeScore;
    const away = penalties ? fixture.awayPenaltyScore : fixture.awayScore;
    if (typeof home !== "number" || typeof away !== "number") return;
    completed[predictionId] = { home, away };
  });
  return completed;
};

const isOfficialGroupStageComplete = (sheetData: ScoreSheetData) =>
  sheetData.groupStandings.size === 12 &&
  Array.from(sheetData.groupStandings.values()).every(
    (group) => group.length === 4 && group.every((team) => team.played >= 3),
  );

const resolveOfficialBestThirds = (sheetData: ScoreSheetData) =>
  Array.from(sheetData.groupStandings.values())
    .map((group) => group[2])
    .filter((team): team is OfficialGroupStanding => !!team)
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.goalDifference - a.goalDifference ||
        b.goalsFor - a.goalsFor ||
        b.wins - a.wins ||
        a.group.localeCompare(b.group, "es"),
    )
    .slice(0, 8);

const completeMissingOfficialGroupPicks = (
  input: BracketScoreInput,
  sheetData: ScoreSheetData,
): Pick<BracketScoreInput, "selections" | "bestThirdIds"> => {
  const selections = { ...(input.selections || {}) };
  const bestThirdIds = [...(input.bestThirdIds || [])];
  if (!isOfficialGroupStageComplete(sheetData)) return { selections, bestThirdIds };

  sheetData.groupStandings.forEach((standing, group) => {
    const current = selections[group] || {};
    selections[group] = {
      primeroId: current.primeroId || standing[0]?.teamId,
      segundoId: current.segundoId || standing[1]?.teamId,
      terceroId: current.terceroId || standing[2]?.teamId,
    };
  });

  const selected = new Set(
    bestThirdIds.map((teamId) => resolveComparableSelection(teamId, sheetData.selectionByToken)),
  );
  resolveOfficialBestThirds(sheetData).forEach((team) => {
    const comparable = resolveComparableSelection(team.teamId, sheetData.selectionByToken);
    if (bestThirdIds.length >= 8 || selected.has(comparable)) return;
    bestThirdIds.push(team.teamId);
    selected.add(comparable);
  });

  return { selections, bestThirdIds };
};

export const applyOfficialResultsToBracketScoreInput = (
  input: BracketScoreInput,
  sheetData: ScoreSheetData,
): BracketScoreInput => {
  const completedGroups = completeMissingOfficialGroupPicks(input, sheetData);
  return {
    ...input,
    ...completedGroups,
    picks: completeMissingOfficialPicks(input.picks, sheetData, (pickId) => !pickId.startsWith("INT-") && !pickId.startsWith("UEFA")),
    intercontinentalPicks: completeMissingOfficialPicks(input.intercontinentalPicks, sheetData, (pickId) => pickId.startsWith("INT-")),
    uefaPicks: completeMissingOfficialPicks(input.uefaPicks, sheetData, (pickId) => pickId.startsWith("UEFA")),
  };
};

export const applyOfficialResultsToFullScoreInput = (
  input: FullBracketScoreInput,
  sheetData: ScoreSheetData,
): FullBracketScoreInput => {
  const completedBase = applyOfficialResultsToBracketScoreInput(input, sheetData);
  return {
    ...input,
    ...completedBase,
    scorePredictions: completeMissingOfficialScores(input.scorePredictions, sheetData),
    penaltyPredictions: completeMissingOfficialScores(input.penaltyPredictions || {}, sheetData, true),
  };
};

export const computeBracketScore = (
  input: BracketScoreInput,
  sheetData: ScoreSheetData,
  options: BracketScoreOptions = {},
): BracketScoreSummary => {
  const allPickEntries: Array<{ pickId: string; pickWinnerToken: string }> = [];
  Object.entries(input.picks || {}).forEach(([pickId, pickWinnerToken]) => {
    if (!pickWinnerToken) return;
    allPickEntries.push({ pickId, pickWinnerToken });
  });
  Object.entries(input.intercontinentalPicks || {}).forEach(([pickId, pickWinnerToken]) => {
    if (!pickWinnerToken) return;
    allPickEntries.push({ pickId, pickWinnerToken });
  });
  Object.entries(input.uefaPicks || {}).forEach(([pickId, pickWinnerToken]) => {
    if (!pickWinnerToken) return;
    allPickEntries.push({ pickId, pickWinnerToken });
  });

  const pointsByTab: Record<ScoreTab, number> = {
    repechajes: 0,
    grupos: 0,
    dieciseisavos: 0,
    llaves: 0,
  };
  const pointsByMatchId: Record<string, number> = {};

  let hitCount = 0;
  let evaluatedCount = 0;
  let groupPositionHitCount = 0;
  let bestThirdHitCount = 0;
  for (const { pickId, pickWinnerToken } of allPickEntries) {
    const fixtureId = resolveFixtureIdFromPick(pickId);
    if (!fixtureId) continue;
    const fixture = sheetData.fixturesById.get(fixtureId);
    if (!fixture) continue;
    const tab = resolveTabForIds(pickId, fixture.fixtureId);
    if (!isScoreTabEnabled(tab, options)) continue;

    const winnerToken = normalizeKey(fixture.winnerId);
    if (!winnerToken || winnerToken === "EMPATE" || winnerToken.includes("/")) continue;
    evaluatedCount += 1;

    const expected = resolveComparableSelection(winnerToken, sheetData.selectionByToken);
    const predicted = resolveComparableSelection(pickWinnerToken, sheetData.selectionByToken);
    if (!expected || !predicted || expected !== predicted) continue;

    pointsByTab[tab] += POINTS_PER_HIT;
    pointsByMatchId[pickId] = (pointsByMatchId[pickId] || 0) + POINTS_PER_HIT;
    hitCount += 1;
  }

  if (isScoreTabEnabled("grupos", options) && isOfficialGroupStageComplete(sheetData)) {
    const slots = [
      ["primeroId", 0],
      ["segundoId", 1],
      ["terceroId", 2],
    ] as const;
    sheetData.groupStandings.forEach((standing, group) => {
      slots.forEach(([slot, position]) => {
        const predicted = input.selections?.[group]?.[slot];
        const actual = standing[position]?.teamId;
        if (!predicted || !actual) return;
        evaluatedCount += 1;
        if (
          resolveComparableSelection(predicted, sheetData.selectionByToken) !==
          resolveComparableSelection(actual, sheetData.selectionByToken)
        ) {
          return;
        }
        const key = `grupo-${group.toLowerCase()}-${slot.replace("Id", "")}`;
        pointsByTab.grupos += POINTS_PER_HIT;
        pointsByMatchId[key] = POINTS_PER_HIT;
        hitCount += 1;
        groupPositionHitCount += 1;
      });
    });

    const officialBestThirds = new Set(
      resolveOfficialBestThirds(sheetData).map((team) =>
        resolveComparableSelection(team.teamId, sheetData.selectionByToken),
      ),
    );
    (input.bestThirdIds || []).slice(0, 8).forEach((predicted, index) => {
      evaluatedCount += 1;
      const comparable = resolveComparableSelection(predicted, sheetData.selectionByToken);
      if (!comparable || !officialBestThirds.has(comparable)) return;
      const key = `mejor-tercero-${index + 1}`;
      pointsByTab.grupos += POINTS_PER_HIT;
      pointsByMatchId[key] = POINTS_PER_HIT;
      hitCount += 1;
      bestThirdHitCount += 1;
    });
  }

  const totalPoints = pointsByTab.repechajes + pointsByTab.grupos + pointsByTab.dieciseisavos + pointsByTab.llaves;
  return {
    totalPoints,
    hitCount,
    evaluatedCount,
    pointsByTab,
    pointsByMatchId,
    groupPositionHitCount,
    bestThirdHitCount,
  };
};

export const computeFullBracketScore = (
  input: FullBracketScoreInput,
  sheetData: ScoreSheetData,
): BracketScoreSummary => {
  const pointsByTab: Record<ScoreTab, number> = {
    repechajes: 0,
    grupos: 0,
    dieciseisavos: 0,
    llaves: 0,
  };
  const pointsByMatchId: Record<string, number> = {};
  let evaluatedCount = 0;
  let exactCount = 0;
  let winnerCount = 0;
  let goalCount = 0;
  let penaltyExactCount = 0;

  Object.entries(input.scorePredictions || {}).forEach(([predictionId, prediction]) => {
    if (
      !prediction ||
      typeof prediction.home !== "number" ||
      typeof prediction.away !== "number"
    ) {
      return;
    }

    const fixtureId = resolveFixtureIdFromPick(predictionId) || normalizeKey(predictionId);
    const fixture = sheetData.fixturesById.get(fixtureId);
    if (!fixture) return;
    const actualHome = fixture.homeScore;
    const actualAway = fixture.awayScore;
    if (typeof actualHome !== "number" || typeof actualAway !== "number") return;

    evaluatedCount += 1;
    const tab = resolveTabForIds(predictionId, fixture.fixtureId);
    const exact = prediction.home === actualHome && prediction.away === actualAway;
    let points = 0;

    if (exact) {
      points += FULL_POINTS.exactScore;
      exactCount += 1;
    } else {
      const predictedWinner =
        prediction.home === prediction.away ? "EMPATE" : prediction.home > prediction.away ? "HOME" : "AWAY";
      const actualWinner = actualHome === actualAway ? "EMPATE" : actualHome > actualAway ? "HOME" : "AWAY";
      if (predictedWinner === actualWinner) {
        points += FULL_POINTS.winner;
        winnerCount += 1;
      }
      if (prediction.home === actualHome) {
        points += FULL_POINTS.goal;
        goalCount += 1;
      }
      if (prediction.away === actualAway) {
        points += FULL_POINTS.goal;
        goalCount += 1;
      }
    }

    if (points > 0) {
      pointsByTab[tab] += points;
      pointsByMatchId[predictionId] = (pointsByMatchId[predictionId] || 0) + points;
    }

    const actualWentToPenalties =
      actualHome === actualAway &&
      typeof fixture.homePenaltyScore === "number" &&
      typeof fixture.awayPenaltyScore === "number";
    const penaltyPrediction = input.penaltyPredictions?.[predictionId];
    const exactPenalty =
      actualWentToPenalties &&
      typeof penaltyPrediction?.home === "number" &&
      typeof penaltyPrediction?.away === "number" &&
      penaltyPrediction.home === fixture.homePenaltyScore &&
      penaltyPrediction.away === fixture.awayPenaltyScore;
    if (exactPenalty) {
      pointsByTab[tab] += FULL_POINTS.exactPenalty;
      pointsByMatchId[predictionId] = (pointsByMatchId[predictionId] || 0) + FULL_POINTS.exactPenalty;
      penaltyExactCount += 1;
    }
  });

  const addAllCorrectBonus = (
    pickIds: string[],
    expectedCount: number,
    points: number,
    tab: ScoreTab,
    bonusKey: string,
  ) => {
    if (pickIds.length !== expectedCount) return;
    const allCorrect = pickIds.every((pickId) => {
      const predicted = input.picks?.[pickId];
      if (!predicted) return false;
      const fixtureId = resolveFixtureIdFromPick(pickId);
      if (!fixtureId) return false;
      const fixture = sheetData.fixturesById.get(fixtureId);
      if (!fixture?.winnerId || fixture.winnerId === "EMPATE") return false;
      const actual = resolveComparableSelection(fixture.winnerId, sheetData.selectionByToken);
      const expected = resolveComparableSelection(predicted, sheetData.selectionByToken);
      return !!actual && !!expected && actual === expected;
    });
    if (!allCorrect) return;
    pointsByTab[tab] += points;
    pointsByMatchId[bonusKey] = (pointsByMatchId[bonusKey] || 0) + points;
  };

  const pickKeys = Object.keys(input.picks || {});
  addAllCorrectBonus(
    pickKeys.filter((id) => /^r32-/i.test(id)),
    16,
    FULL_POINTS.roundOf16Bonus,
    "dieciseisavos",
    "bonus-octavos",
  );
  addAllCorrectBonus(
    pickKeys.filter((id) => /^r16-/i.test(id)),
    8,
    FULL_POINTS.quarterBonus,
    "llaves",
    "bonus-cuartos",
  );
  addAllCorrectBonus(
    pickKeys.filter((id) => /^qf-/i.test(id)),
    4,
    FULL_POINTS.semifinalBonus,
    "llaves",
    "bonus-semifinal",
  );
  addAllCorrectBonus(
    ["final-104"].filter((id) => input.picks?.[id]),
    1,
    FULL_POINTS.finalBonus,
    "llaves",
    "bonus-final",
  );

  const totalPoints = pointsByTab.repechajes + pointsByTab.grupos + pointsByTab.dieciseisavos + pointsByTab.llaves;
  return {
    totalPoints,
    hitCount: exactCount + winnerCount + goalCount + penaltyExactCount,
    evaluatedCount,
    pointsByTab,
    pointsByMatchId,
    exactCount,
    winnerCount,
    goalCount,
    penaltyExactCount,
    uniqueExactCount: 0,
  };
};

export const useBracketScore = (input: BracketScoreInput, enabled = true) => {
  const [sheetData, setSheetData] = useState<ScoreSheetData | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      setError(null);
      setSheetData(null);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);
    loadScoreSheetData()
      .then((data) => {
        if (!active) return;
        setSheetData(data);
      })
      .catch(() => {
        if (!active) return;
        setError("No pudimos calcular el puntaje.");
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [enabled]);

  const summary = useMemo(() => {
    if (!enabled || !sheetData) return null;
    return computeBracketScore(input, sheetData);
  }, [enabled, input, sheetData]);

  return { summary, loading, error };
};

export const useFullBracketScore = (input: FullBracketScoreInput, enabled = true) => {
  const [sheetData, setSheetData] = useState<ScoreSheetData | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      setError(null);
      setSheetData(null);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);
    loadScoreSheetData()
      .then((data) => {
        if (!active) return;
        setSheetData(data);
      })
      .catch(() => {
        if (!active) return;
        setError("No pudimos calcular el puntaje.");
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [enabled]);

  const summary = useMemo(() => {
    if (!enabled || !sheetData) return null;
    return computeFullBracketScore(input, sheetData);
  }, [enabled, input, sheetData]);

  return { summary, loading, error };
};
