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
  incoming: { title: "Incoming Lead", color: "bg-blue-400" },
  contact_1: { title: "1er Contacto", color: "bg-sky-500" },
  contact_2: { title: "2do Contacto", color: "bg-blue-500" },
  contact_3: { title: "3er Contacto", color: "bg-indigo-500" },
  interested: { title: "Cliente Interesado", color: "bg-purple-500" },
  recovered: { title: "Cliente Frío Recuperado", color: "bg-amber-500" },
  appointment_scheduled: { title: "Cita Agendada", color: "bg-green-500" },
  cold_lead: { title: "Lead Frío", color: "bg-gray-500" },
};

const STATUS_KEYS = Object.keys(STATUS_MAP) as LeadStatus[];

const PREV_STATUS: Partial<Record<LeadStatus, LeadStatus>> = {
  contact_1: "incoming",
  contact_2: "contact_1",
  contact_3: "contact_2",
  interested: "contact_3",
  appointment_scheduled: "interested",
  recovered: "cold_lead",
  cold_lead: "interested",
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

  const [showNextMenu, setShowNextMenu] = useState(false);

  const availableNextStatuses = STATUS_KEYS.filter(k => k !== lead.status);

  return (
    <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm flex flex-col justify-between min-h-[140px]">
      <div>
        <div className="flex justify-between items-start gap-1">
          <div className="w-full pr-1">
            <h3 className="font-bold text-xs leading-tight break-words text-indigo-950" title={lead.name}>{lead.name}</h3>
            <p className="text-[11px] text-indigo-600/80 font-bold mt-0.5 break-words" title={lead.phone}>{lead.phone}</p>
          </div>
          <div className="flex shrink-0">
            <button
              className="text-gray-300 hover:text-indigo-600 p-0.5 rounded transition-colors"
              onClick={() => onEdit(lead)}
              title="Editar lead"
            >
              <MoreHorizontal size={14} />
            </button>
          </div>
        </div>
        <p className="text-[10px] text-gray-400 mb-2 line-clamp-2 italic leading-tight mt-1.5 border-l-2 border-gray-100 pl-1.5">
          "{lead.message || ""}"
        </p>
      </div>

      <div>
        <div className="flex justify-between items-center mb-2 mt-auto">
          <div className="flex items-center gap-1 text-[10px] text-gray-400 font-medium bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100">
            {getSourceIcon(lead.source)}
            <span className="capitalize">{lead.source}</span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => onDeleteRequest(lead)}
              className="p-1 text-gray-300 hover:text-white hover:bg-red-500 rounded-full transition-colors"
              title={
                lead.status === "cold_lead"
                  ? "Eliminar permanentemente"
                  : "Mover a lead frío"
              }
            >
              <Trash2 size={12} />
            </button>
            <div className="w-px h-3 bg-gray-200 mx-0.5"></div>
            <a
              href={`https://wa.me/${formatWhatsAppPhone(lead.phone)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1 text-green-600 hover:text-white hover:bg-green-500 bg-green-50 rounded-full transition-colors"
            >
              <MessageSquare size={12} />
            </a>
            <a
              href={`tel:${lead.phone}`}
              className="p-1 text-blue-600 hover:text-white hover:bg-blue-500 bg-blue-50 rounded-full transition-colors"
            >
              <Phone size={12} />
            </a>
          </div>
        </div>
        
        <div className="flex gap-1.5 text-[10px] relative mt-1.5">
          {prev && (
            <button
              title="Mover al estado anterior"
              onClick={() => onStatusChange(lead.id, prev)}
              className="py-1 px-2 bg-gray-100 text-gray-600 rounded flex items-center justify-center flex-shrink-0 hover:bg-gray-200"
            >
              <ArrowLeft size={12} />
            </button>
          )}

          <div className="flex-1 relative">
             <button
                title="Mover lead"
                onClick={() => setShowNextMenu(!showNextMenu)}
                className="w-full py-1 px-2 bg-indigo-600 text-white rounded font-bold flex items-center justify-center gap-1 hover:bg-indigo-700"
              >
                Mover <ArrowRight size={12} />
              </button>
              
              {showNextMenu && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 shadow-xl rounded z-10 overflow-hidden divide-y divide-gray-100">
                  {availableNextStatuses.map(status => (
                    <button
                      key={status}
                      onClick={() => {
                        setShowNextMenu(false);
                        onStatusChange(lead.id, status);
                      }}
                      className={`w-full text-left px-2 py-1.5 text-[10px] hover:bg-gray-50 flex items-center gap-1 leading-none ${STATUS_MAP[status].color.replace('bg-', 'text-')}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_MAP[status].color}`} />
                      <span className="truncate">{STATUS_MAP[status].title}</span>
                    </button>
                  ))}
                </div>
              )}
          </div>
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
      const l = await api.listLeads();
      await api.listBranches(); // Just let it execute if required by API logic or just remove it if not needed. Actually, not needed. Let's just fetch leads.
      setLeads(l);
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
    if (lead.status !== "cold_lead") {
      await handleStatusChange(lead.id, "cold_lead");
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

      <div className="flex-1 flex gap-3 overflow-x-auto pb-4 custom-scrollbar">
        {STATUS_KEYS.map((statusKey) => (
          <div
            key={statusKey}
            className="bg-gray-50 rounded-xl flex flex-col min-w-[200px] w-[200px] shrink-0 border border-gray-100"
          >
            <div className="p-3 border-b border-gray-200 flex items-center justify-between">
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
