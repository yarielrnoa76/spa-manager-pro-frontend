
export enum Role {
  SELLER = 'seller',
  MANAGER = 'manager',
  ADMIN = 'admin',
  SUPERADMIN = 'superadmin'
}

// --- Tenant business-profile enums (values match the backend PHP enums exactly) ---
export type TenantSalesMode = 'grouped_sale' | 'independent_sales';
export type TenantPaymentPolicy = 'full_balance' | 'down_payment';
export type DownPaymentType = 'percentage' | 'fixed';
export type TenantStatus = 'active' | 'suspended';

/**
 * Nested resources only ever returned by the newer Tenant endpoints (POST /api/tenants,
 * GET/PATCH /api/tenant/profile, PATCH /api/tenant/sales-settings, PATCH /api/tenant/
 * payment-settings), which serialize via App\Http\Resources\TenantResource. The older
 * SuperAdmin-global endpoints (GET /api/tenants, GET/PUT /api/tenants/{tenant}) serialize via
 * TenantController::tenantWithMaskedCredentials() instead, which never includes these keys at
 * all (not even as null) — see Tenant.address/contact/settings below.
 */
export interface TenantAddress {
  id: number;
  type: string;
  is_primary: boolean;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country_code: string | null;
}

export interface TenantContact {
  id: number;
  type: string;
  is_primary: boolean;
  first_name: string | null;
  last_name: string | null;
  job_title: string | null;
  email: string | null;
  phone: string | null;
  phone_extension: string | null;
}

/**
 * logo_path is intentionally absent — App\Http\Resources\TenantSettingResource never
 * serializes it; only the derived public logo_url is exposed. No logo upload/replace/delete
 * capability exists in the frontend yet (deferred to a later, dedicated phase).
 */
export interface TenantSettings {
  sales_mode: TenantSalesMode;
  payment_policy: TenantPaymentPolicy;
  down_payment_type: DownPaymentType | null;
  down_payment_value: number | null;
  logo_url: string | null;
  logo_original_filename: string | null;
  logo_mime_type: string | null;
  logo_size_bytes: number | null;
  logo_uploaded_at: string | null;
}

export interface Tenant {
  id: number;
  name: string;
  slug: string;
  status: TenantStatus;
  tenant_api_token?: string | null;
  n8n_api_key?: string | null;
  n8n_webhook_url?: string | null;
  chatwoot_base_url?: string | null;
  chatwoot_api_token?: string | null;
  chatwoot_account_id?: string | null;
  chatwoot_inbox_id?: string | null;
  created_at?: string;
  updated_at?: string;

  // Business-profile columns (Fase 1 backend). Present on every endpoint's response — these
  // are plain, unhidden Tenant model attributes, returned by both tenantWithMaskedCredentials()
  // and TenantResource alike.
  legal_name?: string | null;
  trade_name?: string | null;
  business_email?: string | null;
  billing_email?: string | null;
  business_phone?: string | null;
  website?: string | null;
  timezone?: string | null;
  currency?: string | null;
  locale?: string | null;
  country_code?: string | null;

  // Only ever populated by the newer TenantResource-backed endpoints (see doc-comment above
  // TenantAddress) — structurally absent (undefined), not null, on GET /api/tenants and
  // GET/PUT /api/tenants/{tenant}.
  address?: TenantAddress | null;
  contact?: TenantContact | null;
  settings?: TenantSettings | null;
  owner?: { id?: number; name: string; email: string } | null;
}

/**
 * Configuration -> Integrations -> n8n (SuperAdmin only, global — not tenant-scoped).
 * api_key is always the masked placeholder ("••••••••") when configured, or null — the real
 * Management/Public REST API key is never returned by the backend after it's saved. This is
 * a DIFFERENT credential class than Tenant.n8n_api_key/n8n_webhook_url (the legacy per-tenant
 * SPA -> n8n webhook secret) — never conflate the two.
 */
export interface N8nConnection {
  id: number;
  name: string;
  base_url: string;
  api_key: string | null; // "••••••••" when configured, otherwise null — never a real secret
  active: boolean;
  is_default: boolean;
  last_tested_at: string | null;
  last_test_status: "passed" | "failed" | null;
  assigned_tenants_count: number;
  created_at: string;
  updated_at: string;
}

export interface CreateN8nConnectionPayload {
  name: string;
  base_url: string;
  api_key: string;
  active?: boolean;
  is_default?: boolean;
}

/** api_key omitted (or the masked placeholder) means "keep the currently stored key". */
export interface UpdateN8nConnectionPayload {
  name?: string;
  base_url?: string;
  api_key?: string;
  active?: boolean;
  is_default?: boolean;
}

export interface N8nConnectionTestResult {
  ok: boolean;
  message: string;
  connection?: N8nConnection;
}

// ─────────────────────────────────────────────────────────────────────────────
// WhatsApp Templates (Phase 1/1B backend) — tenant-scoped local registry synced from the
// tenant's Chatwoot inbox. Chatwoot/Meta remain authoritative for everything except the three
// SPA-owned fields (enabled, allowed_when_window_closed, is_default_closed_window). Field names
// match the backend's WhatsappTemplate model attributes exactly.
// ─────────────────────────────────────────────────────────────────────────────

/** Structural only -- which component carries a {{n}} placeholder and at which position.
 * Sending currently only supports component === "BODY" entries; anything else (HEADER,
 * BUTTON_n) is reported for visibility but rejected by the backend at send time. */
export interface WhatsappTemplateParameterSchemaEntry {
  component: string;
  position: number;
  required: boolean;
}

export interface WhatsappTemplateComponent {
  type: string;
  format?: string;
  text?: string;
  example?: unknown;
  buttons?: Array<{ type?: string; text?: string; url?: string }>;
}

export interface WhatsappTemplate {
  id: number;
  tenant_id: number;
  chatwoot_account_id: string | null;
  chatwoot_inbox_id: string;
  external_template_id: string | null;
  name: string;
  language: string;
  category: string | null;
  status: string | null;
  body_preview: string | null;
  components: WhatsappTemplateComponent[] | null;
  parameter_schema: WhatsappTemplateParameterSchemaEntry[] | null;
  parameter_format: string | null;
  enabled: boolean;
  allowed_when_window_closed: boolean;
  is_default_closed_window: boolean;
  is_available: boolean;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WhatsappTemplateListResponse {
  data: WhatsappTemplate[];
  current_page: number;
  last_page: number;
  total: number;
}

export interface WhatsappTemplateSyncResult {
  ok: boolean;
  created: number;
  updated: number;
  restored: number;
  marked_unavailable: number;
  skipped: number;
  total_synced: number;
  synced_at: string;
}

export interface UpdateWhatsappTemplatePayload {
  enabled?: boolean;
  allowed_when_window_closed?: boolean;
  is_default_closed_window?: boolean;
}

/** GET.../messages request body for a registered-template send. body/template_name/
 * template_language are deliberately NOT part of this contract -- the backend resolves and
 * renders them from whatsapp_template_id, ignoring any raw client-supplied values. */
export interface SendWhatsappTemplatePayload {
  whatsapp_template_id: number;
  template_params: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Chatwoot connection health / token rotation (Phase 1B backend, SuperAdmin-only). The current
// token is NEVER part of any response shape here -- these mirror ChatwootConnectionService's
// allow-listed return arrays exactly.
// ─────────────────────────────────────────────────────────────────────────────

export interface ChatwootConnectionHealth {
  configured: boolean;
  ok: boolean;
  account_id?: string | null;
  inbox_id?: string | null;
  inbox_name?: string | null;
  channel_type?: string | null;
  provider?: string | null;
  last_tested_at?: string | null;
  message: string;
}

export interface ChatwootTokenRotationResult extends ChatwootConnectionHealth {
  template_sync?: WhatsappTemplateSyncResult | { ok: false; message: string } | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Payloads — one explicit shape per endpoint (never a blanket Partial<Tenant>).
// ─────────────────────────────────────────────────────────────────────────────

/** POST /api/tenants — nested address block, every field individually optional/nullable. */
export interface CreateTenantAddressPayload {
  address_line_1?: string | null;
  address_line_2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country_code?: string | null;
}

/** POST /api/tenants — nested contact block; first_name/last_name/email required by the backend. */
export interface CreateTenantContactPayload {
  first_name: string;
  last_name: string;
  job_title?: string | null;
  email: string;
  phone?: string | null;
  phone_extension?: string | null;
}

/**
 * POST /api/tenants — nested settings block. down_payment_type/down_payment_value are
 * required together only when payment_policy is 'down_payment' (enforced backend-side); typed
 * as optional/nullable here since TypeScript cannot express that conditional requirement.
 */
export interface CreateTenantSettingsPayload {
  sales_mode: TenantSalesMode;
  payment_policy: TenantPaymentPolicy;
  down_payment_type?: DownPaymentType | null;
  down_payment_value?: number | null;
}

/**
 * The tenant's principal/owner user — a real, immediately-usable login (backend creates a
 * `users` row assigned to this tenant's own `admin` role), never merely a contact record.
 * password_confirmation is required by the backend's `confirmed` rule and is never persisted.
 */
export interface CreateTenantOwnerPayload {
  name: string;
  email: string;
  password: string;
  password_confirmation: string;
}

/**
 * POST /api/tenants (SuperAdmin, global — see api.createTenant()). Matches
 * StoreTenantRequest + TenantProfileRules::forCreate() + TenantAddressRules::forCreate() +
 * TenantContactRules::forCreate() + TenantSettingsRules::forCreate() exactly. No `logo` field —
 * upload is out of scope for this phase.
 */
export interface CreateTenantPayload {
  name: string;
  slug?: string;
  status?: TenantStatus;
  tenant_api_token?: string;
  n8n_api_key?: string;
  n8n_webhook_url?: string;
  chatwoot_base_url?: string;
  chatwoot_api_token?: string;
  chatwoot_account_id?: string;
  chatwoot_inbox_id?: string;

  legal_name?: string | null;
  trade_name: string;
  business_email?: string | null;
  billing_email?: string | null;
  business_phone?: string | null;
  website?: string | null;
  timezone: string;
  currency: string;
  locale?: string | null;
  country_code: string;

  address?: CreateTenantAddressPayload;
  contact: CreateTenantContactPayload;
  settings: CreateTenantSettingsPayload;
  owner: CreateTenantOwnerPayload;
}

/**
 * PATCH /api/tenant/profile — nested address block. Every field: omitted = untouched,
 * explicit null = cleared (all address fields are nullable backend-side). `address` itself may
 * be omitted (untouched) or sent as `null` (treated as a no-op by the backend, same as
 * omission) — never accepts an `id` to target a different row.
 */
export interface UpdateTenantAddressPayload {
  address_line_1?: string | null;
  address_line_2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country_code?: string | null;
}

/**
 * PATCH /api/tenant/profile — nested contact block. first_name/last_name/email are typed as
 * always-string (never null) because the backend rejects an explicit null for them whether or
 * not a primary contact already exists (required-if-creating, non-nullable-if-updating);
 * omitting a key still means "leave untouched" when a primary already exists. `contact` itself
 * does NOT accept `null` (only `address` does) — the backend's own rule never marks it
 * nullable — and never accepts an `id`.
 */
export interface UpdateTenantContactPayload {
  first_name?: string;
  last_name?: string;
  job_title?: string | null;
  email?: string;
  phone?: string | null;
  phone_extension?: string | null;
}

export interface UpdateTenantOwnerPayload {
  name?: string;
  email?: string;
  password?: string;
  password_confirmation?: string;
}

/**
 * PATCH /api/tenant/profile (permission: edit_tenant_profile). Every top-level field: omitted =
 * untouched. legal_name/business_email/billing_email/business_phone/website/locale are
 * nullable (explicit null clears them); trade_name/timezone/currency/country_code are NOT
 * nullable (present-but-required-shape when sent — the backend rejects an explicit null for
 * these four). `currency` is editable here (added for the complete-tenant-edit fix — Fase 2B
 * originally excluded it, but every creation-time profile field must stay editable
 * afterwards). Deliberately excludes name, slug, status, tenant_api_token, the n8n and
 * chatwoot integration fields, the logo fields, role_id/roles/permissions, and
 * sales_mode/payment_policy/down_payment_type/down_payment_value — all explicitly prohibited
 * by UpdateTenantProfileRequest.
 */
export interface UpdateTenantProfilePayload {
  legal_name?: string | null;
  trade_name?: string;
  business_email?: string | null;
  billing_email?: string | null;
  business_phone?: string | null;
  website?: string | null;
  timezone?: string;
  currency?: string;
  locale?: string | null;
  country_code?: string;
  address?: UpdateTenantAddressPayload | null;
  contact?: UpdateTenantContactPayload;
  owner?: UpdateTenantOwnerPayload;
}

/**
 * PATCH /api/tenant/sales-settings (permission: manage_tenant_sales_settings). This endpoint
 * governs exactly one field, always required — there is nothing else to send here.
 */
export interface UpdateTenantSalesSettingsPayload {
  sales_mode: TenantSalesMode;
}

/**
 * PATCH /api/tenant/payment-settings (permission: manage_tenant_payment_settings). True PATCH
 * semantics — every field is independently optional; e.g. sending only down_payment_value
 * keeps the currently-stored payment_policy/down_payment_type untouched. The backend validates
 * the EFFECTIVE state (current + whatever is actually sent here), not just this payload in
 * isolation — see TenantSettingsRules::paymentSettingsCoherenceErrors() backend-side.
 * Switching payment_policy to 'full_balance' atomically clears down_payment_type/value
 * server-side even if this payload omits them.
 */
export interface UpdateTenantPaymentSettingsPayload {
  payment_policy?: TenantPaymentPolicy;
  down_payment_type?: DownPaymentType | null;
  down_payment_value?: number | null;
}

export interface Branch {
  id: string;
  name: string;
  code: string;
  address: string;
  tenant_id?: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: { id: number; name: string };
  branch_id: string;
  branch?: { id: number; name: string } | null;
  tenant_id?: number | null;
  tenant?: { id: number; name: string; slug?: string } | null;
  is_super_admin?: boolean;
  permissions: string[];
}

export interface Product {
  id: number;
  name: string;
  sku?: string | null;
  description?: string | null;

  sales_price: number;
  cost_price: number;

  stock: number;
  min_stock: number;
  max_stock?: number | null;
  type?: 'product' | 'service';
  is_low_stock: boolean;
  tenant_id?: number;
  transactions?: InventoryTransaction[];
  professionals?: Pick<ProfessionalPerson, 'id' | 'fname' | 'lname' | 'title'>[];
}

export interface InventoryTransaction {
  id: string;
  product_id: number;
  type: 'purchase' | 'sale';
  quantity: number;
  stock_before: number;
  stock_after: number;
  created_at: string;
  product?: Product;
}

export interface DailyLog {
  id: string;
  date: string;
  seller_id: string;
  branch_id: string;
  product_id?: string;
  professional_id?: number | null;
  client_name: string;
  service_rendered: string;
  quantity?: number;
  unit_price?: number;
  amount: number;
  payment_method: string;
  notes?: string;
  created_at: string;
  tenant_id?: number;
  seller_name?: string;
  professional_name?: string | null;
  professional?: ProfessionalPerson | null;
  // Payment lifecycle (Payment Platform) — ausentes en ventas históricas pre-migración
  sale_status?: string;
  payment_status?: string;
  payment_provider?: string | null;
  paid_at?: string | null;
  cancelled_at?: string | null;
  // Grouped sales (ADR-027) — null for independent_sales/historical rows. Present only when
  // this line belongs to a SaleGroup header (see src/types/payments.ts).
  sale_group_id?: number | null;
  discount_amount?: number;
  tax_amount?: number;
  deleted_at?: string | null;
}

export interface ProfessionalPerson {
  id: number;
  fname: string;
  lname: string;
  full_name: string;
  phone?: string | null;
  email?: string | null;
  title: string;
  description?: string | null;
  tenant_id?: number;
  tenant?: { id: number; name: string } | null;
  branch_id: number;
  branch?: { id: number; name: string } | null;
  products?: Pick<Product, 'id' | 'name'>[];
}

export interface Lead {
  id: string;
  name: string;
  last_name?: string;
  phone: string;
  email?: string;
  branch_id: string;
  branch?: Branch;
  source: 'whatsapp' | 'call' | 'web' | 'other';
  message: string;
  status: 'new' | 'first_contact' | 'second_contact' | 'third_contact' | 'appointment_set' | 'sold' | 'discarded';
  created_at: string;
  tenant_id?: number;
  assigned_to?: string;
  assignedTo?: User;
  /** ISO 639-1-ish locale (e.g. "es", "en") used to pick a language-appropriate default
   * WhatsApp template for Notify Contact. Defaults to "es" server-side when absent. */
  preferred_language?: string | null;
}

export interface RefundLog {
  id: string;
  date: string;
  branch_id: string;
  quantity: number;
  amount: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  sale_id?: string | number | null;
  product_id?: string | number | null;
  sale?: {
    id: number | string;
    client_name: string;
    service_rendered: string;
    quantity: number;
    unit_price: number;
    amount: number;
  } | null;
  product?: {
    id: number;
    name: string;
    sku?: string | null;
  } | null;
}

export interface MonthlyExpense {
  id: string;
  date: string;
  branch_id: string;
  category: string;
  type: 'Fijo' | 'Variable';
  description: string;
  amount: number;
}

export interface Appointment {
  id: string;
  branch_id: string;
  client_name: string;
  client_phone?: string;
  client_email?: string;
  date: string;
  time: string;
  status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled';
  service_type: string;
  notes?: string;
  tenant_id?: number;
}

export interface TicketCategory {
  id: number;
  name: string;
  sort_order: number;
  is_active: boolean;
}

export interface TicketPriority {
  id: number;
  name: string;
  sla_minutes: number;
  sort_order: number;
  is_active: boolean;
}

export interface TicketComment {
  id: number;
  ticket_id: number;
  comment: string;
  created_by: string;
  created_at: string;
  creator?: { id: number; name: string };
}

export interface Ticket {
  id: number;
  ticket_number: string;
  lead_id: string;
  lead?: Lead;
  category_id: number;
  category?: TicketCategory;
  responsable_id?: string;
  responsable?: User;
  subject: string;
  description?: string;
  status: 'New' | 'InProgress' | 'Cancelled' | 'Completed';
  priority_id: number;
  priority?: TicketPriority;
  due_date?: string;
  is_overdue: boolean;
  origin: 'system' | 'manual';
  source_channel?: string;
  cancel_reason?: string;
  cancelled_at?: string;
  cancelled_by?: string;
  assigned_at?: string;
  assigned_by?: string;
  started_at?: string;
  completed_at?: string;
  created_by?: string;
  updated_by?: string;
  created_at: string;
  updated_at: string;
  comments?: TicketComment[];
}

export interface Notification {
  id: number;
  user_id: string;
  type: string;
  title: string;
  body: string;
  data?: any;
  url?: string;
  read_at?: string;
  created_at: string;
  user?: {
    id: number;
    name: string;
    email: string;
  };
}

/** Present only on outbound messages sent through the registered-template contract. */
export interface ConversationMessageTemplateMeta {
  is_template: true;
  whatsapp_template_id?: number;
  template_name: string;
  template_language: string;
  template_params: string[];
  external_template_id?: string | null;
}

export interface ConversationMessage {
  id: number;
  tenant_id: number;
  conversation_id: number;
  direction: 'inbound' | 'outbound';
  message_type: 'text' | 'image' | 'audio' | 'document' | 'system' | 'note';
  sender_type: 'customer' | 'bot' | 'user' | 'system';
  body: string;
  status: string;
  is_read: boolean;
  created_at: string;
  deleted_at?: string | null;
  sender?: User;
  meta?: ConversationMessageTemplateMeta | null;
}

export interface Conversation {
  id: number;
  tenant_id: number;
  branch_id?: string;
  lead_id?: string;
  assigned_user_id?: string;
  contact_name: string;
  contact_phone: string;
  status: 'open' | 'pending' | 'resolved' | 'closed';
  bot_enabled: boolean;
  is_important: boolean;
  last_message_at: string;
  last_message_preview: string;
  unread_count: number;
  created_at: string;
  updated_at?: string;
  deleted_at?: string | null;
  lead?: Lead;
  assignedUser?: User;
  branch?: Branch;
  /**
   * Backend-authoritative WhatsApp 24h customer-service window state
   * (Conversation::isWindowOpen() / windowExpiresAt()). Never compute this on the client —
   * always trust these two fields, refetched from the server.
   */
  window_open: boolean;
  window_expires_at: string | null;
  /** Present only on the conversation's own Chatwoot inbox, when set (may differ from the
   * tenant's default inbox for a future multi-inbox tenant). */
  chatwoot_inbox_id?: string | null;
}
