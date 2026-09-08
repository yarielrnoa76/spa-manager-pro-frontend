import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SaleModal from '../SaleModal';
import { api, ApiError } from '../../services/api';

/**
 * Adversarial correction, defect 1/9: SaleModal used to run a second, parallel ticket-assignment
 * flow — `updateTicket()` (editorial) followed unconditionally by `assignTicket({ reassign_lead:
 * false })` with a swallowed `.catch(() => {})`, then a THIRD, separate `updateTicketStatus()`
 * call — with no confirmation dialog and no visible failure on a rejected/conflicting
 * assignment. This suite verifies SaleModal now shares the SAME assignment authority as
 * LeadModal/Tickets.tsx (`useTicketAssignmentControl` + `TicketAssignmentControl.tsx`): every
 * responsable change opens the three-option confirmation dialog, nothing is sent before
 * confirmation, and a rejected submission surfaces visibly rather than being discarded. It also
 * verifies a sale with no lead can never be used to create a ticket.
 */

vi.mock('../../services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/api')>();
  return {
    ...actual,
    api: {
      getSale: vi.fn(),
      listUsers: vi.fn(),
      listPaymentMethods: vi.fn(),
      listBranches: vi.fn(),
      listTicketCategories: vi.fn(),
      listTicketPriorities: vi.fn(),
      listConversations: vi.fn(),
      getTicketAssignmentContext: vi.fn(),
      updateTicket: vi.fn(),
      updateTicketStatus: vi.fn(),
      assignTicket: vi.fn(),
    },
  };
});

const ADMIN_USER = { id: 1, is_super_admin: true, permissions: [] };

const CANDIDATES = [
  { id: 7, name: 'Alice', role: 'sales' },
  { id: 9, name: 'Bruno', role: 'sales' },
];

const LEAD = {
  id: 55,
  name: 'Carla',
  last_name: 'Diaz',
  phone: '555-0100',
  email: 'carla@example.com',
  branch_id: 1,
  assigned_to: 7,
};

const TICKET = {
  id: 200,
  ticket_number: 'TCK-2026-000200',
  subject: 'Seguimiento de venta',
  status: 'New',
  priority: { name: 'Media' },
  responsable_id: 7,
  responsable: { id: 7, name: 'Alice' },
  category_id: 1,
  created_at: '2026-07-29T00:00:00Z',
};

function buildSale(overrides: Partial<{ lead: typeof LEAD | null; tickets: typeof TICKET[] }> = {}) {
  const lead = 'lead' in overrides ? overrides.lead : LEAD;
  return {
    id: 300,
    lead_id: lead?.id ?? null,
    branch_id: 1,
    client_name: 'Cliente Ticket',
    payment_method: 'card',
    created_at: '2026-07-29T00:00:00Z',
    lead: lead ? { ...lead, tickets: overrides.tickets ?? [TICKET] } : null,
  };
}

const assignmentContext = (ticketResponsableId: number | null) => ({
  ticket_status: 'New',
  ticket_responsable_id: ticketResponsableId,
  lead_responsable_id: 7,
  current_responsable: CANDIDATES.find((c) => c.id === ticketResponsableId) ?? null,
  capabilities: { is_terminal: false, can_assign: true, can_deassign: true, can_reassign_lead: true },
  candidates: CANDIDATES,
});

async function openTicketsTab(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByText('Tickets', { exact: false }));
}

describe('SaleModal — ticket assignment (shared authority)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.listUsers).mockResolvedValue([]);
    vi.mocked(api.listPaymentMethods).mockResolvedValue([]);
    vi.mocked(api.listBranches).mockResolvedValue([]);
    vi.mocked(api.listTicketCategories).mockResolvedValue([{ id: 1, name: 'General' }]);
    vi.mocked(api.listTicketPriorities).mockResolvedValue([{ id: 1, name: 'Media' }]);
    vi.mocked(api.listConversations).mockResolvedValue({ data: [] });
    vi.mocked(api.getTicketAssignmentContext).mockResolvedValue(assignmentContext(7));
    vi.mocked(api.updateTicket).mockResolvedValue({});
    vi.mocked(api.updateTicketStatus).mockResolvedValue({});
  });

  it('opens the confirmation dialog on a responsable change and never mutates before confirming', async () => {
    vi.mocked(api.getSale).mockResolvedValue(buildSale());
    const user = userEvent.setup();
    render(<SaleModal isOpen saleId={300} user={ADMIN_USER} onClose={vi.fn()} onSuccess={vi.fn()} />);

    await openTicketsTab(user);
    await user.click(await screen.findByTitle('Editar ticket'));

    const select = await screen.findByTestId('ticket-assignment-select');
    await user.selectOptions(select, '9');

    // The dialog must appear and nothing must be sent yet — this is the exact defect (an
    // immediate, unconfirmed `assignTicket` call) this correction removes.
    expect(await screen.findByTestId('assignment-dialog')).toBeTruthy();
    expect(api.updateTicket).not.toHaveBeenCalled();
    expect(api.assignTicket).not.toHaveBeenCalled();

    await user.click(await screen.findByTestId('assignment-dialog-ticket-only'));

    await waitFor(() => expect(api.updateTicket).toHaveBeenCalledTimes(1));
    const [, payload] = vi.mocked(api.updateTicket).mock.calls[0] as [number, Record<string, unknown>];
    expect(payload).toMatchObject({ responsable_id: 9, reassign_lead: false });
    // The legacy parallel path (`assignTicket` called directly by the screen) must never fire.
    expect(api.assignTicket).not.toHaveBeenCalled();
  });

  it('surfaces a rejected assignment instead of silently discarding it', async () => {
    vi.mocked(api.getSale).mockResolvedValue(buildSale());
    vi.mocked(api.updateTicket).mockRejectedValueOnce(
      new ApiError('Conflict', { status: 409, data: { message: 'Conflict' } }),
    );
    const user = userEvent.setup();
    render(<SaleModal isOpen saleId={300} user={ADMIN_USER} onClose={vi.fn()} onSuccess={vi.fn()} />);

    await openTicketsTab(user);
    await user.click(await screen.findByTitle('Editar ticket'));
    await user.selectOptions(await screen.findByTestId('ticket-assignment-select'), '9');
    await user.click(await screen.findByTestId('assignment-dialog-ticket-only'));

    // Adversarial correction, defect 1: the old flow wrapped this exact call in
    // `.catch(() => {})`, so a 409/422/403 vanished with no trace. It must now be visible.
    expect(await screen.findByTestId('assignment-error')).toBeTruthy();
  });

  it('hides "Ticket y lead" when the actor cannot reassign the lead', async () => {
    vi.mocked(api.getSale).mockResolvedValue(buildSale());
    vi.mocked(api.getTicketAssignmentContext).mockResolvedValue({
      ...assignmentContext(7),
      capabilities: { is_terminal: false, can_assign: true, can_deassign: true, can_reassign_lead: false },
    });
    const user = userEvent.setup();
    render(<SaleModal isOpen saleId={300} user={ADMIN_USER} onClose={vi.fn()} onSuccess={vi.fn()} />);

    await openTicketsTab(user);
    await user.click(await screen.findByTitle('Editar ticket'));
    await user.selectOptions(await screen.findByTestId('ticket-assignment-select'), '9');

    expect(await screen.findByTestId('assignment-dialog')).toBeTruthy();
    expect(screen.queryByTestId('assignment-dialog-ticket-and-lead')).toBeNull();
  });

  it('does not offer ticket creation and explains why when the sale has no lead', async () => {
    vi.mocked(api.getSale).mockResolvedValue(buildSale({ lead: null }));
    const user = userEvent.setup();
    render(<SaleModal isOpen saleId={300} user={ADMIN_USER} onClose={vi.fn()} onSuccess={vi.fn()} />);

    await openTicketsTab(user);

    expect(screen.queryByText('Crear Ticket')).toBeNull();
    expect(await screen.findByText(/no tiene un lead asociado/i)).toBeTruthy();
  });

  it('creating a ticket from a sale locks it to that sale\'s own lead', async () => {
    vi.mocked(api.getSale).mockResolvedValue(buildSale());
    const user = userEvent.setup();
    render(<SaleModal isOpen saleId={300} user={ADMIN_USER} onClose={vi.fn()} onSuccess={vi.fn()} />);

    await openTicketsTab(user);
    await user.click(await screen.findByText('Crear Ticket'));

    // Locked-lead mode never renders a lead search box or `api.listLeads()` picker — the lead is
    // fixed to the sale's own lead, shown as a non-editable confirmation instead.
    expect(await screen.findByText(/vinculado automáticamente a/i)).toBeTruthy();
    expect(screen.getByText('Carla')).toBeTruthy();
    expect(screen.queryByPlaceholderText('Buscar por nombre o teléfono...')).toBeNull();
  });

  it('a confirmed assignment still carries full optimistic-concurrency preconditions', async () => {
    vi.mocked(api.getSale).mockResolvedValue(buildSale());
    const user = userEvent.setup();
    render(<SaleModal isOpen saleId={300} user={ADMIN_USER} onClose={vi.fn()} onSuccess={vi.fn()} />);

    await openTicketsTab(user);
    await user.click(await screen.findByTitle('Editar ticket'));
    await user.selectOptions(await screen.findByTestId('ticket-assignment-select'), '9');
    await user.click(await screen.findByTestId('assignment-dialog-ticket-and-lead'));

    await waitFor(() => expect(api.updateTicket).toHaveBeenCalledTimes(1));
    const [, payload] = vi.mocked(api.updateTicket).mock.calls[0] as [number, Record<string, unknown>];
    expect(payload).toMatchObject({
      responsable_id: 9,
      reassign_lead: true,
      expected_responsable_id: 7,
      expected_lead_assigned_to: 7,
    });
  });
});

/**
 * Final adversarial correction, Correction 2: `SaleModal::saveTicketEdit()` used to bundle an
 * editorial `updateTicket()` with an unconditional `updateTicketStatus()` inside the same user
 * action — a partial-mutation risk (the editorial half could persist while the status half
 * failed, yet the UI reported one undifferentiated failure) and a redundant-request risk (status
 * was resent even when it hadn't changed). "Guardar Detalles" is now editorial-only; a status
 * transition is its own explicit, separate action reusing the ticket's own canonical
 * `POST /tickets/{id}/status` endpoint.
 */
describe('SaleModal — ticket editorial save vs. status transition are fully separated (Correction 2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.listUsers).mockResolvedValue([]);
    vi.mocked(api.listPaymentMethods).mockResolvedValue([]);
    vi.mocked(api.listBranches).mockResolvedValue([]);
    vi.mocked(api.listTicketCategories).mockResolvedValue([{ id: 1, name: 'General' }]);
    vi.mocked(api.listTicketPriorities).mockResolvedValue([{ id: 1, name: 'Media' }]);
    vi.mocked(api.listConversations).mockResolvedValue({ data: [] });
    vi.mocked(api.getTicketAssignmentContext).mockResolvedValue(assignmentContext(7));
    vi.mocked(api.updateTicket).mockResolvedValue({});
    vi.mocked(api.updateTicketStatus).mockResolvedValue({});
    vi.mocked(api.getSale).mockResolvedValue(buildSale());
  });

  it('"Guardar Detalles" issues exactly one editorial request and zero status requests', async () => {
    const user = userEvent.setup();
    render(<SaleModal isOpen saleId={300} user={ADMIN_USER} onClose={vi.fn()} onSuccess={vi.fn()} />);

    await openTicketsTab(user);
    await user.click(await screen.findByTitle('Editar ticket'));
    const subjectInput = await screen.findByDisplayValue('Seguimiento de venta');
    await user.clear(subjectInput);
    await user.type(subjectInput, 'Asunto actualizado');
    await user.click(screen.getByText('Guardar Detalles'));

    await waitFor(() => expect(api.updateTicket).toHaveBeenCalledTimes(1));
    const [, payload] = vi.mocked(api.updateTicket).mock.calls[0] as [number, Record<string, unknown>];
    expect(payload).toMatchObject({ subject: 'Asunto actualizado' });
    expect(payload).not.toHaveProperty('status');
    expect(payload).not.toHaveProperty('responsable_id');
    expect(api.updateTicketStatus).not.toHaveBeenCalled();
  });

  it('changing status issues exactly one canonical status command and zero editorial requests', async () => {
    const user = userEvent.setup();
    render(<SaleModal isOpen saleId={300} user={ADMIN_USER} onClose={vi.fn()} onSuccess={vi.fn()} />);

    await openTicketsTab(user);
    await user.click(await screen.findByTitle('Editar ticket'));
    await user.click(await screen.findByText('Completar'));

    await waitFor(() => expect(api.updateTicketStatus).toHaveBeenCalledTimes(1));
    expect(api.updateTicketStatus).toHaveBeenCalledWith(200, 'Completed', undefined);
    expect(api.updateTicket).not.toHaveBeenCalled();
  });

  it('cancelling a ticket sends its reason through the same canonical status command', async () => {
    const user = userEvent.setup();
    render(<SaleModal isOpen saleId={300} user={ADMIN_USER} onClose={vi.fn()} onSuccess={vi.fn()} />);

    await openTicketsTab(user);
    await user.click(await screen.findByTitle('Editar ticket'));
    await user.click(await screen.findByText('Cancelar Ticket'));
    await user.type(await screen.findByPlaceholderText('Motivo de la cancelación...'), 'Cliente desistió');
    await user.click(await screen.findByText('Confirmar Cancelación'));

    await waitFor(() => expect(api.updateTicketStatus).toHaveBeenCalledTimes(1));
    expect(api.updateTicketStatus).toHaveBeenCalledWith(200, 'Cancelled', 'Cliente desistió');
    expect(api.updateTicket).not.toHaveBeenCalled();
  });

  it('a status failure never presents as a failure of an already-applied edit', async () => {
    vi.mocked(api.updateTicketStatus).mockRejectedValueOnce(new ApiError('boom', { status: 500 }));
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const user = userEvent.setup();
    render(<SaleModal isOpen saleId={300} user={ADMIN_USER} onClose={vi.fn()} onSuccess={vi.fn()} />);

    await openTicketsTab(user);
    await user.click(await screen.findByTitle('Editar ticket'));
    await user.click(await screen.findByText('Completar'));

    // The status-specific error surface fires; the editorial `alert()` path — which would
    // misleadingly imply the (never-attempted) edit failed — must never fire for this.
    expect(await screen.findByTestId('ticket-status-error')).toBeTruthy();
    expect(alertSpy).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it('a second click while a status change is in flight issues no additional updateTicketStatus() call', async () => {
    // `changeTicketStatus()` itself also no-ops outright whenever the target status already
    // equals `ticket.status` — unreachable through the UI's own conditional rendering (which
    // never re-offers a matching transition once it's applied), so the practically reachable,
    // testable guarantee is this one: the button disables itself for the duration of the
    // in-flight request, so a second click on the SAME already-requested transition can never
    // fire a second, redundant `updateTicketStatus()` call.
    let resolveStatus: (value: unknown) => void = () => {};
    vi.mocked(api.updateTicketStatus).mockImplementation(() => new Promise((resolve) => { resolveStatus = resolve; }));
    const user = userEvent.setup();
    render(<SaleModal isOpen saleId={300} user={ADMIN_USER} onClose={vi.fn()} onSuccess={vi.fn()} />);

    await openTicketsTab(user);
    await user.click(await screen.findByTitle('Editar ticket'));

    const completeButton = await screen.findByText('Completar');
    await user.click(completeButton);
    expect(completeButton).toBeDisabled();

    await user.click(completeButton);
    expect(api.updateTicketStatus).toHaveBeenCalledTimes(1);

    resolveStatus({});
    await waitFor(() => expect(completeButton).not.toBeDisabled());
  });
});

/**
 * Final adversarial correction, Correction 3: `users`/`filteredUsers` feed EXCLUSIVELY the sale's
 * own `edit_sale`-gated seller selector. `api.listUsers()` used to also fire for `edit_ticket`/
 * `view_ticket` alone, fetching a tenant-wide user list a ticket-only actor has no use for —
 * ticket assignment has used the dedicated `assignment-context` authority since the prior pass.
 */
describe('SaleModal — listUsers() is edit_sale-only (Correction 3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.listUsers).mockResolvedValue([{ id: 1, name: 'Seller One', branch_id: 1 }]);
    vi.mocked(api.listPaymentMethods).mockResolvedValue([]);
    vi.mocked(api.listBranches).mockResolvedValue([]);
    vi.mocked(api.listTicketCategories).mockResolvedValue([{ id: 1, name: 'General' }]);
    vi.mocked(api.listTicketPriorities).mockResolvedValue([{ id: 1, name: 'Media' }]);
    vi.mocked(api.listConversations).mockResolvedValue({ data: [] });
    vi.mocked(api.getTicketAssignmentContext).mockResolvedValue(assignmentContext(7));
    vi.mocked(api.getSale).mockResolvedValue(buildSale());
  });

  it('a user with only view_ticket never calls listUsers()', async () => {
    const viewOnlyUser = { id: 2, is_super_admin: false, permissions: ['view_ticket'] };
    render(<SaleModal isOpen saleId={300} user={viewOnlyUser} onClose={vi.fn()} onSuccess={vi.fn()} />);

    await screen.findByText('Detalles de la Venta');
    await waitFor(() => expect(api.getSale).toHaveBeenCalled());
    expect(api.listUsers).not.toHaveBeenCalled();
  });

  it('a user with only edit_ticket never calls listUsers()', async () => {
    const ticketEditorUser = { id: 3, is_super_admin: false, permissions: ['view_ticket', 'edit_ticket'] };
    const user = userEvent.setup();
    render(<SaleModal isOpen saleId={300} user={ticketEditorUser} onClose={vi.fn()} onSuccess={vi.fn()} />);

    await openTicketsTab(user);
    await user.click(await screen.findByTitle('Editar ticket'));
    await screen.findByTestId('ticket-assignment-select');

    expect(api.listUsers).not.toHaveBeenCalled();
  });

  it('a user holding edit_sale still calls listUsers() and keeps the seller selector working', async () => {
    const salesAdminUser = { id: 4, is_super_admin: false, permissions: ['edit_sale'] };
    render(<SaleModal isOpen saleId={300} user={salesAdminUser} onClose={vi.fn()} onSuccess={vi.fn()} />);

    await waitFor(() => expect(api.listUsers).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('Seller One')).toBeTruthy();
  });

  it('listUsers() never feeds the ticket responsable selector', async () => {
    const salesAdminUser = { id: 5, is_super_admin: true, permissions: [] };
    const user = userEvent.setup();
    render(<SaleModal isOpen saleId={300} user={salesAdminUser} onClose={vi.fn()} onSuccess={vi.fn()} />);

    await waitFor(() => expect(api.listUsers).toHaveBeenCalledTimes(1));
    await openTicketsTab(user);
    await user.click(await screen.findByTitle('Editar ticket'));

    const select = await screen.findByTestId('ticket-assignment-select') as HTMLSelectElement;
    const optionValues = Array.from(select.options).map((o) => o.value);
    // The only candidates are the ones `assignment-context` itself returned (Alice/Bruno, ids 7
    // and 9) — never `Seller One` (id 1), the `listUsers()` fixture.
    expect(optionValues).not.toContain('1');
    expect(api.getTicketAssignmentContext).toHaveBeenCalled();
  });
});
