import React from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children?: React.ReactNode;
};

export default function Modal({ open, onClose, title, children }: Props) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center text-gray-900 dark:text-gray-100">
      <div className="absolute inset-0 bg-black/50 dark:bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-lg p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
        <div className="flex items-center justify-between mb-3">
          {title ? <h3 className="text-lg font-medium text-gray-900 dark:text-white">{title}</h3> : <span />}
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-white" aria-label="Close">✕</button>
        </div>
        <div className="text-gray-700 dark:text-gray-200">{children}</div>
      </div>
    </div>
  );
}

