import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LeadModal from "../LeadModal";
import { api } from "../../services/api";

/**
 * Final adversarial correction, Correction 1: `TicketController::index()` was missing
 * `category:id,name` from its eager-load list even though `TicketIndexResource` always projects
 * `category_id` and a `category` field — an omission that left LeadModal's own ticket list
 * (`leadTickets.map(...)`, which reads `ticket.category?.name` directly from `api.listTickets({
 * lead_id })`) permanently blank for every lead. Confirms the corrected backend contract actually
 * renders here.
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
      listTicketCategories: vi.fn(),
      listTicketPriorities: vi.fn(),
      listTickets: vi.fn(),
      getTicket: vi.fn(),
      listConversations: vi.fn(),
      getLead: vi.fn(),
      createLead: vi.fn(),
      updateLead: vi.fn(),
    },
  };
});

const leadToEdit = () => ({
  id: 55,
  name: "Carla",
  last_name: "Diaz",
  phone: "555-0100",
  email: "carla@example.com",
  branch_id: 1,
  source: "whatsapp",
  message: "",
  status: "new",
  assigned_to: 7,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.getCurrentTenantId).mockReturnValue("tenant-1");
  vi.mocked(api.me).mockResolvedValue({
    id: "42",
    name: "Admin",
    email: "admin@example.com",
    role: { id: 1, name: "admin" },
    branch_id: "1",
    permissions: ["view_ticket", "assign_ticket", "edit_ticket", "create_ticket"],
    is_super_admin: false,
  });
  vi.mocked(api.listBranches).mockResolvedValue([{ id: "1", name: "Main", code: "M1", address: "" }]);
  vi.mocked(api.listUsers).mockResolvedValue([{ id: 7, name: "Alice", role: { id: 2, name: "sales" } }]);
  vi.mocked(api.listTicketCategories).mockResolvedValue([{ id: 1, name: "Soporte" }]);
  vi.mocked(api.listTicketPriorities).mockResolvedValue([{ id: 1, name: "Medium" }]);
  vi.mocked(api.listTickets).mockResolvedValue({
    data: [{
      id: 200,
      ticket_number: "TCK-2026-000200",
      subject: "Seguimiento",
      status: "New",
      category_id: 1,
      category: { id: 1, name: "Soporte" },
      due_date: null,
    }],
    last_page: 1,
    total: 1,
  });
  vi.mocked(api.listConversations).mockResolvedValue({ data: [] });
  vi.mocked(api.getLead).mockResolvedValue({ appointments: [], sales: [] });
});

const renderModal = () =>
  render(
    <LeadModal
      isOpen
      onClose={() => { }}
      onSuccess={() => { }}
      leadToEdit={leadToEdit() as never}
    />,
  );

describe("LeadModal — ticket list category display", () => {
  it("renders the ticket's own category, sourced from listTickets(), in the lead's ticket list", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(await screen.findByRole("button", { name: /Tickets/i }));

    expect(await screen.findByText("TCK-2026-000200")).toBeTruthy();
    expect(await screen.findByText("Soporte")).toBeTruthy();
  });
});
