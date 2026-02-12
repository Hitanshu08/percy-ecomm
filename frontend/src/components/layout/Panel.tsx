import React, { ReactNode } from 'react';

interface PanelProps {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}

const Panel: React.FC<PanelProps> = ({ title, actions, children, className, bodyClassName }) => {
  return (
    <div className={`glass-panel rounded-2xl border border-white/40 dark:border-slate-500/30 ${className || ''}`}>
      {(title || actions) && (
        <div className="px-6 py-4 border-b border-white/35 dark:border-slate-500/30 flex items-center justify-between">
          <div className="text-lg font-semibold text-gray-900 dark:text-white">{title}</div>
          {actions}
        </div>
      )}
      <div className={`p-4 ${bodyClassName || ''}`}>{children}</div>
    </div>
  );
};

export default Panel;


