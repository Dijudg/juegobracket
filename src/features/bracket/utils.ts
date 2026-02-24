import type { Team } from "./types";

const FLAG_CDN_BASE = "https://flagcdn.com/w80";

const REPECHAJE_TEAM_META: Record<string, { nombre: string; flagCode: string }> = {
  NCL: { nombre: "Nueva Caledonia", flagCode: "nc" },
  JAM: { nombre: "Jamaica", flagCode: "jm" },
  COD: { nombre: "RD Congo", flagCode: "cd" },
  BOL: { nombre: "Bolivia", flagCode: "bo" },
  SUR: { nombre: "Surinam", flagCode: "sr" },
  IRQ: { nombre: "Irak", flagCode: "iq" },
  ITA: { nombre: "Italia", flagCode: "it" },
  NIR: { nombre: "Irlanda del Norte", flagCode: "gb-nir" },
  WAL: { nombre: "Gales", flagCode: "gb-wls" },
  BIH: { nombre: "Bosnia y Herzegovina", flagCode: "ba" },
  UKR: { nombre: "Ucrania", flagCode: "ua" },
  SWE: { nombre: "Suecia", flagCode: "se" },
  POL: { nombre: "Polonia", flagCode: "pl" },
  ALB: { nombre: "Albania", flagCode: "al" },
  TUR: { nombre: "Turquía", flagCode: "tr" },
  ROU: { nombre: "Rumania", flagCode: "ro" },
  SVK: { nombre: "Eslovaquia", flagCode: "sk" },
  KOS: { nombre: "Kosovo", flagCode: "xk" },
  DEN: { nombre: "Dinamarca", flagCode: "dk" },
  MKD: { nombre: "Macedonia del Norte", flagCode: "mk" },
  CZE: { nombre: "República Checa", flagCode: "cz" },
  IRL: { nombre: "Irlanda", flagCode: "ie" },
};

const REPECHAJE_TEAM_ALIASES: Record<string, string> = {
  NRL: "NIR",
};

const normalizeCode = (value?: string) => (value || "").trim().toUpperCase();

export const resolveRepechajeCode = (value?: string) => {
  const normalized = normalizeCode(value);
  if (!normalized) return "";
  return REPECHAJE_TEAM_ALIASES[normalized] || normalized;
};

export const getRepechajeMeta = (value?: string) => {
  const code = resolveRepechajeCode(value);
  return code ? REPECHAJE_TEAM_META[code] : undefined;
};

export const getRepechajeFlagUrl = (flagCode: string) => `${FLAG_CDN_BASE}/${flagCode}.png`;

export const getTeamEscudo = (team?: Team) => {
  if (!team) return undefined;
  const meta = getRepechajeMeta(team.codigo || team.id);
  if (meta) return getRepechajeFlagUrl(meta.flagCode);
  return team.escudo;
};

export const applyRepechajeMeta = (team: Team): Team => {
  const code = resolveRepechajeCode(team.codigo || team.id);
  const meta = code ? REPECHAJE_TEAM_META[code] : undefined;
  if (!meta) return team;
  return {
    ...team,
    id: team.id || code,
    codigo: team.codigo || code,
    nombre: meta.nombre,
    escudo: getRepechajeFlagUrl(meta.flagCode),
  };
};

export const ensureRepechajeTeams = (list: Team[]) => {
  const existingCodes = new Set<string>();
  list.forEach((t) => {
    const id = normalizeCode(t.id);
    const codigo = normalizeCode(t.codigo);
    if (id) existingCodes.add(id);
    if (codigo) existingCodes.add(codigo);
  });
  const extras: Team[] = [];
  Object.entries(REPECHAJE_TEAM_META).forEach(([code, meta]) => {
    if (!existingCodes.has(code)) {
      extras.push({
        id: code,
        codigo: code,
        nombre: meta.nombre,
        grupo: "",
        escudo: getRepechajeFlagUrl(meta.flagCode),
      });
    }
  });
  return extras.length ? [...list, ...extras] : list;
};

export const getTeamCode = (team?: Team) => team?.codigo || team?.id;

export const formatFixtureDate = (rawFecha?: string) => {
  if (!rawFecha) return "Por definir";
  const trimmed = rawFecha.trim();
  const parts = trimmed.split("/");
  if (parts.length === 3) {
    const [dStr, mStr, yStr] = parts;
    const d = Number(dStr);
    const m = Number(mStr);
    const y = Number(yStr.length === 2 ? 2000 + Number(yStr) : Number(yStr));
    if (Number.isFinite(d) && Number.isFinite(m) && Number.isFinite(y)) {
      const date = new Date(y, m - 1, d);
      if (date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d) {
        return date.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
      }
    }
  }
  return trimmed || "Por definir";
};
