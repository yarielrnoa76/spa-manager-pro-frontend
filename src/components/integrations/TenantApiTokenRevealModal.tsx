import React, { useEffect, useRef, useState } from "react";
import { KeyRound, X, Copy, Check, ShieldAlert } from "lucide-react";

/**
 * Shows a freshly minted integration token exactly once.
 *
 * The plaintext arrives as a prop straight from the create/rotate response and lives nowhere else:
 * not in localStorage, not in sessionStorage, not in the URL, not in a fetch, not in an analytics
 * call, and never in a log line. It is held in a ref that is cleared on close, and the DOM node
 * holding it unmounts with the modal, so after `onClose` there is nothing left to read.
 *
 * The backend has no endpoint that can return it again -- `status` is metadata only -- so "copy it
 * now" is a statement of fact rather than a nag. That is exactly why closing is a deliberate,
 * confirmed action rather than a stray click on the backdrop or an Escape keypress: an accidental
 * dismissal here costs a rotation.
 *
 * Deliberately NOT reused from RotateChatwootTokenModal: that modal *collects* a secret the operator
 * already has, this one *discloses* one that will never be shown again. The visual shell follows it,
 * the semantics are the opposite.
 */
const TenantApiTokenRevealModal: React.FC<{
  plainTextToken: string;
  tenantId: number;
  abilities: string[];
  isRotationCandidate?: boolean;
  onClose: () => void;
}> = ({ plainTextToken, tenantId, abilities, isRotationCandidate = false, onClose }) => {
  const [copied, setCopied] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Held in a ref as well so the close handler can null it explicitly rather than relying on
  // unmount alone to drop the last reference.
  const tokenRef = useRef<string | null>(plainTextToken);

  // Focus lands on the panel itself, not on the close button: that button starts disabled until
  // the operator acknowledges, and focusing a disabled element is a no-op that would silently
  // leave focus on the page behind the dialog.
  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  const handleClose = () => {
    tokenRef.current = null;
    setCopied(false);
    setAcknowledged(false);
    onClose();
  };

  const handleCopy = async () => {
    const value = tokenRef.current;
    if (!value) return;

    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      // Only a flag flips; the token itself is never echoed anywhere as part of this.
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // A clipboard denied by the browser is not an error worth surfacing a secret over. The
      // operator can still select the value manually, and nothing is logged.
      setCopied(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tenant-api-token-reveal-title"
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh] outline-none"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50/80 shrink-0">
          <h2 id="tenant-api-token-reveal-title" className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <KeyRound size={20} className="text-indigo-600" />
            {isRotationCandidate ? "Nuevo token candidato" : "Token de acceso API generado"}
          </h2>
        </div>

        <div className="px-6 py-5 space-y-4 overflow-y-auto">
          <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-start gap-2">
            <ShieldAlert size={16} className="text-amber-600 mt-0.5 shrink-0" />
            <span>
              <strong>Este token se muestra una sola vez.</strong> No podrá recuperarse después de
              cerrar esta ventana. Si lo pierde, la única salida es generar o rotar otro.
            </span>
          </p>

          <div>
            <label htmlFor="tenant-api-token-value" className="block text-xs font-bold text-gray-500 uppercase mb-1">
              Token
            </label>
            <div className="flex gap-2">
              <input
                id="tenant-api-token-value"
                readOnly
                value={plainTextToken}
                onFocus={(e) => e.currentTarget.select()}
                className="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg text-sm font-mono bg-gray-50 text-gray-800"
              />
              <button
                type="button"
                onClick={handleCopy}
                aria-label="Copiar token"
                className="px-3 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition flex items-center gap-1.5 shrink-0"
              >
                {copied ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
                <span className="text-sm font-semibold">{copied ? "Copiado" : "Copiar"}</span>
              </button>
            </div>
          </div>

          <div>
            <p className="text-xs font-bold text-gray-500 uppercase mb-1">Permisos incluidos</p>
            <div className="flex flex-wrap gap-1.5">
              {abilities.map((ability) => (
                <span key={ability} className="text-xs font-mono bg-indigo-50 text-indigo-700 border border-indigo-100 rounded px-2 py-0.5">
                  {ability}
                </span>
              ))}
            </div>
          </div>

          {/* Static instructions. The token is interpolated here on purpose while the modal is
              open -- it is the same value already visible above -- and this whole block unmounts
              with the modal, so no rendered copy survives the close. */}
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase mb-1">Cómo usarlo</p>
            <pre className="text-[11px] bg-gray-900 text-gray-100 rounded-lg px-3 py-2.5 overflow-x-auto font-mono">
{`Authorization: Bearer ${plainTextToken}
X-Tenant-ID: ${tenantId}`}
            </pre>
            <p className="text-[11px] text-gray-500 mt-1.5">
              Ambas cabeceras son obligatorias. El tenant del encabezado debe coincidir con el del
              token, o la petición se rechaza.
            </p>
          </div>

          {isRotationCandidate && (
            <p className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
              El token anterior sigue activo. Actualice el consumidor con este token y solo entonces
              confirme la rotación; si algo falla, descarte el candidato y nada cambia.
            </p>
          )}

          <label className="flex items-start gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="mt-0.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-400"
            />
            <span>He guardado el token en un lugar seguro.</span>
          </label>
        </div>

        <div className="px-6 py-4 border-t bg-gray-50/80 shrink-0">
          <button
            type="button"
            onClick={handleClose}
            disabled={!acknowledged}
            className="w-full px-4 py-2.5 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 disabled:bg-indigo-300 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
          >
            <X size={16} />
            Cerrar y borrar de pantalla
          </button>
        </div>
      </div>
    </div>
  );
};

export default TenantApiTokenRevealModal;
