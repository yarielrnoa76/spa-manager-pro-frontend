import React, { useState, useEffect, useCallback, useMemo } from "react";
import { api } from "../services/api";
import { Lead, Branch } from "../types";
import LeadModal from "../components/LeadModal";
import {
  Globe,
  MessageSquare,
  Phone,
  MoreHorizontal,
  ArrowRight,
  DollarSign,
  Plus,
  ArrowLeft,
  Search,
  Trash2,
} from "lucide-react";

type LeadStatus = Lead["status"];

const STATUS_MAP: Record<LeadStatus, { title: string; color: string }> = {
  new: { title: "Nuevo", color: "bg-blue-500" },
  first_contact: { title: "1er Contacto", color: "bg-cyan-500" },
  second_contact: { title: "2do Contacto", color: "bg-teal-500" },
  third_contact: { title: "3er Contacto", color: "bg-indigo-400" },
  appointment_set: { title: "Cita Programada", color: "bg-purple-500" },
  sold: { title: "Vendido / Éxito", color: "bg-green-500" },
  discarded: { title: "Descartado", color: "bg-gray-500" },
};

const STATUS_KEYS: LeadStatus[] = [
  "new",
  "first_contact",
  "second_contact",
  "third_contact",
  "appointment_set",
  "sold",
  "discarded"
];

const PREV_STATUS: Partial<Record<LeadStatus, LeadStatus>> = {
  first_contact: "new",
  second_contact: "first_contact",
  third_contact: "second_contact",
  appointment_set: "third_contact",
  sold: "appointment_set",
  discarded: "appointment_set",
};

function normalize(s: string) {
  return (s || "").toLowerCase().trim();
}

const LeadCard: React.FC<{
  lead: Lead;
  onStatusChange: (id: string, status: LeadStatus) => void;
  onDeleteRequest: (lead: Lead) => void;
  onEdit: (lead: Lead) => void;
}> = ({ lead, onStatusChange, onDeleteRequest, onEdit }) => {
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

  const formatWhatsAppPhone = (phone: string) =>
    (phone || "").replace(/[\s()-]/g, "");
  const prev = PREV_STATUS[lead.status];

  return (
    <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-between min-h-[140px] hover:border-indigo-200 transition-all duration-300">
      <div>
        <div className="flex justify-between items-start gap-1 pb-2 border-b border-gray-50 mb-2">
          <div className="min-w-0">
            <h3 className="font-bold text-sm text-gray-800 truncate">{lead.name} {lead.last_name || ""}</h3>
            <p className="text-[10px] text-gray-400 font-medium">{lead.phone}</p>
          </div>
          <div className="flex gap-1 flex-shrink-0">
            <button
              onClick={() => onDeleteRequest(lead)}
              className="p-1 text-gray-300 hover:text-rose-600 transition-colors"
              title={
                lead.status === "discarded"
                  ? "Eliminar permanentemente"
                  : "Mover a descartado"
              }
            >
              <Trash2 size={14} />
            </button>
            <button
              className="p-1 text-gray-300 hover:text-indigo-600"
              onClick={() => onEdit(lead)}
              title="Editar lead"
            >
              <MoreHorizontal size={14} />
            </button>
          </div>
        </div>
        <p className="text-[10px] text-gray-500 mb-3 line-clamp-2 italic leading-relaxed">
          {lead.message ? `"${lead.message}"` : "Sin mensaje"}
        </p>
      </div>

      <div>
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-1.5 text-[10px] text-gray-400 font-bold uppercase tracking-tighter">
            {getSourceIcon(lead.source)}
            <span>{lead.source}</span>
          </div>
          <div className="flex items-center gap-1.5">
            {prev && (
              <button
                type="button"
                onClick={() => onStatusChange(lead.id, prev)}
                className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 bg-gray-50 rounded-full transition-all"
              >
                <ArrowLeft size={12} />
              </button>
            )}
            <a
              href={`https://wa.me/${formatWhatsAppPhone(lead.phone)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 text-green-500 hover:text-white hover:bg-green-500 bg-green-50 rounded-full transition-all"
            >
              <MessageSquare size={12} />
            </a>
            <a
              href={`tel:${lead.phone}`}
              className="p-1.5 text-blue-500 hover:text-white hover:bg-blue-500 bg-blue-50 rounded-full transition-all"
            >
              <Phone size={12} />
            </a>
          </div>
        </div>
        
        <div className="flex gap-1.5 text-[10px]">
          {lead.status === "new" && (
            <button
              onClick={() => onStatusChange(lead.id, "first_contact")}
              className="w-full py-1.5 px-2 bg-indigo-600 text-white rounded-lg font-bold flex items-center justify-center gap-1 hover:bg-indigo-700 transition"
            >
              1er Contacto <ArrowRight size={10} />
            </button>
          )}
          {lead.status === "first_contact" && (
            <button
              onClick={() => onStatusChange(lead.id, "second_contact")}
              className="w-full py-1.5 px-2 bg-cyan-600 text-white rounded-lg font-bold flex items-center justify-center gap-1 hover:bg-cyan-700 transition"
            >
              2do Contacto <ArrowRight size={10} />
            </button>
          )}
          {lead.status === "second_contact" && (
            <button
              onClick={() => onStatusChange(lead.id, "third_contact")}
              className="w-full py-1.5 px-2 bg-teal-600 text-white rounded-lg font-bold flex items-center justify-center gap-1 hover:bg-teal-700 transition"
            >
              3er Contacto <ArrowRight size={10} />
            </button>
          )}
          {lead.status === "third_contact" && (
            <button
              onClick={() => onStatusChange(lead.id, "appointment_set")}
              className="w-full py-1.5 px-2 bg-indigo-500 text-white rounded-lg font-bold flex items-center justify-center gap-1 hover:bg-indigo-600 transition"
            >
              Agendar Cita <ArrowRight size={10} />
            </button>
          )}
          {lead.status === "appointment_set" && (
            <button
              onClick={() => onStatusChange(lead.id, "sold")}
              className="w-full py-1.5 px-2 bg-emerald-600 text-white rounded-lg font-bold flex items-center justify-center gap-1 hover:bg-emerald-700 transition"
            >
              Vendido / Éxito <DollarSign size={10} />
            </button>
          )}
          {(lead.status === "sold" || lead.status === "discarded") && (
             <button
                onClick={() => onStatusChange(lead.id, "new")}
                className="w-full py-1.5 px-2 bg-gray-100 text-gray-600 rounded-lg font-bold hover:bg-gray-200 transition"
             >
               Reactivar
             </button>
          )}
        </div>
      </div>
    </div>
  );
};

const Leads: React.FC = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [leadToDelete, setLeadToDelete] = useState<Lead | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const data = await api.listLeads();
      
      // Backward compatibility mapping
      const normalized = data.map(l => {
        let s = l.status as any;
        if (s === 'contacted') s = 'first_contact';
        if (s === 'attended') s = 'sold';
        if (s === 'lost') s = 'discarded';
        return { ...l, status: s };
      });

      setLeads(normalized);
    } catch (err) {
      console.error("Error fetching data", err);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, [fetchData]);

  const handleStatusChange = async (leadId: string, status: LeadStatus) => {
    try {
      await api.updateLeadStatus(leadId, status);
      fetchData();
    } catch {
      alert("Error al actualizar el lead.");
    }
  };

  const handleDeleteRequest = async (lead: Lead) => {
    if (lead.status !== "discarded") {
      await handleStatusChange(lead.id, "discarded");
    } else {
      setLeadToDelete(lead);
    }
  };

  const confirmDeleteLead = async () => {
    if (!leadToDelete) return;
    try {
      await api.deleteLead(leadToDelete.id);
      setLeadToDelete(null);
      fetchData();
    } catch (err: any) {
      alert("Error al eliminar el lead: " + (err?.message || ""));
    }
  };

  const filteredLeads = useMemo(() => {
    const q = normalize(searchTerm);
    if (!q) return leads;
    return leads.filter(
      (l) => normalize(l.name).includes(q) || normalize(l.phone).includes(q),
    );
  }, [leads, searchTerm]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 mb-4 flex flex-col gap-3">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">Pipeline de Leads</h1>
            <p className="text-gray-500 text-sm">
              Gestiona el ciclo de vida de tus clientes potenciales.
            </p>
          </div>
          <button
            onClick={() => {
              setEditingLead(null);
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold shadow-md hover:bg-indigo-700"
          >
            <Plus size={18} /> Nuevo Lead
          </button>
        </div>

        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            size={18}
          />
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nombre o teléfono..."
            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>
      </div>

      <div className="flex-1 flex gap-4 overflow-x-auto pb-6 custom-scrollbar items-start">
        {STATUS_KEYS.map((statusKey) => (
          <div
            key={statusKey}
            className="bg-gray-50/50 rounded-2xl flex flex-col min-w-[280px] max-w-[280px] h-full border border-gray-100 shadow-sm"
          >
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${STATUS_MAP[statusKey].color}`}
                ></span>
                <h3 className="font-bold text-sm uppercase text-gray-600">
                  {STATUS_MAP[statusKey].title}
                </h3>
              </div>
              <span className="text-xs font-mono bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">
                {filteredLeads.filter((l) => l.status === statusKey).length}
              </span>
            </div>
            <div className="p-3 space-y-3 flex-1 overflow-y-auto">
              {filteredLeads
                .filter((l) => l.status === statusKey)
                .map((lead) => (
                  <LeadCard
                    key={lead.id}
                    lead={lead}
                    onStatusChange={handleStatusChange}
                    onDeleteRequest={handleDeleteRequest}
                    onEdit={(l) => {
                      setEditingLead(l);
                      setIsModalOpen(true);
                    }}
                  />
                ))}
            </div>
          </div>
        ))}
      </div>

      {/* Uso del componente compartido LeadModal */}
      <LeadModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingLead(null);
        }}
        onSuccess={() => {
          fetchData();
          setEditingLead(null);
        }} // Recargamos lista al crear/editar
        leadToEdit={editingLead}
      />

      {/* Modal de Confirmación de Borrado */}
      {leadToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-sm p-6">
            <h2 className="text-xl font-bold mb-4">Eliminar Lead</h2>
            <p className="text-sm text-gray-600 mb-6">
              ¿Estás seguro de que deseas eliminar permanentemente a <strong>{leadToDelete.name}</strong> de la base de datos? Esta acción eliminará también sus citas, tickets y ventas asociadas y no se puede deshacer.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setLeadToDelete(null)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-semibold"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDeleteLead}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-semibold"
              >
                Sí, Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Leads;
