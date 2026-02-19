
export enum Role {
  SELLER = 'seller',
  MANAGER = 'manager',
  ADMIN = 'admin'
}

export interface Branch {
  id: string;
  name: string;
  code: string;
  address: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  branch_id: string;
  permissions: string[];
}

export interface Product {
  id: number;
  name: string;
  sku?: string | null;
  description?: string | null;

  sales_price: number; // nuevo
  cost_price: number;  // nuevo

  stock: number;
  min_stock: number;
  max_stock?: number | null;
  is_low_stock: boolean;
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
  product_id?: string; // Vinculación opcional con inventario
  client_name: string;
  service_rendered: string;
  amount: number;
  payment_method: string;
  notes?: string;
  created_at: string;
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
  date: string;
  time: string;
  status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled';
  service_type: string;
  notes?: string;
}
