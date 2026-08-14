import React, { useEffect, useState } from "react";
import { Link2, Plus, Pencil, Trash2, Power, PowerOff, Star, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { api, ApiError } from "../../services/api";
import { N8nConnection } from "../../types";
import N8nConnectionFormModal from "./N8nConnectionFormModal";

const StatusPill: React.FC<{ active: boolean }> = ({ active }) => (
  <span
    className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
      active ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"
    }`}
  >
    {active ? "Activa" : "Inactiva"}
  </span>
);

const LastTest: React.FC<{ status: N8nConnection["last_test_status"]; at: string | null }> = ({ status, at }) => {
  if (!status) return <span className="text-xs text-gray-400">Sin probar</span>;
  const ok = status === "passed";
  return (
    <span className={`inline-flex items-center gap-1 text-xs ${ok ? "text-emerald-600" : "text-red-600"}`}>
      {ok ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
      {ok ? "OK" : "Falló"}
      {at && <span className="text-gray-400">· {new Date(at).toLocaleString()}</span>}
    </span>
  );
};

const N8nConnectionsSection: React.FC = () => {
  const [connections, setConnections] = useState<N8nConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalState, setModalState] = useState<"closed" | "new" | N8nConnection>("closed");
  const [testingId, setTestingId] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const fetchConnections = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.listN8nConnections();
      setConnections(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudieron cargar las conexiones de n8n.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConnections();
  }, []);

  const handleSaved = () => {
    setModalState("closed");
    fetchConnections();
  };

  const handleTest = async (connection: N8nConnection) => {
    setTestingId(connection.id);
    try {
      const result = await api.testN8nConnection(connection.id);
      window.alert(result.message);
      fetchConnections();
    } catch (err) {
      window.alert(err instanceof ApiError ? err.message : "No se pudo probar la conexión.");
    } finally {
      setTestingId(null);
    }
  };

  const handleToggleActive = async (connection: N8nConnection) => {
    if (connection.active) {
      const warning =
        connection.assigned_tenants_count > 0
          ? `${connection.assigned_tenants_count} tenant(s) están actualmente asignados a "${connection.name}". Desactivarla no los reasigna, pero deben evitarse nuevas operaciones contra esta conexión mientras esté inactiva. ¿Continuar?`
          : `¿Desactivar la conexión "${connection.name}"?`;
      if (!window.confirm(warning)) return;
    }

    setBusyId(connection.id);
    try {
      if (connection.active) {
        await api.deactivateN8nConnection(connection.id);
      } else {
        await api.activateN8nConnection(connection.id);
      }
      fetchConnections();
    } catch (err) {
      window.alert(err instanceof ApiError ? err.message : "No se pudo actualizar el estado de la conexión.");
    } finally {
      setBusyId(null);
    }
  };

  const handleSetDefault = async (connection: N8nConnection) => {
    setBusyId(connection.id);
    try {
      await api.setDefaultN8nConnection(connection.id);
      fetchConnections();
    } catch (err) {
      window.alert(err instanceof ApiError ? err.message : "No se pudo establecer la conexión predeterminada.");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (connection: N8nConnection) => {
    if (!window.confirm(`¿Eliminar permanentemente la conexión "${connection.name}"? Esta acción no se puede deshacer.`)) return;

    setBusyId(connection.id);
    try {
      await api.deleteN8nConnection(connection.id);
      fetchConnections();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        window.alert(
          err.message ||
            `No se puede eliminar: ${connection.assigned_tenants_count} tenant(s) están asignados a esta conexión.`,
        );
      } else {
        window.alert(err instanceof ApiError ? err.message : "No se pudo eliminar la conexión.");
      }
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="bg-white rounded-xl border p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-5 gap-3">
        <div>
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Link2 size={18} className="text-indigo-600" /> n8n
          </h3>
          <p className="text-sm text-gray-500 mt-0.5">
            Instancias de n8n que SPA Manager Pro puede administrar. Cada tenant debe asignarse
            explícitamente a una de estas conexiones — nunca se usa una predeterminada de forma
            automática.
          </p>
        </div>
        <button
          onClick={() => setModalState("new")}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm shrink-0"
        >
          <Plus size={16} /> Nueva conexión
        </button>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Base URL</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Clave</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Última prueba</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tenants</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center">
                  <div className="inline-block w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                </td>
              </tr>
            ) : connections.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500 text-sm">
                  Todavía no hay conexiones de n8n configuradas.
                </td>
              </tr>
            ) : (
              connections.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium text-gray-900">{c.name}</span>
                      {c.is_default && (
                        <span title="Predeterminada">
                          <Star size={13} className="text-amber-500 fill-amber-500" />
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 max-w-[220px] truncate" title={c.base_url}>
                    {c.base_url}
                  </td>
                  <td className="px-4 py-3 text-sm font-mono text-gray-500">{c.api_key ?? "—"}</td>
                  <td className="px-4 py-3">
                    <StatusPill active={c.active} />
                  </td>
                  <td className="px-4 py-3">
                    <LastTest status={c.last_test_status} at={c.last_tested_at} />
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{c.assigned_tenants_count}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleTest(c)}
                        disabled={testingId === c.id}
                        className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors disabled:opacity-50"
                        title="Probar conexión"
                      >
                        {testingId === c.id ? <Loader2 size={16} className="animate-spin" /> : <Link2 size={16} />}
                      </button>
                      {!c.is_default && (
                        <button
                          onClick={() => handleSetDefault(c)}
                          disabled={busyId === c.id}
                          className="p-2 text-gray-400 hover:text-amber-500 hover:bg-amber-50 rounded-lg transition-colors disabled:opacity-50"
                          title="Marcar como predeterminada"
                        >
                          <Star size={16} />
                        </button>
                      )}
                      <button
                        onClick={() => handleToggleActive(c)}
                        disabled={busyId === c.id}
                        className={`p-2 rounded-lg transition-colors disabled:opacity-50 ${
                          c.active ? "text-gray-400 hover:text-amber-600 hover:bg-amber-50" : "text-gray-400 hover:text-emerald-600 hover:bg-emerald-50"
                        }`}
                        title={c.active ? "Desactivar" : "Activar"}
                      >
                        {c.active ? <PowerOff size={16} /> : <Power size={16} />}
                      </button>
                      <button
                        onClick={() => setModalState(c)}
                        className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="Editar"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(c)}
                        disabled={busyId === c.id}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                        title={c.assigned_tenants_count > 0 ? "No se puede eliminar: tiene tenants asignados" : "Eliminar"}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modalState !== "closed" && (
        <N8nConnectionFormModal
          connection={modalState === "new" ? null : modalState}
          onClose={() => setModalState("closed")}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
};

export default N8nConnectionsSection;
