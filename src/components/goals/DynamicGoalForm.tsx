import { useState } from "react";
import { GoalDataSource, GoalProgressMode, GoalPeriodType, dataSourceLabels } from "@/types/goals";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { useFinance } from "@/contexts/FinanceContext";
import { useAssets } from "@/contexts/AssetsContext";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

interface DynamicGoalFormProps {
  onSubmit: (data: {
    title: string;
    description: string;
    data_source: GoalDataSource;
    target_value: number;
    unit: string;
    baseline_value: number;
    progress_mode: GoalProgressMode;
    period_type: GoalPeriodType | null;
    period_start: string | null;
    period_end: string | null;
    person_ids: string[];
    target_date: string;
  }) => void;
  onCancel: () => void;
}

export function DynamicGoalForm({ onSubmit, onCancel }: DynamicGoalFormProps) {
  const { persons, transactions } = useFinance();
  const { assets } = useAssets();

  const [dataSource, setDataSource] = useState<GoalDataSource>("asset");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetValue, setTargetValue] = useState("");
  const [progressMode, setProgressMode] = useState<GoalProgressMode>("evolution");
  const [periodType, setPeriodType] = useState<GoalPeriodType>("monthly");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [selectedPersons, setSelectedPersons] = useState<string[]>([]);
  const [targetDate, setTargetDate] = useState("");

  const activePersons = persons.filter(p => p.is_active);

  // Calculate current baseline
  const getBaseline = () => {
    if (dataSource === "asset") {
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
    } else if (dataSource === "balance") {
      let filtered = [...transactions];
      if (selectedPersons.length > 0) {
        filtered = filtered.filter(t => selectedPersons.includes(t.person_id));
      }
      return filtered.reduce((sum, t) => sum + (t.type === "income" ? t.amount : -t.amount), 0);
    }
    return 0; // Income doesn't use baseline
  };

  const baseline = getBaseline();

  const handleSubmit = () => {
    if (!title.trim() || !targetValue) return;
    onSubmit({
      title,
      description,
      data_source: dataSource,
      target_value: Number(targetValue),
      unit: "R$",
      baseline_value: baseline,
      progress_mode: progressMode,
      period_type: dataSource === "income" ? periodType : null,
      period_start: dataSource === "income" && periodType === "custom" ? periodStart : null,
      period_end: dataSource === "income" && periodType === "custom" ? periodEnd : null,
      person_ids: dataSource !== "asset" ? selectedPersons : [],
      target_date: targetDate,
    });
  };

  const togglePerson = (id: string) => {
    setSelectedPersons(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
  };

  return (
    <div className="space-y-4">
      {/* Data Source Selection */}
      <div>
        <Label className="text-xs font-medium mb-2 block">Tipo de Meta Dinâmica</Label>
        <div className="grid grid-cols-3 gap-2">
          {(["asset", "income", "balance"] as GoalDataSource[]).map(ds => (
            <button
              key={ds}
              type="button"
              onClick={() => { setDataSource(ds); setSelectedPersons([]); }}
              className={cn(
                "rounded-lg border p-3 text-center text-sm font-medium transition-all",
                dataSource === ds
                  ? ds === "asset" ? "border-emerald-500 bg-emerald-500/10 text-emerald-600"
                    : ds === "income" ? "border-blue-500 bg-blue-500/10 text-blue-600"
                      : "border-violet-500 bg-violet-500/10 text-violet-600"
                  : "border-border hover:border-muted-foreground/30"
              )}
            >
              {dataSourceLabels[ds]}
            </button>
          ))}
        </div>
      </div>

      <Input placeholder="Título da meta" value={title} onChange={e => setTitle(e.target.value)} />
      <Textarea placeholder="Descrição (opcional)" value={description} onChange={e => setDescription(e.target.value)} rows={2} />

      {/* Baseline display */}
      {(dataSource === "asset" || dataSource === "balance") && (
        <div className="rounded-lg bg-muted/50 p-3">
          <p className="text-xs text-muted-foreground">
            Valor atual ({dataSource === "asset" ? "Patrimônio" : "Saldo"}):
          </p>
          <p className="text-lg font-bold">
            R$ {baseline.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
          {selectedPersons.length > 0 && dataSource === "balance" && (
            <p className="text-[10px] text-muted-foreground">
              Filtrado por {selectedPersons.length} pessoa(s)
            </p>
          )}
        </div>
      )}

      <div>
        <Label className="text-xs">Valor alvo (R$)</Label>
        <Input type="number" placeholder="Ex: 50000" value={targetValue} onChange={e => setTargetValue(e.target.value)} />
      </div>

      {/* Person filter - only for income and balance */}
      {dataSource !== "asset" && (
        <div>
          <Label className="text-xs font-medium mb-2 block">Filtro por Pessoa</Label>
          <p className="text-[10px] text-muted-foreground mb-2">
            Deixe vazio para meta global (todas as pessoas)
          </p>
          <div className="flex flex-wrap gap-1.5">
            {activePersons.map(p => (
              <Badge
                key={p.id}
                variant={selectedPersons.includes(p.id) ? "default" : "outline"}
                className="cursor-pointer text-xs"
                onClick={() => togglePerson(p.id)}
              >
                {p.name}
                {selectedPersons.includes(p.id) && <X className="h-3 w-3 ml-1" />}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Period - only for income */}
      {dataSource === "income" && (
        <div>
          <Label className="text-xs font-medium mb-2 block">Período da Meta</Label>
          <Select value={periodType} onValueChange={v => setPeriodType(v as GoalPeriodType)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">Mensal (mês atual)</SelectItem>
              <SelectItem value="yearly">Anual (ano atual)</SelectItem>
              <SelectItem value="custom">Personalizado</SelectItem>
            </SelectContent>
          </Select>
          {periodType === "custom" && (
            <div className="grid grid-cols-2 gap-2 mt-2">
              <div>
                <Label className="text-[10px]">Início</Label>
                <Input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)} />
              </div>
              <div>
                <Label className="text-[10px]">Fim</Label>
                <Input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Progress mode - for asset and balance */}
      {(dataSource === "asset" || dataSource === "balance") && (
        <div>
          <Label className="text-xs font-medium mb-2 block">Modo de Progresso</Label>
          <RadioGroup value={progressMode} onValueChange={v => setProgressMode(v as GoalProgressMode)}>
            <div className="flex items-start gap-2">
              <RadioGroupItem value="evolution" id="evolution" className="mt-0.5" />
              <label htmlFor="evolution" className="text-sm cursor-pointer">
                <span className="font-medium">Evolutivo</span>
                <p className="text-[10px] text-muted-foreground">Mostra quanto já foi conquistado do crescimento necessário</p>
              </label>
            </div>
            <div className="flex items-start gap-2">
              <RadioGroupItem value="remaining" id="remaining" className="mt-0.5" />
              <label htmlFor="remaining" className="text-sm cursor-pointer">
                <span className="font-medium">Valor Restante</span>
                <p className="text-[10px] text-muted-foreground">Começa em 0% e mostra quanto falta para atingir a meta</p>
              </label>
            </div>
          </RadioGroup>
        </div>
      )}

      <div>
        <Label className="text-xs">Prazo (opcional)</Label>
        <Input type="date" value={targetDate} onChange={e => setTargetDate(e.target.value)} />
      </div>

      <div className="flex gap-2">
        <Button className="flex-1" onClick={handleSubmit}>Criar Meta Dinâmica</Button>
        <Button variant="outline" onClick={onCancel}>Cancelar</Button>
      </div>
    </div>
  );
}
