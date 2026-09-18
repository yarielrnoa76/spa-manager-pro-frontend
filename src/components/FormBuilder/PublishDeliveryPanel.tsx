import React, { useCallback, useEffect, useState } from "react";
import { PlayCircle, PauseCircle, UploadCloud, History, CheckCircle2, AlertTriangle, Link2 } from "lucide-react";
import { api, ApiError } from "../../services/api";
import { PublicLeadForm, PublicLeadFormReadiness, PublicLeadFormVersion } from "../../types";
import { getCodeMessage, getDraftStatusPresentation, getPublicLeadFormMutationErrorMessage } from "../../utils/publicLeadFormPresentation";
import CopyButton from "../shared/CopyButton";
import QrCodeDisplay from "./QrCodeDisplay";

/**
 * Derives the loader script's own origin from an already-confirmed, backend-delivered
 * `page_url` -- never guesses or reconstructs a domain, and never concatenates `/f/{uuid}`
 * itself. Returns null for anything that doesn't parse as an absolute URL.
 */
function originOf(pageUrl: string): string | null {
  try {
    return new URL(pageUrl).origin;
  } catch {
    return null;
  }
}

type LoadState = "loading" | "success" | "forbidden" | "error";
type ConfirmKind = "publish" | "activate" | "pause" | null;

/**
 * Readiness, draft publication, activation, pause, version history, and delivery artifacts
 * (hosted URL / embed snippet / QR / share link). Publish/activate/pause each require their own
 * explicit confirmation and use the real B3 endpoints (`/draft/publish`, `/activate`, `/pause`)
 * -- never the deprecated `/publish` alias. Every action re-fetches the canonical state from the
 * backend afterward; nothing here is ever applied optimistically.
 *
 * Delivery gap (documented, not silently worked around): the deployed backend (commit `9aecba2`)
 * does not expose the platform's hosted-form base URL through any authenticated admin endpoint,
 * only `form.uuid`. Concatenating a guessed domain would violate "the frontend never invents the
 * hosted URL" -- so hosted URL / embed snippet / QR / share link render an honest "not available"
 * state instead of a fabricated one, until a backend field carries the canonical URL.
 */
const PublishDeliveryPanel: React.FC<{
  formId: number;
  form: PublicLeadForm;
  readiness: PublicLeadFormReadiness | null;
  readinessState: LoadState;
  onRefreshReadiness: () => void;
  onFormMutated: () => void;
  canPublish: boolean;
}> = ({ formId, form, readiness, readinessState, onRefreshReadiness, onFormMutated, canPublish }) => {
  const [versions, setVersions] = useState<PublicLeadFormVersion[]>([]);
  const [versionsState, setVersionsState] = useState<LoadState>("loading");

  const loadVersions = useCallback(async () => {
    setVersionsState("loading");
    try {
      const data = await api.listPublicLeadFormVersions(formId);
      setVersions(Array.isArray(data) ? data : []);
      setVersionsState("success");
    } catch (err: unknown) {
      setVersions([]);
      setVersionsState(err instanceof ApiError && err.status === 403 ? "forbidden" : "error");
    }
  }, [formId]);

  useEffect(() => {
    loadVersions();
  }, [loadVersions]);

  const [confirmKind, setConfirmKind] = useState<ConfirmKind>(null);
  const [actionInFlight, setActionInFlight] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const refreshAfterMutation = useCallback(() => {
    loadVersions();
    onRefreshReadiness();
    onFormMutated();
  }, [loadVersions, onRefreshReadiness, onFormMutated]);

  const runAction = async (kind: Exclude<ConfirmKind, null>) => {
    setActionError(null);
    setActionInFlight(true);
    try {
      if (kind === "publish") await api.publishPublicLeadFormDraft(formId);
      if (kind === "activate") await api.activatePublicLeadForm(formId);
      if (kind === "pause") await api.pausePublicLeadForm(formId);
      refreshAfterMutation();
    } catch (err: unknown) {
      setActionError(getPublicLeadFormMutationErrorMessage(err));
      // Preserve the previous confirmed state -- re-fetch the canonical readiness/form even on
      // failure, so the panel never keeps showing a stale "before" picture underneath the error.
      onRefreshReadiness();
    } finally {
      setActionInFlight(false);
      setConfirmKind(null);
    }
  };

  const hasPublishedVersion = readiness?.has_published_version === true;
  const isDeliverable = hasPublishedVersion && form.enabled;
  const draftStatus = readiness ? getDraftStatusPresentation(readiness) : null;
  const pageUrl = typeof form.page_url === "string" && form.page_url.trim() !== "" ? form.page_url : null;
  const loaderOrigin = pageUrl ? originOf(pageUrl) : null;
  const embedSnippet = pageUrl
    ? `<iframe src="${pageUrl}" style="width:100%;border:0" title="Formulario web" loading="lazy"></iframe>`
    : null;
  const loaderSnippet = loaderOrigin
    ? `<script async src="${loaderOrigin}/embed/loader.js" data-uuid="${form.uuid}"></script>`
    : null;

  return (
    <div className="space-y-6">
      {actionError && (
        <p role="alert" className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
          {actionError}
        </p>
      )}

      {/* Readiness summary */}
      <div className="border rounded-xl bg-white p-4">
        <h4 className="text-sm font-bold text-gray-800 mb-3">Disponibilidad</h4>
        {readinessState === "loading" && <p className="text-xs text-gray-400 italic">Consultando disponibilidad...</p>}
        {readinessState === "forbidden" && <p className="text-xs text-red-600 font-semibold">No tienes permiso para consultar la disponibilidad.</p>}
        {readinessState === "error" && (
          <div className="flex items-center gap-2">
            <p className="text-xs text-red-600 font-semibold">No se pudo consultar la disponibilidad.</p>
            <button onClick={onRefreshReadiness} className="text-xs font-bold text-indigo-600 hover:underline">Reintentar</button>
          </div>
        )}
        {readinessState === "success" && readiness && draftStatus && (
          <div className="space-y-2 text-xs">
            <div className="flex flex-wrap gap-2">
              <span
                data-testid="draft-status-badge"
                className={`px-2 py-0.5 rounded-full font-bold border ${
                  draftStatus.tone === "ready"
                    ? "bg-green-50 text-green-700 border-green-200"
                    : draftStatus.tone === "neutral"
                      ? "bg-gray-100 text-gray-600 border-gray-200"
                      : "bg-amber-50 text-amber-700 border-amber-200"
                }`}
              >
                {draftStatus.label}
              </span>
              <span className={`px-2 py-0.5 rounded-full font-bold border ${readiness.activatable ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-100 text-gray-600 border-gray-200"}`}>
                {readiness.activatable ? "Activable" : "No activable"}
              </span>
              <span className={`px-2 py-0.5 rounded-full font-bold border ${form.enabled ? "bg-indigo-50 text-indigo-700 border-indigo-200" : "bg-gray-100 text-gray-600 border-gray-200"}`}>
                {form.enabled ? "Activo" : "Pausado"}
              </span>
            </div>
            {draftStatus.message && (
              <p data-testid="draft-blocking-message" className="text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
                {draftStatus.message}
              </p>
            )}
            {readiness.activation_blocking_condition && (
              <p data-testid="activation-blocking-message" className="text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
                {getCodeMessage(readiness.activation_blocking_condition.code, readiness.activation_blocking_condition.message)}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="border rounded-xl bg-white p-4">
        <h4 className="text-sm font-bold text-gray-800 mb-3">Acciones</h4>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setConfirmKind("publish")}
            disabled={!canPublish || actionInFlight || readiness?.draft_publishable !== true}
            title={!canPublish ? "Requiere el permiso de publicación." : undefined}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <UploadCloud size={14} /> Publicar borrador
          </button>

          <button
            onClick={() => setConfirmKind("activate")}
            disabled={!canPublish || actionInFlight || form.enabled || readiness?.activatable !== true}
            title={!canPublish ? "Requiere el permiso de publicación." : undefined}
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <PlayCircle size={14} /> Activar
          </button>

          <button
            onClick={() => setConfirmKind("pause")}
            disabled={!canPublish || actionInFlight || !form.enabled}
            title={!canPublish ? "Requiere el permiso de publicación." : undefined}
            className="flex items-center gap-2 bg-red-50 text-red-700 border border-red-200 px-4 py-2 rounded-lg text-xs font-bold hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <PauseCircle size={14} /> Pausar
          </button>
        </div>
      </div>

      {/* Version history -- public UUID only, never an internal id */}
      <div className="border rounded-xl bg-white p-4">
        <h4 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
          <History size={16} className="text-indigo-600" /> Historial de versiones
        </h4>
        {versionsState === "loading" && <p className="text-xs text-gray-400 italic">Cargando historial...</p>}
        {versionsState === "forbidden" && <p className="text-xs text-red-600 font-semibold">No tienes permiso para ver el historial.</p>}
        {versionsState === "error" && (
          <div className="flex items-center gap-2">
            <p className="text-xs text-red-600 font-semibold">No se pudo cargar el historial.</p>
            <button onClick={loadVersions} className="text-xs font-bold text-indigo-600 hover:underline">Reintentar</button>
          </div>
        )}
        {versionsState === "success" && versions.length === 0 && (
          <p className="text-xs text-gray-400">Todavía no hay versiones.</p>
        )}
        {versionsState === "success" && versions.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-gray-400 uppercase font-bold border-b">
                <tr>
                  <th className="py-1.5 pr-3">Versión</th>
                  <th className="py-1.5 pr-3">Estado</th>
                  <th className="py-1.5 pr-3">Creada</th>
                  <th className="py-1.5 pr-3">Publicada</th>
                  <th className="py-1.5 pr-3">Publicada por</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {versions.map((v) => (
                  <tr key={v.uuid}>
                    <td className="py-1.5 pr-3 font-bold">v{v.version_number}</td>
                    <td className="py-1.5 pr-3">
                      <span className={`px-1.5 py-0.5 rounded-full font-bold border ${
                        v.status === "published" ? "bg-green-50 text-green-700 border-green-200"
                        : v.status === "draft" ? "bg-blue-50 text-blue-700 border-blue-200"
                        : "bg-gray-100 text-gray-500 border-gray-200"
                      }`}>
                        {v.status === "published" ? "Publicada" : v.status === "draft" ? "Borrador" : "Archivada"}
                      </span>
                    </td>
                    <td className="py-1.5 pr-3 text-gray-500">{v.created_at ? new Date(v.created_at).toLocaleString() : "—"}</td>
                    <td className="py-1.5 pr-3 text-gray-500">{v.published_at ? new Date(v.published_at).toLocaleString() : "—"}</td>
                    <td className="py-1.5 pr-3 text-gray-500">{v.published_by?.name ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delivery */}
      <div className="border rounded-xl bg-white p-4">
        <h4 className="text-sm font-bold text-gray-800 mb-3">Entrega al cliente</h4>
        {!isDeliverable ? (
          <p className="text-xs text-gray-400 italic">
            {form.enabled
              ? "Este formulario todavía no tiene una versión publicada -- publica un borrador para habilitar la entrega."
              : "Este formulario está pausado -- actívalo para habilitar la entrega."}
          </p>
        ) : !pageUrl ? (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2.5 flex items-start gap-2">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span>
              Hosted URL, snippet, QR y share link no están disponibles: el backend administrativo
              todavía no entrega la URL canónica de este formulario (<code className="font-mono">page_url</code>).
              Esta sección se habilitará automáticamente en cuanto ese campo esté disponible, sin
              cambios adicionales de este panel.
            </span>
          </p>
        ) : (
          <div className="space-y-4">
            <div>
              <span className="block text-xs font-bold text-gray-500 uppercase mb-1">Hosted URL</span>
              <div className="flex gap-2">
                <input readOnly value={pageUrl} className="flex-1 border rounded-lg px-3 py-2 text-sm font-mono bg-gray-50" />
                <CopyButton value={pageUrl} label="Copiar URL" />
              </div>
            </div>

            {embedSnippet && (
              <div>
                <span className="block text-xs font-bold text-gray-500 uppercase mb-1">Embed (iframe)</span>
                <div className="flex gap-2">
                  <pre className="flex-1 text-[11px] bg-gray-900 text-gray-100 rounded-lg px-3 py-2.5 overflow-x-auto font-mono">{embedSnippet}</pre>
                  <CopyButton value={embedSnippet} label="Copiar snippet" />
                </div>
              </div>
            )}

            {loaderSnippet && (
              <div>
                <span className="block text-xs font-bold text-gray-500 uppercase mb-1">Loader asíncrono</span>
                <div className="flex gap-2">
                  <pre className="flex-1 text-[11px] bg-gray-900 text-gray-100 rounded-lg px-3 py-2.5 overflow-x-auto font-mono">{loaderSnippet}</pre>
                  <CopyButton value={loaderSnippet} label="Copiar loader" />
                </div>
              </div>
            )}

            <div>
              <span className="block text-xs font-bold text-gray-500 uppercase mb-1">Share link</span>
              <div className="flex items-center gap-2">
                <Link2 size={14} className="text-gray-400" />
                <CopyButton value={pageUrl} label="Copiar share link" />
              </div>
            </div>

            <div>
              <span className="block text-xs font-bold text-gray-500 uppercase mb-2">Código QR</span>
              <QrCodeDisplay value={pageUrl} />
            </div>
          </div>
        )}
      </div>

      {confirmKind && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-sm p-6">
            <h2 className="text-xl font-bold mb-2 flex items-center gap-2">
              {confirmKind === "publish" && <><UploadCloud size={18} /> Publicar borrador</>}
              {confirmKind === "activate" && <><PlayCircle size={18} /> Activar formulario</>}
              {confirmKind === "pause" && <><PauseCircle size={18} /> Pausar formulario</>}
            </h2>
            <p className="text-sm text-gray-600 mb-6">
              {confirmKind === "publish" && "El borrador actual se convertirá en la nueva versión publicada. La versión publicada anterior, si existe, quedará archivada. ¿Confirmas la publicación?"}
              {confirmKind === "activate" && "El formulario empezará a aceptar envíos públicos con la última versión publicada. ¿Confirmas la activación?"}
              {confirmKind === "pause" && "El formulario dejará de aceptar envíos públicos hasta que vuelvas a activarlo. ¿Confirmas la pausa?"}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmKind(null)}
                disabled={actionInFlight}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-semibold text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={() => runAction(confirmKind)}
                disabled={actionInFlight}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold text-sm disabled:opacity-50 flex items-center gap-2"
              >
                {actionInFlight ? "Procesando..." : <><CheckCircle2 size={14} /> Confirmar</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PublishDeliveryPanel;
