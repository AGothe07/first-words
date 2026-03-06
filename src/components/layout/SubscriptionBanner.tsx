import { useSubscription } from "@/contexts/SubscriptionContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Clock, XCircle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SubscriptionBanner() {
  const {
    hasValidAccess,
    isTrialActive,
    isTrialExpired,
    isExpired,
    isOverdue,
    isCancelled,
    isReadOnly,
    daysRemaining,
    subscription,
    loading,
  } = useSubscription();
  const { isAdmin } = useUserRole();
  const navigate = useNavigate();

  if (loading || isAdmin) return null;

  // Trial active — show days remaining
  if (isTrialActive && daysRemaining <= 3) {
    return (
      <div className="bg-primary/10 border-b border-primary/20 px-4 py-2 flex items-center justify-between gap-2 text-sm">
        <div className="flex items-center gap-2 text-primary">
          <Clock className="h-4 w-4 flex-shrink-0" />
          <span>
            {daysRemaining <= 1
              ? "Seu teste grátis expira hoje!"
              : `Seu teste grátis expira em ${daysRemaining} dias`}
          </span>
        </div>
        <Button size="sm" variant="default" onClick={() => navigate("/plans")}>
          Assinar agora
        </Button>
      </div>
    );
  }

  // Cancelled but still has access
  if (isCancelled && hasValidAccess) {
    const expiresAt = subscription?.access_expires_at;
    const formattedDate = expiresAt
      ? new Date(expiresAt).toLocaleDateString("pt-BR")
      : "";
    return (
      <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 flex items-center justify-between gap-2 text-sm">
        <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
          <Info className="h-4 w-4 flex-shrink-0" />
          <span>Assinatura cancelada — acesso até {formattedDate}</span>
        </div>
        <Button size="sm" variant="outline" onClick={() => navigate("/plans")}>
          Renovar
        </Button>
      </div>
    );
  }

  // Read-only mode banners
  if (isReadOnly) {
    if (isTrialExpired) {
      return (
        <div className="bg-destructive/10 border-b border-destructive/20 px-4 py-2 flex items-center justify-between gap-2 text-sm">
          <div className="flex items-center gap-2 text-destructive">
            <XCircle className="h-4 w-4 flex-shrink-0" />
            <span>Seu período de teste expirou. Você pode visualizar seus dados, mas não criar ou editar.</span>
          </div>
          <Button size="sm" variant="destructive" onClick={() => navigate("/plans")}>
            Assinar agora
          </Button>
        </div>
      );
    }

    if (isOverdue) {
      return (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 flex items-center justify-between gap-2 text-sm">
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            <span>Pagamento em atraso. Regularize para voltar a criar e editar.</span>
          </div>
          <Button size="sm" variant="default" onClick={() => navigate("/plans")}>
            Renovar agora
          </Button>
        </div>
      );
    }

    // Generic expired
    return (
      <div className="bg-destructive/10 border-b border-destructive/20 px-4 py-2 flex items-center justify-between gap-2 text-sm">
        <div className="flex items-center gap-2 text-destructive">
          <XCircle className="h-4 w-4 flex-shrink-0" />
          <span>Sua assinatura expirou. Você pode visualizar seus dados, mas não criar ou editar.</span>
        </div>
        <Button size="sm" variant="destructive" onClick={() => navigate("/plans")}>
          Renovar agora
        </Button>
      </div>
    );
  }

  return null;
}
