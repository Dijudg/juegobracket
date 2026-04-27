import { useEffect, useMemo, useState } from "react";
import type { PlayoffPickState } from "./types";
import localTeamsPayload from "../../data/teams.json";
import localStandingsPayload from "../../data/standings.json";
import localMatchesPayload from "../../data/matches.json";
import localPlayoffPayload from "../../data/playoff-match-snapshots.json";

export type BracketScoreInput = {
  picks: Record<string, string | undefined>;
  intercontinentalPicks: PlayoffPickState;
  uefaPicks: PlayoffPickState;
};

type ScoreFixture = {
  fixtureId: string;
  winnerId: string;
};

export type ScoreSheetData = {
  fixturesById: Map<string, ScoreFixture>;
  selectionByToken: Map<string, string>;
};

export type ScoreTab = "repechajes" | "grupos" | "dieciseisavos" | "llaves";

export type BracketScoreSummary = {
  totalPoints: number;
  hitCount: number;
  evaluatedCount: number;
  pointsByTab: Record<ScoreTab, number>;
  pointsByMatchId: Record<string, number>;
};

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
  if (/^P\d+$/.test(key)) return key;
  return null;
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
  "LIGUILLA-UEFA-RUTA-B-SF-1": { fixtureId: "RB1", home: "UKR", away: "SWE" },
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

const resolveWinnerFromScores = (row: Record<string, any>) => {
  const homeScore = readNumber(row, ["gol_local", "golLocal", "homeScore", "home_score", "score_home", "local_score", "homeGoals"]);
  const awayScore = readNumber(row, ["gol_visita", "golVisita", "awayScore", "away_score", "score_away", "visit_score", "awayGoals"]);
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

const registerFixtureAliases = (map: Map<string, ScoreFixture>, fixtureId: string, winnerId: string) => {
  const normalizedFixtureId = normalizeKey(fixtureId);
  const normalizedWinnerId = normalizeKey(winnerId);
  if (!normalizedFixtureId || !normalizedWinnerId) return;
  const fixture: ScoreFixture = { fixtureId: normalizedFixtureId, winnerId: normalizedWinnerId };
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

  const homeId = firstValue(row, ["local_id", "home_id", "homeTeamId", "home_team_id", "homeTeamCode"]);
  const awayId = firstValue(row, ["visita_id", "away_id", "awayTeamId", "away_team_id", "awayTeamCode"]);
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
  registerFixtureAliases(fixturesById, fixtureId, winnerId);
  fixtureAliases.forEach((alias) => registerFixtureAliases(fixturesById, alias, winnerId));
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
  });
  unwrapArray(matchesPayload, ["matches", "fixtures", "data", "items"]).forEach((match, index) => {
    registerMatchLikeRow(fixturesById, selectionByToken, match, [`P${index + 1}`]);
  });
  const playoffRows = unwrapArray(playoffPayload, ["snapshots", "matches", "fixtures", "data", "items"]);
  registerPlayoffSnapshotRows(fixturesById, playoffRows);
  playoffRows.forEach((match) => {
    registerMatchLikeRow(fixturesById, selectionByToken, match);
  });

  if (fixturesById.size === 0 && selectionByToken.size === 0) return null;
  return { fixturesById, selectionByToken };
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
  sources.forEach((source) => {
    source?.selectionByToken.forEach((value, key) => selectionByToken.set(key, value));
    source?.fixturesById.forEach((value, key) => fixturesById.set(key, value));
  });
  return { fixturesById, selectionByToken };
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

  const fixtureLines = parseLines(fixturesRaw);
  if (fixtureLines.length < 2) throw new Error("Tabla de partidos vacia.");
  const fixtureHeaders = fixtureLines[0].split("\t").map((h) => h.trim().toLowerCase());
  const idxFixtureId = fixtureHeaders.findIndex((h) => h === "id_partido");
  const idxWinnerId = fixtureHeaders.findIndex((h) => h === "ganador_id");
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

  return { fixturesById, selectionByToken };
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

export const loadScoreSheetData = async (): Promise<ScoreSheetData> => {
  if (scoreSheetCachePromise) return scoreSheetCachePromise;

  scoreSheetCachePromise = (async () => {
    const [telegrafoData, fallbackData] = await Promise.all([
      loadRemoteTelegrafoScoreData().catch(() => null),
      loadFallbackScoreSheetData().catch(() => null),
    ]);
    const localTelegrafoData = buildTelegrafoScoreData(
      localTeamsPayload,
      localStandingsPayload,
      localMatchesPayload,
      localPlayoffPayload,
    );
    const merged = mergeScoreData(fallbackData, telegrafoData, localTelegrafoData);
    if (merged.fixturesById.size === 0) {
      throw new Error("No se pudo cargar la tabla de resultados.");
    }
    return merged;
  })().catch((error) => {
    scoreSheetCachePromise = null;
    throw error;
  });

  return scoreSheetCachePromise;
};

export const computeBracketScore = (input: BracketScoreInput, sheetData: ScoreSheetData): BracketScoreSummary => {
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
  for (const { pickId, pickWinnerToken } of allPickEntries) {
    const fixtureId = resolveFixtureIdFromPick(pickId);
    if (!fixtureId) continue;
    const fixture = sheetData.fixturesById.get(fixtureId);
    if (!fixture) continue;
    const tab = resolveTabForIds(pickId, fixture.fixtureId);

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

  const totalPoints = pointsByTab.repechajes + pointsByTab.grupos + pointsByTab.dieciseisavos + pointsByTab.llaves;
  return { totalPoints, hitCount, evaluatedCount, pointsByTab, pointsByMatchId };
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
