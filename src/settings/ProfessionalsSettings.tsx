import React, { useState, useEffect, useCallback } from "react";
import { api } from "../services/api";
import { ProfessionalPerson } from "../types";
import { Plus, Search, Pencil, Trash2, X, User } from "lucide-react";

const ProfessionalsSettings: React.FC = () => {
  const [professionals, setProfessionals] = useState<ProfessionalPerson[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ProfessionalPerson | null>(null);
  const [loading, setLoading] = useState(false);

  const emptyForm = {
    fname: "",
    lname: "",
    phone: "",
    email: "",
    title: "",
    description: "",
  };

  const [form, setForm] = useState(emptyForm);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.listProfessionals();
      setProfessionals(data);
    } catch (err: any) {
      console.error("Error fetching professionals:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = professionals.filter((p) => {
    const term = searchTerm.toLowerCase();
    const fullName = `${p.fname} ${p.lname}`.toLowerCase();
    return (
      fullName.includes(term) ||
      p.title.toLowerCase().includes(term) ||
      (p.email || "").toLowerCase().includes(term) ||
      (p.phone || "").toLowerCase().includes(term)
    );
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createProfessional({
        fname: form.fname.trim(),
        lname: form.lname.trim(),
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        title: form.title.trim(),
        description: form.description.trim() || null,
      });
      setIsCreateOpen(false);
      setForm(emptyForm);
      fetchData();
    } catch (err: any) {
      alert(err?.message || "Error al crear profesional");
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    try {
      await api.updateProfessional(editTarget.id, {
        fname: form.fname.trim(),
        lname: form.lname.trim(),
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        title: form.title.trim(),
        description: form.description.trim() || null,
      });
      setIsEditOpen(false);
      setEditTarget(null);
      setForm(emptyForm);
      fetchData();
    } catch (err: any) {
      alert(err?.message || "Error al actualizar profesional");
    }
  };

  const handleDelete = async (p: ProfessionalPerson) => {
    const ok = window.confirm(
      `¿Eliminar a "${p.fname} ${p.lname}" (${p.title})?\n\nEsta acción no se puede deshacer.`
    );
    if (!ok) return;
    try {
      await api.deleteProfessional(p.id);
      fetchData();
    } catch (err: any) {
      alert(err?.message || "Error al eliminar profesional");
    }
  };

  const openEdit = (p: ProfessionalPerson) => {
    setEditTarget(p);
    setForm({
      fname: p.fname,
      lname: p.lname,
      phone: p.phone || "",
      email: p.email || "",
      title: p.title,
      description: p.description || "",
    });
    setIsEditOpen(true);
  };

  const renderFormModal = (
    isOpen: boolean,
    onClose: () => void,
    onSubmit: (e: React.FormEvent) => void,
    title: string,
    submitLabel: string
  ) => {
    if (!isOpen) return null;
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
          <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50">
            <h3 className="font-bold text-lg">{title}</h3>
            <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X size={20} />
            </button>
          </div>
          <form onSubmit={onSubmit} className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nombre *</label>
                <input
                  type="text"
                  required
                  className="w-full border rounded-lg p-2 text-sm"
                  value={form.fname}
                  onChange={(e) => setForm((f) => ({ ...f, fname: e.target.value }))}
                  placeholder="Nombre"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Apellido *</label>
                <input
                  type="text"
                  required
                  className="w-full border rounded-lg p-2 text-sm"
                  value={form.lname}
                  onChange={(e) => setForm((f) => ({ ...f, lname: e.target.value }))}
                  placeholder="Apellido"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Título / Rol *</label>
              <input
                type="text"
                required
                className="w-full border rounded-lg p-2 text-sm"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Esteticista, Dr., Enfermera..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Teléfono</label>
                <input
                  type="text"
                  className="w-full border rounded-lg p-2 text-sm"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="(555) 123-4567"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Email</label>
                <input
                  type="email"
                  className="w-full border rounded-lg p-2 text-sm"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="correo@ejemplo.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Descripción</label>
              <textarea
                className="w-full border rounded-lg p-2 text-sm"
                rows={2}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Notas adicionales..."
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2 border rounded-lg text-sm font-bold hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 shadow-lg"
              >
                {submitLabel}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">
          Gestiona los profesionales que realizan servicios (esteticistas, doctores, etc.)
        </p>
        <button
          onClick={() => {
            setForm(emptyForm);
            setIsCreateOpen(true);
          }}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 text-sm shadow-lg hover:bg-indigo-700"
        >
          <Plus size={16} /> Nuevo Profesional
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
        <input
          className="w-full pl-10 pr-4 py-2 bg-gray-50 border rounded-lg text-sm"
          placeholder="Buscar por nombre, título, email o teléfono..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-400">Cargando...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <User size={48} className="mx-auto mb-3 opacity-50" />
          <p className="font-bold">No se encontraron profesionales</p>
          <p className="text-sm mt-1">Crea tu primer profesional para empezar.</p>
        </div>
      ) : (
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 font-bold text-gray-500 uppercase text-xs">
            <tr>
              <th className="px-4 py-3">Nombre Completo</th>
              <th className="px-4 py-3">Título</th>
              <th className="px-4 py-3">Teléfono</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Servicios</th>
              <th className="px-4 py-3 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-bold text-gray-900">
                  {p.fname} {p.lname}
                </td>
                <td className="px-4 py-3">
                  <span className="text-[10px] uppercase font-black px-2 py-1 rounded-full bg-purple-100 text-purple-700">
                    {p.title}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500">{p.phone || "—"}</td>
                <td className="px-4 py-3 text-gray-500">{p.email || "—"}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {(p.products || []).length > 0 ? (
                      (p.products || []).map((prod) => (
                        <span
                          key={prod.id}
                          className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-bold"
                        >
                          {prod.name}
                        </span>
                      ))
                    ) : (
                      <span className="text-gray-400 text-xs">—</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-center gap-2">
                    <button
                      onClick={() => openEdit(p)}
                      className="text-gray-600 hover:text-gray-900 p-1"
                      title="Editar"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(p)}
                      className="text-red-500 hover:text-red-700 p-1"
                      title="Eliminar"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {renderFormModal(
        isCreateOpen,
        () => setIsCreateOpen(false),
        handleCreate,
        "Nuevo Profesional",
        "Crear"
      )}

      {renderFormModal(
        isEditOpen,
        () => {
          setIsEditOpen(false);
          setEditTarget(null);
        },
        handleUpdate,
        "Editar Profesional",
        "Guardar"
      )}
    </div>
  );
};

export default ProfessionalsSettings;
