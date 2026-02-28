import React, { useState, useEffect, useRef } from 'react';
import { Bell, CheckCircle, Ticket as TicketIcon, Info } from 'lucide-react';
import { api } from '../services/api';
import { Notification } from '../types';
import { formatDistanceToNow } from 'date-fns';

const NotificationBell: React.FC = () => {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const fetchNotifications = async () => {
        try {
            const data = await api.listNotifications();
            setNotifications(data.notifications);
            setUnreadCount(data.unread_count);
        } catch (error) {
            console.error('Failed to fetch notifications', error);
        }
    };

    useEffect(() => {
        fetchNotifications();
        // Poll every 1 minute
        const interval = setInterval(fetchNotifications, 60000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleMarkAsRead = async (id: number) => {
        try {
            await api.markNotificationAsRead(id);
            fetchNotifications();
        } catch (error) {
            console.error('Failed to mark notification as read', error);
        }
    };

    const handleMarkAllAsRead = async () => {
        try {
            await api.markAllNotificationsAsRead();
            fetchNotifications();
        } catch (error) {
            console.error('Failed to mark all as read', error);
        }
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'ticket_assigned': return <TicketIcon className="text-indigo-600" size={16} />;
            default: return <Info className="text-blue-600" size={16} />;
        }
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
            >
                <Bell size={20} />
                {unreadCount > 0 && (
                    <span className="absolute top-0 right-0 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-2xl border z-50 overflow-hidden">
                    <div className="p-4 border-b flex items-center justify-between bg-gray-50">
                        <h3 className="font-bold text-gray-800">Notificaciones</h3>
                        {unreadCount > 0 && (
                            <button
                                onClick={handleMarkAllAsRead}
                                className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                            >
                                Marcar todas como leídas
                            </button>
                        )}
                    </div>

                    <div className="max-h-96 overflow-y-auto">
                        {notifications.length === 0 ? (
                            <div className="p-8 text-center text-gray-400">
                                <Bell size={32} className="mx-auto mb-2 opacity-20" />
                                <p className="text-sm">No tienes notificaciones</p>
                            </div>
                        ) : (
                            notifications.map((n) => (
                                <div
                                    key={n.id}
                                    className={`p-4 border-b hover:bg-gray-50 transition-colors cursor-pointer ${!n.read_at ? 'bg-indigo-50/30' : ''}`}
                                    onClick={() => {
                                        if (!n.read_at) handleMarkAsRead(n.id);
                                        if (n.url) window.location.href = n.url;
                                    }}
                                >
                                    <div className="flex gap-3">
                                        <div className="mt-1">{getIcon(n.type)}</div>
                                        <div className="flex-1">
                                            <div className="flex justify-between items-start">
                                                <p className={`text-sm ${!n.read_at ? 'font-bold' : 'font-medium'} text-gray-900`}>
                                                    {n.title}
                                                </p>
                                                {!n.read_at && <div className="w-2 h-2 bg-indigo-600 rounded-full mt-1.5"></div>}
                                            </div>
                                            <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">{n.body}</p>
                                            <p className="text-[10px] text-gray-400 mt-1">
                                                {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    <div className="p-3 border-t bg-gray-50 text-center">
                        <button className="text-xs text-gray-500 font-medium hover:text-gray-700">
                            Ver todas las actividades
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default NotificationBell;
