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

function generateToken(length: number): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => chars[b % chars.length]).join("");
}

async function sha256(msg: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(msg));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  _reqRef = req;
  if (req.method === "OPTIONS") return new Response(null, { headers: getCorsHeaders(req) });
  if (req.method !== "POST") return jsonRes({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer "))
    return jsonRes({ error: "Unauthorized" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
  if (claimsError || !claimsData?.claims)
    return jsonRes({ error: "Invalid token" }, 401);

  const callerId = claimsData.claims.sub as string;
  const svc = createClient(supabaseUrl, serviceRoleKey);

  // Verify admin
  const { data: roleData } = await svc
    .from("user_roles")
    .select("role")
    .eq("user_id", callerId)
    .eq("role", "admin");
  if (!roleData?.length) return jsonRes({ error: "Forbidden" }, 403);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonRes({ error: "Invalid JSON" }, 400);
  }

  const action = body.action as string;
  const targetUserId = body.userId as string | undefined;

  try {
    switch (action) {
      case "list": {
        const {
          data: { users },
          error,
        } = await svc.auth.admin.listUsers({ perPage: 1000 });
        if (error) throw error;

        const { data: profiles } = await svc.from("profiles").select("*");
        const { data: tokens } = await svc
          .from("ai_tokens")
          .select("user_id, is_active, created_at")
          .eq("is_active", true);
        const { data: roles } = await svc
          .from("user_roles")
          .select("user_id, role");

        const enriched = users.map((u: any) => {
          const profile = profiles?.find((p: any) => p.id === u.id);
          const activeToken = tokens?.find((t: any) => t.user_id === u.id);
          const userRoles =
            roles
              ?.filter((r: any) => r.user_id === u.id)
              .map((r: any) => r.role) || [];
          return {
            id: u.id,
            email: u.email,
            created_at: u.created_at,
            email_confirmed_at: u.email_confirmed_at,
            last_sign_in_at: u.last_sign_in_at,
            banned_until: u.banned_until,
            display_name: profile?.display_name,
            ai_enabled: profile?.ai_enabled || false,
            phone: profile?.phone || null,
            last_activity: profile?.last_activity,
            has_active_token: !!activeToken,
            roles: userRoles,
          };
        });
        return jsonRes({ users: enriched });
      }

      case "deactivate": {
        if (!targetUserId) throw new Error("userId required");
        if (targetUserId === callerId)
          throw new Error("Cannot deactivate yourself");
        const { error } = await svc.auth.admin.updateUserById(targetUserId, {
          ban_duration: "876000h",
        });
        if (error) throw error;
        await svc.from("security_events").insert({
          event_type: "user_deactivated",
          user_id: targetUserId,
          metadata: { by: callerId },
        });
        return jsonRes({ success: true });
      }

      case "activate": {
        if (!targetUserId) throw new Error("userId required");
        const { error } = await svc.auth.admin.updateUserById(targetUserId, {
          ban_duration: "none",
        });
        if (error) throw error;
        await svc.from("security_events").insert({
          event_type: "user_activated",
          user_id: targetUserId,
          metadata: { by: callerId },
        });
        return jsonRes({ success: true });
      }

      case "delete": {
        if (!targetUserId) throw new Error("userId required");
        if (targetUserId === callerId)
          throw new Error("Cannot delete yourself");
        const { error } = await svc.auth.admin.deleteUser(targetUserId);
        if (error) throw error;
        await svc.from("security_events").insert({
          event_type: "user_deleted",
          user_id: targetUserId,
          metadata: { by: callerId },
        });
        return jsonRes({ success: true });
      }

      case "revoke-token": {
        if (!targetUserId) throw new Error("userId required");
        await svc
          .from("ai_tokens")
          .update({
            is_active: false,
            revoked_at: new Date().toISOString(),
            revoked_by: callerId,
          })
          .eq("user_id", targetUserId)
          .eq("is_active", true);
        await svc
          .from("profiles")
          .update({ ai_enabled: false })
          .eq("id", targetUserId);
        await svc.from("security_events").insert({
          event_type: "token_revoked",
          user_id: targetUserId,
          metadata: { by: callerId },
        });
        return jsonRes({ success: true });
      }

      case "regenerate-token": {
        if (!targetUserId) throw new Error("userId required");
        await svc
          .from("ai_tokens")
          .update({
            is_active: false,
            revoked_at: new Date().toISOString(),
            revoked_by: callerId,
          })
          .eq("user_id", targetUserId)
          .eq("is_active", true);

        const newToken = generateToken(50);
        const tokenHash = await sha256(newToken);
        await svc
          .from("ai_tokens")
          .insert({ user_id: targetUserId, token_hash: tokenHash });
        await svc
          .from("profiles")
          .update({ ai_enabled: true })
          .eq("id", targetUserId);
        await svc.from("security_events").insert({
          event_type: "token_regenerated",
          user_id: targetUserId,
          metadata: { by: callerId },
        });
        return jsonRes({ success: true });
      }

      case "block-api": {
        if (!targetUserId) throw new Error("userId required");
        await svc
          .from("ai_tokens")
          .update({
            is_active: false,
            revoked_at: new Date().toISOString(),
            revoked_by: callerId,
          })
          .eq("user_id", targetUserId)
          .eq("is_active", true);
        await svc
          .from("profiles")
          .update({ ai_enabled: false })
          .eq("id", targetUserId);
        await svc.from("security_events").insert({
          event_type: "api_blocked",
          user_id: targetUserId,
          metadata: { by: callerId },
        });
        return jsonRes({ success: true });
      }

      case "remove-phone": {
        if (!targetUserId) throw new Error("userId required");
        // Remove phone and disable AI
        await svc
          .from("profiles")
          .update({ phone: null, ai_enabled: false })
          .eq("id", targetUserId);
        // Revoke tokens
        await svc
          .from("ai_tokens")
          .update({ is_active: false, revoked_at: new Date().toISOString(), revoked_by: callerId })
          .eq("user_id", targetUserId)
          .eq("is_active", true);
        await svc.from("security_events").insert({
          event_type: "phone_removed_by_admin",
          user_id: targetUserId,
          metadata: { by: callerId },
        });
        return jsonRes({ success: true });
      }

      default:
        return jsonRes({ error: "Unknown action" }, 400);
    }
  } catch (err) {
    console.error("admin-users error:", err);
    return jsonRes({ error: "Internal server error." }, 500);
  }
});
