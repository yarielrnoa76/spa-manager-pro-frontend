import React, { useEffect, useMemo, useState } from "react";
import { X, Loader2, Send, MessageSquareText } from "lucide-react";
import { api, ApiError } from "../services/api";
import { Conversation, WhatsappTemplate } from "../types";

function bodyComponentText(template: WhatsappTemplate): string {
  const bodyComponent = template.components?.find((c) => (c.type || "").toUpperCase() === "BODY");
  return bodyComponent?.text || template.body_preview || "";
}

function renderPreview(template: WhatsappTemplate, params: string[]): string {
  return bodyComponentText(template).replace(/\{\{\s*(\d+)\s*\}\}/g, (match, position) => {
    const index = parseInt(position, 10) - 1;
    return params[index] ?? match;
  });
}

function bodyParamCount(template: WhatsappTemplate): number {
  return (template.parameter_schema || []).filter((e) => e.component === "BODY").length;
}

/** Only "one BODY positional parameter, mapped to the contact name" (or zero params) is safe
 * to auto-fill without guessing. Anything else routes the user into SendTemplateModal instead. */
function isSafeToAutoFill(template: WhatsappTemplate): boolean {
  const schema = template.parameter_schema || [];
  if (schema.some((e) => e.component !== "BODY")) return false;
  return bodyParamCount(template) <= 1;
}

interface Props {
  conversation: Conversation;
  onClose: () => void;
  onSent: () => void;
  onOpenSendTemplate: () => void;
}

/**
 * Fast/default closed-window action: finds the tenant's single enabled/available/approved
 * template marked is_default_closed_window=true (preferring the lead's language when there's
 * more than one), auto-fills its one safe parameter (the contact name), and sends after
 * confirmation. Never guesses at anything more complex -- that's what SendTemplateModal is for.
 */
const NotifyContactModal: React.FC<Props> = ({ conversation, onClose, onSent, onOpenSendTemplate }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<WhatsappTemplate[]>([]);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.listWhatsappTemplates({ enabled: true, available: true, allowed_when_window_closed: true });
        if (cancelled) return;
        setCandidates(res.data.filter((t) => t.is_default_closed_window && (t.status || "").toLowerCase() === "approved"));
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "No se pudieron cargar las plantillas.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const contactName = conversation.contact_name || conversation.lead?.name || "";
  const preferredLanguage = conversation.lead?.preferred_language;

  const selected = useMemo<WhatsappTemplate | null>(() => {
    if (candidates.length === 0) return null;
    if (preferredLanguage) {
      const matches = candidates.filter((t) => t.language?.toLowerCase().startsWith(preferredLanguage.toLowerCase()));
      if (matches.length === 1) return matches[0];
    }
    return candidates.length === 1 ? candidates[0] : null;
  }, [candidates, preferredLanguage]);

  const safeToAutoSend = selected !== null && isSafeToAutoFill(selected);
  const params = useMemo(() => (selected && bodyParamCount(selected) === 1 ? [contactName] : []), [selected, contactName]);
  const preview = selected ? renderPreview(selected, params) : "";

  const handleSend = async () => {
    if (!selected || sending) return;
    setSending(true);
    setSendError(null);
    try {
      await api.sendConversationMessage(conversation.id, undefined, {
        whatsapp_template_id: selected.id,
        template_params: params,
      });
      onSent();
    } catch (err) {
      setSendError(err instanceof ApiError ? err.message : "No se pudo enviar la notificación.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50/80 shrink-0">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <MessageSquareText size={20} className="text-indigo-600" />
            Notificar al contacto
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition p-1 rounded-full hover:bg-gray-200">
            <X size={20} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="animate-spin text-indigo-600" size={24} />
            </div>
          ) : error ? (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          ) : !selected ? (
            <div className="text-sm text-gray-600 space-y-3">
              <p>
                {candidates.length === 0
                  ? "Este tenant aún no tiene una plantilla predeterminada configurada para ventana cerrada."
                  : "No se pudo determinar automáticamente una única plantilla predeterminada para este contacto."}
              </p>
              <button
                type="button"
                onClick={onOpenSendTemplate}
                className="w-full px-4 py-2.5 border border-indigo-200 text-indigo-700 bg-indigo-50 rounded-lg font-semibold hover:bg-indigo-100 transition text-sm"
              >
                Elegir plantilla manualmente
              </button>
            </div>
          ) : !safeToAutoSend ? (
            <div className="text-sm text-gray-600 space-y-3">
              <p>
                La plantilla predeterminada (<strong>{selected.name}</strong>) requiere parámetros que no se
                pueden completar automáticamente de forma segura.
              </p>
              <button
                type="button"
                onClick={onOpenSendTemplate}
                className="w-full px-4 py-2.5 border border-indigo-200 text-indigo-700 bg-indigo-50 rounded-lg font-semibold hover:bg-indigo-100 transition text-sm"
              >
                Completar parámetros manualmente
              </button>
            </div>
          ) : (
            <>
              <div>
                <div className="text-xs font-bold text-gray-500 uppercase mb-1">Plantilla</div>
                <div className="text-sm font-semibold text-gray-800">{selected.name}</div>
                <div className="text-xs text-gray-400">
                  {selected.language} · {selected.category || "—"}
                </div>
              </div>
              <div>
                <div className="text-xs font-bold text-gray-500 uppercase mb-1">Vista previa</div>
                <div className="text-sm text-gray-800 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2.5 whitespace-pre-wrap">
                  {preview}
                </div>
              </div>
              <p className="text-xs text-gray-400">
                El contacto debe responder antes de que puedas volver a enviar mensajes de texto libre.
              </p>
              {sendError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{sendError}</p>
              )}
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t bg-gray-50/80 shrink-0 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-50 transition"
          >
            Cancelar
          </button>
          {selected && safeToAutoSend && (
            <button
              type="button"
              onClick={handleSend}
              disabled={sending}
              className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 disabled:bg-indigo-300 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
            >
              {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              Enviar notificación
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default NotifyContactModal;
