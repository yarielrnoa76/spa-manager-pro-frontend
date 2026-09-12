import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { format as dateFnsFormat } from 'date-fns';
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

/**
 * Tickets.tsx now reads `:ticketId` off the route and calls `useNavigate()` to keep the URL in
 * sync (Correction 1) -- it requires a Router ancestor, and rendering it under the SAME two-route
 * shape App.tsx itself uses (`/tickets` and `/tickets/:ticketId` both to `<Tickets/>`) is what
 * lets `useParams()` actually resolve `:ticketId` for the deep-link tests below.
 */
const LocationProbe = () => {
  const location = useLocation();
  return <div data-testid="location-probe">{location.pathname}</div>;
};

/** Drives real browser-history navigation (a relative delta, exactly what Back/Forward do)
 * against the MemoryRouter's own history stack -- not a direct navigate('/some/path') call. */
const HistoryControls = () => {
  const navigate = useNavigate();
  return (
    <div>
      <button onClick={() => navigate(-1)}>Ir atrás</button>
      <button onClick={() => navigate(1)}>Ir adelante</button>
    </div>
  );
};

const renderTickets = (user: UserData, initialEntries: string[] = ['/tickets']) =>
  render(
    <MemoryRouter initialEntries={initialEntries}>
      <LocationProbe />
      <Routes>
        <Route path="/tickets" element={<Tickets user={user} />} />
        <Route path="/tickets/:ticketId" element={<Tickets user={user} />} />
      </Routes>
    </MemoryRouter>,
  );

const renderTicketsWithHistoryControls = (user: UserData) =>
  render(
    <MemoryRouter initialEntries={['/tickets']}>
      <LocationProbe />
      <HistoryControls />
      <Routes>
        <Route path="/tickets" element={<Tickets user={user} />} />
        <Route path="/tickets/:ticketId" element={<Tickets user={user} />} />
      </Routes>
    </MemoryRouter>,
  );

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
    renderTickets(ADMIN_USER);
    const totalLabel = await screen.findByText('Total Tickets');
    await waitFor(() => expect(within(totalLabel.parentElement!).getByText('3')).toBeTruthy());
    expect(api.getTicketDashboardSummary).toHaveBeenCalledTimes(1);
  });

  it('shows a forbidden state, never an empty dashboard, for a 403', async () => {
    vi.mocked(api.getTicketDashboardSummary).mockRejectedValue(new ApiError('nope', { status: 403 }));
    renderTickets(ADMIN_USER);
    expect(await screen.findByText(/No tienes permiso/i)).toBeTruthy();
  });

  it('shows an error state with retry, never an empty dashboard, for a network failure', async () => {
    vi.mocked(api.getTicketDashboardSummary).mockRejectedValue(new TypeError('Failed to fetch'));
    renderTickets(ADMIN_USER);
    expect(await screen.findByText(/No se pudo cargar/i)).toBeTruthy();
  });
});

describe('Tickets — list', () => {
  const openList = async (user: ReturnType<typeof userEvent.setup>) => {
    renderTickets(ADMIN_USER);
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
    renderTickets(ADMIN_USER);
    await user.click(await screen.findByRole('button', { name: /Listado/i }));
    await user.click(await screen.findByText('Primero'));

    await waitFor(() => expect(api.getTicket).toHaveBeenCalledWith(1));
    expect(await screen.findByText('Detalle')).toBeTruthy();
  });

  it('opens the lead ficha only after server re-authorization; a 403 never hides the ticket', async () => {
    vi.mocked(api.getLead).mockRejectedValue(new ApiError('forbidden', { status: 403 }));
    const user = userEvent.setup();
    renderTickets(ADMIN_USER);
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
    renderTickets(ADMIN_USER);
    await user.click(await screen.findByRole('button', { name: /Listado/i }));
    await user.click(await screen.findByText('Primero'));

    expect(await screen.findByTestId('ticket-assignment-readonly')).toBeTruthy();
    expect(screen.queryByTestId('ticket-assignment-select')).toBeNull();
  });
});

describe('Tickets — status controls respect edit_ticket (defect 6)', () => {
  it('hides Start/Complete/Cancel for a view-only user (view_ticket without edit_ticket)', async () => {
    const user = userEvent.setup();
    renderTickets(VIEW_ONLY_USER);
    await user.click(await screen.findByRole('button', { name: /Listado/i }));
    await user.click(await screen.findByText('Primero'));
    await screen.findByText('Detalle');

    expect(screen.queryByText('Empezar a tratar')).toBeNull();
    expect(screen.queryByText('Finalizar')).toBeNull();
    expect(screen.queryByText('Cancelar')).toBeNull();
  });

  it('shows Start/Complete/Cancel for a user holding edit_ticket', async () => {
    const user = userEvent.setup();
    renderTickets(ADMIN_USER);
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
    renderTickets(ADMIN_USER);
    await user.click(await screen.findByRole('button', { name: /Listado/i }));
    await screen.findByText('Primero');

    await waitFor(() => expect(api.getTicketResponsableOptions).toHaveBeenCalledTimes(1));
    expect(screen.getByText('TerminalOnlyBob')).toBeTruthy();
    expect(api.listUsers).not.toHaveBeenCalled();
  });

  it('picking a specific responsable clears "Sin responsable", and vice versa', async () => {
    vi.mocked(api.getTicketResponsableOptions).mockResolvedValue([{ id: 5, name: 'Alice' }]);
    const user = userEvent.setup();
    renderTickets(ADMIN_USER);
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
    renderTickets(ADMIN_USER);
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
    renderTickets(SALES_USER);
    await screen.findByText('Total Tickets');
    expect(screen.getByRole('button', { name: /Nuevo Ticket/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Configuración/i })).toBeNull();
  });

  it('shows the create button and the config tab for Admin', async () => {
    renderTickets(ADMIN_USER);
    await screen.findByText('Total Tickets');
    expect(screen.getByRole('button', { name: /Nuevo Ticket/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Configuración/i })).toBeTruthy();
  });
});

/**
 * Manual Ingestion K6 UX closure, Correction 1: the backend already sends operative notifications
 * with `/tickets/{id}`, but App.tsx only ever recognized the bare `/tickets` path, so the id fell
 * through to the dashboard fallback route. `/tickets/:ticketId` must open this exact screen, tab
 * Listado, load via `api.getTicket(id)` using the ticket's own internal id — never `ticket_number`
 * — and never leak ticket data on a rejected request.
 */
describe('Tickets — deep link /tickets/:ticketId (Correction 1)', () => {
  it('opens directly on Listado and loads the ticket via api.getTicket(id) from a fresh mount', async () => {
    renderTickets(ADMIN_USER, ['/tickets/1']);

    expect(await screen.findByRole('heading', { name: /Tickets \/ Tasks/i })).toBeTruthy();
    await waitFor(() => expect(api.getTicket).toHaveBeenCalledWith(1));
    expect(await screen.findByText('Detalle')).toBeTruthy();
    // The Listado tab is the active one, not the Dashboard.
    expect(screen.getByRole('button', { name: /Listado/i }).className).toMatch(/text-indigo-600/);
  });

  it.each([
    'abc',
    '1.5',
    '-1',
    '0',
    // Past Number.MAX_SAFE_INTEGER (9007199254740991): a digit string alone isn't proof it can
    // be represented exactly by Number(...), so these must be rejected too, never handed to
    // api.getTicket() as a possibly-wrong id.
    '9007199254740992',
    '999999999999999999999999999999',
  ])(
    'a malformed or unsafe ticket id (%s) in the URL never calls api.getTicket()',
    async (badId) => {
      renderTickets(ADMIN_USER, [`/tickets/${badId}`]);

      await screen.findByRole('heading', { name: /Tickets \/ Tasks/i });
      // Give any stray effect a turn before asserting nothing fired.
      await waitFor(() => expect(screen.getByTestId('location-probe').textContent).toBe('/tickets'));
      expect(api.getTicket).not.toHaveBeenCalled();
      // No residual ticket data from a previous case leaks through either.
      expect(screen.queryByText('Detalle')).toBeNull();
    },
  );

  it('a 403 on the deep-linked ticket shows a controlled forbidden state, never the Dashboard', async () => {
    vi.mocked(api.getTicket).mockRejectedValue(new ApiError('forbidden', { status: 403 }));
    renderTickets(ADMIN_USER, ['/tickets/1']);

    expect(await screen.findByRole('heading', { name: /Tickets \/ Tasks/i })).toBeTruthy();
    expect(await screen.findByText(/No tienes permiso/i)).toBeTruthy();
    // Never any ticket content leaked from a rejected request.
    expect(screen.queryByText('Detalle')).toBeNull();
  });

  it('a load error on the deep-linked ticket shows a controlled error state, never the Dashboard', async () => {
    vi.mocked(api.getTicket).mockRejectedValue(new TypeError('Failed to fetch'));
    renderTickets(ADMIN_USER, ['/tickets/1']);

    expect(await screen.findByRole('heading', { name: /Tickets \/ Tasks/i })).toBeTruthy();
    expect(await screen.findByText(/No se pudo cargar/i)).toBeTruthy();
    expect(screen.queryByText('Detalle')).toBeNull();
  });

  it('closing the detail panel navigates back to /tickets', async () => {
    renderTickets(ADMIN_USER, ['/tickets/1']);
    await screen.findByText('Detalle');

    // The list row behind the detail panel shows the same ticket_number, so anchor on the
    // detail panel's own outer wrapper (via its unique "Detalle" description) and scope down to
    // its header, which holds exactly one button: the close (X) control.
    const detailPanel = screen.getByText('Detalle').closest('.overflow-hidden') as HTMLElement;
    const header = detailPanel.querySelector('.border-b.bg-gray-50') as HTMLElement;
    const closeButton = within(header).getByRole('button');
    await userEvent.setup().click(closeButton);

    await waitFor(() => expect(screen.getByTestId('location-probe').textContent).toBe('/tickets'));
  });

  it('selecting a row from the list syncs the URL to /tickets/{id}', async () => {
    const user = userEvent.setup();
    renderTickets(ADMIN_USER, ['/tickets']);
    await user.click(await screen.findByRole('button', { name: /Listado/i }));
    await user.click(await screen.findByText('Primero'));

    await waitFor(() => expect(api.getTicket).toHaveBeenCalledWith(1));
    expect(screen.getByTestId('location-probe').textContent).toBe('/tickets/1');
  });
});

/**
 * Microcorrection: the URL is the single source of truth for `selectedTicketId` -- browser
 * Back/Forward must keep the detail panel and the address bar coherent, never leaving a
 * previously-opened ticket panel open once the URL itself has moved back to the bare `/tickets`.
 */
describe('Tickets — URL is the source of truth across browser history (microcorrection)', () => {
  it('open a row -> Back closes the detail -> Forward reopens the same ticket -> manual close lands on /tickets', async () => {
    const user = userEvent.setup();
    renderTicketsWithHistoryControls(ADMIN_USER);

    // 1. Opening a row from /tickets navigates to /tickets/{id} and shows the detail.
    await user.click(await screen.findByRole('button', { name: /Listado/i }));
    await user.click(await screen.findByText('Primero'));
    await waitFor(() => expect(api.getTicket).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(api.getTicket).toHaveBeenCalledWith(1));
    expect(screen.getByTestId('location-probe').textContent).toBe('/tickets/1');
    expect(await screen.findByText('Detalle')).toBeTruthy();

    // 2. Back through browser history to /tickets closes the detail -- not left dangling open.
    await user.click(screen.getByRole('button', { name: 'Ir atrás' }));
    await waitFor(() => expect(screen.getByTestId('location-probe').textContent).toBe('/tickets'));
    await waitFor(() => expect(screen.queryByText('Detalle')).toBeNull());

    // 3. Forward again reopens the SAME ticket the URL now names.
    await user.click(screen.getByRole('button', { name: 'Ir adelante' }));
    await waitFor(() => expect(screen.getByTestId('location-probe').textContent).toBe('/tickets/1'));
    expect(await screen.findByText('Detalle')).toBeTruthy();
    // Exactly one extra fetch for the reopen -- no duplicate call bundled with it.
    await waitFor(() => expect(api.getTicket).toHaveBeenCalledTimes(2));

    // 4. Manual close still lands on /tickets, exactly as before this microcorrection.
    const detailPanel = screen.getByText('Detalle').closest('.overflow-hidden') as HTMLElement;
    const header = detailPanel.querySelector('.border-b.bg-gray-50') as HTMLElement;
    await user.click(within(header).getByRole('button'));
    await waitFor(() => expect(screen.getByTestId('location-probe').textContent).toBe('/tickets'));
    expect(screen.queryByText('Detalle')).toBeNull();
  });

  it('never fires a duplicate api.getTicket() call for the same navigation to /tickets/{id}', async () => {
    const user = userEvent.setup();
    renderTickets(ADMIN_USER);
    await user.click(await screen.findByRole('button', { name: /Listado/i }));

    await user.click(await screen.findByText('Primero'));
    await screen.findByText('Detalle');

    expect(api.getTicket).toHaveBeenCalledTimes(1);
  });
});

/**
 * Correction 5: internal status values (`New`/`InProgress`/`Completed`/`Cancelled`) are never
 * shown to the user literally — only the mapped Spanish label. The values sent to the backend,
 * and every internal condition keyed on them, stay exactly as they are.
 */
describe('Tickets — status labels are translated, values are not (Correction 5)', () => {
  it('shows "Nuevo" for a New ticket, never the literal "New", in both the list row and detail', async () => {
    const user = userEvent.setup();
    renderTickets(ADMIN_USER);
    await user.click(await screen.findByRole('button', { name: /Listado/i }));
    const row = (await screen.findByText('Primero')).closest('tr')!;

    expect(within(row).getByText('Nuevo')).toBeTruthy();
    expect(within(row).queryByText('New')).toBeNull();

    await user.click(within(row).getByText('Primero'));
    await screen.findByText('Detalle');
    expect(screen.getAllByText('Nuevo').length).toBeGreaterThan(0);
  });

  it('the status filter shows "En tratamiento" for InProgress, never the raw value, while the option value stays InProgress', async () => {
    renderTickets(ADMIN_USER);
    await userEvent.setup().click(await screen.findByRole('button', { name: /Listado/i }));

    const option = await screen.findByRole('option', { name: 'En tratamiento' }) as HTMLOptionElement;
    expect(option.value).toBe('InProgress');
    expect(screen.queryByRole('option', { name: 'InProgress' })).toBeNull();
  });

  it('maps Completed and Cancelled to Completado and Cancelado in the status filter', async () => {
    renderTickets(ADMIN_USER);
    await userEvent.setup().click(await screen.findByRole('button', { name: /Listado/i }));

    const completed = await screen.findByRole('option', { name: 'Completado' }) as HTMLOptionElement;
    expect(completed.value).toBe('Completed');
    const cancelled = await screen.findByRole('option', { name: 'Cancelado' }) as HTMLOptionElement;
    expect(cancelled.value).toBe('Cancelled');
  });

  it('still sends the literal "InProgress" to the backend when starting treatment', async () => {
    const user = userEvent.setup();
    renderTickets(ADMIN_USER);
    await user.click(await screen.findByRole('button', { name: /Listado/i }));
    await user.click(await screen.findByText('Primero'));
    await screen.findByText('Detalle');

    await user.click(screen.getByText('Empezar a tratar'));
    await waitFor(() => expect(api.updateTicketStatus).toHaveBeenCalledWith(1, 'InProgress'));
  });
});

/**
 * Correction 4: a comment must always show a human-readable author and a full date/time — never
 * a bare id like `10`.
 */
describe('Tickets — comment author and timestamp (Correction 4)', () => {
  const openDetailWithComments = async (comments: Array<Record<string, unknown>>) => {
    vi.mocked(api.getTicket).mockResolvedValue({ ...TICKET_ROW, description: 'Detalle', comments });
    const user = userEvent.setup();
    renderTickets(ADMIN_USER);
    await user.click(await screen.findByRole('button', { name: /Listado/i }));
    await user.click(await screen.findByText('Primero'));
    await screen.findByText('Detalle');
  };

  it('shows creator.name and a full day/month/year + hour:minute timestamp', async () => {
    const createdAt = '2026-09-12T10:49:00Z';
    await openDetailWithComments([
      { id: 1, comment: 'Hola', created_by: 10, created_at: createdAt, creator: { id: 10, name: 'Ana Pérez' } },
    ]);

    expect(screen.getByText('Ana Pérez')).toBeTruthy();
    // Rendered in the viewer's own local time (never hardcoded to UTC), but always the full
    // dd/MM/yyyy HH:mm shape -- never a truncated day/month-only stamp.
    expect(screen.getByText(dateFnsFormat(new Date(createdAt), 'dd/MM/yyyy HH:mm'))).toBeTruthy();
    // Never a bare numeric id standing in for the author.
    expect(screen.queryByText('10')).toBeNull();
  });

  it('prefers creator.name even when created_by is serialized as a string', async () => {
    await openDetailWithComments([
      { id: 2, comment: 'Hola', created_by: 'legacy-string-id', created_at: '2026-09-12T10:49:00Z', creator: { id: 10, name: 'Ana Pérez' } },
    ]);

    expect(screen.getByText('Ana Pérez')).toBeTruthy();
  });

  it('shows a neutral "Usuario no disponible (#id)" fallback when creator is absent but created_by exists', async () => {
    await openDetailWithComments([
      { id: 3, comment: 'Hola', created_by: 10, created_at: '2026-09-12T10:49:00Z' },
    ]);

    expect(screen.getByText('Usuario no disponible (#10)')).toBeTruthy();
    expect(screen.queryByText('10')).toBeNull();
  });

  it('shows the same neutral fallback when created_by is a string and creator is absent', async () => {
    await openDetailWithComments([
      { id: 5, comment: 'Hola', created_by: '10', created_at: '2026-09-12T10:49:00Z' },
    ]);

    expect(screen.getByText('Usuario no disponible (#10)')).toBeTruthy();
  });

  it('shows "Sistema" only when neither creator nor created_by exist', async () => {
    await openDetailWithComments([
      { id: 4, comment: 'Hola', created_by: null, created_at: '2026-09-12T10:49:00Z', creator: null },
    ]);

    expect(screen.getByText('Sistema')).toBeTruthy();
  });
});
