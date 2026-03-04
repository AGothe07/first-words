import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Loader2, Gift } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/contexts/SubscriptionContext";

export default function StartTrialPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { refreshSubscription, hasValidAccess, loading: subLoading, subscription } = useSubscription();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Redirect if user already has valid access or active trial
  useEffect(() => {
    if (!subLoading && user) {
      if (hasValidAccess || subscription?.trial_used) {
        navigate("/", { replace: true });
        return;
      }
    }
  }, [user, hasValidAccess, subLoading, navigate, subscription]);

  // Pre-fill form if user is already logged in
  useEffect(() => {
    if (user) {
      setFormData((prev) => ({
        ...prev,
        email: user.email || "",
        name: user.user_metadata?.display_name || "",
      }));
    }
  }, [user]);

  const handleStartTrialLoggedIn = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const displayName = user.user_metadata?.display_name || user.email?.split("@")[0] || "Usuário";
      const { data, error } = await supabase.functions.invoke("start-trial", {
        body: {
          name: displayName,
          email: user.email,
          password: "existing-user", // won't create new user since they already exist
        },
      });

      const errorMessage = data?.error || error?.message;
      if (errorMessage) throw new Error(errorMessage);

      setSuccess(true);
      toast({ title: "Teste grátis ativado!" });
      await refreshSubscription();
      setTimeout(() => navigate("/"), 1500);
    } catch (err) {
      toast({
        title: "Erro",
        description: err instanceof Error ? err.message : "Erro ao ativar teste",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStartTrial = async () => {
    // If user is already logged in, use simplified flow
    if (user) {
      return handleStartTrialLoggedIn();
    }

    if (!formData.name || !formData.email || !formData.password) {
      toast({ title: "Preencha todos os campos", variant: "destructive" });
      return;
    }

    if (formData.password.length < 6) {
      toast({ title: "A senha deve ter pelo menos 6 caracteres", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("start-trial", {
        body: formData,
      });

      // Edge function errors: check both error object and data.error
      const errorMessage = data?.error || error?.message;
      if (errorMessage) throw new Error(errorMessage);

      setSuccess(true);
      toast({ title: "Conta criada com sucesso!" });

      // Auto login
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });

      if (!loginError) {
        setTimeout(() => navigate("/"), 1500);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Erro ao criar conta";
      const isTrialUsed = errorMsg.includes("já utilizou");
      toast({
        title: isTrialUsed ? "Teste já utilizado" : "Erro",
        description: isTrialUsed
          ? "Este email já utilizou o período de teste. Faça login ou assine um plano."
          : errorMsg,
        variant: "destructive",
      });
      if (isTrialUsed) {
        // Don't leave blank screen - no state change needed, user can navigate
      }
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <CardHeader>
            <Gift className="h-12 w-12 text-primary mx-auto mb-2" />
            <CardTitle>{user ? "Teste grátis ativado!" : "Conta criada com sucesso!"}</CardTitle>
            <CardDescription>
              Você tem 3 dias grátis para explorar todas as funcionalidades. Redirecionando...
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Logged-in user without subscription - simplified UI
  if (user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <Gift className="h-10 w-10 text-primary mx-auto mb-2" />
            <CardTitle>Ative seu teste grátis</CardTitle>
            <CardDescription>
              Você ainda não possui uma assinatura. Ative agora 3 dias grátis para explorar todas as funcionalidades!
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex flex-col gap-3">
            <Button onClick={handleStartTrial} disabled={loading} className="w-full" size="lg">
              {loading ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Ativando...</>
              ) : (
                "Ativar 3 dias grátis"
              )}
            </Button>
            <Button variant="outline" onClick={() => navigate("/plans")} className="w-full">
              Ver planos pagos
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Not logged in - full signup form
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <Gift className="h-10 w-10 text-primary mx-auto mb-2" />
          <CardTitle>3 dias grátis</CardTitle>
          <CardDescription>
            Teste todas as funcionalidades sem compromisso. Sem cartão de crédito.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome completo</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Seu nome"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="seu@email.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder="Mínimo 6 caracteres"
            />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button onClick={handleStartTrial} disabled={loading} className="w-full" size="lg">
            {loading ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Criando conta...</>
            ) : (
              "Começar teste grátis"
            )}
          </Button>
          <div className="flex gap-2 w-full">
            <Button variant="ghost" onClick={() => navigate("/plans")} className="flex-1">
              Ver planos
            </Button>
            <Button variant="ghost" onClick={() => navigate("/auth")} className="flex-1">
              Já tenho conta
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
