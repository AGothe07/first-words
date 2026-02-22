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
      "authorization, x-client-info, apikey, content-type",
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

// Rate limiting per IP
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

async function sha256(msg: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(msg));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  _reqRef = req;
  if (req.method === "OPTIONS") return new Response(null, { headers: getCorsHeaders(req) });
  if (req.method !== "POST") return jsonRes({ success: false, error: "Method not allowed. Use POST." }, 405);

  // --- Admin token auth ---
  const authHeader = req.headers.get("Authorization");
  const adminToken = Deno.env.get("EXTERNAL_API_ADMIN_TOKEN");
  if (!adminToken) return jsonRes({ success: false, error: "Server misconfigured." }, 500);

  const providedToken = authHeader?.startsWith("Bearer ") ? authHeader.replace("Bearer ", "") : "";
  const providedHash = await sha256(providedToken);
  const expectedHash = await sha256(adminToken);
  if (providedHash !== expectedHash) {
    return jsonRes({ success: false, error: "Unauthorized." }, 401);
  }

  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (isRateLimited(`ip:${clientIp}`)) {
    return jsonRes({ success: false, error: "Rate limit exceeded. Try again later." }, 429);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonRes({ success: false, error: "Invalid JSON body." }, 400);
  }

  const rawPhone = body.phone_number ? String(body.phone_number).replace(/\D/g, "") : null;
  const type = String(body.type || "summary");

  if (!rawPhone) return jsonRes({ success: false, error: "Missing phone_number." }, 400);
  
  // Normalize to canonical format
  const phoneCanonical = normalizePhone(rawPhone);
  if (!phoneCanonical) {
    return jsonRes({ success: false, error: "Invalid phone number. Could not normalize to Brazilian format." }, 400);
  }

  if (!["summary", "transactions"].includes(type)) {
    return jsonRes({ success: false, error: "Invalid type. Use 'summary' or 'transactions'." }, 400);
  }

  const svc = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Lookup user by canonical phone
  const { data: profile, error: profileError } = await svc
    .from("profiles")
    .select("id, phone, display_name, email")
    .eq("phone", phoneCanonical)
    .maybeSingle();

  if (profileError) return jsonRes({ success: false, error: "Database error." }, 500);
  if (!profile) return jsonRes({ success: false, error: "No user found with this phone number." }, 404);

  const userId = profile.id;

  if (type === "summary") {
    return await handleSummary(svc, userId, phoneCanonical);
  } else {
    return await handleTransactions(svc, userId);
  }
});

async function handleSummary(svc: any, userId: string, phone: string) {
  const { data: snapshot } = await svc
    .from("user_financial_snapshot")
    .select("summary, updated_at")
    .eq("phone", phone)
    .maybeSingle();

  const { data: assets } = await svc
    .from("assets")
    .select("*")
    .eq("user_id", userId)
    .order("date", { ascending: false });

  const assetMetrics = computeAssetMetrics(assets || []);

  if (snapshot?.summary) {
    return jsonRes({
      success: true,
      type: "summary",
      data: {
        financial: snapshot.summary,
        assets: assetMetrics,
        snapshot_updated_at: snapshot.updated_at,
      },
    });
  }

  await svc.rpc("rebuild_user_snapshot", { p_user_id: userId });

  const { data: fresh } = await svc
    .from("user_financial_snapshot")
    .select("summary, updated_at")
    .eq("phone", phone)
    .maybeSingle();

  return jsonRes({
    success: true,
    type: "summary",
    data: {
      financial: fresh?.summary || buildEmptySummary(phone),
      assets: assetMetrics,
      snapshot_updated_at: fresh?.updated_at || null,
    },
  });
}

function computeAssetMetrics(assets: any[]) {
  if (!assets.length) {
    return {
      total_current: 0,
      total_previous_month: 0,
      growth_absolute: 0,
      growth_percentage: 0,
      distribution_by_category: {},
      records_count: 0,
    };
  }

  const byDate = new Map<string, any[]>();
  for (const a of assets) {
    const month = a.date.slice(0, 7);
    if (!byDate.has(month)) byDate.set(month, []);
    byDate.get(month)!.push(a);
  }

  const sortedMonths = [...byDate.keys()].sort().reverse();
  const latestMonth = sortedMonths[0];
  const previousMonth = sortedMonths[1] || null;

  const latestAssets = byDate.get(latestMonth) || [];
  const previousAssets = previousMonth ? byDate.get(previousMonth) || [] : [];

  const totalCurrent = latestAssets.reduce((s: number, a: any) => s + Number(a.value), 0);
  const totalPrevious = previousAssets.reduce((s: number, a: any) => s + Number(a.value), 0);

  const distribution: Record<string, number> = {};
  for (const a of latestAssets) {
    distribution[a.category] = (distribution[a.category] || 0) + Number(a.value);
  }

  return {
    total_current: totalCurrent,
    total_previous_month: totalPrevious,
    growth_absolute: totalCurrent - totalPrevious,
    growth_percentage: totalPrevious > 0 ? Number((((totalCurrent - totalPrevious) / totalPrevious) * 100).toFixed(2)) : 0,
    distribution_by_category: distribution,
    latest_month: latestMonth,
    records_count: assets.length,
  };
}

function buildEmptySummary(phone: string) {
  return {
    phone,
    balance: 0,
    total_income: 0,
    total_expense: 0,
    total_transactions: 0,
    categories: [],
    monthly: [],
  };
}

async function handleTransactions(svc: any, userId: string) {
  const { data: transactions, error: txError } = await svc
    .from("transactions")
    .select(`
      id, type, date, amount, notes, created_at,
      category:categories(name, type),
      subcategory:subcategories(name),
      person:persons(name)
    `)
    .eq("user_id", userId)
    .order("date", { ascending: false })
    .limit(5000);

  if (txError) return jsonRes({ success: false, error: "Failed to fetch transactions." }, 500);

  const { data: assets, error: assetError } = await svc
    .from("assets")
    .select("id, category, date, value, created_at")
    .eq("user_id", userId)
    .order("date", { ascending: false })
    .limit(5000);

  if (assetError) return jsonRes({ success: false, error: "Failed to fetch assets." }, 500);

  const formattedTx = (transactions || []).map((t: any) => ({
    id: t.id,
    record_type: t.type,
    date: t.date,
    amount: t.amount,
    category: t.category?.name || null,
    subcategory: t.subcategory?.name || null,
    person: t.person?.name || null,
    notes: t.notes,
    created_at: t.created_at,
  }));

  const formattedAssets = (assets || []).map((a: any) => ({
    id: a.id,
    record_type: "asset",
    date: a.date,
    amount: a.value,
    category: a.category,
    subcategory: null,
    person: null,
    notes: null,
    created_at: a.created_at,
  }));

  return jsonRes({
    success: true,
    type: "transactions",
    data: {
      transactions: formattedTx,
      assets: formattedAssets,
      total_transactions: formattedTx.length,
      total_assets: formattedAssets.length,
    },
  });
}
