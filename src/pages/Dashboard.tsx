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
  Building2,
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

  const nowInit = new Date();
  const [selectedMonth, setSelectedMonth] = useState<MonthFilter>(nowInit.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(nowInit.getFullYear());
  const [activeTab, setActiveTab] = useState<"summary" | "annual">("summary");

  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>("");

  const [sales, setSales] = useState<Sale[]>([]);
  const [loadingCharts, setLoadingCharts] = useState<boolean>(true);
  const [products, setProducts] = useState<Product[]>([]);

  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      setLoading(true);
      setLoadingCharts(true);
      setErrorMsg("");
      try {
        const [statsRes, branchesRes, salesRes, productsRes, userRes] = await Promise.all([
          api.getDashboardStats(selectedBranch),
          api.listBranches(),
          api.listSales("all", { include_cancelled: true } as any),
          api.listProducts(),
          api.me(),
        ]);
        if (cancelled) return;
        setStats(statsRes as DashboardStats);
        setBranches(normalizeArray<Branch>(branchesRes));
        setSales(normalizeArray<Sale>(salesRes));
        setProducts(normalizeArray<Product>(productsRes));
        setUser(userRes);
      } catch (e: any) {
        if (cancelled) return;
        setStats(null); setSales([]); setProducts([]);
        setErrorMsg(e?.message || "Failed to load dashboard data");
      } finally {
        if (!cancelled) { setLoading(false); setLoadingCharts(false); }
      }
    };
    fetchData();
    return () => { cancelled = true; };
  }, [selectedBranch]);

  const productNameById = useMemo(() => {
    const map = new Map<string, string>();
    products.forEach((p) => map.set(String(p.id), p.name));
    return map;
  }, [products]);

  const yearOptions = useMemo(() => {
    const y = new Date().getFullYear();
    const arr: number[] = [];
    for (let yy = y - 5; yy <= y + 1; yy++) arr.push(yy);
    return arr;
  }, []);

  const period = useMemo(() => {
    const now = new Date();
    const isCurrentYear = now.getFullYear() === selectedYear;
    if (selectedMonth === "all") {
      const start = new Date(selectedYear, 0, 1);
      const end = isCurrentYear ? now : new Date(selectedYear, 11, 31);
      return { mode: "year" as const, start, end, startStr: toISODate(start), endStr: toISODate(end) };
    }
    const start = new Date(selectedYear, selectedMonth - 1, 1);
    const endOfMonth = new Date(selectedYear, selectedMonth, 0);
    const isCurrentMonth = isCurrentYear && now.getMonth() + 1 === selectedMonth;
    const end = isCurrentMonth ? now : endOfMonth;
    return {
      mode: "month" as const, start, end, startStr: toISODate(start), endStr: toISODate(end),
      daysInRange: isCurrentMonth ? end.getDate() : endOfMonth.getDate(),
    };
  }, [selectedMonth, selectedYear]);

  const periodSales = useMemo(() => {
    return (sales || []).filter((s) => {
      const d = normalizeDate(s.date);
      if (!d || d < period.startStr || d > period.endStr) return false;
      if (selectedBranch !== "all" && String(s.branch_id ?? "") !== String(selectedBranch)) return false;
      return !isSaleCancelled(s);
    });
  }, [sales, selectedBranch, period.startStr, period.endStr]);

  const kpi = useMemo(() => {
    const totalSales = periodSales.reduce((acc, s) => acc + toNum(s.amount), 0);
    const salesCount = periodSales.length;
    const productsSold = periodSales.reduce((acc, s) => acc + Math.max(1, toNum(s.quantity)), 0);
    return { totalSales, salesCount, productsSold };
  }, [periodSales]);

  const periodLabel = useMemo(() => {
    if (selectedMonth === "all") return `Año ${selectedYear}`;
    const m = MONTHS.find((x) => x.value === selectedMonth)?.label || "Mes";
    return `${m} ${selectedYear}`;
  }, [selectedMonth, selectedYear]);

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
    return `$${totalProfit.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
  }, [periodSales, products]);

  const salesByDayChartData = useMemo(() => {
    if (period.mode !== "month") return [];
    const base = Array.from({ length: period.daysInRange }, (_, i) => ({ day: String(i + 1), count: 0 }));
    periodSales.forEach((s) => {
      const d = normalizeDate(s.date);
      if (d) {
        const dd = new Date(d + "T00:00:00");
        if (dd.getMonth() + 1 === selectedMonth) {
          const row = base.find(x => x.day === String(dd.getDate()));
          if (row) row.count++;
        }
      }
    });
    return base;
  }, [period, periodSales, selectedMonth]);

  const salesByMonthChartData = useMemo(() => {
    if (period.mode !== "year") return [];
    const base = MONTHS.map((m) => ({ month: m.short, count: 0 }));
    periodSales.forEach((s) => {
      const d = normalizeDate(s.date);
      if (d) {
        const mIdx = new Date(d + "T00:00:00").getMonth();
        if (base[mIdx]) base[mIdx].count++;
      }
    });
    return base;
  }, [period, periodSales]);

  const salesBySellerChartData = useMemo(() => {
    const map = new Map<string, number>();
    periodSales.forEach((s) => {
      const name = s?.seller?.name || s?.seller_name || "Sin vendedora";
      map.set(name, (map.get(name) || 0) + 1);
    });
    return Array.from(map.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  }, [periodSales]);

  const topProducts = useMemo(() => {
    const map = new Map<string, number>();
    periodSales.forEach((s) => {
      const name = s?.product?.name || s?.product_name || productNameById.get(String(s.product_id)) || "Producto sin nombre";
      map.set(name, (map.get(name) || 0) + Math.max(1, toNum(s.quantity)));
    });
    return Array.from(map.entries()).map(([name, qty]) => ({ name, qty })).sort((a, b) => b.qty - a.qty).slice(0, 10);
  }, [periodSales, productNameById]);

  const weeklyBreakdown = useMemo(() => {
    if (period.mode !== "month") return [];
    const weeks: { start: string; end: string; total: number; count: number }[] = [];
    let curr = new Date(period.start);
    while (curr <= period.end) {
      const wStart = new Date(curr);
      const wEnd = new Date(curr);
      wEnd.setDate(wEnd.getDate() + (6 - wEnd.getDay()));
      if (wEnd > period.end) wEnd.setTime(period.end.getTime());
      const sStr = toISODate(wStart); const eStr = toISODate(wEnd);
      const ws = periodSales.filter(s => { const d = normalizeDate(s.date); return d >= sStr && d <= eStr; });
      weeks.push({ start: sStr, end: eStr, count: ws.length, total: ws.reduce((a, s) => a + toNum(s.amount), 0) });
      curr.setDate(curr.getDate() + (7 - curr.getDay()));
      if (curr.getDay() !== 1) curr.setDate(curr.getDate() + 1);
    }
    return weeks;
  }, [period, periodSales]);

  const annualSummary = useMemo(() => {
    const yearSales = sales.filter(s => normalizeDate(s.date).startsWith(String(selectedYear)) && !isSaleCancelled(s));
    const data = branches.map(b => {
      const months = Array(12).fill(0);
      yearSales.filter(s => String(s.branch_id) === String(b.id)).forEach(s => {
        months[new Date(normalizeDate(s.date) + "T00:00:00").getMonth()] += toNum(s.amount);
      });
      return { branchName: b.name, months, total: months.reduce((a, b) => a + b, 0) };
    });
    const totals = Array(12).fill(0);
    data.forEach(d => d.months.forEach((m, i) => totals[i] += m));
    return { branches: data, totals, grandTotal: totals.reduce((a, b) => a + b, 0) };
  }, [sales, branches, selectedYear]);

  if (loading) return <div className="p-8 font-semibold">Cargando panel...</div>;
  if (!stats) return <div className="p-8 text-red-600 font-bold">{errorMsg || "Error al cargar datos"}</div>;

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Panel de Control</h1>
          <p className="text-gray-500 text-sm">Resumen de actividad operativa</p>
          <p className="text-xs text-gray-400 mt-1">Período: <span className="font-bold text-gray-600">{periodLabel}</span></p>
        </div>
        <div className="flex items-center gap-3 bg-white p-2 rounded-lg border border-gray-200 shadow-sm flex-wrap">
          <Filter size={18} className="text-gray-400" />
          <select className="bg-transparent border-none focus:ring-0 text-sm font-medium pr-6" value={selectedBranch} onChange={e => setSelectedBranch(e.target.value)}>
            <option value="all">Todas las Sucursales</option>
            {branches.map(b => <option key={b.id} value={String(b.id)}>{b.name}</option>)}
          </select>
          <select className="bg-transparent border-none focus:ring-0 text-sm font-medium pr-6" value={String(selectedMonth)} onChange={e => setSelectedMonth(e.target.value === "all" ? "all" : Number(e.target.value))}>
            <option value="all">Todo el Año</option>
            {MONTHS.map(m => <option key={m.value} value={String(m.value)}>{m.label}</option>)}
          </select>
          <select className="bg-transparent border-none focus:ring-0 text-sm font-medium pr-2" value={String(selectedYear)} onChange={e => setSelectedYear(Number(e.target.value))}>
            {yearOptions.map(y => <option key={y} value={String(y)}>{y}</option>)}
          </select>
        </div>
      </div>

      <div className="flex border-b border-gray-200 gap-8">
        <button onClick={() => setActiveTab("summary")} className={`pb-4 text-sm font-bold transition-all relative ${activeTab === 'summary' ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}>
          Resumen de Actividad
          {activeTab === 'summary' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-600 rounded-t-full" />}
        </button>
        <button onClick={() => setActiveTab("annual")} className={`pb-4 text-sm font-bold transition-all relative ${activeTab === 'annual' ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}>
          Resumen Anual y Cierre
          {activeTab === 'annual' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-600 rounded-t-full" />}
        </button>
      </div>

      {activeTab === "summary" ? (
        <div className="space-y-8 animate-in fade-in duration-500">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard title={`Ventas (${periodLabel})`} value={`$${kpi.totalSales.toLocaleString()}`} icon={DollarSign} color="bg-indigo-600" />
            <StatCard title="Ganancia Est." value={profitDisplay} icon={TrendingUp} color="bg-emerald-600" />
            <StatCard title="Cant. Ventas" value={kpi.salesCount} icon={Users} color="bg-amber-500" />
            <StatCard title="Productos" value={kpi.productsSold} icon={ShoppingBag} color="bg-rose-500" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
              <h3 className="text-lg font-bold mb-4">{selectedMonth === "all" ? "Ventas por mes" : "Ventas por día"}</h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <ReBarChart data={selectedMonth === "all" ? salesByMonthChartData : salesByDayChartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis dataKey={selectedMonth === "all" ? "month" : "day"} axisLine={false} tickLine={false} tick={{ fill: "#9ca3af", fontSize: 12 }} />
                    <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: "#9ca3af", fontSize: 12 }} />
                    <Tooltip contentStyle={{ borderRadius: "8px", border: "none" }} />
                    <Bar dataKey="count" fill="#4f46e5" radius={[4, 4, 0, 0]} barSize={18} />
                  </ReBarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
              <h3 className="text-lg font-bold mb-4">Ventas por vendedora</h3>
              <div className="h-80">
                {salesBySellerChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <ReBarChart data={salesBySellerChartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#9ca3af", fontSize: 10 }} interval={0} angle={-10} height={40} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} barSize={40} />
                    </ReBarChart>
                  </ResponsiveContainer>
                ) : <div className="h-full flex items-center justify-center text-gray-400">Sin datos</div>}
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
            <h3 className="text-lg font-bold mb-6">Top 10 Productos</h3>
            <div className="h-80">
              {topProducts.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ReBarChart data={topProducts} layout="vertical">
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip />
                    <Bar dataKey="qty" fill="#6366f1" radius={[0, 4, 4, 0]} />
                  </ReBarChart>
                </ResponsiveContainer>
              ) : <div className="h-full flex items-center justify-center text-gray-400">Sin datos</div>}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-8 animate-in fade-in duration-500">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="bg-indigo-600 p-6 text-white">
              <h2 className="text-xl font-bold uppercase">Resumen Anual {selectedYear}</h2>
              <p className="text-indigo-100 text-xs">Cierre consolidado por sucursal</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 text-[10px] uppercase font-bold text-gray-400 border-b">
                    <th className="px-6 py-3 sticky left-0 bg-gray-50">Sucursal</th>
                    {MONTHS.map(m => <th key={m.value} className="px-2 py-3 text-center">{m.short}</th>)}
                    <th className="px-6 py-3 text-right text-indigo-600">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {user?.tenant?.name && (
                    <tr className="bg-indigo-50/30">
                      <td colSpan={14} className="px-6 py-2 text-indigo-700 font-black uppercase tracking-wider text-[10px]">
                        Empresa: {user.tenant.name}
                      </td>
                    </tr>
                  )}
                  {annualSummary.branches.map((b, idx) => (
                    <tr key={idx} className={idx % 2 === 1 ? "bg-blue-50/10" : "bg-white"}>
                      <td className="px-6 py-4 font-bold sticky left-0 bg-inherit">{b.branchName}</td>
                      {b.months.map((m, i) => <td key={i} className="px-2 py-4 text-center">{m > 0 ? `$${Math.round(m/1000)}k` : "—"}</td>)}
                      <td className="px-6 py-4 text-right font-black text-indigo-600">${b.total.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-indigo-50 font-black text-indigo-900 border-t-2 border-indigo-100">
                  <tr>
                    <td className="px-6 py-4">TOTALES</td>
                    {annualSummary.totals.map((t, i) => <td key={i} className="px-2 py-4 text-center">{t > 0 ? `$${Math.round(t/1000)}k` : "—"}</td>)}
                    <td className="px-6 py-4 text-right">${annualSummary.grandTotal.toLocaleString()}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100 flex items-center gap-4">
              <div className="p-3 bg-emerald-500 text-white rounded-xl shadow-lg"><TrendingUp size={24} /></div>
              <div>
                <p className="text-[10px] uppercase font-black text-emerald-600">Proyección anual</p>
                <h3 className="text-xl font-black">${annualSummary.grandTotal.toLocaleString()}</h3>
              </div>
            </div>
            <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100 flex items-center gap-4">
              <div className="p-3 bg-indigo-500 text-white rounded-xl shadow-lg"><Building2 size={24} /></div>
              <div>
                <p className="text-[10px] uppercase font-black text-indigo-600">Sucursales</p>
                <h3 className="text-xl font-black">{branches.length}</h3>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;

