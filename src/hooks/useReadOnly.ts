import { useSubscription } from "@/contexts/SubscriptionContext";
import { useUserRole } from "@/hooks/useUserRole";

/**
 * Hook to check if the current user is in read-only mode.
 * When read-only, the user can view all data but cannot create, edit, or delete.
 */
export function useReadOnly() {
  const { isReadOnly, loading } = useSubscription();
  const { isAdmin } = useUserRole();

  // Admin is never read-only
  if (isAdmin) return { isReadOnly: false, loading };

  return { isReadOnly, loading };
}
