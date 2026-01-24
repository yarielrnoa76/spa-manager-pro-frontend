import React, { useState, useEffect, useCallback, useMemo } from "react";
import { api } from "../services/api";
import { Lead, Branch } from "../types";
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
}> = ({ lead, onStatusChange, onDeleteRequest }) => {
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
          <h3 className="font-bold text-sm mb-2">{lead.name}</h3>
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
            <button className="text-gray-400 hover:text-gray-600">
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
            <>
              <button
                onClick={() => onStatusChange(lead.id, "sold")}
                className="flex-1 py-1.5 px-2 bg-green-500 text-white rounded font-semibold flex items-center justify-center gap-1 hover:bg-green-600 transition"
              >
                <DollarSign size={12} /> Vender
              </button>
            </>
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
  const [searchTerm, setSearchTerm] = useState("");

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
      alert("Error al actualizar el lead.");
    }
  };

  const handleDeleteRequest = async (lead: Lead) => {
    if (lead.status !== "discarded") {
      // Si no está descartado, lo movemos al último estado
      await handleStatusChange(lead.id, "discarded");
    } else {
      // Si ya está descartado, borramos permanentemente
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

  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    // Lógica de creación omitida por brevedad, se mantiene igual a tu código original
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
      {/* HEADER Y FILTROS */}
      <div className="flex-shrink-0 mb-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold">Pipeline de Leads</h1>
        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold"
        >
          <Plus size={18} className="inline mr-2" />
          Nuevo Lead
        </button>
      </div>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 overflow-x-auto pb-4">
        {STATUS_KEYS.map((statusKey) => (
          <div
            key={statusKey}
            className="bg-gray-50 rounded-xl flex flex-col min-w-[250px]"
          >
            <div className="p-4 border-b border-gray-200 flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${STATUS_MAP[statusKey].color}`}
              ></span>
              <h3 className="font-bold text-sm uppercase text-gray-600">
                {STATUS_MAP[statusKey].title}
              </h3>
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
                  />
                ))}
            </div>
          </div>
        ))}
      </div>
      {/* MODAL DE CREACIÓN (Mantener igual que el tuyo) */}
    </div>
  );
};

export default Leads;
