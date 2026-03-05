import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function isAllowedOrigin(origin: string): boolean {
  if (!origin) return false;
  const allowed = [
    "financial.lendscope.com.br",
    "n8n-n8n.czby9f.easypanel.host",
    "mono-form-awe.lovable.app",
  ];
  if (allowed.some((d) => origin === `https://${d}`)) return true;
  // Allow all lovable preview/project domains
  if (/^https:\/\/.*\.lovable\.app$/.test(origin)) return true;
  if (/^https:\/\/.*\.lovableproject\.com$/.test(origin)) return true;
  return false;
}

function getCorsHeaders(req?: Request) {
  const origin = req?.headers.get("Origin") || "";
  const allowedOrigin = isAllowedOrigin(origin) ? origin : "https://financial.lendscope.com.br";
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
        const { data: subs } = await svc
          .from("subscriptions")
          .select("user_id, status, manual_access_expires_at, access_expires_at, trial_ends_at");

        const { data: waInstances } = await svc
          .from("whatsapp_instances")
          .select("user_id, instance_name, status");

        const enriched = users.map((u: any) => {
          const profile = profiles?.find((p: any) => p.id === u.id);
          const activeToken = tokens?.find((t: any) => t.user_id === u.id);
          const userRoles =
            roles
              ?.filter((r: any) => r.user_id === u.id)
              .map((r: any) => r.role) || [];
          const sub = subs?.find((s: any) => s.user_id === u.id);
          const waInst = waInstances?.find((w: any) => w.user_id === u.id);
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
            subscription_status: sub?.status || null,
            manual_access_expires_at: sub?.manual_access_expires_at || null,
            access_expires_at: sub?.access_expires_at || null,
            trial_ends_at: sub?.trial_ends_at || null,
            has_whatsapp_instance: !!waInst,
            whatsapp_instance_name: waInst?.instance_name || null,
            whatsapp_status: waInst?.status || null,
          };
        });
        return jsonRes({ users: enriched });
      }

      case "create-user": {
        const email = body.email as string;
        const password = body.password as string;
        const displayName = body.displayName as string | undefined;
        if (!email || !password) throw new Error("email and password required");

        const { data: newUser, error } = await svc.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { display_name: displayName || email.split("@")[0] },
        });
        if (error) throw error;

        await svc.from("security_events").insert({
          event_type: "user_created_by_admin",
          user_id: newUser.user?.id,
          metadata: { by: callerId, email },
        });
        return jsonRes({ success: true, userId: newUser.user?.id });
      }

      case "grant-access": {
        if (!targetUserId) throw new Error("userId required");
        const days = body.days as number;
        if (!days || days < 1 || days > 365) throw new Error("days must be 1-365");

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + days);

        // Check if subscription exists
        const { data: existingSub } = await svc
          .from("subscriptions")
          .select("id, manual_access_expires_at")
          .eq("user_id", targetUserId)
          .limit(1)
          .maybeSingle();

        if (existingSub) {
          // If there's already manual access, extend from that date
          let baseDate = new Date();
          if (existingSub.manual_access_expires_at && new Date(existingSub.manual_access_expires_at) > baseDate) {
            baseDate = new Date(existingSub.manual_access_expires_at);
          }
          baseDate.setDate(baseDate.getDate() + days);

          await svc
            .from("subscriptions")
            .update({ manual_access_expires_at: baseDate.toISOString() })
            .eq("id", existingSub.id);
        } else {
          // Create a subscription record with manual access
          await svc.from("subscriptions").insert({
            user_id: targetUserId,
            status: "active",
            plan_type: "monthly",
            value: 0,
            manual_access_expires_at: expiresAt.toISOString(),
          });
        }

        await svc.from("security_events").insert({
          event_type: "manual_access_granted",
          user_id: targetUserId,
          metadata: { by: callerId, days },
        });
        return jsonRes({ success: true });
      }

      case "revoke-access": {
        if (!targetUserId) throw new Error("userId required");

        const { data: sub } = await svc
          .from("subscriptions")
          .select("id")
          .eq("user_id", targetUserId)
          .limit(1)
          .maybeSingle();

        if (sub) {
          await svc
            .from("subscriptions")
            .update({ manual_access_expires_at: new Date().toISOString() })
            .eq("id", sub.id);
        }

        await svc.from("security_events").insert({
          event_type: "manual_access_revoked",
          user_id: targetUserId,
          metadata: { by: callerId },
        });
        return jsonRes({ success: true });
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
        await svc
          .from("profiles")
          .update({ phone: null, ai_enabled: false })
          .eq("id", targetUserId);
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

      case "delete-whatsapp-instance": {
        if (!targetUserId) throw new Error("userId required");

        // Fetch instance details
        const { data: waInstance } = await svc
          .from("whatsapp_instances")
          .select("id, token, instance_name")
          .eq("user_id", targetUserId)
          .limit(1)
          .maybeSingle();

        if (!waInstance) throw new Error("Nenhuma instância encontrada para este usuário");

        // Fetch api_key_admin from admin_settings
        const { data: apiKeySetting } = await svc
          .from("admin_settings")
          .select("setting_value")
          .eq("setting_key", "api_key_admin")
          .limit(1)
          .maybeSingle();

        // Fetch webhook URL for deletion
        const { data: whDeleteHook } = await svc
          .from("webhook_configs")
          .select("url")
          .eq("function_key", "whatsapp_delete")
          .eq("is_active", true)
          .limit(1)
          .maybeSingle();

        // Call external webhook to delete the instance
        if (whDeleteHook?.url) {
          try {
            await fetch(whDeleteHook.url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                token: waInstance.token,
                instance_name: waInstance.instance_name,
                instance_id: waInstance.id,
                user_id: targetUserId,
                api_key_admin: apiKeySetting?.setting_value || "",
              }),
            });
          } catch (e) {
            console.error("Webhook delete call failed:", e);
          }
        }

        // Delete from DB
        await svc
          .from("whatsapp_instances")
          .delete()
          .eq("user_id", targetUserId);

        await svc.from("security_events").insert({
          event_type: "whatsapp_instance_deleted_by_admin",
          user_id: targetUserId,
          metadata: { by: callerId, instance_name: waInstance.instance_name, token: waInstance.token },
        });
        return jsonRes({ success: true });
      }

      case "get-admin-settings": {
        const { data: adminSettings } = await svc
          .from("admin_settings")
          .select("setting_key, setting_value")
          .in("setting_key", ["api_key_admin", "instance_token_system"]);
        const result: Record<string, string> = {};
        adminSettings?.forEach((s: any) => { result[s.setting_key] = s.setting_value; });
        return jsonRes({ settings: result });
      }

      default:
        return jsonRes({ error: "Unknown action" }, 400);
    }
  } catch (err) {
    console.error("admin-users error:", err);
    return jsonRes({ error: "Internal server error." }, 500);
  }
});
