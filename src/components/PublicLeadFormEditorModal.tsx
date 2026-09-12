import React, { useState, useEffect } from "react";
import { XCircle, Plus, Trash2 } from "lucide-react";
import { api, ApiError } from "../services/api";
import { Branch, PublicLeadForm } from "../types";
import {
  isValidPublicLeadFormKey,
  isValidAllowedOrigin,
  findDuplicateAllowedOriginIndex,
  getPublicLeadFormMutationErrorMessage,
} from "../utils/publicLeadFormPresentation";

interface PublicLeadFormEditorModalProps {
  isOpen: boolean;
  /** `key` and `branch_id` are immutable after creation -- editable only in "create". */
  mode: "create" | "edit";
  formToEdit?: PublicLeadForm | null;
  onClose: () => void;
  /**
   * The server's own confirmed record. The caller must still re-fetch the list/detail after
   * this fires -- this value is a convenience (e.g. to know which id to select next), never an
   * optimistic substitute for asking the server again.
   */
  onSuccess: (form: PublicLeadForm) => void;
}

const KEY_HELP =
  'Solo minúsculas, números y guiones simples entre palabras (ej. "website-leads").';
const ORIGIN_HELP =
  "Formato esquema://host[:puerto] únicamente -- sin ruta, parámetros, fragmentos ni credenciales.";
const ORIGIN_FORMAT_ERROR = "Este origen no es válido: usa exactamente esquema://host[:puerto].";

const PublicLeadFormEditorModal: React.FC<PublicLeadFormEditorModalProps> = ({
  isOpen,
  mode,
  formToEdit,
  onClose,
  onSuccess,
}) => {
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [branchId, setBranchId] = useState("");
  const [origins, setOrigins] = useState<string[]>([""]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [keyError, setKeyError] = useState<string | null>(null);
  const [branchError, setBranchError] = useState<string | null>(null);
  const [originErrors, setOriginErrors] = useState<Record<number, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setGeneralError(null);
    setNameError(null);
    setKeyError(null);
    setBranchError(null);
    setOriginErrors({});
    setSubmitting(false);

    if (mode === "edit" && formToEdit) {
      setName(formToEdit.name);
      setKey(formToEdit.key);
      setBranchId(String(formToEdit.branch_id));
      setOrigins(formToEdit.allowed_origins.length > 0 ? [...formToEdit.allowed_origins] : [""]);
    } else {
      setName("");
      setKey("");
      setBranchId("");
      setOrigins([""]);
      api
        .listBranches()
        .then((brs) => setBranches(Array.isArray(brs) ? brs : []))
        .catch(() => setBranches([]));
    }
  }, [isOpen, mode, formToEdit]);

  if (!isOpen) return null;

  const updateOrigin = (index: number, value: string) => {
    setOrigins((prev) => prev.map((o, i) => (i === index ? value : o)));
  };

  const addOriginRow = () => setOrigins((prev) => [...prev, ""]);
  const removeOriginRow = (index: number) =>
    setOrigins((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));

  /** Client-side sanity check only -- the backend remains the final authority on canonical
   * form and duplicates (see publicLeadFormPresentation.ts). Never silently rewrites input. */
  const validate = (): boolean => {
    let ok = true;

    const trimmedName = name.trim();
    if (!trimmedName) {
      setNameError("El nombre es obligatorio.");
      ok = false;
    } else {
      setNameError(null);
    }

    if (mode === "create") {
      if (!isValidPublicLeadFormKey(key)) {
        setKeyError(KEY_HELP);
        ok = false;
      } else {
        setKeyError(null);
      }

      if (!branchId) {
        setBranchError("Selecciona una sucursal.");
        ok = false;
      } else {
        setBranchError(null);
      }
    }

    const trimmedOrigins = origins.map((o) => o.trim());
    const errors: Record<number, string> = {};
    trimmedOrigins.forEach((o, i) => {
      if (o !== "" && !isValidAllowedOrigin(o)) {
        errors[i] = ORIGIN_FORMAT_ERROR;
      }
    });
    const dupIndex = findDuplicateAllowedOriginIndex(trimmedOrigins);
    if (dupIndex !== null) {
      errors[dupIndex] = "Este origen ya fue agregado.";
    }
    if (trimmedOrigins.filter((o) => o !== "").length === 0) {
      errors[0] = "Agrega al menos un origen permitido.";
    }
    if (Object.keys(errors).length > 0) ok = false;
    setOriginErrors(errors);

    return ok;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);
    if (!validate()) return;

    setSubmitting(true);
    try {
      const cleanOrigins = origins.map((o) => o.trim()).filter((o) => o !== "");
      let result: PublicLeadForm;

      if (mode === "create") {
        result = await api.createPublicLeadForm({
          name: name.trim(),
          key,
          branch_id: Number(branchId),
          allowed_origins: cleanOrigins,
        });
      } else {
        if (!formToEdit) return;
        result = await api.updatePublicLeadForm(formToEdit.id, {
          name: name.trim(),
          allowed_origins: cleanOrigins,
        });
      }

      onSuccess(result);
      onClose();
    } catch (err: unknown) {
      // Field-specific 422 errors are shown exactly once, inline on their own field -- never
      // duplicated into the general banner below (which is reserved for errors this form
      // can't attribute to a specific field: 403/404/409/network/unmapped 422 fields).
      let mappedToField = false;

      if (err instanceof ApiError && err.status === 422 && err.errors) {
        const nextOriginErrors: Record<number, string> = {};
        Object.entries(err.errors).forEach(([field, messages]) => {
          const match = field.match(/^allowed_origins\.(\d+)$/);
          if (match && messages[0]) {
            nextOriginErrors[Number(match[1])] = messages[0];
            mappedToField = true;
          }
        });
        if (Object.keys(nextOriginErrors).length > 0) {
          setOriginErrors((prev) => ({ ...prev, ...nextOriginErrors }));
        }
        if (err.errors.name?.[0]) {
          setNameError(err.errors.name[0]);
          mappedToField = true;
        }
        if (err.errors.key?.[0]) {
          setKeyError(err.errors.key[0]);
          mappedToField = true;
        }
        if (err.errors.branch_id?.[0]) {
          setBranchError(err.errors.branch_id[0]);
          mappedToField = true;
        }
      }

      if (!mappedToField) {
        setGeneralError(getPublicLeadFormMutationErrorMessage(err));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">
        <div className="p-6 border-b flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="text-xl font-bold text-gray-900">
              {mode === "create" ? "Nuevo formulario" : "Editar formulario"}
            </h3>
            <p className="text-sm text-gray-500">
              {mode === "create"
                ? "Configura un nuevo formulario de captación pública."
                : "Solo el nombre y los orígenes permitidos pueden modificarse."}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <XCircle className="text-gray-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {generalError && (
            <div role="alert" className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm font-semibold">
              {generalError}
            </div>
          )}

          <form id="public-lead-form-editor" onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="public-lead-form-name" className="block text-sm font-bold text-gray-700 mb-1">
                Nombre
              </label>
              <input
                id="public-lead-form-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Formulario de contacto"
                className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500"
              />
              {nameError && <p className="mt-1 text-xs text-red-600 font-semibold">{nameError}</p>}
            </div>

            {mode === "create" ? (
              <div>
                <label htmlFor="public-lead-form-key" className="block text-sm font-bold text-gray-700 mb-1">
                  Identificador (key)
                </label>
                <input
                  id="public-lead-form-key"
                  type="text"
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  placeholder="website-leads"
                  className="w-full border rounded-lg p-2.5 text-sm font-mono focus:ring-2 focus:ring-indigo-500"
                />
                {keyError ? (
                  <p className="mt-1 text-xs text-red-600 font-semibold">{keyError}</p>
                ) : (
                  <p className="mt-1 text-xs text-gray-400">{KEY_HELP}</p>
                )}
              </div>
            ) : (
              <div>
                <span className="block text-sm font-bold text-gray-700 mb-1">Identificador (key)</span>
                <p className="text-sm font-mono text-gray-500 bg-gray-50 border rounded-lg p-2.5">{formToEdit?.key}</p>
                <p className="mt-1 text-xs text-gray-400">No puede modificarse después de crear el formulario.</p>
              </div>
            )}

            {mode === "create" ? (
              <div>
                <label htmlFor="public-lead-form-branch" className="block text-sm font-bold text-gray-700 mb-1">
                  Sucursal
                </label>
                <select
                  id="public-lead-form-branch"
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value)}
                  className="w-full border rounded-lg p-2.5 text-sm bg-white focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Seleccione...</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
                {branchError && <p className="mt-1 text-xs text-red-600 font-semibold">{branchError}</p>}
              </div>
            ) : (
              <div>
                <span className="block text-sm font-bold text-gray-700 mb-1">Sucursal</span>
                <p className="text-sm text-gray-500 bg-gray-50 border rounded-lg p-2.5">
                  {formToEdit?.branch?.name ?? `#${formToEdit?.branch_id}`}
                </p>
                <p className="mt-1 text-xs text-gray-400">No puede modificarse después de crear el formulario.</p>
              </div>
            )}

            <div>
              <span className="block text-sm font-bold text-gray-700 mb-1">Orígenes permitidos</span>
              <p className="text-xs text-gray-400 mb-2">{ORIGIN_HELP}</p>
              <div className="space-y-2">
                {origins.map((origin, index) => (
                  <div key={index}>
                    <div className="flex gap-2">
                      <input
                        aria-label={`Origen permitido ${index + 1}`}
                        type="text"
                        value={origin}
                        onChange={(e) => updateOrigin(index, e.target.value)}
                        placeholder="https://ejemplo.com"
                        className="flex-1 border rounded-lg p-2.5 text-sm font-mono focus:ring-2 focus:ring-indigo-500"
                      />
                      <button
                        type="button"
                        onClick={() => removeOriginRow(index)}
                        disabled={origins.length <= 1}
                        aria-label={`Eliminar origen ${index + 1}`}
                        className="px-3 rounded-lg border text-gray-400 hover:text-red-600 hover:border-red-300 disabled:opacity-40 disabled:hover:text-gray-400"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    {originErrors[index] && (
                      <p className="mt-1 text-xs text-red-600 font-semibold">{originErrors[index]}</p>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addOriginRow}
                className="mt-2 flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:underline"
              >
                <Plus size={14} /> Agregar origen
              </button>
            </div>
          </form>
        </div>

        <div className="p-6 border-t bg-gray-50 flex justify-end gap-3 flex-shrink-0 rounded-b-2xl">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 text-gray-700 font-bold hover:bg-gray-200 rounded-lg transition-colors text-sm"
          >
            Cancelar
          </button>
          <button
            form="public-lead-form-editor"
            type="submit"
            disabled={submitting}
            className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg font-bold shadow-md hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2 text-sm transition-transform active:scale-95"
          >
            {submitting ? "Guardando..." : mode === "create" ? "Crear formulario" : "Guardar cambios"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PublicLeadFormEditorModal;
