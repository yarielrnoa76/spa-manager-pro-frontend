
import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { RefundLog, Branch } from '../types';
import { Undo2, AlertCircle } from 'lucide-react';

const Refunds: React.FC = () => {
  const [refunds, setRefunds] = useState<RefundLog[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const r = await api.get<RefundLog[]>('/refunds');
      const b = await api.listBranches();
      setRefunds(r);
      setBranches(b);
    };
    fetchData();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Refund Logs</h1>
          <p className="text-gray-500 text-sm">Track customer returns and credit adjustments.</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition shadow-md">
          <Undo2 size={18} />
          Process Refund
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase font-semibold">
            <tr>
              <th className="px-6 py-4">Date</th>
              <th className="px-6 py-4">Branch</th>
              <th className="px-6 py-4">Reason</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-sm">
            {refunds.map((refund) => (
              <tr key={refund.id}>
                <td className="px-6 py-4 whitespace-nowrap">{refund.date}</td>
                <td className="px-6 py-4">
                  <span className="px-2 py-1 bg-gray-100 rounded text-xs font-medium">
                    {branches.find(b => b.id === refund.branch_id)?.name}
                  </span>
                </td>
                <td className="px-6 py-4">{refund.reason}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${refund.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                    {refund.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-right font-bold text-red-600">-${refund.amount}</td>
              </tr>
            ))}
            {refunds.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                  <AlertCircle size={48} className="mx-auto mb-4 text-gray-200" />
                  No refunds recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Refunds;
