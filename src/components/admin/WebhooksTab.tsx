import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Plus, Pencil, Trash2, RefreshCw } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface WebhookConfig {
  id: string;
  url: string;
  description: string | null;
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
  const { user } = useAuth();
  const [configs, setConfigs] = useState<WebhookConfig[]>([]);
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingConfig, setEditingConfig] = useState<WebhookConfig | null>(null);
  const [formUrl, setFormUrl] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [cfgRes, logRes] = await Promise.all([
      supabase
        .from("webhook_configs")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("webhook_logs")
        .select("*")
        .order("called_at", { ascending: false })
        .limit(50),
    ]);
    setConfigs((cfgRes.data as any[]) || []);
    setLogs((logRes.data as any[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openCreate = () => {
    setEditingConfig(null);
    setFormUrl("");
    setFormDesc("");
    setFormOpen(true);
  };

  const openEdit = (cfg: WebhookConfig) => {
    setEditingConfig(cfg);
    setFormUrl(cfg.url);
    setFormDesc(cfg.description || "");
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!formUrl.trim()) {
      toast.error("URL é obrigatória");
      return;
    }
    setSaving(true);
    if (editingConfig) {
      const { error } = await supabase
        .from("webhook_configs")
        .update({ url: formUrl.trim(), description: formDesc.trim() || null } as any)
        .eq("id", editingConfig.id);
      if (error) toast.error("Erro ao atualizar");
      else toast.success("Webhook atualizado");
    } else {
      const { error } = await supabase.from("webhook_configs").insert({
        url: formUrl.trim(),
        description: formDesc.trim() || null,
        created_by: user!.id,
      } as any);
      if (error) toast.error("Erro ao criar");
      else toast.success("Webhook criado");
    }
    setSaving(false);
    setFormOpen(false);
    fetchData();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase
      .from("webhook_configs")
      .delete()
      .eq("id", deleteId);
    if (error) toast.error("Erro ao excluir");
    else toast.success("Webhook excluído");
    setDeleteId(null);
    fetchData();
  };

  const toggleActive = async (cfg: WebhookConfig) => {
    await supabase
      .from("webhook_configs")
      .update({ is_active: !cfg.is_active } as any)
      .eq("id", cfg.id);
    fetchData();
  };

  const fmtDt = (d: string) =>
    new Date(d).toLocaleString("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    });

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
          <CardTitle className="text-lg">Configurações de Webhook</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw className="h-4 w-4 mr-1" /> Atualizar
            </Button>
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4 mr-1" /> Novo Webhook
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>URL</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Atualizado</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {configs.map((cfg) => (
                <TableRow key={cfg.id}>
                  <TableCell className="text-xs font-mono max-w-[200px] truncate">
                    {cfg.url}
                  </TableCell>
                  <TableCell className="text-sm">
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
                  <TableCell className="text-xs">
                    {fmtDt(cfg.updated_at)}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-[10px]"
                        onClick={() => openEdit(cfg)}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="h-7 text-[10px]"
                        onClick={() => setDeleteId(cfg.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
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
                      variant={
                        log.status_code && log.status_code < 300
                          ? "default"
                          : "destructive"
                      }
                      className="text-[10px]"
                    >
                      {log.status_code ?? "—"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">
                    {log.response_time_ms ?? "—"}
                  </TableCell>
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
              {editingConfig ? "Editar Webhook" : "Novo Webhook"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">URL</Label>
              <Input
                value={formUrl}
                onChange={(e) => setFormUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>
            <div>
              <Label className="text-xs">Descrição (opcional)</Label>
              <Input
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
                placeholder="Ex: n8n WhatsApp"
              />
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

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Webhook</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza? Logs associados perderão a referência.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
