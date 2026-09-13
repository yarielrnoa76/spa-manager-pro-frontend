import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useEffectiveSaleContext } from "../useEffectiveSaleContext";
import { api, ApiError } from "../../services/api";
import type { AuthenticatedUser, SaleCreateContext } from "../../types";

/**
 * The ONE resolver for "may this actor create a sale, in which branch, as which seller" -- now a
 * thin client over `GET /api/sales/create-context`. EVERY assertion here is about the hook
 * faithfully relaying that backend response (and failing closed when the request itself fails);
 * none of it re-derives authorization from `role.name`, `permissions`, or `is_super_admin` -- the
 * hook no longer even reads those fields, which several tests below demonstrate directly.
 */

vi.mock("../../services/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../services/api")>();
  return {
    ...actual,
    api: { getSaleCreateContext: vi.fn() },
  };
});

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
  permissions: [],
  ...overrides,
});

function ctx(overrides: Partial<SaleCreateContext> = {}): SaleCreateContext {
  return {
    can_create_sale: true,
    sales_scope: "branch",
    context_ready: true,
    blocking_code: null,
    effective_branch: { id: 3, name: "DGS_Sucursal1" },
    can_select_branch: false,
    available_branches: [],
    default_seller: { id: 10, name: "Salesman1DGS" },
    can_assign_other_seller: false,
    seller_candidates: [],
    can_view_products: true,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useEffectiveSaleContext — relays the backend response verbatim", () => {
  it("maps every field 1:1 from create-context, with no local reinterpretation", async () => {
    vi.mocked(api.getSaleCreateContext).mockResolvedValue(
      ctx({
        can_select_branch: true,
        available_branches: [{ id: 1, name: "Main" }, { id: 2, name: "North" }],
        can_assign_other_seller: true,
        seller_candidates: [{ id: 20, name: "Alice" }],
        sales_scope: "all",
      }),
    );
    const { result } = renderHook(() => useEffectiveSaleContext(baseUser(), true));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.canCreateSale).toBe(true);
    expect(result.current.salesScope).toBe("all");
    expect(result.current.contextReady).toBe(true);
    expect(result.current.blockingCode).toBeNull();
    expect(result.current.canSelectBranch).toBe(true);
    expect(result.current.availableBranches).toEqual([{ id: 1, name: "Main" }, { id: 2, name: "North" }]);
    expect(result.current.canAssignOtherSeller).toBe(true);
    expect(result.current.sellerCandidates).toEqual([{ id: 20, name: "Alice" }]);
    expect(result.current.canViewProducts).toBe(true);
  });

  it("requests create-context with no branch_id on the initial fetch", async () => {
    vi.mocked(api.getSaleCreateContext).mockResolvedValue(ctx());
    renderHook(() => useEffectiveSaleContext(baseUser(), true));
    await waitFor(() => expect(api.getSaleCreateContext).toHaveBeenCalledWith(undefined));
  });

  it("never calls the endpoint while disabled, and reports isLoading rather than any capability", () => {
    const { result } = renderHook(() => useEffectiveSaleContext(baseUser(), false));
    expect(api.getSaleCreateContext).not.toHaveBeenCalled();
    expect(result.current.canCreateSale).toBe(false);
    expect(result.current.contextReady).toBe(false);
  });
});

describe("useEffectiveSaleContext — role name and permissions are never consulted", () => {
  it("two users with different role NAMES and different permission arrays but the SAME backend response produce the IDENTICAL context", async () => {
    vi.mocked(api.getSaleCreateContext).mockResolvedValue(
      ctx({ can_select_branch: true, available_branches: [{ id: 1, name: "Main" }] }),
    );
    const userA = baseUser({ role: { id: 1, name: "coordinador_regional" }, permissions: [] });
    const userB = baseUser({ id: "11", role: { id: 2, name: "otro_rol_cualquiera" }, permissions: ["some_unrelated_perm"] });

    const { result: rA } = renderHook(() => useEffectiveSaleContext(userA, true));
    const { result: rB } = renderHook(() => useEffectiveSaleContext(userB, true));

    await waitFor(() => expect(rA.current.isLoading).toBe(false));
    await waitFor(() => expect(rB.current.isLoading).toBe(false));

    expect(rA.current.canCreateSale).toBe(rB.current.canCreateSale);
    expect(rA.current.canSelectBranch).toBe(rB.current.canSelectBranch);
    expect(rA.current.availableBranches).toEqual(rB.current.availableBranches);
    expect(rA.current.contextReady).toBe(rB.current.contextReady);
  });

  it("a role literally named 'admin' with can_select_branch=false from the backend still cannot select a branch", async () => {
    vi.mocked(api.getSaleCreateContext).mockResolvedValue(ctx({ can_select_branch: false }));
    const user = baseUser({ role: { id: 1, name: "admin" }, is_super_admin: false, permissions: [] });
    const { result } = renderHook(() => useEffectiveSaleContext(user, true));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.canSelectBranch).toBe(false);
  });

  it("a role literally named 'sales' with can_select_branch=true from the backend CAN select a branch", async () => {
    vi.mocked(api.getSaleCreateContext).mockResolvedValue(
      ctx({ can_select_branch: true, available_branches: [{ id: 1, name: "Main" }] }),
    );
    const user = baseUser({ role: { id: 1, name: "sales" }, permissions: [] });
    const { result } = renderHook(() => useEffectiveSaleContext(user, true));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.canSelectBranch).toBe(true);
  });

  it("TWO roles sharing the exact same NAME but DIFFERENT backend responses produce DIFFERENT contexts -- the name is never the signal", async () => {
    const user1 = baseUser({ id: "30", role: { id: 9, name: "cajero_dia" } });
    const user2 = baseUser({ id: "31", role: { id: 9, name: "cajero_dia" } });

    vi.mocked(api.getSaleCreateContext).mockResolvedValueOnce(
      ctx({ can_select_branch: false, effective_branch: { id: 3, name: "DGS_Sucursal1" } }),
    );
    const { result: r1 } = renderHook(() => useEffectiveSaleContext(user1, true));
    await waitFor(() => expect(r1.current.isLoading).toBe(false));

    vi.mocked(api.getSaleCreateContext).mockResolvedValueOnce(
      ctx({ can_select_branch: true, effective_branch: null, available_branches: [{ id: 1, name: "Main" }, { id: 2, name: "North" }] }),
    );
    const { result: r2 } = renderHook(() => useEffectiveSaleContext(user2, true));
    await waitFor(() => expect(r2.current.isLoading).toBe(false));

    expect(r1.current.canSelectBranch).toBe(false);
    expect(r1.current.effectiveBranch).toEqual({ id: 3, name: "DGS_Sucursal1" });
    expect(r2.current.canSelectBranch).toBe(true);
    expect(r2.current.effectiveBranch).toBeNull();
    expect(r1.current.canSelectBranch).not.toBe(r2.current.canSelectBranch);
  });
});

describe("useEffectiveSaleContext — sales_scope combinations (own/branch/all), backend-driven only", () => {
  it("a 'manager' role with sales_scope=branch is locked to the backend's effective branch", async () => {
    vi.mocked(api.getSaleCreateContext).mockResolvedValue(
      ctx({ sales_scope: "branch", can_select_branch: false, effective_branch: { id: 3, name: "DGS_Sucursal1" } }),
    );
    const user = baseUser({ role: { id: 1, name: "manager" } });
    const { result } = renderHook(() => useEffectiveSaleContext(user, true));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.salesScope).toBe("branch");
    expect(result.current.canSelectBranch).toBe(false);
    expect(result.current.effectiveBranch).toEqual({ id: 3, name: "DGS_Sucursal1" });
  });

  it("a 'manager' role with sales_scope=all may freely choose among the backend's branches", async () => {
    vi.mocked(api.getSaleCreateContext).mockResolvedValue(
      ctx({ sales_scope: "all", can_select_branch: true, effective_branch: null, available_branches: [{ id: 1, name: "Main" }, { id: 2, name: "North" }] }),
    );
    const user = baseUser({ role: { id: 1, name: "manager" } });
    const { result } = renderHook(() => useEffectiveSaleContext(user, true));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.salesScope).toBe("all");
    expect(result.current.canSelectBranch).toBe(true);
    expect(result.current.availableBranches).toHaveLength(2);
  });

  it("an 'admin' role with sales_scope=all may freely choose among the backend's branches", async () => {
    vi.mocked(api.getSaleCreateContext).mockResolvedValue(
      ctx({ sales_scope: "all", can_select_branch: true, effective_branch: null, available_branches: [{ id: 1, name: "Main" }] }),
    );
    const user = baseUser({ role: { id: 1, name: "admin" } });
    const { result } = renderHook(() => useEffectiveSaleContext(user, true));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.canSelectBranch).toBe(true);
  });

  it("a custom role with create_sale + sales_scope=branch behaves exactly like any other branch-scoped actor", async () => {
    vi.mocked(api.getSaleCreateContext).mockResolvedValue(
      ctx({ sales_scope: "branch", can_select_branch: false, effective_branch: { id: 4, name: "Sucursal Norte" } }),
    );
    const user = baseUser({ role: { id: 12, name: "cajero_custom" }, permissions: ["create_sale"] });
    const { result } = renderHook(() => useEffectiveSaleContext(user, true));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.canCreateSale).toBe(true);
    expect(result.current.canSelectBranch).toBe(false);
    expect(result.current.effectiveBranch).toEqual({ id: 4, name: "Sucursal Norte" });
  });

  it("a custom role with create_sale + sales_scope=all behaves exactly like any other freely-choosing actor", async () => {
    vi.mocked(api.getSaleCreateContext).mockResolvedValue(
      ctx({ sales_scope: "all", can_select_branch: true, effective_branch: null, available_branches: [{ id: 1, name: "Main" }, { id: 2, name: "North" }] }),
    );
    const user = baseUser({ role: { id: 13, name: "supervisor_custom" }, permissions: ["create_sale"] });
    const { result } = renderHook(() => useEffectiveSaleContext(user, true));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.canCreateSale).toBe(true);
    expect(result.current.canSelectBranch).toBe(true);
    expect(result.current.availableBranches).toHaveLength(2);
  });

  it("sales_scope='own' with a resolved branch is still just whatever the backend returns -- locked, not selectable", async () => {
    vi.mocked(api.getSaleCreateContext).mockResolvedValue(
      ctx({ sales_scope: "own", can_select_branch: false, effective_branch: { id: 3, name: "DGS_Sucursal1" }, can_assign_other_seller: false }),
    );
    const user = baseUser({ role: { id: 14, name: "junior_seller" } });
    const { result } = renderHook(() => useEffectiveSaleContext(user, true));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.salesScope).toBe("own");
    expect(result.current.canSelectBranch).toBe(false);
    expect(result.current.canAssignOtherSeller).toBe(false);
    expect(result.current.contextReady).toBe(true);
  });

  it("sales_scope='own' with NO branch at all fails closed via context_ready=false, never a silent choice", async () => {
    vi.mocked(api.getSaleCreateContext).mockResolvedValue(
      ctx({ sales_scope: "own", can_create_sale: true, can_select_branch: false, effective_branch: null, context_ready: false, blocking_code: "BRANCH_REQUIRED" }),
    );
    const user = baseUser({ role: { id: 14, name: "junior_seller" } });
    const { result } = renderHook(() => useEffectiveSaleContext(user, true));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.contextReady).toBe(false);
    expect(result.current.canSelectBranch).toBe(false);
    expect(result.current.blockingMessage).toBeTruthy();
  });

  it("an invalid scope (SCOPE_INVALID) fails closed distinctly from an absent one (SCOPE_MISSING)", async () => {
    vi.mocked(api.getSaleCreateContext).mockResolvedValue(
      ctx({ can_create_sale: false, context_ready: false, effective_branch: null, blocking_code: "SCOPE_INVALID" }),
    );
    const user = baseUser({ role: { id: 15, name: "rol_con_scope_roto" } });
    const { result } = renderHook(() => useEffectiveSaleContext(user, true));
    await waitFor(() => expect(result.current.blockingCode).toBe("SCOPE_INVALID"));
    expect(result.current.contextReady).toBe(false);
    expect(result.current.blockingMessage).toBeTruthy();
  });
});

describe("useEffectiveSaleContext — branch selection re-requests and recomputes", () => {
  it("selectBranch re-fetches create-context with the chosen branch_id and replaces the whole context", async () => {
    vi.mocked(api.getSaleCreateContext).mockResolvedValueOnce(
      ctx({ can_select_branch: true, available_branches: [{ id: 1, name: "Main" }, { id: 2, name: "North" }], effective_branch: null, context_ready: false }),
    );
    const { result } = renderHook(() => useEffectiveSaleContext(baseUser({ is_super_admin: true, active_tenant_id: 9 }), true));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.effectiveBranch).toBeNull();
    expect(result.current.contextReady).toBe(false);

    vi.mocked(api.getSaleCreateContext).mockResolvedValueOnce(
      ctx({ can_select_branch: true, available_branches: [{ id: 1, name: "Main" }, { id: 2, name: "North" }], effective_branch: { id: 2, name: "North" }, context_ready: true }),
    );
    result.current.selectBranch(2);

    await waitFor(() => expect(api.getSaleCreateContext).toHaveBeenLastCalledWith(2));
    await waitFor(() => expect(result.current.effectiveBranch).toEqual({ id: 2, name: "North" }));
    expect(result.current.contextReady).toBe(true);
  });

  it("never adopts the clicked branch locally while the re-validation request is in flight", async () => {
    let resolveSecond: (v: SaleCreateContext) => void = () => {};
    vi.mocked(api.getSaleCreateContext).mockResolvedValueOnce(
      ctx({ can_select_branch: true, available_branches: [{ id: 1, name: "Main" }, { id: 2, name: "North" }], effective_branch: null, context_ready: false }),
    );
    const { result } = renderHook(() => useEffectiveSaleContext(baseUser({ is_super_admin: true, active_tenant_id: 9 }), true));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    vi.mocked(api.getSaleCreateContext).mockImplementationOnce(
      () => new Promise<SaleCreateContext>((resolve) => { resolveSecond = resolve; }),
    );
    result.current.selectBranch(2);

    await waitFor(() => expect(result.current.isLoading).toBe(true));
    // Still no effective branch -- the click alone never adopts it.
    expect(result.current.effectiveBranch).toBeNull();

    resolveSecond(ctx({ can_select_branch: true, effective_branch: { id: 2, name: "North" }, context_ready: true }));
    await waitFor(() => expect(result.current.effectiveBranch).toEqual({ id: 2, name: "North" }));
  });

  it("a backend rejection of the chosen branch (blocking_code) never falls back to a silent local choice", async () => {
    vi.mocked(api.getSaleCreateContext).mockResolvedValueOnce(
      ctx({ can_select_branch: true, available_branches: [{ id: 1, name: "Main" }], effective_branch: null, context_ready: false }),
    );
    const { result } = renderHook(() => useEffectiveSaleContext(baseUser({ is_super_admin: true, active_tenant_id: 9 }), true));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    vi.mocked(api.getSaleCreateContext).mockResolvedValueOnce(
      ctx({ can_select_branch: true, effective_branch: null, context_ready: false, blocking_code: "BRANCH_INVALID" }),
    );
    result.current.selectBranch(999);

    await waitFor(() => expect(result.current.blockingCode).toBe("BRANCH_INVALID"));
    expect(result.current.effectiveBranch).toBeNull();
    expect(result.current.contextReady).toBe(false);
    expect(result.current.blockingMessage).toBeTruthy();
  });

  it("passes an initialBranchId hint only on the first request, as a hint the backend may accept or reject", async () => {
    vi.mocked(api.getSaleCreateContext).mockResolvedValue(ctx());
    renderHook(() => useEffectiveSaleContext(baseUser(), true, 7));
    await waitFor(() => expect(api.getSaleCreateContext).toHaveBeenCalledWith(7));
  });
});

describe("useEffectiveSaleContext — blocking codes and generic-safe messages", () => {
  it("a known blocking_code (SCOPE_MISSING) produces a specific, non-empty message", async () => {
    vi.mocked(api.getSaleCreateContext).mockResolvedValue(
      ctx({ can_create_sale: false, context_ready: false, effective_branch: null, blocking_code: "SCOPE_MISSING" }),
    );
    const { result } = renderHook(() => useEffectiveSaleContext(baseUser(), true));
    await waitFor(() => expect(result.current.blockingCode).toBe("SCOPE_MISSING"));
    expect(result.current.blockingMessage).toBeTruthy();
    expect(result.current.contextReady).toBe(false);
  });

  it("an unrecognized/future blocking_code still fails closed with a generic message, never the raw code", async () => {
    vi.mocked(api.getSaleCreateContext).mockResolvedValue(
      ctx({ can_create_sale: false, context_ready: false, effective_branch: null, blocking_code: "SOME_FUTURE_CODE_NOT_YET_KNOWN" }),
    );
    const { result } = renderHook(() => useEffectiveSaleContext(baseUser(), true));
    await waitFor(() => expect(result.current.blockingCode).toBe("SOME_FUTURE_CODE_NOT_YET_KNOWN"));
    expect(result.current.blockingMessage).toBeTruthy();
    expect(result.current.blockingMessage).not.toContain("SOME_FUTURE_CODE_NOT_YET_KNOWN");
    expect(result.current.contextReady).toBe(false);
  });

  it("scope 'own' with no branch and create_sale denied fails closed via can_create_sale=false", async () => {
    vi.mocked(api.getSaleCreateContext).mockResolvedValue(
      ctx({ can_create_sale: false, sales_scope: "own", context_ready: false, effective_branch: null, blocking_code: "CREATE_SALE_DENIED" }),
    );
    const { result } = renderHook(() => useEffectiveSaleContext(baseUser(), true));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.canCreateSale).toBe(false);
    expect(result.current.contextReady).toBe(false);
  });
});

describe("useEffectiveSaleContext — fails closed on a transport/authorization failure of create-context itself", () => {
  it("a 403 from create-context itself grants nothing and reports a FORBIDDEN failure", async () => {
    vi.mocked(api.getSaleCreateContext).mockRejectedValue(new ApiError("forbidden", { status: 403 }));
    const { result } = renderHook(() => useEffectiveSaleContext(baseUser(), true));

    await waitFor(() => expect(result.current.fetchFailure).toBe("FORBIDDEN"));
    expect(result.current.canCreateSale).toBe(false);
    expect(result.current.contextReady).toBe(false);
    expect(result.current.canSelectBranch).toBe(false);
    expect(result.current.canViewProducts).toBe(false);
    expect(result.current.blockingMessage).toBeTruthy();
  });

  it("a network error grants nothing and reports a NETWORK_ERROR failure, distinct from FORBIDDEN", async () => {
    vi.mocked(api.getSaleCreateContext).mockRejectedValue(new TypeError("Failed to fetch"));
    const { result } = renderHook(() => useEffectiveSaleContext(baseUser(), true));

    await waitFor(() => expect(result.current.fetchFailure).toBe("NETWORK_ERROR"));
    expect(result.current.canCreateSale).toBe(false);
    expect(result.current.contextReady).toBe(false);
  });
});

describe("useEffectiveSaleContext — SuperAdmin is read only via is_super_admin, still backend-authorized", () => {
  it("a SuperAdmin's capabilities still come entirely from the backend response, not from is_super_admin locally", async () => {
    vi.mocked(api.getSaleCreateContext).mockResolvedValue(
      ctx({ sales_scope: "all", can_select_branch: true, available_branches: [{ id: 1, name: "Main" }, { id: 2, name: "North" }] }),
    );
    const user = baseUser({ is_super_admin: true, active_tenant_id: 9 });
    const { result } = renderHook(() => useEffectiveSaleContext(user, true));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.canSelectBranch).toBe(true);
    expect(result.current.availableBranches).toHaveLength(2);
  });

  it("a SuperAdmin without an effective tenant is still governed by whatever the backend returns (e.g. TENANT_REQUIRED)", async () => {
    vi.mocked(api.getSaleCreateContext).mockResolvedValue(
      ctx({ can_create_sale: false, context_ready: false, effective_branch: null, blocking_code: "TENANT_REQUIRED" }),
    );
    const user = baseUser({ is_super_admin: true, active_tenant_id: null });
    const { result } = renderHook(() => useEffectiveSaleContext(user, true));
    await waitFor(() => expect(result.current.blockingCode).toBe("TENANT_REQUIRED"));
    expect(result.current.contextReady).toBe(false);
  });
});
