import { Crown, ChevronDown, CalendarDays } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent } from "react";
import { createPortal, flushSync } from "react-dom";
import { ShareCard, type ShareCardTeam } from "../components/ShareCard";
import { createShareCardBlob } from "../utils/shareCardImage";
import { resolveApiBase } from "../utils/apiBase";
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
import shareBackLogo from "../assets/7flapollalog.png";
import guestAvatar from "../assets/Fanatico-m.svg";
import guestCover from "../assets/polla-banner.jpg";
import faltaSound from "../assets/mp3/falta.mp3";
import iniSound from "../assets/mp3/ini.wav";
import whatsappIcon from "../assets/whatsapp.svg";
import xIcon from "../assets/x.svg";
import instagramIcon from "../assets/instagram.svg";
import facebookIcon from "../assets/facebook.svg";
import userIcon from "../assets/User.svg";
import "../styles/globals.css";
import { fetchFanaticoData } from "../utils/fanaticoApi";
import { supabase } from "../utils/supabaseClient";
import type { Session, User } from "@supabase/supabase-js";
import type {
  BracketSavePayload,
  EditablePhase,
  Fixture,
  GroupSelections,
  Match,
  MatchSchedule,
  PhaseLockState,
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
import { useBracketScore } from "../features/bracket/score";
import {
  computeBracketDeadlineState,
  isMatchLockedByDeadline,
  isRepechajePhaseArchived,
  type BracketTab,
} from "../features/bracket/deadlines";
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
import { sendConsentNotification } from "../utils/consentNotify";
import { attachClickTracking, initAnalytics, trackEvent, trackPageView } from "../analytics";


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
const MAX_USER_BRACKETS = 5;
const MAX_RESET_ATTEMPTS = 4;
const LS_INTERCONTINENTAL = "fm-repechaje-intercontinental";
const LS_UEFA = "fm-repechaje-uefa";
const LS_TEAMS = "fm-teams";
const LS_GUEST_BRACKET = "fm-guest-bracket";
const LS_PENDING_AUTH_SAVE = "fm-pending-auth-save";
const GUEST_SAVE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_HOME_URL = "https://especiales.eltelegrafo.com.ec/fanaticomundialista/";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
const generateBracketCode = () =>
  `FM-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
const EMPTY_PHASE_LOCKS: PhaseLockState = {
  uefa: false,
  intercontinental: false,
  grupos: false,
  dieciseisavos: false,
  llaves: false,
};
const RULES_STEPS_WITH_REPECHAJES = [
  {
    title: "Empieza por los repechajes",
    body: (
      <>
        Empieza con los <span className="text-[#c6f600] font-semibold">Repechajes</span> y elige ganadores en
        Intercontinental y UEFA.
      </>
    ),
  },
  {
    title: "Define cada grupo",
    body: (
      <>
        Selecciona a los líderes de la fase de grupos: elige al{" "}
        <span className="text-[#c6f600] font-semibold">1º, 2º y 3º puesto de cada grupo</span> de la A a la L.
      </>
    ),
  },
  {
    title: "Escoge los mejores terceros",
    body: (
      <>
        Luego elige los <span className="text-[#c6f600] font-semibold">8 mejores terceros</span> para habilitar las
        eliminatorias.
      </>
    ),
  },
  {
    title: "Completa las llaves",
    body: (
      <>
        Completa los <span className="text-[#c6f600] font-semibold">dieciseisavos de final</span> y avanza las últimas
        rondas.
      </>
    ),
  },
  {
    title: "Cierra tu pronóstico",
    body: <>Elige al tercer puesto y tu campeón mundial de fútbol 2026.</>,
  },
] as const;

const RULES_STEPS_FROM_GROUPS = [
  {
    title: "Empieza por la fase de grupos",
    body: (
      <>
        Define la <span className="text-[#c6f600] font-semibold">fase de grupos</span>: elige al 1º, 2º y 3º puesto
        de cada grupo de la A a la L.
      </>
    ),
  },
  {
    title: "Escoge los mejores terceros",
    body: (
      <>
        Luego elige los <span className="text-[#c6f600] font-semibold">8 mejores terceros</span> para habilitar las
        eliminatorias.
      </>
    ),
  },
  {
    title: "Completa las llaves",
    body: (
      <>
        Completa los <span className="text-[#c6f600] font-semibold">dieciseisavos de final</span> y avanza las últimas
        rondas.
      </>
    ),
  },
  {
    title: "Cierra tu pronóstico",
    body: <>Elige al tercer puesto y tu campeón mundial de fútbol 2026.</>,
  },
] as const;

const isTouch =
  typeof window !== "undefined" && ("ontouchstart" in window || navigator.maxTouchPoints > 0);

const deg2rad = (value: number) => (value * Math.PI) / 180;
const rad2deg = (value: number) => (value * 180) / Math.PI;
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const MODAL_ROTATE_SPEED = 0.005;
const MODAL_INERTIA = 0.92;
const MODAL_AUTO_ROTATE_SPEED = 0.35;
const MODAL_MAX_TILT = deg2rad(25);
const MODAL_HOVER_MAG = deg2rad(6);
const MODAL_HOVER_EASE = 0.15;

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

type PendingAuthSave = {
  source: "save";
  createdAt: string;
};

type SaveResult =
  | {
      ok: true;
      bracketId: string;
      guestCode?: string;
      shareUrl?: string;
    }
  | {
      ok: false;
      error?: string;
    };

type SaveModalProps = {
  open: boolean;
  onClose: () => void;
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
  allowOverwrite?: boolean;
  guestShare?: { code: string; url: string } | null;
  onCopy?: (value: string, label: string) => void;
};

const SaveModal = ({
  open,
  onClose,
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
  allowOverwrite = true,
  guestShare,
  onCopy,
}: SaveModalProps) => {
  if (!open) return null;
  const overlayRef = useRef<HTMLDivElement>(null);
  const limitReached = savedBrackets.length >= MAX_USER_BRACKETS;
  const showOverwrite = allowOverwrite && savedBrackets.length > 0;
  const showUpdate = allowOverwrite && !!currentSaveId;
  const isGuest = !isAuthed;

  if (isGuest) {
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
              <h3 className="text-lg font-semibold text-[#c6f600]">Tu código de juego</h3>
              <button onClick={onClose} className="text-sm text-gray-400 hover:text-white bg-[#c6f600] rounded-full">
                X
              </button>
            </div>
            <div className="rounded-lg border  bg-[#c6f600] p-3 text-sm text-black hover:text-white">
              {guestShare?.code ? (
                <>
                  <p className="text-xs text-gray-400">Copia tu código y enlace para revisar tu bracket.</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="font-mono text-2xl text-[#c6f600]">{guestShare.code}</span>
                    <button
                      type="button"
                      onClick={() => onCopy?.(guestShare.code, "Código")}
                      className="px-2 py-1 rounded-md border border-neutral-700 text-xs font-semibold text-gray-200 hover:border-[#c6f600]"
                    >
                      Copiar código
                    </button>
                  </div>
                  {guestShare.url && (
                    <div className="mt-2 flex flex-col sm:flex-row sm:items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={guestShare.url}
                        className="w-full flex-1 rounded-md bg-neutral-900 border border-neutral-800 px-2 py-1 text-xs text-gray-300"
                      />
                      <button
                        type="button"
                        onClick={() => onCopy?.(guestShare.url, "Enlace")}
                        className="px-2 py-1 rounded-md border border-neutral-700 text-xs font-semibold text-gray-200 hover:border-[#c6f600]"
                      >
                        Copiar enlace
                      </button>
                    </div>
                  )}
                  <p className="mt-2 text-xs text-gray-400">Expira en 7 días.</p>
                </>
              ) : (
                <p className="text-xs text-gray-400">Generando código...</p>
              )}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-2 rounded-md border border-neutral-700 text-xs text-gray-300 hover:border-[#c6f600]"
              >
                Cerrar
              </button>
            </div>
          </div>
        </ModalFlipFrame>
      </div>
    );
  }
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

          <p className="text-xs text-gray-400">
            El código del juego se genera automáticamente para tu bracket.
          </p>

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
              Límite de {MAX_USER_BRACKETS} brackets alcanzado. Debes sobrescribir uno.
            </p>
          )}

          {!isAuthed && (
            <p className="mt-2 text-xs text-gray-400">
              Se guardará 1 semana en este dispositivo. Inicia sesión para guardar en la nube.
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
    semi: { id: "int-k2-sf", home: "BOL", away: "SUR", date: "Jueves 26 de marzo" },
    final: { id: "int-k2-final", date: "Martes 31 de marzo" },
  },
  {
    id: "K",
    title: "Aspirantes grupo K",
    mapGroup: "Llave 2",
    seed: "COD",
    semi: { id: "int-k1-sf", home: "NCL", away: "JAM", date: "Jueves 26 de marzo" },
    final: { id: "int-k1-final", date: "Martes 31 de marzo" },
  },
] as const;

const UEFA_KEYS = [
  {
    id: "A",
    title: "Aspirantes grupo A",
    mapGroup: "Ruta D",
    semi1: { id: "uefa4-sf1", home: "DEN", away: "MKD", date: "Jueves 23 de marzo" },
    semi2: { id: "uefa4-sf2", home: "CZE", away: "IRL", date: "Jueves 23 de marzo" },
    final: { id: "uefa4-final", date: "Martes 31 de marzo" },
  },
  {
    id: "B",
    title: "Aspirantes grupo B",
    mapGroup: "Ruta A",
    semi1: { id: "uefa1-sf1", home: "ITA", away: "NIR", date: "Jueves 23 de marzo" },
    semi2: { id: "uefa1-sf2", home: "WAL", away: "BIH", date: "Jueves 23 de marzo" },
    final: { id: "uefa1-final", date: "Martes 31 de marzo" },
  },
  {
    id: "D",
    title: "Aspirantes grupo D",
    mapGroup: "Ruta C",
    semi1: { id: "uefa3-sf1", home: "TUR", away: "ROU", date: "Jueves 23 de marzo" },
    semi2: { id: "uefa3-sf2", home: "SVK", away: "KOS", date: "Jueves 23 de marzo" },
    final: { id: "uefa3-final", date: "Martes 31 de marzo" },
  },
  {
    id: "F",
    title: "Aspirantes grupo F",
    mapGroup: "Ruta B",
    semi1: { id: "uefa2-sf1", home: "UKR", away: "SWE", date: "Jueves 23 de marzo" },
    semi2: { id: "uefa2-sf2", home: "POL", away: "ALB", date: "Jueves 23 de marzo" },
    final: { id: "uefa2-final", date: "Martes 31 de marzo" },
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
): { matches: Match[]; error?: string; warning?: string; comboKey?: string } => {
  const comboKey = normalizeThirdGroups(thirdsQualified).slice().sort().join("");
  const entry = assignThirdGroupsToSeeds(thirdsQualified);
  if (!entry) {
    return {
      matches: [],
      error: "No se pudo asignar los mejores terceros. Revisa la selección.",
      comboKey,
    };
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

  return { matches, comboKey };
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
  const goNewBracket = () => {
    if (typeof window === "undefined") return;
    const basePath = window.location.pathname.replace(/\/share\/[^/]+\/?$/, "/");
    const target = new URL(basePath || "/", window.location.origin);
    target.searchParams.set("reset", Date.now().toString());
    window.location.href = target.toString();
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
  useEffect(() => {
    if (typeof window === "undefined") return;
    initAnalytics();
    trackPageView(window.location.pathname, document.title);
    const platform =
      window.matchMedia && window.matchMedia("(max-width: 768px)").matches
        ? "mobile"
        : window.matchMedia && window.matchMedia("(max-width: 1024px)").matches
          ? "tablet"
          : "desktop";
    const viewMode = isViewOnly ? "view_only" : "interactive";
    trackEvent("platform_view", {
      platform,
      viewport_width: window.innerWidth,
      viewport_height: window.innerHeight,
    });
    trackEvent("view_mode", {
      view_mode: viewMode,
      is_embedded: isEmbedded,
      is_share: isSharePath,
    });
    if (isViewOnly) {
      trackEvent("live_view", {
        view_mode: viewMode,
        is_embedded: isEmbedded,
        is_share: isSharePath,
      });
    }
    const detachTracking = attachClickTracking();
    let startTime = performance.now();
    let hiddenAt: number | null = null;
    let hiddenTotal = 0;
    let sent = false;

    const recordHiddenTime = () => {
      if (hiddenAt === null) return;
      hiddenTotal += performance.now() - hiddenAt;
      hiddenAt = null;
    };

    const getActiveDuration = () => {
      const now = performance.now();
      const hiddenNow = hiddenAt ? now - hiddenAt : 0;
      return Math.max(0, now - startTime - hiddenTotal - hiddenNow);
    };

    const flushTimeOnPage = (reason: string) => {
      if (sent) return;
      sent = true;
      recordHiddenTime();
      const durationMs = Math.round(getActiveDuration());
      trackEvent("time_on_page", {
        duration_ms: durationMs,
        duration_sec: Math.round(durationMs / 1000),
        reason,
        page_path: window.location.pathname,
        view_mode: viewMode,
        platform,
        is_embedded: isEmbedded,
        is_share: isSharePath,
      });
    };

    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = performance.now();
      } else {
        recordHiddenTime();
      }
    };

    const handlePageHide = () => flushTimeOnPage("pagehide");
    const handleBeforeUnload = () => flushTimeOnPage("beforeunload");

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      detachTracking?.();
      flushTimeOnPage("unmount");
    };
  }, [isViewOnly, isEmbedded, isSharePath]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selections, setSelections] = useState<GroupSelections>({});
  const [bestThirdIds, setBestThirdIds] = useState<string[]>([]);
  const [picks, setPicks] = useState<Record<string, string | undefined>>({});
  const [activeTab, setActiveTab] = useState<BracketTab>(() =>
    isRepechajePhaseArchived(new Date()) ? "grupos" : "repechajes",
  );
  const [activeR32Tab, setActiveR32Tab] = useState<"llave1" | "llave2">("llave1");
  const [activePlayoffTab, setActivePlayoffTab] = useState<"intercontinental" | "uefa">("uefa");
  const [intercontinentalPicks, setIntercontinentalPicks] = useState<PlayoffPickState>({});
  const [uefaPicks, setUefaPicks] = useState<PlayoffPickState>({});
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [nowTs, setNowTs] = useState(() => Date.now());
  const [showFixturesGroup, setShowFixturesGroup] = useState<string | undefined>(undefined);
  const [bracketError, setBracketError] = useState<string | undefined>(undefined);
  const [showThirdsModal, setShowThirdsModal] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [showGroupsIntro, setShowGroupsIntro] = useState(true);
  const [showRepechajeFinalHint, setShowRepechajeFinalHint] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(true);
  const [rulesStep, setRulesStep] = useState(0);
  const [rulesStepDirection, setRulesStepDirection] = useState<1 | -1>(1);
  const [championTeam, setChampionTeam] = useState<Team | undefined>(undefined);
  const [showChampionModal, setShowChampionModal] = useState(false);
  const [confettiKey, setConfettiKey] = useState(0);
  const [showR32Warning, setShowR32Warning] = useState(false);
  const [showNewGamePrompt, setShowNewGamePrompt] = useState(false);
  const [authFabOpen, setAuthFabOpen] = useState(false);
  const { width, height } = useWindowSize();
  const [shareInfo, setShareInfo] = useState<string | null>(null);
  const [activeShareCard, setActiveShareCard] = useState<ShareCardPayload | null>(null);
  const [shareAsset, setShareAsset] = useState<{
    shareCardUrl?: string;
    sharePageUrl?: string;
    bracketId?: string;
    guestCode?: string;
    signature?: string;
  } | null>(null);
  const [guestSharePanel, setGuestSharePanel] = useState<{ code: string; url: string } | null>(null);
  const [viewSharedBy, setViewSharedBy] = useState<BracketSavePayload["sharedBy"] | null>(null);
  const [viewBracketMeta, setViewBracketMeta] = useState<{ name?: string; updatedAt?: string; shortCode?: string } | null>(null);
  const [phaseBlock, setPhaseBlock] = useState<{ title: string; missing: string[] } | null>(null);
  const bracketScoreInput = useMemo(
    () => ({
      picks,
      intercontinentalPicks,
      uefaPicks,
    }),
    [picks, intercontinentalPicks, uefaPicks],
  );
  const { summary: bracketScoreSummary } = useBracketScore(bracketScoreInput, isViewOnly);
  const scoreByMatchId = bracketScoreSummary?.pointsByMatchId || {};
  const phaseBlockBannerPick = useMemo(() => pickStopBanner(), [!!phaseBlock]);
  const r32BannerPick = useMemo(() => pickStopBanner(), [showR32Warning]);
  const bracketCaptureRef = useRef<HTMLDivElement>(null);
  const progressGroupsRef = useRef<HTMLDivElement>(null);
  const progressThirdsRef = useRef<HTMLDivElement>(null);
  const progressBracketRef = useRef<HTMLDivElement>(null);
  const progressR32Ref = useRef<HTMLDivElement>(null);
  const shareCardRef = useRef<HTMLDivElement>(null);
  const authFabRef = useRef<HTMLDivElement>(null);
  const warningAudioRef = useRef<HTMLAudioElement | null>(null);
  const prevWarningRef = useRef(false);
  const rulesAudioRef = useRef<HTMLAudioElement | null>(null);
  const prevRulesOpenRef = useRef(false);
  const prevActiveTabRef = useRef(activeTab);
  const shareInfoTimerRef = useRef<number | null>(null);
  const shareAssetRef = useRef<typeof shareAsset>(null);
  const autoShareInFlightRef = useRef(false);
  const autoShareSignatureRef = useRef<string | null>(null);
  const showShareInfo = useCallback((message: string, timeoutMs = 3500) => {
    setShareInfo(message);
    if (typeof window === "undefined") return;
    if (shareInfoTimerRef.current) {
      window.clearTimeout(shareInfoTimerRef.current);
      shareInfoTimerRef.current = null;
    }
    if (timeoutMs > 0) {
      shareInfoTimerRef.current = window.setTimeout(() => {
        setShareInfo(null);
        shareInfoTimerRef.current = null;
      }, timeoutMs);
    }
  }, []);
  useEffect(() => {
    shareAssetRef.current = shareAsset;
  }, [shareAsset]);
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
    if (typeof Audio === "undefined") return;
    if (!warningAudioRef.current) {
      const audio = new Audio(faltaSound);
      audio.preload = "auto";
      warningAudioRef.current = audio;
    }
    if (!rulesAudioRef.current) {
      const audio = new Audio(iniSound);
      audio.preload = "auto";
      rulesAudioRef.current = audio;
    }
  }, []);
  useEffect(() => {
    const timer = window.setInterval(() => setNowTs(Date.now()), 30 * 1000);
    return () => window.clearInterval(timer);
  }, []);
  const scrollToTop = useCallback((behavior: ScrollBehavior = "smooth") => {
    if (typeof window === "undefined") return;
    window.scrollTo({ top: 0, behavior });
  }, []);
  const upsertMeta = useCallback((selector: string, attrs: Record<string, string>) => {
    if (typeof document === "undefined") return;
    let el = document.querySelector<HTMLMetaElement>(selector);
    if (!el) {
      el = document.createElement("meta");
      document.head.appendChild(el);
    }
    Object.entries(attrs).forEach(([key, value]) => {
      el!.setAttribute(key, value);
    });
  }, []);
  const updateOgTags = useCallback(
    (payload: { title: string; description: string; image: string; url: string }) => {
      upsertMeta('meta[property="og:title"]', { property: "og:title", content: payload.title });
      upsertMeta('meta[property="og:description"]', { property: "og:description", content: payload.description });
      upsertMeta('meta[property="og:image"]', { property: "og:image", content: payload.image });
      upsertMeta('meta[property="og:url"]', { property: "og:url", content: payload.url });
      upsertMeta('meta[name="twitter:title"]', { name: "twitter:title", content: payload.title });
      upsertMeta('meta[name="twitter:description"]', { name: "twitter:description", content: payload.description });
      upsertMeta('meta[name="twitter:image"]', { name: "twitter:image", content: payload.image });
      upsertMeta('meta[name="twitter:card"]', {
        name: "twitter:card",
        content: payload.image ? "summary_large_image" : "summary",
      });
    },
    [upsertMeta],
  );
  useEffect(() => {
    if (isViewOnly) return;
    const prev = prevActiveTabRef.current;
    if (prev !== activeTab) {
      requestAnimationFrame(() => scrollToTop());
    }
    prevActiveTabRef.current = activeTab;
  }, [activeTab, scrollToTop, isViewOnly]);
  useEffect(() => {
    const isWarningOpen = showR32Warning || !!phaseBlock;
    if (isWarningOpen && !prevWarningRef.current) {
      try {
        const audio = warningAudioRef.current;
        if (audio) {
          audio.currentTime = 0;
          void audio.play();
        }
      } catch {
        // ignore autoplay errors
      }
    }
    prevWarningRef.current = isWarningOpen;
  }, [showR32Warning, phaseBlock]);
  useEffect(() => {
    if (showRulesModal && !prevRulesOpenRef.current) {
      try {
        const audio = rulesAudioRef.current;
        if (audio) {
          audio.currentTime = 0;
          void audio.play();
        }
      } catch {
        // ignore autoplay errors
      }
      setRulesStepDirection(1);
      setRulesStep(0);
    }
    prevRulesOpenRef.current = showRulesModal;
  }, [showRulesModal]);

  useEffect(() => {
    if (!authFabOpen) return;
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (authFabRef.current && !authFabRef.current.contains(target)) {
        setAuthFabOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [authFabOpen]);
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
  const championMotionRef = useRef<HTMLDivElement>(null);
  const championDragRef = useRef({ active: false, lastX: 0, lastY: 0 });
  const championDraggingRef = useRef(false);
  const championPausedRef = useRef(false);
  const championInsideRef = useRef(false);
  const championAutoDirRef = useRef(1);
  const championAutoSpeedRef = useRef(MODAL_AUTO_ROTATE_SPEED);
  const championBaseRotRef = useRef({ x: 0, y: 0 });
  const championVelRef = useRef({ x: 0, y: 0 });
  const championHoverTargetRef = useRef({ x: 0, y: 0 });
  const championHoverCurrentRef = useRef({ x: 0, y: 0 });
  const championLastTimeRef = useRef<number | null>(null);
  const [isChampionDragging, setIsChampionDragging] = useState(false);

  const applyChampionTransform = useCallback((x: number, y: number) => {
    const node = championMotionRef.current;
    if (!node) return;
    node.style.setProperty("--modal-rot-x", `${rad2deg(x)}deg`);
    node.style.setProperty("--modal-rot-y", `${rad2deg(y)}deg`);
  }, []);

  useEffect(() => {
    if (!showChampionModal) return;
    championPausedRef.current = false;
    championInsideRef.current = false;
    championDraggingRef.current = false;
    setIsChampionDragging(false);
    championLastTimeRef.current = null;
    championBaseRotRef.current = { x: 0, y: 0 };
    championVelRef.current = { x: 0, y: 0 };
    championHoverTargetRef.current = { x: 0, y: 0 };
    championHoverCurrentRef.current = { x: 0, y: 0 };
    championAutoSpeedRef.current = 0;
    championAutoDirRef.current = 1;
    applyChampionTransform(0, 0);

    let rafId = 0;
    const tick = (time: number) => {
      if (championLastTimeRef.current === null) championLastTimeRef.current = time;
      const dt = Math.min((time - championLastTimeRef.current) / 1000, 0.05);
      championLastTimeRef.current = time;

      if (!championPausedRef.current && !championDraggingRef.current) {
        if (championAutoSpeedRef.current !== 0) {
          championBaseRotRef.current.y += championAutoDirRef.current * championAutoSpeedRef.current * dt;
        }
        championBaseRotRef.current.y += championVelRef.current.x;
        championBaseRotRef.current.x = clamp(
          championBaseRotRef.current.x + championVelRef.current.y,
          -MODAL_MAX_TILT,
          MODAL_MAX_TILT,
        );
        championVelRef.current.x *= MODAL_INERTIA;
        championVelRef.current.y *= MODAL_INERTIA;
      }

      const hoverTarget = championPausedRef.current ? { x: 0, y: 0 } : championHoverTargetRef.current;
      championHoverCurrentRef.current.x +=
        (hoverTarget.x - championHoverCurrentRef.current.x) * MODAL_HOVER_EASE;
      championHoverCurrentRef.current.y +=
        (hoverTarget.y - championHoverCurrentRef.current.y) * MODAL_HOVER_EASE;

      const renderX = championBaseRotRef.current.x + championHoverCurrentRef.current.x;
      const renderY = championBaseRotRef.current.y + championHoverCurrentRef.current.y;
      applyChampionTransform(renderX, renderY);

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [applyChampionTransform, showChampionModal]);

  const handleChampionPointerEnter = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch") return;
    championInsideRef.current = true;
    championPausedRef.current = true;
    championVelRef.current = { x: 0, y: 0 };
    championHoverTargetRef.current = { x: 0, y: 0 };
  }, []);

  const handleChampionPointerLeave = useCallback(() => {
    championInsideRef.current = false;
    championPausedRef.current = false;
    championDraggingRef.current = false;
    setIsChampionDragging(false);
    championHoverTargetRef.current = { x: 0, y: 0 };
  }, []);

  const handleChampionPointerDown = useCallback((event: PointerEvent<HTMLDivElement>) => {
    championDragRef.current = { active: true, lastX: event.clientX, lastY: event.clientY };
    championDraggingRef.current = true;
    setIsChampionDragging(true);
    championPausedRef.current = true;
    championVelRef.current = { x: 0, y: 0 };
    championHoverTargetRef.current = { x: 0, y: 0 };
  }, []);

  const handleChampionPointerMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (championDraggingRef.current) {
      const dx = event.clientX - championDragRef.current.lastX;
      const dy = event.clientY - championDragRef.current.lastY;
      championDragRef.current.lastX = event.clientX;
      championDragRef.current.lastY = event.clientY;

      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
        event.preventDefault();
        championBaseRotRef.current.y += dx * MODAL_ROTATE_SPEED;
        championBaseRotRef.current.x = clamp(
          championBaseRotRef.current.x + dy * MODAL_ROTATE_SPEED,
          -MODAL_MAX_TILT,
          MODAL_MAX_TILT,
        );
        championVelRef.current = { x: dx * MODAL_ROTATE_SPEED, y: dy * MODAL_ROTATE_SPEED };
        if (Math.abs(dx) > 1) championAutoDirRef.current = dx >= 0 ? 1 : -1;
      }
      return;
    }

    if (championPausedRef.current || isTouch) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const nx = (event.clientX - rect.left) / rect.width;
    const ny = (event.clientY - rect.top) / rect.height;
    const px = clamp(nx * 2 - 1, -1, 1);
    const py = clamp(ny * 2 - 1, -1, 1);
    championHoverTargetRef.current = { x: -py * MODAL_HOVER_MAG, y: px * MODAL_HOVER_MAG };
  }, []);

  const handleChampionPointerUp = useCallback((event: PointerEvent<HTMLDivElement>) => {
    championDraggingRef.current = false;
    setIsChampionDragging(false);
    if (event.pointerType === "touch") {
      championPausedRef.current = false;
    } else if (!championInsideRef.current) {
      championPausedRef.current = false;
    }
  }, []);

  const handleChampionPointerCancel = useCallback(() => {
    championDraggingRef.current = false;
    championInsideRef.current = false;
    championPausedRef.current = false;
    setIsChampionDragging(false);
    championHoverTargetRef.current = { x: 0, y: 0 };
  }, []);
  const autoSwitchedPlayoffRef = useRef(false);
  const autoSwitchTimeoutRef = useRef<number | null>(null);
  const [autoSwitchNotice, setAutoSwitchNotice] = useState(false);
  const [showIntercontinentalModal, setShowIntercontinentalModal] = useState(false);
  const [showSemifinalPrompt, setShowSemifinalPrompt] = useState(false);
  const [intercontinentalConfettiKey, setIntercontinentalConfettiKey] = useState(0);
  const intercontinentalModalShownRef = useRef(false);
  const semifinalPromptShownRef = useRef(false);
  const [isLocked, setIsLocked] = useState(false);
  const [phaseLocks, setPhaseLocks] = useState<PhaseLockState>(EMPTY_PHASE_LOCKS);
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
  const [authIntent, setAuthIntent] = useState<"default" | "save">("default");
  const [authBusy, setAuthBusy] = useState(false);
  const [consentMarketing, setConsentMarketing] = useState(false);
  const [consentNews, setConsentNews] = useState(false);
  const [consentUpdates, setConsentUpdates] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveMode, setSaveMode] = useState<"new" | "overwrite" | "update">("new");
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [savedBrackets, setSavedBrackets] = useState<SavedBracketMeta[]>([]);
  const [selectedOverwriteId, setSelectedOverwriteId] = useState<string | null>(null);
  const [currentSaveId, setCurrentSaveId] = useState<string | null>(null);
  const [currentSaveName, setCurrentSaveName] = useState<string>("Mi bracket");
  useEffect(() => {
    if (typeof window === "undefined") return;
    const bracketId = shareAsset?.bracketId || viewBracketId || currentSaveId;
    if (!bracketId) return;
    const shareUrl =
      shareAsset?.sharePageUrl ||
      buildSharePageUrl(bracketId, API_BASE_URL || undefined) ||
      window.location.href;
    const imageUrl =
      shareAsset?.shareCardUrl || new URL("/og.jpg", window.location.origin).toString();
    const baseTitle = currentSaveName || viewBracketMeta?.name || "Pronóstico Mundialista";
    const title =
      baseTitle.toLowerCase().includes("pronóstico") || baseTitle.toLowerCase().includes("pronostico")
        ? baseTitle
        : `Pronóstico Mundialista: ${baseTitle}`;
    const champ = championTeam?.nombre;
    const description = champ
      ? `Pronóstico Mundialista. Campeón: ${champ}. Mira el cuadro completo.`
      : "Mira el pronóstico completo del Mundial.";
    updateOgTags({ title, description, image: imageUrl, url: shareUrl });
  }, [
    shareAsset?.bracketId,
    shareAsset?.shareCardUrl,
    shareAsset?.sharePageUrl,
    viewBracketId,
    currentSaveId,
    currentSaveName,
    viewBracketMeta?.name,
    championTeam?.nombre,
    API_BASE_URL,
    updateOgTags,
  ]);
  const pendingLoadRef = useRef<BracketSavePayload | null>(null);
  const pendingAuthSaveRef = useRef(false);
  const confirmSaveInFlightRef = useRef(false);
  const oauthPopupRef = useRef<Window | null>(null);
  const oauthPopupWatchRef = useRef<number | null>(null);
  const guestSaveMetaRef = useRef<{
    name: string;
    updatedAt: string;
    shortCode?: string;
    shareId?: string;
    shareUrl?: string;
  } | null>(null);
  const authInitRef = useRef(false);

  const normalizePhaseLocks = useCallback(
    (value?: Partial<PhaseLockState> | null, lockAll = false): PhaseLockState => ({
      uefa: lockAll || !!value?.uefa,
      intercontinental: lockAll || !!value?.intercontinental,
      grupos: lockAll || !!value?.grupos,
      dieciseisavos: lockAll || !!value?.dieciseisavos,
      llaves: lockAll || !!value?.llaves,
    }),
    [],
  );

  const lockPhase = useCallback((phase: EditablePhase) => {
    setPhaseLocks((prev) => (prev[phase] ? prev : { ...prev, [phase]: true }));
  }, []);

  const lockPhases = useCallback((phases: EditablePhase[]) => {
    setPhaseLocks((prev) => {
      let changed = false;
      const next = { ...prev };
      phases.forEach((phase) => {
        if (!next[phase]) {
          next[phase] = true;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, []);

  const isPhaseLocked = useCallback(
    (phase: EditablePhase) => isLocked || phaseLocks[phase],
    [isLocked, phaseLocks],
  );

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
    setPhaseLocks(EMPTY_PHASE_LOCKS);
  };

  const trackPick = (context: string, matchId: string, teamCode: string) => {
    trackEvent("bracket_pick", {
      event_category: "interaction",
      context,
      match_id: matchId,
      team_code: teamCode,
    });
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
    async (blob: Blob, bracketId: string, guestCode?: string) => {
      const token = authSession?.access_token;
      if (!token && !guestCode) return null;
      return uploadShareCardImage({
        apiBaseUrl: API_BASE_URL || undefined,
        bracketId,
        token,
        guestCode,
        blob,
      });
    },
    [authSession?.access_token],
  );

  const fetchShareCardBlob = useCallback(async (url: string) => {
    const res = await fetch(url, { mode: "cors", credentials: "omit" });
    if (!res.ok) {
      throw new Error("No se pudo descargar la imagen.");
    }
    return await res.blob();
  }, []);

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
      version: 2,
      selections: selectionPayload,
      bestThirdIds,
      picks,
      intercontinentalPicks,
      uefaPicks,
      isLocked,
      phaseLocks,
      sharedBy,
    };
  }, [selections, bestThirdIds, picks, intercontinentalPicks, uefaPicks, isLocked, phaseLocks, authUser]);

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
      setPhaseLocks(normalizePhaseLocks(payload.phaseLocks, payload.isLocked ?? false));
    },
    [normalizePhaseLocks, resolveTeamForGroup],
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
          const baseShared = payload.sharedBy || {};
          const isGuestShared = !baseShared.userId;
          setViewSharedBy({
            userId: baseShared.userId,
            name: baseShared.name || "Invitado",
            alias: baseShared.alias || "",
            avatarUrl: isGuestShared ? baseShared.avatarUrl || guestAvatar : baseShared.avatarUrl || "",
            coverUrl: baseShared.coverUrl || guestCover,
          });
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

  const readPendingAuthSave = useCallback((): PendingAuthSave | null => {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(LS_PENDING_AUTH_SAVE);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as PendingAuthSave;
      if (parsed?.source !== "save") return null;
      return parsed;
    } catch {
      return null;
    }
  }, []);

  const persistPendingAuthSave = useCallback((payload: PendingAuthSave) => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(LS_PENDING_AUTH_SAVE, JSON.stringify(payload));
    } catch {
      // ignore
    }
  }, []);

  const clearPendingAuthSaveState = useCallback(() => {
    pendingAuthSaveRef.current = false;
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(LS_PENDING_AUTH_SAVE);
    } catch {
      // ignore
    }
  }, []);

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

  const copyToClipboard = useCallback(
    async (value: string, label: string) => {
      if (typeof navigator === "undefined" || !navigator.clipboard) {
        showShareInfo("Copiado.", 2000);
        return;
      }
      try {
        await navigator.clipboard.writeText(value);
        showShareInfo(`${label} copiado.`, 2000);
      } catch {
        showShareInfo("No se pudo copiar.", 2500);
      }
    },
    [showShareInfo],
  );

  const clearGuestSave = useCallback(() => {
    guestSaveMetaRef.current = null;
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(LS_GUEST_BRACKET);
    } catch {
      // ignore
    }
  }, []);

  const ensureGuestMeta = useCallback(() => {
    if (guestSaveMetaRef.current?.shareId) return guestSaveMetaRef.current;
    const existing = readGuestSave();
    if (existing) {
      guestSaveMetaRef.current = {
        name: existing.name,
        updatedAt: existing.updatedAt,
        shortCode: existing.shortCode,
        shareId: existing.shareId,
        shareUrl: existing.shareUrl,
      };
    }
    return guestSaveMetaRef.current;
  }, [readGuestSave]);

  const setGuestShareInfo = useCallback(
    (shortCode?: string, shareId?: string, shareUrl?: string) => {
      if (!shortCode) return;
      const url =
        shareUrl || (shareId ? buildSharePageUrl(shareId, API_BASE_URL || undefined) : "");
      setGuestSharePanel({ code: shortCode, url });
    },
    [API_BASE_URL],
  );

  useEffect(() => {
    if (authSession?.access_token) {
      setGuestSharePanel(null);
      return;
    }
    const existing = readGuestSave();
    if (existing?.shortCode) {
      setGuestShareInfo(existing.shortCode, existing.shareId, existing.shareUrl);
    }
  }, [authSession?.access_token, readGuestSave, setGuestShareInfo]);

  useEffect(() => {
    if (isViewOnly || authSession?.access_token || teams.length === 0) return;
    const existing = readGuestSave();
    if (!existing?.data) return;
    const hasProgress =
      Object.keys(selections).length > 0 ||
      bestThirdIds.length > 0 ||
      Object.keys(picks).length > 0 ||
      Object.keys(intercontinentalPicks).length > 0 ||
      Object.keys(uefaPicks).length > 0;
    if (hasProgress) return;
    applySavedBracket(existing.data);
    setCurrentSaveName(existing.name || "Mi bracket");
    guestSaveMetaRef.current = {
      name: existing.name,
      updatedAt: existing.updatedAt,
      shortCode: existing.shortCode,
      shareId: existing.shareId,
      shareUrl: existing.shareUrl,
    };
  }, [
    applySavedBracket,
    authSession?.access_token,
    bestThirdIds.length,
    intercontinentalPicks,
    isViewOnly,
    picks,
    readGuestSave,
    selections,
    teams.length,
    uefaPicks,
  ]);

  const openAuthModal = (mode: "login" | "signup", intent: "default" | "save" = "default") => {
    trackEvent("auth_open", {
      mode,
      view_mode: isViewOnly ? "view_only" : "interactive",
      is_embedded: isEmbedded,
      is_share: isSharePath,
    });
    setAuthIntent(intent);
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

  const clearOAuthPopup = useCallback(() => {
    if (typeof window !== "undefined" && oauthPopupWatchRef.current !== null) {
      window.clearInterval(oauthPopupWatchRef.current);
    }
    oauthPopupWatchRef.current = null;
    oauthPopupRef.current = null;
  }, []);

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
    if (!readPendingAuthSave()) {
      setAuthIntent("default");
    }
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
    trackEvent("auth_submit", {
      mode: authMode,
      method: "email",
    });
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
          options: {
            emailRedirectTo: window.location.origin,
            data: consentPayload,
          },
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
        trackEvent("auth_success", {
          mode: authMode,
          method: "email",
        });
        if (authIntent === "save" || readPendingAuthSave()) {
          setAuthSuccess(
            data.session
              ? "Cuenta creada. Guardando tu juego..."
              : "Cuenta creada. Revisa tu correo para confirmar. Conservamos tu partida y la guardaremos cuando inicies sesión.",
          );
        } else {
          setAuthSuccess("Cuenta creada. Revisa tu correo para confirmar.");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: authEmail,
          password: authPassword,
        });
        if (error) throw error;
        trackEvent("auth_success", {
          mode: authMode,
          method: "email",
        });
        setShowAuthModal(false);
      }
    } catch (err) {
      trackEvent("auth_error", {
        mode: authMode,
        method: "email",
      });
      setAuthError(err instanceof Error ? err.message : "No pudimos iniciar sesión.");
    } finally {
      setAuthBusy(false);
    }
  };

  const handleOAuthSignIn = async (provider: "google") => {
    trackEvent("auth_oauth_start", {
      mode: authMode,
      provider,
    });
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
      const redirectUrl = new URL(window.location.href);
      redirectUrl.hash = "";
      redirectUrl.searchParams.set("auth_popup", "1");
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: redirectUrl.toString(),
          skipBrowserRedirect: true,
        },
      });
      if (error) throw error;
      if (!data?.url) {
        throw new Error("No pudimos abrir el inicio de sesión con Google.");
      }
      clearOAuthPopup();
      const width = 520;
      const height = 720;
      const left = Math.max(0, window.screenX + Math.round((window.outerWidth - width) / 2));
      const top = Math.max(0, window.screenY + Math.round((window.outerHeight - height) / 2));
      const popup = window.open(
        data.url,
        "fanatico-google-auth",
        `popup=yes,width=${width},height=${height},left=${left},top=${top}`,
      );
      if (!popup) {
        throw new Error("Tu navegador bloqueó la ventana emergente de Google.");
      }
      oauthPopupRef.current = popup;
      oauthPopupWatchRef.current = window.setInterval(() => {
        if (!oauthPopupRef.current || oauthPopupRef.current.closed) {
          clearOAuthPopup();
          setAuthBusy(false);
          setAuthSuccess(null);
        }
      }, 400);
      popup.focus();
      setAuthSuccess("Continúa en la ventana emergente de Google para completar el inicio de sesión.");
    } catch (err) {
      clearOAuthPopup();
      trackEvent("auth_oauth_error", {
        mode: authMode,
        provider,
      });
      setAuthError(err instanceof Error ? err.message : "No pudimos conectar con el proveedor.");
      setAuthBusy(false);
    }
  };

  const handleGoogleCredential = async (credential: string) => {
    trackEvent("auth_oauth_start", {
      mode: authMode,
      provider: "google",
      ux: "popup",
    });
    setAuthBusy(true);
    setAuthError(null);
    setAuthSuccess(null);
    try {
      if (authMode === "signup") {
        const consentPayload = buildConsentPayload({
          marketing: consentMarketing,
          news: consentNews,
          updates: consentUpdates,
          source: "signup-oauth:google-popup",
        });
        storePendingConsent(consentPayload);
      }
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: "google",
        token: credential,
      });
      if (error) throw error;
      trackEvent("auth_success", {
        mode: authMode,
        method: "google",
      });
      if (authIntent === "save" || readPendingAuthSave()) {
        setAuthSuccess("Sesion iniciada. Guardando tu juego...");
      } else {
        setShowAuthModal(false);
      }
      if (!data.session && authIntent !== "save" && !readPendingAuthSave()) {
        setShowAuthModal(false);
      }
    } catch (err) {
      trackEvent("auth_oauth_error", {
        mode: authMode,
        provider: "google",
        ux: "popup",
      });
      setAuthError(err instanceof Error ? err.message : "No pudimos conectar con Google.");
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSignOut = async () => {
    trackEvent("sign_out");
    await supabase.auth.signOut();
    setAuthUser(null);
    setAuthSession(null);
    setCurrentSaveId(null);
    setSavedBrackets([]);
    setSaveNotice("Sesión cerrada.");
  };

  const prepareGuestSaveForAuth = useCallback(() => {
    const autoName = generateBracketCode();
    const payload = buildSavePayload();
    const stored = persistGuestSave(payload, autoName);
    guestSaveMetaRef.current = {
      name: stored?.name || autoName,
      updatedAt: stored?.updatedAt || new Date().toISOString(),
    };
    persistPendingAuthSave({
      source: "save",
      createdAt: new Date().toISOString(),
    });
    setSaveMode("new");
    setSaveName(autoName);
    setSelectedOverwriteId(null);
    setSaveError(null);
    setSaveNotice("Tu juego quedó resguardado en este dispositivo mientras terminas el registro.");
  }, [buildSavePayload, persistGuestSave, persistPendingAuthSave]);

  const handleSaveClick = async () => {
    if (saveBusy || confirmSaveInFlightRef.current || pendingAuthSaveRef.current) {
      setSaveNotice(currentSaveId ? "Tu juego ya ha sido guardado." : "Estamos guardando tu juego...");
      return;
    }
    trackEvent("save_open", {
      is_authed: !!authSession?.access_token,
    });
    setSaveError(null);
    setShowSaveModal(false);
    if (authSession?.access_token && currentSaveId) {
      setShowChampionModal(false);
      setSaveNotice("Tu juego ya ha sido guardado.");
      return;
    }
    const autoName = generateBracketCode();
    setSaveMode("new");
    setSaveName(autoName);
    setSelectedOverwriteId(null);
    if (!authSession?.access_token) {
      prepareGuestSaveForAuth();
      setShowChampionModal(false);
      openAuthModal("signup", "save");
      return;
    }
    setShowChampionModal(false);
    const result = await handleConfirmSave({ source: "save" });
    if (!result.ok) {
      setSaveNotice(result.error || "No pudimos guardar el bracket.");
      return;
    }
    if (!authSession?.access_token && result.ok) {
      setShowSaveModal(true);
    }
  };

  const handleConfirmSave = async (options?: {
    skipShareCard?: boolean;
    source?: "save" | "share";
    payloadOverride?: BracketSavePayload;
    nameOverride?: string;
    clearGuestOnSuccess?: boolean;
  }): Promise<SaveResult> => {
    if (confirmSaveInFlightRef.current) {
      return {
        ok: false,
        error: currentSaveId ? "Tu juego ya ha sido guardado." : "Estamos guardando tu juego...",
      };
    }
    confirmSaveInFlightRef.current = true;
    trackEvent("save_confirm", {
      mode: saveMode,
      is_authed: !!authSession?.access_token,
      source: options?.source || "save",
    });
    setSaveBusy(true);
    setSaveError(null);
    try {
      const payload = options?.payloadOverride || buildSavePayload();
      if (!authSession?.access_token) {
        let shortCode = "";
        let shareId = "";
        let shareUrl = "";
        try {
          const guestShare = await createGuestShare({
            apiBaseUrl: API_BASE_URL || undefined,
            name: "",
            data: payload,
          });
          if (!guestShare?.id || !guestShare?.shortCode) {
            throw new Error("No se pudo generar el código.");
          }
          shortCode = guestShare.shortCode.toUpperCase();
          shareId = guestShare.id;
          shareUrl = guestShare.sharePageUrl || "";
        } catch (err) {
          trackEvent("save_error", {
            mode: saveMode,
            is_authed: false,
            reason: "guest_code",
          });
          setSaveError(err instanceof Error ? err.message : "No pudimos generar el código de invitado.");
          setSaveBusy(false);
          return {
            ok: false,
            error: err instanceof Error ? err.message : "No pudimos generar el código de invitado.",
          };
        }
        const stored = persistGuestSave(payload, shortCode, { shortCode, shareId, shareUrl });
        guestSaveMetaRef.current = {
          name: stored?.name || shortCode,
          updatedAt: stored?.updatedAt || new Date().toISOString(),
          shortCode,
          shareId,
          shareUrl,
        };
        if (!options?.skipShareCard) {
          void (async () => {
            try {
              const shareUrlForCard = shareUrl || buildSharePageUrl(shareId, API_BASE_URL || undefined);
              const sharePayload: ShareCardPayload = {
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
                shareUrl: shareUrlForCard,
              };
              const blob = await captureShareCardBlob(sharePayload);
              const uploaded = await uploadShareCard(blob, shareId, shortCode);
              if (uploaded?.shareCardUrl) {
                const signature = [
                  shareId,
                  championTeam?.id || "",
                  runnerUpTeam?.id || "",
                  thirdPlaceWinner?.id || "",
                ].join("|");
                const nextAsset = {
                  shareCardUrl: uploaded.shareCardUrl,
                  sharePageUrl: uploaded.sharePageUrl || shareUrlForCard,
                  bracketId: shareId,
                  guestCode: shortCode || undefined,
                  signature,
                };
                setShareAsset(nextAsset);
                shareAssetRef.current = nextAsset;
                autoShareSignatureRef.current = signature;
              }
            } catch {
              // ignore upload failures for guest saves
            } finally {
              setActiveShareCard(null);
            }
          })();
        }
        trackEvent("save_success", {
          mode: saveMode,
          is_authed: false,
          save_target: "guest",
        });
        setSaveNotice(`Copia el código ${shortCode} para revisar tu bracket.`);
        setGuestShareInfo(shortCode, shareId, shareUrl);
        return { ok: true, bracketId: shareId, guestCode: shortCode, shareUrl };
      }
      const name = options?.nameOverride || saveName.trim() || generateBracketCode();
      const userId = requireAuthUserId();
      if (currentSaveId) {
        if ((options?.source || "save") === "save") {
          setSaveError("Tu juego ya ha sido guardado.");
          return {
            ok: false,
            error: "Tu juego ya ha sido guardado.",
          };
        }
        return {
          ok: true,
          bracketId: currentSaveId,
        };
      }
      const { count, error: countError } = await supabase
        .from("bracket_saves")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId);
      if (countError) throw countError;
      if ((count || 0) >= MAX_USER_BRACKETS) {
        trackEvent("save_error", {
          mode: saveMode,
          is_authed: true,
          reason: "limit",
        });
        setSaveError(`Llegaste al límite de ${MAX_USER_BRACKETS} brackets. Adminístralos en /user.`);
        setSaveBusy(false);
        return {
          ok: false,
          error: `Llegaste al límite de ${MAX_USER_BRACKETS} brackets. Adminístralos en /user.`,
        };
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
      trackEvent("save_success", {
        mode: saveMode,
        is_authed: true,
        save_target: "user",
      });
      if (options?.clearGuestOnSuccess) {
        clearGuestSave();
      }
      if (!options?.clearGuestOnSuccess) {
        setSaveNotice("Bracket guardado correctamente.");
      }
      return saved?.id ? { ok: true, bracketId: saved.id } : { ok: false, error: "No pudimos guardar." };
    } catch (err) {
      trackEvent("save_error", {
        mode: saveMode,
        is_authed: !!authSession?.access_token,
        reason: "unknown",
      });
      const message = err instanceof Error ? err.message : "No pudimos guardar el bracket.";
      setSaveError(message);
      return { ok: false, error: message };
    } finally {
      confirmSaveInFlightRef.current = false;
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
    if (!authSession?.access_token) return;
    if (oauthPopupRef.current) {
      clearOAuthPopup();
      setAuthBusy(false);
      if (authIntent === "save" || readPendingAuthSave()) {
        setAuthSuccess("Sesión iniciada. Guardando tu juego...");
      } else {
        setShowAuthModal(false);
      }
    }
  }, [authIntent, authSession?.access_token, clearOAuthPopup, readPendingAuthSave]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("auth_popup") !== "1" || !window.opener || !authSession?.access_token) return;
    const closeTimer = window.setTimeout(() => {
      try {
        window.opener.focus();
      } catch {
        // ignore
      }
      window.close();
    }, 150);
    return () => window.clearTimeout(closeTimer);
  }, [authSession?.access_token]);

  useEffect(() => () => clearOAuthPopup(), [clearOAuthPopup]);

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
    if (!authSession?.access_token) {
      pendingAuthSaveRef.current = false;
      return;
    }
    const pending = readPendingAuthSave();
    if (!pending || pendingAuthSaveRef.current) return;
    pendingAuthSaveRef.current = true;
    const guestDraft = readGuestSave();
    const payload = guestDraft?.data;
    if (payload) {
      applySavedBracket(payload);
      setCurrentSaveName(guestDraft?.name || "Mi bracket");
    }
    void (async () => {
      const result = await handleConfirmSave({
        source: "save",
        skipShareCard: true,
        payloadOverride: payload,
        nameOverride: guestDraft?.name,
        clearGuestOnSuccess: true,
      });
      if (result.ok) {
        clearPendingAuthSaveState();
        setAuthIntent("default");
        setShowAuthModal(false);
        setSaveNotice("Tu juego quedó guardado en tu cuenta.");
        navigateTo("backend");
        return;
      }
      pendingAuthSaveRef.current = false;
      const message = result.error || "No pudimos guardar tu juego.";
      setAuthError(message);
      setShowAuthModal(true);
    })();
  }, [
    applySavedBracket,
    authSession?.access_token,
    clearPendingAuthSaveState,
    handleConfirmSave,
    navigateTo,
    readGuestSave,
    readPendingAuthSave,
  ]);

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

  const deadlineState = useMemo(
    () => computeBracketDeadlineState(fixtures, new Date(nowTs)),
    [fixtures, nowTs],
  );
  const deadlineHiddenTabs = useMemo<Record<BracketTab, boolean>>(
    () =>
      isViewOnly
        ? {
            repechajes: deadlineState.hiddenTabs.repechajes,
            grupos: false,
            dieciseisavos: false,
            llaves: false,
          }
        : deadlineState.hiddenTabs,
    [deadlineState.hiddenTabs, isViewOnly],
  );
  const phaseDeadlineLocked = useMemo<Record<BracketTab, boolean>>(
    () =>
      isViewOnly
        ? {
            repechajes: deadlineState.phaseLocked.repechajes,
            grupos: false,
            dieciseisavos: false,
            llaves: false,
          }
        : deadlineState.phaseLocked,
    [deadlineState.phaseLocked, isViewOnly],
  );
  const defaultStartTab: BracketTab = deadlineHiddenTabs.repechajes ? "grupos" : "repechajes";
  const rulesSteps = deadlineHiddenTabs.repechajes ? RULES_STEPS_FROM_GROUPS : RULES_STEPS_WITH_REPECHAJES;
  useEffect(() => {
    setRulesStep((prev) => Math.min(prev, rulesSteps.length - 1));
  }, [rulesSteps]);
  const isMatchBlockedByDeadline = useCallback(
    (matchId: string) => (!isViewOnly ? isMatchLockedByDeadline(matchId, deadlineState) : false),
    [deadlineState, isViewOnly],
  );
  const openDeadlinePhaseBlock = useCallback(
    (phase: BracketTab) => {
      const titleByPhase: Record<BracketTab, string> = {
        repechajes: "Repechajes cerrados",
        grupos: "Fase de grupos cerrada",
        dieciseisavos: "Eliminatorias cerradas",
        llaves: "Llaves finales cerradas",
      };
      if (phase === "grupos" && deadlineState.groupCutoff) {
        const cutoffLabel = deadlineState.groupCutoff.toLocaleString("es-EC", {
          day: "2-digit",
          month: "long",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
        setPhaseBlock({
          title: titleByPhase[phase],
          missing: [`Esta fase se cerró el ${cutoffLabel}.`],
        });
        return;
      }
      if (phase === "repechajes") {
        const cutoffLabel = deadlineState.repechajeCutoff.toLocaleString("es-EC", {
          day: "2-digit",
          month: "long",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
        setPhaseBlock({
          title: titleByPhase[phase],
          missing: [`Esta fase estuvo disponible hasta el ${cutoffLabel}.`],
        });
        return;
      }
      setPhaseBlock({
        title: titleByPhase[phase],
        missing: ["La hora oficial de esta fase ya venció."],
      });
    },
    [deadlineState.groupCutoff, deadlineState.repechajeCutoff],
  );
  const getFirstVisibleTabFrom = useCallback(
    (start: BracketTab): BracketTab => {
      const order: BracketTab[] = ["repechajes", "grupos", "dieciseisavos", "llaves"];
      const startIdx = order.indexOf(start);
      const forward = order.slice(Math.max(0, startIdx));
      const fallback = [...forward, ...order];
      for (const tab of fallback) {
        if (!deadlineHiddenTabs[tab]) return tab;
      }
      return defaultStartTab;
    },
    [deadlineHiddenTabs, defaultStartTab],
  );

  const repechajesLocked = uefaComplete && intercontinentalComplete;
  const repechajesReady = repechajesLocked || phaseDeadlineLocked.repechajes;

  const repechajesMissing = useMemo(() => {
    const missing: string[] = [];
    if (!phaseDeadlineLocked.repechajes) {
      if (!uefaComplete) missing.push("UEFA");
      if (!intercontinentalComplete) missing.push("Intercontinental");
    }
    return missing;
  }, [uefaComplete, intercontinentalComplete, phaseDeadlineLocked.repechajes]);

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
    if (phaseDeadlineLocked.repechajes) {
      openDeadlinePhaseBlock("repechajes");
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
    if (tab === "intercontinental") {
      lockPhase("uefa");
    }
    setActivePlayoffTab(tab);
  };

  const goToGroupsIfReady = useCallback(() => {
    if (showNewGamePrompt) {
      setActiveTab(defaultStartTab);
      return false;
    }
    if (isViewOnly) {
      setPhaseBlock(null);
      setActiveTab("grupos");
      return true;
    }
    if (deadlineHiddenTabs.grupos) {
      const nextTab = getFirstVisibleTabFrom("dieciseisavos");
      setActiveTab(nextTab);
      return false;
    }
    if (repechajesReady) {
      lockPhases(["uefa", "intercontinental"]);
      setActiveTab("grupos");
      return true;
    }
    setActiveTab("repechajes");
    setPhaseBlock({
      title: "Completa los repechajes",
      missing: repechajesMissing.length ? repechajesMissing : ["UEFA", "Intercontinental"],
    });
    return false;
    }, [
      showNewGamePrompt,
      defaultStartTab,
      isViewOnly,
      deadlineHiddenTabs.grupos,
      getFirstVisibleTabFrom,
      repechajesReady,
      repechajesMissing,
      lockPhases,
    ]);

  const goToDieciseisavosIfReady = useCallback(() => {
    if (showNewGamePrompt) {
      setActiveTab(defaultStartTab);
      return false;
    }
    if (isViewOnly) {
      setPhaseBlock(null);
      setActiveTab("dieciseisavos");
      return true;
    }
    if (deadlineHiddenTabs.dieciseisavos) {
      const nextTab = getFirstVisibleTabFrom("llaves");
      setActiveTab(nextTab);
      return false;
    }
    if (!repechajesReady) {
      return goToGroupsIfReady();
    }
    if (!phaseDeadlineLocked.grupos && !groupCompletion.complete) {
      setActiveTab("grupos");
      setPhaseBlock({
        title: "Completa la fase de grupos",
        missing: groupCompletion.missing.length
          ? groupCompletion.missing.map((g) => `Grupo ${g}`)
          : ["Completa 1ro, 2do y 3ro de cada grupo."],
      });
      return false;
    }
    if (!phaseDeadlineLocked.grupos && !thirdsComplete) {
      setActiveTab("grupos");
      setPhaseBlock({
        title: "Selecciona los 8 mejores terceros",
        missing: [`Seleccionados: ${bestThirdIds.length}/${MAX_THIRD}`],
      });
      return false;
    }
    lockPhase("grupos");
    setActiveTab("dieciseisavos");
    return true;
    }, [
      showNewGamePrompt,
      defaultStartTab,
      isViewOnly,
      deadlineHiddenTabs.dieciseisavos,
      getFirstVisibleTabFrom,
      repechajesReady,
      goToGroupsIfReady,
      phaseDeadlineLocked.grupos,
      groupCompletion.complete,
      groupCompletion.missing,
      thirdsComplete,
      bestThirdIds.length,
      lockPhase,
    ]);

  const goToLlavesIfReady = useCallback(() => {
    if (showNewGamePrompt) {
      setActiveTab(defaultStartTab);
      return false;
    }
    if (isViewOnly) {
      setPhaseBlock(null);
      setActiveTab("llaves");
      return true;
    }
    if (deadlineHiddenTabs.llaves) {
      openDeadlinePhaseBlock("llaves");
      return false;
    }
    if (!goToDieciseisavosIfReady()) return false;
    if (!phaseDeadlineLocked.dieciseisavos && !r32CompleteRef.current) {
      setActiveTab("dieciseisavos");
      setPhaseBlock({
        title: "Completa dieciseisavos para avanzar",
        missing: missingMatchLabels(r32Ref.current),
      });
      return false;
    }
    lockPhase("dieciseisavos");
    setActiveTab("llaves");
    return true;
  }, [
      showNewGamePrompt,
      defaultStartTab,
      isViewOnly,
      deadlineHiddenTabs.llaves,
      lockPhase,
      openDeadlinePhaseBlock,
      goToDieciseisavosIfReady,
      phaseDeadlineLocked.dieciseisavos,
      missingMatchLabels,
    ]);

  useEffect(() => {
    if (!deadlineHiddenTabs[activeTab]) return;
    const order: BracketTab[] = ["repechajes", "grupos", "dieciseisavos", "llaves"];
    const fallback = order.find((tab) => !deadlineHiddenTabs[tab]);
    if (fallback) {
      setActiveTab(fallback);
      return;
    }
    setActiveTab(defaultStartTab);
  }, [activeTab, deadlineHiddenTabs, defaultStartTab]);

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
      lockPhase("uefa");
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
  }, [uefaComplete, activePlayoffTab, isViewOnly, lockPhase]);

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
    if (isPhaseLocked("grupos")) return;
    if (phaseDeadlineLocked.grupos) return;
    const order: Array<keyof NonNullable<GroupSelections[string]>> = ["primero", "segundo", "tercero"];
    setSelections((prev) => {
      const current = prev[grupo] || {};
      const pickedSlot = order.find((slot) => current[slot]?.id === team.id);
      if (pickedSlot) {
        const remaining = order
          .map((slot) => current[slot])
          .filter((selected): selected is Team => !!selected && selected.id !== team.id);
        return {
          ...prev,
          [grupo]: {
            primero: remaining[0],
            segundo: remaining[1],
            tercero: remaining[2],
          },
        };
      }
      const filledCount = order.filter((slot) => current[slot]).length;
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
    (
      setState: React.Dispatch<React.SetStateAction<PlayoffPickState>>,
      context: string,
      phase: "uefa" | "intercontinental",
    ) =>
    (matchId: string, teamCode: string) => {
      if (isPhaseLocked(phase)) return;
      if (phaseDeadlineLocked.repechajes) return;
      if (isMatchBlockedByDeadline(matchId)) return;
      setState((prev) => {
        if (prev[matchId] === teamCode) return prev;
        return { ...prev, [matchId]: teamCode };
      });
      trackPick(context, matchId, teamCode);
    };

  const handleIntercontinentalPick = togglePlayoffPick(
    setIntercontinentalPicks,
    "repechaje-intercontinental",
    "intercontinental",
  );
  const handleUefaPick = togglePlayoffPick(setUefaPicks, "repechaje-uefa", "uefa");

  const resetIntercontinental = () => setIntercontinentalPicks({});
  const resetUEFA = () => setUefaPicks({});
  const resetAll = () => {
    reset();
    resetIntercontinental();
    resetUEFA();
  };
  const handleFinalReset = () => {
    if (!authUser || resetAttemptsLeft === null || resetAttemptsLeft <= 0) return;
    const nextAttempts = resetAttemptsLeft - 1;
    trackEvent("reset_attempt", {
      remaining: resetAttemptsLeft,
    });
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
    trackEvent("reset_success", {
      remaining: Math.max(0, nextAttempts),
    });
  };
  const handleNewGame = (source: "manual" | "deeplink" | "auto" = "manual") => {
    trackEvent("new_game", { source });
    resetAll();
    pendingLoadRef.current = null;
    setShowSemifinalPrompt(false);
    semifinalPromptShownRef.current = false;
    clearPendingAuthSaveState();
    setAuthIntent("default");
    setActiveTab(defaultStartTab);
    setSaveMode("new");
    setSaveName("Mi bracket");
    setSelectedOverwriteId(null);
    setCurrentSaveId(null);
    setCurrentSaveName("Mi bracket");
    setSaveError(null);
    setSaveNotice(null);
    setShowNewGamePrompt(false);
    suspendAutoAdvanceRef.current = false;
    if (!authSession?.access_token) {
      clearGuestSave();
      setGuestSharePanel(null);
    }
  };
  const newGamePromptShownRef = useRef(false);
  const suspendAutoAdvanceRef = useRef(false);
  const lastResetFromPanelRef = useRef<number | null>(null);
  const skipAutoLoadRef = useRef(false);
  useEffect(() => {
    if (pageParams?.resetGame) return;
    skipAutoLoadRef.current = false;
  }, [authSession?.access_token, pageParams?.resetGame]);
  const resetQueryRef = useRef<string | null>(null);
  useEffect(() => {
    const resetParam = viewParams?.get("reset");
    if (!resetParam) return;
    if (resetQueryRef.current === resetParam) return;
    resetQueryRef.current = resetParam;
    handleNewGame("deeplink");
    if (typeof window !== "undefined") {
      const cleanUrl = new URL(window.location.href);
      cleanUrl.searchParams.delete("reset");
      window.history.replaceState({}, "", cleanUrl.toString());
    }
  }, [viewParams, handleNewGame]);
  useEffect(() => {
    const resetToken = pageParams?.resetGame as number | undefined;
    if (!resetToken) return;
    if (lastResetFromPanelRef.current === resetToken) return;
    lastResetFromPanelRef.current = resetToken;
    skipAutoLoadRef.current = true;
    handleNewGame("deeplink");
    navigateTo("home", {});
  }, [pageParams?.resetGame, handleNewGame, navigateTo]);

  const toggleThirdChoice = (team: Team) => {
    if (isPhaseLocked("grupos")) return;
    if (phaseDeadlineLocked.grupos) return;
    setBestThirdIds((prev) => {
      if (prev.includes(team.id)) {
        return prev.filter((id) => id !== team.id);
      }
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
      if (isMatchBlockedByDeadline(finalMatch.id)) return false;
      return !finalMatch.winnerCode;
    });
  }, [activePlayoffBlocks, isMatchBlockedByDeadline]);

  useEffect(() => {
    setShowRepechajeFinalHint(false);
  }, [activeTab, activePlayoffTab]);

  useEffect(() => {
    if (activeTab !== "repechajes" || repechajesLocked || phaseDeadlineLocked.repechajes) {
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
  }, [activeTab, repechajesLocked, phaseDeadlineLocked.repechajes, hasPickableFinalMissing, showRepechajeFinalHint]);

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
    const map = new Map(thirdsAvailable.map((t) => [t.id, t.grupo?.toUpperCase()]));
    const ordered = bestThirdIds
      .map((id) => map.get(id))
      .filter(Boolean) as string[];
    const seen = new Set<string>();
    const deduped: string[] = [];
    ordered.forEach((g) => {
      if (!seen.has(g)) {
        seen.add(g);
        deduped.push(g);
      }
    });
    return deduped;
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
  const buildShareCardPayload = useCallback(
    (shareUrl: string): ShareCardPayload => ({
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
    }),
    [championTeam, runnerUpTeam, thirdPlaceWinner],
  );
  const captureShareCardBlob = useCallback(
    async (payload: ShareCardPayload) => {
      flushSync(() => setActiveShareCard(payload));
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const target = shareCardRef.current || document.getElementById("share-card-capture");
      return createShareCardBlob(payload, target || undefined, {
        backgroundColor: "#1d1d1b",
        coverUrl: championBanner,
        forceFallback: true,
      });
    },
    [championBanner],
  );
  const ensureShareCardReady = useCallback(
    async (
      reason: "auto" | "share",
      overrides?: { bracketId?: string | null; guestCode?: string; sharePageUrl?: string },
    ) => {
      if (isViewOnly || !championTeam) return null;
      ensureGuestMeta();
      if (autoShareInFlightRef.current) return shareAssetRef.current;

      const signatureId = overrides?.bracketId || currentSaveId || guestSaveMetaRef.current?.shareId || "";
      const signature = [
        signatureId,
        championTeam?.id || "",
        runnerUpTeam?.id || "",
        thirdPlaceWinner?.id || "",
      ].join("|");
      if (autoShareSignatureRef.current === signature && shareAssetRef.current?.shareCardUrl) {
        return shareAssetRef.current;
      }

      autoShareInFlightRef.current = true;
      showShareInfo(reason === "auto" ? "Generando imagen final..." : "Generando tarjeta...", 0);

      let bracketId = overrides?.bracketId || currentSaveId || guestSaveMetaRef.current?.shareId || null;
      let guestCode: string | undefined = overrides?.guestCode || guestSaveMetaRef.current?.shortCode;
      let sharePageUrl = overrides?.sharePageUrl || "";
      if (bracketId) {
        if (!sharePageUrl) {
          if (currentSaveId) {
            sharePageUrl = buildSharePageUrl(bracketId, API_BASE_URL || undefined);
          } else {
            sharePageUrl =
              guestSaveMetaRef.current?.shareUrl || buildSharePageUrl(bracketId, API_BASE_URL || undefined);
          }
        }
      }

      if (!bracketId) {
        if (authSession?.access_token) {
          try {
            const userId = requireAuthUserId();
            const { count, error: countError } = await supabase
              .from("bracket_saves")
              .select("id", { count: "exact", head: true })
              .eq("user_id", userId);
            if (countError) throw countError;
            if ((count || 0) < MAX_USER_BRACKETS) {
              const payload = buildSavePayload();
              const name = saveName.trim() || generateBracketCode();
              const { data, error } = await supabase
                .from("bracket_saves")
                .insert([{ user_id: userId, name, data: payload }])
                .select("id,name")
                .maybeSingle();
              if (error) throw error;
              const saved = data as { id: string; name?: string } | null;
              if (saved?.id) {
                bracketId = saved.id;
                setCurrentSaveId(saved.id);
                setCurrentSaveName(saved.name || name);
                sharePageUrl = buildSharePageUrl(saved.id, API_BASE_URL || undefined);
              }
            }
          } catch {
            // fallback to guest share below
          }
        }
      }

      if (!bracketId) {
        if (reason === "auto") {
          autoShareInFlightRef.current = false;
          setShareInfo(null);
          return null;
        }
        try {
          const payload = buildSavePayload();
          const guestShare = await createGuestShare({
            apiBaseUrl: API_BASE_URL || undefined,
            name: "",
            data: payload,
          });
          if (guestShare?.id) {
            bracketId = guestShare.id;
            const shortCode = guestShare.shortCode ? guestShare.shortCode.toUpperCase() : "";
            guestCode = shortCode || undefined;
            sharePageUrl = guestShare.sharePageUrl || buildSharePageUrl(guestShare.id, API_BASE_URL || undefined);
            const stored = persistGuestSave(payload, shortCode, {
              shortCode,
              shareId: guestShare.id,
              shareUrl: guestShare.sharePageUrl,
            });
            guestSaveMetaRef.current = {
              name: stored?.name || shortCode,
              updatedAt: stored?.updatedAt || new Date().toISOString(),
              shortCode,
              shareId: guestShare.id,
              shareUrl: guestShare.sharePageUrl,
            };
            if (reason === "share") {
              setSaveNotice(`Copia el código ${shortCode} para revisar tu bracket.`);
              setGuestShareInfo(shortCode, guestShare.id, guestShare.sharePageUrl);
            }
          }
        } catch {
          // ignore guest creation errors
        }
      }

      if (!bracketId) {
        autoShareInFlightRef.current = false;
        showShareInfo("No se pudo preparar la imagen.", 4000);
        return null;
      }

      const shareUrl = sharePageUrl || buildShareUrl(bracketId);
      const payload = buildShareCardPayload(shareUrl);
      try {
        const blob = await captureShareCardBlob(payload);
        showShareInfo("Subiendo imagen...", 0);
        const uploaded = await uploadShareCard(blob, bracketId, guestCode);
        const nextShareCardUrl = uploaded?.shareCardUrl;
        const nextSharePageUrl = uploaded?.sharePageUrl || sharePageUrl || shareUrl;
        if (nextShareCardUrl) {
          const nextAsset = {
            shareCardUrl: nextShareCardUrl,
            sharePageUrl: nextSharePageUrl,
            bracketId,
            guestCode,
            signature,
          };
          setShareAsset(nextAsset);
          shareAssetRef.current = nextAsset;
          autoShareSignatureRef.current = signature;
          showShareInfo("Imagen final lista.", 3500);
        } else {
          showShareInfo("No se pudo subir la imagen. Compartiendo sin preview.", 4000);
        }
        return uploaded || null;
      } catch {
        showShareInfo("No se pudo generar la tarjeta.", 4000);
        return null;
      } finally {
        autoShareInFlightRef.current = false;
      }
    },
    [
      API_BASE_URL,
      authSession?.access_token,
      buildSavePayload,
      buildShareCardPayload,
      buildShareUrl,
      showShareInfo,
      captureShareCardBlob,
      championTeam,
      currentSaveId,
      ensureGuestMeta,
      isViewOnly,
      persistGuestSave,
      requireAuthUserId,
      runnerUpTeam,
      saveName,
      thirdPlaceWinner,
      uploadShareCard,
    ],
  );
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
    if (isViewOnly || !championTeam) return;
    void ensureShareCardReady("auto");
  }, [isViewOnly, championTeam, runnerUpTeam, thirdPlaceWinner, ensureShareCardReady]);

  const applyWinner = (matchId: string, team?: Team) => {
    if (isViewOnly) return;
    if (isPhaseLocked("llaves")) return;
    if (isMatchBlockedByDeadline(matchId)) return;
    if (!team) return;

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
    }
  };

  const handleR32Pick = (matchId: string, team?: Team) => {
    applyWinner(matchId, team);
  };

  const generateUniqueCode = () =>
    `FM-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

  const buildFileNameWithCode = (base: string, code?: string | null) => (code ? `${base}-${code}` : base);

  const shareCaptures = async (
    platform: "whatsapp" | "facebook" | "instagram" | "tiktok" | "x",
    champion?: Team,
  ) => {
    trackEvent("share_click", {
      platform,
      view_mode: isViewOnly ? "view_only" : "interactive",
      is_embedded: isEmbedded,
      is_share: isSharePath,
    });
    showShareInfo("Generando tarjeta...", 0);
    ensureGuestMeta();
    let shareUploadId: string | null = null;
    let shareUploadCode: string | undefined;
    let sharePageUrl = buildSharePageUrl(viewBracketId || currentSaveId || "", API_BASE_URL || undefined);
    let viewUrl = buildShareUrl(isViewOnly ? viewBracketId : currentSaveId);
    let overrides:
      | {
          bracketId: string;
          guestCode?: string;
          sharePageUrl?: string;
        }
      | undefined;

    if (!isViewOnly) {
      const saved = await handleConfirmSave({ source: "share", skipShareCard: true });
      if (!saved.ok) {
        setShareInfo(saved.error || "No pudimos guardar tu bracket.");
        return;
      }
      if (shareAssetRef.current?.bracketId && shareAssetRef.current.bracketId !== saved.bracketId) {
        setShareAsset(null);
        shareAssetRef.current = null;
        autoShareSignatureRef.current = "";
      }
      shareUploadId = saved.bracketId;
      shareUploadCode = saved.guestCode;
      sharePageUrl = saved.shareUrl || buildSharePageUrl(saved.bracketId, API_BASE_URL || undefined);
      viewUrl = sharePageUrl || viewUrl;
      overrides = {
        bracketId: saved.bracketId,
        guestCode: saved.guestCode,
        sharePageUrl,
      };
    }

    if (!shareAssetRef.current?.shareCardUrl) {
      await ensureShareCardReady("share", overrides);
    }

    const cachedSharePageUrl = shareAssetRef.current?.sharePageUrl;
    if (cachedSharePageUrl) {
      sharePageUrl = cachedSharePageUrl;
      viewUrl = cachedSharePageUrl;
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
      if (shareAssetRef.current?.shareCardUrl && shareAssetRef.current?.sharePageUrl) {
        const cached = shareAssetRef.current;
        const shareTargetUrl = cached.sharePageUrl || shareTarget;
        const finalMessage = baseMessage.replace(shareTarget, shareTargetUrl || shareTarget);
        const fileName = buildFileNameWithCode("Fanatico-Mundialista-Pronostico", generateUniqueCode());
        try {
          showShareInfo("Usando imagen guardada...", 0);
          const blob = await fetchShareCardBlob(cached.shareCardUrl);
          const file = new File([blob], `${fileName}.png`, { type: "image/png" });
          const canShareFile = !!(navigator.canShare && navigator.canShare({ files: [file] }));
          if (canShareFile && navigator.share) {
            await navigator.share({ files: [file], title: shareTitle, text: finalMessage, url: shareTargetUrl });
            showShareInfo("Compartido con imagen guardada.", 3000);
            return;
          }
          showShareInfo("Usando enlace guardado.", 2500);
          return;
        } catch {
          // fallback to normal capture/upload path below
        }
      }
      const blob = await captureShareCardBlob(payload);
      let finalSharePageUrl = shareTarget;
      if (!isViewOnly && shareUploadId) {
        try {
          showShareInfo("Subiendo imagen...", 0);
          const uploaded = await uploadShareCard(blob, shareUploadId, shareUploadCode);
          if (uploaded?.sharePageUrl) finalSharePageUrl = uploaded.sharePageUrl;
          if (uploaded?.shareCardUrl) {
            const signature = [
              shareUploadId,
              championTeam?.id || "",
              runnerUpTeam?.id || "",
              thirdPlaceWinner?.id || "",
            ].join("|");
            setShareAsset({
              shareCardUrl: uploaded.shareCardUrl,
              sharePageUrl: uploaded.sharePageUrl || finalSharePageUrl,
              bracketId: shareUploadId,
              guestCode: shareUploadCode,
              signature,
            });
            autoShareSignatureRef.current = signature;
          }
          showShareInfo("Imagen subida.", 3000);
        } catch {
          // ignore upload failures and continue with local URL
          showShareInfo("No se pudo subir la imagen. Compartiendo sin preview.", 4000);
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
      showShareInfo("No pudimos generar la tarjeta para compartir.", 4000);
      setShareInfo("No pudimos preparar la captura para compartir. Intenta de nuevo o haz captura manual.");
      // eslint-disable-next-line no-console
      console.error(err);
    } finally {
      setActiveShareCard(null);
    }
  };

  const downloadBracketImage = async () => {
    trackEvent("download_bracket_start", {
      view_mode: isViewOnly ? "view_only" : "interactive",
    });
    showShareInfo("Generando descarga...", 0);
    if (!shareAssetRef.current?.shareCardUrl) {
      await ensureShareCardReady("share");
    }
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
      if (shareAssetRef.current?.shareCardUrl) {
        try {
          showShareInfo("Descargando imagen guardada...", 0);
          const blob = await fetchShareCardBlob(shareAssetRef.current.shareCardUrl);
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
          showShareInfo("Descarga lista.", 3000);
          trackEvent("download_bracket_success", {
            view_mode: isViewOnly ? "view_only" : "interactive",
          });
          return;
        } catch {
          // fallback to capture
        }
      }
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
      showShareInfo("Descarga lista.", 3000);
      trackEvent("download_bracket_success", {
        view_mode: isViewOnly ? "view_only" : "interactive",
      });
    } catch (err) {
      showShareInfo("No se pudo generar la descarga.", 4000);
      trackEvent("download_bracket_error", {
        view_mode: isViewOnly ? "view_only" : "interactive",
      });
      setShareInfo("No pudimos generar la imagen para descargar. Intenta de nuevo.");
      // eslint-disable-next-line no-console
      console.error(err);
    } finally {
      setActiveShareCard(null);
    }
  };

  const authSlot = null;
  const authSlotMobile = null;
  const showAuthCta = !isViewOnly && !isEmbedded;
  const authMeta = (authUser?.user_metadata || {}) as Record<string, any>;
  const authAlias =
    authMeta.alias || authMeta.nickname || authMeta.full_name || authMeta.name || authUser?.email || "Usuario";
  const authAvatar = authMeta.avatar_url || authMeta.picture || authMeta.avatar || "";
  const authModalTitle =
    authIntent === "save"
      ? authMode === "signup"
        ? "Crea tu cuenta y guarda tu juego"
        : "Inicia sesion y guarda tu juego"
      : authMode === "signup"
        ? "Crear usuario"
        : "Iniciar sesion";
  const authModalDescription =
    authIntent === "save"
      ? "Tu partida quedara guardada en tu perfil apenas la sesion quede lista. Mientras tanto la conservamos en este dispositivo."
      : "Crea tu cuenta directamente con Google. Usaremos los datos del proveedor.";
  const authModalSubmitLabel =
    authIntent === "save"
      ? authMode === "signup"
        ? "Crear cuenta y guardar"
        : "Entrar y guardar"
      : authMode === "signup"
        ? "Crear cuenta"
        : "Iniciar sesion";
  const authCtaPortal =
    showAuthCta && typeof document !== "undefined"
      ? createPortal(
          <div className="auth-fab" ref={authFabRef}>
            <div className="relative">
              <button
                type="button"
                onClick={() => setAuthFabOpen((prev) => !prev)}
                className="auth-fab__button"
                aria-expanded={authFabOpen}
                aria-label={authUser ? "Cuenta" : "Iniciar sesión"}
              >
                {authUser ? (
                  <>
                    {authAvatar ? (
                      <img src={authAvatar} alt={authAlias} className="auth-fab__avatar" />
                    ) : (
                      <span className="auth-fab__initial">
                        {authAlias.trim().charAt(0).toUpperCase()}
                      </span>
                    )}
                    <span className="auth-fab__label">Cuenta</span>
                  </>
                ) : (
                  <>
                    <img src={userIcon} alt="Usuario" className="auth-fab__icon" />
                    <span className="auth-fab__label">Iniciar sesión</span>
                  </>
                )}
              </button>
              {authFabOpen && (
                <div className="auth-fab__panel">
                  {authUser ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setAuthFabOpen(false);
                          navigateTo("backend");
                        }}
                        className="auth-fab__action"
                      >
                        Cuenta
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAuthFabOpen(false);
                          handleSignOut();
                        }}
                        className="auth-fab__action auth-fab__action--primary"
                      >
                        Cerrar sesión
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setAuthFabOpen(false);
                          openAuthModal("login");
                        }}
                        className="auth-fab__action"
                      >
                        Iniciar sesión
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAuthFabOpen(false);
                          openAuthModal("signup");
                        }}
                        className="auth-fab__action auth-fab__action--primary"
                      >
                        Crear usuario
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>,
          document.body,
        )
      : null;

  const shareButtons = [
    { key: "whatsapp", icon: whatsappIcon, alt: "WhatsApp", platform: "whatsapp" as const },
    { key: "facebook", icon: facebookIcon, alt: "Facebook", platform: "facebook" as const },
    { key: "x", icon: xIcon, alt: "X", platform: "x" as const },
    { key: "instagram", icon: instagramIcon, alt: "Instagram", platform: "instagram" as const },
  ];

  const handleNativeShare = useCallback(
    async (targetChampion?: Team) => {
      if (typeof window === "undefined" || !navigator.share) {
        showShareInfo("Compartir no está disponible en este dispositivo.", 3000);
        return;
      }
      try {
        showShareInfo("Preparando para compartir...", 0);
        let saved: SaveResult | null = null;
        if (!isViewOnly) {
          saved = await handleConfirmSave({ source: "share", skipShareCard: true });
          if (!saved.ok) {
            showShareInfo(saved.error || "No pudimos guardar tu bracket.", 3000);
            return;
          }
          if (shareAssetRef.current?.bracketId && shareAssetRef.current.bracketId !== saved.bracketId) {
            setShareAsset(null);
            shareAssetRef.current = null;
            autoShareSignatureRef.current = "";
          }
        }
        const overrides =
          saved && saved.ok
            ? {
                bracketId: saved.bracketId,
                guestCode: saved.guestCode,
                sharePageUrl: saved.shareUrl,
              }
            : undefined;
        if (!shareAssetRef.current?.shareCardUrl) {
          await ensureShareCardReady("share", overrides);
        }
        const shareUrl =
          overrides?.sharePageUrl ||
          shareAssetRef.current?.sharePageUrl ||
          buildSharePageUrl(
            overrides?.bracketId || shareAssetRef.current?.bracketId || currentSaveId || viewBracketId || "",
            API_BASE_URL || undefined,
          ) ||
          window.location.href;
        const championPick = targetChampion || championTeam;
        const messageParts = [
          `Mi pronóstico Mundialista: campeón ${championPick?.nombre || "Por definir"}.`,
          runnerUpTeam?.nombre ? `Segundo: ${runnerUpTeam.nombre}.` : "",
          thirdPlaceWinner?.nombre ? `Tercero: ${thirdPlaceWinner.nombre}.` : "",
          `Mira mi cuadro aquí: ${shareUrl}`,
        ].filter(Boolean);
        const text = messageParts.join(" ");
        const title = "Mi pronóstico Mundialista";

        if (shareAssetRef.current?.shareCardUrl) {
          try {
            const blob = await fetchShareCardBlob(shareAssetRef.current.shareCardUrl);
            const file = new File([blob], "pronostico.png", { type: "image/png" });
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
              await navigator.share({ title, text, url: shareUrl, files: [file] });
              showShareInfo("Compartido.", 3000);
              return;
            }
          } catch {
            // fallback to text-only share
          }
        }

        await navigator.share({ title, text, url: shareUrl });
        showShareInfo("Compartido.", 3000);
      } catch {
        showShareInfo("No se pudo compartir.", 3000);
      }
    },
    [
      API_BASE_URL,
      championTeam,
      currentSaveId,
      handleConfirmSave,
      ensureShareCardReady,
      fetchShareCardBlob,
      isViewOnly,
      runnerUpTeam?.nombre,
      thirdPlaceWinner?.nombre,
      viewBracketId,
      showShareInfo,
    ],
  );

  const renderShareRow = (targetChampion?: Team, disabled?: boolean, includeDownload = true, includeSave = true) => {
    if (isViewOnly) return null;
    return (
      <div className="flex flex-col items-center gap-2">
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => handleNativeShare(targetChampion)}
            disabled={disabled}
            className={`md:hidden px-4 py-2 rounded-full bg-[#c6f600] text-black text-xs font-bold ${
              disabled ? "opacity-60 cursor-not-allowed" : "hover:brightness-95"
            }`}
          >
            Compartir
          </button>
          <div className="hidden md:flex items-center gap-2">
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
          </div>
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
        {shareInfo && <span className="text-xs text-gray-400">{shareInfo}</span>}
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
  const sfComplete = useMemo(
    () => sf.length > 0 && sf.every((m) => !!picks[m.id]),
    [sf, picks],
  );
  const menuSteps = useMemo(
    () =>
      [
        { id: "repechajes" as BracketTab, completed: repechajesLocked || phaseDeadlineLocked.repechajes },
        { id: "grupos" as BracketTab, completed: groupCompletion.complete || phaseDeadlineLocked.grupos },
        { id: "dieciseisavos" as BracketTab, completed: r32Complete || phaseDeadlineLocked.dieciseisavos },
        { id: "llaves" as BracketTab, completed: finalComplete || phaseDeadlineLocked.llaves },
      ].filter((step) => !deadlineHiddenTabs[step.id]),
    [
      repechajesLocked,
      groupCompletion.complete,
      r32Complete,
      finalComplete,
      phaseDeadlineLocked.repechajes,
      phaseDeadlineLocked.grupos,
      phaseDeadlineLocked.dieciseisavos,
      phaseDeadlineLocked.llaves,
      isViewOnly,
      deadlineHiddenTabs,
    ],
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
        setActiveTab(defaultStartTab);
        return;
      }
      if (isViewOnly) return;
      if (!thirdsComplete && !phaseDeadlineLocked.grupos) {
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
    }, [thirdsComplete, phaseDeadlineLocked.grupos, activeTab, showNewGamePrompt, isViewOnly, defaultStartTab]);

  useEffect(() => {
    if (activeTab === "dieciseisavos") {
      setActiveR32Tab("llave1");
    }
  }, [activeTab]);
  const prevR32TabRef = useRef(activeR32Tab);
  useEffect(() => {
    if (isViewOnly) return;
    const prev = prevR32TabRef.current;
    if (activeTab === "dieciseisavos" && prev !== activeR32Tab) {
      requestAnimationFrame(() => scrollToTop());
    }
    prevR32TabRef.current = activeR32Tab;
  }, [activeTab, activeR32Tab, scrollToTop, isViewOnly]);

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
              locked={isPhaseLocked("dieciseisavos")}
              mirror={mirror}
              seedLabel={getSeedLabelR32}
              scoreByMatchId={scoreByMatchId}
              isMatchLocked={isMatchBlockedByDeadline}
            />,
        );
      }
      return items;
    },
    [isMatchBlockedByDeadline, isPhaseLocked, scheduleByMatch, scoreByMatchId],
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
        return;
      }
      const nextChampion =
        finalMatch?.equipoA?.id === finalPick ? finalMatch.equipoA : finalMatch?.equipoB;
      if (nextChampion && championTeam?.id !== nextChampion.id) {
        setChampionTeam(nextChampion);
      }
    }, [picks, final, championTeam, showChampionModal]);

  useEffect(() => {
    if (isViewOnly || showNewGamePrompt || activeTab !== "llaves") return;
    if (!sfComplete) {
      semifinalPromptShownRef.current = false;
      setShowSemifinalPrompt(false);
      return;
    }
    if (picks["third-103"] || picks["final-104"]) {
      setShowSemifinalPrompt(false);
      semifinalPromptShownRef.current = true;
      return;
    }
    if (semifinalPromptShownRef.current) return;
    semifinalPromptShownRef.current = true;
    setShowSemifinalPrompt(true);
  }, [activeTab, isViewOnly, picks, sfComplete, showNewGamePrompt]);

    const anyModalOpen =
      showThirdsModal ||
      !!showFixturesGroup ||
      showRulesModal ||
      showR32Warning ||
      showSemifinalPrompt ||
      !!phaseBlock ||
      showIntercontinentalModal ||
      showAuthModal ||
      showSaveModal ||
      showChampionModal ||
      showNewGamePrompt;
    useBodyScrollLock(anyModalOpen);

  useEffect(() => {
    if (!anyModalOpen) return;
    const handler = () => {
      setShowThirdsModal(false);
      setShowFixturesGroup(undefined);
      setShowRulesModal(false);
      setShowR32Warning(false);
      setShowSemifinalPrompt(false);
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
    anyModalOpen,
    showThirdsModal,
    showFixturesGroup,
    showRulesModal,
    showR32Warning,
    showSemifinalPrompt,
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
    const overlayRef = useRef<HTMLDivElement>(null);
    const currentRule = rulesSteps[rulesStep];
    const isLastRule = rulesStep >= rulesSteps.length - 1;
    const isFirstRule = rulesStep === 0;
    if (!open) return null;
    return (
      <div
        ref={overlayRef}
        onClick={(e) => {
          if (e.target === overlayRef.current) onClose();
        }}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-10 flex items-start md:items-center justify-center px-4 py-6 overflow-y-auto"
      >
      <ModalFlipFrame disableFlip className="bg-neutral-900 border border-neutral-700 rounded-lg w-full md:w-2/3 max-w-2xl shadow-lg flex flex-col overflow-hidden modal-glow">
        <div className="w-full overflow-hidden border-b border-neutral-700" style={{ aspectRatio: "16 / 9" }}>
          <img src={rulesBanner} alt="Reglas" className="w-full h-full object-cover" />
        </div>
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-3xl font-black  text-[#c6f600]">¿Cómo jugar?</h3>
            <button onClick={onClose} className="text-sm text-gray-900 bg-[#c6f600] hover:text-black rounded-full w-6 h-6 flex items-center justify-center">X</button>
          </div>
          
          <div className="mb-2 flex gap-2">
            {rulesSteps.map((_, index) => (
              <span
                key={`rule-step-${index}`}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  index <= rulesStep ? "bg-[#c6f600]" : "bg-white/10"
                }`}
              />
            ))}
          </div>
          <div className="w-full overflow-hidden">
            <AnimatePresence mode="wait" custom={rulesStepDirection} initial={false}>
              <motion.div
                key={`rule-slide-${rulesStep}`}
                custom={rulesStepDirection}
                initial={(direction) => ({
                  opacity: 0,
                  x: direction > 0 ? 56 : -56,
                })}
                animate={{
                  opacity: 1,
                  x: 0,
                }}
                exit={(direction) => ({
                  opacity: 0,
                  x: direction > 0 ? -56 : 56,
                })}
                transition={{ duration: 0.28, ease: "easeOut" }}
                className="w-full rounded-2xl border border-white/10 bg-black/30 p-2 md:p-6"
              >
                <div className="flex items-start gap-4">
                  <span className="flex-shrink-0 font-black text-[#c6f600] rounded-full px-3 py-1 bg-black">
                    {`${rulesStep + 1}.`}
                  </span>
                  <div className="space-y-3">
                    <h4 className="text-2xl font-black text-white">{currentRule.title}</h4>
                    <p className="text-base text-gray-200 leading-relaxed text-balance">{currentRule.body}</p>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
          <div className="mt-4 flex justify-center">
            <ins data-revive-zoneid="31" data-revive-id="60f0b66ffc0f4db66aaad1c14934c701"></ins>
          </div>
          <div className="mt-4 flex flex-col items-center gap-3">
            <div className="flex w-full items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setRulesStepDirection(-1);
                  setRulesStep((prev) => Math.max(prev - 1, 0));
                }}
                disabled={isFirstRule}
                className="px-5 py-2 rounded-md border border-white/15 bg-white/5 text-white font-semibold hover:border-white/30 hover:bg-white/10 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Atrás
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 rounded-md border border-white/15 bg-white/5 text-white font-semibold hover:border-white/30 hover:bg-white/10 transition"
              >
                Skip
              </button>
              <button
                onClick={() => {
                  if (isLastRule) {
                    onClose();
                    return;
                  }
                  setRulesStepDirection(1);
                  setRulesStep((prev) => Math.min(prev + 1, rulesSteps.length - 1));
                }}
                className="flex-1 px-6 py-2 rounded-md bg-[#c6f600] text-black font-semibold hover:brightness-95"
              >
                {isLastRule ? "Empezar" : "Siguiente"}
              </button>
            </div>
            
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
          <ul className="grid grid-cols-3 gap-2 list-disc intems-center text-lg text-gray-200">
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

  const SemifinalPromptModal = ({
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
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-start md:items-center justify-center px-4 py-6 overflow-y-auto"
      >
        <ModalFlipFrame className="bg-neutral-900 border border-neutral-700 rounded-lg w-full md:w-1/2 max-w-xl shadow-lg flex flex-col overflow-hidden modal-glow">
          <div className="w-full overflow-hidden border-b border-neutral-700" style={{ aspectRatio: "16 / 9" }}>
            <img src={championBanner} alt="Semifinales completas" className="w-full h-full object-cover" />
          </div>
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-3xl text-balance uppercase font-black leading-none text-[#c6f600]">
                Es hora de elegir a tu campeón
              </h3>
              <button
                onClick={onClose}
                className="text-sm text-gray-900 bg-[#c6f600] hover:text-black rounded-full w-6 h-6 flex items-center justify-center"
              >
                X
              </button>
            </div>
            <p className="text-base text-gray-300 text-balance">
            Define al tercer lugar <span className="font-bold text-[#c6f600]">(bronce)</span> y luego elige tu <span className="font-bold text-[#c6f600]">campeón</span> del mundial!.
            </p>
            <div className="mt-4 text-center">
              <button
                onClick={onClose}
                className="px-8 py-2 rounded-md bg-[#c6f600] text-black font-semibold hover:brightness-95"
              >
                Elegir bronce y campeón
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

  const isGuestShared = !viewSharedBy?.userId;
  const showGuestCodeSticky =
    !isViewOnly && !authSession?.access_token && !!guestSharePanel && !!championTeam && !anyModalOpen;

  return (
     <div className=" bg-neutral-900">
    <div
      className={`max-w-7xl mx-auto bg-neutral-900 text-white p-2 md:px-36 flex flex-col gap-8 bracket-stable ${
        showAuthCta ? "with-auth-cta" : ""
      } ${isSharePath && !isEmbedded ? "with-share-cta" : ""} ${showGuestCodeSticky ? "with-guest-code" : ""}`}
    >
      {!isEmbedded && <Header authSlot={authSlot} showNav={isSharePath} showSearch={false} />}
      <main className="max-w-7xl px-2 sm:px-6 lg:px-10 xl:px-16">
          <div className="max-w-7xl mx-auto">
            {showSharedHeader && (
              <div className="mb-6 flex flex-col lg:flex-row gap-4 items-stretch">
                <div className="flex-1 rounded-2xl  rounded-xl  overflow-hidden">
                  <div
                    className="relative h-40"
                    style={{
                      backgroundImage: `url(${viewSharedBy?.coverUrl || guestCover})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }}
                  >
                    <div className="absolute -left-16 -bottom-16 w-40 h-40 rounded-full bg-[#c6f600]/20 blur-3xl" />
                    <div className="absolute right-0 top-0 w-32 h-32 rounded-full bg-white/10 blur-3xl" />
                  </div>
                  {!isGuestShared && (
                    <div className="relative px-4 pb-4 rounded">
                      <div className="flex items-center gap-4 mt-4 justify-center items-center">
                        <div className="relative w-24 h-24 rounded-full overflow-hidden border-4 border-neutral-900 bg-neutral-800 shrink-0">
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
                        
                          <span className="text-xs uppercase bg-[#c6f600]  tracking-wider text-black px-2 rounded">
                            Pronóstico compartido por:
                          </span>
                          
                          <span className="text-5xl md:text-3xl font-black text-white">
                            {viewSharedBy?.alias || viewSharedBy?.name || "Usuario"}
                          </span>
                          
                        </div>
                      </div>
                      
                    </div>
                  )}
                </div>
                <div className="w-full lg:w-auto flex justify-center">
                  <ShareCard
                    coverUrl={championBanner}
                    champion={viewSharePayload.champion}
                    runnerUp={viewSharePayload.runnerUp}
                    third={viewSharePayload.third}
                    shareUrl={viewSharePayload.shareUrl}
                    variant="spin"
                  />
                </div>
              </div>
            )}
            <div className={isViewOnly ? " select-none" : ""}>
            {!isViewOnly && (
              <>
                {authSlotMobile && <div className="md:hidden flex justify-end mb-3">{authSlotMobile}</div>}
                {authSlot && <div className="hidden md:flex justify-end mb-3">{authSlot}</div>}
                <div className="flex items-center gap-3 ">
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
            <div className="flex items-center mb-3 overflow-x-auto flex-nowrap scrollbar-hide">
            {!deadlineHiddenTabs.repechajes && (
              <button
                type="button"
                onClick={() => setActiveTab("repechajes")}
                className={`px-3 py-2 rounded-b-xl rounded-t-none whitespace-nowrap text-base font-semibold transition ${
                  activeTab === "repechajes"
                    ? "bg-[#c6f600] text-black "
                    : " text-gray-400 hover:text-white"
                }`}
              >
                Liguilla de Repechajes
              </button>
            )}
            {!deadlineHiddenTabs.grupos && (
              <button
                type="button"
                onClick={() => (isViewOnly ? setActiveTab("grupos") : goToGroupsIfReady())}
                className={`px-3 py-2 rounded-b-xl rounded-t-none whitespace-nowrap text-base font-semibold transition ${
                  activeTab === "grupos"
                    ? "bg-[#c6f600] text-black text-base "
                    : "text-gray-400"
                }`}
              >
                Fase de grupos
              </button>
            )}
            {!deadlineHiddenTabs.dieciseisavos && (
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
                className={`px-3 py-2 rounded-b-xl rounded-t-none whitespace-nowrap text-base font-semibold transition ${
                  activeTab === "dieciseisavos"
                    ? "bg-[#c6f600] text-black "
                    : "text-gray-400 hover:text-white"
                }`}
            >
              Eliminatorias
            </button>
            )}
            {!deadlineHiddenTabs.llaves && (
              <button
                type="button"
                onClick={() => (isViewOnly ? setActiveTab("llaves") : goToLlavesIfReady())}
                className={`px-3 py-2 rounded-b-xl rounded-t-none whitespace-nowrap text-base font-semibold transition ${
                  activeTab === "llaves"
                    ? "bg-[#c6f600] text-black "
                    : "border-neutral-700 text-gray-400 hover:text-white"
                }`}
              >
                Llaves finales
              </button>
            )}
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

            <AnimatePresence>
              {showGuestCodeSticky && guestSharePanel && (
                <motion.div
                  key={`guest-code-${guestSharePanel.code}`}
                  className="guest-code-bar"
                  initial={{ opacity: 0, y: 42 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 92 }}
                  transition={{ duration: 0.28, ease: "easeInOut" }}
                >
                <div className="guest-code-bar__inner">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-2xl font-semibold text-center">Tu código de juego</span>
                    <button
                      type="button"
                      onClick={() => setGuestSharePanel(null)}
                      className="text-base font-bold px-2 text-black hover:text-white bg-[#c6f600] rounded-full"
                    >
                      X
                    </button>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="font-mono text-2xl font-black text-[#c6f600]">{guestSharePanel.code}</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(guestSharePanel.code, "Código")}
                      className="px-2 py-1 rounded-md border border-neutral-700 text-xs font-semibold text-gray-200 hover:border-[#c6f600]"
                    >
                      Copiar código
                    </button>
                  </div>
                  {guestSharePanel.url && (
                    <div className="mt-2 flex flex-col sm:flex-row sm:items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={guestSharePanel.url}
                        className="w-full flex-1 rounded-full text-center bg-neutral-900 border border-neutral-800 px-2 py-1 text-sm md:text-lg text-gray-300"
                      />
                      <div className="flex items-center  gap-2">
                        <button
                          type="button"
                          onClick={() => copyToClipboard(guestSharePanel.url, "Enlace")}
                          className="px-2 py-1 w-1/2 rounded-full bg-[#c6f600] text-sm font-semibold text-black hover:border-[#c6f600] hover:bg-black"
                        >
                          Copiar enlace
                        </button>
                        <a
                          href={guestSharePanel.url}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2 py-1 w-1/2 text-center rounded-full border border-neutral-700 text-xs font-semibold text-gray-200 hover:border-[#c6f600]"
                        >
                          Abrir
                        </a>
                      </div>
                    </div>
                  )}
                  <p className="mt-2 text-xs text-gray-400">Guárdalo. Expira en 7 días.</p>
                </div>
                </motion.div>
            )}
            </AnimatePresence>

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

              {isEmbedded && !isViewOnly ? (
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
                  {!(isEmbedded && isViewOnly) && (
                    <div className="flex  items-center gap-2 justify-center w-full">
                      <button
                        type="button"
                        onClick={() => handlePlayoffTabClick("uefa")}
                        className={`px-5 py-3 rounded-full text-base  md:text-lg font-bold tracking-wide w-1/2 transition ${
                          activePlayoffTab === "uefa"
                            ? "bg-[#c6f600] text-black  "
                            : " text-gray-200 bg-neutral-900/70 hover:text-white "
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
                  )}
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
                                  disabled={isPhaseLocked("intercontinental") || phaseDeadlineLocked.repechajes}
                                  showFinalHint={showRepechajeFinalHint}
                                  scoreByMatchId={scoreByMatchId}
                                  isMatchLocked={isMatchBlockedByDeadline}
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
                                  disabled={isPhaseLocked("uefa") || phaseDeadlineLocked.repechajes}
                                  showFinalHint={showRepechajeFinalHint}
                                  scoreByMatchId={scoreByMatchId}
                                  isMatchLocked={isMatchBlockedByDeadline}
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
                    <p className="text-sm text-gray-400 py-1">
                      Mientras sigas en esta fase, puedes tocar un equipo ya marcado para quitarlo y volver a elegir.
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
                          disabled={isPhaseLocked("grupos") || phaseDeadlineLocked.grupos}
                          onClick={() => handlePick(grupo, team)}
                          className={`flex items-center justify-between gap-1 rounded-md px-2 py-1 transition-colors ${
                            picked ? "bg-[#c6f600] text-black" : "border-neutral-700 hover:border-[#c6f600]"
                          } ${isPhaseLocked("grupos") || phaseDeadlineLocked.grupos ? "opacity-60 cursor-not-allowed" : ""}`}
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
                {isPhaseLocked("grupos")
                  ? "Esta fase ya quedó en solo lectura. Puedes revisarla, pero no editarla."
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
                  locked={isPhaseLocked("llaves")}
                  navTarget={bracketNavTarget}
                  onNavHandled={clearBracketNavTarget}
                  scoreByMatchId={scoreByMatchId}
                  isMatchLocked={isMatchBlockedByDeadline}
                  highlightFinalMatch={sfComplete}
                  onChampionClick={(team) => {
                    if (!team) return;
                    setChampionTeam(team);
                    setShowChampionModal(true);
                  }}
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
      {isSharePath && !isEmbedded && (
        <div className="share-cta-bar">
          <div className="bg-black/60 shadow-xl backdrop-blur-sm rounded-full px-4 py-2 flex items-center justify-between max-w-md mx-auto">
            <div className="text-xl leading-none text-balance w-2/3 px-2">¿Quieres hacer tu pronóstico?</div>
            <button
              type="button"
              onClick={goNewBracket}
              className="w-1/3 px-4 py-2 rounded-full uppercase bg-[#c6f600] text-black text-xl font-black hover:brightness-95"
            >
              Jugar
            </button>
          </div>
        </div>
      )}
        <NewGamePromptModal
          open={showNewGamePrompt && !isViewOnly}
          onCancel={() => {
            setShowNewGamePrompt(false);
    setActiveTab(defaultStartTab);
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
          isLocked={isPhaseLocked("grupos") || phaseDeadlineLocked.grupos}
          onToggleTeam={toggleThirdChoice}
        />
        <R32InfoModal
          open={showR32Warning && !showNewGamePrompt && !isViewOnly}
          title="Calma"
          message="Los partidos de octavos de final se jugarán en las llaves finales."
          onClose={() => setShowR32Warning(false)}
        />
        <SemifinalPromptModal
          open={showSemifinalPrompt && !showNewGamePrompt && !isViewOnly}
          onClose={() => setShowSemifinalPrompt(false)}
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
          title={authModalTitle}
          description={authModalDescription}
          submitLabel={authModalSubmitLabel}
          googleClientId={GOOGLE_CLIENT_ID || undefined}
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
          onGoogleCredential={handleGoogleCredential}
        />
        <SaveModal
          open={showSaveModal && !showNewGamePrompt && !isViewOnly}
          onClose={closeSaveModal}
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
          allowOverwrite={false}
          guestShare={!authSession?.access_token ? guestSharePanel : null}
          onCopy={copyToClipboard}
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
            <div
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={closeIntercontinentalModal}
              aria-hidden="true"
            />
            <div className="pointer-events-none">
              <Confetti
                key={intercontinentalConfettiKey}
                width={width || 0}
                height={height || 0}
                recycle={false}
                numberOfPieces={320}
              />
            </div>
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
              >
                <img className="modal-flip-back__logo" src={shareBackLogo} alt="7flapollalog" />
              </div>
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
            <div
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setShowChampionModal(false)}
              aria-hidden="true"
            />
            <div className="pointer-events-none">
              <Confetti
                key={confettiKey}
                width={width || 0}
                height={height || 0}
                recycle={false}
                numberOfPieces={450}
              />
            </div>
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
              <div
                ref={championMotionRef}
                className={`modal-flip-tilt${isChampionDragging ? " is-dragging" : ""}`}
                style={{ touchAction: "pan-y" }}
                onPointerEnter={handleChampionPointerEnter}
                onPointerLeave={handleChampionPointerLeave}
                onPointerDown={handleChampionPointerDown}
                onPointerMove={handleChampionPointerMove}
                onPointerUp={handleChampionPointerUp}
                onPointerCancel={handleChampionPointerCancel}
              >
              <div className="modal-flip-card">
              <div
                className="modal-flip-back w-full max-w-lg mx-auto bg-neutral-900 text-white rounded-xl border border-neutral-700 shadow-2xl flex flex-col text-center overflow-hidden modal-glow"
                aria-hidden="true"
              >
                <img className="modal-flip-back__logo" src={shareBackLogo} alt="7flapollalog" />
              </div>
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
                          className="absolute inset-0 w-full h-full object-cover "
                        />
                      ) : (
                        <span className="absolute inset-0 flex items-center justify-center text-[10px]  text-gray-200">
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
                        {authSession?.access_token ? "Guardar juego" : "Crear cuenta y guardar"}
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
              </div>
            </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    {authCtaPortal}
    </div>
  );
}
