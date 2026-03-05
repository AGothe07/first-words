import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Save, Eye, EyeOff, Key, Smartphone } from "lucide-react";

interface AdminSetting {
  id: string;
  setting_key: string;
  setting_value: string;
  description: string | null;
  updated_at: string;
}

export function AdminSettingsTab() {
  const [settings, setSettings] = useState<AdminSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [visible, setVisible] = useState<Record<string, boolean>>({});

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("admin_settings")
      .select("*")
      .order("setting_key");
    if (error) {
      toast.error("Erro ao carregar configurações");
    } else if (data) {
      setSettings(data as AdminSetting[]);
      const vals: Record<string, string> = {};
      data.forEach((s: AdminSetting) => {
        vals[s.setting_key] = s.setting_value;
      });
      setValues(vals);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = async (key: string) => {
    setSaving(key);
    const { error } = await supabase
      .from("admin_settings")
      .update({
        setting_value: values[key] || "",
        updated_at: new Date().toISOString(),
      })
      .eq("setting_key", key);
    if (error) {
      toast.error("Erro ao salvar configuração");
    } else {
      toast.success("Configuração salva com sucesso");
      fetchSettings();
    }
    setSaving(null);
  };

  const settingMeta: Record<string, { icon: typeof Key; title: string; hint: string }> = {
    api_key_admin: {
      icon: Key,
      title: "API Key Admin",
      hint: "Utilizada para criar, deletar e gerenciar instâncias WhatsApp dos usuários. Enviada automaticamente nas requisições administrativas.",
    },
    instance_token_system: {
      icon: Smartphone,
      title: "Token da Instância do Sistema",
      hint: "Utilizado para envios automáticos do sistema: mensagens da IA, verificação de número, notificações internas. Não substitui a instância pessoal do usuário.",
    },
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {settings.map((s) => {
        const meta = settingMeta[s.setting_key] || {
          icon: Key,
          title: s.setting_key,
          hint: s.description || "",
        };
        const Icon = meta.icon;
        const isVisible = visible[s.setting_key] || false;
        const currentValue = values[s.setting_key] ?? "";
        const hasChanged = currentValue !== s.setting_value;

        return (
          <Card key={s.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Icon className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">{meta.title}</CardTitle>
              </div>
              <CardDescription className="text-xs">{meta.hint}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 items-end">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs text-muted-foreground">
                    Valor atual
                    {s.setting_value ? "" : " (não configurado)"}
                  </Label>
                  <div className="relative">
                    <Input
                      type={isVisible ? "text" : "password"}
                      value={currentValue}
                      onChange={(e) =>
                        setValues((prev) => ({ ...prev, [s.setting_key]: e.target.value }))
                      }
                      placeholder="Cole o valor aqui..."
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                      onClick={() =>
                        setVisible((prev) => ({ ...prev, [s.setting_key]: !isVisible }))
                      }
                    >
                      {isVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <Button
                  onClick={() => handleSave(s.setting_key)}
                  disabled={saving === s.setting_key || !hasChanged}
                  size="sm"
                >
                  {saving === s.setting_key ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <Save className="h-4 w-4 mr-1" />
                  )}
                  Salvar
                </Button>
              </div>
              {s.updated_at && s.setting_value && (
                <p className="text-[10px] text-muted-foreground mt-2">
                  Última atualização: {new Date(s.updated_at).toLocaleString("pt-BR")}
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
