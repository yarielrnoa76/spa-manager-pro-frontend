import React, { useEffect, useState, useMemo } from "react";
import {
  BarChart as ReBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
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
  recentLeads: Lead[]; // Asumimos que aquí vienen todos los leads recientes del dashboard
  salesCount: number;
  lowStockCount: number;
};

function normalizeArray<T = any>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === "object" && "data" in payload) {
    const d = (payload as any).data;
    if (Array.isArray(d)) return d as T[];
  }
  return [];
}

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>("all");

  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      setLoading(true);
      setErrorMsg("");
      try {
        const [statsRes, branchesRes] = await Promise.all([
          api.getDashboardStats(selectedBranch),
          api.listBranches(),
        ]);
        if (cancelled) return;
        setStats(statsRes as DashboardStats);
        setBranches(normalizeArray<Branch>(branchesRes));
      } catch (e: any) {
        if (cancelled) return;
        setStats(null);
        setErrorMsg(e?.message || "Failed to load dashboard data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchData();
    return () => { cancelled = true; };
  }, [selectedBranch]);

  // --- LÓGICA SOLICITADA ---

  // 1. Active Leads: Cantidad de leads en estado "contacted"
  const activeLeadsCount = useMemo(() => {
    return (stats?.recentLeads || []).filter(l => l.status === "contacted").length;
  }, [stats]);

  // 2. Recent Leads: Nombres de los que se han vendido recientemente (primeros 10)
  const soldLeads = useMemo(() => {
    return (stats?.recentLeads || [])
      .filter(l => l.status === "sold")
      .slice(0, 10);
  }, [stats]);

  const chartData = [
    { name: "Mon", sales: 4000 },
    { name: "Tue", sales: 3000 },
    { name: "Wed", sales: 2000 },
    { name: "Thu", sales: 2780 },
    { name: "Fri", sales: 1890 },
    { name: "Sat", sales: 2390 },
    { name: "Sun", sales: 3490 },
  ];

  if (loading) return <div className="p-8 font-semibold">Loading dashboard...</div>;
  if (!stats) return <div className="p-8 font-semibold text-red-600">{errorMsg || "Dashboard not available"}</div>;

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Good Morning!</h1>
          <p className="text-gray-500 text-sm">Resumen de actividad para tus sucursales.</p>
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
              <option key={b.id} value={String(b.id)}>{b.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Sales (MTD)"
          value={`$${Number(stats.totalSales || 0).toLocaleString()}`}
          icon={DollarSign}
          color="bg-indigo-600"
        />
        <StatCard
          title="Net Profit"
          value={`$${Number(stats.profit || 0).toLocaleString()}`}
          icon={TrendingUp}
          color="bg-emerald-600"
        />
        {/* ✅ CAMBIO: Valor basado en leads 'contacted' */}
        <StatCard
          title="Active Leads"
          value={activeLeadsCount}
          icon={Users}
          color="bg-amber-500"
        />
        {/* ✅ CAMBIO: Service Items representa ventas del mes */}
        <StatCard
          title="Service Items"
          value={stats.salesCount}
          icon={ShoppingBag}
          color="bg-rose-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
          <h3 className="text-lg font-bold mb-6">Weekly Performance</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ReBarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#9ca3af", fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "#9ca3af", fontSize: 12 }} />
                <Tooltip contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }} />
                <Bar dataKey="sales" fill="#4f46e5" radius={[4, 4, 0, 0]} barSize={40} />
              </ReBarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold">Recent Sold Leads</h3>
            <button className="text-indigo-600 text-sm font-semibold flex items-center gap-1 hover:underline">
              View All <ArrowRight size={14} />
            </button>
          </div>

          <div className="flex-1 space-y-4">
            {/* ✅ CAMBIO: Solo muestra los primeros 10 leads con status 'sold' */}
            {soldLeads.length > 0 ? (
              soldLeads.map((lead) => (
                <div key={lead.id} className="flex items-center gap-4 p-3 rounded-lg hover:bg-gray-50 transition">
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-medium">
                    {(lead.name || "?").charAt(0)}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{lead.name}</p>
                    <p className="text-xs text-gray-500">{lead.source ?? "Venta Directa"}</p>
                  </div>
                  <span className="px-2 py-1 rounded-full text-[10px] font-bold uppercase bg-green-100 text-green-700">
                    Vendido
                  </span>
                </div>
              ))
            ) : (
              <p className="text-gray-400 text-sm italic text-center py-10">No hay ventas recientes para mostrar.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;