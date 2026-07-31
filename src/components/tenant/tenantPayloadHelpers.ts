import { CreateTenantAddressPayload, UpdateTenantAddressPayload } from "../../types";

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface AddressFormValues {
  address_line_1: string;
  address_line_2: string;
  city: string;
  state: string;
  postal_code: string;
  country_code: string;
}

/**
 * Only includes the address block when the user entered real location data (line 1/2, city,
 * state, or postal code — after trimming whitespace). A country code alone, default or
 * user-entered, is never sufficient by itself to trigger inclusion — mirrors the backend's own
 * creation guard (TenantService::createTenant()), which treats an all-null/empty address block
 * as absent rather than creating a placeholder TenantAddress row.
 *
 * Shared by CreateTenantModal (result assigned to CreateTenantPayload.address) and
 * TenantFormModal (result assigned to UpdateTenantProfilePayload.address) — both payload
 * shapes are structurally identical (every field optional/nullable), so one function safely
 * produces either.
 */
export function buildAddressPayload(
  values: AddressFormValues,
): CreateTenantAddressPayload | UpdateTenantAddressPayload | undefined {
  const line1 = values.address_line_1.trim();
  const line2 = values.address_line_2.trim();
  const city = values.city.trim();
  const state = values.state.trim();
  const postalCode = values.postal_code.trim();
  const countryCode = values.country_code.trim().toUpperCase();

  const hasLocationData = line1 !== "" || line2 !== "" || city !== "" || state !== "" || postalCode !== "";
  if (!hasLocationData) return undefined;

  return {
    address_line_1: line1 || null,
    address_line_2: line2 || null,
    city: city || null,
    state: state || null,
    postal_code: postalCode || null,
    country_code: countryCode || null,
  };
}
