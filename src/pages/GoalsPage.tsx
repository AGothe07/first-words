import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { Plus, Target, Zap } from "lucide-react";
import { Goal } from "@/types/goals";
import { GoalCard } from "@/components/goals/GoalCard";
import { DynamicGoalForm } from "@/components/goals/DynamicGoalForm";
import { useDynamicGoalProgress } from "@/hooks/useDynamicGoalProgress";

export default function GoalsPage() {
  const { user } = useAuth();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [manualDialogOpen, setManualDialogOpen] = useState(false);
  const [dynamicDialogOpen, setDynamicDialogOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", goal_type: "personal", target_value: "", unit: "", target_date: "" });

  const fetchGoals = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("goals").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    setGoals((data as Goal[]) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchGoals(); }, [fetchGoals]);

  // Enrich dynamic goals with real-time progress
  const enrichedGoals = useDynamicGoalProgress(goals);

  const handleAddManual = async () => {
    if (!user || !form.title.trim()) return;
    const { error } = await supabase.from("goals").insert({
      user_id: user.id,
      title: form.title,
      description: form.description || null,
      goal_type: form.goal_type,
      target_value: form.target_value ? Number(form.target_value) : null,
      unit: form.unit || null,
      target_date: form.target_date || null,
    });
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Meta criada!" });
    setForm({ title: "", description: "", goal_type: "personal", target_value: "", unit: "", target_date: "" });
    setManualDialogOpen(false);
    fetchGoals();
  };

  const handleAddDynamic = async (data: any) => {
    if (!user) return;
    const { error } = await supabase.from("goals").insert({
      user_id: user.id,
      title: data.title,
      description: data.description || null,
      goal_type: data.data_source,
      data_source: data.data_source,
      target_value: data.target_value,
      unit: data.unit,
      baseline_value: data.baseline_value,
      progress_mode: data.progress_mode,
      period_type: data.period_type,
      period_start: data.period_start,
      period_end: data.period_end,
      person_ids: data.person_ids.length > 0 ? data.person_ids : null,
      target_date: data.target_date || null,
    });
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "⚡ Meta dinâmica criada!" });
    setDynamicDialogOpen(false);
    fetchGoals();
  };

  const updateProgress = async (goal: Goal, val: number) => {
    const isComplete = goal.target_value && val >= goal.target_value;
    await supabase.from("goals").update({
      current_value: val,
      ...(isComplete ? { status: "completed" } : {}),
    }).eq("id", goal.id);
    fetchGoals();
    if (isComplete) toast({ title: "🎉 Meta alcançada!" });
  };

  const toggleStatus = async (goal: Goal, newStatus: string) => {
    await supabase.from("goals").update({ status: newStatus }).eq("id", goal.id);
    fetchGoals();
  };

  const deleteGoal = async (id: string) => {
    await supabase.from("goals").delete().eq("id", id);
    fetchGoals();
  };

  const activeGoals = enrichedGoals.filter(g => g.status === "active");
  const pausedGoals = enrichedGoals.filter(g => g.status === "paused");
  const completedGoals = enrichedGoals.filter(g => g.status === "completed");

  const dynamicCount = enrichedGoals.filter(g => g.data_source).length;
  const manualCount = enrichedGoals.filter(g => !g.data_source).length;

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Target className="h-6 w-6 text-primary" /> Metas
            </h1>
            <p className="text-sm text-muted-foreground">Defina e acompanhe seus objetivos</p>
          </div>
          <div className="flex gap-2">
            {/* Dynamic Goal Dialog */}
            <Dialog open={dynamicDialogOpen} onOpenChange={setDynamicDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Zap className="h-4 w-4" /> Meta Dinâmica
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5" /> Nova Meta Dinâmica
                  </DialogTitle>
                </DialogHeader>
                <DynamicGoalForm
                  onSubmit={handleAddDynamic}
                  onCancel={() => setDynamicDialogOpen(false)}
                />
              </DialogContent>
            </Dialog>

            {/* Manual Goal Dialog */}
            <Dialog open={manualDialogOpen} onOpenChange={setManualDialogOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-2" /> Nova Meta</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Nova Meta Manual</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <Input placeholder="Título da meta" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
                  <Textarea placeholder="Descrição (opcional)" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
                  <Select value={form.goal_type} onValueChange={v => setForm(f => ({ ...f, goal_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="personal">Pessoal</SelectItem>
                      <SelectItem value="financial">Financeiro</SelectItem>
                      <SelectItem value="health">Saúde</SelectItem>
                      <SelectItem value="career">Carreira</SelectItem>
                      <SelectItem value="education">Educação</SelectItem>
                      <SelectItem value="other">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="grid grid-cols-2 gap-4">
                    <Input type="number" placeholder="Valor alvo (ex: 10000)" value={form.target_value} onChange={e => setForm(f => ({ ...f, target_value: e.target.value }))} />
                    <Select value={form.unit} onValueChange={v => setForm(f => ({ ...f, unit: v }))}>
                      <SelectTrigger><SelectValue placeholder="Unidade" /></SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectLabel>Monetário</SelectLabel>
                          <SelectItem value="R$">R$ (Reais)</SelectItem>
                          <SelectItem value="US$">US$ (Dólares)</SelectItem>
                        </SelectGroup>
                        <SelectGroup>
                          <SelectLabel>Proporção</SelectLabel>
                          <SelectItem value="%">% (Percentual)</SelectItem>
                        </SelectGroup>
                        <SelectGroup>
                          <SelectLabel>Quantidade</SelectLabel>
                          <SelectItem value="un">Unidades</SelectItem>
                          <SelectItem value="kg">Quilos</SelectItem>
                          <SelectItem value="km">Quilômetros</SelectItem>
                        </SelectGroup>
                        <SelectGroup>
                          <SelectLabel>Tempo</SelectLabel>
                          <SelectItem value="h">Horas</SelectItem>
                          <SelectItem value="dias">Dias</SelectItem>
                          <SelectItem value="sem">Semanas</SelectItem>
                          <SelectItem value="meses">Meses</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>
                  <Input type="date" value={form.target_date} onChange={e => setForm(f => ({ ...f, target_date: e.target.value }))} />
                  <Button className="w-full" onClick={handleAddManual}>Criar Meta</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card><CardContent className="p-3 text-center"><p className="text-2xl font-bold text-primary">{activeGoals.length}</p><p className="text-xs text-muted-foreground">Ativas</p></CardContent></Card>
          <Card><CardContent className="p-3 text-center"><p className="text-2xl font-bold text-warning">{pausedGoals.length}</p><p className="text-xs text-muted-foreground">Pausadas</p></CardContent></Card>
          <Card><CardContent className="p-3 text-center"><p className="text-2xl font-bold text-success">{completedGoals.length}</p><p className="text-xs text-muted-foreground">Concluídas</p></CardContent></Card>
          <Card><CardContent className="p-3 text-center"><p className="text-2xl font-bold text-emerald-600">{dynamicCount}</p><p className="text-xs text-muted-foreground">⚡ Dinâmicas</p></CardContent></Card>
          <Card><CardContent className="p-3 text-center"><p className="text-2xl font-bold">{manualCount}</p><p className="text-xs text-muted-foreground">Manuais</p></CardContent></Card>
        </div>

        {/* Active Goals */}
        {activeGoals.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2">
            {activeGoals.map(g => (
              <GoalCard key={g.id} goal={g} onToggleStatus={toggleStatus} onDelete={deleteGoal} onUpdateProgress={updateProgress} />
            ))}
          </div>
        )}

        {pausedGoals.length > 0 && (
          <>
            <h2 className="text-sm font-semibold text-muted-foreground mt-4">Pausadas</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {pausedGoals.map(g => (
                <GoalCard key={g.id} goal={g} onToggleStatus={toggleStatus} onDelete={deleteGoal} onUpdateProgress={updateProgress} />
              ))}
            </div>
          </>
        )}

        {completedGoals.length > 0 && (
          <>
            <h2 className="text-sm font-semibold text-muted-foreground mt-4">Concluídas</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {completedGoals.map(g => (
                <GoalCard key={g.id} goal={g} onToggleStatus={toggleStatus} onDelete={deleteGoal} onUpdateProgress={updateProgress} />
              ))}
            </div>
          </>
        )}

        {enrichedGoals.length === 0 && !loading && (
          <div className="text-center py-12 text-muted-foreground">
            <Target className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-lg font-medium">Nenhuma meta criada</p>
            <p className="text-sm">Crie metas manuais ou dinâmicas para acompanhar seus objetivos</p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
