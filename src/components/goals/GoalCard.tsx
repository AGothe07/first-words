import { Goal, typeLabels, typeColors, dataSourceLabels, dataSourceColors, progressModeLabels } from "@/types/goals";
import { calculateDynamicProgress } from "@/hooks/useDynamicGoalProgress";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { format, parseISO, differenceInMonths, differenceInDays } from "date-fns";
import { Pause, Play, Trash2, Trophy, Zap, Users, Globe, Pencil, Calculator } from "lucide-react";
import { useState } from "react";
import { useFinance } from "@/contexts/FinanceContext";

interface GoalCardProps {
  goal: Goal;
  onToggleStatus: (goal: Goal, status: string) => void;
  onDelete: (id: string) => void;
  onUpdateProgress: (goal: Goal, value: number) => void;
  onEdit: (goal: Goal) => void;
}

export function GoalCard({ goal, onToggleStatus, onDelete, onUpdateProgress, onEdit }: GoalCardProps) {
  const [editingProgress, setEditingProgress] = useState(false);
  const [progressValue, setProgressValue] = useState("");
  const { persons } = useFinance();

  const isDynamic = !!goal.data_source;
  const hasProgressMode = !!goal.progress_mode;
  const progress = isDynamic
    ? calculateDynamicProgress(goal)
    : hasProgressMode && goal.progress_mode === "remaining" && goal.baseline_value != null && goal.target_value
      ? (() => {
          const growthNeeded = goal.target_value - goal.baseline_value;
          if (growthNeeded <= 0) return (goal.current_value || 0) >= goal.target_value ? 100 : 0;
          const growthAchieved = (goal.current_value || 0) - goal.baseline_value;
          return Math.max(0, Math.min(100, (growthAchieved / growthNeeded) * 100));
        })()
      : hasProgressMode && goal.progress_mode === "evolution" && goal.target_value && goal.target_value > 0
        ? Math.min(100, ((goal.current_value || 0) / goal.target_value) * 100)
        : goal.target_value && goal.target_value > 0
          ? Math.min(100, ((goal.current_value || 0) / goal.target_value) * 100)
          : 0;

  // "Valor Restante" detailed metrics
  const isRemainingMode = (isDynamic || hasProgressMode) && goal.progress_mode === "remaining";
  const baseline = goal.baseline_value || 0;
  const target = goal.target_value || 0;
  const current = goal.current_value || 0;
  const growthNeeded = target - baseline;
  const growthAchieved = current - baseline;
  const remaining = Math.max(0, growthNeeded - growthAchieved);
  const exceeded = current > target;
  const exceededAmount = exceeded ? current - target : 0;

  // Determine if this goal uses monetary units
  const monetaryUnits = ["R$", "US$", "€", "$"];
  const unit = goal.unit || "";
  const isMonetary = monetaryUnits.includes(unit) || (isDynamic && !unit);

  const formatValue = (val: number) => {
    if (isMonetary) {
      return `R$ ${val.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
    }
    return `${val.toLocaleString("pt-BR", { minimumFractionDigits: unit === "%" ? 1 : 0 })} ${unit}`;
  };

  const personNames = goal.person_ids?.length
    ? goal.person_ids.map(pid => persons.find(p => p.id === pid)?.name || "?").join(", ")
    : null;

  const handleSaveProgress = () => {
    const val = Number(progressValue);
    if (!isNaN(val)) {
      onUpdateProgress(goal, val);
      setEditingProgress(false);
      setProgressValue("");
    }
  };

  const isCompleted = goal.status === "completed";

  return (
    <Card className={cn(
      "transition-all hover:shadow-md relative overflow-hidden",
      isCompleted && "bg-success/5 border-success/40 ring-1 ring-success/20",
      !isCompleted && isDynamic && "border-l-4",
      !isCompleted && goal.data_source === "asset" && "border-l-emerald-500",
      !isCompleted && goal.data_source === "income" && "border-l-blue-500",
      !isCompleted && goal.data_source === "balance" && "border-l-violet-500",
    )}>
      {isCompleted && (
        <div className="absolute top-0 right-0 bg-success text-success-foreground text-[10px] font-bold px-2 py-0.5 rounded-bl-md flex items-center gap-1">
          <Trophy className="h-3 w-3" /> Concluída
        </div>
      )}
      <CardContent className={cn("p-4", isCompleted && "opacity-80")}>
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h3 className={cn("font-semibold text-sm", goal.status === "completed" && "line-through text-muted-foreground")}>
                {goal.title}
              </h3>
              {goal.status === "completed" && <Trophy className="h-4 w-4 text-warning" />}
              {isDynamic && (
                <Badge variant="outline" className={cn("text-[10px] gap-1 border", dataSourceColors[goal.data_source!])}>
                  <Zap className="h-3 w-3" />
                  {dataSourceLabels[goal.data_source!]}
                </Badge>
              )}
            </div>
            {goal.description && <p className="text-xs text-muted-foreground mb-2">{goal.description}</p>}
            <div className="flex items-center gap-2 flex-wrap">
              {!isDynamic && (
                <Badge className={cn("text-[10px]", typeColors[goal.goal_type])}>
                  {typeLabels[goal.goal_type]}
                </Badge>
              )}
              {goal.target_date && (
                <span className="text-[10px] text-muted-foreground">
                  Prazo: {format(parseISO(goal.target_date), "dd/MM/yyyy")}
                </span>
              )}
              {goal.progress_mode && (
                <span className="text-[10px] text-muted-foreground italic">
                  {progressModeLabels[goal.progress_mode]}
                </span>
              )}
              {personNames ? (
                <Badge variant="outline" className="text-[10px] gap-1">
                  <Users className="h-3 w-3" />
                  {personNames}
                </Badge>
              ) : isDynamic && goal.data_source !== "asset" && (
                <Badge variant="outline" className="text-[10px] gap-1">
                  <Globe className="h-3 w-3" />
                  Global
                </Badge>
              )}
              {isDynamic && goal.period_type && (
                <span className="text-[10px] text-muted-foreground">
                  {goal.period_type === "monthly" ? "Mensal" : goal.period_type === "yearly" ? "Anual" : "Personalizado"}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(goal)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            {goal.status === "active" && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onToggleStatus(goal, "paused")}>
                <Pause className="h-3.5 w-3.5" />
              </Button>
            )}
            {goal.status === "paused" && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onToggleStatus(goal, "active")}>
                <Play className="h-3.5 w-3.5" />
              </Button>
            )}
            {goal.status === "completed" && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onToggleStatus(goal, "active")} title="Reativar meta">
                <Play className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/60 hover:text-destructive" onClick={() => onDelete(goal.id)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {goal.target_value != null && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-muted-foreground">
                {formatValue(goal.current_value || 0)} / {formatValue(goal.target_value)}
              </span>
              <span className="font-medium">{progress.toFixed(0)}%</span>
            </div>
            <Progress value={progress} className={cn(
              "h-2",
              isCompleted && "[&>div]:bg-success",
              !isCompleted && goal.data_source === "asset" && "[&>div]:bg-emerald-500",
              !isCompleted && goal.data_source === "income" && "[&>div]:bg-blue-500",
              !isCompleted && goal.data_source === "balance" && "[&>div]:bg-violet-500",
            )} />
            {/* Only allow manual progress update for non-dynamic goals */}
            {!isDynamic && goal.status === "active" && editingProgress ? (
              <div className="flex gap-2 mt-2">
                <Input type="number" placeholder="Novo valor" value={progressValue} onChange={e => setProgressValue(e.target.value)} className="h-8 text-sm" />
                <Button size="sm" className="h-8" onClick={handleSaveProgress}>Salvar</Button>
              </div>
            ) : !isDynamic && goal.status === "active" && (
              <Button variant="outline" size="sm" className="mt-2 h-7 text-xs" onClick={() => {
                setEditingProgress(true);
                setProgressValue(String(goal.current_value || 0));
              }}>
                Atualizar Progresso
              </Button>
            )}
            {isDynamic && goal.status === "active" && (
              <p className="text-[10px] text-muted-foreground mt-1 italic">
                ⚡ Atualizado automaticamente
              </p>
            )}
            {/* Smart projection: how much to save per month */}
            {goal.status === "active" && goal.target_value != null && goal.target_date && (goal.current_value || 0) < goal.target_value && (() => {
              const remainingValue = goal.target_value - (goal.current_value || 0);
              const today = new Date();
              const targetDate = parseISO(goal.target_date);
              const monthsLeft = Math.max(1, differenceInMonths(targetDate, today) + (differenceInDays(targetDate, today) % 30 > 0 ? 1 : 0));
              const monthlyNeeded = remainingValue / monthsLeft;
              return (
                <div className="mt-2 rounded-lg bg-primary/5 border border-primary/15 p-2.5 space-y-1">
                  <div className="flex items-center gap-1.5 text-[11px] font-medium text-primary">
                    <Calculator className="h-3 w-3" />
                    Projeção Inteligente
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-muted-foreground">Falta:</span>
                    <span className="font-medium">{formatValue(remainingValue)}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-muted-foreground">Meses restantes:</span>
                    <span className="font-medium">{monthsLeft}</span>
                  </div>
                  <div className="flex justify-between text-[11px] pt-1 border-t border-primary/10">
                    <span className="text-muted-foreground">Guardar por mês:</span>
                    <span className="font-bold text-primary">{formatValue(monthlyNeeded)}</span>
                  </div>
                </div>
              );
            })()}
            {/* Detailed breakdown for "Valor Restante" mode */}
            {isRemainingMode && growthNeeded > 0 && (
              <div className="mt-2 rounded-lg bg-muted/50 p-2.5 space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-muted-foreground">Crescimento necessário:</span>
                  <span className="font-medium">{formatValue(growthNeeded)}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-muted-foreground">Já conquistado:</span>
                  <span className="font-medium text-emerald-600">{formatValue(Math.max(0, growthAchieved))}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-muted-foreground">Ainda falta:</span>
                  <span className="font-medium text-orange-600">{formatValue(remaining)}</span>
                </div>
                {exceeded && (
                  <div className="flex justify-between text-[11px] pt-1 border-t border-border/50">
                    <span className="text-muted-foreground">🎉 Meta superada por:</span>
                    <span className="font-bold text-emerald-600">{formatValue(exceededAmount)}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
