import React from 'react';
import {
  TicketAssignmentContext,
  TicketAssignmentContextState,
} from '../hooks/useTicketAssignmentControl';

/**
 * Tickets / Tasks global surface -- the ONE reusable assignment UI, rendered identically by the
 * lead's own Tickets tab (`LeadModal`) and the global Tickets/Tasks surface. Pairs with
 * `useTicketAssignmentControl` (which owns all the decision/submission logic); this component is
 * presentation only.
 *
 * A ticket the actor cannot assign or deassign renders a read-only badge, never a `<select>` --
 * there is nothing this control lets Sales, or a Manager facing a ticket's first assignment, do
 * that the backend would not itself reject; hiding it here just avoids a guaranteed 422 round
 * trip and an unauthorized-looking control.
 */

export function TicketResponsableSelect({
  context,
  contextState,
  currentResponsableName,
  onChange,
  disabled,
}: {
  context: TicketAssignmentContext | null;
  contextState: TicketAssignmentContextState;
  /** Display name for the currently-assigned responsable, when known, for the read-only badge. */
  currentResponsableName?: string | null;
  onChange: (targetId: number | null) => void;
  disabled?: boolean;
}) {
  if (contextState === 'loading' || contextState === 'idle') {
    return <p className="text-xs text-gray-400 italic" data-testid="ticket-assignment-loading">Cargando responsable...</p>;
  }

  if (contextState === 'forbidden' || contextState === 'error' || context === null) {
    return (
      <p className="text-xs text-gray-500 italic" data-testid="ticket-assignment-unavailable">
        {currentResponsableName ?? 'Sin asignar'}
      </p>
    );
  }

  const canChange = (context.capabilities.can_assign || context.capabilities.can_deassign) && !context.capabilities.is_terminal;

  if (!canChange) {
    return (
      <p className="text-sm text-gray-700 font-medium" data-testid="ticket-assignment-readonly">
        {currentResponsableName ?? 'Sin asignar'}
      </p>
    );
  }

  // Adversarial correction, defect 8: the ticket's current responsable might no longer pass the
  // candidate filter (e.g. moved to another branch since assignment). `current_responsable` is
  // never folded into `candidates` — it is rendered here as its own, explicitly non-selectable
  // option, so the control can never look "unassigned" when it is not, and can never let the
  // actor silently re-confirm someone who is no longer a valid target.
  const currentId = context.ticket_responsable_id;
  const isOrphaned = currentId !== null && !context.candidates.some((c) => c.id === currentId);

  return (
    <select
      data-testid="ticket-assignment-select"
      className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
      value={context.ticket_responsable_id ?? ''}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
    >
      <option value="">-- Sin asignar --</option>
      {isOrphaned && context.current_responsable && (
        <option key={context.current_responsable.id} value={context.current_responsable.id} disabled data-testid="ticket-assignment-orphaned-current">
          {context.current_responsable.name} (actual, ya no asignable)
        </option>
      )}
      {context.candidates.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}{c.role ? ` (${c.role})` : ''}
        </option>
      ))}
    </select>
  );
}

export function TicketAssignmentDialog({
  ticketNumber,
  pending,
  error,
  submitting,
  canReassignLead,
  onConfirm,
  onCancel,
}: {
  ticketNumber: string;
  pending: {
    kind: 'assign' | 'deassign';
    targetName: string | null;
    leadResponsableName: string | null;
  } | null;
  error: string | null;
  submitting: boolean;
  /**
   * Adversarial correction, defect 2: mirrors `assignment-context`'s own
   * `capabilities.can_reassign_lead` — `false` when the actor cannot write the lead, no lead is
   * accessible, or the ticket is terminal. "Ticket y lead" is never offered in that case; the
   * backend's own `LeadPolicy::update()` gate remains the final authority regardless of what this
   * dialog renders.
   */
  canReassignLead: boolean;
  onConfirm: (reassignLead: boolean) => void;
  onCancel: () => void;
}) {
  if (!pending) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4">
      <div
        data-testid="assignment-dialog"
        role="dialog"
        className="bg-white rounded-xl shadow-lg w-full max-w-sm p-6 space-y-4"
      >
        <h3 className="text-lg font-bold text-gray-900">
          {pending.kind === 'deassign' ? 'Quitar responsable' : 'Cambiar responsable'}
        </h3>
        <p data-testid="assignment-dialog-question" className="text-sm text-gray-700 leading-relaxed">
          {pending.kind === 'deassign'
            ? `Este ticket ${ticketNumber} pertenece a un lead actualmente asignado a ${pending.leadResponsableName ?? 'nadie'}. ¿Deseas quitar también el responsable del lead?`
            : `Este ticket ${ticketNumber} pertenece a un lead actualmente asignado a ${pending.leadResponsableName ?? 'nadie'}. ¿Deseas asignar también el lead a ${pending.targetName ?? ''}?`}
        </p>
        <div className="flex flex-col gap-2">
          <button
            data-testid="assignment-dialog-ticket-only"
            disabled={submitting}
            onClick={() => onConfirm(false)}
            className="w-full py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition"
          >
            {pending.kind === 'deassign' ? 'Desasignar solo el ticket' : 'Solo el ticket'}
          </button>
          {canReassignLead && (
            <button
              data-testid="assignment-dialog-ticket-and-lead"
              disabled={submitting}
              onClick={() => onConfirm(true)}
              className="w-full py-2 bg-indigo-50 text-indigo-700 border border-indigo-200 text-sm font-bold rounded-lg hover:bg-indigo-100 disabled:opacity-50 transition"
            >
              {pending.kind === 'deassign' ? 'Desasignar ticket y lead' : 'Ticket y lead'}
            </button>
          )}
          <button
            data-testid="assignment-dialog-cancel"
            disabled={submitting}
            onClick={onCancel}
            className="w-full py-2 text-gray-500 text-sm font-semibold hover:bg-gray-50 rounded-lg transition"
          >
            Cancelar
          </button>
        </div>
        {error && (
          <p data-testid="assignment-dialog-error" className="text-xs font-bold text-red-600">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
