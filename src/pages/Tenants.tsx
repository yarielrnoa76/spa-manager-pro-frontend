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
    Shield,
    CheckCircle,
    RefreshCw,
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

/* ─────────────────────── CREATE/EDIT MODAL ─────────────────────── */
const TenantFormModal: React.FC<{
    tenant?: Tenant | null;
    onClose: () => void;
    onSaved: () => void;
}> = ({ tenant, onClose, onSaved }) => {
    const isEdit = !!tenant;
    const [name, setName] = useState(tenant?.name || "");
    const [slug, setSlug] = useState(tenant?.slug || "");
    const [status, setStatus] = useState(tenant?.status || "active");
    const [tenantApiToken, setTenantApiToken] = useState(tenant?.tenant_api_token || "");
    const [n8nApiKey, setN8nApiKey] = useState(tenant?.n8n_api_key || "");
    const [n8nWebhookUrl, setN8nWebhookUrl] = useState(tenant?.n8n_webhook_url || "");
    const [chatwootBaseUrl, setChatwootBaseUrl] = useState(tenant?.chatwoot_base_url || "");
    const [chatwootApiToken, setChatwootApiToken] = useState(tenant?.chatwoot_api_token || "");
    const [chatwootAccountId, setChatwootAccountId] = useState(tenant?.chatwoot_account_id || "");
    const [chatwootInboxId, setChatwootInboxId] = useState(tenant?.chatwoot_inbox_id || "");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError(null);
        try {
            const payload = {
                name,
                slug: slug || undefined,
                status,
                tenant_api_token: tenantApiToken || undefined,
                n8n_api_key: n8nApiKey || undefined,
                n8n_webhook_url: n8nWebhookUrl || undefined,
                chatwoot_base_url: chatwootBaseUrl || undefined,
                chatwoot_api_token: chatwootApiToken || undefined,
                chatwoot_account_id: chatwootAccountId || undefined,
                chatwoot_inbox_id: chatwootInboxId || undefined,
            };
            if (isEdit && tenant) {
                await api.updateTenant(tenant.id, payload as any);
            } else {
                await api.createTenant(payload as any);
            }
            onSaved();
        } catch (err: unknown) {
            const e = err as Error & { message?: string };
            setError(e?.message || "Failed to save tenant.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-5 animate-fade-in">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <Building2 size={22} className="text-indigo-600" />
                        {isEdit ? "Edit Tenant" : "Create Tenant"}
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition"
                    >
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-gray-600 mb-1">
                            Name *
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-400 focus:outline-none"
                            placeholder="e.g. AVA Day Spa"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-600 mb-1">
                            Slug
                        </label>
                        <input
                            type="text"
                            value={slug}
                            onChange={(e) => setSlug(e.target.value)}
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-400 focus:outline-none"
                            placeholder="auto-generated if empty"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-600 mb-1">
                            Status
                        </label>
                        <select
                            value={status}
                            onChange={(e) => setStatus(e.target.value as "active" | "suspended")}
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-400 focus:outline-none"
                        >
                            <option value="active">Active</option>
                            <option value="suspended">Suspended</option>
                        </select>
                    </div>

                    <div className="border-t border-gray-100 pt-4 mt-2">
                        <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                            <Shield size={16} className="text-indigo-600" />
                            Integraciones y API
                        </h3>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1 flex items-center justify-between">
                                    <span>Tenant API Token (n8n → SPA)</span>
                                    {tenantApiToken === '••••••••' && (
                                        <span className="flex items-center gap-1 text-[10px] text-emerald-600 font-medium normal-case">
                                            <CheckCircle size={10} /> Configurado
                                        </span>
                                    )}
                                </label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={tenantApiToken}
                                        onChange={(e) => {
                                            if (tenantApiToken === '••••••••' && !confirm("Este campo ya tiene una clave guardada. ¿Deseas reemplazarla?")) return;
                                            setTenantApiToken(e.target.value);
                                        }}
                                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-400 focus:outline-none text-sm ${tenantApiToken === '••••••••' ? 'bg-emerald-50/30 border-emerald-100 text-emerald-700 font-mono' : 'border-gray-300'}`}
                                        placeholder="Clave que n8n debe usar en el header X-API-KEY"
                                    />
                                    {tenantApiToken === '••••••••' && (
                                        <button 
                                            type="button"
                                            onClick={() => setTenantApiToken("")}
                                            className="absolute right-2 top-1.5 p-1 text-gray-400 hover:text-rose-500 rounded transition-colors"
                                            title="Limpiar para escribir nueva clave"
                                        >
                                            <RefreshCw size={14} />
                                        </button>
                                    )}
                                </div>
                                <p className="text-[10px] text-gray-400 mt-1 italic">
                                    Proporcione este token a n8n para autenticar las llamadas entrantes.
                                </p>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1 flex items-center justify-between">
                                    <span>N8N API Key (SPA → n8n API)</span>
                                    {n8nApiKey === '••••••••' && (
                                        <span className="flex items-center gap-1 text-[10px] text-emerald-600 font-medium normal-case">
                                            <CheckCircle size={10} /> Configurado
                                        </span>
                                    )}
                                </label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={n8nApiKey}
                                        onChange={(e) => {
                                            if (n8nApiKey === '••••••••' && !confirm("¿Deseas reemplazar la clave de n8n guardada?")) return;
                                            setN8nApiKey(e.target.value);
                                        }}
                                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-400 focus:outline-none text-sm ${n8nApiKey === '••••••••' ? 'bg-emerald-50/30 border-emerald-100 text-emerald-700 font-mono' : 'border-gray-300'}`}
                                        placeholder="API Key interna de n8n"
                                    />
                                    {n8nApiKey === '••••••••' && (
                                        <button 
                                            type="button"
                                            onClick={() => setN8nApiKey("")}
                                            className="absolute right-2 top-1.5 p-1 text-gray-400 hover:text-rose-500 rounded transition-colors"
                                        >
                                            <RefreshCw size={14} />
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                                    N8N Webhook URL (Salida)
                                </label>
                                <input
                                    type="url"
                                    value={n8nWebhookUrl}
                                    onChange={(e) => setN8nWebhookUrl(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-400 focus:outline-none text-sm"
                                    placeholder="https://n8n.tudominio.com/webhook/..."
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                                    Chatwoot Base URL
                                </label>
                                <input
                                    type="url"
                                    value={chatwootBaseUrl}
                                    onChange={(e) => setChatwootBaseUrl(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-400 focus:outline-none text-sm"
                                    placeholder="https://chat.midominio.com"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                                    Chatwoot Account ID
                                </label>
                                <input
                                    type="text"
                                    value={chatwootAccountId}
                                    onChange={(e) => setChatwootAccountId(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-400 focus:outline-none text-sm"
                                    placeholder="Ej: 1"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1 flex items-center justify-between">
                                    <span>Chatwoot API Token</span>
                                    {chatwootApiToken === '••••••••' && (
                                        <span className="flex items-center gap-1 text-[10px] text-emerald-600 font-medium normal-case">
                                            <CheckCircle size={10} /> Configurado
                                        </span>
                                    )}
                                </label>
                                <div className="relative">
                                    <input
                                        type="password"
                                        value={chatwootApiToken}
                                        onChange={(e) => {
                                            if (chatwootApiToken === '••••••••' && !confirm("¿Deseas reemplazar el token de Chatwoot guardado?")) return;
                                            setChatwootApiToken(e.target.value);
                                        }}
                                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-400 focus:outline-none text-sm ${chatwootApiToken === '••••••••' ? 'bg-emerald-50/30 border-emerald-100 text-emerald-700 font-mono' : 'border-gray-300'}`}
                                        placeholder="Tu API de acceso personal"
                                    />
                                    {chatwootApiToken === '••••••••' && (
                                        <button 
                                            type="button"
                                            onClick={() => setChatwootApiToken("")}
                                            className="absolute right-2 top-1.5 p-1 text-gray-400 hover:text-rose-500 rounded transition-colors"
                                        >
                                            <RefreshCw size={14} />
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                                    Chatwoot Inbox ID
                                </label>
                                <input
                                    type="text"
                                    value={chatwootInboxId}
                                    onChange={(e) => setChatwootInboxId(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-400 focus:outline-none text-sm"
                                    placeholder="Ej: 2"
                                />
                            </div>
                        </div>
                    </div>

                    {error && (
                        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                            {error}
                        </div>
                    )}
                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-50 transition"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving || !name.trim()}
                            className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 disabled:bg-indigo-300 disabled:cursor-not-allowed transition"
                        >
                            {saving ? "Saving…" : isEdit ? "Save Changes" : "Create"}
                        </button>
                    </div>
                </form >
            </div >
        </div >
    );
};

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
