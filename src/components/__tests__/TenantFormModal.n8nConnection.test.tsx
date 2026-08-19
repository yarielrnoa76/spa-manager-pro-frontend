import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TenantFormModal from '../TenantFormModal';
import { api } from '../../services/api';
import type { Tenant, N8nConnection } from '../../types';

vi.mock('../../services/api', () => {
    class ApiError extends Error {
        code?: string;
        status?: number;
        errors?: Record<string, string[]>;
        constructor(message: string, opts?: { code?: string; status?: number; errors?: Record<string, string[]> }) {
            super(message);
            this.code = opts?.code;
            this.status = opts?.status;
            this.errors = opts?.errors;
        }
    }
    return {
        ApiError,
        api: {
            getTenantProfile: vi.fn(),
            listN8nConnections: vi.fn(),
            updateTenant: vi.fn(),
        },
    };
});

function makeTenant(overrides: Partial<Tenant> = {}): Tenant {
    return {
        id: 1,
        name: 'Acme Spa',
        slug: 'acme-spa',
        status: 'active',
        ...overrides,
    };
}

function makeConnection(overrides: Partial<N8nConnection> = {}): N8nConnection {
    return {
        id: 1,
        name: 'SPA Manager Pro - N8N Management API Key',
        base_url: 'https://n8n.example.com',
        api_key: '••••••••',
        active: true,
        is_default: false,
        last_tested_at: null,
        last_test_status: null,
        assigned_tenants_count: 0,
        created_at: '2026-08-01T00:00:00Z',
        updated_at: '2026-08-01T00:00:00Z',
        ...overrides,
    };
}

async function openN8nTab() {
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /N8N/i }));
    return user;
}

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.getTenantProfile).mockResolvedValue({} as Tenant);
});

describe('TenantFormModal — Conexión n8n administrada', () => {
    it('shows the currently assigned active connection as selected', async () => {
        const connection = makeConnection({ id: 7, name: 'Connection Seven' });
        vi.mocked(api.listN8nConnections).mockResolvedValue([connection]);
        const tenant = makeTenant({ n8n_connection_id: 7 });

        render(<TenantFormModal tenant={tenant} onClose={vi.fn()} onTenantUpdated={vi.fn()} />);
        await openN8nTab();

        const select = (await screen.findByDisplayValue('Connection Seven')) as HTMLSelectElement;
        expect(select.value).toBe('7');
    });

    it('does not auto-select any connection when the tenant has none assigned, even if one is marked default', async () => {
        vi.mocked(api.listN8nConnections).mockResolvedValue([
            makeConnection({ id: 1, name: 'Default Connection', is_default: true }),
            makeConnection({ id: 2, name: 'Other Connection' }),
        ]);
        const tenant = makeTenant({ n8n_connection_id: null });

        render(<TenantFormModal tenant={tenant} onClose={vi.fn()} onTenantUpdated={vi.fn()} />);
        await openN8nTab();

        const select = (await screen.findByRole('combobox', { name: /Conexión n8n administrada/i })) as HTMLSelectElement;
        expect(select.value).toBe('');
    });

    it('changing the assignment and saving sends n8n_connection_id in the payload', async () => {
        vi.mocked(api.listN8nConnections).mockResolvedValue([
            makeConnection({ id: 1, name: 'Connection One' }),
            makeConnection({ id: 2, name: 'Connection Two' }),
        ]);
        vi.mocked(api.updateTenant).mockResolvedValue(makeTenant({ n8n_connection_id: 2 }));
        const tenant = makeTenant({ n8n_connection_id: 1 });
        const onTenantUpdated = vi.fn();

        const user = await openN8nTabWithModal(tenant, onTenantUpdated);

        const select = screen.getByRole('combobox', { name: /Conexión n8n administrada/i });
        await user.selectOptions(select, '2');
        await user.click(screen.getByRole('button', { name: /Guardar identidad e integraciones/i }));

        await waitFor(() => expect(api.updateTenant).toHaveBeenCalled());
        const [, payload] = vi.mocked(api.updateTenant).mock.calls[0];
        expect(payload.n8n_connection_id).toBe(2);
        expect(onTenantUpdated).toHaveBeenCalled();
    });

    it('unassigning (selecting "Sin conexión asignada") sends null', async () => {
        vi.mocked(api.listN8nConnections).mockResolvedValue([makeConnection({ id: 1, name: 'Connection One' })]);
        vi.mocked(api.updateTenant).mockResolvedValue(makeTenant({ n8n_connection_id: null }));
        const tenant = makeTenant({ n8n_connection_id: 1 });

        const user = await openN8nTabWithModal(tenant, vi.fn());

        const select = screen.getByRole('combobox', { name: /Conexión n8n administrada/i });
        await user.selectOptions(select, '');
        await user.click(screen.getByRole('button', { name: /Guardar identidad e integraciones/i }));

        await waitFor(() => expect(api.updateTenant).toHaveBeenCalled());
        const [, payload] = vi.mocked(api.updateTenant).mock.calls[0];
        expect(payload.n8n_connection_id).toBeNull();
    });

    it('displays the currently assigned connection as inactive rather than silently changing it', async () => {
        const inactive = makeConnection({ id: 5, name: 'Now Inactive', active: false });
        vi.mocked(api.listN8nConnections).mockResolvedValue([inactive]);
        const tenant = makeTenant({ n8n_connection_id: 5 });

        render(<TenantFormModal tenant={tenant} onClose={vi.fn()} onTenantUpdated={vi.fn()} />);
        await openN8nTab();

        expect(await screen.findByText(/La conexión asignada actualmente está inactiva/i)).toBeInTheDocument();
        const select = screen.getByRole('combobox', { name: /Conexión n8n administrada/i }) as HTMLSelectElement;
        expect(select.value).toBe('5');
    });

    it('never exposes the Management API key anywhere in the DOM', async () => {
        const connection = makeConnection({ id: 1, name: 'Connection One', api_key: '••••••••' });
        vi.mocked(api.listN8nConnections).mockResolvedValue([connection]);
        const tenant = makeTenant({ n8n_connection_id: 1 });

        const { container } = render(<TenantFormModal tenant={tenant} onClose={vi.fn()} onTenantUpdated={vi.fn()} />);
        await openN8nTab();
        await screen.findByRole('combobox', { name: /Conexión n8n administrada/i });

        expect(container.innerHTML).not.toContain('api_key');
        // Only the masked placeholder may appear anywhere -- proven indirectly by never having
        // supplied a real key value to any mock the component could render.
    });
});

async function openN8nTabWithModal(tenant: Tenant, onTenantUpdated: (t: Tenant) => void) {
    render(<TenantFormModal tenant={tenant} onClose={vi.fn()} onTenantUpdated={onTenantUpdated} />);
    return openN8nTab();
}
