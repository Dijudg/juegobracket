import type { BracketSavePayload } from "../features/bracket/types";
import { resolveApiBase, resolveSiteBase } from "./apiBase";

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

const coerceSharePageUrl = (sharePageUrl: string | undefined, fallbackId?: string) => {
  const baseUrl = resolveSiteBase();
  if (!baseUrl) return sharePageUrl || "";
  if (sharePageUrl) {
    try {
      const parsed = new URL(sharePageUrl, baseUrl);
      const path = `${parsed.pathname}${parsed.search}${parsed.hash}`;
      return new URL(path || "/", baseUrl).toString();
    } catch {
      // ignore malformed URL
    }
  }
  if (fallbackId) {
    return new URL(`/share/${fallbackId}`, baseUrl).toString();
  }
  return sharePageUrl || "";
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
  const payload = (await res.json()) as ShareCardUploadResult;
  return {
    ...payload,
    sharePageUrl: coerceSharePageUrl(payload.sharePageUrl, params.bracketId),
  };
};

export const buildSharePageUrl = (bracketId: string, _apiBaseUrl?: string) => {
  const baseUrl = resolveSiteBase();
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
  const res = await fetch(`${baseUrl}/api/guest-brackets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: params.name, data: params.data }),
  });
  if (!res.ok) {
    const message = await res.text().catch(() => "No se pudo crear el enlace.");
    throw new Error(message || "No se pudo crear el enlace.");
  }
  const payload = (await res.json()) as GuestShareResult;
  return {
    ...payload,
    sharePageUrl: coerceSharePageUrl(payload.sharePageUrl, payload.id),
  };
};
