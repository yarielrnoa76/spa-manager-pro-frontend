import React, { useEffect, useMemo, useState } from "react";
import { api, ApiError } from "../services/api";
import { ChevronDown, ChevronRight } from "lucide-react";

// A sentinel value distinct from every real scope string ("own"/"branch"/"all", or whatever
// else a future catalog entry adds) -- rendered as a disabled placeholder option, never
// persisted, never confused with a real, backend-materialized scope.
const UNCONFIGURED_SCOPE = "__unconfigured__";

/** A scope not in this map (including an unrecognized/invalid persisted value) falls back to
 * its own raw name -- never silently normalized to "Todo". */
const RESOURCE_SCOPE_LABELS: Record<string, string> = {
  own: "Solo lo Propio",
  branch: "Sucursal",
  all: "Todo",
};

function getResourceScopeLabel(scope: string): string {
  return RESOURCE_SCOPE_LABELS[scope] ?? scope;
}

type Permission = { id: number; name: string };
type Role = {
  id: number;
  name: string;
  tenant_id: number | null;
  is_system_role?: boolean;
  view_scope?: string;
  resource_scopes?: Record<string, string>;
  permissions?: Permission[];
  users_count?: number;
};

export default function RolesPermissionsSettings({ canManage = true }: { canManage?: boolean }) {
  const [roles, setRoles] = useState<Role[]>([]);
  const [perms, setPerms] = useState<Permission[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");
  const [newRoleName, setNewRoleName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Gate 2 (Section 11.2): "catálogo backend como fuente" — the valid scope options per
  // resource (and which resources even admit resource_scopes at all) come from this endpoint,
  // never a hardcoded, driftable copy. Inventory/Users/Products/Roles each have their own
  // restricted set (e.g. Inventory never admits 'own').
  const [scopeCatalog, setScopeCatalog] = useState<Record<string, string[]>>({});
  const [deletingRoleId, setDeletingRoleId] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // The global platform role (tenant_id = null, e.g. `superadmin`) authorizes via a bypass in
  // User::hasPermission() — it is never assigned permissions and is immutable from this
  // screen (RoleController rejects update/destroy/syncPermissions on it with 403 regardless
  // of actor). It must never appear in the editable-role selector; it is rendered separately,
  // read-only, below.
  const manageableRoles = useMemo(() => roles.filter((r) => r.tenant_id !== null), [roles]);
  const globalRoles = useMemo(() => roles.filter((r) => r.tenant_id === null), [roles]);

  const selectedRole = useMemo(
    () => manageableRoles.find((r) => String(r.id) === String(selectedRoleId)) ?? null,
    [manageableRoles, selectedRoleId],
  );

  const selectedPermIds = useMemo(() => {
    const set = new Set<number>();
    (selectedRole?.permissions ?? []).forEach((p) => set.add(p.id));
    return set;
  }, [selectedRole]);

  const [searchTerm, setSearchTerm] = useState("");

  const groupedPerms = useMemo(() => {
    const groups: Record<string, Permission[]> = {};
    const lowerSearch = searchTerm.toLowerCase();

    perms.forEach((p) => {
      if (lowerSearch && !p.name.toLowerCase().includes(lowerSearch)) return;

      const parts = p.name.split('_');
      // If permission is "view_users", rawGroup is "users"
      const rawGroup = parts.length > 1 ? parts.slice(1).join('_') : 'general';

      const groupMap: Record<string, string> = {
        // Configuración
        user: "configuración",
        users: "configuración",
        branch: "configuración",
        branches: "configuración",
        role: "configuración",
        roles: "configuración",
        professional: "configuración",
        professionals: "configuración",
        settings: "configuración",
        tenant: "configuración",
        tenants: "configuración",

        // Ventas
        sale: "sales",
        sale_increase_price: "sales",
        sale_decrease_price: "sales",
        import_sales: "sales",
        increase_price: "sales",
        decrease_price: "sales",
        all_sales: "sales",
        my_sales_only: "sales",

        // Otros
        lead: "leads",
        product: "products",
        appointment: "appointments",
        ticket: "tickets",
        support_ticket: "support_tickets",
        support_tickets: "support_tickets",
        all_support_tickets: "support_tickets",
        internal_notes: "support_tickets",
        ticket_notifications: "support_tickets",
        ticket_priorities: "configuración",
        ticket_types: "configuración",
        refund: "refunds",
        conversation: "conversations",
        expense: "expenses",
        expenses: "expenses",
        all_conversations: "conversations",
      };

      const groupName = groupMap[rawGroup] || rawGroup;

      if (!groups[groupName]) groups[groupName] = [];
      groups[groupName].push(p);
    });
    return groups;
  }, [perms, searchTerm]);

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const toggleAccordion = (group: string) => {
    setOpenGroups((prev) => ({ ...prev, [group]: !prev[group] }));
  };

  const load = async () => {
    const [rolesRes, permsRes, catalogRes] = await Promise.all([
      api.get<Role[]>("/roles?with_permissions=1&with_user_count=1"),
      api.get<Permission[]>("/permissions"),
      api.get<Record<string, string[]>>("/permissions/resource-scope-catalog"),
    ]);
    setRoles(Array.isArray(rolesRes) ? rolesRes : []);
    setPerms(Array.isArray(permsRes) ? permsRes : []);
    setScopeCatalog(catalogRes && typeof catalogRes === "object" ? catalogRes : {});
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  const togglePermission = async (permId: number) => {
    if (!selectedRole || !canManage) return;

    // endpoint sugerido: PUT /roles/:id/permissions con array permission_ids
    const next = new Set<number>(selectedPermIds);
    if (next.has(permId)) next.delete(permId);
    else next.add(permId);

    await api.put(`/roles/${selectedRole.id}/permissions`, {
      permission_ids: Array.from(next),
    });

    await load();
  };

  const toggleGroupPermissions = async (groupPerms: Permission[]) => {
    if (!selectedRole) return;

    const isAllSelected = groupPerms.every(p => selectedPermIds.has(p.id));
    const next = new Set<number>(selectedPermIds);

    if (isAllSelected) {
      groupPerms.forEach(p => next.delete(p.id));
    } else {
      groupPerms.forEach(p => next.add(p.id));
    }

    await api.put(`/roles/${selectedRole.id}/permissions`, {
      permission_ids: Array.from(next),
    });

    await load();
  };

  const createRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleName.trim() || !canManage) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.post<{ id?: number; data?: { id?: number } }>("/roles", { name: newRoleName });
      setNewRoleName("");
      await load();
      // Auto-select the newly created role
      // Check if response has data property, or is direct object
      const newRole = res?.data || res;
      if (newRole?.id) {
        setSelectedRoleId(String(newRole.id));
      }
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.message : "Error al crear rol");
    } finally {
      setLoading(false);
    }
  };

  /**
   * Gate 2 (Section 11.2): a custom role with no users assigned may be deleted; the backend
   * rejects one still in use with 409 ROLE_IN_USE carrying users_count, which must be shown
   * clearly rather than as a generic error. A protected system role (global or tenant) is
   * never offered a delete action at all — the button simply doesn't render for those.
   */
  const deleteRole = async (role: Role) => {
    if (!canManage || role.is_system_role) return;
    if (!window.confirm(`¿Eliminar el rol "${role.name}"? Esta acción no se puede deshacer.`)) return;

    setDeleteError(null);
    setDeletingRoleId(role.id);
    try {
      await api.delete(`/roles/${role.id}`);
      if (String(role.id) === selectedRoleId) setSelectedRoleId("");
      await load();
    } catch (e: unknown) {
      const status = e instanceof ApiError ? e.status : undefined;
      const code = e instanceof ApiError ? e.code : undefined;
      if (code === "ROLE_IN_USE" || status === 409) {
        const count = e instanceof ApiError ? (e.data as { users_count?: number } | undefined)?.users_count : undefined;
        setDeleteError(
          count != null
            ? `Este rol está en uso por ${count} usuario(s) y no puede eliminarse hasta reasignarlos.`
            : "Este rol está en uso y no puede eliminarse hasta reasignar a sus usuarios.",
        );
      } else {
        setDeleteError(e instanceof ApiError ? e.message : "Error al eliminar el rol.");
      }
    } finally {
      setDeletingRoleId(null);
    }
  };

  const updateResourceScope = async (resource: string, scope: string) => {
    if (!selectedRole || !canManage) return;
    try {
      const nextScopes = { ...(selectedRole.resource_scopes || {}), [resource]: scope };
      await api.put(`/roles/${selectedRole.id}`, {
        name: selectedRole.name,
        resource_scopes: nextScopes
      });
      await load();
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.message : "Error al actualizar alcance del recurso");
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="border rounded-lg p-3 bg-red-50 text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="flex gap-3 flex-wrap items-center bg-gray-50 border p-4 rounded-xl">
        <div className="flex-1 min-w-[200px]">
          <label htmlFor="role-select" className="block text-xs font-bold text-gray-600 mb-1 uppercase">Seleccionar Rol Existente</label>
          <select
            id="role-select"
            className="border rounded-lg px-3 py-2 w-full"
            value={selectedRoleId}
            onChange={(e) => setSelectedRoleId(e.target.value)}
          >
            <option value="">Selecciona un rol...</option>
            {manageableRoles.map((r) => (
              <option key={r.id} value={String(r.id)}>
                {r.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1 min-w-[250px] flex items-end gap-2">
          <form onSubmit={createRole} className="flex-1 flex gap-2">
            <div className="flex-1">
              <label className="block text-xs font-bold text-gray-600 mb-1 uppercase">Crear Nuevo Rol</label>
              <input
                className="border rounded-lg px-3 py-2 w-full"
                placeholder="Nombre del rol"
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
                disabled={!canManage}
              />
            </div>
            {canManage && (
              <button
                type="submit"
                disabled={!newRoleName.trim() || loading}
                className="px-4 py-2 mt-5 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:opacity-50"
              >
                Crear
              </button>
            )}
          </form>
        </div>

        <div className="flex items-end">
          <button
            className="px-4 py-2 mt-5 rounded-lg border font-semibold hover:bg-gray-100"
            onClick={load}
          >
            Recargar
          </button>
        </div>
      </div>

      {globalRoles.length > 0 && (
        <div className="space-y-2">
          {globalRoles.map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between gap-3 bg-amber-50 border border-amber-200 p-4 rounded-xl"
            >
              <div>
                <div className="text-xs font-bold text-amber-700 uppercase tracking-wide">
                  Rol de plataforma — acceso completo — solo lectura
                </div>
                <div className="text-sm text-gray-700 mt-0.5">
                  <span className="font-semibold">{r.name}</span> — este rol autoriza mediante un
                  bypass interno (nunca se le asignan permisos individuales) y no puede editarse,
                  eliminarse ni sincronizar permisos desde esta pantalla.
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!selectedRole ? (
        <div className="text-sm text-gray-500">
          Selecciona un rol para editar sus permisos.
        </div>
      ) : (
        <div className="space-y-2">
          <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl mb-6 flex items-center gap-3">
             <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white shrink-0">
               <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
             </div>
             <div>
               <h4 className="text-sm font-bold text-indigo-900">Configuración de Seguridad por Módulo</h4>
               <p className="text-xs text-indigo-700">Ahora puedes definir el alcance de visibilidad de datos para cada sección de forma independiente.</p>
             </div>
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 text-sm text-gray-600">
            <div className="flex items-center gap-3">
              <span>
                Configurar Permisos del Rol:{" "}
                <span className="font-bold text-gray-900">{selectedRole.name}</span>
              </span>
              {canManage && !selectedRole.is_system_role && (
                <button
                  onClick={() => deleteRole(selectedRole)}
                  disabled={deletingRoleId === selectedRole.id}
                  className="text-xs font-semibold px-2.5 py-1 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition disabled:opacity-50"
                >
                  {deletingRoleId === selectedRole.id ? "Eliminando…" : "Eliminar rol"}
                </button>
              )}
            </div>
            <div className="relative w-full md:w-64">
              <input
                type="text"
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Buscar permiso o modelo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {deleteError && (
            <div className="border rounded-lg p-3 bg-red-50 text-red-700 text-sm">{deleteError}</div>
          )}

          {/* Gate 2 (Section 11.2): one row per resource the backend catalog actually defines
              — never a hardcoded subset — so Inventory/Users/Products/Roles/Logs each get
              exactly the scope options they support server-side. */}
          {Object.keys(scopeCatalog).length > 0 && (
            <div className="border rounded-xl bg-white p-4 shadow-sm">
              <h5 className="text-sm font-bold text-gray-800 mb-3">Alcances por Recurso</h5>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {Object.entries(scopeCatalog).map(([resource, validScopes]) => {
                  const persisted = selectedRole.resource_scopes?.[resource];
                  // A scope absent from the persisted JSON, or present but not one of THIS
                  // resource's own valid options, is never presented as "Todo" (or any other
                  // real value) -- the backend treats that same absence as fail-closed, and this
                  // screen must never contradict that by implying a permissive default exists.
                  const isConfigured = typeof persisted === "string" && validScopes.includes(persisted);
                  const selectValue = isConfigured ? persisted : UNCONFIGURED_SCOPE;

                  return (
                    <div key={resource} className="flex items-center justify-between gap-2 border rounded-lg px-3 py-2">
                      <span className="text-sm font-semibold text-gray-700 capitalize">
                        {resource.replaceAll("_", " ")}
                      </span>
                      <select
                        className="text-xs font-semibold bg-white border rounded px-1.5 py-1 focus:ring-1 focus:ring-indigo-500 outline-none disabled:opacity-60"
                        disabled={!canManage}
                        value={selectValue}
                        onChange={(e) => updateResourceScope(resource, e.target.value)}
                      >
                        {!isConfigured && (
                          <option value={UNCONFIGURED_SCOPE} disabled>
                            Sin configurar
                          </option>
                        )}
                        {validScopes.map((scope) => (
                          <option key={scope} value={scope}>
                            {getResourceScopeLabel(scope)}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="space-y-3 mt-4">
            {Object.entries(groupedPerms).map(([groupName, groupPerms]) => {
              const isOpen = openGroups[groupName] ?? (searchTerm.trim().length > 0 ? true : false);
              const isAllSelected = groupPerms.every((p) => selectedPermIds.has(p.id));
              const isSomeSelected = groupPerms.some((p) => selectedPermIds.has(p.id));
              const assignedCount = groupPerms.filter((p) => selectedPermIds.has(p.id)).length;

              return (
                <div key={groupName} className="border rounded-xl bg-white overflow-hidden shadow-sm">
                  {/* Accordion Header */}
                  <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b">
                    <button
                      onClick={() => toggleAccordion(groupName)}
                      className="flex items-center gap-2 flex-1 text-left"
                    >
                      {isOpen ? (
                        <ChevronDown size={18} className="text-gray-500" />
                      ) : (
                        <ChevronRight size={18} className="text-gray-500" />
                      )}
                      <span className="font-bold text-gray-800 uppercase tracking-wide text-sm">
                        {groupName}
                      </span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-200 text-gray-600">
                        {groupPerms.length}
                      </span>
                    </button>

                    <div className="flex items-center gap-3">
                      <span className="hidden sm:inline-block text-xs font-semibold text-gray-500 tracking-wide uppercase">
                        {assignedCount}/{groupPerms.length} asignados
                      </span>
                      {canManage && (
                        <button
                          onClick={() => toggleGroupPermissions(groupPerms)}
                          className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition ${isAllSelected
                            ? "bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100"
                            : isSomeSelected
                              ? "bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100"
                              : "bg-white text-gray-600 hover:bg-gray-50"
                            }`}
                        >
                          {isAllSelected ? "Desmarcar Todos" : "Seleccionar Todos"}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Accordion Body */}
                  {isOpen && (
                    <div className="p-4 bg-white">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {groupPerms.map((p) => {
                          const checked = selectedPermIds.has(p.id);
                          return (
                            <label
                              key={p.id}
                              className={`flex items-center gap-3 border rounded-lg px-3 py-2.5 cursor-pointer transition ${checked ? "bg-indigo-50/50 border-indigo-200" : "hover:bg-gray-50"} ${!canManage ? "opacity-70 cursor-not-allowed" : ""}`}
                            >
                              <div className="relative flex items-center">
                                <input
                                  type="checkbox"
                                  className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-600"
                                  disabled={!canManage}
                                  checked={checked}
                                  onChange={() => togglePermission(p.id)}
                                />
                              </div>
                              <span className={`text-sm font-semibold capitalize ${checked ? "text-indigo-900" : "text-gray-700"}`}>
                                {p.name.replaceAll("_", " ")}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
