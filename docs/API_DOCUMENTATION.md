# 📘 Documentação Técnica da API — Sistema Financeiro

> **Versão:** 2.0.0  
> **Última atualização:** 2026-02-13  
> **Base URL:** `https://ydycczdidgmphrrnucim.supabase.co/functions/v1`  
> **Protocolo:** HTTPS obrigatório  
> **Formato:** JSON (UTF-8)

---

## 📑 Índice

1. [Visão Geral](#visão-geral)
2. [Autenticação](#autenticação)
3. [Endpoints](#endpoints)
   - [POST /external-api — Dados Consolidados (Summary)](#1-dados-consolidados-summary)
   - [POST /external-api — Transações Completas (Transactions)](#2-transações-completas-transactions)
   - [POST /ingest-transaction — Ingestão de Transações](#3-ingestão-de-transações)
   - [POST /query-financial-data — Consulta Interna (AI/App)](#4-consulta-interna-aiapp)
4. [Respostas Padronizadas de Erro](#respostas-padronizadas-de-erro)
5. [Segurança Máxima](#segurança-máxima)
6. [Limites e Throttling](#limites-e-throttling)
7. [Glossário](#glossário)

---

## Visão Geral

Esta API permite que sistemas externos consumam dados financeiros e patrimoniais de usuários de forma **controlada, segura e estruturada**. O identificador principal de cada usuário é o **número de telefone brasileiro verificado** (formato `55` + DDD + número).

### Princípios

- **Autenticação única:** Token administrativo (`EXTERNAL_API_ADMIN_TOKEN`) + telefone para identificar o usuário
- **Zero exposição de dados sensíveis:** Nenhum token interno, `service_role`, `access_token` ou `refresh_token` é retornado
- **Respostas padronizadas:** Todas as respostas seguem o formato `{ success: boolean, ... }`
- **Rate limiting rigoroso:** Por IP, por telefone, por token

---

## Autenticação

### Token Administrativo (Único)

**Todos os endpoints** utilizam um único **Bearer Token administrativo** (`EXTERNAL_API_ADMIN_TOKEN`) no header `Authorization`. O usuário é identificado pelo `phone_number` no body da requisição.

```
Authorization: Bearer SEU_ADMIN_TOKEN
```

| Regra | Detalhes |
|---|---|
| Armazenamento | **Apenas** em variáveis de ambiente no backend (secret `EXTERNAL_API_ADMIN_TOKEN` no Supabase) |
| Exposição no frontend | ❌ **PROIBIDO** — nunca incluir em código client-side |
| Logs | ❌ **PROIBIDO** — nunca registrar o token em logs |
| Rotação | Recomendado trocar periodicamente via painel Supabase > Edge Functions > Secrets |

> **Não há tokens de usuário.** O identificador do usuário é sempre o `phone_number` enviado no body.

---

## Endpoints

---

### 1. Dados Consolidados (Summary)

Retorna um JSON com indicadores financeiros e patrimoniais consolidados do usuário.

| Campo | Valor |
|---|---|
| **Método** | `POST` |
| **Rota** | `/external-api` |
| **Autenticação** | Bearer Token Administrativo |
| **Content-Type** | `application/json` |

#### Headers Obrigatórios

| Header | Valor |
|---|---|
| `Authorization` | `Bearer SEU_ADMIN_TOKEN` |
| `Content-Type` | `application/json` |

#### Body da Requisição

```json
{
  "phone_number": "5511999999999",
  "type": "summary"
}
```

| Parâmetro | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `phone_number` | `string` | ✅ | Telefone brasileiro com prefixo 55 (apenas dígitos ou formatado) |
| `type` | `string` | ✅ | Deve ser `"summary"` |

#### Exemplo de Resposta — Sucesso (200)

```json
{
  "success": true,
  "type": "summary",
  "data": {
    "financial": {
      "phone": "5511999999999",
      "user_status": "active",
      "balance": 15230.50,
      "total_income": 45000.00,
      "total_expense": 29769.50,
      "total_transactions": 187,
      "current_month": {
        "income": 5000.00,
        "expense": 3200.00,
        "balance": 1800.00
      },
      "monthly": [
        { "month": "2026-01", "income": 5000.00, "expense": 3200.00 },
        { "month": "2025-12", "income": 4800.00, "expense": 3500.00 }
      ],
      "categories": [
        { "name": "ALIMENTAÇÃO", "type": "expense", "total": 8500.00 },
        { "name": "SALÁRIO", "type": "income", "total": 40000.00 }
      ],
      "top_expense_categories": [
        { "name": "ALIMENTAÇÃO", "total": 8500.00 },
        { "name": "TRANSPORTE", "total": 5200.00 }
      ],
      "top_income_categories": [
        { "name": "SALÁRIO", "total": 40000.00 }
      ],
      "avg_monthly_expense": 4961.58,
      "first_transaction_date": "2025-06-01",
      "last_transaction_date": "2026-02-10"
    },
    "assets": {
      "total_current": 250000.00,
      "total_previous_month": 240000.00,
      "growth_absolute": 10000.00,
      "growth_percentage": 4.17,
      "distribution_by_category": {
        "RENDA FIXA": 120000.00,
        "AÇÕES": 80000.00,
        "CRIPTO": 30000.00,
        "IMÓVEIS": 20000.00
      },
      "latest_month": "2026-02",
      "records_count": 48
    },
    "snapshot_updated_at": "2026-02-10T18:30:00.000Z"
  }
}
```

#### Exemplo cURL

```bash
curl -X POST \
  https://SEU_PROJETO_ID.supabase.co/functions/v1/external-api \
  -H "Authorization: Bearer SEU_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number": "5511999999999",
    "type": "summary"
  }'
```

---

### 2. Transações Completas (Transactions)

Retorna todas as transações (receitas, despesas) e registros de patrimônio do usuário.

| Campo | Valor |
|---|---|
| **Método** | `POST` |
| **Rota** | `/external-api` |
| **Autenticação** | Bearer Token Administrativo |
| **Content-Type** | `application/json` |

#### Headers Obrigatórios

| Header | Valor |
|---|---|
| `Authorization` | `Bearer SEU_ADMIN_TOKEN` |
| `Content-Type` | `application/json` |

#### Body da Requisição

```json
{
  "phone_number": "5511999999999",
  "type": "transactions"
}
```

| Parâmetro | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `phone_number` | `string` | ✅ | Telefone brasileiro com prefixo 55 |
| `type` | `string` | ✅ | Deve ser `"transactions"` |

#### Exemplo de Resposta — Sucesso (200)

```json
{
  "success": true,
  "type": "transactions",
  "data": {
    "transactions": [
      {
        "id": "uuid-aqui",
        "record_type": "expense",
        "date": "2026-02-10",
        "amount": 150.00,
        "category": "ALIMENTAÇÃO",
        "subcategory": "Restaurante",
        "person": "João",
        "notes": "[API] Almoço de negócios",
        "created_at": "2026-02-10T12:00:00.000Z"
      },
      {
        "id": "uuid-aqui",
        "record_type": "income",
        "date": "2026-02-05",
        "amount": 5000.00,
        "category": "SALÁRIO",
        "subcategory": null,
        "person": "Empresa X",
        "notes": null,
        "created_at": "2026-02-05T08:00:00.000Z"
      }
    ],
    "assets": [
      {
        "id": "uuid-aqui",
        "record_type": "asset",
        "date": "2026-02-01",
        "amount": 120000.00,
        "category": "RENDA FIXA",
        "subcategory": null,
        "person": null,
        "notes": null,
        "created_at": "2026-02-01T10:00:00.000Z"
      }
    ],
    "total_transactions": 187,
    "total_assets": 12
  }
}
```

#### Diferenciação de Tipos via `record_type`

| `record_type` | Descrição |
|---|---|
| `"income"` | Receita |
| `"expense"` | Despesa |
| `"asset"` | Registro de patrimônio |

#### Exemplo cURL

```bash
curl -X POST \
  https://SEU_PROJETO_ID.supabase.co/functions/v1/external-api \
  -H "Authorization: Bearer SEU_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number": "5511999999999",
    "type": "transactions"
  }'
```

---

### 3. Ingestão de Transações

Insere uma nova transação (receita ou despesa) no sistema via API externa.

| Campo | Valor |
|---|---|
| **Método** | `POST` |
| **Rota** | `/ingest-transaction` |
| **Autenticação** | Bearer Token Administrativo (`EXTERNAL_API_ADMIN_TOKEN`) |
| **Content-Type** | `application/json` |

#### Headers Obrigatórios

| Header | Valor |
|---|---|
| `Authorization` | `Bearer SEU_ADMIN_TOKEN` |
| `Content-Type` | `application/json` |

#### Body da Requisição

```json
{
  "phone_number": "5511999999999",
  "type": "expense",
  "amount": 150.50,
  "category": "ALIMENTAÇÃO",
  "subcategory": "Restaurante",
  "person": "João",
  "date": "2026-02-10",
  "notes": "Almoço de negócios"
}
```

| Parâmetro | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `phone_number` | `string` | ✅ | Telefone brasileiro com prefixo 55 (identifica o usuário) |
| `type` | `string` | ✅ | `"expense"` ou `"income"` |
| `amount` | `number\|string` | ✅ | Valor positivo. Aceita vírgula como decimal (ex: `"150,50"`) |
| `category` | `string` | ✅ | Nome da categoria (deve existir previamente) |
| `subcategory` | `string` | ❌ | Nome da subcategoria (deve existir sob a categoria informada) |
| `person` | `string` | ✅ | Nome da pessoa (deve existir previamente) |
| `date` | `string` | ❌ | Data no formato `YYYY-MM-DD`. Se omitido, usa a data atual |
| `notes` | `string` | ❌ | Observações (máximo 500 caracteres). Prefixo `[API]` adicionado automaticamente |

#### Validações

- **Categoria, subcategoria e pessoa** devem existir previamente no sistema do usuário
- **Busca case-insensitive** (ex: `"alimentação"` encontra `"ALIMENTAÇÃO"`)
- **Detecção de duplicatas:** mesma transação enviada em menos de 30 segundos é rejeitada (409)
- **Separador decimal:** aceita tanto `.` quanto `,`

#### Exemplo de Resposta — Sucesso (201)

```json
{
  "success": true,
  "message": "Transaction created successfully.",
  "transaction": {
    "id": "uuid-gerado",
    "type": "expense",
    "date": "2026-02-10",
    "amount": 150.50,
    "notes": "[API] Almoço de negócios"
  }
}
```

#### Exemplo cURL

```bash
curl -X POST \
  https://SEU_PROJETO_ID.supabase.co/functions/v1/ingest-transaction \
  -H "Authorization: Bearer SEU_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number": "5511999999999",
    "type": "expense",
    "amount": 150.50,
    "category": "ALIMENTAÇÃO",
    "subcategory": "Restaurante",
    "person": "João",
    "date": "2026-02-10",
    "notes": "Almoço de negócios"
  }'
```

---

### 4. Consulta Interna Otimizada (AI/App) — v2

Endpoint otimizado para consumo por IA conversacional. Retorna **apenas os campos solicitados**, reduzindo drasticamente o volume de dados e tokens consumidos.

| Campo | Valor |
|---|---|
| **Método** | `POST` |
| **Rota** | `/query-financial-data` |
| **Autenticação** | Bearer Token Administrativo (`EXTERNAL_API_ADMIN_TOKEN`) |
| **Content-Type** | `application/json` |

#### Headers Obrigatórios

| Header | Valor |
|---|---|
| `Authorization` | `Bearer SEU_ADMIN_TOKEN` |
| `Content-Type` | `application/json` |

#### Body da Requisição

```json
{
  "phone_number": "5511999999999",
  "fields": ["overview", "current_month"]
}
```

| Parâmetro | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `phone_number` | `string` | ✅ | Telefone brasileiro do usuário (normalizado automaticamente) |
| `fields` | `string[]` ou `"all"` | ❌ | Campos a retornar. Se omitido, retorna `["overview", "current_month"]` |

#### Campos Disponíveis (`fields`)

| Campo | Payload | Tipo de Pergunta que Resolve |
|---|---|---|
| `overview` | ~150 B | Saldo total, resumo geral, médias, savings rate |
| `current_month` | ~300 B | Gastos/receitas do mês atual, top categorias do mês |
| `monthly_history` | ~600 B | Comparação entre meses, tendências, pior/melhor mês |
| `categories` | ~800 B | Gastos por categoria/subcategoria, rankings |
| `category_trends` | ~500 B | Evolução de categorias ao longo do tempo |
| `patrimony` | ~400 B | Patrimônio total, composição, crescimento |
| `recent_transactions` | ~1.2 KB | Últimas 15 transações |
| `insights` | ~500 B | Alertas, sugestões, scores de saúde financeira |

#### Exemplo de Resposta — Overview + Current Month (200)

```json
{
  "success": true,
  "user_id": "uuid-do-usuario",
  "phone": "5573998646238",
  "data": {
    "overview": {
      "status": "active",
      "balance": 919.06,
      "total_income": 20139.60,
      "total_expense": 19220.54,
      "total_transactions": 323,
      "first_date": "2025-07-01",
      "last_date": "2026-02-09",
      "months_tracked": 8,
      "avg_monthly_income": 2517.45,
      "avg_monthly_expense": 2402.57,
      "savings_rate": 4.56
    },
    "current_month": {
      "month": "2026-02",
      "income": 2725.00,
      "expense": 944.74,
      "balance": 1780.26,
      "tx_count": 20,
      "daily_avg_expense": 104.97,
      "top_expenses": [
        {"category": "DISTRAÇÃO", "total": 350.00, "count": 8}
      ],
      "top_incomes": [
        {"category": "SALÁRIO", "total": 2725.00, "count": 1}
      ]
    }
  },
  "fields_returned": ["overview", "current_month"],
  "snapshot_updated_at": "2026-02-13T00:00:00.000Z"
}
```

#### Exemplo de Resposta — Categories (200)

```json
{
  "success": true,
  "user_id": "uuid",
  "phone": "5573998646238",
  "data": {
    "categories": {
      "expense": [
        {"cat": "ALIMENTAÇÃO", "total": 6345.17, "count": 68, "avg": 93.31,
         "subs": [{"name": "Mercado", "total": 6345.17, "count": 68}]},
        {"cat": "DISTRAÇÃO", "total": 4994.93, "count": 113, "avg": 44.20,
         "subs": [{"name": "Bebida", "total": 4456.71, "count": 93}]}
      ],
      "income": [
        {"cat": "SALÁRIO", "total": 15607.40, "count": 20, "avg": 780.37}
      ]
    }
  },
  "fields_returned": ["categories"],
  "snapshot_updated_at": "2026-02-13T00:00:00.000Z"
}
```

#### Exemplo de Resposta — Insights (200)

```json
{
  "success": true,
  "user_id": "uuid",
  "phone": "5573998646238",
  "data": {
    "insights": {
      "alerts": [
        {"type": "concentration", "msg": "ALIMENTAÇÃO representa 33% dos gastos totais", "severity": "medium"}
      ],
      "suggestions": [
        "ALIMENTAÇÃO é o maior gasto — 33% do total"
      ],
      "scores": {
        "financial_health": 62,
        "spending_control": 45,
        "savings_rate": 4.6
      }
    }
  },
  "fields_returned": ["insights"],
  "snapshot_updated_at": "2026-02-13T00:00:00.000Z"
}
```

#### Exemplo de Resposta — Recent Transactions (200)

```json
{
  "success": true,
  "user_id": "uuid",
  "phone": "5573998646238",
  "data": {
    "recent_transactions": [
      {"d": "2026-02-09", "t": "expense", "a": 25, "cat": "TRANSPORTE", "sub": "Combustível", "p": "Mario"},
      {"d": "2026-02-09", "t": "expense", "a": 20, "cat": "DISTRAÇÃO", "sub": "Restaurante", "p": "Arthur"}
    ]
  },
  "fields_returned": ["recent_transactions"],
  "snapshot_updated_at": "2026-02-13T00:00:00.000Z"
}
```

---

### 4.1 Exemplos cURL — Consulta por Campo

#### Resumo geral (padrão — sem `fields`)

```bash
curl -X POST \
  https://ydycczdidgmphrrnucim.supabase.co/functions/v1/query-financial-data \
  -H "Authorization: Bearer SEU_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"phone_number": "5511999999999"}'
```

> Retorna: `overview` + `current_month` (~450 bytes)

#### Apenas overview

```bash
curl -X POST \
  https://ydycczdidgmphrrnucim.supabase.co/functions/v1/query-financial-data \
  -H "Authorization: Bearer SEU_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"phone_number": "5511999999999", "fields": ["overview"]}'
```

> Retorna: ~150 bytes. Perguntas: "qual meu saldo?", "como estão minhas finanças?"

#### Mês atual

```bash
curl -X POST \
  https://ydycczdidgmphrrnucim.supabase.co/functions/v1/query-financial-data \
  -H "Authorization: Bearer SEU_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"phone_number": "5511999999999", "fields": ["current_month"]}'
```

> Retorna: ~300 bytes. Perguntas: "quanto gastei esse mês?", "recebi salário?"

#### Categorias detalhadas

```bash
curl -X POST \
  https://ydycczdidgmphrrnucim.supabase.co/functions/v1/query-financial-data \
  -H "Authorization: Bearer SEU_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"phone_number": "5511999999999", "fields": ["categories"]}'
```

> Retorna: ~800 bytes. Perguntas: "gastos por categoria", "quanto gasto com alimentação?"

#### Histórico mensal

```bash
curl -X POST \
  https://ydycczdidgmphrrnucim.supabase.co/functions/v1/query-financial-data \
  -H "Authorization: Bearer SEU_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"phone_number": "5511999999999", "fields": ["monthly_history"]}'
```

> Retorna: ~600 bytes. Perguntas: "compare meses", "evolução financeira"

#### Tendência de categorias

```bash
curl -X POST \
  https://ydycczdidgmphrrnucim.supabase.co/functions/v1/query-financial-data \
  -H "Authorization: Bearer SEU_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"phone_number": "5511999999999", "fields": ["category_trends"]}'
```

> Retorna: ~500 bytes. Perguntas: "gastos com bebida estão subindo?", "tendência de alimentação"

#### Patrimônio

```bash
curl -X POST \
  https://ydycczdidgmphrrnucim.supabase.co/functions/v1/query-financial-data \
  -H "Authorization: Bearer SEU_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"phone_number": "5511999999999", "fields": ["patrimony"]}'
```

> Retorna: ~400 bytes. Perguntas: "quanto tenho investido?", "patrimônio cresceu?"

#### Últimas transações

```bash
curl -X POST \
  https://ydycczdidgmphrrnucim.supabase.co/functions/v1/query-financial-data \
  -H "Authorization: Bearer SEU_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"phone_number": "5511999999999", "fields": ["recent_transactions"]}'
```

> Retorna: ~1.2 KB. Perguntas: "o que paguei ontem?", "últimas compras"

#### Insights e alertas

```bash
curl -X POST \
  https://ydycczdidgmphrrnucim.supabase.co/functions/v1/query-financial-data \
  -H "Authorization: Bearer SEU_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"phone_number": "5511999999999", "fields": ["insights"]}'
```

> Retorna: ~500 bytes. Perguntas: "alguma dica?", "saúde financeira"

#### Todos os campos

```bash
curl -X POST \
  https://ydycczdidgmphrrnucim.supabase.co/functions/v1/query-financial-data \
  -H "Authorization: Bearer SEU_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"phone_number": "5511999999999", "fields": "all"}'
```

> Retorna: ~4.5 KB (vs ~70 KB na v1). Todos os 8 blocos.

#### Múltiplos campos combinados

```bash
curl -X POST \
  https://ydycczdidgmphrrnucim.supabase.co/functions/v1/query-financial-data \
  -H "Authorization: Bearer SEU_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"phone_number": "5511999999999", "fields": ["overview", "categories", "insights"]}'
```

> Retorna: ~1.5 KB. Overview + categorias + insights combinados.

---

### 4.2 Tabela de Redução de Payload (v1 → v2)

| Pergunta do Usuário | v1 (payload) | v2 (payload) | Redução |
|---|---|---|---|
| "Qual meu saldo?" | ~70 KB | ~150 B | **99.8%** |
| "Quanto gastei esse mês?" | ~70 KB | ~300 B | **99.6%** |
| "Gastos por categoria" | ~70 KB | ~800 B | **98.9%** |
| "Últimas transações" | ~70 KB | ~1.2 KB | **98.3%** |
| "Meu patrimônio cresceu?" | ~70 KB | ~400 B | **99.4%** |
| "Alguma dica financeira?" | ~70 KB | ~500 B | **99.3%** |
| "Tudo junto" | ~70 KB | ~4.5 KB | **93.6%** |

### 4.3 Mapeamento: Pergunta → Campo

| Pergunta do Usuário | Campo(s) a solicitar |
|---|---|
| "Qual meu saldo?" | `overview` |
| "Como estão minhas finanças?" | `overview` |
| "Quanto gastei esse mês?" | `current_month` |
| "Recebi salário?" | `current_month` |
| "Top gastos do mês" | `current_month` |
| "Compare janeiro com dezembro" | `monthly_history` |
| "Meus gastos estão subindo?" | `monthly_history` |
| "Quanto gasto com alimentação?" | `categories` |
| "Detalhe subcategorias de distração" | `categories` |
| "Gastos com bebida estão aumentando?" | `category_trends` |
| "Quanto tenho investido?" | `patrimony` |
| "Patrimônio cresceu?" | `patrimony` |
| "O que paguei ontem?" | `recent_transactions` |
| "Últimas compras" | `recent_transactions` |
| "Alguma dica?" | `insights` |
| "Saúde financeira?" | `insights` |
| "Visão completa" | `"all"` |

---

## Respostas Padronizadas de Erro

Todas as respostas de erro seguem o formato:

```json
{
  "success": false,
  "error": "Mensagem descritiva do erro."
}
```

### Catálogo de Erros

| HTTP Status | Erro | Descrição |
|---|---|---|
| `400` | `Invalid JSON body.` | Corpo da requisição não é JSON válido |
| `400` | `Missing phone_number.` | Campo `phone_number` não enviado |
| `400` | `Invalid phone number. Must be Brazilian format starting with 55.` | Formato de telefone inválido |
| `400` | `Invalid type. Use 'summary' or 'transactions'.` | Parâmetro `type` inválido |
| `400` | `Validation failed.` | Erro de validação (com array `details`) |
| `401` | `Unauthorized.` | Token administrativo ausente ou inválido |
| `404` | `No user found with this phone number.` | Telefone não cadastrado |
| `404` | `No user found with this phone number.` | Telefone não cadastrado |
| `404` | `Person 'X' not found. Create it first.` | Pessoa não encontrada |
| `404` | `Category 'X' of type 'Y' not found.` | Categoria não encontrada |
| `405` | `Method not allowed. Use POST.` | Método HTTP incorreto |
| `409` | `Duplicate detected.` | Transação duplicada em 30 segundos |
| `429` | `Rate limit exceeded.` | Limite de requisições excedido |
| `429` | `Too many failed attempts. Try again later.` | Bloqueio progressivo ativo |
| `500` | `Database error.` | Erro interno de banco |
| `500` | `Server misconfigured.` | Secret ausente no servidor |

### Exemplo de Erro de Validação (400)

```json
{
  "error": "Validation failed.",
  "details": [
    "'type' is required and must be 'expense' or 'income'.",
    "'amount' must be a positive number."
  ]
}
```

---

## Segurança Máxima

### 🌐 CORS (Cross-Origin Resource Sharing)

Todas as Edge Functions possuem CORS restrito. Apenas os seguintes domínios são aceitos:

| Origem Permitida | Uso |
|---|---|
| `https://financial.lendscope.com.br` | Site de produção |
| `https://n8n-n8n.czby9f.easypanel.host` | Integração n8n |
| URLs Lovable (preview/published) | Desenvolvimento |

Requisições de origens não autorizadas serão rejeitadas com headers CORS inválidos.

### 🔒 Transporte

| Regra | Detalhes |
|---|---|
| HTTPS obrigatório | Todas as requisições devem usar `https://`. HTTP puro é rejeitado pela infraestrutura |
| TLS 1.2+ | Garantido pela infraestrutura Supabase |

### 🔑 Autenticação e Autorização

| Regra | Detalhes |
|---|---|
| Bearer Token obrigatório | Nenhuma rota funciona sem `Authorization: Bearer <token>` |
| Token administrativo | Armazenado como secret no Supabase Edge Functions — nunca em código |
| Comparação de tokens | Via hash SHA-256 (constant-time) para prevenir timing attacks |
| Tokens internos nunca expostos | `service_role`, `access_token`, `refresh_token` nunca aparecem nas respostas |
| Stack traces nunca expostos | Erros internos retornam mensagens genéricas (`"Database error."`, `"Internal server error."`) |

### 🛡️ Rate Limiting

| Tipo | Limite | Janela |
|---|---|---|
| Por IP | 30 requisições | 60 segundos |
| Por telefone | 30 requisições | 60 segundos |

### 🚫 Proteção Contra Brute Force

O sistema implementa **bloqueio progressivo** após tentativas com tokens inválidos:

| Tentativa | Tempo de bloqueio |
|---|---|
| 1ª falha | 30 segundos |
| 2ª falha | 60 segundos |
| 3ª falha | 120 segundos |
| 4ª falha | 300 segundos (5 min) |
| 5ª+ falhas | 600 segundos (10 min) |

Cada tentativa inválida gera um registro na tabela `security_events`.

### 🔍 Proteção Contra Enumeração de Usuários

- Respostas para telefone inexistente e telefone não verificado usam mensagens genéricas
- Não há diferença de timing entre telefone válido e inválido que permita inferência
- Tokens inválidos não revelam se o usuário existe

### 📱 Validação de Telefone

| Regra | Detalhes |
|---|---|
| Prefixo obrigatório | Deve iniciar com `55` (código do Brasil) |
| Formato | `55` + DDD (2 dígitos) + número (8 ou 9 dígitos) |
| Regex | `/^55\d{10,11}$/` |
| Sanitização | Todos os caracteres não-numéricos são removidos antes da validação |
| Exemplos válidos | `5511999999999`, `55(11)99999-9999`, `+55 11 99999-9999` |

### 📅 Validação de Datas

| Regra | Detalhes |
|---|---|
| Formato | `YYYY-MM-DD` |
| Regex | `/^\d{4}-\d{2}-\d{2}$/` |
| Validação extra | Verifica se a data é parseable pelo JavaScript `Date` |

### 💰 Validação de Valores

| Regra | Detalhes |
|---|---|
| Separador decimal | Aceita `.` e `,` (convertido automaticamente) |
| Valor mínimo | Deve ser > 0 |
| Tipo | Convertido para `float` via `parseFloat()` |

### 📋 Sanitização de Logs

| Regra | Detalhes |
|---|---|
| Tokens | Nunca logados em texto plano |
| Security events | Registram apenas tipo de evento, IP e metadata genérica |
| Notas de transação | Limitadas a 500 caracteres, prefixadas com `[API]` |

### 🔄 Detecção de Duplicatas (Ingestão)

| Regra | Detalhes |
|---|---|
| Janela | 30 segundos |
| Fingerprint | `user_id + amount + date + category_id + person_id` |
| Resposta | HTTP 409 com `"Duplicate detected."` |

---

## Limites e Throttling

| Recurso | Limite |
|---|---|
| Requisições por IP | 30/min |
| Requisições por token | 30/min |
| Transações retornadas (transactions) | Máximo 5.000 por consulta |
| Assets retornados (transactions) | Máximo 5.000 por consulta |
| Notas (notes) | Máximo 500 caracteres |
| Body JSON | Deve ser JSON válido UTF-8 |

---

## Glossário

| Termo | Definição |
|---|---|
| **Summary** | Dados financeiros e patrimoniais consolidados do usuário |
| **Transactions** | Lista completa de receitas, despesas e registros de patrimônio |
| **Asset** | Registro de patrimônio (ex: investimento, imóvel, criptomoeda) |
| **record_type** | Campo que diferencia `income`, `expense` e `asset` |
| **Snapshot** | Tabela pré-computada (`user_financial_snapshot`) com dados consolidados em JSONB |
| **ai_tokens** | Tabela de tokens hash (SHA-256) para autenticação de integrações AI |
| **Rate limit** | Limite de requisições por período para prevenir abuso |
| **Bloqueio progressivo** | Tempo de espera crescente após tentativas falhadas |
| **Fingerprint** | Hash de campos para detectar transações duplicadas |

---

> ⚠️ **Aviso de Segurança:** Esta documentação não contém tokens reais. Todos os valores como `SEU_ADMIN_TOKEN`, `SEU_PROJETO_ID`, `SEU_JWT_TOKEN` e `SEU_USER_TOKEN` são placeholders. Nunca compartilhe tokens reais em documentação, repositórios ou canais de comunicação não seguros.

---

*Documentação gerada para uso interno e auditoria de segurança. Distribuição restrita.*

---

## 🚀 Referência Rápida — Todos os cURL

> **Base URL:** `https://ydycczdidgmphrrnucim.supabase.co/functions/v1`

---

### 1. Summary (dados consolidados)

```bash
curl -X POST https://ydycczdidgmphrrnucim.supabase.co/functions/v1/external-api \
  -H "Authorization: Bearer SEU_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"phone_number":"5511999999999","type":"summary"}'
```

**Retorna:** saldo total, receitas/despesas totais, mês atual, histórico mensal, categorias, top categorias, patrimônio.

---

### 2. Transactions (todas as transações)

```bash
curl -X POST https://ydycczdidgmphrrnucim.supabase.co/functions/v1/external-api \
  -H "Authorization: Bearer SEU_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"phone_number":"5511999999999","type":"transactions"}'
```

**Retorna:** lista de todas as transações (income/expense) e assets do usuário com id, data, valor, categoria, subcategoria, pessoa e notas.

---

### 3. Ingest Transaction (inserir transação)

```bash
curl -X POST https://ydycczdidgmphrrnucim.supabase.co/functions/v1/ingest-transaction \
  -H "Authorization: Bearer SEU_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"phone_number":"5511999999999","type":"expense","amount":150.50,"category":"ALIMENTAÇÃO","person":"João","date":"2026-02-10","notes":"Almoço"}'
```

**Retorna:** `{ success, message, transaction: { id, type, date, amount, notes } }`

---

### 4. Query Financial Data — por campo

> **Autenticação:** Mesmo token admin (`EXTERNAL_API_ADMIN_TOKEN`). Usuário identificado pelo `phone_number` no body.

#### 4a. Padrão (overview + current_month)

```bash
curl -X POST https://ydycczdidgmphrrnucim.supabase.co/functions/v1/query-financial-data \
  -H "Authorization: Bearer SEU_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"phone_number":"5511999999999"}'
```

**Retorna:** saldo, totais, savings rate, gastos/receitas do mês, top categorias do mês.

#### 4b. Overview

```bash
curl -X POST https://ydycczdidgmphrrnucim.supabase.co/functions/v1/query-financial-data \
  -H "Authorization: Bearer SEU_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"phone_number":"5511999999999","fields":["overview"]}'
```

**Retorna:** status, saldo, receita/despesa total, nº transações, médias mensais, savings rate.

#### 4c. Current Month

```bash
curl -X POST https://ydycczdidgmphrrnucim.supabase.co/functions/v1/query-financial-data \
  -H "Authorization: Bearer SEU_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"phone_number":"5511999999999","fields":["current_month"]}'
```

**Retorna:** mês, receita, despesa, saldo, nº transações, média diária, top despesas e receitas do mês.

#### 4d. Monthly History

```bash
curl -X POST https://ydycczdidgmphrrnucim.supabase.co/functions/v1/query-financial-data \
  -H "Authorization: Bearer SEU_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"phone_number":"5511999999999","fields":["monthly_history"]}'
```

**Retorna:** array com mês, receita, despesa, saldo e nº transações de cada mês.

#### 4e. Categories

```bash
curl -X POST https://ydycczdidgmphrrnucim.supabase.co/functions/v1/query-financial-data \
  -H "Authorization: Bearer SEU_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"phone_number":"5511999999999","fields":["categories"]}'
```

**Retorna:** categorias de despesa e receita com total, contagem, média e subcategorias.

#### 4f. Category Trends

```bash
curl -X POST https://ydycczdidgmphrrnucim.supabase.co/functions/v1/query-financial-data \
  -H "Authorization: Bearer SEU_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"phone_number":"5511999999999","fields":["category_trends"]}'
```

**Retorna:** evolução mensal das top categorias (mês, categoria, total).

#### 4g. Patrimony

```bash
curl -X POST https://ydycczdidgmphrrnucim.supabase.co/functions/v1/query-financial-data \
  -H "Authorization: Bearer SEU_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"phone_number":"5511999999999","fields":["patrimony"]}'
```

**Retorna:** patrimônio total, mês anterior, crescimento absoluto/%, distribuição por categoria.

#### 4h. Recent Transactions

```bash
curl -X POST https://ydycczdidgmphrrnucim.supabase.co/functions/v1/query-financial-data \
  -H "Authorization: Bearer SEU_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"phone_number":"5511999999999","fields":["recent_transactions"]}'
```

**Retorna:** últimas 15 transações com data, tipo, valor, categoria, subcategoria e pessoa.

#### 4i. Insights

```bash
curl -X POST https://ydycczdidgmphrrnucim.supabase.co/functions/v1/query-financial-data \
  -H "Authorization: Bearer SEU_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"phone_number":"5511999999999","fields":["insights"]}'
```

**Retorna:** alertas, sugestões e scores (saúde financeira, controle de gastos, taxa de poupança).

#### 4j. Todos os campos

```bash
curl -X POST https://ydycczdidgmphrrnucim.supabase.co/functions/v1/query-financial-data \
  -H "Authorization: Bearer SEU_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"phone_number":"5511999999999","fields":"all"}'
```

**Retorna:** todos os 8 blocos acima combinados (~4.5 KB).
