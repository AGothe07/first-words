import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths, subDays, format, parseISO, isWithinInterval } from "date-fns";

type Period = "month" | "quarter" | "year" | "all";
type Preset = "7d" | "30d" | "month" | "year" | "upto_month" | "all";
type SelectionType = "category" | "person" | "type" | "subcategory" | "payment_method" | "account" | "project";

interface ChartSelection {
  type: SelectionType | null;
  ids: string[];
  labels: string[];
}

interface FiltersState {
  period: Period;
  preset: Preset;
  categoryId: string | null;
  personId: string | null;
  subcategoryId: string | null;
  paymentMethodId: string | null;
  accountId: string | null;
  projectId: string | null;
  type: "all" | "income" | "expense";
}

interface FilteredData {
  transactions: any[];
  categories: any[];
  persons: any[];
  subcategories: any[];
  paymentMethods: any[];
  accounts: any[];
  projects: any[];
  dimensionSettings: any[];
  allTransactions: any[];
  loading: boolean;
}

interface FiltersContextType {
  filters: FiltersState;
  setFilters: React.Dispatch<React.SetStateAction<FiltersState>>;
  setPeriod: (p: Period) => void;
  setPreset: (preset: Preset) => void;
  setCategoryId: (id: string | null) => void;
  setPersonId: (id: string | null) => void;
  setSubcategoryId: (id: string | null) => void;
  setPaymentMethodId: (id: string | null) => void;
  setAccountId: (id: string | null) => void;
  setProjectId: (id: string | null) => void;
  setType: (t: "all" | "income" | "expense") => void;
  clearAllFilters: () => void;
  data: FilteredData;
  refresh: () => Promise<void>;
  catMap: Map<string, string>;
  perMap: Map<string, string>;
  subMap: Map<string, string>;
  pmMap: Map<string, string>;
  accMap: Map<string, string>;
  projMap: Map<string, string>;
  chartSelection: ChartSelection;
  toggleChartSelection: (type: SelectionType, id: string, label: string) => void;
  removeChartSelection: (id: string) => void;
  clearChartSelection: () => void;
  isDimensionActive: (key: "payment_method" | "account" | "project") => boolean;
  fmt: (v: number) => string;
}

const FiltersContext = createContext<FiltersContextType | null>(null);

export function FiltersProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [filters, setFilters] = useState<FiltersState>({
    period: "month",
    preset: "month",
    categoryId: null,
    personId: null,
    subcategoryId: null,
    paymentMethodId: null,
    accountId: null,
    projectId: null,
    type: "all",
  });
  const [chartSelection, setChartSelection] = useState<ChartSelection>({ type: null, ids: [], labels: [] });

  const [allTransactions, setAllTransactions] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [persons, setPersons] = useState<any[]>([]);
  const [subcategories, setSubcategories] = useState<any[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [dimensionSettings, setDimensionSettings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const clearChartSelection = useCallback(() => setChartSelection({ type: null, ids: [], labels: [] }), []);

  const toggleChartSelection = useCallback((type: SelectionType, id: string, label: string) => {
    setChartSelection((prev) => {
      if (prev.type !== type) {
        return { type, ids: [id], labels: [label] };
      }

      const index = prev.ids.indexOf(id);
      if (index >= 0) {
        const newIds = prev.ids.filter((_, i) => i !== index);
        const newLabels = prev.labels.filter((_, i) => i !== index);
        if (newIds.length === 0) {
          return { type: null, ids: [], labels: [] };
        }
        return { type, ids: newIds, labels: newLabels };
      }

      return { type, ids: [...prev.ids, id], labels: [...prev.labels, label] };
    });
  }, []);

  const removeChartSelection = useCallback((id: string) => {
    setChartSelection((prev) => {
      const index = prev.ids.indexOf(id);
      if (index < 0) {
        return prev;
      }
      const ids = prev.ids.filter((_, i) => i !== index);
      const labels = prev.labels.filter((_, i) => i !== index);
      if (ids.length === 0) {
        return { type: null, ids: [], labels: [] };
      }
      return { type: prev.type, ids, labels };
    });
  }, []);

  const getPresetRange = useCallback((preset: Preset) => {
    const now = new Date();
    switch (preset) {
      case "7d":
        return { from: subDays(now, 7), to: now };
      case "30d":
        return { from: subDays(now, 30), to: now };
      case "month":
        return { from: startOfMonth(now), to: endOfMonth(now) };
      case "year":
        return { from: startOfYear(now), to: endOfYear(now) };
      case "upto_month":
        return { from: parseISO("2000-01-01"), to: endOfMonth(now) };
      case "all":
      default:
        return null;
    }
  }, []);

  const periodFromPreset = useCallback((preset: Preset): Period => {
    if (preset === "month") return "month";
    if (preset === "year") return "year";
    if (preset === "all" || preset === "upto_month") return "all";
    return "quarter";
  }, []);

  const fetchAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [txRes, catRes, perRes, subRes, pmRes, accRes, projRes, settingsRes] = await Promise.all([
      supabase.from("transactions").select("*").eq("user_id", user.id).order("date", { ascending: false }),
      supabase.from("categories").select("id, name, type").eq("user_id", user.id).eq("is_active", true).order("name"),
      supabase.from("persons").select("id, name").eq("user_id", user.id).eq("is_active", true).order("name"),
      supabase.from("subcategories").select("id, name, category_id").eq("user_id", user.id).eq("is_active", true).order("name"),
      supabase.from("payment_methods").select("id, name, is_active").eq("user_id", user.id).order("name"),
      supabase.from("accounts").select("id, name, is_active").eq("user_id", user.id).order("name"),
      supabase.from("projects").select("id, name, is_active").eq("user_id", user.id).order("name"),
      supabase.from("dimension_settings").select("dimension_key, is_active").eq("user_id", user.id),
    ]);
    setAllTransactions((txRes.data || []).map((t: any) => ({ ...t, amount: Number(t.amount) })));
    setCategories(catRes.data || []);
    setPersons(perRes.data || []);
    setSubcategories(subRes.data || []);
    setPaymentMethods((pmRes.data || []).filter((item: any) => item.is_active !== false));
    setAccounts((accRes.data || []).filter((item: any) => item.is_active !== false));
    setProjects((projRes.data || []).filter((item: any) => item.is_active !== false));
    setDimensionSettings(settingsRes.data || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);
  const perMap = useMemo(() => new Map(persons.map((p) => [p.id, p.name])), [persons]);
  const subMap = useMemo(() => new Map(subcategories.map((s) => [s.id, s.name])), [subcategories]);
  const pmMap = useMemo(() => new Map(paymentMethods.map((p) => [p.id, p.name])), [paymentMethods]);
  const accMap = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts]);
  const projMap = useMemo(() => new Map(projects.map((p) => [p.id, p.name])), [projects]);

  const isDimensionActive = useCallback((key: "payment_method" | "account" | "project") => {
    return dimensionSettings.find((item) => item.dimension_key === key)?.is_active ?? false;
  }, [dimensionSettings]);

  const transactions = useMemo(() => {
    const range = getPresetRange(filters.preset);

    return allTransactions.filter((t) => {
      const d = parseISO(t.date);

      if (range && !isWithinInterval(d, { start: range.from, end: range.to })) return false;
      if (filters.type !== "all" && t.type !== filters.type) return false;

      if (filters.categoryId && t.category_id !== filters.categoryId) return false;
      if (filters.personId && t.person_id !== filters.personId) return false;
      if (filters.subcategoryId && t.subcategory_id !== filters.subcategoryId) return false;
      if (filters.paymentMethodId && t.payment_method_id !== filters.paymentMethodId) return false;
      if (filters.accountId && t.account_id !== filters.accountId) return false;
      if (filters.projectId && t.project_id !== filters.projectId) return false;

      if (chartSelection.type && chartSelection.ids.length > 0) {
        if (chartSelection.type === "category") return chartSelection.ids.includes(t.category_id);
        if (chartSelection.type === "person") return chartSelection.ids.includes(t.person_id);
        if (chartSelection.type === "type") return chartSelection.ids.includes(t.type);
        if (chartSelection.type === "subcategory") return t.subcategory_id ? chartSelection.ids.includes(t.subcategory_id) : false;
        if (chartSelection.type === "payment_method") return t.payment_method_id ? chartSelection.ids.includes(t.payment_method_id) : false;
        if (chartSelection.type === "account") return t.account_id ? chartSelection.ids.includes(t.account_id) : false;
        if (chartSelection.type === "project") return t.project_id ? chartSelection.ids.includes(t.project_id) : false;
      }

      return true;
    });
  }, [allTransactions, filters, chartSelection, getPresetRange]);

  const fmt = useCallback((v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, []);

  const clearAllFilters = useCallback(() => {
    setFilters((f) => ({
      ...f,
      period: "month",
      preset: "month",
      type: "all",
      categoryId: null,
      personId: null,
      subcategoryId: null,
      paymentMethodId: null,
      accountId: null,
      projectId: null,
    }));
    clearChartSelection();
  }, [clearChartSelection]);

  const value: FiltersContextType = {
    filters,
    setFilters,
    setPeriod: (period) => {
      const preset: Preset = period === "month" ? "month" : period === "year" ? "year" : period === "quarter" ? "30d" : "all";
      setFilters((f) => ({ ...f, period, preset }));
    },
    setPreset: (preset) => {
      setFilters((f) => ({ ...f, preset, period: periodFromPreset(preset) }));
    },
    setCategoryId: (id) => setFilters((f) => ({ ...f, categoryId: id })),
    setPersonId: (id) => setFilters((f) => ({ ...f, personId: id })),
    setSubcategoryId: (id) => setFilters((f) => ({ ...f, subcategoryId: id })),
    setPaymentMethodId: (id) => setFilters((f) => ({ ...f, paymentMethodId: id })),
    setAccountId: (id) => setFilters((f) => ({ ...f, accountId: id })),
    setProjectId: (id) => setFilters((f) => ({ ...f, projectId: id })),
    setType: (t) => setFilters((f) => ({ ...f, type: t })),
    clearAllFilters,
    data: { transactions, categories, persons, subcategories, paymentMethods, accounts, projects, dimensionSettings, allTransactions, loading },
    refresh: fetchAll,
    catMap,
    perMap,
    subMap,
    pmMap,
    accMap,
    projMap,
    chartSelection,
    toggleChartSelection,
    removeChartSelection,
    clearChartSelection,
    isDimensionActive,
    fmt,
  };

  return <FiltersContext.Provider value={value}>{children}</FiltersContext.Provider>;
}

export function useFilters() {
  const ctx = useContext(FiltersContext);
  if (!ctx) throw new Error("useFilters must be used within FiltersProvider");
  return ctx;
}
