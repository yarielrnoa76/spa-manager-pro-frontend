import React, { useState, useEffect, useCallback } from 'react';
import {
    Plus, Search, Filter, MoreVertical, Ticket as TicketIcon,
    Clock, CheckCircle, XCircle, AlertCircle, ChevronRight,
    User, Calendar, MessageSquare, History, Settings,
    ArrowRight
} from 'lucide-react';
import { api } from '../services/api';
import { Ticket, TicketCategory, TicketPriority, User as UserType } from '../types';
import { format } from 'date-fns';
import StatCard from '../components/StatCard';

const Tickets: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'dashboard' | 'list' | 'admin'>('dashboard');
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [categories, setCategories] = useState<TicketCategory[]>([]);
    const [priorities, setPriorities] = useState<TicketPriority[]>([]);
    const [users, setUsers] = useState<UserType[]>([]);
    const [loading, setLoading] = useState(true);

    // Selection / Detail
    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
    const [showCreateModal, setShowCreateModal] = useState(false);

    // Filters
    const [filters, setFilters] = useState({
        status: 'all',
        category_id: 'all',
        priority_id: 'all',
        search: '',
        is_overdue: false,
        page: 1
    });

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [ticketsData, cats, pris, usersData] = await Promise.all([
                api.listTickets(filters),
                api.listTicketCategories(),
                api.listTicketPriorities(),
                api.listUsers()
            ]);
            setTickets(ticketsData.data);
            setCategories(cats);
            setPriorities(pris);
            setUsers(usersData);
        } catch (error) {
            console.error('Error fetching tickets data', error);
        } finally {
            setLoading(false);
        }
    }, [filters]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleStatusChange = async (ticketId: number, status: string) => {
        try {
            await api.updateTicketStatus(ticketId, status);
            fetchData();
            if (selectedTicket?.id === ticketId) {
                const updated = await api.getTicket(ticketId);
                setSelectedTicket(updated);
            }
        } catch (error) {
            alert('Error al actualizar estado');
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'New': return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'InProgress': return 'bg-amber-100 text-amber-700 border-amber-200';
            case 'Completed': return 'bg-green-100 text-green-700 border-green-200';
            case 'Cancelled': return 'bg-red-100 text-red-700 border-red-200';
            default: return 'bg-gray-100 text-gray-700 border-gray-200';
        }
    };

    const renderDashboard = () => {
        const stats = {
            total: tickets.length,
            new: tickets.filter(t => t.status === 'New').length,
            inProgress: tickets.filter(t => t.status === 'InProgress').length,
            overdue: tickets.filter(t => t.is_overdue).length,
        };

        return (
            <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard title="Total Tickets" value={stats.total} icon={TicketIcon} color="indigo" />
                    <StatCard title="Nuevos" value={stats.new} icon={AlertCircle} color="blue" />
                    <StatCard title="En Proceso" value={stats.inProgress} icon={Clock} color="amber" />
                    <StatCard title="Vencidos" value={stats.overdue} icon={XCircle} color="red" />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Recent Tickets List */}
                    <div className="bg-white rounded-xl shadow-sm border p-6">
                        <h3 className="text-lg font-bold text-gray-800 mb-4">Tickets Recientes</h3>
                        <div className="space-y-4">
                            {tickets.slice(0, 5).map(ticket => (
                                <div
                                    key={ticket.id}
                                    className="flex items-center gap-4 p-3 hover:bg-gray-50 rounded-lg border border-transparent hover:border-gray-100 transition-all cursor-pointer"
                                    onClick={() => { setSelectedTicket(ticket); setActiveTab('list'); }}
                                >
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${getStatusColor(ticket.status)}`}>
                                        <TicketIcon size={20} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-gray-900 truncate">{ticket.subject}</p>
                                        <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                                            <span>{ticket.ticket_number}</span>
                                            <span>•</span>
                                            <span>{ticket.category?.name}</span>
                                        </div>
                                    </div>
                                    <ChevronRight size={16} className="text-gray-400" />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Activity Placeholder or Chart */}
                    <div className="bg-white rounded-xl shadow-sm border p-6 flex flex-col items-center justify-center text-gray-400 min-h-[300px]">
                        <History size={48} className="mb-4 opacity-20" />
                        <p>Gráficos de rendimiento en desarrollo</p>
                    </div>
                </div>
            </div>
        );
    };

    const renderList = () => (
        <div className="space-y-4">
            {/* Search & Filters */}
            <div className="bg-white p-4 rounded-xl shadow-sm border flex flex-wrap items-center gap-4">
                <div className="relative flex-1 min-w-[300px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        placeholder="Buscar por asunto, número o cliente..."
                        className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 transition-all"
                        value={filters.search}
                        onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                    />
                </div>

                <select
                    className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                    value={filters.status}
                    onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                >
                    <option value="all">Todos los estados</option>
                    <option value="New">Nuevo</option>
                    <option value="InProgress">En Proceso</option>
                    <option value="Completed">Completado</option>
                    <option value="Cancelled">Cancelado</option>
                </select>

                <select
                    className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                    value={filters.category_id}
                    onChange={(e) => setFilters({ ...filters, category_id: e.target.value })}
                >
                    <option value="all">Todas las categorías</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>

                <button
                    onClick={() => setFilters({ ...filters, is_overdue: !filters.is_overdue })}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${filters.is_overdue
                        ? 'bg-red-50 border-red-200 text-red-700'
                        : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                        }`}
                >
                    Vencidos
                </button>
            </div>

            {/* Main Content Area: List + Detail Side-by-Side */}
            <div className="flex gap-6 h-[calc(100vh-280px)] overflow-hidden">
                {/* Table/List */}
                <div className={`flex-1 overflow-y-auto ${selectedTicket ? 'hidden lg:block' : ''}`}>
                    <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 border-b text-xs uppercase text-gray-500 font-bold">
                                <tr>
                                    <th className="px-6 py-4">Ticket</th>
                                    <th className="px-6 py-4">Asunto</th>
                                    <th className="px-6 py-4">Estado</th>
                                    <th className="px-6 py-4">Prioridad</th>
                                    <th className="px-6 py-4">Vencimiento</th>
                                    <th className="px-6 py-4">Responsable</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {tickets.map(ticket => (
                                    <tr
                                        key={ticket.id}
                                        className={`hover:bg-indigo-50/50 transition-colors cursor-pointer ${selectedTicket?.id === ticket.id ? 'bg-indigo-50' : ''}`}
                                        onClick={() => setSelectedTicket(ticket)}
                                    >
                                        <td className="px-6 py-4">
                                            <span className="text-xs font-mono font-bold text-gray-400 bg-gray-50 px-2 py-1 rounded">
                                                {ticket.ticket_number}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="text-sm font-bold text-gray-900">{ticket.subject}</p>
                                            <p className="text-xs text-gray-500">{ticket.category?.name}</p>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${getStatusColor(ticket.status)}`}>
                                                {ticket.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-1.5 text-xs text-gray-700">
                                                <AlertCircle size={14} className={ticket.priority?.name === 'Urgent' ? 'text-red-500' : 'text-gray-400'} />
                                                {ticket.priority?.name}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className={`text-xs ${ticket.is_overdue ? 'text-red-600 font-bold' : 'text-gray-600'}`}>
                                                    {ticket.due_date ? format(new Date(ticket.due_date), 'dd/MM/yyyy HH:mm') : '—'}
                                                </span>
                                                {ticket.is_overdue && <span className="text-[10px] text-red-500 flex items-center gap-1"><Clock size={10} /> VENCIDO</span>}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-600">
                                            {ticket.responsable?.name || <span className="italic text-gray-400">Sin asignar</span>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {tickets.length === 0 && (
                            <div className="p-12 text-center text-gray-400">
                                No se encontraron tickets con los filtros actuales
                            </div>
                        )}
                    </div>
                </div>

                {/* Detail Panel */}
                {selectedTicket && (
                    <div className="w-full lg:w-[450px] bg-white border rounded-xl shadow-lg flex flex-col overflow-hidden">
                        <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
                            <div>
                                <h4 className="font-bold text-gray-800 flex items-center gap-2">
                                    <TicketIcon size={18} className="text-indigo-600" />
                                    {selectedTicket.ticket_number}
                                </h4>
                                <p className="text-xs text-gray-500">Detalle del Ticket</p>
                            </div>
                            <button
                                onClick={() => setSelectedTicket(null)}
                                className="p-1.5 hover:bg-gray-200 rounded-lg text-gray-500 lg:hidden"
                            >
                                <XCircle size={20} />
                            </button>
                            <button
                                onClick={() => setSelectedTicket(null)}
                                className="p-1.5 hover:bg-gray-200 rounded-lg text-gray-500 hidden lg:block"
                            >
                                <ArrowRight size={20} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {/* Header Info */}
                            <div>
                                <h3 className="text-xl font-bold text-gray-900">{selectedTicket.subject}</h3>
                                <p className="text-sm text-gray-600 mt-2 whitespace-pre-wrap">{selectedTicket.description}</p>
                            </div>

                            {/* Status Actions */}
                            <div className="flex flex-wrap gap-2">
                                {selectedTicket.status === 'New' && (
                                    <button
                                        onClick={() => handleStatusChange(selectedTicket.id, 'InProgress')}
                                        className="flex-1 bg-indigo-600 text-white px-3 py-2 rounded-lg text-sm font-bold shadow-sm hover:bg-indigo-700 transition"
                                    >
                                        Empezar a Tratar
                                    </button>
                                )}
                                {['New', 'InProgress'].includes(selectedTicket.status) && (
                                    <>
                                        <button
                                            onClick={() => handleStatusChange(selectedTicket.id, 'Completed')}
                                            className="bg-green-600 text-white px-3 py-2 rounded-lg text-sm font-bold shadow-sm hover:bg-green-700 transition"
                                        >
                                            Finalizar
                                        </button>
                                        <button
                                            onClick={() => {
                                                const reason = window.prompt('Motivo de cancelación:');
                                                if (reason) api.updateTicketStatus(selectedTicket.id, 'Cancelled', reason).then(() => fetchData());
                                            }}
                                            className="bg-red-50 text-red-700 border border-red-200 px-3 py-2 rounded-lg text-sm font-bold hover:bg-red-100 transition"
                                        >
                                            Cancelar
                                        </button>
                                    </>
                                )}
                            </div>

                            <hr />

                            {/* Metadata Grid */}
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <label className="text-xs text-gray-400 font-bold uppercase">Categoría</label>
                                    <p className="text-gray-800 font-medium">{selectedTicket.category?.name}</p>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-400 font-bold uppercase">Prioridad</label>
                                    <p className="text-gray-800 font-medium">{selectedTicket.priority?.name}</p>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-400 font-bold uppercase">Lead / Cliente</label>
                                    <p className="text-indigo-600 font-bold">{selectedTicket.lead?.name}</p>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-400 font-bold uppercase">Vencimiento</label>
                                    <p className={`font-bold ${selectedTicket.is_overdue ? 'text-red-500' : 'text-gray-800'}`}>
                                        {selectedTicket.due_date ? format(new Date(selectedTicket.due_date), 'dd/MM/yyyy HH:mm') : '—'}
                                    </p>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-400 font-bold uppercase">Origen</label>
                                    <p className="text-gray-800 flex items-center gap-1">
                                        {selectedTicket.origin === 'system' ? <Settings size={12} /> : <User size={12} />}
                                        {selectedTicket.origin}
                                        {selectedTicket.source_channel && <span> via {selectedTicket.source_channel}</span>}
                                    </p>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-400 font-bold uppercase">Creado el</label>
                                    <p className="text-gray-600">{format(new Date(selectedTicket.created_at), 'dd/MM/yyyy')}</p>
                                </div>
                                <div className="col-span-2">
                                    <label className="text-xs text-gray-400 font-bold uppercase">Responsable Asignado</label>
                                    <div className="mt-1 flex gap-2">
                                        <select
                                            className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                            value={selectedTicket.responsable_id || ''}
                                            onChange={(e) => {
                                                const userId = e.target.value;
                                                if (userId) {
                                                    api.assignTicket(selectedTicket.id, Number(userId)).then(() => fetchData());
                                                }
                                            }}
                                        >
                                            <option value="">-- Sin asignar --</option>
                                            {users.map(u => (
                                                <option key={u.id} value={u.id}>{u.name} ({u.role?.name})</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Comments Section */}
                            <div className="space-y-4 pt-4">
                                <h5 className="font-bold text-gray-800 flex items-center gap-2">
                                    <MessageSquare size={16} /> Comentarios
                                </h5>

                                <div className="space-y-3">
                                    {selectedTicket.comments?.map(comment => (
                                        <div key={comment.id} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">
                                                    {typeof comment.created_by === 'string' ? comment.created_by : (comment.creator?.name || 'Usuario')}
                                                </span>
                                                <span className="text-[10px] text-gray-400">
                                                    {format(new Date(comment.created_at), 'dd/MM HH:mm')}
                                                </span>
                                            </div>
                                            <p className="text-sm text-gray-700">{comment.comment}</p>
                                        </div>
                                    ))}
                                </div>

                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        placeholder="Añadir comentario..."
                                        className="flex-1 bg-white border rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && e.currentTarget.value) {
                                                api.addTicketComment(selectedTicket.id, e.currentTarget.value).then(() => {
                                                    api.getTicket(selectedTicket.id).then(t => setSelectedTicket(t));
                                                    e.currentTarget.value = '';
                                                });
                                            }
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );

    const renderAdmin = () => (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Categories Manager */}
                <div className="bg-white rounded-xl shadow-sm border p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-gray-800">Categorías de Ticket</h3>
                        <button className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100">
                            <Plus size={18} />
                        </button>
                    </div>
                    <div className="space-y-2">
                        {categories.map(cat => (
                            <div key={cat.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                                <span className="text-sm font-medium">{cat.name}</span>
                                <span className="text-xs text-gray-400"># Orden {cat.sort_order}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Priorities Manager */}
                <div className="bg-white rounded-xl shadow-sm border p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-gray-800">Prioridades y Niveles de Servicio (SLA)</h3>
                        <button className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100">
                            <Plus size={18} />
                        </button>
                    </div>
                    <div className="space-y-2">
                        {priorities.map(pri => (
                            <div key={pri.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                                <div>
                                    <p className="text-sm font-medium">{pri.name}</p>
                                    <p className="text-xs text-gray-400">SLA: {pri.sla_minutes} minutos</p>
                                </div>
                                <MoreVertical size={16} className="text-gray-400" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );

    return (
        <div className="h-full flex flex-col">
            <header className="flex flex-wrap items-center justify-between gap-4 mb-6">
                <div>
                    <h2 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                        <TicketIcon className="text-indigo-600" size={28} />
                        Gestión de Tickets
                    </h2>
                    <p className="text-gray-500 font-medium">Soporte y seguimiento de leads</p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:scale-[1.02] transition-all"
                    >
                        <Plus size={20} />
                        Nuevo Ticket Manual
                    </button>
                </div>
            </header>

            {/* Tabs */}
            <div className="flex gap-4 mb-6 border-b">
                <button
                    onClick={() => setActiveTab('dashboard')}
                    className={`pb-3 px-2 text-sm font-bold transition-all relative ${activeTab === 'dashboard' ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'
                        }`}
                >
                    Dashboard
                    {activeTab === 'dashboard' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-600 rounded-t-full" />}
                </button>
                <button
                    onClick={() => setActiveTab('list')}
                    className={`pb-3 px-2 text-sm font-bold transition-all relative ${activeTab === 'list' ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'
                        }`}
                >
                    Listado de Tickets
                    {activeTab === 'list' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-600 rounded-t-full" />}
                </button>
                <button
                    onClick={() => setActiveTab('admin')}
                    className={`pb-3 px-2 text-sm font-bold transition-all relative ${activeTab === 'admin' ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'
                        }`}
                >
                    Configuración Admin
                    {activeTab === 'admin' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-600 rounded-t-full" />}
                </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                {loading && <div className="p-12 text-center text-gray-500 animate-pulse font-bold">Cargando datos...</div>}
                {!loading && activeTab === 'dashboard' && renderDashboard()}
                {!loading && activeTab === 'list' && renderList()}
                {!loading && activeTab === 'admin' && renderAdmin()}
            </div>

            {/* Create Modal Placeholder */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-bold text-gray-900">Crear Ticket Manual</h3>
                            <button onClick={() => setShowCreateModal(false)}><XCircle className="text-gray-400" /></button>
                        </div>
                        {/* Form Placeholder */}
                        <div className="space-y-4">
                            <p className="text-sm text-gray-500">Seleccione un Lead y complete los detalles del requerimiento.</p>
                            {/* Complex forms usually handled in separate components */}
                            <div className="p-12 text-center bg-gray-50 border-2 border-dashed rounded-xl">
                                Formulario de creación rápida listo para implementar
                            </div>
                            <div className="flex justify-end gap-3 mt-8">
                                <button onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-gray-600 font-bold">Cancelar</button>
                                <button className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold">Guardar Ticket</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Tickets;
