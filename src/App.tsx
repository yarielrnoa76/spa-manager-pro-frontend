
import React, { useState } from 'react';
import { Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  DollarSign, 
  Undo2, 
  ReceiptText, 
  UserPlus, 
  Calendar, 
  Settings, 
  LogOut, 
  Menu, 
  Store,
  Package
} from 'lucide-react';
import { api } from './services/api';
import { User, Role } from './types';

import Dashboard from './pages/Dashboard';
import Sales from './pages/Sales';
import Leads from './pages/Leads';
import Appointments from './pages/Appointments';
import Stocks from './pages/Stocks';

const SidebarItem = ({ to, icon: Icon, label, active, onClick }: any) => (
  <Link
    to={to}
    onClick={onClick}
    className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
      active ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-indigo-50 hover:text-indigo-600'
    }`}
  >
    <Icon size={20} />
    <span className="font-medium">{label}</span>
  </Link>
);

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(api.getCurrentUser());
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  if (!user) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md text-center">
        <h1 className="text-2xl font-bold mb-6">SPA Manager Pro</h1>
        <button onClick={() => setUser(api.getCurrentUser())} className="w-full bg-indigo-600 text-white py-3 rounded-lg font-bold">Demo Login</button>
      </div>
    </div>
  );

  const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/sales', icon: DollarSign, label: 'Ventas Diarias' },
    { to: '/stocks', icon: Package, label: 'Inventario / Stocks' },
    { to: '/leads', icon: UserPlus, label: 'Leads' },
    { to: '/appointments', icon: Calendar, label: 'Citas' },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <aside className={`fixed inset-y-0 left-0 w-64 bg-white border-r transform transition-transform lg:relative lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} z-30`}>
        <div className="h-full flex flex-col p-4">
          <h1 className="text-xl font-bold text-indigo-600 mb-8 px-4 flex items-center gap-2"><Store /> SPA Pro</h1>
          <nav className="flex-1 space-y-1">
            {navItems.map(item => <SidebarItem key={item.to} {...item} active={isActive(item.to)} onClick={() => setSidebarOpen(false)} />)}
          </nav>
          <button onClick={() => setUser(null)} className="flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 rounded-lg"><LogOut size={20}/> Logout</button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-16 bg-white border-b flex items-center justify-between px-6">
          <button className="lg:hidden" onClick={() => setSidebarOpen(true)}><Menu/></button>
          <div className="font-bold text-gray-800">Branch: Hialeah</div>
        </header>
        <div className="flex-1 overflow-y-auto p-6">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/sales" element={<Sales />} />
            <Route path="/stocks" element={<Stocks />} />
            <Route path="/leads" element={<Leads />} />
            <Route path="/appointments" element={<Appointments />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </div>
      </main>
    </div>
  );
};

export default App;
