import React from "react";

export interface TabItem {
  key: string;
  label: string;
  disabled?: boolean;
}

/**
 * Generic tab strip, extracted from Settings.tsx's local `TabButton` (same visual language:
 * active = filled indigo, inactive = white/border) so Form Builder B3's sub-navigation
 * (General/Campos/Preview/Publicación) doesn't grow a second, drifting copy of the same pattern.
 * Purely presentational -- the caller owns what "active" means (local state or a route match).
 */
const Tabs: React.FC<{
  items: TabItem[];
  activeKey: string;
  onChange: (key: string) => void;
  ariaLabel?: string;
}> = ({ items, activeKey, onChange, ariaLabel }) => (
  <div role="tablist" aria-label={ariaLabel} className="flex flex-wrap gap-2">
    {items.map((item) => (
      <button
        key={item.key}
        type="button"
        role="tab"
        aria-selected={item.key === activeKey}
        disabled={item.disabled}
        onClick={() => !item.disabled && onChange(item.key)}
        className={`px-4 py-2 rounded-lg font-semibold text-sm border transition-colors ${
          item.key === activeKey
            ? "bg-indigo-600 text-white border-indigo-600"
            : item.disabled
              ? "bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed"
              : "bg-white text-gray-700 hover:bg-gray-50"
        }`}
      >
        {item.label}
      </button>
    ))}
  </div>
);

export default Tabs;
