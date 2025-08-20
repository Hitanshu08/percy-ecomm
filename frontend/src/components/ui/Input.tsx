import React from "react";

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  error?: string;
  label?: string;
};

export default function Input({ label, error, className = "", id, ...props }: InputProps) {
  const inputId = id || (label ? `${label.replace(/\s+/g, "-").toLowerCase()}-input` : undefined);
  return (
    <div className="space-y-1">
      {label ? (
        <label htmlFor={inputId} className="block text-sm font-medium text-gray-700">
          {label}
        </label>
      ) : null}
      <input
        id={inputId}
        className={`block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500 ${className}`}
        {...props}
      />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}

