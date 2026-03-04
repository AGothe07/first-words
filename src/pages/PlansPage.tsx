import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Check, Loader2, Crown, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export default function PlansPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState<"monthly" | "annual">("monthly");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    cpfCnpj: "",
    mobilePhone: "",
  });
  const [loading, setLoading] = useState(false);

  // Pre-fill form from logged-in user
  useEffect(() => {
    if (!user) return;
    setFormData((prev) => ({
      ...prev,
      email: user.email || prev.email,
      name: user.user_metadata?.display_name || prev.name,
    }));

    supabase
      .from("profiles")
      .select("phone, display_name")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setFormData((prev) => ({
            ...prev,
            name: data.display_name || prev.name,
            mobilePhone: data.phone || prev.mobilePhone,
          }));
        }
      });
  }, [user]);

  const plans = [
    {
      id: "monthly" as const,
      name: "Mensal",
      price: "R$ 20",
      period: "/mês",
      icon: Zap,
      features: [
        "Acesso completo ao sistema",
        "Dashboard financeiro",
        "Gestão de transações",
        "Metas e patrimônio",
        "Agenda integrada",
        "Suporte por email",
      ],
    },
    {
      id: "annual" as const,
      name: "Anual",
      price: "R$ 200",
      period: "/ano",
      icon: Crown,
      badge: "Economia de R$ 40",
      features: [
        "Tudo do plano mensal",
        "Economia de 17%",
        "Prioridade no suporte",
        "Acesso antecipado a novidades",
      ],
    },
  ];

  const handleCheckout = async () => {
    if (!formData.name || !formData.email || !formData.cpfCnpj) {
      toast({ title: "Preencha todos os campos obrigatórios", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("asaas-create-checkout", {
        body: {
          planType: selectedPlan,
          customerData: {
            name: formData.name,
            email: formData.email,
            cpfCnpj: formData.cpfCnpj.replace(/\D/g, ""),
            mobilePhone: formData.mobilePhone?.replace(/\D/g, "") || undefined,
          },
        },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      if (data?.checkoutUrl) {
        window.open(data.checkoutUrl, "_blank");
        navigate("/subscription/success");
      } else {
        toast({ title: "Erro ao gerar link de pagamento", variant: "destructive" });
      }
    } catch (err) {
      toast({
        title: "Erro",
        description: err instanceof Error ? err.message : "Erro ao processar",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="max-w-4xl w-full space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-foreground">Escolha seu plano</h1>
          <p className="text-muted-foreground">
            Comece a organizar suas finanças hoje mesmo
          </p>
        </div>

        {/* Plan cards */}
        <div className="grid md:grid-cols-2 gap-6">
          {plans.map((plan) => (
            <Card
              key={plan.id}
              className={`cursor-pointer transition-all ${
                selectedPlan === plan.id
                  ? "ring-2 ring-primary shadow-lg"
                  : "hover:shadow-md"
              }`}
              onClick={() => setSelectedPlan(plan.id)}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <plan.icon className="h-5 w-5 text-primary" />
                    <CardTitle>{plan.name}</CardTitle>
                  </div>
                  {plan.badge && <Badge variant="secondary">{plan.badge}</Badge>}
                </div>
                <div className="mt-2">
                  <span className="text-3xl font-bold text-foreground">{plan.price}</span>
                  <span className="text-muted-foreground">{plan.period}</span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Checkout form */}
        <Card>
          <CardHeader>
            <CardTitle>Dados para pagamento</CardTitle>
            <CardDescription>
              Preencha seus dados para continuar com o plano{" "}
              {selectedPlan === "monthly" ? "Mensal" : "Anual"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome completo *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Seu nome"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="seu@email.com"
                  disabled={!!user}
                />
                {user && (
                  <p className="text-xs text-muted-foreground">
                    Email vinculado à sua conta. A assinatura será associada automaticamente.
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="cpf">CPF/CNPJ *</Label>
                <Input
                  id="cpf"
                  value={formData.cpfCnpj}
                  onChange={(e) => setFormData({ ...formData, cpfCnpj: e.target.value })}
                  placeholder="000.000.000-00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  value={formData.mobilePhone}
                  onChange={(e) => setFormData({ ...formData, mobilePhone: e.target.value })}
                  placeholder="(00) 00000-0000"
                />
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button onClick={handleCheckout} disabled={loading} className="w-full" size="lg">
              {loading ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Processando...</>
              ) : (
                `Continuar para pagamento — ${selectedPlan === "monthly" ? "R$ 20/mês" : "R$ 200/ano"}`
              )}
            </Button>
            <Button variant="ghost" onClick={() => navigate("/start-trial")} className="w-full">
              Ou comece com 3 dias grátis
            </Button>
          </CardFooter>
        </Card>

        <div className="text-center">
          <Button variant="link" onClick={() => navigate("/auth")}>
            Já tem uma conta? Faça login
          </Button>
        </div>
      </div>
    </div>
  );
}
