import React, { useState, useEffect } from "react";
import { X } from "lucide-react";
import { api } from "../services/api";
import { Branch, Lead } from "../types";

type LeadModalProps = {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (newLead: any) => void;
    initialBranchId?: string;
    initialName?: string;
    leadToEdit?: Lead | null;
};

const LeadModal: React.FC<LeadModalProps> = ({
    isOpen,
    onClose,
    onSuccess,
    initialBranchId,
    initialName,
    leadToEdit,
}) => {
    const [branches, setBranches] = useState<Branch[]>([]);
    const [loading, setLoading] = useState(false);

    // Estado local para el formulario
    const [formData, setFormData] = useState({
        name: "",
        phone: "",
        email: "",
        branch_id: "",
        source: "other" as Lead["source"],
        message: "",
    });

    // Cargar sucursales al montar o abrir
    useEffect(() => {
        if (isOpen) {
            loadBranches();
            if (leadToEdit) {
                setFormData({
                    name: leadToEdit.name,
                    phone: leadToEdit.phone,
                    email: leadToEdit.email || "",
                    branch_id: String(leadToEdit.branch_id),
                    source: leadToEdit.source,
                    message: leadToEdit.message || "",
                });
            } else {
                // Pre-llenar datos si vienen en props (solo si no es edit)
                setFormData((prev) => ({
                    ...prev,
                    name: initialName || "",
                    phone: "",
                    email: "",
                    branch_id: initialBranchId || prev.branch_id,
                    source: "other",
                    message: "",
                }));
            }
        }
    }, [isOpen, initialBranchId, initialName, leadToEdit]);

    const loadBranches = async () => {
        try {
            const b = await api.listBranches();
            setBranches(b);
        } catch (err) {
            console.error("Error loading branches", err);
        }
    };

    const handleChange = (
        field: keyof typeof formData,
        value: string
    ) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            let result;
            if (leadToEdit) {
                result = await api.updateLead(leadToEdit.id, formData);
            } else {
                result = await api.createLead(formData);
            }
            onSuccess(result);
            onClose();
            // Resetear para la próxima
            if (!leadToEdit) {
                setFormData({
                    name: "",
                    phone: "",
                    email: "",
                    branch_id: "",
                    source: "other",
                    message: "",
                });
            }
        } catch (err: any) {
            alert(err?.message || "Error al procesar el lead.");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4 backdrop-blur-sm transition-opacity">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden transform transition-all scale-100">

                {/* Header */}
                <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50">
                    <h3 className="font-bold text-lg text-gray-800">
                        {leadToEdit ? "Editar Lead" : "Crear Nuevo Lead"}
                    </h3>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-full hover:bg-gray-200"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Form Body */}
                <form onSubmit={handleSubmit} className="p-6 space-y-5">

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Nombre */}
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                                Nombre Completo <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                required
                                value={formData.name}
                                onChange={(e) => handleChange("name", e.target.value)}
                                className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                                placeholder="Ej. María López"
                            />
                        </div>

                        {/* Teléfono */}
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                                Teléfono <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="tel"
                                required
                                value={formData.phone}
                                onChange={(e) => handleChange("phone", e.target.value)}
                                className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                                placeholder="+52 55 1234 5678"
                            />
                        </div>
                    </div>

                    {/* Email */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                            Email (Opcional)
                        </label>
                        <input
                            type="email"
                            value={formData.email}
                            onChange={(e) => handleChange("email", e.target.value)}
                            className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                            placeholder="cliente@email.com"
                        />
                    </div>

                    {/* Sucursal y Origen */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                                Sucursal <span className="text-red-500">*</span>
                            </label>
                            <select
                                required
                                value={formData.branch_id}
                                onChange={(e) => handleChange("branch_id", e.target.value)}
                                className="w-full border border-gray-300 rounded-lg p-2.5 text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                            >
                                <option value="">-- Seleccionar --</option>
                                {branches.map((b) => (
                                    <option key={b.id} value={b.id}>
                                        {b.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                                Origen
                            </label>
                            <select
                                value={formData.source}
                                onChange={(e) => handleChange("source", e.target.value)}
                                className="w-full border border-gray-300 rounded-lg p-2.5 text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                            >
                                <option value="whatsapp">WhatsApp</option>
                                <option value="call">Llamada</option>
                                <option value="web">Web</option>
                                <option value="other">Otro</option>
                            </select>
                        </div>
                    </div>

                    {/* Mensaje */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                            Notas Adicionales
                        </label>
                        <textarea
                            value={formData.message}
                            onChange={(e) => handleChange("message", e.target.value)}
                            className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none"
                            rows={3}
                            placeholder="Detalles sobre el lead..."
                        ></textarea>
                    </div>

                    {/* Actions */}
                    <div className="pt-4 flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm font-bold text-gray-700 hover:bg-gray-50 transition-colors"
                            disabled={loading}
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-bold shadow-md hover:bg-indigo-700 hover:shadow-lg transition-all disabled:opacity-70 flex justify-center items-center"
                        >
                            {loading ? (
                                <span className="animate-pulse">Guardando...</span>
                            ) : (
                                leadToEdit ? "Actualizar Lead" : "Guardar Lead"
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default LeadModal;
