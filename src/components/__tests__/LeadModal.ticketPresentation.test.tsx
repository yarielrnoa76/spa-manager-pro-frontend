import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LeadModal from "../LeadModal";
import { api } from "../../services/api";

/**
 * Manual Ingestion K6 UX closure, Corrections 4/5: LeadModal's own ticket detail must present the
 * same status labels and comment author/timestamp as Tickets.tsx -- a shared function, not a
 * second, independent mapping.
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
      updateTicket: vi.fn(),
      getTicketLeadContext: vi.fn(),
      getTicketAssignmentContext: vi.fn(),
      listConversations: vi.fn(),
      getLead: vi.fn(),
      createLead: vi.fn(),
      updateLead: vi.fn(),
    },
  };
});

const TICKET_ROW = {
  id: 100,
  ticket_number: "TCK-2026-000100",
  subject: "Primer contacto",
  status: "InProgress",
  category: { id: 1, name: "General" },
  due_date: null,
};

const ticketDetail = (comments: Array<Record<string, unknown>> = []) => ({
  ...TICKET_ROW,
  description: "Detalle",
  responsable_id: null,
  responsable: null,
  lead_id: 55,
  comments,
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
  assigned_to: null,
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
    permissions: ["view_ticket", "assign_ticket", "edit_ticket"],
    is_super_admin: false,
  });
  vi.mocked(api.listBranches).mockResolvedValue([{ id: "1", name: "Main", code: "M1", address: "" }]);
  vi.mocked(api.listUsers).mockResolvedValue([]);
  vi.mocked(api.listTicketCategories).mockResolvedValue([{ id: 1, name: "General" }]);
  vi.mocked(api.listTicketPriorities).mockResolvedValue([{ id: 1, name: "Medium" }]);
  vi.mocked(api.listTickets).mockResolvedValue({ data: [TICKET_ROW], last_page: 1, total: 1 });
  vi.mocked(api.getTicket).mockResolvedValue(ticketDetail());
  vi.mocked(api.getTicketLeadContext).mockResolvedValue({
    id: 55, name: "Carla", last_name: "Diaz", phone: "555-0100", email: "carla@example.com",
    source: "whatsapp", status: "new", branch_id: 1, assigned_to: null, created_at: null,
  });
  vi.mocked(api.getTicketAssignmentContext).mockResolvedValue({
    ticket_status: "InProgress", ticket_responsable_id: null, lead_responsable_id: null,
    capabilities: { is_terminal: false, can_assign: true, can_deassign: true, can_reassign_lead: true },
    candidates: [],
  });
  vi.mocked(api.listConversations).mockResolvedValue({ data: [] });
  vi.mocked(api.getLead).mockResolvedValue({ appointments: [], sales: [] });
});

const renderModal = () =>
  render(<LeadModal isOpen onClose={() => {}} onSuccess={() => {}} leadToEdit={leadToEdit() as never} />);

const openTicketDetail = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(await screen.findByRole("button", { name: /Tickets/i }));
  await user.click(await screen.findByText("TCK-2026-000100"));
};

describe("LeadModal — ticket status label (Correction 5)", () => {
  it("shows 'En tratamiento' for InProgress, never the literal value, in both list and detail", async () => {
    const user = userEvent.setup();
    renderModal();
    await user.click(await screen.findByRole("button", { name: /Tickets/i }));

    // The tickets tab shows the list only (LeadModal swaps it for the detail below, never both
    // at once), so a single occurrence of the label unambiguously identifies the list row.
    expect(await screen.findByText("En tratamiento")).toBeTruthy();
    expect(screen.queryByText("InProgress")).toBeNull();

    await user.click(screen.getByText("TCK-2026-000100"));
    await screen.findByText("Detalle");
    expect(screen.getByText("En tratamiento")).toBeTruthy();
    expect(screen.queryByText("InProgress")).toBeNull();
  });

  it.each([
    ["New", "Nuevo"],
    ["Completed", "Completado"],
    ["Cancelled", "Cancelado"],
  ])("maps %s to %s in the ticket detail", async (raw, label) => {
    vi.mocked(api.getTicket).mockResolvedValue({ ...ticketDetail(), status: raw });
    vi.mocked(api.getTicketAssignmentContext).mockResolvedValue({
      ticket_status: raw, ticket_responsable_id: null, lead_responsable_id: null,
      capabilities: { is_terminal: raw !== "New", can_assign: true, can_deassign: true, can_reassign_lead: true },
      candidates: [],
    });
    const user = userEvent.setup();
    renderModal();
    await openTicketDetail(user);
    await screen.findByText("Detalle");

    expect(screen.getByText(label)).toBeTruthy();
    expect(screen.queryByText(raw)).toBeNull();
  });
});

describe("LeadModal — ticket comment author and timestamp (Correction 4)", () => {
  it("shows creator.name, never a bare id", async () => {
    vi.mocked(api.getTicket).mockResolvedValue(
      ticketDetail([
        { id: 1, comment: "Hola", created_by: 10, created_at: "2026-09-12T10:49:00Z", creator: { id: 10, name: "Ana Pérez" } },
      ]),
    );
    const user = userEvent.setup();
    renderModal();
    await openTicketDetail(user);
    await screen.findByText("Detalle");

    expect(screen.getByText("Ana Pérez")).toBeTruthy();
    expect(screen.queryByText("10")).toBeNull();
  });

  it("shows a legible deleted-user fallback when creator is absent but created_by exists", async () => {
    vi.mocked(api.getTicket).mockResolvedValue(
      ticketDetail([{ id: 2, comment: "Hola", created_by: 10, created_at: "2026-09-12T10:49:00Z" }]),
    );
    const user = userEvent.setup();
    renderModal();
    await openTicketDetail(user);
    await screen.findByText("Detalle");

    expect(screen.getByText("Usuario eliminado (#10)")).toBeTruthy();
  });

  it("shows Sistema only when neither creator nor created_by exist", async () => {
    vi.mocked(api.getTicket).mockResolvedValue(
      ticketDetail([{ id: 3, comment: "Hola", created_by: null, created_at: "2026-09-12T10:49:00Z", creator: null }]),
    );
    const user = userEvent.setup();
    renderModal();
    await openTicketDetail(user);
    await screen.findByText("Detalle");

    expect(screen.getByText("Sistema")).toBeTruthy();
  });

  it("shows a full date (day/month/year) and hour:minute, matching Tickets.tsx's own format", async () => {
    vi.mocked(api.getTicket).mockResolvedValue(
      ticketDetail([{ id: 4, comment: "Hola", created_by: 10, created_at: "2026-09-12T10:49:00Z", creator: { id: 10, name: "Ana" } }]),
    );
    const user = userEvent.setup();
    renderModal();
    await openTicketDetail(user);
    await screen.findByText("Detalle");

    const dateNodes = screen.getAllByText(/^\d{2}\/\d{2}\/2026 \d{2}:\d{2}$/);
    expect(dateNodes.length).toBeGreaterThan(0);
  });
});
