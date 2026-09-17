import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import GeneralTab from "../GeneralTab";
import { api, ApiError } from "../../../services/api";
import type { PublicLeadForm } from "../../../types";

vi.mock("../../../services/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../services/api")>();
  return { ...actual, api: { updatePublicLeadForm: vi.fn() } };
});

const FORM = (overrides: Partial<PublicLeadForm> = {}): PublicLeadForm => ({
  id: 1,
  uuid: "uuid-1",
  name: "Contact Form",
  key: "contact-form",
  branch_id: 1,
  branch: { id: 1, name: "Main Branch" },
  lead_source_key: "public_web_form",
  enabled: false,
  allowed_origins: ["https://example.com"],
  embed_origins: ["https://embed.example.com"],
  created_by_user_id: null,
  created_by: null,
  updated_by_user_id: null,
  updated_by: null,
  created_at: null,
  updated_at: null,
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GeneralTab — allowed_origins vs embed_origins are kept strictly distinct", () => {
  it("renders both lists separately, seeded from their own field", () => {
    render(<GeneralTab form={FORM()} canManage onSaved={vi.fn()} />);
    expect(screen.getByLabelText("Orígenes permitidos 1")).toHaveValue("https://example.com");
    expect(screen.getByLabelText("Orígenes de embebido 1")).toHaveValue("https://embed.example.com");
  });

  it("saving sends both fields, never mixing one list's values into the other", async () => {
    vi.mocked(api.updatePublicLeadForm).mockResolvedValue(FORM());
    const user = userEvent.setup();
    render(<GeneralTab form={FORM()} canManage onSaved={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /Guardar cambios/i }));

    await waitFor(() =>
      expect(api.updatePublicLeadForm).toHaveBeenCalledWith(1, {
        name: "Contact Form",
        allowed_origins: ["https://example.com"],
        embed_origins: ["https://embed.example.com"],
      }),
    );
  });

  it("rejects a wildcard in embed_origins client-side, without touching allowed_origins", async () => {
    const user = userEvent.setup();
    render(<GeneralTab form={FORM()} canManage onSaved={vi.fn()} />);
    const embedInput = screen.getByLabelText("Orígenes de embebido 1");
    await user.clear(embedInput);
    await user.type(embedInput, "https://*.example.com");
    await user.click(screen.getByRole("button", { name: /Guardar cambios/i }));

    expect(await screen.findByText(/comodín/i)).toBeTruthy();
    expect(api.updatePublicLeadForm).not.toHaveBeenCalled();
  });
});

describe("GeneralTab — 409 must-be-paused and 422 handling", () => {
  it("shows a clear message for 409 PUBLIC_LEAD_FORM_MUST_BE_PAUSED", async () => {
    vi.mocked(api.updatePublicLeadForm).mockRejectedValue(
      new ApiError("must be paused", { status: 409, code: "PUBLIC_LEAD_FORM_MUST_BE_PAUSED" }),
    );
    const user = userEvent.setup();
    render(<GeneralTab form={FORM()} canManage onSaved={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /Guardar cambios/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/debe estar pausado/i);
  });

  it("maps a 422 allowed_origins field error onto its own row", async () => {
    vi.mocked(api.updatePublicLeadForm).mockRejectedValue(
      new ApiError("Validation failed.", {
        status: 422,
        errors: { "allowed_origins.0": ["Origin is invalid."] },
      }),
    );
    const user = userEvent.setup();
    render(<GeneralTab form={FORM()} canManage onSaved={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /Guardar cambios/i }));

    expect(await screen.findByText("Origin is invalid.")).toBeTruthy();
  });
});

describe("GeneralTab — read-only user", () => {
  it("disables every input and shows no save button without manage_public_lead_forms", () => {
    render(<GeneralTab form={FORM()} canManage={false} onSaved={vi.fn()} />);
    expect(screen.getByLabelText(/^Nombre$/i)).toBeDisabled();
    expect(screen.getByLabelText("Orígenes permitidos 1")).toBeDisabled();
    expect(screen.getByLabelText("Orígenes de embebido 1")).toBeDisabled();
    expect(screen.queryByRole("button", { name: /Guardar cambios/i })).toBeNull();
  });
});
