import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SaleModal from '../SaleModal';
import { api } from '../../services/api';

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

const SALE_GROUP = {
    id: 1,
    tenant_id: 1,
    branch_id: 1,
    lead_id: null,
    seller_id: 1,
    client_name: 'Cliente Test',
    date: '2026-07-30T00:00:00Z',
    payment_method: 'card',
    currency: 'usd',
    subtotal_amount: 40,
    discount_amount: 1,
    tax_amount: 0.5,
    total_amount: 39.5,
    sale_status: 'payment_link_sent',
    payment_status: 'pending',
    payment_provider: 'stripe',
    paid_at: null,
    cancelled_at: null,
    created_at: '2026-07-30T00:00:00Z',
    lines: [
        { id: 201, sale_group_id: 1, product_id: 10, service_rendered: 'Producto A', quantity: 2, unit_price: 10, discount_amount: 1, tax_amount: 0.5, amount: 19.5, professional_id: null },
        { id: 202, sale_group_id: 1, product_id: null, service_rendered: 'Servicio manual', quantity: 1, unit_price: 20, discount_amount: 0, tax_amount: 0, amount: 20, professional_id: null },
    ],
};

const GROUPED_SALE_LINE = {
    id: 201,
    sale_group_id: 1,
    payment_provider: 'stripe',
    sale_status: 'payment_link_sent',
    payment_status: 'pending',
    service_rendered: 'Producto A',
    quantity: 2,
    unit_price: 10,
    amount: 19.5,
    branch_id: 1,
    seller_id: '1',
    client_name: 'Cliente Test',
    payment_method: 'card',
    created_at: '2026-07-30T00:00:00Z',
};

function mockGetRoutes(paymentRequests: any[]) {
    vi.mocked(api.get).mockImplementation((path: string) => {
        if (path.includes('/payment-requests?')) {
            return Promise.resolve({ data: paymentRequests });
        }
        if (path.includes('/payment-transactions?')) {
            return Promise.resolve({ data: [] });
        }
        if (path.includes('/timeline')) {
            return Promise.resolve([]);
        }
        return Promise.resolve({ data: [] });
    });
}

describe('SaleModal — grouped sale (ADR-027) rendering', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(api.getSale).mockResolvedValue(GROUPED_SALE_LINE);
        vi.mocked(api.getSaleGroup).mockResolvedValue(SALE_GROUP);
        vi.mocked(api.listUsers).mockResolvedValue([]);
        vi.mocked(api.listPaymentMethods).mockResolvedValue([]);
        vi.mocked(api.listBranches).mockResolvedValue([]);
        vi.mocked(api.listTicketCategories).mockResolvedValue([]);
        vi.mocked(api.listTicketPriorities).mockResolvedValue([]);
        mockGetRoutes([]);
    });

    it('renders the header, every line, and the consolidated total for a grouped sale', async () => {
        render(<SaleModal isOpen saleId={201} user={ADMIN_USER} onClose={vi.fn()} onSuccess={vi.fn()} />);

        await waitFor(() => expect(api.getSaleGroup).toHaveBeenCalledWith(1));

        expect(await screen.findByText(/Venta Agrupada #1/)).toBeInTheDocument();
        // 'Producto A' also appears in the single-line "no editable" detail field further down
        // (this modal was opened for that specific line) — assert it appears at least in the
        // grouped summary, rather than requiring a single match.
        expect(screen.getAllByText('Producto A').length).toBeGreaterThan(0);
        expect(screen.getByText('Servicio manual')).toBeInTheDocument();
        expect(screen.getByText('Total Consolidado')).toBeInTheDocument();
        expect(screen.getByText('$39.50')).toBeInTheDocument();
    });

    it('generating a Payment Request for a grouped sale renders exactly one Payment Link', async () => {
        const user = userEvent.setup();
        const paymentUrl = 'https://stripe.test/checkout/cs_group_test';

        // Once the Payment Request is created, a subsequent GET (loadPaymentRequest, called in
        // handleGeneratePaymentRequest's finally block) must see it too — mirrors a real backend.
        let createdPaymentRequest: any = null;
        vi.mocked(api.get).mockImplementation((path: string) => {
            if (path.includes('/payment-requests?')) {
                return Promise.resolve({ data: createdPaymentRequest ? [createdPaymentRequest] : [] });
            }
            if (path.includes('/payment-transactions?')) {
                return Promise.resolve({ data: [] });
            }
            if (path.includes('/timeline')) {
                return Promise.resolve([]);
            }
            return Promise.resolve({ data: [] });
        });
        vi.mocked(api.post).mockImplementation(async () => {
            createdPaymentRequest = {
                id: 900,
                sale_group_id: 1,
                sale_id: null,
                status: 'link_generated',
                payment_url: paymentUrl,
                amount: 39.5,
                currency: 'usd',
            };
            return createdPaymentRequest;
        });

        render(<SaleModal isOpen saleId={201} user={ADMIN_USER} onClose={vi.fn()} onSuccess={vi.fn()} />);

        await waitFor(() => expect(api.getSaleGroup).toHaveBeenCalled());
        expect(await screen.findByText(/Todavía no se ha generado un Payment Request/)).toBeInTheDocument();

        const generateButton = await screen.findByRole('button', { name: /Generar Payment Request/i });
        await user.click(generateButton);

        expect(api.post).toHaveBeenCalledWith('/payment-requests', { sale_group_id: 1 });

        const links = await screen.findAllByDisplayValue(paymentUrl);
        expect(links).toHaveLength(1);
    });
});
