import { useEffect, useState } from "react";
import { api } from "../services/api";
import type { AuthenticatedUser } from "../types";

/**
 * The ONE resolver for "which branch does this sale belong to, and who is the default seller" --
 * shared by every sale-creation entry point (Ventas Diarias, venta desde Lead, Live Chat).
 * Nothing here ever infers authority from a role's NAME, from whichever list happened to load,
 * or from a UI control being merely `disabled` -- every decision is derived from the real
 * `AuthenticatedUser` contract and, when needed, a real `GET /api/branches` response.
 *
 * Rules (see the sales-context audit this hotfix closes):
 *   A. A branch-restricted user with an authoritative branch (`branch_id`/`branch`) always uses
 *      it; the field is shown, locked, never re-selectable.
 *   B. An actor authorized to work across branches (`is_super_admin` with an effective tenant,
 *      or `view_all_sales`/`view_branch`) must actively choose among the branches the backend
 *      actually returns -- never auto-selected, never assumed.
 *   C. An actor with NO authoritative branch and NOT free to choose still gets a real
 *      `GET /api/branches` lookup (the backend already scopes it) as a controlled compatibility
 *      fallback: exactly one result may be adopted and locked; zero or more than one is an
 *      explicit context error, never a silent choice.
 *   D. A SuperAdmin with no effective tenant (`active_tenant_id` null) never autoselects a
 *      branch and never resolves a usable context at all.
 *   E. The authenticated actor is always the default seller; assigning someone else requires
 *      `assign_sale` (or SuperAdmin) -- this hook only exposes the capability flag, never fetches
 *      or holds the candidate list itself.
 */

export type SaleContextErrorCode = "NO_TENANT_CONTEXT" | "NO_BRANCH_RESOLVED" | "AMBIGUOUS_BRANCHES";

export interface EffectiveSaleContextBranch {
  id: number;
  name: string;
}

export interface EffectiveSaleContext {
  /** True while a required `GET /api/branches` lookup is in flight. */
  isLoadingBranches: boolean;
  /** The non-negotiable, already-resolved branch (Rule A or the Rule C single-branch fallback).
   * `null` when the actor must actively choose (Rule B) or when no usable context exists. */
  effectiveBranchId: number | null;
  effectiveBranch: EffectiveSaleContextBranch | null;
  /** True only when the actor is authorized to freely choose among `availableBranches` (Rule B
   * or Rule D with an effective tenant). Never true at the same time as a locked
   * `effectiveBranchId`. */
  canSelectBranch: boolean;
  /** Populated whenever a branches lookup actually ran (Rule B or Rule C) -- the ONLY valid
   * source of selectable options; a caller must never accept a branch id that isn't in here. */
  availableBranches: EffectiveSaleContextBranch[];
  /** The authenticated actor's own id, as a string ready for a form field -- `null` only when
   * `user` itself is `null` (identity not resolved yet). */
  defaultSellerId: string | null;
  canAssignOtherSeller: boolean;
  errorCode: SaleContextErrorCode | null;
  errorMessage: string | null;
}

const ERROR_MESSAGES: Record<SaleContextErrorCode, string> = {
  NO_TENANT_CONTEXT:
    "Selecciona un tenant antes de registrar una venta. Un SuperAdmin sin tenant activo no puede operar.",
  NO_BRANCH_RESOLVED:
    "No se pudo determinar una sucursal para esta venta. Contacta a un administrador para que te asigne una sucursal.",
  AMBIGUOUS_BRANCHES:
    "Tu cuenta tiene acceso a varias sucursales, pero no puedes elegir una libremente aquí. Contacta a un administrador.",
};

const IDLE_CONTEXT: EffectiveSaleContext = {
  isLoadingBranches: false,
  effectiveBranchId: null,
  effectiveBranch: null,
  canSelectBranch: false,
  availableBranches: [],
  defaultSellerId: null,
  canAssignOtherSeller: false,
  errorCode: null,
  errorMessage: null,
};

function toBranchList(raw: unknown): EffectiveSaleContextBranch[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((b) => {
      const id = Number((b as { id?: unknown })?.id);
      const name = String((b as { name?: unknown })?.name ?? "");
      return Number.isFinite(id) ? { id, name } : null;
    })
    .filter((b): b is EffectiveSaleContextBranch => b !== null);
}

/**
 * @param user The real authenticated user (App.tsx's own `UserData`/`api.me()` result) -- never
 *   a hand-built substitute. `null` while identity hasn't resolved yet.
 * @param enabled Set to `false` to skip any network lookup (e.g. while the consuming modal is
 *   closed) -- mirrors every other modal's own `isOpen` gate in this codebase.
 */
export function useEffectiveSaleContext(
  user: AuthenticatedUser | null,
  enabled: boolean = true,
): EffectiveSaleContext {
  const isSuperAdmin = user?.is_super_admin === true;
  const perms = Array.isArray(user?.permissions) ? user!.permissions : [];
  const hasViewAllSales = perms.includes("view_all_sales");
  const hasViewBranch = perms.includes("view_branch");
  const canAssignOtherSeller = isSuperAdmin || perms.includes("assign_sale");

  // Gate 1A: a SuperAdmin's effective tenant is `active_tenant_id`; a tenant-bound user's is
  // `tenant_id` (their own `active_tenant_id` is always null per the backend contract).
  const hasEffectiveTenant = isSuperAdmin ? user?.active_tenant_id != null : user?.tenant_id != null;

  const authoritativeBranchId = user?.branch_id ?? user?.branch?.id ?? null;
  const authoritativeBranch = user?.branch ?? null;

  const isBranchRestricted = authoritativeBranchId !== null && !isSuperAdmin && !hasViewAllSales;
  const canFreelySelectBranch =
    !isBranchRestricted && hasEffectiveTenant && (isSuperAdmin || hasViewBranch);

  const blockedNoTenant = isSuperAdmin && !hasEffectiveTenant;

  // A branches lookup is needed exactly when: the actor may freely choose (Rule B/D), OR there
  // is no authoritative branch and the actor can't freely choose either (Rule C fallback) --
  // never when Rule A already resolved a branch, and never when blocked for lack of tenant.
  const needsBranchLookup =
    !blockedNoTenant && authoritativeBranchId === null && (canFreelySelectBranch || hasEffectiveTenant);

  const [lookup, setLookup] = useState<{
    status: "idle" | "loading" | "success" | "error";
    branches: EffectiveSaleContextBranch[];
  }>({ status: "idle", branches: [] });

  useEffect(() => {
    if (!enabled || !needsBranchLookup) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLookup({ status: "idle", branches: [] });
      return;
    }
    let cancelled = false;
    setLookup((prev) => ({ ...prev, status: "loading" }));
    api
      .listBranches()
      .then((res) => {
        if (cancelled) return;
        setLookup({ status: "success", branches: toBranchList(res) });
      })
      .catch(() => {
        if (cancelled) return;
        setLookup({ status: "error", branches: [] });
      });
    return () => {
      cancelled = true;
    };
    // Re-resolve whenever the actor's own identity/branch changes, not on every render.
  }, [enabled, needsBranchLookup, user?.id, isBranchRestricted, canFreelySelectBranch, hasEffectiveTenant]);

  if (!user) return IDLE_CONTEXT;

  const defaultSellerId = user.id != null ? String(user.id) : null;

  if (blockedNoTenant) {
    return {
      ...IDLE_CONTEXT,
      defaultSellerId,
      canAssignOtherSeller,
      errorCode: "NO_TENANT_CONTEXT",
      errorMessage: ERROR_MESSAGES.NO_TENANT_CONTEXT,
    };
  }

  // Rule A: authoritative branch already known -- locked, no lookup needed.
  if (authoritativeBranchId !== null) {
    return {
      ...IDLE_CONTEXT,
      effectiveBranchId: authoritativeBranchId,
      effectiveBranch: authoritativeBranch,
      canSelectBranch: false,
      defaultSellerId,
      canAssignOtherSeller,
    };
  }

  // Rule B (or D with a tenant): free choice among whatever the backend actually returns.
  if (canFreelySelectBranch) {
    return {
      ...IDLE_CONTEXT,
      isLoadingBranches: lookup.status === "loading" || lookup.status === "idle",
      availableBranches: lookup.branches,
      canSelectBranch: true,
      defaultSellerId,
      canAssignOtherSeller,
      errorMessage: lookup.status === "error" ? "No se pudieron cargar las sucursales disponibles." : null,
    };
  }

  // Rule C: controlled compatibility fallback -- adopt exactly one, never choose among several,
  // never silently proceed with zero.
  if (lookup.status === "loading" || lookup.status === "idle") {
    return { ...IDLE_CONTEXT, isLoadingBranches: true, defaultSellerId, canAssignOtherSeller };
  }
  if (lookup.status === "error") {
    return {
      ...IDLE_CONTEXT,
      defaultSellerId,
      canAssignOtherSeller,
      errorCode: "NO_BRANCH_RESOLVED",
      errorMessage: "No se pudo consultar tu sucursal autorizada. Inténtalo de nuevo.",
    };
  }
  if (lookup.branches.length === 1) {
    const only = lookup.branches[0];
    return {
      ...IDLE_CONTEXT,
      effectiveBranchId: only.id,
      effectiveBranch: only,
      canSelectBranch: false,
      availableBranches: lookup.branches,
      defaultSellerId,
      canAssignOtherSeller,
    };
  }

  return {
    ...IDLE_CONTEXT,
    availableBranches: lookup.branches,
    defaultSellerId,
    canAssignOtherSeller,
    errorCode: lookup.branches.length === 0 ? "NO_BRANCH_RESOLVED" : "AMBIGUOUS_BRANCHES",
    errorMessage:
      lookup.branches.length === 0 ? ERROR_MESSAGES.NO_BRANCH_RESOLVED : ERROR_MESSAGES.AMBIGUOUS_BRANCHES,
  };
}
