import React from "react";
import { CheckCircle, Copy, RefreshCw } from "lucide-react";

/**
 * Shared, purely-visual field components used by both CreateTenantModal (creation-only) and
 * TenantFormModal (edition-only). Neither component here knows about create-vs-edit, payload
 * construction, or API calls — they only render a labeled control and forward onChange/error.
 */

export const SectionHeader: React.FC<{ icon: React.ElementType; title: string }> = ({ icon: Icon, title }) => (
  <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2 pb-2 border-b border-gray-100">
    <Icon size={16} className="text-indigo-600" /> {title}
  </h3>
);

export const TextField: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  required?: boolean;
  type?: string;
  placeholder?: string;
  maxLength?: number;
  disabled?: boolean;
}> = ({ label, value, onChange, error, required, type = "text", placeholder, maxLength, disabled }) => (
  <div>
    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
      {label}
      {required && " *"}
    </label>
    <input
      type={type}
      value={value}
      required={required}
      maxLength={maxLength}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-indigo-400 focus:outline-none text-sm disabled:bg-gray-100 disabled:text-gray-400 ${
        error ? "border-red-400" : "border-gray-300"
      }`}
    />
    {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
  </div>
);

export const SelectField: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  required?: boolean;
  error?: string;
}> = ({ label, value, onChange, options, required, error }) => (
  <div>
    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
      {label}
      {required && " *"}
    </label>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-indigo-400 focus:outline-none text-sm bg-white ${
        error ? "border-red-400" : "border-gray-300"
      }`}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
    {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
  </div>
);

/**
 * Masked-secret input (tenant_api_token / n8n_api_key / chatwoot_api_token). Shows
 * "••••••••" when a secret is already configured; typing over it prompts a confirmation,
 * then CLEARS the field to an empty string so the user types the replacement from scratch.
 *
 * Bug fixed here (previously in TenantFormModal.tsx): the old handler passed
 * `e.target.value` straight through on the very keystroke that triggered the confirmation.
 * Because the input was still showing the mask at that instant, the DOM's actual value was
 * the 8-bullet mask PLUS whatever the user just typed (e.g. "••••••••X") — that corrupted
 * string became the new state and was submitted as the "real" credential, silently saving a
 * broken token that still *looked* configured (masked) on every later read. Clearing to ""
 * on confirmation, instead of forwarding the contaminated event value, removes the mask
 * entirely before the user's own keystrokes build up the real replacement value.
 */
export const MaskedInput: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  copyValue?: string;
  isPassword?: boolean;
}> = ({ label, value, onChange, placeholder, copyValue, isPassword }) => (
  <div>
    <label className="block text-xs font-bold text-gray-500 uppercase mb-1 flex items-center justify-between">
      <span>{label}</span>
      {value === "••••••••" && (
        <span className="flex items-center gap-1 text-[10px] text-emerald-600 font-medium normal-case">
          <CheckCircle size={10} /> Configurado
        </span>
      )}
    </label>
    <div className="relative">
      <input
        type={isPassword ? "password" : "text"}
        value={value}
        onChange={(e) => {
          if (value === "••••••••") {
            if (!confirm("Este campo ya tiene una clave guardada. ¿Deseas reemplazarla?")) return;
            onChange("");
            return;
          }
          onChange(e.target.value);
        }}
        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-400 focus:outline-none text-sm ${
          value === "••••••••" ? "bg-emerald-50/30 border-emerald-100 text-emerald-700 font-mono" : "border-gray-300"
        }`}
        placeholder={placeholder}
      />
      {value === "••••••••" && (
        <div className="absolute right-2 top-1.5 flex items-center gap-1">
          {copyValue && (
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(copyValue);
                alert("Copiado");
              }}
              className="p-1 text-gray-400 hover:text-indigo-500 rounded transition-colors"
              title="Copiar"
            >
              <Copy size={16} />
            </button>
          )}
          <button
            type="button"
            onClick={() => onChange("")}
            className="p-1 text-gray-400 hover:text-rose-500 rounded transition-colors"
            title="Limpiar"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      )}
    </div>
  </div>
);
