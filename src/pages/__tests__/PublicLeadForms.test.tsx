import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import PublicLeadForms from "../PublicLeadForms";
import { api, ApiError } from "../../services/api";
import type { UserData } from "../../App";
import type { PublicLeadForm, PublicLeadFormListResponse, PublicLeadFormReadiness } from "../../types";

/**
 * Form Builder B3 — "Formularios Web" reuses the existing sidebar entry and route; this page is
 * now split into two real routes (never local-only tab state): `/lead-forms` (Listado) and
 * `/lead-forms/:id/*` (Configuración, delegated to PublicLeadFormConfigShell). This file covers
 * only the Listado surface, RBAC on its own controls, and navigation between the two -- the
 * Configuración shell's own tabs (General/Campos/Preview/Publicación) are covered by their own
 * dedicated test files under `components/FormBuilder/__tests__`.
 */

vi.mock("../../services/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../services/api")>();
  return {
    ...actual,
    api: {
      listPublicLeadForms: vi.fn(),
      getPublicLeadForm: vi.fn(),
      getPublicLeadFormReadiness: vi.fn(),
      listPublicLeadFormVersions: vi.fn(),
      listBranches: vi.fn(),
      createPublicLeadForm: vi.fn(),
      updatePublicLeadForm: vi.fn(),
    },
  };
});

const FORM_ROW = (overrides: Partial<PublicLeadForm> = {}): PublicLeadForm => ({
  id: 1,
  uuid: "11111111-1111-4111-8111-111111111111",
  name: "Contact Form",
  key: "contact-form",
  branch_id: 1,
  branch: { id: 1, name: "Main Branch" },
  lead_source_key: "public_web_form",
  enabled: false,
  allowed_origins: ["https://example.com"],
  embed_origins: [],
  created_by_user_id: 7,
  created_by: { id: 7, name: "Alice" },
  updated_by_user_id: 7,
  updated_by: { id: 7, name: "Alice" },
  created_at: "2026-09-01T00:00:00Z",
  updated_at: "2026-09-05T00:00:00Z",
  ...overrides,
});

const LIST_RESPONSE = (
  forms: PublicLeadForm[],
  metaOverrides: Partial<PublicLeadFormListResponse["meta"]> = {},
): PublicLeadFormListResponse => ({
  data: forms,
  links: { first: null, last: null, prev: null, next: null },
  meta: {
    current_page: 1,
    from: forms.length > 0 ? 1 : null,
    last_page: 1,
    path: "/api/public-lead-forms",
    per_page: 15,
    to: forms.length,
    total: forms.length,
    ...metaOverrides,
  },
});

const READINESS = (overrides: Partial<PublicLeadFormReadiness> = {}): PublicLeadFormReadiness => ({
  form_id: 1,
  form_uuid: "11111111-1111-4111-8111-111111111111",
  environment: "qa",
  form_enabled: false,
  master_enabled: true,
  prerequisites_ready: true,
  activatable: true,
  published: false,
  blocking_condition: null,
  context_ready: true,
  draft_publishable: true,
  draft_blocking_condition: null,
  has_published_version: false,
  activation_blocking_condition: null,
  ...overrides,
});

const ADMIN_USER: UserData = {
  id: "1",
  name: "Admin",
  email: "admin@example.com",
  role: { id: 1, name: "admin" },
  is_super_admin: false,
  permissions: ["view_public_lead_forms", "manage_public_lead_forms", "publish_public_lead_forms"],
};

const VIEW_ONLY_USER: UserData = {
  id: "3",
  name: "Viewer",
  email: "viewer@example.com",
  role: { id: 3, name: "viewer" },
  is_super_admin: false,
  permissions: ["view_public_lead_forms"],
};

function renderAt(path: string, user: UserData) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <PublicLeadForms user={user} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.listPublicLeadForms).mockResolvedValue(LIST_RESPONSE([FORM_ROW()]));
  vi.mocked(api.getPublicLeadForm).mockResolvedValue(FORM_ROW());
  vi.mocked(api.getPublicLeadFormReadiness).mockResolvedValue(READINESS());
  vi.mocked(api.listPublicLeadFormVersions).mockResolvedValue([]);
  vi.mocked(api.listBranches).mockResolvedValue([{ id: "1", name: "Main Branch", code: "MB", address: "" }]);
});

describe("PublicLeadForms — list states", () => {
  it("shows loading, then the server-side rows with their columns", async () => {
    renderAt("/", ADMIN_USER);
    const row = (await screen.findByText("Contact Form")).closest("tr")!;
    expect(within(row).getByText("contact-form")).toBeTruthy();
    expect(within(row).getByText("Main Branch")).toBeTruthy();
    expect(within(row).getByText("Pausado")).toBeTruthy();
    expect(api.listPublicLeadForms).toHaveBeenCalledWith({ page: 1, per_page: 15 });
  });

  it("shows an empty state distinctly from loading/error", async () => {
    vi.mocked(api.listPublicLeadForms).mockResolvedValue(LIST_RESPONSE([]));
    renderAt("/", ADMIN_USER);
    expect(await screen.findByText(/Todavía no hay formularios/i)).toBeTruthy();
  });

  it("shows a forbidden state, never an empty list, for a 403", async () => {
    vi.mocked(api.listPublicLeadForms).mockRejectedValue(new ApiError("forbidden", { status: 403 }));
    renderAt("/", ADMIN_USER);
    expect(await screen.findByText(/No tienes permiso/i)).toBeTruthy();
  });

  it("shows an error state with retry, never an empty list, for a network failure", async () => {
    vi.mocked(api.listPublicLeadForms).mockRejectedValue(new TypeError("Failed to fetch"));
    renderAt("/", ADMIN_USER);
    expect(await screen.findByText(/No se pudo cargar/i)).toBeTruthy();
  });

  it("paginates server-side without accumulating all pages in memory", async () => {
    vi.mocked(api.listPublicLeadForms).mockResolvedValue(
      LIST_RESPONSE([FORM_ROW()], { current_page: 1, last_page: 2, total: 2 }),
    );
    const user = userEvent.setup();
    renderAt("/", ADMIN_USER);
    await screen.findByText("Contact Form");

    vi.mocked(api.listPublicLeadForms).mockResolvedValue(
      LIST_RESPONSE([FORM_ROW({ id: 2, name: "Second Form", key: "second-form" })], {
        current_page: 2,
        last_page: 2,
        total: 2,
      }),
    );
    await user.click(screen.getByLabelText(/Página siguiente/i));

    await waitFor(() => expect(api.listPublicLeadForms).toHaveBeenLastCalledWith({ page: 2, per_page: 15 }));
    expect(await screen.findByText("Second Form")).toBeTruthy();
    expect(screen.queryByText("Contact Form")).toBeNull();
  });
});

describe("PublicLeadForms — permissions on the Listado surface", () => {
  it("a manage-capable user sees 'Nuevo formulario'", async () => {
    renderAt("/", ADMIN_USER);
    await screen.findByText("Contact Form");
    expect(screen.getByRole("button", { name: /Nuevo formulario/i })).toBeTruthy();
  });

  it("a read-only user (view_public_lead_forms only) never sees 'Nuevo formulario'", async () => {
    renderAt("/", VIEW_ONLY_USER);
    await screen.findByText("Contact Form");
    expect(screen.queryByRole("button", { name: /Nuevo formulario/i })).toBeNull();
  });
});

describe("PublicLeadForms — navigation to Configuración", () => {
  it("clicking Configurar on a row navigates to the config shell without a page reload", async () => {
    const user = userEvent.setup();
    renderAt("/", ADMIN_USER);
    await user.click(await screen.findByRole("button", { name: /Configurar/i }));

    await waitFor(() => expect(api.getPublicLeadForm).toHaveBeenCalledWith(1));
    expect(await screen.findByRole("tab", { name: "General" })).toBeTruthy();
  });

  it("deep-linking directly to /:id/campos renders the Configuración shell on that tab", async () => {
    renderAt("/1/campos", ADMIN_USER);
    await waitFor(() => expect(api.getPublicLeadForm).toHaveBeenCalledWith(1));
    const campos = await screen.findByRole("tab", { name: "Campos" });
    expect(campos.getAttribute("aria-selected")).toBe("true");
  });

  it("'Volver al listado' returns to the Listado table", async () => {
    const user = userEvent.setup();
    renderAt("/1/general", ADMIN_USER);
    await user.click(await screen.findByText(/Volver al listado/i));
    expect(await screen.findByText("Contact Form")).toBeTruthy();
  });
});

describe("PublicLeadForms — create integration", () => {
  it("opens the create modal and navigates to the new form's config shell after a successful creation", async () => {
    vi.mocked(api.createPublicLeadForm).mockResolvedValue(FORM_ROW({ id: 9, name: "New Form", key: "new-form" }));
    vi.mocked(api.getPublicLeadForm).mockResolvedValue(FORM_ROW({ id: 9, name: "New Form", key: "new-form" }));
    const user = userEvent.setup();
    renderAt("/", ADMIN_USER);

    await user.click(await screen.findByRole("button", { name: /Nuevo formulario/i }));
    await user.type(screen.getByLabelText(/^Nombre$/i), "New Form");
    await user.type(screen.getByLabelText(/Identificador/i), "new-form");
    await user.selectOptions(screen.getByLabelText(/Sucursal/i), "1");
    await user.type(screen.getByLabelText(/Origen permitido 1/i), "https://example.com");
    await user.click(screen.getByRole("button", { name: /Crear formulario/i }));

    await waitFor(() => expect(api.createPublicLeadForm).toHaveBeenCalled());
    await waitFor(() => expect(api.getPublicLeadForm).toHaveBeenCalledWith(9));
  });
});
