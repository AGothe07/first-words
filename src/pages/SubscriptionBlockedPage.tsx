import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { ShieldX, RefreshCw, LogOut } from "lucide-react";

export default function SubscriptionBlockedPage() {
  const { subscription, isTrialExpired, isExpired, refreshSubscription } = useSubscription();
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const getMessage = () => {
    if (isTrialExpired) {
      return {
        title: "Período de teste encerrado",
        description: "Seu período de teste de 3 dias expirou. Assine um plano para continuar usando o sistema.",
      };
    }
    if (isExpired) {
      return {
        title: "Assinatura expirada",
        description: "Sua assinatura expirou. Renove para continuar tendo acesso.",
      };
    }
    if (subscription?.status === "overdue") {
      return {
        title: "Pagamento em atraso",
        description: "Existe um pagamento pendente na sua assinatura. Regularize para restabelecer seu acesso.",
      };
    }
    return {
      title: "Acesso bloqueado",
      description: "Você não possui uma assinatura ativa. Assine um plano para ter acesso ao sistema.",
    };
  };

  const msg = getMessage();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full text-center">
        <CardHeader>
          <ShieldX className="h-12 w-12 text-destructive mx-auto mb-2" />
          <CardTitle>{msg.title}</CardTitle>
          <CardDescription>{msg.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button onClick={() => navigate("/plans")} className="w-full" size="lg">
            Ver planos
          </Button>
          <Button
            variant="outline"
            onClick={refreshSubscription}
            className="w-full"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Verificar status
          </Button>
          <Button variant="ghost" onClick={async () => {
            await signOut();
            navigate("/auth");
          }} className="w-full">
            <LogOut className="h-4 w-4 mr-2" />
            Sair da conta
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
