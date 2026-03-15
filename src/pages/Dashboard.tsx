import React, { useEffect, useMemo, useState } from "react";
import {
  BarChart as ReBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList,
} from "recharts";
import {
  TrendingUp,
  Users,
  DollarSign,
  ShoppingBag,
  Filter,
} from "lucide-react";
import { api } from "../services/api";
import StatCard from "../components/StatCard";

type Branch = { id: number; name: string };

type Lead = {
  id: number;
  name: string;
  source?: string | null;
  status: string;
};

type DashboardStats = {
  totalSales: number;
  profit: number;
  recentLeads: Lead[];
  salesCount: number;
  lowStockCount: number;
};

type Product = {
  id: number | string;
  name: string;
  salesprice: number;
};

// Ventas (DailyLog) — tipado “suave”
type Sale = {
  id: number;
  date: string;
  branch_id?: number | string;
  seller_id?: number | string | null;
  seller_name?: string | null;
  seller?: { id?: number | string; name?: string | null } | null;

  product_id?: number | string | null;
  product_name?: string | null;
  product?: { id?: number | string; name?: string | null } | null;

  quantity?: number | string | null;
  unit_price?: number | string | null;
  amount?: number | string | null;

  deleted_at?: string | null;
  deletedAt?: string | null;
  is_deleted?: boolean | null;
  isDeleted?: boolean | null;
  status?: string | null;
};

function normalizeArray<T = any>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === "object" && "data" in payload) {
    const d = (payload as any).data;
    if (Array.isArray(d)) return d as T[];
  }
  return [];
}

function normalizeDate(d: any): string {
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

function toISODate(dt: Date) {
  return dt.toISOString().slice(0, 10);
}

function toNum(v: any) {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

const MONTHS = [
  { value: 1, label: "Enero", short: "Ene" },
  { value: 2, label: "Febrero", short: "Feb" },
  { value: 3, label: "Marzo", short: "Mar" },
  { value: 4, label: "Abril", short: "Abr" },
  { value: 5, label: "Mayo", short: "May" },
  { value: 6, label: "Junio", short: "Jun" },
  { value: 7, label: "Julio", short: "Jul" },
  { value: 8, label: "Agosto", short: "Ago" },
  { value: 9, label: "Septiembre", short: "Sep" },
  { value: 10, label: "Octubre", short: "Oct" },
  { value: 11, label: "Noviembre", short: "Nov" },
  { value: 12, label: "Diciembre", short: "Dic" },
];

type MonthFilter = number | "all";

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>("all");

  // ✅ Mes/Año (por defecto: actual)
  const nowInit = new Date();
  const [selectedMonth, setSelectedMonth] = useState<MonthFilter>(
    nowInit.getMonth() + 1,
  ); // 1-12 o "all"
  const [selectedYear, setSelectedYear] = useState<number>(nowInit.getFullYear());

  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>("");

  const [activeTab, setActiveTab] = useState<"dashboard" | "annual">("dashboard");
  const [appointments, setAppointments] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);

  const [sales, setSales] = useState<Sale[]>([]);
  const [loadingCharts, setLoadingCharts] = useState<boolean>(true);
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      setLoading(true);
      setLoadingCharts(true);
      setErrorMsg("");

      try {
        const [statsRes, branchesRes, salesRes, productsRes, appsRes, expsRes] =
          await Promise.all([
            api.getDashboardStats(selectedBranch),
            api.listBranches(),
            api.listSales("all", { include_cancelled: true } as any),
            api.listProducts(),
            api.get<any>("/api/appointments").catch(() => []),
            api.get<any>("/api/expenses").catch(() => []),
          ]);

        if (cancelled) return;

        setStats(statsRes as DashboardStats);
        setBranches(normalizeArray<Branch>(branchesRes));
        setSales(normalizeArray<Sale>(salesRes));
        setProducts(normalizeArray<Product>(productsRes));
        setAppointments(normalizeArray<any>(appsRes));
        setExpenses(normalizeArray<any>(expsRes));
      } catch (e: any) {
        if (cancelled) return;
        setStats(null);
        setSales([]);
        setProducts([]);
        setAppointments([]);
        setExpenses([]);
        setErrorMsg(e?.message || "Failed to load dashboard data");
      } finally {
        if (!cancelled) {
          setLoading(false);
          setLoadingCharts(false);
        }
      }
    };

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [selectedBranch]);

  const productNameById = useMemo(() => {
    const map = new Map<string, string>();
    products.forEach((p) => map.set(String(p.id), p.name));
    return map;
  }, [products]);

  const yearOptions = useMemo(() => {
    const y = new Date().getFullYear();
    const arr: number[] = [];
    for (let yy = y - 6; yy <= y + 1; yy++) arr.push(yy);
    return arr;
  }, []);

  // ✅ período seleccionado:
  // - Mes específico: ese mes (si es mes actual -> hasta hoy)
  // - Mes = "all": todo el año (si es año actual -> hasta hoy)
  const period = useMemo(() => {
    const now = new Date();
    const isCurrentYear = now.getFullYear() === selectedYear;

    if (selectedMonth === "all") {
      const start = new Date(selectedYear, 0, 1);
      const end = isCurrentYear ? now : new Date(selectedYear, 11, 31);
      return {
        mode: "year" as const,
        start,
        end,
        startStr: toISODate(start),
        endStr: toISODate(end),
        isCurrentYear,
      };
    }

    const start = new Date(selectedYear, selectedMonth - 1, 1);
    const endOfMonth = new Date(selectedYear, selectedMonth, 0);

    const isCurrentMonth =
      isCurrentYear && now.getMonth() + 1 === selectedMonth;

    const end = isCurrentMonth ? now : endOfMonth;

    return {
      mode: "month" as const,
      start,
      end,
      startStr: toISODate(start),
      endStr: toISODate(end),
      isCurrentYear,
      isCurrentMonth,
      daysInMonth: endOfMonth.getDate(),
      daysInRange: isCurrentMonth ? end.getDate() : endOfMonth.getDate(),
    };
  }, [selectedMonth, selectedYear]);

  // ✅ Ventas del período (activas, filtradas por branch)
  const periodSales = useMemo(() => {
    return (sales || []).filter((s) => {
      const d = normalizeDate(s.date);
      if (!d) return false;

      if (d < period.startStr || d > period.endStr) return false;

      if (
        selectedBranch !== "all" &&
        String(s.branch_id ?? "") !== String(selectedBranch)
      ) {
        return false;
      }

      if (isSaleCancelled(s)) return false;

      return true;
    });
  }, [sales, selectedBranch, period.startStr, period.endStr]);

  // ✅ KPIs del período
  const kpi = useMemo(() => {
    const totalSales = periodSales.reduce((acc, s) => acc + toNum(s.amount), 0);
    const salesCount = periodSales.length;
    const productsSold = periodSales.reduce(
      (acc, s) => acc + Math.max(1, toNum(s.quantity)),
      0,
    );
    return { totalSales, salesCount, productsSold };
  }, [periodSales]);

  // ✅ Label del período (para títulos)
  const periodLabel = useMemo(() => {
    if (selectedMonth === "all") return `Año ${selectedYear}`;
    const m = MONTHS.find((x) => x.value === selectedMonth)?.label || "Mes";
    return `${m} ${selectedYear}`;
  }, [selectedMonth, selectedYear]);

  // ✅ Profit calculated dynamically for the selected period using cost_price
  const profitDisplay = useMemo(() => {
    let totalProfit = 0;
    periodSales.forEach((s) => {
      let cost = 0;
      if (s.product_id != null) {
        const prod = products.find(p => String(p.id) === String(s.product_id));
        if (prod && (prod as any).cost_price) {
          cost = Number((prod as any).cost_price) * Math.max(1, toNum(s.quantity));
        }
      }
      totalProfit += (toNum(s.amount) - cost);
    });

    return `$${totalProfit.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }, [periodSales, products, selectedMonth]);

  // -----------------------------
  // ✅ Chart 1:
  // - si mes específico => ventas por día
  // - si "all" => ventas por mes (del año)
  // -----------------------------
  const salesByDayChartData = useMemo(() => {
    if (period.mode !== "month") return [];

    const daysInRange = period.daysInRange;

    const base = Array.from({ length: daysInRange }, (_, i) => ({
      day: String(i + 1),
      count: 0,
    }));

    const indexByDay = new Map<string, number>();
    base.forEach((row, idx) => indexByDay.set(row.day, idx));

    periodSales.forEach((s) => {
      const d = normalizeDate(s.date);
      if (!d) return;

      const dd = new Date(d + "T00:00:00");
      if (dd.getFullYear() !== period.start.getFullYear()) return;
      if (dd.getMonth() !== period.start.getMonth()) return;

      const dayNumber = String(dd.getDate());
      const idx = indexByDay.get(dayNumber);
      if (idx === undefined) return;
      base[idx].count += 1;
    });

    return base;
  }, [period.mode, periodSales, period.startStr, period.endStr, periodLabel]);

  const salesByMonthChartData = useMemo(() => {
    if (period.mode !== "year") return [];

    const base = MONTHS.map((m) => ({ month: m.short, count: 0 }));
    const idxByMonth = new Map<number, number>();
    MONTHS.forEach((m, idx) => idxByMonth.set(m.value, idx));

    periodSales.forEach((s) => {
      const d = normalizeDate(s.date);
      if (!d) return;
      const dd = new Date(d + "T00:00:00");
      if (dd.getFullYear() !== selectedYear) return;

      const m = dd.getMonth() + 1;
      const idx = idxByMonth.get(m);
      if (idx === undefined) return;

      base[idx].count += 1;
    });

    return base;
  }, [period.mode, periodSales, selectedYear]);

  // ✅ Chart 2: Ventas por vendedora (del período)
  const salesBySellerChartData = useMemo(() => {
    const map = new Map<string, number>();

    const getSellerLabel = (s: Sale) => {
      const name =
        s?.seller?.name ||
        s?.seller_name ||
        (s?.seller_id != null ? `Seller ${String(s.seller_id)}` : null);

      return String(name || "Sin vendedora");
    };

    periodSales.forEach((s) => {
      const label = getSellerLabel(s);
      map.set(label, (map.get(label) || 0) + 1);
    });

    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [periodSales]);

  // ✅ Chart 3: Top 10 productos (del período)
  const topProducts = useMemo(() => {
    const map = new Map<string, number>();

    const getProductLabel = (s: Sale) => {
      if (s?.product?.name) return s.product.name;
      if (s?.product_name) return s.product_name;

      if (s?.product_id != null) {
        const name = productNameById.get(String(s.product_id));
        if (name) return name;
      }

      return "Producto sin nombre";
    };

    periodSales.forEach((s) => {
      const name = getProductLabel(s);
      const qty = Math.max(1, toNum(s.quantity));
      map.set(name, (map.get(name) || 0) + qty);
    });

    return Array.from(map.entries())
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10);
  }, [periodSales, productNameById]);

  // ✅ Weekly Breakdown (solo si es mes)
  const weeklyBreakdown = useMemo(() => {
    if (period.mode !== "month") return null;

    const weeks = [
      { label: "Semana 1 (1-7)", start: 1, end: 7, count: 0, amount: 0 },
      { label: "Semana 2 (8-14)", start: 8, end: 14, count: 0, amount: 0 },
      { label: "Semana 3 (15-21)", start: 15, end: 21, count: 0, amount: 0 },
      { label: "Semana 4 (22-28)", start: 22, end: 28, count: 0, amount: 0 },
    ];
    if (period.daysInMonth > 28) {
      weeks.push({ label: `Semana 5 (29-${period.daysInMonth})`, start: 29, end: period.daysInMonth, count: 0, amount: 0 });
    }

    periodSales.forEach((s) => {
      const d = normalizeDate(s.date);
      if (!d) return;

      const dd = new Date(d + "T00:00:00");
      if (dd.getFullYear() !== period.start.getFullYear() || dd.getMonth() !== period.start.getMonth()) return;

      const day = dd.getDate();
      for (const w of weeks) {
        if (day >= w.start && day <= w.end) {
          w.count += 1;
          w.amount += toNum(s.amount);
          break;
        }
      }
    });

    const totalCount = weeks.reduce((acc, w) => acc + w.count, 0);
    const totalAmount = weeks.reduce((acc, w) => acc + w.amount, 0);

    return { weeks, totalCount, totalAmount };
  }, [period, periodSales]);

  // ✅ Indicadores Anuales por Sucursal
  const annualSummary = useMemo(() => {
    if (activeTab !== "annual") return [];

    const now = new Date();
    const isCurrentYear = now.getFullYear() === selectedYear;
    
    const startOfYear = new Date(selectedYear, 0, 1);
    const endOfPeriod = isCurrentYear ? now : new Date(selectedYear, 11, 31);
    
    let elapsedDays = Math.ceil((endOfPeriod.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24));
    if (elapsedDays < 1) elapsedDays = 1;

    // Filter branches based on selectedBranch if needed, but prompt says "por cada branch". 
    // Usually it implies all branches or the ones visible to the user.
    const targetBranches = selectedBranch === "all" ? branches : branches.filter(b => String(b.id) === String(selectedBranch));

    return targetBranches.map(branch => {
      let visitas = 0;
      let ventasCount = 0;
      let ventasNetas = 0;
      let devsCount = 0;
      let devsAmount = 0;
      let gastos = 0;

      appointments.forEach(a => {
        if (String(a.branch_id) !== String(branch.id)) return;
        const d = normalizeDate(a.date);
        if (!d) return;
        const dd = new Date(d + "T00:00:00");
        if (dd.getFullYear() === selectedYear && String(a.status).toLowerCase() !== "cancelled") {
          visitas += 1;
        }
      });

      sales.forEach(s => {
        if (String(s.branch_id) !== String(branch.id)) return;
        const d = normalizeDate(s.date);
        if (!d) return;
        const dd = new Date(d + "T00:00:00");
        if (dd.getFullYear() === selectedYear) {
          if (isSaleCancelled(s)) {
            devsCount += 1;
            devsAmount += toNum(s.amount);
          } else {
            ventasCount += 1;
            ventasNetas += toNum(s.amount);
          }
        }
      });

      expenses.forEach(e => {
        if (String(e.branch_id) !== String(branch.id)) return;
        const d = normalizeDate(e.date || e.created_at);
        if (!d) return;
        const dd = new Date(d + "T00:00:00");
        if (dd.getFullYear() === selectedYear) {
          gastos += toNum(e.amount);
        }
      });

      const grossYTD = ventasNetas + devsAmount;
      const proyeccion = (grossYTD / elapsedDays) * 365;

      return {
        branchName: branch.name,
        visitas,
        ventasCount,
        ventasNetas,
        devsCount,
        devsAmount,
        gastos,
        proyeccion
      };
    });
  }, [activeTab, appointments, sales, expenses, branches, selectedYear, selectedBranch]);

  if (loading) return <div className="p-8 font-semibold">Loading dashboard...</div>;

  if (!stats)
    return (
      <div className="p-8 font-semibold text-red-600">
        {errorMsg || "Dashboard not available"}
      </div>
    );

  return (
    <div className="space-y-8">
      {/* TABS */}
      <div className="flex border-b border-gray-200">
        <button
          className={`px-4 py-2 font-semibold text-sm transition-colors ${activeTab === "dashboard" ? "border-b-2 border-indigo-600 text-indigo-600" : "text-gray-500 hover:text-gray-700"}`}
          onClick={() => setActiveTab("dashboard")}
        >
          Resumen General
        </button>
        <button
          className={`px-4 py-2 font-semibold text-sm transition-colors ${activeTab === "annual" ? "border-b-2 border-indigo-600 text-indigo-600" : "text-gray-500 hover:text-gray-700"}`}
          onClick={() => setActiveTab("annual")}
        >
          Resumen Anual y Proyección de Cierre
        </button>
      </div>

      <div className="sticky top-0 z-40 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gray-50/95 backdrop-blur-sm py-4 -mx-4 px-4 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border-b border-white rounded-b-xl mb-6">
        <div>
          <h1 className="text-2xl font-bold">Panel de Control</h1>
          <p className="text-gray-500 text-sm">
            {activeTab === "annual" ? "Métricas proyectadas y volumen acumulado anual." : "Resumen de actividad para tus sucursales."}
          </p>
          {activeTab === "dashboard" && (
            <p className="text-xs text-gray-400 mt-1">
              Período: <span className="font-bold text-gray-600">{periodLabel}</span>
            </p>
          )}
        </div>

        {/* FILTROS */}
        {activeTab === "dashboard" && (
          <div className="flex items-center gap-3 bg-white p-2 rounded-lg border border-gray-200 shadow-sm flex-wrap">
            <Filter size={18} className="text-gray-400" />

            {/* Branch */}
            <select
              className="bg-transparent border-none focus:ring-0 text-sm font-medium pr-6"
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              title="Filtrar por sucursal"
            >
              <option value="all">All Branches</option>
              {branches.map((b) => (
                <option key={b.id} value={String(b.id)}>
                  {b.name}
                </option>
              ))}
            </select>

            {/* Month (incluye Todos) */}
            <select
              className="bg-transparent border-none focus:ring-0 text-sm font-medium pr-6"
              value={String(selectedMonth)}
              onChange={(e) => {
                const v = e.target.value;
                setSelectedMonth(v === "all" ? "all" : Number(v));
              }}
              title="Filtrar por mes"
            >
              <option value="all">Todos</option>
              {MONTHS.map((m) => (
                <option key={m.value} value={String(m.value)}>
                  {m.label}
                </option>
              ))}
            </select>

            {/* Year */}
            <select
              className="bg-transparent border-none focus:ring-0 text-sm font-medium pr-2"
              value={String(selectedYear)}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              title="Filtrar por año"
            >
              {yearOptions.map((y) => (
                <option key={y} value={String(y)}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {activeTab === "annual" ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold">Acumulado del Año hasta la Fecha ({selectedYear})</h3>
              <p className="text-sm text-gray-500">Indicadores clave de rendimiento acumulados desde el 1 de Enero hasta hoy, por sucursal.</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-gray-50 text-gray-600 text-xs uppercase font-bold">
                <tr>
                  <th className="px-6 py-3 border-b">Sucursal</th>
                  <th className="px-6 py-3 border-b">Visitas YTD</th>
                  <th className="px-6 py-3 border-b">Ventas YTD</th>
                  <th className="px-6 py-3 border-b">Ventas Netas YTD</th>
                  <th className="px-6 py-3 border-b text-red-600">Devoluciones</th>
                  <th className="px-6 py-3 border-b text-red-600">Importe Dev.</th>
                  <th className="px-6 py-3 border-b text-amber-600">Gastos YTD</th>
                  <th className="px-6 py-3 border-b text-indigo-600">Proyección Gross</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {annualSummary.map((row, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4 font-bold text-gray-900 border-r">{row.branchName}</td>
                    <td className="px-6 py-4">{row.visitas}</td>
                    <td className="px-6 py-4">{row.ventasCount}</td>
                    <td className="px-6 py-4 font-semibold text-emerald-600 border-r">${row.ventasNetas.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                    <td className="px-6 py-4 text-red-500">{row.devsCount}</td>
                    <td className="px-6 py-4 font-semibold text-red-500 border-r">${row.devsAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                    <td className="px-6 py-4 font-semibold text-amber-600 border-r">${row.gastos.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                    <td className="px-6 py-4 font-bold text-indigo-600">${row.proyeccion.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                  </tr>
                ))}
                {annualSummary.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center text-gray-400">No hay información para mostrar en este año o sucursal.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <React.Fragment>
          {weeklyBreakdown && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
               <div className="p-4 border-b border-gray-100 bg-gray-50">
                <h3 className="font-bold text-gray-800">Desglose Semanal - {periodLabel}</h3>
               </div>
               <div className="overflow-x-auto">
                 <table className="w-full text-left text-sm whitespace-nowrap">
                   <thead className="bg-white text-gray-500 text-xs uppercase font-semibold border-b border-gray-100">
                     <tr>
                       <th className="px-6 py-3 border-r border-gray-50 w-1/3">Semana del Mes</th>
                       <th className="px-6 py-3 border-r border-gray-50 w-1/3">Cantidad de Ventas</th>
                       <th className="px-6 py-3 w-1/3">Valor de Ventas</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-gray-100">
                     {weeklyBreakdown.weeks.map((w, idx) => (
                       <tr key={idx} className="hover:bg-gray-50">
                         <td className="px-6 py-3 font-medium text-gray-700 border-r border-gray-50">{w.label}</td>
                         <td className="px-6 py-3 border-r border-gray-50">{w.count}</td>
                         <td className="px-6 py-3 text-emerald-600 font-medium">${w.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                       </tr>
                     ))}
                     <tr className="bg-gray-50/80 font-bold border-t-2 border-gray-200">
                       <td className="px-6 py-4 text-gray-900 border-r border-white">TOTAL {periodLabel.toUpperCase()}:</td>
                       <td className="px-6 py-4 text-gray-900 border-r border-white">{weeklyBreakdown.totalCount}</td>
                       <td className="px-6 py-4 text-emerald-600">${weeklyBreakdown.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                     </tr>
                   </tbody>
                 </table>
               </div>
            </div>
          )}

      {/* STATS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title={`Valor de Ventas (${periodLabel})`}
          value={`$${Number(kpi.totalSales || 0).toLocaleString()}`}
          icon={DollarSign}
          color="bg-indigo-600"
        />

        <StatCard
          title={`Ganancia Neta (${selectedMonth === "all" ? "Año" : "Mes"})`}
          value={profitDisplay}
          icon={TrendingUp}
          color="bg-emerald-600"
        />

        <StatCard
          title={`Cantidad de Ventas (${periodLabel})`}
          value={kpi.salesCount}
          icon={Users}
          color="bg-amber-500"
        />

        <StatCard
          title={`Productos Vendidos (${periodLabel})`}
          value={kpi.productsSold}
          icon={ShoppingBag}
          color="bg-rose-500"
        />
      </div>

      {/* CHARTS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Chart 1 dinámico */}
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
          <h3 className="text-lg font-bold mb-2">
            {selectedMonth === "all"
              ? `Ventas por mes (${selectedYear})`
              : `Ventas por día (${periodLabel})`}
          </h3>
          <p className="text-xs text-gray-500 mb-6">
            {selectedMonth === "all"
              ? "Conteo de ventas activas por mes del año seleccionado."
              : "Conteo de ventas activas por día del mes seleccionado."}
          </p>

          <div className="h-80">
            {loadingCharts ? (
              <div className="h-full flex items-center justify-center text-gray-400">
                Cargando gráfico...
              </div>
            ) : selectedMonth === "all" ? (
              <ResponsiveContainer width="100%" height="100%">
                <ReBarChart data={salesByMonthChartData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#f3f4f6"
                  />
                  <XAxis
                    dataKey="month"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#9ca3af", fontSize: 12 }}
                  />
                  <YAxis
                    allowDecimals={false}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#9ca3af", fontSize: 12 }}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "8px",
                      border: "none",
                      boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                    }}
                    formatter={(value: any) => [value, "Ventas"]}
                  />
                  <Bar
                    dataKey="count"
                    fill="#4f46e5"
                    radius={[4, 4, 0, 0]}
                    barSize={18}
                  >
                    <LabelList
                      dataKey="count"
                      position="top"
                      style={{ fill: "#111827", fontSize: 12 }}
                    />
                  </Bar>
                </ReBarChart>
              </ResponsiveContainer>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ReBarChart data={salesByDayChartData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#f3f4f6"
                  />
                  <XAxis
                    dataKey="day"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#9ca3af", fontSize: 12 }}
                  />
                  <YAxis
                    allowDecimals={false}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#9ca3af", fontSize: 12 }}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "8px",
                      border: "none",
                      boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                    }}
                    formatter={(value: any) => [value, "Ventas"]}
                    labelFormatter={(label: any) => `Día ${label}`}
                  />
                  <Bar
                    dataKey="count"
                    fill="#4f46e5"
                    radius={[4, 4, 0, 0]}
                    barSize={18}
                  >
                    <LabelList
                      dataKey="count"
                      position="top"
                      style={{ fill: "#111827", fontSize: 12 }}
                    />
                  </Bar>
                </ReBarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Chart 2: Ventas por vendedora */}
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
          <h3 className="text-lg font-bold mb-2">
            Ventas por vendedora ({periodLabel})
          </h3>
          <p className="text-xs text-gray-500 mb-6">
            Conteo de ventas activas agrupadas por vendedora.
          </p>

          <div className="h-80">
            {loadingCharts ? (
              <div className="h-full flex items-center justify-center text-gray-400">
                Cargando gráfico...
              </div>
            ) : salesBySellerChartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-gray-400">
                No hay ventas en el período seleccionado.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ReBarChart data={salesBySellerChartData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#f3f4f6"
                  />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#9ca3af", fontSize: 12 }}
                    interval={0}
                    angle={-10}
                    height={60}
                  />
                  <YAxis
                    allowDecimals={false}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#9ca3af", fontSize: 12 }}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "8px",
                      border: "none",
                      boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                    }}
                    formatter={(value: any) => [value, "Ventas"]}
                  />
                  <Bar
                    dataKey="count"
                    fill="#10b981"
                    radius={[4, 4, 0, 0]}
                    barSize={40}
                  >
                    <LabelList
                      dataKey="count"
                      position="top"
                      style={{ fill: "#111827", fontSize: 12 }}
                    />
                  </Bar>
                </ReBarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* TOP PRODUCTOS */}
      <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
        <h3 className="text-lg font-bold mb-2">
          Productos más vendidos (Top 10) — {periodLabel}
        </h3>
        <p className="text-xs text-gray-500 mb-6">
          Cantidad vendida, ordenado de mayor a menor.
        </p>

        <div className="h-96">
          {loadingCharts ? (
            <div className="h-full flex items-center justify-center text-gray-400">
              Cargando gráfico...
            </div>
          ) : topProducts.length === 0 ? (
            <div className="h-full flex items-center justify-center text-gray-400">
              No hay ventas en el período seleccionado.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ReBarChart
                data={topProducts}
                layout="vertical"
                margin={{ top: 8, right: 16, left: 24, bottom: 8 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  horizontal={false}
                  stroke="#f3f4f6"
                />

                <YAxis
                  type="category"
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  width={160}
                  tick={{ fill: "#6b7280", fontSize: 12 }}
                />

                <XAxis
                  type="number"
                  allowDecimals={false}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#9ca3af", fontSize: 12 }}
                />

                <Tooltip
                  contentStyle={{
                    borderRadius: "8px",
                    border: "none",
                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                  }}
                  formatter={(value: any) => [value, "Cantidad"]}
                />

                <Bar
                  dataKey="qty"
                  fill="#6366f1"
                  radius={[0, 6, 6, 0]}
                  barSize={18}
                >
                  <LabelList
                    dataKey="qty"
                    position="right"
                    style={{ fill: "#111827", fontSize: 12 }}
                  />
                </Bar>
              </ReBarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
        </React.Fragment>
      )}
    </div>
  );
};

export default Dashboard;
