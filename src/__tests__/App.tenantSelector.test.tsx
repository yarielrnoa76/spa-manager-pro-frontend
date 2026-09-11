import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';
import { api, ApiError, TENANT_CONTEXT_STALE_EVENT } from '../services/api';
import type { UserData } from '../App';

/**
 * Gate 1B/1A (Granular Resource Visibility / Role Lifecycle finalization) — the tenant
 * selector contract: visible for every authenticated user as a context indicator, disabled
 * and fixed to the account's own tenant for a regular user, interactive only for a
 * SuperAdmin, and never a source of authority on its own — switching always goes through
 * api.switchTenant() (POST /api/tenant/switch) and the UI only reflects a new tenant after
 * the server confirms it.
 */

vi.mock('../services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/api')>();
  const known: Record<string, ReturnType<typeof vi.fn>> = {};
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

const regularUser = (overrides: Partial<UserData> = {}): UserData => ({
  id: '1',
  name: 'Regular User',
  email: 'user@example.com',
  role: { id: 2, name: 'admin' },
  is_super_admin: false,
  tenant_id: 5,
  tenant: { id: 5, name: 'Acme Spa' },
  permissions: ['view_dashboard'],
  ...overrides,
});

const superAdminUser = (activeTenantId: number | null, overrides: Partial<UserData> = {}): UserData => ({
  id: '2',
  name: 'Platform SuperAdmin',
  email: 'sa@example.com',
  role: { id: 1, name: 'superadmin' },
  is_super_admin: true,
  tenant_id: null,
  active_tenant_id: activeTenantId,
  permissions: [],
  ...overrides,
});

beforeEach(() => {
  vi.mocked(api.getToken).mockReturnValue('fake-token');
  // window.location.reload() is unimplemented in jsdom by default.
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, reload: vi.fn() },
  });
});

describe('Tenant selector — regular user', () => {
  it('is visible and shows the account\'s own tenant', async () => {
    vi.mocked(api.me).mockResolvedValue(regularUser());

    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Acme Spa')).toBeTruthy();
  });

  it('renders disabled, with no dropdown to trigger a switch', async () => {
    vi.mocked(api.me).mockResolvedValue(regularUser());

    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    );

    const indicator = await screen.findByText('Acme Spa');
    const user = userEvent.setup();
    await user.click(indicator);

    // No dropdown opens (only a SuperAdmin's selector is a <button>) and switchTenant is
    // never called.
    expect(api.switchTenant).not.toHaveBeenCalled();
    expect(screen.queryByText('suspended')).toBeNull();
  });
});

describe('Tenant selector — SuperAdmin', () => {
  it('renders the interactive dropdown and lists the tenants from GET /api/tenants', async () => {
    vi.mocked(api.me).mockResolvedValue(superAdminUser(7));
    vi.mocked(api.listTenants).mockResolvedValue([
      { id: 7, name: 'Tenant Seven', slug: 'seven', status: 'active' } as never,
      { id: 8, name: 'Tenant Eight', slug: 'eight', status: 'active' } as never,
    ]);

    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Tenant Seven')).toBeTruthy();

    const user = userEvent.setup();
    await user.click(screen.getByText('Tenant Seven'));

    expect(await screen.findByText('Tenant Eight')).toBeTruthy();
  });

  it('shows an explicit "select a tenant" state with no selection, and blocks tenant-owned modules', async () => {
    vi.mocked(api.me).mockResolvedValue(superAdminUser(null));
    vi.mocked(api.listTenants).mockResolvedValue([]);

    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    );

    // Both the header's selector button and the main-content empty state say "Seleccione un
    // Tenant" — assert both are present rather than picking one arbitrarily.
    expect((await screen.findAllByText(/Seleccione un Tenant/i)).length).toBeGreaterThanOrEqual(2);
  });

  it('a successful switch calls the real endpoint and reloads — never an optimistic local update', async () => {
    vi.mocked(api.me).mockResolvedValue(superAdminUser(null));
    vi.mocked(api.listTenants).mockResolvedValue([
      { id: 9, name: 'Tenant Nine', slug: 'nine', status: 'active' } as never,
    ]);
    vi.mocked(api.switchTenant).mockResolvedValue({
      message: 'ok',
      tenant: { id: 9, name: 'Tenant Nine', slug: 'nine', status: 'active' } as never,
    });

    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    );

    const trigger = await screen.findByRole('button', { name: /Seleccione un tenant/i });
    const user = userEvent.setup();
    await user.click(trigger);
    await user.click(await screen.findByText('Tenant Nine'));

    await waitFor(() => expect(api.switchTenant).toHaveBeenCalledWith(9));
    await waitFor(() => expect(window.location.reload).toHaveBeenCalled());
  });

  it('a failed switch shows the error and never mutates the visible tenant', async () => {
    vi.mocked(api.me).mockResolvedValue(superAdminUser(null));
    vi.mocked(api.listTenants).mockResolvedValue([
      { id: 10, name: 'Suspended Co', slug: 'suspended-co', status: 'suspended' } as never,
    ]);
    vi.mocked(api.switchTenant).mockRejectedValue(
      new ApiError('Tenant is suspended.', { status: 403, data: { code: 'TENANT_SUSPENDED' } }),
    );

    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    );

    const trigger = await screen.findByRole('button', { name: /Seleccione un tenant/i });
    const user = userEvent.setup();
    await user.click(trigger);
    await user.click(await screen.findByText('Suspended Co'));

    expect(await screen.findByText('Tenant is suspended.')).toBeTruthy();
    expect(window.location.reload).not.toHaveBeenCalled();
    // Still shows the unselected state — the failed attempt never got applied locally.
    expect(screen.getByRole('button', { name: /Seleccione un tenant/i })).toBeTruthy();
  });
});

/**
 * Gate: stale tenant context across tabs/sessions (mandate §5, "contexto obsoleto y múltiples
 * pestañas"). Two independent triggers, both must block the UI with an explanation and a
 * reload rather than let the user keep acting on a context that no longer matches reality:
 * (a) this tab's own request got rejected 409 TENANT_CONTEXT_STALE by the backend, and
 * (b) a DIFFERENT tab of the same browser changed the shared localStorage selection.
 */
describe('Tenant selector — stale context across tabs/sessions', () => {
  it('blocks with an explanation when this tab\'s own request is rejected as stale', async () => {
    vi.mocked(api.me).mockResolvedValue(superAdminUser(7));
    vi.mocked(api.listTenants).mockResolvedValue([
      { id: 7, name: 'Tenant Seven', slug: 'seven', status: 'active' } as never,
    ]);

    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Tenant Seven')).toBeTruthy();
    expect(screen.queryByText(/El tenant activo cambió/i)).toBeNull();

    // Simulates api.ts's request() dispatching this after a real 409 TENANT_CONTEXT_STALE —
    // this test does not need to go through a mocked call site to prove App.tsx reacts.
    window.dispatchEvent(new CustomEvent(TENANT_CONTEXT_STALE_EVENT));

    expect(await screen.findByText(/El tenant activo cambió/i)).toBeTruthy();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Recargar/i }));
    expect(window.location.reload).toHaveBeenCalled();
  });

  it('blocks when a DIFFERENT tab changes the shared tenant selection (storage event)', async () => {
    vi.mocked(api.me).mockResolvedValue(superAdminUser(7));
    vi.mocked(api.listTenants).mockResolvedValue([
      { id: 7, name: 'Tenant Seven', slug: 'seven', status: 'active' } as never,
    ]);

    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Tenant Seven')).toBeTruthy();

    // A `storage` event is dispatched by the browser only in OTHER tabs of the same origin,
    // never the tab that made the localStorage write itself — StorageEvent's constructor
    // requires jsdom's DOM StorageEvent, constructed directly here to simulate that.
    window.dispatchEvent(
      new StorageEvent('storage', { key: 'current_tenant_id', oldValue: '7', newValue: '9' }),
    );

    expect(await screen.findByText(/El tenant activo cambió/i)).toBeTruthy();
  });

  it('does not block on unrelated localStorage writes', async () => {
    vi.mocked(api.me).mockResolvedValue(superAdminUser(7));
    vi.mocked(api.listTenants).mockResolvedValue([
      { id: 7, name: 'Tenant Seven', slug: 'seven', status: 'active' } as never,
    ]);

    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Tenant Seven')).toBeTruthy();

    window.dispatchEvent(
      new StorageEvent('storage', { key: 'auth_token', oldValue: 'a', newValue: 'b' }),
    );

    expect(screen.queryByText(/El tenant activo cambió/i)).toBeNull();
  });
});
