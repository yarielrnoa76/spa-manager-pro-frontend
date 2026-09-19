import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BranchNotificationReviewerModal from '../BranchNotificationReviewerModal';
import { api } from '../../services/api';
import type {
    BranchNotificationReviewer,
    BranchNotificationReviewerResponse,
} from '../../types';

vi.mock('../../services/api', () => ({
    api: {
        getBranchNotificationReviewer: vi.fn(),
        setBranchNotificationReviewer: vi.fn(),
        // Present only so a test can prove the dialog never lists users by any other route.
        get: vi.fn(),
    },
}));

const BRANCH_ID = 7;

const MARIA = { id: 11, name: 'Maria Manager', role: 'manager' };
const ALEX = { id: 12, name: 'Alex Admin', role: 'admin' };

function makeConfig(overrides: Partial<BranchNotificationReviewer> = {}): BranchNotificationReviewer {
    return {
        branch_id: BRANCH_ID,
        user_id: null,
        user: null,
        status: 'not_configured',
        invalid_reason: null,
        candidates: [MARIA, ALEX],
        capabilities: { can_manage: true },
        ...overrides,
    };
}

function configuredWith(person: typeof MARIA, overrides: Partial<BranchNotificationReviewer> = {}) {
    return makeConfig({
        user_id: person.id,
        user: { id: person.id, name: person.name, role: person.role, is_platform_account: false },
        status: 'valid',
        ...overrides,
    });
}

function respond(data: BranchNotificationReviewer, outcome?: string): BranchNotificationReviewerResponse {
    return outcome ? { data, meta: { outcome } } : { data };
}

function apiError(status: number, message: string, extra: Record<string, unknown> = {}) {
    return Object.assign(new Error(message), { status, ...extra });
}

function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (reason: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}

function renderModal(props: Partial<React.ComponentProps<typeof BranchNotificationReviewerModal>> = {}) {
    return render(
        <BranchNotificationReviewerModal
            branchId={BRANCH_ID}
            branchName="Central Branch"
            tenantId={1}
            onClose={vi.fn()}
            {...props}
        />,
    );
}

const getMock = vi.mocked(api.getBranchNotificationReviewer);
const putMock = vi.mocked(api.setBranchNotificationReviewer);

beforeEach(() => {
    vi.clearAllMocks();
});

describe('BranchNotificationReviewerModal — current configuration', () => {
    it('shows the loading state, then the saved reviewer with its role and no technical ids', async () => {
        const pending = deferred<BranchNotificationReviewerResponse>();
        getMock.mockReturnValue(pending.promise);

        renderModal();
        expect(screen.getByTestId('reviewer-loading')).toBeInTheDocument();

        pending.resolve(respond(configuredWith(MARIA)));

        expect(await screen.findByTestId('reviewer-current')).toHaveTextContent('Maria Manager (manager)');
        expect(screen.getByText('Eligible')).toBeInTheDocument();
        expect(screen.getByText('Default notification reviewer')).toBeInTheDocument();
        expect(screen.getByTestId('reviewer-branch-name')).toHaveTextContent('Central Branch');
        // The saved reviewer is the selected option, and there is nothing to save yet.
        expect(screen.getByTestId('reviewer-select')).toHaveValue(String(MARIA.id));
        expect(screen.getByRole('button', { name: 'Save reviewer' })).toBeDisabled();
        // No id is rendered as text anywhere in the dialog.
        expect(screen.queryByText(new RegExp(`\\b${MARIA.id}\\b`))).not.toBeInTheDocument();
    });

    it('reads the configuration of exactly the requested branch, once', async () => {
        getMock.mockResolvedValue(respond(configuredWith(MARIA)));

        renderModal();
        await screen.findByTestId('reviewer-current');

        expect(getMock).toHaveBeenCalledTimes(1);
        expect(getMock).toHaveBeenCalledWith(BRANCH_ID);
        expect(putMock).not.toHaveBeenCalled();
    });

    it('offers "No default reviewer" as a state, never as a selectable option, and warns that no one is alerted', async () => {
        getMock.mockResolvedValue(respond(makeConfig()));

        renderModal();

        expect(await screen.findByTestId('reviewer-current')).toHaveTextContent('No default reviewer');
        expect(screen.getByTestId('reviewer-not-configured-warning')).toHaveTextContent(
            'No one is alerted about unassigned leads and tickets',
        );
        const select = screen.getByTestId('reviewer-select');
        expect(select).toHaveValue('');
        expect(within(select).queryByText('No default reviewer')).not.toBeInTheDocument();
        expect(within(select).getByText('Select a branch user')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Save reviewer' })).toBeDisabled();
    });

    it('reports a configured reviewer who lost eligibility, keeps them as a non-selectable current option', async () => {
        getMock.mockResolvedValue(
            respond(
                configuredWith(MARIA, {
                    status: 'invalid',
                    invalid_reason: 'user_lacks_assign_lead',
                    candidates: [ALEX],
                }),
            ),
        );

        renderModal();

        expect(await screen.findByTestId('reviewer-current')).toHaveTextContent('Maria Manager (manager)');
        expect(screen.getByText('Needs attention')).toBeInTheDocument();
        expect(screen.getByTestId('reviewer-invalid-reason')).toHaveTextContent("This user's role cannot assign leads.");
        const orphan = screen.getByTestId('reviewer-orphaned-current');
        expect(orphan).toBeDisabled();
        expect(orphan).toHaveTextContent('(current, no longer eligible)');
        // Re-saving the same rejected user is not offered.
        expect(screen.getByRole('button', { name: 'Save reviewer' })).toBeDisabled();
    });

    it('reports several enabled reviewers without picking one, and lets the actor consolidate', async () => {
        getMock.mockResolvedValue(
            respond(makeConfig({ status: 'invalid', invalid_reason: 'multiple_enabled_recipients' })),
        );

        renderModal();

        expect(await screen.findByTestId('reviewer-current')).toHaveTextContent('Multiple reviewers enabled');
        expect(screen.getByTestId('reviewer-invalid-reason')).toHaveTextContent('More than one reviewer is enabled');
        await userEvent.setup().selectOptions(screen.getByTestId('reviewer-select'), String(ALEX.id));
        expect(screen.getByRole('button', { name: 'Save reviewer' })).toBeEnabled();
    });
});

describe('BranchNotificationReviewerModal — eligible users', () => {
    it('lists exactly the candidates the backend returned, with their role', async () => {
        getMock.mockResolvedValue(respond(makeConfig()));

        renderModal();
        const select = await screen.findByTestId('reviewer-select');

        const labels = within(select)
            .getAllByRole('option')
            .map((o) => o.textContent);
        expect(labels).toEqual(['Select a branch user', 'Maria Manager (manager)', 'Alex Admin (admin)']);
    });

    it('never loads a user list by any other route', async () => {
        getMock.mockResolvedValue(respond(makeConfig()));

        renderModal();
        await screen.findByTestId('reviewer-select');

        expect(api.get).not.toHaveBeenCalled();
    });

    it('does not present a platform account as a candidate; a saved one is shown as a platform account, not selectable', async () => {
        // The backend excludes global SuperAdmins from `candidates`; the UI renders only that list.
        getMock.mockResolvedValue(
            respond(
                makeConfig({
                    user_id: 99,
                    user: { id: 99, name: null, role: null, is_platform_account: true },
                    status: 'invalid',
                    invalid_reason: 'user_does_not_belong_to_tenant',
                    candidates: [MARIA],
                }),
            ),
        );

        renderModal();

        expect(await screen.findByTestId('reviewer-current')).toHaveTextContent('Platform account');
        const select = screen.getByTestId('reviewer-select');
        expect(screen.getByTestId('reviewer-orphaned-current')).toBeDisabled();
        const selectable = within(select)
            .getAllByRole('option')
            .filter((o) => !(o as HTMLOptionElement).disabled)
            .map((o) => o.textContent);
        expect(selectable).toEqual(['Maria Manager (manager)']);
    });

    it('shows an empty state, with no selector and no save button, when nobody is eligible', async () => {
        getMock.mockResolvedValue(respond(makeConfig({ candidates: [] })));

        renderModal();

        expect(await screen.findByTestId('reviewer-empty')).toHaveTextContent('No eligible users found for this branch.');
        expect(screen.queryByTestId('reviewer-select')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Save reviewer' })).not.toBeInTheDocument();
    });
});

describe('BranchNotificationReviewerModal — saving', () => {
    it('saves the chosen user, updates the screen only after the backend confirms, and reports success', async () => {
        const user = userEvent.setup();
        getMock.mockResolvedValue(respond(configuredWith(MARIA)));
        const pending = deferred<BranchNotificationReviewerResponse>();
        putMock.mockReturnValue(pending.promise);

        renderModal();
        await screen.findByTestId('reviewer-current');

        await user.selectOptions(screen.getByTestId('reviewer-select'), String(ALEX.id));
        await user.click(screen.getByRole('button', { name: 'Save reviewer' }));

        expect(putMock).toHaveBeenCalledWith(BRANCH_ID, ALEX.id);
        // While the request is in flight nothing has been confirmed: no optimistic update.
        expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();
        expect(screen.getByTestId('reviewer-current')).toHaveTextContent('Maria Manager (manager)');
        expect(screen.queryByTestId('reviewer-notice')).not.toBeInTheDocument();

        pending.resolve(respond(configuredWith(ALEX), 'replaced'));

        await waitFor(() => expect(screen.getByTestId('reviewer-current')).toHaveTextContent('Alex Admin (admin)'));
        expect(screen.getByTestId('reviewer-notice')).toHaveTextContent('Default notification reviewer updated.');
        expect(screen.getByTestId('reviewer-select')).toHaveValue(String(ALEX.id));
        expect(screen.getByRole('button', { name: 'Save reviewer' })).toBeDisabled();
    });

    it('designates a first reviewer for an unconfigured branch', async () => {
        const user = userEvent.setup();
        getMock.mockResolvedValue(respond(makeConfig()));
        putMock.mockResolvedValue(respond(configuredWith(MARIA), 'created'));

        renderModal();
        await screen.findByTestId('reviewer-select');
        await user.selectOptions(screen.getByTestId('reviewer-select'), String(MARIA.id));
        await user.click(screen.getByRole('button', { name: 'Save reviewer' }));

        expect(await screen.findByTestId('reviewer-notice')).toBeInTheDocument();
        expect(screen.getByTestId('reviewer-current')).toHaveTextContent('Maria Manager (manager)');
        expect(screen.queryByTestId('reviewer-not-configured-warning')).not.toBeInTheDocument();
    });

    it('says nothing changed when the backend reports an unchanged outcome', async () => {
        const user = userEvent.setup();
        getMock.mockResolvedValue(respond(makeConfig()));
        putMock.mockResolvedValue(respond(configuredWith(MARIA), 'unchanged'));

        renderModal();
        await screen.findByTestId('reviewer-select');
        await user.selectOptions(screen.getByTestId('reviewer-select'), String(MARIA.id));
        await user.click(screen.getByRole('button', { name: 'Save reviewer' }));

        expect(await screen.findByTestId('reviewer-notice')).toHaveTextContent('Nothing changed.');
    });

    it('shows a readable message for an ineligible user, keeps the saved reviewer, and re-reads the configuration', async () => {
        const user = userEvent.setup();
        getMock.mockResolvedValue(respond(configuredWith(MARIA)));
        putMock.mockRejectedValue(
            apiError(422, 'The selected user cannot be designated as the notification reviewer for this branch.', {
                code: 'REVIEWER_NOT_ELIGIBLE',
                data: { code: 'REVIEWER_NOT_ELIGIBLE', reason: 'user_lacks_assign_ticket' },
            }),
        );

        renderModal();
        await screen.findByTestId('reviewer-current');
        await user.selectOptions(screen.getByTestId('reviewer-select'), String(ALEX.id));
        await user.click(screen.getByRole('button', { name: 'Save reviewer' }));

        expect(await screen.findByTestId('reviewer-save-error')).toHaveTextContent(
            "This user's role cannot assign tickets.",
        );
        // The rejected choice was never shown as the current reviewer.
        expect(screen.getByTestId('reviewer-current')).toHaveTextContent('Maria Manager (manager)');
        expect(screen.queryByTestId('reviewer-notice')).not.toBeInTheDocument();
        await waitFor(() => expect(getMock).toHaveBeenCalledTimes(2));
    });

    it('falls back to a generic sentence for a reason code it does not know, never echoing it', async () => {
        const user = userEvent.setup();
        getMock.mockResolvedValue(respond(makeConfig()));
        putMock.mockRejectedValue(
            apiError(422, 'x', { code: 'REVIEWER_NOT_ELIGIBLE', data: { reason: 'some_future_reason_code' } }),
        );

        renderModal();
        await screen.findByTestId('reviewer-select');
        await user.selectOptions(screen.getByTestId('reviewer-select'), String(MARIA.id));
        await user.click(screen.getByRole('button', { name: 'Save reviewer' }));

        const error = await screen.findByTestId('reviewer-save-error');
        expect(error).toHaveTextContent('cannot be designated as the notification reviewer for this branch.');
        expect(error).not.toHaveTextContent('some_future_reason_code');
    });

    it('shows the first field message for a plain validation failure', async () => {
        const user = userEvent.setup();
        getMock.mockResolvedValue(respond(makeConfig()));
        putMock.mockRejectedValue(
            apiError(422, 'Validation failed.', { code: 'VALIDATION_ERROR', errors: { user_id: ['The user id field is required.'] } }),
        );

        renderModal();
        await screen.findByTestId('reviewer-select');
        await user.selectOptions(screen.getByTestId('reviewer-select'), String(MARIA.id));
        await user.click(screen.getByRole('button', { name: 'Save reviewer' }));

        expect(await screen.findByTestId('reviewer-save-error')).toHaveTextContent('The user id field is required.');
    });

    it('explains a permission failure on save and keeps the saved reviewer', async () => {
        const user = userEvent.setup();
        getMock.mockResolvedValue(respond(configuredWith(MARIA)));
        putMock.mockRejectedValue(apiError(403, 'You do not have access to this branch.', { code: 'BRANCH_SCOPE_FORBIDDEN' }));

        renderModal();
        await screen.findByTestId('reviewer-current');
        await user.selectOptions(screen.getByTestId('reviewer-select'), String(ALEX.id));
        await user.click(screen.getByRole('button', { name: 'Save reviewer' }));

        expect(await screen.findByTestId('reviewer-save-error')).toHaveTextContent('You do not have permission');
        expect(screen.getByTestId('reviewer-current')).toHaveTextContent('Maria Manager (manager)');
    });

    it('does not trust a save response that describes another branch', async () => {
        const user = userEvent.setup();
        getMock.mockResolvedValue(respond(configuredWith(MARIA)));
        putMock.mockResolvedValue(respond(configuredWith(ALEX, { branch_id: 999 }), 'replaced'));

        renderModal();
        await screen.findByTestId('reviewer-current');
        await user.selectOptions(screen.getByTestId('reviewer-select'), String(ALEX.id));
        await user.click(screen.getByRole('button', { name: 'Save reviewer' }));

        expect(await screen.findByTestId('reviewer-save-error')).toHaveTextContent('could not be confirmed');
        expect(screen.getByTestId('reviewer-current')).toHaveTextContent('Maria Manager (manager)');
        expect(screen.queryByTestId('reviewer-notice')).not.toBeInTheDocument();
    });
});

describe('BranchNotificationReviewerModal — permissions and load failures', () => {
    it('shows a read-only view, without selector or save button, when the actor cannot manage', async () => {
        getMock.mockResolvedValue(
            respond(configuredWith(MARIA, { candidates: [], capabilities: { can_manage: false } })),
        );

        renderModal();

        expect(await screen.findByTestId('reviewer-current')).toHaveTextContent('Maria Manager (manager)');
        expect(screen.getByTestId('reviewer-read-only')).toHaveTextContent('do not have permission to change it');
        expect(screen.queryByTestId('reviewer-select')).not.toBeInTheDocument();
        expect(screen.queryByTestId('reviewer-empty')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Save reviewer' })).not.toBeInTheDocument();
    });

    it('shows a no-permission state when the backend answers 403', async () => {
        getMock.mockRejectedValue(apiError(403, 'You do not have access to this branch.'));

        renderModal();

        expect(await screen.findByTestId('reviewer-forbidden')).toHaveTextContent('do not have permission to view');
        expect(screen.queryByTestId('reviewer-select')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Save reviewer' })).not.toBeInTheDocument();
    });

    it('shows a not-available state when the backend answers 404', async () => {
        getMock.mockRejectedValue(apiError(404, 'Branch not found.'));

        renderModal();

        expect(await screen.findByTestId('reviewer-not-found')).toHaveTextContent('This branch is not available.');
    });

    it('shows a load error with a retry that reads the configuration again', async () => {
        const user = userEvent.setup();
        getMock.mockRejectedValueOnce(apiError(500, 'Request failed (500)'));
        getMock.mockResolvedValueOnce(respond(configuredWith(MARIA)));

        renderModal();

        expect(await screen.findByTestId('reviewer-load-error')).toHaveTextContent('Request failed (500)');
        await user.click(screen.getByRole('button', { name: 'Try again' }));

        expect(await screen.findByTestId('reviewer-current')).toHaveTextContent('Maria Manager (manager)');
        expect(getMock).toHaveBeenCalledTimes(2);
    });

    it('calls onClose from both close controls', async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();
        getMock.mockResolvedValue(respond(makeConfig()));

        renderModal({ onClose });
        await screen.findByTestId('reviewer-select');

        const closeButtons = screen.getAllByRole('button', { name: 'Close' });
        expect(closeButtons).toHaveLength(2);
        for (const button of closeButtons) await user.click(button);
        expect(onClose).toHaveBeenCalledTimes(2);
    });
});

describe('BranchNotificationReviewerModal — tenant and branch isolation', () => {
    it('refuses to display a payload that describes another branch', async () => {
        getMock.mockResolvedValue(respond(configuredWith(MARIA, { branch_id: 999 })));

        renderModal();

        expect(await screen.findByTestId('reviewer-load-error')).toHaveTextContent('unexpected response');
        expect(screen.queryByTestId('reviewer-select')).not.toBeInTheDocument();
        expect(screen.queryByText('Maria Manager (manager)')).not.toBeInTheDocument();
    });

    it('never applies a late response of the previous branch after switching branch', async () => {
        const first = deferred<BranchNotificationReviewerResponse>();
        const second = deferred<BranchNotificationReviewerResponse>();
        getMock.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

        const { rerender } = renderModal({ branchId: 1, branchName: 'Branch One' });
        rerender(
            <BranchNotificationReviewerModal branchId={2} branchName="Branch Two" tenantId={1} onClose={vi.fn()} />,
        );

        second.resolve(respond(configuredWith(ALEX, { branch_id: 2, candidates: [ALEX] })));
        expect(await screen.findByTestId('reviewer-current')).toHaveTextContent('Alex Admin (admin)');

        // The slow answer for branch 1 arrives last and must be ignored.
        first.resolve(respond(configuredWith(MARIA, { branch_id: 1, candidates: [MARIA] })));
        await new Promise((r) => setTimeout(r, 0));

        expect(screen.getByTestId('reviewer-current')).toHaveTextContent('Alex Admin (admin)');
        expect(screen.queryByText('Maria Manager (manager)')).not.toBeInTheDocument();
        expect(screen.getByTestId('reviewer-branch-name')).toHaveTextContent('Branch Two');
        expect(getMock).toHaveBeenNthCalledWith(1, 1);
        expect(getMock).toHaveBeenNthCalledWith(2, 2);
    });

    it('discards the loaded configuration and pending selection when the tenant changes', async () => {
        const user = userEvent.setup();
        const reloaded = deferred<BranchNotificationReviewerResponse>();
        getMock.mockResolvedValueOnce(respond(configuredWith(MARIA))).mockReturnValueOnce(reloaded.promise);

        const { rerender } = renderModal({ tenantId: 1 });
        await screen.findByTestId('reviewer-current');
        await user.selectOptions(screen.getByTestId('reviewer-select'), String(ALEX.id));

        rerender(
            <BranchNotificationReviewerModal branchId={BRANCH_ID} branchName="Central Branch" tenantId={2} onClose={vi.fn()} />,
        );

        expect(screen.getByTestId('reviewer-loading')).toBeInTheDocument();
        expect(screen.queryByTestId('reviewer-select')).not.toBeInTheDocument();
        expect(screen.queryByText('Maria Manager (manager)')).not.toBeInTheDocument();
    });

    it('sends only the branch and the chosen user to the API layer, never a tenant', async () => {
        const user = userEvent.setup();
        getMock.mockResolvedValue(respond(makeConfig()));
        putMock.mockResolvedValue(respond(configuredWith(MARIA), 'created'));

        renderModal();
        await screen.findByTestId('reviewer-select');
        await user.selectOptions(screen.getByTestId('reviewer-select'), String(MARIA.id));
        await user.click(screen.getByRole('button', { name: 'Save reviewer' }));
        await screen.findByTestId('reviewer-notice');

        expect(putMock).toHaveBeenCalledTimes(1);
        expect(putMock.mock.calls[0]).toEqual([BRANCH_ID, MARIA.id]);
    });
});

describe('BranchNotificationReviewerModal — reviewer is not lead owner nor ticket assignee', () => {
    it('states the difference in English and offers no owner or assignee control', async () => {
        getMock.mockResolvedValue(respond(configuredWith(MARIA)));

        renderModal();
        await screen.findByTestId('reviewer-current');

        expect(screen.getByTestId('reviewer-explanation')).toHaveTextContent(
            'Receives alerts for unassigned leads and tickets. This does not assign ownership of the lead or responsibility for the ticket.',
        );
        const legend = screen.getByTestId('reviewer-roles-legend');
        expect(within(legend).getByText('Notification reviewer')).toBeInTheDocument();
        expect(within(legend).getByText('Lead owner')).toBeInTheDocument();
        expect(within(legend).getByText('Ticket assignee')).toBeInTheDocument();
        expect(within(legend).getByText('Set on each lead.')).toBeInTheDocument();
        expect(within(legend).getByText('Set on each ticket.')).toBeInTheDocument();
        expect(
            screen.getByText(/never changes a lead owner or a ticket assignee/i),
        ).toBeInTheDocument();
        // The only selector in the dialog is the reviewer's.
        expect(screen.getAllByRole('combobox')).toHaveLength(1);
    });

    it('saving a reviewer calls nothing but the reviewer endpoint', async () => {
        const user = userEvent.setup();
        getMock.mockResolvedValue(respond(makeConfig()));
        putMock.mockResolvedValue(respond(configuredWith(MARIA), 'created'));

        renderModal();
        await screen.findByTestId('reviewer-select');
        await user.selectOptions(screen.getByTestId('reviewer-select'), String(MARIA.id));
        await user.click(screen.getByRole('button', { name: 'Save reviewer' }));
        await screen.findByTestId('reviewer-notice');

        expect(api.get).not.toHaveBeenCalled();
        expect(getMock).toHaveBeenCalledTimes(1);
        expect(putMock).toHaveBeenCalledTimes(1);
    });
});
