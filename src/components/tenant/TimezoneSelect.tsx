import React, { useEffect, useMemo, useRef, useState } from "react";
import { getSupportedTimezones, matchesTimezoneQuery, formatTimezoneLabel } from "../../utils/timezones";

const MAX_VISIBLE_OPTIONS = 80;

/**
 * Searchable IANA timezone selector for Tenant Edit -> Perfil (frontend UX hotfix). Replaces the
 * old free-text `timezone` TextField -- the backend AI runtime
 * (AiAgentConfigurationService::resolveTenantTimezone()) depends on tenants.timezone holding a
 * real IANA identifier, so this field only ever offers/saves values from the supported list.
 *
 * `value`/`onChange` always carry the raw IANA identifier (e.g. "America/New_York"), never a
 * display label -- the exact same contract TextField had, so this is a drop-in replacement for
 * TenantFormModal's payload wiring.
 *
 * Legacy safety: if the tenant's CURRENT value isn't in the generated timezone list (unknown or
 * invalid legacy data), it's kept as the first, selected option rather than silently dropped --
 * opening the form never rewrites it. It's only replaced once the user deliberately picks a
 * different zone from the list.
 */
export const TimezoneSelect: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  required?: boolean;
}> = ({ label, value, onChange, error, required }) => {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const supportedTimezones = useMemo(() => getSupportedTimezones(), []);

  const isCurrentValueUnknown = value.trim() !== "" && !supportedTimezones.includes(value);

  const options = useMemo(() => {
    return isCurrentValueUnknown ? [value, ...supportedTimezones] : supportedTimezones;
  }, [supportedTimezones, isCurrentValueUnknown, value]);

  const filteredOptions = useMemo(() => {
    return options.filter((tz) => matchesTimezoneQuery(tz, query)).slice(0, MAX_VISIBLE_OPTIONS);
  }, [options, query]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (tz: string) => {
    onChange(tz);
    setQuery("");
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setIsOpen(false);
      setQuery("");
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredOptions.length > 0) handleSelect(filteredOptions[0]);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
        {label}
        {required && " *"}
      </label>
      <input
        type="text"
        role="combobox"
        aria-expanded={isOpen}
        aria-label={label}
        autoComplete="off"
        value={isOpen ? query : value}
        onFocus={() => {
          setIsOpen(true);
          setQuery("");
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setIsOpen(true);
        }}
        onKeyDown={handleKeyDown}
        placeholder="Buscar zona horaria (ej. New York, Puerto Rico)…"
        className={`w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-indigo-400 focus:outline-none text-sm ${
          error ? "border-red-400" : "border-gray-300"
        }`}
      />
      {isCurrentValueUnknown && !isOpen && (
        <p className="text-[11px] text-amber-600 mt-1">
          Este valor no está en la lista de zonas horarias reconocidas por tu navegador — se conserva tal cual hasta
          que elijas otra.
        </p>
      )}
      {isOpen && (
        <ul
          role="listbox"
          aria-label={label}
          className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg"
        >
          {filteredOptions.length === 0 ? (
            <li className="px-3 py-2 text-sm text-gray-400">Sin resultados</li>
          ) : (
            filteredOptions.map((tz) => (
              <li key={tz} role="option" aria-selected={tz === value}>
                <button
                  type="button"
                  // Mousedown (not click) fires before the input's blur/outside-click handler
                  // would otherwise close the list first.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelect(tz);
                  }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 ${
                    tz === value ? "bg-indigo-50 font-semibold text-indigo-700" : "text-gray-700"
                  }`}
                >
                  {formatTimezoneLabel(tz)}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
};

export default TimezoneSelect;
