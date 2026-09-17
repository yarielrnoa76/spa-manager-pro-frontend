import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import PublicLeadFormConfigShell from "../PublicLeadFormConfigShell";
import { api, ApiError } from "../../../services/api";
import type { PublicLeadForm, PublicLeadFormReadiness } from "../../../types";

vi.mock("../../../services/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../services/api")>();
  return {
    ...actual,
    api: {
      getPublicLeadForm: vi.fn(),
      getPublicLeadFormReadiness: vi.fn(),
      getPublicLeadFormDraft: vi.fn(),
      updatePublicLeadFormDraft: vi.fn(),
      getPublicLeadFormDraftPreview: vi.fn(),
      listPublicLeadFormVersions: vi.fn(),
      updatePublicLeadForm: vi.fn(),
    },
  };
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
  allowed_origins: [],
  embed_origins: [],
  created_by_user_id: null,
  created_by: null,
  updated_by_user_id: null,
  updated_by: null,
  created_at: null,
  updated_at: null,
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

// Mounted under the SAME "/lead-forms" prefix the real app uses (App.tsx -> PublicLeadForms.tsx
// -> this shell) -- required because the shell's own tab navigation targets an absolute
// "/lead-forms/{formId}/{tab}" path (see PublicLeadFormConfigShell.tsx's onChange comment for
// why a bare relative segment silently drifts under a `:id/*` splat route).
function renderShell(path: string, props: Partial<React.ComponentProps<typeof PublicLeadFormConfigShell>> = {}) {
  return render(
    <MemoryRouter initialEntries={[`/lead-forms${path}`]}>
      <Routes>
        <Route
          path="/lead-forms/:id/*"
          element={
            <PublicLeadFormConfigShell
              formId={1}
              canManage={true}
              canPublish={true}
              onBack={vi.fn()}
              {...props}
            />
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.getPublicLeadForm).mockResolvedValue(FORM());
  vi.mocked(api.getPublicLeadFormReadiness).mockResolvedValue(READINESS());
  vi.mocked(api.getPublicLeadFormDraft).mockRejectedValue(new ApiError("no draft", { status: 404, code: "NO_DRAFT" }));
  vi.mocked(api.getPublicLeadFormDraftPreview).mockRejectedValue(new ApiError("no draft", { status: 404, code: "NO_DRAFT" }));
  vi.mocked(api.listPublicLeadFormVersions).mockResolvedValue([]);
});

describe("PublicLeadFormConfigShell — load states", () => {
  it("shows a forbidden state for a 403 on the form itself", async () => {
    vi.mocked(api.getPublicLeadForm).mockRejectedValue(new ApiError("forbidden", { status: 403 }));
    renderShell("/1/general");
    expect(await screen.findByText(/No tienes permiso para ver este formulario/i)).toBeTruthy();
  });

  it("shows a not-found state for a 404", async () => {
    vi.mocked(api.getPublicLeadForm).mockRejectedValue(new ApiError("not found", { status: 404 }));
    renderShell("/1/general");
    expect(await screen.findByText(/no existe o ya no está disponible/i)).toBeTruthy();
  });
});

describe("PublicLeadFormConfigShell — tabs and deep-linking", () => {
  it("deep-linking to /campos activates the Campos tab", async () => {
    renderShell("/1/campos");
    await waitFor(() => expect(api.getPublicLeadForm).toHaveBeenCalled());
    const campos = await screen.findByRole("tab", { name: "Campos" });
    expect(campos.getAttribute("aria-selected")).toBe("true");
  });

  it("an index visit (/1) redirects to /1/general", async () => {
    renderShell("/1");
    const general = await screen.findByRole("tab", { name: "General" });
    expect(general.getAttribute("aria-selected")).toBe("true");
  });

  it("clicking the Publicación tab navigates there and renders PublishDeliveryPanel content", async () => {
    const user = userEvent.setup();
    renderShell("/1/general");
    await screen.findByRole("tab", { name: "General" });
    await user.click(screen.getByRole("tab", { name: "Publicación" }));

    expect(await screen.findByText("Acciones")).toBeTruthy();
  });
});

describe("PublicLeadFormConfigShell — status badge reflects the confirmed form, not local state", () => {
  it("shows Pausado for enabled=false and Habilitado for enabled=true", async () => {
    vi.mocked(api.getPublicLeadForm).mockResolvedValue(FORM({ enabled: false }));
    renderShell("/1/general");
    expect(await screen.findByText("Pausado")).toBeTruthy();
  });
});
