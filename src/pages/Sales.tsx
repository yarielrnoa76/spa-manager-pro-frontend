
import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { DailyLog, Branch, Product } from '../types';
import { Plus, Download, Search, Filter, X, Package } from 'lucide-react';
import { EXCEL_FIELDS } from '../config/excelFields';

const Sales: React.FC = () => {
  const [sales, setSales] = useState<DailyLog[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('all');
  
  // Form State
  const [newSale, setNewSale] = useState({
    date: new Date().toISOString().split('T')[0],
    branch_id: '',
    product_id: '',
    client_name: '',
    service_rendered: '',
    amount: '',
    payment_method: 'Credit Card'
  });

  useEffect(() => {
    fetchData();
  }, [selectedBranch]);

  const fetchData = async () => {
    const s = await api.getSales(selectedBranch);
    const b = await api.getBranches();
    const p = await api.getProducts();
    setSales(s);
    setBranches(b);
    setProducts(p);
  };

  const handleCreateSale = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createSale({
        ...newSale,
        amount: parseFloat(newSale.amount),
        seller_id: 'u1' // Mocking current user
      });
      setIsModalOpen(false);
      // Reset form
      setNewSale({
        date: new Date().toISOString().split('T')[0],
        branch_id: '',
        product_id: '',
        client_name: '',
        service_rendered: '',
        amount: '',
        payment_method: 'Credit Card'
      });
      fetchData();
    } catch (err: any) {
      alert(err.message || "Error al crear la venta");
    }
  };

  const handleProductSelect = (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (product) {
      setNewSale({
        ...newSale,
        product_id: product.id,
        service_rendered: product.name,
        amount: product.price.toString()
      });
    }
  };

  const exportToCSV = () => {
    const headers = Object.values(EXCEL_FIELDS.DAILY_LOG).join(',');
    const rows = sales.map(s => [
      s.date,
      s.seller_id,
      branches.find(b => b.id === s.branch_id)?.name || s.branch_id,
      s.client_name,
      s.service_rendered,
      s.amount,
      s.payment_method,
      s.notes || ''
    ].join(','));
    
    const csvContent = "data:text/csv;charset=utf-8," + headers + "\n" + rows.join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `sales_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredSales = sales.filter(s => 
    s.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.service_rendered.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Solo productos con stock > 0
  const availableProducts = products.filter(p => p.stock > 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Registro de Ventas Diarias</h1>
          <p className="text-gray-500 text-sm">Registro detallado de transacciones diarias vinculadas a inventario.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button onClick={exportToCSV} className="flex items-center gap-2 px-4 py-2 border rounded-lg bg-white text-sm font-medium hover:bg-gray-50">
            <Download size={18} /> Exportar Excel
          </button>
          <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold shadow-md hover:bg-indigo-700">
            <Plus size={18} /> Nueva Venta
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text"
              placeholder="Buscar cliente o servicio..."
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border rounded-lg text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select 
            className="bg-gray-50 border rounded-lg text-sm py-2 px-3 focus:outline-none"
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
          >
            <option value="all">Todas las Sucursales</option>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase font-semibold">
              <tr>
                <th className="px-6 py-4">Fecha</th>
                <th className="px-6 py-4">Sucursal</th>
                <th className="px-6 py-4">Cliente</th>
                <th className="px-6 py-4">Servicio/Producto</th>
                <th className="px-6 py-4 text-right">Monto</th>
                <th className="px-6 py-4">Método</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {filteredSales.map((sale) => (
                <tr key={sale.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">{sale.date}</td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded text-[10px] font-bold">
                      {branches.find(b => b.id === sale.branch_id)?.name}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-medium">{sale.client_name}</td>
                  <td className="px-6 py-4 flex items-center gap-2">
                    {sale.product_id && <Package size={14} className="text-gray-400" />}
                    {sale.service_rendered}
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-gray-900">${sale.amount}</td>
                  <td className="px-6 py-4">{sale.payment_method}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Crear Venta */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b flex justify-between items-center">
              <h3 className="font-bold text-lg">Nueva Venta</h3>
              <button onClick={() => setIsModalOpen(false)}><X size={20}/></button>
            </div>
            <form onSubmit={handleCreateSale} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Sucursal</label>
                  <select 
                    required
                    className="w-full border rounded-lg p-2 text-sm"
                    value={newSale.branch_id}
                    onChange={(e) => setNewSale({...newSale, branch_id: e.target.value})}
                  >
                    <option value="">Seleccionar...</option>
                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Fecha</label>
                  <input 
                    type="date"
                    required
                    className="w-full border rounded-lg p-2 text-sm"
                    value={newSale.date}
                    onChange={(e) => setNewSale({...newSale, date: e.target.value})}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Producto / Servicio (Inventario)</label>
                <div className="relative">
                  <select 
                    required
                    className="w-full border rounded-lg p-2 text-sm appearance-none bg-white"
                    value={newSale.product_id}
                    onChange={(e) => handleProductSelect(e.target.value)}
                  >
                    <option value="">-- Seleccionar de Inventario --</option>
                    {availableProducts.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} (Stock: {p.stock}) - ${p.price}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                    <Package size={16} />
                  </div>
                </div>
                {availableProducts.length === 0 && (
                  <p className="text-[10px] text-red-500 mt-1 font-bold">No hay productos con stock disponible.</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nombre del Cliente</label>
                <input 
                  type="text"
                  required
                  placeholder="Ej. Juan Pérez"
                  className="w-full border rounded-lg p-2 text-sm"
                  value={newSale.client_name}
                  onChange={(e) => setNewSale({...newSale, client_name: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Monto ($)</label>
                  <input 
                    type="number"
                    required
                    className="w-full border rounded-lg p-2 text-sm font-bold bg-gray-50"
                    value={newSale.amount}
                    readOnly
                  />
                  <p className="text-[9px] text-gray-400 mt-1">* Precio fijado por inventario</p>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Método de Pago</label>
                  <select 
                    className="w-full border rounded-lg p-2 text-sm"
                    value={newSale.payment_method}
                    onChange={(e) => setNewSale({...newSale, payment_method: e.target.value})}
                  >
                    <option>Credit Card</option>
                    <option>Cash</option>
                    <option>Zelle</option>
                    <option>Transfer</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-2 border rounded-lg text-sm font-bold hover:bg-gray-50">Cancelar</button>
                <button 
                  type="submit" 
                  disabled={!newSale.product_id}
                  className={`flex-1 py-2 rounded-lg text-sm font-bold shadow-lg transition ${
                    newSale.product_id ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  Confirmar Venta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sales;
