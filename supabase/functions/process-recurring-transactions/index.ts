import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const today = new Date().toISOString().slice(0, 10);

    // Fetch all active recurring transactions where next_due_date <= today
    const { data: recurrings, error: fetchError } = await supabase
      .from("recurring_transactions")
      .select("*")
      .eq("is_active", true)
      .lte("next_due_date", today);

    if (fetchError) throw fetchError;
    if (!recurrings || recurrings.length === 0) {
      return new Response(JSON.stringify({ message: "No recurring transactions to process", count: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let totalCreated = 0;

    for (const rec of recurrings) {
      // Check end_date
      if (rec.end_date && rec.next_due_date > rec.end_date) {
        await supabase.from("recurring_transactions").update({ is_active: false }).eq("id", rec.id);
        continue;
      }

      // Create the transaction
      const { error: insertError } = await supabase.from("transactions").insert({
        user_id: rec.user_id,
        type: rec.type,
        date: rec.next_due_date,
        amount: rec.amount,
        person_id: rec.person_id,
        category_id: rec.category_id,
        subcategory_id: rec.subcategory_id || null,
        payment_method_id: rec.payment_method_id || null,
        account_id: rec.account_id || null,
        project_id: rec.project_id || null,
        notes: rec.notes ? `${rec.notes} (recorrente)` : "Lançamento recorrente",
      });

      if (insertError) {
        console.error(`Failed to create transaction for recurring ${rec.id}:`, insertError);
        continue;
      }

      totalCreated++;

      // Calculate next due date
      const currentDate = new Date(rec.next_due_date + "T12:00:00Z");
      let nextDate: Date;

      switch (rec.frequency) {
        case "weekly":
          nextDate = new Date(currentDate);
          nextDate.setDate(nextDate.getDate() + 7 * (rec.interval_value || 1));
          break;
        case "monthly":
          nextDate = new Date(currentDate);
          nextDate.setMonth(nextDate.getMonth() + (rec.interval_value || 1));
          break;
        case "annual":
          nextDate = new Date(currentDate);
          nextDate.setFullYear(nextDate.getFullYear() + (rec.interval_value || 1));
          break;
        default:
          nextDate = new Date(currentDate);
          nextDate.setMonth(nextDate.getMonth() + 1);
      }

      const nextDueDateStr = nextDate.toISOString().slice(0, 10);

      // If next date exceeds end_date, deactivate
      if (rec.end_date && nextDueDateStr > rec.end_date) {
        await supabase.from("recurring_transactions").update({
          is_active: false,
          last_generated_at: new Date().toISOString(),
          next_due_date: nextDueDateStr,
        }).eq("id", rec.id);
      } else {
        await supabase.from("recurring_transactions").update({
          next_due_date: nextDueDateStr,
          last_generated_at: new Date().toISOString(),
        }).eq("id", rec.id);
      }
    }

    return new Response(JSON.stringify({ message: "Recurring transactions processed", count: totalCreated }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error processing recurring transactions:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
