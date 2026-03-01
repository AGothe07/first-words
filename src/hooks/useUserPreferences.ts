import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

export interface UserPreferences {
  id?: string;
  user_id: string;
  default_currency: string;
  date_format: string;
  financial_month_start: number;
  default_person_id: string | null;
  default_goal_unit: string;
  goal_progress_mode: string;
  default_agenda_view: string;
  business_hours_start: string;
  business_hours_end: string;
  default_event_duration: number;
  default_event_notify: boolean;
  theme: string;
  primary_color: string;
  font_size: string;
  layout_density: string;
  max_session_hours: number;
  notifications_enabled: boolean;
  birthday_send_time: string;
  events_send_time: string;
}

const defaultPrefs = (userId: string): UserPreferences => ({
  user_id: userId,
  default_currency: "BRL",
  date_format: "DD/MM/YYYY",
  financial_month_start: 1,
  default_person_id: null,
  default_goal_unit: "R$",
  goal_progress_mode: "total",
  default_agenda_view: "month",
  business_hours_start: "08:00",
  business_hours_end: "18:00",
  default_event_duration: 60,
  default_event_notify: true,
  theme: "light",
  primary_color: "#8B5CF6",
  font_size: "medium",
  layout_density: "comfortable",
  max_session_hours: 24,
  notifications_enabled: true,
  birthday_send_time: "09:00",
  events_send_time: "09:00",
});

export function useUserPreferences() {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchPreferences = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("user_preferences")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      console.error("Error fetching preferences:", error);
      setPreferences(defaultPrefs(user.id));
    } else if (!data) {
      // Auto-create
      const defaults = defaultPrefs(user.id);
      const { data: inserted } = await supabase
        .from("user_preferences")
        .insert(defaults)
        .select()
        .single();
      setPreferences((inserted as any) || defaults);
    } else {
      setPreferences(data as any);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchPreferences();
  }, [fetchPreferences]);

  const updatePreferences = useCallback(async (updates: Partial<UserPreferences>) => {
    if (!user || !preferences) return;
    const { error } = await supabase
      .from("user_preferences")
      .update(updates)
      .eq("user_id", user.id);

    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      return false;
    }
    setPreferences(prev => prev ? { ...prev, ...updates } : prev);
    toast({ title: "Configuração salva!" });
    return true;
  }, [user, preferences]);

  return { preferences, loading, updatePreferences, refetch: fetchPreferences };
}
