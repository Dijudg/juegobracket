import { useEffect, useMemo, useRef, useState } from "react";
import Confetti from "react-confetti";
import { useWindowSize } from "react-use";
import Header from "../components/header";
import Footer from "../components/Footer";
import { LeaderboardTopCard } from "../components/LeaderboardTopCard";
import type { ShareCardTeam } from "../components/ShareCard";
import leaderboardBanner from "../assets/polla-banner.jpg";
import { supabase } from "../utils/supabaseClient";
import { fetchFanaticoData } from "../utils/fanaticoApi";
import { resolveSiteBase } from "../utils/apiBase";
import { computeBracketDeadlineState } from "../features/bracket/deadlines";
import type { BracketSavePayload, Fixture, Match, ScorePredictionState, Seeds, Team } from "../features/bracket/types";
import { computeBracketScore, computeFullBracketScore, loadScoreSheetData } from "../features/bracket/score";
import type { ScoreTab } from "../features/bracket/score";
import {
  buildThirdQualifiedGroupsForMigration,
  migrateLegacyBracketPayload,
} from "../features/bracket/bracketMigration";
import thirdLookup from "../data/third_lookup.json";
import "../styles/globals.css";

type TopCardData = {
  bracketId: string;
  points: number;
  champion: ShareCardTeam;
  runnerUp: ShareCardTeam;
  third: ShareCardTeam;
  shareUrl: string;
};

type RankingGameMode = "classic" | "full";
type RankingView = "global" | RankingGameMode;

type BracketShareItem = {
  id: string;
  mode: RankingGameMode;
  gameCode: string;
  shareUrl: string;
};

type LeaderboardEntry = {
  userId: string;
  displayName: string;
  avatarUrl: string;
  totalPoints: number;
  totalHits: number;
  totalEvaluated: number;
  bracketCount: number;
  bestBracketPoints: number;
  bestCardUpdatedAt: string;
  updatedAt: string;
  bestCard: TopCardData | null;
  brackets: BracketShareItem[];
  searchTerms: string[];
};

type BracketRow = {
  id: string;
  name?: string | null;
  short_code?: string | null;
  user_id: string;
  updated_at: string;
  data: unknown;
  is_public: boolean;
  expires_at: string | null;
};

type LeaderboardRowsByView = Record<RankingView, LeaderboardEntry[]>;

type EligibleBracket = {
  row: BracketRow;
  payload: BracketSavePayload;
  mode: RankingGameMode;
};

type TeamIndexValue = {
  name: string;
  escudo?: string;
};

type SlideCard = {
  rank: number;
  userId: string;
  displayName: string;
  avatarUrl: string;
  totalPoints: number;
  card: TopCardData;
};

const GUEST_USER_ID = "00000000-0000-0000-0000-000000000000";
const GROUP_LETTERS = "ABCDEFGHIJKL".split("");
const MAX_THIRD = 8;
const SELECCIONES_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRi2qMMbibzuc4bjv38DBJYnfY24e4Mt0c20CqpDDFzgBn_aJ6NR0HcrXjdbKLhAEsy3zJUdvr3npRU/pub?gid=0&single=true&output=csv";
const WORLD_FIXTURES_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRi2qMMbibzuc4bjv38DBJYnfY24e4Mt0c20CqpDDFzgBn_aJ6NR0HcrXjdbKLhAEsy3zJUdvr3npRU/pub?gid=171585554&single=true&output=tsv";
const EMPTY_LEADERBOARD_ROWS: LeaderboardRowsByView = {
  global: [],
  classic: [],
  full: [],
};

const RANKING_FILTERS: Array<{ id: RankingView; label: string }> = [
  { id: "global", label: "Ranking Global" },
  { id: "classic", label: "Clásico" },
  { id: "full", label: "Completo" },
];

const normalizeKey = (value?: string) => (value || "").toString().trim().toUpperCase();
const normalizeComparable = (value?: string) =>
  normalizeKey((value || "").toString().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
const normalizeMatchKey = (value?: string) => {
  if (!value) return "";
  const cleaned = value.toString().trim().replace(/^P/i, "");
  const noZeros = cleaned.replace(/^0+/, "");
  return noZeros || cleaned;
};
const hasResolvedPick = (value?: string) => {
  const key = normalizeKey(value);
  return !!key && key !== "EMPATE" && !key.includes("/") && key !== "POR DEFINIR";
};
const buildSearchTerms = (payload: BracketSavePayload | null, fallbackDisplayName: string) =>
  [fallbackDisplayName, payload?.sharedBy?.alias || "", payload?.sharedBy?.name || ""]
    .map((value) => value.trim())
    .filter(Boolean);

const parsePayload = (raw: unknown): BracketSavePayload | null => {
  if (!raw) return null;
  let payload = raw;
  if (typeof payload === "string") {
    try {
      payload = JSON.parse(payload);
    } catch {
      return null;
    }
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const parsed = payload as Partial<BracketSavePayload>;
  return {
    version: Number(parsed.version || 1),
    gameMode: parsed.gameMode === "full" ? "full" : "classic",
    selections: parsed.selections || {},
    bestThirdIds: parsed.bestThirdIds || [],
    picks: parsed.picks || {},
    scorePredictions: parsed.scorePredictions || {},
    penaltyPredictions: parsed.penaltyPredictions || {},
    intercontinentalPicks: parsed.intercontinentalPicks || {},
    uefaPicks: parsed.uefaPicks || {},
    isLocked: Boolean(parsed.isLocked),
    phaseLocks: parsed.phaseLocks || {},
    shareCardUrl: parsed.shareCardUrl,
    shareCardUpdatedAt: parsed.shareCardUpdatedAt,
    sharedBy: parsed.sharedBy,
  };
};

const extractName = (payload: BracketSavePayload | null, userId: string) => {
  const name = payload?.sharedBy?.alias || payload?.sharedBy?.name || "";
  if (name && name.trim()) return name.trim();
  return `Usuario ${userId.slice(0, 8)}`;
};

const extractAvatar = (payload: BracketSavePayload | null) => payload?.sharedBy?.avatarUrl || "";

const compareIso = (a: string, b: string) => {
  const ta = Date.parse(a);
  const tb = Date.parse(b);
  if (!Number.isFinite(ta)) return -1;
  if (!Number.isFinite(tb)) return 1;
  return ta - tb;
};

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

const parseTSVLine = (line: string): string[] => line.replace(/\r/g, "").split("\t");

const parseFanaticoFixtures = (fixtures?: Array<Record<string, unknown>>): Fixture[] =>
  (fixtures || []).map((fixture, idx) => ({
    id: `${fixture.id_partido || fixture.id || `fx-${idx + 1}`}`,
    fecha: fixture.fecha?.toString(),
    hora: fixture.hora?.toString(),
    fase: fixture.fase?.toString(),
    group: fixture.grupo?.toString().toUpperCase(),
    jornada: fixture.jornada?.toString(),
    homeId: fixture.local_id?.toString(),
    awayId: fixture.visita_id?.toString(),
    estadio: fixture.estadio?.toString(),
    locacion: fixture.locacion?.toString(),
  }));

const loadFallbackFixtures = async (): Promise<Fixture[]> => {
  const response = await fetch(WORLD_FIXTURES_URL);
  if (!response.ok) return [];
  const raw = await response.text();
  const lines = raw
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];

  const headers = parseTSVLine(lines[0]).map((h) => h.trim().toLowerCase());
  const idxId = headers.indexOf("id_partido");
  const idxFecha = headers.indexOf("fecha");
  const idxHora = headers.indexOf("hora");
  const idxFase = headers.indexOf("fase");
  const idxGrupo = headers.indexOf("grupo");
  const idxJornada = headers.indexOf("jornada");
  const idxLocal = headers.indexOf("local_id");
  const idxVisita = headers.indexOf("visita_id");
  const idxEstadio = headers.indexOf("estadio");
  const idxLocacion = headers.findIndex((h) => h.includes("locación") || h.includes("ubicación"));

  return lines.slice(1).map((line, idx) => {
    const cols = parseTSVLine(line);
    return {
      id: idxId >= 0 ? cols[idxId] : `fx-${idx + 1}`,
      fecha: idxFecha >= 0 ? cols[idxFecha] : undefined,
      hora: idxHora >= 0 ? cols[idxHora] : undefined,
      fase: idxFase >= 0 ? cols[idxFase] : undefined,
      group: idxGrupo >= 0 ? cols[idxGrupo]?.toUpperCase() : undefined,
      jornada: idxJornada >= 0 ? cols[idxJornada] : undefined,
      homeId: idxLocal >= 0 ? cols[idxLocal] : undefined,
      awayId: idxVisita >= 0 ? cols[idxVisita] : undefined,
      estadio: idxEstadio >= 0 ? cols[idxEstadio] : undefined,
      locacion: idxLocacion >= 0 ? cols[idxLocacion] : undefined,
    };
  });
};

const buildTeamIndex = (teams?: Array<{ id?: string; codigo_fixture?: string; seleccion?: string; escudo_url?: string }>) => {
  const map = new Map<string, TeamIndexValue>();

  const register = (rawKey: string | undefined, value: TeamIndexValue) => {
    const key = normalizeKey(rawKey);
    if (!key) return;
    const current = map.get(key);
    if (!current) {
      map.set(key, value);
    } else {
      const currentName = (current.name || "").trim();
      const fallbackName = !currentName || normalizeKey(currentName) === key;
      map.set(key, {
        name: fallbackName ? value.name || current.name : current.name || value.name,
        escudo: current.escudo || value.escudo,
      });
    }
    const comparable = normalizeComparable(key);
    if (comparable) {
      const currentComparable = map.get(comparable);
      if (!currentComparable) {
        map.set(comparable, value);
      } else {
        const currentName = (currentComparable.name || "").trim();
        const fallbackName = !currentName || normalizeKey(currentName) === key;
        map.set(comparable, {
          name: fallbackName ? value.name || currentComparable.name : currentComparable.name || value.name,
          escudo: currentComparable.escudo || value.escudo,
        });
      }
    }
  };

  (teams || []).forEach((team) => {
    const value: TeamIndexValue = {
      name: (team.seleccion || team.id || team.codigo_fixture || "").toString().trim(),
      escudo: team.escudo_url,
    };
    if (!value.name) return;
    register(team.id, value);
    register(team.codigo_fixture, value);
    register(team.seleccion, value);
  });

  return map;
};

const teamFromToken = (token: string | undefined, group: string | undefined, teamIndex: Map<string, TeamIndexValue>): Team | undefined => {
  const key = normalizeKey(token);
  if (!key || key === "EMPATE" || key.includes("/")) return undefined;
  const match = teamIndex.get(key) || teamIndex.get(normalizeComparable(key));
  return {
    id: key,
    codigo: key,
    nombre: match?.name || key,
    grupo: group?.toUpperCase() || "",
    escudo: match?.escudo,
  };
};

const buildFullModeGroupsFromScores = (
  payload: BracketSavePayload,
  teamIndex: Map<string, TeamIndexValue>,
  fixtures: Fixture[],
) => {
  const selections: BracketSavePayload["selections"] = {};
  const groupSelections: Record<string, { primero?: Team; segundo?: Team; tercero?: Team }> = {};
  const tables: Record<string, Array<Team & { pts: number; pj: number; pg: number; gf: number; gc: number; dif: number }>> = {};
  const scores = payload.scorePredictions || {};

  GROUP_LETTERS.forEach((group) => {
    const rows = new Map<string, Team & { pts: number; pj: number; pg: number; gf: number; gc: number; dif: number }>();
    fixtures
      .filter((fixture) => {
        const fixtureGroup = fixture.group?.toUpperCase();
        const fixtureNumber = Number.parseInt(normalizeMatchKey(fixture.id), 10);
        return fixtureGroup === group && Number.isFinite(fixtureNumber) && fixtureNumber <= 72;
      })
      .forEach((fixture) => {
        const matchKey = normalizeMatchKey(fixture.id);
        const prediction = scores[matchKey] || scores[`P${matchKey}`] || scores[fixture.id];
        if (typeof prediction?.home !== "number" || typeof prediction.away !== "number") return;
        const home = teamFromToken(fixture.homeId, group, teamIndex);
        const away = teamFromToken(fixture.awayId, group, teamIndex);
        if (!home || !away) return;
        if (!rows.has(home.id)) rows.set(home.id, { ...home, pts: 0, pj: 0, pg: 0, gf: 0, gc: 0, dif: 0 });
        if (!rows.has(away.id)) rows.set(away.id, { ...away, pts: 0, pj: 0, pg: 0, gf: 0, gc: 0, dif: 0 });
        const homeRow = rows.get(home.id)!;
        const awayRow = rows.get(away.id)!;
        homeRow.pj += 1;
        awayRow.pj += 1;
        homeRow.gf += prediction.home;
        homeRow.gc += prediction.away;
        awayRow.gf += prediction.away;
        awayRow.gc += prediction.home;
        if (prediction.home === prediction.away) {
          homeRow.pts += 1;
          awayRow.pts += 1;
        } else if (prediction.home > prediction.away) {
          homeRow.pts += 3;
          homeRow.pg += 1;
        } else {
          awayRow.pts += 3;
          awayRow.pg += 1;
        }
      });

    const table = Array.from(rows.values())
      .map((row) => ({ ...row, dif: row.gf - row.gc }))
      .sort((a, b) => b.pts - a.pts || b.dif - a.dif || b.gf - a.gf || b.pg - a.pg || a.nombre.localeCompare(b.nombre, "es"));
    tables[group] = table;
    groupSelections[group] = {
      primero: table[0],
      segundo: table[1],
      tercero: table[2],
    };
    selections[group] = {
      primeroId: table[0]?.id,
      segundoId: table[1]?.id,
      terceroId: table[2]?.id,
    };
  });

  const bestThirdIds = GROUP_LETTERS.map((group) => tables[group]?.[2])
    .filter((team): team is Team & { pts: number; pj: number; pg: number; gf: number; gc: number; dif: number } => Boolean(team))
    .sort((a, b) => b.pts - a.pts || b.dif - a.dif || b.gf - a.gf || b.pg - a.pg || a.nombre.localeCompare(b.nombre, "es"))
    .slice(0, MAX_THIRD)
    .map((team) => team.id);

  return { selections, groupSelections, bestThirdIds };
};

const buildSeedsFromPayload = (payload: BracketSavePayload, teamIndex: Map<string, TeamIndexValue>): Seeds => {
  const firsts: Seeds["firsts"] = {};
  const seconds: Seeds["seconds"] = {};
  const thirds: Seeds["thirds"] = {};
  GROUP_LETTERS.forEach((group) => {
    const pick = payload.selections?.[group];
    firsts[group] = teamFromToken(pick?.primeroId, group, teamIndex);
    seconds[group] = teamFromToken(pick?.segundoId, group, teamIndex);
    thirds[group] = teamFromToken(pick?.terceroId, group, teamIndex);
  });
  return { firsts, seconds, thirds };
};

const buildGroupSelectionsFromSeeds = (seeds: Seeds) => {
  const selections: Record<string, { primero?: Team; segundo?: Team; tercero?: Team }> = {};
  GROUP_LETTERS.forEach((group) => {
    selections[group] = {
      primero: seeds.firsts[group],
      segundo: seeds.seconds[group],
      tercero: seeds.thirds[group],
    };
  });
  return selections;
};

const normalizeThirdGroups = (groups: string[]) =>
  Array.from(new Set(groups.map((g) => g.toUpperCase()).filter((g) => GROUP_LETTERS.includes(g))))
    .sort()
    .slice(0, MAX_THIRD);

const assignThirdGroupsToSeeds = (thirdsQualified: string[]) => {
  const orderedThirds = normalizeThirdGroups(thirdsQualified);
  const key = orderedThirds.join("");
  const lookup = thirdLookup as Record<string, Record<string, string>>;
  const exact = lookup[key];
  if (exact) return exact;
  const used = new Set<string>();
  const entry: Record<string, string> = {};
  ["A1", "B1", "D1", "E1", "G1", "I1", "K1", "L1"].forEach((seed, idx) => {
    const group = orderedThirds[idx % Math.max(1, orderedThirds.length)];
    if (group && !used.has(group)) {
      entry[seed] = `3${group}`;
      used.add(group);
    }
  });
  return entry;
};

const buildRoundOf32ForPodium = (seeds: Seeds, thirdsQualifiedGroups: string[]): Match[] => {
  const entry = assignThirdGroupsToSeeds(thirdsQualifiedGroups);
  const slotTeam = (slot: string): Team | undefined => {
    const group = slot.slice(0, 1);
    const rank = slot.slice(1);
    if (rank === "1") return seeds.firsts[group];
    if (rank === "2") return seeds.seconds[group];
    if (rank === "3") return seeds.thirds[group];
    return undefined;
  };
  const thirdSeedToTeam = (code: string): Team | undefined => {
    const group = entry[code]?.[1];
    return group ? seeds.thirds[group] : undefined;
  };
  const roundOf32Base = [
    { id: "73", home: "A2", away: "B2" },
    { id: "74", home: "E1", away: "LKP_E1" },
    { id: "75", home: "F1", away: "C2" },
    { id: "76", home: "C1", away: "F2" },
    { id: "77", home: "I1", away: "LKP_I1" },
    { id: "78", home: "E2", away: "I2" },
    { id: "79", home: "A1", away: "LKP_A1" },
    { id: "80", home: "L1", away: "LKP_L1" },
    { id: "81", home: "D1", away: "LKP_D1" },
    { id: "82", home: "G1", away: "LKP_G1" },
    { id: "83", home: "K2", away: "L2" },
    { id: "84", home: "H1", away: "J2" },
    { id: "85", home: "B1", away: "LKP_B1" },
    { id: "86", home: "J1", away: "H2" },
    { id: "87", home: "K1", away: "LKP_K1" },
    { id: "88", home: "D2", away: "G2" },
  ] as const;
  return roundOf32Base.map((cfg) => ({
    id: `r32-${cfg.id}`,
    label: cfg.id,
    equipoA: cfg.home.startsWith("LKP_") ? thirdSeedToTeam(cfg.home.slice(4)) : slotTeam(cfg.home),
    equipoB: cfg.away.startsWith("LKP_") ? thirdSeedToTeam(cfg.away.slice(4)) : slotTeam(cfg.away),
  }));
};

const winnerFromMatch = (
  match: Match,
  picks: Record<string, string | undefined>,
  scorePredictions: ScorePredictionState,
  penaltyPredictions: ScorePredictionState,
): Team | undefined => {
  const score = scorePredictions[match.id];
  if (match.equipoA && match.equipoB && typeof score?.home === "number" && typeof score.away === "number") {
    if (score.home > score.away) return match.equipoA;
    if (score.away > score.home) return match.equipoB;
    const penalty = penaltyPredictions[match.id];
    if (typeof penalty?.home === "number" && typeof penalty.away === "number") {
      if (penalty.home > penalty.away) return match.equipoA;
      if (penalty.away > penalty.home) return match.equipoB;
    }
  }
  const picked = picks[match.id];
  if (picked && (normalizeKey(match.equipoA?.id) === normalizeKey(picked) || normalizeKey(match.equipoB?.id) === normalizeKey(picked))) {
    return normalizeKey(match.equipoA?.id) === normalizeKey(picked) ? match.equipoA : match.equipoB;
  }
  return undefined;
};

const buildFinalMatchesForPodium = (base: Match[], payload: BracketSavePayload) => {
  const picks = payload.picks || {};
  const scores = payload.scorePredictions || {};
  const penalties = payload.penaltyPredictions || {};
  const attachWinners = (matches: Match[]) =>
    matches.map((match) => {
      const ganador = winnerFromMatch(match, picks, scores, penalties);
      const perdedor =
        ganador && match.equipoA && match.equipoB
          ? normalizeKey(ganador.id) === normalizeKey(match.equipoA.id)
            ? match.equipoB
            : match.equipoA
          : undefined;
      return { ...match, ganador, perdedor };
    });
  const r32 = attachWinners(base);
  const winner = (items: Match[], id: string) => items.find((m) => m.id === id)?.ganador;
  const r16 = attachWinners(
    [
      { id: "r16-89", label: "89", a: "r32-74", b: "r32-77" },
      { id: "r16-90", label: "90", a: "r32-73", b: "r32-75" },
      { id: "r16-91", label: "91", a: "r32-76", b: "r32-78" },
      { id: "r16-92", label: "92", a: "r32-79", b: "r32-80" },
      { id: "r16-93", label: "93", a: "r32-83", b: "r32-84" },
      { id: "r16-94", label: "94", a: "r32-81", b: "r32-82" },
      { id: "r16-95", label: "95", a: "r32-86", b: "r32-88" },
      { id: "r16-96", label: "96", a: "r32-85", b: "r32-87" },
    ].map((m) => ({ id: m.id, label: m.label, equipoA: winner(r32, m.a), equipoB: winner(r32, m.b) })),
  );
  const qf = attachWinners(
    [
      { id: "qf-97", label: "97", a: "r16-89", b: "r16-90" },
      { id: "qf-98", label: "98", a: "r16-93", b: "r16-94" },
      { id: "qf-99", label: "99", a: "r16-91", b: "r16-92" },
      { id: "qf-100", label: "100", a: "r16-95", b: "r16-96" },
    ].map((m) => ({ id: m.id, label: m.label, equipoA: winner(r16, m.a), equipoB: winner(r16, m.b) })),
  );
  const sf = attachWinners(
    [
      { id: "sf-101", label: "101", a: "qf-97", b: "qf-98" },
      { id: "sf-102", label: "102", a: "qf-99", b: "qf-100" },
    ].map((m) => ({ id: m.id, label: m.label, equipoA: winner(qf, m.a), equipoB: winner(qf, m.b) })),
  );
  const final = attachWinners([{ id: "final-104", label: "104", equipoA: winner(sf, "sf-101"), equipoB: winner(sf, "sf-102") }]);
  const thirdPlace = attachWinners([
    {
      id: "third-103",
      label: "103",
      equipoA: sf.find((m) => m.id === "sf-101")?.perdedor,
      equipoB: sf.find((m) => m.id === "sf-102")?.perdedor,
    },
  ]);
  return { final: final[0], thirdPlace: thirdPlace[0] };
};

const teamToCard = (team?: Team): ShareCardTeam => ({
  name: team?.nombre || team?.id || "Por definir",
  escudo: team?.escudo,
});

const buildFullModeCardPodium = (payload: BracketSavePayload, teamIndex: Map<string, TeamIndexValue>, fixtures: Fixture[]) => {
  const derived = buildFullModeGroupsFromScores(payload, teamIndex, fixtures);
  const seeds =
    derived.bestThirdIds.length >= MAX_THIRD
      ? buildSeedsFromPayload({ ...payload, selections: derived.selections }, teamIndex)
      : buildSeedsFromPayload(payload, teamIndex);
  const thirdsAvailable = GROUP_LETTERS.map((group) => seeds.thirds[group]).filter(Boolean) as Team[];
  const bestThirdIds = derived.bestThirdIds.length >= MAX_THIRD ? derived.bestThirdIds : payload.bestThirdIds || [];
  const thirdsQualifiedGroups = bestThirdIds
    .map((id) => {
      const key = normalizeKey(id);
      return thirdsAvailable.find(
        (team) => normalizeKey(team.id) === key || normalizeKey(team.codigo) === key || normalizeComparable(team.nombre) === normalizeComparable(key),
      );
    })
    .filter(Boolean)
    .map((team) => team!.grupo?.toUpperCase())
    .filter(Boolean) as string[];
  if (thirdsQualifiedGroups.length < MAX_THIRD) return null;
  const matches = buildRoundOf32ForPodium(seeds, thirdsQualifiedGroups);
  const { final, thirdPlace } = buildFinalMatchesForPodium(matches, payload);
  return {
    champion: teamToCard(final?.ganador),
    runnerUp: teamToCard(final?.perdedor),
    third: teamToCard(thirdPlace?.ganador),
  };
};

const migratePayloadForRanking = (
  payload: BracketSavePayload,
  teamIndex: Map<string, TeamIndexValue>,
  fixtures: Fixture[],
) => {
  const fullModeGroups = payload.gameMode === "full" ? buildFullModeGroupsFromScores(payload, teamIndex, fixtures) : null;
  const seedPayload = fullModeGroups
    ? { ...payload, selections: fullModeGroups.selections, bestThirdIds: fullModeGroups.bestThirdIds }
    : payload;
  const seeds = buildSeedsFromPayload(seedPayload, teamIndex);
  const groupSelections = fullModeGroups?.groupSelections || buildGroupSelectionsFromSeeds(seeds);
  const thirdsQualifiedGroups = buildThirdQualifiedGroupsForMigration(groupSelections, seedPayload.bestThirdIds || []);
  return migrateLegacyBracketPayload(payload, { seeds, thirdsQualifiedGroups });
};

const loadFallbackTeamsFromCsv = async () => {
  const response = await fetch(SELECCIONES_URL);
  if (!response.ok) return [] as Array<{ id?: string; codigo_fixture?: string; seleccion?: string; escudo_url?: string }>;
  const raw = await response.text();
  const lines = raw
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) return [] as Array<{ id?: string; codigo_fixture?: string; seleccion?: string; escudo_url?: string }>;

  const headers = parseCSVLine(lines[0]).map((h) => h.trim().toLowerCase());
  const idxId = headers.findIndex((h) => h === "id");
  const idxCode = headers.findIndex((h) => h === "codigo_fixture");
  const idxSelection = headers.findIndex((h) => h === "seleccion");
  const idxEscudo = headers.findIndex((h) => h === "escudo_url");

  const rows: Array<{ id?: string; codigo_fixture?: string; seleccion?: string; escudo_url?: string }> = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    rows.push({
      id: idxId >= 0 ? cols[idxId] : "",
      codigo_fixture: idxCode >= 0 ? cols[idxCode] : "",
      seleccion: idxSelection >= 0 ? cols[idxSelection] : "",
      escudo_url: idxEscudo >= 0 ? cols[idxEscudo] : "",
    });
  }
  return rows;
};

const resolveTeamCardById = (token: string | undefined, teamIndex: Map<string, TeamIndexValue>): ShareCardTeam => {
  const key = normalizeKey(token);
  if (!key || key === "EMPATE" || key.includes("/")) {
    return { name: "Por definir" };
  }
  const match = teamIndex.get(key) || teamIndex.get(normalizeComparable(key));
  return {
    name: key,
    escudo: match?.escudo,
  };
};

const resolveTeamCardByName = (token: string | undefined, teamIndex: Map<string, TeamIndexValue>): ShareCardTeam => {
  const key = normalizeKey(token);
  if (!key || key === "EMPATE" || key.includes("/")) {
    return { name: "Por definir" };
  }
  const match = teamIndex.get(key) || teamIndex.get(normalizeComparable(key));
  return {
    name: match?.name || key,
    escudo: match?.escudo,
  };
};

const buildBestCard = (
  payload: BracketSavePayload,
  teamIndex: Map<string, TeamIndexValue>,
  fixtures: Fixture[],
  bracketId: string,
  points: number,
  siteBase: string,
): TopCardData => {
  const picks = payload.picks || {};
  const fullPodium = payload.gameMode === "full" ? buildFullModeCardPodium(payload, teamIndex, fixtures) : null;
  const championToken = picks["final-104"];
  const sf1 = normalizeKey(picks["sf-101"]);
  const sf2 = normalizeKey(picks["sf-102"]);
  const championKey = normalizeKey(championToken);

  let runnerKey = "";
  if (championKey && sf1 && sf2) {
    if (sf1 === championKey) runnerKey = sf2;
    else if (sf2 === championKey) runnerKey = sf1;
  }
  if (!runnerKey) runnerKey = sf1 || sf2;

  const thirdToken = picks["third-103"];
  const base = (siteBase || "").replace(/\/$/, "");
  const shareUrl = base ? `${base}/share/${bracketId}` : `/share/${bracketId}`;

  return {
    bracketId,
    points,
    champion: fullPodium?.champion || resolveTeamCardByName(championToken, teamIndex),
    runnerUp: fullPodium?.runnerUp || resolveTeamCardById(runnerKey, teamIndex),
    third: fullPodium?.third || resolveTeamCardById(thirdToken, teamIndex),
    shareUrl,
  };
};

const isCompletedBracket = (payload: BracketSavePayload | null) => {
  if (!payload) return false;
  if (payload.gameMode === "full") {
    const scores = payload.scorePredictions || {};
    const hasCompleteScore = (matchId: string) =>
      typeof scores[matchId]?.home === "number" && typeof scores[matchId]?.away === "number";
    return hasCompleteScore("third-103") && hasCompleteScore("final-104");
  }
  const picks = payload.picks || {};
  return (
    hasResolvedPick(picks["sf-101"]) &&
    hasResolvedPick(picks["sf-102"]) &&
    hasResolvedPick(picks["third-103"]) &&
    hasResolvedPick(picks["final-104"])
  );
};

const resolveGameMode = (payload: BracketSavePayload): RankingGameMode =>
  payload.gameMode === "full" ? "full" : "classic";

const chunk = <T,>(items: T[], size: number) => {
  if (size <= 0) return [items];
  const output: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    output.push(items.slice(i, i + size));
  }
  return output;
};

const createEmptyRankingEntry = (
  userId: string,
  payload: BracketSavePayload,
  row: BracketRow,
): LeaderboardEntry => {
  const displayName = extractName(payload, userId);
  return {
    userId,
    displayName,
    avatarUrl: extractAvatar(payload),
    totalPoints: 0,
    totalHits: 0,
    totalEvaluated: 0,
    bracketCount: 0,
    bestBracketPoints: 0,
    bestCardUpdatedAt: "",
    updatedAt: row.updated_at || "",
    bestCard: null,
    brackets: [],
    searchTerms: buildSearchTerms(payload, displayName),
  };
};

const sortRankingEntries = (entries: LeaderboardEntry[]) => {
  const ranking = entries.sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    if (b.totalHits !== a.totalHits) return b.totalHits - a.totalHits;
    if (b.bestBracketPoints !== a.bestBracketPoints) return b.bestBracketPoints - a.bestBracketPoints;
    return compareIso(b.updatedAt, a.updatedAt);
  });

  ranking.forEach((entry) => {
    entry.brackets.sort((a, b) => {
      if (a.mode !== b.mode) return a.mode === "classic" ? -1 : 1;
      return a.gameCode.localeCompare(b.gameCode);
    });
    entry.searchTerms = Array.from(new Set(entry.searchTerms.map((term) => term.trim()).filter(Boolean)));
  });

  return ranking;
};

export default function LeaderboardPage() {
  const { width: viewportWidth } = useWindowSize();
  const cardsPerSlide = viewportWidth >= 1024 ? 3 : 1;

  const [rowsByView, setRowsByView] = useState<LeaderboardRowsByView>(EMPTY_LEADERBOARD_ROWS);
  const [rankingView, setRankingView] = useState<RankingView>("global");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [usersSearch, setUsersSearch] = useState("");
  const [visibleUsers, setVisibleUsers] = useState(6);
  const rows = rowsByView[rankingView];
  const rankByUserId = useMemo(() => {
    const map = new Map<string, number>();
    rows.forEach((row, index) => {
      map.set(row.userId, index + 1);
    });
    return map;
  }, [rows]);

  const sliderRef = useRef<HTMLDivElement>(null);
  const [sliderSize, setSliderSize] = useState({ width: 0, height: 0 });
  const [slideIndex, setSlideIndex] = useState(0);

  useEffect(() => {
    let active = true;
    const loadLeaderboard = async () => {
      setLoading(true);
      setError(null);
      try {
        const nowIso = new Date().toISOString();
        const [sheetData, bracketResult, fanaticoData, csvTeams, fallbackFixtures] = await Promise.all([
          loadScoreSheetData(),
          supabase
            .from("bracket_saves")
            .select("id,name,short_code,user_id,updated_at,data,is_public,expires_at")
            .eq("is_public", true)
            .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
            .order("updated_at", { ascending: false })
            .limit(2000),
          fetchFanaticoData(),
          loadFallbackTeamsFromCsv().catch(() => []),
          loadFallbackFixtures().catch(() => []),
        ]);

        if (bracketResult.error) throw bracketResult.error;

        const brackets = (bracketResult.data || []) as BracketRow[];
        const combinedTeams = [...(fanaticoData?.teams || []), ...csvTeams];
        const teamIndex = buildTeamIndex(combinedTeams);
        const siteBase = resolveSiteBase() || (typeof window !== "undefined" ? window.location.origin : "");
        const deadlineFixtures = fanaticoData?.fixtures?.length
          ? parseFanaticoFixtures(fanaticoData.fixtures as Array<Record<string, unknown>>)
          : fallbackFixtures;
        const deadlineState = computeBracketDeadlineState(deadlineFixtures, new Date());
        const classicEnabledTabs: Partial<Record<ScoreTab, boolean>> = {
          repechajes: true,
          grupos: deadlineState.phaseLocked.grupos,
          dieciseisavos: deadlineState.phaseLocked.dieciseisavos,
          llaves: deadlineState.phaseLocked.llaves,
        };
        const eligibleByUserMode = new Map<string, EligibleBracket[]>();

        for (const row of brackets) {
          const userId = (row.user_id || "").toString();
          if (!userId || userId === GUEST_USER_ID) continue;
          const parsedPayload = parsePayload(row.data);
          if (!parsedPayload) continue;
          const payload = migratePayloadForRanking(parsedPayload, teamIndex, deadlineFixtures);
          if (!isCompletedBracket(payload)) continue;
          const sharedUserId = (payload.sharedBy?.userId || "").toString().trim();
          const sharedIdentity = `${payload.sharedBy?.name || ""} ${payload.sharedBy?.alias || ""}`.toLowerCase();
          const isGuestShared =
            sharedUserId === GUEST_USER_ID ||
            /\binvitado\b|\bguest\b/.test(sharedIdentity);
          if (isGuestShared) continue;
          const mode = resolveGameMode(payload);
          const key = `${userId}:${mode}`;
          const list = eligibleByUserMode.get(key) || [];
          list.push({ row, payload, mode });
          eligibleByUserMode.set(key, list);
        }

        const eligibleBrackets = Array.from(eligibleByUserMode.values()).flatMap((items) =>
          items
            .slice()
            .sort((a, b) => compareIso(b.row.updated_at || "", a.row.updated_at || ""))
            .slice(0, 1),
        );

        const addBracketToRows = (
          target: Map<string, LeaderboardEntry>,
          eligible: EligibleBracket,
          summary: ReturnType<typeof computeBracketScore>,
        ) => {
          const { row, payload, mode } = eligible;
          const userId = (row.user_id || "").toString();
          const entry = target.get(userId) || createEmptyRankingEntry(userId, payload, row);
          const cardCandidate = buildBestCard(payload, teamIndex, deadlineFixtures, row.id, summary.totalPoints, siteBase);
          const displayName = extractName(payload, userId);
          const avatarUrl = extractAvatar(payload);
          const gameCode = (row.short_code || row.id || "").toString().toUpperCase();
          const bracketItem: BracketShareItem = {
            id: row.id,
            mode,
            gameCode,
            shareUrl: cardCandidate.shareUrl,
          };

          entry.totalPoints += summary.totalPoints;
          entry.totalHits += summary.hitCount;
          entry.totalEvaluated += summary.evaluatedCount;
          entry.bracketCount += 1;
          entry.brackets.push(bracketItem);
          entry.searchTerms.push(...buildSearchTerms(payload, displayName));
          if (!entry.avatarUrl && avatarUrl) entry.avatarUrl = avatarUrl;
          if (entry.displayName.startsWith("Usuario ") && displayName && !displayName.startsWith("Usuario ")) {
            entry.displayName = displayName;
          }
          if (compareIso(entry.updatedAt, row.updated_at || "") < 0) {
            entry.updatedAt = row.updated_at || entry.updatedAt;
          }

          const shouldReplaceBest =
            !entry.bestCard ||
            summary.totalPoints > entry.bestBracketPoints ||
            (summary.totalPoints === entry.bestBracketPoints &&
              compareIso(entry.bestCardUpdatedAt, row.updated_at || "") < 0);

          if (shouldReplaceBest) {
            entry.bestBracketPoints = summary.totalPoints;
            entry.bestCardUpdatedAt = row.updated_at || entry.bestCardUpdatedAt;
            entry.bestCard = cardCandidate;
          }

          target.set(userId, entry);
        };

        const rowsByMode: Record<RankingView, Map<string, LeaderboardEntry>> = {
          global: new Map(),
          classic: new Map(),
          full: new Map(),
        };

        for (const eligible of eligibleBrackets) {
          const { payload, mode } = eligible;
          const summary =
            mode === "full"
              ? computeFullBracketScore(
                  {
                    picks: payload.picks || {},
                    intercontinentalPicks: payload.intercontinentalPicks || {},
                    uefaPicks: payload.uefaPicks || {},
                    scorePredictions: payload.scorePredictions || {},
                    penaltyPredictions: payload.penaltyPredictions || {},
                  },
                  sheetData,
                )
              : computeBracketScore(
                  {
                    picks: payload.picks || {},
                    intercontinentalPicks: payload.intercontinentalPicks || {},
                    uefaPicks: payload.uefaPicks || {},
                    selections: payload.selections || {},
                    bestThirdIds: payload.bestThirdIds || [],
                  },
                  sheetData,
                  { enabledTabs: classicEnabledTabs },
                );

          addBracketToRows(rowsByMode.global, eligible, summary);
          addBracketToRows(rowsByMode[mode], eligible, summary);
        }

        if (!active) return;
        setRowsByView({
          global: sortRankingEntries(Array.from(rowsByMode.global.values())),
          classic: sortRankingEntries(Array.from(rowsByMode.classic.values())),
          full: sortRankingEntries(Array.from(rowsByMode.full.values())),
        });
      } catch {
        if (!active) return;
        setError("No se pudo cargar el ranking.");
      } finally {
        if (!active) return;
        setLoading(false);
      }
    };

    void loadLeaderboard();
    return () => {
      active = false;
    };
  }, []);

  const rankingViewLabel = RANKING_FILTERS.find((filter) => filter.id === rankingView)?.label || "Ranking Global";
  const rankingDescription =
    rankingView === "global"
      ? "Para definir el ganador global solo cuentan el último bracket clásico y el último bracket completo de cada jugador."
      : rankingView === "classic"
        ? "Ranking clásico: cuenta únicamente el último bracket clásico de cada jugador."
        : "Ranking completo: cuenta únicamente el último bracket completo de cada jugador.";

  const topCards = useMemo<SlideCard[]>(() => {
    return rows
      .filter((entry) => !!entry.bestCard)
      .slice(0, 5)
      .map((entry, idx) => ({
        rank: idx + 1,
        userId: entry.userId,
        displayName: entry.displayName,
        avatarUrl: entry.avatarUrl || "",
        totalPoints: entry.bestCard?.points ?? entry.bestBracketPoints,
        card: entry.bestCard as TopCardData,
      }));
  }, [rows]);

  const slides = useMemo(() => chunk(topCards, cardsPerSlide), [topCards, cardsPerSlide]);
  const topFiveRows = useMemo(() => rows.slice(0, 5), [rows]);
  const filteredRows = useMemo(() => {
    const query = usersSearch.trim();
    if (!query) return rows;
    const normalizedQuery = normalizeComparable(query);
    return rows.filter((entry) =>
      entry.searchTerms.some((term) => normalizeComparable(term).includes(normalizedQuery)),
    );
  }, [rows, usersSearch]);
  const visibleRows = useMemo(() => filteredRows.slice(0, visibleUsers), [filteredRows, visibleUsers]);

  useEffect(() => {
    setVisibleUsers(6);
    setExpandedUserId(null);
  }, [usersSearch, rankingView]);

  useEffect(() => {
    setSlideIndex(0);
  }, [rankingView]);

  useEffect(() => {
    setSlideIndex((current) => Math.min(current, Math.max(0, slides.length - 1)));
  }, [slides.length]);

  useEffect(() => {
    if (slides.length <= 1) return;
    const timer = window.setInterval(() => {
      setSlideIndex((current) => (current >= slides.length - 1 ? 0 : current + 1));
    }, 7000);
    return () => window.clearInterval(timer);
  }, [slides.length]);

  useEffect(() => {
    const measure = () => {
      const node = sliderRef.current;
      if (!node) return;
      setSliderSize({ width: node.clientWidth, height: node.clientHeight });
    };

    measure();

    const node = sliderRef.current;
    if (!node) return;

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(measure);
      observer.observe(node);
    }

    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("resize", measure);
      observer?.disconnect();
    };
  }, [slides.length, cardsPerSlide]);

  return (
    <div className="min-h-screen bg-[#0f1014] text-white">
      <div className="mx-auto w-full max-w-7xl px-4 py-4">
        <Header showSearch={false} />
      </div>

      <main className="mx-auto w-full max-w-7xl px-4 pb-10">
        <section className="rounded-2xl  p-4 md:p-6">
          <div className="mb-4 overflow-hidden rounded-xl border border-white/10 bg-black/30">
                <img src={leaderboardBanner} alt="Banner leaderboard" className="h-44 w-full object-cover md:h-56" />
              </div>

          <div className="ranking-filter" role="tablist" aria-label="Filtrar ranking por modo de juego">
            {RANKING_FILTERS.map((filter) => (
              <button
                key={filter.id}
                type="button"
                role="tab"
                aria-selected={rankingView === filter.id}
                onClick={() => setRankingView(filter.id)}
                className={`ranking-filter__button${rankingView === filter.id ? " is-active" : ""}`}
              >
                {filter.label}
              </button>
            ))}
          </div>
          

          <div className="mt-6 flex flex-col gap-6 md:flex-row md:items-start">
            <div className="w-full md:w-2/3">
             
              {topCards.length > 0 ? (
                <div className="leaderboard-slider-shell">
                  <div ref={sliderRef} className="leaderboard-slider">
                    <div className="leaderboard-slider__confetti" aria-hidden="true">
                      {sliderSize.width > 0 && sliderSize.height > 0 && (
                        <Confetti
                          width={sliderSize.width}
                          height={sliderSize.height}
                          recycle
                          numberOfPieces={220}
                          gravity={0.09}
                          initialVelocityY={7}
                        />
                      )}
                    </div>

                    <div className="leaderboard-slider__viewport">
                      <div className="leaderboard-slider__track" style={{ transform: `translateX(-${slideIndex * 100}%)` }}>
                        {slides.map((slide, sIdx) => (
                          <div key={`slide-${sIdx}`} className="leaderboard-slider__page">
                            <div className={`grid gap-3 md:gap-4 ${cardsPerSlide === 1 ? "grid-cols-1" : "grid-cols-1 md:grid-cols-3"}`}>
                              {slide.map((card) => (
                                <LeaderboardTopCard
                                  key={`${card.userId}-${card.card.bracketId}`}
                                  rank={card.rank}
                                  playerName={card.displayName}
                                  avatarUrl={card.avatarUrl}
                                  totalPoints={card.totalPoints}
                                  champion={card.card.champion}
                                  runnerUp={card.card.runnerUp}
                                  third={card.card.third}
                                  shareUrl={card.card.shareUrl}
                                />
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {slides.length > 1 && (
                      <>
                        <button
                          type="button"
                          onClick={() => setSlideIndex((current) => Math.max(0, current - 1))}
                          disabled={slideIndex === 0}
                          className="leaderboard-slider__arrow leaderboard-slider__arrow--left"
                          aria-label="Slide anterior"
                        >
                          ‹
                        </button>
                        <button
                          type="button"
                          onClick={() => setSlideIndex((current) => Math.min(slides.length - 1, current + 1))}
                          disabled={slideIndex >= slides.length - 1}
                          className="leaderboard-slider__arrow leaderboard-slider__arrow--right"
                          aria-label="Slide siguiente"
                        >
                          ›
                        </button>
                        <div className="leaderboard-slider__dots" aria-label="Paginacion de slides">
                          {slides.map((_, idx) => (
                            <button
                              key={`dot-${idx}`}
                              type="button"
                              onClick={() => setSlideIndex(idx)}
                              className={`leaderboard-slider__dot${idx === slideIndex ? " is-active" : ""}`}
                              aria-label={`Ir al slide ${idx + 1}`}
                            />
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                !loading &&
                !error && (
                  <div className="rounded-xl border border-white/10 bg-black/30 p-4 text-sm text-gray-300">
                    Aun no hay tarjetas destacadas para mostrar.
                  </div>
                )
              )}
            </div>

            <div className="w-full md:w-1/3">
              {loading && <p className="text-sm text-gray-300">Calculando ranking...</p>}
              {error && <p className="text-sm text-red-300">{error}</p>}

              {!loading && !error && (
                <div className="grid gap-2 mt-10">
                  <div className="flex gap-3 p-2 md:flex-row md:items-center md:justify-between">
                    <h1 className="w-2/3 text-2xl font-black md:text-3xl">Top 5 {rankingViewLabel}</h1>
                   
                  </div>
                  {topFiveRows.length === 0 && (
                    <div className="rounded-xl border border-white/10 bg-black/30 p-4 text-sm text-gray-300">
                      No hay brackets suficientes para construir el ranking.
                    </div>
                  )}
                  {topFiveRows.map((entry, idx) => {
                    const rank = rankByUserId.get(entry.userId) ?? idx + 1;
                    const initial = entry.displayName.trim().charAt(0).toUpperCase() || "U";
                    const tone = rank === 1 ? "gold" : rank === 2 ? "silver" : rank === 3 ? "bronze" : "default";
                    return (
                      <div key={entry.userId} className="overflow-hidden rounded-xl  border-b-white/10 border-b ">
                        <div className="leaderboard-card flex items-center justify-between gap-3 rounded-none border-0 p-3 md:p-4">
                          <div className="min-w-0 flex items-center gap-3 text-left">
                            <div className={`leaderboard-accent leaderboard-accent--${tone} w-8 text-center text-sm font-black`}>#{rank}</div>
                            {entry.avatarUrl ? (
                              <img src={entry.avatarUrl} alt={entry.displayName} className="size-8 rounded-full border border-white/20 object-cover" />
                            ) : (
                              <span className={`leaderboard-avatar leaderboard-avatar--${tone} inline-flex size-5 items-center justify-center rounded-full text-xs font-black text-black`}>
                                {initial}
                              </span>
                            )}
                            <div className="min-w-0">
                              <p className="truncate text-2xl font-semibold">{entry.displayName}</p>
                              <p className="text-xs text-[#c6f600] ">
                                {entry.bracketCount} juegos puntuables
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-gray-300">{entry.totalHits}/{entry.totalEvaluated} aciertos</p>
                            <p className={`leaderboard-accent leaderboard-accent--${tone} text-lg font-black md:text-2xl`}>{entry.totalPoints} pts</p>
                          
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
           <div className="w-full ">
              {loading && <p className="text-sm text-gray-300">Calculando ranking...</p>}
              {error && <p className="text-sm text-red-300">{error}</p>}

              {!loading && !error && (
                <div className="grid gap-2 mt-10">
                  <div className="flex gap-3 p-2 md:flex-row md:items-center md:justify-between">
                    <div className="w-2/3">
                      <h1 className="text-2xl font-black md:text-3xl">Tabla de posiciones</h1>
                      <p className="mt-1 text-xs font-semibold text-gray-400 md:text-sm">
                        {rankingDescription}
                      </p>
                    </div>
                    <div className="relative w-full ">
                      <svg
                        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400"
                        viewBox="0 0 24 24"
                        fill="none"
                        aria-hidden="true"
                      >
                        <path
                          d="M21 21L16.65 16.65M18 11C18 14.866 14.866 18 11 18C7.13401 18 4 14.866 4 11C4 7.13401 7.13401 4 11 4C14.866 4 18 7.13401 18 11Z"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      <input
                        type="text"
                        value={usersSearch}
                        onChange={(event) => setUsersSearch(event.target.value)}
                        placeholder="Buscar Usuario"
                        className="w-full rounded-full border border-white/20 bg-black/40 py-2 pl-9 px-8 text-sm text-white outline-none transition-colors placeholder:text-gray-400 focus:border-[#c6f600]"
                      />
                    </div>
                  </div>
                  {filteredRows.length === 0 && (
                    <div className="rounded-xl border border-white/10 bg-black/30 p-4 text-sm text-gray-300">
                      {usersSearch.trim()
                        ? "No encontramos usuarios con ese alias, nombre o correo."
                        : "No hay brackets suficientes para construir el ranking."}
                    </div>
                  )}
                  {visibleRows.map((entry, idx) => {
                    const rank = rankByUserId.get(entry.userId) ?? idx + 1;
                    const initial = entry.displayName.trim().charAt(0).toUpperCase() || "U";
                    const tone = rank === 1 ? "gold" : rank === 2 ? "silver" : rank === 3 ? "bronze" : "default";
                    const isExpanded = expandedUserId === entry.userId;
                    return (
                      <div key={entry.userId} className="overflow-hidden rounded-xl  border-b-white/10 border-b ">
                        <div className="leaderboard-card flex items-center justify-between gap-3 rounded-none border-0 p-3 md:p-4">
                          <button
                            type="button"
                            onClick={() => setExpandedUserId((current) => (current === entry.userId ? null : entry.userId))}
                            className="min-w-0 flex items-center gap-3 text-left transition-opacity hover:opacity-90"
                          >
                            <div className={`leaderboard-accent leaderboard-accent--${tone} w-8 text-center text-sm font-black`}>#{rank}</div>
                            {entry.avatarUrl ? (
                              <img src={entry.avatarUrl} alt={entry.displayName} className="size-8 rounded-full border border-white/20 object-cover" />
                            ) : (
                              <span className={`leaderboard-avatar leaderboard-avatar--${tone} inline-flex size-5 items-center justify-center rounded-full text-xs font-black text-black`}>
                                {initial}
                              </span>
                            )}
                            <div className="min-w-0">
                              <p className="truncate text-2xl font-semibold">{entry.displayName}</p>
                              <p className="text-xs text-[#c6f600] ">
                                {entry.totalHits}/{entry.totalEvaluated} aciertos  <span className=" ml-2 px-2 text-black rounded-full font-black text-sm bg-[#c6f600]">{isExpanded ? " < Ocultar" : " > Ver Juegos"}</span>
                              </p>
                            </div>
                          </button>
                          <div className="text-right">
                            <p className={`leaderboard-accent leaderboard-accent--${tone} text-lg font-black md:text-2xl`}>{entry.totalPoints} pts</p>
                          
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="border-t border-white/10 bg-black/30 px-3 py-2 md:px-4">
                            <p className="mb-2 text-[11px] uppercase tracking-wide text-gray-400">Juegos Realizados</p>
                            <div className="flex flex-wrap gap-2">
                              {entry.brackets.map((bracket, index) => (
                                <a
                                  key={`${entry.userId}-${bracket.id}-${index}`}
                                  href={bracket.shareUrl}
                                  className=" px-2 py-1 text-xs font-semibold text-[#c6f600] transition-colors hover:border-[#c6f600] hover:bg-[#c6f600]/10"
                                >
                                  {`${bracket.mode === "classic" ? "Clásico" : "Completo"} ${index + 1}`}
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {filteredRows.length > visibleRows.length && (
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => setVisibleUsers((current) => current + 10)}
                        className="w-full rounded-xl border border-white/20 bg-black/30 px-4 py-2 text-sm font-semibold transition-colors hover:border-[#c6f600] hover:text-[#c6f600]"
                      >
                        Más usuarios
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
