import React, { useState } from "react";
import { api } from "../services/api";
import { Tenant } from "../types";
import ChatwootConfigTab from "./ChatwootConfigTab";
import { Building2, X, Shield, CheckCircle, RefreshCw, Copy, MessageSquare, Link2 } from "lucide-react";

type Tab = "n8n" | "chatwoot";

const TenantFormModal: React.FC<{
  tenant?: Tenant | null;
  onClose: () => void;
  onSaved: () => void;
}> = ({ tenant, onClose, onSaved }) => {
  const isEdit = !!tenant;
  const [activeTab, setActiveTab] = useState<Tab>("n8n");

  // Common fields
  const [name, setName] = useState(tenant?.name || "");
  const [slug, setSlug] = useState(tenant?.slug || "");
  const [status, setStatus] = useState(tenant?.status || "active");

  // N8N fields
  const [tenantApiToken, setTenantApiToken] = useState(tenant?.tenant_api_token || "");
  const [n8nApiKey, setN8nApiKey] = useState(tenant?.n8n_api_key || "");
  const [n8nWebhookUrl, setN8nWebhookUrl] = useState(tenant?.n8n_webhook_url || "");

  // Chatwoot fields
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
        name, slug: slug || undefined, status,
        tenant_api_token: tenantApiToken || undefined,
        n8n_api_key: n8nApiKey || undefined,
        n8n_webhook_url: n8nWebhookUrl || undefined,
        chatwoot_base_url: chatwootBaseUrl || undefined,
        chatwoot_api_token: chatwootApiToken || undefined,
        chatwoot_account_id: chatwootAccountId || undefined,
        chatwoot_inbox_id: chatwootInboxId || undefined,
      };
      if (isEdit && tenant) {
        await api.updateTenant(tenant.id, payload as unknown as Partial<Tenant>);
      } else {
        await api.createTenant(payload as unknown as Partial<Tenant>);
      }
      onSaved();
    } catch (err: unknown) {
      const e = err as Error & { message?: string };
      setError(e?.message || "Failed to save tenant.");
    } finally {
      setSaving(false);
    }
  };

  const MaskedInput: React.FC<{ label: string; value: string; onChange: (v: string) => void; placeholder: string; copyValue?: string; isPassword?: boolean }> = ({ label, value, onChange, placeholder, copyValue, isPassword }) => (
    <div>
      <label className="block text-xs font-bold text-gray-500 uppercase mb-1 flex items-center justify-between">
        <span>{label}</span>
        {value === "••••••••" && <span className="flex items-center gap-1 text-[10px] text-emerald-600 font-medium normal-case"><CheckCircle size={10} /> Configurado</span>}
      </label>
      <div className="relative">
        <input
          type={isPassword ? "password" : "text"}
          value={value}
          onChange={(e) => {
            if (value === "••••••••" && !confirm("Este campo ya tiene una clave guardada. ¿Deseas reemplazarla?")) return;
            onChange(e.target.value);
          }}
          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-400 focus:outline-none text-sm ${value === "••••••••" ? "bg-emerald-50/30 border-emerald-100 text-emerald-700 font-mono" : "border-gray-300"}`}
          placeholder={placeholder}
        />
        {value === "••••••••" && (
          <div className="absolute right-2 top-1.5 flex items-center gap-1">
            {copyValue && (
              <button type="button" onClick={() => { navigator.clipboard.writeText(copyValue); alert("Copiado"); }} className="p-1 text-gray-400 hover:text-indigo-500 rounded transition-colors" title="Copiar"><Copy size={16} /></button>
            )}
            <button type="button" onClick={() => onChange("")} className="p-1 text-gray-400 hover:text-rose-500 rounded transition-colors" title="Limpiar"><RefreshCw size={14} /></button>
          </div>
        )}
      </div>
    </div>
  );

  const tabBtn = (tab: Tab, icon: React.ReactNode, label: string, configured: boolean) => (
    <button
      type="button"
      onClick={() => setActiveTab(tab)}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-sm font-bold transition-all ${activeTab === tab ? "bg-indigo-600 text-white shadow-lg" : "text-gray-600 hover:bg-gray-100"}`}
    >
      {icon}
      <div className="flex-1">
        <div>{label}</div>
        {configured && activeTab !== tab && <div className="text-[10px] font-medium opacity-70 flex items-center gap-1 mt-0.5"><CheckCircle size={10} /> Configurado</div>}
      </div>
    </button>
  );

  const n8nConfigured = !!(tenantApiToken && n8nApiKey);
  const cwConfigured = !!(chatwootBaseUrl && chatwootAccountId && chatwootInboxId);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-fade-in overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50/80 flex-shrink-0">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Building2 size={22} className="text-indigo-600" />
            {isEdit ? "Editar Tenant" : "Crear Tenant"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition p-1 rounded-full hover:bg-gray-200"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          {/* Common Fields — always visible */}
          <div className="px-6 py-4 border-b bg-white flex-shrink-0">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nombre *</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} required className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-400 focus:outline-none text-sm" placeholder="Ej: AVA Day Spa" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Slug</label>
                <input type="text" value={slug} onChange={(e) => setSlug(e.target.value)} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-400 focus:outline-none text-sm" placeholder="auto-generado" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Estado</label>
                <select value={status} onChange={(e) => setStatus(e.target.value as "active" | "suspended")} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-400 focus:outline-none text-sm bg-white">
                  <option value="active">Activo</option>
                  <option value="suspended">Suspendido</option>
                </select>
              </div>
            </div>
          </div>

          {/* Body: sidebar + content */}
          <div className="flex flex-1 overflow-hidden">
            {/* Left sidebar */}
            <div className="w-48 border-r bg-gray-50/50 p-3 space-y-2 flex-shrink-0">
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-2 mb-2">Integraciones</div>
              {tabBtn("n8n", <Link2 size={18} />, "N8N", n8nConfigured)}
              {tabBtn("chatwoot", <MessageSquare size={18} />, "Chatwoot", cwConfigured)}
            </div>

            {/* Right content */}
            <div className="flex-1 overflow-y-auto p-6">
              {activeTab === "n8n" && (
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2 mb-4">
                    <Shield size={16} className="text-indigo-600" /> Configuración N8N
                  </h3>
                  <MaskedInput label="Tenant API Token (n8n → SPA)" value={tenantApiToken} onChange={setTenantApiToken} placeholder="Clave para header X-API-KEY" copyValue={tenant?.tenant_api_token || ""} />
                  <p className="text-[10px] text-gray-400 italic -mt-2">Proporcione este token a n8n para autenticar las llamadas entrantes.</p>
                  <MaskedInput label="N8N API Key (SPA → n8n)" value={n8nApiKey} onChange={setN8nApiKey} placeholder="API Key interna de n8n" copyValue={tenant?.n8n_api_key || ""} />
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">N8N Webhook URL (Salida)</label>
                    <input type="url" value={n8nWebhookUrl} onChange={(e) => setN8nWebhookUrl(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-400 focus:outline-none text-sm" placeholder="https://n8n.tudominio.com/webhook/..." />
                  </div>
                </div>
              )}

              {activeTab === "chatwoot" && (
                <ChatwootConfigTab
                  baseUrl={chatwootBaseUrl}
                  apiToken={chatwootApiToken}
                  accountId={chatwootAccountId}
                  inboxId={chatwootInboxId}
                  onBaseUrlChange={setChatwootBaseUrl}
                  onApiTokenChange={setChatwootApiToken}
                  onAccountIdChange={setChatwootAccountId}
                  onInboxIdChange={setChatwootInboxId}
                  isEdit={isEdit}
                />
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t bg-gray-50/80 flex-shrink-0">
            {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">{error}</div>}
            <div className="flex gap-3">
              <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-50 transition">Cancelar</button>
              <button type="submit" disabled={saving || !name.trim()} className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 disabled:bg-indigo-300 disabled:cursor-not-allowed transition">
                {saving ? "Guardando…" : isEdit ? "Guardar Cambios" : "Crear Tenant"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TenantFormModal;
