
import { Role, Branch, User, DailyLog, RefundLog, MonthlyExpense, Lead, Appointment } from '../types';

export const MOCK_BRANCHES: Branch[] = [
  { id: '1', name: 'Hialeah', code: 'HIA', address: '123 Hialeah Dr' },
  { id: '2', name: 'Flagler', code: 'FLA', address: '456 Flagler St' },
];

export const MOCK_USERS: User[] = [
  { id: 'u1', name: 'Admin User', email: 'admin@spa.com', role: Role.ADMIN, branch_id: '1', permissions: ['*'] },
  { id: 'u2', name: 'Manager Maria', email: 'manager@spa.com', role: Role.MANAGER, branch_id: '1', permissions: ['sales.view.all', 'reports.view'] },
  { id: 'u3', name: 'Seller Sarah', email: 'sarah@spa.com', role: Role.SELLER, branch_id: '2', permissions: ['sales.create', 'sales.view.branch'] },
];

export const MOCK_SALES: DailyLog[] = Array.from({ length: 50 }, (_, i) => ({
  id: `s${i}`,
  date: new Date(Date.now() - Math.floor(Math.random() * 30) * 86400000).toISOString().split('T')[0],
  seller_id: 'u3',
  branch_id: i % 2 === 0 ? '1' : '2',
  client_name: `Client ${i}`,
  service_rendered: i % 3 === 0 ? 'Facial' : i % 3 === 1 ? 'Massage' : 'Manicure',
  amount: Math.floor(Math.random() * 200) + 50,
  payment_method: i % 2 === 0 ? 'Credit Card' : 'Cash',
  created_at: new Date().toISOString(),
}));

export const MOCK_REFUNDS: RefundLog[] = [
  { id: 'r1', date: '2024-05-10', branch_id: '1', amount: 45, reason: 'Client dissatisfied', status: 'approved' },
];

export const MOCK_EXPENSES: MonthlyExpense[] = [
  { id: 'e1', date: '2024-05-01', branch_id: '1', category: 'Rent', description: 'Monthly rent', amount: 2000 },
  { id: 'e2', date: '2024-05-05', branch_id: '2', category: 'Supplies', description: 'Oils and towels', amount: 350 },
];

export const MOCK_LEADS: Lead[] = [
  { id: 'l1', name: 'Juan Perez', phone: '305-123-4567', branch_id: '1', source: 'whatsapp', message: 'Hi, I want a massage', status: 'new', created_at: new Date().toISOString() },
  { id: 'l2', name: 'Ana Gomez', phone: '786-987-6543', branch_id: '2', source: 'web', message: 'Facial booking', status: 'contacted', created_at: new Date().toISOString() },
  { id: 'l3', name: 'Carlos Rivas', phone: '305-555-1234', branch_id: '1', source: 'call', message: 'Called for prices', status: 'new', created_at: new Date().toISOString() },
  { id: 'l4', name: 'Maria Rodriguez', phone: '786-111-2222', branch_id: '2', source: 'whatsapp', message: 'Asking about laser', status: 'sold', created_at: new Date().toISOString() },
  { id: 'l5', name: 'Pedro Martinez', phone: '305-444-5555', branch_id: '1', source: 'web', message: 'No longer interested', status: 'discarded', created_at: new Date().toISOString() },
];

export const MOCK_APPOINTMENTS: Appointment[] = [
  { id: 'a1', branch_id: '1', client_name: 'Juan Perez', date: '2024-05-20', time: '10:00 AM', status: 'scheduled', service_type: 'Full Body Massage' },
  { id: 'a2', branch_id: '2', client_name: 'Ana Gomez', date: '2024-05-21', time: '02:30 PM', status: 'completed', service_type: 'Hydro Facial' },
];
