
import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../services/api';
import { MonthlyExpense, Branch } from '../types';
import { ReceiptText, Plus, Filter, Building2, Wallet, PieChart, Trash2, Calendar } from 'lucide-react';
import StatCard from '../components/StatCard';

const CATEGORIES = ["Alquiler", "Servicios (Luz/Agua)", "Sueldos", "Insumos", "Marketing", "Mantenimiento", "Otros"];

const Expenses: React.FC = () => {
  const [expenses, setExpenses] = useState<MonthlyExpense[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Default to current month/year
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  const [selectedBranch, setSelectedBranch] = useState<string>("all");

  const [newExpense, setNewExpense] = useState({
    date: now.toISOString().split('T')[0],
    branch_id: "",
    category: CATEGORIES[0],
    type: "Fijo", // "Fijo" or "Variable"
    description: "",
    amount: ""
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const e = await api.get<MonthlyExpense[]>('/expenses');
      const b = await api.listBranches();
      setExpenses(Array.isArray(e) ? e : []);
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

  const years = useMemo(() => {
    const y = new Date().getFullYear();
    return [y - 1, y, y + 1];
  }, []);

  const months = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];

  const filteredExpenses = useMemo(() => {
    return expenses.filter(e => {
      const d = new Date(e.date + "T00:00:00");
      const mMatch = d.getMonth() + 1 === selectedMonth;
      const yMatch = d.getFullYear() === selectedYear;
      const bMatch = selectedBranch === "all" || String(e.branch_id) === selectedBranch;
      return mMatch && yMatch && bMatch;
    });
  }, [expenses, selectedMonth, selectedYear, selectedBranch]);

  const stats = useMemo(() => {
    const total = filteredExpenses.reduce((acc, e) => acc + Number(e.amount), 0);
    const fixed = filteredExpenses
      .filter(e => e.description.includes("[Fijo]"))
      .reduce((acc, e) => acc + Number(e.amount), 0);
    const variable = total - fixed;

    // Total for ALL branches in the same month
    const totalCompany = expenses
      .filter(e => {
        const d = new Date(e.date + "T00:00:00");
        return d.getMonth() + 1 === selectedMonth && d.getFullYear() === selectedYear;
      })
      .reduce((acc, e) => acc + Number(e.amount), 0);

    return { total, fixed, variable, totalCompany };
  }, [filteredExpenses, expenses, selectedMonth, selectedYear]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExpense.branch_id || !newExpense.amount) return;

    try {
      // Small hack: store type in description
      const payload = {
        date: newExpense.date,
        branch_id: Number(newExpense.branch_id),
        category: newExpense.category,
        description: `[${newExpense.type}] ${newExpense.description}`,
        amount: Number(newExpense.amount)
      };

      await api.post('/expenses', payload);
      setIsModalOpen(false);
      setNewExpense({
        date: now.toISOString().split('T')[0],
        branch_id: "",
        category: CATEGORIES[0],
        type: "Fijo",
        description: "",
        amount: ""
      });
      fetchData();
    } catch (err) {
      alert("Error al crear gasto");
    }
  };

  const handleDelete = async (id: string | number) => {
    if (!window.confirm("¿Seguro que deseas eliminar este gasto?")) return;
    try {
      await api.delete(`/expenses/${id}`);
      fetchData();
    } catch (err) {
      alert("Error al eliminar");
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Gestión de Gastos</h1>
          <p className="text-gray-500 text-sm">Control de costos fijos y variables del mes.</p>
        </div>
        <div className="flex items-center gap-2">
           <button 
             onClick={() => setIsModalOpen(true)}
             className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition shadow-lg shadow-indigo-100"
           >
            <Plus size={18} />
            Registrar Gasto
          </button>
        </div>
      </div>

      {/* FILTROS */}
      <div className="flex flex-wrap items-center gap-3 bg-white p-3 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex items-center gap-2 border-r pr-4 mr-2">
          <Filter size={16} className="text-gray-400" />
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Filtros</span>
        </div>
        
        <div className="flex items-center gap-2">
          <Building2 size={16} className="text-indigo-500" />
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
          <Calendar size={16} className="text-indigo-500" />
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title={`Total ${selectedBranch === 'all' ? 'Empresa' : 'Sucursal'}`} value={`$${stats.total.toLocaleString()}`} icon={Wallet} color="bg-indigo-600" />
        <StatCard title="Total Global (Mes)" value={`$${stats.totalCompany.toLocaleString()}`} icon={Building2} color="bg-purple-600" />
        <StatCard title="Gastos Fijos" value={`$${stats.fixed.toLocaleString()}`} icon={PieChart} color="bg-emerald-600" />
        <StatCard title="Gastos Variables" value={`$${stats.variable.toLocaleString()}`} icon={PieChart} color="bg-amber-500" />
      </div>

      {/* TABLA */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden min-h-[400px]">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50/50 text-[10px] text-gray-400 uppercase font-black border-b border-gray-100">
              <tr>
                <th className="px-6 py-4">Fecha</th>
                <th className="px-6 py-4">Sucursal</th>
                <th className="px-6 py-4">Tipo / Categoría</th>
                <th className="px-6 py-4">Descripción</th>
                <th className="px-6 py-4 text-right">Monto</th>
                <th className="px-6 py-4 text-center">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 text-sm">
              {filteredExpenses.map((expense) => {
                const isFixed = expense.description.includes("[Fijo]");
                const cleanDesc = expense.description.replace("[Fijo] ", "").replace("[Variable] ", "");
                return (
                  <tr key={expense.id} className="hover:bg-indigo-50/20 transition group">
                    <td className="px-6 py-5 whitespace-nowrap text-gray-400 font-medium">{expense.date}</td>
                    <td className="px-6 py-5 font-bold text-gray-700">
                      {branches.find(b => String(b.id) === String(expense.branch_id))?.name || "—"}
                    </td>
                    <td className="px-6 py-5 flex flex-col gap-1 items-start">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${isFixed ? 'bg-indigo-100 text-indigo-700' : 'bg-amber-100 text-amber-700'}`}>
                        {isFixed ? 'Fijo' : 'Variable'}
                      </span>
                      <span className="text-[10px] text-gray-400 uppercase font-bold tracking-tight">{expense.category}</span>
                    </td>
                    <td className="px-6 py-5 text-gray-600 max-w-xs truncate">{cleanDesc}</td>
                    <td className="px-6 py-5 text-right font-black text-gray-900 text-base">${expense.amount.toLocaleString()}</td>
                    <td className="px-6 py-5 text-center">
                      <button onClick={() => handleDelete(expense.id)} className="p-2 text-gray-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all duration-300">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filteredExpenses.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <ReceiptText size={48} className="text-gray-100" />
                      <p className="text-gray-400 text-sm font-medium italic">No hay gastos en {months[selectedMonth-1]} para {selectedBranch === 'all' ? 'estas sucursales' : 'esta sucursal'}.</p>
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
            <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 p-8 text-white relative">
              <div className="absolute top-0 right-0 p-8 opacity-10"><ReceiptText size={120} /></div>
              <h3 className="text-2xl font-black">Registrar Gasto</h3>
              <p className="text-indigo-100/80 text-xs mt-1 uppercase font-bold tracking-widest">Módulo de Salidas de Caja</p>
            </div>
            <form onSubmit={handleCreate} className="p-8 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Fecha</label>
                  <input type="date" required value={newExpense.date} onChange={e => setNewExpense({...newExpense, date: e.target.value})} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all" />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Sucursal</label>
                  <select required value={newExpense.branch_id} onChange={e => setNewExpense({...newExpense, branch_id: e.target.value})} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all">
                    <option value="">Seleccionar...</option>
                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Tipo de Gasto</label>
                  <div className="flex bg-gray-100 p-1.5 rounded-xl">
                    <button type="button" onClick={() => setNewExpense({...newExpense, type: 'Fijo'})} className={`flex-1 py-1.5 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all ${newExpense.type === 'Fijo' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-400'}`}>Fijo</button>
                    <button type="button" onClick={() => setNewExpense({...newExpense, type: 'Variable'})} className={`flex-1 py-1.5 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all ${newExpense.type === 'Variable' ? 'bg-white shadow-sm text-amber-600' : 'text-gray-400'}`}>Variable</button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Categoría</label>
                  <select required value={newExpense.category} onChange={e => setNewExpense({...newExpense, category: e.target.value})} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all">
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Descripción</label>
                <input type="text" required placeholder="E.j. Pago de internet fibra óptica..." value={newExpense.description} onChange={e => setNewExpense({...newExpense, description: e.target.value})} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all" />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Monto Total ($)</label>
                <div className="relative">
                   <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none font-black text-indigo-300 text-2xl">$</div>
                   <input type="number" required step="0.01" min="0" placeholder="0.00" value={newExpense.amount} onChange={e => setNewExpense({...newExpense, amount: e.target.value})} className="w-full pl-10 pr-4 py-4 bg-indigo-50/30 border-2 border-indigo-100 rounded-2xl text-2xl font-black text-indigo-700 focus:bg-white focus:border-indigo-500 outline-none transition-all placeholder:text-indigo-200" />
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 text-sm font-black text-gray-400 hover:bg-gray-100 hover:text-gray-600 rounded-2xl transition-all uppercase tracking-widest">Cerrar</button>
                <button type="submit" className="flex-[2] py-4 bg-indigo-600 text-white text-sm font-black rounded-2xl hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 uppercase tracking-widest">Guardar Registro</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Expenses;
