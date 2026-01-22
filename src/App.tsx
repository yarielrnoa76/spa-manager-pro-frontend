import React, { useEffect, useState } from "react";
import {
  Routes,
  Route,
  Link,
  useLocation,
  Navigate,
  useNavigate,
} from "react-router-dom";
import {
  LayoutDashboard,
  DollarSign,
  UserPlus,
  Calendar,
  LogOut,
  Menu,
  Store,
  Package,
} from "lucide-react";

import { api } from "./services/api";

import Dashboard from "./pages/Dashboard";
import Sales from "./pages/Sales";
import Leads from "./pages/Leads";
import Appointments from "./pages/Appointments";
import Stocks from "./pages/Stocks";
import Login from "./pages/Login";

const SidebarItem = ({ to, icon: Icon, label, active, onClick }: any) => (
  <Link
    to={to}
    onClick={onClick}
    className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
      active
        ? "bg-indigo-600 text-white"
        : "text-gray-600 hover:bg-indigo-50 hover:text-indigo-600"
    }`}
  >
    <Icon size={20} />
    <span className="font-medium">{label}</span>
  </Link>
);

const FullScreenLoading = ({ text = "Loading..." }: { text?: string }) => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="text-gray-600 font-semibold">{text}</div>
  </div>
);

const App: React.FC = () => {
  const [user, setUser] = useState<any>(null);
  const [booting, setBooting] = useState(true);
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = [
    { to: "/", icon: LayoutDashboard, label: "Dashboard" },
    { to: "/sales", icon: DollarSign, label: "Ventas Diarias" },
    { to: "/stocks", icon: Package, label: "Inventario / Stocks" },
    { to: "/leads", icon: UserPlus, label: "Leads" },
    { to: "/appointments", icon: Calendar, label: "Citas" },
  ];

  const isActive = (path: string) => location.pathname === path;

  async function bootstrapAuth() {
    setBooting(true);

    const token = api.getToken();
    if (!token) {
      setUser(null);
      setBooting(false);
      return;
    }

    try {
      const me = await api.me();
      // api.me() ya limpia token si falla (según tu implementación)
      setUser(me);
    } finally {
      setBooting(false);
    }
  }

  useEffect(() => {
    bootstrapAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isLoginRoute = location.pathname === "/login";

  // Mientras verificamos sesión/token, no renders parciales
  if (booting) return <FullScreenLoading text="Checking session..." />;

  // ✅ SIN usuario:
  // - si no está en /login → redirige a /login
  // - si está en /login → muestra Login
  if (!user) {
    if (!isLoginRoute) return <Navigate to="/login" replace />;
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  // ✅ CON usuario:
  // - si está en /login → redirige a /
  if (user && isLoginRoute) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <aside
        className={`fixed inset-y-0 left-0 w-64 bg-white border-r transform transition-transform lg:relative lg:translate-x-0 ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        } z-30`}
      >
        <div className="h-full flex flex-col p-4">
          <h1 className="text-xl font-bold text-indigo-600 mb-8 px-4 flex items-center gap-2">
            <Store /> SPA Pro
          </h1>

          <nav className="flex-1 space-y-1">
            {navItems.map((item) => (
              <SidebarItem
                key={item.to}
                {...item}
                active={isActive(item.to)}
                onClick={() => setSidebarOpen(false)}
              />
            ))}
          </nav>

          <div className="space-y-2">
            {/* Clear session (por si queda token pegado) */}
            <button
              onClick={() => {
                api.clearToken();
                setUser(null);
                navigate("/login", { replace: true });
              }}
              className="w-full px-4 py-2 rounded-lg border text-gray-700 hover:bg-gray-50 font-semibold"
            >
              Clear session
            </button>

            {/* Logout real */}
            <button
              onClick={async () => {
                await api.logout();
                setUser(null);
                navigate("/login", { replace: true });
              }}
              className="w-full flex items-center justify-center gap-3 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg font-semibold"
            >
              <LogOut size={18} /> Logout
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-16 bg-white border-b flex items-center justify-between px-6">
          <button className="lg:hidden" onClick={() => setSidebarOpen(true)}>
            <Menu />
          </button>

          <div className="font-bold text-gray-800">
            {user?.branch?.name
              ? `Branch: ${user.branch.name}`
              : "Branch: (none)"}
          </div>

          <div className="text-xs text-gray-500">
            {user?.email ? user.email : ""}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/sales" element={<Sales />} />
            <Route path="/stocks" element={<Stocks />} />
            <Route path="/leads" element={<Leads />} />
            <Route path="/appointments" element={<Appointments />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </div>
      </main>
    </div>
  );
};

export default App;
