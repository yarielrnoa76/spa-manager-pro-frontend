import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useEffectiveSaleContext } from "../useEffectiveSaleContext";
import { api } from "../../services/api";
import type { AuthenticatedUser } from "../../types";

/**
 * The ONE resolver for effective branch + default seller, shared by every sale-creation entry
 * point (Ventas Diarias, venta desde Lead, Live Chat). `api.listBranches` is mocked to verify
 * exactly when (and whether) a lookup actually runs.
 */

vi.mock("../../services/api", () => ({
  api: { listBranches: vi.fn() },
}));

const baseUser = (overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser => ({
  id: "10",
  name: "Salesman1DGS",
  email: "sales@example.com",
  tenant_id: 2,
  active_tenant_id: null,
  is_super_admin: false,
  branch_id: null,
  branch: null,
  role: { id: 2, name: "sales" },
  permissions: ["create_sale", "view_products"],
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useEffectiveSaleContext — Rule A: authoritative branch", () => {
  it("locks the branch and never calls listBranches when branch_id/branch are present", async () => {
    const user = baseUser({ branch_id: 3, branch: { id: 3, name: "DGS_Sucursal1" } });
    const { result } = renderHook(() => useEffectiveSaleContext(user, true));

    expect(result.current.effectiveBranchId).toBe(3);
    expect(result.current.effectiveBranch).toEqual({ id: 3, name: "DGS_Sucursal1" });
    expect(result.current.canSelectBranch).toBe(false);
    expect(result.current.defaultSellerId).toBe("10");
    expect(result.current.canAssignOtherSeller).toBe(false);
    expect(api.listBranches).not.toHaveBeenCalled();
  });

  it("falls back to branch.id when branch_id itself is absent but branch is present", () => {
    const user = baseUser({ branch_id: null, branch: { id: 3, name: "DGS_Sucursal1" } });
    const { result } = renderHook(() => useEffectiveSaleContext(user, true));
    expect(result.current.effectiveBranchId).toBe(3);
  });
});

describe("useEffectiveSaleContext — Rule C: controlled compatibility fallback", () => {
  it("adopts the single branch GET /api/branches returns and locks it", async () => {
    vi.mocked(api.listBranches).mockResolvedValue([{ id: 3, name: "DGS_Sucursal1" }]);
    const user = baseUser({ branch_id: null, branch: null, tenant_id: 2 });
    const { result } = renderHook(() => useEffectiveSaleContext(user, true));

    await waitFor(() => expect(result.current.effectiveBranchId).toBe(3));
    expect(result.current.effectiveBranch).toEqual({ id: 3, name: "DGS_Sucursal1" });
    expect(result.current.canSelectBranch).toBe(false);
    expect(result.current.errorCode).toBeNull();
  });

  it("never chooses among several branches -- explicit AMBIGUOUS_BRANCHES error instead", async () => {
    vi.mocked(api.listBranches).mockResolvedValue([
      { id: 3, name: "DGS_Sucursal1" },
      { id: 4, name: "DGS_Sucursal2" },
    ]);
    const user = baseUser({ branch_id: null, branch: null });
    const { result } = renderHook(() => useEffectiveSaleContext(user, true));

    await waitFor(() => expect(result.current.errorCode).toBe("AMBIGUOUS_BRANCHES"));
    expect(result.current.effectiveBranchId).toBeNull();
    expect(result.current.canSelectBranch).toBe(false);
  });

  it("never silently proceeds with zero branches -- explicit NO_BRANCH_RESOLVED error", async () => {
    vi.mocked(api.listBranches).mockResolvedValue([]);
    const user = baseUser({ branch_id: null, branch: null });
    const { result } = renderHook(() => useEffectiveSaleContext(user, true));

    await waitFor(() => expect(result.current.errorCode).toBe("NO_BRANCH_RESOLVED"));
    expect(result.current.effectiveBranchId).toBeNull();
  });
});

describe("useEffectiveSaleContext — Rule B: free selection", () => {
  it("an admin with view_branch must choose among the real branches, never auto-selected", async () => {
    vi.mocked(api.listBranches).mockResolvedValue([
      { id: 1, name: "Main" },
      { id: 2, name: "North" },
    ]);
    const user = baseUser({
      role: { id: 1, name: "admin" },
      permissions: ["view_branch"],
      branch_id: null,
      branch: null,
    });
    const { result } = renderHook(() => useEffectiveSaleContext(user, true));

    await waitFor(() => expect(result.current.availableBranches).toHaveLength(2));
    expect(result.current.canSelectBranch).toBe(true);
    expect(result.current.effectiveBranchId).toBeNull();
    expect(result.current.errorCode).toBeNull();
  });
});

describe("useEffectiveSaleContext — Rule D: SuperAdmin tenant gating", () => {
  it("a SuperAdmin without an effective tenant never autoselects and reports NO_TENANT_CONTEXT", () => {
    const user = baseUser({ is_super_admin: true, active_tenant_id: null, tenant_id: null, branch: null, branch_id: null });
    const { result } = renderHook(() => useEffectiveSaleContext(user, true));

    expect(result.current.errorCode).toBe("NO_TENANT_CONTEXT");
    expect(result.current.effectiveBranchId).toBeNull();
    expect(result.current.canSelectBranch).toBe(false);
    expect(api.listBranches).not.toHaveBeenCalled();
  });

  it("a SuperAdmin WITH an effective tenant may freely choose among real branches", async () => {
    vi.mocked(api.listBranches).mockResolvedValue([{ id: 1, name: "Main" }, { id: 2, name: "North" }]);
    const user = baseUser({ is_super_admin: true, active_tenant_id: 7, branch: null, branch_id: null });
    const { result } = renderHook(() => useEffectiveSaleContext(user, true));

    await waitFor(() => expect(result.current.availableBranches).toHaveLength(2));
    expect(result.current.canSelectBranch).toBe(true);
    expect(result.current.errorCode).toBeNull();
  });
});

describe("useEffectiveSaleContext — Rule E: seller assignment", () => {
  it("the authenticated actor is always the default seller", () => {
    const user = baseUser({ branch_id: 3, branch: { id: 3, name: "DGS_Sucursal1" } });
    const { result } = renderHook(() => useEffectiveSaleContext(user, true));
    expect(result.current.defaultSellerId).toBe("10");
  });

  it("canAssignOtherSeller is false without assign_sale, true with it", () => {
    const withoutPerm = baseUser({ permissions: ["create_sale"] });
    const { result: r1 } = renderHook(() => useEffectiveSaleContext(withoutPerm, true));
    expect(r1.current.canAssignOtherSeller).toBe(false);

    const withPerm = baseUser({ permissions: ["create_sale", "assign_sale"] });
    const { result: r2 } = renderHook(() => useEffectiveSaleContext(withPerm, true));
    expect(r2.current.canAssignOtherSeller).toBe(true);
  });

  it("SuperAdmin can always assign another seller", () => {
    const user = baseUser({ is_super_admin: true, active_tenant_id: 1, permissions: [] });
    const { result } = renderHook(() => useEffectiveSaleContext(user, true));
    expect(result.current.canAssignOtherSeller).toBe(true);
  });
});

describe("useEffectiveSaleContext — disabled / no user", () => {
  it("never calls listBranches while enabled=false", () => {
    const user = baseUser({ branch_id: null, branch: null });
    renderHook(() => useEffectiveSaleContext(user, false));
    expect(api.listBranches).not.toHaveBeenCalled();
  });

  it("returns a safe idle context when user is null", () => {
    const { result } = renderHook(() => useEffectiveSaleContext(null, true));
    expect(result.current.defaultSellerId).toBeNull();
    expect(result.current.canSelectBranch).toBe(false);
    expect(result.current.effectiveBranchId).toBeNull();
    expect(api.listBranches).not.toHaveBeenCalled();
  });
});
