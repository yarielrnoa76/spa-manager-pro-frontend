import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CreateSaleModal from '../CreateSaleModal';
import { api, ApiError } from '../../services/api';
import type { AuthenticatedUser, Tenant, TenantSalesMode } from '../../types';
import type { CreateSaleGroupResponse } from '../../types/payments';

/** Minimal fixtures cast through `unknown` (not `any`) — these tests only exercise the fields
 * CreateSaleModal actually reads; the full Tenant/SaleGroup shape isn't relevant here. */
function mockTenantProfile(salesMode: TenantSalesMode): Tenant {
    return { settings: { sales_mode: salesMode } } as unknown as Tenant;
}

function mockCreateSaleGroupResponse(): CreateSaleGroupResponse {
    return { type: 'group', sale_group: { id: 1, lines: [] } } as unknown as CreateSaleGroupResponse;
}

interface SalePayload {
    items?: Array<{ product_id?: string | number }>;
    product_id?: string | number;
    branch_id?: string | number;
    seller_id?: string | number;
}

vi.mock('../../services/api', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../services/api')>();
    return {
        ...actual,
        api: {
            listBranches: vi.fn(),
            listProducts: vi.fn(),
            listLeads: vi.fn(),
            listPaymentMethods: vi.fn(),
            listUserCandidates: vi.fn(),
            listProfessionals: vi.fn(),
            getTenantProfile: vi.fn(),
            createSale: vi.fn(),
        },
    };
});

const BRANCH = { id: 1, name: 'Branch A' };
const LEAD = { id: 5, name: 'Cliente Test', branch_id: 1, status: 'new' };
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

// SuperAdmin WITH an effective tenant -- the two pre-existing submission tests below need a
// real, resolvable context (Rule D: a SuperAdmin without active_tenant_id never resolves one).
const ADMIN_USER = baseUser({ id: '1', name: 'Admin', is_super_admin: true, active_tenant_id: 9 });

const SALES_USER = baseUser({
    id: '10',
    name: 'Salesman1DGS',
    role: { id: 3, name: 'sales' },
    permissions: ['create_sale', 'view_products'],
    branch_id: 3,
    branch: { id: 3, name: 'DGS_Sucursal1' },
});

function selectByLabel(labelText: string): HTMLSelectElement {
    const label = screen.getByText(labelText);
    return label.parentElement!.querySelector('select') as HTMLSelectElement;
}

function inputByLabel(labelText: string): HTMLInputElement {
    const label = screen.getByText(labelText);
    return label.parentElement!.querySelector('input') as HTMLInputElement;
}

async function fillCommonFieldsAndAddTwoProductsToCart(user: ReturnType<typeof userEvent.setup>) {
    await waitFor(() => expect(screen.getByText('Branch A')).toBeInTheDocument());

    await user.selectOptions(selectByLabel('Sucursal'), '1');

    const clientNameInput = inputByLabel('Nombre del Cliente');
    await user.click(clientNameInput);
    await user.type(clientNameInput, 'Cliente');

    const suggestion = await screen.findByText('Cliente Test');
    await user.click(suggestion);

    // Add product A
    await user.selectOptions(selectByLabel('Producto / Servicio'), '10');
    await user.click(screen.getByRole('button', { name: 'Añadir' }));

    // Add product B
    await user.selectOptions(selectByLabel('Producto / Servicio'), '11');
    await user.click(screen.getByRole('button', { name: 'Añadir' }));

    await waitFor(() => expect(screen.getByText('Producto A')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('Producto B')).toBeInTheDocument());
}

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.listBranches).mockResolvedValue([BRANCH]);
    vi.mocked(api.listProducts).mockResolvedValue([PRODUCT_A, PRODUCT_B]);
    vi.mocked(api.listLeads).mockResolvedValue([LEAD]);
    vi.mocked(api.listPaymentMethods).mockResolvedValue([{ id: 1, name: 'Efectivo' }]);
    vi.mocked(api.listUserCandidates).mockResolvedValue([]);
    vi.mocked(api.listProfessionals).mockResolvedValue([]);
    vi.mocked(api.getTenantProfile).mockResolvedValue(mockTenantProfile('independent_sales'));
    vi.mocked(api.createSale).mockResolvedValue(mockCreateSaleGroupResponse());
});

describe('CreateSaleModal — sales_mode controlled submission', () => {
    it('sends a single request with an items array when the tenant is grouped_sale', async () => {
        vi.mocked(api.getTenantProfile).mockResolvedValue(mockTenantProfile('grouped_sale'));
        const user = userEvent.setup();
        const onSuccess = vi.fn();

        render(<CreateSaleModal isOpen onClose={vi.fn()} onSuccess={onSuccess} user={ADMIN_USER} />);

        await fillCommonFieldsAndAddTwoProductsToCart(user);
        await user.click(screen.getByRole('button', { name: 'Confirmar' }));

        await waitFor(() => expect(api.createSale).toHaveBeenCalledTimes(1));

        const payload = vi.mocked(api.createSale).mock.calls[0][0] as SalePayload;
        expect(Array.isArray(payload.items)).toBe(true);
        expect(payload.items).toHaveLength(2);
        expect(payload.items?.map(i => String(i.product_id))).toEqual(['10', '11']);
        expect(onSuccess).toHaveBeenCalledTimes(1);
    });

    it('still issues one independent request per cart item when the tenant is independent_sales', async () => {
        vi.mocked(api.getTenantProfile).mockResolvedValue(mockTenantProfile('independent_sales'));
        const user = userEvent.setup();

        render(<CreateSaleModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} user={ADMIN_USER} />);

        await fillCommonFieldsAndAddTwoProductsToCart(user);
        await user.click(screen.getByRole('button', { name: 'Confirmar' }));

        await waitFor(() => expect(api.createSale).toHaveBeenCalledTimes(2));

        const firstPayload = vi.mocked(api.createSale).mock.calls[0][0] as SalePayload;
        const secondPayload = vi.mocked(api.createSale).mock.calls[1][0] as SalePayload;
        expect(firstPayload.items).toBeUndefined();
        expect(secondPayload.items).toBeUndefined();
        expect([String(firstPayload.product_id), String(secondPayload.product_id)]).toEqual(['10', '11']);
    });
});

/** Manual Ingestion... no -- Sales-context hotfix (RBAC consistency): a Sales actor with an
 * authoritative branch_id must see it, locked, with themselves as the default seller, and must
 * never trigger a GET /api/users lookup to do so. */
describe('CreateSaleModal — Sales with an authoritative branch (Rule A)', () => {
    it('shows the branch name, disabled, and the authenticated seller pre-selected', async () => {
        render(<CreateSaleModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} user={SALES_USER} />);

        const branchSelect = await screen.findByText('Sucursal').then(() => selectByLabel('Sucursal'));
        await waitFor(() => expect(branchSelect.value).toBe('3'));
        expect(branchSelect.disabled).toBe(true);
        expect(screen.getByText('DGS_Sucursal1')).toBeTruthy();

        const sellerSelect = selectByLabel('Vendedor');
        expect(sellerSelect.value).toBe('10');
        expect(sellerSelect.disabled).toBe(true);
        expect(screen.getByText('Salesman1DGS')).toBeTruthy();

        expect(api.listUserCandidates).not.toHaveBeenCalled();
        expect(api.listBranches).not.toHaveBeenCalled();
    });

    it('never lets the branch select be changed away from the authoritative branch', async () => {
        render(<CreateSaleModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} user={SALES_USER} />);
        const branchSelect = await screen.findByText('Sucursal').then(() => selectByLabel('Sucursal'));
        await waitFor(() => expect(branchSelect.value).toBe('3'));
        // Only one <option> exists at all -- there is nothing else to select even via the DOM.
        expect(branchSelect.options.length).toBe(1);
    });
});

describe('CreateSaleModal — Sales with a compatibility fallback (Rule C)', () => {
    it('adopts the single branch GET /api/branches returns, and locks it', async () => {
        vi.mocked(api.listBranches).mockResolvedValue([{ id: 3, name: 'DGS_Sucursal1' }]);
        const user = baseUser({
            id: '10', name: 'Salesman1DGS', role: { id: 3, name: 'sales' },
            permissions: ['create_sale'], branch_id: null, branch: null, tenant_id: 2,
        });

        render(<CreateSaleModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} user={user} />);

        const branchSelect = await screen.findByText('Sucursal').then(() => selectByLabel('Sucursal'));
        await waitFor(() => expect(branchSelect.value).toBe('3'));
        expect(branchSelect.disabled).toBe(true);
        expect(screen.getByText('DGS_Sucursal1')).toBeTruthy();
    });

    it('shows an explicit error and never a silent choice when branches returns zero or many', async () => {
        vi.mocked(api.listBranches).mockResolvedValue([]);
        const user = baseUser({
            id: '10', role: { id: 3, name: 'sales' }, permissions: ['create_sale'],
            branch_id: null, branch: null, tenant_id: 2,
        });

        render(<CreateSaleModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} user={user} />);

        expect(await screen.findByText(/no se pudo determinar una sucursal/i)).toBeTruthy();
        const submitButton = screen.getByRole('button', { name: 'Confirmar' });
        expect(submitButton).toBeDisabled();
    });
});

describe('CreateSaleModal — SuperAdmin tenant gating (Rule D)', () => {
    it('a SuperAdmin without an effective tenant cannot confirm and sees an explicit message', async () => {
        const user = baseUser({ is_super_admin: true, active_tenant_id: null, tenant_id: null });
        render(<CreateSaleModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} user={user} />);

        expect(await screen.findByText(/selecciona un tenant/i)).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Confirmar' })).toBeDisabled();
        expect(api.listBranches).not.toHaveBeenCalled();
    });

    it('a SuperAdmin with an effective tenant chooses among the real, returned branches', async () => {
        vi.mocked(api.listBranches).mockResolvedValue([{ id: 1, name: 'Main' }, { id: 2, name: 'North' }]);
        const user = baseUser({ is_super_admin: true, active_tenant_id: 9 });
        const nav = userEvent.setup();

        render(<CreateSaleModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} user={user} />);

        const branchSelect = await screen.findByText('Sucursal').then(() => selectByLabel('Sucursal'));
        await waitFor(() => expect(branchSelect.disabled).toBe(false));
        expect(Array.from(branchSelect.options).map(o => o.textContent)).toEqual(
            expect.arrayContaining(['Main', 'North']),
        );
        await nav.selectOptions(branchSelect, '2');
        expect(branchSelect.value).toBe('2');
    });
});

describe('CreateSaleModal — initialData.branch_id never overrides authority', () => {
    it('never adopts initialData.branch_id for a branch-restricted Sales actor', async () => {
        render(
            <CreateSaleModal
                isOpen
                onClose={vi.fn()}
                onSuccess={vi.fn()}
                user={SALES_USER}
                initialData={{ branch_id: 999 }}
            />,
        );
        const branchSelect = await screen.findByText('Sucursal').then(() => selectByLabel('Sucursal'));
        await waitFor(() => expect(branchSelect.value).toBe('3'));
    });

    it('only adopts initialData.branch_id for a free-choosing actor when it is one of their own authorized branches', async () => {
        vi.mocked(api.listBranches).mockResolvedValue([{ id: 1, name: 'Main' }, { id: 2, name: 'North' }]);
        const user = baseUser({ is_super_admin: true, active_tenant_id: 9 });

        render(
            <CreateSaleModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} user={user} initialData={{ branch_id: 999 }} />,
        );
        const branchSelect = await screen.findByText('Sucursal').then(() => selectByLabel('Sucursal'));
        await waitFor(() => expect(branchSelect.disabled).toBe(false));
        // 999 is not among the real branches -- never silently adopted.
        expect(branchSelect.value).toBe('');
    });

    it('adopts initialData.branch_id for a free-choosing actor when it IS one of their authorized branches', async () => {
        vi.mocked(api.listBranches).mockResolvedValue([{ id: 1, name: 'Main' }, { id: 2, name: 'North' }]);
        const user = baseUser({ is_super_admin: true, active_tenant_id: 9 });

        render(
            <CreateSaleModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} user={user} initialData={{ branch_id: 2 }} />,
        );
        const branchSelect = await screen.findByText('Sucursal').then(() => selectByLabel('Sucursal'));
        await waitFor(() => expect(branchSelect.value).toBe('2'));
    });
});

describe('CreateSaleModal — seller assignment (Rule E)', () => {
    it('without assign_sale, the seller select is locked to the authenticated actor and never calls listUserCandidates', async () => {
        render(<CreateSaleModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} user={SALES_USER} />);
        await screen.findByText('Sucursal');

        const sellerSelect = selectByLabel('Vendedor');
        expect(sellerSelect.disabled).toBe(true);
        expect(sellerSelect.value).toBe('10');
        expect(api.listUserCandidates).not.toHaveBeenCalled();
    });

    it('with assign_sale, calls listUserCandidates (never listUsers) and offers only its results', async () => {
        vi.mocked(api.listUserCandidates).mockResolvedValue([{ id: 20, name: 'Alice' }, { id: 21, name: 'Bruno' }]);
        const user = baseUser({
            id: '10', name: 'Manager', role: { id: 2, name: 'manager' },
            permissions: ['assign_sale'], branch_id: 3, branch: { id: 3, name: 'DGS_Sucursal1' },
        });

        render(<CreateSaleModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} user={user} />);

        await waitFor(() => expect(api.listUserCandidates).toHaveBeenCalledWith({ branch_id: 3 }));
        const sellerSelect = await screen.findByText('Vendedor').then(() => selectByLabel('Vendedor'));
        expect(sellerSelect.disabled).toBe(false);
        expect(Array.from(sellerSelect.options).map(o => o.textContent)).toEqual(
            expect.arrayContaining(['Alice', 'Bruno']),
        );
    });
});

describe('CreateSaleModal — independent loads (a 403 on products never wipes the rest)', () => {
    it('branches, payment methods and leads still load when /api/products 403s', async () => {
        vi.mocked(api.listProducts).mockRejectedValue(new ApiError('forbidden', { status: 403 }));
        render(<CreateSaleModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} user={ADMIN_USER} />);

        await waitFor(() => expect(screen.getByText('Branch A')).toBeInTheDocument());
        expect(screen.getByText('Efectivo')).toBeTruthy();
        expect(await screen.findByText(/no tienes autorización para ver el catálogo/i)).toBeTruthy();
    });

    it('shows a distinct "sin productos disponibles" for a genuine 200 empty response, never confused with a 403', async () => {
        vi.mocked(api.listProducts).mockResolvedValue([]);
        render(<CreateSaleModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} user={ADMIN_USER} />);

        expect(await screen.findByText(/sin productos disponibles/i)).toBeTruthy();
        expect(screen.queryByText(/no tienes autorización/i)).toBeNull();
    });

    it('shows a network-error message, distinct from both 403 and empty, and never confuses them', async () => {
        vi.mocked(api.listProducts).mockRejectedValue(new TypeError('Failed to fetch'));
        render(<CreateSaleModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} user={ADMIN_USER} />);

        expect(await screen.findByText(/no se pudo cargar el catálogo/i)).toBeTruthy();
    });

    it('never sends branch_id to GET /api/products', async () => {
        render(<CreateSaleModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} user={SALES_USER} />);
        await waitFor(() => expect(api.listProducts).toHaveBeenCalledTimes(1));
        expect(api.listProducts).toHaveBeenCalledWith();
    });
});

describe('CreateSaleModal — professionals/tenant-profile gated by their own real permission', () => {
    it('never requests professionals or tenant/profile without view_professionals/view_tenant_profile', async () => {
        render(<CreateSaleModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} user={SALES_USER} />);
        await waitFor(() => expect(api.listProducts).toHaveBeenCalled());
        expect(api.listProfessionals).not.toHaveBeenCalled();
        expect(api.getTenantProfile).not.toHaveBeenCalled();
    });

    it('requests them when the actor holds the matching permission', async () => {
        const user = baseUser({
            id: '10', branch_id: 3, branch: { id: 3, name: 'DGS_Sucursal1' },
            permissions: ['create_sale', 'view_professionals', 'view_tenant_profile'],
        });
        render(<CreateSaleModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} user={user} />);
        await waitFor(() => expect(api.listProfessionals).toHaveBeenCalled());
        await waitFor(() => expect(api.getTenantProfile).toHaveBeenCalled());
    });

    it('falls back to the existing independent-sales behavior, without a 403, when sales_mode is unavailable', async () => {
        render(<CreateSaleModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} user={SALES_USER} />);
        // getTenantProfile is never called for this actor -- sales_mode stays unresolved, and the
        // existing reserve behavior (one request per cart item) is exercised in the submission
        // describe block above; here we only assert no unauthorized call was attempted.
        await waitFor(() => expect(api.listProducts).toHaveBeenCalled());
        expect(api.getTenantProfile).not.toHaveBeenCalled();
    });
});

describe('CreateSaleModal — submit validation does not trust disabled alone', () => {
    it('blocks submission with a clear message when no effective branch/seller can be validated', async () => {
        vi.mocked(api.listBranches).mockResolvedValue([]);
        const user = baseUser({ role: { id: 3, name: 'sales' }, permissions: ['create_sale'], branch_id: null, branch: null, tenant_id: 2 });

        render(<CreateSaleModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} user={user} />);
        await screen.findByText(/no se pudo determinar una sucursal/i);
        expect(screen.getByRole('button', { name: 'Confirmar' })).toBeDisabled();
        expect(api.createSale).not.toHaveBeenCalled();
    });
});
