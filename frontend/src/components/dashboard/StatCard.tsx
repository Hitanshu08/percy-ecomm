import React, { ReactNode } from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  iconBgClass?: string;
  className?: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, iconBgClass, className }) => {
  return (
    <div className={`glass-panel-soft rounded-2xl p-4 border border-white/40 dark:border-slate-500/30 ${className || ''}`}>
      <div className="flex items-center">
        <div className="flex-shrink-0">
          <div className={`w-8 h-8 ${iconBgClass || 'bg-gray-100 dark:bg-gray-700'} rounded-lg flex items-center justify-center`}>
            {icon}
          </div>
        </div>
        <div className="ml-4">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
            {title}
          </p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {value}
          </p>
        </div>
      </div>
    </div>
  );
};

export default StatCard;


