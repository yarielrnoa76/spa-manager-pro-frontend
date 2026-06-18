import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Paperclip, MessageSquare, AlertCircle,
  Bell, BellOff, Lock, User as UserIcon, Clock, Trash2
} from 'lucide-react';
import { api } from "../../services/api";
import { SupportTicket, SupportTicketComment } from "../../types/support";
import { UserData } from "../../App";
import clsx from 'clsx';

interface Props {
  user: UserData | null;
}

const SupportTicketDetail: React.FC<Props> = ({ user }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Select Options
  const [assignableUsers, setAssignableUsers] = useState<any[]>([]);
  const [priorities, setPriorities] = useState<any[]>([]);
  const [types, setTypes] = useState<any[]>([]);

  // Comment State
  const [commentBody, setCommentBody] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [commentAttachments, setCommentAttachments] = useState<File[]>([]);
  const [sendingComment, setSendingComment] = useState(false);

  // Permissions
  const permissions = user?.permissions || [];
  const isSuperAdmin = user?.is_super_admin;
  const hasPerm = (p: string) => isSuperAdmin || permissions.includes(p);

  const canEdit = hasPerm('edit_support_ticket');
  const canChangeStatus = hasPerm('change_support_ticket_status');
  const canAssign = hasPerm('assign_support_ticket');
  const canSilence = hasPerm('silence_ticket_notifications');
  const canDelete = hasPerm('delete_support_ticket');
  const canComment = hasPerm('comment_support_ticket');
  const canCreateInternalNotes = hasPerm('create_internal_notes');
  const canSeeLogs = hasPerm('manage_support_tickets') || isSuperAdmin;

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [ticketRes, usersRes, pRes, tRes] = await Promise.all([
        api.getSupportTicket(id!),
        hasPerm('assign_support_ticket') ? api.getSupportTicketAssignableUsers() : Promise.resolve([]),
        api.listSupportTicketPriorities(),
        api.listSupportTicketTypes()
      ]);
      setTicket(ticketRes.data);
      setAssignableUsers(usersRes);
      setPriorities(pRes);
      setTypes(tRes);
    } catch (err: any) {
      setError(err?.message || 'Error al cargar el ticket');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateField = async (field: string, value: any) => {
    try {
      const updated = await api.updateSupportTicket(id!, { [field]: value });
      setTicket(prev => prev ? { ...prev, ...updated, comments: prev.comments, logs: prev.logs } : null);
      // Re-fetch to ensure relations are perfectly in sync if needed, but local update is faster
      fetchData(); 
    } catch (err: any) {
      alert(err?.message || 'Error al actualizar');
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('¿Está seguro de eliminar este ticket?')) return;
    try {
      await api.deleteSupportTicket(id!, 'Eliminado desde la vista de detalle');
      navigate('/support-tickets');
    } catch (err: any) {
      alert(err?.message || 'Error al eliminar');
    }
  };

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentBody.trim()) return;

    setSendingComment(true);
    try {
      const formData = new FormData();
      formData.append('body', commentBody);
      formData.append('comment_type', isInternalNote ? 'internal_note' : 'public_comment');
      commentAttachments.forEach(f => formData.append('attachments[]', f));

      await api.addSupportTicketComment(id!, formData);
      setCommentBody('');
      setCommentAttachments([]);
      setIsInternalNote(false);
      fetchData(); // Refresh timeline
    } catch (err: any) {
      alert(err?.message || 'Error al enviar comentario');
    } finally {
      setSendingComment(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Cargando...</div>;
  if (error || !ticket) return <div className="p-8 text-red-500">{error || 'Ticket no encontrado'}</div>;

  return (
    <div className="flex flex-col h-full max-w-6xl mx-auto w-full">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/support-tickets')} className="p-2 border rounded-lg hover:bg-gray-50 text-gray-600">
            <ArrowLeft size={20} />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{ticket.subject}</h1>
              <span className="text-sm font-medium text-gray-500 bg-gray-100 px-2.5 py-0.5 rounded-full border">
                {ticket.ticket_number}
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Creado por <span className="font-semibold">{ticket.creator?.name || 'Usuario desconocido'}</span> el {new Date(ticket.created_at).toLocaleString()}
            </p>
          </div>
        </div>

        {canDelete && (
          <button onClick={handleDelete} className="flex items-center gap-2 px-4 py-2 text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition">
            <Trash2 size={18} /> Eliminar
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* Left Column - Timeline */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Original Ticket Body */}
          <div className="bg-white border rounded-xl shadow-sm p-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                <UserIcon className="text-indigo-600" size={20} />
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-start mb-2">
                  <span className="font-semibold text-gray-900">{ticket.creator?.name || 'Autor'}</span>
                  <span className="text-xs text-gray-500 flex items-center gap-1">
                    <Clock size={12} /> {new Date(ticket.created_at).toLocaleString()}
                  </span>
                </div>
                <div className="text-gray-700 whitespace-pre-wrap">{ticket.ticket_body}</div>
                
                {/* Attachments */}
                {ticket.attachments && ticket.attachments.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-3">
                    {ticket.attachments.map(att => (
                      <a 
                        key={att.id} 
                        href={`${import.meta.env.VITE_API_URL || "http://127.0.0.1:8000"}/storage/${att.file_path}`} 
                        target="_blank" 
                        rel="noreferrer"
                        className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 border rounded-lg hover:bg-gray-100 text-sm"
                      >
                        <Paperclip size={16} className="text-gray-400" />
                        <span className="text-indigo-600 truncate max-w-[200px]">{att.file_name}</span>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Comments Timeline */}
          <div className="space-y-4">
            {ticket.comments?.map(comment => (
              <div 
                key={comment.id} 
                className={clsx(
                  "border rounded-xl shadow-sm p-6",
                  comment.comment_type === 'internal_note' ? "bg-yellow-50 border-yellow-200" : "bg-white"
                )}
              >
                <div className="flex items-start gap-4">
                  <div className={clsx(
                    "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
                    comment.comment_type === 'internal_note' ? "bg-yellow-200" : "bg-gray-100"
                  )}>
                    {comment.comment_type === 'internal_note' ? (
                      <Lock className="text-yellow-700" size={18} />
                    ) : (
                      <MessageSquare className="text-gray-600" size={18} />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900">{comment.creator?.name || 'Usuario'}</span>
                        {comment.comment_type === 'internal_note' && (
                          <span className="text-xs font-medium text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded border border-yellow-200">Nota Interna</span>
                        )}
                      </div>
                      <span className="text-xs text-gray-500">{new Date(comment.created_at).toLocaleString()}</span>
                    </div>
                    <div className="text-gray-700 whitespace-pre-wrap">{comment.body}</div>
                    
                    {comment.attachments && comment.attachments.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-3">
                        {comment.attachments.map(att => (
                          <a 
                            key={att.id} 
                            href={`${import.meta.env.VITE_API_URL || "http://127.0.0.1:8000"}/storage/${att.file_path}`} 
                            target="_blank" 
                            rel="noreferrer"
                            className="flex items-center gap-2 px-3 py-1.5 bg-white border rounded-lg hover:bg-gray-50 text-sm"
                          >
                            <Paperclip size={16} className="text-gray-400" />
                            <span className="text-indigo-600 truncate max-w-[200px]">{att.file_name}</span>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Reply Box */}
          {canComment && ticket.status !== 'dismissed' && ticket.status !== 'completed' && (
            <div className="bg-white border rounded-xl shadow-sm p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Añadir Respuesta</h3>
              <form onSubmit={handleCommentSubmit} className="space-y-4">
                <textarea
                  value={commentBody}
                  onChange={e => setCommentBody(e.target.value)}
                  rows={4}
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none resize-none"
                  placeholder="Escriba su respuesta aquí..."
                  required
                />
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer hover:text-indigo-600 border px-3 py-1.5 rounded-lg">
                      <Paperclip size={18} />
                      <span>Adjuntar...</span>
                      <input 
                        type="file" 
                        multiple 
                        className="hidden" 
                        onChange={(e) => {
                          if (e.target.files) setCommentAttachments(Array.from(e.target.files));
                        }} 
                      />
                    </label>

                    {canCreateInternalNotes && (
                      <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={isInternalNote}
                          onChange={(e) => setIsInternalNote(e.target.checked)}
                          className="rounded border-gray-300 text-yellow-600 focus:ring-yellow-600"
                        />
                        <span className="flex items-center gap-1.5"><Lock size={14} className="text-yellow-600" /> Nota Interna Privada</span>
                      </label>
                    )}
                  </div>

                  <button 
                    type="submit" 
                    disabled={sendingComment || !commentBody.trim()}
                    className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium"
                  >
                    {sendingComment ? 'Enviando...' : 'Enviar Respuesta'}
                  </button>
                </div>
                
                {commentAttachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-2 border-t mt-4">
                    {commentAttachments.map((file, idx) => (
                      <span key={idx} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded border flex items-center gap-2">
                        {file.name}
                        <button type="button" onClick={() => setCommentAttachments(prev => prev.filter((_, i) => i !== idx))}><X size={12}/></button>
                      </span>
                    ))}
                  </div>
                )}
              </form>
            </div>
          )}

          {/* Activity Logs */}
          {canSeeLogs && ticket.logs && ticket.logs.length > 0 && (
            <div className="mt-8 pt-6 border-t">
              <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><Clock size={18}/> Historial de Actividad</h3>
              <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-300 before:to-transparent">
                {ticket.logs.map((log: any, idx: number) => (
                  <div key={log.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-slate-200 text-slate-500 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                      <AlertCircle size={16} />
                    </div>
                    <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white p-4 rounded border shadow-sm">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-bold text-sm text-gray-900">{log.performer?.name || 'Sistema'}</span>
                        <span className="text-xs text-gray-500">{new Date(log.created_at).toLocaleString()}</span>
                      </div>
                      <p className="text-sm text-gray-600">
                        {log.action === 'ticket_created' && 'Creó el ticket'}
                        {log.action === 'status_changed' && `Cambió el estado a ${log.new_value?.status}`}
                        {log.action === 'assigned_to_changed' && `Reasignó el ticket a ${assignableUsers.find(u => u.id == log.new_value?.assigned_to)?.name || 'Usuario ' + log.new_value?.assigned_to}`}
                        {log.action === 'support_ticket_priority_id_changed' && `Cambió prioridad a ${priorities.find(p => p.id == log.new_value?.support_ticket_priority_id)?.name || 'Otra'}`}
                        {log.action === 'support_ticket_type_id_changed' && `Cambió tipo a ${types.find(t => t.id == log.new_value?.support_ticket_type_id)?.name || 'Otro'}`}
                        {log.action === 'disable_notifications_changed' && (log.new_value?.disable_notifications ? 'Silenció notificaciones' : 'Activó notificaciones')}
                        {!['ticket_created','status_changed','assigned_to_changed','support_ticket_priority_id_changed','support_ticket_type_id_changed','disable_notifications_changed'].includes(log.action) && log.action}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Right Column - Properties Sidebar */}
        <div className="space-y-6">
          <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b bg-gray-50">
              <h3 className="font-bold text-gray-900">Propiedades del Ticket</h3>
            </div>
            
            <div className="p-5 space-y-5">
              
              {/* Status */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Estado</label>
                {canChangeStatus ? (
                  <select 
                    value={ticket.status}
                    onChange={(e) => handleUpdateField('status', e.target.value)}
                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none bg-gray-50"
                  >
                    <option value="new">Nuevo</option>
                    <option value="in_progress">En Proceso</option>
                    <option value="completed">Completado</option>
                    <option value="dismissed">Descartado</option>
                    <option value="reopened">Reabierto</option>
                  </select>
                ) : (
                  <div className="p-2 border rounded-lg bg-gray-50 text-sm font-medium text-gray-900">
                    {ticket.status === 'new' && 'Nuevo'}
                    {ticket.status === 'in_progress' && 'En Proceso'}
                    {ticket.status === 'completed' && 'Completado'}
                    {ticket.status === 'dismissed' && 'Descartado'}
                    {ticket.status === 'reopened' && 'Reabierto'}
                  </div>
                )}
              </div>

              {/* Assignee */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Asignado a</label>
                {canAssign ? (
                  <select 
                    value={ticket.assigned_to || ''}
                    onChange={(e) => handleUpdateField('assigned_to', e.target.value)}
                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none bg-gray-50"
                  >
                    <option value="">Sin Asignar</option>
                    {assignableUsers.map(u => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                ) : (
                  <div className="p-2 border rounded-lg bg-gray-50 text-sm font-medium text-gray-900">
                    {ticket.assignee?.name || 'Sin Asignar'}
                  </div>
                )}
              </div>

              {/* Priority */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Prioridad</label>
                {canEdit ? (
                  <select 
                    value={ticket.support_ticket_priority_id || ''}
                    onChange={(e) => handleUpdateField('support_ticket_priority_id', e.target.value)}
                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none bg-gray-50"
                  >
                    {priorities.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                ) : (
                  <div className="p-2 border rounded-lg bg-gray-50 text-sm font-medium flex items-center gap-2">
                    {ticket.priority && <span className="w-3 h-3 rounded-full" style={{ backgroundColor: ticket.priority.color }}></span>}
                    {ticket.priority?.name || '—'}
                  </div>
                )}
              </div>

              {/* Type */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Tipo</label>
                {canEdit ? (
                  <select 
                    value={ticket.support_ticket_type_id || ''}
                    onChange={(e) => handleUpdateField('support_ticket_type_id', e.target.value)}
                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none bg-gray-50"
                  >
                    {types.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                ) : (
                  <div className="p-2 border rounded-lg bg-gray-50 text-sm font-medium flex items-center gap-2">
                    {ticket.type && <span className="w-3 h-3 rounded-full" style={{ backgroundColor: ticket.type.color }}></span>}
                    {ticket.type?.name || '—'}
                  </div>
                )}
              </div>

              {/* Disable Notifications Toggle */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Notificaciones</label>
                <div className="flex items-center justify-between p-3 border rounded-lg bg-gray-50">
                  <div className="flex items-center gap-2">
                    {ticket.disable_notifications ? <BellOff size={16} className="text-gray-500" /> : <Bell size={16} className="text-indigo-600" />}
                    <span className="text-sm font-medium">{ticket.disable_notifications ? 'Silenciadas' : 'Activas'}</span>
                  </div>
                  
                  {canSilence && (
                    <button 
                      onClick={() => handleUpdateField('disable_notifications', !ticket.disable_notifications)}
                      className="text-xs px-2 py-1 bg-white border rounded hover:bg-gray-100 font-semibold text-gray-700"
                    >
                      {ticket.disable_notifications ? 'Activar' : 'Silenciar'}
                    </button>
                  )}
                </div>
              </div>

            </div>
          </div>

          {/* SLA Times Panel */}
          <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b bg-gray-50">
              <h3 className="font-bold text-gray-900">Tiempos SLA</h3>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex justify-between items-center border-b pb-2">
                <span className="text-sm text-gray-500">Creación:</span>
                <span className="text-sm font-medium text-gray-900">{new Date(ticket.created_at).toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center border-b pb-2">
                <span className="text-sm text-gray-500">Primera Respuesta:</span>
                <span className="text-sm font-medium text-gray-900">
                  {ticket.first_response_at ? new Date(ticket.first_response_at).toLocaleString() : 'Pendiente'}
                </span>
              </div>
              <div className="flex justify-between items-center border-b pb-2">
                <span className="text-sm text-gray-500">Tiempo 1ra Respuesta:</span>
                <span className="text-sm font-medium text-gray-900">
                  {ticket.time_to_first_response ? `${ticket.time_to_first_response} min` : '—'}
                </span>
              </div>
              <div className="flex justify-between items-center border-b pb-2">
                <span className="text-sm text-gray-500">Completado:</span>
                <span className="text-sm font-medium text-gray-900">
                  {ticket.completed_at ? new Date(ticket.completed_at).toLocaleString() : 'Pendiente'}
                </span>
              </div>
              <div className="flex justify-between items-center border-b pb-2">
                <span className="text-sm text-gray-500">Tiempo de Cierre:</span>
                <span className="text-sm font-medium text-gray-900">
                  {ticket.time_to_close ? `${ticket.time_to_close} min` : '—'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Resolución Real:</span>
                <span className="text-sm font-medium text-indigo-600">
                  {ticket.resolution_time_minutes ? `${ticket.resolution_time_minutes} min` : '—'}
                </span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default SupportTicketDetail;
