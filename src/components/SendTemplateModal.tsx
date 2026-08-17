import React, { useEffect, useState } from "react";
import { X, Loader2, Send, FileText, Lock } from "lucide-react";
import { api, ApiError } from "../services/api";
import { Conversation, WhatsappTemplate } from "../types";

function bodyPositions(template: WhatsappTemplate): number[] {
  return (template.parameter_schema || [])
    .filter((e) => e.component === "BODY")
    .map((e) => e.position)
    .sort((a, b) => a - b);
}

/** Mirrors the backend's WhatsappTemplateSendResolver eligibility for parameter format/schema
 * shape -- UI-only, backend remains the final authority and re-validates on send. */
function isSupported(template: WhatsappTemplate): boolean {
  const schema = template.parameter_schema || [];
  if (schema.some((e) => e.component !== "BODY")) return false;
  const format = (template.parameter_format || "").toUpperCase();
  return !format || format === "POSITIONAL";
}

function renderPreview(template: WhatsappTemplate, params: string[]): string {
  const bodyComponent = template.components?.find((c) => (c.type || "").toUpperCase() === "BODY");
  const text = bodyComponent?.text || template.body_preview || "";
  const positions = bodyPositions(template);
  return text.replace(/\{\{\s*(\d+)\s*\}\}/g, (match, posStr) => {
    const position = parseInt(posStr, 10);
    const idx = positions.indexOf(position);
    return idx >= 0 ? (params[idx] ?? match) : match;
  });
}

interface Props {
  conversation: Conversation;
  onClose: () => void;
  onSent: () => void;
  /** true when invoked from the closed-window panel -- restricts the list to templates the
   * backend allows while the window is closed. false for the optional open-window entry point,
   * which shows every enabled/available template regardless. */
  closedWindowOnly: boolean;
}

/**
 * Generic template picker. Shows only backend-eligible templates for the current context,
 * generates one input per required BODY positional parameter (backend is the only supported
 * shape today), and prefills the first parameter with the contact name as a convenience
 * default -- never anything beyond that.
 */
const SendTemplateModal: React.FC<Props> = ({ conversation, onClose, onSent, closedWindowOnly }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<WhatsappTemplate[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [params, setParams] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.listWhatsappTemplates({
          enabled: true,
          available: true,
          ...(closedWindowOnly ? { allowed_when_window_closed: true } : {}),
        });
        if (!cancelled) setTemplates(res.data);
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "No se pudieron cargar las plantillas.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [closedWindowOnly]);

  const selected = templates.find((t) => t.id === selectedId) || null;
  const contactName = conversation.contact_name || conversation.lead?.name || "";

  const handleSelect = (template: WhatsappTemplate) => {
    if (!isSupported(template)) return;
    setSelectedId(template.id);
    setSendError(null);
    const positions = bodyPositions(template);
    setParams(positions.map((_, idx) => (idx === 0 ? contactName : "")));
  };

  const preview = selected ? renderPreview(selected, params) : "";
  const allParamsFilled = params.every((p) => p.trim().length > 0);

  const handleSend = async () => {
    if (!selected || sending || !allParamsFilled) return;
    setSending(true);
    setSendError(null);
    try {
      await api.sendConversationMessage(conversation.id, undefined, {
        whatsapp_template_id: selected.id,
        template_params: params,
      });
      onSent();
    } catch (err) {
      setSendError(err instanceof ApiError ? err.message : "No se pudo enviar la plantilla.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50/80 shrink-0">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <FileText size={20} className="text-indigo-600" />
            Enviar plantilla
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition p-1 rounded-full hover:bg-gray-200">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x">
          <div className="p-4 space-y-2 overflow-y-auto max-h-[50vh] md:max-h-none">
            {loading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="animate-spin text-indigo-600" size={24} />
              </div>
            ) : error ? (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
            ) : templates.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-6">No hay plantillas disponibles para este contexto.</p>
            ) : (
              templates.map((t) => {
                const supported = isSupported(t);
                return (
                  <button
                    type="button"
                    key={t.id}
                    onClick={() => handleSelect(t)}
                    disabled={!supported}
                    title={!supported ? "Aún no soportado por SPA Manager Pro" : undefined}
                    className={`w-full text-left px-3 py-2.5 rounded-lg border text-sm transition ${
                      selectedId === t.id
                        ? "border-indigo-500 bg-indigo-50"
                        : supported
                          ? "border-gray-200 hover:bg-gray-50"
                          : "border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-gray-800">{t.name}</span>
                      {!supported && <Lock size={12} className="text-gray-400 shrink-0" />}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {t.language} · {t.category || "—"} · {t.status || "—"}
                    </div>
                    {!supported && <div className="text-[11px] text-gray-400 mt-1">Aún no soportado por SPA Manager Pro</div>}
                    {t.body_preview && <div className="text-xs text-gray-500 mt-1 line-clamp-2">{t.body_preview}</div>}
                  </button>
                );
              })
            )}
          </div>

          <div className="p-4 space-y-4">
            {!selected ? (
              <p className="text-sm text-gray-400 text-center py-6">Selecciona una plantilla para continuar.</p>
            ) : (
              <>
                <div>
                  <div className="text-xs font-bold text-gray-500 uppercase mb-1">Vista previa</div>
                  <div className="text-sm text-gray-800 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2.5 whitespace-pre-wrap">
                    {preview}
                  </div>
                </div>
                {params.length > 0 && (
                  <div className="space-y-3">
                    {params.map((value, idx) => (
                      <div key={idx}>
                        <label htmlFor={`template-param-${idx}`} className="block text-xs font-bold text-gray-500 uppercase mb-1">
                          Parámetro {idx + 1}
                        </label>
                        <input
                          id={`template-param-${idx}`}
                          type="text"
                          value={value}
                          onChange={(e) => {
                            const next = [...params];
                            next[idx] = e.target.value;
                            setParams(next);
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none"
                        />
                      </div>
                    ))}
                  </div>
                )}
                {sendError && (
                  <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{sendError}</p>
                )}
              </>
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-t bg-gray-50/80 shrink-0 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-50 transition"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={!selected || sending || !allParamsFilled}
            className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 disabled:bg-indigo-300 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
          >
            {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            Enviar
          </button>
        </div>
      </div>
    </div>
  );
};

export default SendTemplateModal;
