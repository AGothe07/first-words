import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, ArrowLeft, Mail } from "lucide-react";
import { Link } from "react-router-dom";

const SITE_URL = "https://financial.lendscope.com.br";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error("Informe seu e-mail");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${SITE_URL}/redefinir-senha`,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      setSent(true);
      toast.success("E-mail de recuperação enviado!");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-border shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-primary">🔑 Recuperar Senha</CardTitle>
          <CardDescription>
            {sent
              ? "Verifique sua caixa de entrada"
              : "Informe seu e-mail para receber o link de recuperação"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="space-y-4 text-center">
              <div className="flex justify-center">
                <Mail className="h-12 w-12 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground">
                Enviamos um link de recuperação para <strong>{email}</strong>.
                Verifique também a pasta de spam.
              </p>
              <Button variant="outline" className="w-full" onClick={() => setSent(false)}>
                Enviar novamente
              </Button>
              <Link to="/auth" className="block">
                <Button variant="ghost" className="w-full">
                  <ArrowLeft className="h-4 w-4 mr-2" /> Voltar ao login
                </Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label className="text-xs">E-mail</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  autoFocus
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Enviar link de recuperação
              </Button>
              <Link to="/auth" className="block">
                <Button variant="ghost" className="w-full" type="button">
                  <ArrowLeft className="h-4 w-4 mr-2" /> Voltar ao login
                </Button>
              </Link>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
