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
  const s = String(d ?? "");
  if (!s) return "";
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
        const [statsRes, branchesRes, salesRes, productsRes] =
          await Promise.all([
            api.getDashboardStats(selectedBranch),
            api.listBranches(),
            api.listSales("all", { include_cancelled: true } as any),
            api.listProducts(),
          ]);

        if (cancelled) return;

        setStats(statsRes as DashboardStats);
        setBranches(normalizeArray<Branch>(branchesRes));
        setSales(normalizeArray<Sale>(salesRes));
        setProducts(normalizeArray<Product>(productsRes));
      } catch (e: any) {
        if (cancelled) return;
        setStats(null);
        setSales([]);
        setProducts([]);
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

  // ✅ Profit: NO inventamos fuera del mes actual (porque backend está MTD).
  const profitDisplay = useMemo(() => {
    if (!stats) return "—";
    // solo confiable cuando el filtro está en el mes actual
    if (selectedMonth === "all") return "—";
    const now = new Date();
    const isCurrent =
      selectedYear === now.getFullYear() && selectedMonth === now.getMonth() + 1;
    return isCurrent
      ? `$${Number(stats.profit || 0).toLocaleString()}`
      : "—";
  }, [stats, selectedMonth, selectedYear]);

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

  if (loading) return <div className="p-8 font-semibold">Loading dashboard...</div>;

  if (!stats)
    return (
      <div className="p-8 font-semibold text-red-600">
        {errorMsg || "Dashboard not available"}
      </div>
    );

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Panel de Control</h1>
          <p className="text-gray-500 text-sm">
            Resumen de actividad para tus sucursales.
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Período: <span className="font-bold text-gray-600">{periodLabel}</span>
          </p>
        </div>

        {/* FILTROS */}
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
      </div>

      {/* STATS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title={`Valor de Ventas (${periodLabel})`}
          value={`$${Number(kpi.totalSales || 0).toLocaleString()}`}
          icon={DollarSign}
          color="bg-indigo-600"
        />

        <StatCard
          title={`Ganancia Neta (${selectedMonth === "all" ? "—" : "Mes actual"})`}
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
    </div>
  );
};

export default Dashboard;
