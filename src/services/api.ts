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
  console.error("VITE_API_URL is missing. Create frontend/.env with VITE_API_URL=http://127.0.0.1:8000 and restart npm run dev");
}

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

async function request<T>(
  path: string,
  options: { method?: HttpMethod; body?: any; auth?: boolean } = {}
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

  if (res.status === 401) localStorage.removeItem("auth_token");

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let data: any = {};
    try { data = text ? JSON.parse(text) : {}; } catch {}
    throw new Error(data?.message || `Request failed (${res.status})`);
  }

  // ✅ 204 = No Content (DELETE típico)
  if (res.status === 204) return null as unknown as T;

  // ✅ soporta body vacío aunque status sea 200/201
   const text = await res.text();
return (text ? JSON.parse(text) : (null as any)) as T;
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
  const res: any = await request(`/api/branches`, { method: "GET", auth: true });
  return Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : []);
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
async listSales(branch_id: string | number = "all") {
  const q = branch_id ? `?branch_id=${encodeURIComponent(String(branch_id))}` : "";
  const res: any = await request(`/api/sales${q}`, { method: "GET", auth: true });
  return Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : []);
},

async createSale(payload: any) {
  return request(`/api/sales`, { method: "POST", body: payload, auth: true });
},

  // --- Products / Inventory ---
async createProduct(payload: any) {
  return request(`/api/products`, { method: "POST", body: payload, auth: true });
},
async deleteProduct(productId: string | number) {
  return request(`/api/products/${encodeURIComponent(String(productId))}`, {
    method: "DELETE",
    auth: true,
  });
},

 async listProducts() {
  const res: any = await request(`/api/products`, { method: "GET", auth: true });
  return Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : []);
},

 async moveStock(payload: {
  product_id: number | string;
  type: "purchase" | "sale";
  quantity: number;
}) {
  return request(`/api/inventory/transaction`, {
    method: "POST",
    body: payload,
    auth: true,
  });
},

};
