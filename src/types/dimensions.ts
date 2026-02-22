export type DimensionKey = "payment_method" | "account" | "project" | "tags";

export interface DimensionSetting {
  id: string;
  user_id: string;
  dimension_key: DimensionKey;
  is_active: boolean;
  is_required: boolean;
  display_order: number;
}

export interface PaymentMethod {
  id: string;
  user_id: string;
  name: string;
  is_active: boolean;
  is_system: boolean;
}

export interface Account {
  id: string;
  user_id: string;
  name: string;
  account_type: string;
  is_active: boolean;
}

export interface Project {
  id: string;
  user_id: string;
  name: string;
  is_active: boolean;
}

export interface Tag {
  id: string;
  user_id: string;
  name: string;
  color: string;
}

export const DIMENSION_LABELS: Record<DimensionKey, string> = {
  payment_method: "Forma de Pagamento",
  account: "Conta / Cartão",
  project: "Projeto / Centro de Custo",
  tags: "Tags",
};

export const DIMENSION_ICONS: Record<DimensionKey, string> = {
  payment_method: "CreditCard",
  account: "Building2",
  project: "FolderKanban",
  tags: "Tag",
};
