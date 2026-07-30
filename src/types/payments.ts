export type StripeConnectionType =
  | "express_created_by_platform"
  | "standard_oauth_authorized_by_owner"
  | "manual_external_reference";

export type PaymentConnectionStatus =
  | "not_connected"
  | "pending"
  | "connected"
  | "disconnected"
  | "revoked"
  | "error";

export type OnboardingStatus = "not_connected" | "pending" | "complete";

export interface TenantStripeAccountSafe {
  connection_type: StripeConnectionType | null;
  connection_status: PaymentConnectionStatus;
  onboarding_status: OnboardingStatus;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  details_submitted: boolean;
  default_currency: string | null;
  oauth_scope: string | null;
  live_mode: boolean | null;
  external_reference_note: string | null;
  owner_oauth_authorization_enabled: boolean;
  connected_at: string | null;
  disconnected_at: string | null;
}

export type PaymentRequestStatus =
  | "pending"
  | "link_generated"
  | "paid"
  | "failed"
  | "expired"
  | "cancelled"
  | "refunded"
  | "partially_refunded";

export type PaymentTimelineEntryType =
  | 'pr_created'
  | 'status_change'
  | 'stripe_session'
  | 'transaction'
  | 'refund'
  | 'pr_updated';

export interface PaymentTimelineEntry {
  type: PaymentTimelineEntryType;
  timestamp: string;
  actor: string | null;
  label: string;
  // Presente (con signo implícito por `type`) en 'transaction' (pago exitoso, +) y
  // 'refund' (siempre -). Ausente/null en los demás tipos de entrada.
  amount?: number | null;
  meta: Record<string, string | null>;
}

export interface PaymentRequest {
  id: number;
  // Grouped sales (ADR-027): exactly one of sale_id/sale_group_id is ever set, never both.
  // independent_sales/historical requests: sale_id set, sale_group_id null. grouped_sale
  // requests: sale_group_id set, sale_id null.
  sale_id: number | null;
  sale_group_id: number | null;
  sale_group?: SaleGroup | null;
  lead_id: number | null;
  appointment_id: number | null;
  amount: number | string;
  currency: string;
  status: PaymentRequestStatus;
  sent_at: string | null;
  paid_at: string | null;
  cancelled_at: string | null;
  stripe_checkout_session_id: string | null;
  payment_url: string | null;
  expires_at: string | null;
  created_at: string;
}

export type PaymentTransactionStatus =
  | "pending"
  | "succeeded"
  | "failed"
  | "refunded"
  | "partially_refunded";

export type PaymentRefundStatus = "pending" | "requires_action" | "succeeded" | "failed" | "canceled";

/**
 * Optional, additive per-line allocation (ADR-027): only ever populated when staff attributed a
 * grouped-sale partial refund to specific lines. Audit only — the refund's own `amount` is
 * always the authoritative figure Stripe actually processed.
 */
export interface PaymentRefundLine {
  id: number;
  payment_refund_id: number;
  daily_log_id: number;
  amount: number | string;
}

export interface PaymentRefund {
  id: number;
  payment_transaction_id: number;
  stripe_refund_id: string | null;
  amount: number | string;
  currency: string;
  reason: string | null;
  failure_reason: string | null;
  status: PaymentRefundStatus;
  requested_by: number | null;
  processed_at: string | null;
  created_at: string;
  lines?: PaymentRefundLine[];
}

export interface PaymentTransaction {
  id: number;
  // Same exactly-one-of rule as PaymentRequest above (ADR-027).
  sale_id: number | null;
  sale_group_id: number | null;
  payment_request_id: number;
  stripe_payment_intent_id: string | null;
  stripe_charge_id: string | null;
  amount: number | string;
  fee_amount: number | string | null;
  net_amount: number | string | null;
  currency: string;
  status: PaymentTransactionStatus;
  failure_reason: string | null;
  paid_at: string | null;
  refunds?: PaymentRefund[];
  // Contrato financiero calculado por el backend (App\Models\PaymentTransaction) —
  // siempre derivado de payment_refunds, nunca recalculado en el frontend.
  gross_paid_amount: number;
  successful_refunded_amount: number;
  pending_refund_amount: number;
  net_collected_amount: number;
  remaining_refundable_amount: number;
}

/**
 * Resumen financiero de una venta completa a través de TODAS sus transacciones
 * (una venta puede tener más de un PaymentIntent: intentos fallidos previos + el
 * exitoso). Devuelto por GET /payment-transactions cuando se filtra por sale_id.
 */
export interface SaleFinancialSummary {
  gross_paid_amount: number;
  successful_refunded_amount: number;
  pending_refund_amount: number;
  net_collected_amount: number;
  remaining_refundable_amount: number;
  transaction_count: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Grouped sales (ADR-027) — TenantSetting.sales_mode = 'grouped_sale'. Purely additive: an
// independent_sales sale never has a SaleGroup and never appears in these types.
// ─────────────────────────────────────────────────────────────────────────────

/** One line of a grouped sale — structurally a DailyLog row sharing one sale_group_id. */
export interface SaleGroupLine {
  id: number;
  sale_group_id: number;
  product_id: number | null;
  service_rendered: string;
  quantity: number;
  unit_price: number | string;
  discount_amount: number | string;
  tax_amount: number | string;
  amount: number | string;
  professional_id: number | null;
  sale_status?: string;
  payment_status?: string;
}

/** GET /api/sale-groups/{id} — the header, with every line it owns. */
export interface SaleGroup {
  id: number;
  tenant_id: number;
  branch_id: number;
  lead_id: number | null;
  seller_id: number | null;
  client_name: string;
  date: string;
  payment_method: string;
  currency: string;
  subtotal_amount: number | string;
  discount_amount: number | string;
  tax_amount: number | string;
  total_amount: number | string;
  sale_status: string;
  payment_status: string;
  payment_provider: string | null;
  paid_at: string | null;
  cancelled_at: string | null;
  notes?: string | null;
  created_at: string;
  lines: SaleGroupLine[];
}

/** One cart item as sent in POST /api/sales's `items` array. */
export interface SaleCartItem {
  product_id?: number | string | null;
  quantity: number;
  service_rendered: string;
  unit_price: number;
  amount?: number;
  discount_amount?: number;
  tax_amount?: number;
  professional_id?: number | string | null;
}

/**
 * POST /api/sales's response is discriminated by the tenant's OWN persisted sales_mode, never by
 * what the client sent: `items` array + grouped_sale -> {type:'group'}; `items` array +
 * independent_sales -> {type:'batch'} (N independent sales, same as today's per-item loop, just
 * one round-trip); legacy single-item payload -> the bare DailyLog, unchanged from before this
 * feature existed.
 */
export interface CreateSaleGroupResponse {
  type: 'group';
  sale_group: SaleGroup;
}

export interface CreateSaleBatchResponse {
  type: 'batch';
  sales: unknown[];
}
