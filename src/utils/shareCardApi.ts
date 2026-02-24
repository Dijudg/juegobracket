type ShareCardUploadResult = {
  shareCardUrl: string;
  sharePageUrl: string;
};

const resolveApiBase = (apiBaseUrl?: string) => {
  if (apiBaseUrl) return apiBaseUrl;
  if (typeof window !== "undefined") return window.location.origin;
  return "";
};

export const uploadShareCardImage = async (params: {
  apiBaseUrl?: string;
  bracketId: string;
  token: string;
  blob: Blob;
}): Promise<ShareCardUploadResult | null> => {
  const baseUrl = resolveApiBase(params.apiBaseUrl);
  if (!baseUrl) return null;
  const res = await fetch(`${baseUrl}/api/brackets/${params.bracketId}/share-card`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.token}`,
      "Content-Type": "image/png",
    },
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
