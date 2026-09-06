import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LeadModal from "../LeadModal";
import {
  canonicalLeadSubmissionPayload,
  computeLeadSubmissionDigest,
  getOrCreatePendingSubmissionUuid,
  pendingSubmissionKey,
  clearPendingSubmission,
  type LeadSubmissionFields,
} from "../LeadModal.submissionIdentity";
import { api, ApiError } from "../../services/api";

/**
 * Phase 1B.5D Slice K6 (Manual Lead Creation Readiness Report, approved decisions §9): the
 * durable, (tenant, acting user, content-digest) -> submission_uuid identity `LeadModal` now
 * persists in `localStorage` BEFORE sending the canonical manual-lead POST -- a sibling instance
 * of `ImportLeadsModal.batchIdentity.ts`'s own K4 pattern (see that file's own test suite),
 * corrected for a single-lead payload's own field set and for the cross-user isolation dimension
 * that module's own key does not need.
 */

const STORAGE_KEY = "spa.leads_manual.pending_submissions";

vi.mock("../../services/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../services/api")>();
  return {
    ...actual,
    api: {
      getCurrentTenantId: vi.fn(() => "tenant-1"),
      me: vi.fn(),
      listBranches: vi.fn(),
      listUsers: vi.fn(),
      listTicketCategories: vi.fn(),
      listTicketPriorities: vi.fn(),
      createLead: vi.fn(),
      updateLead: vi.fn(),
    },
  };
});

const sampleFields = (overrides: Partial<LeadSubmissionFields> = {}): LeadSubmissionFields => ({
  name: "Ada",
  last_name: "Lovelace",
  phone: "555-0100",
  email: "ada@example.com",
  branch_id: "1",
  source: "whatsapp",
  message: "",
  status: "new",
  assigned_to: "",
  ...overrides,
});

beforeEach(() => {
  localStorage.clear();
  vi.mocked(api.getCurrentTenantId).mockReturnValue("tenant-1");
  vi.mocked(api.me).mockResolvedValue({
    id: "42",
    name: "Agent",
    email: "agent@example.com",
    role: { id: 1, name: "agent" },
    branch_id: "1",
    permissions: [],
    is_super_admin: false,
  });
  vi.mocked(api.listBranches).mockResolvedValue([{ id: "1", name: "Main", code: "M1", address: "" }]);
  vi.mocked(api.listUsers).mockResolvedValue([]);
  vi.mocked(api.listTicketCategories).mockResolvedValue([]);
  vi.mocked(api.listTicketPriorities).mockResolvedValue([]);
  vi.mocked(api.createLead).mockReset();
  vi.mocked(api.updateLead).mockReset();
});

describe("canonicalLeadSubmissionPayload / computeLeadSubmissionDigest", () => {
  it("is stable across two calls for an identical payload", async () => {
    const digest1 = await computeLeadSubmissionDigest(sampleFields());
    const digest2 = await computeLeadSubmissionDigest(sampleFields());

    expect(digest1).toBe(digest2);
  });

  it("changes when a field value changes", async () => {
    const digest1 = await computeLeadSubmissionDigest(sampleFields({ phone: "555-0100" }));
    const digest2 = await computeLeadSubmissionDigest(sampleFields({ phone: "555-9999" }));

    expect(digest1).not.toBe(digest2);
  });

  it("changes when status changes", async () => {
    const digest1 = await computeLeadSubmissionDigest(sampleFields({ status: "new" }));
    const digest2 = await computeLeadSubmissionDigest(sampleFields({ status: "contacted" }));

    expect(digest1).not.toBe(digest2);
  });

  it("changes when assigned_to changes", async () => {
    const digest1 = await computeLeadSubmissionDigest(sampleFields({ assigned_to: "" }));
    const digest2 = await computeLeadSubmissionDigest(sampleFields({ assigned_to: "7" }));

    expect(digest1).not.toBe(digest2);
  });

  it("field order is part of the canonical string, not just the digest", () => {
    const a = canonicalLeadSubmissionPayload(sampleFields({ name: "Ada", last_name: "Lovelace" }));
    const b = canonicalLeadSubmissionPayload(sampleFields({ name: "Lovelace", last_name: "Ada" }));

    expect(a).not.toBe(b);
  });
});

describe("getOrCreatePendingSubmissionUuid / clearPendingSubmission", () => {
  it("tenant A and tenant B never share a pending uuid for the same actor+digest", () => {
    const digest = "same-digest";

    const uuidA = getOrCreatePendingSubmissionUuid("tenant-A", "user-1", digest);
    const uuidB = getOrCreatePendingSubmissionUuid("tenant-B", "user-1", digest);

    expect(uuidA).not.toBe(uuidB);
    expect(pendingSubmissionKey("tenant-A", "user-1", digest)).not.toBe(pendingSubmissionKey("tenant-B", "user-1", digest));
  });

  /**
   * The corrected cross-user isolation finding (Readiness Report §3.B): two DIFFERENT
   * authenticated users of the SAME tenant, sharing a browser profile, submitting identical
   * content, must never collide on the same pending identity -- K4's own (tenant, digest) key
   * would have collided here.
   */
  it("two different acting users of the SAME tenant never share a pending uuid for identical content", () => {
    const digest = "identical-content-digest";

    const uuidUser1 = getOrCreatePendingSubmissionUuid("tenant-1", "user-1", digest);
    const uuidUser2 = getOrCreatePendingSubmissionUuid("tenant-1", "user-2", digest);

    expect(uuidUser1).not.toBe(uuidUser2);
  });

  it("reuses the same uuid for the same (tenant, actor, digest) triple until cleared", () => {
    const digest = "stable-digest";

    const first = getOrCreatePendingSubmissionUuid("tenant-1", "user-1", digest);
    const second = getOrCreatePendingSubmissionUuid("tenant-1", "user-1", digest);

    expect(first).toBe(second);
  });

  it("a later call after clearPendingSubmission mints a genuinely new uuid", () => {
    const digest = "digest-for-success-then-retry";

    const first = getOrCreatePendingSubmissionUuid("tenant-1", "user-1", digest);
    clearPendingSubmission("tenant-1", "user-1", digest);
    const second = getOrCreatePendingSubmissionUuid("tenant-1", "user-1", digest);

    expect(second).not.toBe(first);
  });

  it("never automatically expires an unresolved entry, no matter how old", () => {
    const digest = "very-old-digest";
    const key = pendingSubmissionKey("tenant-1", "user-1", digest);
    const oldUuid = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ [key]: { uuid: oldUuid } }));

    const uuid = getOrCreatePendingSubmissionUuid("tenant-1", "user-1", digest);

    expect(uuid).toBe(oldUuid);
  });

  it("never stores raw lead content, only tenant/actor/digest and uuid", () => {
    getOrCreatePendingSubmissionUuid("tenant-1", "user-1", "some-digest-value");

    const raw = localStorage.getItem(STORAGE_KEY) || "{}";
    expect(raw).not.toContain("Ada");
    expect(raw).not.toContain("Lovelace");
    expect(raw).not.toContain("555-0100");

    const stored = JSON.parse(raw);
    const entry = Object.values(stored)[0] as { uuid: string };
    expect(Object.keys(entry)).toEqual(["uuid"]);
  });

  it("missing tenant or actor identity fails closed and never persists anything", () => {
    expect(() => getOrCreatePendingSubmissionUuid(null, "user-1", "digest")).toThrow();
    expect(() => getOrCreatePendingSubmissionUuid("tenant-1", null, "digest")).toThrow();
    expect(() => getOrCreatePendingSubmissionUuid("", "user-1", "digest")).toThrow();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("malformed stored JSON fails closed rather than silently starting fresh", () => {
    localStorage.setItem(STORAGE_KEY, "{not valid json");

    expect(() => getOrCreatePendingSubmissionUuid("tenant-1", "user-1", "digest")).toThrow();
  });

  it("an invalid existing entry for the requested key fails closed, never silently replaced", () => {
    const digest = "digest-with-bad-entry";
    const key = pendingSubmissionKey("tenant-1", "user-1", digest);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ [key]: { uuid: 12345 } }));

    expect(() => getOrCreatePendingSubmissionUuid("tenant-1", "user-1", digest)).toThrow();

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    expect(stored[key]).toEqual({ uuid: 12345 });
  });

  it("a write whose read-back does not match fails closed (persistence is verified, not assumed)", () => {
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation((key) => {
      if (key === STORAGE_KEY) return;
    });

    try {
      expect(() => getOrCreatePendingSubmissionUuid("tenant-1", "user-1", "digest-that-wont-persist")).toThrow();
    } finally {
      spy.mockRestore();
    }
  });
});

describe("LeadModal end-to-end submission identity", () => {
  async function fillAndReachSubmit() {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    const onClose = vi.fn();
    render(<LeadModal isOpen={true} onClose={onClose} onSuccess={onSuccess} />);

    await waitFor(() => expect(api.me).toHaveBeenCalled());

    await user.type(screen.getByPlaceholderText("Ej. María"), "Ada");
    await user.type(screen.getByPlaceholderText("Ej. López Pérez"), "Lovelace");
    await user.type(screen.getByPlaceholderText("+1 555 1234 567"), "5550100000");
    await user.type(screen.getByPlaceholderText("cliente@email.com"), "ada@example.com");
    await waitFor(() => expect(screen.getByText("Main")).toBeInTheDocument());
    const branchSelect = screen.getAllByRole("combobox").find(
      (el) => within(el as HTMLSelectElement).queryByText("Main") !== null
    ) as HTMLSelectElement;
    await user.selectOptions(branchSelect, "1");

    return { user, onSuccess, onClose };
  }

  it("the outgoing request payload includes submission_uuid", async () => {
    vi.mocked(api.createLead).mockResolvedValueOnce({ id: 1, name: "Ada" });
    await fillAndReachSubmit();

    await userEvent.click(screen.getByText("Guardar Lead"));

    await waitFor(() => expect(api.createLead).toHaveBeenCalledTimes(1));
    const call = vi.mocked(api.createLead).mock.calls[0][0] as { submission_uuid?: string };
    expect(call.submission_uuid).toBeTruthy();
  });

  it("a failed/network-lost request preserves the uuid for the next attempt", async () => {
    vi.mocked(api.createLead).mockRejectedValueOnce(new Error("Network error"));
    await fillAndReachSubmit();

    await userEvent.click(screen.getByText("Guardar Lead"));

    await waitFor(() => expect(api.createLead).toHaveBeenCalledTimes(1));
    const firstCall = vi.mocked(api.createLead).mock.calls[0][0] as { submission_uuid?: string };
    const firstUuid = firstCall.submission_uuid;

    vi.mocked(api.createLead).mockResolvedValueOnce({ id: 1, name: "Ada" });
    await userEvent.click(screen.getByText("Guardar Lead"));

    await waitFor(() => expect(api.createLead).toHaveBeenCalledTimes(2));
    const secondCall = vi.mocked(api.createLead).mock.calls[1][0] as { submission_uuid?: string };

    expect(secondCall.submission_uuid).toBe(firstUuid);
  });

  it("a confirmed 201 success clears the pending identity", async () => {
    vi.mocked(api.createLead).mockResolvedValueOnce({ id: 1, name: "Ada" });
    await fillAndReachSubmit();

    await userEvent.click(screen.getByText("Guardar Lead"));

    await waitFor(() => expect(api.createLead).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(localStorage.getItem(STORAGE_KEY)).toBe(JSON.stringify({})));
  });

  it("a MatchedExisting 422 (El Lead ya existe) clears the pending identity", async () => {
    vi.mocked(api.createLead).mockRejectedValueOnce(
      new ApiError("El Lead ya existe.", {
        status: 422,
        data: { message: "El Lead ya existe.", errors: { phone: ["dup"] } },
      })
    );
    await fillAndReachSubmit();

    await userEvent.click(screen.getByText("Guardar Lead"));

    await waitFor(() => expect(api.createLead).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(localStorage.getItem(STORAGE_KEY)).toBe(JSON.stringify({})));
  });

  it("a 409 idempotency conflict clears the pending identity", async () => {
    vi.mocked(api.createLead).mockRejectedValueOnce(
      new ApiError("Conflicto", { status: 409, data: {} })
    );
    await fillAndReachSubmit();

    await userEvent.click(screen.getByText("Guardar Lead"));

    await waitFor(() => expect(api.createLead).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(localStorage.getItem(STORAGE_KEY)).toBe(JSON.stringify({})));
  });

  it("a plain pre-Kernel 422 validation error does NOT clear the pending identity", async () => {
    vi.mocked(api.createLead).mockRejectedValueOnce(
      new ApiError("Validation failed.", {
        status: 422,
        data: { message: "Validation failed.", errors: { email: ["invalid"] } },
      })
    );
    await fillAndReachSubmit();

    await userEvent.click(screen.getByText("Guardar Lead"));

    await waitFor(() => expect(api.createLead).toHaveBeenCalledTimes(1));
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    expect(Object.keys(stored).length).toBe(1);
  });
});
