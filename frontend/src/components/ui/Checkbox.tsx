import React from "react";

type CheckboxProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
};

export default function Checkbox({ label, className = "", ...props }: CheckboxProps) {
  return (
    <label className={`inline-flex items-center space-x-2 ${className}`}>
      <input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" {...props} />
      {label ? <span className="text-sm text-gray-700">{label}</span> : null}
    </label>
  );
}

