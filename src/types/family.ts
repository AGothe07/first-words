export interface FamilyPermissions {
  can_create_transactions: boolean;
  can_edit_own_transactions: boolean;
  can_delete_own_transactions: boolean;
  can_edit_others_transactions: boolean;
  can_delete_others_transactions: boolean;
  can_view_family_expenses: boolean;
  can_view_family_income: boolean;
  can_view_family_balance: boolean;
  can_view_only_own_expenses: boolean;
  can_view_only_own_balance: boolean;
  view_assets: boolean;
  view_debts: boolean;
}

export const DEFAULT_PERMISSIONS: FamilyPermissions = {
  can_create_transactions: true,
  can_edit_own_transactions: true,
  can_delete_own_transactions: true,
  can_edit_others_transactions: false,
  can_delete_others_transactions: false,
  can_view_family_expenses: true,
  can_view_family_income: false,
  can_view_family_balance: false,
  can_view_only_own_expenses: false,
  can_view_only_own_balance: true,
  view_assets: true,
  view_debts: true,
};

export const PERMISSION_LABELS: Record<keyof FamilyPermissions, string> = {
  can_create_transactions: "Criar lançamentos",
  can_edit_own_transactions: "Editar próprios lançamentos",
  can_delete_own_transactions: "Excluir próprios lançamentos",
  can_edit_others_transactions: "Editar lançamentos de outros",
  can_delete_others_transactions: "Excluir lançamentos de outros",
  can_view_family_expenses: "Ver despesas da família",
  can_view_family_income: "Ver receitas da família",
  can_view_family_balance: "Ver saldo total da família",
  can_view_only_own_expenses: "Restringir a apenas próprios gastos",
  can_view_only_own_balance: "Ver apenas próprio saldo",
  view_assets: "Ver patrimônio",
  view_debts: "Ver dívidas",
};

export const PERMISSION_GROUPS = [
  {
    label: "Lançamentos",
    keys: [
      "can_create_transactions",
      "can_edit_own_transactions",
      "can_delete_own_transactions",
      "can_edit_others_transactions",
      "can_delete_others_transactions",
    ] as (keyof FamilyPermissions)[],
  },
  {
    label: "Visibilidade Financeira",
    keys: [
      "can_view_family_expenses",
      "can_view_family_income",
      "can_view_family_balance",
      "can_view_only_own_expenses",
      "can_view_only_own_balance",
    ] as (keyof FamilyPermissions)[],
  },
  {
    label: "Outros",
    keys: ["view_assets", "view_debts"] as (keyof FamilyPermissions)[],
  },
];
