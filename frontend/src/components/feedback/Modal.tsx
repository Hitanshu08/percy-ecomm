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
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-lg w-full max-w-lg p-4">
        <div className="flex items-center justify-between mb-3">
          {title ? <h3 className="text-lg font-medium">{title}</h3> : <span />}
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
        </div>
        <div>{children}</div>
      </div>
    </div>
  );
}

