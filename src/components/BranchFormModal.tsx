import React, { useState } from "react";
import { GitBranch, X } from "lucide-react";
import { api } from "../services/api";

type Branch = {
  id: number;
  name: string;
  code: string;
  address: string;
};

type ApiValidationErrors = Record<string, string[]>;

function getErrorMessage(e: any): string {
  const status = e?.status;
  const errors: ApiValidationErrors | undefined = e?.errors;
  if (status === 422 && errors) {
    const firstKey = Object.keys(errors)[0];
    const firstMsg = firstKey ? errors[firstKey]?.[0] : null;
    return firstMsg ?? "Validation failed.";
  }
  return e?.message ?? "Ocurrió un error.";
}

const BranchFormModal: React.FC<{
  branch?: Branch | null;
  onClose: () => void;
  onSaved: () => void;
}> = ({ branch, onClose, onSaved }) => {
  const isEdit = !!branch;

  const [name, setName] = useState(branch?.name ?? "");
  const [code, setCode] = useState(branch?.code ?? "");
  const [address, setAddress] = useState(branch?.address ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim() || !code.trim() || !address.trim()) {
      setError("Nombre, código y dirección son obligatorios.");
      return;
    }

    const payload = {
      name: name.trim(),
      code: code.trim(),
      address: address.trim(),
    };

    setSaving(true);
    try {
      if (isEdit && branch) {
        await api.put(`/branches/${branch.id}`, payload);
      } else {
        await api.post(`/branches`, payload);
      }
      onSaved();
    } catch (err: any) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50/80">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <GitBranch size={22} className="text-indigo-600" />
            {isEdit ? "Editar Sucursal" : "Nueva Sucursal"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition p-1 rounded-full hover:bg-gray-200"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col">
          <div className="px-6 py-5 space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                Nombre *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-400 focus:outline-none text-sm"
                placeholder="Ej: Sucursal Central"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                Código *
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-400 focus:outline-none text-sm"
                placeholder="Ej: HIA"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                Dirección *
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                required
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-400 focus:outline-none text-sm"
                placeholder="Ej: Calle Principal #123"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t bg-gray-50/80">
            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">
                {error}
              </div>
            )}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-50 transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 disabled:bg-indigo-300 disabled:cursor-not-allowed transition"
              >
                {saving ? "Guardando…" : isEdit ? "Guardar Cambios" : "Crear Sucursal"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BranchFormModal;
