import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Refunds from '../Refunds';
import { api } from '../../services/api';
import type { UnifiedRefund } from '../../types/payments';

vi.mock('../../services/api', () => ({
    api: {
        get: vi.fn(),
        listBranches: vi.fn(),
        listSales: vi.fn(),
        post: vi.fn(),
        delete: vi.fn(),
    },
}));

const ADMIN_USER = { id: 1, is_super_admin: true };

const MANUAL_ROW: UnifiedRefund = {
    origin: 'manual',
    source_id: 501,
    sale_id: 900,
    sale_group_id: null,
    branch_id: 1,
    client_name: 'Cliente Manual',
    refund_amount: 15,
    refunded_total: null,
    original_payment_amount: null,
    refund_type: null,
    normalized_status: 'completed',
    original_status: 'approved',
    date: '2026-08-01T10:00:00Z',
    requested_by: null,
    reason: 'Producto defectuoso',
    payment_transaction_id: null,
    payment_request_id: null,
    stripe_refund_id: null,
};

const STRIPE_ROW: UnifiedRefund = {
    origin: 'stripe',
    source_id: 501, // deliberately colliding with MANUAL_ROW.source_id — proves origin, not id, discriminates
    sale_id: 901,
    sale_group_id: null,
    branch_id: 1,
    client_name: 'Cliente Stripe',
    refund_amount: 40,
    refunded_total: 40,
    original_payment_amount: 100,
    refund_type: 'partial',
    normalized_status: 'completed',
    original_status: 'succeeded',
    date: '2026-08-02T10:00:00Z',
    requested_by: { id: 1, name: 'Admin' },
    reason: 'Cliente insatisfecho',
    payment_transaction_id: 700,
    payment_request_id: 800,
    stripe_refund_id: 're_test_1',
};

describe('Refunds — vista unificada (manual + Stripe)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(api.listBranches).mockResolvedValue([{ id: 1, name: 'Branch A', code: 'BRA', address: 'x' } as any]);
        vi.mocked(api.get).mockImplementation((path: string) => {
            if (path === '/refunds/unified') {
                return Promise.resolve({ data: [MANUAL_ROW, STRIPE_ROW] });
            }
            return Promise.resolve([]);
        });
    });

    it('muestra filas de ambos orígenes con su badge correspondiente', async () => {
        render(<Refunds user={ADMIN_USER} />);

        await waitFor(() => expect(screen.getByText('Cliente Manual')).toBeInTheDocument());
        expect(screen.getByText('Cliente Stripe')).toBeInTheDocument();
        expect(screen.getByText('Manual')).toBeInTheDocument();
        expect(screen.getByText('Stripe')).toBeInTheDocument();
    });

    it('nunca ofrece eliminar una fila origin=stripe, aunque su source_id colisione con una manual', async () => {
        render(<Refunds user={ADMIN_USER} />);

        await waitFor(() => expect(screen.getByText('Cliente Manual')).toBeInTheDocument());

        const rows = screen.getAllByRole('row').slice(1); // skip header row
        const manualRow = rows.find((r) => within(r).queryByText('Cliente Manual'));
        const stripeRow = rows.find((r) => within(r).queryByText('Cliente Stripe'));

        expect(manualRow).toBeTruthy();
        expect(stripeRow).toBeTruthy();
        expect(within(manualRow!).queryByRole('button')).toBeInTheDocument();
        expect(within(stripeRow!).queryByRole('button')).not.toBeInTheDocument();
    });

    it('muestra el tipo de reembolso (parcial/total) solo cuando aplica', async () => {
        render(<Refunds user={ADMIN_USER} />);

        await waitFor(() => expect(screen.getByText('Cliente Stripe')).toBeInTheDocument());
        expect(screen.getByText('Parcial')).toBeInTheDocument();
    });

    it('el selector de ventas del modal manual excluye ventas cobradas con Stripe', async () => {
        vi.mocked(api.listSales).mockResolvedValue([
            { id: 1, date: '2026-08-01', client_name: 'Venta Manual', service_rendered: 'Servicio', amount: 50, quantity: 1, branch_id: 1, payment_provider: 'manual' },
            { id: 2, date: '2026-08-02', client_name: 'Venta Stripe', service_rendered: 'Servicio', amount: 80, quantity: 1, branch_id: 1, payment_provider: 'stripe' },
        ] as any);

        render(<Refunds user={ADMIN_USER} />);

        await waitFor(() => expect(screen.getByText('Cliente Manual')).toBeInTheDocument());

        const user = userEvent.setup();
        await user.click(screen.getByText('Procesar Devolución'));

        await waitFor(() => expect(screen.getByText(/Venta Manual/)).toBeInTheDocument());
        expect(screen.queryByText(/Venta Stripe/)).not.toBeInTheDocument();
        expect(screen.getByText(/Stripe no aparecen aquí/)).toBeInTheDocument();
    });
});
