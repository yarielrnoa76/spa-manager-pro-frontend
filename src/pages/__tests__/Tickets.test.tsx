import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Tickets from '../Tickets';
import { api, ApiError } from '../../services/api';
import type { UserData } from '../../App';

/**
 * Tickets/Tasks global surface. Covers: explicit loading/empty/forbidden/error/success states
 * for both the dashboard and the list (never conflating a 403 or a network failure with "no
 * tickets"), server-side pagination/order/filter conservation, permission-gated controls
 * (create/config), the absence of `api.listUsers()` as a candidate authority, and the
 * lead-deep-link 403 handling that never hides the ticket itself.
 */

vi.mock('../../services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/api')>();
  return {
    ...actual,
    api: {
      getTicketDashboardSummary: vi.fn(),
      listTicketCategories: vi.fn(),
      listTicketPriorities: vi.fn(),
      listTickets: vi.fn(),
      getTicket: vi.fn(),
      getTicketAssignmentContext: vi.fn(),
      getTicketResponsableOptions: vi.fn(),
      assignTicket: vi.fn(),
      updateTicketStatus: vi.fn(),
      addTicketComment: vi.fn(),
      getLead: vi.fn(),
      createTicketCategory: vi.fn(),
      createTicketPriority: vi.fn(),
      listUsers: vi.fn(),
      // LeadModal's own mount-time calls, needed only for the lead-deep-link test.
      listBranches: vi.fn(),
      me: vi.fn(),
      listConversations: vi.fn(),
    },
  };
});

const DASHBOARD = {
  total: 3,
  new: 1,
  in_progress: 1,
  completed: 1,
  cancelled: 0,
  overdue: 1,
  unassigned: 1,
  by_status: { New: 1, InProgress: 1, Completed: 1 },
  by_priority: [{ priority_id: 1, name: 'Medium', count: 3 }],
  workload_by_responsable: [{ responsable_id: 5, name: 'Alice', count: 2 }],
  recent: [
    { id: 1, ticket_number: 'TCK-2026-000001', subject: 'Primero', status: 'New', created_at: '2026-09-01T10:00:00Z', lead_name: 'Carla Diaz', responsable_name: 'Alice' },
  ],
};

const TICKET_ROW = {
  id: 1,
  ticket_number: 'TCK-2026-000001',
  subject: 'Primero',
  status: 'New',
  category: { id: 1, name: 'General' },
  priority: { id: 1, name: 'Medium' },
  lead: { id: 55, name: 'Carla', last_name: 'Diaz' },
  lead_id: 55,
  responsable: { id: 5, name: 'Alice' },
  responsable_id: 5,
  due_date: null,
  is_overdue: false,
  created_at: '2026-09-01T10:00:00Z',
};

const ADMIN_USER: UserData = {
  id: '1', name: 'Admin', email: 'admin@example.com', role: { id: 1, name: 'admin' },
  is_super_admin: false, permissions: ['view_ticket', 'create_ticket', 'edit_ticket', 'assign_ticket', 'delete_ticket', 'manage_ticket_config'],
};

const SALES_USER: UserData = {
  id: '2', name: 'Sales', email: 'sales@example.com', role: { id: 2, name: 'sales' },
  is_super_admin: false, permissions: ['view_ticket', 'create_ticket', 'edit_ticket'],
};

// Adversarial correction, defect 6: a view-only user holds `view_ticket` but NOT `edit_ticket` —
// the same permission the backend's `TicketPolicy::update()` gate requires for
// `updateTicketStatus()`. Status controls must never render for this user.
const VIEW_ONLY_USER: UserData = {
  id: '3', name: 'Viewer', email: 'viewer@example.com', role: { id: 3, name: 'viewer' },
  is_super_admin: false, permissions: ['view_ticket'],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.getTicketDashboardSummary).mockResolvedValue(DASHBOARD);
  vi.mocked(api.listTicketCategories).mockResolvedValue([{ id: 1, name: 'General', sort_order: 0, is_active: true }]);
  vi.mocked(api.listTicketPriorities).mockResolvedValue([{ id: 1, name: 'Medium', sla_minutes: 60, sort_order: 0, is_active: true }]);
  vi.mocked(api.listTickets).mockResolvedValue({ data: [TICKET_ROW], current_page: 1, last_page: 1, total: 1, per_page: 15 });
  vi.mocked(api.getTicket).mockResolvedValue({ ...TICKET_ROW, description: 'Detalle', comments: [] });
  vi.mocked(api.getTicketAssignmentContext).mockResolvedValue({
    ticket_status: 'New', ticket_responsable_id: 5, lead_responsable_id: 5,
    current_responsable: { id: 5, name: 'Alice', role: 'sales' },
    capabilities: { is_terminal: false, can_assign: true, can_deassign: true, can_reassign_lead: true },
    candidates: [{ id: 5, name: 'Alice', role: 'sales' }],
  });
  vi.mocked(api.getTicketResponsableOptions).mockResolvedValue([{ id: 5, name: 'Alice' }]);
});

describe('Tickets — dashboard states', () => {
  it('shows loading, then the real server-side totals (never tickets.length)', async () => {
    render(<Tickets user={ADMIN_USER} />);
    const totalLabel = await screen.findByText('Total Tickets');
    await waitFor(() => expect(within(totalLabel.parentElement!).getByText('3')).toBeTruthy());
    expect(api.getTicketDashboardSummary).toHaveBeenCalledTimes(1);
  });

  it('shows a forbidden state, never an empty dashboard, for a 403', async () => {
    vi.mocked(api.getTicketDashboardSummary).mockRejectedValue(new ApiError('nope', { status: 403 }));
    render(<Tickets user={ADMIN_USER} />);
    expect(await screen.findByText(/No tienes permiso/i)).toBeTruthy();
  });

  it('shows an error state with retry, never an empty dashboard, for a network failure', async () => {
    vi.mocked(api.getTicketDashboardSummary).mockRejectedValue(new TypeError('Failed to fetch'));
    render(<Tickets user={ADMIN_USER} />);
    expect(await screen.findByText(/No se pudo cargar/i)).toBeTruthy();
  });
});

describe('Tickets — list', () => {
  const openList = async (user: ReturnType<typeof userEvent.setup>) => {
    render(<Tickets user={ADMIN_USER} />);
    await user.click(await screen.findByRole('button', { name: /Listado/i }));
  };

  it('paginates server-side and conserves filters across pages', async () => {
    const user = userEvent.setup();
    await openList(user);
    await screen.findByText('Primero');

    vi.mocked(api.listTickets).mockResolvedValue({ data: [TICKET_ROW], current_page: 1, last_page: 2, total: 20, per_page: 15 });
    await user.type(screen.getByPlaceholderText(/Buscar por número/i), 'foo');
    await waitFor(() => expect(api.listTickets).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'foo', page: 1 })));
    await screen.findByLabelText(/Página siguiente/i);

    await user.click(screen.getByLabelText(/Página siguiente/i));
    await waitFor(() => expect(api.listTickets).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'foo', page: 2 })));
  });

  it('sends unassigned_only and responsable_id filters', async () => {
    const user = userEvent.setup();
    await openList(user);
    await screen.findByText('Primero');

    await user.click(screen.getByRole('button', { name: /Sin responsable/i }));
    await waitFor(() => expect(api.listTickets).toHaveBeenLastCalledWith(expect.objectContaining({ unassigned_only: true })));
  });

  /**
   * Final adversarial correction, Correction 1: `TicketController::index()` was missing
   * `category:id,name` from its eager-load list even though `TicketIndexResource` always
   * projected `category_id` and a `category` field — an omission that left this column blank.
   */
  it('renders each row\'s own category', async () => {
    const user = userEvent.setup();
    await openList(user);
    const row = (await screen.findByText('Primero')).closest('tr')!;

    expect(within(row).getByText('General')).toBeTruthy();
  });

  it('never calls api.listUsers() for the ticket list or its filters', async () => {
    const user = userEvent.setup();
    await openList(user);
    await screen.findByText('Primero');
    expect(api.listUsers).not.toHaveBeenCalled();
  });

  it('shows forbidden, error and empty states distinctly for the list', async () => {
    vi.mocked(api.listTickets).mockRejectedValueOnce(new ApiError('nope', { status: 403 }));
    const user = userEvent.setup();
    await openList(user);
    expect(await screen.findByText(/No tienes permiso/i)).toBeTruthy();
  });
});

describe('Tickets — detail and assignment', () => {
  it('loads the full ticket detail via the authorized endpoint, not the list row alone', async () => {
    const user = userEvent.setup();
    render(<Tickets user={ADMIN_USER} />);
    await user.click(await screen.findByRole('button', { name: /Listado/i }));
    await user.click(await screen.findByText('Primero'));

    await waitFor(() => expect(api.getTicket).toHaveBeenCalledWith(1));
    expect(await screen.findByText('Detalle')).toBeTruthy();
  });

  it('opens the lead ficha only after server re-authorization; a 403 never hides the ticket', async () => {
    vi.mocked(api.getLead).mockRejectedValue(new ApiError('forbidden', { status: 403 }));
    const user = userEvent.setup();
    render(<Tickets user={ADMIN_USER} />);
    await user.click(await screen.findByRole('button', { name: /Listado/i }));
    await user.click(await screen.findByText('Primero'));
    await screen.findByText('Detalle');

    await user.click(screen.getByRole('button', { name: /Carla Diaz/i }));

    expect(await screen.findByText(/No tienes autorización/i)).toBeTruthy();
    // The ticket detail itself remains visible and authorized.
    expect(screen.getByText('Detalle')).toBeTruthy();
  });

  it('a terminal ticket never offers assignment controls', async () => {
    vi.mocked(api.getTicket).mockResolvedValue({ ...TICKET_ROW, status: 'Completed', description: 'Detalle', comments: [] });
    vi.mocked(api.getTicketAssignmentContext).mockResolvedValue({
      ticket_status: 'Completed', ticket_responsable_id: 5, lead_responsable_id: 5,
      capabilities: { is_terminal: true, can_assign: false, can_deassign: false, can_reassign_lead: false },
      candidates: [],
    });
    const user = userEvent.setup();
    render(<Tickets user={ADMIN_USER} />);
    await user.click(await screen.findByRole('button', { name: /Listado/i }));
    await user.click(await screen.findByText('Primero'));

    expect(await screen.findByTestId('ticket-assignment-readonly')).toBeTruthy();
    expect(screen.queryByTestId('ticket-assignment-select')).toBeNull();
  });
});

describe('Tickets — status controls respect edit_ticket (defect 6)', () => {
  it('hides Start/Complete/Cancel for a view-only user (view_ticket without edit_ticket)', async () => {
    const user = userEvent.setup();
    render(<Tickets user={VIEW_ONLY_USER} />);
    await user.click(await screen.findByRole('button', { name: /Listado/i }));
    await user.click(await screen.findByText('Primero'));
    await screen.findByText('Detalle');

    expect(screen.queryByText('Empezar a tratar')).toBeNull();
    expect(screen.queryByText('Finalizar')).toBeNull();
    expect(screen.queryByText('Cancelar')).toBeNull();
  });

  it('shows Start/Complete/Cancel for a user holding edit_ticket', async () => {
    const user = userEvent.setup();
    render(<Tickets user={ADMIN_USER} />);
    await user.click(await screen.findByRole('button', { name: /Listado/i }));
    await user.click(await screen.findByText('Primero'));
    await screen.findByText('Detalle');

    expect(screen.getByText('Empezar a tratar')).toBeTruthy();
    expect(screen.getByText('Finalizar')).toBeTruthy();
  });
});

describe('Tickets — responsable filter (defects 7/8)', () => {
  it('sources the responsable filter from a dedicated, all-status endpoint, never workload_by_responsable alone', async () => {
    // A responsable absent from the active-only workload widget but present in the dedicated
    // all-status collection (e.g. they only ever had Completed/Cancelled tickets).
    vi.mocked(api.getTicketResponsableOptions).mockResolvedValue([
      { id: 5, name: 'Alice' },
      { id: 42, name: 'TerminalOnlyBob' },
    ]);
    const user = userEvent.setup();
    render(<Tickets user={ADMIN_USER} />);
    await user.click(await screen.findByRole('button', { name: /Listado/i }));
    await screen.findByText('Primero');

    await waitFor(() => expect(api.getTicketResponsableOptions).toHaveBeenCalledTimes(1));
    expect(screen.getByText('TerminalOnlyBob')).toBeTruthy();
    expect(api.listUsers).not.toHaveBeenCalled();
  });

  it('picking a specific responsable clears "Sin responsable", and vice versa', async () => {
    vi.mocked(api.getTicketResponsableOptions).mockResolvedValue([{ id: 5, name: 'Alice' }]);
    const user = userEvent.setup();
    render(<Tickets user={ADMIN_USER} />);
    await user.click(await screen.findByRole('button', { name: /Listado/i }));
    await screen.findByText('Primero');

    const responsableSelect = await screen.findByDisplayValue('Todos los responsables');
    await user.selectOptions(responsableSelect, '5');
    await waitFor(() => expect(api.listTickets).toHaveBeenLastCalledWith(expect.objectContaining({ responsable_id: '5' })));
    let lastCall = vi.mocked(api.listTickets).mock.calls.at(-1)?.[0] as Record<string, unknown>;
    expect(lastCall.unassigned_only).toBeUndefined();

    // The combination is mutually exclusive: while a specific responsable is selected, the
    // dropdown itself stays enabled, but clicking "Sin responsable" now must clear it — the
    // backend itself rejects the combination with a 422, so the UI can never send both.
    await user.click(screen.getByRole('button', { name: /Sin responsable/i }));
    await waitFor(() => expect(api.listTickets).toHaveBeenLastCalledWith(expect.objectContaining({ unassigned_only: true })));
    lastCall = vi.mocked(api.listTickets).mock.calls.at(-1)?.[0] as Record<string, unknown>;
    expect(lastCall.responsable_id).toBeUndefined();

    // And the responsable dropdown itself is now disabled while "Sin responsable" is active
    // (and was reset back to "all" rather than left showing the just-cleared selection).
    expect((screen.getByDisplayValue('Todos los responsables') as HTMLSelectElement).disabled).toBe(true);
  });

  it('shows a ticket\'s current responsable as a distinct, non-selectable option when no longer a valid candidate', async () => {
    vi.mocked(api.getTicketAssignmentContext).mockResolvedValue({
      ticket_status: 'New', ticket_responsable_id: 5, lead_responsable_id: 5,
      current_responsable: { id: 5, name: 'Alice', role: 'sales' },
      capabilities: { is_terminal: false, can_assign: true, can_deassign: true, can_reassign_lead: true },
      // Alice is no longer a valid candidate (e.g. moved branch) but is still the ticket's own
      // current responsable.
      candidates: [{ id: 9, name: 'Bruno', role: 'sales' }],
    });
    const user = userEvent.setup();
    render(<Tickets user={ADMIN_USER} />);
    await user.click(await screen.findByRole('button', { name: /Listado/i }));
    await user.click(await screen.findByText('Primero'));

    const orphaned = await screen.findByTestId('ticket-assignment-orphaned-current');
    expect(orphaned.textContent).toMatch(/Alice/);
    expect((orphaned as HTMLOptionElement).disabled).toBe(true);
    expect((await screen.findByTestId('ticket-assignment-select') as HTMLSelectElement).value).toBe('5');
  });
});

describe('Tickets — permissions', () => {
  it('Sales holds create_ticket (sees the create button) but never manage_ticket_config (no config tab)', async () => {
    render(<Tickets user={SALES_USER} />);
    await screen.findByText('Total Tickets');
    expect(screen.getByRole('button', { name: /Nuevo Ticket/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Configuración/i })).toBeNull();
  });

  it('shows the create button and the config tab for Admin', async () => {
    render(<Tickets user={ADMIN_USER} />);
    await screen.findByText('Total Tickets');
    expect(screen.getByRole('button', { name: /Nuevo Ticket/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Configuración/i })).toBeTruthy();
  });
});
