import React, { useState, useEffect } from "react";
import { X, MessageSquare } from "lucide-react";
import { api } from "../services/api";
import { Branch, Lead } from "../types";
import CreateAppointmentModal from "./CreateAppointmentModal";
import CreateSaleModal from "./CreateSaleModal";
import { ConversationChat } from "./ConversationChat";

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
    const [activeTab, setActiveTab] = useState<'details' | 'sales' | 'appointments' | 'tickets' | 'chat'>('details');
    const [leadTickets, setLeadTickets] = useState<any[]>([]);
    const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
    const [leadConversations, setLeadConversations] = useState<any[]>([]);

    const [leadAppointments, setLeadAppointments] = useState<any[]>([]);
    const [isCreatingAppointment, setIsCreatingAppointment] = useState(false);

    const [leadSales, setLeadSales] = useState<any[]>([]);
    const [isCreatingSale, setIsCreatingSale] = useState(false);

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
        status: "new" as Lead["status"],
        assigned_to: "",
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
        due_date: "",
        responsable_id: "",
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
                    status: leadToEdit.status,
                    assigned_to: leadToEdit.assigned_to ? String(leadToEdit.assigned_to) : "",
                });
                loadLeadTickets(leadToEdit.id);
                loadLeadDataExtras(leadToEdit.id);
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
                    status: "new",
                    assigned_to: "",
                }));
                setLeadTickets([]);
                setLeadAppointments([]);
                setLeadSales([]);
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

    const loadLeadConversations = async (leadId: string | number) => {
        try {
            const convs = await api.listConversations({ lead_id: leadId });
            if (convs && convs.data) setLeadConversations(convs.data);
        } catch (ce) { console.error(ce); }
    };

    const loadLeadDataExtras = async (leadId: string | number) => {
        try {
            const res = await api.getLead(leadId);
            if (res) {
                if (res.appointments) setLeadAppointments(res.appointments);
                if (res.sales) setLeadSales(res.sales);
            }
        } catch (err) {
            console.error("Error loading lead extras", err);
        }
    };

    const handleCreateConversation = async () => {
        if (!leadToEdit) return;
        setLoading(true);
        try {
            const newConv = await api.createConversation({ lead_id: Number(leadToEdit.id) });
            if (newConv) {
                setLeadConversations([newConv, ...leadConversations]);
            }
        } catch (err: any) {
            alert(err?.message || "Error al crear la conversación");
        } finally {
            setLoading(false);
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
            const payload = { ...formData };
            if (!payload.assigned_to) {
                delete (payload as any).assigned_to;
            } else {
                (payload as any).assigned_to = Number(payload.assigned_to);
            }

            if (leadToEdit) {
                result = await api.updateLead(leadToEdit.id, payload);
            } else {
                result = await api.createLead(payload);
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
                    status: "new",
                    assigned_to: "",
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
            setTicketData({ subject: "", category_id: "", priority_id: "", description: "", due_date: "", responsable_id: "" });
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
                        {leadToEdit && (
                            <div className="text-xs text-gray-500 flex flex-wrap items-center gap-2 mt-1">
                                <span className="font-mono font-bold bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">#{leadToEdit.id}</span>
                                {formData.name && <span className="font-bold text-gray-700">{formData.name}</span>}
                                {formData.phone && <span className="text-gray-400 font-mono text-[11px]">• {formData.phone}</span>}
                                {formData.email && <span className="text-gray-400 font-mono text-[11px]">• {formData.email}</span>}
                            </div>
                        )}
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
                            onClick={() => setActiveTab('chat')}
                            className={`py-3 px-4 text-sm font-bold border-b-2 transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'chat' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-400'} hover:text-indigo-600`}
                        >
                            Chat
                            {leadConversations.length > 0 && <span className="bg-indigo-100 text-indigo-600 text-[10px] px-1.5 py-0.5 rounded-full">{leadConversations.length}</span>}
                        </button>
                        {hasPerm('view_sales') && (
                            <button
                                onClick={() => setActiveTab('sales')}
                                className={`py-3 px-4 text-sm font-bold border-b-2 transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'sales' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-400'} hover:text-indigo-600`}
                            >
                                Ventas
                                {leadSales.length > 0 && <span className="bg-indigo-100 text-indigo-600 text-[10px] px-1.5 py-0.5 rounded-full">{leadSales.length}</span>}
                            </button>
                        )}
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
                            </div>

                            {/* Status and Source */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                                        Estado
                                    </label>
                                    <select
                                        value={formData.status}
                                        onChange={(e) => handleChange("status", e.target.value)}
                                        className="w-full border border-gray-300 rounded-lg p-2.5 text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                    >
                                        <option value="new">Nuevo</option>
                                        <option value="first_contact">Primer Contacto</option>
                                        <option value="second_contact">Segundo Contacto</option>
                                        <option value="third_contact">Tercer Contacto</option>
                                        <option value="contacted">Contactado</option>
                                        <option value="appointment_set">Cita Programada</option>
                                        <option value="attended">Atendido</option>
                                        <option value="sold">Vendido</option>
                                        <option value="lost">Perdido</option>
                                        <option value="discarded">Descartado</option>
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

                            {/* Asignación */}
                            {['admin', 'superadmin', 'manager'].includes(userRole) && (
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                                        Asignar A
                                    </label>
                                    <select
                                        value={formData.assigned_to}
                                        onChange={(e) => handleChange("assigned_to", e.target.value)}
                                        className="w-full border border-gray-300 rounded-lg p-2.5 text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                    >
                                        <option value="">-- Sin Asignar --</option>
                                        {responsibles.map((r) => (
                                            <option key={r.id} value={r.id}>
                                                {r.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

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
                        <div className="p-6 space-y-4 relative flex flex-col h-full min-h-[400px]">
                            <div className="flex justify-between items-center mb-2 border-b pb-4 flex-shrink-0">
                                <div>
                                    <h4 className="font-bold text-gray-800 text-lg">Historial de Ventas</h4>
                                    <p className="text-xs text-gray-500">Ventas asociadas a este lead</p>
                                </div>
                                {hasPerm('create_sale') && (
                                    <button
                                        onClick={() => setIsCreatingSale(true)}
                                        className="bg-indigo-600 font-bold text-xs text-white px-4 py-2 rounded-xl shadow-md hover:bg-indigo-700 hover:shadow-lg transition-all flex items-center gap-2"
                                    >
                                        Crear Venta
                                    </button>
                                )}
                            </div>

                            {leadSales.length > 0 && (
                                <div className="flex gap-3 mb-2 flex-shrink-0">
                                    <div className="bg-white border border-gray-100 rounded-xl px-4 py-2 shadow-sm flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
                                            <span className="text-sm font-black">{leadSales.length}</span>
                                        </div>
                                        <div className="flex flex-col text-[10px] uppercase font-bold text-gray-400 leading-tight">
                                            <span>Ventas</span>
                                            <span className="text-gray-600">Realizadas</span>
                                        </div>
                                    </div>
                                    <div className="bg-white border border-gray-100 rounded-xl px-4 py-2 shadow-sm flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 font-bold">
                                            $
                                        </div>
                                        <div className="flex flex-col text-[10px] uppercase font-bold text-gray-400 leading-tight">
                                            <span>Monto Total</span>
                                            <span className="text-emerald-700 font-black text-base leading-none">
                                                ${leadSales.reduce((acc: number, s: any) => acc + Number(s.amount || 0), 0).toFixed(2)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}
                            <div className="flex-1 overflow-y-auto space-y-3">
                                {leadSales.length === 0 ? (
                                    <div className="text-center text-gray-400 text-sm py-12 bg-gray-50/50 rounded-2xl border-2 border-dashed border-gray-200 flex flex-col items-center">
                                        No hay ventas registradas para este lead.
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto bg-white border border-gray-100 rounded-xl shadow-sm">
                                        <table className="w-full text-left text-sm whitespace-nowrap">
                                            <thead className="bg-gray-50 border-b border-gray-100 text-xs text-gray-500 uppercase font-black">
                                                <tr>
                                                    <th className="px-4 py-3">Fecha</th>
                                                    <th className="px-4 py-3">Sucursal</th>
                                                    <th className="px-4 py-3">Producto</th>
                                                    <th className="px-4 py-3">Monto</th>
                                                    <th className="px-4 py-3">Método</th>
                                                    <th className="px-4 py-3">Vendedor</th>
                                                    <th className="px-4 py-3">Estado</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-50">
                                                {leadSales.map((sale: any) => (
                                                    <tr key={sale.id} className="hover:bg-indigo-50/30 transition-colors">
                                                        <td className="px-4 py-3">
                                                            <div className="font-bold text-gray-800">{sale.date}</div>
                                                        </td>
                                                        <td className="px-4 py-3 text-gray-600 text-xs">
                                                            {sale.branch?.name || '-'}
                                                        </td>
                                                        <td className="px-4 py-3 text-gray-600 text-xs">
                                                            {sale.service_rendered || '-'}
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <div className="font-bold text-emerald-600">${Number(sale.amount).toFixed(2)}</div>
                                                        </td>
                                                        <td className="px-4 py-3 text-gray-500 text-xs">
                                                            {sale.payment_method}
                                                        </td>
                                                        <td className="px-4 py-3 text-gray-600 text-xs font-bold">
                                                            {sale.seller?.name || '-'}
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            {sale.deleted_at ? (
                                                                <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-full bg-red-100 text-red-700">Cancelada</span>
                                                            ) : (
                                                                <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-full bg-green-100 text-green-700">Completada</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : activeTab === 'chat' ? (
                        <div className="h-full flex flex-col gap-4 p-6">
                            {leadConversations.length > 0 ? (
                                leadConversations.map(conv => (
                                    <div key={conv.id} className="flex-1 min-h-[400px]">
                                        <ConversationChat conversationId={conv.id} embedded={true} user={{
                                            is_super_admin: userRole === 'superadmin',
                                            role: { name: userRole },
                                            permissions: userPermissions,
                                            branch: { id: formData.branch_id }
                                        }} />
                                    </div>
                                ))
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-gray-500 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                                    <MessageSquare size={48} className="mb-4 text-indigo-200" />
                                    <h3 className="text-lg font-bold text-gray-700 mb-2">Sin conversaciones</h3>
                                    <p className="text-sm mb-4">No hay un chat activo con este lead. Inicia uno nuevo.</p>
                                    <button
                                        onClick={handleCreateConversation}
                                        disabled={loading}
                                        className="bg-indigo-600 text-white px-6 py-2 rounded-xl text-sm font-bold shadow-md hover:bg-indigo-700 transition-all disabled:opacity-50"
                                    >
                                        {loading ? "Creando..." : "Iniciar Conversación"}
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : activeTab === 'appointments' ? (
                        <div className="p-6 space-y-4 relative flex flex-col h-full min-h-[400px]">
                            <div className="flex justify-between items-center mb-4 border-b pb-4 flex-shrink-0">
                                <div>
                                    <h4 className="font-bold text-gray-800 text-lg">Citas Programadas</h4>
                                    <p className="text-xs text-gray-500">Historial de citas de este evento/lead</p>
                                </div>
                                {hasPerm('create_appointment') && (
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
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Responsable</label>
                                                    <select
                                                        value={ticketData.responsable_id}
                                                        onChange={e => setTicketData({ ...ticketData, responsable_id: e.target.value })}
                                                        className="w-full border border-gray-200 rounded-xl p-2.5 text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                                                    >
                                                        <option value="">-- Sin asignar --</option>
                                                        {responsibles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Vencimiento</label>
                                                    <input
                                                        type="datetime-local"
                                                        value={ticketData.due_date}
                                                        onChange={e => setTicketData({ ...ticketData, due_date: e.target.value })}
                                                        className="w-full border border-gray-200 rounded-xl p-2.5 text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                                                    />
                                                </div>
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
                            loadLeadDataExtras(leadToEdit.id);
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

            {isCreatingSale && (
                <CreateSaleModal
                    isOpen={isCreatingSale}
                    onClose={() => setIsCreatingSale(false)}
                    onSuccess={() => {
                        setIsCreatingSale(false);
                        if (leadToEdit) {
                            loadLeadDataExtras(leadToEdit.id);
                        }
                    }}
                    user={{
                        is_super_admin: userRole === 'superadmin',
                        role: { name: userRole },
                        permissions: userPermissions,
                        branch: { id: formData.branch_id }
                    }}
                    initialData={{
                        lead_id: leadToEdit?.id,
                        client_name: formData.name,
                        branch_id: formData.branch_id ? Number(formData.branch_id) : null,
                    }}
                />
            )}
        </div >
    );
};

export default LeadModal;
