import React, { useState, useEffect } from 'react';
import {
    History,
    Search,
    Download,
    Trash2,
    Filter,
    User as UserIcon,
    Database,
    Eye,
    Clock,
    ChevronLeft,
    ChevronRight,
    AlertTriangle,
    MapPin,
    X
} from 'lucide-react';
import { api, ActivityLog } from '../services/api';
import { Branch } from '../types';

const LogManagement: React.FC = () => {
    const [logs, setLogs] = useState<ActivityLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    const [users, setUsers] = useState<any[]>([]);
    const [branches, setBranches] = useState<Branch[]>([]);

    const [filters, setFilters] = useState({
        user_id: '',
        event: '',
        model_type: '',
        branch_id: '',
        search: '',
    });

    const [exportDays, setExportDays] = useState(30);
    const [deleteAfter, setDeleteAfter] = useState(false);
    const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null);

    useEffect(() => {
        fetchFiltersData();
    }, []);

    useEffect(() => {
        fetchLogs();
    }, [currentPage, filters]);

    const fetchFiltersData = async () => {
        try {
            const [usersData, branchesData] = await Promise.all([
                api.listUsers(),
                api.listBranches()
            ]);
            setUsers(Array.isArray(usersData) ? usersData : []);
            setBranches(Array.isArray(branchesData) ? branchesData : []);
        } catch (error) {
            console.error('Error fetching filter data:', error);
        }
    };

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const data = await api.listLogs({
                ...filters,
                page: currentPage,
                user_id: filters.user_id ? parseInt(filters.user_id) : undefined,
                branch_id: filters.branch_id ? parseInt(filters.branch_id) : undefined
            });
            setLogs(data.data);
            setTotalPages(data.last_page);
        } catch (error) {
            console.error('Error fetching logs:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleExport = async () => {
        if (!window.confirm(`¿Seguro que deseas exportar los logs anteriores a ${exportDays} días? ${deleteAfter ? 'LOS LOGS SERÁN BORRADOS DE LA BASE DE DATOS.' : ''}`)) return;

        try {
            const blob = await api.exportLogs(exportDays, deleteAfter);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `audit_logs_${new Date().toISOString().split('T')[0]}.txt`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            if (deleteAfter) fetchLogs();
        } catch (error) {
            alert('Error en la exportación');
        }
    };

    const getEventBadge = (event: string) => {
        const colors: any = {
            created: 'bg-emerald-100 text-emerald-700 border-emerald-200',
            updated: 'bg-amber-100 text-amber-700 border-amber-200',
            deleted: 'bg-rose-100 text-rose-700 border-rose-200',
            login: 'bg-indigo-100 text-indigo-700 border-indigo-200',
            logout: 'bg-slate-100 text-slate-700 border-slate-200',
        };
        return (
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${colors[event] || 'bg-gray-100 text-gray-700'}`}>
                {event.toUpperCase()}
            </span>
        );
    };

    const formatModelPath = (path: string) => {
        const parts = path.split('\\');
        return parts[parts.length - 1];
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-20">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <History className="w-8 h-8 text-indigo-500" />
                        Auditoría y Logs de Actividad
                    </h1>
                    <p className="text-slate-500 mt-1">Seguimiento detallado de todas las operaciones del sistema.</p>
                </div>

                <div className="flex items-center gap-2">
                    <div className="flex items-center bg-slate-50 rounded-xl border border-slate-200 p-1 shadow-inner">
                        <select
                            value={exportDays}
                            onChange={(e) => setExportDays(parseInt(e.target.value))}
                            className="bg-transparent border-none text-sm focus:ring-0 text-slate-600 px-3 cursor-pointer font-medium"
                        >
                            <option value={7}>7 días</option>
                            <option value={30}>30 días</option>
                            <option value={90}>90 días</option>
                            <option value={365}>1 año</option>
                        </select>
                        <label className="flex items-center gap-2 text-xs text-slate-500 px-3 border-l border-slate-200 select-none">
                            <input
                                type="checkbox"
                                checked={deleteAfter}
                                onChange={(e) => setDeleteAfter(e.target.checked)}
                                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            Limpiar BD
                        </label>
                        <button
                            onClick={handleExport}
                            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-sm active:scale-95"
                        >
                            <Download className="w-4 h-4" />
                            Exportar
                        </button>
                    </div>
                </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Filter className="w-4 h-4" /> Filtros de Búsqueda
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 ml-1 flex items-center gap-1">
                            <UserIcon className="w-3 h-3" /> Usuario
                        </label>
                        <select
                            value={filters.user_id}
                            onChange={(e) => setFilters({ ...filters, user_id: e.target.value })}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                        >
                            <option value="">Cualquier usuario</option>
                            {users.map(u => (
                                <option key={u.id} value={u.id}>{u.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 ml-1 flex items-center gap-1">
                            <MapPin className="w-3 h-3" /> Sucursal (Branch)
                        </label>
                        <select
                            value={filters.branch_id}
                            onChange={(e) => setFilters({ ...filters, branch_id: e.target.value })}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                        >
                            <option value="">Todas las sucursales</option>
                            {branches.map(b => (
                                <option key={b.id} value={b.id}>{b.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 ml-1 flex items-center gap-1">
                            <Clock className="w-3 h-3" /> Evento
                        </label>
                        <select
                            value={filters.event}
                            onChange={(e) => setFilters({ ...filters, event: e.target.value })}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                        >
                            <option value="">Cualquier evento</option>
                            <option value="created">Creación</option>
                            <option value="updated">Modificación</option>
                            <option value="deleted">Eliminación</option>
                            <option value="login">Ingreso</option>
                        </select>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 ml-1 flex items-center gap-1">
                            <Search className="w-3 h-3" /> Búsqueda General
                        </label>
                        <input
                            type="text"
                            placeholder="Nombre, descripción, ID..."
                            value={filters.search}
                            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-medium"
                        />
                    </div>

                    <div className="flex items-end">
                        <button
                            onClick={() => { setFilters({ user_id: '', event: '', model_type: '', branch_id: '', search: '' }); setCurrentPage(1); }}
                            className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl px-4 py-2 font-medium text-sm transition-all flex items-center justify-center gap-2 h-[38px]"
                        >
                            <Trash2 className="w-4 h-4" />
                            Limpiar
                        </button>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-100">
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Fecha / Hora</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Usuario</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Sucursal</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Evento</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Objeto afectado</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan={6} className="px-6 py-4 bg-slate-50/30 h-14"></td>
                                    </tr>
                                ))
                            ) : logs.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-20 text-center">
                                        <History className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                                        <p className="text-slate-400 font-medium">No se encontraron registros de actividad.</p>
                                    </td>
                                </tr>
                            ) : (
                                logs.map((log) => (
                                    <tr key={log.id} className="hover:bg-slate-50/80 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-medium text-slate-700">{new Date(log.created_at).toLocaleDateString()}</span>
                                                <span className="text-[11px] text-slate-400 font-mono">{new Date(log.created_at).toLocaleTimeString()}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center text-xs font-bold text-indigo-700 shadow-sm border border-indigo-200">
                                                    {log.user?.name.substring(0, 2).toUpperCase() || '??'}
                                                </div>
                                                <span className="text-sm font-bold text-slate-700">{log.user?.name || 'Sistema'}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-xs px-2 py-1 bg-slate-100 text-slate-600 rounded-md border border-slate-200 flex items-center gap-1 w-fit">
                                                <MapPin className="w-3 h-3" /> {log.branch?.name || '—'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            {getEventBadge(log.event)}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold text-slate-800">{log.subject_label || formatModelPath(log.model_type)}</span>
                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                    <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">{formatModelPath(log.model_type)}</span>
                                                    <span className="bg-slate-50 text-slate-400 px-1.5 py-0.5 rounded text-[10px] border border-slate-100 font-mono">ID {log.model_id}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={() => setSelectedLog(log)}
                                                className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-xl transition-all border border-transparent hover:border-slate-200 hover:shadow-sm"
                                            >
                                                <Eye className="w-5 h-5" />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
                    <p className="text-sm text-slate-500">
                        Mostrando logs <span className="font-bold text-slate-800">{logs.length}</span> en página <span className="font-bold text-slate-800">{currentPage}</span>
                    </p>
                    <div className="flex gap-2">
                        <button
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(currentPage - 1)}
                            className="flex items-center gap-1 px-3 py-1.5 border border-slate-200 rounded-xl hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-all text-sm font-medium text-slate-600 shadow-sm"
                        >
                            <ChevronLeft className="w-4 h-4" /> Anterior
                        </button>
                        <div className="flex items-center px-4 text-sm font-bold text-indigo-600 bg-white border border-slate-200 rounded-xl shadow-sm">
                            {currentPage} / {totalPages}
                        </div>
                        <button
                            disabled={currentPage === totalPages}
                            onClick={() => setCurrentPage(currentPage + 1)}
                            className="flex items-center gap-1 px-3 py-1.5 border border-slate-200 rounded-xl hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-all text-sm font-medium text-slate-600 shadow-sm"
                        >
                            Siguiente <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            {selectedLog && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in zoom-in duration-200">
                    <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border border-slate-200 transform transition-all">
                        <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-indigo-50 rounded-2xl border border-indigo-100">
                                    <Eye className="w-7 h-7 text-indigo-600" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-slate-800 tracking-tight">Detalle de Actividad #{selectedLog.id}</h3>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        {getEventBadge(selectedLog.event)}
                                        <span className="text-xs text-slate-500 font-bold uppercase tracking-widest">{formatModelPath(selectedLog.model_type)}</span>
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedLog(null)}
                                className="w-10 h-10 flex items-center justify-center hover:bg-rose-50 border border-transparent hover:border-rose-100 rounded-2xl transition-all shadow-none hover:shadow-sm group/close"
                                title="Cerrar detalles"
                            >
                                <X className="w-6 h-6 text-slate-400 group-hover/close:text-rose-500 transition-colors" />
                            </button>
                        </div>

                        <div className="p-8 overflow-y-auto space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-4">
                                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2 mb-4">
                                        <div className="w-1.5 h-1.5 bg-rose-400 rounded-full" />
                                        Valores Anteriores
                                    </h4>
                                    <div className="relative group">
                                        <div className="absolute -inset-1 bg-gradient-to-r from-red-50 to-rose-50 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
                                        <pre className="relative bg-slate-900 text-rose-300 p-6 rounded-2xl text-[11px] overflow-x-auto border border-slate-800 shadow-2xl min-h-[200px] font-mono leading-relaxed">
                                            {selectedLog.old_values ? JSON.stringify(selectedLog.old_values, null, 2) : '// Sin historial (Creación)'}
                                        </pre>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2 mb-4">
                                        <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                                        Valores Nuevos
                                    </h4>
                                    <div className="relative group">
                                        <div className="absolute -inset-1 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
                                        <pre className="relative bg-slate-900 text-emerald-300 p-6 rounded-2xl text-[11px] overflow-x-auto border border-slate-800 shadow-2xl min-h-[200px] font-mono leading-relaxed">
                                            {selectedLog.new_values ? JSON.stringify(selectedLog.new_values, null, 2) : '// Sin datos (Eliminación)'}
                                        </pre>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-slate-50 p-6 rounded-[24px] border border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">IP ORIGEN</p>
                                    <p className="text-sm font-mono text-slate-700 font-bold">{selectedLog.ip_address}</p>
                                </div>
                                <div className="lg:col-span-2">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">USER AGENT</p>
                                    <p className="text-[11px] text-slate-500 leading-tight italic">{selectedLog.user_agent}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">SUCURSAL</p>
                                    <p className="text-sm font-bold text-slate-700">{selectedLog.branch?.name || 'Global'}</p>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 border-t border-slate-100 flex items-center justify-end bg-slate-50/30">
                            <button
                                onClick={() => setSelectedLog(null)}
                                className="px-8 py-3 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 rounded-2xl font-bold text-sm transition-all shadow-sm active:scale-95 flex items-center gap-2"
                            >
                                <X className="w-4 h-4" />
                                Cerrar Ventana
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LogManagement;
