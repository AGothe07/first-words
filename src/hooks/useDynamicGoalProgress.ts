import { useMemo, useEffect, useRef } from "react";
import { Goal } from "@/types/goals";
import { useAssets } from "@/contexts/AssetsContext";
import { useFinance } from "@/contexts/FinanceContext";
import { supabase } from "@/integrations/supabase/client";
import { parseISO, startOfMonth, endOfMonth, startOfYear, endOfYear, isWithinInterval } from "date-fns";

export function useDynamicGoalProgress(goals: Goal[], onGoalCompleted?: () => void) {
  const { assets } = useAssets();
  const { transactions } = useFinance();
  const completedRef = useRef<Set<string>>(new Set());

  const currentAssetTotal = useMemo(() => {
    const latestByCategory = new Map<string, number>();
    const sorted = [...assets].sort((a, b) => b.date.localeCompare(a.date));
    for (const a of sorted) {
      if (!latestByCategory.has(a.category)) {
        latestByCategory.set(a.category, a.value);
      }
    }
    let total = 0;
    for (const v of latestByCategory.values()) total += v;
    return total;
  }, [assets]);

  const enrichedGoals = useMemo(() => {
    return goals.map((goal) => {
      if (!goal.data_source) return goal;

      let currentValue = 0;

      if (goal.data_source === "asset") {
        currentValue = currentAssetTotal;
      } else if (goal.data_source === "income") {
        const personFilter = goal.person_ids && goal.person_ids.length > 0 ? goal.person_ids : null;
        let filtered = transactions.filter((t) => t.type === "income");
        if (personFilter) {
          filtered = filtered.filter((t) => personFilter.includes(t.person_id));
        }
        if (goal.period_type === "monthly") {
          const now = new Date();
          const monthStart = startOfMonth(now);
          const monthEnd = endOfMonth(now);
          filtered = filtered.filter((t) => {
            const d = parseISO(t.date);
            return isWithinInterval(d, { start: monthStart, end: monthEnd });
          });
        } else if (goal.period_type === "yearly") {
          const now = new Date();
          const yearStart = startOfYear(now);
          const yearEnd = endOfYear(now);
          filtered = filtered.filter((t) => {
            const d = parseISO(t.date);
            return isWithinInterval(d, { start: yearStart, end: yearEnd });
          });
        } else if (goal.period_type === "custom" && goal.period_start && goal.period_end) {
          const start = parseISO(goal.period_start);
          const end = parseISO(goal.period_end);
          filtered = filtered.filter((t) => {
            const d = parseISO(t.date);
            return isWithinInterval(d, { start, end });
          });
        }
        currentValue = filtered.reduce((sum, t) => sum + t.amount, 0);
      } else if (goal.data_source === "balance") {
        const personFilter = goal.person_ids && goal.person_ids.length > 0 ? goal.person_ids : null;
        let filtered = [...transactions];
        if (personFilter) {
          filtered = filtered.filter((t) => personFilter.includes(t.person_id));
        }
        currentValue = filtered.reduce((sum, t) => {
          return sum + (t.type === "income" ? t.amount : -t.amount);
        }, 0);
      }

      // Auto-detect completion
      const isCompleted = goal.target_value != null && currentValue >= goal.target_value;
      return {
        ...goal,
        current_value: currentValue,
        status: isCompleted && goal.status === "active" ? "completed" : goal.status,
      };
    });
  }, [goals, currentAssetTotal, transactions]);

  // Persist auto-completion to DB
  useEffect(() => {
    for (const goal of enrichedGoals) {
      if (
        goal.data_source &&
        goal.status === "completed" &&
        goals.find(g => g.id === goal.id)?.status === "active" &&
        !completedRef.current.has(goal.id)
      ) {
        completedRef.current.add(goal.id);
        supabase.from("goals").update({ status: "completed", current_value: goal.current_value }).eq("id", goal.id).then(() => {
          onGoalCompleted?.();
        });
      }
    }
  }, [enrichedGoals, goals, onGoalCompleted]);

  return enrichedGoals;
}

export function calculateDynamicProgress(goal: Goal): number {
  if (!goal.data_source || !goal.target_value) return 0;

  const current = goal.current_value || 0;
  const baseline = goal.baseline_value || 0;
  const target = goal.target_value;

  if (goal.data_source === "income") {
    // Income goals: progress is simply current/target
    return Math.min(100, (current / target) * 100);
  }

  if (goal.progress_mode === "remaining") {
    // Mode 2: progress based on growth from baseline
    const growthNeeded = target - baseline;
    if (growthNeeded <= 0) return current >= target ? 100 : 0;
    const growthAchieved = current - baseline;
    return Math.max(0, Math.min(100, (growthAchieved / growthNeeded) * 100));
  }

  // Mode 1 (evolution): progress is current / target directly
  return Math.max(0, Math.min(100, (current / target) * 100));
}
