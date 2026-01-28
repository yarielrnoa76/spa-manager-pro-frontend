import React, { useEffect, useState } from "react";
import { api } from "../services/api";

type Branch = {
  id: number;
  name: string;
  deleted_at?: string | null;
};

export default function BranchesSettings() {
  const [rows, setRows] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(false);

  // formulario simple
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<Branch | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      // endpoint sugerido: GET /branches?with_deleted=1 (o sin borradas)
      const res = await api.get("/branches");
      setRows(res.data ?? res);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    const payload = { name };

    if (!name.trim()) return;

    if (editing) {
      await api.put(`/branches/${editing.id}`, payload);
    } else {
      await api.post(`/branches`, payload);
    }

    setName("");
    setEditing(null);
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <input
          className="border rounded-lg px-3 py-2"
          placeholder="Nombre de la sucursal"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button
          onClick={save}
          className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700"
        >
          {editing ? "Guardar cambios" : "Agregar sucursal"}
        </button>
        {editing && (
          <button
            onClick={() => {
              setEditing(null);
              setName("");
            }}
            className="px-4 py-2 rounded-lg border font-semibold hover:bg-gray-50"
          >
            Cancelar
          </button>
        )}
      </div>

      <div className="overflow-x-auto border rounded-xl">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-3">Nombre</th>
              <th className="text-left p-3">Estado</th>
              <th className="text-right p-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="p-3 text-gray-500" colSpan={3}>
                  Cargando...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td className="p-3 text-gray-500" colSpan={3}>
                  No hay sucursales.
                </td>
              </tr>
            ) : (
              rows.map((b) => {
                const deleted = !!b.deleted_at;
                return (
                  <tr key={b.id} className="border-t">
                    <td className="p-3">{b.name}</td>
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
                          <button
                            className="px-3 py-1 rounded-lg border hover:bg-gray-50 font-semibold"
                            onClick={() => {
                              setEditing(b);
                              setName(b.name);
                            }}
                          >
                            Editar
                          </button>
                          <button
                            className="px-3 py-1 rounded-lg border hover:bg-red-50 text-red-600 font-semibold"
                            onClick={() => softDelete(b.id)}
                          >
                            Eliminar
                          </button>
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
