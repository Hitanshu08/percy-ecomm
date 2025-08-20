import React from "react";

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  error?: string;
};

export default function Select({ label, error, className = "", id, children, ...props }: SelectProps) {
  const selectId = id || (label ? `${label.replace(/\s+/g, "-").toLowerCase()}-select` : undefined);
  return (
    <div className="space-y-1">
      {label ? (
        <label htmlFor={selectId} className="block text-sm font-medium text-gray-700">
          {label}
        </label>
      ) : null}
      <select
        id={selectId}
        className={`block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500 ${className}`}
        {...props}
      >
        {children}
      </select>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}

