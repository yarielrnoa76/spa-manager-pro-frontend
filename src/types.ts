
export enum Role {
  SELLER = 'seller',
  MANAGER = 'manager',
  ADMIN = 'admin',
  SUPERADMIN = 'superadmin'
}

export interface Tenant {
  id: number;
  name: string;
  slug: string;
  status: 'active' | 'suspended';
  created_at?: string;
  updated_at?: string;
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
  is_low_stock: boolean;
  tenant_id?: number;
  transactions?: InventoryTransaction[];
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
  client_name: string;
  service_rendered: string;
  amount: number;
  payment_method: string;
  notes?: string;
  created_at: string;
  tenant_id?: number;
}

export interface Lead {
  id: string;
  name: string;
  phone: string;
  email?: string;
  branch_id: string;
  source: 'whatsapp' | 'call' | 'web' | 'other';
  message: string;
  status: 'new' | 'contacted' | 'sold' | 'discarded';
  created_at: string;
  tenant_id?: number;
}

export interface RefundLog {
  id: string;
  date: string;
  branch_id: string;
  amount: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
}

export interface MonthlyExpense {
  id: string;
  date: string;
  branch_id: string;
  category: string;
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
