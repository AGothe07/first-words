import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CheckoutRequest {
  planType: "monthly" | "annual";
  customerData: {
    name: string;
    email: string;
    cpfCnpj: string;
    mobilePhone?: string;
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY");
    const ASAAS_API_URL = Deno.env.get("ASAAS_API_URL");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!ASAAS_API_KEY || !ASAAS_API_URL) {
      throw new Error("Asaas configuration missing");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get authenticated user if available
    const authHeader = req.headers.get("authorization");
    let authUserId: string | null = null;
    if (authHeader) {
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      const userClient = createClient(SUPABASE_URL, anonKey, {
        global: { headers: { authorization: authHeader } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      authUserId = user?.id ?? null;
    }

    const { planType, customerData } = (await req.json()) as CheckoutRequest;

    if (!planType || !customerData?.name || !customerData?.email || !customerData?.cpfCnpj) {
      return new Response(JSON.stringify({ error: "Dados obrigatórios faltando" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cpfClean = customerData.cpfCnpj.replace(/\D/g, "");
    const emailClean = customerData.email.toLowerCase().trim();

    // Cancel ALL pending subscriptions for this email
    const { data: existingSubs } = await supabase
      .from("subscriptions")
      .select("id, status, asaas_subscription_id")
      .eq("customer_email", emailClean)
      .eq("status", "pending");

    if (existingSubs && existingSubs.length > 0) {
      for (const sub of existingSubs) {
        if (sub.asaas_subscription_id) {
          await fetch(`${ASAAS_API_URL}/subscriptions/${sub.asaas_subscription_id}`, {
            method: "DELETE",
            headers: { access_token: ASAAS_API_KEY },
          });
        }
        await supabase
          .from("subscriptions")
          .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
          .eq("id", sub.id);
      }
    }

    // Block if there's an active subscription for this email
    const { data: activeSubs } = await supabase
      .from("subscriptions")
      .select("id")
      .eq("customer_email", emailClean)
      .eq("status", "active")
      .limit(1);

    if (activeSubs && activeSubs.length > 0) {
      return new Response(JSON.stringify({ error: "Já existe uma assinatura ativa para este email" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Search or create customer in Asaas
    let customerId: string;

    const searchRes = await fetch(`${ASAAS_API_URL}/customers?cpfCnpj=${cpfClean}`, {
      headers: { access_token: ASAAS_API_KEY },
    });
    const searchData = await searchRes.json();

    if (searchData.data?.length > 0) {
      customerId = searchData.data[0].id;
    } else {
      const createRes = await fetch(`${ASAAS_API_URL}/customers`, {
        method: "POST",
        headers: {
          access_token: ASAAS_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: customerData.name,
          email: customerData.email,
          cpfCnpj: cpfClean,
          mobilePhone: customerData.mobilePhone,
        }),
      });
      const createData = await createRes.json();
      if (!createRes.ok) {
        throw new Error(`Asaas customer creation failed: ${JSON.stringify(createData)}`);
      }
      customerId = createData.id;
    }

    // Plan config
    const planConfig = planType === "annual"
      ? { value: 200, cycle: "YEARLY", description: "Plano Anual" }
      : { value: 20, cycle: "MONTHLY", description: "Plano Mensal" };

    // Create pending subscription in DB — linked to user if authenticated
    const { data: subscription, error: subError } = await supabase
      .from("subscriptions")
      .insert({
        asaas_customer_id: customerId,
        plan_type: planType,
        status: "pending",
        value: planConfig.value,
        customer_email: emailClean,
        customer_name: customerData.name,
        customer_cpf_cnpj: cpfClean,
        customer_phone: customerData.mobilePhone || null,
        user_id: authUserId,
      })
      .select("id")
      .single();

    if (subError) throw new Error(`DB subscription insert failed: ${subError.message}`);

    // Create subscription in Asaas
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextDueDate = tomorrow.toISOString().split("T")[0];

    const asaasSubRes = await fetch(`${ASAAS_API_URL}/subscriptions`, {
      method: "POST",
      headers: {
        access_token: ASAAS_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        customer: customerId,
        billingType: "UNDEFINED",
        value: planConfig.value,
        nextDueDate,
        cycle: planConfig.cycle,
        description: planConfig.description,
        externalReference: subscription.id,
      }),
    });

    const asaasSubData = await asaasSubRes.json();
    if (!asaasSubRes.ok) {
      throw new Error(`Asaas subscription creation failed: ${JSON.stringify(asaasSubData)}`);
    }

    // Update subscription with Asaas ID
    await supabase
      .from("subscriptions")
      .update({ asaas_subscription_id: asaasSubData.id })
      .eq("id", subscription.id);

    // Get first payment invoice URL
    let checkoutUrl = "";
    const paymentsRes = await fetch(
      `${ASAAS_API_URL}/subscriptions/${asaasSubData.id}/payments?limit=1`,
      { headers: { access_token: ASAAS_API_KEY } }
    );
    const paymentsData = await paymentsRes.json();

    if (paymentsData.data?.length > 0) {
      checkoutUrl = paymentsData.data[0].invoiceUrl || "";
    }

    return new Response(
      JSON.stringify({
        checkoutUrl,
        subscriptionId: subscription.id,
        customerId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("asaas-create-checkout error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
