import { useState, useCallback, useRef } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useFinance } from "@/contexts/FinanceContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { TransactionType } from "@/types/finance";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, AlertTriangle, CheckCircle2, XCircle, ArrowRight, ArrowLeft, Loader2 } from "lucide-react";
import { useThrottle } from "@/hooks/useDebounce";
import * as XLSX from "xlsx";

interface FieldDef {
  key: string;
  label: string;
  required: boolean;
}

const ALL_FIELDS: FieldDef[] = [
  { key: "date", label: "Data", required: true },
  { key: "amount", label: "Valor", required: true },
  { key: "person", label: "Pessoa", required: true },
  { key: "category", label: "Categoria", required: true },
  { key: "subcategory", label: "Subcategoria", required: false },
  { key: "notes", label: "Observação", required: false },
];

const IGNORE_VALUE = "__ignore__";

interface ValidationError {
  row: number;
  field: string;
  message: string;
}

type Step = "upload" | "config" | "mapping" | "preview" | "done";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

interface ColumnData {
  header: string;
  samples: string[];
}

export default function ImportPage() {
  const { categories, subcategories, persons, refreshData } = useFinance();
  const { user } = useAuth();

  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [columns, setColumns] = useState<ColumnData[]>([]);
  const [rawData, setRawData] = useState<string[][]>([]);
  const [transactionType, setTransactionType] = useState<TransactionType | "">("");
  // columnMapping[i] = field key for column i, or IGNORE_VALUE to skip
  const [columnMapping, setColumnMapping] = useState<string[]>([]);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ total: number; imported: number; status: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;

    if (f.size > MAX_FILE_SIZE) {
      toast.error("Arquivo muito grande. Máximo 5MB.");
      return;
    }

    const ext = f.name.split(".").pop()?.toLowerCase();
    if (!["csv", "xlsx", "xls"].includes(ext || "")) {
      toast.error("Formato inválido. Use CSV ou Excel (.xlsx/.xls).");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        // Use raw:true to get unformatted values - numbers stay as numbers
        const aoa: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: true });

        if (aoa.length < 2) {
          toast.error("Arquivo vazio ou sem dados suficientes.");
          return;
        }

        const headerRow = aoa[0].map(v => String(v).trim());
        let numCols = 0;
        for (let i = 0; i < headerRow.length; i++) {
          if (headerRow[i] === "") break;
          numCols++;
        }

        if (numCols < 1) {
          toast.error("Nenhuma coluna encontrada no arquivo.");
          return;
        }

        const headers = headerRow.slice(0, numCols);
        // Preserve raw types: numbers stay as numbers, strings stay as strings
        const dataRows = aoa.slice(1)
          .map(row => headers.map((_, i) => {
            const val = row[i];
            if (val === null || val === undefined || val === "") return "";
            // If it's already a number from XLSX, prefix with __NUM__ to bypass string parsing
            if (typeof val === "number") return `__NUM__${val}`;
            return String(val).trim();
          }))
          .filter(row => row.some(v => v !== ""));

        if (dataRows.length === 0) {
          toast.error("Arquivo sem dados (somente cabeçalho).");
          return;
        }

        const cols: ColumnData[] = headers.map((h, i) => ({
          header: h,
          samples: dataRows.slice(0, 3).map(r => r[i]).filter(v => v !== ""),
        }));

        setColumns(cols);
        setRawData(dataRows);
        setFile(f);

        // Auto-assign: first N columns get the first N fields, rest get IGNORE
        const defaultMapping = cols.map((_, i) =>
          i < ALL_FIELDS.length ? ALL_FIELDS[i].key : IGNORE_VALUE
        );
        setColumnMapping(defaultMapping);

        setStep("config");
      } catch {
        toast.error("Erro ao ler arquivo. Verifique o formato.");
      }
    };
    reader.readAsArrayBuffer(f);
  }, []);

  const updateColumnMapping = useCallback((colIndex: number, fieldKey: string) => {
    setColumnMapping(prev => {
      const next = [...prev];
      // If this field is already assigned to another column, clear that one
      if (fieldKey !== IGNORE_VALUE) {
        const existingIdx = next.indexOf(fieldKey);
        if (existingIdx !== -1 && existingIdx !== colIndex) {
          next[existingIdx] = IGNORE_VALUE;
        }
      }
      next[colIndex] = fieldKey;
      return next;
    });
  }, []);

  // Build a map from field key to column index from current mapping
  const getFieldColMap = useCallback((): Record<string, number> => {
    const map: Record<string, number> = {};
    columnMapping.forEach((fieldKey, colIdx) => {
      if (fieldKey !== IGNORE_VALUE) {
        map[fieldKey] = colIdx;
      }
    });
    return map;
  }, [columnMapping]);

  const validate = useCallback((): ValidationError[] => {
    const errs: ValidationError[] = [];
    const catMap = new Map(categories.filter(c => c.type === transactionType && c.is_active).map(c => [c.name.toLowerCase(), c.id]));
    const subMap = new Map(subcategories.filter(s => s.is_active).map(s => [s.name.toLowerCase(), s.id]));
    const perMap = new Map(persons.filter(p => p.is_active).map(p => [p.name.toLowerCase(), p.id]));

    const fieldColMap = getFieldColMap();

    rawData.forEach((row, i) => {
      const rowNum = i + 2;

      if (fieldColMap.date !== undefined) {
        const raw = row[fieldColMap.date];
        if (!raw) errs.push({ row: rowNum, field: "Data", message: "Data vazia" });
        else if (!parseFlexDate(raw)) errs.push({ row: rowNum, field: "Data", message: `Data inválida: "${raw}"` });
      }

      if (fieldColMap.amount !== undefined) {
        const raw = row[fieldColMap.amount];
        const num = parseFlexNumber(raw);
        if (num === null || num <= 0) errs.push({ row: rowNum, field: "Valor", message: `Valor inválido: "${raw}"` });
      }

      if (fieldColMap.person !== undefined) {
        const raw = row[fieldColMap.person];
        if (!raw) errs.push({ row: rowNum, field: "Pessoa", message: "Pessoa vazia" });
        else if (!perMap.has(raw.toLowerCase())) errs.push({ row: rowNum, field: "Pessoa", message: `Pessoa não cadastrada: "${raw}"` });
      }

      if (fieldColMap.category !== undefined) {
        const raw = row[fieldColMap.category];
        if (!raw) errs.push({ row: rowNum, field: "Categoria", message: "Categoria vazia" });
        else if (!catMap.has(raw.toLowerCase())) errs.push({ row: rowNum, field: "Categoria", message: `Categoria não cadastrada: "${raw}"` });
      }

      if (fieldColMap.subcategory !== undefined) {
        const raw = row[fieldColMap.subcategory];
        if (raw && !subMap.has(raw.toLowerCase())) errs.push({ row: rowNum, field: "Subcategoria", message: `Subcategoria não cadastrada: "${raw}"` });
      }
    });

    return errs;
  }, [rawData, columnMapping, getFieldColMap, categories, subcategories, persons, transactionType]);

  const goToPreview = useCallback(() => {
    const fieldColMap = getFieldColMap();
    const requiredMissing = ALL_FIELDS.filter(f => f.required && fieldColMap[f.key] === undefined);
    if (requiredMissing.length > 0) {
      toast.error(`Campos obrigatórios não mapeados: ${requiredMissing.map(f => f.label).join(", ")}`);
      return;
    }
    const errs = validate();
    setErrors(errs);
    setStep("preview");
  }, [getFieldColMap, validate]);

  const doImport = useThrottle(async () => {
    if (!user || importing || errors.length > 0) return;
    setImporting(true);

    try {
      const catMap = new Map(categories.filter(c => c.type === transactionType && c.is_active).map(c => [c.name.toLowerCase(), c.id]));
      const subMap = new Map(subcategories.filter(s => s.is_active).map(s => [s.name.toLowerCase(), s.id]));
      const perMap = new Map(persons.filter(p => p.is_active).map(p => [p.name.toLowerCase(), p.id]));

      const fieldColMap = getFieldColMap();

      const records = rawData.map(row => ({
        user_id: user.id,
        type: transactionType as TransactionType,
        date: parseFlexDate(row[fieldColMap.date])!,
        amount: parseFlexNumber(row[fieldColMap.amount])!,
        person_id: perMap.get(row[fieldColMap.person]?.toLowerCase())!,
        category_id: catMap.get(row[fieldColMap.category]?.toLowerCase())!,
        subcategory_id: fieldColMap.subcategory !== undefined && row[fieldColMap.subcategory]
          ? subMap.get(row[fieldColMap.subcategory]?.toLowerCase()) || null
          : null,
        notes: fieldColMap.notes !== undefined ? row[fieldColMap.notes] || null : null,
      }));

      const { error } = await supabase.from("transactions").insert(records);
      const status = error ? "error" : "success";
      const imported = error ? 0 : records.length;

      await supabase.from("import_logs").insert({
        user_id: user.id,
        type: transactionType as string,
        file_name: file?.name || "unknown",
        total_records: rawData.length,
        imported_records: imported,
        status,
        error_details: error ? { message: error.message } : null,
      });

      if (error) {
        toast.error("Erro na importação: " + error.message);
        setImportResult({ total: rawData.length, imported: 0, status: "error" });
      } else {
        toast.success(`${imported} registros importados com sucesso!`);
        setImportResult({ total: rawData.length, imported, status: "success" });
        await refreshData();
      }
      setStep("done");
    } catch (err: any) {
      toast.error("Erro inesperado: " + err.message);
    } finally {
      setImporting(false);
    }
  }, 3000);

  const reset = () => {
    setStep("upload");
    setFile(null);
    setColumns([]);
    setRawData([]);
    setTransactionType("");
    setColumnMapping([]);
    setErrors([]);
    setImportResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Which field keys are currently assigned
  const assignedFields = new Set(columnMapping.filter(k => k !== IGNORE_VALUE));

  return (
    <AppLayout>
      <div className="mb-4">
        <h1 className="text-xl font-bold tracking-tight">Importar Dados</h1>
        <p className="text-sm text-muted-foreground">Importe transações de arquivos CSV ou Excel</p>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-2 mb-6 text-xs flex-wrap">
        {(["upload", "config", "mapping", "preview", "done"] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-1">
            <Badge variant={step === s ? "default" : (["upload","config","mapping","preview","done"].indexOf(step) > i ? "secondary" : "outline")} className="text-[10px]">
              {i + 1}. {s === "upload" ? "Upload" : s === "config" ? "Tipo" : s === "mapping" ? "Mapear" : s === "preview" ? "Validação" : "Concluído"}
            </Badge>
            {i < 4 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
          </div>
        ))}
      </div>

      {/* Step 1: Upload */}
      {step === "upload" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Upload className="h-4 w-4" /> Selecione o Arquivo</CardTitle>
            <CardDescription>CSV ou Excel (.xlsx/.xls), máximo 5MB</CardDescription>
          </CardHeader>
          <CardContent>
            <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleFile} className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer" />
          </CardContent>
        </Card>
      )}

      {/* Step 2: Config */}
      {step === "config" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><FileSpreadsheet className="h-4 w-4" /> Configuração</CardTitle>
            <CardDescription>Arquivo: {file?.name} — {rawData.length} registros, {columns.length} colunas</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Este arquivo representa:</Label>
              <Select value={transactionType} onValueChange={(v) => setTransactionType(v as TransactionType)}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense">Gastos (Despesas)</SelectItem>
                  <SelectItem value="income">Receitas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={reset}><ArrowLeft className="h-3 w-3 mr-1" /> Voltar</Button>
              <Button size="sm" disabled={!transactionType} onClick={() => setStep("mapping")}>
                Próximo <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Column Mapping — each column gets a dropdown */}
      {step === "mapping" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Mapear Colunas</CardTitle>
            <CardDescription>
              Para cada coluna do arquivo, selecione o campo correspondente do sistema. Colunas que não deseja importar, deixe como "Ignorar".
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border rounded-md overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-3 py-2 text-left w-8">#</th>
                    <th className="px-3 py-2 text-left">Coluna do Arquivo</th>
                    <th className="px-3 py-2 text-left">Amostra</th>
                    <th className="px-3 py-2 text-left min-w-[160px]">Campo do Sistema</th>
                  </tr>
                </thead>
                <tbody>
                  {columns.map((col, i) => {
                    const currentField = columnMapping[i] || IGNORE_VALUE;
                    return (
                      <tr key={i} className="border-t border-border">
                        <td className="px-3 py-2 text-muted-foreground font-mono">{i + 1}</td>
                        <td className="px-3 py-2 font-medium">{col.header}</td>
                        <td className="px-3 py-2 text-muted-foreground max-w-[200px] truncate">
                          {col.samples.join(" · ") || "—"}
                        </td>
                        <td className="px-3 py-2">
                          <Select
                            value={currentField}
                            onValueChange={(v) => updateColumnMapping(i, v)}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={IGNORE_VALUE}>
                                <span className="text-muted-foreground italic">Ignorar</span>
                              </SelectItem>
                              {ALL_FIELDS.map(f => {
                                const isAssignedElsewhere = assignedFields.has(f.key) && currentField !== f.key;
                                return (
                                  <SelectItem key={f.key} value={f.key}>
                                    {f.label} {f.required ? "*" : "(opcional)"}
                                    {isAssignedElsewhere && <span className="text-muted-foreground ml-1">(moverá)</span>}
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Required fields check */}
            {(() => {
              const missing = ALL_FIELDS.filter(f => f.required && !assignedFields.has(f.key));
              if (missing.length === 0) return null;
              return (
                <div className="p-2 rounded-md bg-destructive/10 border border-destructive/30 text-xs text-destructive">
                  Campos obrigatórios faltando: {missing.map(f => f.label).join(", ")}
                </div>
              );
            })()}

            {/* Quick preview of first data row */}
            {rawData.length > 0 && (
              <div className="border rounded-md overflow-hidden">
                <div className="bg-muted px-3 py-1.5 text-[10px] font-medium text-muted-foreground">
                  Resultado com 1ª linha de dados
                </div>
                <div className="divide-y divide-border">
                  {columnMapping.map((fieldKey, colIdx) => {
                    if (fieldKey === IGNORE_VALUE) return null;
                    const fieldDef = ALL_FIELDS.find(f => f.key === fieldKey);
                    return (
                      <div key={colIdx} className="flex text-xs">
                        <div className="w-1/3 px-3 py-1.5 bg-muted/30 font-medium">{fieldDef?.label || fieldKey}</div>
                        <div className="flex-1 px-3 py-1.5">{rawData[0]?.[colIdx] || "—"}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setStep("config")}><ArrowLeft className="h-3 w-3 mr-1" /> Voltar</Button>
              <Button size="sm" onClick={goToPreview}>
                Validar e Pré-visualizar <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Preview */}
      {step === "preview" && (() => {
        const activeFields = columnMapping
          .map((key, idx) => ({ key, idx }))
          .filter(x => x.key !== IGNORE_VALUE)
          .map(x => ({ field: ALL_FIELDS.find(f => f.key === x.key)!, colIdx: x.idx }));
        return (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pré-visualização e Validação</CardTitle>
              <CardDescription>{rawData.length} registros — {errors.length === 0 ? "Nenhum erro ✓" : `${errors.length} erro(s)`}</CardDescription>
            </CardHeader>
            <CardContent>
              {errors.length > 0 && (
                <div className="mb-4 p-3 rounded-md bg-destructive/10 border border-destructive/30 max-h-48 overflow-y-auto">
                  <p className="text-sm font-medium text-destructive flex items-center gap-1 mb-2"><AlertTriangle className="h-4 w-4" /> Corrija os erros antes de importar:</p>
                  {errors.slice(0, 50).map((e, i) => (
                    <p key={i} className="text-xs text-destructive/80">Linha {e.row}: [{e.field}] {e.message}</p>
                  ))}
                  {errors.length > 50 && <p className="text-xs text-destructive/80 mt-1">...e mais {errors.length - 50} erros</p>}
                </div>
              )}

              <div className="overflow-x-auto max-h-64 border rounded-md">
                <table className="w-full text-xs">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      <th className="px-2 py-1 text-left">#</th>
                      {activeFields.map(af => (
                        <th key={af.field.key} className="px-2 py-1 text-left">{af.field.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rawData.slice(0, 20).map((row, i) => (
                      <tr key={i} className="border-t border-border">
                        <td className="px-2 py-1 text-muted-foreground">{i + 2}</td>
                        {activeFields.map(af => (
                          <td key={af.field.key} className="px-2 py-1 max-w-[150px] truncate">{row[af.colIdx] || "—"}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {rawData.length > 20 && <p className="text-[10px] text-muted-foreground p-2">Mostrando 20 de {rawData.length}</p>}
              </div>

              <div className="flex gap-2 pt-4">
                <Button variant="outline" size="sm" onClick={() => setStep("mapping")}><ArrowLeft className="h-3 w-3 mr-1" /> Voltar</Button>
                <Button size="sm" disabled={errors.length > 0 || importing} onClick={doImport}>
                  {importing ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Importando...</> : <><CheckCircle2 className="h-3 w-3 mr-1" /> Importar {rawData.length} registros</>}
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Step 5: Done */}
      {step === "done" && importResult && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              {importResult.status === "success" ? <CheckCircle2 className="h-5 w-5 text-primary" /> : <XCircle className="h-5 w-5 text-destructive" />}
              {importResult.status === "success" ? "Importação Concluída" : "Falha na Importação"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm">{importResult.imported} de {importResult.total} registros importados.</p>
            <Button size="sm" onClick={reset}>Nova Importação</Button>
          </CardContent>
        </Card>
      )}
    </AppLayout>
  );
}

function parseFlexDate(raw: string): string | null {
  if (!raw) return null;
  let s = raw.trim();

  // Handle XLSX raw number (Excel serial date)
  if (s.startsWith("__NUM__")) {
    const num = parseFloat(s.slice(7));
    if (!isNaN(num) && num > 30000 && num < 60000) {
      const d = new Date((num - 25569) * 86400000);
      if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
    }
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(s + "T00:00:00");
    return isNaN(d.getTime()) ? null : s;
  }
  const m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (m) {
    let year = m[3];
    if (year.length === 2) year = (parseInt(year) > 50 ? "19" : "20") + year;
    const iso = `${year}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    const d = new Date(iso + "T00:00:00");
    return isNaN(d.getTime()) ? null : iso;
  }
  const num = Number(s);
  if (!isNaN(num) && num > 30000 && num < 60000) {
    const d = new Date((num - 25569) * 86400000);
    if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
  }
  return null;
}

function parseFlexNumber(raw: string): number | null {
  if (!raw) return null;

  // If value came directly from XLSX as a number, use it as-is
  if (raw.startsWith("__NUM__")) {
    const n = parseFloat(raw.slice(7));
    if (isNaN(n) || n < 0) return null;
    return Math.round(n * 100) / 100;
  }

  let s = raw.trim().replace(/[R$\s]/g, "");
  if (!s) return null;

  // Brazilian: "1.234,56" or "1.234.567,89" (dot=thousands, comma=decimal)
  // MUST have comma to be considered Brazilian thousands format
  if (/^\d{1,3}(\.\d{3})+,\d{1,2}$/.test(s)) {
    s = s.replace(/\./g, "").replace(",", ".");
  }
  // US: "1,234.56" or "1,234,567.89" (comma=thousands, dot=decimal)
  else if (/^\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(s)) {
    s = s.replace(/,/g, "");
  }
  // Simple comma decimal: "127,61" or "6,98" (no thousands separator)
  else if (/^\d+(,\d{1,2})$/.test(s)) {
    s = s.replace(",", ".");
  }
  // Simple dot decimal or integer: "127.61", "6.98", "127"
  else if (/^\d+(\.\d+)?$/.test(s)) {
    // already correct format
  }
  else {
    return null; // unrecognized format, block it
  }

  const n = parseFloat(s);
  if (isNaN(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
}
