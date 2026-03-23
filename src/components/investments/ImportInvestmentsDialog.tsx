import { useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, FileSpreadsheet, Check, AlertCircle } from "lucide-react";
import { useInvestments } from "@/contexts/InvestmentsContext";
import { toast } from "sonner";
import { format } from "date-fns";

interface CsvRow {
  data: string;
  ativo: string;
  ticket: string;
  valor: number;
  operacao: string;
  categoria: string;
  quantidade: number | null;
}

const CATEGORY_MAP: Record<string, string> = {
  "ação": "stock", "acao": "stock", "acão": "stock",
  "fii": "fii", "fundo imobiliário": "fii", "fundo imobiliario": "fii",
  "renda fixa": "fixed_income", "rf": "fixed_income",
  "criptomoeda": "crypto", "crypto": "crypto",
  "etf": "etf",
  "fundo": "fund", "fundo de investimento": "fund",
  "negócio": "business", "negocio": "business",
};

const OP_MAP: Record<string, string> = {
  "compra": "buy", "buy": "buy", "c": "buy",
  "venda": "sell", "sell": "sell", "v": "sell",
  "rendimento": "dividend", "dividendo": "dividend", "dividend": "dividend", "r": "dividend",
};

function parseDate(raw: string): string {
  const parts = raw.trim().split("/");
  if (parts.length === 3) {
    const [d, m, y] = parts;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return raw;
}

function parseCsv(text: string): CsvRow[] {
  const lines = text.trim().split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];

  const sep = lines[0].includes(";") ? ";" : ",";
  const headerRaw = lines[0].split(sep).map(h => h.trim().toLowerCase().replace(/['"]/g, ""));

  const colMap: Record<string, number> = {};
  headerRaw.forEach((h, i) => {
    if (h.includes("ativo") || h.includes("nome")) colMap.ativo ??= i;
    if (h.includes("ticket") || h.includes("ticker") || h.includes("codigo") || h.includes("código")) colMap.ticket ??= i;
    if (h.includes("valor") || h.includes("amount") || h.includes("preco") || h.includes("preço")) colMap.valor ??= i;
    if (h.includes("operacao") || h.includes("operação") || h.includes("tipo") || h.includes("type")) colMap.operacao ??= i;
    if (h.includes("data") || h.includes("date")) colMap.data ??= i;
    if (h.includes("categoria") || h.includes("category") || h.includes("classe")) colMap.categoria ??= i;
    if (h.includes("quantidade") || h.includes("qtd") || h.includes("quantity") || h.includes("qty")) colMap.quantidade ??= i;
  });

  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(sep).map(c => c.trim().replace(/^["']|["']$/g, ""));
    if (cols.length < 3) continue;

    const valor = parseFloat((cols[colMap.valor] || "0").replace(",", "."));
    if (isNaN(valor) || valor <= 0) continue;

    let quantidade: number | null = null;
    if (colMap.quantidade !== undefined && cols[colMap.quantidade]) {
      const q = parseFloat(cols[colMap.quantidade].replace(",", "."));
      if (!isNaN(q) && q > 0) quantidade = q;
    }

    rows.push({
      data: cols[colMap.data] || format(new Date(), "dd/MM/yyyy"),
      ativo: cols[colMap.ativo] || "Sem nome",
      ticket: cols[colMap.ticket] || "",
      valor,
      operacao: (cols[colMap.operacao] || "compra").toLowerCase(),
      categoria: (cols[colMap.categoria] || "other").toLowerCase(),
      quantidade,
    });
  }
  return rows;
}

export function ImportInvestmentsDialog() {
  const { investments, addInvestment, addEntry, refreshData } = useInvestments();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ ok: number; err: number } | null>(null);

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseCsv(reader.result as string);
      setRows(parsed);
      setResult(null);
    };
    reader.readAsText(file, "utf-8");
  }, []);

  const handleImport = async () => {
    setImporting(true);
    let ok = 0, err = 0;

    const invCache = new Map<string, string>();
    investments.forEach(inv => {
      invCache.set(inv.name.toLowerCase(), inv.id);
    });

    for (const row of rows) {
      try {
        const invName = row.ticket ? `${row.ativo} (${row.ticket})` : row.ativo;
        let invId = invCache.get(invName.toLowerCase());

        if (!invId) {
          const type = CATEGORY_MAP[row.categoria] || "other";
          const newId = await addInvestment({ name: invName, type, notes: null });
          if (!newId) { err++; continue; }
          invId = newId;
          invCache.set(invName.toLowerCase(), invId);
        }

        const entryType = OP_MAP[row.operacao] || "buy";
        await addEntry({
          investment_id: invId,
          amount: row.valor,
          date: parseDate(row.data),
          entry_type: entryType as any,
          notes: `Importado: ${row.ticket || row.ativo}`,
          quantity: row.quantidade,
        });
        ok++;
      } catch {
        err++;
      }
    }

    await refreshData();
    setResult({ ok, err });
    setImporting(false);
    if (ok > 0) toast.success(`${ok} lançamentos importados!`);
    if (err > 0) toast.error(`${err} lançamentos com erro`);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setRows([]); setResult(null); } }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm"><Upload className="h-4 w-4 mr-2" /> Importar CSV</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Importar Lançamentos de Investimentos</DialogTitle></DialogHeader>

        <div className="space-y-4">
          <div className="border-2 border-dashed rounded-lg p-6 text-center border-border">
            <FileSpreadsheet className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground mb-2">
              Colunas esperadas: <strong>Data, Ativo, Ticket, Valor, Operação, Categoria, Quantidade</strong>
            </p>
            <p className="text-xs text-muted-foreground mb-3">
              Operação: COMPRA / VENDA / RENDIMENTO • Separador: vírgula ou ponto-e-vírgula
            </p>
            <input type="file" accept=".csv,.txt" onChange={handleFile} className="text-sm" />
          </div>

          {rows.length > 0 && !result && (
            <>
              <div className="bg-muted rounded-lg p-3">
                <p className="text-sm font-medium">{rows.length} lançamentos encontrados</p>
                <div className="mt-2 max-h-40 overflow-auto text-xs space-y-1">
                  {rows.slice(0, 10).map((r, i) => (
                    <div key={i} className="flex justify-between text-muted-foreground">
                      <span>{r.ativo} {r.ticket && `(${r.ticket})`} {r.quantidade != null && `×${r.quantidade}`}</span>
                      <span className={r.operacao.includes("venda") || r.operacao === "sell" ? "text-destructive" : "text-primary"}>
                        {r.operacao.toUpperCase()} R${r.valor.toFixed(2)}
                      </span>
                    </div>
                  ))}
                  {rows.length > 10 && <p className="text-muted-foreground">...e mais {rows.length - 10}</p>}
                </div>
              </div>
              <Button onClick={handleImport} disabled={importing} className="w-full">
                {importing ? "Importando..." : `Importar ${rows.length} lançamentos`}
              </Button>
            </>
          )}

          {result && (
            <div className="bg-muted rounded-lg p-4 text-center space-y-2">
              {result.ok > 0 && (
                <div className="flex items-center justify-center gap-2 text-primary">
                  <Check className="h-5 w-5" /> {result.ok} importados com sucesso
                </div>
              )}
              {result.err > 0 && (
                <div className="flex items-center justify-center gap-2 text-destructive">
                  <AlertCircle className="h-5 w-5" /> {result.err} com erro
                </div>
              )}
              <Button variant="outline" onClick={() => setOpen(false)} className="mt-2">Fechar</Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
