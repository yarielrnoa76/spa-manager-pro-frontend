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
  | 'pr_updated';

export interface PaymentTimelineEntry {
  type: PaymentTimelineEntryType;
  timestamp: string;
  actor: string | null;
  label: string;
  meta: Record<string, string | null>;
}

export interface PaymentRequest {
  id: number;
  sale_id: number;
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

export type PaymentRefundStatus = "pending" | "succeeded" | "failed" | "canceled";

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
}

export interface PaymentTransaction {
  id: number;
  sale_id: number;
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
}
