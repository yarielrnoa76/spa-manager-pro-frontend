import React, { useEffect, useState } from "react";
import { FileText, RefreshCw, Loader2, CheckCircle2, XCircle, Star } from "lucide-react";
import { api, ApiError } from "../../services/api";
import { WhatsappTemplate } from "../../types";

const StatusPill: React.FC<{ status: string | null }> = ({ status }) => {
  const normalized = (status || "").toLowerCase();
  const tone =
    normalized === "approved"
      ? "bg-emerald-100 text-emerald-700"
      : normalized === "rejected"
        ? "bg-red-100 text-red-700"
        : "bg-amber-100 text-amber-700";
  return <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${tone}`}>{status || "—"}</span>;
};

const AvailabilityPill: React.FC<{ available: boolean }> = ({ available }) =>
  available ? null : (
    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-200 text-gray-600" title="Ya no aparece en Chatwoot, pero se conserva su historial/configuración">
      No disponible
    </span>
  );

const ToggleCell: React.FC<{ value: boolean; disabled: boolean; onToggle: () => void; busy: boolean }> = ({
  value,
  disabled,
  onToggle,
  busy,
}) => (
  <button
    type="button"
    onClick={onToggle}
    disabled={disabled || busy}
    className={`p-1.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
      value ? "text-emerald-600 hover:bg-emerald-50" : "text-gray-300 hover:bg-gray-100"
    }`}
    title={disabled ? "No tienes permiso para modificar esto" : undefined}
  >
    {busy ? <Loader2 size={16} className="animate-spin" /> : value ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
  </button>
);

/**
 * Settings -> Integrations -> Chatwoot -> WhatsApp Templates. Meta/Chatwoot-owned fields
 * (name/language/category/status/body) are read-only here by design -- SPA Manager Pro is
 * never the authority for template content or approval, only for enable/disable, closed-window
 * eligibility, and default selection (see backend WhatsappTemplateController).
 */
const WhatsappTemplatesSettings: React.FC<{ canManage: boolean }> = ({ canManage }) => {
  const [templates, setTemplates] = useState<WhatsappTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const fetchTemplates = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.listWhatsappTemplates();
      setTemplates(res.data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudieron cargar las plantillas de WhatsApp.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    setSyncMessage(null);
    setError(null);
    try {
      const result = await api.syncWhatsappTemplates();
      setSyncMessage(
        `Sincronización completa: ${result.created} nuevas, ${result.updated} actualizadas, ${result.marked_unavailable} marcadas no disponibles.`,
      );
      await fetchTemplates();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo sincronizar con Chatwoot.");
    } finally {
      setSyncing(false);
    }
  };

  const patchTemplate = async (template: WhatsappTemplate, payload: Parameters<typeof api.updateWhatsappTemplate>[1]) => {
    setBusyId(template.id);
    setError(null);
    try {
      await api.updateWhatsappTemplate(template.id, payload);
      await fetchTemplates();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo actualizar la plantilla.");
    } finally {
      setBusyId(null);
    }
  };

  const isUsable = (t: WhatsappTemplate) => t.is_available && t.enabled && (t.status || "").toLowerCase() === "approved";

  return (
    <div className="bg-white rounded-xl border p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-5 gap-3">
        <div>
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <FileText size={18} className="text-indigo-600" /> Plantillas de WhatsApp
          </h3>
          <p className="text-sm text-gray-500 mt-0.5">
            Registro local sincronizado desde el inbox de Chatwoot del tenant. El contenido, idioma, categoría y estado
            de aprobación son administrados por Meta/Chatwoot — aquí solo se controla su uso dentro de SPA Manager Pro.
          </p>
        </div>
        {canManage && (
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm shrink-0 disabled:opacity-60"
          >
            {syncing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            Sincronizar plantillas
          </button>
        )}
      </div>

      {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">{error}</div>}
      {syncMessage && (
        <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 mb-4">{syncMessage}</div>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Idioma</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Categoría</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Habilitada</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Ventana cerrada</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Predeterminada</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Última sincronización</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center">
                  <div className="inline-block w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                </td>
              </tr>
            ) : templates.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-500 text-sm">
                  Todavía no hay plantillas sincronizadas. {canManage && 'Usa "Sincronizar plantillas" para importarlas de Chatwoot.'}
                </td>
              </tr>
            ) : (
              templates.map((t) => (
                <tr key={t.id} className={`hover:bg-gray-50 ${!t.is_available ? "opacity-60" : ""}`}>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium text-gray-900">{t.name}</span>
                      <AvailabilityPill available={t.is_available} />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{t.language}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{t.category || "—"}</td>
                  <td className="px-4 py-3">
                    <StatusPill status={t.status} />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <ToggleCell
                      value={t.enabled}
                      disabled={!canManage}
                      busy={busyId === t.id}
                      onToggle={() => patchTemplate(t, { enabled: !t.enabled })}
                    />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <ToggleCell
                      value={t.allowed_when_window_closed}
                      disabled={!canManage}
                      busy={busyId === t.id}
                      onToggle={() => patchTemplate(t, { allowed_when_window_closed: !t.allowed_when_window_closed })}
                    />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      type="button"
                      onClick={() => patchTemplate(t, { is_default_closed_window: true })}
                      disabled={!canManage || busyId === t.id || t.is_default_closed_window || !isUsable(t)}
                      title={
                        t.is_default_closed_window
                          ? `Predeterminada para ${t.language}`
                          : !isUsable(t)
                            ? "Solo una plantilla disponible, habilitada y aprobada puede ser predeterminada"
                            : "Marcar como predeterminada para ventana cerrada"
                      }
                      className="p-1.5 rounded-lg transition-colors disabled:cursor-not-allowed hover:bg-amber-50"
                    >
                      <Star
                        size={16}
                        className={t.is_default_closed_window ? "text-amber-500 fill-amber-500" : "text-gray-300"}
                      />
                    </button>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {t.last_synced_at ? new Date(t.last_synced_at).toLocaleString() : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default WhatsappTemplatesSettings;
