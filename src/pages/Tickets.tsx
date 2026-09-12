import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Plus, Search, Ticket as TicketIcon,
    Clock, CheckCircle, XCircle, AlertCircle, ChevronRight, ChevronLeft,
    User, MessageSquare, Settings, ShieldAlert, WifiOff,
} from 'lucide-react';
import { api, ApiError } from '../services/api';
import { Ticket, TicketCategory, TicketPriority, Lead } from '../types';
import { UserData } from '../App';
import { format } from 'date-fns';
import StatCard from '../components/StatCard';
import CreateTicketModal from '../components/CreateTicketModal';
import LeadModal from '../components/LeadModal';
import { TicketResponsableSelect, TicketAssignmentDialog } from '../components/TicketAssignmentControl';
import { useTicketAssignmentControl } from '../hooks/useTicketAssignmentControl';
import { getTicketStatusLabel, getTicketCommentAuthorLabel, getTicketCommentTimestampLabel } from '../utils/ticketPresentation';

/** A valid deep-linkable ticket id: a plain positive integer -- never 0, negative, decimal, or non-numeric. */
const VALID_TICKET_ID_PARAM = /^[1-9]\d*$/;

type LoadState = 'idle' | 'loading' | 'empty' | 'forbidden' | 'error' | 'success';

type DashboardSummary = Awaited<ReturnType<typeof api.getTicketDashboardSummary>>;

type TicketFilters = {
    search: string;
    status: string;
    category_id: string;
    priority_id: string;
    responsable_id: string;
    unassigned_only: boolean;
    is_overdue: boolean;
    date_from: string;
    date_to: string;
    page: number;
};

const DEFAULT_FILTERS: TicketFilters = {
    search: '',
    status: 'all',
    category_id: 'all',
    priority_id: 'all',
    responsable_id: 'all',
    unassigned_only: false,
    is_overdue: false,
    date_from: '',
    date_to: '',
    page: 1,
};

const PER_PAGE = 15;

interface TicketsProps {
    user: UserData | null;
}

const statusBadgeClasses = (status: string) => {
    switch (status) {
        case 'New': return 'bg-blue-50 text-blue-700 border-blue-200';
        case 'InProgress': return 'bg-amber-50 text-amber-700 border-amber-200';
        case 'Completed': return 'bg-green-50 text-green-700 border-green-200';
        case 'Cancelled': return 'bg-red-50 text-red-700 border-red-200';
        default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
};

const Tickets: React.FC<TicketsProps> = ({ user }) => {
    const { ticketId: ticketIdParam } = useParams<{ ticketId?: string }>();
    const navigate = useNavigate();

    const isSuperAdmin = user?.is_super_admin === true;
    const perms = useMemo<string[]>(() => Array.isArray(user?.permissions) ? user!.permissions : [], [user]);
    const hasPerm = useCallback((p: string) => isSuperAdmin || perms.includes(p), [isSuperAdmin, perms]);

    const canCreate = hasPerm('create_ticket');
    const canManageConfig = hasPerm('manage_ticket_config');
    // Adversarial correction, defect 6: Start/Complete/Cancel used to render for anyone who could
    // merely VIEW a ticket. The backend's own `TicketController::updateStatus()` gates on
    // `TicketPolicy::update()` (edit_ticket), which is the same authority `edit_ticket` checks
    // here — this hides a control that would otherwise guarantee a 403 round trip, it is never
    // the actual authorization boundary.
    const canEditTicket = hasPerm('edit_ticket');

    const [activeTab, setActiveTab] = useState<'dashboard' | 'list' | 'admin'>('dashboard');

    // --- Dashboard ---
    const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
    const [dashboardState, setDashboardState] = useState<LoadState>('idle');

    const loadDashboard = useCallback(async () => {
        setDashboardState('loading');
        try {
            const data = await api.getTicketDashboardSummary();
            setDashboard(data);
            setDashboardState(data.total === 0 ? 'empty' : 'success');
        } catch (err: unknown) {
            setDashboard(null);
            const status = err instanceof ApiError ? err.status : undefined;
            setDashboardState(status === 403 ? 'forbidden' : 'error');
        }
    }, []);

    // --- List ---
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [listMeta, setListMeta] = useState({ current_page: 1, last_page: 1, total: 0 });
    const [listState, setListState] = useState<LoadState>('idle');
    const [filters, setFilters] = useState<TicketFilters>(DEFAULT_FILTERS);

    const loadList = useCallback(async (f: TicketFilters) => {
        setListState('loading');
        try {
            const params: Record<string, unknown> = {
                per_page: PER_PAGE,
                page: f.page,
            };
            if (f.search) params.search = f.search;
            if (f.status !== 'all') params.status = f.status;
            if (f.category_id !== 'all') params.category_id = f.category_id;
            if (f.priority_id !== 'all') params.priority_id = f.priority_id;
            if (f.responsable_id !== 'all') params.responsable_id = f.responsable_id;
            if (f.unassigned_only) params.unassigned_only = true;
            if (f.is_overdue) params.is_overdue = true;
            if (f.date_from) params.date_from = f.date_from;
            if (f.date_to) params.date_to = f.date_to;

            const res = await api.listTickets(params);
            const rows = (res.data ?? []) as Ticket[];
            setTickets(rows);
            setListMeta({
                current_page: res.current_page ?? f.page,
                last_page: res.last_page ?? 1,
                total: res.total ?? rows.length,
            });
            setListState(rows.length === 0 ? 'empty' : 'success');
        } catch (err: unknown) {
            setTickets([]);
            const status = err instanceof ApiError ? err.status : undefined;
            setListState(status === 403 ? 'forbidden' : 'error');
        }
    }, []);

    // --- Config (categories / priorities) ---
    const [categories, setCategories] = useState<TicketCategory[]>([]);
    const [priorities, setPriorities] = useState<TicketPriority[]>([]);

    // Adversarial correction, defect 7: `dashboard.workload_by_responsable` is deliberately
    // active-tickets-only (it answers "who currently has work"), so a responsable whose tickets
    // are ALL Completed/Cancelled would silently disappear from a filter sourced from it. This is
    // a separate, minimal, server-side collection over every ticket the actor can see, any status.
    const [responsableOptions, setResponsableOptions] = useState<Array<{ id: number; name: string | null }>>([]);

    const loadConfig = useCallback(async () => {
        try {
            const [cats, pris, responsables] = await Promise.all([
                api.listTicketCategories(),
                api.listTicketPriorities(),
                api.getTicketResponsableOptions(),
            ]);
            setCategories(cats);
            setPriorities(pris);
            setResponsableOptions(responsables);
        } catch {
            // Non-fatal: dropdowns simply stay empty.
        }
    }, []);

    useEffect(() => {
        loadDashboard();
        loadConfig();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (activeTab === 'list') {
            loadList(filters);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, filters]);

    // --- Ticket detail ---
    const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
    const [detailState, setDetailState] = useState<LoadState>('idle');
    const [newComment, setNewComment] = useState('');

    const loadDetail = useCallback(async (id: number) => {
        setDetailState('loading');
        try {
            const t = await api.getTicket(id);
            setSelectedTicket(t);
            setDetailState('success');
        } catch (err: unknown) {
            setSelectedTicket(null);
            const status = err instanceof ApiError ? err.status : undefined;
            setDetailState(status === 403 ? 'forbidden' : 'error');
        }
    }, []);

    useEffect(() => {
        if (selectedTicketId !== null) {
            loadDetail(selectedTicketId);
        } else {
            setSelectedTicket(null);
            setDetailState('idle');
        }
    }, [selectedTicketId, loadDetail]);

    const refreshAfterChange = useCallback(() => {
        if (selectedTicketId !== null) loadDetail(selectedTicketId);
        loadList(filters);
        loadDashboard();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedTicketId, filters]);

    // --- Deep link: /tickets/:ticketId opens this ticket directly, on the Listado tab ---
    // Always the ticket's own internal `id` -- never resolved by `ticket_number`.
    const parsedTicketIdFromRoute = useMemo(() => {
        if (!ticketIdParam) return null;
        return VALID_TICKET_ID_PARAM.test(ticketIdParam) ? Number(ticketIdParam) : null;
    }, [ticketIdParam]);

    const openTicketDetail = useCallback((id: number) => {
        setActiveTab('list');
        setSelectedTicketId(id);
        navigate(`/tickets/${id}`);
    }, [navigate]);

    const closeDetail = useCallback(() => {
        setSelectedTicketId(null);
        navigate('/tickets');
    }, [navigate]);

    useEffect(() => {
        // A malformed id in the URL (empty, non-numeric, decimal, negative, zero) must never
        // reach api.getTicket() -- fall back to the plain list rather than guess at intent.
        if (ticketIdParam !== undefined && parsedTicketIdFromRoute === null) {
            navigate('/tickets', { replace: true });
        }
    }, [ticketIdParam, parsedTicketIdFromRoute, navigate]);

    useEffect(() => {
        if (parsedTicketIdFromRoute !== null && parsedTicketIdFromRoute !== selectedTicketId) {
            setActiveTab('list');
            setSelectedTicketId(parsedTicketIdFromRoute);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [parsedTicketIdFromRoute]);

    // --- Shared assignment control (Tickets/Tasks global surface, §10/§11) ---
    const assignment = useTicketAssignmentControl({
        ticketId: selectedTicketId,
        onSubmit: async (payload) => {
            if (selectedTicketId === null) return;
            await api.assignTicket(selectedTicketId, payload);
        },
        onSettled: refreshAfterChange,
    });

    // --- Lead deep link ---
    const [leadModalOpen, setLeadModalOpen] = useState(false);
    const [leadToOpen, setLeadToOpen] = useState<Lead | null>(null);
    const [leadOpenError, setLeadOpenError] = useState<string | null>(null);
    const [leadOpenLoading, setLeadOpenLoading] = useState(false);

    const openLeadFicha = async (leadId: number | string) => {
        setLeadOpenError(null);
        setLeadOpenLoading(true);
        try {
            // The lead id merely NAVIGATES here -- LeadPolicy re-authorizes it server-side. A
            // 403 never hides the ticket itself; it only stops the lead modal from opening.
            const lead = await api.getLead(leadId);
            setLeadToOpen(lead);
            setLeadModalOpen(true);
        } catch (err: unknown) {
            const status = err instanceof ApiError ? err.status : undefined;
            setLeadOpenError(
                status === 403
                    ? 'No tienes autorización para ver la ficha de este lead.'
                    : 'No se pudo cargar el lead asociado.',
            );
        } finally {
            setLeadOpenLoading(false);
        }
    };

    // --- Status / comments ---
    const handleStatusChange = async (ticketId: number, status: string) => {
        try {
            await api.updateTicketStatus(ticketId, status);
            refreshAfterChange();
        } catch {
            alert('Error al actualizar estado');
        }
    };

    const [cancelModalOpen, setCancelModalOpen] = useState(false);
    const [cancelReason, setCancelReason] = useState('');

    const submitCancel = async () => {
        if (!selectedTicketId || !cancelReason.trim()) return;
        try {
            await api.updateTicketStatus(selectedTicketId, 'Cancelled', cancelReason);
            setCancelModalOpen(false);
            setCancelReason('');
            refreshAfterChange();
        } catch {
            alert('Error al cancelar el ticket');
        }
    };

    const submitComment = async () => {
        if (!selectedTicketId || !newComment.trim()) return;
        await api.addTicketComment(selectedTicketId, newComment.trim());
        setNewComment('');
        loadDetail(selectedTicketId);
    };

    // --- Admin config creation ---
    const [newCategoryName, setNewCategoryName] = useState('');
    const [newPriorityName, setNewPriorityName] = useState('');
    const [newPrioritySla, setNewPrioritySla] = useState('');

    const createCategory = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newCategoryName.trim()) return;
        await api.createTicketCategory({ name: newCategoryName });
        setNewCategoryName('');
        loadConfig();
    };

    const createPriority = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newPriorityName.trim() || !newPrioritySla) return;
        await api.createTicketPriority({ name: newPriorityName, sla_minutes: Number(newPrioritySla) });
        setNewPriorityName('');
        setNewPrioritySla('');
        loadConfig();
    };

    const [showCreateModal, setShowCreateModal] = useState(false);

    // ---------- Renderers ----------

    const renderLoadingState = () => (
        <div className="p-12 text-center text-gray-500 animate-pulse font-bold">Cargando...</div>
    );

    const renderForbidden = () => (
        <div className="p-12 flex flex-col items-center justify-center text-center gap-3 text-gray-500">
            <ShieldAlert size={40} className="text-red-300" />
            <p className="font-bold text-gray-700">No tienes permiso para ver esta información.</p>
        </div>
    );

    const renderError = (onRetry: () => void) => (
        <div className="p-12 flex flex-col items-center justify-center text-center gap-3 text-gray-500">
            <WifiOff size={40} className="text-gray-300" />
            <p className="font-bold text-gray-700">No se pudo cargar la información.</p>
            <button onClick={onRetry} className="text-xs font-bold text-indigo-600 hover:underline">Reintentar</button>
        </div>
    );

    const renderDashboard = () => {
        if (dashboardState === 'loading' || dashboardState === 'idle') return renderLoadingState();
        if (dashboardState === 'forbidden') return renderForbidden();
        if (dashboardState === 'error') return renderError(loadDashboard);
        if (!dashboard) return null;

        return (
            <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard title="Total Tickets" value={dashboard.total} icon={TicketIcon} color="bg-indigo-500" />
                    <StatCard title="Nuevos" value={dashboard.new} icon={AlertCircle} color="bg-blue-500" />
                    <StatCard title="En Proceso" value={dashboard.in_progress} icon={Clock} color="bg-amber-500" />
                    <StatCard title="Completados" value={dashboard.completed} icon={CheckCircle} color="bg-green-500" />
                    <StatCard title="Cancelados" value={dashboard.cancelled} icon={XCircle} color="bg-gray-500" />
                    <StatCard title="Vencidos" value={dashboard.overdue} icon={Clock} color="bg-red-500" />
                    <StatCard title="Sin Responsable" value={dashboard.unassigned} icon={User} color="bg-orange-500" />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white rounded-xl shadow-sm border p-6">
                        <h3 className="text-sm font-black text-gray-800 uppercase tracking-wider mb-4">Distribución por Prioridad</h3>
                        <div className="space-y-2">
                            {dashboard.by_priority.length === 0 && <p className="text-xs text-gray-400 italic">Sin datos</p>}
                            {dashboard.by_priority.map((row) => (
                                <div key={row.priority_id} className="flex items-center justify-between text-sm">
                                    <span className="text-gray-600">{row.name ?? `#${row.priority_id}`}</span>
                                    <span className="font-bold text-gray-900">{row.count}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-sm border p-6">
                        <h3 className="text-sm font-black text-gray-800 uppercase tracking-wider mb-4">Carga Activa por Responsable</h3>
                        <div className="space-y-2">
                            {dashboard.workload_by_responsable.length === 0 && <p className="text-xs text-gray-400 italic">Sin datos</p>}
                            {dashboard.workload_by_responsable.map((row) => (
                                <div key={row.responsable_id} className="flex items-center justify-between text-sm">
                                    <span className="text-gray-600">{row.name ?? `#${row.responsable_id}`}</span>
                                    <span className="font-bold text-gray-900">{row.count}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border p-6">
                    <h3 className="text-sm font-black text-gray-800 uppercase tracking-wider mb-4">Tickets Recientes</h3>
                    <div className="space-y-3">
                        {dashboard.recent.length === 0 && <p className="text-xs text-gray-400 italic">No hay tickets recientes</p>}
                        {dashboard.recent.map((t) => (
                            <div
                                key={t.id}
                                className="flex items-center gap-4 p-3 hover:bg-gray-50 rounded-lg border border-transparent hover:border-gray-100 transition-all cursor-pointer"
                                onClick={() => openTicketDetail(t.id)}
                            >
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center border ${statusBadgeClasses(t.status)}`}>
                                    <TicketIcon size={18} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-gray-900 truncate">{t.subject}</p>
                                    <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                                        <span>{t.ticket_number}</span>
                                        {t.lead_name && <><span>&middot;</span><span>{t.lead_name}</span></>}
                                        {t.responsable_name && <><span>&middot;</span><span>{t.responsable_name}</span></>}
                                    </div>
                                </div>
                                <ChevronRight size={16} className="text-gray-400" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    };

    const renderPagination = () => (
        <div className="flex items-center justify-between px-4 py-3 border-t bg-white">
            <p className="text-xs text-gray-500">
                {listMeta.total} ticket{listMeta.total === 1 ? '' : 's'} &middot; página {listMeta.current_page} de {listMeta.last_page}
            </p>
            <div className="flex gap-2">
                <button
                    disabled={filters.page <= 1}
                    onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))}
                    className="p-1.5 rounded-lg border text-gray-600 disabled:opacity-40 hover:bg-gray-50"
                    aria-label="Página anterior"
                >
                    <ChevronLeft size={16} />
                </button>
                <button
                    disabled={filters.page >= listMeta.last_page}
                    onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))}
                    className="p-1.5 rounded-lg border text-gray-600 disabled:opacity-40 hover:bg-gray-50"
                    aria-label="Página siguiente"
                >
                    <ChevronRight size={16} />
                </button>
            </div>
        </div>
    );

    const renderList = () => (
        <div className="space-y-4">
            <div className="bg-white p-4 rounded-xl shadow-sm border flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[240px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                        type="text"
                        placeholder="Buscar por número, asunto o lead..."
                        className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                        value={filters.search}
                        onChange={(e) => setFilters({ ...filters, search: e.target.value, page: 1 })}
                    />
                </div>

                <select
                    className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    value={filters.status}
                    onChange={(e) => setFilters({ ...filters, status: e.target.value, page: 1 })}
                >
                    <option value="all">Todos los estados</option>
                    <option value="New">{getTicketStatusLabel('New')}</option>
                    <option value="InProgress">{getTicketStatusLabel('InProgress')}</option>
                    <option value="Completed">{getTicketStatusLabel('Completed')}</option>
                    <option value="Cancelled">{getTicketStatusLabel('Cancelled')}</option>
                </select>

                <select
                    className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    value={filters.category_id}
                    onChange={(e) => setFilters({ ...filters, category_id: e.target.value, page: 1 })}
                >
                    <option value="all">Todas las categorías</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>

                <select
                    className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    value={filters.priority_id}
                    onChange={(e) => setFilters({ ...filters, priority_id: e.target.value, page: 1 })}
                >
                    <option value="all">Todas las prioridades</option>
                    {priorities.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>

                {responsableOptions.length > 0 && (
                    <select
                        className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm disabled:opacity-50"
                        value={filters.responsable_id}
                        disabled={filters.unassigned_only}
                        // "Sin responsable" and a specific responsable are mutually exclusive
                        // (the backend itself rejects the combination with a 422) — picking one
                        // here always clears the other rather than letting them coexist.
                        onChange={(e) => setFilters({ ...filters, responsable_id: e.target.value, unassigned_only: false, page: 1 })}
                    >
                        <option value="all">Todos los responsables</option>
                        {responsableOptions.map((r) => (
                            <option key={r.id} value={r.id}>{r.name ?? `#${r.id}`}</option>
                        ))}
                    </select>
                )}

                <button
                    onClick={() => setFilters({ ...filters, unassigned_only: !filters.unassigned_only, responsable_id: 'all', page: 1 })}
                    className={`px-3 py-2 rounded-lg text-xs font-bold border transition-colors ${filters.unassigned_only ? 'bg-orange-50 border-orange-200 text-orange-700' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}
                >
                    Sin responsable
                </button>

                <button
                    onClick={() => setFilters({ ...filters, is_overdue: !filters.is_overdue, page: 1 })}
                    className={`px-3 py-2 rounded-lg text-xs font-bold border transition-colors ${filters.is_overdue ? 'bg-red-50 border-red-200 text-red-700' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}
                >
                    Vencidos
                </button>

                <input
                    type="date"
                    value={filters.date_from}
                    onChange={(e) => setFilters({ ...filters, date_from: e.target.value, page: 1 })}
                    className="bg-gray-50 border border-gray-200 rounded-lg px-2 py-2 text-xs"
                />
                <input
                    type="date"
                    value={filters.date_to}
                    onChange={(e) => setFilters({ ...filters, date_to: e.target.value, page: 1 })}
                    className="bg-gray-50 border border-gray-200 rounded-lg px-2 py-2 text-xs"
                />
            </div>

            <div className="flex flex-col lg:flex-row gap-6">
                <div className={`flex-1 min-w-0 ${selectedTicketId ? 'hidden lg:block' : ''}`}>
                    <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                        {(listState === 'loading' || listState === 'idle') && renderLoadingState()}
                        {listState === 'forbidden' && renderForbidden()}
                        {listState === 'error' && renderError(() => loadList(filters))}
                        {listState === 'empty' && (
                            <div className="p-12 text-center text-gray-400">No se encontraron tickets con los filtros actuales.</div>
                        )}
                        {listState === 'success' && (
                            <>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead className="bg-gray-50 border-b text-xs uppercase text-gray-500 font-bold">
                                            <tr>
                                                <th className="px-4 py-3">Ticket</th>
                                                <th className="px-4 py-3">Creado</th>
                                                <th className="px-4 py-3">Lead</th>
                                                <th className="px-4 py-3">Asunto</th>
                                                <th className="px-4 py-3">Categoría</th>
                                                <th className="px-4 py-3">Estado</th>
                                                <th className="px-4 py-3">Prioridad</th>
                                                <th className="px-4 py-3">Vencimiento</th>
                                                <th className="px-4 py-3">Responsable</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {tickets.map((t) => (
                                                <tr
                                                    key={t.id}
                                                    className={`hover:bg-indigo-50/50 transition-colors cursor-pointer ${selectedTicketId === t.id ? 'bg-indigo-50' : ''}`}
                                                    onClick={() => openTicketDetail(t.id)}
                                                >
                                                    <td className="px-4 py-3 text-xs font-mono font-bold text-gray-500">{t.ticket_number}</td>
                                                    <td className="px-4 py-3 text-xs text-gray-500">{format(new Date(t.created_at), 'dd/MM/yyyy HH:mm')}</td>
                                                    <td className="px-4 py-3 text-sm text-indigo-700 font-medium">{t.lead?.name ?? '—'}</td>
                                                    <td className="px-4 py-3 text-sm font-bold text-gray-900">{t.subject}</td>
                                                    {/* Final adversarial correction, Correction 1: `category` was missing from
                                                        `index()`'s own eager-load list, leaving this column (and LeadModal's own
                                                        ticket list) permanently blank. */}
                                                    <td className="px-4 py-3 text-xs text-gray-600">{t.category?.name ?? '—'}</td>
                                                    <td className="px-4 py-3">
                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusBadgeClasses(t.status)}`}>{getTicketStatusLabel(t.status)}</span>
                                                    </td>
                                                    <td className="px-4 py-3 text-xs text-gray-600">{t.priority?.name}</td>
                                                    <td className="px-4 py-3">
                                                        <span className={`text-xs ${t.is_overdue ? 'text-red-600 font-bold' : 'text-gray-500'}`}>
                                                            {t.due_date ? format(new Date(t.due_date), 'dd/MM/yyyy HH:mm') : '—'}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-gray-600">
                                                        {t.responsable?.name || <span className="italic text-gray-400">Sin asignar</span>}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                {renderPagination()}
                            </>
                        )}
                    </div>
                </div>

                {selectedTicketId !== null && renderDetail()}
            </div>
        </div>
    );

    const renderDetail = () => {
        const t = selectedTicket;
        return (
            <div className="w-full lg:w-[420px] bg-white border rounded-xl shadow-lg flex flex-col overflow-hidden">
                <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
                    <h4 className="font-bold text-gray-800 flex items-center gap-2">
                        <TicketIcon size={18} className="text-indigo-600" />
                        {t?.ticket_number ?? 'Ticket'}
                    </h4>
                    <button onClick={closeDetail} className="p-1.5 hover:bg-gray-200 rounded-lg text-gray-500">
                        <XCircle size={18} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-5">
                    {(detailState === 'loading' || detailState === 'idle') && renderLoadingState()}
                    {detailState === 'forbidden' && renderForbidden()}
                    {detailState === 'error' && renderError(() => loadDetail(selectedTicketId!))}

                    {detailState === 'success' && t && (
                        <>
                            <div>
                                <h3 className="text-lg font-black text-gray-900">{t.subject}</h3>
                                <p className="text-sm text-gray-600 mt-2 whitespace-pre-wrap bg-gray-50 p-3 rounded-lg border border-gray-100">
                                    {t.description || <span className="italic text-gray-400 text-xs">Sin descripción</span>}
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-3 text-xs">
                                <div><span className="text-gray-400 font-bold uppercase block">Categoría</span>{t.category?.name}</div>
                                <div><span className="text-gray-400 font-bold uppercase block">Prioridad</span>{t.priority?.name}</div>
                                <div>
                                    <span className="text-gray-400 font-bold uppercase block">Origen</span>
                                    <span className="flex items-center gap-1">{t.origin === 'system' ? <Settings size={11} /> : <User size={11} />}{t.origin}{t.source_channel ? ` · ${t.source_channel}` : ''}</span>
                                </div>
                                <div><span className="text-gray-400 font-bold uppercase block">Creado</span>{format(new Date(t.created_at), 'dd/MM/yyyy HH:mm')}</div>
                                <div>
                                    <span className="text-gray-400 font-bold uppercase block">Vencimiento</span>
                                    <span className={t.is_overdue ? 'text-red-600 font-bold' : ''}>{t.due_date ? format(new Date(t.due_date), 'dd/MM/yyyy HH:mm') : '—'}</span>
                                </div>
                                <div><span className="text-gray-400 font-bold uppercase block">Estado</span>
                                    <span className={`px-2 py-0.5 rounded-full border ${statusBadgeClasses(t.status)}`}>{getTicketStatusLabel(t.status)}</span>
                                </div>
                            </div>

                            <div>
                                <span className="text-gray-400 font-bold uppercase text-xs block mb-1">Lead asociado</span>
                                {t.lead ? (
                                    <button
                                        onClick={() => openLeadFicha(t.lead_id)}
                                        disabled={leadOpenLoading}
                                        className="text-sm font-bold text-indigo-600 hover:underline disabled:opacity-50"
                                    >
                                        {t.lead.name} {t.lead.last_name ?? ''}
                                    </button>
                                ) : (
                                    <span className="text-xs text-gray-400 italic">Sin lead asociado</span>
                                )}
                                {leadOpenError && <p className="text-xs text-amber-700 mt-1">{leadOpenError}</p>}
                            </div>

                            <div>
                                <span className="text-gray-400 font-bold uppercase text-xs block mb-1">Responsable</span>
                                <TicketResponsableSelect
                                    context={assignment.context}
                                    contextState={assignment.contextState === 'idle' ? 'loading' : assignment.contextState}
                                    currentResponsableName={t.responsable?.name ?? null}
                                    onChange={assignment.requestChange}
                                    disabled={assignment.submitting}
                                />
                                {assignment.error && (
                                    <p data-testid="assignment-error" role="alert" className="mt-2 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
                                        {assignment.error}
                                    </p>
                                )}
                            </div>

                            {canEditTicket && !['Completed', 'Cancelled'].includes(t.status) && (
                                <div className="flex gap-2">
                                    {t.status === 'New' && (
                                        <button onClick={() => handleStatusChange(t.id, 'InProgress')} className="flex-1 bg-indigo-600 text-white py-2 rounded-lg text-xs font-bold hover:bg-indigo-700">
                                            Empezar a tratar
                                        </button>
                                    )}
                                    <button onClick={() => handleStatusChange(t.id, 'Completed')} className="flex-1 bg-green-600 text-white py-2 rounded-lg text-xs font-bold hover:bg-green-700">
                                        Finalizar
                                    </button>
                                    <button onClick={() => setCancelModalOpen(true)} className="bg-red-50 text-red-700 border border-red-200 px-3 py-2 rounded-lg text-xs font-bold hover:bg-red-100">
                                        Cancelar
                                    </button>
                                </div>
                            )}

                            <hr className="border-gray-100" />

                            <div className="space-y-3">
                                <h5 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5"><MessageSquare size={13} /> Comentarios</h5>
                                <div className="space-y-2 max-h-48 overflow-y-auto">
                                    {t.comments?.length === 0 && <p className="text-xs text-gray-400 italic">Sin comentarios</p>}
                                    {t.comments?.map((c) => (
                                        <div key={c.id} className="bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                                            <div className="mb-1">
                                                <p className="font-bold text-indigo-700 text-[10px]">{getTicketCommentAuthorLabel(c)}</p>
                                                <p className="text-gray-400 text-[10px]">{getTicketCommentTimestampLabel(c.created_at)}</p>
                                            </div>
                                            <p className="text-xs text-gray-700">{c.comment}</p>
                                        </div>
                                    ))}
                                </div>
                                <div className="flex gap-2">
                                    <textarea
                                        value={newComment}
                                        onChange={(e) => setNewComment(e.target.value)}
                                        placeholder="Añadir comentario..."
                                        className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-xs min-h-[50px] resize-y"
                                    />
                                    <button onClick={submitComment} disabled={!newComment.trim()} className="bg-indigo-600 text-white px-3 rounded-lg text-xs font-bold disabled:opacity-50">Enviar</button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        );
    };

    const renderAdmin = () => {
        if (!canManageConfig) return renderForbidden();
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white rounded-xl shadow-sm border p-6">
                    <h3 className="font-bold text-gray-800 mb-4">Categorías de Ticket</h3>
                    <form onSubmit={createCategory} className="flex gap-2 mb-4">
                        <input value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} placeholder="Nueva categoría..." className="flex-1 border rounded-lg px-3 py-1.5 text-sm" />
                        <button type="submit" className="bg-indigo-600 text-white px-3 rounded-lg text-xs font-bold">Crear</button>
                    </form>
                    <div className="space-y-2">
                        {categories.map((c) => (
                            <div key={c.id} className="flex justify-between p-2.5 border rounded-lg text-sm">{c.name}</div>
                        ))}
                    </div>
                </div>
                <div className="bg-white rounded-xl shadow-sm border p-6">
                    <h3 className="font-bold text-gray-800 mb-4">Prioridades / SLA</h3>
                    <form onSubmit={createPriority} className="flex gap-2 mb-4">
                        <input value={newPriorityName} onChange={(e) => setNewPriorityName(e.target.value)} placeholder="Nombre" className="flex-1 border rounded-lg px-3 py-1.5 text-sm" />
                        <input value={newPrioritySla} onChange={(e) => setNewPrioritySla(e.target.value)} placeholder="SLA (min)" type="number" className="w-24 border rounded-lg px-3 py-1.5 text-sm" />
                        <button type="submit" className="bg-indigo-600 text-white px-3 rounded-lg text-xs font-bold">Crear</button>
                    </form>
                    <div className="space-y-2">
                        {priorities.map((p) => (
                            <div key={p.id} className="flex justify-between p-2.5 border rounded-lg text-sm">
                                <span>{p.name}</span><span className="text-gray-400 text-xs">{p.sla_minutes}m</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="h-full flex flex-col">
            <header className="flex flex-wrap items-center justify-between gap-4 mb-6">
                <div>
                    <h2 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                        <TicketIcon className="text-indigo-600" size={26} />
                        Tickets / Tasks
                    </h2>
                    <p className="text-gray-500 font-medium text-sm">Seguimiento operativo de leads y tareas</p>
                </div>
                {canCreate && (
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all"
                    >
                        <Plus size={18} /> Nuevo Ticket
                    </button>
                )}
            </header>

            <div className="flex gap-4 mb-6 border-b overflow-x-auto">
                {(['dashboard', 'list', ...(canManageConfig ? ['admin'] as const : [])] as const).map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`pb-3 px-2 text-sm font-bold whitespace-nowrap relative ${activeTab === tab ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                        {tab === 'dashboard' ? 'Dashboard' : tab === 'list' ? 'Listado' : 'Configuración'}
                        {activeTab === tab && <div className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-600 rounded-t-full" />}
                    </button>
                ))}
            </div>

            <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar">
                {activeTab === 'dashboard' && renderDashboard()}
                {activeTab === 'list' && renderList()}
                {activeTab === 'admin' && renderAdmin()}
            </div>

            <CreateTicketModal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                onSuccess={() => {
                    setShowCreateModal(false);
                    loadDashboard();
                    if (activeTab === 'list') loadList(filters);
                }}
            />

            <TicketAssignmentDialog
                ticketNumber={selectedTicket?.ticket_number ?? ''}
                pending={assignment.pending}
                error={assignment.error}
                submitting={assignment.submitting}
                canReassignLead={assignment.context?.capabilities.can_reassign_lead ?? false}
                onConfirm={assignment.confirm}
                onCancel={assignment.cancel}
            />

            {leadModalOpen && leadToOpen && (
                <LeadModal
                    isOpen={leadModalOpen}
                    onClose={() => { setLeadModalOpen(false); setLeadToOpen(null); }}
                    onSuccess={() => { setLeadModalOpen(false); setLeadToOpen(null); refreshAfterChange(); }}
                    leadToEdit={leadToOpen}
                    zIndexClass="z-[80]"
                />
            )}

            {cancelModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-xl shadow-lg w-full max-w-sm p-6">
                        <h2 className="text-xl font-bold mb-4">Cancelar Ticket</h2>
                        <textarea
                            value={cancelReason}
                            onChange={(e) => setCancelReason(e.target.value)}
                            placeholder="Motivo de la cancelación..."
                            className="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm min-h-[80px]"
                        />
                        <div className="flex justify-end gap-3 mt-6">
                            <button onClick={() => setCancelModalOpen(false)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-semibold text-sm">Volver</button>
                            <button onClick={submitCancel} className="px-4 py-2 bg-red-600 text-white rounded-lg font-semibold text-sm">Confirmar Cancelación</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Tickets;
