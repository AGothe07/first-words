import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import {
  Loader2, Smartphone, Wifi, WifiOff, QrCode, Plus, Unplug,
  RefreshCw, Clock, CheckCircle2, Timer,
} from "lucide-react";

const QR_EXPIRY_SECONDS = 60 * 60; // 60 minutes
const POLL_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

// Webhook URL keys mapped to function_key in webhook_configs
type WebhookUrls = {
  whatsapp_status: string | null;
  whatsapp_create: string | null;
  whatsapp_connect: string | null;
  whatsapp_disconnect: string | null;
};

type Instance = {
  id: string;
  user_id: string;
  token: string;
  instance_name: string | null;
  status: string;
};

type ConnectionStatus = "none" | "disconnected" | "connecting" | "connected";

export default function WhatsAppTab() {
  const { user } = useAuth();
  const [instance, setInstance] = useState<Instance | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("none");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [instanceName, setInstanceName] = useState("");
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [nameError, setNameError] = useState("");
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null);
  const [qrSecondsLeft, setQrSecondsLeft] = useState(QR_EXPIRY_SECONDS);
  const [qrExpired, setQrExpired] = useState(false);
  const [connectedPhone, setConnectedPhone] = useState<string | null>(null);
  const [webhookUrls, setWebhookUrls] = useState<WebhookUrls>({
    whatsapp_status: null,
    whatsapp_create: null,
    whatsapp_connect: null,
    whatsapp_disconnect: null,
  });

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const instanceRef = useRef<Instance | null>(null);

  useEffect(() => { instanceRef.current = instance; }, [instance]);

  // --- Load webhook URLs from DB ---
  useEffect(() => {
    const loadUrls = async () => {
      const { data } = await supabase
        .from("webhook_configs")
        .select("function_key, url")
        .in("function_key", ["whatsapp_status", "whatsapp_create", "whatsapp_connect", "whatsapp_disconnect"])
        .eq("is_active", true);
      if (data) {
        const urls: WebhookUrls = { whatsapp_status: null, whatsapp_create: null, whatsapp_connect: null, whatsapp_disconnect: null };
        for (const row of data as any[]) {
          if (row.function_key in urls) (urls as any)[row.function_key] = row.url;
        }
        setWebhookUrls(urls);
      }
    };
    loadUrls();
  }, []);

  // --- Status check via webhook ---
  const checkStatus = useCallback(async (token: string, silent = false) => {
    if (!silent) setCheckingStatus(true);
    try {
      if (!webhookUrls.whatsapp_status) return;
      const res = await fetch(webhookUrls.whatsapp_status, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      const now = new Date();
      setLastCheckedAt(now);

      const isConnected = data.connected === true || data.status === "connected";

      if (isConnected) {
        setStatus("connected");
        setQrCode(null);
        setQrExpired(false);
        stopQrTimer();
        const phone = data.instance?.phone || null;
        setConnectedPhone(phone);
        await supabase.from("whatsapp_instances").update({ status: "connected" } as any).eq("token", token);
        if (!silent) toast({ title: "WhatsApp conectado ✅" });
      } else {
        setStatus(prev => prev === "connecting" ? "connecting" : "disconnected");
        setConnectedPhone(null);
        await supabase.from("whatsapp_instances").update({ status: "disconnected" } as any).eq("token", token);
        if (!silent) toast({ title: "WhatsApp ainda desconectado", variant: "destructive" });
      }
    } catch {
      if (!silent) toast({ title: "Erro ao verificar status", variant: "destructive" });
    }
    if (!silent) setCheckingStatus(false);
  }, []);

  // --- Polling logic ---
  const startPolling = useCallback((token: string) => {
    stopPolling();
    pollRef.current = setInterval(() => {
      checkStatus(token, true);
    }, POLL_INTERVAL_MS);
  }, [checkStatus]);

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };

  // --- QR Timer ---
  const startQrTimer = () => {
    stopQrTimer();
    setQrSecondsLeft(QR_EXPIRY_SECONDS);
    setQrExpired(false);
    timerRef.current = setInterval(() => {
      setQrSecondsLeft(prev => {
        if (prev <= 1) {
          stopQrTimer();
          setQrExpired(true);
          setQrCode(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const stopQrTimer = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  };

  // Auto-manage polling based on status
  useEffect(() => {
    if ((status === "disconnected" || status === "connecting") && instance?.token) {
      startPolling(instance.token);
    } else {
      stopPolling();
    }
    return () => stopPolling();
  }, [status, instance?.token, startPolling]);

  // Cleanup on unmount
  useEffect(() => {
    return () => { stopPolling(); stopQrTimer(); };
  }, []);

  // --- Fetch instance on mount ---
  const fetchInstance = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("whatsapp_instances")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (data) {
      const inst = data as Instance;
      setInstance(inst);
      await checkStatus(inst.token, true);
    } else {
      setInstance(null);
      setStatus("none");
    }
    setLoading(false);
  }, [user, checkStatus]);

  useEffect(() => { fetchInstance(); }, [fetchInstance]);

  // --- Validate instance name ---
  const validateName = (name: string) => {
    if (!name) { setNameError("Nome obrigatório"); return false; }
    if (!/^[A-Za-z]+$/.test(name)) { setNameError("Apenas letras (A-Z), sem espaços"); return false; }
    setNameError("");
    return true;
  };

  // --- Create instance ---
  const handleCreateInstance = async () => {
    if (!user) return;
    setActionLoading(true);
    try {
      if (!webhookUrls.whatsapp_create) { toast({ title: "URL do webhook não configurada", variant: "destructive" }); setActionLoading(false); return; }
      const res = await fetch(webhookUrls.whatsapp_create, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user.id }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast({ title: "Erro", description: err.error || "Erro ao criar instância", variant: "destructive" });
        setActionLoading(false);
        return;
      }
      const data = await res.json();
      if (!data.success || !data.token) {
        toast({ title: "Erro", description: data.error || "Resposta inesperada", variant: "destructive" });
        setActionLoading(false);
        return;
      }
      await supabase.from("whatsapp_instances").insert({
        user_id: user.id,
        token: data.token,
        status: "disconnected",
      });
      toast({ title: "Instância criada com sucesso!" });
      await fetchInstance();
    } catch {
      toast({ title: "Erro de conexão", variant: "destructive" });
    }
    setActionLoading(false);
  };

  // --- Connect (generate QR) ---
  const handleConnect = async () => {
    if (!instance || !validateName(instanceName)) return;
    setActionLoading(true);
    setQrCode(null);
    setQrExpired(false);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);
      if (!webhookUrls.whatsapp_connect) { toast({ title: "URL do webhook não configurada", variant: "destructive" }); setActionLoading(false); return; }
      const res = await fetch(webhookUrls.whatsapp_connect, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: instance.token, instance_name: instanceName }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!res.ok) {
        let errMsg = "Erro ao conectar";
        try { const err = await res.json(); if (err?.error) errMsg = err.error; } catch {}
        toast({ title: "Erro", description: errMsg, variant: "destructive" });
        setActionLoading(false);
        return;
      }
      const contentType = res.headers.get("content-type") || "";
      let qr: string | null = null;
      if (contentType.includes("image") || contentType.includes("octet-stream")) {
        const blob = await res.blob();
        const reader = new FileReader();
        qr = await new Promise<string>((resolve, reject) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } else {
        const data = await res.json();
        const raw = data.qrcode_base64 || data.qrcode || data.qr;
        if (raw) qr = raw.startsWith("data:") ? raw : `data:image/png;base64,${raw}`;
      }
      if (qr) {
        setQrCode(qr);
        setStatus("connecting");
        startQrTimer();
        await supabase.from("whatsapp_instances").update({ instance_name: instanceName, status: "connecting" } as any).eq("id", instance.id);
      } else {
        toast({ title: "Erro", description: "Não foi possível gerar o QR Code", variant: "destructive" });
      }
    } catch (err: any) {
      if (err?.name === "AbortError") {
        toast({ title: "Tempo esgotado", variant: "destructive" });
      } else {
        toast({ title: "Erro de conexão", variant: "destructive" });
      }
    }
    setActionLoading(false);
  };

  // --- Disconnect ---
  const handleDisconnect = async () => {
    if (!instance) return;
    setActionLoading(true);
    try {
      if (!webhookUrls.whatsapp_disconnect) { toast({ title: "URL do webhook não configurada", variant: "destructive" }); setActionLoading(false); return; }
      const res = await fetch(webhookUrls.whatsapp_disconnect, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: instance.token }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast({ title: "Erro", description: err.error || "Erro ao desconectar", variant: "destructive" });
        setActionLoading(false);
        return;
      }
      setStatus("disconnected");
      setQrCode(null);
      stopQrTimer();
      await supabase.from("whatsapp_instances").update({ status: "disconnected" } as any).eq("id", instance.id);
      toast({ title: "WhatsApp desconectado" });
    } catch {
      toast({ title: "Erro de conexão", variant: "destructive" });
    }
    setActionLoading(false);
  };

  // --- Format timer ---
  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const formatDateTime = (d: Date) =>
    d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  // ==================== CONNECTED STATE ====================
  if (status === "connected") {
    return (
      <Card className="border-green-500/40">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-primary" /> Conexão WhatsApp
            </CardTitle>
            <Badge className="gap-1 bg-green-600 text-white">
              <CheckCircle2 className="h-3 w-3" /> Conectado
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 rounded-lg border border-green-500/30 bg-green-500/5 flex items-center gap-3">
            <Wifi className="h-6 w-6 text-green-500 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold">WhatsApp conectado e ativo</p>
              {connectedPhone && (
                <p className="text-xs text-muted-foreground">Número: +{connectedPhone}</p>
              )}
              {instance?.instance_name && (
                <p className="text-xs text-muted-foreground">Instância: {instance.instance_name}</p>
              )}
            </div>
          </div>

          {lastCheckedAt && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              Última verificação: {formatDateTime(lastCheckedAt)}
            </div>
          )}

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => instance && checkStatus(instance.token)}
              disabled={checkingStatus}
              className="gap-2"
            >
              {checkingStatus ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Verificar Status
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDisconnect}
              disabled={actionLoading}
              className="gap-2"
            >
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unplug className="h-4 w-4" />}
              Desconectar
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ==================== NO INSTANCE STATE ====================
  if (status === "none") {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-primary" /> Conexão WhatsApp
            </CardTitle>
            <Badge variant="outline">Sem instância</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center space-y-3 py-4">
            <p className="text-sm text-muted-foreground">
              Para enviar notificações via WhatsApp, crie sua instância de conexão. Essa ação é feita apenas uma vez.
            </p>
            <Button onClick={handleCreateInstance} disabled={actionLoading} className="gap-2">
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Criar Instância
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ==================== DISCONNECTED / CONNECTING STATE ====================
  return (
    <Card className="border-orange-500/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-primary" /> Conexão WhatsApp
          </CardTitle>
          <Badge variant="secondary" className="gap-1">
            <WifiOff className="h-3 w-3" /> Desconectado
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* QR Code area */}
        {qrCode && !qrExpired && (
          <div className="space-y-3 text-center">
            <p className="text-sm text-muted-foreground">
              Abra o WhatsApp → Configurações → Aparelhos conectados → Escaneie o QR Code abaixo.
            </p>
            <div className="flex justify-center">
              <img src={qrCode} alt="QR Code WhatsApp" className="w-64 h-64 rounded-lg border" />
            </div>
            <div className="flex items-center justify-center gap-2 text-sm font-mono">
              <Timer className="h-4 w-4 text-orange-500" />
              <span className={qrSecondsLeft < 300 ? "text-destructive font-bold" : "text-muted-foreground"}>
                Expira em {formatTimer(qrSecondsLeft)}
              </span>
            </div>
          </div>
        )}

        {/* QR Expired */}
        {qrExpired && (
          <div className="text-center space-y-3 py-2">
            <p className="text-sm text-destructive font-medium">QR Code expirado.</p>
            <Button onClick={handleConnect} disabled={actionLoading} className="gap-2">
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
              Gerar Novo QR Code
            </Button>
          </div>
        )}

        {/* Name input + connect when no QR yet */}
        {!qrCode && !qrExpired && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Sua instância está criada. Informe um nome e conecte escaneando o QR Code.
            </p>
            <div>
              <Label className="text-xs">Nome da Instância (apenas letras)</Label>
              <Input
                value={instanceName}
                onChange={e => {
                  const v = e.target.value.replace(/[^A-Za-z]/g, "");
                  setInstanceName(v);
                  if (v) setNameError("");
                }}
                placeholder="MinhaEmpresa"
                maxLength={30}
              />
              {nameError && <p className="text-xs text-destructive mt-1">{nameError}</p>}
            </div>
            <Button onClick={handleConnect} disabled={actionLoading || !instanceName} className="w-full gap-2">
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
              Conectar WhatsApp
            </Button>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => instance && checkStatus(instance.token)}
            disabled={checkingStatus}
            className="gap-2"
          >
            {checkingStatus ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Verificar Status
          </Button>
          {qrCode && !qrExpired && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setQrCode(null); stopQrTimer(); setQrExpired(false); setStatus("disconnected"); }}
            >
              Cancelar
            </Button>
          )}
        </div>

        {lastCheckedAt && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            Última verificação: {formatDateTime(lastCheckedAt)}
          </div>
        )}

        <p className="text-[11px] text-muted-foreground italic">
          O status é verificado automaticamente a cada 10 minutos enquanto desconectado.
        </p>
      </CardContent>
    </Card>
  );
}
