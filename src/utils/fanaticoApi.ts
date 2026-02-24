export type FanaticoAdConfig = {
  backgroundUrl?: string;
  fallbackImageUrl?: string;
  linkUrl?: string;
};

export type FanaticoConfig = {
  ads?: {
    medium?: FanaticoAdConfig;
    medium2?: FanaticoAdConfig;
  };
  sheets?: {
    teamsUrl?: string;
    fixturesUrl?: string;
  };
  updatedAt?: string;
};

export type FanaticoTeam = {
  id?: string;
  codigo_fixture?: string;
  seleccion?: string;
  grupo?: string;
  escudo_url?: string;
};

export type FanaticoFixture = {
  id_partido?: string;
  fecha?: string;
  hora?: string;
  fase?: string;
  grupo?: string;
  jornada?: string;
  local_id?: string;
  visita_id?: string;
  estadio?: string;
  locacion?: string;
  gol_local?: string | number;
  gol_visita?: string | number;
};

export type FanaticoDataResponse = {
  config?: FanaticoConfig;
  teams?: FanaticoTeam[];
  fixtures?: FanaticoFixture[];
  meta?: Record<string, unknown>;
};

const DEFAULT_PROJECT_ID = "pqumihrkmtoyztfbutmp";
const DEFAULT_API_PATH = "/functions/v1/make-server-e6b2381c";

const resolveApiBase = () => {
  const explicit = (import.meta.env.VITE_FM_API_URL as string | undefined)?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const projectId =
    (import.meta.env.VITE_SUPABASE_PROJECT_ID as string | undefined)?.trim() ||
    DEFAULT_PROJECT_ID;
  return `https://${projectId}.supabase.co${DEFAULT_API_PATH}`;
};

const API_BASE = resolveApiBase();

export const fetchFanaticoData = async (): Promise<FanaticoDataResponse | null> => {
  try {
    const res = await fetch(`${API_BASE}/fanatico/data`);
    if (!res.ok) return null;
    const payload = await res.json();
    if (!payload?.success) return null;
    return payload.data as FanaticoDataResponse;
  } catch {
    return null;
  }
};
