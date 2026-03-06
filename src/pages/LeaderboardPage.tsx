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
import { useNavigation } from "../contexts/NavigationContext";
import type { BracketSavePayload } from "../features/bracket/types";
import { computeBracketScore, loadScoreSheetData } from "../features/bracket/score";
import "../styles/globals.css";

type TopCardData = {
  bracketId: string;
  points: number;
  champion: ShareCardTeam;
  runnerUp: ShareCardTeam;
  third: ShareCardTeam;
  shareUrl: string;
};

type BracketShareItem = {
  id: string;
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
const SELECCIONES_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRi2qMMbibzuc4bjv38DBJYnfY24e4Mt0c20CqpDDFzgBn_aJ6NR0HcrXjdbKLhAEsy3zJUdvr3npRU/pub?gid=0&single=true&output=csv";

const normalizeKey = (value?: string) => (value || "").toString().trim().toUpperCase();
const normalizeComparable = (value?: string) =>
  normalizeKey((value || "").toString().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
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
    selections: parsed.selections || {},
    bestThirdIds: parsed.bestThirdIds || [],
    picks: parsed.picks || {},
    intercontinentalPicks: parsed.intercontinentalPicks || {},
    uefaPicks: parsed.uefaPicks || {},
    isLocked: Boolean(parsed.isLocked),
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

const resolveTeamCard = (token: string | undefined, teamIndex: Map<string, TeamIndexValue>): ShareCardTeam => {
  const key = normalizeKey(token);
  if (!key || key === "EMPATE" || key.includes("/")) {
    return { name: "Por definir" };
  }
  const match = teamIndex.get(key) || teamIndex.get(normalizeComparable(key));
  if (match) {
    return {
      name: match.name || key,
      escudo: match.escudo,
    };
  }
  return { name: key };
};

const buildBestCard = (
  payload: BracketSavePayload,
  teamIndex: Map<string, TeamIndexValue>,
  bracketId: string,
  points: number,
  siteBase: string,
): TopCardData => {
  const picks = payload.picks || {};
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
    champion: resolveTeamCard(championToken, teamIndex),
    runnerUp: resolveTeamCard(runnerKey, teamIndex),
    third: resolveTeamCard(thirdToken, teamIndex),
    shareUrl,
  };
};

const chunk = <T,>(items: T[], size: number) => {
  if (size <= 0) return [items];
  const output: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    output.push(items.slice(i, i + size));
  }
  return output;
};

export default function LeaderboardPage() {
  const { navigateTo } = useNavigation();
  const { width: viewportWidth } = useWindowSize();
  const cardsPerSlide = viewportWidth >= 1024 ? 3 : 1;

  const [rows, setRows] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [usersSearch, setUsersSearch] = useState("");
  const [visibleUsers, setVisibleUsers] = useState(6);
  const totalGlobalPoints = useMemo(
    () => rows.reduce((acc, row) => acc + (row.totalPoints || 0), 0),
    [rows],
  );
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
        const [sheetData, bracketResult, fanaticoData, csvTeams] = await Promise.all([
          loadScoreSheetData(),
          supabase
            .from("bracket_saves")
            .select("id,name,short_code,user_id,updated_at,data,is_public,expires_at")
            .eq("is_public", true)
            .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
            .limit(2000),
          fetchFanaticoData(),
          loadFallbackTeamsFromCsv().catch(() => []),
        ]);

        if (bracketResult.error) throw bracketResult.error;

        const brackets = (bracketResult.data || []) as BracketRow[];
        const byUser = new Map<string, LeaderboardEntry>();
        const combinedTeams = [...(fanaticoData?.teams || []), ...csvTeams];
        const teamIndex = buildTeamIndex(combinedTeams);
        const siteBase = resolveSiteBase() || (typeof window !== "undefined" ? window.location.origin : "");

        for (const row of brackets) {
          const userId = (row.user_id || "").toString();
          if (!userId || userId === GUEST_USER_ID) continue;
          const payload = parsePayload(row.data);
          if (!payload) continue;
          const sharedUserId = (payload.sharedBy?.userId || "").toString().trim();
          const sharedIdentity = `${payload.sharedBy?.name || ""} ${payload.sharedBy?.alias || ""}`.toLowerCase();
          const isGuestShared =
            sharedUserId === GUEST_USER_ID ||
            /\binvitado\b|\bguest\b/.test(sharedIdentity);
          if (isGuestShared) continue;

          const summary = computeBracketScore(
            {
              picks: payload.picks || {},
              intercontinentalPicks: payload.intercontinentalPicks || {},
              uefaPicks: payload.uefaPicks || {},
            },
            sheetData,
          );

          const cardCandidate = buildBestCard(payload, teamIndex, row.id, summary.totalPoints, siteBase);
          const prev = byUser.get(userId);
          const displayName = extractName(payload, userId);
          const avatarUrl = extractAvatar(payload);
          const rowSearchTerms = buildSearchTerms(payload, displayName);
          const gameCode = (row.short_code || row.id || "").toString().toUpperCase();
          const bracketItem: BracketShareItem = {
            id: row.id,
            gameCode,
            shareUrl: cardCandidate.shareUrl,
          };

          if (!prev) {
            byUser.set(userId, {
              userId,
              displayName,
              avatarUrl,
              totalPoints: summary.totalPoints,
              totalHits: summary.hitCount,
              totalEvaluated: summary.evaluatedCount,
              bracketCount: 1,
              bestBracketPoints: summary.totalPoints,
              bestCardUpdatedAt: row.updated_at || "",
              updatedAt: row.updated_at || "",
              bestCard: cardCandidate,
              brackets: [bracketItem],
              searchTerms: rowSearchTerms,
            });
            continue;
          }

          prev.totalPoints += summary.totalPoints;
          prev.totalHits += summary.hitCount;
          prev.totalEvaluated += summary.evaluatedCount;
          prev.bracketCount += 1;
          prev.brackets.push(bracketItem);
          prev.searchTerms.push(...rowSearchTerms);
          if (!prev.avatarUrl && avatarUrl) prev.avatarUrl = avatarUrl;
          if (prev.displayName.startsWith("Usuario ") && displayName && !displayName.startsWith("Usuario ")) {
            prev.displayName = displayName;
          }
          if (compareIso(prev.updatedAt, row.updated_at || "") < 0) {
            prev.updatedAt = row.updated_at || prev.updatedAt;
          }

          const shouldReplaceBest =
            summary.totalPoints > prev.bestBracketPoints ||
            (summary.totalPoints === prev.bestBracketPoints &&
              compareIso(prev.bestCardUpdatedAt, row.updated_at || "") < 0);

          if (shouldReplaceBest) {
            prev.bestBracketPoints = summary.totalPoints;
            prev.bestCardUpdatedAt = row.updated_at || prev.bestCardUpdatedAt;
            prev.bestCard = cardCandidate;
          }
        }

        const ranking = Array.from(byUser.values()).sort((a, b) => {
          if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
          if (b.totalHits !== a.totalHits) return b.totalHits - a.totalHits;
          if (b.bestBracketPoints !== a.bestBracketPoints) return b.bestBracketPoints - a.bestBracketPoints;
          return compareIso(b.updatedAt, a.updatedAt);
        });
        ranking.forEach((entry) => {
          entry.brackets.sort((a, b) => {
            return a.gameCode.localeCompare(b.gameCode);
          });
          entry.searchTerms = Array.from(new Set(entry.searchTerms.map((term) => term.trim()).filter(Boolean)));
        });

        if (!active) return;
        setRows(ranking);
      } catch {
        if (!active) return;
        setError("No se pudo cargar el ranking global.");
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
  }, [usersSearch]);

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
                    <h1 className="w-2/3 text-2xl font-black md:text-3xl">Top 5</h1>
                   
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
                          <div className="border-t border-white/10 bg-white px-3 py-2 md:px-4">
                            <p className="mb-2 text-[11px] uppercase tracking-wide text-gray-400">Juegos Realizados</p>
                            <div className="flex flex-wrap gap-2">
                              {entry.brackets.map((bracket, index) => (
                                <a
                                  key={`${entry.userId}-${bracket.id}-${index}`}
                                  href={bracket.shareUrl}
                                  className=" px-2 py-1 text-xs font-semibold text-[#c6f600] transition-colors hover:border-[#c6f600] hover:bg-[#c6f600]/10"
                                >
                                  {`Juego ${index + 1}`}
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
                        onClick={() => setVisibleUsers((current) => current + 6)}
                        className="w-full rounded-xl border border-white/20 bg-black/30 px-4 py-2 text-sm font-semibold transition-colors hover:border-[#c6f600] hover:text-[#c6f600]"
                      >
                        Más usuarios
                      </button>
                    </div>
                  )}
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
                    <h1 className="w-2/3 text-2xl font-black md:text-3xl">Tabla de posiciones</h1>
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
                                  {`Juego ${index + 1}`}
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
