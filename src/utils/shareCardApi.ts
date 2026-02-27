import type { BracketSavePayload } from "../features/bracket/types";

type ShareCardUploadResult = {
  shareCardUrl: string;
  sharePageUrl: string;
};

type GuestShareResult = {
  id: string;
  sharePageUrl: string;
  expiresAt?: string;
  shortCode?: string;
};

const resolveApiBase = (apiBaseUrl?: string) => {
  const value = (apiBaseUrl || "").trim();
  if (value) {
    if (!/^https?:\/\//i.test(value)) return `https://${value}`;
    return value;
  }
  if (typeof window !== "undefined") return window.location.origin;
  return "";
};

export const uploadShareCardImage = async (params: {
  apiBaseUrl?: string;
  bracketId: string;
  token?: string;
  guestCode?: string;
  blob: Blob;
}): Promise<ShareCardUploadResult | null> => {
  const baseUrl = resolveApiBase(params.apiBaseUrl);
  if (!baseUrl) return null;
  const headers: Record<string, string> = {
    "Content-Type": "image/png",
  };
  let endpoint = "";
  if (params.token) {
    headers.Authorization = `Bearer ${params.token}`;
    endpoint = `/api/brackets/${params.bracketId}/share-card`;
  } else if (params.guestCode) {
    headers["x-guest-code"] = params.guestCode;
    endpoint = `/api/guest-brackets/${params.bracketId}/share-card`;
  } else {
    throw new Error("Missing auth token or guest code.");
  }
  const res = await fetch(`${baseUrl}${endpoint}`, {
    method: "POST",
    headers,
    body: params.blob,
  });
  if (!res.ok) {
    const message = await res.text().catch(() => "No se pudo subir la imagen.");
    throw new Error(message || "No se pudo subir la imagen.");
  }
  return (await res.json()) as ShareCardUploadResult;
};

export const buildSharePageUrl = (bracketId: string, apiBaseUrl?: string) => {
  const baseUrl = resolveApiBase(apiBaseUrl);
  if (!baseUrl) return "";
  const url = new URL(`/share/${bracketId}`, baseUrl);
  return url.toString();
};

export const createGuestShare = async (params: {
  apiBaseUrl?: string;
  name?: string;
  data: BracketSavePayload;
}): Promise<GuestShareResult | null> => {
  const baseUrl = resolveApiBase(params.apiBaseUrl);
  if (!baseUrl) return null;
  // Debug: confirmar URL base y final en producción
  const res = await fetch(`${baseUrl}/api/guest-brackets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: params.name, data: params.data }),
  });
  if (!res.ok) {
    const message = await res.text().catch(() => "No se pudo crear el enlace.");
    throw new Error(message || "No se pudo crear el enlace.");
  }
  return (await res.json()) as GuestShareResult;
};
