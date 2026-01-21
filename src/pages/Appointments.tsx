
import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Appointment, Branch } from '../types';
import { Calendar as CalendarIcon, Clock, ChevronLeft, ChevronRight, Plus } from 'lucide-react';

const Appointments: React.FC = () => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const a = await api.getAppointments();
      const b = await api.getBranches();
      setAppointments(a);
      setBranches(b);
    };
    fetchData();
  }, []);

  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const today = new Date();
  
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Appointment Schedule</h1>
          <p className="text-gray-500 text-sm">Manage client sessions and treatment calendar.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-white border border-gray-200 rounded-lg shadow-sm">
            <button className="p-2 hover:bg-gray-50 transition"><ChevronLeft size={18} /></button>
            <span className="px-4 text-sm font-bold border-x border-gray-200 py-2">May 2024</span>
            <button className="p-2 hover:bg-gray-50 transition"><ChevronRight size={18} /></button>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition shadow-md">
            <Plus size={18} />
            New Appointment
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Simple Calendar Grid */}
        <div className="lg:col-span-3 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="grid grid-cols-7 border-b border-gray-100">
            {days.map(day => (
              <div key={day} className="py-3 text-center text-xs font-bold text-gray-400 uppercase">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {Array.from({ length: 35 }).map((_, i) => {
              const dayNum = (i % 31) + 1;
              const hasApp = appointments.some(a => new Date(a.date).getDate() === dayNum);
              return (
                <div key={i} className="min-h-[120px] border-r border-b border-gray-100 p-2 hover:bg-indigo-50 transition cursor-pointer group">
                  <span className={`text-sm font-semibold ${dayNum === today.getDate() ? 'bg-indigo-600 text-white w-7 h-7 flex items-center justify-center rounded-full' : 'text-gray-500'}`}>
                    {dayNum}
                  </span>
                  {hasApp && (
                    <div className="mt-2 space-y-1">
                      {appointments
                        .filter(a => new Date(a.date).getDate() === dayNum)
                        .map(a => (
                          <div key={a.id} className="px-2 py-1 bg-indigo-100 text-indigo-700 text-[10px] rounded-md font-bold truncate">
                            {a.time} - {a.client_name}
                          </div>
                        ))
                      }
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Sidebar Schedule */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
            <h3 className="font-bold mb-4 flex items-center gap-2">
              <CalendarIcon size={18} className="text-indigo-600" />
              Today's Schedule
            </h3>
            <div className="space-y-4">
              {appointments.slice(0, 3).map(app => (
                <div key={app.id} className="border-l-4 border-indigo-600 pl-4 py-1">
                  <p className="text-sm font-bold">{app.client_name}</p>
                  <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                    <Clock size={12} />
                    {app.time} • {app.service_type}
                  </div>
                </div>
              ))}
              {appointments.length === 0 && <p className="text-sm text-gray-400">No sessions today.</p>}
            </div>
          </div>
          
          <div className="bg-indigo-600 p-6 rounded-xl text-white shadow-lg">
            <h3 className="font-bold text-lg mb-2">Weekly Summary</h3>
            <p className="text-indigo-100 text-sm mb-4">You have 14 appointments scheduled for the next 7 days.</p>
            <button className="w-full py-2 bg-white text-indigo-600 rounded-lg text-sm font-bold hover:bg-indigo-50 transition">
              View Agenda
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Appointments;
