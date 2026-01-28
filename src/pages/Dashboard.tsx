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
  ArrowRight,
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

// Ventas (DailyLog) — lo tipamos “suave” para no romper si backend cambia keys
type Sale = {
  id: number;
  date: string;
  branch_id?: number | string;
  seller_id?: number | string | null;
  seller_name?: string | null;
  seller?: { id?: number | string; name?: string | null } | null;
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

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>("all");

  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>("");

  // ✅ ventas para armar gráficos
  const [sales, setSales] = useState<Sale[]>([]);
  const [loadingCharts, setLoadingCharts] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      setLoading(true);
      setLoadingCharts(true);
      setErrorMsg("");

      try {
        const [statsRes, branchesRes, salesRes] = await Promise.all([
          api.getDashboardStats(selectedBranch),
          api.listBranches(),
          // ✅ traemos ventas (incluye canceladas) y filtramos en frontend según selector
          api.listSales("all", { include_cancelled: true } as any),
        ]);

        if (cancelled) return;

        setStats(statsRes as DashboardStats);
        setBranches(normalizeArray<Branch>(branchesRes));
        setSales(normalizeArray<Sale>(salesRes));
      } catch (e: any) {
        if (cancelled) return;
        setStats(null);
        setSales([]);
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

  const soldLeads = useMemo(() => {
    return (stats?.recentLeads || [])
      .filter((l) => l.status === "sold")
      .slice(0, 10);
  }, [stats]);

  // -----------------------------
  // ✅ Ventas MTD filtradas (para gráficas)
  // - mes actual hasta hoy
  // - sucursal seleccionada
  // - solo activas (no canceladas) para contar “ventas reales”
  // -----------------------------
  const mtdSales = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const startStr = toISODate(start);
    const endStr = toISODate(now);

    return (sales || []).filter((s) => {
      const d = normalizeDate(s.date);
      if (!d) return false;

      // rango MTD
      if (d < startStr || d > endStr) return false;

      // sucursal
      if (
        selectedBranch !== "all" &&
        String(s.branch_id ?? "") !== String(selectedBranch)
      ) {
        return false;
      }

      // solo activas
      if (isSaleCancelled(s)) return false;

      return true;
    });
  }, [sales, selectedBranch]);

  // -----------------------------
  // ✅ CAMBIO: Lead vendidos (MTD)
  // -----------------------------
  const soldLeadsCount = useMemo(() => {
    // ✅ “leads vendidos” = cantidad de ventas activas del mes (MTD)
    return mtdSales.length;
  }, [mtdSales]);

  // -----------------------------
  // ✅ Chart 1: Ventas por día del mes (hasta hoy)
  // -----------------------------
  const salesByDayChartData = useMemo(() => {
    const now = new Date();
    const daysInRange = now.getDate(); // hasta hoy
    const year = now.getFullYear();
    const month = now.getMonth(); // 0-11

    // init { day: 1..N, count: 0 }
    const base = Array.from({ length: daysInRange }, (_, i) => ({
      day: String(i + 1),
      count: 0,
    }));

    const indexByDay = new Map<string, number>();
    base.forEach((row, idx) => indexByDay.set(row.day, idx));

    mtdSales.forEach((s) => {
      const d = normalizeDate(s.date); // YYYY-MM-DD
      if (!d) return;
      const dd = new Date(d + "T00:00:00");
      if (dd.getFullYear() !== year || dd.getMonth() !== month) return;
      const dayNumber = String(dd.getDate());
      const idx = indexByDay.get(dayNumber);
      if (idx === undefined) return;
      base[idx].count += 1;
    });

    return base;
  }, [mtdSales]);

  // -----------------------------
  // ✅ Chart 2: Ventas por vendedora
  // -----------------------------
  const salesBySellerChartData = useMemo(() => {
    const map = new Map<string, number>();

    const getSellerLabel = (s: Sale) => {
      const name =
        s?.seller?.name ||
        s?.seller_name ||
        (s?.seller_id != null ? `Seller ${String(s.seller_id)}` : null);

      return String(name || "Sin vendedora");
    };

    mtdSales.forEach((s) => {
      const label = getSellerLabel(s);
      map.set(label, (map.get(label) || 0) + 1);
    });

    // orden desc por count
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [mtdSales]);

  if (loading)
    return <div className="p-8 font-semibold">Loading dashboard...</div>;
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
        </div>

        <div className="flex items-center gap-3 bg-white p-2 rounded-lg border border-gray-200 shadow-sm">
          <Filter size={18} className="text-gray-400" />
          <select
            className="bg-transparent border-none focus:ring-0 text-sm font-medium pr-8"
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
          >
            <option value="all">All Branches</option>
            {branches.map((b) => (
              <option key={b.id} value={String(b.id)}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Valor de Ventas (MTD)"
          value={`$${Number(stats.totalSales || 0).toLocaleString()}`}
          icon={DollarSign}
          color="bg-indigo-600"
        />
        <StatCard
          title="Ganancia Neta (MTD)"
          value={`$${Number(stats.profit || 0).toLocaleString()}`}
          icon={TrendingUp}
          color="bg-emerald-600"
        />

        {/* ✅ CAMBIO: ahora es “Leads Vendidos (MTD)” */}
        <StatCard
          title="Cantidad de Ventas (MTD)"
          value={soldLeadsCount}
          icon={Users}
          color="bg-amber-500"
        />

        <StatCard
          title="Productos Vendidos (MTD)"
          value={stats.salesCount}
          icon={ShoppingBag}
          color="bg-rose-500"
        />
      </div>

      {/* CHARTS + RECENT SOLD LEADS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* ✅ Chart 1: Ventas por día */}
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
          <h3 className="text-lg font-bold mb-2">
            Ventas por día (Mes actual)
          </h3>
          <p className="text-xs text-gray-500 mb-6">
            Conteo de ventas desde el día 1 hasta hoy.
          </p>

          <div className="h-80">
            {loadingCharts ? (
              <div className="h-full flex items-center justify-center text-gray-400">
                Cargando gráfico...
              </div>
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
                    {/* ✅ label arriba de cada barra */}
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

        {/* ✅ Chart 2: Ventas por vendedora */}
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
          <h3 className="text-lg font-bold mb-2">Ventas por vendedora (MTD)</h3>
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
                No hay ventas en el mes actual para graficar.
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
                    {/* ✅ label arriba de cada barra */}
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

      {/* RECENT SOLD LEADS */}
      <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex flex-col">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold">Recent Sold Leads</h3>
          <button className="text-indigo-600 text-sm font-semibold flex items-center gap-1 hover:underline">
            View All <ArrowRight size={14} />
          </button>
        </div>

        <div className="flex-1 space-y-4">
          {soldLeads.length > 0 ? (
            soldLeads.map((lead) => (
              <div
                key={lead.id}
                className="flex items-center gap-4 p-3 rounded-lg hover:bg-gray-50 transition"
              >
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-medium">
                  {(lead.name || "?").charAt(0)}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold">{lead.name}</p>
                  <p className="text-xs text-gray-500">
                    {lead.source ?? "Venta Directa"}
                  </p>
                </div>
                <span className="px-2 py-1 rounded-full text-[10px] font-bold uppercase bg-green-100 text-green-700">
                  Vendido
                </span>
              </div>
            ))
          ) : (
            <p className="text-gray-400 text-sm italic text-center py-10">
              No hay ventas recientes para mostrar.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
