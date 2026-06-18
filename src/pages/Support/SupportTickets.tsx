import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Filter, Ticket, Clock, CheckCircle, Activity } from 'lucide-react';
import { api } from "../../services/api";
import { SupportTicket } from "../../types/support";
import CreateTicketModal from "../../components/Support/CreateTicketModal";
import { UserData } from "../../App";

interface Props {
  user: UserData | null;
}

const SupportTickets: React.FC<Props> = ({ user }) => {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    priority_id: '',
    type_id: '',
    assigned_to: '',
    trashed: false,
  });

  const [priorities, setPriorities] = useState<any[]>([]);
  const [types, setTypes] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const activeFilters = Object.fromEntries(
        Object.entries(filters).filter(([_, v]) => v !== '' && v !== false)
      );

      const [ticketsRes, summaryRes, prioritiesRes] = await Promise.all([
        api.listSupportTickets(activeFilters),
        api.getSupportTicketDashboardSummary(activeFilters),
        // Quick fetch for dropdowns if empty
        priorities.length === 0 ? api.listSupportTicketPriorities() : Promise.resolve(priorities),
      ]);
      setTickets(ticketsRes.data || []);
      setSummary(summaryRes);
      if (prioritiesRes && !Array.isArray(prioritiesRes)) {
         setPriorities(prioritiesRes.data || []);
      } else {
         setPriorities(prioritiesRes as any);
      }
      
      if (types.length === 0) {
        const typesRes = await api.listSupportTicketTypes();
        setTypes(typesRes.data || typesRes as any);
        const usersRes = await api.getSupportTicketAssignableUsers();
        setUsers(usersRes.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [filters]);

  return (
    <div className="flex flex-col h-full space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Ticket className="text-indigo-600" /> Soporte Técnico
          </h1>
          <p className="text-sm text-gray-500 mt-1">Gestione sus reportes y solicitudes de soporte.</p>
        </div>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
        >
          <Plus size={18} />
          <span>Nuevo Ticket</span>
        </button>
      </div>

      {/* Dashboard Summary Widgets */}
      {summary && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center shrink-0">
              <Activity size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Tickets Abiertos</p>
              <p className="text-2xl font-bold text-gray-900">{summary.open_tickets}</p>
            </div>
          </div>
          <div className="bg-white p-4 rounded-xl border shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center shrink-0">
              <CheckCircle size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Tickets Completados</p>
              <p className="text-2xl font-bold text-gray-900">{summary.completed_tickets}</p>
            </div>
          </div>
          <div className="bg-white p-4 rounded-xl border shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-red-50 text-red-600 rounded-full flex items-center justify-center shrink-0">
              <CheckCircle size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Tickets Descartados</p>
              <p className="text-2xl font-bold text-gray-900">{summary.dismissed_tickets}</p>
            </div>
          </div>
          <div className="bg-white p-4 rounded-xl border shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center shrink-0">
              <Clock size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Resolución Promedio</p>
              <p className="text-2xl font-bold text-gray-900">{summary.avg_resolution_time_minutes} min</p>
            </div>
          </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white p-4 rounded-xl border shadow-sm">
              <p className="text-sm text-gray-500 font-medium mb-2">Por Prioridad</p>
              <div className="space-y-1.5">
                {summary.by_priority?.map((p: any) => (
                  <div key={p.support_ticket_priority_id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.priority?.color }}></span>
                      <span className="text-gray-600">{p.priority?.name || 'Otro'}</span>
                    </div>
                    <span className="font-semibold text-gray-900">{p.count}</span>
                  </div>
                ))}
                {(!summary.by_priority || summary.by_priority.length === 0) && (
                  <span className="text-xs text-gray-400">Sin datos</span>
                )}
              </div>
            </div>
            <div className="bg-white p-4 rounded-xl border shadow-sm">
              <p className="text-sm text-gray-500 font-medium mb-2">Por Tipo</p>
              <div className="space-y-1.5">
                {summary.by_type?.map((t: any) => (
                  <div key={t.support_ticket_type_id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.type?.color }}></span>
                      <span className="text-gray-600">{t.type?.name || 'Otro'}</span>
                    </div>
                    <span className="font-semibold text-gray-900">{t.count}</span>
                  </div>
                ))}
                {(!summary.by_type || summary.by_type.length === 0) && (
                  <span className="text-xs text-gray-400">Sin datos</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Buscar por número o asunto..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none bg-gray-50"
            />
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="px-3 py-2 border rounded-lg text-sm bg-gray-50 focus:ring-2 focus:ring-indigo-600 outline-none min-w-[140px]"
            >
              <option value="">Cualquier estado</option>
              <option value="new">Nuevo</option>
              <option value="in_progress">En Proceso</option>
              <option value="completed">Completado</option>
              <option value="dismissed">Descartado</option>
              <option value="reopened">Reabierto</option>
            </select>
            
            <select
              value={filters.priority_id}
              onChange={(e) => setFilters({ ...filters, priority_id: e.target.value })}
              className="px-3 py-2 border rounded-lg text-sm bg-gray-50 focus:ring-2 focus:ring-indigo-600 outline-none min-w-[140px]"
            >
              <option value="">Cualquier prioridad</option>
              {priorities.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>

            <select
              value={filters.type_id}
              onChange={(e) => setFilters({ ...filters, type_id: e.target.value })}
              className="px-3 py-2 border rounded-lg text-sm bg-gray-50 focus:ring-2 focus:ring-indigo-600 outline-none min-w-[140px]"
            >
              <option value="">Cualquier tipo</option>
              {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>

            <select
              value={filters.assigned_to}
              onChange={(e) => setFilters({ ...filters, assigned_to: e.target.value })}
              className="px-3 py-2 border rounded-lg text-sm bg-gray-50 focus:ring-2 focus:ring-indigo-600 outline-none min-w-[140px]"
            >
              <option value="">Cualquier asignado</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Tickets List (Placeholder) */}
      <div className="flex-1 bg-white border rounded-xl shadow-sm overflow-hidden flex flex-col">
        {loading ? (
          <div className="flex-1 flex items-center justify-center text-gray-500">Cargando tickets...</div>
        ) : tickets.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Ticket</th>
                  <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Asunto</th>
                  <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Estado</th>
                  <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Prioridad</th>
                  <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Asignado a</th>
                  <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actualizado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tickets.map(ticket => (
                  <tr key={ticket.id} onClick={() => navigate(`/support-tickets/${ticket.id}`)} className="hover:bg-gray-50 cursor-pointer transition">
                    <td className="p-4 font-medium text-indigo-600">{ticket.ticket_number}</td>
                    <td className="p-4 text-gray-900">{ticket.subject}</td>
                    <td className="p-4">
                      <span className="px-2 py-1 text-xs font-medium bg-gray-100 rounded-full">{ticket.status}</span>
                    </td>
                    <td className="p-4">
                      {ticket.priority && (
                        <span className="px-2 py-1 text-xs font-medium rounded-full text-white" style={{ backgroundColor: ticket.priority.color }}>
                          {ticket.priority.name}
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-gray-600 text-sm">{ticket.assignee?.name || '—'}</td>
                    <td className="p-4 text-gray-500 text-sm">{new Date(ticket.updated_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-500 p-8">
            <Ticket size={48} className="text-gray-300 mb-4" />
            <p className="text-lg font-medium text-gray-900">No hay tickets</p>
            <p className="text-sm mt-1">No se encontraron tickets con los filtros actuales.</p>
          </div>
        )}
      </div>

      {isCreateModalOpen && (
        <CreateTicketModal
          userPermissions={user?.permissions || []}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={() => {
            setIsCreateModalOpen(false);
            fetchData();
          }}
        />
      )}
    </div>
  );
};

export default SupportTickets;
