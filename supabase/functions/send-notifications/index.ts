import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

/** Parse HH:MM string to total minutes */
function parseTimeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

interface WebhookConfigResult {
  url: string;
  payload_fields: Record<string, boolean>;
}

async function getWebhookConfig(supabase: any, functionKey: string): Promise<WebhookConfigResult | null> {
  const { data } = await supabase
    .from("webhook_configs")
    .select("url, payload_fields")
    .eq("function_key", functionKey)
    .eq("is_active", true)
    .maybeSingle();
  return data ? { url: data.url, payload_fields: data.payload_fields || {} } : null;
}

/** Filter payload based on payload_fields config. If no config, send all. */
function filterPayload(payload: Record<string, any>, payloadFields: Record<string, boolean>): Record<string, any> {
  const hasConfig = Object.keys(payloadFields).length > 0;
  if (!hasConfig) return payload;
  const filtered: Record<string, any> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (payloadFields[key] !== false) {
      filtered[key] = value;
    }
  }
  return filtered;
}

// Wider catch-up window: 30 minutes instead of 10
const CATCHUP_WINDOW_MINUTES = 30;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const birthdayConfig = await getWebhookConfig(supabase, "birthday_notification");
  const eventConfig = await getWebhookConfig(supabase, "event_notification");

  const BIRTHDAY_WEBHOOK_URL = birthdayConfig?.url || null;
  const EVENT_WEBHOOK_URL = eventConfig?.url || null;

  const nowBrazil = getBrazilNow();
  const nowTotalMinutes = nowBrazil.getHours() * 60 + nowBrazil.getMinutes();
  const todayStr = toDateStr(nowBrazil);
  const todayMonth = nowBrazil.getMonth() + 1;
  const todayDay = nowBrazil.getDate();

  const results: { sent: number; errors: number; details: string[] } = { sent: 0, errors: 0, details: [] };

  try {
    // ========================
    // 1. BIRTHDAY NOTIFICATIONS
    // ========================
    if (!BIRTHDAY_WEBHOOK_URL) {
      results.details.push("Birthday webhook URL not configured in admin panel");
    } else {
      // Get all users with active birthday notification settings
      const { data: birthdaySettings } = await supabase
        .from("notification_settings")
        .select("*")
        .eq("setting_type", "birthday")
        .eq("is_active", true);

      for (const setting of birthdaySettings || []) {
        // Get user's preferred send time from user_preferences
        const { data: userPrefs } = await supabase
          .from("user_preferences")
          .select("birthday_send_time, notifications_enabled")
          .eq("user_id", setting.user_id)
          .maybeSingle();

        // Skip if global notifications disabled
        if (userPrefs && userPrefs.notifications_enabled === false) {
          results.details.push(`Skipped birthdays for user ${setting.user_id}: notifications disabled`);
          continue;
        }

        const sendTime = userPrefs?.birthday_send_time || "09:00";
        const sendTimeMinutes = parseTimeToMinutes(sendTime);

        // Check if we're within the catch-up window of the user's preferred send time
        const diff = nowTotalMinutes - sendTimeMinutes;
        if (diff < 0 || diff > CATCHUP_WINDOW_MINUTES) {
          results.details.push(`Birthday skip for user ${setting.user_id}: send_time=${sendTime}, now=${nowBrazil.getHours()}:${String(nowBrazil.getMinutes()).padStart(2, "0")}`);
          continue;
        }

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
              .select("token, instance_name")
              .eq("user_id", setting.user_id)
              .eq("status", "connected")
              .maybeSingle();

            const adminToken = Deno.env.get("EXTERNAL_API_ADMIN_TOKEN") || null;

            const fullPayload: Record<string, any> = {
              nome: event.person_name || event.title,
              celular: event.phone,
              mensagem: message,
              data_aniversario: event.event_date,
              idade: age,
              envio_antecipado: send.isAdvance,
              token_usuario: waInstance?.token || null,
              token_sistema: adminToken,
              instancia_usuario: waInstance?.instance_name || null,
              user_id: setting.user_id,
              teste: false,
            };

            const payload = filterPayload(fullPayload, birthdayConfig?.payload_fields || {});

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

    // ========================
    // 2. AGENDA NOTIFICATIONS
    // ========================
    if (!EVENT_WEBHOOK_URL) {
      results.details.push("Event webhook URL not configured in admin panel");
    } else {
      // Get ALL users who have auto_notify agenda items, regardless of notification_settings existing
      const { data: allAutoNotifyItems } = await supabase
        .from("agenda_items")
        .select("user_id")
        .eq("auto_notify", true)
        .in("status", ["pending", "in_progress"]);

      // Get unique user IDs
      const userIds = [...new Set((allAutoNotifyItems || []).map((i: any) => i.user_id))];

      for (const userId of userIds) {
        // Get user preferences
        const { data: userPrefs } = await supabase
          .from("user_preferences")
          .select("events_send_time, notifications_enabled")
          .eq("user_id", userId)
          .maybeSingle();

        // Skip if global notifications disabled
        if (userPrefs && userPrefs.notifications_enabled === false) {
          results.details.push(`Skipped events for user ${userId}: notifications disabled`);
          continue;
        }

        // Get notification_settings for event (may not exist — that's OK)
        const { data: eventSetting } = await supabase
          .from("notification_settings")
          .select("*")
          .eq("user_id", userId)
          .eq("setting_type", "event")
          .maybeSingle();

        // If notification_settings exists but is inactive, skip
        if (eventSetting && !eventSetting.is_active) {
          results.details.push(`Skipped events for user ${userId}: event notifications disabled`);
          continue;
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("phone")
          .eq("id", userId)
          .maybeSingle();

        const userPhone = profile?.phone;
        if (!userPhone) {
          results.details.push(`Skipped events for user ${userId}: no phone in profile`);
          continue;
        }

        const { data: waInstance } = await supabase
          .from("whatsapp_instances")
          .select("token, instance_name")
          .eq("user_id", userId)
          .eq("status", "connected")
          .maybeSingle();

        const adminToken = Deno.env.get("EXTERNAL_API_ADMIN_TOKEN") || null;

        const { data: agendaItems } = await supabase
          .from("agenda_items")
          .select("*")
          .eq("user_id", userId)
          .eq("auto_notify", true)
          .in("status", ["pending", "in_progress"]);

        // Default send time from user preferences
        const defaultSendTime = userPrefs?.events_send_time || "09:00";

        // Message template from notification_settings or default
        const messageTemplate = eventSetting?.message_template || "📅 Lembrete: {evento} em {data} às {horario_inicio}";

        for (const item of agendaItems || []) {
          const startDateUTC = new Date(item.start_date);
          const startDateBrazil = new Date(startDateUTC.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));

          const sends: { type: string; isAdvance: boolean; triggerDate: Date }[] = [];

          // ---- Per-event reminder (set in the event form) ----
          if (item.reminder_value && item.reminder_unit) {
            const offsetMs = reminderOffsetMs(item.reminder_value, item.reminder_unit);
            const reminderTime = new Date(startDateBrazil.getTime() - offsetMs);
            sends.push({ type: "event_reminder", isAdvance: false, triggerDate: reminderTime });
          }

          // ---- Global notification_settings (send_on_day / send_days_before / send_both) ----
          if (eventSetting) {
            if (eventSetting.send_on_day || eventSetting.send_both) {
              // Send at the user's preferred events_send_time on the day of the event
              const onDayTrigger = new Date(startDateBrazil);
              const [sendH, sendM] = defaultSendTime.split(":").map(Number);
              onDayTrigger.setHours(sendH || 9, sendM || 0, 0, 0);
              sends.push({ type: "on_day", isAdvance: false, triggerDate: onDayTrigger });
            }

            if ((eventSetting.send_days_before > 0 && !eventSetting.send_both) || eventSetting.send_both) {
              if (eventSetting.send_days_before > 0) {
                const beforeDate = new Date(startDateBrazil);
                beforeDate.setDate(beforeDate.getDate() - eventSetting.send_days_before);
                const [sendH, sendM] = defaultSendTime.split(":").map(Number);
                beforeDate.setHours(sendH || 9, sendM || 0, 0, 0);
                sends.push({ type: "before", isAdvance: true, triggerDate: beforeDate });
              }
            }
          } else if (!item.reminder_value) {
            // No notification_settings and no per-event reminder: use default send time on day of event
            const onDayTrigger = new Date(startDateBrazil);
            const [sendH, sendM] = defaultSendTime.split(":").map(Number);
            onDayTrigger.setHours(sendH || 9, sendM || 0, 0, 0);
            sends.push({ type: "on_day_default", isAdvance: false, triggerDate: onDayTrigger });
          }

          for (const send of sends) {
            const triggerDateStr = toDateStr(send.triggerDate);
            const triggerHour = send.triggerDate.getHours();
            const triggerMinute = send.triggerDate.getMinutes();
            const triggerTotalMinutes = triggerHour * 60 + triggerMinute;

            const isToday = triggerDateStr === todayStr;
            const diff = nowTotalMinutes - triggerTotalMinutes;
            const hasPassed = diff >= 0;
            const withinCatchUp = diff <= CATCHUP_WINDOW_MINUTES;

            if (!isToday || !hasPassed || !withinCatchUp) continue;

            const logKey = `${send.type}_${String(triggerHour).padStart(2, "0")}${String(triggerMinute).padStart(2, "0")}`;
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

            let message = messageTemplate;
            message = message.replace(/{evento}/g, item.title);
            message = message.replace(/{data}/g, dateFormatted);
            message = message.replace(/{horario_inicio}/g, startTime);
            message = message.replace(/{horario_fim}/g, endTime);

            const targetPhone = item.phone || userPhone;

            const fullPayload: Record<string, any> = {
              nome: item.title,
              celular: targetPhone,
              mensagem: message,
              data_evento: item.start_date,
              horario_inicio: startTime,
              horario_fim: endTime,
              descricao: item.description || null,
              prioridade: item.priority || null,
              envio_antecipado: send.isAdvance,
              token_usuario: waInstance?.token || null,
              token_sistema: adminToken,
              instancia_usuario: waInstance?.instance_name || null,
              user_id: userId,
              teste: false,
            };

            const payload = filterPayload(fullPayload, eventConfig?.payload_fields || {});

            try {
              const resp = await fetch(EVENT_WEBHOOK_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
              });

              await supabase.from("notification_log").insert({
                user_id: userId,
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
