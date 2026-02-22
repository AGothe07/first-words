export type TransactionType = "expense" | "income";

export interface Category {
  id: string;
  user_id: string;
  name: string;
  type: TransactionType;
  is_active: boolean;
  created_at: string;
}

export interface Subcategory {
  id: string;
  user_id: string;
  category_id: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

export interface Person {
  id: string;
  user_id: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  type: TransactionType;
  date: string;
  amount: number;
  person_id: string;
  category_id: string;
  subcategory_id: string | null;
  payment_method_id?: string | null;
  account_id?: string | null;
  project_id?: string | null;
  installment_group_id?: string | null;
  installment_number?: number | null;
  installment_total?: number | null;
  notes?: string;
  created_at: string;
  // Joined fields for display
  person_name?: string;
  category_name?: string;
  subcategory_name?: string;
  payment_method_name?: string;
  account_name?: string;
  project_name?: string;
  tag_names?: string[];
}

export interface ImportLog {
  id: string;
  user_id: string;
  type: TransactionType;
  file_name: string;
  total_records: number;
  imported_records: number;
  status: "success" | "partial" | "error";
  error_details?: any;
  created_at: string;
}

export interface FilterState {
  dateRange: { from: string; to: string } | null;
  persons: string[];
  categories: string[];
  subcategories: string[];
  type: TransactionType | "all";
  preset: string;
  paymentMethods: string[];
  accounts: string[];
  projects: string[];
}
