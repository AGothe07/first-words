import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from "react";
import { Investment, InvestmentEntry, InvestmentFilterState } from "@/types/investments";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { parseISO, isWithinInterval } from "date-fns";

interface InvestmentWithStats extends Investment {
  total_invested: number;
  entry_count: number;
  last_entry_date: string | null;
}

interface InvestmentsContextType {
  investments: Investment[];
  entries: InvestmentEntry[];
  investmentsWithStats: InvestmentWithStats[];
  loading: boolean;
  filters: InvestmentFilterState;
  setFilters: React.Dispatch<React.SetStateAction<InvestmentFilterState>>;
  filteredInvestments: InvestmentWithStats[];
  addInvestment: (inv: Pick<Investment, "name" | "type" | "notes">) => Promise<string | null>;
  updateInvestment: (inv: Pick<Investment, "id" | "name" | "type" | "notes">) => Promise<void>;
  deleteInvestment: (id: string) => Promise<void>;
  addEntry: (entry: Pick<InvestmentEntry, "investment_id" | "amount" | "date" | "notes">) => Promise<void>;
  updateEntry: (entry: Pick<InvestmentEntry, "id" | "amount" | "date" | "notes">) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
  getEntriesForInvestment: (investmentId: string) => InvestmentEntry[];
  refreshData: () => Promise<void>;
}

const InvestmentsContext = createContext<InvestmentsContextType | null>(null);

const defaultFilters: InvestmentFilterState = { types: [], search: "", dateRange: null };

export function InvestmentsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [entries, setEntries] = useState<InvestmentEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<InvestmentFilterState>(defaultFilters);

  const refreshData = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    try {
      const [invRes, entRes] = await Promise.all([
        supabase.from("investments").select("*").eq("user_id", user.id).eq("is_active", true).order("name"),
        supabase.from("investment_entries").select("*").eq("user_id", user.id).order("date", { ascending: false }),
      ]);
      if (invRes.error) throw invRes.error;
      if (entRes.error) throw entRes.error;
      setInvestments((invRes.data || []) as unknown as Investment[]);
      setEntries((entRes.data || []).map(e => ({ ...e, amount: Number(e.amount) })) as unknown as InvestmentEntry[]);
    } catch (err) {
      console.error("Failed to load investments:", err);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { refreshData(); }, [refreshData]);

  const investmentsWithStats = useMemo<InvestmentWithStats[]>(() => {
    return investments.map(inv => {
      const invEntries = entries.filter(e => e.investment_id === inv.id);
      const total = invEntries.reduce((s, e) => s + e.amount, 0);
      const sorted = [...invEntries].sort((a, b) => b.date.localeCompare(a.date));
      return {
        ...inv,
        total_invested: total,
        entry_count: invEntries.length,
        last_entry_date: sorted[0]?.date ?? null,
      };
    });
  }, [investments, entries]);

  const filteredInvestments = useMemo(() => {
    return investmentsWithStats.filter(inv => {
      if (filters.types.length > 0 && !filters.types.includes(inv.type)) return false;
      if (filters.search && !inv.name.toLowerCase().includes(filters.search.toLowerCase())) return false;
      if (filters.dateRange) {
        const invEntries = entries.filter(e => e.investment_id === inv.id);
        const hasEntryInRange = invEntries.some(e => {
          const d = parseISO(e.date);
          return isWithinInterval(d, { start: parseISO(filters.dateRange!.from), end: parseISO(filters.dateRange!.to) });
        });
        if (!hasEntryInRange) return false;
      }
      return true;
    });
  }, [investmentsWithStats, filters, entries]);

  const addInvestment = useCallback(async (inv: Pick<Investment, "name" | "type" | "notes">) => {
    if (!user) return null;
    const { data, error } = await supabase.from("investments").insert({ ...inv, user_id: user.id } as any).select("id").single();
    if (error) { toast.error("Erro: " + error.message); return null; }
    toast.success("Investimento criado!");
    await refreshData();
    return (data as any).id as string;
  }, [user, refreshData]);

  const updateInvestment = useCallback(async (inv: Pick<Investment, "id" | "name" | "type" | "notes">) => {
    const { error } = await supabase.from("investments").update({ name: inv.name, type: inv.type, notes: inv.notes } as any).eq("id", inv.id);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("Investimento atualizado!");
    await refreshData();
  }, [refreshData]);

  const deleteInvestment = useCallback(async (id: string) => {
    const { error } = await supabase.from("investments").update({ is_active: false } as any).eq("id", id);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("Investimento removido!");
    await refreshData();
  }, [refreshData]);

  const addEntry = useCallback(async (entry: Pick<InvestmentEntry, "investment_id" | "amount" | "date" | "notes">) => {
    if (!user) return;
    const { error } = await supabase.from("investment_entries").insert({ ...entry, user_id: user.id } as any);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("Aporte registrado!");
    await refreshData();
  }, [user, refreshData]);

  const updateEntry = useCallback(async (entry: Pick<InvestmentEntry, "id" | "amount" | "date" | "notes">) => {
    const { error } = await supabase.from("investment_entries").update({ amount: entry.amount, date: entry.date, notes: entry.notes } as any).eq("id", entry.id);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("Aporte atualizado!");
    await refreshData();
  }, [refreshData]);

  const deleteEntry = useCallback(async (id: string) => {
    const { error } = await supabase.from("investment_entries").delete().eq("id", id);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("Aporte excluído!");
    await refreshData();
  }, [refreshData]);

  const getEntriesForInvestment = useCallback((investmentId: string) => {
    return entries.filter(e => e.investment_id === investmentId);
  }, [entries]);

  return (
    <InvestmentsContext.Provider value={{
      investments, entries, investmentsWithStats, loading, filters, setFilters,
      filteredInvestments, addInvestment, updateInvestment, deleteInvestment,
      addEntry, updateEntry, deleteEntry, getEntriesForInvestment, refreshData,
    }}>
      {children}
    </InvestmentsContext.Provider>
  );
}

export function useInvestments() {
  const ctx = useContext(InvestmentsContext);
  if (!ctx) throw new Error("useInvestments must be used within InvestmentsProvider");
  return ctx;
}
