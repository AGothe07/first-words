import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-user-token, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonRes(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Rate limiting per function instance
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 20;
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

function isValidBrazilianPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, "");
  return /^55\d{10,11}$/.test(digits);
}

async function sha256(msg: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(msg));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonRes({ error: "Method not allowed. Use POST." }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer "))
    return jsonRes({ error: "Unauthorized" }, 401);

  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const svc = createClient(supabaseUrl, serviceRoleKey);

  // Rate limit by IP
  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (isRateLimited(`ip:${clientIp}`))
    return jsonRes({ error: "Rate limit exceeded." }, 429);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonRes({ error: "Invalid JSON body." }, 400);
  }

  // Authenticate via X-User-Token or phone+token
  const userToken = req.headers.get("X-User-Token") || (body.user_token as string);
  if (!userToken) return jsonRes({ error: "Missing user token." }, 401);

  const blockKey = `query:${userToken.slice(0, 8)}`;
  if (checkBlocked(blockKey))
    return jsonRes({ error: "Too many failed attempts. Try again later." }, 429);

  const tokenHash = await sha256(String(userToken));
  const { data: tokenRow } = await svc
    .from("ai_tokens")
    .select("user_id")
    .eq("token_hash", tokenHash)
    .eq("is_active", true)
    .maybeSingle();

  if (!tokenRow) {
    recordFailure(blockKey);
    await (svc as any).from("security_events").insert({
      event_type: "invalid_query_token",
      ip_address: clientIp,
      metadata: {},
    });
    return jsonRes({ error: "Invalid or revoked token." }, 401);
  }

  if (isRateLimited(`token:${tokenRow.user_id}`))
    return jsonRes({ error: "Rate limit exceeded." }, 429);

  // Get the phone number - either from body or from the user's profile
  let phone: string;
  const phoneParam = body.phone_number ? String(body.phone_number).replace(/\D/g, "") : null;

  if (phoneParam) {
    if (!isValidBrazilianPhone(phoneParam))
      return jsonRes({ error: "Invalid phone number format. Must start with 55." }, 400);

    // Verify this phone belongs to the token's user
    const { data: profile } = await svc
      .from("profiles")
      .select("id, phone")
      .eq("id", tokenRow.user_id)
      .single();

    if (!profile || profile.phone !== phoneParam)
      return jsonRes({ error: "Phone number does not match authenticated user." }, 403);

    phone = phoneParam;
  } else {
    // Use the user's own phone
    const { data: profile } = await svc
      .from("profiles")
      .select("phone")
      .eq("id", tokenRow.user_id)
      .single();

    if (!profile?.phone)
      return jsonRes({ error: "No phone number associated with this account." }, 400);

    phone = profile.phone;
  }

  // Fetch transactions
  const { data: transactions } = await svc
    .from("vw_financial_data_by_phone")
    .select("*")
    .eq("phone", phone)
    .order("date", { ascending: false });

  // Fetch summary
  const { data: summary } = await svc
    .from("vw_financial_summary_by_phone")
    .select("*")
    .eq("phone", phone)
    .maybeSingle();

  // Monthly aggregation
  const monthlyMap = new Map<string, { income: number; expense: number }>();
  for (const t of transactions || []) {
    const m = t.month_year;
    const entry = monthlyMap.get(m) || { income: 0, expense: 0 };
    if (t.type === "income") entry.income += Number(t.amount);
    else entry.expense += Number(t.amount);
    monthlyMap.set(m, entry);
  }
  const monthly = Array.from(monthlyMap.entries())
    .map(([month, data]) => ({ month, ...data, balance: data.income - data.expense }))
    .sort((a, b) => b.month.localeCompare(a.month));

  // Category aggregation
  const catMap = new Map<string, { total: number; count: number; type: string }>();
  for (const t of transactions || []) {
    const key = t.category_name;
    const entry = catMap.get(key) || { total: 0, count: 0, type: t.type };
    entry.total += Number(t.amount);
    entry.count++;
    catMap.set(key, entry);
  }
  const categories = Array.from(catMap.entries())
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.total - a.total);

  // Update last_activity
  await svc.from("profiles").update({ last_activity: new Date().toISOString() }).eq("id", tokenRow.user_id);

  return jsonRes({
    success: true,
    user_id: tokenRow.user_id,
    phone,
    summary: summary || { total_transactions: 0, total_income: 0, total_expense: 0, balance: 0 },
    monthly,
    categories,
    transactions: transactions || [],
  });
});
