import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ImportLeadsModal from "../ImportLeadsModal";
import {
  canonicalLeadsPayload,
  computeLeadsDigest,
  getOrCreatePendingBatchUuid,
  pendingBatchKey,
  clearPendingBatch,
  type LeadImportRow,
} from "../ImportLeadsModal.batchIdentity";
import { api } from "../../services/api";

/**
 * Phase 1B.5D.1.3 Slice K4 (mirrors K3 for ImportSalesModal): the durable, tenant-scoped digest ->
 * import_batch_uuid identity `ImportLeadsModal` now persists in `localStorage` BEFORE sending the
 * canonical leads-import POST -- never storing raw row content -- so a network failure or a
 * reload/remount mid-import can retry with the SAME `import_batch_uuid` the backend's
 * receipt uses to detect a replay, while a deliberate later import of the same file after a
 * confirmed success gets a genuinely new one.
 */

const STORAGE_KEY = "spa.leads_import.pending_batches";

vi.mock("../../services/api", () => ({
  api: {
    getCurrentTenantId: vi.fn(() => "tenant-1"),
    batchImportLeads: vi.fn(),
  },
}));

const sampleRow = (overrides: Partial<Record<string, string>> = {}) => ({
  name: "Ada",
  last_name: "Lovelace",
  phone: "555-0100",
  email: "",
  branch: "Main",
  message: "",
  ...overrides,
});

beforeEach(() => {
  localStorage.clear();
  vi.mocked(api.getCurrentTenantId).mockReturnValue("tenant-1");
  vi.mocked(api.batchImportLeads).mockReset();
});

describe("canonicalLeadsPayload / computeLeadsDigest", () => {
  it("(a) is stable across two calls for an identical normalized payload", async () => {
    const leads = [sampleRow(), sampleRow({ name: "Bob" })];

    const digest1 = await computeLeadsDigest(leads);
    const digest2 = await computeLeadsDigest([...leads]);

    expect(digest1).toBe(digest2);
  });

  it("(b) changes when rows are reordered", async () => {
    const rowA = sampleRow({ name: "Ada" });
    const rowB = sampleRow({ name: "Bob" });

    const forward = await computeLeadsDigest([rowA, rowB]);
    const reversed = await computeLeadsDigest([rowB, rowA]);

    expect(forward).not.toBe(reversed);
  });

  it("(b) changes when a field value changes", async () => {
    const digest1 = await computeLeadsDigest([sampleRow({ phone: "555-0100" })]);
    const digest2 = await computeLeadsDigest([sampleRow({ phone: "555-9999" })]);

    expect(digest1).not.toBe(digest2);
  });

  it("row order is part of the canonical string, not just the digest", () => {
    const rowA = sampleRow({ name: "Ada" });
    const rowB = sampleRow({ name: "Bob" });

    expect(canonicalLeadsPayload([rowA, rowB])).not.toBe(canonicalLeadsPayload([rowB, rowA]));
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

  it("never automatically expires an unresolved entry, no matter how old", () => {
    const digest = "very-old-digest";
    const key = pendingBatchKey("tenant-1", digest);

    // An entry from a year ago -- there is no TTL, so this must still be honored exactly like a
    // fresh one. Uses a real crypto.randomUUID()-shaped value since entries are now validated
    // against that format.
    const oldUuid = crypto.randomUUID();
    const oldMap = { [key]: { uuid: oldUuid } };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(oldMap));

    const uuid = getOrCreatePendingBatchUuid("tenant-1", digest);

    expect(uuid).toBe(oldUuid);
    // A write for an unrelated key must not prune the old entry either -- no background sweep.
    getOrCreatePendingBatchUuid("tenant-1", "another-fresh-digest");
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    expect(stored[key]).toEqual({ uuid: oldUuid });
  });

  it("never stores raw lead row content, only tenant/digest and uuid", () => {
    getOrCreatePendingBatchUuid("tenant-1", "some-digest-value");

    const raw = localStorage.getItem(STORAGE_KEY) || "{}";
    expect(raw).not.toContain("Ada");
    expect(raw).not.toContain("Lovelace");
    expect(raw).not.toContain("555-0100");

    const stored = JSON.parse(raw);
    const entry = Object.values(stored)[0] as { uuid: string };
    expect(Object.keys(entry)).toEqual(["uuid"]);
  });

  it("missing tenant identity fails closed and never persists anything", () => {
    expect(() => getOrCreatePendingBatchUuid(null, "some-digest")).toThrow();
    expect(() => getOrCreatePendingBatchUuid("", "some-digest")).toThrow();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("malformed stored JSON fails closed rather than silently starting fresh", () => {
    localStorage.setItem(STORAGE_KEY, "{not valid json");

    expect(() => getOrCreatePendingBatchUuid("tenant-1", "some-digest")).toThrow();
  });

  it("an invalid existing entry for the requested key fails closed, never silently replaced", () => {
    const digest = "digest-with-bad-entry";
    const key = pendingBatchKey("tenant-1", digest);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ [key]: { uuid: 12345 } }));

    expect(() => getOrCreatePendingBatchUuid("tenant-1", digest)).toThrow();

    // Refusing to replace it means the invalid entry is still there afterward, unchanged.
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    expect(stored[key]).toEqual({ uuid: 12345 });
  });

  it("an existing entry whose uuid is not a valid UUID format fails closed, never silently replaced", () => {
    const digest = "digest-with-non-uuid-value";
    const key = pendingBatchKey("tenant-1", digest);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ [key]: { uuid: "not-a-uuid" } }));

    expect(() => getOrCreatePendingBatchUuid("tenant-1", digest)).toThrow();

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    expect(stored[key]).toEqual({ uuid: "not-a-uuid" });
  });

  it("accepts a well-formed crypto.randomUUID()-shaped value as a valid existing entry", () => {
    const digest = "digest-with-real-uuid";
    const key = pendingBatchKey("tenant-1", digest);
    const realUuid = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ [key]: { uuid: realUuid } }));

    expect(getOrCreatePendingBatchUuid("tenant-1", digest)).toBe(realUuid);
  });

  it("a write whose read-back does not match fails closed (persistence is verified, not assumed)", () => {
    // Simulate a write that reports success but does not actually persist the new value --
    // e.g. some private-mode quota behaviors. Spying on Storage.prototype (not the localStorage
    // instance) is required for jsdom to actually intercept calls made through the global
    // `localStorage` binding.
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation((key) => {
      if (key === STORAGE_KEY) return;
    });

    try {
      expect(() => getOrCreatePendingBatchUuid("tenant-1", "digest-that-wont-persist")).toThrow();
    } finally {
      spy.mockRestore();
    }
  });

  it("a setItem failure fails closed before any uuid is returned", () => {
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });

    try {
      expect(() => getOrCreatePendingBatchUuid("tenant-1", "digest-that-cant-write")).toThrow();
    } finally {
      spy.mockRestore();
    }
  });
});

describe("ImportLeadsModal end-to-end batch identity", () => {
  const csv = "Nombre,Apellido,Telefono,Sucursal\nAda,Lovelace,555-0100,Main\n";

  // The exact row shape ImportLeadsModal itself builds from `csv` above (unmapped columns --
  // email/message -- normalize to "") -- used so a test can pre-compute the same (tenant, digest)
  // storage key the component will look up.
  const csvRow: LeadImportRow = {
    name: "Ada",
    last_name: "Lovelace",
    phone: "555-0100",
    email: "",
    branch: "Main",
    message: "",
  };

  async function uploadAndReachMapStep(onSuccess = vi.fn(), onClose = vi.fn()) {
    const user = userEvent.setup();
    const { unmount } = render(<ImportLeadsModal onClose={onClose} onSuccess={onSuccess} />);

    const file = new File([csv], "leads.csv", { type: "text/csv" });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, file);

    await waitFor(() => screen.getByText(/Importar \d+ registros/));

    return { user, unmount };
  }

  it("the outgoing request payload includes import_batch_uuid", async () => {
    vi.mocked(api.batchImportLeads).mockResolvedValueOnce({ message: "ok", count: 1 });
    const { user } = await uploadAndReachMapStep();

    await user.click(screen.getByText(/Importar \d+ registros/));

    await waitFor(() => expect(api.batchImportLeads).toHaveBeenCalledTimes(1));
    const call = vi.mocked(api.batchImportLeads).mock.calls[0][0];
    expect(call.import_batch_uuid).toBeTruthy();
    expect(call.leads).toEqual([csvRow]);
  });

  it("(d) a failed/network-lost request preserves the uuid for the next attempt", async () => {
    vi.mocked(api.batchImportLeads).mockRejectedValueOnce(new Error("Network error"));
    const { user } = await uploadAndReachMapStep();

    await user.click(screen.getByText(/Importar \d+ registros/));

    await waitFor(() => expect(api.batchImportLeads).toHaveBeenCalledTimes(1));

    const firstCallUuid = vi.mocked(api.batchImportLeads).mock.calls[0][0].import_batch_uuid;
    expect(firstCallUuid).toBeTruthy();

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    const entry = Object.values(stored)[0] as { uuid: string };
    expect(entry.uuid).toBe(firstCallUuid);
  });

  it("(d) a remount with the same file reuses the same uuid from localStorage", async () => {
    vi.mocked(api.batchImportLeads).mockRejectedValue(new Error("Network error"));

    const { user: user1, unmount: unmount1 } = await uploadAndReachMapStep();
    await user1.click(screen.getByText(/Importar \d+ registros/));
    await waitFor(() => expect(api.batchImportLeads).toHaveBeenCalledTimes(1));
    const firstUuid = vi.mocked(api.batchImportLeads).mock.calls[0][0].import_batch_uuid;
    unmount1();

    // Simulate a remount (component unmount/reload) by rendering a fresh instance.
    const { user: user2 } = await uploadAndReachMapStep();
    await user2.click(screen.getByText(/Importar \d+ registros/));
    await waitFor(() => expect(api.batchImportLeads).toHaveBeenCalledTimes(2));
    const secondUuid = vi.mocked(api.batchImportLeads).mock.calls[1][0].import_batch_uuid;

    expect(secondUuid).toBe(firstUuid);
  });

  it("missing tenant identity fails before api.batchImportLeads() is ever called", async () => {
    vi.mocked(api.getCurrentTenantId).mockReturnValue(null);
    const { user } = await uploadAndReachMapStep();

    await user.click(screen.getByText(/Importar \d+ registros/));

    await waitFor(() => screen.getByText(/Ocurrió un error|identidad|tenant/i));
    expect(api.batchImportLeads).not.toHaveBeenCalled();
  });

  it("malformed stored JSON fails before api.batchImportLeads() is ever called", async () => {
    localStorage.setItem(STORAGE_KEY, "{not valid json");
    const { user } = await uploadAndReachMapStep();

    await user.click(screen.getByText(/Importar \d+ registros/));

    await waitFor(() => expect(screen.queryByText(/Importando/)).not.toBeInTheDocument());
    expect(api.batchImportLeads).not.toHaveBeenCalled();
  });

  it("an existing entry with a non-UUID value fails before api.batchImportLeads() is ever called", async () => {
    const digest = await computeLeadsDigest([csvRow]);
    const key = pendingBatchKey("tenant-1", digest);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ [key]: { uuid: "not-a-uuid" } }));

    const { user } = await uploadAndReachMapStep();

    await user.click(screen.getByText(/Importar \d+ registros/));

    await waitFor(() => expect(screen.queryByText(/Importando/)).not.toBeInTheDocument());
    expect(api.batchImportLeads).not.toHaveBeenCalled();

    // Refusing to replace it means the invalid entry is still there afterward, unchanged.
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    expect(stored[key]).toEqual({ uuid: "not-a-uuid" });
  });

  it("a corrupted storage read/write failure results in zero POST calls being made", async () => {
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });

    try {
      const { user } = await uploadAndReachMapStep();
      await user.click(screen.getByText(/Importar \d+ registros/));

      await waitFor(() => expect(screen.queryByText(/Importando/)).not.toBeInTheDocument());
      expect(api.batchImportLeads).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it("a cleanup failure after a confirmed success still shows success, plus a visible warning, with no second call", async () => {
    vi.mocked(api.batchImportLeads).mockResolvedValueOnce({ message: "Se importaron 1 leads exitosamente.", count: 1 });

    // setItem succeeds for the initial getOrCreatePendingBatchUuid() write (so the import can
    // proceed), but fails on every call to OUR storage key AFTER that -- simulating a write
    // failure specifically during clearPendingBatch()'s post-success cleanup. Counts only writes
    // to STORAGE_KEY (never a global call count) so any unrelated localStorage write elsewhere
    // cannot throw off which write is meant to fail. Captures the original implementation BEFORE
    // spying, since `Storage.prototype.setItem` now refers to the mock itself once installed --
    // calling it from within its own mockImplementation would recurse infinitely.
    const originalSetItem = Storage.prototype.setItem;
    let storageKeyWrites = 0;
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
      if (key === STORAGE_KEY) {
        storageKeyWrites += 1;
        if (storageKeyWrites > 1) {
          throw new Error("QuotaExceededError");
        }
      }
      originalSetItem.call(this, key, value);
    });

    try {
      const { user } = await uploadAndReachMapStep();
      await user.click(screen.getByText(/Importar \d+ registros/));

      await waitFor(() => expect(api.batchImportLeads).toHaveBeenCalledTimes(1));
      await waitFor(() => screen.getByText(/Se importaron/));

      // The import is a success, AND a warning is visible -- never treated as a failure.
      expect(screen.getByText(/Se importaron/)).toBeInTheDocument();
      expect(screen.getByText(/no se pudo limpiar/i)).toBeInTheDocument();
      expect(screen.queryByText(/Ocurrió un error/i)).not.toBeInTheDocument();

      // Cleanup failing must never trigger a retry/second submission.
      expect(api.batchImportLeads).toHaveBeenCalledTimes(1);
    } finally {
      spy.mockRestore();
    }
  });

  it("(e) a confirmed success removes the entry, and a later deliberate re-import gets a new uuid", async () => {
    vi.mocked(api.batchImportLeads).mockResolvedValueOnce({ message: "ok", count: 1 });
    const { user: user1, unmount: unmount1 } = await uploadAndReachMapStep();
    await user1.click(screen.getByText(/Importar \d+ registros/));
    await waitFor(() => expect(api.batchImportLeads).toHaveBeenCalledTimes(1));
    const firstUuid = vi.mocked(api.batchImportLeads).mock.calls[0][0].import_batch_uuid;

    await waitFor(() => expect(localStorage.getItem(STORAGE_KEY)).toBe(JSON.stringify({})));
    unmount1();

    vi.mocked(api.batchImportLeads).mockResolvedValueOnce({ message: "ok", count: 1 });
    const { user: user2 } = await uploadAndReachMapStep();
    await user2.click(screen.getByText(/Importar \d+ registros/));
    await waitFor(() => expect(api.batchImportLeads).toHaveBeenCalledTimes(2));
    const secondUuid = vi.mocked(api.batchImportLeads).mock.calls[1][0].import_batch_uuid;

    expect(secondUuid).not.toBe(firstUuid);
  });
});
