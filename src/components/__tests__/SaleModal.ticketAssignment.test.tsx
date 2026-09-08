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
});
