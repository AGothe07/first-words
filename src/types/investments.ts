export interface Investment {
  id: string;
  user_id: string;
  name: string;
  type: string;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface InvestmentEntry {
  id: string;
  user_id: string;
  investment_id: string;
  amount: number;
  date: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export const INVESTMENT_TYPES = [
  { value: "stock", label: "Ação" },
  { value: "fii", label: "Fundo Imobiliário" },
  { value: "fixed_income", label: "Renda Fixa" },
  { value: "crypto", label: "Criptomoeda" },
  { value: "fund", label: "Fundo de Investimento" },
  { value: "business", label: "Negócio" },
  { value: "etf", label: "ETF" },
  { value: "other", label: "Outro" },
] as const;

export function getInvestmentTypeLabel(type: string): string {
  return INVESTMENT_TYPES.find(t => t.value === type)?.label ?? type;
}

export interface InvestmentFilterState {
  types: string[];
  search: string;
  dateRange: { from: string; to: string } | null;
}
