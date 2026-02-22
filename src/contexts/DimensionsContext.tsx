import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { DimensionSetting, DimensionKey, PaymentMethod, Account, Project, Tag } from "@/types/dimensions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface DimensionsContextType {
  settings: DimensionSetting[];
  paymentMethods: PaymentMethod[];
  accounts: Account[];
  projects: Project[];
  tags: Tag[];
  loading: boolean;
  isDimensionActive: (key: DimensionKey) => boolean;
  isDimensionRequired: (key: DimensionKey) => boolean;
  toggleDimension: (key: DimensionKey, active: boolean) => Promise<void>;
  toggleDimensionRequired: (key: DimensionKey, required: boolean) => Promise<void>;
  // CRUD for each dimension
  addPaymentMethod: (name: string) => Promise<void>;
  updatePaymentMethod: (id: string, name: string, isActive: boolean) => Promise<void>;
  deletePaymentMethod: (id: string) => Promise<boolean>;
  addAccount: (name: string, type: string) => Promise<void>;
  updateAccount: (id: string, name: string, isActive: boolean) => Promise<void>;
  deleteAccount: (id: string) => Promise<boolean>;
  addProject: (name: string) => Promise<void>;
  updateProject: (id: string, name: string, isActive: boolean) => Promise<void>;
  deleteProject: (id: string) => Promise<boolean>;
  addTag: (name: string, color?: string) => Promise<void>;
  deleteTag: (id: string) => Promise<boolean>;
  refreshDimensions: () => Promise<void>;
}

const DimensionsContext = createContext<DimensionsContextType | null>(null);

export function DimensionsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [settings, setSettings] = useState<DimensionSetting[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshDimensions = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    try {
      const [settingsRes, pmRes, accRes, projRes, tagRes] = await Promise.all([
        supabase.from("dimension_settings").select("*").eq("user_id", user.id).order("display_order"),
        supabase.from("payment_methods").select("*").eq("user_id", user.id).order("name"),
        supabase.from("accounts").select("*").eq("user_id", user.id).order("name"),
        supabase.from("projects").select("*").eq("user_id", user.id).order("name"),
        supabase.from("tags").select("*").eq("user_id", user.id).order("name"),
      ]);
      if (settingsRes.data) setSettings(settingsRes.data as unknown as DimensionSetting[]);
      if (pmRes.data) setPaymentMethods(pmRes.data as unknown as PaymentMethod[]);
      if (accRes.data) setAccounts(accRes.data as unknown as Account[]);
      if (projRes.data) setProjects(projRes.data as unknown as Project[]);
      if (tagRes.data) setTags(tagRes.data as unknown as Tag[]);
    } catch (err) {
      console.error("Failed to load dimensions:", err);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { refreshDimensions(); }, [refreshDimensions]);

  const isDimensionActive = useCallback((key: DimensionKey) => {
    return settings.find(s => s.dimension_key === key)?.is_active ?? false;
  }, [settings]);

  const isDimensionRequired = useCallback((key: DimensionKey) => {
    return settings.find(s => s.dimension_key === key)?.is_required ?? false;
  }, [settings]);

  const toggleDimension = useCallback(async (key: DimensionKey, active: boolean) => {
    if (!user) return;
    const { error } = await supabase.from("dimension_settings")
      .update({ is_active: active })
      .eq("user_id", user.id)
      .eq("dimension_key", key);
    if (error) { toast.error(error.message); return; }
    toast.success(active ? "Dimensão ativada!" : "Dimensão desativada!");
    await refreshDimensions();
  }, [user, refreshDimensions]);

  const toggleDimensionRequired = useCallback(async (key: DimensionKey, required: boolean) => {
    if (!user) return;
    const { error } = await supabase.from("dimension_settings")
      .update({ is_required: required })
      .eq("user_id", user.id)
      .eq("dimension_key", key);
    if (error) { toast.error(error.message); return; }
    await refreshDimensions();
  }, [user, refreshDimensions]);

  // Payment Methods CRUD
  const addPaymentMethod = useCallback(async (name: string) => {
    if (!user) return;
    const { error } = await supabase.from("payment_methods").insert({ name: name.trim(), user_id: user.id });
    if (error) { toast.error(error.message); return; }
    toast.success("Forma de pagamento adicionada!");
    await refreshDimensions();
  }, [user, refreshDimensions]);

  const updatePaymentMethod = useCallback(async (id: string, name: string, isActive: boolean) => {
    const { error } = await supabase.from("payment_methods").update({ name: name.trim(), is_active: isActive }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    await refreshDimensions();
  }, [refreshDimensions]);

  const deletePaymentMethod = useCallback(async (id: string): Promise<boolean> => {
    const { count } = await supabase.from("transactions").select("*", { count: "exact", head: true }).eq("payment_method_id", id);
    if (count && count > 0) {
      toast.error(`Não é possível excluir: ${count} lançamento(s) vinculado(s). Desative.`);
      return false;
    }
    const { error } = await supabase.from("payment_methods").delete().eq("id", id);
    if (error) { toast.error(error.message); return false; }
    toast.success("Excluído!");
    await refreshDimensions();
    return true;
  }, [refreshDimensions]);

  // Accounts CRUD
  const addAccount = useCallback(async (name: string, type: string) => {
    if (!user) return;
    const { error } = await supabase.from("accounts").insert({ name: name.trim(), account_type: type, user_id: user.id });
    if (error) { toast.error(error.message); return; }
    toast.success("Conta adicionada!");
    await refreshDimensions();
  }, [user, refreshDimensions]);

  const updateAccount = useCallback(async (id: string, name: string, isActive: boolean) => {
    const { error } = await supabase.from("accounts").update({ name: name.trim(), is_active: isActive }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    await refreshDimensions();
  }, [refreshDimensions]);

  const deleteAccount = useCallback(async (id: string): Promise<boolean> => {
    const { count } = await supabase.from("transactions").select("*", { count: "exact", head: true }).eq("account_id", id);
    if (count && count > 0) {
      toast.error(`Não é possível excluir: ${count} lançamento(s) vinculado(s). Desative.`);
      return false;
    }
    const { error } = await supabase.from("accounts").delete().eq("id", id);
    if (error) { toast.error(error.message); return false; }
    toast.success("Excluído!");
    await refreshDimensions();
    return true;
  }, [refreshDimensions]);

  // Projects CRUD
  const addProject = useCallback(async (name: string) => {
    if (!user) return;
    const { error } = await supabase.from("projects").insert({ name: name.trim(), user_id: user.id });
    if (error) { toast.error(error.message); return; }
    toast.success("Projeto adicionado!");
    await refreshDimensions();
  }, [user, refreshDimensions]);

  const updateProject = useCallback(async (id: string, name: string, isActive: boolean) => {
    const { error } = await supabase.from("projects").update({ name: name.trim(), is_active: isActive }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    await refreshDimensions();
  }, [refreshDimensions]);

  const deleteProject = useCallback(async (id: string): Promise<boolean> => {
    const { count } = await supabase.from("transactions").select("*", { count: "exact", head: true }).eq("project_id", id);
    if (count && count > 0) {
      toast.error(`Não é possível excluir: ${count} lançamento(s) vinculado(s). Desative.`);
      return false;
    }
    const { error } = await supabase.from("projects").delete().eq("id", id);
    if (error) { toast.error(error.message); return false; }
    toast.success("Excluído!");
    await refreshDimensions();
    return true;
  }, [refreshDimensions]);

  // Tags CRUD
  const addTag = useCallback(async (name: string, color?: string) => {
    if (!user) return;
    const { error } = await supabase.from("tags").insert({ name: name.trim(), user_id: user.id, color: color || "#6366f1" });
    if (error) { toast.error(error.message.includes("duplicate") ? "Tag já existe" : error.message); return; }
    toast.success("Tag adicionada!");
    await refreshDimensions();
  }, [user, refreshDimensions]);

  const deleteTag = useCallback(async (id: string): Promise<boolean> => {
    const { error } = await supabase.from("tags").delete().eq("id", id);
    if (error) { toast.error(error.message); return false; }
    toast.success("Tag excluída!");
    await refreshDimensions();
    return true;
  }, [refreshDimensions]);

  return (
    <DimensionsContext.Provider value={{
      settings, paymentMethods, accounts, projects, tags, loading,
      isDimensionActive, isDimensionRequired, toggleDimension, toggleDimensionRequired,
      addPaymentMethod, updatePaymentMethod, deletePaymentMethod,
      addAccount, updateAccount, deleteAccount,
      addProject, updateProject, deleteProject,
      addTag, deleteTag, refreshDimensions,
    }}>
      {children}
    </DimensionsContext.Provider>
  );
}

export function useDimensions() {
  const ctx = useContext(DimensionsContext);
  if (!ctx) throw new Error("useDimensions must be used within DimensionsProvider");
  return ctx;
}
