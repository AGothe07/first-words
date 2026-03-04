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
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { name, email, password } = await req.json();

    if (!name || !email || !password) {
      return new Response(JSON.stringify({ error: "Nome, email e senha são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if email already used trial
    const { data: trialUsed } = await supabase.rpc("email_has_used_trial", { _email: normalizedEmail });
    if (trialUsed) {
      return new Response(JSON.stringify({ error: "Este email já utilizou o período de teste" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if user already exists
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(
      (u: any) => u.email?.toLowerCase() === normalizedEmail
    );

    let userId: string;

    if (existingUser) {
      // User exists but never had trial — check if they have any subscription
      const { data: existingSub } = await supabase
        .from("subscriptions")
        .select("id")
        .eq("user_id", existingUser.id)
        .limit(1);

      if (existingSub && existingSub.length > 0) {
        return new Response(JSON.stringify({ error: "Este email já possui uma conta com assinatura" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      userId = existingUser.id;

      // Update profile
      await supabase.from("profiles").upsert({
        id: userId,
        email: normalizedEmail,
        display_name: name,
      });
    } else {
      // Create new user
      const { data: newUser, error: signUpError } = await supabase.auth.admin.createUser({
        email: normalizedEmail,
        password,
        email_confirm: true,
        user_metadata: { display_name: name },
      });

      if (signUpError) {
        throw new Error(`Failed to create user: ${signUpError.message}`);
      }

      userId = newUser.user.id;

      // Update profile
      await supabase.from("profiles").upsert({
        id: userId,
        email: normalizedEmail,
        display_name: name,
      });
    }

    // Create trial subscription
    const now = new Date();
    const trialEndsAt = new Date(now);
    trialEndsAt.setDate(trialEndsAt.getDate() + 3);

    await supabase.from("subscriptions").insert({
      user_id: userId,
      plan_type: "monthly",
      status: "trial_active",
      value: 0,
      trial_started_at: now.toISOString(),
      trial_ends_at: trialEndsAt.toISOString(),
      trial_used: true,
      customer_email: normalizedEmail,
      customer_name: name,
      started_at: now.toISOString(),
    });

    return new Response(
      JSON.stringify({
        success: true,
        userId,
        trialEndsAt: trialEndsAt.toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Start trial error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
