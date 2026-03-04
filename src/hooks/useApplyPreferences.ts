import { useEffect } from "react";
import { UserPreferences } from "@/hooks/useUserPreferences";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

// Convert hex to HSL string for CSS variables
function hexToHSL(hex: string): string {
  let r = parseInt(hex.slice(1, 3), 16) / 255;
  let g = parseInt(hex.slice(3, 5), 16) / 255;
  let b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export function useApplyPreferences(preferences: UserPreferences | null) {
  const { signOut } = useAuth();

  // Apply theme (dark/light)
  useEffect(() => {
    if (!preferences) return;
    const root = document.documentElement;
    if (preferences.theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [preferences?.theme]);

  // Apply primary color
  useEffect(() => {
    if (!preferences?.primary_color) return;
    const hsl = hexToHSL(preferences.primary_color);
    const root = document.documentElement;
    root.style.setProperty("--primary", hsl);
    root.style.setProperty("--ring", hsl);
    root.style.setProperty("--sidebar-primary", hsl);
    root.style.setProperty("--sidebar-ring", hsl);
    root.style.setProperty("--chart-1", hsl);
  }, [preferences?.primary_color]);

  // Apply font size
  useEffect(() => {
    if (!preferences?.font_size) return;
    const root = document.documentElement;
    const sizes: Record<string, string> = {
      small: "14px",
      medium: "16px",
      large: "18px",
    };
    root.style.fontSize = sizes[preferences.font_size] || "16px";
  }, [preferences?.font_size]);

  // Apply layout density
  useEffect(() => {
    if (!preferences?.layout_density) return;
    const root = document.documentElement;
    root.dataset.density = preferences.layout_density;
  }, [preferences?.layout_density]);

  // Enforce session timeout
  useEffect(() => {
    if (!preferences?.max_session_hours) return;

    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return;

      const createdAt = new Date(data.session.user.last_sign_in_at || data.session.user.created_at).getTime();
      const maxMs = preferences.max_session_hours * 60 * 60 * 1000;
      const now = Date.now();

      if (now - createdAt > maxMs) {
        signOut();
      }
    };

    checkSession();
    const interval = setInterval(checkSession, 60_000); // check every minute
    return () => clearInterval(interval);
  }, [preferences?.max_session_hours, signOut]);
}
