import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Lightweight hook to check if family mode is enabled for sidebar/conditional rendering.
 * Avoids importing the full useUserPreferences in the sidebar.
 */
export function useFamilyMode() {
  const { user } = useAuth();
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    const { data } = await supabase
      .from("user_preferences")
      .select("family_mode_enabled")
      .eq("user_id", user.id)
      .maybeSingle();
    setEnabled((data as any)?.family_mode_enabled ?? false);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetch(); }, [fetch]);

  return { familyModeEnabled: enabled, loading, refetch: fetch };
}
