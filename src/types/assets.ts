export interface Asset {
  id: string;
  user_id: string;
  category: string;
  date: string;
  value: number;
  created_at: string;
  updated_at: string;
}

export interface AssetFilterState {
  dateRange: { from: string; to: string } | null;
  categories: string[];
  preset: string;
}
