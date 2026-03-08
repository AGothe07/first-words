import { useState, useEffect, useCallback, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useHousehold } from "@/contexts/HouseholdContext";
import { useReadOnly } from "@/hooks/useReadOnly";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2, Plus, Trash2, Users, UserPlus, Crown, CheckCircle2, XCircle, Mail, Shield, Eye, Pencil, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Invite {
  id: string;
  household_id: string;
  email: string;
  role: string;
  status: string;
}

interface DashboardData {
  household_id: string;
  members: { user_id: string; role: string; display_name: string; total_expense: number; total_income: number; tx_count: number }[];
  categories: { name: string; total: number }[];
  combined_expense: number;
  combined_income: number;
  member_count: number;
  monthly_cost: number;
}

export default function FamilyPage() {
  const { user } = useAuth();
  const { household, members, isOwner, myRole, loading: hhLoading, refetch } = useHousehold();
  const { isReadOnly } = useReadOnly();

  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [pendingForMe, setPendingForMe] = useState<Invite[]>([]);
  const [loadingDash, setLoadingDash] = useState(false);

  // Dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [permOpen, setPermOpen] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [familyName, setFamilyName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");

  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  // Fetch dashboard data
  const fetchDashboard = useCallback(async () => {
    if (!user || !household) return;
    setLoadingDash(true);
    const { data } = await supabase.rpc("get_household_dashboard", {
      _user_id: user.id,
      _month_start: format(monthStart, "yyyy-MM-dd"),
      _month_end: format(monthEnd, "yyyy-MM-dd"),
    });
    if (data && !(data as any).error) setDashboard(data as any);
    setLoadingDash(false);
  }, [user, household]);

  // Fetch invites
  const fetchInvites = useCallback(async () => {
    if (!user) return;
    if (household && isOwner) {
      const { data } = await supabase
        .from("family_invites" as any)
        .select("*")
        .eq("household_id", household.id)
        .eq("status", "pending");
      setInvites((data as any[]) || []);
    }
    // Check invites for current user
    const { data: profile } = await supabase.from("profiles").select("email").eq("id", user.id).single();
    if (profile?.email) {
      const { data: myInvites } = await supabase
        .from("family_invites" as any)
        .select("*")
        .eq("email", profile.email)
        .eq("status", "pending");
      setPendingForMe((myInvites as any[]) || []);
    }
  }, [user, household, isOwner]);

  useEffect(() => { fetchDashboard(); fetchInvites(); }, [fetchDashboard, fetchInvites]);

  const createHousehold = async () => {
    if (!user || !familyName.trim()) { toast.error("Nome obrigatório"); return; }
    setSaving(true);
    const { data: hh, error } = await supabase
      .from("households" as any)
      .insert({ name: familyName, owner_user_id: user.id } as any)
      .select()
      .single();
    if (error) { toast.error(error.message); setSaving(false); return; }
    // Add self as owner member
    await supabase.from("household_members" as any).insert({
      household_id: (hh as any).id, user_id: user.id, role: "owner", status: "active",
    } as any);
    toast.success("Família criada!");
    setSaving(false); setCreateOpen(false); setFamilyName("");
    refetch();
  };

  const sendInvite = async () => {
    if (!user || !household || !inviteEmail.trim()) { toast.error("Email obrigatório"); return; }
    setSaving(true);
    const { error } = await supabase.from("family_invites" as any).insert({
      household_id: household.id, email: inviteEmail.toLowerCase().trim(), role: inviteRole,
    } as any);
    if (error) toast.error(error.message.includes("duplicate") ? "Convite já enviado" : error.message);
    else toast.success(`Convite enviado para ${inviteEmail}`);
    setSaving(false); setInviteOpen(false); setInviteEmail(""); setInviteRole("member");
    fetchInvites();
  };

  const acceptInvite = async (inv: Invite) => {
    if (!user) return;
    // Update invite status
    await supabase.from("family_invites" as any).update({ status: "accepted" } as any).eq("id", inv.id);
    // Add as member
    const { error } = await supabase.from("household_members" as any).insert({
      household_id: inv.household_id, user_id: user.id, role: inv.role, status: "active",
    } as any);
    if (error) toast.error(error.message);
    else { toast.success("Você entrou na família! 🎉"); refetch(); fetchInvites(); }
  };

  const declineInvite = async (inv: Invite) => {
    await supabase.from("family_invites" as any).update({ status: "declined" } as any).eq("id", inv.id);
    toast.success("Convite recusado");
    fetchInvites();
  };

  const removeMember = async (memberId: string) => {
    await supabase.from("household_members" as any).delete().eq("id", memberId);
    toast.success("Membro removido");
    refetch();
  };

  const cancelInvite = async (invId: string) => {
    await supabase.from("family_invites" as any).delete().eq("id", invId);
    toast.success("Convite cancelado");
    fetchInvites();
  };

  const updatePermission = async (memberId: string, key: string, value: boolean) => {
    const member = members.find(m => m.id === memberId);
    if (!member) return;
    const perms = { ...(member as any).permissions, [key]: value };
    await supabase.from("household_members" as any).update({ permissions: perms } as any).eq("id", memberId);
    toast.success("Permissão atualizada");
    refetch();
  };

  const updateMonthlyLimit = async (memberId: string, limit: number | null) => {
    await supabase.from("household_members" as any).update({ monthly_limit: limit } as any).eq("id", memberId);
    toast.success("Limite atualizado");
    refetch();
  };

  const fmtCurrency = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

  const roleLabel = (role: string) => {
    if (role === "owner") return "Admin";
    if (role === "viewer") return "Visualizador";
    return "Membro";
  };

  const roleIcon = (role: string) => {
    if (role === "owner") return Crown;
    if (role === "viewer") return Eye;
    return Users;
  };

  // Subscription cost calculation
  const activeMembersCount = members.length;
  const extraMembers = Math.max(activeMembersCount - 1, 0);
  const extraCost = extraMembers * (household?.extra_member_price || 20);

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Users className="h-6 w-6 text-primary" /> Modo Família
            </h1>
            <p className="text-sm text-muted-foreground">
              {household ? `${household.name} — ${format(now, "MMMM yyyy", { locale: ptBR })}` : "Gerencie os gastos da família em um só lugar"}
            </p>
          </div>
          {household && isOwner && !isReadOnly && (
            <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1"><UserPlus className="h-4 w-4" /> Convidar Membro</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-sm">
                <DialogHeader><DialogTitle>Convidar Membro</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs">Email *</Label>
                    <Input type="email" placeholder="maria@email.com" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} className="h-9 text-sm" />
                  </div>
                  <div>
                    <Label className="text-xs">Papel</Label>
                    <Select value={inviteRole} onValueChange={setInviteRole}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="member">Membro (lê e edita próprios dados)</SelectItem>
                        <SelectItem value="viewer">Visualizador (apenas visualiza)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="text-xs text-muted-foreground">O membro precisa ter conta no LifeHub. O convite aparecerá ao acessar esta página.</p>
                  <Button onClick={sendInvite} disabled={saving} className="w-full">
                    {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Enviar Convite
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Pending invites for me */}
        {pendingForMe.length > 0 && (
          <Card className="border-primary/50 bg-primary/5">
            <CardContent className="p-4 space-y-3">
              <p className="text-sm font-medium flex items-center gap-2"><Mail className="h-4 w-4 text-primary" /> Convites pendentes</p>
              {pendingForMe.map(inv => (
                <div key={inv.id} className="flex items-center justify-between gap-3 flex-wrap">
                  <span className="text-sm">Você foi convidado como <strong>{roleLabel(inv.role)}</strong></span>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => acceptInvite(inv)}><CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Aceitar</Button>
                    <Button size="sm" variant="outline" onClick={() => declineInvite(inv)}><XCircle className="h-3.5 w-3.5 mr-1" /> Recusar</Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {hhLoading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : !household ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Users className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-muted-foreground mb-1">Você ainda não tem uma família</p>
              <p className="text-xs text-muted-foreground mb-4">Crie uma família e convide membros para acompanhar gastos juntos</p>
              <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-1"><Plus className="h-4 w-4" /> Criar Família</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-sm">
                  <DialogHeader><DialogTitle>Criar Família</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs">Nome da Família *</Label>
                      <Input placeholder="Ex: Família Silva" value={familyName} onChange={e => setFamilyName(e.target.value)} className="h-9 text-sm" />
                    </div>
                    <Button onClick={createHousehold} disabled={saving} className="w-full">
                      {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Criar Família
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Admin cost card */}
            {isOwner && (
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="p-4 flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <p className="text-sm font-medium">💰 Custo Modo Família</p>
                    <p className="text-xs text-muted-foreground">{activeMembersCount} membro(s) ativo(s) • {extraMembers} extra(s) × R$ {household.extra_member_price}</p>
                  </div>
                  <p className="text-lg font-bold text-primary">+ {fmtCurrency(extraCost)}/mês</p>
                </CardContent>
              </Card>
            )}

            {/* Dashboard */}
            {dashboard && dashboard.members && dashboard.members.length > 0 && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-xs text-muted-foreground mb-1">Total Casa (Despesas)</p>
                      <p className="text-xl font-bold text-destructive">{fmtCurrency(dashboard.combined_expense)}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-xs text-muted-foreground mb-1">Total Casa (Receitas)</p>
                      <p className="text-xl font-bold text-success">{fmtCurrency(dashboard.combined_income)}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-xs text-muted-foreground mb-1">Saldo Família</p>
                      <p className={cn("text-xl font-bold", (dashboard.combined_income - dashboard.combined_expense) >= 0 ? "text-success" : "text-destructive")}>
                        {fmtCurrency(dashboard.combined_income - dashboard.combined_expense)}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Per member */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Gastos por Membro</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {dashboard.members.map((m, i) => {
                      const pct = dashboard.combined_expense > 0 ? (m.total_expense / dashboard.combined_expense) * 100 : 0;
                      const RoleIcon = roleIcon(m.role);
                      return (
                        <div key={m.user_id || i}>
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <RoleIcon className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-sm font-medium">{m.display_name}</span>
                              <Badge variant="outline" className="text-[9px]">{roleLabel(m.role)}</Badge>
                            </div>
                            <span className="text-sm font-bold">{fmtCurrency(m.total_expense)}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <Progress value={pct} className="h-2.5 flex-1" />
                            <span className="text-xs text-muted-foreground min-w-[40px] text-right">{pct.toFixed(0)}%</span>
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>

                {/* Categories */}
                {dashboard.categories && dashboard.categories.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Top Categorias da Família</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {dashboard.categories.map((cat, i) => {
                          const pct = dashboard.combined_expense > 0 ? (cat.total / dashboard.combined_expense) * 100 : 0;
                          return (
                            <div key={i} className="flex items-center justify-between text-sm">
                              <div className="flex items-center gap-2 flex-1">
                                <span className="text-muted-foreground">{cat.name}</span>
                                <Progress value={pct} className="h-1.5 flex-1 max-w-[120px]" />
                              </div>
                              <span className="font-medium">{fmtCurrency(cat.total)}</span>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}

            {/* Members management */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2"><Shield className="h-4 w-4" /> Membros</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {members.map(m => {
                  const RoleIcon = roleIcon((m as any).role);
                  const perms = (m as any).permissions || {};
                  return (
                    <div key={m.id} className="py-2 border-b border-border/50 last:border-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <RoleIcon className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-sm">{m.user_id?.slice(0, 8)}...</span>
                          <Badge variant="outline" className="text-[9px]">{roleLabel((m as any).role)}</Badge>
                          {(m as any).monthly_limit && (
                            <Badge variant="outline" className="text-[9px] text-warning border-warning">
                              Limite: {fmtCurrency((m as any).monthly_limit)}
                            </Badge>
                          )}
                        </div>
                        <div className="flex gap-1">
                          {isOwner && m.user_id !== user?.id && (
                            <>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPermOpen(permOpen === m.id ? null : m.id)}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/60" onClick={() => removeMember(m.id)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                      {/* Permissions panel */}
                      {permOpen === m.id && isOwner && (
                        <div className="mt-3 p-3 bg-muted/50 rounded-md space-y-3">
                          <p className="text-xs font-medium text-muted-foreground">Permissões</p>
                          <div className="flex items-center justify-between">
                            <Label className="text-xs">Editar gastos de outros</Label>
                            <Switch checked={perms.edit_others_transactions || false} onCheckedChange={v => updatePermission(m.id, "edit_others_transactions", v)} />
                          </div>
                          <div className="flex items-center justify-between">
                            <Label className="text-xs">Ver patrimônio</Label>
                            <Switch checked={perms.view_assets !== false} onCheckedChange={v => updatePermission(m.id, "view_assets", v)} />
                          </div>
                          <div className="flex items-center justify-between">
                            <Label className="text-xs">Ver dívidas</Label>
                            <Switch checked={perms.view_debts !== false} onCheckedChange={v => updatePermission(m.id, "view_debts", v)} />
                          </div>
                          <div>
                            <Label className="text-xs">Limite mensal (R$)</Label>
                            <Input
                              type="number" step="0.01" min="0" placeholder="Sem limite"
                              defaultValue={(m as any).monthly_limit || ""}
                              onBlur={e => updateMonthlyLimit(m.id, e.target.value ? parseFloat(e.target.value) : null)}
                              className="h-8 text-sm mt-1"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Pending invites */}
                {invites.length > 0 && (
                  <>
                    <p className="text-xs text-muted-foreground font-medium pt-2">Convites Pendentes</p>
                    {invites.map(inv => (
                      <div key={inv.id} className="flex items-center justify-between py-1">
                        <div className="flex items-center gap-2">
                          <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">{inv.email}</span>
                          <Badge variant="outline" className="text-[9px] text-warning border-warning">Pendente</Badge>
                        </div>
                        {isOwner && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/60" onClick={() => cancelInvite(inv.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppLayout>
  );
}
