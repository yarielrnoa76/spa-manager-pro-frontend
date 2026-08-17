import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SendTemplateModal from '../SendTemplateModal';
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
        id: 1,
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
});

describe('SendTemplateModal', () => {
    it('closed-window mode filters by allowed_when_window_closed=true', async () => {
        vi.mocked(api.listWhatsappTemplates).mockResolvedValue({ data: [], current_page: 1, last_page: 1, total: 0 });

        render(<SendTemplateModal conversation={makeConversation()} onClose={vi.fn()} onSent={vi.fn()} closedWindowOnly />);

        await waitFor(() =>
            expect(api.listWhatsappTemplates).toHaveBeenCalledWith(
                expect.objectContaining({ enabled: true, available: true, allowed_when_window_closed: true }),
            ),
        );
    });

    it('prefills parameter 1 with the contact name and requires it before sending', async () => {
        const template = makeTemplate();
        vi.mocked(api.listWhatsappTemplates).mockResolvedValue({ data: [template], current_page: 1, last_page: 1, total: 1 });
        vi.mocked(api.sendConversationMessage).mockResolvedValue({} as never);

        const user = userEvent.setup();
        const onSent = vi.fn();
        render(<SendTemplateModal conversation={makeConversation()} onClose={vi.fn()} onSent={onSent} closedWindowOnly />);

        const templateButton = await screen.findByText('customer_request_followup_es');
        await user.click(templateButton);

        const paramInput = await screen.findByLabelText(/Parámetro 1/i);
        expect(paramInput).toHaveValue('Maria');

        await user.click(screen.getByRole('button', { name: /^Enviar$/i }));

        await waitFor(() =>
            expect(api.sendConversationMessage).toHaveBeenCalledWith(1, undefined, {
                whatsapp_template_id: 1,
                template_params: ['Maria'],
            }),
        );
        expect(onSent).toHaveBeenCalled();
    });

    it('disables selection of a template with parameters outside BODY (unsupported format)', async () => {
        const unsupported = makeTemplate({
            id: 2,
            name: 'order_update',
            parameter_schema: [{ component: 'HEADER', position: 1, required: true }],
        });
        vi.mocked(api.listWhatsappTemplates).mockResolvedValue({ data: [unsupported], current_page: 1, last_page: 1, total: 1 });

        const user = userEvent.setup();
        render(<SendTemplateModal conversation={makeConversation()} onClose={vi.fn()} onSent={vi.fn()} closedWindowOnly />);

        const templateButton = await screen.findByRole('button', { name: /order_update/i });
        expect(templateButton).toBeDisabled();

        await user.click(templateButton);
        expect(screen.getByText(/Selecciona una plantilla para continuar\./i)).toBeInTheDocument();
    });

    it('leaves the send button disabled while a required parameter is empty', async () => {
        const template = makeTemplate({ components: [{ type: 'BODY', text: 'Hola {{1}}' }] });
        vi.mocked(api.listWhatsappTemplates).mockResolvedValue({ data: [template], current_page: 1, last_page: 1, total: 1 });

        const user = userEvent.setup();
        render(<SendTemplateModal conversation={makeConversation()} onClose={vi.fn()} onSent={vi.fn()} closedWindowOnly />);

        await user.click(await screen.findByText('customer_request_followup_es'));
        const paramInput = await screen.findByLabelText(/Parámetro 1/i);
        await user.clear(paramInput);

        expect(screen.getByRole('button', { name: /^Enviar$/i })).toBeDisabled();
    });
});
