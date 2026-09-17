import React, { useCallback, useEffect, useState } from "react";
import { Monitor, Smartphone, RefreshCw, WifiOff } from "lucide-react";
import { api, ApiError } from "../../services/api";
import { PublicLeadFormPreviewDescriptor } from "../../types";

type LoadState = "loading" | "success" | "empty" | "forbidden" | "error";
type Viewport = "desktop" | "mobile";

const RADIUS_PX: Record<string, string> = { square: "0px", rounded: "10px", pill: "9999px" };

/**
 * Administrative preview of the CURRENT draft -- `GET /draft/preview`, rendered directly by
 * React from the sanitized descriptor the backend returns (no internal ids, no tenant data, no
 * Turnstile secret). Deliberately NEVER an `<iframe>`, never mounts a real Turnstile widget, and
 * never performs a submission -- this is a read-only rendering of `schema`/`branding` exactly as
 * the backend will serve the published version once the draft is published.
 */
const PreviewPane: React.FC<{ formId: number }> = ({ formId }) => {
  const [state, setState] = useState<LoadState>("loading");
  const [descriptor, setDescriptor] = useState<PublicLeadFormPreviewDescriptor | null>(null);
  const [viewport, setViewport] = useState<Viewport>("desktop");

  const load = useCallback(async () => {
    setState("loading");
    try {
      const data = await api.getPublicLeadFormDraftPreview(formId);
      setDescriptor(data);
      setState("success");
    } catch (err: unknown) {
      setDescriptor(null);
      if (err instanceof ApiError && err.status === 403) {
        setState("forbidden");
      } else if (err instanceof ApiError && (err.status === 404 || err.code === "NO_DRAFT")) {
        setState("empty");
      } else {
        setState("error");
      }
    }
  }, [formId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div role="tablist" aria-label="Viewport de la vista previa" className="flex gap-1 bg-gray-100 rounded-lg p-1">
          <button
            type="button"
            role="tab"
            aria-selected={viewport === "desktop"}
            onClick={() => setViewport("desktop")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition ${viewport === "desktop" ? "bg-white shadow text-indigo-700" : "text-gray-500"}`}
          >
            <Monitor size={14} /> Escritorio
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={viewport === "mobile"}
            onClick={() => setViewport("mobile")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition ${viewport === "mobile" ? "bg-white shadow text-indigo-700" : "text-gray-500"}`}
          >
            <Smartphone size={14} /> Móvil
          </button>
        </div>
        <button onClick={load} className="flex items-center gap-1 text-xs font-bold text-indigo-600 hover:underline">
          <RefreshCw size={12} /> Refrescar
        </button>
      </div>

      {state === "loading" && <div className="p-12 text-center text-gray-500 animate-pulse font-bold">Cargando vista previa...</div>}

      {state === "forbidden" && (
        <div className="p-12 text-center text-gray-500">No tienes permiso para ver la vista previa.</div>
      )}

      {state === "empty" && (
        <div className="p-12 text-center text-gray-400">
          Este formulario todavía no tiene un borrador. Edita sus campos en la pestaña "Campos" para generar uno.
        </div>
      )}

      {state === "error" && (
        <div className="p-12 flex flex-col items-center justify-center gap-2 text-gray-500">
          <WifiOff size={32} className="text-gray-300" />
          <p className="font-bold text-gray-700">No se pudo cargar la vista previa.</p>
          <button onClick={load} className="text-xs font-bold text-indigo-600 hover:underline">Reintentar</button>
        </div>
      )}

      {state === "success" && descriptor && (
        <div className="flex justify-center bg-gray-50 border rounded-xl p-6">
          <div
            data-testid="preview-frame"
            className={viewport === "mobile" ? "w-[360px]" : "w-full max-w-lg"}
          >
            <div
              className="bg-white border shadow-sm p-6 space-y-4"
              style={{
                borderRadius: RADIUS_PX[descriptor.branding.border_radius_style] ?? "10px",
                borderTop: `4px solid ${descriptor.branding.primary_color}`,
              }}
            >
              {descriptor.branding.logo_url && (
                <img src={descriptor.branding.logo_url} alt="Logo" className="h-10 object-contain" />
              )}
              <div>
                <h3 className="text-lg font-bold text-gray-900">{descriptor.branding.title}</h3>
                {descriptor.branding.subtitle && (
                  <p className="text-sm text-gray-500 mt-0.5">{descriptor.branding.subtitle}</p>
                )}
              </div>

              <div className="space-y-3">
                {descriptor.schema.map((field) => (
                  <div key={field.field_key}>
                    <label className="block text-xs font-bold text-gray-600 mb-1">
                      {field.label}
                      {field.required && <span className="text-red-500"> *</span>}
                    </label>
                    {field.field_key === "message" ? (
                      <textarea
                        disabled
                        placeholder={field.placeholder ?? undefined}
                        rows={3}
                        className="w-full border rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-400"
                      />
                    ) : field.field_key === "consent" ? (
                      <label className="flex items-start gap-2 text-xs text-gray-500">
                        <input type="checkbox" disabled className="mt-0.5" />
                        <span>
                          {field.label}
                          {field.help_text && <span className="block text-gray-400">{field.help_text}</span>}
                        </span>
                      </label>
                    ) : (
                      <input
                        disabled
                        placeholder={field.placeholder ?? undefined}
                        className="w-full border rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-400"
                      />
                    )}
                    {field.help_text && field.field_key !== "consent" && (
                      <p className="text-[11px] text-gray-400 mt-0.5">{field.help_text}</p>
                    )}
                  </div>
                ))}
              </div>

              <button
                type="button"
                disabled
                className="w-full py-2.5 text-sm font-bold text-white"
                style={{
                  backgroundColor: descriptor.branding.primary_color,
                  borderRadius: RADIUS_PX[descriptor.branding.border_radius_style] ?? "10px",
                }}
              >
                {descriptor.branding.button_text}
              </button>

              {descriptor.branding.privacy_notice_text && (
                <p className="text-[11px] text-gray-400">{descriptor.branding.privacy_notice_text}</p>
              )}

              <p className="text-[11px] text-gray-300 italic text-center">
                Vista previa administrativa -- sin verificación de Turnstile y sin envío real.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PreviewPane;
