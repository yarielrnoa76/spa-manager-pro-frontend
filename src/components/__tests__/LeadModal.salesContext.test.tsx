import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LeadModal from "../LeadModal";
import { api, ApiError } from "../../services/api";
import type { AuthenticatedUser } from "../../types";

/**
 * Sales-context hotfix: LeadModal must consume the real authenticated `user` prop end to end --
 * never fabricate a substitute, never derive is_super_admin from the role's name, never call
 * GET /api/users unless the actor actually holds `assign_lead`, and forward the exact same real
 * user object to the nested CreateSaleModal ("Nueva Venta para este Lead").
 */

vi.mock("../../services/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../services/api")>();
  return {
    ...actual,
    api: {
      getCurrentTenantId: vi.fn(() => "tenant-1"),
      me: vi.fn(),
      listBranches: vi.fn(),
      listUsers: vi.fn(),
      listUserCandidates: vi.fn(),
      getSaleCreateContext: vi.fn(),
      listProducts: vi.fn(),
      listLeads: vi.fn(),
      listPaymentMethods: vi.fn(),
      listProfessionals: vi.fn(),
      getTenantProfile: vi.fn(),
      listTicketCategories: vi.fn(),
      listTicketPriorities: vi.fn(),
      listTickets: vi.fn(),
      listConversations: vi.fn(),
      getLead: vi.fn(),
      createLead: vi.fn(),
      updateLead: vi.fn(),
    },
  };
});

const baseUser = (overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser => ({
  id: "10",
  name: "Salesman1DGS",
  email: "sales@example.com",
  tenant_id: 2,
  active_tenant_id: null,
  is_super_admin: false,
  branch_id: 3,
  branch: { id: 3, name: "DGS_Sucursal1" },
  role: { id: 3, name: "sales" },
  permissions: ["create_sale", "view_sales", "view_products"],
  ...overrides,
});

const leadToEdit = () => ({
  id: 55,
  name: "Carla",
  last_name: "Diaz",
  phone: "555-0100",
  email: "carla@example.com",
  branch_id: 3,
  source: "whatsapp",
  message: "",
  status: "new",
  assigned_to: null,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.getCurrentTenantId).mockReturnValue("tenant-1");
  vi.mocked(api.listBranches).mockResolvedValue([{ id: 3, name: "DGS_Sucursal1" }]);
  vi.mocked(api.listUsers).mockResolvedValue([]);
  vi.mocked(api.listUserCandidates).mockResolvedValue([]);
  vi.mocked(api.getSaleCreateContext).mockResolvedValue({
    can_create_sale: true,
    sales_scope: "branch",
    context_ready: true,
    blocking_code: null,
    effective_branch: { id: 3, name: "DGS_Sucursal1" },
    can_select_branch: false,
    available_branches: [],
    default_seller: { id: 10, name: "Salesman1DGS" },
    can_assign_other_seller: false,
    seller_candidates: [],
    can_view_products: true,
  });
  vi.mocked(api.listProducts).mockResolvedValue([]);
  vi.mocked(api.listLeads).mockResolvedValue([]);
  vi.mocked(api.listPaymentMethods).mockResolvedValue([]);
  vi.mocked(api.listProfessionals).mockResolvedValue([]);
  vi.mocked(api.getTenantProfile).mockResolvedValue(null as never);
  vi.mocked(api.listTicketCategories).mockResolvedValue([]);
  vi.mocked(api.listTicketPriorities).mockResolvedValue([]);
  vi.mocked(api.listTickets).mockResolvedValue({ data: [], last_page: 1, total: 0 });
  vi.mocked(api.listConversations).mockResolvedValue({ data: [] });
  vi.mocked(api.getLead).mockResolvedValue({ appointments: [], sales: [] });
});

describe("LeadModal — real authenticated user, never fabricated", () => {
  it("never calls api.me() a second time when the caller already passed the real user", async () => {
    render(
      <LeadModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} user={baseUser()} leadToEdit={leadToEdit() as never} />,
    );
    await waitFor(() => expect(api.listBranches).toHaveBeenCalled());
    expect(api.me).not.toHaveBeenCalled();
  });

  it("still falls back to api.me() for a legacy caller that has not been migrated to pass user", async () => {
    vi.mocked(api.me).mockResolvedValue(baseUser({ id: "99", name: "LegacyFallbackUser" }));
    render(<LeadModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} leadToEdit={leadToEdit() as never} />);
    await waitFor(() => expect(api.me).toHaveBeenCalledTimes(1));
  });

  it("forwards the exact real user (with a real id) to the nested CreateSaleModal, never a fabricated substitute", async () => {
    const user = userEvent.setup();
    render(
      <LeadModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} user={baseUser()} leadToEdit={leadToEdit() as never} />,
    );

    await user.click(await screen.findByRole("button", { name: /Ventas/i }));
    await user.click(await screen.findByRole("button", { name: /Crear Venta/i }));

    // CreateSaleModal's own resolver (useEffectiveSaleContext) only ever calls
    // GET /api/sales/create-context once it has a real user with a real `id` -- a hand-built
    // substitute missing `id` would leave it permanently gated (never fetching at all).
    await waitFor(() => expect(api.getSaleCreateContext).toHaveBeenCalled());
    // The seller shown comes from the backend's own `default_seller` -- rendering it at all
    // (rather than staying stuck on "Cargando...") proves the real user's identity reached
    // CreateSaleModal, never a fabricated stand-in.
    expect(await screen.findAllByText("Salesman1DGS")).not.toHaveLength(0);
  });
});

describe("LeadModal — 'Asignar A' and responsable loading follow the real permission, never the role's name", () => {
  it("a Sales actor without assign_lead never triggers any candidates lookup and never sees 'Asignar A'", async () => {
    render(
      <LeadModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} user={baseUser()} leadToEdit={leadToEdit() as never} />,
    );
    await waitFor(() => expect(api.listBranches).toHaveBeenCalled());
    expect(api.listUsers).not.toHaveBeenCalled();
    expect(api.listUserCandidates).not.toHaveBeenCalled();
    expect(screen.queryByText("Asignar A")).toBeNull();
  });

  it("a role literally named 'admin' without the assign_lead permission still never sees 'Asignar A'", async () => {
    const user = baseUser({ role: { id: 4, name: "admin" }, permissions: ["view_sales"], is_super_admin: false });
    render(<LeadModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} user={user} leadToEdit={leadToEdit() as never} />);
    await waitFor(() => expect(api.listBranches).toHaveBeenCalled());
    expect(api.listUsers).not.toHaveBeenCalled();
    expect(api.listUserCandidates).not.toHaveBeenCalled();
    expect(screen.queryByText("Asignar A")).toBeNull();
  });

  it("a custom-named role that DOES hold assign_lead sees 'Asignar A' and loads responsables via GET /api/users/candidates, never GET /api/users", async () => {
    vi.mocked(api.listUserCandidates).mockResolvedValue([{ id: 20, name: "Responsable Uno" }]);
    const user = baseUser({ role: { id: 5, name: "coordinador_regional" }, permissions: ["assign_lead"] });
    render(<LeadModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} user={user} leadToEdit={leadToEdit() as never} />);

    await waitFor(() => expect(api.listUserCandidates).toHaveBeenCalledTimes(1));
    expect(api.listUsers).not.toHaveBeenCalled();
    expect(await screen.findByText("Asignar A")).toBeTruthy();
    expect(await screen.findByText("Responsable Uno")).toBeTruthy();
  });

  it("requests candidates scoped to the lead's own branch (?branch_id=)", async () => {
    vi.mocked(api.listUserCandidates).mockResolvedValue([{ id: 20, name: "Responsable Uno" }]);
    const user = baseUser({ permissions: ["assign_lead"] });
    render(<LeadModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} user={user} leadToEdit={leadToEdit() as never} />);
    await waitFor(() => expect(api.listUserCandidates).toHaveBeenCalledWith({ branch_id: "3" }));
  });

  it("a genuine SuperAdmin (is_super_admin, not a role-name guess) always sees 'Asignar A'", async () => {
    vi.mocked(api.listUserCandidates).mockResolvedValue([{ id: 20, name: "Responsable Uno" }]);
    const user = baseUser({ is_super_admin: true, role: { id: 1, name: "owner" }, permissions: [] });
    render(<LeadModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} user={user} leadToEdit={leadToEdit() as never} />);
    expect(await screen.findByText("Asignar A")).toBeTruthy();
    await waitFor(() => expect(api.listUserCandidates).toHaveBeenCalledTimes(1));
    expect(api.listUsers).not.toHaveBeenCalled();
  });

  it("a 403 loading candidates is shown as an explicit error, never presented as a legitimately empty list", async () => {
    vi.mocked(api.listUserCandidates).mockRejectedValue(new ApiError("forbidden", { status: 403 }));
    const user = baseUser({ permissions: ["assign_lead"] });
    render(<LeadModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} user={user} leadToEdit={leadToEdit() as never} />);

    expect(await screen.findByText(/no se pudo cargar la lista de responsables/i)).toBeTruthy();
    // The select itself isn't rendered at all while forbidden/error -- never a legitimately
    // empty-looking dropdown.
    expect(screen.queryByText("-- Sin Asignar --")).toBeNull();
  });
});
