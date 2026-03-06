import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import cors from "cors";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envName = process.env.NODE_ENV || "development";
const envCandidates = [];

if (process.env.DOTENV_CONFIG_PATH) {
  envCandidates.push(process.env.DOTENV_CONFIG_PATH);
}

envCandidates.push(path.join(__dirname, `.env.${envName}`));
envCandidates.push(path.join(__dirname, ".env"));

for (const envPath of envCandidates) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, override: false });
    break;
  }
}

const app = express();

const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((v) => v.trim()).filter(Boolean)
  : [];
const allowAllOrigins = corsOrigins.includes("*");
const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  if (allowAllOrigins) return true;
  if (corsOrigins.includes(origin)) return true;
  try {
    const { hostname } = new URL(origin);
    if (hostname.endsWith(".vercel.app")) return true;
  } catch {
    // ignore
  }
  return false;
};
const corsConfig = {
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error("Not allowed by CORS"));
  },
  credentials: false,
  methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Guest-Code"],
};

app.use(cors(corsConfig));
app.options("*", cors(corsConfig));
app.use(express.json({ limit: "1mb" }));

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const shareCardBucket = process.env.SHARE_CARD_BUCKET || "share-cards";
const bracketHomeUrl = process.env.BRACKET_HOME_URL || process.env.PUBLIC_BASE_URL || "";
const shareCardFallbackUrl = process.env.SHARE_CARD_FALLBACK_URL || "";
const guestBracketUserId = process.env.GUEST_BRACKET_USER_ID || "00000000-0000-0000-0000-000000000000";
const guestBracketTtlDays = Number(process.env.GUEST_BRACKET_TTL_DAYS || 7);
const guestBracketCodeLength = Number(process.env.GUEST_BRACKET_CODE_LENGTH || 6);
const resendApiKey = process.env.RESEND_API_KEY || "";
const consentNotifyTo = process.env.CONSENT_NOTIFY_TO || "djurado@comunica.ec";
const consentNotifyFrom = process.env.CONSENT_NOTIFY_FROM || "";
const consentNotifySubject = process.env.CONSENT_NOTIFY_SUBJECT || "Nuevo registro - consentimiento";

if (!supabaseUrl || !supabaseServiceKey) {
  // eslint-disable-next-line no-console
  console.warn("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in server env.");
}

const supabase = createClient(supabaseUrl || "", supabaseServiceKey || "", {
  auth: { persistSession: false },
});

const logSupabaseError = (context, error) => {
  if (!error) return;
  console.error(`[${context}]`, {
    message: error.message,
    details: error.details,
    hint: error.hint,
    code: error.code,
  });
};

const resolveProfileAvatar = (meta = {}) => {
  if (typeof meta.avatar_url === "string" && meta.avatar_url) return meta.avatar_url;
  if (typeof meta.picture === "string" && meta.picture) return meta.picture;
  if (meta.picture?.data?.url) return meta.picture.data.url;
  if (typeof meta.avatar === "string" && meta.avatar) return meta.avatar;
  return "";
};

const resolveProfileAlias = (meta = {}, email = "") => {
  const alias = meta.alias || meta.nickname || meta.full_name || meta.name || "";
  return alias || email || "Usuario";
};

const resolveSharedByFromUser = (user) => {
  const meta = user?.user_metadata || {};
  return {
    userId: user?.id || "",
    name: resolveProfileAlias(meta, user?.email || ""),
    alias: meta.alias || meta.nickname || "",
    avatarUrl: resolveProfileAvatar(meta),
    coverUrl: meta.cover_url || "",
  };
};

const toCsvValue = (value) => {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

const buildConsentReport = (payload) => {
  const headers = [
    "email",
    "user_id",
    "consent_marketing",
    "consent_news",
    "consent_updates",
    "consent_timestamp",
    "consent_source",
    "method",
    "received_at",
  ];
  const row = headers.map((key) => toCsvValue(payload[key])).join(",");
  return {
    json: JSON.stringify(payload, null, 2),
    csvHeader: headers.join(","),
    csvRow: row,
  };
};

let shareBucketReady = false;
const ensureShareBucket = async () => {
  if (shareBucketReady || !supabaseUrl || !supabaseServiceKey) return;
  try {
    const { data, error } = await supabase.storage.getBucket(shareCardBucket);
    if (!error && data) {
      shareBucketReady = true;
      return;
    }
    const status = error?.statusCode || error?.status || 0;
    if (status === 404 || /bucket/i.test(error?.message || "")) {
      const { error: createError } = await supabase.storage.createBucket(shareCardBucket, { public: true });
      if (createError) {
        logSupabaseError("share.bucket.create", createError);
        return;
      }
      shareBucketReady = true;
      return;
    }
    if (error) {
      logSupabaseError("share.bucket.get", error);
    }
  } catch (err) {
    console.error("[share.bucket.ensure] unexpected error", err);
  }
};

const mapBracketMeta = (row) => ({
  id: row.id,
  name: row.name ?? "Mi bracket",
  created_at: row.created_at ?? null,
  updated_at: row.updated_at ?? null,
});

const mapBracketItem = (row) => ({
  ...mapBracketMeta(row),
  data: row.data ?? null,
});

const SHORT_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const generateShortCode = (length = 6) => {
  const size = Math.max(4, Math.floor(length || 6));
  let out = "";
  for (let i = 0; i < size; i += 1) {
    out += SHORT_CODE_ALPHABET[Math.floor(Math.random() * SHORT_CODE_ALPHABET.length)];
  }
  return out;
};

const createUniqueShortCode = async (maxAttempts = 6) => {
  for (let i = 0; i < maxAttempts; i += 1) {
    const code = generateShortCode(guestBracketCodeLength);
    const { count, error } = await supabase
      .from("bracket_saves")
      .select("id", { count: "exact", head: true })
      .eq("short_code", code);
    if (!error && (count || 0) === 0) return code;
  }
  return null;
};

const cleanupExpiredGuestBrackets = async () => {
  const nowIso = new Date().toISOString();
  const { data: expired, error } = await supabase
    .from("bracket_saves")
    .select("id")
    .eq("user_id", guestBracketUserId)
    .lt("expires_at", nowIso);

  if (error) {
    logSupabaseError("guest.brackets.cleanup.fetch", error);
    return;
  }
  if (!expired || expired.length === 0) return;

  try {
    for (const row of expired) {
      const prefix = row.id;
      const { data: files, error: listError } = await supabase.storage
        .from(shareCardBucket)
        .list(prefix, { limit: 100, offset: 0 });
      if (listError) {
        logSupabaseError("guest.brackets.cleanup.list", listError);
        continue;
      }
      if (files && files.length > 0) {
        const paths = files.map((f) => `${prefix}/${f.name}`);
        const { error: removeError } = await supabase.storage.from(shareCardBucket).remove(paths);
        if (removeError) {
          logSupabaseError("guest.brackets.cleanup.remove", removeError);
        }
      }
    }
  } catch (err) {
    console.error("[guest.brackets.cleanup] unexpected error", err);
  }

  const { error: deleteError } = await supabase
    .from("bracket_saves")
    .delete()
    .in(
      "id",
      expired.map((row) => row.id),
    );
  if (deleteError) {
    logSupabaseError("guest.brackets.cleanup.delete", deleteError);
  }
};

const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Missing auth token" });

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) {
      logSupabaseError("auth.getUser", error);
      return res.status(401).json({ error: "Invalid auth token" });
    }
    req.user = data.user;
    return next();
  } catch (err) {
    console.error("[auth.getUser] unexpected error", err);
    return res.status(500).json({ error: "Auth validation failed" });
  }
};

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

app.post("/api/consent-notify", async (req, res) => {
  try {
    if (!resendApiKey || !consentNotifyFrom) {
      return res.status(503).json({ error: "Email provider not configured" });
    }
    const body = req.body || {};
    const consent = body.consent && typeof body.consent === "object" ? body.consent : {};
    const email = typeof body.email === "string" ? body.email.trim() : "";
    if (!email) return res.status(400).json({ error: "Missing email" });

    const payload = {
      email,
      user_id: typeof body.userId === "string" ? body.userId.trim() : "",
      consent_marketing: Boolean(consent.consent_marketing),
      consent_news: Boolean(consent.consent_news),
      consent_updates: Boolean(consent.consent_updates),
      consent_timestamp: consent.consent_timestamp || new Date().toISOString(),
      consent_source: consent.consent_source || body.source || "",
      method: typeof body.method === "string" ? body.method : "",
      received_at: new Date().toISOString(),
    };
    const report = buildConsentReport(payload);

    const emailPayload = {
      from: consentNotifyFrom,
      to: consentNotifyTo,
      subject: consentNotifySubject,
      text: `Nuevo registro\n\nJSON:\n${report.json}\n\nCSV:\n${report.csvHeader}\n${report.csvRow}`,
    };

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(emailPayload),
    });

    if (!response.ok) {
      const details = await response.text().catch(() => "");
      return res.status(502).json({ error: "Email send failed", details: details.slice(0, 500) });
    }
    return res.json({ ok: true });
  } catch (err) {
    console.error("[consent.notify] unexpected error", err);
    return res.status(500).json({ error: "Consent notify failed" });
  }
});

app.get("/api/brackets", requireAuth, async (req, res) => {
  const userId = req.user.id;
  const { data, error } = await supabase
    .from("bracket_saves")
    .select("id,name,created_at,updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) {
    logSupabaseError("brackets.list", error);
    return res.status(500).json({ error: error.message, details: error.details, hint: error.hint });
  }
  return res.json({ items: (data || []).map(mapBracketMeta) });
});

app.get("/api/brackets/latest", requireAuth, async (req, res) => {
  const userId = req.user.id;
  const { data, error } = await supabase
    .from("bracket_saves")
    .select("id,name,data,created_at,updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    logSupabaseError("brackets.latest", error);
    return res.status(500).json({ error: error.message, details: error.details, hint: error.hint });
  }
  return res.json({ item: data ? mapBracketItem(data) : null });
});

app.get("/api/brackets/public/:id", async (req, res) => {
  const { id } = req.params;
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("bracket_saves")
    .select("id,name,data,created_at,updated_at")
    .eq("id", id)
    .eq("is_public", true)
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
    .maybeSingle();

  if (error) {
    logSupabaseError("brackets.public", error);
    return res.status(500).json({ error: error.message, details: error.details, hint: error.hint });
  }
  if (!data) return res.status(404).json({ error: "Bracket not found" });
  return res.json({ item: mapBracketItem(data) });
});

app.get("/api/brackets/code/:code", async (req, res) => {
  const rawCode = (req.params.code || "").toString().trim().toUpperCase();
  if (!rawCode) return res.status(400).json({ error: "Missing short code" });
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("bracket_saves")
    .select("id,short_code,expires_at")
    .eq("short_code", rawCode)
    .eq("is_public", true)
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
    .maybeSingle();

  if (error) {
    logSupabaseError("brackets.code", error);
    return res.status(500).json({ error: error.message, details: error.details, hint: error.hint });
  }
  if (!data) return res.status(404).json({ error: "Bracket not found" });

  const viewBase = bracketHomeUrl || `${req.protocol}://${req.get("host")}`;
  const sharePageUrl = new URL(`/share/${data.id}`, viewBase).toString();
  return res.json({ id: data.id, sharePageUrl });
});

app.get("/api/public-profile/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) return res.status(400).json({ error: "Missing user id" });
    if (!supabaseUrl || !supabaseServiceKey) {
      return res.status(500).json({ error: "Server not configured for profiles" });
    }
    const { data, error } = await supabase.auth.admin.getUserById(userId);
    if (error) {
      logSupabaseError("public.profile.get", error);
      return res.status(500).json({ error: error.message });
    }
    if (!data?.user) return res.status(404).json({ error: "User not found" });
    const meta = data.user.user_metadata || {};
    return res.json({
      userId: data.user.id,
      name: meta.full_name || meta.name || data.user.email || "Usuario",
      alias: meta.alias || meta.nickname || meta.full_name || meta.name || "",
      avatarUrl: resolveProfileAvatar(meta),
      coverUrl: meta.cover_url || "",
    });
  } catch (err) {
    console.error("[public.profile.get] unexpected error", err);
    return res.status(500).json({ error: "Profile lookup failed" });
  }
});

app.get("/api/brackets/:id", requireAuth, async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  const { data, error } = await supabase
    .from("bracket_saves")
    .select("id,name,data,created_at,updated_at")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    logSupabaseError("brackets.get", error);
    return res.status(500).json({ error: error.message, details: error.details, hint: error.hint });
  }
  if (!data) return res.status(404).json({ error: "Bracket not found" });
  return res.json({ item: mapBracketItem(data) });
});

app.post("/api/brackets", requireAuth, async (req, res) => {
  const userId = req.user.id;

  // acepta data o bracket (por si el frontend manda "bracket")
  const { id, name } = req.body || {};
  const data = req.body?.data ?? req.body?.bracket;

  if (!data) return res.status(400).json({ error: "Missing bracket data" });

  // limite 5 brackets por usuario
  if (!id) {
    const { count, error: countError } = await supabase
      .from("bracket_saves")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);

    if (countError) {
      logSupabaseError("brackets.count", countError);
      return res.status(500).json({ error: countError.message, details: countError.details, hint: countError.hint });
    }
    if ((count || 0) >= 5) return res.status(409).json({ error: "Limit reached (max 5 brackets)" });
  }

  // si viene id, verifica que sea del usuario
  if (id) {
    const { data: existing, error: existingErr } = await supabase
      .from("bracket_saves")
      .select("id")
      .eq("id", id)
      .eq("user_id", userId)
      .maybeSingle();

    if (existingErr) {
      logSupabaseError("brackets.verify", existingErr);
      return res.status(500).json({ error: existingErr.message, details: existingErr.details, hint: existingErr.hint });
    }
    if (!existing) return res.status(404).json({ error: "Bracket not found" });
  }

  const payload = {
    user_id: userId,
    name: name || "Mi bracket",
    data,
  };

  const { data: saved, error } = id
    ? await supabase.from("bracket_saves").update(payload).eq("id", id).select().maybeSingle()
    : await supabase.from("bracket_saves").insert([payload]).select().maybeSingle();

  if (error) {
    logSupabaseError("brackets.save", error);
    return res.status(500).json({ error: error.message, details: error.details, hint: error.hint });
  }
  return res.json({ item: saved ? mapBracketItem(saved) : null });
});

app.post("/api/guest-brackets", async (req, res) => {
  try {
    if (!supabaseUrl || !supabaseServiceKey) {
      return res.status(500).json({ error: "Server not configured for guest shares" });
    }
    const rawData = req.body?.data ?? req.body?.bracket;
    if (!rawData) return res.status(400).json({ error: "Missing bracket data" });

    let payload = rawData;
    if (typeof payload === "string") {
      try {
        payload = JSON.parse(payload);
      } catch {
        // keep original string
      }
    }
    if (payload && typeof payload === "object" && !Array.isArray(payload)) {
      if (!payload.sharedBy) {
        payload = { ...payload, sharedBy: { name: "Invitado", alias: "", avatarUrl: "" } };
      }
    }

    const shortCode = await createUniqueShortCode();
    if (!shortCode) {
      return res.status(500).json({ error: "No se pudo generar el codigo corto" });
    }
    const ttlMs = Number.isFinite(guestBracketTtlDays) && guestBracketTtlDays > 0 ? guestBracketTtlDays : 7;
    const expiresAt = new Date(Date.now() + ttlMs * 24 * 60 * 60 * 1000).toISOString();
    const safeName = shortCode;

    const { data, error } = await supabase
      .from("bracket_saves")
      .insert([
        {
          user_id: guestBracketUserId,
          name: safeName,
          data: payload,
          is_public: true,
          short_code: shortCode,
          expires_at: expiresAt,
        },
      ])
      .select("id,expires_at,short_code")
      .maybeSingle();

    if (error || !data) {
      logSupabaseError("guest.brackets.insert", error);
      return res.status(500).json({ error: error?.message || "Guest share failed" });
    }

    // Limpia registros expirados en background (best-effort)
    try {
      await cleanupExpiredGuestBrackets();
    } catch {
      // ignore cleanup errors
    }

    const viewBase = bracketHomeUrl || `${req.protocol}://${req.get("host")}`;
    const sharePageUrl = new URL(`/share/${data.id}`, viewBase).toString();
    return res.json({
      id: data.id,
      sharePageUrl,
      expiresAt: data.expires_at || expiresAt,
      shortCode: data.short_code || shortCode,
    });
  } catch (err) {
    console.error("[guest.brackets] unexpected error", err);
    return res.status(500).json({ error: "Guest share failed" });
  }
});

app.post("/api/guest-brackets/claim", requireAuth, async (req, res) => {
  try {
    const shortCode = typeof req.body?.shortCode === "string" ? req.body.shortCode.trim().toUpperCase() : "";
    if (!shortCode) return res.status(400).json({ error: "Missing short code" });
    const nowIso = new Date().toISOString();
    const { data, error } = await supabase
      .from("bracket_saves")
      .select("id,expires_at,short_code,data")
      .eq("short_code", shortCode)
      .eq("user_id", guestBracketUserId)
      .eq("is_public", true)
      .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
      .maybeSingle();

    if (error) {
      logSupabaseError("guest.brackets.claim.fetch", error);
      return res.status(500).json({ error: error.message });
    }
    if (!data) return res.status(404).json({ error: "Bracket not found" });

    const { count, error: countError } = await supabase
      .from("bracket_saves")
      .select("id", { count: "exact", head: true })
      .eq("user_id", req.user.id);
    if (countError) {
      logSupabaseError("guest.brackets.claim.count", countError);
      return res.status(500).json({ error: countError.message });
    }
    if ((count || 0) >= 5) {
      return res.status(409).json({ error: "Limit reached (max 5 brackets)" });
    }

    let nextPayload = data.data;
    if (typeof nextPayload === "string") {
      try {
        nextPayload = JSON.parse(nextPayload);
      } catch {
        nextPayload = {};
      }
    }
    if (!nextPayload || typeof nextPayload !== "object" || Array.isArray(nextPayload)) {
      nextPayload = {};
    }
    nextPayload = {
      ...nextPayload,
      sharedBy: resolveSharedByFromUser(req.user),
    };

    const { data: updated, error: updateError } = await supabase
      .from("bracket_saves")
      .update({ user_id: req.user.id, expires_at: null, data: nextPayload })
      .eq("id", data.id)
      .eq("user_id", guestBracketUserId)
      .select("id,name,updated_at")
      .maybeSingle();

    if (updateError || !updated) {
      logSupabaseError("guest.brackets.claim.update", updateError);
      return res.status(500).json({ error: updateError?.message || "Claim failed" });
    }

    return res.json({ id: updated.id, name: updated.name, updatedAt: updated.updated_at });
  } catch (err) {
    console.error("[guest.brackets.claim] unexpected error", err);
    return res.status(500).json({ error: "Claim failed" });
  }
});

app.post(
  "/api/brackets/:id/share-card",
  requireAuth,
  express.raw({ type: "image/png", limit: "5mb" }),
  async (req, res) => {
    try {
      await ensureShareBucket();
      const userId = req.user.id;
      const { id } = req.params;
      if (!id) return res.status(400).json({ error: "Missing bracket id" });
      if (!req.body || !Buffer.isBuffer(req.body)) {
        return res.status(400).json({ error: "Missing image body" });
      }

      const { data: existing, error: existingErr } = await supabase
        .from("bracket_saves")
        .select("id,user_id,data")
        .eq("id", id)
        .eq("user_id", userId)
        .maybeSingle();

      if (existingErr) {
        logSupabaseError("brackets.share.verify", existingErr);
        return res.status(500).json({ error: existingErr.message });
      }
      if (!existing) return res.status(404).json({ error: "Bracket not found" });

      const fileName = `${Date.now()}.png`;
      const filePath = `${id}/${fileName}`;
      const { error: uploadError } = await supabase.storage
        .from(shareCardBucket)
        .upload(filePath, req.body, { contentType: "image/png", upsert: true, cacheControl: "3600" });

      if (uploadError) {
        logSupabaseError("brackets.share.upload", uploadError);
        return res.status(500).json({ error: uploadError.message });
      }

      const { data: publicData } = supabase.storage.from(shareCardBucket).getPublicUrl(filePath);
      const shareCardUrl = publicData?.publicUrl;

      let nextData = existing.data;
      if (typeof nextData === "string") {
        try {
          nextData = JSON.parse(nextData);
        } catch {
          nextData = { data: existing.data };
        }
      }
      const updatedPayload = {
        ...(nextData || {}),
        shareCardUrl,
        shareCardUpdatedAt: new Date().toISOString(),
      };

      const { error: updateError } = await supabase
        .from("bracket_saves")
        .update({ data: updatedPayload })
        .eq("id", id)
        .eq("user_id", userId);

      if (updateError) {
        logSupabaseError("brackets.share.update", updateError);
      }

      const sharePageUrl = `${req.protocol}://${req.get("host")}/share/${id}`;
      return res.json({ shareCardUrl, sharePageUrl });
    } catch (err) {
      console.error("[brackets.share] unexpected error", err);
      return res.status(500).json({ error: "Share card upload failed" });
    }
  },
);

app.post(
  "/api/guest-brackets/:id/share-card",
  express.raw({ type: "image/png", limit: "5mb" }),
  async (req, res) => {
    try {
      await ensureShareBucket();
      const { id } = req.params;
      if (!id) return res.status(400).json({ error: "Missing bracket id" });
      if (!req.body || !Buffer.isBuffer(req.body)) {
        return res.status(400).json({ error: "Missing image body" });
      }

      const rawCode =
        (req.headers["x-guest-code"] || req.query?.code || "").toString().trim();
      const shortCode = rawCode.toUpperCase();
      if (!shortCode) return res.status(400).json({ error: "Missing guest code" });

      const nowIso = new Date().toISOString();
      const { data: existing, error: existingErr } = await supabase
        .from("bracket_saves")
        .select("id,user_id,data,short_code,expires_at")
        .eq("id", id)
        .eq("user_id", guestBracketUserId)
        .eq("short_code", shortCode)
        .eq("is_public", true)
        .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
        .maybeSingle();

      if (existingErr) {
        logSupabaseError("guest.brackets.share.verify", existingErr);
        return res.status(500).json({ error: existingErr.message });
      }
      if (!existing) return res.status(404).json({ error: "Bracket not found" });

      const fileName = `${Date.now()}.png`;
      const filePath = `${id}/${fileName}`;
      const { error: uploadError } = await supabase.storage
        .from(shareCardBucket)
        .upload(filePath, req.body, { contentType: "image/png", upsert: true, cacheControl: "3600" });

      if (uploadError) {
        logSupabaseError("guest.brackets.share.upload", uploadError);
        return res.status(500).json({ error: uploadError.message });
      }

      const { data: publicData } = supabase.storage.from(shareCardBucket).getPublicUrl(filePath);
      const shareCardUrl = publicData?.publicUrl;

      let nextData = existing.data;
      if (typeof nextData === "string") {
        try {
          nextData = JSON.parse(nextData);
        } catch {
          nextData = { data: existing.data };
        }
      }
      const updatedPayload = {
        ...(nextData || {}),
        shareCardUrl,
        shareCardUpdatedAt: new Date().toISOString(),
      };

      const { error: updateError } = await supabase
        .from("bracket_saves")
        .update({ data: updatedPayload })
        .eq("id", id)
        .eq("user_id", guestBracketUserId)
        .eq("short_code", shortCode);

      if (updateError) {
        logSupabaseError("guest.brackets.share.update", updateError);
      }

      const sharePageUrl = `${req.protocol}://${req.get("host")}/share/${id}`;
      return res.json({ shareCardUrl, sharePageUrl });
    } catch (err) {
      console.error("[guest.brackets.share] unexpected error", err);
      return res.status(500).json({ error: "Guest share card upload failed" });
    }
  },
);

app.delete("/api/brackets/:id", requireAuth, async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  const { error } = await supabase.from("bracket_saves").delete().eq("id", id).eq("user_id", userId);
  if (error) {
    logSupabaseError("brackets.delete", error);
    return res.status(500).json({ error: error.message, details: error.details, hint: error.hint });
  }
  return res.json({ ok: true });
});

app.delete("/api/account", requireAuth, async (req, res) => {
  const userId = req.user.id;
  const { error: bracketError } = await supabase.from("bracket_saves").delete().eq("user_id", userId);
  if (bracketError) {
    logSupabaseError("account.delete.brackets", bracketError);
    return res.status(500).json({ error: bracketError.message, details: bracketError.details, hint: bracketError.hint });
  }
  const { error } = await supabase.auth.admin.deleteUser(userId);
  if (error) {
    logSupabaseError("account.delete.user", error);
    return res.status(500).json({ error: error.message, details: error.details, hint: error.hint });
  }
  return res.json({ ok: true });
});

app.get("/share/:id", async (req, res) => {
  const { id } = req.params;
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("bracket_saves")
    .select("id,name,data,created_at,updated_at")
    .eq("id", id)
    .eq("is_public", true)
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
    .maybeSingle();

  if (error) {
    logSupabaseError("share.og", error);
    return res.status(500).send("Error");
  }
  if (!data) return res.status(404).send("Not found");

  let payload = data.data;
  if (typeof payload === "string") {
    try {
      payload = JSON.parse(payload);
    } catch {
      payload = {};
    }
  }
  const fallbackShareCardUrl =
    shareCardFallbackUrl ||
    (bracketHomeUrl
      ? new URL("/og.jpg", bracketHomeUrl).toString()
      : `${req.protocol}://${req.get("host")}/og.jpg`);
  const shareCardUrl = payload?.shareCardUrl || fallbackShareCardUrl;
  const title = data.name || "Pronóstico Mundialista";
  const viewUrlBase =
    bracketHomeUrl || `${req.protocol}://${req.get("host")}`;
  const viewUrl = `${viewUrlBase}?view=1&bracketId=${id}`;
  const description = "Mira el pronóstico completo del Mundial.";

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="x-ua-compatible" content="ie=edge" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    ${shareCardUrl ? `<meta property="og:image" content="${shareCardUrl}" />` : ""}
    <meta property="og:url" content="${req.protocol}://${req.get("host")}/share/${id}" />
    <meta name="twitter:card" content="${shareCardUrl ? "summary_large_image" : "summary"}" />
    ${shareCardUrl ? `<meta name="twitter:image" content="${shareCardUrl}" />` : ""}
    <meta http-equiv="refresh" content="0; url=${viewUrl}" />
  </head>
  <body>
    <p>Redirigiendo a tu pronóstico...</p>
    <p><a href="${viewUrl}">Abrir pronóstico</a></p>
    <script>window.location.replace(${JSON.stringify(viewUrl)});</script>
  </body>
</html>`);
});

const clientDistPath = path.resolve(__dirname, "..", "dist");
const clientIndexPath = path.join(clientDistPath, "index.html");
const serveClient = process.env.SERVE_CLIENT === "true";

if (serveClient && fs.existsSync(clientIndexPath)) {
  app.use(express.static(clientDistPath));
  app.get("*", (req, res) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/share")) {
      return res.status(404).send("Not found");
    }
    return res.sendFile(clientIndexPath);
  });
}

const port = Number(process.env.PORT || 4000);
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Bracket API running on http://localhost:${port}`);
});
