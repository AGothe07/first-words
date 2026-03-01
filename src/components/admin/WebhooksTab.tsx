import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Pencil, RefreshCw } from "lucide-react";

const FUNCTION_KEY_LABELS: Record<string, string> = {
  birthday_notification: "📅 Notificação de Aniversário",
  event_notification: "🔔 Lembrete de Agenda",
  whatsapp_status: "📱 WhatsApp - Verificar Status",
  whatsapp_create: "📱 WhatsApp - Criar Instância",
  whatsapp_connect: "📱 WhatsApp - Conectar (QR Code)",
  whatsapp_disconnect: "📱 WhatsApp - Desconectar",
  whatsapp_code: "🔐 WhatsApp - Envio de Código",
};

interface WebhookConfig {
  id: string;
  url: string;
  description: string | null;
  function_key: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface WebhookLog {
  id: string;
  status_code: number | null;
  response_time_ms: number | null;
  event_type: string;
  called_at: string;
}

export function WebhooksTab() {
  const [configs, setConfigs] = useState<WebhookConfig[]>([]);
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<WebhookConfig | null>(null);
  const [formUrl, setFormUrl] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [cfgRes, logRes] = await Promise.all([
      supabase.from("webhook_configs").select("*").order("function_key", { ascending: true }),
      supabase.from("webhook_logs").select("*").order("called_at", { ascending: false }).limit(50),
    ]);
    setConfigs((cfgRes.data as any[]) || []);
    setLogs((logRes.data as any[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openEdit = (cfg: WebhookConfig) => {
    setEditingConfig(cfg);
    setFormUrl(cfg.url);
    setFormDesc(cfg.description || "");
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!formUrl.trim()) { toast.error("URL é obrigatória"); return; }
    if (!editingConfig) return;
    setSaving(true);
    const { error } = await supabase
      .from("webhook_configs")
      .update({ url: formUrl.trim(), description: formDesc.trim() || null } as any)
      .eq("id", editingConfig.id);
    if (error) toast.error("Erro ao atualizar");
    else toast.success("Webhook atualizado");
    setSaving(false);
    setFormOpen(false);
    fetchData();
  };

  const toggleActive = async (cfg: WebhookConfig) => {
    await supabase.from("webhook_configs").update({ is_active: !cfg.is_active } as any).eq("id", cfg.id);
    fetchData();
  };

  const fmtDt = (d: string) =>
    new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

  if (loading)
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg">URLs dos Webhooks</CardTitle>
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className="h-4 w-4 mr-1" /> Atualizar
          </Button>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-3">
            Edite as URLs dos webhooks usados pelo sistema. Cada função usa uma URL específica.
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Função</TableHead>
                <TableHead>URL</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {configs.map((cfg) => (
                <TableRow key={cfg.id}>
                  <TableCell className="text-sm font-medium whitespace-nowrap">
                    {cfg.function_key ? (FUNCTION_KEY_LABELS[cfg.function_key] || cfg.function_key) : "—"}
                  </TableCell>
                  <TableCell className="text-xs font-mono max-w-[250px] truncate" title={cfg.url}>
                    {cfg.url}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {cfg.description || "—"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={cfg.is_active ? "default" : "secondary"}
                      className="text-[10px] cursor-pointer"
                      onClick={() => toggleActive(cfg)}
                    >
                      {cfg.is_active ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => openEdit(cfg)}>
                      <Pencil className="h-3 w-3 mr-1" /> Editar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {configs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground text-sm py-4">
                    Nenhum webhook configurado
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Histórico de Chamadas</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Status HTTP</TableHead>
                <TableHead>Tempo (ms)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-xs">{fmtDt(log.called_at)}</TableCell>
                  <TableCell className="text-xs">{log.event_type}</TableCell>
                  <TableCell>
                    <Badge
                      variant={log.status_code && log.status_code < 300 ? "default" : "destructive"}
                      className="text-[10px]"
                    >
                      {log.status_code ?? "—"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">{log.response_time_ms ?? "—"}</TableCell>
                </TableRow>
              ))}
              {logs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground text-sm py-4">
                    Nenhuma chamada registrada
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Editar Webhook {editingConfig?.function_key ? `— ${FUNCTION_KEY_LABELS[editingConfig.function_key] || editingConfig.function_key}` : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">URL</Label>
              <Input value={formUrl} onChange={(e) => setFormUrl(e.target.value)} placeholder="https://..." />
            </div>
            <div>
              <Label className="text-xs">Descrição (opcional)</Label>
              <Input value={formDesc} onChange={(e) => setFormDesc(e.target.value)} placeholder="Ex: n8n WhatsApp" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
