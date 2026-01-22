const API_URL = import.meta.env.VITE_API_URL;

export type LoginPayload = { email: string; password: string };

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

async function request<T>(
  path: string,
  options: { method?: HttpMethod; body?: any; auth?: boolean } = {}
): Promise<T> {
  const method = options.method ?? "GET";
  const auth = options.auth ?? true;

  const headers: Record<string, string> = {
    Accept: "application/json",
  };

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

  // Si token expiró / inválido
  if (res.status === 401) {
    localStorage.removeItem("auth_token");
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.message || `Request failed (${res.status})`);
  }

  return res.json();
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
    return request<any>(`/api/user`, { method: "GET", auth: true }).catch(() => null);
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
    const q = branch_id ? `?branch_id=${encodeURIComponent(String(branch_id))}` : "";
    return request(`/api/dashboard/stats${q}`, { method: "GET", auth: true });
  },

  // --- Branches ---
  async listBranches() {
    return request(`/api/branches`, { method: "GET", auth: true });
  },

  // --- Appointments ---
  async listAppointments() {
    return request(`/api/appointments`, { method: "GET", auth: true });
  },

  async createAppointment(payload: any) {
    return request(`/api/appointments`, { method: "POST", body: payload, auth: true });
  },

  // --- Leads ---
  async listLeads() {
    return request(`/api/leads`, { method: "GET", auth: true });
  },

  // --- Sales ---
  async listSales() {
    return request(`/api/sales`, { method: "GET", auth: true });
  },

  // --- Products / Inventory ---
  async listProducts() {
    return request(`/api/products`, { method: "GET", auth: true });
  },

  async moveStock(payload: any) {
    return request(`/api/inventory/transaction`, { method: "POST", body: payload, auth: true });
  },
};
