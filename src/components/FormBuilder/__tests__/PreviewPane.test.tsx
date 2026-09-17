import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PreviewPane from "../PreviewPane";
import { api, ApiError } from "../../../services/api";
import type { PublicLeadFormPreviewDescriptor } from "../../../types";

vi.mock("../../../services/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../services/api")>();
  return { ...actual, api: { getPublicLeadFormDraftPreview: vi.fn() } };
});

const DESCRIPTOR = (): PublicLeadFormPreviewDescriptor => ({
  ok: true,
  uuid: "form-uuid-1",
  version_uuid: "version-uuid-1",
  schema: [
    { field_key: "name", label: "Nombre", help_text: null, placeholder: "Tu nombre", position: 1, required: true },
    { field_key: "phone", label: "Teléfono", help_text: null, placeholder: null, position: 2, required: true },
    { field_key: "consent", label: "Acepto ser contactado", help_text: "Ver aviso", placeholder: null, position: 3, required: true },
  ],
  branding: {
    title: "Agenda tu consulta",
    subtitle: null,
    button_text: "Enviar",
    success_text: "Gracias",
    privacy_notice_text: null,
    primary_color: "#2F5C8A",
    border_radius_style: "rounded",
    logo_url: null,
  },
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PreviewPane", () => {
  it("renders the descriptor's fields and branding, never inside an iframe", async () => {
    vi.mocked(api.getPublicLeadFormDraftPreview).mockResolvedValue(DESCRIPTOR());
    render(<PreviewPane formId={1} />);

    expect(await screen.findByText("Agenda tu consulta")).toBeTruthy();
    expect(screen.getByText("Enviar")).toBeTruthy();
    expect(document.querySelector("iframe")).toBeNull();
  });

  it("toggles between desktop and mobile viewports without a new network request", async () => {
    vi.mocked(api.getPublicLeadFormDraftPreview).mockResolvedValue(DESCRIPTOR());
    const user = userEvent.setup();
    render(<PreviewPane formId={1} />);
    await screen.findByTestId("preview-frame");

    await user.click(screen.getByRole("tab", { name: /Móvil/i }));
    expect(screen.getByTestId("preview-frame").className).toContain("360px");

    await user.click(screen.getByRole("tab", { name: /Escritorio/i }));
    expect(screen.getByTestId("preview-frame").className).not.toContain("360px");

    expect(api.getPublicLeadFormDraftPreview).toHaveBeenCalledTimes(1);
  });

  it("never mounts a real Turnstile widget or a submit action -- the CTA button is disabled", async () => {
    vi.mocked(api.getPublicLeadFormDraftPreview).mockResolvedValue(DESCRIPTOR());
    render(<PreviewPane formId={1} />);
    await screen.findByText("Agenda tu consulta");

    expect(document.querySelector('[src*="turnstile"]')).toBeNull();
    expect(document.querySelector(".cf-turnstile")).toBeNull();
    const submitButton = screen.getByRole("button", { name: "Enviar" });
    expect(submitButton).toBeDisabled();
  });

  it("shows an empty state when the form has no draft yet (404 NO_DRAFT)", async () => {
    vi.mocked(api.getPublicLeadFormDraftPreview).mockRejectedValue(
      new ApiError("no draft", { status: 404, code: "NO_DRAFT" }),
    );
    render(<PreviewPane formId={1} />);
    expect(await screen.findByText(/todavía no tiene un borrador/i)).toBeTruthy();
  });

  it("shows a forbidden state for a 403, distinct from empty/error", async () => {
    vi.mocked(api.getPublicLeadFormDraftPreview).mockRejectedValue(new ApiError("forbidden", { status: 403 }));
    render(<PreviewPane formId={1} />);
    expect(await screen.findByText(/No tienes permiso/i)).toBeTruthy();
  });
});
