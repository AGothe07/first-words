import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  "https://financial.lendscope.com.br",
  "https://n8n-n8n.czby9f.easypanel.host",
  "https://id-preview--25132eda-0e5b-447c-9d18-6de3b7514cfb.lovable.app",
  "https://design-zen-space-45.lovable.app",
];

function getCorsHeaders(req?: Request) {
  const origin = req?.headers.get("Origin") || "";
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-user-token, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  };
}

let _reqRef: Request | undefined;

function jsonRes(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...getCorsHeaders(_reqRef), "Content-Type": "application/json" },
  });
}

/**
 * Normalize any Brazilian phone variation to canonical format: 55 + DDD(2) + 9 + number(8)
 */
function normalizePhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  
  let local: string;
  
  if (digits.startsWith("55") && digits.length >= 12) {
    local = digits.slice(2);
  } else if (digits.length <= 11) {
    local = digits;
  } else {
    return null;
  }
  
  if (local.length === 11 && local[2] === "9") {
    return "55" + local;
  }
  if (local.length === 10) {
    return "55" + local.slice(0, 2) + "9" + local.slice(2);
  }
  if (local.length === 11 && local[2] !== "9") {
    return "55" + local;
  }
  
  return null;
}

// --- Rate limiting ---
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60_000;

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT;
}

const failedAttempts = new Map<string, { count: number; blockedUntil: number }>();

function checkBlocked(key: string): boolean {
  const entry = failedAttempts.get(key);
  if (!entry) return false;
  if (Date.now() > entry.blockedUntil) {
    failedAttempts.delete(key);
    return false;
  }
  return true;
}

function recordFailure(key: string) {
  const entry = failedAttempts.get(key) || { count: 0, blockedUntil: 0 };
  entry.count++;
  const delays = [30, 60, 120, 300, 600];
  const delayIdx = Math.min(entry.count - 1, delays.length - 1);
  entry.blockedUntil = Date.now() + delays[delayIdx] * 1000;
  failedAttempts.set(key, entry);
}

// --- Duplicate detection ---
const recentInserts = new Map<string, number>();
const DEDUP_WINDOW_MS = 30_000;

function isDuplicate(fingerprint: string): boolean {
  const now = Date.now();
  for (const [k, ts] of recentInserts) {
    if (now - ts > DEDUP_WINDOW_MS) recentInserts.delete(k);
  }
  if (recentInserts.has(fingerprint)) return true;
  recentInserts.set(fingerprint, now);
  return false;
}

async function sha256(msg: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(msg));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

// --- Resolve user ID ---
async function resolveUserId(
  req: Request,
  svc: any,
  supabaseUrl: string,
  supabaseAnonKey: string,
  authHeader: string
): Promise<{ userId: string | null; error: Response | null }> {
  const userTokenHeader = req.headers.get("X-User-Token");

  if (userTokenHeader) {
    const blockKey = `token:${userTokenHeader.slice(0, 8)}`;
    if (checkBlocked(blockKey))
      return { userId: null, error: jsonRes({ error: "Too many failed attempts. Try again later." }, 429) };

    const tokenHash = await sha256(userTokenHeader);
    const { data: tokenRow } = await svc
      .from("ai_tokens")
      .select("user_id")
      .eq("token_hash", tokenHash)
      .eq("is_active", true)
      .maybeSingle();

    if (!tokenRow) {
      recordFailure(blockKey);
      const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
      await svc.from("security_events").insert({
        event_type: "invalid_user_token",
        ip_address: clientIp,
        metadata: {},
      });
      return { userId: null, error: jsonRes({ error: "Invalid or revoked user token." }, 401) };
    }

    if (isRateLimited(`token:${tokenRow.user_id}`))
      return { userId: null, error: jsonRes({ error: "Rate limit exceeded." }, 429) };

    return { userId: tokenRow.user_id, error: null };
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
  if (claimsError || !claimsData?.claims)
    return { userId: null, error: jsonRes({ error: "Invalid or expired token." }, 401) };

  const userId = claimsData.claims.sub as string;
  if (isRateLimited(`jwt:${userId}`))
    return { userId: null, error: jsonRes({ error: "Rate limit exceeded. Max 30 requests per minute." }, 429) };

  return { userId, error: null };
}

Deno.serve(async (req) => {
  _reqRef = req;
  if (req.method === "OPTIONS") return new Response(null, { headers: getCorsHeaders(req) });
  if (req.method !== "POST") return jsonRes({ error: "Method not allowed. Use POST." }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer "))
    return jsonRes({ error: "Missing or invalid Authorization header." }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const svc = createClient(supabaseUrl, serviceRoleKey);

  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (isRateLimited(`ip:${clientIp}`)) {
    return jsonRes({ error: "Rate limit exceeded." }, 429);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonRes({ error: "Invalid JSON body." }, 400);
  }

  // --- Determine user identity ---
  let userId: string;
  const rawPhone = body.phone_number ? String(body.phone_number).replace(/\D/g, "") : null;

  if (rawPhone) {
    // Normalize phone to canonical format
    const phoneCanonical = normalizePhone(rawPhone);
    if (!phoneCanonical)
      return jsonRes({ error: "'phone_number' could not be normalized to a valid Brazilian phone." }, 400);

    if (isRateLimited(`phone:${phoneCanonical}`))
      return jsonRes({ error: "Rate limit exceeded for this phone number." }, 429);

    const blockKey = `phone:${phoneCanonical}`;
    if (checkBlocked(blockKey))
      return jsonRes({ error: "Too many failed attempts for this phone. Try again later." }, 429);

    const { data: profile } = await svc
      .from("profiles")
      .select("id, ai_enabled")
      .eq("phone", phoneCanonical)
      .maybeSingle();

    if (!profile) {
      recordFailure(blockKey);
      return jsonRes({ error: `No user associated with phone number.` }, 404);
    }
    if (!profile.ai_enabled) {
      return jsonRes({ error: "AI/API integration is not enabled for this user." }, 403);
    }

    userId = profile.id;
  } else {
    const result = await resolveUserId(req, svc, supabaseUrl, supabaseAnonKey, authHeader);
    if (result.error) return result.error;
    userId = result.userId!;
  }

  // --- Validate payload ---
  const errors: string[] = [];

  const type = body.type as string | undefined;
  if (!type || !["expense", "income"].includes(type))
    errors.push("'type' is required and must be 'expense' or 'income'.");

  let amount: number | null = null;
  if (body.amount === undefined || body.amount === null) {
    errors.push("'amount' is required.");
  } else {
    const raw = String(body.amount).replace(",", ".");
    amount = parseFloat(raw);
    if (isNaN(amount) || amount <= 0) errors.push("'amount' must be a positive number.");
  }

  let date: string;
  if (body.date) {
    const dateStr = String(body.date);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr) || isNaN(new Date(dateStr).getTime()))
      errors.push("'date' must be a valid date in YYYY-MM-DD format.");
    date = dateStr;
  } else {
    date = new Date().toISOString().slice(0, 10);
  }

  const personName = body.person as string | undefined;
  if (!personName || String(personName).trim().length === 0)
    errors.push("'person' is required (name of the person).");

  const categoryName = body.category as string | undefined;
  if (!categoryName || String(categoryName).trim().length === 0)
    errors.push("'category' is required (name of the category).");

  const subcategoryName = body.subcategory as string | undefined;
  const notes = body.notes ? String(body.notes).slice(0, 500) : null;

  if (errors.length > 0) return jsonRes({ error: "Validation failed.", details: errors }, 400);

  const { data: personRows, error: personErr } = await svc
    .from("persons")
    .select("id")
    .eq("user_id", userId)
    .ilike("name", String(personName).trim())
    .limit(1);
  if (personErr || !personRows?.length)
    return jsonRes({ error: `Person '${personName}' not found. Create it first.` }, 400);
  const personId = personRows[0].id;

  const { data: catRows, error: catErr } = await svc
    .from("categories")
    .select("id")
    .eq("user_id", userId)
    .eq("type", type!)
    .ilike("name", String(categoryName).trim())
    .limit(1);
  if (catErr || !catRows?.length)
    return jsonRes({ error: `Category '${categoryName}' of type '${type}' not found.` }, 400);
  const categoryId = catRows[0].id;

  let subcategoryId: string | null = null;
  if (subcategoryName && String(subcategoryName).trim().length > 0) {
    const { data: subRows, error: subErr } = await svc
      .from("subcategories")
      .select("id")
      .eq("user_id", userId)
      .eq("category_id", categoryId)
      .ilike("name", String(subcategoryName).trim())
      .limit(1);
    if (subErr || !subRows?.length)
      return jsonRes({ error: `Subcategory '${subcategoryName}' not found under '${categoryName}'.` }, 400);
    subcategoryId = subRows[0].id;
  }

  const fingerprint = `${userId}:${amount}:${date}:${categoryId}:${personId}`;
  if (isDuplicate(fingerprint))
    return jsonRes({ error: "Duplicate detected. Same transaction submitted within 30 seconds." }, 409);

  const { data: inserted, error: insertErr } = await svc
    .from("transactions")
    .insert({
      user_id: userId,
      type: type!,
      date: date!,
      amount: amount!,
      person_id: personId,
      category_id: categoryId,
      subcategory_id: subcategoryId,
      notes: notes ? `[API] ${notes}` : "[API]",
    })
    .select("id, type, date, amount, notes")
    .single();

  if (insertErr) {
    console.error("ingest-transaction insert error:", insertErr);
    return jsonRes({ error: "Failed to insert transaction." }, 500);
  }

  await svc.from("profiles").update({ last_activity: new Date().toISOString() }).eq("id", userId);

  return jsonRes(
    { success: true, message: "Transaction created successfully.", transaction: inserted },
    201
  );
});
