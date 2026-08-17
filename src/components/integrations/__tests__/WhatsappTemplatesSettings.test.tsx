import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WhatsappTemplatesSettings from '../WhatsappTemplatesSettings';
import { api } from '../../../services/api';
import type { WhatsappTemplate } from '../../../types';

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
            listWhatsappTemplates: vi.fn(),
            syncWhatsappTemplates: vi.fn(),
            updateWhatsappTemplate: vi.fn(),
        },
    };
});

function makeTemplate(overrides: Partial<WhatsappTemplate> = {}): WhatsappTemplate {
    return {
        id: 1,
        tenant_id: 1,
        chatwoot_account_id: '1',
        chatwoot_inbox_id: '2',
        external_template_id: 'tpl_1',
        name: 'customer_request_followup_es',
        language: 'es_ES',
        category: 'UTILITY',
        status: 'approved',
        body_preview: 'Hola {{1}}',
        components: null,
        parameter_schema: [{ component: 'BODY', position: 1, required: true }],
        parameter_format: 'POSITIONAL',
        enabled: true,
        allowed_when_window_closed: true,
        is_default_closed_window: false,
        is_available: true,
        last_synced_at: '2026-08-17T09:00:00Z',
        created_at: '2026-08-17T09:00:00Z',
        updated_at: '2026-08-17T09:00:00Z',
        ...overrides,
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.listWhatsappTemplates).mockResolvedValue({ data: [makeTemplate()], current_page: 1, last_page: 1, total: 1 });
});

describe('WhatsappTemplatesSettings — permission visibility', () => {
    it('hides Sync Templates and disables toggles for a view-only user (canManage=false)', async () => {
        render(<WhatsappTemplatesSettings canManage={false} />);

        expect(await screen.findByText('customer_request_followup_es')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Sincronizar plantillas/i })).not.toBeInTheDocument();

        const toggleButtons = screen.getAllByRole('button').filter((b) => b.hasAttribute('disabled'));
        expect(toggleButtons.length).toBeGreaterThan(0);
    });

    it('shows Sync Templates and enabled toggles for a manager (canManage=true)', async () => {
        vi.mocked(api.updateWhatsappTemplate).mockResolvedValue(makeTemplate({ enabled: false }));

        render(<WhatsappTemplatesSettings canManage />);

        expect(await screen.findByText('customer_request_followup_es')).toBeInTheDocument();
        const syncButton = screen.getByRole('button', { name: /Sincronizar plantillas/i });
        expect(syncButton).toBeInTheDocument();
        expect(syncButton).not.toBeDisabled();
    });

    it('calls the sync endpoint and refreshes the list', async () => {
        vi.mocked(api.syncWhatsappTemplates).mockResolvedValue({
            ok: true,
            created: 1,
            updated: 0,
            restored: 0,
            marked_unavailable: 0,
            skipped: 0,
            total_synced: 1,
            synced_at: '2026-08-17T09:00:00Z',
        });

        const user = userEvent.setup();
        render(<WhatsappTemplatesSettings canManage />);

        await screen.findByText('customer_request_followup_es');
        await user.click(screen.getByRole('button', { name: /Sincronizar plantillas/i }));

        await waitFor(() => expect(api.syncWhatsappTemplates).toHaveBeenCalled());
        expect(await screen.findByText(/1 nuevas/i)).toBeInTheDocument();
    });
});
