import React, { useState } from "react";
import { Copy, Check } from "lucide-react";

/**
 * Extracted from TenantApiTokenRevealModal's copy-to-clipboard pattern -- same
 * `navigator.clipboard.writeText` + transient "Copiado" affordance, generalized to any plain
 * text value (never anything sensitive; this component has no notion of secrets).
 */
const CopyButton: React.FC<{
  value: string;
  label?: string;
  copiedLabel?: string;
  disabled?: boolean;
  className?: string;
}> = ({ value, label = "Copiar", copiedLabel = "Copiado", disabled = false, className = "" }) => {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  const handleCopy = async () => {
    setFailed(false);
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setFailed(true);
      window.setTimeout(() => setFailed(false), 2000);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      disabled={disabled}
      aria-label={label}
      className={`px-3 py-2 border rounded-lg text-gray-700 hover:bg-gray-50 transition flex items-center gap-1.5 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
      <span className="text-xs font-semibold">
        {failed ? "No se pudo copiar" : copied ? copiedLabel : label}
      </span>
    </button>
  );
};

export default CopyButton;
