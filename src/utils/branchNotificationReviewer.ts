import type {
  BranchNotificationReviewer,
  BranchNotificationReviewerResponse,
  BranchNotificationReviewerUser,
} from "../types";

/**
 * Presentation helpers for the branch default notification reviewer. Pure functions only: the
 * backend stays the sole authority on who is eligible, so nothing here decides eligibility -- it
 * only turns the backend's closed reason codes into readable English.
 */

export const REVIEWER_EXPLANATION =
  "Receives alerts for unassigned leads and tickets. This does not assign ownership of the lead or responsibility for the ticket.";

export const REVIEWER_OWNERSHIP_NOTE =
  "Choosing a reviewer never changes a lead owner or a ticket assignee. Those are set on each lead and each ticket.";

const REASON_MESSAGES: Record<string, string> = {
  user_not_found_or_deleted: "This user is not available for this branch.",
  user_does_not_belong_to_tenant: "This user is not available for this branch.",
  user_is_branch_restricted_to_another_branch: "This user is restricted to a different branch.",
  user_lacks_view_ticket: "This user's role cannot view tickets.",
  user_lacks_assign_ticket: "This user's role cannot assign tickets.",
  user_ticket_scope_is_own_or_incompatible_branch:
    "This user's ticket access does not cover this branch.",
  user_lacks_view_leads: "This user's role cannot view leads.",
  user_lacks_view_unassigned_leads: "This user's role cannot view unassigned leads.",
  user_lacks_assign_lead: "This user's role cannot assign leads.",
  user_lead_scope_is_own_or_incompatible_branch:
    "This user's lead access does not cover this branch.",
  multiple_enabled_recipients:
    "More than one reviewer is enabled for this branch. Saving a selection keeps only the one you choose.",
};

export const GENERIC_INELIGIBLE_MESSAGE =
  "The selected user cannot be designated as the notification reviewer for this branch.";

/** A readable sentence for a closed backend reason code; never echoes an unknown code. */
export function reviewerReasonMessage(reason: string | null | undefined): string {
  if (!reason) return GENERIC_INELIGIBLE_MESSAGE;
  return REASON_MESSAGES[reason] ?? GENERIC_INELIGIBLE_MESSAGE;
}

/** "Name (role)", or just the name when the role is unknown. */
export function reviewerLabel(person: { name: string | null; role: string | null }): string {
  const name = person.name ?? "Unavailable user";
  return person.role ? `${name} (${person.role})` : name;
}

/** How the configured reviewer is named: never an id, and a platform account never by name. */
export function reviewerDisplay(user: BranchNotificationReviewerUser | null): string {
  if (user === null) return "Unavailable user";
  if (user.is_platform_account) return "Platform account";
  return reviewerLabel(user);
}

/**
 * Accepts a response only when it describes the branch that was asked for. A payload for any
 * other branch is never shown, so a stale or misrouted response cannot leak across branches.
 */
export function readReviewerResponse(
  response: BranchNotificationReviewerResponse | null | undefined,
  branchId: number,
): BranchNotificationReviewer | null {
  const data = response?.data;
  if (!data || Number(data.branch_id) !== branchId) return null;
  if (!data.capabilities || !Array.isArray(data.candidates)) return null;
  return data;
}
