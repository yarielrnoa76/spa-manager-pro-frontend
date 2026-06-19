import React, { useState, useEffect } from 'react';
import { X, Paperclip, AlertCircle, BellOff } from 'lucide-react';
import { api } from "../../services/api";
import { SupportTicketPriority, SupportTicketType } from "../../types/support";

interface Props {
  onClose: () => void;
  onSuccess: () => void;
  userPermissions: string[];
}

const CreateTicketModal: React.FC<Props> = ({ onClose, onSuccess, userPermissions }) => {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [priorityId, setPriorityId] = useState('');
  const [typeId, setTypeId] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [disableNotifications, setDisableNotifications] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  
  const [priorities, setPriorities] = useState<SupportTicketPriority[]>([]);
  const [types, setTypes] = useState<SupportTicketType[]>([]);
  const [assignableUsers, setAssignableUsers] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canSilenceNotifications = userPermissions.includes('silence_ticket_notifications');
  const canAssign = userPermissions.includes('assign_support_ticket');

  useEffect(() => {
    let mounted = true;
    const loadConfig = async () => {
      try {
        const [pData, tData, uData] = await Promise.all([
          api.listSupportTicketPriorities(),
          api.listSupportTicketTypes(),
          canAssign ? api.getSupportTicketAssignableUsers() : Promise.resolve([]),
        ]);
        if (mounted) {
          setPriorities(pData || []);
          setTypes(tData || []);
          setAssignableUsers(uData || []);
          if (pData?.length) setPriorityId(String(pData[0].id));
          if (tData?.length) setTypeId(String(tData[0].id));
        }
      } catch (err: any) {
        if (mounted) setError('No se pudieron cargar las configuraciones. Intente de nuevo.');
      } finally {
        if (mounted) setLoadingData(false);
      }
    };
    loadConfig();
    return () => { mounted = false; };
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setAttachments(Array.from(e.target.files));
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !body.trim() || !priorityId || !typeId) {
      setError('Por favor complete todos los campos obligatorios.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('subject', subject);
      formData.append('ticket_body', body);
      formData.append('support_ticket_priority_id', priorityId);
      formData.append('support_ticket_type_id', typeId);
      
      if (canAssign && assignedTo) {
        formData.append('assigned_to', assignedTo);
      }
      
      if (canSilenceNotifications) {
        formData.append('disable_notifications', disableNotifications ? '1' : '0');
      }

      attachments.forEach(file => {
        formData.append('attachments[]', file);
      });

      await api.createSupportTicket(formData);
      onSuccess();
    } catch (err: any) {
      setError(err?.message || 'Error al crear el ticket. Intente nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b shrink-0">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Crear Ticket de Soporte</h2>
            <p className="text-sm text-gray-500 mt-1">Reporte un problema o solicite ayuda a nuestro equipo de soporte.</p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center gap-3">
              <AlertCircle size={20} className="shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          {loadingData ? (
            <div className="flex justify-center p-8 text-gray-500">Cargando opciones...</div>
          ) : (
            <form id="create-ticket-form" onSubmit={handleSubmit} className="space-y-6">
              
              <div className={canAssign ? "grid grid-cols-1 md:grid-cols-3 gap-6" : "grid grid-cols-1 md:grid-cols-2 gap-6"}>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Prioridad <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={priorityId}
                    onChange={(e) => setPriorityId(e.target.value)}
                    className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent outline-none"
                    required
                  >
                    <option value="" disabled>Seleccione prioridad</option>
                    {priorities.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tipo de Solicitud <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={typeId}
                    onChange={(e) => setTypeId(e.target.value)}
                    className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent outline-none"
                    required
                  >
                    <option value="" disabled>Seleccione tipo</option>
                    {types.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>

                {canAssign && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Asignar a
                    </label>
                    <select
                      value={assignedTo}
                      onChange={(e) => setAssignedTo(e.target.value)}
                      className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent outline-none"
                    >
                      <option value="">Sin asignar</option>
                      {assignableUsers.map(u => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Asunto <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent outline-none"
                  placeholder="Resuma su problema brevemente..."
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descripción Detallada <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={5}
                  className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent outline-none resize-none"
                  placeholder="Por favor describa el problema con el mayor detalle posible. Incluya pasos para reproducirlo si es un error."
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Archivos Adjuntos
                </label>
                <div className="flex items-center justify-center w-full">
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <Paperclip className="w-8 h-8 mb-3 text-gray-400" />
                      <p className="text-sm text-gray-500"><span className="font-semibold">Haga clic para adjuntar</span> o arrastre y suelte</p>
                      <p className="text-xs text-gray-400 mt-1">PNG, JPG, PDF (Máx. 10MB c/u)</p>
                    </div>
                    <input type="file" multiple className="hidden" onChange={handleFileChange} />
                  </label>
                </div>
                
                {attachments.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {attachments.map((file, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 border rounded-lg">
                        <span className="text-sm text-gray-600 truncate mr-4">{file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                        <button type="button" onClick={() => removeAttachment(idx)} className="text-red-500 hover:text-red-700 shrink-0">
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {canSilenceNotifications && (
                <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <div className="flex items-center h-5">
                      <input
                        type="checkbox"
                        checked={disableNotifications}
                        onChange={(e) => setDisableNotifications(e.target.checked)}
                        className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-600"
                      />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-gray-900 flex items-center gap-2">
                        <BellOff size={16} className="text-yellow-600" />
                        Silenciar Notificaciones
                      </span>
                      <p className="text-xs text-gray-500 mt-1">
                        Si está activo, no se enviarán notificaciones ni correos sobre este ticket a los administradores ni soporte técnico.
                      </p>
                    </div>
                  </label>
                </div>
              )}
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t bg-gray-50 flex items-center justify-end gap-3 shrink-0 rounded-b-xl">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 text-sm font-semibold text-gray-700 bg-white border rounded-lg hover:bg-gray-50 transition-colors"
            disabled={loading}
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="create-ticket-form"
            className="px-4 py-2.5 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2"
            disabled={loading || loadingData}
          >
            {loading ? 'Creando Ticket...' : 'Crear Ticket'}
          </button>
        </div>

      </div>
    </div>
  );
};

export default CreateTicketModal;
