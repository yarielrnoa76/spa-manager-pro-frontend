import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RotateChatwootTokenModal from '../RotateChatwootTokenModal';
import { api, ApiError } from '../../../services/api';

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
            rotateChatwootToken: vi.fn(),
        },
    };
});

const CANDIDATE = 'brand-new-super-secret-token';

beforeEach(() => {
    vi.clearAllMocks();
});

describe('RotateChatwootTokenModal', () => {
    it('renders the token field as a password input', () => {
        render(<RotateChatwootTokenModal tenantId={1} onClose={vi.fn()} onRotated={vi.fn()} />);
        const input = screen.getByPlaceholderText('••••••••••••••••••••');
        expect(input).toHaveAttribute('type', 'password');
    });

    it('never logs the candidate token to the console', async () => {
        const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.mocked(api.rotateChatwootToken).mockResolvedValue({ ok: true, configured: true, message: 'Token rotado y validado correctamente.' });

        const user = userEvent.setup();
        render(<RotateChatwootTokenModal tenantId={1} onClose={vi.fn()} onRotated={vi.fn()} />);

        await user.type(screen.getByPlaceholderText('••••••••••••••••••••'), CANDIDATE);
        await user.click(screen.getByRole('button', { name: /Verificar y reemplazar/i }));

        await waitFor(() => expect(api.rotateChatwootToken).toHaveBeenCalledWith(1, CANDIDATE));

        const allLoggedText = [...logSpy.mock.calls, ...errorSpy.mock.calls].flat().join(' ');
        expect(allLoggedText).not.toContain(CANDIDATE);

        logSpy.mockRestore();
        errorSpy.mockRestore();
    });

    it('clears the candidate token field after a successful rotation', async () => {
        vi.mocked(api.rotateChatwootToken).mockResolvedValue({ ok: true, configured: true, message: 'Token rotado y validado correctamente.' });
        const onRotated = vi.fn();

        const user = userEvent.setup();
        render(<RotateChatwootTokenModal tenantId={1} onClose={vi.fn()} onRotated={onRotated} />);

        const input = screen.getByPlaceholderText('••••••••••••••••••••') as HTMLInputElement;
        await user.type(input, CANDIDATE);
        await user.click(screen.getByRole('button', { name: /Verificar y reemplazar/i }));

        await waitFor(() => expect(onRotated).toHaveBeenCalled());
        expect(input.value).toBe('');
    });

    it('shows the sanitized backend message and leaves the field editable on failure', async () => {
        vi.mocked(api.rotateChatwootToken).mockRejectedValue(
            new ApiError(
                "The candidate token could not be validated against the tenant's Chatwoot configuration. The current token was not changed.",
                { code: 'WHATSAPP_TEMPLATE_NOT_FOUND' },
            ),
        );

        const user = userEvent.setup();
        render(<RotateChatwootTokenModal tenantId={1} onClose={vi.fn()} onRotated={vi.fn()} />);

        await user.type(screen.getByPlaceholderText('••••••••••••••••••••'), CANDIDATE);
        await user.click(screen.getByRole('button', { name: /Verificar y reemplazar/i }));

        expect(await screen.findByText(/current token was not changed/i)).toBeInTheDocument();
    });

    it('clears the candidate on cancel', async () => {
        const onClose = vi.fn();
        const user = userEvent.setup();
        render(<RotateChatwootTokenModal tenantId={1} onClose={onClose} onRotated={vi.fn()} />);

        const input = screen.getByPlaceholderText('••••••••••••••••••••') as HTMLInputElement;
        await user.type(input, CANDIDATE);
        await user.click(screen.getByRole('button', { name: /Cancelar/i }));

        expect(onClose).toHaveBeenCalled();
    });
});
