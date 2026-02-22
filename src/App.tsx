import React, { useEffect, useState, useCallback } from "react";
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
  Shield,
  ChevronDown,
  Building2,
  History,
} from "lucide-react";

import { api } from "./services/api";
import { Tenant } from "./types";

import Dashboard from "./pages/Dashboard";
import Sales from "./pages/Sales";
import Leads from "./pages/Leads";
import Appointments from "./pages/Appointments";
import Stocks from "./pages/Stocks";
import Login from "./pages/Login";
import SettingsPage from "./pages/Settings";
import Tenants from "./pages/Tenants";
import LogManagement from "./pages/LogManagement";

console.log("VITE_API_URL =", import.meta.env.VITE_API_URL);

const SidebarItem = ({
  to,
  icon: Icon,
  label,
  active,
  onClick,
}: {
  to: string;
  icon: React.ElementType;
  label: string;
  active: boolean;
  onClick?: () => void;
}) => (
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

/* ───────── TENANT SELECTOR (SuperAdmin Only) ───────── */
const TenantSelector: React.FC<{
  tenants: Tenant[];
  currentTenantId: number | null;
  onSelect: (tenantId: number) => void;
}> = ({ tenants, currentTenantId, onSelect }) => {
  const [open, setOpen] = useState(false);

  const currentTenant = tenants.find((t) => t.id === currentTenantId);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 border border-indigo-200 rounded-lg text-sm font-semibold text-indigo-700 hover:bg-indigo-100 transition"
      >
        <Building2 size={14} />
        <span className="max-w-[140px] truncate">
          {currentTenant?.name || "Select Tenant"}
        </span>
        <ChevronDown size={14} />
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border z-50 py-1 max-h-64 overflow-y-auto">
            {tenants.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  onSelect(t.id);
                  setOpen(false);
                }}
                className={`w-full text-left px-4 py-2.5 text-sm hover:bg-indigo-50 transition flex items-center justify-between ${t.id === currentTenantId
                  ? "bg-indigo-50 text-indigo-700 font-semibold"
                  : "text-gray-700"
                  }`}
              >
                <span className="truncate">{t.name}</span>
                {t.status === "suspended" && (
                  <span className="text-xs text-yellow-600 bg-yellow-50 px-1.5 py-0.5 rounded">
                    suspended
                  </span>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

/* ───────── MAIN APP ───────── */
interface UserData {
  id: string;
  name: string;
  email: string;
  tenant_id?: number | null;
  tenant?: { id: number; name: string; slug?: string } | null;
  is_super_admin?: boolean;
  branch?: { id: number; name: string } | null;
  role: { id: number; name: string };
  permissions: string[];
}

const App: React.FC = () => {
  const [user, setUser] = useState<UserData | null>(null);
  const [booting, setBooting] = useState(true);
  const [isSidebarOpen, setSidebarOpen] = useState(false);

  // Tenant state
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [currentTenantId, setCurrentTenantId] = useState<number | null>(
    (() => {
      const stored = localStorage.getItem("current_tenant_id");
      return stored ? parseInt(stored, 10) : null;
    })()
  );

  const location = useLocation();
  const navigate = useNavigate();

  const isSuperAdmin = user?.is_super_admin === true;

  const perms: string[] = Array.isArray(user?.permissions)
    ? user.permissions
    : [];
  const hasPerm = (p: string) =>
    perms.includes(p) || user?.role?.name === "admin" || isSuperAdmin;

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
      ...(isSuperAdmin || hasPerm("view_logs")
        ? [{ to: "/logs", icon: History, label: "Auditoría (Logs)" }]
        : []),
    ];

  const isActive = (path: string) => location.pathname === path;

  // Load tenants list for SuperAdmin
  const loadTenants = useCallback(async () => {
    if (!isSuperAdmin) return;
    try {
      const data = await api.listTenants();
      setTenants(Array.isArray(data) ? data : []);
    } catch {
      // Ignore
    }
  }, [isSuperAdmin]);

  const handleTenantSelect = (tenantId: number) => {
    setCurrentTenantId(tenantId);
    api.setCurrentTenantId(tenantId);
    // Force reload current page data
    window.location.reload();
  };

  const bootstrapAuth = async () => {
    setBooting(true);
    const token = api.getToken();

    if (!token) {
      setUser(null);
      setBooting(false);
      return;
    }

    try {
      const me = await api.me();
      setUser(me);

      // For non-SuperAdmin, always set their tenant
      if (me && !me.is_super_admin && me.tenant_id) {
        setCurrentTenantId(me.tenant_id);
        api.setCurrentTenantId(me.tenant_id);
      }
    } finally {
      setBooting(false);
    }
  };

  useEffect(() => {
    bootstrapAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (user && isSuperAdmin) {
      loadTenants();
    }
  }, [user, isSuperAdmin, loadTenants]);

  const isLoginRoute = location.pathname === "/login";

  if (booting) return <FullScreenLoading text="Checking session..." />;

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

  if (user && isLoginRoute) return <Navigate to="/" replace />;

  // Determine display tenant name
  const currentTenantName =
    isSuperAdmin
      ? tenants.find((t) => t.id === currentTenantId)?.name ||
      user?.tenant?.name ||
      "No Tenant Selected"
      : user?.tenant?.name || "—";

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
                api.clearCurrentTenantId();
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
        <header className="h-16 bg-white border-b flex items-center px-6 gap-4">
          {/* LEFT SIDE */}
          <div className="flex items-center gap-4">
            <button className="lg:hidden" onClick={() => setSidebarOpen(true)}>
              <Menu />
            </button>
          </div>

          {/* RIGHT SIDE */}
          <div className="ml-auto flex items-center gap-4">
            {/* Tenant indicator/selector */}
            {isSuperAdmin && tenants.length > 0 ? (
              <TenantSelector
                tenants={tenants}
                currentTenantId={currentTenantId}
                onSelect={handleTenantSelect}
              />
            ) : (
              <div className="hidden sm:flex items-center gap-2 text-xs">
                <span className="px-2.5 py-1 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-full text-indigo-700 font-semibold flex items-center gap-1.5">
                  <Building2 size={12} />
                  {currentTenantName}
                </span>
              </div>
            )}

            {/* User info */}
            <div className="text-xs text-gray-500">
              {user?.email ?? ""}{" "}
              <span className="font-bold">
                ({user?.role?.name ?? "No Role"})
              </span>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6">
          <Routes>
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
                    canSeeSettings ? (
                      <SettingsPage
                        isSuperAdmin={isSuperAdmin}
                        currentTenantName={currentTenantName}
                      />
                    ) : (
                      <Navigate to="/" replace />
                    )
                  }
                />
                <Route
                  path="/logs"
                  element={
                    isSuperAdmin || hasPerm("view_logs") ? (
                      <LogManagement />
                    ) : (
                      <Navigate to="/" replace />
                    )
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
