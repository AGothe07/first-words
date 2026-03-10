import { useState, useEffect, useCallback } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Plus, Trash2, Users, UserPlus, Crown, CheckCircle2, XCircle, Mail, Shield, Eye, Pencil, DollarSign, BarChart3, Settings2, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { FamilyPermissions, PERMISSION_LABELS, PERMISSION_GROUPS, DEFAULT_PERMISSIONS } from "@/types/family";

interface Invite {
  id: string;
  household_id: string;
  email: string;
  role: string;
  status: string;
}

interface MemberDashData {
  user_id: string;
  role: string;
  display_name: string;
  total_expense: number;
  total_income: number;
  tx_count: number;
}

interface DashboardData {
  household_id: string;
  members: MemberDashData[];
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

  const [createOpen, setCreateOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [familyName, setFamilyName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [activeTab, setActiveTab] = useState("dashboard");
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  // Get my permissions
  const myMember = members.find(m => m.user_id === user?.id);
  const myPerms: FamilyPermissions = { ...DEFAULT_PERMISSIONS, ...((myMember as any)?.permissions || {}) };

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
      .select().single();
    if (error) { toast.error(error.message); setSaving(false); return; }
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
    await supabase.from("family_invites" as any).update({ status: "accepted" } as any).eq("id", inv.id);
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
    const perms = { ...DEFAULT_PERMISSIONS, ...(member as any).permissions, [key]: value };
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
  const roleLabel = (role: string) => role === "owner" ? "Admin" : role === "viewer" ? "Visualizador" : "Membro";
  const roleIcon = (role: string) => role === "owner" ? Crown : role === "viewer" ? Eye : Users;

  const activeMembersCount = members.length;
  const extraMembers = Math.max(activeMembersCount - 1, 0);
  const extraCost = extraMembers * (household?.extra_member_price || 20);

  // Filter dashboard data based on permissions
  const filteredMembers = dashboard?.members?.filter(m => {
    if (isOwner) return true;
    if (myPerms.can_view_only_own_expenses && m.user_id !== user?.id) return false;
    if (!myPerms.can_view_family_expenses && m.user_id !== user?.id) return false;
    return true;
  }) || [];

  const canSeeIncome = isOwner || myPerms.can_view_family_income;
  const canSeeBalance = isOwner || myPerms.can_view_family_balance;
  const canSeeExpenses = isOwner || myPerms.can_view_family_expenses;

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
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
                  <p className="text-xs text-muted-foreground">O membro precisa ter conta no LifeHub.</p>
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
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full flex flex-wrap h-auto gap-1 bg-muted/50 p-1">
              <TabsTrigger value="dashboard" className="gap-1.5 text-xs">
                <BarChart3 className="h-3.5 w-3.5" /> Dashboard
              </TabsTrigger>
              <TabsTrigger value="members" className="gap-1.5 text-xs">
                <Users className="h-3.5 w-3.5" /> Membros
              </TabsTrigger>
              {isOwner && (
                <TabsTrigger value="settings" className="gap-1.5 text-xs">
                  <Settings2 className="h-3.5 w-3.5" /> Configurações
                </TabsTrigger>
              )}
            </TabsList>

            {/* ──── DASHBOARD TAB ──── */}
            <TabsContent value="dashboard" className="mt-4 space-y-4">
              {/* Cost card for owner */}
              {isOwner && (
                <Card className="border-primary/30 bg-primary/5">
                  <CardContent className="p-4 flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <p className="text-sm font-medium">💰 Custo Modo Família</p>
                      <p className="text-xs text-muted-foreground">{activeMembersCount} membro(s) • {extraMembers} extra(s) × R$ {household.extra_member_price}</p>
                    </div>
                    <p className="text-lg font-bold text-primary">+ {fmtCurrency(extraCost)}/mês</p>
                  </CardContent>
                </Card>
              )}

              {loadingDash ? (
                <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
              ) : dashboard && dashboard.members && dashboard.members.length > 0 ? (
                <>
                  {/* KPI Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {canSeeExpenses && (
                      <Card>
                        <CardContent className="p-4">
                          <p className="text-xs text-muted-foreground mb-1">Total Despesas</p>
                          <p className="text-xl font-bold text-destructive">{fmtCurrency(dashboard.combined_expense)}</p>
                        </CardContent>
                      </Card>
                    )}
                    {canSeeIncome && (
                      <Card>
                        <CardContent className="p-4">
                          <p className="text-xs text-muted-foreground mb-1">Total Receitas</p>
                          <p className="text-xl font-bold text-emerald-600">{fmtCurrency(dashboard.combined_income)}</p>
                        </CardContent>
                      </Card>
                    )}
                    {canSeeBalance && (
                      <Card>
                        <CardContent className="p-4">
                          <p className="text-xs text-muted-foreground mb-1">Saldo Família</p>
                          <p className={cn("text-xl font-bold", (dashboard.combined_income - dashboard.combined_expense) >= 0 ? "text-emerald-600" : "text-destructive")}>
                            {fmtCurrency(dashboard.combined_income - dashboard.combined_expense)}
                          </p>
                        </CardContent>
                      </Card>
                    )}
                  </div>

                  {/* Per member expenses */}
                  {filteredMembers.length > 0 && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Gastos por Membro</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {filteredMembers.map((m, i) => {
                          const maxExpense = Math.max(...filteredMembers.map(x => x.total_expense), 1);
                          const pct = (m.total_expense / maxExpense) * 100;
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
                                <span className="text-xs text-muted-foreground min-w-[40px] text-right">{m.tx_count} tx</span>
                              </div>
                            </div>
                          );
                        })}
                      </CardContent>
                    </Card>
                  )}

                  {/* Ranking comparativo */}
                  {filteredMembers.length > 1 && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                          <TrendingUp className="h-4 w-4" /> Ranking de Gastos
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {[...filteredMembers]
                            .sort((a, b) => b.total_expense - a.total_expense)
                            .map((m, i) => (
                              <div key={m.user_id} className="flex items-center gap-3 text-sm">
                                <span className={cn(
                                  "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                                  i === 0 ? "bg-yellow-100 text-yellow-700" : i === 1 ? "bg-gray-100 text-gray-600" : "bg-orange-50 text-orange-600"
                                )}>
                                  {i + 1}
                                </span>
                                <span className="flex-1 font-medium">{m.display_name}</span>
                                <span className="font-bold">{fmtCurrency(m.total_expense)}</span>
                              </div>
                            ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Categories */}
                  {canSeeExpenses && dashboard.categories && dashboard.categories.length > 0 && (
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
              ) : (
                <Card>
                  <CardContent className="py-8 text-center">
                    <BarChart3 className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Nenhum dado para exibir neste mês</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* ──── MEMBERS TAB ──── */}
            <TabsContent value="members" className="mt-4 space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Shield className="h-4 w-4" /> Membros ({members.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {members.map(m => {
                    const RoleIcon = roleIcon((m as any).role);
                    return (
                      <div key={m.id} className="py-2 border-b border-border/50 last:border-0">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <RoleIcon className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-sm">{m.user_id?.slice(0, 8)}...</span>
                            <Badge variant="outline" className="text-[9px]">{roleLabel((m as any).role)}</Badge>
                            {(m as any).monthly_limit && (
                              <Badge variant="outline" className="text-[9px] text-amber-600 border-amber-300">
                                Limite: {fmtCurrency((m as any).monthly_limit)}
                              </Badge>
                            )}
                          </div>
                          <div className="flex gap-1">
                            {isOwner && m.user_id !== user?.id && (
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/60" onClick={() => removeMember(m.id)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {invites.length > 0 && (
                    <>
                      <p className="text-xs text-muted-foreground font-medium pt-2">Convites Pendentes</p>
                      {invites.map(inv => (
                        <div key={inv.id} className="flex items-center justify-between py-1">
                          <div className="flex items-center gap-2">
                            <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">{inv.email}</span>
                            <Badge variant="outline" className="text-[9px] text-amber-600 border-amber-300">Pendente</Badge>
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
            </TabsContent>

            {/* ──── SETTINGS TAB (Owner only) ──── */}
            {isOwner && (
              <TabsContent value="settings" className="mt-4 space-y-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Configurações da Família</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground mb-4">
                      Defina permissões individuais para cada membro. O administrador sempre tem acesso total.
                    </p>

                    {/* Member selector */}
                    <div className="space-y-2 mb-4">
                      <Label className="text-xs font-medium">Selecione um membro para configurar</Label>
                      <div className="flex flex-wrap gap-2">
                        {members
                          .filter(m => m.user_id !== user?.id)
                          .map(m => {
                            const RoleIcon = roleIcon((m as any).role);
                            return (
                              <Button
                                key={m.id}
                                variant={selectedMemberId === m.id ? "default" : "outline"}
                                size="sm"
                                className="gap-1.5 text-xs"
                                onClick={() => setSelectedMemberId(selectedMemberId === m.id ? null : m.id)}
                              >
                                <RoleIcon className="h-3 w-3" />
                                {m.user_id?.slice(0, 8)}...
                              </Button>
                            );
                          })}
                      </div>
                      {members.filter(m => m.user_id !== user?.id).length === 0 && (
                        <p className="text-xs text-muted-foreground">Nenhum membro além de você. Convide alguém para configurar permissões.</p>
                      )}
                    </div>

                    {/* Permissions for selected member */}
                    {selectedMemberId && (() => {
                      const member = members.find(m => m.id === selectedMemberId);
                      if (!member) return null;
                      const perms: FamilyPermissions = { ...DEFAULT_PERMISSIONS, ...(member as any).permissions };

                      return (
                        <div className="space-y-6 border-t border-border pt-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline" className="text-xs">{roleLabel((member as any).role)}</Badge>
                            <span className="text-xs text-muted-foreground">ID: {member.user_id?.slice(0, 12)}...</span>
                          </div>

                          {PERMISSION_GROUPS.map(group => (
                            <div key={group.label}>
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{group.label}</p>
                              <div className="space-y-2">
                                {group.keys.map(key => (
                                  <div key={key} className="flex items-center justify-between py-1">
                                    <Label className="text-xs">{PERMISSION_LABELS[key]}</Label>
                                    <Switch
                                      checked={perms[key]}
                                      onCheckedChange={v => updatePermission(member.id, key, v)}
                                    />
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}

                          {/* Monthly limit */}
                          <div className="border-t border-border pt-4">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Limite Mensal</p>
                            <div>
                              <Label className="text-xs">Limite mensal de gastos (R$)</Label>
                              <Input
                                type="number" step="0.01" min="0" placeholder="Sem limite"
                                defaultValue={(member as any).monthly_limit || ""}
                                onBlur={e => updateMonthlyLimit(member.id, e.target.value ? parseFloat(e.target.value) : null)}
                                className="h-8 text-sm mt-1 max-w-[200px]"
                              />
                              <p className="text-[10px] text-muted-foreground mt-1">Deixe vazio para sem limite</p>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>
              </TabsContent>
            )}
          </Tabs>
        )}
      </div>
    </AppLayout>
  );
}
