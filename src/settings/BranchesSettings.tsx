import React, { useEffect, useState } from "react";
import { api } from "../services/api";

type Branch = {
  id: number;
  name: string;
  code: string;
  address: string;
  deleted_at?: string | null;
};

// Error Helper
type ApiValidationErrors = Record<string, string[]>;
function getErrorMessage(e: any): string {
  const status = e?.status;
  const errors: ApiValidationErrors | undefined = e?.errors;
  if (status === 422 && errors) {
    const firstKey = Object.keys(errors)[0];
    const firstMsg = firstKey ? errors[firstKey]?.[0] : null;
    return firstMsg ?? "Validation failed.";
  }
  return e?.message ?? "Ocurrió un error.";
}

export default function BranchesSettings() {
  const [rows, setRows] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // formulario
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [address, setAddress] = useState("");
  const [editing, setEditing] = useState<Branch | null>(null);

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

  const save = async () => {
    setError(null);
    if (!name.trim() || !code.trim() || !address.trim()) {
      setError("Nombre, código y dirección son obligatorios.");
      return;
    }

    const payload = {
      name: name.trim(),
      code: code.trim(),
      address: address.trim()
    };

    setLoading(true);
    try {
      if (editing) {
        await api.put(`/branches/${editing.id}`, payload);
      } else {
        await api.post(`/branches`, payload);
      }

      setName("");
      setCode("");
      setAddress("");
      setEditing(null);
      await load();
    } catch (e: any) {
      setError(getErrorMessage(e));
      console.error("SAVE BRANCH ERROR =>", e);
    } finally {
      setLoading(false);
    }
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
      {error && (
        <div className="border rounded-lg p-3 bg-red-50 text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <input
          className="border rounded-lg px-3 py-2"
          placeholder="Nombre"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="border rounded-lg px-3 py-2"
          placeholder="Código (ej. HIA)"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <input
          className="border rounded-lg px-3 py-2"
          placeholder="Dirección"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />

        <div className="flex gap-2">
          <button
            onClick={save}
            disabled={loading}
            className="flex-1 px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:opacity-50"
          >
            {editing ? "Guardar" : "Agregar"}
          </button>

          {editing && (
            <button
              onClick={() => {
                setEditing(null);
                setName("");
                setCode("");
                setAddress("");
              }}
              className="px-4 py-2 rounded-lg border font-semibold hover:bg-gray-50"
            >
              Cancelar
            </button>
          )}
        </div>
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
                              setCode(b.code || "");
                              setAddress(b.address || "");
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
