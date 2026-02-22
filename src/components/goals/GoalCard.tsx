import { Goal, typeLabels, typeColors, dataSourceLabels, dataSourceColors, progressModeLabels } from "@/types/goals";
import { calculateDynamicProgress } from "@/hooks/useDynamicGoalProgress";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { Pause, Play, Trash2, Trophy, Zap, Users, Globe } from "lucide-react";
import { useState } from "react";
import { useFinance } from "@/contexts/FinanceContext";

interface GoalCardProps {
  goal: Goal;
  onToggleStatus: (goal: Goal, status: string) => void;
  onDelete: (id: string) => void;
  onUpdateProgress: (goal: Goal, value: number) => void;
}

export function GoalCard({ goal, onToggleStatus, onDelete, onUpdateProgress }: GoalCardProps) {
  const [editingProgress, setEditingProgress] = useState(false);
  const [progressValue, setProgressValue] = useState("");
  const { persons } = useFinance();

  const isDynamic = !!goal.data_source;
  const progress = isDynamic
    ? calculateDynamicProgress(goal)
    : goal.target_value && goal.target_value > 0
      ? Math.min(100, ((goal.current_value || 0) / goal.target_value) * 100)
      : 0;

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

  return (
    <Card className={cn(
      "transition-all hover:shadow-md",
      goal.status === "completed" && "border-success/30",
      isDynamic && "border-l-4",
      goal.data_source === "asset" && "border-l-emerald-500",
      goal.data_source === "income" && "border-l-blue-500",
      goal.data_source === "balance" && "border-l-violet-500",
    )}>
      <CardContent className="p-4">
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
              {isDynamic && goal.progress_mode && (
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
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/60 hover:text-destructive" onClick={() => onDelete(goal.id)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {goal.target_value != null && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-muted-foreground">
                {isDynamic ? (
                  <>
                    {(goal.current_value || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    {" / "}
                    {goal.target_value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    {" "}{goal.unit || ""}
                  </>
                ) : (
                  <>{goal.current_value || 0} / {goal.target_value} {goal.unit || ""}</>
                )}
              </span>
              <span className="font-medium">{progress.toFixed(0)}%</span>
            </div>
            <Progress value={progress} className={cn(
              "h-2",
              goal.data_source === "asset" && "[&>div]:bg-emerald-500",
              goal.data_source === "income" && "[&>div]:bg-blue-500",
              goal.data_source === "balance" && "[&>div]:bg-violet-500",
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
          </div>
        )}
      </CardContent>
    </Card>
  );
}
