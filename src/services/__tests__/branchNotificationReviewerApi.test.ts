import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { api } from "../api";

/**
 * Branch default notification reviewer, at the HTTP layer. The contract is exactly:
 *   GET /api/branches/{branch}/notification-reviewer
 *   PUT /api/branches/{branch}/notification-reviewer  with the body {"user_id": <int>}
 * The backend rejects unknown fields, so the body must never carry a tenant or a branch; the
 * tenant travels only in the shared X-Tenant-ID header and the branch only in the path.
 */

function mockFetchOk(body: unknown = { data: {} }) {
  return vi.fn().mockResolvedValue({
    status: 200,
    ok: true,
    text: () => Promise.resolve(JSON.stringify(body)),
  });
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("auth_token", "test-token");
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("branch notification reviewer API", () => {
  it("reads the configuration of one branch with GET and the effective tenant header", async () => {
    localStorage.setItem("current_tenant_id", "42");
    const fetchMock = mockFetchOk();
    vi.stubGlobal("fetch", fetchMock);

    await api.getBranchNotificationReviewer(7);

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/api\/branches\/7\/notification-reviewer$/);
    expect(init.method).toBe("GET");
    expect(init.body).toBeUndefined();
    expect(init.headers["X-Tenant-ID"]).toBe("42");
    expect(init.headers["Authorization"]).toBe("Bearer test-token");
  });

  it("designates a reviewer with PUT and a body of exactly { user_id }", async () => {
    localStorage.setItem("current_tenant_id", "42");
    const fetchMock = mockFetchOk();
    vi.stubGlobal("fetch", fetchMock);

    await api.setBranchNotificationReviewer(7, 12);

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/api\/branches\/7\/notification-reviewer$/);
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body)).toEqual({ user_id: 12 });
    expect(Object.keys(JSON.parse(init.body))).toEqual(["user_id"]);
    expect(init.headers["X-Tenant-ID"]).toBe("42");
  });

  it("follows the stored tenant: a different tenant changes only the header, never the body", async () => {
    const fetchMock = mockFetchOk();
    vi.stubGlobal("fetch", fetchMock);

    localStorage.setItem("current_tenant_id", "1");
    await api.setBranchNotificationReviewer(7, 12);
    localStorage.setItem("current_tenant_id", "2");
    await api.setBranchNotificationReviewer(7, 12);

    expect(fetchMock.mock.calls[0][1].headers["X-Tenant-ID"]).toBe("1");
    expect(fetchMock.mock.calls[1][1].headers["X-Tenant-ID"]).toBe("2");
    expect(fetchMock.mock.calls[0][1].body).toBe(fetchMock.mock.calls[1][1].body);
  });

  it("surfaces the backend's ineligible-user rejection with its closed code and reason", async () => {
    localStorage.setItem("current_tenant_id", "1");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        status: 422,
        ok: false,
        text: () =>
          Promise.resolve(
            JSON.stringify({
              message: "The selected user cannot be designated as the notification reviewer for this branch.",
              code: "REVIEWER_NOT_ELIGIBLE",
              reason: "user_lacks_assign_ticket",
            }),
          ),
      }),
    );

    await expect(api.setBranchNotificationReviewer(7, 12)).rejects.toMatchObject({
      status: 422,
      code: "REVIEWER_NOT_ELIGIBLE",
      data: { reason: "user_lacks_assign_ticket" },
    });
  });
});
