import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from "react";
import { Asset, AssetFilterState } from "@/types/assets";
import { Category } from "@/types/finance";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { startOfYear, subDays, format, parseISO, isWithinInterval } from "date-fns";
import { toast } from "sonner";

interface AssetsContextType {
  assets: Asset[];
  loading: boolean;
  assetCategories: Category[];
  addAsset: (a: Omit<Asset, "id" | "user_id" | "created_at" | "updated_at">) => Promise<void>;
  updateAsset: (a: Asset) => Promise<void>;
  deleteAsset: (id: string) => Promise<void>;
  filters: AssetFilterState;
  setFilters: React.Dispatch<React.SetStateAction<AssetFilterState>>;
  filteredAssets: Asset[];
  refreshData: () => Promise<void>;
}

const AssetsContext = createContext<AssetsContextType | null>(null);

const defaultFilters: AssetFilterState = {
  dateRange: null,
  categories: [],
  preset: "all",
};

function getPresetRange(preset: string): { from: string; to: string } | null {
  const today = new Date();
  switch (preset) {
    case "6m": return { from: format(subDays(today, 180), "yyyy-MM-dd"), to: format(today, "yyyy-MM-dd") };
    case "year": return { from: format(startOfYear(today), "yyyy-MM-dd"), to: format(today, "yyyy-MM-dd") };
    case "all": return null;
    default: return null;
  }
}

export function AssetsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [assetCategories, setAssetCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<AssetFilterState>(defaultFilters);

  const refreshData = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    try {
      const [assetsRes, catsRes] = await Promise.all([
        supabase.from("assets").select("*").eq("user_id", user.id).order("date", { ascending: false }),
        supabase.from("categories").select("*").eq("user_id", user.id).eq("type", "asset").order("name"),
      ]);
      if (assetsRes.error) throw assetsRes.error;
      setAssets((assetsRes.data || []).map(a => ({ ...a, value: Number(a.value) })));
      if (catsRes.data) setAssetCategories(catsRes.data as Category[]);
    } catch (err) {
      console.error("Failed to load assets:", err);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { refreshData(); }, [refreshData]);

  const addAsset = useCallback(async (a: Omit<Asset, "id" | "user_id" | "created_at" | "updated_at">) => {
    if (!user) return;
    const { error } = await supabase.from("assets").insert({ ...a, user_id: user.id });
    if (error) { toast.error("Erro ao salvar: " + error.message); return; }
    toast.success("Patrimônio registrado!");
    await refreshData();
  }, [user, refreshData]);

  const updateAsset = useCallback(async (a: Asset) => {
    const { error } = await supabase.from("assets").update({
      category: a.category, date: a.date, value: a.value,
    }).eq("id", a.id);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("Patrimônio atualizado!");
    await refreshData();
  }, [refreshData]);

  const deleteAsset = useCallback(async (id: string) => {
    const { error } = await supabase.from("assets").delete().eq("id", id);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("Registro excluído!");
    await refreshData();
  }, [refreshData]);

  const filteredAssets = useMemo(() => {
    const range = filters.preset === "custom" ? filters.dateRange : getPresetRange(filters.preset);
    return assets.filter(a => {
      if (filters.categories.length > 0 && !filters.categories.includes(a.category)) return false;
      if (range) {
        const d = parseISO(a.date);
        if (!isWithinInterval(d, { start: parseISO(range.from), end: parseISO(range.to) })) return false;
      }
      return true;
    });
  }, [assets, filters]);

  return (
    <AssetsContext.Provider value={{
      assets, loading, assetCategories, addAsset, updateAsset, deleteAsset,
      filters, setFilters, filteredAssets, refreshData,
    }}>
      {children}
    </AssetsContext.Provider>
  );
}

export function useAssets() {
  const ctx = useContext(AssetsContext);
  if (!ctx) throw new Error("useAssets must be used within AssetsProvider");
  return ctx;
}
