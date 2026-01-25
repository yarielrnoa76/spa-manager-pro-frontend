const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
console.log("API_URL =", API_URL);

export type LoginPayload = { email: string; password: string };

export type DashboardStats = {
  totalSales: number;
  profit: number;
  recentLeads: Array<any>;
  salesCount: number;
  lowStockCount: number;
};

if (!API_URL) {
  // eslint-disable-next-line no-console
  console.error(
    "VITE_API_URL is missing. Create frontend/.env with VITE_API_URL=http://127.0.0.1:8000 and restart npm run dev",
  );
}

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

//  Error enriquecido (sin romper: sigue siendo Error)
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
  data?: any;

  constructor(
    message: string,
    opts?: {
      code?: string;
      status?: number;
      errors?: Record<string, string[]>;
      data?: any;
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

function safeJsonParse(text: string): any {
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}

async function request<T>(
  path: string,
  options: { method?: HttpMethod; body?: any; auth?: boolean } = {},
): Promise<T> {
  const method = options.method ?? "GET";
  const auth = options.auth ?? true;

  const headers: Record<string, string> = { Accept: "application/json" };
  if (method !== "GET") headers["Content-Type"] = "application/json";

  if (auth) {
    const token = localStorage.getItem("auth_token");
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  // ✅ 204 = No Content (DELETE típico)
  if (res.status === 204) return null as unknown as T;

  // ✅ Lee body UNA sola vez
  const rawText = await res.text().catch(() => "");
  const data: ApiErrorPayload | any = safeJsonParse(rawText);

  if (res.status === 401) localStorage.removeItem("auth_token");

  if (!res.ok) {
    // ✅ Caso 503 DB down (tu backend ya responde code)
    if (res.status === 503 && data?.code === "DB_CONNECTION_ERROR") {
      throw new ApiError("Connection to DB Server Error", {
        code: "DB_CONNECTION_ERROR",
        status: 503,
        data,
      });
    }

    // ✅ Caso 422 Validation (si quieres usarlo en UI)
    if (res.status === 422) {
      throw new ApiError(data?.message || "Validation failed.", {
        code: data?.code || "VALIDATION_ERROR",
        status: 422,
        errors: data?.errors || {},
        data,
      });
    }

    // ✅ Fallback: comportamiento anterior (pero mejorado)
    throw new ApiError(data?.message || `Request failed (${res.status})`, {
      code: data?.code,
      status: res.status,
      data,
    });
  }

  // ✅ soporta body vacío aunque status sea 200/201
  return (rawText ? (data as T) : (null as any)) as T;
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

  // --- Auth ---
  async login(payload: LoginPayload) {
    const data = await request<{ token: string; user: any }>(`/api/login`, {
      method: "POST",
      body: payload,
      auth: false,
    });
    if (data?.token) this.setToken(data.token);
    return data;
  },

  async me() {
    return request<any>(`/api/user`, { method: "GET", auth: true }).catch(
      () => null,
    );
  },

  async logout() {
    try {
      await request(`/api/logout`, { method: "POST", auth: true });
    } finally {
      this.clearToken();
    }
  },

  // --- Dashboard ---
  async getDashboardStats(branch_id: string | number = "all") {
    const q = branch_id
      ? `?branch_id=${encodeURIComponent(String(branch_id))}`
      : "";
    return request(`/api/dashboard/stats${q}`, { method: "GET", auth: true });
  },

  // --- Branches ---
  async listBranches() {
    const res: any = await request(`/api/branches`, {
      method: "GET",
      auth: true,
    });
    return Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
  },

  // --- Appointments ---
  async listAppointments() {
    return request(`/api/appointments`, { method: "GET", auth: true });
  },

  async createAppointment(payload: any) {
    return request(`/api/appointments`, {
      method: "POST",
      body: payload,
      auth: true,
    });
  },

  // --- Leads ---
  async listLeads() {
    return request(`/api/leads`, { method: "GET", auth: true });
  },

  async createLead(payload: any) {
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

    const res: any = await request(`/api/sales${q}`, {
      method: "GET",
      auth: true,
    });

    return Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
  },

  async createSale(payload: any) {
    return request(`/api/sales`, { method: "POST", body: payload, auth: true });
  },
  async cancelSale(saleId: string | number) {
    return request(`/api/sales/${encodeURIComponent(String(saleId))}/cancel`, {
      method: "POST",
      auth: true,
    });
  },

  // --- Products / Inventory ---
  async createProduct(payload: {
    name: string;
    sku?: string | null;
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
    const res: any = await request(`/api/products`, {
      method: "GET",
      auth: true,
    });
    return Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
  },
  async updateProduct(
    productId: number,
    payload: Partial<{
      name: string;
      sku: string | null;
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
};
