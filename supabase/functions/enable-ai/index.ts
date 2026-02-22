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
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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
 * Handles: with/without 55, with/without leading 9 after DDD, 8 or 9 digit numbers.
 * Returns null if the input cannot be parsed as a valid Brazilian mobile number.
 */
function normalizePhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  
  let local: string; // DDD + number without country code
  
  if (digits.startsWith("55") && digits.length >= 12) {
    local = digits.slice(2);
  } else if (digits.length <= 11) {
    local = digits;
  } else {
    return null;
  }
  
  // local should be DDD(2) + number(8 or 9) → 10 or 11 digits
  if (local.length === 11 && local[2] === "9") {
    // Already has 9: DDD + 9 + 8 digits — perfect
    return "55" + local;
  }
  if (local.length === 10) {
    // Missing the 9: DDD + 8 digits → insert 9 after DDD
    return "55" + local.slice(0, 2) + "9" + local.slice(2);
  }
  if (local.length === 11 && local[2] !== "9") {
    // 11 digits but third digit isn't 9 — unusual, treat as-is
    return "55" + local;
  }
  
  return null;
}

function isValidBrazilianPhone(phone: string): boolean {
  return normalizePhone(phone) !== null;
}

function generateCode(len: number): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => chars[b % chars.length]).join("");
}

function generateToken(len: number): string {
  return generateCode(len);
}

async function sha256(msg: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(msg));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function createChallenge(
  userId: string,
  codeHash: string,
  expiresAt: number,
  phone: string,
  secret: string
): Promise<string> {
  const payload = JSON.stringify({ userId, codeHash, expiresAt, phone });
  const payloadB64 = btoa(payload);
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payloadB64));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)));
  return `${payloadB64}.${sigB64}`;
}

async function verifyChallenge(
  challenge: string,
  secret: string
): Promise<{ userId: string; codeHash: string; expiresAt: number; phone: string } | null> {
  const parts = challenge.split(".");
  if (parts.length !== 2) return null;
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );
    const sigBytes = Uint8Array.from(atob(parts[1]), (c) => c.charCodeAt(0));
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      sigBytes,
      new TextEncoder().encode(parts[0])
    );
    if (!valid) return null;
    return JSON.parse(atob(parts[0]));
  } catch {
    return null;
  }
}

// Rate limiting per IP
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_GENERAL = 30;
const RATE_LIMIT_CODE = 5;
const RATE_WINDOW_MS = 60_000;

function isRateLimited(key: string, limit: number = RATE_LIMIT_GENERAL): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > limit;
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

Deno.serve(async (req) => {
  _reqRef = req;
  if (req.method === "OPTIONS") return new Response(null, { headers: getCorsHeaders(req) });
  if (req.method !== "POST") return jsonRes({ error: "Method not allowed" }, 405);

  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (isRateLimited(`ip:${clientIp}`))
    return jsonRes({ error: "Rate limit exceeded." }, 429);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer "))
    return jsonRes({ error: "Unauthorized" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
  if (claimsError || !claimsData?.claims)
    return jsonRes({ error: "Invalid token" }, 401);

  const userId = claimsData.claims.sub as string;
  const svc = createClient(supabaseUrl, serviceRoleKey);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonRes({ error: "Invalid JSON" }, 400);
  }

  const action = body.action as string;

  try {
    switch (action) {
      case "status": {
        const { data: profile } = await svc
          .from("profiles")
          .select("ai_enabled, phone")
          .eq("id", userId)
          .single();
        const { data: tokenData } = await svc
          .from("ai_tokens")
          .select("id")
          .eq("user_id", userId)
          .eq("is_active", true)
          .maybeSingle();
        return jsonRes({
          ai_enabled: profile?.ai_enabled || false,
          has_token: !!tokenData,
          phone: profile?.phone || null,
        });
      }

      case "generate-code": {
        const rawPhone = String(body.phone || "").replace(/\D/g, "");
        const phone = normalizePhone(rawPhone);
        if (!phone)
          return jsonRes({ error: "Número de telefone brasileiro inválido. Formato: 55 + DDD + número." }, 400);

        if (isRateLimited(`generate:${userId}`, RATE_LIMIT_CODE))
          return jsonRes({ error: "Muitas tentativas. Aguarde antes de solicitar novo código." }, 429);

        // Check if this canonical phone is already owned by another user
        const { data: existingOwner } = await svc
          .from("profiles")
          .select("id")
          .eq("phone", phone)
          .neq("id", userId)
          .maybeSingle();

        const code = generateCode(6);
        const codeHash = await sha256(code);
        const expiresAt = Date.now() + 5 * 60 * 1000;
        const challenge = await createChallenge(userId, codeHash, expiresAt, phone, serviceRoleKey);

        const { data: wh } = await svc
          .from("webhook_configs")
          .select("id, url")
          .eq("is_active", true)
          .limit(1)
          .maybeSingle();
        if (!wh)
          return jsonRes(
            { error: "Nenhum webhook configurado. Contate o administrador." },
            503
          );

        const { data: userData } = await svc.auth.admin.getUserById(userId);
        const userEmail = userData?.user?.email || "";

        const start = Date.now();
        let status = 0;
        let webhookSuccess = false;
        let webhookError = "";
        try {
          const res = await fetch(wh.url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code, email: userEmail, user_id: userId, phone }),
          });
          status = res.status;
          if (status >= 200 && status < 300) {
            const resText = await res.text();
            try {
              const resBody = JSON.parse(resText);
              if (resBody && resBody.success === true) {
                webhookSuccess = true;
              } else if (resBody && resBody.success === false) {
                webhookError = "Webhook retornou success: false.";
              } else {
                webhookSuccess = true;
              }
            } catch {
              webhookSuccess = true;
            }
          } else {
            webhookError = `Webhook retornou status HTTP ${status}.`;
          }
        } catch (e) {
          status = 0;
          webhookError = `Erro de conexão: ${(e as Error).message}`;
        }

        await svc.from("webhook_logs").insert({
          webhook_config_id: wh.id,
          status_code: status,
          response_time_ms: Date.now() - start,
          event_type: "ai_enablement",
          user_id: userId,
        });

        if (!webhookSuccess) {
          await svc.from("security_events").insert({
            event_type: "webhook_send_failed",
            user_id: userId,
            metadata: { reason: webhookError, webhook_id: wh.id },
          });
          return jsonRes(
            { error: `Falha ao enviar código via WhatsApp: ${webhookError}` },
            502
          );
        }

        return jsonRes({ success: true, challenge, expires_in: 300 });
      }

      case "validate-code": {
        const code = String(body.code || "").trim();
        const challenge = String(body.challenge || "");
        const rawPhone = String(body.phone || "").replace(/\D/g, "");
        const phone = normalizePhone(rawPhone);
        if (!code || !challenge)
          return jsonRes({ error: "Código e challenge são obrigatórios." }, 400);
        if (!phone)
          return jsonRes({ error: "Número de telefone inválido." }, 400);

        const blockKey = `validate:${userId}`;
        if (checkBlocked(blockKey))
          return jsonRes({ error: "Muitas tentativas inválidas. Aguarde antes de tentar novamente." }, 429);

        if (isRateLimited(`validate:${userId}`, RATE_LIMIT_CODE))
          return jsonRes({ error: "Muitas tentativas. Aguarde." }, 429);

        const cd = await verifyChallenge(challenge, serviceRoleKey);
        if (!cd)
          return jsonRes(
            { error: "Challenge inválido ou expirado. Solicite novo código." },
            400
          );
        if (cd.userId !== userId)
          return jsonRes({ error: "Challenge não corresponde ao usuário." }, 400);
        if (Date.now() > cd.expiresAt)
          return jsonRes({ error: "Código expirado. Solicite novo." }, 400);
        // Compare normalized phones (challenge phone was already normalized at generation)
        if (cd.phone !== phone)
          return jsonRes({ error: "Número de telefone não corresponde." }, 400);

        const submittedHash = await sha256(code);
        if (submittedHash !== cd.codeHash) {
          recordFailure(blockKey);
          await svc.from("security_events").insert({
            event_type: "invalid_ai_code",
            user_id: userId,
            metadata: { ip: clientIp },
          });
          return jsonRes({ error: "Código inválido." }, 400);
        }

        // --- Phone ownership transfer logic (uses canonical phone) ---
        const { data: existingOwner } = await svc
          .from("profiles")
          .select("id, email")
          .eq("phone", phone)
          .neq("id", userId)
          .maybeSingle();

        if (existingOwner) {
          await svc.from("profiles").update({ phone: null, ai_enabled: false }).eq("id", existingOwner.id);
          await svc
            .from("ai_tokens")
            .update({ is_active: false, revoked_at: new Date().toISOString() })
            .eq("user_id", existingOwner.id)
            .eq("is_active", true);
          await svc.from("security_events").insert({
            event_type: "phone_ownership_transferred",
            user_id: userId,
            metadata: {
              phone,
              previous_owner_id: existingOwner.id,
              previous_owner_email: existingOwner.email,
            },
          });
          await svc.from("security_events").insert({
            event_type: "phone_removed",
            user_id: existingOwner.id,
            metadata: {
              phone,
              new_owner_id: userId,
              reason: "ownership_transfer",
            },
          });
        }

        // Save canonical phone
        await svc.from("profiles").update({ ai_enabled: true, phone }).eq("id", userId);

        await svc
          .from("ai_tokens")
          .update({ is_active: false, revoked_at: new Date().toISOString() })
          .eq("user_id", userId)
          .eq("is_active", true);

        const permanentToken = generateToken(50);
        const tokenHash = await sha256(permanentToken);
        await svc
          .from("ai_tokens")
          .insert({ user_id: userId, token_hash: tokenHash });

        await svc.from("security_events").insert({
          event_type: "ai_enabled",
          user_id: userId,
          metadata: { phone },
        });

        return jsonRes({
          success: true,
          message: "Telefone validado e IA habilitada com sucesso.",
        });
      }

      default:
        return jsonRes({ error: "Unknown action" }, 400);
    }
  } catch (err) {
    console.error("enable-ai error:", err);
    return jsonRes({ error: "Internal server error." }, 500);
  }
});
