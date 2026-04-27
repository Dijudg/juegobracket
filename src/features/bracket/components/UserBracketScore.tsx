import { useEffect, useMemo, useState } from "react";
import type { BracketSavePayload } from "../types";

type UserBracketScoreProps = {
  payload?: BracketSavePayload;
};

type ScoreFixture = {
  fixtureId: string;
  winnerId: string;
  homeId: string;
  awayId: string;
  phase: string;
  date: string;
};

type ScoreSheetData = {
  fixturesById: Map<string, ScoreFixture>;
  selectionByToken: Map<string, string>;
};

type HitMatch = {
  key: string;
  fixtureId: string;
  label: string;
  phase: string;
  date: string;
  homeName: string;
  awayName: string;
  winnerName: string;
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
const FIXTURE_LABELS: Record<string, string> = {
  RI1: "Repechaje Internacional semifinal llave 1",
  RI2: "Repechaje Internacional final llave 1",
  RI3: "Repechaje Internacional semifinal llave 2",
  RI4: "Repechaje Internacional final llave 2",
  RA1: "Repechaje UEFA ruta A semifinal 1",
  RA2: "Repechaje UEFA ruta A semifinal 2",
  RA3: "Repechaje UEFA ruta A final",
  RB1: "Repechaje UEFA ruta B semifinal 1",
  RB2: "Repechaje UEFA ruta B semifinal 2",
  RB3: "Repechaje UEFA ruta B final",
  RC1: "Repechaje UEFA ruta C semifinal 1",
  RC2: "Repechaje UEFA ruta C semifinal 2",
  RC3: "Repechaje UEFA ruta C final",
  RD1: "Repechaje UEFA ruta D semifinal 1",
  RD2: "Repechaje UEFA ruta D semifinal 2",
  RD3: "Repechaje UEFA ruta D final",
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

const resolveFixtureLabel = (fixtureId: string) => {
  const key = normalizeKey(fixtureId);
  return FIXTURE_LABELS[key] || `Partido ${fixtureId}`;
};

const resolveComparableSelection = (token: string, map: Map<string, string>) =>
  normalizeComparable(resolveSelectionLabel(token, map));

const getNumericFixtureOrder = (fixtureId: string) => {
  const n = Number.parseInt(fixtureId.replace(/[^\d]/g, ""), 10);
  return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER;
};

const loadScoreSheetData = async (): Promise<ScoreSheetData> => {
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
    if (fixtureLines.length < 2) throw new Error("Tabla de partidos vacía.");
    const fixtureHeaders = fixtureLines[0].split("\t").map((h) => h.trim().toLowerCase());
    const idxFixtureId = fixtureHeaders.findIndex((h) => h === "id_partido");
    const idxWinnerId = fixtureHeaders.findIndex((h) => h === "ganador_id");
    const idxHomeId = fixtureHeaders.findIndex((h) => h === "local_id");
    const idxAwayId = fixtureHeaders.findIndex((h) => h === "visita_id");
    const idxPhase = fixtureHeaders.findIndex((h) => h === "fase");
    const idxDate = fixtureHeaders.findIndex((h) => h === "fecha");
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
        homeId: normalizeKey(row[idxHomeId]),
        awayId: normalizeKey(row[idxAwayId]),
        phase: (row[idxPhase] || "").trim(),
        date: (row[idxDate] || "").trim(),
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
        const normalizedSelection = selection.trim();
        if (id) selectionByToken.set(id, normalizedSelection);
        if (code) selectionByToken.set(code, normalizedSelection);
        selectionByToken.set(normalizeKey(normalizedSelection), normalizedSelection);
      }
    }

    return { fixturesById, selectionByToken };
  })().catch((error) => {
    scoreSheetCachePromise = null;
    throw error;
  });

  return scoreSheetCachePromise;
};

export const UserBracketScore = ({ payload }: UserBracketScoreProps) => {
  const [sheetData, setSheetData] = useState<ScoreSheetData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    loadScoreSheetData()
      .then((data) => {
        if (!active) return;
        setSheetData(data);
        setLoadError(null);
      })
      .catch(() => {
        if (!active) return;
        setLoadError("No pudimos calcular el puntaje.");
      });
    return () => {
      active = false;
    };
  }, []);

  const summary = useMemo(() => {
    if (!payload || !sheetData) return null;
    const allPickEntries: Array<{ pickId: string; pickWinnerToken: string }> = [];
    Object.entries(payload.picks || {}).forEach(([pickId, pickWinnerToken]) => {
      if (!pickWinnerToken) return;
      allPickEntries.push({ pickId, pickWinnerToken });
    });
    Object.entries(payload.intercontinentalPicks || {}).forEach(([pickId, pickWinnerToken]) => {
      if (!pickWinnerToken) return;
      allPickEntries.push({ pickId, pickWinnerToken });
    });
    Object.entries(payload.uefaPicks || {}).forEach(([pickId, pickWinnerToken]) => {
      if (!pickWinnerToken) return;
      allPickEntries.push({ pickId, pickWinnerToken });
    });
    const hits: HitMatch[] = [];
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

      hits.push({
        key: `${pickId}-${fixture.fixtureId}`,
        fixtureId: fixture.fixtureId,
        label: resolveFixtureLabel(fixture.fixtureId),
        phase: fixture.phase,
        date: fixture.date,
        homeName: resolveSelectionLabel(fixture.homeId, sheetData.selectionByToken) || fixture.homeId || "--",
        awayName: resolveSelectionLabel(fixture.awayId, sheetData.selectionByToken) || fixture.awayId || "--",
        winnerName: resolveSelectionLabel(fixture.winnerId, sheetData.selectionByToken) || fixture.winnerId || "--",
      });
    }

    hits.sort((a, b) => getNumericFixtureOrder(a.fixtureId) - getNumericFixtureOrder(b.fixtureId));

    return {
      hits,
      evaluatedCount,
      totalPoints: hits.length * POINTS_PER_HIT,
    };
  }, [payload, sheetData]);

  if (!payload) return null;

  if (loadError) {
    return (
      <div className="mt-3 w-full rounded-lg border border-red-500/40 bg-black/50 p-3 text-left">
        <p className="text-xs text-red-300">{loadError}</p>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="mt-3 w-full rounded-lg border border-neutral-700 bg-black/50 p-3 text-left">
        <p className="text-xs text-gray-400">Calculando puntaje...</p>
      </div>
    );
  }

  return (
    <div className="mt-3 w-full rounded-lg border border-neutral-700 bg-black/50 p-3 text-left">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs uppercase tracking-wide text-gray-400">Puntaje</span>
        <span className="text-xl font-black text-[#c6f600]">{summary.totalPoints} pts</span>
      </div>
      <p className="mt-1 text-xs text-gray-400">
        Aciertos: {summary.hits.length} / {summary.evaluatedCount} partidos evaluados.
      </p>

      {summary.hits.length > 0 ? (
        <div className="mt-3 grid gap-2">
          {summary.hits.map((hit) => (
            <div key={hit.key} className="modal-glow rounded-md border border-[#c6f600]/30 bg-black/70 p-2">
              <p className="text-xs font-semibold text-[#c6f600]">{hit.label}: +3 puntos por acierto</p>
              <p className="text-xs text-gray-200">
                {hit.homeName} vs {hit.awayName}
              </p>
              <p className="text-xs text-gray-400">
                Ganador oficial: {hit.winnerName}
                {hit.phase ? ` · ${hit.phase}` : ""}
                {hit.date ? ` · ${hit.date}` : ""}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-xs text-gray-400">
          Aún no tienes aciertos en partidos con resultado oficial.
        </p>
      )}
    </div>
  );
};
