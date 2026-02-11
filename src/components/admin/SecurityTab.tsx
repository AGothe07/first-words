import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, RefreshCw } from "lucide-react";

interface SecurityEvent {
  id: string;
  event_type: string;
  user_id: string | null;
  ip_address: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

const eventLabels: Record<string, string> = {
  user_deactivated: "Conta desativada",
  user_activated: "Conta reativada",
  user_deleted: "Conta excluída",
  token_revoked: "Token revogado",
  token_regenerated: "Token regenerado",
  api_blocked: "API bloqueada",
  ai_enabled: "IA habilitada",
  invalid_ai_code: "Código IA inválido",
  rate_limit_exceeded: "Rate limit excedido",
  invalid_user_token: "Token de usuário inválido",
  phone_ownership_transferred: "Telefone transferido",
  phone_removed: "Telefone removido",
  phone_removed_by_admin: "Telefone removido (admin)",
};

const eventSeverity: Record<string, "default" | "destructive" | "secondary"> = {
  user_deleted: "destructive",
  token_revoked: "destructive",
  api_blocked: "destructive",
  invalid_ai_code: "destructive",
  rate_limit_exceeded: "destructive",
  invalid_user_token: "destructive",
  phone_removed: "destructive",
  phone_removed_by_admin: "destructive",
  user_deactivated: "secondary",
  phone_ownership_transferred: "secondary",
  ai_enabled: "default",
  user_activated: "default",
  token_regenerated: "default",
};

export function SecurityTab() {
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("security_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    setEvents((data as any[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const fmtDt = (d: string) =>
    new Date(d).toLocaleString("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    });

  if (loading)
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg">
          Eventos de Segurança ({events.length})
        </CardTitle>
        <Button variant="outline" size="sm" onClick={fetchEvents}>
          <RefreshCw className="h-4 w-4 mr-1" /> Atualizar
        </Button>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Evento</TableHead>
              <TableHead>Usuário Alvo</TableHead>
              <TableHead>Detalhes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.map((ev) => (
              <TableRow key={ev.id}>
                <TableCell className="text-xs">{fmtDt(ev.created_at)}</TableCell>
                <TableCell>
                  <Badge
                    variant={eventSeverity[ev.event_type] || "secondary"}
                    className="text-[10px]"
                  >
                    {eventLabels[ev.event_type] || ev.event_type}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs font-mono">
                  {ev.user_id ? ev.user_id.slice(0, 8) + "..." : "—"}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                  {ev.metadata && Object.keys(ev.metadata).length > 0
                    ? JSON.stringify(ev.metadata)
                    : "—"}
                </TableCell>
              </TableRow>
            ))}
            {events.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="text-center text-muted-foreground text-sm py-4"
                >
                  Nenhum evento registrado
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
