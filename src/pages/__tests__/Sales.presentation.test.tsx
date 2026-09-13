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

/** A grouped sale with exactly one REAL, coherent line -- must flatten to a simple row (real
 *  product, real professional, real unit price, real quantity), never the multi-line summary. */
const GROUP_ITEM_SINGLE_LINE: SalesListGroupItem = {
    ...GROUP_ITEM,
    id: 502,
    sale_group_id: 502,
    client_name: 'Cliente Agrupado Uno',
    total_amount: 20,
    lines_count: 1,
    lines: [
        {
            id: 9101, sale_group_id: 502, product_id: 77, service_rendered: 'Producto Único',
            quantity: 1, unit_price: 20, discount_amount: 0, tax_amount: 0, amount: 20,
            professional_id: 55, professional: { id: 55, fname: 'Ana', lname: 'Profesional' },
        },
    ],
};

/** Same one-line group, but with no professional attached at all. */
const GROUP_ITEM_SINGLE_LINE_NO_PROFESSIONAL: SalesListGroupItem = {
    ...GROUP_ITEM_SINGLE_LINE,
    id: 503,
    sale_group_id: 503,
    client_name: 'Cliente Sin Profesional',
    lines: [
        { ...GROUP_ITEM_SINGLE_LINE.lines[0], id: 9102, sale_group_id: 503, professional_id: null, professional: null },
    ],
};

/** Same one-line group, but that one line has quantity > 1 -- still ONE line, still simple. */
const GROUP_ITEM_SINGLE_LINE_QTY3: SalesListGroupItem = {
    ...GROUP_ITEM_SINGLE_LINE,
    id: 504,
    sale_group_id: 504,
    client_name: 'Cliente Cantidad Tres',
    total_amount: 60,
    lines: [
        { ...GROUP_ITEM_SINGLE_LINE.lines[0], id: 9103, sale_group_id: 504, quantity: 3, amount: 60 },
    ],
};

/** `lines_count` says 1 but the real `lines` array disagrees (empty here) -- an inconsistent,
 *  incoherent group must NEVER be flattened or have data fabricated; it falls back to the
 *  existing, safe multi-line summary presentation exactly as before this fix. */
const GROUP_ITEM_INCONSISTENT: SalesListGroupItem = {
    ...GROUP_ITEM_SINGLE_LINE,
    id: 505,
    sale_group_id: 505,
    client_name: 'Cliente Inconsistente',
    lines_count: 1,
    lines: [],
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
    const productsSoldCount = data.reduce((acc, i) => acc + (i.type === 'group' ? i.lines.length : 1), 0);
    vi.mocked(api.listSales).mockResolvedValue({
        data,
        current_page: 1, last_page: 1, per_page: 400, total: data.length, from: data.length > 0 ? 1 : null, to: data.length,
        total_amount: data.reduce((acc, i) => acc + Number(i.type === 'group' ? i.total_amount : i.amount), 0),
        valid_count: data.length, products_sold_count: productsSoldCount, cancelled_count: 0, cancelled_amount: 0,
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

/**
 * fix: honor tenant sale mode consistently -- a grouped sale with exactly one REAL, coherent
 * line renders as a simple row (real product/professional/price/quantity), never the "N
 * productos" accordion summary with "Varios"/"—". It is still, underneath, the exact same
 * SaleGroup: cancellation and detail-view identity are entirely unaffected by how it is drawn.
 */
describe('Sales — a one-line group flattens to a simple row, never the multi-line accordion', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(api.listBranches).mockResolvedValue([{ id: '1', name: 'Branch A', code: 'BRA', address: 'Test Address' }]);
        vi.mocked(api.listProducts).mockResolvedValue([]);
        vi.mocked(api.listLeads).mockResolvedValue([]);
        vi.mocked(api.listPaymentMethods).mockResolvedValue([{ id: 1, name: 'Efectivo' }]);
        vi.mocked(api.listUsers).mockResolvedValue([]);
        vi.mocked(api.getSalesStats).mockResolvedValue(EMPTY_STATS);
    });

    it('16 & 18. shows the real product, professional, unit price, quantity and total -- never an accordion/chevron/"1 producto"/"Varios"', async () => {
        mockListSalesResponse([GROUP_ITEM_SINGLE_LINE]);
        render(<Sales user={ADMIN_USER} />);

        await waitFor(() => expect(screen.getByText('Cliente Agrupado Uno')).toBeInTheDocument());

        expect(screen.getByText('Producto Único')).toBeInTheDocument();
        expect(screen.getByText('Ana Profesional')).toBeInTheDocument();
        // "$20.00" legitimately appears more than once (unit price cell, total cell, KPI card).
        expect(screen.getAllByText('$20.00').length).toBeGreaterThanOrEqual(2);
        // No accordion affordance at all for this row.
        expect(screen.queryByText(/^1 producto$/)).not.toBeInTheDocument();
        expect(screen.queryByText('Varios')).not.toBeInTheDocument();
    });

    it('19. a one-line group with no professional shows "—", never fabricating one', async () => {
        mockListSalesResponse([GROUP_ITEM_SINGLE_LINE_NO_PROFESSIONAL]);
        render(<Sales user={ADMIN_USER} />);

        await waitFor(() => expect(screen.getByText('Cliente Sin Profesional')).toBeInTheDocument());
        expect(screen.getByText('—')).toBeInTheDocument();
        expect(screen.queryByText('Varios')).not.toBeInTheDocument();
    });

    it('17. a one-line group whose line has quantity > 1 is still a simple row, never the accordion', async () => {
        mockListSalesResponse([GROUP_ITEM_SINGLE_LINE_QTY3]);
        render(<Sales user={ADMIN_USER} />);

        await waitFor(() => expect(screen.getByText('Cliente Cantidad Tres')).toBeInTheDocument());
        expect(screen.getByText('Producto Único')).toBeInTheDocument();
        // Quantity shown is the line's own real quantity (3), never treated as "3 lines".
        expect(screen.getByText('3')).toBeInTheDocument();
        expect(screen.queryByText(/producto$/)).not.toBeInTheDocument();
    });

    it('20. a group with two or more lines keeps the accordion summary (regression guard)', async () => {
        mockListSalesResponse([GROUP_ITEM]);
        render(<Sales user={ADMIN_USER} />);

        await waitFor(() => expect(screen.getByText('Cliente Agrupado')).toBeInTheDocument());
        expect(screen.getByText('2 productos')).toBeInTheDocument();
        expect(screen.getByText('Varios')).toBeInTheDocument();
    });

    it('21. lines_count/lines inconsistency falls back to the safe multi-line presentation -- never fabricated product/price/professional', async () => {
        mockListSalesResponse([GROUP_ITEM_INCONSISTENT]);
        render(<Sales user={ADMIN_USER} />);

        await waitFor(() => expect(screen.getByText('Cliente Inconsistente')).toBeInTheDocument());
        // Never invents "Producto Único" from the mismatched lines_count -- falls back to the
        // honest, existing group summary instead of pretending it flattened cleanly.
        expect(screen.queryByText('Producto Único')).not.toBeInTheDocument();
        expect(screen.getByText('Varios')).toBeInTheDocument();
        expect(screen.getByText('1 producto')).toBeInTheDocument();
    });

    it('22. cancelling a one-line group still calls cancelSaleGroup(item.id), never cancelSale', async () => {
        mockListSalesResponse([GROUP_ITEM_SINGLE_LINE]);
        vi.mocked(api.cancelSaleGroup).mockResolvedValue({});
        const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
        const user = userEvent.setup();

        render(<Sales user={ADMIN_USER} />);
        await waitFor(() => expect(screen.getByText('Cliente Agrupado Uno')).toBeInTheDocument());

        await user.click(screen.getByRole('button', { name: 'Cancelar' }));

        expect(api.cancelSaleGroup).toHaveBeenCalledWith(502);
        expect(api.cancelSale).not.toHaveBeenCalled();
        confirmSpy.mockRestore();
    });

    it('23. totals and counters are unaffected by the simple-row presentation (backend-computed, never recomputed client-side)', async () => {
        mockListSalesResponse([GROUP_ITEM_SINGLE_LINE, GROUP_ITEM]);
        render(<Sales user={ADMIN_USER} />);

        await waitFor(() => expect(screen.getByText('Cliente Agrupado Uno')).toBeInTheDocument());
        // total_amount for both rows (20 + 45 = 65) comes straight from the mocked listSales
        // response's own total_amount field -- never recomputed from what got flattened.
        expect(screen.getAllByText('$65.00').length).toBeGreaterThan(0);
    });
});

/**
 * fix: gate sale cancellation by permission -- QA finding: a `sales` actor without `delete_sale`
 * saw Cancelar fully enabled (backend correctly rejected the request; the defect was purely
 * frontend gating). `handleCancelSale` is the ONE code path for both independent and grouped
 * cancellation (it branches internally on the item's own type), and it is rendered from a single
 * button, so exercising independent / one-line-group / multi-line-group here covers every real
 * entrypoint -- there is no other button or component in the app that calls cancelSale or
 * cancelSaleGroup (confirmed by a full-repo search).
 */
describe('Sales — Cancelar is gated by delete_sale, never by role.name/sales_scope/grouping/entrypoint', () => {
    const SALES_USER_NO_DELETE = { id: 10, is_super_admin: false, permissions: ['view_sales'] };
    const SALES_USER_WITH_DELETE = { id: 11, is_super_admin: false, permissions: ['view_sales', 'delete_sale'] };
    // A role literally NAMED "superadmin" -- Sales.tsx never reads `user.role` at all, so this
    // field is inert; included only to prove no accidental role-name-based bypass exists.
    const FAKE_SUPERADMIN_BY_NAME = { id: 12, is_super_admin: false, role: { id: 1, name: 'superadmin' }, permissions: [] };
    const WIDE_SCOPE_NO_DELETE = { id: 13, is_super_admin: false, permissions: ['view_all_sales', 'view_branch', 'view_my_sales_only'] };

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(api.listBranches).mockResolvedValue([{ id: '1', name: 'Branch A', code: 'BRA', address: 'Test Address' }]);
        vi.mocked(api.listProducts).mockResolvedValue([]);
        vi.mocked(api.listLeads).mockResolvedValue([]);
        vi.mocked(api.listPaymentMethods).mockResolvedValue([{ id: 1, name: 'Efectivo' }]);
        vi.mocked(api.listUsers).mockResolvedValue([]);
        vi.mocked(api.getSalesStats).mockResolvedValue(EMPTY_STATS);
    });

    function cancelButton(): HTMLButtonElement {
        return screen.getByRole('button', { name: 'Cancelar' }) as HTMLButtonElement;
    }

    it('1. without delete_sale, an independent sale shows Cancelar disabled', async () => {
        mockListSalesResponse([INDEPENDENT_ITEM]);
        render(<Sales user={SALES_USER_NO_DELETE} />);
        await waitFor(() => expect(screen.getByText('Cliente Independiente')).toBeInTheDocument());

        expect(cancelButton().disabled).toBe(true);
    });

    it('2. without delete_sale, a one-line group shows Cancelar disabled', async () => {
        mockListSalesResponse([GROUP_ITEM_SINGLE_LINE]);
        render(<Sales user={SALES_USER_NO_DELETE} />);
        await waitFor(() => expect(screen.getByText('Cliente Agrupado Uno')).toBeInTheDocument());

        expect(cancelButton().disabled).toBe(true);
    });

    it('3. without delete_sale, a multi-line group shows Cancelar disabled', async () => {
        mockListSalesResponse([GROUP_ITEM]);
        render(<Sales user={SALES_USER_NO_DELETE} />);
        await waitFor(() => expect(screen.getByText('Cliente Agrupado')).toBeInTheDocument());

        expect(cancelButton().disabled).toBe(true);
    });

    it('4. without delete_sale, clicking (or attempting keyboard activation) never opens the confirm dialog', async () => {
        mockListSalesResponse([INDEPENDENT_ITEM]);
        const confirmSpy = vi.spyOn(window, 'confirm');
        const user = userEvent.setup();
        render(<Sales user={SALES_USER_NO_DELETE} />);
        await waitFor(() => expect(screen.getByText('Cliente Independiente')).toBeInTheDocument());

        const button = cancelButton();
        await user.click(button);
        // A disabled element is unreachable by keyboard: it never receives focus, so it can never
        // be activated with Enter/Space either.
        button.focus();
        expect(document.activeElement).not.toBe(button);

        expect(confirmSpy).not.toHaveBeenCalled();
        confirmSpy.mockRestore();
    });

    it('5. without delete_sale, neither cancelSale nor cancelSaleGroup is ever called', async () => {
        mockListSalesResponse([GROUP_ITEM]);
        vi.spyOn(window, 'confirm').mockReturnValue(true);
        const user = userEvent.setup();
        render(<Sales user={SALES_USER_NO_DELETE} />);
        await waitFor(() => expect(screen.getByText('Cliente Agrupado')).toBeInTheDocument());

        await user.click(cancelButton());

        expect(api.cancelSale).not.toHaveBeenCalled();
        expect(api.cancelSaleGroup).not.toHaveBeenCalled();
    });

    it('6. with delete_sale, an independent sale calls cancelSale with the correct id', async () => {
        mockListSalesResponse([INDEPENDENT_ITEM]);
        vi.mocked(api.cancelSale).mockResolvedValue({});
        vi.spyOn(window, 'confirm').mockReturnValue(true);
        const user = userEvent.setup();
        render(<Sales user={SALES_USER_WITH_DELETE} />);
        await waitFor(() => expect(screen.getByText('Cliente Independiente')).toBeInTheDocument());

        expect(cancelButton().disabled).toBe(false);
        await user.click(cancelButton());

        expect(api.cancelSale).toHaveBeenCalledWith('601');
        expect(api.cancelSaleGroup).not.toHaveBeenCalled();
    });

    it('7. with delete_sale, a one-line group (flattened) calls cancelSaleGroup(item.id)', async () => {
        mockListSalesResponse([GROUP_ITEM_SINGLE_LINE]);
        vi.mocked(api.cancelSaleGroup).mockResolvedValue({});
        vi.spyOn(window, 'confirm').mockReturnValue(true);
        const user = userEvent.setup();
        render(<Sales user={SALES_USER_WITH_DELETE} />);
        await waitFor(() => expect(screen.getByText('Cliente Agrupado Uno')).toBeInTheDocument());

        expect(cancelButton().disabled).toBe(false);
        await user.click(cancelButton());

        expect(api.cancelSaleGroup).toHaveBeenCalledWith(502);
        expect(api.cancelSale).not.toHaveBeenCalled();
    });

    it('8. with delete_sale, a multi-line group calls cancelSaleGroup(item.id)', async () => {
        mockListSalesResponse([GROUP_ITEM]);
        vi.mocked(api.cancelSaleGroup).mockResolvedValue({});
        vi.spyOn(window, 'confirm').mockReturnValue(true);
        const user = userEvent.setup();
        render(<Sales user={SALES_USER_WITH_DELETE} />);
        await waitFor(() => expect(screen.getByText('Cliente Agrupado')).toBeInTheDocument());

        expect(cancelButton().disabled).toBe(false);
        await user.click(cancelButton());

        expect(api.cancelSaleGroup).toHaveBeenCalledWith(501);
        expect(api.cancelSale).not.toHaveBeenCalled();
    });

    it('9. the canonical is_super_admin flag alone reproduces the backend capability, without delete_sale in the permissions list', async () => {
        mockListSalesResponse([INDEPENDENT_ITEM]);
        const superAdminNoExplicitPerm = { id: 20, is_super_admin: true, permissions: [] };
        render(<Sales user={superAdminNoExplicitPerm} />);
        await waitFor(() => expect(screen.getByText('Cliente Independiente')).toBeInTheDocument());

        expect(cancelButton().disabled).toBe(false);
    });

    it('10. a role literally named "superadmin" without the canonical flag and without delete_sale stays blocked', async () => {
        mockListSalesResponse([INDEPENDENT_ITEM]);
        render(<Sales user={FAKE_SUPERADMIN_BY_NAME} />);
        await waitFor(() => expect(screen.getByText('Cliente Independiente')).toBeInTheDocument());

        expect(cancelButton().disabled).toBe(true);
    });

    it('11. broad sales-scope-like permissions (view_all_sales/view_branch/view_my_sales_only) never substitute for delete_sale', async () => {
        mockListSalesResponse([INDEPENDENT_ITEM]);
        render(<Sales user={WIDE_SCOPE_NO_DELETE} />);
        await waitFor(() => expect(screen.getByText('Cliente Independiente')).toBeInTheDocument());

        expect(cancelButton().disabled).toBe(true);
    });

    it('12. one-line and multi-line group rendering remain correct for a non-SuperAdmin actor with delete_sale', async () => {
        mockListSalesResponse([GROUP_ITEM_SINGLE_LINE]);
        const { unmount } = render(<Sales user={SALES_USER_WITH_DELETE} />);
        await waitFor(() => expect(screen.getByText('Cliente Agrupado Uno')).toBeInTheDocument());
        expect(screen.getByText('Producto Único')).toBeInTheDocument();
        expect(screen.queryByText('Varios')).not.toBeInTheDocument();
        unmount();

        vi.clearAllMocks();
        vi.mocked(api.listBranches).mockResolvedValue([{ id: '1', name: 'Branch A', code: 'BRA', address: 'Test Address' }]);
        vi.mocked(api.listProducts).mockResolvedValue([]);
        vi.mocked(api.listLeads).mockResolvedValue([]);
        vi.mocked(api.listPaymentMethods).mockResolvedValue([{ id: 1, name: 'Efectivo' }]);
        vi.mocked(api.listUsers).mockResolvedValue([]);
        vi.mocked(api.getSalesStats).mockResolvedValue(EMPTY_STATS);
        mockListSalesResponse([GROUP_ITEM]);
        render(<Sales user={SALES_USER_WITH_DELETE} />);
        await waitFor(() => expect(screen.getByText('Cliente Agrupado')).toBeInTheDocument());
        expect(screen.getByText('2 productos')).toBeInTheDocument();
        expect(screen.getByText('Varios')).toBeInTheDocument();
    });

    it('13. metrics and the list refresh after an authorized cancellation', async () => {
        mockListSalesResponse([INDEPENDENT_ITEM]);
        vi.mocked(api.cancelSale).mockResolvedValue({});
        vi.spyOn(window, 'confirm').mockReturnValue(true);
        const user = userEvent.setup();
        render(<Sales user={SALES_USER_WITH_DELETE} />);
        await waitFor(() => expect(screen.getByText('Cliente Independiente')).toBeInTheDocument());

        const listSalesCallsBefore = vi.mocked(api.listSales).mock.calls.length;
        const statsCallsBefore = vi.mocked(api.getSalesStats).mock.calls.length;

        await user.click(cancelButton());

        await waitFor(() => expect(vi.mocked(api.listSales).mock.calls.length).toBeGreaterThan(listSalesCallsBefore));
        expect(vi.mocked(api.getSalesStats).mock.calls.length).toBeGreaterThan(statsCallsBefore);
    });

    it('14. the control exposes accessible disabled state and an explanatory message in both states', async () => {
        mockListSalesResponse([INDEPENDENT_ITEM]);
        const { unmount } = render(<Sales user={SALES_USER_NO_DELETE} />);
        await waitFor(() => expect(screen.getByText('Cliente Independiente')).toBeInTheDocument());
        const disabledButton = cancelButton();
        expect(disabledButton.disabled).toBe(true);
        expect(disabledButton.getAttribute('aria-disabled')).toBe('true');
        expect(disabledButton.getAttribute('title')).toMatch(/no tienes permiso para cancelar ventas/i);
        unmount();

        vi.clearAllMocks();
        vi.mocked(api.listBranches).mockResolvedValue([{ id: '1', name: 'Branch A', code: 'BRA', address: 'Test Address' }]);
        vi.mocked(api.listProducts).mockResolvedValue([]);
        vi.mocked(api.listLeads).mockResolvedValue([]);
        vi.mocked(api.listPaymentMethods).mockResolvedValue([{ id: 1, name: 'Efectivo' }]);
        vi.mocked(api.listUsers).mockResolvedValue([]);
        vi.mocked(api.getSalesStats).mockResolvedValue(EMPTY_STATS);
        mockListSalesResponse([INDEPENDENT_ITEM]);
        render(<Sales user={SALES_USER_WITH_DELETE} />);
        await waitFor(() => expect(screen.getByText('Cliente Independiente')).toBeInTheDocument());
        const enabledButton = cancelButton();
        expect(enabledButton.disabled).toBe(false);
        expect(enabledButton.getAttribute('aria-disabled')).toBe('false');
        expect(enabledButton.getAttribute('title')).not.toMatch(/no tienes permiso/i);
    });
});
