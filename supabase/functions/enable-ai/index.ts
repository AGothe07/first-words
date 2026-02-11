import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonRes(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
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

function isValidBrazilianPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, "");
  return /^55\d{10,11}$/.test(digits);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonRes({ error: "Method not allowed" }, 405);

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
        const phone = String(body.phone || "").replace(/\D/g, "");
        if (!isValidBrazilianPhone(phone))
          return jsonRes({ error: "Número de telefone brasileiro inválido. Formato: 55 + DDD + número." }, 400);

        // Allow re-verification for phone change even if AI is already enabled

        const code = generateCode(6);
        const codeHash = await sha256(code);
        const expiresAt = Date.now() + 5 * 60 * 1000;
        const challenge = await createChallenge(userId, codeHash, expiresAt, phone, serviceRoleKey);

        // Get active webhook
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

        // Call webhook with phone number
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
            // Read body as text first, then try to parse as JSON
            const resText = await res.text();
            try {
              const resBody = JSON.parse(resText);
              if (resBody && resBody.success === true) {
                webhookSuccess = true;
              } else if (resBody && resBody.success === false) {
                webhookError = "Webhook retornou success: false.";
              } else {
                // JSON response without explicit success field — treat 2xx as success
                webhookSuccess = true;
              }
            } catch {
              // Not JSON — accept 2xx as success if body is not explicitly an error
              webhookSuccess = true;
            }
          } else {
            webhookError = `Webhook retornou status HTTP ${status}.`;
          }
        } catch (e) {
          status = 0;
          webhookError = `Erro de conexão: ${(e as Error).message}`;
        }

        // Log metadata only (never store the code)
        await svc.from("webhook_logs").insert({
          webhook_config_id: wh.id,
          status_code: status,
          response_time_ms: Date.now() - start,
          event_type: "ai_enablement",
          user_id: userId,
        });

        if (!webhookSuccess) {
          // Log failure event for audit
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
        const phone = String(body.phone || "").replace(/\D/g, "");
        if (!code || !challenge)
          return jsonRes({ error: "Código e challenge são obrigatórios." }, 400);

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
        if (cd.phone !== phone)
          return jsonRes({ error: "Número de telefone não corresponde." }, 400);

        const submittedHash = await sha256(code);
        if (submittedHash !== cd.codeHash) {
          await svc.from("security_events").insert({
            event_type: "invalid_ai_code",
            user_id: userId,
          });
          return jsonRes({ error: "Código inválido." }, 400);
        }

        // --- Phone ownership transfer logic ---
        // Check if this phone is already owned by another user
        const { data: existingOwner } = await svc
          .from("profiles")
          .select("id, email")
          .eq("phone", phone)
          .neq("id", userId)
          .maybeSingle();

        if (existingOwner) {
          // Remove phone from previous owner
          await svc.from("profiles").update({ phone: null, ai_enabled: false }).eq("id", existingOwner.id);
          // Revoke previous owner's tokens
          await svc
            .from("ai_tokens")
            .update({ is_active: false, revoked_at: new Date().toISOString() })
            .eq("user_id", existingOwner.id)
            .eq("is_active", true);
          // Audit: phone ownership transferred
          await svc.from("security_events").insert({
            event_type: "phone_ownership_transferred",
            user_id: userId,
            metadata: {
              phone,
              previous_owner_id: existingOwner.id,
              previous_owner_email: existingOwner.email,
            },
          });
          // Audit: phone removed from previous owner
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

        // Enable AI and save phone for current user
        await svc.from("profiles").update({ ai_enabled: true, phone }).eq("id", userId);

        // Revoke old tokens
        await svc
          .from("ai_tokens")
          .update({ is_active: false, revoked_at: new Date().toISOString() })
          .eq("user_id", userId)
          .eq("is_active", true);

        // Create permanent token
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
    return jsonRes({ error: (err as Error).message }, 500);
  }
});
