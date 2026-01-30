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

function saleAmount(sale: any): number {
  const candidates = [
    sale?.amount,
    sale?.total,
    sale?.monto,
    sale?.total_amount,
    sale?.price_total,
    sale?.subtotal,
  ];

  for (const v of candidates) {
    const raw = String(v ?? "").trim();
    if (raw === "") continue;

    const n = toNumber(raw);
    if (Number.isFinite(n)) return n;
  }

  const q = toNumber(String(sale?.quantity ?? ""));
  const u = toNumber(String(sale?.unit_price ?? ""));
  const t = q * u;

  return Number.isFinite(t) ? t : 0;
}

function safeFileLabel(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_")
    .replace(/[^\w-]/g, "");
}

function normalizeDateOnly(d: any): string {
  const s = String(d ?? "");
  if (!s) return "";
  return s.length >= 10 ? s.slice(0, 10) : s;
}

// ✅ muestra "YYYY-MM-DD HH:mm"
function formatSaleDateTime(sale: any): string {
  const raw = sale?.created_at ?? sale?.createdAt ?? sale?.date ?? "";
  const s = String(raw ?? "").trim();
  if (!s) return "—";

  // Caso "YYYY-MM-DD HH:mm:ss"
  if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/.test(s)) {
    return s.slice(0, 16); // YYYY-MM-DD HH:mm
  }

  // Caso ISO "YYYY-MM-DDTHH:mm:ss..."
  const dt = new Date(s);
  if (!isNaN(dt.getTime())) {
    const yyyy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, "0");
    const dd = String(dt.getDate()).padStart(2, "0");
    const hh = String(dt.getHours()).padStart(2, "0");
    const mi = String(dt.getMinutes()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
  }

  return s.length >= 16 ? s.slice(0, 16) : s;
}

// ✅ fecha LOCAL (evita UTC que te pone "mañana")
function localISODate(d = new Date()) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

const Sales: React.FC = () => {
  const [sales, setSales] = useState<DailyLog[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBranch, setSelectedBranch] = useState<string>("all");

  const today = localISODate();
  const [selectedDate, setSelectedDate] = useState<string>(today);

  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const initialNewSale: NewSaleState = useMemo(
    () => ({
      date: today,
      branch_id: "",
      product_id: "",
      client_name: "",
      service_rendered: "",
      quantity: "1",
      unit_price: "",
      amount: "",
      payment_method: "Credit Card",
      notes: "",
    }),
    [today],
  );

  const [newSale, setNewSale] = useState<NewSaleState>(initialNewSale);

  type SaleVisibility = "active" | "all" | "cancelled";
  const [saleVisibility, setSaleVisibility] =
    useState<SaleVisibility>("active");

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saleVisibility]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const salesOpts =
        saleVisibility === "cancelled"
          ? { only_cancelled: true }
          : saleVisibility === "all"
            ? { include_cancelled: true }
            : undefined;

      const [s, b, p, l] = await Promise.all([
        api.listSales("all", salesOpts as any),
        api.listBranches(),
        api.listProducts(),
        api.listLeads(),
      ]);

      setSales(Array.isArray(s) ? s : []);
      setBranches(Array.isArray(b) ? b : []);
      setProducts(Array.isArray(p) ? p : []);
      setLeads(Array.isArray(l) ? l : []);
    } catch (err) {
      console.error("Sales fetchData error:", err);
      setSales([]);
      setBranches([]);
      setProducts([]);
      setLeads([]);
    } finally {
      setLoading(false);
    }
  };

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

  const availableDates = useMemo(() => {
    const set = new Set<string>();
    (sales as any[]).forEach((s: any) => {
      const d = normalizeDateOnly(s.date);
      if (d) set.add(d);
    });
    const arr = Array.from(set);
    arr.sort((a, b) => (a > b ? -1 : a < b ? 1 : 0));
    return arr;
  }, [sales]);

  useEffect(() => {
    if (sales.length === 0) return;
    if (!selectedDate && availableDates.length > 0) {
      setSelectedDate(availableDates[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sales]);

  const dateBranchFilteredSales = useMemo(() => {
    return (sales as any[]).filter((s: any) => {
      const saleDate = normalizeDateOnly(s.date);
      const matchesDate = saleDate === String(selectedDate);
      const matchesBranch =
        selectedBranch === "all" ||
        String(s.branch_id) === String(selectedBranch);
      return matchesDate && matchesBranch;
    });
  }, [sales, selectedDate, selectedBranch]);

  const visibleSales = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return dateBranchFilteredSales;

    return dateBranchFilteredSales.filter((s: any) => {
      const client = String(s.client_name ?? "").toLowerCase();
      const service = String(s.service_rendered ?? "").toLowerCase();
      return client.includes(term) || service.includes(term);
    });
  }, [dateBranchFilteredSales, searchTerm]);

  const stats = useMemo(() => {
    const totalAmount = visibleSales.reduce(
      (acc, curr) => acc + saleAmount(curr),
      0,
    );

    return {
      count: visibleSales.length,
      total: totalAmount,
    };
  }, [visibleSales]);

  const availableProducts = useMemo(
    () => products.filter((p: any) => Number((p as any).stock) > 0),
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
    const qRaw = String(next.quantity ?? newSale.quantity ?? "").trim();

    if (!qRaw) {
      return {
        ...next,
        quantity: "",
        amount: "",
      };
    }

    const qty = Math.max(1, parseInt(qRaw, 10) || 1);
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

    const salesPrice = toNumber(String((p as any).sales_price ?? 0));

    setNewSale((prev) => ({
      ...prev,
      ...recalcTotals({
        product_id: String(p.id),
        service_rendered: (p as any).name,
        unit_price: salesPrice ? money(salesPrice) : "",
      }),
    }));
  };

  const isSaleCancelled = (sale: any) => {
    return Boolean(
      sale?.deleted_at ||
      sale?.deletedAt ||
      sale?.is_deleted ||
      sale?.isDeleted ||
      String(sale?.status || "").toLowerCase() === "cancelled" ||
      String(sale?.status || "").toLowerCase() === "canceled",
    );
  };

  const handleCancelSale = async (sale: any) => {
    try {
      if (!sale?.id) return;

      const ok = window.confirm(
        `¿Seguro que deseas CANCELAR esta venta?\n\nCliente: ${
          sale?.client_name || "—"
        }\nProducto/Servicio: ${sale?.service_rendered || "—"}\nCantidad: ${
          sale?.quantity || "—"
        }\n\nEsto hará soft-delete y restaurará inventario.`,
      );
      if (!ok) return;

      setLoading(true);
      await api.cancelSale(sale.id);
      await fetchData();
    } catch (err: any) {
      alert(err?.message || "Error al cancelar la venta");
    } finally {
      setLoading(false);
    }
  };

  const handleQuantityChange = (qtyStr: string) => {
    if (qtyStr === "") {
      setNewSale((prev) => ({
        ...prev,
        quantity: "",
        amount: "",
      }));
      return;
    }

    let qty = parseInt(qtyStr.replace(/[^\d]/g, ""), 10);
    if (!Number.isFinite(qty) || qty <= 0) qty = 1;

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
      const qty = parseInt(String(newSale.quantity || "0"), 10) || 0;
      const unit = toNumber(newSale.unit_price);
      const calcAmount = qty > 0 && unit > 0 ? unit * qty : 0;

      await api.createSale({
        ...newSale,
        quantity: qty,
        unit_price: unit,
        amount: calcAmount,
        product_id: newSale.product_id || null,
      });

      setIsModalOpen(false);
      setNewSale(initialNewSale);

      await fetchData();
    } catch (err: any) {
      alert(err?.message || "Error al crear la venta");
    }
  };

  const exportToCSV = () => {
    const headers = Object.values(EXCEL_FIELDS.DAILY_LOG).join(",");
    const rows = visibleSales.map((s: any) =>
      [
        normalizeDateOnly(s.date),
        "",
        branches.find((b) => String(b.id) === String(s.branch_id))?.name ||
          s.branch_id,
        s.client_name,
        s.service_rendered,
        money(saleAmount(s)),
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
            onClick={() => {
              setNewSale(initialNewSale);
              setIsModalOpen(true);
            }}
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
          <input
            type="date"
            className="bg-gray-50 border rounded-lg text-sm py-2 px-3 focus:outline-none"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            title="Filtrar por fecha"
            max={localISODate()} // ✅ local
          />

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

          {/* FILTRO ESTADO */}
          <select
            className="bg-gray-50 border rounded-lg text-sm py-2 px-3 focus:outline-none"
            value={saleVisibility}
            onChange={(e) => setSaleVisibility(e.target.value as any)}
            title="Filtrar por estado"
          >
            <option value="active">Activas</option>
            <option value="all">Todas</option>
            <option value="cancelled">Canceladas</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase font-semibold">
              <tr>
                <th className="px-6 py-4">Fecha</th>
                <th className="px-6 py-4">Vendedor(a)</th>
                <th className="px-6 py-4">Sucursal</th>
                <th className="px-6 py-4">Cliente</th>
                <th className="px-6 py-4">Servicio/Producto</th>
                <th className="px-6 py-4 text-right">Precio</th>
                <th className="px-6 py-4 text-right">Cantidad</th>
                <th className="px-6 py-4 text-right">Monto</th>
                <th className="px-6 py-4">Método</th>
                <th className="px-6 py-4 text-right">Acciones</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100 text-sm">
              {loading ? (
                <tr>
                  <td
                    colSpan={10}
                    className="px-6 py-4 text-center text-gray-400"
                  >
                    Cargando datos...
                  </td>
                </tr>
              ) : visibleSales.length === 0 ? (
                <tr>
                  <td
                    colSpan={10}
                    className="px-6 py-4 text-center text-gray-400"
                  >
                    No hay ventas para los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                visibleSales.map((sale: any) => (
                  <tr
                    key={sale.id}
                    className={`hover:bg-gray-50 ${
                      isSaleCancelled(sale) ? "opacity-60" : ""
                    }`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      {formatSaleDateTime(sale)}
                    </td>

                    {/* ✅ Vendedor(a) */}
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded text-[10px] font-bold">
                        {sale?.seller_name || "—"}
                      </span>
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

                    <td className="px-6 py-4 text-right text-gray-700">
                      {toNumber(sale?.unit_price ?? 0) > 0
                        ? `$${money(toNumber(sale?.unit_price ?? 0))}`
                        : "—"}
                    </td>

                    <td className="px-6 py-4 text-right font-bold text-gray-700">
                      {Number(sale?.quantity ?? 0) || 0}
                    </td>

                    <td className="px-6 py-4 text-right font-bold text-gray-900">
                      ${money(saleAmount(sale))}
                    </td>

                    <td className="px-6 py-4">{sale.payment_method}</td>

                    <td className="px-6 py-4 text-right">
                      {isSaleCancelled(sale) ? (
                        <span className="text-[10px] font-bold px-2 py-1 rounded bg-gray-100 text-gray-600">
                          Cancelada
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleCancelSale(sale)}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold border border-red-200 text-red-700 hover:bg-red-50"
                          title="Cancelar (soft delete) y restaurar inventario"
                        >
                          Cancelar
                        </button>
                      )}
                    </td>
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

              <button
                type="button"
                onClick={() => {
                  setIsModalOpen(false);
                  setNewSale(initialNewSale);
                }}
              >
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
                    max={localISODate()}
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
                      {p.name} (Stock: {p.stock})(Price: {p.sales_price})
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
                    readOnly
                    className="w-full border rounded-lg p-2 text-sm font-bold bg-gray-50"
                    value={newSale.amount}
                  />
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setNewSale(initialNewSale);
                  }}
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
