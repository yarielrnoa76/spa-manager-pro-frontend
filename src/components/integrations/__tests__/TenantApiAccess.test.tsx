import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TenantApiAccessSection from '../TenantApiAccessSection';
import TenantApiTokenRevealModal from '../TenantApiTokenRevealModal';
import { api } from '../../../services/api';

vi.mock('../../../services/api', () => {
    class ApiError extends Error {
        code?: string;
        constructor(message: string, opts?: { code?: string }) {
            super(message);
            this.code = opts?.code;
        }
    }
    return {
        ApiError,
        api: {
            getTenantApiTokenStatus: vi.fn(),
            createTenantApiToken: vi.fn(),
            rotateTenantApiToken: vi.fn(),
            confirmTenantApiTokenRotation: vi.fn(),
            discardTenantApiTokenRotation: vi.fn(),
            revokeTenantApiToken: vi.fn(),
        },
    };
});

/** A value that exists nowhere else, so finding it anywhere proves a leak. */
const PLAINTEXT = 'spa-canary-plaintext-9f2c41d7e6b8';
const TENANT_ID = 42;

const ABILITIES = [
    { value: 'leads.write', label: 'Create/update leads' },
    { value: 'appointments.write', label: 'Create appointments' },
    { value: 'conversations.read', label: 'Read conversation history' },
    { value: 'conversations.write', label: 'Create/update conversations and messages' },
];

const emptyStatus = {
    configured: false,
    active: null,
    pending_rotation: null,
    available_abilities: ABILITIES,
};

const configuredStatus = {
    configured: true,
    active: {
        id: 7,
        name: 'integration',
        abilities: ['leads.write', 'conversations.write'],
        created_at: '2026-08-01T10:00:00Z',
        last_used_at: '2026-08-20T08:30:00Z',
    },
    pending_rotation: null,
    available_abilities: ABILITIES,
};

const issuedResponse = {
    message: 'Integration token generated.',
    plain_text_token: PLAINTEXT,
    token: { id: 7, name: 'integration', abilities: ['leads.write'], created_at: '2026-08-28T00:00:00Z' },
};

beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
});

afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
});

describe('TenantApiAccessSection', () => {
    it('shows only safe metadata for the active token and never a token value', async () => {
        vi.mocked(api.getTenantApiTokenStatus).mockResolvedValue(configuredStatus);

        const { container } = render(<TenantApiAccessSection tenantId={TENANT_ID} />);

        await waitFor(() => expect(screen.getByText('integration')).toBeInTheDocument());

        expect(screen.getByText('#7')).toBeInTheDocument();
        expect(screen.getByText(/El valor del token no puede consultarse/)).toBeInTheDocument();

        // There is no endpoint that could return a token, and nothing here invents one.
        expect(container.textContent).not.toContain(PLAINTEXT);
        expect(container.querySelector('input[type="password"]')).toBeNull();
    });

    it('offers exactly the abilities the backend published, pre-selected from the active token', async () => {
        vi.mocked(api.getTenantApiTokenStatus).mockResolvedValue(configuredStatus);

        render(<TenantApiAccessSection tenantId={TENANT_ID} />);
        await waitFor(() => expect(screen.getByText(/Permisos del nuevo token/)).toBeInTheDocument());

        const checkboxes = screen.getAllByRole('checkbox');
        expect(checkboxes).toHaveLength(ABILITIES.length);

        // Rotation preserves the current scopes unless the operator narrows them deliberately.
        const labels = ABILITIES.map((a) => a.value);
        labels.forEach((value) => {
            const box = screen.getByRole('checkbox', { name: new RegExp(value.replace('.', '\\.')) });
            expect((box as HTMLInputElement).checked).toBe(
                configuredStatus.active.abilities.includes(value),
            );
        });
    });

    it('sends only the selected abilities when creating the first token', async () => {
        vi.mocked(api.getTenantApiTokenStatus).mockResolvedValue(emptyStatus);
        vi.mocked(api.createTenantApiToken).mockResolvedValue(issuedResponse);

        render(<TenantApiAccessSection tenantId={TENANT_ID} />);
        await waitFor(() => expect(screen.getByRole('button', { name: /Generar token/ })).toBeEnabled());

        // Everything is selected by default with no active token; drop one.
        await userEvent.click(screen.getByRole('checkbox', { name: /leads\.write/ }));
        await userEvent.click(screen.getByRole('button', { name: /Generar token/ }));

        await waitFor(() => expect(api.createTenantApiToken).toHaveBeenCalledTimes(1));
        expect(api.createTenantApiToken).toHaveBeenCalledWith(TENANT_ID, [
            'appointments.write',
            'conversations.read',
            'conversations.write',
        ]);
    });

    it('walks create -> reveal -> close and states the token cannot be recovered', async () => {
        vi.mocked(api.getTenantApiTokenStatus).mockResolvedValue(emptyStatus);
        vi.mocked(api.createTenantApiToken).mockResolvedValue(issuedResponse);

        const { container } = render(<TenantApiAccessSection tenantId={TENANT_ID} />);
        await waitFor(() => expect(screen.getByRole('button', { name: /Generar token/ })).toBeEnabled());
        await userEvent.click(screen.getByRole('button', { name: /Generar token/ }));

        const dialog = await screen.findByRole('dialog');
        expect(within(dialog).getByDisplayValue(PLAINTEXT)).toBeInTheDocument();

        await userEvent.click(within(dialog).getByRole('checkbox'));
        await userEvent.click(within(dialog).getByRole('button', { name: /Cerrar y borrar de pantalla/ }));

        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

        // Gone from the DOM entirely, and the UI says why.
        expect(container.textContent).not.toContain(PLAINTEXT);
        expect(screen.getByText(/ya no puede recuperarse/)).toBeInTheDocument();
    });

    it('rotates in two steps and can discard without touching the current token', async () => {
        vi.mocked(api.getTenantApiTokenStatus).mockResolvedValue({
            ...configuredStatus,
            pending_rotation: { id: 8, name: 'integration-candidate', abilities: ['leads.write'], created_at: '2026-08-28T00:00:00Z', last_used_at: null },
        });
        vi.mocked(api.discardTenantApiTokenRotation).mockResolvedValue({ message: 'discarded', status: configuredStatus });

        render(<TenantApiAccessSection tenantId={TENANT_ID} />);
        await waitFor(() => expect(screen.getByText(/Rotación pendiente/)).toBeInTheDocument());

        expect(screen.getByText(/El token anterior/)).toBeInTheDocument();

        await userEvent.click(screen.getByRole('button', { name: /Descartar candidato/ }));
        await waitFor(() => expect(api.discardTenantApiTokenRotation).toHaveBeenCalledWith(TENANT_ID));
        expect(await screen.findByText(/sigue intacto/)).toBeInTheDocument();
    });

    it('confirms a rotation only when explicitly asked', async () => {
        vi.mocked(api.getTenantApiTokenStatus).mockResolvedValue({
            ...configuredStatus,
            pending_rotation: { id: 8, name: 'integration-candidate', abilities: ['leads.write'], created_at: '2026-08-28T00:00:00Z', last_used_at: null },
        });
        vi.mocked(api.confirmTenantApiTokenRotation).mockResolvedValue({ message: 'ok', status: configuredStatus });

        render(<TenantApiAccessSection tenantId={TENANT_ID} />);
        await waitFor(() => expect(screen.getByRole('button', { name: /Confirmar rotación/ })).toBeInTheDocument());

        await userEvent.click(screen.getByRole('button', { name: /Confirmar rotación/ }));
        await waitFor(() => expect(api.confirmTenantApiTokenRotation).toHaveBeenCalledWith(TENANT_ID));
    });

    it('requires an explicit confirmation before revoking', async () => {
        vi.mocked(api.getTenantApiTokenStatus).mockResolvedValue(configuredStatus);
        vi.mocked(api.revokeTenantApiToken).mockResolvedValue({ message: 'revoked' });

        render(<TenantApiAccessSection tenantId={TENANT_ID} />);
        await waitFor(() => expect(screen.getByRole('button', { name: /Revocar token/ })).toBeInTheDocument());

        await userEvent.click(screen.getByRole('button', { name: /Revocar token/ }));
        expect(api.revokeTenantApiToken).not.toHaveBeenCalled();

        await userEvent.click(screen.getByRole('button', { name: /Sí, revocar/ }));
        await waitFor(() => expect(api.revokeTenantApiToken).toHaveBeenCalledWith(TENANT_ID));
    });

    it('surfaces a backend error without inventing detail', async () => {
        vi.mocked(api.getTenantApiTokenStatus).mockResolvedValue(configuredStatus);
        const { ApiError } = await import('../../../services/api');
        vi.mocked(api.rotateTenantApiToken).mockRejectedValue(new ApiError('A rotation candidate is already pending.'));

        render(<TenantApiAccessSection tenantId={TENANT_ID} />);
        await waitFor(() => expect(screen.getByRole('button', { name: /Iniciar rotación/ })).toBeEnabled());
        await userEvent.click(screen.getByRole('button', { name: /Iniciar rotación/ }));

        const alert = await screen.findByRole('alert');
        expect(alert).toHaveTextContent('A rotation candidate is already pending.');
        expect(alert.textContent).not.toContain(PLAINTEXT);
    });

    it('shows the static header example without ever embedding a real token', async () => {
        vi.mocked(api.getTenantApiTokenStatus).mockResolvedValue(configuredStatus);

        const { container } = render(<TenantApiAccessSection tenantId={TENANT_ID} />);
        await waitFor(() => expect(screen.getByText(/Cómo debe autenticar el consumidor/)).toBeInTheDocument());

        expect(container.textContent).toContain('Authorization: Bearer <token>');
        expect(container.textContent).toContain(`X-Tenant-ID: ${TENANT_ID}`);
        expect(container.textContent).not.toContain(PLAINTEXT);
    });
});

describe('TenantApiTokenRevealModal', () => {
    const renderModal = (onClose = vi.fn()) =>
        render(
            <TenantApiTokenRevealModal
                plainTextToken={PLAINTEXT}
                tenantId={TENANT_ID}
                abilities={['leads.write']}
                onClose={onClose}
            />,
        );

    it('never writes the token to storage, the URL, or the console', async () => {
        const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        renderModal();
        await userEvent.click(screen.getByRole('button', { name: /Copiar token/ }));

        expect(localStorage.length).toBe(0);
        expect(sessionStorage.length).toBe(0);
        expect(window.location.href).not.toContain(PLAINTEXT);

        [logSpy, errorSpy, warnSpy].forEach((spy) => {
            spy.mock.calls.flat().forEach((arg) => {
                expect(String(arg)).not.toContain(PLAINTEXT);
            });
        });

        logSpy.mockRestore();
        errorSpy.mockRestore();
        warnSpy.mockRestore();
    });

    it('copies the token deliberately, on an explicit action only', async () => {
        renderModal();
        expect(navigator.clipboard.writeText).not.toHaveBeenCalled();

        await userEvent.click(screen.getByRole('button', { name: /Copiar token/ }));
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith(PLAINTEXT);
        expect(await screen.findByText('Copiado')).toBeInTheDocument();
    });

    it('cannot be closed until the operator acknowledges having saved it', async () => {
        const onClose = vi.fn();
        renderModal(onClose);

        const closeButton = screen.getByRole('button', { name: /Cerrar y borrar de pantalla/ });
        expect(closeButton).toBeDisabled();

        await userEvent.click(screen.getByRole('checkbox'));
        expect(closeButton).toBeEnabled();

        await userEvent.click(closeButton);
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('is an accessible dialog with focus placed inside it', () => {
        renderModal();

        const dialog = screen.getByRole('dialog');
        expect(dialog).toHaveAttribute('aria-modal', 'true');
        expect(dialog).toHaveAttribute('aria-labelledby', 'tenant-api-token-reveal-title');
        expect(dialog).toContainElement(document.activeElement as HTMLElement);

        // The value is readable and selectable rather than masked: it must be copied now, and a
        // password field would only make that harder without hiding anything from the operator
        // who just asked to see it.
        expect(screen.getByLabelText('Token')).toHaveAttribute('readonly');
    });

    it('survives a clipboard the browser refuses, without surfacing the token', async () => {
        Object.assign(navigator, { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } });

        renderModal();
        await userEvent.click(screen.getByRole('button', { name: /Copiar token/ }));

        // No crash, no "Copiado" claim, and no error text carrying the value.
        expect(screen.queryByText('Copiado')).not.toBeInTheDocument();
        expect(screen.getByDisplayValue(PLAINTEXT)).toBeInTheDocument();
    });
});
