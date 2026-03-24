
import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  color: string;
  trend?: string;
  trendUp?: boolean;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon: Icon, color, trend, trendUp }) => (
  <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center gap-4 border-l-4 border-l-indigo-500">
    <div className={`p-3 rounded-lg ${color} text-white flex-shrink-0`}>
      <Icon size={20} />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-[10px] font-bold text-gray-400 mb-0.5 uppercase tracking-wider truncate">{title}</p>
      <h3 className="text-lg font-black text-gray-900 leading-none">{value}</h3>
      {trend && (
        <p className={`text-[10px] mt-1 font-bold ${trendUp ? 'text-green-600' : 'text-red-500'}`}>
          {trendUp ? '↑' : '↓'} {trend}
        </p>
      )}
    </div>
  </div>
);

export default StatCard;
