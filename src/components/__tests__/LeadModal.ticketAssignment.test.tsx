import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LeadModal from "../LeadModal";
import { api, ApiError } from "../../services/api";

/**
 * Phase 1B.5D — Lead/Ticket Ownership, Visibility and Notification block (§14), extended by the
 * Tickets/Tasks global surface (§10/§11): the responsable control now comes from
 * `useTicketAssignmentControl`/`TicketAssignmentControl.tsx`, the SAME shared authority the
 * global Tickets/Tasks surface uses — candidates and capabilities come exclusively from
 * `GET /tickets/{ticket}/assignment-context`, never `api.listUsers()`. Selecting a new
 * responsable acts immediately (no "Guardar Cambios" gate); editorial fields (subject/
 * description) are still bundled into the SAME `PUT` request so an edit and a reassignment made
 * together still commit atomically.
 *
 * Covers the three-option assignment/deassignment dialog, the explicit `reassign_lead` +
 * `expected_*` payload, 409 handling, the five ticket load states, and lead-switch state
 * cleanup. Every assertion is about what the component SENDS and SHOWS — none of it re-tests
 * the backend contract, which has its own suite.
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

const CANDIDATES = [
  { id: 7, name: "Alice", role: "sales" },
  { id: 9, name: "Bruno", role: "sales" },
];

const TICKET_ROW = {
  id: 100,
  ticket_number: "TCK-2026-000100",
  subject: "Primer contacto",
  status: "New",
  category: { id: 1, name: "General" },
  due_date: null,
};

/** A ticket detail whose responsable is Alice (7). */
const ticketDetail = (responsableId: number | null) => ({
  ...TICKET_ROW,
  description: "Detalle",
  responsable_id: responsableId,
  responsable: responsableId === 7 ? { id: 7, name: "Alice" } : null,
  lead_id: 55,
  comments: [],
});

const assignmentContext = (ticketResponsableId: number | null, leadResponsableId: number | null) => ({
  ticket_status: "New",
  ticket_responsable_id: ticketResponsableId,
  lead_responsable_id: leadResponsableId,
  current_responsable: CANDIDATES.find((c) => c.id === ticketResponsableId) ?? null,
  capabilities: { is_terminal: false, can_assign: true, can_deassign: true, can_reassign_lead: true },
  candidates: CANDIDATES,
});

const leadToEdit = (assignedTo: string | number | null = 7) => ({
  id: 55,
  name: "Carla",
  last_name: "Diaz",
  phone: "555-0100",
  email: "carla@example.com",
  branch_id: 1,
  source: "whatsapp",
  message: "",
  status: "new",
  assigned_to: assignedTo,
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
  vi.mocked(api.getTicket).mockResolvedValue(ticketDetail(7));
  vi.mocked(api.getTicketLeadContext).mockResolvedValue({
    id: 55, name: "Carla", last_name: "Diaz", phone: "555-0100", email: "carla@example.com",
    source: "whatsapp", status: "new", branch_id: 1, assigned_to: 7, created_at: null,
  });
  vi.mocked(api.getTicketAssignmentContext).mockResolvedValue(assignmentContext(7, 7));
  vi.mocked(api.listConversations).mockResolvedValue({ data: [] });
  vi.mocked(api.getLead).mockResolvedValue({ appointments: [], sales: [] });
  vi.mocked(api.updateTicket).mockResolvedValue({});
});

const renderModal = (lead = leadToEdit()) =>
  render(
    <LeadModal
      isOpen
      onClose={() => { }}
      onSuccess={() => { }}
      leadToEdit={lead as never}
    />,
  );

/** Opens the Tickets tab, the first ticket, and its edit form. */
const openTicketEditor = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(await screen.findByRole("button", { name: /Tickets/i }));
  await user.click(await screen.findByText("TCK-2026-000100"));
  await user.click(await screen.findByRole("button", { name: /^Editar$/i }));
};

const responsableSelect = () => screen.findByTestId("ticket-assignment-select") as Promise<HTMLSelectElement>;

describe("LeadModal — ticket assignment dialog", () => {
  it("asks the three-option question when the new responsable differs from the lead's assignee", async () => {
    const user = userEvent.setup();
    renderModal();
    await openTicketEditor(user);

    const select = await responsableSelect();
    await user.selectOptions(select, "9");

    const dialog = await screen.findByTestId("assignment-dialog");
    expect(dialog).toBeTruthy();
    expect(screen.getByTestId("assignment-dialog-ticket-only").textContent).toBe("Solo el ticket");
    expect(screen.getByTestId("assignment-dialog-ticket-and-lead").textContent).toBe("Ticket y lead");
    expect(screen.getByTestId("assignment-dialog-cancel").textContent).toBe("Cancelar");

    // Nothing has been sent yet: the question comes BEFORE any request.
    expect(api.updateTicket).not.toHaveBeenCalled();
  });

  it("Cancelar closes the dialog and produces zero requests", async () => {
    const user = userEvent.setup();
    renderModal();
    await openTicketEditor(user);

    await user.selectOptions(await responsableSelect(), "9");
    await screen.findByTestId("assignment-dialog");

    await user.click(screen.getByTestId("assignment-dialog-cancel"));

    await waitFor(() => expect(screen.queryByTestId("assignment-dialog")).toBeNull());
    expect(api.updateTicket).not.toHaveBeenCalled();
  });

  it("Solo el ticket sends reassign_lead=false with the observed precondition and no lead precondition", async () => {
    const user = userEvent.setup();
    renderModal();
    await openTicketEditor(user);

    await user.selectOptions(await responsableSelect(), "9");
    await user.click(await screen.findByTestId("assignment-dialog-ticket-only"));

    await waitFor(() => expect(api.updateTicket).toHaveBeenCalledTimes(1));

    const [ticketId, payload] = vi.mocked(api.updateTicket).mock.calls[0];
    expect(ticketId).toBe(100);
    expect(payload).toMatchObject({
      responsable_id: 9,
      reassign_lead: false,
      expected_responsable_id: 7,
    });
    // The lead dimension is not being written, so its precondition is not sent.
    expect(payload).not.toHaveProperty("expected_lead_assigned_to");
  });

  it("Ticket y lead sends reassign_lead=true with BOTH observed preconditions", async () => {
    const user = userEvent.setup();
    renderModal();
    await openTicketEditor(user);

    await user.selectOptions(await responsableSelect(), "9");
    await user.click(await screen.findByTestId("assignment-dialog-ticket-and-lead"));

    await waitFor(() => expect(api.updateTicket).toHaveBeenCalledTimes(1));

    const [, payload] = vi.mocked(api.updateTicket).mock.calls[0];
    expect(payload).toMatchObject({
      responsable_id: 9,
      reassign_lead: true,
      expected_responsable_id: 7,
      expected_lead_assigned_to: 7,
    });
  });

  it("clearing the responsable opens the deassignment dialog and sends an explicit null target", async () => {
    const user = userEvent.setup();
    renderModal();
    await openTicketEditor(user);

    await user.selectOptions(await responsableSelect(), "");

    await screen.findByTestId("assignment-dialog");
    expect(screen.getByTestId("assignment-dialog-ticket-only").textContent).toBe("Desasignar solo el ticket");
    expect(screen.getByTestId("assignment-dialog-ticket-and-lead").textContent).toBe("Desasignar ticket y lead");

    await user.click(screen.getByTestId("assignment-dialog-ticket-and-lead"));
    await waitFor(() => expect(api.updateTicket).toHaveBeenCalledTimes(1));

    const [, payload] = vi.mocked(api.updateTicket).mock.calls[0];
    expect(payload).toMatchObject({
      responsable_id: null,
      reassign_lead: true,
      expected_responsable_id: 7,
      expected_lead_assigned_to: 7,
    });
  });

  it("sends expected_responsable_id as an explicit null when the ticket was observed unassigned", async () => {
    vi.mocked(api.getTicket).mockResolvedValue(ticketDetail(null));
    vi.mocked(api.getTicketLeadContext).mockResolvedValue({
      id: 55, name: "Carla", last_name: "Diaz", phone: "555-0100", email: "carla@example.com",
      source: "whatsapp", status: "new", branch_id: 1, assigned_to: null, created_at: null,
    });
    vi.mocked(api.getTicketAssignmentContext).mockResolvedValue(assignmentContext(null, null));

    const user = userEvent.setup();
    renderModal(leadToEdit(null));
    await openTicketEditor(user);

    await user.selectOptions(await responsableSelect(), "9");
    await user.click(await screen.findByTestId("assignment-dialog-ticket-only"));

    await waitFor(() => expect(api.updateTicket).toHaveBeenCalledTimes(1));

    const [, payload] = vi.mocked(api.updateTicket).mock.calls[0] as [number, Record<string, unknown>];
    // The KEY is present with the value null — never omitted, which the backend treats as
    // "no expectation at all" and fails closed.
    expect("expected_responsable_id" in payload).toBe(true);
    expect(payload.expected_responsable_id).toBeNull();
  });

  /**
   * Adversarial correction, defect 3: a target that already equals the lead's own assignee used
   * to submit directly with no confirmation at all. Every effective assignment now opens the
   * three-option dialog unconditionally — nothing is sent until the user explicitly confirms one
   * of the two affirmative choices.
   */
  it("still asks for confirmation when the new responsable already equals the lead's assignee", async () => {
    vi.mocked(api.getTicket).mockResolvedValue(ticketDetail(null));
    vi.mocked(api.getTicketAssignmentContext).mockResolvedValue(assignmentContext(null, 9));

    const user = userEvent.setup();
    renderModal(leadToEdit(9));
    vi.mocked(api.getTicketLeadContext).mockResolvedValue({
      id: 55, name: "Carla", last_name: "Diaz", phone: "555-0100", email: "carla@example.com",
      source: "whatsapp", status: "new", branch_id: 1, assigned_to: 9, created_at: null,
    });
    await openTicketEditor(user);

    await user.selectOptions(await responsableSelect(), "9");

    expect(await screen.findByTestId("assignment-dialog")).toBeTruthy();
    expect(api.updateTicket).not.toHaveBeenCalled();

    await user.click(await screen.findByTestId("assignment-dialog-ticket-only"));

    await waitFor(() => expect(api.updateTicket).toHaveBeenCalledTimes(1));
    const [, payload] = vi.mocked(api.updateTicket).mock.calls[0];
    expect(payload).toMatchObject({ responsable_id: 9, reassign_lead: false });
  });

  it("a 409 explains that someone else changed it and reloads the current state", async () => {
    vi.mocked(api.updateTicket).mockRejectedValueOnce(
      new ApiError("Conflict", { status: 409, data: { message: "Conflict" } }),
    );

    const user = userEvent.setup();
    renderModal();
    await openTicketEditor(user);

    const getTicketCallsBefore = vi.mocked(api.getTicket).mock.calls.length;
    await user.selectOptions(await responsableSelect(), "9");
    await user.click(await screen.findByTestId("assignment-dialog-ticket-only"));

    const banner = await screen.findByTestId("assignment-error");
    expect(banner.textContent).toMatch(/Otro usuario modificó/i);

    // The dialog is closed (no second decision until the user has seen the current state) and
    // the state was reloaded from the server.
    expect(screen.queryByTestId("assignment-dialog")).toBeNull();
    await waitFor(() =>
      expect(vi.mocked(api.getTicket).mock.calls.length).toBeGreaterThan(getTicketCallsBefore),
    );
  });

  it("a terminal ticket shows a read-only responsable, never the select", async () => {
    vi.mocked(api.getTicket).mockResolvedValue({ ...ticketDetail(7), status: "Completed" });
    vi.mocked(api.getTicketAssignmentContext).mockResolvedValue({
      ...assignmentContext(7, 7),
      ticket_status: "Completed",
      capabilities: { is_terminal: true, can_assign: false, can_deassign: false, can_reassign_lead: false },
      candidates: [],
    });

    const user = userEvent.setup();
    renderModal();
    await openTicketEditor(user);

    expect(await screen.findByTestId("ticket-assignment-readonly")).toBeTruthy();
    expect(screen.queryByTestId("ticket-assignment-select")).toBeNull();
  });
});

describe("LeadModal — ticket load states", () => {
  it("shows the success list when tickets are returned", async () => {
    const user = userEvent.setup();
    renderModal();
    await user.click(await screen.findByRole("button", { name: /Tickets/i }));

    expect(await screen.findByTestId("tickets-state-success")).toBeTruthy();
  });

  it("shows the empty state ONLY for a successful empty response", async () => {
    vi.mocked(api.listTickets).mockResolvedValue({ data: [], last_page: 1, total: 0 });

    const user = userEvent.setup();
    renderModal();
    await user.click(await screen.findByRole("button", { name: /Tickets/i }));

    expect(await screen.findByTestId("tickets-state-empty")).toBeTruthy();
  });

  it("shows a forbidden state, never 'no tickets', for a 403", async () => {
    vi.mocked(api.listTickets).mockRejectedValue(new ApiError("Forbidden", { status: 403 }));

    const user = userEvent.setup();
    renderModal();
    await user.click(await screen.findByRole("button", { name: /Tickets/i }));

    expect(await screen.findByTestId("tickets-state-forbidden")).toBeTruthy();
    expect(screen.queryByTestId("tickets-state-empty")).toBeNull();
  });

  it("shows an error state, never 'no tickets', for a 500", async () => {
    vi.mocked(api.listTickets).mockRejectedValue(new ApiError("Server error", { status: 500 }));

    const user = userEvent.setup();
    renderModal();
    await user.click(await screen.findByRole("button", { name: /Tickets/i }));

    expect(await screen.findByTestId("tickets-state-error")).toBeTruthy();
    expect(screen.queryByTestId("tickets-state-empty")).toBeNull();
  });

  it("shows an error state, never 'no tickets', for a network failure", async () => {
    vi.mocked(api.listTickets).mockRejectedValue(new TypeError("Failed to fetch"));

    const user = userEvent.setup();
    renderModal();
    await user.click(await screen.findByRole("button", { name: /Tickets/i }));

    expect(await screen.findByTestId("tickets-state-error")).toBeTruthy();
    expect(screen.queryByTestId("tickets-state-empty")).toBeNull();
  });
});

describe("LeadModal — lead-dependent state cleanup", () => {
  it("never shows the previous lead's tickets after switching to another lead", async () => {
    const user = userEvent.setup();
    const { rerender } = renderModal(leadToEdit(7));

    await user.click(await screen.findByRole("button", { name: /Tickets/i }));
    expect(await screen.findByText("TCK-2026-000100")).toBeTruthy();

    // The next lead's tickets never resolve, so anything still on screen would necessarily be
    // the PREVIOUS lead's data.
    vi.mocked(api.listTickets).mockImplementation(() => new Promise(() => { }));

    rerender(
      <LeadModal
        isOpen
        onClose={() => { }}
        onSuccess={() => { }}
        leadToEdit={{ ...leadToEdit(9), id: 56, name: "Otro" } as never}
      />,
    );

    await waitFor(() => expect(screen.queryByText("TCK-2026-000100")).toBeNull());
  });

  it("clears the open ticket and its lead context when another lead is opened", async () => {
    const user = userEvent.setup();
    const { rerender } = renderModal(leadToEdit(7));

    await user.click(await screen.findByRole("button", { name: /Tickets/i }));
    await user.click(await screen.findByText("TCK-2026-000100"));
    expect(await screen.findByTestId("ticket-lead-context")).toBeTruthy();

    rerender(
      <LeadModal
        isOpen
        onClose={() => { }}
        onSuccess={() => { }}
        leadToEdit={{ ...leadToEdit(9), id: 56, name: "Otro" } as never}
      />,
    );

    await waitFor(() => expect(screen.queryByTestId("ticket-lead-context")).toBeNull());
  });
});
