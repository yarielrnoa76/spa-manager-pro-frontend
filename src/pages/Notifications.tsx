import React, { useState, useEffect } from "react";
import { formatDistanceToNow, format } from "date-fns";
import { es } from "date-fns/locale";
import { Bell, CheckCircle, Ticket as TicketIcon, Info, MessageSquare, Trash2, CheckSquare } from "lucide-react";
import { api } from "../services/api";
import { Notification } from "../types";
import { useNavigate } from "react-router-dom";

const Notifications: React.FC = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"all" | "read" | "unread">("all");
  const [pagination, setPagination] = useState({ current_page: 1, last_page: 1, total: 0 });

  const fetchNotifications = async (page = 1) => {
    setLoading(true);
    try {
      const data = await api.listNotifications({ page, status: statusFilter, per_page: 15 });
      setNotifications(data.notifications);
      if (data.pagination) setPagination(data.pagination);
    } catch (error) {
      console.error("Failed to fetch notifications", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications(1);
  }, [statusFilter]);

  const handleMarkAsRead = async (id: number) => {
    try {
      await api.markNotificationAsRead(id);
      fetchNotifications(pagination.current_page);
    } catch (error) {
      console.error("Failed to mark notification as read", error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await api.markAllNotificationsAsRead();
      fetchNotifications(pagination.current_page);
    } catch (error) {
      console.error("Failed to mark all as read", error);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("¿Estás seguro de eliminar esta notificación?")) return;
    try {
      await api.deleteNotification(id);
      fetchNotifications(pagination.current_page);
    } catch (error) {
      console.error("Failed to delete notification", error);
    }
  };

  const handleDeleteAll = async () => {
    if (!window.confirm("¿Estás seguro de eliminar todas las notificaciones? Esta acción no se puede deshacer.")) return;
    try {
      await api.deleteAllNotifications();
      fetchNotifications(1);
    } catch (error) {
      console.error("Failed to delete all notifications", error);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "support_ticket_created": return <TicketIcon className="text-emerald-600" size={20} />;
      case "support_ticket_status_changed": return <CheckCircle className="text-amber-600" size={20} />;
      case "support_ticket_commented": return <MessageSquare className="text-blue-600" size={20} />;
      case "support_ticket_assigned":
      case "ticket_assigned": return <TicketIcon className="text-indigo-600" size={20} />;
      default: return <Info className="text-gray-400" size={20} />;
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mis Notificaciones</h1>
          <p className="text-sm text-gray-600 mt-1">Administra tus alertas y mensajes del sistema.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleMarkAllAsRead}
            className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <CheckSquare size={16} /> Marcar todas leídas
          </button>
          <button
            onClick={handleDeleteAll}
            className="flex items-center gap-2 px-3 py-2 bg-white border border-red-200 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 hover:border-red-300 transition-colors"
          >
            <Trash2 size={16} /> Eliminar todas
          </button>
        </div>
      </div>

      <div className="bg-white border rounded-xl shadow-sm overflow-hidden mb-6">
        <div className="flex border-b">
          {["all", "unread", "read"].map((tab) => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab as any)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                statusFilter === tab
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              {tab === "all" && "Todas"}
              {tab === "unread" && "No Leídas"}
              {tab === "read" && "Leídas"}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="p-8 flex justify-center items-center">
            <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Bell size={32} className="text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-1">No hay notificaciones</h3>
            <p className="text-gray-500">No tienes notificaciones en esta categoría.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {notifications.map((n) => (
              <div
                key={n.id}
                className={`p-4 flex items-start gap-4 transition-colors hover:bg-gray-50 ${
                  !n.read_at ? "bg-indigo-50/20" : ""
                }`}
              >
                <div className="mt-1 flex-shrink-0 bg-white p-2 rounded-full border shadow-sm">
                  {getIcon(n.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <div
                      className="cursor-pointer"
                      onClick={async () => {
                        if (!n.read_at) await handleMarkAsRead(n.id);
                        if (n.url) navigate(n.url);
                      }}
                    >
                      <h4 className={`text-sm ${!n.read_at ? "font-bold text-gray-900" : "font-medium text-gray-700"}`}>
                        {n.title}
                        {!n.read_at && (
                          <span className="ml-2 inline-block w-2 h-2 bg-indigo-600 rounded-full"></span>
                        )}
                      </h4>
                      <p className="text-sm text-gray-600 mt-1">{n.body}</p>
                      <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                        <span>{formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: es })}</span>
                        <span>•</span>
                        <span>{format(new Date(n.created_at), "PPp", { locale: es })}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 sm:opacity-100 transition-opacity">
                      {!n.read_at && (
                        <button
                          onClick={() => handleMarkAsRead(n.id)}
                          className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="Marcar como leída"
                        >
                          <CheckSquare size={16} />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(n.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {pagination.last_page > 1 && (
        <div className="flex justify-between items-center">
          <p className="text-sm text-gray-600">
            Página {pagination.current_page} de {pagination.last_page} ({pagination.total} en total)
          </p>
          <div className="flex gap-2">
            <button
              disabled={pagination.current_page === 1}
              onClick={() => fetchNotifications(pagination.current_page - 1)}
              className="px-4 py-2 border rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Anterior
            </button>
            <button
              disabled={pagination.current_page === pagination.last_page}
              onClick={() => fetchNotifications(pagination.current_page + 1)}
              className="px-4 py-2 border rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Notifications;
