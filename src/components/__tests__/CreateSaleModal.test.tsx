import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CreateSaleModal from '../CreateSaleModal';
import { api } from '../../services/api';

vi.mock('../../services/api', () => ({
    api: {
        listBranches: vi.fn(),
        listProducts: vi.fn(),
        listLeads: vi.fn(),
        listPaymentMethods: vi.fn(),
        listUsers: vi.fn(),
        listProfessionals: vi.fn(),
        getTenantProfile: vi.fn(),
        createSale: vi.fn(),
    },
}));

const BRANCH = { id: 1, name: 'Branch A' };
const LEAD = { id: 5, name: 'Cliente Test', branch_id: 1, status: 'new' };
const PRODUCT_A = { id: 10, name: 'Producto A', sales_price: 20, stock: 5, type: 'product' };
const PRODUCT_B = { id: 11, name: 'Producto B', sales_price: 15, stock: 5, type: 'product' };

const ADMIN_USER = { id: 1, is_super_admin: true, permissions: [] };

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

describe('CreateSaleModal — sales_mode controlled submission', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(api.listBranches).mockResolvedValue([BRANCH]);
        vi.mocked(api.listProducts).mockResolvedValue([PRODUCT_A, PRODUCT_B]);
        vi.mocked(api.listLeads).mockResolvedValue([LEAD]);
        vi.mocked(api.listPaymentMethods).mockResolvedValue([{ id: 1, name: 'Efectivo' }]);
        vi.mocked(api.listUsers).mockResolvedValue([]);
        vi.mocked(api.listProfessionals).mockResolvedValue([]);
        vi.mocked(api.createSale).mockResolvedValue({ type: 'group', sale_group: { id: 1, lines: [] } } as any);
    });

    it('sends a single request with an items array when the tenant is grouped_sale', async () => {
        vi.mocked(api.getTenantProfile).mockResolvedValue({ settings: { sales_mode: 'grouped_sale' } } as any);
        const user = userEvent.setup();
        const onSuccess = vi.fn();

        render(<CreateSaleModal isOpen onClose={vi.fn()} onSuccess={onSuccess} user={ADMIN_USER} />);

        await fillCommonFieldsAndAddTwoProductsToCart(user);
        await user.click(screen.getByRole('button', { name: 'Confirmar' }));

        await waitFor(() => expect(api.createSale).toHaveBeenCalledTimes(1));

        const payload = vi.mocked(api.createSale).mock.calls[0][0] as any;
        expect(Array.isArray(payload.items)).toBe(true);
        expect(payload.items).toHaveLength(2);
        expect(payload.items.map((i: any) => String(i.product_id))).toEqual(['10', '11']);
        expect(onSuccess).toHaveBeenCalledTimes(1);
    });

    it('still issues one independent request per cart item when the tenant is independent_sales', async () => {
        vi.mocked(api.getTenantProfile).mockResolvedValue({ settings: { sales_mode: 'independent_sales' } } as any);
        const user = userEvent.setup();

        render(<CreateSaleModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} user={ADMIN_USER} />);

        await fillCommonFieldsAndAddTwoProductsToCart(user);
        await user.click(screen.getByRole('button', { name: 'Confirmar' }));

        await waitFor(() => expect(api.createSale).toHaveBeenCalledTimes(2));

        const firstPayload = vi.mocked(api.createSale).mock.calls[0][0] as any;
        const secondPayload = vi.mocked(api.createSale).mock.calls[1][0] as any;
        expect(firstPayload.items).toBeUndefined();
        expect(secondPayload.items).toBeUndefined();
        expect([String(firstPayload.product_id), String(secondPayload.product_id)]).toEqual(['10', '11']);
    });
});
