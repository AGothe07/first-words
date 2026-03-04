import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPreferences } from "@/hooks/useUserPreferences";
import { useApplyPreferences } from "@/hooks/useApplyPreferences";
import { Palette, Sun, Moon } from "lucide-react";

interface Props {
  preferences: UserPreferences | null;
  onUpdate: (updates: Partial<UserPreferences>) => Promise<boolean | undefined>;
}

const colors = [
  { value: "#0D9488", label: "Teal", class: "bg-[#0D9488]" },
  { value: "#8B5CF6", label: "Roxo", class: "bg-[#8B5CF6]" },
  { value: "#3B82F6", label: "Azul", class: "bg-[#3B82F6]" },
  { value: "#10B981", label: "Verde", class: "bg-[#10B981]" },
  { value: "#F59E0B", label: "Âmbar", class: "bg-[#F59E0B]" },
  { value: "#EF4444", label: "Vermelho", class: "bg-[#EF4444]" },
  { value: "#EC4899", label: "Rosa", class: "bg-[#EC4899]" },
  { value: "#06B6D4", label: "Ciano", class: "bg-[#06B6D4]" },
];

export function AppearanceSection({ preferences, onUpdate }: Props) {
  // Apply preferences live as user changes them
  useApplyPreferences(preferences);

  if (!preferences) return null;

  return (
    <div className="space-y-6">
      {/* Theme */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Palette className="h-4 w-4 text-primary" /> Aparência
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-xs">Tema</Label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <button
                className={`flex items-center gap-2 p-3 rounded-lg border transition-all ${
                  preferences.theme === "light" ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:bg-muted/50"
                }`}
                onClick={() => onUpdate({ theme: "light" })}
              >
                <Sun className="h-4 w-4" />
                <span className="text-sm">Claro</span>
              </button>
              <button
                className={`flex items-center gap-2 p-3 rounded-lg border transition-all ${
                  preferences.theme === "dark" ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:bg-muted/50"
                }`}
                onClick={() => onUpdate({ theme: "dark" })}
              >
                <Moon className="h-4 w-4" />
                <span className="text-sm">Escuro</span>
              </button>
            </div>
          </div>

          <div>
            <Label className="text-xs">Cor principal</Label>
            <div className="flex gap-2 mt-1">
              {colors.map(c => (
                <button
                  key={c.value}
                  className={`w-8 h-8 rounded-full transition-all ${c.class} ${
                    preferences.primary_color === c.value ? "ring-2 ring-offset-2 ring-primary scale-110" : "hover:scale-105"
                  }`}
                  onClick={() => onUpdate({ primary_color: c.value })}
                  title={c.label}
                />
              ))}
            </div>
          </div>

          <div>
            <Label className="text-xs">Tamanho da fonte</Label>
            <Select value={preferences.font_size} onValueChange={v => onUpdate({ font_size: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="small">Pequena</SelectItem>
                <SelectItem value="medium">Média</SelectItem>
                <SelectItem value="large">Grande</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs">Densidade do layout</Label>
            <Select value={preferences.layout_density} onValueChange={v => onUpdate({ layout_density: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="compact">Compacto</SelectItem>
                <SelectItem value="comfortable">Confortável</SelectItem>
                <SelectItem value="spacious">Espaçado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
