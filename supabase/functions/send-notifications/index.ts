import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Get current date/time in Brazil timezone */
function getBrazilNow(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
}

/** Format date as YYYY-MM-DD */
function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Convert reminder_unit to milliseconds multiplier */
function reminderOffsetMs(value: number, unit: string): number {
  switch (unit) {
    case "minutes": return value * 60 * 1000;
    case "hours": return value * 60 * 60 * 1000;
    case "days": return value * 24 * 60 * 60 * 1000;
    default: return 0;
  }
}

async function getWebhookUrl(supabase: any, functionKey: string): Promise<string | null> {
  const { data } = await supabase
    .from("webhook_configs")
    .select("url")
    .eq("function_key", functionKey)
    .eq("is_active", true)
    .maybeSingle();
  return data?.url || null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Load webhook URLs from DB
  const BIRTHDAY_WEBHOOK_URL = await getWebhookUrl(supabase, "birthday_notification");
  const EVENT_WEBHOOK_URL = await getWebhookUrl(supabase, "event_notification");

  const nowBrazil = getBrazilNow();
  const brazilHour = nowBrazil.getHours();
  const brazilMinute = nowBrazil.getMinutes();
  const todayStr = toDateStr(nowBrazil);
  const todayMonth = nowBrazil.getMonth() + 1;
  const todayDay = nowBrazil.getDate();

  const results: { sent: number; errors: number; details: string[] } = { sent: 0, errors: 0, details: [] };

  const nowTotalMinutes = brazilHour * 60 + brazilMinute;

  try {
    // ========================
    // 1. BIRTHDAY NOTIFICATIONS
    // ========================
    if (brazilHour === 10 && brazilMinute < 5) {
      if (!BIRTHDAY_WEBHOOK_URL) {
        results.details.push("Birthday webhook URL not configured in admin panel");
      } else {
        const { data: birthdaySettings } = await supabase
          .from("notification_settings")
          .select("*")
          .eq("setting_type", "birthday")
          .eq("is_active", true);

        for (const setting of birthdaySettings || []) {
          const { data: events } = await supabase
            .from("important_events")
            .select("*")
            .eq("user_id", setting.user_id)
            .eq("auto_notify", true)
            .not("phone", "is", null);

          for (const event of events || []) {
            if (!event.phone) continue;

            const eventDate = new Date(event.event_date + "T00:00:00");
            const eventMonth = eventDate.getMonth() + 1;
            const eventDay = eventDate.getDate();

            let nextOccurrence = new Date(nowBrazil.getFullYear(), eventMonth - 1, eventDay);
            if (nextOccurrence < new Date(nowBrazil.getFullYear(), nowBrazil.getMonth(), nowBrazil.getDate())) {
              nextOccurrence = new Date(nowBrazil.getFullYear() + 1, eventMonth - 1, eventDay);
            }
            const daysUntil = Math.round(
              (nextOccurrence.getTime() - new Date(nowBrazil.getFullYear(), nowBrazil.getMonth(), nowBrazil.getDate()).getTime())
              / (1000 * 60 * 60 * 24)
            );

            const shouldSendToday = setting.send_on_day && daysUntil === 0;
            const shouldSendBefore = (setting.send_days_before > 0) && daysUntil === setting.send_days_before;
            const shouldSendBoth_day = setting.send_both && daysUntil === 0;
            const shouldSendBoth_before = setting.send_both && setting.send_days_before > 0 && daysUntil === setting.send_days_before;

            const sends: { type: string; isAdvance: boolean }[] = [];
            if (shouldSendToday || shouldSendBoth_day) sends.push({ type: "on_day", isAdvance: false });
            if (shouldSendBefore || shouldSendBoth_before) sends.push({ type: "before", isAdvance: true });

            for (const send of sends) {
              const { data: existing } = await supabase
                .from("notification_log")
                .select("id")
                .eq("source_id", event.id)
                .eq("send_type", send.type)
                .eq("event_date", todayStr)
                .maybeSingle();

              if (existing) continue;

              const age = event.event_type === "birthday"
                ? nowBrazil.getFullYear() - eventDate.getFullYear()
                : null;

              let message = setting.message_template || "Feliz aniversário, {nome}!";
              message = message.replace(/{nome}/g, event.person_name || event.title);
              message = message.replace(/{idade}/g, age !== null ? String(age) : "");
              message = message.replace(/{data}/g, `${String(eventDay).padStart(2, "0")}/${String(eventMonth).padStart(2, "0")}`);

              const { data: waInstance } = await supabase
                .from("whatsapp_instances")
                .select("token")
                .eq("user_id", setting.user_id)
                .eq("status", "connected")
                .maybeSingle();

              const payload = {
                nome: event.person_name || event.title,
                celular: event.phone,
                mensagem: message,
                data_aniversario: event.event_date,
                envio_antecipado: send.isAdvance,
                token: waInstance?.token || null,
              };

              try {
                const resp = await fetch(BIRTHDAY_WEBHOOK_URL, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(payload),
                });

                await supabase.from("notification_log").insert({
                  user_id: setting.user_id,
                  source_type: "birthday",
                  source_id: event.id,
                  send_type: send.type,
                  event_date: todayStr,
                  webhook_status: resp.status,
                });

                results.sent++;
                results.details.push(`Birthday: ${event.title} (${send.type})`);
              } catch (err: unknown) {
                results.errors++;
                results.details.push(`Error birthday ${event.title}: ${err instanceof Error ? err.message : String(err)}`);
              }
            }
          }
        }
      }
    } else {
      results.details.push(`Birthday skip: Brazil time is ${brazilHour}:${String(brazilMinute).padStart(2, "0")}, only runs at 10:00-10:04`);
    }

    // ========================
    // 2. AGENDA NOTIFICATIONS
    // ========================
    if (!EVENT_WEBHOOK_URL) {
      results.details.push("Event webhook URL not configured in admin panel");
    } else {
      const { data: eventSettings } = await supabase
        .from("notification_settings")
        .select("*")
        .eq("setting_type", "event")
        .eq("is_active", true);

      for (const setting of eventSettings || []) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("phone")
          .eq("id", setting.user_id)
          .maybeSingle();

        const userPhone = profile?.phone;
        if (!userPhone) {
          results.details.push(`Skipped events for user ${setting.user_id}: no phone in profile`);
          continue;
        }

        const { data: waInstance } = await supabase
          .from("whatsapp_instances")
          .select("token")
          .eq("user_id", setting.user_id)
          .eq("status", "connected")
          .maybeSingle();

        const { data: agendaItems } = await supabase
          .from("agenda_items")
          .select("*")
          .eq("user_id", setting.user_id)
          .eq("auto_notify", true)
          .in("status", ["pending", "in_progress"]);

        for (const item of agendaItems || []) {
          const startDateUTC = new Date(item.start_date);
          const startDateBrazil = new Date(startDateUTC.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));

          const sends: { type: string; isAdvance: boolean; triggerDate: Date }[] = [];

          if (setting.send_on_day || setting.send_both) {
            if (item.reminder_value && item.reminder_unit) {
              const offsetMs = reminderOffsetMs(item.reminder_value, item.reminder_unit);
              const reminderTime = new Date(startDateBrazil.getTime() - offsetMs);
              sends.push({ type: "on_day_reminder", isAdvance: false, triggerDate: reminderTime });
            } else {
              sends.push({ type: "on_day", isAdvance: false, triggerDate: startDateBrazil });
            }
          }

          if ((setting.send_days_before > 0 && !setting.send_both) || setting.send_both) {
            if (setting.send_days_before > 0) {
              const beforeDate = new Date(startDateBrazil);
              beforeDate.setDate(beforeDate.getDate() - setting.send_days_before);
              sends.push({ type: "before", isAdvance: true, triggerDate: beforeDate });
            }
          }

          for (const send of sends) {
            const triggerDateStr = toDateStr(send.triggerDate);
            const triggerHour = send.triggerDate.getHours();
            const triggerMinute = send.triggerDate.getMinutes();

            const triggerTotalMinutes = triggerHour * 60 + triggerMinute;
            const isToday = triggerDateStr === todayStr;
            const hasPassed = triggerTotalMinutes <= nowTotalMinutes;
            const withinCatchUp = (nowTotalMinutes - triggerTotalMinutes) <= 60;
            if (!isToday || !hasPassed || !withinCatchUp) continue;

            const logKey = `${send.type}_${triggerHour}${String(triggerMinute).padStart(2, "0")}`;
            const { data: existing } = await supabase
              .from("notification_log")
              .select("id")
              .eq("source_id", item.id)
              .eq("send_type", logKey)
              .eq("event_date", todayStr)
              .maybeSingle();

            if (existing) continue;

            const startTime = `${String(startDateBrazil.getHours()).padStart(2, "0")}:${String(startDateBrazil.getMinutes()).padStart(2, "0")}`;
            const endTime = item.end_date
              ? (() => {
                  const ed = new Date(new Date(item.end_date).toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
                  return `${String(ed.getHours()).padStart(2, "0")}:${String(ed.getMinutes()).padStart(2, "0")}`;
                })()
              : "";
            const dateFormatted = `${String(startDateBrazil.getDate()).padStart(2, "0")}/${String(startDateBrazil.getMonth() + 1).padStart(2, "0")}/${startDateBrazil.getFullYear()}`;

            let message = setting.message_template || "Lembrete: {evento} em {data} às {horario_inicio}";
            message = message.replace(/{evento}/g, item.title);
            message = message.replace(/{data}/g, dateFormatted);
            message = message.replace(/{horario_inicio}/g, startTime);
            message = message.replace(/{horario_fim}/g, endTime);

            const targetPhone = item.phone || userPhone;

            const payload = {
              nome: item.title,
              celular: targetPhone,
              mensagem: message,
              data_evento: item.start_date,
              horario_inicio: startTime,
              horario_fim: endTime,
              envio_antecipado: send.isAdvance,
              token: waInstance?.token || null,
            };

            try {
              const resp = await fetch(EVENT_WEBHOOK_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
              });

              await supabase.from("notification_log").insert({
                user_id: setting.user_id,
                source_type: "agenda",
                source_id: item.id,
                send_type: logKey,
                event_date: todayStr,
                webhook_status: resp.status,
              });

              results.sent++;
              results.details.push(`Agenda: ${item.title} (${send.type} at ${triggerHour}:${String(triggerMinute).padStart(2, "0")})`);
            } catch (err: unknown) {
              results.errors++;
              results.details.push(`Error agenda ${item.title}: ${err instanceof Error ? err.message : String(err)}`);
            }
          }
        }
      }
    }

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errMsg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
