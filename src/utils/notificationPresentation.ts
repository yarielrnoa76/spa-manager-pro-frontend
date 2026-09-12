/**
 * Two independent notification families share the bell/notifications page but resolve to
 * different modules and must never be conflated:
 *   - Support ticket notifications (`support_ticket_*`) -> `/support-tickets/{id}` -> Soporte
 *     Técnico.
 *   - Operative Ticket/Task notifications (`ticket_assigned`, `lead_ticket_needs_review`) ->
 *     `/tickets/{id}` -> Tickets / Tasks.
 * Classification is primarily by `type` (exact, never a substring match on the word "ticket"),
 * with the notification's own `url` used only as a defensive fallback for a `type` this list
 * doesn't recognize -- it never overrides a `type` that already matched one of the two families.
 */

export type NotificationFamily = "support_ticket" | "operative_ticket" | "general";

const SUPPORT_TICKET_TYPE_PREFIX = "support_ticket_";

const OPERATIVE_TICKET_TYPES = new Set<string>(["ticket_assigned", "lead_ticket_needs_review"]);

export const NOTIFICATION_FAMILY_LABELS: Record<NotificationFamily, string | null> = {
  support_ticket: "Soporte técnico",
  operative_ticket: "Ticket / Task",
  general: null,
};

export interface NotificationFamilyInput {
  type?: string | null;
  url?: string | null;
}

export function classifyNotification(notification: NotificationFamilyInput): NotificationFamily {
  const type = notification.type ?? "";

  if (type.startsWith(SUPPORT_TICKET_TYPE_PREFIX)) return "support_ticket";
  if (OPERATIVE_TICKET_TYPES.has(type)) return "operative_ticket";

  // Defensive fallback ONLY for a `type` neither list above recognizes -- never a way to
  // reclassify a type that already matched one of the two families.
  const url = notification.url ?? "";
  if (url.includes("/support-tickets/")) return "support_ticket";
  if (url.includes("/tickets/")) return "operative_ticket";

  return "general";
}

export function getNotificationFamilyLabel(notification: NotificationFamilyInput): string | null {
  return NOTIFICATION_FAMILY_LABELS[classifyNotification(notification)];
}
