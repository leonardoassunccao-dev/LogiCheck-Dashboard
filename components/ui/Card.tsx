import React from 'react';
import { Maximize2, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  noPadding?: boolean;
  subtitle?: string;
}

export const Card: React.FC<CardProps> = ({ children, className = '', title, subtitle, noPadding = false }) => {
  return (
    <div className={`bg-white dark:bg-slate-800 rounded-2xl shadow-soft border border-gray-100 dark:border-gray-700/50 transition-all duration-300 hover:shadow-lg ${className}`}>
      {title && (
        <div className="px-6 py-5 border-b border-gray-50 dark:border-gray-700/30 flex flex-col">
          <h3 className="text-base font-bold text-gray-800 dark:text-gray-100 tracking-tight">{title}</h3>
          {subtitle && <p className="text-xs text-gray-400 mt-0.5 font-medium">{subtitle}</p>}
        </div>
      )}
      <div className={noPadding ? '' : 'p-6'}>
        {children}
      </div>
    </div>
  );
};

interface KPICardProps {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
  subtext?: string;
  trend?: { value: number; direction: 'up' | 'down' | 'stable' };
  onClick?: () => void;
}

export const KPICard: React.FC<KPICardProps> = ({ title, value, icon, subtext, trend, onClick }) => (
  <div 
    onClick={onClick}
    className={`
      bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-soft border border-gray-100 dark:border-gray-700/50
      flex flex-col relative group overflow-hidden
      ${onClick ? 'cursor-pointer hover:border-marsala-200 dark:hover:border-marsala-900/50 hover:-translate-y-1 transition-all duration-300' : ''}
    `}
  >
    <div className="flex justify-between items-start mb-4">
      <div className={`p-2.5 rounded-xl bg-marsala-50 dark:bg-marsala-900/20 text-marsala-600 dark:text-marsala-400`}>
        {icon}
      </div>
      {trend && (
        <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold ${
          trend.direction === 'up' ? 'bg-green-50 text-green-600' : 
          trend.direction === 'down' ? 'bg-red-50 text-red-600' : 'bg-gray-50 text-gray-500'
        }`}>
          {trend.direction === 'up' && <TrendingUp size={10} />}
          {trend.direction === 'down' && <TrendingDown size={10} />}
          {trend.direction === 'stable' && <Minus size={10} />}
          {trend.value}%
        </div>
      )}
    </div>
    
    <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">
      {title}
    </p>
    
    <div className="flex items-baseline gap-2">
      <span className="text-2xl font-black text-gray-900 dark:text-white">{value}</span>
      {subtext && <span className="text-[10px] text-gray-400 font-medium">{subtext}</span>}
    </div>

    {onClick && <Maximize2 size={12} className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-40 transition-opacity text-marsala-500" />}
  </div>
);