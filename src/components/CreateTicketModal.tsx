import React, { useState, useEffect } from 'react';
import { XCircle, Search, User, Link as LinkIcon } from 'lucide-react';
import { api } from '../services/api';
import { TicketCategory, TicketPriority, Lead, Branch } from '../types';

interface CreateTicketModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    initialLeadId?: number;
}

const CreateTicketModal: React.FC<CreateTicketModalProps> = ({ isOpen, onClose, onSuccess, initialLeadId }) => {
    const [categories, setCategories] = useState<TicketCategory[]>([]);
    const [priorities, setPriorities] = useState<TicketPriority[]>([]);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [leads, setLeads] = useState<Lead[]>([]);
    const [responsibles, setResponsibles] = useState<any[]>([]);

    const [formData, setFormData] = useState({
        lead_id: initialLeadId || '',
        branch_id: '',
        category_id: '',
        priority_id: '',
        subject: '',
        description: '',
        source_channel: 'other',
        responsable_id: '',
        due_date: ''
    });

    const [loading, setLoading] = useState(false);
    const [searchLead, setSearchLead] = useState('');

    useEffect(() => {
        if (isOpen) {
            Promise.all([
                api.listTicketCategories(),
                api.listTicketPriorities(),
                api.listBranches(),
                api.listLeads(),
                api.listUsers()
            ]).then(([cats, pris, brs, lds, users]) => {
                setCategories(cats);
                setPriorities(pris);
                setBranches(brs);
                setLeads(lds);
                setResponsibles(users);

                // Auto-select basic stuff if possible
                if (brs.length > 0 && !formData.branch_id) {
                    setFormData(prev => ({ ...prev, branch_id: brs[0].id.toString() }));
                }
                if (cats.length > 0 && !formData.category_id) {
                    setFormData(prev => ({ ...prev, category_id: cats[0].id.toString() }));
                }
                if (pris.length > 0 && !formData.priority_id) {
                    setFormData(prev => ({ ...prev, priority_id: pris[0].id.toString() }));
                }
            });
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const filteredLeads = leads.filter(l =>
        l.name.toLowerCase().includes(searchLead.toLowerCase()) ||
        (l.phone && l.phone.includes(searchLead))
    ).slice(0, 5); // show max 5 suggestions

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await api.createTicket({
                ...formData,
                lead_id: Number(formData.lead_id),
                branch_id: Number(formData.branch_id),
                category_id: Number(formData.category_id),
                priority_id: Number(formData.priority_id)
            });
            onSuccess();
        } catch (error: any) {
            alert(error.response?.data?.message || 'Error al crear ticket');
        } finally {
            setLoading(false);
        }
    };

    const selectedLead = leads.find(l => l.id.toString() === formData.lead_id.toString());

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]">
                <div className="p-6 border-b flex items-center justify-between flex-shrink-0">
                    <div>
                        <h3 className="text-xl font-bold text-gray-900">Crear Ticket Manual</h3>
                        <p className="text-sm text-gray-500">Abre un nuevo caso de soporte o seguimiento</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                        <XCircle className="text-gray-400" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    <form id="create-ticket-form" onSubmit={handleSubmit} className="space-y-6">

                        {/* Lead Selection */}
                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                            <label className="block text-sm font-bold text-gray-700 mb-2">Cliente / Prospecto *</label>
                            {selectedLead && !initialLeadId ? (
                                <div className="flex items-center justify-between bg-white border border-indigo-200 p-3 rounded-lg shadow-sm">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
                                            {selectedLead.name.charAt(0)}
                                        </div>
                                        <div>
                                            <p className="font-bold text-gray-900">{selectedLead.name}</p>
                                            <p className="text-xs text-gray-500">{selectedLead.phone || selectedLead.email || 'Sin info adicional'}</p>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setFormData(p => ({ ...p, lead_id: '' }))}
                                        className="text-xs text-red-500 font-bold hover:underline"
                                    >
                                        Cambiar
                                    </button>
                                </div>
                            ) : initialLeadId && selectedLead ? (
                                <div className="flex items-center gap-2 p-3 bg-indigo-50 text-indigo-800 rounded-lg border border-indigo-100">
                                    <LinkIcon size={16} /> Ticket vinculado automáticamente a <strong>{selectedLead.name}</strong>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                        <input
                                            type="text"
                                            placeholder="Buscar por nombre o teléfono..."
                                            value={searchLead}
                                            onChange={(e) => setSearchLead(e.target.value)}
                                            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                                        />
                                    </div>
                                    {searchLead && (
                                        <div className="bg-white border rounded-lg shadow-sm overflow-hidden divide-y">
                                            {filteredLeads.map(l => (
                                                <button
                                                    key={l.id}
                                                    type="button"
                                                    className="w-full text-left p-3 hover:bg-gray-50 flex flex-col"
                                                    onClick={() => {
                                                        setFormData(p => ({ ...p, lead_id: l.id.toString(), branch_id: p.branch_id || l.branch_id?.toString() || '' }));
                                                        setSearchLead('');
                                                    }}
                                                >
                                                    <span className="font-bold text-sm">{l.name}</span>
                                                    <span className="text-xs text-gray-500">{l.phone}</span>
                                                </button>
                                            ))}
                                            {filteredLeads.length === 0 && <div className="p-3 text-xs text-gray-400 text-center">No se encontraron prospectos</div>}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Clasificación */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Sucursal *</label>
                                <select
                                    required
                                    value={formData.branch_id}
                                    onChange={(e) => setFormData({ ...formData, branch_id: e.target.value })}
                                    className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 bg-white"
                                >
                                    <option value="" disabled>Seleccione...</option>
                                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Canal Origen</label>
                                <select
                                    value={formData.source_channel}
                                    onChange={(e) => setFormData({ ...formData, source_channel: e.target.value })}
                                    className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 bg-white"
                                >
                                    <option value="web">Página Web</option>
                                    <option value="whatsapp">WhatsApp</option>
                                    <option value="call">Llamada</option>
                                    <option value="facebook">Facebook</option>
                                    <option value="instagram">Instagram</option>
                                    <option value="other">Otro / Manual</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Categoría *</label>
                                <select
                                    required
                                    value={formData.category_id}
                                    onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                                    className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 bg-white"
                                >
                                    <option value="" disabled>Seleccione...</option>
                                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Prioridad *</label>
                                <select
                                    required
                                    value={formData.priority_id}
                                    onChange={(e) => setFormData({ ...formData, priority_id: e.target.value })}
                                    className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 bg-white"
                                >
                                    <option value="" disabled>Seleccione...</option>
                                    {priorities.map(p => <option key={p.id} value={p.id}>{p.name} (SLA: {p.sla_minutes}m)</option>)}
                                </select>
                            </div>
                        </div>

                        {/* Contenido */}
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Asunto *</label>
                                <input
                                    required
                                    type="text"
                                    placeholder="Ej. Problema con reservación"
                                    value={formData.subject}
                                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                                    className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Responsable</label>
                                    <select
                                        value={formData.responsable_id}
                                        onChange={e => setFormData({ ...formData, responsable_id: e.target.value })}
                                        className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 bg-white"
                                    >
                                        <option value="">-- Sin asignar --</option>
                                        {responsibles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Vencimiento (Opcional)</label>
                                    <input
                                        type="datetime-local"
                                        value={formData.due_date}
                                        onChange={e => setFormData({ ...formData, due_date: e.target.value })}
                                        className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Descripción del caso (Opcional)</label>
                                <textarea
                                    rows={4}
                                    placeholder="Detalles adicionales del ticket..."
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 resize-none"
                                />
                            </div>
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
                        form="create-ticket-form"
                        type="submit"
                        disabled={loading || !formData.lead_id}
                        className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg font-bold shadow-md hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2 text-sm transition-transform active:scale-95"
                    >
                        {loading ? 'Guardando...' : 'Crear Ticket'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CreateTicketModal;
