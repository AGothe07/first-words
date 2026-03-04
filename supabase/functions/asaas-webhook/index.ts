import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, asaas-access-token",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const ASAAS_WEBHOOK_SECRET = Deno.env.get("ASAAS_WEBHOOK_SECRET");
  const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY");
  const ASAAS_API_URL = Deno.env.get("ASAAS_API_URL");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const FRONTEND_URL = Deno.env.get("FRONTEND_URL") || "";

  if (!ASAAS_WEBHOOK_SECRET) {
    console.error("ASAAS_WEBHOOK_SECRET not configured - rejecting webhook");
    return new Response("Unauthorized", { status: 401 });
  }

  const token = req.headers.get("asaas-access-token");
  if (token !== ASAAS_WEBHOOK_SECRET) {
    console.error("Invalid webhook token");
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const event = await req.json();
    const eventId = event.id || `${event.event}_${Date.now()}`;
    const eventName = event.event;
    const payment = event.payment;
    const subscription = event.subscription;

    console.log(`Webhook received: ${eventName}, id: ${eventId}`);

    // Idempotency check
    const { data: existingLog } = await supabase
      .from("asaas_webhook_logs")
      .select("id")
      .eq("id", eventId)
      .single();

    if (existingLog) {
      console.log(`Event ${eventId} already processed, skipping`);
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Log the event
    await supabase.from("asaas_webhook_logs").insert({
      id: eventId,
      event_name: eventName,
      raw_payload: event,
      processed: false,
    });

    // Process event
    let processError: string | null = null;

    try {
      if (eventName === "PAYMENT_RECEIVED" || eventName === "PAYMENT_CONFIRMED") {
        await handlePaymentActivation(supabase, payment, ASAAS_API_KEY!, ASAAS_API_URL!, FRONTEND_URL);
      } else if (
        eventName === "PAYMENT_OVERDUE" ||
        eventName === "PAYMENT_DELETED" ||
        eventName === "PAYMENT_REFUNDED" ||
        eventName === "PAYMENT_CHARGEBACK_REQUESTED" ||
        eventName === "PAYMENT_CHARGEBACK_DISPUTE"
      ) {
        await handlePaymentBlock(supabase, payment, eventName);
      } else if (eventName === "SUBSCRIPTION_INACTIVATED") {
        await handleSubscriptionCancelled(supabase, subscription || payment);
      } else if (eventName === "SUBSCRIPTION_DELETED") {
        await handleSubscriptionDeleted(supabase, subscription || payment);
      } else if (eventName === "SUBSCRIPTION_CREATED") {
        await handleSubscriptionCreated(supabase, subscription || payment);
      } else if (eventName === "PAYMENT_CREATED") {
        await handlePaymentCreated(supabase, payment);
      }
    } catch (err) {
      processError = err instanceof Error ? err.message : String(err);
      console.error(`Error processing ${eventName}:`, processError);
    }

    // Mark as processed
    await supabase
      .from("asaas_webhook_logs")
      .update({
        processed: !processError,
        processed_at: new Date().toISOString(),
        error_message: processError,
      })
      .eq("id", eventId);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Webhook processing error:", error);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function findSubscription(supabase: any, payment: any) {
  // Try by externalReference (our subscription ID)
  if (payment?.externalReference) {
    const { data } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("id", payment.externalReference)
      .single();
    if (data) return data;
  }

  // Try by asaas_subscription_id
  if (payment?.subscription) {
    const { data } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("asaas_subscription_id", payment.subscription)
      .single();
    if (data) return data;
  }

  // Try by asaas_customer_id
  if (payment?.customer) {
    const { data } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("asaas_customer_id", payment.customer)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    if (data) return data;
  }

  return null;
}

async function handlePaymentActivation(
  supabase: any,
  payment: any,
  apiKey: string,
  apiUrl: string,
  frontendUrl: string
) {
  const sub = await findSubscription(supabase, payment);
  if (!sub) {
    console.error("No subscription found for payment:", payment?.id);
    return;
  }

  const email = sub.customer_email;
  const name = sub.customer_name;

  if (!email) {
    console.error("No email found for subscription:", sub.id);
    return;
  }

  // Check if user already exists
  let userId = sub.user_id;

  if (!userId) {
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(
      (u: any) => u.email?.toLowerCase() === email.toLowerCase()
    );

    if (existingUser) {
      userId = existingUser.id;
      // Unban if banned
      await supabase.auth.admin.updateUserById(userId, { ban_duration: "none" });
    } else {
      // Create user via invite (sends email with link)
      const { data: newUser, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(
        email,
        { redirectTo: `${frontendUrl}/auth` }
      );
      if (inviteError) throw new Error(`Failed to invite user: ${inviteError.message}`);
      userId = newUser.user.id;

      // Create profile
      await supabase.from("profiles").upsert({
        id: userId,
        email: email.toLowerCase(),
        display_name: name || email.split("@")[0],
      });
    }
  }

  // Calculate access_expires_at
  const now = new Date();
  let expiresAt: Date;

  if (sub.plan_type === "annual") {
    const base = sub.access_expires_at && new Date(sub.access_expires_at) > now
      ? new Date(sub.access_expires_at)
      : now;
    expiresAt = new Date(base);
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);
  } else {
    const base = sub.access_expires_at && new Date(sub.access_expires_at) > now
      ? new Date(sub.access_expires_at)
      : now;
    expiresAt = new Date(base);
    expiresAt.setMonth(expiresAt.getMonth() + 1);
  }

  // Update subscription
  await supabase
    .from("subscriptions")
    .update({
      user_id: userId,
      status: "active",
      started_at: sub.started_at || now.toISOString(),
      access_expires_at: expiresAt.toISOString(),
      last_payment_confirmed_at: now.toISOString(),
      asaas_subscription_id: payment?.subscription || sub.asaas_subscription_id,
    })
    .eq("id", sub.id);

  // Register payment
  await supabase.from("subscription_payments").insert({
    subscription_id: sub.id,
    user_id: userId,
    asaas_payment_id: payment?.id,
    asaas_subscription_id: payment?.subscription,
    amount: payment?.value || sub.value,
    net_value: payment?.netValue,
    status: "confirmed",
    billing_type: payment?.billingType,
    due_date: payment?.dueDate,
    confirmed_at: now.toISOString(),
    raw_payload: payment,
  });

  console.log(`Subscription ${sub.id} activated for user ${userId}, expires ${expiresAt.toISOString()}`);
}

async function handlePaymentBlock(supabase: any, payment: any, eventName: string) {
  const sub = await findSubscription(supabase, payment);
  if (!sub) return;

  const statusMap: Record<string, string> = {
    PAYMENT_OVERDUE: "overdue",
    PAYMENT_DELETED: "cancelled",
    PAYMENT_REFUNDED: "inactive",
    PAYMENT_CHARGEBACK_REQUESTED: "inactive",
    PAYMENT_CHARGEBACK_DISPUTE: "inactive",
  };

  const newStatus = statusMap[eventName] || "inactive";

  await supabase
    .from("subscriptions")
    .update({ status: newStatus })
    .eq("id", sub.id);

  console.log(`Subscription ${sub.id} blocked: ${newStatus} (${eventName})`);
}

async function handleSubscriptionCancelled(supabase: any, data: any) {
  const sub = await findSubscription(supabase, data);
  if (!sub) return;

  await supabase
    .from("subscriptions")
    .update({ cancelled_at: new Date().toISOString() })
    .eq("id", sub.id);

  console.log(`Subscription ${sub.id} marked as cancelled`);
}

async function handleSubscriptionDeleted(supabase: any, data: any) {
  const sub = await findSubscription(supabase, data);
  if (!sub) return;

  await supabase
    .from("subscriptions")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("id", sub.id);
}

async function handleSubscriptionCreated(supabase: any, data: any) {
  if (!data?.id || !data?.externalReference) return;

  await supabase
    .from("subscriptions")
    .update({ asaas_subscription_id: data.id })
    .eq("id", data.externalReference);
}

async function handlePaymentCreated(supabase: any, payment: any) {
  const sub = await findSubscription(supabase, payment);
  if (!sub) return;

  await supabase.from("subscription_payments").insert({
    subscription_id: sub.id,
    user_id: sub.user_id,
    asaas_payment_id: payment?.id,
    asaas_subscription_id: payment?.subscription,
    amount: payment?.value || 0,
    status: "pending",
    billing_type: payment?.billingType,
    due_date: payment?.dueDate,
    raw_payload: payment,
  });
}
