import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Loader2,
  Ban,
  CheckCircle,
  Trash2,
  RefreshCw,
  ShieldOff,
  PhoneOff,
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

  const executeAction = async (action: string, userId: string) => {
    setActionLoading(userId);
    const { data, error } = await supabase.functions.invoke("admin-users", {
      body: { action, userId },
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
          <Button variant="outline" size="sm" onClick={fetchUsers}>
            <RefreshCw className="h-4 w-4 mr-1" /> Atualizar
          </Button>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead>Email Verificado</TableHead>
                <TableHead>IA</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Última Atividade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="text-xs font-mono">{u.email}</TableCell>
                  <TableCell className="text-sm">
                    {u.display_name || "—"}
                  </TableCell>
                  <TableCell className="text-xs">{fmt(u.created_at)}</TableCell>
                  <TableCell>
                    {u.email_confirmed_at ? (
                      <Badge variant="default" className="text-[10px]">
                        Sim
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px]">
                        Não
                      </Badge>
                    )}
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
                    <span className="text-xs font-mono">
                      {u.phone ? `+${u.phone}` : "—"}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs">
                    {fmtDt(u.last_activity)}
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
                            confirmAction(
                              "deactivate",
                              u.id,
                              "Desativar conta"
                            )
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
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

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



    </>
  );
}
