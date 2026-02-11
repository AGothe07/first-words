import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Bot, CheckCircle, AlertTriangle, Phone } from "lucide-react";

type Step = "idle" | "phone-input" | "sending" | "waiting-code" | "validating" | "done";

export default function AISettingsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [aiEnabled, setAiEnabled] = useState(false);
  
  const [savedPhone, setSavedPhone] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("idle");
  const [phone, setPhone] = useState("");
  const [challenge, setChallenge] = useState("");
  const [code, setCode] = useState("");
  

  useEffect(() => {
    if (!user) return;
    supabase.functions
      .invoke("enable-ai", { body: { action: "status" } })
      .then(({ data }) => {
        setAiEnabled(data?.ai_enabled || false);
        
        setSavedPhone(data?.phone || null);
        setLoading(false);
      });
  }, [user]);

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, "");
    // Format: +55 (XX) XXXXX-XXXX
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return `${digits.slice(0, 2)} (${digits.slice(2)}`;
    if (digits.length <= 9) return `${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4)}`;
    return `${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9, 13)}`;
  };

  const handlePhoneChange = (value: string) => {
    const digits = value.replace(/\D/g, "");
    if (digits.length <= 13) {
      setPhone(digits);
    }
  };

  const isPhoneValid = () => {
    // Brazilian phone: 55 + 2 digit DDD + 9 digit number = 13 digits
    return phone.length >= 12 && phone.length <= 13 && phone.startsWith("55");
  };

  const handleStartFlow = () => {
    setPhone("55");
    setStep("phone-input");
  };

  const handleGenerateCode = async () => {
    if (!isPhoneValid()) {
      toast.error("Número de telefone inválido. Use o formato brasileiro: 55 + DDD + número");
      return;
    }
    setStep("sending");
    const { data, error } = await supabase.functions.invoke("enable-ai", {
      body: { action: "generate-code", phone },
    });
    if (error || data?.error) {
      toast.error(data?.error || "Erro ao gerar código");
      setStep("phone-input");
      return;
    }
    setChallenge(data.challenge);
    setStep("waiting-code");
    toast.success("Código enviado via WhatsApp!");
  };

  const handleValidateCode = async () => {
    if (!code.trim()) {
      toast.error("Digite o código recebido");
      return;
    }
    setStep("validating");
    const { data, error } = await supabase.functions.invoke("enable-ai", {
      body: { action: "validate-code", code: code.trim(), challenge, phone },
    });
    if (error || data?.error) {
      toast.error(data?.error || "Erro ao validar código");
      setStep("waiting-code");
      return;
    }
    setAiEnabled(true);
    
    setSavedPhone(phone);
    setStep("done");
    toast.success("IA habilitada com sucesso!");
  };



  if (loading)
    return (
      <AppLayout>
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );

  return (
    <AppLayout>
      <div className="flex items-center gap-2 mb-6">
        <Bot className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">IA Conversacional</h1>
      </div>

      <div className="max-w-lg space-y-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-sm">IA Conversacional:</span>
              <Badge variant={aiEnabled ? "default" : "secondary"}>
                {aiEnabled ? "Habilitada" : "Desabilitada"}
              </Badge>
            </div>


            {savedPhone && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Telefone: +{formatPhone(savedPhone)}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-xs"
                  onClick={() => {
                    setPhone(savedPhone);
                    setStep("phone-input");
                    setCode("");
                    setChallenge("");
                  }}
                >
                  Alterar
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {!aiEnabled && step === "idle" && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Habilitar IA</CardTitle>
              <CardDescription>
                Informe seu número de celular para receber um código de verificação via WhatsApp.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={handleStartFlow}>
                <Bot className="h-4 w-4 mr-2" /> Iniciar Verificação
              </Button>
            </CardContent>
          </Card>
        )}

        {step === "phone-input" && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Phone className="h-5 w-5 text-primary" />
                Número de Celular
              </CardTitle>
              <CardDescription>
                Digite seu número de celular brasileiro com DDD. O código do país (55) já está preenchido.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground font-mono">+</span>
                  <Input
                    id="phone"
                    value={formatPhone(phone)}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    placeholder="55 (11) 99999-9999"
                    className="font-mono text-base"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Formato: +55 (DDD) XXXXX-XXXX
                </p>
              </div>
              <Button onClick={handleGenerateCode} disabled={!isPhoneValid()}>
                Enviar Código via WhatsApp
              </Button>
            </CardContent>
          </Card>
        )}

        {step === "sending" && (
          <Card>
            <CardContent className="flex items-center gap-2 py-6">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="text-sm">Enviando código via WhatsApp...</span>
            </CardContent>
          </Card>
        )}

        {step === "waiting-code" && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
                Código Enviado
              </CardTitle>
              <CardDescription>
                Digite abaixo o código de 6 caracteres recebido via WhatsApp. O
                código expira em 5 minutos.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.slice(0, 6))}
                placeholder="Ex: aB3xY9"
                maxLength={6}
                className="text-center text-lg tracking-widest font-mono"
              />
              <div className="flex gap-2">
                <Button onClick={handleValidateCode} disabled={!code.trim()}>
                  Validar Código
                </Button>
                <Button variant="outline" onClick={() => setStep("phone-input")}>
                  Alterar Número
                </Button>
                <Button variant="outline" onClick={handleGenerateCode}>
                  Reenviar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === "validating" && (
          <Card>
            <CardContent className="flex items-center gap-2 py-6">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="text-sm">Validando código...</span>
            </CardContent>
          </Card>
        )}

        {step === "done" && (
          <Card className="border-primary/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2 text-primary">
                <CheckCircle className="h-5 w-5" />
                IA Habilitada com Sucesso!
              </CardTitle>
              <CardDescription>
                Sua IA conversacional está pronta para uso.
              </CardDescription>
            </CardHeader>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
