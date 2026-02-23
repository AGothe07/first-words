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
  if (local.length === 11 && local[2] === "9") return "55" + local;
  if (local.length === 10) return "55" + local.slice(0, 2) + "9" + local.slice(2);
  if (local.length === 11 && local[2] !== "9") return "55" + local;
  return null;
}

// ── Rate limiting ──
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
  if (Date.now() > entry.blockedUntil) { failedAttempts.delete(key); return false; }
  return true;
}

function recordFailure(key: string) {
  const entry = failedAttempts.get(key) || { count: 0, blockedUntil: 0 };
  entry.count++;
  const delays = [30, 60, 120, 300, 600];
  entry.blockedUntil = Date.now() + delays[Math.min(entry.count - 1, delays.length - 1)] * 1000;
  failedAttempts.set(key, entry);
}

async function sha256(msg: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(msg));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

// ── Valid fields for selective query ──
const VALID_FIELDS = [
  "overview", "current_month", "monthly_history", "categories",
  "category_trends", "patrimony", "recent_transactions", "insights",
  "ingest_schema",
] as const;

// Fields that are stored as text (not JSON)
const TEXT_FIELDS: Set<string> = new Set(["ingest_schema"]);
type SnapshotField = typeof VALID_FIELDS[number];

const ALL_SNAPSHOT_COLUMNS = "overview, current_month, monthly_history, categories, category_trends, patrimony, recent_transactions, insights, updated_at";
const DEFAULT_FIELDS: SnapshotField[] = ["overview", "current_month"];

Deno.serve(async (req) => {
  _reqRef = req;
  if (req.method === "OPTIONS") return new Response(null, { headers: getCorsHeaders(req) });
  if (req.method !== "POST") return jsonRes({ error: "Method not allowed. Use POST." }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return jsonRes({ error: "Unauthorized" }, 401);

  const adminToken = Deno.env.get("EXTERNAL_API_ADMIN_TOKEN");
  if (!adminToken || authHeader !== `Bearer ${adminToken}`) return jsonRes({ error: "Unauthorized" }, 401);

  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const svc = createClient(supabaseUrl, serviceRoleKey);

  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (isRateLimited(`ip:${clientIp}`)) return jsonRes({ error: "Rate limit exceeded." }, 429);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return jsonRes({ error: "Invalid JSON body." }, 400); }

  // ── Resolve phone (obrigatório) ──
  const rawPhone = body.phone_number ? String(body.phone_number).replace(/\D/g, "") : null;
  if (!rawPhone) return jsonRes({ error: "Missing phone_number." }, 400);

  const phone = normalizePhone(rawPhone);
  if (!phone) return jsonRes({ error: "Invalid phone number format." }, 400);

  if (isRateLimited(`phone:${phone}`)) return jsonRes({ error: "Rate limit exceeded." }, 429);

  // ── Parse requested fields ──
  const requestedFields: SnapshotField[] = (() => {
    const raw = body.fields;
    if (!raw) return DEFAULT_FIELDS;
    if (typeof raw === "string") {
      if (raw === "all") return [...VALID_FIELDS];
      if (VALID_FIELDS.includes(raw as SnapshotField)) return [raw as SnapshotField];
      return DEFAULT_FIELDS;
    }
    if (Array.isArray(raw)) {
      const valid = raw.filter((f): f is SnapshotField => VALID_FIELDS.includes(f as SnapshotField));
      return valid.length > 0 ? valid : DEFAULT_FIELDS;
    }
    return DEFAULT_FIELDS;
  })();

  const selectCols = requestedFields.join(", ") + ", updated_at, user_id";

  const forceRebuild = body.force_rebuild === true;

  // ── Force rebuild if requested ──
  if (forceRebuild) {
    const { data: profile } = await svc.from("profiles").select("id").eq("phone", phone).maybeSingle();
    if (profile) {
      console.log("Force rebuilding snapshot for user:", profile.id);
      const { error: rpcError } = await svc.rpc("rebuild_user_snapshot", { p_user_id: profile.id });
      if (rpcError) {
        console.error("RPC rebuild error:", JSON.stringify(rpcError));
      } else {
        console.log("Snapshot rebuilt successfully");
      }
    } else {
      console.log("No profile found for phone:", phone);
    }
  }

  // ── Fetch snapshot by phone ──
  const { data: snapshot, error: snapError } = await svc
    .from("user_financial_snapshot")
    .select(selectCols)
    .eq("phone", phone)
    .maybeSingle();

  // Update last_activity
  const snapshotData = snapshot as Record<string, unknown> | null;
  if (snapshotData?.user_id) {
    await svc.from("profiles").update({ last_activity: new Date().toISOString() }).eq("id", snapshotData.user_id as string);
  }

  // If no snapshot exists, try to rebuild
  if (!snapshot || snapError) {
    const { data: profile } = await svc.from("profiles").select("id").eq("phone", phone).maybeSingle();
    if (!profile) return jsonRes({ error: "No user found for this phone number." }, 404);

    await svc.rpc("rebuild_user_snapshot", { p_user_id: profile.id });

    const { data: fresh } = await svc
      .from("user_financial_snapshot")
      .select(selectCols)
      .eq("phone", phone)
      .maybeSingle();

    if (!fresh) {
      const emptyData: Record<string, unknown> = {};
      for (const f of requestedFields) {
        emptyData[f] = ["monthly_history", "category_trends", "recent_transactions"].includes(f) ? [] : {};
      }
      return jsonRes({ success: true, phone, data: emptyData, snapshot_updated_at: null });
    }

    const data: Record<string, unknown> = {};
    const freshData = fresh as unknown as Record<string, unknown>;
    for (const f of requestedFields) data[f] = freshData[f];
    return jsonRes({ success: true, phone, data, snapshot_updated_at: freshData.updated_at });
  }

  // ── Build selective response ──
  const data: Record<string, unknown> = {};
  for (const f of requestedFields) data[f] = snapshotData![f];

  return jsonRes({
    success: true,
    phone,
    data,
    fields_returned: requestedFields,
    snapshot_updated_at: snapshotData!.updated_at,
  });
});
