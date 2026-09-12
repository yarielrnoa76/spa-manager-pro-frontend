import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PublicLeadForms from "../PublicLeadForms";
import { api, ApiError } from "../../services/api";
import type { UserData } from "../../App";
import type { PublicLeadForm, PublicLeadFormReadiness, PublicLeadFormListResponse } from "../../types";

/**
 * Form Builder B2 — administrative lifecycle UI (list, detail, readiness, publish, pause).
 * Explicitly NOT covered here (out of scope for this block): visual field builder, branding,
 * the public page itself, or an integration snippet -- see the "no fake controls" describe
 * block, which asserts none of that surface leaked in.
 */

vi.mock("../../services/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../services/api")>();
  return {
    ...actual,
    api: {
      listPublicLeadForms: vi.fn(),
      getPublicLeadForm: vi.fn(),
      getPublicLeadFormReadiness: vi.fn(),
      publishPublicLeadForm: vi.fn(),
      pausePublicLeadForm: vi.fn(),
      listBranches: vi.fn(),
      createPublicLeadForm: vi.fn(),
      updatePublicLeadForm: vi.fn(),
    },
  };
});

const FORM_ROW = (overrides: Partial<PublicLeadForm> = {}): PublicLeadForm => ({
  id: 1,
  uuid: "uuid-1",
  name: "Contact Form",
  key: "contact-form",
  branch_id: 1,
  branch: { id: 1, name: "Main Branch" },
  lead_source_key: "public_web_form",
  enabled: false,
  allowed_origins: ["https://example.com"],
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
  form_uuid: "uuid-1",
  environment: "qa",
  form_enabled: false,
  master_enabled: true,
  prerequisites_ready: true,
  activatable: true,
  published: false,
  blocking_condition: null,
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

const MANAGER_USER: UserData = {
  id: "2",
  name: "Manager",
  email: "manager@example.com",
  role: { id: 2, name: "manager" },
  is_super_admin: false,
  permissions: ["view_public_lead_forms", "manage_public_lead_forms"],
};

const VIEW_ONLY_USER: UserData = {
  id: "3",
  name: "Viewer",
  email: "viewer@example.com",
  role: { id: 3, name: "viewer" },
  is_super_admin: false,
  permissions: ["view_public_lead_forms"],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.listPublicLeadForms).mockResolvedValue(LIST_RESPONSE([FORM_ROW()]));
  vi.mocked(api.getPublicLeadForm).mockResolvedValue(FORM_ROW());
  vi.mocked(api.getPublicLeadFormReadiness).mockResolvedValue(READINESS());
  vi.mocked(api.listBranches).mockResolvedValue([{ id: "1", name: "Main Branch", code: "MB", address: "" }]);
});

const openDetail = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(await screen.findByText("Contact Form"));
  await user.click(screen.getByRole("button", { name: /Ver detalle/i }));
};

describe("PublicLeadForms — list states", () => {
  it("shows loading, then the server-side rows with their columns", async () => {
    render(<PublicLeadForms user={ADMIN_USER} />);
    const row = (await screen.findByText("Contact Form")).closest("tr")!;
    expect(within(row).getByText("contact-form")).toBeTruthy();
    expect(within(row).getByText("Main Branch")).toBeTruthy();
    expect(within(row).getByText("https://example.com")).toBeTruthy();
    expect(within(row).getByText("Pausado")).toBeTruthy();
    expect(api.listPublicLeadForms).toHaveBeenCalledWith({ page: 1, per_page: 15 });
  });

  it("shows an empty state distinctly from loading/error", async () => {
    vi.mocked(api.listPublicLeadForms).mockResolvedValue(LIST_RESPONSE([]));
    render(<PublicLeadForms user={ADMIN_USER} />);
    expect(await screen.findByText(/Todavía no hay formularios/i)).toBeTruthy();
  });

  it("shows a forbidden state, never an empty list, for a 403", async () => {
    vi.mocked(api.listPublicLeadForms).mockRejectedValue(new ApiError("forbidden", { status: 403 }));
    render(<PublicLeadForms user={ADMIN_USER} />);
    expect(await screen.findByText(/No tienes permiso/i)).toBeTruthy();
  });

  it("shows an error state with retry, never an empty list, for a network failure", async () => {
    vi.mocked(api.listPublicLeadForms).mockRejectedValue(new TypeError("Failed to fetch"));
    render(<PublicLeadForms user={ADMIN_USER} />);
    expect(await screen.findByText(/No se pudo cargar/i)).toBeTruthy();
  });

  it("paginates server-side without accumulating all pages in memory", async () => {
    vi.mocked(api.listPublicLeadForms).mockResolvedValue(
      LIST_RESPONSE([FORM_ROW()], { current_page: 1, last_page: 2, total: 2 }),
    );
    const user = userEvent.setup();
    render(<PublicLeadForms user={ADMIN_USER} />);
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
    // The previous page's row is gone -- the list reflects only the server's current page.
    expect(screen.queryByText("Contact Form")).toBeNull();
  });
});

describe("PublicLeadForms — detail and readiness", () => {
  it("loads the confirmed detail and readiness via their own authorized endpoints", async () => {
    const user = userEvent.setup();
    render(<PublicLeadForms user={ADMIN_USER} />);
    await openDetail(user);

    await waitFor(() => expect(api.getPublicLeadForm).toHaveBeenCalledWith(1));
    await waitFor(() => expect(api.getPublicLeadFormReadiness).toHaveBeenCalledWith(1));
    expect(screen.getByText("Listo para publicar")).toBeTruthy();
  });

  it("projects the creator and last editor safely when the backend provides them", async () => {
    const user = userEvent.setup();
    render(<PublicLeadForms user={ADMIN_USER} />);
    await openDetail(user);

    await screen.findByText("Listo para publicar");
    expect(screen.getAllByText("Alice").length).toBeGreaterThan(0);
  });

  it("shows 'No disponible' rather than crashing when creator/editor are null", async () => {
    vi.mocked(api.getPublicLeadForm).mockResolvedValue(
      FORM_ROW({ created_by: null, updated_by: null }),
    );
    const user = userEvent.setup();
    render(<PublicLeadForms user={ADMIN_USER} />);
    await openDetail(user);

    expect(await screen.findAllByText("No disponible")).toHaveLength(2);
  });

  it("shows a clear, translated message for a blocking condition", async () => {
    vi.mocked(api.getPublicLeadFormReadiness).mockResolvedValue(
      READINESS({
        prerequisites_ready: false,
        activatable: false,
        blocking_condition: { code: "TICKET_CATEGORY", message: "raw" },
      }),
    );
    const user = userEvent.setup();
    render(<PublicLeadForms user={ADMIN_USER} />);
    await openDetail(user);

    expect(await screen.findByText("Requiere configuración")).toBeTruthy();
    expect(await screen.findByTestId("readiness-blocking-message")).toHaveTextContent(
      /categoría de ticket activa/i,
    );
  });

  it("explains PUBLIC_WEB_INTAKE_DISABLED as a platform-level condition this form cannot change", async () => {
    vi.mocked(api.getPublicLeadFormReadiness).mockResolvedValue(
      READINESS({
        form_enabled: true,
        master_enabled: false,
        activatable: false,
        blocking_condition: { code: "PUBLIC_WEB_INTAKE_DISABLED", message: "raw" },
      }),
    );
    const user = userEvent.setup();
    render(<PublicLeadForms user={ADMIN_USER} />);
    await openDetail(user);

    expect(await screen.findByText("Captación global desactivada")).toBeTruthy();
    expect(screen.getByTestId("readiness-blocking-message")).toHaveTextContent(
      /no puede cambiarse desde este formulario/i,
    );
  });

  it("refreshes readiness on demand without reloading the whole detail", async () => {
    const user = userEvent.setup();
    render(<PublicLeadForms user={ADMIN_USER} />);
    await openDetail(user);
    await screen.findByText("Listo para publicar");

    vi.mocked(api.getPublicLeadFormReadiness).mockResolvedValue(READINESS({ published: true, form_enabled: true }));
    await user.click(screen.getByRole("button", { name: /Refrescar/i }));

    expect(await screen.findByText("Publicado")).toBeTruthy();
    expect(api.getPublicLeadFormReadiness).toHaveBeenCalledTimes(2);
  });
});

describe("PublicLeadForms — permissions", () => {
  it("Admin sees create, publish and pause controls", async () => {
    const user = userEvent.setup();
    render(<PublicLeadForms user={ADMIN_USER} />);
    expect(await screen.findByRole("button", { name: /Nuevo formulario/i })).toBeTruthy();

    vi.mocked(api.getPublicLeadForm).mockResolvedValue(FORM_ROW({ enabled: true }));
    vi.mocked(api.getPublicLeadFormReadiness).mockResolvedValue(READINESS({ form_enabled: true, published: true }));
    await openDetail(user);

    await screen.findByText("Publicado");
    expect(screen.getByRole("button", { name: /Pausar/i })).toBeTruthy();
  });

  it("Manager can manage (edit/pause) but never sees Publicar", async () => {
    const user = userEvent.setup();
    render(<PublicLeadForms user={MANAGER_USER} />);
    expect(await screen.findByRole("button", { name: /Nuevo formulario/i })).toBeTruthy();

    await openDetail(user);
    await screen.findByText("Listo para publicar");

    expect(screen.getByRole("button", { name: /^Editar$/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Publicar$/i })).toBeNull();
  });

  it("a read-only user (view_public_lead_forms only) sees no mutation controls at all", async () => {
    const user = userEvent.setup();
    render(<PublicLeadForms user={VIEW_ONLY_USER} />);
    expect(screen.queryByRole("button", { name: /Nuevo formulario/i })).toBeNull();

    await openDetail(user);
    await screen.findByText("Listo para publicar");

    expect(screen.queryByRole("button", { name: /^Editar$/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Publicar$/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /Pausar/i })).toBeNull();
  });
});

describe("PublicLeadForms — publish", () => {
  it("disables Publicar while activatable is false, and never opens the confirmation or calls the endpoint", async () => {
    vi.mocked(api.getPublicLeadFormReadiness).mockResolvedValue(
      READINESS({ activatable: false, prerequisites_ready: false, blocking_condition: { code: "ALLOWED_ORIGINS", message: "x" } }),
    );
    const user = userEvent.setup();
    render(<PublicLeadForms user={ADMIN_USER} />);
    await openDetail(user);

    const publishButton = await screen.findByRole("button", { name: /Publicar/i });
    expect(publishButton).toBeDisabled();
    await user.click(publishButton);
    expect(screen.queryByText(/Confirmas la publicación/i)).toBeNull();
    expect(api.publishPublicLeadForm).not.toHaveBeenCalled();
  });

  it("clicking Publicar opens a confirmation dialog and does NOT call the endpoint yet", async () => {
    const user = userEvent.setup();
    render(<PublicLeadForms user={ADMIN_USER} />);
    await openDetail(user);

    const publishButton = await screen.findByRole("button", { name: /^Publicar$/i });
    expect(publishButton).not.toBeDisabled();
    await user.click(publishButton);

    expect(await screen.findByText(/Confirmas la publicación/i)).toBeTruthy();
    // Names the specific form, not a generic message.
    expect(screen.getByText(/"Contact Form"/)).toBeTruthy();
    expect(api.publishPublicLeadForm).not.toHaveBeenCalled();
  });

  it("Cancelar closes the confirmation without calling the endpoint", async () => {
    const user = userEvent.setup();
    render(<PublicLeadForms user={ADMIN_USER} />);
    await openDetail(user);

    await user.click(await screen.findByRole("button", { name: /^Publicar$/i }));
    await screen.findByText(/Confirmas la publicación/i);
    await user.click(screen.getByRole("button", { name: /^Cancelar$/i }));

    expect(screen.queryByText(/Confirmas la publicación/i)).toBeNull();
    expect(api.publishPublicLeadForm).not.toHaveBeenCalled();
  });

  it("confirming calls the endpoint exactly once and re-fetches list, detail and readiness afterward", async () => {
    vi.mocked(api.publishPublicLeadForm).mockResolvedValue(FORM_ROW({ enabled: true }));
    const user = userEvent.setup();
    render(<PublicLeadForms user={ADMIN_USER} />);
    await openDetail(user);

    const listCallsBefore = vi.mocked(api.listPublicLeadForms).mock.calls.length;
    await user.click(await screen.findByRole("button", { name: /^Publicar$/i }));
    await screen.findByText(/Confirmas la publicación/i);

    vi.mocked(api.getPublicLeadForm).mockResolvedValue(FORM_ROW({ enabled: true }));
    vi.mocked(api.getPublicLeadFormReadiness).mockResolvedValue(READINESS({ form_enabled: true, published: true }));
    await user.click(screen.getByRole("button", { name: /Confirmar publicación/i }));

    await waitFor(() => expect(api.publishPublicLeadForm).toHaveBeenCalledTimes(1));
    expect(api.publishPublicLeadForm).toHaveBeenCalledWith(1);
    // Never optimistic -- the confirmed state comes from fresh GETs, not from the publish response alone.
    await waitFor(() => expect(api.getPublicLeadForm).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(api.getPublicLeadFormReadiness).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(vi.mocked(api.listPublicLeadForms).mock.calls.length).toBeGreaterThan(listCallsBefore),
    );
    expect(await screen.findByText("Publicado")).toBeTruthy();
    // The dialog itself is gone once the request settles.
    expect(screen.queryByText(/Confirmas la publicación/i)).toBeNull();
  });

  it("disables the dialog's controls while publishing, preventing a double submission", async () => {
    let resolvePublish!: (value: PublicLeadForm) => void;
    vi.mocked(api.publishPublicLeadForm).mockReturnValue(
      new Promise((resolve) => {
        resolvePublish = resolve;
      }),
    );
    const user = userEvent.setup();
    render(<PublicLeadForms user={ADMIN_USER} />);
    await openDetail(user);

    await user.click(await screen.findByRole("button", { name: /^Publicar$/i }));
    const confirmButton = await screen.findByRole("button", { name: /Confirmar publicación|Publicando/i });
    await user.click(confirmButton);

    const busyButton = await screen.findByRole("button", { name: /Publicando/i });
    expect(busyButton).toBeDisabled();
    expect(screen.getByRole("button", { name: /^Cancelar$/i })).toBeDisabled();

    // A second click while in flight must not fire another request.
    await user.click(busyButton);
    expect(api.publishPublicLeadForm).toHaveBeenCalledTimes(1);

    resolvePublish(FORM_ROW({ enabled: true }));
    await waitFor(() => expect(screen.queryByText(/Confirmas la publicación/i)).toBeNull());
  });

  it("shows a clear message for a 409 conflict after confirming, and closes the dialog so it's visible", async () => {
    vi.mocked(api.publishPublicLeadForm).mockRejectedValue(
      new ApiError("conflict", { status: 409, code: "READINESS_CHECK_FAILED" }),
    );
    const user = userEvent.setup();
    render(<PublicLeadForms user={ADMIN_USER} />);
    await openDetail(user);

    await user.click(await screen.findByRole("button", { name: /^Publicar$/i }));
    await user.click(await screen.findByRole("button", { name: /Confirmar publicación/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/verificación de disponibilidad falló/i);
    // The confirmation overlay closed -- the error above is actually visible, not hidden behind it.
    expect(screen.queryByText(/Confirmas la publicación/i)).toBeNull();
  });
});

describe("PublicLeadForms — pause", () => {
  it("requires explicit confirmation before pausing", async () => {
    vi.mocked(api.getPublicLeadForm).mockResolvedValue(FORM_ROW({ enabled: true }));
    vi.mocked(api.getPublicLeadFormReadiness).mockResolvedValue(READINESS({ form_enabled: true, published: true }));
    const user = userEvent.setup();
    render(<PublicLeadForms user={ADMIN_USER} />);
    await openDetail(user);
    await screen.findByText("Publicado");

    await user.click(screen.getByRole("button", { name: /^Pausar$/i }));
    expect(await screen.findByText(/dejará de aceptar envíos públicos/i)).toBeTruthy();
    expect(api.pausePublicLeadForm).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /Volver/i }));
    expect(screen.queryByText(/dejará de aceptar envíos públicos/i)).toBeNull();
    expect(api.pausePublicLeadForm).not.toHaveBeenCalled();
  });

  it("confirming pauses and re-fetches confirmed state afterward", async () => {
    vi.mocked(api.getPublicLeadForm).mockResolvedValue(FORM_ROW({ enabled: true }));
    vi.mocked(api.getPublicLeadFormReadiness).mockResolvedValue(READINESS({ form_enabled: true, published: true }));
    vi.mocked(api.pausePublicLeadForm).mockResolvedValue(FORM_ROW({ enabled: false }));
    const user = userEvent.setup();
    render(<PublicLeadForms user={ADMIN_USER} />);
    await openDetail(user);
    await screen.findByText("Publicado");

    vi.mocked(api.getPublicLeadForm).mockResolvedValue(FORM_ROW({ enabled: false }));
    vi.mocked(api.getPublicLeadFormReadiness).mockResolvedValue(READINESS({ form_enabled: false, activatable: true }));

    await user.click(screen.getByRole("button", { name: /^Pausar$/i }));
    await user.click(screen.getByRole("button", { name: /Confirmar pausa/i }));

    await waitFor(() => expect(api.pausePublicLeadForm).toHaveBeenCalledWith(1));
    expect(await screen.findByText("Listo para publicar")).toBeTruthy();
  });
});

describe("PublicLeadForms — create/edit integration", () => {
  it("opens the create modal and reloads the list after a successful creation", async () => {
    vi.mocked(api.createPublicLeadForm).mockResolvedValue(FORM_ROW({ id: 9, name: "New Form", key: "new-form" }));
    const user = userEvent.setup();
    render(<PublicLeadForms user={ADMIN_USER} />);

    await user.click(await screen.findByRole("button", { name: /Nuevo formulario/i }));
    await user.type(screen.getByLabelText("Nombre"), "New Form");
    await user.type(screen.getByLabelText("Identificador (key)"), "new-form");
    await screen.findByLabelText("Sucursal");
    await user.selectOptions(screen.getByLabelText("Sucursal"), "1");
    await user.type(screen.getByLabelText("Origen permitido 1"), "https://example.com");

    const listCallsBefore = vi.mocked(api.listPublicLeadForms).mock.calls.length;
    await user.click(screen.getByRole("button", { name: /Crear formulario/i }));

    await waitFor(() => expect(api.createPublicLeadForm).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(vi.mocked(api.listPublicLeadForms).mock.calls.length).toBeGreaterThan(listCallsBefore),
    );
  });

  it("Editar is disabled while the form is enabled -- editing is only allowed while paused", async () => {
    vi.mocked(api.getPublicLeadForm).mockResolvedValue(FORM_ROW({ enabled: true }));
    vi.mocked(api.getPublicLeadFormReadiness).mockResolvedValue(READINESS({ form_enabled: true, published: true }));
    const user = userEvent.setup();
    render(<PublicLeadForms user={ADMIN_USER} />);
    await openDetail(user);
    await screen.findByText("Publicado");

    expect(screen.getByRole("button", { name: /^Editar$/i })).toBeDisabled();
  });
});

describe("PublicLeadForms — no fake controls (out of scope for B2)", () => {
  it("never renders a control for the platform-wide master flag", async () => {
    const user = userEvent.setup();
    render(<PublicLeadForms user={ADMIN_USER} />);
    await openDetail(user);
    await screen.findByText("Listo para publicar");

    expect(screen.queryByText(/captación global desactivada/i)).toBeNull();
    expect(screen.queryByLabelText(/master/i)).toBeNull();
  });

  it("never renders branding, schema-builder, public-page or snippet controls", async () => {
    const user = userEvent.setup();
    render(<PublicLeadForms user={ADMIN_USER} />);
    await openDetail(user);
    await screen.findByText("Listo para publicar");

    expect(screen.queryByText(/branding/i)).toBeNull();
    expect(screen.queryByText(/constructor visual/i)).toBeNull();
    expect(screen.queryByText(/schema/i)).toBeNull();
    expect(screen.queryByText(/página pública/i)).toBeNull();
    expect(screen.queryByText(/snippet/i)).toBeNull();
    expect(screen.queryByText(/código de integración/i)).toBeNull();
  });
});
