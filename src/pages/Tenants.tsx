import React, { useEffect, useState, useCallback } from "react";
import { api } from "../services/api";
import { Tenant } from "../types";
import {
    Building2,
    Plus,
    Edit3,
    Trash2,
    X,
    AlertTriangle,
} from "lucide-react";

/* ─────────────────────── DELETE CONFIRMATION MODAL ─────────────────────── */
const DeleteTenantModal: React.FC<{
    tenant: Tenant;
    onClose: () => void;
    onDeleted: () => void;
}> = ({ tenant, onClose, onDeleted }) => {
    const [confirmName, setConfirmName] = useState("");
    const [confirmPhrase, setConfirmPhrase] = useState("");
    const [deleting, setDeleting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const canDelete =
        confirmName === tenant.name && confirmPhrase === "DELETE";

    const handleDelete = async () => {
        if (!canDelete) return;
        setDeleting(true);
        setError(null);
        try {
            await api.deleteTenant(tenant.id, confirmName, confirmPhrase);
            onDeleted();
        } catch (err: unknown) {
            const e = err as Error & { message?: string };
            setError(e?.message || "Failed to delete tenant.");
        } finally {
            setDeleting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-5 animate-fade-in">
                <div className="flex items-center gap-3 text-red-600">
                    <AlertTriangle size={28} />
                    <h2 className="text-xl font-bold">Delete Tenant</h2>
                </div>

                <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-800">
                    <p className="font-semibold mb-1">⚠️ This action is IRREVERSIBLE.</p>
                    <p>
                        All data belonging to <strong>"{tenant.name}"</strong> will be
                        permanently deleted: users, branches, products, sales, leads,
                        appointments, expenses, and refunds.
                    </p>
                </div>

                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">
                        Type the tenant name to confirm:
                    </label>
                    <input
                        type="text"
                        value={confirmName}
                        onChange={(e) => setConfirmName(e.target.value)}
                        placeholder={tenant.name}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-400 focus:outline-none"
                    />
                    {confirmName && confirmName !== tenant.name && (
                        <p className="text-xs text-red-500 mt-1">Name does not match.</p>
                    )}
                </div>

                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">
                        Type <code className="bg-gray-100 px-1.5 py-0.5 rounded text-red-600 font-mono">DELETE</code> to confirm:
                    </label>
                    <input
                        type="text"
                        value={confirmPhrase}
                        onChange={(e) => setConfirmPhrase(e.target.value)}
                        placeholder="DELETE"
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-400 focus:outline-none font-mono"
                    />
                </div>

                {error && (
                    <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                        {error}
                    </div>
                )}

                <div className="flex gap-3 pt-2">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-50 transition"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleDelete}
                        disabled={!canDelete || deleting}
                        className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 disabled:bg-red-300 disabled:cursor-not-allowed transition"
                    >
                        {deleting ? "Deleting…" : "Delete Permanently"}
                    </button>
                </div>
            </div>
        </div>
    );
};

import TenantFormModal from "../components/TenantFormModal";


/* ─────────────────────── MAIN TENANTS PAGE ─────────────────────── */
const Tenants: React.FC = () => {
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editTenant, setEditTenant] = useState<Tenant | null>(null);
    const [deleteTenant, setDeleteTenant] = useState<Tenant | null>(null);

    const fetchTenants = useCallback(async () => {
        setLoading(true);
        try {
            const data = await api.listTenants();
            setTenants(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error("Failed to load tenants:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchTenants();
    }, [fetchTenants]);

    const handleSaved = () => {
        setShowForm(false);
        setEditTenant(null);
        fetchTenants();
    };

    const handleDeleted = () => {
        setDeleteTenant(null);
        fetchTenants();
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-gray-500 text-sm">
                        Gestiona los tenants del sistema. Solo visible para SuperAdmin.
                    </h3>
                </div>
                <button
                    onClick={() => {
                        setEditTenant(null);
                        setShowForm(true);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition"
                >
                    <Plus size={18} />
                    Crear Tenant
                </button>
            </div>

            {/* Tenant list */}
            {loading ? (
                <div className="flex items-center justify-center h-48 text-gray-400">
                    Loading tenants…
                </div>
            ) : tenants.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                    <Building2 size={48} className="mb-2 opacity-40" />
                    <p>No tenants found. Create one to get started.</p>
                </div>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {tenants.map((t) => (
                        <div
                            key={t.id}
                            className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition p-5 space-y-3"
                        >
                            <div className="flex items-start justify-between">
                                <div>
                                    <h3 className="text-lg font-bold text-gray-800">
                                        {t.name}
                                    </h3>
                                    <p className="text-xs text-gray-400 font-mono">{t.slug}</p>
                                </div>
                                <span
                                    className={`text-xs font-semibold px-2.5 py-1 rounded-full ${t.status === "active"
                                        ? "bg-green-100 text-green-700"
                                        : "bg-yellow-100 text-yellow-700"
                                        }`}
                                >
                                    {t.status}
                                </span>
                            </div>

                            <div className="flex gap-2">
                                <button
                                    onClick={() => {
                                        setEditTenant(t);
                                        setShowForm(true);
                                    }}
                                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-semibold text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition"
                                >
                                    <Edit3 size={14} /> Edit
                                </button>
                                <button
                                    onClick={() => setDeleteTenant(t)}
                                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-semibold text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition"
                                >
                                    <Trash2 size={14} /> Delete
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modals */}
            {showForm && (
                <TenantFormModal
                    tenant={editTenant}
                    onClose={() => {
                        setShowForm(false);
                        setEditTenant(null);
                    }}
                    onSaved={handleSaved}
                />
            )}

            {deleteTenant && (
                <DeleteTenantModal
                    tenant={deleteTenant}
                    onClose={() => setDeleteTenant(null)}
                    onDeleted={handleDeleted}
                />
            )}
        </div>
    );
};

export default Tenants;
