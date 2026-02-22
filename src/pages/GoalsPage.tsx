import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/hooks/use-toast";
import { format, parseISO, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, Target, Trash2, Pause, Play, CheckCircle2, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

type Goal = {
  id: string;
  title: string;
  description: string | null;
  goal_type: string;
  target_value: number | null;
  current_value: number | null;
  unit: string | null;
  start_date: string;
  target_date: string | null;
  status: string;
  priority: string;
  color: string | null;
};

const typeLabels: Record<string, string> = {
  personal: "Pessoal", financial: "Financeiro", health: "Saúde",
  career: "Carreira", education: "Educação", other: "Outro",
};

const typeColors: Record<string, string> = {
  personal: "bg-primary/10 text-primary", financial: "bg-success/10 text-success",
  health: "bg-warning/10 text-warning", career: "bg-accent text-accent-foreground",
  education: "bg-secondary text-secondary-foreground", other: "bg-muted text-muted-foreground",
};

export default function GoalsPage() {
  const { user } = useAuth();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", goal_type: "personal", target_value: "", unit: "", target_date: "" });
  const [editingProgress, setEditingProgress] = useState<string | null>(null);
  const [progressValue, setProgressValue] = useState("");

  const fetchGoals = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("goals").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    setGoals((data as Goal[]) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchGoals(); }, [fetchGoals]);

  const handleAdd = async () => {
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
    setDialogOpen(false);
    fetchGoals();
  };

  const updateProgress = async (goal: Goal) => {
    const val = Number(progressValue);
    if (isNaN(val)) return;
    const isComplete = goal.target_value && val >= goal.target_value;
    await supabase.from("goals").update({
      current_value: val,
      ...(isComplete ? { status: "completed" } : {}),
    }).eq("id", goal.id);
    setEditingProgress(null);
    setProgressValue("");
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

  const activeGoals = goals.filter(g => g.status === "active");
  const pausedGoals = goals.filter(g => g.status === "paused");
  const completedGoals = goals.filter(g => g.status === "completed");

  const getProgress = (g: Goal) => g.target_value && g.target_value > 0 ? Math.min(100, ((g.current_value || 0) / g.target_value) * 100) : 0;

  const renderGoal = (goal: Goal) => {
    const progress = getProgress(goal);
    return (
      <Card key={goal.id} className={cn("transition-all hover:shadow-md", goal.status === "completed" && "border-success/30")}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className={cn("font-semibold text-sm", goal.status === "completed" && "line-through text-muted-foreground")}>{goal.title}</h3>
                {goal.status === "completed" && <Trophy className="h-4 w-4 text-warning" />}
              </div>
              {goal.description && <p className="text-xs text-muted-foreground mb-2">{goal.description}</p>}
              <div className="flex items-center gap-2">
                <Badge className={cn("text-[10px]", typeColors[goal.goal_type])}>{typeLabels[goal.goal_type]}</Badge>
                {goal.target_date && (
                  <span className="text-[10px] text-muted-foreground">Prazo: {format(parseISO(goal.target_date), "dd/MM/yyyy")}</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1">
              {goal.status === "active" && (
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleStatus(goal, "paused")}><Pause className="h-3.5 w-3.5" /></Button>
              )}
              {goal.status === "paused" && (
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleStatus(goal, "active")}><Play className="h-3.5 w-3.5" /></Button>
              )}
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/60 hover:text-destructive" onClick={() => deleteGoal(goal.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
          </div>

          {goal.target_value && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-muted-foreground">{goal.current_value || 0} / {goal.target_value} {goal.unit || ""}</span>
                <span className="font-medium">{progress.toFixed(0)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
              {goal.status === "active" && editingProgress === goal.id ? (
                <div className="flex gap-2 mt-2">
                  <Input type="number" placeholder="Novo valor" value={progressValue} onChange={e => setProgressValue(e.target.value)} className="h-8 text-sm" />
                  <Button size="sm" className="h-8" onClick={() => updateProgress(goal)}>Salvar</Button>
                </div>
              ) : goal.status === "active" && (
                <Button variant="outline" size="sm" className="mt-2 h-7 text-xs" onClick={() => { setEditingProgress(goal.id); setProgressValue(String(goal.current_value || 0)); }}>
                  Atualizar Progresso
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><Target className="h-6 w-6 text-primary" /> Metas</h1>
            <p className="text-sm text-muted-foreground">Defina e acompanhe seus objetivos</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" /> Nova Meta</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nova Meta</DialogTitle></DialogHeader>
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
                <Button className="w-full" onClick={handleAdd}>Criar Meta</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card><CardContent className="p-3 text-center"><p className="text-2xl font-bold text-primary">{activeGoals.length}</p><p className="text-xs text-muted-foreground">Ativas</p></CardContent></Card>
          <Card><CardContent className="p-3 text-center"><p className="text-2xl font-bold text-warning">{pausedGoals.length}</p><p className="text-xs text-muted-foreground">Pausadas</p></CardContent></Card>
          <Card><CardContent className="p-3 text-center"><p className="text-2xl font-bold text-success">{completedGoals.length}</p><p className="text-xs text-muted-foreground">Concluídas</p></CardContent></Card>
          <Card><CardContent className="p-3 text-center"><p className="text-2xl font-bold">{goals.length}</p><p className="text-xs text-muted-foreground">Total</p></CardContent></Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {activeGoals.map(renderGoal)}
        </div>
        {pausedGoals.length > 0 && (
          <>
            <h2 className="text-sm font-semibold text-muted-foreground mt-4">Pausadas</h2>
            <div className="grid gap-4 md:grid-cols-2">{pausedGoals.map(renderGoal)}</div>
          </>
        )}
        {completedGoals.length > 0 && (
          <>
            <h2 className="text-sm font-semibold text-muted-foreground mt-4">Concluídas</h2>
            <div className="grid gap-4 md:grid-cols-2">{completedGoals.map(renderGoal)}</div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
