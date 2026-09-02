import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ImportSalesModal from "../ImportSalesModal";
import {
  canonicalSalesPayload,
  computeSalesDigest,
  getOrCreatePendingBatchUuid,
  pendingBatchKey,
  clearPendingBatch,
} from "../ImportSalesModal.batchIdentity";
import { api } from "../../services/api";

/**
 * Phase 1B.5D.1.3 Slice K3 (Design Report §12): the durable, tenant-scoped digest ->
 * import_batch_uuid identity `ImportSalesModal` now persists in `localStorage` BEFORE sending
 * the canonical sales-import POST -- never storing raw row content -- so a network failure or a
 * reload/remount mid-import can retry with the SAME `import_batch_uuid` the backend's
 * `sales_import_batches` receipt (K3) uses to detect a replay, while a deliberate later import
 * of the same file after a confirmed success gets a genuinely new one.
 */

const STORAGE_KEY = "spa.sales_import.pending_batches";

vi.mock("../../services/api", () => ({
  api: {
    getCurrentTenantId: vi.fn(() => "tenant-1"),
    post: vi.fn(),
  },
}));

const sampleRow = (overrides: Partial<Record<string, string>> = {}) => ({
  date: "2026-01-15",
  client: "Ada Lovelace",
  product: "Facial",
  amount: "100",
  payment_method: "cash",
  seller: "",
  professional: "",
  description: "",
  branch: "Main",
  ...overrides,
});

beforeEach(() => {
  localStorage.clear();
  vi.mocked(api.getCurrentTenantId).mockReturnValue("tenant-1");
  vi.mocked(api.post).mockReset();
});

describe("canonicalSalesPayload / computeSalesDigest", () => {
  it("(a) is stable across two calls for an identical normalized payload", async () => {
    const sales = [sampleRow(), sampleRow({ client: "Bob" })];

    const digest1 = await computeSalesDigest(sales);
    const digest2 = await computeSalesDigest([...sales]);

    expect(digest1).toBe(digest2);
  });

  it("(b) changes when rows are reordered", async () => {
    const rowA = sampleRow({ client: "Ada" });
    const rowB = sampleRow({ client: "Bob" });

    const forward = await computeSalesDigest([rowA, rowB]);
    const reversed = await computeSalesDigest([rowB, rowA]);

    expect(forward).not.toBe(reversed);
  });

  it("(b) changes when a field value changes", async () => {
    const digest1 = await computeSalesDigest([sampleRow({ amount: "100" })]);
    const digest2 = await computeSalesDigest([sampleRow({ amount: "999" })]);

    expect(digest1).not.toBe(digest2);
  });

  it("row order is part of the canonical string, not just the digest", () => {
    const rowA = sampleRow({ client: "Ada" });
    const rowB = sampleRow({ client: "Bob" });

    expect(canonicalSalesPayload([rowA, rowB])).not.toBe(canonicalSalesPayload([rowB, rowA]));
  });
});

describe("getOrCreatePendingBatchUuid / clearPendingBatch", () => {
  it("(c) tenant A and tenant B never share a pending uuid for the same digest", () => {
    const digest = "same-digest-for-both-tenants";

    const uuidA = getOrCreatePendingBatchUuid("tenant-A", digest);
    const uuidB = getOrCreatePendingBatchUuid("tenant-B", digest);

    expect(uuidA).not.toBe(uuidB);
    expect(pendingBatchKey("tenant-A", digest)).not.toBe(pendingBatchKey("tenant-B", digest));
  });

  it("reuses the same uuid for the same (tenant, digest) pair until cleared", () => {
    const digest = "stable-digest";

    const first = getOrCreatePendingBatchUuid("tenant-1", digest);
    const second = getOrCreatePendingBatchUuid("tenant-1", digest);

    expect(first).toBe(second);
  });

  it("(e) a later call after clearPendingBatch mints a genuinely new uuid", () => {
    const digest = "digest-for-success-then-retry";

    const first = getOrCreatePendingBatchUuid("tenant-1", digest);
    clearPendingBatch("tenant-1", digest);
    const second = getOrCreatePendingBatchUuid("tenant-1", digest);

    expect(second).not.toBe(first);
  });

  it("(f) an entry older than the 24h TTL is pruned on the next write", () => {
    const digest = "stale-digest";
    const key = pendingBatchKey("tenant-1", digest);

    const staleMap = {
      [key]: { uuid: "stale-uuid", createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString() },
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(staleMap));

    // Any write (here, a different key's own creation) triggers the prune pass.
    getOrCreatePendingBatchUuid("tenant-1", "unrelated-fresh-digest");

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    expect(stored[key]).toBeUndefined();
  });

  it("(g) never stores raw sales row content, only tenant/digest/uuid/timestamp", () => {
    getOrCreatePendingBatchUuid("tenant-1", "some-digest-value");

    const raw = localStorage.getItem(STORAGE_KEY) || "{}";
    expect(raw).not.toContain("Ada Lovelace");
    expect(raw).not.toContain("Facial");

    const stored = JSON.parse(raw);
    const entry = Object.values(stored)[0] as { uuid: string; createdAt: string };
    expect(Object.keys(entry).sort()).toEqual(["createdAt", "uuid"]);
  });
});

describe("ImportSalesModal end-to-end batch identity", () => {
  const csv = "Fecha,Cliente,Servicio,Sucursal,Valor\n2026-01-15,Ada Lovelace,Facial,Main,100\n";

  async function uploadAndReachMapStep(onSuccess = vi.fn(), onClose = vi.fn()) {
    const user = userEvent.setup();
    const { unmount } = render(<ImportSalesModal onClose={onClose} onSuccess={onSuccess} />);

    const file = new File([csv], "sales.csv", { type: "text/csv" });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, file);

    await waitFor(() => screen.getByText(/Importar \d+ registros/));

    return { user, unmount };
  }

  it("(d) a failed/network-lost request preserves the uuid for the next attempt", async () => {
    vi.mocked(api.post).mockRejectedValueOnce(new Error("Network error"));
    const { user } = await uploadAndReachMapStep();

    await user.click(screen.getByText(/Importar \d+ registros/));

    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));

    const firstCallUuid = vi.mocked(api.post).mock.calls[0][1].import_batch_uuid;
    expect(firstCallUuid).toBeTruthy();

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    const entry = Object.values(stored)[0] as { uuid: string };
    expect(entry.uuid).toBe(firstCallUuid);
  });

  it("(d) a remount with the same file reuses the same uuid from localStorage", async () => {
    vi.mocked(api.post).mockRejectedValue(new Error("Network error"));

    const { user: user1, unmount: unmount1 } = await uploadAndReachMapStep();
    await user1.click(screen.getByText(/Importar \d+ registros/));
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    const firstUuid = vi.mocked(api.post).mock.calls[0][1].import_batch_uuid;
    unmount1();

    // Simulate a remount (component unmount/reload) by rendering a fresh instance.
    const { user: user2 } = await uploadAndReachMapStep();
    await user2.click(screen.getByText(/Importar \d+ registros/));
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2));
    const secondUuid = vi.mocked(api.post).mock.calls[1][1].import_batch_uuid;

    expect(secondUuid).toBe(firstUuid);
  });

  it("(e) a confirmed success removes the entry, and a later deliberate re-import gets a new uuid", async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ message: "ok", count: 1 });
    const { user: user1, unmount: unmount1 } = await uploadAndReachMapStep();
    await user1.click(screen.getByText(/Importar \d+ registros/));
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    const firstUuid = vi.mocked(api.post).mock.calls[0][1].import_batch_uuid;

    await waitFor(() => expect(localStorage.getItem(STORAGE_KEY)).toBe(JSON.stringify({})));
    unmount1();

    vi.mocked(api.post).mockResolvedValueOnce({ message: "ok", count: 1 });
    const { user: user2 } = await uploadAndReachMapStep();
    await user2.click(screen.getByText(/Importar \d+ registros/));
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2));
    const secondUuid = vi.mocked(api.post).mock.calls[1][1].import_batch_uuid;

    expect(secondUuid).not.toBe(firstUuid);
  });
});
