import React from "react";
import { ChevronUp, ChevronDown, Lock } from "lucide-react";
import { PublicLeadFormField, PUBLIC_LEAD_FORM_SYSTEM_FIELD_KEYS } from "../../types";

const FIELD_LABELS: Record<string, string> = {
  name: "Nombre",
  consent: "Consentimiento",
  last_name: "Apellido",
  phone: "Teléfono",
  email: "Correo electrónico",
  message: "Mensaje",
};

function isSystemField(fieldKey: string): boolean {
  return (PUBLIC_LEAD_FORM_SYSTEM_FIELD_KEYS as readonly string[]).includes(fieldKey);
}

function sortedByPosition(fields: PublicLeadFormField[]): PublicLeadFormField[] {
  return [...fields].sort((a, b) => a.position - b.position);
}

/**
 * Editor for the 6 canonical fields (`CanonicalFieldRules::ALLOWED_FIELD_KEYS`) -- no custom
 * field types exist in B3. `name`/`consent` are structurally locked (backend rejects any attempt
 * to hide or un-require them with `SYSTEM_FIELD_LOCKED`) and rendered read-only here to match:
 * their visibility/required toggles are never interactive. The backend is the final authority on
 * every rule (contact method, positions, text length/characters) -- `fieldErrors` surfaces its
 * own 422 messages per field; this component never silently overrides what it reports.
 */
const FieldEditor: React.FC<{
  fields: PublicLeadFormField[];
  onChange: (fields: PublicLeadFormField[]) => void;
  fieldErrors?: Record<string, string>;
  contactMethodError?: string | null;
  disabled?: boolean;
}> = ({ fields, onChange, fieldErrors = {}, contactMethodError = null, disabled = false }) => {
  const ordered = sortedByPosition(fields);

  const updateField = (fieldKey: string, patch: Partial<PublicLeadFormField>) => {
    onChange(fields.map((f) => (f.field_key === fieldKey ? { ...f, ...patch } : f)));
  };

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= ordered.length) return;

    const a = ordered[index];
    const b = ordered[target];
    onChange(
      fields.map((f) => {
        if (f.field_key === a.field_key) return { ...f, position: b.position };
        if (f.field_key === b.field_key) return { ...f, position: a.position };
        return f;
      }),
    );
  };

  return (
    <div className="space-y-3">
      {contactMethodError && (
        <p role="alert" className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
          {contactMethodError}
        </p>
      )}

      {ordered.map((field, index) => {
        const locked = isSystemField(field.field_key);
        const labelError = fieldErrors[`schema.${index}.label`];
        const helpError = fieldErrors[`schema.${index}.help_text`];
        const placeholderError = fieldErrors[`schema.${index}.placeholder`];

        return (
          <div
            key={field.field_key}
            data-testid={`field-row-${field.field_key}`}
            className="border rounded-xl bg-white p-4 space-y-3"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="flex flex-col">
                  <button
                    type="button"
                    aria-label={`Mover ${FIELD_LABELS[field.field_key] ?? field.field_key} hacia arriba`}
                    disabled={disabled || index === 0}
                    onClick={() => move(index, -1)}
                    className="p-0.5 text-gray-400 hover:text-indigo-600 disabled:opacity-30 disabled:hover:text-gray-400"
                  >
                    <ChevronUp size={14} />
                  </button>
                  <button
                    type="button"
                    aria-label={`Mover ${FIELD_LABELS[field.field_key] ?? field.field_key} hacia abajo`}
                    disabled={disabled || index === ordered.length - 1}
                    onClick={() => move(index, 1)}
                    className="p-0.5 text-gray-400 hover:text-indigo-600 disabled:opacity-30 disabled:hover:text-gray-400"
                  >
                    <ChevronDown size={14} />
                  </button>
                </div>
                <span className="text-sm font-bold text-gray-800">
                  {FIELD_LABELS[field.field_key] ?? field.field_key}
                </span>
                {locked && (
                  <span className="flex items-center gap-1 text-[10px] font-bold uppercase text-gray-400" title="Campo del sistema: siempre visible y obligatorio.">
                    <Lock size={11} /> Fijo
                  </span>
                )}
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-600">
                  <input
                    type="checkbox"
                    checked={field.visible}
                    disabled={disabled || locked}
                    onChange={(e) => updateField(field.field_key, { visible: e.target.checked })}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-400"
                  />
                  Visible
                </label>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-600">
                  <input
                    type="checkbox"
                    checked={field.required}
                    disabled={disabled || locked}
                    onChange={(e) => updateField(field.field_key, { required: e.target.checked })}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-400"
                  />
                  Obligatorio
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Etiqueta</label>
                <input
                  type="text"
                  value={field.label}
                  disabled={disabled}
                  maxLength={field.field_key === "consent" ? 120 : 60}
                  onChange={(e) => updateField(field.field_key, { label: e.target.value })}
                  className="w-full border rounded-lg px-2.5 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500"
                />
                {labelError && <p className="mt-1 text-xs text-red-600 font-semibold">{labelError}</p>}
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Texto de ayuda</label>
                <input
                  type="text"
                  value={field.help_text ?? ""}
                  disabled={disabled}
                  maxLength={200}
                  onChange={(e) => updateField(field.field_key, { help_text: e.target.value || null })}
                  className="w-full border rounded-lg px-2.5 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500"
                />
                {helpError && <p className="mt-1 text-xs text-red-600 font-semibold">{helpError}</p>}
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Placeholder</label>
                <input
                  type="text"
                  value={field.placeholder ?? ""}
                  disabled={disabled}
                  maxLength={60}
                  onChange={(e) => updateField(field.field_key, { placeholder: e.target.value || null })}
                  className="w-full border rounded-lg px-2.5 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500"
                />
                {placeholderError && <p className="mt-1 text-xs text-red-600 font-semibold">{placeholderError}</p>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default FieldEditor;
