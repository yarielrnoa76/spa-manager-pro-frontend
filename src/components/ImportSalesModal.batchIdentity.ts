// Phase 1B.5D.1.3 Slice K3 (Design Report §12): a durable, tenant-scoped digest -> pending
// import_batch_uuid map for ImportSalesModal. Component state alone does not survive
// reload/reopen/network failure -- this does, without ever storing raw sales row content, only
// the tenant id, a digest, the server-facing uuid, and a creation timestamp.
//
// A separate module from ImportSalesModal.tsx purely so these pure functions can be imported by
// both the component and its tests without a React "Fast Refresh only works when a file only
// exports components" lint violation -- no behavioral split is intended.

export interface SalesImportRow {
  date: string;
  client: string;
  product: string;
  amount: string;
  payment_method: string;
  seller: string;
  professional: string;
  description: string;
  branch: string;
}

interface PendingBatchEntry {
  uuid: string;
  createdAt: string;
}

type PendingBatchesMap = Record<string, PendingBatchEntry>;

const PENDING_BATCHES_STORAGE_KEY = "spa.sales_import.pending_batches";
const PENDING_BATCH_TTL_MS = 24 * 60 * 60 * 1000;

function readPendingBatches(): PendingBatchesMap {
  try {
    const raw = localStorage.getItem(PENDING_BATCHES_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as PendingBatchesMap) : {};
  } catch {
    return {};
  }
}

// Stale-entry cleanup (§12): on every write, drop any entry older than the 24h TTL -- bounds
// unbounded growth from abandoned imports (closed tab mid-request, browser crash) without a
// background sweep. Never a deliberate expiry of an entry the caller is actively working with:
// the caller always re-reads/re-creates its own key immediately after this runs.
function writePendingBatches(map: PendingBatchesMap): void {
  const now = Date.now();
  const pruned: PendingBatchesMap = {};

  for (const [key, entry] of Object.entries(map)) {
    const createdAtMs = Date.parse(entry.createdAt);
    if (!Number.isNaN(createdAtMs) && now - createdAtMs < PENDING_BATCH_TTL_MS) {
      pruned[key] = entry;
    }
  }

  try {
    localStorage.setItem(PENDING_BATCHES_STORAGE_KEY, JSON.stringify(pruned));
  } catch {
    // localStorage unavailable (private mode, quota exceeded) -- degrade silently; this
    // submission's own uuid (already returned to the caller) still works, only cross-reload
    // persistence is lost.
  }
}

// Canonical payload for hashing = the exact `sales` array as sent, as a fixed-order
// array-of-arrays. Row order is part of the digest -- a reordering, an addition, or a removal
// each produce a different digest.
export function canonicalSalesPayload(sales: SalesImportRow[]): string {
  return JSON.stringify(
    sales.map((s) => [s.date, s.client, s.product, s.amount, s.payment_method, s.seller, s.professional, s.description, s.branch])
  );
}

export async function computeSalesDigest(sales: SalesImportRow[]): Promise<string> {
  const canonical = canonicalSalesPayload(sales);
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

// Reuses the pending uuid for this exact (tenant, digest) if one is already recorded (a retry
// after a network error, or the same file reopened after a reload); otherwise mints a new one
// and persists it BEFORE the caller ever sends the POST, so a reload mid-request still finds it.
// Never silently replaces an existing unresolved entry.
export function getOrCreatePendingBatchUuid(tenantId: string, digest: string): string {
  const key = pendingBatchKey(tenantId, digest);
  const map = readPendingBatches();
  const existing = map[key];

  if (existing) {
    return existing.uuid;
  }

  const uuid = crypto.randomUUID();
  map[key] = { uuid, createdAt: new Date().toISOString() };
  writePendingBatches(map);

  return uuid;
}

// Called only after a CONFIRMED successful (200) response -- never on error/timeout, so a retry
// of the same file keeps reusing the same uuid. A deliberate later import of the same file after
// a confirmed success finds no entry here and mints a genuinely new uuid.
export function clearPendingBatch(tenantId: string, digest: string): void {
  const key = pendingBatchKey(tenantId, digest);
  const map = readPendingBatches();

  if (key in map) {
    delete map[key];
    writePendingBatches(map);
  }
}
