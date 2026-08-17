import React, { useMemo, useState } from "react";
import BranchesSettings from "../settings/BranchesSettings";
import UsersSettings from "../settings/UsersSettings";
import RolesPermissionsSettings from "../settings/RolesPermissionsSettings";
import ProfessionalsSettings from "../settings/ProfessionalsSettings";
import NotificationsSettings from "../settings/NotificationsSettings";
import PaymentsSettings from "../settings/PaymentsSettings";
import IntegrationsSettings from "../settings/IntegrationsSettings";
import Tenants from "./Tenants";
import { UserData } from "../App";

type TabKey = "branches" | "users" | "rbac" | "professionals" | "tenants" | "notifications" | "payments" | "integrations";

const TabButton = ({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) => (
  <button
    onClick={onClick}
    className={`px-4 py-2 rounded-lg font-semibold text-sm border transition-colors ${active
      ? "bg-indigo-600 text-white border-indigo-600"
      : "bg-white text-gray-700 hover:bg-gray-50"
      }`}
  >
    {children}
  </button>
);

const SettingsPage: React.FC<{
  isSuperAdmin?: boolean;
  currentTenantName?: string;
  currentTenantId?: number | null;
  user?: UserData | null;
}> = ({ isSuperAdmin, currentTenantName, currentTenantId, user }) => {
  const perms: string[] = Array.isArray(user?.permissions) ? user.permissions : [];
  const isAdmin = isSuperAdmin;
  const hasPerm = (p: string) => perms.includes(p) || isAdmin;

  // A SuperAdmin with no tenant selected has no authorized tenant context at all — every tab
  // that reads/writes tenant-owned data (branches, users, roles, professionals, payments,
  // notifications) must stay unreachable until one is picked. "Tenants" is the only
  // genuinely global, non-tenant-owned screen, so it's the sole exemption.
  //
  // superAdminMissingTenant matches the exact condition requested: true only for a SuperAdmin
  // with no currentTenantId. A normal user is never blocked (their own tenant_id is always
  // used server-side regardless of this UI gate). tenantContextOk is its negation — the flag
  // actually consumed below, so the "gate satisfied" reading stays unambiguous at each call site.
  const superAdminMissingTenant = !!isSuperAdmin && !currentTenantId;
  const tenantContextOk = !superAdminMissingTenant;

  const canManageSettings = hasPerm("manage_settings");
  const canSeeBranches = tenantContextOk && (canManageSettings || hasPerm("view_branch") || hasPerm("create_branch") || hasPerm("edit_branch") || hasPerm("delete_branch"));
  const canSeeUsers = tenantContextOk && (canManageSettings || hasPerm("view_users") || hasPerm("create_user") || hasPerm("edit_user") || hasPerm("delete_user"));
  const canSeeRbac = tenantContextOk && (canManageSettings || hasPerm("view_roles") || hasPerm("manage_roles"));
  const canSeeProfessionals = tenantContextOk && (canManageSettings || hasPerm("view_professionals") || hasPerm("create_professional") || hasPerm("edit_professional") || hasPerm("delete_professional"));
  const canSeePayments = tenantContextOk && (!!isSuperAdmin || user?.role?.name === "admin");
  const canSeeNotifications = tenantContextOk && !!isSuperAdmin;
  // WhatsApp Templates (backend Phase 1/1B) is tenant-scoped and permission-gated, unlike n8n
  // and the Chatwoot connection health/rotation controls below it on the same tab (both
  // SuperAdmin-only by architecture decision — see backend N8nConnectionPolicy / TenantPolicy).
  const canManageWhatsappTemplates = tenantContextOk && hasPerm("manage_whatsapp_templates");
  const canViewWhatsappTemplates = tenantContextOk && (hasPerm("view_whatsapp_templates") || canManageWhatsappTemplates);
  // A SuperAdmin always reaches this tab (n8n is global, not tenant-owned — same reasoning as
  // "tenants" above). A regular tenant user reaches it only once they have a WhatsApp
  // Templates permission; the tab itself decides internally which of its sections to render.
  const canSeeIntegrations = !!isSuperAdmin || canViewWhatsappTemplates;

  const [tab, setTab] = useState<TabKey>(() => {
    if (isSuperAdmin) return "tenants";
    if (canSeeBranches) return "branches";
    if (canSeeUsers) return "users";
    if (canSeeRbac) return "rbac";
    if (canSeeProfessionals) return "professionals";
    return "branches";
  });

  const title = useMemo(() => {
    if (tab === "branches") return "Sucursales";
    if (tab === "users") return "Usuarios";
    if (tab === "professionals") return "Profesionales";
    if (tab === "tenants") return "Tenants";
    if (tab === "payments") return "Pagos (Stripe)";
    if (tab === "integrations") return "Integraciones";
    return "Roles y permisos";
  }, [tab]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Configuración</h2>
          <p className="text-sm text-gray-500">
            Administra sucursales, usuarios y permisos del sistema.
          </p>
        </div>
      </div>

      <div className="bg-indigo-50 border border-indigo-200 text-indigo-800 p-4 rounded-xl flex items-start gap-3 text-sm">
        <span className="text-xl">💡</span>
        <div>
          <p className="font-bold">Estás gestionando datos del tenant: {currentTenantName}</p>
          <p className="opacity-90 mt-1">
            Cualquier sucursal, usuario o rol creado en esta pantalla pertenecerá automáticamente al tenant <strong>{currentTenantName}</strong> debido a los niveles de aislamiento.
            {isSuperAdmin && " Para gestionar datos de otro tenant, selecciónalo primero en el selector de la esquina superior derecha."}
          </p>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {isSuperAdmin && (
          <TabButton active={tab === "tenants"} onClick={() => setTab("tenants")}>
            Tenants
          </TabButton>
        )}
        {canSeeNotifications && (
          <TabButton active={tab === "notifications"} onClick={() => setTab("notifications")}>
            Notificaciones
          </TabButton>
        )}
        {canSeeIntegrations && (
          <TabButton active={tab === "integrations"} onClick={() => setTab("integrations")}>
            Integraciones
          </TabButton>
        )}
        {canSeeBranches && (
          <TabButton active={tab === "branches"} onClick={() => setTab("branches")}>
            Sucursales
          </TabButton>
        )}
        {canSeeRbac && (
          <TabButton active={tab === "rbac"} onClick={() => setTab("rbac")}>
            Roles y permisos
          </TabButton>
        )}
        {canSeeUsers && (
          <TabButton active={tab === "users"} onClick={() => setTab("users")}>
            Usuarios
          </TabButton>
        )}
        {canSeeProfessionals && (
          <TabButton active={tab === "professionals"} onClick={() => setTab("professionals")}>
            Profesionales
          </TabButton>
        )}
        {canSeePayments && (
          <TabButton active={tab === "payments"} onClick={() => setTab("payments")}>
            Pagos (Stripe)
          </TabButton>
        )}
      </div>

      <div className="bg-white border rounded-2xl p-4">
        <div className="mb-3">
          <h3 className="text-lg font-bold text-gray-900">{title}</h3>
        </div>

        {tab === "branches" && canSeeBranches && (
          <BranchesSettings
            isSuperAdmin={isSuperAdmin}
            canCreate={hasPerm("manage_settings") || hasPerm("create_branch")}
            canEdit={hasPerm("manage_settings") || hasPerm("edit_branch")}
            canDelete={hasPerm("manage_settings") || hasPerm("delete_branch")}
          />
        )}
        {tab === "users" && canSeeUsers && (
          <UsersSettings
            isSuperAdmin={isSuperAdmin}
            canCreate={hasPerm("manage_settings") || hasPerm("create_user")}
            canEdit={hasPerm("manage_settings") || hasPerm("edit_user")}
            canDelete={hasPerm("manage_settings") || hasPerm("delete_user")}
          />
        )}
        {tab === "rbac" && canSeeRbac && <RolesPermissionsSettings canManage={hasPerm("manage_roles")} />}
        {tab === "professionals" && canSeeProfessionals && (
          <ProfessionalsSettings 
            canCreate={hasPerm("manage_settings") || hasPerm("create_professional")}
            canEdit={hasPerm("manage_settings") || hasPerm("edit_professional")}
            canDelete={hasPerm("manage_settings") || hasPerm("delete_professional")}
            isSuperAdmin={isSuperAdmin}
          />
        )}
        {tab === "tenants" && isSuperAdmin && <Tenants />}
        {tab === "notifications" && canSeeNotifications && <NotificationsSettings isSuperAdmin={isSuperAdmin} />}
        {tab === "integrations" && canSeeIntegrations && (
          <IntegrationsSettings
            isSuperAdmin={isSuperAdmin}
            currentTenantId={currentTenantId}
            canViewWhatsappTemplates={canViewWhatsappTemplates}
            canManageWhatsappTemplates={canManageWhatsappTemplates}
          />
        )}
        {tab === "payments" && canSeePayments && <PaymentsSettings isSuperAdmin={isSuperAdmin} user={user} />}
      </div>
    </div>
  );
};

export default SettingsPage;
