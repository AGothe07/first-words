import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY")!;
    const ASAAS_API_URL = Deno.env.get("ASAAS_API_URL")!;
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claims.claims.sub;

    // Find user's subscription
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", userId)
      .in("status", ["active", "trial_active"])
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!sub) {
      return new Response(JSON.stringify({ error: "Nenhuma assinatura encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cancel on Asaas if exists
    if (sub.asaas_subscription_id) {
      const cancelRes = await fetch(`${ASAAS_API_URL}/subscriptions/${sub.asaas_subscription_id}`, {
        method: "DELETE",
        headers: { access_token: ASAAS_API_KEY },
      });
      if (!cancelRes.ok) {
        const errorData = await cancelRes.json();
        console.error("Asaas cancel error:", errorData);
      }
    }

    // Mark as cancelled in DB (keep access until expires)
    const serviceSupabase = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    await serviceSupabase
      .from("subscriptions")
      .update({ cancelled_at: new Date().toISOString() })
      .eq("id", sub.id);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Cancel subscription error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
