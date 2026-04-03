import React, { useState, useEffect } from "react";
import { MessageSquare, RotateCcw, Search, Eye, AlertCircle, RefreshCw } from "lucide-react";
import { api } from "../services/api";
import { Conversation, ConversationMessage } from "../types";

export default function ChatAdmin({ user }: { user: any }) {
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);

    const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
    const [messages, setMessages] = useState<ConversationMessage[]>([]);
    const [messagesLoading, setMessagesLoading] = useState(false);

    const loadConversations = async (p = 1) => {
        setLoading(true);
        try {
            const res = await api.listAdminConversations(p);
            if (p === 1) {
                setConversations(res.data);
            } else {
                setConversations(prev => [...prev, ...res.data]);
            }
            setHasMore(res.current_page < res.last_page);
        } catch (error) {
            console.error("Error loading chat admin", error);
            alert("Error o no tienes permisos (Se requiere SuperAdmin o Rol ConversationAdmin).");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadConversations(page);
    }, [page]);

    const handleSelectConv = async (c: Conversation) => {
        setSelectedConv(c);
        setMessagesLoading(true);
        try {
            const res = await api.getAdminConversationMessages(c.id);
            setMessages(res.data || []);
        } catch (e) {
            console.error(e);
        } finally {
            setMessagesLoading(false);
        }
    };

    const handleRestoreConv = async (id: number) => {
        if (!window.confirm("¿Restaurar esta conversación? Aparecerá de nuevo en los chats abiertos.")) return;
        try {
            await api.restoreAdminConversation(id);
            setConversations(prev => prev.map(c => c.id === id ? { ...c, deleted_at: null } : c));
            if (selectedConv?.id === id) {
                setSelectedConv({ ...selectedConv, deleted_at: null });
            }
            alert("Conversación restaurada.");
        } catch (e) {
            console.error(e);
        }
    };

    const handleRestoreMessage = async (id: number) => {
        if (!window.confirm("¿Restaurar este mensaje a la conversación?")) return;
        try {
            await api.restoreAdminMessage(id);
            setMessages(prev => prev.map(m => m.id === id ? { ...m, deleted_at: null } : m));
            alert("Mensaje restaurado.");
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <div className="h-full flex flex-col md:flex-row bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {/* PANEL IZQUIERDO */}
            <div className={`md:w-80 lg:w-96 flex flex-col border-r border-gray-100 ${selectedConv ? 'hidden md:flex' : 'flex'}`}>
                <div className="p-4 border-b border-gray-100 bg-gray-50/50">
                    <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2 mb-2">
                        <MessageSquare className="text-red-500" size={20} />
                        Chat Admin (Borrados)
                    </h2>
                    <p className="text-xs text-gray-500">
                        Gestiona y restaura conversaciones o mensajes eliminados.
                    </p>
                </div>
                <div className="flex-1 overflow-y-auto">
                    {loading && conversations.length === 0 ? (
                        <div className="p-8 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>
                    ) : conversations.length === 0 ? (
                        <div className="p-8 text-center text-gray-400 text-sm">No hay conversaciones.</div>
                    ) : (
                        <ul className="divide-y divide-gray-100">
                            {conversations.map(conv => (
                                <li
                                    key={conv.id}
                                    onClick={() => handleSelectConv(conv)}
                                    className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors border-l-4 ${selectedConv?.id === conv.id ? 'bg-gray-50 border-red-500' : 'border-transparent'}`}
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <div className="flex items-center gap-2">
                                            <h4 className="text-sm font-bold text-gray-700 truncate">
                                                {conv.contact_name || conv.contact_phone}
                                            </h4>
                                            {conv.deleted_at && <span className="bg-red-100 text-red-700 text-[10px] px-1.5 py-0.5 rounded font-bold">BORRADO</span>}
                                        </div>
                                    </div>
                                    <p className="text-xs text-gray-500 truncate mt-1">
                                        {conv.last_message_preview || "Ver mensajes..."}
                                    </p>
                                    <div className="flex justify-between mt-2 items-center">
                                         <span className="text-[10px] text-gray-400">
                                            {new Date(conv.updated_at).toLocaleDateString()}
                                        </span>
                                        {conv.deleted_at && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleRestoreConv(conv.id); }}
                                                className="text-xs flex items-center gap-1 text-indigo-600 hover:bg-indigo-50 px-2 py-1 rounded"
                                            >
                                                <RotateCcw size={12} /> Restaurar
                                            </button>
                                        )}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                    {hasMore && (
                        <div className="p-4 text-center">
                            <button onClick={() => setPage(page + 1)} className="text-sm font-medium text-indigo-600 hover:text-indigo-800">
                                Cargar más...
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* PANEL DERECHO */}
            <div className={`flex-1 flex flex-col ${!selectedConv ? 'hidden md:flex bg-gray-50 items-center justify-center' : 'bg-gray-50'}`}>
                {!selectedConv ? (
                    <div className="text-center text-gray-400">
                        <MessageSquare className="mx-auto text-gray-200 mb-4" size={64} />
                        <h3 className="text-lg font-bold text-gray-600">Ninguna conversación seleccionada</h3>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col h-full overflow-hidden">
                        {/* Header */}
                        <div className="bg-white border-b px-4 py-3 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-3">
                                <button onClick={() => setSelectedConv(null)} className="md:hidden text-indigo-600 font-medium text-sm mr-2 flex items-center">
                                    ←
                                </button>
                                <div>
                                    <h3 className="font-bold text-gray-800 text-sm">{selectedConv.contact_name || selectedConv.contact_phone}</h3>
                                    <div className="text-xs text-gray-500">
                                        {selectedConv.deleted_at ? <span className="text-red-500 font-bold">Conversación Eliminada</span> : <span className="text-green-500 font-bold">Conversación Activa</span>}
                                    </div>
                                </div>
                            </div>
                            {selectedConv.deleted_at && (
                                <button
                                    onClick={() => handleRestoreConv(selectedConv.id)}
                                    className="flex items-center gap-1 bg-white border border-gray-200 shadow-sm text-gray-700 text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-gray-50 transition"
                                >
                                    <RefreshCw size={14} className="text-indigo-600" /> Restaurar Chat
                                </button>
                            )}
                        </div>

                        {/* Messages */}
                        <div className="flex-1 p-4 overflow-y-auto w-full custom-scrollbar">
                            {messagesLoading ? (
                                <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>
                            ) : messages.length === 0 ? (
                                <div className="text-center text-gray-400 py-8 text-sm">No hay mensajes.</div>
                            ) : (
                                <div className="space-y-3">
                                    {messages.map(msg => {
                                        const isDeleted = !!msg.deleted_at;
                                        const isIncoming = msg.direction === 'inbound' || msg.sender_type === 'customer';
                                        return (
                                            <div key={msg.id} className={`flex ${isIncoming ? 'justify-start' : 'justify-end'}`}>
                                                <div className={`max-w-[75%] rounded-2xl px-4 py-2 ${isIncoming ? 'bg-white border text-gray-800' : 'bg-indigo-600 text-white'} ${isDeleted ? 'opacity-50 blur-[0.5px] hover:blur-none border-red-500 border-2 border-dashed' : ''} shadow-sm group`}>
                                                    {isDeleted && <div className="text-[9px] font-bold text-red-500 uppercase mb-1 flex items-center justify-between">
                                                        <span>Borrado</span>
                                                        <button onClick={() => handleRestoreMessage(msg.id)} className="bg-white text-indigo-600 px-2 py-0.5 rounded shadow-sm flex items-center gap-1 hover:bg-indigo-50">
                                                            <RotateCcw size={10} /> Restaurar
                                                        </button>
                                                    </div>}
                                                    <p className="text-[13px] whitespace-pre-wrap break-words">{msg.body}</p>
                                                    <div className={`text-[9px] mt-1 text-right font-medium ${isIncoming ? 'text-gray-400' : 'text-indigo-200'}`}>
                                                        {new Date(msg.created_at).toLocaleString()}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
