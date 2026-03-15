
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
  n8n_api_key?: string | null;
  chatwoot_base_url?: string | null;
  chatwoot_api_token?: string | null;
  chatwoot_account_id?: string | null;
  chatwoot_inbox_id?: string | null;
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
  type?: 'product' | 'service';
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
  status: 'incoming' | 'contact_1' | 'contact_2' | 'contact_3' | 'interested' | 'recovered' | 'appointment_scheduled' | 'cold_lead';
  created_at: string;
  tenant_id?: number;
  assigned_to?: string;
  assignedTo?: User;
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
  sender?: User;
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
  lead?: Lead;
  assignedUser?: User;
  branch?: Branch;
}
