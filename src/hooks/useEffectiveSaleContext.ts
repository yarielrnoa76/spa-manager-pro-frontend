import { useEffect, useState } from "react";
import { api, ApiError } from "../services/api";
import type { AuthenticatedUser, SaleCreateContext, SaleCreateContextParty } from "../types";

/**
 * The ONE resolver for "may this actor create a sale, in which branch, as which seller" --
 * shared by every sale-creation entry point (Ventas Diarias, venta desde Lead). This hook is a
 * thin client over `GET /api/sales/create-context`: EVERY capability it exposes comes from that
 * backend response. It never infers authorization from `role.name`, from `is_super_admin` alone,
 * from permission lists, from how many branches a lookup happened to return, or from a UI
 * control being merely `disabled`. Its own job is limited to: fetching, re-fetching when the
 * actor actively chooses a branch, and translating a `blocking_code`/network failure into a
 * safe, generic, user-facing message -- never fabricating a capability the backend didn't grant.
 *
 * Branch selection flow: choosing a branch from `availableBranches` calls `selectBranch(id)`,
 * which re-requests `create-context?branch_id=<id>` and replaces the ENTIRE context with the
 * backend's recomputed answer -- the chosen branch is never adopted locally before that response
 * comes back. `sellerCandidates`/`defaultSellerId` are replaced wholesale on every response, so a
 * caller that keeps a locally-selected seller must re-validate it against the new list itself
 * (see `CreateSaleModal`).
 */

export type SaleContextFailure = "FORBIDDEN" | "NETWORK_ERROR";

export interface EffectiveSaleContext {
  /** True while the initial or a branch-triggered `create-context` request is in flight. */
  isLoading: boolean;
  /** Backend-decided: the actor holds `create_sale` for some scope. */
  canCreateSale: boolean;
  /** Backend-owned scope label (e.g. "own"/"branch"/"all") -- display/diagnostic only, never
   * interpreted by the frontend as authorization on its own. */
  salesScope: string | null;
  /** Backend-decided: true only when every piece needed to submit a sale (branch, seller) is
   * resolved. A caller must gate submission on this, never on local field completeness alone. */
  contextReady: boolean;
  /** Raw backend code for why the context isn't usable (`null` when it is, or while loading). */
  blockingCode: string | null;
  /** Safe, generic, already-translated message for `blockingCode` -- never the raw backend
   * payload or an internal trace. `null` when there is nothing to show. */
  blockingMessage: string | null;
  effectiveBranch: SaleCreateContextParty | null;
  canSelectBranch: boolean;
  availableBranches: SaleCreateContextParty[];
  /** Selects a branch from `availableBranches` and re-requests the backend's recomputed context
   * for it. A no-op when `canSelectBranch` is false. */
  selectBranch: (branchId: number) => void;
  defaultSeller: SaleCreateContextParty | null;
  canAssignOtherSeller: boolean;
  /** Exclusively from `create-context` -- a caller must never call `/api/users` or
   * `/api/users/candidates` itself to populate a seller picker. */
  sellerCandidates: SaleCreateContextParty[];
  canViewProducts: boolean;
  /** Set only for a genuine transport/authorization failure of `create-context` itself (never a
   * backend-declared block, which is `blockingCode`) -- the caller must fail closed on this. */
  fetchFailure: SaleContextFailure | null;
}

const IDLE_CONTEXT: EffectiveSaleContext = {
  isLoading: false,
  canCreateSale: false,
  salesScope: null,
  contextReady: false,
  blockingCode: null,
  blockingMessage: null,
  effectiveBranch: null,
  canSelectBranch: false,
  availableBranches: [],
  selectBranch: () => {},
  defaultSeller: null,
  canAssignOtherSeller: false,
  sellerCandidates: [],
  canViewProducts: false,
  fetchFailure: null,
};

/** Known codes get a specific, safe message; anything else the backend ever sends still fails
 * closed with a generic message -- never the raw code, never invented specifics. */
const BLOCKING_MESSAGES: Record<string, string> = {
  CREATE_SALE_DENIED: "No tienes permiso para crear ventas.",
  SCOPE_MISSING: "Tu rol no tiene un alcance de ventas configurado. Contacta a un administrador.",
  SCOPE_INVALID: "El alcance de ventas configurado para tu rol no es válido. Contacta a un administrador.",
  TENANT_REQUIRED: "Selecciona un tenant antes de registrar una venta.",
  BRANCH_REQUIRED: "Debes seleccionar una sucursal antes de continuar.",
  BRANCH_INVALID: "La sucursal seleccionada no es válida para tu cuenta.",
};
const GENERIC_BLOCKING_MESSAGE = "No se pudo habilitar la creación de ventas para tu cuenta. Contacta a un administrador.";

function blockingMessageFor(code: string | null): string | null {
  if (!code) return null;
  return BLOCKING_MESSAGES[code] ?? GENERIC_BLOCKING_MESSAGE;
}

const FETCH_FAILURE_MESSAGES: Record<SaleContextFailure, string> = {
  FORBIDDEN: "No tienes autorización para crear ventas.",
  NETWORK_ERROR: "No se pudo verificar tu contexto de venta. Verifica tu conexión e inténtalo de nuevo.",
};

type FetchState =
  | { phase: "loading" }
  | { phase: "success"; data: SaleCreateContext }
  | { phase: "failure"; failure: SaleContextFailure };

/**
 * @param user The real authenticated user -- used only to key the fetch to the current identity
 *   (re-fetch on user change) and to gate the call on `enabled`. Never read for capabilities.
 * @param enabled Set to `false` to skip any network request (e.g. while the consuming modal is
 *   closed) -- mirrors every other modal's own `isOpen` gate in this codebase.
 * @param initialBranchId An optional caller-supplied hint (e.g. `initialData.branch_id` from a
 *   lead's own branch) sent as `branch_id` on the FIRST request only -- a hint for the backend to
 *   validate, never a value this hook adopts on its own. The backend either honors it (a
 *   free-choosing actor whose branch it matches), ignores it (a branch-restricted actor's own
 *   authoritative branch always wins server-side), or rejects it (`blockingCode`); whatever comes
 *   back in `effectiveBranch` is the only thing ever treated as resolved.
 */
export function useEffectiveSaleContext(
  user: AuthenticatedUser | null,
  enabled: boolean = true,
  initialBranchId?: number | null,
): EffectiveSaleContext {
  const [selectedBranchId, setSelectedBranchId] = useState<number | null>(initialBranchId ?? null);
  const [state, setState] = useState<FetchState>({ phase: "loading" });

  // A fresh open never carries over a branch chosen (or hinted) in a previous session with this
  // same mounted hook instance -- re-seeded from the caller's hint again. Adjusting state during
  // render (React's own documented pattern for "reset on prop change") rather than in an effect,
  // so the very first request after reopening already carries the right hint.
  const [wasEnabled, setWasEnabled] = useState(enabled);
  if (enabled !== wasEnabled) {
    setWasEnabled(enabled);
    if (enabled) setSelectedBranchId(initialBranchId ?? null);
  }

  const userId = user?.id ?? null;

  useEffect(() => {
    if (!enabled || userId == null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState({ phase: "loading" });
      return;
    }
    let cancelled = false;
    setState({ phase: "loading" });
    api
      .getSaleCreateContext(selectedBranchId ?? undefined)
      .then((data) => {
        if (cancelled) return;
        setState({ phase: "success", data });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const status = err instanceof ApiError ? err.status : undefined;
        setState({ phase: "failure", failure: status === 403 ? "FORBIDDEN" : "NETWORK_ERROR" });
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, userId, selectedBranchId]);

  const selectBranch = (branchId: number) => {
    setSelectedBranchId(branchId);
  };

  if (state.phase === "loading") {
    return { ...IDLE_CONTEXT, isLoading: true, selectBranch };
  }

  if (state.phase === "failure") {
    return {
      ...IDLE_CONTEXT,
      selectBranch,
      fetchFailure: state.failure,
      blockingMessage: FETCH_FAILURE_MESSAGES[state.failure],
    };
  }

  const data = state.data;
  return {
    isLoading: false,
    canCreateSale: data.can_create_sale === true,
    salesScope: data.sales_scope ?? null,
    contextReady: data.context_ready === true,
    blockingCode: data.blocking_code ?? null,
    blockingMessage: blockingMessageFor(data.blocking_code ?? null),
    effectiveBranch: data.effective_branch ?? null,
    canSelectBranch: data.can_select_branch === true,
    availableBranches: Array.isArray(data.available_branches) ? data.available_branches : [],
    selectBranch,
    defaultSeller: data.default_seller ?? null,
    canAssignOtherSeller: data.can_assign_other_seller === true,
    sellerCandidates: Array.isArray(data.seller_candidates) ? data.seller_candidates : [],
    canViewProducts: data.can_view_products === true,
    fetchFailure: null,
  };
}
