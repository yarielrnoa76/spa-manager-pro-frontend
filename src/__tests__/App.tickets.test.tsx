import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';
import { api } from '../services/api';
import type { UserData } from '../App';

/**
 * Tickets/Tasks global surface (§5): the sidebar option and the `/tickets` route must both be
 * gated on `view_ticket` (or SuperAdmin) — and typing `/tickets` directly must not bypass that,
 * i.e. navigation defense lives in the route itself, not only in whether the menu item is
 * rendered.
 *
 * Every `api` method other than the few this test configures explicitly falls back to an
 * auto-resolving stub (via the Proxy below) — this test is about routing/menu visibility, not
 * about exhaustively mocking every page's own data calls.
 */

vi.mock('../services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/api')>();
  const known: Record<string, ReturnType<typeof vi.fn>> = {};
  // Shaped to satisfy BOTH a bare-array consumer (`res.map(...)`) and a paginated-response
  // consumer (`res.data.map(...)`) — this test is about routing/menu visibility, not about
  // exhaustively mocking every page's own data contract.
  const emptyEither = () => Object.assign([], { data: [], total: 0, last_page: 1, current_page: 1, per_page: 15 });
  const stub = new Proxy(known, {
    get(target, prop: string) {
      if (!(prop in target)) {
        target[prop] = vi.fn().mockImplementation(() => Promise.resolve(emptyEither()));
      }
      return target[prop];
    },
  });
  return { ...actual, api: stub };
});

const baseUser = (permissions: string[]): UserData => ({
  id: '1',
  name: 'Test User',
  email: 'user@example.com',
  role: { id: 2, name: 'sales' },
  is_super_admin: false,
  permissions,
});

beforeEach(() => {
  vi.mocked(api.getToken).mockReturnValue('fake-token');
  vi.mocked(api.me).mockResolvedValue(baseUser(['view_ticket']));
  // Tickets.tsx's own dashboard-summary shape — the generic empty-either stub above has no
  // `by_priority`/`workload_by_responsable`/`recent` keys, which this page's render assumes.
  vi.mocked(api.getTicketDashboardSummary).mockResolvedValue({
    total: 0, new: 0, in_progress: 0, completed: 0, cancelled: 0, overdue: 0, unassigned: 0,
    by_status: {}, by_priority: [], workload_by_responsable: [], recent: [],
  });
});

describe('App — Tickets / Tasks menu and route guard', () => {
  it('shows the exact "Tickets / Tasks" sidebar option when the user holds view_ticket', async () => {
    vi.mocked(api.me).mockResolvedValue(baseUser(['view_ticket']));

    render(
      <MemoryRouter initialEntries={['/tickets']}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: /Tickets \/ Tasks/i })).toBeTruthy();
  });

  it('hides the sidebar option entirely when the user lacks view_ticket', async () => {
    vi.mocked(api.me).mockResolvedValue(baseUser([]));

    render(
      <MemoryRouter initialEntries={['/sales']}>
        <App />
      </MemoryRouter>,
    );

    await waitFor(() => expect(api.me).toHaveBeenCalled());
    expect(screen.queryByText('Tickets / Tasks')).toBeNull();
  });

  it('redirects away from /tickets typed directly when the user lacks view_ticket', async () => {
    vi.mocked(api.me).mockResolvedValue(baseUser([]));

    render(
      <MemoryRouter initialEntries={['/tickets']}>
        <App />
      </MemoryRouter>,
    );

    await waitFor(() => expect(api.me).toHaveBeenCalled());
    // The Tickets/Tasks surface's own heading never renders for an unauthorized actor, even
    // though they navigated to /tickets directly.
    await waitFor(() => expect(screen.queryByText(/Tickets \/ Tasks/i)).toBeNull());
  });

  it('renders the Tickets/Tasks surface at /tickets for an authorized user, never a redirect', async () => {
    vi.mocked(api.me).mockResolvedValue(baseUser(['view_ticket']));

    render(
      <MemoryRouter initialEntries={['/tickets']}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: /Tickets \/ Tasks/i })).toBeTruthy();
  });

  /**
   * Manual Ingestion K6 UX closure, Correction 1: the deep-link route `/tickets/:ticketId` must
   * carry the exact same `view_ticket` gate as the bare `/tickets` route — typing a ticket id
   * directly in the URL must never bypass it.
   */
  it('renders the Tickets/Tasks surface at /tickets/:ticketId for an authorized user, never a redirect', async () => {
    vi.mocked(api.me).mockResolvedValue(baseUser(['view_ticket']));

    render(
      <MemoryRouter initialEntries={['/tickets/1']}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: /Tickets \/ Tasks/i })).toBeTruthy();
  });

  it('redirects away from /tickets/:ticketId typed directly when the user lacks view_ticket', async () => {
    vi.mocked(api.me).mockResolvedValue(baseUser([]));

    render(
      <MemoryRouter initialEntries={['/tickets/1']}>
        <App />
      </MemoryRouter>,
    );

    await waitFor(() => expect(api.me).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByText(/Tickets \/ Tasks/i)).toBeNull());
  });
});
