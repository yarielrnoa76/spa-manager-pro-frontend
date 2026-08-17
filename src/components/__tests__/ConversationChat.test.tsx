import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConversationChat } from '../ConversationChat';
import { api, ApiError } from '../../services/api';
import type { Conversation, ConversationMessage } from '../../types';

vi.mock('../../services/api', () => {
    class ApiError extends Error {
        code?: string;
        status?: number;
        errors?: Record<string, string[]>;
        constructor(message: string, opts?: { code?: string; status?: number; errors?: Record<string, string[]> }) {
            super(message);
            this.name = 'ApiError';
            this.code = opts?.code;
            this.status = opts?.status;
            this.errors = opts?.errors;
        }
    }
    return {
        ApiError,
        api: {
            getConversation: vi.fn(),
            getConversationMessages: vi.fn(),
            sendConversationMessage: vi.fn(),
            markConversationRead: vi.fn(),
            toggleConversationBot: vi.fn(),
            updateConversationStatus: vi.fn(),
            deleteMessage: vi.fn(),
            listWhatsappTemplates: vi.fn(),
        },
    };
});

// jsdom doesn't implement scrollIntoView -- ConversationChat calls it whenever the message
// list changes (pre-existing behavior, unrelated to this feature).
Element.prototype.scrollIntoView = vi.fn();

const USER = { id: 1, is_super_admin: true, permissions: [] };

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
        window_open: true,
        window_expires_at: '2026-08-18T10:00:00Z',
        ...overrides,
    };
}

function mockConversationAndMessages(conversation: Conversation, messages: ConversationMessage[] = []) {
    vi.mocked(api.getConversation).mockResolvedValue(conversation);
    vi.mocked(api.getConversationMessages).mockResolvedValue({ data: [...messages].reverse() });
    vi.mocked(api.markConversationRead).mockResolvedValue(conversation);
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe('ConversationChat — open window', () => {
    it('shows the normal free-text composer and can send a message', async () => {
        const conversation = makeConversation({ window_open: true });
        mockConversationAndMessages(conversation);
        vi.mocked(api.sendConversationMessage).mockResolvedValue({
            id: 99,
            tenant_id: 1,
            conversation_id: 1,
            direction: 'outbound',
            message_type: 'text',
            sender_type: 'user',
            body: 'Hola',
            status: 'sent',
            is_read: true,
            created_at: '2026-08-17T10:05:00Z',
        } as ConversationMessage);

        const user = userEvent.setup();
        const { container } = render(<ConversationChat conversationId={1} user={USER} />);

        const input = await screen.findByPlaceholderText('Escribe un mensaje...');
        await user.type(input, 'Hola');
        const sendButton = container.querySelector('form button[type="submit"]') as HTMLButtonElement;
        await user.click(sendButton);

        await waitFor(() => expect(api.sendConversationMessage).toHaveBeenCalledWith(1, 'Hola'));
        // Closed-window UI must not appear when the window is open.
        expect(screen.queryByText(/Ventana de WhatsApp cerrada/i)).not.toBeInTheDocument();
    });
});

describe('ConversationChat — closed window', () => {
    it('replaces the composer with the closed-window panel and its two actions', async () => {
        const conversation = makeConversation({ window_open: false, window_expires_at: null });
        mockConversationAndMessages(conversation);

        render(<ConversationChat conversationId={1} user={USER} />);

        expect(await screen.findByText(/Ventana de WhatsApp cerrada/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Notificar contacto/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Enviar plantilla/i })).toBeInTheDocument();
        expect(screen.queryByPlaceholderText('Escribe un mensaje...')).not.toBeInTheDocument();
    });

    it('conversation.status === closed still takes priority over the window-closed panel', async () => {
        const conversation = makeConversation({ window_open: false, status: 'closed' });
        mockConversationAndMessages(conversation);

        render(<ConversationChat conversationId={1} user={USER} />);

        expect(await screen.findByText(/La conversación ha sido cerrada/i)).toBeInTheDocument();
        expect(screen.queryByText(/Ventana de WhatsApp cerrada/i)).not.toBeInTheDocument();
    });
});

describe('ConversationChat — WHATSAPP_WINDOW_CLOSED handling', () => {
    it('drops the optimistic message and refetches into the closed-window panel on a stale-window 422', async () => {
        const openConversation = makeConversation({ window_open: true });
        const closedConversation = makeConversation({ window_open: false, window_expires_at: null });

        vi.mocked(api.getConversation)
            .mockResolvedValueOnce(openConversation)
            .mockResolvedValue(closedConversation);
        vi.mocked(api.getConversationMessages).mockResolvedValue({ data: [] });
        vi.mocked(api.markConversationRead).mockResolvedValue(openConversation);
        vi.mocked(api.sendConversationMessage).mockRejectedValue(
            new ApiError('The WhatsApp conversation window is closed. An approved template is required.', {
                code: 'WHATSAPP_WINDOW_CLOSED',
                status: 422,
            }),
        );

        const user = userEvent.setup();
        const { container } = render(<ConversationChat conversationId={1} user={USER} />);

        const input = await screen.findByPlaceholderText('Escribe un mensaje...');
        await user.type(input, 'Hola');
        const sendButton = container.querySelector('form button[type="submit"]') as HTMLButtonElement;
        await user.click(sendButton);

        // Backend rejection switches the UI into the closed-window panel...
        expect(await screen.findByText(/Ventana de WhatsApp cerrada/i)).toBeInTheDocument();
        // ...and the optimistic bubble for the rejected message is gone, not shown as "failed".
        expect(screen.queryByText('Hola')).not.toBeInTheDocument();
    });
});
