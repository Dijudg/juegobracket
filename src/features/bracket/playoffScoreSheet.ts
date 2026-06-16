const WORLD_FIXTURES_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRi2qMMbibzuc4bjv38DBJYnfY24e4Mt0c20CqpDDFzgBn_aJ6NR0HcrXjdbKLhAEsy3zJUdvr3npRU/pub?gid=171585554&single=true&output=tsv";
const SELECCIONES_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRi2qMMbibzuc4bjv38DBJYnfY24e4Mt0c20CqpDDFzgBn_aJ6NR0HcrXjdbKLhAEsy3zJUdvr3npRU/pub?gid=0&single=true&output=csv";

type PlayoffScoreFixture = {
  fixtureId: string;
  winnerId: string;
  homeId?: string;
  awayId?: string;
  homeScore?: number | null;
  awayScore?: number | null;
  homePenaltyScore?: number | null;
  awayPenaltyScore?: number | null;
};

export type PlayoffScoreSheetData = {
  fixturesById: Map<string, PlayoffScoreFixture>;
  selectionByToken: Map<string, string>;
  groupStandings: Map<string, never[]>;
};

const PLAYOFF_FIXTURE_RE = /^(RI|RA|RB|RC|RD)\d+$/;
const TEAM_ALIASES: Record<string, string> = {
  SWE: "SUE",
  NRL: "NIR",
};

export const isPlayoffFixtureId = (fixtureId?: string) => PLAYOFF_FIXTURE_RE.test(normalizeKey(fixtureId));

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

const canonicalTeamCode = (value?: string) => {
  const code = normalizeKey(value);
  return TEAM_ALIASES[code] || code;
};

const registerSelectionToken = (map: Map<string, string>, rawToken?: string, rawLabel?: string) => {
  const token = normalizeKey(rawToken);
  const label = (rawLabel || rawToken || "").trim();
  if (!token || !label) return;

  map.set(token, label);
  map.set(normalizeComparable(label), label);

  const canonical = canonicalTeamCode(token);
  if (canonical && canonical !== token) map.set(canonical, label);
  Object.entries(TEAM_ALIASES).forEach(([alias, target]) => {
    if (target === token || target === canonical) map.set(alias, label);
  });
};

const readMainScore = (value?: string) => {
  const match = (value || "").trim().match(/^-?\d+/);
  if (!match) return null;
  const n = Number.parseInt(match[0], 10);
  return Number.isFinite(n) ? n : null;
};

const readPenaltyScore = (value?: string) => {
  const match = (value || "").trim().match(/\((\d+)\)/);
  if (!match) return null;
  const n = Number.parseInt(match[1], 10);
  return Number.isFinite(n) ? n : null;
};

const winnerFromScores = (
  homeId: string,
  awayId: string,
  homeRaw?: string,
  awayRaw?: string,
) => {
  const homeScore = readMainScore(homeRaw);
  const awayScore = readMainScore(awayRaw);
  if (homeScore === null || awayScore === null) return "";
  if (homeScore > awayScore) return homeId;
  if (awayScore > homeScore) return awayId;

  const homePenaltyScore = readPenaltyScore(homeRaw);
  const awayPenaltyScore = readPenaltyScore(awayRaw);
  if (homePenaltyScore === null || awayPenaltyScore === null) return "EMPATE";
  if (homePenaltyScore > awayPenaltyScore) return homeId;
  if (awayPenaltyScore > homePenaltyScore) return awayId;
  return "EMPATE";
};

export const loadPlayoffScoreSheetData = async (): Promise<PlayoffScoreSheetData> => {
  const [fixturesRes, seleccionesRes] = await Promise.all([
    fetch(WORLD_FIXTURES_URL),
    fetch(SELECCIONES_URL),
  ]);
  if (!fixturesRes.ok || !seleccionesRes.ok) {
    throw new Error("No se pudo cargar la tabla de repechajes.");
  }

  const [fixturesRaw, seleccionesRaw] = await Promise.all([fixturesRes.text(), seleccionesRes.text()]);
  const fixturesById = new Map<string, PlayoffScoreFixture>();
  const selectionByToken = new Map<string, string>();
  const groupStandings = new Map<string, never[]>();

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
      registerSelectionToken(selectionByToken, cols[idxId], selection);
      registerSelectionToken(selectionByToken, cols[idxCode], selection);
      registerSelectionToken(selectionByToken, selection, selection);
    }
  }

  const fixtureLines = parseLines(fixturesRaw);
  if (fixtureLines.length < 2) throw new Error("Tabla de repechajes vacia.");
  const headers = fixtureLines[0].split("\t").map((h) => h.trim().toLowerCase());
  const idxFixtureId = headers.findIndex((h) => h === "id_partido");
  const idxWinnerId = headers.findIndex((h) => h === "ganador_id");
  const idxHomeId = headers.findIndex((h) => h === "local_id");
  const idxAwayId = headers.findIndex((h) => h === "visita_id");
  const idxHomeScore = headers.findIndex((h) => h === "gol_local");
  const idxAwayScore = headers.findIndex((h) => h === "gol_visita");
  if (idxFixtureId < 0 || idxHomeId < 0 || idxAwayId < 0) {
    throw new Error("No se encontraron columnas de repechaje en partidos-mundial.");
  }

  for (let i = 1; i < fixtureLines.length; i++) {
    const row = fixtureLines[i].split("\t");
    const fixtureId = normalizeKey(row[idxFixtureId]);
    if (!isPlayoffFixtureId(fixtureId)) continue;

    const homeId = canonicalTeamCode(row[idxHomeId]);
    const awayId = canonicalTeamCode(row[idxAwayId]);
    const homeRawScore = idxHomeScore >= 0 ? row[idxHomeScore] : "";
    const awayRawScore = idxAwayScore >= 0 ? row[idxAwayScore] : "";
    const directWinner = idxWinnerId >= 0 ? canonicalTeamCode(row[idxWinnerId]) : "";
    const winnerId = directWinner || winnerFromScores(homeId, awayId, homeRawScore, awayRawScore);

    registerSelectionToken(selectionByToken, homeId, selectionByToken.get(homeId) || homeId);
    registerSelectionToken(selectionByToken, awayId, selectionByToken.get(awayId) || awayId);
    if (winnerId && winnerId !== "EMPATE") {
      registerSelectionToken(selectionByToken, winnerId, selectionByToken.get(winnerId) || winnerId);
    }

    fixturesById.set(fixtureId, {
      fixtureId,
      winnerId,
      homeId,
      awayId,
      homeScore: readMainScore(homeRawScore),
      awayScore: readMainScore(awayRawScore),
      homePenaltyScore: readPenaltyScore(homeRawScore),
      awayPenaltyScore: readPenaltyScore(awayRawScore),
    });
  }

  return { fixturesById, selectionByToken, groupStandings };
};
