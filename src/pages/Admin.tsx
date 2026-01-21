
import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { User, Branch, Role } from '../types';
import { Users, Store, Shield, Edit2, Trash2, Plus } from 'lucide-react';

const Admin: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [activeTab, setActiveTab] = useState<'users' | 'branches'>('users');

  useEffect(() => {
    const fetchData = async () => {
      const u = await api.getUsers();
      const b = await api.getBranches();
      setUsers(u);
      setBranches(b);
    };
    fetchData();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Administration</h1>
          <p className="text-gray-500 text-sm">Manage users, branches, and system settings.</p>
        </div>
      </div>

      <div className="flex border-b border-gray-200">
        <button 
          onClick={() => setActiveTab('users')}
          className={`px-6 py-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'users' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Users & Roles
        </button>
        <button 
          onClick={() => setActiveTab('branches')}
          className={`px-6 py-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'branches' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Branches
        </button>
      </div>

      {activeTab === 'users' ? (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition">
              <Plus size={18} /> Add User
            </button>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase font-semibold">
                <tr>
                  <th className="px-6 py-4">User</th>
                  <th className="px-6 py-4">Role</th>
                  <th className="px-6 py-4">Default Branch</th>
                  <th className="px-6 py-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {users.map(u => (
                  <tr key={u.id}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-700">
                          {u.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-semibold">{u.name}</p>
                          <p className="text-xs text-gray-500">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                        u.role === Role.ADMIN ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {branches.find(b => b.id === u.branch_id)?.name}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-3">
                        <button className="text-gray-400 hover:text-indigo-600 transition"><Edit2 size={16} /></button>
                        <button className="text-gray-400 hover:text-red-600 transition"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition">
              <Plus size={18} /> Add Branch
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {branches.map(b => (
              <div key={b.id} className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg">
                    <Store size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">{b.name}</h3>
                    <p className="text-sm text-gray-500">{b.address}</p>
                    <code className="text-xs bg-gray-100 px-2 py-0.5 rounded mt-2 inline-block">Code: {b.code}</code>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <button className="p-2 text-gray-400 hover:text-indigo-600 transition"><Edit2 size={18} /></button>
                  <button className="p-2 text-gray-400 hover:text-red-600 transition"><Trash2 size={18} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Admin;
