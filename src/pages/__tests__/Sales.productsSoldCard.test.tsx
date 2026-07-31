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
    id: 901,
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
    sale_group_id: 901,
    lines_count: 2,
    lines: [
        { id: 9201, sale_group_id: 901, product_id: null, service_rendered: 'Producto A', quantity: 1, unit_price: 20, discount_amount: 0, tax_amount: 0, amount: 20, professional_id: null },
        { id: 9202, sale_group_id: 901, product_id: null, service_rendered: 'Producto B', quantity: 1, unit_price: 25, discount_amount: 0, tax_amount: 0, amount: 25, professional_id: null },
    ],
};

const INDEPENDENT_ITEM: SalesListIndependentItem = {
    type: 'independent',
    id: '701',
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

type ListSalesResponse = {
    data: (SalesListGroupItem | SalesListIndependentItem)[];
    current_page: number; last_page: number; per_page: number; total: number;
    from: number | null; to: number | null; total_amount: number;
    valid_count: number; products_sold_count: number; cancelled_count: number; cancelled_amount: number;
};

function buildResponse(
    data: (SalesListGroupItem | SalesListIndependentItem)[],
    overrides: Partial<ListSalesResponse> = {},
): ListSalesResponse {
    return {
        data,
        current_page: 1, last_page: 1, per_page: 400, total: data.length,
        from: data.length > 0 ? 1 : null, to: data.length,
        total_amount: data.reduce((acc, i) => acc + Number(i.type === 'group' ? i.total_amount : i.amount), 0),
        valid_count: data.length,
        products_sold_count: data.reduce((acc, i) => acc + (i.type === 'group' ? i.lines.length : 1), 0),
        cancelled_count: 0, cancelled_amount: 0,
        ...overrides,
    };
}

function getProductsSoldCardValue(): string | null {
    const title = screen.getByText(/Productos Vendidos/i);
    return title.parentElement?.querySelector('p.font-black')?.textContent ?? null;
}

describe('Sales — "Productos Vendidos" card', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(api.listBranches).mockResolvedValue([{ id: '1', name: 'Branch A', code: 'BRA', address: 'Test Address' }]);
        vi.mocked(api.listProducts).mockResolvedValue([]);
        vi.mocked(api.listLeads).mockResolvedValue([]);
        vi.mocked(api.listPaymentMethods).mockResolvedValue([{ id: 1, name: 'Efectivo' }]);
        vi.mocked(api.listUsers).mockResolvedValue([]);
        vi.mocked(api.getSalesStats).mockResolvedValue(EMPTY_STATS);
    });

    // --- 1 & 2: the card renders and shows the backend-provided products_sold_count ---

    it('renders and shows the products_sold_count value received from the backend', async () => {
        vi.mocked(api.listSales).mockResolvedValue(buildResponse([GROUP_ITEM, INDEPENDENT_ITEM]));

        render(<Sales user={ADMIN_USER} />);

        await waitFor(() => expect(screen.getByText('Cliente Agrupado')).toBeInTheDocument());

        expect(screen.getByText(/Productos Vendidos/i)).toBeInTheDocument();
        // GROUP_ITEM has 2 lines + 1 independent = 3 — the backend value, not sales.length (2).
        expect(getProductsSoldCardValue()).toBe('3');
    });

    // --- 3: a grouped sale with 2 lines can show 1 sale / 2 products at once ---

    it('shows 1 sale and 2 products for a single 2-line grouped sale', async () => {
        vi.mocked(api.listSales).mockResolvedValue(buildResponse([GROUP_ITEM]));

        render(<Sales user={ADMIN_USER} />);

        await waitFor(() => expect(screen.getByText('Cliente Agrupado')).toBeInTheDocument());

        const salesTitle = screen.getByText(/^Ventas (del Día|de la Semana|del Mes)$/);
        const salesValue = salesTitle.parentElement?.querySelector('p.font-black')?.textContent;
        expect(salesValue).toBe('1');
        expect(getProductsSoldCardValue()).toBe('2');
    });

    // --- 4: never derived from the number of visible rows ---

    it('does not derive its value from the number of visible rows', async () => {
        // Only 1 row is returned in `data` (as if paginated to a single item per page), but the
        // backend reports a much larger global products_sold_count — the card must show that,
        // never `data.length` or the sum of only what's visible.
        vi.mocked(api.listSales).mockResolvedValue(buildResponse([INDEPENDENT_ITEM], {
            total: 50, products_sold_count: 137, valid_count: 50,
        }));

        render(<Sales user={ADMIN_USER} />);

        await waitFor(() => expect(screen.getByText('Cliente Independiente')).toBeInTheDocument());

        expect(getProductsSoldCardValue()).toBe('137');
    });

    // --- 5: changing filters updates the indicator via the same source as the other cards ---

    it('updates when the underlying listSales response changes, via the same call as other cards', async () => {
        vi.mocked(api.listSales).mockResolvedValue(buildResponse([INDEPENDENT_ITEM]));
        const user = userEvent.setup();

        render(<Sales user={ADMIN_USER} />);
        await waitFor(() => expect(getProductsSoldCardValue()).toBe('1'));

        vi.mocked(api.listSales).mockResolvedValue(buildResponse([GROUP_ITEM, INDEPENDENT_ITEM]));
        // Re-trigger the same fetch every other KPI card (valid_count/total_amount) also depends
        // on — typing in the search box, which feeds the identical api.listSales() call via its
        // `search` option, exactly like a branch/date/seller filter change would.
        await user.type(screen.getByPlaceholderText('Buscar cliente o servicio...'), 'Agrupado');

        await waitFor(() => expect(getProductsSoldCardValue()).toBe('3'), { timeout: 2000 });
    });

    // --- 6: renders 0 (never undefined/null/NaN) when there are no results ---

    it('shows 0 rather than undefined/null/NaN when there are no sales', async () => {
        vi.mocked(api.listSales).mockResolvedValue(buildResponse([]));

        render(<Sales user={ADMIN_USER} />);

        await waitFor(() => expect(screen.getByText(/Productos Vendidos/i)).toBeInTheDocument());

        const value = getProductsSoldCardValue();
        expect(value).toBe('0');
        expect(value).not.toBe('undefined');
        expect(value).not.toBe('null');
        expect(value).not.toBe('NaN');
    });

    // --- 7: the grouped-sale expandable representation is unaffected ---

    it('does not interfere with the grouped-sale expandable row', async () => {
        vi.mocked(api.listSales).mockResolvedValue(buildResponse([GROUP_ITEM]));
        render(<Sales user={ADMIN_USER} />);

        await waitFor(() => expect(screen.getByText('2 productos')).toBeInTheDocument());
        expect(screen.queryByText('Producto A')).not.toBeInTheDocument();
    });
});
