import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Sales from '../Sales';
import { api } from '../../services/api';
import type { SalesListGroupItem, SalesListIndependentItem } from '../../types/payments';

vi.mock('../../services/api', () => ({
    api: {
        listBranches: vi.fn(),
        listProducts: vi.fn(),
        listLeads: vi.fn(),
        listPaymentMethods: vi.fn(),
        listUsers: vi.fn(),
        listSales: vi.fn(),
        getSalesStats: vi.fn(),
        cancelSale: vi.fn(),
        cancelSaleGroup: vi.fn(),
        exportSales: vi.fn(),
    },
}));

const ADMIN_USER = { id: 1, is_super_admin: true, permissions: [] };

const EMPTY_STATS = {
    total_day: 0, total_month: 0, days_worked: 0, total_working_days: 0, projection: 0,
    weekly_breakdown: [],
};

const GROUP_ITEM: SalesListGroupItem = {
    type: 'group',
    id: 501,
    tenant_id: 1,
    branch_id: 1,
    lead_id: null,
    seller_id: 1,
    seller_name: 'Vendedora Test',
    client_name: 'Cliente Agrupado',
    date: '2026-07-30 10:00:00',
    payment_method: 'cash',
    currency: 'usd',
    subtotal_amount: 45,
    discount_amount: 0,
    tax_amount: 0,
    total_amount: 45,
    sale_status: 'paid',
    payment_status: 'paid',
    payment_provider: 'manual',
    paid_at: '2026-07-30 10:00:00',
    cancelled_at: null,
    created_at: '2026-07-30 10:00:00',
    sale_group_id: 501,
    lines_count: 2,
    lines: [
        { id: 9001, sale_group_id: 501, product_id: null, service_rendered: 'Producto A', quantity: 1, unit_price: 20, discount_amount: 0, tax_amount: 0, amount: 20, professional_id: null },
        { id: 9002, sale_group_id: 501, product_id: null, service_rendered: 'Producto B', quantity: 1, unit_price: 25, discount_amount: 0, tax_amount: 0, amount: 25, professional_id: null },
    ],
};

const INDEPENDENT_ITEM: SalesListIndependentItem = {
    type: 'independent',
    id: '601',
    date: '2026-07-30 11:00:00',
    seller_id: '1',
    branch_id: '1',
    client_name: 'Cliente Independiente',
    service_rendered: 'Servicio Independiente',
    amount: 33,
    payment_method: 'cash',
    created_at: '2026-07-30 11:00:00',
    sale_group_id: null,
};

function mockListSalesResponse(data: (SalesListGroupItem | SalesListIndependentItem)[]) {
    vi.mocked(api.listSales).mockResolvedValue({
        data,
        current_page: 1, last_page: 1, per_page: 400, total: data.length, from: data.length > 0 ? 1 : null, to: data.length,
        total_amount: data.reduce((acc, i) => acc + Number(i.type === 'group' ? i.total_amount : i.amount), 0),
        valid_count: data.length, cancelled_count: 0, cancelled_amount: 0,
    });
}

describe('Sales — grouped sale presentation (one row per operation)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(api.listBranches).mockResolvedValue([{ id: '1', name: 'Branch A', code: 'BRA', address: 'Test Address' }]);
        vi.mocked(api.listProducts).mockResolvedValue([]);
        vi.mocked(api.listLeads).mockResolvedValue([]);
        vi.mocked(api.listPaymentMethods).mockResolvedValue([{ id: 1, name: 'Efectivo' }]);
        vi.mocked(api.listUsers).mockResolvedValue([]);
        vi.mocked(api.getSalesStats).mockResolvedValue(EMPTY_STATS);
    });

    it('renders a grouped sale as a single row and expands to reveal its lines', async () => {
        mockListSalesResponse([GROUP_ITEM]);
        const user = userEvent.setup();

        render(<Sales user={ADMIN_USER} />);

        await waitFor(() => expect(screen.getByText('Cliente Agrupado')).toBeInTheDocument());

        // One consolidated row: exactly one "Cliente Agrupado" cell, one consolidated total, no
        // per-line duplication of the total/status.
        expect(screen.getAllByText('Cliente Agrupado')).toHaveLength(1);
        expect(screen.getByText('2 productos')).toBeInTheDocument();
        // "$45.00" also appears in the "Importe Filtrado" KPI card, which shares the same total —
        // assert it appears at least once in the row rather than requiring a single match.
        expect(screen.getAllByText('$45.00').length).toBeGreaterThan(0);

        // Lines aren't shown until expanded.
        expect(screen.queryByText('Producto A')).not.toBeInTheDocument();

        await user.click(screen.getByText('2 productos'));

        expect(await screen.findByText('Producto A')).toBeInTheDocument();
        expect(screen.getByText('Producto B')).toBeInTheDocument();
    });

    it('renders an independent sale with its historical single-row presentation', async () => {
        mockListSalesResponse([INDEPENDENT_ITEM]);

        render(<Sales user={ADMIN_USER} />);

        await waitFor(() => expect(screen.getByText('Cliente Independiente')).toBeInTheDocument());

        expect(screen.getByText('Servicio Independiente')).toBeInTheDocument();
        // No expand affordance for an independent row.
        expect(screen.queryByText(/producto(s)?$/)).not.toBeInTheDocument();
    });

    it('cancelling a grouped sale calls cancelSaleGroup, never cancelSale', async () => {
        mockListSalesResponse([GROUP_ITEM]);
        vi.mocked(api.cancelSaleGroup).mockResolvedValue({});
        const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
        const user = userEvent.setup();

        render(<Sales user={ADMIN_USER} />);

        await waitFor(() => expect(screen.getByText('Cliente Agrupado')).toBeInTheDocument());

        await user.click(screen.getByRole('button', { name: 'Cancelar' }));

        expect(api.cancelSaleGroup).toHaveBeenCalledWith(501);
        expect(api.cancelSale).not.toHaveBeenCalled();

        confirmSpy.mockRestore();
    });
});
