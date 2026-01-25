import React, { useEffect, useMemo, useState } from "react";
import { api } from "../services/api";
import { DailyLog, Branch, Product } from "../types";
import {
  Plus,
  Download,
  Search,
  X,
  Package,
  DollarSign,
  ShoppingBag,
} from "lucide-react";
import { EXCEL_FIELDS } from "../config/excelFields";

type NewSaleState = {
  date: string;
  branch_id: string;
  product_id: string;
  client_name: string;
  service_rendered: string;
  quantity: string;
  unit_price: string;
  amount: string;
  payment_method: string;
  notes?: string;
};

function toNumber(v: string): number {
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function money(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2);
}

function safeFileLabel(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_")
    .replace(/[^\w-]/g, "");
}

// ✅ Normaliza fecha a YYYY-MM-DD (soporta "2026-01-24 00:00:00", ISO, etc.)
function normalizeDate(d: any): string {
  const s = String(d ?? "");
  if (!s) return "";
  return s.length >= 10 ? s.slice(0, 10) : s;
}

const Sales: React.FC = () => {
  const [sales, setSales] = useState<DailyLog[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBranch, setSelectedBranch] = useState<string>("all");
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split("T")[0],
  );
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [newSale, setNewSale] = useState<NewSaleState>({
    date: new Date().toISOString().split("T")[0],
    branch_id: "",
    product_id: "",
    client_name: "",
    service_rendered: "",
    quantity: "1",
    unit_price: "",
    amount: "",
    payment_method: "Credit Card",
    notes: "",
  });

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [s, b, p, l] = await Promise.all([
        api.listSales("all"),
        api.listBranches(),
        api.listProducts(),
        api.listLeads(),
      ]);
      setSales(Array.isArray(s) ? s : []);
      setBranches(Array.isArray(b) ? b : []);
      setProducts(Array.isArray(p) ? p : []);
      setLeads(Array.isArray(l) ? l : []);
    } finally {
      setLoading(false);
    }
  };

  // ✅ Nombre de sucursal seleccionada (para UI y export)
  const selectedBranchName = useMemo(() => {
    if (selectedBranch === "all") return "Todos";
    return (
      branches.find((b) => String(b.id) === String(selectedBranch))?.name ||
      "Sucursal"
    );
  }, [selectedBranch, branches]);

  const branchLabelForFile = useMemo(
    () => safeFileLabel(selectedBranchName),
    [selectedBranchName],
  );

  // ✅ Dropdown de fechas (normalizadas) orden desc
  const availableDates = useMemo(() => {
    const set = new Set<string>();
    (sales as any[]).forEach((s: any) => {
      const d = normalizeDate(s.date);
      if (d) set.add(d);
    });
    const arr = Array.from(set);
    arr.sort((a, b) => (a > b ? -1 : a < b ? 1 : 0));
    return arr;
  }, [sales]);

  // ✅ FIX CLAVE: si la fecha seleccionada no existe en ventas, usar la más reciente
  useEffect(() => {
    if (availableDates.length === 0) return;

    const exists = availableDates.includes(selectedDate);
    if (!exists) {
      setSelectedDate(availableDates[0]); // fecha más reciente
    }
  }, [availableDates, selectedDate]);

  // ✅ Base: filtra por fecha + branch (sin search)
  const dateBranchFilteredSales = useMemo(() => {
    return (sales as any[]).filter((s: any) => {
      const saleDate = normalizeDate(s.date);
      const matchesDate = saleDate === String(selectedDate);
      const matchesBranch =
        selectedBranch === "all" ||
        String(s.branch_id) === String(selectedBranch);
      return matchesDate && matchesBranch;
    });
  }, [sales, selectedDate, selectedBranch]);

  // ✅ Visible: fecha + branch + search
  const visibleSales = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return dateBranchFilteredSales;

    return dateBranchFilteredSales.filter((s: any) => {
      const client = String(s.client_name ?? "").toLowerCase();
      const service = String(s.service_rendered ?? "").toLowerCase();
      return client.includes(term) || service.includes(term);
    });
  }, [dateBranchFilteredSales, searchTerm]);

  // ✅ Resumen = lo visible (depende de filtros)
  const stats = useMemo(() => {
    const totalAmount = visibleSales.reduce(
      (acc, curr: any) => acc + toNumber(String(curr.amount)),
      0,
    );
    return {
      count: visibleSales.length,
      total: totalAmount,
    };
  }, [visibleSales]);

  const availableProducts = useMemo(
    () => products.filter((p: any) => Number(p.stock) > 0),
    [products],
  );

  const leadSuggestions = useMemo(() => {
    if (
      !newSale.client_name ||
      newSale.client_name.length < 2 ||
      !newSale.branch_id
    ) {
      return [];
    }
    return leads
      .filter(
        (lead) =>
          lead.name.toLowerCase().includes(newSale.client_name.toLowerCase()) &&
          String(lead.branch_id) === String(newSale.branch_id) &&
          (lead.status === "new" || lead.status === "contacted"),
      )
      .slice(0, 5);
  }, [newSale.client_name, newSale.branch_id, leads]);

  const selectedProduct = useMemo(() => {
    const pid = String(newSale.product_id || "");
    if (!pid) return null;
    return (
      availableProducts.find((x: any) => String(x.id) === pid) ||
      products.find((x: any) => String(x.id) === pid) ||
      null
    );
  }, [newSale.product_id, availableProducts, products]);

  const recalcTotals = (next: Partial<NewSaleState>) => {
    const qty = Math.max(
      1,
      parseInt(String(next.quantity ?? newSale.quantity), 10) || 1,
    );
    const unitPrice = toNumber(String(next.unit_price ?? newSale.unit_price));
    return {
      ...next,
      quantity: String(qty),
      amount: unitPrice ? money(unitPrice * qty) : "",
    };
  };

  const handleProductSelect = (productId: string) => {
    const p =
      availableProducts.find((x: any) => String(x.id) === String(productId)) ||
      null;
    if (!p) {
      setNewSale((prev) => ({
        ...prev,
        product_id: "",
        service_rendered: "",
        unit_price: "",
        amount: "",
      }));
      return;
    }
    setNewSale((prev) => ({
      ...prev,
      ...recalcTotals({
        product_id: String(p.id),
        service_rendered: p.name,
        unit_price: String(p.price ?? ""),
      }),
    }));
  };

  const handleQuantityChange = (qtyStr: string) => {
    let qty = parseInt(qtyStr.replace(/[^\d]/g, "") || "1", 10);
    if (selectedProduct && qty > Number((selectedProduct as any).stock)) {
      qty = Number((selectedProduct as any).stock);
    }

    setNewSale((prev) => ({
      ...prev,
      ...recalcTotals({ quantity: String(qty) }),
    }));
  };

  const handleCreateSale = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createSale({
        ...newSale,
        quantity: parseInt(newSale.quantity, 10),
        unit_price: toNumber(newSale.unit_price),
        amount: toNumber(newSale.amount),
        product_id: newSale.product_id || null,
      });
      setIsModalOpen(false);
      await fetchData();
    } catch (err: any) {
      alert(err?.message || "Error al crear la venta");
    }
  };

  const exportToCSV = () => {
    const headers = Object.values(EXCEL_FIELDS.DAILY_LOG).join(",");
    const rows = visibleSales.map((s: any) =>
      [
        normalizeDate(s.date),
        "",
        branches.find((b) => String(b.id) === String(s.branch_id))?.name ||
          s.branch_id,
        s.client_name,
        s.service_rendered,
        s.amount,
        s.payment_method,
        s.notes,
      ].join(","),
    );
    const blob = new Blob([headers + "\n" + rows.join("\n")], {
      type: "text/csv",
    });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ventas_${selectedDate}_${branchLabelForFile}.csv`;
    a.click();
  };

  const canSubmit =
    newSale.branch_id &&
    newSale.date &&
    newSale.product_id &&
    newSale.client_name &&
    newSale.quantity &&
    toNumber(newSale.quantity) > 0 &&
    newSale.amount &&
    toNumber(newSale.amount) > 0;

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Registro de Ventas Diarias
          </h1>
          <p className="text-gray-500 text-sm">
            Gestiona transacciones e inventario en tiempo real.
          </p>

          <p className="text-xs text-gray-400 mt-1">
            Sucursal:{" "}
            <span className="font-bold text-gray-600">
              {selectedBranchName}
            </span>{" "}
            · Fecha:{" "}
            <span className="font-bold text-gray-600">{selectedDate}</span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 px-4 py-2 border rounded-lg bg-white text-sm font-medium hover:bg-gray-50"
          >
            <Download size={18} /> Exportar
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold shadow-md hover:bg-indigo-700"
          >
            <Plus size={18} /> Nueva Venta
          </button>
        </div>
      </div>

      {/* RESUMEN */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg">
            <ShoppingBag size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase">
              Ventas del Día (según filtro)
            </p>
            <p className="text-2xl font-black text-gray-900">{stats.count}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-green-50 text-green-600 rounded-lg">
            <DollarSign size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase">
              Monto Total (según filtro)
            </p>
            <p className="text-2xl font-black text-gray-900">
              ${money(stats.total)}
            </p>
          </div>
        </div>
      </div>

      {/* TABLA Y FILTROS */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              size={18}
            />
            <input
              type="text"
              placeholder="Buscar cliente o servicio..."
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border rounded-lg text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* FILTRO FECHA */}
          <select
            className="bg-gray-50 border rounded-lg text-sm py-2 px-3 focus:outline-none"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            title="Filtrar por fecha"
          >
            {availableDates.length === 0 ? (
              <option value={selectedDate}>{selectedDate}</option>
            ) : (
              availableDates.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))
            )}
          </select>

          {/* FILTRO SUCURSAL */}
          <select
            className="bg-gray-50 border rounded-lg text-sm py-2 px-3 focus:outline-none"
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            title="Filtrar por sucursal"
          >
            <option value="all">Todas las Sucursales</option>
            {branches.map((b) => (
              <option key={b.id} value={String(b.id)}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase font-semibold">
              <tr>
                <th className="px-6 py-4">Fecha</th>
                <th className="px-6 py-4">Sucursal</th>
                <th className="px-6 py-4">Cliente</th>
                <th className="px-6 py-4">Servicio/Producto</th>
                <th className="px-6 py-4 text-right">Monto</th>
                <th className="px-6 py-4">Método</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100 text-sm">
              {loading ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-4 text-center text-gray-400"
                  >
                    Cargando datos...
                  </td>
                </tr>
              ) : visibleSales.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-4 text-center text-gray-400"
                  >
                    No hay ventas para los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                visibleSales.map((sale: any) => (
                  <tr key={sale.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      {normalizeDate(sale.date)}
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded text-[10px] font-bold">
                        {branches.find(
                          (b) => String(b.id) === String(sale.branch_id),
                        )?.name || "—"}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-medium">
                      {sale.client_name}
                    </td>
                    <td className="px-6 py-4 flex items-center gap-2">
                      {sale.product_id && (
                        <Package size={14} className="text-gray-400" />
                      )}
                      {sale.service_rendered}
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-gray-900">
                      ${sale.amount}
                    </td>
                    <td className="px-6 py-4">{sale.payment_method}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b flex justify-between items-center">
              <h3 className="font-bold text-lg">Nueva Venta</h3>
              <button onClick={() => setIsModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateSale} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                    Sucursal
                  </label>
                  <select
                    required
                    className="w-full border rounded-lg p-2 text-sm"
                    value={newSale.branch_id}
                    onChange={(e) =>
                      setNewSale((prev) => ({
                        ...prev,
                        branch_id: e.target.value,
                        client_name: "",
                      }))
                    }
                  >
                    <option value="">Seleccionar...</option>
                    {branches.map((b) => (
                      <option key={b.id} value={String(b.id)}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                    Fecha
                  </label>
                  <input
                    type="date"
                    required
                    className="w-full border rounded-lg p-2 text-sm"
                    value={newSale.date}
                    onChange={(e) =>
                      setNewSale((prev) => ({ ...prev, date: e.target.value }))
                    }
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                  Producto / Servicio
                </label>
                <select
                  required
                  className="w-full border rounded-lg p-2 text-sm"
                  value={newSale.product_id}
                  onChange={(e) => handleProductSelect(e.target.value)}
                >
                  <option value="">-- Seleccionar de Inventario --</option>
                  {availableProducts.map((p: any) => (
                    <option key={p.id} value={String(p.id)}>
                      {p.name} (Stock: {p.stock})
                    </option>
                  ))}
                </select>
              </div>

              <div className="relative">
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                  Nombre del Cliente
                </label>
                <input
                  type="text"
                  required
                  disabled={!newSale.branch_id}
                  placeholder={
                    newSale.branch_id
                      ? "Buscar en leads..."
                      : "Elige sucursal primero"
                  }
                  className={`w-full border rounded-lg p-2 text-sm ${
                    !newSale.branch_id ? "bg-gray-50" : ""
                  }`}
                  value={newSale.client_name}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() =>
                    setTimeout(() => setShowSuggestions(false), 200)
                  }
                  onChange={(e) =>
                    setNewSale((prev) => ({
                      ...prev,
                      client_name: e.target.value,
                    }))
                  }
                />

                {showSuggestions && leadSuggestions.length > 0 && (
                  <div className="absolute z-50 w-full bg-white border border-gray-200 rounded-lg shadow-xl mt-1 max-h-40 overflow-y-auto">
                    {leadSuggestions.map((lead) => (
                      <button
                        key={lead.id}
                        type="button"
                        className="w-full text-left px-4 py-2 text-sm hover:bg-indigo-50 flex justify-between items-center"
                        onClick={() => {
                          setNewSale((prev) => ({
                            ...prev,
                            client_name: lead.name,
                          }));
                          setShowSuggestions(false);
                        }}
                      >
                        <span className="font-medium text-gray-900">
                          {lead.name}
                        </span>
                        <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded font-bold">
                          {lead.status}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                    Cantidad
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    className="w-full border rounded-lg p-2 text-sm font-bold"
                    value={newSale.quantity}
                    onChange={(e) => handleQuantityChange(e.target.value)}
                    disabled={!newSale.product_id}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                    Total ($)
                  </label>
                  <input
                    type="text"
                    className="w-full border rounded-lg p-2 text-sm font-bold bg-gray-50"
                    value={newSale.amount}
                    readOnly
                  />
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2 border rounded-lg text-sm font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className={`flex-1 py-2 rounded-lg text-sm font-bold text-white ${
                    canSubmit ? "bg-indigo-600 shadow-lg" : "bg-gray-300"
                  }`}
                >
                  Confirmar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sales;
