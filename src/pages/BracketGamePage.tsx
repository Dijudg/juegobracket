import { Crown, ChevronDown, CalendarDays } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { ShareCard, type ShareCardTeam } from "../components/ShareCard";
import { captureShareCard } from "../utils/shareCardCapture";
import { buildSharePageUrl, createGuestShare, uploadShareCardImage } from "../utils/shareCardApi";
import Header from "../components/header";
import Footer from "../components/Footer";
import { AnimatePresence, motion } from "motion/react";
import Confetti from "react-confetti";
import { useWindowSize } from "react-use";
import thirdLookup from "../data/third_lookup.json";
import finalOverlay from "../assets/juego-ganador.png";
import rulesBanner from "../assets/reglas.png";
import phaseBlockBanner from "../assets/stop.jpg";
import phaseBlockBannerAlt from "../assets/stop2.jpg";
import saveBanner from "../assets/guardar.jpg";
import intercontinentalBanner from "../assets/Intercontinental.jpg";
import championBanner from "../assets/final.jpg";
import modalBackImage from "../assets/fondo.jpg";
import mundialBanner from "../assets/mundial.png";
import whatsappIcon from "../assets/whatsapp.svg";
import xIcon from "../assets/x.svg";
import instagramIcon from "../assets/instagram.svg";
import facebookIcon from "../assets/facebook.svg";
import "../styles/globals.css";
import { fetchFanaticoData } from "../utils/fanaticoApi";
import { supabase } from "../utils/supabaseClient";
import type { Session, User } from "@supabase/supabase-js";
import type {
  BracketSavePayload,
  Fixture,
  GroupSelections,
  Match,
  MatchSchedule,
  PlayoffKeyBlockData,
  PlayoffPickState,
  SavedBracketMeta,
  Seeds,
  Team,
} from "../features/bracket/types";
import {
  applyRepechajeMeta,
  ensureRepechajeTeams,
  getRepechajeMeta,
  getRepechajeFlagUrl,
  getTeamCode,
  getTeamEscudo,
  resolveRepechajeCode,
} from "../features/bracket/utils";
import { ModalFlipFrame } from "../features/bracket/components/ModalFlipFrame";
import { DieciseisavosKeyBlock } from "../features/bracket/components/DieciseisavosKeyBlock";
import { PlayoffKeyBlock } from "../features/bracket/components/PlayoffKeyBlock";
import { RepechajeWinnerBadge } from "../features/bracket/components/RepechajeWinnerBadge";
import { KnockoutBracket } from "../features/bracket/components/KnockoutBracket";
import { GroupFixturesModal } from "../features/bracket/components/GroupFixturesModal";
import { BestThirdsModal } from "../features/bracket/components/BestThirdsModal";
import { useHoloPointer } from "../features/bracket/hooks/useHoloPointer";
import { useNavigation } from "../contexts/NavigationContext";
import { AuthModal } from "../components/AuthModal";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock";
import {
  buildConsentPayload,
  clearPendingConsent,
  readPendingConsent,
  storePendingConsent,
} from "../utils/authConsent";


// Normaliza ids de partido para mapear contra el sheet (quita P/p y ceros a la izquierda)
const normalizeMatchKey = (val?: string) => {
  if (!val) return "";
  const cleaned = val.toString().trim().replace(/^P/i, "");
  const noZeros = cleaned.replace(/^0+/, "");
  return noZeros || cleaned;
};

const formatViewDate = (value?: string) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("es-EC", { dateStyle: "medium", timeStyle: "short" });
};

const seleccionesUrl =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRi2qMMbibzuc4bjv38DBJYnfY24e4Mt0c20CqpDDFzgBn_aJ6NR0HcrXjdbKLhAEsy3zJUdvr3npRU/pub?gid=0&single=true&output=csv";

const fixturesUrl =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRi2qMMbibzuc4bjv38DBJYnfY24e4Mt0c20CqpDDFzgBn_aJ6NR0HcrXjdbKLhAEsy3zJUdvr3npRU/pub?gid=171585554&single=true&output=tsv";

const GROUP_LETTERS = "ABCDEFGHIJKL".split("");
const MAX_THIRD = 8;
const MAX_RESET_ATTEMPTS = 4;
const LS_INTERCONTINENTAL = "fm-repechaje-intercontinental";
const LS_UEFA = "fm-repechaje-uefa";
const LS_TEAMS = "fm-teams";
const LS_GUEST_BRACKET = "fm-guest-bracket";
const GUEST_SAVE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_HOME_URL = "https://especiales.eltelegrafo.com.ec/fanaticomundialista/";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";
const resolveApiBase = (value?: string) => {
  const trimmed = (value || "").trim();
  if (trimmed) {
    if (!/^https?:\/\//i.test(trimmed)) return `https://${trimmed}`;
    return trimmed;
  }
  if (typeof window !== "undefined") return window.location.origin;
  return "";
};

type ShareCardPayload = {
  champion: ShareCardTeam;
  runnerUp: ShareCardTeam;
  third: ShareCardTeam;
  shareUrl: string;
};

type GuestBracketSave = {
  name: string;
  data: BracketSavePayload;
  updatedAt: string;
  shortCode?: string;
  shareId?: string;
  shareUrl?: string;
};

type SaveModalProps = {
  open: boolean;
  onClose: () => void;
  saveName: string;
  onSaveNameChange: (value: string) => void;
  saveMode: "new" | "overwrite" | "update";
  onSaveModeChange: (value: "new" | "overwrite" | "update") => void;
  currentSaveId: string | null;
  savedBrackets: SavedBracketMeta[];
  selectedOverwriteId: string | null;
  onSelectOverwriteId: (value: string) => void;
  saveError: string | null;
  saveBusy: boolean;
  onConfirm: () => void;
  isAuthed: boolean;
  guestShortCode?: string | null;
  allowOverwrite?: boolean;
};

const SaveModal = ({
  open,
  onClose,
  saveName,
  onSaveNameChange,
  saveMode,
  onSaveModeChange,
  currentSaveId,
  savedBrackets,
  selectedOverwriteId,
  onSelectOverwriteId,
  saveError,
  saveBusy,
  onConfirm,
  isAuthed,
  guestShortCode,
  allowOverwrite = true,
}: SaveModalProps) => {
  if (!open) return null;
  const overlayRef = useRef<HTMLDivElement>(null);
  const limitReached = savedBrackets.length >= 3;
  const showOverwrite = allowOverwrite && savedBrackets.length > 0;
  const showUpdate = allowOverwrite && !!currentSaveId;
  return (
    <div
      ref={overlayRef}
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-start md:items-center justify-center px-4 py-6 overflow-y-auto"
    >
      <ModalFlipFrame className="bg-neutral-900 border border-neutral-700 rounded-lg w-full md:w-1/2 max-w-lg shadow-lg flex flex-col overflow-hidden modal-glow">
        <div className="w-full overflow-hidden border-b border-neutral-700" style={{ aspectRatio: "16 / 9" }}>
          <img src={saveBanner} alt="Guardar" className="w-full h-full object-cover" />
        </div>
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-[#c6f600]">Guardar bracket</h3>
            <button onClick={onClose} className="text-sm text-gray-400 hover:text-white">
              X
            </button>
          </div>

          <label className="text-xs text-gray-400">Nombre</label>
          <input
            type="text"
            value={saveName}
            onChange={(e) => onSaveNameChange(e.target.value)}
            className="mt-1 mb-3 w-full rounded-md bg-neutral-800 border border-neutral-700 px-3 py-2 text-sm text-white"
            placeholder="Mi bracket"
          />

          <div className="flex flex-col gap-2 text-sm text-gray-200">
            {showUpdate && (
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="saveMode"
                  checked={saveMode === "update"}
                  onChange={() => onSaveModeChange("update")}
                />
                Actualizar este bracket
              </label>
            )}
            {!limitReached && (
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="saveMode"
                  checked={saveMode === "new"}
                  onChange={() => onSaveModeChange("new")}
                />
                Guardar como nuevo
              </label>
            )}
            {showOverwrite && (
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="saveMode"
                  checked={saveMode === "overwrite"}
                  onChange={() => onSaveModeChange("overwrite")}
                />
                Sobrescribir existente
              </label>
            )}
          </div>

          {limitReached && (
            <p className="mt-2 text-xs text-yellow-400">
              Límite de 3 brackets alcanzado. Debes sobrescribir uno.
            </p>
          )}

          {!isAuthed && (
            <p className="mt-2 text-xs text-gray-400">
              Se guardará 1 semana en este dispositivo. Inicia sesión para guardar en la nube.
            </p>
          )}

          {!isAuthed && guestShortCode && (
            <p className="mt-2 text-xs text-gray-300">
              Tu código: <span className="font-semibold text-[#c6f600]">{guestShortCode}</span>
            </p>
          )}

          {saveMode === "overwrite" && showOverwrite && (
            <div className="mt-3 flex flex-col gap-2 max-h-40 overflow-y-auto">
              {savedBrackets.map((item) => (
                <label key={item.id} className="flex items-center gap-2 text-sm text-gray-200">
                  <input
                    type="radio"
                    name="overwriteId"
                    checked={selectedOverwriteId === item.id}
                    onChange={() => onSelectOverwriteId(item.id)}
                  />
                  <div className="flex flex-col">
                    <span className="font-semibold">{item.name || "Mi bracket"}</span>
                    <span className="text-[11px] text-gray-500">
                      {new Date(item.updated_at).toLocaleDateString("es-ES")}
                    </span>
                  </div>
                </label>
              ))}
            </div>
          )}

          {saveError && <p className="text-xs text-red-400 mt-3">{saveError}</p>}

          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 rounded-md border border-neutral-700 text-xs text-gray-300 hover:border-[#c6f600]"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={saveBusy}
              className={`px-3 py-2 rounded-md text-xs font-semibold ${
                saveBusy ? "bg-neutral-700 text-gray-400" : "bg-[#c6f600] text-black hover:brightness-95"
              }`}
            >
              {saveBusy ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </div>
      </ModalFlipFrame>
    </div>
  );
};

const INTERCONTINENTAL_KEYS = [
  {
    id: "I",
    title: "Aspirantes grupo I",
    mapGroup: "Llave 1",
    seed: "IRQ",
    semi: { id: "int-k2-sf", home: "BOL", away: "SUR", date: "Lunes 23 de marzo" },
    final: { id: "int-k2-final", date: "Martes 31 de marzo" },
  },
  {
    id: "K",
    title: "Aspirantes grupo K",
    mapGroup: "Llave 2",
    seed: "COD",
    semi: { id: "int-k1-sf", home: "NCL", away: "JAM", date: "Lunes 23 de marzo" },
    final: { id: "int-k1-final", date: "Martes 31 de marzo" },
  },
] as const;

const UEFA_KEYS = [
  {
    id: "A",
    title: "Aspirantes grupo A",
    mapGroup: "Ruta D",
    semi1: { id: "uefa4-sf1", home: "DEN", away: "MKD" },
    semi2: { id: "uefa4-sf2", home: "CZE", away: "IRL" },
    final: { id: "uefa4-final" },
  },
  {
    id: "B",
    title: "Aspirantes grupo B",
    mapGroup: "Ruta A",
    semi1: { id: "uefa1-sf1", home: "ITA", away: "NIR" },
    semi2: { id: "uefa1-sf2", home: "WAL", away: "BIH" },
    final: { id: "uefa1-final" },
  },
  {
    id: "D",
    title: "Aspirantes grupo D",
    mapGroup: "Ruta C",
    semi1: { id: "uefa3-sf1", home: "TUR", away: "ROU" },
    semi2: { id: "uefa3-sf2", home: "SVK", away: "KOS" },
    final: { id: "uefa3-final" },
  },
  {
    id: "F",
    title: "Aspirantes grupo F",
    mapGroup: "Ruta B",
    semi1: { id: "uefa2-sf1", home: "UKR", away: "SWE" },
    semi2: { id: "uefa2-sf2", home: "POL", away: "ALB" },
    final: { id: "uefa2-final" },
  },
] as const;

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

const parseTSVLine = (line: string): string[] => line.split("\t").map((t) => t.trim());
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

const buildRoundOf32 = (
  seeds: Seeds,
  thirdsQualified: string[],
  lookup: Record<string, Record<string, string>>,
): { matches: Match[]; error?: string; warning?: string; comboKey?: string } => {
  const comboKey = thirdsQualified.slice().sort().join("");
  const entry =
    lookup[comboKey] ||
    (() => {
      // Fallback: generar asignacion deterministica usando el orden de seeds requeridos y los grupos seleccionados
      const seedsOrder = ["A1", "B1", "D1", "E1", "G1", "I1", "K1", "L1"];
      const map: Record<string, string> = {};
      const groupsSorted = thirdsQualified.slice().sort();
      seedsOrder.forEach((seed, idx) => {
        const g = groupsSorted[idx];
        if (g) map[seed] = `3${g}`;
      });
      return map;
    })();
  const warning = lookup[comboKey] ? undefined : `Asignacion generada por defecto para combinacion sin tabla: ${comboKey}`;

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

  return { matches, comboKey, warning };
};

const buildNextRounds = (
  base: Match[],
  picks: Record<string, string | undefined>,
): { r32: Match[]; r16: Match[]; qf: Match[]; sf: Match[]; final: Match[]; thirdPlace: Match[] } => {
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

  return { r32, r16, qf, sf, final, thirdPlace };
};

export default function BracketGamePage() {
  const pickStopBanner = () => (Math.random() < 0.5 ? phaseBlockBanner : phaseBlockBannerAlt);
  const homeUrl = import.meta.env.VITE_BRACKET_HOME_URL || DEFAULT_HOME_URL;
  const goHome = () => {
    window.location.href = homeUrl;
  };
    const { navigateTo, pageParams } = useNavigation();
    const viewParams = useMemo(() => {
      if (typeof window === "undefined") return null;
      return new URLSearchParams(window.location.search);
    }, []);
    const sharePathId = useMemo(() => {
      if (typeof window === "undefined") return "";
      const match = window.location.pathname.match(/^\/share\/([^/]+)/);
      return match ? match[1] : "";
    }, []);
    const isEmbedded = useMemo(() => {
      if (typeof window === "undefined") return false;
      try {
        return window.self !== window.top;
      } catch {
        return true;
      }
    }, []);
    const isSharePath = !!sharePathId;
    const isViewOnly = viewParams?.get("view") === "1" || isEmbedded || isSharePath;
    const showSharedHeader = isViewOnly && !isEmbedded;
    const viewBracketId = viewParams?.get("bracketId") || sharePathId || "";
  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    if (isViewOnly) {
      root.classList.add("view-only");
    } else {
      root.classList.remove("view-only");
    }
    return () => {
      root.classList.remove("view-only");
    };
  }, [isViewOnly]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selections, setSelections] = useState<GroupSelections>({});
  const [bestThirdIds, setBestThirdIds] = useState<string[]>([]);
  const [picks, setPicks] = useState<Record<string, string | undefined>>({});
  const [activeTab, setActiveTab] = useState<"repechajes" | "grupos" | "dieciseisavos" | "llaves">("repechajes");
  const [activeR32Tab, setActiveR32Tab] = useState<"llave1" | "llave2">("llave1");
  const [activePlayoffTab, setActivePlayoffTab] = useState<"intercontinental" | "uefa">("uefa");
  const [intercontinentalPicks, setIntercontinentalPicks] = useState<PlayoffPickState>({});
  const [uefaPicks, setUefaPicks] = useState<PlayoffPickState>({});
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [showFixturesGroup, setShowFixturesGroup] = useState<string | undefined>(undefined);
  const [bracketError, setBracketError] = useState<string | undefined>(undefined);
  const [showThirdsModal, setShowThirdsModal] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [showGroupsIntro, setShowGroupsIntro] = useState(true);
  const [showRepechajeFinalHint, setShowRepechajeFinalHint] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(true);
  const [championTeam, setChampionTeam] = useState<Team | undefined>(undefined);
  const [showChampionModal, setShowChampionModal] = useState(false);
  const [confettiKey, setConfettiKey] = useState(0);
  const [showR32Warning, setShowR32Warning] = useState(false);
  const [showNewGamePrompt, setShowNewGamePrompt] = useState(false);
  const { width, height } = useWindowSize();
  const [, setShareInfo] = useState<string | null>(null);
  const [activeShareCard, setActiveShareCard] = useState<ShareCardPayload | null>(null);
  const [viewSharedBy, setViewSharedBy] = useState<BracketSavePayload["sharedBy"] | null>(null);
  const [viewBracketMeta, setViewBracketMeta] = useState<{ name?: string; updatedAt?: string; shortCode?: string } | null>(null);
  const [phaseBlock, setPhaseBlock] = useState<{ title: string; missing: string[] } | null>(null);
  const phaseBlockBannerPick = useMemo(() => pickStopBanner(), [!!phaseBlock]);
  const r32BannerPick = useMemo(() => pickStopBanner(), [showR32Warning]);
  const bracketCaptureRef = useRef<HTMLDivElement>(null);
  const progressGroupsRef = useRef<HTMLDivElement>(null);
  const progressThirdsRef = useRef<HTMLDivElement>(null);
  const progressBracketRef = useRef<HTMLDivElement>(null);
  const progressR32Ref = useRef<HTMLDivElement>(null);
  const shareCardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!isViewOnly) return;
    setShowRulesModal(false);
    setShowThirdsModal(false);
    setShowR32Warning(false);
    setShowChampionModal(false);
    setShowIntercontinentalModal(false);
    setShowSaveModal(false);
    setShowAuthModal(false);
    setPhaseBlock(null);
    setShowNewGamePrompt(false);
  }, [isViewOnly]);
  useEffect(() => {
    if (!isViewOnly || typeof window === "undefined") return;
    const handler = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data as { type?: string; tab?: string; playoffTab?: string; scrollId?: string } | null;
      if (!data || data.type !== "BRACKET_VIEW_NAV") return;
      if (data.tab === "repechajes" || data.tab === "grupos" || data.tab === "dieciseisavos" || data.tab === "llaves") {
        setActiveTab(data.tab);
      }
      if (data.playoffTab === "uefa" || data.playoffTab === "intercontinental") {
        setActivePlayoffTab(data.playoffTab);
      }
      if (data.scrollId) {
        window.setTimeout(() => {
          document.getElementById(data.scrollId!)?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 50);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [isViewOnly]);
  const r32Ref = useRef<Match[]>([]);
  const [bracketNavTarget, setBracketNavTarget] = useState<
    "r32" | "r16" | "qf" | "sf" | "final" | null
  >(null);
  const championModalRef = useRef<HTMLDivElement>(null);
  const championHolo = useHoloPointer();
  const autoSwitchedPlayoffRef = useRef(false);
  const autoSwitchTimeoutRef = useRef<number | null>(null);
  const [autoSwitchNotice, setAutoSwitchNotice] = useState(false);
  const [showIntercontinentalModal, setShowIntercontinentalModal] = useState(false);
  const [intercontinentalConfettiKey, setIntercontinentalConfettiKey] = useState(0);
  const intercontinentalModalShownRef = useRef(false);
  const [isLocked, setIsLocked] = useState(false);
  const playoffStorageReadyRef = useRef(false);
  const teamsFromApiRef = useRef(false);
  const fixturesFromApiRef = useRef(false);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authSession, setAuthSession] = useState<Session | null>(null);
  const [resetAttemptsLeft, setResetAttemptsLeft] = useState<number | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [consentMarketing, setConsentMarketing] = useState(false);
  const [consentNews, setConsentNews] = useState(false);
  const [consentUpdates, setConsentUpdates] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveName, setSaveName] = useState("Mi bracket");
  const [saveMode, setSaveMode] = useState<"new" | "overwrite" | "update">("new");
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [savedBrackets, setSavedBrackets] = useState<SavedBracketMeta[]>([]);
  const [selectedOverwriteId, setSelectedOverwriteId] = useState<string | null>(null);
  const [currentSaveId, setCurrentSaveId] = useState<string | null>(null);
  const [currentSaveName, setCurrentSaveName] = useState<string>("Mi bracket");
  const pendingLoadRef = useRef<BracketSavePayload | null>(null);
  const guestSaveMetaRef = useRef<{ name: string; updatedAt: string; shortCode?: string } | null>(null);
  const authInitRef = useRef(false);
  const [guestShortCode, setGuestShortCode] = useState<string | null>(null);

  const allTeamsIndex = useMemo(() => {
    const map = new Map<string, Team>();
    teams.forEach((t) => {
      map.set(t.nombre.toLowerCase(), t);
      map.set(t.codigo.toLowerCase(), t);
      map.set(t.id.toLowerCase(), t);
    });
    return map;
  }, [teams]);

  const resolveAnyTeam = useCallback(
    (label?: string) => {
      if (!label) return undefined;
      const key = label.trim().toLowerCase();
      return allTeamsIndex.get(key);
    },
    [allTeamsIndex],
  );

  const reset = () => {
    setSelections({});
    setBestThirdIds([]);
    setPicks({});
    setBracketError(undefined);
    setShowThirdsModal(false);
    setChampionTeam(undefined);
    setShowChampionModal(false);
    setIsLocked(false);
  };

  const trackPick = (context: string, matchId: string, teamCode: string) => {
    // Hook para analytics (GA4) - se conecta luego.
    void context;
    void matchId;
    void teamCode;
  };

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

  const resolveRepechajeTeam = useCallback(
    (code?: string, group?: string) => {
      if (!code) return undefined;
      const base = resolveTeamForGroup(code, group);
      if (!base) return undefined;
      const meta = getRepechajeMeta(code);
      if (!meta) return base;
      const canonical = resolveRepechajeCode(code) || code;
      return {
        ...base,
        id: base.id || canonical,
        codigo: canonical,
        nombre: meta.nombre,
        escudo: getRepechajeFlagUrl(meta.flagCode),
      };
    },
    [resolveTeamForGroup],
  );
  const requireAuthUserId = useCallback(() => {
    const userId = authSession?.user?.id;
    if (!userId) throw new Error("Necesitas iniciar sesión.");
    return userId;
  }, [authSession?.user?.id]);

  const buildShareUrl = useCallback(
    (targetId?: string) => {
      if (typeof window === "undefined") return DEFAULT_HOME_URL;
      const baseUrl = import.meta.env.VITE_BRACKET_HOME_URL || DEFAULT_HOME_URL || window.location.origin;
      const resolvedId = targetId || currentSaveId;
      if (!resolvedId) return window.location.href || baseUrl;
      const url = new URL(baseUrl, window.location.origin);
      url.searchParams.set("view", "1");
      url.searchParams.set("bracketId", resolvedId);
      return url.toString();
    },
    [currentSaveId],
  );

  const uploadShareCard = useCallback(
    async (blob: Blob, bracketId: string) => {
      if (!authSession?.access_token) return null;
      return uploadShareCardImage({
        apiBaseUrl: API_BASE_URL || undefined,
        bracketId,
        token: authSession.access_token,
        blob,
      });
    },
    [authSession?.access_token],
  );

  const buildSavePayload = useCallback((): BracketSavePayload => {
    const selectionPayload: BracketSavePayload["selections"] = {};
    Object.entries(selections).forEach(([group, pick]) => {
      selectionPayload[group] = {
        primeroId: pick.primero?.id,
        segundoId: pick.segundo?.id,
        terceroId: pick.tercero?.id,
      };
    });
    const meta = (authUser?.user_metadata || {}) as Record<string, any>;
    const sharedBy = authUser
      ? {
          name: meta.alias || meta.nickname || meta.full_name || meta.name || authUser.email || "Usuario",
          alias: meta.alias || meta.nickname || "",
          avatarUrl: meta.avatar_url || meta.picture || meta.avatar || "",
          coverUrl: meta.cover_url || "",
          userId: authUser.id,
        }
      : undefined;
    return {
      version: 1,
      selections: selectionPayload,
      bestThirdIds,
      picks,
      intercontinentalPicks,
      uefaPicks,
      isLocked,
      sharedBy,
    };
  }, [selections, bestThirdIds, picks, intercontinentalPicks, uefaPicks, isLocked, authUser]);

  const applySavedBracket = useCallback(
    (payload: BracketSavePayload) => {
      const nextSelections: GroupSelections = {};
      Object.entries(payload.selections || {}).forEach(([group, pick]) => {
        nextSelections[group] = {
          primero: resolveTeamForGroup(pick.primeroId, group),
          segundo: resolveTeamForGroup(pick.segundoId, group),
          tercero: resolveTeamForGroup(pick.terceroId, group),
        };
      });
      setSelections(nextSelections);
      setBestThirdIds(payload.bestThirdIds || []);
      setPicks(payload.picks || {});
      setIntercontinentalPicks(payload.intercontinentalPicks || {});
      setUefaPicks(payload.uefaPicks || {});
      setIsLocked(payload.isLocked ?? false);
    },
    [resolveTeamForGroup],
  );

  const loadSavedBrackets = useCallback(async () => {
    try {
      if (!authSession?.user?.id) {
        setSavedBrackets([]);
        return [] as SavedBracketMeta[];
      }
      const { data, error } = await supabase
        .from("bracket_saves")
        .select("id,name,created_at,updated_at")
        .eq("user_id", authSession.user.id)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      const items = (data || []) as SavedBracketMeta[];
      setSavedBrackets(items);
      return items;
    } catch {
      setSavedBrackets([]);
      return [] as SavedBracketMeta[];
    }
  }, [authSession?.user?.id]);

  const loadLatestBracket = useCallback(async () => {
    try {
      let data: { id: string; name?: string; short_code?: string; data?: BracketSavePayload | string } | null = null;
      if (!isViewOnly) return;
      if (!viewBracketId) return;
      const { data: viewData, error } = await supabase
        .from("bracket_saves")
        .select("id,name,short_code,data,created_at,updated_at")
        .eq("id", viewBracketId)
        .maybeSingle();
      if (error || !viewData) return;
      data = viewData as { id: string; name?: string; short_code?: string; data?: BracketSavePayload | string };

      if (!data) return;

      let payload: BracketSavePayload | null = null;
      if (data.data) {
        if (typeof data.data === "string") {
          try {
            payload = JSON.parse(data.data) as BracketSavePayload;
          } catch {
            payload = null;
          }
        } else {
          payload = data.data as BracketSavePayload;
        }
      }
      if (payload) {
        setCurrentSaveId(data.id);
        setCurrentSaveName(data.name || "Mi bracket");
        if (teams.length > 0) {
          applySavedBracket(payload);
        } else {
          pendingLoadRef.current = payload;
        }
        if (isViewOnly) {
          setIsLocked(true);
          setViewSharedBy(payload.sharedBy ?? null);
          setViewBracketMeta({
            name: data.name || "Pronóstico compartido",
            updatedAt: (data as any).updated_at || (data as any).created_at,
            shortCode: data.short_code || undefined,
          });
        }
      } else if (isViewOnly) {
        setViewSharedBy(null);
        setViewBracketMeta(null);
      }
    } catch {
      // ignore
    }
  }, [applySavedBracket, isViewOnly, teams.length, viewBracketId]);

  const readGuestSave = useCallback((): GuestBracketSave | null => {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(LS_GUEST_BRACKET);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as GuestBracketSave;
      if (!parsed?.data) return null;
      const updatedAt = Date.parse(parsed.updatedAt);
      if (!Number.isFinite(updatedAt) || Date.now() - updatedAt > GUEST_SAVE_TTL_MS) {
        window.localStorage.removeItem(LS_GUEST_BRACKET);
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }, []);

  const persistGuestSave = useCallback(
    (
      payload: BracketSavePayload,
      name: string,
      meta?: { shortCode?: string; shareId?: string; shareUrl?: string },
    ) => {
    if (typeof window === "undefined") return null;
    const record: GuestBracketSave = {
      name,
      data: payload,
      updatedAt: new Date().toISOString(),
      shortCode: meta?.shortCode,
      shareId: meta?.shareId,
      shareUrl: meta?.shareUrl,
    };
    try {
      window.localStorage.setItem(LS_GUEST_BRACKET, JSON.stringify(record));
      return record;
    } catch {
      return null;
    }
  }, []);

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

  const closeSaveModal = () => {
    setShowSaveModal(false);
    setSaveError(null);
  };

  const handleAuthSubmit = async () => {
    if (!authEmail || !authPassword) {
      setAuthError("Completa tu correo y contraseña.");
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
        const { error } = await supabase.auth.signUp({
          email: authEmail,
          password: authPassword,
          options: {
            emailRedirectTo: window.location.origin,
            data: consentPayload,
          },
        });
        if (error) throw error;
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
      setAuthError(err instanceof Error ? err.message : "No pudimos iniciar sesión.");
    } finally {
      setAuthBusy(false);
    }
  };

  const handleOAuthSignIn = async (provider: "google" | "facebook") => {
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

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setAuthUser(null);
    setAuthSession(null);
    setCurrentSaveId(null);
    setSavedBrackets([]);
    setSaveNotice("Sesión cerrada.");
  };

  const handleSaveClick = async () => {
    setSaveError(null);
    if (!authSession?.access_token) {
      setShowChampionModal(false);
      const existing = readGuestSave();
      if (existing) {
        guestSaveMetaRef.current = {
          name: existing.name,
          updatedAt: existing.updatedAt,
          shortCode: existing.shortCode,
        };
        setGuestShortCode(existing.shortCode ?? null);
      } else {
        setGuestShortCode(null);
      }
      const fallbackName = existing?.name || guestSaveMetaRef.current?.name || "Mi bracket";
      setSaveMode("new");
      setSaveName(fallbackName);
      setSelectedOverwriteId(null);
      setShowSaveModal(true);
      return;
    }
    setSaveMode("new");
    setSaveName("Mi bracket");
    setSelectedOverwriteId(null);
    setShowSaveModal(true);
  };

  const handleConfirmSave = async () => {
    setSaveBusy(true);
    setSaveError(null);
    try {
      const payload = buildSavePayload();
      const name = saveName.trim() || "Mi bracket";
      if (!authSession?.access_token) {
        let shortCode = "";
        let shareId = "";
        let shareUrl = "";
        try {
          const guestShare = await createGuestShare({
            apiBaseUrl: API_BASE_URL || undefined,
            name,
            data: payload,
          });
          if (!guestShare?.id || !guestShare?.shortCode) {
            throw new Error("No se pudo generar el código.");
          }
          shortCode = guestShare.shortCode.toUpperCase();
          shareId = guestShare.id;
          shareUrl = guestShare.sharePageUrl || "";
        } catch (err) {
          setSaveError(err instanceof Error ? err.message : "No pudimos generar el código de invitado.");
          setSaveBusy(false);
          return;
        }
        const stored = persistGuestSave(payload, name, { shortCode, shareId, shareUrl });
        guestSaveMetaRef.current = {
          name: stored?.name || name,
          updatedAt: stored?.updatedAt || new Date().toISOString(),
          shortCode,
        };
        setGuestShortCode(shortCode);
        setShowSaveModal(false);
        setSaveNotice(`Bracket guardado. Código: ${shortCode}`);
        return;
      }
      const userId = requireAuthUserId();
      const { count, error: countError } = await supabase
        .from("bracket_saves")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId);
      if (countError) throw countError;
      if ((count || 0) >= 3) {
        setSaveError("Llegaste al límite de 3 brackets. Adminístralos en /user.");
        setSaveBusy(false);
        return;
      }

      const { data, error } = await supabase
        .from("bracket_saves")
        .insert([{ user_id: userId, name, data: payload }])
        .select("id,name")
        .maybeSingle();
      if (error) throw error;
      const saved = data as { id: string; name?: string } | null;

      if (saved?.id) {
        setCurrentSaveId(saved.id);
        setCurrentSaveName(saved.name || name);
      }
      setShowSaveModal(false);
      setSaveNotice("Bracket guardado correctamente.");
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "No pudimos guardar el bracket.");
    } finally {
      setSaveBusy(false);
    }
  };
  useEffect(() => {
    if (authInitRef.current) return;
    authInitRef.current = true;
    let mounted = true;
    const applyPendingConsent = async (session?: Session | null) => {
      if (!session?.user) return;
      const pending = readPendingConsent();
      if (!pending) return;
      try {
        await supabase.auth.updateUser({ data: pending });
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
        setAuthSession(data.session ?? null);
        setAuthUser(data.session?.user ?? null);
        void applyPendingConsent(data.session);
      })
      .catch(() => null);

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthSession(session ?? null);
      setAuthUser(session?.user ?? null);
      void applyPendingConsent(session);
      if (!session) {
        setCurrentSaveId(null);
        setSavedBrackets([]);
      }
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!authUser?.id) {
      setResetAttemptsLeft(null);
      return;
    }
    if (typeof window === "undefined") {
      setResetAttemptsLeft(MAX_RESET_ATTEMPTS);
      return;
    }
    try {
      const key = `fm-reset-attempts:${authUser.id}`;
      const raw = window.localStorage.getItem(key);
      const used = raw ? Number(raw) : 0;
      const normalized = Number.isFinite(used) ? Math.max(0, Math.floor(used)) : 0;
      const clampedUsed = Math.min(normalized, MAX_RESET_ATTEMPTS);
      setResetAttemptsLeft(MAX_RESET_ATTEMPTS - clampedUsed);
    } catch {
      setResetAttemptsLeft(MAX_RESET_ATTEMPTS);
    }
  }, [authUser?.id]);

    useEffect(() => {
      if (isViewOnly) {
        if (!skipAutoLoadRef.current) {
          loadLatestBracket();
        }
        return;
      }
      if (!authSession?.access_token) return;
      if (!pageParams?.resetGame && !skipAutoLoadRef.current) {
        loadLatestBracket();
      }
      loadSavedBrackets();
    }, [isViewOnly, authSession?.access_token, pageParams?.resetGame, loadLatestBracket, loadSavedBrackets]);
  useEffect(() => {
    if (!isViewOnly) return;
    if (!skipAutoLoadRef.current) {
      loadLatestBracket();
    }
  }, [isViewOnly, loadLatestBracket]);

  useEffect(() => {
    if (!isViewOnly) return;
    const userId = viewSharedBy?.userId;
    if (!userId) return;
    const needsCover = !viewSharedBy?.coverUrl;
    const needsAvatar = !viewSharedBy?.avatarUrl;
    const needsAlias = !viewSharedBy?.alias && !viewSharedBy?.name;
    if (!needsCover && !needsAvatar && !needsAlias) return;
    const baseUrl = resolveApiBase(API_BASE_URL);
    if (!baseUrl) return;
    let active = true;
    fetch(`${baseUrl}/api/public-profile/${userId}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Perfil no disponible");
        return res.json() as Promise<{
          userId?: string;
          name?: string;
          alias?: string;
          avatarUrl?: string;
          coverUrl?: string;
        }>;
      })
      .then((data) => {
        if (!active || !data) return;
        setViewSharedBy((prev) => {
          if (!prev) return { ...data };
          return {
            ...prev,
            userId: prev.userId || data.userId,
            name: prev.name || data.name,
            alias: prev.alias || data.alias,
            avatarUrl: prev.avatarUrl || data.avatarUrl,
            coverUrl: prev.coverUrl || data.coverUrl,
          };
        });
      })
      .catch(() => null);
    return () => {
      active = false;
    };
  }, [
    isViewOnly,
    viewSharedBy?.userId,
    viewSharedBy?.coverUrl,
    viewSharedBy?.avatarUrl,
    viewSharedBy?.alias,
    viewSharedBy?.name,
  ]);

  useEffect(() => {
    if (teams.length === 0) return;
    if (pendingLoadRef.current) {
      applySavedBracket(pendingLoadRef.current);
      pendingLoadRef.current = null;
      }
    }, [teams.length, applySavedBracket]);

    useEffect(() => {
      if (!teams.length) return;
      try {
        window.localStorage.setItem(LS_TEAMS, JSON.stringify(teams));
      } catch {
        // ignore
      }
    }, [teams]);

  useEffect(() => {
    if (!saveNotice) return;
    const t = window.setTimeout(() => setSaveNotice(null), 4500);
    return () => window.clearTimeout(t);
  }, [saveNotice]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const apiData = await fetchFanaticoData();
        if (apiData?.teams?.length) {
          const parsedTeams: Team[] = apiData.teams.map((team, idx) => ({
            id: team.id || `team-${idx + 1}`,
            nombre:
              team.seleccion ||
              team.id ||
              team.codigo_fixture ||
              `Equipo ${idx + 1}`,
            codigo: team.codigo_fixture || team.id || "",
            grupo: (team.grupo || "").toUpperCase(),
            escudo: team.escudo_url,
          }));
          const mergedTeams = ensureRepechajeTeams(parsedTeams.map(applyRepechajeMeta));
          setTeams(mergedTeams);
          teamsFromApiRef.current = true;

          if (apiData.fixtures?.length) {
            const parsedFixtures: Fixture[] = apiData.fixtures.map(
              (fixture, idx) => ({
                id: fixture.id_partido || `fx-${idx + 1}`,
                fecha: fixture.fecha?.toString(),
                hora: fixture.hora?.toString(),
                fase: fixture.fase?.toString(),
                group: fixture.grupo?.toString().toUpperCase(),
                jornada: fixture.jornada?.toString(),
                homeId: fixture.local_id?.toString(),
                awayId: fixture.visita_id?.toString(),
                estadio: fixture.estadio?.toString(),
                locacion: fixture.locacion?.toString(),
              }),
            );
            setFixtures(parsedFixtures);
            fixturesFromApiRef.current = true;
          }
          return;
        }

        const resp = await fetch(seleccionesUrl);
        const csv = await resp.text();
        const lines = csv.split("\n").filter((l) => l.trim());
        if (lines.length === 0) throw new Error("CSV vacio");
        const headers = lines[0]
          .split(",")
          .map((h) => h.trim().toLowerCase().replace(/"/g, ""));
        const idxId = headers.findIndex((h) => h === "id");
        const idxCodigo = headers.findIndex((h) => h === "codigo_fixture");
        const idxNombre = headers.findIndex((h) => h === "seleccion");
        const idxGrupo = headers.findIndex((h) => h === "grupo");
        const idxEscudo = headers.findIndex((h) => h.includes("escudo") || h.includes("bandera"));

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
        setTeams(mergedTeams);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error desconocido");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    const loadFixtures = async () => {
      if (fixturesFromApiRef.current) return;
      try {
        const resp = await fetch(fixturesUrl);
        const tsv = await resp.text();
        const lines = tsv.split("\n").filter((l) => l.trim());
        if (lines.length < 2) return;
        const headers = parseTSVLine(lines[0]).map((h) => h.toLowerCase());
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
        const parsed: Fixture[] = [];
        for (let i = 1; i < lines.length; i++) {
          const cols = parseTSVLine(lines[i]);
          parsed.push({
            id: idxId >= 0 ? cols[idxId] : `fx-${i}`,
            fecha: idxFecha >= 0 ? cols[idxFecha] : undefined,
            hora: idxHora >= 0 ? cols[idxHora] : undefined,
            fase: idxFase >= 0 ? cols[idxFase] : undefined,
            group: idxGrupo >= 0 ? cols[idxGrupo].toUpperCase() : undefined,
            jornada: idxJornada >= 0 ? cols[idxJornada] : undefined,
            homeId: idxLocal >= 0 ? cols[idxLocal] : undefined,
            awayId: idxVisita >= 0 ? cols[idxVisita] : undefined,
            estadio: idxEstadio >= 0 ? cols[idxEstadio] : undefined,
            locacion: idxLocacion >= 0 ? cols[idxLocacion] : undefined,
          });
        }
        setFixtures(parsed);
      } catch {
        setFixtures([]);
      }
    };
    loadFixtures();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(LS_INTERCONTINENTAL);
      window.localStorage.removeItem(LS_UEFA);
      setIntercontinentalPicks({});
      setUefaPicks({});
    } catch {
      // ignore
    } finally {
      playoffStorageReadyRef.current = true;
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !playoffStorageReadyRef.current) return;
    try {
      window.localStorage.setItem(LS_INTERCONTINENTAL, JSON.stringify(intercontinentalPicks));
    } catch {
      // ignore
    }
  }, [intercontinentalPicks]);

  useEffect(() => {
    if (typeof window === "undefined" || !playoffStorageReadyRef.current) return;
    try {
      window.localStorage.setItem(LS_UEFA, JSON.stringify(uefaPicks));
    } catch {
      // ignore
    }
  }, [uefaPicks]);

  const baseGroups = useMemo(() => {
    const map = new Map<string, Team[]>();
    teams.forEach((t) => {
      if (!t.grupo) return;
      if (!map.has(t.grupo)) map.set(t.grupo, []);
      map.get(t.grupo)!.push(t);
    });
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([grupo, lista]) => ({
        grupo,
        equipos: lista.sort((a, b) => a.codigo.localeCompare(b.codigo, undefined, { sensitivity: "base" })),
      }));
  }, [teams]);

  const interWinnerCodes = useMemo(() => {
    const map: Record<string, string | undefined> = {};
    INTERCONTINENTAL_KEYS.forEach((key) => {
      const semiWinner = intercontinentalPicks[key.semi.id];
      const finalPick = intercontinentalPicks[key.final.id];
      const valid = [key.seed, semiWinner].filter(Boolean) as string[];
      map[key.id] = finalPick && valid.includes(finalPick) ? finalPick : undefined;
    });
    return map;
  }, [intercontinentalPicks]);

  const interWinnerICode = interWinnerCodes["I"];
  const interWinnerKCode = interWinnerCodes["K"];

  const intercontinentalComplete = useMemo(
    () =>
      INTERCONTINENTAL_KEYS.every((key) => {
        const semiPick = intercontinentalPicks[key.semi.id];
        if (semiPick && ![key.semi.home, key.semi.away].includes(semiPick)) return false;
        const finalPick = intercontinentalPicks[key.final.id];
        const validFinal = [key.seed, semiPick].filter(Boolean) as string[];
        return !!finalPick && validFinal.includes(finalPick);
      }),
    [intercontinentalPicks],
  );

  const uefaWinnerCodes = useMemo(() => {
    const map: Record<string, string | undefined> = {};
    UEFA_KEYS.forEach((key) => {
      const s1 = uefaPicks[key.semi1.id];
      const s2 = uefaPicks[key.semi2.id];
      const finalPick = uefaPicks[key.final.id];
      const valid = [s1, s2].filter(Boolean) as string[];
      map[key.id] = finalPick && valid.includes(finalPick) ? finalPick : undefined;
    });
    return map;
  }, [uefaPicks]);

  const uefaComplete = useMemo(
    () =>
      UEFA_KEYS.every((key) => {
        const s1 = uefaPicks[key.semi1.id];
        const s2 = uefaPicks[key.semi2.id];
        const finalPick = uefaPicks[key.final.id];
        const valid = [s1, s2].filter(Boolean) as string[];
        return !!finalPick && valid.includes(finalPick);
      }),
    [uefaPicks],
  );

  const winnerACode = uefaWinnerCodes["A"];
  const winnerBCode = uefaWinnerCodes["B"];
  const winnerDCode = uefaWinnerCodes["D"];
  const winnerFCode = uefaWinnerCodes["F"];

  const winnerK = useMemo(
    () => resolveTeamForGroup(interWinnerKCode, "K"),
    [interWinnerKCode, resolveTeamForGroup],
  );
  const winnerI = useMemo(
    () => resolveTeamForGroup(interWinnerICode, "I"),
    [interWinnerICode, resolveTeamForGroup],
  );
  const winnerB = useMemo(() => resolveTeamForGroup(winnerBCode, "B"), [winnerBCode, resolveTeamForGroup]);
  const winnerF = useMemo(() => resolveTeamForGroup(winnerFCode, "F"), [winnerFCode, resolveTeamForGroup]);
  const winnerD = useMemo(() => resolveTeamForGroup(winnerDCode, "D"), [winnerDCode, resolveTeamForGroup]);
  const winnerA = useMemo(() => resolveTeamForGroup(winnerACode, "A"), [winnerACode, resolveTeamForGroup]);

  const repechajesLocked = uefaComplete && intercontinentalComplete;

  const repechajesMissing = useMemo(() => {
    const missing: string[] = [];
    if (!uefaComplete) missing.push("UEFA");
    if (!intercontinentalComplete) missing.push("Intercontinental");
    return missing;
  }, [uefaComplete, intercontinentalComplete]);

  const groupCompletion = useMemo(() => {
    const missing: string[] = [];
    GROUP_LETTERS.forEach((g) => {
      const pick = selections[g];
      if (!pick?.primero || !pick?.segundo || !pick?.tercero) {
        missing.push(g);
      }
    });
    return { complete: missing.length === 0, missing };
  }, [selections]);

  const thirdsComplete = bestThirdIds.length === MAX_THIRD;

  const missingMatchLabels = useCallback(
    (round: Match[]) =>
      round.filter((m) => !picks[m.id]).map((m) => `Partido ${m.label}`),
    [picks],
  );

  
  const handlePlayoffTabClick = (tab: "uefa" | "intercontinental") => {
    if (isViewOnly) {
      setActivePlayoffTab(tab);
      return;
    }
    if (tab === "intercontinental" && !uefaComplete) {
      setActivePlayoffTab("uefa");
      setPhaseBlock({
        title: "Completa UEFA para desbloquear Intercontinental",
        missing: ["Elige ganadores en todas las rutas UEFA."],
      });
      return;
    }
    setActivePlayoffTab(tab);
  };

  const goToGroupsIfReady = useCallback(() => {
    if (showNewGamePrompt) {
      setActiveTab("repechajes");
      return false;
    }
    if (isViewOnly) {
      setPhaseBlock(null);
      setActiveTab("grupos");
      return true;
    }
    if (uefaComplete && intercontinentalComplete) {
      setActiveTab("grupos");
      return true;
    }
    setActiveTab("repechajes");
    setPhaseBlock({
      title: "Completa los repechajes",
      missing: repechajesMissing.length ? repechajesMissing : ["UEFA", "Intercontinental"],
    });
    return false;
    }, [showNewGamePrompt, isViewOnly, uefaComplete, intercontinentalComplete, repechajesMissing]);

  const goToDieciseisavosIfReady = useCallback(() => {
    if (showNewGamePrompt) {
      setActiveTab("repechajes");
      return false;
    }
    if (isViewOnly) {
      setPhaseBlock(null);
      setActiveTab("dieciseisavos");
      return true;
    }
    if (!(uefaComplete && intercontinentalComplete)) {
      return goToGroupsIfReady();
    }
    if (!groupCompletion.complete) {
      setActiveTab("grupos");
      setPhaseBlock({
        title: "Completa la fase de grupos",
        missing: groupCompletion.missing.length
          ? groupCompletion.missing.map((g) => `Grupo ${g}`)
          : ["Completa 1ro, 2do y 3ro de cada grupo."],
      });
      return false;
    }
    if (!thirdsComplete) {
      setActiveTab("grupos");
      setPhaseBlock({
        title: "Selecciona los 8 mejores terceros",
        missing: [`Seleccionados: ${bestThirdIds.length}/${MAX_THIRD}`],
      });
      return false;
    }
    setActiveTab("dieciseisavos");
    return true;
    }, [
      showNewGamePrompt,
      isViewOnly,
      uefaComplete,
      intercontinentalComplete,
      goToGroupsIfReady,
      groupCompletion.complete,
      groupCompletion.missing,
      thirdsComplete,
      bestThirdIds.length,
    ]);

  const goToLlavesIfReady = useCallback(() => {
    if (showNewGamePrompt) {
      setActiveTab("repechajes");
      return false;
    }
    if (isViewOnly) {
      setPhaseBlock(null);
      setActiveTab("llaves");
      return true;
    }
    if (!goToDieciseisavosIfReady()) return false;
    if (!r32CompleteRef.current) {
      setActiveTab("dieciseisavos");
      setPhaseBlock({
        title: "Completa dieciseisavos para avanzar",
        missing: missingMatchLabels(r32Ref.current),
      });
      return false;
    }
    setActiveTab("llaves");
    return true;
  }, [showNewGamePrompt, isViewOnly, goToDieciseisavosIfReady, missingMatchLabels]);

  const closeIntercontinentalModal = useCallback(() => {
    setShowIntercontinentalModal(false);
    goToGroupsIfReady();
  }, [goToGroupsIfReady]);

  useEffect(() => {
    if (isViewOnly) return;
    if (!uefaComplete) {
      if (activePlayoffTab === "intercontinental") {
        setActivePlayoffTab("uefa");
      }
      autoSwitchedPlayoffRef.current = false;
      if (autoSwitchTimeoutRef.current) {
        window.clearTimeout(autoSwitchTimeoutRef.current);
        autoSwitchTimeoutRef.current = null;
      }
      setAutoSwitchNotice(false);
      return;
    }
    if (activePlayoffTab === "uefa" && !autoSwitchedPlayoffRef.current) {
      setActivePlayoffTab("intercontinental");
      autoSwitchedPlayoffRef.current = true;
      setAutoSwitchNotice(true);
      if (autoSwitchTimeoutRef.current) {
        window.clearTimeout(autoSwitchTimeoutRef.current);
      }
      autoSwitchTimeoutRef.current = window.setTimeout(() => {
        setAutoSwitchNotice(false);
        autoSwitchTimeoutRef.current = null;
      }, 2200);
    }
  }, [uefaComplete, activePlayoffTab, isViewOnly]);

  useEffect(() => {
    if (isViewOnly) {
      intercontinentalModalShownRef.current = true;
      return;
    }
    if (!intercontinentalComplete) {
      intercontinentalModalShownRef.current = false;
      return;
    }
    if (!intercontinentalModalShownRef.current) {
      setShowIntercontinentalModal(true);
      setIntercontinentalConfettiKey(Date.now());
      intercontinentalModalShownRef.current = true;
    }
  }, [intercontinentalComplete, isViewOnly]);

  const playoffWinners = useMemo(
    () =>
      ({
        A: winnerA,
        B: winnerB,
        D: winnerD,
        F: winnerF,
        I: winnerI,
        K: winnerK,
      }) as Record<string, Team | undefined>,
    [winnerA, winnerB, winnerD, winnerF, winnerI, winnerK],
  );

  const isRepechajePlaceholder = (team: Team) =>
    /^rep\d+$/i.test(team.id || "") || /^rep\d+$/i.test(team.codigo || "");

  const { groups, playoffReplacements } = useMemo(() => {
    const baseMap = new Map(baseGroups.map((g) => [g.grupo, g.equipos]));
    const groupKeys = new Set<string>([...baseMap.keys(), ...Object.keys(playoffWinners)]);
    const replacements: Record<string, { fromId: string; toTeam: Team } | undefined> = {};

    const groups = Array.from(groupKeys)
      .sort((a, b) => a.localeCompare(b))
      .map((grupo) => {
        const winner = playoffWinners[grupo];
        const equipos = [...(baseMap.get(grupo) || [])];
        if (winner) {
          const idx = equipos.findIndex(isRepechajePlaceholder);
          if (idx >= 0) {
            const placeholder = equipos[idx];
            if (placeholder.id !== winner.id) {
              replacements[grupo] = { fromId: placeholder.id, toTeam: winner };
            }
            equipos[idx] = winner;
          } else if (!equipos.some((t) => t.id === winner.id)) {
            equipos.push(winner);
          }
        }
        return { grupo, equipos };
      });

    return { groups, playoffReplacements: replacements };
  }, [baseGroups, playoffWinners]);

  const derivedTeamIndex = useMemo(() => {
    const map = new Map<string, Team>();
    groups.forEach(({ equipos }) => {
      equipos.forEach((t) => {
        map.set(t.nombre.toLowerCase(), t);
        map.set(t.codigo.toLowerCase(), t);
        map.set(t.id.toLowerCase(), t);
      });
    });
    return map;
  }, [groups]);

  const resolveTeam = (label?: string) => {
    if (!label) return undefined;
    const key = label.trim().toLowerCase();
    return derivedTeamIndex.get(key);
  };

  useEffect(() => {
    setSelections((prev) => {
      let changed = false;
      const next: GroupSelections = { ...prev };
      groups.forEach(({ grupo, equipos }) => {
        const current = next[grupo];
        if (!current) return;
        const updated: GroupSelections[string] = { ...current };
        const replacement = playoffReplacements[grupo];
        if (replacement) {
          (["primero", "segundo", "tercero"] as const).forEach((slot) => {
            if (updated[slot]?.id === replacement.fromId) {
              updated[slot] = replacement.toTeam;
              changed = true;
            }
          });
        }
        const allowed = new Set(equipos.map((t) => t.id));
        (["primero", "segundo", "tercero"] as const).forEach((slot) => {
          if (updated[slot] && !allowed.has(updated[slot]!.id)) {
            updated[slot] = undefined;
            changed = true;
          }
        });
        next[grupo] = updated;
      });
      return changed ? next : prev;
    });
  }, [groups, playoffReplacements]);

  const handlePick = (grupo: string, team: Team) => {
    if (isLocked) return;
    const order: Array<keyof NonNullable<GroupSelections[string]>> = ["primero", "segundo", "tercero"];
    setSelections((prev) => {
      const current = prev[grupo] || {};
      const pickedSlot = order.find((slot) => current[slot]?.id === team.id);
      const filledCount = order.filter((slot) => current[slot]).length;
      if (pickedSlot) return prev;
      if (filledCount >= 3) return prev;
      const availableSlot = order.find((slot) => !current[slot]) ?? "tercero";
      const updatedGroup: GroupSelections[string] = { ...current, [availableSlot]: team };
      const nextSelections = { ...prev, [grupo]: updatedGroup };

      const isMobile = typeof window !== "undefined" && window.matchMedia("(max-width: 640px)").matches;
      const filledCountNext = order.filter((slot) => updatedGroup[slot]).length;
      if (isMobile && filledCountNext === 3) {
        setOpenGroups((prevOpen) => ({ ...prevOpen, [grupo]: false }));
      }

      return nextSelections;
    });
  };

  const togglePlayoffPick =
    (setState: React.Dispatch<React.SetStateAction<PlayoffPickState>>, context: string) =>
    (matchId: string, teamCode: string) => {
      setState((prev) => {
        if (prev[matchId]) return prev;
        return { ...prev, [matchId]: teamCode };
      });
      trackPick(context, matchId, teamCode);
    };

  const handleIntercontinentalPick = togglePlayoffPick(setIntercontinentalPicks, "repechaje-intercontinental");
  const handleUefaPick = togglePlayoffPick(setUefaPicks, "repechaje-uefa");

  const resetIntercontinental = () => setIntercontinentalPicks({});
  const resetUEFA = () => setUefaPicks({});
  const resetAll = () => {
    reset();
    resetIntercontinental();
    resetUEFA();
  };
  const handleFinalReset = () => {
    if (!authUser || resetAttemptsLeft === null || resetAttemptsLeft <= 0) return;
    setResetAttemptsLeft((prev) => {
      if (prev === null || prev <= 0) return prev;
      const next = prev - 1;
      if (typeof window !== "undefined") {
        try {
          const key = `fm-reset-attempts:${authUser.id}`;
          const used = MAX_RESET_ATTEMPTS - next;
          window.localStorage.setItem(key, `${used}`);
        } catch {
          // ignore
        }
      }
      return next;
    });
    resetAll();
  };
  const handleNewGame = () => {
    resetAll();
    pendingLoadRef.current = null;
    setActiveTab("repechajes");
    setSaveMode("new");
    setSaveName("Mi bracket");
    setSelectedOverwriteId(null);
    setCurrentSaveId(null);
    setCurrentSaveName("Mi bracket");
    setSaveError(null);
    setSaveNotice(null);
    setShowNewGamePrompt(false);
    suspendAutoAdvanceRef.current = false;
  };
  const newGamePromptShownRef = useRef(false);
  const suspendAutoAdvanceRef = useRef(false);
  const lastResetFromPanelRef = useRef<number | null>(null);
  const skipAutoLoadRef = useRef(false);
  useEffect(() => {
    if (pageParams?.resetGame) return;
    skipAutoLoadRef.current = false;
  }, [authSession?.access_token, pageParams?.resetGame]);
  useEffect(() => {
    const resetToken = pageParams?.resetGame as number | undefined;
    if (!resetToken) return;
    if (lastResetFromPanelRef.current === resetToken) return;
    lastResetFromPanelRef.current = resetToken;
    skipAutoLoadRef.current = true;
    handleNewGame();
    navigateTo("home", {});
  }, [pageParams?.resetGame, handleNewGame, navigateTo]);

  const toggleThirdChoice = (team: Team) => {
    if (isLocked) return;
    setBestThirdIds((prev) => {
      if (prev.includes(team.id)) return prev;
      if (prev.length >= MAX_THIRD) return prev;
      return [...prev, team.id];
    });
  };

  useEffect(() => {
    setIntercontinentalPicks((prev) => {
      const next = { ...prev };
      let changed = false;
      INTERCONTINENTAL_KEYS.forEach((key) => {
        const semiPick = next[key.semi.id];
        if (semiPick && ![key.semi.home, key.semi.away].includes(semiPick)) {
          delete next[key.semi.id];
          changed = true;
        }
        const finalPick = next[key.final.id];
        const validFinal = [key.seed, next[key.semi.id]].filter(Boolean) as string[];
        if (finalPick && !validFinal.includes(finalPick)) {
          delete next[key.final.id];
          changed = true;
        }
        if (!next[key.semi.id] && finalPick) {
          delete next[key.final.id];
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [intercontinentalPicks]);

  useEffect(() => {
    setUefaPicks((prev) => {
      const next = { ...prev };
      let changed = false;
      UEFA_KEYS.forEach((key) => {
        const semi1Pick = next[key.semi1.id];
        const semi2Pick = next[key.semi2.id];
        if (semi1Pick && ![key.semi1.home, key.semi1.away].includes(semi1Pick)) {
          delete next[key.semi1.id];
          changed = true;
        }
        if (semi2Pick && ![key.semi2.home, key.semi2.away].includes(semi2Pick)) {
          delete next[key.semi2.id];
          changed = true;
        }
        const finalPick = next[key.final.id];
        const validFinal = [next[key.semi1.id], next[key.semi2.id]].filter(Boolean) as string[];
        if (finalPick && !validFinal.includes(finalPick)) {
          delete next[key.final.id];
          changed = true;
        }
        if ((!next[key.semi1.id] || !next[key.semi2.id]) && finalPick) {
          delete next[key.final.id];
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [uefaPicks]);

  const intercontinentalBlocks = useMemo<PlayoffKeyBlockData[]>(() => {
    return INTERCONTINENTAL_KEYS.map((key) => {
      const semiWinner = intercontinentalPicks[key.semi.id];
      return {
        id: key.id,
        title: key.title,
        subtitle: "Partidos Únicos",
        mapGroup: key.mapGroup,
        matches: [
          {
            id: key.semi.id,
            title: "Semifinal",
            dateLabel: key.semi.date,
            homeTeam: resolveRepechajeTeam(key.semi.home),
            awayTeam: resolveRepechajeTeam(key.semi.away),
            winnerCode: intercontinentalPicks[key.semi.id],
          },
          {
            id: key.final.id,
            title: "Final",
            dateLabel: key.final.date,
            homeTeam: resolveRepechajeTeam(key.seed),
            awayTeam: semiWinner ? resolveRepechajeTeam(semiWinner) : undefined,
            winnerCode: intercontinentalPicks[key.final.id],
            highlightFinal: true,
          },
        ],
      };
    });
  }, [intercontinentalPicks, resolveRepechajeTeam]);

  const uefaBlocks = useMemo<PlayoffKeyBlockData[]>(() => {
    return UEFA_KEYS.map((key) => ({
      id: key.id,
      title: key.title,
      subtitle: "Partidos Únicos",
      mapGroup: key.mapGroup,
      matches: [
        {
          id: key.semi1.id,
          title: "Semifinal 1",
          homeTeam: resolveRepechajeTeam(key.semi1.home),
          awayTeam: resolveRepechajeTeam(key.semi1.away),
          winnerCode: uefaPicks[key.semi1.id],
        },
        {
          id: key.semi2.id,
          title: "Semifinal 2",
          homeTeam: resolveRepechajeTeam(key.semi2.home),
          awayTeam: resolveRepechajeTeam(key.semi2.away),
          winnerCode: uefaPicks[key.semi2.id],
        },
        {
          id: key.final.id,
          title: "Final",
          homeTeam: uefaPicks[key.semi1.id] ? resolveRepechajeTeam(uefaPicks[key.semi1.id]) : undefined,
          awayTeam: uefaPicks[key.semi2.id] ? resolveRepechajeTeam(uefaPicks[key.semi2.id]) : undefined,
          winnerCode: uefaPicks[key.final.id],
          highlightFinal: true,
        },
      ],
    }));
  }, [uefaPicks, resolveRepechajeTeam]);

  const activePlayoffBlocks = useMemo(
    () => (activePlayoffTab === "intercontinental" ? intercontinentalBlocks : uefaBlocks),
    [activePlayoffTab, intercontinentalBlocks, uefaBlocks],
  );

  const hasPickableFinalMissing = useMemo(() => {
    return activePlayoffBlocks.some((block) => {
      const finalMatch = block.matches[block.matches.length - 1];
      if (!finalMatch?.highlightFinal) return false;
      if (!finalMatch.homeTeam || !finalMatch.awayTeam) return false;
      return !finalMatch.winnerCode;
    });
  }, [activePlayoffBlocks]);

  useEffect(() => {
    setShowRepechajeFinalHint(false);
  }, [activeTab, activePlayoffTab]);

  useEffect(() => {
    if (activeTab !== "repechajes" || repechajesLocked) {
      setShowRepechajeFinalHint(false);
      return;
    }
    if (!hasPickableFinalMissing) {
      setShowRepechajeFinalHint(false);
      return;
    }
    if (showRepechajeFinalHint) return;

    const timer = window.setTimeout(() => {
      setShowRepechajeFinalHint(true);
    }, 10000);

    return () => window.clearTimeout(timer);
  }, [activeTab, repechajesLocked, hasPickableFinalMissing, showRepechajeFinalHint]);

  const seeds = useMemo(() => buildSeedsFromSelections(selections), [selections]);

  const thirdsAvailable = useMemo(() => {
    const list: Team[] = [];
    GROUP_LETTERS.forEach((g) => {
      const t = selections[g]?.tercero;
      if (t) list.push(t);
    });
    return list;
  }, [selections]);

  useEffect(() => {
    setBestThirdIds((prev) => {
      let next = [...prev];
      Object.values(playoffReplacements).forEach((replacement) => {
        if (!replacement) return;
        const idx = next.indexOf(replacement.fromId);
        if (idx >= 0) next[idx] = replacement.toTeam.id;
      });
      const filtered = next.filter((id) => thirdsAvailable.some((t) => t.id === id));
      const deduped = Array.from(new Set(filtered));
      if (deduped.length === prev.length && deduped.every((id, i) => id === prev[i])) {
        return prev;
      }
      return deduped;
    });
  }, [thirdsAvailable, playoffReplacements]);

  const thirdsQualifiedGroups = useMemo(() => {
    const res = thirdsAvailable
      .filter((t) => bestThirdIds.includes(t.id))
      .map((t) => t.grupo.toUpperCase())
      .sort();
    return res;
  }, [thirdsAvailable, bestThirdIds]);

  const bestThirdTeams = useMemo(
    () =>
      bestThirdIds
        .map((id) => thirdsAvailable.find((t) => t.id === id))
        .filter(Boolean) as Team[],
    [bestThirdIds, thirdsAvailable],
  );

  const shareDisabled = bestThirdIds.length < MAX_THIRD;

  const getSeedLabel = (team?: Team) => {
    if (!team) return "--";
    const group = team.grupo?.toUpperCase() || "";
    const pick = selections[group];
    if (pick?.primero?.id === team.id) return `1G${group}`;
    if (pick?.segundo?.id === team.id) return `2G${group}`;
    if (pick?.tercero?.id === team.id) {
      const order = bestThirdIds.indexOf(team.id);
      return order >= 0 ? `3G${group} (#${order + 1})` : `3G${group}`;
    }
    return team.id || team.nombre || "--";
  };

  const getSeedLabelR32 = (team?: Team) => {
    if (!team) return "";
    const group = team.grupo?.toUpperCase() || "";
    if (!group) return "";
    const pick = selections[group];
    if (pick?.primero?.id === team.id) return `1${group}`;
    if (pick?.segundo?.id === team.id) return `2${group}`;
    if (pick?.tercero?.id === team.id) return `3${group}`;
    return "";
  };

const scheduleByMatch = useMemo(() => {
  const map: Record<string, MatchSchedule> = {};
  fixtures.forEach((fx) => {
    const id = normalizeMatchKey(fx.id);
    if (id) {
      map[id] = {
        fecha: fx.fecha,
        hora: fx.hora,
        estadio: fx.estadio,
        locacion: fx.locacion,
        homeId: fx.homeId,
        awayId: fx.awayId,
      };
    }
  });
  return map;
}, [fixtures]);

  const { r32, r16, qf, sf, final, thirdPlace } = useMemo(() => {
    if (bestThirdIds.length < MAX_THIRD) return { r32: [], r16: [], qf: [], sf: [], final: [], thirdPlace: [] };
    const { matches, error, warning } = buildRoundOf32(seeds, thirdsQualifiedGroups, thirdLookup as any);
    if (error) {
      setBracketError(error);
      return { r32: [], r16: [], qf: [], sf: [], final: [], thirdPlace: [] };
    }
    // Ocultamos advertencias de asignacion generada por defecto; solo mostramos errores reales.
    setBracketError(undefined);
    return buildNextRounds(matches, picks);
  }, [seeds, thirdsQualifiedGroups, picks, bestThirdIds.length]);
  useEffect(() => {
    r32Ref.current = r32;
  }, [r32]);
  const runnerUpTeam = final[0]?.perdedor;
  const thirdPlaceWinner = thirdPlace[0]?.ganador;
  const shareCardUploadKeyRef = useRef<string | null>(null);
  const viewSharePayload = useMemo(() => {
    const shareUrl = buildShareUrl(viewBracketId || undefined);
    return {
      champion: {
        name: championTeam?.nombre || "Por definir",
        escudo: getTeamEscudo(championTeam),
      },
      runnerUp: {
        name: runnerUpTeam?.nombre || "Por definir",
        escudo: getTeamEscudo(runnerUpTeam),
      },
      third: {
        name: thirdPlaceWinner?.nombre || "Por definir",
        escudo: getTeamEscudo(thirdPlaceWinner),
      },
      shareUrl,
    };
  }, [buildShareUrl, championTeam, runnerUpTeam, thirdPlaceWinner, viewBracketId]);
  const viewBracketCode = useMemo(() => {
    const raw = viewBracketMeta?.shortCode || viewBracketId || "--";
    return raw.toString().slice(0, 8).toUpperCase();
  }, [viewBracketMeta?.shortCode, viewBracketId]);

  useEffect(() => {
    if (isViewOnly || !currentSaveId || !authSession?.access_token) return;
    if (!championTeam) return;
    const signature = [
      currentSaveId,
      championTeam?.id || "",
      runnerUpTeam?.id || "",
      thirdPlaceWinner?.id || "",
    ].join("|");
    if (shareCardUploadKeyRef.current === signature) return;
    shareCardUploadKeyRef.current = signature;
    const payload: ShareCardPayload = {
      champion: {
        name: championTeam?.nombre || "Por definir",
        escudo: getTeamEscudo(championTeam),
      },
      runnerUp: {
        name: runnerUpTeam?.nombre || "Por definir",
        escudo: getTeamEscudo(runnerUpTeam),
      },
      third: {
        name: thirdPlaceWinner?.nombre || "Por definir",
        escudo: getTeamEscudo(thirdPlaceWinner),
      },
      shareUrl: buildShareUrl(currentSaveId),
    };
    let cancelled = false;
    const run = async () => {
      try {
        const blob = await captureShareCardBlob(payload);
        if (cancelled) return;
        await uploadShareCard(blob, currentSaveId);
      } catch {
        // ignore
      } finally {
        // no-op
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [
    isViewOnly,
    currentSaveId,
    authSession?.access_token,
    championTeam,
    runnerUpTeam,
    thirdPlaceWinner,
    buildShareUrl,
    uploadShareCard,
  ]);

  const applyWinner = (matchId: string, team?: Team) => {
    if (isViewOnly) return;
    if (isLocked) return;
    if (!team) return;
    if (picks[matchId]) return;

    const prereqMap: Record<string, string[]> = {
      "qf-97": ["r16-89", "r16-90"],
      "qf-98": ["r16-91", "r16-92"],
      "qf-99": ["r16-93", "r16-94"],
      "qf-100": ["r16-95", "r16-96"],
      "sf-101": ["qf-97", "qf-98"],
      "sf-102": ["qf-99", "qf-100"],
      "third-103": ["sf-101", "sf-102"],
      "final-104": ["third-103"],
    };

    const openRequirement = (title: string, missingIds: string[]) => {
      const missing = missingIds.map((id) => `Partido ${id.split("-").pop() || id}`);
      setPhaseBlock({ title, missing });
    };

    const prereqs = prereqMap[matchId];
    if (prereqs) {
      const missingIds = prereqs.filter((id) => !picks[id]);
      if (missingIds.length > 0) {
        const title =
          matchId === "final-104"
            ? "Elige el tercer puesto antes del campeón"
            : matchId === "third-103"
              ? "Completa las semifinales para habilitar el tercer puesto"
              : matchId.startsWith("sf-")
                ? "Completa los cuartos de final"
                : matchId.startsWith("qf-")
                  ? "Completa los octavos de final"
                  : "Primero completa los cruces previos";
        openRequirement(title, missingIds);
        return;
      }
    }

    const pickCode = getTeamCode(team) || team.id;
    setPicks((prev) => ({ ...prev, [matchId]: team.id }));
    trackPick("bracket", matchId, pickCode);

    if (matchId === "final-104") {
      setChampionTeam(team);
      setShowChampionModal(true);
      setConfettiKey(Date.now());
      setShareInfo(null);
      setIsLocked(true);
    }
  };

  const handleR32Pick = (matchId: string, team?: Team) => {
    applyWinner(matchId, team);
  };

  const generateUniqueCode = () =>
    `FM-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

  const buildFileNameWithCode = (base: string, code?: string | null) => (code ? `${base}-${code}` : base);

  const captureShareCardBlob = async (payload: ShareCardPayload) => {
    flushSync(() => setActiveShareCard(payload));
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const target = shareCardRef.current || document.getElementById("share-card-capture");
    if (!target) throw new Error("No se encontró la tarjeta para compartir");
    return captureShareCard(target, "#1d1d1b");
  };

  const shareCaptures = async (
    platform: "whatsapp" | "facebook" | "instagram" | "tiktok" | "x",
    champion?: Team,
  ) => {
    let sharePageUrl =
      isViewOnly || !currentSaveId
        ? buildSharePageUrl(viewBracketId || currentSaveId || "", API_BASE_URL || undefined)
        : buildSharePageUrl(currentSaveId, API_BASE_URL || undefined);
    let viewUrl = buildShareUrl(isViewOnly ? viewBracketId : currentSaveId);

    if (!isViewOnly && !currentSaveId) {
      if (authSession?.access_token) {
        setShareInfo("Guarda tu pronóstico para poder compartirlo.");
        void handleSaveClick();
        return;
      }
      const payload = buildSavePayload();
      const fallbackName = saveName.trim() || guestSaveMetaRef.current?.name || "Mi bracket";
      try {
        const guestShare = await createGuestShare({
          apiBaseUrl: API_BASE_URL || undefined,
          name: fallbackName,
          data: payload,
        });
        if (!guestShare?.id) {
          setShareInfo("No pudimos crear el enlace de invitado. Intenta de nuevo.");
          return;
        }
        const shortCode = guestShare.shortCode ? guestShare.shortCode.toUpperCase() : "";
        const stored = persistGuestSave(payload, fallbackName, {
          shortCode,
          shareId: guestShare.id,
          shareUrl: guestShare.sharePageUrl,
        });
        guestSaveMetaRef.current = {
          name: stored?.name || fallbackName,
          updatedAt: stored?.updatedAt || new Date().toISOString(),
          shortCode,
        };
        setGuestShortCode(shortCode || null);
        sharePageUrl = guestShare.sharePageUrl || buildSharePageUrl(guestShare.id, API_BASE_URL || undefined);
        viewUrl = sharePageUrl || viewUrl;
      } catch (err) {
        setShareInfo(err instanceof Error ? err.message : "No pudimos crear el enlace de invitado.");
        return;
      }
    }
    const championPick = champion || championTeam;
    const payload: ShareCardPayload = {
      champion: {
        name: championPick?.nombre || "Por definir",
        escudo: getTeamEscudo(championPick),
      },
      runnerUp: {
        name: runnerUpTeam?.nombre || "Por definir",
        escudo: getTeamEscudo(runnerUpTeam),
      },
      third: {
        name: thirdPlaceWinner?.nombre || "Por definir",
        escudo: getTeamEscudo(thirdPlaceWinner),
      },
      shareUrl: sharePageUrl || viewUrl,
    };
    const messageParts = [
      `Mi pronóstico Mundialista: campeón ${payload.champion.name}.`,
      payload.runnerUp.name !== "Por definir" ? `Segundo: ${payload.runnerUp.name}.` : "",
      payload.third.name !== "Por definir" ? `Tercero: ${payload.third.name}.` : "",
      `Mira mi cuadro aquí: ${sharePageUrl || payload.shareUrl}`,
    ].filter(Boolean);
    const baseMessage = messageParts.join(" ");
    const shareTitle = "Mi pronóstico Mundialista";
    const shareTarget = sharePageUrl || payload.shareUrl;
    const openShareTarget = (url: string) => {
      const next = window.open(url, "_blank", "noopener,noreferrer");
      if (!next) {
        setShareInfo("Permite ventanas emergentes para abrir el enlace de compartir.");
      }
    };

    if (typeof window !== "undefined") {
      if (platform === "whatsapp") {
        openShareTarget(`https://wa.me/?text=${encodeURIComponent(baseMessage)}`);
      } else if (platform === "facebook") {
        const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
          shareTarget,
        )}&quote=${encodeURIComponent(baseMessage)}`;
        openShareTarget(fbUrl);
      } else if (platform === "x") {
        openShareTarget(`https://twitter.com/intent/tweet?text=${encodeURIComponent(baseMessage)}`);
      } else if (platform === "instagram" || platform === "tiktok") {
        navigator.clipboard?.writeText(baseMessage).catch(() => null);
        openShareTarget(platform === "instagram" ? "https://www.instagram.com/" : "https://www.tiktok.com/");
      }
    }

    try {
      const blob = await captureShareCardBlob(payload);
      let finalSharePageUrl = shareTarget;
      if (!isViewOnly && currentSaveId) {
        try {
          const uploaded = await uploadShareCard(blob, currentSaveId);
          if (uploaded?.sharePageUrl) finalSharePageUrl = uploaded.sharePageUrl;
        } catch {
          // ignore upload failures and continue with local URL
        }
      }
      const finalMessage = baseMessage.replace(shareTarget, finalSharePageUrl || shareTarget);
      const code = generateUniqueCode();
      const fileName = buildFileNameWithCode("Fanatico-Mundialista-Pronostico", code);
      const file = new File([blob], `${fileName}.png`, { type: "image/png" });
      const canShareFile = !!(navigator.canShare && navigator.canShare({ files: [file] }));
      if (canShareFile && navigator.share) {
        await navigator.share({ files: [file], title: shareTitle, text: finalMessage, url: finalSharePageUrl });
        return;
      }

      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `${fileName}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
    } catch (err) {
      setShareInfo("No pudimos preparar la captura para compartir. Intenta de nuevo o haz captura manual.");
      // eslint-disable-next-line no-console
      console.error(err);
    } finally {
      setActiveShareCard(null);
    }
  };

  const downloadBracketImage = async () => {
    const shareUrl = buildShareUrl(isViewOnly ? viewBracketId : currentSaveId);
    const payload: ShareCardPayload = {
      champion: {
        name: championTeam?.nombre || "Por definir",
        escudo: getTeamEscudo(championTeam),
      },
      runnerUp: {
        name: runnerUpTeam?.nombre || "Por definir",
        escudo: getTeamEscudo(runnerUpTeam),
      },
      third: {
        name: thirdPlaceWinner?.nombre || "Por definir",
        escudo: getTeamEscudo(thirdPlaceWinner),
      },
      shareUrl,
    };
    try {
      const blob = await captureShareCardBlob(payload);
      const code = generateUniqueCode();
      const fileName = buildFileNameWithCode("Fanatico-Mundialista-Pronostico", code);
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `${fileName}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
    } catch (err) {
      setShareInfo("No pudimos generar la imagen para descargar. Intenta de nuevo.");
      // eslint-disable-next-line no-console
      console.error(err);
    } finally {
      setActiveShareCard(null);
    }
  };

  const authSlot = isViewOnly ? null : authUser ? (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-300 hidden md:inline">{authUser.email}</span>
      <button
        type="button"
        onClick={() => navigateTo("backend")}
        className="px-2 py-1 rounded-md border border-neutral-700 text-[11px] font-semibold text-gray-200 hover:border-[#c6f600] whitespace-nowrap"
      >
        Panel usuario
      </button>
      <button
        type="button"
        onClick={handleSignOut}
        className="px-2 py-1 rounded-md border border-neutral-700 text-[11px] font-semibold text-gray-200 hover:border-[#c6f600] whitespace-nowrap"
      >
        Cerrar sesion
      </button>
    </div>
  ) : (
    <button
      type="button"
      onClick={() => openAuthModal("login")}
      className="px-2 py-1 rounded-md border border-neutral-700 text-[11px] font-semibold text-gray-200 hover:border-[#c6f600] whitespace-nowrap"
    >
      Iniciar sesión / Crear usuario
    </button>
  );

  const authSlotMobile = isViewOnly ? null : authUser ? (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => navigateTo("backend")}
        className="px-3 py-2 rounded-md border border-neutral-700 text-xs font-semibold text-gray-200 hover:border-[#c6f600]"
      >
        Panel
      </button>
      <button
        type="button"
        onClick={handleSignOut}
        className="px-3 py-2 rounded-md border border-neutral-700 text-xs font-semibold text-gray-200 hover:border-[#c6f600]"
      >
        Cerrar sesión
      </button>
    </div>
  ) : (
    <button
      type="button"
      onClick={() => openAuthModal("login")}
      className="px-3 py-2 rounded-md border border-neutral-700 text-xs font-semibold text-gray-200 hover:border-[#c6f600]"
    >
      Iniciar sesión
    </button>
  );

  const shareButtons = [
    { key: "whatsapp", icon: whatsappIcon, alt: "WhatsApp", platform: "whatsapp" as const },
    { key: "facebook", icon: facebookIcon, alt: "Facebook", platform: "facebook" as const },
    { key: "x", icon: xIcon, alt: "X", platform: "x" as const },
    { key: "instagram", icon: instagramIcon, alt: "Instagram", platform: "instagram" as const },
  ];

  const renderShareRow = (targetChampion?: Team, disabled?: boolean, includeDownload = true, includeSave = true) => {
    if (isViewOnly) return null;
    return (
      <div className="flex items-center justify-center gap-2">
        {shareButtons.map((btn) => (
          <button
            key={btn.key}
            type="button"
            onClick={() => shareCaptures(btn.platform, targetChampion)}
            disabled={disabled}
            className={`p-2 rounded-md  ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
            aria-label={`Compartir en ${btn.alt}`}
          >
            <img src={btn.icon} alt={btn.alt} className="w-5 h-5" />
          </button>
        ))}
        {includeDownload && (
          <button
            type="button"
            onClick={downloadBracketImage}
            disabled={disabled}
            className={`px-3 py-2 rounded-md border border-neutral-700 bg-neutral-900 text-xs font-semibold hover:border-[#c6f600] transition ${
              disabled ? "opacity-60 cursor-not-allowed" : ""
            }`}
          >
            Descargar
          </button>
        )}
        {includeSave && (
          <button
            type="button"
            onClick={handleSaveClick}
            className="px-3 py-2 rounded-md border border-[#c6f600] text-[#c6f600] text-xs font-semibold transition hover:brightness-95"
          >
            Agregar juego
          </button>
        )}
        {includeSave && finalComplete && (
          <button
            type="button"
            onClick={handleNewGame}
            className="px-3 py-2 rounded-md border border-neutral-700 text-gray-200 text-xs font-semibold transition hover:border-[#c6f600] hover:text-white"
          >
            Nuevo juego
          </button>
        )}
      </div>
    );
  };

  const missingThirdGroups = useMemo(
    () => GROUP_LETTERS.filter((g) => !selections[g]?.tercero),
    [selections],
  );

  const r32Complete = useMemo(
    () => r32.length > 0 && r32.every((m) => !!picks[m.id]),
    [r32, picks],
  );
  const r32CompleteRef = useRef(r32Complete);
  useEffect(() => {
    r32CompleteRef.current = r32Complete;
  }, [r32Complete]);
  const r32Left = useMemo(() => r32.slice(0, 8), [r32]);
  const r32Right = useMemo(() => r32.slice(8), [r32]);
  const r16Left = useMemo(() => r16.slice(0, 4), [r16]);
  const r16Right = useMemo(() => r16.slice(4), [r16]);
  const r32LeftComplete = useMemo(
    () => r32Left.length > 0 && r32Left.every((m) => !!picks[m.id]),
    [r32Left, picks],
  );
  const r32RightComplete = useMemo(
    () => r32Right.length > 0 && r32Right.every((m) => !!picks[m.id]),
    [r32Right, picks],
  );
  const finalComplete = useMemo(
    () => final.length > 0 && final.every((m) => !!picks[m.id]),
    [final, picks],
  );
  const menuSteps = useMemo(
    () => [
      { id: "repechajes", completed: repechajesLocked },
      { id: "grupos", completed: groupCompletion.complete },
      { id: "dieciseisavos", completed: r32Complete },
      { id: "llaves", completed: finalComplete },
    ],
    [repechajesLocked, groupCompletion.complete, r32Complete, finalComplete],
  );
  const menuCompletedCount = useMemo(
    () => menuSteps.filter((step) => step.completed).length,
    [menuSteps],
  );
  const menuProgress = useMemo(
    () => (menuSteps.length ? Math.round((menuCompletedCount / menuSteps.length) * 100) : 0),
    [menuCompletedCount, menuSteps.length],
  );

  const autoSwitchLlavesRef = useRef(false);
    useEffect(() => {
      if (showNewGamePrompt) {
        setActiveTab("repechajes");
        return;
      }
      if (isViewOnly) return;
      if (!thirdsComplete) {
        autoSwitchLlavesRef.current = false;
        return;
      }
    if (activeTab === "dieciseisavos") {
      autoSwitchLlavesRef.current = true;
      return;
    }
    if (!autoSwitchLlavesRef.current) {
      setActiveTab("dieciseisavos");
      autoSwitchLlavesRef.current = true;
    }
    }, [thirdsComplete, activeTab, showNewGamePrompt, isViewOnly]);

  useEffect(() => {
    if (activeTab === "dieciseisavos") {
      setActiveR32Tab("llave1");
    }
  }, [activeTab]);

  const prevR32LeftCompleteRef = useRef(r32LeftComplete);
  useEffect(() => {
    const prev = prevR32LeftCompleteRef.current;
    if (
      activeTab === "dieciseisavos" &&
      activeR32Tab === "llave1" &&
      !prev &&
      r32LeftComplete
    ) {
      setActiveR32Tab("llave2");
    }
    prevR32LeftCompleteRef.current = r32LeftComplete;
  }, [activeTab, activeR32Tab, r32LeftComplete]);

  const prevR32CompleteRef = useRef(r32Complete);
  useEffect(() => {
    if (showNewGamePrompt || isViewOnly || suspendAutoAdvanceRef.current) {
      prevR32CompleteRef.current = r32Complete;
      return;
    }
    const prev = prevR32CompleteRef.current;
    if (
      activeTab === "dieciseisavos" &&
      activeR32Tab === "llave2" &&
      !prev &&
      r32Complete
    ) {
      goToLlavesIfReady();
    }
    prevR32CompleteRef.current = r32Complete;
  }, [activeTab, activeR32Tab, r32Complete, goToLlavesIfReady, showNewGamePrompt, isViewOnly]);

  const clearBracketNavTarget = useCallback(() => setBracketNavTarget(null), []);

  const buildR32Cards = useCallback(
    (list: Match[], nextList: Match[], mirror: boolean) => {
      const items: JSX.Element[] = [];
      for (let i = 0; i < list.length; i += 2) {
        const first = list[i];
        const second = list[i + 1];
        const preview = nextList[i / 2];
        const rowKey = `row-${first?.id || second?.id || i}`;

        const getSchedule = (match?: Match) => {
          if (!match) return undefined;
          const schedKey = normalizeMatchKey(match.label) || normalizeMatchKey(match.id);
          return scheduleByMatch[schedKey];
        };

        items.push(
            <DieciseisavosKeyBlock
              key={rowKey}
              semiMatches={[
                { match: first, schedule: getSchedule(first) },
                { match: second, schedule: getSchedule(second) },
              ]}
              finalMatch={preview}
              finalSchedule={getSchedule(preview)}
              onPick={handleR32Pick}
              onBlockedPick={() => setShowR32Warning(true)}
              locked={isLocked}
              mirror={mirror}
              seedLabel={getSeedLabelR32}
            />,
        );
      }
      return items;
    },
    [applyWinner, isLocked, scheduleByMatch],
  );

  useEffect(() => {
    const matches = [...r32, ...r16, ...qf, ...sf, ...final, ...thirdPlace];
    const matchIds = matches.map((m) => m.id);
    setPicks((prev) => {
      const next = { ...prev };
      let changed = false;
      Object.keys(prev).forEach((id) => {
        if (!matchIds.includes(id)) {
          delete next[id];
          changed = true;
        }
      });
      matches.forEach((m) => {
        const picked = next[m.id];
        if (!picked) return;
        const validIds = [m.equipoA?.id, m.equipoB?.id].filter(Boolean) as string[];
        if (!validIds.includes(picked)) {
          delete next[m.id];
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [r32, r16, qf, sf, final, thirdPlace]);

    useEffect(() => {
      if (showNewGamePrompt || isViewOnly) {
        setShowThirdsModal(false);
        return;
      }
      if (missingThirdGroups.length === 0 && bestThirdIds.length < MAX_THIRD) {
        setShowThirdsModal(true);
      }
      if (bestThirdIds.length === MAX_THIRD) {
        setShowThirdsModal(false);
      }
    }, [missingThirdGroups.length, bestThirdIds.length, showNewGamePrompt, isViewOnly]);

  useEffect(() => {
    const finalPick = picks["final-104"];
    const finalMatch = final[0];
    const valid =
      !!finalPick &&
      !!finalMatch &&
      (finalMatch.equipoA?.id === finalPick || finalMatch.equipoB?.id === finalPick);
      if (!valid) {
        if (championTeam) setChampionTeam(undefined);
        if (showChampionModal) setShowChampionModal(false);
        if (isLocked && !isViewOnly) setIsLocked(false);
        return;
      }
      const nextChampion =
        finalMatch?.equipoA?.id === finalPick ? finalMatch.equipoA : finalMatch?.equipoB;
      if (nextChampion && championTeam?.id !== nextChampion.id) {
        setChampionTeam(nextChampion);
      }
    }, [picks, final, championTeam, showChampionModal, isLocked, isViewOnly]);

    const anyModalOpen =
      showThirdsModal ||
      !!showFixturesGroup ||
      showRulesModal ||
      !!phaseBlock ||
      showIntercontinentalModal ||
      showAuthModal ||
      showSaveModal ||
      showChampionModal ||
      showNewGamePrompt ||
      showR32Warning;
    useBodyScrollLock(anyModalOpen);

  useEffect(() => {
    const anyModalOpen =
      showThirdsModal ||
      !!showFixturesGroup ||
      showRulesModal ||
      showR32Warning ||
      !!phaseBlock ||
      showIntercontinentalModal ||
      showAuthModal ||
      showSaveModal ||
      showChampionModal ||
      showNewGamePrompt;
    if (!anyModalOpen) return;
    const handler = () => {
      setShowThirdsModal(false);
      setShowFixturesGroup(undefined);
      setShowRulesModal(false);
      setShowR32Warning(false);
      setShowChampionModal(false);
      setShowNewGamePrompt(false);
      closeAuthModal();
      closeSaveModal();
      setPhaseBlock(null);
      if (showIntercontinentalModal) {
        setShowIntercontinentalModal(false);
        goToGroupsIfReady();
      }
    };
    window.history.pushState({ modal: true }, "");
    window.addEventListener("popstate", handler);
    return () => {
      window.removeEventListener("popstate", handler);
    };
  }, [
    showThirdsModal,
    showFixturesGroup,
    showRulesModal,
    showR32Warning,
    phaseBlock,
    showIntercontinentalModal,
    showAuthModal,
    showSaveModal,
    showChampionModal,
    showNewGamePrompt,
    goToGroupsIfReady,
  ]);

  useEffect(() => {
    if (!showChampionModal || !championTeam) return;
    return;
  }, [showChampionModal, championTeam]);

  const RulesModal = ({
    open,
    onClose,
  }: {
    open: boolean;
    onClose: () => void;
  }) => {
    if (!open) return null;
    const overlayRef = useRef<HTMLDivElement>(null);
    return (
      <div
        ref={overlayRef}
        onClick={(e) => {
          if (e.target === overlayRef.current) onClose();
        }}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-10 flex items-start md:items-center justify-center px-4 py-6 overflow-y-auto"
      >
      <ModalFlipFrame className="bg-neutral-900 border border-neutral-700 rounded-lg w-full md:w-2/3 max-w-2xl shadow-lg flex flex-col overflow-hidden modal-glow">
        <div className="w-full overflow-hidden border-b border-neutral-700" style={{ aspectRatio: "16 / 9" }}>
          <img src={rulesBanner} alt="Reglas" className="w-full h-full object-cover" />
        </div>
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-3xl font-black  text-[#c6f600]">¿Cómo jugar?</h3>
            <button onClick={onClose} className="text-sm text-gray-900 bg-[#c6f600] hover:text-black rounded-full w-6 h-6 flex items-center justify-center">X</button>
          </div>
          <ul className="text-base text-gray-200 space-y-4 text-balance gap-5">
            <li className="flex items-start gap-4">
                <span className="flex-shrink-0 font-black text-[#c6f600] rounded-full px-3 py-1 bg-black">
                  1.
                </span>

                <div>  Empieza con los{" "}
                  <span className="text-[#c6f600] font-semibold"> Repechajes </span>{" "}
                  y elige ganadores en Intercontinental y UEFA.
                </div>
           </li>
            <li className="flex items-start gap-4">
              <span className="flex-shrink-0 font-black text-[#c6f600] rounded-full px-3 py-1 bg-black">2.</span>{" "}
             <div>  Selecciona a los lí­deres de la fase de grupos: elige al <span className="text-[#c6f600] font-semibold">1º, 2º y 3º puesto de cada grupo</span> de la A a la L.</div>
           
            </li>
            <li className="flex items-start gap-4">
              <span className="flex-shrink-0 font-black text-[#c6f600] rounded-full px-3 py-1 bg-black">3.</span>{" "}
             <div>  Luego elige los <span className="text-[#c6f600] font-semibold">8 mejores terceros</span> para habilitar las eliminatorias.</div>
            </li>
            <li className="flex items-start gap-4">
              <span className="flex-shrink-0 font-black text-[#c6f600] rounded-full px-3 py-1 bg-black">4.</span>{" "}
              <div>Completa los <span className="text-[#c6f600] font-semibold">dieciseisavos de final</span> y avanza las ultimas rondas.</div>
            </li>
             <li className="flex items-start gap-4">
              <span className="flex-shrink-0 font-black text-[#c6f600] rounded-full px-3 py-1 bg-black">5.</span>{" "}
              <div>Elige al tercer puesto y  tu campéon mundial de fútbol 2026.</div>
            </li>
          </ul>
          <div className="mt-4 flex flex-col items-center gap-2">
            <button
              onClick={onClose}
              className="px-18 py-2 rounded-md bg-[#c6f600] text-black font-semibold hover:brightness-95"
            >
              ACEPTAR
            </button>
            {!authUser && (
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => openAuthModal("signup")}
                  className="text-sm font-semibold text-gray-300 hover:text-[#c6f600] transition"
                >
                  Registrarse
                </button>
                /
                <button
                  type="button"
                  onClick={() => openAuthModal("login")}
                  className="text-sm font-semibold text-gray-300 hover:text-[#c6f600] transition"
                >
                  Iniciar sesión
                </button>
              </div>
            )}
          </div>
        </div>
      </ModalFlipFrame>
      </div>
    );
  };

  const PhaseBlockModal = ({
    open,
    title,
    missing,
    onClose,
  }: {
    open: boolean;
    title: string;
    missing: string[];
    onClose: () => void;
  }) => {
    if (!open) return null;
    const overlayRef = useRef<HTMLDivElement>(null);
    return (
      <div
        ref={overlayRef}
        onClick={(e) => {
          if (e.target === overlayRef.current) onClose();
        }}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-start md:items-center justify-center px-4 py-6 overflow-y-auto"
      >
      <ModalFlipFrame className="bg-neutral-900 border border-neutral-700 rounded-lg w-full md:w-1/2 max-w-xl shadow-lg flex flex-col overflow-hidden modal-glow">
        <div className="w-full overflow-hidden border-b border-neutral-700" style={{ aspectRatio: "16 / 9" }}>
          <img src={phaseBlockBannerPick} alt="Bloqueo de fase" className="w-full h-full object-cover" />
        </div>
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-3xl text-balance uppercase font-black leading-none font-black text-[#c6f600]">{title}</h3>
            <button onClick={onClose} className="text-sm text-gray-900 bg-[#c6f600] hover:text-black rounded-full w-6 h-6 flex items-center justify-center">
              X
            </button>
          </div>
          <p className="text-sm text-gray-300 mb-2">Te faltan estos partidos:</p>
          <ul className="list-disc list-inside text-lg text-gray-200 space-y-1">
            {missing.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
          <div className="mt-4 text-center">
            <button
              onClick={onClose}
              className="px-18 py-2 rounded-md bg-[#c6f600] text-black font-semibold hover:brightness-95"
            >
              ACEPTAR
            </button>
          </div>
        </div>
      </ModalFlipFrame>
      </div>
    );
  };

  const R32InfoModal = ({
    open,
    title,
    message,
    onClose,
  }: {
    open: boolean;
    title: string;
    message: string;
    onClose: () => void;
  }) => {
    if (!open) return null;
    const overlayRef = useRef<HTMLDivElement>(null);
    return (
      <div
        ref={overlayRef}
        onClick={(e) => {
          if (e.target === overlayRef.current) onClose();
        }}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-start md:items-center justify-center px-4 py-6 overflow-y-auto"
      >
        <ModalFlipFrame className="bg-neutral-900 border border-neutral-700 rounded-lg w-full md:w-1/2 max-w-xl shadow-lg flex flex-col overflow-hidden modal-glow">
          <div className="w-full overflow-hidden border-b border-neutral-700" style={{ aspectRatio: "16 / 9" }}>
            <img src={r32BannerPick} alt="Aviso" className="w-full h-full object-cover" />
          </div>
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-3xl text-balance uppercase font-black leading-none font-black text-[#c6f600]">
                {title}
              </h3>
              <button
                onClick={onClose}
                className="text-sm text-gray-900 bg-[#c6f600] hover:text-black rounded-full w-6 h-6 flex items-center justify-center"
              >
                X
              </button>
            </div>
            <p className="text-sm text-gray-300">{message}</p>
            <div className="mt-4 text-center">
              <button
                onClick={onClose}
                className="px-18 py-2 rounded-md bg-[#c6f600] text-center text-black font-semibold hover:brightness-95"
              >
                ACEPTAR
              </button>
            </div>
          </div>
        </ModalFlipFrame>
      </div>
    );
  };

  const NewGamePromptModal = ({
    open,
    onConfirm,
    onCancel,
  }: {
    open: boolean;
    onConfirm: () => void;
    onCancel: () => void;
  }) => {
    if (!open) return null;
    const overlayRef = useRef<HTMLDivElement>(null);
    return (
      <div
        ref={overlayRef}
        onClick={(e) => {
          if (e.target === overlayRef.current) onCancel();
        }}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-start md:items-center justify-center px-4 py-6 overflow-y-auto"
      >
        <ModalFlipFrame className="bg-neutral-900 border border-neutral-700 rounded-lg w-full md:w-1/2  max-w-lg shadow-lg flex flex-col overflow-hidden modal-glow">
          <div className="p-4 flex flex-col gap-3  h-64 justify-end">
            <h3 className="text-lg font-semibold text-[#c6f600]">¿Deseas jugar otra partida?</h3>
            <p className="text-sm text-gray-300">
              Detectamos un bracket con avances. Si inicias una nueva partida, se reiniciará tu
              pronóstico actual.
            </p>
            <div className="flex items-center justify-end gap-2 mt-2">
              <button
                type="button"
                onClick={onCancel}
                className="px-3 py-2 rounded-md border border-neutral-700 text-sm font-semibold text-gray-200 hover:border-[#c6f600]"
              >
                Continuar
              </button>
              <button
                type="button"
                onClick={onConfirm}
                className="px-3 py-2 rounded-md bg-[#c6f600] text-black text-sm font-semibold hover:brightness-95"
              >
                Nuevo juego
              </button>
            </div>
          </div>
        </ModalFlipFrame>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-900 text-white flex items-center justify-center">
        Cargando selecciones...
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-neutral-900 text-white flex flex-col items-center justify-center gap-3">
        <p>Error al cargar selecciones</p>
        <p className="text-sm text-gray-400">{error}</p>
        <button
          onClick={goHome}
          className="px-4 py-2 rounded-md bg-[#c6f600] text-black font-semibold"
        >
          Volver
        </button>
      </div>
    );
  }

  return (
     <div className=" bg-neutral-900">
    <div className=" max-w-7xl mx-auto bg-neutral-900 text-white p-2 md:px-36 flex flex-col gap-8 bracket-stable">
      {!isEmbedded && <Header authSlot={authSlot} showNav={false} showSearch={false} />}
      <main className="max-w-7xl px-2 sm:px-6 lg:px-10 xl:px-16">
          <div className="max-w-7xl mx-auto">
            {showSharedHeader && (
              <div className="mb-6 flex flex-col lg:flex-row gap-4 items-stretch">
                <div className="flex-1 rounded-2xl border border-neutral-800 bg-black/40 overflow-hidden">
                  <div
                    className="relative h-40"
                    style={
                      viewSharedBy?.coverUrl
                        ? {
                            backgroundImage: `url(${viewSharedBy.coverUrl})`,
                            backgroundSize: "cover",
                            backgroundPosition: "center",
                          }
                        : {
                            background:
                              "linear-gradient(135deg, rgba(8,8,8,1) 0%, rgba(17,24,39,1) 45%, rgba(31,42,18,1) 100%)",
                          }
                    }
                  >
                    <div className="absolute -left-16 -bottom-16 w-40 h-40 rounded-full bg-[#c6f600]/20 blur-3xl" />
                    <div className="absolute right-0 top-0 w-32 h-32 rounded-full bg-white/10 blur-3xl" />
                  </div>
                  <div className="relative px-4 pb-4">
                    <div className="flex items-center gap-4 -mt-10">
                      <div className="relative w-20 h-20 rounded-full overflow-hidden border-4 border-neutral-900 bg-neutral-800 shrink-0">
                        {viewSharedBy?.avatarUrl ? (
                          <img
                            src={viewSharedBy.avatarUrl}
                            alt={viewSharedBy.alias || viewSharedBy.name || "Usuario"}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="w-full h-full flex items-center justify-center text-2xl font-bold text-[#c6f600]">
                            {(viewSharedBy?.alias || viewSharedBy?.name || "U").trim().charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs uppercase tracking-wider text-gray-400">
                          Pronóstico compartido por
                        </span>
                        <span className="text-2xl md:text-3xl font-black text-white">
                          {viewSharedBy?.alias || viewSharedBy?.name || "Usuario"}
                        </span>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-col gap-1">
                      <span className="text-sm text-gray-300">
                        Código: <span className="font-semibold text-[#c6f600]">{viewBracketCode}</span>
                      </span>
                      {viewBracketMeta?.updatedAt && (
                        <span className="text-xs text-gray-500">
                          Actualizado: {formatViewDate(viewBracketMeta.updatedAt)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="w-full lg:w-auto flex justify-center">
                  <ShareCard
                    coverUrl={championBanner}
                    champion={viewSharePayload.champion}
                    runnerUp={viewSharePayload.runnerUp}
                    third={viewSharePayload.third}
                    shareUrl={viewSharePayload.shareUrl}
                  />
                </div>
              </div>
            )}
            <div className={isViewOnly ? " select-none" : ""}>
            {!isViewOnly && (
              <>
                <div className="md:hidden flex justify-end mb-3">{authSlotMobile}</div>
                <div className="hidden md:flex justify-end mb-3">{authSlot}</div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between text-[11px] text-gray-400 mb-1">
                      <span className="font-semibold text-gray-200">Progreso</span>
                      <span>
                        {menuCompletedCount}/{menuSteps.length}
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-neutral-800 overflow-hidden">
                      <div
                        className="h-full bg-[#c6f600] transition-all duration-300"
                        style={{ width: `${menuProgress}%` }}
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

          {!isEmbedded && (
            <div className="flex flex-wrap items-center mb-2">
            <button
              type="button"
              onClick={() => setActiveTab("repechajes")}
              className={`px-4 py-2 rounded-md border text-sm font-semibold transition ${
                activeTab === "repechajes"
                  ? "bg-[#c6f600] text-black "
                  : "border-neutral-700 text-gray-400 hover:text-white"
              }`}
            >
              Liguilla de Repechajes
            </button>
            <button
              type="button"
              onClick={() => (isViewOnly ? setActiveTab("grupos") : goToGroupsIfReady())}
              className={`px-4 py-2 rounded-md border text-sm font-semibold transition ${
                activeTab === "grupos"
                  ? "bg-[#c6f600] text-black border-[#c6f600]"
                  : "border-neutral-700 text-gray-400 hover:text-white"
              }`}
            >
              Fase de grupos
            </button>
              <button
                type="button"
                onClick={() => {
                  if (isViewOnly) {
                    setActiveTab("dieciseisavos");
                    return;
                  }
                  if (activeTab === "llaves") {
                    setActiveTab("dieciseisavos");
                    return;
                  }
                  goToDieciseisavosIfReady();
                }}
                className={`px-4 py-2 rounded-md border text-sm font-semibold transition ${
                  activeTab === "dieciseisavos"
                    ? "bg-[#c6f600] text-black border-[#c6f600]"
                    : "border-neutral-700 text-gray-400 hover:text-white"
                }`}
            >
              Eliminatorias
            </button>
              <button
                type="button"
                onClick={() => (isViewOnly ? setActiveTab("llaves") : goToLlavesIfReady())}
                className={`px-4 py-2 rounded-md border text-sm font-semibold transition ${
                  activeTab === "llaves"
                    ? "bg-[#c6f600] text-black border-[#c6f600]"
                    : "border-neutral-700 text-gray-400 hover:text-white"
                }`}
              >
                Llaves finales
              </button>
            </div>
          )}

            {!isViewOnly && saveNotice && (
              <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-[#c6f600]/40 bg-black/60 px-3 py-2 text-sm text-gray-200">
                <span>{saveNotice}</span>
                <div className="flex items-center gap-2">
                  {currentSaveId && (
                    <button
                      type="button"
                      onClick={handleNewGame}
                      className="px-2 py-1 rounded-md border border-neutral-700 text-xs font-semibold text-gray-200 transition hover:border-[#c6f600] hover:text-white"
                    >
                      Reiniciar juego
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setSaveNotice(null)}
                    className="text-xs text-gray-400 hover:text-white"
                  >
                    X
                  </button>
                </div>
              </div>
            )}

          <AnimatePresence mode="wait">
            {activeTab === "repechajes" ? (
              <motion.div
                key="repechajes"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="flex flex-col gap-6"
              >
                {!isViewOnly && (
                  <div className="bracket-panel modal-glow  p-6 flex flex-col items-center text-center gap-3 rounded-lg ">
                    <h1 className="text-4xl font-bold">Repechajes Mundialistas</h1>
                    <p className="text-xl text-gray-400 leading-none mt-3 text-balance">
                      Define a los clasificados del repechaje (Intercontinental y UEFA). Solo uno para cada Grupo.
                    </p>
                    <p className="text-base  leading-none mt-1 text-[#c6f600] font-bold text-balance">
                      NOTA: No olvides seleccionar a los ganadores de cada final para continuar.
                    </p>
                  </div>
                )}

              {isEmbedded ? (
                <div
                  id="repechaje-winners-all"
                  className="bg-neutral-900 rounded-lg p-3 flex flex-col gap-2 modal-glow"
                >
                  <p className="text-3xl font-semibold text-[#c6f600] text-center py-4">Tus clasificados</p>
                  <div className="grid gap-2 sm:grid-cols-2 text-sm text-gray-200 items-center justify-center">
                    <RepechajeWinnerBadge label="Clasificado al Grupo A" team={winnerA} />
                    <RepechajeWinnerBadge label="Clasificado al Grupo B" team={winnerB} />
                    <RepechajeWinnerBadge label="Clasificado al Grupo D" team={winnerD} />
                    <RepechajeWinnerBadge label="Clasificado al Grupo F" team={winnerF} />
                    <RepechajeWinnerBadge label="Clasificado al Grupo I" team={winnerI} />
                    <RepechajeWinnerBadge label="Clasificado al Grupo K" team={winnerK} />
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex  items-center gap-2 justify-center w-full">
                    <button
                      type="button"
                      onClick={() => handlePlayoffTabClick("uefa")}
                      className={`px-5 py-3 rounded-full border text-base  md:text-lg font-bold tracking-wide w-1/2 transition ${
                        activePlayoffTab === "uefa"
                          ? "bg-[#c6f600] text-black  "
                          : "border-neutral-700 text-gray-200 bg-neutral-900/70 hover:text-white hover:border-[#c6f600]"
                      }`}
                    >
                      Liguilla UEFA
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePlayoffTabClick("intercontinental")}
                      className={` py-2 rounded-full  text-base  md:text-lg font-bold tracking-wide w-1/2 transition ${
                        activePlayoffTab === "intercontinental"
                          ? "bg-[#c6f600] text-black border-[#c6f600] shadow-[0_0_16px_rgba(198,246,0,0.35)]"
                          : "border-neutral-700 text-gray-200 bg-neutral-900/70 hover:text-white hover:border-[#c6f600]"
                      }`}
                    >
                      Liguilla Intercontinental
                    </button>
                  </div>
                  <AnimatePresence>
                    {!isViewOnly && autoSwitchNotice && (
                      <motion.div
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.35 }}
                        className="text-xl text-[#c6f600] text-center font-semibold"
                      >
                        UEFA completado. Continuemos con Intercontinental.
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activePlayoffTab}
                      initial={{ opacity: 0, y: 24 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -12 }}
                      transition={{ duration: 0.3, ease: "easeOut" }}
                      className="flex flex-col gap-4"
                    >
                      {activePlayoffTab === "intercontinental" ? (
                        <>
                          <div className="grid gap-4 md:grid-cols-2">
                            {intercontinentalBlocks.map((block) => (
                          <PlayoffKeyBlock
                            key={block.id}
                            title={block.title}
                            subtitle={block.subtitle}
                            mapGroup={block.mapGroup}
                            matches={block.matches}
                            onPick={handleIntercontinentalPick}
                            disabled={repechajesLocked}
                            showFinalHint={showRepechajeFinalHint}
                          />
                            ))}
                          </div>

                          <div
                            id="repechaje-winners-intercontinental"
                            className="bg-neutral-900  rounded-lg p-3 flex flex-col gap-2 modal-glow"
                          >
                            <p className="text-3xl font-semibold text-center text-[#c6f600]  py-4">
                              Tus clasificados Intercontinental
                            </p>
                            <div className="grid gap-2 sm:grid-cols-2 text-sm text-gray-200 items-center justify-center">
                              <RepechajeWinnerBadge label="Clasificado al Grupo I" team={winnerI} />
                              <RepechajeWinnerBadge label="Clasificado al Grupo K" team={winnerK} />
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="grid gap-4 md:grid-cols-2">
                            {uefaBlocks.map((block) => (
                          <PlayoffKeyBlock
                            key={block.id}
                            title={block.title}
                            subtitle={block.subtitle}
                            mapGroup={block.mapGroup}
                            matches={block.matches}
                            onPick={handleUefaPick}
                            disabled={repechajesLocked}
                            showFinalHint={showRepechajeFinalHint}
                          />
                            ))}
                          </div>

                          <div
                            id="repechaje-winners-uefa"
                            className="bg-neutral-900  rounded-lg p-3 flex flex-col gap-2 modal-glow "
                          >
                            <p className="text-3xl font-semibold text-[#c6f600] text-center py-4">
                              Tus clasificados UEFA
                            </p>
                            <div className="grid gap-2 sm:grid-cols-2 text-sm text-gray-200 items-center justify-center">
                              <RepechajeWinnerBadge label="Clasificado al Grupo A" team={winnerA} />
                              <RepechajeWinnerBadge label="Clasificado al Grupo B" team={winnerB} />
                              <RepechajeWinnerBadge label="Clasificado al Grupo D" team={winnerD} />
                              <RepechajeWinnerBadge label="Clasificado al Grupo F" team={winnerF} />
                            </div>
                          </div>
                        </>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </>
              )}
            </motion.div>
          ) : activeTab === "grupos" ? (
            <motion.div
              key="grupos"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="flex flex-col"
            >
            {!isViewOnly && (
              <div className="flex items-center justify-center gap-3 mb-6 bracket-panel  modal-glow p-6 rounded-lg">
                <div>
                  <h1 className="text-3xl font-bold text-center py-4 text-[#c6f600]">Arma tu camino al título</h1>
                  <div className="flex flex-col items-center justify-center md:hidden">
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 text-xs text-gray-300 px-3 py-1 rounded-full hover:border-[#c6f600] hover:text-white transition-colors"
                      onClick={() => setShowGroupsIntro((prev) => !prev)}
                      aria-expanded={showGroupsIntro}
                      aria-controls="groups-intro"
                    >
                      <ChevronDown className={`w-6 h-6 transition-transform ${showGroupsIntro ? "rotate-180" : ""}`} />
                    </button>
                  </div>
                  <div
                    id="groups-intro"
                    className={`${showGroupsIntro ? "flex" : "hidden"} md:flex flex-col gap-2`}
                  >
                    <p className="text-xl text-gray-100 py-2 text-balance">
                      <span className="flex-shrink-0 font-black text-[#c6f600] rounded-full mr-2 px-2 py-1 bg-black ">
                        1
                      </span>
                      Elige al primero, segundo y tercer lugar de cada grupo (A-L).{" "}
                      <span className="font-bold text-base text-[#c6f600]">
                        Nota: El orden en que selecciones a los equipos determinará la posición final dentro de su grupo.
                      </span>
                    </p>
                    <p className="text-xl text-gray-100 py-2">
                      <span className="flex-shrink-0 font-black text-[#c6f600] rounded-full px-2 py-1 mr-2 bg-black ">
                        2
                      </span>
                      Después de terminar tu selección se desplegarán todos los equipos en tercer puesto que elegiste.
                    </p>
                    <p className="text-xl text-gray-100 py-2">
                      <span className="flex-shrink-0 font-black text-[#c6f600] rounded-full px-2 py-1 mr-2 bg-black ">
                        3
                      </span>
                      Debes seleccionar a los 8 mejores terceros para avanzar a la fase eliminatoria. El orden de selección
                      determinará su posición en el cuadro final.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div
              ref={progressGroupsRef}
              className="groups-grid grid gap-2 px-1 sm:px-2 md:px-4 lg:px-6 sm:grid-cols-2 lg:grid-cols-4"
            >
            {groups.map(({ grupo, equipos }) => (
              <div key={grupo} className="bg-neutral-800 rounded-lg p-3 border border-neutral-700">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[#c6f600] text-xl font-black">Grupo {grupo}</p>
                  {!isViewOnly && (
                    <button
                      type="button"
                      className={`text-xs text-gray-400 hover:text-white inline-flex items-center gap-1 ${
                        openGroups[grupo] ?? true ? "" : "rotate-180"
                      }`}
                      onClick={() =>
                        setOpenGroups((prev) => ({
                          ...prev,
                          [grupo]: !(prev[grupo] ?? true),
                        }))
                      }
                    >
                      <ChevronDown className="w-4 h-4 transition-transform" />
                    </button>
                  )}
                  {!isViewOnly && (
                    <button
                      type="button"
                      className="text-xs text-gray-400 hover:text-white inline-flex items-center  gap-1"
                      onClick={() => setShowFixturesGroup(grupo)}
                    >
                      <CalendarDays className="w-4 h-4 text-[#c6f600]" />
                    </button>
                  )}
                </div>
                {!isViewOnly && (openGroups[grupo] ?? true) ? (
                  <div className="flex flex-col gap-1 ">
                    {equipos.map((team) => {
                      const picked =
                        selections[grupo]?.primero?.id === team.id
                          ? "1ro"
                          : selections[grupo]?.segundo?.id === team.id
                            ? "2do"
                            : selections[grupo]?.tercero?.id === team.id
                              ? "3ro"
                              : null;

                      return (
                        <button
                          key={team.id}
                          type="button"
                          disabled={isLocked}
                          onClick={() => handlePick(grupo, team)}
                          className={`flex items-center justify-between gap-1 rounded-md px-2 py-1 transition-colors ${
                            picked ? "bg-[#c6f600] text-black" : "border-neutral-700 hover:border-[#c6f600]"
                          } ${isLocked ? "opacity-60 cursor-not-allowed" : ""}`}
                          aria-label={`Seleccionar ${team.nombre}`}
                        >
                          <div className="flex items-center gap-2">
                            <div className="relative w-8 h-8 rounded-full overflow-hidden bg-neutral-700">
                              {team.escudo ? (
                                <img
                                  src={team.escudo}
                                  alt={team.nombre}
                                  className="absolute top-1 inset-0 w-full h-full object-cover"
                                />
                              ) : (
                                <span className="absolute inset-0 flex items-center justify-center text-xs text-gray-400">
                                  {team.codigo}
                                </span>
                              )}
                            </div>
                            <div className="flex flex-col text-left">
                              <span className="text-sm font-semibold truncate max-w-[150px]">
                                {team.nombre}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center">
                            {picked ? (
                              <span className="text-base text-[#c6f600] font-black bg-black px-2 py-1 rounded">
                                {picked}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-500"></span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-lg text-gray-300 italic flex flex-wrap gap-2">
                    <span >1ro: {selections[grupo]?.primero?.nombre || "Sin elegir"}</span>
                    <span>2do: {selections[grupo]?.segundo?.nombre || "Sin elegir"}</span>
                    <span  className="text-yellow-600">3ro: {selections[grupo]?.tercero?.nombre || "Sin elegir"}</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {missingThirdGroups.length > 0 && (
            <div className="mt-4 text-xl text-center text-gray-300">
              Te faltan seleccionar el tercero del grupo:{" "}
              <span className="font-semibold text-[#c6f600]">{missingThirdGroups.join(", ")}</span>
            </div>
          )}

          <div
            ref={progressThirdsRef}
            className="mt-8 bg-neutral-800 border border-neutral-700 rounded-lg p-2 flex flex-col items-center"
          >
            <div className="flex flex-col items-center gap-2 mb-3 text-center">
              <div className="flex items-center gap-2">
                <Crown className="w-5 h-5 text-[#c6f600]" />
                <h2 className="text-4xl font-semibold">Mejores terceros</h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-base text-gray-400">Seleccionados: {bestThirdIds.length}/{MAX_THIRD}</span>
                {!isViewOnly && (
                  <button
                    onClick={() => setShowThirdsModal(true)}
                    className="text-xs px-3 py-1 rounded-md border border-neutral-700 hover:border-[#c6f600]"
                  >
                    Editar
                  </button>
                )}
              </div>
            </div>
            {!isViewOnly && (
              <p className="text-[11px] text-gray-400 mb-3 text-center">
                {isLocked
                  ? "Pronóstico bloqueado. Usa Reiniciar si deseas empezar de nuevo."
                  : 'Tus mejores terceros elegidos. Si quieres cambiar, abre "Editar".'}
              </p>
            )}
            {bestThirdTeams.length === 0 ? (
              <p className="text-sm text-gray-400">Aun no seleccionas terceros.</p>
            ) : (
              <div className="w-full">
                <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs text-gray-200">
                  {bestThirdTeams.map((team) => (
                    <div
                      key={`order-${team.id}`}
                      className="flex items-center gap-2 px-2 py-1 rounded-full bg-neutral-900 border border-neutral-700 shadow-sm"
                    >
                      <span className="font-semibold text-black bg-[#c6f600] px-2 py-[2px] rounded-full">
                        #{bestThirdIds.indexOf(team.id) + 1}
                      </span>
                      <div className="relative w-6 h-6 rounded-full overflow-hidden bg-neutral-700">
                        {team.escudo ? (
                          <img src={team.escudo} alt={team.nombre} className="absolute inset-0 w-6 h-6 object-cover" />
                        ) : (
                          <span className="text-[10px] font-semibold text-gray-200 flex items-center justify-center h-full">
                            ?
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {bracketError && (
              <p
                className={`text-sm mt-2 ${bracketError.startsWith("Asignacion") ? "text-yellow-400" : "text-red-400"}`}
              >
                {bracketError}
              </p>
            )}
          </div>
            </motion.div>
          ) : activeTab === "dieciseisavos" ? (
            <motion.div
              key="dieciseisavos"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="flex flex-col"
            >
                {!isViewOnly && (
                  <div className="flex items-center justify-center text-center gap-3 mb-6 bracket-panel  modal-glow p-6 rounded-lg">
                    <div>
                      <h1 className="text-4xl font-bold">Dieciseisavos de Final</h1>
                      <p className="text-xl  text-gray-400">
                        Elige los ganadores de cada cruce para avanzar a octavos.
                      </p>
                    </div>
                  </div>
                )}

              <div className="md:hidden flex items-center gap-2 justify-center w-full mb-4">
                <button
                  type="button"
                  onClick={() => setActiveR32Tab("llave1")}
                  className={`px-5 py-2 rounded-full border text-sm font-bold tracking-wide w-1/2 transition ${
                    activeR32Tab === "llave1"
                      ? "bg-[#c6f600] text-black"
                      : "border-neutral-700 text-gray-200 bg-neutral-900/70 hover:text-white hover:border-[#c6f600]"
                  }`}
                >
                  Llave 1
                </button>
                <button
                  type="button"
                  onClick={() => setActiveR32Tab("llave2")}
                  className={`px-5 py-2 rounded-full border text-sm font-bold tracking-wide w-1/2 transition ${
                    activeR32Tab === "llave2"
                      ? "bg-[#c6f600] text-black"
                      : "border-neutral-700 text-gray-200 bg-neutral-900/70 hover:text-white hover:border-[#c6f600]"
                  }`}
                >
                  Llave 2
                </button>
              </div>

              <div ref={progressR32Ref} className="flex flex-col gap-2 md:gap-4">
                {bestThirdIds.length < MAX_THIRD ? (
                  isViewOnly ? null : (
                    <p className="text-sm text-gray-400">
                      Selecciona a los 8 mejores terceros para habilitar los dieciseisavos.
                    </p>
                  )
                ) : r32.length === 0 ? (
                  isViewOnly ? null : (
                    <p className="text-sm text-gray-400">
                      Completa la fase anterior para generar los dieciseisavos.
                    </p>
                  )
                ) : (
                  <>
                    <div className="md:hidden">
                      <AnimatePresence mode="wait">
                        <motion.div
                          key={activeR32Tab}
                          initial={{ opacity: 0, y: 16 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -12 }}
                          transition={{ duration: 0.25, ease: "easeOut" }}
                          className="flex flex-col gap-2"
                        >
                          {buildR32Cards(
                            activeR32Tab === "llave1" ? r32Left : r32Right,
                            activeR32Tab === "llave1" ? r16Left : r16Right,
                            activeR32Tab === "llave2",
                          )}
                        </motion.div>
                      </AnimatePresence>
                    </div>

                    <div className="hidden md:grid md:grid-cols-2 md:gap-10 items-start w-full">
                      <div className="flex flex-col gap-3 items-center py-4 min-w-0 rounded-xl ">
                        <div
                          className="text-3xl font-black text-[#c6f600] uppercase tracking-wide w-full text-center origin-right px-4 py-2 rounded-xl"
                         
                        >
                          Llave 1
                        </div>
                        {buildR32Cards(r32Left, r16Left, false)}
                      </div>
                      <div className="flex flex-col gap-3 items-center py-4 min-w-0 rounded-xl ">
                        <div
                          className="text-3xl font-black text-[#c6f600] uppercase tracking-wide w-full text-center  origin-left px-4 py-2"
                          
                     >
                          Llave 2
                        </div>
                        {buildR32Cards(r32Right, r16Right, true)}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="llaves"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="flex flex-col"
            >
              <div className="w-full flex justify-center">
            <div
              ref={progressBracketRef}
              className="mt-8 bg-black border items-center py-4 border-neutral-700 rounded-lg  flex flex-col items-center justify-center text-center w-full max-w-6xl relative"
            >
                <div className="flex items-center gap-2 mb-3">
                  <Crown className="w-5 h-5 text-[#c6f600]" />
                  <h2 className="text-4xl font-black">Llaves finales</h2>
                  <Crown className="w-5 h-5 text-[#c6f600]" />
                </div>
                {!isViewOnly && (
                  <p className="text-xl text-gray-300 max-w-3xl mb-4 px-2 md:px-16 text-balance">
                    ¡Ya falta poco! haz clic sobre el equipo ganador de cada partido. No olvides seleccionar al tercer
                    lugar y campeón para completar tu pronóstico.
                  </p>
                )}
                {isEmbedded && championTeam && (
                  <div className="w-full flex justify-center mb-4">
                    <div className="w-full max-w-md rounded-lg border border-neutral-700 bg-black/60 p-4 flex items-center gap-4">
                      <div className="relative w-16 h-16 rounded-full overflow-hidden bg-neutral-700 ring-2 ring-[#c6f600]">
                        {getTeamEscudo(championTeam) ? (
                          <img
                            src={getTeamEscudo(championTeam)}
                            alt={championTeam.nombre}
                            className="absolute inset-0 w-full h-full object-cover"
                          />
                        ) : (
                          <span className="absolute inset-0 flex items-center justify-center text-xs text-gray-200">
                            {championTeam.codigo || "--"}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-col text-left">
                        <span className="text-xs uppercase text-gray-400 tracking-wide">Campeón</span>
                        <span className="text-lg font-bold text-[#c6f600]">{championTeam.nombre}</span>
                      </div>
                    </div>
                  </div>
                )}
                {bestThirdIds.length < MAX_THIRD ? (
                  !isViewOnly && <p className="text-sm text-gray-400">Selecciona 8 terceros para generar los dieciseisavos.</p>
                ) : (
                  <KnockoutBracket
                  r32={r32}
                  r16={r16}
                  qf={qf}
                  sf={sf}
                  final={final}
                  thirdPlace={thirdPlace}
                  onPick={applyWinner}
                  seedLabel={getSeedLabel}
                  schedule={scheduleByMatch}
                  captureRef={bracketCaptureRef}
                  lockFinalSelection={!picks["third-103"]}
                  locked={isLocked}
                  navTarget={bracketNavTarget}
                  onNavHandled={clearBracketNavTarget}
                />
              )}
              <div className="w-full flex flex-col items-center gap-2 mt-4">
               
                {renderShareRow(championTeam, shareDisabled)}
              </div>
            </div>
          </div>
            </motion.div>
          )}
          </AnimatePresence>
        </div>
        </div>
      </main>
      {activeShareCard && (
        <div className="share-card-host" aria-hidden="true">
          <div id="share-card-capture" ref={shareCardRef}>
            <ShareCard
              coverUrl={championBanner}
              champion={activeShareCard.champion}
              runnerUp={activeShareCard.runnerUp}
              third={activeShareCard.third}
              shareUrl={activeShareCard.shareUrl}
            />
          </div>
        </div>
      )}
      {!isEmbedded && <Footer />}
        <NewGamePromptModal
          open={showNewGamePrompt && !isViewOnly}
          onCancel={() => {
            setShowNewGamePrompt(false);
            setActiveTab("repechajes");
          }}
          onConfirm={handleNewGame}
        />
        <RulesModal
          open={showRulesModal && !showNewGamePrompt && !isViewOnly}
          onClose={() => setShowRulesModal(false)}
        />
        <GroupFixturesModal
          open={!!showFixturesGroup && !showNewGamePrompt && !isViewOnly}
          onClose={() => setShowFixturesGroup(undefined)}
          fixtures={fixtures}
          group={showFixturesGroup}
          resolveTeamById={resolveTeam}
        />
        <BestThirdsModal
          open={showThirdsModal && !showNewGamePrompt && !isViewOnly}
          onClose={() => setShowThirdsModal(false)}
          thirdsAvailable={thirdsAvailable}
          bestThirdIds={bestThirdIds}
          maxThird={MAX_THIRD}
          isLocked={isLocked}
          onToggleTeam={toggleThirdChoice}
        />
        <R32InfoModal
          open={showR32Warning && !showNewGamePrompt && !isViewOnly}
          title="Calma"
          message="Los partidos de octavos de final se jugarán en las llaves finales."
          onClose={() => setShowR32Warning(false)}
        />
        <AuthModal
          open={showAuthModal && !showNewGamePrompt && !isViewOnly}
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
        <SaveModal
          open={showSaveModal && !showNewGamePrompt && !isViewOnly}
          onClose={closeSaveModal}
          saveName={saveName}
          onSaveNameChange={setSaveName}
          saveMode={saveMode}
          onSaveModeChange={setSaveMode}
          currentSaveId={currentSaveId}
          savedBrackets={savedBrackets}
          selectedOverwriteId={selectedOverwriteId}
          onSelectOverwriteId={setSelectedOverwriteId}
          saveError={saveError}
          saveBusy={saveBusy}
          onConfirm={handleConfirmSave}
          isAuthed={!!authSession?.access_token}
          guestShortCode={guestShortCode}
          allowOverwrite={false}
        />
        <PhaseBlockModal
          open={!!phaseBlock && !showNewGamePrompt && !isViewOnly}
          title={phaseBlock?.title || ""}
          missing={phaseBlock?.missing || []}
          onClose={() => setPhaseBlock(null)}
        />
        <AnimatePresence>
          {showIntercontinentalModal && !showNewGamePrompt && !isViewOnly && (
            <motion.div
              className="fixed inset-0 z-50 flex items-start md:items-center justify-center px-4 py-6 overflow-y-auto"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeIntercontinentalModal}
          >
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <Confetti
              key={intercontinentalConfettiKey}
              width={width || 0}
              height={height || 0}
              recycle={false}
              numberOfPieces={320}
            />
            <div className="modal-flip" style={{ ["--modal-back" as any]: `url(${modalBackImage})` }}>
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              onClick={(e) => e.stopPropagation()}
              className="relative z-10"
            >
              <div className="modal-flip-card">
              <div
                className="modal-flip-back w-full max-w-lg mx-auto bg-neutral-900 text-white rounded-xl border border-neutral-700 shadow-2xl flex flex-col text-center overflow-hidden modal-glow"
                aria-hidden="true"
              />
              <div
                className="modal-flip-front w-full max-w-lg mx-auto bg-neutral-900 text-white rounded-xl border border-neutral-700 shadow-2xl flex flex-col text-center overflow-hidden modal-glow"
                role="dialog"
                aria-modal="true"
              >
              <div
                className="w-full overflow-hidden border-b border-neutral-700 relative"
                style={{ aspectRatio: "16 / 9" }}
              >
                <img
                  src={intercontinentalBanner}
                  alt="Repechaje completado"
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={closeIntercontinentalModal}
                  className="text-sm text-gray-900 bg-[#c6f600] hover:text-black rounded-full w-6 h-6 flex items-center justify-center"
                  aria-label="X"
                >
                  X
                </button>
              </div>
              <div className="flex flex-col items-center gap-4 p-6">
              <div className="flex items-center gap-2 relative w-full justify-center">
                <Crown className="w-16 h-16 text-[#c6f600]" />
                <h3 className="text-4xl font-black text-[#c6f600]">Liguilla de Repechaje completada</h3>
              </div>
              <p className="text-sm text-gray-300">
                Estos son los equipos que clasificaste al Mundial.
              </p>
              <div className="w-full repechaje-winners-grid">
                {[
                  { label: "Grupo A", team: winnerA },
                  { label: "Grupo B", team: winnerB },
                  { label: "Grupo D", team: winnerD },
                  { label: "Grupo F", team: winnerF },
                  { label: "Grupo I", team: winnerI },
                  { label: "Grupo K", team: winnerK },
                ].map((item) => {
                  const escudo = getTeamEscudo(item.team);
                  return (
                    <div
                      key={item.label}
                      className="flex items-center gap-2 px-2 py-2 rounded-lg bg-neutral-800"
                    >
                      <div className="relative w-full h-full rounded-full overflow-hidden bg-neutral-700">
                        {escudo ? (
                          <img
                            src={escudo}
                            alt={item.team?.nombre || item.label}
                            className="absolute inset-0 w-full h-full object-cover"
                          />
                        ) : (
                          <span className="absolute inset-0 flex items-center justify-center text-[10px] text-gray-200">
                            {item.team?.codigo || "--"}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-col items-start">
                         <span className="text-base font-semibold">
                          {item.team?.nombre || "Por definir"}
                        </span>
                        <span className="text-xs font-semibold text-[#c6f600] uppercase text-left">
                          Clasificado al {item.label}
                        </span>
                       
                      </div>
                    </div>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={closeIntercontinentalModal}
                className="mt-2 px-4 py-2 rounded-md bg-[#c6f600] text-black font-semibold hover:brightness-95"
              >
                ¡Ahora vamos al Mundial!
              </button>
              </div>
              </div>
              </div>
            </motion.div>
            </div>
          </motion.div>
        )}
        {showChampionModal && championTeam && (
          <motion.div
            className="fixed inset-0 z-50 flex items-start md:items-center justify-center px-4 py-6 overflow-y-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowChampionModal(false)}
          >
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <Confetti
              key={confettiKey}
              width={width || 0}
              height={height || 0}
              recycle={false}
              numberOfPieces={450}
            />
            <div className="modal-flip" style={{ ["--modal-back" as any]: `url(${modalBackImage})` }}>
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              onClick={(e) => e.stopPropagation()}
              ref={championModalRef}
              className="relative z-10"
            >
              <div className="modal-flip-card">
              <div
                className="modal-flip-back w-full max-w-lg mx-auto bg-neutral-900 text-white rounded-xl border border-neutral-700 shadow-2xl flex flex-col text-center overflow-hidden modal-glow"
                aria-hidden="true"
              />
              <div
                className="modal-flip-front w-full max-w-lg mx-auto bg-neutral-900 text-white rounded-xl border border-neutral-700 shadow-2xl flex flex-col text-center overflow-hidden modal-glow"
                role="dialog"
                aria-modal="true"
              >
              <div
                ref={championHolo.ref}
                onPointerEnter={championHolo.onPointerEnter}
                onPointerMove={championHolo.onPointerMove}
                onPointerLeave={championHolo.onPointerLeave}
                className="holo-card"
              >
                <div className="holo-surface" aria-hidden="true" />
                <div className="" aria-hidden="true" />
                <div className="holo-glare" aria-hidden="true" />
                <div className="holo-content">
              <div
                className="holo-header w-full overflow-hidden border-b border-neutral-700"
                style={{ aspectRatio: "16 / 9" }}
              >
                <img src={championBanner} alt="Campeón" className="w-full h-full object-cover" />
              </div>
            <div className="relative flex flex-col items-center gap-3 px-6 pb-6 ">
              <div className="absolute left-1/2 -top-16 -translate-x-1/2 z-10">
                <div className="relative w-36 h-36 rounded-full overflow-hidden bg-neutral-700 ring-2 ring-[#c6f600] shadow-lg">
                  {championTeam.escudo ? (
                    <img
                      src={championTeam.escudo}
                      alt={championTeam.nombre}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  ) : (
                    <span className="absolute inset-0 flex items-center justify-center text-sm text-gray-300">
                      {championTeam.codigo || "--"}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 px-2 mt-20">
               <Crown className="w-6 h-6" />
                
                
                <div className="flex flex-col items-start">
                  <span className="md:text-5xl text-3xl font-black uppercase">{championTeam.nombre}</span>
                 
                </div>
                  <div className="flex items-center gap-2 text-[#c6f600]">
              
                <span className="text-4xl font-black uppercase">campeón!</span>
                <Crown className="w-6 h-6" />
              </div>
              
              </div>
              <div className="w-full flex flex-col items-center gap-2 text-xs text-gray-300">
                <div className="flex flex-wrap items-center justify-center gap-3 w-full">
                  <div className="flex items-center gap-2 px-3 py-2 ">
                    <div className="relative w-10 h-10 rounded-full overflow-hidden bg-neutral-700 ring-2 ring-[#c0c0c0]">
                      {runnerUpTeam?.escudo ? (
                        <img
                          src={runnerUpTeam.escudo}
                          alt={runnerUpTeam.nombre}
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                      ) : (
                        <span className="absolute inset-0 flex items-center justify-center text-[10px] text-gray-200">
                          {runnerUpTeam?.codigo || "??"}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col items-start">
                      <span className="text-xs font-semibold  text-[#c6f600] uppercase">Vicecampeón</span>
                      <span className="text-sm font-semibold">{runnerUpTeam?.nombre || "Por definir"}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2 ">
                    <div className="relative w-10 h-10 rounded-full overflow-hidden ring-2 ring-[#cd7f32]">
                      {thirdPlaceWinner?.escudo ? (
                        <img
                          src={thirdPlaceWinner.escudo}
                          alt={thirdPlaceWinner.nombre}
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                      ) : (
                        <span className="absolute inset-0 flex items-center justify-center text-[10px] text-gray-200">
                          {thirdPlaceWinner?.codigo || "??"}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col items-start">
                      <span className="text-xs font-semibold  text-[#c6f600] uppercase">Tercer puesto</span>
                      <span className="text-sm font-semibold">{thirdPlaceWinner?.nombre || "Por definir"}</span>
                    </div>
                  </div>
                </div>
              </div>
              {!isViewOnly && (
                <>
                  <div className="w-full flex flex-col gap-2 text-sm text-gray-300 ">
                    <p className="text-base text-gray-400 text-balance  py-2">
                      Comparte tu Pronóstico (guarda la imagen subelo a tu red favorita) etiqueta a El Telégrafo,
                      Ecuadortv y PublicaFM):
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={downloadBracketImage}
                        className="px-3 py-2 rounded-md text-black bg-[#c6f600] text-sm font-semibold  transition"
                      >
                        Descargar
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveClick}
                        className="px-3 py-2 rounded-md border border-[#c6f600] text-[#c6f600] text-sm font-semibold transition"
                      >
                        Guardar juego
                      </button>
                    </div>
                    {renderShareRow(championTeam, false, false, false)}
                  </div>
                  {authUser && (
                    <div className="w-full flex flex-col items-center gap-2 text-xs text-gray-300">
                      <span className="text-[11px] text-gray-400">
                        Intentos restantes: {resetAttemptsLeft ?? "--"}/{MAX_RESET_ATTEMPTS}
                      </span>
                      <button
                        type="button"
                        onClick={handleFinalReset}
                        disabled={resetAttemptsLeft === null || resetAttemptsLeft <= 0}
                        className={`px-3 py-2 rounded-md border border-neutral-700 text-sm font-semibold transition ${
                          resetAttemptsLeft === null || resetAttemptsLeft <= 0
                            ? "opacity-60 cursor-not-allowed"
                            : "hover:border-[#c6f600]"
                        }`}
                      >
                        {resetAttemptsLeft === null
                          ? "Cargando intentos..."
                          : resetAttemptsLeft > 0
                            ? "Reiniciar pronóstico"
                            : "Sin intentos disponibles"}
                      </button>
                    </div>
                  )}
                </>
              )}
              <button
                type="button"
                onClick={() => setShowChampionModal(false)}
                className="mt-2 px-16 py-2 rounded-md bg-[#c6f600] text-black font-semibold hover:brightness-95 m-4"
              >
                Cerrar
              </button>
              </div>
              </div>
              </div>
              </div>
              </div>
            </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    </div>
  );
}
