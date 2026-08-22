import React, { useState } from "react";
import { KeyRound, X, Loader2, ShieldCheck } from "lucide-react";
import { api, ApiError } from "../../services/api";
import { ChatwootTokenRotationResult } from "../../types";

/**
 * Replaces a tenant's Chatwoot API token. The CURRENT token is never fetched, displayed, or
 * retrievable here -- only a new candidate is ever collected, and only in local component
 * state (never localStorage/sessionStorage, never logged). The backend validates the candidate
 * against the tenant's existing connection before persisting anything; on failure, the current
 * token is left completely unchanged (see ChatwootConnectionService::rotateToken).
 */
const RotateChatwootTokenModal: React.FC<{
  tenantId: number;
  onClose: () => void;
  onRotated: (result: ChatwootTokenRotationResult) => void;
}> = ({ tenantId, onClose, onRotated }) => {
  const [candidateToken, setCandidateToken] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    setCandidateToken("");
    setError(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!candidateToken.trim() || submitting) return;

    setSubmitting(true);
    setError(null);
    try {
      const result = await api.rotateChatwootToken(tenantId, candidateToken.trim());
      setCandidateToken("");
      onRotated(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo verificar el nuevo token. El token actual no fue modificado.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50/80 shrink-0">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <KeyRound size={20} className="text-indigo-600" />
            Reemplazar token de Chatwoot
          </h2>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 transition p-1 rounded-full hover:bg-gray-200">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col">
          <div className="px-6 py-5 space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nuevo API Token</label>
              <input
                type="password"
                autoComplete="new-password"
                value={candidateToken}
                onChange={(e) => setCandidateToken(e.target.value)}
                placeholder="••••••••••••••••••••"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-400 focus:outline-none text-sm font-mono"
              />
            </div>
            <p className="text-xs text-gray-500 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 flex items-start gap-2">
              <ShieldCheck size={14} className="text-indigo-500 mt-0.5 shrink-0" />
              El token actual permanecerá activo a menos que el nuevo token se verifique correctamente contra la
              configuración existente (URL, cuenta e inbox) del tenant.
            </p>
            {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
          </div>

          <div className="px-6 py-4 border-t bg-gray-50/80 shrink-0 flex gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-50 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting || !candidateToken.trim()}
              className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 disabled:bg-indigo-300 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}
              Verificar y reemplazar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RotateChatwootTokenModal;
