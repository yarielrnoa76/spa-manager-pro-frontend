import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SaleModal from '../SaleModal';
import { api } from '../../services/api';
import type { PaymentTransaction } from '../../types/payments';

vi.mock('../../services/api', () => ({
    api: {
        getSale: vi.fn(),
        updateSale: vi.fn(),
        getSaleGroup: vi.fn(),
        get: vi.fn(),
        post: vi.fn(),
        listUsers: vi.fn(),
        listPaymentMethods: vi.fn(),
        listBranches: vi.fn(),
        listTicketCategories: vi.fn(),
        listTicketPriorities: vi.fn(),
    },
}));

const ADMIN_USER = { id: 1, is_super_admin: true, permissions: [] };

const SALE = {
    id: 300,
    payment_provider: 'stripe',
    sale_status: 'paid',
    payment_status: 'paid',
    paid_at: '2026-07-29T00:00:00Z',
    service_rendered: 'Servicio Independiente',
    quantity: 1,
    unit_price: 50,
    amount: 50,
    branch_id: 1,
    seller_id: '1',
    client_name: 'Cliente Refund',
    payment_method: 'card',
    created_at: '2026-07-29T00:00:00Z',
};

const PAYMENT_REQUEST = {
    id: 800,
    sale_id: 300,
    sale_group_id: null,
    status: 'paid',
    payment_url: 'https://stripe.test/checkout/cs_refund_test',
    amount: 50,
    currency: 'usd',
};

function buildTransaction(overrides: Partial<PaymentTransaction> = {}): PaymentTransaction {
    return {
        id: 700,
        sale_id: 300,
        sale_group_id: null,
        payment_request_id: 800,
        stripe_payment_intent_id: 'pi_refund_test',
        stripe_charge_id: null,
        amount: 50,
        fee_amount: null,
        net_amount: null,
        currency: 'usd',
        status: 'succeeded',
        failure_reason: null,
        paid_at: '2026-07-29T00:00:00Z',
        refunds: [],
        gross_paid_amount: 50,
        successful_refunded_amount: 0,
        pending_refund_amount: 0,
        net_collected_amount: 50,
        remaining_refundable_amount: 50,
        ...overrides,
    };
}

function inputByLabel(labelText: string): HTMLInputElement {
    const label = screen.getByText(labelText);
    return label.parentElement!.querySelector('input') as HTMLInputElement;
}

describe('SaleModal — visible partial and full refund flow', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(api.getSale).mockResolvedValue(SALE);
        vi.mocked(api.listUsers).mockResolvedValue([]);
        vi.mocked(api.listPaymentMethods).mockResolvedValue([]);
        vi.mocked(api.listBranches).mockResolvedValue([]);
        vi.mocked(api.listTicketCategories).mockResolvedValue([]);
        vi.mocked(api.listTicketPriorities).mockResolvedValue([]);
    });

    it('submits a partial refund and reflects the resulting status', async () => {
        const user = userEvent.setup();
        let transaction = buildTransaction();

        vi.mocked(api.get).mockImplementation((path: string) => {
            if (path.includes('/payment-requests?')) return Promise.resolve({ data: [PAYMENT_REQUEST] });
            if (path.includes('/payment-transactions?')) return Promise.resolve({ data: [transaction] });
            if (path.includes('/timeline')) return Promise.resolve([]);
            return Promise.resolve({ data: [] });
        });
        vi.mocked(api.post).mockImplementation(async (path: string, body: unknown) => {
            expect(path).toBe('/payment-refunds');
            expect(body).toMatchObject({ payment_transaction_id: 700, amount: 20 });
            transaction = buildTransaction({
                status: 'partially_refunded',
                successful_refunded_amount: 20,
                net_collected_amount: 30,
                remaining_refundable_amount: 30,
            });
            return { id: 1, payment_transaction_id: 700, amount: 20, status: 'succeeded' };
        });

        render(<SaleModal isOpen saleId={300} user={ADMIN_USER} onClose={vi.fn()} onSuccess={vi.fn()} />);

        const refundButton = await screen.findByRole('button', { name: 'Reembolsar' });
        await user.click(refundButton);

        await waitFor(() => expect(screen.getByText('Monto a reembolsar')).toBeInTheDocument());
        const amountInput = inputByLabel('Monto a reembolsar');
        await user.clear(amountInput);
        await user.type(amountInput, '20');

        const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
        await user.click(screen.getByRole('button', { name: 'Confirmar Reembolso' }));

        await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
        await waitFor(() => expect(screen.getByText('Parcialmente Reembolsado')).toBeInTheDocument());

        confirmSpy.mockRestore();
    });

    it('submits a full refund and reflects the resulting refunded status', async () => {
        const user = userEvent.setup();
        let transaction = buildTransaction();

        vi.mocked(api.get).mockImplementation((path: string) => {
            if (path.includes('/payment-requests?')) return Promise.resolve({ data: [PAYMENT_REQUEST] });
            if (path.includes('/payment-transactions?')) return Promise.resolve({ data: [transaction] });
            if (path.includes('/timeline')) return Promise.resolve([]);
            return Promise.resolve({ data: [] });
        });
        vi.mocked(api.post).mockImplementation(async (path: string, body: unknown) => {
            expect(body).toMatchObject({ payment_transaction_id: 700, amount: 50 });
            transaction = buildTransaction({
                status: 'refunded',
                successful_refunded_amount: 50,
                net_collected_amount: 0,
                remaining_refundable_amount: 0,
            });
            return { id: 2, payment_transaction_id: 700, amount: 50, status: 'succeeded' };
        });

        render(<SaleModal isOpen saleId={300} user={ADMIN_USER} onClose={vi.fn()} onSuccess={vi.fn()} />);

        const refundButton = await screen.findByRole('button', { name: 'Reembolsar' });
        await user.click(refundButton);

        // Default amount pre-filled from refundableAmount ($50) — a full refund needs no edits.
        const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
        await user.click(screen.getByRole('button', { name: 'Confirmar Reembolso' }));

        await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
        await waitFor(() => expect(screen.getByText('Reembolsado')).toBeInTheDocument());

        confirmSpy.mockRestore();
    });
});
