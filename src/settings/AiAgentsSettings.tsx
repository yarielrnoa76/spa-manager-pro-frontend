import React, { useCallback, useEffect, useState } from "react";
import { Bot, Loader2, Save, History, RotateCcw, ShieldAlert, Eye, ChevronDown, ChevronUp } from "lucide-react";
import { api, ApiError } from "../services/api";
import { AiAgent, AiAgentVersionSummary } from "../types";

const SourcePill: React.FC<{ source: string | undefined }> = ({ source }) => {
  const isOverride = source === "tenant_override";
  return (
    <span
      className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
        isOverride ? "bg-amber-100 text-amber-700" : "bg-indigo-100 text-indigo-700"
      }`}
    >
      {isOverride ? "Override activo" : "Prompt base de la plataforma"}
    </span>
  );
};

/**
 * Configuración -> Agentes IA (Close-out phase, Objective B). SPA Manager Pro is the source of
 * truth for the prompt an n8n-hosted AI agent uses at runtime -- changing tenant_instructions or
 * (SuperAdmin-only) system_prompt_override here takes effect on the NEXT inbound WhatsApp
 * message, with no n8n edit, republish, or credential change required.
 *
 * canManage authorizes enabled/tenant_instructions only. system_prompt_override is
 * SuperAdmin-exclusive server-side (403 otherwise) -- this component never sends that field
 * unless isSuperAdmin, matching the backend contract exactly rather than relying on the UI being
 * merely hidden.
 */
const AiAgentsSettings: React.FC<{
  isSuperAdmin?: boolean;
  canView: boolean;
  canManage: boolean;
  currentTenantId?: number | null;
}> = ({ isSuperAdmin, canView, canManage, currentTenantId }) => {
  const [agents, setAgents] = useState<AiAgent[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [agent, setAgent] = useState<AiAgent | null>(null);
  const [versions, setVersions] = useState<AiAgentVersionSummary[]>([]);
  const [showVersions, setShowVersions] = useState(false);

  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [tenantInstructionsDraft, setTenantInstructionsDraft] = useState("");
  const [overrideDraft, setOverrideDraft] = useState("");
  const [changeReasonDraft, setChangeReasonDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [savingOverride, setSavingOverride] = useState(false);
  const [restoringVersionId, setRestoringVersionId] = useState<number | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await api.listAiAgents();
      setAgents(list);
      setSelectedId((prev) => (prev && list.some((a) => a.id === prev) ? prev : list[0]?.id ?? null));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudieron cargar los agentes IA.");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDetail = useCallback(async (id: number) => {
    setDetailLoading(true);
    setError(null);
    try {
      const [detail, versionList] = await Promise.all([api.getAiAgent(id), api.listAiAgentVersions(id)]);
      setAgent(detail);
      setVersions(versionList);
      setTenantInstructionsDraft(detail.tenant_instructions || "");
      setOverrideDraft(detail.system_prompt_override || "");
      setChangeReasonDraft("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo cargar el detalle del agente.");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!canView) return;
    fetchList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView, currentTenantId]);

  useEffect(() => {
    if (selectedId != null) fetchDetail(selectedId);
  }, [selectedId, fetchDetail]);

  if (!canView) {
    return <div className="p-4 text-center text-gray-500">Acceso denegado.</div>;
  }

  const handleSaveInstructions = async () => {
    if (!agent) return;
    setSaving(true);
    setError(null);
    setSuccessMessage(null);
    try {
      await api.updateAiAgent(agent.id, {
        tenant_instructions: tenantInstructionsDraft.trim() === "" ? null : tenantInstructionsDraft,
        change_reason: changeReasonDraft.trim() === "" ? undefined : changeReasonDraft,
      });
      setSuccessMessage("Instrucciones guardadas. Se aplicarán al próximo mensaje entrante.");
      await fetchDetail(agent.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudieron guardar las instrucciones.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleEnabled = async () => {
    if (!agent) return;
    setSaving(true);
    setError(null);
    setSuccessMessage(null);
    try {
      await api.updateAiAgent(agent.id, { enabled: !agent.enabled });
      await fetchDetail(agent.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo cambiar el estado del agente.");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveOverride = async () => {
    if (!agent) return;
    setSavingOverride(true);
    setError(null);
    setSuccessMessage(null);
    try {
      await api.updateAiAgent(agent.id, {
        system_prompt_override: overrideDraft.trim() === "" ? null : overrideDraft,
        change_reason: changeReasonDraft.trim() === "" ? undefined : changeReasonDraft,
      });
      setSuccessMessage("Override guardado.");
      await fetchDetail(agent.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo guardar el override.");
    } finally {
      setSavingOverride(false);
    }
  };

  const handleRestore = async (versionId: number) => {
    if (!agent) return;
    setRestoringVersionId(versionId);
    setError(null);
    setSuccessMessage(null);
    try {
      await api.restoreAiAgentVersion(agent.id, versionId);
      setSuccessMessage("Versión restaurada como una nueva versión.");
      await fetchDetail(agent.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo restaurar la versión.");
    } finally {
      setRestoringVersionId(null);
    }
  };

  const baseline = agent?.platform_baseline_prompt ?? null;
  const instructionsDirty = agent != null && tenantInstructionsDraft !== (agent.tenant_instructions || "");
  const overrideDirty = agent != null && overrideDraft !== (agent.system_prompt_override || "");

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Bot size={20} className="text-indigo-600" />
        <div>
          <h3 className="text-lg font-bold text-gray-900">Agentes IA</h3>
          <p className="text-sm text-gray-500">
            SPA Manager Pro es la fuente de verdad del prompt que usa el agente IA en n8n. Los cambios aquí se aplican
            al próximo mensaje entrante — sin editar ni republicar el workflow de n8n.
          </p>
        </div>
      </div>

      {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
      {successMessage && (
        <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">{successMessage}</div>
      )}

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="animate-spin text-indigo-600" size={24} />
        </div>
      ) : agents.length === 0 ? (
        <div className="text-sm text-gray-500 py-6 text-center">Todavía no hay agentes IA configurados para este tenant.</div>
      ) : (
        <div className="bg-white rounded-xl border p-6 space-y-5">
          {agents.length > 1 && (
            <select
              aria-label="Seleccionar agente"
              value={selectedId ?? ""}
              onChange={(e) => setSelectedId(Number(e.target.value))}
              className="border rounded-lg px-3 py-2 text-sm"
            >
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          )}

          {detailLoading || !agent ? (
            <div className="flex justify-center py-10">
              <Loader2 className="animate-spin text-indigo-600" size={24} />
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-gray-900">{agent.name}</h4>
                    <SourcePill source={agent.effective_prompt !== undefined ? (agent.system_prompt_override ? "tenant_override" : "platform_default") : undefined} />
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Código: <code>{agent.code}</code> · Versión actual: v{agent.current_version}
                  </p>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <span className="text-gray-600">Habilitado</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={agent.enabled}
                    onClick={handleToggleEnabled}
                    disabled={!canManage || saving || (!agent.enabled && !isSuperAdmin)}
                    title={
                      !agent.enabled && !isSuperAdmin && canManage
                        ? "El prompt base actual es específico de AVA Day Spa. Solo un SuperAdmin puede activarlo durante este cierre de fase."
                        : undefined
                    }
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                      agent.enabled ? "bg-emerald-500" : "bg-gray-300"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        agent.enabled ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Instrucciones del tenant</label>
                <p className="text-xs text-gray-500 mb-2">
                  Se agregan al final del prompt base. Úsalas para promociones, aclaraciones o reglas específicas de
                  este tenant.
                </p>
                <textarea
                  value={tenantInstructionsDraft}
                  onChange={(e) => setTenantInstructionsDraft(e.target.value)}
                  disabled={!canManage}
                  rows={5}
                  className="w-full border rounded-lg px-3 py-2 text-sm font-mono disabled:bg-gray-50 disabled:text-gray-500"
                  placeholder="Sin instrucciones adicionales del tenant."
                />
                {canManage && (
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      type="text"
                      value={changeReasonDraft}
                      onChange={(e) => setChangeReasonDraft(e.target.value)}
                      placeholder="Motivo del cambio (opcional)"
                      className="flex-1 border rounded-lg px-3 py-2 text-sm"
                    />
                    <button
                      onClick={handleSaveInstructions}
                      disabled={saving || !instructionsDirty}
                      className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 shrink-0"
                    >
                      {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                      Guardar
                    </button>
                  </div>
                )}
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => setShowVersions((v) => !v)}
                  className="flex items-center gap-1.5 text-sm font-medium text-gray-700 hover:text-indigo-600"
                >
                  <History size={16} />
                  Historial de versiones ({versions.length})
                  {showVersions ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
                {showVersions && (
                  <div className="mt-2 border rounded-lg divide-y">
                    {versions.map((v) => (
                      <div key={v.id} className="flex items-center justify-between px-3 py-2 text-sm">
                        <div>
                          <span className="font-semibold">v{v.version}</span>
                          {v.version === agent.current_version && (
                            <span className="ml-2 text-[11px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full">actual</span>
                          )}
                          <span className="ml-2 text-gray-500">
                            {v.changedBy?.name || "Sistema"} · {new Date(v.created_at).toLocaleString()}
                          </span>
                          {v.change_reason && <span className="ml-2 text-gray-400 italic">"{v.change_reason}"</span>}
                        </div>
                        {canManage && v.version !== agent.current_version && (
                          <button
                            onClick={() => handleRestore(v.id)}
                            disabled={restoringVersionId === v.id}
                            className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
                          >
                            {restoringVersionId === v.id ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <RotateCcw size={14} />
                            )}
                            Restaurar
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {isSuperAdmin && (
                <div className="border-t pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAdvanced((v) => !v)}
                    className="flex items-center gap-1.5 text-sm font-medium text-amber-700 hover:text-amber-900"
                  >
                    <ShieldAlert size={16} />
                    Avanzado (solo SuperAdmin)
                    {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>

                  {showAdvanced && (
                    <div className="mt-3 space-y-4">
                      <div>
                        <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1">
                          <Eye size={14} /> Prompt base de la plataforma (solo lectura)
                        </label>
                        {baseline !== null ? (
                          <pre className="whitespace-pre-wrap text-xs bg-gray-50 border rounded-lg p-3 max-h-56 overflow-y-auto font-mono text-gray-700">
                            {baseline}
                          </pre>
                        ) : (
                          <p className="text-xs text-gray-500 italic">No disponible.</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Override del prompt del sistema (reemplaza el prompt base)
                        </label>
                        <textarea
                          value={overrideDraft}
                          onChange={(e) => setOverrideDraft(e.target.value)}
                          rows={6}
                          className="w-full border rounded-lg px-3 py-2 text-sm font-mono"
                          placeholder="Vacío = usar el prompt base de la plataforma."
                        />
                        <div className="flex justify-end mt-2">
                          <button
                            onClick={handleSaveOverride}
                            disabled={savingOverride || !overrideDirty}
                            className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors disabled:opacity-50"
                          >
                            {savingOverride ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                            Guardar override
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1">
                          <Eye size={14} /> Vista previa del prompt efectivo
                        </label>
                        <pre className="whitespace-pre-wrap text-xs bg-gray-50 border rounded-lg p-3 max-h-56 overflow-y-auto font-mono text-gray-700">
                          {agent.effective_prompt}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default AiAgentsSettings;
