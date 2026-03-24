const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
console.log("API_URL =", API_URL);

import {
  Branch,
  Product,
  DailyLog,
  Lead,
  Appointment,
  Tenant,
} from "../types";

export interface ActivityLog {
  id: number;
  user_id: number;
  tenant_id: number;
  model_type: string;
  model_id: number;
  event: 'created' | 'updated' | 'deleted' | 'login' | 'logout';
  old_values: any;
  new_values: any;
  ip_address: string;
  user_agent: string;
  created_at: string;
  user?: { id: number; name: string };
  tenant?: { id: number; name: string };
  branch?: { id: number; name: string };
  subject_label?: string;
}

export type LoginPayload = { email: string; password: string };

export type DashboardStats = {
  totalSales: number;
  profit: number;
  recentLeads: Array<Lead>;
  salesCount: number;
  lowStockCount: number;
};

if (!API_URL) {
  console.error(
    "VITE_API_URL is missing. Create frontend/.env with VITE_API_URL=http://127.0.0.1:8000 and restart npm run dev",
  );
}

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

type ApiErrorPayload = {
  ok?: boolean;
  code?: string;
  message?: string;
  errors?: Record<string, string[]>;
};

class ApiError extends Error {
  code?: string;
  status?: number;
  errors?: Record<string, string[]>;
  data?: ApiErrorPayload;

  constructor(
    message: string,
    opts?: {
      code?: string;
      status?: number;
      errors?: Record<string, string[]>;
      data?: ApiErrorPayload;
    },
  ) {
    super(message);
    this.name = "ApiError";
    this.code = opts?.code;
    this.status = opts?.status;
    this.errors = opts?.errors;
    this.data = opts?.data;
  }
}

function safeJsonParse(text: string): ApiErrorPayload {
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}

async function request<T>(
  path: string,
  options: { method?: HttpMethod; body?: unknown; auth?: boolean } = {},
): Promise<T> {
  const method = options.method ?? "GET";
  const auth = options.auth ?? true;

  const headers: Record<string, string> = { Accept: "application/json" };
  if (method !== "GET") headers["Content-Type"] = "application/json";

  if (auth) {
    const token = localStorage.getItem("auth_token");
    if (token) headers["Authorization"] = `Bearer ${token}`;

    // === MULTI-TENANT: Add X-Tenant-ID header ===
    const tenantId = localStorage.getItem("current_tenant_id");
    if (tenantId) {
      headers["X-Tenant-ID"] = tenantId;
    }
  }

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    cache: "no-store", // Prevent browser from caching cross-tenant GET requests
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (res.status === 204) return null as unknown as T;

  const rawText = await res.text().catch(() => "");
  const data = safeJsonParse(rawText);

  if (res.status === 401) localStorage.removeItem("auth_token");

  if (!res.ok) {
    if (res.status === 503 && data?.code === "DB_CONNECTION_ERROR") {
      throw new ApiError("Connection to DB Server Error. Check Backend is running", {
        code: "DB_CONNECTION_ERROR",
        status: 503,
        data,
      });
    }

    if (res.status === 422) {
      throw new ApiError(data?.message || "Validation failed.", {
        code: data?.code || "VALIDATION_ERROR",
        status: 422,
        errors: data?.errors || {},
        data,
      });
    }

    throw new ApiError(data?.message || `Request failed (${res.status})`, {
      code: data?.code,
      status: res.status,
      data,
    });
  }

  return (rawText ? (data as T) : (null as unknown as T)) as T;
}

function normalizeApiPath(path: string): string {
  if (!path.startsWith("/")) path = `/${path}`;
  return path.startsWith("/api/") ? path : `/api${path}`;
}

export const api = {
  // --- Token helpers ---
  getToken(): string | null {
    return localStorage.getItem("auth_token");
  },
  setToken(token: string) {
    localStorage.setItem("auth_token", token);
  },
  clearToken() {
    localStorage.removeItem("auth_token");
  },

  // --- Tenant Context helpers ---
  getCurrentTenantId(): string | null {
    return localStorage.getItem("current_tenant_id");
  },
  setCurrentTenantId(tenantId: number | string) {
    localStorage.setItem("current_tenant_id", String(tenantId));
  },
  clearCurrentTenantId() {
    localStorage.removeItem("current_tenant_id");
  },

  // --- Auth ---
  async login(payload: LoginPayload) {
    const data = await request<{ token: string; user: unknown; tenant?: { id: number; name: string } }>(`/api/login`, {
      method: "POST",
      body: payload,
      auth: false,
    });
    if (data?.token) this.setToken(data.token);

    // Auto-set tenant context for non-SuperAdmin users
    if (data?.tenant?.id) {
      this.setCurrentTenantId(data.tenant.id);
    }

    return data;
  },

  async me() {
    return request<{
      id: string;
      name: string;
      email: string;
      tenant_id?: number | null;
      tenant?: { id: number; name: string; slug?: string } | null;
      is_super_admin?: boolean;
      branch?: { id: number; name: string } | null;
      role: { id: number; name: string };
      permissions: string[];
    }>(`/api/user`, { method: "GET", auth: true }).catch(
      () => null,
    );
  },

  async logout() {
    try {
      await request(`/api/logout`, { method: "POST", auth: true });
    } finally {
      this.clearToken();
      this.clearCurrentTenantId();
    }
  },

  // --- Tenants (SuperAdmin only) ---
  async listTenants() {
    return request<Tenant[]>(`/api/tenants`, { method: "GET", auth: true });
  },

  async createTenant(payload: { name: string; slug?: string; status?: string }) {
    return request<Tenant>(`/api/tenants`, { method: "POST", body: payload, auth: true });
  },

  async updateTenant(tenantId: number, payload: { name?: string; slug?: string; status?: string }) {
    return request<Tenant>(`/api/tenants/${tenantId}`, { method: "PUT", body: payload, auth: true });
  },

  async deleteTenant(tenantId: number, confirmName: string, confirmPhrase: string) {
    return request(`/api/tenants/${tenantId}`, {
      method: "DELETE",
      body: { confirm_name: confirmName, confirm_phrase: confirmPhrase },
      auth: true,
    });
  },

  async switchTenant(tenantId: number) {
    const data = await request<{ tenant: Tenant }>(`/api/tenant/switch`, {
      method: "POST",
      body: { tenant_id: tenantId },
      auth: true,
    });
    this.setCurrentTenantId(tenantId);
    return data;
  },

  async listUsers() {
    return request<any[]>(`/api/users`, { method: "GET", auth: true });
  },

  // --- Dashboard ---
  async getDashboardStats(branch_id: string | number = "all") {
    const q = branch_id && branch_id !== "all"
      ? `?branch_id=${encodeURIComponent(String(branch_id))}`
      : "";
    return request(`/api/dashboard/stats${q}`, { method: "GET", auth: true });
  },

  // --- Branches ---
  async listBranches() {
    const res = await request<Branch[]>(`/api/branches`, {
      method: "GET",
      auth: true,
    });
    return Array.isArray(res) ? res : [];
  },

  // --- Appointments ---
  async listAppointments() {
    return request<Appointment[]>(`/api/appointments`, { method: "GET", auth: true });
  },

  async createAppointment(payload: unknown) {
    return request(`/api/appointments`, {
      method: "POST",
      body: payload,
      auth: true,
    });
  },

  async updateAppointment(appointmentId: number, payload: unknown) {
    return request(`/api/appointments/${appointmentId}`, {
      method: "PUT",
      body: payload,
      auth: true,
    });
  },

  async deleteAppointment(appointmentId: number | string) {
    return request(`/api/appointments/${appointmentId}`, {
      method: "DELETE",
      auth: true,
    });
  },

  // --- Leads ---
  async listLeads() {
    return request<Lead[]>(`/api/leads`, { method: "GET", auth: true });
  },

  async getLead(leadId: string | number) {
    return request<any>(`/api/leads/${encodeURIComponent(String(leadId))}`, { method: "GET", auth: true });
  },

  async createLead(payload: unknown) {
    return request(`/api/leads`, { method: "POST", body: payload, auth: true });
  },

  async deleteLead(leadId: string | number) {
    return request(`/api/leads/${encodeURIComponent(String(leadId))}`, {
      method: "DELETE",
      auth: true,
    });
  },

  async updateLeadStatus(leadId: string | number, status: string) {
    return request(`/api/leads/${encodeURIComponent(String(leadId))}/status`, {
      method: "PATCH",
      body: { status },
      auth: true,
    });
  },

  async updateLead(leadId: string | number, payload: unknown) {
    return request(`/api/leads/${encodeURIComponent(String(leadId))}`, {
      method: "PUT",
      body: payload,
      auth: true,
    });
  },

  // --- Sales ---
  async listSales(
    branch_id: string | number = "all",
    opts?: { include_cancelled?: boolean; only_cancelled?: boolean },
  ) {
    const params = new URLSearchParams();

    if (branch_id && branch_id !== "all")
      params.set("branch_id", String(branch_id));

    if (opts?.only_cancelled) {
      params.set("only_cancelled", "1");
    } else if (opts?.include_cancelled) {
      params.set("include_cancelled", "1");
    }

    const q = params.toString() ? `?${params.toString()}` : "";

    const res = await request<DailyLog[]>(`/api/sales${q}`, {
      method: "GET",
      auth: true,
    });

    return Array.isArray(res) ? res : [];
  },

  async createSale(payload: unknown) {
    return request(`/api/sales`, { method: "POST", body: payload, auth: true });
  },
  async cancelSale(saleId: string | number) {
    return request(`/api/sales/${encodeURIComponent(String(saleId))}/cancel`, {
      method: "POST",
      auth: true,
    });
  },
  async getSale(saleId: string | number) {
    return request<any>(`/api/sales/${encodeURIComponent(String(saleId))}`, {
      method: "GET",
      auth: true,
    });
  },
  async updateSale(saleId: string | number, payload: any) {
    return request<any>(`/api/sales/${encodeURIComponent(String(saleId))}`, {
      method: "PUT",
      body: payload,
      auth: true,
    });
  },

  async listPaymentMethods() {
    return request<{ id: number; name: string }[]>(`/api/payment-methods`, {
      method: "GET",
      auth: true,
    });
  },

  // --- Products / Inventory ---
  async createProduct(payload: {
    name: string;
    sku?: string | null;
    type?: 'product' | 'service';
    sales_price: number;
    cost_price: number;
    stock: number;
    min_stock: number;
    max_stock: number;
  }) {
    return request(`/api/products`, {
      method: "POST",
      body: payload,
      auth: true,
    });
  },

  async deleteProduct(productId: string | number) {
    return request(`/api/products/${encodeURIComponent(String(productId))}`, {
      method: "DELETE",
      auth: true,
    });
  },

  async listProducts() {
    const res = await request<Product[]>(`/api/products`, {
      method: "GET",
      auth: true,
    });
    return Array.isArray(res) ? res : [];
  },
  async updateProduct(
    productId: number,
    payload: Partial<{
      name: string;
      sku: string | null;
      type: 'product' | 'service';
      sales_price: number;
      cost_price: number;
      min_stock: number;
      max_stock: number | null;
    }>,
  ) {
    return request(`/api/products/${encodeURIComponent(String(productId))}`, {
      method: "PUT",
      body: payload,
      auth: true,
    });
  },

  async moveStock(payload: {
    product_id: number;
    type: "purchase" | "sale" | "sale_cancel";
    quantity: number;
    sales_price?: number;
    cost_price?: number;
  }) {
    return request(`/api/inventory/move-stock`, {
      method: "POST",
      body: payload,
      auth: true,
    });
  },

  // --- Generic helpers ---
  async get<T = unknown>(path: string, opts?: { auth?: boolean }) {
    return request<T>(normalizeApiPath(path), {
      method: "GET",
      auth: opts?.auth ?? true,
    });
  },

  async post<T = unknown>(path: string, body?: unknown, opts?: { auth?: boolean }) {
    return request<T>(normalizeApiPath(path), {
      method: "POST",
      body,
      auth: opts?.auth ?? true,
    });
  },

  async put<T = unknown>(path: string, body?: unknown, opts?: { auth?: boolean }) {
    return request<T>(normalizeApiPath(path), {
      method: "PUT",
      body,
      auth: opts?.auth ?? true,
    });
  },

  async delete<T = unknown>(path: string, opts?: { auth?: boolean }) {
    return request<T>(normalizeApiPath(path), {
      method: "DELETE",
      auth: opts?.auth ?? true,
    });
  },

  listLogs(params: { user_id?: number; event?: string; model_type?: string; tenant_id?: number; branch_id?: number; page?: number; search?: string } = {}) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) searchParams.append(key, value.toString());
    });
    return request<{ data: ActivityLog[]; current_page: number; last_page: number }>(`/api/logs?${searchParams.toString()}`, { auth: true });
  },

  async exportLogs(retentionDays: number = 30, deleteAfter: boolean = false) {
    const res = await fetch(`${API_URL}/api/logs/export?retention_days=${retentionDays}&delete_after_export=${deleteAfter}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        'X-Tenant-ID': localStorage.getItem('current_tenant_id') || '',
      }
    });
    if (!res.ok) throw new Error('Export failed');
    return res.blob();
  },

  // --- Tickets Module ---
  async listTickets(params: any = {}) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          value.forEach(v => searchParams.append(`${key}[]`, v));
        } else {
          searchParams.append(key, value.toString());
        }
      }
    });
    return request<{ data: any[]; last_page: number; total: number }>(`/api/tickets?${searchParams.toString()}`, { method: "GET", auth: true });
  },

  async getTicket(id: number) {
    return request<any>(`/api/tickets/${id}`, { method: "GET", auth: true });
  },

  async createTicket(payload: any) {
    return request<any>(`/api/tickets`, { method: "POST", body: payload, auth: true });
  },

  async updateTicket(id: number, payload: any) {
    return request<any>(`/api/tickets/${id}`, { method: "PUT", body: payload, auth: true });
  },

  async deleteTicket(id: number) {
    return request(`/api/tickets/${id}`, { method: "DELETE", auth: true });
  },

  async updateTicketStatus(id: number, status: string, cancel_reason?: string) {
    return request(`/api/tickets/${id}/status`, { method: "POST", body: { status, cancel_reason }, auth: true });
  },

  async assignTicket(id: number, responsable_id: number) {
    return request(`/api/tickets/${id}/assign`, { method: "POST", body: { responsable_id }, auth: true });
  },

  async addTicketComment(id: number, comment: string) {
    return request(`/api/tickets/${id}/comments`, { method: "POST", body: { comment }, auth: true });
  },

  // --- Ticket Categories & Priorities ---
  async listTicketCategories() {
    return request<any[]>(`/api/ticket-categories`, { method: "GET", auth: true });
  },

  async listTicketPriorities() {
    return request<any[]>(`/api/ticket-priorities`, { method: "GET", auth: true });
  },

  // --- Notifications ---
  async listNotifications() {
    return request<{ notifications: any[]; unread_count: number }>(`/api/notifications`, { method: "GET", auth: true });
  },

  async markNotificationAsRead(id: number) {
    return request(`/api/notifications/${id}/read`, { method: "POST", auth: true });
  },

  async markAllNotificationsAsRead() {
    return request(`/api/notifications/read-all`, { method: "POST", auth: true });
  },

  // --- Live Chat ---
  async listConversations(params: any = {}) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== "") {
        searchParams.append(key, String(value));
      }
    });
    return request<{ data: any[]; last_page: number; total: number }>(`/api/communications/conversations?${searchParams.toString()}`, { method: "GET", auth: true });
  },

  async getConversation(id: number) {
    return request<any>(`/api/communications/conversations/${id}`, { method: "GET", auth: true });
  },

  async createConversation(payload: { lead_id: number }) {
    return request<any>(`/api/communications/conversations`, { method: "POST", body: payload, auth: true });
  },

  async getConversationMessages(id: number, page: number = 1) {
    return request<any>(`/api/communications/conversations/${id}/messages?page=${page}`, { method: "GET", auth: true });
  },

  async sendConversationMessage(id: number, body: string) {
    return request<any>(`/api/communications/conversations/${id}/messages`, { method: "POST", body: { body }, auth: true });
  },

  async toggleConversationBot(id: number) {
    return request<any>(`/api/communications/conversations/${id}/toggle-bot`, { method: "POST", auth: true });
  },

  async toggleConversationImportant(id: number) {
    return request<any>(`/api/communications/conversations/${id}/toggle-important`, { method: "POST", auth: true });
  },

  async markConversationRead(id: number) {
    return request<any>(`/api/communications/conversations/${id}/mark-read`, { method: "POST", auth: true });
  },

  async updateConversationStatus(id: number, status: string) {
    return request<any>(`/api/communications/conversations/${id}/status`, { method: "PATCH", body: { status }, auth: true });
  },
};
