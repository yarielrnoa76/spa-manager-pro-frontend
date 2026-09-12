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
  Ticket,
  HelpCircle,
  MessageSquare,
  X,
  FileText,
} from "lucide-react";

import NotificationBell from "./components/NotificationBell";
import Tickets from "./pages/Tickets";
import Help from "./pages/Help";
import Notifications from "./pages/Notifications";
import PublicLeadForms from "./pages/PublicLeadForms";
import SupportTickets from "./pages/Support/SupportTickets";
import SupportTicketDetail from "./pages/Support/SupportTicketDetail";
import SupportTicketConfig from "./pages/Support/SupportTicketConfig";

import { api, ApiError, TENANT_CONTEXT_STALE_EVENT } from "./services/api";
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
import CommunicationCenter from "./pages/CommunicationCenter";
import ChatAdmin from "./pages/ChatAdmin";
import Expenses from "./pages/Expenses";
import Refunds from "./pages/Refunds";
import PaymentResult from "./pages/PaymentResult";

console.log("VITE_API_URL =", import.meta.env.VITE_API_URL);
console.log("=== DEPLOYMENT HEARTBEAT: V-24.03-EXPENSES-DEPLOYED ===");
console.log("LAST SYNC: 2026-03-24 11:13:22");

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

/* ───────── TENANT SELECTOR ─────────
 * Gate 1B contract: visible for EVERY authenticated user as a context indicator, never as a
 * grant of authority. A regular user always sees their own fixed tenant, disabled, with no
 * dropdown and no way to trigger a switch. Only a SuperAdmin gets the interactive dropdown,
 * and even then the switch is never applied locally -- onSelect must await the real
 * POST /api/tenant/switch confirmation (see handleTenantSelect below) before anything in the
 * UI reflects a new tenant. Visibility here grants nothing by itself; the backend is what
 * enforces the boundary regardless of what this component renders.
 */
const TenantSelector: React.FC<{
  tenants: Tenant[];
  currentTenantId: number | null;
  currentTenantName: string;
  interactive: boolean;
  switching: boolean;
  onSelect: (tenantId: number) => void;
}> = ({ tenants, currentTenantId, currentTenantName, interactive, switching, onSelect }) => {
  const [open, setOpen] = useState(false);

  if (!interactive) {
    return (
      <div
        className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-semibold text-gray-500 cursor-not-allowed"
        title="Tu cuenta está fijada a este tenant. No puedes cambiarlo."
        aria-disabled="true"
      >
        <Building2 size={14} />
        <span className="max-w-[140px] truncate">{currentTenantName}</span>
      </div>
    );
  }

  const currentTenant = tenants.find((t) => t.id === currentTenantId);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        disabled={switching}
        className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 border border-indigo-200 rounded-lg text-sm font-semibold text-indigo-700 hover:bg-indigo-100 transition disabled:opacity-60 disabled:cursor-wait"
      >
        <Building2 size={14} />
        <span className="max-w-[140px] truncate">
          {switching ? "Cambiando…" : currentTenant?.name || "Seleccione un tenant"}
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
                  setOpen(false);
                  onSelect(t.id);
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
export interface UserData {
  id: string;
  name: string;
  email: string;
  tenant_id?: number | null;
  tenant?: { id: number; name: string; slug?: string } | null;
  is_super_admin?: boolean;
  active_tenant_id?: number | null;
  branch?: { id: number; name: string } | null;
  role: { id: number; name: string };
  permissions: string[];
}

const App: React.FC = () => {
  const [user, setUser] = useState<UserData | null>(null);
  const [booting, setBooting] = useState(true);
  const [isSidebarOpen, setSidebarOpen] = useState(false);

  // Tenant state
  //
  // Gate 1A contract: the browser is never the authority for which tenant is selected.
  // currentTenantId starts unset and is set ONLY from a confirmed server response --
  // api.me()'s active_tenant_id on boot (SuperAdmin) / tenant_id (regular user), or
  // api.switchTenant()'s own success response. It is never seeded from localStorage.
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [currentTenantId, setCurrentTenantId] = useState<number | null>(null);
  const [tenantSwitching, setTenantSwitching] = useState(false);
  const [tenantSwitchError, setTenantSwitchError] = useState<string | null>(null);
  // Gate: stale tenant context across tabs/sessions. Set when either (a) a mutating request
  // this tab made was rejected 409 TENANT_CONTEXT_STALE (this account's real active tenant
  // moved on since this tab last confirmed its context), or (b) another tab of the SAME
  // browser changed `current_tenant_id` in the shared localStorage (the `storage` event only
  // ever fires in tabs OTHER than the one that made the change). Blocks with an explanation
  // and a reload rather than silently continuing on a UI that may no longer match reality —
  // never an automatic reload, which could discard whatever the user was doing.
  const [tenantContextStale, setTenantContextStale] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();

  const isSuperAdmin = user?.is_super_admin === true;

  const perms: string[] = Array.isArray(user?.permissions)
    ? user.permissions
    : [];
  const hasPerm = (p: string) =>
    perms.includes(p) || isSuperAdmin;

  const canSeeDashboard = hasPerm("view_dashboard");
  const canSeeSettings = hasPerm("manage_settings") || hasPerm("view_branch") || hasPerm("create_branch") || hasPerm("edit_branch") || hasPerm("delete_branch") || hasPerm("view_users") || hasPerm("create_user") || hasPerm("edit_user") || hasPerm("delete_user") || hasPerm("view_roles") || hasPerm("view_professionals");
  const canSeeExpenses = hasPerm("view_expenses") || hasPerm("delete_expense");
  const canSeeRefunds = hasPerm("view_refunds") || hasPerm("delete_refund");
  const canSeeLogs = hasPerm("view_logs") || hasPerm("manage_logs");
  const canSeePublicLeadForms = hasPerm("view_public_lead_forms");

  const navItems = [
    ...(canSeeDashboard
      ? [{ to: "/", icon: LayoutDashboard, label: "Dashboard" }]
      : []),
    ...(hasPerm("view_all_sales") || hasPerm("view_my_sales_only")
      ? [{ to: "/sales", icon: DollarSign, label: "Ventas Diarias" }]
      : []),
    ...(hasPerm("view_products")
      ? [{ to: "/stocks", icon: Package, label: "Inventario / Stocks" }]
      : []),
    ...(hasPerm("view_leads")
      ? [{ to: "/leads", icon: UserPlus, label: "Leads / Contacts" }]
      : []),
    ...(canSeePublicLeadForms
      ? [{ to: "/lead-forms", icon: FileText, label: "Formularios Web" }]
      : []),
    ...(hasPerm("view_appointments")
      ? [{ to: "/appointments", icon: Calendar, label: "Citas" }]
      : []),
    ...(hasPerm("view_conversations")
      ? [{ to: "/communications", icon: MessageSquare, label: "Live Chat" }]
      : []),
    ...(hasPerm("restore_conversations")
      ? [{ to: "/chat-admin", icon: Shield, label: "Chat Admin" }]
      : []),

    ...(canSeeExpenses
      ? [{ to: "/expenses", icon: DollarSign, label: "Gastos" }]
      : []),
    ...(canSeeRefunds
      ? [{ to: "/refunds", icon: History, label: "Devoluciones" }]
      : []),
    ...(hasPerm("view_ticket")
      ? [{ to: "/tickets", icon: Ticket, label: "Tickets / Tasks" }]
      : []),
    ...(hasPerm("view_support_tickets") || hasPerm("view_all_support_tickets")
      ? [{ to: "/support-tickets", icon: Ticket, label: "Soporte Técnico" }]
      : []),
    { to: "/help", icon: HelpCircle, label: "Ayuda" },
    ...(canSeeSettings
      ? [{ to: "/settings", icon: Settings, label: "Configuración" }]
      : []),
    ...(canSeeLogs
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

  /**
   * Gate 1A/1B: switchTenant() (POST /api/tenant/switch) is the ONLY operation allowed to
   * change the effective tenant -- never local state written ahead of the server's answer.
   * On success, the UI reflects exactly what the server confirmed, then does a full reload to
   * re-derive every screen's data from the new context (never a partial, piecemeal refresh
   * that could leave stale branch/filter/dashboard state from the previous tenant visible).
   * On failure, nothing changes: no optimistic update, no silent "success" state.
   */
  const handleTenantSelect = async (tenantId: number) => {
    setTenantSwitchError(null);
    setTenantSwitching(true);
    try {
      const data = await api.switchTenant(tenantId);
      setCurrentTenantId(data.tenant.id);
      window.location.reload();
    } catch (err: unknown) {
      const message = err instanceof ApiError ? err.message : "No se pudo cambiar de tenant.";
      setTenantSwitchError(message);
      setTenantSwitching(false);
    }
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

      // Gate 1A: currentTenantId always comes from THIS server response, never from
      // localStorage or any client-side cache -- me.tenant_id for a regular user (fixed,
      // never editable by them), me.active_tenant_id for a SuperAdmin (null until they
      // explicitly select one via switchTenant()).
      if (me) {
        if (!me.is_super_admin) {
          setCurrentTenantId(me.tenant_id ?? null);
        } else {
          setCurrentTenantId(me.active_tenant_id ?? null);
        }
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

  // Own session/device: a mutating request just got rejected because the account's real
  // active tenant moved on since this tab last confirmed it. Beyond blocking the render (the
  // early return below fails closed on its own), also drop this tab's own cached
  // tenant-dependent state immediately -- the stale tenant list and id are never left sitting
  // around for anything to read, even incidentally, before the user reloads.
  useEffect(() => {
    const handleStale = () => {
      setTenantContextStale(true);
      setTenants([]);
      setCurrentTenantId(null);
    };
    window.addEventListener(TENANT_CONTEXT_STALE_EVENT, handleStale);
    return () => window.removeEventListener(TENANT_CONTEXT_STALE_EVENT, handleStale);
  }, []);

  // Same browser, a DIFFERENT tab: localStorage is shared across tabs of one origin, and the
  // `storage` event fires only in tabs that did NOT make the change -- exactly the tab whose
  // on-screen state (header, loaded lists) is now stale relative to the account's real
  // selection, even though its own next request would silently pick up the new tenant.
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "current_tenant_id" && e.newValue !== e.oldValue) {
        setTenantContextStale(true);
        setTenants([]);
        setCurrentTenantId(null);
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const isLoginRoute = location.pathname === "/login";
  const isPaymentResultRoute = location.pathname.startsWith("/pay/");

  // Public, unauthenticated route: the paying customer lands here from
  // Stripe Checkout's success_url/cancel_url and never has a session.
  if (isPaymentResultRoute) {
    return (
      <Routes>
        <Route path="/pay/:paymentRequestId" element={<PaymentResult />} />
      </Routes>
    );
  }

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

  // Gate: stale tenant context. Fails closed by REPLACING the entire authenticated app with
  // this blocking screen -- not merely overlaying it -- so no sidebar link, button, form, or
  // any other mutable control from the stale render is ever still present in the DOM to be
  // clicked or submitted. The only escape is the explicit, manual reload; there is no
  // background content behind this screen at all.
  if (tenantContextStale) {
    return (
      <div
        role="alertdialog"
        aria-modal="true"
        className="min-h-screen bg-gray-50 flex items-center justify-center p-4"
      >
        <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6 text-center space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">El tenant activo cambió</h3>
          <p className="text-sm text-gray-600">
            El contexto de tenant se actualizó desde otra pestaña o sesión. Ninguna acción se
            aplicó al tenant incorrecto. Recarga para continuar con el contexto correcto.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition"
          >
            Recargar
          </button>
        </div>
      </div>
    );
  }

  // Determine display tenant name
  const currentTenantName =
    isSuperAdmin
      ? tenants.find((t) => t.id === currentTenantId)?.name ||
      user?.tenant?.name ||
      "No Tenant Selected"
      : user?.tenant?.name || "—";

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Mobile sidebar backdrop */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 w-64 bg-white border-r transform transition-transform duration-200 ease-in-out lg:relative lg:translate-x-0 ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"
          } z-50 lg:z-auto`}
      >
        <div className="h-full flex flex-col p-4">
          <div className="flex items-center justify-between mb-8 px-4">
            <h1 className="text-xl font-bold text-indigo-600 flex items-center gap-2">
              <Store /> ManagerPro
            </h1>
            <button
              className="lg:hidden p-1 rounded-lg hover:bg-gray-100 text-gray-400"
              onClick={() => setSidebarOpen(false)}
            >
              <X size={20} />
            </button>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto min-h-0">
            {navItems.map((item) => (
              <SidebarItem
                key={item.to}
                {...item}
                active={isActive(item.to)}
                onClick={() => setSidebarOpen(false)}
              />
            ))}
          </nav>

          <div className="space-y-2 shrink-0 pt-2 border-t border-gray-100 mt-2">
            <button
              onClick={() => {
                api.clearToken();
                api.clearCurrentTenantId();
                setUser(null);
                setSidebarOpen(false);
                navigate("/login", { replace: true });
              }}
              className="w-full px-4 py-2 rounded-lg border text-gray-700 hover:bg-gray-50 font-semibold text-sm"
            >
              Clear session
            </button>

            <button
              onClick={async () => {
                await api.logout();
                setUser(null);
                setSidebarOpen(false);
                navigate("/login", { replace: true });
              }}
              className="w-full flex items-center justify-center gap-3 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg font-semibold text-sm"
            >
              <LogOut size={18} /> Logout
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-14 lg:h-16 bg-white border-b flex items-center px-4 lg:px-6 gap-3 shrink-0">
          {/* LEFT SIDE */}
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden p-1.5 rounded-lg hover:bg-gray-100 text-gray-600"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu size={22} />
            </button>
          </div>

          {/* RIGHT SIDE */}
          <div className="ml-auto flex items-center gap-2 lg:gap-4 min-w-0">
            {/* Tenant indicator/selector -- visible for every authenticated user (Gate 1B):
                a fixed, disabled indicator for regular users, an interactive dropdown only
                for SuperAdmin. Visibility here never grants authority by itself. */}
            <div className="flex flex-col items-end gap-1">
              <TenantSelector
                tenants={tenants}
                currentTenantId={currentTenantId}
                currentTenantName={currentTenantName}
                interactive={isSuperAdmin}
                switching={tenantSwitching}
                onSelect={handleTenantSelect}
              />
              {tenantSwitchError && (
                <span className="text-xs text-red-600 max-w-[220px] text-right">{tenantSwitchError}</span>
              )}
            </div>

            <NotificationBell />

            {/* User info */}
            <div className="text-xs text-gray-500 hidden sm:block truncate max-w-[200px]">
              {user?.email ?? ""}{" "}
              <span className="font-bold">
                ({user?.role?.name ?? "No Role"})
              </span>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 lg:p-6">
          {isSuperAdmin && !currentTenantId ? (
            <Routes>
              <Route
                path="/settings"
                element={
                  canSeeSettings ? (
                    <SettingsPage
                      isSuperAdmin={isSuperAdmin}
                      currentTenantName={currentTenantName}
                      currentTenantId={currentTenantId}
                      user={user}
                    />
                  ) : (
                    <Navigate to="/" replace />
                  )
                }
              />
              <Route
                path="*"
                element={
                  <div className="flex flex-col items-center justify-center h-full text-gray-500 mt-20">
                    <Store size={64} className="mb-4 text-indigo-300" />
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">
                      Seleccione un Tenant
                    </h2>
                    <p className="text-sm max-w-md text-center">
                      Al ingresar como Superadmin, debes seleccionar un Tenant (empresa/sucursal principal) en el menú superior derecho para poder visualizar datos y trabajar en el sistema.
                    </p>
                  </div>
                }
              />
            </Routes>
          ) : (
            <Routes>
              <Route path="/" element={hasPerm("view_dashboard") ? <Dashboard /> : <Navigate to="/sales" replace />} />
              <Route path="/sales" element={<Sales user={user} />} />
              <Route path="/stocks" element={<Stocks />} />
              <Route path="/leads" element={<Leads user={user} />} />
              <Route
                path="/lead-forms"
                element={canSeePublicLeadForms ? <PublicLeadForms user={user} /> : <Navigate to="/" replace />}
              />
              <Route path="/appointments" element={<Appointments />} />
              <Route path="/communications" element={<CommunicationCenter user={user} />} />
              <Route path="/chat-admin" element={(isSuperAdmin || hasPerm("ConversationAdmin")) ? <ChatAdmin user={user} /> : <Navigate to="/" replace />} />

              <Route path="/expenses" element={<Expenses user={user} />} />
              <Route path="/refunds" element={<Refunds user={user} />} />
              <Route path="/notifications" element={<Notifications />} />
              <Route
                path="/tickets"
                element={hasPerm("view_ticket") ? <Tickets user={user} /> : <Navigate to="/" replace />}
              />
              <Route
                path="/tickets/:ticketId"
                element={hasPerm("view_ticket") ? <Tickets user={user} /> : <Navigate to="/" replace />}
              />
              <Route path="/support-tickets" element={<SupportTickets user={user} />} />
              <Route path="/support-tickets/config" element={<SupportTicketConfig user={user} />} />
              <Route path="/support-tickets/:id" element={<SupportTicketDetail user={user} />} />
              <Route path="/help" element={<Help />} />
              <Route
                path="/settings"
                element={
                  canSeeSettings ? (
                    <SettingsPage
                      isSuperAdmin={isSuperAdmin}
                      currentTenantName={currentTenantName}
                      currentTenantId={currentTenantId}
                      user={user}
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
            </Routes>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
