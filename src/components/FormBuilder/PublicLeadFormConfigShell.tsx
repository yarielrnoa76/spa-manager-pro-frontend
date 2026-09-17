import React, { useCallback, useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, FileText, ShieldAlert, WifiOff } from "lucide-react";
import { api, ApiError } from "../../services/api";
import { PublicLeadForm, PublicLeadFormReadiness } from "../../types";
import { getPublicLeadFormEnabledLabel } from "../../utils/publicLeadFormPresentation";
import Tabs from "../shared/Tabs";
import GeneralTab from "./GeneralTab";
import DraftEditorTab from "./DraftEditorTab";
import PreviewPane from "./PreviewPane";
import PublishDeliveryPanel from "./PublishDeliveryPanel";

type FormLoadState = "loading" | "success" | "forbidden" | "notfound" | "error";
// Readiness never has a "not found" outcome of its own (the form load already handles that) --
// kept as its own narrower type so it lines up exactly with PublishDeliveryPanel's own
// `readinessState` prop type instead of a same-named-but-different-shape `LoadState`.
type ReadinessLoadState = "loading" | "success" | "forbidden" | "error";

const TAB_ITEMS = [
  { key: "general", label: "General" },
  { key: "campos", label: "Campos" },
  { key: "preview", label: "Preview" },
  { key: "publicacion", label: "Publicación" },
];

/**
 * `/lead-forms/:id/*` -- the "Configuración" shell for one form. Real child routes (not local
 * tab state) so deep-links and the browser Back button both work, per the contract's routing
 * table (§12). Owns the form + readiness fetch and passes down refresh callbacks so every child
 * tab always re-reads the canonical backend state after a mutation instead of updating anything
 * optimistically.
 */
const PublicLeadFormConfigShell: React.FC<{
  formId: number;
  canManage: boolean;
  canPublish: boolean;
  onBack: () => void;
}> = ({ formId, canManage, canPublish, onBack }) => {
  const location = useLocation();
  const navigate = useNavigate();

  const [form, setForm] = useState<PublicLeadForm | null>(null);
  const [formState, setFormState] = useState<FormLoadState>("loading");
  const [readiness, setReadiness] = useState<PublicLeadFormReadiness | null>(null);
  const [readinessState, setReadinessState] = useState<ReadinessLoadState>("loading");

  const loadForm = useCallback(async () => {
    setFormState("loading");
    try {
      const data = await api.getPublicLeadForm(formId);
      setForm(data);
      setFormState("success");
    } catch (err: unknown) {
      setForm(null);
      if (err instanceof ApiError && err.status === 403) setFormState("forbidden");
      else if (err instanceof ApiError && err.status === 404) setFormState("notfound");
      else setFormState("error");
    }
  }, [formId]);

  const loadReadiness = useCallback(async () => {
    setReadinessState("loading");
    try {
      const data = await api.getPublicLeadFormReadiness(formId);
      setReadiness(data);
      setReadinessState("success");
    } catch (err: unknown) {
      setReadiness(null);
      setReadinessState(err instanceof ApiError && err.status === 403 ? "forbidden" : "error");
    }
  }, [formId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadForm();
    loadReadiness();
  }, [loadForm, loadReadiness]);

  const activeTab = TAB_ITEMS.find((t) => location.pathname.endsWith(`/${t.key}`))?.key ?? "general";

  if (formState === "loading") {
    return <div className="p-12 text-center text-gray-500 animate-pulse font-bold">Cargando formulario...</div>;
  }

  if (formState === "forbidden") {
    return (
      <div className="p-12 flex flex-col items-center justify-center gap-3 text-center text-gray-500">
        <ShieldAlert size={36} className="text-red-300" />
        <p className="font-bold text-gray-700">No tienes permiso para ver este formulario.</p>
        <button onClick={onBack} className="text-xs font-bold text-indigo-600 hover:underline">Volver al listado</button>
      </div>
    );
  }

  if (formState === "notfound") {
    return (
      <div className="p-12 flex flex-col items-center justify-center gap-3 text-center text-gray-500">
        <p className="font-bold text-gray-700">Este formulario no existe o ya no está disponible.</p>
        <button onClick={onBack} className="text-xs font-bold text-indigo-600 hover:underline">Volver al listado</button>
      </div>
    );
  }

  if (formState === "error" || !form) {
    return (
      <div className="p-12 flex flex-col items-center justify-center gap-2 text-gray-500">
        <WifiOff size={32} className="text-gray-300" />
        <p className="font-bold text-gray-700">No se pudo cargar el formulario.</p>
        <button onClick={loadForm} className="text-xs font-bold text-indigo-600 hover:underline">Reintentar</button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <button onClick={onBack} className="flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-indigo-600 mb-1">
            <ArrowLeft size={14} /> Volver al listado
          </button>
          <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
            <FileText size={20} className="text-indigo-600" /> {form.name}
          </h3>
        </div>
        <span
          className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
            form.enabled ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-100 text-gray-600 border-gray-200"
          }`}
        >
          {getPublicLeadFormEnabledLabel(form.enabled)}
        </span>
      </div>

      <Tabs
        items={TAB_ITEMS}
        activeKey={activeTab}
        // Deliberately absolute, never a bare relative segment: this component both renders
        // `<Routes>` for these same child paths AND calls `navigate()` from its own top-level
        // scope (not from within one of those matched children) -- with a `:id/*` parent route,
        // React Router resolves a relative target against the CURRENT PATHNAME (splat included),
        // not against the route pattern, so `navigate("campos")` from "/lead-forms/1/general"
        // silently produces "/lead-forms/1/general/campos" instead of replacing the last segment
        // (verified directly against the installed react-router-dom version; `{ relative:
        // "route" }` and a leading "../" both reproduce the same drift). An absolute path is the
        // only resolution that isn't sensitive to the current splat value.
        onChange={(key) => navigate(`/lead-forms/${formId}/${key}`)}
        ariaLabel="Configuración del formulario"
      />

      <div className="bg-white border rounded-xl shadow-sm p-5">
        <Routes>
          <Route index element={<Navigate to="general" replace />} />
          <Route
            path="general"
            element={<GeneralTab form={form} canManage={canManage} onSaved={loadForm} />}
          />
          <Route
            path="campos"
            element={
              <DraftEditorTab
                formId={formId}
                canManage={canManage}
                readiness={readiness}
                onDraftSaved={loadReadiness}
              />
            }
          />
          <Route path="preview" element={<PreviewPane formId={formId} />} />
          <Route
            path="publicacion"
            element={
              <PublishDeliveryPanel
                formId={formId}
                form={form}
                readiness={readiness}
                readinessState={readinessState}
                onRefreshReadiness={loadReadiness}
                onFormMutated={loadForm}
                canPublish={canPublish}
              />
            }
          />
          <Route path="*" element={<Navigate to="general" replace />} />
        </Routes>
      </div>
    </div>
  );
};

export default PublicLeadFormConfigShell;
