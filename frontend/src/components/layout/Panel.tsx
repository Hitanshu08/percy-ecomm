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
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 ${className || ''}`}>
      {(title || actions) && (
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="text-lg font-semibold text-gray-900 dark:text-white">{title}</div>
          {actions}
        </div>
      )}
      <div className={`p-4 ${bodyClassName || ''}`}>{children}</div>
    </div>
  );
};

export default Panel;


