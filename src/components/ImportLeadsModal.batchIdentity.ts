// Phase 1B.5D.1.3 Slice K4 (mirrors the K3 targeted-correction pass for ImportSalesModal): a
// durable, tenant-scoped digest -> pending import_batch_uuid map for ImportLeadsModal. Component
// state alone does not survive reload/reopen/network failure -- this does, without ever storing
// raw lead row content, only the tenant id, a digest, and the server-facing uuid.
//
// A separate module from ImportLeadsModal.tsx purely so these pure functions can be imported by
// both the component and its tests without a React "Fast Refresh only works when a file only
// exports components" lint violation -- no behavioral split is intended.
//
// Durability (matches the sales module's corrected, non-TTL behavior): an unresolved pending
// identity is never automatically expired -- there is no TTL, no background sweep, and no silent
// pruning. It is removed ONLY by `clearPendingBatch()` after a CONFIRMED successful response, or
// by a future, explicit user abandonment action (not part of this module). Every failure mode
// that could otherwise corrupt or silently discard an existing identity (a missing tenant id, an
// unreadable/corrupted store, an invalid existing entry, or a write that did not actually
// persist) throws instead -- always BEFORE the caller ever sends the network request, never
// silently falling back to a fresh uuid.

export interface LeadImportRow {
  name: string;
  last_name: string;
  phone: string;
  email: string;
  branch: string;
  message: string;
}

interface PendingBatchEntry {
  uuid: string;
}

const PENDING_BATCHES_STORAGE_KEY = "spa.leads_import.pending_batches";

// Matches exactly what `crypto.randomUUID()` produces (RFC 4122 version 4): 8-4-4-4-12 hex
// digits, version nibble `4`, variant nibble `8|9|a|b`. A non-empty but non-UUID string (e.g. a
// corrupted/tampered `"not-a-uuid"`) must fail validation, not merely "any non-empty string".
const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidEntry(value: unknown): value is PendingBatchEntry {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { uuid?: unknown }).uuid === "string" &&
    UUID_V4_PATTERN.test((value as { uuid: string }).uuid)
  );
}

// Reads the whole store and returns it as a plain, untyped object -- fails closed (throws)
// whenever the store cannot be read at all or does not even parse as a JSON object. A missing
// key entirely (`localStorage.getItem` returns null -- first use, or nothing pending) is NOT
// corruption and returns `{}` normally. Does NOT validate individual entries here -- that is
// `readExistingEntry()`'s job, scoped to only the one key a caller actually needs, so a
// corruption elsewhere in the map never blocks an unrelated (tenant, digest) pair.
function readPendingBatchesRaw(): Record<string, unknown> {
  let raw: string | null;
  try {
    raw = localStorage.getItem(PENDING_BATCHES_STORAGE_KEY);
  } catch {
    throw new Error("Unable to read the pending leads-import identity store.");
  }

  if (raw === null) {
    return {};
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("The pending leads-import identity store is corrupted and could not be parsed.");
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("The pending leads-import identity store is corrupted (not a JSON object).");
  }

  return parsed as Record<string, unknown>;
}

// An existing entry that fails validation fails closed -- never silently treated as absent and
// never silently overwritten with a freshly minted uuid.
function readExistingEntry(map: Record<string, unknown>, key: string): PendingBatchEntry | undefined {
  if (!(key in map)) {
    return undefined;
  }

  const value = map[key];

  if (!isValidEntry(value)) {
    throw new Error("An existing pending leads-import identity is invalid; refusing to silently replace it.");
  }

  return value;
}

function writePendingBatches(map: Record<string, unknown>): void {
  try {
    localStorage.setItem(PENDING_BATCHES_STORAGE_KEY, JSON.stringify(map));
  } catch {
    throw new Error("Unable to persist the leads-import batch identity (localStorage write failed).");
  }
}

// Canonical payload for hashing = the exact `leads` array as sent, as a fixed-order
// array-of-arrays. Row order is part of the digest -- a reordering, an addition, or a removal
// each produce a different digest.
export function canonicalLeadsPayload(leads: LeadImportRow[]): string {
  return JSON.stringify(
    leads.map((l) => [l.name, l.last_name, l.phone, l.email, l.branch, l.message])
  );
}

export async function computeLeadsDigest(leads: LeadImportRow[]): Promise<string> {
  const canonical = canonicalLeadsPayload(leads);
  const digestBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical));

  return Array.from(new Uint8Array(digestBuffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

// Keyed on tenant identity PLUS digest, never digest alone -- prevents a digest collision or
// reuse from resolving to a different tenant's import_batch_uuid in a browser profile shared
// across tenant sessions.
export function pendingBatchKey(tenantId: string, digest: string): string {
  return `${tenantId}:${digest}`;
}

/**
 * Reuses the pending uuid for this exact (tenant, digest) if one is already recorded (a retry
 * after a network error, or the same file reopened after a reload); otherwise mints a new one
 * and persists it BEFORE the caller ever sends the POST, so a reload mid-request still finds it.
 * Never silently replaces an existing unresolved entry, and never automatically expires one.
 *
 * Fails closed -- throws, before the caller can reach `api.batchImportLeads()` -- on: a
 * missing/empty tenant id; an unreadable or corrupted store; an existing entry for this key that
 * fails validation; or a write whose read-back does not match what was just written (persistence
 * is verified, never assumed).
 */
export function getOrCreatePendingBatchUuid(tenantId: string | null | undefined, digest: string): string {
  if (!tenantId) {
    throw new Error("Missing tenant identity; cannot compute a leads-import batch identity.");
  }

  const key = pendingBatchKey(tenantId, digest);
  const rawMap = readPendingBatchesRaw();
  const existing = readExistingEntry(rawMap, key);

  if (existing) {
    return existing.uuid;
  }

  const uuid = crypto.randomUUID();
  const nextMap: Record<string, unknown> = { ...rawMap, [key]: { uuid } };
  writePendingBatches(nextMap);

  // Verify persistence by reading the entry back before ever returning it -- a write that
  // silently did not stick (e.g. some private-mode/quota behavior that does not throw on
  // `setItem` but also does not persist) must still fail closed here, not surface later as an
  // inexplicably "forgotten" identity.
  const verifyMap = readPendingBatchesRaw();
  const verifyEntry = readExistingEntry(verifyMap, key);

  if (!verifyEntry || verifyEntry.uuid !== uuid) {
    throw new Error("Failed to verify the persisted leads-import batch identity after writing it.");
  }

  return uuid;
}

export interface ClearPendingBatchResult {
  cleared: boolean;
  /** Present only when `cleared` is false -- the underlying storage error's message. */
  error?: string;
}

/**
 * Called only after a CONFIRMED successful (200) response -- never on error/timeout, so a retry
 * of the same file keeps reusing the same uuid.
 *
 * Deliberately does NOT fail closed the way `getOrCreatePendingBatchUuid()` does: the import has
 * already succeeded by the time this runs, so a storage failure here must never surface as an
 * apparent IMPORT failure -- it is reported back as an explicit `{ cleared: false, error }`
 * result instead, so the caller can still tell the user their import succeeded while warning
 * that this browser's local pending-identity record could not be removed.
 *
 * If clearing genuinely does fail, the stale entry lingers. That is NOT harmless to describe as
 * "a future import will just be treated as new": if a LATER submission normalizes to this exact
 * same (tenant, digest) -- i.e. the identical file, unchanged -- it would reuse this same stale
 * uuid, and the backend's receipt would recognize it as an EXACT replay: a reconstructed `200`
 * with zero new writes, not a fresh import and not a `409` (a `409` only happens when the SAME
 * uuid is resubmitted with DIFFERENT content). Callers must not assert a future import is
 * guaranteed to be new when `cleared` is false.
 */
export function clearPendingBatch(tenantId: string, digest: string): ClearPendingBatchResult {
  const key = pendingBatchKey(tenantId, digest);

  try {
    const rawMap = readPendingBatchesRaw();

    if (!(key in rawMap)) {
      return { cleared: true };
    }

    const rest = { ...rawMap };
    delete rest[key];
    writePendingBatches(rest);

    return { cleared: true };
  } catch (err) {
    return {
      cleared: false,
      error: err instanceof Error ? err.message : "Unknown error clearing the pending leads-import identity.",
    };
  }
}
