import React, { useEffect, useState } from "react";
import { api } from "../services/api";

type Role = { id: number; name: string };
type Branch = { id: number; name: string };

type UserRow = {
  id: number;
  name: string;
  email: string;
  role?: Role | null;
  branch?: Branch | null;
  deleted_at?: string | null;
};

type ApiValidationErrors = Record<string, string[]>;

function getErrorMessage(e: any): string {
  // Tu api.ts lanza ApiError con {message, status, errors}
  const status = e?.status;
  const errors: ApiValidationErrors | undefined = e?.errors;

  if (status === 422 && errors) {
    const firstKey = Object.keys(errors)[0];
    const firstMsg = firstKey ? errors[firstKey]?.[0] : null;
    return firstMsg ?? "Validation failed.";
  }

  return e?.message ?? "Ocurrió un error.";
}

export default function UsersSettings() {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    password_confirmation: "",
    role_id: "", // string para <select/>
    branch_id: "", // string para <select/>
  });

  const [editing, setEditing] = useState<UserRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setEditing(null);
    setForm({
      name: "",
      email: "",
      password: "",
      password_confirmation: "",
      role_id: "",
      branch_id: "",
    });
  };

  const load = async () => {
    setLoading(true);
    setError(null);

    try {
      const [usersRes, rolesRes, branchesRes] = await Promise.all([
        api.get("/users"),
        api.get("/roles"),
        api.get("/branches"),
      ]);

      // tu api.get puede devolver data directo o {data:...} según como lo tengas implementado;
      // por eso mantenemos la compatibilidad.
      const users = (usersRes as any)?.data ?? usersRes;
      const roles = (rolesRes as any)?.data ?? rolesRes;
      const branches = (branchesRes as any)?.data ?? branchesRes;

      setRows(Array.isArray(users) ? users : []);
      setRoles(Array.isArray(roles) ? roles : []);
      setBranches(Array.isArray(branches) ? branches : []);
    } catch (e: any) {
      setError(getErrorMessage(e));
      console.error("LOAD USERS SETTINGS ERROR =>", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    setError(null);

    // Validación mínima
    if (!form.name.trim() || !form.email.trim()) {
      setError("Nombre y email son obligatorios.");
      return;
    }
    if (!editing && !form.password.trim()) {
      setError("Password es obligatorio para crear un usuario.");
      return;
    }
    if (!form.role_id) {
      setError("Selecciona un rol.");
      return;
    }

    const payload: any = {
      name: form.name.trim(),
      email: form.email.trim(),
      role_id: Number(form.role_id),
      branch_id: form.branch_id ? Number(form.branch_id) : null,
    };

    // Password solo si viene (obligatorio al crear, opcional al editar)
    if (form.password.trim()) {
      payload.password = form.password;
      payload.password_confirmation = form.password; // ✅ mismo valor
    }

    setLoading(true);
    try {
      if (editing) {
        await api.put(`/users/${editing.id}`, payload);
      } else {
        await api.post("/users", {
          name: form.name,
          email: form.email,
          password: form.password,
          password_confirmation: form.password, // ✅
          role_id: form.role_id || null,
          branch_id: form.branch_id || null,
        });
      }

      resetForm();
      await load();
    } catch (e: any) {
      setError(getErrorMessage(e));
      console.error("SAVE USER ERROR =>", e);
    } finally {
      setLoading(false);
    }
  };

  const softDelete = async (id: number) => {
    if (!confirm("¿Eliminar este usuario?")) return;

    setLoading(true);
    setError(null);
    try {
      await api.delete(`/users/${id}`);
      await load();
    } catch (e: any) {
      setError(getErrorMessage(e));
      console.error("DELETE USER ERROR =>", e);
    } finally {
      setLoading(false);
    }
  };

  // ⚠️ Solo si existe el endpoint en backend: POST /api/users/{id}/restore
  // Si no lo tienes, deja esto comentado para evitar fallos.
  /*
  const restore = async (id: number) => {
    setLoading(true);
    setError(null);
    try {
      await api.post(`/users/${id}/restore`);
      await load();
    } catch (e: any) {
      setError(getErrorMessage(e));
      console.error("RESTORE USER ERROR =>", e);
    } finally {
      setLoading(false);
    }
  };
  */

  return (
    <div className="space-y-4">
      {error && (
        <div className="border rounded-lg p-3 bg-red-50 text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        <input
          className="border rounded-lg px-3 py-2"
          placeholder="Nombre"
          value={form.name}
          onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
        />

        <input
          className="border rounded-lg px-3 py-2"
          placeholder="Email"
          value={form.email}
          onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
        />

        <div className="relative">
          <input
            className="border rounded-lg px-3 py-2 w-full pr-16"
            placeholder={editing ? "Password (opcional)" : "Password"}
            type={showPassword ? "text" : "password"}
            value={form.password}
            onChange={(e) =>
              setForm((s) => ({ ...s, password: e.target.value }))
            }
          />

          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-indigo-600 font-semibold hover:underline"
          >
            {showPassword ? "Ocultar" : "Mostrar"}
          </button>
        </div>

        <select
          className="border rounded-lg px-3 py-2"
          value={form.role_id}
          onChange={(e) => setForm((s) => ({ ...s, role_id: e.target.value }))}
        >
          <option value="">Selecciona rol...</option>
          {roles.map((r) => (
            <option key={r.id} value={String(r.id)}>
              {r.name}
            </option>
          ))}
        </select>

        <select
          className="border rounded-lg px-3 py-2"
          value={form.branch_id}
          onChange={(e) =>
            setForm((s) => ({ ...s, branch_id: e.target.value }))
          }
        >
          <option value="">(Sin sucursal)</option>
          {branches.map((b) => (
            <option key={b.id} value={String(b.id)}>
              {b.name}
            </option>
          ))}
        </select>

        <div className="md:col-span-5 flex gap-2">
          <button
            type="button"
            onClick={save}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:opacity-50"
          >
            {editing ? "Guardar cambios" : "Crear usuario"}
          </button>

          {editing && (
            <button
              type="button"
              onClick={resetForm}
              disabled={loading}
              className="px-4 py-2 rounded-lg border font-semibold hover:bg-gray-50 disabled:opacity-50"
            >
              Cancelar
            </button>
          )}

          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="ml-auto px-4 py-2 rounded-lg border font-semibold hover:bg-gray-50 disabled:opacity-50"
          >
            Recargar
          </button>
        </div>
      </div>

      <div className="overflow-x-auto border rounded-xl">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-3">Nombre</th>
              <th className="text-left p-3">Email</th>
              <th className="text-left p-3">Rol</th>
              <th className="text-left p-3">Sucursal</th>
              <th className="text-left p-3">Estado</th>
              <th className="text-right p-3">Acciones</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td className="p-3 text-gray-500" colSpan={6}>
                  Cargando...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td className="p-3 text-gray-500" colSpan={6}>
                  No hay usuarios.
                </td>
              </tr>
            ) : (
              rows.map((u) => {
                const deleted = !!u.deleted_at;

                return (
                  <tr key={u.id} className="border-t">
                    <td className="p-3">{u.name}</td>
                    <td className="p-3">{u.email}</td>
                    <td className="p-3">{u.role?.name ?? "-"}</td>
                    <td className="p-3">{u.branch?.name ?? "-"}</td>
                    <td className="p-3">
                      {deleted ? (
                        <span className="text-red-600 font-semibold">
                          Eliminado
                        </span>
                      ) : (
                        <span className="text-green-700 font-semibold">
                          Activo
                        </span>
                      )}
                    </td>

                    <td className="p-3 text-right space-x-2">
                      {!deleted && (
                        <>
                          <button
                            className="px-3 py-1 rounded-lg border hover:bg-gray-50 font-semibold"
                            onClick={() => {
                              setEditing(u);
                              setForm({
                                name: u.name ?? "",
                                email: u.email ?? "",
                                password: "",
                                password_confirmation: "",
                                role_id: u.role?.id ? String(u.role.id) : "",
                                branch_id: u.branch?.id
                                  ? String(u.branch.id)
                                  : "",
                              });
                            }}
                          >
                            Editar
                          </button>

                          <button
                            className="px-3 py-1 rounded-lg border hover:bg-red-50 text-red-600 font-semibold"
                            onClick={() => softDelete(u.id)}
                          >
                            Eliminar
                          </button>
                        </>
                      )}

                      {/* Si implementas restore en backend, descomenta restore() arriba y este botón */}
                      {/*
                      {deleted && (
                        <button
                          className="px-3 py-1 rounded-lg border hover:bg-gray-50 font-semibold"
                          onClick={() => restore(u.id)}
                        >
                          Restaurar
                        </button>
                      )}
                      */}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
