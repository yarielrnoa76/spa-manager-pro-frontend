import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../services/api';

/**
 * Tickets / Tasks global surface -- the ONE reusable ticket-assignment authority for the
 * browser, shared by `LeadModal`'s own Tickets tab and the new global Tickets/Tasks surface.
 * There is deliberately no second implementation of "decide, confirm and submit a ticket
 * assignment" anywhere in this codebase.
 *
 * Candidates and capabilities come exclusively from `GET /tickets/{ticket}/assignment-context`
 * -- never `api.listUsers()`, which is neither tenant/branch/policy-filtered for this purpose
 * nor gated by whether the actor can assign at all. The backend remains the final authority:
 * this hook only decides WHEN to ask the user a question and WHAT to send: the server
 * re-validates everything (actor, target, tenant, branch, terminal status, preconditions) again
 * inside its own transaction.
 */

export type TicketAssignmentCandidate = { id: number; name: string; role: string | null };

export type TicketAssignmentContext = {
  ticket_status: string;
  ticket_responsable_id: number | null;
  lead_responsable_id: number | null;
  capabilities: {
    is_terminal: boolean;
    can_assign: boolean;
    can_deassign: boolean;
    can_reassign_lead: boolean;
  };
  candidates: TicketAssignmentCandidate[];
};

export type TicketAssignmentContextState = 'idle' | 'loading' | 'forbidden' | 'error' | 'success';

export type TicketAssignmentPayload = {
  responsable_id: number | null;
  reassign_lead: boolean;
  expected_responsable_id: number | null;
  expected_lead_assigned_to?: number | null;
};

type PendingDecision = {
  kind: 'assign' | 'deassign';
  targetId: number | null;
  targetName: string | null;
  currentResponsableName: string | null;
  leadResponsableName: string | null;
  expectedResponsableId: number | null;
  expectedLeadAssignedTo: number | null;
};

export type UseTicketAssignmentControlOptions = {
  ticketId: number | null;
  /**
   * Sends the decided payload to the server. Callers differ only here: the global surface calls
   * `api.assignTicket()` (assignment-only, `POST /assign`); `LeadModal` bundles it with its own
   * editorial fields into `api.updateTicket()` (`PUT`, one atomic transaction) so an edit and a
   * reassignment made together still commit or roll back as one.
   */
  onSubmit: (payload: TicketAssignmentPayload) => Promise<void>;
  /** Called after a successful submit or a 409 reload, so the caller can refresh its own ticket detail. */
  onSettled?: () => void;
};

export function useTicketAssignmentControl({ ticketId, onSubmit, onSettled }: UseTicketAssignmentControlOptions) {
  const [context, setContext] = useState<TicketAssignmentContext | null>(null);
  const [contextState, setContextState] = useState<TicketAssignmentContextState>('idle');
  const [pending, setPending] = useState<PendingDecision | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (ticketId === null) {
      setContext(null);
      setContextState('idle');
      return;
    }
    setContextState('loading');
    try {
      const ctx = await api.getTicketAssignmentContext(ticketId);
      setContext(ctx);
      setContextState('success');
    } catch (err: unknown) {
      setContext(null);
      const status = err instanceof ApiError ? err.status : undefined;
      setContextState(status === 403 ? 'forbidden' : 'error');
        }
  }, [ticketId]);

  useEffect(() => {
    void load();
  }, [load]);

  // A pending decision or stale error belongs to the PREVIOUS ticket; switching to another
  // ticket (or to none) must never display it against the new one, not even for a frame.
  useEffect(() => {
    setPending(null);
    setError(null);
  }, [ticketId]);

  const nameOf = useCallback(
    (id: number | null): string | null => {
      if (id === null) return null;
      return context?.candidates.find((c) => c.id === id)?.name ?? `#${id}`;
    },
    [context],
  );

  const submitDecision = useCallback(
    async (decision: PendingDecision, reassignLead: boolean) => {
      setSubmitting(true);
      setError(null);
      try {
        await onSubmit({
          responsable_id: decision.targetId,
          reassign_lead: reassignLead,
          expected_responsable_id: decision.expectedResponsableId,
          ...(reassignLead ? { expected_lead_assigned_to: decision.expectedLeadAssignedTo } : {}),
        });
        setPending(null);
        await load();
        onSettled?.();
      } catch (err: unknown) {
        const status = err instanceof ApiError ? err.status : undefined;
        if (status === 409) {
          setPending(null);
          await load();
          onSettled?.();
          setError(
            'Otro usuario modificó la asignación de este ticket o su lead mientras decidías. ' +
            'Se recargó el estado actual; revísalo antes de volver a decidir.',
          );
        } else {
          setError(err instanceof Error ? err.message : 'No se pudo actualizar la asignación.');
        }
      } finally {
        setSubmitting(false);
      }
    },
    [onSubmit, load, onSettled],
  );

  /**
   * Called when the user picks a new target (or clears the selection) in the responsable
   * control. A target that already matches the lead's own assignee raises no divergence to
   * resolve and is submitted directly as ticket-only; anything else opens the three-option
   * dialog. Picking the currently-observed value is a no-op.
   */
  const requestChange = useCallback(
    (targetId: number | null) => {
      if (!context) return;
      const current = context.ticket_responsable_id;
      if (targetId === current) return;

      const leadResponsable = context.lead_responsable_id;
      const decision: PendingDecision = {
        kind: targetId === null ? 'deassign' : 'assign',
        targetId,
        targetName: nameOf(targetId),
        currentResponsableName: nameOf(current),
        leadResponsableName: nameOf(leadResponsable),
        expectedResponsableId: current,
        expectedLeadAssignedTo: leadResponsable,
      };

      if (targetId !== null && targetId === leadResponsable) {
        void submitDecision(decision, false);
        return;
      }

      setError(null);
      setPending(decision);
    },
    [context, nameOf, submitDecision],
  );

  const confirm = useCallback(
    (reassignLead: boolean) => {
      if (!pending) return;
      void submitDecision(pending, reassignLead);
    },
    [pending, submitDecision],
  );

  const cancel = useCallback(() => {
    setPending(null);
    setError(null);
  }, []);

  return {
    context,
    contextState,
    pending,
    error,
    submitting,
    requestChange,
    confirm,
    cancel,
    reload: load,
  };
}
