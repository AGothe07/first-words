import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Settings2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getFieldsForFunction, type PayloadFieldOption } from "./webhook-fields-config";

interface WebhookConfig {
  id: string;
  function_key: string | null;
  payload_fields: Record<string, boolean>;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: WebhookConfig | null;
  functionLabel: string;
  onSaved: () => void;
}

export function WebhookFieldsDialog({ open, onOpenChange, config, functionLabel, onSaved }: Props) {
  const [fields, setFields] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [availableFields, setAvailableFields] = useState<PayloadFieldOption[]>([]);

  useEffect(() => {
    if (config) {
      const available = getFieldsForFunction(config.function_key);
      setAvailableFields(available);
      
      // Initialize with existing config or all enabled by default
      const initial: Record<string, boolean> = {};
      const existing = config.payload_fields || {};
      const hasExisting = Object.keys(existing).length > 0;
      
      for (const f of available) {
        initial[f.key] = hasExisting ? (existing[f.key] ?? true) : true;
      }
      setFields(initial);
    }
  }, [config]);

  const toggle = (key: string) => {
    setFields(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const enabledCount = Object.values(fields).filter(Boolean).length;

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    const { error } = await supabase
      .from("webhook_configs")
      .update({ payload_fields: fields } as any)
      .eq("id", config.id);
    if (error) toast.error("Erro ao salvar campos");
    else toast.success("Campos do payload atualizados");
    setSaving(false);
    onOpenChange(false);
    onSaved();
  };

  if (!config || availableFields.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-primary" />
            Variáveis do Payload
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {functionLabel}
          </p>
        </DialogHeader>

        <div className="space-y-1">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-muted-foreground">
              {enabledCount} de {availableFields.length} ativas
            </span>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-6 text-[10px]"
                onClick={() => {
                  const all: Record<string, boolean> = {};
                  availableFields.forEach(f => all[f.key] = true);
                  setFields(all);
                }}
              >
                Marcar todas
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-6 text-[10px]"
                onClick={() => {
                  const none: Record<string, boolean> = {};
                  availableFields.forEach(f => none[f.key] = false);
                  setFields(none);
                }}
              >
                Desmarcar todas
              </Button>
            </div>
          </div>

          {availableFields.map((field) => (
            <div
              key={field.key}
              className="flex items-center justify-between p-2.5 rounded-md border bg-card hover:bg-accent/30 transition-colors"
            >
              <div className="flex-1 min-w-0 mr-3">
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-medium cursor-pointer" htmlFor={`field-${field.key}`}>
                    {field.label}
                  </Label>
                  <Badge variant="outline" className="text-[9px] font-mono px-1.5 py-0">
                    {field.key}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{field.description}</p>
              </div>
              <Switch
                id={`field-${field.key}`}
                checked={fields[field.key] ?? true}
                onCheckedChange={() => toggle(field.key)}
              />
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
