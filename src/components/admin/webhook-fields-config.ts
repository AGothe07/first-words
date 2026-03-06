// Available payload fields per webhook function_key
export interface PayloadFieldOption {
  key: string;
  label: string;
  description: string;
}

// Campos comuns a todos os webhooks
const COMMON_FIELDS: PayloadFieldOption[] = [
  { key: "token_usuario", label: "Chave WhatsApp (Usuário)", description: "Chave da conexão WhatsApp do usuário (salva ao ler QR Code)" },
  { key: "token_sistema", label: "Chave WhatsApp (Sistema)", description: "Chave global cadastrada pelo admin nas configurações" },
  { key: "instancia_usuario", label: "Instância (Usuário)", description: "Nome da instância WhatsApp do usuário" },
  { key: "celular", label: "Celular", description: "Número de telefone" },
  { key: "user_id", label: "ID do Usuário", description: "UUID do usuário" },
];

export const PAYLOAD_FIELDS_BY_FUNCTION: Record<string, PayloadFieldOption[]> = {
  birthday_notification: [
    { key: "nome", label: "Nome", description: "Nome do aniversariante" },
    { key: "celular", label: "Celular", description: "Número do aniversariante" },
    { key: "mensagem", label: "Mensagem", description: "Mensagem formatada com template" },
    { key: "data_aniversario", label: "Data Aniversário", description: "Data de aniversário (YYYY-MM-DD)" },
    { key: "idade", label: "Idade", description: "Idade que a pessoa está fazendo" },
    { key: "envio_antecipado", label: "Envio Antecipado", description: "Flag se é envio antecipado (true/false)" },
    { key: "token_usuario", label: "Chave WhatsApp (Usuário)", description: "Chave da conexão WhatsApp do usuário (QR Code)" },
    { key: "token_sistema", label: "Chave WhatsApp (Sistema)", description: "Chave global cadastrada pelo admin" },
    { key: "instancia_usuario", label: "Instância (Usuário)", description: "Nome da instância WhatsApp do usuário" },
    { key: "user_id", label: "ID do Usuário", description: "UUID do usuário dono do evento" },
    { key: "teste", label: "Flag Teste", description: "Indica se é envio de teste (true/false)" },
  ],
  event_notification: [
    { key: "nome", label: "Título do Evento", description: "Nome/título do evento da agenda" },
    { key: "celular", label: "Celular", description: "Número do usuário ou do evento" },
    { key: "mensagem", label: "Mensagem", description: "Mensagem formatada com template" },
    { key: "data_evento", label: "Data do Evento", description: "Data do evento (ISO)" },
    { key: "horario_inicio", label: "Horário Início", description: "Horário de início (HH:MM)" },
    { key: "horario_fim", label: "Horário Fim", description: "Horário de término (HH:MM)" },
    { key: "descricao", label: "Descrição", description: "Descrição do evento" },
    { key: "prioridade", label: "Prioridade", description: "Prioridade do evento (low/medium/high)" },
    { key: "envio_antecipado", label: "Envio Antecipado", description: "Flag se é envio antecipado (true/false)" },
    { key: "token_usuario", label: "Chave WhatsApp (Usuário)", description: "Chave da conexão WhatsApp do usuário (QR Code)" },
    { key: "token_sistema", label: "Chave WhatsApp (Sistema)", description: "Chave global cadastrada pelo admin" },
    { key: "instancia_usuario", label: "Instância (Usuário)", description: "Nome da instância WhatsApp do usuário" },
    { key: "user_id", label: "ID do Usuário", description: "UUID do usuário dono do evento" },
    { key: "teste", label: "Flag Teste", description: "Indica se é envio de teste (true/false)" },
  ],
  whatsapp_status: [
    ...COMMON_FIELDS,
  ],
  whatsapp_create: [
    ...COMMON_FIELDS,
  ],
  whatsapp_connect: [
    ...COMMON_FIELDS,
  ],
  whatsapp_disconnect: [
    ...COMMON_FIELDS,
  ],
  whatsapp_delete: [
    ...COMMON_FIELDS,
    { key: "instance_name", label: "Nome da Instância", description: "Nome da instância WhatsApp a ser deletada" },
    { key: "instance_id", label: "ID da Instância", description: "UUID da instância no banco de dados" },
    { key: "api_key_admin", label: "Chave API Admin", description: "Chave administrativa do sistema" },
  ],
  whatsapp_code: [
    ...COMMON_FIELDS,
    { key: "codigo", label: "Código", description: "Código de verificação para envio" },
  ],
};

// Get available fields for a function_key, with fallback for unknown keys
export function getFieldsForFunction(functionKey: string | null): PayloadFieldOption[] {
  if (!functionKey) return [];
  return PAYLOAD_FIELDS_BY_FUNCTION[functionKey] || [];
}
