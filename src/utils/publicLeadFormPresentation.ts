import { ApiError } from "../services/api";
import type { PublicLeadFormReadiness } from "../types";

/**
 * Spanish messages for every readiness/mutation code the Public Lead Forms control plane can
 * return. `enabled` (the persisted flag) and `published` (real public availability, which also
 * depends on the platform-wide master flag) are never the same thing -- this module treats them
 * as distinct on purpose; see getPublicLeadFormReadinessStatus.
 */
export const PUBLIC_LEAD_FORM_CODE_MESSAGES: Record<string, string> = {
  TENANT: "El tenant asociado a este formulario no existe o no está disponible.",
  BRANCH: "La sucursal asociada a este formulario no existe o no está activa.",
  LEAD_SOURCE: "La fuente de leads configurada para este formulario no es válida o no está activa.",
  TICKET_CATEGORY: "El tenant no tiene ninguna categoría de ticket activa configurada.",
  TICKET_PRIORITY: "El tenant no tiene ninguna prioridad de ticket activa configurada.",
  LEAD_NOTIFICATION_RECIPIENT:
    "No hay un responsable válido configurado para revisar los leads sin asignar de esta sucursal.",
  ALLOWED_ORIGINS: "Los orígenes permitidos no son válidos, están vacíos o contienen duplicados.",
  TURNSTILE_SECRET: "La clave secreta de verificación (Turnstile) no está configurada en la plataforma.",
  TRUSTED_PROXIES: "La lista de proxies confiables no está configurada correctamente para producción.",
  PUBLIC_WEB_INTAKE_DISABLED:
    "La captación pública está desactivada a nivel de plataforma. Esta configuración no puede cambiarse desde este formulario.",
  ENVIRONMENT_RESOLUTION_FAILED: "No se pudo determinar de forma segura el entorno de ejecución.",
  READINESS_CHECK_FAILED: "La verificación de disponibilidad falló justo antes de publicar. Vuelve a intentarlo.",
  // Mutation-specific codes (create/update), not part of the readiness gate itself.
  INCOMPATIBLE_LEAD_SOURCE: "La fuente de leads de este formulario ya existe con una configuración incompatible.",
  PUBLIC_LEAD_FORM_MUST_BE_PAUSED: "El formulario debe estar pausado antes de poder editarlo.",
  NOT_FOUND: "El formulario no existe o ya no está disponible.",
  UPDATE_FAILED: "No se pudo actualizar el formulario.",
  PUBLISH_FAILED: "No se pudo publicar el formulario.",
};

export function getCodeMessage(code: string | undefined | null, fallback: string): string {
  if (!code) return fallback;
  return PUBLIC_LEAD_FORM_CODE_MESSAGES[code] ?? fallback;
}

/** Turns any error from a Public Lead Forms mutation into one clear Spanish sentence. */
export function getPublicLeadFormMutationErrorMessage(
  error: unknown,
  fallback = "Ocurrió un error inesperado. Inténtalo de nuevo.",
): string {
  if (!(error instanceof ApiError)) return fallback;

  if (error.code && PUBLIC_LEAD_FORM_CODE_MESSAGES[error.code]) {
    return PUBLIC_LEAD_FORM_CODE_MESSAGES[error.code];
  }

  if (error.status === 403) return "No tienes autorización para realizar esta acción.";
  if (error.status === 404) return PUBLIC_LEAD_FORM_CODE_MESSAGES.NOT_FOUND;

  if (error.status === 422) {
    const firstFieldErrors = error.errors ? Object.values(error.errors)[0] : undefined;
    return firstFieldErrors?.[0] || error.message || fallback;
  }

  if (error.status === 409) return error.message || fallback;

  return error.message || fallback;
}

export type PublicLeadFormStatusKey =
  | "published"
  | "ready_to_publish"
  | "needs_configuration"
  | "global_intake_disabled"
  | "paused";

export interface PublicLeadFormStatusPresentation {
  key: PublicLeadFormStatusKey;
  label: string;
}

/**
 * The full 5-state picture requires the readiness snapshot -- `enabled` alone (all the list
 * endpoint ever returns) can never distinguish "ready to publish" from "blocked" from "globally
 * disabled". Order matters: `published` is checked first (it already implies neither a blocking
 * condition nor the master flag being the issue); the platform-wide master flag is called out
 * distinctly ONLY while the form itself is enabled (a paused form blocked solely by the master
 * flag is just "Pausado" -- there is nothing to configure on the form itself, and this control
 * plane has no switch for the master flag).
 */
export function getPublicLeadFormReadinessStatus(
  readiness: PublicLeadFormReadiness,
): PublicLeadFormStatusPresentation {
  if (readiness.published) {
    return { key: "published", label: "Publicado" };
  }

  const blockingCode = readiness.blocking_condition?.code;

  if (blockingCode === "PUBLIC_WEB_INTAKE_DISABLED" && readiness.form_enabled) {
    return { key: "global_intake_disabled", label: "Captación global desactivada" };
  }

  if (readiness.blocking_condition && blockingCode !== "PUBLIC_WEB_INTAKE_DISABLED") {
    return { key: "needs_configuration", label: "Requiere configuración" };
  }

  if (!readiness.form_enabled && readiness.activatable) {
    return { key: "ready_to_publish", label: "Listo para publicar" };
  }

  return { key: "paused", label: "Pausado" };
}

/**
 * The list endpoint only ever returns `enabled` -- never the readiness snapshot. `enabled=true`
 * is NOT proof the form is effectively published: the platform-wide master flag, or any
 * prerequisite gate, can still leave it unreachable publicly. "Publicado" is reserved
 * exclusively for `readiness.published === true` (see getPublicLeadFormReadinessStatus) -- this
 * label is a plain, honest two-state persisted-flag indicator, never a availability claim.
 */
export function getPublicLeadFormEnabledLabel(enabled: boolean): string {
  return enabled ? "Habilitado" : "Pausado";
}

const PUBLIC_LEAD_FORM_KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isValidPublicLeadFormKey(key: string): boolean {
  return PUBLIC_LEAD_FORM_KEY_PATTERN.test(key);
}

/**
 * A reasonable client-side sanity filter, never a replacement for the backend's own
 * canonicalization/authority: scheme://host[:port] only -- no credentials, path, query, or
 * fragment. Never silently rewrites or strips part of what the user typed.
 */
export function isValidAllowedOrigin(origin: string): boolean {
  if (typeof origin !== "string" || origin === "" || origin.trim() !== origin) return false;

  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }

  if (url.username !== "" || url.password !== "") return false;
  if (url.search !== "" || url.hash !== "") return false;
  if (url.pathname !== "/" && url.pathname !== "") return false;
  if (url.hostname === "") return false;

  return true;
}

function canonicalOriginKey(origin: string): string {
  const url = new URL(origin);
  return `${url.protocol}//${url.host.toLowerCase()}`;
}

/** Index of the first origin that duplicates an earlier one (by scheme+host, case-insensitive),
 * among the entries that are individually valid -- or null if there is no duplicate. */
export function findDuplicateAllowedOriginIndex(origins: string[]): number | null {
  const seen = new Set<string>();
  for (let i = 0; i < origins.length; i += 1) {
    if (!isValidAllowedOrigin(origins[i])) continue;
    const key = canonicalOriginKey(origins[i]);
    if (seen.has(key)) return i;
    seen.add(key);
  }
  return null;
}
