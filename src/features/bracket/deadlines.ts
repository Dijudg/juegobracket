import type { Fixture } from "./types";

export type BracketTab = "repechajes" | "grupos" | "dieciseisavos" | "llaves";

export type BracketDeadlineState = {
  hiddenTabs: Record<BracketTab, boolean>;
  phaseLocked: Record<BracketTab, boolean>;
  lockedFixtureIds: Record<string, boolean>;
  groupCutoff: Date | null;
};

const PLAYOFF_MATCH_TO_FIXTURE: Record<string, string> = {
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

const normalizeKey = (value?: string) => (value || "").toString().trim().toUpperCase();

const parseDateAndTime = (fecha?: string, hora?: string): Date | null => {
  const rawDate = (fecha || "").trim();
  if (!rawDate) return null;

  let year = 0;
  let month = 0;
  let day = 0;

  const dmy = rawDate.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (dmy) {
    day = Number.parseInt(dmy[1], 10);
    month = Number.parseInt(dmy[2], 10);
    year = Number.parseInt(dmy[3], 10);
    if (year < 100) year += 2000;
  } else {
    const parsed = new Date(rawDate);
    if (Number.isNaN(parsed.getTime())) return null;
    year = parsed.getFullYear();
    month = parsed.getMonth() + 1;
    day = parsed.getDate();
  }

  const rawTime = (hora || "").trim();
  if (!rawTime || /POR\s+CONFIRMAR/i.test(rawTime)) return null;
  const timeMatch = rawTime.match(/^(\d{1,2})(?::(\d{1,2}))?/);
  if (!timeMatch) return null;

  const hours = Number.parseInt(timeMatch[1], 10);
  const minutes = Number.parseInt(timeMatch[2] || "0", 10);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;

  const value = new Date(year, month - 1, day, hours, minutes, 0, 0);
  if (Number.isNaN(value.getTime())) return null;
  return value;
};

const parseFixtureNumber = (fixtureId: string): number | null => {
  const key = normalizeKey(fixtureId);
  const match = key.match(/^P?(\d+)$/);
  if (!match) return null;
  const num = Number.parseInt(match[1], 10);
  return Number.isFinite(num) ? num : null;
};

const resolvePhaseForFixture = (fixtureId: string): BracketTab | null => {
  const key = normalizeKey(fixtureId);
  if (/^(RI|RA|RB|RC|RD)\d+$/.test(key)) return "repechajes";
  const fixtureNum = parseFixtureNumber(key);
  if (fixtureNum === null) return null;
  if (fixtureNum >= 1 && fixtureNum <= 72) return "grupos";
  if (fixtureNum >= 73 && fixtureNum <= 88) return "dieciseisavos";
  if (fixtureNum >= 89 && fixtureNum <= 104) return "llaves";
  return null;
};

const allExpired = (fixtureIds: string[], lockedFixtureIds: Record<string, boolean>) =>
  fixtureIds.length > 0 && fixtureIds.every((id) => !!lockedFixtureIds[id]);

const pickGroupYear = (fixtures: Fixture[], fallbackYear: number) => {
  for (const fixture of fixtures) {
    const phase = resolvePhaseForFixture(fixture.id);
    if (phase !== "grupos") continue;
    const kickoff = parseDateAndTime(fixture.fecha, fixture.hora);
    if (kickoff) return kickoff.getFullYear();
  }
  return fallbackYear;
};

export const resolveFixtureIdFromMatchId = (matchId?: string): string | null => {
  const key = normalizeKey(matchId);
  if (!key) return null;
  if (PLAYOFF_MATCH_TO_FIXTURE[key]) return PLAYOFF_MATCH_TO_FIXTURE[key];
  if (/^(RI|RA|RB|RC|RD)\d+$/.test(key)) return key;

  const knockoutMatch = key.match(/^(R32|R16|QF|SF|THIRD|FINAL)-(\d+)$/);
  if (knockoutMatch) {
    const num = Number.parseInt(knockoutMatch[2], 10);
    if (Number.isFinite(num)) return `P${num}`;
  }

  const fixtureNum = parseFixtureNumber(key);
  if (fixtureNum !== null) return `P${fixtureNum}`;
  return null;
};

export const computeBracketDeadlineState = (fixtures: Fixture[], now = new Date()): BracketDeadlineState => {
  const byPhase: Record<BracketTab, string[]> = {
    repechajes: [],
    grupos: [],
    dieciseisavos: [],
    llaves: [],
  };
  const lockedFixtureIds: Record<string, boolean> = {};

  fixtures.forEach((fixture) => {
    const fixtureId = resolveFixtureIdFromMatchId(fixture.id);
    if (!fixtureId) return;
    const phase = resolvePhaseForFixture(fixtureId);
    if (!phase) return;
    byPhase[phase].push(fixtureId);

    const kickoff = parseDateAndTime(fixture.fecha, fixture.hora);
    if (!kickoff) return;
    if (kickoff.getTime() <= now.getTime()) {
      lockedFixtureIds[fixtureId] = true;
    }
  });

  const groupYear = pickGroupYear(fixtures, now.getFullYear());
  const groupCutoff = new Date(groupYear, 5, 23, 23, 59, 59, 999);
  const groupExpired = now.getTime() > groupCutoff.getTime();

  const hiddenTabs: Record<BracketTab, boolean> = {
    repechajes: allExpired(byPhase.repechajes, lockedFixtureIds),
    grupos: groupExpired,
    dieciseisavos: allExpired(byPhase.dieciseisavos, lockedFixtureIds),
    llaves: allExpired(byPhase.llaves, lockedFixtureIds),
  };

  return {
    hiddenTabs,
    phaseLocked: {
      repechajes: hiddenTabs.repechajes,
      grupos: groupExpired,
      dieciseisavos: hiddenTabs.dieciseisavos,
      llaves: hiddenTabs.llaves,
    },
    lockedFixtureIds,
    groupCutoff,
  };
};

export const isMatchLockedByDeadline = (matchId: string, lockState: BracketDeadlineState) => {
  const fixtureId = resolveFixtureIdFromMatchId(matchId);
  if (!fixtureId) return false;
  return !!lockState.lockedFixtureIds[fixtureId];
};
