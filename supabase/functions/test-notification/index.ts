import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const { source_type, source_id, user_id } = await req.json();

    if (!source_type || !source_id || !user_id) {
      return new Response(JSON.stringify({ error: "source_type, source_id e user_id são obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const settingType = source_type === "birthday" ? "birthday" : "event";
    const { data: setting } = await supabase
      .from("notification_settings")
      .select("*")
      .eq("user_id", user_id)
      .eq("setting_type", settingType)
      .maybeSingle();

    if (!setting) {
      return new Response(JSON.stringify({ error: `Nenhuma configuração de notificação encontrada para tipo "${settingType}".` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let payload: Record<string, unknown>;
    let webhookConfig: WebhookConfigResult | null;
    let itemTitle: string;

    if (source_type === "birthday") {
      const { data: event } = await supabase
        .from("important_events").select("*").eq("id", source_id).eq("user_id", user_id).maybeSingle();

      if (!event) return new Response(JSON.stringify({ error: "Evento não encontrado" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (!event.phone) return new Response(JSON.stringify({ error: "Este evento não tem telefone cadastrado" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const eventDate = new Date(event.event_date);
      const today = new Date();
      const age = event.event_type === "birthday" ? today.getFullYear() - eventDate.getFullYear() : null;

      let message = setting.message_template || "Feliz aniversário, {nome}!";
      message = message.replace(/{nome}/g, event.person_name || event.title);
      message = message.replace(/{idade}/g, age !== null ? String(age) : "");
      message = message.replace(/{data}/g, `${String(eventDate.getDate()).padStart(2, "0")}/${String(eventDate.getMonth() + 1).padStart(2, "0")}`);

      const { data: waInstance } = await supabase
        .from("whatsapp_instances").select("token, instance_name").eq("user_id", user_id).eq("status", "connected").maybeSingle();

      const adminToken = Deno.env.get("EXTERNAL_API_ADMIN_TOKEN") || null;

      itemTitle = event.title;
      webhookConfig = await getWebhookConfig(supabase, "birthday_notification");
      const fullPayload = {
        nome: event.person_name || event.title,
        celular: event.phone,
        mensagem: message,
        data_aniversario: event.event_date,
        idade: age,
        envio_antecipado: false,
        token_usuario: waInstance?.token || null,
        token_sistema: adminToken,
        instancia_usuario: waInstance?.instance_name || null,
        user_id: user_id,
        teste: true,
      };
      payload = filterPayload(fullPayload, webhookConfig?.payload_fields || {});
    } else {
      const { data: item } = await supabase
        .from("agenda_items").select("*").eq("id", source_id).eq("user_id", user_id).maybeSingle();

      if (!item) return new Response(JSON.stringify({ error: "Item da agenda não encontrado" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const { data: profile } = await supabase
        .from("profiles").select("phone").eq("id", user_id).maybeSingle();

      const userPhone = profile?.phone;
      if (!userPhone) return new Response(JSON.stringify({ error: "Seu perfil não tem telefone cadastrado." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const startDate = new Date(item.start_date);
      const startBrazil = new Date(startDate.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
      const startTime = `${String(startBrazil.getHours()).padStart(2, "0")}:${String(startBrazil.getMinutes()).padStart(2, "0")}`;
      const endTime = item.end_date ? (() => {
        const ed = new Date(new Date(item.end_date).toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
        return `${String(ed.getHours()).padStart(2, "0")}:${String(ed.getMinutes()).padStart(2, "0")}`;
      })() : "";
      const dateFormatted = `${String(startBrazil.getDate()).padStart(2, "0")}/${String(startBrazil.getMonth() + 1).padStart(2, "0")}/${startBrazil.getFullYear()}`;

      let message = setting.message_template || "Lembrete: {evento} em {data} às {horario_inicio}";
      message = message.replace(/{evento}/g, item.title);
      message = message.replace(/{data}/g, dateFormatted);
      message = message.replace(/{horario_inicio}/g, startTime);
      message = message.replace(/{horario_fim}/g, endTime);

      itemTitle = item.title;
      webhookConfig = await getWebhookConfig(supabase, "event_notification");
      const adminToken = Deno.env.get("EXTERNAL_API_ADMIN_TOKEN") || null;
      const { data: waInstance } = await supabase
        .from("whatsapp_instances").select("token, instance_name").eq("user_id", user_id).eq("status", "connected").maybeSingle();

      const fullPayload = {
        nome: item.title,
        celular: userPhone,
        mensagem: message,
        data_evento: item.start_date,
        horario_inicio: startTime,
        horario_fim: endTime,
        descricao: item.description || null,
        prioridade: item.priority || null,
        envio_antecipado: false,
        token_usuario: waInstance?.token || null,
        token_sistema: adminToken,
        instancia_usuario: waInstance?.instance_name || null,
        user_id: user_id,
        teste: true,
      };
      payload = filterPayload(fullPayload, webhookConfig?.payload_fields || {});
    }

    const webhookUrl = webhookConfig?.url || null;
    if (!webhookUrl) {
      return new Response(JSON.stringify({ error: "URL do webhook não configurada no painel admin." }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resp = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const responseText = await resp.text();

    return new Response(JSON.stringify({
      success: resp.ok,
      title: itemTitle,
      status_code: resp.status,
      webhook_url: webhookUrl,
      payload_sent: payload,
      response: responseText,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errMsg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
