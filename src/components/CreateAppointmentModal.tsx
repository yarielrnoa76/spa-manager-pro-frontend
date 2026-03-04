import React, { useState, useEffect, useMemo } from "react";
import { X } from "lucide-react";
import { api } from "../services/api";

type CreateAppointmentPayload = {
    date: string; // YYYY-MM-DD
    time: string; // HH:mm
    client_name: string;
    client_phone?: string;
    client_email?: string;
    lead_id?: string | number | null;
    service_type: string;
    branch_id?: number | null;
    notes?: string | null;
};

// ... helpers

function pad2(n: number) {
    return String(n).padStart(2, "0");
}

function toYMD(d: Date) {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

const CreateAppointmentModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    initialData?: Partial<CreateAppointmentPayload>;
}> = ({ isOpen, onClose, onSuccess, initialData }) => {
    const [form, setForm] = useState<CreateAppointmentPayload>(() => {
        const now = new Date();
        return {
            date: toYMD(now),
            time: `${pad2(now.getHours())}:${pad2(now.getMinutes())}`,
            client_name: "",
            client_phone: "",
            client_email: "",
            service_type: "",
            branch_id: null,
            notes: "",
            lead_id: null,
            ...initialData,
        };
    });

    const [branches, setBranches] = useState<any[]>([]);
    const [products, setProducts] = useState<any[]>([]);
    const [leads, setLeads] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) return;
        const now = new Date();
        setForm({
            date: toYMD(now),
            time: `${pad2(now.getHours())}:${pad2(now.getMinutes())}`,
            client_name: "",
            client_phone: "",
            client_email: "",
            service_type: "",
            branch_id: null,
            notes: "",
            lead_id: null,
            ...initialData,
        });
        setError(null);

        Promise.all([
            api.listBranches().catch(() => []),
            api.listProducts().catch(() => []),
            api.listLeads().catch(() => []),
        ]).then(([b, p, l]) => {
            setBranches(Array.isArray(b) ? b : []);
            setProducts(Array.isArray(p) ? p : []);
            setLeads(Array.isArray(l) ? l : []);
        }).catch(console.error);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    const isFormValid = useMemo(() => {
        return (
            form.client_name.trim() !== "" &&
            form.service_type.trim() !== "" &&
            form.date &&
            form.time &&
            form.branch_id != null &&
            (!initialData?.lead_id || (form.client_phone?.trim() !== "" && form.client_email?.trim() !== ""))
        );
    }, [form, initialData]);

    const handleCreate = async () => {
        if (!isFormValid) return;

        try {
            setError(null);
            let finalLeadId = form.lead_id;

            if (!finalLeadId) {
                const queryName = (form.client_name || "").toLowerCase().trim();
                const queryPhone = (form.client_phone || "").replace(/\D/g, "");
                const queryEmail = (form.client_email || "").toLowerCase().trim();

                const matches = leads.filter(lead => {
                    const leadName = (lead.name || "").toLowerCase().trim();
                    const leadPhone = (lead.phone || "").replace(/\D/g, "");
                    const leadEmail = (lead.email || "").toLowerCase().trim();
                    const leadBranch = String(lead.branch_id);
                    const formBranch = String(form.branch_id);

                    if (formBranch && leadBranch !== formBranch) return false;

                    return (queryName && leadName === queryName) ||
                        (queryPhone && queryPhone.length >= 7 && leadPhone === queryPhone) ||
                        (queryEmail && leadEmail === queryEmail);
                });

                if (matches.length > 0) {
                    const match = matches[0];
                    const confirmLinked = window.confirm(`Existe un contacto que coincide: ${match.name} ${match.phone ? '(' + match.phone + ')' : ''}.\n\n¿Deseas vincular esta cita a este contacto existente y actualizar sus datos? Haz clic en OK/Aceptar para vincular o en Cancelar para crear uno NUEVO independiente.`);

                    if (confirmLinked) {
                        finalLeadId = match.id;
                        if ((form.client_phone && form.client_phone !== match.phone) || (form.client_email && form.client_email !== match.email)) {
                            try {
                                await api.updateLead(match.id, { ...match, phone: form.client_phone || match.phone, email: form.client_email || match.email });
                            } catch (e) {
                                console.error("Could not update lead info", e);
                            }
                        }
                    } else {
                        const newLead: any = await api.createLead({
                            name: form.client_name,
                            phone: form.client_phone || "000000000",
                            email: form.client_email || "",
                            branch_id: String(form.branch_id),
                            source: "other",
                            message: "Creado desde cita nueva",
                            status: "new"
                        });
                        finalLeadId = newLead.id;
                    }
                } else {
                    const newLead: any = await api.createLead({
                        name: form.client_name,
                        phone: form.client_phone || "000000000",
                        email: form.client_email || "",
                        branch_id: String(form.branch_id),
                        source: "other",
                        message: "Creado desde cita nueva automáticamente",
                        status: "new"
                    });
                    finalLeadId = newLead.id;
                }
            }

            // We should use api.createAppointment, but it's not strongly typed in api.ts
            const anyApi: any = api as any;
            const fn = anyApi.createAppointment || anyApi.post;
            if (anyApi.createAppointment) {
                await anyApi.createAppointment({
                    ...form,
                    branch_id: form.branch_id ? Number(form.branch_id) : null,
                    lead_id: finalLeadId,
                });
            } else {
                await anyApi.post("/appointments", {
                    ...form,
                    branch_id: form.branch_id ? Number(form.branch_id) : null,
                    lead_id: finalLeadId,
                });
            }

            onSuccess();
            onClose();
        } catch (e: any) {
            setError(e?.message ?? "Error creating appointment");
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-lg bg-white rounded-xl shadow-xl border border-gray-100">
                <div className="flex items-center justify-between p-4 border-b border-gray-100">
                    <h3 className="font-bold cursor-default text-gray-800">New Appointment {initialData?.lead_id && "for Lead"}</h3>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 rounded hover:bg-gray-50"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="p-4 space-y-4 max-h-[75vh] overflow-y-auto">
                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg px-4 py-3 text-sm">
                            {error}
                        </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1">
                                Date
                            </label>
                            <input
                                type="date"
                                value={form.date}
                                onChange={(e) =>
                                    setForm((p) => ({ ...p, date: e.target.value }))
                                }
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1">
                                Time
                            </label>
                            <input
                                type="time"
                                value={form.time}
                                onChange={(e) =>
                                    setForm((p) => ({ ...p, time: e.target.value }))
                                }
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1">
                            Client name
                        </label>
                        <input
                            value={form.client_name}
                            onChange={(e) =>
                                setForm((p) => ({ ...p, client_name: e.target.value }))
                            }
                            placeholder="John Doe"
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1">
                                Client Phone {initialData?.lead_id ? <span className="text-red-500">*</span> : ''}
                            </label>
                            <input
                                value={form.client_phone}
                                onChange={(e) =>
                                    setForm((p) => ({ ...p, client_phone: e.target.value }))
                                }
                                placeholder="+1 555 123 4567"
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1">
                                Client Email {initialData?.lead_id ? <span className="text-red-500">*</span> : ''}
                            </label>
                            <input
                                type="email"
                                value={form.client_email}
                                onChange={(e) =>
                                    setForm((p) => ({ ...p, client_email: e.target.value }))
                                }
                                placeholder="client@example.com"
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1">
                            Service type
                        </label>
                        <select
                            value={form.service_type}
                            onChange={(e) =>
                                setForm((p) => ({ ...p, service_type: e.target.value }))
                            }
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                            <option value="">Select a service</option>
                            {products.map((prod: any) => (
                                <option key={prod.id} value={prod.name}>
                                    {prod.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1">
                            Branch
                        </label>
                        <select
                            value={form.branch_id ?? ""}
                            onChange={(e) =>
                                setForm((p) => ({
                                    ...p,
                                    branch_id: e.target.value ? Number(e.target.value) : null,
                                }))
                            }
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                            <option value="">(No branch)</option>
                            {branches.map((b) => (
                                <option key={b.id} value={b.id}>
                                    {b.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1">
                            Notes
                        </label>
                        <textarea
                            value={form.notes ?? ""}
                            onChange={(e) =>
                                setForm((p) => ({ ...p, notes: e.target.value }))
                            }
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm min-h-[90px] outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                            placeholder="Optional notes..."
                        />
                    </div>
                </div>

                <div className="p-4 border-t border-gray-100 flex items-center justify-end gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-semibold hover:bg-gray-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleCreate}
                        disabled={!isFormValid}
                        className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:bg-indigo-300 disabled:cursor-not-allowed"
                    >
                        Create
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CreateAppointmentModal;
