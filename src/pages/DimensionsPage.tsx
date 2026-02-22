import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useDimensions } from "@/contexts/DimensionsContext";
import { DimensionKey, DIMENSION_LABELS } from "@/types/dimensions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CreditCard, Building2, FolderKanban, Tag, Plus, Trash2, Loader2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";

const DIMENSION_ICON_MAP: Record<DimensionKey, React.ReactNode> = {
  payment_method: <CreditCard className="h-5 w-5" />,
  account: <Building2 className="h-5 w-5" />,
  project: <FolderKanban className="h-5 w-5" />,
  tags: <Tag className="h-5 w-5" />,
};

const DIMENSION_DESCRIPTIONS: Record<DimensionKey, string> = {
  payment_method: "Controle se pagou com PIX, crédito, débito, dinheiro, etc.",
  account: "Acompanhe de qual conta ou cartão saiu/entrou o dinheiro.",
  project: "Agrupe gastos por projeto, viagem, reforma, etc.",
  tags: "Etiquetas livres para classificação flexível.",
};

export default function DimensionsPage() {
  const {
    settings, isDimensionActive, isDimensionRequired,
    toggleDimension, toggleDimensionRequired,
    paymentMethods, addPaymentMethod, updatePaymentMethod, deletePaymentMethod,
    accounts, addAccount, updateAccount, deleteAccount,
    projects, addProject, updateProject, deleteProject,
    tags, addTag, deleteTag,
    loading,
  } = useDimensions();

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  const dimensionKeys: DimensionKey[] = ["payment_method", "account", "project", "tags"];

  return (
    <AppLayout>
      <div className="mb-4">
        <h1 className="text-xl font-bold tracking-tight">Dimensões Financeiras</h1>
        <p className="text-sm text-muted-foreground">
          Personalize quais dimensões de análise deseja usar. Ative apenas o que faz sentido para você.
        </p>
      </div>

      <div className="space-y-4">
        {dimensionKeys.map(key => (
          <DimensionCard
            key={key}
            dimensionKey={key}
            isActive={isDimensionActive(key)}
            isRequired={isDimensionRequired(key)}
            onToggle={(v) => toggleDimension(key, v)}
            onToggleRequired={(v) => toggleDimensionRequired(key, v)}
          >
            {key === "payment_method" && isDimensionActive(key) && (
              <DimensionValuesList
                items={paymentMethods.map(p => ({ id: p.id, name: p.name, is_active: p.is_active, is_system: p.is_system }))}
                onAdd={addPaymentMethod}
                onToggle={(id, active) => {
                  const pm = paymentMethods.find(p => p.id === id);
                  if (pm) updatePaymentMethod(id, pm.name, active);
                }}
                onDelete={deletePaymentMethod}
                addPlaceholder="Nova forma de pagamento"
              />
            )}
            {key === "account" && isDimensionActive(key) && (
              <AccountValuesList
                items={accounts}
                onAdd={addAccount}
                onToggle={(id, active) => {
                  const acc = accounts.find(a => a.id === id);
                  if (acc) updateAccount(id, acc.name, active);
                }}
                onDelete={deleteAccount}
              />
            )}
            {key === "project" && isDimensionActive(key) && (
              <DimensionValuesList
                items={projects.map(p => ({ id: p.id, name: p.name, is_active: p.is_active }))}
                onAdd={addProject}
                onToggle={(id, active) => {
                  const proj = projects.find(p => p.id === id);
                  if (proj) updateProject(id, proj.name, active);
                }}
                onDelete={deleteProject}
                addPlaceholder="Novo projeto"
              />
            )}
            {key === "tags" && isDimensionActive(key) && (
              <TagsValuesList tags={tags} onAdd={addTag} onDelete={deleteTag} />
            )}
          </DimensionCard>
        ))}
      </div>

      <div className="mt-6 p-4 rounded-lg border border-border bg-muted/30">
        <p className="text-xs text-muted-foreground">
          💡 <strong>Categoria</strong> e <strong>Pessoa</strong> são dimensões obrigatórias e estão sempre ativas.
          As dimensões acima são opcionais e podem ser ativadas conforme sua necessidade.
        </p>
      </div>
    </AppLayout>
  );
}

// ── Sub-components ──

function DimensionCard({
  dimensionKey, isActive, isRequired, onToggle, onToggleRequired, children,
}: {
  dimensionKey: DimensionKey;
  isActive: boolean;
  isRequired: boolean;
  onToggle: (v: boolean) => void;
  onToggleRequired: (v: boolean) => void;
  children?: React.ReactNode;
}) {
  return (
    <Card className={isActive ? "border-primary/30" : "opacity-70"}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${isActive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
              {DIMENSION_ICON_MAP[dimensionKey]}
            </div>
            <div>
              <CardTitle className="text-base">{DIMENSION_LABELS[dimensionKey]}</CardTitle>
              <CardDescription className="text-xs">{DIMENSION_DESCRIPTIONS[dimensionKey]}</CardDescription>
            </div>
          </div>
          <Switch checked={isActive} onCheckedChange={onToggle} />
        </div>
        {isActive && (
          <div className="flex items-center gap-2 mt-2 ml-12">
            <Label className="text-xs text-muted-foreground">Obrigatório no lançamento</Label>
            <Switch checked={isRequired} onCheckedChange={onToggleRequired} className="scale-75" />
          </div>
        )}
      </CardHeader>
      {children && <CardContent className="pt-0">{children}</CardContent>}
    </Card>
  );
}

function DimensionValuesList({
  items, onAdd, onToggle, onDelete, addPlaceholder,
}: {
  items: { id: string; name: string; is_active: boolean; is_system?: boolean }[];
  onAdd: (name: string) => Promise<void>;
  onToggle: (id: string, active: boolean) => void;
  onDelete: (id: string) => Promise<boolean>;
  addPlaceholder: string;
}) {
  const [newName, setNewName] = useState("");

  return (
    <div className="space-y-2">
      <Separator />
      <div className="flex gap-2">
        <Input
          placeholder={addPlaceholder}
          value={newName}
          onChange={e => setNewName(e.target.value)}
          className="h-8 text-sm"
          onKeyDown={e => { if (e.key === "Enter" && newName.trim()) { onAdd(newName); setNewName(""); } }}
        />
        <Button size="sm" variant="outline" className="h-8 px-2" onClick={() => { if (newName.trim()) { onAdd(newName); setNewName(""); } }}>
          <Plus className="h-3 w-3" />
        </Button>
      </div>
      <div className="space-y-1 max-h-48 overflow-y-auto">
        {items.map(item => (
          <div key={item.id} className="flex items-center justify-between py-1 px-2 rounded hover:bg-muted/50 text-sm">
            <div className="flex items-center gap-2">
              <span className={item.is_active ? "" : "text-muted-foreground line-through"}>{item.name}</span>
              {item.is_system && <Badge variant="outline" className="text-[10px] h-4">pré-definido</Badge>}
            </div>
            <div className="flex items-center gap-1">
              <Switch checked={item.is_active} onCheckedChange={v => onToggle(item.id, v)} className="scale-75" />
              {!item.is_system && (
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive" onClick={() => onDelete(item.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AccountValuesList({
  items, onAdd, onToggle, onDelete,
}: {
  items: { id: string; name: string; is_active: boolean; account_type: string }[];
  onAdd: (name: string, type: string) => Promise<void>;
  onToggle: (id: string, active: boolean) => void;
  onDelete: (id: string) => Promise<boolean>;
}) {
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("checking");

  const typeLabels: Record<string, string> = {
    checking: "Conta Corrente",
    savings: "Poupança",
    credit_card: "Cartão de Crédito",
    investment: "Investimento",
  };

  return (
    <div className="space-y-2">
      <Separator />
      <div className="flex gap-2">
        <Input
          placeholder="Nova conta / cartão"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          className="h-8 text-sm flex-1"
        />
        <Select value={newType} onValueChange={setNewType}>
          <SelectTrigger className="h-8 text-xs w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(typeLabels).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" className="h-8 px-2" onClick={() => { if (newName.trim()) { onAdd(newName, newType); setNewName(""); } }}>
          <Plus className="h-3 w-3" />
        </Button>
      </div>
      <div className="space-y-1 max-h-48 overflow-y-auto">
        {items.map(item => (
          <div key={item.id} className="flex items-center justify-between py-1 px-2 rounded hover:bg-muted/50 text-sm">
            <div className="flex items-center gap-2">
              <span className={item.is_active ? "" : "text-muted-foreground line-through"}>{item.name}</span>
              <Badge variant="outline" className="text-[10px] h-4">{typeLabels[item.account_type] || item.account_type}</Badge>
            </div>
            <div className="flex items-center gap-1">
              <Switch checked={item.is_active} onCheckedChange={v => onToggle(item.id, v)} className="scale-75" />
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive" onClick={() => onDelete(item.id)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TagsValuesList({
  tags, onAdd, onDelete,
}: {
  tags: { id: string; name: string; color: string }[];
  onAdd: (name: string, color?: string) => Promise<void>;
  onDelete: (id: string) => Promise<boolean>;
}) {
  const [newName, setNewName] = useState("");

  return (
    <div className="space-y-2">
      <Separator />
      <div className="flex gap-2">
        <Input
          placeholder="Nova tag"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          className="h-8 text-sm"
          onKeyDown={e => { if (e.key === "Enter" && newName.trim()) { onAdd(newName); setNewName(""); } }}
        />
        <Button size="sm" variant="outline" className="h-8 px-2" onClick={() => { if (newName.trim()) { onAdd(newName); setNewName(""); } }}>
          <Plus className="h-3 w-3" />
        </Button>
      </div>
      <div className="flex flex-wrap gap-1">
        {tags.map(tag => (
          <Badge key={tag.id} variant="secondary" className="text-xs gap-1 pl-2">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: tag.color }} />
            {tag.name}
            <button onClick={() => onDelete(tag.id)} className="ml-1 hover:text-destructive">
              <Trash2 className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>
    </div>
  );
}
