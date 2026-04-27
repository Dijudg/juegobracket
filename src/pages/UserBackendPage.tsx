import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type TouchEvent } from "react";
import { flushSync } from "react-dom";
import type { Session, User } from "@supabase/supabase-js";
import Header from "../components/header";
import Footer from "../components/Footer";
import { supabase } from "../utils/supabaseClient";
import { useNavigation } from "../contexts/NavigationContext";
import { AuthModal } from "../components/AuthModal";
import {
  buildConsentPayload,
  clearPendingConsent,
  readPendingConsent,
  storePendingConsent,
} from "../utils/authConsent";
import { sendConsentNotification } from "../utils/consentNotify";
import { fetchFanaticoData } from "../utils/fanaticoApi";
import type { BracketSavePayload, GroupSelections, Match, Seeds, Team } from "../features/bracket/types";
import {
  applyRepechajeMeta,
  ensureRepechajeTeams,
  getRepechajeFlagUrl,
  getRepechajeMeta,
  getTeamCode,
  getTeamEscudo,
  resolveRepechajeCode,
} from "../features/bracket/utils";
import { useBracketScore } from "../features/bracket/score";
import { EmbeddedViewerMenu } from "../features/bracket/components/EmbeddedViewerMenu";
import thirdLookup from "../data/third_lookup.json";
import winnerCardBg from "../assets/final.jpg";
import logofanatico from "../assets/Logofanatico.svg";
import etLogo from "../assets/ET_LOGO.png";
import ectvLogo from "../assets/ECTV_LOGO.png";
import { ShareCard, type ShareCardTeam } from "../components/ShareCard";
import { createShareCardBlob } from "../utils/shareCardImage";
import { buildSharePageUrl, uploadShareCardImage } from "../utils/shareCardApi";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock";

function BackIcon() {
  return (
    <svg className="size-4" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M11.5 5L6.5 10L11.5 15"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const AVATAR_BUCKET = import.meta.env.VITE_SUPABASE_AVATAR_BUCKET || "avatars";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";
const GROUP_LETTERS = "ABCDEFGHIJKL".split("");
const MAX_THIRD = 8;

type BracketMeta = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  short_code?: string | null;
};

type BracketItem = BracketMeta & {
  data: unknown;
};

type ShareTeamInfo = ShareCardTeam;

type PodiumResult = {
  champion?: Team;
  runnerUp?: Team;
  third?: Team;
};

const formatDate = (value?: string) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("es-EC", {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

const extractGameName = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return "Juego";
  const separators = [" - ", " | ", " ? ", " ? "];
  for (const sep of separators) {
    if (trimmed.includes(sep)) return trimmed.split(sep)[0].trim() || trimmed;
  }
  return trimmed;
};

const resolveProviderAvatar = (meta: Record<string, any>) => {
  if (typeof meta.avatar_url === "string" && meta.avatar_url) return meta.avatar_url;
  if (typeof meta.picture === "string" && meta.picture) return meta.picture;
  if (meta.picture?.data?.url) return meta.picture.data.url as string;
  if (typeof meta.avatar === "string" && meta.avatar) return meta.avatar;
  return "";
};

const DEFAULT_HOME_URL = "https://especiales.eltelegrafo.com.ec/fanaticomundialista/";
const LS_TEAMS = "fm-teams";
const seleccionesUrl =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRi2qMMbibzuc4bjv38DBJYnfY24e4Mt0c20CqpDDFzgBn_aJ6NR0HcrXjdbKLhAEsjy3zJUdvr3npRU/pub?gid=0&single=true&output=csv";

const parseCSVLine = (line: string): string[] => {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === "\"") {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
};

const normalizeTeamKey = (value?: string) => (value || "").trim().toUpperCase();

const buildSeedsFromSelections = (selections: GroupSelections): Seeds => {
  const firsts: Record<string, Team | undefined> = {};
  const seconds: Record<string, Team | undefined> = {};
  const thirds: Record<string, Team | undefined> = {};
  GROUP_LETTERS.forEach((g) => {
    const pick = selections[g] || {};
    firsts[g] = pick.primero;
    seconds[g] = pick.segundo;
    thirds[g] = pick.tercero;
  });
  return { firsts, seconds, thirds };
};

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

const normalizeThirdGroups = (groups: string[]) => {
  const seen = new Set<string>();
  const ordered: string[] = [];
  groups.forEach((g) => {
    const normalized = g?.toString().trim().toUpperCase();
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
      if (used.has(group)) continue;
      if (!allowed.includes(group)) continue;
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

const buildRoundOf32 = (
  seeds: Seeds,
  thirdsQualified: string[],
  lookup: Record<string, Record<string, string>>,
): { matches: Match[] } => {
  const entry = assignThirdGroupsToSeeds(thirdsQualified);
  if (!entry) {
    return { matches: [] };
  }

  const slotTeam = (seed: string): Team | undefined => {
    const group = seed[0];
    const pos = seed[1];
    if (pos === "1") return seeds.firsts[group];
    if (pos === "2") return seeds.seconds[group];
    return undefined;
  };

  const thirdSeedToTeam = (code: string): Team | undefined => {
    const group = code[1];
    return seeds.thirds[group];
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

  const matches: Match[] = roundOf32Base.map((cfg) => {
    const home = cfg.home.startsWith("LKP_") ? thirdSeedToTeam(entry[cfg.home.slice(4)]) : slotTeam(cfg.home);
    const away = cfg.away.startsWith("LKP_") ? thirdSeedToTeam(entry[cfg.away.slice(4)]) : slotTeam(cfg.away);
    return {
      id: `r32-${cfg.id}`,
      label: cfg.id,
      equipoA: home,
      equipoB: away,
    };
  });

  return { matches };
};

const buildNextRounds = (
  base: Match[],
  picks: Record<string, string | undefined>,
): { final: Match[]; thirdPlace: Match[] } => {
  const pickWinner = (match: Match): Team | undefined => {
    const picked = picks[match.id];
    if (picked && (match.equipoA?.id === picked || match.equipoB?.id === picked)) {
      return match.equipoA?.id === picked ? match.equipoA : match.equipoB;
    }
    return undefined;
  };

  const attachWinners = (matches: Match[]): Match[] =>
    matches.map((m) => {
      const ganador = pickWinner(m);
      const perdedor =
        ganador && m.equipoA && m.equipoB
          ? ganador.id === m.equipoA.id
            ? m.equipoB
            : m.equipoA
          : undefined;
      return { ...m, ganador, perdedor };
    });

  const r32 = attachWinners(base);

  const findWinner = (id: string) => r32.find((m) => m.id === id)?.ganador;

  const r16map = [
    { id: "r16-89", label: "89", a: "r32-73", b: "r32-74" },
    { id: "r16-90", label: "90", a: "r32-75", b: "r32-76" },
    { id: "r16-91", label: "91", a: "r32-77", b: "r32-78" },
    { id: "r16-92", label: "92", a: "r32-79", b: "r32-80" },
    { id: "r16-93", label: "93", a: "r32-81", b: "r32-82" },
    { id: "r16-94", label: "94", a: "r32-83", b: "r32-84" },
    { id: "r16-95", label: "95", a: "r32-85", b: "r32-86" },
    { id: "r16-96", label: "96", a: "r32-87", b: "r32-88" },
  ];

  const r16 = attachWinners(
    r16map.map((m) => ({
      id: m.id,
      label: m.label,
      equipoA: findWinner(m.a),
      equipoB: findWinner(m.b),
    })),
  );

  const qfMap = [
    { id: "qf-97", label: "97", a: "r16-89", b: "r16-90" },
    { id: "qf-98", label: "98", a: "r16-91", b: "r16-92" },
    { id: "qf-99", label: "99", a: "r16-93", b: "r16-94" },
    { id: "qf-100", label: "100", a: "r16-95", b: "r16-96" },
  ];
  const qf = attachWinners(
    qfMap.map((m) => ({
      id: m.id,
      label: m.label,
      equipoA: r16.find((x) => x.id === m.a)?.ganador,
      equipoB: r16.find((x) => x.id === m.b)?.ganador,
    })),
  );

  const sfMap = [
    { id: "sf-101", label: "101", a: "qf-97", b: "qf-98" },
    { id: "sf-102", label: "102", a: "qf-99", b: "qf-100" },
  ];
  const sf = attachWinners(
    sfMap.map((m) => ({
      id: m.id,
      label: m.label,
      equipoA: qf.find((x) => x.id === m.a)?.ganador,
      equipoB: qf.find((x) => x.id === m.b)?.ganador,
    })),
  );

  const final = attachWinners([
    {
      id: "final-104",
      label: "104",
      equipoA: sf.find((x) => x.id === "sf-101")?.ganador,
      equipoB: sf.find((x) => x.id === "sf-102")?.ganador,
    },
  ]);

  const thirdPlace = attachWinners([
    {
      id: "third-103",
      label: "103",
      equipoA: sf.find((x) => x.id === "sf-101")?.perdedor,
      equipoB: sf.find((x) => x.id === "sf-102")?.perdedor,
    },
  ]);

  return { final, thirdPlace };
};


const readTeamsFromStorage = () => {
  if (typeof window === "undefined") return [] as Team[];
  try {
    const raw = window.localStorage.getItem(LS_TEAMS);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Team[];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
};

export default function UserBackendPage() {
  const { navigateTo } = useNavigation();
  const defaultViewerTab = "repechajes";
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<BracketMeta[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [detailsMap, setDetailsMap] = useState<Record<string, BracketItem>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailsBusy, setDetailsBusy] = useState(false);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const viewerFrameRef = useRef<HTMLIFrameElement>(null);
  const shareCardRef = useRef<HTMLDivElement>(null);
  const [shareBusyId, setShareBusyId] = useState<string | null>(null);
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const shareStatusTimerRef = useRef<number | null>(null);
  const showShareStatus = useCallback((message: string, timeoutMs = 3500) => {
    setShareStatus(message);
    if (typeof window === "undefined") return;
    if (shareStatusTimerRef.current) {
      window.clearTimeout(shareStatusTimerRef.current);
      shareStatusTimerRef.current = null;
    }
    if (timeoutMs > 0) {
      shareStatusTimerRef.current = window.setTimeout(() => {
        setShareStatus(null);
        shareStatusTimerRef.current = null;
      }, timeoutMs);
    }
  }, []);
  const [shareCoverOverride, setShareCoverOverride] = useState<string | null>(null);
  const [activeShareCard, setActiveShareCard] = useState<{
    id: string;
    champion: ShareTeamInfo;
    runnerUp: ShareTeamInfo;
    third: ShareTeamInfo;
    shareUrl: string;
  } | null>(null);
  const [viewerTab, setViewerTab] = useState<"repechajes" | "grupos" | "dieciseisavos" | "llaves">(defaultViewerTab);
  const [viewerPlayoffTab, setViewerPlayoffTab] = useState<"uefa" | "intercontinental">("uefa");
  const [showAuthModal, setShowAuthModal] = useState(false);
  const autoAuthOpenRef = useRef(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  useBodyScrollLock(showAuthModal);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [pronosticosIndex, setPronosticosIndex] = useState(0);
  const [pronosticosDirection, setPronosticosDirection] = useState<"next" | "prev" | null>(null);
  const pronosticosTouchStartX = useRef<number | null>(null);
  const pronosticosTouchStartY = useRef<number | null>(null);
  const [consentMarketing, setConsentMarketing] = useState(false);
  const [consentNews, setConsentNews] = useState(false);
  const [consentUpdates, setConsentUpdates] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileAlias, setProfileAlias] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [teams, setTeams] = useState<Team[]>([]);
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [showSideMenu, setShowSideMenu] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [credentialsBusy, setCredentialsBusy] = useState(false);
  const [credentialsError, setCredentialsError] = useState<string | null>(null);
  const [credentialsSuccess, setCredentialsSuccess] = useState<string | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [coverBusy, setCoverBusy] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const avatarSyncRef = useRef<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<"profile" | "settings" | "claim">("profile");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [claimCode, setClaimCode] = useState("");
  const [claimBusy, setClaimBusy] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [claimSuccess, setClaimSuccess] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const applyPendingConsent = async (session?: Session | null) => {
      if (!session?.user) return;
      const pending = readPendingConsent();
      if (!pending) return;
      try {
        await supabase.auth.updateUser({ data: pending });
        const email = session.user.email || "";
        if (email) {
          void sendConsentNotification({
            email,
            userId: session.user.id,
            consent: pending,
            method: "oauth",
            source: pending.consent_source,
            apiBaseUrl: API_BASE_URL,
          });
        }
      } catch {
        // ignore
      } finally {
        clearPendingConsent();
      }
    };
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) return;
        setSession(data.session ?? null);
        setUser(data.session?.user ?? null);
        setLoading(false);
        void applyPendingConsent(data.session);
      })
      .catch(() => setLoading(false));

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession ?? null);
      setUser(nextSession?.user ?? null);
      void applyPendingConsent(nextSession);
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    const loadTeams = async () => {
      try {
        const apiData = await fetchFanaticoData();
        if (apiData?.teams?.length) {
          const parsedTeams: Team[] = apiData.teams.map((team, idx) => ({
            id: team.id?.toString() || team.codigo_fixture?.toString() || `team-${idx + 1}`,
            nombre: team.seleccion?.toString() || `Equipo ${idx + 1}`,
            codigo: team.codigo_fixture?.toString() || team.id?.toString() || "",
            grupo: (team.grupo || "").toString().toUpperCase(),
            escudo: team.escudo_url,
          }));
          const mergedTeams = ensureRepechajeTeams(parsedTeams.map(applyRepechajeMeta));
          if (mounted) setTeams(mergedTeams);
          return;
        }
        const resp = await fetch(apiData?.config?.sheets?.teamsUrl || seleccionesUrl);
        if (!resp.ok) {
          if (mounted) setTeams(readTeamsFromStorage());
          return;
        }
        const csv = await resp.text();
        if (csv.includes("<!DOCTYPE html") || csv.toLowerCase().includes("no se encontró la página")) {
          if (mounted) setTeams(readTeamsFromStorage());
          return;
        }
        const lines = csv.split("\n").filter((l) => l.trim());
        if (!lines.length) {
          if (mounted) setTeams(readTeamsFromStorage());
          return;
        }
        const headers = lines[0]
          .split(",")
          .map((h) => h.trim().toLowerCase().replace(/"/g, ""));
        const idxId = headers.findIndex((h) => h === "id");
        const idxCodigo = headers.findIndex((h) => h === "codigo_fixture");
        const idxNombre = headers.findIndex((h) => h === "seleccion");
        const idxGrupo = headers.findIndex((h) => h === "grupo");
        const idxEscudo = headers.findIndex((h) => h.includes("escudo") || h.includes("bandera"));
        if (idxId === -1 && idxCodigo === -1 && idxNombre === -1) {
          if (mounted) setTeams(readTeamsFromStorage());
          return;
        }
        const parsed: Team[] = [];
        for (let i = 1; i < lines.length; i++) {
          const cols = parseCSVLine(lines[i]);
          if (cols.length === 0) continue;
          const id = idxId >= 0 ? cols[idxId] : `team-${i}`;
          const codigoFixture = idxCodigo >= 0 ? cols[idxCodigo] : "";
          const nombre = idxNombre >= 0 ? cols[idxNombre] : id || codigoFixture;
          const grupo = idxGrupo >= 0 ? cols[idxGrupo] : "";
          parsed.push({
            id,
            nombre,
            codigo: codigoFixture || id,
            grupo: grupo.toUpperCase(),
            escudo: idxEscudo >= 0 ? cols[idxEscudo] : undefined,
          });
        }
        const mergedTeams = ensureRepechajeTeams(parsed.map(applyRepechajeMeta));
        if (mounted) setTeams(mergedTeams);
      } catch {
        if (mounted) setTeams(readTeamsFromStorage());
      }
    };
    loadTeams();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!session?.access_token) {
      setItems([]);
      setDetailsMap({});
      setSelectedId(null);
      setClaimCode("");
      setClaimBusy(false);
      setClaimError(null);
      setClaimSuccess(null);
    }
  }, [session?.access_token]);

  useEffect(() => {
    if (!user) {
      setProfileName("");
      setProfileAlias("");
      setAvatarUrl("");
      setCoverUrl("");
      setNewEmail("");
      setNewPassword("");
      setConfirmPassword("");
      setProfileError(null);
      setProfileSuccess(null);
      setCredentialsError(null);
      setCredentialsSuccess(null);
      setDeleteError(null);
      return;
    }
    const meta = (user.user_metadata || {}) as Record<string, any>;
    const providerAvatar = resolveProviderAvatar(meta);
    setProfileName(meta.full_name || meta.name || "");
    setProfileAlias(meta.alias || meta.nickname || "");
    setAvatarUrl(providerAvatar || "");
    setCoverUrl(meta.cover_url || "");
    setNewEmail(user.email || "");
    if (!meta.avatar_url && providerAvatar && user.id && !avatarSyncRef.current[user.id]) {
      avatarSyncRef.current[user.id] = true;
      supabase.auth
        .updateUser({ data: { avatar_url: providerAvatar } })
        .then(({ data }) => {
          if (data.user) setUser(data.user);
        })
        .catch(() => null);
    }
  }, [user?.id]);

  const loadBrackets = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from("bracket_saves")
        .select("id,name,short_code,created_at,updated_at")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });
      if (fetchError) throw fetchError;
      setItems((data || []) as BracketMeta[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos cargar los brackets.");
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (user?.id) {
      void loadBrackets();
    }
  }, [loadBrackets, user?.id]);

  const getBracketDetails = useCallback(
    async (id: string) => {
      if (!user?.id) return null;
      const cached = detailsMap[id];
      if (cached) return cached;
      const { data, error: fetchError } = await supabase
        .from("bracket_saves")
        .select("id,name,short_code,data,created_at,updated_at")
        .eq("id", id)
        .eq("user_id", user.id)
        .maybeSingle();
      if (fetchError) throw fetchError;
      if (data) {
        setDetailsMap((prev) => ({ ...prev, [id]: data as BracketItem }));
        return data as BracketItem;
      }
      return null;
    },
    [detailsMap, user?.id],
  );


  const sendViewerNav = useCallback(
    (tab: "repechajes" | "grupos" | "dieciseisavos" | "llaves", playoffTab?: "uefa" | "intercontinental", scrollId?: string) => {
      const nextTab = tab;
      setViewerTab(nextTab);
      if (playoffTab) setViewerPlayoffTab(playoffTab);
      if (typeof window === "undefined") return;
      const target = viewerFrameRef.current?.contentWindow;
      if (!target) return;
      target.postMessage({ type: "BRACKET_VIEW_NAV", tab: nextTab, playoffTab, scrollId }, window.location.origin);
    },
    [],
  );

  const selectedItem = selectedId ? detailsMap[selectedId] : null;
  const selectedPayload = useMemo<BracketSavePayload | null>(() => {
    if (!selectedItem?.data) return null;
    if (typeof selectedItem.data === "string") {
      try {
        return JSON.parse(selectedItem.data) as BracketSavePayload;
      } catch {
        return null;
      }
    }
    return selectedItem.data as BracketSavePayload;
  }, [selectedItem?.data]);
  const selectedBracketCode = useMemo(
    () => (selectedItem?.short_code || selectedItem?.id || "").toString().toUpperCase(),
    [selectedItem?.id, selectedItem?.short_code],
  );
  const selectedScoreInput = useMemo(
    () => ({
      picks: selectedPayload?.picks || {},
      intercontinentalPicks: selectedPayload?.intercontinentalPicks || {},
      uefaPicks: selectedPayload?.uefaPicks || {},
    }),
    [selectedPayload],
  );
  const { summary: selectedScoreSummary, loading: selectedScoreLoading } = useBracketScore(
    selectedScoreInput,
    !!selectedItem && viewerId === selectedItem.id,
  );

  const userLabel = useMemo(() => user?.email || user?.id || "Usuario", [user]);
  const teamIndex = useMemo(() => {
    const map = new Map<string, Team>();
    teams.forEach((team) => {
      const keys = [team.id, team.codigo, getTeamCode(team)]
        .filter(Boolean)
        .map((value) => normalizeTeamKey(value as string));
      keys.forEach((key) => {
        if (key) map.set(key, team);
      });
    });
    return map;
  }, [teams]);
  const resolveAnyTeam = useCallback(
    (value?: string) => {
      const key = normalizeTeamKey(value);
      if (!key) return undefined;
      return teamIndex.get(key);
    },
    [teamIndex],
  );

  const resolveTeamForGroup = useCallback(
    (code?: string, group?: string) => {
      if (!code) return undefined;
      const base =
        resolveAnyTeam(code) ||
        resolveAnyTeam(code.toUpperCase()) ||
        resolveAnyTeam(code.toLowerCase());
      const meta = getRepechajeMeta(code);
      const canonicalCode = resolveRepechajeCode(code);
      const targetGroup = group?.toUpperCase();
      if (!base && meta) {
        return {
          id: canonicalCode || code,
          nombre: meta.nombre,
          codigo: canonicalCode || code,
          grupo: targetGroup || "",
          escudo: getRepechajeFlagUrl(meta.flagCode),
        } as Team;
      }
      if (!base) {
        return {
          id: code,
          nombre: code,
          codigo: code,
          grupo: targetGroup || "",
        } as Team;
      }
      let patched = base;
      if (meta) {
        patched = {
          ...patched,
          nombre: meta.nombre,
          escudo: getRepechajeFlagUrl(meta.flagCode),
        };
      }
      if (targetGroup && patched.grupo?.toUpperCase() !== targetGroup) {
        return { ...patched, grupo: targetGroup };
      }
      return patched;
    },
    [resolveAnyTeam],
  );

  const buildSelectionsFromPayload = useCallback(
    (payload?: BracketSavePayload): GroupSelections => {
      const nextSelections: GroupSelections = {};
      if (!payload?.selections) return nextSelections;
      Object.entries(payload.selections).forEach(([group, pick]) => {
        nextSelections[group] = {
          primero: resolveTeamForGroup(pick.primeroId, group),
          segundo: resolveTeamForGroup(pick.segundoId, group),
          tercero: resolveTeamForGroup(pick.terceroId, group),
        };
      });
      return nextSelections;
    },
    [resolveTeamForGroup],
  );

  const computePodium = useCallback(
    (payload?: BracketSavePayload): PodiumResult => {
      if (!payload) return {};
      const selections = buildSelectionsFromPayload(payload);
      const seeds = buildSeedsFromSelections(selections);
      const thirdsAvailable = GROUP_LETTERS.map((g) => selections[g]?.tercero).filter(Boolean) as Team[];
      const thirdsQualifiedGroups = (payload.bestThirdIds || [])
        .map((id) => thirdsAvailable.find((team) => team.id === id))
        .filter(Boolean)
        .map((team) => team!.grupo?.toUpperCase())
        .filter(Boolean) as string[];
      const picks = payload.picks || {};
      const championFallback = resolveTeamForGroup(picks["final-104"]);
      const thirdFallback = resolveTeamForGroup(picks["third-103"]);
      if (thirdsQualifiedGroups.length < MAX_THIRD) {
        return { champion: championFallback, runnerUp: undefined, third: thirdFallback };
      }
      const { matches } = buildRoundOf32(seeds, thirdsQualifiedGroups, thirdLookup as Record<string, Record<string, string>>);
      const { final, thirdPlace } = buildNextRounds(matches, picks);
      const finalMatch = final[0];
      const thirdMatch = thirdPlace[0];
      return {
        champion: finalMatch?.ganador || championFallback,
        runnerUp: finalMatch?.perdedor,
        third: thirdMatch?.ganador || thirdFallback,
      };
    },
    [buildSelectionsFromPayload, resolveTeamForGroup],
  );

  const buildShareUrl = useCallback((id: string) => {
    if (typeof window === "undefined") return "";
    const sharePage = buildSharePageUrl(id, API_BASE_URL || undefined);
    if (sharePage) return sharePage;
    return new URL(`/share/${id}`, window.location.origin).toString();
  }, []);

  const shareCoverUrl = useMemo(() => shareCoverOverride || coverUrl || winnerCardBg, [shareCoverOverride, coverUrl]);

  const sharePronostico = useCallback(
    async (payload: {
      id: string;
      champion: ShareTeamInfo;
      runnerUp: ShareTeamInfo;
      third: ShareTeamInfo;
      shareUrl: string;
    }) => {
      if (typeof window === "undefined") return;
      if (!navigator.share) {
        showShareStatus("Compartir no está disponible en este dispositivo.", 3000);
        return;
      }
      const sharePageUrl = buildSharePageUrl(payload.id, API_BASE_URL || undefined) || payload.shareUrl;
      const messageParts = [
        `Mi pronósticos Mundialista: campeón ${payload.champion.name}.`,
        payload.runnerUp.name !== "Por definir" ? `Segundo: ${payload.runnerUp.name}.` : "",
        payload.third.name !== "Por definir" ? `Tercero: ${payload.third.name}.` : "",
      ].filter(Boolean);
      const baseMessage = messageParts.join(" ");
      const shareTitle = "Mi pronóstico Mundialista";
      setShareBusyId(payload.id);
      showShareStatus("Generando tarjeta...", 0);
      flushSync(() => setActiveShareCard(payload));

      try {
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const target = shareCardRef.current || document.getElementById("share-card-capture");
        const blob = await createShareCardBlob(payload, target || undefined, {
          backgroundColor: "#1d1d1b",
          coverUrl: shareCoverUrl || winnerCardBg,
          forceFallback: true,
        });

        let finalSharePageUrl = sharePageUrl;
        if (session?.access_token) {
          try {
            showShareStatus("Subiendo imagen...", 0);
            const uploaded = await uploadShareCardImage({
              apiBaseUrl: API_BASE_URL || undefined,
              bracketId: payload.id,
              token: session.access_token,
              blob,
            });
            if (uploaded?.sharePageUrl) finalSharePageUrl = uploaded.sharePageUrl;
            showShareStatus("Imagen subida.", 3000);
          } catch {
            showShareStatus("No se pudo subir la imagen. Compartiendo sin preview.", 4000);
          }
        }

        const finalMessage = baseMessage;
        const file = new File([blob], `pronostico-${payload.id}.png`, { type: "image/png" });
        const canShareFile = !!(navigator.canShare && navigator.canShare({ files: [file] }));
        if (canShareFile) {
          await navigator.share({ files: [file], title: shareTitle, text: finalMessage, url: finalSharePageUrl });
        } else {
          await navigator.share({ title: shareTitle, text: finalMessage, url: finalSharePageUrl });
        }
      } catch {
        showShareStatus("No se pudo generar la tarjeta.", 4000);
      } finally {
        setShareBusyId(null);
        setActiveShareCard(null);
      }
    },
    [shareCoverUrl, session?.access_token],
  );
  const canEdit = !!session?.access_token;
  const avatarInitial = useMemo(() => {
    const base = profileAlias || profileName || user?.email || "U";
    return base.trim().charAt(0).toUpperCase() || "U";
  }, [profileAlias, profileName, user?.email]);
  const games = useMemo(() => {
    if (!items.length) return [];
    const map = new Map<string, { name: string; count: number; latest: string; latestId: string }>();
    items.forEach((item) => {
      const name = extractGameName(item.name || "Mi Pronóstico del Mundial 2026");
      const current = map.get(name) || {
        name,
        count: 0,
        latest: item.updated_at,
        latestId: item.id,
      };
      current.count += 1;
      if (item.updated_at && item.updated_at > current.latest) {
        current.latest = item.updated_at;
        current.latestId = item.id;
      }
      map.set(name, current);
    });
    return Array.from(map.values());
  }, [items]);
  useEffect(() => {
    if (!session?.access_token || !games.length) return;
    const missing = games.filter((game) => game.latestId && !detailsMap[game.latestId]);
    if (!missing.length) return;
    void Promise.all(missing.map((game) => getBracketDetails(game.latestId))).catch(() => null);
  }, [games, detailsMap, getBracketDetails, session?.access_token]);
  const totalBrackets = items.length;
  const totalGames = games.length;
  const lastActivity = useMemo(() => {
    if (!items.length) return null;
    return items.reduce((latest, item) => {
      const value = item.updated_at || "";
      if (!latest) return value;
      return value > latest ? value : latest;
    }, items[0]?.updated_at || "");
  }, [items]);
  const displayName = profileAlias || profileName || user?.email || "Usuario";
  const displaySubtitle = profileName || user?.email || "Completa tu perfil";

  useEffect(() => {
    if (!games.length) {
      if (pronosticosIndex !== 0) setPronosticosIndex(0);
      return;
    }
    const maxIndex = Math.max(0, games.length - 1);
    if (pronosticosIndex > maxIndex) {
      setPronosticosIndex(maxIndex);
    }
  }, [games.length, pronosticosIndex]);

  const handlePronosticosSlide = (direction: "next" | "prev") => {
    setPronosticosIndex((current) => {
      const maxIndex = Math.max(0, games.length - 1);
      if (direction === "next") {
        if (current >= maxIndex) return current;
        setPronosticosDirection("next");
        return current + 1;
      }
      if (current <= 0) return current;
      setPronosticosDirection("prev");
      return current - 1;
    });
  };

  const resetPronosticosTouch = () => {
    pronosticosTouchStartX.current = null;
    pronosticosTouchStartY.current = null;
  };

  const handlePronosticosTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    if (!touch) return;
    pronosticosTouchStartX.current = touch.clientX;
    pronosticosTouchStartY.current = touch.clientY;
  };

  const handlePronosticosTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    if (games.length < 2) {
      resetPronosticosTouch();
      return;
    }
    const startX = pronosticosTouchStartX.current;
    const startY = pronosticosTouchStartY.current;
    resetPronosticosTouch();
    if (startX == null || startY == null) return;
    const touch = event.changedTouches[0];
    if (!touch) return;
    const deltaX = touch.clientX - startX;
    const deltaY = touch.clientY - startY;
    if (Math.abs(deltaX) < 40 || Math.abs(deltaX) < Math.abs(deltaY)) return;
    if (deltaX < 0) {
      handlePronosticosSlide("next");
    } else {
      handlePronosticosSlide("prev");
    }
  };

  const renderGameCard = (game: { name: string; latestId: string }) => {
    const latest = detailsMap[game.latestId];
    let payload = latest?.data as BracketSavePayload | undefined;
    if (typeof latest?.data === "string") {
      try {
        payload = JSON.parse(latest.data) as BracketSavePayload;
      } catch {
        payload = undefined;
      }
    }
    const podium = computePodium(payload);
    const championIdRaw = payload?.picks?.["final-104"];
    const championKey = normalizeTeamKey(championIdRaw);
    let championTeam = podium.champion;
    if (!championTeam && championKey) {
      championTeam =
        teamIndex.get(championKey) ||
        teams.find(
          (team) =>
            normalizeTeamKey(team.id) === championKey ||
            normalizeTeamKey(team.codigo) === championKey ||
            normalizeTeamKey(getTeamCode(team)) === championKey,
        );
    }
    const championName = championTeam?.nombre || (championKey ? championKey : "Por definir");
    const championEscudo = getTeamEscudo(championTeam);
    const runnerUpTeam = podium.runnerUp;
    const thirdTeam = podium.third;
    const runnerUpInfo: ShareTeamInfo = runnerUpTeam
      ? { name: runnerUpTeam.nombre || runnerUpTeam.id, escudo: getTeamEscudo(runnerUpTeam) }
      : { name: "Por definir" };
    const thirdInfo: ShareTeamInfo = thirdTeam
      ? { name: thirdTeam.nombre || thirdTeam.id, escudo: getTeamEscudo(thirdTeam) }
      : { name: "Por definir" };
    const championInfo: ShareTeamInfo = { name: championName, escudo: championEscudo };
    const shareUrl = buildShareUrl(game.latestId);
    const bracketCode =
      (latest as BracketItem | undefined)?.short_code ||
      items.find((item) => item.id === game.latestId)?.short_code ||
      "";
    const sharePayload = {
      id: game.latestId,
      champion: championInfo,
      runnerUp: runnerUpInfo,
      third: thirdInfo,
      shareUrl,
    };

    return (
      <div className="rounded-lg overflow-hidden rounded-xl shadow-xl bg-neutral-800 pb-6 flex flex-col">
        <div className="relative h-42">
          <img src={winnerCardBg} alt="Ganador" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/0 via-black/30 to-black/80" />
        </div>
        <div className="relative -mt-10 px-5 pb-5 flex flex-col items-center text-center">
          <div className="w-24 h-24 rounded-full border-4 border-[#0b0b0b] bg-black shadow-lg overflow-hidden flex items-center justify-center">
            {championEscudo ? (
              <img src={championEscudo} alt={championName} className="w-full h-full object-cover" />
            ) : (
              <span className="text-xs text-gray-500 uppercase">N/A</span>
            )}
          </div>

          <div className="mt-2 flex items-center gap-2">
            <span className="text-3xl font-black uppercase text-white">{championName}</span>
            <span className="text-3xl font-black uppercase text-[#c6f600]">Campeón</span>
          </div>

          <button
            type="button"
            onClick={async () => {
              setViewerId(game.latestId);
              setSelectedId(game.latestId);
              setViewerTab(defaultViewerTab);
              setViewerPlayoffTab("uefa");
              await getBracketDetails(game.latestId);
              document.getElementById("viewer-bracket")?.scrollIntoView({ behavior: "smooth" });
            }}
            className="mt-3 w-full rounded-full bg-[#c6f600] text-black text-sm font-bold py-2 hover:brightness-95"
          >
            Ver todo mi pronósticos
          </button>
          <div className="mt-3 w-full flex items-center justify-center text-base text-gray-400">
            <button
              type="button"
              onClick={() => sharePronostico(sharePayload)}
              disabled={shareBusyId === game.latestId}
              className="w-full rounded-full bg-[#c6f600] text-black text-sm font-bold py-2 hover:brightness-95 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              Compartir
            </button>
          </div>
          {bracketCode && (
            <div className="mt-2 text-xs text-gray-400">
              Código: <span className="font-semibold text-white">{bracketCode}</span>
            </div>
          )}
          {shareBusyId === game.latestId && shareStatus && (
            <div className="mt-2 text-xs text-gray-400">{shareStatus}</div>
          )}
        </div>
      </div>
    );
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigateTo("home");
  };

  const handleClaimBracket = async () => {
    if (!session?.access_token) {
      setClaimError("Inicia sesi?n para agregar un Pron?stico.");
      setClaimSuccess(null);
      return;
    }
    const shortCode = claimCode.trim().toUpperCase();
    if (!shortCode) {
      setClaimError("Ingresa el c?digo del Pron?stico.");
      setClaimSuccess(null);
      return;
    }
    setClaimBusy(true);
    setClaimError(null);
    setClaimSuccess(null);
    try {
      const rawBase = API_BASE_URL || (typeof window !== "undefined" ? window.location.origin : "");
      const baseUrl = rawBase
        ? /^https?:\/\//i.test(rawBase)
          ? rawBase
          : `https://${rawBase}`
        : "";
      if (!baseUrl) throw new Error("No se pudo conectar al servidor.");
      const res = await fetch(`${baseUrl}/api/guest-brackets/claim`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ shortCode }),
      });
      if (!res.ok) {
        let message = "No pudimos agregar el bracket.";
        try {
          const payload = (await res.json()) as { error?: string };
          if (payload?.error) message = payload.error;
        } catch {
          const text = await res.text().catch(() => "");
          if (text) message = text;
        }
        throw new Error(message);
      }
      setClaimSuccess("Bracket agregado a tu cuenta.");
      setClaimCode("");
      await loadBrackets();
    } catch (err) {
      setClaimError(err instanceof Error ? err.message : "No pudimos agregar el bracket.");
    } finally {
      setClaimBusy(false);
    }
  };

  const openAuthModal = (mode: "login" | "signup") => {
    setAuthMode(mode);
    setAuthError(null);
    setAuthSuccess(null);
    if (mode === "signup") {
      setConsentMarketing(false);
      setConsentNews(false);
      setConsentUpdates(false);
    }
    setShowAuthModal(true);
  };

  useEffect(() => {
    if (session?.access_token) {
      autoAuthOpenRef.current = false;
      return;
    }
    if (loading) return;
    if (autoAuthOpenRef.current) return;
    autoAuthOpenRef.current = true;
    openAuthModal("login");
  }, [loading, session?.access_token, openAuthModal]);

  const handleAuthModeChange = (mode: "login" | "signup") => {
    setAuthMode(mode);
    setAuthError(null);
    setAuthSuccess(null);
    if (mode === "signup") {
      setConsentMarketing(false);
      setConsentNews(false);
      setConsentUpdates(false);
    }
  };

  const closeAuthModal = () => {
    setShowAuthModal(false);
    setAuthError(null);
    setAuthSuccess(null);
    setAuthPassword("");
  };

  const handleAuthSubmit = async () => {
    if (!authEmail || !authPassword) {
      setAuthError("Completa tu correo y contrase?a.");
      return;
    }
    setAuthBusy(true);
    setAuthError(null);
    setAuthSuccess(null);
    try {
      if (authMode === "signup") {
        const consentPayload = buildConsentPayload({
          marketing: consentMarketing,
          news: consentNews,
          updates: consentUpdates,
          source: "signup-email",
        });
        const { data, error } = await supabase.auth.signUp({
          email: authEmail,
          password: authPassword,
          options: { emailRedirectTo: window.location.origin, data: consentPayload },
        });
        if (error) throw error;
        void sendConsentNotification({
          email: authEmail,
          userId: data.user?.id,
          consent: consentPayload,
          method: "email",
          source: consentPayload.consent_source,
          apiBaseUrl: API_BASE_URL,
        });
        setAuthSuccess("Cuenta creada. Revisa tu correo para confirmar.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: authEmail,
          password: authPassword,
        });
        if (error) throw error;
        setShowAuthModal(false);
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "No pudimos iniciar sesi?n.");
    } finally {
      setAuthBusy(false);
    }
  };

  const handleOAuthSignIn = async (provider: "google") => {
    setAuthBusy(true);
    setAuthError(null);
    try {
      if (authMode === "signup") {
        const consentPayload = buildConsentPayload({
          marketing: consentMarketing,
          news: consentNews,
          updates: consentUpdates,
          source: `signup-oauth:${provider}`,
        });
        storePendingConsent(consentPayload);
      }
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: window.location.href },
      });
      if (error) throw error;
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "No pudimos conectar con el proveedor.");
      setAuthBusy(false);
    }
  };

  const handleProfileSave = async () => {
    if (!session?.access_token) {
      setProfileError("Inicia sesión para actualizar tu perfil.");
      return;
    }
    setProfileBusy(true);
    setProfileError(null);
    setProfileSuccess(null);
    try {
      const payload = {
        full_name: profileName.trim(),
        alias: profileAlias.trim(),
        avatar_url: avatarUrl.trim(),
        cover_url: coverUrl.trim(),
      };
      const { data, error } = await supabase.auth.updateUser({ data: payload });
      if (error) throw error;
      if (data.user) setUser(data.user);
      setProfileSuccess("Perfil actualizado.");
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : "No pudimos actualizar tu perfil.");
    } finally {
      setProfileBusy(false);
    }
  };

  const handleEmailUpdate = async () => {
    if (!session?.access_token) {
      setCredentialsError("Inicia sesión para actualizar tu correo.");
      return;
    }
    const email = newEmail.trim();
    if (!email) {
      setCredentialsError("Ingresa un correo válido.");
      return;
    }
    if (email === user?.email) {
      setCredentialsError("El correo coincide con el actual.");
      return;
    }
    setCredentialsBusy(true);
    setCredentialsError(null);
    setCredentialsSuccess(null);
    try {
      const { data, error } = await supabase.auth.updateUser({ email });
      if (error) throw error;
      if (data.user) setUser(data.user);
      setCredentialsSuccess("Te enviamos un correo para confirmar el cambio.");
    } catch (err) {
      setCredentialsError(err instanceof Error ? err.message : "No pudimos actualizar el correo.");
    } finally {
      setCredentialsBusy(false);
    }
  };

  const handlePasswordUpdate = async () => {
    if (!session?.access_token) {
      setCredentialsError("Inicia sesión para actualizar tu contraseña.");
      return;
    }
    if (!newPassword) {
      setCredentialsError("Ingresa una contraseña nueva.");
      return;
    }
    if (newPassword.length < 6) {
      setCredentialsError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setCredentialsError("Las contraseñas no coinciden.");
      return;
    }
    setCredentialsBusy(true);
    setCredentialsError(null);
    setCredentialsSuccess(null);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setNewPassword("");
      setConfirmPassword("");
      setCredentialsSuccess("Contraseña actualizada.");
    } catch (err) {
      setCredentialsError(err instanceof Error ? err.message : "No pudimos actualizar la contraseña.");
    } finally {
      setCredentialsBusy(false);
    }
  };

  const handleAvatarPick = () => {
    avatarInputRef.current?.click();
  };

  const handleAvatarFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;
    if (!file.type.startsWith("image/")) {
      setProfileError("Selecciona un archivo de imagen.");
      return;
    }
    setAvatarBusy(true);
    setProfileError(null);
    setProfileSuccess(null);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/avatar.${ext}`;
      const { error } = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(path, file, { upsert: true, cacheControl: "3600" });
      if (error) throw error;
      const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
      if (data?.publicUrl) {
        setAvatarUrl(data.publicUrl);
        setProfileSuccess("Avatar cargado. Guarda cambios para aplicar.");
      } else {
        setProfileError("No pudimos obtener la URL del avatar.");
      }
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : "No pudimos subir el avatar.");
    } finally {
      setAvatarBusy(false);
      event.target.value = "";
    }
  };

  const handleCoverPick = () => {
    coverInputRef.current?.click();
  };

  const handleCoverFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;
    if (!file.type.startsWith("image/")) {
      setProfileError("Selecciona un archivo de imagen.");
      return;
    }
    setCoverBusy(true);
    setProfileError(null);
    setProfileSuccess(null);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/cover.${ext}`;
      const { error } = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(path, file, { upsert: true, cacheControl: "3600" });
      if (error) throw error;
      const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
      if (data?.publicUrl) {
        setCoverUrl(data.publicUrl);
        setProfileSuccess("Portada cargada. Guarda cambios para aplicar.");
      } else {
        setProfileError("No pudimos obtener la URL de la portada.");
      }
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : "No pudimos subir la portada.");
    } finally {
      setCoverBusy(false);
      event.target.value = "";
    }
  };
  const handleDeleteAccount = async () => {
    if (!user?.id) {
      setDeleteError("Inicia sesión para eliminar tus datos.");
      return;
    }
    const confirmDelete = window.confirm(
      "Esta acción eliminará tus brackets guardados. Tu cuenta de acceso permanecerá activa. ¿Deseas continuar?",
    );
    if (!confirmDelete) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      const { error: deleteError } = await supabase.from("bracket_saves").delete().eq("user_id", user.id);
      if (deleteError) throw deleteError;
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
      setItems([]);
      setDetailsMap({});
      setSelectedId(null);
      setActiveTab("profile");
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "No pudimos eliminar tus datos.");
    } finally {
      setDeleteBusy(false);
    }
  };

  const authModalNode = (
    <AuthModal
      open={showAuthModal}
      onClose={closeAuthModal}
      authMode={authMode}
      authEmail={authEmail}
      authPassword={authPassword}
      authBusy={authBusy}
      authError={authError}
      authSuccess={authSuccess}
      consentMarketing={consentMarketing}
      consentNews={consentNews}
      consentUpdates={consentUpdates}
      onModeChange={handleAuthModeChange}
      onEmailChange={setAuthEmail}
      onPasswordChange={setAuthPassword}
      onConsentMarketingChange={setConsentMarketing}
      onConsentNewsChange={setConsentNews}
      onConsentUpdatesChange={setConsentUpdates}
      onSubmit={handleAuthSubmit}
      onOAuth={handleOAuthSignIn}
    />
  );

  if (loading) {
    return (
      <div className="bg-neutral-900">
        <div className="max-w-7xl mx-auto bg-neutral-900 text-white flex flex-col gap-8 bracket-stable">
          <Header showNav={false} showSearch={false} />
          <main className="max-w-7xl px-2 sm:px-6 lg:px-10 rounded-2xl xl:px-16">
            <div className="max-w-3xl mx-auto">
              <section className="rounded-2xl border border-neutral-800 bg-black/50 p-6 text-center">
                <p className="text-sm text-gray-400">Verificando sesión...</p>
              </section>
            </div>
          </main>
          <Footer />
        </div>
        {authModalNode}
      </div>
    );
  }

  if (!session?.access_token) {
    return (
      <div className="bg-neutral-900">
        <div className="max-w-7xl mx-auto bg-neutral-900 text-white flex flex-col gap-8 bracket-stable">
          <Header showNav={false} showSearch={false} />
          <main className="max-w-7xl px-2 sm:px-6 lg:px-10 rounded-2xl xl:px-16">
            <div className="max-w-3xl mx-auto">
              <section className="rounded-2xl border border-neutral-800 bg-black/50 p-6 text-center">
                <h1 className="text-3xl font-black">Accede a tu cuenta</h1>
                <p className="mt-2 text-sm text-gray-400">
                  Inicia sesión o crea una cuenta para ver y administrar tus pronósticos guardados.
                </p>
                <div className="mt-4 flex flex-col sm:flex-row gap-2 justify-center">
                  <button
                    type="button"
                    onClick={() => openAuthModal("login")}
                    className="px-4 py-2 rounded-md bg-[#c6f600] text-black text-sm font-semibold hover:brightness-95"
                  >
                    Iniciar sesión
                  </button>
                  <button
                    type="button"
                    onClick={() => openAuthModal("signup")}
                    className="px-4 py-2 rounded-md border border-neutral-700 text-sm font-semibold text-gray-200 hover:border-[#c6f600]"
                  >
                    Crear cuenta
                  </button>
                </div>
                <div className="mt-3 flex justify-center">
                  <button
                    type="button"
                    onClick={() => navigateTo("home", { resetGame: Date.now() })}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-md uppercase text-sm font-semibold bg-[#c6f600] text-black hover:brightness-95"
                  >
                    <BackIcon />
                    Volver al juego
                  </button>
                </div>
              </section>
            </div>
          </main>
          <Footer />
        </div>
        {authModalNode}
      </div>
    );
  }

  return (
    <div className="bg-neutral-900">
      <div className="max-w-7xl mx-auto bg-neutral-900 text-white flex flex-col gap-8 bracket-stable">
        <Header showNav={false} showSearch={false} />
        <main className="max-w-7xl px-2 sm:px-6 lg:px-10 rounded-2xl xl:px-16">
          <div className="max-w-7xl mx-auto ">
            <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
              <div className="lg:hidden">
                <button
                  type="button"
                  onClick={() => setShowSideMenu((prev) => !prev)}
                  className="w-full flex items-center justify-between rounded-xl border border-neutral-800 bg-black/40 px-4 py-3 text-sm font-semibold"
                >
                  Menu de usuario
                  <span className="text-[#c6f600]">{showSideMenu ? "\u25B2" : "\u25BC"}</span>
                </button>
                {showSideMenu && (
                  <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm">
                    <div className="absolute inset-0 h-full w-1/2 min-w-[220px] bg-neutral-900 border-r border-neutral-800 p-4 flex flex-col gap-4 text-left relative z-10 mobile-menu-panel">
                      <div className="flex items-center">
                        <img src={logofanatico} alt="Fanatico" className="h-8 w-auto" />
                      </div>
                      <div className="flex items-center justify-between text-left">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full overflow-hidden border border-neutral-700 bg-neutral-800 flex items-center justify-center">
                            {avatarUrl ? (
                              <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-sm font-bold text-[#c6f600]">{avatarInitial}</span>
                            )}
                          </div>
                          <span className="text-gray-500">|</span>
                          <span className="text-sm font-semibold">{displayName}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowSideMenu(false)}
                          className="text-sm text-black hover:text-white bg-[#c6f600] rounded-full w-6 h-6 flex items-center justify-center"
                        >
                          X
                        </button>
                      </div>
                      <div className="pt-2 border-t border-neutral-800 flex flex-col gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveTab("profile");
                            setShowSideMenu(false);
                          }}
                          className={`px-3 py-2 text-sm font-semibold rounded-md  transition text-left ${
                            activeTab === "profile"
                              ? " text-[#c6f600]"
                              : "text-gray-400 "
                          }`}
                        >
                          Perfil
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveTab("settings");
                            setShowSideMenu(false);
                          }}
                          className={`px-3 py-2 text-sm font-semibold rounded-md  transition text-left ${
                            activeTab === "settings"
                              ? " text-[#c6f600]"
                              : "border-transparent text-gray-400 hover:text-[#c6f600]"
                          }`}
                        >
                          Ajustes
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveTab("claim");
                            setShowSideMenu(false);
                          }}
                          className={`px-3 py-2 rounded-md  text-xs font-semibold transition text-left ${
                            activeTab === "claim"
                              ? "border-[#c6f600] text-[#c6f600]"
                              : " text-gray-200 "
                          }`}
                        >
                          Agregar bracket
                        </button>
                        <button
                          type="button"
                          onClick={() => navigateTo("home", { resetGame: Date.now() })}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-md uppercase text-xs font-semibold text-left bg-[#c6f600] text-black hover:brightness-95"
                        >
                          <BackIcon />
                          Volver al juego
                        </button>
                      </div>
                      <div className="mt-auto pt-4 border-t border-neutral-800 flex flex-col gap-3">
                        <button
                          type="button"
                          onClick={handleSignOut}
                          className="px-3 py-2 rounded-md  text-xs font-semibold text-left text-gray-200 hover:border-[#c6f600]"
                        >
                          Cerrar sesión
                        </button>
                        <div className="flex items-center ">
                          <a href="https://www.eltelegrafo.com.ec/" target="_blank" rel="noreferrer">
                            <img src={etLogo} alt="ET Logo" className=" h-5" />
                          </a>
                          <span className="text-gray-500">|</span>
                          <a href="https://www.ecuadortv.ec" target="_blank" rel="noreferrer">
                            <img src={ectvLogo} alt="ECTV Logo" className=" h-5" />
                          </a>
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowSideMenu(false)}
                      className="absolute inset-0 z-0"
                      aria-label="Cerrar menu"
                    />
                  </div>
                )}
              </div>

              <aside className="hidden lg:block lg:sticky lg:top-24 self-start">
                <div className="rounded-2xl  bg-neutral-800 rounded-xl p-4 flex flex-col gap-4">
                  <div>
                    <h1 className="text-2xl font-black">Panel de usuario</h1>
                    <p className="text-sm text-gray-400 mt-1">
                    </p>
                  </div>
              
                  <div className="pt-2 border-t border-neutral-800 flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab("profile")}
                      className={`px-3 py-2 text-sm font-semibold rounded-md border transition text-left ${
                        activeTab === "profile"
                          ? "text-[#c6f600]"
                          : "border-transparent text-gray-400 hover:text-[#c6f600]"
                      }`}
                    >
                      Perfil
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab("settings")}
                      className={`px-3 py-2 text-base  font-semibold rounded-md border transition text-left ${
                        activeTab === "settings"
                          ? " text-[#c6f600]"
                          : "border-transparent text-gray-400 hover:text-[#c6f600]"
                      }`}
                    >
                      Ajustes
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab("claim")}
                      className={`px-3 py-2 rounded-md border text-left  text-base font-semibold transition ${
                        activeTab === "claim"
                          ? " text-[#c6f600]"
                          : "text-gray-200 hover:border-[#c6f600]"
                      }`}
                    >
                      Agregar bracket
                    </button>
                       <button
                      type="button"
                      onClick={() => navigateTo("home", { resetGame: Date.now() })}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-left uppercase text-base  font-semibold text-black bg-[#c6f600]"
                    >
                      <BackIcon />
                      Volver al juego
                    </button>
                  </div>
                      <div className="mt-auto pt-4 border-t border-neutral-800 flex flex-col gap-3">
                        <button
                          type="button"
                          onClick={handleSignOut}
                          className="px-3 py-2  text-xs font-semibold text-left text-gray-200 hover:border-[#c6f600]"
                        >
                          Cerrar sesión
                        </button>
                        <div className="flex items-center gap-3">
                          <a href="https://www.eltelegrafo.com.ec/" target="_blank" rel="noreferrer">
                            <img src={etLogo} alt="ET Logo" className="h-6 w-auto" />
                          </a>
                          <span className="text-gray-500">|</span>
                          <a href="https://www.ecuadortv.ec" target="_blank" rel="noreferrer">
                            <img src={ectvLogo} alt="ECTV Logo" className="h-6 w-auto" />
                          </a>
                        </div>
                      </div>
</div>
              </aside>

              <div>
            {activeTab === "profile" ? (
              <>
                <section className="rounded-2xl border border-neutral-800 bg-black/40 overflow-hidden">
                  <div
                    className="relative h-48"
                    style={
                      coverUrl
                        ? {
                            backgroundImage: `url(${coverUrl})`,
                            backgroundSize: "cover",
                            backgroundPosition: "center",
                          }
                        : {
                            background:
                              "linear-gradient(135deg, rgba(8,8,8,1) 0%, rgba(17,24,39,1) 45%, rgba(31,42,18,1) 100%)",
                          }
                    }
                  >
                    <div className="absolute -left-20 -bottom-20 w-56 h-56 rounded-full bg-[#c6f600]/20 blur-3xl" />
                    <div className="absolute right-0 top-0 w-40 h-40 rounded-full bg-white/10 blur-3xl" />
                  </div>
                  <div className="relative px-4 pb-6">
                    <div
                      className="flex flex-col md:flex-row md:items-center md:justify-between gap-4"
                      
                    >
                      <div className="flex items-center gap-4">
                        <div className="relative w-36 h-36 rounded-full overflow-hidden border-4 border-neutral-900 bg-neutral-800 shrink-0 -mt-14">
                          {avatarUrl ? (
                            <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                          ) : (
                            <span className="w-full h-full flex items-center justify-center text-2xl font-bold text-[#c6f600]">
                              {avatarInitial}
                            </span>
                          )}
                        </div>
                        <div>
                          <h2 className="text-6xl  font-black">{displayName}</h2>
                          <p className="text-sm text-gray-400 text-left">{displaySubtitle}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {!session?.access_token && (
                          <button
                            type="button"
                            onClick={() => openAuthModal("login") }
                            className="px-3 py-2 rounded-md bg-[#c6f600] text-black text-xs font-semibold hover:brightness-95"
                          >
                            Iniciar sesión
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap items-end gap-8 justify-center md:justify-end">
                      <div className="flex flex-col items-center md:items-end">
                        <p className="text-xs uppercase tracking-wider text-gray-400">pronósticos</p>
                        <p className="text-3xl font-black text-white leading-none">{loading ? "--" : totalBrackets}</p>
                      </div>
                      <div className="flex flex-col items-center md:items-end">
                        <p className="text-xs uppercase tracking-wider text-gray-400">Juegos</p>
                        <p className="text-3xl font-black text-white leading-none">{loading ? "--" : totalGames}</p>
                      </div>
                     
                    </div>
                  </div>
                </section>

                <div className="mt-6 ">
                  <div className="flex items-center justify-center py-4  bg-black">
                    <h2 className="text-4xl font-semibold items-center justify-center">Tus pronósticos</h2>
                  </div>
                  {!session?.access_token ? (
                    <div className="mt-3 rounded-lg border border-neutral-800 bg-black/40 p-4 text-sm text-gray-300">
                      Inicia sesion para ver tus juegos activos.
                    </div>
                  ) : games.length === 0 && !loading ? (
                    <div className="mt-3 rounded-lg border border-neutral-800 bg-black/40 p-4 text-sm text-gray-300">
                      Todavía no has participado en ningún juego.
                    </div>
                    ) : (
                      <>
                        <div className="pronosticos-carousel relative bg-black p-6" onTouchStart={handlePronosticosTouchStart} onTouchEnd={handlePronosticosTouchEnd} onTouchCancel={resetPronosticosTouch}>
                          <div
                            className="pronosticos-stack w-full"
                            data-direction={pronosticosDirection ?? ""}
                          >
                            {games.map((game, index) => (
                              <div
                                key={game.name}
                                className={`pronosticos-slide ${index === pronosticosIndex ? "is-active" : ""}`}
                              >
                                {renderGameCard(game)}
                              </div>
                            ))}
                          </div>
                          <button
                            type="button"
                            onClick={() => handlePronosticosSlide("prev")}
                            disabled={pronosticosIndex === 0}
                            className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-[#c6f600] text-black flex items-center justify-center shadow hover:brightness-95 disabled:opacity-50 disabled:cursor-not-allowed"
                            aria-label="Ver pronósticos anterior"
                          >
                            &lt;
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePronosticosSlide("next")}
                            disabled={pronosticosIndex >= games.length - 1}
                            className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-[#c6f600] text-black flex items-center justify-center shadow hover:brightness-95 disabled:opacity-50 disabled:cursor-not-allowed"
                            aria-label="Ver pronósticos siguiente"
                          >
                            &gt;
                          </button>
                        </div>
                        <div className="pronosticos-grid grid gap-3 sm:grid-cols-2 lg:grid-cols-3 bg-black items-center justify-center p-6">
                          {games.map((game) => (
                            <div key={game.name}>{renderGameCard(game)}</div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>

                  {activeShareCard && (
                    <div className="share-card-host" aria-hidden="true">
                      <div id="share-card-capture" ref={shareCardRef}>
                        <ShareCard
                          coverUrl={shareCoverUrl}
                          champion={activeShareCard.champion}
                          runnerUp={activeShareCard.runnerUp}
                          third={activeShareCard.third}
                          shareUrl={activeShareCard.shareUrl}
                        />
                      </div>
                    </div>
                  )}

                {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

                  <div className="mt-6" id="viewer-bracket">
                   
                    {detailsBusy && (
                      <p className="mt-2 text-sm text-gray-400">Cargando detalle...</p>
                    )}
                    {!detailsBusy && selectedItem ? (
                      <div className="mt-3 rounded-lg border border-neutral-800 bg-black/40 p-4">
                        <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm text-gray-300">
                            <span className="text-[#c6f600] font-semibold">{selectedItem.name || "Mi Pron?stico del Mundial 2026"}</span>
                          </p>
                          <p className="text-xs text-gray-400">Actualizado: {formatDate(selectedItem.updated_at)}</p>
                        </div>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedId(null);
                              setViewerId(null);
                            }}
                            className="px-3 py-2 rounded-full  text-xs font-bold text-gray-800 bg-[#c6f600]"
                          >
                            X
                          </button>
                        </div>
                        {viewerId === selectedItem.id ? (
                          <div className="mt-4 flex flex-col gap-3">
                            <div className="rounded-lg border border-neutral-800 bg-black/50 px-3 py-3">
                              <div className="text-xs uppercase tracking-wide text-gray-400">
                                Tus puntos totales de esta polla mundialista
                              </div>
                              <div className="mt-1 text-2xl font-black text-[#c6f600]">
                                {selectedScoreLoading ? "..." : `${selectedScoreSummary?.totalPoints || 0} pts`}
                              </div>
                              <div className="mt-2 text-xs text-gray-400">
                                Código del bracket:{" "}
                                <span className="font-semibold text-white">{selectedBracketCode || "--"}</span>
                              </div>
                            </div>
                            <EmbeddedViewerMenu
                              tab={viewerTab}
                              playoffTab={viewerPlayoffTab}
                              onNavigate={sendViewerNav}
                              showRepechajes
                              showRepechajeSubnav
                            />
                            <div className="rounded-lg overflow-hidden border border-neutral-800">
                              <iframe
                                ref={viewerFrameRef}
                                title="Pron?stico"
                                src={`/?view=1&bracketId=${selectedItem.id}`}
                                onLoad={() => sendViewerNav(viewerTab, viewerPlayoffTab)}
                                className="w-full min-h-screen  bg-black"
                              />
                            </div>
                          </div>
                        ) : (
                          <pre className="mt-4 max-h-[420px] overflow-auto rounded-md bg-neutral-950 p-3 text-xs text-gray-200">
                            {JSON.stringify(selectedItem.data, null, 2)}
                          </pre>
                        )}
                      </div>
                    ) : (
                    !detailsBusy && (
                      <p className="mt-2 text-sm text-gray-400 text-center py-2">
                        Selecciona un bracket para ver los datos que se guardan en la base de datos.
                      </p>
                    )
                  )}
                </div>
              </>
            ) : activeTab === "claim" ? (
              <>
                <section className="rounded-2xl border border-neutral-800 bg-black/40 p-4">
                  <h2 className="text-2xl font-semibold">Agregar bracket</h2>
                  <p className="text-sm text-gray-400 mt-1">
                    Ingresa el código corto que te dimos cuando guardaste como invitado. Expira en 7 días.
                  </p>
                  {!session?.access_token ? (
                    <div className="mt-4 rounded-lg border border-neutral-800 bg-black/40 p-4 text-sm text-gray-300">
                      Inicia sesión para agregar un bracket.
                    </div>
                  ) : (
                    <div className="mt-4 rounded-lg border border-neutral-800 bg-black/40 p-4">
                      <div className="mt-3 flex flex-col md:flex-row gap-2">
                        <input
                          type="text"
                          value={claimCode}
                          onChange={(e) => {
                            const next = e.target.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
                            setClaimCode(next);
                            setClaimError(null);
                            setClaimSuccess(null);
                          }}
                          placeholder="Ej: AB12CD"
                          className="flex-1 rounded-md bg-neutral-800 border border-neutral-700 px-3 py-2 text-sm text-white"
                        />
                        <button
                          type="button"
                          onClick={handleClaimBracket}
                          disabled={claimBusy}
                          className={`px-4 py-2 rounded-md text-xs font-semibold ${
                            claimBusy
                              ? "bg-neutral-700 text-gray-400"
                              : "bg-[#c6f600] text-black hover:brightness-95"
                          }`}
                        >
                          {claimBusy ? "Agregando..." : "Agregar bracket"}
                        </button>
                      </div>
                      {claimError && <p className="mt-2 text-xs text-red-400">{claimError}</p>}
                      {claimSuccess && <p className="mt-2 text-xs text-green-400">{claimSuccess}</p>}
                    </div>
                  )}
                </section>
              </>
            ) : (
              <>
                <div className="grid gap-4 lg:grid-cols-2">
                  <section className="rounded-lg border border-neutral-800 bg-black/40 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h2 className="text-xl font-semibold">Perfil</h2>
                        <p className="text-xs text-gray-400">Actualiza tu nombre, alias y avatar.</p>
                      </div>
                      {!session && !loading ? (
                        <button
                          type="button"
                          onClick={() => openAuthModal("login")}
                          className="px-3 py-2 rounded-md bg-[#c6f600] text-black text-xs font-semibold hover:brightness-95"
                        >
                          Iniciar sesión
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400">
                          {loading ? "Verificando sesión..." : "Sesión activa"}
                        </span>
                      )}
                    </div>

                    <div className="mt-4 flex flex-col md:flex-row gap-4">
                      <div className="relative w-24 h-24 rounded-full overflow-hidden border border-neutral-700 bg-neutral-800 shrink-0">
                        {avatarUrl ? (
                          <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                        ) : (
                          <span className="w-full h-full flex items-center justify-center text-2xl font-bold text-[#c6f600]">
                            {avatarInitial}
                          </span>
                        )}
                        {avatarBusy && (
                          <div className="absolute inset-0 bg-black/60 text-xs text-gray-200 flex items-center justify-center">
                            Subiendo...
                          </div>
                        )}
                      </div>

                      <div className="flex-1 grid gap-3">
                        <div>
                          <label className="text-xs text-gray-400">Nombre</label>
                          <input
                            type="text"
                            value={profileName}
                            onChange={(e) => setProfileName(e.target.value)}
                            disabled={!canEdit || profileBusy}
                            className="mt-1 w-full rounded-md bg-neutral-800 border border-neutral-700 px-3 py-2 text-sm text-white disabled:opacity-60"
                            placeholder="Tu nombre"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-400">Alias</label>
                          <input
                            type="text"
                            value={profileAlias}
                            onChange={(e) => setProfileAlias(e.target.value)}
                            disabled={!canEdit || profileBusy}
                            className="mt-1 w-full rounded-md bg-neutral-800 border border-neutral-700 px-3 py-2 text-sm text-white disabled:opacity-60"
                            placeholder="Tu alias"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-400">Avatar (URL)</label>
                          <input
                            type="url"
                            value={avatarUrl}
                            onChange={(e) => setAvatarUrl(e.target.value)}
                            disabled={!canEdit || profileBusy}
                            className="mt-1 w-full rounded-md bg-neutral-800 border border-neutral-700 px-3 py-2 text-sm text-white disabled:opacity-60"
                            placeholder="https://..."
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-400">Imagen de cabecera (URL)</label>
                          <input
                            type="url"
                            value={coverUrl}
                            onChange={(e) => setCoverUrl(e.target.value)}
                            disabled={!canEdit || profileBusy}
                            className="mt-1 w-full rounded-md bg-neutral-800 border border-neutral-700 px-3 py-2 text-sm text-white disabled:opacity-60"
                            placeholder="https://..."
                          />
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={handleAvatarPick}
                            disabled={!canEdit || avatarBusy}
                            className="px-3 py-2 rounded-md border border-neutral-700 text-xs font-semibold text-gray-200 hover:border-[#c6f600] disabled:opacity-60"
                          >
                            {avatarBusy ? "Subiendo..." : "Subir avatar"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setAvatarUrl("")}
                            disabled={!canEdit || !avatarUrl}
                            className="px-3 py-2 rounded-md border border-neutral-700 text-xs font-semibold text-gray-200 hover:border-[#c6f600] disabled:opacity-60"
                          >
                            Quitar avatar
                          </button>
                          <input
                            ref={avatarInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleAvatarFile}
                            className="hidden"
                          />
                          <button
                            type="button"
                            onClick={handleCoverPick}
                            disabled={!canEdit || coverBusy}
                            className="px-3 py-2 rounded-md border border-neutral-700 text-xs font-semibold text-gray-200 hover:border-[#c6f600] disabled:opacity-60"
                          >
                            {coverBusy ? "Subiendo..." : "Subir portada"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setCoverUrl("")}
                            disabled={!canEdit || !coverUrl}
                            className="px-3 py-2 rounded-md border border-neutral-700 text-xs font-semibold text-gray-200 hover:border-[#c6f600] disabled:opacity-60"
                          >
                            Quitar portada
                          </button>
                          <input
                            ref={coverInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleCoverFile}
                            className="hidden"
                          />
                        </div>
                      </div>
                    </div>

                    {profileError && <p className="mt-3 text-xs text-red-400">{profileError}</p>}
                    {profileSuccess && <p className="mt-3 text-xs text-green-400">{profileSuccess}</p>}
                    {!session && !loading && (
                      <p className="mt-3 text-xs text-gray-400">Inicia sesi?n para editar tu perfil.</p>
                    )}

                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={handleProfileSave}
                        disabled={!canEdit || profileBusy}
                        className="px-4 py-2 rounded-md bg-[#c6f600] text-black text-xs font-semibold hover:brightness-95 disabled:opacity-60"
                      >
                        {profileBusy ? "Guardando..." : "Guardar cambios"}
                      </button>
                      {session && (
                        <span className="text-xs text-gray-400">
                          Sesión activa para <span className="font-semibold">{userLabel}</span>
                        </span>
                      )}
                    </div>
                  </section>

                  <section className="rounded-lg border border-neutral-800 bg-black/40 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h2 className="text-xl font-semibold">Acceso y seguridad</h2>
                        <p className="text-xs text-gray-400">Actualiza tu correo y contraseña.</p>
                      </div>
                      {!session && !loading && (
                        <button
                          type="button"
                          onClick={() => openAuthModal("login")}
                          className="px-3 py-2 rounded-md border border-neutral-700 text-xs font-semibold text-gray-200 hover:border-[#c6f600]"
                        >
                          Iniciar sesión
                        </button>
                      )}
                    </div>

                    <div className="mt-4 grid gap-4">
                      <div className="rounded-md border border-neutral-800 p-3">
                        <label className="text-xs text-gray-400">Correo</label>
                        <input
                          type="email"
                          value={newEmail}
                          onChange={(e) => setNewEmail(e.target.value)}
                          disabled={!canEdit || credentialsBusy}
                          className="mt-1 w-full rounded-md bg-neutral-800 border border-neutral-700 px-3 py-2 text-sm text-white disabled:opacity-60"
                          placeholder="correo@ejemplo.com"
                        />
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={handleEmailUpdate}
                            disabled={!canEdit || credentialsBusy}
                            className="px-3 py-2 rounded-md border border-neutral-700 text-xs font-semibold text-gray-200 hover:border-[#c6f600] disabled:opacity-60"
                          >
                            Actualizar correo
                          </button>
                          <span className="text-[11px] text-gray-500">Te enviaremos un correo de confirmación.</span>
                        </div>
                      </div>

                      <div className="rounded-md border border-neutral-800 p-3">
                        <label className="text-xs text-gray-400">Nueva contraseña</label>
                        <input
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          disabled={!canEdit || credentialsBusy}
                          className="mt-1 w-full rounded-md bg-neutral-800 border border-neutral-700 px-3 py-2 text-sm text-white disabled:opacity-60"
                          placeholder="********"
                        />
                        <label className="text-xs text-gray-400 mt-3 block">Confirmar contraseña</label>
                        <input
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          disabled={!canEdit || credentialsBusy}
                          className="mt-1 w-full rounded-md bg-neutral-800 border border-neutral-700 px-3 py-2 text-sm text-white disabled:opacity-60"
                          placeholder="********"
                        />
                        <div className="mt-2">
                          <button
                            type="button"
                            onClick={handlePasswordUpdate}
                            disabled={!canEdit || credentialsBusy}
                            className="px-3 py-2 rounded-md bg-[#c6f600] text-black text-xs font-semibold hover:brightness-95 disabled:opacity-60"
                          >
                            Actualizar contraseña
                          </button>
                        </div>
                      </div>
                    </div>

                    {credentialsError && <p className="mt-3 text-xs text-red-400">{credentialsError}</p>}
                    {credentialsSuccess && <p className="mt-3 text-xs text-green-400">{credentialsSuccess}</p>}
                  </section>
                </div>

                <section className="mt-6 rounded-lg border border-neutral-800 bg-black/40 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-semibold">Cuenta</h2>
                      <p className="text-xs text-gray-400">Gestiona tu sesi?n o elimina tus datos guardados.</p>
                    </div>
                    {!session && !loading && (
                      <button
                        type="button"
                        onClick={() => openAuthModal("login")}
                        className="px-3 py-2 rounded-md border border-neutral-700 text-xs font-semibold text-gray-200 hover:border-[#c6f600]"
                      >
                        Iniciar sesión
                      </button>
                    )}
                  </div>

                  {!session?.access_token ? (
                    <p className="mt-3 text-sm text-gray-400">Inicia sesión para administrar tu cuenta.</p>
                  ) : (
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={handleSignOut}
                        className="px-3 py-2 rounded-md border border-neutral-700 text-xs font-semibold text-gray-200 hover:border-[#c6f600]"
                      >
                        Cerrar sesión
                      </button>
                      <button
                        type="button"
                        onClick={handleDeleteAccount}
                        disabled={deleteBusy}
                        className="px-3 py-2 rounded-md border border-red-700 text-xs font-semibold text-red-300 hover:border-red-500 disabled:opacity-60"
                      >
                        {deleteBusy ? "Procesando..." : "Eliminar datos"}
                      </button>
                    </div>
                  )}

                  {deleteError && <p className="mt-3 text-xs text-red-400">{deleteError}</p>}
                </section>
              </>
            )}
              </div>
            </div>
          </div>
        </main>
        <Footer />
      </div>
      {authModalNode}
    </div>
  );
}
