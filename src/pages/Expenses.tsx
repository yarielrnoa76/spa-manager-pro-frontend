
import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { MonthlyExpense, Branch } from '../types';
import { ReceiptText, Plus } from 'lucide-react';

const Expenses: React.FC = () => {
  const [expenses, setExpenses] = useState<MonthlyExpense[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const e = await api.get<MonthlyExpense[]>('/expenses');
      const b = await api.listBranches();
      setExpenses(e);
      setBranches(b);
    };
    fetchData();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Monthly Expenses</h1>
          <p className="text-gray-500 text-sm">Track operating costs for each branch.</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition shadow-md">
          <Plus size={18} />
          Add Expense
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase font-semibold">
            <tr>
              <th className="px-6 py-4">Date</th>
              <th className="px-6 py-4">Branch</th>
              <th className="px-6 py-4">Category</th>
              <th className="px-6 py-4">Description</th>
              <th className="px-6 py-4 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-sm">
            {expenses.map((expense) => (
              <tr key={expense.id}>
                <td className="px-6 py-4 whitespace-nowrap">{expense.date}</td>
                <td className="px-6 py-4">
                  <span className="px-2 py-1 bg-gray-100 rounded text-xs font-medium">
                    {branches.find(b => b.id === expense.branch_id)?.name}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className="px-2 py-1 border border-gray-200 rounded text-[10px] font-bold uppercase text-gray-500">
                    {expense.category}
                  </span>
                </td>
                <td className="px-6 py-4">{expense.description}</td>
                <td className="px-6 py-4 text-right font-bold text-gray-900">${expense.amount.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Expenses;
