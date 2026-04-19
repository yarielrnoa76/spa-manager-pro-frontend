import React, { useEffect, useMemo, useState } from "react";
import { api } from "../services/api";
import { ChevronDown, ChevronRight } from "lucide-react";

type Permission = { id: number; name: string };
type Role = { 
  id: number; 
  name: string; 
  view_scope?: string; 
  resource_scopes?: Record<string, string>;
  permissions?: Permission[] 
};

export default function RolesPermissionsSettings() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [perms, setPerms] = useState<Permission[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");
  const [newRoleName, setNewRoleName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedRole = useMemo(
    () => roles.find((r) => String(r.id) === String(selectedRoleId)) ?? null,
    [roles, selectedRoleId],
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
        user: "users",
        lead: "leads",
        sale: "sales",
        product: "products",
        appointment: "appointments",
        branch: "branches",
        ticket: "tickets",
        refund: "refunds",
        conversation: "conversations",
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
    const [rolesRes, permsRes] = await Promise.all([
      api.get<Role[]>("/roles?with_permissions=1"),
      api.get<Permission[]>("/permissions"),
    ]);
    setRoles(Array.isArray(rolesRes) ? rolesRes : []);
    setPerms(Array.isArray(permsRes) ? permsRes : []);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  const togglePermission = async (permId: number) => {
    if (!selectedRole) return;

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

  const createRole = async () => {
    if (!newRoleName.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.post("/roles", { name: newRoleName });
      setNewRoleName("");
      await load();
      // Auto-select the newly created role
      // Check if response has data property, or is direct object
      const newRole = (res as any)?.data || res;
      if (newRole?.id) {
        setSelectedRoleId(String(newRole.id));
      }
    } catch (e: any) {
      setError(e?.message || "Error al crear rol");
    } finally {
      setLoading(false);
    }
  };

  const updateResourceScope = async (resource: string, scope: string) => {
    if (!selectedRole) return;
    try {
      const nextScopes = { ...(selectedRole.resource_scopes || {}), [resource]: scope };
      await api.put(`/roles/${selectedRole.id}`, {
        name: selectedRole.name,
        resource_scopes: nextScopes
      });
      await load();
    } catch (e: any) {
      setError(e?.message || "Error al actualizar alcance del recurso");
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
          <label className="block text-xs font-bold text-gray-600 mb-1 uppercase">Seleccionar Rol Existente</label>
          <select
            className="border rounded-lg px-3 py-2 w-full"
            value={selectedRoleId}
            onChange={(e) => setSelectedRoleId(e.target.value)}
          >
            <option value="">Selecciona un rol...</option>
            {roles.map((r) => (
              <option key={r.id} value={String(r.id)}>
                {r.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1 min-w-[250px] flex items-end gap-2">
          <div className="flex-1">
            <label className="block text-xs font-bold text-gray-600 mb-1 uppercase">Crear Nuevo Rol</label>
            <input
              className="border rounded-lg px-3 py-2 w-full"
              placeholder="Nombre del rol"
              value={newRoleName}
              onChange={(e) => setNewRoleName(e.target.value)}
            />
          </div>
          <button
            onClick={createRole}
            disabled={!newRoleName.trim() || loading}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:opacity-50"
          >
            Crear
          </button>
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
            <div>
              Configurar Permisos del Rol:{" "}
              <span className="font-bold text-gray-900">{selectedRole.name}</span>
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
                      {/* Per-resource scope selector */}
                      {["leads", "appointments", "sales", "tickets", "refunds", "conversations"].includes(groupName) && (
                        <div className="flex items-center gap-2 border-r pr-3 mr-1">
                          <span className="text-[10px] font-bold text-indigo-400 uppercase">Alcance:</span>
                          <select
                            className="text-xs font-semibold bg-white border rounded px-1.5 py-1 focus:ring-1 focus:ring-indigo-500 outline-none"
                            value={selectedRole.resource_scopes?.[groupName] || selectedRole.view_scope || 'all'}
                            onChange={(e) => updateResourceScope(groupName, e.target.value)}
                           >
                            <option value="own">Solo lo Propio</option>
                            <option value="branch">Sucursal</option>
                            <option value="all">Todo</option>
                          </select>
                        </div>
                      )}

                      <span className="hidden sm:inline-block text-xs font-semibold text-gray-500 tracking-wide uppercase">
                        {assignedCount}/{groupPerms.length} asignados
                      </span>
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
                              className={`flex items-center gap-3 border rounded-lg px-3 py-2.5 cursor-pointer transition ${checked ? "bg-indigo-50/50 border-indigo-200" : "hover:bg-gray-50"
                                }`}
                            >
                              <div className="relative flex items-center">
                                <input
                                  type="checkbox"
                                  className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-600"
                                  checked={checked}
                                  onChange={() => togglePermission(p.id)}
                                />
                              </div>
                              <span className={`text-sm font-semibold capitalize ${checked ? "text-indigo-900" : "text-gray-700"}`}>
                                {p.name.replace("_", " ")}
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
