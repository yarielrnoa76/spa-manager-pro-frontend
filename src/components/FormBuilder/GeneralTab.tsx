import React, { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { api, ApiError } from "../../services/api";
import { PublicLeadForm } from "../../types";
import {
  isValidAllowedOrigin,
  isValidEmbedOrigin,
  findDuplicateAllowedOriginIndex,
  getPublicLeadFormMutationErrorMessage,
} from "../../utils/publicLeadFormPresentation";

const ORIGIN_FORMAT_ERROR = "Este origen no es válido: usa exactamente esquema://host[:puerto].";
const EMBED_ORIGIN_FORMAT_ERROR = "Este origen no es válido, o contiene un comodín (*), que no está permitido.";

function OriginListEditor({
  title,
  help,
  origins,
  setOrigins,
  errors,
  disabled,
}: {
  title: string;
  help: string;
  origins: string[];
  setOrigins: (next: string[]) => void;
  errors: Record<number, string>;
  disabled: boolean;
}) {
  const update = (index: number, value: string) => setOrigins(origins.map((o, i) => (i === index ? value : o)));
  const add = () => setOrigins([...origins, ""]);
  const remove = (index: number) => setOrigins(origins.length > 1 ? origins.filter((_, i) => i !== index) : origins);

  return (
    <div>
      <span className="block text-sm font-bold text-gray-700 mb-1">{title}</span>
      <p className="text-xs text-gray-400 mb-2">{help}</p>
      <div className="space-y-2">
        {origins.map((origin, index) => (
          <div key={index}>
            <div className="flex gap-2">
              <input
                aria-label={`${title} ${index + 1}`}
                type="text"
                value={origin}
                disabled={disabled}
                onChange={(e) => update(index, e.target.value)}
                placeholder="https://ejemplo.com"
                className="flex-1 border rounded-lg p-2.5 text-sm font-mono focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={() => remove(index)}
                disabled={disabled || origins.length <= 1}
                aria-label={`Eliminar ${title.toLowerCase()} ${index + 1}`}
                className="px-3 rounded-lg border text-gray-400 hover:text-red-600 hover:border-red-300 disabled:opacity-40"
              >
                <Trash2 size={16} />
              </button>
            </div>
            {errors[index] && <p className="mt-1 text-xs text-red-600 font-semibold">{errors[index]}</p>}
          </div>
        ))}
      </div>
      <button type="button" onClick={add} disabled={disabled} className="mt-2 flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:underline disabled:opacity-50">
        <Plus size={14} /> Agregar origen
      </button>
    </div>
  );
}

/**
 * `/lead-forms/:id/general` -- name, branch (read-only, immutable after creation), and the two
 * DISTINCT origin lists: `allowed_origins` (governs public submission / page_url validation) and
 * `embed_origins` (governs ONLY the hosted page's `frame-ancestors`, never mixed with the other).
 * Still requires the form to be paused server-side (409 `PUBLIC_LEAD_FORM_MUST_BE_PAUSED`) --
 * unlike the draft, which the "Campos" tab can always edit regardless of enabled state.
 */
const GeneralTab: React.FC<{
  form: PublicLeadForm;
  canManage: boolean;
  onSaved: () => void;
}> = ({ form, canManage, onSaved }) => {
  const [name, setName] = useState(form.name);
  const [allowedOrigins, setAllowedOrigins] = useState<string[]>(form.allowed_origins.length > 0 ? form.allowed_origins : [""]);
  const [embedOrigins, setEmbedOrigins] = useState<string[]>(form.embed_origins.length > 0 ? form.embed_origins : [""]);
  const [nameError, setNameError] = useState<string | null>(null);
  const [allowedErrors, setAllowedErrors] = useState<Record<number, string>>({});
  const [embedErrors, setEmbedErrors] = useState<Record<number, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setName(form.name);
    setAllowedOrigins(form.allowed_origins.length > 0 ? [...form.allowed_origins] : [""]);
    setEmbedOrigins(form.embed_origins.length > 0 ? [...form.embed_origins] : [""]);
    setNameError(null);
    setAllowedErrors({});
    setEmbedErrors({});
    setGeneralError(null);
    setSaved(false);
  }, [form]);

  const validate = (): boolean => {
    let ok = true;
    setSaved(false);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setNameError("El nombre es obligatorio.");
      ok = false;
    } else {
      setNameError(null);
    }

    const trimmedAllowed = allowedOrigins.map((o) => o.trim());
    const aErrors: Record<number, string> = {};
    trimmedAllowed.forEach((o, i) => {
      if (o !== "" && !isValidAllowedOrigin(o)) aErrors[i] = ORIGIN_FORMAT_ERROR;
    });
    const dupAllowed = findDuplicateAllowedOriginIndex(trimmedAllowed);
    if (dupAllowed !== null) aErrors[dupAllowed] = "Este origen ya fue agregado.";
    if (trimmedAllowed.filter((o) => o !== "").length === 0) aErrors[0] = "Agrega al menos un origen permitido.";
    if (Object.keys(aErrors).length > 0) ok = false;
    setAllowedErrors(aErrors);

    const trimmedEmbed = embedOrigins.map((o) => o.trim()).filter((o) => o !== "");
    const eErrors: Record<number, string> = {};
    embedOrigins.forEach((raw, i) => {
      const o = raw.trim();
      if (o !== "" && !isValidEmbedOrigin(o)) eErrors[i] = EMBED_ORIGIN_FORMAT_ERROR;
    });
    const dupEmbed = findDuplicateAllowedOriginIndex(trimmedEmbed);
    if (dupEmbed !== null) {
      const originalIndex = embedOrigins.findIndex((o) => o.trim() === trimmedEmbed[dupEmbed]);
      if (originalIndex >= 0) eErrors[originalIndex] = "Este origen ya fue agregado.";
    }
    if (Object.keys(eErrors).length > 0) ok = false;
    setEmbedErrors(eErrors);

    return ok;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);
    if (!validate()) return;

    setSubmitting(true);
    try {
      await api.updatePublicLeadForm(form.id, {
        name: name.trim(),
        allowed_origins: allowedOrigins.map((o) => o.trim()).filter((o) => o !== ""),
        embed_origins: embedOrigins.map((o) => o.trim()).filter((o) => o !== ""),
      });
      setSaved(true);
      onSaved();
    } catch (err: unknown) {
      let mappedToField = false;
      if (err instanceof ApiError && err.status === 422 && err.errors) {
        const nextAllowed: Record<number, string> = {};
        const nextEmbed: Record<number, string> = {};
        Object.entries(err.errors).forEach(([field, messages]) => {
          const allowedMatch = field.match(/^allowed_origins\.(\d+)$/);
          const embedMatch = field.match(/^embed_origins\.(\d+)$/);
          if (allowedMatch && messages[0]) {
            nextAllowed[Number(allowedMatch[1])] = messages[0];
            mappedToField = true;
          }
          if (embedMatch && messages[0]) {
            nextEmbed[Number(embedMatch[1])] = messages[0];
            mappedToField = true;
          }
        });
        if (Object.keys(nextAllowed).length > 0) setAllowedErrors((prev) => ({ ...prev, ...nextAllowed }));
        if (Object.keys(nextEmbed).length > 0) setEmbedErrors((prev) => ({ ...prev, ...nextEmbed }));
        if (err.errors.name?.[0]) {
          setNameError(err.errors.name[0]);
          mappedToField = true;
        }
      }
      if (!mappedToField) setGeneralError(getPublicLeadFormMutationErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-2xl">
      {generalError && (
        <div role="alert" className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm font-semibold">
          {generalError}
        </div>
      )}
      {saved && !generalError && (
        <div role="status" className="p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm font-semibold">
          Cambios guardados.
        </div>
      )}

      <div>
        <label htmlFor="general-name" className="block text-sm font-bold text-gray-700 mb-1">Nombre</label>
        <input
          id="general-name"
          type="text"
          value={name}
          disabled={!canManage}
          onChange={(e) => setName(e.target.value)}
          className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500"
        />
        {nameError && <p className="mt-1 text-xs text-red-600 font-semibold">{nameError}</p>}
      </div>

      <div>
        <span className="block text-sm font-bold text-gray-700 mb-1">Sucursal</span>
        <p className="text-sm text-gray-500 bg-gray-50 border rounded-lg p-2.5">{form.branch?.name ?? `Sucursal #${form.branch_id}`}</p>
        <p className="mt-1 text-xs text-gray-400">No puede modificarse después de crear el formulario.</p>
      </div>

      <OriginListEditor
        title="Orígenes permitidos"
        help="Dominios autorizados a enviar el formulario y a alojar la página del formulario dentro de su propio origen (allowed_origins)."
        origins={allowedOrigins}
        setOrigins={setAllowedOrigins}
        errors={allowedErrors}
        disabled={!canManage}
      />

      <OriginListEditor
        title="Orígenes de embebido"
        help="Dominios autorizados a incrustar el formulario en un iframe propio (embed_origins). No sustituye ni se mezcla con los orígenes permitidos de arriba."
        origins={embedOrigins}
        setOrigins={setEmbedOrigins}
        errors={embedErrors}
        disabled={!canManage}
      />

      {canManage && (
        <button
          type="submit"
          disabled={submitting}
          className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg font-bold shadow-md hover:bg-indigo-700 disabled:opacity-50 text-sm"
        >
          {submitting ? "Guardando..." : "Guardar cambios"}
        </button>
      )}
    </form>
  );
};

export default GeneralTab;
