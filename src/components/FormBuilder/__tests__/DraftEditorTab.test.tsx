import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DraftEditorTab from "../DraftEditorTab";
import { api, ApiError } from "../../../services/api";
import type { PublicLeadFormDraft, PublicLeadFormReadiness } from "../../../types";

vi.mock("../../../services/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../services/api")>();
  return {
    ...actual,
    api: {
      getPublicLeadFormDraft: vi.fn(),
      updatePublicLeadFormDraft: vi.fn(),
    },
  };
});

const DRAFT = (overrides: Partial<PublicLeadFormDraft> = {}): PublicLeadFormDraft => ({
  uuid: "v-uuid-1",
  version_number: 1,
  status: "draft",
  schema: [
    { field_key: "name", label: "Nombre", help_text: null, placeholder: null, position: 1, visible: true, required: true },
    { field_key: "phone", label: "Teléfono", help_text: null, placeholder: null, position: 2, visible: true, required: true },
    { field_key: "email", label: "Correo", help_text: null, placeholder: null, position: 3, visible: true, required: false },
    { field_key: "last_name", label: "Apellido", help_text: null, placeholder: null, position: 4, visible: true, required: false },
    { field_key: "message", label: "Mensaje", help_text: null, placeholder: null, position: 5, visible: true, required: false },
    { field_key: "consent", label: "Consentimiento", help_text: "Ver aviso", placeholder: null, position: 6, visible: true, required: true },
  ],
  branding: {
    title: "Agenda tu consulta",
    subtitle: null,
    button_text: "Enviar",
    success_text: "Gracias",
    privacy_notice_text: null,
    primary_color: "#2F5C8A",
    border_radius_style: "rounded",
    show_logo: false,
  },
  created_at: "2026-09-01T00:00:00Z",
  updated_at: "2026-09-01T00:00:00Z",
  ...overrides,
});

const READINESS = (overrides: Partial<PublicLeadFormReadiness> = {}): PublicLeadFormReadiness => ({
  form_id: 1,
  form_uuid: "uuid-1",
  environment: "qa",
  form_enabled: false,
  master_enabled: true,
  prerequisites_ready: true,
  activatable: false,
  published: false,
  blocking_condition: null,
  context_ready: true,
  draft_publishable: false,
  draft_blocking_condition: null,
  has_published_version: false,
  activation_blocking_condition: null,
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("DraftEditorTab — no draft yet", () => {
  it("offers 'Crear borrador' for a manage-capable user, and never calls PATCH before the click", async () => {
    vi.mocked(api.getPublicLeadFormDraft).mockRejectedValue(new ApiError("no draft", { status: 404, code: "NO_DRAFT" }));
    render(<DraftEditorTab formId={1} canManage readiness={null} onDraftSaved={vi.fn()} />);

    expect(await screen.findByText(/todavía no tiene un borrador/i)).toBeTruthy();
    expect(api.updatePublicLeadFormDraft).not.toHaveBeenCalled();
  });

  it("clicking 'Crear borrador' sends an empty PATCH -- never duplicating backend defaults client-side", async () => {
    vi.mocked(api.getPublicLeadFormDraft)
      .mockRejectedValueOnce(new ApiError("no draft", { status: 404, code: "NO_DRAFT" }))
      .mockResolvedValueOnce(DRAFT());
    vi.mocked(api.updatePublicLeadFormDraft).mockResolvedValue(DRAFT());
    const user = userEvent.setup();
    render(<DraftEditorTab formId={1} canManage readiness={null} onDraftSaved={vi.fn()} />);

    await user.click(await screen.findByRole("button", { name: /Crear borrador/i }));

    await waitFor(() => expect(api.updatePublicLeadFormDraft).toHaveBeenCalledWith(1, {}));
    expect(await screen.findByText("Campos del formulario")).toBeTruthy();
  });

  it("a view-only user sees no 'Crear borrador' button", async () => {
    vi.mocked(api.getPublicLeadFormDraft).mockRejectedValue(new ApiError("no draft", { status: 404, code: "NO_DRAFT" }));
    render(<DraftEditorTab formId={1} canManage={false} readiness={null} onDraftSaved={vi.fn()} />);

    await screen.findByText(/todavía no tiene un borrador/i);
    expect(screen.queryByRole("button", { name: /Crear borrador/i })).toBeNull();
  });
});

describe("DraftEditorTab — editing an existing draft", () => {
  it("loads the draft and renders the field editor and branding panel", async () => {
    vi.mocked(api.getPublicLeadFormDraft).mockResolvedValue(DRAFT());
    render(<DraftEditorTab formId={1} canManage readiness={READINESS()} onDraftSaved={vi.fn()} />);

    expect(await screen.findByText("Campos del formulario")).toBeTruthy();
    expect(screen.getByText("Marca (branding)")).toBeTruthy();
    expect(screen.getByDisplayValue("Agenda tu consulta")).toBeTruthy();
  });

  it("shows the backend's own draft_blocking_condition message -- never inferred locally", async () => {
    vi.mocked(api.getPublicLeadFormDraft).mockResolvedValue(DRAFT());
    render(
      <DraftEditorTab
        formId={1}
        canManage
        readiness={READINESS({ draft_blocking_condition: { code: "CONTACT_METHOD_REQUIRED", message: "raw" } })}
        onDraftSaved={vi.fn()}
      />,
    );

    expect(await screen.findByTestId("draft-editor-blocking-message")).toHaveTextContent(/método de contacto/i);
  });

  it("saving sends schema+branding via PATCH and reloads afterward", async () => {
    vi.mocked(api.getPublicLeadFormDraft).mockResolvedValue(DRAFT());
    vi.mocked(api.updatePublicLeadFormDraft).mockResolvedValue(DRAFT());
    const onDraftSaved = vi.fn();
    const user = userEvent.setup();
    render(<DraftEditorTab formId={1} canManage readiness={READINESS()} onDraftSaved={onDraftSaved} />);

    await screen.findByText("Campos del formulario");
    await user.click(screen.getByRole("button", { name: /Guardar borrador/i }));

    await waitFor(() =>
      expect(api.updatePublicLeadFormDraft).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ schema: expect.any(Array), branding: expect.any(Object) }),
      ),
    );
    await waitFor(() => expect(onDraftSaved).toHaveBeenCalled());
    // Reload after save re-fetches the canonical draft -- never trusts the local copy alone.
    expect(api.getPublicLeadFormDraft).toHaveBeenCalledTimes(2);
  });

  it("maps a 422 per-field error onto the field editor, and shows the general message too", async () => {
    vi.mocked(api.getPublicLeadFormDraft).mockResolvedValue(DRAFT());
    vi.mocked(api.updatePublicLeadFormDraft).mockRejectedValue(
      new ApiError("Validation failed.", {
        status: 422,
        errors: { "schema.0.label": ["Label for field 'name' exceeds maximum length."] },
      }),
    );
    const user = userEvent.setup();
    render(<DraftEditorTab formId={1} canManage readiness={READINESS()} onDraftSaved={vi.fn()} />);

    await screen.findByText("Campos del formulario");
    await user.click(screen.getByRole("button", { name: /Guardar borrador/i }));

    // Shown both inline (next to its own field) and in the general banner -- never silently
    // dropped either way.
    expect((await screen.findAllByText(/exceeds maximum length/i)).length).toBeGreaterThanOrEqual(1);
  });

  it("a view-only user gets a read-only field editor and branding panel, no save button", async () => {
    vi.mocked(api.getPublicLeadFormDraft).mockResolvedValue(DRAFT());
    render(<DraftEditorTab formId={1} canManage={false} readiness={READINESS()} onDraftSaved={vi.fn()} />);

    await screen.findByText("Campos del formulario");
    expect(screen.queryByRole("button", { name: /Guardar borrador/i })).toBeNull();
  });
});
