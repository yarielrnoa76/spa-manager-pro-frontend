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
  XCircle,
  DollarSign,
  Mail,
  Plus,
  X,
  ArrowLeft,
  Search,
  Trash2,
} from "lucide-react";

type LeadStatus = Lead["status"];

const STATUS_MAP: Record<LeadStatus, { title: string; color: string }> = {
  new: { title: "Nuevo", color: "bg-blue-500" },
  contacted: { title: "Contactado", color: "bg-amber-500" },
  sold: { title: "Vendido", color: "bg-green-500" },
  discarded: { title: "Descartado", color: "bg-gray-500" },
};

const STATUS_KEYS = Object.keys(STATUS_MAP) as LeadStatus[];

const PREV_STATUS: Partial<Record<LeadStatus, LeadStatus>> = {
  contacted: "new",
  sold: "contacted",
  discarded: "contacted",
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
    <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex flex-col justify-between min-h-[160px]">
      <div>
        <div className="flex justify-between items-start gap-2">
          <div>
            <h3 className="font-bold text-sm">{lead.name}</h3>
            <p className="text-xs text-gray-500">{lead.phone}</p>
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => onDeleteRequest(lead)}
              className="text-gray-400 hover:text-red-600 transition-colors"
              title={
                lead.status === "discarded"
                  ? "Eliminar permanentemente"
                  : "Mover a descartado"
              }
            >
              <Trash2 size={16} />
            </button>
            <button
              className="text-gray-400 hover:text-gray-600"
              onClick={() => onEdit(lead)}
              title="Editar lead"
            >
              <MoreHorizontal size={16} />
            </button>
          </div>
        </div>
        <p className="text-xs text-gray-500 mb-3 line-clamp-2 italic">
          "{lead.message || ""}"
        </p>
      </div>

      <div>
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-1 text-xs text-gray-400">
            {getSourceIcon(lead.source)}
            <span className="capitalize">{lead.source}</span>
          </div>
          <div className="flex items-center gap-2">
            {prev && (
              <button
                type="button"
                onClick={() => onStatusChange(lead.id, prev)}
                className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 bg-gray-100 rounded-full transition-colors"
              >
                <ArrowLeft size={14} />
              </button>
            )}
            <a
              href={`https://wa.me/${formatWhatsAppPhone(lead.phone)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 text-gray-400 hover:text-white hover:bg-green-500 bg-gray-100 rounded-full transition-colors"
            >
              <MessageSquare size={14} />
            </a>
            <a
              href={`tel:${lead.phone}`}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-blue-500 bg-gray-100 rounded-full transition-colors"
            >
              <Phone size={14} />
            </a>
          </div>
        </div>
        <div className="flex gap-2 text-xs">
          {lead.status === "new" && (
            <button
              onClick={() => onStatusChange(lead.id, "contacted")}
              className="w-full py-1.5 px-2 bg-indigo-600 text-white rounded font-semibold flex items-center justify-center gap-1 hover:bg-indigo-700 transition"
            >
              Marcar Contactado <ArrowRight size={12} />
            </button>
          )}
          {lead.status === "contacted" && (
            <button
              onClick={() => onStatusChange(lead.id, "sold")}
              className="flex-1 py-1.5 px-2 bg-green-500 text-white rounded font-semibold flex items-center justify-center gap-1 hover:bg-green-600 transition"
            >
              <DollarSign size={12} /> Vender
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const Leads: React.FC = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

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
    try {
      const l = await api.listLeads();
      const b = await api.listBranches();
      setLeads(l);
      setBranches(b);
    } catch (err) {
      console.error("Error fetching data", err);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleStatusChange = async (leadId: string, status: LeadStatus) => {
    try {
      await api.updateLeadStatus(leadId, status);
      fetchData();
    } catch (err) {
      alert("Error al actualizar el lead.");
    }
  };

  const handleDeleteRequest = async (lead: Lead) => {
    if (lead.status !== "discarded") {
      await handleStatusChange(lead.id, "discarded");
    } else {
      if (!window.confirm("¿Eliminar permanentemente de la base de datos?"))
        return;
      try {
        await api.deleteLead(lead.id);
        fetchData();
      } catch (err) {
        alert("Error al eliminar el lead.");
      }
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

      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 overflow-x-auto pb-4">
        {STATUS_KEYS.map((statusKey) => (
          <div
            key={statusKey}
            className="bg-gray-50 rounded-xl flex flex-col min-w-[250px] border border-gray-100"
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
    </div>
  );
};

export default Leads;
