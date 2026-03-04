import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { CreditCard, Calendar, Clock, Loader2, RefreshCw, ShieldCheck, AlertTriangle } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";

export default function SubscriptionManagePage() {
  const {
    subscription,
    payments,
    isActive,
    isTrialActive,
    isTrialExpired,
    isExpired,
    isCancelled,
    daysRemaining,
    cancelSubscription,
  } = useSubscription();
  const navigate = useNavigate();
  const [cancelling, setCancelling] = useState(false);

  const handleCancel = async () => {
    setCancelling(true);
    const { error } = await cancelSubscription();
    if (error) {
      toast({ title: "Erro ao cancelar", description: error, variant: "destructive" });
    } else {
      toast({ title: "Assinatura cancelada", description: "Seu acesso continua até o fim do período pago." });
    }
    setCancelling(false);
  };

  const getStatusInfo = () => {
    if (isTrialActive) return { label: "Trial ativo", variant: "secondary" as const, icon: Clock, color: "text-blue-500" };
    if (isTrialExpired) return { label: "Trial expirado", variant: "destructive" as const, icon: AlertTriangle, color: "text-destructive" };
    if (isActive && isCancelled) return { label: "Cancelada", variant: "outline" as const, icon: AlertTriangle, color: "text-warning" };
    if (isActive) return { label: "Ativa", variant: "default" as const, icon: ShieldCheck, color: "text-primary" };
    if (isExpired) return { label: "Expirada", variant: "destructive" as const, icon: AlertTriangle, color: "text-destructive" };
    return { label: "Inativa", variant: "destructive" as const, icon: AlertTriangle, color: "text-destructive" };
  };

  const getPlanLabel = (planType: string) => {
    return planType === "annual" ? "Plano Anual" : "Plano Mensal";
  };

  const getExpirationDate = () => {
    const date = subscription?.access_expires_at || subscription?.trial_ends_at;
    if (!date) return "—";
    return new Date(date).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };

  const needsRenewal = isTrialExpired || isExpired || isCancelled || (!isActive && !isTrialActive) || isTrialActive;

  if (!subscription) {
    return (
      <AppLayout>
        <div className="max-w-2xl mx-auto p-6 space-y-6">
          <Card className="text-center">
            <CardHeader>
              <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
              <CardTitle>Nenhuma assinatura</CardTitle>
              <CardDescription>Você ainda não possui uma assinatura ativa.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button onClick={() => navigate("/start-trial")} className="w-full" size="lg">
                Ativar 3 dias grátis
              </Button>
              <Button variant="outline" onClick={() => navigate("/plans")} className="w-full">
                Ver planos
              </Button>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  const statusInfo = getStatusInfo();
  const StatusIcon = statusInfo.icon;

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        <h1 className="text-2xl font-bold">Minha Assinatura</h1>

        {/* Status card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <StatusIcon className={`h-5 w-5 ${statusInfo.color}`} />
                {getPlanLabel(subscription.plan_type)}
              </CardTitle>
              <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground mb-1">Tipo do plano</p>
                <p className="text-lg font-semibold">{getPlanLabel(subscription.plan_type)}</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground mb-1">Valor</p>
                <p className="text-lg font-semibold">
                  {Number(subscription.value) > 0
                    ? `R$ ${Number(subscription.value).toFixed(2)}`
                    : "Gratuito (trial)"}
                </p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Vencimento
                </p>
                <p className="text-lg font-semibold">{getExpirationDate()}</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Dias restantes
                </p>
                <p className={`text-lg font-semibold ${daysRemaining <= 3 ? "text-destructive" : ""}`}>
                  {daysRemaining} {daysRemaining === 1 ? "dia" : "dias"}
                </p>
              </div>
            </div>

            {/* Renew / Subscribe button */}
            {needsRenewal && (
              <Button onClick={() => navigate("/plans")} className="w-full" size="lg">
                <RefreshCw className="h-4 w-4 mr-2" />
                {isTrialActive ? "Assinar um plano" : "Renovar assinatura"}
              </Button>
            )}

            {/* Cancel button */}
            {!isCancelled && !isTrialActive && isActive && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="w-full">
                    Cancelar assinatura
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cancelar assinatura?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Seu acesso continuará até o fim do período pago ({daysRemaining} dias restantes).
                      Você pode reativar a qualquer momento assinando novamente.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Manter assinatura</AlertDialogCancel>
                    <AlertDialogAction onClick={handleCancel} disabled={cancelling}>
                      {cancelling ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Confirmar cancelamento
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </CardContent>
        </Card>

        {/* Payment history */}
        {payments.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Histórico de pagamentos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {payments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div>
                      <p className="text-sm font-medium">R$ {Number(p.amount).toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.billing_type || "—"} • {p.due_date ? new Date(p.due_date).toLocaleDateString("pt-BR") : "—"}
                      </p>
                    </div>
                    <Badge variant={p.status === "confirmed" || p.status === "received" ? "default" : "outline"}>
                      {p.status === "confirmed" || p.status === "received" ? "Pago" : p.status === "pending" ? "Pendente" : p.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
