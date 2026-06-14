import React, { useEffect, useState, useMemo, useCallback } from "react";
import { api } from "../services/api";
import { ArrowUpDown, ArrowUp, ArrowDown, Plus, Search, X, RefreshCw, Eye, EyeOff } from "lucide-react";

type Role = { id: number; name: string };
type Branch = { id: number; name: string };

type Tenant = { id: number; name: string };

type UserRow = {
  id: number;
  name: string;
  email: string;
  role?: Role | null;
  branch?: Branch | null;
  tenant?: Tenant | null;
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

export default function UsersSettings({
  isSuperAdmin,
  canCreate = false,
  canEdit = false,
  canDelete = false,
}: {
  isSuperAdmin?: boolean;
  canCreate?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
}) {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [viewGlobalUsers, setViewGlobalUsers] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Modal state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<UserRow | null>(null);

  const emptyForm = {
    name: "",
    email: "",
    password: "",
    password_confirmation: "",
    role_id: "",
    branch_id: "",
  };

  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);

  const resetForm = () => {
    setEditTarget(null);
    setForm(emptyForm);
    setShowPassword(false);
    setModalError(null);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [usersRes, rolesRes, branchesRes] = await Promise.all([
        api.listUsers({ include_global: viewGlobalUsers }),
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
  }, [viewGlobalUsers]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    if (!form.name.trim() || !form.email.trim()) {
      setModalError("Nombre y email son obligatorios.");
      return;
    }
    if (!form.password.trim()) {
      setModalError("Password es obligatorio para crear un usuario.");
      return;
    }
    if (!form.role_id) {
      setModalError("Selecciona un rol.");
      return;
    }

    setLoading(true);
    try {
      await api.post("/users", {
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        password_confirmation: form.password,
        role_id: Number(form.role_id),
        branch_id: form.branch_id ? Number(form.branch_id) : null,
      });

      setIsCreateOpen(false);
      resetForm();
      await load();
    } catch (e: any) {
      setModalError(getErrorMessage(e));
      console.error("CREATE USER ERROR =>", e);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    setModalError(null);

    if (!form.name.trim() || !form.email.trim()) {
      setModalError("Nombre y email son obligatorios.");
      return;
    }
    if (!form.role_id) {
      setModalError("Selecciona un rol.");
      return;
    }

    const payload: any = {
      name: form.name.trim(),
      email: form.email.trim(),
      role_id: Number(form.role_id),
      branch_id: form.branch_id ? Number(form.branch_id) : null,
    };

    if (form.password.trim()) {
      payload.password = form.password;
      payload.password_confirmation = form.password;
    }

    setLoading(true);
    try {
      await api.put(`/users/${editTarget.id}`, payload);
      setIsEditOpen(false);
      setEditTarget(null);
      resetForm();
      await load();
    } catch (e: any) {
      setModalError(getErrorMessage(e));
      console.error("UPDATE USER ERROR =>", e);
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

  const openEdit = (u: UserRow) => {
    setEditTarget(u);
    setForm({
      name: u.name ?? "",
      email: u.email ?? "",
      password: "",
      password_confirmation: "",
      role_id: u.role?.id ? String(u.role.id) : "",
      branch_id: u.branch?.id ? String(u.branch.id) : "",
    });
    setShowPassword(false);
    setModalError(null);
    setIsEditOpen(true);
  };

  // Sorting
  const sortedRows = useMemo(() => {
    if (!sortConfig) return rows;
    const { key, direction } = sortConfig;
    return [...rows].sort((a, b) => {
      let aValue: any = a[key as keyof UserRow];
      let bValue: any = b[key as keyof UserRow];

      if (key === "role") {
        aValue = a.role?.name || "";
        bValue = b.role?.name || "";
      } else if (key === "branch") {
        aValue = a.branch?.name || "";
        bValue = b.branch?.name || "";
      } else if (key === "tenant") {
        aValue = a.tenant?.name || "";
        bValue = b.tenant?.name || "";
      } else if (key === "status") {
        aValue = a.deleted_at ? "Eliminado" : "Activo";
        bValue = b.deleted_at ? "Eliminado" : "Activo";
      }

      aValue = aValue ?? "";
      bValue = bValue ?? "";

      if (typeof aValue === "string" && typeof bValue === "string") {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (aValue < bValue) return direction === "asc" ? -1 : 1;
      if (aValue > bValue) return direction === "asc" ? 1 : -1;
      return 0;
    });
  }, [rows, sortConfig]);

  // Search filter
  const filteredRows = useMemo(() => {
    if (!searchTerm.trim()) return sortedRows;
    const term = searchTerm.toLowerCase();
    return sortedRows.filter(
      (u) =>
        u.name.toLowerCase().includes(term) ||
        u.email.toLowerCase().includes(term) ||
        (u.role?.name || "").toLowerCase().includes(term) ||
        (u.branch?.name || "").toLowerCase().includes(term)
    );
  }, [sortedRows, searchTerm]);

  const requestSort = (key: string) => {
    let direction: "asc" | "desc" = "asc";
    if (sortConfig && sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const renderSortIcon = (key: string) => {
    if (!sortConfig || sortConfig.key !== key) {
      return <ArrowUpDown size={14} className="inline ml-1 text-gray-400" />;
    }
    return sortConfig.direction === "asc" ? (
      <ArrowUp size={14} className="inline ml-1 text-indigo-600" />
    ) : (
      <ArrowDown size={14} className="inline ml-1 text-indigo-600" />
    );
  };

  // ─── Reusable Modal ───────────────────────────────────────────
  const renderFormModal = (
    isOpen: boolean,
    onClose: () => void,
    onSubmit: (e: React.FormEvent) => void,
    title: string,
    submitLabel: string,
    isEditing: boolean
  ) => {
    if (!isOpen) return null;
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
          <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50">
            <h3 className="font-bold text-lg">{title}</h3>
            <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X size={20} />
            </button>
          </div>
          <form onSubmit={onSubmit} className="p-6 space-y-4">
            {modalError && (
              <div className="border rounded-lg p-3 bg-red-50 text-red-700 text-sm">
                {modalError}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nombre *</label>
              <input
                type="text"
                required
                className="w-full border rounded-lg p-2 text-sm"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Nombre completo"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Email *</label>
              <input
                type="email"
                required
                className="w-full border rounded-lg p-2 text-sm"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="correo@ejemplo.com"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                {isEditing ? "Password (opcional)" : "Password *"}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required={!isEditing}
                  className="w-full border rounded-lg p-2 text-sm pr-10"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder={isEditing ? "Dejar vacío para mantener" : "Contraseña"}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  title={showPassword ? "Ocultar" : "Mostrar"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Rol *</label>
                <select
                  required
                  className="w-full border rounded-lg p-2 text-sm"
                  value={form.role_id}
                  onChange={(e) => setForm((f) => ({ ...f, role_id: e.target.value }))}
                >
                  <option value="">Selecciona rol...</option>
                  {roles.map((r) => (
                    <option key={r.id} value={String(r.id)}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Sucursal</label>
                <select
                  className="w-full border rounded-lg p-2 text-sm"
                  value={form.branch_id}
                  onChange={(e) => setForm((f) => ({ ...f, branch_id: e.target.value }))}
                >
                  <option value="">(Sin sucursal)</option>
                  {branches.map((b) => (
                    <option key={b.id} value={String(b.id)}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2 border rounded-lg text-sm font-bold hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 shadow-lg disabled:opacity-50"
              >
                {submitLabel}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="border rounded-lg p-3 bg-red-50 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Header: description + actions */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <p className="text-sm text-gray-500">
          Gestiona los usuarios del sistema, sus roles y sucursales asignadas.
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="px-3 py-2 rounded-lg border font-semibold hover:bg-gray-50 disabled:opacity-50 text-sm flex items-center gap-1.5"
            title="Recargar lista"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            <span className="hidden sm:inline">Recargar</span>
          </button>
          {canCreate && (
            <button
              onClick={() => {
                resetForm();
                setIsCreateOpen(true);
              }}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 text-sm shadow-lg hover:bg-indigo-700"
            >
              <Plus size={16} /> Nuevo Usuario
            </button>
          )}
        </div>
      </div>

      {/* Search + SuperAdmin toggle */}
      <div className="flex flex-col md:flex-row gap-3 items-start md:items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border rounded-lg text-sm"
            placeholder="Buscar por nombre, email, rol o sucursal..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {isSuperAdmin && (
          <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 whitespace-nowrap cursor-pointer">
            <input
              type="checkbox"
              checked={viewGlobalUsers}
              onChange={(e) => setViewGlobalUsers(e.target.checked)}
              className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
            />
            Ver Usuarios Globales
          </label>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto border rounded-xl">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-3 cursor-pointer hover:bg-gray-200 transition select-none" onClick={() => requestSort("name")}>
                Nombre {renderSortIcon("name")}
              </th>
              <th className="text-left p-3 cursor-pointer hover:bg-gray-200 transition select-none" onClick={() => requestSort("email")}>
                Email {renderSortIcon("email")}
              </th>
              <th className="text-left p-3 cursor-pointer hover:bg-gray-200 transition select-none" onClick={() => requestSort("role")}>
                Rol {renderSortIcon("role")}
              </th>
              <th className="text-left p-3 cursor-pointer hover:bg-gray-200 transition select-none" onClick={() => requestSort("branch")}>
                Sucursal {renderSortIcon("branch")}
              </th>
              {isSuperAdmin && (
                <th className="text-left p-3 cursor-pointer hover:bg-gray-200 transition select-none" onClick={() => requestSort("tenant")}>
                  Tenant {renderSortIcon("tenant")}
                </th>
              )}
              <th className="text-left p-3 cursor-pointer hover:bg-gray-200 transition select-none" onClick={() => requestSort("status")}>
                Estado {renderSortIcon("status")}
              </th>
              <th className="text-right p-3">Acciones</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td className="p-3 text-gray-500" colSpan={isSuperAdmin ? 7 : 6}>
                  Cargando...
                </td>
              </tr>
            ) : filteredRows.length === 0 ? (
              <tr>
                <td className="p-3 text-gray-500" colSpan={isSuperAdmin ? 7 : 6}>
                  No hay usuarios.
                </td>
              </tr>
            ) : (
              filteredRows.map((u) => {
                const deleted = !!u.deleted_at;

                return (
                  <tr key={u.id} className="border-t">
                    <td className="p-3">{u.name}</td>
                    <td className="p-3">{u.email}</td>
                    <td className="p-3">{u.role?.name ?? "-"}</td>
                    <td className="p-3">{u.branch?.name ?? "-"}</td>
                    {isSuperAdmin && (
                      <td className="p-3">
                        {u.tenant ? (
                          <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded-md text-xs font-medium">
                            {u.tenant.name}
                          </span>
                        ) : (
                          <span className="text-gray-400 italic text-xs">Global</span>
                        )}
                      </td>
                    )}
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
                          {canEdit && (
                            <button
                              className="px-3 py-1 rounded-lg border hover:bg-gray-50 font-semibold"
                              onClick={() => openEdit(u)}
                            >
                              Editar
                            </button>
                          )}

                          {canDelete && (
                            <button
                              className="px-3 py-1 rounded-lg border hover:bg-red-50 text-red-600 font-semibold"
                              onClick={() => softDelete(u.id)}
                            >
                              Eliminar
                            </button>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modals */}
      {renderFormModal(
        isCreateOpen,
        () => { setIsCreateOpen(false); resetForm(); },
        handleCreate,
        "Nuevo Usuario",
        "Crear Usuario",
        false
      )}

      {renderFormModal(
        isEditOpen,
        () => { setIsEditOpen(false); setEditTarget(null); resetForm(); },
        handleUpdate,
        "Editar Usuario",
        "Guardar Cambios",
        true
      )}
    </div>
  );
}
