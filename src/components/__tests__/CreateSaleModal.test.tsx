import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CreateSaleModal from '../CreateSaleModal';
import { api, ApiError } from '../../services/api';
import type { AuthenticatedUser, SaleCreateContext } from '../../types';
import type { CreateSaleGroupResponse, CreateSaleBatchResponse } from '../../types/payments';

/**
 * Capability-driven sale context microcorrection, extended by "fix: honor tenant sale mode
 * consistently": CreateSaleModal consumes `useEffectiveSaleContext`, a thin client over
 * `GET /api/sales/create-context` -- `sales_mode` now travels on that SAME response, relayed
 * verbatim. This component never calls `getTenantProfile()` for any reason, never reads
 * `view_tenant_profile`, and always sends exactly ONE `POST /api/sales` with every cart item in
 * `items`, regardless of `sales_mode` or the actor's permissions -- the backend alone decides how
 * to persist it and which response shape (`type: 'group'` / `type: 'batch'`) to return.
 */

function mockCreateSaleGroupResponse(): CreateSaleGroupResponse {
    return { type: 'group', sale_group: { id: 1, lines: [] } } as unknown as CreateSaleGroupResponse;
}

function mockCreateSaleBatchResponse(): CreateSaleBatchResponse {
    return { type: 'batch', sales: [] };
}

interface SalePayload {
    items?: Array<{ product_id?: string | number }>;
    product_id?: string | number;
    branch_id?: number | null;
    seller_id?: string | number;
    sales_mode?: unknown;
}

vi.mock('../../services/api', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../services/api')>();
    return {
        ...actual,
        api: {
            getSaleCreateContext: vi.fn(),
            listProducts: vi.fn(),
            listLeads: vi.fn(),
            listPaymentMethods: vi.fn(),
            listUsers: vi.fn(),
            listUserCandidates: vi.fn(),
            listBranches: vi.fn(),
            listProfessionals: vi.fn(),
            getTenantProfile: vi.fn(),
            createSale: vi.fn(),
        },
    };
});

const LEAD = { id: 5, name: 'Cliente Test', branch_id: 3, status: 'new' };
const PRODUCT_A = { id: 10, name: 'Producto A', sales_price: 20, stock: 5, type: 'product' };
const PRODUCT_B = { id: 11, name: 'Producto B', sales_price: 15, stock: 5, type: 'product' };

const baseUser = (overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser => ({
    id: '1',
    name: 'Test User',
    email: 'test@example.com',
    tenant_id: 2,
    active_tenant_id: null,
    is_super_admin: false,
    branch_id: null,
    branch: null,
    role: { id: 1, name: 'user' },
    permissions: [],
    ...overrides,
});

function ctx(overrides: Partial<SaleCreateContext> = {}): SaleCreateContext {
    return {
        can_create_sale: true,
        sales_scope: 'branch',
        context_ready: true,
        blocking_code: null,
        effective_branch: { id: 3, name: 'DGS_Sucursal1' },
        can_select_branch: false,
        available_branches: [],
        default_seller: { id: 1, name: 'Test User' },
        can_assign_other_seller: false,
        seller_candidates: [],
        can_view_products: true,
        sales_mode: 'grouped_sale',
        ...overrides,
    };
}

const ADMIN_USER = baseUser({ id: '1', name: 'Admin', is_super_admin: true, active_tenant_id: 9 });

function selectByLabel(labelText: string): HTMLSelectElement {
    const label = screen.getByText(labelText);
    return label.parentElement!.querySelector('select') as HTMLSelectElement;
}

function inputByLabel(labelText: string): HTMLInputElement {
    const label = screen.getByText(labelText);
    return label.parentElement!.querySelector('input') as HTMLInputElement;
}

async function fillCommonFields(user: ReturnType<typeof userEvent.setup>) {
    await waitFor(() => expect(screen.getByText('DGS_Sucursal1')).toBeInTheDocument());

    const clientNameInput = inputByLabel('Nombre del Cliente');
    await user.click(clientNameInput);
    await user.type(clientNameInput, 'Cliente');

    const suggestion = await screen.findByText('Cliente Test');
    await user.click(suggestion);
}

async function fillCommonFieldsAndAddOneProductToCart(user: ReturnType<typeof userEvent.setup>) {
    await fillCommonFields(user);
    await user.selectOptions(selectByLabel('Producto / Servicio'), '10');
    await user.click(screen.getByRole('button', { name: 'Añadir' }));
    await waitFor(() => expect(screen.getByText('Producto A')).toBeInTheDocument());
}

async function fillCommonFieldsAndAddTwoProductsToCart(user: ReturnType<typeof userEvent.setup>) {
    await fillCommonFields(user);

    await user.selectOptions(selectByLabel('Producto / Servicio'), '10');
    await user.click(screen.getByRole('button', { name: 'Añadir' }));

    await user.selectOptions(selectByLabel('Producto / Servicio'), '11');
    await user.click(screen.getByRole('button', { name: 'Añadir' }));

    await waitFor(() => expect(screen.getByText('Producto A')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('Producto B')).toBeInTheDocument());
}

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.getSaleCreateContext).mockResolvedValue(ctx());
    vi.mocked(api.listProducts).mockResolvedValue([PRODUCT_A, PRODUCT_B]);
    vi.mocked(api.listLeads).mockResolvedValue([LEAD]);
    vi.mocked(api.listPaymentMethods).mockResolvedValue([{ id: 1, name: 'Efectivo' }]);
    vi.mocked(api.listProfessionals).mockResolvedValue([]);
    vi.mocked(api.createSale).mockResolvedValue(mockCreateSaleGroupResponse());
});

describe('CreateSaleModal — unified submission: always ONE POST with items, regardless of sales_mode', () => {
    it('7. grouped_sale with exactly one cart line: a single call with items (length 1)', async () => {
        vi.mocked(api.getSaleCreateContext).mockResolvedValue(ctx({ sales_mode: 'grouped_sale' }));
        const user = userEvent.setup();
        const onSuccess = vi.fn();

        render(<CreateSaleModal isOpen onClose={vi.fn()} onSuccess={onSuccess} user={ADMIN_USER} />);
        await fillCommonFieldsAndAddOneProductToCart(user);
        await user.click(screen.getByRole('button', { name: 'Confirmar' }));

        await waitFor(() => expect(api.createSale).toHaveBeenCalledTimes(1));
        const payload = vi.mocked(api.createSale).mock.calls[0][0] as SalePayload;
        expect(payload.items).toHaveLength(1);
        expect(payload.items?.map(i => String(i.product_id))).toEqual(['10']);
        expect(onSuccess).toHaveBeenCalledTimes(1);
    });

    it('8. grouped_sale with two cart lines: a single call with both items', async () => {
        vi.mocked(api.getSaleCreateContext).mockResolvedValue(ctx({ sales_mode: 'grouped_sale' }));
        const user = userEvent.setup();

        render(<CreateSaleModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} user={ADMIN_USER} />);
        await fillCommonFieldsAndAddTwoProductsToCart(user);
        await user.click(screen.getByRole('button', { name: 'Confirmar' }));

        await waitFor(() => expect(api.createSale).toHaveBeenCalledTimes(1));
        const payload = vi.mocked(api.createSale).mock.calls[0][0] as SalePayload;
        expect(payload.items).toHaveLength(2);
        expect(payload.items?.map(i => String(i.product_id))).toEqual(['10', '11']);
        expect(payload.branch_id).toBe(3);
    });

    it('9. independent_sales with exactly one cart line: a single call with items (length 1) -- NEVER a bare single-item payload', async () => {
        vi.mocked(api.getSaleCreateContext).mockResolvedValue(ctx({ sales_mode: 'independent_sales' }));
        const user = userEvent.setup();

        render(<CreateSaleModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} user={ADMIN_USER} />);
        await fillCommonFieldsAndAddOneProductToCart(user);
        await user.click(screen.getByRole('button', { name: 'Confirmar' }));

        await waitFor(() => expect(api.createSale).toHaveBeenCalledTimes(1));
        const payload = vi.mocked(api.createSale).mock.calls[0][0] as SalePayload;
        expect(payload.items).toHaveLength(1);
        expect(payload.product_id).toBeUndefined();
    });

    it('10. independent_sales with two cart lines: a single call with ALL items -- never N separate requests', async () => {
        vi.mocked(api.getSaleCreateContext).mockResolvedValue(ctx({ sales_mode: 'independent_sales' }));
        const user = userEvent.setup();

        render(<CreateSaleModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} user={ADMIN_USER} />);
        await fillCommonFieldsAndAddTwoProductsToCart(user);
        await user.click(screen.getByRole('button', { name: 'Confirmar' }));

        await waitFor(() => expect(api.createSale).toHaveBeenCalledTimes(1));
        const payload = vi.mocked(api.createSale).mock.calls[0][0] as SalePayload;
        expect(payload.items).toHaveLength(2);
        expect(payload.items?.map(i => String(i.product_id))).toEqual(['10', '11']);
    });

    it('11. never issues N POSTs for either mode -- exactly one call each time', async () => {
        for (const mode of ['grouped_sale', 'independent_sales'] as const) {
            vi.clearAllMocks();
            vi.mocked(api.getSaleCreateContext).mockResolvedValue(ctx({ sales_mode: mode }));
            vi.mocked(api.listProducts).mockResolvedValue([PRODUCT_A, PRODUCT_B]);
            vi.mocked(api.listLeads).mockResolvedValue([LEAD]);
            vi.mocked(api.listPaymentMethods).mockResolvedValue([{ id: 1, name: 'Efectivo' }]);
            vi.mocked(api.createSale).mockResolvedValue(mockCreateSaleGroupResponse());
            const user = userEvent.setup();
            const { unmount } = render(<CreateSaleModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} user={ADMIN_USER} />);

            await fillCommonFieldsAndAddTwoProductsToCart(user);
            await user.click(screen.getByRole('button', { name: 'Confirmar' }));

            await waitFor(() => expect(api.createSale).toHaveBeenCalledTimes(1));
            unmount();
        }
    });

    it('12. never sends sales_mode in the payload, for either mode', async () => {
        for (const mode of ['grouped_sale', 'independent_sales'] as const) {
            vi.clearAllMocks();
            vi.mocked(api.getSaleCreateContext).mockResolvedValue(ctx({ sales_mode: mode }));
            vi.mocked(api.listProducts).mockResolvedValue([PRODUCT_A, PRODUCT_B]);
            vi.mocked(api.listLeads).mockResolvedValue([LEAD]);
            vi.mocked(api.listPaymentMethods).mockResolvedValue([{ id: 1, name: 'Efectivo' }]);
            vi.mocked(api.createSale).mockResolvedValue(mockCreateSaleGroupResponse());
            const user = userEvent.setup();
            const { unmount } = render(<CreateSaleModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} user={ADMIN_USER} />);

            await fillCommonFieldsAndAddOneProductToCart(user);
            await user.click(screen.getByRole('button', { name: 'Confirmar' }));

            await waitFor(() => expect(api.createSale).toHaveBeenCalledTimes(1));
            const payload = vi.mocked(api.createSale).mock.calls[0][0] as SalePayload;
            expect(payload.sales_mode).toBeUndefined();
            expect(Object.prototype.hasOwnProperty.call(payload, 'sales_mode')).toBe(false);
            unmount();
        }
    });

    it('14a. a type:"group" response is handled as a normal success', async () => {
        vi.mocked(api.createSale).mockResolvedValue(mockCreateSaleGroupResponse());
        const user = userEvent.setup();
        const onSuccess = vi.fn();
        const onClose = vi.fn();
        render(<CreateSaleModal isOpen onClose={onClose} onSuccess={onSuccess} user={ADMIN_USER} />);

        await fillCommonFieldsAndAddOneProductToCart(user);
        await user.click(screen.getByRole('button', { name: 'Confirmar' }));

        await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('14b. a type:"batch" response is handled as a normal success', async () => {
        vi.mocked(api.createSale).mockResolvedValue(mockCreateSaleBatchResponse());
        const user = userEvent.setup();
        const onSuccess = vi.fn();
        const onClose = vi.fn();
        render(<CreateSaleModal isOpen onClose={onClose} onSuccess={onSuccess} user={ADMIN_USER} />);

        await fillCommonFieldsAndAddOneProductToCart(user);
        await user.click(screen.getByRole('button', { name: 'Confirmar' }));

        await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('a failure during submission produces a single, visible error -- and never a partial success', async () => {
        vi.mocked(api.createSale).mockRejectedValue(new ApiError('Stock insuficiente'));
        const user = userEvent.setup();
        const onSuccess = vi.fn();
        render(<CreateSaleModal isOpen onClose={vi.fn()} onSuccess={onSuccess} user={ADMIN_USER} />);

        await fillCommonFieldsAndAddOneProductToCart(user);
        await user.click(screen.getByRole('button', { name: 'Confirmar' }));

        expect(await screen.findByText('Stock insuficiente')).toBeTruthy();
        expect(api.createSale).toHaveBeenCalledTimes(1);
        expect(onSuccess).not.toHaveBeenCalled();
    });
});

describe('CreateSaleModal — never performs the administrative calls this hotfix removes', () => {
    it('never calls listBranches, listUsers or listUserCandidates -- everything comes from create-context', async () => {
        render(<CreateSaleModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} user={ADMIN_USER} />);
        await waitFor(() => expect(api.getSaleCreateContext).toHaveBeenCalled());
        expect(api.listBranches).not.toHaveBeenCalled();
        expect(api.listUsers).not.toHaveBeenCalled();
        expect(api.listUserCandidates).not.toHaveBeenCalled();
    });

    it('requests create-context with no branch_id on the initial render', async () => {
        render(<CreateSaleModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} user={ADMIN_USER} />);
        await waitFor(() => expect(api.getSaleCreateContext).toHaveBeenCalledWith(undefined));
    });
});

describe('CreateSaleModal — branch: locked vs free selection, entirely backend-driven', () => {
    it('shows the branch name, disabled, when can_select_branch=false', async () => {
        render(<CreateSaleModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} user={baseUser({ id: '10', name: 'Salesman1DGS' })} />);
        const branchSelect = await screen.findByText('Sucursal').then(() => selectByLabel('Sucursal'));
        await waitFor(() => expect(branchSelect.value).toBe('3'));
        expect(branchSelect.disabled).toBe(true);
        expect(branchSelect.options.length).toBe(1);
    });

    it('offers the real available_branches, enabled, when can_select_branch=true', async () => {
        vi.mocked(api.getSaleCreateContext).mockResolvedValue(
            ctx({ can_select_branch: true, effective_branch: null, context_ready: false, available_branches: [{ id: 1, name: 'Main' }, { id: 2, name: 'North' }] }),
        );
        render(<CreateSaleModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} user={ADMIN_USER} />);
        const branchSelect = await screen.findByText('Sucursal').then(() => selectByLabel('Sucursal'));
        await waitFor(() => expect(branchSelect.disabled).toBe(false));
        expect(Array.from(branchSelect.options).map(o => o.textContent)).toEqual(
            expect.arrayContaining(['Main', 'North']),
        );
    });

    it('changing the branch selection re-requests create-context with that branch_id, never adopting it locally first', async () => {
        vi.mocked(api.getSaleCreateContext).mockResolvedValueOnce(
            ctx({ can_select_branch: true, effective_branch: null, context_ready: false, available_branches: [{ id: 1, name: 'Main' }, { id: 2, name: 'North' }] }),
        );
        const user = userEvent.setup();
        render(<CreateSaleModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} user={ADMIN_USER} />);
        const branchSelect = await screen.findByText('Sucursal').then(() => selectByLabel('Sucursal'));
        await waitFor(() => expect(branchSelect.disabled).toBe(false));

        vi.mocked(api.getSaleCreateContext).mockResolvedValueOnce(
            ctx({ can_select_branch: true, effective_branch: { id: 2, name: 'North' }, context_ready: true, available_branches: [{ id: 1, name: 'Main' }, { id: 2, name: 'North' }] }),
        );
        await user.selectOptions(branchSelect, '2');

        await waitFor(() => expect(api.getSaleCreateContext).toHaveBeenLastCalledWith(2));
        await waitFor(() => expect(branchSelect.value).toBe('2'));
    });

    it('a stale seller selection that is no longer among the recomputed seller_candidates is cleared back to the default seller', async () => {
        vi.mocked(api.getSaleCreateContext).mockResolvedValueOnce(
            ctx({
                can_select_branch: true, effective_branch: { id: 1, name: 'Main' }, context_ready: true,
                available_branches: [{ id: 1, name: 'Main' }, { id: 2, name: 'North' }],
                can_assign_other_seller: true, seller_candidates: [{ id: 20, name: 'Alice' }],
            }),
        );
        const user = userEvent.setup();
        render(<CreateSaleModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} user={ADMIN_USER} />);
        const sellerSelect = await screen.findByText('Vendedor').then(() => selectByLabel('Vendedor'));
        await waitFor(() => expect(sellerSelect.disabled).toBe(false));
        await user.selectOptions(sellerSelect, '20');
        expect(sellerSelect.value).toBe('20');

        const branchSelect = selectByLabel('Sucursal');
        vi.mocked(api.getSaleCreateContext).mockResolvedValueOnce(
            ctx({
                can_select_branch: true, effective_branch: { id: 2, name: 'North' }, context_ready: true,
                available_branches: [{ id: 1, name: 'Main' }, { id: 2, name: 'North' }],
                can_assign_other_seller: true, seller_candidates: [{ id: 21, name: 'Bruno' }],
            }),
        );
        await user.selectOptions(branchSelect, '2');

        await waitFor(() => expect(sellerSelect.value).toBe('1')); // back to the default seller (id 1)
        expect(sellerSelect.value).not.toBe('20');
    });
});

describe('CreateSaleModal — seller: default always visible; another seller only with can_assign_other_seller', () => {
    it('without can_assign_other_seller, the seller select is locked to the backend default_seller', async () => {
        render(<CreateSaleModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} user={baseUser({ id: '10' })} />);
        await screen.findByText('Sucursal');
        const sellerSelect = selectByLabel('Vendedor');
        expect(sellerSelect.disabled).toBe(true);
        expect(sellerSelect.value).toBe('1');
        expect(screen.getByText('Test User')).toBeTruthy();
    });

    it('with can_assign_other_seller, only seller_candidates from create-context populate the select', async () => {
        vi.mocked(api.getSaleCreateContext).mockResolvedValue(
            ctx({ can_assign_other_seller: true, seller_candidates: [{ id: 20, name: 'Alice' }, { id: 21, name: 'Bruno' }] }),
        );
        render(<CreateSaleModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} user={ADMIN_USER} />);
        const sellerSelect = await screen.findByText('Vendedor').then(() => selectByLabel('Vendedor'));
        expect(sellerSelect.disabled).toBe(false);
        expect(Array.from(sellerSelect.options).map(o => o.textContent)).toEqual(
            expect.arrayContaining(['Alice', 'Bruno']),
        );
    });
});

describe('CreateSaleModal — products: gated exclusively by can_view_products from create-context', () => {
    it('never calls listProducts and shows an explicit block when can_view_products=false', async () => {
        vi.mocked(api.getSaleCreateContext).mockResolvedValue(ctx({ can_view_products: false }));
        render(<CreateSaleModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} user={ADMIN_USER} />);

        expect(await screen.findByText(/catálogo de productos no está disponible/i)).toBeTruthy();
        expect(api.listProducts).not.toHaveBeenCalled();
    });

    it('a 403 despite can_view_products=true is shown as forbidden, distinct from the blocked state', async () => {
        vi.mocked(api.listProducts).mockRejectedValue(new ApiError('forbidden', { status: 403 }));
        render(<CreateSaleModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} user={ADMIN_USER} />);
        expect(await screen.findByText(/no tienes autorización para ver el catálogo/i)).toBeTruthy();
    });

    it('a 403 on products never collapses branches, payment methods or leads', async () => {
        vi.mocked(api.listProducts).mockRejectedValue(new ApiError('forbidden', { status: 403 }));
        render(<CreateSaleModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} user={ADMIN_USER} />);

        await waitFor(() => expect(screen.getByText('DGS_Sucursal1')).toBeInTheDocument());
        expect(screen.getByText('Efectivo')).toBeTruthy();
        expect(await screen.findByText(/no tienes autorización para ver el catálogo/i)).toBeTruthy();
    });

    it('a genuine 200 empty response shows "sin productos disponibles", never confused with forbidden or blocked', async () => {
        vi.mocked(api.listProducts).mockResolvedValue([]);
        render(<CreateSaleModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} user={ADMIN_USER} />);
        expect(await screen.findByText(/sin productos disponibles/i)).toBeTruthy();
        expect(screen.queryByText(/no tienes autorización/i)).toBeNull();
        expect(screen.queryByText(/no está disponible para tu cuenta/i)).toBeNull();
    });

    it('a network error shows a distinct message from both forbidden and empty', async () => {
        vi.mocked(api.listProducts).mockRejectedValue(new TypeError('Failed to fetch'));
        render(<CreateSaleModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} user={ADMIN_USER} />);
        expect(await screen.findByText(/no se pudo cargar el catálogo/i)).toBeTruthy();
    });

    it('never sends branch_id to GET /api/products', async () => {
        render(<CreateSaleModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} user={baseUser({ id: '10' })} />);
        await waitFor(() => expect(api.listProducts).toHaveBeenCalledTimes(1));
        expect(api.listProducts).toHaveBeenCalledWith();
    });
});

describe('CreateSaleModal — professionals still gated by its own real permission', () => {
    it('never requests professionals without the matching permission', async () => {
        render(<CreateSaleModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} user={baseUser({ id: '10', permissions: [] })} />);
        await waitFor(() => expect(api.listProducts).toHaveBeenCalled());
        expect(api.listProfessionals).not.toHaveBeenCalled();
    });

    it('requests professionals when the actor holds view_professionals', async () => {
        const user = baseUser({ id: '10', permissions: ['view_professionals'] });
        render(<CreateSaleModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} user={user} />);
        await waitFor(() => expect(api.listProfessionals).toHaveBeenCalled());
    });
});

describe('CreateSaleModal — sales_mode: fail-closed, never getTenantProfile, never view_tenant_profile, never role.name', () => {
    it('3. context_ready=true but sales_mode=null blocks Confirm with a context error, never a silent independent_sales guess', async () => {
        vi.mocked(api.getSaleCreateContext).mockResolvedValue(ctx({ context_ready: true, sales_mode: null }));
        render(<CreateSaleModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} user={ADMIN_USER} />);

        expect(await screen.findByText(/no se pudo determinar la modalidad de venta/i)).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Confirmar' })).toBeDisabled();
        expect(api.createSale).not.toHaveBeenCalled();
    });

    it('3b. context_ready=true but sales_mode is an unrecognized value also blocks Confirm', async () => {
        vi.mocked(api.getSaleCreateContext).mockResolvedValue(
            ctx({ context_ready: true, sales_mode: 'some_future_mode' as unknown as 'grouped_sale' }),
        );
        render(<CreateSaleModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} user={ADMIN_USER} />);

        expect(await screen.findByText(/no se pudo determinar la modalidad de venta/i)).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Confirmar' })).toBeDisabled();
    });

    it('4. never calls getTenantProfile, under any permission combination', async () => {
        const user = baseUser({ id: '10', permissions: ['view_tenant_profile', 'view_professionals', 'view_leads'], is_super_admin: false });
        render(<CreateSaleModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} user={user} />);
        await waitFor(() => expect(api.getSaleCreateContext).toHaveBeenCalled());
        await fillCommonFieldsAndAddOneProductToCart(userEvent.setup());
        expect(api.getTenantProfile).not.toHaveBeenCalled();
    });

    it('5. an actor WITHOUT view_tenant_profile still submits correctly under grouped_sale -- no dependence on that permission at all', async () => {
        vi.mocked(api.getSaleCreateContext).mockResolvedValue(ctx({ sales_mode: 'grouped_sale' }));
        const user = baseUser({ id: '10', permissions: ['view_leads'] }); // explicitly no view_tenant_profile
        const uEvent = userEvent.setup();
        render(<CreateSaleModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} user={user} />);

        await fillCommonFieldsAndAddTwoProductsToCart(uEvent);
        await uEvent.click(screen.getByRole('button', { name: 'Confirmar' }));

        await waitFor(() => expect(api.createSale).toHaveBeenCalledTimes(1));
        const payload = vi.mocked(api.createSale).mock.calls[0][0] as SalePayload;
        expect(payload.items).toHaveLength(2);
        expect(api.getTenantProfile).not.toHaveBeenCalled();
    });

    it('6. two roles with different names but the identical backend context submit the identical payload shape', async () => {
        vi.mocked(api.getSaleCreateContext).mockResolvedValue(ctx({ sales_mode: 'independent_sales' }));

        const userA = baseUser({ id: '10', role: { id: 1, name: 'coordinador_regional' }, permissions: ['view_leads'] });
        const u1 = userEvent.setup();
        const { unmount } = render(<CreateSaleModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} user={userA} />);
        await fillCommonFieldsAndAddOneProductToCart(u1);
        await u1.click(screen.getByRole('button', { name: 'Confirmar' }));
        await waitFor(() => expect(api.createSale).toHaveBeenCalledTimes(1));
        const payloadA = vi.mocked(api.createSale).mock.calls[0][0] as SalePayload;
        unmount();

        vi.clearAllMocks();
        vi.mocked(api.getSaleCreateContext).mockResolvedValue(ctx({ sales_mode: 'independent_sales' }));
        vi.mocked(api.listProducts).mockResolvedValue([PRODUCT_A, PRODUCT_B]);
        vi.mocked(api.listLeads).mockResolvedValue([LEAD]);
        vi.mocked(api.listPaymentMethods).mockResolvedValue([{ id: 1, name: 'Efectivo' }]);
        vi.mocked(api.createSale).mockResolvedValue(mockCreateSaleGroupResponse());

        const userB = baseUser({ id: '10', role: { id: 2, name: 'otro_rol_cualquiera' }, permissions: ['view_leads'] });
        const u2 = userEvent.setup();
        render(<CreateSaleModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} user={userB} />);
        await fillCommonFieldsAndAddOneProductToCart(u2);
        await u2.click(screen.getByRole('button', { name: 'Confirmar' }));
        await waitFor(() => expect(api.createSale).toHaveBeenCalledTimes(1));
        const payloadB = vi.mocked(api.createSale).mock.calls[0][0] as SalePayload;

        expect(Array.isArray(payloadA.items)).toBe(Array.isArray(payloadB.items));
        expect(payloadA.items).toHaveLength(payloadB.items?.length ?? -1);
    });
});

describe('CreateSaleModal — context_ready gates Confirm; disabled attributes are never the real boundary', () => {
    it('Confirm stays disabled while context_ready=false, with the backend blocking message shown', async () => {
        vi.mocked(api.getSaleCreateContext).mockResolvedValue(
            ctx({ can_create_sale: false, context_ready: false, effective_branch: null, blocking_code: 'CREATE_SALE_DENIED' }),
        );
        render(<CreateSaleModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} user={baseUser({ id: '10' })} />);
        await screen.findByText(/no tienes permiso para crear ventas/i);
        expect(screen.getByRole('button', { name: 'Confirmar' })).toBeDisabled();
        expect(api.createSale).not.toHaveBeenCalled();
    });

    it('a SuperAdmin without an effective tenant (TENANT_REQUIRED) leaves Confirm disabled', async () => {
        vi.mocked(api.getSaleCreateContext).mockResolvedValue(
            ctx({ can_create_sale: false, context_ready: false, effective_branch: null, blocking_code: 'TENANT_REQUIRED' }),
        );
        const user = baseUser({ is_super_admin: true, active_tenant_id: null });
        render(<CreateSaleModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} user={user} />);
        await screen.findByText(/selecciona un tenant/i);
        expect(screen.getByRole('button', { name: 'Confirmar' })).toBeDisabled();
    });

    it('a 403 from create-context itself leaves Confirm disabled and grants nothing', async () => {
        vi.mocked(api.getSaleCreateContext).mockRejectedValue(new ApiError('forbidden', { status: 403 }));
        render(<CreateSaleModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} user={baseUser({ id: '10' })} />);
        await waitFor(() => expect(screen.getByRole('button', { name: 'Confirmar' })).toBeDisabled());
        expect(api.listProducts).not.toHaveBeenCalled();
        expect(api.createSale).not.toHaveBeenCalled();
    });

    it('create-context down (network error) leaves Confirm disabled and shows a safe message', async () => {
        vi.mocked(api.getSaleCreateContext).mockRejectedValue(new TypeError('Failed to fetch'));
        render(<CreateSaleModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} user={baseUser({ id: '10' })} />);
        expect(await screen.findByText(/no se pudo verificar tu contexto de venta/i)).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Confirmar' })).toBeDisabled();
    });
});

describe('CreateSaleModal — initialData.branch_id (a lead\'s own branch) is only ever a hint the backend must validate', () => {
    it('the FIRST create-context request never includes initialData.branch_id, even when supplied', async () => {
        render(
            <CreateSaleModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} user={ADMIN_USER} initialData={{ branch_id: 7 }} />,
        );
        await waitFor(() => expect(api.getSaleCreateContext).toHaveBeenNthCalledWith(1, undefined));
    });

    it('a branch-restricted actor opening a lead from a DIFFERENT branch still uses their own authoritative branch -- never blocked, never a second request', async () => {
        // The exact bug this microcorrection closes: a seller fixed to branch 3 opening a lead
        // visible in branch 4 must never see EFFECTIVE_BRANCH_INVALID or any block.
        render(
            <CreateSaleModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} user={baseUser({ id: '10' })} initialData={{ branch_id: 4 }} />,
        );
        const branchSelect = await screen.findByText('Sucursal').then(() => selectByLabel('Sucursal'));
        await waitFor(() => expect(branchSelect.value).toBe('3'));
        expect(branchSelect.disabled).toBe(true);
        expect(api.getSaleCreateContext).toHaveBeenCalledTimes(1);
        expect(screen.queryByText(/no válida|inválida|no se pudo/i)).toBeNull();
    });

    it('a free-choosing actor with an AUTHORIZED initialData.branch_id: two requests, only the validated response is shown', async () => {
        vi.mocked(api.getSaleCreateContext).mockResolvedValueOnce(
            ctx({ can_select_branch: true, effective_branch: null, context_ready: false, available_branches: [{ id: 1, name: 'Main' }, { id: 4, name: 'Sucursal Norte' }] }),
        );
        vi.mocked(api.getSaleCreateContext).mockResolvedValueOnce(
            ctx({ can_select_branch: true, effective_branch: { id: 4, name: 'Sucursal Norte' }, context_ready: true, available_branches: [{ id: 1, name: 'Main' }, { id: 4, name: 'Sucursal Norte' }] }),
        );
        render(
            <CreateSaleModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} user={ADMIN_USER} initialData={{ branch_id: 4 }} />,
        );

        await waitFor(() => expect(api.getSaleCreateContext).toHaveBeenNthCalledWith(1, undefined));
        await waitFor(() => expect(api.getSaleCreateContext).toHaveBeenNthCalledWith(2, 4));
        const branchSelect = await screen.findByText('Sucursal').then(() => selectByLabel('Sucursal'));
        await waitFor(() => expect(branchSelect.value).toBe('4'));
    });

    it('a free-choosing actor with an UNAUTHORIZED initialData.branch_id: no second request, selection still required', async () => {
        vi.mocked(api.getSaleCreateContext).mockResolvedValue(
            ctx({ can_select_branch: true, effective_branch: null, context_ready: false, available_branches: [{ id: 1, name: 'Main' }, { id: 2, name: 'North' }] }),
        );
        render(
            <CreateSaleModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} user={ADMIN_USER} initialData={{ branch_id: 999 }} />,
        );
        const branchSelect = await screen.findByText('Sucursal').then(() => selectByLabel('Sucursal'));
        await waitFor(() => expect(branchSelect.disabled).toBe(false));
        expect(api.getSaleCreateContext).toHaveBeenCalledTimes(1);
        expect(branchSelect.value).toBe('');
        expect(screen.getByRole('button', { name: 'Confirmar' })).toBeDisabled();
    });
});

describe('CreateSaleModal — Ventas Diarias and venta desde Lead share the identical context', () => {
    it('the same user and the same backend response render the same effective branch/seller whether or not initialData is supplied', async () => {
        const user = baseUser({ id: '10' });
        const { unmount } = render(<CreateSaleModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} user={user} />);
        await waitFor(() => expect(screen.getByText('DGS_Sucursal1')).toBeInTheDocument());
        const dailySellerValue = selectByLabel('Vendedor').value;
        unmount();

        vi.clearAllMocks();
        vi.mocked(api.getSaleCreateContext).mockResolvedValue(ctx());
        vi.mocked(api.listProducts).mockResolvedValue([PRODUCT_A, PRODUCT_B]);
        vi.mocked(api.listLeads).mockResolvedValue([LEAD]);
        vi.mocked(api.listPaymentMethods).mockResolvedValue([{ id: 1, name: 'Efectivo' }]);

        render(
            <CreateSaleModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} user={user} initialData={{ lead_id: 5, client_name: 'Cliente Test', branch_id: 3 }} />,
        );
        await waitFor(() => expect(screen.getByText('DGS_Sucursal1')).toBeInTheDocument());
        const fromLeadSellerValue = selectByLabel('Vendedor').value;

        expect(fromLeadSellerValue).toBe(dailySellerValue);
        expect(selectByLabel('Sucursal').value).toBe('3');
    });

    it('13. submitting from Ventas Diarias (no initialData) and from a Lead (with initialData) sends the identical payload shape', async () => {
        vi.mocked(api.getSaleCreateContext).mockResolvedValue(ctx({ sales_mode: 'independent_sales' }));
        const user = baseUser({ id: '10', permissions: ['view_leads'] });

        const u1 = userEvent.setup();
        const { unmount } = render(<CreateSaleModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} user={user} />);
        await fillCommonFieldsAndAddOneProductToCart(u1);
        await u1.click(screen.getByRole('button', { name: 'Confirmar' }));
        await waitFor(() => expect(api.createSale).toHaveBeenCalledTimes(1));
        const dailyPayload = vi.mocked(api.createSale).mock.calls[0][0] as SalePayload;
        unmount();

        vi.clearAllMocks();
        vi.mocked(api.getSaleCreateContext).mockResolvedValue(ctx({ sales_mode: 'independent_sales' }));
        vi.mocked(api.listProducts).mockResolvedValue([PRODUCT_A, PRODUCT_B]);
        vi.mocked(api.listPaymentMethods).mockResolvedValue([{ id: 1, name: 'Efectivo' }]);
        vi.mocked(api.createSale).mockResolvedValue(mockCreateSaleGroupResponse());

        const u2 = userEvent.setup();
        render(
            <CreateSaleModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} user={user} initialData={{ lead_id: 5, client_name: 'Cliente Test', branch_id: 3 }} />,
        );
        await waitFor(() => expect(screen.getByText('DGS_Sucursal1')).toBeInTheDocument());
        await u2.selectOptions(selectByLabel('Producto / Servicio'), '10');
        await u2.click(screen.getByRole('button', { name: 'Añadir' }));
        await u2.click(screen.getByRole('button', { name: 'Confirmar' }));
        await waitFor(() => expect(api.createSale).toHaveBeenCalledTimes(1));
        const fromLeadPayload = vi.mocked(api.createSale).mock.calls[0][0] as SalePayload;

        // Same shape (an `items` array of the same length) -- the only legitimate differences
        // are the entrypoint-specific data itself (lead_id/client_name), never the format.
        expect(Array.isArray(dailyPayload.items)).toBe(true);
        expect(Array.isArray(fromLeadPayload.items)).toBe(true);
        expect(dailyPayload.items).toHaveLength(1);
        expect(fromLeadPayload.items).toHaveLength(1);
        expect(dailyPayload.product_id).toBeUndefined();
        expect(fromLeadPayload.product_id).toBeUndefined();
    });
});
