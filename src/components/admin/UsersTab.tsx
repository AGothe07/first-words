import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Loader2,
  Ban,
  CheckCircle,
  Trash2,
  RefreshCw,
  ShieldOff,
  PhoneOff,
  UserPlus,
  CalendarPlus,
  CalendarMinus,
  Smartphone,
} from "lucide-react";

interface AdminUser {
  id: string;
  email: string;
  created_at: string;
  email_confirmed_at: string | null;
  last_sign_in_at: string | null;
  banned_until: string | null;
  display_name: string | null;
  ai_enabled: boolean;
  phone: string | null;
  last_activity: string | null;
  roles: string[];
  subscription_status: string | null;
  manual_access_expires_at: string | null;
  access_expires_at: string | null;
  trial_ends_at: string | null;
  has_whatsapp_instance: boolean;
  whatsapp_instance_name: string | null;
  whatsapp_status: string | null;
}

export function UsersTab() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{
    open: boolean;
    action: string;
    userId: string;
    label: string;
  }>({ open: false, action: "", userId: "", label: "" });

  // Create user dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  // Grant access dialog
  const [grantOpen, setGrantOpen] = useState(false);
  const [grantUserId, setGrantUserId] = useState("");
  const [grantDays, setGrantDays] = useState("30");
  const [granting, setGranting] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("admin-users", {
      body: { action: "list" },
    });
    if (error) toast.error("Erro ao carregar usuários");
    else setUsers(data?.users || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const executeAction = async (action: string, userId: string, extra?: Record<string, unknown>) => {
    setActionLoading(userId);
    const { data, error } = await supabase.functions.invoke("admin-users", {
      body: { action, userId, ...extra },
    });
    if (error || data?.error) {
      toast.error(data?.error || "Erro ao executar ação");
    } else {
      toast.success("Ação executada com sucesso");
      fetchUsers();
    }
    setActionLoading(null);
    setDialog({ open: false, action: "", userId: "", label: "" });
  };

  const confirmAction = (action: string, userId: string, label: string) => {
    setDialog({ open: true, action, userId, label });
  };

  const handleCreateUser = async () => {
    if (!newEmail || !newPassword) {
      toast.error("Preencha email e senha");
      return;
    }
    setCreating(true);
    const { data, error } = await supabase.functions.invoke("admin-users", {
      body: { action: "create-user", email: newEmail, password: newPassword, displayName: newName },
    });
    if (error || data?.error) {
      toast.error(data?.error || "Erro ao criar usuário");
    } else {
      toast.success("Usuário criado com sucesso");
      setCreateOpen(false);
      setNewEmail("");
      setNewPassword("");
      setNewName("");
      fetchUsers();
    }
    setCreating(false);
  };

  const handleGrantAccess = async () => {
    const days = parseInt(grantDays);
    if (!days || days < 1) {
      toast.error("Informe uma quantidade válida de dias");
      return;
    }
    setGranting(true);
    const { data, error } = await supabase.functions.invoke("admin-users", {
      body: { action: "grant-access", userId: grantUserId, days },
    });
    if (error || data?.error) {
      toast.error(data?.error || "Erro ao conceder acesso");
    } else {
      toast.success(`${days} dias de acesso concedidos`);
      setGrantOpen(false);
      fetchUsers();
    }
    setGranting(false);
  };

  const fmt = (d: string | null) =>
    d ? new Date(d).toLocaleDateString("pt-BR") : "—";
  const fmtDt = (d: string | null) =>
    d
      ? new Date(d).toLocaleString("pt-BR", {
          dateStyle: "short",
          timeStyle: "short",
        })
      : "—";

  const isBanned = (u: AdminUser) =>
    u.banned_until && new Date(u.banned_until) > new Date();

  const getAccessInfo = (u: AdminUser) => {
    if (u.roles.includes("admin")) return { label: "Admin", variant: "default" as const };
    const manual = u.manual_access_expires_at;
    const access = u.access_expires_at;
    const trial = u.trial_ends_at;
    const expiresAt = manual && new Date(manual) > new Date() ? manual
      : access && new Date(access) > new Date() ? access
      : trial && new Date(trial) > new Date() ? trial
      : null;
    if (expiresAt) {
      const days = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      return { label: `${days}d restantes`, variant: days <= 3 ? "destructive" as const : "default" as const };
    }
    return { label: "Sem acesso", variant: "secondary" as const };
  };

  if (loading)
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg">
            Usuários Cadastrados ({users.length})
          </CardTitle>
          <div className="flex gap-2">
            <Button variant="default" size="sm" onClick={() => setCreateOpen(true)}>
              <UserPlus className="h-4 w-4 mr-1" /> Criar Usuário
            </Button>
            <Button variant="outline" size="sm" onClick={fetchUsers}>
              <RefreshCw className="h-4 w-4 mr-1" /> Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead>Acesso</TableHead>
                <TableHead>IA</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => {
                const accessInfo = getAccessInfo(u);
                return (
                  <TableRow key={u.id}>
                    <TableCell className="text-xs font-mono">{u.email}</TableCell>
                    <TableCell className="text-sm">
                      {u.display_name || "—"}
                    </TableCell>
                    <TableCell className="text-xs">{fmt(u.created_at)}</TableCell>
                    <TableCell>
                      <Badge variant={accessInfo.variant} className="text-[10px]">
                        {accessInfo.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={u.ai_enabled ? "default" : "secondary"}
                        className="text-[10px]"
                      >
                        {u.ai_enabled ? "Ativa" : "Inativa"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {isBanned(u) ? (
                        <Badge variant="destructive" className="text-[10px]">
                          Bloqueado
                        </Badge>
                      ) : (
                        <Badge variant="default" className="text-[10px]">
                          Ativo
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {/* Grant / Revoke access */}
                        {!u.roles.includes("admin") && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-[10px]"
                              disabled={actionLoading === u.id}
                              onClick={() => {
                                setGrantUserId(u.id);
                                setGrantDays("30");
                                setGrantOpen(true);
                              }}
                            >
                              <CalendarPlus className="h-3 w-3 mr-1" /> Dar Dias
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-[10px]"
                              disabled={actionLoading === u.id}
                              onClick={() =>
                                confirmAction("revoke-access", u.id, "Revogar acesso manual")
                              }
                            >
                              <CalendarMinus className="h-3 w-3 mr-1" /> Revogar
                            </Button>
                          </>
                        )}

                        {isBanned(u) ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-[10px]"
                            disabled={actionLoading === u.id}
                            onClick={() =>
                              confirmAction("activate", u.id, "Reativar conta")
                            }
                          >
                            <CheckCircle className="h-3 w-3 mr-1" /> Ativar
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-[10px]"
                            disabled={
                              actionLoading === u.id ||
                              u.roles.includes("admin")
                            }
                            onClick={() =>
                              confirmAction("deactivate", u.id, "Desativar conta")
                            }
                          >
                            <Ban className="h-3 w-3 mr-1" /> Desativar
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-7 text-[10px]"
                          disabled={
                            actionLoading === u.id || u.roles.includes("admin")
                          }
                          onClick={() =>
                            confirmAction("delete", u.id, "Excluir permanentemente")
                          }
                        >
                          <Trash2 className="h-3 w-3 mr-1" /> Excluir
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-[10px]"
                          disabled={actionLoading === u.id}
                          onClick={() =>
                            confirmAction("block-api", u.id, "Bloquear API")
                          }
                        >
                          <ShieldOff className="h-3 w-3 mr-1" /> Bloquear API
                        </Button>
                        {u.phone && (
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-7 text-[10px]"
                            disabled={actionLoading === u.id}
                            onClick={() =>
                              confirmAction("remove-phone", u.id, "Remover telefone")
                            }
                          >
                            <PhoneOff className="h-3 w-3 mr-1" /> Remover Tel.
                          </Button>
                        )}
                        {u.has_whatsapp_instance && (
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-7 text-[10px]"
                            disabled={actionLoading === u.id}
                            onClick={() =>
                              confirmAction("delete-whatsapp-instance", u.id, `Apagar instância WhatsApp (${u.whatsapp_instance_name || "sem nome"})`)
                            }
                          >
                            <Smartphone className="h-3 w-3 mr-1" /> Apagar WhatsApp
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Confirm action dialog */}
      <AlertDialog
        open={dialog.open}
        onOpenChange={(o) =>
          !o && setDialog({ open: false, action: "", userId: "", label: "" })
        }
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar: {dialog.label}</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja executar esta ação? Esta operação pode ser
              irreversível.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => executeAction(dialog.action, dialog.userId)}
            >
              {actionLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Confirmar"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create user dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Novo Usuário</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome</Label>
              <Input
                placeholder="Nome do usuário"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                placeholder="email@exemplo.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
              />
            </div>
            <div>
              <Label>Senha</Label>
              <Input
                type="password"
                placeholder="Senha inicial"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateUser} disabled={creating}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <UserPlus className="h-4 w-4 mr-1" />}
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Grant access dialog */}
      <Dialog open={grantOpen} onOpenChange={setGrantOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conceder Dias de Acesso</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Se o usuário já tem acesso manual ativo, os dias serão somados ao prazo existente.
            </p>
            <div>
              <Label>Quantidade de dias</Label>
              <Input
                type="number"
                min={1}
                max={365}
                value={grantDays}
                onChange={(e) => setGrantDays(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGrantOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleGrantAccess} disabled={granting}>
              {granting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CalendarPlus className="h-4 w-4 mr-1" />}
              Conceder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
