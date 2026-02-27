const normalizeBase = (value?: string) => {
  const trimmed = (value || "").trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
};

const inferApiBaseFromHost = () => {
  if (typeof window === "undefined") return "";
  const host = window.location.hostname.toLowerCase();
  if (host === "localhost" || host === "127.0.0.1") {
    return "http://localhost:4000";
  }
  if (host.includes("vercel.app") || host.includes("juegobracket") || host.includes("eltelegrafo.com.ec")) {
    return "https://juegobracket-production.up.railway.app";
  }
  return window.location.origin;
};

export const resolveApiBase = (apiBaseUrl?: string) => {
  const fromParam = normalizeBase(apiBaseUrl);
  if (fromParam) return fromParam;
  const fromEnv = normalizeBase(
    import.meta.env.VITE_API_BASE_URL ||
      import.meta.env.VITE_API_URL ||
      import.meta.env.VITE_API_FALLBACK_URL ||
      "",
  );
  if (fromEnv) return fromEnv;
  return inferApiBaseFromHost();
};
