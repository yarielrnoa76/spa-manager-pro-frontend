import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "../App";
import { api } from "../services/api";
import type { UserData } from "../App";

/**
 * Form Builder B2 — "Formularios Web" sidebar entry and its `/lead-forms` route must both be
 * gated on `view_public_lead_forms` (or SuperAdmin) -- typing the URL directly must not bypass
 * that, exactly the same discipline the existing Tickets/Tasks route already follows.
 *
 * Every `api` method other than the few this test configures explicitly falls back to an
 * auto-resolving stub -- this test is about routing/menu visibility, not exhaustively mocking
 * every page's own data calls.
 */

vi.mock("../services/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/api")>();
  const known: Record<string, ReturnType<typeof vi.fn>> = {};
  const emptyEither = () => Object.assign([], { data: [], total: 0, last_page: 1, current_page: 1, per_page: 15 });
  const stub = new Proxy(known, {
    get(target, prop: string) {
      if (!(prop in target)) {
        target[prop] = vi.fn().mockImplementation(() => Promise.resolve(emptyEither()));
      }
      return target[prop];
    },
  });
  return { ...actual, api: stub };
});

const baseUser = (permissions: string[], overrides: Partial<UserData> = {}): UserData => ({
  id: "1",
  name: "Test User",
  email: "user@example.com",
  role: { id: 2, name: "sales" },
  is_super_admin: false,
  permissions,
  ...overrides,
});

beforeEach(() => {
  vi.mocked(api.getToken).mockReturnValue("fake-token");
  vi.mocked(api.me).mockResolvedValue(baseUser(["view_public_lead_forms"]));
  // PublicLeadForms.tsx's own list-response shape -- the generic empty-either stub above lacks
  // `meta`, which this page's render assumes.
  vi.mocked(api.listPublicLeadForms).mockResolvedValue({
    data: [],
    links: { first: null, last: null, prev: null, next: null },
    meta: { current_page: 1, from: null, last_page: 1, path: "", per_page: 15, to: null, total: 0 },
  });
});

describe("App — Formularios Web menu and route guard", () => {
  it('shows the exact "Formularios Web" sidebar option when the user holds view_public_lead_forms', async () => {
    vi.mocked(api.me).mockResolvedValue(baseUser(["view_public_lead_forms"]));

    render(
      <MemoryRouter initialEntries={["/lead-forms"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: /Formularios Web/i })).toBeTruthy();
    // Also present as its own sidebar link, distinct from the page heading above.
    expect(screen.getByRole("link", { name: /Formularios Web/i })).toBeTruthy();
  });

  it("hides the sidebar option entirely when the user lacks view_public_lead_forms", async () => {
    vi.mocked(api.me).mockResolvedValue(baseUser([]));

    render(
      <MemoryRouter initialEntries={["/sales"]}>
        <App />
      </MemoryRouter>,
    );

    await waitFor(() => expect(api.me).toHaveBeenCalled());
    expect(screen.queryByText("Formularios Web")).toBeNull();
  });

  it("redirects away from /lead-forms typed directly when the user lacks view_public_lead_forms", async () => {
    vi.mocked(api.me).mockResolvedValue(baseUser([]));

    render(
      <MemoryRouter initialEntries={["/lead-forms"]}>
        <App />
      </MemoryRouter>,
    );

    await waitFor(() => expect(api.me).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByText(/Formularios Web/i)).toBeNull());
  });

  it("renders the Formularios Web surface at /lead-forms for an authorized user, never a redirect", async () => {
    vi.mocked(api.me).mockResolvedValue(baseUser(["view_public_lead_forms"]));

    render(
      <MemoryRouter initialEntries={["/lead-forms"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: /Formularios Web/i })).toBeTruthy();
  });

  it("a SuperAdmin with an effective tenant can access /lead-forms without holding the permission explicitly", async () => {
    vi.mocked(api.me).mockResolvedValue(
      baseUser([], { is_super_admin: true, active_tenant_id: 5, tenant: { id: 5, name: "Acme" } }),
    );
    vi.mocked(api.listTenants).mockResolvedValue([{ id: 5, name: "Acme", slug: "acme", status: "active" }]);

    render(
      <MemoryRouter initialEntries={["/lead-forms"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: /Formularios Web/i })).toBeTruthy();
  });
});
