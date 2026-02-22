import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from "react";
import { Transaction, FilterState, TransactionType, Category, Subcategory, Person } from "@/types/finance";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { startOfMonth, endOfMonth, subDays, startOfYear, format, parseISO, isWithinInterval } from "date-fns";
import { toast } from "sonner";

export type ChartSelectionType = "category" | "person" | "type" | "subcategory" | "payment_method" | "account" | "project";

export interface ChartSelection {
  type: ChartSelectionType | null;
  ids: string[];
  labels: string[];
}

interface FinanceContextType {
  transactions: Transaction[];
  categories: Category[];
  subcategories: Subcategory[];
  persons: Person[];
  loading: boolean;
  addTransaction: (t: Omit<Transaction, "id" | "user_id" | "created_at">) => Promise<void>;
  addTransactionsBulk: (items: Omit<Transaction, "id" | "user_id" | "created_at">[]) => Promise<void>;
  updateTransaction: (t: Transaction) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  bulkDeleteTransactions: (ids: string[]) => Promise<void>;
  addCategory: (name: string, type: string) => Promise<void>;
  updateCategory: (id: string, name: string, isActive: boolean) => Promise<void>;
  deleteCategory: (id: string) => Promise<boolean>;
  addSubcategory: (categoryId: string, name: string) => Promise<void>;
  updateSubcategory: (id: string, name: string, isActive: boolean) => Promise<void>;
  deleteSubcategory: (id: string) => Promise<boolean>;
  addPerson: (name: string) => Promise<void>;
  updatePerson: (id: string, name: string, isActive: boolean) => Promise<void>;
  deletePerson: (id: string) => Promise<boolean>;
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  filteredTransactions: Transaction[];
  crossFilteredTransactions: Transaction[];
  chartSelection: ChartSelection;
  toggleChartSelection: (type: ChartSelectionType, id: string, label: string) => void;
  clearChartSelection: () => void;
  drillCategory: string | null;
  setDrillCategory: (c: string | null) => void;
  refreshData: () => Promise<void>;
}

const FinanceContext = createContext<FinanceContextType | null>(null);

const defaultFilters: FilterState = {
  dateRange: null,
  persons: [],
  categories: [],
  subcategories: [],
  type: "all",
  preset: "month",
  paymentMethods: [],
  accounts: [],
  projects: [],
};

function getPresetRange(preset: string): { from: string; to: string } | null {
  const today = new Date();
  switch (preset) {
    case "7d": return { from: format(subDays(today, 7), "yyyy-MM-dd"), to: format(today, "yyyy-MM-dd") };
    case "30d": return { from: format(subDays(today, 30), "yyyy-MM-dd"), to: format(today, "yyyy-MM-dd") };
    case "month": return { from: format(startOfMonth(today), "yyyy-MM-dd"), to: format(endOfMonth(today), "yyyy-MM-dd") };
    case "year": return { from: format(startOfYear(today), "yyyy-MM-dd"), to: format(today, "yyyy-MM-dd") };
    case "upto_month": return { from: "2000-01-01", to: format(endOfMonth(today), "yyyy-MM-dd") };
    case "all": return null;
    default: return null;
  }
}

export function FinanceProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [persons, setPersons] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [drillCategory, setDrillCategory] = useState<string | null>(null);
  const [chartSelection, setChartSelection] = useState<ChartSelection>({ type: null, ids: [], labels: [] });
  const clearChartSelection = useCallback(() => setChartSelection({ type: null, ids: [], labels: [] }), []);

  const toggleChartSelection = useCallback((type: ChartSelectionType, id: string, label: string) => {
    setChartSelection(prev => {
      // If switching type, start fresh with this selection
      if (prev.type !== type) {
        return { type, ids: [id], labels: [label] };
      }
      // Toggle: if already selected, remove it
      const idx = prev.ids.indexOf(id);
      if (idx >= 0) {
        const newIds = prev.ids.filter((_, i) => i !== idx);
        const newLabels = prev.labels.filter((_, i) => i !== idx);
        if (newIds.length === 0) return { type: null, ids: [], labels: [] };
        return { type, ids: newIds, labels: newLabels };
      }
      // Add to selection
      return { type, ids: [...prev.ids, id], labels: [...prev.labels, label] };
    });
  }, []);

  const refreshData = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    try {
      const [txRes, catRes, subRes, perRes, pmRes, accRes, projRes] = await Promise.all([
        supabase.from("transactions").select("*").eq("user_id", user.id).order("date", { ascending: false }),
        supabase.from("categories").select("*").eq("user_id", user.id).order("name"),
        supabase.from("subcategories").select("*").eq("user_id", user.id).order("name"),
        supabase.from("persons").select("*").eq("user_id", user.id).order("name"),
        supabase.from("payment_methods").select("*").eq("user_id", user.id),
        supabase.from("accounts").select("*").eq("user_id", user.id),
        supabase.from("projects").select("*").eq("user_id", user.id),
      ]);

      if (txRes.data) {
        const catMap = new Map((catRes.data || []).map(c => [c.id, c.name]));
        const subMap = new Map((subRes.data || []).map(s => [s.id, s.name]));
        const perMap = new Map((perRes.data || []).map(p => [p.id, p.name]));
        const pmMap = new Map((pmRes.data || []).map(p => [p.id, p.name]));
        const accMap = new Map((accRes.data || []).map(a => [a.id, a.name]));
        const projMap = new Map((projRes.data || []).map(p => [p.id, p.name]));
        setTransactions(txRes.data.map(t => ({
          ...t,
          type: t.type as TransactionType,
          amount: Number(t.amount),
          person_name: perMap.get(t.person_id) || "?",
          category_name: catMap.get(t.category_id) || "?",
          subcategory_name: t.subcategory_id ? subMap.get(t.subcategory_id) || "" : "",
          payment_method_name: t.payment_method_id ? pmMap.get(t.payment_method_id) || "" : "",
          account_name: t.account_id ? accMap.get(t.account_id) || "" : "",
          project_name: t.project_id ? projMap.get(t.project_id) || "" : "",
        })));
      }
      if (catRes.data) setCategories(catRes.data as Category[]);
      if (subRes.data) setSubcategories(subRes.data as Subcategory[]);
      if (perRes.data) setPersons(perRes.data as Person[]);
    } catch (err) {
      console.error("Failed to load data:", err);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { refreshData(); }, [refreshData]);

  // Transaction CRUD
  const addTransaction = useCallback(async (t: Omit<Transaction, "id" | "user_id" | "created_at">) => {
    if (!user) return;
    const { error } = await supabase.from("transactions").insert({ ...t, user_id: user.id } as any);
    if (error) { toast.error("Erro ao salvar: " + error.message); return; }
    toast.success("Lançamento adicionado!");
    await refreshData();
  }, [user, refreshData]);

  const addTransactionsBulk = useCallback(async (items: Omit<Transaction, "id" | "user_id" | "created_at">[]) => {
    if (!user || items.length === 0) return;
    const rows = items.map(t => ({ ...t, user_id: user.id }));
    const { error } = await supabase.from("transactions").insert(rows as any);
    if (error) { toast.error("Erro ao salvar parcelas: " + error.message); return; }
    toast.success(`${items.length} parcela(s) adicionada(s)!`);
    await refreshData();
  }, [user, refreshData]);

  const updateTransaction = useCallback(async (t: Transaction) => {
    const { error } = await supabase.from("transactions").update({
      type: t.type, date: t.date, amount: t.amount,
      person_id: t.person_id, category_id: t.category_id,
      subcategory_id: t.subcategory_id, notes: t.notes,
      payment_method_id: t.payment_method_id || null,
      account_id: t.account_id || null,
      project_id: t.project_id || null,
    }).eq("id", t.id);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("Lançamento atualizado!");
    await refreshData();
  }, [refreshData]);

  const deleteTransaction = useCallback(async (id: string) => {
    const { error } = await supabase.from("transactions").delete().eq("id", id);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("Excluído!");
    await refreshData();
  }, [refreshData]);

  const bulkDeleteTransactions = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;
    const batchSize = 100;
    let deleted = 0;
    for (let i = 0; i < ids.length; i += batchSize) {
      const batch = ids.slice(i, i + batchSize);
      const { error } = await supabase.from("transactions").delete().in("id", batch);
      if (error) { toast.error("Erro ao excluir: " + error.message); return; }
      deleted += batch.length;
    }
    toast.success(`${deleted} lançamento(s) excluído(s)!`);
    await refreshData();
  }, [refreshData]);

  // Category CRUD
  const addCategory = useCallback(async (name: string, type: string) => {
    if (!user) return;
    const { error } = await supabase.from("categories").insert({ name: name.trim(), type, user_id: user.id });
    if (error) { toast.error(error.message.includes("duplicate") ? "Categoria já existe" : error.message); return; }
    toast.success("Categoria criada!");
    await refreshData();
  }, [user, refreshData]);

  const updateCategory = useCallback(async (id: string, name: string, isActive: boolean) => {
    const { error } = await supabase.from("categories").update({ name: name.trim(), is_active: isActive }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    await refreshData();
  }, [refreshData]);

  const deleteCategory = useCallback(async (id: string): Promise<boolean> => {
    const { count } = await supabase.from("transactions").select("*", { count: "exact", head: true }).eq("category_id", id);
    if (count && count > 0) {
      toast.error(`Não é possível excluir: ${count} lançamento(s) vinculado(s). Desative a categoria.`);
      return false;
    }
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) { toast.error(error.message); return false; }
    toast.success("Categoria excluída!");
    await refreshData();
    return true;
  }, [refreshData]);

  // Subcategory CRUD
  const addSubcategory = useCallback(async (categoryId: string, name: string) => {
    if (!user) return;
    const { error } = await supabase.from("subcategories").insert({ category_id: categoryId, name: name.trim(), user_id: user.id });
    if (error) { toast.error(error.message.includes("duplicate") ? "Subcategoria já existe" : error.message); return; }
    toast.success("Subcategoria criada!");
    await refreshData();
  }, [user, refreshData]);

  const updateSubcategory = useCallback(async (id: string, name: string, isActive: boolean) => {
    const { error } = await supabase.from("subcategories").update({ name: name.trim(), is_active: isActive }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    await refreshData();
  }, [refreshData]);

  const deleteSubcategory = useCallback(async (id: string): Promise<boolean> => {
    const { count } = await supabase.from("transactions").select("*", { count: "exact", head: true }).eq("subcategory_id", id);
    if (count && count > 0) {
      toast.error(`Não é possível excluir: ${count} lançamento(s) vinculado(s). Desative.`);
      return false;
    }
    const { error } = await supabase.from("subcategories").delete().eq("id", id);
    if (error) { toast.error(error.message); return false; }
    toast.success("Subcategoria excluída!");
    await refreshData();
    return true;
  }, [refreshData]);

  // Person CRUD
  const addPerson = useCallback(async (name: string) => {
    if (!user) return;
    const { error } = await supabase.from("persons").insert({ name: name.trim(), user_id: user.id });
    if (error) { toast.error(error.message.includes("duplicate") ? "Pessoa já existe" : error.message); return; }
    toast.success("Pessoa adicionada!");
    await refreshData();
  }, [user, refreshData]);

  const updatePerson = useCallback(async (id: string, name: string, isActive: boolean) => {
    const { error } = await supabase.from("persons").update({ name: name.trim(), is_active: isActive }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    await refreshData();
  }, [refreshData]);

  const deletePerson = useCallback(async (id: string): Promise<boolean> => {
    const { count } = await supabase.from("transactions").select("*", { count: "exact", head: true }).eq("person_id", id);
    if (count && count > 0) {
      toast.error(`Não é possível excluir: ${count} lançamento(s) vinculado(s). Desative.`);
      return false;
    }
    const { error } = await supabase.from("persons").delete().eq("id", id);
    if (error) { toast.error(error.message); return false; }
    toast.success("Pessoa excluída!");
    await refreshData();
    return true;
  }, [refreshData]);

  // Filtering
  const filteredTransactions = useMemo(() => {
    const range = filters.preset === "custom" ? filters.dateRange : getPresetRange(filters.preset);

    return transactions.filter(t => {
      if (filters.type !== "all" && t.type !== filters.type) return false;
      if (filters.persons.length > 0 && !filters.persons.includes(t.person_id)) return false;
      if (filters.categories.length > 0 && !filters.categories.includes(t.category_id)) return false;
      if (filters.subcategories.length > 0 && t.subcategory_id && !filters.subcategories.includes(t.subcategory_id)) return false;
      if (filters.paymentMethods.length > 0 && (!t.payment_method_id || !filters.paymentMethods.includes(t.payment_method_id))) return false;
      if (filters.accounts.length > 0 && (!t.account_id || !filters.accounts.includes(t.account_id))) return false;
      if (filters.projects.length > 0 && (!t.project_id || !filters.projects.includes(t.project_id))) return false;
      if (range) {
        const d = parseISO(t.date);
        if (!isWithinInterval(d, { start: parseISO(range.from), end: parseISO(range.to) })) return false;
      }
      return true;
    });
  }, [transactions, filters]);

  // Cross-filtered: applies chart selection on top of global filters
  const crossFilteredTransactions = useMemo(() => {
    if (!chartSelection.type || chartSelection.ids.length === 0) return filteredTransactions;
    return filteredTransactions.filter(t => {
      switch (chartSelection.type) {
        case "category": return chartSelection.ids.includes(t.category_id);
        case "person": return chartSelection.ids.includes(t.person_id);
        case "type": return chartSelection.ids.includes(t.type);
        case "subcategory": return t.subcategory_id ? chartSelection.ids.includes(t.subcategory_id) : false;
        case "payment_method": return t.payment_method_id ? chartSelection.ids.includes(t.payment_method_id) : false;
        case "account": return t.account_id ? chartSelection.ids.includes(t.account_id) : false;
        case "project": return t.project_id ? chartSelection.ids.includes(t.project_id) : false;
        default: return true;
      }
    });
  }, [filteredTransactions, chartSelection]);

  return (
    <FinanceContext.Provider value={{
      transactions, categories, subcategories, persons, loading,
      addTransaction, addTransactionsBulk, updateTransaction, deleteTransaction, bulkDeleteTransactions,
      addCategory, updateCategory, deleteCategory,
      addSubcategory, updateSubcategory, deleteSubcategory,
      addPerson, updatePerson, deletePerson,
      filters, setFilters, filteredTransactions, crossFilteredTransactions,
      chartSelection, toggleChartSelection, clearChartSelection,
      drillCategory, setDrillCategory, refreshData,
    }}>
      {children}
    </FinanceContext.Provider>
  );
}

export function useFinance() {
  const ctx = useContext(FinanceContext);
  if (!ctx) throw new Error("useFinance must be used within FinanceProvider");
  return ctx;
}
