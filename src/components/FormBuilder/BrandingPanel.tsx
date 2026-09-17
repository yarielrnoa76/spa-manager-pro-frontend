import React from "react";
import { PublicLeadFormBranding } from "../../types";

const RADIUS_OPTIONS: Array<{ value: NonNullable<PublicLeadFormBranding["border_radius_style"]>; label: string }> = [
  { value: "square", label: "Cuadrado" },
  { value: "rounded", label: "Redondeado" },
  { value: "pill", label: "Píldora" },
];

const RADIUS_PX: Record<string, string> = { square: "0px", rounded: "10px", pill: "9999px" };

const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;

/**
 * Only the branding properties the schema authorizes (`PatchPublicLeadFormDraftRequest::
 * ALLOWED_BRANDING_KEYS`) -- no `custom_css`, no free-form styling. `show_logo` is a boolean
 * toggle only: this panel never uploads a file, never accepts a logo URL, and never persists a
 * `logo_asset_ref` -- the actual `logo_url` shown in the preview is resolved server-side from
 * `tenant_settings.logo_path`, entirely outside this component's control.
 */
const BrandingPanel: React.FC<{
  branding: PublicLeadFormBranding;
  onChange: (branding: PublicLeadFormBranding) => void;
  fieldErrors?: Record<string, string>;
  disabled?: boolean;
}> = ({ branding, onChange, fieldErrors = {}, disabled = false }) => {
  const set = <K extends keyof PublicLeadFormBranding>(key: K, value: PublicLeadFormBranding[K]) => {
    onChange({ ...branding, [key]: value });
  };

  const colorValid = !branding.primary_color || HEX_COLOR_PATTERN.test(branding.primary_color);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Título</label>
          <input
            type="text"
            value={branding.title ?? ""}
            disabled={disabled}
            maxLength={120}
            onChange={(e) => set("title", e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
          />
          {fieldErrors["branding.title"] && <p className="mt-1 text-xs text-red-600 font-semibold">{fieldErrors["branding.title"]}</p>}
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Subtítulo</label>
          <input
            type="text"
            value={branding.subtitle ?? ""}
            disabled={disabled}
            maxLength={200}
            onChange={(e) => set("subtitle", e.target.value || null)}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Texto del botón</label>
          <input
            type="text"
            value={branding.button_text ?? ""}
            disabled={disabled}
            maxLength={40}
            onChange={(e) => set("button_text", e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Mensaje de éxito</label>
          <input
            type="text"
            value={branding.success_text ?? ""}
            disabled={disabled}
            maxLength={300}
            onChange={(e) => set("success_text", e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Aviso de privacidad</label>
          <textarea
            value={branding.privacy_notice_text ?? ""}
            disabled={disabled}
            maxLength={500}
            onChange={(e) => set("privacy_notice_text", e.target.value || null)}
            rows={2}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="branding-primary-color" className="block text-xs font-bold text-gray-600 uppercase mb-1">Color primario</label>
            <div className="flex gap-2">
              <input
                id="branding-primary-color"
                type="color"
                value={colorValid && branding.primary_color ? branding.primary_color : "#2F5C8A"}
                disabled={disabled}
                onChange={(e) => set("primary_color", e.target.value)}
                className="h-9 w-10 border rounded cursor-pointer disabled:cursor-not-allowed"
              />
              <input
                type="text"
                value={branding.primary_color ?? ""}
                disabled={disabled}
                onChange={(e) => set("primary_color", e.target.value)}
                placeholder="#2F5C8A"
                className="flex-1 border rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            {!colorValid && <p className="mt-1 text-xs text-red-600 font-semibold">Debe ser un color hexadecimal (#RRGGBB).</p>}
            {fieldErrors["branding.primary_color"] && <p className="mt-1 text-xs text-red-600 font-semibold">{fieldErrors["branding.primary_color"]}</p>}
          </div>

          <div>
            <label htmlFor="branding-radius" className="block text-xs font-bold text-gray-600 uppercase mb-1">Estilo de bordes</label>
            <select
              id="branding-radius"
              value={branding.border_radius_style ?? "rounded"}
              disabled={disabled}
              onChange={(e) => set("border_radius_style", e.target.value as PublicLeadFormBranding["border_radius_style"])}
              className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-indigo-500"
            >
              {RADIUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 cursor-pointer">
          <input
            type="checkbox"
            checked={branding.show_logo}
            disabled={disabled}
            onChange={(e) => set("show_logo", e.target.checked)}
            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-400"
          />
          Mostrar el logo del tenant
        </label>
        <p className="text-xs text-gray-400 -mt-2">
          El logo se toma del configurado para tu tenant; este panel no permite subir uno nuevo ni pegar una URL.
        </p>
      </div>

      <div className="flex flex-col items-center justify-center bg-gray-50 border rounded-xl p-6">
        <p className="text-xs font-bold text-gray-500 uppercase mb-3 self-start">Vista previa rápida</p>
        <div
          className="w-full max-w-xs bg-white border shadow-sm p-5 space-y-3"
          style={{
            borderRadius: RADIUS_PX[branding.border_radius_style ?? "rounded"],
            borderTop: `4px solid ${colorValid && branding.primary_color ? branding.primary_color : "#2F5C8A"}`,
          }}
        >
          <h4 className="font-bold text-gray-900 text-sm">{branding.title || "Título del formulario"}</h4>
          {branding.subtitle && <p className="text-xs text-gray-500">{branding.subtitle}</p>}
          <button
            type="button"
            disabled
            className="w-full py-2 text-xs font-bold text-white"
            style={{
              backgroundColor: colorValid && branding.primary_color ? branding.primary_color : "#2F5C8A",
              borderRadius: RADIUS_PX[branding.border_radius_style ?? "rounded"],
            }}
          >
            {branding.button_text || "Enviar"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BrandingPanel;
