import React, { useState, useRef, useMemo } from "react";
import { X, Upload, FileText, AlertCircle, ChevronRight, ArrowLeft } from "lucide-react";
import { api } from "../services/api";

interface ImportProductsModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

// Destination fields the system expects for Products
const DEST_FIELDS = [
  { key: "name", label: "Nombre", required: true },
  { key: "sku", label: "SKU", required: false },
  { key: "type", label: "Tipo (product/service)", required: false },
  { key: "sales_price", label: "Precio Venta", required: true },
  { key: "cost_price", label: "Precio Costo", required: false },
  { key: "stock", label: "Stock Actual", required: false },
  { key: "min_stock", label: "Stock Mínimo", required: false },
  { key: "max_stock", label: "Stock Máximo", required: false },
];

// Smart auto-mapping: try to guess which CSV header maps to which field
function autoMap(headers: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  const lowerHeaders = headers.map((h) => h.toLowerCase().trim());

  const rules: { key: string; patterns: string[] }[] = [
    { key: "name", patterns: ["nombre", "name", "producto", "articulo", "artículo", "descripción", "description"] },
    { key: "sku", patterns: ["sku", "codigo", "código", "code", "referencia"] },
    { key: "type", patterns: ["tipo", "type"] },
    { key: "sales_price", patterns: ["precio venta", "sales price", "precio", "venta", "price"] },
    { key: "cost_price", patterns: ["precio costo", "cost price", "costo", "cost"] },
    { key: "stock", patterns: ["stock", "cantidad", "inventario", "actual"] },
    { key: "min_stock", patterns: ["stock minimo", "stock mínimo", "minimo", "mínimo", "min_stock", "min"] },
    { key: "max_stock", patterns: ["stock maximo", "stock máximo", "maximo", "máximo", "max_stock", "max"] },
  ];

  for (const rule of rules) {
    const matchIdx = lowerHeaders.findIndex((h) =>
      rule.patterns.some((p) => h.includes(p))
    );
    if (matchIdx !== -1) {
      map[rule.key] = headers[matchIdx];
    }
  }

  return map;
}

function parseCSVText(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "");
  if (lines.length < 1) return { headers: [], rows: [] };

  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i+1] === '"') {
            current += '"';
            i++;
        } else {
            inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result.map((s) => s.replace(/^"|"$/g, ""));
  };

  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).map(parseLine);

  return { headers, rows };
}

export default function ImportProductsModal({ onClose, onSuccess }: ImportProductsModalProps) {
  const [step, setStep] = useState<"select" | "map">("select");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Parsed CSV data
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<string[][]>([]);

  // Field mapping: destKey -> csvHeader
  const [fieldMap, setFieldMap] = useState<Record<string, string>>({});

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0];
      setFile(f);
      setError(null);

      try {
        const text = await f.text();
        const { headers, rows } = parseCSVText(text);

        if (headers.length === 0) {
          setError("El archivo no contiene datos válidos.");
          return;
        }

        setCsvHeaders(headers);
        setCsvRows(rows);
        setFieldMap(autoMap(headers));
        setStep("map");
      } catch {
        setError("Error al leer el archivo.");
      }
    }
  };

  const handleMapChange = (destKey: string, csvHeader: string) => {
    setFieldMap((prev) => {
      const next = { ...prev };
      if (csvHeader === "") {
        delete next[destKey];
      } else {
        next[destKey] = csvHeader;
      }
      return next;
    });
  };

  // Validate that required fields are mapped
  const missingRequired = useMemo(() => {
    return DEST_FIELDS.filter((f) => f.required && !fieldMap[f.key]);
  }, [fieldMap]);

  // Preview rows (max 5)
  const previewRows = useMemo(() => csvRows.slice(0, 5), [csvRows]);

  // Build the mapped preview for a single row
  const getMappedValue = (row: string[], destKey: string): string => {
    const csvHeader = fieldMap[destKey];
    if (!csvHeader) return "—";
    const idx = csvHeaders.indexOf(csvHeader);
    if (idx === -1) return "—";
    return row[idx] || "—";
  };

  const handleImport = async () => {
    if (missingRequired.length > 0) {
      setError(`Faltan campos obligatorios: ${missingRequired.map((f) => f.label).join(", ")}`);
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const cleanNumber = (val: string): string => {
        if (!val || val === "—") return "0";
        const cleaned = val.replace(/[^\d.,-]/g, "");
        if (!cleaned) return "0";

        if (cleaned.includes(",") && cleaned.includes(".")) {
          const lastComma = cleaned.lastIndexOf(",");
          const lastDot = cleaned.lastIndexOf(".");
          if (lastComma > lastDot) {
            return cleaned.replace(/\./g, "").replace(/,/g, ".");
          } else {
            return cleaned.replace(/,/g, "");
          }
        } else if (cleaned.includes(",")) {
          const parts = cleaned.split(",");
          if (parts[parts.length - 1].length === 3) {
            return cleaned.replace(/,/g, "");
          } else {
            return cleaned.replace(/,/g, ".");
          }
        }
        return cleaned;
      };

      const products = csvRows
        .filter((row) => row.length >= 1)
        .map((row) => {
          const get = (key: string) => getMappedValue(row, key).replace("—", "");
          return {
            name: get("name"),
            sku: get("sku"),
            type: get("type") || "product",
            sales_price: cleanNumber(get("sales_price")),
            cost_price: cleanNumber(get("cost_price")),
            stock: cleanNumber(get("stock")),
            min_stock: cleanNumber(get("min_stock")),
            max_stock: get("max_stock") ? cleanNumber(get("max_stock")) : "",
          };
        })
        .filter((s) => s.name);

      if (products.length === 0) {
        setError("No se encontraron registros válidos para importar.");
        setLoading(false);
        return;
      }

      const res: any = await api.batchImportProducts({ products });
      setSuccessMsg(res?.message || `Se importaron ${products.length} productos con éxito.`);

      setTimeout(() => {
        onSuccess();
      }, 3000); // Dar un poco más de tiempo para que lean el resumen detallado
    } catch (error) {
      const err = error as any;
      setError(err?.message || "Ocurrió un error al procesar el archivo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50 shrink-0">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <Upload className="text-indigo-600" size={20} />
            Importar Productos (CSV)
            {step === "map" && (
              <span className="text-xs font-normal text-gray-500 ml-2">
                — Paso 2: Mapeo de columnas
              </span>
            )}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto">
          {/* ── STEP 1: Select file ── */}
          {step === "select" && (
            <>
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 mb-6 text-sm text-indigo-800 flex gap-3">
                <AlertCircle className="shrink-0 mt-0.5" size={16} />
                <div>
                  <p className="font-semibold mb-1">Formato requerido</p>
                  <p>
                    El archivo debe ser un <strong>CSV</strong>. El sistema detectará las columnas 
                    automáticamente y podrás asociarlas manualmente. Los productos con un SKU ya existente
                    serán actualizados con la nueva información.
                  </p>
                </div>
              </div>

              <div
                className="border-2 border-dashed border-gray-300 rounded-xl p-8 flex flex-col items-center justify-center text-center hover:border-indigo-500 transition-colors cursor-pointer bg-gray-50 hover:bg-indigo-50/30"
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  type="file"
                  accept=".csv"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                />
                <FileText size={40} className={file ? "text-indigo-600" : "text-gray-400"} />
                <p className="mt-3 font-medium text-gray-700">
                  {file ? file.name : "Haz clic para seleccionar archivo CSV"}
                </p>
                <p className="text-xs text-gray-500 mt-1">Solo archivos .csv</p>
              </div>
            </>
          )}

          {/* ── STEP 2: Column mapping + preview ── */}
          {step === "map" && (
            <>
              {/* Back button */}
              <button
                onClick={() => {
                  setStep("select");
                  setFile(null);
                  setCsvHeaders([]);
                  setCsvRows([]);
                  setFieldMap({});
                  setError(null);
                  setSuccessMsg(null);
                }}
                className="flex items-center gap-1 text-sm text-gray-500 hover:text-indigo-600 mb-4 transition"
              >
                <ArrowLeft size={14} /> Seleccionar otro archivo
              </button>

              <div className="flex items-center gap-2 mb-3">
                <FileText size={16} className="text-indigo-600" />
                <span className="text-sm font-semibold text-gray-700">{file?.name}</span>
                <span className="text-xs text-gray-400">
                  ({csvRows.length} registros encontrados)
                </span>
              </div>

              {/* Column Mapping */}
              <div className="bg-gray-50 border rounded-xl p-4 mb-5">
                <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                  <ChevronRight size={14} />
                  Asociar columnas del archivo a campos del sistema
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {DEST_FIELDS.map((field) => (
                    <div key={field.key} className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-gray-600">
                        {field.label}
                        {field.required && <span className="text-red-500 ml-0.5">*</span>}
                      </label>
                      <select
                        value={fieldMap[field.key] || ""}
                        onChange={(e) => handleMapChange(field.key, e.target.value)}
                        className={`text-sm border rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-indigo-300 focus:outline-none ${
                          field.required && !fieldMap[field.key]
                            ? "border-red-300 bg-red-50/30"
                            : "border-gray-200"
                        }`}
                      >
                        <option value="">— No asignado —</option>
                        {csvHeaders.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              {/* Preview Table */}
              <div className="border rounded-xl overflow-hidden">
                <div className="bg-indigo-50/60 px-4 py-2 border-b">
                  <h3 className="text-sm font-bold text-indigo-800">
                    Vista previa ({Math.min(5, csvRows.length)} de {csvRows.length} registros)
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 text-[10px] uppercase text-gray-500 font-bold">
                      <tr>
                        <th className="px-3 py-2 text-left text-gray-400">#</th>
                        {DEST_FIELDS.filter((f) => fieldMap[f.key]).map((f) => (
                          <th key={f.key} className="px-3 py-2 text-left whitespace-nowrap">
                            {f.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {previewRows.map((row, i) => (
                        <tr key={i} className={i % 2 === 1 ? "bg-gray-50/50" : ""}>
                          <td className="px-3 py-2 text-gray-400 font-mono">{i + 1}</td>
                          {DEST_FIELDS.filter((f) => fieldMap[f.key]).map((f) => (
                            <td key={f.key} className="px-3 py-2 whitespace-nowrap max-w-[160px] truncate">
                              {getMappedValue(row, f.key)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {csvRows.length > 5 && (
                  <div className="bg-gray-50 text-center py-2 text-[10px] text-gray-400 border-t">
                    ... y {csvRows.length - 5} registros más
                  </div>
                )}
              </div>
            </>
          )}

          {/* Error / Success messages */}
          {error && (
            <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm font-medium border border-red-200 whitespace-pre-line">
              {error}
            </div>
          )}
          {successMsg && (
            <div className="mt-4 p-3 bg-green-50 text-green-700 rounded-lg text-sm font-medium border border-green-200 whitespace-pre-line">
              {successMsg}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-gray-50 flex justify-between items-center shrink-0">
          <div className="text-xs text-gray-400">
            {step === "map" && missingRequired.length > 0 && (
              <span className="text-red-500">
                Campos sin asignar: {missingRequired.map((f) => f.label).join(", ")}
              </span>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-800"
              disabled={loading}
            >
              Cancelar
            </button>
            {step === "map" && (
              <button
                onClick={handleImport}
                disabled={missingRequired.length > 0 || loading || !!successMsg}
                className="px-6 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg shadow hover:bg-indigo-700 disabled:opacity-50 transition flex items-center gap-2"
              >
                {loading ? "Importando..." : `Importar ${csvRows.length} registros`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
