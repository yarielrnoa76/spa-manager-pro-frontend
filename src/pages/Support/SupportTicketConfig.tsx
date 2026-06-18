import React, { useState, useEffect } from 'react';
import { Settings, Plus, Edit2, Trash2 } from 'lucide-react';
import { api } from "../../services/api";
import { SupportTicketPriority, SupportTicketType } from "../../types/support";

interface Props {
  user: any;
}

const SupportTicketConfig: React.FC<Props> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<'priorities' | 'types'>('priorities');
  const [priorities, setPriorities] = useState<SupportTicketPriority[]>([]);
  const [types, setTypes] = useState<SupportTicketType[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [editingItem, setEditingItem] = useState<any>(null);
  const [formData, setFormData] = useState({ name: '', color: '#000000', sort_order: 1 });
  const [isModalOpen, setIsModalOpen] = useState(false);

  const hasPerm = (perm: string) => user?.permissions?.includes(perm);
  const canConfigPriorities = hasPerm('configure_ticket_priorities') || user?.role === 'superadmin';
  const canConfigTypes = hasPerm('configure_ticket_types') || user?.role === 'superadmin';

  const fetchData = async () => {
    setLoading(true);
    try {
      const [pRes, tRes] = await Promise.all([
        canConfigPriorities ? api.listSupportTicketPriorities() : Promise.resolve({ data: [] }),
        canConfigTypes ? api.listSupportTicketTypes() : Promise.resolve({ data: [] })
      ]);
      setPriorities(((pRes as any).data || pRes) as any);
      setTypes(((tRes as any).data || tRes) as any);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openModal = (item?: any) => {
    if (item) {
      setEditingItem(item);
      setFormData({ name: item.name, color: item.color, sort_order: item.sort_order });
    } else {
      setEditingItem(null);
      setFormData({ name: '', color: '#000000', sort_order: activeTab === 'priorities' ? priorities.length + 1 : types.length + 1 });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingItem(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (activeTab === 'priorities') {
        if (editingItem) {
          await api.updateSupportTicketPriority(editingItem.id, formData);
        } else {
          await api.createSupportTicketPriority(formData);
        }
      } else {
        if (editingItem) {
          await api.updateSupportTicketType(editingItem.id, formData);
        } else {
          await api.createSupportTicketType(formData);
        }
      }
      fetchData();
      closeModal();
    } catch (err) {
      console.error('Failed to save', err);
      alert('Error al guardar. Verifica que no haya duplicados.');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Seguro que deseas eliminar este registro?')) return;
    try {
      if (activeTab === 'priorities') {
        await api.deleteSupportTicketPriority(id);
      } else {
        await api.deleteSupportTicketType(id);
      }
      fetchData();
    } catch (err) {
      console.error('Failed to delete', err);
      alert('No se pudo eliminar. Podría estar en uso por tickets existentes.');
    }
  };

  const renderTable = (items: any[]) => (
    <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
      <table className="w-full text-left">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="p-4 text-xs font-semibold text-gray-500 uppercase">Orden</th>
            <th className="p-4 text-xs font-semibold text-gray-500 uppercase">Nombre</th>
            <th className="p-4 text-xs font-semibold text-gray-500 uppercase">Color</th>
            <th className="p-4 text-xs font-semibold text-gray-500 uppercase text-right">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {items.map(item => (
            <tr key={item.id} className="hover:bg-gray-50">
              <td className="p-4 text-gray-600">{item.sort_order}</td>
              <td className="p-4 font-medium text-gray-900">{item.name}</td>
              <td className="p-4">
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full border shadow-sm" style={{ backgroundColor: item.color }}></span>
                  <span className="text-sm text-gray-500">{item.color}</span>
                </div>
              </td>
              <td className="p-4 text-right space-x-2">
                <button onClick={() => openModal(item)} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg">
                  <Edit2 size={16} />
                </button>
                <button onClick={() => handleDelete(item.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg">
                  <Trash2 size={16} />
                </button>
              </td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td colSpan={4} className="p-8 text-center text-gray-500">No hay registros configurados.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  if (!canConfigPriorities && !canConfigTypes) {
    return <div className="p-8 text-center text-red-600">No tienes permisos para configurar tickets de soporte.</div>;
  }

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto w-full space-y-6">
      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Settings className="text-indigo-600" /> Configuración de Tickets
          </h1>
          <p className="text-sm text-gray-500 mt-1">Gestiona las prioridades y tipos disponibles para los tickets de soporte.</p>
        </div>
        <button
          onClick={() => openModal()}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
        >
          <Plus size={18} />
          <span>Nuevo Registro</span>
        </button>
      </div>

      <div className="flex border-b">
        {canConfigPriorities && (
          <button
            onClick={() => setActiveTab('priorities')}
            className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${activeTab === 'priorities' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            Prioridades
          </button>
        )}
        {canConfigTypes && (
          <button
            onClick={() => setActiveTab('types')}
            className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${activeTab === 'types' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            Tipos de Ticket
          </button>
        )}
      </div>

      {loading ? (
        <div className="p-8 text-center text-gray-500">Cargando...</div>
      ) : (
        activeTab === 'priorities' ? renderTable(priorities) : renderTable(types)
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-5 border-b flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-900">
                {editingItem ? 'Editar' : 'Crear'} {activeTab === 'priorities' ? 'Prioridad' : 'Tipo'}
              </h3>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Nombre</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none"
                  placeholder="Ej. Alta, Normal, Urgente..."
                />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-bold text-gray-700 mb-1">Color HEX</label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      required
                      value={formData.color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      className="w-10 h-10 p-1 border rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      required
                      value={formData.color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      className="flex-1 p-2 border rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none"
                      placeholder="#000000"
                      pattern="^#[0-9A-Fa-f]{6}$"
                      title="Debe ser un código hexadecimal válido, ej. #FF0000"
                    />
                  </div>
                </div>
                <div className="w-24">
                  <label className="block text-xs font-bold text-gray-700 mb-1">Orden</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={formData.sort_order}
                    onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 1 })}
                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none"
                  />
                </div>
              </div>
              <div className="pt-4 flex justify-end gap-2 border-t">
                <button type="button" onClick={closeModal} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancelar</button>
                <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupportTicketConfig;
