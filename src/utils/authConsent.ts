export type ConsentPayload = {
  consent_marketing: boolean;
  consent_news: boolean;
  consent_updates: boolean;
  consent_timestamp: string;
  consent_source: string;
};

const CONSENT_PENDING_KEY = "fm-consent-pending";

export const buildConsentPayload = (args: {
  marketing: boolean;
  news: boolean;
  updates: boolean;
  source: string;
}): ConsentPayload => ({
  consent_marketing: Boolean(args.marketing),
  consent_news: Boolean(args.news),
  consent_updates: Boolean(args.updates),
  consent_timestamp: new Date().toISOString(),
  consent_source: args.source,
});

export const storePendingConsent = (payload: ConsentPayload) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CONSENT_PENDING_KEY, JSON.stringify(payload));
  } catch {
    // ignore storage errors
  }
};

export const readPendingConsent = (): ConsentPayload | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CONSENT_PENDING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as ConsentPayload;
  } catch {
    return null;
  }
};

export const clearPendingConsent = () => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(CONSENT_PENDING_KEY);
  } catch {
    // ignore storage errors
  }
};
