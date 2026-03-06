import { useEffect, useMemo, useState } from "react";
import type { PlayoffPickState } from "./types";

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

    const winnerToken = normalizeKey(fixture.winnerId);
    if (!winnerToken || winnerToken === "EMPATE" || winnerToken.includes("/")) continue;
    evaluatedCount += 1;

    const expected = resolveComparableSelection(winnerToken, sheetData.selectionByToken);
    const predicted = resolveComparableSelection(pickWinnerToken, sheetData.selectionByToken);
    if (!expected || !predicted || expected !== predicted) continue;

    const tab = resolveTabForIds(pickId, fixture.fixtureId);
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
