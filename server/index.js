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
  ? process.env.CORS_ORIGIN.split(",").map((v) => v.trim())
  : "*";

app.use(cors({ origin: corsOrigins, credentials: true }));
app.use(express.json({ limit: "1mb" }));

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const shareCardBucket = process.env.SHARE_CARD_BUCKET || "share-cards";
const bracketHomeUrl = process.env.BRACKET_HOME_URL || process.env.PUBLIC_BASE_URL || "";
const shareCardFallbackUrl = process.env.SHARE_CARD_FALLBACK_URL || "";

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
  const { data, error } = await supabase
    .from("bracket_saves")
    .select("id,name,data,created_at,updated_at")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    logSupabaseError("brackets.public", error);
    return res.status(500).json({ error: error.message, details: error.details, hint: error.hint });
  }
  if (!data) return res.status(404).json({ error: "Bracket not found" });
  return res.json({ item: mapBracketItem(data) });
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

  // limite 3 brackets por usuario
  if (!id) {
    const { count, error: countError } = await supabase
      .from("bracket_saves")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);

    if (countError) {
      logSupabaseError("brackets.count", countError);
      return res.status(500).json({ error: countError.message, details: countError.details, hint: countError.hint });
    }
    if ((count || 0) >= 3) return res.status(409).json({ error: "Limit reached (max 3 brackets)" });
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

app.post(
  "/api/brackets/:id/share-card",
  requireAuth,
  express.raw({ type: "image/png", limit: "5mb" }),
  async (req, res) => {
    try {
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
  const { data, error } = await supabase
    .from("bracket_saves")
    .select("id,name,data,created_at,updated_at")
    .eq("id", id)
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
  const shareCardUrl = payload?.shareCardUrl || shareCardFallbackUrl;
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

if (fs.existsSync(clientIndexPath)) {
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
