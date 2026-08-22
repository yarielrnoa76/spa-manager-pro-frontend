import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

/**
 * Dashboard.tsx's "current month" period intentionally truncates its end boundary to `now`
 * (Dashboard.tsx: `const end = isCurrentMonth ? now : endOfMonth;`) — correct production
 * behavior, a "this month" view can't show sales dated in the future. The previous version of
 * this test hardcoded its fixture sales on day 15 of "the actual current month" assuming that
 * day would always be <= today — true whenever the suite happened to run on day 15 or later,
 * false otherwise. It broke the instant the suite ran on day 1 of a month (day 15 became a
 * "future" date relative to `now`, so the period filter correctly excluded it — the KPI going
 * to 0 was the filter working as designed against a fixture that no longer matched its own
 * assumption).
 *
 * Fix: freeze the clock with vi.setSystemTime() and derive every fixture date from that SAME
 * frozen instant (never a separate `new Date()` in the fixture), so "today" inside the test is
 * never ambiguous relative to Dashboard's own `now`. Parameterized across several month
 * boundaries so this can never silently regress the same way again, independent of whatever
 * day/timezone the suite actually runs on.
 */

function pad(n: number): string {
    return String(n).padStart(2, '0');
}

/** Local Y-M-D H:m:s formatting — matches how Dashboard's normalizeDate() parses a
 * non-ISO "YYYY-MM-DD HH:mm:ss" string (no timezone conversion involved on either side). */
function localDateTimeString(d: Date): string {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function buildFixtures(saleDateTime: string) {
    const group: SalesListGroupItem = {
        type: 'group',
        id: 701,
        tenant_id: 1,
        branch_id: 1,
        lead_id: null,
        seller_id: 1,
        client_name: 'Cliente Agrupado',
        date: saleDateTime,
        payment_method: 'cash',
        currency: 'usd',
        subtotal_amount: 45,
        discount_amount: 0,
        tax_amount: 0,
        total_amount: 45,
        sale_status: 'paid',
        payment_status: 'paid',
        payment_provider: 'manual',
        paid_at: saleDateTime,
        cancelled_at: null,
        created_at: saleDateTime,
        sale_group_id: 701,
        lines_count: 3,
        lines: [
            { id: 9101, sale_group_id: 701, product_id: null, service_rendered: 'Producto A', quantity: 1, unit_price: 15, discount_amount: 0, tax_amount: 0, amount: 15, professional_id: null },
            { id: 9102, sale_group_id: 701, product_id: null, service_rendered: 'Producto B', quantity: 1, unit_price: 15, discount_amount: 0, tax_amount: 0, amount: 15, professional_id: null },
            { id: 9103, sale_group_id: 701, product_id: null, service_rendered: 'Producto C', quantity: 1, unit_price: 15, discount_amount: 0, tax_amount: 0, amount: 15, professional_id: null },
        ],
    };

    const independent1: SalesListIndependentItem = {
        type: 'independent',
        id: '801',
        date: saleDateTime,
        seller_id: '1',
        branch_id: '1',
        client_name: 'Cliente Independiente 1',
        service_rendered: 'Servicio Independiente 1',
        amount: 10,
        payment_method: 'cash',
        created_at: saleDateTime,
        sale_group_id: null,
    };

    const independent2: SalesListIndependentItem = {
        ...independent1,
        id: '802',
        client_name: 'Cliente Independiente 2',
        service_rendered: 'Servicio Independiente 2',
    };

    return [group, independent1, independent2];
}

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

    afterEach(() => {
        vi.useRealTimers();
    });

    const scenarios: Array<{ label: string; frozenNow: Date }> = [
        // Exact regression case: "now" is day 1 of a month — the bug this test previously missed.
        { label: 'day 1 of August (July -> August rollover)', frozenNow: new Date(2026, 7, 1, 9, 0, 0) },
        // Year rollover: December -> January.
        { label: 'day 1 of January (December -> January rollover)', frozenNow: new Date(2027, 0, 1, 9, 0, 0) },
        // Last day of a month.
        { label: 'last day of September', frozenNow: new Date(2026, 8, 30, 23, 0, 0) },
        // Ordinary mid-month day, for a baseline unaffected by any boundary.
        { label: 'mid-month (June 15)', frozenNow: new Date(2026, 5, 15, 12, 0, 0) },
    ];

    it.each(scenarios)(
        'counts a 3-product grouped sale as one sale, alongside two independent sales, for a total of 3 — $label',
        async ({ frozenNow }) => {
            // shouldAdvanceTime keeps real timers ticking (required for Testing Library's
            // waitFor, which polls via setTimeout) while Date/Date.now() stay frozen.
            vi.useFakeTimers({ shouldAdvanceTime: true });
            vi.setSystemTime(frozenNow);

            // Sale dated at the frozen "now" itself — always <= the period's end boundary,
            // regardless of which day of the month "now" happens to be.
            const saleDateTime = localDateTimeString(frozenNow);
            const [group, independent1, independent2] = buildFixtures(saleDateTime);

            vi.mocked(api.listSales).mockResolvedValue({
                data: [group, independent1, independent2],
                current_page: 1, last_page: 1, per_page: 400, total: 3, from: 1, to: 3,
                total_amount: 65, valid_count: 3, cancelled_count: 0, cancelled_amount: 0,
            });

            render(<Dashboard />);

            await waitFor(() => expect(screen.getByText('Cant. Ventas')).toBeInTheDocument());

            // 1 grouped sale (3 lines, counted once) + 2 independent sales = 3 sale operations —
            // never 5 (double-counting the group's own lines) and never 0 (a sale dated exactly
            // "now" must never be excluded by the current-month-to-date truncation).
            const title = screen.getByText('Cant. Ventas');
            const value = title.parentElement?.querySelector('h3');
            expect(value?.textContent).toBe('3');
        },
    );

    it('excludes a sale dated tomorrow (still within the current month) from the current-month-to-date count', async () => {
        // Confirms the underlying truncation-to-`now` behavior is real and intentional — not
        // something this fix should paper over — by asserting the opposite outcome for a date
        // that is genuinely in the future relative to the frozen "now".
        const frozenNow = new Date(2026, 7, 10, 9, 0, 0); // Aug 10, 2026
        vi.useFakeTimers({ shouldAdvanceTime: true });
        vi.setSystemTime(frozenNow);

        const tomorrow = new Date(2026, 7, 11, 9, 0, 0); // Aug 11, 2026 — same month, future day
        const [group, independent1, independent2] = buildFixtures(localDateTimeString(tomorrow));

        vi.mocked(api.listSales).mockResolvedValue({
            data: [group, independent1, independent2],
            current_page: 1, last_page: 1, per_page: 400, total: 3, from: 1, to: 3,
            total_amount: 65, valid_count: 3, cancelled_count: 0, cancelled_amount: 0,
        });

        render(<Dashboard />);

        await waitFor(() => expect(screen.getByText('Cant. Ventas')).toBeInTheDocument());

        const title = screen.getByText('Cant. Ventas');
        const value = title.parentElement?.querySelector('h3');
        expect(value?.textContent).toBe('0');
    });
});
