/**
 * IANA timezone list/search helpers for the Tenant Profile timezone selector (frontend UX
 * hotfix). The backend's AI runtime (AiAgentConfigurationService::resolveTenantTimezone())
 * relies on tenants.timezone holding a real IANA identifier -- this module exists so the UI can
 * only ever offer/save real identifiers instead of free text like "EST" or "Eastern".
 *
 * No third-party timezone package: Intl.supportedValuesOf('timeZone') is the browser/Node-native
 * authoritative source when available; FALLBACK_TIMEZONES below is a small, deterministic list
 * for environments where it isn't (older browsers, some embedded webviews).
 */

export const FALLBACK_TIMEZONES: string[] = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Puerto_Rico",
  "America/Anchorage",
  "America/Mexico_City",
  "America/Bogota",
  "America/Lima",
  "America/Santiago",
  "America/Sao_Paulo",
  "America/Buenos_Aires",
  "Europe/London",
  "Europe/Madrid",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Kolkata",
  "Australia/Sydney",
  "Pacific/Honolulu",
];

/**
 * Authoritative runtime list. Falls back to FALLBACK_TIMEZONES whenever
 * Intl.supportedValuesOf is unavailable OR throws OR returns something unusable -- never lets a
 * runtime error break the tenant profile form.
 */
export function getSupportedTimezones(): string[] {
  try {
    if (typeof Intl !== "undefined" && typeof Intl.supportedValuesOf === "function") {
      const values = Intl.supportedValuesOf("timeZone");
      if (Array.isArray(values) && values.length > 0) {
        return values;
      }
    }
  } catch {
    // Fall through to the deterministic fallback list below.
  }
  return FALLBACK_TIMEZONES;
}

/** Underscores -> spaces, lowercased -- so "New York" and "New_York" search identically. */
export function normalizeForSearch(text: string): string {
  return text.replace(/_/g, " ").toLowerCase();
}

/** Case-insensitive, underscore-agnostic substring match against the full "Region/City" id --
 * matches fragments like "New York", "America", or "Puerto Rico" against "America/Puerto_Rico". */
export function matchesTimezoneQuery(zone: string, query: string): boolean {
  const normalizedQuery = normalizeForSearch(query.trim());
  if (normalizedQuery === "") return true;
  return normalizeForSearch(zone).includes(normalizedQuery);
}

/**
 * Best-effort current UTC offset label (e.g. "UTC-04:00"), computed for the given date so DST
 * is reflected correctly -- never a hardcoded permanent offset. Returns null (not thrown) if the
 * zone is unrecognized or the runtime lacks the needed Intl option, so callers can always fall
 * back to showing just the raw identifier.
 */
export function getTimezoneOffsetLabel(zone: string, date: Date = new Date()): string | null {
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: "longOffset" }).formatToParts(
      date,
    );
    const tzPart = parts.find((p) => p.type === "timeZoneName");
    if (!tzPart?.value) return null;
    if (tzPart.value === "GMT") return "UTC+00:00";
    return tzPart.value.replace("GMT", "UTC");
  } catch {
    return null;
  }
}

/** "America/New_York — UTC-04:00" when the offset can be computed, else just the raw
 * identifier -- the raw IANA id is always the first, unambiguous part of the label. */
export function formatTimezoneLabel(zone: string, date: Date = new Date()): string {
  const offset = getTimezoneOffsetLabel(zone, date);
  return offset ? `${zone} — ${offset}` : zone;
}
