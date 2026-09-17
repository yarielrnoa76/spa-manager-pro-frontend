import React, { useCallback, useEffect, useState } from "react";
import { FilePlus2, WifiOff } from "lucide-react";
import { api, ApiError } from "../../services/api";
import { PublicLeadFormBranding, PublicLeadFormField, PublicLeadFormReadiness } from "../../types";
import { getPublicLeadFormMutationErrorMessage, getCodeMessage } from "../../utils/publicLeadFormPresentation";
import FieldEditor from "./FieldEditor";
import BrandingPanel from "./BrandingPanel";

type LoadState = "loading" | "no_draft" | "success" | "forbidden" | "error";

/**
 * `/lead-forms/:id/campos` -- the ONLY tab that touches the draft (`GET`/`PATCH .../draft`).
 * Always editable regardless of the form's `enabled` state (editing an active form's draft never
 * changes the currently published version -- publishing is a separate, explicit action in the
 * Publicación tab). Combines the field editor (§7 of the contract) and the branding panel (§8) in
 * one screen because both persist to the SAME draft resource in a single PATCH; the contract's own
 * route table has no separate branding route.
 */
const DraftEditorTab: React.FC<{
  formId: number;
  canManage: boolean;
  readiness: PublicLeadFormReadiness | null;
  onDraftSaved: () => void;
}> = ({ formId, canManage, readiness, onDraftSaved }) => {
  const [state, setState] = useState<LoadState>("loading");
  const [schema, setSchema] = useState<PublicLeadFormField[]>([]);
  const [branding, setBranding] = useState<PublicLeadFormBranding | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setState("loading");
    setGeneralError(null);
    try {
      const draft = await api.getPublicLeadFormDraft(formId);
      setSchema(draft.schema);
      setBranding(draft.branding);
      setState("success");
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 403) {
        setState("forbidden");
      } else if (err instanceof ApiError && (err.status === 404 || err.code === "NO_DRAFT")) {
        setState("no_draft");
      } else {
        setState("error");
      }
    }
  }, [formId]);

  useEffect(() => {
    load();
  }, [load]);

  const createDraft = async () => {
    setSubmitting(true);
    setGeneralError(null);
    try {
      // Empty PATCH -- the backend lazily creates the draft from the current published version
      // (or its own platform default if none exists yet). Never duplicated client-side.
      await api.updatePublicLeadFormDraft(formId, {});
      await load();
      onDraftSaved();
    } catch (err: unknown) {
      setGeneralError(getPublicLeadFormMutationErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const save = async () => {
    if (!branding) return;
    setSubmitting(true);
    setGeneralError(null);
    setFieldErrors({});
    setSaved(false);
    try {
      await api.updatePublicLeadFormDraft(formId, { schema, branding });
      setSaved(true);
      await load();
      onDraftSaved();
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 422 && err.errors) {
        const mapped: Record<string, string> = {};
        Object.entries(err.errors).forEach(([field, messages]) => {
          if (messages[0]) mapped[field] = messages[0];
        });
        setFieldErrors(mapped);
      }
      setGeneralError(getPublicLeadFormMutationErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (state === "loading") {
    return <div className="p-12 text-center text-gray-500 animate-pulse font-bold">Cargando borrador...</div>;
  }

  if (state === "forbidden") {
    return <div className="p-12 text-center text-gray-500">No tienes permiso para gestionar el borrador de este formulario.</div>;
  }

  if (state === "error") {
    return (
      <div className="p-12 flex flex-col items-center justify-center gap-2 text-gray-500">
        <WifiOff size={32} className="text-gray-300" />
        <p className="font-bold text-gray-700">No se pudo cargar el borrador.</p>
        <button onClick={load} className="text-xs font-bold text-indigo-600 hover:underline">Reintentar</button>
      </div>
    );
  }

  if (state === "no_draft") {
    return (
      <div className="p-12 flex flex-col items-center justify-center gap-3 text-center text-gray-500">
        <FilePlus2 size={32} className="text-indigo-300" />
        <p className="font-bold text-gray-700">Este formulario todavía no tiene un borrador.</p>
        {canManage ? (
          <button
            onClick={createDraft}
            disabled={submitting}
            className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg font-bold text-sm hover:bg-indigo-700 disabled:opacity-50"
          >
            {submitting ? "Creando..." : "Crear borrador"}
          </button>
        ) : (
          <p className="text-xs text-gray-400">Se requiere el permiso de gestión para crear uno.</p>
        )}
        {generalError && <p className="text-xs text-red-600 font-semibold">{generalError}</p>}
      </div>
    );
  }

  if (!branding) return null;

  return (
    <div className="space-y-6">
      {generalError && (
        <div role="alert" className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm font-semibold">
          {generalError}
        </div>
      )}
      {saved && !generalError && (
        <div role="status" className="p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm font-semibold">
          Borrador guardado. Los cambios no afectan la versión publicada hasta que publiques este borrador.
        </div>
      )}
      {readiness?.draft_blocking_condition && (
        <p data-testid="draft-editor-blocking-message" className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
          {getCodeMessage(readiness.draft_blocking_condition.code, readiness.draft_blocking_condition.message)}
        </p>
      )}

      <div>
        <h4 className="text-sm font-bold text-gray-800 mb-3">Campos del formulario</h4>
        <FieldEditor
          fields={schema}
          onChange={setSchema}
          fieldErrors={fieldErrors}
          disabled={!canManage || submitting}
        />
      </div>

      <div>
        <h4 className="text-sm font-bold text-gray-800 mb-3">Marca (branding)</h4>
        <BrandingPanel
          branding={branding}
          onChange={setBranding}
          fieldErrors={fieldErrors}
          disabled={!canManage || submitting}
        />
      </div>

      {canManage && (
        <button
          onClick={save}
          disabled={submitting}
          className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg font-bold shadow-md hover:bg-indigo-700 disabled:opacity-50 text-sm"
        >
          {submitting ? "Guardando..." : "Guardar borrador"}
        </button>
      )}
    </div>
  );
};

export default DraftEditorTab;
