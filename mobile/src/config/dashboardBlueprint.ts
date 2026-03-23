// Generated from src/config/dashboardBlueprint.ts. Do not edit manually.
export type DashboardDimensionKey = "payment_method" | "account" | "project";

export const dashboardBlueprint = {
  header: {
    title: "Dashboard Financeiro",
    subtitle: "Visao geral completa das suas financas",
  },
  filterPresets: [
    { value: "7d", label: "7 dias" },
    { value: "30d", label: "30 dias" },
    { value: "month", label: "Mes atual" },
    { value: "year", label: "Ano atual" },
    { value: "upto_month", label: "Ate o mes" },
    { value: "all", label: "Todo periodo" },
  ],
  sections: {
    timeline: "Timeline Mensal",
    categories: "Top Categorias (Despesas)",
    categoryRanking: "Ranking de Categorias",
    subcategories: "Top Subcategorias (Despesas)",
    persons: "Top Pessoas (Despesas)",
    personTimeline: "Timeline por Pessoa",
    cumulativeBalance: "Saldo Acumulado",
    weekday: "Gastos por Dia da Semana",
    transactions: "Ultimos Lancamentos",
  },
  dimensionOrder: ["payment_method", "account", "project"] as DashboardDimensionKey[],
} as const;

export type DashboardBlueprint = typeof dashboardBlueprint;
