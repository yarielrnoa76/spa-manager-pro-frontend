import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import Dashboard from '../Dashboard';
import { api } from '../../services/api';

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

/**
 * "Ganancia Est." must render the backend-computed 'profit' field
 * (App\Services\ProfitCalculationService via DashboardController::getStats()) — it must NOT
 * recompute its own figure from raw sales/product data client-side. This is the fix for the
 * duplication the audit found: DashboardController and Dashboard.tsx used to compute Profit two
 * different ways, neither of which subtracted successful refunds. Backend is now the single
 * source of truth end to end.
 */
describe('Dashboard — "Ganancia Est." consumes backend-computed profit, no client recomputation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(api.listBranches).mockResolvedValue([{ id: '1', name: 'Branch A', code: 'BRA', address: 'Test Address' }]);
        // A product whose cost_price, if a client-side recompute still existed, would produce a
        // DIFFERENT profit figure than the one asserted below — proves the UI isn't deriving its
        // own number from this data.
        vi.mocked(api.listProducts).mockResolvedValue([{ id: 1, name: 'Producto A', salesprice: 100, cost_price: 999 } as any]);
        vi.mocked(api.me).mockResolvedValue({
            id: '1', name: 'Admin', email: 'admin@test.com', is_super_admin: true,
            role: { id: 1, name: 'superadmin' }, permissions: [],
        });
        vi.mocked(api.get).mockResolvedValue([]);
        vi.mocked(api.listSales).mockResolvedValue({
            data: [{
                type: 'independent', id: '801', date: '2026-08-10 09:00:00', seller_id: '1',
                branch_id: '1', client_name: 'Cliente Stripe', service_rendered: 'Servicio',
                product_id: 1, quantity: 1, amount: 100, payment_method: 'Stripe',
                payment_provider: 'stripe', payment_status: 'partially_refunded',
                created_at: '2026-08-10 09:00:00', sale_group_id: null,
            }],
            current_page: 1, last_page: 1, per_page: 400, total: 1, from: 1, to: 1,
            total_amount: 100, valid_count: 1, cancelled_count: 0, cancelled_amount: 0,
        });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('renders the exact profit figure returned by the backend, ignoring product cost_price entirely', async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        vi.setSystemTime(new Date(2026, 7, 10, 12, 0, 0));

        // Backend already applied Profit = Net Revenue - Cost = (100 - 20) - 30 = 50. If the
        // frontend were still recomputing its own figure from `products` (cost_price=999 above),
        // it would show something wildly different (and negative) instead.
        vi.mocked(api.getDashboardStats).mockResolvedValue({
            totalSales: 100, profit: 50, recentLeads: [], salesCount: 1, lowStockCount: 0,
            revenue_paid: 100, revenue_pending: 0, revenue_refunded: 20,
        } as any);

        render(<Dashboard />);

        await waitFor(() => expect(screen.getByText('Ganancia Est.')).toBeInTheDocument());

        await waitFor(() => {
            const title = screen.getByText('Ganancia Est.');
            const value = title.parentElement?.querySelector('h3');
            expect(value?.textContent).toBe('$50.00');
        });
    });

    it('shows a dash while the period-scoped backend figure has not loaded yet, never a client-computed fallback', async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        vi.setSystemTime(new Date(2026, 7, 10, 12, 0, 0));

        // Dashboard.tsx calls api.getDashboardStats() twice with different signatures: once on
        // mount (branch only — gates the page's own "Cargando panel..." loading state) and once
        // per period (branch + {from, to} — feeds `revenueStats.profit`, the one this test cares
        // about). Resolve the first normally so the page actually renders, but leave the second
        // pending forever to simulate "profit hasn't loaded for this period yet".
        vi.mocked(api.getDashboardStats).mockImplementation((_branch: unknown, range?: unknown) => {
            if (range) return new Promise(() => {});
            return Promise.resolve({ totalSales: 0, profit: 0, recentLeads: [], salesCount: 0, lowStockCount: 0 } as any);
        });

        render(<Dashboard />);

        await waitFor(() => expect(screen.getByText('Ganancia Est.')).toBeInTheDocument());

        const title = screen.getByText('Ganancia Est.');
        const value = title.parentElement?.querySelector('h3');
        expect(value?.textContent).toBe('—');
    });
});
