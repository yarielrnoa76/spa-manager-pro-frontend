import React, { useEffect, useState } from "react";
import { api } from "../services/api";
import BranchFormModal from "../components/BranchFormModal";

type Tenant = { id: number; name: string };

type Branch = {
  id: number;
  name: string;
  code: string;
  address: string;
  tenant?: Tenant | null;
  deleted_at?: string | null;
};

export default function BranchesSettings({
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
  const [rows, setRows] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      // endpoint sugerido: GET /branches?with_deleted=1 (o sin borradas)
      const res = await api.get<Branch[]>("/branches");
      setRows(Array.isArray(res) ? res : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditingBranch(null);
    setModalOpen(true);
  };

  const openEdit = (branch: Branch) => {
    setEditingBranch(branch);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingBranch(null);
  };

  const handleSaved = async () => {
    closeModal();
    await load();
  };

  const softDelete = async (id: number) => {
    await api.delete(`/branches/${id}`); // soft delete en backend
    await load();
  };

  const restore = async (id: number) => {
    await api.post(`/branches/${id}/restore`);
    await load();
  };

  return (
    <div className="space-y-4">
      {canCreate && (
        <div className="flex justify-end">
          <button
            onClick={openCreate}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition"
          >
            + Nueva Sucursal
          </button>
        </div>
      )}

      {modalOpen && (
        <BranchFormModal
          branch={editingBranch}
          onClose={closeModal}
          onSaved={handleSaved}
        />
      )}

      <div className="overflow-x-auto border rounded-xl">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-3">Nombre</th>
              {isSuperAdmin && <th className="text-left p-3">Tenant</th>}
              <th className="text-left p-3">Estado</th>
              <th className="text-right p-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="p-3 text-gray-500" colSpan={isSuperAdmin ? 4 : 3}>
                  Cargando...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td className="p-3 text-gray-500" colSpan={isSuperAdmin ? 4 : 3}>
                  No hay sucursales.
                </td>
              </tr>
            ) : (
              rows.map((b) => {
                const deleted = !!b.deleted_at;
                return (
                  <tr key={b.id} className="border-t">
                    <td className="p-3">{b.name}</td>
                    {isSuperAdmin && (
                      <td className="p-3">
                        {b.tenant ? (
                          <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded-md text-xs font-medium">
                            {b.tenant.name}
                          </span>
                        ) : (
                          <span className="text-gray-400 italic text-xs">Global</span>
                        )}
                      </td>
                    )}
                    <td className="p-3">
                      {deleted ? (
                        <span className="text-red-600 font-semibold">
                          Eliminada
                        </span>
                      ) : (
                        <span className="text-green-700 font-semibold">
                          Activa
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-right space-x-2">
                      {!deleted && (
                        <>
                          {canEdit && (
                            <button
                              className="px-3 py-1 rounded-lg border hover:bg-gray-50 font-semibold"
                              onClick={() => openEdit(b)}
                            >
                              Editar
                            </button>
                          )}
                          {canDelete && (
                            <button
                              className="px-3 py-1 rounded-lg border hover:bg-red-50 text-red-600 font-semibold"
                              onClick={() => softDelete(b.id)}
                            >
                              Eliminar
                            </button>
                          )}
                        </>
                      )}
                      {deleted && (
                        <button
                          className="px-3 py-1 rounded-lg border hover:bg-gray-50 font-semibold"
                          onClick={() => restore(b.id)}
                        >
                          Restaurar
                        </button>
                      )}
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
