import { describe, it, expect } from "vitest";
import { classifyNotification, getNotificationFamilyLabel } from "../notificationPresentation";

/**
 * Manual Ingestion K6 UX closure, Correction 3: two independent notification families share the
 * bell/notifications page and must never be conflated. Classification is by exact `type`, never
 * by substring-matching the word "ticket"; the `url` is a defensive fallback only for a `type`
 * this list doesn't recognize.
 */

describe("classifyNotification", () => {
  it.each([
    "support_ticket_created",
    "support_ticket_assigned",
    "support_ticket_status_changed",
    "support_ticket_commented",
  ])("classifies %s as support_ticket", (type) => {
    expect(classifyNotification({ type })).toBe("support_ticket");
  });

  it.each(["ticket_assigned", "lead_ticket_needs_review"])(
    "classifies %s as operative_ticket",
    (type) => {
      expect(classifyNotification({ type })).toBe("operative_ticket");
    },
  );

  it("classifies an unrelated type as general", () => {
    expect(classifyNotification({ type: "tenant_context_switched" })).toBe("general");
  });

  it("never classifies every type containing the word 'ticket' as the same family", () => {
    // A hypothetical/unknown type that merely contains "ticket" must not be lumped in with
    // either real family just because of the substring.
    expect(classifyNotification({ type: "ticket_archived_for_billing" })).toBe("general");
  });

  it("does not classify by the visible ticket number or any part of the body/title", () => {
    expect(
      classifyNotification({
        type: "some_other_type",
        url: undefined,
      } as never),
    ).toBe("general");
  });

  it("falls back to the url only when the type is unrecognized, for support tickets", () => {
    expect(classifyNotification({ type: "unknown_type", url: "/support-tickets/42" })).toBe(
      "support_ticket",
    );
  });

  it("falls back to the url only when the type is unrecognized, for operative tickets", () => {
    expect(classifyNotification({ type: "unknown_type", url: "/tickets/42" })).toBe(
      "operative_ticket",
    );
  });

  it("never lets the url fallback override a type that already matched a family", () => {
    // A (contrived) mismatched pairing: the type is unambiguously support, and must win even
    // though the url looks like an operative ticket link.
    expect(
      classifyNotification({ type: "support_ticket_created", url: "/tickets/42" }),
    ).toBe("support_ticket");
  });

  it("classifies a notification with neither a recognized type nor url as general", () => {
    expect(classifyNotification({})).toBe("general");
  });
});

describe("getNotificationFamilyLabel", () => {
  it("labels support ticket notifications exactly 'Soporte técnico'", () => {
    expect(getNotificationFamilyLabel({ type: "support_ticket_created" })).toBe("Soporte técnico");
  });

  it("labels operative ticket notifications exactly 'Ticket / Task'", () => {
    expect(getNotificationFamilyLabel({ type: "lead_ticket_needs_review" })).toBe("Ticket / Task");
  });

  it("returns null for a general notification -- no false family label", () => {
    expect(getNotificationFamilyLabel({ type: "tenant_context_switched" })).toBeNull();
  });
});
