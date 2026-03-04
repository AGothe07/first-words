import { useSubscription } from "@/contexts/SubscriptionContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";

const PUBLIC_SUBSCRIPTION_ROUTES = [
  "/subscription/blocked",
  "/subscription/success",
  "/subscription/cancel",
  "/subscription/expired",
  "/subscription/manage",
  "/plans",
  "/start-trial",
  "/settings",
  "/auth",
];

export function SubscriptionGuard({ children }: { children: React.ReactNode }) {
  const { hasValidAccess, loading, isTrialExpired, hasNoSubscription } = useSubscription();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const location = useLocation();

  if (loading || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Admin always has access
  if (isAdmin) return <>{children}</>;

  // Public subscription routes
  if (PUBLIC_SUBSCRIPTION_ROUTES.some((r) => location.pathname.startsWith(r))) {
    return <>{children}</>;
  }

  // No access
  if (!hasValidAccess) {
    // New user with no subscription → redirect to start trial
    if (hasNoSubscription) {
      return <Navigate to="/start-trial" replace />;
    }
    // Expired trial or subscription → blocked page
    return <Navigate to="/subscription/blocked" replace />;
  }

  return <>{children}</>;
}
