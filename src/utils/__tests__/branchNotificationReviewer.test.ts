import { describe, it, expect } from "vitest";
import {
  GENERIC_INELIGIBLE_MESSAGE,
  readReviewerResponse,
  reviewerDisplay,
  reviewerLabel,
  reviewerReasonMessage,
} from "../branchNotificationReviewer";
import type { BranchNotificationReviewer } from "../../types";

function config(overrides: Partial<BranchNotificationReviewer> = {}): BranchNotificationReviewer {
  return {
    branch_id: 7,
    user_id: null,
    user: null,
    status: "not_configured",
    invalid_reason: null,
    candidates: [],
    capabilities: { can_manage: false },
    ...overrides,
  };
}

describe("reviewerReasonMessage", () => {
  // The backend's closed vocabulary (LeadTicketReviewerResolver::REASON_*); each one must read as
  // a sentence, and none may leak the raw code.
  const known = [
    "user_not_found_or_deleted",
    "user_does_not_belong_to_tenant",
    "user_is_branch_restricted_to_another_branch",
    "user_lacks_view_ticket",
    "user_lacks_assign_ticket",
    "user_ticket_scope_is_own_or_incompatible_branch",
    "user_lacks_view_leads",
    "user_lacks_view_unassigned_leads",
    "user_lacks_assign_lead",
    "user_lead_scope_is_own_or_incompatible_branch",
    "multiple_enabled_recipients",
  ];

  it.each(known)("turns %s into an English sentence without the raw code", (code) => {
    const message = reviewerReasonMessage(code);
    expect(message).not.toContain("_");
    expect(message.endsWith(".")).toBe(true);
    expect(message).not.toBe(GENERIC_INELIGIBLE_MESSAGE);
  });

  it("uses the generic sentence for an unknown, empty or missing reason", () => {
    expect(reviewerReasonMessage("something_new")).toBe(GENERIC_INELIGIBLE_MESSAGE);
    expect(reviewerReasonMessage("")).toBe(GENERIC_INELIGIBLE_MESSAGE);
    expect(reviewerReasonMessage(null)).toBe(GENERIC_INELIGIBLE_MESSAGE);
    expect(reviewerReasonMessage(undefined)).toBe(GENERIC_INELIGIBLE_MESSAGE);
  });
});

describe("reviewer names", () => {
  it("labels a person with their role when known", () => {
    expect(reviewerLabel({ name: "Maria", role: "manager" })).toBe("Maria (manager)");
    expect(reviewerLabel({ name: "Maria", role: null })).toBe("Maria");
    expect(reviewerLabel({ name: null, role: null })).toBe("Unavailable user");
  });

  it("never names a platform account, and never shows an id", () => {
    expect(reviewerDisplay({ id: 1, name: null, role: null, is_platform_account: true })).toBe("Platform account");
    expect(reviewerDisplay({ id: 1, name: null, role: null, is_platform_account: false })).toBe("Unavailable user");
    expect(reviewerDisplay(null)).toBe("Unavailable user");
  });
});

describe("readReviewerResponse", () => {
  it("accepts only a payload for the requested branch", () => {
    expect(readReviewerResponse({ data: config({ branch_id: 7 }) }, 7)).not.toBeNull();
    expect(readReviewerResponse({ data: config({ branch_id: 8 }) }, 7)).toBeNull();
  });

  it("rejects an empty, malformed or incomplete response", () => {
    expect(readReviewerResponse(null, 7)).toBeNull();
    expect(readReviewerResponse(undefined, 7)).toBeNull();
    expect(readReviewerResponse({} as never, 7)).toBeNull();
    expect(readReviewerResponse({ data: { ...config(), candidates: undefined } } as never, 7)).toBeNull();
    expect(readReviewerResponse({ data: { ...config(), capabilities: undefined } } as never, 7)).toBeNull();
  });
});
