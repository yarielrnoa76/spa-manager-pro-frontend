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
  Settings,
} from "lucide-react";

import { api } from "./services/api";

import Dashboard from "./pages/Dashboard";
import Sales from "./pages/Sales";
import Leads from "./pages/Leads";
import Appointments from "./pages/Appointments";
import Stocks from "./pages/Stocks";
import Login from "./pages/Login";

import SettingsPage from "./pages/Settings";

console.log("VITE_API_URL =", import.meta.env.VITE_API_URL);

const SidebarItem = ({ to, icon: Icon, label, active, onClick }: any) => (
  <Link
    to={to}
    onClick={onClick}
    className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${active
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

  // /api/user retorna permissions como array plano de strings ["view_branch", "view_leads", ...]
  const perms: string[] = Array.isArray(user?.permissions) ? user.permissions : [];
  const hasPerm = (p: string) =>
    perms.includes(p) || user?.role?.name === "admin";

  const canSeeDashboard = hasPerm("view_dashboard");
  const canSeeSettings = hasPerm("manage_settings");

  const isVendedora = user?.role?.name === "vendedora";

  const navItems = isVendedora
    ? [{ to: "/sales", icon: DollarSign, label: "Ventas Diarias" }]
    : [
      ...(canSeeDashboard
        ? [{ to: "/", icon: LayoutDashboard, label: "Dashboard" }]
        : []),
      { to: "/sales", icon: DollarSign, label: "Ventas Diarias" },
      { to: "/stocks", icon: Package, label: "Inventario / Stocks" },
      { to: "/leads", icon: UserPlus, label: "Leads" },
      { to: "/appointments", icon: Calendar, label: "Citas" },
      ...(canSeeSettings
        ? [{ to: "/settings", icon: Settings, label: "Configuración" }]
        : []),
    ];

  const isActive = (path: string) => location.pathname === path;

  const bootstrapAuth = async () => {
    setBooting(true);
    const token = api.getToken();

    if (!token) {
      setUser(null);
      setBooting(false);
      return;
    }

    try {
      const me = await api.me(); // si falla, api.me limpia token y devuelve null
      setUser(me);
    } finally {
      setBooting(false);
    }
  };

  useEffect(() => {
    bootstrapAuth();
     
  }, []);

  const isLoginRoute = location.pathname === "/login";

  if (booting) return <FullScreenLoading text="Checking session..." />;

  // Sin user -> forzar /login
  if (!user) {
    if (!isLoginRoute) return <Navigate to="/login" replace />;
    return (
      <Routes>
        <Route
          path="/login"
          element={<Login onLoginSuccess={bootstrapAuth} />}
        />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  // Con user -> si está en /login, manda al dashboard
  if (user && isLoginRoute) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <aside
        className={`fixed inset-y-0 left-0 w-64 bg-white border-r transform transition-transform lg:relative lg:translate-x-0 ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"
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
        <header className="h-16 bg-white border-b flex items-center px-6">
          {/* LADO IZQUIERDO */}
          <div className="flex items-center gap-4">
            <button className="lg:hidden" onClick={() => setSidebarOpen(true)}>
              <Menu />
            </button>
          </div>

          {/* LADO DERECHO */}
          <div className="ml-auto text-xs text-gray-500">
            {user?.email ?? ""} <span className="font-bold">({user?.role?.name ?? "No Role"})</span>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6">
          <Routes>
            {/* Si es vendedora, SOLO ve /sales. Cualquier otra cosa -> /sales */}
            {user?.role?.name === "vendedora" ? (
              <>
                <Route path="/sales" element={<Sales user={user} />} />
                <Route path="*" element={<Navigate to="/sales" replace />} />
              </>
            ) : (
              <>
                <Route path="/" element={<Dashboard />} />
                <Route path="/sales" element={<Sales user={user} />} />
                <Route path="/stocks" element={<Stocks />} />
                <Route path="/leads" element={<Leads />} />
                <Route path="/appointments" element={<Appointments />} />
                <Route
                  path="/settings"
                  element={
                    canSeeSettings ? <SettingsPage /> : <Navigate to="/" replace />
                  }
                />
                <Route path="*" element={<Navigate to="/" replace />} />
              </>
            )}
          </Routes>
        </div>
      </main>
    </div>
  );
};

export default App;
