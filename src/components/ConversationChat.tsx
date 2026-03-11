import React, { useState, useEffect, useRef } from "react";
import { Send, CheckCircle2, User, Bot, AlertCircle, Clock, Check, CheckCheck } from "lucide-react";
import { api } from "../services/api";
import { Conversation, ConversationMessage } from "../types";

interface ChatProps {
    conversationId: number;
    embedded?: boolean;
    user?: any;
}

export const ConversationChat: React.FC<ChatProps> = ({ conversationId, embedded = false, user }) => {
    const [conversation, setConversation] = useState<Conversation | null>(null);
    const [messages, setMessages] = useState<ConversationMessage[]>([]);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [newMessage, setNewMessage] = useState("");

    const messagesEndRef = useRef<HTMLDivElement>(null);

    const loadData = async () => {
        try {
            const conv = await api.getConversation(conversationId);
            setConversation(conv);
            const msgsRes = await api.getConversationMessages(conversationId);
            setMessages(msgsRes.data.reverse()); // Because we query DESC, reverse to ascending for chat
            if (conv.unread_count > 0) {
                await api.markConversationRead(conversationId);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (conversationId) {
            loadData();
        }
    }, [conversationId]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || sending) return;

        setSending(true);
        // Optimistic UI
        const tempId = Date.now();
        const optimisticMsg: ConversationMessage = {
            id: tempId,
            tenant_id: conversation?.tenant_id || 1,
            conversation_id: conversationId,
            direction: 'outbound',
            message_type: 'text',
            sender_type: 'user',
            body: newMessage,
            status: 'pending',
            is_read: true,
            created_at: new Date().toISOString()
        };

        setMessages(prev => [...prev, optimisticMsg]);
        const msgText = newMessage;
        setNewMessage("");

        try {
            const actualMsg = await api.sendConversationMessage(conversationId, msgText);
            setMessages(prev => prev.map(m => m.id === tempId ? actualMsg : m));
            setConversation(prev => prev ? { ...prev, bot_enabled: false } : null);
        } catch (e) {
            setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'failed' } : m));
        } finally {
            setSending(false);
        }
    };

    const toggleBot = async () => {
        if (!conversation) return;
        try {
            await api.toggleConversationBot(conversation.id);
            setConversation({ ...conversation, bot_enabled: !conversation.bot_enabled });
        } catch (e) {
            console.error(e);
        }
    };

    const updateStatus = async (status: Conversation['status']) => {
        if (!conversation) return;
        try {
            await api.updateConversationStatus(conversation.id, status);
            setConversation({ ...conversation, status });
        } catch (e) {
            console.error(e);
        }
    }

    if (loading) return <div className="flex-1 flex justify-center items-center h-full"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>;
    if (!conversation) return <div className="flex-1 flex justify-center items-center h-full text-gray-400">Conversación no encontrada.</div>;

    const hasPerm = (p: string) => {
        if (user?.is_super_admin) return true;
        const perms = (user?.permissions || []) as string[];
        return perms.includes(p);
    };

    const isAdminOrSuperAdmin = user?.is_super_admin || ["superadmin", "admin"].includes(user?.role?.name?.toLowerCase() || "");
    const canReply = isAdminOrSuperAdmin || hasPerm('reply_all_conversations') || (hasPerm('reply_conversations') && (conversation.assigned_user_id === user?.id || !conversation.assigned_user_id));

    return (
        <div className={`flex flex-col bg-white ${embedded ? 'h-[500px]' : 'h-full'} shadow-sm rounded-lg overflow-hidden border border-gray-100`}>
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-4 py-3 flex justify-between items-center sm:px-6">
                <div>
                    <h3 className="text-sm leading-6 font-bold text-gray-900 flex items-center gap-2">
                        {conversation.contact_name || conversation.contact_phone}
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${conversation.status === 'open' ? 'bg-green-100 text-green-800' :
                            conversation.status === 'resolved' ? 'bg-gray-100 text-gray-800' :
                                'bg-yellow-100 text-yellow-800'
                            }`}>
                            {conversation.status}
                        </span>
                    </h3>
                    <p className="max-w-2xl text-xs text-gray-500">
                        {conversation.contact_phone} {conversation.branch?.name ? `• ${conversation.branch.name}` : ''}
                    </p>
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={toggleBot}
                        className={`text-xs px-3 py-1.5 rounded-md font-bold transition-colors flex items-center gap-1.5 ${conversation.bot_enabled ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                        title={conversation.bot_enabled ? "Desactivar bot y tomar control manual" : "Reactivar bot automático"}
                    >
                        <Bot size={14} className={conversation.bot_enabled ? "text-indigo-600" : "text-gray-400"} />
                        {conversation.bot_enabled ? 'Bot Activo' : 'Bot Inactivo'}
                    </button>
                    {!embedded && (
                        <select
                            value={conversation.status}
                            onChange={(e) => updateStatus(e.target.value as any)}
                            className="text-xs px-3 py-1.5 rounded-md font-bold bg-white border border-gray-200 text-gray-700 outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                            <option value="open">Abierto</option>
                            <option value="pending">Pendiente</option>
                            <option value="resolved">Resuelto</option>
                            <option value="closed">Cerrado</option>
                        </select>
                    )}
                </div>
            </div>

            {/* Area de mensajes */}
            <div className="flex-1 p-4 overflow-y-auto bg-slate-50 relative custom-scrollbar">
                {/* Optional floating date headers could go here */}
                {messages.length === 0 ? (
                    <div className="flex flex-col h-full items-center justify-center text-gray-400">
                        <User className="opacity-20 mb-2" size={48} />
                        <p className="text-sm font-medium">No hay mensajes aún</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {messages.map((msg, idx) => {
                            const isIncoming = msg.direction === 'inbound';
                            const isSystem = msg.message_type === 'system';
                            const isBot = msg.sender_type === 'bot';

                            if (isSystem) {
                                return (
                                    <div key={msg.id || idx} className="flex justify-center my-4">
                                        <span className="bg-gray-200/60 px-3 py-1 rounded-full text-[10px] font-semibold text-gray-600 backdrop-blur-sm">
                                            {msg.body}
                                        </span>
                                    </div>
                                );
                            }

                            return (
                                <div key={msg.id || idx} className={`flex ${isIncoming ? 'justify-start' : 'justify-end'}`}>
                                    <div className={`max-w-[75%] sm:max-w-md ${isIncoming
                                        ? 'bg-white rounded-2xl rounded-tl-sm border border-gray-100 shadow-sm'
                                        : 'bg-indigo-600 text-white rounded-2xl rounded-tr-sm shadow-md'
                                        } p-3 relative group transition-all`}>

                                        {!isIncoming && msg.sender_type === 'user' && (
                                            <div className="text-[10px] font-bold text-indigo-200 mb-1 leading-none">{msg.sender?.name || 'Agente'}</div>
                                        )}
                                        {isIncoming && (
                                            <div className="text-[10px] font-bold text-gray-400 mb-1 leading-none flex justify-between">
                                                {conversation.contact_name || 'Cliente'}
                                                {isBot && <Bot size={12} className="text-indigo-400" />}
                                            </div>
                                        )}
                                        {(!isIncoming && isBot) && (
                                            <div className="text-[10px] font-bold text-indigo-300 mb-1 leading-none flex items-center gap-1">
                                                <Bot size={12} /> Asistente Virtual
                                            </div>
                                        )}

                                        <p className={`text-sm whitespace-pre-wrap ${isIncoming ? 'text-gray-800' : 'text-white'}`}>
                                            {msg.body}
                                        </p>

                                        <div className={`flex items-center justify-end gap-1 mt-1 ${isIncoming ? 'text-gray-400' : 'text-indigo-200'}`}>
                                            <span className="text-[9px] font-medium">
                                                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                            {!isIncoming && (
                                                <span className="ml-1">
                                                    {msg.status === 'failed' ? <AlertCircle size={10} className="text-red-300" /> :
                                                        msg.status === 'pending' ? <Clock size={10} /> :
                                                            msg.is_read ? <CheckCheck size={12} className="text-blue-300" /> :
                                                                <Check size={12} />}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        <div ref={messagesEndRef} />
                    </div>
                )}
            </div>

            {/* Input Form */}
            <div className="p-3 bg-white border-t border-gray-200">
                {conversation.status === 'closed' ? (
                    <div className="text-center text-xs text-gray-500 font-medium py-2 bg-gray-50 rounded-lg">
                        La conversación ha sido cerrada. No se pueden enviar más mensajes.
                    </div>
                ) : !canReply ? (
                    <div className="text-center text-xs text-gray-500 font-medium py-2 bg-gray-50 rounded-lg">
                        No tienes permisos para escribir en esta conversación.
                    </div>
                ) : (
                    <form onSubmit={handleSend} className="flex gap-2 relative">
                        {conversation.bot_enabled && (
                            <div className="absolute -top-10 left-0 right-0 flex justify-center pointer-events-none">
                                <span className="bg-indigo-900/80 backdrop-blur text-white text-[10px] uppercase font-bold tracking-wider px-3 py-1 rounded-full shadow-lg">
                                    Responder detendrá al bot automáticamente
                                </span>
                            </div>
                        )}
                        <input
                            type="text"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder="Escribe un mensaje..."
                            className="flex-1 bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all disabled:opacity-50"
                            disabled={sending}
                        />
                        <button
                            type="submit"
                            disabled={!newMessage.trim() || sending}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-4 py-2.5 flex items-center justify-center transition-colors disabled:opacity-50 shadow-sm"
                        >
                            <Send size={18} className={sending ? 'animate-pulse' : ''} />
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
};
