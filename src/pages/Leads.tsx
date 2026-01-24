import React, { useState, useEffect, useCallback } from "react";
import { api } from "../services/api";
import { Lead, Branch } from "../types";
import {
  Globe,
  MessageSquare,
  Phone,
  MoreHorizontal,
  ArrowRight,
  ArrowLeft,
  XCircle,
  DollarSign,
  Mail,
  Plus,
  X,
} from "lucide-react";

type LeadStatus = Lead["status"];

const STATUS_MAP: Record<LeadStatus, { title: string; color: string }> = {
  new: { title: "Nuevo", color: "bg-blue-500" },
  contacted: { title: "Contactado", color: "bg-amber-500" },
  sold: { title: "Vendido", color: "bg-green-500" },
  discarded: { title: "Descartado", color: "bg-gray-500" },
};

const STATUS_KEYS = Object.keys(STATUS_MAP) as LeadStatus[];

const STATUS_PREV: Record<LeadStatus, LeadStatus | null> = {
  new: null,
  contacted: "new",
  sold: "contacted",
  discarded: "contacted",
};

const LeadCard: React.FC<{
  lead: Lead;
  onStatusChange: (id: string, status: LeadStatus) => void;
  onDelete: (id: string) => void;
}> = ({ lead, onStatusChange, onDelete }) => {
  const getSourceIcon = (source: string) => {
    switch (source) {
      case "whatsapp":
        return <MessageSquare size={14} className="text-green-500" />;
      case "web":
        return <Globe size={14} className="text-blue-500" />;
      case "call":
        return <Phone size={14} className="text-indigo-500" />;
      default:
        return null;
    }
  };

  const formatWhatsAppPhone = (phone: string) => {
    return phone.replace(/[\s()-]/g, "");
  };

  return (
    <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex flex-col justify-between min-h-[160px]">
      <div>
        <div className="flex justify-between items-start">
          <h3 className="font-bold text-sm mb-2">{lead.name}</h3>
          <button className="text-gray-400 hover:text-gray-600">
            <MoreHorizontal size={16} />
          </button>
        </div>
        <p className="text-xs text-gray-500 mb-3 line-clamp-2 italic">
          "{lead.message}"
        </p>
      </div>

      <div>
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-1 text-xs text-gray-400">
            {getSourceIcon(lead.source)}
            <span className="capitalize">{lead.source}</span>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={`https://wa.me/${formatWhatsAppPhone(lead.phone)}`}
              target="_blank"
              rel="noopener noreferrer"
              title="Contactar por WhatsApp"
              className="p-1.5 text-gray-400 hover:text-white hover:bg-green-500 bg-gray-100 rounded-full transition-colors"
            >
              <MessageSquare size={14} />
            </a>
            <a
              href={`tel:${lead.phone}`}
              title="Llamar"
              className="p-1.5 text-gray-400 hover:text-white hover:bg-blue-500 bg-gray-100 rounded-full transition-colors"
            >
              <Phone size={14} />
            </a>
            {lead.email && (
              <a
                href={`mailto:${lead.email}`}
                title="Enviar Email"
                className="p-1.5 text-gray-400 hover:text-white hover:bg-red-500 bg-gray-100 rounded-full transition-colors"
              >
                <Mail size={14} />
              </a>
            )}
          </div>
        </div>

        <div className="flex gap-2 text-xs items-center">
          {/* Left arrow for previous status */}
          {STATUS_PREV[lead.status] && (
            <button
              onClick={() =>
                onStatusChange(lead.id, STATUS_PREV[lead.status] as LeadStatus)
              }
              className="p-1.5 text-gray-500 hover:text-indigo-600"
              title="Volver al estado anterior"
            >
              <ArrowLeft size={16} />
            </button>
          )}

          {/* Existing status actions */}
          {lead.status === "new" && (
            <button
              onClick={() => onStatusChange(lead.id, "contacted")}
              className="w-full py-1.5 px-2 bg-indigo-600 text-white rounded font-semibold flex items-center justify-center gap-1 hover:bg-indigo-700 transition"
            >
              Marcar Contactado <ArrowRight size={12} />
            </button>
          )}
          {lead.status === "contacted" && (
            <>
              <button
                onClick={() => onStatusChange(lead.id, "sold")}
                className="flex-1 py-1.5 px-2 bg-green-500 text-white rounded font-semibold flex items-center justify-center gap-1 hover:bg-green-600 transition"
              >
                <DollarSign size={12} /> Vender
              </button>
              <button
                onClick={() => onStatusChange(lead.id, "discarded")}
                className="p-1.5 text-gray-500 hover:text-red-600"
                title="Descartar Lead"
              >
                <XCircle size={16} />
              </button>
            </>
          )}

          {/* Delete button, only enabled in 'discarded' state */}
          <button
            disabled={lead.status !== "discarded"}
            onClick={() => lead.status === "discarded" && onDelete(lead.id)}
            className={`p-1.5 rounded ${lead.status === "discarded" ? "text-red-600 hover:bg-red-100" : "text-gray-300 cursor-not-allowed"}`}
            title="Eliminar Lead"
            type="button"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

const Leads: React.FC = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const initialFormState = {
    name: "",
    phone: "",
    email: "",
    branch_id: "",
    source: "other" as Lead["source"],
    message: "",
  };
  const [newLead, setNewLead] = useState(initialFormState);

  const fetchData = useCallback(async () => {
    const l = await api.listLeads();
    const b = await api.listBranches();
    setLeads(l);
    setBranches(b);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleStatusChange = async (leadId: string, status: LeadStatus) => {
    try {
      await api.updateLeadStatus(leadId, status);
      fetchData();
    } catch (err) {
      console.error("Failed to update lead status:", err);
      alert("Error al actualizar el lead.");
    }
  };

  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createLead(newLead);
      setIsModalOpen(false);
      setNewLead(initialFormState);
      fetchData();
    } catch (err) {
      alert("Error al crear el lead.");
    }
  };

  // Soft delete handler
  const handleDeleteLead = async (leadId: string | number) => {
    if (!window.confirm("¿Seguro que deseas eliminar este lead?")) return;

    try {
      await api.deleteLead(leadId);
      // Filtrar el lead eliminado del estado actual para una respuesta instantánea
      setLeads((prev) => prev.filter((l) => l.id !== leadId));
      // Opcional: fetchData();
    } catch (err) {
      console.error(err);
      alert(
        "Error al eliminar el lead. Verifica que la ruta DELETE exista en el servidor.",
      );
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Pipeline de Leads</h1>
          <p className="text-gray-500 text-sm">
            Gestiona el ciclo de vida de tus clientes potenciales.
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold shadow-md hover:bg-indigo-700"
        >
          <Plus size={18} /> Nuevo Lead
        </button>
      </div>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 overflow-x-auto">
        {STATUS_KEYS.map((statusKey) => {
          const columnLeads = leads.filter((l) => l.status === statusKey);
          return (
            <div
              key={statusKey}
              className="bg-gray-50 rounded-xl flex flex-col"
            >
              <div className="p-4 border-b border-gray-200 flex items-center gap-2">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${STATUS_MAP[statusKey].color}`}
                ></span>
                <h3 className="font-bold text-sm uppercase text-gray-600">
                  {STATUS_MAP[statusKey].title}
                </h3>
                <span className="text-xs font-mono bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">
                  {columnLeads.length}
                </span>
              </div>
              <div className="p-3 space-y-3 flex-1 overflow-y-auto">
                {columnLeads.map((lead) => (
                  <LeadCard
                    key={lead.id}
                    lead={lead}
                    onStatusChange={handleStatusChange}
                    onDelete={handleDeleteLead}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b flex justify-between items-center">
              <h3 className="font-bold text-lg">Crear Nuevo Lead</h3>
              <button onClick={() => setIsModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateLead} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                    Nombre Completo
                  </label>
                  <input
                    type="text"
                    required
                    value={newLead.name}
                    onChange={(e) =>
                      setNewLead({ ...newLead, name: e.target.value })
                    }
                    className="w-full border rounded-lg p-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                    Teléfono
                  </label>
                  <input
                    type="tel"
                    required
                    value={newLead.phone}
                    onChange={(e) =>
                      setNewLead({ ...newLead, phone: e.target.value })
                    }
                    className="w-full border rounded-lg p-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                  Email (Opcional)
                </label>
                <input
                  type="email"
                  value={newLead.email}
                  onChange={(e) =>
                    setNewLead({ ...newLead, email: e.target.value })
                  }
                  className="w-full border rounded-lg p-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                    Sucursal
                  </label>
                  <select
                    required
                    value={newLead.branch_id}
                    onChange={(e) =>
                      setNewLead({ ...newLead, branch_id: e.target.value })
                    }
                    className="w-full border rounded-lg p-2 text-sm bg-white"
                  >
                    <option value="">Seleccionar...</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                    Origen
                  </label>
                  <select
                    value={newLead.source}
                    onChange={(e) =>
                      setNewLead({
                        ...newLead,
                        source: e.target.value as Lead["source"],
                      })
                    }
                    className="w-full border rounded-lg p-2 text-sm bg-white"
                  >
                    <option value="whatsapp">WhatsApp</option>
                    <option value="call">Llamada</option>
                    <option value="web">Web</option>
                    <option value="other">Otro</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                  Mensaje / Nota
                </label>
                <textarea
                  value={newLead.message}
                  onChange={(e) =>
                    setNewLead({ ...newLead, message: e.target.value })
                  }
                  className="w-full border rounded-lg p-2 text-sm"
                  rows={3}
                ></textarea>
              </div>
              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2 border rounded-lg text-sm font-bold hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold shadow-lg hover:bg-indigo-700"
                >
                  Guardar Lead
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Leads;
