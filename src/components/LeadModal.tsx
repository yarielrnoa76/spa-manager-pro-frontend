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
    const [leadConversations, setLeadConversations] = useState<any[]>([]);
    const [leadTimeline, setLeadTimeline] = useState<any[]>([]);
    const [leadTickets, setLeadTickets] = useState<any[]>([]);
    const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
    const [activeTab, setActiveTab] = useState<'details' | 'sales' | 'appointments' | 'tickets' | 'chat' | 'timeline'>('details');

    const [leadAppointments, setLeadAppointments] = useState<any[]>([]);
    const [isCreatingAppointment, setIsCreatingAppointment] = useState(false);

    const [leadSales, setLeadSales] = useState<any[]>([]);
    const [isCreatingSale, setIsCreatingSale] = useState(false);
    const [isCreatingSaleForAppointment, setIsCreatingSaleForAppointment] = useState(false);

    const [userPermissions, setUserPermissions] = useState<string[]>([]);
    const [userRole, setUserRole] = useState<string>('');
    const [currentUser, setCurrentUser] = useState<any>(null);

    const [selectedAppointment, setSelectedAppointment] = useState<any | null>(null);
    const [isEditingAppointment, setIsEditingAppointment] = useState(false);

    // Estado local para el formulario
    const [formData, setFormData] = useState({
        name: "",
        phone: "",
        email: "",
        branch_id: "",
        source: "other" as Lead["source"],
        message: "",
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
            setSelectedAppointment(null);
            setIsEditingSelectedTicket(false);
            setIsCreatingSaleForAppointment(false);
            if (leadToEdit) {
                setFormData({
                    name: leadToEdit.name,
                    phone: leadToEdit.phone,
                    email: leadToEdit.email || "",
                    branch_id: String(leadToEdit.branch_id),
                    source: leadToEdit.source,
                    message: leadToEdit.message || "",
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
                    assigned_to: "",
                }));
                setLeadTickets([]);
                setLeadAppointments([]);
                setLeadSales([]);
                setLeadTimeline([]);
            }
        }
    }, [isOpen, initialBranchId, initialName, leadToEdit]);

    const loadUserData = async () => {
        try {
            const u = await api.me();
            if (u) {
                setUserPermissions(u.permissions || []);
                setUserRole(u.role?.name || '');
                setCurrentUser(u);
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
            // Cargar datos básicos y relaciones (ventas y citas) en paralelo
            const [leadRes, logsRes, convsRes] = await Promise.allSettled([
                api.getLead(leadId),
                api.listLeadLogs(leadId),
                api.listConversations({ lead_id: leadId })
            ]);

            let latestSales: any[] = [];
            let latestAppointments: any[] = [];
            let logs: any[] = [];
            let messages: any[] = [];

            if (leadRes.status === 'fulfilled' && leadRes.value) {
                const res = leadRes.value;
                if (res.appointments) {
                    setLeadAppointments(res.appointments);
                    latestAppointments = res.appointments;
                }
                if (res.sales) {
                    setLeadSales(res.sales);
                    latestSales = res.sales;
                }
            }

            if (logsRes.status === 'fulfilled' && logsRes.value && logsRes.value.data) {
                logs = logsRes.value.data;
            }

            if (convsRes.status === 'fulfilled' && convsRes.value && convsRes.value.data) {
                const convs = convsRes.value.data;
                setLeadConversations(convs);
                
                // Cargar mensajes de cada conversación
                const msgPromises = convs.map((c: any) => api.getConversationMessages(c.id));
                const messagesResults = await Promise.allSettled(msgPromises);
                
                messagesResults.forEach(r => {
                    if (r.status === 'fulfilled' && r.value && r.value.data) {
                        messages = [...messages, ...r.value.data];
                    }
                });
            }

            // Normalizar y combinar para el timeline
            const tlLogs = logs.map(l => ({ ...l, tlType: 'log', tlDate: l.created_at ? new Date(l.created_at).getTime() : 0 }));
            const tlSales = latestSales.map(s => ({ ...s, tlType: 'sale', tlDate: s.created_at ? new Date(s.created_at).getTime() : 0 }));
            const tlMsgs = messages.map(m => ({ ...m, tlType: 'message', tlDate: m.created_at ? new Date(m.created_at).getTime() : 0 }));
            const tlApps = latestAppointments.map(a => ({ ...a, tlType: 'appointment', tlDate: a.created_at ? new Date(a.created_at).getTime() : 0 }));

            const combined = [...tlLogs, ...tlSales, ...tlMsgs, ...tlApps]
                .filter(item => item.tlDate > 0)
                .sort((a, b) => b.tlDate - a.tlDate);
            
            setLeadTimeline(combined);

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

    const handleUpdateAppointmentStatus = async (appId: number, status: string) => {
        setLoading(true);
        try {
            await api.updateAppointment(appId, { status });
            
            // Actualizar estado local si está seleccionado
            if (selectedAppointment && selectedAppointment.id === appId) {
                setSelectedAppointment({ ...selectedAppointment, status });
            }

            if (leadToEdit) loadLeadDataExtras(leadToEdit.id);
            
            // Si el estado cambia a 'confirmed', preparamos para abrir el popup de venta
            if (status === 'confirmed') {
                setIsCreatingSaleForAppointment(true);
            }
        } catch (err: any) {
            alert(err?.message || "Error al actualizar estado de la cita");
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
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[120] p-4 backdrop-blur-sm transition-opacity">
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
                        <button
                            onClick={() => {
                                setActiveTab('timeline');
                                if (leadToEdit) loadLeadDataExtras(leadToEdit.id);
                            }}
                            className={`py-3 px-4 text-sm font-bold border-b-2 transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'timeline' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-400'} hover:text-indigo-600`}
                        >
                            Timeline
                            {leadTimeline.length > 0 && <span className="bg-indigo-100 text-indigo-600 text-[10px] px-1.5 py-0.5 rounded-full">{leadTimeline.length}</span>}
                        </button>
                    </div>
                )}

                <div className="flex-1 overflow-y-auto w-full">
                    {activeTab === 'details' ? (
                        <div className="p-6">
                            {leadToEdit && (
                                <div className="mb-6 relative w-full pt-4 max-w-4xl mx-auto hidden sm:block">
                                    <div className="flex items-center justify-between relative mt-4">
                                        {/* Línea base */}
                                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1.5 border border-gray-200 bg-gray-100/50 rounded-full" />
                                        
                                        {/* Línea de progreso rellenada */}
                                        <div 
                                            className="absolute left-0 top-1/2 -translate-y-1/2 h-1.5 rounded-full transition-all duration-700 ease-out z-0 bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]"
                                            style={{
                                                width: (() => {
                                                    const keys = ['incoming', 'contact_1', 'contact_2', 'contact_3', 'interested', 'appointment_scheduled'];
                                                    let idx = keys.indexOf(leadToEdit.status);
                                                    if(leadToEdit.status === 'cold_lead') return '0%';
                                                    if(leadToEdit.status === 'recovered') return '0%'; // Especial/Off-track
                                                    if (idx === -1) return '0%';
                                                    return `${(idx / (keys.length - 1)) * 100}%`;
                                                })()
                                            }}
                                        />

                                        {(() => {
                                            const steps = [
                                                { key: 'incoming', label: 'Incoming' },
                                                { key: 'contact_1', label: '1er C.' },
                                                { key: 'contact_2', label: '2do C.' },
                                                { key: 'contact_3', label: '3er C.' },
                                                { key: 'interested', label: 'Interesado' },
                                                { key: 'appointment_scheduled', label: 'Cita Agendada' }
                                            ];
                                            const currentIdx = steps.findIndex(s => s.key === leadToEdit.status);
                                            const isSpecial = ['cold_lead', 'recovered'].includes(leadToEdit.status);
                                            
                                            return steps.map((step, idx) => {
                                                const isCompleted = currentIdx >= idx && !isSpecial;
                                                const isCurrent = currentIdx === idx && !isSpecial;

                                                return (
                                                    <div key={step.key} className="flex flex-col items-center relative z-10 w-24">
                                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center border-4 shadow-sm transition-all duration-500 will-change-transform
                                                            ${isCompleted ? 'bg-indigo-600 border-indigo-200 shadow-[0_0_15px_rgba(79,70,229,0.3)] scale-110' : 'bg-gray-100 border-white text-gray-400'}
                                                            ${isCurrent ? 'ring-4 ring-indigo-100 ring-offset-2 scale-125' : ''}
                                                        `}>
                                                            {isCompleted ? (
                                                                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                                </svg>
                                                            ) : (
                                                                <span className="text-[10px] font-bold">{idx + 1}</span>
                                                            )}
                                                        </div>
                                                        <div className="absolute top-10 font-bold transition-colors duration-300 w-max text-center">
                                                            <span className={`text-[10px] uppercase tracking-wider block ${isCompleted ? 'text-indigo-700' : 'text-gray-400'}`}>
                                                                {step.label}
                                                            </span>
                                                        </div>
                                                    </div>
                                                );
                                            });
                                        })()}
                                    </div>
                                    <div className="h-6"></div>
                                </div>
                            )}

                        <form onSubmit={handleSubmit} className="space-y-5">
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
                        </div>
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
                                    <div className="space-y-3">
                                        {selectedAppointment ? (
                                            <div className="animate-in slide-in-from-right-4 duration-300 space-y-4">
                                                <button 
                                                    onClick={() => setSelectedAppointment(null)}
                                                    className="text-xs font-bold text-indigo-600 flex items-center gap-1 hover:underline mb-2"
                                                >
                                                    ← Volver a la lista
                                                </button>
                                                
                                                <div className="bg-white border rounded-2xl p-6 shadow-sm border-indigo-100 ring-1 ring-indigo-50">
                                                    <div className="flex justify-between items-start mb-6">
                                                        <div>
                                                            <h5 className="font-black text-gray-900 text-xl leading-tight">
                                                                {selectedAppointment.service_type || 'Servicio sin definir'}
                                                            </h5>
                                                            <p className="text-xs text-indigo-400 font-bold uppercase tracking-wider mt-1">Detalles de la Cita</p>
                                                        </div>
                                                        <span className={`text-[10px] uppercase font-black px-3 py-1 rounded-full border shadow-sm ${
                                                            selectedAppointment.status === 'scheduled' ? 'bg-blue-50 text-blue-700 border-blue-100' : 
                                                            selectedAppointment.status === 'confirmed' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 
                                                            selectedAppointment.status === 'completed' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' :
                                                            'bg-gray-100 text-gray-700 border-gray-200'
                                                        }`}>
                                                            {selectedAppointment.status || 'scheduled'}
                                                        </span>
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-4 mb-6">
                                                        <div className="bg-gray-50/80 p-3 rounded-xl border border-gray-100">
                                                            <p className="text-[9px] font-black text-gray-400 uppercase mb-0.5">Fecha</p>
                                                            <p className="text-sm font-bold text-gray-800">{selectedAppointment.date}</p>
                                                        </div>
                                                        <div className="bg-gray-50/80 p-3 rounded-xl border border-gray-100">
                                                            <p className="text-[9px] font-black text-gray-400 uppercase mb-0.5">Hora</p>
                                                            <p className="text-sm font-bold text-gray-800">{selectedAppointment.time}</p>
                                                        </div>
                                                    </div>

                                                    {selectedAppointment.notes && (
                                                        <div className="bg-indigo-50/30 p-4 rounded-xl border border-indigo-50 mb-6">
                                                            <p className="text-[9px] font-black text-indigo-300 uppercase mb-1">Notas / Observaciones</p>
                                                            <p className="text-sm italic text-gray-600 leading-relaxed">"{selectedAppointment.notes}"</p>
                                                        </div>
                                                    )}

                                                    <div className="grid grid-cols-1 gap-2">
                                                        {selectedAppointment.status === 'scheduled' && (
                                                            <button
                                                                onClick={() => handleUpdateAppointmentStatus(selectedAppointment.id, 'confirmed')}
                                                                disabled={loading}
                                                                className="w-full bg-emerald-600 text-white h-12 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-emerald-700 shadow-lg shadow-emerald-200/50 transition-all flex items-center justify-center gap-2"
                                                            >
                                                                {loading ? 'Procesando...' : 'Confirmar y Realizar Venta'}
                                                            </button>
                                                        )}
                                                        {selectedAppointment.status === 'confirmed' && (
                                                            <button
                                                                onClick={() => handleUpdateAppointmentStatus(selectedAppointment.id, 'completed')}
                                                                disabled={loading}
                                                                className="w-full bg-indigo-600 text-white h-12 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 shadow-lg shadow-indigo-200/50 transition-all"
                                                            >
                                                                {loading ? 'Procesando...' : 'Marcar como Completada'}
                                                            </button>
                                                        )}
                                                        {['scheduled', 'confirmed'].includes(selectedAppointment.status) && (
                                                            <button
                                                                onClick={() => handleUpdateAppointmentStatus(selectedAppointment.id, 'cancelled')}
                                                                disabled={loading}
                                                                className="w-full bg-rose-50 text-rose-600 h-10 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-100 transition-all"
                                                            >
                                                                Cancelar Cita
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            leadAppointments.map(app => (
                                                <div 
                                                    key={app.id} 
                                                    onClick={() => setSelectedAppointment(app)}
                                                    className="bg-white border rounded-2xl p-5 shadow-xs flex flex-col gap-3 hover:shadow-md hover:border-indigo-200 hover:bg-indigo-50/5 cursor-pointer transition-all border-gray-100 relative group"
                                                >
                                                    <div className="flex justify-between items-start">
                                                        <div className="flex flex-col">
                                                            <span className="font-black text-gray-900 group-hover:text-indigo-600 transition-colors uppercase tracking-tight">
                                                                {app.service_type || 'Sin tipo de servicio'}
                                                            </span>
                                                            <p className="text-[10px] text-gray-400 font-bold mt-0.5">REF: #{app.id}</p>
                                                        </div>
                                                        <span className={`text-[9px] uppercase font-black px-2.5 py-1 rounded-lg border ${
                                                            app.status === 'scheduled' ? 'bg-blue-50 text-blue-700 border-blue-100' : 
                                                            app.status === 'confirmed' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 
                                                            app.status === 'completed' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' :
                                                            'bg-gray-100 text-gray-700 border-gray-200'
                                                        }`}>
                                                            {app.status || 'scheduled'}
                                                        </span>
                                                    </div>
                                                    <div className="text-[11px] text-gray-600 flex gap-4 mt-1 font-black bg-gray-50/50 p-2 rounded-xl border border-gray-50">
                                                        <span className="flex items-center gap-1.5"><span className="text-gray-300">📅</span> {app.date}</span>
                                                        <span className="flex items-center gap-1.5"><span className="text-gray-300">⏰</span> {app.time}</span>
                                                    </div>
                                                    <div className="absolute bottom-4 right-4 text-xs font-black text-indigo-500 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                                                        Ver detalles →
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : activeTab === 'tickets' ? (
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
                    ) : activeTab === 'timeline' ? (
                        <div className="p-6 h-full flex flex-col">
                            <h4 className="font-bold text-gray-800 text-lg border-b pb-4 mb-4">Historial y Timeline</h4>
                            <div className="flex-1 overflow-y-auto pr-2">
                            {leadTimeline.length === 0 ? (
                                <div className="text-center text-gray-400 py-12 bg-gray-50/50 rounded-2xl border-2 border-dashed border-gray-200">
                                    <p className="text-sm">No hay registros en el historial de este lead.</p>
                                </div>
                            ) : (
                                <div className="relative max-w-3xl mx-auto py-8">
                                    {/* Línea Central */}
                                    <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-indigo-100 -translate-x-1/2 hidden md:block" />

                                    <div className="space-y-12 relative">
                                        {leadTimeline.map((item, index) => {
                                            let badgeColor = "bg-indigo-50 text-indigo-700 border-indigo-100";
                                            let dotColor = "bg-indigo-500";
                                            let eventName = item.event?.replace(/_/g, ' ') || 'Actividad';

                                            if (item.tlType === 'sale') {
                                                badgeColor = "bg-emerald-50 text-emerald-700 border-emerald-100";
                                                dotColor = "bg-emerald-500";
                                                eventName = "Venta";
                                            } else if (item.tlType === 'appointment') {
                                                badgeColor = "bg-blue-50 text-blue-700 border-blue-100";
                                                dotColor = "bg-blue-500";
                                                eventName = "Cita";
                                            } else if (item.tlType === 'message') {
                                                const isOutbound = item.direction === 'outbound';
                                                badgeColor = isOutbound ? "bg-indigo-50 text-indigo-700 border-indigo-100" : "bg-gray-100 text-gray-700 border-gray-200";
                                                dotColor = isOutbound ? "bg-indigo-500" : "bg-gray-400";
                                                eventName = isOutbound ? "Mensaje Enviado" : "Mensaje Recibido";
                                            }

                                            return (
                                                <div key={`${item.tlType}-${item.id}-${index}`} className="relative grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-start">
                                                    
                                                    {/* Nombre del Evento y Fecha (Izquierda en Desktop) */}
                                                    <div className="hidden md:flex flex-col items-end text-right pt-1">
                                                        <span className={`font-black text-[10px] uppercase px-2 py-1 rounded-lg border ${badgeColor}`}>
                                                            {eventName}
                                                        </span>
                                                        <span className="text-[10px] text-gray-400 font-mono mt-1.5 bg-gray-50 px-2 py-0.5 rounded-full">
                                                            {new Date(item.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                                        </span>
                                                    </div>

                                                    {/* Punto en la línea central */}
                                                    <div className="hidden md:flex justify-center pt-2 relative z-10">
                                                        <div className={`w-4 h-4 rounded-full border-4 border-white shadow-sm ${dotColor}`} />
                                                    </div>

                                                    {/* Detalle del Evento (Derecha en Desktop) */}
                                                    <div className="bg-white p-4 border border-gray-100 rounded-2xl shadow-xs hover:shadow-md transition-all relative">
                                                        {/* Mobile Header (Visible solo en mobile) */}
                                                        <div className="md:hidden flex justify-between items-center mb-3 border-b pb-2">
                                                            <span className={`font-black text-[9px] uppercase px-2 py-1 rounded-lg border ${badgeColor}`}>
                                                                {eventName}
                                                            </span>
                                                            <span className="text-[9px] text-gray-400 font-mono">
                                                                {new Date(item.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                                            </span>
                                                        </div>

                                                        {/* Contenido según tipo */}
                                                        {item.tlType === 'sale' && (
                                                            <div className="flex flex-col gap-2">
                                                                <div className="flex justify-between items-center">
                                                                    <span className="font-black text-gray-800 text-sm">
                                                                        {item.product?.name || item.service_rendered || 'Servicio/Producto'}
                                                                    </span>
                                                                    <span className="font-black text-emerald-600 font-mono text-sm">
                                                                        ${Number(item.amount || item.total || 0).toFixed(2)}
                                                                    </span>
                                                                </div>
                                                                <div className="text-[10px] text-gray-500 font-medium space-y-0.5">
                                                                    <p>Vendedor: <span className="text-gray-700 font-bold">{item.seller?.name || item.seller_name || 'Sistema'}</span></p>
                                                                    <p>Método: <span className="capitalize">{item.payment_method}</span></p>
                                                                    {item.notes && <p className="italic text-gray-400 mt-1 border-l-2 pl-2 border-gray-100">"{item.notes}"</p>}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {item.tlType === 'appointment' && (
                                                            <div className="flex flex-col gap-2">
                                                                <div className="flex justify-between items-center border-b border-blue-50 pb-2">
                                                                    <span className="font-black text-blue-800 text-sm">{item.service_type || 'Cita Agendada'}</span>
                                                                    <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider">{item.status}</span>
                                                                </div>
                                                                <div className="grid grid-cols-2 gap-2 text-[10px]">
                                                                    <div className="bg-blue-50/50 p-2 rounded-lg border border-blue-50">
                                                                        <p className="text-blue-400 font-black uppercase text-[8px] mb-0.5">Fecha</p>
                                                                        <p className="font-bold text-blue-700">{item.date}</p>
                                                                    </div>
                                                                    <div className="bg-blue-50/50 p-2 rounded-lg border border-blue-50">
                                                                        <p className="text-blue-400 font-black uppercase text-[8px] mb-0.5">Hora</p>
                                                                        <p className="font-bold text-blue-700">{item.time}</p>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {item.tlType === 'message' && (
                                                            <div className="flex flex-col gap-2">
                                                                {item.sender?.name && (
                                                                    <div className="flex items-center gap-1.5 text-[10px] text-gray-500 font-bold mb-1">
                                                                        <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center text-[10px]">👤</div>
                                                                        {item.sender.name}
                                                                    </div>
                                                                )}
                                                                <div className="text-xs text-gray-700 bg-gray-50 p-3 rounded-xl border border-gray-100 leading-relaxed whitespace-pre-wrap italic">
                                                                    "{item.body}"
                                                                </div>
                                                            </div>
                                                        )}

                                                        {item.tlType === 'log' && (
                                                            <div className="flex flex-col gap-2">
                                                                {item.user && (
                                                                    <div className="flex items-center gap-1.5 text-[10px] text-gray-500 font-bold mb-1">
                                                                        <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center text-[10px]">👤</div>
                                                                        {item.user.name}
                                                                    </div>
                                                                )}
                                                                {item.old_values?.status && item.new_values?.status ? (
                                                                    <div className="flex items-center gap-2 bg-indigo-50/30 p-2 rounded-lg border border-indigo-50 text-[10px]">
                                                                        <span className="text-gray-400 line-through">{item.old_values.status}</span>
                                                                        <span className="text-indigo-300">➜</span>
                                                                        <span className="font-black text-indigo-700">{item.new_values.status}</span>
                                                                    </div>
                                                                ) : (
                                                                    <div className="text-[9px] text-gray-400 bg-gray-50 p-2 rounded max-h-20 overflow-y-auto custom-scrollbar font-mono">
                                                                        {JSON.stringify(item.new_values || item.old_values || {}, null, 1)}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                            </div>
                        </div>
                    ) : null}
                </div>
            </div>

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
                    user={currentUser}
                    initialData={{
                        lead_id: leadToEdit?.id,
                        client_name: formData.name,
                        branch_id: formData.branch_id ? Number(formData.branch_id) : null,
                    }}
                />
            )}

            {isCreatingSaleForAppointment && (
                <CreateSaleModal
                    isOpen={isCreatingSaleForAppointment}
                    onClose={() => setIsCreatingSaleForAppointment(false)}
                    onSuccess={() => {
                        setIsCreatingSaleForAppointment(false);
                        if (leadToEdit) {
                            loadLeadDataExtras(leadToEdit.id);
                        }
                    }}
                    user={currentUser}
                    initialData={{
                        lead_id: leadToEdit?.id,
                        client_name: formData.name,
                        branch_id: formData.branch_id ? Number(formData.branch_id) : null,
                        service_rendered: selectedAppointment?.service_type || ""
                    }}
                />
            )}
        </div >
    );
};

export default LeadModal;
