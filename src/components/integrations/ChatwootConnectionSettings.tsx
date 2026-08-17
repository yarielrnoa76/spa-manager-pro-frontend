import React, { useState } from "react";
import { Link2, Loader2, CheckCircle2, XCircle, KeyRound, RadioTower } from "lucide-react";
import { api, ApiError } from "../../services/api";
import { ChatwootConnectionHealth } from "../../types";
import RotateChatwootTokenModal from "./RotateChatwootTokenModal";

/**
 * Settings -> Integrations -> Chatwoot -> Connection. Read-only health display for the
 * tenant's ALREADY-configured Chatwoot connection (base_url/account_id/inbox_id, edited via
 * the SuperAdmin Tenant form -- this component never edits that configuration, only tests it
 * and rotates the token). The current token is never fetched or displayed here, in line with
 * the backend never returning it.
 */
const ChatwootConnectionSettings: React.FC<{
  tenantId: number;
  onTokenRotated?: () => void;
}> = ({ tenantId, onTokenRotated }) => {
  const [health, setHealth] = useState<ChatwootConnectionHealth | null>(null);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRotateModal, setShowRotateModal] = useState(false);

  const handleTest = async () => {
    setTesting(true);
    setError(null);
    try {
      const result = await api.testTenantChatwootConnection(tenantId);
      setHealth(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo probar la conexión de Chatwoot.");
    } finally {
      setTesting(false);
    }
  };

  const handleRotated = (result: ChatwootConnectionHealth) => {
    setHealth(result);
    setShowRotateModal(false);
    onTokenRotated?.();
  };

  return (
    <div className="bg-white rounded-xl border p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-5 gap-3">
        <div>
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Link2 size={18} className="text-indigo-600" /> Chatwoot — Conexión
          </h3>
          <p className="text-sm text-gray-500 mt-0.5">
            Estado de la conexión de Chatwoot ya configurada para este tenant. La URL base, cuenta e inbox se
            administran desde la configuración del Tenant — aquí solo se verifica el estado y se rota el token.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={handleTest}
            disabled={testing}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60 transition"
          >
            {testing ? <Loader2 size={16} className="animate-spin" /> : <RadioTower size={16} />}
            Probar conexión
          </button>
          <button
            onClick={() => setShowRotateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <KeyRound size={16} />
            Reemplazar token
          </button>
        </div>
      </div>

      {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">{error}</div>}

      {!health ? (
        <div className="text-sm text-gray-500 bg-gray-50 border border-gray-100 rounded-lg px-4 py-6 text-center">
          Sin probar en esta sesión. Usa "Probar conexión" para ver el estado actual.
        </div>
      ) : !health.configured ? (
        <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
          Chatwoot no está completamente configurado para este tenant. Configura la URL base, cuenta e inbox desde
          la pantalla de administración de Tenants.
        </div>
      ) : (
        <div
          className={`rounded-lg border px-4 py-3 flex items-start gap-3 ${
            health.ok ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"
          }`}
        >
          {health.ok ? (
            <CheckCircle2 size={18} className="text-emerald-600 mt-0.5 shrink-0" />
          ) : (
            <XCircle size={18} className="text-red-600 mt-0.5 shrink-0" />
          )}
          <div className="text-sm space-y-1">
            <p className={`font-semibold ${health.ok ? "text-emerald-800" : "text-red-800"}`}>{health.message}</p>
            {health.ok && (
              <dl className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-gray-600 mt-1">
                {health.inbox_name && (
                  <>
                    <dt className="text-gray-400">Inbox</dt>
                    <dd>{health.inbox_name}</dd>
                  </>
                )}
                {health.channel_type && (
                  <>
                    <dt className="text-gray-400">Canal</dt>
                    <dd>{health.channel_type}</dd>
                  </>
                )}
                {health.provider && (
                  <>
                    <dt className="text-gray-400">Proveedor</dt>
                    <dd>{health.provider}</dd>
                  </>
                )}
                {health.account_id && (
                  <>
                    <dt className="text-gray-400">Cuenta</dt>
                    <dd>{health.account_id}</dd>
                  </>
                )}
              </dl>
            )}
            {health.last_tested_at && (
              <p className="text-[11px] text-gray-400 mt-1">Última prueba: {new Date(health.last_tested_at).toLocaleString()}</p>
            )}
          </div>
        </div>
      )}

      {showRotateModal && (
        <RotateChatwootTokenModal tenantId={tenantId} onClose={() => setShowRotateModal(false)} onRotated={handleRotated} />
      )}
    </div>
  );
};

export default ChatwootConnectionSettings;
