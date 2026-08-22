import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NotifyContactModal from '../NotifyContactModal';
import { api } from '../../services/api';
import type { Conversation, WhatsappTemplate } from '../../types';

vi.mock('../../services/api', () => {
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
            sendConversationMessage: vi.fn(),
        },
    };
});

function makeConversation(overrides: Partial<Conversation> = {}): Conversation {
    return {
        id: 1,
        tenant_id: 1,
        contact_name: 'Maria',
        contact_phone: '5551234567',
        status: 'open',
        bot_enabled: false,
        is_important: false,
        last_message_at: '2026-08-17T10:00:00Z',
        last_message_preview: '',
        unread_count: 0,
        created_at: '2026-08-17T09:00:00Z',
        window_open: false,
        window_expires_at: null,
        ...overrides,
    };
}

function makeTemplate(overrides: Partial<WhatsappTemplate> = {}): WhatsappTemplate {
    return {
        id: 42,
        tenant_id: 1,
        chatwoot_account_id: '1',
        chatwoot_inbox_id: '2',
        external_template_id: 'tpl_1',
        name: 'customer_request_followup_es',
        language: 'es_ES',
        category: 'UTILITY',
        status: 'approved',
        body_preview: 'Hola {{1}}, seguimiento.',
        components: [{ type: 'BODY', text: 'Hola {{1}}, seguimiento.' }],
        parameter_schema: [{ component: 'BODY', position: 1, required: true }],
        parameter_format: 'POSITIONAL',
        enabled: true,
        allowed_when_window_closed: true,
        is_default_closed_window: true,
        is_available: true,
        last_synced_at: '2026-08-17T09:00:00Z',
        created_at: '2026-08-17T09:00:00Z',
        updated_at: '2026-08-17T09:00:00Z',
        ...overrides,
    };
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe('NotifyContactModal', () => {
    it('auto-selects the single default template, fills the contact name, and sends via whatsapp_template_id', async () => {
        const template = makeTemplate();
        vi.mocked(api.listWhatsappTemplates).mockResolvedValue({ data: [template], current_page: 1, last_page: 1, total: 1 });
        vi.mocked(api.sendConversationMessage).mockResolvedValue({} as never);

        const onSent = vi.fn();
        const user = userEvent.setup();
        render(
            <NotifyContactModal
                conversation={makeConversation()}
                onClose={vi.fn()}
                onSent={onSent}
                onOpenSendTemplate={vi.fn()}
            />,
        );

        expect(await screen.findByText(/Hola Maria, seguimiento\./)).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: /Enviar notificación/i }));

        await waitFor(() =>
            expect(api.sendConversationMessage).toHaveBeenCalledWith(1, undefined, {
                whatsapp_template_id: 42,
                template_params: ['Maria'],
            }),
        );
        expect(onSent).toHaveBeenCalled();
    });

    it('routes to the generic modal instead of guessing when no single safe default exists', async () => {
        vi.mocked(api.listWhatsappTemplates).mockResolvedValue({ data: [], current_page: 1, last_page: 1, total: 0 });

        const onOpenSendTemplate = vi.fn();
        const user = userEvent.setup();
        render(
            <NotifyContactModal
                conversation={makeConversation()}
                onClose={vi.fn()}
                onSent={vi.fn()}
                onOpenSendTemplate={onOpenSendTemplate}
            />,
        );

        const button = await screen.findByRole('button', { name: /Elegir plantilla manualmente/i });
        await user.click(button);

        expect(onOpenSendTemplate).toHaveBeenCalled();
        expect(api.sendConversationMessage).not.toHaveBeenCalled();
    });

    it('does not offer auto-send for a default template requiring more than one parameter', async () => {
        const template = makeTemplate({
            components: [{ type: 'BODY', text: 'Hola {{1}}, tu cita es el {{2}}.' }],
            parameter_schema: [
                { component: 'BODY', position: 1, required: true },
                { component: 'BODY', position: 2, required: true },
            ],
        });
        vi.mocked(api.listWhatsappTemplates).mockResolvedValue({ data: [template], current_page: 1, last_page: 1, total: 1 });

        render(
            <NotifyContactModal
                conversation={makeConversation()}
                onClose={vi.fn()}
                onSent={vi.fn()}
                onOpenSendTemplate={vi.fn()}
            />,
        );

        expect(await screen.findByText(/no se pueden completar automáticamente/i)).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Enviar notificación/i })).not.toBeInTheDocument();
    });
});
