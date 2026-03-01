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
import { Goal, GoalProgressMode } from "@/types/goals";
import { GoalCard } from "@/components/goals/GoalCard";
import { DynamicGoalForm } from "@/components/goals/DynamicGoalForm";
import { useDynamicGoalProgress } from "@/hooks/useDynamicGoalProgress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

export default function GoalsPage() {
  const { user } = useAuth();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [manualDialogOpen, setManualDialogOpen] = useState(false);
  const [dynamicDialogOpen, setDynamicDialogOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", goal_type: "personal", target_value: "", unit: "", target_date: "", progress_mode: "evolution" as GoalProgressMode, baseline_value: "" });
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [editForm, setEditForm] = useState({ title: "", description: "", target_value: "", current_value: "", unit: "", target_date: "", progress_mode: "evolution" as GoalProgressMode });

  const fetchGoals = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("goals").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    setGoals((data as Goal[]) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchGoals(); }, [fetchGoals]);

  // Enrich dynamic goals with real-time progress
  const enrichedGoals = useDynamicGoalProgress(goals, fetchGoals);

  const handleAddManual = async () => {
    if (!user || !form.title.trim()) return;
    const baselineVal = form.baseline_value ? Number(form.baseline_value) : null;
    const { error } = await supabase.from("goals").insert({
      user_id: user.id,
      title: form.title,
      description: form.description || null,
      goal_type: form.goal_type,
      target_value: form.target_value ? Number(form.target_value) : null,
      current_value: baselineVal,
      baseline_value: baselineVal,
      progress_mode: form.progress_mode,
      unit: form.unit || null,
      target_date: form.target_date || null,
    });
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Meta criada!" });
    setForm({ title: "", description: "", goal_type: "personal", target_value: "", unit: "", target_date: "", progress_mode: "evolution", baseline_value: "" });
    setManualDialogOpen(false);
    fetchGoals();
  };

  const startEditing = (goal: Goal) => {
    setEditingGoal(goal);
    setEditForm({
      title: goal.title,
      description: goal.description || "",
      target_value: String(goal.target_value || ""),
      current_value: String(goal.current_value || ""),
      unit: goal.unit || "",
      target_date: goal.target_date || "",
      progress_mode: goal.progress_mode || "evolution",
    });
  };

  const handleSaveEdit = async () => {
    if (!editingGoal) return;
    const val = editForm.current_value ? Number(editForm.current_value) : null;
    const targetVal = editForm.target_value ? Number(editForm.target_value) : null;
    const isComplete = targetVal != null && val != null && val >= targetVal;
    const { error } = await supabase.from("goals").update({
      title: editForm.title,
      description: editForm.description || null,
      target_value: targetVal,
      current_value: val,
      unit: editForm.unit || null,
      target_date: editForm.target_date || null,
      progress_mode: editForm.progress_mode,
      ...(isComplete ? { status: "completed" } : {}),
    }).eq("id", editingGoal.id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Meta atualizada!" });
    if (isComplete) toast({ title: "🎉 Meta alcançada!" });
    setEditingGoal(null);
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
    const isComplete = goal.target_value != null && val >= goal.target_value;
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

  // Sort by nearest deadline first, no-deadline last, then by created_at
  const sortByDeadline = (a: Goal, b: Goal) => {
    if (a.target_date && b.target_date) return a.target_date.localeCompare(b.target_date);
    if (a.target_date && !b.target_date) return -1;
    if (!a.target_date && b.target_date) return 1;
    return (a.created_at || "").localeCompare(b.created_at || "");
  };

  const activeGoals = enrichedGoals.filter(g => g.status === "active").sort(sortByDeadline);
  const pausedGoals = enrichedGoals.filter(g => g.status === "paused").sort(sortByDeadline);
  const completedGoals = enrichedGoals.filter(g => g.status === "completed").sort(sortByDeadline);

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
              <DialogContent className="max-h-[90vh] overflow-y-auto">
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
                  <div>
                    <Label className="text-xs">Valor atual / inicial (opcional)</Label>
                    <Input type="number" placeholder="Ex: 5000" value={form.baseline_value} onChange={e => setForm(f => ({ ...f, baseline_value: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-xs font-medium mb-2 block">Modo de Progresso</Label>
                    <RadioGroup value={form.progress_mode} onValueChange={v => setForm(f => ({ ...f, progress_mode: v as GoalProgressMode }))}>
                      <div className="flex items-start gap-2">
                        <RadioGroupItem value="evolution" id="manual-evolution" className="mt-0.5" />
                        <label htmlFor="manual-evolution" className="text-sm cursor-pointer">
                          <span className="font-medium">Evolutivo</span>
                          <p className="text-[10px] text-muted-foreground">Progresso = valor atual / valor alvo</p>
                        </label>
                      </div>
                      <div className="flex items-start gap-2">
                        <RadioGroupItem value="remaining" id="manual-remaining" className="mt-0.5" />
                        <label htmlFor="manual-remaining" className="text-sm cursor-pointer">
                          <span className="font-medium">Valor Restante</span>
                          <p className="text-[10px] text-muted-foreground">Mostra o crescimento desde o valor inicial até o alvo</p>
                        </label>
                      </div>
                    </RadioGroup>
                  </div>
                  <div>
                    <Label className="text-xs">Prazo (opcional)</Label>
                    <Input type="date" value={form.target_date} onChange={e => setForm(f => ({ ...f, target_date: e.target.value }))} />
                  </div>
                  <Button className="w-full" onClick={handleAddManual}>Criar Meta</Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* Edit Goal Dialog */}
            <Dialog open={!!editingGoal} onOpenChange={open => { if (!open) setEditingGoal(null); }}>
              <DialogContent className="max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Editar Meta</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <Input placeholder="Título" value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} />
                  <Textarea placeholder="Descrição (opcional)" value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} />
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs">Valor alvo</Label>
                      <Input type="number" value={editForm.target_value} onChange={e => setEditForm(f => ({ ...f, target_value: e.target.value }))} />
                    </div>
                    {!editingGoal?.data_source && (
                      <div>
                        <Label className="text-xs">Valor atual</Label>
                        <Input type="number" value={editForm.current_value} onChange={e => setEditForm(f => ({ ...f, current_value: e.target.value }))} />
                      </div>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs font-medium mb-2 block">Modo de Progresso</Label>
                    <RadioGroup value={editForm.progress_mode} onValueChange={v => setEditForm(f => ({ ...f, progress_mode: v as GoalProgressMode }))}>
                      <div className="flex items-start gap-2">
                        <RadioGroupItem value="evolution" id="edit-evolution" className="mt-0.5" />
                        <label htmlFor="edit-evolution" className="text-sm cursor-pointer">
                          <span className="font-medium">Evolutivo</span>
                        </label>
                      </div>
                      <div className="flex items-start gap-2">
                        <RadioGroupItem value="remaining" id="edit-remaining" className="mt-0.5" />
                        <label htmlFor="edit-remaining" className="text-sm cursor-pointer">
                          <span className="font-medium">Valor Restante</span>
                        </label>
                      </div>
                    </RadioGroup>
                  </div>
                  <div>
                    <Label className="text-xs">Prazo (opcional)</Label>
                    <Input type="date" value={editForm.target_date} onChange={e => setEditForm(f => ({ ...f, target_date: e.target.value }))} />
                  </div>
                  <Button className="w-full" onClick={handleSaveEdit}>Salvar Alterações</Button>
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
              <GoalCard key={g.id} goal={g} onToggleStatus={toggleStatus} onDelete={deleteGoal} onUpdateProgress={updateProgress} onEdit={startEditing} />
            ))}
          </div>
        )}

        {pausedGoals.length > 0 && (
          <>
            <h2 className="text-sm font-semibold text-muted-foreground mt-4">Pausadas</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {pausedGoals.map(g => (
                <GoalCard key={g.id} goal={g} onToggleStatus={toggleStatus} onDelete={deleteGoal} onUpdateProgress={updateProgress} onEdit={startEditing} />
              ))}
            </div>
          </>
        )}

        {completedGoals.length > 0 && (
          <>
            <h2 className="text-sm font-semibold text-muted-foreground mt-4">Concluídas</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {completedGoals.map(g => (
                <GoalCard key={g.id} goal={g} onToggleStatus={toggleStatus} onDelete={deleteGoal} onUpdateProgress={updateProgress} onEdit={startEditing} />
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
