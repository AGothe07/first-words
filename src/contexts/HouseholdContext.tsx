import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface HouseholdMember {
  id: string;
  household_id: string;
  user_id: string;
  role: string;
  status: string;
  permissions: Record<string, boolean>;
  monthly_limit: number | null;
}

interface Household {
  id: string;
  name: string;
  owner_user_id: string;
  extra_member_price: number;
}

interface HouseholdContextType {
  household: Household | null;
  members: HouseholdMember[];
  myRole: string | null;
  isOwner: boolean;
  loading: boolean;
  refetch: () => void;
}

const HouseholdContext = createContext<HouseholdContextType>({
  household: null,
  members: [],
  myRole: null,
  isOwner: false,
  loading: true,
  refetch: () => {},
});

export function HouseholdProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [household, setHousehold] = useState<Household | null>(null);
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [myRole, setMyRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchHousehold = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);

    // Check as owner first
    const { data: owned } = await supabase
      .from("households" as any)
      .select("*")
      .eq("owner_user_id", user.id)
      .limit(1);

    let hh = (owned as any[])?.[0] || null;

    if (!hh) {
      // Check as member
      const { data: memberOf } = await supabase
        .from("household_members" as any)
        .select("household_id, role")
        .eq("user_id", user.id)
        .eq("status", "active")
        .limit(1);

      if (memberOf && (memberOf as any[]).length > 0) {
        const { data: hhData } = await supabase
          .from("households" as any)
          .select("*")
          .eq("id", (memberOf as any[])[0].household_id)
          .limit(1);
        hh = (hhData as any[])?.[0] || null;
      }
    }

    if (hh) {
      setHousehold(hh);
      const { data: mems } = await supabase
        .from("household_members" as any)
        .select("*")
        .eq("household_id", hh.id)
        .eq("status", "active");
      setMembers((mems as any[]) || []);

      const me = (mems as any[])?.find((m: any) => m.user_id === user.id);
      setMyRole(me?.role || (hh.owner_user_id === user.id ? "owner" : null));
    } else {
      setHousehold(null);
      setMembers([]);
      setMyRole(null);
    }

    setLoading(false);
  }, [user]);

  useEffect(() => { fetchHousehold(); }, [fetchHousehold]);

  return (
    <HouseholdContext.Provider value={{
      household,
      members,
      myRole,
      isOwner: household?.owner_user_id === user?.id,
      loading,
      refetch: fetchHousehold,
    }}>
      {children}
    </HouseholdContext.Provider>
  );
}

export const useHousehold = () => useContext(HouseholdContext);
