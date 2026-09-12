import { format } from "date-fns";
import type { Ticket, TicketComment } from "../types";

/**
 * Presentation-only mapping for operative Ticket/Task statuses. The internal values sent to and
 * received from the backend (`New`/`InProgress`/`Completed`/`Cancelled`) never change — this is
 * exclusively what the user reads on screen.
 */
export const TICKET_STATUS_LABELS: Record<Ticket["status"], string> = {
  New: "Nuevo",
  InProgress: "En tratamiento",
  Completed: "Completado",
  Cancelled: "Cancelado",
};

export function getTicketStatusLabel(status: string): string {
  return (TICKET_STATUS_LABELS as Record<string, string>)[status] ?? status;
}

type TicketCommentAuthorSource = Pick<TicketComment, "creator" | "created_by">;

/**
 * A comment's author, never a bare id. Priority: `creator.name` (even when `created_by` is
 * serialized as a string) > a neutral "unavailable" fallback carrying the id > `Sistema` only
 * when neither is present at all. An absent `creator` is never assumed to mean the user was
 * deleted -- it may just as well be visibility, historical-record integrity, or another
 * controlled reason, so the fallback names the id without asserting a specific cause.
 */
export function getTicketCommentAuthorLabel(comment: TicketCommentAuthorSource): string {
  const creatorName = comment.creator?.name;
  if (creatorName) return creatorName;

  const createdBy = comment.created_by;
  if (createdBy !== null && createdBy !== undefined && createdBy !== "") {
    return `Usuario no disponible (#${createdBy})`;
  }

  return "Sistema";
}

/** Full date, hour and minutes -- never a truncated day/month-only stamp. */
export function getTicketCommentTimestampLabel(createdAt: string): string {
  return format(new Date(createdAt), "dd/MM/yyyy HH:mm");
}
