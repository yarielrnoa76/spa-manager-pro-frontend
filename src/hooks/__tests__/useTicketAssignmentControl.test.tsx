import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useTicketAssignmentControl } from '../useTicketAssignmentControl';
import { api, ApiError } from '../../services/api';

/**
 * Tickets/Tasks global surface (§10/§11) — the ONE reusable ticket-assignment decision/
 * submission authority, shared by `LeadModal`'s Tickets tab and the global Tickets/Tasks
 * surface. Exercises the hook in isolation from either caller's own rendering.
 */

vi.mock('../../services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/api')>();
  return {
    ...actual,
    api: {
      getTicketAssignmentContext: vi.fn(),
    },
  };
});

const context = (overrides: Partial<Awaited<ReturnType<typeof api.getTicketAssignmentContext>>> = {}) => ({
  ticket_status: 'New',
  ticket_responsable_id: 7,
  lead_responsable_id: 7,
  capabilities: { is_terminal: false, can_assign: true, can_deassign: true, can_reassign_lead: true },
  candidates: [
    { id: 7, name: 'Alice', role: 'sales' },
    { id: 9, name: 'Bruno', role: 'sales' },
  ],
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.getTicketAssignmentContext).mockResolvedValue(context());
});

describe('useTicketAssignmentControl', () => {
  it('loads the assignment context for the given ticket id', async () => {
    const { result } = renderHook(() =>
      useTicketAssignmentControl({ ticketId: 100, onSubmit: vi.fn() }),
    );

    await waitFor(() => expect(result.current.contextState).toBe('success'));
    expect(api.getTicketAssignmentContext).toHaveBeenCalledWith(100);
    expect(result.current.context?.candidates).toHaveLength(2);
  });

  it('reports forbidden vs error distinctly, never conflating them', async () => {
    vi.mocked(api.getTicketAssignmentContext).mockRejectedValueOnce(new ApiError('nope', { status: 403 }));
    const { result, rerender } = renderHook(
      ({ id }) => useTicketAssignmentControl({ ticketId: id, onSubmit: vi.fn() }),
      { initialProps: { id: 1 } },
    );
    await waitFor(() => expect(result.current.contextState).toBe('forbidden'));

    vi.mocked(api.getTicketAssignmentContext).mockRejectedValueOnce(new ApiError('boom', { status: 500 }));
    rerender({ id: 2 });
    await waitFor(() => expect(result.current.contextState).toBe('error'));
  });

  it('a target equal to the current responsable is a no-op: no dialog, no submit', async () => {
    const onSubmit = vi.fn();
    const { result } = renderHook(() => useTicketAssignmentControl({ ticketId: 100, onSubmit }));
    await waitFor(() => expect(result.current.contextState).toBe('success'));

    act(() => result.current.requestChange(7));

    expect(result.current.pending).toBeNull();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('a target that differs from both the current and lead responsable opens the dialog', async () => {
    const onSubmit = vi.fn();
    const { result } = renderHook(() => useTicketAssignmentControl({ ticketId: 100, onSubmit }));
    await waitFor(() => expect(result.current.contextState).toBe('success'));

    act(() => result.current.requestChange(9));

    expect(result.current.pending).toMatchObject({ kind: 'assign', targetId: 9 });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('a target that already matches the lead responsable submits directly, ticket-only', async () => {
    vi.mocked(api.getTicketAssignmentContext).mockResolvedValue(
      context({ ticket_responsable_id: null, lead_responsable_id: 9 }),
    );
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useTicketAssignmentControl({ ticketId: 100, onSubmit }));
    await waitFor(() => expect(result.current.contextState).toBe('success'));

    await act(async () => result.current.requestChange(9));

    expect(result.current.pending).toBeNull();
    expect(onSubmit).toHaveBeenCalledWith({
      responsable_id: 9,
      reassign_lead: false,
      expected_responsable_id: null,
    });
  });

  it('confirm(false) submits ticket-only without expected_lead_assigned_to', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useTicketAssignmentControl({ ticketId: 100, onSubmit }));
    await waitFor(() => expect(result.current.contextState).toBe('success'));

    act(() => result.current.requestChange(9));
    await act(async () => result.current.confirm(false));

    expect(onSubmit).toHaveBeenCalledWith({
      responsable_id: 9,
      reassign_lead: false,
      expected_responsable_id: 7,
    });
    expect(result.current.pending).toBeNull();
  });

  it('confirm(true) submits with expected_lead_assigned_to', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useTicketAssignmentControl({ ticketId: 100, onSubmit }));
    await waitFor(() => expect(result.current.contextState).toBe('success'));

    act(() => result.current.requestChange(9));
    await act(async () => result.current.confirm(true));

    expect(onSubmit).toHaveBeenCalledWith({
      responsable_id: 9,
      reassign_lead: true,
      expected_responsable_id: 7,
      expected_lead_assigned_to: 7,
    });
  });

  it('cancel discards the pending decision and sends nothing', async () => {
    const onSubmit = vi.fn();
    const { result } = renderHook(() => useTicketAssignmentControl({ ticketId: 100, onSubmit }));
    await waitFor(() => expect(result.current.contextState).toBe('success'));

    act(() => result.current.requestChange(9));
    expect(result.current.pending).not.toBeNull();

    act(() => result.current.cancel());

    expect(result.current.pending).toBeNull();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('a 409 clears the pending decision, reloads context and surfaces an explanatory error', async () => {
    const onSubmit = vi.fn().mockRejectedValueOnce(new ApiError('conflict', { status: 409 }));
    const onSettled = vi.fn();
    const { result } = renderHook(() => useTicketAssignmentControl({ ticketId: 100, onSubmit, onSettled }));
    await waitFor(() => expect(result.current.contextState).toBe('success'));

    act(() => result.current.requestChange(9));
    await act(async () => result.current.confirm(false));

    expect(result.current.pending).toBeNull();
    expect(result.current.error).toMatch(/Otro usuario modificó/i);
    expect(onSettled).toHaveBeenCalled();
    // Reloaded after the conflict.
    expect(api.getTicketAssignmentContext).toHaveBeenCalledTimes(2);
  });

  it('a non-409 failure keeps the dialog open with an inline error', async () => {
    const onSubmit = vi.fn().mockRejectedValueOnce(new Error('boom'));
    const { result } = renderHook(() => useTicketAssignmentControl({ ticketId: 100, onSubmit }));
    await waitFor(() => expect(result.current.contextState).toBe('success'));

    act(() => result.current.requestChange(9));
    await act(async () => result.current.confirm(false));

    expect(result.current.error).toMatch(/boom/i);
  });

  it('clears pending/error when the ticket id changes', async () => {
    const onSubmit = vi.fn();
    const { result, rerender } = renderHook(
      ({ id }) => useTicketAssignmentControl({ ticketId: id, onSubmit }),
      { initialProps: { id: 100 } },
    );
    await waitFor(() => expect(result.current.contextState).toBe('success'));
    act(() => result.current.requestChange(9));
    expect(result.current.pending).not.toBeNull();

    rerender({ id: 200 });

    expect(result.current.pending).toBeNull();
    expect(result.current.error).toBeNull();
  });
});
