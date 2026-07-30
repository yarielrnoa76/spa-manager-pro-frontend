import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import Dashboard from '../Dashboard';
import { api } from '../../services/api';
import type { SalesListGroupItem, SalesListIndependentItem } from '../../types/payments';

vi.mock('../../services/api', () => ({
    api: {
        getDashboardStats: vi.fn(),
        listBranches: vi.fn(),
        listSales: vi.fn(),
        listProducts: vi.fn(),
        me: vi.fn(),
        get: vi.fn(),
    },
}));

// Anchor every fixture date to the actual current month/year so the test is stable regardless of
// when it runs (Dashboard's "Resumen de Actividad" tab defaults to the current month).
const now = new Date();
const CURRENT_MONTH_DAY = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-15 10:00:00`;

const GROUP_ITEM: SalesListGroupItem = {
    type: 'group',
    id: 701,
    tenant_id: 1,
    branch_id: 1,
    lead_id: null,
    seller_id: 1,
    client_name: 'Cliente Agrupado',
    date: CURRENT_MONTH_DAY,
    payment_method: 'cash',
    currency: 'usd',
    subtotal_amount: 45,
    discount_amount: 0,
    tax_amount: 0,
    total_amount: 45,
    sale_status: 'paid',
    payment_status: 'paid',
    payment_provider: 'manual',
    paid_at: CURRENT_MONTH_DAY,
    cancelled_at: null,
    created_at: CURRENT_MONTH_DAY,
    sale_group_id: 701,
    lines_count: 3,
    lines: [
        { id: 9101, sale_group_id: 701, product_id: null, service_rendered: 'Producto A', quantity: 1, unit_price: 15, discount_amount: 0, tax_amount: 0, amount: 15, professional_id: null },
        { id: 9102, sale_group_id: 701, product_id: null, service_rendered: 'Producto B', quantity: 1, unit_price: 15, discount_amount: 0, tax_amount: 0, amount: 15, professional_id: null },
        { id: 9103, sale_group_id: 701, product_id: null, service_rendered: 'Producto C', quantity: 1, unit_price: 15, discount_amount: 0, tax_amount: 0, amount: 15, professional_id: null },
    ],
};

const INDEPENDENT_ITEM_1: SalesListIndependentItem = {
    type: 'independent',
    id: '801',
    date: CURRENT_MONTH_DAY,
    seller_id: '1',
    branch_id: '1',
    client_name: 'Cliente Independiente 1',
    service_rendered: 'Servicio Independiente 1',
    amount: 10,
    payment_method: 'cash',
    created_at: CURRENT_MONTH_DAY,
    sale_group_id: null,
};

const INDEPENDENT_ITEM_2: SalesListIndependentItem = {
    ...INDEPENDENT_ITEM_1,
    id: '802',
    client_name: 'Cliente Independiente 2',
    service_rendered: 'Servicio Independiente 2',
};

describe('Dashboard — "Cant. Ventas" counts sale operations, not lines', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(api.getDashboardStats).mockResolvedValue({
            totalSales: 65, profit: 65, recentLeads: [], salesCount: 3, lowStockCount: 0,
        });
        vi.mocked(api.listBranches).mockResolvedValue([{ id: '1', name: 'Branch A', code: 'BRA', address: 'Test Address' }]);
        vi.mocked(api.listProducts).mockResolvedValue([]);
        vi.mocked(api.me).mockResolvedValue({
            id: '1', name: 'Admin', email: 'admin@test.com', is_super_admin: true,
            role: { id: 1, name: 'superadmin' }, permissions: [],
        });
        vi.mocked(api.get).mockResolvedValue([]);
    });

    it('counts a 3-product grouped sale as one sale, alongside two independent sales, for a total of 3', async () => {
        vi.mocked(api.listSales).mockResolvedValue({
            data: [GROUP_ITEM, INDEPENDENT_ITEM_1, INDEPENDENT_ITEM_2],
            current_page: 1, last_page: 1, per_page: 400, total: 3, from: 1, to: 3,
            total_amount: 65, valid_count: 3, cancelled_count: 0, cancelled_amount: 0,
        });

        render(<Dashboard />);

        await waitFor(() => expect(screen.getByText('Cant. Ventas')).toBeInTheDocument());

        // 1 grouped sale (3 lines, counted once) + 2 independent sales = 3 sale operations —
        // never 5 (which double-counting the group's own lines would have produced).
        const title = screen.getByText('Cant. Ventas');
        const value = title.parentElement?.querySelector('h3');
        expect(value?.textContent).toBe('3');
    });
});
