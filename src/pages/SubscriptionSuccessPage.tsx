import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useNavigate } from "react-router-dom";
import { Loader2, CheckCircle, Clock } from "lucide-react";

export default function SubscriptionSuccessPage() {
  const { isActive, refreshSubscription } = useSubscription();
  const navigate = useNavigate();
  const [attempts, setAttempts] = useState(0);
  const maxAttempts = 10;

  useEffect(() => {
    if (isActive) {
      setTimeout(() => navigate("/"), 3000);
      return;
    }

    if (attempts >= maxAttempts) return;

    const timer = setTimeout(async () => {
      await refreshSubscription();
      setAttempts((a) => a + 1);
    }, 3000);

    return () => clearTimeout(timer);
  }, [isActive, attempts, refreshSubscription, navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full text-center">
        <CardHeader>
          {isActive ? (
            <>
              <CheckCircle className="h-12 w-12 text-primary mx-auto mb-2" />
              <CardTitle>Pagamento confirmado!</CardTitle>
              <CardDescription>
                Sua assinatura está ativa. Redirecionando para o dashboard...
              </CardDescription>
            </>
          ) : attempts >= maxAttempts ? (
            <>
              <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
              <CardTitle>Pagamento pendente</CardTitle>
              <CardDescription>
                Seu pagamento ainda não foi confirmado. Assim que for processado, você receberá um email com acesso ao sistema.
              </CardDescription>
            </>
          ) : (
            <>
              <Loader2 className="h-12 w-12 text-primary mx-auto mb-2 animate-spin" />
              <CardTitle>Verificando pagamento...</CardTitle>
              <CardDescription>
                Aguarde enquanto confirmamos seu pagamento. Tentativa {attempts + 1}/{maxAttempts}
              </CardDescription>
            </>
          )}
        </CardHeader>
        <CardContent>
          {!isActive && attempts >= maxAttempts && (
            <div className="space-y-3">
              <Button onClick={() => { setAttempts(0); refreshSubscription(); }} className="w-full">
                Verificar novamente
              </Button>
              <Button variant="outline" onClick={() => navigate("/auth")} className="w-full">
                Ir para login
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
