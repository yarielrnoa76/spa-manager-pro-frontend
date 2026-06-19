import React, { useState, useEffect } from "react";
import { formatDistanceToNow, format } from "date-fns";
import { es } from "date-fns/locale";
import { Bell, CheckCircle, Ticket as TicketIcon, Info, MessageSquare, Trash2, CheckSquare } from "lucide-react";
import { api } from "../services/api";
import { Notification } from "../types";

const NotificationsSettings: React.FC<{ isSuperAdmin?: boolean }> = ({ isSuperAdmin }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<"all" | "read" | "unread">("all");
  const [userIdFilter, setUserIdFilter] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  
  const [pagination, setPagination] = useState({ current_page: 1, last_page: 1, total: 0 });
  const [users, setUsers] = useState<any[]>([]);

  // Selection for bulk delete
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const fetchData = async (page = 1) => {
    setLoading(true);
    try {
      const data = await api.listAdminNotifications({ 
        page, 
        per_page: 15,
        status: statusFilter,
        user_id: userIdFilter,
        date_from: dateFrom,
        date_to: dateTo
      });
      setNotifications(data.data || []);
      setPagination({
        current_page: data.current_page || 1,
        last_page: data.last_page || 1,
        total: data.total || 0
      });
    } catch (error) {
      console.error("Failed to fetch admin notifications", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const usersData = await api.listUsers({ include_global: true });
      setUsers(usersData);
    } catch (error) {
      console.error("Failed to fetch users", error);
    }
  };

  useEffect(() => {
    if (isSuperAdmin) {
      fetchUsers();
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    if (isSuperAdmin) {
      fetchData(1);
    }
  }, [statusFilter, userIdFilter, dateFrom, dateTo, isSuperAdmin]);

  const handleDelete = async (id: number) => {
    if (!window.confirm("¿Estás seguro de eliminar esta notificación del sistema?")) return;
    try {
      await api.deleteAdminNotification(id);
      fetchData(pagination.current_page);
      setSelectedIds(prev => prev.filter(selectedId => selectedId !== id));
    } catch (error) {
      console.error("Failed to delete notification", error);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`¿Estás seguro de eliminar ${selectedIds.length} notificaciones seleccionadas? Esta acción no se puede deshacer.`)) return;
    
    try {
      await api.bulkDeleteAdminNotifications(selectedIds);
      setSelectedIds([]);
      fetchData(pagination.current_page);
    } catch (error) {
      console.error("Failed to bulk delete notifications", error);
    }
  };

  const toggleSelection = (id: number) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === notifications.length && notifications.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(notifications.map(n => n.id));
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "support_ticket_created": return <TicketIcon className="text-emerald-600" size={18} />;
      case "support_ticket_status_changed": return <CheckCircle className="text-amber-600" size={18} />;
      case "support_ticket_commented": return <MessageSquare className="text-blue-600" size={18} />;
      case "support_ticket_assigned":
      case "ticket_assigned": return <TicketIcon className="text-indigo-600" size={18} />;
      default: return <Info className="text-gray-400" size={18} />;
    }
  };

  if (!isSuperAdmin) {
    return <div className="p-4 text-center text-gray-500">Acceso denegado. Solo administradores.</div>;
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Administración de Notificaciones</h2>
          <p className="text-sm text-gray-600 mt-1">
            Supervisa y limpia las notificaciones antiguas de todos los usuarios del sistema.
          </p>
        </div>
        
        {selectedIds.length > 0 && (
          <button
            onClick={handleBulkDelete}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors shadow-sm"
          >
            <Trash2 size={16} /> Eliminar seleccionadas ({selectedIds.length})
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 bg-gray-50 p-4 rounded-lg border border-gray-100">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Estado</label>
          <select 
            className="w-full text-sm border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
          >
            <option value="all">Todos los estados</option>
            <option value="unread">No Leídas</option>
            <option value="read">Leídas</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Usuario</label>
          <select 
            className="w-full text-sm border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
            value={userIdFilter}
            onChange={(e) => setUserIdFilter(e.target.value)}
          >
            <option value="">Todos los usuarios</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Desde Fecha</label>
          <input 
            type="date"
            className="w-full text-sm border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Hasta Fecha</label>
          <input 
            type="date"
            className="w-full text-sm border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-4 py-3 text-left w-12">
                <input 
                  type="checkbox" 
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  checked={selectedIds.length === notifications.length && notifications.length > 0}
                  onChange={toggleSelectAll}
                />
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Detalle
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Usuario
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Fecha
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Estado
              </th>
              <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center">
                  <div className="inline-block w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                </td>
              </tr>
            ) : notifications.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  No se encontraron notificaciones con los filtros actuales.
                </td>
              </tr>
            ) : (
              notifications.map((n) => (
                <tr key={n.id} className="hover:bg-gray-50">
                  <td className="px-4 py-4 whitespace-nowrap">
                    <input 
                      type="checkbox" 
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      checked={selectedIds.includes(n.id)}
                      onChange={() => toggleSelection(n.id)}
                    />
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-1">{getIcon(n.type)}</div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{n.title}</p>
                        <p className="text-xs text-gray-500 line-clamp-1">{n.body}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{n.user?.name || "Desconocido"}</div>
                    <div className="text-xs text-gray-500">{n.user?.email || ""}</div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{format(new Date(n.created_at), "dd/MM/yyyy HH:mm")}</div>
                    <div className="text-xs text-gray-500">{formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: es })}</div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${n.read_at ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                      {n.read_at ? 'Leída' : 'No Leída'}
                    </span>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button 
                      onClick={() => handleDelete(n.id)}
                      className="text-red-600 hover:text-red-900 bg-red-50 hover:bg-red-100 p-2 rounded-lg transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {!loading && pagination.last_page > 1 && (
        <div className="flex justify-between items-center mt-4">
          <p className="text-sm text-gray-600">
            Página {pagination.current_page} de {pagination.last_page} ({pagination.total} en total)
          </p>
          <div className="flex gap-2">
            <button
              disabled={pagination.current_page === 1}
              onClick={() => fetchData(pagination.current_page - 1)}
              className="px-3 py-1 border rounded text-sm text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              Anterior
            </button>
            <button
              disabled={pagination.current_page === pagination.last_page}
              onClick={() => fetchData(pagination.current_page + 1)}
              className="px-3 py-1 border rounded text-sm text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationsSettings;
