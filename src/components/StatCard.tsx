
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
  <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex items-start gap-4">
    <div className={`p-3 rounded-lg ${color} text-white`}>
      <Icon size={24} />
    </div>
    <div className="flex-1">
      <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
      <h3 className="text-2xl font-bold">{value}</h3>
      {trend && (
        <p className={`text-xs mt-1 ${trendUp ? 'text-green-600' : 'text-red-600'}`}>
          {trendUp ? '↑' : '↓'} {trend}
        </p>
      )}
    </div>
  </div>
);

export default StatCard;
