import React, { useState, useEffect } from "react";
import { api } from "../services/api";
import {
  Wifi,
  WifiOff,
  CheckCircle,
  AlertTriangle,
  Plus,
  Loader2,
  Server,
  Inbox,
  RefreshCw,
} from "lucide-react";

interface ChatwootAccount {
  id: number;
  name: string;
  role: string;
  status: string;
}

interface ChatwootInbox {
  id: number;
  name: string;
  channel_type: string;
  phone_number?: string;
}

interface ChatwootConfigTabProps {
  baseUrl: string;
  apiToken: string;
  accountId: string;
  inboxId: string;
  onBaseUrlChange: (v: string) => void;
  onApiTokenChange: (v: string) => void;
  onAccountIdChange: (v: string) => void;
  onInboxIdChange: (v: string) => void;
  isEdit: boolean;
}

const ChatwootConfigTab: React.FC<ChatwootConfigTabProps> = ({
  baseUrl,
  apiToken,
  accountId,
  inboxId,
  onBaseUrlChange,
  onApiTokenChange,
  onAccountIdChange,
  onInboxIdChange,
  isEdit,
}) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [testing, setTesting] = useState(false);
  const [connectionOk, setConnectionOk] = useState<boolean | null>(null);
  const [connectionMsg, setConnectionMsg] = useState("");
  const [profileInfo, setProfileInfo] = useState<{ name: string; email: string } | null>(null);

  const [accounts, setAccounts] = useState<ChatwootAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);

  const [inboxes, setInboxes] = useState<ChatwootInbox[]>([]);
  const [loadingInboxes, setLoadingInboxes] = useState(false);

  const [creatingAccount, setCreatingAccount] = useState(false);
  const [newAccountName, setNewAccountName] = useState("");
  const [showCreateAccount, setShowCreateAccount] = useState(false);

  const [creatingInbox, setCreatingInbox] = useState(false);
  const [newInboxName, setNewInboxName] = useState("");
  const [showCreateInbox, setShowCreateInbox] = useState(false);

  const [error, setError] = useState<string | null>(null);

  // Determine initial step based on existing config
  useEffect(() => {
    if (isEdit && accountId && inboxId && baseUrl) {
      setStep(4);
      setConnectionOk(true);
    } else if (isEdit && accountId && baseUrl) {
      setStep(3);
      setConnectionOk(true);
    } else if (isEdit && baseUrl && apiToken && apiToken !== "••••••••") {
      setStep(1);
    }
  }, []);

  const realToken = apiToken === "••••••••" ? "" : apiToken;

  const handleTestConnection = async () => {
    if (!baseUrl || !realToken) return;
    setTesting(true);
    setError(null);
    setConnectionOk(null);
    try {
      const res = await api.chatwootTestConnection(baseUrl, realToken);
      if (res.ok) {
        setConnectionOk(true);
        setConnectionMsg(res.message);
        setProfileInfo(res.profile ? { name: res.profile.name, email: res.profile.email } : null);
        if (res.accounts) setAccounts(res.accounts);
        setStep(2);
      } else {
        setConnectionOk(false);
        setConnectionMsg(res.message || "Error de conexión");
      }
    } catch (e: any) {
      setConnectionOk(false);
      setConnectionMsg(e?.message || "No se pudo conectar");
    } finally {
      setTesting(false);
    }
  };

  const handleLoadInboxes = async (accId: string) => {
    if (!baseUrl || !realToken || !accId) return;
    setLoadingInboxes(true);
    setError(null);
    try {
      const res = await api.chatwootListInboxes(baseUrl, realToken, Number(accId));
      if (res.ok) setInboxes(res.inboxes);
      else setError("No se pudieron cargar los inboxes.");
    } catch (e: any) {
      setError(e?.message || "Error al cargar inboxes");
    } finally {
      setLoadingInboxes(false);
    }
  };

  const handleSelectAccount = (accId: string) => {
    onAccountIdChange(accId);
    setStep(3);
    handleLoadInboxes(accId);
  };

  const handleSelectInbox = (ibxId: string) => {
    onInboxIdChange(ibxId);
    setStep(4);
  };

  const handleCreateAccount = async () => {
    if (!newAccountName.trim()) return;
    setCreatingAccount(true);
    setError(null);
    try {
      const res = await api.chatwootCreateAccount(baseUrl, realToken, newAccountName.trim());
      if (res.ok && res.account) {
        setAccounts((prev) => [...prev, { id: res.account!.id, name: res.account!.name, role: "administrator", status: "active" }]);
        setShowCreateAccount(false);
        setNewAccountName("");
        handleSelectAccount(String(res.account.id));
      } else {
        setError(res.message || "No se pudo crear la cuenta.");
      }
    } catch (e: any) {
      setError(e?.message || "Error al crear cuenta");
    } finally {
      setCreatingAccount(false);
    }
  };

  const handleCreateInbox = async () => {
    if (!newInboxName.trim() || !accountId) return;
    setCreatingInbox(true);
    setError(null);
    try {
      const res = await api.chatwootCreateInbox(baseUrl, realToken, Number(accountId), newInboxName.trim());
      if (res.ok && res.inbox) {
        setInboxes((prev) => [...prev, { id: res.inbox!.id, name: res.inbox!.name, channel_type: res.inbox!.channel_type }]);
        setShowCreateInbox(false);
        setNewInboxName("");
        handleSelectInbox(String(res.inbox.id));
      } else {
        setError(res.message || "No se pudo crear el inbox.");
      }
    } catch (e: any) {
      setError(e?.message || "Error al crear inbox");
    } finally {
      setCreatingInbox(false);
    }
  };

  const stepLabel = (n: number, label: string, active: boolean, done: boolean) => (
    <div className={`flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-full transition-all ${done ? "bg-emerald-100 text-emerald-700" : active ? "bg-indigo-100 text-indigo-700" : "bg-gray-100 text-gray-400"}`}>
      {done ? <CheckCircle size={14} /> : <span className="w-4 h-4 rounded-full border-2 flex items-center justify-center text-[10px]" style={{ borderColor: "currentColor" }}>{n}</span>}
      <span className="hidden sm:inline">{label}</span>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Wizard Steps Indicator */}
      <div className="flex items-center gap-2 flex-wrap">
        {stepLabel(1, "Conexión", step === 1, step > 1)}
        <div className="w-4 h-px bg-gray-200" />
        {stepLabel(2, "Cuenta", step === 2, step > 2)}
        <div className="w-4 h-px bg-gray-200" />
        {stepLabel(3, "Inbox", step === 3, step > 3)}
        <div className="w-4 h-px bg-gray-200" />
        {stepLabel(4, "Resumen", step === 4, false)}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700 flex items-center gap-2">
          <AlertTriangle size={14} /> {error}
        </div>
      )}

      {/* STEP 1: Connection */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700">
            Ingresa la URL base y el token de API de tu instancia de Chatwoot para conectar.
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Chatwoot Base URL</label>
            <input
              type="url"
              value={baseUrl}
              onChange={(e) => onBaseUrlChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-400 focus:outline-none text-sm"
              placeholder="https://chat.tudominio.com"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">API Token (Super Admin)</label>
            <input
              type="password"
              value={apiToken}
              onChange={(e) => onApiTokenChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-400 focus:outline-none text-sm"
              placeholder="Tu token de acceso personal"
            />
          </div>

          {connectionOk !== null && (
            <div className={`flex items-center gap-2 text-sm font-semibold rounded-lg px-3 py-2 ${connectionOk ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
              {connectionOk ? <Wifi size={16} /> : <WifiOff size={16} />}
              {connectionMsg}
              {profileInfo && <span className="text-xs font-normal ml-2">({profileInfo.name})</span>}
            </div>
          )}

          <button
            type="button"
            onClick={handleTestConnection}
            disabled={testing || !baseUrl || (!realToken && apiToken !== "••••••••")}
            className="w-full py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
          >
            {testing ? <><Loader2 size={16} className="animate-spin" /> Probando...</> : <><Wifi size={16} /> Probar Conexión</>}
          </button>
        </div>
      )}

      {/* STEP 2: Select Account */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-gray-700 flex items-center gap-2"><Server size={16} className="text-indigo-500" /> Seleccionar Cuenta</h4>
            <button type="button" onClick={() => setStep(1)} className="text-xs text-indigo-600 hover:underline font-semibold">← Volver</button>
          </div>

          {loadingAccounts ? (
            <div className="flex items-center justify-center py-8 text-gray-400"><Loader2 size={20} className="animate-spin mr-2" /> Cargando...</div>
          ) : accounts.length === 0 ? (
            <div className="text-center text-gray-400 text-sm py-8">No se encontraron cuentas.</div>
          ) : (
            <div className="space-y-2 max-h-[240px] overflow-y-auto">
              {accounts.map((acc) => (
                <button
                  key={acc.id}
                  type="button"
                  onClick={() => handleSelectAccount(String(acc.id))}
                  className={`w-full text-left px-4 py-3 rounded-xl border transition-all flex items-center justify-between ${accountId === String(acc.id) ? "border-indigo-400 bg-indigo-50 ring-2 ring-indigo-200" : "border-gray-200 hover:border-indigo-300 hover:bg-gray-50"}`}
                >
                  <div>
                    <div className="font-bold text-sm text-gray-800">{acc.name}</div>
                    <div className="text-xs text-gray-400">ID: {acc.id} · {acc.role}</div>
                  </div>
                  {accountId === String(acc.id) && <CheckCircle size={18} className="text-indigo-600" />}
                </button>
              ))}
            </div>
          )}

          {!showCreateAccount ? (
            <button type="button" onClick={() => setShowCreateAccount(true)} className="flex items-center gap-2 text-xs text-indigo-600 font-bold hover:underline">
              <Plus size={14} /> Crear nueva cuenta
            </button>
          ) : (
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <label className="block text-xs font-bold text-gray-500 mb-1">Nombre de la nueva cuenta</label>
                <input type="text" value={newAccountName} onChange={(e) => setNewAccountName(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none" placeholder="Ej: Mi Spa" />
              </div>
              <button type="button" onClick={handleCreateAccount} disabled={creatingAccount || !newAccountName.trim()} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 disabled:bg-gray-300 transition flex items-center gap-1">
                {creatingAccount ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Crear
              </button>
              <button type="button" onClick={() => { setShowCreateAccount(false); setNewAccountName(""); }} className="px-3 py-2 text-gray-500 hover:text-gray-700 text-sm">✕</button>
            </div>
          )}
        </div>
      )}

      {/* STEP 3: Select Inbox */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-gray-700 flex items-center gap-2"><Inbox size={16} className="text-indigo-500" /> Seleccionar Inbox</h4>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => handleLoadInboxes(accountId)} className="text-xs text-gray-400 hover:text-indigo-600 transition"><RefreshCw size={12} /></button>
              <button type="button" onClick={() => setStep(2)} className="text-xs text-indigo-600 hover:underline font-semibold">← Volver</button>
            </div>
          </div>

          <div className="text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-1.5">Cuenta seleccionada: <strong className="text-gray-700">{accounts.find((a) => String(a.id) === accountId)?.name || `ID ${accountId}`}</strong></div>

          {loadingInboxes ? (
            <div className="flex items-center justify-center py-8 text-gray-400"><Loader2 size={20} className="animate-spin mr-2" /> Cargando inboxes...</div>
          ) : inboxes.length === 0 ? (
            <div className="text-center text-gray-400 text-sm py-8">No se encontraron inboxes en esta cuenta.</div>
          ) : (
            <div className="space-y-2 max-h-[240px] overflow-y-auto">
              {inboxes.map((ibx) => (
                <button
                  key={ibx.id}
                  type="button"
                  onClick={() => handleSelectInbox(String(ibx.id))}
                  className={`w-full text-left px-4 py-3 rounded-xl border transition-all flex items-center justify-between ${inboxId === String(ibx.id) ? "border-indigo-400 bg-indigo-50 ring-2 ring-indigo-200" : "border-gray-200 hover:border-indigo-300 hover:bg-gray-50"}`}
                >
                  <div>
                    <div className="font-bold text-sm text-gray-800">{ibx.name}</div>
                    <div className="text-xs text-gray-400">{ibx.channel_type}{ibx.phone_number ? ` · ${ibx.phone_number}` : ""}</div>
                  </div>
                  {inboxId === String(ibx.id) && <CheckCircle size={18} className="text-indigo-600" />}
                </button>
              ))}
            </div>
          )}

          {!showCreateInbox ? (
            <button type="button" onClick={() => setShowCreateInbox(true)} className="flex items-center gap-2 text-xs text-indigo-600 font-bold hover:underline">
              <Plus size={14} /> Crear nuevo inbox (API)
            </button>
          ) : (
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <label className="block text-xs font-bold text-gray-500 mb-1">Nombre del inbox</label>
                <input type="text" value={newInboxName} onChange={(e) => setNewInboxName(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none" placeholder="Ej: WhatsApp Bot" />
              </div>
              <button type="button" onClick={handleCreateInbox} disabled={creatingInbox || !newInboxName.trim()} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 disabled:bg-gray-300 transition flex items-center gap-1">
                {creatingInbox ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Crear
              </button>
              <button type="button" onClick={() => { setShowCreateInbox(false); setNewInboxName(""); }} className="px-3 py-2 text-gray-500 hover:text-gray-700 text-sm">✕</button>
            </div>
          )}
        </div>
      )}

      {/* STEP 4: Summary */}
      {step === 4 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-gray-700 flex items-center gap-2"><CheckCircle size={16} className="text-emerald-500" /> Configuración Completa</h4>
            <button type="button" onClick={() => setStep(1)} className="text-xs text-indigo-600 hover:underline font-semibold">Reconfigurar</button>
          </div>

          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-emerald-700 text-sm font-bold">
              <CheckCircle size={16} /> Chatwoot conectado correctamente
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-gray-500 font-bold uppercase block">Base URL</span>
                <span className="text-gray-800 font-mono break-all">{baseUrl || "—"}</span>
              </div>
              <div>
                <span className="text-gray-500 font-bold uppercase block">API Token</span>
                <span className="text-gray-800 font-mono">{apiToken ? "••••••••" : "—"}</span>
              </div>
              <div>
                <span className="text-gray-500 font-bold uppercase block">Account ID</span>
                <span className="text-gray-800 font-mono">{accountId || "—"}</span>
              </div>
              <div>
                <span className="text-gray-500 font-bold uppercase block">Inbox ID</span>
                <span className="text-gray-800 font-mono">{inboxId || "—"}</span>
              </div>
            </div>
          </div>

          <p className="text-xs text-gray-400 italic">Estos valores se guardarán al presionar "Guardar" en la parte inferior del formulario.</p>
        </div>
      )}
    </div>
  );
};

export default ChatwootConfigTab;
