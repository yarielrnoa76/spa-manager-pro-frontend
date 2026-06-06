import React, { useState, useRef } from 'react';
import { X, Upload, FileText, AlertCircle } from 'lucide-react';
import { api } from '../services/api';

interface ImportSalesModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export default function ImportSalesModal({ onClose, onSuccess }: ImportSalesModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
    }
  };

  const parseCSV = async (file: File) => {
    const text = await file.text();
    // basic CSV parse (handles basic commas, not quotes with commas inside perfectly but enough for simple files)
    const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
    if (lines.length < 2) throw new Error("El archivo no tiene suficientes datos.");

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
    
    // find indexes
    const idx = {
      date: headers.findIndex(h => h.includes('fecha') || h.includes('date')),
      client: headers.findIndex(h => h.includes('cliente') || h.includes('client')),
      product: headers.findIndex(h => h.includes('servicio') || h.includes('producto') || h.includes('product')),
      amount: headers.findIndex(h => h.includes('valor') || h.includes('precio') || h.includes('amount')),
      payment_method: headers.findIndex(h => h.includes('pago') || h.includes('metodo') || h.includes('method')),
      seller: headers.findIndex(h => h.includes('vendedora') || h.includes('seller')),
      professional: headers.findIndex(h => h.includes('esteticista') || h.includes('professional')),
      description: headers.findIndex(h => h.includes('descripci') || h.includes('nota')),
      branch: headers.findIndex(h => h.includes('sucursal') || h.includes('branch')),
    };

    // validate required columns
    if (idx.date === -1 || idx.client === -1 || idx.product === -1 || idx.branch === -1) {
      throw new Error("El archivo debe contener las columnas obligatorias: Fecha, Cliente, Servicio/Producto y Sucursal.");
    }

    const parseLine = (line: string) => {
        // A simple regex to split CSV line considering double quotes
        const result = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"' && (i === 0 || line[i-1] !== '\\')) {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current);
        return result.map(s => s.trim().replace(/^"|"$/g, ''));
    };

    const sales = [];
    for (let i = 1; i < lines.length; i++) {
      const row = parseLine(lines[i]);
      // Skip empty rows
      if (row.length < 2) continue;

      const getVal = (index: number) => index !== -1 ? (row[index] || "") : "";

      sales.push({
        date: getVal(idx.date),
        client: getVal(idx.client),
        product: getVal(idx.product),
        amount: getVal(idx.amount).replace(/[\$,]/g, ''),
        payment_method: getVal(idx.payment_method),
        seller: getVal(idx.seller),
        professional: getVal(idx.professional),
        description: getVal(idx.description),
        branch: getVal(idx.branch),
      });
    }

    return sales;
  };

  const handleImport = async () => {
    if (!file) {
      setError("Por favor selecciona un archivo CSV.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const sales = await parseCSV(file);
      
      const res = await api.post('/sales/batch-import', { sales });
      setSuccessMsg(res.message || `Se importaron ${sales.length} ventas con éxito.`);
      
      setTimeout(() => {
        onSuccess();
      }, 2000);

    } catch (err: any) {
      setError(err?.message || "Ocurrió un error al procesar el archivo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <Upload className="text-indigo-600" size={20} />
            Importar Ventas (CSV)
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto">
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 mb-6 text-sm text-indigo-800 flex gap-3">
            <AlertCircle className="shrink-0 mt-0.5" size={16} />
            <div>
              <p className="font-semibold mb-1">Formato requerido</p>
              <p>El archivo debe ser un <strong>CSV</strong> con las siguientes columnas (el orden no importa):</p>
              <ul className="list-disc pl-4 mt-1 opacity-90 space-y-0.5">
                <li><strong>Fecha</strong> (Obligatorio)</li>
                <li><strong>Cliente</strong> (Obligatorio)</li>
                <li><strong>Servicio/Producto</strong> (Obligatorio)</li>
                <li><strong>Sucursal</strong> (Obligatorio)</li>
                <li>Valor, Metodos de Pago, Vendedora, Esteticista, Descripción (Opcionales)</li>
              </ul>
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

          {error && (
            <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm font-medium border border-red-200">
              {error}
            </div>
          )}

          {successMsg && (
            <div className="mt-4 p-3 bg-green-50 text-green-700 rounded-lg text-sm font-medium border border-green-200">
              {successMsg}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-800"
            disabled={loading}
          >
            Cancelar
          </button>
          <button
            onClick={handleImport}
            disabled={!file || loading}
            className="px-6 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg shadow hover:bg-indigo-700 disabled:opacity-50 transition"
          >
            {loading ? "Importando..." : "Importar Datos"}
          </button>
        </div>
      </div>
    </div>
  );
}
