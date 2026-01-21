
import { MOCK_SALES, MOCK_BRANCHES, MOCK_USERS, MOCK_LEADS, MOCK_REFUNDS, MOCK_EXPENSES, MOCK_APPOINTMENTS } from './mockData';
import { DailyLog, Lead, Branch, User, Role, Product, InventoryTransaction, RefundLog, MonthlyExpense, Appointment } from '../types';

class ApiService {
  private sales = [...MOCK_SALES];
  private leads = [...MOCK_LEADS];
  private branches = [...MOCK_BRANCHES];
  private users = [...MOCK_USERS];
  private refunds = [...MOCK_REFUNDS];
  private expenses = [...MOCK_EXPENSES];
  private appointments = [...MOCK_APPOINTMENTS];
  
  private products: Product[] = [
    { id: '1', name: 'Lavender Oil', sku: 'LAV-001', price: 25.0, stock: 45, min_stock: 10, is_low_stock: false },
    { id: '2', name: 'Facial Mask', sku: 'MSK-099', price: 15.0, stock: 3, min_stock: 5, is_low_stock: true },
    { id: '3', name: 'Deep Tissue Massage', sku: 'SRV-001', price: 85.0, stock: 999, min_stock: 0, is_low_stock: false }, // Servicios representados como productos de stock infinito
  ];
  private transactions: InventoryTransaction[] = [];

  getCurrentUser() { return this.users[0]; }

  async getDashboardStats(branchId?: string) {
    const totalSales = this.sales.reduce((acc, s) => acc + s.amount, 0);
    return {
      totalSales,
      profit: totalSales * 0.7,
      recentLeads: this.leads.slice(0, 5),
      salesCount: this.sales.length,
      lowStockCount: this.products.filter(p => p.is_low_stock).length
    };
  }

  async getProducts() { return this.products; }
  
  async createProduct(p: Partial<Product>) {
    const newP = { ...p, id: Math.random().toString(), stock: 0, is_low_stock: true } as Product;
    this.products.push(newP);
    return newP;
  }

  async moveStock(productId: string, type: 'purchase' | 'sale', quantity: number) {
    const product = this.products.find(p => p.id === productId);
    if (!product) throw new Error("Product not found");

    const before = product.stock;
    if (type === 'sale' && product.stock < quantity) throw new Error("Insufficient stock");

    product.stock = type === 'purchase' ? product.stock + quantity : product.stock - quantity;
    product.is_low_stock = product.stock <= product.min_stock;

    const t: InventoryTransaction = {
      id: Math.random().toString(),
      product_id: productId,
      type,
      quantity,
      stock_before: before,
      stock_after: product.stock,
      created_at: new Date().toISOString()
    };
    this.transactions.unshift(t);
    return t;
  }

  async getSales(branchId?: string) { return this.sales; }
  async getLeads() { return this.leads; }
  async getBranches() { return this.branches; }
  async getUsers() { return this.users; }
  async getRefunds() { return this.refunds; }
  async getExpenses() { return this.expenses; }
  async getAppointments() { return this.appointments; }

  async createSale(s: any) { 
    if (s.product_id) {
      await this.moveStock(s.product_id, 'sale', 1);
    }
    this.sales.unshift(s); 
    return s; 
  }

  async createLead(leadData: Partial<Lead>) {
    const newLead: Lead = {
      id: `l${Math.random()}`,
      status: 'new',
      created_at: new Date().toISOString(),
      ...leadData
    } as Lead;
    this.leads.unshift(newLead);
    return newLead;
  }

  async updateLeadStatus(leadId: string, status: Lead['status']) {
    const lead = this.leads.find(l => l.id === leadId);
    if (lead) {
      lead.status = status;
      return { ...lead };
    }
    throw new Error("Lead not found");
  }
}

export const api = new ApiService();
