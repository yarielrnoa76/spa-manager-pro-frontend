import React, { useState, useEffect } from "react";
import { Search, Filter, MessageSquare, Star, Circle, Bot, AlertCircle, User } from "lucide-react";
import { api } from "../services/api";
import { Conversation } from "../types";
import { ConversationChat } from "../components/ConversationChat";
import { Link } from "react-router-dom";

export default function CommunicationCenter({ user }: { user: any }) {
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);

    // Filters
    const [statusFilter, setStatusFilter] = useState("");
    const [search, setSearch] = useState("");
    const [unreadOnly, setUnreadOnly] = useState(false);
    const [botEnabled, setBotEnabled] = useState("");

    const [pagination, setPagination] = useState({ current_page: 1, last_page: 1 });

    const loadConversations = async (page = 1) => {
        setLoading(true);
        try {
            const res = await api.listConversations({
                page,
                status: statusFilter,
                search,
                unread_only: unreadOnly ? 1 : undefined,
                bot_enabled: botEnabled
            });
            setConversations(res.data);
            setPagination({ current_page: page, last_page: res.last_page });
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            loadConversations(1);
        }, 500);
        return () => clearTimeout(delayDebounceFn);
    }, [search, statusFilter, unreadOnly, botEnabled]);

    // Optional: Setup a polling for new messages / updates on list
    useEffect(() => {
        const interval = setInterval(() => {
            loadConversations(pagination.current_page);
        }, 15000); // Poll every 15s
        return () => clearInterval(interval);
    }, [pagination.current_page, search, statusFilter, unreadOnly, botEnabled]);

    const activeConv = conversations.find(c => c.id === selectedId);

    const toggleImportantFromList = async (e: React.MouseEvent, id: number) => {
        e.stopPropagation();
        try {
            await api.toggleConversationImportant(id);
            setConversations(prev => prev.map(c => c.id === id ? { ...c, is_important: !c.is_important } : c));
        } catch (error) {
            console.error(error);
        }
    }

    return (
        <div className="h-full flex flex-col md:flex-row bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {/* PANEL IZQUIERDO: Listado */}
            <div className={`md:w-80 lg:w-96 flex flex-col border-r border-gray-100 ${selectedId ? 'hidden md:flex' : 'flex'}`}>
                {/* Cabecera & Filtros */}
                <div className="p-4 border-b border-gray-100 bg-gray-50/50">
                    <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2 mb-4">
                        <MessageSquare className="text-indigo-600" size={20} />
                        Live Chat
                    </h2>

                    <div className="relative mb-3">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input
                            type="text"
                            placeholder="Buscar por nombre o celular..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full bg-white border border-gray-200 rounded-xl py-2 pl-9 pr-4 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                    </div>

                    <div className="flex gap-2 text-xs overflow-x-auto pb-1 custom-scrollbar">
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="bg-white border text-gray-700 border-gray-200 rounded-lg px-2 py-1 outline-none"
                        >
                            <option value="">Todos los Estados</option>
                            <option value="open">Abiertos</option>
                            <option value="pending">Pendientes</option>
                            <option value="resolved">Resueltos</option>
                        </select>
                        <select
                            value={botEnabled}
                            onChange={(e) => setBotEnabled(e.target.value)}
                            className="bg-white border text-gray-700 border-gray-200 rounded-lg px-2 py-1 outline-none"
                        >
                            <option value="">Bot: Todos</option>
                            <option value="1">Bot Activo</option>
                            <option value="0">Toma Humana</option>
                        </select>
                        <label className="flex items-center gap-1.5 cursor-pointer bg-white border border-gray-200 rounded-lg px-2 py-1 select-none">
                            <input type="checkbox" checked={unreadOnly} onChange={() => setUnreadOnly(!unreadOnly)} className="accent-indigo-600 rounded" />
                            <span className="text-gray-600 font-medium">Solo no leídos</span>
                        </label>
                    </div>
                </div>

                {/* Listado */}
                <div className="flex-1 overflow-y-auto">
                    {loading && conversations.length === 0 ? (
                        <div className="p-8 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>
                    ) : conversations.length === 0 ? (
                        <div className="p-8 text-center text-gray-400 text-sm flex flex-col items-center">
                            <AlertCircle size={24} className="mb-2 opacity-50" />
                            No se encontraron conversaciones.
                        </div>
                    ) : (
                        <ul className="divide-y divide-gray-100">
                            {conversations.map(conv => {
                                const isUnread = conv.unread_count > 0;
                                return (
                                    <li
                                        key={conv.id}
                                        onClick={() => setSelectedId(conv.id)}
                                        className={`p-4 cursor-pointer hover:bg-indigo-50/50 transition-colors border-l-4 ${selectedId === conv.id ? 'bg-indigo-50/50 border-indigo-600' : 'border-transparent'} ${isUnread ? 'bg-indigo-50/20' : ''}`}
                                    >
                                        <div className="flex justify-between items-start mb-1">
                                            <div className="flex items-center gap-2 overflow-hidden">
                                                <h4 className={`text-sm truncate ${isUnread ? 'font-black text-gray-900' : 'font-bold text-gray-700'}`}>
                                                    {conv.contact_name || conv.contact_phone}
                                                </h4>
                                                {conv.bot_enabled && <span title="Bot Activo"><Bot size={14} className="text-indigo-600 shrink-0" /></span>}
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <button onClick={(e) => toggleImportantFromList(e, conv.id)} className="text-gray-300 hover:text-yellow-400 focus:outline-none transition-colors">
                                                    <Star size={14} className={conv.is_important ? "fill-yellow-400 text-yellow-400" : ""} />
                                                </button>
                                                <span className="text-[10px] text-gray-400 font-semibold whitespace-nowrap">
                                                    {new Date(conv.last_message_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex justify-between items-center mt-1.5">
                                            <p className={`text-xs truncate max-w-[85%] ${isUnread ? 'font-bold text-gray-800' : 'text-gray-500'}`}>
                                                {conv.last_message_preview || "..."}
                                            </p>
                                            {isUnread && (
                                                <span className="bg-indigo-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 min-w-[20px] text-center">
                                                    {conv.unread_count}
                                                </span>
                                            )}
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            </div>

            {/* PANEL CENTRAL: Conversación Chat */}
            <div className={`flex-1 flex flex-col ${!selectedId ? 'hidden md:flex bg-gray-50 items-center justify-center' : ''}`}>
                {!selectedId ? (
                    <div className="text-center text-gray-400">
                        <MessageSquare className="mx-auto text-gray-200 mb-4" size={64} />
                        <h3 className="text-lg font-bold text-gray-600">Ninguna conversación seleccionada</h3>
                        <p className="text-sm">Selecciona una conversación a la izquierda para comenzar a chatear.</p>
                    </div>
                ) : (
                    <>
                        {/* Botón Volver solo visible en móvil */}
                        <div className="md:hidden p-2 border-b border-gray-200 bg-white">
                            <button onClick={() => setSelectedId(null)} className="text-sm font-bold text-indigo-600 flex items-center gap-1">
                                ← Volver a la lista
                            </button>
                        </div>
                        <ConversationChat key={selectedId} conversationId={selectedId} user={user} />
                    </>
                )}
            </div>

            {/* PANEL DERECHO: Acciones / Detalles de Lead */}
            {selectedId && activeConv && (
                <div className="hidden lg:flex w-72 flex-col border-l border-gray-100 bg-white p-6 overflow-y-auto">
                    <h3 className="font-bold text-gray-900 border-b pb-4 mb-4 flex items-center gap-2">
                        <User size={18} className="text-indigo-600" /> Detalle del Contacto
                    </h3>

                    <div className="space-y-4">
                        <div>
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Nombre</span>
                            <div className="text-sm font-bold text-gray-800">{activeConv.contact_name || 'Sin nombre'}</div>
                        </div>
                        <div>
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Teléfono</span>
                            <div className="text-sm font-medium text-gray-700 font-mono bg-gray-50 px-2 py-1 rounded inline-block">
                                {activeConv.contact_phone}
                            </div>
                        </div>
                        {activeConv.branch && (
                            <div>
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Sucursal Detectada</span>
                                <div className="text-xs font-semibold px-2 py-1 bg-indigo-50 text-indigo-700 rounded-md inline-block">
                                    {activeConv.branch.name}
                                </div>
                            </div>
                        )}
                        <div>
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Asignado a</span>
                            <div className="text-sm text-gray-700 flex items-center gap-2">
                                <Circle size={8} className={activeConv.assigned_user_id ? "fill-green-400 text-green-400" : "fill-gray-300 text-gray-300"} />
                                {activeConv.assignedUser?.name || 'Round Robin (Pendiente)'}
                            </div>
                        </div>

                        {activeConv.lead_id ? (
                            <div className="pt-4 border-t mt-4">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-2">Lead Relacionado</span>
                                <Link to={`/leads?id=${activeConv.lead_id}`} className="block w-full text-center text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 py-2 rounded-lg transition-colors border border-indigo-100">
                                    Ver Lead Completo
                                </Link>
                            </div>
                        ) : (
                            <div className="pt-4 border-t mt-4 text-center">
                                <div className="text-[10px] text-yellow-600 bg-yellow-50 px-3 py-2 rounded-lg font-medium border border-yellow-100 leading-snug">
                                    Esta conversación aún no se ha enlazado a un lead formal. Esto suele hacerlo el bot al capturar datos.
                                </div>
                            </div>
                        )}

                    </div>
                </div>
            )}
        </div>
    );
}
