// Phase 1B.5D Slice K6 (Manual Lead Creation Readiness Report, approved decisions §9): a durable,
// (tenant, acting user, content-digest) -> pending submission_uuid map for LeadModal's manual
// creation flow. Component state alone does not survive reload/reopen/network failure -- this
// does, without ever storing raw lead content, only the tenant id, the acting user id, a digest,
// and the server-facing uuid.
//
// A sibling instance of ImportLeadsModal.batchIdentity.ts's own, already-proven pattern (Slice
// K4) -- corrected for a single-lead payload's own field set and for an isolation dimension that
// module's own key does not need: two different authenticated users of the SAME tenant, sharing a
// browser profile, submitting identical lead content, must never share the same pending identity.
// `actingUserId` is used HERE ONLY to key local storage -- it carries no backend authority
// whatsoever; the server always resolves tenant/branch/actor from the authenticated session, never
// from anything this module produces.
//
// A separate module from LeadModal.tsx purely so these pure functions can be imported by both the
// component and its tests without a React "Fast Refresh only works when a file only exports
// components" lint violation -- no behavioral split is intended.
//
// Durability: an unresolved pending identity is never automatically expired -- there is no TTL,
// no background sweep, no silent pruning. It is removed ONLY by `clearPendingSubmission()` after a
// CONFIRMED terminal Kernel outcome (`Created` or `MatchedExisting`) or a confirmed idempotency
// conflict (409) -- never after a pre-Kernel validation error, since the identity was never
// consumed server-side in that case. Every failure mode that could otherwise corrupt or silently
// discard an existing identity (a missing tenant/actor id, an unreadable/corrupted store, an
// invalid existing entry, or a write that did not actually persist) throws instead -- always
// BEFORE the caller ever sends the network request, never silently falling back to a fresh uuid.

export interface LeadSubmissionFields {
  name: string;
  last_name: string;
  phone: string;
  email: string;
  branch_id: string;
  source: string;
  message: string;
  status: string;
  /** Empty string (or any falsy value) means "no explicit assignee" -- normalized below. */
  assigned_to: string;
}

interface PendingSubmissionEntry {
  uuid: string;
}

const PENDING_SUBMISSIONS_STORAGE_KEY = "spa.leads_manual.pending_submissions";

// Matches exactly what `crypto.randomUUID()` produces (RFC 4122 version 4): 8-4-4-4-12 hex
// digits, version nibble `4`, variant nibble `8|9|a|b`. A non-empty but non-UUID string (e.g. a
// corrupted/tampered `"not-a-uuid"`) must fail validation, not merely "any non-empty string".
const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidEntry(value: unknown): value is PendingSubmissionEntry {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { uuid?: unknown }).uuid === "string" &&
    UUID_V4_PATTERN.test((value as { uuid: string }).uuid)
  );
}

// Reads the whole store and returns it as a plain, untyped object -- fails closed (throws)
// whenever the store cannot be read at all or does not even parse as a JSON object. A missing key
// entirely (`localStorage.getItem` returns null -- first use, or nothing pending) is NOT
// corruption and returns `{}` normally. Does NOT validate individual entries here -- that is
// `readExistingEntry()`'s job, scoped to only the one key a caller actually needs, so corruption
// elsewhere in the map never blocks an unrelated (tenant, actor, digest) triple.
function readPendingSubmissionsRaw(): Record<string, unknown> {
  let raw: string | null;
  try {
    raw = localStorage.getItem(PENDING_SUBMISSIONS_STORAGE_KEY);
  } catch {
    throw new Error("Unable to read the pending lead-submission identity store.");
  }

  if (raw === null) {
    return {};
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("The pending lead-submission identity store is corrupted and could not be parsed.");
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("The pending lead-submission identity store is corrupted (not a JSON object).");
  }

  return parsed as Record<string, unknown>;
}

// An existing entry that fails validation fails closed -- never silently treated as absent and
// never silently overwritten with a freshly minted uuid.
function readExistingEntry(map: Record<string, unknown>, key: string): PendingSubmissionEntry | undefined {
  if (!(key in map)) {
    return undefined;
  }

  const value = map[key];

  if (!isValidEntry(value)) {
    throw new Error("An existing pending lead-submission identity is invalid; refusing to silently replace it.");
  }

  return value;
}

function writePendingSubmissions(map: Record<string, unknown>): void {
  try {
    localStorage.setItem(PENDING_SUBMISSIONS_STORAGE_KEY, JSON.stringify(map));
  } catch {
    throw new Error("Unable to persist the lead-submission identity (localStorage write failed).");
  }
}

// Canonical payload for hashing = the exact fields that determine `LeadIngestionResult`, in fixed
// order (Readiness Report §3.B's field-correspondence table) -- row order is part of the digest,
// same discipline as K4's own `canonicalLeadsPayload()`. `assigned_to` is normalized to an empty
// string when falsy, so an omitted vs. explicitly-empty assignee never produces two different
// digests for what is otherwise the identical submission.
export function canonicalLeadSubmissionPayload(fields: LeadSubmissionFields): string {
  return JSON.stringify([
    fields.name,
    fields.last_name,
    fields.phone,
    fields.email,
    fields.branch_id,
    fields.source,
    fields.message,
    fields.status,
    fields.assigned_to || "",
  ]);
}

export async function computeLeadSubmissionDigest(fields: LeadSubmissionFields): Promise<string> {
  const canonical = canonicalLeadSubmissionPayload(fields);
  const digestBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical));

  return Array.from(new Uint8Array(digestBuffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

// Keyed on tenant identity + acting user identity + digest -- never digest (or even
// tenant+digest) alone. Tenant isolation mirrors K4's own reasoning (a digest collision must
// never resolve to a different tenant's identity in a browser profile shared across tenant
// sessions); the acting-user dimension additionally prevents two different authenticated users of
// the SAME tenant, sharing a browser profile, from colliding on the same pending identity for
// identical content (Readiness Report §3.B's corrected cross-user-isolation finding).
export function pendingSubmissionKey(tenantId: string, actingUserId: string, digest: string): string {
  return `${tenantId}:${actingUserId}:${digest}`;
}

/**
 * Reuses the pending uuid for this exact (tenant, actor, digest) if one is already recorded (a
 * retry after a network error, or the same content resubmitted after reopening the modal);
 * otherwise mints a new one and persists it BEFORE the caller ever sends the POST, so a reload
 * mid-request still finds it. Never silently replaces an existing unresolved entry, and never
 * automatically expires one.
 *
 * Fails closed -- throws, before the caller can reach `api.createLead()` -- on: a missing/empty
 * tenant or actor id; an unreadable or corrupted store; an existing entry for this key that fails
 * validation; or a write whose read-back does not match what was just written (persistence is
 * verified, never assumed).
 */
export function getOrCreatePendingSubmissionUuid(
  tenantId: string | null | undefined,
  actingUserId: string | null | undefined,
  digest: string,
): string {
  if (!tenantId) {
    throw new Error("Missing tenant identity; cannot compute a lead-submission identity.");
  }
  if (!actingUserId) {
    throw new Error("Missing acting-user identity; cannot compute a lead-submission identity.");
  }

  const key = pendingSubmissionKey(tenantId, actingUserId, digest);
  const rawMap = readPendingSubmissionsRaw();
  const existing = readExistingEntry(rawMap, key);

  if (existing) {
    return existing.uuid;
  }

  const uuid = crypto.randomUUID();
  const nextMap: Record<string, unknown> = { ...rawMap, [key]: { uuid } };
  writePendingSubmissions(nextMap);

  // Verify persistence by reading the entry back before ever returning it -- a write that
  // silently did not stick (e.g. some private-mode/quota behavior that does not throw on
  // `setItem` but also does not persist) must still fail closed here, not surface later as an
  // inexplicably "forgotten" identity.
  const verifyMap = readPendingSubmissionsRaw();
  const verifyEntry = readExistingEntry(verifyMap, key);

  if (!verifyEntry || verifyEntry.uuid !== uuid) {
    throw new Error("Failed to verify the persisted lead-submission identity after writing it.");
  }

  return uuid;
}

export interface ClearPendingSubmissionResult {
  cleared: boolean;
  /** Present only when `cleared` is false -- the underlying storage error's message. */
  error?: string;
}

/**
 * Called only after a CONFIRMED terminal Kernel response: `201` (`Created`, fresh or replay),
 * `422` `MatchedExisting` (a confirmed, persisted acquisition attempt -- not a validation error),
 * or `409` (a confirmed idempotency conflict -- retrying with the same uuid would only repeat the
 * conflict; clearing lets the next attempt mint a fresh identity that can actually succeed).
 * Never called for a pre-Kernel `422` from the form's own validation, since the identity was never
 * consumed server-side in that case (Readiness Report §3.B).
 *
 * Deliberately does NOT fail closed the way `getOrCreatePendingSubmissionUuid()` does: by the time
 * this runs, the server has already produced a definitive result, so a storage failure here must
 * never surface as if that result had not happened -- it is reported back as an explicit
 * `{ cleared: false, error }` result instead.
 */
export function clearPendingSubmission(
  tenantId: string,
  actingUserId: string,
  digest: string,
): ClearPendingSubmissionResult {
  const key = pendingSubmissionKey(tenantId, actingUserId, digest);

  try {
    const rawMap = readPendingSubmissionsRaw();

    if (!(key in rawMap)) {
      return { cleared: true };
    }

    const rest = { ...rawMap };
    delete rest[key];
    writePendingSubmissions(rest);

    return { cleared: true };
  } catch (err) {
    return {
      cleared: false,
      error: err instanceof Error ? err.message : "Unknown error clearing the pending lead-submission identity.",
    };
  }
}
