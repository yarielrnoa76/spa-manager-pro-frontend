import React, { useEffect, useMemo, useState } from "react";
import { api } from "../services/api";

type Permission = { id: number; name: string };
type Role = { id: number; name: string; permissions?: Permission[] };

export default function RolesPermissionsSettings() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [perms, setPerms] = useState<Permission[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");

  const selectedRole = useMemo(
    () => roles.find((r) => String(r.id) === String(selectedRoleId)) ?? null,
    [roles, selectedRoleId],
  );

  const selectedPermIds = useMemo(() => {
    const set = new Set<number>();
    (selectedRole?.permissions ?? []).forEach((p) => set.add(p.id));
    return set;
  }, [selectedRole]);

  const load = async () => {
    const [rolesRes, permsRes] = await Promise.all([
      api.get("/roles?with_permissions=1"),
      api.get("/permissions"),
    ]);
    setRoles(rolesRes.data ?? rolesRes);
    setPerms(permsRes.data ?? permsRes);
  };

  useEffect(() => {
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

  return (
    <div className="space-y-4">
      <div className="flex gap-3 flex-wrap items-center">
        <select
          className="border rounded-lg px-3 py-2"
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

        <button
          className="px-4 py-2 rounded-lg border font-semibold hover:bg-gray-50"
          onClick={load}
        >
          Recargar
        </button>
      </div>

      {!selectedRole ? (
        <div className="text-sm text-gray-500">
          Selecciona un rol para editar sus permisos.
        </div>
      ) : (
        <div className="space-y-2">
          <div className="text-sm text-gray-600">
            Permisos asignados a:{" "}
            <span className="font-bold text-gray-900">{selectedRole.name}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {perms.map((p) => {
              const checked = selectedPermIds.has(p.id);
              return (
                <label
                  key={p.id}
                  className="flex items-center gap-2 border rounded-lg px-3 py-2 hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => togglePermission(p.id)}
                  />
                  <span className="text-sm font-semibold">{p.name}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
