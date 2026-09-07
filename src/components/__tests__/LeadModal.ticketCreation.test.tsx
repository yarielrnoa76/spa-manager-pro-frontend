import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LeadModal from "../LeadModal";
import { api } from "../../services/api";

/**
 * Second corrective pass, §7.
 *
 * `LeadModal`'s own manual ticket-creation form (distinct from its reassignment dialog, covered
 * by `LeadModal.ticketAssignment.test.tsx`): removing the visual responsable selector was not
 * enough in the first corrective pass -- `ticketData` still carried `responsable_id` in its
 * state and the create payload was built with `...ticketData`, so an empty `responsable_id: ""`
 * kept being sent on every manual creation. This suite asserts the ACTUAL PAYLOAD sent, not just
 * the absence of a visible control.
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
      createTicket: vi.fn(),
      updateTicket: vi.fn(),
      getTicketLeadContext: vi.fn(),
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
  vi.mocked(api.listTicketCategories).mockResolvedValue([{ id: 1, name: "General" }]);
  vi.mocked(api.listTicketPriorities).mockResolvedValue([{ id: 1, name: "Medium" }]);
  vi.mocked(api.listTickets).mockResolvedValue({ data: [], last_page: 1, total: 0 });
  vi.mocked(api.listConversations).mockResolvedValue({ data: [] });
  vi.mocked(api.getLead).mockResolvedValue({ appointments: [], sales: [] });
  vi.mocked(api.createTicket).mockResolvedValue({ id: 200 });
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

describe("LeadModal — manual ticket creation payload", () => {
  it("never sends responsable_id on creation, even though the field used to be spread from state", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(await screen.findByRole("button", { name: /Tickets/i }));
    await user.click(await screen.findByRole("button", { name: /\+ Nuevo Ticket/i }));

    const subjectInput = await screen.findByPlaceholderText(/Ej\.|asunto/i).catch(() => null)
      ?? (await screen.findAllByRole("textbox"))[0];
    await user.type(subjectInput, "Ticket manual de prueba");

    await user.click(screen.getByRole("button", { name: /Crear Ticket/i }));

    await waitFor(() => expect(api.createTicket).toHaveBeenCalledTimes(1));

    const [payload] = vi.mocked(api.createTicket).mock.calls[0];
    expect(payload).not.toHaveProperty("responsable_id");
    // The branch sent must be the LEAD's own branch, never an independent value.
    expect(payload).toMatchObject({ lead_id: 55, branch_id: 1 });
  });
});
