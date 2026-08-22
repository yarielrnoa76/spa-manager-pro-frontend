import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TenantFormModal from "../TenantFormModal";
import { api } from "../../services/api";
import type { Tenant } from "../../types";

/**
 * Frontend UX hotfix: Tenant Edit -> Perfil's `timezone` field is now a searchable IANA
 * combobox (TimezoneSelect) instead of a free-text TextField -- the backend AI runtime depends
 * on tenants.timezone holding a real IANA identifier. These tests cover the integration with
 * TenantFormModal's existing save flow: the save payload, the legacy-value-preservation
 * guarantee, and that opening the modal never mutates the stored value on its own.
 */

vi.mock("../../services/api", () => {
  class ApiError extends Error {
    code?: string;
    status?: number;
    errors?: Record<string, string[]>;
    constructor(message: string, opts?: { code?: string; status?: number; errors?: Record<string, string[]> }) {
      super(message);
      this.code = opts?.code;
      this.status = opts?.status;
      this.errors = opts?.errors;
    }
  }
  return {
    ApiError,
    api: {
      getTenantProfile: vi.fn(),
      updateTenantProfile: vi.fn(),
      listN8nConnections: vi.fn(),
    },
  };
});

function makeTenant(overrides: Partial<Tenant> = {}): Tenant {
  return {
    id: 1,
    name: "AVA Day Spa",
    slug: "ava-day-spa",
    status: "active",
    trade_name: "AVA",
    business_email: "hello@ava.example.com",
    currency: "USD",
    country_code: "US",
    timezone: "America/New_York",
    ...overrides,
  };
}

/** A profile response that satisfies TenantFormModal's client-side validateProfile() so
 * "Guardar perfil" can actually be clicked without unrelated validation errors interfering. */
function makeFullProfile(overrides: Partial<Tenant> = {}): Tenant {
  return {
    ...makeTenant(overrides),
    contact: {
      id: 1,
      type: "primary",
      is_primary: true,
      first_name: "Ada",
      last_name: "Lovelace",
      job_title: null,
      email: "ada@ava.example.com",
      phone: null,
      phone_extension: null,
    },
    ...overrides,
  };
}

async function renderProfileTab(tenant: Tenant, onTenantUpdated = vi.fn()) {
  render(<TenantFormModal tenant={tenant} onClose={vi.fn()} onTenantUpdated={onTenantUpdated} />);
  // Profile is the default tab; wait past the "Cargando información completa…" gate.
  await screen.findByRole("combobox", { name: /Zona horaria/i });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.listN8nConnections).mockResolvedValue([]);
});

describe("TenantFormModal — timezone field is no longer free text", () => {
  it("renders the timezone field as a combobox, not a plain text input", async () => {
    vi.mocked(api.getTenantProfile).mockResolvedValue(makeFullProfile());
    await renderProfileTab(makeTenant());

    const field = screen.getByRole("combobox", { name: /Zona horaria/i });
    expect(field.tagName).toBe("INPUT");
    expect(field).toHaveAttribute("role", "combobox");
  });

  it("displays the current timezone", async () => {
    vi.mocked(api.getTenantProfile).mockResolvedValue(makeFullProfile());
    await renderProfileTab(makeTenant({ timezone: "America/New_York" }));

    expect(screen.getByDisplayValue("America/New_York")).toBeInTheDocument();
  });
});

describe("TenantFormModal — saving the timezone", () => {
  it("selecting America/New_York and saving sends timezone: 'America/New_York' in the payload", async () => {
    vi.mocked(api.getTenantProfile).mockResolvedValue(makeFullProfile({ timezone: "UTC" }));
    vi.mocked(api.updateTenantProfile).mockResolvedValue(makeFullProfile({ timezone: "America/New_York" }));
    const user = userEvent.setup();

    await renderProfileTab(makeTenant({ timezone: "UTC" }));

    const field = screen.getByRole("combobox", { name: /Zona horaria/i });
    await user.click(field);
    await user.type(field, "New York");
    await user.click(await screen.findByRole("button", { name: /America\/New_York/ }));

    expect(screen.getByDisplayValue("America/New_York")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Guardar perfil/i }));

    await waitFor(() => expect(api.updateTenantProfile).toHaveBeenCalled());
    const [payload] = vi.mocked(api.updateTenantProfile).mock.calls[0];
    expect(payload.timezone).toBe("America/New_York");
  });

  it("does not regress unrelated profile fields in the same save payload", async () => {
    vi.mocked(api.getTenantProfile).mockResolvedValue(makeFullProfile());
    vi.mocked(api.updateTenantProfile).mockResolvedValue(makeFullProfile());
    const user = userEvent.setup();

    await renderProfileTab(makeTenant());
    await user.click(screen.getByRole("button", { name: /Guardar perfil/i }));

    await waitFor(() => expect(api.updateTenantProfile).toHaveBeenCalled());
    const [payload] = vi.mocked(api.updateTenantProfile).mock.calls[0];
    expect(payload.trade_name).toBe("AVA");
    expect(payload.currency).toBe("USD");
    expect(payload.country_code).toBe("US");
    expect(payload.contact.first_name).toBe("Ada");
    expect(payload.contact.email).toBe("ada@ava.example.com");
  });
});

describe("TenantFormModal — opening the modal never mutates timezone", () => {
  it("does not call updateTenantProfile just from mounting/loading the profile tab", async () => {
    vi.mocked(api.getTenantProfile).mockResolvedValue(makeFullProfile());
    await renderProfileTab(makeTenant());

    expect(api.updateTenantProfile).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue("America/New_York")).toBeInTheDocument();
  });
});

describe("TenantFormModal — legacy/unknown timezone is preserved", () => {
  it("preserves and displays an existing timezone value the browser's IANA list doesn't recognize", async () => {
    vi.mocked(api.getTenantProfile).mockResolvedValue(makeFullProfile({ timezone: "America/Notarealcity" }));
    await renderProfileTab(makeTenant({ timezone: "America/Notarealcity" }));

    expect(screen.getByDisplayValue("America/Notarealcity")).toBeInTheDocument();
  });

  it("saves the legacy value unchanged if the user never deliberately picks another one", async () => {
    vi.mocked(api.getTenantProfile).mockResolvedValue(makeFullProfile({ timezone: "America/Notarealcity" }));
    vi.mocked(api.updateTenantProfile).mockResolvedValue(makeFullProfile({ timezone: "America/Notarealcity" }));
    const user = userEvent.setup();

    await renderProfileTab(makeTenant({ timezone: "America/Notarealcity" }));
    await user.click(screen.getByRole("button", { name: /Guardar perfil/i }));

    await waitFor(() => expect(api.updateTenantProfile).toHaveBeenCalled());
    const [payload] = vi.mocked(api.updateTenantProfile).mock.calls[0];
    expect(payload.timezone).toBe("America/Notarealcity");
  });
});
