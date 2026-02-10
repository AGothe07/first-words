import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Simple in-memory rate limiter (per function instance)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 30; // max requests
const RATE_WINDOW_MS = 60_000; // per minute

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

// Duplicate detection window (same user+amount+date+category within 30s)
const recentInserts = new Map<string, number>();
const DEDUP_WINDOW_MS = 30_000;

function isDuplicate(fingerprint: string): boolean {
  const now = Date.now();
  // Clean old entries
  for (const [k, ts] of recentInserts) {
    if (now - ts > DEDUP_WINDOW_MS) recentInserts.delete(k);
  }
  if (recentInserts.has(fingerprint)) return true;
  recentInserts.set(fingerprint, now);
  return false;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed. Use POST." }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Auth check
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(
      JSON.stringify({ error: "Missing or invalid Authorization header. Use Bearer <access_token>." }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
  if (claimsError || !claimsData?.claims) {
    return new Response(
      JSON.stringify({ error: "Invalid or expired token." }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const userId = claimsData.claims.sub as string;

  // Rate limit by user
  if (isRateLimited(userId)) {
    return new Response(
      JSON.stringify({ error: "Rate limit exceeded. Max 30 requests per minute." }),
      { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Parse body
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const errors: string[] = [];

  // Validate type
  const type = body.type as string | undefined;
  if (!type || !["expense", "income"].includes(type)) {
    errors.push("'type' is required and must be 'expense' or 'income'.");
  }

  // Validate amount
  let amount: number | null = null;
  if (body.amount === undefined || body.amount === null) {
    errors.push("'amount' is required.");
  } else {
    const raw = String(body.amount).replace(",", ".");
    amount = parseFloat(raw);
    if (isNaN(amount) || amount <= 0) {
      errors.push("'amount' must be a positive number.");
    }
  }

  // Validate date (optional, defaults to today)
  let date: string;
  if (body.date) {
    const dateStr = String(body.date);
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateStr) || isNaN(new Date(dateStr).getTime())) {
      errors.push("'date' must be a valid date in YYYY-MM-DD format.");
    }
    date = dateStr;
  } else {
    date = new Date().toISOString().slice(0, 10);
  }

  // Validate person (by name)
  const personName = body.person as string | undefined;
  if (!personName || String(personName).trim().length === 0) {
    errors.push("'person' is required (name of the person).");
  }

  // Validate category (by name)
  const categoryName = body.category as string | undefined;
  if (!categoryName || String(categoryName).trim().length === 0) {
    errors.push("'category' is required (name of the category).");
  }

  // Subcategory optional
  const subcategoryName = body.subcategory as string | undefined;
  const notes = body.notes ? String(body.notes).slice(0, 500) : null;

  if (errors.length > 0) {
    return new Response(
      JSON.stringify({ error: "Validation failed.", details: errors }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Look up person by name
  const { data: personRows, error: personErr } = await supabase
    .from("persons")
    .select("id")
    .eq("user_id", userId)
    .ilike("name", String(personName).trim())
    .limit(1);

  if (personErr || !personRows?.length) {
    return new Response(
      JSON.stringify({ error: `Person '${personName}' not found. Create it first.` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  const personId = personRows[0].id;

  // Look up category by name + type
  const { data: catRows, error: catErr } = await supabase
    .from("categories")
    .select("id")
    .eq("user_id", userId)
    .eq("type", type!)
    .ilike("name", String(categoryName).trim())
    .limit(1);

  if (catErr || !catRows?.length) {
    return new Response(
      JSON.stringify({ error: `Category '${categoryName}' of type '${type}' not found. Create it first.` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  const categoryId = catRows[0].id;

  // Look up subcategory if provided
  let subcategoryId: string | null = null;
  if (subcategoryName && String(subcategoryName).trim().length > 0) {
    const { data: subRows, error: subErr } = await supabase
      .from("subcategories")
      .select("id")
      .eq("user_id", userId)
      .eq("category_id", categoryId)
      .ilike("name", String(subcategoryName).trim())
      .limit(1);

    if (subErr || !subRows?.length) {
      return new Response(
        JSON.stringify({ error: `Subcategory '${subcategoryName}' not found under category '${categoryName}'.` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    subcategoryId = subRows[0].id;
  }

  // Duplicate check
  const fingerprint = `${userId}:${amount}:${date}:${categoryId}:${personId}`;
  if (isDuplicate(fingerprint)) {
    return new Response(
      JSON.stringify({ error: "Duplicate detected. Same transaction was submitted within the last 30 seconds." }),
      { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Insert transaction
  const { data: inserted, error: insertErr } = await supabase
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
    return new Response(
      JSON.stringify({ error: "Failed to insert transaction.", details: insertErr.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({
      success: true,
      message: "Transaction created successfully.",
      transaction: inserted,
    }),
    { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
