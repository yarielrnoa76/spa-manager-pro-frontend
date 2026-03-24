
import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../services/api';
import { RefundLog, Branch } from '../types';
import { 
  Undo2, 
  AlertCircle, 
  Plus, 
  Filter, 
  Building2, 
  Calendar, 
  Trash2, 
  CheckCircle2, 
  Clock, 
  XCircle,
  TrendingDown
} from 'lucide-react';
import StatCard from '../components/StatCard';

interface RefundsProps {
  user: any;
}

const Refunds: React.FC<RefundsProps> = ({ user }) => {
  const [refunds, setRefunds] = useState<RefundLog[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const isAdmin = user?.role?.name === "admin" || user?.is_super_admin;

  // Filters
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  const [selectedBranch, setSelectedBranch] = useState<string>("all");

  const [newRefund, setNewRefund] = useState({
    date: now.toISOString().split('T')[0],
    branch_id: "",
    quantity: "1",
    amount: "",
    reason: "",
    status: "pending"
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const r = await api.get<RefundLog[]>('/refunds');
      const b = await api.listBranches();
      setRefunds(Array.isArray(r) ? r : []);
      setBranches(Array.isArray(b) ? b : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const months = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];

  const years = useMemo(() => {
    const y = new Date().getFullYear();
    return [y - 1, y, y + 1];
  }, []);

  const filteredRefunds = useMemo(() => {
    return refunds.filter(r => {
      const d = new Date(r.date + "T00:00:00");
      const mMatch = d.getMonth() + 1 === selectedMonth;
      const yMatch = d.getFullYear() === selectedYear;
      const bMatch = selectedBranch === "all" || String(r.branch_id) === selectedBranch;
      return mMatch && yMatch && bMatch;
    });
  }, [refunds, selectedMonth, selectedYear, selectedBranch]);

  const stats = useMemo(() => {
    const total = filteredRefunds.reduce((acc, r) => acc + Number(r.amount), 0);
    const approved = filteredRefunds
      .filter(r => r.status === 'approved')
      .reduce((acc, r) => acc + Number(r.amount), 0);
    const pendingCount = filteredRefunds.filter(r => r.status === 'pending').length;
    
    const monthlyTotalAll = refunds
      .filter(r => {
        const d = new Date(r.date + "T00:00:00");
        return d.getMonth() + 1 === selectedMonth && d.getFullYear() === selectedYear;
      })
      .reduce((acc, r) => acc + Number(r.amount), 0);

    return { total, approved, pendingCount, monthlyTotalAll };
  }, [filteredRefunds, refunds, selectedMonth, selectedYear]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRefund.branch_id || !newRefund.amount) return;

    try {
      await api.post('/refunds', {
        ...newRefund,
        branch_id: Number(newRefund.branch_id),
        quantity: Number(newRefund.quantity),
        amount: Number(newRefund.amount)
      });
      setIsModalOpen(false);
      setNewRefund({
        date: now.toISOString().split('T')[0],
        branch_id: "",
        quantity: "1",
        amount: "",
        reason: "",
        status: "pending"
      });
      fetchData();
    } catch (err) {
      alert("Error al procesar la devolución");
    }
  };

  const handleDelete = async (id: string | number) => {
    if (!window.confirm("¿Seguro que deseas eliminar este registro de devolución?")) return;
    try {
      await api.delete(`/refunds/${id}`);
      fetchData();
    } catch (err) {
      alert("Error al eliminar");
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Gestión de Devoluciones</h1>
          <p className="text-gray-500 text-sm">Registro y seguimiento de reembolsos a clientes.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-6 py-2.5 bg-rose-600 text-white rounded-xl text-sm font-bold hover:bg-rose-700 transition shadow-lg shadow-rose-100"
        >
          <Undo2 size={18} />
          Procesar Devolución
        </button>
      </div>

      {/* FILTROS */}
      <div className="flex flex-wrap items-center gap-3 bg-white p-3 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex items-center gap-2 border-r pr-4 mr-2">
          <Filter size={16} className="text-gray-400" />
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Filtros</span>
        </div>
        
        <div className="flex items-center gap-2">
          <Building2 size={16} className="text-rose-500" />
          <select 
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            className="text-sm border-none focus:ring-0 font-bold text-gray-700 bg-transparent pr-8"
          >
            <option value="all">Todas las Sucursales</option>
            {branches.map(b => <option key={b.id} value={String(b.id)}>{b.name}</option>)}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-rose-500" />
          <select 
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="text-sm border-none focus:ring-0 font-bold text-gray-700 bg-transparent pr-8"
          >
            {months.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <select 
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="text-sm border-none focus:ring-0 font-bold text-gray-700 bg-transparent"
          >
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* RESUMEN */}
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Devoluciones" value={`$${stats.total.toLocaleString()}`} icon={TrendingDown} color="bg-rose-600" />
        <StatCard title="Total Global (Mes)" value={`$${stats.monthlyTotalAll.toLocaleString()}`} icon={Building2} color="bg-gray-800" />
        <StatCard title="Monto Aprobado" value={`$${stats.approved.toLocaleString()}`} icon={CheckCircle2} color="bg-emerald-600" />
        <StatCard title="Pendientes" value={String(stats.pendingCount)} icon={Clock} color="bg-amber-500" />
      </div>

      {/* TABLA */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden min-h-[400px]">
        <div className="overflow-x-auto">
          <table className="w-full text-left font-sans">
            <thead className="bg-gray-50/50 text-[10px] text-gray-400 uppercase font-black border-b border-gray-100">
              <tr>
                <th className="px-6 py-4">Fecha</th>
                <th className="px-6 py-4">Sucursal</th>
                <th className="px-6 py-4">Motivo / Estado</th>
                <th className="px-6 py-4 text-center">Cant.</th>
                <th className="px-6 py-4 text-right">Monto</th>
                <th className="px-6 py-4 text-center">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 text-sm">
              {filteredRefunds.map((r) => (
                <tr key={r.id} className="hover:bg-rose-50/10 transition group">
                  <td className="px-6 py-5 whitespace-nowrap text-gray-400 font-medium">{r.date}</td>
                  <td className="px-6 py-5 font-bold text-gray-700">
                    {branches.find(b => String(b.id) === String(r.branch_id))?.name || "—"}
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex flex-col gap-1">
                      <span className="text-gray-600 font-medium">{r.reason}</span>
                      <div className="flex items-center gap-1.5">
                        {r.status === 'approved' && <CheckCircle2 size={12} className="text-emerald-500" />}
                        {r.status === 'pending' && <Clock size={12} className="text-amber-500" />}
                        {r.status === 'rejected' && <XCircle size={12} className="text-rose-500" />}
                        <span className={`text-[9px] font-black uppercase tracking-wider ${
                          r.status === 'approved' ? 'text-emerald-600' : 
                          r.status === 'pending' ? 'text-amber-600' : 'text-rose-600'
                        }`}>
                          {r.status === 'approved' ? 'Aprobado' : r.status === 'pending' ? 'Pendiente' : 'Rechazado'}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-center font-bold text-gray-400">{r.quantity || 1}</td>
                  <td className="px-6 py-5 text-right font-black text-rose-600 text-base">-${Number(r.amount).toLocaleString()}</td>
                  <td className="px-6 py-5 text-center">
                    {isAdmin && (
                      <button onClick={() => handleDelete(r.id)} className="p-2 text-gray-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all duration-300">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filteredRefunds.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <Undo2 size={48} className="text-gray-100" />
                      <p className="text-gray-400 text-sm font-medium italic">No hay devoluciones registradas en este periodo.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL DE REGISTRO */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-300">
            <div className="bg-gradient-to-r from-rose-600 to-rose-700 p-8 text-white relative">
              <div className="absolute top-0 right-0 p-8 opacity-10"><Undo2 size={120} /></div>
              <h3 className="text-2xl font-black">Procesar Devolución</h3>
              <p className="text-rose-100/80 text-xs mt-1 uppercase font-bold tracking-widest">Ajuste de Saldo / Reembolso</p>
            </div>
            <form onSubmit={handleCreate} className="p-8 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Fecha</label>
                  <input type="date" required value={newRefund.date} onChange={e => setNewRefund({...newRefund, date: e.target.value})} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold focus:ring-2 focus:ring-rose-500 focus:border-transparent transition-all" />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Sucursal</label>
                  <select required value={newRefund.branch_id} onChange={e => setNewRefund({...newRefund, branch_id: e.target.value})} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold focus:ring-2 focus:ring-rose-500 focus:border-transparent transition-all">
                    <option value="">Seleccionar...</option>
                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-1.5">
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Estado</label>
                  <select value={newRefund.status} onChange={e => setNewRefund({...newRefund, status: e.target.value})} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold focus:ring-2 focus:ring-rose-500 focus:border-transparent transition-all">
                    <option value="pending">Pendiente</option>
                    <option value="approved">Aprobado</option>
                    <option value="rejected">Rechazado</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Cantidad</label>
                  <input type="number" required min="1" value={newRefund.quantity} onChange={e => setNewRefund({...newRefund, quantity: e.target.value})} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold focus:ring-2 focus:ring-rose-500 focus:border-transparent transition-all" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Motivo de la Devolución</label>
                <textarea required placeholder="E.j. Cliente insatisfecho con el servicio..." value={newRefund.reason} onChange={e => setNewRefund({...newRefund, reason: e.target.value})} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold focus:ring-2 focus:ring-rose-500 focus:border-transparent transition-all h-20 resize-none" />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Monto a Devolver ($)</label>
                <div className="relative">
                   <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none font-black text-rose-300 text-2xl">$</div>
                   <input type="number" required step="0.01" min="0" placeholder="0.00" value={newRefund.amount} onChange={e => setNewRefund({...newRefund, amount: e.target.value})} className="w-full pl-10 pr-4 py-4 bg-rose-50/30 border-2 border-rose-100 rounded-2xl text-2xl font-black text-rose-700 focus:bg-white focus:border-rose-500 outline-none transition-all placeholder:text-rose-200" />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-6 py-3 bg-gray-100 text-gray-500 rounded-xl text-sm font-bold hover:bg-gray-200 transition">Cancelar</button>
                <button type="submit" className="flex-1 px-6 py-3 bg-rose-600 text-white rounded-xl text-sm font-black hover:bg-rose-700 transition shadow-lg shadow-rose-100">Confirmar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Refunds;
