import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BranchesSettings from '../BranchesSettings';
import { api } from '../../services/api';

vi.mock('../../services/api', () => ({
    api: {
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
        getBranchNotificationReviewer: vi.fn(),
        setBranchNotificationReviewer: vi.fn(),
    },
}));

const BRANCHES = [
    { id: 3, name: 'Central Branch', code: 'CEN', address: '1 Main St' },
    { id: 4, name: 'North Branch', code: 'NOR', address: '2 North St' },
    { id: 5, name: 'Old Branch', code: 'OLD', address: '3 Old St', deleted_at: '2026-01-01T00:00:00Z' },
];

function reviewerResponse(branchId: number) {
    return {
        data: {
            branch_id: branchId,
            user_id: null,
            user: null,
            status: 'not_configured',
            invalid_reason: null,
            candidates: [{ id: 11, name: 'Maria Manager', role: 'manager' }],
            capabilities: { can_manage: true },
        },
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.get).mockResolvedValue(BRANCHES as never);
});

describe('BranchesSettings — notification reviewer entry point', () => {
    it('shows the action on active branches only, for an actor who may read the setting', async () => {
        render(<BranchesSettings canViewReviewer />);

        await screen.findByText('Central Branch');
        expect(screen.getAllByRole('button', { name: 'Notification reviewer' })).toHaveLength(2);
    });

    it('hides the action from an actor without a read permission for it', async () => {
        render(<BranchesSettings canEdit />);

        await screen.findByText('Central Branch');
        expect(screen.queryByRole('button', { name: 'Notification reviewer' })).not.toBeInTheDocument();
        // Unrelated existing actions are untouched.
        expect(screen.getAllByRole('button', { name: 'Editar' })).toHaveLength(2);
    });

    it('opens the dialog for the clicked branch and reads only that branch', async () => {
        const user = userEvent.setup();
        vi.mocked(api.getBranchNotificationReviewer).mockResolvedValue(reviewerResponse(4) as never);

        render(<BranchesSettings canViewReviewer tenantId={9} />);
        await screen.findByText('North Branch');

        const buttons = screen.getAllByRole('button', { name: 'Notification reviewer' });
        await user.click(buttons[1]);

        expect(await screen.findByRole('dialog', { name: 'Default notification reviewer' })).toBeInTheDocument();
        expect(screen.getByTestId('reviewer-branch-name')).toHaveTextContent('North Branch');
        expect(api.getBranchNotificationReviewer).toHaveBeenCalledTimes(1);
        expect(api.getBranchNotificationReviewer).toHaveBeenCalledWith(4);
    });

    it('closes the dialog without touching the branch list or saving anything', async () => {
        const user = userEvent.setup();
        vi.mocked(api.getBranchNotificationReviewer).mockResolvedValue(reviewerResponse(3) as never);

        render(<BranchesSettings canViewReviewer />);
        await screen.findByText('Central Branch');
        await user.click(screen.getAllByRole('button', { name: 'Notification reviewer' })[0]);
        await screen.findByTestId('reviewer-select');

        // Two controls close the dialog (header icon and footer button); either one is enough.
        await user.click(screen.getAllByRole('button', { name: 'Close' })[0]);

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(api.setBranchNotificationReviewer).not.toHaveBeenCalled();
        expect(api.get).toHaveBeenCalledTimes(1);
    });
});
