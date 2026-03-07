import React, { useEffect, useMemo, useState } from "react";
import { api } from "../services/api";
import LeadModal from "../components/LeadModal";
import CreateSaleModal from "../components/CreateSaleModal";
import SaleModal from "../components/SaleModal";
import { DailyLog, Branch, Product } from "../types";
import {
  Plus,
  Download,
  Search,
  X,
  Package,
  DollarSign,
  ShoppingBag,
  UserPlus,
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
  const s = String(d ?? "").trim();
  if (!s) return "";

  if (s.includes("T")) {
    const dt = new Date(s);
    if (!isNaN(dt.getTime())) {
      const yyyy = dt.getFullYear();
      const mm = String(dt.getMonth() + 1).padStart(2, "0");
      const dd = String(dt.getDate()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    }
  }
  return s.length >= 10 ? s.slice(0, 10) : s;
}

// ✅ muestra "YYYY-MM-DD HH:mm" usando 'date' como fecha principal
function formatSaleDateTime(sale: any): string {
  const dateStr = String(sale?.date ?? "").trim();
  const createdStr = String(sale?.created_at ?? sale?.createdAt ?? "").trim();

  if (!dateStr && !createdStr) return "—";

  let datePart = "";
  if (dateStr && dateStr.length >= 10) {
    datePart = dateStr.slice(0, 10);
  } else if (createdStr) {
    const dt = new Date(createdStr);
    if (!isNaN(dt.getTime())) {
      datePart = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
    } else if (createdStr.length >= 10) {
      datePart = createdStr.slice(0, 10);
    }
  }

  let timePart = "";
  if (createdStr) {
    const dt = new Date(createdStr);
    if (!isNaN(dt.getTime())) {
      timePart = `${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;
    } else if (/^\d{4}-\d{2}-\d{2}\s+(\d{2}:\d{2})/.test(createdStr)) {
      timePart = createdStr.match(/^\d{4}-\d{2}-\d{2}\s+(\d{2}:\d{2})/)?.[1] || "";
    }
  }

  return timePart ? `${datePart} ${timePart}` : datePart;
}

// ✅ fecha LOCAL (evita UTC que te pone "mañana")
function localISODate(d = new Date()) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

type SalesProps = { user?: any };

const Sales: React.FC<SalesProps> = ({ user }) => {
  // /api/user retorna permissions como array plano de strings ["view_branch", "view_leads", ...]
  const perms: string[] = Array.isArray(user?.permissions) ? user.permissions : [];

  const isSuperAdmin = user?.is_super_admin === true;
  const isAdmin = user?.role?.name === "admin" || isSuperAdmin;
  const canViewLeads = isAdmin || perms.includes("view_leads");
  const canViewBranch = isAdmin || perms.includes("view_branch");
  const [sales, setSales] = useState<DailyLog[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<{ id: number; name: string }[]>([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false); // Para crear lead desde ventas
  const [isSaleModalOpen, setIsSaleModalOpen] = useState(false);
  const [selectedSaleId, setSelectedSaleId] = useState<number | string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBranch, setSelectedBranch] = useState<string>("all");

  const today = localISODate();
  const [selectedDate, setSelectedDate] = useState<string>(today);

  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const initialNewSale: NewSaleState = useMemo(
    () => ({
      date: today,
      // Si tiene sucursal asignada, la pre-seleccionamos. Si no, vacía.
      branch_id: user?.branch?.id ? String(user.branch.id) : "",
      product_id: "",
      client_name: "",
      service_rendered: "",
      quantity: "1",
      unit_price: "",
      amount: "",
      payment_method: "Zelle",
      notes: "",
    }),
    [today, user?.branch?.id],
  );

  const [newSale, setNewSale] = useState<NewSaleState>(initialNewSale);

  type SaleVisibility = "active" | "all" | "cancelled";
  const [saleVisibility, setSaleVisibility] =
    useState<SaleVisibility>("active");

  useEffect(() => {
    fetchData(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saleVisibility]);

  useEffect(() => {
    if (paymentMethods.length > 0) {
      if (!newSale.payment_method) {
        setNewSale(prev => ({ ...prev, payment_method: paymentMethods[0].name }));
      }
    } else {
      // Fallback if API hasn't returned yet or is empty
      if (!newSale.payment_method) {
        setNewSale((prev) => ({ ...prev, payment_method: "Zelle" }));
      }
    }
  }, [paymentMethods, newSale.payment_method]);

  const fetchData = async (forceAll = false) => {
    setLoading(true);
    try {
      const salesOpts =
        saleVisibility === "cancelled"
          ? { only_cancelled: true }
          : saleVisibility === "all"
            ? { include_cancelled: true }
            : undefined;

      const shouldFetchDeps = forceAll || branches.length === 0;

      const promises: Promise<any>[] = [
        api.listSales("all", salesOpts as any)
      ];

      if (shouldFetchDeps) {
        promises.push(
          canViewBranch
            ? api.listBranches()
            : user?.branch
              ? Promise.resolve([user.branch])
              : Promise.resolve([]),
          api.listProducts(),
          canViewLeads ? api.listLeads() : Promise.resolve([]),
          api.listPaymentMethods()
        );
      }

      const results = await Promise.all(promises);

      setSales(Array.isArray(results[0]) ? results[0] : []);

      if (shouldFetchDeps) {
        setBranches(Array.isArray(results[1]) ? results[1] : []);
        setProducts(Array.isArray(results[2]) ? results[2] : []);
        setLeads(Array.isArray(results[3]) ? results[3] : []);
        setPaymentMethods(Array.isArray(results[4]) ? results[4] : []);
      }
    } catch (err) {
      console.error("Sales fetchData error:", err);
      if (forceAll || branches.length === 0) {
        setSales([]);
        setBranches([]);
        setProducts([]);
        setLeads([]);
        setPaymentMethods([]);
      }
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
    if (availableDates.length > 0) {
      if (!selectedDate || !availableDates.includes(selectedDate)) {
        setSelectedDate(availableDates[0]);
      }
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
    // Si no hay sucursal, no mostramos nada
    if (!newSale.branch_id) {
      return [];
    }

    // Si el input está vacío, devolvemos los reciente o vacio. 
    // El usuario pidió "desplegarse la lista", así que si está vacío podríamos mostrar todos o los top 5.
    const term = (newSale.client_name || "").toLowerCase();

    return leads
      .filter((lead) => {
        const matchesBranch = String(lead.branch_id) === String(newSale.branch_id);
        const matchesName = lead.name.toLowerCase().includes(term);
        // Permitir buscar en cualquier lead/cliente de la sucursal, sin importar el estado.
        // Esto corrige que clientes existentes (con estado 'won', 'converted', etc) no aparezcan.
        return matchesBranch && matchesName;
      })
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
        `¿Seguro que deseas CANCELAR esta venta?\n\nCliente: ${sale?.client_name || "—"
        }\nProducto/Servicio: ${sale?.service_rendered || "—"}\nCantidad: ${sale?.quantity || "—"
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

  const handleLeadCreatedFromModal = (lead: any) => {
    // Si se crea un lead exitosamente desde el modal,
    // actualizamos la lista de leads y lo seleccionamos
    setLeads((prev) => [lead, ...prev]);
    setNewSale((prev) => ({ ...prev, client_name: lead.name }));
    setIsLeadModalOpen(false);
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
      <LeadModal
        isOpen={isLeadModalOpen}
        onClose={() => setIsLeadModalOpen(false)}
        onSuccess={handleLeadCreatedFromModal}
        initialBranchId={newSale.branch_id}
        initialName={newSale.client_name}
      />
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
                    className={`hover:bg-gray-50 cursor-pointer ${isSaleCancelled(sale) ? "opacity-60" : ""
                      }`}
                    onClick={() => {
                      if (!isSaleCancelled(sale)) {
                        setSelectedSaleId(sale.id);
                        setIsSaleModalOpen(true);
                      }
                    }}
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
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCancelSale(sale);
                          }}
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

      <CreateSaleModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchData}
        user={user}
      />

      <SaleModal
        isOpen={isSaleModalOpen}
        saleId={selectedSaleId}
        onClose={() => setIsSaleModalOpen(false)}
        onSuccess={fetchData}
        user={user}
      />
    </div >
  );
};

export default Sales;
