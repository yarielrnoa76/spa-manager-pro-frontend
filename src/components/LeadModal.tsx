import React, { useState, useEffect } from "react";
import { X } from "lucide-react";
import { api } from "../services/api";
import { Branch, Lead } from "../types";
import CreateAppointmentModal from "./CreateAppointmentModal";

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
    const [activeTab, setActiveTab] = useState<'details' | 'sales' | 'appointments' | 'tickets'>('details');
    const [leadTickets, setLeadTickets] = useState<any[]>([]);
    const [selectedTicket, setSelectedTicket] = useState<any | null>(null);

    const [leadAppointments, setLeadAppointments] = useState<any[]>([]);
    const [isCreatingAppointment, setIsCreatingAppointment] = useState(false);
    const [userPermissions, setUserPermissions] = useState<string[]>([]);
    const [userRole, setUserRole] = useState<string>('');

    // Estado local para el formulario
    const [formData, setFormData] = useState({
        name: "",
        phone: "",
        email: "",
        branch_id: "",
        source: "other" as Lead["source"],
        message: "",
    });

    // Nuevo: Estado para creación de ticket rápido
    const [isCreatingTicket, setIsCreatingTicket] = useState(false);
    const [isEditingSelectedTicket, setIsEditingSelectedTicket] = useState(false);
    const [categories, setCategories] = useState<any[]>([]);
    const [priorities, setPriorities] = useState<any[]>([]);
    const [responsibles, setResponsibles] = useState<any[]>([]);
    const [ticketData, setTicketData] = useState({
        subject: "",
        category_id: "",
        priority_id: "",
        description: "",
    });
    const [editTicketData, setEditTicketData] = useState({
        subject: "",
        description: "",
        responsable_id: "",
    });

    // Cargar sucursales al montar o abrir
    useEffect(() => {
        if (isOpen) {
            loadBranches();
            loadResponsibles();
            loadUserData();
            setActiveTab('details');
            setIsCreatingTicket(false);
            setSelectedTicket(null);
            setIsEditingSelectedTicket(false);
            if (leadToEdit) {
                setFormData({
                    name: leadToEdit.name,
                    phone: leadToEdit.phone,
                    email: leadToEdit.email || "",
                    branch_id: String(leadToEdit.branch_id),
                    source: leadToEdit.source,
                    message: leadToEdit.message || "",
                });
                loadLeadTickets(leadToEdit.id);
                loadLeadAppointments(leadToEdit.id);
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
                setLeadTickets([]);
                setLeadAppointments([]);
            }
        }
    }, [isOpen, initialBranchId, initialName, leadToEdit]);

    const loadUserData = async () => {
        try {
            const u = await api.me();
            if (u) {
                setUserPermissions(u.permissions || []);
                setUserRole(u.role?.name || '');
            }
        } catch (err) {
            console.error(err);
        }
    }

    const loadBranches = async () => {
        try {
            const b = await api.listBranches();
            setBranches(b);
        } catch (err) {
            console.error("Error loading branches", err);
        }
    };

    const loadResponsibles = async () => {
        try {
            const users = await api.listUsers();
            setResponsibles(users);
        } catch (err) {
            console.error("Error loading responsibles", err);
        }
    };

    const loadLeadTickets = async (leadId: string | number) => {
        try {
            const res = await api.listTickets({ lead_id: leadId });
            setLeadTickets(res.data);
        } catch (err) {
            console.error("Error loading lead tickets", err);
        }
    };

    const loadLeadAppointments = async (leadId: string | number) => {
        try {
            const res = await api.getLead(leadId);
            if (res && res.appointments) {
                setLeadAppointments(res.appointments);
            }
        } catch (err) {
            console.error("Error loading lead appointments", err);
        }
    };

    const handleOpenTicket = async (ticketId: number) => {
        setLoading(true);
        try {
            const ticket = await api.getTicket(ticketId);
            setSelectedTicket(ticket);
            setEditTicketData({
                subject: ticket.subject,
                description: ticket.description || "",
                responsable_id: ticket.responsable_id ? String(ticket.responsable_id) : "",
            });
            setIsEditingSelectedTicket(false);
        } catch (err: any) {
            console.error("Error fetching ticket", err);
            alert("No se pudo cargar el detalle del ticket: " + (err?.message || "Error desconocido"));
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateTicket = async () => {
        if (!selectedTicket) return;
        setLoading(true);
        try {
            await api.updateTicket(selectedTicket.id, editTicketData);
            setIsEditingSelectedTicket(false);
            handleOpenTicket(selectedTicket.id);
            if (leadToEdit) loadLeadTickets(leadToEdit.id);
        } catch (err: any) {
            alert(err?.message || "Error al actualizar ticket");
        } finally {
            setLoading(false);
        }
    };

    const handleStatusUpdate = async (ticketId: number, status: string) => {
        setLoading(true);
        // Optimistic update
        if (selectedTicket && selectedTicket.id === ticketId) {
            setSelectedTicket({ ...selectedTicket, status });
        }
        try {
            await api.updateTicketStatus(ticketId, status);
            await handleOpenTicket(ticketId); // Refresh detail from server
            if (leadToEdit) loadLeadTickets(leadToEdit.id); // Refresh count
        } catch (err) {
            alert("Error al actualizar estado");
            // Revert on error if necessary, though handleOpenTicket will do it
        } finally {
            setLoading(false);
        }
    };

    const handleAddComment = async (ticketId: number, comment: string) => {
        if (!comment.trim()) return;
        setLoading(true);
        try {
            await api.addTicketComment(ticketId, comment);
            await handleOpenTicket(ticketId); // Refresh detail
        } catch (err) {
            alert("Error al añadir comentario");
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (
        field: keyof typeof formData,
        value: string
    ) => {
        if (field === "phone") {
            // Only allow +, spaces, dashes, parentheses and numbers
            const sanitized = value.replace(/[^\d+\s()-]/g, "");
            setFormData((prev) => ({ ...prev, [field]: sanitized }));
        } else {
            setFormData((prev) => ({ ...prev, [field]: value }));
        }
    };

    const isFormValid = React.useMemo(() => {
        // Phone must contain at least 7 digits to be considered "valid", if it has any text
        const phoneDigitsLength = formData.phone.replace(/\D/g, "").length;
        const validPhone = formData.phone.trim() === "" || phoneDigitsLength >= 7;

        const hasContactInfo = Boolean(
            formData.name.trim() || formData.phone.trim() || formData.email.trim()
        );
        const hasBranch = Boolean(formData.branch_id);
        const hasSource = Boolean(formData.source);

        return hasContactInfo && hasBranch && hasSource && validPhone;
    }, [formData]);

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

    const handleCreateTicket = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!leadToEdit) return;
        setLoading(true);
        try {
            await api.createTicket({
                ...ticketData,
                lead_id: leadToEdit.id,
                branch_id: leadToEdit.branch_id,
            });
            setIsCreatingTicket(false);
            setTicketData({ subject: "", category_id: "", priority_id: "", description: "" });
            loadLeadTickets(leadToEdit.id);
        } catch (err: any) {
            alert(err?.message || "Error al crear ticket.");
        } finally {
            setLoading(false);
        }
    };

    const loadTicketConfigs = async () => {
        try {
            const [cats, prios] = await Promise.all([
                api.listTicketCategories(),
                api.listTicketPriorities()
            ]);
            setCategories(cats);
            setPriorities(prios);
            if (cats.length > 0) setTicketData(prev => ({ ...prev, category_id: String(cats[0].id) }));
            if (prios.length > 0) setTicketData(prev => ({ ...prev, priority_id: String(prios[0].id) }));
        } catch (err) {
            console.error("Error loading ticket configs", err);
        }
    }

    const hasPerm = (perm: string) => {
        if (userRole === 'superadmin') return true;
        return userPermissions.includes(perm);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4 backdrop-blur-sm transition-opacity">
            <div className="bg-white rounded-xl shadow-2xl w-[95vw] max-w-[1400px] h-[85vh] flex flex-col overflow-hidden transform transition-all scale-100">

                {/* Header */}
                <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50 flex-shrink-0">
                    <div>
                        <h3 className="font-bold text-lg text-gray-800">
                            {leadToEdit ? "Detalle del Lead" : "Crear Nuevo Lead"}
                        </h3>
                        {leadToEdit && <p className="text-xs text-gray-500">#{leadToEdit.id}</p>}
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-full hover:bg-gray-200"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Tabs for Edit Mode */}
                {leadToEdit && (
                    <div className="flex border-b px-6 bg-white flex-shrink-0 overflow-x-auto">
                        <button
                            onClick={() => setActiveTab('details')}
                            className={`py-3 px-4 text-sm font-bold border-b-2 transition-all whitespace-nowrap ${activeTab === 'details' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-400'} hover:text-indigo-600`}
                        >
                            Detalles
                        </button>
                        <button
                            onClick={() => setActiveTab('sales')}
                            className={`py-3 px-4 text-sm font-bold border-b-2 transition-all whitespace-nowrap ${activeTab === 'sales' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-400'} hover:text-indigo-600`}
                        >
                            Ventas
                        </button>
                        {hasPerm('view_appointments') && (
                            <button
                                onClick={() => setActiveTab('appointments')}
                                className={`py-3 px-4 text-sm font-bold border-b-2 transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'appointments' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-400'} hover:text-indigo-600`}
                            >
                                Citas
                                {leadAppointments.length > 0 && <span className="bg-indigo-100 text-indigo-600 text-[10px] px-1.5 py-0.5 rounded-full">{leadAppointments.length}</span>}
                            </button>
                        )}
                        <button
                            onClick={() => setActiveTab('tickets')}
                            className={`py-3 px-4 text-sm font-bold border-b-2 transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'tickets' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-400'} hover:text-indigo-600`}
                        >
                            Tickets
                            {leadTickets.length > 0 && <span className="bg-indigo-100 text-indigo-600 text-[10px] px-1.5 py-0.5 rounded-full">{leadTickets.length}</span>}
                        </button>
                    </div>
                )}

                <div className="flex-1 overflow-y-auto">
                    {activeTab === 'details' ? (
                        <form onSubmit={handleSubmit} className="p-6 space-y-5">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Nombre */}
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                                        Nombre Completo <span className="text-gray-400 font-normal normal-case">(Opcional si hay tel/email)</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => handleChange("name", e.target.value)}
                                        className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                                        placeholder="Ej. María López"
                                    />
                                </div>

                                {/* Teléfono */}
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                                        Teléfono <span className="text-gray-400 font-normal normal-case">(Opcional si hay nombre/email)</span>
                                    </label>
                                    <input
                                        type="tel"
                                        value={formData.phone}
                                        onChange={(e) => handleChange("phone", e.target.value)}
                                        className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                                        placeholder="+1 555 1234 567"
                                        title="Ingresa un número de teléfono válido. Ej. +1 555 123 4567"
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
                                    disabled={loading || !isFormValid}
                                    className="flex-1 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-bold shadow-md hover:bg-indigo-700 hover:shadow-lg transition-all disabled:opacity-50 disabled:bg-gray-400 flex justify-center items-center"
                                >
                                    {loading ? (
                                        <span className="animate-pulse">Guardando...</span>
                                    ) : (
                                        leadToEdit ? "Actualizar Lead" : "Guardar Lead"
                                    )}
                                </button>
                            </div>
                        </form>
                    ) : activeTab === 'sales' ? (
                        <div className="p-6 space-y-4 h-full flex flex-col items-center justify-center min-h-[400px]">
                            <h4 className="text-gray-500 font-bold mb-2">Ventas asociadas al lead</h4>
                            <p className="text-sm text-gray-400 italic">(Próximamente)</p>
                        </div>
                    ) : activeTab === 'appointments' ? (
                        <div className="p-6 space-y-4 relative flex flex-col h-full min-h-[400px]">
                            <div className="flex justify-between items-center mb-4 border-b pb-4 flex-shrink-0">
                                <div>
                                    <h4 className="font-bold text-gray-800 text-lg">Citas Programadas</h4>
                                    <p className="text-xs text-gray-500">Historial de citas de este evento/lead</p>
                                </div>
                                {hasPerm('create_appointments') && (
                                    <button
                                        onClick={() => setIsCreatingAppointment(true)}
                                        className="bg-indigo-600 font-bold text-xs text-white px-4 py-2 rounded-xl shadow-md hover:bg-indigo-700 hover:shadow-lg transition-all flex items-center gap-2"
                                    >
                                        Crear Cita
                                    </button>
                                )}
                            </div>
                            <div className="flex-1 overflow-y-auto space-y-3">
                                {leadAppointments.length === 0 ? (
                                    <div className="text-center text-gray-400 text-sm py-12 bg-gray-50/50 rounded-2xl border-2 border-dashed border-gray-200 flex flex-col items-center">
                                        No hay citas registradas para este lead.
                                    </div>
                                ) : (
                                    leadAppointments.map(app => (
                                        <div key={app.id} className="bg-white border rounded-xl p-4 shadow-sm flex flex-col gap-2 hover:shadow-md transition-all">
                                            <div className="flex justify-between">
                                                <span className="font-bold text-sm text-gray-800">{app.service_type || 'Sin tipo de servicio'}</span>
                                                <span className={`text-[10px] uppercase font-black px-2 py-0.5 rounded-full ${app.status === 'scheduled' ? 'bg-blue-100 text-blue-700' : app.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>{app.status || 'scheduled'}</span>
                                            </div>
                                            <div className="text-xs text-gray-500 flex gap-4 mt-1 font-semibold">
                                                <span className="bg-gray-50 px-2 py-1 rounded">Fecha: {app.date}</span>
                                                <span className="bg-gray-50 px-2 py-1 rounded">Hora: {app.time}</span>
                                            </div>
                                            {app.notes && <div className="text-xs text-gray-400 italic line-clamp-2 mt-2 py-2 px-3 border-l-2 border-indigo-200 bg-indigo-50/30 rounded-r-lg">"{app.notes}"</div>}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="p-6 space-y-4 relative min-h-[400px]">
                            {loading && !leadTickets.length && (
                                <div className="absolute inset-0 bg-white/50 flex items-center justify-center z-10 backdrop-blur-[1px]">
                                    <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                                </div>
                            )}
                            {selectedTicket ? (
                                /* TICKET DETAIL VIEW */
                                <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex gap-4">
                                            <button
                                                onClick={() => {
                                                    setSelectedTicket(null);
                                                    setIsEditingSelectedTicket(false);
                                                }}
                                                className="text-xs font-bold text-indigo-600 flex items-center gap-1 hover:underline"
                                            >
                                                ← Ver lista
                                            </button>
                                            {!isEditingSelectedTicket && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setIsEditingSelectedTicket(true);
                                                    }}
                                                    className="text-[11px] font-bold bg-gray-100 text-gray-700 px-2 py-1 rounded-md hover:bg-indigo-100 hover:text-indigo-700 transition-all"
                                                >
                                                    Editar
                                                </button>
                                            )}
                                        </div>
                                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${selectedTicket.status === 'Completed' ? 'bg-green-50 text-green-700 border-green-100' :
                                            selectedTicket.status === 'New' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                                                'bg-amber-50 text-amber-700 border-amber-100'
                                            }`}>
                                            {selectedTicket.status}
                                        </span>
                                    </div>

                                    {isEditingSelectedTicket ? (
                                        <div className="space-y-3 bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100 animate-in fade-in zoom-in-95">
                                            <div>
                                                <label className="block text-[10px] font-black text-indigo-400 uppercase mb-1">Asunto</label>
                                                <input
                                                    type="text"
                                                    value={editTicketData.subject}
                                                    onChange={e => setEditTicketData({ ...editTicketData, subject: e.target.value })}
                                                    className="w-full border border-gray-200 rounded-xl p-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black text-indigo-400 uppercase mb-1">Descripción / Notas</label>
                                                <textarea
                                                    value={editTicketData.description}
                                                    onChange={e => setEditTicketData({ ...editTicketData, description: e.target.value })}
                                                    className="w-full border border-gray-200 rounded-xl p-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all resize-none"
                                                    rows={3}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black text-indigo-400 uppercase mb-1">Responsable</label>
                                                <select
                                                    value={editTicketData.responsable_id}
                                                    onChange={e => setEditTicketData({ ...editTicketData, responsable_id: e.target.value })}
                                                    className="w-full border border-gray-200 rounded-xl p-2.5 text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                                                >
                                                    <option value="">-- Sin asignar --</option>
                                                    {responsibles.map(r => (
                                                        <option key={r.id} value={r.id}>{r.name} ({r.role?.name})</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => setIsEditingSelectedTicket(false)}
                                                    className="flex-1 py-2 text-xs font-bold text-gray-500 hover:bg-white rounded-xl transition-all"
                                                >
                                                    Cancelar
                                                </button>
                                                <button
                                                    onClick={handleUpdateTicket}
                                                    disabled={loading || !editTicketData.subject}
                                                    className="flex-1 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl shadow-md hover:bg-indigo-700 transition-all disabled:opacity-50"
                                                >
                                                    {loading ? 'Guardando...' : 'Guardar Cambios'}
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div>
                                            <p className="text-[10px] font-mono font-black text-gray-400 mb-1">{selectedTicket.ticket_number}</p>
                                            <h4 className="text-lg font-black text-gray-900 leading-tight">{selectedTicket.subject}</h4>

                                            <div className="mt-2 flex flex-wrap gap-2">
                                                <div className="flex items-center gap-1.5 px-3 py-1 bg-gray-100 rounded-full border border-gray-200">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                                                    <span className="text-[10px] font-bold text-gray-600">Cat: {selectedTicket.category?.name}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 px-3 py-1 bg-gray-100 rounded-full border border-gray-200">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                                                    <span className="text-[10px] font-bold text-gray-600">Resp: {selectedTicket.responsable?.name || 'No asignado'}</span>
                                                </div>
                                            </div>

                                            <p className="text-sm text-gray-600 mt-3 bg-gray-50 p-3 rounded-xl border border-gray-100 whitespace-pre-wrap">
                                                {selectedTicket.description || <span className="italic text-gray-400 text-xs">Sin descripción detallada</span>}
                                            </p>
                                        </div>
                                    )}

                                    {/* Actions */}
                                    {!isEditingSelectedTicket && (
                                        <div className="flex gap-2">
                                            {selectedTicket.status === 'New' && (
                                                <button
                                                    onClick={() => handleStatusUpdate(selectedTicket.id, 'InProgress')}
                                                    className="flex-1 bg-indigo-600 text-white py-2 rounded-xl text-xs font-bold hover:bg-indigo-700 shadow-sm"
                                                >
                                                    Empezar a tratar
                                                </button>
                                            )}
                                            {['New', 'InProgress'].includes(selectedTicket.status) && (
                                                <button
                                                    onClick={() => handleStatusUpdate(selectedTicket.id, 'Completed')}
                                                    className="flex-1 bg-green-600 text-white py-2 rounded-xl text-xs font-bold hover:bg-green-700 shadow-sm"
                                                >
                                                    Finalizar
                                                </button>
                                            )}
                                        </div>
                                    )}

                                    <hr className="border-gray-100" />

                                    {/* Comments list inside lead modal */}
                                    <div className="space-y-3">
                                        <h5 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Comentarios</h5>
                                        <div className="max-h-48 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                                            {selectedTicket.comments?.length === 0 && (
                                                <p className="text-[11px] text-gray-400 italic">No hay comentarios aún.</p>
                                            )}
                                            {selectedTicket.comments?.map((c: any) => (
                                                <div key={c.id} className="bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                                                    <div className="flex justify-between items-center mb-1">
                                                        <span className="text-[10px] font-black text-indigo-700">{c.creator?.name || 'Sistema'}</span>
                                                        <span className="text-[9px] text-gray-400">{new Date(c.created_at).toLocaleString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                    </div>
                                                    <p className="text-xs text-gray-700">{c.comment}</p>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="flex gap-2 pt-1">
                                            <input
                                                id="new-comment-input"
                                                type="text"
                                                placeholder="Añadir comentario..."
                                                className="flex-1 bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' && e.currentTarget.value) {
                                                        handleAddComment(selectedTicket.id, e.currentTarget.value);
                                                        e.currentTarget.value = '';
                                                    }
                                                }}
                                            />
                                            <button
                                                onClick={() => {
                                                    const input = document.getElementById('new-comment-input') as HTMLInputElement;
                                                    if (input && input.value) {
                                                        handleAddComment(selectedTicket.id, input.value);
                                                        input.value = '';
                                                    }
                                                }}
                                                disabled={loading}
                                                className="bg-indigo-600 text-white px-3 py-1 rounded-xl text-[10px] font-bold hover:bg-indigo-700 disabled:opacity-50"
                                            >
                                                {loading ? '...' : 'Enviar'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                /* TICKETS LIST VIEW */
                                <>
                                    <div className="flex justify-between items-center mb-2">
                                        <h4 className="text-sm font-black text-gray-800 uppercase tracking-wider">Historial de Tickets</h4>
                                        {!isCreatingTicket && (
                                            <button
                                                onClick={() => {
                                                    setIsCreatingTicket(true);
                                                    loadTicketConfigs();
                                                }}
                                                className="text-[11px] font-bold bg-indigo-600 text-white px-3 py-1.5 rounded-lg shadow-sm hover:bg-indigo-700 transition-all border border-indigo-500"
                                            >
                                                + Nuevo Ticket
                                            </button>
                                        )}
                                    </div>

                                    {isCreatingTicket ? (
                                        <form onSubmit={handleCreateTicket} className="bg-gray-50 p-5 rounded-2xl border border-indigo-100 space-y-4 animate-in fade-in zoom-in-95 duration-300">
                                            <h5 className="text-xs font-black text-indigo-600 uppercase">Nuevo Ticket para {leadToEdit?.name}</h5>
                                            <div>
                                                <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Asunto</label>
                                                <input
                                                    type="text"
                                                    required
                                                    value={ticketData.subject}
                                                    onChange={e => setTicketData({ ...ticketData, subject: e.target.value })}
                                                    className="w-full border border-gray-200 rounded-xl p-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                                                    placeholder="Ej. Seguimiento de cotización"
                                                />
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Categoría</label>
                                                    <select
                                                        value={ticketData.category_id}
                                                        onChange={e => setTicketData({ ...ticketData, category_id: e.target.value })}
                                                        className="w-full border border-gray-200 rounded-xl p-2.5 text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                                                    >
                                                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Prioridad</label>
                                                    <select
                                                        value={ticketData.priority_id}
                                                        onChange={e => setTicketData({ ...ticketData, priority_id: e.target.value })}
                                                        className="w-full border border-gray-200 rounded-xl p-2.5 text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                                                    >
                                                        {priorities.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                                    </select>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Descripción (Opcional)</label>
                                                <textarea
                                                    value={ticketData.description}
                                                    onChange={e => setTicketData({ ...ticketData, description: e.target.value })}
                                                    className="w-full border border-gray-200 rounded-xl p-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all resize-none"
                                                    rows={2}
                                                    placeholder="Detalles adicionales..."
                                                />
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setIsCreatingTicket(false)}
                                                    className="flex-1 py-2 text-xs font-bold text-gray-500 hover:bg-white rounded-xl transition-all"
                                                >
                                                    Cancelar
                                                </button>
                                                <button
                                                    type="submit"
                                                    disabled={loading || !ticketData.subject}
                                                    className="flex-1 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl shadow-md hover:bg-indigo-700 transition-all disabled:opacity-50"
                                                >
                                                    {loading ? 'Creando...' : 'Crear Ticket'}
                                                </button>
                                            </div>
                                        </form>
                                    ) : (
                                        <>
                                            {leadTickets.length === 0 ? (
                                                <div className="p-12 text-center text-gray-400 bg-gray-50 rounded-xl border-2 border-dashed">
                                                    <p className="text-sm">Este lead no tiene tickets asociados aún.</p>
                                                </div>
                                            ) : (
                                                <div className="space-y-3">
                                                    {leadTickets.map(ticket => (
                                                        <div
                                                            key={ticket.id}
                                                            className="p-4 border border-gray-100 rounded-2xl hover:shadow-md hover:border-indigo-100 transition-all cursor-pointer group bg-white"
                                                            onClick={() => handleOpenTicket(ticket.id)}
                                                        >
                                                            <div className="flex justify-between items-start mb-2">
                                                                <span className="text-[10px] font-mono font-black text-gray-400 bg-gray-50 px-2 py-1 rounded-lg group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                                                                    {ticket.ticket_number}
                                                                </span>
                                                                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${ticket.status === 'Completed' ? 'bg-green-50 text-green-700 border-green-100' :
                                                                    ticket.status === 'New' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                                                                        'bg-amber-50 text-amber-700 border-amber-100'
                                                                    }`}>
                                                                    {ticket.status}
                                                                </span>
                                                            </div>
                                                            <p className="text-sm font-bold text-gray-800 group-hover:text-indigo-600 transition-colors">{ticket.subject}</p>
                                                            <div className="mt-2 flex items-center justify-between text-[10px] font-bold text-gray-400">
                                                                <span className="flex items-center gap-1.5">
                                                                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-400"></div>
                                                                    {ticket.category?.name}
                                                                </span>
                                                                <span>Vence: {ticket.due_date ? new Date(ticket.due_date).toLocaleDateString() : 'N/A'}</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </>
                                    )}
                                </>
                            )}
                        </div>
                    )
                    }
                </div >
            </div >

            {isCreatingAppointment && (
                <CreateAppointmentModal
                    isOpen={isCreatingAppointment}
                    onClose={() => setIsCreatingAppointment(false)}
                    onSuccess={() => {
                        setIsCreatingAppointment(false);
                        if (leadToEdit) {
                            loadLeadAppointments(leadToEdit.id);
                        }
                    }}
                    initialData={{
                        lead_id: leadToEdit?.id,
                        client_name: formData.name,
                        client_phone: formData.phone,
                        client_email: formData.email,
                        branch_id: formData.branch_id ? Number(formData.branch_id) : null,
                    }}
                />
            )}
        </div >
    );
};

export default LeadModal;
