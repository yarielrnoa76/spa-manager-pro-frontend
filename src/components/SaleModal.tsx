import React, { useState, useEffect } from "react";
import { X, Calendar, Ticket as TicketIcon, ShoppingBag, Phone, Mail, User, Pencil, Save, XCircle } from "lucide-react";
import { api } from "../services/api";
import CreateAppointmentModal from "./CreateAppointmentModal";
import CreateTicketModal from "./CreateTicketModal";

type SaleModalProps = {
    isOpen: boolean;
    onClose: () => void;
    saleId: number | string | null;
    user: any;
    onSuccess: () => void;
};

const SaleModal: React.FC<SaleModalProps> = ({ isOpen, onClose, saleId, user, onSuccess }) => {
    const [sale, setSale] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'details' | 'appointments' | 'tickets'>('details');

    const [isCreatingAppointment, setIsCreatingAppointment] = useState(false);
    const [isCreatingTicket, setIsCreatingTicket] = useState(false);

    // Editing appointments inline
    const [editingAptId, setEditingAptId] = useState<number | null>(null);
    const [aptEditForm, setAptEditForm] = useState({ date: '', time: '', service_type: '', status: '', notes: '' });
    const [aptSaving, setAptSaving] = useState(false);

    // Editing tickets inline
    const [editingTicketId, setEditingTicketId] = useState<number | null>(null);
    const [ticketEditForm, setTicketEditForm] = useState({ status: '', cancel_reason: '' });
    const [ticketSaving, setTicketSaving] = useState(false);

    const perms = (user?.permissions || []) as string[];
    const hasPerm = (p: string) => user?.is_super_admin || perms.includes(p);

    const [formData, setFormData] = useState({
        date: '',
        payment_method: '',
        notes: ''
    });

    useEffect(() => {
        if (isOpen && saleId) {
            loadSale();
            setActiveTab('details');
        }
    }, [isOpen, saleId]);

    useEffect(() => {
        if (sale) {
            setFormData({
                date: sale.date || '',
                payment_method: sale.payment_method || '',
                notes: sale.notes || ''
            });
        }
    }, [sale]);

    const loadSale = async () => {
        if (!saleId) return;
        setLoading(true);
        try {
            const data = await api.getSale(saleId);
            setSale(data);
        } catch (err) {
            console.error("Error loading sale", err);
            onClose();
        } finally {
            setLoading(false);
        }
    };

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await api.updateSale(saleId!, formData);
            await loadSale();
            onSuccess();
        } catch (err) {
            console.error("Error updating sale", err);
            alert("Error al actualizar la venta");
        } finally {
            setLoading(false);
        }
    };

    // --- Appointment edit helpers ---
    const startEditApt = (apt: any) => {
        setEditingAptId(apt.id);
        setAptEditForm({
            date: apt.date || '',
            time: apt.time || '',
            service_type: apt.service_type || '',
            status: apt.status || 'scheduled',
            notes: apt.notes || '',
        });
    };

    const saveAptEdit = async () => {
        if (!editingAptId) return;
        setAptSaving(true);
        try {
            await api.updateAppointment(editingAptId, {
                date: aptEditForm.date,
                time: aptEditForm.time,
                service_type: aptEditForm.service_type,
                status: aptEditForm.status,
                notes: aptEditForm.notes || null,
            });
            setEditingAptId(null);
            await loadSale();
        } catch (err) {
            console.error('Error updating appointment', err);
            alert('Error al actualizar la cita');
        } finally {
            setAptSaving(false);
        }
    };

    // --- Ticket edit helpers ---
    const startEditTicket = (ticket: any) => {
        setEditingTicketId(ticket.id);
        setTicketEditForm({ status: ticket.status || 'new', cancel_reason: '' });
    };

    const saveTicketEdit = async () => {
        if (!editingTicketId) return;
        setTicketSaving(true);
        try {
            await api.updateTicketStatus(
                editingTicketId,
                ticketEditForm.status,
                ticketEditForm.status === 'cancelled' ? ticketEditForm.cancel_reason : undefined
            );
            setEditingTicketId(null);
            await loadSale();
        } catch (err) {
            console.error('Error updating ticket', err);
            alert('Error al actualizar el ticket');
        } finally {
            setTicketSaving(false);
        }
    };

    if (!isOpen || !saleId) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden relative border border-gray-100">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
                            <ShoppingBag size={20} />
                        </div>
                        <div>
                            <h3 className="font-black text-gray-800 uppercase tracking-tight">Venta #{saleId}</h3>
                            {sale && <p className="text-[10px] text-gray-500 font-bold uppercase">{sale.client_name}</p>}
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <X size={20} className="text-gray-400" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b px-6 bg-white shrink-0 overflow-x-auto">
                    <button
                        onClick={() => setActiveTab('details')}
                        className={`py-3 px-4 text-sm font-bold border-b-2 transition-all whitespace-nowrap ${activeTab === 'details' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-400'} hover:text-indigo-600`}
                    >
                        Detalles de la Venta
                    </button>
                    {hasPerm('view_appointments') && (
                        <button
                            onClick={() => setActiveTab('appointments')}
                            className={`py-3 px-4 text-sm font-bold border-b-2 transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'appointments' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-400'} hover:text-indigo-600`}
                        >
                            Citas
                            {sale?.lead?.appointments?.length > 0 && <span className="bg-indigo-100 text-indigo-600 text-[10px] px-1.5 py-0.5 rounded-full">{sale.lead.appointments.length}</span>}
                        </button>
                    )}
                    {hasPerm('view_ticket') && (
                        <button
                            onClick={() => setActiveTab('tickets')}
                            className={`py-3 px-4 text-sm font-bold border-b-2 transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'tickets' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-400'} hover:text-indigo-600`}
                        >
                            Tickets
                            {sale?.lead?.tickets?.length > 0 && <span className="bg-indigo-100 text-indigo-600 text-[10px] px-1.5 py-0.5 rounded-full">{sale.lead.tickets.length}</span>}
                        </button>
                    )}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto bg-gray-50/30 p-6">
                    {loading && !sale ? (
                        <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-3">
                            <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                            <span className="text-sm font-bold uppercase tracking-widest">Cargando...</span>
                        </div>
                    ) : (
                        <>
                            {activeTab === 'details' && sale && (
                                <div className="space-y-6 max-w-2xl mx-auto">
                                    {/* Info del Lead / Cliente */}
                                    {sale.lead && (
                                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                                            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2"><User size={14} /> Datos del Cliente (Lead)</h4>
                                            <div className="grid grid-cols-3 gap-4">
                                                <div>
                                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Nombre</label>
                                                    <div className="text-sm font-bold text-gray-700">{sale.client_name}</div>
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 flex items-center gap-1"><Phone size={10} /> Teléfono</label>
                                                    <div className="text-sm font-bold text-gray-700">{sale.lead.phone || <span className="text-gray-300 italic">Sin teléfono</span>}</div>
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 flex items-center gap-1"><Mail size={10} /> Email</label>
                                                    <div className="text-sm font-bold text-gray-700 truncate">{sale.lead.email || <span className="text-gray-300 italic">Sin email</span>}</div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {hasPerm('edit_sale') ? (
                                        <form onSubmit={handleUpdate} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 space-y-6">
                                            <div className="grid grid-cols-2 gap-6">
                                                <div>
                                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Fecha</label>
                                                    <input
                                                        type="date"
                                                        className="w-full text-sm font-bold text-gray-700 bg-gray-50 px-4 py-2.5 rounded-xl border border-gray-100 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                                        value={formData.date}
                                                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Sucursal (No editable)</label>
                                                    <div className="text-sm font-bold text-gray-400 bg-gray-100 px-4 py-2.5 rounded-xl border border-gray-100">{sale.branch?.name || '-'}</div>
                                                </div>
                                            </div>

                                            <div>
                                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Producto / Servicio (No editable)</label>
                                                <div className="text-sm font-bold text-gray-400 bg-gray-100 px-4 py-2.5 rounded-xl border border-gray-100">
                                                    {sale.service_rendered} {sale.product?.sku ? `(${sale.product.sku})` : ''}
                                                    <span className="ml-2 text-[10px] font-black uppercase bg-gray-200 px-2 py-0.5 rounded text-gray-500">qty: {sale.quantity}</span>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-6">
                                                <div>
                                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Método de Pago</label>
                                                    <select
                                                        className="w-full text-sm font-bold text-gray-700 bg-gray-50 px-4 py-2.5 rounded-xl border border-gray-100 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                                        value={formData.payment_method}
                                                        onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                                                    >
                                                        <option value="Zelle">Zelle</option>
                                                        <option value="Efectivo">Efectivo</option>
                                                        <option value="Transferencia">Transferencia</option>
                                                        <option value="Tarjeta">Tarjeta</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Monto Total (No editable)</label>
                                                    <div className="text-lg font-black text-emerald-600 bg-emerald-50 px-4 py-2 rounded-xl border border-emerald-100 inline-block tracking-tighter cursor-not-allowed">
                                                        ${Number(sale.amount).toFixed(2)}
                                                    </div>
                                                </div>
                                            </div>

                                            <div>
                                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Notas</label>
                                                <textarea
                                                    className="w-full text-sm font-medium text-gray-600 bg-gray-50 px-4 py-3 rounded-xl border border-gray-100 focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none"
                                                    rows={3}
                                                    value={formData.notes}
                                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                                    placeholder="Agrega comentarios adicionales..."
                                                />
                                            </div>

                                            <div className="pt-4 flex justify-end">
                                                <button
                                                    type="submit"
                                                    disabled={loading}
                                                    className={`px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest text-white transition-all shadow-lg ${loading ? 'bg-gray-300' : 'bg-indigo-600 hover:bg-indigo-700 active:scale-95'}`}
                                                >
                                                    {loading ? 'Guardando...' : 'Guardar Cambios'}
                                                </button>
                                            </div>
                                        </form>
                                    ) : (
                                        /* READ-ONLY view for users without edit_sale permission */
                                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 space-y-6">
                                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2 text-amber-700 text-xs font-bold">
                                                <span>🔒</span> Solo lectura — No tienes permiso para editar esta venta.
                                            </div>
                                            <div className="grid grid-cols-2 gap-6">
                                                <div>
                                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Fecha</label>
                                                    <div className="text-sm font-bold text-gray-700 bg-gray-50 px-4 py-2.5 rounded-xl border border-gray-100">{sale.date}</div>
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Vendedora</label>
                                                    <div className="text-sm font-bold text-gray-700 bg-gray-50 px-4 py-2.5 rounded-xl border border-gray-100">{sale.seller?.name || '-'}</div>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-6">
                                                <div>
                                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Sucursal</label>
                                                    <div className="text-sm font-bold text-gray-700 bg-gray-50 px-4 py-2.5 rounded-xl border border-gray-100">{sale.branch?.name || '-'}</div>
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Cliente</label>
                                                    <div className="text-sm font-bold text-gray-700 bg-gray-50 px-4 py-2.5 rounded-xl border border-gray-100">{sale.client_name}</div>
                                                </div>
                                            </div>

                                            <div>
                                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Producto / Servicio</label>
                                                <div className="text-sm font-bold text-gray-700 bg-gray-50 px-4 py-2.5 rounded-xl border border-gray-100">
                                                    {sale.service_rendered} {sale.product?.sku ? `(${sale.product.sku})` : ''}
                                                    <span className="ml-2 text-[10px] font-black uppercase bg-gray-200 px-2 py-0.5 rounded text-gray-500">qty: {sale.quantity}</span>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-6">
                                                <div>
                                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Método de Pago</label>
                                                    <div className="text-sm font-bold text-gray-700 bg-gray-50 px-4 py-2.5 rounded-xl border border-gray-100">{sale.payment_method}</div>
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Monto Total</label>
                                                    <div className="text-lg font-black text-emerald-600 bg-emerald-50 px-4 py-2 rounded-xl border border-emerald-100 inline-block tracking-tighter">
                                                        ${Number(sale.amount).toFixed(2)}
                                                    </div>
                                                </div>
                                            </div>

                                            {sale.notes && (
                                                <div>
                                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Notas</label>
                                                    <div className="text-sm font-medium text-gray-600 bg-gray-50 px-4 py-3 rounded-xl border border-gray-100 italic">"{sale.notes}"</div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'appointments' && (
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center mb-2">
                                        <h4 className="text-sm font-black text-gray-800 uppercase tracking-tight">Citas del Cliente</h4>
                                        <button
                                            onClick={() => setIsCreatingAppointment(true)}
                                            className="px-4 py-2 bg-indigo-600 text-white text-[10px] font-black uppercase rounded-xl hover:bg-indigo-700 transition-all shadow-md"
                                        >
                                            Crear Cita
                                        </button>
                                    </div>
                                    {sale?.lead?.appointments?.length === 0 ? (
                                        <div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl py-12 flex flex-col items-center justify-center text-gray-400 gap-2">
                                            <Calendar size={32} />
                                            <p className="text-sm font-medium">No hay citas registradas</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {sale?.lead?.appointments?.map((apt: any) => (
                                                <div key={apt.id} className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                                                    <div className="flex items-center justify-between px-5 py-3">
                                                        <div className="flex items-center gap-4">
                                                            <div>
                                                                <p className="text-sm font-bold text-gray-700">{apt.date} {apt.time}</p>
                                                                <p className="text-xs text-gray-500">{apt.service_type}</p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${apt.status === 'completed' ? 'bg-green-100 text-green-700' :
                                                                apt.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                                                                    apt.status === 'in_progress' ? 'bg-amber-100 text-amber-700' :
                                                                        'bg-blue-100 text-blue-700'
                                                                }`}>{apt.status}</span>
                                                            {hasPerm('edit_appointment') && editingAptId !== apt.id && (
                                                                <button
                                                                    onClick={() => startEditApt(apt)}
                                                                    className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                                                    title="Editar cita"
                                                                >
                                                                    <Pencil size={14} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                    {/* Inline edit panel */}
                                                    {editingAptId === apt.id && (
                                                        <div className="border-t border-gray-100 bg-gray-50/50 px-5 py-4 space-y-3">
                                                            <div className="grid grid-cols-3 gap-3">
                                                                <div>
                                                                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Fecha</label>
                                                                    <input type="date" className="w-full text-sm font-bold text-gray-700 bg-white px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none" value={aptEditForm.date} onChange={e => setAptEditForm({ ...aptEditForm, date: e.target.value })} />
                                                                </div>
                                                                <div>
                                                                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Hora</label>
                                                                    <input type="time" className="w-full text-sm font-bold text-gray-700 bg-white px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none" value={aptEditForm.time} onChange={e => setAptEditForm({ ...aptEditForm, time: e.target.value })} />
                                                                </div>
                                                                <div>
                                                                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Estado</label>
                                                                    <select className="w-full text-sm font-bold text-gray-700 bg-white px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none" value={aptEditForm.status} onChange={e => setAptEditForm({ ...aptEditForm, status: e.target.value })}>
                                                                        <option value="scheduled">Programada</option>
                                                                        <option value="in_progress">En Proceso</option>
                                                                        <option value="completed">Completada</option>
                                                                        <option value="cancelled">Cancelada</option>
                                                                    </select>
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Notas</label>
                                                                <input type="text" className="w-full text-sm text-gray-600 bg-white px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none" value={aptEditForm.notes} onChange={e => setAptEditForm({ ...aptEditForm, notes: e.target.value })} placeholder="Notas opcionales..." />
                                                            </div>
                                                            <div className="flex justify-end gap-2">
                                                                <button onClick={() => setEditingAptId(null)} className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-gray-500 bg-gray-100 rounded-lg hover:bg-gray-200 transition-all">
                                                                    <XCircle size={12} /> Cancelar
                                                                </button>
                                                                <button onClick={saveAptEdit} disabled={aptSaving} className={`flex items-center gap-1 px-4 py-1.5 text-xs font-black text-white rounded-lg transition-all shadow-sm ${aptSaving ? 'bg-gray-300' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
                                                                    <Save size={12} /> {aptSaving ? 'Guardando...' : 'Guardar'}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'tickets' && (
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center mb-2">
                                        <h4 className="text-sm font-black text-gray-800 uppercase tracking-tight">Tickets del Cliente</h4>
                                        <button
                                            onClick={() => setIsCreatingTicket(true)}
                                            className="px-4 py-2 bg-indigo-600 text-white text-[10px] font-black uppercase rounded-xl hover:bg-indigo-700 transition-all shadow-md"
                                        >
                                            Crear Ticket
                                        </button>
                                    </div>
                                    {sale?.lead?.tickets?.length === 0 ? (
                                        <div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl py-12 flex flex-col items-center justify-center text-gray-400 gap-2">
                                            <TicketIcon size={32} />
                                            <p className="text-sm font-medium">No hay tickets registrados</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {sale?.lead?.tickets?.map((ticket: any) => (
                                                <div key={ticket.id} className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                                                    <div className="flex items-center justify-between px-5 py-3">
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-bold text-gray-700 truncate">{ticket.subject}</p>
                                                            <div className="flex items-center gap-3 mt-0.5">
                                                                <span className="text-[10px] text-gray-400">{new Date(ticket.created_at).toLocaleDateString()}</span>
                                                                <span className="text-[10px] font-bold text-gray-400 uppercase">{ticket.priority?.name || 'normal'}</span>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${ticket.status === 'closed' || ticket.status === 'completed' ? 'bg-green-100 text-green-700' :
                                                                ticket.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                                                                    ticket.status === 'in_progress' ? 'bg-amber-100 text-amber-700' :
                                                                        'bg-orange-100 text-orange-700'
                                                                }`}>{ticket.status}</span>
                                                            {hasPerm('edit_ticket') && editingTicketId !== ticket.id && (
                                                                <button
                                                                    onClick={() => startEditTicket(ticket)}
                                                                    className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                                                    title="Editar ticket"
                                                                >
                                                                    <Pencil size={14} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                    {/* Inline edit panel */}
                                                    {editingTicketId === ticket.id && (
                                                        <div className="border-t border-gray-100 bg-gray-50/50 px-5 py-4 space-y-3">
                                                            <div>
                                                                <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Cambiar Estado</label>
                                                                <select className="w-full text-sm font-bold text-gray-700 bg-white px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none" value={ticketEditForm.status} onChange={e => setTicketEditForm({ ...ticketEditForm, status: e.target.value })}>
                                                                    <option value="new">Nuevo</option>
                                                                    <option value="in_progress">En Proceso</option>
                                                                    <option value="completed">Completado</option>
                                                                    <option value="cancelled">Cancelado</option>
                                                                </select>
                                                            </div>
                                                            {ticketEditForm.status === 'cancelled' && (
                                                                <div>
                                                                    <label className="block text-[10px] font-black text-red-400 uppercase mb-1">Motivo de Cancelación *</label>
                                                                    <input type="text" className="w-full text-sm text-gray-600 bg-white px-3 py-2 rounded-lg border border-red-200 focus:ring-2 focus:ring-red-400 outline-none" value={ticketEditForm.cancel_reason} onChange={e => setTicketEditForm({ ...ticketEditForm, cancel_reason: e.target.value })} placeholder="Indique el motivo..." />
                                                                </div>
                                                            )}
                                                            <div className="flex justify-end gap-2">
                                                                <button onClick={() => setEditingTicketId(null)} className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-gray-500 bg-gray-100 rounded-lg hover:bg-gray-200 transition-all">
                                                                    <XCircle size={12} /> Cancelar
                                                                </button>
                                                                <button
                                                                    onClick={saveTicketEdit}
                                                                    disabled={ticketSaving || (ticketEditForm.status === 'cancelled' && !ticketEditForm.cancel_reason.trim())}
                                                                    className={`flex items-center gap-1 px-4 py-1.5 text-xs font-black text-white rounded-lg transition-all shadow-sm ${ticketSaving || (ticketEditForm.status === 'cancelled' && !ticketEditForm.cancel_reason.trim()) ? 'bg-gray-300' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                                                                >
                                                                    <Save size={12} /> {ticketSaving ? 'Guardando...' : 'Guardar'}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Modales de creación — solo se montan cuando están abiertos */}
            {isCreatingAppointment && (
                <CreateAppointmentModal
                    isOpen={true}
                    onClose={() => setIsCreatingAppointment(false)}
                    onSuccess={() => { loadSale(); setIsCreatingAppointment(false); }}
                    initialData={{
                        lead_id: sale?.lead_id,
                        client_name: sale?.client_name,
                        client_phone: sale?.lead?.phone || '',
                        client_email: sale?.lead?.email || '',
                        branch_id: sale?.branch_id,
                        service_type: sale?.service_rendered,
                    }}
                />
            )}

            {isCreatingTicket && (
                <CreateTicketModal
                    isOpen={true}
                    onClose={() => setIsCreatingTicket(false)}
                    onSuccess={() => { loadSale(); setIsCreatingTicket(false); }}
                    initialLeadId={sale?.lead_id}
                    initialData={{
                        branch_id: sale?.branch_id,
                        subject: `Ticket relacionado con Venta #${sale?.id}`,
                        description: `Generado desde el detalle de venta.`
                    }}
                />
            )}
        </div>
    );
}

export default SaleModal;
