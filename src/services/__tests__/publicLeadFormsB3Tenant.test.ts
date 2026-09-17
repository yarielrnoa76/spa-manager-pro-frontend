import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { api } from "../api";

/**
 * Form Builder B3 tenant isolation, at the HTTP layer: every new B3 endpoint (draft, draft
 * preview, draft/publish, activate, versions) must go through the SAME shared `request()` helper
 * that already attaches `X-Tenant-ID` from the confirmed, server-derived effective tenant --
 * never a bespoke fetch call that could silently skip it. This is what makes "no tenant context"
 * fail closed: the frontend never fabricates a tenant id, and never opts these calls out of the
 * header the backend's `SetTenantContext` middleware requires.
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

describe("Form Builder B3 — X-Tenant-ID is attached to every new endpoint", () => {
  it("getPublicLeadFormDraft sends the effective tenant header", async () => {
    localStorage.setItem("current_tenant_id", "42");
    const fetchMock = mockFetchOk({ data: { uuid: "v1", version_number: 1, status: "draft", schema: [], branding: {}, created_at: null, updated_at: null } });
    vi.stubGlobal("fetch", fetchMock);

    await api.getPublicLeadFormDraft(1);

    const headers = fetchMock.mock.calls[0][1].headers;
    expect(headers["X-Tenant-ID"]).toBe("42");
  });

  it("listPublicLeadFormVersions sends the effective tenant header", async () => {
    localStorage.setItem("current_tenant_id", "7");
    const fetchMock = mockFetchOk({ data: [] });
    vi.stubGlobal("fetch", fetchMock);

    await api.listPublicLeadFormVersions(1);

    expect(fetchMock.mock.calls[0][1].headers["X-Tenant-ID"]).toBe("7");
  });

  it("with no tenant selected, the request carries no X-Tenant-ID -- it never fabricates one (fails closed server-side)", async () => {
    const fetchMock = mockFetchOk({ data: {} });
    vi.stubGlobal("fetch", fetchMock);

    await api.getPublicLeadFormDraftPreview(1);

    expect(fetchMock.mock.calls[0][1].headers["X-Tenant-ID"]).toBeUndefined();
  });

  it("switching the stored tenant id changes which tenant subsequent B3 calls target", async () => {
    localStorage.setItem("current_tenant_id", "1");
    const fetchMock = mockFetchOk({ data: [] });
    vi.stubGlobal("fetch", fetchMock);
    await api.listPublicLeadFormVersions(1);
    expect(fetchMock.mock.calls[0][1].headers["X-Tenant-ID"]).toBe("1");

    localStorage.setItem("current_tenant_id", "2");
    await api.listPublicLeadFormVersions(1);
    expect(fetchMock.mock.calls[1][1].headers["X-Tenant-ID"]).toBe("2");
  });
});
