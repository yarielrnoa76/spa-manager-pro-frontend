import React, { useState } from "react";
import { Link2, X, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { api, ApiError } from "../../services/api";
import { N8nConnection } from "../../types";
import { TextField, MaskedInput } from "../tenant/TenantFormFields";

type FieldErrors = Record<string, string>;

/** Same mapping pattern TenantFormModal uses for its own sections. */
function applyError(err: unknown, setFieldErrors: (e: FieldErrors) => void, setGeneralError: (m: string | null) => void) {
  if (err instanceof ApiError && err.status === 422) {
    const mapped: FieldErrors = {};
    Object.entries(err.errors ?? {}).forEach(([key, messages]) => {
      if (messages && messages.length > 0) mapped[key] = messages[0];
    });
    setFieldErrors(mapped);
    setGeneralError(Object.keys(mapped).length > 0 ? null : err.message || "Validación fallida.");
  } else if (err instanceof ApiError) {
    setFieldErrors({});
    setGeneralError(err.message || "No se pudo guardar la conexión.");
  } else {
    setFieldErrors({});
    setGeneralError("No se pudo guardar la conexión. Verifica tu conexión e intenta de nuevo.");
  }
}

const MASK = "••••••••";

const N8nConnectionFormModal: React.FC<{
  connection: N8nConnection | null;
  onClose: () => void;
  onSaved: (connection: N8nConnection) => void;
}> = ({ connection, onClose, onSaved }) => {
  const isEdit = !!connection;

  const [name, setName] = useState(connection?.name ?? "");
  const [baseUrl, setBaseUrl] = useState(connection?.base_url ?? "");
  const [apiKey, setApiKey] = useState(connection?.api_key ?? "");
  const [active, setActive] = useState(connection?.active ?? true);
  const [isDefault, setIsDefault] = useState(connection?.is_default ?? false);

  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      // If editing and the key was never touched (still the mask), there is no real value to
      // send — test the already-persisted connection using its own stored key instead.
      const result =
        isEdit && connection && apiKey === MASK
          ? await api.testN8nConnection(connection.id)
          : await api.testN8nConnectionDraft(baseUrl.trim(), apiKey.trim());
      setTestResult({ ok: result.ok, message: result.message });
    } catch (err) {
      setTestResult({
        ok: false,
        message: err instanceof ApiError ? err.message : "No se pudo probar la conexión.",
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);
    setFieldErrors({});
    setSaving(true);

    try {
      let saved: N8nConnection;
      if (isEdit && connection) {
        saved = await api.updateN8nConnection(connection.id, {
          name: name.trim(),
          base_url: baseUrl.trim(),
          api_key: apiKey.trim(),
          active,
          is_default: isDefault,
        });
      } else {
        saved = await api.createN8nConnection({
          name: name.trim(),
          base_url: baseUrl.trim(),
          api_key: apiKey.trim(),
          active,
          is_default: isDefault,
        });
      }
      onSaved(saved);
    } catch (err) {
      applyError(err, setFieldErrors, setGeneralError);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50/80 shrink-0">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Link2 size={22} className="text-indigo-600" />
            {isEdit ? "Editar conexión n8n" : "Nueva conexión n8n"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition p-1 rounded-full hover:bg-gray-200"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col overflow-y-auto">
          <div className="px-6 py-5 space-y-4">
            <p className="text-xs text-gray-500 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
              Esta clave es la credencial de la API de Administración de n8n (Management/Public API),
              usada por SPA Manager Pro para administrar workflows. No es la misma clave que la
              integración legacy del tenant (n8n_api_key / n8n_webhook_url).
            </p>

            <TextField
              label="Nombre"
              value={name}
              onChange={setName}
              required
              placeholder="Ej: Primary n8n"
              error={fieldErrors.name}
            />

            <TextField
              label="Base URL"
              value={baseUrl}
              onChange={setBaseUrl}
              required
              type="url"
              placeholder="https://n8n.midominio.com"
              error={fieldErrors.base_url}
            />

            <MaskedInput
              label="Management API Key"
              value={apiKey}
              onChange={(v) => {
                setApiKey(v);
                setTestResult(null);
              }}
              placeholder={isEdit ? "Dejar en blanco para conservar la actual" : "Clave de la API de administración"}
            />
            {fieldErrors.api_key && <p className="text-xs text-red-500 -mt-2">{fieldErrors.api_key}</p>}

            <div className="flex items-center gap-6 pt-1">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                Activa
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                Marcar como predeterminada
              </label>
            </div>
            <p className="text-[11px] text-gray-400 -mt-2">
              Predeterminada = selección sugerida al asignar un tenant. Nunca se usa automáticamente
              en tiempo de ejecución: cada tenant debe tener su conexión asignada explícitamente.
            </p>

            <div className="border-t pt-4">
              <button
                type="button"
                onClick={handleTest}
                disabled={testing || !baseUrl.trim() || !apiKey.trim()}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {testing ? <Loader2 size={16} className="animate-spin" /> : <Link2 size={16} />}
                Probar conexión
              </button>
              {testResult && (
                <div
                  className={`mt-3 flex items-start gap-2 text-sm rounded-lg px-3 py-2 border ${
                    testResult.ok
                      ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                      : "bg-red-50 border-red-200 text-red-700"
                  }`}
                >
                  {testResult.ok ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <XCircle size={16} className="mt-0.5 shrink-0" />}
                  <span>{testResult.message}</span>
                </div>
              )}
            </div>
          </div>

          <div className="px-6 py-4 border-t bg-gray-50/80 shrink-0">
            {generalError && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">
                {generalError}
              </div>
            )}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-50 transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 disabled:bg-indigo-300 disabled:cursor-not-allowed transition"
              >
                {saving ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear conexión"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default N8nConnectionFormModal;
