import React, { useEffect, useState } from "react";
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
  recentLeads: Lead[];
  salesCount: number;
  lowStockCount: number;
};

function normalizeArray<T = any>(payload: unknown): T[] {
  // API puede devolver: []  ó  {data: []}
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
        console.error(e);
        setStats(null);
        setBranches([]);
        setErrorMsg(e?.message || "Failed to load dashboard data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [selectedBranch]);

  const chartData = [
    { name: "Mon", sales: 4000, leads: 2400 },
    { name: "Tue", sales: 3000, leads: 1398 },
    { name: "Wed", sales: 2000, leads: 9800 },
    { name: "Thu", sales: 2780, leads: 3908 },
    { name: "Fri", sales: 1890, leads: 4800 },
    { name: "Sat", sales: 2390, leads: 3800 },
    { name: "Sun", sales: 3490, leads: 4300 },
  ];

  if (loading) {
    return (
      <div className="p-8">
        <div className="font-semibold">Loading dashboard...</div>
        {errorMsg && (
          <div className="mt-3 text-red-600 text-sm">{errorMsg}</div>
        )}
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="p-8">
        <div className="font-semibold">Dashboard not available</div>
        {errorMsg && (
          <div className="mt-3 text-red-600 text-sm">{errorMsg}</div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Good Morning!</h1>
          <p className="text-gray-500 text-sm">
            Here's what's happening at your SPA branches today.
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Sales (MTD)"
          value={`$${Number(stats.totalSales || 0).toLocaleString()}`}
          icon={DollarSign}
          color="bg-indigo-600"
          trend="12.5% from last month"
          trendUp={true}
        />
        <StatCard
          title="Net Profit"
          value={`$${Number(stats.profit || 0).toLocaleString()}`}
          icon={TrendingUp}
          color="bg-emerald-600"
          trend="8.2% from last month"
          trendUp={true}
        />
        <StatCard
          title="Active Leads"
          value={(stats.recentLeads || []).length}
          icon={Users}
          color="bg-amber-500"
        />
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
                />
                <YAxis
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
                />
                <Bar
                  dataKey="sales"
                  fill="#4f46e5"
                  radius={[4, 4, 0, 0]}
                  barSize={40}
                />
              </ReBarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold">Recent Leads</h3>
            <button className="text-indigo-600 text-sm font-semibold flex items-center gap-1 hover:underline">
              View All <ArrowRight size={14} />
            </button>
          </div>

          <div className="flex-1 space-y-4">
            {(stats.recentLeads || []).map((lead) => (
              <div
                key={lead.id}
                className="flex items-center gap-4 p-3 rounded-lg hover:bg-gray-50 transition"
              >
                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-medium">
                  {(lead.name || "?").charAt(0)}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold">{lead.name}</p>
                  <p className="text-xs text-gray-500">{lead.source ?? "-"}</p>
                </div>
                <span
                  className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                    lead.status === "new"
                      ? "bg-indigo-100 text-indigo-700"
                      : "bg-green-100 text-green-700"
                  }`}
                >
                  {lead.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
