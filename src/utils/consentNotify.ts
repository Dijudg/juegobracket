import { resolveApiBase } from "./apiBase";
import type { ConsentPayload } from "./authConsent";

type ConsentNotifyParams = {
  email: string;
  userId?: string;
  consent: ConsentPayload;
  source?: string;
  method?: string;
  apiBaseUrl?: string;
};

export const sendConsentNotification = async (params: ConsentNotifyParams) => {
  const email = (params.email || "").trim();
  if (!email) return;
  const baseUrl = resolveApiBase(params.apiBaseUrl);
  if (!baseUrl) return;
  try {
    await fetch(`${baseUrl}/api/consent-notify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        userId: params.userId || "",
        consent: params.consent,
        source: params.source || params.consent?.consent_source,
        method: params.method || "",
      }),
    });
  } catch {
    // ignore notify errors
  }
};
