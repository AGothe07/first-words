export type GoalDataSource = "asset" | "income" | "balance";
export type GoalProgressMode = "evolution" | "remaining";
export type GoalPeriodType = "monthly" | "yearly" | "custom";

export interface Goal {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  goal_type: string;
  target_value: number | null;
  current_value: number | null;
  unit: string | null;
  start_date: string;
  target_date: string | null;
  status: string;
  priority: string;
  color: string | null;
  // Dynamic goal fields
  data_source: GoalDataSource | null;
  baseline_value: number | null;
  progress_mode: GoalProgressMode | null;
  period_type: GoalPeriodType | null;
  period_start: string | null;
  period_end: string | null;
  person_ids: string[] | null;
  created_at?: string;
  updated_at?: string;
}

export const dataSourceLabels: Record<GoalDataSource, string> = {
  asset: "Patrimônio",
  income: "Receita",
  balance: "Saldo",
};

export const dataSourceColors: Record<GoalDataSource, string> = {
  asset: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  income: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  balance: "bg-violet-500/10 text-violet-600 border-violet-500/20",
};

export const progressModeLabels: Record<GoalProgressMode, string> = {
  evolution: "Progresso Evolutivo",
  remaining: "Valor Restante",
};

export const typeLabels: Record<string, string> = {
  personal: "Pessoal",
  financial: "Financeiro",
  health: "Saúde",
  career: "Carreira",
  education: "Educação",
  other: "Outro",
  asset: "Patrimônio",
  income: "Receita",
  balance: "Saldo",
};

export const typeColors: Record<string, string> = {
  personal: "bg-primary/10 text-primary",
  financial: "bg-success/10 text-success",
  health: "bg-warning/10 text-warning",
  career: "bg-accent text-accent-foreground",
  education: "bg-secondary text-secondary-foreground",
  other: "bg-muted text-muted-foreground",
  asset: "bg-emerald-500/10 text-emerald-600",
  income: "bg-blue-500/10 text-blue-600",
  balance: "bg-violet-500/10 text-violet-600",
};
