import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CreateTenantModal from "../CreateTenantModal";
import { api } from "../../services/api";
import type { Tenant } from "../../types";

/**
 * Frontend consistency hotfix: Create Tenant's `timezone` field now reuses the SAME
 * TimezoneSelect component/utilities already approved for Tenant Edit -> Perfil, instead of a
 * separate free-text TextField. Covers: the field is a combobox (not free text), search/select
 * works, the create payload carries the exact IANA id, the pre-existing default is preserved
 * until the user deliberately changes it, and unrelated Create Tenant fields still make it into
 * the payload unchanged.
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
      createTenant: vi.fn(),
    },
  };
});

function makeTenant(overrides: Partial<Tenant> = {}): Tenant {
  return {
    id: 1,
    name: "AVA Day Spa",
    slug: "ava-day-spa",
    status: "active",
    ...overrides,
  };
}

/** Fills every OTHER required field so the form's own client-side validate() lets submission
 * through -- this hotfix only touches the timezone field, so the rest must be filled exactly as
 * a real user would to reach the actual api.createTenant() call. */
async function fillRequiredNonTimezoneFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByPlaceholderText("Ej: AVA Day Spa"), "AVA Day Spa");
  await user.type(screen.getByPlaceholderText("Ej: AVA Spa"), "AVA");
  await user.type(screen.getByPlaceholderText("Ada Lovelace"), "Ada Lovelace");

  const emailInputs = screen.getAllByPlaceholderText("ada@negocio.com");
  await user.type(emailInputs[0], "ada@ava.example.com"); // owner email
  await user.type(emailInputs[1], "contact@ava.example.com"); // contact email

  await user.type(screen.getByPlaceholderText("Mínimo 8 caracteres"), "password123");
  await user.type(screen.getByPlaceholderText("Repite la contraseña"), "password123");
  await user.type(screen.getByPlaceholderText("Ada"), "Ada");
  await user.type(screen.getByPlaceholderText("Lovelace"), "Lovelace");
  // currency ("USD") and country_code ("US") already have valid defaults -- untouched.
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("CreateTenantModal — timezone field is no longer free text", () => {
  it("renders the timezone field as the shared TimezoneSelect combobox", () => {
    render(<CreateTenantModal onClose={vi.fn()} onCreated={vi.fn()} />);

    const field = screen.getByRole("combobox", { name: /Zona horaria/i });
    expect(field.tagName).toBe("INPUT");
    expect(field).toHaveAttribute("role", "combobox");
    // Not a plain free-text TextField -- TimezoneSelect's distinctive search placeholder.
    expect(field).toHaveAttribute("placeholder", expect.stringContaining("Buscar zona horaria"));
  });
});

describe("CreateTenantModal — search and select", () => {
  it("America/New_York can be searched and selected", async () => {
    const user = userEvent.setup();
    render(<CreateTenantModal onClose={vi.fn()} onCreated={vi.fn()} />);

    const field = screen.getByRole("combobox", { name: /Zona horaria/i });
    await user.click(field);
    await user.type(field, "New York");
    await user.click(await screen.findByRole("button", { name: /America\/New_York/ }));

    expect(screen.getByDisplayValue("America/New_York")).toBeInTheDocument();
  });
});

describe("CreateTenantModal — create payload", () => {
  it("sends exactly timezone: 'America/New_York' after selecting it and submitting", async () => {
    vi.mocked(api.createTenant).mockResolvedValue(makeTenant());
    const onCreated = vi.fn();
    const user = userEvent.setup();

    render(<CreateTenantModal onClose={vi.fn()} onCreated={onCreated} />);

    const field = screen.getByRole("combobox", { name: /Zona horaria/i });
    await user.click(field);
    await user.type(field, "New York");
    await user.click(await screen.findByRole("button", { name: /America\/New_York/ }));

    await fillRequiredNonTimezoneFields(user);
    await user.click(screen.getByRole("button", { name: /Crear Tenant/i }));

    await waitFor(() => expect(api.createTenant).toHaveBeenCalled());
    const [payload] = vi.mocked(api.createTenant).mock.calls[0];
    expect(payload.timezone).toBe("America/New_York");
  });

  it("does not regress unrelated Create Tenant fields in the same payload", async () => {
    vi.mocked(api.createTenant).mockResolvedValue(makeTenant());
    const user = userEvent.setup();

    render(<CreateTenantModal onClose={vi.fn()} onCreated={vi.fn()} />);

    await fillRequiredNonTimezoneFields(user);
    await user.click(screen.getByRole("button", { name: /Crear Tenant/i }));

    await waitFor(() => expect(api.createTenant).toHaveBeenCalled());
    const [payload] = vi.mocked(api.createTenant).mock.calls[0];
    expect(payload.name).toBe("AVA Day Spa");
    expect(payload.trade_name).toBe("AVA");
    expect(payload.currency).toBe("USD");
    expect(payload.country_code).toBe("US");
    expect(payload.owner.name).toBe("Ada Lovelace");
    expect(payload.owner.email).toBe("ada@ava.example.com");
    expect(payload.contact.first_name).toBe("Ada");
    expect(payload.contact.last_name).toBe("Lovelace");
    expect(payload.contact.email).toBe("contact@ava.example.com");
  });
});

describe("CreateTenantModal — existing default is preserved until deliberately changed", () => {
  it("initializes to the pre-existing default (unchanged by this hotfix) and does not call the API on mount", () => {
    // Mirrors CreateTenantModal's own resolveDefaultTimezone(): browser-resolved timezone, else
    // America/New_York -- computed here rather than hardcoded so the assertion holds regardless
    // of which timezone the test runtime itself resolves to.
    let expectedDefault = "America/New_York";
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz && tz.trim()) expectedDefault = tz;
    } catch {
      // keep the America/New_York fallback
    }

    render(<CreateTenantModal onClose={vi.fn()} onCreated={vi.fn()} />);

    expect(screen.getByDisplayValue(expectedDefault)).toBeInTheDocument();
    expect(api.createTenant).not.toHaveBeenCalled();
  });

  it("only submits a different timezone once the user deliberately picks one", async () => {
    vi.mocked(api.createTenant).mockResolvedValue(makeTenant());
    const user = userEvent.setup();

    render(<CreateTenantModal onClose={vi.fn()} onCreated={vi.fn()} />);
    // Deliberately does NOT touch the timezone field.
    await fillRequiredNonTimezoneFields(user);
    await user.click(screen.getByRole("button", { name: /Crear Tenant/i }));

    await waitFor(() => expect(api.createTenant).toHaveBeenCalled());
    const [payload] = vi.mocked(api.createTenant).mock.calls[0];

    let expectedDefault = "America/New_York";
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz && tz.trim()) expectedDefault = tz;
    } catch {
      // keep the America/New_York fallback
    }
    expect(payload.timezone).toBe(expectedDefault);
  });
});
