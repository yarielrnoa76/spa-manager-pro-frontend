import React, { useEffect, useMemo, useState } from "react";
import { api } from "../services/api";
import { DailyLog, Branch, Product } from "../types";
import { Plus, Download, Search, X, Package } from "lucide-react";
import { EXCEL_FIELDS } from "../config/excelFields";

type NewSaleState = {
  date: string;
  branch_id: string;
  product_id: string;
  client_name: string;
  service_rendered: string;
  quantity: string; // UI string
  unit_price: string; // UI string
  amount: string; // UI string (readonly)
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

const Sales: React.FC = () => {
  const [sales, setSales] = useState<DailyLog[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [leads, setLeads] = useState<any[]>([]); // Estado para leads
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBranch, setSelectedBranch] = useState<string>("all");
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

  const availableProducts = useMemo(
    () => products.filter((p) => Number(p.stock) > 0),
    [products],
  );

  // Filtrado de leads por nombre y sucursal seleccionada
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

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBranch]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [s, b, p, l] = await Promise.all([
        api.listSales(selectedBranch),
        api.listBranches(),
        api.listProducts(),
        api.listLeads(), // Se asume que este método existe en tu api.ts
      ]);
      setSales(Array.isArray(s) ? s : []);
      setBranches(Array.isArray(b) ? b : []);
      setProducts(Array.isArray(p) ? p : []);
      setLeads(Array.isArray(l) ? l : []);
    } finally {
      setLoading(false);
    }
  };

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
    const total = unitPrice * qty;

    return {
      ...next,
      quantity: String(qty),
      amount: unitPrice ? money(total) : "",
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

    const currentQty = parseInt(newSale.quantity, 10) || 1;
    const safeQty = Math.min(Math.max(currentQty, 1), Number(p.stock) || 1);

    setNewSale((prev) => {
      const next: Partial<NewSaleState> = {
        product_id: String(p.id),
        service_rendered: p.name,
        unit_price: String(p.price ?? ""),
        quantity: String(safeQty),
      };
      return { ...prev, ...recalcTotals(next) };
    });
  };

  const handleQuantityChange = (qtyStr: string) => {
    const raw = qtyStr.replace(/[^\d]/g, "");
    const parsed = parseInt(raw || "0", 10);

    let qty = parsed;
    if (!qty || qty < 1) qty = 1;

    if (selectedProduct) {
      const max = Number(selectedProduct.stock) || 1;
      if (qty > max) qty = max;
    }

    setNewSale((prev) => {
      const next: Partial<NewSaleState> = { quantity: String(qty) };
      return { ...prev, ...recalcTotals(next) };
    });
  };

  const canSubmit =
    !!newSale.branch_id &&
    !!newSale.product_id &&
    !!newSale.client_name.trim() &&
    (parseInt(newSale.quantity, 10) || 0) >= 1;

  const openModal = () => {
    setNewSale({
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
    setIsModalOpen(true);
  };

  const handleCreateSale = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createSale({
        date: newSale.date,
        branch_id: newSale.branch_id,
        product_id: newSale.product_id || null,
        quantity: parseInt(newSale.quantity, 10) || 1,
        client_name: newSale.client_name,
        service_rendered: newSale.service_rendered,
        payment_method: newSale.payment_method,
        notes: newSale.notes || null,
        unit_price: toNumber(newSale.unit_price),
        amount: toNumber(newSale.amount),
      });

      setIsModalOpen(false);
      await fetchData();
    } catch (err: any) {
      alert(err?.message || "Error al crear la venta");
    }
  };

  const exportToCSV = () => {
    const headers = Object.values(EXCEL_FIELDS.DAILY_LOG).join(",");
    const rows = sales.map((s) =>
      [
        (s as any).date ?? "",
        (s as any).seller_id ?? "",
        branches.find((b) => String(b.id) === String((s as any).branch_id))
          ?.name ||
          (s as any).branch_id ||
          "",
        (s as any).client_name ?? "",
        (s as any).service_rendered ?? "",
        (s as any).amount ?? "",
        (s as any).payment_method ?? "",
        (s as any).notes ?? "",
      ].join(","),
    );

    const csvContent =
      "data:text/csv;charset=utf-8," + headers + "\n" + rows.join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `sales_${new Date().toISOString().split("T")[0]}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredSales = sales.filter((s) => {
    const client = String((s as any).client_name ?? "").toLowerCase();
    const service = String((s as any).service_rendered ?? "").toLowerCase();
    const term = searchTerm.toLowerCase();
    return client.includes(term) || service.includes(term);
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Registro de Ventas Diarias
          </h1>
          <p className="text-gray-500 text-sm">
            Registro detallado de transacciones diarias vinculadas a inventario.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 px-4 py-2 border rounded-lg bg-white text-sm font-medium hover:bg-gray-50"
          >
            <Download size={18} /> Exportar Excel
          </button>
          <button
            onClick={openModal}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold shadow-md hover:bg-indigo-700"
          >
            <Plus size={18} /> Nueva Venta
          </button>
        </div>
      </div>

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

          <select
            className="bg-gray-50 border rounded-lg text-sm py-2 px-3 focus:outline-none"
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
          >
            <option value="all">Todas las Sucursales</option>
            {branches.map((b) => (
              <option key={b.id} value={String(b.id)}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        {loading && (
          <div className="p-4 text-sm text-gray-500">Cargando...</div>
        )}

        {!loading && filteredSales.length === 0 && (
          <div className="p-4 text-sm text-gray-500">
            No hay ventas para mostrar.
          </div>
        )}

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
              {filteredSales.map((sale: any) => (
                <tr key={sale.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">{sale.date}</td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded text-[10px] font-bold">
                      {branches.find(
                        (b) => String(b.id) === String(sale.branch_id),
                      )?.name || "—"}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-medium">{sale.client_name}</td>
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
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Crear Venta */}
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
                        client_name: "", // Reseteamos cliente al cambiar sucursal
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
                  Producto / Servicio (Inventario)
                </label>
                <div className="relative">
                  <select
                    required
                    className="w-full border rounded-lg p-2 text-sm appearance-none bg-white"
                    value={newSale.product_id}
                    onChange={(e) => handleProductSelect(e.target.value)}
                  >
                    <option value="">-- Seleccionar de Inventario --</option>
                    {availableProducts.map((p: any) => (
                      <option key={p.id} value={String(p.id)}>
                        {p.name} (Stock: {p.stock}) - ${p.price}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                    <Package size={16} />
                  </div>
                </div>
              </div>

              {/* CAMPO DE CLIENTE CON AUTOCOMPLETADO FILTRADO POR SUCURSAL */}
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
                      ? "Ej. Juan Pérez"
                      : "Selecciona sucursal primero..."
                  }
                  className={`w-full border rounded-lg p-2 text-sm ${!newSale.branch_id ? "bg-gray-50 cursor-not-allowed" : ""}`}
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
                        className="w-full text-left px-4 py-2 text-sm hover:bg-indigo-50 flex justify-between items-center transition-colors"
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
                        <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded font-bold uppercase">
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
                    max={
                      selectedProduct
                        ? Number(selectedProduct.stock)
                        : undefined
                    }
                    required
                    className="w-full border rounded-lg p-2 text-sm font-bold"
                    value={newSale.quantity}
                    onChange={(e) => handleQuantityChange(e.target.value)}
                    disabled={!newSale.product_id}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                    Precio Unitario ($)
                  </label>
                  <input
                    type="text"
                    className="w-full border rounded-lg p-2 text-sm font-bold bg-gray-50"
                    value={newSale.unit_price}
                    readOnly
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

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                    Método de Pago
                  </label>
                  <select
                    className="w-full border rounded-lg p-2 text-sm"
                    value={newSale.payment_method}
                    onChange={(e) =>
                      setNewSale((prev) => ({
                        ...prev,
                        payment_method: e.target.value,
                      }))
                    }
                  >
                    <option>Credit Card</option>
                    <option>Cash</option>
                    <option>Zelle</option>
                    <option>Transfer</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2 border rounded-lg text-sm font-bold hover:bg-gray-50"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={!canSubmit}
                  className={`flex-1 py-2 rounded-lg text-sm font-bold shadow-lg transition ${
                    canSubmit
                      ? "bg-indigo-600 text-white hover:bg-indigo-700"
                      : "bg-gray-300 text-gray-500 cursor-not-allowed"
                  }`}
                >
                  Confirmar Venta
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
