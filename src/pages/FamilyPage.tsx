import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useReadOnly } from "@/hooks/useReadOnly";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Trash2, Users, UserPlus, Crown, CheckCircle2, XCircle, Mail } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Family {
  id: string;
  name: string;
  created_by: string;
}

interface FamilyMember {
  id: string;
  family_id: string;
  user_id: string | null;
  invited_email: string | null;
  role: string;
  status: string;
}

interface FamilySummary {
  family_id: string;
  members: {
    user_id: string;
    display_name: string;
    total_expense: number;
    total_income: number;
  }[];
  combined_expense: number;
  combined_income: number;
  top_categories: { name: string; total: number }[];
}

export default function FamilyPage() {
  const { user } = useAuth();
  const { isReadOnly } = useReadOnly();

  const [family, setFamily] = useState<Family | null>(null);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [summary, setSummary] = useState<FamilySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [familyName, setFamilyName] = useState("");
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingInvites, setPendingInvites] = useState<FamilyMember[]>([]);

  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const fetchFamily = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    // Check if user has a family (as owner)
    const { data: ownedFamilies } = await supabase
      .from("families")
      .select("*")
      .eq("created_by", user.id)
      .limit(1);

    let fam = (ownedFamilies as any[])?.[0] || null;

    // Check as active member
    if (!fam) {
      const { data: memberOf } = await supabase
        .from("family_members")
        .select("family_id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .limit(1);

      if (memberOf && memberOf.length > 0) {
        const { data: famData } = await supabase
          .from("families")
          .select("*")
          .eq("id", memberOf[0].family_id)
          .limit(1);
        fam = (famData as any[])?.[0] || null;
      }
    }

    if (fam) {
      setFamily(fam);
      // Fetch members
      const { data: membersData } = await supabase
        .from("family_members")
        .select("*")
        .eq("family_id", fam.id);
      setMembers((membersData as any[]) || []);

      // Fetch summary
      const { data: summaryData } = await supabase.rpc("get_family_summary", {
        _user_id: user.id,
        _month_start: format(monthStart, "yyyy-MM-dd"),
        _month_end: format(monthEnd, "yyyy-MM-dd"),
      });
      if (summaryData && !(summaryData as any).error) {
        setSummary(summaryData as any);
      }
    } else {
      setFamily(null);
    }

    // Check pending invites for this user
    const { data: profile } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", user.id)
      .single();

    if (profile?.email) {
      const { data: invites } = await supabase
        .from("family_members")
        .select("*")
        .eq("invited_email", profile.email)
        .eq("status", "pending");
      setPendingInvites((invites as any[]) || []);
    }

    setLoading(false);
  }, [user]);

  useEffect(() => { fetchFamily(); }, [fetchFamily]);

  const createFamily = async () => {
    if (!user || !familyName.trim()) { toast.error("Nome da família é obrigatório"); return; }
    setSaving(true);
    const { data: fam, error } = await supabase
      .from("families")
      .insert({ name: familyName, created_by: user.id } as any)
      .select()
      .single();

    if (error) { toast.error(error.message); setSaving(false); return; }

    // Add creator as active owner member
    await supabase.from("family_members").insert({
      family_id: (fam as any).id,
      user_id: user.id,
      role: "owner",
      status: "active",
    } as any);

    toast.success("Família criada!");
    setSaving(false);
    setCreateDialogOpen(false);
    setFamilyName("");
    fetchFamily();
  };

  const inviteMember = async () => {
    if (!user || !family || !inviteEmail.trim()) { toast.error("Email é obrigatório"); return; }
    setSaving(true);
    const { error } = await supabase.from("family_members").insert({
      family_id: family.id,
      invited_email: inviteEmail.toLowerCase().trim(),
      role: "member",
      status: "pending",
    } as any);

    if (error) {
      toast.error(error.message.includes("duplicate") ? "Já existe convite para este email" : error.message);
    } else {
      toast.success(`Convite enviado para ${inviteEmail}`);
    }
    setSaving(false);
    setInviteDialogOpen(false);
    setInviteEmail("");
    fetchFamily();
  };

  const acceptInvite = async (invite: FamilyMember) => {
    if (!user) return;
    const { error } = await supabase
      .from("family_members")
      .update({ user_id: user.id, status: "active" } as any)
      .eq("id", invite.id);
    if (error) toast.error(error.message);
    else { toast.success("Convite aceito! 🎉"); fetchFamily(); }
  };

  const declineInvite = async (invite: FamilyMember) => {
    const { error } = await supabase.from("family_members").delete().eq("id", invite.id);
    if (error) toast.error(error.message);
    else { toast.success("Convite recusado"); fetchFamily(); }
  };

  const removeMember = async (memberId: string) => {
    const { error } = await supabase.from("family_members").delete().eq("id", memberId);
    if (error) toast.error(error.message);
    else { toast.success("Membro removido"); fetchFamily(); }
  };

  const fmtCurrency = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

  const isOwner = family?.created_by === user?.id;
  const activeMembers = members.filter(m => m.status === "active");
  const pendingMembers = members.filter(m => m.status === "pending");

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Users className="h-6 w-6 text-primary" /> Modo Família
            </h1>
            <p className="text-sm text-muted-foreground">
              {family ? `${family.name} — ${format(now, "MMMM yyyy", { locale: ptBR })}` : "Gerencie os gastos da família em um só lugar"}
            </p>
          </div>
          {family && isOwner && !isReadOnly && (
            <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1"><UserPlus className="h-4 w-4" /> Convidar Membro</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-sm">
                <DialogHeader><DialogTitle>Convidar Membro</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs">Email do membro *</Label>
                    <Input type="email" placeholder="maria@email.com" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} className="h-9 text-sm" />
                  </div>
                  <p className="text-xs text-muted-foreground">O membro precisa ter uma conta no LifeHub. O convite aparecerá quando ele acessar esta página.</p>
                  <Button onClick={inviteMember} disabled={saving} className="w-full">
                    {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    Enviar Convite
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Pending invites for current user */}
        {pendingInvites.length > 0 && (
          <Card className="border-primary/50 bg-primary/5">
            <CardContent className="p-4">
              <p className="text-sm font-medium mb-3 flex items-center gap-2">
                <Mail className="h-4 w-4 text-primary" /> Convites pendentes
              </p>
              {pendingInvites.map(inv => (
                <div key={inv.id} className="flex items-center justify-between gap-3">
                  <span className="text-sm">Você foi convidado para uma família</span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="default" onClick={() => acceptInvite(inv)} className="gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Aceitar
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => declineInvite(inv)} className="gap-1">
                      <XCircle className="h-3.5 w-3.5" /> Recusar
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : !family ? (
          /* No family — create one */
          <Card>
            <CardContent className="py-12 text-center">
              <Users className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-muted-foreground mb-1">Você ainda não tem uma família</p>
              <p className="text-xs text-muted-foreground mb-4">Crie uma família e convide membros para acompanhar gastos juntos</p>
              <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
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
                    <Button onClick={createFamily} disabled={saving} className="w-full">
                      {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                      Criar Família
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Family Dashboard */}
            {summary && summary.members && summary.members.length > 0 && (
              <>
                {/* Combined summary */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-xs text-muted-foreground mb-1">Total Casa (Despesas)</p>
                      <p className="text-xl font-bold text-destructive">{fmtCurrency(summary.combined_expense)}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-xs text-muted-foreground mb-1">Total Casa (Receitas)</p>
                      <p className="text-xl font-bold text-success">{fmtCurrency(summary.combined_income)}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-xs text-muted-foreground mb-1">Saldo Família</p>
                      <p className={cn("text-xl font-bold", (summary.combined_income - summary.combined_expense) >= 0 ? "text-success" : "text-destructive")}>
                        {fmtCurrency(summary.combined_income - summary.combined_expense)}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Per-member breakdown */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Gastos por Membro</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {summary.members.map((m, i) => {
                      const pct = summary.combined_expense > 0
                        ? (m.total_expense / summary.combined_expense) * 100
                        : 0;
                      return (
                        <div key={m.user_id || i}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium">{m.display_name}</span>
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

                {/* Top categories */}
                {summary.top_categories && summary.top_categories.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Top Categorias da Família</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {summary.top_categories.map((cat, i) => (
                          <div key={i} className="flex justify-between text-sm">
                            <span className="text-muted-foreground">{cat.name}</span>
                            <span className="font-medium">{fmtCurrency(cat.total)}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}

            {/* Members list */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Membros da Família</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {activeMembers.map(m => (
                  <div key={m.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{m.invited_email || m.user_id?.slice(0, 8)}</span>
                      {m.role === "owner" && (
                        <Badge variant="outline" className="text-[10px] gap-1"><Crown className="h-3 w-3" /> Dono</Badge>
                      )}
                      <Badge variant="outline" className="text-[10px] text-success border-success">Ativo</Badge>
                    </div>
                    {isOwner && m.user_id !== user?.id && (
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/60" onClick={() => removeMember(m.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
                {pendingMembers.map(m => (
                  <div key={m.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">{m.invited_email}</span>
                      <Badge variant="outline" className="text-[10px] text-warning border-warning">Pendente</Badge>
                    </div>
                    {isOwner && (
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/60" onClick={() => removeMember(m.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppLayout>
  );
}
