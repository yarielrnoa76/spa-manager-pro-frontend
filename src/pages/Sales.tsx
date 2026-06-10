import React, { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../services/api";
import LeadModal from "../components/LeadModal";
import CreateSaleModal from "../components/CreateSaleModal";
import SaleModal from "../components/SaleModal";
import ImportSalesModal from "../components/ImportSalesModal";
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
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Calendar,
  ChevronsLeft,
  ChevronsRight,
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

function isSaleCancelled(sale: any) {
  return Boolean(
    sale?.deleted_at ||
    sale?.deletedAt ||
    sale?.is_deleted ||
    sale?.isDeleted ||
    String(sale?.status || "").toLowerCase() === "cancelled" ||
    String(sale?.status || "").toLowerCase() === "canceled",
  );
}

type SalesProps = { user?: any };

const Sales: React.FC<SalesProps> = ({ user }) => {
  // /api/user retorna permissions como array plano de strings ["view_branch", "view_leads", ...]
  const perms: string[] = Array.isArray(user?.permissions) ? user.permissions : [];

  const isSuperAdmin = user?.is_super_admin === true;
  const isAdmin = user?.role?.name === "admin" || isSuperAdmin;
  const canViewLeads = isAdmin || perms.includes("view_leads");
  const canViewBranch = isAdmin || perms.includes("view_branch");
  const canImport = isAdmin || perms.includes("import_sales");
  const canExport = isAdmin || perms.includes("export_sales");
  const canViewAllSales = isAdmin || perms.includes("view_all_sales");
  const canViewMySalesOnly = perms.includes("view_my_sales_only") && !canViewAllSales;
  const [sales, setSales] = useState<DailyLog[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<{ id: number; name: string }[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false); // Para crear lead desde ventas
  const [isSaleModalOpen, setIsSaleModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedSaleId, setSelectedSaleId] = useState<number | string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedBranch, setSelectedBranch] = useState<string>("all");
  const [selectedSeller, setSelectedSeller] = useState<string>(canViewMySalesOnly ? String(user?.id) : "all");

  const today = localISODate();
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [filterByMonth, setFilterByMonth] = useState(false);
  const [isDateDropdownOpen, setIsDateDropdownOpen] = useState(false);

  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [weeklyExpanded, setWeeklyExpanded] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(400);
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalFilteredAmount, setTotalFilteredAmount] = useState(0);
  const [lastPage, setLastPage] = useState(1);
  const [paginationFrom, setPaginationFrom] = useState<number | null>(null);
  const [paginationTo, setPaginationTo] = useState<number | null>(null);

  const [statsData, setStatsData] = useState<{
    total_day: number;
    total_month: number;
    days_worked: number;
    total_working_days: number;
    projection: number;
  }>({ total_day: 0, total_month: 0, days_worked: 0, total_working_days: 0, projection: 0 });

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
      professional_name: "",
    }),
    [today, user?.branch?.id],
  );

  const [newSale, setNewSale] = useState<NewSaleState>(initialNewSale);

  type SaleVisibility = "active" | "all" | "cancelled";
  const [saleVisibility, setSaleVisibility] =
    useState<SaleVisibility>("active");

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
      setCurrentPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [saleVisibility, selectedBranch, selectedDate, filterByMonth, selectedSeller]);

  const fetchData = useCallback(async (forceAll = false) => {
    setLoading(true);
    try {
      const salesOpts: any = {};

      if (saleVisibility === "cancelled") {
        salesOpts.only_cancelled = true;
      } else if (saleVisibility === "all") {
        salesOpts.include_cancelled = true;
      }

      salesOpts.page = currentPage;
      salesOpts.per_page = perPage;

      if (debouncedSearch) {
        salesOpts.search = debouncedSearch;
      }

      // Server-side date filter
      if (filterByMonth && selectedDate && selectedDate.length >= 7) {
        salesOpts.date_month = selectedDate.slice(0, 7);
      } else if (selectedDate) {
        salesOpts.date = selectedDate;
      }

      if (selectedSeller !== "all") {
        salesOpts.seller_id = selectedSeller;
      }

      const shouldFetchDeps = forceAll || branches.length === 0;

      const promises: Promise<any>[] = [
        api.listSales(selectedBranch, salesOpts),
        api.getSalesStats(selectedBranch, {
          date: filterByMonth && selectedDate && selectedDate.length >= 7 ? selectedDate.slice(0, 7) : selectedDate,
          seller_id: selectedSeller,
        }),
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
          api.listPaymentMethods(),
          api.listUsers()
        );
      }

      const results = await Promise.all(promises);

      const paginatedResult = results[0];
      const statsResult = results[1];
      setSales(Array.isArray(paginatedResult?.data) ? paginatedResult.data : []);
      setTotalRecords(paginatedResult?.total ?? 0);
      setTotalFilteredAmount(paginatedResult?.total_amount ?? 0);
      setLastPage(paginatedResult?.last_page ?? 1);
      setCurrentPage(paginatedResult?.current_page ?? 1);
      setPaginationFrom(paginatedResult?.from ?? null);
      setPaginationTo(paginatedResult?.to ?? null);
      if (statsResult) {
        setStatsData(statsResult);
      }

      if (shouldFetchDeps) {
        setBranches(Array.isArray(results[2]) ? results[2] : []);
        setProducts(Array.isArray(results[3]) ? results[3] : []);
        setLeads(Array.isArray(results[4]) ? results[4] : []);
        setPaymentMethods(Array.isArray(results[5]) ? results[5] : []);
        setUsersList(Array.isArray(results[6]) ? results[6] : []);
      }
    } catch (err) {
      console.error("Sales fetchData error:", err);
      if (forceAll || branches.length === 0) {
        setSales([]);
        setBranches([]);
        setProducts([]);
        setLeads([]);
        setPaymentMethods([]);
        setUsersList([]);
      }
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, perPage, debouncedSearch, saleVisibility, selectedBranch, selectedDate, filterByMonth, selectedSeller]);

  useEffect(() => {
    fetchData(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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

  // With server-side pagination, sales already contains the filtered page
  const visibleSales = sales;

  const stats = useMemo(() => {
    return {
      count: totalRecords,
      total: statsData.total_day || totalFilteredAmount, // Use backend's filtered amount
      monthlyTotal: statsData.total_month || 0,
      daysWorked: statsData.days_worked || 0,
      totalWorkingDays: statsData.total_working_days || 0,
      projection: statsData.projection || 0,
    };
  }, [totalFilteredAmount, totalRecords, statsData]);

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

  const exportToCSV = async () => {
    try {
      const exportOpts: any = {};
      if (saleVisibility === "cancelled") {
        exportOpts.only_cancelled = true;
      } else if (saleVisibility === "all") {
        exportOpts.include_cancelled = true;
      }
      if (debouncedSearch) {
        exportOpts.search = debouncedSearch;
      }
      if (filterByMonth && selectedDate && selectedDate.length >= 7) {
        exportOpts.date_month = selectedDate.slice(0, 7);
      } else if (selectedDate) {
        exportOpts.date = selectedDate;
      }

      if (selectedSeller !== "all") {
        exportOpts.seller_id = selectedSeller;
      }

      setLoading(true);
      const allSales = await api.exportSales(selectedBranch, exportOpts);
      setLoading(false);

      if (!allSales || allSales.length === 0) {
        alert("No hay ventas para exportar con los filtros actuales.");
        return;
      }

      const headerFields = ["Fecha", "Cliente", "Servicio/Producto", "Profesional", "Valor ($)", "Método Pago", "Vendedor", "Sucursal"];
      const rows = allSales.map((s: any) =>
        [
          normalizeDateOnly(s.date),
          s.client_name,
          s.service_rendered,
          s.professional_name || s.professional?.full_name || "",
          saleAmount(s).toFixed(2),
          s.payment_method,
          s.seller_name || "",
          branches.find((b) => String(b.id) === String(s.branch_id))?.name || s.branch_id,
        ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(","),
      );
      const blob = new Blob(["\ufeff" + headerFields.join(",") + "\n" + rows.join("\n")], {
        type: "text/csv;charset=utf-8",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ventas_${filterByMonth ? "mes_" + selectedDate.slice(0, 7) : selectedDate}_${branchLabelForFile}.csv`;
      a.click();
    } catch (err: any) {
      alert("Error exportando ventas: " + (err.message || ""));
      setLoading(false);
    }
  };

  // Pagination helpers
  const goToPage = (page: number) => {
    if (page >= 1 && page <= lastPage) {
      setCurrentPage(page);
    }
  };

  const getPageNumbers = (): (number | "...")[] => {
    const pages: (number | "...")[] = [];
    const maxVisible = 7;

    if (lastPage <= maxVisible) {
      for (let i = 1; i <= lastPage; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push("...");

      const start = Math.max(2, currentPage - 1);
      const end = Math.min(lastPage - 1, currentPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);

      if (currentPage < lastPage - 2) pages.push("...");
      pages.push(lastPage);
    }
    return pages;
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
      {isImportModalOpen && (
        <ImportSalesModal
          onClose={() => setIsImportModalOpen(false)}
          onSuccess={() => {
            setIsImportModalOpen(false);
            fetchData();
          }}
        />
      )}
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
            · {filterByMonth ? "Mes: " : "Fecha: "}{" "}
            <span className="font-bold text-gray-600">
              {filterByMonth ? selectedDate.slice(0, 7) : selectedDate}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          {canImport && (
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 border border-indigo-200 rounded-lg bg-indigo-50 text-indigo-700 text-sm font-medium hover:bg-indigo-100"
            >
              <Download size={18} className="rotate-180" /> Importar
            </button>
          )}

          {canExport && (
            <button
              onClick={exportToCSV}
              className="flex items-center gap-2 px-4 py-2 border rounded-lg bg-white text-sm font-medium hover:bg-gray-50"
            >
              <Download size={18} /> Exportar
            </button>
          )}

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
      {/* WEEKLY BREAKDOWN */}
      {(() => {
        // Compute weekly breakdown for the month of the selected date
        if (!selectedDate || selectedDate.length < 7) return null;
        const parts = selectedDate.split("-");
        const selYear = parseInt(parts[0], 10);
        const selMonth = parseInt(parts[1], 10) - 1;

        if (isNaN(selYear) || isNaN(selMonth)) return null;

        const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
        const monthLabel = `${monthNames[selMonth]} ${selYear}`;

        // Build week ranges for this month (fixed 7-day blocks: 1-7, 8-14, 15-21, 22-end)
        const lastDayNum = new Date(selYear, selMonth + 1, 0).getDate();
        const weeks: { start: string; end: string; startDay: number; endDay: number }[] = [];
        const fmt = (day: number) => `${selYear}-${String(selMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

        for (let startDay = 1; startDay <= lastDayNum; startDay += 7) {
          const endDay = Math.min(startDay + 6, lastDayNum);
          weeks.push({
            start: fmt(startDay),
            end: fmt(endDay),
            startDay,
            endDay,
          });
        }

        // Group sales by week for this month (all branches or filtered)
        const monthSales = (sales as any[]).filter((s: any) => {
          const d = normalizeDateOnly(s.date);
          if (!d || d.length < 7) return false;
          const sYear = parseInt(d.slice(0,4),10);
          const sMonth = parseInt(d.slice(5,7),10) - 1;
          const branchMatch = selectedBranch === "all" || String(s.branch_id) === String(selectedBranch);
          return sYear === selYear && sMonth === selMonth && branchMatch && !isSaleCancelled(s);
        });

        const weeklyData = weeks.map(w => {
          const weekSales = monthSales.filter((s: any) => {
            const d = normalizeDateOnly(s.date);
            return d >= w.start && d <= w.end;
          });
          return {
            ...w,
            count: weekSales.length,
            total: weekSales.reduce((acc: number, s: any) => acc + saleAmount(s), 0),
          };
        });

        if (weeklyData.length === 0) return null;

        const totalCount = weeklyData.reduce((a, w) => a + w.count, 0);
        const totalAmount = weeklyData.reduce((a, w) => a + w.total, 0);

        return (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden max-w-3xl">
            <button
              type="button"
              onClick={() => setWeeklyExpanded(prev => !prev)}
              className="w-full bg-blue-50/50 px-6 py-3 border-b border-blue-100 flex items-center justify-between hover:bg-blue-50/80 transition-colors cursor-pointer"
            >
              <h3 className="text-blue-900 font-bold text-sm flex items-center gap-2">
                {weeklyExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                Desglose Semanal - {monthLabel}
              </h3>
              <span className="text-xs text-blue-600 font-medium">
                {totalCount} ventas · ${totalAmount.toLocaleString()}
              </span>
            </button>
            {weeklyExpanded && (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-[10px] uppercase font-bold text-gray-400">
                  <tr>
                    <th className="px-6 py-2 text-left">Semana</th>
                    <th className="px-6 py-2 text-center">Ventas</th>
                    <th className="px-6 py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {weeklyData.map((w, idx) => (
                    <tr key={idx} className={idx % 2 === 1 ? "bg-blue-50/20" : ""}>
                      <td className="px-6 py-3">Del {String(w.startDay).padStart(2,"0")} al {String(w.endDay).padStart(2,"0")}</td>
                      <td className="px-6 py-3 text-center">{w.count}</td>
                      <td className="px-6 py-3 text-right font-bold">${w.total.toLocaleString()}</td>
                    </tr>
                  ))}
                  <tr className="bg-blue-50/40 font-bold">
                    <td className="px-6 py-3">Total Mes</td>
                    <td className="px-6 py-3 text-center">{totalCount}</td>
                    <td className="px-6 py-3 text-right">${totalAmount.toLocaleString()}</td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>
        );
      })()}

      {/* RESUMEN */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 lg:gap-4">
        <div className="bg-white p-4 rounded-xl border border-indigo-100 shadow-sm flex items-center gap-4 border-l-4 border-l-indigo-500">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg">
            <ShoppingBag size={24} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase leading-tight">
              {filterByMonth ? "Ventas del Mes" : "Ventas del Día"}
            </p>
            <p className="text-xl font-black text-indigo-900">{stats.count}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-green-100 shadow-sm flex items-center gap-4 border-l-4 border-l-green-600">
          <div className="p-3 bg-green-50 text-green-600 rounded-lg">
            <DollarSign size={24} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase leading-tight">
              Importe Filtrado
            </p>
            <p className="text-xl font-black text-green-900">
              ${money(stats.total)}
            </p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-indigo-100 shadow-sm flex items-center gap-4 border-l-4 border-l-indigo-500">
          <div className="p-3 bg-indigo-50 text-indigo-700 rounded-lg">
            <Package size={24} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase leading-tight">
              Acumulado Mes
            </p>
            <p className="text-xl font-black text-indigo-900">
              ${money(stats.monthlyTotal)}
            </p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-amber-100 shadow-sm flex items-center gap-4 border-l-4 border-l-amber-500">
          <div className="p-3 bg-amber-50 text-amber-700 rounded-lg">
            <ChevronRight size={24} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase leading-tight">
              Días Trabajados
            </p>
            <p className="text-xl font-black text-amber-900">
              {stats.daysWorked} <span className="text-[10px] text-gray-400 font-normal">días</span>
            </p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-emerald-100 shadow-sm flex items-center gap-4 border-l-4 border-l-emerald-500">
          <div className="p-3 bg-emerald-50 text-emerald-700 rounded-lg">
            <DollarSign size={24} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase leading-tight">
              Proyección Mes
            </p>
            <div className="flex flex-col">
              <p className="text-xl font-black text-emerald-900">
                ${money(stats.projection)}
              </p>
              <p className="text-[9px] text-gray-400 font-medium">
                ({stats.totalWorkingDays} días laborables)
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* TABLA Y FILTROS */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
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

          {/* FILTRO FECHA DROPDOWN */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsDateDropdownOpen(!isDateDropdownOpen)}
              className={`flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors focus:outline-none ${
                filterByMonth || selectedDate === "" ? "border-indigo-500 text-indigo-700 bg-indigo-50/30" : "text-gray-700"
              }`}
              title="Filtrar por fecha o mes"
            >
              <Calendar size={16} className={filterByMonth || selectedDate === "" ? "text-indigo-600" : "text-gray-500"} />
              <span className="font-bold">
                {filterByMonth
                  ? `Este Mes (${selectedDate ? selectedDate.slice(0, 7) : "—"})`
                  : selectedDate === ""
                  ? "Todas las Fechas"
                  : selectedDate}
              </span>
              <ChevronDown size={14} className="text-gray-400" />
            </button>

            {isDateDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-40 cursor-default"
                  onClick={() => setIsDateDropdownOpen(false)}
                />
                <div className="absolute left-0 mt-2 z-50 bg-white border border-gray-100 rounded-xl shadow-xl p-4 w-72 space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">
                      Seleccionar Día
                    </label>
                    <input
                      type="date"
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg text-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-700 font-bold"
                      value={selectedDate}
                      onChange={(e) => {
                        setSelectedDate(e.target.value);
                        setFilterByMonth(false);
                      }}
                      max={localISODate()}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-100">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedDate(localISODate());
                        setFilterByMonth(false);
                        setIsDateDropdownOpen(false);
                      }}
                      className="px-2 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-xs font-bold text-center transition-all cursor-pointer"
                      title="Seleccionar el día de hoy"
                    >
                      Today
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!selectedDate) {
                          setSelectedDate(localISODate());
                        }
                        setFilterByMonth(true);
                        setIsDateDropdownOpen(false);
                      }}
                      className="px-2 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-xs font-bold text-center transition-all cursor-pointer"
                      title="Ver todas las ventas de este mes"
                    >
                      ThisMonth
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedDate("");
                        setFilterByMonth(false);
                        setIsDateDropdownOpen(false);
                      }}
                      className="px-2 py-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-lg text-xs font-bold text-center transition-all cursor-pointer"
                      title="Limpiar filtro de fecha"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

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

          {/* FILTRO VENDEDORA */}
          <select
            className={`bg-gray-50 border rounded-lg text-sm py-2 px-3 focus:outline-none ${canViewMySalesOnly ? "opacity-60 cursor-not-allowed" : ""}`}
            value={selectedSeller}
            onChange={(e) => setSelectedSeller(e.target.value)}
            title={canViewMySalesOnly ? "Solo puedes ver tus propias ventas" : "Filtrar por vendedora"}
            disabled={canViewMySalesOnly}
          >
            <option value="all">Todas las Vendedoras</option>
            {usersList.map((u) => (
              <option key={u.id} value={String(u.id)}>
                {u.name}
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
                <th className="px-6 py-4">Profesional</th>
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
                    colSpan={11}
                    className="px-6 py-4 text-center text-gray-400"
                  >
                    Cargando datos...
                  </td>
                </tr>
              ) : visibleSales.length === 0 ? (
                <tr>
                  <td
                    colSpan={11}
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

                    <td className="px-6 py-4">
                      {sale.professional_name || sale.professional?.full_name || <span className="text-gray-400 font-normal italic">—</span>}
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

        {/* PAGINATION BAR */}
        {totalRecords > 0 && (
          <div className="px-4 py-3 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3">
            {/* Info: Mostrando X-Y de Z registros */}
            <div className="text-sm text-gray-500">
              Mostrando{" "}
              <span className="font-bold text-gray-700">
                {paginationFrom ?? 0}
              </span>
              {" "}a{" "}
              <span className="font-bold text-gray-700">
                {paginationTo ?? 0}
              </span>
              {" "}de{" "}
              <span className="font-bold text-gray-700">
                {totalRecords.toLocaleString()}
              </span>
              {" "}registros
            </div>

            {/* Page navigation */}
            <div className="flex items-center gap-1">
              {/* First page */}
              <button
                type="button"
                onClick={() => goToPage(1)}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Primera página"
              >
                <ChevronsLeft size={16} />
              </button>
              {/* Previous page */}
              <button
                type="button"
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Página anterior"
              >
                <ChevronLeft size={16} />
              </button>

              {/* Page numbers */}
              {getPageNumbers().map((pageNum, idx) =>
                pageNum === "..." ? (
                  <span key={`ellipsis-${idx}`} className="px-2 py-1 text-gray-400 text-sm">
                    …
                  </span>
                ) : (
                  <button
                    key={pageNum}
                    type="button"
                    onClick={() => goToPage(pageNum)}
                    className={`min-w-[36px] h-9 rounded-lg text-sm font-bold transition-colors ${
                      currentPage === pageNum
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "border border-gray-200 text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {pageNum}
                  </button>
                ),
              )}

              {/* Next page */}
              <button
                type="button"
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage === lastPage}
                className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Página siguiente"
              >
                <ChevronRight size={16} />
              </button>
              {/* Last page */}
              <button
                type="button"
                onClick={() => goToPage(lastPage)}
                disabled={currentPage === lastPage}
                className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Última página"
              >
                <ChevronsRight size={16} />
              </button>
            </div>

            {/* Per page selector */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Mostrar</span>
              <select
                value={perPage}
                onChange={(e) => {
                  setPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-gray-50 border border-gray-200 rounded-lg text-sm py-1.5 px-2 font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
                <option value={400}>400</option>
              </select>
              <span className="text-sm text-gray-500">por página</span>
            </div>
          </div>
        )}
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
